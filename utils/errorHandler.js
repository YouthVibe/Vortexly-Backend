// Custom error class for API errors
class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Custom error class for File Upload errors
class FileUploadError extends ApiError {
  constructor(message, statusCode = 400) {
    super(message, statusCode);
    this.name = 'FileUploadError';
  }
}

// Error middleware
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map(val => val.message).join(', ');
    statusCode = 400;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    message = `Duplicate field value entered: ${Object.keys(err.keyValue)}`;
    statusCode = 400;
  }

  // JWT Error
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
    statusCode = 401;
  }

  // JWT Expired
  if (err.name === 'TokenExpiredError') {
    message = 'Token expired';
    statusCode = 401;
  }

  // Multer errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large. Maximum size is 5MB.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected field name in upload form.';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  // File Upload errors
  if (err.name === 'FileUploadError') {
    statusCode = err.statusCode;
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = {
  ApiError,
  FileUploadError,
  errorHandler,
}; 