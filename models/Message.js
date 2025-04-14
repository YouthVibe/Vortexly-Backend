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

// Define the Message schema
const messageSchema = new mongoose.Schema({
  // Conversation this message belongs to
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
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
  
  // For pagination - which page of messages this belongs to
  page: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Message sequence number within its page (for ordering, up to 20 per page)
  sequenceNumber: {
    type: Number,
    required: true,
    default: 0,
    max: 19 // 0-19 for 20 messages per page
  }
}, { 
  timestamps: true,
  collection: 'messages' 
});

// Create compound index for efficient message retrieval
messageSchema.index({ conversationId: 1, page: 1, sequenceNumber: 1 });

// Add middleware to ensure conversationId is always stored as string
messageSchema.pre('save', function(next) {
  // If the conversationId exists and is an object with toString method
  if (this.conversationId && typeof this.conversationId === 'object' && 
      this.conversationId !== null && typeof this.conversationId.toString === 'function') {
    
    // Get the string representation
    const convIdStr = this.conversationId.toString();
    
    // Only convert if it's a valid representation (not [object Object])
    if (convIdStr !== '[object Object]') {
      console.log(`Message pre-save: Converting conversationId from object to string: ${convIdStr}`);
      this.conversationId = convIdStr;
    } else {
      console.error('Message pre-save: Invalid conversationId object detected: [object Object]');
    }
  }
  
  next();
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 