export function calculateKpis(metricsHistory) {
  const compositeScore = computeComposite(metricsHistory.current);
  const trends = computeTrends(metricsHistory);
  return { compositeScore, ...trends };
}

function computeComposite(current) {
  if (!current) return null;
  const weights = { environmental: 0.4, social: 0.3, governance: 0.3 };
  const scores = ['environmental', 'social', 'governance'].map((key) => {
    const metric = current[key];
    if (!metric) return 0;
    const values = Object.values(metric)
      .filter((value) => typeof value === 'number');
    if (values.length === 0) return 0;
    const avg = values.reduce((acc, curr) => acc + curr, 0) / values.length;
    return Math.min(avg, 100);
  });
  return (
    scores[0] * weights.environmental +
    scores[1] * weights.social +
    scores[2] * weights.governance
  ).toFixed(2);
}

function computeTrends({ current, previous }) {
  const result = {};
  ['environmental', 'social', 'governance'].forEach((key) => {
    const currentScore = averageMetric(current?.[key]);
    const previousScore = averageMetric(previous?.[key]);
    if (currentScore === null || previousScore === null) {
      result[`${key}Trend`] = null;
      return;
    }
    const diff = currentScore - previousScore;
    const trend = diff > 0 ? 'Mejora' : diff < 0 ? 'Retroceso' : 'Estable';
    result[`${key}Trend`] = `${trend} (${diff.toFixed(2)} pts)`;
  });
  return result;
}

function averageMetric(metric) {
  if (!metric) return null;
  const values = Object.values(metric).filter((value) => typeof value === 'number');
  if (!values.length) return null;
  return values.reduce((acc, curr) => acc + curr, 0) / values.length;
}
