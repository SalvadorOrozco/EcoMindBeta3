import { useEffect, useMemo, useState } from 'react';
import { fetchPlants } from '../services/api.js';

export default function PlantSelector({
  companyId,
  value,
  onChange,
  allowAllOption = false,
  label = 'Planta',
  disabled = false,
  helper,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadPlants() {
      if (!companyId) {
        setOptions([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPlants(companyId);
        if (active) {
          setOptions(result);
          if (value && !result.some((item) => item.id === value.id)) {
            onChange?.(null);
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message ?? 'No se pudieron cargar las plantas');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPlants();

    return () => {
      active = false;
    };
  }, [companyId]);

  const selectedValue = useMemo(() => value?.id ?? '', [value?.id]);

  function handleChange(event) {
    const { value: targetValue } = event.target;
    if (!targetValue) {
      onChange?.(null);
      return;
    }
    const numericId = Number(targetValue);
    const plant = options.find((item) => item.id === numericId) ?? null;
    onChange?.(plant);
  }

  const disableSelect = disabled || loading || (!allowAllOption && !options.length);

  return (
    <div className="plant-selector">
      <div className="plant-selector-header">
        <span className="badge">{label}</span>
        {loading && <span className="muted">Cargando...</span>}
      </div>
      <select value={selectedValue} onChange={handleChange} disabled={disableSelect}>
        {allowAllOption && <option value="">Todas las plantas</option>}
        {!allowAllOption && <option value="">Seleccionar</option>}
        {options.map((plantOption) => (
          <option key={plantOption.id} value={plantOption.id}>
            {plantOption.name}
          </option>
        ))}
      </select>
      {error && <p className="text-error">{error}</p>}
      {!error && !loading && options.length === 0 && companyId && (
        <p className="muted">No hay plantas registradas para esta empresa.</p>
      )}
      {helper && <p className="muted">{helper}</p>}
    </div>
  );
}
