const mongoose = require('mongoose');

// Define schema for message reactions
const reactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reaction: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Define schema for replied-to messages
const repliedToSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  content: String,
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

// Define schema for embedded messages
const messageSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
    required: true
  },
  // Message sender
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Message content (text)
  content: {
    type: String,
    default: ''
  },
  // Media content (image, video, etc.)
  media: {
    type: String,
    default: null
  },
  // Type of media
  mediaType: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', null],
    default: null
  },
  // Media metadata for rendering
  mediaWidth: Number,
  mediaHeight: Number,
  mediaDuration: Number,
  mediaThumbnail: String,
  
  // Flag to indicate if this message contains a post
  isPost: {
    type: Boolean,
    default: false
  },
  
  // ID of the post if this is a post message
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  
  // Reference to a message this message is replying to
  repliedTo: repliedToSchema,
  
  // Reactions to this message
  reactions: [reactionSchema],
  
  // Users who have read this message
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Timestamps for when each user read the message
  readReceipts: {
    type: Map,
    of: Date,
    default: {}
  },
  
  // Message delivery status
  deliveryStatus: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sending'
  },
  
  // System message flag
  isSystemMessage: {
    type: Boolean,
    default: false
  },
  
  // Message deleted flag
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // Message edited flag
  isEdited: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true, _id: false });

// Define the schema for a conversation
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  // Track unread message counts for each participant
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  // Track online status for each participant
  onlineStatus: {
    type: Map,
    of: Boolean,
    default: {}
  },
  // Track last online time for each participant
  lastOnline: {
    type: Map,
    of: Date,
    default: {}
  },
  // Track typing status for each participant
  isTyping: {
    type: Map,
    of: Boolean,
    default: {}
  },
  // Store message pagination info - which page each user has seen
  lastSeenPage: {
    type: Map,
    of: Number,
    default: {}
  },
  // Track when messages have been checked (read receipts)
  messageChecked: {
    type: Map,
    of: Date,
    default: {}
  },
  // Last message for preview purposes
  lastMessagePreview: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: Date,
    isPost: Boolean,
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    }
  },
  // Array to hold messages directly in the conversation document
  messages: [messageSchema],
  // Type of conversation (direct or group)
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  // User who created the conversation
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Group related fields
  groupName: {
    type: String,
    default: null
  },
  groupImage: {
    type: String,
    default: null
  },
  // Group administrators (for group chats)
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Total message count for this conversation
  totalMessages: {
    type: Number,
    default: 0
  }
}, { timestamps: true, collection: 'conversations' });

// Create an index for participants to quickly find conversations for a user
conversationSchema.index({ participants: 1 });

// Method to add a new message to the messages array and maintain the 100 message limit
conversationSchema.methods.addMessage = function(messageData) {
  // Create a new message with proper _id
  const newMessage = {
    _id: new mongoose.Types.ObjectId(),
    ...messageData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Add message to the array (newest messages are pushed into the array)
  this.messages.push(newMessage);
  
  // Keep only the latest 100 messages (remove oldest messages if over limit)
  if (this.messages.length > 100) {
    this.messages = this.messages.slice(this.messages.length - 100);
  }
  
  // Update lastMessagePreview
  this.lastMessagePreview = {
    content: newMessage.content,
    sender: newMessage.sender,
    createdAt: newMessage.createdAt,
    isPost: newMessage.isPost,
    postId: newMessage.postId
  };
  
  // Update total message count
  this.totalMessages += 1;
  
  // Update unreadCount for each participant
  this.participants.forEach(participant => {
    const participantId = participant.toString();
    if (participantId !== messageData.sender.toString()) {
      const currentCount = this.unreadCount.get(participantId) || 0;
      this.unreadCount.set(participantId, currentCount + 1);
    }
  });
  
  return newMessage;
};

// Method to mark messages as read by a specific user
conversationSchema.methods.markAsRead = function(userId) {
  if (!userId) return false;
  
  const userIdStr = userId.toString();
  
  // Reset unread count for this user
  this.unreadCount.set(userIdStr, 0);
  
  // Mark all messages as read by this user
  this.messages.forEach(message => {
    if (!message.readBy.some(id => id.toString() === userIdStr)) {
      message.readBy.push(userId);
      message.readReceipts.set(userIdStr, new Date());
      message.deliveryStatus = 'read';
    }
  });
  
  // Set message checked timestamp
  this.messageChecked.set(userIdStr, new Date());
  
  return true;
};

// Method to update a user's online status in the conversation
conversationSchema.methods.updateOnlineStatus = function(userId, isOnline) {
  if (!userId) return false;
  
  const userIdStr = userId.toString();
  
  // Update online status
  this.onlineStatus.set(userIdStr, isOnline);
  
  // Update last online time if going offline
  if (!isOnline) {
    this.lastOnline.set(userIdStr, new Date());
  }
  
  // Mark as modified to ensure it gets saved
  this.markModified('onlineStatus');
  this.markModified('lastOnline');
  
  return true;
};

// Method to find a conversation between specific users
conversationSchema.statics.findBetweenUsers = async function(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new Error('User IDs must be provided as an array');
  }
  
  // For exact matching: all users must be participants, and no additional users
  const conversation = await this.findOne({
    participants: { $size: userIds.length, $all: userIds }
  });
  
  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation; 