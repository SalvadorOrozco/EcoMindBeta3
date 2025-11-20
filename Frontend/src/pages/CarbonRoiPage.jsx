import { useEffect, useMemo, useState } from 'react';
import { HiArrowPath, HiPlus, HiSparkles } from 'react-icons/hi2';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CompanySelector from '../components/CompanySelector.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import Notification from '../components/Notification.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import { createCarbonInitiative, fetchCarbonInitiativeRanking } from '../services/api.js';

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/D';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/D';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
}

export default function CarbonRoiPage() {
  const { company } = useCompany();
  const [initiatives, setInitiatives] = useState([]);
  const [best, setBest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', costUSD: '', co2ReductionTons: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) {
      setInitiatives([]);
      setBest(null);
      return;
    }
    loadRanking();
  }, [company?.id]);

  async function loadRanking() {
    if (!company) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCarbonInitiativeRanking(company.id);
      setInitiatives(data.initiatives ?? []);
      setBest(data.best ?? null);
    } catch (err) {
      setError(err.message ?? 'No se pudo cargar el ranking');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!company) return;
    setSaving(true);
    setError(null);
    try {
      await createCarbonInitiative({ ...form, companyId: company.id });
      setForm({ name: '', costUSD: '', co2ReductionTons: '', description: '' });
      await loadRanking();
    } catch (err) {
      setError(err.message ?? 'No se pudo crear la iniciativa');
    } finally {
      setSaving(false);
    }
  }

  const chartData = useMemo(
    () =>
      initiatives
        .filter((item) => item.costPerTon !== null && !item.inconsistent)
        .map((item) => ({
          name: item.name,
          costPerTon: Number(item.costPerTon.toFixed(2)),
        })),
    [initiatives],
  );

  return (
    <div className="carbon-roi-page">
      <header className="page-header">
        <div>
          <h2>Retorno Ambiental (ROI de carbono)</h2>
          <p>
            Calcula el costo por tonelada de CO₂ evitada, prioriza inversiones ambientales y detecta
            inconsistencias en los datos cargados.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={loadRanking} disabled={!company || loading}>
          <HiArrowPath aria-hidden="true" />
          <span>{loading ? 'Actualizando...' : 'Refrescar'}</span>
        </button>
      </header>

      <CompanySelector />

      {best && (
        <div className="roi-recommendation" role="status" aria-live="polite">
          <span className="roi-badge">
            <HiSparkles aria-hidden="true" /> Mejor ROI
          </span>
          <div>
            <p className="roi-title">{best.name}</p>
            <p className="roi-subtitle">
              {best.costPerTon !== null
                ? `${formatCurrency(best.costPerTon)} por tonelada de CO₂ evitada`
                : 'Costo por tonelada no disponible'}
            </p>
          </div>
        </div>
      )}

      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      <div className="roi-grid">
        <section className="roi-card">
          <header className="card-header">
            <div>
              <p className="eyebrow">Registrar iniciativa</p>
              <h3>Nuevo proyecto climático</h3>
            </div>
          </header>
          <form className="roi-form" onSubmit={handleSubmit}>
            <label>
              Nombre
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Recuperación de calor residual"
              />
            </label>
            <label>
              Costo total (USD)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costUSD}
                onChange={(e) => setForm((prev) => ({ ...prev, costUSD: e.target.value }))}
                placeholder="100000"
              />
            </label>
            <label>
              Toneladas de CO₂ evitadas
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.co2ReductionTons}
                onChange={(e) => setForm((prev) => ({ ...prev, co2ReductionTons: e.target.value }))}
                placeholder="350"
              />
            </label>
            <label>
              Descripción (opcional)
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Resumen del beneficio y alcance"
                rows={3}
              />
            </label>
            <button type="submit" className="primary-button" disabled={!company || saving}>
              <HiPlus aria-hidden="true" /> {saving ? 'Guardando...' : 'Agregar iniciativa'}
            </button>
          </form>
        </section>

        <section className="roi-card">
          <header className="card-header">
            <div>
              <p className="eyebrow">Ranking por costo evitado</p>
              <h3>Comparación de ROI</h3>
            </div>
          </header>
          {loading ? (
            <LoadingIndicator label="Calculando ROI..." />
          ) : initiatives.length ? (
            <div className="roi-table-wrapper">
              <table className="initiative-table">
                <thead>
                  <tr>
                    <th>Iniciativa</th>
                    <th>Costo (USD)</th>
                    <th>CO₂ evitado (t)</th>
                    <th>Costo por tonelada</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {initiatives.map((item) => (
                    <tr key={item.id} className={item.inconsistent ? 'row-warning' : ''}>
                      <td>{item.name}</td>
                      <td>{formatCurrency(item.costUSD)}</td>
                      <td>{formatNumber(item.co2ReductionTons)}</td>
                      <td>{item.costPerTon !== null ? formatCurrency(item.costPerTon) : 'N/D'}</td>
                      <td>
                        {item.inconsistent ? (
                          <span className="tag tag--warning">{item.issues.join(' • ')}</span>
                        ) : (
                          <span className="tag tag--success">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">Aún no hay iniciativas registradas.</p>
          )}
        </section>
      </div>

      <section className="roi-card">
        <header className="card-header">
          <div>
            <p className="eyebrow">Visualización</p>
            <h3>Costo por tonelada evitada</h3>
          </div>
        </header>
        {chartData.length ? (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={70} />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="costPerTon" name="Costo por tCO₂e" fill="#0B815A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty-state">Agrega iniciativas válidas para ver el gráfico comparativo.</p>
        )}
      </section>
    </div>
  );
}
