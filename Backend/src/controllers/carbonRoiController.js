import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';
import { createCarbonInitiative, getInitiativeRanking, listInitiatives } from '../services/carbonRoiService.js';

async function createInitiativeHandler(req, res) {
  const initiative = await createCarbonInitiative(req);
  res.status(201).json(initiative);
}

async function listInitiativesHandler(req, res) {
  const companyId = resolveCompanyIdFromRequest(req, req.query?.companyId ?? null);
  const initiatives = await listInitiatives(companyId);
  res.json({ initiatives });
}

async function rankingHandler(req, res) {
  const companyId = resolveCompanyIdFromRequest(req, req.query?.companyId ?? null);
  const ranking = await getInitiativeRanking(companyId);
  res.json(ranking);
}

export const createInitiative = withControllerErrorHandling(
  createInitiativeHandler,
  'carbonRoiController.createInitiative',
);

export const listCompanyInitiatives = withControllerErrorHandling(
  listInitiativesHandler,
  'carbonRoiController.listCompanyInitiatives',
);

export const listInitiativesRanking = withControllerErrorHandling(
  rankingHandler,
  'carbonRoiController.listInitiativesRanking',
);
