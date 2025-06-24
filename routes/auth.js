const express = require('express');
const router = express.Router();
const { signup, login,getAllUsers,toggleBlocksFunction} = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);
router.get('/getAllUsers',getAllUsers);
router.post('/toggleBlock/:id',toggleBlocksFunction)

module.exports = router;
