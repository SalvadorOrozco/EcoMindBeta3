import { runEsgAudit, listAuditRuns, getAuditSummary } from '../services/esgAuditService.js';
import { runAutoAuditForCompany, listAutoAuditLogs } from '../services/autoAuditService.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

function resolveCompanyId(req) {
  const candidate =
    req.body?.companyId ?? req.query?.companyId ?? req.params?.companyId ?? req.user?.companyId ?? null;
  return resolveCompanyIdFromRequest(req, candidate);
}

async function runAuditHandler(req, res) {
  const companyId = resolveCompanyId(req);
  const { period } = req.body ?? {};
  const triggeredBy = req.user?.email ?? req.user?.name ?? `user-${req.user?.id ?? 'desconocido'}`;
  if (req.query?.mode === 'auto' || req.body?.mode === 'auto') {
    const logs = await runAutoAuditForCompany(companyId);
    res.status(201).json({ mode: 'auto', logs });
    return;
  }

  const result = await runEsgAudit({ companyId, period, triggeredBy });
  res.status(201).json({ mode: 'legacy', ...result });
}

async function listRunsHandler(req, res) {
  const companyId = resolveCompanyId(req);
  const limit = req.query?.limit ? Number(req.query.limit) : 20;
  const runs = await listAuditRuns({ companyId, limit });
  res.json({ runs });
}

async function summaryHandler(req, res) {
  const companyId = resolveCompanyId(req);
  const { period, runId, severity } = req.query ?? {};
  const summary = await getAuditSummary({ companyId, period, runId, severity });
  res.json(summary);
}

export const runAudit = withControllerErrorHandling(runAuditHandler, 'auditController.runAudit');
export const listRuns = withControllerErrorHandling(listRunsHandler, 'auditController.listRuns');
export const getSummary = withControllerErrorHandling(summaryHandler, 'auditController.getSummary');
export const listLogs = withControllerErrorHandling(
  async (req, res) => {
    const companyId = resolveCompanyId(req);
    const plantId = req.query?.plantId ? Number(req.query.plantId) : null;
    const limit = req.query?.limit ? Number(req.query.limit) : 100;
    const logs = await listAutoAuditLogs({ companyId, plantId, limit });
    res.json({ logs });
  },
  'auditController.listLogs',
);
