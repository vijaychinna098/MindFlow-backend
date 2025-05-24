import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Parse time from string format to minutes for comparison
const parseTime = (timeStr) => {
  try {
    if (!timeStr) return 0;
    
    // Check if it's in 24-hour format (HH:MM)
    if (timeStr.includes(':') && !timeStr.includes(' ')) {
      const [hourStr, minuteStr] = timeStr.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      
      if (isNaN(hour) || isNaN(minute)) return 0;
      return { hour, minute };
    }
    
    // Handle AM/PM format
    const [time, period] = (timeStr || "").split(" ");
    if (!time || !period) {
      // Try to extract from "9:30AM" format (no space)
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|am|pm)/i);
      if (match) {
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        
        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        
        return { hour, minute };
      }
      
      return { hour: 0, minute: 0 }; // Couldn't parse
    }
    
    const [hourStr, minuteStr] = (time || "").split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (isNaN(hour) || isNaN(minute)) return { hour: 0, minute: 0 };
    
    if (period && period.toUpperCase() === "PM" && hour !== 12) {
      hour += 12;
    }
    if (period && period.toUpperCase() === "AM" && hour === 12) {
      hour = 0;
    }
    
    return { hour, minute };
  } catch (error) {
    console.error("Error parsing time:", error);
    return { hour: 0, minute: 0 }; // Default value
  }
};

// Function to check if two times match (current time and reminder time)
const doTimesMatch = (reminderTime, currentTime) => {
  const parsedReminderTime = parseTime(reminderTime);
  console.log(`Comparing reminder time (${parsedReminderTime.hour}:${parsedReminderTime.minute}) with current time (${currentTime.hour}:${currentTime.minute})`);
  return (
    parsedReminderTime.hour === currentTime.hour && 
    parsedReminderTime.minute === currentTime.minute
  );
};

// Schedule a local notification
const scheduleNotification = async (title, body, data = {}, userEmail) => {
  try {
    // Configure notification settings
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    
    console.log(`Attempting to schedule notification for ${userEmail}: "${title}" - "${body}"`);
    
    if (!userEmail) {
      console.error('No user email provided for notification');
      return false;
    }
    
    // Check notification permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Notification permission not granted. Requesting...');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.error('User declined notification permission');
        return false;
      }
    }
    
    // Add user email to notification data for reference
    const notificationData = {
      ...data,
      userEmail: userEmail.toLowerCase().trim()
    };
    
    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: notificationData,
        sound: true,
      },
      trigger: null, // Send immediately
    });
    
    console.log(`Successfully scheduled notification ID: ${notificationId} for user: ${userEmail}`);
    
    // Also store it locally for viewing in the notifications screen
    await storeLocalNotification(title, body, notificationData, userEmail);
    
    return true;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return false;
  }
};

// Store notification in local storage for the notification screen
const storeLocalNotification = async (title, body, data, userEmail) => {
  try {
    if (!userEmail) {
      console.error('No user email provided for storing notification');
      return;
    }
    
    // Create a user-specific key for notifications
    const notificationKey = `localNotifications_${userEmail.toLowerCase().trim()}`;
    
    // Get existing notifications for this specific user
    const existingNotifications = await AsyncStorage.getItem(notificationKey);
    let notifications = [];
    
    if (existingNotifications) {
      notifications = JSON.parse(existingNotifications);
    }
    
    // Add new notification
    notifications.push({
      id: Date.now().toString(),
      title,
      body,
      data,
      userEmail: userEmail.toLowerCase().trim(), // Store the user email with each notification
      timestamp: new Date().toISOString(),
      read: false
    });
    
    // Limit to 50 notifications max
    if (notifications.length > 50) {
      notifications = notifications.slice(notifications.length - 50);
    }
    
    await AsyncStorage.setItem(notificationKey, JSON.stringify(notifications));
    console.log(`Stored notification in local storage for ${userEmail}`);
  } catch (error) {
    console.error('Error storing local notification:', error);
  }
};

// Check reminders against current time and send notifications when they match
export const checkAndNotifyReminders = async (userEmail) => {
  try {
    console.log('⏰ Checking reminders for notifications...');
    
    if (!userEmail) {
      console.log('No user email provided, skipping reminder check');
      return;
    }
    
    const reminderKey = `reminders_${userEmail.toLowerCase().trim()}`;
    const storedReminders = await AsyncStorage.getItem(reminderKey);
    
    if (!storedReminders) {
      console.log('No reminders found for user');
      return;
    }
    
    // Parse reminders
    const reminders = JSON.parse(storedReminders);
    if (!Array.isArray(reminders)) {
      console.log('Reminders is not an array');
      return;
    }
    
    console.log(`Found ${reminders.length} reminders to check`);
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get current time
    const now = new Date();
    const currentTime = {
      hour: now.getHours(),
      minute: now.getMinutes()
    };
    
    // Get completed tasks
    const completedTasksKey = `completedTasks_${userEmail.toLowerCase().trim()}`;
    const storedCompletedTasks = await AsyncStorage.getItem(completedTasksKey);
    const completedTasks = storedCompletedTasks ? JSON.parse(storedCompletedTasks) : [];
    
    console.log(`Checking reminders at ${currentTime.hour}:${currentTime.minute}`);
    
    // Check each reminder
    let matchFound = false;
    for (const reminder of reminders) {
      if (!reminder || !reminder.id || !reminder.title || !reminder.time) {
        console.log('Skipping invalid reminder:', reminder);
        continue; // Skip invalid reminders
      }
      
      // Skip completed reminders
      if (completedTasks.includes(reminder.id.toString())) {
        console.log(`Skipping completed reminder: ${reminder.title}`);
        continue;
      }
      
      // Skip reminders for other dates
      if (reminder.date && reminder.date !== today) {
        console.log(`Skipping reminder for different date (${reminder.date}): ${reminder.title}`);
        continue;
      }
      
      console.log(`Checking reminder: "${reminder.title}" at ${reminder.time}...`);
      
      // Check if time matches
      if (doTimesMatch(reminder.time, currentTime)) {
        console.log(`⭐ TIME MATCH FOUND for reminder: ${reminder.title} at ${reminder.time}`);
        matchFound = true;
        
        // Send notification
        await scheduleNotification(
          'Reminder: ' + reminder.title,
          `It's time for: ${reminder.title} at ${reminder.time}`,
          {
            type: 'reminder',
            id: reminder.id,
            time: reminder.time
          },
          userEmail
        );
      }
    }
    
    if (!matchFound) {
      console.log('No matching reminders found for current time');
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
};

// Start periodic reminder checking
export const startReminderChecking = (userEmail, intervalMinutes = 1) => {
  console.log(`Starting reminder checking for user ${userEmail} (interval: ${intervalMinutes} min)`);
  
  // Do an immediate check
  checkAndNotifyReminders(userEmail);
  
  // Set up interval checking
  const intervalId = setInterval(() => {
    checkAndNotifyReminders(userEmail);
  }, intervalMinutes * 60 * 1000);
  
  // Return function to stop checking
  return () => {
    console.log('Stopping reminder checking');
    clearInterval(intervalId);
  };
};