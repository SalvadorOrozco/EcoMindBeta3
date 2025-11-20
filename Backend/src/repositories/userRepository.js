import { getPool } from '../config/db.js';

function mapUser(record, { includePassword } = {}) {
  if (!record) return null;
  const user = {
    id: record.UsuarioID,
    companyId: record.EmpresaID,
    name: record.Nombre,
    email: record.Email,
    role: record.Rol ?? 'viewer',
    createdAt: record.FechaRegistro ?? null,
  };
  if (includePassword) {
    user.passwordHash = record.PasswordHash;
  }
  return user;
}

export async function findUserByEmail(email, { includePassword = false } = {}) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('Email', email)
    .query(`
      SELECT UsuarioID, EmpresaID, Nombre, Email, PasswordHash, Rol
      FROM Usuarios
      WHERE Email = @Email
    `);
  return mapUser(result.recordset[0], { includePassword });
}

export async function createUser({ name, email, passwordHash, companyId = null, role = 'manager' }) {
  const pool = await getPool();
  const request = pool.request();
  request.input('Nombre', name);
  request.input('Email', email);
  request.input('PasswordHash', passwordHash);
  request.input('EmpresaID', companyId);
  request.input('Rol', role);
  const result = await request.query(`
    INSERT INTO Usuarios (Nombre, Email, PasswordHash, EmpresaID, Rol)
    OUTPUT INSERTED.UsuarioID, INSERTED.EmpresaID, INSERTED.Nombre, INSERTED.Email, INSERTED.Rol
    VALUES (@Nombre, @Email, @PasswordHash, @EmpresaID, @Rol)
  `);
  return mapUser(result.recordset[0]);
}

export async function getUserById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('UsuarioID', id)
    .query(`
      SELECT UsuarioID, EmpresaID, Nombre, Email, Rol
      FROM Usuarios
      WHERE UsuarioID = @UsuarioID
    `);
  return mapUser(result.recordset[0]);
}

export async function assignCompanyToUser(userId, companyId) {
  const pool = await getPool();
  await pool
    .request()
    .input('UsuarioID', userId)
    .input('EmpresaID', companyId)
    .query(`
      UPDATE Usuarios
      SET EmpresaID = @EmpresaID
      WHERE UsuarioID = @UsuarioID
    `);
}
