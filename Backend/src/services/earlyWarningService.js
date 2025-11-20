import thresholds from '../config/thresholds.json' with { type: 'json' };
import { getPool } from '../config/db.js';
import { COLUMNS, TABLES } from '../repositories/metricRepository.js';
import { listCustomIndicators } from '../repositories/customIndicatorRepository.js';
import { replaceAlerts, listAlerts } from '../repositories/alertRepository.js';

function columnToKey(column) {
  return column.charAt(0).toLowerCase() + column.slice(1);
}

function getThreshold(indicatorKey) {
  return thresholds[indicatorKey] ?? thresholds.default ?? { warningMargin: 0.1 };
}

function linearRegressionPredict(values, steps = 3) {
  const n = values.length;
  const xs = values.map((_, idx) => idx);
  const meanX = xs.reduce((acc, curr) => acc + curr, 0) / n;
  const meanY = values.reduce((acc, curr) => acc + curr, 0) / n;
  const numerator = values.reduce((acc, y, idx) => acc + (xs[idx] - meanX) * (y - meanY), 0);
  const denominator = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0) || 1;
  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;
  const startIndex = n;
  return Array.from({ length: steps }, (_, step) => intercept + slope * (startIndex + step));
}

function movingAveragePredict(values, steps = 3) {
  const avg = values.reduce((acc, curr) => acc + curr, 0) / values.length;
  return Array.from({ length: steps }, () => avg);
}

function deviationPredict(values, steps = 3) {
  const avg = values[0] ?? 0;
  return Array.from({ length: steps }, () => avg);
}

function predictSeries(values) {
  if (values.length >= 3) {
    return linearRegressionPredict(values);
  }
  if (values.length === 2) {
    return movingAveragePredict(values);
  }
  return deviationPredict(values);
}

function resolveRiskLevel(predictions, threshold) {
  const { upperCritical = null, lowerCritical = null, warningMargin = 0.1 } = threshold ?? {};
  let riskLevel = 'low';
  let selectedPrediction = predictions[0] ?? null;

  for (const prediction of predictions) {
    const above = upperCritical != null && prediction > upperCritical;
    const below = lowerCritical != null && prediction < lowerCritical;
    if (above || below) {
      riskLevel = 'high';
      selectedPrediction = prediction;
      break;
    }

    const nearUpper =
      upperCritical != null && prediction > upperCritical * (1 - warningMargin) && prediction <= upperCritical;
    const nearLower =
      lowerCritical != null && prediction < lowerCritical * (1 + warningMargin) && prediction >= lowerCritical;

    if ((nearUpper || nearLower) && riskLevel === 'low') {
      riskLevel = 'medium';
      selectedPrediction = prediction;
    }
  }

  return { riskLevel, predictedValue: selectedPrediction };
}

function buildAlertMessage(indicatorKey, threshold, predictedValue) {
  const { upperCritical = null, lowerCritical = null } = threshold ?? {};
  const roundedPrediction = predictedValue != null ? Number(predictedValue.toFixed(2)) : null;
  if (upperCritical != null && roundedPrediction != null && roundedPrediction > upperCritical) {
    return `Proyección de ${indicatorKey} supera el umbral crítico (${upperCritical}).`;
  }
  if (lowerCritical != null && roundedPrediction != null && roundedPrediction < lowerCritical) {
    return `Proyección de ${indicatorKey} cae por debajo del umbral crítico (${lowerCritical}).`;
  }
  return `Proyección de ${indicatorKey} se acerca a su umbral definido.`;
}

function groupIndicators(points) {
  const groups = new Map();
  for (const point of points) {
    const key = `${point.indicatorKey}::${point.plantId ?? 'corporate'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(point);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => {
      const periodA = a.period ?? '';
      const periodB = b.period ?? '';
      if (periodA === periodB) {
        return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
      }
      return periodA.localeCompare(periodB);
    });
  }
  return groups;
}

async function fetchMetricPoints(companyId) {
  const pool = await getPool();
  const points = [];

  for (const [type, table] of Object.entries(TABLES)) {
    const columns = COLUMNS[type];
    const result = await pool
      .request()
      .input('EmpresaID', companyId)
      .query(`
        SELECT Periodo, ${columns.join(', ')}
        FROM ${table}
        WHERE EmpresaID = @EmpresaID
        ORDER BY Periodo ASC
      `);

    result.recordset.forEach((row) => {
      columns.forEach((column) => {
        const value = row[column];
        if (value === null || value === undefined) return;
        points.push({
          indicatorKey: columnToKey(column),
          plantId: null,
          period: row.Periodo ?? null,
          createdAt: null,
          value: Number(value),
        });
      });
    });
  }

  return points;
}

async function fetchCustomIndicatorPoints(companyId) {
  const indicators = await listCustomIndicators(companyId);
  return indicators
    .filter((indicator) => typeof indicator.value === 'number')
    .map((indicator) => ({
      indicatorKey: indicator.name,
      plantId: indicator.plantId ?? null,
      period: indicator.period ?? null,
      createdAt: indicator.createdAt ?? null,
      value: Number(indicator.value),
    }));
}

function evaluateGroup(indicatorKey, plantId, points) {
  const values = points.map((point) => point.value);
  if (!values.length) return null;
  const threshold = getThreshold(indicatorKey);
  const predictions = predictSeries(values);
  const { riskLevel, predictedValue } = resolveRiskLevel(predictions, threshold);
  if (riskLevel === 'low') return null;
  const currentValue = values[values.length - 1];
  const message = buildAlertMessage(indicatorKey, threshold, predictedValue);
  return {
    indicatorKey,
    plantId,
    currentValue,
    predictedValue,
    riskLevel,
    message,
  };
}

export async function recalculateAlerts(companyId) {
  const [metricPoints, customPoints] = await Promise.all([
    fetchMetricPoints(companyId),
    fetchCustomIndicatorPoints(companyId),
  ]);
  const points = [...metricPoints, ...customPoints];
  const grouped = groupIndicators(points);
  const alerts = [];

  for (const [groupKey, groupPoints] of grouped.entries()) {
    const [indicatorKey, plantMarker] = groupKey.split('::');
    const plantId = plantMarker === 'corporate' ? null : Number(plantMarker);
    const evaluation = evaluateGroup(indicatorKey, plantId, groupPoints);
    if (evaluation) {
      alerts.push({ companyId, ...evaluation });
    }
  }

  const stored = await replaceAlerts(companyId, alerts);
  return stored;
}

export async function getAlerts(companyId, plantId = null) {
  return listAlerts(companyId, plantId ?? null);
}
