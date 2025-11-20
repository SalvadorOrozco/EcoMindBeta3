import { useEffect, useId, useState } from 'react';
import {
  buildEvidenceDownloadUrl,
  deleteEvidence,
  listEvidence,
  uploadEvidenceFile,
} from '../services/api.js';

export default function EvidenceManager({ companyId, period, type, indicators = [] }) {
  const [files, setFiles] = useState([]);
  const [selectedIndicator, setSelectedIndicator] = useState(indicators?.[0]?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const selectorId = useId();

  useEffect(() => {
    setSelectedIndicator(indicators?.[0]?.name ?? '');
  }, [indicators]);

  useEffect(() => {
    if (!companyId || !period || !type) return;
    let mounted = true;
    async function load() {
      setError(null);
      try {
        const data = await listEvidence({ companyId, period, type });
        if (mounted) {
          setFiles(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message ?? 'No se pudieron cargar las evidencias');
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [companyId, period, type]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedIndicator) {
      setError('Selecciona un indicador antes de subir la evidencia.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('period', period);
      formData.append('type', type);
      formData.append('indicator', selectedIndicator);
      await uploadEvidenceFile(formData);
      const data = await listEvidence({ companyId, period, type });
      setFiles(data);
    } catch (err) {
      setError(err.message ?? 'No se pudo subir la evidencia');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Deseas eliminar esta evidencia?')) return;
    setLoading(true);
    try {
      await deleteEvidence(id);
      setFiles((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message ?? 'No se pudo eliminar la evidencia');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="evidence-card">
      <div className="evidence-header">
        <h4>Evidencias asociadas</h4>
        <div className="evidence-actions">
          <label className="sr-only" htmlFor={selectorId}>
            Indicador asociado
          </label>
          <select
            id={selectorId}
            className="form-control"
            value={selectedIndicator}
            onChange={(event) => setSelectedIndicator(event.target.value)}
          >
            {indicators.map((indicator) => (
              <option key={indicator.name} value={indicator.name}>
                {indicator.label}
              </option>
            ))}
          </select>
          <label className="secondary-button file-button">
            {loading ? 'Subiendo...' : 'Adjuntar archivo'}
            <input type="file" onChange={handleUpload} disabled={loading} hidden />
          </label>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {files.length === 0 ? (
        <p className="evidence-empty">Aún no hay evidencias cargadas para este bloque.</p>
      ) : (
        <ul className="evidence-list">
          {files.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.fileName}</strong>
                <span>{indicatorLabel(indicators, item.indicator)}</span>
              </div>
              <div className="evidence-actions">
                <a href={buildEvidenceDownloadUrl(item.id)} target="_blank" rel="noreferrer" className="link-button">
                  Ver
                </a>
                <button type="button" onClick={() => handleDelete(item.id)} disabled={loading} className="danger-button">
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function indicatorLabel(indicators, value) {
  const found = indicators.find((item) => item.name === value);
  return found ? found.label : value ?? 'Indicador general';
}
