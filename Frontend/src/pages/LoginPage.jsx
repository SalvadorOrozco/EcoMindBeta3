import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function LoginPage({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyId: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isLogin = useMemo(() => mode === 'login', [mode]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function handleLoginChange(event) {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleRegisterChange(event) {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);
    setError(null);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(loginForm);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message ?? 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
      };
      if (registerForm.companyId) {
        payload.companyId = Number(registerForm.companyId);
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
      <div className="auth-shell">
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
        <div className="auth-card auth-card--slider">
          <div className="auth-toggle">
            <button
              type="button"
              className={isLogin ? 'active' : ''}
              onClick={() => handleModeChange('login')}
              aria-pressed={isLogin}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={!isLogin ? 'active' : ''}
              onClick={() => handleModeChange('register')}
              aria-pressed={!isLogin}
            >
              Crear cuenta
            </button>
            <span className={`auth-toggle__indicator ${isLogin ? 'left' : 'right'}`} aria-hidden />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-panels" data-mode={mode}>
            <form className="auth-panel" onSubmit={handleLoginSubmit} aria-hidden={!isLogin}>
              <h2>Iniciar sesión</h2>
              <p className="auth-subtitle">Ingresa con tu correo corporativo para continuar.</p>
              <div className="form-field">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
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
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  required
                  className="form-control"
                />
              </div>
              <button className="primary-button full-width" type="submit" disabled={submitting}>
                {submitting && isLogin ? 'Ingresando...' : 'Entrar'}
              </button>
              <p className="auth-switch">
                ¿Aún no tienes una cuenta?{' '}
                <button type="button" className="link-like" onClick={() => handleModeChange('register')}>
                  Crear cuenta
                </button>
              </p>
            </form>

            <form className="auth-panel" onSubmit={handleRegisterSubmit} aria-hidden={isLogin}>
              <h2>Crear cuenta</h2>
              <p className="auth-subtitle">Completa los datos para obtener acceso inmediato.</p>
              <div className="form-field">
                <label htmlFor="name">Nombre y apellido</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={registerForm.name}
                  onChange={handleRegisterChange}
                  required
                  className="form-control"
                />
              </div>
              <div className="form-field">
                <label htmlFor="registerEmail">Correo corporativo</label>
                <input
                  id="registerEmail"
                  name="email"
                  type="email"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  required
                  className="form-control"
                />
              </div>
              <div className="form-field">
                <label htmlFor="registerPassword">Contraseña</label>
                <input
                  id="registerPassword"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={handleRegisterChange}
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
                  value={registerForm.confirmPassword}
                  onChange={handleRegisterChange}
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
                  value={registerForm.companyId}
                  onChange={handleRegisterChange}
                  placeholder="Vincula la cuenta a una empresa existente"
                  className="form-control"
                />
              </div>
              <button className="primary-button full-width" type="submit" disabled={submitting}>
                {submitting && !isLogin ? 'Creando cuenta...' : 'Registrarme'}
              </button>
              <p className="auth-switch">
                ¿Ya tienes una cuenta?{' '}
                <button type="button" className="link-like" onClick={() => handleModeChange('login')}>
                  Iniciar sesión
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
