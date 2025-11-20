import { useEffect, useId, useState } from 'react';
import { createCompany, deleteCompany, fetchCompanies, updateCompany } from '../services/api.js';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY_FORM = { name: '', ruc: '', address: '', industry: '' };

export default function CompaniesPage() {
  const { user, refreshProfile } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const isLinkedToCompany = Boolean(user?.companyId);
  const canCreateCompany = !isLinkedToCompany;

  useEffect(() => {
    loadCompanies();
  }, [user]);

  async function loadCompanies() {
    setLoading(true);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
      if (user?.companyId && data.length === 1) {
        const [company] = data;
        setEditing(company.id);
        setForm({
          name: company.name ?? '',
          ruc: company.ruc ?? '',
          address: company.address ?? '',
          industry: company.industry ?? '',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(company) {
    if (isLinkedToCompany && company.id !== user.companyId) {
      setError('Solo puedes editar la empresa asociada a tu cuenta.');
      setMessage(null);
      return;
    }
    setError(null);
    setMessage(null);
    setEditing(company.id);
    setForm({
      name: company.name,
      ruc: company.ruc ?? '',
      address: company.address ?? '',
      industry: company.industry ?? '',
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editing && !canCreateCompany) {
      setError('Tu cuenta ya está asociada a una empresa.');
      return;
    }
    setLoading(true);
    try {
      setError(null);
      if (editing) {
        await updateCompany(editing, form);
        setMessage('Empresa actualizada correctamente.');
      } else {
        await createCompany(form);
        setMessage('Empresa creada correctamente.');
        await refreshProfile();
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      await loadCompanies();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (isLinkedToCompany) {
      setError('No puedes eliminar la empresa asociada a tu cuenta.');
      setMessage(null);
      return;
    }
    if (!window.confirm('¿Eliminar la empresa seleccionada?')) return;
    setLoading(true);
    try {
      setError(null);
      await deleteCompany(id);
      setMessage('Empresa eliminada.');
      await loadCompanies();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Empresas registradas</h2>
          <p>Administra las organizaciones que reportan indicadores ESG.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="page-header">
          <div>
            <h3>{editing ? 'Editar empresa' : 'Nueva empresa'}</h3>
            {!canCreateCompany && (
              <p className="form-hint">
                Tu cuenta está vinculada a una empresa. Puedes actualizar sus datos pero no crear
                nuevas organizaciones.
              </p>
            )}
          </div>
          <button className="primary-button" type="submit" disabled={loading || (!editing && !canCreateCompany)}>
            {editing ? 'Actualizar' : 'Crear'}
          </button>
        </div>
        <div className="form-grid">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            required
          />
          <Input
            label="RUC"
            value={form.ruc}
            onChange={(value) => setForm((prev) => ({ ...prev, ruc: value }))}
          />
          <Input
            label="Dirección"
            value={form.address}
            onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
          />
          <Input
            label="Rubro"
            value={form.industry}
            onChange={(value) => setForm((prev) => ({ ...prev, industry: value }))}
          />
        </div>
      </form>

      {message && <div className="alert">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <LoadingIndicator label="Sincronizando empresas..." />}

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>RUC</th>
            <th>Dirección</th>
            <th>Rubro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id}>
              <td>{company.name}</td>
              <td>{company.ruc ?? 'N/D'}</td>
              <td>{company.address ?? 'N/D'}</td>
              <td>{company.industry ?? 'N/D'}</td>
              <td>
                <div className="table-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => handleEdit(company)}
                    disabled={isLinkedToCompany && company.id !== user?.companyId}
                  >
                    Editar
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleDelete(company.id)}
                    disabled={isLinkedToCompany}
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Input({ label, value, onChange, required = false }) {
  const inputId = useId();
  return (
    <div className="form-field">
      <label htmlFor={inputId}>
        {label}
        {required && ' *'}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="form-control"
      />
    </div>
  );
}
