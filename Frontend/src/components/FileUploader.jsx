import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeAiFiles,
  deleteAiInsight,
  fetchAiInsights,
} from '../services/api.js';

const CATEGORY_COLORS = {
  Ambiental: 'chip-ambiental',
  Social: 'chip-social',
  Gobernanza: 'chip-gobernanza',
};

export default function FileUploader({ companyId, period }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState([]);
  const [insights, setInsights] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState(null);

  const canUpload = useMemo(() => Boolean(companyId), [companyId]);

  const refreshInsights = useCallback(async () => {
    if (!companyId) {
      setInsights([]);
      setSummary(null);
      return;
    }
    setLoadingInsights(true);
    setError(null);
    try {
      const { items = [], summary: remoteSummary = null } = await fetchAiInsights({ companyId, period });
      setInsights(items);
      setSummary(remoteSummary);
    } catch (err) {
      setError(err.message ?? 'No se pudieron cargar las evidencias analizadas.');
    } finally {
      setLoadingInsights(false);
    }
  }, [companyId, period]);

  useEffect(() => {
    refreshInsights();
  }, [refreshInsights]);

  useEffect(() => {
    setQueue([]);
    setError(null);
  }, [companyId]);

  const handleFiles = useCallback(
    async (fileList) => {
      if (!canUpload) {
        setError('Selecciona primero la empresa y el periodo del reporte.');
        return;
      }
      const files = Array.from(fileList ?? []).filter(Boolean);
      if (!files.length) {
        return;
      }

      const pending = files.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        fileName: file.name,
        status: 'processing',
      }));
      setQueue((prev) => [...pending, ...prev]);
      setLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        formData.append('companyId', companyId);
        if (period) {
          formData.append('period', period);
        }

        const response = await analyzeAiFiles(formData);
        const results = (response?.items ?? []).map((item, index) => ({
          id: pending[index]?.id ?? `${Date.now()}-${index}`,
          fileName: item.fileName ?? pending[index]?.fileName ?? `Archivo ${index + 1}`,
          status: item.status ?? 'processed',
          category: item.category ?? null,
          summary: item.summary ?? null,
          error: item.error ?? null,
        }));

        setQueue((prev) => {
          const remaining = prev.filter((entry) => !pending.some((pendingEntry) => pendingEntry.id === entry.id));
          return [...results, ...remaining];
        });
        await refreshInsights();
      } catch (err) {
        const message = err.message ?? 'No se pudo analizar la evidencia con IA.';
        setError(message);
        setQueue((prev) =>
          prev.map((entry) =>
            pending.some((pendingEntry) => pendingEntry.id === entry.id)
              ? { ...entry, status: 'failed', error: message }
              : entry,
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [canUpload, companyId, period, refreshInsights],
  );

  function handleInputChange(event) {
    handleFiles(event.target.files);
    event.target.value = '';
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (!canUpload) return;
    setDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!canUpload) return;
    handleFiles(event.dataTransfer.files);
  }

  function handleBrowseClick() {
    if (!canUpload) {
      setError('Selecciona primero la empresa y el periodo del reporte.');
      return;
    }
    inputRef.current?.click();
  }

  async function handleRemoveInsight(id) {
    if (!window.confirm('¿Deseas eliminar este análisis IA del reporte?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteAiInsight(id, { companyId });
      await refreshInsights();
    } catch (err) {
      setError(err.message ?? 'No se pudo eliminar el análisis seleccionado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="file-uploader card">
      <div className="file-uploader__header">
        <div>
          <h3>Evidencias cargadas con IA</h3>
          <p>
            Sube documentos ESG (Excel, PDF, Word, imágenes o texto) para que la plataforma extraiga indicadores y los integre
            en el reporte actual.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={handleBrowseClick} disabled={!canUpload || loading}>
          {loading ? 'Procesando...' : 'Seleccionar archivos'}
        </button>
      </div>

      <div
        className={`file-dropzone ${dragging ? 'is-dragging' : ''} ${!canUpload ? 'is-disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          hidden
          accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.tsv,.txt,.json,.png,.jpg,.jpeg"
        />
        <div>
          <strong>Arrastra tus archivos ESG aquí</strong>
          <span>o haz clic para explorar</span>
        </div>
        <small>Formatos soportados: PDF, Word, Excel, CSV, TXT, PNG, JPG y más.</small>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {queue.length > 0 && (
        <div className="upload-queue">
          <h4>Últimos archivos procesados</h4>
          <ul>
            {queue.map((item) => (
              <li key={item.id} className={`status-${item.status}`}>
                <div>
                  <strong>{item.fileName}</strong>
                  {item.category && <span className={`chip ${CATEGORY_COLORS[item.category] ?? ''}`}>{item.category}</span>}
                </div>
                <p>
                  {item.status === 'failed'
                    ? item.error ?? 'No se pudo analizar el archivo.'
                    : item.summary ?? 'Archivo en análisis'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="evidence-summary">
        {loadingInsights ? (
          <p className="placeholder">Actualizando evidencias...</p>
        ) : summary ? (
          <p>{summary}</p>
        ) : (
          <p className="placeholder">Aún no hay conclusiones generadas a partir de archivos cargados.</p>
        )}
      </div>

      <div className="insights-list">
        <h4>Evidencias analizadas</h4>
        {insights.length === 0 ? (
          <p className="placeholder">Todavía no se registran evidencias para este periodo.</p>
        ) : (
          <ul>
            {insights.map((insight) => (
              <li key={insight.id}>
                <header>
                  <div>
                    <span className={`chip ${CATEGORY_COLORS[insight.category] ?? ''}`}>
                      {insight.category ?? 'General'}
                    </span>
                    <strong>{insight.fileName}</strong>
                  </div>
                  <time>{insight.analyzedAt ? new Date(insight.analyzedAt).toLocaleDateString('es-UY') : 'Sin fecha'}</time>
                </header>
                <p>{insight.summary ?? 'Sin resumen disponible.'}</p>
                {renderIndicators(insight.indicators)}
                <button
                  type="button"
                  className="link-button danger"
                  onClick={() => handleRemoveInsight(insight.id)}
                  disabled={loading}
                >
                  Eliminar análisis
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function renderIndicators(indicators) {
  if (!indicators || Object.keys(indicators).length === 0) {
    return null;
  }
  return (
    <ul className="insight-indicators">
      {Object.entries(indicators).map(([key, value]) => (
        <li key={key}>
          <strong>{indicatorLabel(key)}:</strong> {formatIndicatorValue(value)}
        </li>
      ))}
    </ul>
  );
}

function indicatorLabel(key) {
  const dictionary = {
    energiaKwh: 'Consumo energético (kWh)',
    emisionesCO2: 'Emisiones de CO₂e',
    aguaM3: 'Consumo de agua (m³)',
    reciclajePorc: 'Tasa de reciclaje %',
    residuosPeligrososTon: 'Residuos peligrosos (t)',
    porcentajeMujeres: 'Participación femenina %',
    horasCapacitacion: 'Horas de capacitación',
    accidentesLaborales: 'Accidentes laborales',
    cumplimientoNormativo: 'Cumplimiento normativo %',
    auditoriasCompliance: 'Auditorías de compliance',
    reunionesStakeholders: 'Reuniones con stakeholders',
  };
  return dictionary[key] ?? key;
}

function formatIndicatorValue(value) {
  if (value == null) {
    return 'Sin dato';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return String(value);
}
