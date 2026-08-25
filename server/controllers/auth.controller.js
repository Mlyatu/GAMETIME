// =====================================================================
// AUTH CONTROLLER
// =====================================================================
// Business logic for every /api/auth/* endpoint. Controllers stay thin:
// they validate nothing themselves (that's the validators' job, run
// before these reach the route), and they don't write raw SQL (that's
// the models' job) — this file just orchestrates the two.
// =====================================================================

const { v4: uuidv4 } = require('uuid');

const userModel = require('../models/user.model');
const authTokenModel = require('../models/authToken.model');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateRawToken, hashToken } = require('../utils/token');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email.service');

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;      // 1 hour

/** Shape returned to the client for a logged-in/registered user — never includes password_hash. */
function toPublicUser(user) {
  return {
    uuid: user.uuid,
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    role: user.role,
    isEmailVerified: user.is_email_verified,
  };
}

// ---------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------
async function register(req, res, next) {
  try {
    const { fullName, username, email, password, gamerTag } = req.body;

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
    const uuid = uuidv4();

    const user = await userModel.createPlayer({ uuid, fullName, username, email, passwordHash, gamerTag });

    // Issue an email verification token and send it — registration
    // succeeds either way; a failed email send shouldn't block signup.
    const rawToken = generateRawToken();
    await authTokenModel.createToken(
      user.id,
      hashToken(rawToken),
      'email_verification',
      new Date(Date.now() + EMAIL_TOKEN_TTL_MS)
    );
    sendVerificationEmail(user.email, rawToken).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to send verification email:', err.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
      data: { user: toPublicUser(user) },
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/auth/verify-email?token=...
// ---------------------------------------------------------------------
async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const tokenRecord = await authTokenModel.findValidToken(hashToken(token), 'email_verification');
    if (!tokenRecord) {
      return res.status(400).json({ success: false, message: 'This verification link is invalid or has expired' });
    }

    await userModel.markEmailVerified(tokenRecord.user_id);
    await authTokenModel.markTokenUsed(tokenRecord.id);

    return res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await userModel.findByEmail(email);
    // Deliberately identical error for "no such user" and "wrong
    // password" — telling them apart lets an attacker enumerate which
    // emails have accounts.
    const invalidMessage = { success: false, message: 'Invalid email or password' };
    if (!user) {
      return res.status(401).json(invalidMessage);
    }

    const passwordMatches = await comparePassword(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json(invalidMessage);
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: `Your account is ${user.status}. Contact support for help.` });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await userModel.recordLogin(user.id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: toPublicUser(user), accessToken, refreshToken },
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/refresh-token
// ---------------------------------------------------------------------
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: incomingToken } = req.body;

    let decoded;
    try {
      decoded = verifyRefreshToken(incomingToken);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await userModel.findByUuid(decoded.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Account no longer available' });
    }

    const newAccessToken = signAccessToken(user);
    return res.status(200).json({ success: true, data: { accessToken: newAccessToken } });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await userModel.findByEmail(email);

    // Always return the same success message whether or not the email
    // exists — otherwise this endpoint becomes an account-enumeration
    // tool ("email not found" vs "reset link sent").
    const genericResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    await authTokenModel.invalidateUserTokens(user.id, 'password_reset');

    const rawToken = generateRawToken();
    await authTokenModel.createToken(
      user.id,
      hashToken(rawToken),
      'password_reset',
      new Date(Date.now() + RESET_TOKEN_TTL_MS)
    );
    await sendPasswordResetEmail(user.email, rawToken);

    return res.status(200).json(genericResponse);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    const tokenRecord = await authTokenModel.findValidToken(hashToken(token), 'password_reset');
    if (!tokenRecord) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired' });
    }

    const passwordHash = await hashPassword(newPassword);
    await userModel.updatePassword(tokenRecord.user_id, passwordHash);
    await authTokenModel.markTokenUsed(tokenRecord.id);

    return res.status(200).json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/auth/me  (requires requireAuth middleware)
// ---------------------------------------------------------------------
async function me(req, res, next) {
  try {
    const user = await userModel.findByUuid(req.user.uuid);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, data: { user: toPublicUser(user) } });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------
// Stateless JWTs can't be "deleted" server-side without a blocklist.
// Since refresh tokens aren't persisted per-session in this design
// (only email/reset tokens are), logout is handled by the client
// discarding both tokens. This endpoint exists for a consistent API
// shape and as the natural place to add token-blocklisting later if
// needed (e.g. storing revoked JTIs in Redis).
// ---------------------------------------------------------------------
async function logout(req, res) {
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

module.exports = {
  register,
  verifyEmail,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  me,
  logout,
};
