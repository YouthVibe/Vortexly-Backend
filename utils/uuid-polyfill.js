/**
 * Polyfill for crypto.getRandomValues required by UUID in Node.js environments
 * that might not have it available
 */

function setupUUIDPolyfill() {
  if (typeof global !== 'undefined' && !global.crypto) {
    const nodeCrypto = require('crypto');
    
    global.crypto = {
      getRandomValues: function(array) {
        return nodeCrypto.randomFillSync(array);
      }
    };
    
    console.log('UUID polyfill setup for Node.js environment');
  }
}

// Setup the polyfill immediately when this module is imported
setupUUIDPolyfill();

module.exports = { setupUUIDPolyfill }; 