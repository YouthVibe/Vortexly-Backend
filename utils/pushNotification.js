const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

// Send push notification
async function sendPushNotification(pushToken, title, body, data = {}) {
  try {
    // Check that all push tokens appear to be valid Expo push tokens
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
      data,
    };

    // Send the notification
    const ticket = await expo.sendPushNotificationsAsync([message]);
    console.log('Push notification sent:', ticket);

    return ticket;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

module.exports = {
  sendPushNotification,
}; 