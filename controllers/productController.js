const Product = require('../models/productModel');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const ProductComment = require('../models/ProductComment');
const Review = require('../models/Review');
const User = require('../models/User');
const Admin = require('../models/Admin');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');

// Cloudinary config
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured successfully');
} catch (err) {
  console.error('❌ Cloudinary config error:', err.message, err.stack);
  throw new Error('Cloudinary configuration failed');
}

exports.addProduct = async (req, res) => {
  try {
    const { name, category, subcategory, price } = req.body;
    if (!name || !category || !subcategory || !price) {
      return res.status(400).json({ message: 'Name, category, subcategory, and price are required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    const imageUploadPromises = req.files.map(file =>
      cloudinary.uploader.upload(file.path, { folder: 'products' })
    );
    const imageResponses = await Promise.all(imageUploadPromises).catch(err => {
      console.error('❌ Cloudinary upload error:', err.message, err.stack);
      throw new Error(`Cloudinary upload failed: ${err.message}`);
    });
    const imageUrls = imageResponses.map(result => result.secure_url);

    const sizes = Array.isArray(req.body.sizes) ? req.body.sizes : (req.body.sizes ? [req.body.sizes] : []);

    const newProduct = new Product({
      name,
      description: req.body.description || '',
      category,
      subcategory,
      price: parseFloat(price) || 0,
      discountPercentage: parseFloat(req.body.discountPercentage) || 0,
      sizes,
      bestseller: req.body.bestseller === 'true' || req.body.bestseller === true,
      images: imageUrls,
      salesCount: 0,
      reviewCount: 0
    });

    const savedProduct = await newProduct.save();
    try {
      req.io.to('admin').emit('productAdded', savedProduct);
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (productAdded):', emitError.message);
    }
    res.status(201).json({ message: 'Product added successfully', product: savedProduct });
  } catch (error) {
    console.error('❌ Add Product Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      subcategory,
      price,
      discountPercentage,
      sizes,
      bestseller,
      existingImages
    } = req.body;

    console.log('Update Product Request:', {
      id,
      body: { name, description, category, subcategory, price, discountPercentage, sizes, bestseller, existingImages },
      files: req.files ? req.files.map(f => f.originalname) : [],
    });

    if (!name || !category || !subcategory || !price) {
      return res.status(400).json({ message: 'Name, category, subcategory, and price are required' });
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let imageUrls = Array.isArray(existingImages)
      ? existingImages
      : typeof existingImages === 'string'
      ? [existingImages]
      : [];

    const imagesToDelete = product.images.filter(url => !imageUrls.includes(url));
    if (imagesToDelete.length > 0) {
      const deletePromises = imagesToDelete.map(url => {
        const publicId = url.split('/').pop().split('.')[0];
        return cloudinary.uploader.destroy(`products/${publicId}`).catch(err => {
          console.error(`❌ Failed to delete image ${publicId} from Cloudinary:`, err.message);
        });
      });
      await Promise.all(deletePromises);
      console.log('Deleted images from Cloudinary:', imagesToDelete);
    }

    if (req.files && req.files.length > 0) {
      const imageUploadPromises = req.files.map(file =>
        cloudinary.uploader.upload(file.path, { folder: 'products' })
      );
      const imageResponses = await Promise.all(imageUploadPromises).catch(err => {
        console.error('❌ Cloudinary upload error:', err.message, err.stack);
        throw new Error(`Cloudinary upload failed: ${err.message}`);
      });
      imageUrls = [...imageUrls, ...imageResponses.map(result => result.secure_url)];
    }

    if (imageUrls.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        description: description || '',
        category,
        subcategory,
        price: parseFloat(price) || 0,
        discountPercentage: parseFloat(discountPercentage) || 0,
        sizes: Array.isArray(sizes) ? sizes : sizes ? [sizes] : [],
        bestseller: bestseller === 'true' || bestseller === true,
        images: imageUrls,
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product update failed' });
    }

    try {
      req.io.to('admin').emit('productUpdated', updatedProduct);
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (productUpdated):', emitError.message);
    }
    console.log('Updated product images:', updatedProduct.images);
    res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('❌ Update Product Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const deleteImagePromises = product.images.map(url => {
      const publicId = url.split('/').pop().split('.')[0];
      return cloudinary.uploader.destroy(`products/${publicId}`).catch(err => {
        console.error(`❌ Failed to delete image ${publicId} from Cloudinary:`, err.message);
      });
    });
    await Promise.all(deleteImagePromises);

    await ProductComment.deleteMany({ productId: id });
    await Review.deleteMany({ productId: id });

    await Product.findByIdAndDelete(id);

    try {
      req.io.to('admin').emit('productDeleted', { id });
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (productDeleted):', emitError.message);
    }
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Delete Product Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getHotProduct = async (req, res) => {
  try {
    const hotProducts = await Product.find()
      .sort({ salesCount: -1 })
      .limit(15);
    if (!hotProducts || hotProducts.length === 0) {
      return res.status(404).json({ message: 'No products found' });
    }
    res.status(200).json(hotProducts);
  } catch (error) {
    console.error('❌ Fetch Hot Products Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getFeaturedProduct = async (req, res) => {
  try {
    const featuredProducts = await Product.find()
      .sort({ reviewCount: -1 })
      .limit(15);
    if (!featuredProducts || featuredProducts.length === 0) {
      return res.status(404).json({ message: 'No products found' });
    }
    res.status(200).json(featuredProducts);
  } catch (error) {
    console.error('❌ Fetch Featured Products Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getSaleProducts = async (req, res) => {
  try {
    const saleProducts = await Product.find({ discountPercentage: { $gt: 0 } })
      .sort({ discountPercentage: -1 })
      .limit(20);
    if (!saleProducts || saleProducts.length === 0) {
      return res.status(404).json({ message: 'No sale products found' });
    }
    res.status(200).json(saleProducts);
  } catch (error) {
    console.error('❌ Fetch Sale Products Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
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
      cart.items[itemIndex].quantity = quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.productId');

    try {
      req.io.to(userId.toString()).emit('cartUpdate', populatedCart);
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (cartUpdate):', emitError.message);
    }

    res.status(200).json({ message: 'Cart updated successfully', cart: populatedCart });
  } catch (error) {
    console.error('❌ Add to Cart Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    cart.updatedAt = Date.now();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.productId');

    try {
      req.io.to(userId.toString()).emit('cartUpdate', populatedCart);
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (cartUpdate):', emitError.message);
    }

    res.status(200).json({ message: 'Product removed from cart', cart: populatedCart });
  } catch (error) {
    console.error('❌ Remove from Cart Error:', error.message, error.stack);
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
    console.error('❌ Get Cart Error:', error.message, error.stack);
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

    try {
      req.io.to(userId.toString()).emit('orderUpdate', order);
      req.io.to(userId.toString()).emit('cartUpdate', { items: [] });
      req.io.to('admin').emit('adminOrderUpdate', order);
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (orderUpdate/adminOrderUpdate):', emitError.message);
    }

    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    console.error('❌ Create Order Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: { $ne: 'Delivered' } })
      .populate('items.productId')
      .sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    console.error('❌ Fetch Orders Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingId } = req.body;
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('userId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const updateData = { status };
    if (status === 'Shipped' && trackingId) {
      updateData.trackingId = trackingId;
    }
    if (status === 'Delivered') {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      updateData,
      { new: true }
    ).populate('userId');

    try {
      req.io.to(updatedOrder.userId._id.toString()).emit('orderUpdate', updatedOrder);
      req.io.to('admin').emit('adminOrderUpdate', updatedOrder);
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (orderUpdate/adminOrderUpdate):', emitError.message);
    }

    if (status === 'Shipped' && trackingId) {
      const itemsHtml = order.items.map(item => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.productId?.name || 'Unknown Product'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${item.price.toFixed(2)}</td>
        </tr>
      `).join('');

      const shipMailOptions = {
        from: process.env.EMAIL_USER,
        to: updatedOrder.userId.email,
        subject: 'Your Forever Buy Order Has Shipped!',
        text: `Dear ${updatedOrder.userName},\n\nYour order has been shipped with tracking ID: ${trackingId}.\n\nOrder Details:\n${order.items.map(item => `- ${item.productId?.name || 'Unknown Product'}: ${item.quantity} x $${item.price.toFixed(2)}`).join('\n')}\n\nTotal: $${updatedOrder.totalAmount.toFixed(2)}\nDelivery Address: ${updatedOrder.deliveryAddress}\nPhone: ${updatedOrder.phone}\n\nTrack your order using the provided tracking ID.\n\nBest regards,\nForever Buy Team`,
        html: `
          <h2>Your Order Has Shipped!</h2>
          <p>Dear ${updatedOrder.userName},</p>
          <p>Your order has been shipped with <b>Tracking ID: ${trackingId}</b>.</p>
          <h3>Order Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Quantity</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <p><b>Total:</b> $${updatedOrder.totalAmount.toFixed(2)}</p>
          <p><b>Delivery Address:</b> ${updatedOrder.deliveryAddress}</p>
          <p><b>Phone:</b> ${updatedOrder.phone}</p>
          <p>Track your order using the provided tracking ID.</p>
          <p>Best regards,<br>Forever Buy Team</p>
        `,
      };

      await transporter.sendMail(shipMailOptions);
    }

    if (status === 'Delivered') {
      const itemsHtml = order.items.map(item => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.productId?.name || 'Unknown Product'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${item.price.toFixed(2)}</td>
        </tr>
      `).join('');

      const deliverMailOptions = {
        from: process.env.EMAIL_USER,
        to: updatedOrder.userId.email,
        subject: 'Your Forever Buy Order Has Been Delivered!',
        text: `Dear ${updatedOrder.userName},\n\nThank you for shopping with Forever Buy! Your order has been delivered.\n\nTracking ID: ${updatedOrder.trackingId || 'N/A'}\n\nOrder Details:\n${order.items.map(item => `- ${item.productId?.name || 'Unknown Product'}: ${item.quantity} x $${item.price.toFixed(2)}`).join('\n')}\n\nTotal: $${updatedOrder.totalAmount.toFixed(2)}\nDelivery Address: ${updatedOrder.deliveryAddress}\nPhone: ${updatedOrder.phone}\n\nWe hope you enjoy your purchase!\n\nBest regards,\nForever Buy Team`,
        html: `
          <h2>Your Order Has Been Delivered!</h2>
          <p>Dear ${updatedOrder.userName},</p>
          <p>Thank you for shopping with <b>Forever Buy</b>! Your order has been delivered.</p>
          <p><b>Tracking ID:</b> ${updatedOrder.trackingId || 'N/A'}</p>
          <h3>Order Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Quantity</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <p><b>Total:</b> $${updatedOrder.totalAmount.toFixed(2)}</p>
          <p><b>Delivery Address:</b> ${updatedOrder.deliveryAddress}</p>
          <p><b>Phone:</b> ${updatedOrder.phone}</p>
          <p>We hope you enjoy your purchase!</p>
          <p>Best regards,<br>Forever Buy Team</p>
        `,
      };

      await transporter.sendMail(deliverMailOptions);
    }

    res.status(200).json({ message: 'Order status updated', order: updatedOrder });
  } catch (error) {
    console.error('❌ Update Order Status Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    try {
      req.io.to(order.userId.toString()).emit('orderUpdate', null);
      req.io.to('admin').emit('adminOrderUpdate', { orderId: req.params.orderId, deleted: true });
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (orderUpdate/adminOrderUpdate):', emitError.message);
    }
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('❌ Delete Order Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Delivered') {
      return res.status(400).json({ message: 'Order must be in Delivered status to complete' });
    }
    await Order.findOneAndDelete({ orderId: req.params.orderId });
    try {
      req.io.to(order.userId.toString()).emit('orderUpdate', null);
      req.io.to('admin').emit('adminOrderUpdate', { orderId: req.params.orderId, deleted: true });
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (orderUpdate/adminOrderUpdate):', emitError.message);
    }
    res.status(200).json({ message: 'Order completed and deleted successfully' });
  } catch (error) {
    console.error('❌ Complete Order Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addProductComment = async (req, res) => {
  try {
    const { productId, text } = req.body;
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

    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'product-comments' }).catch(err => {
        console.error('❌ Cloudinary upload error:', err.message, err.stack);
        throw new Error(`Cloudinary upload failed: ${err.message}`);
      });
      imageUrl = result.secure_url;
    }

    const newComment = new ProductComment({
      productId,
      userId: userId.toString(), // Store as string
      username: user.name,
      text,
      image: imageUrl,
      likes: [], // Initialize empty likes array
    });
    await newComment.save();
    await Product.findByIdAndUpdate(productId, { $inc: { reviewCount: 1 } });

    try {
      req.io.to('admin').emit('productCommentAdded', newComment);
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (productCommentAdded):', emitError.message);
    }

    res.status(201).json(newComment);
  } catch (error) {
    console.error('❌ Add Product Comment Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addReplyToComment = async (req, res) => {
  try {
    const { commentId, reply } = req.body;
    const userId = req.user;

    let user = await User.findById(userId);
    if (!user) {
      user = await Admin.findById(userId);
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const comment = await ProductComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'replies' }).catch(err => {
        console.error('❌ Cloudinary upload error:', err.message, err.stack);
        throw new Error(`Cloudinary upload failed: ${err.message}`);
      });
      imageUrl = result.secure_url;
    }

    const newReply = {
      userId: userId.toString(), // Store as string
      username: user.name,
      text: reply,
      image: imageUrl
    };
    comment.replies = comment.replies || [];
    comment.replies.push(newReply);
    await comment.save();

    try {
      req.io.to('admin').emit('commentReplyAdded', { commentId, reply: newReply });
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (commentReplyAdded):', emitError.message);
    }

    res.status(201).json(newReply);
  } catch (error) {
    console.error('❌ Add Reply Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProductComments = async (req, res) => {
  try {
    const { productId } = req.params;
    const comments = await ProductComment.find({ productId }).sort({ createdAt: -1 });
    // Sanitize likes array to ensure strings and remove null values
    const sanitizedComments = comments.map(comment => ({
      ...comment._doc,
      userId: comment.userId.toString(), // Convert userId to string
      likes: Array.isArray(comment.likes) ? comment.likes.filter(id => id != null).map(id => id.toString()) : [],
    }));
    console.log(`getProductComments: Fetched comments for product ${productId}:`, sanitizedComments);
    res.status(200).json(sanitizedComments);
  } catch (error) {
    console.error('❌ Get Product Comments Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addOrUpdateRating = async (req, res) => {
  try {
    const { productId, rating } = req.body;
    const userId = req.user;

    if (!productId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Product ID and rating (1-5) are required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let user = await User.findById(userId);
    if (!user) {
      user = await Admin.findById(userId);
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let existingReview = await Review.findOne({ productId, userId });
    let isNewRating = false;

    if (existingReview) {
      existingReview.rating = rating;
      await existingReview.save();
    } else {
      const newReview = new Review({
        productId,
        userId: userId.toString(), // Store as string
        username: user.name,
        rating,
      });
      await newReview.save();
      isNewRating = true;
    }

    if (isNewRating) {
      await Product.findByIdAndUpdate(productId, { $inc: { reviewCount: 1 } });
    }

    const reviews = await Review.find({ productId });
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    await Product.findByIdAndUpdate(productId, { averageRating });

    try {
      req.io.to('admin').emit('productRatingUpdated', { productId, averageRating, reviewCount: reviews.length });
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (productRatingUpdated):', emitError.message);
    }

    res.status(200).json({ message: isNewRating ? 'Rating added successfully' : 'Rating updated successfully', rating });
  } catch (error) {
    console.error('❌ Add/Update Rating Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProductRating = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId });
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    const userRating = req.user ? await Review.findOne({ productId, userId: req.user }) : null;

    res.status(200).json({
      averageRating: averageRating.toFixed(1),
      reviewCount: reviews.length,
      userRating: userRating ? userRating.rating : null,
    });
  } catch (error) {
    console.error('❌ Get Product Rating Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const reviews = await Review.find({ productId: req.params.id });
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    res.status(200).json({ ...product._doc, averageRating: averageRating.toFixed(1) });
  } catch (error) {
    console.error('❌ Fetch Product Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.toString(); // Convert ObjectId to string

    console.log(`likeComment: Toggling like for comment ${commentId} by user ${userId}`);

    const comment = await ProductComment.findById(commentId);
    if (!comment) {
      console.log('likeComment: Comment not found');
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Initialize and sanitize likes array
    comment.likes = Array.isArray(comment.likes) ? comment.likes.filter(id => id != null).map(id => id.toString()) : [];

    // Toggle like
    const index = comment.likes.indexOf(userId);
    if (index === -1) {
      comment.likes.push(userId);
      console.log(`likeComment: Added like for user ${userId}`);
    } else {
      comment.likes.splice(index, 1);
      console.log(`likeComment: Removed like for user ${userId}`);
    }

    // Deduplicate likes array
    comment.likes = [...new Set(comment.likes)];

    await comment.save();
    try {
      req.io.to('admin').emit('commentLikeToggled', { commentId, likes: comment.likes });
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (commentLikeToggled):', emitError.message);
    }
    console.log(`likeComment: Updated likes:`, comment.likes);
    res.status(200).json({ likes: comment.likes });
  } catch (error) {
    console.error('❌ likeComment Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user;
    const orders = await Order.find({ userId })
      .populate('items.productId')
      .sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    console.error('❌ Fetch User Orders Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteUserOrder = async (req, res) => {
  try {
    const userId = req.user;
    const order = await Order.findOne({ orderId: req.params.orderId, userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or you are not authorized to delete this order' });
    }
    if (order.status !== 'Delivered') {
      return res.status(400).json({ message: 'Only Delivered orders can be deleted' });
    }
    await Order.findOneAndDelete({ orderId: req.params.orderId, userId });
    try {
      req.io.to(userId.toString()).emit('orderUpdate', null);
      req.io.to('admin').emit('adminOrderUpdate', { orderId: req.params.orderId, deleted: true });
    } catch (emitError) {
      console.error('❌ Socket.IO Emission Error (orderUpdate/adminOrderUpdate):', emitError.message);
    }
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('❌ Delete User Order Error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const transporter = require('../nodemailerConfig');