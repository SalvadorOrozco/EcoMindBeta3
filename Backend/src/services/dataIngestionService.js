import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { parse as parseCsv } from 'csv-parse/sync';
import fetch from 'node-fetch';

import createError from '../utils/createError.js';
import {
  createIngestionRun,
  updateIngestionRun,
  insertIngestionItems,
  createIngestionAlerts,
  listIngestionRuns as listRunsRepository,
  listIngestionAlerts as listAlertsRepository,
  resolveIngestionAlert,
} from '../repositories/dataIngestionRepository.js';
import {
  integrateInsightsIntoMetrics,
  parseEvidenceFile,
  analyzeContentBlock,
  normalizeIndicatorValue,
  resolveIndicatorKeyFromLabel,
  resolvePillarFromIndicator,
  getIndicatorDictionary,
} from './aiAnalysisService.js';
import {
  upsertMetricsByType,
  getMetricsByPeriod,
  getColumnsForType,
} from '../repositories/metricRepository.js';

const DEFAULT_EMAIL_LIMIT = 10;
const UNIT_NORMALIZATION = [
  { match: /gwh/i, unit: 'kWh', factor: 1_000_000 },
  { match: /mwh/i, unit: 'kWh', factor: 1_000 },
  { match: /kwh/i, unit: 'kWh', factor: 1 },
  { match: /wh/i, unit: 'kWh', factor: 0.001 },
  { match: /m3|metros?\s*cubicos?/i, unit: 'm³', factor: 1 },
  { match: /l(i|í)tros?/i, unit: 'm³', factor: 0.001 },
  { match: /toneladas?|\bton\b/i, unit: 't', factor: 1 },
  { match: /kilogramos?|\bkg\b/i, unit: 't', factor: 0.001 },
  { match: /porcentaje|percent|%/i, unit: '%', factor: 1 },
];

const INDICATOR_LABELS = getIndicatorDictionary();

export async function runDataIngestion({
  companyId,
  period,
  files = [],
  emailConfig = null,
  apiSources = [],
}) {
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para la ingesta automática.');
  }

  const normalizedFiles = Array.isArray(files) ? files : [];
  const normalizedApis = Array.isArray(apiSources) ? apiSources : [];

  const run = await createIngestionRun({
    companyId,
    period,
    source: 'automated-ingestion',
    description: 'Ingesta automatizada de datos ESG',
    totalSources: normalizedFiles.length + (emailConfig ? 1 : 0) + normalizedApis.length,
    metadata: {
      email: emailConfig ? sanitizeEmailMetadata(emailConfig) : null,
      apiSources: normalizedApis.map((source) => pickApiMetadata(source)),
    },
  });

  const indicatorStats = new Map();
  const items = [];
  const alertBuffer = [];
  const insights = [];
  let processedFiles = 0;

  try {
    for (const file of normalizedFiles) {
      const processed = await processFileSource(file, { insights, items, alertBuffer, indicatorStats });
      if (processed) {
        processedFiles += 1;
      }
    }

    const emailAttachments = emailConfig
      ? await collectEmailAttachments(emailConfig, alertBuffer)
      : [];

    for (const attachment of emailAttachments) {
      const processed = await processFileSource(attachment, {
        insights,
        items,
        alertBuffer,
        indicatorStats,
        sourceOverride: 'correo-electronico',
        sourceMetadata: attachment.metadata ?? {},
      });
      if (processed) {
        processedFiles += 1;
      }
    }

    for (const apiSource of normalizedApis) {
      const dataset = await collectApiDataset(apiSource, alertBuffer);
      if (!dataset) {
        continue;
      }
      const processed = await processDataset(dataset, {
        insights,
        items,
        alertBuffer,
        indicatorStats,
        sourceOverride: 'api-interna',
        sourceMetadata: { endpoint: apiSource.url, name: apiSource.name ?? apiSource.id ?? null },
      });
      if (processed) {
        processedFiles += 1;
      }
    }

    if (insights.length === 0) {
      alertBuffer.push({
        type: 'sin-datos',
        level: 'warning',
        message: 'No se detectaron métricas ESG en las fuentes procesadas.',
      });
    }

    const combinedInsights = integrateInsightsIntoMetrics({}, insights);
    const existingMetrics = await getMetricsByPeriod(companyId, period);
    const mergedMetrics = mergeMetrics(existingMetrics, combinedInsights.metrics);
    const upsertPayload = buildUpsertPayload(combinedInsights.metrics, companyId, period);

    if (Object.keys(upsertPayload).length > 0) {
      await upsertMetricsByType(upsertPayload);
    }

    const aggregatedAlerts = [
      ...alertBuffer,
      ...buildGlobalAlerts(indicatorStats, mergedMetrics),
    ];

    const storedItems = await insertIngestionItems(run.id, items);
    const storedAlerts = await createIngestionAlerts(run.id, aggregatedAlerts);

    const finalRun = await updateIngestionRun(run.id, {
      status: storedAlerts.some((alert) => alert.level === 'error')
        ? 'completed-with-alerts'
        : 'completed',
      totalFiles: processedFiles,
      totalIndicators: computeTotalIndicators(insights),
      finishedAt: new Date(),
      summary: buildRunSummary(combinedInsights.metrics, storedAlerts, storedItems.length),
    });

    return {
      run: finalRun,
      alerts: storedAlerts,
      metrics: combinedInsights.metrics,
      items: storedItems,
    };
  } catch (error) {
    await updateIngestionRun(run.id, {
      status: 'failed',
      totalFiles: processedFiles,
      totalIndicators: computeTotalIndicators(insights),
      finishedAt: new Date(),
      summary: error.message,
    });
    throw error;
  }
}

export function listDataIngestionRuns({ companyId, limit = 20 }) {
  if (!companyId) {
    throw createError(400, 'companyId es requerido para listar ingestas.');
  }
  return listRunsRepository({ companyId, limit });
}

export function listDataIngestionAlerts({ companyId, unresolvedOnly = false, limit = 50 }) {
  if (!companyId) {
    throw createError(400, 'companyId es requerido para listar alertas.');
  }
  return listAlertsRepository({ companyId, unresolvedOnly, limit });
}

export function resolveDataIngestionAlert(alertId) {
  const numericId = Number(alertId);
  if (!Number.isFinite(numericId)) {
    throw createError(400, 'Identificador de alerta inválido.');
  }
  return resolveIngestionAlert(numericId);
}

async function processFileSource(file, context) {
  if (!file) {
    return false;
  }
  try {
    const extraction = await parseEvidenceFile(file);
    const dataset = {
      text: extraction.text,
      structuredData: extraction.structuredData,
      source: file.originalname ?? file.name ?? 'archivo',
      metadata: {
        type: extraction.type,
        mimetype: file.mimetype ?? file.mimeType ?? 'application/octet-stream',
        size: file.size ?? Buffer.byteLength(extraction.text ?? ''),
        ...(context.sourceMetadata ?? {}),
      },
    };
    return processDataset(dataset, context);
  } catch (error) {
    context.alertBuffer.push({
      type: 'archivo-invalido',
      level: 'error',
      message: `No se pudo procesar el archivo ${file?.originalname ?? file?.name ?? 'adjunto'}.`,
      metadata: {
        error: error.message,
      },
    });
    return false;
  }
}

async function processDataset(dataset, context) {
  const { text, structuredData, source, metadata } = dataset;
  const enrichedMetadata = { ...metadata, source };
  if (!text && (!structuredData || structuredData.length === 0)) {
    context.alertBuffer.push({
      type: 'datos-invalidos',
      level: 'warning',
      message: `La fuente ${source} no contiene información interpretable.`,
    });
    return false;
  }

  const analysis = await analyzeContentBlock({ text, structuredData });
  const records = extractRecordsFromStructuredData(
    structuredData,
    source,
    enrichedMetadata,
    context.indicatorStats,
    context.alertBuffer,
  );

  Object.entries(analysis.indicators ?? {}).forEach(([indicator, value]) => {
    if (value == null || value === '') {
      return;
    }
    const numeric = normalizeIndicatorValue(value);
    if (numeric == null) {
      return;
    }
    updateIndicatorStats(context.indicatorStats, indicator, numeric, null, enrichedMetadata, null);
    context.items.push({
      pillar: resolvePillarFromIndicator(indicator) ?? 'general',
      indicator,
      value: numeric,
      unit: null,
      source: context.sourceOverride ?? 'ingesta',
      date: enrichedMetadata?.date ?? null,
      metadata: {
        source,
        ...enrichedMetadata,
      },
    });
  });

  records.forEach((record) => {
    context.items.push({
      pillar: record.pillar ?? 'general',
      indicator: record.indicator,
      value: record.value,
      unit: record.unit ?? null,
      source: context.sourceOverride ?? record.source ?? 'ingesta',
      date: record.date ?? null,
      metadata: {
        column: record.column ?? null,
        source,
        ...enrichedMetadata,
      },
    });
  });

  context.insights.push({
    category: analysis.category,
    summary: analysis.summary,
    indicators: analysis.indicators,
    source,
  });

  if (records.length === 0 && Object.keys(analysis.indicators ?? {}).length === 0) {
    context.alertBuffer.push({
      type: 'indicadores-incompletos',
      level: 'warning',
      message: `No se identificaron métricas numéricas en ${source}.`,
    });
  }

  return true;
}

function extractRecordsFromStructuredData(structuredData, source, metadata, indicatorStats, alerts) {
  if (!Array.isArray(structuredData) || structuredData.length === 0) {
    return [];
  }

  const records = [];
  const missingIndicators = new Map();

  structuredData.forEach((row, rowIndex) => {
    if (!row || typeof row !== 'object') return;
    const date = detectDateInRow(row) ?? metadata?.date ?? null;

    Object.entries(row).forEach(([column, rawValue]) => {
      const indicator = resolveIndicatorKeyFromLabel(column);
      if (!indicator) {
        return;
      }

      if (rawValue == null || rawValue === '') {
        const tracker = missingIndicators.get(indicator) ?? [];
        tracker.push(rowIndex + 1);
        missingIndicators.set(indicator, tracker);
        return;
      }

      const parsed = normalizeValueWithUnit(rawValue, column);
      if (parsed.value == null) {
        alerts.push({
          type: 'datos-invalidos',
          level: 'warning',
          indicator,
          message: `No se pudo interpretar el valor en la columna "${column}" (fila ${rowIndex + 1}).`,
        });
        return;
      }

      const pillar = resolvePillarFromIndicator(indicator) ?? 'general';
      updateIndicatorStats(indicatorStats, indicator, parsed.value, parsed.unit, metadata, date);

      records.push({
        indicator,
        value: parsed.value,
        unit: parsed.unit,
        originalUnit: parsed.originalUnit,
        pillar,
        date,
        column,
        source,
      });
    });
  });

  missingIndicators.forEach((rows, indicator) => {
    alerts.push({
      type: 'datos-faltantes',
      level: 'warning',
      indicator,
      message: `Se detectaron ${rows.length} filas sin dato para ${humanizeIndicator(indicator)} en ${source}.`,
      metadata: { rows },
    });
  });

  return records;
}

function normalizeValueWithUnit(rawValue, columnName) {
  const result = {
    value: null,
    unit: detectUnitFromColumn(columnName) ?? null,
    originalUnit: null,
  };

  if (typeof rawValue === 'number') {
    result.value = rawValue;
  } else if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    const match = trimmed.match(/-?[0-9]+[\.,]?[0-9]*/);
    if (match) {
      result.value = normalizeIndicatorValue(match[0]);
    }
    result.originalUnit = detectUnitFromValue(trimmed);
  }

  if (result.value == null && rawValue && typeof rawValue === 'object') {
    const numericCandidate = rawValue.value ?? rawValue.val ?? rawValue.amount ?? null;
    const unitCandidate = rawValue.unit ?? rawValue.units ?? null;
    if (numericCandidate != null) {
      result.value = normalizeIndicatorValue(numericCandidate);
    }
    if (unitCandidate) {
      result.originalUnit = unitCandidate;
    }
  }

  const unitToNormalize = result.originalUnit ?? result.unit;
  if (result.value != null && unitToNormalize) {
    const normalized = convertUnit(result.value, unitToNormalize);
    result.value = normalized.value;
    result.unit = normalized.unit;
    result.originalUnit = normalized.originalUnit;
  }

  return result;
}

function convertUnit(value, unitCandidate) {
  const normalizedUnit = UNIT_NORMALIZATION.find((entry) => entry.match.test(unitCandidate));
  if (!normalizedUnit) {
    return { value, unit: unitCandidate, originalUnit: unitCandidate };
  }
  return {
    value: value * normalizedUnit.factor,
    unit: normalizedUnit.unit,
    originalUnit: unitCandidate,
  };
}

function detectUnitFromColumn(columnName) {
  if (!columnName) return null;
  const lower = columnName.toLowerCase();
  if (lower.includes('%') || lower.includes('porcentaje') || lower.includes('participacion')) {
    return '%';
  }
  if (lower.includes('kwh') || lower.includes('energia')) {
    return 'kWh';
  }
  if (lower.includes('agua') || lower.includes('m3')) {
    return 'm³';
  }
  if (lower.includes('residuo') || lower.includes('ton') || lower.includes('tonelada')) {
    return 't';
  }
  return null;
}

function detectUnitFromValue(value) {
  if (!value) return null;
  for (const candidate of UNIT_NORMALIZATION) {
    if (candidate.match.test(value)) {
      return value.match(candidate.match)?.[0] ?? candidate.unit;
    }
  }
  return null;
}

function updateIndicatorStats(map, indicator, value, unit, metadata, date) {
  if (!indicator) return;
  if (!map.has(indicator)) {
    map.set(indicator, {
      values: [],
      units: new Set(),
      dates: [],
      sources: [],
    });
  }
  const entry = map.get(indicator);
  entry.values.push({ value, source: metadata?.source ?? metadata?.endpoint ?? null });
  if (unit) {
    entry.units.add(unit);
  }
  if (date) {
    entry.dates.push(date);
  }
  entry.sources.push(metadata?.source ?? metadata?.endpoint ?? null);
}

function detectDateInRow(row) {
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes('fecha') ||
      normalizedKey.includes('periodo') ||
      normalizedKey.includes('año') ||
      normalizedKey.includes('anio') ||
      normalizedKey.includes('ano') ||
      normalizedKey.includes('year')
    ) {
      const date = tryParseDate(value);
      if (date) {
        return date;
      }
    }
  }
  return null;
}

function tryParseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}

async function collectEmailAttachments(config, alerts) {
  if (!config?.host || !config?.user || !config?.password) {
    alerts.push({
      type: 'fuente-email-invalida',
      level: 'warning',
      message: 'La configuración de correo está incompleta, se omitirá la ingesta por email.',
    });
    return [];
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port ?? 993,
    secure: config.secure !== false,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  const attachments = [];
  try {
    await client.connect();
    const mailbox = config.mailbox ?? 'INBOX';
    const lock = await client.getMailboxLock(mailbox);
    try {
      const since = config.sinceDays
        ? new Date(Date.now() - Number(config.sinceDays) * 24 * 60 * 60 * 1000)
        : null;
      const searchCriteria = buildEmailSearchCriteria(config, since);
      const uids = await client.search(searchCriteria, {
        limit: config.maxEmails ?? DEFAULT_EMAIL_LIMIT,
        sort: ['ARRIVAL', 'DESC'],
      });

      for await (const message of client.fetch(uids, { source: true })) {
        const parsed = await simpleParser(message.source);
        parsed.attachments?.forEach((attachment) => {
          if (!attachment?.content || attachment.content.length === 0) {
            return;
          }
          attachments.push({
            buffer: Buffer.isBuffer(attachment.content)
              ? attachment.content
              : Buffer.from(attachment.content),
            originalname:
              attachment.filename ??
              `${parsed.subject ?? 'adjunto'}-${Date.now()}.${detectExtension(attachment.contentType)}`,
            mimetype: attachment.contentType,
            size: attachment.size ?? attachment.content.length,
            metadata: {
              from: parsed.from?.text ?? null,
              subject: parsed.subject ?? null,
              date: parsed.date ?? null,
            },
          });
        });
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    alerts.push({
      type: 'fuente-email-error',
      level: 'warning',
      message: 'No se pudieron descargar adjuntos del correo corporativo.',
      metadata: { error: error.message },
    });
  } finally {
    if (!client.closed) {
      await client.logout().catch(() => {});
    }
  }

  return attachments;
}

async function collectApiDataset(source, alerts) {
  if (!source?.url) {
    alerts.push({
      type: 'fuente-api-invalida',
      level: 'warning',
      message: 'Se omitió una fuente API sin URL definida.',
    });
    return null;
  }

  try {
    const response = await fetch(source.url, {
      method: source.method ?? 'GET',
      headers: source.headers ?? undefined,
      body: buildApiBody(source),
    });

    if (!response.ok) {
      alerts.push({
        type: 'fuente-api-error',
        level: 'warning',
        message: `La API ${source.url} respondió con estado ${response.status}.`,
      });
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (source.format === 'csv' || contentType.includes('text/csv')) {
      const text = await response.text();
      const structuredData = parseCsv(text, { columns: true, skip_empty_lines: true });
      return {
        text,
        structuredData,
        source: source.name ?? source.url,
        metadata: { endpoint: source.url },
      };
    }

    if (source.format === 'json' || contentType.includes('application/json')) {
      const json = await response.json();
      const data = source.dataPath ? resolveDataPath(json, source.dataPath) : json;
      const structuredData = Array.isArray(data)
        ? data.map((row) => flattenObject(row))
        : [flattenObject(data)];
      const text = JSON.stringify(data);
      return {
        text,
        structuredData,
        source: source.name ?? source.url,
        metadata: { endpoint: source.url },
      };
    }

    const text = await response.text();
    return {
      text,
      structuredData: [],
      source: source.name ?? source.url,
      metadata: { endpoint: source.url },
    };
  } catch (error) {
    alerts.push({
      type: 'fuente-api-error',
      level: 'warning',
      message: `Error al consultar ${source.url}: ${error.message}`,
    });
    return null;
  }
}

function buildApiBody(source) {
  if (!source?.body) {
    return undefined;
  }
  if (typeof source.body === 'string') {
    return source.body;
  }
  try {
    return JSON.stringify(source.body);
  } catch (error) {
    return undefined;
  }
}

function resolveDataPath(data, pathExpression) {
  if (!pathExpression) return data;
  return pathExpression.split('.').reduce((acc, key) => {
    if (acc == null) return null;
    if (Array.isArray(acc)) {
      return acc.map((item) => item?.[key]).filter((item) => item != null);
    }
    return acc?.[key] ?? null;
  }, data);
}

function flattenObject(obj, prefix = '', result = {}) {
  if (obj == null) {
    return result;
  }
  if (Array.isArray(obj)) {
    obj.forEach((value, index) => {
      flattenObject(value, `${prefix}${prefix ? '.' : ''}${index}`, result);
    });
    return result;
  }
  if (typeof obj !== 'object') {
    result[prefix] = obj;
    return result;
  }
  Object.entries(obj).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      flattenObject(value, nextPrefix, result);
    } else {
      result[nextPrefix] = value;
    }
  });
  return result;
}

function buildEmailSearchCriteria(config, since) {
  const criteria = ['ALL'];
  if (config.from) {
    criteria.push(['FROM', config.from]);
  }
  if (config.subject) {
    criteria.push(['HEADER', 'SUBJECT', config.subject]);
  }
  if (since) {
    criteria.push(['SINCE', formatImapDate(since)]);
  }
  return criteria;
}

function formatImapDate(date) {
  return `${date.getDate()}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear()}`;
}

function detectExtension(contentType) {
  if (!contentType) return 'dat';
  const ext = contentType.split('/').pop();
  return ext ?? 'dat';
}

function sanitizeEmailMetadata(config) {
  return {
    host: config.host,
    mailbox: config.mailbox ?? 'INBOX',
    sinceDays: config.sinceDays ?? null,
    from: config.from ?? null,
    subject: config.subject ?? null,
  };
}

function pickApiMetadata(source) {
  return {
    id: source?.id ?? null,
    name: source?.name ?? null,
    url: source?.url ?? null,
    format: source?.format ?? null,
  };
}

function computeTotalIndicators(insights) {
  return insights.reduce((acc, insight) => acc + Object.keys(insight.indicators ?? {}).length, 0);
}

function buildUpsertPayload(metrics, companyId, period) {
  const payload = {};
  Object.entries(metrics ?? {}).forEach(([type, values]) => {
    const entries = Object.entries(values ?? {}).filter(([, value]) => value != null);
    if (entries.length === 0) {
      return;
    }
    payload[type] = [
      Object.fromEntries([
        ['companyId', companyId],
        ['period', period],
        ...entries,
      ]),
    ];
  });
  return payload;
}

function mergeMetrics(existing, incoming) {
  const merged = {
    environmental: { ...(existing?.environmental ?? {}), ...(incoming?.environmental ?? {}) },
    social: { ...(existing?.social ?? {}), ...(incoming?.social ?? {}) },
    governance: { ...(existing?.governance ?? {}), ...(incoming?.governance ?? {}) },
  };
  return merged;
}

function buildGlobalAlerts(indicatorStats, mergedMetrics) {
  const alerts = [];
  indicatorStats.forEach((entry, indicator) => {
    if (entry.units.size > 1) {
      alerts.push({
        type: 'unidad-inconsistente',
        level: 'warning',
        indicator,
        message: `Se detectaron múltiples unidades para ${humanizeIndicator(indicator)}.`,
        metadata: { units: Array.from(entry.units) },
      });
    }
    if (entry.values.length > 1) {
      const values = entry.values.map((item) => item.value).filter((value) => typeof value === 'number');
      if (values.length > 1) {
        const max = Math.max(...values);
        const min = Math.min(...values);
        if (max > 0 && (max - min) / max > 0.25) {
          alerts.push({
            type: 'indicadores-inconsistentes',
            level: 'warning',
            indicator,
            message: `Los valores de ${humanizeIndicator(indicator)} difieren significativamente entre fuentes.`,
            metadata: { values },
          });
        }
      }
    }
  });

  ['environmental', 'social', 'governance'].forEach((type) => {
    const expectedColumns = getColumnsForType(type);
    expectedColumns.forEach((column) => {
      const key = column.charAt(0).toLowerCase() + column.slice(1);
      const value = mergedMetrics?.[type]?.[key];
      if (value == null && indicatorStats.has(key)) {
        alerts.push({
          type: 'indicadores-incompletos',
          level: 'warning',
          indicator: key,
          message: `${humanizeIndicator(key)} no cuenta con un valor consolidado tras la ingesta.`,
        });
      }
    });
  });

  return alerts;
}

function humanizeIndicator(indicator) {
  return INDICATOR_LABELS[indicator] ?? indicator;
}

function buildRunSummary(metrics, alerts, itemsCount) {
  const sections = [];
  const totals = Object.entries(metrics ?? {}).reduce((acc, [type, values]) => {
    const count = Object.values(values ?? {}).filter((value) => value != null).length;
    if (count > 0) {
      sections.push(`${capitalize(type)}: ${count} métricas actualizadas`);
    }
    return acc + count;
  }, 0);

  if (itemsCount) {
    sections.push(`${itemsCount} registros normalizados`);
  }

  if (alerts?.length) {
    sections.push(`${alerts.length} alertas generadas`);
  }

  return sections.length > 0 ? sections.join(' · ') : `0 métricas procesadas`;
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
