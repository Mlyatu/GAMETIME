// =====================================================================
// SERVER ENTRY POINT
// =====================================================================
// Responsible only for: loading env vars, creating the HTTP server
// around the Express app, verifying the DB connection, and starting
// to listen. Socket.io is attached here (not in app.js) because it
// needs the raw http.Server instance, not just the Express app.
// =====================================================================

require('dotenv').config();

const http = require('http');
const app = require('./app');
const { testConnection } = require('./config/database');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Socket.io shares the same HTTP server/port as Express — it
// intercepts the WebSocket upgrade handshake, REST traffic is
// untouched. See socket/index.js for auth, chat, and presence logic.
initSocket(server);

async function start() {
  try {
    const { now } = await testConnection();
    // eslint-disable-next-line no-console
    console.log(`Connected to PostgreSQL — server time: ${now}`);

    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`EFootball Arena API running on http://localhost:${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server — could not connect to the database:', err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// Graceful shutdown — let in-flight requests finish before closing,
// so a deploy/restart doesn't cut off active users mid-request.
// ---------------------------------------------------------------------
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
