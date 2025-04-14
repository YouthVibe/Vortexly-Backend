const Expo = require('expo-server-sdk').default;

// Create a new Expo SDK client
let expo = new Expo();

/**
 * Send a push notification to a user
 * @param {string} pushToken - The Expo push token to send to
 * @param {string} title - The title of the notification
 * @param {string} body - The body text of the notification
 * @param {object} data - Optional data to include with the notification
 * @returns {Promise<void>}
 */
exports.sendPushNotification = async (pushToken, title, body, data = {}) => {
  try {
    // Check if the push token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      return;
    }

    // Construct the message
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: { ...data, timestamp: new Date().toISOString() },
      badge: 1,
    };

    // Send the message
    const chunks = expo.chunkPushNotifications([message]);
    
    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log('Push notification sent:', ticketChunk);
      } catch (error) {
        console.error('Error sending chunk:', error);
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

/**
 * Send push notifications to multiple users
 * @param {Array<string>} pushTokens - Array of Expo push tokens
 * @param {string} title - The title of the notification
 * @param {string} body - The body text of the notification
 * @param {object} data - Optional data to include with the notification
 * @returns {Promise<void>}
 */
exports.sendMultiplePushNotifications = async (pushTokens, title, body, data = {}) => {
  try {
    // Filter out any invalid tokens
    const validTokens = pushTokens.filter(token => Expo.isExpoPushToken(token));
    
    if (validTokens.length === 0) {
      console.log('No valid push tokens provided');
      return;
    }

    // Create messages for each token
    const messages = validTokens.map(pushToken => ({
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: { ...data, timestamp: new Date().toISOString() },
      badge: 1,
    }));

    // Chunk and send the messages
    const chunks = expo.chunkPushNotifications(messages);
    
    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log(`Sent ${ticketChunk.length} push notifications`);
      } catch (error) {
        console.error('Error sending chunk:', error);
      }
    }
  } catch (error) {
    console.error('Error sending multiple push notifications:', error);
  }
}; 