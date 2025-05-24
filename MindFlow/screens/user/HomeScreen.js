import React, { useContext, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../../UserContext";
import { useFontSize } from "../user/FontSizeContext"; // Updated import path
import { ReminderContext } from "../../context/ReminderContext";
import * as Speech from "expo-speech";
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import the synchronization service
import { checkNeedsSyncFromCaregiver, syncPatientDataFromCaregiver } from '../../services/DataSynchronizationService';
// Import the SpeechManager
import { speakReminder } from '../../utils/SpeechManager';
import SyncStatusIndicator from "../../components/SyncStatusIndicator";

// Create a safe wrapper for the useFontSize hook
const useSafeFontSize = () => {
  const fontSizeContext = useFontSize();
  return fontSizeContext || { fontSize: 18, setFontSize: () => {} };
};

// Function to get daily tip
const getDailyTip = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const tipNumber = (dayOfYear % 30) + 1; // We have 30 tips
  
  const tips = {
    alzheimer_tip_1: "Stay physically active to help maintain cognitive function.",
    alzheimer_tip_2: "Eat a balanced diet rich in fruits, vegetables, and omega-3 fatty acids.",
    alzheimer_tip_3: "Stay mentally active with puzzles, reading, and learning new skills.",
    alzheimer_tip_4: "Maintain social connections to support brain health.",
    alzheimer_tip_5: "Get adequate sleep to help clear brain toxins.",
    alzheimer_tip_6: "Manage stress through meditation, yoga, or deep breathing exercises.",
    alzheimer_tip_7: "Keep a consistent daily routine to reduce confusion.",
    alzheimer_tip_8: "Use calendars and to-do lists to stay organized.",
    alzheimer_tip_9: "Label cabinets and drawers to make items easier to find.",
    alzheimer_tip_10: "Reduce clutter to minimize distractions and confusion.",
    alzheimer_tip_11: "Install safety features such as grab bars in bathrooms.",
    alzheimer_tip_12: "Keep a list of emergency contacts easily accessible.",
    alzheimer_tip_13: "Use medication organizers to ensure proper dosage.",
    alzheimer_tip_14: "Stay hydrated by drinking plenty of water throughout the day.",
    alzheimer_tip_15: "Use nightlights to prevent falls during nighttime bathroom trips.",
    alzheimer_tip_16: "Participate in memory-enhancing activities like reminiscence therapy.",
    alzheimer_tip_17: "Regular medical check-ups can help monitor cognitive health.",
    alzheimer_tip_18: "Avoid alcohol and smoking, which can worsen cognitive decline.",
    alzheimer_tip_19: "Play music from your younger years to stimulate memories.",
    alzheimer_tip_20: "Keep familiar objects and photographs visible to provide comfort.",
    alzheimer_tip_21: "Use a GPS device or app when going out to prevent getting lost.",
    alzheimer_tip_22: "Break tasks into simple steps with clear instructions.",
    alzheimer_tip_23: "Maintain good vision and hearing with regular check-ups.",
    alzheimer_tip_24: "Exercise your brain with word games and number puzzles.",
    alzheimer_tip_25: "Keep a journal to help remember daily events and activities.",
    alzheimer_tip_26: "Use voice assistants and smart home devices for reminders.",
    alzheimer_tip_27: "Engage in creative activities like painting or crafting.",
    alzheimer_tip_28: "Practice relaxation techniques to reduce anxiety and agitation.",
    alzheimer_tip_29: "Stay informed about new Alzheimer's research and treatments.",
    alzheimer_tip_30: "Join a support group to connect with others facing similar challenges."
  };
  
  return tips[`alzheimer_tip_${tipNumber}`] || tips.alzheimer_tip_1;
};

const parseTime = (timeStr) => {
  try {
    if (!timeStr) return 0; // Handle null or undefined
    
    // Check if it's in 24-hour format (HH:MM)
    if (timeStr.includes(':') && !timeStr.includes(' ')) {
      const [hourStr, minuteStr] = timeStr.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      
      if (isNaN(hour) || isNaN(minute)) return 0;
      return hour * 60 + minute;
    }
    
    // Handle AM/PM format
    const isPM = timeStr.toLowerCase().includes('pm');
    const isAM = timeStr.toLowerCase().includes('am');
    
    // First try to extract HH:MM AM/PM format (with space)
    if (timeStr.includes(':')) {
      // Extract time parts - handle both "1:30 PM" and "1:30PM" formats
      const timeParts = timeStr.replace(/[^0-9:]/g, " ").trim().split(/\s+|:/);
      
      if (timeParts.length >= 2) {
        let hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        
        // Convert 12-hour format to 24-hour
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
        
        return hours * 60 + minutes;
      }
    }
    
    // As a last resort, try to extract just hours
    const numericPart = parseInt(timeStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numericPart)) {
      let hours = numericPart;
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      
      return hours * 60;
    }
    
    console.warn(`Could not parse time string: "${timeStr}"`);
    return 0; // Default value for sorting
  } catch (error) {
    console.error("Error parsing time:", error, timeStr);
    return 0; // Default value for sorting
  }
};

const getCurrentMinutes = () => {
  const now = new Date();
  // Return only hours and minutes, ignore seconds to ensure exact matching with reminder times
  return now.getHours() * 60 + now.getMinutes();
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const { currentUser, updateUser } = useUser();
  const { fontSize } = useSafeFontSize(); // Use safe wrapper instead of useFontSize
  
  // State for profile image modal
  const [profileImageModalVisible, setProfileImageModalVisible] = useState(false);
  
  // Use local state to store user reminders
  const [userReminders, setUserReminders] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [lastCompletionDate, setLastCompletionDate] = useState('');
  // Add state variables for settings
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [voiceAssistanceEnabled, setVoiceAssistanceEnabled] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Add last sync time to display to user
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  // Add state to track which reminders have been announced
  const [announcedReminders, setAnnouncedReminders] = useState({});
  
  // Track when voice assistance is turned on to prevent announcing past reminders
  const [voiceAssistanceLastEnabled, setVoiceAssistanceLastEnabled] = useState(null);
  
  // Get fallback functions from ReminderContext
  const { 
    addReminder = () => false,
    removeReminder = () => false,
    completeReminder = () => false,
    getStorageKey = () => null
  } = useContext(ReminderContext) || {};
  
  const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : '';
  const [connectedCaregiverEmail, setConnectedCaregiverEmail] = useState(null);

  // Use the reminderKey without any conditional checks
  const reminderKey = userEmail ? `reminders_${userEmail.toLowerCase().trim()}` : 'reminders';

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedReminders = await AsyncStorage.getItem('reminders');
        const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
        
        if (storedReminders !== null) {
          setRemindersEnabled(storedReminders === 'true');
        }
        if (storedVoiceAssistance !== null) {
          setVoiceAssistanceEnabled(storedVoiceAssistance === 'true');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
    
    // Add a listener to reload settings when the screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      loadSettings();
    });
    
    // Clean up the listener
    return () => unsubscribe();
  }, [navigation]);

  // Track voice assistance toggle
  useEffect(() => {
    if (voiceAssistanceEnabled) {
      const now = new Date();
      setVoiceAssistanceLastEnabled(now.getTime());
      console.log(`Voice assistance enabled at ${now.toLocaleTimeString()}`);
    }
  }, [voiceAssistanceEnabled]);

  // New function to perform synchronization
  const performDataSync = useCallback(async () => {
    if (!userEmail || syncInProgress) return;
    
    setSyncInProgress(true);
    
    try {
      // Removed excessive logging
      const { needsSync, caregiverEmail } = await checkNeedsSyncFromCaregiver(userEmail);
      
      if (needsSync && caregiverEmail) {
        console.log(`Sync needed with caregiver: ${caregiverEmail}`);
        setConnectedCaregiverEmail(caregiverEmail);
        
        // Perform the sync
        const syncSuccess = await syncPatientDataFromCaregiver(userEmail, caregiverEmail);
        
        if (syncSuccess) {
          console.log('Sync completed successfully');
          setLastSyncTime(new Date().toLocaleString());
          
          // Reload reminders after sync
          const storedReminders = await AsyncStorage.getItem(reminderKey);
          if (storedReminders) {
            try {
              const parsedReminders = JSON.parse(storedReminders);
              if (Array.isArray(parsedReminders)) {
                setUserReminders(parsedReminders);
              }
            } catch (error) {
              console.error('Error parsing reminders after sync:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      setSyncInProgress(false);
    }
  }, [userEmail, reminderKey, syncInProgress]);

  // Add auto-sync on component mount and focus
  useEffect(() => {
    // Only perform initial sync if user is logged in and has an email
    if (userEmail) {
      // Set a flag in AsyncStorage to track last sync attempt time to avoid too frequent syncs
      const checkLastSyncAttempt = async () => {
        try {
          const lastSyncAttemptKey = `lastSyncAttempt_${userEmail}`;
          const lastSyncAttempt = await AsyncStorage.getItem(lastSyncAttemptKey);
          
          // Only sync if the last attempt was more than 5 minutes ago
          const now = new Date().getTime();
          if (!lastSyncAttempt || (now - parseInt(lastSyncAttempt, 10)) > 5 * 60 * 1000) {
            // Update the last sync attempt time before performing sync
            await AsyncStorage.setItem(lastSyncAttemptKey, now.toString());
            performDataSync();
          } else {
            console.log('Skipping sync - last attempt was recent');
          }
        } catch (error) {
          console.error('Error checking last sync attempt:', error);
        }
      };
      
      checkLastSyncAttempt();
    }
    
    // Set up a sync when the screen gets focus - with throttling
    const unsubscribe = navigation.addListener('focus', () => {
      // We'll throttle the sync on focus events too
      const checkLastSyncAttempt = async () => {
        try {
          const lastSyncAttemptKey = `lastSyncAttempt_${userEmail}`;
          const lastSyncAttempt = await AsyncStorage.getItem(lastSyncAttemptKey);
          
          // Only sync if the last attempt was more than 5 minutes ago
          const now = new Date().getTime();
          if (!lastSyncAttempt || (now - parseInt(lastSyncAttempt, 10)) > 5 * 60 * 1000) {
            await AsyncStorage.setItem(lastSyncAttemptKey, now.toString());
            performDataSync();
          } else {
            console.log('Skipping focus sync - last attempt was recent');
          }
        } catch (error) {
          console.error('Error checking last sync attempt on focus:', error);
        }
      };
      
      if (userEmail) {
        checkLastSyncAttempt();
      }
    });
    
    return () => unsubscribe();
  }, [navigation, performDataSync, userEmail]);

  // Ensure reminders are loaded for the current user
  useEffect(() => {
    const loadUserReminders = async () => {
      if (!userEmail) return;
      
      try {
        // Get today's date for checking against last completion date
        const today = new Date().toISOString().split('T')[0];
        
        // Check if this user is connected to a caregiver by checking caregiverPatientsMap
        const caregiverPatientsMap = await AsyncStorage.getItem('caregiverPatientsMap') || '{}';
        const mappings = JSON.parse(caregiverPatientsMap);
        const caregiverEmail = mappings[userEmail];
        
        if (caregiverEmail) {
          console.log(`User is connected to caregiver: ${caregiverEmail}`);
          setConnectedCaregiverEmail(caregiverEmail);
          
          // Check last sync time
          const lastSync = await AsyncStorage.getItem(`lastSync_${userEmail}`);
          if (lastSync) {
            setLastSyncTime(new Date(lastSync).toLocaleString());
          }
          
          // Check for reminders
          const storedReminders = await AsyncStorage.getItem(reminderKey);
          
          if (storedReminders) {
            try {
              const parsedReminders = JSON.parse(storedReminders);
              
              if (!Array.isArray(parsedReminders)) {
                console.error("HomeScreen: Stored reminders is not an array");
                return;
              }
              
              // Filter out invalid reminders
              const validReminders = parsedReminders.filter(reminder => 
                reminder && reminder.id && reminder.title && reminder.time
              );
              
              // Save valid reminders to state
              setUserReminders(validReminders);
              console.log(`HomeScreen: Found ${validReminders.length} valid reminders for patient`);
            } catch (parseError) {
              console.error("HomeScreen: Failed to parse reminders:", parseError);
            }
          } else {
            console.log("HomeScreen: No reminders found for this patient");
          }
        } else {
          // No caregiver connection, use user's own reminders
          const ownReminders = await AsyncStorage.getItem(reminderKey);
          
          if (ownReminders) {
            try {
              const parsedReminders = JSON.parse(ownReminders);
              
              if (!Array.isArray(parsedReminders)) {
                console.error("HomeScreen: User's own reminders is not an array");
                return;
              }
              
              // Filter out invalid reminders
              const validReminders = parsedReminders.filter(reminder => 
                reminder && reminder.id && reminder.title && reminder.time
              );
              
              // Save valid reminders to state
              setUserReminders(validReminders);
            } catch (parseError) {
              console.error("HomeScreen: Failed to parse user's reminders:", parseError);
            }
          } else {
            console.log("HomeScreen: No reminders found for this patient");
          }
        }
        
        // Load completed tasks
        try {
          const lastDateKey = `lastCompletionDate_${userEmail}`;
          const lastDate = await AsyncStorage.getItem(lastDateKey);
          
          console.log(`Current date: ${today}, Last completion date: ${lastDate}`);
          
          // If it's a new day, reset completed tasks
          if (lastDate && lastDate !== today) {
            console.log("New day detected - resetting completed tasks");
            setCompletedTasks([]);
            
            // Update the last completion date to today
            await AsyncStorage.setItem(lastDateKey, today);
            setLastCompletionDate(today);
            
            // Clear the completed tasks for the new day
            await AsyncStorage.setItem(`completedTasks_${userEmail}`, JSON.stringify([]));
          } else {
            // Load completed tasks for today
            const storedCompletedTasks = await AsyncStorage.getItem(`completedTasks_${userEmail}`);
            if (storedCompletedTasks) {
              try {
                const parsedTasks = JSON.parse(storedCompletedTasks);
                if (Array.isArray(parsedTasks)) {
                  setCompletedTasks(parsedTasks);
                  console.log(`Loaded ${parsedTasks.length} completed tasks for today`);
                } else {
                  console.error("HomeScreen: Completed tasks is not an array");
                  setCompletedTasks([]);
                }
              } catch (parseError) {
                console.error("HomeScreen: Failed to parse completed tasks:", parseError);
                setCompletedTasks([]);
              }
            } else {
              console.log("No completed tasks found for today");
              setCompletedTasks([]);
            }
            
            // Ensure last date is set for today
            if (!lastDate || lastDate !== today) {
              await AsyncStorage.setItem(lastDateKey, today);
              setLastCompletionDate(today);
            }
          }
        } catch (error) {
          console.error("HomeScreen: Failed to load completed tasks:", error);
          setCompletedTasks([]);
        }
      } catch (error) {
        console.error("HomeScreen: Error loading reminders:", error);
      }
    };
    
    loadUserReminders();
  }, [userEmail, reminderKey]);

  useEffect(() => {
    const saveCompletedTasks = async () => {
      try {
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Save the completed tasks
        await AsyncStorage.setItem(`completedTasks_${userEmail}`, JSON.stringify(completedTasks));
        
        // Update the last completion date
        await AsyncStorage.setItem(`lastCompletionDate_${userEmail}`, today);
        setLastCompletionDate(today);
      } catch (error) {
        console.error("Failed to save completed tasks:", error);
      }
    };
    
    if (completedTasks.length > 0) {
      saveCompletedTasks();
    }
  }, [completedTasks, userEmail]);

  // Filter out completed tasks and ensure we have valid reminders
  const validReminders = Array.isArray(userReminders) ? userReminders.filter(r => r && r.id && r.title) : [];
  
  const activeReminders = validReminders.filter(reminder => 
    !completedTasks.includes(reminder.id.toString())
  );

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Filter reminders for today
  const todaysReminders = activeReminders.filter(reminder => {
    // If reminder has a date property and it matches today, include it
    if (reminder.date && reminder.date === today) {
      return true;
    }
    
    // If there's no date property, include all reminders (for backward compatibility)
    if (!reminder.date) {
      return true;
    }
    
    return false;
  });
  
  // Sort by time
  const sortedReminders = [...todaysReminders].sort(
    (a, b) => parseTime(a.time) - parseTime(b.time)
  );
  
  // Display the first 3 tasks
  const displayedReminders = sortedReminders.slice(0, 3);

  const handleSeeAll = () => {
    navigation.navigate("Reminders");
  };

  // Get the daily tip
  const dailyTip = getDailyTip();
  
  // Get default profile image
  const defaultProfileImage = require('../images/boy.png');
  
  // Fix profile image source handling to prevent RCTImageView errors
  let profileImageSource;
  try {
    if (currentUser?.profileImage) {
      if (typeof currentUser.profileImage === 'string') {
        // Ensure URI is properly formatted and handle file:// prefix for Android
        let imageUri = currentUser.profileImage;
        
        // Fix common URI format issues
        if (Platform.OS === 'android' && !imageUri.startsWith('file://') && 
            !imageUri.startsWith('content://') && !imageUri.startsWith('http')) {
          console.log('Adding file:// prefix to Android local path');
          imageUri = `file://${imageUri}`;
        }
        
        profileImageSource = { uri: imageUri };
        console.log(`Using formatted image URI: ${imageUri.substring(0, 30)}...`);
      } else if (typeof currentUser.profileImage === 'object' && currentUser.profileImage.uri) {
        let imageUri = currentUser.profileImage.uri;
        
        // Fix common URI format issues
        if (Platform.OS === 'android' && !imageUri.startsWith('file://') && 
            !imageUri.startsWith('content://') && !imageUri.startsWith('http')) {
          console.log('Adding file:// prefix to Android local path');
          imageUri = `file://${imageUri}`;
        }
        
        profileImageSource = { uri: imageUri };
      } else {
        console.log('Profile image in unexpected format, using default image');
        profileImageSource = defaultProfileImage;
      }
    } else {
      console.log('No profile image available, using default');
      profileImageSource = defaultProfileImage;
    }
  } catch (error) {
    console.log('Error processing profile image, using default:', error);
    profileImageSource = defaultProfileImage;
  }
  
  // On component mount, verify profile data integrity
  useEffect(() => {
    // Function to ensure user has correct name and profile image
    const verifyUserData = async () => {
      if (!currentUser) return;
      
      console.log(`HomeScreen - Verifying user data for: ${currentUser.name || 'Unknown'}`);
      console.log(`HomeScreen - Email: ${currentUser.email || 'No email'}`);
      console.log(`HomeScreen - Profile image: ${currentUser.profileImage ? 'Yes' : 'No'}`);
      
      // Fix user name if missing
      if (!currentUser.name || currentUser.name.trim() === '') {
        console.log('HomeScreen - User name missing, fixing...');
        
        if (currentUser.email) {
          const email = currentUser.email.toLowerCase().trim();
          const nameFromEmail = email.split('@')[0]
            .split(/[.\-_]/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
          
          console.log(`HomeScreen - Using name derived from email: ${nameFromEmail}`);
          await updateUser({
            ...currentUser,
            name: nameFromEmail
          });
        }
      }
    };
    
    verifyUserData();
  }, [currentUser, updateUser]);
  
  // Function to handle image loading errors
  const handleImageError = () => {
    console.log('Error loading profile image in HomeScreen, falling back to default');
    
    const fixImageError = async () => {
      if (currentUser?.email) {
        try {
          // Update the user without the problematic image
          await updateUser({
            ...currentUser,
            profileImage: null
          });
        } catch (error) {
          console.log('Error updating user after image error:', error);
        }
      }
    };
    
    fixImageError();
    return defaultProfileImage;
  };

  // Display a read-only message for caregiver-edited features
  const handleReadOnlyFeature = (feature) => {
    Alert.alert(
      'View Only Mode',
      `Your ${feature} can only be modified by caregiver.`,
      [{ text: 'OK' }]
    );
  };

  // Check for unread notifications
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        // Get the current user's email
        if (currentUser && currentUser.email) {
          const userEmail = currentUser.email.toLowerCase().trim();
          const notificationKey = `localNotifications_${userEmail}`;
          
          // Get user-specific notifications
          const storedNotifications = await AsyncStorage.getItem(notificationKey);
          if (storedNotifications) {
            const notifications = JSON.parse(storedNotifications);
            // Count unread notifications
            const unreadCount = notifications.filter(notification => !notification.read).length;
            setUnreadNotifications(unreadCount);
          } else {
            setUnreadNotifications(0);
          }
        } else {
          setUnreadNotifications(0);
        }
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };
    
    checkNotifications();
    
    // Check for new notifications when the screen is focused
    const unsubscribe = navigation.addListener('focus', checkNotifications);
    return () => unsubscribe();
  }, [navigation, currentUser]);

  // Test speech function to verify Speech API works
  const testSpeech = () => {
    try {
      // Only log to console instead of speaking
      console.log("Voice assistance is enabled and working");
    } catch (error) {
      console.error("Test speech error:", error);
    }
  };

  // Test speech once when voice assistance is enabled
  useEffect(() => {
    if (voiceAssistanceEnabled) {
      console.log("Voice assistance enabled, checking speech system...");
      testSpeech();
    } else {
      console.log("Voice assistance disabled");
    }
  }, [voiceAssistanceEnabled]);

  useEffect(() => {
    console.log(`Voice assistance is ${voiceAssistanceEnabled ? "ENABLED" : "DISABLED"}`);
    
    const checkTime = () => {
      try {
        // Get current time for comparison
        const currentMinutes = getCurrentMinutes();
        
        // Only check reminders that are due if voice assistance is enabled
        // Otherwise just do minimal logging to save resources
        if (!voiceAssistanceEnabled) {
          console.log(`Skipping reminder announcements - voice assistance is disabled`);
          return;
        }
        
        console.log(`Checking reminders at ${Math.floor(currentMinutes/60)}:${currentMinutes%60} with voice assistance ENABLED`);
        
        if (userReminders && Array.isArray(userReminders)) {
          userReminders.forEach((reminder) => {
            if (reminder && reminder.time && reminder.title) {
              // Check if the reminder is for today
              const isForToday = !reminder.date || reminder.date === today;
              
              // Check if not already completed
              const isNotCompleted = !isTaskCompleted(reminder.id);
              
              const reminderMinutes = parseTime(reminder.time);
              
              // Generate a unique key for this reminder event
              const reminderKey = `${reminder.id}_${today}`;
              const hasBeenAnnounced = announcedReminders[reminderKey];
              
              // Only match when current time is EXACTLY equal to the reminder time
              // (strict equality, no longer allowing +1 minute buffer)
              const timeMatches = currentMinutes === reminderMinutes;
              
              // Only log reminders that are close to current time (within 5 minutes)
              if (isForToday && isNotCompleted && Math.abs(reminderMinutes - currentMinutes) <= 5) {
                const isTooEarly = currentMinutes < reminderMinutes;
                const isTooLate = currentMinutes > reminderMinutes;
                
                console.log(
                  `Reminder: "${reminder.title}" at ${reminder.time} (${reminderMinutes} minutes)`, 
                  `Current: ${currentMinutes} minutes`,
                  `ForToday: ${isForToday}`,
                  `NotCompleted: ${isNotCompleted}`,
                  `Voice Assistance: ${voiceAssistanceEnabled ? "ON" : "OFF"}`,
                  `Will announce: ${voiceAssistanceEnabled && timeMatches && !hasBeenAnnounced ? 'Yes' : 'No'}`,
                  `Status: ${isTooEarly ? 'Too early' : isTooLate ? 'Too late' : 'Exact match'}`,
                  `Previously announced: ${hasBeenAnnounced ? 'Yes' : 'No'}`
                );
              }
              
              // Only speak if:
              // 1. Voice assistance is enabled
              // 2. Time matches EXACTLY (strict equality)
              // 3. Not already announced
              // 4. It's for today
              // 5. Not already completed
              // 6. The reminder time is not before voice assistance was turned on
              if (voiceAssistanceEnabled && isForToday && isNotCompleted && timeMatches && !hasBeenAnnounced) {
                // Check if this reminder's time is before voice assistance was enabled
                // If so, don't announce it (prevents announcing past reminders when turning voice on)
                if (voiceAssistanceLastEnabled) {
                  const reminderDate = new Date();
                  reminderDate.setHours(Math.floor(reminderMinutes / 60), reminderMinutes % 60, 0, 0);
                  const reminderTime = reminderDate.getTime();
                  
                  // If the reminder time is before voice assistance was enabled, don't announce it
                  if (reminderTime < voiceAssistanceLastEnabled) {
                    console.log(`⏭️ Skipping announcement for "${reminder.title}" - reminder time ${reminder.time} was before voice assistance was turned on at ${new Date(voiceAssistanceLastEnabled).toLocaleTimeString()}`);
                    
                    // Still mark as announced so it doesn't get announced later
                    setAnnouncedReminders(prev => ({
                      ...prev,
                      [reminderKey]: true
                    }));
                    
                    // Skip announcement
                    return;
                  }
                }
                
                console.log(`🔊 Speaking reminder: "${reminder.title}" - voice assistance ON and time matches EXACTLY`);
                
                // Mark this reminder as announced
                setAnnouncedReminders(prev => ({
                  ...prev,
                  [reminderKey]: true
                }));
                
                // Use the SpeechManager's centralized reminder speaking function - no alert
                speakReminder(reminder, currentUser?.name);
              }
            }
          });
        } else {
          console.log("No reminders found or reminders array is invalid");
        }
      } catch (error) {
        console.error("Error in reminder timer:", error);
      }
    };
    
    // Initial check
    checkTime();
    
    // Set interval for future checks
    const interval = setInterval(checkTime, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [userReminders, currentUser, voiceAssistanceEnabled, completedTasks, today, announcedReminders, voiceAssistanceLastEnabled]);
  
  // Handle task completion
  const handleTaskCompletion = (task) => {
    // Check if task is already completed
    if (isTaskCompleted(task.id)) {
      Alert.alert(
        'Task Already Completed',
        `You have already completed "${task.title}". Great job!`,
        [
          { text: 'OK', style: "default" },
          { 
            text: 'Undo Completion', 
            style: "destructive",
            onPress: () => {
              setCompletedTasks(prev => prev.filter(id => id !== task.id.toString()));
              Alert.alert('Task Unmarked', 'Task has been marked as not completed.');
            } 
          }
        ]
      );
      return;
    }
    
    const currentTime = getCurrentMinutes();
    const taskTime = parseTime(task.time);
    
    // Check if task is being completed before scheduled time
    if (currentTime < taskTime) {
      const minutesRemaining = taskTime - currentTime;
      // Convert minutes to hours and minutes for display
      const hoursRemaining = Math.floor(minutesRemaining / 60);
      const minsRemaining = minutesRemaining % 60;
      let timeMessage = "";
      
      if (hoursRemaining > 0) {
        timeMessage = `${hoursRemaining} ${hoursRemaining > 1 ? 'hours' : 'hour'} and ${minsRemaining} ${minsRemaining !== 1 ? 'minutes' : 'minute'}`;
      } else {
        timeMessage = `${minsRemaining} ${minsRemaining !== 1 ? 'minutes' : 'minute'}`;
      }
      
      // Don't allow early completion - just inform the user
      Alert.alert(
        'Cannot Complete Yet',
        `This task is scheduled for ${task.time}. You still have ${timeMessage} before this task is due. Please complete it at the scheduled time.`,
        [{ text: 'OK' }]
      );
      return;
    } else {
      // Task is on time or late - allow completion
      Alert.alert(
        'Complete Task',
        `Mark "${task.title}" as completed?`,
        [
          { text: 'Cancel', style: "cancel" },
          { 
            text: 'Complete', 
            onPress: () => markTaskAsCompleted(task.id) 
          }
        ]
      );
    }
  };
  
  const markTaskAsCompleted = async (taskId) => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`Marking task ${taskId} as completed on ${today}`);
    console.log(`Last completion date was: ${lastCompletionDate}`);
    
    // Check if today's date is different from last completion date
    if (today !== lastCompletionDate) {
      // If it's a new day, reset completed tasks
      console.log(`New day detected in markTaskAsCompleted - resetting completed tasks`);
      
      // Reset completed tasks to only include this new one
      const newCompletedTasks = [taskId.toString()];
      setCompletedTasks(newCompletedTasks);
      
      // Update the last completion date
      setLastCompletionDate(today);
      await AsyncStorage.setItem(`lastCompletionDate_${userEmail}`, today);
      
      // Save the new completed tasks list
      await AsyncStorage.setItem(`completedTasks_${userEmail}`, JSON.stringify(newCompletedTasks));
    } else {
      // Same day, add to existing list (avoid duplicates)
      const updatedTasks = [...completedTasks];
      if (!updatedTasks.includes(taskId.toString())) {
        updatedTasks.push(taskId.toString());
        setCompletedTasks(updatedTasks);
        
        // Save the updated list
        await AsyncStorage.setItem(`completedTasks_${userEmail}`, JSON.stringify(updatedTasks));
      }
    }
    
    // Find the completed task details
    const completedTask = userReminders.find(task => task.id.toString() === taskId.toString());
    
    // IMPORTANT: Update the reminder status in the main reminders list for the caregiver to see
    try {
      // Sync the completed status to the main reminder in storage
      const reminderKey = `reminders_${userEmail.toLowerCase().trim()}`;
      const storedReminders = await AsyncStorage.getItem(reminderKey);
      
      if (storedReminders) {
        const parsedReminders = JSON.parse(storedReminders);
        if (Array.isArray(parsedReminders)) {
          // Update the completion status in the main reminders array
          const updatedReminders = parsedReminders.map(reminder => {
            if (reminder.id.toString() === taskId.toString()) {
              return {
                ...reminder,
                isCompleted: true,
                completed: true,
                completedAt: new Date().toISOString(),
                completedBy: 'user'
              };
            }
            return reminder;
          });
          
          // Save back to storage
          await AsyncStorage.setItem(reminderKey, JSON.stringify(updatedReminders));
          console.log(`Updated reminder ${taskId} completion status in storage for caregiver view`);
          
          // If connected to a caregiver, notify them that a task was completed
          if (connectedCaregiverEmail) {
            // Update caregiver's copy of reminders if they have one
            const caregiverReminderKey = `caregiver_reminders_${connectedCaregiverEmail.toLowerCase().trim()}`;
            const caregiverReminders = await AsyncStorage.getItem(caregiverReminderKey);
            
            if (caregiverReminders) {
              const parsedCaregiverReminders = JSON.parse(caregiverReminders);
              if (Array.isArray(parsedCaregiverReminders)) {
                // Update the completion status in the caregiver's reminders array
                const updatedCaregiverReminders = parsedCaregiverReminders.map(reminder => {
                  if (reminder.id.toString() === taskId.toString()) {
                    return {
                      ...reminder,
                      isCompleted: true,
                      completed: true,
                      completedAt: new Date().toISOString(),
                      completedBy: 'user'
                    };
                  }
                  return reminder;
                });
                
                // Save back to storage
                await AsyncStorage.setItem(caregiverReminderKey, JSON.stringify(updatedCaregiverReminders));
                console.log(`Updated reminder ${taskId} completion status in caregiver's storage`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error updating reminder completion status:", error);
    }
    
    // Display message indicating task is completed
    Alert.alert(
      'Task Completed',
      'Great job! This task has been marked as completed.',
      [{ text: 'OK' }]
    );
  };
  
  const isTaskCompleted = (taskId) => {
    return completedTasks.includes(taskId.toString());
  };

  // Function to handle opening notifications and marking them as read
  const handleOpenNotifications = async () => {
    try {
      // Get the current user's email
      if (currentUser && currentUser.email) {
        const userEmail = currentUser.email.toLowerCase().trim();
        const notificationKey = `localNotifications_${userEmail}`;
        
        // Get current notifications
        const storedNotifications = await AsyncStorage.getItem(notificationKey);
        if (storedNotifications) {
          const notifications = JSON.parse(storedNotifications);
          
          // Mark all as read
          const updatedNotifications = notifications.map(notification => ({
            ...notification,
            read: true
          }));
          
          // Save back to storage
          await AsyncStorage.setItem(notificationKey, JSON.stringify(updatedNotifications));
          
          // Update the UI
          setUnreadNotifications(0);
        }
      }
      
      // Navigate to the notifications screen
      navigation.navigate("Notifications");
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      // Still navigate even if there's an error
      navigation.navigate("Notifications");
    }
  };

  // Function to handle profile image click
  const handleProfileImagePress = () => {
    setProfileImageModalVisible(true);
  };

  // Add a manual sync button in the UI
  const handleManualSync = () => {
    if (syncInProgress) {
      Alert.alert('Sync in Progress', 'Please wait for the current sync to complete.');
      return;
    }
    
    Alert.alert(
      'Sync Data',
      'Sync your data with your caregiver?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sync Now', 
          onPress: () => {
            performDataSync().then(() => {
              Alert.alert('Sync Complete', 'Your data has been synchronized with your caregiver.');
            }).catch(error => {
              Alert.alert('Sync Failed', 'There was an error synchronizing your data. Please try again later.');
            });
          }
        }
      ]
    );
  };

  // Reset announced reminders at midnight
  useEffect(() => {
    // Function to reset the announced reminders
    const resetAnnouncedReminders = () => {
      console.log('Resetting announced reminders for a new day');
      setAnnouncedReminders({});
    };

    // Calculate time until midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow - now;

    // Set timeout to reset at midnight
    const resetTimeout = setTimeout(resetAnnouncedReminders, timeUntilMidnight);

    // Clean up function
    return () => clearTimeout(resetTimeout);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Profile Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={profileImageModalVisible}
        onRequestClose={() => setProfileImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setProfileImageModalVisible(false)}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          <Image
            source={profileImageSource}
            style={styles.fullScreenImage}
            defaultSource={defaultProfileImage}
            resizeMode="contain"
            onError={handleImageError}
          />
        </View>
      </Modal>
      
      <View style={styles.header}>
        <View style={{flexDirection: "row", alignItems: "center"}}>
          <TouchableOpacity onPress={handleProfileImagePress}>
            <Image
              source={profileImageSource}
              style={styles.profileImage}
              defaultSource={defaultProfileImage}
              onError={handleImageError}
            />
          </TouchableOpacity>
          <View style={{marginLeft: 15}}>
            <Text style={[styles.welcomeText, { fontSize: fontSize }]}>
              Welcome back,
            </Text>
            <Text style={[styles.headerTitle, { fontSize: fontSize + 6 }]}>
              {currentUser?.name || "User"}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={handleOpenNotifications}
            style={styles.iconButton}
          >
            <Ionicons name="notifications-outline" size={24} color="#333" />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={styles.iconButton}
          >
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
      
      <SyncStatusIndicator style={styles.syncIndicator} />
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.featuresGrid}>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => {
              if (remindersEnabled) {
                navigation.navigate("Reminders");
              } else {
                Alert.alert(
                  'Reminders Disabled',
                  'Reminders are currently disabled. Please enable them in settings.',
                  [
                    { 
                      text: 'Go to Settings', 
                      onPress: () => navigation.navigate("Settings") 
                    },
                    { 
                      text: 'Cancel', 
                      style: "cancel" 
                    }
                  ]
                );
              }
            }}
          >
            <Ionicons name="alarm" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Reminders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => navigation.navigate("Memories")}
          >
            <Ionicons name="book" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Memories</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => navigation.navigate("Map")}
          >
            <Ionicons name="location" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Safe Places</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => navigation.navigate("Family")}
          >
            <MaterialCommunityIcons name="account-group" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Family</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize }]}>Today's Tasks</Text>
          <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllButton}>
            <Text style={[styles.seeAllButtonText, { fontSize: fontSize - 2 }]}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {remindersEnabled ? (
          <View style={styles.tasksContainer}>
            {displayedReminders.length > 0 ? (
              displayedReminders.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.taskItem}
                  onPress={() => handleTaskCompletion(item)}
                >
                  <View style={styles.taskTimeBox}>
                    <Text style={[styles.taskTime, { fontSize }]}>{item.time}</Text>
                  </View>
                  <Text style={[styles.taskText, { fontSize }]}>{item.title}</Text>
                  <TouchableOpacity 
                    style={styles.checkboxContainer}
                    onPress={() => handleTaskCompletion(item)}
                  >
                    <Ionicons 
                      name={isTaskCompleted(item.id) ? "checkbox" : "square-outline"} 
                      size={28} 
                      color={isTaskCompleted(item.id) ? "#4CAF50" : "#005BBB"} 
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyTaskContainer}>
                <Text style={styles.emptyTaskText}>No tasks for today.</Text>
                <Text style={styles.emptyTaskSubText}>
                  {completedTasks.length > 0 
                    ? 'All tasks completed!'
                    : 'Your caregiver will add tasks for you.'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.disabledFeatureContainer}>
            <Text style={styles.disabledFeatureText}>
              Reminders are disabled.
            </Text>
            <TouchableOpacity 
              style={styles.enableFeatureButton}
              onPress={() => navigation.navigate("Settings")}
            >
              <Text style={styles.enableFeatureButtonText}>Enable in Settings</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {completedTasks.length > 0 && (
          <View style={styles.completedTasksContainer}>
            <Text style={styles.completedTasksText}>
              {completedTasks.length} {completedTasks.length === 1 ? 'task completed' : 'tasks completed'}
            </Text>
          </View>
        )}
        <Text style={[styles.sectionTitle, { fontSize }]}>Daily Tip</Text>
        <View style={styles.tipContainer}>
          <Text style={[styles.tipText, { fontSize }]}>{dailyTip}</Text>
        </View>
        
        <Text style={[styles.sectionTitle, { fontSize }]}>Safety Tips</Text>
        <View style={styles.safetyTipsContainer}>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
            <Text style={[styles.safetyTipText, { fontSize }]}>Keep your phone charged.</Text>
          </View>
          
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
            <Text style={[styles.safetyTipText, { fontSize }]}>Inform your caregiver when leaving home.</Text>
          </View>
          
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
            <Text style={[styles.safetyTipText, { fontSize }]}>Use the emergency button if needed.</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.emergencyButton, { backgroundColor: "#D9534F" }]}
          onPress={() => navigation.navigate("EmergencyCall")}
        >
          <Ionicons name="alert" size={30} color="#fff" />
          <Text style={[styles.emergencyText, { fontSize }]}>Emergency Call</Text>
        </TouchableOpacity>

        {/* Add this near the bottom of your ScrollView */}
        {connectedCaregiverEmail && lastSyncTime && (
          <View style={styles.syncInfoContainer}>
            <Text style={styles.syncInfoText}>
              Last sync: {lastSyncTime}
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("Home")}>
          <Ionicons name="home" size={30} color="#005BBB" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person" size={30} color="#005BBB" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("Activities")}>
          <Ionicons name="game-controller" size={30} color="#005BBB" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Activities</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("EmergencyCall")}>
          <Ionicons name="call" size={30} color="#D9534F" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Emergency</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: "#fff",
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    borderWidth: 2, 
    borderColor: "#005BBB" 
  },
  welcomeText: {
    fontSize: 16,
    color: "#2C3E50",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2C3E50",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 10,
  },
  notificationBadge: {
    backgroundColor: "#D9534F",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: "absolute",
    top: -5,
    right: -5,
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  featureButton: { width: "48%", height: 110, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 15, elevation: 2 },
  featureText: { color: "#fff", fontWeight: "bold", marginTop: 5 },
  sectionTitle: { fontWeight: "bold", color: "#2C3E50", marginVertical: 10 },
  tasksContainer: { backgroundColor: "#fff", borderRadius: 10, padding: 15, elevation: 1 },
  taskItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E8EEF3" },
  taskTimeBox: { backgroundColor: "#E8EEF3", borderRadius: 6, padding: 8, marginRight: 10, width: 90, alignItems: "center" },
  taskTime: { fontSize: 16 },
  taskText: { flex: 1, fontSize: 16 },
  seeAllButton: {
    padding: 5
  },
  seeAllButtonText: {
    color: '#005BBB',
    fontWeight: 'bold'
  },
  tipContainer: { backgroundColor: "#fff", borderRadius: 10, padding: 15, elevation: 1, marginVertical: 10 },
  tipText: { fontSize: 16, color: "#2C3E50" },
  emergencyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 15, borderRadius: 10, marginVertical: 15 },
  emergencyText: { color: "#fff", fontWeight: "bold", marginLeft: 10 },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", padding: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ccc", position: "absolute", bottom: 0, left: 0, right: 0 },
  navButton: { alignItems: "center" },
  navText: { marginTop: 5, color: "#005BBB" },
  emptyTaskContainer: { 
    padding: 20, 
    alignItems: "center", 
    justifyContent: "center",
    paddingVertical: 30,
  },
  emptyTaskText: { 
    fontSize: 16, 
    color: "#555", 
    fontWeight: "bold", 
    marginBottom: 5 
  },
  emptyTaskSubText: { 
    fontSize: 14, 
    color: "#888", 
    textAlign: "center" 
  },
  completedTasksContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    alignItems: "center"
  },
  completedTasksText: {
    color: "#4CAF50",
    fontWeight: "bold",
    fontSize: 14
  },
  checkboxContainer: {
    padding: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10
  },
  disabledFeatureContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  disabledFeatureText: {
    fontSize: 16,
    color: "#555",
    fontWeight: "bold",
    marginBottom: 5
  },
  enableFeatureButton: {
    padding: 10,
    backgroundColor: "#005BBB",
    borderRadius: 5
  },
  enableFeatureButtonText: {
    color: "#fff",
    fontWeight: "bold"
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullScreenImage: {
    width: '90%',
    height: '70%',
    borderRadius: 10,
  },
  safetyTipsContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    elevation: 1,
    marginVertical: 10,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  safetyTipText: {
    flex: 1,
    fontSize: 16,
    color: "#2C3E50",
  },
  syncIndicator: {
    alignSelf: 'center',
    marginBottom: 5,
  },
  syncInfoContainer: {
    padding: 10,
    marginTop: 5,
    alignItems: 'center',
  },
  syncInfoText: {
    fontSize: 12,
    color: '#666',
  },
});

export default HomeScreen;
