const User = require('../models/User');
const TempUser = require('../models/TempUser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const transporter = require('../nodemailerConfig');

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    const existingTempUser = await TempUser.findOne({ email });
    if (existingUser || existingTempUser) return res.status(400).json({ msg: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tempUser = await TempUser.create({ name, email, password: hashedPassword, verificationCode });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Forever Buy Account',
      text: `Your verification code is: ${verificationCode}`,
      html: `<p>Your verification code is: <b>${verificationCode}</b></p><p>Please enter this code to complete your signup.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ msg: "Please verify your email to complete signup", tempUserId: tempUser._id });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { tempUserId, code } = req.body;
    const tempUser = await TempUser.findById(tempUserId);
    if (!tempUser) return res.status(400).json({ msg: "Invalid or expired signup request" });

    if (tempUser.verificationCode !== code) return res.status(400).json({ msg: "Invalid verification code" });

    const user = await User.create({
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password,
      isAdmin: false,
      isVerified: true,
    });

    await TempUser.deleteOne({ _id: tempUserId });

    res.status(200).json({ msg: "Account created successfully", user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });
    if (!user.isVerified) return res.status(400).json({ msg: "Please verify your email first" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user).select('name email isAdmin');
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};