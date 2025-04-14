# YouthVibes Backend - Developer Guide

Welcome to the YouthVibes backend server! This Node.js application powers the YouthVibes social media platform with RESTful APIs and real-time communication via WebSockets.

## 📚 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Database Models](#database-models)
- [Authentication](#authentication)
- [Real-time Communication](#real-time-communication)
- [File Upload](#file-upload)
- [Deployment](#deployment)
- [Maintenance](#maintenance)

## ✨ Features

- **User Management**: Registration, authentication, profiles
- **Content Management**: Posts, stories, reels
- **Social Networking**: Following/followers, likes, comments
- **Real-time Messaging**: Instant chat with typing indicators
- **Media Handling**: Image and video upload with processing
- **Notifications**: Push and in-app notifications
- **Search**: User and content discovery

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Storage**: Local storage + Cloudinary
- **Email**: Nodemailer
- **AI Integration**: Google's Generative AI

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/youthvibes-backend.git
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory with the following:

   ```
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Connection
   MONGODB_URI=mongodb://localhost:27017/youthvibes
   
   # JWT Authentication
   JWT_SECRET=your_super_secret_key_here
   JWT_EXPIRES_IN=7d
   
   # Email Configuration
   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_email_app_password
   EMAIL_FROM=YouthVibes <your_email@gmail.com>
   
   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   
   # Google AI Configuration
   GOOGLE_AI_API_KEY=your_google_ai_api_key
   
   # Expo Push Notifications
   EXPO_ACCESS_TOKEN=your_expo_access_token
   ```

4. **Create upload directories**:
   ```bash
   mkdir -p uploads/profile-images uploads/posts uploads/reels
   ```

5. **Start the server**:
   - Development mode with hot reload:
     ```bash
     npm run dev
     ```
   - Production mode:
     ```bash
     npm start
     ```

## 📂 Project Structure

```
backend/
├── config/               # Configuration files
│   ├── db.js             # Database connection
│   ├── email.js          # Email service setup
│   ├── cloudinary.js     # Cloudinary integration
│   └── ai.js             # AI service configuration
│
├── controllers/          # Business logic
│   ├── authController.js # Authentication handlers
│   ├── userController.js # User management
│   ├── postController.js # Post operations
│   ├── reelController.js # Reel operations
│   ├── storyController.js # Story operations
│   └── messageController.js # Chat functionality
│
├── middleware/           # Express middleware
│   ├── auth.js           # JWT authentication check
│   ├── errorHandler.js   # Global error handling
│   ├── upload.js         # File upload processing
│   └── rateLimiter.js    # API rate limiting
│
├── models/               # Mongoose schemas
│   ├── User.js           # User model
│   ├── Post.js           # Post model
│   ├── Reel.js           # Reel model
│   ├── Story.js          # Story model
│   ├── Message.js        # Message model
│   ├── Conversation.js   # Conversation model
│   └── Notification.js   # Notification model
│
├── routes/               # API routes
│   ├── userRoutes.js     # User endpoints
│   ├── postRoutes.js     # Post endpoints
│   ├── reelRoutes.js     # Reel endpoints
│   ├── storyRoutes.js    # Story endpoints
│   ├── messageRoutes.js  # Message endpoints
│   ├── searchRoutes.js   # Search functionality
│   └── uploadRoutes.js   # Upload endpoints
│
├── utils/                # Helper functions
│   ├── errorHandler.js   # Error handling utilities
│   ├── validator.js      # Input validation
│   ├── pushNotification.js # Push notification service
│   └── fileProcessor.js  # File processing utilities
│
├── scripts/              # Maintenance scripts
│   ├── seedAdmin.js      # Create admin user
│   └── fixConversations.js # Fix broken conversations
│
├── uploads/              # Temporary file storage
│   ├── profile-images/   # User profile pictures
│   ├── posts/            # Post media
│   └── reels/            # Reel videos
│
├── server.js             # Application entry point
└── package.json          # Dependencies and scripts
```

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|--------------|
| POST | `/api/users/register` | Register new user | No |
| POST | `/api/users/login` | Authenticate user | No |
| GET | `/api/users/verify/:token` | Verify email | No |
| POST | `/api/users/forgot-password` | Request password reset | No |
| POST | `/api/users/reset-password/:token` | Reset password | No |
| GET | `/api/users/me` | Get current user | Yes |

### User Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|--------------|
| GET | `/api/users/:id` | Get user profile | Yes |
| PUT | `/api/users/:id` | Update user profile | Yes |
| GET | `/api/users/:id/followers` | Get user followers | Yes |
| GET | `/api/users/:id/following` | Get user following | Yes |
| POST | `/api/follow/:id` | Follow a user | Yes |
| DELETE | `/api/follow/:id` | Unfollow a user | Yes |

### Post Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|--------------|
| POST | `/api/posts` | Create new post | Yes |
| GET | `/api/posts` | Get feed posts | Yes |
| GET | `/api/posts/:id` | Get post by ID | Yes |
| PUT | `/api/posts/:id` | Update post | Yes |
| DELETE | `/api/posts/:id` | Delete post | Yes |
| POST | `/api/posts/:id/like` | Like post | Yes |
| DELETE | `/api/posts/:id/like` | Unlike post | Yes |
| POST | `/api/posts/:id/comment` | Add comment | Yes |
| DELETE | `/api/posts/:id/comment/:commentId` | Delete comment | Yes |

### Message Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|--------------|
| GET | `/api/messages/conversations` | Get user conversations | Yes |
| GET | `/api/messages/conversation/:id` | Get messages in conversation | Yes |
| POST | `/api/messages/conversation/:id` | Send message | Yes |
| GET | `/api/messages/unread` | Get unread message count | Yes |

## 🗄️ Database Models

### User Model

```javascript
{
  username: String,       // Unique username
  fullName: String,       // User's full name
  email: String,          // Unique email address
  password: String,       // Hashed password
  bio: String,            // User bio/description
  profileImage: String,   // URL to profile picture
  followers: [ObjectId],  // User IDs of followers
  following: [ObjectId],  // User IDs being followed
  verified: Boolean,      // Email verification status
  verificationToken: String, // Email verification token
  resetPasswordToken: String, // Password reset token
  resetPasswordExpires: Date, // Token expiration
  createdAt: Date,        // Account creation date
  updatedAt: Date         // Last update timestamp
}
```

### Conversation Model

```javascript
{
  participants: [ObjectId], // User IDs in conversation
  lastMessage: {
    text: String,         // Message content
    sender: ObjectId,     // User ID of sender
    createdAt: Date       // Timestamp
  },
  createdAt: Date,        // Conversation creation date
  updatedAt: Date         // Last update timestamp
}
```

### Message Model

```javascript
{
  conversation: ObjectId, // Conversation ID
  sender: ObjectId,       // User ID of sender
  text: String,           // Message content
  media: String,          // Optional media URL
  readBy: [ObjectId],     // User IDs who read the message
  createdAt: Date,        // Message creation date
  updatedAt: Date         // Last update timestamp
}
```

## 🔐 Authentication

YouthVibes uses JWT (JSON Web Token) authentication for securing API endpoints:

1. **Token Generation**: JWT tokens are created upon successful login/registration
2. **Token Storage**: Tokens should be stored securely by clients
3. **Token Validation**: The `auth` middleware checks token validity on protected routes
4. **Token Refresh**: Automatic token refresh mechanism for long sessions

Example auth middleware implementation:

```javascript
const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization').replace('Bearer ', '');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user data to request
    req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};
```

## 📱 Real-time Communication

Socket.IO powers real-time features:

1. **Connection**: Established when users log in
2. **Authentication**: JWT tokens validate socket connections
3. **Events**: Main events include:
   - `authenticate`: Authenticate socket with JWT
   - `send_message`: Send a new message
   - `new_message`: Receive a new message
   - `typing`: Indicate user is typing
   - `stop_typing`: Indicate user stopped typing

Socket connection management:
- `userSockets` map: Associates user IDs with socket IDs
- `socketUsers` map: Associates socket IDs with user IDs

## 📤 File Upload

Media uploads are handled in multiple steps:

1. **Initial Upload**: Files uploaded to local storage
2. **Processing**: Resizing, compression, format conversion
3. **Cloud Storage**: Processed files uploaded to Cloudinary
4. **Cleanup**: Local files removed after successful cloud upload

File upload middleware:
- Uses `multer` for handling multipart form data
- Configures storage location, file size limits, and file types
- Processes images and videos differently based on content type

## 🚀 Deployment

### Prerequisites
- Node.js environment (v14+)
- MongoDB database
- Environment variables configured

### Deployment Steps

1. **Prepare application**:
   ```bash
   npm ci --production
   ```

2. **Start with process manager**:
   ```bash
   pm2 start server.js --name youthvibes-backend
   ```

### Monitoring

- Use PM2 for process monitoring
- Set up logging with Winston or similar
- Configure health check endpoints

## 🛠️ Maintenance

### Database Maintenance

- Regular backups with `mongodump`
- Indexing for performance optimization
- Data cleanup for temporary files

### Security Measures

- Regular dependency updates
- Rate limiting on authentication endpoints
- Input validation on all endpoints
- Secure headers configuration

### Utility Scripts

- `scripts/seedAdmin.js`: Creates an admin user
- `scripts/fixConversations.js`: Repairs corrupted conversation data

## 📝 Contributing

Please follow the contribution guidelines in [CONTRIBUTING.md](./CONTRIBUTING.md) when submitting changes to the project.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.