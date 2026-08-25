// =====================================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================================
// Verifies the Bearer access token on protected routes and attaches
// the decoded identity to `req.user`. Does NOT hit the database on
// every request — the JWT payload (uuid, role, username) is trusted
// once signature + expiry check out, which keeps protected routes fast.
// =====================================================================

const { verifyAccessToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = { uuid: decoded.sub, role: decoded.role, username: decoded.username };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token' });
  }
}

module.exports = requireAuth;
