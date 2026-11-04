/**
 * =====================================================================
 * ARENA AUTH
 * =====================================================================
 * Token storage, login/logout helpers, and route guards for the
 * client-side. Every protected page should call `auth.requireAuth()`
 * inside its page script; auth pages can call `auth.redirectIfAuthenticated()`
 * to send already-logged-in users to their dashboard.
 * =====================================================================
 */

(function (root) {
  const config = root.ARENA_CONFIG;
  const { api } = root;

  function getTokenStorage() {
    // The storage marker can live in EITHER store depending on the
    // "remember me" choice, so we must check both. Previously we only
    // looked in localStorage, which meant a session-stored token (remember
    // me OFF, the default) was invisible right after login — protected
    // pages couldn't find the token and bounced the user back to login.
    if (sessionStorage.getItem(config.TOKEN_STORAGE_KEY) === 'session') return sessionStorage;
    if (localStorage.getItem(config.TOKEN_STORAGE_KEY) === 'local') return localStorage;
    // Fallback: prefer whichever store actually holds an access token.
    if (localStorage.getItem(config.ACCESS_TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(config.ACCESS_TOKEN_KEY)) return sessionStorage;
    return localStorage;
  }

  function getAccessToken() {
    return getTokenStorage().getItem(config.ACCESS_TOKEN_KEY);
  }

  function getRefreshToken() {
    return getTokenStorage().getItem(config.REFRESH_TOKEN_KEY);
  }

  function getStoredUser() {
    const raw = getTokenStorage().getItem(config.USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setStoredUser(user, rememberMe) {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(config.USER_KEY, JSON.stringify(user));
  }

  function isAuthenticated() {
    const token = getAccessToken();
    return Boolean(token && !api.tokenIsExpired(token));
  }

  async function login(email, password, rememberMe = false) {
    const data = await api.post('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = data.data;
    api.setTokens(accessToken, refreshToken, rememberMe);
    setStoredUser(user, rememberMe);
    return user;
  }

  async function register(payload) {
    const data = await api.post('/auth/register', payload);
    // Return both the created user and the server's message so the UI can
    // tell the user whether to verify by email or log in straight away.
    return { user: data.data && data.data.user, message: data.message };
  }

  async function handleGoogleCallback() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('google_access_token');
    const refreshToken = params.get('google_refresh_token');
    if (!accessToken || !refreshToken) return false;

    api.setTokens(accessToken, refreshToken, true);
    await fetchCurrentUser();
    const next = params.get('google_next') || '/pages/dashboard.html';
    window.location.replace(next);
    return true;
  }

  async function logout() {
    try {
      await api.post('/auth/logout', { refreshToken: getRefreshToken() }, { _skipRefresh: true });
    } catch {
      // Always clear client-side tokens, even if the server call fails.
    }
    api.clearTokens();
    window.location.replace(config.HOME_REDIRECT);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#logoutBtn, #topbarLogoutBtn');
    if (!button) return;
    event.preventDefault();
    logout();
  });

  function requireAuth(redirectUrl) {
    if (!isAuthenticated()) {
      const next = redirectUrl || window.location.pathname + window.location.search;
      window.location.replace(`${config.AUTH_REDIRECT}?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  }

  function redirectIfAuthenticated() {
    if (isAuthenticated()) {
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next') || config.DEFAULT_PROTECTED_REDIRECT;
      window.location.replace(next);
      return true;
    }
    return false;
  }

  async function fetchCurrentUser() {
    if (!isAuthenticated()) return null;
    const data = await api.get('/auth/me');
    const user = data.data.user;
    const rememberMe = localStorage.getItem(config.TOKEN_STORAGE_KEY) !== 'session';
    setStoredUser(user, rememberMe);
    return user;
  }

  async function updateAuthUI() {
    let user = getStoredUser();
    if (!user && isAuthenticated()) {
      try {
        user = await fetchCurrentUser();
      } catch {
        return;
      }
    }
    if (!user) return;

    const topbarUsername = document.getElementById('topbarUsername');
    if (topbarUsername) topbarUsername.textContent = user.username || user.fullName || 'Player';

    const topbarAvatar = document.getElementById('topbarAvatar');
    if (topbarAvatar && user.avatarUrl) topbarAvatar.src = user.avatarUrl;

    if (user.role === 'admin' || user.role === 'moderator') {
      document.querySelectorAll('.sidebar-admin-only').forEach((el) => {
        el.style.display = 'block';
      });
    }

  }

  document.addEventListener('arena:includes-loaded', () => {
    updateAuthUI().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to update authenticated UI:', err);
    });
  });

  function getUser() {
    return getStoredUser();
  }

  root.auth = {
    login,
    register,
    handleGoogleCallback,
    logout,
    requireAuth,
    redirectIfAuthenticated,
    isAuthenticated,
    getUser,
    fetchCurrentUser,
    updateAuthUI,
  };
})(window);
