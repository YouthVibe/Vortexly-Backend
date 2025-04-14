const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Middleware to protect admin routes
const protectAdmin = async (req, res, next) => {
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

      // Check if it's an admin token (contains isAdmin: true)
      if (!decoded.isAdmin) {
        return res.status(403).json({ message: 'Not authorized as an admin' });
      }

      // Get admin from the token
      const admin = await Admin.findById(decoded.id).select('-password');

      if (!admin) {
        return res.status(401).json({ message: 'Not authorized, admin not found' });
      }

      req.admin = admin;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware to check specific admin permissions
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: 'Not authorized, admin not authenticated' });
    }

    // Super admins bypass permission checks
    if (req.admin.role === 'superadmin') {
      return next();
    }

    // Check if admin has the required permission
    if (!req.admin.permissions.includes(permission)) {
      return res.status(403).json({ 
        message: `Not authorized, requires ${permission} permission` 
      });
    }

    next();
  };
};

module.exports = { protectAdmin, checkPermission }; 