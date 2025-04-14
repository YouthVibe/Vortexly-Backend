const User = require('../models/User');

// API Key authentication middleware
exports.apiKeyAuth = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      console.log('No API key provided in request headers');
      return res.status(401).json({ message: 'API key required for this route' });
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

// Export middleware functions
module.exports = { apiKeyAuth }; 