const User = require('../models/User');
const TempUser = require('../models/TempUser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

// Create a transporter directly like in k.js
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vortexly14@gmail.com",
    pass: "bbowemfjqxhothir",
  },
});

// Initialize Twilio client with direct values
const accountSid = 'ACbf709742dfc1b678d37ed5eeda18e0fa';
const authToken = 'c082d40b30cb38648d696216ed460847';
const twilioClient = require('twilio')(accountSid, authToken);
const twilioVerifyServiceSid = 'VAf009a2e2338efbb8a77c40f7dd1b59ab';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Password validation function
const validatePassword = (password) => {
  // Password must be at least 8 characters, contain at least 2 numbers and 1 special character
  const passwordRegex = /^(?=.*[0-9].*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;
  return passwordRegex.test(password);
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, fullName, bio, dob } = req.body;

    // Validation
    if (!name || !email || !password || !fullName) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Validate name length
    if (name.length < 10) {
      return res.status(400).json({ message: 'Username must be at least 10 characters long' });
    }

    // Validate password
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long, contain at least 2 numbers, and 1 special character.' 
      });
    }

    // Validate age if DOB is provided
    let isAdult = false;
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        return res.status(400).json({ message: 'You must be at least 18 years old to use this app' });
      }
      
      isAdult = true;
    }

    // Check if permanent user exists with this email
    const permanentUser = await User.findOne({ email });
    if (permanentUser) {
      return res.status(400).json({ message: 'Email already registered. Please login instead.' });
    }

    // Check if there's a pending verification for this email
    let tempUser = await TempUser.findOne({ email });
    
    if (tempUser) {
      // Update existing temp user info
      tempUser.name = name;
      tempUser.fullName = fullName;
      tempUser.password = password;
      
      // Update DOB and isAdult if provided
      if (dob) {
        tempUser.dob = new Date(dob);
        tempUser.isAdult = isAdult;
      }
      
      // Generate new verification code
      const verificationCode = tempUser.generateVerificationCode();
      
      await tempUser.save();
      
      // Send verification email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: tempUser.email,
        subject: 'Email Verification - Vortexly',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
              <div style="background-color: #f8f8f8; padding: 20px;">
                <h2 style="color: #333;">Hello ${tempUser.fullName},</h2>
                <p style="color: #555;">Please use the verification code below to verify your email address:</p>
                <div style="background-color: #e9f7ef; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; text-align: center;">
                  <p style="color: #155724; font-size: 24px; font-weight: bold; letter-spacing: 5px;">${verificationCode}</p>
                </div>
                <p style="color: #555;">This code will expire in 24 hours.</p>
                <p style="color: #555; margin-top: 20px;">If you did not create an account, please ignore this email.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
                  <p>Vortexly - Your platform for growth and connection</p>
                </div>
              </div>
            </body>
          </html>
        `
      };
      
      await transporter.sendMail(mailOptions);
      
      return res.status(201).json({ 
        message: 'Registration successful. Please check your email for verification code.', 
        email
      });
    } else {
      // Create new temporary user
      tempUser = new TempUser({
        name,
        fullName,
        email,
        password,
        dob: dob ? new Date(dob) : undefined,
        isAdult
      });
      
      // Generate verification code
      const verificationCode = tempUser.generateVerificationCode();
      
      await tempUser.save();
      
      // Send verification email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification - Vortexly',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
              <div style="background-color: #f8f8f8; padding: 20px;">
                <h2 style="color: #333;">Hello ${fullName},</h2>
                <p style="color: #555;">Please use the verification code below to verify your email address:</p>
                <div style="background-color: #e9f7ef; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; text-align: center;">
                  <p style="color: #155724; font-size: 24px; font-weight: bold; letter-spacing: 5px;">${verificationCode}</p>
                </div>
                <p style="color: #555;">This code will expire in 24 hours.</p>
                <p style="color: #555; margin-top: 20px;">If you did not create an account, please ignore this email.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
                  <p>Vortexly - Your platform for growth and connection</p>
                </div>
              </div>
            </body>
          </html>
        `
      };
      
      await transporter.sendMail(mailOptions);
      
      res.status(201).json({ message: 'Registration successful. Please check your email for verification code.', email });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify email with code
// @route   POST /api/users/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: 'Please provide email and verification code' });
    }
    
    console.log(`Email verification attempt for: ${email}`);
    
    // First check if code was sent to a permanent user who needs to verify email
    const user = await User.findOne({ email });
    
    if (user) {
      if (user.isEmailVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }
      
      // Hash the provided code and compare
      const hashedCode = crypto
        .createHash('sha256')
        .update(code)
        .digest('hex');
        
      if (hashedCode !== user.emailVerificationToken) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }
      
      if (Date.now() > user.emailVerificationExpires) {
        return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
      }
      
      // Verification successful - update user
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      
      // Generate API key if not already present
      if (!user.apiKey) {
        user.apiKey = user.generateApiKey();
      }
      
      await user.save();
      
      // Generate a JWT token
      const token = generateToken(user._id);
      
      console.log(`Email verification successful for user: ${user.name}`);
      
      return res.json({
        message: 'Email verified successfully',
        user: {
          _id: user._id,
          name: user.name,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          apiKey: user.apiKey,
          dob: user.dob,
          isAdult: user.isAdult,
          lastNameChange: user.lastNameChange,
          lastFullNameChange: user.lastFullNameChange,
          bio: user.bio || '',
          profileImage: user.profileImage || '',
          followers: user.followers || 0,
          following: user.following || 0,
          tag: user.tag
        },
        token
      });
    }
    
    // If not a permanent user, check temp users
    const tempUser = await TempUser.findOne({ email });
    
    if (!tempUser) {
      return res.status(404).json({ message: 'Account not found. Please register first.' });
    }
    
    // Hash the provided code and compare
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
      
    if (hashedCode !== tempUser.verificationCode) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    if (Date.now() > tempUser.verificationExpires) {
      return res.status(400).json({ message: 'Verification code has expired. Please register again.' });
    }
    
    // Create permanent user account with the already hashed password
    const newUser = {
      name: tempUser.name,
      fullName: tempUser.fullName,
      email: tempUser.email,
      password: tempUser.password, // Already hashed from TempUser
      isEmailVerified: true,
      bio: '',
      avatar: '',
      profileImage: '',
      dob: tempUser.dob,
      isAdult: tempUser.isAdult,
      isPhoneVerified: false,
      lastNameChange: null,
      lastFullNameChange: null,
      apiKey: `yv_${crypto.randomBytes(28).toString('hex')}`,
      followers: 0,
      following: 0,
      tag: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert directly into the database to bypass middleware
    const insertedUser = await User.collection.insertOne(newUser);
    
    // Get the inserted user for the response
    const createdUser = await User.findById(insertedUser.insertedId);
    
    // Delete the temp user
    await TempUser.findByIdAndDelete(tempUser._id);
    
    // Generate a JWT token
    const token = generateToken(createdUser._id);
    
    console.log(`New account created and verified for: ${email}`);
    
    res.status(201).json({
      message: 'Account created and email verified successfully',
      user: {
        _id: createdUser._id,
        name: createdUser.name,
        fullName: createdUser.fullName,
        email: createdUser.email,
        isEmailVerified: createdUser.isEmailVerified,
        apiKey: createdUser.apiKey,
        dob: createdUser.dob,
        isAdult: createdUser.isAdult,
        lastNameChange: createdUser.lastNameChange,
        lastFullNameChange: createdUser.lastFullNameChange,
        bio: createdUser.bio,
        profileImage: createdUser.profileImage,
        followers: createdUser.followers,
        following: createdUser.following,
        tag: createdUser.tag
      },
      token
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify phone number
// @route   POST /api/users/verify-phone
// @access  Private (API key)
const verifyPhone = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    // Make sure we have a user from the API key middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isPhoneVerified) {
      return res.status(400).json({ message: 'Phone number already verified' });
    }

    if (!user.phoneNumber) {
      return res.status(400).json({ message: 'No phone number associated with this account' });
    }

    // Verify the code with Twilio
    const verification = await twilioClient.verify.v2
      .services(twilioVerifyServiceSid)
      .verificationChecks
      .create({ to: user.phoneNumber, code });

    if (verification.status === 'approved') {
      user.isPhoneVerified = true;
      await user.save();

      return res.json({
        _id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        bio: user.bio,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        apiKey: user.apiKey,
        message: 'Phone number verified successfully'
      });
    } else {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Forgot password
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate verification code (similar to email verification)
    const verificationCode = user.generateVerificationCode();
    
    // Save the verification code as a password reset token
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(verificationCode)
      .digest('hex');
      
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    
    await user.save();

    // Send email with verification code
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Code - Vortexly',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
            <div style="background-color: #f8f8f8; padding: 20px;">
              <h2 style="color: #333;">Hello ${user.name},</h2>
              <p style="color: #555;">We received a request to reset your password. Please use the verification code below to reset your password:</p>
              <div style="background-color: #e9f7ef; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; text-align: center;">
                <p style="color: #155724; font-size: 24px; font-weight: bold; letter-spacing: 5px;">${verificationCode}</p>
              </div>
              <p style="color: #555;">This code will expire in 1 hour.</p>
              <p style="color: #555; margin-top: 20px;">If you did not request a password reset, please ignore this email.</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
                <p>Vortexly - Your platform for growth and connection</p>
              </div>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      message: 'Password reset code sent to your email',
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Reset password
// @route   POST /api/users/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body;

    // Validate inputs
    if (!email || !code || !password) {
      return res.status(400).json({ message: 'Email, verification code and new password are required' });
    }

    // Validate new password
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long, contain at least 2 numbers, and 1 special character.' 
      });
    }

    // Hash the code
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Find the user by email and verification code
    const user = await User.findOne({
      email,
      resetPasswordToken: hashedCode,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Successful - Vortexly',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
            <div style="background-color: #f8f8f8; padding: 20px;">
              <h2 style="color: #333;">Hello ${user.name},</h2>
              <p style="color: #555;">Your password has been successfully reset.</p>
              <div style="background-color: #fdf5eb; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="color: #721c24;">If you did not make this change, please contact our support team immediately.</p>
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

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Resend phone verification code
// @route   POST /api/users/resend-phone-verification
// @access  Private
const resendPhoneVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.phoneNumber) {
      return res.status(400).json({ message: 'No phone number associated with this account' });
    }
    
    if (user.isPhoneVerified) {
      return res.status(400).json({ message: 'Phone number is already verified' });
    }
    
    // Resend verification code
    await twilioClient.verify.v2
      .services(twilioVerifyServiceSid)
      .verifications
      .create({ to: user.phoneNumber, channel: 'sms' });
    
    res.status(200).json({ 
      message: 'Verification code resent to your phone number',
      phoneNumber: user.phoneNumber 
    });
  } catch (error) {
    console.error('Resend phone verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Resend verification email
// @route   POST /api/users/resend-verification
// @access  Public
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check for temporary user
    const tempUser = await TempUser.findOne({ email });
    
    // Check for permanent user that's not verified
    const permanentUser = await User.findOne({ email, isEmailVerified: false });

    if (!tempUser && !permanentUser) {
      return res.status(404).json({ message: 'No unverified user found with this email' });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const expiryTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Update user record with new code
    if (tempUser) {
      tempUser.emailVerificationToken = hashedCode;
      tempUser.emailVerificationExpires = expiryTime;
      await tempUser.save();
    } else {
      permanentUser.emailVerificationToken = hashedCode;
      permanentUser.emailVerificationExpires = expiryTime;
      await permanentUser.save();
    }

    // Send verification email
    const targetUser = tempUser || permanentUser;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification - Vortexly',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
            <div style="background-color: #f8f8f8; padding: 20px;">
              <h2 style="color: #333;">Hello ${targetUser.fullName}!</h2>
              <p style="color: #555;">Please use the verification code below to verify your email address:</p>
              <div style="background-color: #e9f7ef; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; text-align: center;">
                <p style="color: #155724; font-size: 24px; font-weight: bold; letter-spacing: 5px;">${verificationCode}</p>
              </div>
              <p style="color: #555;">This code will expire in 24 hours.</p>
              <p style="color: #555; margin-top: 20px;">If you did not request this verification, please ignore this email.</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
                <p>Vortexly - Your platform for growth and connection</p>
              </div>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Verification email resent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    console.log(`Login attempt for identifier: ${identifier}`);

    // Find user by email or username
    const user = await User.findOne({ 
      $or: [
        { email: identifier },
        { name: identifier }
      ]
    });

    // Check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
      // Generate API key if one doesn't exist
      if (!user.apiKey) {
        user.apiKey = user.generateApiKey();
        await user.save();
      }

      // Generate JWT token
      const token = generateToken(user._id);

      console.log(`Login successful for user: ${user.name}`);

      // Return user data with token
      res.json({
        user: {
          _id: user._id,
          name: user.name,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          bio: user.bio,
          isAdmin: user.isAdmin,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          dob: user.dob,
          isAdult: user.isAdult,
          profileImage: user.profileImage,
          apiKey: user.apiKey,
          lastNameChange: user.lastNameChange,
          lastFullNameChange: user.lastFullNameChange,
          followers: user.followers || 0,
          following: user.following || 0,
          tag: user.tag
        },
        token
      });
    } else {
      console.log(`Login failed for identifier: ${identifier}`);
      res.status(401).json({ message: 'Invalid username/email or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate new API key
// @route   POST /api/users/api-key
// @access  Private (API key)
const generateNewApiKey = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new API key
    user.apiKey = crypto.randomBytes(32).toString('hex');
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      fullName: user.fullName,
      email: user.email,
      apiKey: user.apiKey,
      message: 'New API key generated successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private (JWT or API key)
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        bio: user.bio,
        profileImage: user.profileImage,
        dob: user.dob,
        isAdult: user.isAdult,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        apiKey: user.apiKey,
        followers: user.followers,
        following: user.following,
        tag: user.tag,
        posts: 0, // We'll need to implement this when we add posts functionality
        createdAt: user.createdAt
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private (API key)
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if username is being changed
    if (req.body.name && req.body.name !== user.name) {
      // Validate name length
      if (req.body.name.length < 10) {
        return res.status(400).json({ message: 'Username must be at least 10 characters long' });
      }
      
      // Update the name 
      user.name = req.body.name;
      // Still record change date for tracking purposes
      user.lastNameChange = new Date();
    }
    
    // Check if full name is being changed
    if (req.body.fullName && req.body.fullName !== user.fullName) {
      // Update the full name
      user.fullName = req.body.fullName;
      // Still record change date for tracking purposes
      user.lastFullNameChange = new Date();
    }

    // Validate age if DOB is provided
    if (req.body.dob) {
      const birthDate = new Date(req.body.dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        return res.status(400).json({ message: 'You must be at least 18 years old to use this app' });
      }
      
      user.dob = birthDate;
      user.isAdult = true;
    }

    // Update bio if provided (no restrictions)
    if (req.body.bio !== undefined) {
      user.bio = req.body.bio;
    }
    
    // Update isAdult flag if explicitly provided
    if (req.body.isAdult !== undefined) {
      user.isAdult = req.body.isAdult;
    }
    
    // Update profile image if provided (no restrictions, can be changed anytime)
    if (req.body.profileImage) {
      user.profileImage = req.body.profileImage;
    }
    
    // If email is being changed, require re-verification
    if (req.body.email && req.body.email !== user.email) {
      // Check if email already exists with another user
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      user.email = req.body.email;
      user.isEmailVerified = false;
      
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      user.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationCode)
        .digest('hex');
        
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      
      // Send verification email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Email Verification - Vortexly',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
              <div style="background-color: #f8f8f8; padding: 20px;">
                <h2 style="color: #333;">Hello ${user.fullName}!</h2>
                <p style="color: #555;">Please use the verification code below to verify your new email address:</p>
                <div style="background-color: #e9f7ef; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; text-align: center;">
                  <p style="color: #155724; font-size: 24px; font-weight: bold; letter-spacing: 5px;">${verificationCode}</p>
                </div>
                <p style="color: #555;">This code will expire in 24 hours.</p>
                <p style="color: #555; margin-top: 20px;">If you did not request this change, please contact our support immediately.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
                  <p>Vortexly - Your platform for growth and connection</p>
                </div>
              </div>
            </body>
          </html>
        `
      };

      await transporter.sendMail(mailOptions);
    }
    
    // If phone number is being changed, require re-verification
    if (req.body.phoneNumber && req.body.phoneNumber !== user.phoneNumber) {
      // Check if phone number already exists with another user
      const phoneExists = await User.findOne({ phoneNumber: req.body.phoneNumber });
      if (phoneExists) {
        return res.status(400).json({ message: 'Phone number already in use' });
      }
      
      user.phoneNumber = req.body.phoneNumber;
      user.isPhoneVerified = false;
      
      // Start Twilio Verify process
      await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verifications
        .create({ to: user.phoneNumber, channel: 'sms' });
    }
    
    // If password is being changed
    if (req.body.password) {
      if (!validatePassword(req.body.password)) {
        return res.status(400).json({ 
          message: 'Password must be at least 8 characters long, contain at least 2 numbers, and 1 special character.' 
        });
      }
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber,
      bio: updatedUser.bio,
      profileImage: updatedUser.profileImage,
      dob: updatedUser.dob,
      isAdult: updatedUser.isAdult,
      isEmailVerified: updatedUser.isEmailVerified,
      isPhoneVerified: updatedUser.isPhoneVerified,
      apiKey: updatedUser.apiKey,
      lastNameChange: updatedUser.lastNameChange,
      lastFullNameChange: updatedUser.lastFullNameChange,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add phone number to account
// @route   POST /api/users/add-phone
// @access  Private (API key)
const addPhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user._id; // This comes from the apiKeyAuth middleware

    // Validate the phone number format (basic E.164 format validation)
    if (!phoneNumber || !phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      return res.status(400).json({ 
        message: 'Please provide a valid phone number in E.164 format (e.g., +918010182409)' 
      });
    }

    // Check if phone number is already in use
    const phoneExists = await User.findOne({ phoneNumber });
    if (phoneExists && phoneExists._id.toString() !== userId.toString()) {
      return res.status(400).json({ message: 'Phone number already in use' });
    }

    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update phone number and set verification status to false
    user.phoneNumber = phoneNumber;
    user.isPhoneVerified = false;
    await user.save();

    // Start Twilio verification process
    await twilioClient.verify.v2
      .services(twilioVerifyServiceSid)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    res.status(200).json({ 
      message: 'Verification code sent to your phone number',
      _id: user._id,
      name: user.name,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bio: user.bio,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Remove user account
// @route   DELETE /api/users/:id
// @access  Private (admin only)
const removeUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete the user
    await User.deleteOne({ _id: userId });
    
    res.status(200).json({ 
      message: 'User successfully removed',
      userId
    });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user profile image
// @route   PUT /api/users/me/avatar
// @access  Private
const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Uploading image to Cloudinary...');
    
    // Create a unique identifier for the image
    const uniqueFilename = `user_${user._id}_${Date.now()}`;
    
    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      // Create a readable stream from the file buffer
      const stream = require('stream');
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      
      // Upload via stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'profile-images',
          public_id: uniqueFilename,
          overwrite: true,
          resource_type: 'image',
          transformation: [{width: 500, height: 500, crop: 'fill'}]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      bufferStream.pipe(uploadStream);
    }).catch(error => {
      console.error('Cloudinary upload error:', error);
      throw new Error('Error uploading to Cloudinary');
    });
    
    console.log('Cloudinary upload result:', result);
    
    // Update user profile with Cloudinary URL
    user.profileImage = result.secure_url;
    
    // Record the cloudinary ID for future reference (for deletion etc.)
    user.profileImageId = result.public_id;

    // Save the updated user
    const updatedUser = await user.save();

    res.json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        bio: updatedUser.bio,
        profileImage: updatedUser.profileImage,
        profileImageId: updatedUser.profileImageId,
        tag: updatedUser.tag,
        followers: updatedUser.followers,
        following: updatedUser.following,
        dob: updatedUser.dob,
        isAdult: updatedUser.isAdult,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        apiKey: updatedUser.apiKey,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      },
      message: 'Profile image updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's avatar image
// @route   GET /api/users/:id/avatar
// @access  Public
const getUserAvatar = async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await User.findById(userId).select('avatar profileImage');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return the profile image URL
    const imageUrl = user.profileImage || user.avatar || null;
    
    if (!imageUrl) {
      return res.status(404).json({ message: 'No avatar image found for this user' });
    }
    
    // Return the image URL
    res.status(200).json({ imageUrl });
  } catch (error) {
    console.error('Get user avatar error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get public user profile information
// @route   GET /api/users/:id/public
// @access  Public (with optional auth for following status)
const getPublicUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    // Get public user information
    const user = await User.findById(userId)
      .select('_id name fullName avatar profileImage bio followers following posts reels tag');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Format the response data
    const publicProfile = {
      _id: user._id,
      name: user.name,
      fullName: user.fullName,
      profileImage: user.profileImage || user.avatar,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      posts: user.posts,
      reels: user.reels,
      tag: user.tag
    };
    
    // Add isFollowing flag if user is authenticated
    if (req.user) {
      const currentUser = await User.findById(req.user._id).select('followingRef');
      publicProfile.isFollowing = currentUser.followingRef.includes(userId);
    }
    
    res.status(200).json({ user: publicProfile });
  } catch (error) {
    console.error('Get public user profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user basic info by ID
// @route   GET /api/users/:id/basic
// @access  Public
const getUserBasicInfo = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID format' 
      });
    }
    
    const user = await User.findById(userId).select('name fullName profileImage');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        fullName: user.fullName,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Error getting user basic info:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Update user profile with avatar (supporting both file uploads and URLs)
const updateUserProfileWithAvatar = async (req, res) => {
  try {
    // Parse profile data from request
    const { fullName, name, bio, email, phone, website } = req.body;
    const userId = req.user._id;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update basic profile information
    if (fullName) user.fullName = fullName;
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (website !== undefined) user.website = website;
    
    // Handle profile image
    let profileImageUrl = null;
    
    // Check if there's a profileImageUrl in the request body (for AI-generated images)
    if (req.body.profileImageUrl) {
      console.log('Updating profile with image URL:', req.body.profileImageUrl);
      
      // Update the profile image URL directly
      profileImageUrl = req.body.profileImageUrl;
      user.profileImage = profileImageUrl;
    }
    // Check if there's a file in the request using express-fileupload
    else if (req.files && (req.files.file || req.files.profileImage)) {
      const file = req.files.file || req.files.profileImage;
      console.log('Uploading file for profile update:', file.name);
      
      // Create temporary file path
      const tempFilePath = file.tempFilePath || path.join(__dirname, '..', 'temp', `${Date.now()}-${file.name}`);
      
      // If file isn't already saved (no tempFilePath), save it
      if (!file.tempFilePath) {
        await file.mv(tempFilePath);
      }
      
      // Handle file upload to Cloudinary
      try {
        const result = await cloudinary.uploader.upload(tempFilePath, {
          folder: 'profile-images',
          resource_type: 'image'
        });
        
        // Set the profile image to the secure URL from Cloudinary
        profileImageUrl = result.secure_url;
        user.profileImage = profileImageUrl;
        
        // Store Cloudinary public ID for later deletion if needed
        user.profileImageId = result.public_id;
        
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cloudinaryError) {
        console.error('Error uploading to Cloudinary:', cloudinaryError);
        return res.status(500).json({ 
          message: 'Error uploading image to cloud storage',
          error: cloudinaryError.message
        });
      }
    }
    
    // Save the user
    await user.save();
    
    // Return the updated user
    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        fullName: user.fullName,
        name: user.name,
        bio: user.bio,
        email: user.email,
        phone: user.phone,
        website: user.website,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      }
    });
  } catch (error) {
    console.error('Error updating user profile with avatar:', error);
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

module.exports = {
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
}; 