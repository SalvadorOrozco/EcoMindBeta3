import React from "react";
import "../styles/pillarSummary.css";


function formatNumber(value, options = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/D";
  }
  const formatter = new Intl.NumberFormat("es-UY", options);
  return formatter.format(value);
}

function computeScore(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  const total = valid.reduce((sum, current) => sum + current, 0);
  return Math.round(total / valid.length);
}

const SEVERITY_PRIORITY = { critical: 3, warning: 2, info: 1 };
const SEVERITY_LABELS = { critical: "Crítico", warning: "Advertencia", info: "Observación" };

export default function PillarSummary({ metrics, period, anomalies = {} }) {
  if (!metrics) return null;

  /* === SCORES === */
  const environmentalScore = computeScore([
    metrics.environmental?.porcentajeRenovable,
    metrics.environmental?.reciclajePorc,
    metrics.environmental?.residuosValorizadosPorc,
  ]);

  const socialScore = computeScore([
    metrics.social?.porcentajeMujeres,
    metrics.social?.indiceSatisfaccion,
    metrics.social?.capacitacionDerechosHumanosPorc,
    metrics.social?.evaluacionesProveedoresSosteniblesPorc,
  ]);

  const governanceScore = computeScore([
    metrics.governance?.cumplimientoNormativo,
    metrics.governance?.porcentajeDirectoresIndependientes,
    metrics.governance?.diversidadDirectorioPorc,
    metrics.governance?.capacitacionGobiernoEsgPorc,
  ]);

  /* === CARD DATA === */
  const cards = [
    {
      key: "environmental",
      title: "Ambiental",
      description: "Uso responsable de recursos, energía y emisiones.",
      score: environmentalScore,
      highlights: [
        {
          indicator: "energiaKwh",
          label: "Energía total",
          value:
            metrics.environmental?.energiaKwh != null
              ? `${formatNumber(metrics.environmental.energiaKwh, { maximumFractionDigits: 0 })} kWh`
              : "N/D",
        },
        {
          indicator: "emisionesCO2",
          label: "Emisiones CO₂",
          value:
            metrics.environmental?.emisionesCO2 != null
              ? `${formatNumber(metrics.environmental.emisionesCO2, { maximumFractionDigits: 1 })} t`
              : "N/D",
        },
        {
          indicator: "porcentajeRenovable",
          label: "Energía renovable",
          value:
            metrics.environmental?.porcentajeRenovable != null
              ? `${formatNumber(metrics.environmental.porcentajeRenovable, { maximumFractionDigits: 1 })}%`
              : "N/D",
        },
      ],
    },
    {
      key: "social",
      title: "Social",
      description: "Talento, comunidad y bienestar de las personas.",
      score: socialScore,
      highlights: [
        {
          indicator: "porcentajeMujeres",
          label: "Mujeres en liderazgo",
          value:
            metrics.social?.porcentajeMujeres != null
              ? `${formatNumber(metrics.social.porcentajeMujeres, { maximumFractionDigits: 1 })}%`
              : "N/D",
        },
        {
          indicator: "indiceSatisfaccion",
          label: "Índice de satisfacción",
          value:
            metrics.social?.indiceSatisfaccion != null
              ? `${formatNumber(metrics.social.indiceSatisfaccion, { maximumFractionDigits: 1 })}%`
              : "N/D",
        },
        {
          indicator: "inversionComunidadUsd",
          label: "Inversión comunitaria",
          value:
            metrics.social?.inversionComunidadUsd != null
              ? `$ ${formatNumber(metrics.social.inversionComunidadUsd, { maximumFractionDigits: 0 })}`
              : "N/D",
        },
      ],
    },
    {
      key: "governance",
      title: "Gobernanza",
      description: "Transparencia, ética corporativa y cumplimiento.",
      score: governanceScore,
      highlights: [
        {
          indicator: "cumplimientoNormativo",
          label: "Cumplimiento normativo",
          value:
            metrics.governance?.cumplimientoNormativo != null
              ? `${formatNumber(metrics.governance.cumplimientoNormativo, { maximumFractionDigits: 1 })}%`
              : "N/D",
        },
        {
          indicator: "porcentajeDirectoresIndependientes",
          label: "Directores independientes",
          value:
            metrics.governance?.porcentajeDirectoresIndependientes != null
              ? `${formatNumber(metrics.governance.porcentajeDirectoresIndependientes, { maximumFractionDigits: 1 })}%`
              : "N/D",
        },
        {
          indicator: "auditoriasCompliance",
          label: "Auditorías de compliance",
          value:
            metrics.governance?.auditoriasCompliance != null
              ? formatNumber(metrics.governance.auditoriasCompliance, { maximumFractionDigits: 0 })
              : "N/D",
        },
      ],
    },
  ];

  return (
    <section className="pillar-summary">
      <header className="section-header">
        <h3>Resumen por pilar</h3>
        <p className="muted">Resultados consolidados para el periodo {period}.</p>
      </header>

      <div className="pillar-summary-grid">
        {cards.map((card) => {
          const severity = resolvePillarSeverity(card, anomalies);
          const cardClass = severity ? `pillar-card pillar-${severity}` : "pillar-card";

          return (
            <article key={card.key} className={cardClass}>
              <div className="pillar-card-header">
                <h4>{card.title}</h4>
                <span className="score-chip">
                  {card.score !== null ? `${card.score}%` : "N/D"}
                </span>
              </div>

              <p className="muted">{card.description}</p>

              <dl className="pillar-stats">
                {card.highlights.map((item) => {
                  const itemSeverity = anomalies?.[item.indicator];
                  const highlightClass = itemSeverity ? `highlight-${itemSeverity}` : "";

                  return (
                    <div key={item.label} className={`pillar-row ${highlightClass}`}>
                      <dt>{item.label}</dt>
                      <dd>
                        {item.value}
                        {itemSeverity && (
                          <span className="highlight-badge">
                            {SEVERITY_LABELS[itemSeverity] ?? "Atención"}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function resolvePillarSeverity(card, anomalies) {
  let severity = null;
  card.highlights.forEach((item) => {
    const indicatorSeverity = anomalies?.[item.indicator];
    if (!indicatorSeverity) return;
    if (!severity || SEVERITY_PRIORITY[indicatorSeverity] > SEVERITY_PRIORITY[severity]) {
      severity = indicatorSeverity;
    }
  });
  return severity;
}
