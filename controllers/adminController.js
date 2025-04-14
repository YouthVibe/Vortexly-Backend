const Admin = require('../models/Admin');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vortexly14@gmail.com",
    pass: "bbowemfjqxhothir",
  },
});

// Generate JWT Token for admin
const generateAdminToken = (id) => {
  return jwt.sign({ id, isAdmin: true }, process.env.JWT_SECRET, {
    expiresIn: '24h', // Shorter lifespan for admin tokens
  });
};

// @desc    Register a new admin (can only be done by another admin)
// @route   POST /api/admin
// @access  Private (admin only)
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    const createdById = req.admin._id; // From admin middleware

    // Check if admin with this email already exists
    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }

    // Create new admin
    const admin = await Admin.create({
      name,
      email,
      password,
      role: role || 'admin', // Default to admin if not specified
      permissions: permissions || ['manage_users'], // Default permissions
      createdBy: createdById
    });

    // Send email to new admin
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: admin.email,
      subject: 'Admin Account Created - Vortexly',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
            <div style="background-color: #f8f8f8; padding: 20px;">
              <h2 style="color: #333;">Welcome to Vortexly Admin Panel, ${admin.name}!</h2>
              <p style="color: #555;">An admin account has been created for you with the following details:</p>
              <ul style="color: #555;">
                <li>Email: ${admin.email}</li>
                <li>Role: ${admin.role}</li>
              </ul>
              <p style="color: #555;">Please login with your email and the password provided to you.</p>
              <div style="background-color: #ffe8e6; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="color: #721c24;">For security reasons, please change your password immediately after logging in for the first time.</p>
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
                <p>Vortexly - Your platform for growth and connection</p>
              </div>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);

    // Return admin info without password
    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      message: 'Admin account created successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });

    // Check if admin exists and password matches
    if (admin && (await admin.matchPassword(password))) {
      // Update last login time
      admin.lastLogin = Date.now();
      await admin.save();

      res.json({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        token: generateAdminToken(admin._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all users (paginated)
// @route   GET /api/admin/users
// @access  Private (admin only)
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get users with basic info (excluding sensitive data)
    const users = await User.find({})
      .select('_id name email phoneNumber isEmailVerified isPhoneVerified createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    // Get total count
    const total = await User.countDocuments({});
    
    res.status(200).json({
      users,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private (admin only)
const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id)
      .select('-password')
      .populate('createdBy', 'name email');
      
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    res.status(200).json(admin);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update admin profile
// @route   PUT /api/admin/profile
// @access  Private (admin only)
const updateAdminProfile = async (req, res) => {
  try {
    const { name, password } = req.body;
    const admin = await Admin.findById(req.admin._id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Update fields
    admin.name = name || admin.name;
    if (password) {
      admin.password = password;
    }
    
    const updatedAdmin = await admin.save();
    
    res.status(200).json({
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      role: updatedAdmin.role,
      permissions: updatedAdmin.permissions,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getUsers,
  getAdminProfile,
  updateAdminProfile
}; 