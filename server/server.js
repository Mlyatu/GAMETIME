// =====================================================================
// SERVER ENTRY POINT
// =====================================================================
// Responsible only for: loading env vars, creating the HTTP server
// around the Express app, verifying the DB connection, and starting
// to listen. Socket.io is attached here (not in app.js) because it
// needs the raw http.Server instance, not just the Express app.
// =====================================================================

require('dotenv').config();

const { validateProductionConfig } = require('./config/productionConfig');
validateProductionConfig();

const http = require('http');
const app = require('./app');
const { testConnection } = require('./config/database');
const { initSocket } = require('./socket');
const { verifyEmailTransport, emailEnabled } = require('./services/email.service');

const DEFAULT_PORT = Number(process.env.PORT) || 5000;
let server;
let activePort = DEFAULT_PORT;

// Socket.io shares the same HTTP server/port as Express — it
// intercepts the WebSocket upgrade handshake, REST traffic is
// untouched. See socket/index.js for auth, chat, and presence logic.

async function start(port = DEFAULT_PORT) {
  try {
    const { now } = await testConnection();
    // eslint-disable-next-line no-console
    console.log(`Connected to PostgreSQL — server time: ${now}`);

    if (emailEnabled) {
      try {
        await verifyEmailTransport();
        // eslint-disable-next-line no-console
        console.log('[email] SMTP connection verified.');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[email] SMTP verification failed: ${err.message}`);
      }
    }

    server = http.createServer(app);
    initSocket(server);

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const nextPort = port + 1;
        // eslint-disable-next-line no-console
        console.warn(`Port ${port} is already in use. Retrying on ${nextPort}...`);
        return start(nextPort);
      }

      // eslint-disable-next-line no-console
      console.error('Failed to start server:', err.message);
      process.exit(1);
    });

    server.listen(port, () => {
      activePort = port;
      // eslint-disable-next-line no-console
      console.log(`EFootball Arena API running on http://localhost:${activePort}`);
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
  if (!server) {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received. No server is listening yet; exiting.`);
    process.exit(0);
  }

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

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', reason);
  // Graceful exit lets the process manager restart with a clean state.
  shutdown('unhandledRejection');
});

start();
