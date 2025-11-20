import { Router } from 'express';
import { getCompanyReportHandler } from '../controllers/plantController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/report', getCompanyReportHandler);

export default router;
