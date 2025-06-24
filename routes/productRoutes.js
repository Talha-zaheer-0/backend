const express = require('express');
  const router = express.Router();
  const multer = require('multer');
  const { v2: cloudinary } = require('cloudinary');
  const Product = require('../models/productModel');
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  const authMiddleware = require('../middleware/authMiddleware');
  const User = require('../models/User');

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
      const user = await User.findById(req.user);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      next();
    } catch (err) {
      console.error('❌ Admin check error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };

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

  // Route: POST /api/products/add
  router.post('/add', authMiddleware, isAdmin, upload.array('images', 4), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'At least one image is required' });
      }

      const sizes = Array.isArray(req.body.sizes) ? req.body.sizes : req.body.sizes ? [req.body.sizes] : [];

      const product = new Product({
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        subcategory: req.body.subcategory,
        price: req.body.price,
        sizes: sizes,
        bestseller: req.body.bestseller === 'true',
        images: req.files.map(file => file.path),
      });

      await product.save();
      res.status(201).json({ message: 'Product uploaded', product });
    } catch (error) {
      console.error('❌ Upload Error:', error.message);
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  });


  module.exports = router;