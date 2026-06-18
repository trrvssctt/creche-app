
export const errorHandler = (err, req, res, next) => {
  console.error(`[API ERROR] ${new Date().toISOString()}:`, err);

  const statusCode = err.status || 500;
  const message = err.message || 'Une erreur interne est survenue sur le Kernel GeStock.';

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: message,
    status: statusCode,
    timestamp: new Date().toISOString()
  });
};
