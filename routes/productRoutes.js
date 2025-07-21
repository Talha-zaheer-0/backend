const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Product = require('../models/productModel');
const Order = require('../models/Order');
const {
  addToCart,
  getCart,
  createOrder,
  addProductComment,
  addReplyToComment,
  getProductComments,
  likeComment,
  getOrders,
  updateOrderStatus,
  deleteOrder,
  completeOrder,
  addProduct,
  updateProduct,
  getHotProduct,
  getFeaturedProduct,
  getSaleProducts,
  addOrUpdateRating,
  getProductRating,
  removeFromCart,
  getUserOrders,
  deleteUserOrder,
  deleteProduct // Added
} = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Error handling middleware to ensure JSON responses
router.use((err, req, res, next) => {
  console.error('❌ Route Error:', err.message, err.stack);
  res.status(err.status || 500).json({ message: 'Server error', error: err.message });
});

// Setup Cloudinary
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured successfully');
} catch (err) {
  console.error('❌ Cloudinary config error:', err.message, err.stack);
}

// Setup multer with cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'products',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(file.originalname.toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: File upload only supports JPG, JPEG, PNG formats'));
  }
});

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
    console.error('❌ Admin check error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Route: GET /api/products/cart
router.get('/cart', authMiddleware, getCart);

// Route: POST /api/products/cart/add
router.post('/cart/add', authMiddleware, addToCart);

// Route: DELETE /api/products/cart/:productId
router.delete('/cart/:productId', authMiddleware, removeFromCart);

// Route: POST /api/products/order
router.post('/order', authMiddleware, createOrder);

// Route: GET /api/products/orders
router.get('/orders', authMiddleware, isAdmin, getOrders);

// Route: PATCH /api/products/orders/:orderId
router.patch('/orders/:orderId', authMiddleware, isAdmin, updateOrderStatus);

// Route: DELETE /api/products/orders/:orderId
router.delete('/orders/:orderId', authMiddleware, isAdmin, deleteOrder);

// Route: POST /api/products/orders/:orderId/complete
router.post('/orders/:orderId/complete', authMiddleware, isAdmin, completeOrder);

// Route: GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    console.error('❌ Fetch Products Error:', error.message, error.stack);
    next(error);
  }
});

// Route: GET /api/products/hot
router.get('/hot', getHotProduct);

// Route: GET /api/products/featured
router.get('/featured', getFeaturedProduct);

// Route: GET /api/products/sale
router.get('/sale', getSaleProducts);

// Route: GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error('❌ Fetch Product Error:', error.message, error.stack);
    next(error);
  }
});

// Route: POST /api/products/add
router.post('/add', authMiddleware, isAdmin, upload.array('images', 4), addProduct);

// Route: PUT /api/products/:id
router.put('/:id', authMiddleware, isAdmin, upload.array('images', 4), updateProduct);

// Route: DELETE /api/products/:id
router.delete('/:id', authMiddleware, isAdmin, deleteProduct); // Added

// Route: POST /api/products/product-comment
router.post('/product-comment', authMiddleware, upload.single('image'), addProductComment);

// Route: POST /api/products/review/reply
router.post('/review/reply', authMiddleware, upload.single('image'), addReplyToComment);

// Route: GET /api/products/comments/:productId
router.get('/comments/:productId', getProductComments);

// Route: POST /api/products/comment/:commentId/like
router.post('/comment/:commentId/like', authMiddleware, likeComment);

// Route

// Route: POST /api/products/rating
router.post('/rating', authMiddleware, addOrUpdateRating);

// Route: GET /api/products/rating/:productId
router.get('/rating/:productId', getProductRating);

// Route: GET /api/products/orders/user
router.get('/orders/user', authMiddleware, getUserOrders);

// Route: DELETE /api/products/orders/user/:orderId
router.delete('/orders/user/:orderId', authMiddleware, deleteUserOrder);

// Route: PATCH /api/products/orders/:orderId
router.patch('/orders/:orderId', authMiddleware, isAdmin, updateOrderStatus);

module.exports = router;