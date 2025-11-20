import { useEffect, useMemo, useState } from 'react';
import { HiArrowPath, HiSparkles } from 'react-icons/hi2';
import CompanySelector from '../components/CompanySelector.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import Notification from '../components/Notification.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import { fetchRegulatoryForecasts, generateRegulatoryForecasts } from '../services/api.js';

const categoryLabels = {
  E: 'Ambiental',
  S: 'Social',
  G: 'Gobernanza',
};

const impactRank = { low: 1, medium: 2, high: 3 };

function groupByCategory(forecasts) {
  const groups = new Map();
  forecasts.forEach((forecast) => {
    const key = forecast.category ?? 'E';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(forecast);
  });
  return groups;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES');
}

export default function RegulatoryForecastPage() {
  const { company } = useCompany();
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!company) {
      setForecasts([]);
      return;
    }
    loadForecasts();
  }, [company?.id]);

  async function loadForecasts() {
    if (!company) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRegulatoryForecasts({ companyId: company.id });
      setForecasts(data);
    } catch (err) {
      setError(err.message ?? 'No se pudieron cargar los pronósticos normativos');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!company) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateRegulatoryForecasts(company.id);
      setForecasts(result);
    } catch (err) {
      setError(err.message ?? 'No se pudo generar el pronóstico');
    } finally {
      setGenerating(false);
    }
  }

  const grouped = useMemo(() => groupByCategory(forecasts), [forecasts]);
  const hasData = forecasts.length > 0;

  return (
    <div className="regulatory-page">
      <header className="page-header">
        <div>
          <h2>Futuro Normativo</h2>
          <p>
            Combina indicadores ESG con tendencias regulatorias globales y regionales para anticipar cambios
            en los próximos 1, 2 y 3 años.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={handleGenerate} disabled={!company || generating}>
            <HiSparkles aria-hidden="true" />
            <span>{generating ? 'Generando...' : 'Generar con IA'}</span>
          </button>
          <button type="button" className="ghost-button" onClick={loadForecasts} disabled={!company || loading}>
            <HiArrowPath aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      <CompanySelector />

      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      {loading ? (
        <LoadingIndicator label="Calculando escenarios regulatorios..." />
      ) : hasData ? (
        <div className="forecast-grid">
          {[...grouped.entries()].map(([category, items]) => (
            <ForecastCard key={category} category={category} items={items} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>Genera el primer pronóstico para ver cómo pueden cambiar las regulaciones ESG.</p>
        </div>
      )}
    </div>
  );
}

function ForecastCard({ category, items }) {
  const sorted = [...items].sort((a, b) => (a.horizonYears ?? 0) - (b.horizonYears ?? 0));
  const strongestImpact = sorted.reduce(
    (acc, curr) => (impactRank[curr.impactLevel] > impactRank[acc] ? curr.impactLevel : acc),
    'medium',
  );
  const headline = `${categoryLabels[category] ?? 'Categoría'} (${category})`;
  const region = items[0]?.region ?? 'global';
  const updated = items[0]?.dateCreated ? formatDate(items[0].dateCreated) : 'Reciente';

  return (
    <article className="forecast-card">
      <header className="forecast-card__header">
        <div>
          <p className="muted">Categoría</p>
          <h3>{headline}</h3>
          <p className="muted">Región predominante: {region} · Actualizado: {updated}</p>
        </div>
        <span className={`impact-badge impact-badge--${strongestImpact}`}>{strongestImpact}</span>
      </header>

      <div className="timeline">
        {sorted.map((item) => (
          <TimelinePoint key={`${item.id}-${item.horizonYears}`} point={item} />
        ))}
      </div>
    </article>
  );
}

function TimelinePoint({ point }) {
  const probability = Math.round((point.probability ?? 0) * 100);
  const horizonLabel = point.horizonYears ? `${point.horizonYears} año${point.horizonYears > 1 ? 's' : ''}` : 'Próximo';
  return (
    <div className="timeline-point">
      <div className="timeline-point__heading">
        <span className="timeline-point__horizon">{horizonLabel}</span>
        <span className={`impact-chip impact-chip--${point.impactLevel}`}>{point.impactLevel}</span>
      </div>
      <div className="timeline-point__bar">
        <div className="timeline-point__fill" style={{ width: `${probability}%` }} />
      </div>
      <div className="timeline-point__meta">
        <span className="probability-chip">{probability}% prob.</span>
        <p>{point.forecastText}</p>
      </div>
    </div>
  );
}
