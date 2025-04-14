// Import dependencies
// Import crypto polyfill for UUID
require('./utils/uuid-polyfill');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const { errorHandler } = require('./utils/errorHandler');
const { initCloudinary } = require('./config/cloudinary');
const { createTransporter } = require('./config/email');
const { initAI } = require('./config/ai');
const fileUpload = require('express-fileupload');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const postRoutes = require('./routes/postRoutes');
const followRoutes = require('./routes/followRoutes');
const reelRoutes = require('./routes/reelRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const messageRoutes = require('./routes/messages');
const storyRoutes = require('./routes/storyRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { authenticate } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Import socket manager functions
const { initializeSocketIO, deliverMessageToUser, setupSocket } = require('./utils/socketManager');

// Import routes and middleware
const routes = require('./routes');
const { authMiddleware } = require('./middleware/authMiddleware');
// Comment out the problematic middleware for now
// const { uploadMiddleware } = require('./middleware/uploadMiddleware');

// Import AI routes
const aiRoutes = require('./routes/aiRoutes');
const commentRoutes = require('./routes/commentRoutes');

// Load environment variables
dotenv.config();

// Database connection
connectDB();

// Initialize services
const emailTransporter = createTransporter();
const genAI = initAI();
initCloudinary();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 30000,
  transports: ['websocket', 'polling'],
  allowUpgrades: true
});

// Initialize Socket.IO
initializeSocketIO(io);

// Make io accessible globally and to routes
global.io = io;
app.set('io', io);

// Function to send notification via socket
app.set('sendNotification', (userId, notification) => {
  try {
    deliverMessageToUser(userId, {
      type: 'notification',
      data: notification
    });
    console.log(`Notification sent to user ${userId}`);
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
});

// Set up middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());

// Set up file upload middleware
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'temp'),
  createParentPath: true,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  abortOnLimit: true,
  safeFileNames: true,
  preserveExtension: true,
  debug: true
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug the routes variable
console.log('routes variable:', typeof routes);
console.log('routes keys:', Object.keys(routes));

// Comment out the problematic middleware for now
// app.use(uploadMiddleware);

// API routes - prefix with /api
// Skip or modify if routes is not a middleware function
// app.use('/api', routes);
// Use only setupRoutes instead
const { setupRoutes } = require('./routes/index');
app.use('/api', setupRoutes(app));

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postRoutes);
// Register comments as a sub-route of posts
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/api', apiRoutes);
app.use('/api/ai', aiRoutes);

// Add a simple ping endpoint for connectivity checks
app.get('/ping', (req, res) => {
  // Enable CORS for this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  
  res.status(200).json({
    message: 'API server is running',
    serverTime: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Apply error handler middleware
app.use(errorHandler);

// Handle graceful shutdown
const cleanupAndExit = () => {
  console.log('Cleaning up before exit...');
  
  // Clean up uploads directory
  if (fs.existsSync(path.join(__dirname, 'uploads'))) {
    try {
      const files = fs.readdirSync(path.join(__dirname, 'uploads'));
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(path.join(__dirname, 'uploads'), file));
        }
      }
      console.log('Cleaned up uploads directory');
    } catch (error) {
      console.error('Error cleaning uploads directory:', error);
    }
  }
  
  process.exit(0);
};

// Register cleanup handlers
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

// Server initialization
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
