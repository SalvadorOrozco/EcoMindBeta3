import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyId: '',
  });
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
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
      };
      if (form.companyId) {
        payload.companyId = Number(form.companyId);
      }
      await register(payload);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message ?? 'No se pudo crear la cuenta');
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
          <p>Crea una cuenta para comenzar a medir y reportar tus compromisos sostenibles.</p>
        </div>
        <ul>
          <li>Orquesta tus datos ESG en un único panel.</li>
          <li>Comparte reportes profesionales con stakeholders.</li>
          <li>Activa recomendaciones automáticas impulsadas por IA.</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Crear cuenta</h2>
        <p className="auth-subtitle">Completa los datos para obtener acceso inmediato.</p>
        {error && <div className="auth-error">{error}</div>}
        <div className="form-field">
          <label htmlFor="name">Nombre y apellido</label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            required
            className="form-control"
          />
        </div>
        <div className="form-field">
          <label htmlFor="email">Correo corporativo</label>
          <input
            id="email"
            name="email"
            type="email"
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
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            required
            className="form-control"
          />
        </div>
        <div className="form-field">
          <label htmlFor="confirmPassword">Confirmar contraseña</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            className="form-control"
          />
        </div>
        <div className="form-field">
          <label htmlFor="companyId">ID de empresa (opcional)</label>
          <input
            id="companyId"
            name="companyId"
            type="number"
            min="1"
            value={form.companyId}
            onChange={handleChange}
            placeholder="Vincula la cuenta a una empresa existente"
            className="form-control"
          />
        </div>
        <button className="primary-button full-width" type="submit" disabled={submitting}>
          {submitting ? 'Creando cuenta...' : 'Registrarme'}
        </button>
        <p className="auth-switch">
          ¿Ya tienes una cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </form>
    </div>
  );
}
