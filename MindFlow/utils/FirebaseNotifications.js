import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from '../config';

// Server URL
const SERVER_URL = API_BASE_URL;

// Request permission for Push Notifications
export async function requestNotificationPermission() {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Notification authorization status:', authStatus);
      return true;
    }
    console.log('Notification permission denied');
    return false;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}

// Get the FCM token
export async function getFCMToken() {
  try {
    // Check if a token is already stored
    let fcmToken = await AsyncStorage.getItem('fcmToken');
    
    if (!fcmToken) {
      // Get a new FCM token
      fcmToken = await messaging().getToken();
      
      if (fcmToken) {
        // Save the token to storage
        await AsyncStorage.setItem('fcmToken', fcmToken);
        console.log('New FCM Token:', fcmToken);
      }
    } else {
      console.log('FCM Token already exists:', fcmToken);
    }
    
    return fcmToken;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// Setup Firebase Messaging
export async function setupFirebaseMessaging() {
  try {
    // Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;
    
    // Get the FCM token
    await getFCMToken();
    
    // Handle token refresh
    const tokenRefreshUnsubscribe = messaging().onTokenRefresh(async token => {
      console.log('FCM Token refreshed:', token);
      await AsyncStorage.setItem('fcmToken', token);
    });

    // Setup message handlers
    setupMessageHandlers();
    
    return tokenRefreshUnsubscribe;
  } catch (error) {
    console.error('Error setting up Firebase Messaging:', error);
  }
}

// Handle different types of messages
function setupMessageHandlers() {
  // Foreground message handler
  const foregroundUnsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('Foreground message received:', remoteMessage);
    
    // Show an Expo notification
    await showNotification(
      remoteMessage.notification?.title || 'New Message',
      remoteMessage.notification?.body || '',
      remoteMessage.data
    );
  });
  
  // Background message handler
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message received:', remoteMessage);
    return Promise.resolve();
  });
  
  // App opened from a notification when app was closed or in background
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('App opened from notification:', remoteMessage);
    // Navigate to the relevant screen based on remoteMessage.data
  });
  
  // Check if app was opened from a notification (app closed)
  messaging().getInitialNotification().then(remoteMessage => {
    if (remoteMessage) {
      console.log('App opened from initial notification:', remoteMessage);
      // Navigate to the relevant screen based on remoteMessage.data
    }
  });
}

// Show a local notification using Expo Notifications
async function showNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Immediately show the notification
  });
}

// Export everything as a module
export default {
  requestNotificationPermission,
  getFCMToken,
  setupFirebaseMessaging,
};