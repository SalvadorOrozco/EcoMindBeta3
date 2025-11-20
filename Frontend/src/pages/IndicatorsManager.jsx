import { useEffect, useId, useMemo, useState } from 'react';
import { z } from 'zod';
import CompanySelector from '../components/CompanySelector.jsx';
import Notification from '../components/Notification.jsx';
import {
  createCustomIndicator,
  deleteCustomIndicator,
  fetchCustomIndicators,
  fetchPlants,
} from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';

const indicatorSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(3, 'Debe tener al menos 3 caracteres')
    .max(120, 'Máximo 120 caracteres'),
  plantId: z.coerce
    .number({ invalid_type_error: 'Selecciona una planta' })
    .int('Selecciona una planta')
    .positive('Selecciona una planta'),
  category: z.enum(['environmental', 'social', 'governance']),
  value: z.coerce.number().min(0, 'Debe ser mayor o igual a 0').max(100, 'No puede superar 100'),
  period: z
    .string()
    .trim()
    .min(2, 'Debe tener al menos 2 caracteres')
    .max(10, 'Máximo 10 caracteres')
    .optional()
    .or(z.literal('')),
  unit: z
    .string()
    .trim()
    .max(20, 'Máximo 20 caracteres')
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
  plantId: '',
  category: 'environmental',
  value: '',
  period: '',
  unit: '',
  description: '',
};

export default function IndicatorsManager() {
  const { company } = useCompany();
  const [indicators, setIndicators] = useState([]);
  const [esgScore, setEsgScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [plantsLoading, setPlantsLoading] = useState(false);

  useEffect(() => {
    setIndicators([]);
    setEsgScore(null);
    setPlants([]);
    setSelectedPlantId('');
    setForm(initialForm);
    setFormErrors({});
    setPlantsLoading(false);
    if (!company) {
      return;
    }
    loadPlants(company.id);
  }, [company]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, plantId: selectedPlantId }));
  }, [selectedPlantId]);

  async function loadPlants(companyId) {
    setPlantsLoading(true);
    try {
      const plantList = await fetchPlants(companyId);
      setPlants(plantList);
      if (plantList.length === 0) {
        setSelectedPlantId('');
        setIndicators([]);
        setEsgScore(null);
        return;
      }
      const defaultPlantId = plantList.find((item) => String(item.id) === selectedPlantId)
        ? selectedPlantId
        : String(plantList[0].id);
      setSelectedPlantId(defaultPlantId);
      await loadIndicators(defaultPlantId);
    } catch (error) {
      setToast({
        type: 'error',
        message: error.message ?? 'No se pudieron cargar las plantas de la empresa seleccionada.',
      });
      setPlants([]);
      setSelectedPlantId('');
      setIndicators([]);
      setEsgScore(null);
    } finally {
      setPlantsLoading(false);
    }
  }

  async function loadIndicators(plantIdValue = selectedPlantId) {
    if (!company) return;
    const numericPlantId = Number(plantIdValue);
    if (!Number.isSafeInteger(numericPlantId) || numericPlantId <= 0) {
      setIndicators([]);
      setEsgScore(null);
      return;
    }
    setLoading(true);
    try {
      const response = await fetchCustomIndicators(company.id, numericPlantId);
      setIndicators(response.items ?? []);
      setEsgScore(response.esgScore ?? null);
    } catch (error) {
      setToast({ type: 'error', message: error.message ?? 'No se pudieron cargar los indicadores.' });
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
      setToast({ type: 'warning', message: 'Selecciona una empresa antes de crear indicadores.' });
      return;
    }

    if (!selectedPlantId) {
      setToast({ type: 'warning', message: 'Crea y selecciona una planta antes de registrar indicadores.' });
      return;
    }

    try {
      const parsed = indicatorSchema.parse(form);
      const payload = {
        ...parsed,
        plantId: parsed.plantId,
        period: parsed.period?.trim() ? parsed.period.trim() : undefined,
        unit: parsed.unit?.trim() ? parsed.unit.trim() : undefined,
        description: parsed.description?.trim() ? parsed.description.trim() : undefined,
        companyId: company.id,
      };
      setFormErrors({});
      const response = await createCustomIndicator(payload);
      setIndicators((prev) => [response.indicator, ...prev]);
      setEsgScore(response.esgScore ?? null);
      setForm({ ...initialForm, category: form.category, plantId: selectedPlantId });
      setToast({ type: 'success', message: 'Indicador creado correctamente. El puntaje del mapa se actualizó.' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = {};
        error.errors.forEach((issue) => {
          const [key] = issue.path;
          fieldErrors[key] = issue.message;
        });
        setFormErrors(fieldErrors);
      } else {
        setToast({ type: 'error', message: error.message ?? 'No se pudo crear el indicador.' });
      }
    }
  }

  async function handleDelete(indicatorId) {
    if (!company) return;
    try {
      const response = await deleteCustomIndicator(indicatorId, company.id);
      setIndicators((prev) => prev.filter((item) => item.id !== indicatorId));
      setEsgScore(response.esgScore ?? null);
      setToast({ type: 'info', message: 'Indicador eliminado. El mapa fue actualizado.' });
    } catch (error) {
      setToast({ type: 'error', message: error.message ?? 'No se pudo eliminar el indicador.' });
    }
  }

  async function handlePlantChange(event) {
    const value = event.target.value;
    setSelectedPlantId(value);
    if (value) {
      await loadIndicators(value);
    } else {
      setIndicators([]);
      setEsgScore(null);
    }
  }

  const groupedIndicators = useMemo(() => {
    const groups = {
      environmental: [],
      social: [],
      governance: [],
    };
    indicators.forEach((indicator) => {
      groups[indicator.category]?.push(indicator);
    });
    return groups;
  }, [indicators]);

  return (
    <div className="indicators-page">
      <div className="page-header">
        <div>
          <h2>Gestión de indicadores ESG</h2>
          <p>Administra indicadores personalizados por empresa y sincroniza el puntaje del mapa.</p>
        </div>
      </div>

      <CompanySelector />

      {plantsLoading ? (
        <div className="alert alert-info">Cargando plantas de la empresa...</div>
      ) : plants.length > 0 ? (
        <div className="selector-bar">
          <div className="selector-field">
            <label className="selector-field__label" htmlFor="plant-selector">
              Planta
            </label>
            <select
              id="plant-selector"
              className="selector-field__input"
              value={selectedPlantId}
              onChange={handlePlantChange}
            >
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="alert alert-warning">
          Esta empresa aún no tiene plantas registradas. Crea una planta antes de gestionar indicadores.
        </div>
      )}

      {toast && <Notification type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {company ? (
        <div className="indicators-grid">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Crear indicador</h3>
                <p className="muted">Los valores deben estar entre 0 y 100 para mantener comparabilidad ESG.</p>
              </div>
            </div>
            <form className="indicator-form" onSubmit={handleSubmit}>
              <IndicatorFormFields
                disabled={plants.length === 0}
                form={form}
                formErrors={formErrors}
                handleChange={handleChange}
                plants={plants}
              />
              <button className="primary-button" type="submit" disabled={plants.length === 0}>
                Guardar indicador
              </button>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Indicadores registrados</h3>
                <p className="muted">Se muestran los indicadores personalizados de la empresa seleccionada.</p>
              </div>
              <div className={`score-chip score-chip--${scoreTone(esgScore)}`}>
                Puntaje ESG: {esgScore != null ? esgScore.toFixed?.(2) ?? esgScore : 'Sin datos'}
              </div>
            </div>
            {loading ? (
              <div className="table-empty">Cargando indicadores...</div>
            ) : indicators.length === 0 ? (
              <div className="table-empty">Aún no hay indicadores registrados para esta planta.</div>
            ) : (
              <div className="indicator-table">
                {['environmental', 'social', 'governance'].map((categoryKey) => (
                  <div key={categoryKey} className="indicator-block">
                    <h4>{categoryLabel(categoryKey)}</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Indicador</th>
                          <th>Valor</th>
                          <th>Periodo</th>
                          <th>Unidad</th>
                          <th>Planta</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedIndicators[categoryKey]?.length ? (
                          groupedIndicators[categoryKey].map((indicator) => (
                            <tr key={indicator.id}>
                              <td>
                                <strong>{indicator.name}</strong>
                                {indicator.description ? <p className="muted">{indicator.description}</p> : null}
                              </td>
                              <td>{indicator.value}</td>
                              <td>{indicator.period ?? '—'}</td>
                              <td>{indicator.unit ?? '—'}</td>
                              <td>{indicator.plant?.name ?? '—'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="link-button danger"
                                  onClick={() => handleDelete(indicator.id)}
                                >
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="table-empty">
                              Sin indicadores en este pilar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="alert alert-warning">Selecciona o asigna una empresa para comenzar.</div>
      )}
    </div>
  );
}

function IndicatorFormFields({ disabled, form, formErrors, handleChange, plants }) {
  const fieldPrefix = useId();
  const fieldId = (name) => `${fieldPrefix}-${name}`;

  return (
    <>
      <div className="form-field">
        <label htmlFor={fieldId('plantId')}>Planta asociada</label>
        <select
          id={fieldId('plantId')}
          name="plantId"
          className="form-control"
          value={form.plantId}
          onChange={handleChange}
          disabled={disabled}
        >
          <option value="" disabled>
            Selecciona una planta
          </option>
          {plants.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
        {formErrors.plantId ? <span className="field-error">{formErrors.plantId}</span> : null}
      </div>

      <div className="form-field">
        <label htmlFor={fieldId('name')}>Nombre del indicador</label>
        <input
          id={fieldId('name')}
          className="form-control"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Participación femenina en liderazgo"
          disabled={disabled}
        />
        {formErrors.name ? <span className="field-error">{formErrors.name}</span> : null}
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={fieldId('category')}>Pilar ESG</label>
          <select
            id={fieldId('category')}
            name="category"
            className="form-control"
            value={form.category}
            onChange={handleChange}
            disabled={disabled}
          >
            <option value="environmental">Ambiental</option>
            <option value="social">Social</option>
            <option value="governance">Gobernanza</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={fieldId('value')}>Valor</label>
          <input
            id={fieldId('value')}
            className="form-control"
            name="value"
            type="number"
            step="0.1"
            value={form.value}
            onChange={handleChange}
            placeholder="75"
            disabled={disabled}
          />
          {formErrors.value ? <span className="field-error">{formErrors.value}</span> : null}
        </div>
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={fieldId('period')}>Periodo (opcional)</label>
          <input
            id={fieldId('period')}
            className="form-control"
            name="period"
            value={form.period}
            onChange={handleChange}
            placeholder="2024"
            disabled={disabled}
          />
          {formErrors.period ? <span className="field-error">{formErrors.period}</span> : null}
        </div>
        <div className="form-field">
          <label htmlFor={fieldId('unit')}>Unidad (opcional)</label>
          <input
            id={fieldId('unit')}
            className="form-control"
            name="unit"
            value={form.unit}
            onChange={handleChange}
            placeholder="%"
            disabled={disabled}
          />
          {formErrors.unit ? <span className="field-error">{formErrors.unit}</span> : null}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={fieldId('description')}>Descripción (opcional)</label>
        <textarea
          id={fieldId('description')}
          className="form-control"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Detalle de la metodología o cobertura del indicador"
          disabled={disabled}
          rows={4}
        />
        {formErrors.description ? <span className="field-error">{formErrors.description}</span> : null}
      </div>
    </>
  );
}

function categoryLabel(key) {
  switch (key) {
    case 'environmental':
      return 'Pilar ambiental';
    case 'social':
      return 'Pilar social';
    case 'governance':
      return 'Pilar de gobernanza';
    default:
      return key;
  }
}

function scoreTone(score) {
  if (score == null) return 'unknown';
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}
