import { Router } from 'express';
import {
  downloadEvidence,
  listEvidenceHandler,
  removeEvidence,
  uploadEvidence,
} from '../controllers/evidenceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { handleEvidenceUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/', handleEvidenceUpload, uploadEvidence);
router.get('/', listEvidenceHandler);
router.get('/:id/download', downloadEvidence);
router.delete('/:id', removeEvidence);

export default router;
