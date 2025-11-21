import { getPool } from '../config/db.js';

const TABLE = 'IndicadoresPersonalizados';

const plantFields = `
  p.PlantaID as PlantaID,
  p.Nombre as PlantaNombre,
  p.Ubicacion as PlantaUbicacion,
  p.Descripcion as PlantaDescripcion
`;

function mapIndicator(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.EmpresaID,
    plantId: row.PlantaID,
    name: row.Nombre,
    category: row.Categoria,
    value: row.Valor != null ? Number(row.Valor) : null,
    period: row.Periodo ?? null,
    unit: row.Unidad ?? null,
    description: row.Descripcion ?? null,
    createdAt: row.FechaCreacion,
    plant: row.PlantaID
      ? {
          id: row.PlantaID,
          name: row.PlantaNombre ?? null,
          location: row.PlantaUbicacion ?? null,
          description: row.PlantaDescripcion ?? null,
        }
      : null,
  };
}

export async function listCustomIndicators(companyId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId)
    .query(`
      SELECT i.*, ${plantFields}
      FROM ${TABLE} i
      LEFT JOIN Plantas p ON i.PlantaID = p.PlantaID AND p.EmpresaID = i.EmpresaID
      WHERE i.EmpresaID = @EmpresaID
      ORDER BY FechaCreacion DESC, Id DESC
    `);
  return result.recordset.map(mapIndicator);
}

export async function listIndicatorsByPlant(companyId, plantId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId)
    .input('PlantaID', plantId)
    .query(`
      SELECT i.*, ${plantFields}
      FROM ${TABLE} i
      LEFT JOIN Plantas p ON i.PlantaID = p.PlantaID AND p.EmpresaID = i.EmpresaID
      WHERE i.EmpresaID = @EmpresaID AND i.PlantaID = @PlantaID
      ORDER BY FechaCreacion DESC, Id DESC
    `);
  return result.recordset.map(mapIndicator);
}

export async function listIndicatorsGroupedByPlant(companyId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId)
    .query(`
      SELECT i.*, ${plantFields}
      FROM ${TABLE} i
      LEFT JOIN Plantas p ON i.PlantaID = p.PlantaID AND p.EmpresaID = i.EmpresaID
      WHERE i.EmpresaID = @EmpresaID
      ORDER BY p.Nombre, FechaCreacion DESC, Id DESC
    `);
  return result.recordset.map(mapIndicator);
}

export async function createCustomIndicator(companyId, payload) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('PlantaID', payload.plantId ?? null);
  request.input('Nombre', payload.name);
  request.input('Categoria', payload.category);
  request.input('Valor', payload.value);
  request.input('Periodo', payload.period ?? null);
  request.input('Unidad', payload.unit ?? null);
  request.input('Descripcion', payload.description ?? null);

  const result = await request.query(`
    INSERT INTO ${TABLE} (EmpresaID, PlantaID, Nombre, Categoria, Valor, Periodo, Unidad, Descripcion)
    OUTPUT INSERTED.*
    VALUES (@EmpresaID, @PlantaID, @Nombre, @Categoria, @Valor, @Periodo, @Unidad, @Descripcion)
  `);

  const inserted = result.recordset[0];
  if (!inserted) {
    return null;
  }

  return getCustomIndicatorById(inserted.Id);
}

export async function getCustomIndicatorById(indicatorId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Id', indicatorId)
    .query(`
      SELECT i.*, ${plantFields}
      FROM ${TABLE} i
      LEFT JOIN Plantas p ON i.PlantaID = p.PlantaID AND p.EmpresaID = i.EmpresaID
      WHERE i.Id = @Id
    `);
  return mapIndicator(result.recordset[0]);
}

export async function deleteCustomIndicator(companyId, indicatorId) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('Id', indicatorId);

  const result = await request.query(`
    DELETE FROM ${TABLE}
    OUTPUT DELETED.*
    WHERE Id = @Id AND EmpresaID = @EmpresaID
  `);

  return mapIndicator(result.recordset[0]);
}
