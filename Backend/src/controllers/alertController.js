import createError from '../utils/createError.js';
import { getAlerts, recalculateAlerts } from '../services/earlyWarningService.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { getPlantByIdAndCompany } from '../repositories/plantRepository.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

function resolveCompany(req) {
  const candidate = req.query?.companyId ?? req.user?.companyId ?? null;
  return resolveCompanyIdFromRequest(req, candidate);
}

async function listAlertsHandler(req, res) {
  const companyId = resolveCompany(req);
  const plantParam = req.query?.plantId ?? null;
  let plantId = null;
  if (plantParam !== null && plantParam !== undefined && plantParam !== '') {
    const numericId = Number(plantParam);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
      throw createError(400, 'Identificador de planta inválido');
    }
    const plant = await getPlantByIdAndCompany(numericId, companyId);
    if (!plant) {
      throw createError(404, 'Planta no encontrada para esta empresa');
    }
    plantId = plant.id;
  }

  const alerts = await getAlerts(companyId, plantId);
  res.json(alerts);
}

async function recalculateAlertsHandler(req, res) {
  const companyId = resolveCompany(req);
  const alerts = await recalculateAlerts(companyId);
  res.json({ alerts });
}

export const listAlerts = withControllerErrorHandling(listAlertsHandler, 'alertController.listAlerts');
export const recalculateCompanyAlerts = withControllerErrorHandling(
  recalculateAlertsHandler,
  'alertController.recalculateCompanyAlerts',
);
