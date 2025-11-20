import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import createError from '../utils/createError.js';
import {
  createUser,
  findUserByEmail,
  getUserById,
} from '../repositories/userRepository.js';
import { getCompanyById } from '../repositories/companyRepository.js';
import {
  validateLoginPayload,
  validateRegistrationPayload,
} from '../validators/authValidator.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

function buildTokenPayload(user) {
  return {
    sub: user.id,
    role: user.role,
    companyId: user.companyId ?? undefined,
  };
}

function signToken(user) {
  return jwt.sign(buildTokenPayload(user), env.auth.jwtSecret, {
    expiresIn: env.auth.tokenExpiresIn,
  });
}

async function registerHandler(req, res) {
  const payload = validateRegistrationPayload(req.body);
  const existing = await findUserByEmail(payload.email, { includePassword: true });
  if (existing) {
    throw createError(409, 'Ya existe un usuario registrado con este correo');
  }

  if (payload.companyId) {
    const company = await getCompanyById(payload.companyId);
    if (!company) {
      throw createError(400, 'La empresa seleccionada no existe');
    }
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user = await createUser({
    name: payload.name,
    email: payload.email,
    passwordHash,
    companyId: payload.companyId,
    role: payload.role || 'manager',
  });

  const token = signToken(user);
  res.status(201).json({ token, user });
}

async function loginHandler(req, res) {
  const payload = validateLoginPayload(req.body);
  const user = await findUserByEmail(payload.email, { includePassword: true });
  if (!user) {
    throw createError(401, 'Credenciales inválidas');
  }

  const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);
  if (!passwordMatches) {
    throw createError(401, 'Credenciales inválidas');
  }

  delete user.passwordHash;
  const token = signToken(user);
  res.json({ token, user });
}

async function meHandler(req, res) {
  const user = await getUserById(req.user.id);
  if (!user) {
    throw createError(404, 'Usuario no encontrado');
  }
  res.json({ user });
}

export const register = withControllerErrorHandling(registerHandler, 'authController.register');
export const login = withControllerErrorHandling(loginHandler, 'authController.login');
export const me = withControllerErrorHandling(meHandler, 'authController.me');
