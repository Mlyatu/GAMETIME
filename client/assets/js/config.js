/**
 * =====================================================================
 * ARENA CLIENT CONFIG
 * =====================================================================
 * Central place for API URL, token keys, and route constants.
 * Override per-environment by setting window.ARENA_API_BASE_URL before
 * this file loads (e.g. from a deployment config script).
 * =====================================================================
 */

(function (root) {
  const isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
  const defaultApiBase = isLocalhost ? 'http://localhost:5000/api' : '/api';

  root.ARENA_CONFIG = {
    API_BASE_URL: root.ARENA_API_BASE_URL || defaultApiBase,
    ACCESS_TOKEN_KEY: 'arena_access_token',
    REFRESH_TOKEN_KEY: 'arena_refresh_token',
    USER_KEY: 'arena_user',
    TOKEN_STORAGE_KEY: 'arena_token_storage',
    AUTH_REDIRECT: '/pages/login.html',
    DEFAULT_PROTECTED_REDIRECT: '/pages/dashboard.html',
    PUBLIC_PAGES: [
      '/pages/login.html',
      '/pages/register.html',
      '/pages/forgot-password.html',
      '/pages/reset-password.html',
      '/pages/verify-email.html',
      '/index.html',
      '/',
    ],
  };
})(window);
