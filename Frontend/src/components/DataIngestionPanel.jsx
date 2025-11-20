import { useEffect, useId, useMemo, useState } from 'react';
import {
  HiOutlineDocumentArrowUp,
  HiOutlineEnvelope,
  HiOutlineLink,
  HiOutlineBellAlert,
  HiOutlineCheckCircle,
  HiOutlinePlayCircle,
  HiOutlineTrash,
  HiOutlinePlus,
} from 'react-icons/hi2';
import {
  fetchIngestionAlerts,
  fetchIngestionRuns,
  resolveIngestionAlert,
  runAutomatedIngestion,
} from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';

export default function DataIngestionPanel() {
  const { company, period } = useCompany();
  const [files, setFiles] = useState([]);
  const [emailConfig, setEmailConfig] = useState(() => defaultEmailConfig());
  const [apiSources, setApiSources] = useState([]);
  const [runs, setRuns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const fileInputId = useId();

  const hasSources = useMemo(
    () => files.length > 0 || hasEmailConfig(emailConfig) || apiSources.length > 0,
    [files, emailConfig, apiSources],
  );

  useEffect(() => {
    if (!company) {
      setRuns([]);
      setAlerts([]);
      return;
    }
    let mounted = true;
    async function load() {
      try {
        const [runsResponse, alertsResponse] = await Promise.all([
          fetchIngestionRuns({ companyId: company.id, limit: 5 }),
          fetchIngestionAlerts({ companyId: company.id, unresolved: true, limit: 10 }),
        ]);
        if (!mounted) return;
        setRuns(runsResponse?.items ?? []);
        setAlerts(alertsResponse?.items ?? []);
      } catch (err) {
        if (mounted) {
          setError(err.message ?? 'No se pudo cargar el historial de ingestas.');
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [company?.id]);

  function handleFileChange(event) {
    const list = Array.from(event.target.files ?? []);
    setFiles((prev) => [...prev, ...list]);
    event.target.value = '';
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateEmailConfig(field, value) {
    setEmailConfig((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddApiSource() {
    setApiSources((prev) => [
      ...prev,
      { id: generateClientId(), url: '', method: 'GET', format: 'json' },
    ]);
  }

  function handleUpdateApiSource(id, field, value) {
    setApiSources((prev) =>
      prev.map((source) => (source.id === id ? { ...source, [field]: value } : source)),
    );
  }

  function handleRemoveApiSource(id) {
    setApiSources((prev) => prev.filter((source) => source.id !== id));
  }

  async function handleResolveAlert(id) {
    try {
      const updated = await resolveIngestionAlert(id);
      setAlerts((prev) => prev.filter((alert) => alert.id !== updated.id));
    } catch (err) {
      setError(err.message ?? 'No se pudo resolver la alerta.');
    }
  }

  async function handleRunIngestion(event) {
    event.preventDefault();
    if (!company) {
      setError('Selecciona una empresa para ejecutar la ingesta.');
      return;
    }
    if (!hasSources) {
      setError('Agrega archivos, credenciales de correo o endpoints API antes de ejecutar la ingesta.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('companyId', company.id);
      if (period) {
        formData.append('period', period);
      }
      files.forEach((file) => formData.append('files', file));
      formData.append(
        'options',
        JSON.stringify({
          email: hasEmailConfig(emailConfig) ? sanitizeEmailPayload(emailConfig) : null,
          apis: apiSources.filter((source) => source.url?.trim()),
        }),
      );

      const response = await runAutomatedIngestion(formData);
      setMessage('Ingesta ejecutada correctamente.');
      setFiles([]);
      await refreshStatus();
      if (response?.alerts) {
        setAlerts(response.alerts);
      }
    } catch (err) {
      setError(err.message ?? 'No se pudo ejecutar la ingesta.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    if (!company) return;
    try {
      const [runsResponse, alertsResponse] = await Promise.all([
        fetchIngestionRuns({ companyId: company.id, limit: 5 }),
        fetchIngestionAlerts({ companyId: company.id, unresolved: true, limit: 10 }),
      ]);
      setRuns(runsResponse?.items ?? []);
      setAlerts(alertsResponse?.items ?? []);
    } catch (err) {
      setError(err.message ?? 'No se pudo actualizar el estado de la ingesta.');
    }
  }

  return (
    <section className="ingestion-panel" aria-labelledby="ingestion-panel-title">
      <header className="ingestion-panel__header">
        <div>
          <h3 id="ingestion-panel-title">Automatización de datos ESG</h3>
          <p>
            Integra fuentes corporativas para poblar indicadores ambientales, sociales y de gobernanza de manera
            consistente.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleRunIngestion}
          disabled={loading || !company || !hasSources}
        >
          <HiOutlinePlayCircle aria-hidden="true" />
          <span>{loading ? 'Procesando...' : 'Ejecutar ingesta'}</span>
        </button>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="ingestion-grid">
        <div className="ingestion-card">
          <h4>
            <HiOutlineDocumentArrowUp aria-hidden="true" /> Archivos corporativos
          </h4>
          <p className="ingestion-card__description">
            Arrastra archivos Excel, CSV, PDF, imágenes o textos con evidencias ESG. El sistema detectará tablas, unidades
            y periodos de forma automática.
          </p>
          <label htmlFor={fileInputId} className="ingestion-dropzone">
            <span>Haz clic o arrastra múltiples archivos</span>
            <input
              id={fileInputId}
              type="file"
              multiple
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.txt,.docx"
            />
          </label>
          {files.length > 0 && (
            <ul className="ingestion-file-list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeFile(index)}
                    aria-label={`Eliminar ${file.name}`}
                  >
                    <HiOutlineTrash aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ingestion-card">
          <h4>
            <HiOutlineEnvelope aria-hidden="true" /> Correos corporativos
          </h4>
          <p className="ingestion-card__description">
            Conecta una casilla IMAP para capturar adjuntos periódicos de reportes, facturas o formularios ESG.
          </p>
          <div className="ingestion-form-grid">
            <div className="form-field">
              <label htmlFor="email-host">Servidor IMAP</label>
              <input
                id="email-host"
                type="text"
                className="form-control"
                value={emailConfig.host}
                onChange={(event) => updateEmailConfig('host', event.target.value)}
                placeholder="mail.empresa.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-port">Puerto</label>
              <input
                id="email-port"
                type="number"
                className="form-control"
                value={emailConfig.port}
                onChange={(event) => updateEmailConfig('port', event.target.value)}
                placeholder="993"
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-user">Usuario</label>
              <input
                id="email-user"
                type="text"
                className="form-control"
                value={emailConfig.user}
                onChange={(event) => updateEmailConfig('user', event.target.value)}
                placeholder="esg@empresa.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-password">Contraseña</label>
              <input
                id="email-password"
                type="password"
                className="form-control"
                value={emailConfig.password}
                onChange={(event) => updateEmailConfig('password', event.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-mailbox">Carpeta</label>
              <input
                id="email-mailbox"
                type="text"
                className="form-control"
                value={emailConfig.mailbox}
                onChange={(event) => updateEmailConfig('mailbox', event.target.value)}
                placeholder="INBOX/ESG"
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-subject">Filtrar por asunto</label>
              <input
                id="email-subject"
                type="text"
                className="form-control"
                value={emailConfig.subject}
                onChange={(event) => updateEmailConfig('subject', event.target.value)}
                placeholder="Reporte ESG"
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-from">Filtrar remitente</label>
              <input
                id="email-from"
                type="text"
                className="form-control"
                value={emailConfig.from}
                onChange={(event) => updateEmailConfig('from', event.target.value)}
                placeholder="reportes@empresa.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-since">Días a revisar</label>
              <input
                id="email-since"
                type="number"
                className="form-control"
                value={emailConfig.sinceDays}
                onChange={(event) => updateEmailConfig('sinceDays', event.target.value)}
                placeholder="30"
                min="1"
              />
            </div>
          </div>
        </div>

        <div className="ingestion-card">
          <div className="ingestion-card__header">
            <h4>
              <HiOutlineLink aria-hidden="true" /> APIs internas
            </h4>
            <button type="button" className="ghost-button" onClick={handleAddApiSource}>
              <HiOutlinePlus aria-hidden="true" /> Añadir endpoint
            </button>
          </div>
          <p className="ingestion-card__description">
            Apunta a servicios internos para recuperar métricas de energía, RRHH, cumplimiento o cadena de suministro.
          </p>
          {apiSources.length === 0 ? (
            <p className="ingestion-empty">Agrega endpoints REST o GraphQL para sincronizar datos automáticamente.</p>
          ) : (
            <ul className="ingestion-api-list">
              {apiSources.map((source) => (
                <li key={source.id}>
                  <div className="ingestion-api-grid">
                    <div className="form-field">
                      <label htmlFor={`api-url-${source.id}`}>URL</label>
                      <input
                        id={`api-url-${source.id}`}
                        type="url"
                        className="form-control"
                        value={source.url}
                        onChange={(event) => handleUpdateApiSource(source.id, 'url', event.target.value)}
                        placeholder="https://api.empresa.com/esg"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`api-method-${source.id}`}>Método</label>
                      <select
                        id={`api-method-${source.id}`}
                        className="form-control"
                        value={source.method}
                        onChange={(event) => handleUpdateApiSource(source.id, 'method', event.target.value)}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor={`api-format-${source.id}`}>Formato</label>
                      <select
                        id={`api-format-${source.id}`}
                        className="form-control"
                        value={source.format}
                        onChange={(event) => handleUpdateApiSource(source.id, 'format', event.target.value)}
                      >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor={`api-name-${source.id}`}>Alias</label>
                      <input
                        id={`api-name-${source.id}`}
                        type="text"
                        className="form-control"
                        value={source.name ?? ''}
                        onChange={(event) => handleUpdateApiSource(source.id, 'name', event.target.value)}
                        placeholder="Portal energía"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`api-data-${source.id}`}>Ruta de datos</label>
                      <input
                        id={`api-data-${source.id}`}
                        type="text"
                        className="form-control"
                        value={source.dataPath ?? ''}
                        onChange={(event) => handleUpdateApiSource(source.id, 'dataPath', event.target.value)}
                        placeholder="payload.items"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`api-body-${source.id}`}>Body (JSON)</label>
                      <textarea
                        id={`api-body-${source.id}`}
                        rows={3}
                        className="form-control"
                        value={source.body ?? ''}
                        onChange={(event) => handleUpdateApiSource(source.id, 'body', event.target.value)}
                        placeholder='{ "period": "2024" }'
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => handleRemoveApiSource(source.id)}
                  >
                    Quitar endpoint
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="ingestion-status">
        <div className="ingestion-status__column">
          <h4>
            <HiOutlineCheckCircle aria-hidden="true" /> Últimas ejecuciones
          </h4>
          {runs.length === 0 ? (
            <p className="ingestion-empty">Todavía no hay ejecuciones registradas para esta empresa.</p>
          ) : (
            <ul className="ingestion-run-list">
              {runs.map((run) => (
                <li key={run.id}>
                  <div>
                    <span className={`badge badge-${statusTone(run.status)}`}>{translateStatus(run.status)}</span>
                    <strong>{run.summary ?? 'Ingesta completada'}</strong>
                    <small>
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Fecha no disponible'} ·
                      {run.period ? ` Periodo ${run.period}` : ' Periodo no indicado'}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ingestion-status__column">
          <h4>
            <HiOutlineBellAlert aria-hidden="true" /> Alertas activas
          </h4>
          {alerts.length === 0 ? (
            <p className="ingestion-empty">Sin alertas pendientes. Los indicadores están en orden.</p>
          ) : (
            <ul className="ingestion-alert-list">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <div>
                    <strong>{humanizeIndicator(alert.indicator)}</strong>
                    <p>{alert.message}</p>
                    <small>{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : ''}</small>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleResolveAlert(alert.id)}
                  >
                    Marcar como resuelta
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function defaultEmailConfig() {
  return {
    host: '',
    port: '993',
    user: '',
    password: '',
    mailbox: 'INBOX',
    subject: '',
    from: '',
    sinceDays: '30',
  };
}

function hasEmailConfig(config) {
  return Boolean(config?.host && config?.user && config?.password);
}

function sanitizeEmailPayload(config) {
  return {
    host: config.host,
    port: Number(config.port) || 993,
    user: config.user,
    password: config.password,
    mailbox: config.mailbox || 'INBOX',
    subject: config.subject || undefined,
    from: config.from || undefined,
    sinceDays: config.sinceDays ? Number(config.sinceDays) : undefined,
  };
}

function humanizeIndicator(indicator) {
  if (!indicator) return 'Indicador ESG';
  const dictionary = {
    energiaKwh: 'Energía (kWh)',
    emisionesCO2: 'Emisiones de CO₂e',
    cumplimientoNormativo: 'Cumplimiento normativo',
  };
  return dictionary[indicator] ?? indicator;
}

function generateClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `api-${Math.random().toString(36).slice(2, 10)}`;
}

function statusTone(status) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'completed-with-alerts':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function translateStatus(status) {
  switch (status) {
    case 'completed':
      return 'Completada';
    case 'completed-with-alerts':
      return 'Completada con alertas';
    case 'failed':
      return 'Fallida';
    case 'processing':
      return 'En proceso';
    default:
      return status;
  }
}
