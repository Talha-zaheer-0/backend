require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' })); // Adjust to your frontend URL

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Routes
// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/email', require('./routes/emailRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/comments', require('./routes/reviewRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes')); // ✅ Add this line


// MongoDB connection
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/myapp';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected successfully');

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ DB Connection Error:', err.message);
});