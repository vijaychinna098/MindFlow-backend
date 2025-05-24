let TaskManager;
let BackgroundFetch;

try {
  TaskManager = require('expo-task-manager');
  BackgroundFetch = require('expo-background-fetch');
} catch (error) {
  console.warn('Failed to import background task modules:', error);
  
  // Create fallback implementations
  TaskManager = {
    defineTask: (name, task) => {
      console.log(`Task ${name} would be defined, but module is unavailable`);
    },
    isTaskRegisteredAsync: async () => false
  };
  
  BackgroundFetch = {
    registerTaskAsync: async () => {
      console.log('Background task would be registered, but module is unavailable');
      return false;
    },
    unregisterTaskAsync: async () => {
      console.log('Background task would be unregistered, but module is unavailable');
      return false;
    },
    getStatusAsync: async () => null,
    BackgroundFetchResult: {
      NoData: 'NoData',
      NewData: 'NewData',
      Failed: 'Failed'
    },
    BackgroundFetchStatus: {
      Available: 'Available',
      Denied: 'Denied',
      Restricted: 'Restricted'
    }
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAndNotifyReminders } from './ReminderNotifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Define the task name for reminder checking
const REMINDER_CHECK_TASK = 'REMINDER_CHECK_TASK';

// Register the task handler
TaskManager.defineTask(REMINDER_CHECK_TASK, async () => {
  try {
    console.log('🔄 Running background reminder check task');
    
    // Before doing anything else, make sure notification permissions are granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Notification permissions not granted for background task');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
    
    // Get the current user email from AsyncStorage
    const userEmail = await AsyncStorage.getItem('currentUserEmail');
    if (!userEmail) {
      console.log('No user email found for background task');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    console.log(`Background task running for user: ${userEmail}`);
    
    // Check for reminders and send notifications if needed
    await checkAndNotifyReminders(userEmail);
    
    console.log('Background reminder check completed successfully');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error in background reminder check:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register the background fetch task
export const registerBackgroundReminderCheck = async (minimumInterval = 15) => {
  try {
    console.log('Attempting to register background reminder check task...');
    
    // Make sure TaskManager is available
    if (!TaskManager || !BackgroundFetch) {
      console.error('TaskManager or BackgroundFetch modules are not available');
      return false;
    }
    
    // Check if the task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(REMINDER_CHECK_TASK);
    
    if (isRegistered) {
      console.log('Background reminder check task already registered');
    } else {
      console.log('Registering new background reminder check task');
      
      // Ensure notification permissions for background tasks
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted for background task registration');
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.error('User declined notification permissions');
          return false;
        }
      }
      
      // Register the task with appropriate options
      const options = {
        minimumInterval: minimumInterval * 60, // Convert minutes to seconds
        stopOnTerminate: false, // Continue running even when the app is closed
        startOnBoot: true, // Start task when device is rebooted
      };
      
      if (Platform.OS === 'android') {
        // Android specific settings
        options.androidAllowWhileIdle = true; // Allow to run in battery optimization mode
      }
      
      await BackgroundFetch.registerTaskAsync(REMINDER_CHECK_TASK, options);
      
      console.log('Background reminder check task registered successfully with options:', options);
      
      // Get the user email before setting up the timeout
      const userEmail = await AsyncStorage.getItem('currentUserEmail');
      
      // Run a test check immediately 
      setTimeout(() => {
        checkAndNotifyReminders(userEmail);
      }, 5000);
    }
    
    return true;
  } catch (error) {
    console.error('Error registering background task:', error);
    return false;
  }
};

// Unregister the background fetch task
export const unregisterBackgroundReminderCheck = async () => {
  try {
    // Check if the task is registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(REMINDER_CHECK_TASK);
    
    if (isRegistered) {
      console.log('Unregistering background reminder check task');
      await BackgroundFetch.unregisterTaskAsync(REMINDER_CHECK_TASK);
      console.log('Background reminder check task unregistered successfully');
    } else {
      console.log('No background reminder check task to unregister');
    }
    
    return true;
  } catch (error) {
    console.error('Error unregistering background task:', error);
    return false;
  }
};

// Get the background fetch status
export const getBackgroundFetchStatus = async () => {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    let statusText = '';
    
    switch (status) {
      case BackgroundFetch.BackgroundFetchStatus.Available:
        statusText = 'Available';
        break;
      case BackgroundFetch.BackgroundFetchStatus.Denied:
        statusText = 'Denied';
        break;
      case BackgroundFetch.BackgroundFetchStatus.Restricted:
        statusText = 'Restricted';
        break;
      default:
        statusText = 'Unknown';
    }
    
    console.log(`Background fetch status: ${statusText}`);
    return { status, statusText };
  } catch (error) {
    console.error('Error getting background fetch status:', error);
    return { status: null, statusText: 'Error' };
  }
}; 