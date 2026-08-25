/**
 * =====================================================================
 * ARENA API CLIENT
 * =====================================================================
 * Central fetch wrapper used by every page. Handles:
 *   - base URL + JSON headers
 *   - bearer access token on every request
 *   - automatic access-token refresh on 401
 *   - network/offline detection
 *   - normalized error objects with status, code, message, errors[]
 * =====================================================================
 */

(function (root) {
  const config = root.ARENA_CONFIG;

  let refreshPromise = null;

  function getTokenStorage() {
    return localStorage.getItem(config.TOKEN_STORAGE_KEY) === 'session' ? sessionStorage : localStorage;
  }

  function getAccessToken() {
    return getTokenStorage().getItem(config.ACCESS_TOKEN_KEY);
  }

  function getRefreshToken() {
    return getTokenStorage().getItem(config.REFRESH_TOKEN_KEY);
  }

  function setTokens(accessToken, refreshToken, rememberMe) {
    const storage = rememberMe ? localStorage : sessionStorage;
    const other = rememberMe ? sessionStorage : localStorage;

    storage.setItem(config.TOKEN_STORAGE_KEY, rememberMe ? 'local' : 'session');
    storage.setItem(config.ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) storage.setItem(config.REFRESH_TOKEN_KEY, refreshToken);

    other.removeItem(config.ACCESS_TOKEN_KEY);
    other.removeItem(config.REFRESH_TOKEN_KEY);
    other.removeItem(config.USER_KEY);
    other.removeItem(config.TOKEN_STORAGE_KEY);
  }

  function clearTokens() {
    [localStorage, sessionStorage].forEach((store) => {
      store.removeItem(config.ACCESS_TOKEN_KEY);
      store.removeItem(config.REFRESH_TOKEN_KEY);
      store.removeItem(config.USER_KEY);
      store.removeItem(config.TOKEN_STORAGE_KEY);
    });
  }

  function parseJwt(token) {
    try {
      const base64 = token
        .split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function tokenIsExpired(token) {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return true;
    return payload.exp * 1000 <= Date.now() + 30000; // 30s clock skew buffer
  }

  async function parseResponse(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : { success: false, message: 'Empty response from server' };
    } catch {
      return { success: false, message: 'Invalid response from server', raw: text };
    }
  }

  function buildError(status, data, originalMessage) {
    const message = data && data.message ? data.message : originalMessage || 'Request failed';
    const err = new Error(message);
    err.status = status;
    err.code =
      data && data.code
        ? data.code
        : status === 0
        ? 'NETWORK_ERROR'
        : status === 401
        ? 'UNAUTHORIZED'
        : status === 403
        ? 'FORBIDDEN'
        : status === 422
        ? 'VALIDATION_ERROR'
        : status === 409
        ? 'CONFLICT'
        : status === 429
        ? 'RATE_LIMIT'
        : status >= 500
        ? 'SERVER_ERROR'
        : `HTTP_${status}`;
    err.errors = (data && data.errors) || [];
    err.data = data;
    return err;
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw buildError(401, { message: 'Session expired, please log in again.' });

    const url = `${config.API_BASE_URL}/auth/refresh-token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await parseResponse(res);
    if (!res.ok || !data.success) throw buildError(res.status, data);

    const rememberMe = localStorage.getItem(config.TOKEN_STORAGE_KEY) !== 'session';
    setTokens(data.data.accessToken, data.data.refreshToken || refreshToken, rememberMe);
    return data.data.accessToken;
  }

  function doRefresh() {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function request(method, endpoint, body, options = {}) {
    const base = config.API_BASE_URL;
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    let token = getAccessToken();
    const headers = {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const init = { method, headers, ...options };
    if (body) init.body = body instanceof FormData ? body : JSON.stringify(body);

    try {
      let res = await fetch(url, init);

      // Attempt a single silent token refresh on 401, then retry.
      if (res.status === 401 && token && !options._skipRefresh) {
        try {
          const newToken = await doRefresh();
          headers.Authorization = `Bearer ${newToken}`;
          res = await fetch(url, init);
        } catch (refreshErr) {
          clearTokens();
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `${config.AUTH_REDIRECT}?next=${returnTo}`;
          throw buildError(401, { message: 'Session expired, please log in again.' });
        }
      }

      const data = await parseResponse(res);
      if (!res.ok) throw buildError(res.status, data);
      return data;
    } catch (err) {
      if (err.name === 'TypeError' || /fetch|network/i.test(err.message)) {
        const netErr = new Error("Can't reach server — check your connection");
        netErr.code = 'NETWORK_ERROR';
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  }

  root.api = {
    get: (endpoint, options) => request('GET', endpoint, null, options),
    post: (endpoint, body, options) => request('POST', endpoint, body, options),
    put: (endpoint, body, options) => request('PUT', endpoint, body, options),
    delete: (endpoint, options) => request('DELETE', endpoint, null, options),
    upload: (endpoint, formData, options) => request('POST', endpoint, formData, options),
    setTokens,
    clearTokens,
    getAccessToken,
    tokenIsExpired,
  };
})(window);
