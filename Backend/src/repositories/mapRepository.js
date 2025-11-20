import { getPool } from '../config/db.js';

const TABLE = 'EmpresaUbicaciones';

function mapMarker(row) {
  if (!row) return null;
  return {
    companyId: row.EmpresaID,
    companyName: row.Nombre ?? row.CompanyName ?? null,
    latitude: row.Latitud != null ? Number(row.Latitud) : null,
    longitude: row.Longitud != null ? Number(row.Longitud) : null,
    esgScore: row.PuntajeEsg != null ? Number(row.PuntajeEsg) : null,
    updatedAt: row.Actualizado ?? row.FechaActualizado ?? row.FechaCreacion ?? null,
    industry: row.Rubro ?? null,
    address: row.Direccion ?? null,
  };
}

function mapPlantMarker(row) {
  if (!row) return null;
  const rawScore =
    row.PromedioEsg ?? row.PromedioESG ?? row.PromedioValor ?? row.PuntajePromedio ?? row.PuntajeEsg;
  const esgScore = rawScore != null ? Number(Number(rawScore).toFixed(2)) : null;
  return {
    type: 'plant',
    id: row.PlantaID,
    plantId: row.PlantaID,
    name: row.PlantaNombre ?? row.NombrePlanta ?? null,
    location: row.PlantaUbicacion ?? row.Ubicacion ?? null,
    description: row.PlantaDescripcion ?? row.Descripcion ?? null,
    companyId: row.EmpresaID,
    companyName: row.EmpresaNombre ?? row.NombreEmpresa ?? row.Nombre ?? null,
    industry: row.Rubro ?? row.EmpresaRubro ?? null,
    latitude: row.Latitud != null ? Number(row.Latitud) : null,
    longitude: row.Longitud != null ? Number(row.Longitud) : null,
    esgScore,
    indicatorCount: row.Indicadores != null ? Number(row.Indicadores) : 0,
  };
}

export async function getSustainabilityMarkers() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT e.EmpresaID, e.Nombre, e.Rubro, e.Direccion,
           loc.Latitud, loc.Longitud, loc.PuntajeEsg, loc.Actualizado
    FROM Empresas e
    LEFT JOIN ${TABLE} loc ON loc.EmpresaID = e.EmpresaID
    ORDER BY e.Nombre
  `);
  return result.recordset.map(mapMarker);
}

export async function getMarkerByCompanyId(companyId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId)
    .query(`
      SELECT e.EmpresaID, e.Nombre, e.Rubro, e.Direccion,
             loc.Latitud, loc.Longitud, loc.PuntajeEsg, loc.Actualizado
      FROM Empresas e
      LEFT JOIN ${TABLE} loc ON loc.EmpresaID = e.EmpresaID
      WHERE e.EmpresaID = @EmpresaID
    `);
  return mapMarker(result.recordset[0]);
}

export async function getPlantMarkers(companyId = null) {
  const pool = await getPool();
  const request = pool.request();
  let whereClause = '';
  if (companyId != null) {
    request.input('EmpresaID', companyId);
    whereClause = 'WHERE p.EmpresaID = @EmpresaID';
  }

  const query = `
    SELECT
      p.PlantaID,
      p.EmpresaID,
      p.Nombre AS PlantaNombre,
      p.Ubicacion AS PlantaUbicacion,
      p.Descripcion AS PlantaDescripcion,
      p.Latitud,
      p.Longitud,
      e.Nombre AS EmpresaNombre,
      e.Rubro,
      AVG(CASE WHEN i.Valor IS NOT NULL THEN CAST(i.Valor AS FLOAT) END) AS PromedioEsg,
      COUNT(CASE WHEN i.Valor IS NOT NULL THEN 1 END) AS Indicadores
    FROM Plantas p
    INNER JOIN Empresas e ON e.EmpresaID = p.EmpresaID
    LEFT JOIN IndicadoresPersonalizados i ON i.PlantaID = p.PlantaID AND i.EmpresaID = p.EmpresaID
    ${whereClause}
    GROUP BY
      p.PlantaID,
      p.EmpresaID,
      p.Nombre,
      p.Ubicacion,
      p.Descripcion,
      p.Latitud,
      p.Longitud,
      e.Nombre,
      e.Rubro
    ORDER BY e.Nombre, p.Nombre
  `;

  const result = await request.query(query);
  return result.recordset.map(mapPlantMarker);
}

export async function upsertMapEntry(companyId, { latitude, longitude, esgScore }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  if (latitude !== undefined) {
    request.input('Latitud', latitude);
  }
  if (longitude !== undefined) {
    request.input('Longitud', longitude);
  }
  if (esgScore !== undefined) {
    request.input('PuntajeEsg', esgScore);
  }

  const fields = [];
  if (latitude !== undefined) {
    fields.push('Latitud = @Latitud');
  }
  if (longitude !== undefined) {
    fields.push('Longitud = @Longitud');
  }
  if (esgScore !== undefined) {
    fields.push('PuntajeEsg = @PuntajeEsg');
  }
  if (fields.length === 0) {
    return getMarkerByCompanyId(companyId);
  }

  fields.push('Actualizado = GETDATE()');

  const updateClause = fields.join(', ');

  await request.query(`
    IF EXISTS (SELECT 1 FROM ${TABLE} WHERE EmpresaID = @EmpresaID)
    BEGIN
      UPDATE ${TABLE}
      SET ${updateClause}
      WHERE EmpresaID = @EmpresaID;
    END
    ELSE
    BEGIN
      INSERT INTO ${TABLE} (EmpresaID${latitude !== undefined ? ', Latitud' : ''}${
        longitude !== undefined ? ', Longitud' : ''
      }${esgScore !== undefined ? ', PuntajeEsg' : ''})
      VALUES (@EmpresaID${latitude !== undefined ? ', @Latitud' : ''}${
        longitude !== undefined ? ', @Longitud' : ''
      }${esgScore !== undefined ? ', @PuntajeEsg' : ''});
    END
  `);

  return getMarkerByCompanyId(companyId);
}

export async function updateMapScore(companyId, esgScore) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('PuntajeEsg', esgScore ?? null);
  await request.query(`
    IF EXISTS (SELECT 1 FROM ${TABLE} WHERE EmpresaID = @EmpresaID)
    BEGIN
      UPDATE ${TABLE}
      SET PuntajeEsg = @PuntajeEsg, Actualizado = GETDATE()
      WHERE EmpresaID = @EmpresaID;
    END
    ELSE
    BEGIN
      INSERT INTO ${TABLE} (EmpresaID, PuntajeEsg)
      VALUES (@EmpresaID, @PuntajeEsg);
    END
  `);
  return getMarkerByCompanyId(companyId);
}