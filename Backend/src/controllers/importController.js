import createError from '../utils/createError.js';
import { parseIndicatorFile } from '../utils/importParser.js';
import { validateMetricPayload } from '../validators/metricValidator.js';
import { upsertMetricsByType } from '../repositories/metricRepository.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

async function previewImportHandler(req, res) {
  if (!req.file) {
    throw createError(400, 'Debes adjuntar un archivo CSV o Excel');
  }
  const grouped = parseIndicatorFile(req.file.buffer, req.file.originalname);
  const isAdmin = req.user?.role === 'admin';
  const enforcedCompanyId = isAdmin
    ? req.body?.companyId
      ? resolveCompanyIdFromRequest(req, req.body.companyId)
      : null
    : resolveCompanyIdFromRequest(req, req.body?.companyId ?? req.user?.companyId ?? null);

  const preview = Object.fromEntries(
    Object.entries(grouped).map(([type, records]) => {
      const sanitized = records.map((record) => {
        const { __source, __index, ...rest } = record;
        const payload = {
          ...rest,
          companyId: resolveCompanyIdFromRequest(
            req,
            enforcedCompanyId ?? rest.companyId ?? null,
          ),
        };
        const validated = validateMetricPayload(type, payload);
        return {
          ...validated,
          __source,
          __index,
        };
      });
      return [type, sanitized];
    }),
  );

  const totals = Object.values(preview).reduce((acc, items) => acc + items.length, 0);

  res.json({
    totals,
    preview,
  });
}

async function confirmImportHandler(req, res) {
  const { records } = req.body;
  if (!records || typeof records !== 'object') {
    throw createError(400, 'Debes enviar los registros a importar');
  }
  const isAdmin = req.user?.role === 'admin';
  const enforcedCompanyId = isAdmin
    ? req.body?.companyId
      ? resolveCompanyIdFromRequest(req, req.body.companyId)
      : null
    : resolveCompanyIdFromRequest(req, req.body?.companyId ?? req.user?.companyId ?? null);

  const payloadByType = Object.fromEntries(
    Object.entries(records).map(([type, list]) => {
      const sanitized = (list ?? []).map((record) => {
        const payload = {
          ...record,
          companyId: resolveCompanyIdFromRequest(
            req,
            enforcedCompanyId ?? record.companyId ?? null,
          ),
        };
        return validateMetricPayload(type, payload);
      });
      return [type, sanitized];
    }),
  );

  await upsertMetricsByType(payloadByType);

  res.status(201).json({ message: 'Indicadores importados correctamente' });
}

export const previewImport = withControllerErrorHandling(
  previewImportHandler,
  'importController.previewImport',
);
export const confirmImport = withControllerErrorHandling(
  confirmImportHandler,
  'importController.confirmImport',
);
