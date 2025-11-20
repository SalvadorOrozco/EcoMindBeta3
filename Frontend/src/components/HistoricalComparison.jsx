function formatValue(value, { isPercent = false, isCurrency = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/D';
  }
  if (isPercent) {
    return `${value.toFixed(1)}%`;
  }
  if (isCurrency) {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat('es-UY', {
    maximumFractionDigits: 2,
  }).format(value);
}

export default function HistoricalComparison({ history, currentPeriod }) {
  if (!history || history.length === 0) {
    return null;
  }

  const columns = [
    { key: 'energiaKwh', label: 'Energía (kWh)' },
    { key: 'emisionesCO2', label: 'Emisiones CO₂ (t)' },
    { key: 'inversionComunidadUsd', label: 'Inversión social (USD)', isCurrency: true },
    { key: 'cumplimientoNormativo', label: 'Cumplimiento normativo (%)', isPercent: true },
  ];

  return (
    <section className="card">
      <h3>Comparativa histórica</h3>
      <p className="muted">
        Analiza la evolución anual de los principales indicadores ESG y detecta avances o retrocesos.
      </p>
      <div className="table-responsive">
        <table className="table history-table">
          <thead>
            <tr>
              <th>Periodo</th>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.period} className={item.period === currentPeriod ? 'row-current' : undefined}>
                <td>
                  {item.period}
                  {item.period === currentPeriod && <span className="badge badge-primary">Actual</span>}
                </td>
                {columns.map((column) => (
                  <td key={column.key}>
                    {formatValue(item[column.key], {
                      isPercent: column.isPercent,
                      isCurrency: column.isCurrency,
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
