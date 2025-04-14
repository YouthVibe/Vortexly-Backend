const express = require('express');
const router = express.Router();
const path = require('path');
const { 
  registerUser, 
  loginUser, 
  getUserProfile,
  updateUserProfile,
  verifyEmail,
  verifyPhone,
  resendVerificationEmail,
  resendPhoneVerification,
  forgotPassword,
  resetPassword,
  generateNewApiKey,
  addPhoneNumber,
  removeUser,
  updateProfileImage,
  getUserAvatar,
  getPublicUserProfile,
  getUserBasicInfo,
  updateUserProfileWithAvatar
} = require('../controllers/userController');
const { authenticate, protect, optionalAuth } = require('../middleware/auth');
const { protectAdmin, checkPermission } = require('../middleware/adminMiddleware');
const User = require('../models/User');

// Public routes
router.post('/', registerUser);
router.post('/login', loginUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes - accepts either JWT token or API key
router.get('/profile', authenticate, getUserProfile);
router.put('/profile', authenticate, updateUserProfile);
router.post('/add-phone', authenticate, addPhoneNumber);
router.post('/verify-phone', authenticate, verifyPhone);
router.post('/resend-phone-verification', authenticate, resendPhoneVerification);
router.post('/api-key', authenticate, generateNewApiKey);

// Profile image route with express-fileupload (will use the middleware from server.js)
router.put('/me/avatar', protect, updateUserProfileWithAvatar);

// Routes for /api/users/me
router.get('/me', authenticate, getUserProfile);
router.put('/me', authenticate, updateUserProfile);

// Routes with id parameters - should come after more specific routes
router.get('/:id/avatar', getUserAvatar);
router.get('/:id/public', optionalAuth, getPublicUserProfile);
router.get('/:id/basic', getUserBasicInfo);

// Admin routes
router.delete('/:id', protectAdmin, checkPermission('manage_users'), removeUser);

// Update user's push token
router.put('/push-token', authenticate, async (req, res) => {
  try {
    const { pushToken } = req.body;
    
    if (!pushToken) {
      return res.status(400).json({ message: 'Push token is required' });
    }
    
    await User.findByIdAndUpdate(req.user._id, { pushToken });
    
    res.json({ message: 'Push token updated successfully' });
  } catch (error) {
    console.error('Update push token error:', error);
    res.status(500).json({ message: 'Error updating push token' });
  }
});

module.exports = router; 