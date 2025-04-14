const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const messageController = require('../controllers/messageController');

// Get all conversations for the authenticated user
router.get('/conversations', authMiddleware, messageController.getConversations);

// Find a conversation with a user (doesn't create one)
router.get('/find-with-user/:userId', authMiddleware, messageController.findConversationWithUser);

// Get conversation details by ID (used to verify existence)
router.get('/conversation/:id', authMiddleware, messageController.findSingleConversation);

// Find or create a conversation with another user
router.post('/find-or-create', authMiddleware, messageController.findOrCreateConversation);

// Send message in a new conversation
router.post('/new-conversation', authMiddleware, messageController.createConversationAndSendMessage);

// Send a message to a conversation
router.post('/:conversationId', authMiddleware, messageController.sendMessage);

// Get messages from a conversation
router.get('/:conversationId', authMiddleware, messageController.getMessages);

// Mark a conversation as read
router.post('/:conversationId/read', authMiddleware, messageController.markConversationAsRead);

// New routes for enhanced chat features
// Delete a message
router.delete('/message/:messageId', authMiddleware, messageController.deleteMessage);

// Edit a message
router.put('/message/:messageId', authMiddleware, messageController.editMessage);

// Add reaction to a message
router.post('/reaction/:messageId', authMiddleware, messageController.addReaction);

// Remove reaction from a message
router.delete('/reaction/:messageId/:reactionId', authMiddleware, messageController.removeReaction);

// Upload media in a conversation (for handling multiple files)
router.post('/media/:conversationId', authMiddleware, messageController.sendMediaMessage);

module.exports = router; 