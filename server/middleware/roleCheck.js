// =====================================================================
// ROLE-BASED ACCESS CONTROL
// =====================================================================
// Use after requireAuth (which sets req.user). requireRole('admin')
// restricts a route to admins only; requireRole('admin', 'moderator')
// allows either. Keeping this separate from requireAuth lets routes
// mix and match: some need only login, others need a specific role.
// =====================================================================

const userModel = require('../models/user.model');

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      // Should never happen if requireAuth ran first, but fail safe.
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
      const currentUser = await userModel.findByUuidWithRole(req.user.uuid);
      if (!currentUser) {
        return res.status(401).json({ success: false, message: 'Account no longer exists' });
      }

      req.user.role = currentUser.role;
      if (!allowedRoles.includes(currentUser.role)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = requireRole;
