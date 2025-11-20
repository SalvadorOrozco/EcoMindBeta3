import { useEffect, useMemo, useState } from 'react';
import { HiOutlineShieldCheck, HiOutlineShieldExclamation, HiOutlineSparkles } from 'react-icons/hi2';
import { useCompany } from '../context/CompanyContext.jsx';
import { fetchAuditLogs, runAutoAudit } from '../services/api.js';
import CompanySelector from '../components/CompanySelector.jsx';
import PlantSelector from '../components/PlantSelector.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import Notification from '../components/Notification.jsx';

function statusBadge(status) {
  if (status === 'verified') return <span className="badge badge-success">Verificado</span>;
  if (status === 'failed') return <span className="badge badge-danger">Error</span>;
  return <span className="badge">Pendiente</span>;
}

export default function AutoAuditPage() {
  const { company } = useCompany();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [plantFilter, setPlantFilter] = useState(null);

  useEffect(() => {
    if (!company) return;
    loadLogs();
  }, [company?.id, plantFilter?.id]);

  const failedCount = useMemo(() => logs.filter((log) => log.status === 'failed').length, [logs]);

  async function loadLogs() {
    if (!company) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs({ companyId: company.id, plantId: plantFilter?.id ?? undefined });
      setLogs(data ?? []);
    } catch (err) {
      setError(err.message ?? 'No se pudieron cargar los logs de auditoría.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    if (!company) return;
    setRunning(true);
    setToast(null);
    try {
      const result = await runAutoAudit(company.id);
      setLogs(result.logs ?? []);
      setToast({ type: 'success', message: 'Auditoría automática ejecutada con IA.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message ?? 'No se pudo ejecutar la auditoría.' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="auto-audit-page">
      <div className="page-header">
        <div>
          <h2>Auditoría Automática</h2>
          <p>Valida indicadores ESG contra evidencias adjuntas con ayuda de IA.</p>
        </div>
        <div className="actions-row">
          <button className="secondary-button" type="button" onClick={handleRun} disabled={!company || running}>
            {running ? 'Auditando…' : 'Ejecutar auditoría con IA'}
          </button>
        </div>
      </div>

      <CompanySelector />

      {company && (
        <PlantSelector
          companyId={company.id}
          value={plantFilter}
          onChange={setPlantFilter}
          allowAllOption
          helper="Filtra los resultados por planta o revisa el consolidado corporativo."
        />
      )}

      {toast && <Notification type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {error && <div className="alert alert-error">{error}</div>}
      {failedCount > 0 && (
        <Notification
          type="error"
          message={`Hay ${failedCount} indicadores con discrepancias. Revísalos y adjunta evidencia adicional si es necesario.`}
          onClose={() => setLogs(logs.filter((log) => log.status !== 'failed'))}
        />
      )}

      {loading ? (
        <LoadingIndicator />
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Logs de auditoría</h3>
              <p className="muted">
                {logs.length} registros · {failedCount} con estado de error
              </p>
            </div>
            <div className="audit-legend" aria-label="Leyenda de estado">
              <span className="legend-item">
                <HiOutlineShieldCheck aria-hidden="true" /> Verificado
              </span>
              <span className="legend-item">
                <HiOutlineShieldExclamation aria-hidden="true" /> Error
              </span>
              <span className="legend-item">
                <HiOutlineSparkles aria-hidden="true" /> IA
              </span>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Planta</th>
                  <th>Estado</th>
                  <th>Mensaje</th>
                  <th>Confianza</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="6" className="muted">
                      Sin resultados disponibles. Ejecuta la auditoría para generar nuevos registros.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className={log.status === 'failed' ? 'row-error' : ''}>
                    <td>
                      <div className="indicator-cell">
                        <strong>{log.indicatorKey ?? `#${log.indicatorId ?? 'N/D'}`}</strong>
                        <span className="muted">ID: {log.indicatorId ?? 'N/D'}</span>
                      </div>
                    </td>
                    <td>{log.plantId ? `Planta #${log.plantId}` : 'Corporativo'}</td>
                    <td>{statusBadge(log.status)}</td>
                    <td>{log.message ?? 'Sin mensaje'}</td>
                    <td>
                      <div className="confidence-bar" aria-label={`Confianza ${log.confidence ?? 0}%`}>
                        <div
                          className={`confidence-fill ${log.status === 'failed' ? 'danger' : 'success'}`}
                          style={{ width: `${Math.max(0, Math.min(100, log.confidence ?? 0))}%` }}
                        />
                        <span className="confidence-label">{log.confidence ?? 0}%</span>
                      </div>
                    </td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
