import createError from '../utils/createError.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { createInitiative, listInitiativesByCompany } from '../repositories/carbonInitiativeRepository.js';

function parseCost(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw createError(400, 'El costo debe ser un número válido');
  }
  if (numeric < 0) {
    throw createError(400, 'El costo no puede ser negativo');
  }
  return numeric;
}

function parseReduction(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw createError(400, 'La reducción de CO₂ debe ser un número válido');
  }
  if (numeric < 0) {
    throw createError(400, 'La reducción de CO₂ no puede ser negativa');
  }
  return numeric;
}

function computeDerived(initiative) {
  const issues = [];
  const cost = initiative.costUSD;
  const reduction = initiative.co2ReductionTons;
  let costPerTon = null;

  if (cost === null || cost === undefined) {
    issues.push('Costo no registrado');
  }
  if (reduction === null || reduction === undefined) {
    issues.push('Reducción de CO₂ faltante');
  } else if (reduction === 0) {
    issues.push('La reducción de CO₂ debe ser mayor a cero');
  }

  if (cost !== null && cost !== undefined && reduction && reduction > 0) {
    costPerTon = cost / reduction;
  }

  return {
    ...initiative,
    costPerTon,
    issues,
    inconsistent: issues.length > 0,
  };
}

function sortByRoi(initiatives) {
  return [...initiatives].sort((a, b) => {
    const aValid = a.costPerTon !== null && !a.inconsistent;
    const bValid = b.costPerTon !== null && !b.inconsistent;
    if (aValid && bValid) return a.costPerTon - b.costPerTon;
    if (aValid) return -1;
    if (bValid) return 1;
    return (a.costPerTon ?? Number.POSITIVE_INFINITY) - (b.costPerTon ?? Number.POSITIVE_INFINITY);
  });
}

export async function createCarbonInitiative(req) {
  const companyId = resolveCompanyIdFromRequest(req, req.body?.companyId ?? req.query?.companyId ?? null);
  const name = (req.body?.name ?? '').trim();
  if (!name) {
    throw createError(400, 'El nombre de la iniciativa es obligatorio');
  }

  const costUSD = parseCost(req.body?.costUSD);
  const co2ReductionTons = parseReduction(req.body?.co2ReductionTons);
  const description = req.body?.description?.trim() || null;

  const initiative = await createInitiative({ companyId, name, costUSD, co2ReductionTons, description });
  return computeDerived(initiative);
}

export async function listInitiatives(companyId) {
  const initiatives = await listInitiativesByCompany(companyId);
  const withDerived = initiatives.map(computeDerived);
  return sortByRoi(withDerived);
}

export async function getInitiativeRanking(companyId) {
  const initiatives = await listInitiatives(companyId);
  const best = initiatives.find((item) => !item.inconsistent && item.costPerTon !== null) ?? null;
  return { initiatives, best };
}

export async function buildRoiAnnex(companyId) {
  const { best } = await getInitiativeRanking(companyId);
  if (!best) return null;
  const cost = best.costPerTon != null ? best.costPerTon.toFixed(2) : 'N/D';
  return {
    title: 'Recomendación ROI de carbono',
    description: `Iniciativa sugerida: ${best.name} (USD ${cost} por tonelada de CO₂ evitada).`,
  };
}
