import { Router } from 'express';
import { getHistoricalIndicators } from '../controllers/metricController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  createIndicator,
  deleteIndicator,
  listIndicators,
} from '../controllers/indicatorController.js';

const router = Router();

router.use(authenticate);

router.get('/', listIndicators);
router.post('/', createIndicator);
router.get('/historico/:empresaId', getHistoricalIndicators);
router.delete('/:indicatorId', deleteIndicator);

export default router;
