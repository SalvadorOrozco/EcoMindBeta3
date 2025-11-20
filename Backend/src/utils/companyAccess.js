import createError from './createError.js';

function normalizeCompanyId(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createError(400, 'Identificador de empresa inválido');
  }
  return parsed;
}

function isAdmin(req) {
  return req.user?.role === 'admin';
}

export function ensureUserCanAccessCompany(req, companyId) {
  const normalized = normalizeCompanyId(companyId);
  if (isAdmin(req)) {
    return normalized;
  }

  const userCompanyId = req.user?.companyId ?? null;
  if (!userCompanyId) {
    throw createError(403, 'Tu cuenta no está asociada a ninguna empresa. Solicita acceso al administrador.');
  }

  if (userCompanyId !== normalized) {
    throw createError(403, 'No tienes permisos para operar sobre esta empresa');
  }

  return normalized;
}

export function resolveCompanyIdFromRequest(req, candidate) {
  if (candidate === undefined || candidate === null || candidate === '') {
    const fallback = req.user?.companyId ?? null;
    if (fallback) {
      return ensureUserCanAccessCompany(req, fallback);
    }

    if (isAdmin(req)) {
      throw createError(400, 'Debes indicar la empresa objetivo');
    }

    throw createError(403, 'Tu cuenta no está asociada a ninguna empresa. Solicita acceso al administrador.');
  }

  return ensureUserCanAccessCompany(req, candidate);
}
