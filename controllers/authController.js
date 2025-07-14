const User = require('../models/User');
const TempUser = require('../models/TempUser');
const TempAdmin = require('../models/TempAdmin');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const transporter = require('../nodemailerConfig');

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email, isAdmin: false });
    if (!user) return res.status(400).json({ msg: "Email not found or user is an admin" });

    const maxAttempts = 3;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const tempUser = await TempUser.findOne({ email });

    if (tempUser) {
      const timeSinceLastAttempt = Date.now() - new Date(tempUser.lastAttemptAt).getTime();
      if (tempUser.attemptCount >= maxAttempts && timeSinceLastAttempt < oneDayMs) {
        const remainingSeconds = Math.ceil((oneDayMs - timeSinceLastAttempt) / 1000);
        const remainingHours = Math.floor(remainingSeconds / 3600);
        const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
        return res.status(429).json({
          msg: `Too many attempts. Please wait ${remainingHours} hour${remainingHours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} before trying again.`,
        });
      }

      tempUser.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      tempUser.attemptCount = (tempUser.attemptCount || 1) + 1;
      tempUser.lastAttemptAt = Date.now();
      await tempUser.save();
    } else {
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      await TempUser.create({
        name: user.name,
        email,
        password: user.password,
        verificationCode,
        attemptCount: 1,
        lastAttemptAt: Date.now(),
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Verification Code',
      text: `Your password reset verification code is: ${tempUser ? tempUser.verificationCode : verificationCode} (Attempt ${tempUser ? tempUser.attemptCount : 1} of 3)`,
      html: `<p>Your password reset verification code is: <b>${tempUser ? tempUser.verificationCode : verificationCode}</b></p><p>Attempt ${tempUser ? tempUser.attemptCount : 1} of 3. Please enter this code to reset your password.</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({
      msg: `Verification code sent to ${email} (Attempt ${tempUser ? tempUser.attemptCount : 1} of 3)`,
      tempUserId: tempUser ? tempUser._id : null,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const tempUser = await TempUser.findOne({ email, verificationCode: code });
    if (!tempUser) return res.status(400).json({ msg: "Invalid or expired verification code" });

    const user = await User.findOne({ email, isAdmin: false });
    if (!user) return res.status(400).json({ msg: "User not found or is an admin" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await TempUser.deleteOne({ _id: tempUser._id });

    res.status(200).json({ msg: "Password reset successfully" });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

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
    console.error('Signup error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
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
    console.error('Verify email error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!Admin) {
      console.error("Admin model is undefined");
      return res.status(500).json({ msg: "Server error: Admin model not loaded" });
    }

    let user = await User.findOne({ email });
    let isAdmin = false;
    let isOwner = false;
    let entity = 'user';

    if (!user) {
      console.log("Checking Admin collection for email:", email);
      user = await Admin.findOne({ email });
      if (user) {
        isAdmin = true;
        isOwner = user.isOwner || false;
        entity = 'admin';
        console.log("Admin found:", user.email, "isOwner:", isOwner);
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

    const token = jwt.sign({ id: user._id, isAdmin, isOwner }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, isAdmin, isOwner }
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
      user = await Admin.findById(req.user).select('name email isAdmin isOwner');
      entity = 'admin';
    }
    if (!user) return res.status(404).json({ msg: `${entity} not found` });
    res.json({ user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin, isOwner: user.isOwner || false } });
  } catch (err) {
    console.error('Get user details error:', err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isAdmin: false });
    res.status(200).json({ users });
  } catch (err) {
    console.error('Get all users error:', err);
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
    console.error('Toggle block error:', err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addChildAdmin = async (req, res) => {
  try {
    const { name, email } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ msg: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const owner = await Admin.findById(decoded.id);
    if (!owner || !owner.isOwner) return res.status(403).json({ msg: 'Only owner admins can add child admins' });

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) return res.status(400).json({ msg: 'Email already registered as admin' });

    const childAdminCount = await Admin.countDocuments({ createdBy: owner._id });
    if (childAdminCount >= 3) return res.status(403).json({ msg: 'Child admin limit reached (maximum 3)' });

    const rawPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tempAdmin = await TempAdmin.create({
      name,
      email,
      password: hashedPassword,
      verificationCode,
      attemptCount: 1,
      lastAttemptAt: Date.now(),
      isAdmin: true,
      createdBy: owner._id,
    });

    const verificationLink = `http://localhost:5173/admin/verify?tempAdminId=${tempAdmin._id}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Forever Buy Child Admin Account',
      text: `You have been added as a child admin for Forever Buy. Your temporary password is: ${rawPassword}\nPlease verify your account using this code: ${verificationCode}\nOr click here to verify: ${verificationLink}`,
      html: `<p>You have been added as a child admin for <b>Forever Buy</b>.</p><p>Your temporary password is: <b>${rawPassword}</b></p><p>Please verify your account using this code: <b>${verificationCode}</b></p><p>Or click <a href="${verificationLink}">here</a> to verify.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      msg: `Child admin created. Verification code and password sent to ${email}`,
      tempAdminId: tempAdmin._id,
    });
  } catch (err) {
    console.error('Add child admin error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.verifyChildAdmin = async (req, res) => {
  try {
    const { tempAdminId, code } = req.body;
    const tempAdmin = await TempAdmin.findById(tempAdminId);
    if (!tempAdmin || !tempAdmin.isAdmin) return res.status(400).json({ msg: 'Invalid or expired admin signup request' });

    if (tempAdmin.verificationCode !== code) return res.status(400).json({ msg: 'Invalid verification code' });

    const admin = await Admin.create({
      name: tempAdmin.name,
      email: tempAdmin.email,
      password: tempAdmin.password,
      isAdmin: true,
      isOwner: false,
      isVerified: true,
      createdBy: tempAdmin.createdBy,
    });

    await TempAdmin.deleteOne({ _id: tempAdminId });

    res.status(200).json({ msg: 'Child admin account verified successfully', admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('Verify child admin error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getChildAdmins = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ msg: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const owner = await Admin.findById(decoded.id);
    if (!owner || !owner.isOwner) return res.status(403).json({ msg: 'Only owner admins can view child admins' });

    const childAdmins = await Admin.find({ createdBy: owner._id, isAdmin: true, isOwner: false }).select('name email isVerified');
    res.status(200).json({ childAdmins });
  } catch (err) {
    console.error('Get child admins error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.removeChildAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ msg: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const owner = await Admin.findById(decoded.id);
    if (!owner || !owner.isOwner) return res.status(403).json({ msg: 'Only owner admins can remove child admins' });

    const childAdmin = await Admin.findOne({ _id: id, createdBy: owner._id, isAdmin: true, isOwner: false });
    if (!childAdmin) return res.status(404).json({ msg: 'Child admin not found or not authorized to remove' });

    await Admin.deleteOne({ _id: id });

    res.status(200).json({ msg: 'Child admin removed successfully' });
  } catch (err) {
    console.error('Remove child admin error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.sendOrderConfirmationEmail = async (req, res) => {
  try {
    const { userName, userEmail, deliveryAddress, phone, items, total } = req.body;

    // Validate required fields
    if (!userName || !userEmail || !items || !total) {
      return res.status(400).json({ msg: 'Missing required order details' });
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ msg: 'Items must be a non-empty array' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.productName || !item.quantity || isNaN(item.price) || isNaN(item.subtotal)) {
        return res.status(400).json({ msg: 'Invalid item data: missing or invalid productName, quantity, price, or subtotal' });
      }
    }

    // Log the email payload for debugging
    console.log('Order confirmation email payload:', {
      userName,
      userEmail,
      deliveryAddress,
      phone,
      items,
      total
    });

    // Generate HTML for items
    const itemsHtml = items.map(item => {
      const price = parseFloat(item.price);
      const subtotal = parseFloat(item.subtotal);
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.productName || 'Unknown Product'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${isNaN(price) ? '0.00' : price.toFixed(2)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${isNaN(subtotal) ? '0.00' : subtotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const mailOptions = {
      from: process.env.EMAIL_USER || 'default-email@example.com',
      to: userEmail,
      subject: 'Your Order Confirmation from Forever Buy',
      text: `Dear ${userName},\n\nThank you for your order! We have received your order and, InshAllah, it will be delivered to you soon.\n\nOrder Details:\n${items.map(item => `- ${item.productName}: ${item.quantity} x $${isNaN(item.price) ? '0.00' : parseFloat(item.price).toFixed(2)} = $${isNaN(item.subtotal) ? '0.00' : parseFloat(item.subtotal).toFixed(2)}`).join('\n')}\n\nTotal: $${isNaN(total) ? '0.00' : parseFloat(total).toFixed(2)}\nDelivery Address: ${deliveryAddress}\nPhone: ${phone}\n\nWe will notify you once your order is shipped.\n\nBest regards,\nForever Buy Team`,
      html: `
        <h2>Order Confirmation</h2>
        <p>Dear ${userName},</p>
        <p>Thank you for your order! We have received your order and, <b>InshAllah</b>, it will be delivered to you soon.</p>
        <h3>Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Quantity</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Price</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <p><b>Total:</b> $${isNaN(total) ? '0.00' : parseFloat(total).toFixed(2)}</p>
        <p><b>Delivery Address:</b> ${deliveryAddress}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p>We will notify you once your order is shipped.</p>
        <p>Best regards,<br>Forever Buy Team</p>
      `,
    };

    // Log before sending email
    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent successfully to:', userEmail);
    res.status(200).json({ msg: 'Order confirmation email sent successfully' });
  } catch (err) {
    console.error('Error sending order confirmation email:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      response: err.response?.data
    });
    res.status(500).json({ msg: 'Failed to send order confirmation email', error: err.message });
  }
};  

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if email exists and is not an admin
    const user = await User.findOne({ email, isAdmin: false });
    if (!user) {
      return res.status(400).json({ msg: "Email not found or user is an admin" });
    }

    // Check for existing TempUser and enforce 3 attempts per day
    const maxAttempts = 3;
    const oneDayMs = 24 * 60 * 60 * 1000;
    let tempUser = await TempUser.findOne({ email });

    if (tempUser) {
      const timeSinceLastAttempt = Date.now() - new Date(tempUser.lastAttemptAt).getTime();
      if (tempUser.attemptCount >= maxAttempts && timeSinceLastAttempt < oneDayMs) {
        const remainingSeconds = Math.ceil((oneDayMs - timeSinceLastAttempt) / 1000);
        const remainingHours = Math.floor(remainingSeconds / 3600);
        const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
        return res.status(429).json({
          msg: `Too many attempts. Please wait ${remainingHours} hour${remainingHours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} before trying again.`,
        });
      }
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update or create TempUser
    if (tempUser) {
      tempUser.verificationCode = verificationCode;
      tempUser.attemptCount = (tempUser.attemptCount || 1) + 1;
      tempUser.lastAttemptAt = Date.now();
      await tempUser.save();
    } else {
      tempUser = await TempUser.create({
        name: user.name,
        email,
        password: user.password, // Store existing hashed password
        verificationCode,
        attemptCount: 1,
        lastAttemptAt: Date.now(),
      });
    }

    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Verification Code - Forever Buy',
      text: `Your password reset verification code is: ${verificationCode} (Attempt ${tempUser.attemptCount} of 3)`,
      html: `<p>Your password reset verification code is: <b>${verificationCode}</b></p><p>Attempt ${tempUser.attemptCount} of 3. Please enter this code to reset your password.</p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Verification code sent to ${email}`);

    res.status(200).json({
      msg: `Verification code sent to ${email} (Attempt ${tempUser.attemptCount} of 3)`,
      tempUserId: tempUser._id,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    // Validate inputs
    if (!email || !code || !newPassword) {
      return res.status(400).json({ msg: 'Email, verification code, and new password are required' });
    }

    // Find TempUser with matching email and code
    const tempUser = await TempUser.findOne({ email, verificationCode: code });
    if (!tempUser) {
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    // Find user (non-admin)
    const user = await User.findOne({ email, isAdmin: false });
    if (!user) {
      return res.status(400).json({ msg: 'User not found or is an admin' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Delete TempUser record
    await TempUser.deleteOne({ _id: tempUser._id });

    res.status(200).json({ msg: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};