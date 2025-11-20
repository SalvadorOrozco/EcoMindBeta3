import createError from '../utils/createError.js';
import { createPlant, deletePlant, getPlantById, listPlantsByCompany } from '../repositories/plantRepository.js';
import { validatePlantPayload } from '../validators/plantValidator.js';
import { buildCompanyReport, buildPlantReport } from '../services/plantReportService.js';
import { ensureUserCanAccessCompany, resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { listIndicatorsByPlant } from '../repositories/customIndicatorRepository.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

function resolveCompanyId(req) {
  const candidate = req.query?.companyId ?? req.body?.companyId ?? req.user?.companyId ?? null;
  return resolveCompanyIdFromRequest(req, candidate);
}

async function listPlantsHandler(req, res) {
  const companyId = resolveCompanyId(req);
  const plants = await listPlantsByCompany(companyId);
  res.json(plants);
}

async function createPlantInternal(req, res) {
  const companyId = resolveCompanyId(req);
  const payload = validatePlantPayload(req.body);
  const plant = await createPlant(companyId, payload);
  res.status(201).json(plant);
}

async function deletePlantInternal(req, res) {
  const plantId = Number(req.params.id);
  if (!Number.isSafeInteger(plantId) || plantId <= 0) {
    throw createError(400, 'Identificador de planta inválido');
  }
  const plant = await getPlantById(plantId);
  if (!plant) {
    throw createError(404, 'Planta no encontrada');
  }
  const companyId = ensureUserCanAccessCompany(req, plant.companyId);

  const indicators = await listIndicatorsByPlant(companyId, plantId);
  if (indicators.length > 0) {
    throw createError(
      409,
      'No es posible eliminar la planta porque existen indicadores asociados. Elimina los indicadores primero.',
    );
  }

  const deleted = await deletePlant(companyId, plantId);
  if (!deleted) {
    throw createError(404, 'Planta no encontrada');
  }
  res.status(204).send();
}

async function getPlantReportInternal(req, res) {
  const plantId = Number(req.params.id);
  if (!Number.isSafeInteger(plantId) || plantId <= 0) {
    throw createError(400, 'Identificador de planta inválido');
  }
  const companyId = resolveCompanyId(req);
  const report = await buildPlantReport(companyId, plantId);
  if (!report) {
    throw createError(404, 'Planta no encontrada');
  }
  res.json(report);
}

async function getCompanyReportInternal(req, res) {
  const candidate = req.query?.companyId ?? req.user?.companyId ?? null;
  const companyId = resolveCompanyIdFromRequest(req, candidate);
  const report = await buildCompanyReport(companyId);
  res.json(report);
}

export const listPlants = withControllerErrorHandling(
  listPlantsHandler,
  'plantController.listPlants',
);
export const createPlantHandler = withControllerErrorHandling(
  createPlantInternal,
  'plantController.createPlant',
);
export const deletePlantHandler = withControllerErrorHandling(
  deletePlantInternal,
  'plantController.deletePlant',
);
export const getPlantReportHandler = withControllerErrorHandling(
  getPlantReportInternal,
  'plantController.getPlantReport',
);
export const getCompanyReportHandler = withControllerErrorHandling(
  getCompanyReportInternal,
  'plantController.getCompanyReport',
);
