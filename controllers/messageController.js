const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushNotification } = require('../utils/pushNotifications');
const { validateObjectId } = require('../utils/validation');
const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const { getIO } = require('../utils/socketManager');
const Post = require('../models/Post');

/**
 * @desc    Only find a conversation between users (does not create one)
 * @route   GET /api/messages/find-with-user/:userId
 * @access  Private
 */
exports.findConversationWithUser = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;
    
    // Validate the participant ID
    if (!validateObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    // For direct chats, check if users are the same
    if (currentUserId.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot find a conversation with yourself'
      });
    }
    
    // Check if the participant user exists
    const participant = await User.findById(userId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`Finding conversation between ${currentUserId} and ${userId}`);
    
    // Check if a conversation already exists between these users
    let conversation = await Conversation.findBetweenUsers([currentUserId, userId]);
    
    if (conversation) {
      console.log(`Found existing conversation: ${conversation._id}`);
      // Return the existing conversation
      return res.status(200).json({
        success: true,
        message: 'Conversation found',
        data: {
          conversation: {
        _id: conversation._id,
            participants: conversation.participants,
        type: conversation.type,
        createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
          }
        }
      });
    }

    // No conversation exists yet
    return res.status(404).json({
      success: false,
      message: 'No conversation found between these users',
      notFound: true
    });
  } catch (error) {
    console.error('Error finding conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Find or create a conversation between users
 * @route   POST /api/messages/find-or-create
 * @access  Private
 */
exports.findOrCreateConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { participantId, type = 'direct' } = req.body;
    
    // Validate the participant ID
    if (!validateObjectId(participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid participant ID format'
      });
    }
    
    // For direct chats, check if users are the same
    if (currentUserId.toString() === participantId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a conversation with yourself'
      });
    }
    
    // Check if the participant user exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`Finding or creating conversation between ${currentUserId} and ${participantId}`);
    
    // Check if a conversation already exists between these users
    let conversation = await Conversation.findBetweenUsers([currentUserId, participantId]);
    
    if (conversation) {
      console.log(`Found existing conversation: ${conversation._id}`);
      // Return the existing conversation
      return res.status(200).json({
        success: true,
        message: 'Conversation found',
        data: {
          conversation: {
            _id: conversation._id,
            participants: conversation.participants,
            type: conversation.type,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
          }
        }
      });
    }

    // Create a new conversation
    conversation = new Conversation({
      participants: [currentUserId, participantId],
      type,
      createdBy: currentUserId
    });
    
    // Initialize message counts and statuses
    conversation.unreadCount.set(currentUserId.toString(), 0);
    conversation.unreadCount.set(participantId.toString(), 0);
    
    // Save the conversation
    await conversation.save();
    console.log(`Created new conversation: ${conversation._id}`);
    
    // Update both users' conversation arrays
    await User.updateOne(
      { _id: currentUserId },
      { $addToSet: { conversations: conversation._id } }
    );
    
    await User.updateOne(
      { _id: participantId },
      { $addToSet: { conversations: conversation._id } }
    );
    
    // Create and return response
    return res.status(201).json({
      success: true,
      message: 'New conversation created',
      data: {
        conversation: {
          _id: conversation._id,
          participants: conversation.participants,
          type: conversation.type,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Error finding or creating conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Create conversation and send first message
 * @route   POST /api/messages/new-conversation
 * @access  Private
 */
exports.createConversationAndSendMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      recipientId, 
      content, 
      media, 
      mediaType, 
      mediaWidth, 
      mediaHeight, 
      mediaDuration, 
      mediaThumbnail,
      isPost,
      postId
    } = req.body;
    
    console.log(`Creating conversation between ${userId} and ${recipientId} with first message`);
    
    // Make sure recipientId is provided
    if (!recipientId) {
      console.log('Error: No recipient ID provided');
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required for new conversations'
      });
    }
    
    // Validate the recipient ID
    if (!validateObjectId(recipientId)) {
      console.log(`Error: Invalid recipient ID format: ${recipientId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid recipient ID format'
      });
    }
    
    // Check if trying to message self
    if (userId.toString() === recipientId.toString()) {
      console.log('Error: User attempting to message themselves');
      return res.status(400).json({
        success: false,
        message: 'Cannot create a conversation with yourself'
      });
    }
    
    // Check if the participant user exists
    const participant = await User.findById(recipientId);
    if (!participant) {
      console.log(`Error: Recipient user not found with ID: ${recipientId}`);
        return res.status(404).json({
          success: false,
        message: 'Recipient user not found'
      });
    }
    
    console.log('Recipient user found:', participant.name || participant.fullName || participant._id);
    
    // Check if a conversation already exists between these users
    let conversation = await Conversation.findBetweenUsers([userId, recipientId]);
    
    if (conversation) {
      console.log(`Found existing conversation: ${conversation._id}, adding message`);
    } else {
      // Create a new conversation
      console.log('No existing conversation found, creating new one');
      conversation = new Conversation({
        participants: [userId, recipientId],
        type: 'direct',
        createdBy: userId
      });
      
      // Initialize message counts and statuses
      conversation.unreadCount.set(userId.toString(), 0);
      conversation.unreadCount.set(recipientId.toString(), 0);
      
      console.log(`Created new conversation: ${conversation._id} for first message`);
      
      // Update both users' conversation arrays
      await User.updateOne(
        { _id: userId },
        { $addToSet: { conversations: conversation._id } }
      );
      
      await User.updateOne(
        { _id: recipientId },
        { $addToSet: { conversations: conversation._id } }
      );
      
      console.log('Updated user documents with new conversation reference');
    }
    
    // Verify if content, media, or post data is provided
    if (!content && !media && (!isPost || !postId)) {
      console.log('Error: No message content, media, or post data provided');
      return res.status(400).json({
        success: false,
        message: 'Message content, media, or post data is required'
      });
    }
    
    // Create message data
    const messageData = {
      sender: userId,
      content: content || '',
      media,
      mediaType,
      mediaWidth,
      mediaHeight,
      mediaDuration,
      mediaThumbnail,
      isPost: isPost || false,
      postId: postId || null,
      deliveryStatus: 'sent',
      readBy: [userId], // Message is automatically read by sender
      readReceipts: new Map([[userId.toString(), new Date()]])
    };
    
    console.log('Adding message to conversation');
    
    // Add the message to the conversation
    const newMessage = conversation.addMessage(messageData);
    
    // Save the conversation
    await conversation.save();
    console.log('Conversation saved successfully with new message');
    
    // Get the socket IO instance
    const io = getIO();
    
    // Emit to all participants except sender
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user:${participantId}`).emit('new_message', {
          conversation: conversation._id,
          message: {
            _id: newMessage._id,
            content: newMessage.content,
            sender: userId,
            createdAt: newMessage.createdAt,
            isPost: newMessage.isPost,
            postId: newMessage.postId
          }
        });
        
        // Determine message preview based on message type
        let messagePreview = messageData.content || 'Sent you a message';
        if (messageData.isPost) {
          messagePreview = 'Shared a post with you';
        } else if (messageData.media) {
          messagePreview = 'Sent you media';
        }
        
        // Send push notification
        sendPushNotification(
          participantId, 
          req.user.name, 
          messagePreview,
          { type: 'message', conversationId: conversation._id }
        );
      }
    });
    
    // Return the message and new conversation to the client
    return res.status(201).json({
      success: true,
      message: 'Message sent in new conversation',
      data: {
        message: {
          _id: newMessage._id,
          content: newMessage.content,
          createdAt: newMessage.createdAt,
          isPost: newMessage.isPost,
          postId: newMessage.postId
        },
        conversationId: conversation._id
      }
    });
  } catch (error) {
    console.error('Error creating conversation and sending message:', error);
    return res.status(500).json({
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Send a message in a conversation
 * @route   POST /api/messages/:conversationId
 * @route   POST /api/messages/add-message
 * @access  Private
 */
exports.sendMessage = async (req, res) => {
  try {
    // Handle both the old route and new route formats
    let conversationId;
    if (req.params.conversationId) {
      // Old route: /api/messages/:conversationId
      conversationId = req.params.conversationId;
    } else if (req.body.conversationId) {
      // New route: /api/messages/add-message with conversationId in body
      conversationId = req.body.conversationId;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }
    
    const userId = req.user._id;
    const { 
      content, 
      media, 
      mediaType, 
      mediaWidth, 
      mediaHeight, 
      mediaDuration, 
      mediaThumbnail, 
      repliedToId, 
      recipientId,
      isPost,
      postId
    } = req.body;
    
    // Log the request parameters for debugging
    console.log('sendMessage received params:', { 
      conversationId,
      userId: userId.toString(),
      hasContent: !!content,
      hasRecipientId: !!recipientId,
      isPost: !!isPost,
      hasPostId: !!postId
    });
    
    // Special case for 'new-conversation', which means create a new conversation first
    if (conversationId === 'new-conversation') {
      // Make sure recipientId is provided for new conversations
      if (!recipientId) {
        return res.status(400).json({
          success: false,
          message: 'Recipient ID is required for new conversations'
        });
      }
      
      // Validate the recipient ID
      if (!validateObjectId(recipientId)) {
      return res.status(400).json({
        success: false,
          message: 'Invalid recipient ID format'
        });
      }
      
      // Check if the participant user exists
      const participant = await User.findById(recipientId);
      if (!participant) {
      return res.status(404).json({
        success: false,
          message: 'Recipient user not found'
        });
      }
      
      // Check if a conversation already exists between these users
      let conversation = await Conversation.findBetweenUsers([userId, recipientId]);
      
      if (!conversation) {
        // Create a new conversation
        conversation = new Conversation({
          participants: [userId, recipientId],
          type: 'direct',
          createdBy: userId
        });
        
        // Initialize message counts and statuses
        conversation.unreadCount.set(userId.toString(), 0);
        conversation.unreadCount.set(recipientId.toString(), 0);
        
        console.log(`Created new conversation: ${conversation._id} for first message`);
        
        // Update both users' conversation arrays
        await User.updateOne(
          { _id: userId },
          { $addToSet: { conversations: conversation._id } }
        );
        
        await User.updateOne(
          { _id: recipientId },
          { $addToSet: { conversations: conversation._id } }
        );
      }
      
      // Create message data
      const messageData = {
        sender: userId,
        content: content || '',
        media,
        mediaType,
        mediaWidth,
        mediaHeight,
        mediaDuration,
        mediaThumbnail,
        isPost: isPost || false,
        postId: postId || null,
        deliveryStatus: 'sent',
        readBy: [userId], // Message is automatically read by sender
        readReceipts: new Map([[userId.toString(), new Date()]])
      };
      
      // Add the message to the conversation
      const newMessage = conversation.addMessage(messageData);
      
      // Save the conversation
    await conversation.save();
    
      // Get the socket IO instance
      const io = getIO();
      
      // Emit to all participants except sender
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId.toString()) {
          io.to(`user:${participantId}`).emit('new_message', {
            conversation: conversation._id,
            message: {
              _id: newMessage._id,
              content: newMessage.content,
              sender: userId,
              createdAt: newMessage.createdAt,
              isPost: newMessage.isPost,
              postId: newMessage.postId
            }
          });
          
          // Determine message preview based on message type
          let messagePreview = messageData.content || 'Sent you a message';
          if (messageData.isPost) {
            messagePreview = 'Shared a post with you';
          } else if (messageData.media) {
            messagePreview = 'Sent you media';
          }
          
          // Send push notification
          sendPushNotification(
            participantId, 
            req.user.name, 
            messagePreview,
            { type: 'message', conversationId: conversation._id }
          );
        }
      });
      
      // Return the message and new conversation to the client
      return res.status(201).json({
        success: true,
        message: 'Message sent in new conversation',
        data: {
          message: {
            _id: newMessage._id,
            content: newMessage.content,
            createdAt: newMessage.createdAt,
            isPost: newMessage.isPost,
            postId: newMessage.postId
          },
          conversationId: conversation._id
        }
      });
    }
    
    // For existing conversation, validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Find the conversation and check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }
    
    // Create message data
    const messageData = {
      sender: userId,
      content: content || '',
      media,
      mediaType,
      mediaWidth,
      mediaHeight,
      mediaDuration,
      mediaThumbnail,
      isPost: isPost || false,
      postId: postId || null,
      deliveryStatus: 'sent',
      readBy: [userId], // Message is automatically read by sender
      readReceipts: new Map([[userId.toString(), new Date()]])
    };
    
    // If this is a reply, add the replied to message data
    if (repliedToId) {
      // Find the replied-to message in the conversation's messages
      const repliedToMessage = conversation.messages.find(m => 
        m._id.toString() === repliedToId
      );
      
      if (repliedToMessage) {
        messageData.repliedTo = {
          messageId: repliedToMessage._id,
          content: repliedToMessage.content,
          sender: repliedToMessage.sender
        };
      }
    }
    
    // Add the message to the conversation using our model method
    const newMessage = conversation.addMessage(messageData);
    
    // Save the conversation
    await conversation.save();
    
    // Get the socket IO instance
    const io = getIO();
    
    // Emit to all participants except sender
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user:${participantId}`).emit('new_message', {
          conversation: conversationId,
          message: {
            _id: newMessage._id,
            content: newMessage.content,
            sender: userId,
            createdAt: newMessage.createdAt,
            isPost: newMessage.isPost,
            postId: newMessage.postId
          }
        });
        
        // Determine message preview based on message type
        let messagePreview = messageData.content || 'Sent you a message';
        if (messageData.isPost) {
          messagePreview = 'Shared a post with you';
        } else if (messageData.media) {
          messagePreview = 'Sent you media';
        }
        
        // Send push notification
        sendPushNotification(
          participantId, 
          req.user.name, 
          messagePreview,
          { type: 'message', conversationId }
        );
      }
    });
    
    // Return the message to the client
    return res.status(201).json({
      success: true,
      message: 'Message sent',
      data: {
        _id: newMessage._id,
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        isPost: newMessage.isPost,
        postId: newMessage.postId
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all messages for a specific conversation
 * @route   GET /api/messages/get-messages/:conversationId
 * @access  Private
 */
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    // Validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Find the conversation and check if user is a participant, using findOneAndUpdate to mark as read in a single operation
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, participants: userId },
      { $set: { [`unreadCount.${userId}`]: 0, [`messageChecked.${userId}`]: new Date() } },
      { new: true }
    );
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }
    
    // Mark messages as read (without saving the whole conversation yet)
    let messagesUpdated = false;
    const userIdStr = userId.toString();
    
    for (let i = 0; i < conversation.messages.length; i++) {
      const message = conversation.messages[i];
      if (!message.readBy.some(id => id.toString() === userIdStr)) {
        message.readBy.push(userId);
        message.readReceipts.set(userIdStr, new Date());
        message.deliveryStatus = 'read';
        messagesUpdated = true;
      }
    }
    
    // Only save if message readBy arrays were actually modified
    if (messagesUpdated) {
      try {
        // Use findOneAndUpdate to avoid version conflicts
        await Conversation.updateOne(
          { _id: conversationId },
          { $set: { messages: conversation.messages } }
        );
      } catch (error) {
        console.warn('Non-critical error updating message read status:', error.message);
        // Continue anyway - we don't want to fail the API call just because read receipts failed
      }
    }
    
    // Get messages from the embedded messages array
    const messages = conversation.messages || [];
    
    // Sort messages by creation date (newest first)
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Format the messages for response
    const formattedMessages = await Promise.all(messages.map(async (message) => {
      // Populate sender information
      const sender = await User.findById(message.sender, '_id name fullName profileImage');
      
      return {
        _id: message._id,
        content: message.content,
        sender: sender ? {
          _id: sender._id,
          name: sender.name,
          fullName: sender.fullName,
          profileImage: sender.profileImage
        } : message.sender,
        media: message.media,
        mediaType: message.mediaType,
        mediaWidth: message.mediaWidth,
        mediaHeight: message.mediaHeight,
        mediaDuration: message.mediaDuration,
        mediaThumbnail: message.mediaThumbnail,
        repliedTo: message.repliedTo,
        reactions: message.reactions || [],
        readBy: message.readBy || [],
        isRead: message.readBy.some(id => id.toString() === userId.toString()),
        deliveryStatus: message.deliveryStatus,
        isSystemMessage: message.isSystemMessage,
        isDeleted: message.isDeleted,
        isEdited: message.isEdited,
        isPost: message.isPost || false,
        postId: message.postId || null,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      };
    }));
    
    return res.status(200).json({
      success: true,
      data: formattedMessages,
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        participants: conversation.participants,
        unreadCount: conversation.unreadCount.get(userId.toString()) || 0,
        isGroup: conversation.type === 'group',
        groupName: conversation.groupName,
        groupImage: conversation.groupImage
      }
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all conversations for a user
 * @route   GET /api/messages/conversations
 * @access  Private
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find all conversations where the user is a participant
    const conversations = await Conversation.find({
      participants: userId
    })
    .sort({ updatedAt: -1 }) // Sort by most recent activity
    .populate('participants', '_id name fullName profileImage isOnline')
    .lean();
    
    // Format the conversations for the response
    const formattedConversations = await Promise.all(conversations.map(async (conversation) => {
      // Get the other user (for direct chats)
      let otherUser = null;
      
      if (conversation.type === 'direct') {
        otherUser = conversation.participants.find(
          p => p._id.toString() !== userId.toString()
        );
      }
      
      // Get unread count for this user
      const unreadCount = conversation.unreadCount ? 
        conversation.unreadCount[userId.toString()] || 0 : 0;
      
      // Get last message
      const lastMessage = conversation.lastMessagePreview || 
        (conversation.messages && conversation.messages.length > 0 ? 
          conversation.messages[conversation.messages.length - 1] : null);
      
      return {
        _id: conversation._id,
        type: conversation.type,
        participants: conversation.participants,
        lastMessage: lastMessage ? {
          _id: lastMessage._id,
          content: lastMessage.content,
          sender: lastMessage.sender,
          createdAt: lastMessage.createdAt
        } : null,
        unreadCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        isGroup: conversation.type === 'group',
        groupName: conversation.groupName,
        groupImage: conversation.groupImage,
        otherUser: otherUser ? {
          _id: otherUser._id,
          name: otherUser.name,
          fullName: otherUser.fullName,
          profileImage: otherUser.profileImage,
          isOnline: conversation.onlineStatus ? 
            conversation.onlineStatus[otherUser._id.toString()] || otherUser.isOnline || false : 
            otherUser.isOnline || false
        } : null
      };
    }));
    
    return res.status(200).json({
      success: true,
      data: formattedConversations
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Mark a conversation as read
 * @route   PUT /api/messages/read/:conversationId
 * @access  Private
 */
exports.markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    // Validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Find the conversation and mark as read in a single atomic operation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }
    
    // Set unread count to zero and update message checked timestamp atomically
    await Conversation.updateOne(
      { _id: conversationId },
      { 
        $set: { 
          [`unreadCount.${userId}`]: 0,
          [`messageChecked.${userId}`]: new Date()
        } 
      }
    );
    
    // Update read status for all messages in an atomic operation 
    // that won't conflict with other operations
    const updateOperations = [];
    const userIdStr = userId.toString();
    
    // Bulk update all message readBy arrays to include this user
    await Conversation.updateOne(
      { _id: conversationId },
      { 
        $addToSet: { 
          "messages.$[].readBy": userId 
        },
        $set: {
          "messages.$[].deliveryStatus": "read"
        }
      }
    );
    
    // Get the socket IO instance
    const io = getIO();
    
    // Notify other participants that messages have been read
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user:${participantId}`).emit('messages_read', {
          conversation: conversationId,
          readBy: userId
        });
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get embedded messages for a conversation
 * @route   GET /api/messages/embedded/:conversationId
 * @access  Private
 */
exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Find the conversation and check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    }).populate('participants', '_id name fullName profileImage isOnline');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }
    
    // Get messages from the embedded messages array
    const messages = conversation.messages || [];
    
    // Sort messages by creation date (newest first)
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Format the messages for response
    const formattedMessages = await Promise.all(messages.map(async (message) => {
      // Populate sender information
      const sender = await User.findById(message.sender, '_id name fullName profileImage');
      
      return {
        _id: message._id,
        content: message.content,
        sender: sender ? {
          _id: sender._id,
          name: sender.name,
          fullName: sender.fullName,
          profileImage: sender.profileImage
        } : message.sender,
        media: message.media,
        mediaType: message.mediaType,
        mediaWidth: message.mediaWidth,
        mediaHeight: message.mediaHeight,
        mediaDuration: message.mediaDuration,
        mediaThumbnail: message.mediaThumbnail,
        repliedTo: message.repliedTo,
        reactions: message.reactions || [],
        readBy: message.readBy || [],
        isRead: message.readBy.some(id => id.toString() === userId.toString()),
        deliveryStatus: message.deliveryStatus,
        isSystemMessage: message.isSystemMessage,
        isDeleted: message.isDeleted,
        isEdited: message.isEdited,
        isPost: message.isPost || false,
        postId: message.postId || null,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      };
    }));
    
    // Mark the conversation as read for this user
    conversation.markAsRead(userId);
    await conversation.save();
    
    return res.status(200).json({
      success: true,
      data: formattedMessages,
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        participants: conversation.participants,
        unreadCount: conversation.unreadCount.get(userId.toString()) || 0,
        isGroup: conversation.type === 'group',
        groupName: conversation.groupName,
        groupImage: conversation.groupImage
      }
    });
  } catch (error) {
    console.error('Error getting embedded conversation messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Add a message to the conversation document
 * @route   POST /api/messages/embedded
 * @access  Private
 */
exports.addConversationMessage = async (req, res) => {
  try {
    const { 
      conversationId, 
      content, 
      media, 
      mediaType, 
      mediaWidth, 
      mediaHeight, 
      mediaDuration, 
      mediaThumbnail, 
      repliedToId,
      isPost,
      postId 
    } = req.body;
    
    const userId = req.user._id;

    // Validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Find the conversation and check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }
    
    // Create message data
    const messageData = {
      sender: userId,
      content: content || '',
      media,
      mediaType,
      mediaWidth,
      mediaHeight,
      mediaDuration,
      mediaThumbnail,
      isPost: isPost || false,
      postId: postId || null,
      deliveryStatus: 'sent',
      readBy: [userId], // Message is automatically read by sender
      readReceipts: new Map([[userId.toString(), new Date()]])
    };
    
    // If this is a reply, add the replied to message data
    if (repliedToId) {
      // Find the replied-to message in the conversation
      const repliedToMessage = conversation.messages.find(m => 
        m._id.toString() === repliedToId
      );
      
      if (repliedToMessage) {
        messageData.repliedTo = {
          messageId: repliedToMessage._id,
          content: repliedToMessage.content,
          sender: repliedToMessage.sender
        };
      }
    }
    
    // Add the message to the conversation
    const newMessage = conversation.addMessage(messageData);
    
    // Save the conversation
    await conversation.save();
    
    // Get the socket IO instance
    const io = getIO();
    
    // Emit to all participants except sender
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user:${participantId}`).emit('new_embedded_message', {
          conversation: conversationId,
          message: {
            _id: newMessage._id,
            content: newMessage.content,
            sender: userId,
            createdAt: newMessage.createdAt,
            isPost: newMessage.isPost,
            postId: newMessage.postId
          }
        });
      }
    });
    
    // Send push notifications to other participants
    try {
      const otherParticipants = conversation.participants.filter(
        p => p.toString() !== userId.toString()
      );
      
      if (otherParticipants.length > 0) {
        const sender = await User.findById(userId, 'name fullName');
        const senderName = sender ? sender.fullName || sender.name : 'Someone';
        
        // Determine message preview based on message type
        let messagePreview = '';
        if (isPost) {
          messagePreview = 'Shared a post with you';
        } else if (media) {
          messagePreview = 'Sent media';
        } else if (content) {
          messagePreview = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        } else {
          messagePreview = 'Sent a message';
        }
        
        // Create a notification for each participant
        for (const participantId of otherParticipants) {
          await Notification.create({
            recipient: participantId,
            type: 'new_message',
            sender: userId,
            data: {
              conversationId,
              messageId: newMessage._id,
              preview: messagePreview
            },
            message: `${senderName} sent you a message`,
            isRead: false
          });
          
          // Send push notification
          sendPushNotification(
            participantId,
            'New message',
            `${senderName}: ${messagePreview}`,
            {
              type: 'new_message',
              conversationId,
              senderId: userId.toString()
            }
          );
        }
      }
    } catch (notifError) {
      console.error('Error sending message notifications:', notifError);
      // Don't fail the message send if notifications fail
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Error adding embedded message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get details for a single conversation
 * @route   GET /api/messages/conversation/:id
 * @access  Private
 */
exports.findSingleConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate the conversation ID
      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID format'
        });
      }
      
    // Find the conversation and check if user is a participant
      const conversation = await Conversation.findOne({
        _id: id,
      participants: userId
    }).populate('participants', '_id name fullName profileImage isOnline');
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or you are not a participant'
        });
      }
      
    // Format the conversation for the response
    const formattedConversation = {
          _id: conversation._id,
          type: conversation.type,
          participants: conversation.participants,
      unreadCount: conversation.unreadCount.get(userId.toString()) || 0,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          isGroup: conversation.type === 'group',
          groupName: conversation.groupName,
          groupImage: conversation.groupImage,
      // Get the other user for direct chats
      otherUser: conversation.type === 'direct' ? 
        conversation.participants.find(p => p._id.toString() !== userId.toString()) : null
    };
    
    return res.status(200).json({
      success: true,
      data: formattedConversation
    });
  } catch (error) {
    console.error('Error finding conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Create a group conversation
 * @route   POST /api/messages/group
 * @access  Private
 */
exports.createGroupConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, participants, avatar } = req.body;
    
    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({
          success: false,
        message: 'At least one participant is required'
      });
    }
    
    // Ensure all participant IDs are valid
    for (const participantId of participants) {
      if (!validateObjectId(participantId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid participant ID: ${participantId}`
        });
      }
    }
    
    // Add the current user as a participant if not already included
    let allParticipants = participants.includes(userId.toString()) 
      ? participants 
      : [userId.toString(), ...participants];
    
    // Convert all participant IDs to ObjectID
    allParticipants = allParticipants.map(id => new mongoose.Types.ObjectId(id));
    
    // Check if all participants exist
    const existingUsers = await User.find({ _id: { $in: allParticipants } });
    
    if (existingUsers.length !== allParticipants.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more participants do not exist'
      });
    }
    
    // Create a new group conversation
    const newConversation = new Conversation({
      type: 'group',
      groupName: name.trim(),
      groupImage: avatar,
      participants: allParticipants,
      admins: [userId], // Creator is automatically an admin
      createdBy: userId
    });
    
    // Initialize unread counts for all participants
    allParticipants.forEach(participantId => {
      newConversation.unreadCount.set(participantId.toString(), 0);
    });
    
    // Save the conversation
    await newConversation.save();
    
    // Add this conversation to all participants' conversation arrays
    await User.updateMany(
      { _id: { $in: allParticipants } },
      { $addToSet: { conversations: newConversation._id } }
    );
    
    // Add a system message to the conversation
    const creatorName = existingUsers.find(u => u._id.toString() === userId.toString())?.name || 'User';
    
    const systemMessage = {
      sender: userId,
      content: `${creatorName} created this group`,
      isSystemMessage: true,
      readBy: [userId],
      deliveryStatus: 'delivered'
    };
    
    newConversation.addMessage(systemMessage);
    await newConversation.save();
    
    // Get the socket IO instance
    const io = getIO();
    
    // Notify all participants except the creator
    allParticipants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user:${participantId}`).emit('new_conversation', {
          conversation: {
            _id: newConversation._id,
            type: 'group',
            groupName: name.trim(),
            groupImage: avatar,
            createdBy: userId,
            updatedAt: newConversation.updatedAt
        }
      });
    }
    });
    
    return res.status(201).json({
      success: true,
      message: 'Group conversation created successfully',
      data: {
        _id: newConversation._id,
        type: 'group',
        groupName: name.trim(),
        groupImage: avatar,
        participants: existingUsers.map(user => ({
          _id: user._id,
          name: user.name,
          fullName: user.fullName,
          profileImage: user.profileImage
        })),
        createdAt: newConversation.createdAt,
        updatedAt: newConversation.updatedAt
      }
    });
  } catch (error) {
    console.error('Error creating group conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get participants in a conversation
 * @route   GET /api/messages/participants/:conversationId
 * @access  Private
 */
exports.getConversationParticipants = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }

    // Find the conversation and check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    }).populate('participants', '_id name fullName profileImage isOnline');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }

    return res.status(200).json({
      success: true,
      data: conversation.participants
    });
  } catch (error) {
    console.error('Error getting conversation participants:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Mark messages as read
 * @route   POST /api/messages/:conversationId/read
 * @access  Private
 */
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Find the conversation and check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false, 
        message: 'Conversation not found or you are not a participant'
      });
    }
    
    // Mark messages as read
    conversation.markAsRead(userId);
    await conversation.save();
    
    // Get the socket IO instance
    const io = getIO();
    
    // Notify other participants that messages have been read
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user:${participantId}`).emit('messages_read', {
          conversation: conversationId,
          readBy: userId
        });
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Update typing status
 * @route   POST /api/messages/:conversationId/typing
 * @access  Private
 */
exports.updateTypingStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const { isTyping } = req.body;
    
    // Validate the conversationId
    if (!validateObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Find the conversation and check if user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(404).json({
          success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }
    
    // Update typing status
    conversation.isTyping.set(userId.toString(), !!isTyping);
    await conversation.save();
    
    // Get the socket IO instance
    const io = getIO();
    
    // Notify other participants about typing status
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId.toString()) {
        io.to(`user:${participantId}`).emit('typing_status', {
          conversation: conversationId,
          user: userId,
          isTyping: !!isTyping
        });
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Typing status updated'
    });
  } catch (error) {
    console.error('Error updating typing status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Update online status
 * @route   POST /api/messages/status/online
 * @access  Private
 */
exports.updateOnlineStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.body;
    
    // Update user's online status
    await User.findByIdAndUpdate(userId, {
      isOnline: status === 'online',
      lastOnline: status === 'online' ? undefined : new Date()
    });
    
    // Get the socket IO instance
    const io = getIO();
    
    // Broadcast online status to interested clients
    io.emit('user_status', {
      user: userId,
      isOnline: status === 'online'
    });
    
    return res.status(200).json({
      success: true,
      message: 'Online status updated'
    });
  } catch (error) {
    console.error('Error updating online status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a message
 * @route   DELETE /api/messages/message/:messageId
 * @access  Private
 */
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Validate the message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Find the message
    const message = await Message.findById(messageId);

    // Check if message exists
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender of the message
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // Soft delete the message (mark as deleted but keep in database)
    message.isDeleted = true;
    message.content = "This message was deleted";
    message.media = null;
    message.mediaType = null;
    message.mediaWidth = null;
    message.mediaHeight = null;
    message.mediaDuration = null;
    message.mediaThumbnail = null;
    
    await message.save();

    // Get the conversation ID to notify participants
    const conversationId = message.conversationId;

    // Notify all participants in the conversation about the deleted message
    const io = getIO();
    io.to(conversationId.toString()).emit('messageDeleted', {
      messageId: message._id,
      conversationId
    });

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      data: {
        messageId: message._id
      }
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Edit a message
 * @route   PUT /api/messages/message/:messageId
 * @access  Private
 */
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    // Validate the message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Validate content
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Find the message
    const message = await Message.findById(messageId);

    // Check if message exists
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // Check if user is the sender of the message
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages'
      });
    }

    // Check if message is deleted
    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a deleted message'
      });
    }

    // Check if message has media (can't edit media messages)
    if (message.isPost) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a shared post message'
      });
    }

    // Update the message
    message.content = content;
    message.isEdited = true;
    await message.save();

    // Get the conversation ID to notify participants
    const conversationId = message.conversationId;

    // Notify all participants in the conversation about the edited message
    const io = getIO();
    io.to(conversationId.toString()).emit('messageEdited', {
      message: {
        _id: message._id,
        content: message.content,
        isEdited: message.isEdited,
        conversationId: message.conversationId
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Message edited successfully',
      data: {
        _id: message._id,
        content: message.content,
        isEdited: message.isEdited
      }
    });
  } catch (error) {
    console.error('Error editing message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Add a reaction to a message
 * @route   POST /api/messages/reaction/:messageId
 * @access  Private
 */
exports.addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = req.user._id;

    // Validate the message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Validate reaction
    if (!reaction) {
      return res.status(400).json({
        success: false,
        message: 'Reaction is required'
      });
    }

    // Find the message
    const message = await Message.findById(messageId);

    // Check if message exists
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has already reacted with the same reaction
    const existingReaction = message.reactions.find(
      r => r.user.toString() === userId.toString() && r.reaction === reaction
    );

    if (existingReaction) {
      return res.status(400).json({
        success: false,
        message: 'You have already added this reaction'
      });
    }

    // Remove any existing reaction from this user to avoid multiple reactions
    message.reactions = message.reactions.filter(
      r => r.user.toString() !== userId.toString()
    );

    // Add the new reaction
    message.reactions.push({
      user: userId,
      reaction
    });

    await message.save();

    // Get the conversation ID to notify participants
    const conversationId = message.conversationId;

    // Notify all participants in the conversation about the reaction
    const io = getIO();
    io.to(conversationId.toString()).emit('messageReaction', {
      messageId: message._id,
      reaction: {
        user: userId,
        reaction,
        createdAt: new Date()
      },
      conversationId
    });
    
    return res.status(200).json({
      success: true,
      message: 'Reaction added successfully',
      data: {
        messageId: message._id,
        reaction: {
          user: userId,
          reaction,
          createdAt: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Remove a reaction from a message
 * @route   DELETE /api/messages/reaction/:messageId/:reactionId
 * @access  Private
 */
exports.removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    
    // Validate the message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Find the message
    const message = await Message.findById(messageId);

    // Check if message exists
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has a reaction on this message
    const reactionExists = message.reactions.some(
      r => r.user.toString() === userId.toString()
    );

    if (!reactionExists) {
      return res.status(400).json({
        success: false,
        message: 'You have not reacted to this message'
      });
    }
    
    // Remove the reaction
    message.reactions = message.reactions.filter(
        r => r.user.toString() !== userId.toString()
      );
    
    await message.save();
      
    // Get the conversation ID to notify participants
    const conversationId = message.conversationId;

    // Notify all participants in the conversation about the removed reaction
      const io = getIO();
    io.to(conversationId.toString()).emit('messageReactionRemoved', {
      messageId: message._id,
      userId,
      conversationId
    });

    return res.status(200).json({
      success: true,
      message: 'Reaction removed successfully',
      data: {
        messageId: message._id,
        userId
      }
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Send a media message to a conversation
 * @route   POST /api/messages/media/:conversationId
 * @access  Private
 */
exports.sendMediaMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;
    
    // Validate conversation ID
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Check if files exist in the request
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No media files provided'
      });
    }
    
    // Check the number of files (maximum 10)
    if (req.files.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 media files allowed per message'
      });
    }
    
    // Check the file size for videos (maximum 5MB)
    for (const file of req.files) {
      if (file.mimetype.startsWith('video/') && file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Video files must be less than 5MB'
        });
      }
    }
    
    // Find the conversation
    const conversation = await Conversation.findById(conversationId);
    
    // Check if conversation exists
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    // Check if user is a participant in the conversation
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }
    
    // Process each file and create messages
    const mediaMessages = [];
    
    for (const file of req.files) {
      // Get file details
      const mediaType = file.mimetype.startsWith('image/') ? 'image' : 'video';
      
      // Create a new message for each media file
      const message = new Message({
        conversationId,
        sender: userId,
        content: content || '',
        media: file.path, // This will be the URL to the file
        mediaType,
        mediaWidth: req.body.width || null,
        mediaHeight: req.body.height || null,
        mediaDuration: mediaType === 'video' ? req.body.duration || null : null,
        mediaThumbnail: mediaType === 'video' ? req.body.thumbnail || null : null,
        readBy: [userId],
        deliveryStatus: 'sent',
        page: 0, // You may need to calculate this based on existing messages
        sequenceNumber: 0 // You may need to calculate this based on existing messages
      });
      
      await message.save();
      mediaMessages.push(message);
      
      // Update conversation with this message
      conversation.lastMessage = message._id;
      
      // Reset unread counts for sender
      conversation.unreadCount.set(userId.toString(), 0);
      
      // Increment unread counts for other participants
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== userId.toString()) {
          const currentUnread = conversation.unreadCount.get(participantId.toString()) || 0;
          conversation.unreadCount.set(participantId.toString(), currentUnread + 1);
        }
      });
    }
    
    // Save the conversation
    await conversation.save();
    
    // Notify participants about new media messages
    const io = getIO();
    mediaMessages.forEach(message => {
      io.to(conversationId).emit('newMessage', {
        message: {
          _id: message._id,
          conversationId: message.conversationId,
          sender: userId,
          content: message.content,
          media: message.media,
          mediaType: message.mediaType,
          mediaWidth: message.mediaWidth,
          mediaHeight: message.mediaHeight,
          mediaDuration: message.mediaDuration,
          mediaThumbnail: message.mediaThumbnail,
          createdAt: message.createdAt,
          readBy: message.readBy
        }
      });
    });
    
    // Notify participants about the update to the conversation (last message, unread counts)
    io.to(conversationId).emit('conversationUpdated', {
      conversationId,
      lastMessage: conversation.lastMessage,
      unreadCount: Object.fromEntries(conversation.unreadCount)
        });
    
    return res.status(200).json({
      success: true,
      message: 'Media messages sent successfully',
      data: {
        messages: mediaMessages.map(message => ({
          _id: message._id,
          conversationId: message.conversationId,
          sender: userId,
          content: message.content,
          media: message.media,
          mediaType: message.mediaType,
          createdAt: message.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error sending media message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Add a reaction to a message in a conversation document
 * @route   POST /api/messages/conversation-reactions/:conversationId/:messageId
 * @access  Private
 */
exports.addConversationMessageReaction = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { reaction } = req.body;
    const userId = req.user._id;

    console.log(`[DEBUG] Adding reaction to conversation ${conversationId}, message ${messageId}, user ${userId}, reaction: ${reaction}`);

    // Validate the conversation ID
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      console.log('[ERROR] Invalid conversation ID format:', conversationId);
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }

    // Validate the message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      console.log('[ERROR] Invalid message ID format:', messageId);
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Validate reaction
    if (!reaction) {
      console.log('[ERROR] No reaction provided');
      return res.status(400).json({
        success: false,
        message: 'Reaction is required'
      });
    }

    // Find the conversation
    console.log('[DEBUG] Finding conversation in MongoDB:', conversationId);
    const conversation = await Conversation.findById(conversationId);
    console.log('[DEBUG] Conversation found?', !!conversation);

    // Check if conversation exists
    if (!conversation) {
      console.log('[ERROR] Conversation not found with ID:', conversationId);
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Debug: log the messages array size
    console.log(`[DEBUG] Conversation has ${conversation.messages?.length || 0} messages`);

    // Find the message in the conversation's messages array
    const messageIndex = conversation.messages.findIndex(
      msg => msg._id.toString() === messageId.toString()
    );

    console.log(`[DEBUG] Message index in conversation: ${messageIndex}`);
    
    if (messageIndex === -1) {
      console.log('[ERROR] Message not found in conversation. MessageID:', messageId);
      // Log a few message IDs to help debug
      console.log('[DEBUG] First few message IDs in conversation:', 
        conversation.messages.slice(0, 3).map(m => m._id.toString()));
      
      return res.status(404).json({
        success: false,
        message: 'Message not found in this conversation'
      });
    }

    // Get the message
    const message = conversation.messages[messageIndex];
    console.log('[DEBUG] Found message:', message._id.toString());

    // Check if reactions array exists, if not create it
    if (!message.reactions) {
      console.log('[DEBUG] Creating new reactions array for message');
      message.reactions = [];
    }

    // Check if user has already reacted with the same reaction
    const existingReactionIndex = message.reactions.findIndex(
      r => r.user.toString() === userId.toString() && r.reaction === reaction
    );

    if (existingReactionIndex !== -1) {
      console.log('[DEBUG] User already reacted with this reaction');
      return res.status(400).json({
        success: false,
        message: 'You have already added this reaction'
      });
    }

    // Remove any existing reaction from this user to avoid multiple reactions
    message.reactions = message.reactions.filter(
      r => r.user.toString() !== userId.toString()
    );

    // Add the new reaction
    message.reactions.push({
      user: userId,
      reaction,
      createdAt: new Date()
    });

    console.log('[DEBUG] Updated reactions for message:', message.reactions);

    // Update the message in the conversation
    conversation.messages[messageIndex] = message;

    // Update the conversation's updatedAt timestamp
    conversation.updatedAt = new Date();

    // Save the conversation
    console.log('[DEBUG] Saving updated conversation');
    await conversation.save();
    console.log('[DEBUG] Conversation saved successfully');

    // Notify all participants in the conversation about the reaction
    const io = getIO();
    io.to(conversationId.toString()).emit('messageReaction', {
      messageId: message._id,
      reaction: {
        user: userId,
        reaction,
        createdAt: new Date()
      },
      conversationId
    });
    
    return res.status(200).json({
      success: true,
      message: 'Reaction added successfully',
      data: {
        messageId: message._id,
        reaction: {
          user: userId,
          reaction,
          createdAt: new Date()
        }
      }
    });
  } catch (error) {
    console.error('[ERROR] Error adding reaction to conversation message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Remove a reaction from a message in a conversation document
 * @route   DELETE /api/messages/conversation-reactions/:conversationId/:messageId
 * @access  Private
 */
exports.removeConversationMessageReaction = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const userId = req.user._id;

    // Validate the conversation ID
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }

    // Validate the message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    // Find the conversation
    const conversation = await Conversation.findById(conversationId);

    // Check if conversation exists
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Find the message in the conversation's messages array
    const messageIndex = conversation.messages.findIndex(
      msg => msg._id.toString() === messageId
    );
    
    if (messageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Message not found in this conversation'
      });
    }

    // Get the message
    const message = conversation.messages[messageIndex];

    // Check if reactions array exists
    if (!message.reactions || message.reactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No reactions found for this message'
      });
    }

    // Check if user has a reaction on this message
    const reactionExists = message.reactions.some(
      r => r.user.toString() === userId.toString()
    );

    if (!reactionExists) {
      return res.status(400).json({
        success: false,
        message: 'You have not reacted to this message'
      });
    }

    // Remove the reaction
    message.reactions = message.reactions.filter(
      r => r.user.toString() !== userId.toString()
    );

    // Update the message in the conversation
    conversation.messages[messageIndex] = message;

    // Update the conversation's updatedAt timestamp
    conversation.updatedAt = new Date();

    // Save the conversation
    await conversation.save();

    // Notify all participants in the conversation about the removed reaction
    const io = getIO();
    io.to(conversationId.toString()).emit('messageReactionRemoved', {
      messageId: message._id,
      userId,
      conversationId
    });
    
    return res.status(200).json({
      success: true,
      message: 'Reaction removed successfully',
      data: {
        messageId: message._id,
        userId
      }
    });
  } catch (error) {
    console.error('Error removing reaction from conversation message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Make sure to export all the functions
module.exports = exports; 