import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  calculateCarbon,
  getCarbonSummary,
  getCarbonHistory,
  simulateCarbon,
  syncEmissionFactorsController,
} from '../controllers/carbonController.js';

const router = Router();

router.use(authenticate);

router.post('/calculate', calculateCarbon);
router.get('/summary', getCarbonSummary);
router.get('/history', getCarbonHistory);
router.post('/simulate', simulateCarbon);
router.post('/factors/sync', syncEmissionFactorsController);

export default router;
