const mongoose = require('mongoose');

// Validate MongoDB ObjectId
const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number format (basic validation)
const validatePhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

// Validate password strength
const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  return passwordRegex.test(password);
};

module.exports = {
  validateObjectId,
  validateEmail,
  validatePhone,
  validatePassword
}; 