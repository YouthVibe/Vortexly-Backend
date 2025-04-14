const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - Authentication middleware
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// API Key authentication middleware
exports.apiKeyAuth = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      console.log('No API key provided in request headers');
      // Try using token-based auth instead
      return exports.protect(req, res, next);
    }
    
    console.log('API key authentication attempt');
    
    // Find user with this API key
    const user = await User.findOne({ apiKey }).select('-password');
    
    if (!user) {
      console.log('Invalid API key provided');
      return res.status(401).json({ message: 'Invalid API key' });
    }
    
    // Set user in request object
    req.user = user;
    console.log(`API key auth successful for user: ${user.name}`);
    
    next();
  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Combined authentication middleware (tries API key first, then JWT)
exports.authenticate = async (req, res, next) => {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'];
    
    if (apiKey) {
      // Try API key authentication
      const user = await User.findOne({ apiKey }).select('-password');
      
      if (user) {
        req.user = user;
        console.log(`API key auth successful for user: ${user.name}`);
        return next();
      }
    }
    
    // Fall back to JWT authentication
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Optional authentication middleware - doesn't block if auth fails
exports.optionalAuth = async (req, res, next) => {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'];
    
    if (apiKey) {
      // Try API key authentication
      const user = await User.findOne({ apiKey }).select('-password');
      
      if (user) {
        req.user = user;
        console.log(`Optional API key auth successful for user: ${user.name}`);
        return next();
      }
    }
    
    // Try JWT authentication
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from token
        req.user = await User.findById(decoded.id).select('-password');
        
        if (req.user) {
          console.log(`Optional JWT auth successful for user: ${req.user.name}`);
        }
      } catch (error) {
        // Ignore token verification errors for optional auth
        console.log('Optional auth: Invalid token, continuing without authentication');
      }
    }
    
    // Continue regardless of authentication result
    next();
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    // Continue anyway since this is optional auth
    next();
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
}; 