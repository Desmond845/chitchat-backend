import express from 'express';
import webpush from 'web-push';
import User from '../models/User.js';
import {authenticate} from '../middleware/auth.js';

const router = express.Router();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Save subscription
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    await User.findByIdAndUpdate(req.userId, {
      pushSubscription: subscription
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as pushRoutes };
export { webpush }; // export so server.js