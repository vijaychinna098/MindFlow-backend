import React, { useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCaregiver } from "../../CaregiverContext";
import { useFontSize } from "./CaregiverFontSizeContext";
import { ReminderContext } from "../../context/ReminderContext";
import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CaregiverSyncIndicator from "../../components/CaregiverSyncIndicator";
import { shareProfileDataDirectly } from '../../services/DataSynchronizationService';

// Import API error handling functions
const { API_BASE_URL, handleApiError, checkServerConnectivity, getActiveServerUrl, safeApiCall } = require('../../config');

// Collection of Alzheimer's care tips
const ALZHEIMER_TIPS = [
  "Keep important items in the same place every day.",
  "Use simple and clear language when communicating.",
  "Establish a daily routine to reduce confusion.",
  "Label cabinets and drawers with words and pictures.",
  "Remove clutter to create a calm environment.",
  "Use contrasting colors to help with visual recognition.",
  "Limit choices to prevent overwhelming decisions.",
  "Incorporate regular physical activity into daily routines.",
  "Ensure adequate lighting to reduce shadows and confusion.",
  "Play familiar music to enhance mood and recall memories.",
  "Encourage participation in simple household tasks.",
  "Use nightlights to prevent disorientation at night.",
  "Keep photos and memory books to help recall people and events.",
  "Ensure regular health check-ups and medication reviews.",
  "Reduce noise and distractions during conversations.",
  "Maintain social connections and regular social activities.",
  "Use a large calendar to keep track of days and appointments.",
  "Break tasks into simple steps with clear instructions.",
  "Encourage hydration throughout the day.",
  "Create a safe walking path for wandering behavior.",
  "Establish a consistent bedtime routine for better sleep.",
  "Use pictures or symbols alongside written instructions.",
  "Keep favorite and familiar objects within reach.",
  "Provide reassurance and comfort during moments of confusion.",
  "Simplify clothing choices with easy-to-wear items.",
  "Be patient and allow extra time for responses and tasks.",
  "Maintain a consistent mealtime routine.",
  "Use alzheimer-friendly games and activities to stimulate the mind.",
  "Avoid correcting or arguing - redirect conversations instead.",
  "Create a calm and peaceful environment for relaxation.",
  "Maintain a consistent daily routine to reduce confusion.",
  "Speak slowly and clearly using short, simple sentences.",
  "Label rooms and important items with words or pictures.",
  "Encourage the person to do tasks they're still able to manage.",
  "Ensure the living space is safe and free from hazards.",
  "Use reminders like calendars, sticky notes, or apps.",
  "Stay calm, be patient, and avoid arguing or correcting."
];

// Function to get daily tip based on the current date
const getDailyTip = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const tipIndex = dayOfYear % ALZHEIMER_TIPS.length;
  return ALZHEIMER_TIPS[tipIndex];
};

const parseTime = (timeStr) => {
  try {
    if (!timeStr) return 0; // Handle null or undefined
    
    // Check if it's in 24-hour format (HH:MM)
    if (timeStr.includes(':') && !timeStr.includes(' ')) {
      // Check if it contains AM/PM without space (like "9:30AM")
      const ampmMatch = timeStr.match(/(\d+):(\d+)(AM|PM|am|pm)$/i);
      if (ampmMatch) {
        let hour = parseInt(ampmMatch[1], 10);
        const minute = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        
        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        
        return hour * 60 + minute;
      }
      
      // Regular 24-hour format
      const [hourStr, minuteStr] = timeStr.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      
      if (isNaN(hour) || isNaN(minute)) return 0;
      return hour * 60 + minute;
    }
    
    // Handle AM/PM format with space
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
        
        return hour * 60 + minute;
      }
      
      return 0; // Couldn't parse
    }
    
    const [hourStr, minuteStr] = (time || "").split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (isNaN(hour) || isNaN(minute)) return 0;
    
    if (period && period.toUpperCase() === "PM" && hour !== 12) {
      hour += 12;
    }
    if (period && period.toUpperCase() === "AM" && hour === 12) {
      hour = 0;
    }
    
    return hour * 60 + minute;
  } catch (error) {
    console.error("Error parsing time:", error);
    return 0; // Default value for sorting
  }
};

const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

// Safe image source handler function to prevent RCTImageView null errors
const getSafeImageSource = (source, defaultSource) => {
  try {
    // If source is null/undefined, return default
    if (!source) {
      return defaultSource;
    }
    
    // If it's already a number (from require), use it directly
    if (typeof source === 'number') {
      return source;
    }
    
    // Handle string sources (convert to uri format)
    if (typeof source === 'string') {
      // For Android, ensure file:// prefix
      if (Platform.OS === 'android' && 
          !source.startsWith('file://') && 
          !source.startsWith('content://') && 
          !source.startsWith('http')) {
        return { uri: `file://${source}` };
      }
      return { uri: source };
    }
    
    // Handle object with uri property
    if (typeof source === 'object' && source !== null) {
      if (!source.uri) {
        return defaultSource;
      }
      
      const uri = source.uri;
      if (!uri || typeof uri !== 'string') {
        return defaultSource;
      }
      
      // Handle Android URI format
      if (Platform.OS === 'android' && 
          !uri.startsWith('file://') && 
          !uri.startsWith('content://') && 
          !uri.startsWith('http')) {
        return { uri: `file://${uri}` };
      }
      
      return source;
    }
    
    // Fallback case
    return defaultSource;
  } catch (error) {
    console.log('Error preparing image source:', error);
    return defaultSource;
  }
};

const CaregiverHomeScreen = () => {
  const navigation = useNavigation();
  const { caregiver, logoutCaregiver, activePatient, setActivePatient, clearActivePatient, statusUpdateTrigger } = useCaregiver();
  const { fontSize } = useFontSize();
  const { reminders, removeReminder, completeReminder } = useContext(ReminderContext);
  const [connectedPatients, setConnectedPatients] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  // Add state for profile image modal
  const [profileImageModalVisible, setProfileImageModalVisible] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Function to handle profile image click
  const handleProfileImagePress = () => {
    setProfileImageModalVisible(true);
  };
  
  // Get default profile image
  const defaultProfileImage = require('../images/boy.png');
  
  // Get profile image source (caregiver's image or default) - with safe handling
  const profileImageSource = useMemo(() => {
    if (imageError) {
      return defaultProfileImage;
    }
    
    return getSafeImageSource(
      caregiver?.profileImage, 
      defaultProfileImage
    );
  }, [caregiver?.profileImage, imageError]);

  useEffect(() => {
    const loadReminders = async () => {
      try {
        console.log("Reminders are now managed by ReminderContext");
      } catch (error) {
        console.error("Failed to load reminders:", error);
        Alert.alert(
          "Loading Error",
          "There was a problem loading reminders. Please try again."
        );
      }
    };
    loadReminders();
  }, [activePatient?.email]);

  // Verify caregiver's patient connection is valid
  useEffect(() => {
    const verifyPatientConnection = async () => {
      if (!caregiver || !caregiver.id) return;
      
      try {
        console.log("Verifying patient connection for caregiver:", caregiver.email);
        let axios;
        try {
          axios = require('axios');
        } catch (error) {
          console.log("Couldn't import axios, skipping patient verification");
          return; // Exit if we can't import axios
        }
        
        // If caregiver has a patientEmail, verify it exists in the database
        if (caregiver.patientEmail) {
          console.log(`Checking if patient ${caregiver.patientEmail} still exists...`);
          
          try {
            // Use a timestamp check to prevent too frequent verifications
            const lastVerificationKey = `lastPatientVerification_${caregiver.patientEmail}`;
            const lastVerification = await AsyncStorage.getItem(lastVerificationKey);
            
            if (lastVerification) {
              const lastTime = new Date(JSON.parse(lastVerification)).getTime();
              const now = new Date().getTime();
              const timeSinceLastCheck = now - lastTime;
              
              // Only check once every 15 minutes (900000 ms) to prevent cycling
              if (timeSinceLastCheck < 900000) {
                console.log(`Skipping verification, last check was ${Math.round(timeSinceLastCheck/1000)} seconds ago`);
                return;
              }
            }
            
            // Store the verification time
            await AsyncStorage.setItem(lastVerificationKey, JSON.stringify(new Date()));
            
            // Use safeApiCall to handle API errors gracefully
            let apiSuccess = false;
            
            try {
              const response = await safeApiCall(
                () => axios.get(`${getActiveServerUrl()}/api/caregivers/check-patient/${caregiver.patientEmail.toLowerCase()}`),
                { data: { exists: true } }, // Default to assuming patient exists on error
                `Error checking if patient ${caregiver.patientEmail} exists`
              );
              
              apiSuccess = true;
              
              if (response && response.data && response.data.exists === false) {
                console.log(`Patient ${caregiver.patientEmail} no longer exists in the database (confirmed by server)`);
                
                // Clear the connection on the server
                try {
                  await safeApiCall(
                    () => axios.post(`${getActiveServerUrl()}/api/caregivers/disconnect`, {
                      caregiverId: caregiver.id,
                      patientEmail: caregiver.patientEmail
                    }),
                    { success: true },
                    "Error disconnecting from server"
                  );
                  console.log("Server connection removed");
                } catch (disconnectError) {
                  console.error("Error disconnecting from server:", disconnectError.message);
                  // Continue even if disconnect fails
                }
                
                // Clear the active patient if it's related to this email
                if (activePatient && normalizeEmail(activePatient.email) === normalizeEmail(caregiver.patientEmail)) {
                  console.log("Clearing active patient reference");
                  setActivePatient(null);
                  
                  // Show notification to user
                  Alert.alert(
                    "Patient Account Deleted",
                    "The patient you were connected to has deleted their account. You have been disconnected from this patient.",
                    [{ text: "OK" }]
                  );
                }
              } else {
                console.log(`Patient ${caregiver.patientEmail} exists or verification was inconclusive`);
                
                // Only verify connection if patient existence check succeeded
                try {
                  const connectionResponse = await safeApiCall(
                    () => axios.get(`${getActiveServerUrl()}/api/caregivers/verify-connection/${caregiver.id}/${caregiver.patientEmail.toLowerCase()}`),
                    { data: { connected: true } }, // Default to assuming connection is valid on error
                    `Error verifying connection to patient ${caregiver.patientEmail}`
                  );
                  
                  if (connectionResponse && connectionResponse.data && connectionResponse.data.connected === false) {
                    console.log(`Connection to patient ${caregiver.patientEmail} is no longer valid (confirmed by server)`);
                    
                    // Clear the active patient if it's related to this email
                    if (activePatient && normalizeEmail(activePatient.email) === normalizeEmail(caregiver.patientEmail)) {
                      console.log("Clearing active patient reference due to invalid connection");
                      setActivePatient(null);
                      
                      // Show notification to user
                      Alert.alert(
                        "Connection Removed",
                        "You are no longer connected to this patient. The connection may have been removed by the patient or system administrator.",
                        [{ text: "OK" }]
                      );
                    }
                  } else {
                    console.log(`Verified patient ${caregiver.patientEmail} exists and connection is valid`);
                  }
                } catch (connectionError) {
                  console.log("Connection verification failed, assuming connection is still valid:", connectionError.message);
                  // If we can't verify the connection, assume it's still valid
                }
              }
            } catch (apiError) {
              console.log("API call failed, assuming patient still exists:", apiError.message);
              // If API call fails completely, don't clear the connection
            }
            
            // If API call completely failed, don't show any error alerts
            if (!apiSuccess) {
              console.log("Network error or server unreachable - keeping patient connection");
            }
          } catch (verifyError) {
            console.error("Error in verification process:", verifyError.message);
            // Continue with app flow, don't disrupt user experience with errors
          }
        } else {
          console.log("No patient connected to this caregiver");
        }
      } catch (error) {
        // Just log the error, don't disrupt the user experience with error alerts
        console.error("Failed to verify patient connection:", error.message);
      }
    };
    
    // Don't check every time caregiver or activePatient changes to reduce cycles
    // Only check when the component mounts
    verifyPatientConnection();
  }, []);

  // Helper function for email normalization
  const normalizeEmail = (email) => {
    if (!email) return '';
    return email.toLowerCase().trim();
  };

  const loadConnectedPatients = async () => {
    console.log(`===== LOADING CONNECTED PATIENTS (HOME SCREEN) =====`);
    
    if (!caregiver || !caregiver.email) {
      setConnectedPatients([]);
      return;
    }
    
    try {
      // If we have a patientEmail from the caregiver but no active patient,
      // check for active patient issues
      console.log(`Active patient: ${activePatient ? activePatient.name : 'none'}`);
      
      setIsLoading(true);
      
      // For offline compatibility, first load patients from local storage
      try {
        const patientsKey = `connectedPatients_${caregiver.email}`;
        const storedPatients = await AsyncStorage.getItem(patientsKey);
        let patientsList = [];
        
        if (storedPatients) {
          console.log('Loaded patients from storage key:', patientsKey);
          patientsList = JSON.parse(storedPatients);
          console.log(`Loaded ${patientsList.length} patients from storage`);
          
          // Log patients for debugging
          console.log('LOADED PATIENTS (HOME):');
          patientsList.forEach(patient => {
            console.log(`Patient: ${patient.name || 'Unknown'}, Email: '${patient.email}'`);
          });
        } else {
          console.log('No stored patients found');
        }
        
        // Try to import axios for server verification
        let axios;
        try {
          axios = require('axios').default;
        } catch (error) {
          console.log("Axios not available - using stored patients only");
          // If we can't import axios, use the local data only
          setConnectedPatients(patientsList);
          setIsLoading(false);
          return;
        }
        
        // Verify server is reachable before attempting any API calls
        let serverAvailable = false;
        try {
          const pingResult = await safeApiCall(
            () => axios.get(`${getActiveServerUrl()}/api/ping`, { timeout: 3000 }),
            { data: { success: false } },
            "Server ping failed"
          );
          serverAvailable = pingResult.data.success;
        } catch (pingError) {
          console.log("Server ping failed:", pingError.message);
          // If ping fails, consider server unavailable
          serverAvailable = false;
        }
        
        // If server is unavailable, use local data without verification
        if (!serverAvailable) {
          console.log("Server unavailable - using stored patients without verification");
          setConnectedPatients(patientsList);
          setIsLoading(false);
          return;
        }
        
        // If we get here, we can try to verify patients with the server
        const verifiedPatients = [];
        const removedPatients = [];
        let networkErrorOccurred = false;
        
        for (const patient of patientsList) {
          try {
            const normalizedEmail = normalizeEmail(patient.email);
            console.log(`Verifying patient exists: ${normalizedEmail}`);
            
            // Check if the patient still exists in the backend
            try {
              const response = await safeApiCall(
                () => axios.get(`${getActiveServerUrl()}/api/caregivers/check-patient/${normalizedEmail}`),
                { data: { exists: true } }, // Default to patient exists on error
                "API error verifying patient"
              );
              
              if (response && response.data && response.data.exists === false) {
                console.log(`❌ Patient ${normalizedEmail} does not exist or was deleted (confirmed by server)`);
                removedPatients.push(patient);
                // Don't add to verified patients list
              } else {
                console.log(`✅ Patient ${normalizedEmail} exists or verification was inconclusive`);
                
                // Only verify connection if patient exists
                try {
                  console.log(`Verifying connection between caregiver and patient: ${normalizedEmail}`);
                  const connectionResponse = await safeApiCall(
                    () => axios.get(`${getActiveServerUrl()}/api/caregivers/verify-connection/${caregiver.id}/${normalizedEmail}`),
                    { data: { connected: true } }, // Default to connection valid on error
                    "API error verifying connection"
                  );
                  
                  if (connectionResponse && connectionResponse.data && connectionResponse.data.connected === false) {
                    console.log(`❌ No connection found between caregiver and patient: ${normalizedEmail} (confirmed by server)`);
                    removedPatients.push(patient);
                  } else {
                    console.log(`✅ Confirmed connection between caregiver and patient: ${normalizedEmail}`);
                    verifiedPatients.push(patient);
                  }
                } catch (connectionError) {
                  // If we can't verify the connection, keep the patient to be safe
                  console.log(`Error verifying connection for ${normalizedEmail}: ${connectionError.message}`);
                  verifiedPatients.push(patient);
                  networkErrorOccurred = true;
                }
              }
            } catch (verifyError) {
              console.log(`Error verifying patient ${normalizedEmail}: ${verifyError.message}`);
              // On verification errors, keep the patient to be safe
              verifiedPatients.push(patient);
              networkErrorOccurred = true;
            }
          } catch (patientError) {
            console.error(`Error processing patient: ${patientError.message}`);
            // Continue with next patient
          }
        }
        
        console.log(`Verified ${verifiedPatients.length} patients, removed ${removedPatients.length} patients`);
        
        // Save verified patients back to AsyncStorage
        await AsyncStorage.setItem(patientsKey, JSON.stringify(verifiedPatients));
        
        // Set our patient list (whether verified or loaded locally)
        setConnectedPatients(verifiedPatients);
        
        // Show notification if we had network errors during verification
        if (networkErrorOccurred) {
          console.log("Network errors occurred during patient verification - some data may not be up to date");
          // No need to show an alert for this, just log it
        }
        
        // Load profile images for each patient
        await updatePatientProfilesFromUserData(verifiedPatients);
        
      } catch (storageError) {
        console.error('Error loading patients from storage:', storageError);
        // Set empty list if we can't load from storage
        setConnectedPatients([]);
      }
      
    } catch (error) {
      console.error("Failed to load patients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to update patient profiles from userData
  const updatePatientProfilesFromUserData = async (patientsList) => {
    try {
      console.log("Updating patient profiles from userData...");
      const updatedPatients = [...patientsList];
      let needsUpdate = false;
      
      for (const patient of updatedPatients) {
        // Skip patients without email
        if (!patient.email) continue;
        
        const normalizedEmail = normalizeEmail(patient.email);
        console.log(`Looking for profile data for patient: ${normalizedEmail}`);
        
        // First check for direct user data
        const userDataKey = `userData_${normalizedEmail}`;
        try {
          const userData = await AsyncStorage.getItem(userDataKey);
          if (userData) {
            const parsedData = JSON.parse(userData);
            console.log(`Found direct user data for ${normalizedEmail}: ${parsedData.name}`);
            
            // Update patient data
            let patientChanged = false;
            
            if (parsedData.name && parsedData.name !== patient.name) {
              patient.name = parsedData.name;
              patientChanged = true;
            }
            
            // Sanitize profile image before storing to prevent RCTImageView errors
            if (parsedData.profileImage) {
              console.log(`Found profile image for ${normalizedEmail}: ${parsedData.profileImage}`);
              
              // Ensure image source format is valid
              let sanitizedImage = parsedData.profileImage;
              if (typeof sanitizedImage === 'string') {
                // For Android, ensure file:// prefix for local files
                if (Platform.OS === 'android' && 
                    !sanitizedImage.startsWith('file://') && 
                    !sanitizedImage.startsWith('content://') && 
                    !sanitizedImage.startsWith('http')) {
                  sanitizedImage = `file://${sanitizedImage}`;
                }
              }
              
              patient.profileImage = sanitizedImage;
              patientChanged = true;
            }
            
            if (patientChanged) {
              console.log(`Updating image for ${normalizedEmail}`);
              needsUpdate = true;
            }
          }
        } catch (err) {
          console.error(`Error getting user data for ${normalizedEmail}:`, err);
        }
      }
      
      if (needsUpdate && caregiver?.email) {
        // Save updated patients back to AsyncStorage
        const patientsKey = `connectedPatients_${caregiver.email}`;
        await AsyncStorage.setItem(patientsKey, JSON.stringify(updatedPatients));
        
        console.log("UPDATED PATIENTS WITH PROFILE DATA:");
        updatedPatients.forEach(patient => {
          console.log(`Patient: ${patient.name}, Email: ${patient.email}, Image: ${patient.profileImage ? 'YES' : 'NO'}`);
        });
        
        // Update state with the updated patients
        setConnectedPatients(updatedPatients);
      }
      
      return updatedPatients;
    } catch (error) {
      console.error("Error updating patient profiles:", error);
      return patientsList; // Return original list on error
    }
  };

  // Load active patient reminders when activePatient changes
  useEffect(() => {
    const loadRemindersForActivePatient = async () => {
      try {
        console.log(`Active patient: ${activePatient ? activePatient.name : 'none'}`);
        
        // If we have a patientEmail from the caregiver but no active patient,
        // try to load the patient data from AsyncStorage
        if (!activePatient && caregiver?.patientEmail) {
          console.log(`No active patient but caregiver has patientEmail: ${caregiver.patientEmail}`);
          
          // Try to get the patient data from AsyncStorage
          const normalizedEmail = normalizeEmail(caregiver.patientEmail);
          const userDataKey = `userData_${normalizedEmail}`;
          
          try {
            const userData = await AsyncStorage.getItem(userDataKey);
            if (userData) {
              const patientData = JSON.parse(userData);
              console.log(`Found patient data for ${normalizedEmail}:`, patientData.name);
              
              // Set this as the active patient
              setActivePatient(patientData);
            } else {
              console.log(`No user data found for ${normalizedEmail}`);
              
              // Try to find in connected patients
              const patientsKey = `connectedPatients_${caregiver.email}`;
              const storedPatients = await AsyncStorage.getItem(patientsKey);
              
              if (storedPatients) {
                const patientsList = JSON.parse(storedPatients);
                const connectedPatient = patientsList.find(
                  p => normalizeEmail(p.email) === normalizedEmail
                );
                
                if (connectedPatient) {
                  console.log(`Found connected patient: ${connectedPatient.name || connectedPatient.email}`);
                  setActivePatient(connectedPatient);
                }
              }
            }
          } catch (error) {
            console.error("Error loading patient data:", error);
          }
        }
        
        // No need to manually load/set reminders here
        // The ReminderContext already handles patient changes
      } catch (error) {
        console.error("Failed to load reminders for active patient:", error);
      }
    };
    
    loadRemindersForActivePatient();
    
    // Show notification about active patient on login ONLY if the patient exists in connected patients
    if (activePatient && connectedPatients.some(p => normalizeEmail(p.email) === normalizeEmail(activePatient.email))) {
      setTimeout(() => {
        Alert.alert(
          "Active Patient",
          `${activePatient.name || activePatient.email} is currently set as the active patient. All data management will affect this patient.`,
          [{ text: "OK" }]
        );
      }, 500); // Small delay to ensure UI is ready
    }
  }, [activePatient, caregiver]);

  // Update active patient with information from connectedPatients if available
  useEffect(() => {
    if (activePatient && connectedPatients.length > 0) {
      const normalizedActiveEmail = normalizeEmail(activePatient.email);
      const matchedPatient = connectedPatients.find(p => normalizeEmail(p.email) === normalizedActiveEmail);
      
      if (matchedPatient) {
        // Check if there are actual differences before updating
        const needsUpdate = 
          (matchedPatient.name && matchedPatient.name !== activePatient.name) || 
          (matchedPatient.profileImage && matchedPatient.profileImage !== activePatient.profileImage) ||
          (matchedPatient.image && matchedPatient.image !== activePatient.image);
        
        if (needsUpdate) {
          console.log(`Updating active patient info from connected patients for ${normalizedActiveEmail}`);
          
          // Store the updated patient in a variable to avoid direct state updates that might cause rerenders
          const updatedPatient = {
            ...activePatient,
            name: matchedPatient.name || activePatient.name,
            profileImage: matchedPatient.profileImage || activePatient.profileImage,
            image: matchedPatient.image || activePatient.image
          };
          
          // Use setTimeout to avoid synchronous state updates
          setTimeout(() => {
            setActivePatient(updatedPatient);
          }, 0);
        }
      } else {
        // If active patient is not in connected patients list, clear it
        console.log(`Active patient ${normalizedActiveEmail} not found in connected patients - clearing active patient`);
        setActivePatient(null);
      }
    }
  }, [connectedPatients]);

  // Verify active patient exists in connected patients list
  useEffect(() => {
    const checkActivePatientExists = async () => {
      if (!activePatient || !caregiver?.email) return;
      
      try {
        // Get the current list of connected patients
        const patientsKey = `connectedPatients_${caregiver.email}`;
        const storedPatients = await AsyncStorage.getItem(patientsKey);
        
        if (storedPatients) {
          const connectedPatients = JSON.parse(storedPatients);
          const normalizedActiveEmail = activePatient.email?.toLowerCase().trim();
          
          // Check if active patient exists in connected patients list
          const patientExists = connectedPatients.some(
            patient => patient.email?.toLowerCase().trim() === normalizedActiveEmail
          );
          
          if (!patientExists) {
            console.log(`Active patient ${normalizedActiveEmail} not found in connected patients list`);
            
            // Before removing, check if the patient exists on the server
            try {
              const config = require('../../config');
              const axios = require('axios');
              
              // Check if the patient still exists in the database
              const response = await axios.get(
                `${config.API_BASE_URL || config.getActiveServerUrl()}/api/caregivers/check-patient/${normalizedActiveEmail}`,
                { timeout: 5000 }
              );
              
              if (response?.data?.exists === false) {
                console.log(`Server confirmed patient ${normalizedActiveEmail} has been deleted`);
                
                // Clear the active patient
                await clearActivePatient();
                
                // Force clear from AsyncStorage directly
                const activePatientKey = `activePatient_${caregiver.email}`;
                await AsyncStorage.removeItem(activePatientKey);
                
                // Show notification to user
                Alert.alert(
                  "Patient Removed",
                  "The active patient has been deleted. Please select another patient when needed.",
                  [{ text: "OK" }]
                );
              }
            } catch (error) {
              console.log("Error verifying patient on server:", error.message);
              // Continue with UI in case of network error
            }
          }
        }
      } catch (error) {
        console.error("Error checking if active patient exists:", error.message);
      }
    };

    // Call immediately when component mounts and whenever active patient or status trigger changes
    checkActivePatientExists();
    
    // Return cleanup function
    return () => {
      // No cleanup needed
    };
  }, [activePatient, caregiver, clearActivePatient, statusUpdateTrigger]);

  const confirmRemoveReminder = (id, title) => {
    Alert.alert(
      "Complete Reminder",
      `Mark "${title}" as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Complete", 
          onPress: () => {
            completeReminder(id);
          }
        }
      ]
    );
  };

  // Sort reminders by time
  const sortedReminders = Array.isArray(reminders) ? [...reminders]
    .filter(reminder => !reminder.isCompleted && !reminder.completed)
    .sort((a, b) => {
      // Extract hours and minutes
      const getMinutes = (timeStr) => {
        try {
          if (!timeStr) return 0;
          
          const isPM = timeStr.toLowerCase().includes("pm");
          const isAM = timeStr.toLowerCase().includes("am");
          
          // Extract hours and minutes
          const timeParts = timeStr.replace(/[^0-9:]/g, "").split(":");
          let hours = parseInt(timeParts[0], 10);
          const minutes = parseInt(timeParts[1], 10);
          
          // Convert to 24-hour format
          if (isPM && hours < 12) hours += 12;
          if (isAM && hours === 12) hours = 0;
          
          return hours * 60 + minutes;
        } catch (error) {
          return 0;
        }
      };
      
      return getMinutes(a.time) - getMinutes(b.time);
    }) : [];
  
  // Get completed reminders, sorted by most recent first
  const completedReminders = Array.isArray(reminders) ? [...reminders]
    .filter(reminder => reminder.isCompleted || reminder.completed)
    .sort((a, b) => {
      // Sort by completedAt timestamp if available, otherwise by time
      if (a.completedAt && b.completedAt) {
        return new Date(b.completedAt) - new Date(a.completedAt);
      }
      return parseTime(b.time) - parseTime(a.time);
    }) : [];
  
  const displayedReminders = sortedReminders.slice(0, 2);
  const displayedCompletedReminders = completedReminders.slice(0, 2);

  const handleSeeAll = () => {
    navigation.navigate("CaregiverReminders");
  };

  const dailyTip = getDailyTip();

  const handleLogout = async () => {
    try {
      if (typeof logoutCaregiver !== "function") {
        throw new Error("logoutCaregiver is undefined");
      }
      await logoutCaregiver();
      navigation.navigate("CaregiverLogin");
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to log out.");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const currentMinutes = getCurrentMinutes();
      if (reminders && Array.isArray(reminders)) {
      reminders.forEach((reminder) => {
        if (parseTime(reminder.time) === currentMinutes) {
          const username = caregiver?.name || "friend";
          const message = `Reminder, hey ${username} now it's time to ${reminder.title} the time is ${reminder.time}`;
          Speech.speak(message, { language: "en-US", rate: 0.9 });
        }
      });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [reminders, caregiver]);

  // Check for unread notifications
  useEffect(() => {
    const checkUnreadNotifications = async () => {
      if (!caregiver?.email) return;
      
      try {
        const caregiverEmail = caregiver.email.toLowerCase().trim();
        
        // Check caregiver-specific notifications
        const caregiverNotificationKey = `caregiverNotifications_${caregiverEmail}`;
        const caregiverNotifications = await AsyncStorage.getItem(caregiverNotificationKey);
        let unreadCount = 0;
        
        if (caregiverNotifications) {
          const parsedNotifications = JSON.parse(caregiverNotifications);
          if (Array.isArray(parsedNotifications)) {
            // Count unread notifications
            unreadCount = parsedNotifications.filter(n => !n.read).length;
          }
        }
        
        setUnreadNotifications(unreadCount);
      } catch (error) {
        console.error("Error checking unread notifications:", error);
      }
    };
    
    // Check on component mount and when focusing the screen
    checkUnreadNotifications();
    
    const unsubscribe = navigation.addListener('focus', () => {
      checkUnreadNotifications();
    });
    
    return unsubscribe;
  }, [caregiver?.email, navigation]);

  // Verify active patient is valid on component mount
  useEffect(() => {
    const validateActivePatient = async () => {
      try {
        // If we have an active patient and connected patients are loaded
        if (activePatient && connectedPatients.length > 0) {
          console.log(`Validating active patient: ${activePatient.email}`);
          
          // Check if the active patient exists in the connected patients list
          const normalizedActiveEmail = normalizeEmail(activePatient.email);
          const patientExists = connectedPatients.some(
            p => normalizeEmail(p.email) === normalizedActiveEmail
          );
          
          if (!patientExists) {
            console.log(`Active patient ${normalizedActiveEmail} not found in connected patients list`);
            
            // Before clearing, check if we're offline and have a caregiver-patient connection
            if (caregiver?.patientEmail && normalizeEmail(caregiver.patientEmail) === normalizedActiveEmail) {
              console.log(`Active patient matches caregiver.patientEmail, keeping active state`);
              // Patient is still connected to caregiver, keep it active
              return;
            }
            
            // Store the current timestamp before clearing
            const clearKey = `activePatientCleared_${normalizedActiveEmail}`;
            const lastClearedStr = await AsyncStorage.getItem(clearKey);
            
            // Check if we've recently tried to clear this patient (prevent cycling)
            if (lastClearedStr) {
              const lastCleared = new Date(JSON.parse(lastClearedStr)).getTime();
              const now = new Date().getTime();
              // Only attempt to clear once every 10 minutes
              if (now - lastCleared < 600000) { // 10 minutes in milliseconds
                console.log(`Already attempted to clear this active patient recently, skipping`);
                return;
              }
            }
            
            // Save clearing timestamp
            await AsyncStorage.setItem(clearKey, JSON.stringify(new Date()));
            
            // Remove the active patient reference
            setActivePatient(null);
            
            // Also remove from storage
            if (caregiver?.email) {
              const activePatientKey = `activePatient_${caregiver.email}`;
              await AsyncStorage.removeItem(activePatientKey);
              console.log("Removed invalid active patient from storage");
            }
          } else {
            console.log(`Active patient ${normalizedActiveEmail} verified in connected patients list`);
          }
        }
      } catch (error) {
        console.error("Error validating active patient:", error);
      }
    };
    
    validateActivePatient();
  }, [connectedPatients]);

  // Load patients when caregiver loads
  useEffect(() => {
    // Only run when caregiver exists and has email
    if (caregiver && caregiver.email) {
      // Use a timer check to prevent too frequent reloads
      const loadPatientsWithThrottle = async () => {
        const lastLoadKey = `lastPatientLoad_${caregiver.email}`;
        const lastLoadTime = await AsyncStorage.getItem(lastLoadKey);
        
        if (lastLoadTime) {
          const lastTime = new Date(JSON.parse(lastLoadTime)).getTime();
          const now = new Date().getTime();
          // Only reload if it's been more than 5 minutes
          if (now - lastTime < 300000) { // 5 minutes in milliseconds
            console.log(`Skipping patient reload, last load was ${Math.round((now - lastTime)/1000)} seconds ago`);
            return;
          }
        }
        
        // Record load time
        await AsyncStorage.setItem(lastLoadKey, JSON.stringify(new Date()));
        loadConnectedPatients();
      };
      
      loadPatientsWithThrottle();
    }
  }, [caregiver?.email]);
  
  // Reload patients when screen comes into focus, but with throttling
  useEffect(() => {
    if (!navigation) return;
    
    const handleFocus = async () => {
      console.log("Home screen focused");
      
      // Don't reload if no caregiver
      if (!caregiver || !caregiver.email) return;
      
      const lastLoadKey = `lastFocusPatientLoad_${caregiver.email}`;
      const lastLoadTime = await AsyncStorage.getItem(lastLoadKey);
      
      if (lastLoadTime) {
        const lastTime = new Date(JSON.parse(lastLoadTime)).getTime();
        const now = new Date().getTime();
        // Only reload on focus if it's been more than 2 minutes
        if (now - lastLoadTime < 120000) { // 2 minutes in milliseconds
          console.log(`Skipping focus patient reload, last focus load was ${Math.round((now - lastLoadTime)/1000)} seconds ago`);
          return;
        }
      }
      
      // Record this focus load time
      await AsyncStorage.setItem(lastLoadKey, JSON.stringify(new Date()));
      console.log("Reloading patients due to screen focus");
      loadConnectedPatients();
    };
    
    const unsubscribe = navigation.addListener('focus', handleFocus);
    return unsubscribe;
  }, [navigation, caregiver?.email]);

  // Force refresh the active patient status when navigating to this screen
  useEffect(() => {
    const refreshActivePatientStatus = () => {
      console.log("Refreshing active patient status");
      
      // Check AsyncStorage for active patient
      const checkActivePatientStorage = async () => {
        if (!caregiver || !caregiver.email) return;
        
        try {
          const activePatientKey = `activePatient_${caregiver.email}`;
          const storedActivePatient = await AsyncStorage.getItem(activePatientKey);
          
          // If active patient in memory doesn't match storage, update it
          if (!storedActivePatient && activePatient) {
            console.log("Active patient in memory but not in storage - clearing active patient");
            setActivePatient(null);
          } else if (storedActivePatient && !activePatient) {
            // Active patient in storage but not in memory, load it
            console.log("Active patient in storage but not in memory - loading from storage");
            const parsedActivePatient = JSON.parse(storedActivePatient);
            setActivePatient(parsedActivePatient);
          }
        } catch (error) {
          console.error("Error checking active patient storage:", error);
        }
      };
      
      checkActivePatientStorage();
    };

    // Check on initial render and when screen comes into focus
    refreshActivePatientStatus();
    
    const unsubscribe = navigation.addListener('focus', () => {
      refreshActivePatientStatus();
    });
    
    return unsubscribe;
  }, [navigation, caregiver, activePatient]);

  // Add this function to update caregiver-patient mappings and refresh data
  const refreshPatientsData = async () => {
    try {
      console.log("===== REFRESHING CAREGIVER-PATIENT CONNECTIONS =====");
      
      if (!caregiver || !caregiver.email) {
        console.log("No caregiver logged in, skipping refresh");
        return;
      }
      
      const caregiverEmail = caregiver.email.toLowerCase().trim();
      console.log(`Checking connections for caregiver: ${caregiverEmail}`);
      
      // Get the patient mapping
      const mappingKey = 'caregiverPatientsMap';
      const mappingStr = await AsyncStorage.getItem(mappingKey);
      if (!mappingStr) {
        console.log("No caregiver-patient mappings found");
        return;
      }
      
      let mappings = {};
      try {
        mappings = JSON.parse(mappingStr);
      } catch (error) {
        console.log(`Error parsing caregiver-patient mappings: ${error.message}`);
        return;
      }
      
      // Get the list of patients from the caregiver_ key
      const patientKey = `caregiver_${caregiverEmail}`;
      const patientEmails = mappings[patientKey] || [];
      
      if (patientEmails.length === 0) {
        console.log("No patients found for this caregiver");
        return;
      }
      
      console.log(`Found ${patientEmails.length} patients to refresh`);
      
      // Get the patient list for UI updates
      const connectedPatientsKey = `connectedPatients_${caregiverEmail}`;
      const patientsListStr = await AsyncStorage.getItem(connectedPatientsKey);
      let patientsList = [];
      
      if (patientsListStr) {
        try {
          patientsList = JSON.parse(patientsListStr);
        } catch (error) {
          console.log(`Error parsing patients list: ${error.message}`);
          patientsList = [];
        }
      }
      
      // Check each patient for the most up-to-date data
      for (const patientEmail of patientEmails) {
        console.log(`Refreshing data for patient: ${patientEmail}`);
        
        // Check direct patient data first
        let patientData = null;
        try {
          const directPatientKey = `directPatientData_${patientEmail}`;
          const directDataStr = await AsyncStorage.getItem(directPatientKey);
          
          if (directDataStr) {
            try {
              patientData = JSON.parse(directDataStr);
              console.log(`Found direct patient data for: ${patientData.name || patientEmail}`);
            } catch (parseError) {
              console.log(`Error parsing direct patient data: ${parseError.message}`);
            }
          }
        } catch (error) {
          console.log(`Error getting direct patient data: ${error.message}`);
        }
        
        // If no direct data, check synced user data
        if (!patientData) {
          try {
            const syncedUserDataKey = `syncedUserData_${patientEmail}`;
            const syncedDataStr = await AsyncStorage.getItem(syncedUserDataKey);
            
            if (syncedDataStr) {
              try {
                patientData = JSON.parse(syncedDataStr);
                console.log(`Found synced user data for: ${patientData.name || patientEmail}`);
              } catch (parseError) {
                console.log(`Error parsing synced user data: ${parseError.message}`);
              }
            }
          } catch (error) {
            console.log(`Error getting synced user data: ${error.message}`);
          }
        }
        
        // If no synced data, check regular user data
        if (!patientData) {
          try {
            const userDataKey = `userData_${patientEmail}`;
            const userDataStr = await AsyncStorage.getItem(userDataKey);
            
            if (userDataStr) {
              try {
                patientData = JSON.parse(userDataStr);
                console.log(`Found user data for: ${patientData.name || patientEmail}`);
              } catch (parseError) {
                console.log(`Error parsing user data: ${parseError.message}`);
              }
            }
          } catch (error) {
            console.log(`Error getting user data: ${error.message}`);
          }
        }
        
        // Update the patient list with the found data
        if (patientData) {
          const existingPatientIndex = patientsList.findIndex(p => 
            p.email.toLowerCase().trim() === patientEmail.toLowerCase().trim()
          );
          
          // Handle profile image to ensure valid format
          let profileImageSrc = patientData.profileImage || patientData.image;
          
          // Sanitize profile image to prevent RCTImageView errors
          if (profileImageSrc && typeof profileImageSrc === 'string') {
            // For Android, ensure file:// prefix for local files
            if (Platform.OS === 'android' && 
                !profileImageSrc.startsWith('file://') && 
                !profileImageSrc.startsWith('content://') && 
                !profileImageSrc.startsWith('http')) {
              profileImageSrc = `file://${profileImageSrc}`;
            }
          }
          
          if (existingPatientIndex >= 0) {
            // Update existing patient
            patientsList[existingPatientIndex] = {
              ...patientsList[existingPatientIndex],
              name: patientData.name || patientsList[existingPatientIndex].name,
              image: profileImageSrc || patientsList[existingPatientIndex].image,
              profileImage: profileImageSrc || patientsList[existingPatientIndex].profileImage,
              lastUpdate: new Date().toISOString()
            };
            console.log(`Updated existing patient: ${patientData.name || patientEmail}`);
          } else if (patientData.name) {
            // Add new patient
            patientsList.push({
              id: patientData.id || `patient-${Date.now()}`,
              email: patientEmail,
              name: patientData.name,
              image: profileImageSrc,
              profileImage: profileImageSrc,
              lastUpdate: new Date().toISOString()
            });
            console.log(`Added new patient: ${patientData.name}`);
          }
        }
      }
      
      // Save the updated patient list
      await AsyncStorage.setItem(connectedPatientsKey, JSON.stringify(patientsList));
      console.log(`Saved updated patient list with ${patientsList.length} patients`);
      
      // If we have an active patient, make sure the data is refreshed too
      if (activePatient) {
        const activePatientsData = patientsList.find(p => 
          p.email.toLowerCase().trim() === activePatient.email.toLowerCase().trim()
        );
        
        if (activePatientsData && (
          activePatientsData.name !== activePatient.name || 
          activePatientsData.image !== activePatient.image
        )) {
          console.log(`Updating active patient with refreshed data: ${activePatientsData.name}`);
          setActivePatient(activePatientsData);
        }
      }
    } catch (error) {
      console.error(`Error refreshing patients data: ${error.message}`);
    }
  };

  // Add this effect to run the refresh function
  useEffect(() => {
    console.log("Home screen focused");
    // Refresh patients data when the screen is focused
    refreshPatientsData();
    
    // Add a listener for when the screen gains focus
    const unsubscribe = navigation.addListener('focus', () => {
      console.log("Home screen focused");
      refreshPatientsData();
    });
    
    return unsubscribe;
  }, [navigation, caregiver]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.header}>
        <View style={{flexDirection: "row", alignItems: "center"}}>
          <TouchableOpacity onPress={handleProfileImagePress}>
            <Image
              source={profileImageSource}
              style={styles.profileImage}
              defaultSource={defaultProfileImage}
              onError={() => {
                console.log("Error loading profile image thumbnail");
                setImageError(true);
              }}
            />
          </TouchableOpacity>
          <View style={{marginLeft: 15}}>
            <Text style={[styles.welcomeText, { fontSize: fontSize }]}>
              Welcome back,
            </Text>
            <Text style={[styles.headerTitle, { fontSize: fontSize + 6 }]}>
              {caregiver ? caregiver.name || "Caregiver" : "Caregiver"}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerButtons}>
          {/* Notification button with badge */}
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate("CaregiverNotifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="#2C3E50" />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Settings button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("CaregiverSettings")}
          >
            <Ionicons name="settings-outline" size={24} color="#2C3E50" />
          </TouchableOpacity>
        </View>
      </View>
        
        {/* Sync Status Indicator */}
        {activePatient && (
          <CaregiverSyncIndicator style={styles.syncIndicator} />
        )}
        
        {/* Active Patient Banner */}
        {activePatient && connectedPatients.some(patient => 
          normalizeEmail(patient.email) === normalizeEmail(activePatient.email)) ? (
          <View style={styles.activePatientBanner}>
            <View style={styles.activePatientContent}>
              <Image 
                source={getSafeImageSource(
                  activePatient?.profileImage || activePatient?.image,
                  require('../images/boy.png')
                )}
                style={styles.activePatientImage}
                defaultSource={require('../images/boy.png')}
                onError={() => {
                  console.log("Error loading active patient image");
                }}
              />
              <View style={styles.activePatientInfo}>
                <Text style={styles.activePatientLabel}>ACTIVE PATIENT</Text>
                <Text style={[styles.activePatientName, { fontSize }]}>
                  {activePatient.name || activePatient.email}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.manageButton}
              onPress={() => navigation.navigate("CaregiverPatients")}
            >
              <Text style={styles.manageButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.noActivePatientBanner}
            onPress={() => navigation.navigate("CaregiverPatients")}
          >
            <Ionicons name="person-add" size={24} color="#005BBB" />
            <Text style={[styles.noActivePatientText, { fontSize }]}>
              No active patient. Tap to select one.
            </Text>
          </TouchableOpacity>
        )}
      
        <View style={styles.featuresGrid}>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => navigation.navigate("CaregiverReminders")}
          >
            <Ionicons name="alarm" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Reminders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => navigation.navigate("CaregiverMemories")}
          >
            <Ionicons name="book" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Memories</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => navigation.navigate("CaregiverMap")}
          >
            <Ionicons name="location" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Safe Places</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureButton, { backgroundColor: "#005BBB" }]}
            onPress={() => navigation.navigate("CaregiverFamily")}
          >
            <MaterialCommunityIcons name="account-group" size={40} color="#fff" />
            <Text style={[styles.featureText, { fontSize }]}>Family</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.sectionTitle, { fontSize }]}>Today's Tasks</Text>
        <View style={styles.tasksContainer}>
          {displayedReminders.length > 0 ? (
            <>
              {displayedReminders.map((item) => (
                <View key={item.id} style={styles.taskItem}>
                  <View style={styles.taskTimeBox}>
                    <Text style={[styles.taskTime, { fontSize }]}>{item.time}</Text>
                  </View>
                  <Text style={[styles.taskText, { fontSize }]}>{item.title}</Text>
                  <TouchableOpacity onPress={() => confirmRemoveReminder(item.id, item.title)}>
                    <Ionicons name="square-outline" size={36} color="#005BBB" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyTaskContainer}>
              <Text style={styles.emptyTaskText}>No tasks scheduled for today</Text>
              <TouchableOpacity 
                style={styles.addTaskButton}
                onPress={() => navigation.navigate("CaregiverReminders")}
              >
                <Text style={styles.addTaskButtonText}>+ Add Reminder</Text>
              </TouchableOpacity>
            </View>
          )}
          {sortedReminders.length > 2 && (
            <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllContainer}>
              <Text style={[styles.seeAllText, { fontSize: fontSize - 2 }]}>See All</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={[styles.sectionTitle, { fontSize }]}>Daily Tip</Text>
        <View style={styles.tipContainer}>
          <Text style={[styles.tipText, { fontSize }]}>{dailyTip}</Text>
        </View>
        
        {/* Emergency Button */}
        <TouchableOpacity
          style={[styles.emergencyButton, { backgroundColor: "#D9534F" }]}
          onPress={() => navigation.navigate("CaregiverEmergencyCall")}
        >
          <Ionicons name="call-outline" size={30} color="#fff" />
          <Text style={[styles.emergencyButtonText, { fontSize }]}>EMERGENCY CONTACTS</Text>
        </TouchableOpacity>
        
      </ScrollView>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("CaregiverHome")}>
          <Ionicons name="home" size={30} color="#005BBB" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("CaregiverProfile")}>
          <Ionicons name="person" size={30} color="#005BBB" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("CaregiverPatients")}>
          <Ionicons name="people" size={30} color="#005BBB" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Patients</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("CaregiverSettings")}>
          <Ionicons name="settings" size={30} color="#005BBB" />
          <Text style={[styles.navText, { fontSize: fontSize - 2 }]}>Settings</Text>
        </TouchableOpacity>
      </View>
      
      {/* Profile Image Modal */}
      <Modal
        visible={profileImageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setProfileImageModalVisible(false)}
          >
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>
          
          <Image
            source={profileImageSource}
            style={styles.fullScreenImage}
            resizeMode="contain"
            defaultSource={defaultProfileImage}
            onError={() => {
              console.log('Error loading profile image in modal');
              setImageError(true);
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  syncIndicator: {
    alignSelf: 'center',
    marginBottom: 5,
  },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 20, 
    justifyContent: "space-between" 
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#005BBB",
  },
  headerText: { flex: 1 },
  greeting: { fontWeight: "bold", color: "#2C3E50" },
  date: { marginTop: 5, color: "#2C3E50" },
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  featureButton: { width: "48%", height: 110, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 15, elevation: 2 },
  featureText: { color: "#fff", fontWeight: "bold", marginTop: 5 },
  sectionTitle: { fontWeight: "bold", color: "#2C3E50", marginVertical: 10 },
  tasksContainer: { backgroundColor: "#fff", borderRadius: 10, padding: 15, elevation: 1 },
  taskItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E8EEF3" },
  taskTimeBox: { backgroundColor: "#E8EEF3", borderRadius: 6, padding: 8, marginRight: 10, width: 90, alignItems: "center" },
  taskTime: { fontSize: 16 },
  taskText: { flex: 1, fontSize: 16 },
  seeAllContainer: { marginTop: 10, alignItems: "center" },
  seeAllText: { color: "#005BBB" },
  tipContainer: { backgroundColor: "#fff", borderRadius: 10, padding: 15, elevation: 1, marginVertical: 10 },
  tipText: { fontSize: 16, color: "#2C3E50" },
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    marginBottom: 10,
  },
  emergencyButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 10,
  },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", padding: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ccc" },
  navButton: { alignItems: "center" },
  navText: { marginTop: 5, color: "#005BBB" },
  // New styles for patients section
  patientsContainer: { 
    backgroundColor: "#fff", 
    borderRadius: 10, 
    padding: 15, 
    elevation: 1,
    marginBottom: 20
  },
  patientItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EEF3"
  },
  activePatientItem: {
    backgroundColor: "#F0F8FF", // Light blue background for active patient
    borderRadius: 8,
    padding: 8,
    borderBottomWidth: 0,
    borderWidth: 2,
    borderColor: "#005BBB",
  },
  patientImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "#005BBB"
  },
  activePatientImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#005BBB',
  },
  patientInfo: {
    flex: 1
  },
  patientNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientName: {
    fontWeight: "bold",
    color: "#2C3E50"
  },
  patientEmail: {
    color: "#7F8C8D",
    marginTop: 5
  },
  activeIndicator: {
    backgroundColor: "#00AA00",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  activeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  noPatientText: {
    textAlign: "center",
    color: "#7F8C8D",
    padding: 10
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  manageLink: {
    color: "#005BBB",
    fontWeight: "bold",
  },
  activePatientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F4FF',
    borderRadius: 10,
    marginVertical: 10,
    padding: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#005BBB',
  },
  activePatientContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activePatientInfo: {
    flex: 1,
  },
  activePatientLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  activePatientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  manageButton: {
    backgroundColor: '#005BBB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noActivePatientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginVertical: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderStyle: 'dashed',
  },
  noActivePatientText: {
    marginLeft: 10,
    color: '#495057',
    fontSize: 14,
  },
  activePatientCard: {
    backgroundColor: "#F0F8FF",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#005BBB",
    marginBottom: 20,
    overflow: "hidden",
  },
  activePatientHeader: {
    backgroundColor: "#005BBB",
    padding: 8,
    alignItems: "center",
  },
  activeLabelText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginLeft: 5,
    fontSize: 14,
  },
  activePatientFooter: {
    backgroundColor: "#E8F4FF",
    padding: 10,
  },
  activePatientNote: {
    color: "#005BBB",
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  patientActionRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  patientActionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F4FF",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 15,
  },
  patientActionText: {
    color: "#005BBB",
    fontSize: 12,
    marginLeft: 4,
  },
  emptyTaskContainer: { 
    padding: 20, 
    alignItems: "center" 
  },
  emptyTaskText: { 
    color: "#7F8C8D", 
    marginBottom: 10 
  },
  addTaskButton: { 
    backgroundColor: "#E8F4FF", 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 20 
  },
  addTaskButtonText: { 
    color: "#005BBB", 
    fontWeight: "bold" 
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
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
  },
  fullScreenImage: {
    width: Dimensions.get("window").width * 0.9,
    height: Dimensions.get("window").height * 0.7,
  },
  completedTaskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EEF3",
  },
  completedTaskContent: {
    flex: 1,
    marginLeft: 10,
  },
  completedTaskText: {
    fontSize: 16,
    color: "#2C3E50",
  },
  patientCompletedBadge: {
    backgroundColor: "#E8F4FF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 5,
  },
  patientCompletedText: {
    fontSize: 12,
    color: "#005BBB",
  },
  completedTimeText: {
    fontSize: 12,
    color: "#7F8C8D",
    marginTop: 5,
  },
});
export default CaregiverHomeScreen;