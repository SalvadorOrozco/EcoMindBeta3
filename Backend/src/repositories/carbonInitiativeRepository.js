import { getPool } from '../config/db.js';

function mapInitiative(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.CompanyId,
    name: row.Name,
    costUSD: row.CostUSD != null ? Number(row.CostUSD) : null,
    co2ReductionTons: row.Co2ReductionTons != null ? Number(row.Co2ReductionTons) : null,
    description: row.Description ?? null,
    createdAt: row.CreatedAt,
  };
}

export async function createInitiative({ companyId, name, costUSD, co2ReductionTons, description }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('CompanyId', companyId);
  request.input('Name', name);
  request.input('CostUSD', costUSD ?? null);
  request.input('Co2ReductionTons', co2ReductionTons ?? null);
  request.input('Description', description ?? null);

  const result = await request.query(`
    INSERT INTO CarbonInitiatives (CompanyId, Name, CostUSD, Co2ReductionTons, Description)
    OUTPUT INSERTED.*
    VALUES (@CompanyId, @Name, @CostUSD, @Co2ReductionTons, @Description)
  `);

  return mapInitiative(result.recordset[0]);
}

export async function listInitiativesByCompany(companyId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('CompanyId', companyId)
    .query(`
      SELECT *
      FROM CarbonInitiatives
      WHERE CompanyId = @CompanyId
      ORDER BY CreatedAt DESC, Id DESC
    `);
  return result.recordset.map(mapInitiative);
}
