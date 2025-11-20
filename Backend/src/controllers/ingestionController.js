import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import createError from '../utils/createError.js';
import {
  runDataIngestion,
  listDataIngestionRuns,
  listDataIngestionAlerts,
  resolveDataIngestionAlert,
} from '../services/dataIngestionService.js';

async function runIngestionInternal(req, res) {
  const { companyId: rawCompanyId, period } = req.body;
  const resolvedCompanyId = resolveCompanyIdFromRequest(
    req,
    rawCompanyId ?? req.user?.companyId ?? null,
  );
  if (!resolvedCompanyId) {
    throw createError(400, 'companyId es obligatorio para ejecutar la ingesta.');
  }

  const options = parseOptions(req.body?.options ?? req.body?.config ?? null);
  const files = req.files ?? [];

  const result = await runDataIngestion({
    companyId: resolvedCompanyId,
    period: period ?? null,
    files,
    emailConfig: options.email ?? null,
    apiSources: options.apis ?? [],
  });

  res.status(202).json(result);
}

async function listRunsInternal(req, res) {
  const { companyId: rawCompanyId, limit } = req.query;
  const resolvedCompanyId = resolveCompanyIdFromRequest(
    req,
    rawCompanyId ?? req.user?.companyId ?? null,
  );
  const runs = await listDataIngestionRuns({
    companyId: resolvedCompanyId,
    limit: limit ? Number(limit) : 20,
  });
  res.json({ items: runs });
}

async function listAlertsInternal(req, res) {
  const { companyId: rawCompanyId, unresolved, limit } = req.query;
  const resolvedCompanyId = resolveCompanyIdFromRequest(
    req,
    rawCompanyId ?? req.user?.companyId ?? null,
  );
  const alerts = await listDataIngestionAlerts({
    companyId: resolvedCompanyId,
    unresolvedOnly: unresolved === 'true',
    limit: limit ? Number(limit) : 50,
  });
  res.json({ items: alerts });
}

async function resolveAlertInternal(req, res) {
  const { id } = req.params;
  const resolved = await resolveDataIngestionAlert(id);
  if (!resolved) {
    throw createError(404, 'Alerta no encontrada.');
  }
  res.json(resolved);
}

function parseOptions(raw) {
  if (!raw) {
    return { email: null, apis: [] };
  }
  if (typeof raw === 'object') {
    return {
      email: raw.email ?? null,
      apis: Array.isArray(raw.apis) ? raw.apis : [],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      email: parsed?.email ?? null,
      apis: Array.isArray(parsed?.apis) ? parsed.apis : [],
    };
  } catch (error) {
    return { email: null, apis: [] };
  }
}

export const runIngestion = withControllerErrorHandling(
  runIngestionInternal,
  'ingestionController.runIngestion',
);

export const listIngestionRuns = withControllerErrorHandling(
  listRunsInternal,
  'ingestionController.listRuns',
);

export const listIngestionAlerts = withControllerErrorHandling(
  listAlertsInternal,
  'ingestionController.listAlerts',
);

export const resolveIngestionAlert = withControllerErrorHandling(
  resolveAlertInternal,
  'ingestionController.resolveAlert',
);
