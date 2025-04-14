/**
 * Utility script to check and fix conversation issues
 * 
 * Usage: 
 * - Check a specific conversation: node scripts/check-conversation.js <conversationId>
 * - Check all conversations: node scripts/check-conversation.js all
 */

const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

// Get conversation ID from command line arguments
const conversationId = process.argv[2];

if (!conversationId) {
  console.error('Please provide a conversation ID or "all" to check all conversations');
  mongoose.disconnect();
  process.exit(1);
}

// Check if conversation exists and has the correct structure
const checkConversation = async (id) => {
  try {
    console.log(`\nChecking conversation: ${id}`);
    
    // Find the conversation
    const conversation = await Conversation.findById(id)
      .populate('participants', '_id name fullName email profileImage');
    
    if (!conversation) {
      console.error(`Conversation not found: ${id}`);
      return false;
    }
    
    console.log('Conversation found:');
    console.log(`- Type: ${conversation.type}`);
    console.log(`- Created: ${conversation.createdAt}`);
    console.log(`- Messages embedded: ${conversation.messages ? conversation.messages.length : 0}`);
    console.log(`- Participants: ${conversation.participants.length}`);
    
    // Check for messages collection messages
    const externalMessages = await Message.find({ conversationId: id }).countDocuments();
    console.log(`- External messages: ${externalMessages}`);
    
    // Check participants
    if (conversation.participants.length === 0) {
      console.error('ERROR: Conversation has no participants');
      return false;
    }
    
    // List participants
    console.log('\nParticipants:');
    conversation.participants.forEach(p => {
      console.log(`- ${p.name} (${p._id}) - ${p.email || 'No email'}`);
    });
    
    // Check for missing fields and fix if needed
    let needsSave = false;
    
    // Check if messages array exists
    if (!conversation.messages) {
      console.log('FIXING: Adding empty messages array');
      conversation.messages = [];
      needsSave = true;
    }
    
    // Check if unreadCount map exists
    if (!conversation.unreadCount) {
      console.log('FIXING: Adding unreadCount map');
      conversation.unreadCount = new Map();
      conversation.participants.forEach(p => {
        conversation.unreadCount.set(p._id.toString(), 0);
      });
      needsSave = true;
    }
    
    // Check totalMessages
    if (typeof conversation.totalMessages !== 'number') {
      console.log('FIXING: Setting totalMessages');
      conversation.totalMessages = conversation.messages.length;
      needsSave = true;
    }
    
    // Save changes if needed
    if (needsSave) {
      await conversation.save();
      console.log('Saved fixes to conversation');
    } else {
      console.log('No fixes needed');
    }
    
    return true;
  } catch (error) {
    console.error(`Error checking conversation ${id}:`, error);
    return false;
  }
};

// Check all conversations
const checkAllConversations = async () => {
  try {
    console.log('Checking all conversations...');
    
    const conversations = await Conversation.find({});
    console.log(`Found ${conversations.length} conversations`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];
      const success = await checkConversation(conversation._id);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    
    console.log('\n==== Summary ====');
    console.log(`Total conversations: ${conversations.length}`);
    console.log(`Successful checks: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
  } catch (error) {
    console.error('Error checking all conversations:', error);
  }
};

// Main function
const main = async () => {
  try {
    if (conversationId === 'all') {
      await checkAllConversations();
    } else {
      await checkConversation(conversationId);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

// Run the main function
main(); 