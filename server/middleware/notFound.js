// Catches any request that didn't match a defined route and forwards
// a consistent 404 shape into the central error handler, instead of
// letting Express fall back to its default HTML error page.
function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

module.exports = notFound;
