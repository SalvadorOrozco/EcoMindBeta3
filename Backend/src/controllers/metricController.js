import {
  getHistoricalSummary,
  getMetric,
  getMetricsByPeriod,
  getMetricsForCompany,
  upsertMetric,
} from '../repositories/metricRepository.js';
import { validateMetricPayload } from '../validators/metricValidator.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

function buildUpsertHandler(type, label) {
  return withControllerErrorHandling(async (req, res) => {
    const candidateCompanyId =
      req.body?.companyId ?? req.query?.companyId ?? req.user?.companyId ?? null;
    const companyId = resolveCompanyIdFromRequest(req, candidateCompanyId);
    const payload = validateMetricPayload(type, {
      ...req.body,
      companyId,
    });
    const inserted = await upsertMetric(type, payload);
    res.status(201).json({ id: inserted.Id });
  }, label);
}

export const upsertEnvironmental = buildUpsertHandler(
  'environmental',
  'metricController.upsertEnvironmental',
);
export const upsertSocial = buildUpsertHandler('social', 'metricController.upsertSocial');
export const upsertGovernance = buildUpsertHandler(
  'governance',
  'metricController.upsertGovernance',
);

async function getMetricsForPeriodHandler(req, res) {
  const { empresaId, periodo } = req.params;
  const companyId = resolveCompanyIdFromRequest(req, empresaId);
  const metrics = await getMetricsByPeriod(companyId, periodo);
  res.json(metrics);
}

async function getMetricByTypeHandler(req, res) {
  const { empresaId, periodo, type } = req.params;
  const companyId = resolveCompanyIdFromRequest(req, empresaId);
  const metric = await getMetric(type, companyId, periodo);
  if (!metric) {
    res.status(404).json({ message: 'Indicador no encontrado' });
    return;
  }
  res.json(metric);
}

async function listMetricsByTypeHandler(req, res) {
  const { empresaId, type } = req.params;
  const companyId = resolveCompanyIdFromRequest(req, empresaId);
  const metrics = await getMetricsForCompany(type, companyId);
  res.json(metrics);
}

async function getHistoricalIndicatorsHandler(req, res) {
  const candidate = req.params.empresaId ?? req.query.companyId ?? null;
  const companyId = resolveCompanyIdFromRequest(req, candidate);
  const items = await getHistoricalSummary(companyId);
  res.json(items);
}

export const getMetricsForPeriod = withControllerErrorHandling(
  getMetricsForPeriodHandler,
  'metricController.getMetricsForPeriod',
);
export const getMetricByType = withControllerErrorHandling(
  getMetricByTypeHandler,
  'metricController.getMetricByType',
);
export const listMetricsByType = withControllerErrorHandling(
  listMetricsByTypeHandler,
  'metricController.listMetricsByType',
);
export const getHistoricalIndicators = withControllerErrorHandling(
  getHistoricalIndicatorsHandler,
  'metricController.getHistoricalIndicators',
);
