import createError from '../utils/createError.js';
import {
  getEmissionFactors,
  getFallbackEmissionFactors,
  upsertEmissionFactors,
  upsertCarbonSnapshot,
  getSnapshotByPeriod,
  listSnapshots,
} from '../repositories/carbonRepository.js';
import { getMetricsByPeriod } from '../repositories/metricRepository.js';
import { listIngestionItemsForPeriod } from '../repositories/dataIngestionRepository.js';

const DEFAULT_FACTOR_DATA = [
  {
    country: 'Global',
    countryCode: null,
    scope: 'scope1',
    category: 'combustion_estacionaria',
    year: 2024,
    value: 0.074,
    activityUnit: 'GJ',
    source: 'IPCC 2021 default stationary combustion factor',
  },
  {
    country: 'Global',
    countryCode: null,
    scope: 'scope1',
    category: 'flota',
    year: 2024,
    value: 0.00027,
    activityUnit: 'km',
    source: 'GHG Protocol mobile combustion, fleet average',
  },
  {
    country: 'Global',
    countryCode: null,
    scope: 'scope1',
    category: 'fugas_refrigerantes',
    year: 2024,
    value: 1.5,
    activityUnit: 'kg',
    source: 'IPCC refrigerants blended factor',
  },
  {
    country: 'Global',
    countryCode: null,
    scope: 'scope2',
    category: 'electricidad',
    year: 2024,
    value: 0.000355,
    activityUnit: 'kWh',
    source: 'IEA global grid mix 2023',
  },
  {
    country: 'Global',
    countryCode: null,
    scope: 'scope3',
    category: 'logistica',
    year: 2024,
    value: 0.00012,
    activityUnit: 'ton-km',
    source: 'DEFRA UK freight 2023 average',
  },
  {
    country: 'Global',
    countryCode: null,
    scope: 'scope3',
    category: 'residuos',
    year: 2024,
    value: 0.45,
    activityUnit: 't',
    source: 'IPCC landfill mixed waste',
  },
  {
    country: 'Global',
    countryCode: null,
    scope: 'scope3',
    category: 'cadena_valor',
    year: 2024,
    value: 0.0003,
    activityUnit: 'USD',
    source: 'EPA supply-chain spend based average',
  },
  {
    country: 'Uruguay',
    countryCode: 'UY',
    scope: 'scope2',
    category: 'electricidad',
    year: 2024,
    value: 0.000095,
    activityUnit: 'kWh',
    source: 'UTE balance energético 2023',
  },
  {
    country: 'Argentina',
    countryCode: 'AR',
    scope: 'scope2',
    category: 'electricidad',
    year: 2024,
    value: 0.00035,
    activityUnit: 'kWh',
    source: 'CAMMESA 2023 promedio',
  },
  {
    country: 'Brasil',
    countryCode: 'BR',
    scope: 'scope2',
    category: 'electricidad',
    year: 2024,
    value: 0.000092,
    activityUnit: 'kWh',
    source: 'ONS Brasil 2023 promedio',
  },
];

const DEFAULT_SCENARIOS = [
  {
    name: 'Eficiencia energética (-10%)',
    scope: 'scope2',
    category: 'electricidad',
    reductionPercent: 10,
    description: 'Reducir el consumo eléctrico mediante eficiencia operativa y fuentes renovables.',
  },
  {
    name: 'Transporte sostenible (-15%)',
    scope: 'scope3',
    category: 'logistica',
    reductionPercent: 15,
    description: 'Optimizar rutas logísticas y migrar flota a combustibles limpios.',
  },
];

export async function calculateCarbonFootprint({
  companyId,
  period,
  countryCode = null,
  scenarios = [],
  persist = true,
}) {
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para calcular la huella de carbono.');
  }
  if (!period) {
    throw createError(400, 'El periodo es obligatorio para calcular la huella de carbono.');
  }

  const metrics = await getMetricsByPeriod(companyId, period);
  const ingestionItems = await listIngestionItemsForPeriod({ companyId, period });

  if (!metrics?.environmental && ingestionItems.length === 0) {
    throw createError(404, 'No se encontraron indicadores ambientales o datos ingeridos para el periodo especificado.');
  }

  const year = parsePeriodYear(period);
  const factorSet = await loadFactorSet(countryCode, year);
  const factorMap = buildFactorMap(factorSet.factors);

  const { activities, directEmissions, activityMetadata } = extractActivities(metrics, ingestionItems);
  const { breakdown, totals, notes } = computeBreakdown(activities, factorMap, directEmissions);
  const scenarioResults = computeScenarios(totals, breakdown, scenarios);

  const factorsMetadata = {
    countryCode: factorSet.countryCode,
    countryName: factorSet.countryName,
    year: factorSet.year,
    factors: factorSet.factors.map((factor) => ({
      scope: factor.scope,
      category: factor.category,
      value: factor.value,
      unit: factor.activityUnit,
      source: factor.source,
    })),
  };

  const metadata = {
    activities: activityMetadata,
    notes,
    ingestionItems: ingestionItems.length,
  };

  let snapshot;
  if (persist) {
    snapshot = await upsertCarbonSnapshot({
      companyId,
      period,
      scopeTotals: totals,
      breakdown,
      scenarios: scenarioResults,
      factorsMetadata,
      metadata,
    });
  } else {
    snapshot = {
      id: null,
      companyId,
      period,
      scope1: totals.scope1,
      scope2: totals.scope2,
      scope3: totals.scope3,
      total: totals.total,
      factors: factorsMetadata,
      metadata,
      breakdown,
      scenarios: scenarioResults,
    };
  }

  const history = await buildHistoryTimeline(await listSnapshots(companyId, { limit: 24 }));

  return {
    snapshot,
    breakdown: snapshot.breakdown ?? breakdown,
    scenarios: snapshot.scenarios ?? scenarioResults,
    history,
  };
}

export async function getCarbonSnapshotSummary({ companyId, period }) {
  if (!companyId || !period) {
    throw createError(400, 'companyId y period son obligatorios.');
  }
  return getSnapshotByPeriod(companyId, period);
}

export async function listCarbonFootprintHistory({ companyId, limit = 12 }) {
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para consultar la huella histórica.');
  }
  const snapshots = await listSnapshots(companyId, { limit });
  return buildHistoryTimeline(snapshots);
}

export async function ensureCarbonSnapshot({ companyId, period, countryCode = null }) {
  const existing = await getSnapshotByPeriod(companyId, period);
  if (existing) {
    return existing;
  }
  const result = await calculateCarbonFootprint({
    companyId,
    period,
    countryCode,
    scenarios: DEFAULT_SCENARIOS,
    persist: true,
  });
  return result.snapshot;
}

export async function simulateCarbonScenario({ companyId, period, scenario }) {
  if (!scenario) {
    throw createError(400, 'Se requiere un escenario para simular la reducción.');
  }
  const snapshot = await getSnapshotByPeriod(companyId, period);
  if (!snapshot) {
    throw createError(404, 'No existe un cálculo de huella de carbono para el periodo indicado.');
  }
  const totals = {
    scope1: snapshot.scope1,
    scope2: snapshot.scope2,
    scope3: snapshot.scope3,
    total: snapshot.total,
  };
  const projection = projectScenario(totals, snapshot.breakdown ?? [], normalizeScenario(scenario));
  return {
    snapshot,
    scenario: projection,
  };
}

export async function syncEmissionFactors({ factors = [], year = new Date().getFullYear() }) {
  const dataset = factors.length
    ? factors.map((factor) => ({
        ...factor,
        year: factor.year ?? year,
      }))
    : DEFAULT_FACTOR_DATA.map((factor) => ({ ...factor, year }));
  return upsertEmissionFactors(dataset);
}

async function loadFactorSet(countryCode, year) {
  const normalizedCode = countryCode ? countryCode.toUpperCase() : null;
  let factors = await getEmissionFactors({ countryCode: normalizedCode, year });
  let resolvedCode = normalizedCode;
  if (!factors.length && normalizedCode) {
    factors = await getFallbackEmissionFactors({ countryCode: normalizedCode, year });
  }
  if (!factors.length) {
    const globalFactors = await ensureDefaultFactors(year);
    if (globalFactors.length) {
      factors = normalizedCode
        ? await getEmissionFactors({ countryCode: normalizedCode, year })
        : globalFactors;
    }
  }
  if (!factors.length) {
    factors = await ensureDefaultFactors(year);
    resolvedCode = null;
  }
  if (!factors.length) {
    throw createError(500, 'No fue posible resolver factores de emisión para el cálculo.');
  }
  if (!normalizedCode) {
    resolvedCode = null;
  } else if (!factors.some((factor) => (factor.countryCode ?? null) === normalizedCode)) {
    resolvedCode = null;
  }
  return {
    countryCode: resolvedCode,
    countryName: factors[0]?.country ?? (resolvedCode ? resolvedCode : 'Global'),
    year,
    factors,
  };
}

async function ensureDefaultFactors(year) {
  const existing = await getEmissionFactors({ countryCode: null, year });
  if (existing.length) {
    return existing;
  }
  await upsertEmissionFactors(
    DEFAULT_FACTOR_DATA.map((factor) => ({
      ...factor,
      year: factor.year ?? year,
    })),
  );
  return getEmissionFactors({ countryCode: null, year });
}

function buildFactorMap(factors) {
  return factors.reduce((acc, factor) => {
    const scope = factor.scope.toLowerCase();
    if (!acc[scope]) {
      acc[scope] = {};
    }
    acc[scope][factor.category.toLowerCase()] = factor;
    return acc;
  }, {});
}

function extractActivities(metrics, ingestionItems) {
  const environmental = metrics?.environmental ?? {};
  const activities = {
    scope1: {},
    scope2: {},
    scope3: {},
  };

  const directEmissions = {
    scope1: normalizeNumber(environmental.emisionesAlcance1),
    scope2: normalizeNumber(environmental.emisionesAlcance2),
    scope3: normalizeNumber(environmental.emisionesAlcance3),
  };

  const combustion = aggregateActivity({
    ingestionItems,
    keywords: ['combust', 'fuel', 'diesel', 'gas natural', 'caldera'],
    targetUnit: 'GJ',
  });
  if (combustion) {
    activities.scope1.combustion_estacionaria = combustion;
  }

  const fleet = aggregateActivity({
    ingestionItems,
    keywords: ['flota', 'veh', 'km recorr', 'logistica interna'],
    targetUnit: 'km',
  });
  if (fleet) {
    activities.scope1.flota = fleet;
  }

  const leaks = aggregateActivity({
    ingestionItems,
    keywords: ['fuga', 'refriger', 'HFC', 'refrigerante'],
    targetUnit: 'kg',
  });
  if (leaks) {
    activities.scope1.fugas_refrigerantes = leaks;
  }

  const electricity = aggregateActivity({
    ingestionItems,
    keywords: ['electricidad', 'consumo electr', 'kwh'],
    targetUnit: 'kWh',
    fallbackValue: environmental.energiaKwh,
    fallbackUnit: 'kWh',
    fallbackSource: 'IndicadoresAmbientales.EnergiaKwh',
  });
  if (electricity) {
    activities.scope2.electricidad = electricity;
  }

  const logistics = aggregateActivity({
    ingestionItems,
    keywords: ['logistica', 'transporte externo', 'ton-km', 'tkm'],
    targetUnit: 'ton-km',
  });
  if (logistics) {
    activities.scope3.logistica = logistics;
  }

  const waste = aggregateActivity({
    ingestionItems,
    keywords: ['residuo', 'waste'],
    targetUnit: 't',
    fallbackValue: environmental.residuosPeligrososTon,
    fallbackUnit: 't',
    fallbackSource: 'IndicadoresAmbientales.ResiduosPeligrososTon',
  });
  if (waste) {
    activities.scope3.residuos = waste;
  }

  const supplyChain = aggregateActivity({
    ingestionItems,
    keywords: ['cadena de valor', 'proveedor', 'compras sostenibles'],
    targetUnit: 'USD',
  });
  if (supplyChain) {
    activities.scope3.cadena_valor = supplyChain;
  }

  const activityMetadata = {
    scope1: Object.fromEntries(
      Object.entries(activities.scope1).map(([key, value]) => [key, { ...value, activity: round(value.activity, 6) }]),
    ),
    scope2: Object.fromEntries(
      Object.entries(activities.scope2).map(([key, value]) => [key, { ...value, activity: round(value.activity, 6) }]),
    ),
    scope3: Object.fromEntries(
      Object.entries(activities.scope3).map(([key, value]) => [key, { ...value, activity: round(value.activity, 6) }]),
    ),
  };

  return { activities, directEmissions, activityMetadata };
}

function aggregateActivity({
  ingestionItems,
  keywords,
  targetUnit,
  fallbackValue = null,
  fallbackUnit = null,
  fallbackSource = null,
}) {
  if (!Array.isArray(ingestionItems) || ingestionItems.length === 0) {
    if (fallbackValue != null) {
      const normalized = normalizeToUnit(fallbackValue, fallbackUnit ?? targetUnit, targetUnit);
      if (normalized != null) {
        return {
          activity: normalized,
          unit: targetUnit,
          source: fallbackSource ?? 'metricas',
        };
      }
    }
    return null;
  }

  let total = 0;
  let matched = false;
  ingestionItems.forEach((item) => {
    if (!matchesIndicator(item.indicator, keywords)) {
      return;
    }
    const normalized = normalizeToUnit(item.value, item.unit, targetUnit);
    if (normalized != null) {
      total += normalized;
      matched = true;
    }
  });

  if (matched) {
    return {
      activity: total,
      unit: targetUnit,
      source: 'ingestion',
    };
  }

  if (fallbackValue != null) {
    const normalized = normalizeToUnit(fallbackValue, fallbackUnit ?? targetUnit, targetUnit);
    if (normalized != null) {
      return {
        activity: normalized,
        unit: targetUnit,
        source: fallbackSource ?? 'metricas',
      };
    }
  }

  return null;
}

function computeBreakdown(activities, factorMap, directEmissions) {
  const breakdown = [];
  const totals = {
    scope1: 0,
    scope2: 0,
    scope3: 0,
  };
  const notes = [];

  ['scope1', 'scope2', 'scope3'].forEach((scope) => {
    const categories = activities[scope];
    Object.entries(categories).forEach(([category, data]) => {
      const factor = factorMap[scope]?.[category] ?? null;
      if (!factor) {
        breakdown.push({
          scope,
          category,
          activity: round(data.activity, 6),
          unit: data.unit,
          factor: null,
          result: 0,
          source: data.source,
          notes: 'Sin factor de emisión registrado',
        });
        notes.push(`Falta factor de emisión para ${scope}/${category}.`);
        return;
      }
      const normalizedActivity = normalizeToUnit(data.activity, data.unit, factor.activityUnit);
      if (normalizedActivity == null) {
        breakdown.push({
          scope,
          category,
          activity: round(data.activity, 6),
          unit: data.unit,
          factor: factor.value,
          result: 0,
          source: data.source,
          notes: `No se pudo convertir la unidad ${data.unit} a ${factor.activityUnit}.`,
        });
        notes.push(`No se pudo convertir la unidad ${data.unit} para ${scope}/${category}.`);
        return;
      }
      const result = round(normalizedActivity * factor.value, 4);
      totals[scope] += result;
      breakdown.push({
        scope,
        category,
        activity: round(normalizedActivity, 6),
        unit: factor.activityUnit,
        factor: factor.value,
        result,
        source: data.source === 'ingestion' ? 'ingestion' : 'metricas',
        notes: null,
      });
    });
  });

  applyReportedTotals(totals, directEmissions, breakdown);
  totals.scope1 = round(Math.max(totals.scope1, 0), 4);
  totals.scope2 = round(Math.max(totals.scope2, 0), 4);
  totals.scope3 = round(Math.max(totals.scope3, 0), 4);
  totals.total = round(totals.scope1 + totals.scope2 + totals.scope3, 4);

  return { breakdown, totals, notes };
}

function applyReportedTotals(totals, directEmissions, breakdown) {
  ['scope1', 'scope2', 'scope3'].forEach((scope) => {
    const reported = directEmissions[scope];
    if (reported == null) {
      return;
    }
    const delta = round(reported - totals[scope], 4);
    if (Math.abs(delta) < 0.01) {
      return;
    }
    totals[scope] = round(reported, 4);
    breakdown.push({
      scope,
      category: 'ajuste_reportado',
      activity: null,
      unit: 'tCO2e',
      factor: null,
      result: delta,
      source: 'metricas',
      notes: 'Ajuste para alinear con emisiones reportadas.',
    });
  });
}

function computeScenarios(totals, breakdown, requestedScenarios = []) {
  const normalizedRequested = requestedScenarios.map(normalizeScenario);
  const scenarios = normalizedRequested.length ? normalizedRequested : DEFAULT_SCENARIOS;
  return scenarios.map((scenario) => projectScenario(totals, breakdown, scenario));
}

function projectScenario(totals, breakdown, scenario) {
  const scopeKey = scenario.scope === 'all' ? null : scenario.scope;
  const categoryKey = scenario.category === 'all' ? null : scenario.category;
  const matched = breakdown.filter((item) => {
    const scopeMatches = scopeKey ? item.scope === scopeKey : true;
    const categoryMatches = categoryKey ? item.category === categoryKey : true;
    return scopeMatches && categoryMatches;
  });
  const baselineImpact = matched.reduce((acc, curr) => acc + (curr.result ?? 0), 0);
  const reduction = round((baselineImpact * scenario.reductionPercent) / 100, 4);
  let projectedScopeValue;
  if (scopeKey) {
    projectedScopeValue = round(Math.max((totals[scopeKey] ?? 0) - reduction, 0), 4);
  } else {
    const totalReduction = reduction;
    projectedScopeValue = round(Math.max((totals.total ?? 0) - totalReduction, 0), 4);
  }
  return {
    ...scenario,
    baseline: round(scopeKey ? totals[scopeKey] ?? 0 : totals.total ?? 0, 4),
    reduction: reduction,
    projected: projectedScopeValue,
    delta: round(projectedScopeValue - (scopeKey ? totals[scopeKey] ?? 0 : totals.total ?? 0), 4),
  };
}

function normalizeScenario(raw) {
  return {
    name: raw.name ?? 'Escenario personalizado',
    description: raw.description ?? null,
    scope: (raw.scope ?? 'scope1').toLowerCase(),
    category: (raw.category ?? 'all').toLowerCase(),
    reductionPercent: Number(raw.reductionPercent ?? 0),
  };
}

async function buildHistoryTimeline(snapshotsPromise) {
  const snapshots = await snapshotsPromise;
  const sorted = [...snapshots]
    .map((snapshot) => ({
      period: snapshot.period,
      scope1: round(snapshot.scope1 ?? 0, 4),
      scope2: round(snapshot.scope2 ?? 0, 4),
      scope3: round(snapshot.scope3 ?? 0, 4),
      total: round(snapshot.total ?? 0, 4),
    }))
    .sort((a, b) => periodSortValue(a.period) - periodSortValue(b.period));
  let previous = null;
  return sorted.map((entry) => {
    const enriched = { ...entry };
    if (previous) {
      const change = round(entry.total - previous.total, 4);
      enriched.change = change;
      enriched.changePercent = previous.total ? round((change / previous.total) * 100, 2) : null;
    } else {
      enriched.change = null;
      enriched.changePercent = null;
    }
    previous = entry;
    return enriched;
  });
}

function periodSortValue(period) {
  if (!period) return Number.MAX_SAFE_INTEGER;
  const year = parsePeriodYear(period);
  const quarterMatch = /Q(\d)/i.exec(period);
  const quarter = quarterMatch ? Number(quarterMatch[1]) : 0;
  return year * 10 + quarter;
}

function parsePeriodYear(period) {
  if (!period) {
    return new Date().getFullYear();
  }
  const match = /(20\d{2}|19\d{2})/.exec(period);
  if (match) {
    return Number(match[1]);
  }
  return new Date().getFullYear();
}

function matchesIndicator(indicator, keywords = []) {
  if (!indicator) {
    return false;
  }
  const normalized = indicator.toString().toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function normalizeToUnit(value, unit, targetUnit) {
  if (value == null) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (!unit || !targetUnit) {
    return numeric;
  }
  const normalizedUnit = unit.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedTarget = targetUnit.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalizedUnit === normalizedTarget) {
    return numeric;
  }
  // Energy conversions
  if (normalizedTarget === 'kwh') {
    if (normalizedUnit === 'mwh') return numeric * 1000;
    if (normalizedUnit === 'gwh') return numeric * 1_000_000;
    if (normalizedUnit === 'wh') return numeric / 1000;
    if (normalizedUnit === 'gj') return numeric * 277.77778;
    if (normalizedUnit === 'mj') return numeric * 0.27777778;
  }
  if (normalizedTarget === 'gj') {
    if (normalizedUnit === 'kwh') return numeric / 277.77778;
    if (normalizedUnit === 'mwh') return (numeric * 1000) / 277.77778;
  }
  // Mass conversions
  if (normalizedTarget === 't') {
    if (normalizedUnit === 'kg') return numeric / 1000;
    if (normalizedUnit === 'ton' || normalizedUnit === 'tonelada' || normalizedUnit === 'toneladas') return numeric;
  }
  if (normalizedTarget === 'kg') {
    if (normalizedUnit === 't' || normalizedUnit === 'ton' || normalizedUnit === 'tonelada') return numeric * 1000;
  }
  // Distance conversions
  if (normalizedTarget === 'km') {
    if (normalizedUnit === 'mi' || normalizedUnit === 'mile' || normalizedUnit === 'millas') {
      return numeric * 1.60934;
    }
  }
  // Freight conversions (ton-km)
  if (normalizedTarget === 'tonkm') {
    if (normalizedUnit === 'tonkm' || normalizedUnit === 'tkm') {
      return numeric;
    }
    if (normalizedUnit === 'km' && numeric >= 0) {
      return numeric; // se asume previamente ponderado por tonelada
    }
  }
  if (normalizedTarget === 'usd') {
    if (normalizedUnit === 'dolares' || normalizedUnit === 'ars' || normalizedUnit === 'uyu') {
      return numeric;
    }
  }
  return null;
}

function normalizeNumber(value) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value, decimals = 4) {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}
