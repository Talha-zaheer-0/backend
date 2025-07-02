const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  subcategory: { type: String },
  price: { type: Number, required: true },
  discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
  sizes: [{ type: String }],
  bestseller: { type: Boolean, default: false },
  images: [{ type: String }],
  salesCount: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);