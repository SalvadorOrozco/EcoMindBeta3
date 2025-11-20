import { getPool } from '../config/db.js';

const RUNS_TABLE = 'EsgAuditRuns';
const FINDINGS_TABLE = 'EsgAuditFindings';

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function mapRun(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.EmpresaID,
    period: row.Periodo,
    status: row.Estado,
    triggeredBy: row.EjecutadoPor,
    summary: row.Resumen,
    totalIndicators: row.TotalIndicadores ?? 0,
    totalFindings: row.TotalHallazgos ?? 0,
    criticalFindings: row.HallazgosCriticos ?? 0,
    warningFindings: row.HallazgosAdvertencias ?? 0,
    infoFindings: row.HallazgosInformativos ?? 0,
    metadata: parseJson(row.Metadata),
    startedAt: row.FechaInicio,
    finishedAt: row.FechaFin,
  };
}

function mapFinding(row) {
  if (!row) return null;
  return {
    id: row.Id,
    runId: row.RunId,
    pillar: row.Pilar,
    indicator: row.Indicador,
    severity: row.Severidad,
    category: row.Categoria,
    message: row.Mensaje,
    suggestion: row.Sugerencia,
    period: row.Periodo,
    comparisonPeriod: row.PeriodoComparado,
    currentValue: row.ValorActual,
    previousValue: row.ValorAnterior,
    expectedValue: row.ValorEsperado,
    delta: row.Delta,
    deltaPercentage: row.DeltaPorcentaje,
    metadata: parseJson(row.Metadata),
    createdAt: row.Fecha,
  };
}

export async function createAuditRun({ companyId, period, triggeredBy, metadata }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId)
    .input('Periodo', period ?? null)
    .input('Estado', 'processing')
    .input('EjecutadoPor', triggeredBy ?? null)
    .input('Metadata', metadata ? JSON.stringify(metadata) : null)
    .query(`
      INSERT INTO ${RUNS_TABLE} (
        EmpresaID,
        Periodo,
        Estado,
        EjecutadoPor,
        Metadata
      )
      OUTPUT INSERTED.*
      VALUES (
        @EmpresaID,
        @Periodo,
        @Estado,
        @EjecutadoPor,
        @Metadata
      )
    `);

  return mapRun(result.recordset[0]);
}

export async function completeAuditRun(
  runId,
  { status, totalIndicators, totalFindings, summary, finishedAt, metadata, severityBreakdown },
) {
  const pool = await getPool();
  const breakdown = severityBreakdown ?? {};
  const payloadMetadata = metadata ? { ...metadata } : {};
  if (severityBreakdown) {
    payloadMetadata.severityBreakdown = severityBreakdown;
  }

  const request = pool.request();
  request.input('Id', runId);
  request.input('Estado', status ?? 'completed');
  request.input('TotalIndicadores', totalIndicators ?? 0);
  request.input('TotalHallazgos', totalFindings ?? 0);
  request.input('HallazgosCriticos', breakdown.critical ?? 0);
  request.input('HallazgosAdvertencias', breakdown.warning ?? 0);
  request.input('HallazgosInformativos', breakdown.info ?? 0);
  request.input('Resumen', summary ?? null);
  request.input('Metadata', Object.keys(payloadMetadata).length ? JSON.stringify(payloadMetadata) : null);
  request.input('FechaFin', finishedAt ?? new Date());

  const result = await request.query(`
    UPDATE ${RUNS_TABLE}
    SET
      Estado = @Estado,
      TotalIndicadores = @TotalIndicadores,
      TotalHallazgos = @TotalHallazgos,
      HallazgosCriticos = @HallazgosCriticos,
      HallazgosAdvertencias = @HallazgosAdvertencias,
      HallazgosInformativos = @HallazgosInformativos,
      Resumen = @Resumen,
      Metadata = @Metadata,
      FechaFin = @FechaFin
    OUTPUT INSERTED.*
    WHERE Id = @Id
  `);

  return mapRun(result.recordset[0]);
}

export async function insertAuditFindings(runId, findings = []) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return [];
  }

  const pool = await getPool();
  const inserted = [];

  for (const finding of findings) {
    const result = await pool
      .request()
      .input('RunId', runId)
      .input('Pilar', finding.pillar)
      .input('Indicador', finding.indicator)
      .input('Severidad', finding.severity)
      .input('Categoria', finding.category ?? null)
      .input('Mensaje', finding.message)
      .input('Sugerencia', finding.suggestion ?? null)
      .input('Periodo', finding.period ?? null)
      .input('PeriodoComparado', finding.comparisonPeriod ?? null)
      .input('ValorActual', finding.currentValue ?? null)
      .input('ValorAnterior', finding.previousValue ?? null)
      .input('ValorEsperado', finding.expectedValue ?? null)
      .input('Delta', finding.delta ?? null)
      .input('DeltaPorcentaje', finding.deltaPercentage ?? null)
      .input('Metadata', finding.metadata ? JSON.stringify(finding.metadata) : null)
      .query(`
        INSERT INTO ${FINDINGS_TABLE} (
          RunId,
          Pilar,
          Indicador,
          Severidad,
          Categoria,
          Mensaje,
          Sugerencia,
          Periodo,
          PeriodoComparado,
          ValorActual,
          ValorAnterior,
          ValorEsperado,
          Delta,
          DeltaPorcentaje,
          Metadata
        )
        OUTPUT INSERTED.*
        VALUES (
          @RunId,
          @Pilar,
          @Indicador,
          @Severidad,
          @Categoria,
          @Mensaje,
          @Sugerencia,
          @Periodo,
          @PeriodoComparado,
          @ValorActual,
          @ValorAnterior,
          @ValorEsperado,
          @Delta,
          @DeltaPorcentaje,
          @Metadata
        )
      `);

    inserted.push(mapFinding(result.recordset[0]));
  }

  return inserted;
}

export async function listAuditRuns({ companyId, limit = 20 }) {
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

export async function getAuditRunById(runId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Id', runId)
    .query(`SELECT * FROM ${RUNS_TABLE} WHERE Id = @Id`);
  return mapRun(result.recordset[0]);
}

export async function getLatestAuditRun(companyId, period) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  let periodFilter = '';
  if (period) {
    request.input('Periodo', period);
    periodFilter = 'AND Periodo = @Periodo';
  }
  const result = await request.query(`
    SELECT TOP 1 *
    FROM ${RUNS_TABLE}
    WHERE EmpresaID = @EmpresaID ${periodFilter}
    ORDER BY FechaInicio DESC
  `);
  return mapRun(result.recordset[0]);
}

export async function listAuditFindings(runId, { severity } = {}) {
  if (!runId) {
    return [];
  }
  const pool = await getPool();
  const request = pool.request();
  request.input('RunId', runId);
  let severityFilter = '';
  if (severity) {
    request.input('Severidad', severity);
    severityFilter = 'AND Severidad = @Severidad';
  }

  const result = await request.query(`
    SELECT *
    FROM ${FINDINGS_TABLE}
    WHERE RunId = @RunId ${severityFilter}
    ORDER BY Fecha DESC
  `);

  return result.recordset.map(mapFinding);
}
