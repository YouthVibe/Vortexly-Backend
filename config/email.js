const nodemailer = require('nodemailer');

const createTransporter = () => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log('Email service initialized');
  return transporter;
};

module.exports = { createTransporter }; 