import createError from '../utils/createError.js';
import {
  createAuditRun,
  completeAuditRun,
  insertAuditFindings,
  listAuditRuns as listAuditRunsRepository,
  getLatestAuditRun,
  listAuditFindings as listAuditFindingsByRun,
  getAuditRunById,
} from '../repositories/auditRepository.js';
import { getMetricsForCompany, METRIC_TYPES } from '../repositories/metricRepository.js';
import { getMetricValidationMetadata } from '../validators/metricValidator.js';
import { getIndicatorDictionary } from './aiAnalysisService.js';

const INDICATOR_LABELS = getIndicatorDictionary();
const METRIC_RULES = getMetricValidationMetadata();

const CATEGORY_RULES = [
  { category: 'percentage', pattern: /(porc|porcentaje|tasa|nivel|indice|índice)/i },
  { category: 'energy', pattern: /(energia|energía|kwh|gwh|mwh|intensidad)/i },
  { category: 'emissions', pattern: /(emision|emisión|co2|huella|alcance)/i },
  { category: 'water', pattern: /(agua|m3|litro|m\u00b3)/i },
  { category: 'waste', pattern: /(residu|valorizad)/i },
  { category: 'currency', pattern: /(usd|\b\$|inversion|inversión|gasto|monto)/i },
  { category: 'hours', pattern: /(hora)/i },
  { category: 'count', pattern: /(incidente|sancion|auditoria|accidente|reunion|programa|caso|denuncias?)/i },
];

const CATEGORY_HEURISTICS = {
  percentage: { min: 0, max: 100, jumpWarning: 0.25, jumpCritical: 0.4, expectedTolerance: 0.2 },
  energy: { min: 0, jumpWarning: 0.35, jumpCritical: 0.65, unitRatio: 30 },
  emissions: { min: 0, jumpWarning: 0.35, jumpCritical: 0.65, unitRatio: 30 },
  water: { min: 0, jumpWarning: 0.4, jumpCritical: 0.7, unitRatio: 30 },
  waste: { min: 0, jumpWarning: 0.4, jumpCritical: 0.75, unitRatio: 30 },
  currency: { min: 0, jumpWarning: 0.6, jumpCritical: 1.1, expectedTolerance: 0.35 },
  hours: { min: 0, jumpWarning: 0.6, jumpCritical: 1.2, absoluteWarning: 120000 },
  count: { min: 0, jumpWarning: 1, jumpCritical: 1.6 },
  boolean: {},
  text: {},
  numeric: { min: null, jumpWarning: 0.5, jumpCritical: 1.2 },
};

const SEVERITY_PRIORITY = { info: 1, warning: 2, critical: 3 };

export async function runEsgAudit({ companyId, period, triggeredBy }) {
  if (!companyId) {
    throw createError(400, 'companyId es requerido para ejecutar la auditoría.');
  }

  const { timeline, duplicates } = await buildMetricHistory(companyId);
  const targetPeriod = resolveTargetPeriod(timeline, period);
  const run = await createAuditRun({
    companyId,
    period: targetPeriod,
    triggeredBy,
    metadata: { requestedPeriod: period ?? null },
  });

  const orderedEntries = sortTimelineEntries(timeline);
  const analysis = analyzeTimeline({ entries: orderedEntries, targetPeriod, duplicates });

  if (analysis.findings.length > 0) {
    await insertAuditFindings(run.id, analysis.findings);
  }

  const finalRun = await completeAuditRun(run.id, {
    status: analysis.findings.some((finding) => finding.severity === 'critical')
      ? 'completed-with-findings'
      : 'completed',
    totalIndicators: analysis.metricsEvaluated,
    totalFindings: analysis.findings.length,
    summary: analysis.summary,
    finishedAt: new Date(),
    severityBreakdown: analysis.severityCounts,
  });

  return {
    run: { ...finalRun, severityBreakdown: analysis.severityCounts },
    findings: analysis.findings,
    indicatorSeverity: buildIndicatorSeverityIndex(analysis.findings),
  };
}

export async function listAuditRuns({ companyId, limit = 20 }) {
  if (!companyId) {
    throw createError(400, 'companyId es requerido para listar auditorías.');
  }
  return listAuditRunsRepository({ companyId, limit });
}

export async function getAuditSummary({ companyId, period, runId, severity }) {
  let run = null;
  if (runId) {
    run = await getAuditRunById(runId);
    if (run && run.companyId !== Number(companyId ?? run.companyId)) {
      run = null;
    }
  }

  if (!run) {
    if (!companyId) {
      throw createError(400, 'companyId es requerido para obtener hallazgos de auditoría.');
    }
    run = await getLatestAuditRun(companyId, period ?? null);
  }

  if (!run) {
    return { run: null, findings: [], indicatorSeverity: {}, totals: { critical: 0, warning: 0, info: 0 } };
  }

  const findings = await listAuditFindingsByRun(run.id, { severity });
  const indicatorSeverity = buildIndicatorSeverityIndex(findings);
  const totals = {
    critical: run.criticalFindings ?? 0,
    warning: run.warningFindings ?? 0,
    info: run.infoFindings ?? 0,
  };
  return { run, findings, indicatorSeverity, totals };
}

async function buildMetricHistory(companyId) {
  const timeline = new Map();
  const duplicates = [];

  await Promise.all(
    METRIC_TYPES.map(async (type) => {
      const records = await getMetricsForCompany(type, companyId);
      const seenPeriods = new Map();
      for (const record of records) {
        const periodKey = record.period ?? 'SIN_PERIODO';
        const entry = ensureTimelineEntry(timeline, periodKey);
        const metricsOnly = extractMetrics(record);
        entry[type] = { ...entry[type], ...metricsOnly };
        const currentCount = (seenPeriods.get(periodKey) ?? 0) + 1;
        seenPeriods.set(periodKey, currentCount);
        if (currentCount > 1) {
          duplicates.push({ type, period: periodKey, count: currentCount });
        }
      }
    }),
  );

  return { timeline, duplicates };
}

function analyzeTimeline({ entries, targetPeriod, duplicates }) {
  const findings = [];
  const severityCounts = { critical: 0, warning: 0, info: 0 };
  let metricsEvaluated = 0;

  if (!entries.length) {
    const message = 'No se encontraron indicadores ESG cargados para auditar.';
    findings.push({
      pillar: 'environmental',
      indicator: '__general__',
      severity: 'info',
      category: 'sin-datos',
      message,
      suggestion: 'Carga indicadores del periodo antes de ejecutar la auditoría automática.',
      period: targetPeriod ?? null,
    });
    severityCounts.info += 1;
    return {
      findings,
      severityCounts,
      metricsEvaluated: 0,
      summary: 'Sin datos disponibles para auditar.',
    };
  }

  const targetIndex = entries.findIndex((entry) => entry.period === targetPeriod);
  const scopedTargetIndex = targetIndex === -1 ? entries.length - 1 : targetIndex;

  Object.entries(METRIC_RULES).forEach(([pillar, config]) => {
    Object.keys(config).forEach((indicator) => {
      metricsEvaluated += 1;
      const series = entries.map((entry) => ({
        period: entry.period,
        value: entry?.[pillar]?.[indicator] ?? null,
      }));
      const indicatorFindings = evaluateIndicator({
        indicator,
        pillar,
        series,
        targetIndex: scopedTargetIndex,
        validation: config[indicator],
      });
      indicatorFindings.forEach((finding) => {
        findings.push(finding);
        severityCounts[finding.severity] = (severityCounts[finding.severity] ?? 0) + 1;
      });
    });
  });

  duplicates.forEach((entry) => {
    findings.push({
      pillar: entry.type,
      indicator: '__duplicated__',
      severity: 'warning',
      category: 'duplicated-records',
      message: `Se detectaron ${entry.count} registros de ${humanizePillar(entry.type)} para el periodo ${entry.period}.`,
      suggestion: 'Conserva un único registro consolidado por periodo antes de cerrar la auditoría.',
      period: targetPeriod ?? entry.period,
      metadata: { period: entry.period, pillar: entry.type },
    });
    severityCounts.warning += 1;
  });

  const summary = buildSummary({ metricsEvaluated, severityCounts, findingsCount: findings.length });
  return { findings, severityCounts, metricsEvaluated, summary };
}

function evaluateIndicator({ indicator, pillar, series, targetIndex, validation }) {
  const findings = [];
  const label = INDICATOR_LABELS[indicator] ?? indicator;
  const category = resolveCategory(indicator, validation, pillar);
  const heuristics = CATEGORY_HEURISTICS[category] ?? CATEGORY_HEURISTICS.numeric;
  const currentEntry = series[targetIndex] ?? { period: null, value: null };
  const previousEntry = targetIndex > 0 ? series[targetIndex - 1] : null;
  const historyValues = series.map((item) => toNumeric(item.value, category));
  const currentValue = toNumeric(currentEntry.value, category);
  const previousValue = toNumeric(previousEntry?.value, category);
  const expectedValue = computeExpectedValue(historyValues.slice(0, targetIndex));
  const period = currentEntry.period ?? null;
  const comparisonPeriod = previousEntry?.period ?? null;

  if (validation?.type === 'text') {
    if (!currentValue) {
      findings.push({
        pillar,
        indicator,
        severity: 'info',
        category: 'dato-faltante',
        message: `${label} no tiene comentarios registrados para ${period ?? 'el periodo actual'}.`,
        suggestion: 'Registra la descripción o evidencia cualitativa asociada al indicador.',
        period,
      });
    }
    return findings;
  }

  if (currentValue == null) {
    findings.push({
      pillar,
      indicator,
      severity: 'warning',
      category: 'dato-faltante',
      message: `${label} no cuenta con un valor cargado para ${period ?? 'el periodo actual'}.`,
      suggestion: 'Carga o confirma el valor del indicador antes de emitir el reporte ESG.',
      period,
    });
    return findings;
  }

  if (category === 'boolean') {
    if (!isBooleanLike(currentEntry.value)) {
      findings.push({
        pillar,
        indicator,
        severity: 'warning',
        category: 'formato-invalido',
        message: `${label} debería ser un valor booleano (Sí/No).`,
        suggestion: 'Utiliza valores verdaderos/falsos o 1/0 para registrar el cumplimiento.',
        period,
        currentValue,
      });
    }
    return findings;
  }

  if (typeof heuristics.min === 'number' && currentValue < heuristics.min) {
    const severity = currentValue < heuristics.min * -0.1 ? 'critical' : 'warning';
    findings.push({
      pillar,
      indicator,
      severity,
      category: 'fuera-de-rango',
      message: `${label} presenta un valor negativo que no es válido (${currentValue}).`,
      suggestion: 'Verifica la fuente original e ingresa el dato expresado en unidades positivas.',
      period,
      currentValue,
    });
  }

  if (typeof validation?.max === 'number' && currentValue > validation.max) {
    const severity = validation.max === 100 ? 'critical' : 'warning';
    findings.push({
      pillar,
      indicator,
      severity,
      category: 'fuera-de-rango',
      message: `${label} supera el límite permitido de ${validation.max}.`,
      suggestion: 'Revisa si el dato está expresado en la unidad correcta o si falta normalizarlo.',
      period,
      currentValue,
      metadata: { max: validation.max },
    });
  } else if (typeof heuristics.max === 'number' && currentValue > heuristics.max) {
    findings.push({
      pillar,
      indicator,
      severity: 'warning',
      category: 'valor-elevado',
      message: `${label} supera los valores típicos esperados (${currentValue}).`,
      suggestion: 'Confirma si el indicador requiere dividirse por la unidad adecuada o si hubo un pico excepcional.',
      period,
      currentValue,
      metadata: { max: heuristics.max },
    });
  }

  if (previousValue != null) {
    const delta = currentValue - previousValue;
    const deltaPercentage = previousValue === 0 ? null : delta / Math.abs(previousValue);
    const ratio = previousValue === 0 ? null : Math.abs(currentValue / previousValue);
    if (deltaPercentage != null) {
      const changeAbs = Math.abs(deltaPercentage);
      if (heuristics.unitRatio && ratio != null && (ratio >= heuristics.unitRatio || ratio <= 1 / heuristics.unitRatio)) {
        findings.push({
          pillar,
          indicator,
          severity: 'critical',
          category: 'posible-unidad-incorrecta',
          message: `${label} cambió aproximadamente ${ratio.toFixed(1)} veces respecto a ${comparisonPeriod}, lo que sugiere un problema de unidades.`,
          suggestion: 'Revisa si el dato está expresado en kWh vs MWh, litros vs m³ u otra unidad equivalente.',
          period,
          comparisonPeriod,
          currentValue,
          previousValue,
          delta,
          deltaPercentage,
          metadata: { ratio },
        });
      } else if (heuristics.jumpCritical && changeAbs > heuristics.jumpCritical) {
        findings.push({
          pillar,
          indicator,
          severity: 'critical',
          category: 'salto-abrupto',
          message: `${label} presenta un salto de ${formatPercent(deltaPercentage)} respecto a ${comparisonPeriod}.`,
          suggestion: 'Confirma con el área responsable si existe una justificación o corrige el dato en el sistema.',
          period,
          comparisonPeriod,
          currentValue,
          previousValue,
          delta,
          deltaPercentage,
        });
      } else if (heuristics.jumpWarning && changeAbs > heuristics.jumpWarning) {
        findings.push({
          pillar,
          indicator,
          severity: 'warning',
          category: 'variacion-significativa',
          message: `${label} cambia ${formatPercent(deltaPercentage)} respecto a ${comparisonPeriod}.`,
          suggestion: 'Valida la consistencia con el periodo previo y documenta la causa de la variación.',
          period,
          comparisonPeriod,
          currentValue,
          previousValue,
          delta,
          deltaPercentage,
        });
      }
    }
  }

  if (expectedValue != null && currentValue != null) {
    const deviation = expectedValue === 0 ? null : Math.abs(currentValue - expectedValue) / Math.abs(expectedValue);
    if (deviation != null) {
      const tolerance = heuristics.expectedTolerance ?? 0.25;
      if (deviation > tolerance && (!previousValue || Math.abs(currentValue - previousValue) <= Math.abs(expectedValue - previousValue ?? 0))) {
        findings.push({
          pillar,
          indicator,
          severity: 'info',
          category: 'desvio-modelo',
          message: `${label} se desvía del valor esperado (${expectedValue?.toFixed?.(2) ?? expectedValue}).`,
          suggestion: 'Documenta la causa de la desviación o ajusta el dato con la última información disponible.',
          period,
          expectedValue,
          currentValue,
        });
      }
    }
  }

  if (category !== 'boolean') {
    const stableSequence = longestStableSequence(historyValues);
    if (stableSequence >= 3 && currentValue !== null && currentValue !== 0) {
      findings.push({
        pillar,
        indicator,
        severity: 'info',
        category: 'posible-duplicado',
        message: `${label} mantiene el mismo valor en los últimos ${stableSequence} periodos.`,
        suggestion: 'Confirma que el indicador se actualiza periódicamente y descarta duplicaciones de carga.',
        period,
        currentValue,
      });
    }
  }

  return deduplicateFindings(findings).map((item) => ({
    ...item,
    label,
  }));
}

function resolveCategory(indicator, validation, pillar) {
  if (validation?.type === 'boolean') return 'boolean';
  if (validation?.type === 'text') return 'text';
  if (validation?.max === 100 && validation?.min === 0) return 'percentage';
  const normalized = String(indicator ?? '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.category;
    }
  }
  if (pillar === 'governance' && normalized.includes('cumplimiento')) {
    return 'percentage';
  }
  return 'numeric';
}

function ensureTimelineEntry(timeline, period) {
  const key = period ?? 'SIN_PERIODO';
  if (!timeline.has(key)) {
    timeline.set(key, {
      period: period ?? 'SIN_PERIODO',
      environmental: {},
      social: {},
      governance: {},
    });
  }
  return timeline.get(key);
}

function extractMetrics(record) {
  const output = {};
  Object.entries(record).forEach(([key, value]) => {
    if (['id', 'companyId', 'period', 'createdAt'].includes(key)) {
      return;
    }
    output[key] = value;
  });
  return output;
}

function resolveTargetPeriod(timeline, requested) {
  if (requested) {
    ensureTimelineEntry(timeline, requested);
    return requested;
  }
  const ordered = sortTimelineEntries(timeline);
  return ordered.length ? ordered[ordered.length - 1].period : null;
}

function sortTimelineEntries(timeline) {
  return Array.from(timeline.values()).sort((a, b) => buildPeriodSortValue(a.period) - buildPeriodSortValue(b.period));
}

function buildPeriodSortValue(period) {
  if (!period) return Number.NEGATIVE_INFINITY;
  const normalized = String(period).trim().toUpperCase();
  const yearMatch = normalized.match(/(19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : 0;
  let month = 12;
  const monthMatch = normalized.match(/[-/](\d{1,2})/);
  if (monthMatch) {
    month = Math.min(12, Math.max(1, Number(monthMatch[1])));
  } else {
    const quarterMatch = normalized.match(/Q([1-4])/);
    if (quarterMatch) {
      month = Number(quarterMatch[1]) * 3;
    } else {
      const trimMatch = normalized.match(/T([1-4])/);
      if (trimMatch) {
        month = Number(trimMatch[1]) * 3;
      }
    }
  }
  return year * 12 + month;
}

function computeExpectedValue(values) {
  const history = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (history.length === 0) return null;
  if (history.length === 1) return history[0];
  const recent = history.slice(-3);
  const deltas = [];
  for (let index = 1; index < recent.length; index += 1) {
    deltas.push(recent[index] - recent[index - 1]);
  }
  if (!deltas.length) {
    return recent[recent.length - 1];
  }
  const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  return recent[recent.length - 1] + averageDelta;
}

function longestStableSequence(values) {
  let longest = 0;
  let current = 0;
  let lastValue = null;
  values.forEach((value) => {
    if (value == null) {
      current = 0;
      lastValue = null;
      return;
    }
    if (lastValue === value) {
      current += 1;
    } else {
      current = 1;
      lastValue = value;
    }
    if (current > longest) {
      longest = current;
    }
  });
  return longest;
}

function toNumeric(value, category) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (category === 'boolean') {
      if (['true', 'sí', 'si', '1', 'yes'].includes(trimmed.toLowerCase())) return 1;
      if (['false', 'no', '0'].includes(trimmed.toLowerCase())) return 0;
    }
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isNaN(parsed) ? null : parsed;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isBooleanLike(value) {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value === 0 || value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 'false', '1', '0', 'si', 'sí', 'no', 'yes'].includes(normalized);
  }
  return false;
}

function buildIndicatorSeverityIndex(findings) {
  const map = {};
  findings.forEach((finding) => {
    const key = finding.indicator;
    if (!key) return;
    const current = map[key];
    if (!current || SEVERITY_PRIORITY[finding.severity] > SEVERITY_PRIORITY[current]) {
      map[key] = finding.severity;
    }
  });
  return map;
}

function buildSummary({ metricsEvaluated, severityCounts, findingsCount }) {
  const parts = [];
  if (metricsEvaluated) {
    parts.push(`${metricsEvaluated} indicadores evaluados`);
  }
  if (findingsCount) {
    parts.push(`${findingsCount} hallazgos totales`);
  }
  const critical = severityCounts.critical ?? 0;
  const warning = severityCounts.warning ?? 0;
  if (critical) {
    parts.push(`${critical} críticos`);
  }
  if (warning) {
    parts.push(`${warning} advertencias`);
  }
  return parts.length ? parts.join(' · ') : 'Auditoría completada sin hallazgos.';
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function deduplicateFindings(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = `${item.indicator}-${item.category}-${item.period}-${item.comparisonPeriod ?? ''}`;
    const existing = map.get(key);
    if (!existing || SEVERITY_PRIORITY[item.severity] > SEVERITY_PRIORITY[existing.severity]) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

function humanizePillar(pillar) {
  switch (pillar) {
    case 'environmental':
      return 'indicadores ambientales';
    case 'social':
      return 'indicadores sociales';
    case 'governance':
      return 'indicadores de gobernanza';
    default:
      return pillar;
  }
}
