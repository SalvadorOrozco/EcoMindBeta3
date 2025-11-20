export default function Notification({ type = 'info', message, onClose }) {
  if (!message) return null;
  return (
    <div className={`notification notification-${type}`}>
      <span>{message}</span>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Cerrar" className="notification-close">
          ×
        </button>
      ) : null}
    </div>
  );
}
