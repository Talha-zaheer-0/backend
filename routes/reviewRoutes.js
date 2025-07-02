const express = require('express');
const router = express.Router();
const Review = require('../models/reviewModel');
const auth = require('../middleware/authMiddleware');

// Get reviews for a product
router.get('/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId }).populate('userId', 'username');

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server error getting reviews' });
  }
});

// Post a new review (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { productId, comment } = req.body;
    const newReview = new Review({
  productId,
  comment,
  user: req.user, // if you renamed from userId
});
    await newReview.save();
    res.status(201).json(newReview);
  } catch (err) {
    res.status(400).json({ message: 'Error saving review' });
  }
});

// Like a review
router.post('/like/:id', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (review.likes.includes(req.user)) {
      return res.status(400).json({ message: 'Already liked' });
    }

    review.likes.push(req.user);
    await review.save();
    res.status(200).json({ message: 'Review liked' });
  } catch (err) {
    res.status(500).json({ message: 'Server error liking review' });
  }
});

module.exports = router;
