# Firebase Cloud Messaging Setup Guide

## The Problem

You're getting a 404 error when trying to send FCM notifications. This is likely because the server key you're using isn't a valid FCM server key or there's a configuration issue with your Firebase project.

## Proper Firebase Setup Steps

### 1. Get a Valid Server Key

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (click the gear icon)
4. Select the "Cloud Messaging" tab
5. Find the "Server key" under "Project credentials"
6. Copy this key - it should look like `AAAA[random characters]:APA91b[more random characters]`

### 2. Update Your Code

1. Open the `fcm-sender.js` file
2. Replace the `FCM_SERVER_KEY` value with your new server key:
   ```javascript
   const FCM_SERVER_KEY = "your-actual-server-key-from-firebase-console";
   ```
3. Find your Firebase project ID from the Firebase console
4. Replace the `PROJECT_ID` value:
   ```javascript
   const PROJECT_ID = "your-firebase-project-id";
   ```

### 3. Make Sure Your App is Properly Configured

1. Verify your `google-services.json` file is current and correctly placed in your project
2. Make sure FCM is properly initialized in your app
3. Verify the device token you're using is valid and current

## For a More Robust Solution

For production use, you should consider using the Firebase Admin SDK:

1. Install firebase-admin:

   ```
   npm install firebase-admin
   ```

2. Create a service account key:

   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely

3. Use the Admin SDK to send messages:

   ```javascript
   const admin = require("firebase-admin");
   const serviceAccount = require("./path-to-your-service-account.json");

   admin.initializeApp({
     credential: admin.credential.cert(serviceAccount),
   });

   async function sendNotification(deviceToken, title, body, data = {}) {
     const message = {
       notification: {
         title,
         body,
       },
       data,
       token: deviceToken,
     };

     try {
       const response = await admin.messaging().send(message);
       console.log("Successfully sent message:", response);
       return response;
     } catch (error) {
       console.error("Error sending message:", error);
       throw error;
     }
   }
   ```

## Common Errors

1. **404 Not Found**: The URL or authentication method is incorrect
2. **400 Bad Request**: The message format is invalid
3. **401 Unauthorized**: The server key is invalid or expired
4. **403 Forbidden**: The server key doesn't have permission to send to the specified device
