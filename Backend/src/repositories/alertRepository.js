import { getPool } from '../config/db.js';

function mapAlert(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.CompanyId,
    plantId: row.PlantId,
    plant: row.PlantId
      ? {
          id: row.PlantId,
          name: row.PlantName ?? null,
          location: row.PlantLocation ?? null,
        }
      : null,
    indicatorKey: row.IndicatorKey,
    currentValue: row.CurrentValue != null ? Number(row.CurrentValue) : null,
    predictedValue: row.PredictedValue != null ? Number(row.PredictedValue) : null,
    riskLevel: row.RiskLevel,
    message: row.Message,
    createdAt: row.CreatedAt,
  };
}

export async function listAlerts(companyId, plantId = null) {
  const pool = await getPool();
  const request = pool.request();
  request.input('CompanyId', companyId);
  let query = `
    SELECT a.*, p.Nombre AS PlantName, p.Ubicacion AS PlantLocation
    FROM ESG_Alerts a
    LEFT JOIN Plantas p ON a.PlantId = p.PlantaID
    WHERE a.CompanyId = @CompanyId
  `;
  if (plantId != null) {
    request.input('PlantId', plantId);
    query += '\n    AND a.PlantId = @PlantId';
  }
  query += '\n  ORDER BY a.CreatedAt DESC, a.Id DESC';

  const result = await request.query(query);
  return result.recordset.map(mapAlert);
}

export async function deleteAlertsByCompany(companyId) {
  const pool = await getPool();
  await pool.request().input('CompanyId', companyId).query(`
    DELETE FROM ESG_Alerts
    WHERE CompanyId = @CompanyId
  `);
}

export async function insertAlerts(alerts) {
  if (!alerts?.length) return [];
  const pool = await getPool();
  const created = [];
  for (const alert of alerts) {
    const request = pool.request();
    request.input('CompanyId', alert.companyId);
    request.input('PlantId', alert.plantId ?? null);
    request.input('IndicatorKey', alert.indicatorKey);
    request.input('CurrentValue', alert.currentValue ?? null);
    request.input('PredictedValue', alert.predictedValue ?? null);
    request.input('RiskLevel', alert.riskLevel);
    request.input('Message', alert.message);

    const result = await request.query(`
      INSERT INTO ESG_Alerts (CompanyId, PlantId, IndicatorKey, CurrentValue, PredictedValue, RiskLevel, Message)
      OUTPUT INSERTED.*
      VALUES (@CompanyId, @PlantId, @IndicatorKey, @CurrentValue, @PredictedValue, @RiskLevel, @Message)
    `);

    if (result.recordset[0]) {
      created.push(mapAlert(result.recordset[0]));
    }
  }
  return created;
}

export async function replaceAlerts(companyId, alerts) {
  await deleteAlertsByCompany(companyId);
  if (!alerts?.length) {
    return [];
  }
  return insertAlerts(alerts);
}
