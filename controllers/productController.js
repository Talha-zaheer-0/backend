// controllers/productController.js

const Product = require('../models/productModel');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Cloudinary config from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.createProduct = async (req, res) => {
  try {
    // Validate at least 1 image is uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one image is required." });
    }

    // Upload all images to Cloudinary
    const imageUploadPromises = req.files.map(file =>
      cloudinary.uploader.upload(file.path, { folder: 'products' })
    );

    const imageResponses = await Promise.all(imageUploadPromises);

    // Extract Cloudinary URLs
    const imageUrls = imageResponses.map(result => result.secure_url);

    // Create and save product
    const newProduct = new Product({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      subcategory: req.body.subcategory,
      price: req.body.price,
      sizes: req.body.sizes?.split(','),
      bestseller: req.body.bestseller === 'true',
      images: imageUrls,
    });

    const savedProduct = await newProduct.save();

    // Remove temp files from server
    req.files.forEach(file => fs.unlinkSync(file.path));

    res.status(201).json(savedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating product" });
  }
};
