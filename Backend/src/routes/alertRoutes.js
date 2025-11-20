import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { listAlerts, recalculateCompanyAlerts } from '../controllers/alertController.js';

const router = Router();

router.use(authenticate);
router.get('/', listAlerts);
router.post('/recalculate', recalculateCompanyAlerts);

export default router;
