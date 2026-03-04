// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import connectDB from './db.js';
import messageRoutes from './routes/messageRoutes.js';
import { saveMessage, seedMessages } from './controllers/messageController.js';
import authRoutes from './routes/authRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js';
import rateLimit from 'express-rate-limit';
import adminRoutes from './routes/AdminRoutes.js';
import Message from './models/Message.js';
import User from './models/User.js';
import helmet from 'helmet';
import { error } from 'console';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, 
  message: { error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true, 
  legacyHeaders: false,
});
  const app = express();

const allowedOrigins = ['http://localhost:3000', 'https://chitchat-chatsite.netlify.app'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(helmet())
app.use('/api/auth', authLimiter, authRoutes)
app.use(express.urlencoded({ extended: false }));
// API routes
app.use('/api/messages', messageRoutes);

app.use('/api/users', uploadRoutes);
// Wait for DB connection, then seed and start server
connectDB().then(async () => {

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin:[
        "http://localhost:3000",
        "https://chitchat-chatsite.netlify.app"
        ],
      methods: ["GET", "POST"]
      credentials: true
    }
  });
const userSockets = {}; // userId -> socketId

const onlineUsers = new Map();
app.use('/api/admin', adminRoutes(io, userSockets))
  // Socket.io
  io.on('connection', (socket) => {

   
    socket.on('register', async (userId) => {
      onlineUsers.set(userId, socket.id)
    userSockets[userId] = socket.id;
    socket.userId = userId
    await User.findByIdAndUpdate(userId, {lastSeen: null})
    socket.broadcast.emit('user online', userId)
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });


    socket.on('chat message', async (msg) => {
  try {
    // Save the original message
    const messageDoc = new Message({
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      text: msg.text,
      edited: false
    });
    const saved = await messageDoc.save();

    const updatesUser = await User.findOne({ username: 'ChitChat Updates' });
    if (updatesUser && saved.senderId.toString() === updatesUser._id.toString()) {
      // This is a broadcast message – create a copy for every user
      const allUsers = await User.find({}, '_id'); // get all user IDs
      for (const user of allUsers) {
        if (user._id.toString() === updatesUser._id.toString()) continue; // skip self
        const broadcastMsg = new Message({
          senderId: updatesUser._id,
          receiverId: user._id,
          text: saved.text,
          edited: false,
          status: 'sent',
          createdAt: saved.createdAt
        });
        await broadcastMsg.save();

        // If user is online, send real-time
        const receiverSocketId = userSockets[user._id.toString()];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('chat message', {
            id: broadcastMsg._id,
            text: broadcastMsg.text,
            senderId: broadcastMsg.senderId,
            receiverId: broadcastMsg.receiverId,
            edited: broadcastMsg.edited,
            createdAt: broadcastMsg.createdAt.toISOString(),
            status: 'sent'
          });
        }
      }
      // Also send confirmation to the sender (Updates)
      socket.emit('message saved', { tempId: msg.tempId, ...saved.toObject() });
      return; // already handled
    }

    // Normal message handling (existing code)
    const receiverSocketId = userSockets[msg.receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('chat message', saved);
      socket.emit('message delivered', { messageId: saved._id });
    }
    socket.emit('message saved', { tempId: msg.tempId, ...saved.toObject() });

  } catch (err) {
    console.error('Failed to save message:', err);
  }
});
    
    socket.on("avatar changed", ({userId, newAvatar}) => {
socket.broadcast.emit('avatar updated', { userId, newAvatar})
  })
      socket.on("profile updated", (data) => {
socket.broadcast.emit('user profile updated', data)
  })
    socket.on('typing', (data) => {
  // Broadcast to the receiver only (not to everyone!)
  const receiverSocketId = userSockets[data.receiverId];
  if (receiverSocketId) {
    io.to(receiverSocketId).emit('typing', { senderId: data.senderId });
  }
});
socket.on('delivered', async ({ messageId, senderId }) => {
  try {
    // Update message status to delivered
    await Message.findByIdAndUpdate(messageId, { status: 'delivered' });
    // Notify the sender that this message was delivered
    const senderSocketId = userSockets[senderId];
    if (senderSocketId) {
      io.to(senderSocketId).emit('message delivered', { messageId });
    }
  } catch (err) {
    console.error('Delivered error:', err);
  }
});
socket.on('read', async ({ readerId, contactId }) => {
  try {
    // Update all messages from contactId to readerId that are not already read
    await Message.updateMany(
      { senderId: contactId, receiverId: readerId, status: { $ne: 'read' } },
      { status: 'read' }
    );

    // Notify the contact (sender) that their messages were read
    const contactSocketId = userSockets[contactId];
    if (contactSocketId) {
      io.to(contactSocketId).emit('messages read', { readerId });
    }
  } catch (err) {
    console.error('Read event error:', err);
  }
});
socket.on('stop typing', (data) => {
  const receiverSocketId = userSockets[data.receiverId];
  if (receiverSocketId) {
    io.to(receiverSocketId).emit('stop typing', { senderId: data.senderId });
  }
});

    
    socket.on('edit message', (data) => {
  // Broadcast to the other participant
  const otherId = data.senderId === socket.userId ? data.receiverId : data.senderId;
  const otherSocket = userSockets[otherId];
  if (otherSocket) {
    io.to(otherSocket).emit('message edited', data);
  }
});

socket.on('delete message', (data) => {
  const otherId = data.senderId === socket.userId ? data.receiverId : data.senderId;
  const otherSocket = userSockets[otherId];
  if (otherSocket) {
    io.to(otherSocket).emit('message deleted', data.id);
  }
});
    
    socket.on('disconnect', async () => {
   
    if(socket.userId) {
      const userId = socket.userId;
      delete userSockets[userId] 
      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, {lastSeen});
      socket.broadcast.emit("user offline", {userId, lastSeen: lastSeen.toISOString()})
    }
  });

  });
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Something went wrong!' });
}); 
 const PORT = process.env.PORT || 8080;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
