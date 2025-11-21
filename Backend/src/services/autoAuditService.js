import createError from '../utils/createError.js';
import { runGeminiPrompt } from './aiService.js';
import { METRIC_TYPES, COLUMNS, getMetricsForCompany } from '../repositories/metricRepository.js';
import { listCustomIndicators } from '../repositories/customIndicatorRepository.js';
import { listEvidence } from '../repositories/evidenceRepository.js';
import { insertAuditLogs, listAuditLogs } from '../repositories/auditLogRepository.js';
import { getCompanyById } from '../repositories/companyRepository.js';

function normalizeKey(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

function clampConfidence(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 0;
  }
  const numeric = Number(value);
  if (numeric <= 1 && numeric >= 0) {
    return Math.round(numeric * 100);
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

async function getLatestMetricIndicators(companyId) {
  const bundles = [];

  for (const type of METRIC_TYPES) {
    const metrics = await getMetricsForCompany(type, companyId);
    if (!metrics?.length) continue;
    const latest = metrics[0];
    const columns = COLUMNS[type];

    columns.forEach((column) => {
      const key = column.charAt(0).toLowerCase() + column.slice(1);
      const value = latest[key];
      if (value === null || value === undefined) return;
      bundles.push({
        indicatorKey: key,
        indicatorId: null,
        plantId: null,
        value,
        period: latest.period ?? null,
      });
    });
  }

  return bundles;
}

async function getCustomIndicatorBundles(companyId) {
  const indicators = await listCustomIndicators(companyId);
  return indicators
    .filter((indicator) => indicator.value !== null && indicator.value !== undefined)
    .map((indicator) => ({
      indicatorKey: indicator.name,
      indicatorId: indicator.id,
      plantId: indicator.plantId ?? null,
      value: indicator.value,
      period: indicator.period ?? null,
    }));
}

async function buildEvidenceIndex(companyId) {
  const evidences = await listEvidence({ companyId });
  const map = new Map();

  evidences.forEach((evidence) => {
    const key = normalizeKey(evidence.indicator ?? evidence.metadata?.indicator ?? null);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(evidence);
  });

  return map;
}

function buildPrompt(company, bundles, evidenceIndex) {
  const lines = [
    'Actúa como auditor ESG automatizado. Debes verificar si el valor del indicador está respaldado por las evidencias.',
    'Responde en formato JSON con el esquema {"results":[{"indicator":"nombre","status":"verified|failed","confidence":0-100,"message":"explica"}]}',
    `Empresa: ${company.name}. Industria: ${company.industry ?? 'N/D'}. Ubicación: ${company.address ?? 'N/D'}.`,
    '',
    'Indicadores a validar:',
  ];

  bundles.forEach((bundle) => {
    const key = normalizeKey(bundle.indicatorKey);
    const evidences = evidenceIndex.get(key) ?? [];
    lines.push(
      JSON.stringify(
        {
          indicator: bundle.indicatorKey,
          value: bundle.value,
          period: bundle.period ?? 'N/D',
          evidences: evidences.length ? evidences.map((e) => ({
            type: e.type,
            period: e.period,
            indicator: e.indicator,
            fileName: e.fileName,
            metadata: e.metadata ?? null,
          })) : [],
        },
        null,
        2,
      ),
    );
  });

  lines.push(
    '',
    'Evalúa si la evidencia respalda el número declarado. Usa "failed" si es inconsistente o no hay evidencia suficiente.',
    'Incluye siempre un confidence de 0 a 100.',
  );

  return lines.join('\n');
}

function parseAiResults(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const jsonString = fenced ? fenced[1] : text;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

function normalizeResults(aiPayload, bundles, evidenceIndex) {
  const fallback = [];
  const aiResults = aiPayload?.results ?? aiPayload?.resultados ?? [];
  const resultByKey = new Map();

  for (const item of aiResults) {
    const key = normalizeKey(item.indicator ?? item.indicador ?? item.name);
    if (!key) continue;
    resultByKey.set(key, {
      status: (item.status ?? item.estado ?? '').toLowerCase() === 'failed' ? 'failed' : 'verified',
      confidence: clampConfidence(item.confidence ?? item.confianza ?? item.score ?? 0),
      message: item.message ?? item.mensaje ?? 'Resultado generado por IA.',
    });
  }

  bundles.forEach((bundle) => {
    const key = normalizeKey(bundle.indicatorKey);
    const aiResult = resultByKey.get(key);
    const evidences = evidenceIndex.get(key) ?? [];

    if (aiResult) {
      fallback.push({ bundle, evidences, ...aiResult });
      return;
    }

    const hasEvidence = evidences.length > 0;
    fallback.push({
      bundle,
      evidences,
      status: hasEvidence ? 'verified' : 'failed',
      confidence: hasEvidence ? 65 : 30,
      message: hasEvidence
        ? 'Validación automática con evidencia presente. Ajusta manualmente si es necesario.'
        : 'No se encontraron evidencias asociadas, se marcó como pendiente de revisión.',
    });
  });

  return fallback;
}

export async function runAutoAuditForCompany(companyId) {
  if (!companyId) {
    throw createError(400, 'companyId es requerido para ejecutar la auditoría automática.');
  }

  const company = await getCompanyById(companyId);
  if (!company) {
    throw createError(404, 'Empresa no encontrada para auditoría.');
  }

  const [metricBundles, customBundles, evidenceIndex] = await Promise.all([
    getLatestMetricIndicators(companyId),
    getCustomIndicatorBundles(companyId),
    buildEvidenceIndex(companyId),
  ]);

  const bundles = [...metricBundles, ...customBundles];
  if (!bundles.length) {
    throw createError(400, 'No hay indicadores para auditar en la empresa.');
  }

  const prompt = buildPrompt(company, bundles, evidenceIndex);
  let aiPayload = null;
  try {
    const aiText = await runGeminiPrompt(prompt);
    aiPayload = parseAiResults(aiText);
  } catch (error) {
    console.error('[EsgAutoAudit] Error al consultar IA, se usará lógica de respaldo:', error.message);
  }

  const normalized = normalizeResults(aiPayload ?? {}, bundles, evidenceIndex);

  const logs = normalized.map((entry) => ({
    companyId,
    plantId: entry.bundle.plantId,
    indicatorId: entry.bundle.indicatorId,
    indicatorKey: entry.bundle.indicatorKey,
    status: entry.status,
    message: entry.message,
    confidence: entry.confidence,
  }));

  return insertAuditLogs(logs);
}

export async function listAutoAuditLogs({ companyId, plantId = null, limit = 100 }) {
  if (!companyId) {
    throw createError(400, 'companyId es requerido para obtener logs de auditoría.');
  }
  return listAuditLogs({ companyId, plantId, limit });
}
