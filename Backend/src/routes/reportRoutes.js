import { Router } from 'express';
import { generateReport } from '../controllers/reportController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.post('/generate', generateReport);

export default router;
