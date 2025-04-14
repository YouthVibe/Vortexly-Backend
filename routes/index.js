const express = require('express');
const userRoutes = require('./userRoutes');
const apiRoutes = require('./apiRoutes');
const router = express.Router();

// Import route modules
const followRoutes = require('./followRoutes');
const postRoutes = require('./postRoutes');
// const authRoutes = require('./authRoutes');  // Removed missing file
const storyRoutes = require('./storyRoutes');
const notificationRoutes = require('./notificationRoutes');
const searchRoutes = require('./searchRoutes');
const uploadRoutes = require('./uploadRoutes');
const reelRoutes = require('./reelRoutes');
const messageRoutes = require('./messages'); // Changed to use messages.js instead of messageRoutes.js
const maintenanceRoutes = require('./maintenanceRoutes');
const commentRoutes = require('./commentRoutes'); // Add new comment routes

// Register all routes
const setupRoutes = (app) => {
  // User routes
  app.use('/api/users', userRoutes);
  
  // API key authenticated routes
  app.use('/api/v1', apiRoutes);
  
  // API status route
  app.get('/api/status', (req, res) => {
    res.json({ status: 'API is running' });
  });
  
  // Register routes
  // router.use('/auth', authRoutes);  // Removed missing route
  router.use('/users', userRoutes);
  router.use('/follows', followRoutes);
  router.use('/posts', postRoutes);
  router.use('/reels', reelRoutes);
  router.use('/search', searchRoutes);
  router.use('/notifications', notificationRoutes);
  router.use('/messages', messageRoutes);
  router.use('/stories', storyRoutes);
  router.use('/upload', uploadRoutes);
  router.use('/maintenance', maintenanceRoutes);
  
  // Add more routes here as needed
  
  console.log('Routes initialized');
  return router;
};

module.exports = { setupRoutes }; 