import { Router } from 'express';
import { runAudit, listRuns, getSummary, listLogs } from '../controllers/auditController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/run', runAudit);
router.get('/runs', listRuns);
router.get('/summary', getSummary);
router.get('/logs', listLogs);

export default router;
