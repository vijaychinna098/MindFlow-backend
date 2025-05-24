import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../config';

// Server URL
const SERVER_URL = API_BASE_URL;

// Register for push notifications
async function registerForPushNotificationsAsync() {
  let token;
  
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      // Get the token with fallback method if projectId not found
      try {
        // First try with project ID if available
        if (Constants.expoConfig?.extra?.eas?.projectId) {
          token = (await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig.extra.eas.projectId,
          })).data;
        } else {
          // Fallback to simplified method without projectId
          token = (await Notifications.getExpoPushTokenAsync()).data;
        }
      } catch (tokenError) {
        console.log('Error getting token with projectId, using fallback method');
        // Final fallback - use token without options
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }
      
      console.log('Expo push token:', token);
      
      // Store the token
      if (token) {
        await AsyncStorage.setItem('expoPushToken', token);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }
    
    return token;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
}

// Call this function to initialize
try {
  registerForPushNotificationsAsync();
} catch (error) {
  console.error('Failed to register for push notifications:', error);
}

export default registerForPushNotificationsAsync;