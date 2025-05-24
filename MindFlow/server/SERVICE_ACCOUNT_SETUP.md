# Service Account Key Setup

## What I've Done

I've copied the Firebase Admin SDK service account key (`serviceAccountKey.json`) from your project root to the server directory. This key is required by the `firebase-admin.js` file to authenticate with Firebase Cloud Messaging.

## Service Account Details

- **Project ID**: alzheimersapp-ff04c
- **Client Email**: firebase-adminsdk-fbsvc@alzheimersapp-ff04c.iam.gserviceaccount.com

## How to Send Test Notifications

Now that the service account key is in place, you can send test notifications using the Firebase Admin SDK approach:

1. Open a terminal/command prompt
2. Navigate to the server directory:
   ```
   cd path/to/new-alz/server
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Run the Admin SDK test script:
   ```
   npm run send-admin
   ```

## Security Note

The service account key grants administrative access to your Firebase project. Keep this file secure and never commit it to public repositories.

## Troubleshooting

If you encounter issues:

1. Make sure the `serviceAccountKey.json` file is in the same directory as `firebase-admin.js`
2. Verify your device token is current and correctly entered in `send-admin-notification.js`
3. Check that your device has an internet connection
4. Make sure notifications are enabled for the app in your device settings
