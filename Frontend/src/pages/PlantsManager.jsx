import { useEffect, useId, useMemo, useState } from 'react';
import { z } from 'zod';
import CompanySelector from '../components/CompanySelector.jsx';
import Notification from '../components/Notification.jsx';
import {
  createPlant,
  deletePlant,
  fetchCompanyPlantReport,
  fetchPlantReport,
  fetchPlants,
} from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';

const coordinateSchema = (min, max, emptyMessage, rangeMessage) =>
  z
    .string({ required_error: emptyMessage })
    .trim()
    .min(1, emptyMessage)
    .refine((value) => !Number.isNaN(Number(value)), { message: rangeMessage })
    .transform((value) => Number(value))
    .refine((value) => value >= min && value <= max, { message: rangeMessage });

const plantSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(3, 'Debe tener al menos 3 caracteres')
    .max(120, 'Máximo 120 caracteres'),
  latitude: coordinateSchema(-90, 90, 'Ingresa la latitud de la planta', 'La latitud debe estar entre -90 y 90'),
  longitude: coordinateSchema(
    -180,
    180,
    'Ingresa la longitud de la planta',
    'La longitud debe estar entre -180 y 180',
  ),
  location: z
    .string()
    .trim()
    .max(200, 'Máximo 200 caracteres')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .trim()
    .max(255, 'Máximo 255 caracteres')
    .optional()
    .or(z.literal('')),
});

const initialForm = {
  name: '',
  latitude: '',
  longitude: '',
  location: '',
  description: '',
};

export default function PlantsManager() {
  const { company } = useCompany();
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const plantFormPrefix = useId();
  const fieldId = (name) => `${plantFormPrefix}-${name}`;

  useEffect(() => {
    if (!company) {
      setPlants([]);
      setReport(null);
      return;
    }
    loadPlants(company.id);
    setReport(null);
  }, [company]);

  async function loadPlants(companyId) {
    setLoading(true);
    try {
      const data = await fetchPlants(companyId);
      setPlants(data);
    } catch (error) {
      setToast({ type: 'error', message: error.message ?? 'No se pudieron cargar las plantas.' });
      setPlants([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!company) {
      setToast({ type: 'warning', message: 'Selecciona una empresa antes de crear plantas.' });
      return;
    }

    try {
      const parsed = plantSchema.parse(form);
      const payload = {
        ...parsed,
        location: parsed.location?.trim() ? parsed.location.trim() : undefined,
        description: parsed.description?.trim() ? parsed.description.trim() : undefined,
        companyId: company.id,
      };
      setFormErrors({});
      const plant = await createPlant(payload);
      setPlants((prev) => [plant, ...prev]);
      setForm(initialForm);
      setToast({ type: 'success', message: 'Planta creada correctamente.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = {};
        error.errors.forEach((issue) => {
          const [key] = issue.path;
          fieldErrors[key] = issue.message;
        });
        setFormErrors(fieldErrors);
      } else {
        setToast({ type: 'error', message: error.message ?? 'No se pudo crear la planta.' });
      }
    }
  }

  async function handleDelete(plantId) {
    if (!company) return;
    const plant = plants.find((item) => item.id === plantId);
    if (!plant) return;
    const confirmation = window.confirm(
      `¿Eliminar la planta "${plant.name}"? Esta acción no se puede deshacer y requiere eliminar los indicadores asociados previamente.`,
    );
    if (!confirmation) return;

    try {
      await deletePlant(plantId);
      setPlants((prev) => prev.filter((item) => item.id !== plantId));
      if (report?.type === 'plant' && report?.plant?.id === plantId) {
        setReport(null);
      }
      setToast({ type: 'info', message: 'Planta eliminada correctamente.' });
    } catch (error) {
      setToast({ type: 'error', message: error.message ?? 'No se pudo eliminar la planta.' });
    }
  }

  async function handlePlantReport(plantId) {
    if (!company) return;
    setReportLoading(true);
    try {
      const data = await fetchPlantReport(plantId, company.id);
      setReport({ type: 'plant', ...data });
    } catch (error) {
      setToast({ type: 'error', message: error.message ?? 'No se pudo generar el reporte de la planta.' });
    } finally {
      setReportLoading(false);
    }
  }

  async function handleCompanyReport() {
    if (!company) return;
    setReportLoading(true);
    try {
      const data = await fetchCompanyPlantReport(company.id);
      setReport({ type: 'company', ...data });
    } catch (error) {
      setToast({ type: 'error', message: error.message ?? 'No se pudo generar el reporte consolidado.' });
    } finally {
      setReportLoading(false);
    }
  }

  const reportSummary = useMemo(() => {
    if (!report) return null;
    return report.summary ?? null;
  }, [report]);

  return (
    <div className="plants-page">
      <div className="page-header">
        <div>
          <h2>Gestión de plantas e instalaciones</h2>
          <p>Organiza tus operaciones por planta y accede a reportes ESG específicos o consolidados.</p>
        </div>
        {company ? (
          <button type="button" className="secondary-button" onClick={handleCompanyReport} disabled={reportLoading}>
            Ver reporte consolidado
          </button>
        ) : null}
      </div>

      <CompanySelector />

      {toast && <Notification type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {company ? (
        <div className="plants-grid">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Nueva planta</h3>
                <p className="muted">Registra instalaciones para segmentar tus indicadores ESG por ubicación.</p>
              </div>
            </div>
            <form className="indicator-form" onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor={fieldId('name')}>Nombre de la planta</label>
                <input
                  id={fieldId('name')}
                  className="form-control"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Planta Lima"
                />
                {formErrors.name ? <span className="field-error">{formErrors.name}</span> : null}
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor={fieldId('latitude')}>Latitud</label>
                  <input
                    id={fieldId('latitude')}
                    className="form-control"
                    name="latitude"
                    type="number"
                    step="0.000001"
                    value={form.latitude}
                    onChange={handleChange}
                    placeholder="-12.046374"
                  />
                  {formErrors.latitude ? <span className="field-error">{formErrors.latitude}</span> : null}
                </div>
                <div className="form-field">
                  <label htmlFor={fieldId('longitude')}>Longitud</label>
                  <input
                    id={fieldId('longitude')}
                    className="form-control"
                    name="longitude"
                    type="number"
                    step="0.000001"
                    value={form.longitude}
                    onChange={handleChange}
                    placeholder="-77.042793"
                  />
                  {formErrors.longitude ? <span className="field-error">{formErrors.longitude}</span> : null}
                </div>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor={fieldId('location')}>Ubicación (opcional)</label>
                  <input
                    id={fieldId('location')}
                    className="form-control"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Avenida Industrial 123"
                  />
                  {formErrors.location ? <span className="field-error">{formErrors.location}</span> : null}
                </div>
                <div className="form-field">
                  <label htmlFor={fieldId('description')}>Descripción (opcional)</label>
                  <input
                    id={fieldId('description')}
                    className="form-control"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Centro de operaciones principales"
                  />
                  {formErrors.description ? <span className="field-error">{formErrors.description}</span> : null}
                </div>
              </div>
              <button className="primary-button" type="submit">
                Guardar planta
              </button>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Plantas registradas</h3>
                <p className="muted">Gestiona las plantas asociadas a la empresa seleccionada.</p>
              </div>
            </div>
            {loading ? (
              <div className="table-empty">Cargando plantas...</div>
            ) : plants.length === 0 ? (
              <div className="table-empty">No se encontraron plantas registradas.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Ubicación</th>
                      <th>Coordenadas</th>
                      <th>Descripción</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plants.map((plant) => (
                      <tr key={plant.id}>
                        <td>
                          <strong>{plant.name}</strong>
                          {plant.createdAt ? (
                            <p className="muted">Registrada el {new Date(plant.createdAt).toLocaleDateString()}</p>
                          ) : null}
                        </td>
                        <td>{plant.location ?? '—'}</td>
                        <td>
                          {plant.latitude != null && plant.longitude != null ? (
                            <div className="coordinate-stack">
                              <span>Lat: {formatCoordinate(plant.latitude)}</span>
                              <span>Lon: {formatCoordinate(plant.longitude)}</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{plant.description ?? '—'}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handlePlantReport(plant.id)}
                              disabled={reportLoading}
                            >
                              Ver reporte
                            </button>
                            <button type="button" className="link-button danger" onClick={() => handleDelete(plant.id)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="alert alert-warning">Selecciona o asigna una empresa para comenzar.</div>
      )}

      {report ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>
                {report.type === 'company'
                  ? 'Reporte ESG consolidado'
                  : `Reporte ESG de la planta ${report.plant?.name ?? ''}`}
              </h3>
              <p className="muted">
                {report.type === 'company'
                  ? 'Resultados agregados considerando todas las plantas registradas.'
                  : 'Indicadores y promedios específicos de la planta seleccionada.'}
              </p>
            </div>
            <div className={`score-chip score-chip--${scoreTone(reportSummary?.esgScore)}`}>
              ESG Score: {formatNumber(reportSummary?.esgScore)}
            </div>
          </div>

          {reportLoading ? (
            <div className="table-empty">Generando reporte...</div>
          ) : report.type === 'company' ? (
            <CompanyReportDetails report={report} />
          ) : (
            <PlantReportDetails report={report} />
          )}
        </section>
      ) : null}
    </div>
  );
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2);
}

function formatCoordinate(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(5);
}

function scoreTone(score) {
  if (score == null) return 'unknown';
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function SummaryTable({ summary }) {
  if (!summary) return null;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Pilar</th>
          <th>Total</th>
          <th>Promedio</th>
          <th>Indicadores</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(summary.categories ?? {}).map(([key, stats]) => (
          <tr key={key}>
            <td>{categoryLabel(key)}</td>
            <td>{formatNumber(stats.total)}</td>
            <td>{formatNumber(stats.average)}</td>
            <td>{stats.count}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th>Total general</th>
          <th>{formatNumber(summary.overall?.total)}</th>
          <th>{formatNumber(summary.overall?.average)}</th>
          <th>{summary.overall?.count ?? 0}</th>
        </tr>
      </tfoot>
    </table>
  );
}

function PlantReportDetails({ report }) {
  const { summary, indicators, plant } = report;
  return (
    <div className="report-grid">
      <div className="report-summary">
        <h4>Resumen de {plant?.name}</h4>
        <SummaryTable summary={summary} />
      </div>
      <div className="report-indicators">
        <h4>Indicadores asociados</h4>
        {indicators?.length ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Pilar</th>
                  <th>Valor</th>
                  <th>Periodo</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((indicator) => (
                  <tr key={indicator.id}>
                    <td>{indicator.name}</td>
                    <td>{categoryLabel(indicator.category)}</td>
                    <td>{formatNumber(indicator.value)}</td>
                    <td>{indicator.period ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty">La planta no tiene indicadores registrados.</div>
        )}
      </div>
    </div>
  );
}

function CompanyReportDetails({ report }) {
  const { summary, plants } = report;
  return (
    <div className="report-grid">
      <div className="report-summary">
        <h4>Totales consolidados</h4>
        <SummaryTable summary={summary} />
      </div>
      <div className="report-indicators">
        <h4>Detalle por planta</h4>
        {plants?.length ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Planta</th>
                  <th>Ubicación</th>
                  <th>ESG Score</th>
                  <th>Indicadores</th>
                </tr>
              </thead>
              <tbody>
                {plants.map((item) => (
                  <tr key={item.plant.id}>
                    <td>{item.plant.name}</td>
                    <td>{item.plant.location ?? '—'}</td>
                    <td>{formatNumber(item.summary?.esgScore)}</td>
                    <td>{item.summary?.overall?.count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty">No hay plantas registradas en la empresa.</div>
        )}
      </div>
    </div>
  );
}

function categoryLabel(key) {
  switch (key) {
    case 'environmental':
      return 'Ambiental';
    case 'social':
      return 'Social';
    case 'governance':
      return 'Gobernanza';
    default:
      return key;
  }
}
