// =====================================================================
// RATE LIMITING
// =====================================================================
// Two limiters:
//  - `generalLimiter`: applied to every request, generous ceiling.
//  - `authLimiter`: applied only to auth routes (login/register/reset),
//    much stricter — these are the endpoints brute-force attacks target.
// =====================================================================

const rateLimit = require('express-rate-limit');

const windowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15;
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

const generalLimiter = rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max: maxRequests,
  standardHeaders: true,   // return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10, // login/register/reset attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

module.exports = { generalLimiter, authLimiter };
