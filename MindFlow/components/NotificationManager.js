import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { startReminderChecking } from '../utils/ReminderNotifications';
import { registerBackgroundReminderCheck, getBackgroundFetchStatus } from '../utils/BackgroundTasks';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure global notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// This component handles notification management and reminder checking
const NotificationManager = ({ userId }) => {
  const navigation = useNavigation();
  
  useEffect(() => {
    console.log('🔔 Setting up NotificationManager for user:', userId);
    
    // Handle notification response (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('User tapped on notification:', response);
      const data = response?.notification?.request?.content?.data || {};
      
      // Navigate based on notification type
      if (data.type === 'reminder') {
        navigation.navigate('Reminders');
      } else if (data.type === 'emergency') {
        navigation.navigate('EmergencyCall');
      } else if (data.type === 'family') {
        navigation.navigate('Family');
      } else if (data.type === 'message') {
        navigation.navigate('Notifications');
      }
    });
    
    // Also handle foreground notifications
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });
    
    // Request notification permissions
    const requestPermissions = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          console.log('Requesting notification permissions...');
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        console.log('Notification permission status:', finalStatus);
        
        if (finalStatus !== 'granted') {
          console.log('Permission not granted for notifications');
          return false;
        }
        
        // On Android, set up a notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: true,
          });
          
          await Notifications.setNotificationChannelAsync('reminders', {
            name: 'Reminders',
            description: 'Reminder notifications',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            enableVibrate: true,
            sound: true,
          });
          
          console.log('Android notification channels created');
        }
        
        // Store that permissions are granted
        await AsyncStorage.setItem('notificationPermissionGranted', 'true');
        
        // Test notification to verify they're working
        if (__DEV__) {
          const testNotificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Notifications Enabled',
              body: 'You will now receive reminder notifications!',
              data: { type: 'system' },
            },
            trigger: null, // send immediately
          });
          console.log('Test notification scheduled:', testNotificationId);
        }
        
        return true;
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
        return false;
      }
    };
    
    // Set up reminder checking
    let stopReminderChecking = null;
    
    const setupReminders = async () => {
      const hasPermission = await requestPermissions();
      
      if (hasPermission && userId) {
        console.log('Starting reminder checking for user:', userId);
        
        // Make sure current user email is stored for background tasks
        await AsyncStorage.setItem('currentUserEmail', userId);
        
        // Start foreground reminder checking (when app is open) - check every minute
        stopReminderChecking = startReminderChecking(userId, 1);
        
        // Register background task for when app is closed
        const backgroundTaskRegistered = await registerBackgroundReminderCheck(15); // Check every 15 minutes
        console.log('Background task registered:', backgroundTaskRegistered);
        
        // Check background fetch status
        const fetchStatus = await getBackgroundFetchStatus();
        console.log('Background fetch status for reminders:', fetchStatus.statusText);
      }
    };
    
    setupReminders();
    
    // Cleanup
    return () => {
      console.log('Cleaning up NotificationManager');
      responseSubscription.remove();
      foregroundSubscription.remove();
      if (stopReminderChecking) {
        stopReminderChecking();
      }
    };
  }, [navigation, userId]);

  // This component doesn't render anything visible
  return null;
};

export default NotificationManager; 