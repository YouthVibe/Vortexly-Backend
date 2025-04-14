const crypto = require('crypto');
const path = require('path');

/**
 * Generates a unique filename with the given prefix and extension
 * @param {string} prefix - The prefix for the filename
 * @param {string} extension - The file extension (without the dot)
 * @returns {string} A unique filename
 */
const generateUniqueFilename = (prefix = 'file', extension = 'jpg') => {
  // Generate a random string
  const randomString = crypto.randomBytes(8).toString('hex');
  
  // Get current timestamp
  const timestamp = Date.now();
  
  // Combine prefix, timestamp, and random string for uniqueness
  return `${prefix}-${timestamp}-${randomString}.${extension}`;
};

/**
 * Sanitizes a filename to remove any potentially unsafe characters
 * @param {string} filename - The filename to sanitize
 * @returns {string} The sanitized filename
 */
const sanitizeFilename = (filename) => {
  // Remove path components and special characters
  const sanitized = path.basename(filename)
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
  
  return sanitized;
};

module.exports = {
  generateUniqueFilename,
  sanitizeFilename
}; 