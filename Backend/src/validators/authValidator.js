import createError from '../utils/createError.js';

export function validateRegistrationPayload(body) {
  if (!body || typeof body !== 'object') {
    throw createError(400, 'Datos de registro inválidos');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = typeof body.role === 'string' ? body.role.trim() : 'manager';
  const companyId =
    body.companyId === undefined || body.companyId === null || body.companyId === ''
      ? null
      : Number.parseInt(body.companyId, 10);

  if (!name) {
    throw createError(400, 'El nombre es obligatorio');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError(400, 'El correo electrónico no es válido');
  }
  if (password.length < 8) {
    throw createError(400, 'La contraseña debe tener al menos 8 caracteres');
  }
  if (companyId !== null && Number.isNaN(companyId)) {
    throw createError(400, 'El identificador de la empresa no es válido');
  }

  return { name, email, password, companyId, role };
}

export function validateLoginPayload(body) {
  if (!body || typeof body !== 'object') {
    throw createError(400, 'Credenciales inválidas');
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    throw createError(400, 'El correo electrónico es obligatorio');
  }
  if (!password) {
    throw createError(400, 'La contraseña es obligatoria');
  }

  return { email, password };
}
