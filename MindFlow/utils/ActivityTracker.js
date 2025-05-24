// ActivityTracker.js - Utility for tracking user activities across the app
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../NavigationRef';

// Map screen names to more user-friendly descriptions
const screenDescriptions = {
  Home: 'Home Screen',
  Profile: 'Profile',
  Settings: 'Settings',
  Exercise: 'Exercise',
  Map: 'Location Map',
  MemoryGames: 'Memory Games',
  EverydayObjects: 'Everyday Objects Game',
  SequentialTasks: 'Sequential Tasks Game',
  VisualPairs: 'Visual Pairs Game',
  MatchingPairs: 'Matching Pairs Game',
  WordMemory: 'Word Memory Game',
  PuzzleChallenge: 'Puzzle Challenge',
  WordScramble: 'Word Scramble Game',
  ColorMatching: 'Color Matching Game',
  Activities: 'Brain Training Activities',
  Reminders: 'Reminders',
  Family: 'Family Connections',
  Caregiver: 'Caregiver Connection',
  Memories: 'Photo Memories',
  EmergencyCall: 'Emergency Contacts',
  Notifications: 'Notifications',
};

// Screens to exclude from time tracking (login/authentication screens)
const excludedScreens = [
  'Welcome',
  'Login',
  'Signup',
  'ResetPassword',
  'CaregiverLogin',
  'CaregiverSignup',
  'CaregiverResetPassword',
  'AppContent'      // Main container component
];

// Track current screen and entry time for screen time calculation
let currentScreen = null;
let screenEntryTime = null;
let isInBackground = false; // Track app background state

/**
 * Track user activity across the app
 * @param {string} activity - Description of the activity
 * @param {string} category - Category of activity (Navigation, Game, Setting, etc.)
 * @param {string|null} details - Optional additional details
 * @param {Object|null} additionalData - Optional additional data to store with the activity
 */
export const trackActivity = async (activity, category = 'App', details = null, additionalData = null) => {
  try {
    // Get the current activity history
    const storedHistory = await AsyncStorage.getItem('activityHistory');
    let history = storedHistory ? JSON.parse(storedHistory) : [];
    
    // Try to get the current user's email to associate with this activity
    let userEmail = null;
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        userEmail = user.email || null;
      }
    } catch (userError) {
      console.log('Could not get user data for activity tracking');
    }
    
    // Create new activity entry
    const newActivity = {
      id: Date.now().toString(),
      activity: activity,
      category: category,
      details: details,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      userEmail: userEmail,
      ...(additionalData || {}) // Add any additional data to the activity object
    };
    
    // Update history and save (keep most recent 1000 activities)
    const updatedHistory = [newActivity, ...history].slice(0, 1000);
    await AsyncStorage.setItem('activityHistory', JSON.stringify(updatedHistory));
    
    // Make the function available globally for easy access from any component
    if (!global.trackUserActivity) {
      global.trackUserActivity = trackActivity;
    }
    
    return updatedHistory;
  } catch (error) {
    console.error('Error tracking activity:', error);
    return null;
  }
};

/**
 * Track screen navigation and calculate time spent if leaving a screen
 * @param {string} screenName - Name of the screen being navigated to
 */
export const trackScreenVisit = async (screenName) => {
  try {
    const now = new Date();
    
    // Don't track screen visits when app is in background
    if (isInBackground) {
      return null;
    }
    
    // If we're leaving a screen, record the time spent
    if (currentScreen && screenEntryTime && currentScreen !== screenName) {
      // Only track non-excluded screens
      if (!excludedScreens.includes(currentScreen)) {
        const timeSpentMs = now - screenEntryTime;
        const timeSpentSeconds = Math.round(timeSpentMs / 1000);
        
        // Only record if spent more than 1 second on screen
        if (timeSpentSeconds > 1) {
          const friendlyCurrentScreen = screenDescriptions[currentScreen] || currentScreen;
          await trackScreenTime(currentScreen, friendlyCurrentScreen, timeSpentSeconds);
        }
      }
    }
    
    // Update current screen and time for next calculation
    currentScreen = screenName;
    screenEntryTime = now;
    
    // Skip tracking for excluded screens
    if (excludedScreens.includes(screenName)) {
      return null;
    }
    
    // Get user data to associate with this screen visit
    let userData = null;
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        userData = JSON.parse(userDataString);
      }
    } catch (e) {
      console.log('Could not get user data for screen visit tracking');
    }
    
    // Create a precise timestamp with timezone information to prevent timezone shifts
    const preciseTimestamp = {
      isoString: now.toISOString(),
      localTime: now.toString(),
      timezoneOffset: now.getTimezoneOffset(),
      timestamp: now.getTime() // Unix timestamp in milliseconds
    };
    
    // Track the normal screen visit activity
    const friendlyName = screenDescriptions[screenName] || screenName;
    const userInfo = userData ? { 
      userEmail: userData.email,
      userId: userData.id,
      userName: userData.name,
      preciseTimestamp: preciseTimestamp,
      // Add an explicitly tracked flag to only show screens actually visited
      directVisit: true
    } : {
      preciseTimestamp: preciseTimestamp,
      directVisit: true
    };
    
    return await trackActivity(
      `Visited ${friendlyName}`, 
      'Navigation', 
      `Screen: ${screenName}`,
      userInfo
    );
  } catch (error) {
    console.error('Error tracking screen visit:', error);
    return null;
  }
};

/**
 * Track time spent on a screen
 * @param {string} screenName - Name of the screen
 * @param {string} friendlyName - User-friendly name of the screen
 * @param {number} timeSpentSeconds - Time spent in seconds
 */
export const trackScreenTime = async (screenName, friendlyName, timeSpentSeconds) => {
  try {
    // Only track significant time spent (minimum 3 seconds)
    if (timeSpentSeconds < 3) {
      return null;
    }
    
    const now = new Date();
    
    // Format time spent
    let timeDisplay;
    if (timeSpentSeconds < 60) {
      timeDisplay = `${timeSpentSeconds} seconds`;
    } else {
      const minutes = Math.floor(timeSpentSeconds / 60);
      const seconds = timeSpentSeconds % 60;
      timeDisplay = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}${seconds > 0 ? ` ${seconds} seconds` : ''}`;
    }
    
    // Get user data to ensure we associate the screen time with the correct user
    let userData = null;
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        userData = JSON.parse(userDataString);
      }
    } catch (e) {
      console.log('Could not get user data for screen time tracking');
    }
    
    // Create precise timestamp object to prevent timezone issues
    const preciseTimestamp = {
      isoString: now.toISOString(),
      localTime: now.toString(),
      timezoneOffset: now.getTimezoneOffset(),
      timestamp: now.getTime() // Unix timestamp in milliseconds
    };
    
    // Create user info object if user data is available
    const userInfo = userData ? { 
      userEmail: userData.email,
      userId: userData.id,
      userName: userData.name,
      userType: 'patient', // Explicitly identify this as a patient activity
      actualScreenTime: true  // Flag to mark this as actual screen time (not derived)
    } : {
      actualScreenTime: true
    };
    
    // Add timestamp and raw seconds to ensure accurate time tracking
    const additionalData = {
      rawTimeSeconds: timeSpentSeconds,
      preciseTimestamp: preciseTimestamp,
      ...userInfo // Include user information to help with filtering
    };
    
    // Track as a specialized activity
    return await trackActivity(
      `Time on ${friendlyName}`, 
      'ScreenTime', 
      `Spent ${timeDisplay} on ${friendlyName}`,
      additionalData
    );
  } catch (error) {
    console.error('Error tracking screen time:', error);
    return null;
  }
};

/**
 * Track game activity
 * @param {string} gameName - Name of the game
 * @param {string} action - Action performed (started, completed, etc.)
 * @param {string|null} result - Optional game result or score
 */
export const trackGameActivity = async (gameName, action, result = null) => {
  // Define memory games for consistent categorization
  const memoryGames = [
    'Everyday Objects Game',
    'Sequential Tasks Game',
    'Visual Pairs Game',
    'Matching Pairs Game',
    'Word Memory Game',
    'Puzzle Challenge',
    'Word Scramble Game',
    'Color Matching Game'
  ];
  
  // Check if this is a memory game
  const category = memoryGames.includes(gameName) ? 'Memory Game' : 'Game';
  
  return await trackActivity(
    `${action} ${gameName}`, 
    category, 
    result ? `Result: ${result}` : null
  );
};

/**
 * Track setting changes
 * @param {string} setting - Name of the setting
 * @param {string|boolean|number} value - New value of the setting
 */
export const trackSettingChange = async (setting, value) => {
  return await trackActivity(
    `Changed ${setting} to ${value}`, 
    'Setting'
  );
};

/**
 * Get the full activity history
 * @returns {Array} The activity history array
 */
export const getActivityHistory = async () => {
  try {
    const storedHistory = await AsyncStorage.getItem('activityHistory');
    return storedHistory ? JSON.parse(storedHistory) : [];
  } catch (error) {
    console.error('Error getting activity history:', error);
    return [];
  }
};

/**
 * Get screen time data from activity history
 * @returns {Object} Object mapping screen names to time spent data
 */
export const getScreenTimeData = async () => {
  try {
    const activities = await getActivityHistory();
    const screenTimeActivities = activities.filter(
      activity => activity.category === 'ScreenTime'
    );
    
    // Process and aggregate screen time data
    const screenTimeData = {};
    
    screenTimeActivities.forEach(activity => {
      const screenName = activity.activity.replace('Time on ', '');
      const timeSpentMatch = activity.details.match(/Spent (.*) on/);
      const timeSpent = timeSpentMatch ? timeSpentMatch[1] : 'Unknown time';
      
      if (!screenTimeData[screenName]) {
        screenTimeData[screenName] = {
          totalTimeSeconds: 0,
          visits: 0
        };
      }
      
      // Extract raw time if available, otherwise estimate from the description
      let timeSeconds = 0;
      if (activity.rawTimeSeconds) {
        timeSeconds = activity.rawTimeSeconds;
      } else {
        // Try to parse from description as fallback
        const minutesMatch = timeSpent.match(/(\d+) minute/);
        const secondsMatch = timeSpent.match(/(\d+) second/);
        
        if (minutesMatch) {
          timeSeconds += parseInt(minutesMatch[1]) * 60;
        }
        if (secondsMatch) {
          timeSeconds += parseInt(secondsMatch[1]);
        }
      }
      
      screenTimeData[screenName].totalTimeSeconds += timeSeconds;
      screenTimeData[screenName].visits += 1;
    });
    
    // Calculate average time
    Object.keys(screenTimeData).forEach(screenName => {
      const data = screenTimeData[screenName];
      data.averageTimeSeconds = Math.round(data.totalTimeSeconds / data.visits);
      
      // Add formatted display strings
      data.totalTimeFormatted = formatTimeSpent(data.totalTimeSeconds);
      data.averageTimeFormatted = formatTimeSpent(data.averageTimeSeconds);
    });
    
    return screenTimeData;
  } catch (error) {
    console.error('Error getting screen time data:', error);
    return {};
  }
};

/**
 * Format time in seconds to a readable string
 * @param {number} timeSeconds - Time in seconds
 * @returns {string} Formatted time string
 */
export const formatTimeSpent = (timeSeconds) => {
  if (timeSeconds < 60) {
    return `${timeSeconds} seconds`;
  }
  
  const minutes = Math.floor(timeSeconds / 60);
  const seconds = timeSeconds % 60;
  
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}${seconds > 0 ? ` ${seconds} seconds` : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}${remainingMinutes > 0 ? ` ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}` : ''}`;
};

/**
 * Clear the activity history
 */
export const clearActivityHistory = async () => {
  try {
    await AsyncStorage.setItem('activityHistory', JSON.stringify([]));
    return true;
  } catch (error) {
    console.error('Error clearing activity history:', error);
    return false;
  }
};

/**
 * Handle app state changes for screen time tracking
 * @param {string} nextState - The next app state ('active', 'background', 'inactive')
 */
export const handleAppStateChange = (nextState) => {
  if (nextState === 'background' || nextState === 'inactive') {
    // App is going to background - record current screen time
    if (currentScreen && screenEntryTime && !isInBackground) {
      const now = new Date();
      const timeSpentMs = now - screenEntryTime;
      const timeSpentSeconds = Math.round(timeSpentMs / 1000);
      
      // Only record if spent more than 1 second on screen and not an excluded screen
      if (timeSpentSeconds > 1 && !excludedScreens.includes(currentScreen)) {
        const friendlyCurrentScreen = screenDescriptions[currentScreen] || currentScreen;
        trackScreenTime(currentScreen, friendlyCurrentScreen, timeSpentSeconds);
      }
      
      isInBackground = true;
    }
  } else if (nextState === 'active') {
    // App is coming back to foreground - reset timer for current screen
    isInBackground = false;
    screenEntryTime = new Date();
  }
};

// Automatically set up the global tracking function
trackActivity('App started', 'System');

export default {
  trackActivity,
  trackScreenVisit,
  trackGameActivity,
  trackSettingChange,
  getActivityHistory,
  getScreenTimeData,
  formatTimeSpent,
  clearActivityHistory,
  handleAppStateChange
};