// models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  edited: { type: Boolean, default: false },
  status: {type: String, enum: ['sent', 'delivered', 'read'], default: 'sent'},
  reactions: [{
    emoji: {type: String, required: true},
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
  }],
  replyTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null},
    text: { type: String, default: ''},
    senderId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
  }
}, { timestamps: true });
const Message = mongoose.model('Message', messageSchema);
export default Message;

