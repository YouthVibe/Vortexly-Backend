const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

// Load environment variables
dotenv.config();

// First admin user details
const adminData = {
  name: 'System Administrator',
  email: 'admin@vortexly.com',
  password: 'Admin@123456',
  role: 'superadmin',
  permissions: ['manage_users', 'manage_content', 'manage_settings', 'view_analytics']
};

const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Check if admin already exists
    const adminExists = await Admin.findOne({ email: adminData.email });
    
    if (adminExists) {
      console.log('Admin user already exists');
      process.exit();
    }
    
    // Create admin
    const admin = await Admin.create(adminData);
    
    console.log(`Admin created successfully: ${admin.email} (${admin.role})`);
    console.log('You can now log in with these credentials.');
    console.log('IMPORTANT: Change this password immediately after first login!');
    
    process.exit();
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

// Run the function
seedAdmin(); 