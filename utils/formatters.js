/**
 * Utility functions for formatting data for API responses
 */

/**
 * Format user online status information
 * @param {Object} user - User object with basic info
 * @param {Boolean} isOnline - Whether the user is online
 * @returns {Object} Formatted user status object
 */
const formatUserStatus = (user, isOnline) => {
  if (!user) {
    return {
      _id: null,
      isOnline: false,
      lastOnline: new Date()
    };
  }

  return {
    _id: user._id,
    name: user.name,
    fullName: user.fullName,
    profileImage: user.profileImage,
    isOnline: isOnline || false,
    lastOnline: isOnline ? null : new Date()
  };
};

/**
 * Format a conversation for the API response
 * @param {Object} conversation - Conversation object
 * @param {String} userId - Current user ID
 * @returns {Object} Formatted conversation object
 */
const formatConversation = (conversation, userId) => {
  if (!conversation) return null;
  
  // Get unread count for the current user
  const unreadCount = conversation.unreadCount?.[userId.toString()] || 0;
  
  // For direct messages, get the other user's info
  let otherUser = null;
  
  if (!conversation.isGroupChat) {
    // Find the other participant (not the current user)
    const otherParticipant = conversation.participants.find(
      participant => participant._id.toString() !== userId.toString()
    );
    
    if (otherParticipant) {
      otherUser = {
        _id: otherParticipant._id,
        name: otherParticipant.name,
        fullName: otherParticipant.fullName,
        profileImage: otherParticipant.profileImage
      };
    }
  }
  
  return {
    _id: conversation._id,
    participants: conversation.participants,
    isGroupChat: conversation.isGroupChat,
    groupName: conversation.groupName,
    groupAvatar: conversation.groupAvatar,
    lastMessage: conversation.lastMessagePreview ? {
      content: conversation.lastMessagePreview.content,
      sender: conversation.lastMessagePreview.sender,
      createdAt: conversation.lastMessagePreview.createdAt,
      isPost: conversation.lastMessagePreview.isPost || false,
      postId: conversation.lastMessagePreview.postId || null
    } : null,
    unreadCount,
    otherUser,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt
  };
};

module.exports = {
  formatUserStatus,
  formatConversation
}; 