/**
 * Test script to send a notification using FCM
 * 
 * How to use:
 * 1. Make sure you have Node.js installed
 * 2. Navigate to the server directory
 * 3. Run 'npm install' to install dependencies
 * 4. Edit this file to add your device token 
 * 5. Run 'npm run send-test' to send a test notification
 */

const { sendNotification } = require('./fcm-sender');

/**
 * IMPORTANT: Replace this with your actual device token from the app
 * You can get this token from:
 * 1. The FCM Token screen in your app
 * 2. The console logs when the app starts
 */
const YOUR_DEVICE_TOKEN = 'dCxBiV0SQk2zGduQwwdb7i:APA91bEh1C6kgu5h8QlOcT3sA3q-NuEWkeig40RGcOIXxc_226hH3lDZ37RzqH5TR_aVdMz2jD0ztjWv3EblmjYVAttWCQHIeGS0t5sT_qPWTwgIJvmnLJc'; // Add your device token here

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
    console.log('\x1b[34m%s\x1b[0m', 'Sending test notification...');
    console.log(`Target device: ${YOUR_DEVICE_TOKEN.substring(0, 10)}...`);
    
    await sendNotification(
      YOUR_DEVICE_TOKEN,
      'Test Notification',
      'This is a test message from your server. If you received this, your FCM setup is working!',
      {
        screen: 'profile',
        timeStamp: Date.now().toString(),
        testId: 'fcm-test-01'
      }
    );
    
    console.log('\x1b[32m%s\x1b[0m', 'Success! Notification sent.');
    console.log('Check your device to confirm the notification was received.');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to send notification:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the test
runTest(); 