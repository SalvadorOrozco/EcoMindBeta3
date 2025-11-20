export function notFound(req, res, next) {
  res.status(404).json({ message: 'Recurso no encontrado' });
}

export function errorHandler(err, req, res, next) {
  const status = err.code === 'LIMIT_FILE_SIZE' ? 400 : err.status ?? 500;
  const response = {
    message:
      err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el tamaño máximo permitido'
        : err.message ?? 'Error interno del servidor',
  };
  if (err.details) {
    response.details = err.details;
  }
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }
  res.status(status).json(response);
}
