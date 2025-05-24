/**
 * Test script to send a notification using Firebase Admin SDK
 * 
 * How to use:
 * 1. Download your service account key from Firebase Console
 * 2. Save it as "serviceAccountKey.json" in this directory
 * 3. Run 'npm install' to install dependencies
 * 4. Edit this file to add your device token 
 * 5. Run 'npm run send-admin' to send a test notification
 */

const { sendNotification, removeInvalidToken } = require('./firebase-admin');

/**
 * IMPORTANT: Replace this with your actual device token from the app
 * You can get this token from:
 * 1. The FCM Token screen in your app
 * 2. The console logs when the app starts
 */
// Get the latest FCM token from the app - must be a valid and freshly generated token
const YOUR_DEVICE_TOKEN = 'eCNgktCVS6Gpn1UN4f2x5W:APA91bHeWtGsAZUXNDbSkGWxj8TTIOE10Ng4Ij8aMFf98Z_JoXKYRGEQA7O5M8GPgIAtZMwCbPUPGmlLtEuWkjm-WvlXtHqfVlM1ACQ2fjdTYadY1NGZJY4';

// If no token was provided or still using placeholder
if (!YOUR_DEVICE_TOKEN || YOUR_DEVICE_TOKEN === 'PASTE_YOUR_DEVICE_TOKEN_HERE') {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: No device token provided!');
  console.log('Please get your FCM token from the app and add it to this file.');
  console.log('See the "FCM Token" tab in your app or check the console logs.');
  process.exit(1);
}

// Send a test notification
async function runTest() {
  try {
    console.log('\x1b[34m%s\x1b[0m', 'Sending test notification using Firebase Admin SDK...');
    console.log(`Target device: ${YOUR_DEVICE_TOKEN.substring(0, 10)}...`);
    
    await sendNotification(
      YOUR_DEVICE_TOKEN,
      'Admin SDK Test',
      'This notification was sent using the Firebase Admin SDK. If you received this, your FCM setup is working!',
      {
        screen: 'profile',
        timeStamp: Date.now().toString(),
        testId: 'admin-sdk-test-01'
      }
    );
    
    console.log('\x1b[32m%s\x1b[0m', 'Success! Notification sent.');
    console.log('Check your device to confirm the notification was received.');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to send notification:');
    console.error(error.message);
    
    // Handle specific FCM token errors
    if (error.errorInfo && error.errorInfo.code === 'messaging/registration-token-not-registered') {
      console.log('\n\x1b[33m%s\x1b[0m', 'INVALID TOKEN DETECTED: The FCM token is no longer valid.');
      console.log('Please get a fresh token from the app by:');
      console.log('1. Restarting the app');
      console.log('2. Going to the FCM Token tab');
      console.log('3. Copy the new token and update this file');
      
      // Mark token as invalid in your database if needed
      try {
        await removeInvalidToken(YOUR_DEVICE_TOKEN);
      } catch (removeError) {
        console.error('Error removing invalid token:', removeError.message);
      }
    } else if (error.message.includes('service account')) {
      console.log('\nDid you download and save the service account key file?');
      console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
      console.log('2. Click "Generate new private key"');
      console.log('3. Save the JSON file as "serviceAccountKey.json" in this directory');
    }
    
    process.exit(1);
  }
}

// Run the test
runTest(); 