import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import createError from '../utils/createError.js';
import {
  calculateCarbonFootprint,
  getCarbonSnapshotSummary,
  listCarbonFootprintHistory,
  simulateCarbonScenario,
  syncEmissionFactors,
  ensureCarbonSnapshot,
} from '../services/carbonService.js';

async function calculateHandler(req, res) {
  const { companyId: rawCompanyId, period, countryCode = null, scenarios = [] } = req.body ?? {};
  const companyId = resolveCompanyIdFromRequest(req, rawCompanyId ?? req.user?.companyId ?? null);
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para calcular la huella de carbono.');
  }
  const result = await calculateCarbonFootprint({
    companyId,
    period,
    countryCode,
    scenarios: Array.isArray(scenarios) ? scenarios : [],
    persist: true,
  });
  res.status(201).json(result);
}

async function summaryHandler(req, res) {
  const { companyId: rawCompanyId, period, auto } = req.query ?? {};
  const companyId = resolveCompanyIdFromRequest(req, rawCompanyId ?? req.user?.companyId ?? null);
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para consultar la huella de carbono.');
  }
  if (!period) {
    throw createError(400, 'period es obligatorio.');
  }
  const autoGenerate = auto === 'true' || auto === true;
  let snapshot = await getCarbonSnapshotSummary({ companyId, period });
  if (!snapshot && autoGenerate) {
    snapshot = await ensureCarbonSnapshot({ companyId, period, countryCode: req.query?.countryCode ?? null });
  }
  if (!snapshot) {
    res.status(404).json({ message: 'No se encontró un cálculo de huella de carbono para el periodo solicitado.' });
    return;
  }
  res.json(snapshot);
}

async function historyHandler(req, res) {
  const { companyId: rawCompanyId, limit } = req.query ?? {};
  const companyId = resolveCompanyIdFromRequest(req, rawCompanyId ?? req.user?.companyId ?? null);
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para consultar la huella histórica.');
  }
  const items = await listCarbonFootprintHistory({ companyId, limit: limit ? Number(limit) : 12 });
  res.json({ items });
}

async function simulateHandler(req, res) {
  const { companyId: rawCompanyId, period, scenario } = req.body ?? {};
  const companyId = resolveCompanyIdFromRequest(req, rawCompanyId ?? req.user?.companyId ?? null);
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para simular escenarios.');
  }
  const result = await simulateCarbonScenario({ companyId, period, scenario });
  res.json(result);
}

async function syncFactorsHandler(req, res) {
  const { factors = [], year } = req.body ?? {};
  const updated = await syncEmissionFactors({
    factors: Array.isArray(factors) ? factors : [],
    year: year ? Number(year) : undefined,
  });
  res.json({ items: updated });
}

export const calculateCarbon = withControllerErrorHandling(
  calculateHandler,
  'carbonController.calculateCarbon',
);

export const getCarbonSummary = withControllerErrorHandling(
  summaryHandler,
  'carbonController.getCarbonSummary',
);

export const getCarbonHistory = withControllerErrorHandling(
  historyHandler,
  'carbonController.getCarbonHistory',
);

export const simulateCarbon = withControllerErrorHandling(
  simulateHandler,
  'carbonController.simulateCarbon',
);

export const syncEmissionFactorsController = withControllerErrorHandling(
  syncFactorsHandler,
  'carbonController.syncEmissionFactors',
);
