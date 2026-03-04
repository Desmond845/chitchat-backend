// config/email.js

const BASE = 'https://api.emailjs.com/api/v1.0/email/send';

const send = async (templateId, toEmail, variables) => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  process.env.EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id:     process.env.EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: toEmail,
        ...variables,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`EmailJS error: ${error}`);
  }

  return res;
};


export const sendOTP = (email, otp) =>
  send(process.env.EMAILJS_OTP_TEMPLATE, email, {
    otp,
    purpose: 'Verify your email ✅',
    message: 'Hey there! Here\'s your Chit Chat verification code:',
  });

export const sendWelcome = (email, username) =>
  send(process.env.EMAILJS_WELCOME_TEMPLATE, email, {
    otp: '👋',  // no code needed, just a wave emoji
    purpose: `Welcome, ${username}!  🎉`,
    message: `We're so glad you're here. Start discovering friends and chatting now!`,
  });

export const sendPasswordReset = (email, otp) =>
  send(process.env.EMAILJS_OTP_TEMPLATE, email, { // ← same template as OTP!
    otp,
    purpose: 'Reset your password 🔐',
    message: 'Use the code below to reset your Chit Chat password:',
  });
