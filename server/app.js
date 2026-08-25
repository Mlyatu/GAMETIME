// =====================================================================
// EXPRESS APP CONFIGURATION
// =====================================================================
// This file builds and configures the Express `app` object only.
// It does NOT call app.listen() — that lives in server.js, which also
// wires up Socket.io on top of the same HTTP server. Keeping them
// separate makes the app importable/testable without opening a real
// network port (useful for future automated tests).
// =====================================================================

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { generalLimiter } = require('./middleware/rateLimiter');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { testConnection } = require('./config/database');

const app = express();

// ---------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------
// Helmet sets a batch of protective HTTP headers (X-Content-Type-Options,
// X-Frame-Options, HSTS, etc.). crossOriginResourcePolicy is relaxed
// so uploaded images/media can be embedded by the frontend, which may
// be served from a different origin during development.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ---------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------
// Only the configured CLIENT_URL is allowed to call this API with
// credentials (cookies/auth headers). Wildcard origins are avoided
// deliberately since this API handles authenticated requests.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',');
app.use(
  cors({
    origin(origin, callback) {
      // Allow tools like Postman/curl (no Origin header) in development.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ---------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------
// Access logs go to both the console (for local dev) and a rotating
// file under server/logs (for production debugging).
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

app.use(morgan('dev'));                 // concise colored output in the terminal
app.use(morgan('combined', { stream: accessLogStream })); // full Apache-style log to disk

// ---------------------------------------------------------------------
// Body parsing & compression
// ---------------------------------------------------------------------
app.use(express.json({ limit: '2mb' }));               // parses application/json bodies
app.use(express.urlencoded({ extended: true }));       // parses form submissions
app.use(compression());                                // gzip responses

// ---------------------------------------------------------------------
// Static file serving (uploaded avatars, screenshots, media)
// ---------------------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------------------------------------------------------------
// Rate limiting (applied globally; stricter limiter is added per-route
// in routes/auth.routes.js once auth endpoints exist in Step 4)
// ---------------------------------------------------------------------
app.use(generalLimiter);

// ---------------------------------------------------------------------
// Health check — used by uptime monitors / load balancers
// ---------------------------------------------------------------------
app.get('/health', async (req, res) => {
  let db = 'ok';
  try {
    await testConnection();
  } catch {
    db = 'down';
  }
  const status = db === 'ok' ? 200 : 503;
  res.status(status).json({ success: db === 'ok', db, message: 'EFootball Arena API is running' });
});

// ---------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/player', require('./routes/player.routes'));
app.use('/api/team', require('./routes/team.routes'));
app.use('/api/tournament', require('./routes/tournament.routes'));
app.use('/api/match', require('./routes/match.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/notification', require('./routes/notification.routes'));
app.use('/api/result', require('./routes/result.routes'));
app.use('/api/media', require('./routes/media.routes'));
app.use('/api/report', require('./routes/report.routes'));

// Route modules below are mounted here as they're built in later steps:
//   app.use('/api/admin', require('./routes/admin.routes'));
//   app.use('/api/settings', require('./routes/settings.routes'));

// ---------------------------------------------------------------------
// 404 + centralized error handling — must be registered last, in order
// ---------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
