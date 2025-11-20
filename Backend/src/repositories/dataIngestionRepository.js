import { getPool } from '../config/db.js';

const RUNS_TABLE = 'DataIngestionRuns';
const ITEMS_TABLE = 'DataIngestionItems';
const ALERTS_TABLE = 'DataIngestionAlerts';
const COMPANIES_TABLE = 'Companies'; // ✅ Cambio: usar Companies

export async function createIngestionRun({
  companyId,
  period,
  source = 'manual-upload',
  status = 'processing',
  description = null,
  totalSources = 0,
  metadata = null,
}) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId) // ✅ Mantener EmpresaID como columna
    .input('Periodo', period ?? null)
    .input('Fuente', source)
    .input('Estado', status)
    .input('Descripcion', description ?? null)
    .input('TotalFuentes', totalSources ?? 0)
    .input('Metadata', metadata ? JSON.stringify(metadata) : null)
    .query(`
      INSERT INTO ${RUNS_TABLE} (
        EmpresaID,
        Periodo,
        Fuente,
        Estado,
        Descripcion,
        TotalFuentes,
        Metadata
      )
      OUTPUT INSERTED.*
      VALUES (
        @EmpresaID,
        @Periodo,
        @Fuente,
        @Estado,
        @Descripcion,
        @TotalFuentes,
        @Metadata
      )
    `);

  return mapRun(result.recordset[0]);
}

export async function updateIngestionRun(runId, {
  status,
  totalFiles,
  totalIndicators,
  finishedAt,
  summary,
}) {
  const pool = await getPool();
  const request = pool.request();
  request.input('Id', runId);
  request.input('Estado', status ?? 'completed');
  request.input('TotalArchivos', totalFiles ?? 0);
  request.input('TotalIndicadores', totalIndicators ?? 0);
  request.input('Resumen', summary ?? null);
  request.input('FechaFin', finishedAt ?? new Date());

  const result = await request.query(`
    UPDATE ${RUNS_TABLE}
    SET
      Estado = @Estado,
      TotalArchivos = @TotalArchivos,
      TotalIndicadores = @TotalIndicadores,
      Resumen = @Resumen,
      FechaFin = @FechaFin
    OUTPUT INSERTED.*
    WHERE Id = @Id
  `);

  return mapRun(result.recordset[0]);
}

export async function insertIngestionItems(runId, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const pool = await getPool();
  const inserted = [];

  for (const item of items) {
    const result = await pool
      .request()
      .input('IngestionId', runId)
      .input('Pilar', item.pillar)
      .input('Indicador', item.indicator)
      .input('Valor', item.value ?? null)
      .input('Unidad', item.unit ?? null)
      .input('Fuente', item.source ?? null)
      .input('FechaDato', item.date ?? null)
      .input('Metadata', item.metadata ? JSON.stringify(item.metadata) : null)
      .query(`
        INSERT INTO ${ITEMS_TABLE} (
          IngestionId,
          Pilar,
          Indicador,
          Valor,
          Unidad,
          Fuente,
          FechaDato,
          Metadata
        )
        OUTPUT INSERTED.*
        VALUES (
          @IngestionId,
          @Pilar,
          @Indicador,
          @Valor,
          @Unidad,
          @Fuente,
          @FechaDato,
          @Metadata
        )
      `);

    inserted.push(mapItem(result.recordset[0]));
  }

  return inserted;
}

export async function createIngestionAlerts(runId, alerts = []) {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return [];
  }
  const pool = await getPool();
  const inserted = [];

  for (const alert of alerts) {
    const result = await pool
      .request()
      .input('IngestionId', runId)
      .input('Tipo', alert.type ?? 'general')
      .input('Indicador', alert.indicator ?? null)
      .input('Mensaje', alert.message ?? 'Se detectó un problema en la ingesta')
      .input('Nivel', alert.level ?? 'warning')
      .input('Metadata', alert.metadata ? JSON.stringify(alert.metadata) : null)
      .query(`
        INSERT INTO ${ALERTS_TABLE} (
          IngestionId,
          Tipo,
          Indicador,
          Mensaje,
          Nivel,
          Metadata
        )
        OUTPUT INSERTED.*
        VALUES (
          @IngestionId,
          @Tipo,
          @Indicador,
          @Mensaje,
          @Nivel,
          @Metadata
        )
      `);

    inserted.push(mapAlert(result.recordset[0]));
  }

  return inserted;
}

export async function listIngestionRuns({ companyId, limit = 20 }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('Limit', limit);

  const result = await request.query(`
    SELECT TOP (@Limit) *
    FROM ${RUNS_TABLE}
    WHERE EmpresaID = @EmpresaID
    ORDER BY FechaInicio DESC
  `);

  return result.recordset.map(mapRun);
}

export async function listIngestionAlerts({ companyId, unresolvedOnly = false, limit = 50 }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('Limit', limit);
  const conditions = ['r.EmpresaID = @EmpresaID'];
  if (unresolvedOnly) {
    conditions.push('a.Resuelto = 0');
  }

  const result = await request.query(`
    SELECT TOP (@Limit)
      a.*,
      r.Periodo,
      r.Fuente,
      r.Estado,
      r.FechaInicio,
      r.FechaFin
    FROM ${ALERTS_TABLE} a
    INNER JOIN ${RUNS_TABLE} r ON a.IngestionId = r.Id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.Fecha DESC
  `);

  return result.recordset.map(mapAlertWithRun);
}

export async function listIngestionItemsForPeriod({ companyId, period = null, limit = 500 }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('Limit', limit);
  let query = `
    SELECT TOP (@Limit)
      i.*, r.Periodo
    FROM ${ITEMS_TABLE} i
    INNER JOIN ${RUNS_TABLE} r ON i.IngestionId = r.Id
    WHERE r.EmpresaID = @EmpresaID
  `;
  if (period) {
    request.input('Periodo', period);
    query += ' AND r.Periodo = @Periodo';
  }
  query += ' ORDER BY i.FechaDato DESC, i.Id DESC';

  const result = await request.query(query);
  return result.recordset.map((row) => ({ ...mapItem(row), period: row.Periodo ?? null }));
}

export async function resolveIngestionAlert(alertId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Id', alertId)
    .query(`
      UPDATE ${ALERTS_TABLE}
      SET Resuelto = 1,
          FechaResolucion = SYSDATETIME()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

  return result.recordset[0] ? mapAlert(result.recordset[0]) : null;
}

function mapRun(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.EmpresaID,
    period: row.Periodo,
    source: row.Fuente,
    status: row.Estado,
    description: row.Descripcion ?? null,
    totalSources: row.TotalFuentes ?? 0,
    totalFiles: row.TotalArchivos ?? 0,
    totalIndicators: row.TotalIndicadores ?? 0,
    summary: row.Resumen ?? null,
    metadata: row.Metadata ? safeJson(row.Metadata) : null,
    startedAt: row.FechaInicio,
    finishedAt: row.FechaFin ?? null,
  };
}

function mapItem(row) {
  if (!row) return null;
  return {
    id: row.Id,
    ingestionId: row.IngestionId,
    pillar: row.Pilar,
    indicator: row.Indicador,
    value: row.Valor,
    unit: row.Unidad ?? null,
    source: row.Fuente ?? null,
    date: row.FechaDato ?? null,
    metadata: row.Metadata ? safeJson(row.Metadata) : null,
  };
}

function mapAlert(row) {
  if (!row) return null;
  return {
    id: row.Id,
    ingestionId: row.IngestionId,
    type: row.Tipo,
    indicator: row.Indicador ?? null,
    message: row.Mensaje,
    level: row.Nivel ?? 'warning',
    resolved: row.Resuelto === true || row.Resuelto === 1,
    metadata: row.Metadata ? safeJson(row.Metadata) : null,
    createdAt: row.Fecha,
    resolvedAt: row.FechaResolucion ?? null,
  };
}

function mapAlertWithRun(row) {
  if (!row) return null;
  return {
    ...mapAlert(row),
    period: row.Periodo ?? null,
    runStatus: row.Estado ?? null,
    runSource: row.Fuente ?? null,
    startedAt: row.FechaInicio ?? null,
    finishedAt: row.FechaFin ?? null,
  };
}

function safeJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}