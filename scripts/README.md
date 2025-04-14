# Database Fix Scripts

This folder contains scripts to fix database issues in the YouthVibes application.

## Fix Conversation Messages Script

`fix-conversation-messages.js` is a utility script to address an issue where message documents in the database have incorrect `conversationId` values. This can happen when the MongoDB ObjectId is stored as an object instead of a string.

### What the script does:

1. Connects to your MongoDB database
2. Finds all messages with invalid conversationIds
3. Locates the correct conversation based on the sender's participation
4. Updates the message with the correct conversationId
5. Provides a summary of fixed messages

### How to run the script:

1. Make sure your `.env` file is properly configured with your MongoDB connection string in the root directory:
   ```
   MONGODB_URI=mongodb://username:password@host:port/database
   MONGODB_DB_NAME=vortexly
   ```

2. From the backend directory, run:
   ```
   node scripts/fix-conversation-messages.js
   ```

3. The script will output progress and a final summary of all changes made

### When to run this script:

Run this script if you're encountering any of these issues:
- Messages not appearing in conversations
- Errors like "Cannot read properties of undefined" when accessing conversations
- Chat screen showing "[object Object]" for conversation IDs

### After running the script:

The script has fixed existing messages, but to prevent this issue from occurring in the future, we've also updated the `messageController.js` file to ensure that conversation IDs are always stored as strings. 