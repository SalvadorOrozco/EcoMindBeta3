import { getPool } from '../config/db.js';

function mapLog(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.CompanyId,
    plantId: row.PlantId,
    indicatorId: row.IndicatorId,
    indicatorKey: row.IndicatorKey ?? null,
    status: row.Status,
    message: row.Message ?? null,
    confidence: row.Confidence != null ? Number(row.Confidence) : null,
    createdAt: row.CreatedAt,
  };
}

export async function insertAuditLogs(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return [];
  }
  const pool = await getPool();
  const saved = [];

  for (const log of logs) {
    const result = await pool
      .request()
      .input('CompanyId', log.companyId)
      .input('PlantId', log.plantId ?? null)
      .input('IndicatorId', log.indicatorId ?? null)
      .input('IndicatorKey', log.indicatorKey ?? null)
      .input('Status', log.status)
      .input('Message', log.message ?? null)
      .input('Confidence', log.confidence ?? null)
      .query(`
        INSERT INTO AuditLogs (
          CompanyId, PlantId, IndicatorId, IndicatorKey, Status, Message, Confidence
        )
        OUTPUT INSERTED.*
        VALUES (@CompanyId, @PlantId, @IndicatorId, @IndicatorKey, @Status, @Message, @Confidence)
      `);

    saved.push(mapLog(result.recordset[0]));
  }

  return saved;
}

export async function listAuditLogs({ companyId, plantId = null, limit = 100 }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('CompanyId', companyId);
  if (plantId !== undefined && plantId !== null) {
    request.input('PlantId', plantId);
  }
  request.input('Limit', limit);

  const conditions = ['CompanyId = @CompanyId'];
  if (plantId !== undefined && plantId !== null) {
    conditions.push('PlantId = @PlantId');
  }

  const result = await request.query(`
    SELECT TOP (@Limit) *
    FROM AuditLogs
    WHERE ${conditions.join(' AND ')}
    ORDER BY CreatedAt DESC, Id DESC
  `);

  return result.recordset.map(mapLog);
}
