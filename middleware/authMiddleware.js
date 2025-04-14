const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT token protection middleware
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if the token is an admin token (we don't want user-level endpoints accessed with admin tokens)
      if (decoded.isAdmin) {
        return res.status(403).json({ message: 'Please use admin routes with admin tokens' });
      }

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      next();
    } catch (error) {
      console.error('JWT Validation Error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Optional authentication middleware - doesn't require auth but sets user if present
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Just log the error but continue without setting req.user
      console.log('Optional auth failed:', error.message);
    }
  }
  
  // Also try API key auth if no user set yet
  if (!req.user && req.headers['x-api-key']) {
    try {
      const apiKey = req.headers['x-api-key'];
      const user = await User.findOne({ apiKey });
      if (user) {
        req.user = user;
      }
    } catch (error) {
      console.log('Optional API key auth failed:', error.message);
    }
  }
  
  // Continue regardless of whether authentication succeeded
  next();
};

// API key authentication middleware
const apiKeyAuth = async (req, res, next) => {
  // Try to get API key from different possible locations
  const apiKey = req.headers['x-api-key'] || 
                (req.headers.authorization && req.headers.authorization.startsWith('Bearer') ? 
                  req.headers.authorization.split(' ')[1] : null);

  if (!apiKey) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    // First try to validate as JWT token
    try {
      const decoded = jwt.verify(apiKey, process.env.JWT_SECRET);
      // If it's a valid JWT, get the user
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Set user in request
      req.user = user;
      return next();
    } catch (jwtError) {
      // Not a valid JWT, try as API key
      const user = await User.findOne({ apiKey });

      if (!user) {
        return res.status(401).json({ message: 'Invalid authentication' });
      }

      if (!user.isEmailVerified) {
        return res.status(401).json({ message: 'Email not verified' });
      }

      // Set user in request
      req.user = user;
      next();
    }
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin, apiKeyAuth, optionalAuth }; 