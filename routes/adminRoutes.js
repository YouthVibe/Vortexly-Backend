const express = require('express');
const router = express.Router();
const { 
  registerAdmin,
  loginAdmin,
  getUsers,
  getAdminProfile,
  updateAdminProfile
} = require('../controllers/adminController');
const { protectAdmin, checkPermission } = require('../middleware/adminMiddleware');

// Public routes
router.post('/login', loginAdmin);

// Protected admin routes
router.post('/', protectAdmin, checkPermission('manage_users'), registerAdmin);
router.get('/users', protectAdmin, checkPermission('manage_users'), getUsers);
router.get('/profile', protectAdmin, getAdminProfile);
router.put('/profile', protectAdmin, updateAdminProfile);

module.exports = router; 