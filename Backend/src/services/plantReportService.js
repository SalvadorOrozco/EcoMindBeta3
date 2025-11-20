import { listIndicatorsByPlant, listIndicatorsGroupedByPlant } from '../repositories/customIndicatorRepository.js';
import { getPlantByIdAndCompany, listPlantsByCompany } from '../repositories/plantRepository.js';

function summarizeIndicators(indicators) {
  const categories = {
    environmental: { total: 0, count: 0 },
    social: { total: 0, count: 0 },
    governance: { total: 0, count: 0 },
  };

  indicators.forEach((indicator) => {
    if (typeof indicator.value !== 'number') {
      return;
    }
    const category = categories[indicator.category];
    if (!category) {
      return;
    }
    category.total += indicator.value;
    category.count += 1;
  });

  const categorySummaries = Object.entries(categories).reduce((acc, [key, value]) => {
    acc[key] = {
      total: Number(value.total.toFixed(2)),
      count: value.count,
      average: value.count > 0 ? Number((value.total / value.count).toFixed(2)) : null,
    };
    return acc;
  }, {});

  const overallTotal = Object.values(categories).reduce((acc, value) => acc + value.total, 0);
  const overallCount = Object.values(categories).reduce((acc, value) => acc + value.count, 0);

  return {
    categories: categorySummaries,
    overall: {
      total: Number(overallTotal.toFixed(2)),
      count: overallCount,
      average: overallCount > 0 ? Number((overallTotal / overallCount).toFixed(2)) : null,
    },
    esgScore: overallCount > 0 ? Number((overallTotal / overallCount).toFixed(2)) : null,
  };
}

export async function buildPlantReport(companyId, plantId) {
  const plant = await getPlantByIdAndCompany(plantId, companyId);
  if (!plant) {
    return null;
  }
  const indicators = await listIndicatorsByPlant(companyId, plantId);
  const summary = summarizeIndicators(indicators);
  return {
    plant,
    indicators,
    summary,
  };
}

export async function buildCompanyReport(companyId) {
  const [plants, indicators] = await Promise.all([
    listPlantsByCompany(companyId),
    listIndicatorsGroupedByPlant(companyId),
  ]);

  const grouped = new Map();
  plants.forEach((plant) => {
    grouped.set(plant.id, []);
  });

  indicators.forEach((indicator) => {
    if (!grouped.has(indicator.plantId)) {
      grouped.set(indicator.plantId, []);
    }
    grouped.get(indicator.plantId).push(indicator);
  });

  const plantReports = plants.map((plant) => {
    const plantIndicators = grouped.get(plant.id) ?? [];
    return {
      plant,
      summary: summarizeIndicators(plantIndicators),
      indicators: plantIndicators,
    };
  });

  const allIndicators = Array.from(grouped.values()).flat();
  const summary = summarizeIndicators(allIndicators);

  return {
    companyId,
    plants: plantReports,
    summary,
  };
}
