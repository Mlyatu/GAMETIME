// =====================================================================
// CENTRAL ERROR HANDLER
// =====================================================================
// Every route/controller should call next(error) on failure instead of
// sending its own error response. This is the single place that
// decides the response shape, so the API is consistent everywhere.
//
// IMPORTANT: this must be the LAST app.use() call in app.js — Express
// identifies error-handling middleware by its 4-argument signature.
// =====================================================================

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || err.status || 500;

  // CORS rejections should be 403 and never include a stack trace.
  const isCorsError = err.message === 'Not allowed by CORS';
  if (isCorsError) {
    statusCode = 403;
  }

  // Multer throws MulterError instances (file too large, wrong field
  // name — these carry a `code` like LIMIT_FILE_SIZE) or plain Errors
  // from our fileFilter (wrong file type) — both are client mistakes,
  // not server failures.
  const isMulterError = err.name === 'MulterError' || Boolean(err.code && err.code.startsWith('LIMIT_'));
  if (isMulterError && statusCode === 500) {
    statusCode = 400;
  }

  // Never leak stack traces or raw DB error text to the client in
  // production — that can reveal schema details to an attacker.
  const isProduction = process.env.NODE_ENV === 'production';

  const code =
    err.code ||
    (isCorsError ? 'CORS_REJECTED' : null) ||
    (isMulterError ? err.code : null) ||
    (statusCode === 422 ? 'VALIDATION_ERROR' : null) ||
    (statusCode === 404 ? 'NOT_FOUND' : null) ||
    (statusCode === 401 ? 'UNAUTHORIZED' : null) ||
    (statusCode === 403 ? 'FORBIDDEN' : null) ||
    (statusCode === 409 ? 'CONFLICT' : null) ||
    (statusCode === 429 ? 'RATE_LIMIT' : null) ||
    (statusCode >= 500 ? 'SERVER_ERROR' : `HTTP_${statusCode}`);

  const response = {
    success: false,
    code,
    message: err.message || 'Internal server error',
  };

  if (err.errors) {
    response.errors = err.errors;
  }

  if (!isProduction && !isCorsError) {
    response.stack = err.stack;
  }

  // Postgres unique-violation code — surface a friendlier message
  // than the raw constraint error.
  if (err.code === '23505') {
    response.code = 'DUPLICATE_RECORD';
    response.message = 'A record with these details already exists.';
  }

  // eslint-disable-next-line no-console
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -`, err);

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
