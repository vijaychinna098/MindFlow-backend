# Alzheimer's Care App

This app helps patients with Alzheimer's and their caregivers manage daily tasks and reminders.

## New Feature: Background Reminder Notifications

The app now supports background reminder notifications, which means:

- Reminders will be delivered even when the app is not actively running
- Notifications are scheduled based on reminder times
- Both patients and caregivers receive notifications for their reminders

## Installation

After cloning the repository, install the dependencies:

```bash
npm install
```

### Run the app

```bash
npm start
```

Then press 'a' for Android or 'i' for iOS, or scan the QR code with the Expo Go app.

## Required Permissions

The app needs the following permissions to function properly:

- Notifications permission: To send reminder notifications
- Background task permission: To check for reminders in the background

## How Reminders Work

1. Reminders are stored in AsyncStorage with user-specific keys
2. When a reminder time matches the current time, a notification is sent
3. This happens both when the app is open and when it's closed
4. Tapping a reminder notification will open the app and navigate to the Reminders screen

## Troubleshooting

If you're not receiving background notifications:

1. Make sure notifications are enabled in your device settings
2. On iOS, background app refresh might need to be enabled
3. On Android, ensure battery optimization is disabled for this app

## Additional Information

- Background tasks run approximately every 15 minutes when the app is closed
- When the app is open, reminders are checked every minute

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
