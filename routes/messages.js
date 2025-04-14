const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// ==== NEW EMBEDDED MESSAGE ROUTES ====
// Get embedded messages for a conversation
router.get('/embedded/:conversationId', messageController.getConversationMessages);

// Add a message to the conversation document
router.post('/embedded', messageController.addConversationMessage);

// ==== SIMPLIFIED API ROUTES ====
// Find or create a conversation with another user
router.post('/find-or-create', messageController.findOrCreateConversation);

// ==== EXISTING ROUTES (FOR BACKWARD COMPATIBILITY) ====
// Create a new conversation (direct or group)
router.post('/create-conversation', messageController.findOrCreateConversation);

// Add a new message to a conversation with pagination
router.post('/add-message', messageController.sendMessage);

// Get conversation details
router.get('/conversation/:id', messageController.findSingleConversation);

// Get paginated messages for a conversation
router.get('/get-messages/:conversationId', messageController.getMessages);

// Get all conversations for a user
router.get('/conversations', messageController.getConversations);

// Create a group conversation
router.post('/group', messageController.createGroupConversation);

// Get participants in a conversation
router.get('/participants/:conversationId', messageController.getConversationParticipants);

// Mark messages as read
router.post('/:conversationId/read', messageController.markMessagesAsRead);

// Add new route to match the updated frontend path
router.put('/read/:conversationId', messageController.markConversationAsRead);

// Update typing status
router.post('/:conversationId/typing', messageController.updateTypingStatus);

// Update online status
router.post('/status/online', messageController.updateOnlineStatus);

// Add reaction to a message
router.post('/reactions/:messageId', messageController.addReaction);

// New route for adding reactions to messages in conversation documents
router.post('/conversation-reactions/:conversationId/:messageId', messageController.addConversationMessageReaction);

// New route for removing reactions from messages in conversation documents
router.delete('/conversation-reactions/:conversationId/:messageId', messageController.removeConversationMessageReaction);

// Remove reaction from a message
router.delete('/reactions/:messageId', messageController.removeReaction);

// Edit a message
router.put('/:messageId/edit', messageController.editMessage);

// Send a message (IMPORTANT: Keep these at the end to avoid route conflicts)
router.post('/:conversationId', messageController.sendMessage);

// Delete a message
router.delete('/:messageId', messageController.deleteMessage);

// Get messages for a specific conversation (IMPORTANT: Keep this at the end to avoid route conflicts)
router.get('/:conversationId', messageController.getMessages);

module.exports = router; 