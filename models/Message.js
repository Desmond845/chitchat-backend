// models/Message.js
import mongoose from 'mongoose';

// const messageSchema = new mongoose.Schema({
//   contactId: { type: Number, required: true },
//   text: { type: String, required: true },
//   sender: { type: String, enum: ['me', 'them'], required: true },
//   // timestamp: { type: String, required: true },
//   // fulltimestamp: { type: String },
//   edited: {type: Boolean, default: false}
// }, { timestamps: true }); // automatically adds createdAt and updatedAt
const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  edited: { type: Boolean, default: false },
  status: {type: String, enum: ['sent', 'delivered', 'read'], default: 'sent'}
}, { timestamps: true });
const Message = mongoose.model('Message', messageSchema);
export default Message;

