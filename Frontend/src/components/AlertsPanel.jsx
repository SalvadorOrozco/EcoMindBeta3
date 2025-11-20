import { isValidElement } from 'react';
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
  HiOutlineXCircle,
} from 'react-icons/hi2';

const SEVERITY_STYLES = {
  info: 'alert alert-info',
  success: 'alert alert-success',
  warning: 'alert alert-warning',
  danger: 'alert alert-error',
};

const SEVERITY_ICONS = {
  info: HiOutlineInformationCircle,
  success: HiOutlineCheckCircle,
  warning: HiOutlineExclamationTriangle,
  danger: HiOutlineXCircle,
};

export default function AlertsPanel({ alerts }) {
  const items = alerts ?? [];
  const hasAlerts = items.length > 0;

  if (!hasAlerts) {
    return (
      <div className="card camaleon-panel">
        <h3>Alertas ESG</h3>
        <p className="muted">No se detectaron alertas para el periodo seleccionado.</p>
      </div>
    );
  }

  return (
    <div className="card alerts-card camaleon-panel">
      <div className="card-header">
        <div>
          <h3>Alertas ESG</h3>
          <p className="muted">Revisa los indicadores con desvíos y define planes de acción.</p>
        </div>
        <span className="badge badge-warning">{items.length}</span>
      </div>
      <ul className="alert-list">
        {items.map((alert) => {
          const className = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.warning;
          const Icon = SEVERITY_ICONS[alert.severity] ?? HiOutlineExclamationTriangle;
          const iconNode = isValidElement(alert.icon) ? alert.icon : <Icon />;

          return (
            <li key={alert.id} className={className}>
              <div className="alert-icon" aria-hidden="true">
                {iconNode}
              </div>
              <div>
                <strong>{alert.title ?? 'Atención'}</strong>
                <p>{alert.message}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
