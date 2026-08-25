// =====================================================================
// EMAIL SERVICE
// =====================================================================
// Wraps nodemailer so controllers just call sendVerificationEmail(...)
// / sendPasswordResetEmail(...) without knowing SMTP details. If SMTP
// isn't configured (e.g. local dev without a mail account), emails are
// logged to the console instead of failing the request.
// =====================================================================

const nodemailer = require('nodemailer');

const isProduction = process.env.NODE_ENV === 'production';
const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const sendRealEmail = isProduction && isConfigured;

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for 587/others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

async function sendMail({ to, subject, html, link }) {
  if (!sendRealEmail) {
    // eslint-disable-next-line no-console
    console.log(`[email bypass - local dev] To: ${to} | Subject: ${subject}`);
    if (link) {
      // eslint-disable-next-line no-console
      console.log(`  Link: ${link}`);
    }
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"EFootball Arena" <no-reply@efootballarena.com>',
    to,
    subject,
    html,
  });
}

async function sendVerificationEmail(toEmail, rawToken) {
  const verifyUrl = `${process.env.CLIENT_URL}/pages/verify-email.html?token=${rawToken}`;
  await sendMail({
    to: toEmail,
    subject: 'Verify your EFootball Arena account',
    link: verifyUrl,
    html: `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>Welcome to EFootball Arena</h2>
        <p>Confirm your email address to activate your account.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#3476F6;color:#fff;border-radius:12px;text-decoration:none;">Verify Email</a></p>
        <p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(toEmail, rawToken) {
  const resetUrl = `${process.env.CLIENT_URL}/pages/reset-password.html?token=${rawToken}`;
  await sendMail({
    to: toEmail,
    subject: 'Reset your EFootball Arena password',
    link: resetUrl,
    html: `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>Password Reset Request</h2>
        <p>Click the button below to choose a new password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#3476F6;color:#fff;border-radius:12px;text-decoration:none;">Reset Password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not change.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
