import createError from '../utils/createError.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';
import { generateRegulatoryForecasts, getRegulatoryForecasts } from '../services/regulatoryForecastService.js';

function resolveCompany(req) {
  const candidate = req.query?.companyId ?? req.body?.companyId ?? req.user?.companyId ?? null;
  return resolveCompanyIdFromRequest(req, candidate);
}

async function listForecastsHandler(req, res) {
  const companyId = resolveCompany(req);
  if (!companyId) {
    throw createError(400, 'companyId es requerido');
  }
  const forecasts = await getRegulatoryForecasts(companyId);
  res.json(forecasts);
}

async function generateForecastsHandler(req, res) {
  const companyId = resolveCompany(req);
  if (!companyId) {
    throw createError(400, 'companyId es requerido');
  }
  const forecasts = await generateRegulatoryForecasts(companyId);
  res.json({ forecasts });
}

export const listRegulatoryForecasts = withControllerErrorHandling(
  listForecastsHandler,
  'regulatoryForecastController.listRegulatoryForecasts',
);

export const generateCompanyRegulations = withControllerErrorHandling(
  generateForecastsHandler,
  'regulatoryForecastController.generateCompanyRegulations',
);
