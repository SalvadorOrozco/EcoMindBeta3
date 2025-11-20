import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { listMapMarkers, updateMapMarker } from '../controllers/mapController.js';

const router = Router();

router.use(authenticate);

router.get('/', listMapMarkers);
router.put('/:companyId', updateMapMarker);

export default router;
