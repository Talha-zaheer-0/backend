const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  subcategory: { type: String },
  price: { type: Number, required: true },
  sizes: [{ type: String }],
  bestseller: { type: Boolean, default: false },
  images: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);

