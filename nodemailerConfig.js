const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Using Gmail; you can change to another service
  auth: {
    user: process.env.EMAIL_USER, // Your email address (e.g., Gmail)
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
});

module.exports = transporter;
 