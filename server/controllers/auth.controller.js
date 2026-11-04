// =====================================================================
// AUTH CONTROLLER
// =====================================================================
// Business logic for every /api/auth/* endpoint. Controllers stay thin:
// they validate nothing themselves (that's the validators' job, run
// before these reach the route), and they don't write raw SQL (that's
// the models' job) — this file just orchestrates the two.
// =====================================================================

const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userModel = require('../models/user.model');
const authTokenModel = require('../models/authToken.model');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateRawToken, hashToken } = require('../utils/token');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail, emailEnabled } = require('../services/email.service');

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;      // 1 hour
const googleStates = new Map();
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

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

function getAppUrl() {
  return process.env.APP_URL || (process.env.CLIENT_URL || '').split(',')[0].trim() || 'http://localhost:5000';
}

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function googleRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${getAppUrl()}/api/auth/google/callback`;
}

function createGoogleUsername(email) {
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 44) || 'player';
}

async function startGoogleAuth(req, res) {
  if (!googleConfigured()) {
    return res.redirect('/pages/login.html?oauth=not-configured');
  }

  const state = crypto.randomBytes(24).toString('hex');
  googleStates.set(state, Date.now() + 10 * 60 * 1000);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

async function googleCallback(req, res, next) {
  try {
    const { code, state, error } = req.query;
    if (error || !code || !state || !googleStates.has(state) || googleStates.get(state) < Date.now()) {
      googleStates.delete(state);
      return res.redirect('/pages/login.html?oauth=failed');
    }
    googleStates.delete(state);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error('Google token exchange failed');

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email || profile.email_verified !== true) {
      throw new Error('Google did not provide a verified email address');
    }

    let user = await userModel.findByEmail(profile.email.toLowerCase());
    if (!user) {
      const baseUsername = createGoogleUsername(profile.email);
      let username = baseUsername;
      for (let suffix = 1; await userModel.findByUsername(username); suffix += 1) {
        username = `${baseUsername.slice(0, 49 - String(suffix).length)}${suffix}`;
      }
      user = await userModel.createPlayer({
        uuid: uuidv4(),
        fullName: profile.name || username,
        username,
        email: profile.email.toLowerCase(),
        passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
        gamerTag: username.slice(0, 50),
        isEmailVerified: true,
      });
    } else if (!user.is_email_verified) {
      await userModel.markEmailVerified(user.id);
      user.is_email_verified = true;
    }

    if (user.status !== 'active') throw new Error(`Account is ${user.status}`);
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const decodedRefresh = jwt.decode(refreshToken);
    await authTokenModel.createToken(
      user.id,
      hashToken(refreshToken),
      'refresh',
      new Date(decodedRefresh.exp * 1000)
    );
    await userModel.recordLogin(user.id);
    const next = encodeURIComponent('/pages/dashboard.html');
    return res.redirect(`${getAppUrl()}/pages/login.html#google_access_token=${encodeURIComponent(accessToken)}&google_refresh_token=${encodeURIComponent(refreshToken)}&google_next=${next}`);
  } catch (err) {
    // Never leak a raw 500 to the browser from an OAuth redirect flow.
    // Network errors reaching Google, rejected tokens, or misconfigured
    // credentials all funnel here — send the user back to the login page
    // with a friendly status the UI already knows how to render.
    // eslint-disable-next-line no-console
    console.error('Google OAuth callback failed:', err.message);
    return res.redirect('/pages/login.html?oauth=failed');
  }
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

    // When email delivery isn't configured (local/dev without SMTP), we
    // can't send a verification link — so we auto-verify the account and
    // let the user straight in. Once real SMTP creds are set, this flips
    // back to the proper "verify your email first" flow automatically.
    const autoVerify = !emailEnabled;
    const user = await userModel.createPlayer({
      uuid,
      fullName,
      username,
      email,
      passwordHash,
      gamerTag,
      isEmailVerified: autoVerify,
    });

    let message;
    if (autoVerify) {
      message = 'Account created. You can log in now.';
    } else {
      // Issue an email verification token and send it. Registration
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
      message = 'Account created. Please check your email to verify your account.';
    }

    return res.status(201).json({
      success: true,
      message,
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
    const invalidMessage = { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
    if (!user) {
      return res.status(401).json(invalidMessage);
    }

    const passwordMatches = await comparePassword(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json(invalidMessage);
    }

    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        code: `ACCOUNT_${user.status.toUpperCase()}`,
        message: `Your account is ${user.status}. Contact support for help.`,
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    const decodedRefresh = jwt.decode(refreshToken);
    await authTokenModel.createToken(
      user.id,
      hashToken(refreshToken),
      'refresh',
      new Date(decodedRefresh.exp * 1000)
    );
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

    const tokenRecord = await authTokenModel.findValidToken(hashToken(incomingToken), 'refresh');
    if (!tokenRecord) {
      return res.status(401).json({ success: false, code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(incomingToken);
    } catch (err) {
      return res.status(401).json({ success: false, code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' });
    }

    const user = await userModel.findByUuid(decoded.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, code: 'ACCOUNT_INACTIVE', message: 'Account no longer available' });
    }

    await authTokenModel.markTokenUsed(tokenRecord.id);

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    const decodedRefresh = jwt.decode(newRefreshToken);
    await authTokenModel.createToken(
      user.id,
      hashToken(newRefreshToken),
      'refresh',
      new Date(decodedRefresh.exp * 1000)
    );

    return res.status(200).json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
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
    const emailResult = await sendPasswordResetEmail(user.email, rawToken);

    // In development (Ethereal test inbox), hand the preview URL back so
    // the user can actually open the "sent" email in their browser. In
    // production this is omitted — the real email is already in their inbox.
    if (emailResult && emailResult.previewUrl && isDev) {
      return res.status(200).json({ ...genericResponse, previewUrl: emailResult.previewUrl });
    }

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
// Revoke the provided refresh token server-side so it can no longer be
// used to mint new access tokens. Access tokens remain valid until they
// expire — the client must discard them too.
// ---------------------------------------------------------------------
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenRecord = await authTokenModel.findValidToken(hashToken(refreshToken), 'refresh');
      if (tokenRecord) await authTokenModel.markTokenUsed(tokenRecord.id);
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  startGoogleAuth,
  googleCallback,
  verifyEmail,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  me,
  logout,
};
