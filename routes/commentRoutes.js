const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');

// Get comments for a product
router.get('/comments/:productId', async (req, res) => {
  try {
    const comments = await Comment.find({ productId: req.params.productId });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching comments', error: err.message });
  }
});

// Add product comment
router.post('/product-comment', async (req, res) => {
  try {
    const { productId, text, image } = req.body;
    const comment = new Comment({
      productId,
      userId: req.user._id,
      username: req.user.name,
      text,
      image,
    });
    await comment.save();
    const io = req.app.get('io');
    io.emit('commentUpdate', { productId, comment }); // Emit comment update
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: 'Error adding comment', error: err.message });
  }
});

// Add reply to comment
router.post('/review/reply', async (req, res) => {
  try {
    const { commentId, reply, image } = req.body;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    const replyData = {
      userId: req.user._id,
      username: req.user.name,
      text: reply,
      image,
    };
    comment.replies.push(replyData);
    await comment.save();
    const io = req.app.get('io');
    io.emit('commentUpdate', { productId: comment.productId, comment }); // Emit comment update
    res.json(replyData);
  } catch (err) {
    res.status(500).json({ message: 'Error adding reply', error: err.message });
  }
});

// Like comment
router.post('/comment/:commentId/like', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    const userId = req.user._id.toString();
    const index = comment.likes.indexOf(userId);
    if (index === -1) {
      comment.likes.push(userId);
    } else {
      comment.likes.splice(index, 1);
    }
    await comment.save();
    const io = req.app.get('io');
    io.emit('commentUpdate', { productId: comment.productId, comment }); // Emit comment update
    res.json({ likes: comment.likes });
  } catch (err) {
    res.status(500).json({ message: 'Error toggling like', error: err.message });
  }
});

// Rate product
router.post('/rating', async (req, res) => {
  try {
    const { productId, rating } = req.body;
    const userId = req.user._id;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const existingRating = product.ratings.find(r => r.userId.toString() === userId.toString());
    if (existingRating) {
      existingRating.rating = rating;
    } else {
      product.ratings.push({ userId, rating });
    }
    product.averageRating = product.ratings.reduce((sum, r) => sum + r.rating, 0) / product.ratings.length;
    product.reviewCount = product.ratings.length;
    await product.save();
    const io = req.app.get('io');
    io.emit('ratingUpdate', { productId, averageRating: product.averageRating, reviewCount: product.reviewCount }); // Emit rating update
    res.json({ message: 'Rating submitted', averageRating: product.averageRating, reviewCount: product.reviewCount });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting rating', error: err.message });
  }
});

// Get user rating
router.get('/rating/:productId', async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const userRating = product.ratings.find(r => r.userId.toString() === req.user._id.toString())?.rating || null;
    res.json({ userRating, averageRating: product.averageRating, reviewCount: product.ratings.length });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching rating', error: err.message });
  }
});

module.exports = router;