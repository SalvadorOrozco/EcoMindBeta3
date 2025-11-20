import regulations from '../config/global_regulations.json' assert { type: 'json' };
import createError from '../utils/createError.js';
import { runGeminiPrompt } from './aiService.js';
import { getCompanyById } from '../repositories/companyRepository.js';
import { COLUMNS, METRIC_TYPES, getMetricsForCompany } from '../repositories/metricRepository.js';
import { listForecasts, replaceForecasts } from '../repositories/regulatoryForecastRepository.js';

function normalizeCategory(value) {
  const upper = (value ?? '').toString().trim().toUpperCase();
  return ['E', 'S', 'G'].includes(upper) ? upper : 'E';
}

function normalizeImpact(value) {
  const lower = (value ?? '').toString().trim().toLowerCase();
  if (['low', 'medium', 'high'].includes(lower)) {
    return lower;
  }
  return 'medium';
}

function clampProbability(probability) {
  const num = Number(probability);
  if (Number.isFinite(num)) {
    return Math.min(1, Math.max(0, num));
  }
  return 0.5;
}

function wrapForecastText(years, text) {
  const label = years === 1 ? '1 año' : `${years} años`;
  return `[${label}] ${text}`.trim();
}

function extractHorizonFromText(text) {
  const match = text?.match(/^\[(\d+)\s*a[ñn]o[s]?\]\s*(.*)$/i);
  if (match) {
    return { years: Number(match[1]), text: match[2] };
  }
  return { years: null, text: text ?? '' };
}

async function getLatestMetrics(companyId) {
  const summary = {};
  for (const type of METRIC_TYPES) {
    const metrics = await getMetricsForCompany(type, companyId);
    if (!metrics?.length) continue;
    const latest = metrics[0];
    const allowedColumns = COLUMNS[type];
    const values = {};
    allowedColumns.forEach((column) => {
      const key = column.charAt(0).toLowerCase() + column.slice(1);
      if (latest[key] !== undefined && latest[key] !== null) {
        values[key] = latest[key];
      }
    });
    summary[type] = {
      period: latest.period,
      values,
    };
  }
  return summary;
}

function buildPrompt(company, metricsSummary, trends) {
  const lines = [
    'Actúa como analista legal ESG. Necesito pronósticos regulatorios en español claro.',
    `Empresa: ${company.name}. Rubro: ${company.industry ?? 'N/D'}. Ubicación: ${company.address ?? 'N/D'}.`,
    '',
    'Indicadores ESG más recientes por pilar:',
    JSON.stringify(metricsSummary, null, 2),
    '',
    'Tendencias regulatorias globales y regionales conocidas:',
    JSON.stringify(trends, null, 2),
    '',
    'Entrega un JSON con este formato:',
    '{ "forecasts": [ { "category": "E|S|G", "region": "global|local", "horizons": [ { "years": 1, "forecast": "texto", "probability": 0.7, "impact": "low|medium|high" }, ... ] } ] }',
    'Incluye siempre horizontes de 1, 2 y 3 años. Usa probabilidad entre 0 y 1.',
  ];
  return lines.join('\n');
}

function parseGeminiJson(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const jsonString = fenced ? fenced[1] : text;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

function normalizeAiForecasts(payload, companyId) {
  const forecasts = payload?.forecasts ?? payload?.predicciones ?? [];
  const entries = [];

  for (const forecast of forecasts) {
    const category = normalizeCategory(forecast.category);
    const region = forecast.region ?? 'global';
    const horizons = Array.isArray(forecast.horizons)
      ? forecast.horizons
      : forecast.timeline ?? [];

    for (const horizon of horizons) {
      const years = Number(horizon.years ?? horizon.year ?? 1);
      const text = horizon.forecast ?? horizon.text ?? horizon.description;
      if (!text) continue;
      entries.push({
        companyId,
        category,
        region,
        forecastText: wrapForecastText(years || 1, text),
        probability: clampProbability(horizon.probability ?? horizon.probabilidad ?? forecast.probability),
        impactLevel: normalizeImpact(horizon.impact ?? horizon.severity ?? forecast.impactLevel ?? forecast.impact),
      });
    }
  }

  return entries;
}

function buildFallbackForecasts(companyId, metricsSummary) {
  const entries = [];
  const now = new Date();
  const yearLabel = now.getFullYear();
  const byCategory = ['E', 'S', 'G'];

  const metricHints = {
    E: metricsSummary.environmental ?? {},
    S: metricsSummary.social ?? {},
    G: metricsSummary.governance ?? {},
  };

  for (const category of byCategory) {
    const relatedTrends = regulations.filter((trend) => trend.category === category);
    const primary = relatedTrends[0];
    const topic = primary?.topic ?? 'Nuevas obligaciones ESG';
    const trendText = primary?.trend ?? 'Mayor fiscalización y transparencia en ESG';
    const region = primary?.region ?? 'global';

    for (const years of [1, 2, 3]) {
      const emphasis = years === 1 ? 'corto plazo' : years === 2 ? 'mediano plazo' : 'largo plazo';
      const hintValues = metricHints[category]?.values ?? {};
      const hintKeys = Object.keys(hintValues).slice(0, 2);
      const metricHint = hintKeys.length
        ? `Basado en indicadores: ${hintKeys.map((key) => `${key}=${hintValues[key]}`).join(', ')}.`
        : 'Basado en los indicadores disponibles.';
      const text = `${trendText} (${emphasis}). ${metricHint}`;
      const impactLevel = primary?.impact ?? (years >= 3 ? 'high' : 'medium');
      const baseProbability = impactLevel === 'high' ? 0.72 : impactLevel === 'medium' ? 0.55 : 0.35;
      const probability = clampProbability(baseProbability + years * 0.05);

      entries.push({
        companyId,
        category,
        region,
        forecastText: wrapForecastText(years, `${topic}: ${text} Año base ${yearLabel}.`),
        probability,
        impactLevel: normalizeImpact(impactLevel),
      });
    }
  }

  return entries;
}

function decodeForecastDisplay(forecast) {
  const { years, text } = extractHorizonFromText(forecast.forecastText);
  return {
    ...forecast,
    horizonYears: years,
    forecastText: text,
  };
}

export async function generateRegulatoryForecasts(companyId) {
  const company = await getCompanyById(companyId);
  if (!company) {
    throw createError(404, 'Empresa no encontrada');
  }
  const metricsSummary = await getLatestMetrics(companyId);
  const prompt = buildPrompt(company, metricsSummary, regulations);

  let generated = [];
  try {
    const aiText = await runGeminiPrompt(prompt);
    const payload = parseGeminiJson(aiText);
    generated = normalizeAiForecasts(payload, companyId);
  } catch (error) {
    console.error('[RegulatoryForecast] Error al invocar Gemini:', error.message ?? error);
  }

  if (!generated.length) {
    generated = buildFallbackForecasts(companyId, metricsSummary);
  }

  const stored = await replaceForecasts(companyId, generated);
  return stored.map(decodeForecastDisplay);
}

export async function getRegulatoryForecasts(companyId) {
  const forecasts = await listForecasts(companyId);
  return forecasts.map(decodeForecastDisplay);
}
