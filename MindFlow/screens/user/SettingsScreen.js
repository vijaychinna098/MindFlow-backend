import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Switch, 
  TouchableOpacity, 
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useFontSize } from '../user/FontSizeContext';
import { useUser } from '../../UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { navigationRef } from "../../NavigationRef";
import { API_BASE_URL } from '../../config';
import { getFCMToken } from '../../utils/FirebaseNotifications';
import { ToastAndroid } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { registerForPushNotificationsAsync } from '../../utils/GetExpoToken';
// Import the Activity Tracker
import * as ActivityTracker from '../../utils/ActivityTracker';
// Import the SpeechManager for testing speech
import * as Speech from 'expo-speech';
import { speakWithVoiceCheck } from '../../utils/SpeechManager';

const SettingsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { fontSize, setFontSize } = useFontSize();
  const { currentUser, logoutUser, updateUser } = useUser();

  // App Settings State
  const [reminders, setReminders] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [medicationAlerts, setMedicationAlerts] = useState(true);
  const [voiceAssistance, setVoiceAssistance] = useState(false);
  const [activityHistory, setActivityHistory] = useState([]);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [filteredActivities, setFilteredActivities] = useState([]);

  // Load settings from AsyncStorage when the app starts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedReminders = await AsyncStorage.getItem('reminders');
        const storedLocationSharing = await AsyncStorage.getItem('locationSharing');
        const storedMedicationAlerts = await AsyncStorage.getItem('medicationAlerts');
        const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
        const storedActivityHistory = await AsyncStorage.getItem('activityHistory');
        
        if (storedReminders !== null) {
          setReminders(storedReminders === 'true');
        }
        if (storedLocationSharing !== null) {
          setLocationSharing(storedLocationSharing === 'true');
        }
        if (storedMedicationAlerts !== null) {
          setMedicationAlerts(storedMedicationAlerts === 'true');
        }
        if (storedVoiceAssistance !== null) {
          setVoiceAssistance(storedVoiceAssistance === 'true');
        }
        if (storedActivityHistory !== null) {
          setActivityHistory(JSON.parse(storedActivityHistory));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Load activity history when the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const loadActivityHistory = async () => {
        try {
          // Use the ActivityTracker to get the latest history
          const history = await ActivityTracker.getActivityHistory();
          setActivityHistory(history);
          
          // Log this visit to the Settings screen
          ActivityTracker.trackScreenVisit('Settings');
        } catch (error) {
          console.error('Error loading activity history:', error);
        }
      };
      
      loadActivityHistory();
      
      return () => {
        // Cleanup function when screen is unfocused
      };
    }, [])
  );

  // Set up a global activity tracking utility
  useEffect(() => {
    // Create a centralized activity tracker for the app
    const createActivityTracker = async () => {
      // If it doesn't exist in global scope, create it
      if (!global.trackUserActivity) {
        global.trackUserActivity = async (activity, category = 'App', details = null) => {
          try {
            // Get the current activity history
            const storedHistory = await AsyncStorage.getItem('activityHistory');
            let history = storedHistory ? JSON.parse(storedHistory) : [];
            
            // Create new activity entry - always include current user's email
            const newActivity = {
              id: Date.now().toString(),
              activity: activity,
              category: category,
              details: details,
              timestamp: new Date().toISOString(),
              date: new Date().toLocaleDateString(),
              time: new Date().toLocaleTimeString(),
              userEmail: currentUser?.email || null, // Explicitly include current user's email
              userId: currentUser?.id || null // Also include the user ID for better matching
            };
            
            // Update history and save
            const updatedHistory = [newActivity, ...history].slice(0, 1000);
            await AsyncStorage.setItem('activityHistory', JSON.stringify(updatedHistory));
            
            // If we're on the settings screen, update state to reflect the new activity
            if (navigation.isFocused() && navigation.getCurrentRoute().name === 'Settings') {
              setActivityHistory(updatedHistory);
            }
          } catch (error) {
            console.error('Error tracking activity:', error);
          }
        };
      }
    };
    
    createActivityTracker();
  }, [currentUser]); // Add currentUser as dependency so tracker updates when user changes

  useEffect(() => {
    const filterActivities = () => {
      if (activeFilter === 'all') {
        setFilteredActivities(filterUserActivities(activityHistory));
      } else if (activeFilter === 'Memory Game') {
        // Show all game activities - both "Memory Game" and "Game" categories
        setFilteredActivities(filterUserActivities(activityHistory.filter(activity => 
          activity.category === 'Memory Game' || activity.category === 'Game'
        )));
      } else {
        setFilteredActivities(filterUserActivities(activityHistory.filter(activity => activity.category === activeFilter)));
      }
    };
    filterActivities();
  }, [activeFilter, activityHistory]);

  // Function to filter activities to only show current user's activities
  const filterUserActivities = (activityList) => {
    if (!currentUser || !currentUser.email) {
      return activityList; // If no user is logged in, return all activities
    }

    const userEmail = currentUser.email.toLowerCase().trim();
    const userId = currentUser.id;
    
    return activityList.filter(activity => {
      // Skip if activity doesn't have the necessary properties
      if (!activity) return false;
      
      // EXACT MATCH FIRST: The most reliable way to identify user's activities
      // Check if user ID or email is included in the activity data and directly matches
      if ((activity.userId && activity.userId === userId) || 
          (activity.userEmail && activity.userEmail.toLowerCase() === userEmail)) {
        return true;
      }
      
      // Exclude any activity that explicitly mentions "caregiver" in activity, details or category
      const activityText = `${activity.activity || ''} ${activity.details || ''} ${activity.category || ''}`.toLowerCase();
      if (activityText.includes('caregiver')) {
        return false;
      }
      
      // For navigation activities, always exclude caregiver screens
      if (activity.category === 'Navigation') {
        const screenName = activity.details && activity.details.includes('Screen:') 
          ? activity.details.split('Screen:')[1].trim()
          : null;
          
        if (screenName && screenName.toLowerCase().includes('caregiver')) {
          return false;
        }
      }
      
      // TIMESTAMP MATCH: If no direct user ID/email match but activity was created during this session
      if (!activity.userEmail && !activity.userId && activity.timestamp) {
        const activityTime = new Date(activity.timestamp);
        const loginTime = new Date(currentUser.lastLogin || 0);
        
        // If activity was created after user logged in, it's likely theirs
        if (activityTime > loginTime) {
          return true;
        }
      }
      
      // TEXT CONTENT MATCH: Check if the activity text explicitly mentions this user's email
      if (activityText.includes(userEmail)) {
        return true;
      }
      
      // CONTEXT-BASED MATCHING: For older activities without explicit user identification
      // Important user-specific activities that should only be shown to the relevant user
      if (activity.category === 'Health' || 
          activity.category === 'Memory Game' || 
          activity.category === 'Game' ||
          activity.category === 'Exercise') {
        // These are personal activities that should only be shown to the correct user
        // Only include if we're confident they belong to this user (based on context)
        return activityText.includes(userEmail); // Require specific mention
      }
      
      // For navigation activities without user info, try to identify user-specific screens
      if (activity.category === 'Navigation') {
        // Common patient/user screens - avoid showing other users' navigation
        if (activityText.includes(userEmail)) {
          return true;
        }
        
        // If no email mentioned, be very cautious about including
        return false;
      }
      
      // Default to excluding the activity if none of the above criteria matched
      return false;
    });
  };

  // Toggle Reminders setting
  const toggleReminders = async () => {
    try {
      const newValue = !reminders;
      setReminders(newValue);
      await AsyncStorage.setItem('reminders', newValue.toString());
      // Log setting change using ActivityTracker
      ActivityTracker.trackSettingChange('Reminders', newValue ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error saving Reminders setting:', error);
    }
  };

  // Toggle Location Sharing setting
  const toggleLocationSharing = async () => {
    try {
      const newValue = !locationSharing;
      setLocationSharing(newValue);
      await AsyncStorage.setItem('locationSharing', newValue.toString());
      
      // Log setting change using ActivityTracker
      ActivityTracker.trackSettingChange('Location Sharing', newValue ? 'enabled' : 'disabled');
      
      // If turning off location sharing, show warning about home location feature
      if (!newValue) {
        Alert.alert(
          "Location Sharing Disabled",
          "Setting your home location requires location sharing to be enabled.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error saving Location Sharing setting:', error);
    }
  };

  // Toggle Medication Alerts setting
  const toggleMedicationAlerts = async () => {
    try {
      const newValue = !medicationAlerts;
      setMedicationAlerts(newValue);
      await AsyncStorage.setItem('medicationAlerts', newValue.toString());
      // Log setting change using ActivityTracker
      ActivityTracker.trackSettingChange('Medication Alerts', newValue ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error saving Medication Alerts setting:', error);
    }
  };

  // Toggle Voice Assistance setting
  const toggleVoiceAssistance = async () => {
    try {
      const newValue = !voiceAssistance;
      setVoiceAssistance(newValue);
      await AsyncStorage.setItem('voiceAssistance', newValue.toString());
      
      // No longer testing speech when enabled
      if (newValue) {
        console.log("Voice assistance enabled silently");
      } else {
        // Stop any ongoing speech when disabled
        Speech.stop();
      }
      
      // Log setting change using ActivityTracker
      ActivityTracker.trackSettingChange('Voice Assistance', newValue ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error saving Voice Assistance setting:', error);
    }
  };

  // Function to log user activity with enhanced details
  const logActivity = async (activity, category = 'Setting', details = null) => {
    try {
      const newActivity = {
        id: Date.now().toString(),
        activity: activity,
        category: category, // New field to categorize activities
        details: details, // Optional additional details
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
      };
      
      const updatedHistory = [newActivity, ...activityHistory].slice(0, 1000); // Increased limit to 1000 activities
      setActivityHistory(updatedHistory);
      await AsyncStorage.setItem('activityHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  // Clear activity history
  const clearActivityHistory = async () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear all activity history?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: async () => {
          try {
            await ActivityTracker.clearActivityHistory();
            setActivityHistory([]);
            Alert.alert("Success", "Activity history has been cleared.");
          } catch (error) {
            console.error('Error clearing activity history:', error);
            Alert.alert("Error", "Failed to clear activity history.");
          }
        }}
      ]
    );
  };

  const handleLogout = () => {
    logoutUser();
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. You will need to sign up again if you want to access the app.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            console.log("Attempting to delete account for user:", currentUser.id);
            console.log("Making direct request to delete account");
            
            try {
              // Delete account from database using direct endpoint
              const response = await axios.post(`${API_BASE_URL}/api/auth/deleteAccount`, 
                { userId: currentUser.id },
                { 
                  headers: { 
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000 // 10 second timeout
                }
              );
              
              console.log("Delete account response:", response.data);
              
              if (response.data.success) {
                // Clear all local data
                await AsyncStorage.clear();
                
                Alert.alert("Account Deleted", "Your account has been successfully deleted.", [
                  { text: "OK", onPress: async () => {
                    // First logout the user to switch to the auth navigator
                    await logoutUser();
                    // Navigate directly to Signup instead of Login to avoid the "account doesn't exist" error
                    navigation.navigate("Signup");
                  }}
                ]);
              } else {
                Alert.alert("Error", response.data.message || "Failed to delete account");
              }
            } catch (error) {
              console.error("Failed to delete account:", error);
              
              let errorDetails = "";
              if (error.response) {
                console.error("Status:", error.response.status);
                console.error("Headers:", JSON.stringify(error.response.headers));
                console.error("Data:", error.response.data);
                errorDetails = `Status: ${error.response.status}. `;
                
                if (typeof error.response.data === 'string') {
                  errorDetails += error.response.data;
                } else if (error.response.data?.message) {
                  errorDetails += error.response.data.message;
                }
              } else if (error.request) {
                console.error("No response received from server.");
                errorDetails = "No response from server. Check your connection.";
              } else {
                console.error("Error message:", error.message);
                errorDetails = error.message;
              }
              
              let errorMessage = `There was an error deleting your account: ${errorDetails}`;
              
              // Clear local data anyway since we're going to log the user out
              try {
                await AsyncStorage.clear();
                await logoutUser();
              } catch (clearError) {
                console.error("Error clearing data:", clearError);
              }
              
              // Show error alert and then navigate to Signup screen
              Alert.alert(
                "Error", 
                `${errorMessage} Your local data has been cleared.`, 
                [
                  { 
                    text: "OK", 
                    onPress: async () => {
                      // Navigate directly to Signup instead of Login
                      navigation.navigate("Signup");
                    }
                  }
                ]
              );
            }
          }
        },
      ]
    );
  };

  // Handler for setting home location, checking if location sharing is enabled
  const handleSetHomeLocation = () => {
    if (!locationSharing) {
      Alert.alert(
        "Location Sharing Required",
        "Please enable Location Sharing in Settings to set your home location.",
        [{ text: "OK" }]
      );
      return;
    }
    
    // Navigate to the SetHomeLocation screen if location sharing is enabled
    navigation.navigate("SetHomeLocation", {
      locationData: currentUser?.homeLocation,
      returnScreen: 'Settings'  // Specify that we want to return to Settings
    });
  };

  const showFCMToken = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      Alert.alert(
        "Push Token",
        token || "No token found",
        [{ text: "OK" }]
      );
      console.log("Push Token:", token);
    } catch (error) {
      console.error("Error getting push token:", error);
      Alert.alert("Error", "Could not retrieve push token");
    }
  };

  // Add this effect to handle location updates from SetHomeLocation
  useEffect(() => {
    if (route.params?.homeLocation) {
      // Update user with the new home location
      if (currentUser) {
        const updatedUser = { ...currentUser, homeLocation: route.params.homeLocation };
        updateUser(updatedUser);
      }
      
      // Clear the params after using them
      navigation.setParams({ homeLocation: undefined });
    }
  }, [route.params?.homeLocation, currentUser, updateUser]);

  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { fontSize }]}>Settings</Text>
      
      {/* App Settings Card */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontSize }]}>App Settings</Text>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Reminders</Text>
          <Switch 
            value={reminders} 
            onValueChange={toggleReminders} 
            trackColor={{ false: "#CCC", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Location Sharing</Text>
          <Switch 
            value={locationSharing} 
            onValueChange={toggleLocationSharing} 
            trackColor={{ false: "#CCC", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Medication Alerts</Text>
          <Switch 
            value={medicationAlerts} 
            onValueChange={toggleMedicationAlerts} 
            trackColor={{ false: "#CCC", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Voice Assistance</Text>
          <Switch 
            value={voiceAssistance}
            onValueChange={toggleVoiceAssistance} 
            trackColor={{ false: "#CCC", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Font Size</Text>
          <Slider
            style={{ flex: 1 }}
            minimumValue={14}
            maximumValue={22}
            value={fontSize}
            onValueChange={(value) => {
              setFontSize(value);
              // Only log when user stops changing (on slider release)
            }}
            onSlidingComplete={(value) => {
              ActivityTracker.trackSettingChange('Font Size', Math.round(value));
            }}
            minimumTrackTintColor="#005BBB"
            maximumTrackTintColor="#CCC"
            thumbTintColor="#FFF"
          />
          <Text style={[styles.fontSizeText, { fontSize }]}>{Math.round(fontSize)}</Text>
        </View>
      </View>
      
      {/* Help & Support Card */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontSize }]}>Help & Support</Text>
        <TouchableOpacity 
          style={styles.row}
          onPress={() => navigation.navigate("HowToUse", { isCaregiver: false })}
        >
          <Text style={[styles.helpText, { fontSize }]}>How to Use App</Text>
          <Ionicons name="chevron-forward" size={20} color="#005BBB" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.row}
          onPress={async () => {
            // Refresh activity history before showing the modal
            const latestHistory = await ActivityTracker.getActivityHistory();
            setActivityHistory(latestHistory);
            setShowActivityHistory(true);
            // Track this action
            ActivityTracker.trackActivity('Viewed Activity History', 'User Action');
          }}
        >
          <Text style={[styles.helpText, { fontSize }]}>Activity History</Text>
          <Ionicons name="chevron-forward" size={20} color="#005BBB" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.row}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          <Text style={[styles.helpText, { fontSize }]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color="#005BBB" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={() => {
          logActivity('User logged out');
          handleLogout();
        }}
      >
        <Ionicons name="log-out" size={24} color="#D9534F" />
        <Text style={[styles.logoutText, { fontSize }]}>Logout</Text>
      </TouchableOpacity>

      {/* Delete Account Button */}
      <TouchableOpacity 
        style={styles.deleteButton} 
        onPress={() => {
          logActivity('Attempted to delete account');
          handleDeleteAccount();
        }}
      >
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>

      {/* Activity History Modal */}
      <Modal
        visible={showActivityHistory}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActivityHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Activity History</Text>
              <TouchableOpacity onPress={() => setShowActivityHistory(false)}>
                <Ionicons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>
            
            {/* Activity filters */}
            <View style={styles.activityFilters}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity 
                  style={[
                    styles.filterChip, 
                    activeFilter === 'all' && { backgroundColor: "#005BBB" }
                  ]}
                  onPress={() => setActiveFilter('all')}
                >
                  <Text style={[
                    styles.filterChipText, 
                    activeFilter === 'all' && { color: '#fff' }
                  ]}>All Activities</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.filterChip, 
                    activeFilter === 'Navigation' && { backgroundColor: '#4e8abe' }
                  ]}
                  onPress={() => setActiveFilter('Navigation')}
                >
                  <Text style={[
                    styles.filterChipText, 
                    activeFilter === 'Navigation' && { color: '#fff' }
                  ]}>Screen Visits</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.filterChip, 
                    activeFilter === 'Memory Game' && { backgroundColor: '#55a630' }
                  ]}
                  onPress={() => setActiveFilter('Memory Game')}
                >
                  <Text style={[
                    styles.filterChipText, 
                    activeFilter === 'Memory Game' && { color: '#fff' }
                  ]}>Games</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.filterChip, 
                    activeFilter === 'Setting' && { backgroundColor: '#6b5b95' }
                  ]}
                  onPress={() => setActiveFilter('Setting')}
                >
                  <Text style={[
                    styles.filterChipText, 
                    activeFilter === 'Setting' && { color: '#fff' }
                  ]}>Settings</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.filterChip, 
                    activeFilter === 'Exercise' && { backgroundColor: '#ff7b25' }
                  ]}
                  onPress={() => setActiveFilter('Exercise')}
                >
                  <Text style={[
                    styles.filterChipText, 
                    activeFilter === 'Exercise' && { color: '#fff' }
                  ]}>Exercises</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.filterChip, 
                    activeFilter === 'Brain Activity' && { backgroundColor: '#3498db' }
                  ]}
                  onPress={() => setActiveFilter('Brain Activity')}
                >
                  <Text style={[
                    styles.filterChipText, 
                    activeFilter === 'Brain Activity' && { color: '#fff' }
                  ]}>Brain Activities</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            
            {filteredActivities.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>
                  {activityHistory.length === 0 
                    ? "No activity history available." 
                    : "No activities match the selected filter."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredActivities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.activityItem}>
                    <View style={styles.activityHeader}>
                      <View style={styles.activityMeta}>
                        <Text style={styles.activityDate}>{item.date}</Text>
                        <Text style={styles.activityTime}>{item.time}</Text>
                      </View>
                      <View style={[styles.categoryBadge, { 
                        backgroundColor: 
                          item.category === 'Navigation' ? '#4e8abe' :
                          item.category === 'Setting' ? '#6b5b95' :
                          item.category === 'Memory Game' ? '#55a630' :
                          item.category === 'Exercise' ? '#ff7b25' :
                          item.category === 'Map' ? '#2c3e50' :
                          item.category === 'Family' ? '#e63946' :
                          '#888888'
                      }]}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.activityText}>{item.activity}</Text>
                    {item.details && (
                      <Text style={styles.activityDetails}>
                        {typeof item.details === 'object' && item.details !== null
                          ? JSON.stringify(item.details)
                          : item.details}
                      </Text>
                    )}
                  </View>
                )}
                style={styles.activityList}
              />
            )}
            
            <View style={styles.modalFooter}>
              {activityHistory.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearButton} 
                  onPress={clearActivityHistory}
                >
                  <Text style={styles.clearButtonText}>Clear History</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#FFFFFF" },
  title: { fontSize: 28, fontWeight: "bold", color: "#2C3E50", textAlign: "center", marginBottom: 20 },
  card: { backgroundColor: "#FAFAFA", borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2, borderColor: "#EEE" },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#005BBB", marginBottom: 15, borderBottomWidth: 1, borderBottomColor: "#EEE", paddingBottom: 5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  settingLabel: { fontSize: 16, color: "#2C3E50" },
  helpText: { fontSize: 16, color: "#2C3E50" },
  fontSizeText: { fontSize: 16, color: "#2C3E50", marginLeft: 10 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9534F",
    backgroundColor: "#FFF"
  },
  logoutText: { fontSize: 16, color: "#D9534F", fontWeight: "bold", marginLeft: 10 },
  deleteButton: { backgroundColor: '#D9534F', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  deleteButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  activityFilters: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#EEE',
    marginRight: 10,
  },
  filterChipText: {
    fontSize: 14,
    color: '#333',
  },
  activityList: {
    maxHeight: '80%',
  },
  activityItem: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  activityMeta: {
    flexDirection: 'column',
  },
  activityDate: {
    fontSize: 12,
    color: '#6C757D',
  },
  activityTime: {
    fontSize: 12,
    color: '#6C757D',
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
  },
  activityText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  activityDetails: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyHistory: {
    padding: 30,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#6C757D',
    fontStyle: 'italic',
  },
  clearButton: {
    backgroundColor: '#D9534F',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  clearButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalFooter: {
    marginTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  settingText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 10,
  },
  pickerContainer: {
    marginBottom: 15,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#CCC',
    backgroundColor: '#F5F5F5',
    marginTop: 5,
  },
  picker: {
    height: 40,
    width: '100%',
    color: '#2C3E50',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingDescription: {
    fontSize: 12,
    color: '#6C757D',
  },
  testVoiceButton: {
    backgroundColor: '#005BBB',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  testVoiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;