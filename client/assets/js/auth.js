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
    // Tokens live in the storage that actually has an access token
    // (localStorage when "Remember me" is checked, sessionStorage otherwise).
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
    return data.data && data.data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout', { refreshToken: getRefreshToken() }, { _skipRefresh: true });
    } catch {
      // Always clear client-side tokens, even if the server call fails.
    }
    api.clearTokens();
    window.location.href = config.AUTH_REDIRECT;
  }

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

    updateNotificationBadge();

    document.querySelectorAll('#logoutBtn, #topbarLogoutBtn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    });
  }

  function getUser() {
    return getStoredUser();
  }

  async function updateNotificationBadge() {
    if (!isAuthenticated()) return;
    const dot = document.getElementById('notificationDot');
    if (!dot) return;
    try {
      const data = await api.get('/notification?limit=1&unreadOnly=true');
      const count = data.data && data.data.unreadCount ? Number(data.data.unreadCount) : 0;
      dot.hidden = count === 0;
      dot.title = `${count} unread notification${count === 1 ? '' : 's'}`;
    } catch {
      dot.hidden = true;
    }
  }

  root.auth = {
    login,
    register,
    logout,
    requireAuth,
    redirectIfAuthenticated,
    isAuthenticated,
    getUser,
    fetchCurrentUser,
    updateAuthUI,
    updateNotificationBadge,
  };
})(window);
