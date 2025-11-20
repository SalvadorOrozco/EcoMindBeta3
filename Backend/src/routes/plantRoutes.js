import { Router } from 'express';
import {
  createPlantHandler,
  deletePlantHandler,
  getPlantReportHandler,
  listPlants,
} from '../controllers/plantController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', listPlants);
router.post('/', createPlantHandler);
router.get('/:id/report', getPlantReportHandler);
router.delete('/:id', deletePlantHandler);

export default router;
