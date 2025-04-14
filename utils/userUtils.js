/**
 * Utility functions for handling user data safely in API responses
 */
const mongoose = require('mongoose');

/**
 * Ensures a user object has all required fields to prevent UI errors
 * @param {Object} user - The user object to normalize
 * @returns {Object} A normalized user object with all required fields
 */
const normalizeUserData = (user) => {
  if (!user) {
    return {
      _id: new mongoose.Types.ObjectId(),
      username: 'Unknown User',
      name: 'Unknown',
      profilePicture: null,
      profileImage: null,
      bio: ''
    };
  }

  // Ensure all required fields exist
  return {
    _id: user._id,
    username: user.username || 'Unknown User',
    name: user.name || user.username || 'Unknown',
    profilePicture: user.profilePicture || null,
    profileImage: user.profileImage || user.profilePicture || null,
    bio: user.bio || '',
    ...user // Keep other properties
  };
};

/**
 * Safely populates user data in a post object
 * @param {Object} post - The post object to normalize
 * @returns {Object} A post with normalized user data
 */
const normalizePostUserData = (post) => {
  if (!post) return null;
  
  const normalizedPost = { ...post };
  
  // Normalize main post user
  if (normalizedPost.user) {
    normalizedPost.user = normalizeUserData(normalizedPost.user);
  } else {
    normalizedPost.user = normalizeUserData();
  }
  
  // Normalize comment users if they exist
  if (normalizedPost.comments && Array.isArray(normalizedPost.comments)) {
    normalizedPost.comments = normalizedPost.comments.map(comment => {
      if (!comment) return null;
      
      const normalizedComment = { ...comment };
      
      // Normalize comment user
      if (normalizedComment.user) {
        normalizedComment.user = normalizeUserData(normalizedComment.user);
      } else {
        normalizedComment.user = normalizeUserData();
      }
      
      // Normalize reply users if they exist
      if (normalizedComment.replies && Array.isArray(normalizedComment.replies)) {
        normalizedComment.replies = normalizedComment.replies.map(reply => {
          if (!reply) return null;
          
          const normalizedReply = { ...reply };
          
          // Normalize reply user
          if (normalizedReply.user) {
            normalizedReply.user = normalizeUserData(normalizedReply.user);
          } else {
            normalizedReply.user = normalizeUserData();
          }
          
          return normalizedReply;
        }).filter(Boolean);
      }
      
      return normalizedComment;
    }).filter(Boolean);
  }
  
  return normalizedPost;
};

module.exports = {
  normalizeUserData,
  normalizePostUserData
}; 