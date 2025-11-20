import createError from '../utils/createError.js';
import {
  createEvidenceRecord,
  deleteEvidence,
  getEvidenceById,
  listEvidence,
} from '../repositories/evidenceRepository.js';
import { saveEvidenceFile, deleteEvidenceFile } from '../services/storageService.js';
import { ensureUserCanAccessCompany, resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

async function uploadEvidenceHandler(req, res) {
  const { companyId, period, type, indicator } = req.body;
  const normalizedCompanyId = resolveCompanyIdFromRequest(
    req,
    companyId ?? req.user?.companyId ?? null,
  );
  if (!period) {
    throw createError(400, 'period es obligatorio');
  }
  if (!type) {
    throw createError(400, 'type es obligatorio');
  }
  if (!req.file) {
    throw createError(400, 'Debes adjuntar un archivo de evidencia');
  }

  const storage = await saveEvidenceFile(req.file, {
    companyId: normalizedCompanyId,
    period,
    type,
  });

  const record = await createEvidenceRecord({
    companyId: normalizedCompanyId,
    period,
    type,
    indicator: indicator ?? null,
    fileName: storage.fileName,
    storagePath: storage.storagePath,
    provider: storage.provider,
    publicUrl: storage.publicUrl,
    metadata: { mimetype: req.file.mimetype, size: req.file.size },
  });

  res.status(201).json(record);
}

async function listEvidenceInternal(req, res) {
  const companyId = resolveCompanyIdFromRequest(
    req,
    req.query.companyId ?? req.user?.companyId ?? null,
  );
  const period = req.query.period ?? null;
  const type = req.query.type ?? null;
  const items = await listEvidence({ companyId, period, type });
  res.json(items);
}

async function removeEvidenceInternal(req, res) {
  const id = Number(req.params.id);
  if (!id) {
    throw createError(400, 'Id inválido');
  }
  const record = await getEvidenceById(id);
  if (!record) {
    throw createError(404, 'Evidencia no encontrada');
  }
  ensureUserCanAccessCompany(req, record.companyId);
  await deleteEvidenceFile({
    ruta: record.storagePath,
    proveedor: record.provider,
  });
  await deleteEvidence(id);
  res.status(204).end();
}

async function downloadEvidenceInternal(req, res) {
  const id = Number(req.params.id);
  if (!id) {
    throw createError(400, 'Id inválido');
  }
  const record = await getEvidenceById(id);
  if (!record) {
    throw createError(404, 'Evidencia no encontrada');
  }
  ensureUserCanAccessCompany(req, record.companyId);
  if (record.provider !== 'local') {
    res.json({ url: record.publicUrl });
    return;
  }
  res.redirect(record.publicUrl ?? '/');
}

export const uploadEvidence = withControllerErrorHandling(
  uploadEvidenceHandler,
  'evidenceController.uploadEvidence',
);
export const listEvidenceHandler = withControllerErrorHandling(
  listEvidenceInternal,
  'evidenceController.listEvidence',
);
export const removeEvidence = withControllerErrorHandling(
  removeEvidenceInternal,
  'evidenceController.removeEvidence',
);
export const downloadEvidence = withControllerErrorHandling(
  downloadEvidenceInternal,
  'evidenceController.downloadEvidence',
);
