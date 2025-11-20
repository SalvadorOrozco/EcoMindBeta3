import { useId, useState } from 'react';
import {
  confirmImportIndicators,
  previewImportIndicators,
} from '../services/api.js';

export default function BulkImportDialog({ companyId, open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputId = useId();

  if (!open) return null;

  async function handlePreview(event) {
    event.preventDefault();
    if (!file) {
      setError('Selecciona un archivo CSV o Excel.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (companyId) {
        formData.append('companyId', companyId);
      }
      const data = await previewImportIndicators(formData);
      setPreview(data);
    } catch (err) {
      setError(err.message ?? 'No se pudo procesar el archivo');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview?.preview) return;
    setLoading(true);
    setError(null);
    try {
      const sanitized = Object.fromEntries(
        Object.entries(preview.preview).map(([type, rows]) => [
          type,
          rows.map(({ __source, __index, ...rest }) => rest),
        ]),
      );
      await confirmImportIndicators(sanitized);
      onImported?.();
      handleClose();
    } catch (err) {
      setError(err.message ?? 'No se pudo confirmar la importación');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFile(null);
    setPreview(null);
    setError(null);
    onClose?.();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bulk-import-title">
      <div className="modal-content">
        <header className="modal-header">
          <h3 id="bulk-import-title">Importar indicadores ESG</h3>
          <button type="button" onClick={handleClose} aria-label="Cerrar" className="icon-button">
            ×
          </button>
        </header>
        <form onSubmit={handlePreview} className="modal-body">
          <p>
            Selecciona un archivo Excel o CSV con columnas compatibles (tipo, companyId, period, métricas). Podrás validar la
            vista previa antes de guardar definitivamente.
          </p>
          <div className="form-field">
            <label htmlFor={fileInputId}>Archivo de indicadores</label>
            <input
              id={fileInputId}
              type="file"
              className="form-control"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {preview && (
            <div className="preview-table" aria-live="polite">
              <h4>Vista previa ({preview.totals} filas)</h4>
              {Object.entries(preview.preview).map(([type, rows]) => (
                <div key={type} className="preview-group">
                  <strong>{mapType(type)}:</strong>
                  <span>{rows.length} registros listos para importar</span>
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">Fila</th>
                          <th scope="col">Periodo</th>
                          <th scope="col">Empresa</th>
                          <th scope="col">Fuente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((row, index) => (
                          <tr key={`${type}-${index}`}>
                            <td>{row.__index ?? '—'}</td>
                            <td>{row.period}</td>
                            <td>{row.companyId}</td>
                            <td>{row.__source ?? 'archivo'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && <p>... {rows.length - 5} registros adicionales</p>}
                </div>
              ))}
            </div>
          )}
        </form>
        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={handleClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={preview ? handleConfirm : handlePreview}
            disabled={loading}
          >
            {loading ? 'Procesando...' : preview ? 'Confirmar importación' : 'Generar vista previa'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function mapType(type) {
  switch (type) {
    case 'environmental':
      return 'Ambiental';
    case 'social':
      return 'Social';
    case 'governance':
      return 'Gobernanza';
    default:
      return type;
  }
}
