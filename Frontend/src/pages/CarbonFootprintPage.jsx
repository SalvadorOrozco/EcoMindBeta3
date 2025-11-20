import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HiOutlineSparkles, HiOutlineArrowPath } from 'react-icons/hi2';
import CompanySelector from '../components/CompanySelector.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import Notification from '../components/Notification.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import {
  fetchCarbonSummary,
  fetchCarbonHistory,
  calculateCarbonFootprint,
  simulateCarbonScenario,
} from '../services/api.js';

const COUNTRY_OPTIONS = [
  { value: 'GLOBAL', label: 'Global (default)' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'AR', label: 'Argentina' },
  { value: 'BR', label: 'Brasil' },
];

const SCOPE_OPTIONS = [
  { value: 'scope1', label: 'Alcance 1 · Fuentes directas' },
  { value: 'scope2', label: 'Alcance 2 · Electricidad' },
  { value: 'scope3', label: 'Alcance 3 · Cadena de valor' },
  { value: 'all', label: 'Corporativo · Total combinado' },
];

const TREND_COLORS = {
  scope1: '#0b815a',
  scope2: '#2563eb',
  scope3: '#9333ea',
};

export default function CarbonFootprintPage() {
  const { company, period } = useCompany();
  const [carbon, setCarbon] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [countryCode, setCountryCode] = useState('GLOBAL');
  const [scenario, setScenario] = useState({ scope: 'scope2', reductionPercent: 10, description: '' });
  const [simulation, setSimulation] = useState(null);

  useEffect(() => {
    if (!company || !period) {
      setCarbon(null);
      setHistory([]);
      return;
    }
    loadCarbonData(true);
  }, [company, period, countryCode]);

  async function loadCarbonData(autoGenerate = false) {
    if (!company || !period) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = {
        companyId: company.id,
        period,
        auto: autoGenerate,
      };
      if (countryCode && countryCode !== 'GLOBAL') {
        params.countryCode = countryCode;
      }
      const [summary, historyResponse] = await Promise.all([
        fetchCarbonSummary(params),
        fetchCarbonHistory({ companyId: company.id }),
      ]);
      setCarbon(summary);
      setHistory(Array.isArray(historyResponse?.items) ? historyResponse.items : historyResponse ?? []);
      setSimulation(null);
    } catch (err) {
      if (err.status === 404) {
        setCarbon(null);
        setHistory([]);
      } else {
        setError(err.message ?? 'No se pudo obtener la huella de carbono.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    if (!company || !period) {
      return;
    }
    setCalculating(true);
    setError(null);
    try {
      const payload = {
        companyId: company.id,
        period,
      };
      if (countryCode && countryCode !== 'GLOBAL') {
        payload.countryCode = countryCode;
      }
      const result = await calculateCarbonFootprint(payload);
      setCarbon({ ...result.snapshot, breakdown: result.breakdown, scenarios: result.scenarios });
      setHistory(result.history ?? []);
      setToast('Huella de carbono recalculada correctamente.');
      setSimulation(null);
    } catch (err) {
      setError(err.message ?? 'No se pudo recalcular la huella de carbono.');
    } finally {
      setCalculating(false);
    }
  }

  async function handleSimulate(event) {
    event.preventDefault();
    if (!company || !period) {
      return;
    }
    setSimulating(true);
    setError(null);
    try {
      const payload = {
        companyId: company.id,
        period,
        scenario: {
          scope: scenario.scope,
          reductionPercent: Number(scenario.reductionPercent) || 0,
          description: scenario.description || undefined,
          name: `Reducción ${scenario.reductionPercent}% ${scopeLabel(scenario.scope)}`,
        },
      };
      const result = await simulateCarbonScenario(payload);
      setSimulation(result.scenario);
    } catch (err) {
      setError(err.message ?? 'No se pudo simular el escenario.');
    } finally {
      setSimulating(false);
    }
  }

  const breakdownRows = useMemo(() => {
    if (!carbon?.breakdown?.length) {
      return [];
    }
    return carbon.breakdown.map((item, index) => ({
      id: `${item.scope}-${item.category}-${index}`,
      scope: scopeLabel(item.scope),
      category: formatCategory(item.category),
      activity:
        item.activity != null
          ? `${formatNumber(item.activity, 3)} ${item.unit ? item.unit : ''}`.trim()
          : '—',
      factor:
        item.factor != null
          ? `${formatNumber(item.factor, 4)} tCO₂e/${item.unit ? item.unit : '-'}`
          : '—',
      result: formatTonnes(item.result),
      notes: item.notes ?? '',
    }));
  }, [carbon]);

  const scenarios = carbon?.scenarios ?? [];

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <div className="carbon-page">
      <div className="page-header">
        <div>
          <h2>Huella de Carbono</h2>
          <p>
            Calcula y monitorea las emisiones corporativas bajo el GHG Protocol con factores regionales y escenarios de mejora.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleRecalculate}
          disabled={calculating || !company || !period}
        >
          <HiOutlineArrowPath aria-hidden="true" />
          {calculating ? 'Recalculando…' : 'Recalcular huella'}
        </button>
      </div>

      <CompanySelector />

      <div className="carbon-toolbar" role="group" aria-label="Opciones de cálculo de huella">
        <div className="carbon-toolbar__field">
          <label htmlFor="carbon-country">Factor regional</label>
          <select
            id="carbon-country"
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      {toast && <Notification type="success" message={toast} onClose={() => setToast(null)} />}

      {!company && <p className="placeholder">Seleccioná una empresa para comenzar.</p>}

      {loading ? (
        <div className="card card--centered">
          <LoadingIndicator />
        </div>
      ) : carbon ? (
        <>
          <motion.section
            className="card carbon-summary-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <header className="card-header">
              <div>
                <h3>
                  <HiOutlineSparkles aria-hidden="true" /> Resultados generales
                </h3>
                <p>
                  Resumen automático por alcance utilizando factores {carbon?.factors?.countryName ?? 'globales'} (
                  {carbon?.factors?.year ?? 'última actualización'}).
                </p>
              </div>
            </header>
            <div className="carbon-summary-grid">
              <SummaryCard
                title="Alcance 1"
                value={formatTonnes(carbon.scope1)}
                description="Combustión propia, flota y fugas refrigerantes"
              />
              <SummaryCard
                title="Alcance 2"
                value={formatTonnes(carbon.scope2)}
                description="Electricidad adquirida (market/location)"
              />
              <SummaryCard
                title="Alcance 3"
                value={formatTonnes(carbon.scope3)}
                description="Logística, residuos y cadena de valor"
              />
              <SummaryCard
                title="Total corporativo"
                highlight
                value={formatTonnes(carbon.total)}
                description="Huella consolidada tCO₂e"
              />
            </div>
          </motion.section>

          <section className="grid-two-columns">
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <header className="card-header">
                <h3>Desglose por categoría</h3>
                <p>Actividad base, factores aplicados y emisiones tCO₂e por categoría.</p>
              </header>
              {breakdownRows.length ? (
                <table className="data-table carbon-table">
                  <thead>
                    <tr>
                      <th>Alcance</th>
                      <th>Categoría</th>
                      <th>Actividad</th>
                      <th>Factor</th>
                      <th>Emisiones</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.scope}</td>
                        <td>{row.category}</td>
                        <td>{row.activity}</td>
                        <td>{row.factor}</td>
                        <td>{row.result}</td>
                        <td>{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="placeholder">Aún no hay desglose disponible para este cálculo.</p>
              )}
            </motion.div>

            <motion.div
              className="card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <header className="card-header">
                <h3>Escenarios automáticos</h3>
                <p>Comparaciones de reducción sugeridas para cada alcance.</p>
              </header>
              {scenarios.length ? (
                <table className="data-table carbon-table">
                  <thead>
                    <tr>
                      <th>Escenario</th>
                      <th>Ámbito</th>
                      <th>Reducción</th>
                      <th>Proyección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((item) => {
                      const reductionValue =
                        item.reduction != null
                          ? item.reduction
                          : item.delta != null
                          ? Math.abs(item.delta)
                          : null;
                      const projectedValue = item.projected ?? null;
                      const baselineValue =
                        item.baseline != null
                          ? item.baseline
                          : projectedValue != null && item.delta != null
                          ? projectedValue - item.delta
                          : null;
                      const reductionPercent =
                        item.reductionPercent != null
                          ? item.reductionPercent
                          : baselineValue
                          ? (reductionValue / baselineValue) * 100
                          : null;
                      return (
                        <tr key={item.name}>
                          <td>
                            <strong>{item.name}</strong>
                            {item.description ? <p className="table-note">{item.description}</p> : null}
                          </td>
                          <td>{scopeLabel(item.scope)}</td>
                          <td>
                            {reductionPercent != null ? `${formatNumber(reductionPercent, 1)} %` : '—'}{' '}
                            {reductionValue != null ? `(${formatTonnes(reductionValue)})` : ''}
                          </td>
                          <td>{projectedValue != null ? formatTonnes(projectedValue) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="placeholder">No se registran escenarios guardados.</p>
              )}
            </motion.div>
          </section>

          <motion.section
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <header className="card-header">
              <div>
                <h3>Simular mejoras</h3>
                <p>Proyectá reducciones específicas y valida el impacto antes de ejecutarlas.</p>
              </div>
            </header>
            <form className="carbon-simulator" onSubmit={handleSimulate}>
              <div className="form-group">
                <label htmlFor="scenario-scope">Ámbito</label>
                <select
                  id="scenario-scope"
                  value={scenario.scope}
                  onChange={(event) => setScenario((prev) => ({ ...prev, scope: event.target.value }))}
                >
                  {SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="scenario-reduction">Reducción objetivo (%)</label>
                <div className="slider-field">
                  <input
                    id="scenario-reduction"
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={scenario.reductionPercent}
                    onChange={(event) => setScenario((prev) => ({ ...prev, reductionPercent: event.target.value }))}
                  />
                  <span>{formatNumber(scenario.reductionPercent, 0)} %</span>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="scenario-description">Descripción (opcional)</label>
                <input
                  id="scenario-description"
                  type="text"
                  placeholder="Ej: Cambio a flota eléctrica"
                  value={scenario.description}
                  onChange={(event) => setScenario((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="secondary-button" disabled={simulating}>
                  {simulating ? 'Simulando…' : 'Simular reducción'}
                </button>
              </div>
            </form>
            {simulation && (
              <div className="simulation-result" role="status" aria-live="polite">
                <h4>Resultado proyectado</h4>
                <p>
                  {scopeLabel(simulation.scope)} pasaría de {formatTonnes(simulation.baseline)} a {formatTonnes(simulation.projected)}.
                </p>
                <p>
                  Reducción estimada: {formatNumber(simulation.reductionPercent, 1)} % ({formatTonnes(simulation.reduction)}).
                </p>
              </div>
            )}
          </motion.section>

          <motion.section
            className="card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <header className="card-header">
              <h3>Tendencia histórica</h3>
              <p>Comparativo anual de los tres alcances y la variación total.</p>
            </header>
            {history?.length ? (
              <div className="carbon-chart">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={history} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => formatNumber(value, 0)} />
                    <Tooltip formatter={(value) => formatTonnes(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="scope1" stackId="1" stroke={TREND_COLORS.scope1} fill={TREND_COLORS.scope1} />
                    <Area type="monotone" dataKey="scope2" stackId="1" stroke={TREND_COLORS.scope2} fill={TREND_COLORS.scope2} />
                    <Area type="monotone" dataKey="scope3" stackId="1" stroke={TREND_COLORS.scope3} fill={TREND_COLORS.scope3} />
                  </AreaChart>
                </ResponsiveContainer>
                <table className="data-table carbon-table">
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>Alcance 1</th>
                      <th>Alcance 2</th>
                      <th>Alcance 3</th>
                      <th>Total</th>
                      <th>Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.period}>
                        <td>{row.period}</td>
                        <td>{formatTonnes(row.scope1)}</td>
                        <td>{formatTonnes(row.scope2)}</td>
                        <td>{formatTonnes(row.scope3)}</td>
                        <td>{formatTonnes(row.total)}</td>
                        <td>
                          {row.change != null
                            ? `${formatTonnes(row.change)}${row.changePercent != null ? ` (${formatNumber(row.changePercent, 1)} %)` : ''}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="placeholder">Aún no hay historial disponible.</p>
            )}
          </motion.section>
        </>
      ) : (
        <div className="card card--centered">
          <p className="placeholder">No se han procesado emisiones para este periodo. Ejecutá un cálculo para generar el resumen.</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, description, highlight = false }) {
  return (
    <article className={`carbon-summary-card__item ${highlight ? 'is-highlight' : ''}`}>
      <h4>{title}</h4>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function scopeLabel(scope) {
  switch ((scope ?? '').toLowerCase()) {
    case 'scope1':
      return 'Alcance 1';
    case 'scope2':
      return 'Alcance 2';
    case 'scope3':
      return 'Alcance 3';
    case 'all':
      return 'Corporativo';
    default:
      return 'N/D';
  }
}

function formatCategory(category) {
  if (!category) return 'Categoría';
  return category
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function formatTonnes(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${formatNumber(value, 2)} tCO₂e`;
}

function formatNumber(value, decimals = 2) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return '0';
  }
  return numeric.toLocaleString('es-UY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
