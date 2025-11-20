import createError from '../utils/createError.js';
import {
  createCustomIndicator,
  deleteCustomIndicator,
  getCustomIndicatorById,
  listCustomIndicators,
  listIndicatorsByPlant,
} from '../repositories/customIndicatorRepository.js';
import { getMarkerByCompanyId } from '../repositories/mapRepository.js';
import { recalculateCompanyScore } from '../services/esgScoreService.js';
import { validateIndicatorPayload } from '../validators/customIndicatorValidator.js';
import { ensureUserCanAccessCompany, resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { getPlantByIdAndCompany } from '../repositories/plantRepository.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

function resolveCompanyId(req) {
  const candidate =
    req.query?.companyId ??
    req.body?.companyId ??
    req.user?.companyId ??
    null;
  return resolveCompanyIdFromRequest(req, candidate);
}

async function listIndicatorsHandler(req, res) {
  const companyId = resolveCompanyId(req);
  const requestedPlantId = req.query?.plantId ? Number(req.query.plantId) : null;
  let plantId = null;
  if (requestedPlantId) {
    if (!Number.isSafeInteger(requestedPlantId) || requestedPlantId <= 0) {
      throw createError(400, 'Identificador de planta inválido');
    }
    const plant = await getPlantByIdAndCompany(requestedPlantId, companyId);
    if (!plant) {
      throw createError(404, 'Planta no encontrada');
    }
    plantId = plant.id;
  }

  const [items, marker] = await Promise.all([
    plantId ? listIndicatorsByPlant(companyId, plantId) : listCustomIndicators(companyId),
    getMarkerByCompanyId(companyId),
  ]);
  res.json({ items, esgScore: marker?.esgScore ?? null });
}

async function createIndicatorHandler(req, res) {
  const companyId = resolveCompanyId(req);
  const payload = validateIndicatorPayload(req.body);
  if (payload.plantId != null) {
    const plant = await getPlantByIdAndCompany(payload.plantId, companyId);
    if (!plant) {
      throw createError(404, 'La planta seleccionada no existe');
    }
  }

  const indicator = await createCustomIndicator(companyId, payload);
  const esgScore = await recalculateCompanyScore(companyId);
  res.status(201).json({ indicator, esgScore });
}

async function deleteIndicatorHandler(req, res) {
  const companyId = resolveCompanyId(req);
  const indicatorId = Number(req.params.indicatorId);
  if (!indicatorId) {
    throw createError(400, 'Identificador de indicador inválido');
  }

  const indicator = await getCustomIndicatorById(indicatorId);
  if (!indicator) {
    throw createError(404, 'Indicador no encontrado');
  }

  const scopedCompanyId = ensureUserCanAccessCompany(req, indicator.companyId);
  if (scopedCompanyId !== companyId) {
    throw createError(404, 'Indicador no encontrado');
  }

  await deleteCustomIndicator(companyId, indicatorId);
  const esgScore = await recalculateCompanyScore(companyId);
  res.json({ success: true, esgScore });
}

export const listIndicators = withControllerErrorHandling(
  listIndicatorsHandler,
  'indicatorController.listIndicators',
);
export const createIndicator = withControllerErrorHandling(
  createIndicatorHandler,
  'indicatorController.createIndicator',
);
export const deleteIndicator = withControllerErrorHandling(
  deleteIndicatorHandler,
  'indicatorController.deleteIndicator',
);
