import { getPool } from '../config/db.js';

const FACTORS_TABLE = 'CarbonEmissionFactors';
const SNAPSHOT_TABLE = 'CarbonFootprintSnapshots';
const BREAKDOWN_TABLE = 'CarbonFootprintBreakdown';
const SCENARIO_TABLE = 'CarbonReductionScenarios';

/* -------------------------------------------------------
   EMISSION FACTORS
------------------------------------------------------- */

export async function getEmissionFactors({ countryCode = null, year }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('Year', year);

  let query = `
    SELECT *
    FROM ${FACTORS_TABLE}
    WHERE Anio = @Year
  `;

  if (countryCode) {
    request.input('CountryCode', countryCode);
    query += ' AND CodigoPais = @CountryCode';
  } else {
    query += ' AND CodigoPais IS NULL';
  }

  const result = await request.query(query);
  return result.recordset.map(mapFactor);
}

export async function getFallbackEmissionFactors({ countryCode = null, year }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('Year', year);

  let query = `
    SELECT TOP 1 Anio
    FROM ${FACTORS_TABLE}
  `;

  if (countryCode) {
    request.input('CountryCode', countryCode);
    query += ' WHERE CodigoPais = @CountryCode';
  } else {
    query += ' WHERE CodigoPais IS NULL';
  }

  query += ' ORDER BY Anio DESC';

  const closestYear = await request.query(query);
  if (!closestYear.recordset.length) return [];

  return getEmissionFactors({ countryCode, year: closestYear.recordset[0].Anio });
}

/* -------------------------------------------------------
   FIX: UPSERT NULL-SAFE PARA EVITAR DUPLICADOS
------------------------------------------------------- */

export async function upsertEmissionFactors(factors = []) {
  if (!Array.isArray(factors) || factors.length === 0) return [];

  const pool = await getPool();
  const inserted = [];

  for (const factor of factors) {
    const request = pool.request();

    request.input('Pais', factor.country ?? factor.countryName ?? 'Global');
    request.input('CodigoPais', factor.countryCode ?? null);
    request.input('Alcance', factor.scope);
    request.input('Categoria', factor.category);
    request.input('Anio', factor.year);
    request.input('Factor', factor.value);
    request.input('UnidadActividad', factor.activityUnit ?? 'kWh');
    request.input('UnidadResultado', factor.resultUnit ?? 'tCO2e');
    request.input('Fuente', factor.source ?? null);

    const result = await request.query(`
      MERGE ${FACTORS_TABLE} AS target
      USING (
        SELECT
          @CodigoPais AS CodigoPais,
          @Alcance AS Alcance,
          @Categoria AS Categoria,
          @Anio AS Anio
      ) AS source
      ON (
        ISNULL(target.CodigoPais, '') = ISNULL(source.CodigoPais, '')
        AND target.Alcance = source.Alcance
        AND target.Categoria = source.Categoria
        AND target.Anio = source.Anio
      )
      WHEN MATCHED THEN
        UPDATE SET
          Pais = @Pais,
          Factor = @Factor,
          UnidadActividad = @UnidadActividad,
          UnidadResultado = @UnidadResultado,
          Fuente = @Fuente,
          UltimaActualizacion = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (Pais, CodigoPais, Alcance, Categoria, Anio, Factor, UnidadActividad, UnidadResultado, Fuente)
        VALUES (@Pais, @CodigoPais, @Alcance, @Categoria, @Anio, @Factor, @UnidadActividad, @UnidadResultado, @Fuente)
      OUTPUT INSERTED.*;
    `);

    inserted.push(mapFactor(result.recordset[0]));
  }

  return inserted;
}

/* -------------------------------------------------------
   SNAPSHOTS (MERGE OK)
------------------------------------------------------- */

export async function upsertCarbonSnapshot({
  companyId,
  period,
  scopeTotals,
  breakdown = [],
  scenarios = [],
  factorsMetadata = null,
  metadata = null,
}) {
  const pool = await getPool();
  const request = pool.request();

  request.input('EmpresaID', companyId);
  request.input('Periodo', period);
  request.input('Alcance1', scopeTotals?.scope1 ?? 0);
  request.input('Alcance2', scopeTotals?.scope2 ?? 0);
  request.input('Alcance3', scopeTotals?.scope3 ?? 0);
  request.input('Total', scopeTotals?.total ?? 0);
  request.input('Factores', factorsMetadata ? JSON.stringify(factorsMetadata) : null);
  request.input('Metadatos', metadata ? JSON.stringify(metadata) : null);

  const result = await request.query(`
    MERGE ${SNAPSHOT_TABLE} AS target
    USING (SELECT @EmpresaID AS EmpresaID, @Periodo AS Periodo) AS source
    ON target.EmpresaID = source.EmpresaID
       AND target.Periodo = source.Periodo
    WHEN MATCHED THEN 
      UPDATE SET
        Alcance1 = @Alcance1,
        Alcance2 = @Alcance2,
        Alcance3 = @Alcance3,
        Total = @Total,
        FactoresUtilizados = @Factores,
        Metadatos = @Metadatos,
        FechaCalculo = SYSDATETIME()
    WHEN NOT MATCHED THEN 
      INSERT (EmpresaID, Periodo, Alcance1, Alcance2, Alcance3, Total, FactoresUtilizados, Metadatos)
      VALUES (@EmpresaID, @Periodo, @Alcance1, @Alcance2, @Alcance3, @Total, @Factores, @Metadatos)
    OUTPUT INSERTED.*;
  `);

  const snapshot = mapSnapshot(result.recordset[0]);

  await replaceBreakdown(snapshot.id, breakdown);
  await replaceScenarios(snapshot.id, scenarios);

  return getSnapshotById(snapshot.id);
}

/* -------------------------------------------------------
   BREAKDOWN / SCENARIOS
------------------------------------------------------- */

async function replaceBreakdown(snapshotId, breakdown) {
  const pool = await getPool();

  const del = pool.request();
  del.input('SnapshotId', snapshotId);
  await del.query(`DELETE FROM ${BREAKDOWN_TABLE} WHERE SnapshotId = @SnapshotId`);

  if (!Array.isArray(breakdown) || breakdown.length === 0) return;

  for (const item of breakdown) {
    const req = pool.request();
    req.input('SnapshotId', snapshotId);
    req.input('Alcance', item.scope);
    req.input('Categoria', item.category);
    req.input('Actividad', item.activity ?? null);
    req.input('Unidad', item.unit ?? null);
    req.input('Factor', item.factor ?? null);
    req.input('Resultado', item.result ?? 0);
    req.input('FuenteDato', item.source ?? null);
    req.input('Notas', item.notes ?? null);

    await req.query(`
      INSERT INTO ${BREAKDOWN_TABLE} (
        SnapshotId, Alcance, Categoria, Actividad, Unidad, Factor, Resultado, FuenteDato, Notas
      )
      VALUES (
        @SnapshotId, @Alcance, @Categoria, @Actividad, @Unidad, @Factor,
        @Resultado, @FuenteDato, @Notas
      )
    `);
  }
}

async function replaceScenarios(snapshotId, scenarios) {
  const pool = await getPool();

  const del = pool.request();
  del.input('SnapshotId', snapshotId);
  await del.query(`DELETE FROM ${SCENARIO_TABLE} WHERE SnapshotId = @SnapshotId`);

  if (!Array.isArray(scenarios) || scenarios.length === 0) return;

  for (const scenario of scenarios) {
    const req = pool.request();
    req.input('SnapshotId', snapshotId);
    req.input('Nombre', scenario.name ?? 'Escenario');
    req.input('Descripcion', scenario.description ?? null);
    req.input('Alcance', scenario.scope ?? 'scope1');
    req.input('Categoria', scenario.category ?? 'general');
    req.input('ReduccionPorc', scenario.reductionPercent ?? 0);
    req.input('ResultadoProyectado', scenario.projected ?? 0);
    req.input('Delta', scenario.delta ?? null);

    await req.query(`
      INSERT INTO ${SCENARIO_TABLE} (
        SnapshotId, Nombre, Descripcion, Alcance, Categoria,
        ReduccionPorc, ResultadoProyectado, Delta
      )
      VALUES (
        @SnapshotId, @Nombre, @Descripcion, @Alcance, @Categoria,
        @ReduccionPorc, @ResultadoProyectado, @Delta
      )
    `);
  }
}

/* -------------------------------------------------------
   SNAPSHOT GETTERS
------------------------------------------------------- */

export async function getSnapshotByPeriod(companyId, period) {
  const pool = await getPool();
  const req = pool.request();

  req.input('EmpresaID', companyId);
  req.input('Periodo', period);

  const result = await req.query(`
    SELECT * FROM ${SNAPSHOT_TABLE}
    WHERE EmpresaID = @EmpresaID AND Periodo = @Periodo
  `);

  if (!result.recordset.length) return null;
  return enrichSnapshot(mapSnapshot(result.recordset[0]));
}

export async function getSnapshotById(id) {
  const pool = await getPool();
  const req = pool.request();

  req.input('Id', id);
  const result = await req.query(`
    SELECT * FROM ${SNAPSHOT_TABLE} WHERE Id = @Id
  `);

  if (!result.recordset.length) return null;
  return enrichSnapshot(mapSnapshot(result.recordset[0]));
}

export async function listSnapshots(companyId, { limit = 12 } = {}) {
  const pool = await getPool();
  const req = pool.request();

  req.input('EmpresaID', companyId);
  req.input('Limit', limit);

  const result = await req.query(`
    SELECT TOP (@Limit) *
    FROM ${SNAPSHOT_TABLE}
    WHERE EmpresaID = @EmpresaID
    ORDER BY Periodo DESC
  `);

  return Promise.all(result.recordset.map((row) => enrichSnapshot(mapSnapshot(row))));
}

async function enrichSnapshot(snapshot) {
  if (!snapshot) return null;

  const pool = await getPool();

  const req1 = pool.request();
  req1.input('SnapshotId', snapshot.id);

  const breakdown = await req1.query(`
    SELECT * FROM ${BREAKDOWN_TABLE}
    WHERE SnapshotId = @SnapshotId
    ORDER BY Alcance, Categoria
  `);

  const req2 = pool.request();
  req2.input('SnapshotId', snapshot.id);

  const scenarios = await req2.query(`
    SELECT * FROM ${SCENARIO_TABLE}
    WHERE SnapshotId = @SnapshotId
    ORDER BY Nombre
  `);

  return {
    ...snapshot,
    breakdown: breakdown.recordset.map(mapBreakdown),
    scenarios: scenarios.recordset.map(mapScenario),
  };
}

/* -------------------------------------------------------
   MAPPERS
------------------------------------------------------- */

function mapFactor(row) {
  return {
    id: row.Id,
    country: row.Pais,
    countryCode: row.CodigoPais ?? null,
    scope: row.Alcance,
    category: row.Categoria,
    year: row.Anio,
    value: Number(row.Factor),
    activityUnit: row.UnidadActividad,
    resultUnit: row.UnidadResultado,
    source: row.Fuente ?? null,
    updatedAt: row.UltimaActualizacion,
  };
}

function mapSnapshot(row) {
  return {
    id: row.Id,
    companyId: row.EmpresaID,
    period: row.Periodo,
    scope1: Number(row.Alcance1 ?? 0),
    scope2: Number(row.Alcance2 ?? 0),
    scope3: Number(row.Alcance3 ?? 0),
    total: Number(row.Total ?? 0),
    factors: row.FactoresUtilizados ? safeJson(row.FactoresUtilizados) : null,
    metadata: row.Metadatos ? safeJson(row.Metadatos) : null,
    calculatedAt: row.FechaCalculo,
  };
}

function mapBreakdown(row) {
  return {
    id: row.Id,
    scope: row.Alcance,
    category: row.Categoria,
    activity: row.Actividad != null ? Number(row.Actividad) : null,
    unit: row.Unidad ?? null,
    factor: row.Factor != null ? Number(row.Factor) : null,
    result: Number(row.Resultado ?? 0),
    source: row.FuenteDato ?? null,
    notes: row.Notas ?? null,
  };
}

function mapScenario(row) {
  return {
    id: row.Id,
    name: row.Nombre,
    description: row.Descripcion ?? null,
    scope: row.Alcance,
    category: row.Categoria,
    reductionPercent: Number(row.ReduccionPorc ?? 0),
    projected: Number(row.ResultadoProyectado ?? 0),
    delta: row.Delta != null ? Number(row.Delta) : null,
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}
