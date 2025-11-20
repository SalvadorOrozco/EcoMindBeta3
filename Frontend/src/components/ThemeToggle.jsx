import { LuMoonStar, LuSunMedium } from 'react-icons/lu';
import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button
      type="button"
      className={`theme-toggle icon-button ${className}`.trim()}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      data-theme-state={theme}
    >
      <span aria-hidden="true" className="theme-toggle__icon">
        {isDark ? <LuMoonStar /> : <LuSunMedium />}
      </span>
      <span className="theme-toggle__label">{isDark ? 'Oscuro' : 'Claro'}</span>
    </button>
  );
}
