const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin, callback) {
  if (!origin || configuredOrigins.includes(origin)) {
    return callback(null, true);
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (isLoopback && url.protocol === 'http:' && url.origin === origin) {
        return callback(null, true);
      }
    } catch {
      // Invalid origins are rejected below.
    }
  }

  return callback(new Error('Not allowed by CORS'));
}

module.exports = { isAllowedOrigin };
