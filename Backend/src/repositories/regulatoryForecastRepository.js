import { getPool } from '../config/db.js';

function mapForecast(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.CompanyId,
    category: row.Category,
    region: row.Region,
    forecastText: row.ForecastText,
    probability: row.Probability != null ? Number(row.Probability) : null,
    impactLevel: row.ImpactLevel,
    dateCreated: row.DateCreated,
  };
}

export async function listForecasts(companyId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('CompanyId', companyId)
    .query(`
      SELECT *
      FROM RegulatoryForecasts
      WHERE CompanyId = @CompanyId
      ORDER BY DateCreated DESC, Id DESC
    `);
  return result.recordset.map(mapForecast);
}

export async function deleteForecastsByCompany(companyId) {
  const pool = await getPool();
  await pool.request().input('CompanyId', companyId).query(`
    DELETE FROM RegulatoryForecasts
    WHERE CompanyId = @CompanyId
  `);
}

export async function insertForecasts(forecasts) {
  if (!forecasts?.length) return [];
  const pool = await getPool();
  const created = [];

  for (const forecast of forecasts) {
    const request = pool.request();
    request.input('CompanyId', forecast.companyId);
    request.input('Category', forecast.category);
    request.input('Region', forecast.region ?? 'global');
    request.input('ForecastText', forecast.forecastText);
    request.input('Probability', forecast.probability ?? 0);
    request.input('ImpactLevel', forecast.impactLevel ?? 'medium');

    const result = await request.query(`
      INSERT INTO RegulatoryForecasts (CompanyId, Category, Region, ForecastText, Probability, ImpactLevel)
      OUTPUT INSERTED.*
      VALUES (@CompanyId, @Category, @Region, @ForecastText, @Probability, @ImpactLevel)
    `);

    if (result.recordset[0]) {
      created.push(mapForecast(result.recordset[0]));
    }
  }

  return created;
}

export async function replaceForecasts(companyId, forecasts) {
  await deleteForecastsByCompany(companyId);
  if (!forecasts?.length) return [];
  return insertForecasts(forecasts);
}
