# Step-by-Step Guide to Send FCM Test Notification

## Prerequisites

- Node.js installed on your computer
- The Alzheimer's Care app installed and running on your device

## Steps to Send a Test Notification

### Step 1: Get Your Device Token

1. Open the app on your device
2. Navigate to the "FCM Token" tab
3. You'll see your FCM token displayed
4. Use the "Share" button to share the token to yourself (email, messaging, etc.)
   or use the "Print to Console" button and check your development console

### Step 2: Set Up the Server Code

1. Open a command prompt or terminal
2. Navigate to the server directory:
   ```
   cd path/to/new-alz/server
   ```
3. Install the required dependencies:
   ```
   npm install
   ```

### Step 3: Update the Device Token

1. Open the `send-test-notification.js` file in a text editor
2. Find this line:
   ```javascript
   const YOUR_DEVICE_TOKEN = "PASTE_YOUR_DEVICE_TOKEN_HERE";
   ```
3. Replace 'PASTE_YOUR_DEVICE_TOKEN_HERE' with your actual FCM token from Step 1
4. Save the file

### Step 4: Send the Test Notification

1. In your terminal/command prompt (still in the server directory), run:
   ```
   npm run send-test
   ```
2. You should see output indicating the notification was sent successfully
3. Check your device - you should see the test notification appear

### Troubleshooting

If you don't receive the notification:

1. Make sure you've correctly pasted your full device token
2. Ensure your device has an internet connection
3. Check that notifications are enabled for the app in your device settings
4. Try restarting the app and resending the notification

### Example Success Output

```
Sending test notification...
Target device: cMr9jKtY0U...
Success! Notification sent.
Check your device to confirm the notification was received.
```
