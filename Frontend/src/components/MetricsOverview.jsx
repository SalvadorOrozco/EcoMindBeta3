function formatValue(value) {
  if (value === null || value === undefined) return 'N/D';
  if (typeof value === 'number') return value.toFixed(2);
  return value;
}

const SEVERITY_LABELS = {
  critical: 'Crítico',
  warning: 'Advertencia',
  info: 'Observación',
};

export default function MetricsOverview({ metrics, anomalies = {} }) {
  if (!metrics) return null;

  const environmentalItems = [
    {
      indicator: 'energiaKwh',
      title: 'Consumo Energético (kWh)',
      value: formatValue(metrics.environmental?.energiaKwh),
    },
    {
      indicator: 'porcentajeRenovable',
      title: 'Energía renovable (%)',
      value: formatValue(metrics.environmental?.porcentajeRenovable),
      progress: metrics.environmental?.porcentajeRenovable,
    },
    {
      indicator: 'emisionesCO2',
      title: 'Emisiones CO₂ (t)',
      value: formatValue(metrics.environmental?.emisionesCO2),
    },
    {
      indicator: 'emisionesAlcance1',
      title: 'Emisiones Alcance 1 (t)',
      value: formatValue(metrics.environmental?.emisionesAlcance1),
    },
    {
      indicator: 'emisionesAlcance2',
      title: 'Emisiones Alcance 2 (t)',
      value: formatValue(metrics.environmental?.emisionesAlcance2),
    },
    {
      indicator: 'emisionesAlcance3',
      title: 'Emisiones Alcance 3 (t)',
      value: formatValue(metrics.environmental?.emisionesAlcance3),
    },
    {
      indicator: 'reciclajePorc',
      title: 'Reciclaje (%)',
      value: formatValue(metrics.environmental?.reciclajePorc),
      progress: metrics.environmental?.reciclajePorc,
    },
    {
      indicator: 'residuosValorizadosPorc',
      title: 'Residuos valorizados (%)',
      value: formatValue(metrics.environmental?.residuosValorizadosPorc),
      progress: metrics.environmental?.residuosValorizadosPorc,
    },
    {
      indicator: 'incidentesAmbientales',
      title: 'Incidentes ambientales',
      value: formatValue(metrics.environmental?.incidentesAmbientales),
    },
    {
      indicator: 'auditoriasAmbientales',
      title: 'Auditorías ambientales',
      value: formatValue(metrics.environmental?.auditoriasAmbientales),
    },
  ];

  const socialItems = [
    {
      indicator: 'porcentajeMujeres',
      title: 'Mujeres en liderazgo (%)',
      value: formatValue(metrics.social?.porcentajeMujeres),
      progress: metrics.social?.porcentajeMujeres,
    },
    {
      indicator: 'diversidadGeneroPorc',
      title: 'Diversidad de género (%)',
      value: formatValue(metrics.social?.diversidadGeneroPorc),
      progress: metrics.social?.diversidadGeneroPorc,
    },
    {
      indicator: 'indiceSatisfaccion',
      title: 'Índice de satisfacción (%)',
      value: formatValue(metrics.social?.indiceSatisfaccion),
      progress: metrics.social?.indiceSatisfaccion,
    },
    {
      indicator: 'tasaRotacion',
      title: 'Tasa de rotación (%)',
      value: formatValue(metrics.social?.tasaRotacion),
    },
    {
      indicator: 'capacitacionDerechosHumanosPorc',
      title: 'Capacitación en derechos humanos (%)',
      value: formatValue(metrics.social?.capacitacionDerechosHumanosPorc),
      progress: metrics.social?.capacitacionDerechosHumanosPorc,
    },
    {
      indicator: 'inversionComunidadUsd',
      title: 'Inversión en comunidad (USD)',
      value: formatValue(metrics.social?.inversionComunidadUsd),
    },
    {
      indicator: 'horasVoluntariado',
      title: 'Horas de voluntariado',
      value: formatValue(metrics.social?.horasVoluntariado),
    },
    {
      indicator: 'evaluacionesProveedoresSosteniblesPorc',
      title: 'Evaluaciones a proveedores sostenibles (%)',
      value: formatValue(metrics.social?.evaluacionesProveedoresSosteniblesPorc),
      progress: metrics.social?.evaluacionesProveedoresSosteniblesPorc,
    },
  ];

  const governanceItems = [
    {
      indicator: 'cumplimientoNormativo',
      title: 'Cumplimiento normativo (%)',
      value: formatValue(metrics.governance?.cumplimientoNormativo),
      progress: metrics.governance?.cumplimientoNormativo,
    },
    {
      indicator: 'porcentajeDirectoresIndependientes',
      title: 'Directores independientes (%)',
      value: formatValue(metrics.governance?.porcentajeDirectoresIndependientes),
      progress: metrics.governance?.porcentajeDirectoresIndependientes,
    },
    {
      indicator: 'diversidadDirectorioPorc',
      title: 'Diversidad en directorio (%)',
      value: formatValue(metrics.governance?.diversidadDirectorioPorc),
      progress: metrics.governance?.diversidadDirectorioPorc,
    },
    {
      indicator: 'capacitacionGobiernoEsgPorc',
      title: 'Capacitación ESG del directorio (%)',
      value: formatValue(metrics.governance?.capacitacionGobiernoEsgPorc),
      progress: metrics.governance?.capacitacionGobiernoEsgPorc,
    },
    {
      indicator: 'reunionesStakeholders',
      title: 'Reuniones con stakeholders',
      value: formatValue(metrics.governance?.reunionesStakeholders),
    },
    {
      indicator: 'auditoriasCompliance',
      title: 'Auditorías de compliance',
      value: formatValue(metrics.governance?.auditoriasCompliance),
    },
  ];

  const sections = [
    { title: 'Pilar Ambiental', items: environmentalItems },
    { title: 'Pilar Social', items: socialItems },
    { title: 'Pilar Gobernanza', items: governanceItems },
  ];

  return (
    <div className="card-grid">
      {sections.map((section) => (
        <div className="card" key={section.title}>
          <h3>{section.title}</h3>
          <ul className="metric-list">
            {section.items.map((item) => {
              const severity = anomalies?.[item.indicator] ?? null;
              const severityClass = severity ? `metric-${severity}` : '';
              return (
                <li key={item.title} className={severityClass}>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  {typeof item.progress === 'number' && (
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                      />
                    </div>
                  )}
                  {severity && <span className="metric-severity-label">{SEVERITY_LABELS[severity] ?? 'Atención'}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
