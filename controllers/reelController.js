const Reel = require('../models/Reel');
const User = require('../models/User');
const { validateObjectId } = require('../utils/validation');
const { uploadVideoToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// Create a new reel
exports.createReel = async (req, res) => {
  try {
    const { title, caption, tags, isPrivate, allowComments, allowDuets, audioTrack } = req.body;
    
    // Enhanced logging for debugging
    console.log('Reel creation request received:');
    console.log('- Body fields:', Object.keys(req.body));
    console.log('- Files received:', req.files ? Object.keys(req.files) : 'None');
    
    // Check if video file exists in different possible locations
    let videoFile = null;
    
    if (req.files && req.files.video) {
      videoFile = req.files.video;
      console.log('Video found in req.files.video');
    } else if (req.files && Object.keys(req.files).length > 0) {
      // Try to find the video in any other field
      const fileKeys = Object.keys(req.files);
      videoFile = req.files[fileKeys[0]];
      console.log(`Video possibly found in alternative field: ${fileKeys[0]}`);
    }
    
    if (!videoFile) {
      console.error('No video file found in request');
      return res.status(400).json({ message: 'Please provide a video file' });
    }

    // Log video details for debugging
    console.log(`Processing reel video: ${videoFile.name}, Size: ${videoFile.size}, Type: ${videoFile.mimetype}`);

    // Check file size limit (50MB for videos)
    const fileSizeMB = videoFile.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      return res.status(413).json({ message: 'Video is too large. Maximum size is 50MB.' });
    }

    // Upload video to cloud storage
    let uploadResult;
    try {
      uploadResult = await uploadVideoToCloudinary(videoFile);
      console.log('Video uploaded successfully:', uploadResult.public_id);
    } catch (uploadError) {
      console.error('Upload to cloud storage failed:', uploadError);
      
      // Provide more specific error messages based on error type
      if (uploadError.message.includes('streaming profile')) {
        return res.status(500).json({ 
          message: 'Error processing video format. Please try with a different video format or encoding.',
          error: uploadError.message 
        });
      } else if (uploadError.message.includes('transformation')) {
        return res.status(500).json({ 
          message: 'Invalid video transformation. Please try with a different video.',
          error: uploadError.message 
        });
      } else if (uploadError.message.includes('timeout')) {
        return res.status(500).json({ 
          message: 'Upload timeout. Please try with a smaller video file.',
          error: uploadError.message 
        });
      }
      
      // Generic error message for other cases
      return res.status(500).json({ 
        message: 'Error uploading video. Please try with a smaller file.',
        error: uploadError.message 
      });
    }

    // Parse JSON strings if needed
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

    let parsedAudioTrack = null;
    if (audioTrack) {
      try {
        parsedAudioTrack = typeof audioTrack === 'string' ? JSON.parse(audioTrack) : audioTrack;
      } catch (parseError) {
        console.log('AudioTrack parsing error:', parseError.message);
      }
    }

    // Convert string boolean values to actual booleans
    const isReelPrivate = isPrivate === 'true' || isPrivate === true;
    const allowReelComments = allowComments !== 'false' && allowComments !== false;
    const allowReelDuets = allowDuets !== 'false' && allowDuets !== false;

    // Create the reel
    const reel = await Reel.create({
      user: req.user._id,
      videoUrl: uploadResult.secure_url,
      videoId: uploadResult.public_id,
      thumbnailUrl: uploadResult.thumbnail_url || '',
      title: title || '',
      caption: caption || '',
      tags: parsedTags,
      isPrivate: isReelPrivate,
      allowComments: allowReelComments,
      allowDuets: allowReelDuets,
      audioTrack: parsedAudioTrack,
      duration: uploadResult.duration || 0
    });

    // Update user's reel count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { reels: 1 }
    });

    res.status(201).json({
      success: true,
      data: reel
    });
  } catch (error) {
    console.error('Create reel error:', error);
    res.status(500).json({ 
      message: 'Error creating reel', 
      error: error.message 
    });
  }
};

// Get reels (for feed or discovery)
exports.getReels = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    
    // Build filter object (exclude private reels for non-owners)
    const filter = { isPrivate: false };
    
    // Add userId filter if provided
    if (req.query.userId && validateObjectId(req.query.userId)) {
      filter.user = req.query.userId;
    }
    
    console.log(`Fetching reels, page ${pageNumber}, limit ${limitNumber}, filters:`, filter);
    
    // Count total documents
    const total = await Reel.countDocuments(filter);
    console.log(`Found ${total} total reels matching filter`);
    
    // Find reels with pagination
    const reels = await Reel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate('user', 'name username avatar')
      .lean();
    
    // Log reels returned information (only first few)
    console.log(`Returning ${reels.length} reels, first few:`, reels.slice(0, 2).map(reel => ({
      id: reel._id,
      title: reel.title,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      username: reel.user?.name || 'Unknown'
    })));
    
    // Calculate total pages
    const totalPages = Math.ceil(total / limitNumber);
    
    res.status(200).json({
      success: true,
      data: reels,
      pagination: {
        total,
        page: pageNumber,
        pages: totalPages,
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Get reels error:', error);
    res.status(500).json({
      message: 'Error fetching reels',
      error: error.message
    });
  }
};

// Get a single reel by ID
exports.getReel = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid reel ID' });
    }
    
    const reel = await Reel.findById(id)
      .populate('user', 'name username avatar')
      .populate('comments.user', 'name username avatar');
    
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    // Check if the reel is private and not owned by the requesting user
    if (reel.isPrivate && (!req.user || req.user._id.toString() !== reel.user._id.toString())) {
      return res.status(403).json({ message: 'This reel is private' });
    }
    
    // Increment view count
    reel.views += 1;
    await reel.save();
    
    res.status(200).json({
      success: true,
      data: reel
    });
  } catch (error) {
    console.error('Get reel error:', error);
    res.status(500).json({
      message: 'Error fetching reel',
      error: error.message
    });
  }
};

// Get reels by user ID
exports.getUserReels = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 12 } = req.query;
    
    if (!validateObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    
    // Build filter object
    const filter = { user: userId };
    
    // Show private reels only to the owner
    if (!req.user || req.user._id.toString() !== userId) {
      filter.isPrivate = false;
    }
    
    const total = await Reel.countDocuments(filter);
    
    const reels = await Reel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate('user', 'name username avatar')
      .lean();
    
    const totalPages = Math.ceil(total / limitNumber);
    
    res.status(200).json({
      success: true,
      data: reels,
      pagination: {
        total,
        page: pageNumber,
        pages: totalPages,
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Get user reels error:', error);
    res.status(500).json({
      message: 'Error fetching user reels',
      error: error.message
    });
  }
};

// Delete a reel
exports.deleteReel = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid reel ID' });
    }
    
    const reel = await Reel.findById(id);
    
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    // Check ownership
    if (reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own reels' });
    }
    
    // Delete video from cloud storage
    if (reel.videoId) {
      try {
        await deleteFromCloudinary(reel.videoId, 'video');
      } catch (deleteError) {
        console.error('Error deleting video from cloud storage:', deleteError);
        // Continue with deletion even if cloud storage deletion fails
      }
    }
    
    // Delete the reel
    await reel.remove();
    
    // Update user's reel count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { reels: -1 }
    });
    
    res.status(200).json({
      success: true,
      message: 'Reel deleted successfully'
    });
  } catch (error) {
    console.error('Delete reel error:', error);
    res.status(500).json({
      message: 'Error deleting reel',
      error: error.message
    });
  }
};

// Toggle like on a reel
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid reel ID' });
    }
    
    const reel = await Reel.findById(id);
    
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    // Check if reel is private and not owned by the user
    if (reel.isPrivate && reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'This reel is private' });
    }
    
    // Check if the user has already liked
    const likeIndex = reel.likes.findIndex(like => like.toString() === req.user._id.toString());
    let liked = false;
    
    if (likeIndex > -1) {
      // Unlike
      reel.likes.splice(likeIndex, 1);
    } else {
      // Like
      reel.likes.push(req.user._id);
      liked = true;
    }
    
    await reel.save();
    
    // Create notification for like
    const notificationController = require('./notificationController');
    await notificationController.createNotification({
      recipient: reel.user,
      sender: req.user._id,
      type: 'like',
      message: 'liked your reel',
      reel: reel._id
    }, req);
    
    res.status(200).json({
      success: true,
      liked,
      likeCount: reel.likes.length
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      message: 'Error toggling like',
      error: error.message
    });
  }
};

// Add a comment to a reel
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid reel ID' });
    }
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    
    const reel = await Reel.findById(id);
    
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    // Check if reel is private and not owned by the user
    if (reel.isPrivate && reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'This reel is private' });
    }
    
    // Check if comments are allowed
    if (!reel.allowComments) {
      return res.status(403).json({ message: 'Comments are disabled for this reel' });
    }
    
    const comment = {
      user: req.user._id,
      text: text.trim(),
      createdAt: Date.now(),
      likes: [],
      replies: []
    };
    
    reel.comments.push(comment);
    await reel.save();
    
    // Create notification for comment
    const notificationController = require('./notificationController');
    await notificationController.createNotification({
      recipient: reel.user,
      sender: req.user._id,
      type: 'comment',
      message: `commented: "${comment.text.substring(0, 50)}${comment.text.length > 50 ? '...' : ''}"`,
      reel: reel._id,
      comment: comment._id
    }, req);
    
    // Populate the newly added comment
    const populatedReel = await Reel.findById(id)
      .populate('comments.user', 'name username avatar')
      .populate('comments.likes', 'name username avatar')
      .populate('comments.replies.user', 'name username avatar')
      .populate('comments.replies.likes', 'name username avatar');
    
    const newComment = populatedReel.comments[populatedReel.comments.length - 1];
    
    res.status(201).json({
      success: true,
      data: newComment,
      commentCount: populatedReel.comments.length
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      message: 'Error adding comment',
      error: error.message
    });
  }
};

// Toggle like on a comment
exports.toggleCommentLike = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    
    if (!validateObjectId(id) || !validateObjectId(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    const comment = reel.comments.id(commentId);
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
    
    await reel.save();
    
    // Create notification if user is liking the comment (not unliking)
    const notificationController = require('./notificationController');
    await notificationController.createNotification({
      recipient: comment.user,
      sender: req.user._id,
      type: 'like',
      message: 'liked your comment',
      reel: reel._id,
      comment: commentId
    }, req);
    
    // Return the updated reel with populated data
    const updatedReel = await Reel.findById(id)
      .populate('comments.user', 'name username avatar')
      .populate('comments.likes', 'name username avatar')
      .populate('comments.replies.user', 'name username avatar')
      .populate('comments.replies.likes', 'name username avatar');
    
    const updatedComment = updatedReel.comments.id(commentId);
    
    res.status(200).json({
      success: true,
      data: updatedComment
    });
  } catch (error) {
    console.error('Toggle comment like error:', error);
    res.status(500).json({
      message: 'Error toggling comment like',
      error: error.message
    });
  }
};

// Add reply to a comment
exports.addCommentReply = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;
    
    if (!validateObjectId(id) || !validateObjectId(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Reply text is required' });
    }
    
    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    const comment = reel.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    const reply = {
      user: req.user._id,
      text: text.trim(),
      createdAt: Date.now(),
      likes: []
    };
    
    comment.replies.push(reply);
    await reel.save();
    
    // Create notification for comment reply
    const notificationController = require('./notificationController');
    await notificationController.createNotification({
      recipient: comment.user,
      sender: req.user._id,
      type: 'reply',
      message: `replied to your comment: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      reel: reel._id,
      comment: commentId,
      reply: comment.replies[comment.replies.length - 1]._id
    }, req);
    
    // Return the updated reel with populated data
    const updatedReel = await Reel.findById(id)
      .populate('comments.user', 'name username avatar')
      .populate('comments.likes', 'name username avatar')
      .populate('comments.replies.user', 'name username avatar')
      .populate('comments.replies.likes', 'name username avatar');
    
    const updatedComment = updatedReel.comments.id(commentId);
    
    res.status(201).json({
      success: true,
      data: updatedComment
    });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({
      message: 'Error adding reply',
      error: error.message
    });
  }
};

// Toggle like on a reply
exports.toggleReplyLike = async (req, res) => {
  try {
    const { id, commentId, replyId } = req.params;
    
    if (!validateObjectId(id) || !validateObjectId(commentId) || !validateObjectId(replyId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    const comment = reel.comments.id(commentId);
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
    
    await reel.save();
    
    // Create notification if user is liking the reply (not unliking)
    const notificationController = require('./notificationController');
    await notificationController.createNotification({
      recipient: reply.user,
      sender: req.user._id,
      type: 'like',
      message: 'liked your reply',
      reel: reel._id,
      comment: commentId,
      reply: replyId
    }, req);
    
    // Return the updated reel with populated data
    const updatedReel = await Reel.findById(id)
      .populate('comments.user', 'name username avatar')
      .populate('comments.likes', 'name username avatar')
      .populate('comments.replies.user', 'name username avatar')
      .populate('comments.replies.likes', 'name username avatar');
    
    const updatedComment = updatedReel.comments.id(commentId);
    
    res.status(200).json({
      success: true,
      data: updatedComment
    });
  } catch (error) {
    console.error('Toggle reply like error:', error);
    res.status(500).json({
      message: 'Error toggling reply like',
      error: error.message
    });
  }
};

// Get comments for a reel
exports.getComments = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: 'Invalid reel ID' });
    }
    
    const reel = await Reel.findById(id)
      .select('comments allowComments isPrivate user')
      .populate('comments.user', 'name username avatar')
      .lean();
    
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    // Check if reel is private and not owned by the user
    const isOwner = req.user && req.user._id.toString() === reel.user.toString();
    if (reel.isPrivate && !isOwner) {
      return res.status(403).json({ message: 'This reel is private' });
    }
    
    // Sort comments by newest first
    const sortedComments = reel.comments.sort((a, b) => b.createdAt - a.createdAt);
    
    res.status(200).json({
      success: true,
      data: sortedComments,
      allowComments: reel.allowComments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      message: 'Error fetching comments',
      error: error.message
    });
  }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    
    if (!validateObjectId(id) || !validateObjectId(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const reel = await Reel.findById(id);
    
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    
    // Find the comment
    const comment = reel.comments.id(commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is authorized to delete the comment (comment owner or reel owner)
    if (comment.user.toString() !== req.user._id.toString() && 
        reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }
    
    // Remove the comment
    comment.remove();
    await reel.save();
    
    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      message: 'Error deleting comment',
      error: error.message
    });
  }
}; 