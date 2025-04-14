const User = require('../models/User');
const notificationController = require('./notificationController');

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
const followUser = async (req, res) => {
  try {
    const userToFollowId = req.params.id;
    const currentUserId = req.user._id;
    
    const userToFollow = await User.findById(userToFollowId);
    
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is trying to follow themselves
    if (currentUserId.toString() === userToFollowId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    
    // Get current user with populated followingRef
    const currentUser = await User.findById(currentUserId);
    
    // Check if already following
    if (currentUser.followingRef.includes(userToFollowId)) {
      return res.status(400).json({ message: 'You are already following this user' });
    }
    
    // Update current user's following list
    await User.findByIdAndUpdate(currentUserId, {
      $push: { followingRef: userToFollowId },
      $inc: { following: 1 }
    });
    
    // Update target user's followers list
    await User.findByIdAndUpdate(userToFollowId, {
      $push: { followersRef: currentUserId },
      $inc: { followers: 1 }
    });
    
    // Create a follow notification
    await notificationController.createNotification({
      recipient: userToFollowId,
      sender: currentUserId,
      type: 'follow',
      message: 'started following you'
    }, req);
    
    res.status(200).json({ 
      message: `You are now following ${userToFollow.name}`,
      success: true
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
// @access  Private
const unfollowUser = async (req, res) => {
  try {
    const userToUnfollowId = req.params.id;
    const currentUserId = req.user._id;
    
    const userToUnfollow = await User.findById(userToUnfollowId);
    
    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get current user with populated followingRef
    const currentUser = await User.findById(currentUserId);
    
    // Check if user is actually following the target
    if (!currentUser.followingRef.includes(userToUnfollowId)) {
      return res.status(400).json({ message: 'You are not following this user' });
    }
    
    // Update current user's following list
    await User.findByIdAndUpdate(currentUserId, {
      $pull: { followingRef: userToUnfollowId },
      $inc: { following: -1 }
    });
    
    // Update target user's followers list
    await User.findByIdAndUpdate(userToUnfollowId, {
      $pull: { followersRef: currentUserId },
      $inc: { followers: -1 }
    });
    
    res.status(200).json({ 
      message: `You have unfollowed ${userToUnfollow.name}`,
      success: true
    });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's followers
// @route   GET /api/users/:id/followers
// @access  Private
const getUserFollowers = async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user._id;
    
    // Find the user and populate followers
    const user = await User.findById(userId)
      .populate('followersRef', 'name fullName avatar profileImage username')
      .lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get the list of users that the current user is following
    const currentUser = await User.findById(currentUserId).lean();
    const currentUserFollowing = currentUser ? currentUser.followingRef.map(id => id.toString()) : [];
    
    // Format follower list and check if current user follows each follower
    const followersList = await Promise.all(user.followersRef.map(async follower => {
      // Check if the current user is following this follower
      const isFollowing = currentUserFollowing.includes(follower._id.toString());
      
      return {
        _id: follower._id,
        name: follower.name,
        username: follower.username || follower.name,
        fullName: follower.fullName,
        profileImage: follower.profileImage || follower.avatar,
        isFollowing: isFollowing,
        isCurrentUser: follower._id.toString() === currentUserId.toString()
      };
    }));
    
    res.status(200).json({ 
      followers: followersList,
      count: followersList.length
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get users that a user is following
// @route   GET /api/users/:id/following
// @access  Private
const getUserFollowing = async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user._id;
    
    // Find the user and populate following
    const user = await User.findById(userId)
      .populate('followingRef', 'name fullName avatar profileImage username')
      .lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get the list of users that the current user is following
    const currentUser = await User.findById(currentUserId).lean();
    const currentUserFollowing = currentUser ? currentUser.followingRef.map(id => id.toString()) : [];
    
    // Format following list and check if current user follows each user
    const followingList = await Promise.all(user.followingRef.map(async following => {
      // Check if the current user is following this user
      const isFollowing = currentUserFollowing.includes(following._id.toString());
      
      return {
        _id: following._id,
        name: following.name,
        username: following.username || following.name,
        fullName: following.fullName,
        profileImage: following.profileImage || following.avatar,
        isFollowing: isFollowing,
        isCurrentUser: following._id.toString() === currentUserId.toString()
      };
    }));
    
    res.status(200).json({ 
      following: followingList,
      count: followingList.length
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Check if user is following another user
// @route   GET /api/users/:id/following/check
// @access  Private
const checkFollowing = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;
    
    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const isFollowing = currentUser.followingRef.includes(targetUserId);
    
    res.status(200).json({ isFollowing });
  } catch (error) {
    console.error('Check following error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get suggested users to follow
// @route   GET /api/users/suggested
// @access  Private
const getSuggestedUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get list of users the current user is already following
    const followingIds = [...currentUser.followingRef, currentUserId];
    
    // Find users not being followed, limit to 10 random users
    const suggestedUsers = await User.aggregate([
      { $match: { _id: { $nin: followingIds } } },
      { $project: { name: 1, fullName: 1, profileImage: 1, avatar: 1, followers: 1, bio: 1 } },
      { $sample: { size: 10 } }
    ]);
    
    res.status(200).json({ 
      users: suggestedUsers,
      count: suggestedUsers.length
    });
  } catch (error) {
    console.error('Get suggested users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get friend-based suggestions (users that your friends follow)
// @route   GET /api/follows/friend-suggestions
// @access  Private
const getFriendBasedSuggestions = async (req, res) => {
  try {
    console.log('getFriendBasedSuggestions called');
    
    const currentUserId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;
    
    // Find current user and populate their following
    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log(`Found user: ${currentUser.name}, getting friend suggestions`);
    
    // Get users the current user is following (their friends)
    const following = currentUser.followingRef;
    
    // Get IDs of users the current user is already following
    const alreadyFollowing = [...following, currentUserId]; // Include self
    
    // If the user isn't following anyone yet, return regular suggestions
    if (following.length === 0) {
      console.log('User has no friends yet, falling back to regular suggestions');
      return getSuggestedUsers(req, res);
    }
    
    // Find the followers of each person the user follows
    const usersFriendsFollow = await User.aggregate([
      // Find users the current user follows
      { $match: { _id: { $in: following } } },
      // Lookup their following connections
      { $lookup: {
          from: 'users',
          localField: 'followingRef',
          foreignField: '_id',
          as: 'friendsFollowing'
      }},
      // Unwind the array to get individual users
      { $unwind: '$friendsFollowing' },
      // Filter out users the current user already follows and themselves
      { $match: { 'friendsFollowing._id': { $nin: alreadyFollowing } } },
      // Group by the suggested user, counting how many of user's friends follow them
      { $group: {
          _id: '$friendsFollowing._id',
          user: { $first: '$friendsFollowing' },
          mutualFriendsCount: { $sum: 1 },
          mutualFriends: { $push: { _id: '$_id', name: '$name', username: '$username' } }
      }},
      // Sort by number of mutual connections (most popular first)
      { $sort: { mutualFriendsCount: -1 } },
      // Limit to requested number
      { $limit: limit },
      // Project only the fields we need
      { $project: {
          _id: '$user._id',
          name: '$user.name',
          username: '$user.username',
          fullName: '$user.fullName',
          profileImage: '$user.profileImage',
          bio: '$user.bio',
          mutualFriendsCount: 1,
          mutualFriends: { $slice: ['$mutualFriends', 3] } // Just keep top 3 mutual friends
      }}
    ]);
    
    // If we don't have enough results, pad with regular suggestions
    let result = usersFriendsFollow;
    
    if (result.length < limit) {
      // Calculate how many more suggestions we need
      const remainingNeeded = limit - result.length;
      
      // Get IDs of users we already have in our results
      const existingIds = [...alreadyFollowing, ...result.map(u => u._id)];
      
      // Find additional random users not in our results
      const additionalUsers = await User.aggregate([
        { $match: { _id: { $nin: existingIds } } },
        { $project: { name: 1, username: 1, fullName: 1, profileImage: 1, bio: 1 } },
        { $sample: { size: remainingNeeded } }
      ]);
      
      // Add these to our results
      result = [...result, ...additionalUsers];
    }
    
    console.log(`Returning ${result.length} friend-based suggestions`);
    
    // Use the same response structure as getSuggestedUsers
    res.status(200).json({
      users: result,
      count: result.length
    });
  } catch (error) {
    console.error('Get friend-based suggestions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
  checkFollowing,
  getSuggestedUsers,
  getFriendBasedSuggestions
}; 