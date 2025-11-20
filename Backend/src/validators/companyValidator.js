import createError from '../utils/createError.js';

export function validateCompanyPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw createError(400, 'El cuerpo de la solicitud es requerido');
  }
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw createError(400, 'El nombre de la empresa es obligatorio');
  }

  const data = {
    name,
    ruc: payload.ruc ? String(payload.ruc).trim() : null,
    address: payload.address ? String(payload.address).trim() : null,
    industry: payload.industry ? String(payload.industry).trim() : null,
  };

  return data;
}
