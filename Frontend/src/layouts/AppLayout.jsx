import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const links = [
  { to: '/dashboard', label: 'Panel ESG' },
  { to: '/companies', label: 'Empresas' },
  { to: '/reports', label: 'Reportes ESG' },
  { to: '/carbon', label: 'Huella de carbono' },
  { to: '/carbon-roi', label: 'Retorno Ambiental' },
  { to: '/map', label: 'Mapa de sostenibilidad' },
  { to: '/auto-audit', label: 'Auditoría Automática' },
  { to: '/early-warning', label: 'EarlyWarningESG' },
  { to: '/regulatory-forecast', label: 'Futuro Normativo' },
  { to: '/indicators', label: 'Indicadores ESG' },
  { to: '/plants', label: 'Plantas' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const initials = getInitials(user?.name ?? '');
  const roleLabel = user?.companyId
    ? `Empresa #${user.companyId}`
    : 'Administrador global';
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app ${navOpen ? 'app--nav-open' : ''}`}>
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <aside className={`sidebar ${navOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
        <div className="sidebar__header">
          <div className="sidebar-brand">
            <span className="logo" aria-label="EcoMind">
              EcoMind
            </span>
            <p className="sidebar-caption">Inteligencia ESG con IA</p>
          </div>
          <button
            type="button"
            className="icon-button sidebar__close"
            onClick={() => setNavOpen(false)}
            aria-label="Cerrar navegación"
          >
            ×
          </button>
        </div>
        <nav id="sidebar-navigation" className="sidebar__nav" aria-label="Secciones de la aplicación">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip" role="group" aria-label="Perfil de usuario">
            <span className="user-avatar" aria-hidden="true">
              {initials}
            </span>
            <div>
              <strong>{user?.name ?? 'Usuario'}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>
          <button type="button" className="secondary-button" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="app__backdrop" aria-hidden="true" onClick={() => setNavOpen(false)} />
      <div className="app-main">
        <header className="topbar" role="banner">
          <div className="topbar__leading">
            <button
              type="button"
              className="icon-button topbar__menu"
              onClick={() => setNavOpen((open) => !open)}
              aria-label={navOpen ? 'Cerrar navegación' : 'Abrir navegación'}
              aria-expanded={navOpen}
              aria-controls="sidebar-navigation"
            >
              ☰
            </button>
            <div className="topbar__titles">
              <p className="topbar__eyebrow">Plataforma ESG</p>
              <h1 className="topbar__title">EcoMind</h1>
            </div>
          </div>
          <div className="topbar__actions">
            <ThemeToggle />
            <span className="topbar__user" aria-live="polite">
              {user?.name ?? 'Usuario'}
            </span>
          </div>
        </header>
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            id="main-content"
            className="content"
            tabIndex={-1}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="content-shell">
              <Outlet />
            </div>
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
