import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiOutlineSparkles,
  HiOutlineArrowPath,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
  HiOutlineXCircle,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';
import LoadingIndicator from './LoadingIndicator.jsx';
import { fetchAuditSummary, runEsgAuditRequest } from '../services/api.js';

const SEVERITY_ORDER = ['critical', 'warning', 'info'];
const SEVERITY_CONFIG = {
  critical: {
    label: 'Crítico',
    className: 'finding-critical',
    icon: HiOutlineXCircle,
    badge: 'badge-danger',
  },
  warning: {
    label: 'Advertencia',
    className: 'finding-warning',
    icon: HiOutlineExclamationTriangle,
    badge: 'badge-warning',
  },
  info: {
    label: 'Observación',
    className: 'finding-info',
    icon: HiOutlineInformationCircle,
    badge: 'badge-primary',
  },
};

const STATUS_LABELS = {
  processing: 'En progreso',
  completed: 'Completada',
  'completed-with-findings': 'Completada con hallazgos',
  failed: 'Fallida',
};

function normalizeSummary(summary) {
  if (!summary) {
    return {
      run: null,
      findings: [],
      indicatorSeverity: {},
      totals: { critical: 0, warning: 0, info: 0 },
    };
  }
  const totals = summary.totals ?? {
    critical:
      summary.run?.severityBreakdown?.critical ?? summary.run?.criticalFindings ?? 0,
    warning: summary.run?.severityBreakdown?.warning ?? summary.run?.warningFindings ?? 0,
    info: summary.run?.severityBreakdown?.info ?? summary.run?.infoFindings ?? 0,
  };
  return {
    run: summary.run ?? null,
    findings: summary.findings ?? [],
    indicatorSeverity: summary.indicatorSeverity ?? {},
    totals,
  };
}

export default function AuditPanel({ companyId, period, onFindingsChange }) {
  const [state, setState] = useState(() => normalizeSummary(null));
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const totals = state.totals;
  const hasFindings = state.findings.length > 0;
  const statusLabel = state.run ? STATUS_LABELS[state.run.status] ?? state.run.status : null;

  const loadSummary = useCallback(async () => {
    if (!companyId || !period) {
      setState(normalizeSummary(null));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const summary = await fetchAuditSummary({ companyId, period });
      setState(normalizeSummary(summary));
    } catch (err) {
      setError(err.message ?? 'No se pudo cargar la auditoría.');
    } finally {
      setLoading(false);
    }
  }, [companyId, period]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (typeof onFindingsChange === 'function') {
      onFindingsChange({
        findings: state.findings,
        indicatorSeverity: state.indicatorSeverity,
        run: state.run,
      });
    }
  }, [state, onFindingsChange]);

  const severityBadges = useMemo(() => {
    return SEVERITY_ORDER.map((severity) => {
      const count = totals?.[severity] ?? 0;
      const config = SEVERITY_CONFIG[severity];
      return {
        severity,
        count,
        config,
      };
    });
  }, [totals]);

  const auditStats = useMemo(() => {
    if (!state.run) {
      return [];
    }
    return [
      {
        id: 'indicators',
        label: 'Indicadores evaluados',
        value: state.run.totalIndicators ?? 0,
      },
      {
        id: 'findings',
        label: 'Hallazgos detectados',
        value: state.run.totalFindings ?? state.findings.length ?? 0,
      },
      statusLabel
        ? {
            id: 'status',
            label: 'Estado',
            value: statusLabel,
            icon: state.run.status === 'completed' ? HiOutlineCheckCircle : null,
          }
        : null,
    ].filter(Boolean);
  }, [state.run, state.findings.length, statusLabel]);

  async function handleRunAudit() {
    if (!companyId || !period) return;
    setRunning(true);
    setError(null);
    try {
      const result = await runEsgAuditRequest({ companyId, period });
      const normalized = normalizeSummary({
        run: result.run,
        findings: result.findings,
        indicatorSeverity: result.indicatorSeverity,
      });
      normalized.totals = {
        critical: result.run?.severityBreakdown?.critical ?? result.run?.criticalFindings ?? 0,
        warning: result.run?.severityBreakdown?.warning ?? result.run?.warningFindings ?? 0,
        info: result.run?.severityBreakdown?.info ?? result.run?.infoFindings ?? 0,
      };
      setState(normalized);
    } catch (err) {
      setError(err.message ?? 'No se pudo ejecutar la auditoría automática.');
    } finally {
      setRunning(false);
    }
  }

  return (
      <section className="card audit-panel camaleon-panel" aria-labelledby="audit-panel-title">
        <header className="card-header">
          <div>
            <h3 id="audit-panel-title">Auditoría automática</h3>
            <p className="muted">Detecta inconsistencias ESG con IA y reglas heurísticas.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={handleRunAudit}
            disabled={running || !companyId || !period}
            aria-disabled={running || !companyId || !period}
            aria-busy={running}
          >
            {running ? <HiOutlineArrowPath className="spin" aria-hidden="true" /> : <HiOutlineSparkles aria-hidden="true" />}
            <span>{running ? 'Analizando...' : 'Ejecutar auditoría'}</span>
          </button>
        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            <HiOutlineXCircle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="audit-overview" role="status" aria-live="polite">
          {severityBadges.map(({ severity, count, config }) => (
            <span key={severity} className={`badge ${config.badge}`} aria-label={`${count} hallazgos ${config.label.toLowerCase()}`}>
              {config.label}
              <strong>{count}</strong>
            </span>
          ))}
          {state.run?.finishedAt && (
            <span className="timestamp" aria-label="Fecha de última auditoría">
              Última auditoría: {new Date(state.run.finishedAt).toLocaleString('es-UY')}
            </span>
          )}
        </div>

        {state.run?.summary && (
          <p className="audit-summary" aria-live="polite">
            {state.run.summary}
          </p>
        )}

        {auditStats.length > 0 && (
          <dl className="audit-stats">
            {auditStats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="audit-stat">
                  <dt>{item.label}</dt>
                  <dd>
                    {Icon && <Icon aria-hidden="true" />}
                    <span>{item.value}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {loading ? (
          <div className="audit-loading">
            <LoadingIndicator label="Cargando auditoría" />
          </div>
      ) : hasFindings ? (
        <ul className="audit-findings">
          {state.findings.map((finding) => {
            const config = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.warning;
            const Icon = config.icon;
            return (
              <li key={`${finding.indicator}-${finding.category}-${finding.period}`} className={config.className}>
                <div className="finding-icon" aria-hidden="true">
                  <Icon />
                </div>
                <div>
                  <header>
                    <span className="finding-indicator">{finding.label ?? finding.indicator}</span>
                    <span className="finding-severity">{config.label}</span>
                  </header>
                  <p>{finding.message}</p>
                  {finding.suggestion && <p className="muted">{finding.suggestion}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="audit-empty">
          <p>No se detectaron hallazgos para el periodo seleccionado.</p>
          <p className="muted">La auditoría se actualizará automáticamente cuando cargues nuevos indicadores.</p>
        </div>
      )}
    </section>
  );
}

