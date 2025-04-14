/**
 * Helper script to run the fix-conversation-messages.js script
 * This script sets up the MongoDB URI from the main server configuration
 */

// Require the fixConversationMessages function from our fix script
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// MongoDB connection string (using the one from server.js)
// If you're getting connection errors, replace this with your actual MongoDB connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://Swaraj:****@vortexly.nhyawek.mongodb.net/vortexly?retryWrites=true&w=majority&appName=vortexly';
const dbName = process.env.MONGODB_DB_NAME || 'vortexly';

// Function to fix the conversationId in messages collection
async function fixConversationMessages() {
  // Check if we have the MongoDB URI
  if (!uri) {
    console.error('MongoDB URI not found. Please set it manually in this script.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  console.log(`Using database: ${dbName}`);
  const client = new MongoClient(uri);

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const messagesCollection = db.collection('messages');
    const conversationsCollection = db.collection('conversations');

    // Get all messages
    const messages = await messagesCollection.find({}).toArray();
    console.log(`Found ${messages.length} messages to check`);

    let updateCount = 0;
    let noMatchCount = 0;
    
    // Process each message
    for (const message of messages) {
      // Check if the conversationId points to a valid conversation
      const messageConvId = message.conversationId;
      
      if (!messageConvId) {
        console.log(`Message ${message._id} has no conversationId, skipping`);
        continue;
      }
      
      let conversationObjectId;
      try {
        conversationObjectId = new ObjectId(messageConvId);
      } catch (error) {
        console.log(`Message ${message._id} has invalid conversationId format: ${messageConvId}`);
        // Try to extract string form if it's an object with a toString method
        if (typeof messageConvId === 'object' && messageConvId !== null) {
          try {
            const convIdStr = messageConvId.toString();
            console.log(`Attempting to use string representation: ${convIdStr}`);
            try {
              conversationObjectId = new ObjectId(convIdStr);
            } catch (e) {
              console.log(`Failed to convert string representation to ObjectId`);
            }
          } catch (e) {
            console.log(`Failed to get string representation of conversationId`);
          }
        }
      }
      
      // Skip if we couldn't get a valid ObjectId
      if (!conversationObjectId) {
        console.log(`Couldn't get valid ObjectId for message ${message._id}, trying to find by sender`);
      } else {
        // First check if the current conversationId is valid
        const conversation = await conversationsCollection.findOne({ 
          _id: conversationObjectId
        });
        
        if (conversation) {
          console.log(`Message ${message._id} already has valid conversationId: ${conversationObjectId}`);
          // Make sure it's stored as a string
          if (typeof message.conversationId !== 'string') {
            console.log(`  Converting conversationId to string format`);
            await messagesCollection.updateOne(
              { _id: message._id },
              { $set: { conversationId: conversationObjectId.toString() } }
            );
            updateCount++;
          }
          continue;
        }
      }
      
      console.log(`Message ${message._id} has invalid conversationId: ${messageConvId}`);
      
      // Look for a conversation that contains the sender
      let foundConversation = null;
      
      // Since the sender ID is available in the message, we can use that
      const senderId = message.sender;
      
      if (!senderId) {
        console.log(`Message ${message._id} has no sender, skipping`);
        noMatchCount++;
        continue;
      }
      
      let senderObjectId;
      try {
        senderObjectId = new ObjectId(senderId);
      } catch (error) {
        console.log(`Message ${message._id} has invalid sender format: ${senderId}`);
        noMatchCount++;
        continue;
      }
      
      // Find all conversations where this sender is a participant
      const possibleConversations = await conversationsCollection.find({
        participants: senderObjectId
      }).toArray();
      
      if (possibleConversations.length === 0) {
        console.log(`No conversations found for sender ${senderId}`);
        noMatchCount++;
        continue;
      }
      
      console.log(`Found ${possibleConversations.length} possible conversations for sender ${senderId}`);
      
      // If there's only one conversation, use that
      if (possibleConversations.length === 1) {
        foundConversation = possibleConversations[0];
      } else {
        // If there are multiple, we need to look for the most recent one
        // Sort by updatedAt descending (most recent first)
        possibleConversations.sort((a, b) => {
          const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0);
          const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0);
          return dateB - dateA;
        });
        foundConversation = possibleConversations[0];
      }
      
      if (foundConversation) {
        const newConversationId = foundConversation._id.toString();
        console.log(`Updating message ${message._id} conversationId from ${messageConvId} to ${newConversationId}`);
        
        // Update the message
        await messagesCollection.updateOne(
          { _id: message._id },
          { $set: { conversationId: newConversationId } }
        );
        
        updateCount++;
      } else {
        console.log(`Could not find a suitable conversation for message ${message._id}`);
        noMatchCount++;
      }
    }

    console.log(`\nSummary:`);
    console.log(`Total messages checked: ${messages.length}`);
    console.log(`Messages updated: ${updateCount}`);
    console.log(`Messages with no matching conversation: ${noMatchCount}`);
    console.log(`Messages already correct: ${messages.length - updateCount - noMatchCount}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the function
console.log('Starting fix script...');
require('./fix-conversation-messages.js'); 