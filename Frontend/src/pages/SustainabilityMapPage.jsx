import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { motion } from 'framer-motion';
import { fetchSustainabilityMarkers } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const DEFAULT_CENTER = [-34.9011, -56.1645];

function markerColor(score) {
  if (score == null) return '#6b7280';
  if (score >= 70) return '#0f9d58';
  if (score >= 40) return '#f4b400';
  return '#d93025';
}

function formatScore(score) {
  if (score == null || Number.isNaN(score)) return '—';
  return Number(score).toFixed(1);
}

function scoreTone(score) {
  if (score == null) return 'unknown';
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function formatCoordinate(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(5);
}

export default function SustainabilityMapPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userCompanyId = user?.companyId ?? null;
  const [markers, setMarkers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMarkers = useCallback(async () => {
    if (!isAdmin && !userCompanyId) {
      setMarkers([]);
      setSelectedId(null);
      setError(
        'Tu cuenta aún no está asociada a una empresa. Solicita a un administrador que complete el registro.',
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = { scope: 'plant' };
      if (!isAdmin && userCompanyId) {
        params.companyId = userCompanyId;
      }
      const data = await fetchSustainabilityMarkers(params);
      const list = Array.isArray(data)
        ? data.map((marker) => ({
            ...marker,
            id: marker?.id ?? marker?.plantId ?? marker?.companyId ?? null,
          }))
        : [];
      setMarkers(list);
    } catch (err) {
      setError(err.message ?? 'No se pudo cargar el mapa de sostenibilidad');
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userCompanyId]);

  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  useEffect(() => {
    if (!markers.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId) {
      const [first] = markers;
      if (first?.id != null) {
        setSelectedId(first.id);
      }
      return;
    }
    if (!markers.some((marker) => marker.id === selectedId)) {
      const [first] = markers;
      if (first?.id != null) {
        setSelectedId(first.id);
      } else {
        setSelectedId(null);
      }
    }
  }, [markers, selectedId]);

  const selectedMarker = useMemo(
    () => markers.find((marker) => marker.id === selectedId) ?? null,
    [markers, selectedId],
  );

  const mapCenter = useMemo(() => {
    const withCoords = markers.filter((marker) => marker.latitude != null && marker.longitude != null);
    if (!withCoords.length) {
      return DEFAULT_CENTER;
    }
    const lat = withCoords.reduce((acc, marker) => acc + marker.latitude, 0) / withCoords.length;
    const lng = withCoords.reduce((acc, marker) => acc + marker.longitude, 0) / withCoords.length;
    return [lat, lng];
  }, [markers]);

  function handleSelect(marker) {
    if (!marker?.id) return;
    if (!isAdmin && userCompanyId && marker.companyId !== userCompanyId) {
      return;
    }
    setSelectedId(marker.id);
  }

  return (
    <div className="map-page">
      <motion.header
        className="page-header map-page__header"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div>
          <h2>Mapa de sostenibilidad</h2>
          <p>Visualiza la distribución geográfica y los puntajes ESG calculados para cada planta.</p>
        </div>
        <button type="button" className="secondary-button" onClick={loadMarkers} disabled={loading}>
          Actualizar datos
        </button>
      </motion.header>

      <motion.section
        className="map-hero camaleon-aurora"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
      >
        <div className="map-hero__content">
           <span className="badge camaleon-chip" style={{ color: "#ffffff" }}>Seguimiento en tiempo real</span>
          <h3>
            {markers.length > 0
              ? `${markers.length} plantas monitoreadas`
              : 'Conecta tus indicadores geolocalizados'}
          </h3>
          <p>
            Explora la madurez sostenible con un lienzo dinámico que destaca el desempeño ambiental,
            social y de gobernanza en cualquier territorio.
          </p>
        </div>
        {selectedMarker ? (
          <div className="map-hero__highlight">
            <span className="map-hero__label">Planta seleccionada</span>
            <strong>{selectedMarker.name ?? `Planta #${selectedMarker.id}`}</strong>
            <span className={`score-chip score-chip--${scoreTone(selectedMarker.esgScore)}`}>
              ESG {formatScore(selectedMarker.esgScore)}
            </span>
          </div>
        ) : (
          <div className="map-hero__highlight muted">Haz clic en un marcador para ver más detalles</div>
        )}
      </motion.section>

      {error && <div className="alert alert-error">{error}</div>}

      <motion.section
        className="map-layout"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
      >
        <motion.div
          className="map-wrapper camaleon-panel"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <MapContainer center={mapCenter} zoom={5} scrollWheelZoom className="sustainability-map">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            {markers
              .filter((marker) => marker.latitude != null && marker.longitude != null)
              .map((marker) => (
                <CircleMarker
                  key={marker.id ?? marker.plantId ?? marker.companyId}
                  center={[marker.latitude, marker.longitude]}
                  pathOptions={{
                    color: markerColor(marker.esgScore),
                    fillColor: markerColor(marker.esgScore),
                    fillOpacity: 0.85,
                  }}
                  radius={10}
                  eventHandlers={{
                    click: () => handleSelect(marker),
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <h4>{marker.name ?? `Planta #${marker.id ?? marker.plantId}`}</h4>
                      <p>
                        Empresa: <strong>{marker.companyName ?? 'Sin empresa asignada'}</strong>
                      </p>
                      <p>
                        Puntaje ESG: <strong>{formatScore(marker.esgScore)}</strong>
                      </p>
                      <p>
                        Indicadores evaluados: <strong>{marker.indicatorCount ?? 0}</strong>
                      </p>
                      {marker.location ? <p>{marker.location}</p> : null}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>
          <div className="map-legend">
            <span className="legend-dot legend-dot--high" /> Alto desempeño
            <span className="legend-dot legend-dot--mid" /> Medio
            <span className="legend-dot legend-dot--low" /> Bajo
            <span className="legend-dot legend-dot--unknown" /> Sin datos
          </div>
        </motion.div>

        <motion.aside
          className="map-sidepanel camaleon-panel"
          initial={{ opacity: 0.6, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
        >
          <h3>Plantas monitoreadas</h3>
          <p className="muted">Selecciona una planta para ver sus datos geográficos y puntaje ESG consolidado.</p>
          <div className="map-company-list" role="list">
            {markers.length === 0 ? (
              <p className="muted">No hay plantas disponibles para mostrar.</p>
            ) : (
              markers.map((marker) => (
                <button
                  type="button"
                  key={marker.id ?? marker.plantId ?? marker.companyId}
                  className={`map-company-item ${marker.id === selectedId ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(marker)}
                  role="listitem"
                >
                  <div>
                    <strong>{marker.name ?? `Planta #${marker.id ?? marker.plantId}`}</strong>
                    <span className="muted">{marker.companyName ?? 'Empresa sin nombre'}</span>
                  </div>
                  <span className={`score-chip score-chip--${scoreTone(marker.esgScore)}`}>
                    {formatScore(marker.esgScore)}
                  </span>
                </button>
              ))
            )}
          </div>

          {selectedMarker ? (
            <div className="map-details">
              <div className="map-details-header">
                <h4>{selectedMarker.name ?? `Planta #${selectedMarker.id}`}</h4>
                <span className={`score-chip score-chip--${scoreTone(selectedMarker.esgScore)}`}>
                  ESG {formatScore(selectedMarker.esgScore)}
                </span>
              </div>
              <dl>
                <dt>Empresa</dt>
                <dd>{selectedMarker.companyName ?? 'Sin empresa asignada'}</dd>
                <dt>Ubicación</dt>
                <dd>{selectedMarker.location ?? 'Sin dirección registrada'}</dd>
                <dt>Coordenadas</dt>
                <dd>
                  Lat: {formatCoordinate(selectedMarker.latitude)}
                  <br />
                  Lon: {formatCoordinate(selectedMarker.longitude)}
                </dd>
                <dt>Indicadores evaluados</dt>
                <dd>{selectedMarker.indicatorCount ?? 0}</dd>
              </dl>
            </div>
          ) : (
            <div className="alert alert-info">Selecciona una planta para ver los detalles.</div>
          )}
        </motion.aside>
      </motion.section>
    </div>
  );
}
