import { Router } from 'express';
import {
  runIngestion,
  listIngestionRuns,
  listIngestionAlerts,
  resolveIngestionAlert,
} from '../controllers/ingestionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { handleIngestionUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/run', handleIngestionUpload, runIngestion);
router.get('/runs', listIngestionRuns);
router.get('/alerts', listIngestionAlerts);
router.patch('/alerts/:id/resolve', resolveIngestionAlert);

export default router;
