const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user._id; // For likes or ownership check
    req.username = user.name; // For showing name in review
    next();
  } catch (err) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

module.exports = authMiddleware;
