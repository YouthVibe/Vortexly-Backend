const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const setupMiddleware = (app) => {
  // Parse JSON payloads
  app.use(bodyParser.json());
  
  // Enable CORS for all routes
  app.use(cors());
  
  console.log('Middleware initialized');
};

module.exports = { setupMiddleware }; 