# FCM Server for Alzheimer's Care App

This folder contains scripts to test and send Firebase Cloud Messaging (FCM) notifications to your app.

## Setup

1. Make sure you have Node.js installed on your machine
2. Open a terminal/command prompt and navigate to this directory
3. Install dependencies by running:
   ```
   npm install
   ```

## How to Send Test Notifications

1. Get your device's FCM token from the app:

   - Open the app on your device
   - Go to the "FCM Token" tab
   - You'll see your device token displayed
   - Use the "Share" or "Copy" button to get the token

2. Edit the `send-test-notification.js` file:

   - Find the line with `const YOUR_DEVICE_TOKEN = '';`
   - Paste your FCM token between the quotes

3. Run the test script:

   ```
   npm run send-test
   ```

4. Check your device - you should receive a notification!

## Understanding the Files

- `fcm-sender.js`: The main module with the FCM sending functionality
- `send-test-notification.js`: A script to send a test notification
- `package.json`: Contains the dependencies and scripts

## Server Key Information

The server key included in these files (`BLvTYgKjBC9drhO5WXDN-TEPrRXzG-7Ycn-GE1vBUVyOKfluUpXCRh6taHn0E5c6c0WIURZHy6ms-8il975Na9U`) is your Firebase Cloud Messaging server key. This key allows your server to authenticate with Firebase to send messages to your app.

**Important Security Note**:

- Keep your server key confidential
- Only use it in secure server environments
- Do not include it in client-side code or public repositories

## Sending to Multiple Devices

To send notifications to multiple devices, modify the `fcm-sender.js` file and create a function that accepts an array of device tokens instead of a single token.

## Troubleshooting

If notifications aren't working:

1. Verify your device token is correct
2. Check your internet connection
3. Make sure Firebase Cloud Messaging is properly set up in your app
4. Review the Firebase console for any errors
5. Ensure your app has notification permissions
