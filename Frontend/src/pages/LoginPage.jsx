import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message ?? 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__actions" role="presentation">
        <ThemeToggle />
      </div>
      <div className="auth-hero">
        <div>
          <h1>EcoMind ESG</h1>
          <p>
            Centraliza tus indicadores ambientales, sociales y de gobernanza con analítica
            inteligente en tiempo real.
          </p>
        </div>
        <ul>
          <li>Seguimiento unificado de métricas ESG.</li>
          <li>Reportes automáticos con narrativa generada por IA.</li>
          <li>Alertas tempranas para decisiones más sostenibles.</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Iniciar sesión</h2>
        <p className="auth-subtitle">Ingresa con tu correo corporativo para continuar.</p>
        {error && <div className="auth-error">{error}</div>}
        <div className="form-field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
            className="form-control"
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
            className="form-control"
          />
        </div>
        <button className="primary-button full-width" type="submit" disabled={submitting}>
          {submitting ? 'Ingresando...' : 'Entrar'}
        </button>
        <p className="auth-switch">
          ¿Aún no tienes una cuenta? <Link to="/register">Crear cuenta</Link>
        </p>
      </form>
    </div>
  );
}
