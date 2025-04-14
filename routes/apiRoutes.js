const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/authMiddleware');

// Apply API key authentication middleware to all routes
router.use(apiKeyAuth);

// @route   GET /api/v1/user
// @desc    Get user info (authenticated by API key)
router.get('/user', (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email
  });
});

// @route   GET /api/v1/quota
// @desc    Get API usage quota
router.get('/quota', (req, res) => {
  // Placeholder for quota info - to be implemented based on business requirements
  res.json({
    apiKey: req.user.apiKey,
    quota: {
      limit: 1000,
      used: 0,
      remaining: 1000
    },
    resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  });
});

module.exports = router; 