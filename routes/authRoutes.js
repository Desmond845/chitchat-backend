import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendOTP, sendPasswordReset, sendWelcome, } from '../config/email.js';

import { authenticate } from '../middleware/auth.js';
import Message from '../models/Message.js';
import transporter from '../config/email.js';
import Otp from '../models/Otp.js';
import { body, validationResult } from 'express-validator';

import { v4 as uuidv4 } from 'uuid'; 


const router = express.Router();
const generateUniqueShortId = async () => {
  let shortId;
  let exists = true;
  while (exists) {
    shortId = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7‑digit string
    exists = await User.findOne({ shortId });
  }
  return shortId;
};
// GET /api/users/discover?page=1&limit=20&search=...
router.get('/discover', authenticate, async (req, res) => {

  console.log(`btt`);
  const { page = 1, limit = 20, search = '' } = req.query;
  const skip = (page - 1) * limit;
  const currentUserId = req.userId;
  console.log(currentUserId);
try{

  const query = {
    _id: { $ne: currentUserId },
  };


  if (search) {
  const isNum = /^\d+$/.test(search);
  query.$or = [
    { username: { $regex: search, $options: 'i' } },
    ...(isNum ? [{ id: parseInt(search) }] : [])
  ];
}
  
  const users = await User.find(query)
  .select('username id avatar bio')
  .skip(skip)
  .limit(parseInt(limit))
    .lean();
    
    const total = await User.countDocuments(query);
    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch(err) {
  }
});
// Signup
router.post('/signup', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    // Check if user exists
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username already taken' });
const id = await generateUniqueShortId()
    const user = new User({ username, password, id });
    await user.save();

    // Create token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user._id, username: user.username, id: user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/find', authenticate, async (req, res) => {
  const { id } = req.query;
  try {
const user = await User.findOne({ id }).select('username id _id lastSeen avatar bio createdAt');
    console.log(user);
    if (!user) return res.status(404).json({ error: 'Usr not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/:userId', authenticate, async (req, res) => {
  try {
 const user = await User.findById(req.params.userId).select('username id lastSeen avatar bio createdAt');
    if (!user) return res.status(404).json({ error: 'Users not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Login
router.post('/login', async (req, res, next) => {
  try {
const { identifier, password } = req.body; // identifier can be email or username
const user = await User.findOne({
  $or: [{ username: identifier }, { email: identifier }]
});





    if (!user) return res.status(401).json({ error: 'Invalid username' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user._id, username: user.username, id: user.id, avatar: user.avatar || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});










// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


router.post('/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const existing = await User.findOne({ email })
if(existing) return res.status(400).json({error: "Email already exists"})
  const otp = generateOTP();
console.log(otp);
  // Delete any previous OTP for this email
  await Otp.deleteMany({ email, purpose: 'signup' });

  // Save new OTP
  await Otp.create({ email, otp, purpose: 'signup' });

  try {
  await sendOTP(email, otp)
    res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});


router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  const record = await Otp.findOne({ email, purpose: 'signup' });
  if (!record) {
    return res.status(400).json({ error: 'No OTP requested for this email' });
  }

  if (Date.now() - record.createdAt > 10 * 60 * 1000) {
    await Otp.deleteOne({ _id: record._id });
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  await Otp.deleteOne({ _id: record._id });

  const tempToken = jwt.sign({ email, otpVerified: true }, process.env.JWT_SECRET, { expiresIn: '15m' });
  res.json({ tempToken });
});

router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();

  await Otp.deleteMany({ email, purpose: 'signup' });
  await Otp.create({ email, otp, purpose: 'signup' });

  try {
    await sendOTP(email, otp);

    res.json({ message: 'OTP resent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});
// Final signup after OTP verification
router.post('/complete-signup',  [
  body('username').trim().isLength({ min: 3, max: 20 }),
  body('password').isLength({ min: 6 }),
  body('termsAccepted').isBoolean().equals('true')
], async (req, res) => {
 
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array()[0].msg);
    return res.status(400).json({ error: errors.array()[0].msg });
};

  const { tempToken, username, termsAccepted } = req.body;
  if (!termsAccepted) return res.status(400).json({ error: 'You must accept the terms' });

  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!decoded.otpVerified) return res.status(400).json({ error: 'Invalid token' });
    const { email } = decoded;

    // Check if username already exists
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username taken' });

    
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const id = await generateUniqueShortId();
    const user = new User({ username, email, password, id });
    await user.save();
// Find official user
// Create token for login
const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const official = await User.findOne({ username: 'ChitChat Official' });
if (official) {
  const welcomeMsg = new Message({
    senderId: official._id,
    receiverId: user._id,
    text: "👋 Welcome to Chit Chat! We're thrilled to have you here. Start connecting with friends and enjoy real‑time conversations. If you have any questions, feel free to reach out through this channel",
    edited: false,
    status: 'sent',
    createdAt: new Date()
  });
setTimeout(async () => {
  
  await welcomeMsg.save();
}, 5000);
} else {
  console.warn('⚠️ Official user not found – welcome message not sent');
}
try {
     
  await sendWelcome(email, username)

  console.log(`📧 Welcome email sent to ${email}`);
} catch (emailErr) {

}
res.json({ token, userId: user._id, username: user.username, id: user.id, avatar: user.avatar, bio: user.bio });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});



// Request password reset OTP\

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'No account with that email' });

  const otp = generateOTP();
console.log(otp);
  await Otp.deleteMany({ email, purpose: 'reset' });

  await Otp.create({ email, otp, purpose: 'reset' });

  try {
    await sendPasswordReset(email, otp);

    res.json({ message: 'Reset code sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Verify reset OTP
router.post('/verify-reset-otp', async (req, res) => {
  const { email, otp } = req.body;

  const record = await Otp.findOne({ email, purpose: 'reset' });
  if (!record) return res.status(400).json({ error: 'No reset request found' });

  // Check expiration manually
  if (Date.now() - record.createdAt > 10 * 60 * 1000) {
    await Otp.deleteOne({ _id: record._id });
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

  // OTP valid – delete it and generate reset token
  await Otp.deleteOne({ _id: record._id });

  const resetToken = jwt.sign({ email, purpose: 'reset' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  res.json({ resetToken });
});

router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'reset') throw new Error();

    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

export default router;
