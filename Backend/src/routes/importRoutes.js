import { Router } from 'express';
import { previewImport, confirmImport } from '../controllers/importController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { handleImportUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/preview', handleImportUpload, previewImport);
router.post('/confirm', confirmImport);

export default router;
