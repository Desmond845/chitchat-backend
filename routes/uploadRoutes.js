
import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import streamifier from 'streamifier';   // <-- import streamifier

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const uploadToCloudinary = (buffer, userId, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'chitchat/avatars',
        public_id: `user_${userId}_${Date.now()}`,
        ...options
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// POST /api/users/avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload buffer directly to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, req.userId);

    // Update user in database with new avatar URL
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: result.secure_url },
      { returnDocument: 'after' } // return the updated document
    ).select('username id avatar');

    res.json({ avatar: user.avatar });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE /api/users/avatar (remove avatar)
router.delete('/avatar', authenticate, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: '' },
      { returnDocument: 'after' } // return the updated document
    ).select('avatar');
    res.json({ avatar: '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove avatar' });
  }
});

// GET /api/users/me (own profile)
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/me (update bio)
router.patch('/me', authenticate, async (req, res) => {
  try {
    const { bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { bio },
      { returnDocument: 'after' } // return the updated document
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;