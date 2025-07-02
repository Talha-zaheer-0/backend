const Product = require('../models/productModel');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Review = require('../models/Review');
const User = require('../models/User');
const Admin = require('../models/Admin');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.createProduct = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one image is required." });
    }

    const imageUploadPromises = req.files.map(file =>
      cloudinary.uploader.upload(file.path, { folder: 'products' })
    );

    const imageResponses = await Promise.all(imageUploadPromises);
    const imageUrls = imageResponses.map(result => result.secure_url);

    const sizes = Array.isArray(req.body.sizes) ? req.body.sizes : (req.body.sizes ? [req.body.sizes] : []);

    const newProduct = new Product({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      subcategory: req.body.subcategory,
      price: req.body.price,
      discountPercentage: req.body.discountPercentage || 0,
      sizes: sizes,
      bestseller: req.body.bestseller === 'true',
      images: imageUrls,
      salesCount: 0,
      reviewCount: 0
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('❌ Create Product Error:', error.message);
    res.status(500).json({ message: "Error creating product", error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let imageUrls = Array.isArray(req.body.existingImages) ? req.body.existingImages : (req.body.existingImages ? [req.body.existingImages] : product.images);
    if (req.files && req.files.length > 0) {
      const imageUploadPromises = req.files.map(file =>
        cloudinary.uploader.upload(file.path, { folder: 'products' })
      );
      const imageResponses = await Promise.all(imageUploadPromises);
      imageUrls = imageResponses.map(result => result.secure_url);
    }

    const sizes = Array.isArray(req.body.sizes) ? req.body.sizes : (req.body.sizes ? [req.body.sizes] : product.sizes);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name || product.name,
        description: req.body.description || product.description,
        category: req.body.category || product.category,
        subcategory: req.body.subcategory || product.subcategory,
        price: req.body.price || product.price,
        discountPercentage: req.body.discountPercentage || product.discountPercentage,
        sizes: sizes,
        bestseller: req.body.bestseller === 'true' || product.bestseller,
        images: imageUrls,
      },
      { new: true }
    );

    res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('❌ Update Product Error:', error.message);
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += parseInt(quantity);
    } else {
      cart.items.push({ productId, quantity: parseInt(quantity) });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.productId');
    res.status(200).json({ message: 'Product added to cart', cart: populatedCart });
  } catch (error) {
    console.error('❌ Add to Cart Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      return res.status(200).json({ cart: { items: [] } });
    }
    res.status(200).json({ cart });
  } catch (error) {
    console.error('❌ Get Cart Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    cart.updatedAt = Date.now();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.productId');
    res.status(200).json({ message: 'Product removed from cart', cart: populatedCart });
  } catch (error) {
    console.error('❌ Remove from Cart Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.user;
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.status(200).json({ message: 'Cart cleared', cart });
  } catch (error) {
    console.error('❌ Clear Cart Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { userName, deliveryAddress, phone } = req.body;
    const userId = req.user;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const totalAmount = cart.items.reduce((total, item) => {
      const price = item.productId.price * (1 - (item.productId.discountPercentage / 100));
      return total + price * item.quantity;
    }, 0);

    const order = new Order({
      orderId: uuidv4(),
      userId,
      userName,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.price * (1 - (item.productId.discountPercentage / 100))
      })),
      totalAmount,
      deliveryAddress,
      phone
    });

    await Promise.all(cart.items.map(async (item) => {
      await Product.findByIdAndUpdate(item.productId._id, { $inc: { salesCount: item.quantity } });
    }));

    await order.save();
    await Cart.findOneAndUpdate({ userId }, { items: [], updatedAt: Date.now() });

    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    console.error('❌ Create Order Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('items.productId').lean();
    if (!orders || orders.length === 0) {
      return res.status(200).json({ orders: [], message: 'No orders found' });
    }
    res.status(200).json({ orders });
  } catch (error) {
    console.error('❌ Fetch Orders Error:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Processing', 'Shipped', 'Delivered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('items.productId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    order.status = status;
    await order.save();
    res.status(200).json({ message: `Order ${req.params.orderId} updated to ${status}`, order });
  } catch (error) {
    console.error('❌ Update Order Status Error:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    await Order.deleteOne({ orderId: req.params.orderId });
    res.status(200).json({ message: `Order ${req.params.orderId} deleted successfully` });
  } catch (error) {
    console.error('❌ Delete Order Error:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user;

    let user = await User.findById(userId);
    if (!user) {
      user = await Admin.findById(userId);
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    const review = new Review({
      productId,
      userId,
      username: user.name,
      rating,
      comment
    });

    await review.save();
    await Product.findByIdAndUpdate(productId, { $inc: { reviewCount: 1 } });

    res.status(201).json({ message: 'Review submitted', review });
  } catch (error) {
    console.error('❌ Submit Review Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.likeReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const likeIndex = review.likes.indexOf(userId);
    if (likeIndex === -1) {
      review.likes.push(userId);
    } else {
      review.likes.splice(likeIndex, 1);
    }

    await review.save();
    res.status(200).json(review);
  } catch (error) {
    console.error('❌ Like Review Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (error) {
    console.error('❌ Get Reviews Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};