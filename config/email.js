// config/email.js

import { Resend } from 'resend';
import nodemailer from 'nodemailer'
  // const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || 'Chit Chat <>';
const APP_URL = process.env.APP_URL  || 'http://localhost:3000';
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 2525,
  secure: false, // true for 465
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

const send = ({ to, subject, html, text }) =>
  transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
// ── Shared design tokens (inline — email clients strip <style> tags) ──────────
const C = {
  bg:        '#060b18',
  bgCard:    '#0d1527',
  bgDark:    '#0a0f1e',
  border:    '#1a2540',
  blue:      '#3b82f6',
  blueDark:  '#2563eb',
  blueLight: '#60a5fa',
  text:      '#e8edf8',
  muted:     '#8899b4',
  subtle:    '#4a5568',
  white:     '#ffffff',
};

// ── Shared wrapper ─────────────────────────────────────────────────────────────
const wrap = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chit Chat</title>
</head>
<body style="margin:0; padding:0; background:${C.bg}; font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:520px; background:${C.bgCard}; border-radius:20px; overflow:hidden; border:1px solid ${C.border};">

          ${content}

          <!-- Footer -->
          <tr>
            <td style="background:${C.bgDark}; padding:20px 24px; text-align:center; border-top:1px solid ${C.border};">
              <p style="margin:0 0 6px; font-size:13px; color:${C.subtle};">
                © ${new Date().getFullYear()} Chit Chat. All rights reserved.
              </p>
              <p style="margin:0; font-size:12px; color:${C.subtle};">
                Questions? <a href="akugbedesmond845@gmail.com" style="color:${C.blueLight}; text-decoration:none;">support@chitchat.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Header block (reused across all emails) ────────────────────────────────────
const header = (title, subtitle) => `
  <tr>
    <td style="background:linear-gradient(135deg, ${C.blueDark}, ${C.blueLight}); padding:36px 24px; text-align:center;">
      <div style="width:52px; height:52px; background:rgba(255,255,255,0.15); border-radius:14px;
        display:inline-flex; align-items:center; justify-content:center;
        font-size:28px; margin-bottom:16px; line-height:52px;">💬</div>
      <h1 style="margin:0; font-size:24px; font-weight:700; color:${C.white}; letter-spacing:-0.3px;">${title}</h1>
      ${subtitle ? `<p style="margin:8px 0 0; font-size:15px; color:rgba(255,255,255,0.8);">${subtitle}</p>` : ''}
    </td>
  </tr>`;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OTP / Verification email
// ═══════════════════════════════════════════════════════════════════════════════
export const sendOTP = async (email, otp) => {
  const html = wrap(`
    ${header('Verify your email', 'One step away from joining Chit Chat')}

    <tr>
      <td style="padding:36px 28px;">

        <p style="margin:0 0 20px; font-size:15px; color:${C.text}; line-height:1.6;">
          Hey there! Here's your verification code:
        </p>

        <!-- OTP box -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding:8px 0 28px;">
              <div style="display:inline-block; background:${C.bgDark}; border:2px solid ${C.blue};
                border-radius:16px; padding:20px 40px;">
                <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:${C.blueLight};
                  font-family:'Courier New', monospace;">${otp}</span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Info card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:${C.bgDark}; border-radius:12px; padding:16px 20px; border:1px solid ${C.border};">
              <p style="margin:0 0 6px; font-size:13px; color:${C.muted};">
                ⏱ This code expires in <strong style="color:${C.text};">10 minutes</strong>.
              </p>
              <p style="margin:0; font-size:13px; color:${C.muted};">
                🔒 If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  `);

  return send({
    // from:    FROM,
    to:      email,
    subject: 'Your Chit Chat verification code',
    html,
    text:    `Your Chit Chat verification code is: ${otp}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.\n\n– The Chit Chat Team`,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Welcome email (sent after signup completes)
// ═══════════════════════════════════════════════════════════════════════════════
export const sendWelcome = async (email, username) => {
  const html = wrap(`
    ${header('Welcome to Chit Chat 🎉', 'Your conversations, now in one place.')}

    <tr>
      <td style="padding:36px 28px;">

        <p style="margin:0 0 20px; font-size:15px; color:${C.text}; line-height:1.6;">
          Hi <strong style="color:${C.blueLight};">${username}</strong>,
        </p>
        <p style="margin:0 0 24px; font-size:15px; color:${C.muted}; line-height:1.7;">
          We're really glad you're here. Chit Chat is built for real, meaningful conversations —
          whether with friends, family, or people you've just met.
        </p>

        <!-- What's next card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td style="background:${C.bgDark}; border-radius:14px; padding:20px 22px; border:1px solid ${C.border};">
              <p style="margin:0 0 14px; font-size:14px; font-weight:700; color:${C.text}; letter-spacing:0.02em;">
                ✨ GET STARTED
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${[
                  ['🔍', 'Discover people', 'Use the Discover tab to find and add friends.'],
                  ['🎨', 'Customize your profile', 'Add a photo and bio so friends can find you.'],
                  ['📢', 'Stay in the loop', 'Check the ChitChat Updates channel for news and tips.'],
                ].map(([icon, title, desc]) => `
                  <tr>
                    <td style="padding:6px 0; vertical-align:top; width:28px; font-size:16px;">${icon}</td>
                    <td style="padding:6px 0 6px 8px;">
                      <span style="font-size:14px; font-weight:600; color:${C.text};">${title}</span>
                      <span style="font-size:14px; color:${C.muted};"> — ${desc}</span>
                    </td>
                  </tr>`).join('')}
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA button -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}"
                style="display:inline-block; background:linear-gradient(135deg, ${C.blueDark}, ${C.blue});
                  color:${C.white}; text-decoration:none; padding:14px 40px;
                  border-radius:40px; font-size:15px; font-weight:600;
                  letter-spacing:0.01em; box-shadow:0 4px 16px rgba(37,99,235,0.4);">
                Start chatting →
              </a>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  `);

  return send({
    // from:    FROM,
    to:      email,
    subject: `Welcome to Chit Chat, ${username}! 🎉`,
    html,
    text:    `Hi ${username},\n\nWelcome to Chit Chat! We're excited to have you.\n\nGet started:\n- Discover people using the Discover tab\n- Customize your profile with a photo and bio\n- Check the ChitChat Updates channel for news\n\nOpen the app: ${APP_URL}\n\nNeed help? Reply to this email.\n\n– The Chit Chat Team`,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Password reset email
// ═══════════════════════════════════════════════════════════════════════════════
export const sendPasswordReset = async (email, otp) => {
  const html = wrap(`
    ${header('Reset your password', 'We received a password reset request')}

    <tr>
      <td style="padding:36px 28px;">

        <p style="margin:0 0 20px; font-size:15px; color:${C.text}; line-height:1.6;">
          Use the code below to reset your Chit Chat password:
        </p>

        <!-- OTP box -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding:8px 0 28px;">
              <div style="display:inline-block; background:${C.bgDark}; border:2px solid ${C.blue};
                border-radius:16px; padding:20px 40px;">
                <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:${C.blueLight};
                  font-family:'Courier New', monospace;">${otp}</span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Warning card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:rgba(239,68,68,0.08); border-radius:12px; padding:16px 20px;
              border:1px solid rgba(239,68,68,0.2);">
              <p style="margin:0 0 6px; font-size:13px; color:#fca5a5;">
                ⏱ This code expires in <strong>10 minutes</strong>.
              </p>
              <p style="margin:0; font-size:13px; color:#fca5a5; opacity:0.8;">
                🔒 If you didn't request a password reset, please ignore this email — your account is safe.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  `);

  return send({
    // from:    FROM,
    to:      email,
    subject: 'Reset your Chit Chat password',
    html,
    text:    `Your Chit Chat password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email — your account is safe.\n\n– The Chit Chat Team`,
  });
};
