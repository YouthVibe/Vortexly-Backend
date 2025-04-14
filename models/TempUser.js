const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const tempUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: [10, 'Username must be at least 10 characters long']
  },
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: true
  },
  dob: {
    type: Date
  },
  isAdult: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    required: true
  },
  // For compatibility with both naming conventions
  emailVerificationToken: {
    type: String
  },
  verificationExpires: Date,
  emailVerificationExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours - auto delete unverified users after 24 hours
  }
});

// Password hashing middleware
tempUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate 6-digit verification code
tempUserSchema.methods.generateVerificationCode = function() {
  // Generate a random 6-digit number
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Hash the code for storage (for security)
  this.verificationCode = crypto
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex');
  
  // Set both fields for compatibility
  this.emailVerificationToken = this.verificationCode;
    
  this.verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  this.emailVerificationExpires = this.verificationExpires;
  
  return verificationCode;
};

const TempUser = mongoose.model('TempUser', tempUserSchema);

module.exports = TempUser; 