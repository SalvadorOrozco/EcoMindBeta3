import { getPool } from '../config/db.js';

export async function createEvidenceRecord({
  companyId,
  period,
  type,
  indicator,
  fileName,
  storagePath,
  provider,
  publicUrl,
  metadata = null,
}) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', companyId)
    .input('Periodo', period)
    .input('Tipo', type)
    .input('Indicador', indicator ?? null)
    .input('NombreArchivo', fileName)
    .input('Ruta', storagePath)
    .input('Proveedor', provider)
    .input('UrlPublica', publicUrl ?? null)
    .input('Metadata', metadata ? JSON.stringify(metadata) : null)
    .query(`
      INSERT INTO EvidenciasIndicadores (
        EmpresaID,
        Periodo,
        Tipo,
        Indicador,
        NombreArchivo,
        Ruta,
        Proveedor,
        UrlPublica,
        Metadata
      )
      OUTPUT INSERTED.*
      VALUES (
        @EmpresaID,
        @Periodo,
        @Tipo,
        @Indicador,
        @NombreArchivo,
        @Ruta,
        @Proveedor,
        @UrlPublica,
        @Metadata
      )
    `);

  return mapEvidence(result.recordset[0]);
}

export async function listEvidence({ companyId, period, type }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  if (period) request.input('Periodo', period);
  if (type) request.input('Tipo', type);
  const conditions = ['EmpresaID = @EmpresaID'];
  if (period) conditions.push('Periodo = @Periodo');
  if (type) conditions.push('Tipo = @Tipo');

  const result = await request.query(`
    SELECT *
    FROM EvidenciasIndicadores
    WHERE ${conditions.join(' AND ')}
    ORDER BY FechaCarga DESC
  `);
  return result.recordset.map(mapEvidence);
}

export async function getEvidenceById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Id', id)
    .query('SELECT * FROM EvidenciasIndicadores WHERE Id = @Id');
  return result.recordset[0] ? mapEvidence(result.recordset[0]) : null;
}

export async function deleteEvidence(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Id', id)
    .query(`
      DELETE FROM EvidenciasIndicadores
      OUTPUT DELETED.*
      WHERE Id = @Id
    `);
  return result.recordset[0] ? mapEvidence(result.recordset[0]) : null;
}

function mapEvidence(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.EmpresaID,
    period: row.Periodo,
    type: row.Tipo,
    indicator: row.Indicador,
    fileName: row.NombreArchivo,
    storagePath: row.Ruta,
    provider: row.Proveedor,
    publicUrl: row.UrlPublica,
    metadata: row.Metadata ? safeJson(row.Metadata) : null,
    uploadedAt: row.FechaCarga,
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}
