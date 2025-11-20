import {
  createCompany,
  deleteCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
} from '../repositories/companyRepository.js';
import { assignCompanyToUser } from '../repositories/userRepository.js';
import createError from '../utils/createError.js';
import { validateCompanyPayload } from '../validators/companyValidator.js';
import { ensureUserCanAccessCompany } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

async function listCompaniesHandler(req, res) {
  if (req.user?.companyId && req.user.role !== 'admin') {
    const company = await getCompanyById(req.user.companyId);
    res.json(company ? [company] : []);
    return;
  }
  if (req.user?.role !== 'admin') {
    res.json([]);
    return;
  }
  const companies = await getCompanies();
  res.json(companies);
}

async function getCompanyHandler(req, res) {
  const id = Number(req.params.id);
  const scopedId = ensureUserCanAccessCompany(req, id);
  const company = await getCompanyById(scopedId);
  if (!company) {
    res.status(404).json({ message: 'Empresa no encontrada' });
    return;
  }
  res.json(company);
}

async function createCompanyInternal(req, res) {
  if (req.user?.companyId && req.user.role !== 'admin') {
    throw createError(403, 'Tu cuenta ya está asociada a una empresa');
  }
  const payload = validateCompanyPayload(req.body);
  const company = await createCompany(payload);
  if (req.user && req.user.role !== 'admin') {
    await assignCompanyToUser(req.user.id, company.id);
    req.user.companyId = company.id;
  }
  res.status(201).json(company);
}

async function updateCompanyInternal(req, res) {
  const payload = validateCompanyPayload(req.body);
  const id = Number(req.params.id);
  const scopedId = ensureUserCanAccessCompany(req, id);
  const updated = await updateCompany(scopedId, payload);
  if (!updated) {
    res.status(404).json({ message: 'Empresa no encontrada' });
    return;
  }
  res.json({ id: scopedId, ...payload });
}

async function deleteCompanyInternal(req, res) {
  const id = Number(req.params.id);
  const scopedId = ensureUserCanAccessCompany(req, id);
  const deleted = await deleteCompany(scopedId);
  if (!deleted) {
    res.status(404).json({ message: 'Empresa no encontrada' });
    return;
  }
  res.status(204).send();
}

export const listCompanies = withControllerErrorHandling(
  listCompaniesHandler,
  'companyController.listCompanies',
);
export const getCompany = withControllerErrorHandling(
  getCompanyHandler,
  'companyController.getCompany',
);
export const createCompanyHandler = withControllerErrorHandling(
  createCompanyInternal,
  'companyController.createCompany',
);
export const updateCompanyHandler = withControllerErrorHandling(
  updateCompanyInternal,
  'companyController.updateCompany',
);
export const deleteCompanyHandler = withControllerErrorHandling(
  deleteCompanyInternal,
  'companyController.deleteCompany',
);
