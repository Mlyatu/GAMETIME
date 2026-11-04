// =====================================================================
// ADMIN CONTROLLER
// =====================================================================
// User administration: list, create, and permanently delete accounts.
// Every route here is admin-only (enforced in admin.routes.js). Nothing
// here writes raw SQL — that lives in the models. Deletes are HARD
// (permanent) per the product requirement: a removed user is gone from
// the database, not just soft-flagged.
// =====================================================================

const { v4: uuidv4 } = require('uuid');

const userModel = require('../models/user.model');
const playerModel = require('../models/player.model');
const adminModel = require('../models/admin.model');
const { hashPassword } = require('../utils/password');

const VALID_ROLES = ['player', 'moderator', 'admin'];

/** GET /api/admin/overview — live dashboard aggregates and recent audit activity. */
const getOverview = async (req, res, next) => {
  try {
    const overview = await adminModel.getOverview();
    return res.status(200).json({ success: true, data: { overview } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/users
 * Paginated, searchable list of every (non-deleted) user with their
 * profile stats — powers the admin "Users" table.
 */
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const players = await playerModel.listPlayers({ page, limit, search });
    return res.status(200).json({ success: true, data: { players, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/users
 * Create a new account with a chosen role. Password is hashed here; the
 * account is created verified + active so the admin can hand credentials
 * straight to the person. Duplicate email/username → 409.
 */
const createUser = async (req, res, next) => {
  try {
    const { fullName, username, email, password, role = 'player', gamerTag } = req.body;

    if (!VALID_ROLES.includes(role)) {
      return res.status(422).json({ success: false, message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const [existingEmail, existingUsername] = await Promise.all([
      userModel.findByEmail(email),
      userModel.findByUsername(username),
    ]);
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'This username is already taken' });
    }

    const passwordHash = await hashPassword(password);
    const user = await userModel.createUserByAdmin({
      uuid: uuidv4(),
      fullName,
      username,
      email,
      passwordHash,
      role,
      gamerTag: gamerTag || username,
      isEmailVerified: true,
    });

    return res.status(201).json({
      success: true,
      message: `User '${user.username}' created as ${user.role}.`,
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/users/:uuid
 * Permanently delete a user. Guards:
 *   - can't delete yourself (avoid locking the last admin out),
 *   - can't delete the last remaining admin.
 */
const deleteUser = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const target = await userModel.findByUuidWithRole(uuid);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (target.uuid === req.user.uuid) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    if (target.role === 'admin') {
      const adminCount = await userModel.countAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: 'You cannot delete the last admin account' });
      }
    }

    const actingAdmin = await userModel.findByUuid(req.user.uuid);
    await userModel.hardDeleteUser(target.id, actingAdmin.id);

    return res.status(200).json({ success: true, message: `User '${target.username}' has been permanently deleted.` });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getOverview, listUsers, createUser, deleteUser };
