/**
 * Migration script to convert existing messages from the Message collection
 * to be embedded directly in Conversation documents
 * 
 * Usage: node scripts/migrate-to-embedded-messages.js
 */

const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
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

async function migrateMessages() {
  try {
    console.log('Starting message migration to embedded format...');
    
    // Get all conversations
    const conversations = await Conversation.find({});
    console.log(`Found ${conversations.length} conversations to process`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Process each conversation
    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];
      const conversationId = conversation._id;
      
      console.log(`\nProcessing conversation ${i+1}/${conversations.length}: ${conversationId}`);
      
      try {
        // Find messages for this conversation, sort by most recent first
        const messages = await Message.find({ conversationId })
          .sort({ createdAt: -1 })
          .populate('sender', '_id name fullName profileImage');
          
        console.log(`Found ${messages.length} messages for conversation ${conversationId}`);
        
        // Skip if no messages or conversation already has embedded messages
        if (messages.length === 0) {
          console.log(`Skipping conversation ${conversationId} - no messages found`);
          skippedCount++;
          continue;
        }
        
        if (conversation.messages && conversation.messages.length > 0) {
          console.log(`Skipping conversation ${conversationId} - already has ${conversation.messages.length} embedded messages`);
          skippedCount++;
          continue;
        }
        
        // Convert only the latest 100 messages (as per the requirement)
        const latestMessages = messages.slice(0, 100);
        
        // Prepare the embedded message format
        const embeddedMessages = latestMessages.map(msg => ({
          _id: msg._id,
          sender: msg.sender._id,
          content: msg.content || '',
          media: msg.media,
          mediaType: msg.mediaType,
          mediaWidth: msg.mediaWidth,
          mediaHeight: msg.mediaHeight,
          mediaDuration: msg.mediaDuration,
          mediaThumbnail: msg.mediaThumbnail,
          repliedTo: msg.repliedTo,
          reactions: msg.reactions || [],
          readBy: msg.readBy || [],
          readReceipts: msg.readReceipts || new Map(),
          deliveryStatus: msg.deliveryStatus,
          isSystemMessage: msg.isSystemMessage,
          isDeleted: msg.isDeleted,
          isEdited: msg.isEdited,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt
        }));
        
        // Set the embedded messages in the conversation (in correct order: newest first)
        conversation.messages = embeddedMessages;
        
        // Update last message preview
        if (latestMessages.length > 0) {
          const latest = latestMessages[0];
          conversation.lastMessagePreview = {
            content: latest.content,
            sender: latest.sender._id,
            createdAt: latest.createdAt
          };
        }
        
        // Update total message count
        conversation.totalMessages = messages.length;
        
        // Save the updated conversation
        await conversation.save();
        
        console.log(`Successfully embedded ${embeddedMessages.length} messages in conversation ${conversationId}`);
        successCount++;
      } catch (convError) {
        console.error(`Error processing conversation ${conversationId}:`, convError);
        errorCount++;
      }
    }
    
    console.log('\n==== Migration Summary ====');
    console.log(`Total conversations: ${conversations.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    console.log('\nMigration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateMessages(); 