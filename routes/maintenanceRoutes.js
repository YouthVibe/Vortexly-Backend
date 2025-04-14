const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @route  POST /api/maintenance/fix-conversations
 * @desc   Fix conversation IDs in messages
 * @access Private
 */
router.post('/fix-conversations', auth.protect, async (req, res) => {
  try {
    console.log('Running conversation ID fix for user:', req.user.id);
    
    // Get all conversations involving the user
    const userConversations = await Conversation.find({
      participants: { $elemMatch: { $eq: req.user.id } }
    }).lean();
    
    if (!userConversations || userConversations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No conversations found for this user',
        conversations: 0,
        messagesFixed: 0
      });
    }
    
    console.log(`Found ${userConversations.length} conversations for user`);
    
    let messagesFixed = 0;
    let conversationsWithFixes = 0;
    
    // Loop through each conversation
    for (const conversation of userConversations) {
      const conversationId = conversation._id.toString();
      let conversationHasFixes = false;
      
      // Find messages that should belong to this conversation based on participants
      // Look for messages between these participants that might have wrong conversation ID
      const participants = conversation.participants.map(p => 
        p instanceof mongoose.Types.ObjectId ? p.toString() : p.toString()
      );
      
      // For direct messages (2 participants)
      if (participants.length === 2 && conversation.type === 'direct') {
        // Check messages where sender and recipient match conversation participants
        // but conversation ID is wrong or missing
        const potentialMessages = await Message.find({
          $or: [
            {
              sender: participants[0],
              recipientId: participants[1],
              $or: [
                { conversationId: { $ne: conversationId } },
                { conversationId: { $exists: false } }
              ]
            },
            {
              sender: participants[1],
              recipientId: participants[0],
              $or: [
                { conversationId: { $ne: conversationId } },
                { conversationId: { $exists: false } }
              ]
            }
          ]
        });
        
        if (potentialMessages.length > 0) {
          console.log(`Found ${potentialMessages.length} messages to fix for conversation ${conversationId}`);
          
          // Fix each message
          for (const message of potentialMessages) {
            const oldConvId = message.conversationId ? message.conversationId.toString() : 'none';
            message.conversationId = conversationId;
            await message.save();
            messagesFixed++;
            conversationHasFixes = true;
            
            console.log(`Fixed message ${message._id}: ${oldConvId} -> ${conversationId}`);
          }
        }
      }
      
      // For group chats, we would need additional logic here
      
      if (conversationHasFixes) {
        conversationsWithFixes++;
      }
    }
    
    // Find orphaned messages (sent by or to this user, but with no conversation)
    const orphanedMessagesSent = await Message.find({
      sender: req.user.id,
      $or: [
        { conversationId: { $exists: false } },
        { conversationId: null }
      ]
    });
    
    const orphanedMessagesReceived = await Message.find({
      recipientId: req.user.id,
      $or: [
        { conversationId: { $exists: false } },
        { conversationId: null }
      ]
    });
    
    const orphanedMessages = [...orphanedMessagesSent, ...orphanedMessagesReceived];
    
    console.log(`Found ${orphanedMessages.length} orphaned messages`);
    
    // Process orphaned messages
    for (const message of orphanedMessages) {
      // Try to find or create appropriate conversation
      const otherUserId = message.sender.toString() === req.user.id 
        ? message.recipientId 
        : message.sender;
      
      if (!otherUserId) {
        console.log(`Message ${message._id} has no recipient, skipping`);
        continue;
      }
      
      let conversation = await Conversation.findOne({
        type: 'direct',
        participants: { 
          $all: [
            { $elemMatch: { $eq: req.user.id } },
            { $elemMatch: { $eq: otherUserId } }
          ]
        }
      });
      
      // Create new conversation if needed
      if (!conversation) {
        conversation = new Conversation({
          type: 'direct',
          participants: [req.user.id, otherUserId],
          createdBy: req.user.id,
          lastMessage: message._id
        });
        
        await conversation.save();
        console.log(`Created new conversation ${conversation._id} for orphaned message`);
      }
      
      // Update message
      message.conversationId = conversation._id;
      await message.save();
      messagesFixed++;
      console.log(`Fixed orphaned message ${message._id} -> ${conversation._id}`);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Conversation fix completed',
      conversations: userConversations.length,
      conversationsWithFixes: conversationsWithFixes,
      messagesFixed: messagesFixed,
      orphanedFixed: orphanedMessages.length
    });
    
  } catch (error) {
    console.error('Error in fix-conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during conversation fix',
      error: error.message
    });
  }
});

module.exports = router; 