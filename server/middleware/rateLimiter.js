// =====================================================================
// RATE LIMITING
// =====================================================================
// Rate limits:
//  - `generalLimiter`: applied to every request, generous ceiling.
//  - Auth limiters: separate budgets for each endpoint so unrelated
//    login, verification, and password-reset requests don't block each other.
// =====================================================================

const rateLimit = require('express-rate-limit');

const windowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15;
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000;

const generalLimiter = rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max: maxRequests,
  // Only API requests should consume the API request budget.
  skip: (req) => !req.path.startsWith('/api/'),
  standardHeaders: true,   // return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

const authWindowMs = 15 * 60 * 1000;
const authMessage = {
  success: false,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
};

function createAuthLimiter(max) {
  return rateLimit({
    windowMs: authWindowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: authMessage,
  });
}

const defaultAuthMax = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;
const emailAuthMax = Number(process.env.AUTH_EMAIL_RATE_LIMIT_MAX) || 5;

const loginLimiter = createAuthLimiter(defaultAuthMax);
const registerLimiter = createAuthLimiter(defaultAuthMax);
const resendVerificationLimiter = createAuthLimiter(emailAuthMax);
const forgotPasswordLimiter = createAuthLimiter(emailAuthMax);
const resetPasswordLimiter = createAuthLimiter(defaultAuthMax);

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  resendVerificationLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
};
