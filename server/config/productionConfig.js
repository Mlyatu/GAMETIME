const path = require('node:path');

function isHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && [url.origin, `${url.origin}/`].includes(value);
  } catch {
    return false;
  }
}

function isLocalDatabaseHost(host) {
  return ['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase());
}

function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;

  const errors = [];
  const requiredKeys = [
    'CLIENT_URL', 'APP_URL', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'JWT_SECRET', 'JWT_REFRESH_SECRET', 'UPLOAD_DIR', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  ];
  requiredKeys.forEach((key) => {
    if (!env[key] || !env[key].trim()) errors.push(`${key} must be set`);
  });

  if (env.CLIENT_URL) {
    const origins = env.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean);
    if (origins.length === 0 || origins.some((origin) => !isHttpsOrigin(origin))) {
      errors.push('CLIENT_URL must contain HTTPS origin(s)');
    }
  }

  if (env.APP_URL && !isHttpsOrigin(env.APP_URL)) {
    errors.push('APP_URL must be an HTTPS origin');
  }

  if (env.DB_HOST && isLocalDatabaseHost(env.DB_HOST)) {
    errors.push('DB_HOST must point to the hosted database, not localhost');
  }

  if (env.UPLOAD_DIR && !path.isAbsolute(env.UPLOAD_DIR)) {
    errors.push('UPLOAD_DIR must be an absolute path to persistent storage');
  }

  ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].forEach((key) => {
    if (/your_|change_this|app_password/i.test(env[key] || '')) {
      errors.push(`${key} must use real production email credentials`);
    }
  });

  ['JWT_SECRET', 'JWT_REFRESH_SECRET'].forEach((key) => {
    const secret = env[key] || '';
    if (secret.length < 32 || /change_this|example|your_/i.test(secret)) {
      errors.push(`${key} must be a unique secret of at least 32 characters`);
    }
  });

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${errors.join('\n- ')}`);
  }
}

module.exports = { validateProductionConfig };
