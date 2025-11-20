import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import createError from '../utils/createError.js';
import { getUserById } from '../repositories/userRepository.js';

export async function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(createError(401, 'Autenticación requerida'));
  }

  const token = header.slice(7).trim();
  if (!token) {
    return next(createError(401, 'Token de sesión inválido'));
  }

  try {
    const payload = jwt.verify(token, env.auth.jwtSecret);
    const user = await getUserById(payload.sub);
    if (!user) {
      throw createError(401, 'Usuario no encontrado');
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(createError(401, 'La sesión ha expirado, vuelve a iniciar sesión'));
    }
    return next(createError(401, 'Token inválido'));
  }
}
