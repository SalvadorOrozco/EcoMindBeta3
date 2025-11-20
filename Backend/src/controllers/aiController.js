import createError from '../utils/createError.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import {
  analyzeEvidenceFiles,
  integrateInsightsIntoMetrics,
  listInsightsForReport,
  removeInsight,
} from '../services/aiAnalysisService.js';

async function analyzeFilesInternal(req, res) {
  const { companyId, period } = req.body;
  const files = req.files;

  if (!companyId) {
    throw createError(400, 'companyId es obligatorio.');
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw createError(400, 'Debes enviar al menos un archivo para analizar.');
  }

  const resolvedCompanyId = resolveCompanyIdFromRequest(req, companyId);

  const results = await analyzeEvidenceFiles({
    files,
    companyId: resolvedCompanyId,
    period,
  });

  res.status(201).json({
    items: results,
  });
}

async function listInsightsInternal(req, res) {
  const { companyId, period } = req.query;
  if (!companyId) {
    throw createError(400, 'companyId es obligatorio para listar los análisis.');
  }

  const resolvedCompanyId = resolveCompanyIdFromRequest(req, companyId);
  const insights = await listInsightsForReport({
    companyId: resolvedCompanyId,
    period,
  });

  const integration = integrateInsightsIntoMetrics({}, insights);

  res.json({
    items: insights,
    summary: integration.summary,
  });
}

async function deleteInsightInternal(req, res) {
  const { id } = req.params;
  if (!id) {
    throw createError(400, 'Identificador requerido.');
  }

  const { companyId } = req.query ?? {};
  const resolvedCompanyId = companyId ? resolveCompanyIdFromRequest(req, companyId) : undefined;
  await removeInsight(id, resolvedCompanyId);

  res.status(204).send();
}

export const analyzeFiles = withControllerErrorHandling(
  analyzeFilesInternal,
  'aiController.analyzeFiles',
);

export const listInsights = withControllerErrorHandling(
  listInsightsInternal,
  'aiController.listInsights',
);

export const deleteInsight = withControllerErrorHandling(
  deleteInsightInternal,
  'aiController.deleteInsight',
);

