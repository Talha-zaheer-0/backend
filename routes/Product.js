const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/auth'); // Assumed middleware for authentication

router.post('/order', authMiddleware, productController.createOrder);
router.get('/:id', productController.getProductById);
router.get('/reviews/:productId', productController.getReviews);

module.exports = router;