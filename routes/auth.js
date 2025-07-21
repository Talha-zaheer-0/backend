// In auth.js
const express = require('express');
const router = express.Router();
const { signup, login, verifyEmail, getAllUsers, getUserDetails, getMe, toggleBlocksFunction, addChildAdmin, verifyChildAdmin, getChildAdmins, removeChildAdmin, sendOrderConfirmationEmail, forgotPassword, resetPassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Change this line:
router.get('/api/auth/me', authMiddleware, getMe); // Use GET and add authMiddleware
// Remove: router.post('/getMe', getMe);

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/users', authMiddleware, getAllUsers);
router.post('/toggleBlock/:id', authMiddleware, toggleBlocksFunction);
router.patch('/users/:id/toggle-block', authMiddleware, toggleBlocksFunction);
router.get('/me', authMiddleware, getUserDetails);
router.post('/admin/add-child', authMiddleware, addChildAdmin);
router.post('/admin/verify', verifyChildAdmin);
router.get('/admin/child-admins', authMiddleware, getChildAdmins);
router.delete('/admin/child-admins/:id', authMiddleware, removeChildAdmin);
router.post('/order-confirmation', authMiddleware, sendOrderConfirmationEmail);

module.exports = router;