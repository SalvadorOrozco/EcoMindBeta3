import { Router } from 'express';
import {
  getMetricByType,
  getMetricsForPeriod,
  listMetricsByType,
  upsertEnvironmental,
  upsertGovernance,
  upsertSocial,
} from '../controllers/metricController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.post('/environmental', upsertEnvironmental);
router.post('/social', upsertSocial);
router.post('/governance', upsertGovernance);
router.get('/company/:empresaId/:periodo', getMetricsForPeriod);
router.get('/:type/company/:empresaId/:periodo', getMetricByType);
router.get('/:type/company/:empresaId', listMetricsByType);

export default router;
