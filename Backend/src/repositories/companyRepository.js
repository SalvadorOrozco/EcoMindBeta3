import { getPool } from '../config/db.js';

let columnAvailabilityCache = null;

async function getColumnAvailability() {
  if (columnAvailabilityCache) {
    return columnAvailabilityCache;
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .query(`
      SELECT LOWER(COLUMN_NAME) as name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Empresas'
    `);

  const names = new Set(result.recordset.map((row) => row.name));
  columnAvailabilityCache = {
    ruc: names.has('ruc'),
    address: names.has('direccion'),
    industry: names.has('rubro'),
    createdAt: names.has('fecharegistro'),
  };
  return columnAvailabilityCache;
}

async function buildSelectQuery() {
  const columns = await getColumnAvailability();
  const selectParts = ['EmpresaID as id', 'Nombre as name'];
  selectParts.push(columns.ruc ? 'RUC as ruc' : 'NULL as ruc');
  selectParts.push(columns.address ? 'Direccion as address' : 'NULL as address');
  selectParts.push(columns.industry ? 'Rubro as industry' : 'NULL as industry');
  selectParts.push(columns.createdAt ? 'FechaRegistro as createdAt' : 'NULL as createdAt');

  return `SELECT ${selectParts.join(', ')} FROM Empresas`;
}

export async function getCompanies() {
  const pool = await getPool();
  const selectQuery = await buildSelectQuery();
  const result = await pool.request().query(`${selectQuery} ORDER BY Nombre`);
  return result.recordset;
}

export async function getCompanyById(id) {
  const pool = await getPool();
  const selectQuery = await buildSelectQuery();
  const result = await pool
    .request()
    .input('EmpresaID', id)
    .query(`${selectQuery} WHERE EmpresaID = @EmpresaID`);
  return result.recordset[0] ?? null;
}

export async function createCompany(company) {
  const pool = await getPool();
  const columns = await getColumnAvailability();
  const request = pool.request();

  const columnNames = ['Nombre'];
  const valueParams = ['@Nombre'];
  request.input('Nombre', company.name);

  if (columns.ruc) {
    columnNames.push('RUC');
    valueParams.push('@RUC');
    request.input('RUC', company.ruc ?? null);
  }

  if (columns.address) {
    columnNames.push('Direccion');
    valueParams.push('@Direccion');
    request.input('Direccion', company.address ?? null);
  }

  if (columns.industry) {
    columnNames.push('Rubro');
    valueParams.push('@Rubro');
    request.input('Rubro', company.industry ?? null);
  }

  const result = await request.query(`
    INSERT INTO Empresas (${columnNames.join(', ')})
    OUTPUT INSERTED.EmpresaID as id
    VALUES (${valueParams.join(', ')})
  `);

  return {
    id: result.recordset[0].id,
    ...company,
    ruc: columns.ruc ? company.ruc ?? null : null,
    address: columns.address ? company.address ?? null : null,
    industry: columns.industry ? company.industry ?? null : null,
  };
}

export async function updateCompany(id, company) {
  const pool = await getPool();
  const columns = await getColumnAvailability();
  const request = pool.request();
  request.input('EmpresaID', id);
  request.input('Nombre', company.name);

  const setClauses = ['Nombre = @Nombre'];

  if (columns.ruc) {
    request.input('RUC', company.ruc ?? null);
    setClauses.push('RUC = @RUC');
  }

  if (columns.address) {
    request.input('Direccion', company.address ?? null);
    setClauses.push('Direccion = @Direccion');
  }

  if (columns.industry) {
    request.input('Rubro', company.industry ?? null);
    setClauses.push('Rubro = @Rubro');
  }

  const result = await request.query(`
    UPDATE Empresas
    SET ${setClauses.join(', ')}
    WHERE EmpresaID = @EmpresaID;
    SELECT @@ROWCOUNT as affected;
  `);
  return result.recordset[0].affected > 0;
}

export async function deleteCompany(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('EmpresaID', id)
    .query(`DELETE FROM Empresas WHERE EmpresaID = @EmpresaID; SELECT @@ROWCOUNT as affected;`);
  return result.recordset[0].affected > 0;
}
