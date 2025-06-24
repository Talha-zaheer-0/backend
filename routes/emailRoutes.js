const express = require('express');
const router = express.Router();
const transporter = require('../nodemailerConfig');

// Route to handle quote request from footer
router.post('/quote', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required' });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Quote Request from Forever Buy',
      text: 'Thank you for requesting a quote from Forever Buy! Our team will get back to you shortly with the details.',
      html: `<p>Thank you for requesting a quote from <b>Forever Buy</b>!</p><p>Our team will get back to you shortly with the details.</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ msg: 'Quote request sent successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Route to handle contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ msg: 'All fields are required' });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'support@foreverbuy.in', // Send to support email
      subject: `New Contact Form Submission from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `<p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Message:</b> ${message}</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ msg: 'Message sent successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;