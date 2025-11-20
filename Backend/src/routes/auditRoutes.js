import { Router } from 'express';
import { runAudit, listRuns, getSummary } from '../controllers/auditController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/run', runAudit);
router.get('/runs', listRuns);
router.get('/summary', getSummary);

export default router;
