const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Product = require('../models/productModel');
const { addToCart, getCart, removeFromCart, clearCart, createProduct, createOrder, submitReview, likeReview, getReviews, updateProduct, getOrders, updateOrderStatus, deleteOrder } = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Setup Cloudinary
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured successfully');
} catch (err) {
  console.error('❌ Cloudinary config error:', err.message);
}

// Setup multer with cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'products',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});

const upload = multer({ storage });

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    let user = await User.findById(req.user);
    if (!user) {
      user = await Admin.findById(req.user);
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('❌ Admin check error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Route: GET /api/products/cart
router.get('/cart', authMiddleware, getCart);

// Route: POST /api/products/cart/add
router.post('/cart/add', authMiddleware, addToCart);

// Route: POST /api/products/cart/remove
router.post('/cart/remove', authMiddleware, removeFromCart);

// Route: POST /api/products/cart/clear
router.post('/cart/clear', authMiddleware, clearCart);

// Route: GET /api/products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    console.error('❌ Fetch Products Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Route: POST /api/products/add
router.post('/add', authMiddleware, isAdmin, upload.array('images', 4), createProduct);

// Route: PUT /api/products/:id
router.put('/:id', authMiddleware, isAdmin, upload.array('images', 4), updateProduct);

// Route: DELETE /api/products/:id
router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Delete Product Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Route: POST /api/products/order
router.post('/order', authMiddleware, createOrder);

// Route: GET /api/products/orders
router.get('/orders', authMiddleware, isAdmin, getOrders);

// Route: PATCH /api/products/orders/:orderId
router.patch('/orders/:orderId', authMiddleware, isAdmin, updateOrderStatus);

// Route: DELETE /api/products/orders/:orderId
router.delete('/orders/:orderId', authMiddleware, isAdmin, deleteOrder);

// Route: GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error('❌ Fetch Product Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Route: POST /api/products/review
router.post('/review', authMiddleware, submitReview);

// Route: POST /api/products/reviews/:reviewId/like
router.post('/reviews/:reviewId/like', authMiddleware, likeReview);

// Route: GET /api/products/reviews/:productId
router.get('/reviews/:productId', getReviews);

module.exports = router;