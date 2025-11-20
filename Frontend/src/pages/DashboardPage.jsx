import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HiOutlineCloudArrowUp } from 'react-icons/hi2';
import CompanySelector from '../components/CompanySelector.jsx';
import MetricsOverview from '../components/MetricsOverview.jsx';
import TrendChart from '../components/TrendChart.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import BulkImportDialog from '../components/BulkImportDialog.jsx';
import Notification from '../components/Notification.jsx';
import PillarSummary from '../components/PillarSummary.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';
import HistoricalComparison from '../components/HistoricalComparison.jsx';
import PlantSelector from '../components/PlantSelector.jsx';
import DataIngestionPanel from '../components/DataIngestionPanel.jsx';
import AuditPanel from '../components/AuditPanel.jsx';
import {
  fetchCompanyMetrics,
  fetchHistoricalIndicators,
  fetchCompanyPlantReport,
} from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';

const HISTORY_SERIES = [
  { dataKey: 'energiaKwh', color: '#0b815a' },
  { dataKey: 'emisionesCO2', color: '#dc2626' },
  { dataKey: 'inversionComunidadUsd', color: '#2563eb' },
  { dataKey: 'cumplimientoNormativo', color: '#7c3aed', domain: [0, 100] },
];

export default function DashboardPage() {
  const { company, period, reportScope, setReportScope, selectedPlant, setSelectedPlant } = useCompany();
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [companyPlantReport, setCompanyPlantReport] = useState(null);
  const [plantDetail, setPlantDetail] = useState(null);
  const [plantLoading, setPlantLoading] = useState(false);
  const [plantError, setPlantError] = useState(null);
  const [auditSnapshot, setAuditSnapshot] = useState({ findings: [], indicatorSeverity: {}, run: null });

  // ✅ HOOK MOVIDO DENTRO DEL COMPONENTE
  const handleAuditChange = useCallback((snapshot) => {
    setAuditSnapshot({
      findings: snapshot?.findings ?? [],
      indicatorSeverity: snapshot?.indicatorSeverity ?? {},
      run: snapshot?.run ?? null,
    });
  }, []);

  useEffect(() => {
    if (!company || !period || reportScope !== 'empresa') return;
    loadData();
  }, [company, period, reportScope]);

  useEffect(() => {
    if (!company || reportScope !== 'planta') {
      setCompanyPlantReport(null);
      setPlantDetail(null);
      setPlantError(null);
      setPlantLoading(false);
      return;
    }
    loadPlantSummary();
  }, [company, reportScope]);

  useEffect(() => {
    if (reportScope !== 'planta') {
      return;
    }
    if (!selectedPlant) {
      setPlantDetail(null);
      return;
    }
    const detail =
      companyPlantReport?.plants?.find((item) => item.plant?.id === selectedPlant.id) ?? null;
    setPlantDetail(detail ?? null);
  }, [selectedPlant, companyPlantReport, reportScope]);

  useEffect(() => {
    if (reportScope !== 'planta') {
      return;
    }
    if (selectedPlant) {
      const stillExists = companyPlantReport?.plants?.some((item) => item.plant?.id === selectedPlant.id);
      if (!stillExists) {
        setSelectedPlant(null);
      }
      return;
    }
    if (companyPlantReport?.plants?.length === 1) {
      setSelectedPlant(companyPlantReport.plants[0].plant);
    }
  }, [companyPlantReport, reportScope, selectedPlant, setSelectedPlant]);

  async function loadData() {
    if (!company || !period || reportScope !== 'empresa') return false;
    setLoading(true);
    setError(null);
    try {
      const [current, historical] = await Promise.all([
        fetchCompanyMetrics(company.id, period),
        fetchHistoricalIndicators(company.id),
      ]);
      setMetrics(current);
      setHistory(historical);
      return true;
    } catch (err) {
      setError(err.message ?? 'No se pudieron cargar los datos');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function loadPlantSummary() {
    if (!company || reportScope !== 'planta') {
      return false;
    }
    setPlantLoading(true);
    setPlantError(null);
    try {
      const report = await fetchCompanyPlantReport(company.id);
      setCompanyPlantReport(report);
      return true;
    } catch (err) {
      setPlantError(err.message ?? 'No se pudo cargar el reporte por planta');
      return false;
    } finally {
      setPlantLoading(false);
    }
  }

  const alerts = useMemo(() => buildAlerts(metrics, auditSnapshot), [metrics, auditSnapshot]);
  const heroHighlights = useMemo(() => buildHeroHighlights(metrics), [metrics]);

  const { currentPeriodData, previousPeriodData } = useMemo(() => {
    if (!history?.length) {
      return { currentPeriodData: null, previousPeriodData: null };
    }
    const currentPeriodData = history.find((item) => item.period === period) ?? null;
    const ordered = [...history].sort((a, b) => (a.period > b.period ? 1 : -1));
    const previousPeriodData = ordered
      .slice()
      .reverse()
      .find((item) => item.period !== period) ?? null;
    return { currentPeriodData, previousPeriodData };
  }, [history, period]);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h2>Panel ESG</h2>
          <p>Monitorea indicadores clave, alertas y tendencias por periodo.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => setImportOpen(true)}>
          <HiOutlineCloudArrowUp aria-hidden="true" />
          <span>Importar indicadores desde Excel/CSV</span>
        </button>
      </div>

      <CompanySelector />

      {company && <DataIngestionPanel />}

      {company && reportScope === 'empresa' && (
        <AuditPanel
          companyId={company.id}
          period={period}
          onFindingsChange={handleAuditChange}
        />
      )}

      {reportScope === 'empresa' && metrics && (
        <motion.section
          className="dashboard-hero camaleon-aurora"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="dashboard-hero__intro">
            <span className="badge camaleon-chip" style={{ color: "#ffffff" }}>Seguimiento en tiempo real</span>

            <h3>Salud ESG del periodo {period}</h3>
            <p>
              Visualiza el pulso ambiental, social y de gobernanza con una lectura inmediata de las
              métricas prioritarias y sus variaciones más recientes.
            </p>
          </div>
          <div className="dashboard-hero__grid" role="list">
            {heroHighlights.length > 0 ? (
              heroHighlights.map((highlight, index) => (
                <motion.div
                  key={highlight.id}
                  role="listitem"
                  className={`dashboard-hero__stat dashboard-hero__stat--${highlight.tone}`}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 * index }}
                >
                  <span className="dashboard-hero__label">{highlight.label}</span>
                  <span className="dashboard-hero__value">{highlight.value}</span>
                  {highlight.detail ? (
                    <span className="dashboard-hero__detail">{highlight.detail}</span>
                  ) : null}
                </motion.div>
              ))
            ) : (
              <div className="dashboard-hero__stat dashboard-hero__stat--neutral">
                <span className="dashboard-hero__label">Datos en preparación</span>
                <span className="dashboard-hero__value">Configura tus indicadores</span>
                <span className="dashboard-hero__detail">
                  Carga información ambiental, social y de gobernanza para activar la lectura dinámica.
                </span>
              </div>
            )}
          </div>
        </motion.section>
      )}

      <fieldset className="report-scope-toggle">
        <legend className="sr-only">Tipo de reporte a visualizar</legend>
        <label>
          <input
            type="radio"
            name="dashboardScope"
            value="empresa"
            checked={reportScope === 'empresa'}
            onChange={() => setReportScope('empresa')}
          />
          Reporte general (empresa)
        </label>
        <label>
          <input
            type="radio"
            name="dashboardScope"
            value="planta"
            checked={reportScope === 'planta'}
            onChange={() => setReportScope('planta')}
          />
          Reportes por planta
        </label>
      </fieldset>

      {reportScope === 'planta' && (
        <PlantSelector
          companyId={company?.id}
          value={selectedPlant}
          onChange={setSelectedPlant}
          allowAllOption
          helper="Selecciona una planta para ver el detalle o mantén 'Todas' para el resumen consolidado."
        />
      )}

      {toast && <Notification type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {reportScope === 'empresa' && (
        <>
          {loading && <LoadingIndicator />}
          {error && <div className="alert alert-error">{error}</div>}

          {metrics && !loading && (
            <>
              <PillarSummary
                metrics={metrics}
                period={period}
                anomalies={auditSnapshot.indicatorSeverity}
              />

              <motion.section
                className="dashboard-panels"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <AlertsPanel alerts={alerts} />
                <div className="card insights-card camaleon-panel">
                  <div className="card-header">
                    <div>
                      <h3>Indicadores destacados</h3>
                      <p className="muted">Comparativa rápida respecto al periodo anterior disponible.</p>
                    </div>
                  </div>
                  <ul className="insights-list">
                    {buildInsights(currentPeriodData, previousPeriodData).map((insight) => (
                      <li key={insight.id}>
                        <div className="insight-title">{insight.title}</div>
                        <div className="insight-value">{insight.value}</div>
                        <div className={`insight-delta ${insight.trend}`}>{insight.delta}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.section>

              <MetricsOverview metrics={metrics} anomalies={auditSnapshot.indicatorSeverity} />

              <HistoricalComparison history={history} currentPeriod={period} />

              <div className="chart-grid">
                {HISTORY_SERIES.map((serie) => (
                  <TrendChart
                    key={serie.dataKey}
                    data={history}
                    series={[serie]}
                    title={chartTitle(serie.dataKey)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {reportScope === 'planta' && (
        <div className="plant-report-section">
          {plantLoading && <LoadingIndicator />}
          {plantError && <div className="alert alert-error">{plantError}</div>}

          {!plantLoading && !plantError && companyPlantReport && (
            <>
              <div className="card plant-summary-card">
                <div className="card-header">
                  <div>
                    <h3>Resumen ESG consolidado</h3>
                    <p className="muted">
                      Indicadores totales: {companyPlantReport.summary?.overall?.count ?? 0}
                    </p>
                  </div>
                  <span className="badge badge-large">
                    ESG {formatScore(companyPlantReport.summary?.esgScore)}
                  </span>
                </div>
                <div className="plant-category-grid">
                  {['environmental', 'social', 'governance'].map((key) => (
                    <div className="plant-category-card" key={key}>
                      <h4>{categoryLabel(key)}</h4>
                      <p className="plant-score">
                        Promedio: {formatScore(companyPlantReport.summary?.categories?.[key]?.average)}
                      </p>
                      <p className="muted">
                        Indicadores: {companyPlantReport.summary?.categories?.[key]?.count ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {companyPlantReport.plants?.length ? (
                <div className="plant-cards-grid">
                  {companyPlantReport.plants.map((plantReport) => (
                    <div
                      key={plantReport.plant.id}
                      className={`card plant-card ${selectedPlant?.id === plantReport.plant.id ? 'active' : ''}`}
                    >
                      <div className="card-header">
                        <div>
                          <h3>{plantReport.plant.name}</h3>
                          <p className="muted">{plantReport.plant.location ?? 'Sin ubicación declarada'}</p>
                        </div>
                        <span className="badge">ESG {formatScore(plantReport.summary?.esgScore)}</span>
                      </div>
                      <p className="muted">
                        Indicadores registrados: {plantReport.summary?.overall?.count ?? 0}
                      </p>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setSelectedPlant(plantReport.plant)}
                      >
                        Ver detalle
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <p>No hay plantas con indicadores cargados para esta empresa.</p>
                </div>
              )}
            </>
          )}

          {selectedPlant && !plantLoading && !plantError && (
            <div className="card plant-details-card">
              <div className="card-header">
                <div>
                  <h3>{selectedPlant.name}</h3>
                  <p className="muted">{selectedPlant.location ?? 'Sin ubicación declarada'}</p>
                </div>
                <span className="badge">ESG {formatScore(plantDetail?.summary?.esgScore)}</span>
              </div>
              <div className="plant-category-grid">
                {['environmental', 'social', 'governance'].map((key) => (
                  <div className="plant-category-card" key={key}>
                    <h4>{categoryLabel(key)}</h4>
                    <p className="plant-score">
                      Promedio: {formatScore(plantDetail?.summary?.categories?.[key]?.average)}
                    </p>
                    <p className="muted">
                      Indicadores: {plantDetail?.summary?.categories?.[key]?.count ?? 0}
                    </p>
                  </div>
                ))}
              </div>
              <div className="table-wrapper">
                <table className="plant-indicators-table">
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th>Categoría</th>
                      <th>Valor</th>
                      <th>Periodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantDetail?.indicators?.length ? (
                      plantDetail.indicators.map((indicator) => (
                        <tr key={indicator.id}>
                          <td>
                            <div className="indicator-name">{indicator.name}</div>
                            {indicator.description && <div className="muted">{indicator.description}</div>}
                          </td>
                          <td>{categoryLabel(indicator.category)}</td>
                          <td>{formatIndicator(indicator.value, indicator.unit)}</td>
                          <td>{indicator.period ?? 'N/D'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>No hay indicadores registrados para esta planta.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedPlant && !plantLoading && !plantError && !plantDetail && (
            <div className="alert">No se encontraron indicadores para la planta seleccionada.</div>
          )}
        </div>
      )}

      <BulkImportDialog
        companyId={company?.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          const [companyUpdated, plantUpdated] = await Promise.all([loadData(), loadPlantSummary()]);
          if (companyUpdated || plantUpdated) {
            setToast({ type: 'success', message: 'Importación completada con éxito.' });
          }
          setImportOpen(false);
        }}
      />
    </div>
  );
}

function chartTitle(key) {
  switch (key) {
    case 'energiaKwh':
      return 'Energía total (kWh)';
    case 'emisionesCO2':
      return 'Emisiones CO₂ (ton)';
    case 'inversionComunidadUsd':
      return 'Inversión social (USD)';
    case 'cumplimientoNormativo':
      return 'Cumplimiento normativo (%)';
    default:
      return key;
  }
}

function categoryLabel(key) {
  if (!key) {
    return 'Sin categoría';
  }
  switch (key) {
    case 'environmental':
    case 'ambiental':
      return 'Ambiental';
    case 'social':
      return 'Social';
    case 'governance':
    case 'gobernanza':
      return 'Gobernanza';
    default:
      return key.charAt(0).toUpperCase() + key.slice(1);
  }
}

function formatScore(value) {
  if (value === null || value === undefined) {
    return 'N/D';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2);
}

function formatIndicator(value, unit) {
  if (value === null || value === undefined) {
    return 'N/D';
  }
  const numeric = Number(value);
  const base = Number.isFinite(numeric)
    ? Number.isInteger(numeric)
      ? numeric.toString()
      : numeric.toFixed(2)
    : String(value);
  return unit ? `${base} ${unit}` : base;
}

function formatNumber(value, fractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/D';
  }
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: fractionDigits }).format(value);
}

function buildHeroHighlights(metrics) {
  if (!metrics) return [];

  const highlights = [];

  const renewable = metrics.environmental?.porcentajeRenovable;
  if (renewable !== undefined && renewable !== null) {
    const tone = renewable >= 60 ? 'positive' : renewable >= 40 ? 'warning' : 'critical';
    highlights.push({
      id: 'renewable',
      label: 'Energía renovable',
      value: `${formatNumber(renewable, 1)}%`,
      detail:
        tone === 'positive'
          ? 'Impulsa la transición energética'
          : tone === 'warning'
          ? 'Evaluar nuevas fuentes limpias'
          : 'Plan de acción para elevar el uso renovable',
      tone,
    });
  }

  const emissions = metrics.environmental?.emisionesCO2;
  if (emissions !== undefined && emissions !== null) {
    const tone = emissions <= 20 ? 'positive' : emissions <= 50 ? 'warning' : 'critical';
    highlights.push({
      id: 'emissions',
      label: 'Emisiones CO₂',
      value: `${formatNumber(emissions, 1)} t`,
      detail:
        tone === 'positive'
          ? 'Desempeño bajo en emisiones'
          : tone === 'warning'
          ? 'Monitorear intensidad y eficiencia'
          : 'Implementar mitigaciones inmediatas',
      tone,
    });
  }

  const community = metrics.social?.inversionComunidadUsd;
  if (community !== undefined && community !== null) {
    const tone = community >= 50000 ? 'positive' : community >= 20000 ? 'warning' : 'critical';
    highlights.push({
      id: 'community',
      label: 'Inversión social',
      value: new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(community),
      detail:
        tone === 'positive'
          ? 'Fortalece el impacto comunitario'
          : tone === 'warning'
          ? 'Considerar refuerzos en proyectos locales'
          : 'Planificar nuevas iniciativas de inversión',
      tone,
    });
  }

  const compliance = metrics.governance?.cumplimientoNormativo;
  if (compliance !== undefined && compliance !== null) {
    const tone = compliance >= 85 ? 'positive' : compliance >= 70 ? 'warning' : 'critical';
    highlights.push({
      id: 'compliance',
      label: 'Cumplimiento normativo',
      value: `${formatNumber(compliance, 1)}%`,
      detail:
        tone === 'positive'
          ? 'Gobernanza alineada a estándares'
          : tone === 'warning'
          ? 'Revisar planes de cumplimiento'
          : 'Atender brechas regulatorias urgentes',
      tone,
    });
  }

  return highlights.slice(0, 4);
}

function pushAlert(list, { id, message, severity = 'warning', title, icon }) {
  list.push({ id, message, severity, title, icon });
}

function buildAlerts(metrics, auditSnapshot) {
  if (auditSnapshot?.findings?.length) {
    const unique = new Set();
    const mapped = [];
    auditSnapshot.findings.forEach((finding) => {
      const severity = mapAuditSeverity(finding.severity);
      const id = `audit-${finding.indicator}-${finding.category}-${finding.period ?? 'current'}`;
      if (unique.has(id)) return;
      unique.add(id);
      mapped.push({
        id,
        title: finding.label ?? finding.indicator,
        message: finding.message,
        severity,
      });
    });
    return mapped;
  }
  return buildFallbackAlerts(metrics);
}

function buildFallbackAlerts(metrics) {
  if (!metrics) return [];
  const alerts = [];

  if (metrics.environmental?.emisionesCO2 && metrics.environmental.emisionesCO2 > 50) {
    pushAlert(alerts, {
      id: 'env-emisiones',
      title: 'Emisiones elevadas',
      message: 'Las emisiones de CO₂ superan el umbral recomendado (50 ton).',
      severity: 'danger',
    });
  }
  if (
    metrics.environmental?.porcentajeRenovable != null &&
    metrics.environmental.porcentajeRenovable < 40
  ) {
    pushAlert(alerts, {
      id: 'env-renovable',
      title: 'Energía renovable baja',
      message: 'El porcentaje de energía renovable está por debajo del 40%.',
      severity: 'warning',
    });
  }
  if (
    metrics.environmental?.residuosPeligrososTon != null &&
    metrics.environmental.residuosPeligrososTon > 5
  ) {
    pushAlert(alerts, {
      id: 'env-residuos',
      title: 'Residuos peligrosos',
      message: 'El volumen de residuos peligrosos supera las 5 toneladas.',
      severity: 'warning',
    });
  }
  if (metrics.environmental?.permisosAmbientalesAlDia === false) {
    pushAlert(alerts, {
      id: 'env-permisos',
      title: 'Permisos ambientales vencidos',
      message: 'Hay permisos ambientales vencidos o pendientes de regularización.',
      severity: 'danger',
    });
  }
  if ((metrics.environmental?.incidentesAmbientales ?? 0) > 0) {
    pushAlert(alerts, {
      id: 'env-incidentes',
      title: 'Incidentes ambientales',
      message: 'Se registraron incidentes ambientales que requieren planes de mitigación.',
      severity: 'warning',
    });
  }
  if (
    metrics.governance?.cumplimientoNormativo != null &&
    metrics.governance.cumplimientoNormativo < 80
  ) {
    pushAlert(alerts, {
      id: 'gov-cumplimiento',
      title: 'Cumplimiento normativo crítico',
      message: 'El cumplimiento normativo está por debajo del 80%.',
      severity: 'danger',
    });
  }
  if (
    metrics.governance?.porcentajeDirectoresIndependientes != null &&
    metrics.governance.porcentajeDirectoresIndependientes < 40
  ) {
    pushAlert(alerts, {
      id: 'gov-independencia',
      title: 'Independencia del directorio',
      message: 'La independencia del directorio es inferior al 40%.',
      severity: 'warning',
    });
  }
  if (metrics.governance?.comiteSostenibilidad === false) {
    pushAlert(alerts, {
      id: 'gov-comite',
      title: 'Falta de comité de sostenibilidad',
      message: 'No se cuenta con comité formal de sostenibilidad.',
      severity: 'info',
    });
  }
  if (metrics.governance?.canalDenunciasActivo === false) {
    pushAlert(alerts, {
      id: 'gov-canal',
      title: 'Canal ético inactivo',
      message: 'El canal ético se encuentra inactivo: habilítalo para fortalecer la gobernanza.',
      severity: 'warning',
    });
  }
  if (metrics.governance?.reporteSostenibilidadVerificado === false) {
    pushAlert(alerts, {
      id: 'gov-verificacion',
      title: 'Reporte sin verificación externa',
      message: 'El informe ESG aún no cuenta con verificación externa.',
      severity: 'info',
    });
  }
  if (metrics.governance?.evaluacionRiesgosEsgTrimestral === false) {
    pushAlert(alerts, {
      id: 'gov-riesgos',
      title: 'Evaluación de riesgos pendiente',
      message: 'Actualiza la evaluación trimestral de riesgos ESG para anticipar contingencias.',
      severity: 'warning',
    });
  }
  if (metrics.social?.accidentesLaborales && metrics.social.accidentesLaborales > 0) {
    pushAlert(alerts, {
      id: 'soc-accidentes',
      title: 'Accidentes laborales',
      message: 'Se registraron accidentes laborales en el periodo analizado.',
      severity: 'danger',
    });
  }
  if (metrics.social?.tasaRotacion && metrics.social.tasaRotacion > 15) {
    pushAlert(alerts, {
      id: 'soc-rotacion',
      title: 'Rotación elevada',
      message: 'La tasa de rotación supera el 15%, revisa la retención de talento.',
      severity: 'warning',
    });
  }
  if (metrics.social?.indiceSatisfaccion != null && metrics.social.indiceSatisfaccion < 70) {
    pushAlert(alerts, {
      id: 'soc-satisfaccion',
      title: 'Satisfacción baja',
      message: 'El índice de satisfacción del personal está por debajo de 70 puntos.',
      severity: 'warning',
    });
  }
  if (metrics.social?.politicaDerechosHumanos === false) {
    pushAlert(alerts, {
      id: 'soc-derechos',
      title: 'Política de derechos humanos pendiente',
      message: 'No hay política formal de derechos humanos publicada.',
      severity: 'info',
    });
  }
  if (
    metrics.social?.capacitacionDerechosHumanosPorc != null &&
    metrics.social.capacitacionDerechosHumanosPorc < 50
  ) {
    pushAlert(alerts, {
      id: 'soc-capacitacion',
      title: 'Capacitación insuficiente',
      message: 'Menos del 50% del personal fue capacitado en derechos humanos.',
      severity: 'warning',
    });
  }
  if (
    metrics.social?.inversionComunidadUsd != null &&
    metrics.social.inversionComunidadUsd < 20000
  ) {
    pushAlert(alerts, {
      id: 'soc-inversion',
      title: 'Inversión comunitaria baja',
      message: 'La inversión comunitaria anual está por debajo de la meta de 20.000 USD.',
      severity: 'info',
    });
  }
  if (
    metrics.governance?.reunionesStakeholders != null &&
    metrics.governance.reunionesStakeholders < 4
  ) {
    pushAlert(alerts, {
      id: 'gov-stakeholders',
      title: 'Relación con stakeholders',
      message: 'Se recomienda realizar al menos cuatro instancias formales con stakeholders al año.',
      severity: 'info',
    });
  }

  return alerts;
}

function mapAuditSeverity(severity) {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'warning';
  }
}

function buildInsights(current, previous) {
  const insights = [];

  function computeDelta(currentValue, previousValue, { unit = '', percent = false, currency = false, invertTrend = false } = {}) {
    if (
      currentValue === null ||
      currentValue === undefined ||
      previousValue === null ||
      previousValue === undefined ||
      Number.isNaN(currentValue) ||
      Number.isNaN(previousValue)
    ) {
      return { delta: 'Sin datos previos', trend: 'neutral' };
    }
    const difference = currentValue - previousValue;
    const baseTrend = difference === 0 ? 'neutral' : difference > 0 ? 'up' : 'down';
    const trend = invertTrend && baseTrend !== 'neutral' ? (baseTrend === 'up' ? 'down' : 'up') : baseTrend;
    const sign = difference > 0 ? '+' : difference < 0 ? '-' : '';
    let formatted;
    if (percent) {
      formatted = `${sign}${Math.abs(difference).toFixed(1)} pp`;
    } else if (currency) {
      formatted = `${sign}${new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.abs(difference))}`;
    } else {
      formatted = `${sign}${formatNumber(Math.abs(difference), 1)}${unit}`;
    }
    return {
      delta: baseTrend === 'neutral' ? 'Sin variación' : `${formatted} vs periodo anterior`,
      trend,
    };
  }

  const currentEnergy = current?.energiaKwh ?? null;
  const previousEnergy = previous?.energiaKwh ?? null;
  const currentEmissions = current?.emisionesCO2 ?? null;
  const previousEmissions = previous?.emisionesCO2 ?? null;
  const currentInvestment = current?.inversionComunidadUsd ?? null;
  const previousInvestment = previous?.inversionComunidadUsd ?? null;
  const currentCompliance = current?.cumplimientoNormativo ?? null;
  const previousCompliance = previous?.cumplimientoNormativo ?? null;

  const energyDelta = computeDelta(currentEnergy, previousEnergy, { unit: ' kWh' });
  insights.push({
    id: 'energy',
    title: 'Consumo energético',
    value: currentEnergy != null ? `${formatNumber(currentEnergy, 0)} kWh` : 'N/D',
    delta: energyDelta.delta,
    trend: energyDelta.trend,
  });

  const emissionDelta = computeDelta(currentEmissions, previousEmissions, { unit: ' t', invertTrend: true });
  insights.push({
    id: 'emissions',
    title: 'Emisiones CO₂',
    value: currentEmissions != null ? `${formatNumber(currentEmissions, 1)} t` : 'N/D',
    delta: emissionDelta.delta,
    trend: emissionDelta.trend,
  });

  const investmentDelta = computeDelta(currentInvestment, previousInvestment, { currency: true });
  insights.push({
    id: 'investment',
    title: 'Inversión social',
    value:
      currentInvestment != null
        ? new Intl.NumberFormat('es-UY', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(currentInvestment)
        : 'N/D',
    delta: investmentDelta.delta,
    trend: investmentDelta.trend,
  });

  const complianceDelta = computeDelta(currentCompliance, previousCompliance, { percent: true });
  insights.push({
    id: 'compliance',
    title: 'Cumplimiento normativo',
    value: currentCompliance != null ? `${formatNumber(currentCompliance, 1)}%` : 'N/D',
    delta: complianceDelta.delta,
    trend: complianceDelta.trend,
  });

  return insights;
}