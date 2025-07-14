const mongoose = require('mongoose');

const productCommentSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, required: true },
    text: { type: String, required: true },
    image: { type: String }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ProductComment', productCommentSchema);