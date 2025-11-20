import { useState } from 'react';
import { z } from 'zod';
import { upsertMetric } from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';
import EvidenceManager from './EvidenceManager.jsx';

const FORM_CONFIG = {
  environmental: {
    title: 'Indicadores Ambientales',
    fields: [
      { name: 'energiaKwh', label: 'Energía (kWh)', type: 'number' },
      { name: 'intensidadEnergetica', label: 'Intensidad energética (kWh/unidad)', type: 'number' },
      { name: 'porcentajeRenovable', label: 'Energía Renovable (%)', type: 'number' },
      { name: 'emisionesCO2', label: 'Emisiones CO₂ (ton)', type: 'number' },
      { name: 'emisionesAlcance1', label: 'Emisiones Alcance 1 (ton)', type: 'number' },
      { name: 'emisionesAlcance2', label: 'Emisiones Alcance 2 (ton)', type: 'number' },
      { name: 'emisionesAlcance3', label: 'Emisiones Alcance 3 (ton)', type: 'number' },
      { name: 'aguaM3', label: 'Agua Consumida (m³)', type: 'number' },
      { name: 'aguaRecicladaPorc', label: 'Agua Reciclada (%)', type: 'number' },
      { name: 'aguaReutilizadaPorc', label: 'Agua Reutilizada (%)', type: 'number' },
      { name: 'residuosPeligrososTon', label: 'Residuos Peligrosos (ton)', type: 'number' },
      { name: 'reciclajePorc', label: 'Reciclaje (%)', type: 'number' },
      { name: 'residuosValorizadosPorc', label: 'Residuos Valorizados (%)', type: 'number' },
      { name: 'incidentesAmbientales', label: 'Incidentes Ambientales', type: 'number', step: 1 },
      { name: 'sancionesAmbientales', label: 'Sanciones Ambientales', type: 'number', step: 1 },
      { name: 'auditoriasAmbientales', label: 'Auditorías Ambientales', type: 'number', step: 1 },
      { name: 'permisosAmbientalesAlDia', label: 'Permisos Ambientales al día', type: 'checkbox' },
      { name: 'proyectosBiodiversidad', label: 'Proyectos de biodiversidad', type: 'text' },
      { name: 'planMitigacionAmbiental', label: 'Plan de mitigación ambiental', type: 'text' },
    ],
  },
  social: {
    title: 'Indicadores Sociales',
    fields: [
      { name: 'porcentajeMujeres', label: '% Mujeres en Liderazgo', type: 'number' },
      { name: 'diversidadGeneroPorc', label: 'Diversidad de género (%)', type: 'number' },
      { name: 'tasaRotacion', label: 'Tasa de Rotación (%)', type: 'number' },
      { name: 'indiceSatisfaccion', label: 'Índice de Satisfacción (%)', type: 'number' },
      { name: 'horasCapacitacion', label: 'Horas de Capacitación', type: 'number' },
      { name: 'horasVoluntariado', label: 'Horas de Voluntariado', type: 'number' },
      { name: 'accidentesLaborales', label: 'Accidentes Laborales', type: 'number' },
      { name: 'tasaFrecuenciaAccidentes', label: 'Tasa de frecuencia de accidentes', type: 'number' },
      { name: 'proveedoresLocalesPorc', label: 'Proveedores Locales (%)', type: 'number' },
      { name: 'inversionComunidadUsd', label: 'Inversión en comunidad (USD)', type: 'number' },
      {
        name: 'programasBienestarActivos',
        label: 'Programas de bienestar activos',
        type: 'number',
        step: 1,
      },
      { name: 'satisfaccionClientesPorc', label: 'Satisfacción de clientes (%)', type: 'number' },
      {
        name: 'evaluacionesProveedoresSosteniblesPorc',
        label: 'Evaluaciones proveedores sostenibles (%)',
        type: 'number',
      },
      {
        name: 'capacitacionDerechosHumanosPorc',
        label: 'Cobertura capacitación en derechos humanos (%)',
        type: 'number',
      },
      { name: 'politicaDerechosHumanos', label: 'Política formal de derechos humanos', type: 'checkbox' },
      { name: 'participacionComunidad', label: 'Participación Comunitaria', type: 'text' },
    ],
  },
  governance: {
    title: 'Indicadores de Gobernanza',
    fields: [
      { name: 'cumplimientoNormativo', label: 'Cumplimiento Normativo (%)', type: 'number' },
      { name: 'politicasAnticorrupcion', label: 'Políticas Anticorrupción', type: 'checkbox' },
      { name: 'auditadoPorTerceros', label: 'Auditado por Terceros', type: 'checkbox' },
      { name: 'nivelTransparencia', label: 'Nivel de Transparencia (%)', type: 'number' },
      {
        name: 'porcentajeDirectoresIndependientes',
        label: 'Directores Independientes (%)',
        type: 'number',
      },
      { name: 'diversidadDirectorioPorc', label: 'Diversidad en Directorio (%)', type: 'number' },
      { name: 'comiteSostenibilidad', label: 'Comité de Sostenibilidad', type: 'checkbox' },
      { name: 'evaluacionEticaAnual', label: 'Evaluación Ética Anual', type: 'checkbox' },
      { name: 'reunionesStakeholders', label: 'Reuniones con stakeholders', type: 'number', step: 1 },
      { name: 'canalDenunciasActivo', label: 'Canal de denuncias activo', type: 'checkbox' },
      { name: 'politicaRemuneracionEsg', label: 'Remuneración ligada a ESG', type: 'checkbox' },
      {
        name: 'evaluacionRiesgosEsgTrimestral',
        label: 'Evaluación trimestral de riesgos ESG',
        type: 'checkbox',
      },
      {
        name: 'capacitacionGobiernoEsgPorc',
        label: 'Capacitación ESG en gobierno corporativo (%)',
        type: 'number',
      },
      { name: 'auditoriasCompliance', label: 'Auditorías de compliance', type: 'number', step: 1 },
      {
        name: 'reporteSostenibilidadVerificado',
        label: 'Reporte ESG verificado externamente',
        type: 'checkbox',
      },
      {
        name: 'relacionStakeholdersClave',
        label: 'Relación con stakeholders clave',
        type: 'text',
      },
    ],
  },
};

const SCHEMAS = buildSchemas();

export default function MetricForm({ type, onSaved }) {
  const { company, period } = useCompany();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  if (!company) {
    return <p>Selecciona una empresa para cargar métricas.</p>;
  }

  const config = FORM_CONFIG[type];
  const schema = SCHEMAS[type];

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrors({});
    try {
      const payload = sanitizeForm(schema, form, company.id, period);
      await upsertMetric(type, payload);
      onSaved?.();
      setForm({});
      setSuccessMessage('Indicadores guardados correctamente.');
    } catch (error) {
      if (error.validationErrors) {
        setErrors(error.validationErrors);
      } else {
        setErrors({ general: error.message ?? 'No se pudo guardar' });
      }
      return;
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="page-header">
        <h3>{config.title}</h3>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar indicadores'}
        </button>
      </div>
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {errors.general && <div className="alert alert-error">{errors.general}</div>}
      <div className="form-grid">
        {config.fields.map((field) => (
          <div className="form-field" key={field.name}>
            <label htmlFor={`${type}-${field.name}`}>{field.label}</label>
            {field.type === 'checkbox' ? (
              <input
                id={`${type}-${field.name}`}
                type="checkbox"
                className="form-checkbox"
                checked={Boolean(form[field.name])}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, [field.name]: event.target.checked }))
                }
              />
            ) : field.type === 'text' ? (
              <textarea
                id={`${type}-${field.name}`}
                className="form-control form-control--textarea"
                value={form[field.name] ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}
                rows={3}
              />
            ) : (
              <input
                id={`${type}-${field.name}`}
                type="number"
                className="form-control"
                step={field.step ?? '0.01'}
                value={form[field.name] ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}
              />
            )}
            {errors[field.name] && <span className="input-error">{errors[field.name]}</span>}
          </div>
        ))}
      </div>
      <EvidenceManager
        companyId={company.id}
        period={period}
        type={type}
        indicators={config.fields.filter((field) => field.type !== 'checkbox')}
      />
    </form>
  );
}

function sanitizeForm(schema, form, companyId, period) {
  const result = schema.safeParse({ ...form, companyId, period });
  if (!result.success) {
    const fieldErrors = result.error.formErrors.fieldErrors;
    const mappedErrors = Object.fromEntries(
      Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0]]),
    );
    throwValidationError(mappedErrors);
  }
  return result.data;
}

function throwValidationError(errors) {
  const error = new Error('Validación fallida');
  error.validationErrors = errors;
  throw error;
}

function buildSchemas() {
  const base = z.object({
    companyId: z.number(),
    period: z.string().min(1, 'El periodo es obligatorio'),
  });
  return {
    environmental: base.merge(
      z.object({
        energiaKwh: numericField({ min: 0 }),
        intensidadEnergetica: numericField({ min: 0 }),
        porcentajeRenovable: numericField({ min: 0, max: 100 }),
        emisionesCO2: numericField({ min: 0 }),
        emisionesAlcance1: numericField({ min: 0 }),
        emisionesAlcance2: numericField({ min: 0 }),
        emisionesAlcance3: numericField({ min: 0 }),
        aguaM3: numericField({ min: 0 }),
        aguaRecicladaPorc: numericField({ min: 0, max: 100 }),
        aguaReutilizadaPorc: numericField({ min: 0, max: 100 }),
        residuosPeligrososTon: numericField({ min: 0 }),
        reciclajePorc: numericField({ min: 0, max: 100 }),
        residuosValorizadosPorc: numericField({ min: 0, max: 100 }),
        incidentesAmbientales: numericField({ min: 0, integer: true }),
        sancionesAmbientales: numericField({ min: 0, integer: true }),
        auditoriasAmbientales: numericField({ min: 0, integer: true }),
        permisosAmbientalesAlDia: booleanField(),
        proyectosBiodiversidad: textField(),
        planMitigacionAmbiental: textField(),
      }),
    ),
    social: base.merge(
      z.object({
        porcentajeMujeres: numericField({ min: 0, max: 100 }),
        diversidadGeneroPorc: numericField({ min: 0, max: 100 }),
        tasaRotacion: numericField({ min: 0, max: 100 }),
        indiceSatisfaccion: numericField({ min: 0, max: 100 }),
        horasCapacitacion: numericField({ min: 0 }),
        horasVoluntariado: numericField({ min: 0 }),
        accidentesLaborales: numericField({ min: 0, integer: true }),
        tasaFrecuenciaAccidentes: numericField({ min: 0 }),
        proveedoresLocalesPorc: numericField({ min: 0, max: 100 }),
        inversionComunidadUsd: numericField({ min: 0 }),
        programasBienestarActivos: numericField({ min: 0, integer: true }),
        satisfaccionClientesPorc: numericField({ min: 0, max: 100 }),
        evaluacionesProveedoresSosteniblesPorc: numericField({ min: 0, max: 100 }),
        capacitacionDerechosHumanosPorc: numericField({ min: 0, max: 100 }),
        politicaDerechosHumanos: booleanField(),
        participacionComunidad: textField(),
      }),
    ),
    governance: base.merge(
      z.object({
        cumplimientoNormativo: numericField({ min: 0, max: 100 }),
        politicasAnticorrupcion: booleanField(),
        auditadoPorTerceros: booleanField(),
        nivelTransparencia: numericField({ min: 0, max: 100 }),
        porcentajeDirectoresIndependientes: numericField({ min: 0, max: 100 }),
        diversidadDirectorioPorc: numericField({ min: 0, max: 100 }),
        comiteSostenibilidad: booleanField(),
        evaluacionEticaAnual: booleanField(),
        reunionesStakeholders: numericField({ min: 0, integer: true }),
        canalDenunciasActivo: booleanField(),
        politicaRemuneracionEsg: booleanField(),
        evaluacionRiesgosEsgTrimestral: booleanField(),
        capacitacionGobiernoEsgPorc: numericField({ min: 0, max: 100 }),
        auditoriasCompliance: numericField({ min: 0, integer: true }),
        reporteSostenibilidadVerificado: booleanField(),
        relacionStakeholdersClave: textField(),
      }),
    ),
  };
}

function numericField({ min, max, integer } = {}) {
  return z
    .union([z.string(), z.number()])
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null;
      const numberValue = typeof value === 'number' ? value : Number(value);
      return Number.isNaN(numberValue) ? NaN : numberValue;
    })
    .refine((value) => value === null || !Number.isNaN(value), { message: 'Debe ser numérico' })
    .refine((value) => value === null || !integer || Number.isInteger(value), {
      message: 'Debe ser un número entero',
    })
    .refine((value) => value === null || min === undefined || value >= min, {
      message: `Debe ser ≥ ${min}`,
    })
    .refine((value) => value === null || max === undefined || value <= max, {
      message: `Debe ser ≤ ${max}`,
    })
    .nullable()
    .optional();
}

function booleanField() {
  return z
    .any()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null;
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      return Boolean(value);
    })
    .nullable()
    .optional();
}

function textField() {
  return z
    .union([z.string(), z.number()])
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null;
      return String(value).slice(0, 500);
    })
    .nullable()
    .optional();
}
