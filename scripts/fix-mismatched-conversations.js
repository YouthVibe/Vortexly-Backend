/**
 * This script specifically fixes messages that have been saved with incorrect conversationIds
 * by comparing the conversation IDs in the database with those in the messages and fixing the mismatches.
 * 
 * It's for cases where we know both the correct conversation ID and the incorrect one that's being used.
 */

const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    console.log('Connecting to MongoDB...');
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    console.log(`Using database: ${uri.split('/').pop().split('?')[0]}`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Disconnect from MongoDB
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
}

// Fix messages with specifically known incorrect conversationIds
async function fixMismatchedMessages() {
  try {
    // Get all conversations
    const conversations = await Conversation.find({}).lean();
    console.log(`Found ${conversations.length} conversations`);
    
    let totalFixed = 0;
    let totalProcessed = 0;
    
    // For each conversation, find messages that should belong to it based on participants
    for (const conversation of conversations) {
      const conversationId = conversation._id.toString();
      const participants = conversation.participants.map(p => p.toString());
      
      console.log(`Processing conversation ${conversationId} with participants:`, participants);
      
      // Get all messages for any participant
      for (const participantId of participants) {
        // Find messages sent by this participant
        const messages = await Message.find({ 
          sender: participantId,
          // Check if conversationId doesn't match current conversation
          conversationId: { $ne: conversationId }
        }).lean();
        
        for (const message of messages) {
          totalProcessed++;
          const messageConversationId = message.conversationId.toString();
          
          console.log(`Checking message ${message._id} from sender ${participantId}`);
          console.log(`  Current conversationId: ${messageConversationId}`);
          console.log(`  Expected conversationId: ${conversationId}`);
          
          // Check if this message should be in the current conversation
          // For direct conversations, check if both participants match
          if (conversation.type === 'direct' && participants.length === 2) {
            // Get the recipient from the other messages in the wrong conversation
            const wrongConversation = await Conversation.findById(messageConversationId).lean();
            
            if (!wrongConversation) {
              console.log(`  No wrong conversation found with ID ${messageConversationId}, skipping`);
              continue;
            }
            
            const wrongConversationParticipants = wrongConversation.participants.map(p => p.toString());
            
            // Check if the participants in both conversations are the same
            const sameParticipants = 
              participants.length === wrongConversationParticipants.length &&
              participants.every(p => wrongConversationParticipants.includes(p));
            
            if (sameParticipants) {
              console.log(`  This message belongs to conversation ${conversationId}, fixing...`);
              
              await Message.updateOne(
                { _id: message._id },
                { conversationId: conversationId }
              );
              
              totalFixed++;
              console.log(`  Fixed message ${message._id}`);
            } else {
              console.log(`  Different participants, not changing`);
            }
          }
        }
      }
    }
    
    console.log("\nSummary:");
    console.log(`Total messages processed: ${totalProcessed}`);
    console.log(`Total messages fixed: ${totalFixed}`);
  } catch (error) {
    console.error('Error fixing messages:', error);
  }
}

// Fix specific conversation ID mismatch from the examples provided
async function fixSpecificMismatch() {
  try {
    // The examples provided in the issue:
    const correctConversationId = "67eea227d24e01e365e76d3d";
    const wrongConversationId = "67eea1f425d1d2912cd681a4";
    
    console.log(`Fixing messages with conversationId ${wrongConversationId} to use ${correctConversationId}`);
    
    // Find and update all messages with the wrong ID
    const result = await Message.updateMany(
      { conversationId: wrongConversationId },
      { $set: { conversationId: correctConversationId } }
    );
    
    console.log(`Updated ${result.nModified || result.modifiedCount} messages`);
    
    // Now check if there are any other messages with missing conversations
    const orphanedMessages = await Message.find({
      conversationId: { $exists: true }
    }).lean();
    
    // Check each message to see if its conversation exists
    let orphanCount = 0;
    for (const message of orphanedMessages) {
      const conversationExists = await Conversation.findById(message.conversationId).lean();
      if (!conversationExists) {
        orphanCount++;
        console.log(`Message ${message._id} has conversationId ${message.conversationId} but no matching conversation exists`);
      }
    }
    
    console.log(`Found ${orphanCount} orphaned messages (with no matching conversation)`);
  } catch (error) {
    console.error('Error fixing specific mismatch:', error);
  }
}

// Main function
async function main() {
  try {
    await connectDB();
    
    // First run the general fix
    await fixMismatchedMessages();
    
    // Then fix the specific example mismatch
    await fixSpecificMismatch();
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    await disconnectDB();
  }
}

// Run the script
main(); 