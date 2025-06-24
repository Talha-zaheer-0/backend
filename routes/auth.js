const express = require('express');
const router = express.Router();
const { signup, login, verifyEmail, getUserDetails } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify', verifyEmail);
router.get('/me', authMiddleware, getUserDetails);

module.exports = router;