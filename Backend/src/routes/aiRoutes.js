import { Router } from 'express';
import { analyzeFiles, deleteInsight, listInsights } from '../controllers/aiController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { handleAiUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/analyze-files', handleAiUpload, analyzeFiles);
router.get('/insights', listInsights);
router.delete('/insights/:id', deleteInsight);

export default router;

