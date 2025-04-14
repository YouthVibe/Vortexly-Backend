const Post = require('../models/Post');
const User = require('../models/User');
const { uploadToCloudinary, uploadVideoToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { validateObjectId } = require('../utils/validation');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const { normalizePostUserData } = require('../utils/userUtils');

// Create a new post
exports.createPost = async (req, res) => {
  try {
    console.log('CreatePost controller hit');
    console.log('Request headers:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');
    
    // Check if we have files at all
    if (!req.files) {
      console.error('No req.files object available');
      return res.status(400).json({ 
        success: false, 
        message: 'No files were uploaded. Make sure your request includes file data and has the correct Content-Type.' 
      });
    }
    
    // Check if we have the specific files we need
    if (!req.files.image && (!req.files.images || req.files.images.length === 0) && !req.files.testImage) {
      console.error('No image or images found in the request');
      console.error('Available files:', Object.keys(req.files));
      return res.status(400).json({ 
        success: false, 
        message: 'Required image files not found in the request. Please ensure you are uploading either "image" or "images".' 
      });
    }

    // Skip processing for test uploads
    if (req.files.testImage && req.body.test === 'true') {
      console.log('Test upload detected. Returning success without creating a post.');
      return res.status(200).json({
        success: true,
        message: 'Test upload received successfully',
        filesReceived: Object.keys(req.files)
      });
    }

    const { caption, tags } = req.body;
    
    // Check for multiple images
    const multipleImages = req.files?.images;
    const singleImage = req.files?.image;
    const videoFile = req.files?.video;

    if (!singleImage && !multipleImages && !videoFile) {
      return res.status(400).json({ message: 'Please provide at least one image or video' });
    }

    // Log file details for debugging
    if (singleImage) {
      console.log(`Processing single image: ${singleImage.name}, Size: ${singleImage.size}, Type: ${singleImage.mimetype}`);
    } else if (multipleImages) {
      console.log(`Processing ${Array.isArray(multipleImages) ? multipleImages.length : 1} images`);
      // If multipleImages is not an array (single file), convert it to an array
      const imagesArray = Array.isArray(multipleImages) ? multipleImages : [multipleImages];
      imagesArray.forEach((img, index) => {
        console.log(`Image ${index + 1}: ${img.name}, Size: ${img.size}, Type: ${img.mimetype}`);
      });
    } else if (videoFile) {
      console.log(`Processing video: ${videoFile.name}, Size: ${videoFile.size}, Type: ${videoFile.mimetype}`);
    }

    // Check file size limit
    const fileSizeMB = (singleImage ? singleImage.size : videoFile ? videoFile.size : 0) / (1024 * 1024);
    if (fileSizeMB > 50) {
      return res.status(413).json({ message: 'File is too large. Maximum size is 50MB.' });
    }

    if (multipleImages) {
      // Handle multipleImages being a single file or an array
      const imagesArray = Array.isArray(multipleImages) ? multipleImages : [multipleImages];
      
      // Check total size of all images
      const totalSizeMB = imagesArray.reduce((total, img) => total + (img.size / (1024 * 1024)), 0);
      if (totalSizeMB > 100) {
        return res.status(413).json({ message: 'Total image size is too large. Maximum total size is 100MB.' });
      }
      
      // Limit to 10 images
      if (imagesArray.length > 10) {
        return res.status(400).json({ message: 'Maximum 10 images allowed per post.' });
      }
    }

    let uploadResult;
    let uploadResults = [];
    let isVideo = false;
    let videoUrl = null;
    let moreThanOneImage = false;

    try {
      if (videoFile) {
        // Handle video upload (existing code)
        isVideo = true;
        uploadResult = await uploadVideoToCloudinary(videoFile);
        videoUrl = uploadResult.secure_url;
      } else if (multipleImages) {
        // Handle multiple images
        const imagesArray = Array.isArray(multipleImages) ? multipleImages : [multipleImages];
        
        // Set the flag if we have more than one image
        moreThanOneImage = imagesArray.length > 1;
        
        // Upload each image to Cloudinary
        for (const image of imagesArray) {
          const result = await uploadToCloudinary(image);
          uploadResults.push(result);
        }
        
        // Set the first image as the main image for backward compatibility
        uploadResult = uploadResults[0];
      } else {
        // Single image upload (existing code)
        uploadResult = await uploadToCloudinary(singleImage);
      }
    } catch (uploadError) {
      console.error('Upload to Cloudinary failed:', uploadError);
      return res.status(500).json({ 
        message: 'Error uploading file. Please try with a smaller file.',
        error: uploadError.message 
      });
    }

    // Safely handle tags parsing
    let parsedTags = [];
    if (tags) {
      try {
        // Check if tags is already an array or needs parsing
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        // Ensure it's an array
        if (!Array.isArray(parsedTags)) {
          parsedTags = [parsedTags.toString()];
        }
      } catch (parseError) {
        console.log('Tags parsing error, using as string:', parseError.message);
        // If JSON parsing fails, use it as a single tag string
        parsedTags = tags ? [tags.toString()] : [];
      }
    }

    // Create post object with base fields
    const postData = {
      user: req.user._id,
      image: uploadResult.secure_url,
      imageId: uploadResult.public_id,
      caption,
      tags: parsedTags,
      isVideo,
      videoUrl,
      moreThanOneImage
    };

    // Add multiple images data if available
    if (uploadResults.length > 0) {
      // Always create the images and imageIds arrays, even for single image
      postData.images = uploadResults.map(result => result.secure_url);
      postData.imageIds = uploadResults.map(result => result.public_id);
    }

    // Create the post
    const post = await Post.create(postData);

    // Update user's post count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { posts: 1 }
    });

    res.status(201).json({
      success: true,
      data: post,
      imageIds: postData.imageIds || [uploadResult.public_id] // Return imageIds for potential cleanup
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ 
      message: 'Error creating post', 
      error: error.message 
    });
  }
};

// Get user's posts
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    if (!validateObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const posts = await Post.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage');

    const total = await Post.countDocuments({ user: userId });

    res.json({
      success: true,
      data: posts,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Error fetching posts' });
  }
};

// Get single post
exports.getPost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId)
      .populate('user', 'name username profilePicture profileImage bio')
      .populate('likes', 'name username profilePicture')
      .populate('comments.user', 'name username profilePicture')
      .populate('comments.likes', 'name username profilePicture')
      .populate('comments.replies.user', 'name username profilePicture')
      .populate('comments.replies.likes', 'name username profilePicture');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Normalize user data to prevent UI errors
    const normalizedPost = normalizePostUserData(post.toObject());

    // Return post with consistent response format
    return res.status(200).json({
      success: true,
      data: {
        data: normalizedPost
      }
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Error fetching post' });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Delete from Cloudinary
    if (post.imageId) {
      await deleteFromCloudinary(post.imageId);
    }

    // Delete post using findByIdAndDelete (more reliable than remove())
    await Post.findByIdAndDelete(postId);

    // Update user's post count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { posts: -1 }
    });

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Error deleting post', error: error.message });
  }
};

// Like/Unlike post
exports.toggleLike = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(req.user._id);
    const isLiking = likeIndex === -1;

    if (isLiking) {
      post.likes.push(req.user._id);
    } else {
      post.likes.splice(likeIndex, 1);
    }

    await post.save();

    // Create notification if user is liking the post (not unliking)
    if (isLiking && post.user.toString() !== req.user._id.toString()) {
      const notificationController = require('./notificationController');
      await notificationController.createNotification({
        recipient: post.user,
        sender: req.user._id,
        type: 'like',
        post: post._id,
        message: 'liked your post'
      }, req);
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ message: 'Error toggling like' });
  }
};

// Add comment
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = {
      text,
      user: req.user._id,
      createdAt: Date.now(),
      likes: [],
      replies: []
    };

    post.comments.push(comment);
    await post.save();

    // Create notification for comment if not on user's own post
    if (post.user.toString() !== req.user._id.toString()) {
      const notificationController = require('./notificationController');
      await notificationController.createNotification({
        recipient: post.user,
        sender: req.user._id,
        type: 'comment',
        post: post._id,
        comment: post.comments[post.comments.length - 1]._id, // Get ID of the newly added comment
        message: `commented on your post: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`
      }, req);
    }

    // Populate user details in the new comment
    const updatedPost = await Post.findById(postId)
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage')
      .populate('comments.likes', 'name profileImage')
      .populate('comments.replies.user', 'name profileImage')
      .populate('comments.replies.likes', 'name profileImage');

    // Return consistent response format
    return res.status(201).json({
      success: true,
      data: {
        data: updatedPost
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
};

// Toggle like on a comment
exports.toggleCommentLike = async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    if (!validateObjectId(postId) || !validateObjectId(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const likeIndex = comment.likes.indexOf(req.user._id);
    const isLiking = likeIndex === -1;

    if (isLiking) {
      comment.likes.push(req.user._id);
    } else {
      comment.likes.splice(likeIndex, 1);
    }

    await post.save();

    // Create notification if user is liking the comment (not unliking)
    if (isLiking && comment.user.toString() !== req.user._id.toString()) {
      const notificationController = require('./notificationController');
      await notificationController.createNotification({
        recipient: comment.user,
        sender: req.user._id,
        type: 'like',
        post: post._id,
        comment: commentId,
        message: 'liked your comment'
      }, req);
    }

    // Return the updated post with populated data
    const updatedPost = await Post.findById(postId)
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage')
      .populate('comments.likes', 'name profileImage')
      .populate('comments.replies.user', 'name profileImage')
      .populate('comments.replies.likes', 'name profileImage');

    // Return consistent response format
    return res.json({
      success: true,
      data: {
        data: updatedPost
      }
    });
  } catch (error) {
    console.error('Toggle comment like error:', error);
    res.status(500).json({ message: 'Error toggling comment like' });
  }
};

// Add reply to a comment
exports.addCommentReply = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!validateObjectId(postId) || !validateObjectId(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    if (!text) {
      return res.status(400).json({ message: 'Reply text is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = {
      text,
      user: req.user._id,
      createdAt: Date.now(),
      likes: []
    };

    comment.replies.push(reply);
    await post.save();

    // Create notification for comment reply if not replying to your own comment
    if (comment.user.toString() !== req.user._id.toString()) {
      const notificationController = require('./notificationController');
      await notificationController.createNotification({
        recipient: comment.user,
        sender: req.user._id,
        type: 'reply',
        post: post._id,
        comment: commentId,
        reply: comment.replies[comment.replies.length - 1]._id,
        message: `replied to your comment: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`
      }, req);
    }

    // Return the updated post with populated data
    const updatedPost = await Post.findById(postId)
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage')
      .populate('comments.likes', 'name profileImage')
      .populate('comments.replies.user', 'name profileImage')
      .populate('comments.replies.likes', 'name profileImage');

    // Return consistent response format
    return res.status(201).json({
      success: true,
      data: {
        data: updatedPost
      }
    });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'Error adding reply' });
  }
};

// Toggle like on a reply
exports.toggleReplyLike = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;

    if (!validateObjectId(postId) || !validateObjectId(commentId) || !validateObjectId(replyId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    const likeIndex = reply.likes.indexOf(req.user._id);
    const isLiking = likeIndex === -1;

    if (isLiking) {
      reply.likes.push(req.user._id);
    } else {
      reply.likes.splice(likeIndex, 1);
    }

    await post.save();

    // Create notification if user is liking the reply (not unliking)
    if (isLiking && reply.user.toString() !== req.user._id.toString()) {
      const notificationController = require('./notificationController');
      await notificationController.createNotification({
        recipient: reply.user,
        sender: req.user._id,
        type: 'like',
        post: post._id,
        comment: commentId,
        reply: replyId,
        message: 'liked your reply'
      }, req);
    }

    // Return the updated post with populated data
    const updatedPost = await Post.findById(postId)
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage')
      .populate('comments.likes', 'name profileImage')
      .populate('comments.replies.user', 'name profileImage')
      .populate('comments.replies.likes', 'name profileImage');

    // Return consistent response format
    return res.json({
      success: true,
      data: {
        data: updatedPost
      }
    });
  } catch (error) {
    console.error('Toggle reply like error:', error);
    res.status(500).json({ message: 'Error toggling reply like' });
  }
};

// Toggle bookmark status for a post
exports.toggleBookmark = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has already bookmarked the post (check in post.bookmarks)
    const isBookmarked = post.bookmarks && post.bookmarks.includes(userId);
    
    // Check if post ID exists in user.bookmarkedPosts
    const hasBookmarkedPost = user.bookmarkedPosts && user.bookmarkedPosts.includes(postId);

    // Toggle bookmark in both collections for consistency
    if (isBookmarked || hasBookmarkedPost) {
      // Remove bookmark
      await Post.findByIdAndUpdate(postId, {
        $pull: { bookmarks: userId }
      });
      
      await User.findByIdAndUpdate(userId, {
        $pull: { bookmarkedPosts: postId }
      });
      
      return res.json({
        success: true,
        isBookmarked: false,
        message: 'Post removed from bookmarks'
      });
    } else {
      // Add bookmark
      await Post.findByIdAndUpdate(postId, {
        $addToSet: { bookmarks: userId }
      });
      
      await User.findByIdAndUpdate(userId, {
        $addToSet: { bookmarkedPosts: postId }
      });
      
      return res.json({
        success: true,
        isBookmarked: true,
        message: 'Post added to bookmarks'
      });
    }
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({ 
      message: 'Error toggling bookmark', 
      error: error.message 
    });
  }
};

// Get all posts for the feed (with options for following only)
exports.getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, followingOnly = false, excludeOwn = false } = req.query;
    const userId = req.user._id;

    // Build query based on parameters
    const query = {};
    
    // If followingOnly is true, only get posts from users the current user follows
    if (followingOnly === 'true') {
      // Get the list of users the current user follows
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      query.user = { $in: user.following };
    }
    
    // If excludeOwn is true, exclude the current user's posts
    if (excludeOwn === 'true') {
      query.user = { ...query.user, $ne: userId };
    }

    // Get posts with pagination
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage');

    // Get total count for pagination
    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: posts,
      pagination: {
        total,
        pages: Math.ceil(total / parseInt(limit)),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all posts error:', error);
    res.status(500).json({ 
      message: 'Error fetching posts', 
      error: error.message 
    });
  }
};

// Get bookmarked posts for the current user
exports.getBookmarkedPosts = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const userId = req.user._id;
    
    // Find the user first to get their bookmarkedPosts
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // If user has no bookmarked posts, return empty array
    if (!user.bookmarkedPosts || user.bookmarkedPosts.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        pages: 0,
        currentPage: parseInt(page)
      });
    }
    
    // Find posts by ID from the user's bookmarkedPosts array
    const bookmarkedPosts = await Post.find({ 
      _id: { $in: user.bookmarkedPosts }
    })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage');
    
    // Get total count for pagination
    const total = user.bookmarkedPosts.length;
    
    res.json({
      success: true,
      data: bookmarkedPosts,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get bookmarked posts error:', error);
    res.status(500).json({ 
      message: 'Error fetching bookmarked posts', 
      error: error.message 
    });
  }
};

// Get bookmarked post IDs for the current user
exports.getBookmarkedPostIds = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find the user to get their bookmarkedPosts
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Return the bookmarkedPosts array or empty array if it doesn't exist
    const bookmarkedIds = user.bookmarkedPosts || [];
    
    res.json({
      success: true,
      data: bookmarkedIds
    });
  } catch (error) {
    console.error('Get bookmarked post IDs error:', error);
    res.status(500).json({ 
      message: 'Error fetching bookmarked post IDs', 
      error: error.message 
    });
  }
};

// Cancel post upload and delete uploaded images
exports.cancelUpload = async (req, res) => {
  try {
    const { imageIds } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No image IDs provided for deletion' 
      });
    }

    console.log(`Attempting to delete ${imageIds.length} images from Cloudinary`);
    
    // Delete each image from Cloudinary
    const deleteResults = [];
    for (const imageId of imageIds) {
      try {
        const result = await deleteFromCloudinary(imageId);
        deleteResults.push({
          imageId,
          success: true,
          result
        });
        console.log(`Successfully deleted image: ${imageId}`);
      } catch (deleteError) {
        console.error(`Error deleting image ${imageId}:`, deleteError);
        deleteResults.push({
          imageId,
          success: false,
          error: deleteError.message
        });
      }
    }
    
    // Return success even if some deletions failed
    // This ensures the client can continue
    res.status(200).json({
      success: true,
      message: 'Upload cancelled and images cleaned up',
      results: deleteResults
    });
  } catch (error) {
    console.error('Cancel upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error cancelling upload',
      error: error.message 
    });
  }
};

// Utility function to ensure temp directory exists
const ensureTempDir = () => {
  const tempDir = path.join(__dirname, '..', 'temp', 'uploads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
};

// Upload image to temporary directory
exports.uploadTempImage = async (req, res) => {
  try {
    // Check if we have files
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }

    const image = req.files.image;
    const sessionId = req.body.sessionId || uuid();
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(image.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      });
    }
    
    // Validate file size (max 10MB per image)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (image.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'Image too large. Maximum size is 10MB.'
      });
    }
    
    // Create temp directory if it doesn't exist
    const tempDir = ensureTempDir();
    const userTempDir = path.join(tempDir, req.user._id.toString(), sessionId);
    
    if (!fs.existsSync(userTempDir)) {
      fs.mkdirSync(userTempDir, { recursive: true });
    }
    
    // Generate unique filename
    const filename = `${Date.now()}-${image.name.replace(/\s/g, '_')}`;
    const filePath = path.join(userTempDir, filename);
    
    // Move the file to temp directory
    await image.mv(filePath);
    
    // Return success with file info
    res.status(200).json({
      success: true,
      message: 'Image uploaded to temporary storage',
      data: {
        sessionId,
        filename,
        path: filePath,
        size: image.size,
        mimetype: image.mimetype
      }
    });
  } catch (error) {
    console.error('Error uploading temporary image:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image to temporary storage',
      error: error.message
    });
  }
};

// Create post from temporary images
exports.createPostFromTemp = async (req, res) => {
  try {
    const { sessionId, caption, tags } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    // Get user's temp directory
    const tempDir = ensureTempDir();
    const userTempDir = path.join(tempDir, req.user._id.toString(), sessionId);
    
    // Check if directory exists
    if (!fs.existsSync(userTempDir)) {
      return res.status(404).json({
        success: false,
        message: 'No uploaded images found for this session'
      });
    }
    
    // Get all files in the temp directory
    const files = fs.readdirSync(userTempDir);
    
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images found in temporary storage'
      });
    }
    
    // Upload each image to Cloudinary
    const uploadResults = [];
    for (const file of files) {
      const filePath = path.join(userTempDir, file);
      try {
        // Upload to Cloudinary using the file path
        const result = await uploadToCloudinary(filePath, true); // true indicates it's a file path
        uploadResults.push(result);
      } catch (uploadError) {
        console.error(`Error uploading ${file} to Cloudinary:`, uploadError);
        // Continue with other files even if one fails
      }
    }
    
    if (uploadResults.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload images to cloud storage'
      });
    }
    
    // Parse tags
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        if (!Array.isArray(parsedTags)) {
          parsedTags = [parsedTags.toString()];
        }
      } catch (parseError) {
        console.log('Tags parsing error, using as string:', parseError.message);
        parsedTags = tags ? [tags.toString()] : [];
      }
    }
    
    // Create post with multiple images
    const moreThanOneImage = uploadResults.length > 1;
    
    // Create post object
    const postData = {
      user: req.user._id,
      image: uploadResults[0].secure_url, // First image as main image
      imageId: uploadResults[0].public_id,
      images: uploadResults.map(result => result.secure_url),
      imageIds: uploadResults.map(result => result.public_id),
      caption,
      tags: parsedTags,
      moreThanOneImage,
      isVideo: false
    };
    
    // Create the post in database
    const post = await Post.create(postData);
    
    // Update user's post count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { posts: 1 }
    });
    
    // Clean up temp directory
    try {
      fs.rmSync(userTempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up temp directory:', cleanupError);
      // Don't fail if cleanup fails
    }
    
    res.status(201).json({
      success: true,
      data: post,
      message: 'Post created successfully'
    });
  } catch (error) {
    console.error('Create post from temp error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating post',
      error: error.message
    });
  }
};

// Clean up temporary files if post creation is cancelled
exports.cleanupTempFiles = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    // Get user's temp directory
    const tempDir = ensureTempDir();
    const userTempDir = path.join(tempDir, req.user._id.toString(), sessionId);
    
    // Check if directory exists and delete it
    if (fs.existsSync(userTempDir)) {
      fs.rmSync(userTempDir, { recursive: true, force: true });
    }
    
    res.status(200).json({
      success: true,
      message: 'Temporary files cleaned up successfully'
    });
  } catch (error) {
    console.error('Cleanup temp files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning up temporary files',
      error: error.message
    });
  }
};

// Get like status of a post
exports.getLikeStatus = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid post ID' 
      });
    }

    // Find the post
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    // Check if user is in the likes array
    const isLiked = post.likes.includes(userId);

    return res.status(200).json({
      success: true,
      isLiked
    });
  } catch (error) {
    console.error('Error checking like status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while checking like status'
    });
  }
};

// Get bookmark status of a post
exports.getBookmarkStatus = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid post ID' 
      });
    }

    // Find the user to check their bookmarks
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if post is in the user's bookmarkedPosts array
    const isBookmarked = user.bookmarkedPosts && user.bookmarkedPosts.includes(postId);

    return res.status(200).json({
      success: true,
      isBookmarked: isBookmarked || false
    });
  } catch (error) {
    console.error('Error checking bookmark status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while checking bookmark status'
    });
  }
};

// Get users who liked a post
exports.getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!validateObjectId(postId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid post ID' 
      });
    }

    // Find the post and populate likes with user information
    const post = await Post.findById(postId)
      .populate('likes', 'name username profileImage');
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    // Return the list of users who liked the post
    return res.status(200).json({
      success: true,
      users: post.likes
    });
  } catch (error) {
    console.error('Error getting post likes:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while getting likes'
    });
  }
};

// Get the full exports list
module.exports = {
  createPost: exports.createPost,
  getUserPosts: exports.getUserPosts,
  getPost: exports.getPost,
  deletePost: exports.deletePost,
  toggleLike: exports.toggleLike,
  addComment: exports.addComment,
  getAllPosts: exports.getAllPosts,
  toggleCommentLike: exports.toggleCommentLike,
  addCommentReply: exports.addCommentReply,
  toggleReplyLike: exports.toggleReplyLike,
  toggleBookmark: exports.toggleBookmark,
  getBookmarkedPosts: exports.getBookmarkedPosts,
  getBookmarkedPostIds: exports.getBookmarkedPostIds,
  cancelUpload: exports.cancelUpload,
  uploadTempImage: exports.uploadTempImage,
  createPostFromTemp: exports.createPostFromTemp,
  cleanupTempFiles: exports.cleanupTempFiles,
  getLikeStatus: exports.getLikeStatus,
  getBookmarkStatus: exports.getBookmarkStatus,
  getPostLikes: exports.getPostLikes
};

// Log the exports to see if any are undefined
console.log('Exports check in postController.js:');
console.log('createPost:', typeof exports.createPost);
console.log('getUserPosts:', typeof exports.getUserPosts);
console.log('getPost:', typeof exports.getPost);
console.log('deletePost:', typeof exports.deletePost);
console.log('toggleLike:', typeof exports.toggleLike);
console.log('addComment:', typeof exports.addComment);
console.log('getAllPosts:', typeof exports.getAllPosts);
console.log('toggleCommentLike:', typeof exports.toggleCommentLike);
console.log('addCommentReply:', typeof exports.addCommentReply);
console.log('toggleReplyLike:', typeof exports.toggleReplyLike);
console.log('toggleBookmark:', typeof exports.toggleBookmark);
console.log('getBookmarkedPosts:', typeof exports.getBookmarkedPosts);
console.log('getBookmarkedPostIds:', typeof exports.getBookmarkedPostIds);
console.log('cancelUpload:', typeof exports.cancelUpload);
console.log('uploadTempImage:', typeof exports.uploadTempImage);
console.log('createPostFromTemp:', typeof exports.createPostFromTemp);
console.log('cleanupTempFiles:', typeof exports.cleanupTempFiles);
console.log('getLikeStatus:', typeof exports.getLikeStatus);
console.log('getBookmarkStatus:', typeof exports.getBookmarkStatus);
console.log('getPostLikes:', typeof exports.getPostLikes); 