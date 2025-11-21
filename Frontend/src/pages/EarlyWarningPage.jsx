import { useEffect, useMemo, useState } from 'react';
import { HiArrowPath } from 'react-icons/hi2';
import CompanySelector from '../components/CompanySelector.jsx';
import PlantSelector from '../components/PlantSelector.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import Notification from '../components/Notification.jsx';
import { fetchAlerts, recalculateAlerts } from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';

const riskTone = {
  high: 'alert-card--high',
  medium: 'alert-card--medium',
  low: 'alert-card--low',
};

function groupAlerts(alerts) {
  const corporate = alerts.filter((alert) => alert.plantId == null);
  const byPlant = new Map();
  alerts
    .filter((alert) => alert.plantId != null)
    .forEach((alert) => {
      const plantKey = alert.plant?.id ?? alert.plantId;
      if (!byPlant.has(plantKey)) {
        byPlant.set(plantKey, { plant: alert.plant ?? { id: plantKey }, alerts: [] });
      }
      byPlant.get(plantKey).alerts.push(alert);
    });
  return { corporate, plants: byPlant };
}

export default function EarlyWarningPage() {
  const { company, selectedPlant, setSelectedPlant } = useCompany();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (!company) {
      setAlerts([]);
      return;
    }
    loadAlerts();
  }, [company?.id, selectedPlant?.id]);

  async function loadAlerts() {
    if (!company) return;
    setLoading(true);
    setError(null);
    try {
      const params = { companyId: company.id };
      if (selectedPlant?.id) {
        params.plantId = selectedPlant.id;
      }
      const data = await fetchAlerts(params);
      setAlerts(data);
    } catch (err) {
      setError(err.message ?? 'No se pudieron cargar las alertas');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    if (!company) return;
    setRecalculating(true);
    setError(null);
    try {
      await recalculateAlerts(company.id);
      await loadAlerts();
    } catch (err) {
      setError(err.message ?? 'No se pudieron recalcular las alertas');
    } finally {
      setRecalculating(false);
    }
  }

  const grouped = useMemo(() => groupAlerts(alerts), [alerts]);
  const hasAlerts = alerts.length > 0;

  return (
    <div className="early-warning-page">
      <header className="page-header">
        <div>
          <h2>Sistema predictivo EarlyWarningESG</h2>
          <p>
            Analiza tendencias históricas y predice riesgos ESG a nivel corporativo y por planta para
            actuar antes de que ocurran desviaciones.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={handleRecalculate} disabled={!company || recalculating}>
          <HiArrowPath aria-hidden="true" />
          <span>{recalculating ? 'Actualizando...' : 'Recalcular alertas'}</span>
        </button>
      </header>

      <CompanySelector />

      <div className="filters-grid">
        <PlantSelector
          companyId={company?.id}
          value={selectedPlant}
          onChange={setSelectedPlant}
          allowAllOption
          label="Planta"
          helper="Selecciona una planta para filtrar o mira las alertas corporativas"
        />
      </div>

      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      {loading ? (
        <LoadingIndicator label="Cargando alertas predictivas..." />
      ) : hasAlerts ? (
        <div className="alerts-layout">
          {grouped.corporate.length > 0 && (
            <section aria-label="Alertas corporativas">
              <h3>Alertas corporativas</h3>
              <div className="alert-grid">
                {grouped.corporate.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </section>
          )}

          {grouped.plants.size > 0 && (
            <section aria-label="Alertas por planta">
              <h3>Alertas por planta</h3>
              {[...grouped.plants.values()].map((entry) => (
                <div key={entry.plant?.id} className="plant-alert-block">
                  <div className="plant-alert-header">
                    <span className="badge">
                      Planta {entry.plant?.name ?? `#${entry.plant?.id ?? ''}`}
                    </span>
                    {entry.plant?.location && <span className="muted">{entry.plant.location}</span>}
                  </div>
                  <div className="alert-grid">
                    {entry.alerts.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {!grouped.corporate.length && grouped.plants.size === 0 && (
            <p className="muted">No se encontraron alertas para los filtros seleccionados.</p>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <p>
            No hay alertas registradas todavía. Genera proyecciones con el botón "Recalcular alertas" para
            ver riesgos potenciales.
          </p>
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert }) {
  return (
    <article className={`alert-card ${riskTone[alert.riskLevel] ?? ''}`}>
      <header className="alert-card__header">
        <div>
          <p className="muted">Indicador</p>
          <h4>{alert.indicatorKey}</h4>
        </div>
        <span className={`risk-chip risk-chip--${alert.riskLevel}`}>{alert.riskLevel}</span>
      </header>
      <dl className="alert-card__metrics">
        <div>
          <dt>Valor actual</dt>
          <dd>{alert.currentValue != null ? alert.currentValue : 'N/D'}</dd>
        </div>
        <div>
          <dt>Proyección</dt>
          <dd>{alert.predictedValue != null ? alert.predictedValue.toFixed(2) : 'N/D'}</dd>
        </div>
      </dl>
      <p className="alert-card__message">{alert.message}</p>
    </article>
  );
}
