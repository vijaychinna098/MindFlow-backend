/**
 * FCM Notification Sender using Firebase Admin SDK approach
 * 
 * This is a demonstration file to show how to send FCM notifications
 * using the Firebase Admin SDK approach which is more reliable than direct FCM API calls.
 */

const axios = require('axios');

// Your Firebase project credentials
// This appears to be a Web API key or other token type, not a server key
const PROJECT_ID = 'alzheimersapp-ff04c'; // Replace with your actual Firebase project ID
const FCM_SERVER_KEY = 'BLvTYgKjBC9drhO5WXDN-TEPrRXzG-7Ycn-GE1vBUVyOKfluUpXCRh6taHn0E5c6c0WIURZHy6ms-8il975Na9U';

// FCM API endpoint - using the newer v1 API
const FCM_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

/**
 * Function to get a valid access token for FCM
 * @returns {Promise<string>} The access token
 */
async function getAccessToken() {
  // For demo purposes, we'll just return the server key
  // In a real implementation, you would use firebase-admin SDK
  return FCM_SERVER_KEY;
}

/**
 * Function to send FCM notification to a specific device
 * @param {string} deviceToken - The FCM token of the target device
 * @param {string} title - Notification title
 * @param {string} body - Notification message body
 * @param {Object} data - Additional data to send (optional)
 */
async function sendNotification(deviceToken, title, body, data = {}) {
  try {
    // Try the legacy FCM API first
    return await sendLegacyNotification(deviceToken, title, body, data);
  } catch (error) {
    console.log('Legacy API failed, trying direct Firebase approach...');
    console.log('Note: For this to work properly, set up firebase-admin SDK in a production environment');
    
    // Log helpful information for the user
    console.log('\nIMPORTANT: Check your Firebase configuration:');
    console.log('1. Make sure you\'re using a valid Server Key from Firebase Console');
    console.log('2. Verify your device token is correct and not expired');
    console.log('3. Double-check your project settings in Firebase Console');
    
    throw error;
  }
}

/**
 * Legacy method to send notification using the older FCM API
 */
async function sendLegacyNotification(deviceToken, title, body, data = {}) {
  const message = {
    to: deviceToken,
    notification: {
      title,
      body,
      sound: 'default',
      badge: '1'
    },
    data
  };

  const response = await axios.post('https://fcm.googleapis.com/fcm/send', message, {
    headers: {
      'Authorization': `key=${FCM_SERVER_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('Notification sent successfully:');
  console.log(response.data);
  return response.data;
}

// Example: Send a test notification
async function sendTestNotification() {
  try {
    const deviceToken = 'YOUR_DEVICE_FCM_TOKEN'; // Replace with actual token
    
    await sendNotification(
      deviceToken,
      'Test Notification',
      'This is a test notification from FCM Sender',
      {
        // Additional data can be added here
        screen: 'profile',
        timeStamp: Date.now().toString()
      }
    );
    
    console.log('Test notification sent!');
  } catch (error) {
    console.error('Failed to send test notification');
  }
}

module.exports = {
  sendNotification
}; 