import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  aguaIntegrationPlaceholder,
  energiaIntegrationPlaceholder,
} from '../controllers/integrationController.js';

const router = Router();

router.use(authenticate);
router.get('/energia', energiaIntegrationPlaceholder);
router.get('/agua', aguaIntegrationPlaceholder);

export default router;
