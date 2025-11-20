export function withControllerErrorHandling(handler, label) {
  if (typeof handler !== 'function') {
    throw new TypeError('Handler must be a function');
  }
  const name = label ?? handler.name ?? 'anonymous';
  return async function controllerWrapper(req, res, next) {
    try {
      return await handler(req, res, next);
    } catch (error) {
      const method = req?.method ?? 'unknown-method';
      const path = req?.originalUrl ?? 'unknown-url';
      console.error(`⚠️  Error en controlador ${name} [${method} ${path}]`, error);
      return next(error);
    }
  };
}
