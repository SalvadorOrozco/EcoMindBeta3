import { useEffect, useId, useState } from 'react';
import { fetchCompanies } from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';

export default function CompanySelector() {
  const { company, setCompany, period, setPeriod } = useCompany();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await fetchCompanies();
        setCompanies(result);
        if (!company && result.length > 0) {
          setCompany(result[0]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const periodInputId = useId();
  const companySelectId = useId();

  return (
    <div className="selector-bar" role="group" aria-labelledby={`${companySelectId}-label`}>
      <div className="selector-field">
        <label className="selector-field__label" htmlFor={periodInputId}>
          Periodo
        </label>
        <input
          id={periodInputId}
          className="selector-field__input form-control"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          placeholder="2024-Q1"
          aria-label="Periodo del reporte"
        />
      </div>
      <div className="selector-field">
        <label id={`${companySelectId}-label`} className="selector-field__label" htmlFor={companySelectId}>
          Empresa
        </label>
        <select
          id={companySelectId}
          className="selector-field__input form-control"
          value={company?.id ?? ''}
          onChange={(event) => {
            const selected = companies.find((item) => item.id === Number(event.target.value));
            setCompany(selected ?? null);
          }}
          disabled={loading}
        >
          <option value="" disabled>
            {loading ? 'Cargando empresas…' : 'Seleccionar'}
          </option>
          {companies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
