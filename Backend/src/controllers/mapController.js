import createError from '../utils/createError.js';
import {
  getMarkerByCompanyId,
  getPlantMarkers,
  getSustainabilityMarkers,
  upsertMapEntry,
} from '../repositories/mapRepository.js';
import { validateMapUpdate } from '../validators/customIndicatorValidator.js';
import { ensureUserCanAccessCompany, resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

async function listMapMarkersHandler(req, res) {
  const scope = req.query.scope === 'plant' ? 'plant' : 'company';
  const isAdmin = req.user?.role === 'admin';

  if (scope === 'plant') {
    if (!isAdmin) {
      const companyId = resolveCompanyIdFromRequest(req, req.user?.companyId ?? null);
      const markers = await getPlantMarkers(companyId);
      res.json(markers);
      return;
    }

    const { companyId: queryCompanyId } = req.query;
    if (queryCompanyId) {
      const companyId = ensureUserCanAccessCompany(req, queryCompanyId);
      const markers = await getPlantMarkers(companyId);
      res.json(markers);
      return;
    }

    const markers = await getPlantMarkers();
    res.json(markers);
    return;
  }

  if (!isAdmin) {
    const companyId = resolveCompanyIdFromRequest(req, req.user?.companyId ?? null);
    const marker = await getMarkerByCompanyId(companyId);
    res.json(marker ? [marker] : []);
    return;
  }

  const { companyId: queryCompanyId } = req.query;
  if (queryCompanyId) {
    const companyId = ensureUserCanAccessCompany(req, queryCompanyId);
    const marker = await getMarkerByCompanyId(companyId);
    res.json(marker ? [marker] : []);
    return;
  }

  const markers = await getSustainabilityMarkers();
  res.json(markers);
}

async function updateMapMarkerHandler(req, res) {
  const companyId = ensureUserCanAccessCompany(req, req.params.companyId);

  const rawPayload = {
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    esgScore: req.body.esgScore,
  };

  const parsed = validateMapUpdate(rawPayload);
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(rawPayload, 'latitude')) {
    updates.latitude = parsed.latitude ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(rawPayload, 'longitude')) {
    updates.longitude = parsed.longitude ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(rawPayload, 'esgScore')) {
    updates.esgScore = parsed.esgScore ?? null;
  }

  if (!Object.keys(updates).length) {
    throw createError(400, 'Debes proporcionar al menos un campo para actualizar');
  }

  await upsertMapEntry(companyId, updates);
  const marker = await getMarkerByCompanyId(companyId);
  res.json(marker);
}

export const listMapMarkers = withControllerErrorHandling(
  listMapMarkersHandler,
  'mapController.listMapMarkers',
);
export const updateMapMarker = withControllerErrorHandling(
  updateMapMarkerHandler,
  'mapController.updateMapMarker',
);
