import { Router } from 'express';
import {
  createCompanyHandler,
  deleteCompanyHandler,
  getCompany,
  listCompanies,
  updateCompanyHandler,
} from '../controllers/companyController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', listCompanies);
router.get('/:id', getCompany);
router.post('/', createCompanyHandler);
router.put('/:id', updateCompanyHandler);
router.delete('/:id', deleteCompanyHandler);

export default router;
