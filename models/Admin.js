const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isOwner: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null }
}, { timestamps: true });

module.exports = mongoose.model('admin', userSchema);