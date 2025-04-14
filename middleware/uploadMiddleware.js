const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createUploadDirectories = () => {
  const dirs = [
    './uploads',
    './uploads/profile',
    './uploads/posts',
    './uploads/chat',
    './uploads/chat/images',
    './uploads/chat/videos',
    './uploads/chat/thumbnails'
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
};

// Create directories on startup
createUploadDirectories();

// Configure storage for different file types
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine the upload directory based on file type and route
    let uploadPath = './uploads';
    
    // Check if this is a chat media upload
    if (req.path.includes('/messages/media')) {
      if (file.mimetype.startsWith('image/')) {
        uploadPath = './uploads/chat/images';
      } else if (file.mimetype.startsWith('video/')) {
        uploadPath = './uploads/chat/videos';
      }
    } 
    // You can add more conditions for other types of uploads
    else if (req.path.includes('/profile')) {
      uploadPath = './uploads/profile';
    } else if (req.path.includes('/posts')) {
      uploadPath = './uploads/posts';
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter to validate types
const fileFilter = (req, file, cb) => {
  // Accept images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only images and videos are allowed.'), false);
  }
};

// Create the multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Handle Multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
  // Everything went fine
  next();
};

// Create a middleware function that will be exported directly
const uploadMiddleware = (req, res, next) => {
  // Handle chat media uploads
  if (req.path.includes('/messages/media')) {
    console.log('Handling chat media upload');
    return upload.array('files', 10)(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  }
  
  // Pass through for other routes
  next();
};

// Make the upload and error handler available on the middleware function
uploadMiddleware.upload = upload;
uploadMiddleware.handleMulterError = handleMulterError;

// Export the middleware function directly
module.exports = uploadMiddleware; 