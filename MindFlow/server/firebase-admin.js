/**
 * FCM Notification Sender using Firebase Admin SDK
 * 
 * A more secure and recommended approach for sending FCM notifications
 */

const admin = require('firebase-admin');

// Initialize the app with the service account
// You need to generate a private key for your service account
// and save it as serviceAccountKey.json
try {
  admin.initializeApp({
    credential: admin.credential.cert(require('./serviceAccountKey.json'))
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  console.log('\nIMPORTANT: You need to download the service account key file.');
  console.log('Follow these steps:');
  console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
  console.log('2. Click "Generate new private key"');
  console.log('3. Save the JSON file as "serviceAccountKey.json" in this directory');
}

/**
 * Send a notification to a specific device using Firebase Admin SDK
 * 
 * @param {string} deviceToken - The FCM token of the device
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data to send with the notification
 * @returns {Promise<string>} Message ID if successful
 */
async function sendNotification(deviceToken, title, body, data = {}) {
  // Message structure
  const message = {
    notification: {
      title,
      body
    },
    data,
    token: deviceToken,
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    }
  };

  try {
    // Send the message
    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * Send notification to multiple devices at once
 * 
 * @param {string[]} deviceTokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Response with success and failure counts
 */
async function sendMulticastNotification(deviceTokens, title, body, data = {}) {
  // Message structure (without the token)
  const message = {
    notification: {
      title,
      body
    },
    data,
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    },
    tokens: deviceTokens // Send to multiple devices
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(`${response.successCount} messages were sent successfully`);
    
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: deviceTokens[idx],
            error: resp.error
          });
          
          // Check if the token is invalid and should be removed
          if (resp.error.code === 'messaging/registration-token-not-registered') {
            removeInvalidToken(deviceTokens[idx])
              .catch(err => console.error(`Error removing invalid token ${deviceTokens[idx]}:`, err));
          }
        }
      });
      console.error('List of tokens that caused failures:', failedTokens);
    }
    
    return response;
  } catch (error) {
    console.error('Error sending multicast messages:', error);
    throw error;
  }
}

/**
 * Remove an invalid token from your database
 * 
 * @param {string} token - The invalid FCM token to remove
 * @returns {Promise<boolean>} true if successfully removed
 */
async function removeInvalidToken(token) {
  console.log(`Marking token as invalid: ${token.substring(0, 10)}...`);
  
  // TODO: Implement your database logic to:
  // 1. Mark this token as invalid in your database
  // 2. Or remove it completely
  // 3. Update the user record to indicate they need a new token
  
  // Example implementation for a database:
  /*
  try {
    // Connect to your database
    const db = await connectToDatabase();
    
    // Update the token status in your database
    await db.collection('device_tokens').updateOne(
      { token },
      { $set: { valid: false, invalidatedAt: new Date() } }
    );
    
    console.log('Token marked as invalid in database');
    return true;
  } catch (error) {
    console.error('Error updating token in database:', error);
    throw error;
  }
  */
  
  // Placeholder implementation
  return Promise.resolve(true);
}

module.exports = {
  sendNotification,
  sendMulticastNotification,
  removeInvalidToken
}; 