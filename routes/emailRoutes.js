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
      to: 'support@foreverbuy.in',
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

// Route to handle order confirmation email
router.post('/order-confirmation', async (req, res) => {
  try {
    const { userName, userEmail, deliveryAddress, phone, items, total } = req.body;
    if (!userName || !userEmail || !items || !total) {
      return res.status(400).json({ msg: 'Missing required order details' });
    }

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.productName || 'Unknown Product'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">$${item.price.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">$${item.subtotal.toFixed(2)}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Your Order Confirmation from Forever Buy',
      text: `Dear ${userName},\n\nThank you for your order! We have received your order and, InshAllah, it will be delivered to you soon.\n\nOrder Details:\n${items.map(item => `- ${item.productName}: ${item.quantity} x $${item.price.toFixed(2)} = $${item.subtotal.toFixed(2)}`).join('\n')}\n\nTotal: $${total.toFixed(2)}\nDelivery Address: ${deliveryAddress}\nPhone: ${phone}\n\nWe will notify you once your order is shipped.\n\nBest regards,\nForever Buy Team`,
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
        <p><b>Total:</b> $${total.toFixed(2)}</p>
        <p><b>Delivery Address:</b> ${deliveryAddress}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p>We will notify you once your order is shipped.</p>
        <p>Best regards,<br>Forever Buy Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ msg: 'Order confirmation email sent successfully' });
  } catch (err) {
    console.error('Error sending order confirmation email:', err);
    res.status(500).json({ msg: 'Failed to send order confirmation email', error: err.message });
  }
});

module.exports = router;