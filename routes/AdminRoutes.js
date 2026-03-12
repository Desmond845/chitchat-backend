import express from "express";
import { authenticate } from "../middleware/auth.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

export default function adminRoutes(io, userSockets) {
  const router = express.Router();

  // ── Middleware: only ChitChat Updates account allowed ─────────────────────
  const requireUpdatesAccount = async (req, res, next) => {
    try {
      const user = await User.findById(req.userId).select("username");
      if (!user || user.username !== "ChitChat Updates") {
        return res.status(403).json({ error: "Access denied" });
      }
      req.updatesUser = user;
      next();
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  };

  // ── POST /api/admin/broadcast ──────────────────────────────────────────────
  // Body: { text: "My announcement here" }
  // Saves ONE message per user (receiverId = each user), sends real-time to online users.
  router.post(
    "/broadcast",
    authenticate,
    requireUpdatesAccount,
    async (req, res) => {
      const { text } = req.body;

      if (!text?.trim()) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }
      if (text.length > 1000) {
        return res
          .status(400)
          .json({ error: "Message too long (max 1000 characters)" });
      }

      try {
        const senderId = req.updatesUser._id;
        const allUsers = await User.find({ _id: { $ne: senderId } })
          .select("_id")
          .lean();
        const now = new Date();

        // Build all message docs at once for one DB call (much faster than a loop)
        const docs = allUsers.map((u) => ({
          senderId,
          receiverId: u._id,
          text: text.trim(),
          edited: false,
          status: "sent",
          createdAt: now,
          updatedAt: now,
        }));

        const saved = await Message.insertMany(docs);

        // Send real-time to every online user
        let delivered = 0;
        saved.forEach((msg) => {
          const socketId = userSockets[msg.receiverId.toString()];
          if (socketId) {
            io.to(socketId).emit("chat message", {
              id: msg._id,
              text: msg.text,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              edited: false,
              status: "sent",
              createdAt: msg.createdAt.toISOString(),
            });
            delivered++;
          }
        });

        res.json({
          success: true,
          total: allUsers.length,
          delivered, // how many were online and got it instantly
          message: `Broadcast sent to ${allUsers.length} users (${delivered} online now)`,
        });
      } catch (err) {
        console.error("Broadcast error:", err);
        res.status(500).json({ error: "Failed to send broadcast" });
      }
    }
  );

  // ── GET /api/admin/stats ───────────────────────────────────────────────────
  // Returns quick stats for the dashboard
  router.get(
    "/stats",
    authenticate,
    requireUpdatesAccount,
    async (req, res) => {
      try {
        const [totalUsers, totalMessages, onlineCount] = await Promise.all([
          User.countDocuments({ username: { $ne: "ChitChat Updates" } }),
          Message.countDocuments({ senderId: req.updatesUser._id }),
          Promise.resolve(Object.keys(userSockets).length), // minus Updates account itself
        ]);
        res.json({ totalUsers, totalMessages, onlineCount });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );
  // ── GET /api/admin/history ─────────────────────────────────────────────────
  // Returns the last 20 broadcasts sent (deduplicated — one per batch by createdAt second)
  router.get(
    "/history",
    authenticate,
    requireUpdatesAccount,
    async (req, res) => {
      try {
        // Get distinct messages (group by text + createdAt minute to deduplicate broadcasts)
        const msgs = await Message.find({ senderId: req.updatesUser._id })
          .sort({ createdAt: -1 })
          .select("text createdAt")
          .lean();

        // Deduplicate: keep first occurrence of each unique text+timestamp-minute combo
        const seen = new Set();
        const unique = [];
        for (const m of msgs) {
          const key = `${m.text}__${new Date(m.createdAt)
            .toISOString()
            .slice(0, 16)}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(m);
            if (unique.length >= 20) break;
          }
        }
        res.json(unique);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  return router;
}
