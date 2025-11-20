import { getPool } from '../config/db.js';

export const TABLES = {
  environmental: 'IndicadoresAmbientales',
  social: 'IndicadoresSociales',
  governance: 'IndicadoresGobernanza',
};

export const COLUMNS = {
  environmental: [
    'EnergiaKwh',
    'PorcentajeRenovable',
    'EmisionesCO2',
    'EmisionesAlcance1',
    'EmisionesAlcance2',
    'EmisionesAlcance3',
    'AguaM3',
    'AguaRecicladaPorc',
    'AguaReutilizadaPorc',
    'ResiduosPeligrososTon',
    'ReciclajePorc',
    'IntensidadEnergetica',
    'ResiduosValorizadosPorc',
    'IncidentesAmbientales',
    'SancionesAmbientales',
    'AuditoriasAmbientales',
    'PermisosAmbientalesAlDia',
    'ProyectosBiodiversidad',
    'PlanMitigacionAmbiental',
  ],
  social: [
    'PorcentajeMujeres',
    'DiversidadGeneroPorc',
    'HorasCapacitacion',
    'AccidentesLaborales',
    'TasaFrecuenciaAccidentes',
    'TasaRotacion',
    'IndiceSatisfaccion',
    'HorasVoluntariado',
    'ProveedoresLocalesPorc',
    'ParticipacionComunidad',
    'InversionComunidadUsd',
    'ProgramasBienestarActivos',
    'SatisfaccionClientesPorc',
    'EvaluacionesProveedoresSosteniblesPorc',
    'CapacitacionDerechosHumanosPorc',
    'PoliticaDerechosHumanos',
  ],
  governance: [
    'CumplimientoNormativo',
    'PoliticasAnticorrupcion',
    'AuditadoPorTerceros',
    'NivelTransparencia',
    'PorcentajeDirectoresIndependientes',
    'DiversidadDirectorioPorc',
    'ComiteSostenibilidad',
    'EvaluacionEticaAnual',
    'ReunionesStakeholders',
    'CanalDenunciasActivo',
    'PoliticaRemuneracionEsg',
    'EvaluacionRiesgosEsgTrimestral',
    'CapacitacionGobiernoEsgPorc',
    'AuditoriasCompliance',
    'ReporteSostenibilidadVerificado',
    'RelacionStakeholdersClave',
  ],
};

const BOOLEAN_COLUMNS = new Set([
  'PoliticasAnticorrupcion',
  'AuditadoPorTerceros',
  'ComiteSostenibilidad',
  'EvaluacionEticaAnual',
  'PermisosAmbientalesAlDia',
  'PoliticaDerechosHumanos',
  'CanalDenunciasActivo',
  'PoliticaRemuneracionEsg',
  'EvaluacionRiesgosEsgTrimestral',
  'ReporteSostenibilidadVerificado',
]);

export const METRIC_TYPES = Object.keys(TABLES);

function mapRecord(type, record) {
  if (!record) return null;
  const base = {
    id: record.Id,
    companyId: record.EmpresaID,
    period: record.Periodo,
    createdAt: record.FechaCarga,
  };

  const mapped = {};
  COLUMNS[type].forEach((column) => {
    const key = column.charAt(0).toLowerCase() + column.slice(1);
    const value = record[column];
    if (BOOLEAN_COLUMNS.has(column)) {
      mapped[key] = value === null || value === undefined ? null : value === true || value === 1;
    } else {
      mapped[key] = value;
    }
  });
  return { ...base, ...mapped };
}

export async function upsertMetric(type, payload) {
  const table = TABLES[type];
  if (!table) throw new Error(`Unsupported metric type: ${type}`);
  const columns = COLUMNS[type];
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', payload.companyId);
  request.input('Periodo', payload.period);
  columns.forEach((column) => {
    const key = column.charAt(0).toLowerCase() + column.slice(1);
    request.input(column, payload[key] ?? null);
  });
  const setClause = columns
    .map((column) => `${column} = @${column}`)
    .join(',\n        ');
  const result = await request.query(`
    IF EXISTS (
      SELECT 1 FROM ${table}
      WHERE EmpresaID = @EmpresaID AND Periodo = @Periodo
    )
    BEGIN
      UPDATE ${table}
      SET ${setClause}
      WHERE EmpresaID = @EmpresaID AND Periodo = @Periodo;
      SELECT Id FROM ${table}
      WHERE EmpresaID = @EmpresaID AND Periodo = @Periodo;
    END
    ELSE
    BEGIN
      INSERT INTO ${table} (EmpresaID, Periodo, ${columns.join(', ')})
      OUTPUT INSERTED.Id AS Id
      VALUES (@EmpresaID, @Periodo, ${columns.map((c) => `@${c}`).join(', ')});
    END
  `);
  return result.recordset[0];
}

export async function getMetric(type, companyId, period) {
  const table = TABLES[type];
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('Periodo', period);
  const result = await request.query(`
    SELECT * FROM ${table}
    WHERE EmpresaID = @EmpresaID AND Periodo = @Periodo
  `);
  return mapRecord(type, result.recordset[0]);
}

export async function getMetricsForCompany(type, companyId) {
  const table = TABLES[type];
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  const result = await request.query(`
    SELECT * FROM ${table}
    WHERE EmpresaID = @EmpresaID
    ORDER BY Periodo DESC
  `);
  return result.recordset.map((record) => mapRecord(type, record));
}

export async function getMetricsByPeriod(companyId, period) {
  const pool = await getPool();
  const resultEntries = await Promise.all(
    Object.entries(TABLES).map(async ([type, table]) => {
      const request = pool.request();
      request.input('EmpresaID', companyId);
      request.input('Periodo', period);
      const result = await request.query(`
        SELECT * FROM ${table}
        WHERE EmpresaID = @EmpresaID AND Periodo = @Periodo
      `);
      return [type, mapRecord(type, result.recordset[0])];
    }),
  );

  return Object.fromEntries(resultEntries);
}

export async function upsertMetricsBatch(type, payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return [];
  }
  const results = [];
  for (const payload of payloads) {
    const inserted = await upsertMetric(type, payload);
    results.push(inserted);
  }
  return results;
}

export async function upsertMetricsByType(recordsByType) {
  const results = {};
  await Promise.all(
    Object.entries(recordsByType).map(async ([type, payloads]) => {
      if (!payloads?.length) return;
      results[type] = await upsertMetricsBatch(type, payloads);
    }),
  );
  return results;
}

export async function getHistoricalSummary(companyId) {
  const pool = await getPool();
  const envResult = await pool
    .request()
    .input('EmpresaID', companyId)
    .query(`
      SELECT Periodo, EnergiaKwh, EmisionesCO2
      FROM ${TABLES.environmental}
      WHERE EmpresaID = @EmpresaID
    `);
  const socResult = await pool
    .request()
    .input('EmpresaID', companyId)
    .query(`
      SELECT Periodo, InversionComunidadUsd
      FROM ${TABLES.social}
      WHERE EmpresaID = @EmpresaID
    `);
  const govResult = await pool
    .request()
    .input('EmpresaID', companyId)
    .query(`
      SELECT Periodo, CumplimientoNormativo
      FROM ${TABLES.governance}
      WHERE EmpresaID = @EmpresaID
    `);

  const periods = new Map();
  function ensure(period) {
    if (!periods.has(period)) {
      periods.set(period, {
        period,
        energiaKwh: null,
        emisionesCO2: null,
        inversionComunidadUsd: null,
        cumplimientoNormativo: null,
      });
    }
    return periods.get(period);
  }

  envResult.recordset.forEach((row) => {
    const entry = ensure(row.Periodo);
    entry.energiaKwh = row.EnergiaKwh ?? entry.energiaKwh;
    entry.emisionesCO2 = row.EmisionesCO2 ?? entry.emisionesCO2;
  });
  socResult.recordset.forEach((row) => {
    const entry = ensure(row.Periodo);
    entry.inversionComunidadUsd = row.InversionComunidadUsd ?? entry.inversionComunidadUsd;
  });
  govResult.recordset.forEach((row) => {
    const entry = ensure(row.Periodo);
    entry.cumplimientoNormativo = row.CumplimientoNormativo ?? entry.cumplimientoNormativo;
  });

  return Array.from(periods.values()).sort((a, b) => (a.period > b.period ? 1 : -1));
}

export function getColumnsForType(type) {
  return COLUMNS[type] ?? [];
}
