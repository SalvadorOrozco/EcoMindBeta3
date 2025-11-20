import { z } from 'zod';
import createError from '../utils/createError.js';

const sharedTransforms = {
  numeric: (options = {}) =>
    z
      .preprocess((value) => {
        if (value === null || value === undefined || value === '') {
          return undefined;
        }
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) {
            return undefined;
          }
          const parsed = Number(trimmed.replace(',', '.'));
          return Number.isNaN(parsed) ? NaN : parsed;
        }
        return Number.isNaN(Number(value)) ? NaN : Number(value);
      }, options.integer ? z.number({ invalid_type_error: 'Debe ser numérico' }).int() : z.number({ invalid_type_error: 'Debe ser numérico' }))
      .refine((value) => !Number.isNaN(value), { message: 'Debe ser numérico' })
      .refine((value) => (typeof options.min === 'number' ? value >= options.min : true), {
        message: `Debe ser mayor o igual a ${options.min}`,
      })
      .refine((value) => (typeof options.max === 'number' ? value <= options.max : true), {
        message: `Debe ser menor o igual a ${options.max}`,
      })
      .transform((value) => value)
      .optional()
      .transform((value) => (value === undefined ? null : value)),
  boolean: () =>
    z
      .preprocess((value) => {
        if (value === null || value === undefined || value === '') {
          return undefined;
        }
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'number') {
          if (value === 1) return true;
          if (value === 0) return false;
        }
        if (typeof value === 'string') {
          const lowered = value.trim().toLowerCase();
          if (['true', 'sí', 'si', '1', 'yes'].includes(lowered)) return true;
          if (['false', 'no', '0'].includes(lowered)) return false;
        }
        return value;
      }, z.boolean({ invalid_type_error: 'Debe ser booleano' }))
      .optional()
      .transform((value) => (value === undefined ? null : value)),
  text: (max = 500) =>
    z
      .preprocess((value) => {
        if (value === null || value === undefined) return undefined;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed ? trimmed : undefined;
        }
        return String(value);
      }, z.string().max(max))
      .optional()
      .transform((value) => value ?? null),
};

const METRIC_RULES = {
  environmental: {
    energiaKwh: { type: 'numeric', min: 0 },
    porcentajeRenovable: { type: 'numeric', min: 0, max: 100 },
    emisionesCO2: { type: 'numeric', min: 0 },
    emisionesAlcance1: { type: 'numeric', min: 0 },
    emisionesAlcance2: { type: 'numeric', min: 0 },
    emisionesAlcance3: { type: 'numeric', min: 0 },
    aguaM3: { type: 'numeric', min: 0 },
    aguaRecicladaPorc: { type: 'numeric', min: 0, max: 100 },
    aguaReutilizadaPorc: { type: 'numeric', min: 0, max: 100 },
    residuosPeligrososTon: { type: 'numeric', min: 0 },
    reciclajePorc: { type: 'numeric', min: 0, max: 100 },
    intensidadEnergetica: { type: 'numeric', min: 0 },
    residuosValorizadosPorc: { type: 'numeric', min: 0, max: 100 },
    incidentesAmbientales: { type: 'numeric', min: 0, integer: true },
    sancionesAmbientales: { type: 'numeric', min: 0, integer: true },
    auditoriasAmbientales: { type: 'numeric', min: 0, integer: true },
    permisosAmbientalesAlDia: { type: 'boolean' },
    proyectosBiodiversidad: { type: 'text', max: 500 },
    planMitigacionAmbiental: { type: 'text', max: 500 },
  },
  social: {
    porcentajeMujeres: { type: 'numeric', min: 0, max: 100 },
    diversidadGeneroPorc: { type: 'numeric', min: 0, max: 100 },
    horasCapacitacion: { type: 'numeric', min: 0 },
    accidentesLaborales: { type: 'numeric', min: 0, integer: true },
    tasaFrecuenciaAccidentes: { type: 'numeric', min: 0 },
    tasaRotacion: { type: 'numeric', min: 0, max: 100 },
    indiceSatisfaccion: { type: 'numeric', min: 0, max: 100 },
    horasVoluntariado: { type: 'numeric', min: 0 },
    proveedoresLocalesPorc: { type: 'numeric', min: 0, max: 100 },
    participacionComunidad: { type: 'text', max: 500 },
    inversionComunidadUsd: { type: 'numeric', min: 0 },
    programasBienestarActivos: { type: 'numeric', min: 0, integer: true },
    satisfaccionClientesPorc: { type: 'numeric', min: 0, max: 100 },
    evaluacionesProveedoresSosteniblesPorc: { type: 'numeric', min: 0, max: 100 },
    capacitacionDerechosHumanosPorc: { type: 'numeric', min: 0, max: 100 },
    politicaDerechosHumanos: { type: 'boolean' },
  },
  governance: {
    cumplimientoNormativo: { type: 'numeric', min: 0, max: 100 },
    politicasAnticorrupcion: { type: 'boolean' },
    auditadoPorTerceros: { type: 'boolean' },
    nivelTransparencia: { type: 'numeric', min: 0, max: 100 },
    porcentajeDirectoresIndependientes: { type: 'numeric', min: 0, max: 100 },
    diversidadDirectorioPorc: { type: 'numeric', min: 0, max: 100 },
    comiteSostenibilidad: { type: 'boolean' },
    evaluacionEticaAnual: { type: 'boolean' },
    reunionesStakeholders: { type: 'numeric', min: 0, integer: true },
    canalDenunciasActivo: { type: 'boolean' },
    politicaRemuneracionEsg: { type: 'boolean' },
    evaluacionRiesgosEsgTrimestral: { type: 'boolean' },
    capacitacionGobiernoEsgPorc: { type: 'numeric', min: 0, max: 100 },
    auditoriasCompliance: { type: 'numeric', min: 0, integer: true },
    reporteSostenibilidadVerificado: { type: 'boolean' },
    relacionStakeholdersClave: { type: 'text', max: 500 },
  },
};

const BASE_SCHEMA = z.object({
  companyId: z.coerce.number({ invalid_type_error: 'companyId es requerido' }).int().positive('companyId debe ser positivo'),
  period: z
    .string({ required_error: 'period es obligatorio' })
    .trim()
    .min(1, 'period es obligatorio')
    .max(15, 'period debe tener menos de 15 caracteres'),
});

const METRIC_SCHEMAS = Object.fromEntries(
  Object.entries(METRIC_RULES).map(([type, fields]) => {
    const shape = Object.fromEntries(
      Object.entries(fields).map(([field, config]) => {
        if (config.type === 'numeric') {
          return [field, sharedTransforms.numeric(config)];
        }
        if (config.type === 'boolean') {
          return [field, sharedTransforms.boolean()];
        }
        if (config.type === 'text') {
          return [field, sharedTransforms.text(config.max ?? 500)];
        }
        return [field, sharedTransforms.numeric({})];
      }),
    );
    return [type, BASE_SCHEMA.extend(shape)];
  }),
);

export function validateMetricPayload(type, payload) {
  if (!payload || typeof payload !== 'object') {
    throw createError(400, 'El cuerpo de la solicitud es requerido');
  }

  const schema = METRIC_SCHEMAS[type];
  if (!schema) {
    throw createError(400, `Tipo de métrica no soportada: ${type}`);
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw createError(400, firstError?.message ?? 'Datos inválidos');
  }
  return result.data;
}

export function validateMetricsBatch(type, records) {
  if (!Array.isArray(records)) {
    throw createError(400, 'La importación debe enviarse como una lista');
  }
  const schema = METRIC_SCHEMAS[type];
  if (!schema) {
    throw createError(400, `Tipo de métrica no soportada: ${type}`);
  }

  const parsed = records.map((record, index) => {
    const result = schema.safeParse(record);
    if (!result.success) {
      const firstError = result.error.errors[0];
      throw createError(
        400,
        `Fila ${index + 1} (${record.period ?? 'sin periodo'}): ${firstError?.message ?? 'Datos inválidos'}`,
      );
    }
    return result.data;
  });

  return parsed;
}

export function getMetricValidationMetadata() {
  return METRIC_RULES;
}
