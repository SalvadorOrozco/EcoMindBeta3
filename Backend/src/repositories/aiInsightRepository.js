import { getPool } from '../config/db.js';

const TABLE = 'EvidenciasAI';

export async function createAiInsightRecord({
  companyId,
  period,
  category,
  summary,
  indicators,
  fileName,
  fileType,
  mimeType,
  rawText,
  provider = 'ai-analysis',
}) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  request.input('Periodo', period ?? null);
  request.input('Categoria', category);
  request.input('Resumen', summary);
  request.input('Indicadores', indicators ? JSON.stringify(indicators) : null);
  request.input('NombreArchivo', fileName);
  request.input('TipoArchivo', fileType ?? null);
  request.input('MimeType', mimeType ?? null);
  request.input('TextoExtraido', rawText ?? null);
  request.input('Fuente', provider ?? 'ai-analysis');

  const query = `
    INSERT INTO ${TABLE} (
      EmpresaID,
      Periodo,
      Categoria,
      Resumen,
      Indicadores,
      NombreArchivo,
      TipoArchivo,
      MimeType,
      TextoExtraido,
      Fuente
    )
    OUTPUT INSERTED.*
    VALUES (
      @EmpresaID,
      @Periodo,
      @Categoria,
      @Resumen,
      @Indicadores,
      @NombreArchivo,
      @TipoArchivo,
      @MimeType,
      @TextoExtraido,
      @Fuente
    )
  `;

  const result = await request.query(query);
  return mapRow(result.recordset[0]);
}

export async function listAiInsights({ companyId, period }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('EmpresaID', companyId);
  if (period) {
    request.input('Periodo', period);
  }

  const conditions = ['EmpresaID = @EmpresaID'];
  if (period) {
    conditions.push('Periodo = @Periodo');
  }

  const query = `
    SELECT *
    FROM ${TABLE}
    WHERE ${conditions.join(' AND ')}
    ORDER BY FechaAnalisis DESC
  `;

  const result = await request.query(query);
  return result.recordset.map(mapRow);
}

export async function deleteAiInsight(id, companyId) {
  const pool = await getPool();
  const request = pool.request();
  request.input('Id', id);
  if (companyId) {
    request.input('EmpresaID', companyId);
  }

  const condition = companyId ? 'Id = @Id AND EmpresaID = @EmpresaID' : 'Id = @Id';
  const query = `
    DELETE FROM ${TABLE}
    OUTPUT DELETED.*
    WHERE ${condition}
  `;

  const result = await request.query(query);
  return result.recordset[0] ? mapRow(result.recordset[0]) : null;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.Id,
    companyId: row.EmpresaID,
    period: row.Periodo,
    category: row.Categoria,
    summary: row.Resumen,
    indicators: parseJson(row.Indicadores),
    fileName: row.NombreArchivo,
    fileType: row.TipoArchivo,
    mimeType: row.MimeType,
    rawText: row.TextoExtraido ?? null,
    provider: row.Fuente ?? 'ai-analysis',
    analyzedAt: row.FechaAnalisis,
  };
}

function parseJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

