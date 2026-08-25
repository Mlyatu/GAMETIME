// =====================================================================
// ASYNC HANDLER WRAPPER
// =====================================================================
// Express doesn't automatically catch rejected promises from async
// route handlers — an unhandled rejection would crash the process
// instead of reaching errorHandler. Wrapping every controller in this
// removes the need for a try/catch + next(err) in each one.
//
// Usage:
//   router.get('/', asyncHandler(async (req, res) => { ... }));
// =====================================================================

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
