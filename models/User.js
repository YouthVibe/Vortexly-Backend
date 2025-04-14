const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: [10, 'Username must be at least 10 characters long']
  },
  fullName: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    default: ''
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
  avatar: {
    type: String,
    default: ''
  },
  dob: {
    type: Date
  },
  isAdult: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  profileImageId: {
    type: String
  },
  lastNameChange: {
    type: Date,
    default: null
  },
  lastFullNameChange: {
    type: Date,
    default: null
  },
  // Online status tracking
  isOnline: {
    type: Boolean,
    default: false
  },
  lastOnline: {
    type: Date,
    default: Date.now
  },
  // Presence data for messaging
  lastSeen: {
    type: Date,
    default: Date.now
  },
  currentlyActiveConversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    default: null
  },
  // Privacy settings
  showOnlineStatus: {
    type: Boolean,
    default: true
  },
  showReadReceipts: {
    type: Boolean,
    default: true
  },
  // For message pagination tracking
  lastConversationPage: {
    type: Map,
    of: Number,
    default: {}
  },
  followers: {
    type: Number,
    default: 0
  },
  following: {
    type: Number,
    default: 0
  },
  posts: {
    type: Number,
    default: 0
  },
  reels: {
    type: Number,
    default: 0
  },
  activeStories: {
    type: Number,
    default: 0
  },
  followersRef: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followingRef: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tag: {
    type: String,
    default: null
  },
  bookmarkedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  unreadNotifications: {
    type: Number,
    default: 0,
    min: 0
  },
  // Unread messages count across all conversations
  unreadMessages: {
    type: Number,
    default: 0,
    min: 0
  },
  pushToken: {
    type: String,
    default: null
  },
  // Add conversations array to store conversation IDs the user is part of
  conversations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  }]
}, {
  timestamps: true,
  collection: 'users'
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
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

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate email verification code
userSchema.methods.generateVerificationCode = function() {
  // Generate a random 6-digit number
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Hash the code for storage (for security)
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex');
    
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationCode;
};

// Generate reset password token
userSchema.methods.generateResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  
  return resetToken;
};

// Generate API key
userSchema.methods.generateApiKey = function() {
  const apiKey = `yv_${crypto.randomBytes(28).toString('hex')}`;
  this.apiKey = apiKey;
  return apiKey;
};

// Method to check if user can change their name
userSchema.methods.canChangeName = function() {
  return true; // Always allow name changes
};

// Method to check if user can change their full name
userSchema.methods.canChangeFullName = function() {
  return true; // Always allow full name changes
};

const User = mongoose.model('User', userSchema);

module.exports = User; 