import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,  // TLS, not SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,  // App Password!
  },
  tls: { rejectUnauthorized: false },  // sometimes needed
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

export default transporter;
