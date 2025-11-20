import { getPool } from '../config/db.js';

const TABLE = 'Plantas';

function mapPlant(row) {
  if (!row) return null;
  return {
    id: row.PlantaID,
    companyId: row.EmpresaID,
    name: row.Nombre,
    location: row.Ubicacion ?? null,
    latitude: row.Latitud != null ? Number(row.Latitud) : null,
    longitude: row.Longitud != null ? Number(row.Longitud) : null,
    description: row.Descripcion ?? null,
    createdAt: row.FechaCreacion ?? null,
  };
}

export async function listPlantsByCompany(companyId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId)
    .query(`
      SELECT *
      FROM ${TABLE}
      WHERE EmpresaID = @EmpresaID
      ORDER BY Nombre
    `);
  return result.recordset.map(mapPlant);
}

export async function getPlantById(plantId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('PlantaID', plantId)
    .query(`
      SELECT *
      FROM ${TABLE}
      WHERE PlantaID = @PlantaID
    `);
  return mapPlant(result.recordset[0]);
}

export async function getPlantByIdAndCompany(plantId, companyId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('PlantaID', plantId)
    .input('EmpresaID', companyId)
    .query(`
      SELECT *
      FROM ${TABLE}
      WHERE PlantaID = @PlantaID AND EmpresaID = @EmpresaID
    `);
  return mapPlant(result.recordset[0]);
}

export async function createPlant(companyId, payload) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('Nombre', payload.name);
  request.input('Ubicacion', payload.location ?? null);
  request.input('Latitud', payload.latitude);
  request.input('Longitud', payload.longitude);
  request.input('Descripcion', payload.description ?? null);

  const result = await request.query(`
    INSERT INTO ${TABLE} (EmpresaID, Nombre, Ubicacion, Descripcion, Latitud, Longitud)
    OUTPUT INSERTED.*
    VALUES (@EmpresaID, @Nombre, @Ubicacion, @Descripcion, @Latitud, @Longitud)
  `);

  return mapPlant(result.recordset[0]);
}

export async function deletePlant(companyId, plantId) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('PlantaID', plantId);

  const result = await request.query(`
    DELETE FROM ${TABLE}
    OUTPUT DELETED.*
    WHERE PlantaID = @PlantaID AND EmpresaID = @EmpresaID
  `);

  return mapPlant(result.recordset[0]);
}
