// =====================================================================
// EMAIL SERVICE
// =====================================================================
// Wraps nodemailer so controllers just call sendVerificationEmail(...)
// / sendPasswordResetEmail(...) without knowing SMTP details.
//
// Delivery works in three tiers, tried in order:
//   1. REAL SMTP   — when SMTP_HOST + real credentials are set in .env
//                    (production). Emails go to the user's actual inbox.
//   2. ETHEREAL    — when SMTP isn't configured (local/dev). We spin up
//                    a free Ethereal test inbox and send the real email
//                    there. It's a genuine, readable email you open in a
//                    browser via a preview URL. No account needed.
//   3. CONSOLE     — if Ethereal can't be reached (e.g. no internet), we
//                    log the direct link so the flow still completes.
// Configure real SMTP_* values to switch back to true email delivery.
// =====================================================================

const nodemailer = require('nodemailer');

const appUrl = process.env.APP_URL || (process.env.CLIENT_URL || '').split(',')[0].trim() || 'http://localhost:5000';
const smtpValues = [process.env.SMTP_USER, process.env.SMTP_PASS];
const hasPlaceholderCredentials = smtpValues.some((value) => !value || /your_|change_this|app_password/i.test(value));

// True only when a real SMTP host + credentials are provided.
const emailEnabled = Boolean(process.env.SMTP_HOST && !hasPlaceholderCredentials);

// Real SMTP transporter (production). Null in local dev.
const smtpTransporter = emailEnabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587/others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

// Lazily-created Ethereal test transporter for local dev. Created once,
// then reused. `etherealState` is 'idle' | 'ready' | 'unavailable'.
let etherealTransporter = null;
let etherealState = 'idle';

async function getEtherealTransporter() {
  if (etherealState !== 'idle') return etherealTransporter;
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    etherealState = 'ready';
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP not configured — using a free Ethereal test inbox. Emails are real and openable via the preview URL.');
  } catch (err) {
    etherealState = 'unavailable';
    // eslint-disable-next-line no-console
    console.warn(`[email] Could not reach Ethereal (${err.message}). Falling back to logging links to the console.`);
  }
  return etherealTransporter;
}

/**
 * Send a single email. Returns { previewUrl, delivered }. `previewUrl`
 * is a browser-viewable link (Ethereal); `delivered` is false only when
 * no transport was available at all (caller then logs a direct link).
 * Never throws for a delivery problem — send failures are non-fatal.
 */
async function sendMail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || '"EFootball Arena" <no-reply@efootballarena.com>';

  // 1) Real SMTP (production).
  if (smtpTransporter) {
    await smtpTransporter.sendMail({ from, to, subject, html });
    return { previewUrl: null, delivered: true };
  }

  // 2) Ethereal test inbox (local/dev).
  const transporter = await getEtherealTransporter();
  if (transporter) {
    const info = await transporter.sendMail({ from, to, subject, html });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    // eslint-disable-next-line no-console
    console.log(`[email] ${subject} -> ${to}\n    Preview: ${previewUrl}`);
    return { previewUrl, delivered: true };
  }

  // 3) No transport available — caller logs the direct link as a fallback.
  return { previewUrl: null, delivered: false };
}

function logLink(kind, toEmail, url) {
  if (process.env.NODE_ENV === 'production') {
    // Reset and verification URLs contain live bearer tokens; never write
    // them to production logs when an email provider is unavailable.
    // eslint-disable-next-line no-console
    console.error(`[email] ${kind} email could not be delivered. Check SMTP configuration.`);
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `\n[email disabled] ${kind} email for ${toEmail} could not be delivered.\n` +
      `    Open this link to continue:\n    ${url}\n`
  );
}

const EMAIL_SHELL = (heading, body, ctaLabel, url) => `
  <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 480px; margin: auto;">
    <h2>${heading}</h2>
    <p>${body}</p>
    <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#3476F6;color:#fff;border-radius:12px;text-decoration:none;">${ctaLabel}</a></p>
  </div>
`;

async function sendVerificationEmail(toEmail, rawToken) {
  const verifyUrl = `${appUrl}/pages/verify-email.html?token=${rawToken}`;
  const html = EMAIL_SHELL(
    'Welcome to EFootball Arena',
    'Confirm your email address to activate your account. This link expires in 24 hours. If you didn\'t create this account, you can ignore this email.',
    'Verify Email',
    verifyUrl
  );
  let result;
  try {
    result = await sendMail({ to: toEmail, subject: 'Verify your EFootball Arena account', html });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to send verification email:', err.message);
    result = { previewUrl: null, delivered: false };
  }
  if (!result.delivered) logLink('Verification', toEmail, verifyUrl);
  return result;
}

async function sendPasswordResetEmail(toEmail, rawToken) {
  const resetUrl = `${appUrl}/pages/reset-password.html?token=${rawToken}`;
  const html = EMAIL_SHELL(
    'Password Reset Request',
    'Click the button below to choose a new password. This link expires in 1 hour. If you didn\'t request this, you can safely ignore this email — your password will not change.',
    'Reset Password',
    resetUrl
  );
  let result;
  try {
    result = await sendMail({ to: toEmail, subject: 'Reset your EFootball Arena password', html });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to send password reset email:', err.message);
    result = { previewUrl: null, delivered: false };
  }
  if (!result.delivered) logLink('Password reset', toEmail, resetUrl);
  return result;
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, emailEnabled };

// One-time startup notice so it's obvious which delivery mode is active.
if (emailEnabled) {
  // eslint-disable-next-line no-console
  console.log('[email] Real SMTP configured — verification/reset emails are delivered to real inboxes.');
} else {
  // eslint-disable-next-line no-console
  console.log('[email] SMTP not configured — dev mode: signups auto-verify and reset emails open in a test inbox. Set real SMTP_* values in .env to email real users.');
}
