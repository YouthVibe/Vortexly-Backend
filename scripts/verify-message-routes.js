/**
 * Utility script to verify that all message controller functions are properly exported
 * 
 * Usage: node scripts/verify-message-routes.js
 */

const messageController = require('../controllers/messageController');

console.log('Verifying message controller exports...');

// List of expected functions
const expectedFunctions = [
  'getConversations',
  'getMessages',
  'sendMessage',
  'deleteMessage',
  'createGroupConversation',
  'getConversationParticipants',
  'addReaction',
  'removeReaction',
  'markMessagesAsRead',
  'updateTypingStatus',
  'updateOnlineStatus',
  'createConversation',
  'addMessage',
  'getConversation',
  'getPaginatedMessages',
  'editMessage',
  'getUserConversations',
  'markConversationAsRead',
  'getConversationMessages',
  'addConversationMessage'
];

// Check each function
let allFunctionsExist = true;
const missingFunctions = [];

for (const funcName of expectedFunctions) {
  if (typeof messageController[funcName] !== 'function') {
    console.error(`ERROR: Function '${funcName}' is not exported or not a function`);
    allFunctionsExist = false;
    missingFunctions.push(funcName);
  } else {
    console.log(`✓ Function '${funcName}' is properly exported`);
  }
}

// Summary
console.log('\n=== Summary ===');
if (allFunctionsExist) {
  console.log('All message controller functions are properly exported!');
} else {
  console.error(`Missing ${missingFunctions.length} functions: ${missingFunctions.join(', ')}`);
  console.log('\nPlease check the messageController.js file to make sure these functions are defined and exported correctly.');
}

// List all actually exported functions
console.log('\nAll exported properties:');
Object.keys(messageController).forEach(key => {
  const type = typeof messageController[key];
  console.log(`- ${key} (${type})`);
});

// Output success message
console.log('\nVerification complete!'); 