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
import { pushRoutes, webpush} from './routes/pushRoutes.js'
import { error } from 'console';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, 
  message: { error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true, 
  legacyHeaders: false,
});
  const app = express();
app.set('trust proxy', 1);
const allowedOrigins = ['http://localhost:3000', 'https://chitchat-chatsite.netlify.app', 'http://10.15.150.4:3000'];
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
app.use('/api/push', pushRoutes)
// Wait for DB connection, then seed and start server
connectDB().then(async () => {

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin:[
        "http://localhost:3000",
        "https://chitchat-chatsite.netlify.app",
        'http://10.15.150.4:3000'
        ],
      methods: ["GET", "POST", "PATCH", "DELETE"],
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
  });


    socket.on('chat message', async (msg) => {
  try {
    // Save the original message
    const messageDoc = new Message({
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      text: msg.text,
      edited: false,
      replyTo: msg.replyTo || null
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


 else {
  // User is offline
  
  try {
    const receiver = await User.findById(msg.receiverId);
    const sender = await User.findById(msg.senderId);
    
    ('Receiver subscription:', receiver?.pushSubscription ? 'EXISTS' : 'NULL');
    
    if (receiver?.pushSubscription) {
      await webpush.sendNotification(
        receiver.pushSubscription,
        JSON.stringify({
          title:     sender.username,
          body:      msg.text.length > 60
                       ? msg.text.slice(0, 60) + '...'
                       : msg.text,
          icon:      sender.avatar || '/icon.jpg',
          contactId: msg.senderId,
          url:       process.env.APP_URL || "ChitChat"
        })
      );
    }
  } catch (err) {
    console.error('Push failed:', err.message); // ← this will tell us exactly what went wrong
  }
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


socket.on('react message', async ({ messageId, emoji, userId, receiverId }) => {
  try {
    const message = await Message.findById(messageId);
    if (!message) return;

    const existing = message.reactions.find(
      r => r.userId.toString() === userId
    );

    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji — remove it (toggle off)
        message.reactions = message.reactions.filter(
          r => r.userId.toString() !== userId
        );
      } else {
        // Different emoji — change it
        existing.emoji = emoji;
      }
    } else {
      // No reaction yet — add it
      message.reactions.push({ emoji, userId });
    }

    await message.save();

    // Tell both users about the update
    const updated = {
      messageId,
      reactions: message.reactions
    };

    const receiverSocket = userSockets[receiverId];
    if (receiverSocket) io.to(receiverSocket).emit('reaction updated', updated);
    socket.emit('reaction updated', updated);

  } catch (err) {
    console.error('Reaction error:', err);
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
