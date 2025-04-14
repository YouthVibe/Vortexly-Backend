const Story = require('../models/Story');
const User = require('../models/User');
const { validateObjectId } = require('../utils/validation');
const { uploadToCloudinary, uploadVideoToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// Create a new story
exports.createStory = async (req, res) => {
  try {
    const { caption } = req.body;
    const imageFile = req.files?.image;
    const videoFile = req.files?.video;

    // Validate file input
    if (!imageFile && !videoFile) {
      return res.status(400).json({ message: 'Please provide an image or video' });
    }

    // Determine media type and handle upload
    let uploadResult;
    let mediaType = 'image';

    if (videoFile) {
      // Check file size (limit to 50MB)
      if (videoFile.size > 50 * 1024 * 1024) {
        return res.status(413).json({ message: 'Video is too large. Maximum size is 50MB.' });
      }
      
      mediaType = 'video';
      uploadResult = await uploadVideoToCloudinary(videoFile);
    } else {
      // Check file size (limit to 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        return res.status(413).json({ message: 'Image is too large. Maximum size is 10MB.' });
      }
      
      uploadResult = await uploadToCloudinary(imageFile);
    }

    // Create story in database
    const story = await Story.create({
      user: req.user._id,
      media: uploadResult.secure_url,
      mediaId: uploadResult.public_id,
      mediaType,
      caption: caption || ''
    });

    // Update user's story count
    await User.findByIdAndUpdate(req.user._id, { 
      $inc: { activeStories: 1 } 
    });

    res.status(201).json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ 
      message: 'Error creating story', 
      error: error.message 
    });
  }
};

// Get stories of a specific user
exports.getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!validateObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Get stories created in the last 24 hours
    const stories = await Story.find({ 
      user: userId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
    .sort({ createdAt: 1 })
    .populate('user', 'name username profileImage');

    res.status(200).json({
      success: true,
      data: stories
    });
  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ 
      message: 'Error fetching stories', 
      error: error.message 
    });
  }
};

// Get a single story
exports.getStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!validateObjectId(storyId)) {
      return res.status(400).json({ message: 'Invalid story ID' });
    }

    const story = await Story.findById(storyId)
      .populate('user', 'name username profileImage')
      .populate('views', 'name username profileImage');

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    res.status(200).json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error('Get story error:', error);
    res.status(500).json({ 
      message: 'Error fetching story', 
      error: error.message 
    });
  }
};

// Delete a story
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!validateObjectId(storyId)) {
      return res.status(400).json({ message: 'Invalid story ID' });
    }

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user owns the story
    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this story' });
    }

    // Delete media from Cloudinary
    if (story.mediaId) {
      await deleteFromCloudinary(story.mediaId);
    }

    // Delete story from database
    await Story.findByIdAndDelete(storyId);

    // Update user's active stories count
    await User.findByIdAndUpdate(req.user._id, { 
      $inc: { activeStories: -1 } 
    });

    res.status(200).json({
      success: true,
      message: 'Story deleted successfully'
    });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ 
      message: 'Error deleting story', 
      error: error.message 
    });
  }
};

// View a story (mark as viewed)
exports.viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!validateObjectId(storyId)) {
      return res.status(400).json({ message: 'Invalid story ID' });
    }

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user has already viewed this story
    if (!story.views.includes(req.user._id)) {
      // Add user to views and increment viewCount
      await Story.findByIdAndUpdate(storyId, {
        $addToSet: { views: req.user._id },
        $inc: { viewCount: 1 }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Story viewed successfully'
    });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ 
      message: 'Error marking story as viewed', 
      error: error.message 
    });
  }
};

// Get stories feed (stories from followed users)
exports.getStoriesFeed = async (req, res) => {
  try {
    // Get list of users the current user follows
    const user = await User.findById(req.user._id).select('followingRef');
    const followingIds = user.followingRef || [];
    
    // Create a copy of the array and add current user to get their stories too
    const userIds = [...followingIds, req.user._id];

    // Get stories from followed users created in the last 24 hours
    const stories = await Story.find({
      user: { $in: userIds },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name username profileImage');

    // Group stories by user
    const groupedStories = stories.reduce((acc, story) => {
      const userId = story.user._id.toString();
      if (!acc[userId]) {
        acc[userId] = {
          user: story.user,
          stories: []
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    // Convert to array
    const result = Object.values(groupedStories);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get stories feed error:', error);
    res.status(500).json({ 
      message: 'Error fetching stories feed', 
      error: error.message 
    });
  }
}; 