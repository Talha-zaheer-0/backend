const User = require('../models/User');
const TempUser = require('../models/TempUser');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const transporter = require('../nodemailerConfig');

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already registered" });

    let tempUser = await TempUser.findOne({ email });
    if (tempUser) {
      const maxAttempts = 3;
      const cooldownMinutes = 10;
      const cooldownMs = cooldownMinutes * 60 * 1000;
      const timeSinceLastAttempt = Date.now() - new Date(tempUser.lastAttemptAt).getTime();

      if (tempUser.attemptCount >= maxAttempts && timeSinceLastAttempt < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastAttempt) / 1000);
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        return res.status(429).json({
          msg: `Too many attempts. Please wait ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''} before trying again.`,
        });
      }

      tempUser.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      tempUser.attemptCount = (tempUser.attemptCount || 1) + 1;
      tempUser.lastAttemptAt = Date.now();
      await tempUser.save();
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      tempUser = await TempUser.create({
        name,
        email,
        password: hashedPassword,
        verificationCode,
        attemptCount: 1,
        lastAttemptAt: Date.now(),
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Forever Buy Account',
      text: `Your verification code is: ${tempUser.verificationCode} (Attempt ${tempUser.attemptCount} of 3)`,
      html: `<p>Your verification code is: <b>${tempUser.verificationCode}</b></p><p>Attempt ${tempUser.attemptCount} of 3. Please enter this code to complete your signup.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      msg: `Verification code sent to ${email} (Attempt ${tempUser.attemptCount} of 3)`,
      tempUserId: tempUser._id,
    });
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

    // Log to check if Admin model is loaded
    if (!Admin) {
      console.error("Admin model is undefined");
      return res.status(500).json({ msg: "Server error: Admin model not loaded" });
    }

    // Check User collection first
    let user = await User.findOne({ email });
    let isAdmin = false;
    let entity = 'user';

    if (!user) {
      // Check Admin collection
      console.log("Checking Admin collection for email:", email);
      user = await Admin.findOne({ email });
      if (user) {
        isAdmin = true;
        entity = 'admin';
        console.log("Admin found:", user.email);
      }
    }

    if (!user) {
      console.log("No user or admin found for email:", email);
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    if (!user.isVerified) {
      console.log(`${entity} not verified:`, user.email);
      return res.status(400).json({ msg: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for", entity, ":", user.email);
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    if (user.isBlocked) {
      console.log(`${entity} is blocked:`, user.email);
      return res.status(403).json({ msg: `Your ${entity} account is blocked` });
    }

    const token = jwt.sign({ id: user._id, isAdmin }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, isAdmin }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    let user = await User.findById(req.user).select('name email isAdmin');
    let entity = 'user';
    if (!user) {
      user = await Admin.findById(req.user).select('name email isAdmin');
      entity = 'admin';
    }
    if (!user) return res.status(404).json({ msg: `${entity} not found` });
    res.json({ user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isAdmin: false });
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.toggleBlocksFunction = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'}`, userId: user._id, isBlocked: user.isBlocked });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};