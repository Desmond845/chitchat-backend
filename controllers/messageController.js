// controllers/messageController.js
import Message from '../models/Message.js';
// Get all messages, grouped by contactId
export const getAllMessages = async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: 1 });
    const grouped = {};
    messages.forEach(msg => {
      const cid = msg.contactId;
      if (!grouped[cid]) grouped[cid] = [];
      grouped[cid].push({
        id: msg._id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp,
        fulltimestamp: msg.fulltimestamp,
        contactId: msg.contactId,
        edited: msg.edited,
        createdAt: msg.createdAt.toISOString()
      });
    });
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Save a new message (used by socket)
export const saveMessage = async (msg) => {
  try {
    const messageDoc = new Message({
      contactId: msg.contactId,
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.timestamp,
      fulltimestamp: msg.fulltimestamp
    });
    const saved = await messageDoc.save();
    return saved; // returns the saved doc with _id
  } catch (err) {
    console.error('Failed to save message:', err);
    throw err;
  }
};

// Seed initial messages if the collection is empty
export const seedMessages = async () => {
  // await Message.deleteMany({})

  return "butt";
  const count = await Message.countDocuments();
  if (count === 0) {
    //     const initialMessages = 
    // // In seed script or manually add:
    // {
    //   id: 7, // special ID
    //   username: 'ChitChat Official',
    //   email: 'official@chitchat.com',
    //   password: bcrypt.hashSync('some-secure-password', 10),
    //   bio: 'Official announcements and updates',
    //   avatar: '/official-avatar.png'
    // }
    // Flatten the object into an array of messages
    const messagesToInsert = [];
    Object.entries(initialMessages).forEach(([contactId, msgs]) => {
      msgs.forEach(msg => {
        messagesToInsert.push({
          contactId: parseInt(contactId),
          text: msg.text,
          sender: msg.sender,
          timestamp: msg.timestamp,
          fulltimestamp: msg.fulltimestamp
        });
      });
    });
    await Message.insertMany(messagesToInsert);
    console.log('🌱 Seeded initial messages');
  }
};
// controllers/messageController.js
export const deleteMesage = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Message.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// controllers/messageController.js
export const updateMesage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const edited = true;
    // const createdAt = 
    if (!text.trim().length >= 1) {
      return res.status(404).json({ error: 'Empty Message' });
    }
    const updated = await Message.findByIdAndUpdate(
      id,
      { text, edited },
      // { edited }, 
      { returnDocument: 'after' } // return the updated document
    );

    if (!updated) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({
      id: updated._id,
      text: updated.text,
      sender: updated.sender,
      timestamp: updated.timestamp,
      fulltimestamp: updated.fulltimestamp,
      contactId: updated.contactId,
      edited: updated.edited,
      createdAt: updated.createdAt.toISOString()
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getUserMessages = async (req, res) => {
  try {
    const userId = req.userId; // from auth middleware
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    }).sort({ createdAt: 1 });

    // Group by other participant
    const conversations = {};
    messages.forEach(msg => {
      const otherId = msg.senderId.toString() === userId ? msg.receiverId.toString() : msg.senderId.toString();
      if (!conversations[otherId]) conversations[otherId] = [];
      conversations[otherId].push({
        id: msg._id,
        text: msg.text,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        edited: msg.edited,
        createdAt: msg.createdAt.toISOString(),
        status: msg.status,
        reactions: msg.reactions || [],
        replyTo: msg.replyTo || null
      });
    });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};






// ... existing functions ...

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Allow delete if user is sender OR receiver
    const isSender = message.senderId.toString() === userId;
    const isReceiver = message.receiverId.toString() === userId;
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    if (!text?.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Only sender can edit
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    message.text = text;
    message.edited = true;
    await message.save();

    res.json({
      id: message._id,
      text: message.text,
      senderId: message.senderId,
      receiverId: message.receiverId,
      edited: message.edited,
      createdAt: message.createdAt.toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};