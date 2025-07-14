const mongoose = require('mongoose');

const tempAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verificationCode: { type: String, required: true },
  attemptCount: { type: Number, default: 1 },
  lastAttemptAt: { type: Date, default: Date.now },
  isAdmin: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
}, { timestamps: true });

module.exports = mongoose.model('TempAdmin', tempAdminSchema);