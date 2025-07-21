const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
  message: { type: String, required: true },
  senderType: { type: String, enum: ['user', 'admin'], required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);