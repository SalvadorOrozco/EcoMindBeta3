import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  generateCompanyRegulations,
  listRegulatoryForecasts,
} from '../controllers/regulatoryForecastController.js';

const router = Router();

router.use(authenticate);
router.get('/forecast', listRegulatoryForecasts);
router.post('/generate', generateCompanyRegulations);

export default router;
