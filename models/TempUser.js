const mongoose = require('mongoose');

const tempUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verificationCode: { type: String, required: true },
  attemptCount: { type: Number, default: 1 }, // Track number of email attempts
  lastAttemptAt: { type: Date, default: Date.now }, // Timestamp of last attempt
  createdAt: { type: Date, default: Date.now, expires: '1h' }, // Auto-delete after 1 hour
});

module.exports = mongoose.model('TempUser', tempUserSchema);