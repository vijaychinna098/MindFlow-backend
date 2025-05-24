import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCaregiver } from "../../CaregiverContext";
import { useFontSize } from "./CaregiverFontSizeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from 'axios';

// Import API error handling functions
const { API_BASE_URL, handleApiError, checkServerConnectivity, getActiveServerUrl } = require('../../config');
import { syncCaregiverPatients } from '../../services/ServerSyncService';

// Function to safely handle API calls with proper error logging
const safeApiCall = async (apiFunction, fallbackValue = null, errorMessage = "API error") => {
  try {
    return await apiFunction();
  } catch (error) {
    console.log("Error suppressed:", errorMessage, error.message || error);
    return fallbackValue;
  }
};

// Create a separate PatientItem component to use hooks properly
const PatientItem = ({ item, activePatient, onSetActive, onDeactivate, onDelete, setSelectedImage, setImageModalVisible }) => {
  // Default image using require for proper asset reference
  const defaultImage = require('../images/boy.png');
  const [imageSource, setImageSource] = useState(defaultImage);
  const [displayName, setDisplayName] = useState(item.name || 'No name');
  const [imageLoadError, setImageLoadError] = useState(false);
  
  // Update name when item changes
  useEffect(() => {
    setDisplayName(item.name || 'No name');
  }, [item.name]);
  
  // Check if this patient is the active patient
  const isActive = activePatient && activePatient.id === item.id;
  
  // Reset error state when item changes
  useEffect(() => {
    setImageLoadError(false);
  }, [item.id, item.image, item.profileImage]);
  
  // Handle image loading
  useEffect(() => {
    try {
      // If already had a load error, use default image
      if (imageLoadError) {
        setImageSource(defaultImage);
        return;
      }
      
      if (item.image) {
        // Image is a URI string
        if (typeof item.image === 'string') {
          if (item.image.startsWith('http')) {
            console.log(`Loading URL image for ${item.name || item.email}: ${item.image}`);
            setImageSource({ uri: item.image });
          } else if (item.image.startsWith('file://') || item.image.startsWith('content://')) {
            console.log(`Loading file URI for ${item.name || item.email}: ${item.image}`);
            setImageSource({ uri: item.image });
          } else if (item.image.includes('boy.png') || item.image.includes('/images/')) {
            console.log(`Using default image for ${item.name || item.email}`);
            setImageSource(defaultImage);
          } else {
            // Add file:// prefix for local paths on Android
            if (Platform.OS === 'android' && !item.image.startsWith('file://') && 
                !item.image.startsWith('content://') && !item.image.startsWith('http')) {
              console.log(`Adding file:// prefix for Android: ${item.image}`);
              setImageSource({ uri: `file://${item.image}` });
            } else {
              // Try as URI anyway
              console.log(`Trying unknown format as URI: ${item.image}`);
              setImageSource({ uri: item.image });
            }
          }
        } 
        // Image is already a require() result (number)
        else if (typeof item.image === 'number') {
          console.log(`Using required image asset for ${item.name || item.email}`);
          setImageSource(item.image);
        }
        // Image is an object
        else if (typeof item.image === 'object' && item.image !== null) {
          // Check if it's an object with a uri property
          if (item.image.uri) {
            console.log(`Using object with URI property for ${item.name || item.email}`);
            // Add file:// prefix for local paths on Android
            if (Platform.OS === 'android' && typeof item.image.uri === 'string' && 
                !item.image.uri.startsWith('file://') && !item.image.uri.startsWith('content://') && 
                !item.image.uri.startsWith('http')) {
              setImageSource({ uri: `file://${item.image.uri}` });
            } else {
              setImageSource({ uri: item.image.uri });
            }
          } else {
            console.log(`Object image without URI property for ${item.name || item.email}, using default`);
            setImageSource(defaultImage);
          }
        } else {
          // Invalid image format, use default
          console.log(`Invalid image format for ${item.name || item.email}, using default`);
          setImageSource(defaultImage);
        }
      } 
      // Try profileImage if image is not available
      else if (item.profileImage) {
        if (typeof item.profileImage === 'string') {
          if (item.profileImage.startsWith('http')) {
            setImageSource({ uri: item.profileImage });
          } else if (item.profileImage.startsWith('file://') || item.profileImage.startsWith('content://')) {
            setImageSource({ uri: item.profileImage });
          } else {
            // Add file:// prefix for local paths on Android
            if (Platform.OS === 'android' && !item.profileImage.startsWith('file://') && 
                !item.profileImage.startsWith('content://') && !item.profileImage.startsWith('http')) {
              console.log(`Adding file:// prefix for Android profile image: ${item.profileImage}`);
              setImageSource({ uri: `file://${item.profileImage}` });
            } else {
              setImageSource({ uri: item.profileImage });
            }
          }
        } else if (typeof item.profileImage === 'number') {
          setImageSource(item.profileImage);
        } else if (typeof item.profileImage === 'object' && item.profileImage !== null) {
          if (item.profileImage.uri) {
            // Add file:// prefix for local paths on Android
            if (Platform.OS === 'android' && typeof item.profileImage.uri === 'string' && 
                !item.profileImage.uri.startsWith('file://') && !item.profileImage.uri.startsWith('content://') && 
                !item.profileImage.uri.startsWith('http')) {
              setImageSource({ uri: `file://${item.profileImage.uri}` });
            } else {
              setImageSource({ uri: item.profileImage.uri });
            }
          } else {
            setImageSource(defaultImage);
          }
        } else {
          // Invalid profile image format, use default
          setImageSource(defaultImage);
        }
      } else {
        // No image, use default
        setImageSource(defaultImage);
      }
    } catch (error) {
      console.log(`Error processing image for ${item.name || item.email}:`, error.message);
      setImageSource(defaultImage);
      setImageLoadError(true);
    }
  }, [item.image, item.profileImage, item.email, imageLoadError]);

  return (
    <View style={[
      styles.patientItem,
      isActive && styles.activePatientItem
    ]}>
      <TouchableOpacity 
        style={styles.patientImageContainer}
        onPress={() => {
          console.log("Opening image in full screen:", typeof imageSource, JSON.stringify(imageSource));
          // Store the image source, fallback, and patient name for the modal
          setSelectedImage({
            source: imageSource || defaultImage, // Ensure source is never null
            fallback: defaultImage,
            patientName: displayName
          });
          setImageModalVisible(true);
        }}
      >
        <Image 
          source={imageSource || defaultImage} // Ensure source is never null
          style={[
            styles.patientImage,
            isActive && styles.activePatientImage
          ]}
          defaultSource={defaultImage}
          onError={(e) => {
            console.log(`Image loading error for ${item.name || item.email}:`, e.nativeEvent?.error || 'Unknown error');
            // If image fails to load, fallback to default
            setImageSource(defaultImage);
            setImageLoadError(true);
          }}
        />
        {isActive && (
          <View style={styles.activeIndicator}>
            <Ionicons name="checkmark-circle" size={24} color="#005BBB" />
          </View>
        )}
      </TouchableOpacity>
      
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{displayName}</Text>
        <Text style={styles.patientEmail}>{item.email}</Text>
        {item.phone && (
          <Text style={styles.patientPhone}>
            <Ionicons name="call-outline" size={14} /> {item.phone}
          </Text>
        )}
      </View>
      
      <View style={styles.actionsContainer}>
        {isActive ? (
          <View style={styles.activeStatusContainer}>
            <Text style={styles.activeText}>ACTIVE</Text>
            <TouchableOpacity 
              style={styles.deactivateButton}
              onPress={onDeactivate}
            >
              <Text style={styles.deactivateText}>Deactivate</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.setActiveButton}
            onPress={() => onSetActive(item)}
          >
            <Text style={styles.setActiveText}>Set as Active</Text>
          </TouchableOpacity>
        )}
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => onDelete(item)}
          >
            <Ionicons name="trash-outline" size={20} color="#D9534F" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const CaregiverPatientsScreen = () => {
  const navigation = useNavigation();
  const { caregiver, activePatient, setActivePatient, clearActivePatient } = useCaregiver();
  const { fontSize } = useFontSize();
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newPatientEmail, setNewPatientEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [verificationErrorShown, setVerificationErrorShown] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  const patientsKey = caregiver ? `connectedPatients_${caregiver.email}` : 'connectedPatients';

  useEffect(() => {
    // Check server connectivity
    const verifyServerConnectivity = async () => {
      console.log("Starting server connectivity check...");
      
      // Try multiple times to connect to the server before showing error
      let connectionSuccess = false;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Server connection attempt ${attempt}/${maxRetries}...`);
        
        try {
          // First try a direct ping to the main URL
          const serverUrl = getActiveServerUrl();
          try {
            console.log(`Trying direct ping to ${serverUrl}/ping`);
            const pingResponse = await axios.get(`${serverUrl}/ping`, { timeout: 3000 });
            if (pingResponse.status === 200) {
              console.log("✅ Server connection successful via direct ping");
              connectionSuccess = true;
              break;
            }
          } catch (directPingError) {
            console.log(`Direct ping failed: ${directPingError.message}`);
            // Continue to try the comprehensive check
          }
          
          // If direct ping failed, try the comprehensive check
          const connectionStatus = await safeApiCall(
            () => checkServerConnectivity(),
            { connected: false, message: "Server connection attempt failed" },
            "Server connectivity check failed:"
          );
          
          if (connectionStatus.connected) {
            console.log("✅ Server connection successful:", connectionStatus.message);
            connectionSuccess = true;
            break;
          }
          
          console.log("❌ Server connection failed:", connectionStatus.message);
          
          // Wait before retrying (with increasing delays)
          if (attempt < maxRetries) {
            const delay = attempt * 1000; // 1s, 2s, 3s...
            console.log(`Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.log(`Server connection check error (attempt ${attempt}):`, error.message);
          // Continue to next retry
        }
      }
      
      // Only show alert if all retries failed and we haven't shown it before
      if (!connectionSuccess && !verificationErrorShown) {
        console.log("All server connection attempts failed, showing notification");
        setVerificationErrorShown(true);
        
        Alert.alert(
          "Server Connection Issue",
          "Unable to connect to the server. Patient management will work with limited functionality. Check your internet connection or try again later.",
          [
            { 
              text: "Retry", 
              onPress: () => {
                setVerificationErrorShown(false);
                verifyServerConnectivity(); // Try again
              }
            },
            { text: "Continue Offline", style: "cancel" }
          ]
        );
      } else if (connectionSuccess) {
        // If connection was successful, reset error flag
        setVerificationErrorShown(false);
      }
    };

    verifyServerConnectivity();
    loadUsers();
    loadPatients();
  }, []);

  // Verify all patients exist when screen loads
  useEffect(() => {
    const verifyAllPatients = async () => {
      if (!patients.length) return;
      
      // Skip verification if we're already in offline mode
      if (verificationErrorShown) {
        console.log("Skipping patient verification - known server connectivity issue");
        return;
      }
      
      try {
        console.log("Verifying all patient connections exist in database...");
        
        // First check if we can reach the server
        let serverAvailable = false;
        try {
          const serverUrl = getActiveServerUrl();
          console.log(`Testing server availability at ${serverUrl}/ping`);
          const pingResponse = await axios.get(`${serverUrl}/ping`, { timeout: 3000 });
          serverAvailable = pingResponse.status === 200;
          console.log(`Server availability check: ${serverAvailable ? 'ONLINE' : 'OFFLINE'}`);
        } catch (pingError) {
          console.log(`Server availability check failed: ${pingError.message}`);
        }
        
        // If server is unreachable, skip verification but don't show another alert
        if (!serverAvailable) {
          console.log("Server unreachable - skipping patient verification");
          
          // Only show alert if we haven't shown one before
          if (!verificationErrorShown) {
            setVerificationErrorShown(true);
            Alert.alert(
              "Offline Mode",
              "Server is unreachable. Patient management will work with limited functionality.",
              [{ text: "OK" }]
            );
          }
          return;
        }
        
        // Track which patients need to be removed
        const patientsToRemove = [];
        let verificationErrors = 0;
        
        // Try to verify each patient
        const patientVerificationPromises = patients.map(async (patient) => {
          if (!patient.email) {
            console.log(`Patient ${patient.id} has no email, skipping verification`);
            return;
          }
          
          const normalizedEmail = normalizeEmail(patient.email);
          
          try {
            console.log(`Verifying patient exists: ${normalizedEmail}`);
            const verifyUrl = `${getActiveServerUrl()}/api/caregivers/check-patient/${normalizedEmail}`;
            console.log(`Checking URL: ${verifyUrl}`);
            
            const response = await axios.get(verifyUrl, { timeout: 5000 });
            
            if (response.data && response.data.exists === false) {
              console.log(`Patient ${normalizedEmail} does not exist - marking for removal`);
              patientsToRemove.push(patient.id);
            } else {
              console.log(`Verified patient ${normalizedEmail} exists`);
            }
          } catch (error) {
            console.error(`Error verifying patient ${normalizedEmail}:`, error.message);
            verificationErrors++;
          }
        });
        
        // Wait for all verification attempts to complete
        await Promise.all(patientVerificationPromises);
        
        // Show connectivity warning if we had errors but haven't shown one yet
        if (verificationErrors > 0 && !verificationErrorShown) {
          setVerificationErrorShown(true);
          Alert.alert(
            "Partial Connection Issues",
            "Could not verify some patients due to connection issues. Results may be incomplete.",
            [{ text: "OK" }]
          );
        }
        
        // If we found patients to remove, update the list
        if (patientsToRemove.length > 0) {
          console.log(`Removing ${patientsToRemove.length} deleted patients from list`);
          const updatedPatients = patients.filter(p => !patientsToRemove.includes(p.id));
          setPatients(updatedPatients);
          await savePatients(updatedPatients);
          
          if (activePatient && patientsToRemove.includes(activePatient.id)) {
            // Clear active patient if it was removed
            clearActivePatient();
            console.log("Active patient was removed - cleared selection");
          }
          
          // Notify user
          Alert.alert(
            "Patients Removed",
            `${patientsToRemove.length} patient(s) with deleted accounts have been removed from your list.`
          );
        } else {
          console.log("All patients verified successfully");
        }
      } catch (error) {
        console.error("Error in overall verification process:", error.message);
        
        // Show error only if we haven't shown one yet
        if (!verificationErrorShown) {
          setVerificationErrorShown(true);
          Alert.alert(
            "Verification Error",
            "There was a problem verifying your patients. Some features may be limited.",
            [{ text: "OK" }]
          );
        }
      }
    };
    
    // Add a short delay to let the connectivity check complete first
    const timer = setTimeout(() => {
      verifyAllPatients();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [patients, activePatient, verificationErrorShown]);

  // Load user database (simulated with AsyncStorage)
  const loadUsers = async () => {
    try {
      // In a real app, this would be a database query
      const storedUsers = await AsyncStorage.getItem('users');
      let loadedUsers = [];
      
      if (storedUsers) {
        loadedUsers = JSON.parse(storedUsers);
        setUsers(loadedUsers);
        console.log(`Loaded ${loadedUsers.length} existing users from database`);
        console.log("USER DATABASE:");
        loadedUsers.forEach(user => {
          console.log(`User: ${user.name}, Email: ${user.email.toLowerCase()}`);
        });
      } else {
        // Mock user database for demonstration
        const mockUsers = [
          { id: 'u1', name: 'John Smith', email: 'john@example.com', profileImage: 'https://via.placeholder.com/60' },
          { id: 'u2', name: 'Mary Johnson', email: 'mary@example.com', profileImage: 'https://via.placeholder.com/60' },
          { id: 'u3', name: 'Robert Williams', email: 'robert@example.com', profileImage: 'https://via.placeholder.com/60' },
          { id: 'u4', name: 'Emma Brown', email: 'emma@example.com', profileImage: 'https://via.placeholder.com/60' },
          { id: 'u5', name: 'David Miller', email: 'david@example.com', profileImage: 'https://via.placeholder.com/60' },
          { id: 'u6', name: 'Sarah Jones', email: 'sarah@example.com', profileImage: 'https://via.placeholder.com/60' },
          { id: 'u7', name: 'Michael Wilson', email: 'michael@example.com', profileImage: 'https://via.placeholder.com/60' },
          { id: 'u8', name: 'Jennifer Garcia', email: 'jennifer@example.com', profileImage: 'https://via.placeholder.com/60' },
          // Add your test emails here for development
        ];
        setUsers(mockUsers);
        await AsyncStorage.setItem('users', JSON.stringify(mockUsers));
        console.log("Created initial user database with", mockUsers.length, "users");
        console.log("USER DATABASE:");
        mockUsers.forEach(user => {
          console.log(`User: ${user.name}, Email: ${user.email.toLowerCase()}`);
        });
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const loadPatients = async () => {
    try {
      setIsLoading(true);
      
      if (!caregiver || !caregiver.email || !caregiver.id) {
        console.log("No caregiver data available for loading patients");
        setPatients([]);
        setIsLoading(false);
        return;
      }
      
      console.log(`Loading patients for caregiver: ${caregiver.email}`);
      
      // Try to load patients from the server first (which handles offline fallback internally)
      const result = await syncCaregiverPatients(caregiver.email, caregiver.id);
      
      if (result.success) {
        const patientsList = result.patients || [];
        
        console.log(`Loaded ${patientsList.length} patients from ${result.source}`);
        console.log(`Server sync message: ${result.message}`);
        
        // Process each patient to ensure proper display data
        const processedPatients = await Promise.all(patientsList.map(async (patient) => {
          try {
            // If the patient doesn't have a name or profile image, attempt to populate it from user database
            if (!patient.name || !patient.profileImage) {
              console.log(`Enhancing patient data for ${patient.email}`);
              const enhancedData = await findPatientInUserDatabase(patient.email);
              
              if (enhancedData) {
                return {
                  ...patient,
                  name: patient.name || enhancedData.name,
                  profileImage: patient.profileImage || enhancedData.profileImage,
                  image: patient.image || enhancedData.profileImage
                };
              }
            }
            return patient;
          } catch (error) {
            console.log(`Error enhancing patient ${patient.email}: ${error.message}`);
            return patient;
          }
        }));
        
        setPatients(processedPatients);
        
        // Save the processed patients back to local storage
        await savePatients(processedPatients);
        
        console.log("LOADED PATIENTS:");
        processedPatients.forEach(patient => {
          console.log(`Patient: ${patient.name || 'No name'}, Email: ${patient.email.toLowerCase()}`);
        });
      } else {
        // If server sync failed completely, try local storage as a last resort
        console.log(`Server sync failed: ${result.message}`);
        const storedPatients = await AsyncStorage.getItem(patientsKey);
        
        if (storedPatients) {
          const loadedPatients = JSON.parse(storedPatients);
          setPatients(loadedPatients);
          console.log("LOADED PATIENTS FROM LOCAL STORAGE (FALLBACK):");
          loadedPatients.forEach(patient => {
            console.log(`Patient: ${patient.name || 'No name'}, Email: ${patient.email.toLowerCase()}`);
          });
        } else {
          console.log("No stored patients found locally");
          setPatients([]);
        }
      }
    } catch (error) {
      console.error("Failed to load patients:", error);
      Alert.alert("Error", "Failed to load patients");
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const savePatients = async (updatedPatients) => {
    try {
      await AsyncStorage.setItem(patientsKey, JSON.stringify(updatedPatients));
    } catch (error) {
      console.error("Failed to save patients:", error);
    }
  };

  // Get strict normalized email for comparison
  const normalizeEmail = (email) => {
    if (!email) return '';
    return email.toLowerCase().trim();
  };

  // Process and validate image source to ensure it's safe to use
  const validateAndProcessImageSource = (imageSource) => {
    try {
      // Default image using require for proper asset reference
      const defaultImage = require('../images/boy.png');
      
      // Handle null or undefined image
      if (!imageSource) {
        return defaultImage;
      }
      
      // Handle string type images (URIs)
      if (typeof imageSource === 'string') {
        if (imageSource.startsWith('http')) {
          return { uri: imageSource };
        } else if (imageSource.startsWith('file://') || imageSource.startsWith('content://')) {
          return { uri: imageSource };
        } else if (imageSource.includes('boy.png') || imageSource.includes('/images/')) {
          return defaultImage;
        } else {
          // Add file:// prefix for local paths on Android
          if (Platform.OS === 'android' && !imageSource.startsWith('file://') && 
              !imageSource.startsWith('content://') && !imageSource.startsWith('http')) {
            return { uri: `file://${imageSource}` };
          } else {
            return { uri: imageSource };
          }
        }
      }
      
      // Handle number type (require result)
      if (typeof imageSource === 'number') {
        return imageSource;
      }
      
      // Handle object type
      if (typeof imageSource === 'object' && imageSource !== null) {
        if (imageSource.uri) {
          const uri = imageSource.uri;
          if (typeof uri === 'string') {
            // Add file:// prefix for local paths on Android
            if (Platform.OS === 'android' && !uri.startsWith('file://') && 
                !uri.startsWith('content://') && !uri.startsWith('http')) {
              return { uri: `file://${uri}` };
            } else {
              return { uri: uri };
            }
          }
        }
      }
      
      // If none of the above conditions were met, return default
      return defaultImage;
    } catch (error) {
      console.log('Error validating image source:', error.message);
      return require('../images/boy.png');
    }
  };

  // Get patient info from user database (not caregiver database)
  const findPatientInUserDatabase = async (email) => {
    try {
      console.log("==== SEARCHING USER DATABASE FOR PATIENT ====");
      const normalizedEmail = normalizeEmail(email);
      console.log(`Looking for patient with email: '${normalizedEmail}'`);
      
      // Default profile image - use require directly for local resources
      const defaultImage = require('../images/boy.png');
      
      // First check if this patient has set their own profile name directly
      try {
        const formattedProfileKey = `formattedProfile_${normalizedEmail}`;
        const formattedProfile = await AsyncStorage.getItem(formattedProfileKey);
        
        if (formattedProfile) {
          try {
            const parsedProfile = JSON.parse(formattedProfile);
            if (parsedProfile && parsedProfile.name) {
              console.log(`Found user's directly set profile name: ${parsedProfile.name}`);
              
              // This is the most authoritative source - user set their own name
              const userRecord = {
                id: parsedProfile.id || `user-${Date.now()}`,
                name: parsedProfile.name,
                email: normalizedEmail,
                profileImage: parsedProfile.profileImage || defaultImage
              };
              
              // Ensure this data is stored in all locations
              try {
                const profileData = JSON.stringify(userRecord);
                await AsyncStorage.setItem(`userData_${normalizedEmail}`, profileData);
                await AsyncStorage.setItem(`directPatientData_${normalizedEmail}`, profileData);
                await AsyncStorage.setItem(`syncedUserData_${normalizedEmail}`, profileData);
                console.log(`Propagated user's own profile data to all storage locations`);
              } catch (saveError) {
                console.log(`Error saving user's profile data:`, saveError.message);
              }
              
              return userRecord;
            }
          } catch (parseError) {
            console.log(`Error parsing formatted profile: ${parseError.message}`);
          }
        }
      } catch (formatError) {
        console.log(`Error checking formatted profile: ${formatError.message}`);
      }
      
      // PRIORITY 1: Try to get data from the server first for real-time sync
      try {
        const serverUrl = getActiveServerUrl();
        console.log(`Attempting to fetch user data from server for ${normalizedEmail}`);
        
        // Set a longer timeout for server requests
        const axiosConfig = { timeout: 10000 };
        
        // Try the main profile endpoint first (new dedicated email lookup endpoint)
        let serverResponse = null;
        try {
          console.log(`Trying dedicated profile lookup endpoint for ${normalizedEmail}`);
          const response = await axios.get(`${serverUrl}/api/users/profile/${normalizedEmail}`, axiosConfig);
          if (response.data && response.data.name) {
            serverResponse = response;
            console.log(`SUCCESS: Got user data from server for ${normalizedEmail}: ${response.data.name}`);
          }
        } catch (mainError) {
          console.log(`Profile endpoint failed: ${mainError.message}`);
          
          // If 404, try the combined lookup endpoint
          if (mainError.response && mainError.response.status === 404) {
            try {
              console.log(`Trying combined lookup endpoint for ${normalizedEmail}`);
              const altResponse = await axios.get(`${serverUrl}/api/users/lookup/${normalizedEmail}`, axiosConfig);
              if (altResponse.data && altResponse.data.name) {
                serverResponse = altResponse;
                console.log(`SUCCESS: Found user with alternative endpoint: ${altResponse.data.name}`);
              }
            } catch (altError) {
              console.log(`Alternative lookup endpoint also failed: ${altError.message}`);
              
              // Try caregivers endpoint as well for cross-referenced accounts
              try {
                console.log(`Trying caregivers endpoint for ${normalizedEmail}`);
                const caregiverResponse = await axios.get(`${serverUrl}/api/caregivers/lookup/${normalizedEmail}`, axiosConfig);
                if (caregiverResponse.data && caregiverResponse.data.name) {
                  serverResponse = caregiverResponse;
                  console.log(`SUCCESS: Found user in caregivers collection: ${caregiverResponse.data.name}`);
                }
              } catch (caregiverError) {
                console.log(`Caregiver lookup failed: ${caregiverError.message}`);
              }
              
              // If all lookups fail, try to create a minimal user profile
              if (!serverResponse) {
                try {
                  console.log(`User not found, attempting to create minimal profile for ${normalizedEmail}`);
                  // Get proper name from all available sources
                  const patientName = await getPatientNameFromAllSources(normalizedEmail);
                  // Create a minimal profile with proper name
                  const minimalProfile = {
                    name: patientName,
                    email: normalizedEmail,
                    id: `user-${Date.now()}`
                  };
                  
                  const createResponse = await axios.post(`${serverUrl}/api/users/register/profile`, {
                    ...minimalProfile,
                    forceCreate: true
                  }, axiosConfig);
                  
                  if (createResponse.data && createResponse.data.success) {
                    console.log(`Successfully created minimal profile for ${normalizedEmail}`);
                    // After creation, try to get the profile again
                    try {
                      const verifyResponse = await axios.get(`${serverUrl}/api/users/profile/${normalizedEmail}`, axiosConfig);
                      if (verifyResponse.data && verifyResponse.data.name) {
                        serverResponse = verifyResponse;
                        console.log(`SUCCESS: Verified created profile ${verifyResponse.data.name}`);
                      }
                    } catch (verifyError) {
                      console.log(`Could not verify created profile: ${verifyError.message}`);
                    }
                  }
                } catch (createError) {
                  console.log(`Profile creation failed: ${createError.message}`);
                }
              }
            }
          }
        }
        
        // Process successful server response
        if (serverResponse && serverResponse.data) {
          const userData = serverResponse.data;
          
          // Store this data in all possible locations for future access
          try {
            // Validate and process the profile image
            const processedImage = userData.profileImage ? 
              validateAndProcessImageSource(userData.profileImage) : 
              defaultImage;
            
            // Create a properly formatted user record
            const userRecord = {
              id: userData.id || userData._id || `user-${Date.now()}`,
              name: userData.name,
              email: normalizedEmail,
              profileImage: processedImage,
              phone: userData.phone
            };
            
            console.log(`Building user record from server data: ${userRecord.name} (${userRecord.email})`);
            
            // Store in regular userData
            const userDataKey = `userData_${normalizedEmail}`;
            await AsyncStorage.setItem(userDataKey, JSON.stringify({
              ...userData,
              profileImage: processedImage
            }));
            
            // Also store in direct patient data for cross-device access
            const directPatientKey = `directPatientData_${normalizedEmail}`;
            await AsyncStorage.setItem(directPatientKey, JSON.stringify({
              ...userData,
              profileImage: processedImage
            }));
            
            // Also store in synced user data
            const syncedUserDataKey = `syncedUserData_${normalizedEmail}`;
            await AsyncStorage.setItem(syncedUserDataKey, JSON.stringify({
              ...userData,
              profileImage: processedImage
            }));
            
            console.log(`Saved server user data locally for ${normalizedEmail} in all locations`);
            return userRecord;
          } catch (storageError) {
            console.log("Error saving server data locally:", storageError.message);
          }
        } else {
          console.log("No valid data returned from server or response was empty");
        }
      } catch (serverError) {
        console.log("Could not fetch user data from server:", serverError.message);
        console.log("Falling back to direct synchronization data");
      }
      
      // PRIORITY 2: Check for direct patient data storage
      // This is a specialized key format used for cross-device sync
      const directPatientKey = `directPatientData_${normalizedEmail}`;
      try {
        const directData = await AsyncStorage.getItem(directPatientKey);
        if (directData) {
          try {
            const parsedData = JSON.parse(directData);
            console.log(`FOUND DIRECT PATIENT DATA FOR: ${parsedData.name}`);
            return {
              id: parsedData.id || `user-${Date.now()}`,
              name: parsedData.name,
              email: normalizedEmail,
              profileImage: parsedData.profileImage || defaultImage
            };
          } catch (parseError) {
            console.log(`Error parsing direct patient data: ${parseError.message}`);
            // If JSON is corrupt, remove it
            await AsyncStorage.removeItem(directPatientKey);
          }
        }
      } catch (error) {
        console.log("Error reading direct patient data:", error.message);
      }
      
      // PRIORITY 3: Check for synchronized user data via special keys
      try {
        const syncedUserDataKey = `syncedUserData_${normalizedEmail}`;
        const syncedData = await AsyncStorage.getItem(syncedUserDataKey);
        
        if (syncedData) {
          try {
            const parsedData = JSON.parse(syncedData);
            console.log(`FOUND SYNCED USER DATA FOR: ${parsedData.name}`);
            
            return {
              id: parsedData.id || `user-${Date.now()}`,
              name: parsedData.name,
              email: normalizedEmail,
              profileImage: parsedData.profileImage || defaultImage
            };
          } catch (parseError) {
            console.log(`Error parsing synced user data: ${parseError.message}`);
            // If JSON is corrupt, remove it
            await AsyncStorage.removeItem(syncedUserDataKey);
          }
        }
      } catch (error) {
        console.log("Error reading synced user data:", error.message);
      }
      
      // PRIORITY 4: Email-specific userData
      const userDataKey = `userData_${normalizedEmail}`;
      try {
        const userData = await AsyncStorage.getItem(userDataKey);
        
        if (userData) {
          try {
            const parsedUserData = JSON.parse(userData);
            if (parsedUserData && parsedUserData.name) {
              console.log(`FOUND USER PROFILE DATA FOR: ${parsedUserData.name}`);
              
              // Also save to direct patient data for future cross-device access
              await AsyncStorage.setItem(directPatientKey, userData);
              
              const userRecord = {
                id: parsedUserData.id || `user-${Date.now()}`,
                name: parsedUserData.name,
                email: normalizedEmail,
                profileImage: parsedUserData.profileImage || defaultImage
              };
              
              console.log(`User profile data: name=${userRecord.name}, has image=${!!parsedUserData.profileImage}`);
              return userRecord;
            }
          } catch (parseError) {
            console.error("Error parsing user data:", parseError);
            // If JSON is corrupt, remove it
            await AsyncStorage.removeItem(userDataKey);
          }
        } else {
          console.log(`No userData_${normalizedEmail} record found, continuing search...`);
        }
      } catch (error) {
        console.log(`Error accessing userData_${normalizedEmail}:`, error.message);
      }
      
      // PRIORITY 5: Search all AsyncStorage keys for this patient's email
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        console.log(`Searching all ${allKeys.length} AsyncStorage keys for ${normalizedEmail}`);
        
        // Look for any key containing the patient's email
        const patientKeys = allKeys.filter(key => key.includes(normalizedEmail));
        console.log(`Found ${patientKeys.length} keys containing the patient email`);
        
        // Check each key for name and profile data
        for (const key of patientKeys) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (!data) continue;
            
            try {
              const parsedData = JSON.parse(data);
              if (parsedData && parsedData.name) {
                console.log(`Found patient data in key: ${key}`);
                
                // Save this data to direct patient data for future use
                await AsyncStorage.setItem(directPatientKey, data);
                
                return {
                  id: parsedData.id || `user-${Date.now()}`,
                  name: parsedData.name,
                  email: normalizedEmail,
                  profileImage: parsedData.profileImage || defaultImage
                };
              }
            } catch (parseError) {
              console.log(`Error parsing data from key ${key}:`, parseError.message);
              // If the data is corrupt, remove it
              if (parseError.message.includes('JSON Parse error')) {
                await AsyncStorage.removeItem(key);
                console.log(`Removed corrupt data from key: ${key}`);
              }
            }
          } catch (error) {
            console.log(`Error reading key ${key}:`, error.message);
          }
        }
      } catch (error) {
        console.log("Error searching AsyncStorage keys:", error.message);
      }
      
      // PRIORITY 6: Create a minimal profile when nothing else is found
      console.log(`No user data found. Creating default identity for ${normalizedEmail}`);
      
      // Extract a name from the email address
      let generatedName = "Patient";
      try {
        // Try to get name from server or any storage, already attempted above
        // but we'll make one more attempt with dedicated user profile keys
        const userProfileKey = `userProfile_${normalizedEmail}`;
        const profileData = await AsyncStorage.getItem(userProfileKey);
        if (profileData) {
          try {
            const profile = JSON.parse(profileData);
            if (profile && profile.name) {
              generatedName = profile.name;
              console.log(`Found name in user profile: ${generatedName}`);
            }
          } catch (profileError) {
            console.log(`Error parsing user profile: ${profileError.message}`);
          }
        }
      } catch (nameError) {
        console.log("Error getting user profile:", nameError.message);
      }
      
      // Create and save a minimal profile
      const minimalProfile = {
        id: `user-${Date.now()}`,
        name: generatedName,
        email: normalizedEmail,
        profileImage: defaultImage,
        createdAt: new Date().toISOString()
      };
      
      // Save this minimal profile to all storage locations
      try {
        await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(minimalProfile));
        await AsyncStorage.setItem(`directPatientData_${normalizedEmail}`, JSON.stringify(minimalProfile));
        await AsyncStorage.setItem(`syncedUserData_${normalizedEmail}`, JSON.stringify(minimalProfile));
        console.log(`Created and saved minimal profile for ${normalizedEmail}`);
        
        // Also try to save this to the server for cross-device access
        try {
          const serverUrl = getActiveServerUrl();
          console.log(`Sending minimal profile to server for ${normalizedEmail}`);
          
          axios.post(`${serverUrl}/api/users/register/profile`, {
            ...minimalProfile,
            forceCreate: true
          }).then(response => {
            console.log(`Server registration successful for ${normalizedEmail}`);
          }).catch(error => {
            console.log(`Server registration failed for ${normalizedEmail}:`, error.message);
          });
        } catch (serverError) {
          console.log("Could not send minimal profile to server:", serverError.message);
        }
      } catch (storageError) {
        console.log("Error saving minimal profile:", storageError.message);
      }
      
      return minimalProfile;
    } catch (error) {
      console.error("Error finding patient in user database:", error);
      
      // Return a minimal record rather than null to avoid errors
      const fallbackRecord = {
        id: `user-${Date.now()}`,
        name: `Patient`, 
        email: normalizeEmail(email),
        profileImage: require('../images/boy.png')
      };
      
      try {
        // Save this fallback record to prevent future errors
        await AsyncStorage.setItem(`directPatientData_${normalizeEmail(email)}`, JSON.stringify(fallbackRecord));
      } catch (saveError) {
        console.log("Error saving fallback record:", saveError.message);
      }
      
      return fallbackRecord;
    }
  };

  // Update patient display names and images with the most current data
  const refreshPatientNames = async () => {
    try {
      console.log("==== REFRESHING PATIENT NAMES AND PROFILE IMAGES ====");
      
      const updatedPatients = [...patients];
      let needsUpdate = false;
      
      // Process each patient one by one
      for (const patient of updatedPatients) {
        const patientEmail = normalizeEmail(patient.email);
        console.log(`Refreshing data for patient: ${patientEmail}`);
        
        // First synchronize profiles to ensure we have consistent data
        const syncedProfile = await synchronizeProfileData(patientEmail);
        
        if (syncedProfile) {
          console.log(`Using synchronized profile for ${patientEmail}: ${syncedProfile.name}`);
          
          // Check if we need to update the patient name
          if (patient.name !== syncedProfile.name) {
            console.log(`Updating patient name: ${patient.name || 'undefined'} → ${syncedProfile.name}`);
            patient.name = syncedProfile.name;
            needsUpdate = true;
          }
          
          // Check if we need to update the profile image
          if (syncedProfile.profileImage) {
            const processedImage = validateAndProcessImageSource(syncedProfile.profileImage);
            
            // Only update if necessary
            if (JSON.stringify(patient.image) !== JSON.stringify(processedImage)) {
              console.log(`Updating profile image for ${patientEmail}`);
              patient.image = processedImage;
              patient.profileImage = processedImage;
              needsUpdate = true;
            }
          }
          
          continue; // Skip server and local checks since we already synchronized the profile
        }
        
        // Fallback to server and local checks if synchronization failed
        // Check server connectivity first - we'll try online update if available
        let serverConnected = false;
        try {
          const serverUrl = getActiveServerUrl();
          const pingResponse = await safeApiCall(
            () => axios.get(`${serverUrl}/api/ping`, { timeout: 3000 }),
            { data: { success: false } },
            "Error pinging server"
          );
          serverConnected = pingResponse && pingResponse.data && pingResponse.data.success === true;
          console.log(`Server connection check: ${serverConnected ? 'ONLINE' : 'OFFLINE'}`);
        } catch (pingError) {
          console.log("Server ping failed:", pingError.message);
          serverConnected = false;
        }
        
        // Look for patient data in all possible locations (if server update failed or we're offline)
        let refreshedData = null;
        
        // PRIORITY 1: Check direct patient data first (most likely to be up-to-date)
        try {
          const directPatientKey = `directPatientData_${patientEmail}`;
          const directData = await AsyncStorage.getItem(directPatientKey);
          if (directData) {
            try {
              const parsedData = JSON.parse(directData);
              if (parsedData && parsedData.name) {
                console.log(`Found direct patient data for ${patientEmail}: ${parsedData.name}`);
                refreshedData = parsedData;
              }
            } catch (parseError) {
              console.log(`Error parsing directPatientData: ${parseError.message}`);
              await AsyncStorage.removeItem(directPatientKey);
            }
          }
        } catch (directError) {
          console.log(`Error accessing directPatientData: ${directError.message}`);
        }
        
        // PRIORITY 2: Check synced user data
        if (!refreshedData) {
          try {
            const syncedUserDataKey = `syncedUserData_${patientEmail}`;
            const syncedData = await AsyncStorage.getItem(syncedUserDataKey);
            if (syncedData) {
              try {
                const parsedData = JSON.parse(syncedData);
                if (parsedData && parsedData.name) {
                  console.log(`Found synced user data for ${patientEmail}: ${parsedData.name}`);
                  refreshedData = parsedData;
                }
              } catch (parseError) {
                console.log(`Error parsing syncedUserData: ${parseError.message}`);
                await AsyncStorage.removeItem(syncedUserDataKey);
              }
            }
          } catch (syncedError) {
            console.log(`Error accessing syncedUserData: ${syncedError.message}`);
          }
        }
        
        // PRIORITY 3: Check userData_ key
        if (!refreshedData) {
          try {
            const userDataKey = `userData_${patientEmail}`;
            const userData = await AsyncStorage.getItem(userDataKey);
            if (userData) {
              try {
                const parsedData = JSON.parse(userData);
                if (parsedData && parsedData.name) {
                  console.log(`Found userData for ${patientEmail}: ${parsedData.name}`);
                  refreshedData = parsedData;
                }
              } catch (parseError) {
                console.log(`Error parsing userData: ${parseError.message}`);
                await AsyncStorage.removeItem(userDataKey);
              }
            }
          } catch (userDataError) {
            console.log(`Error accessing userData: ${userDataError.message}`);
          }
        }
        
        // Update patient data if we found refreshed data
        if (refreshedData) {
          let needToUpdate = false;
          
          // Update name if needed and available
          if (refreshedData.name && (!patient.name || patient.name !== refreshedData.name)) {
            console.log(`Updating patient name: ${patient.name || 'undefined'} → ${refreshedData.name}`);
            patient.name = refreshedData.name;
            needToUpdate = true;
          }
          
          // Get profile image from various sources and process it
          const profileImageSource = refreshedData.profileImage || refreshedData.image;
          
          if (profileImageSource) {
            // Use validateAndProcessImageSource to get a safe image source
            const processedImageSource = validateAndProcessImageSource(profileImageSource);
            
            // Only update if we need to (comparing the sources is tricky, so we log what's happening)
            const oldSource = JSON.stringify(patient.image);
            const newSource = JSON.stringify(processedImageSource);
            
            if (oldSource !== newSource) {
              console.log(`Updating profile image source (${oldSource} → ${newSource})`);
              patient.image = processedImageSource;
              patient.profileImage = processedImageSource; // Also store in profileImage field for consistency
              needToUpdate = true;
            }
          }
          
          // Also save this data back to all storage locations for this patient to ensure consistency
          if (needToUpdate) {
            try {
              // Create a clean profile data object with validated image
              const processedProfileImage = validateAndProcessImageSource(
                refreshedData.profileImage || refreshedData.image || patient.image
              );
              
              const profileData = {
                id: refreshedData.id || patient.id,
                name: refreshedData.name || patient.name,
                email: patientEmail,
                profileImage: processedProfileImage,
                lastUpdate: new Date().toISOString()
              };
              
              // Store in all locations
              const profileDataString = JSON.stringify(profileData);
              await AsyncStorage.setItem(`directPatientData_${patientEmail}`, profileDataString);
              await AsyncStorage.setItem(`syncedUserData_${patientEmail}`, profileDataString);
              
              console.log(`Saved refreshed patient data to all storage locations`);
              needsUpdate = true;
            } catch (saveError) {
              console.log(`Error saving refreshed data: ${saveError.message}`);
            }
          }
        } else {
          console.log(`No refreshed data found for patient ${patientEmail}`);
        }
      }
      
      // Save changes if any were made
      if (needsUpdate) {
        console.log("Changes detected, updating patients list");
        setPatients(updatedPatients);
        await savePatients(updatedPatients);
        console.log("Updated patient names and profile images");
        console.log("UPDATED PATIENTS:");
        updatedPatients.forEach(patient => {
          console.log(`Patient: ${patient.name || 'No name'}, Email: ${normalizeEmail(patient.email)}`);
        });
      } else {
        console.log("No changes needed for patient names or profile images");
      }
    } catch (error) {
      console.error("Error refreshing patient names and images:", error);
    }
  };

  // Set up a refresh timer to check for updates every 10 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Only refresh if it's been more than 10 seconds since last refresh
      const now = Date.now();
      if (now - lastRefreshTime > 10000) { // 10 seconds
        console.log("Auto-refreshing patient data (10-second interval)");
        refreshPatientNames();
        setLastRefreshTime(now);
        
        // Also save the last refresh time to AsyncStorage as a string
        try {
          AsyncStorage.setItem('lastPatientRefreshTime', now.toString());
        } catch (error) {
          console.log("Error saving refresh time:", error.message);
        }
      }
    }, 10000); // 10 seconds
    
    return () => clearInterval(intervalId);
  }, [patients, lastRefreshTime]);
  
  // Also refresh when screen is focused
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log("Screen focused - refreshing patient data");
      // Only refresh if at least 2 seconds have passed since last refresh
      const now = Date.now();
      if (now - lastRefreshTime > 2000) { // 2 seconds
        refreshPatientNames();
        setLastRefreshTime(now);
        
        // Also save the last refresh time to AsyncStorage as a string
        try {
          AsyncStorage.setItem('lastPatientRefreshTime', now.toString());
        } catch (error) {
          console.log("Error saving refresh time:", error.message);
        }
      }
    });
    
    return unsubscribeFocus;
  }, [navigation, patients, lastRefreshTime]);

  // Add this function before the addPatient function
  const getPatientNameFromAllSources = async (email) => {
    const normalizedEmail = normalizeEmail(email);
    console.log(`Fetching proper patient name for ${normalizedEmail}`);
    
    try {
      // Source 1: Try server first (most accurate)
      try {
        const serverUrl = getActiveServerUrl();
        console.log(`Trying server for patient name: ${serverUrl}/api/users/profile/${normalizedEmail}`);
        const response = await axios.get(
          `${serverUrl}/api/users/profile/${normalizedEmail}`,
          { timeout: 5000 }
        );
        
        if (response.data && response.data.name) {
          console.log(`Found name from server: ${response.data.name}`);
          return response.data.name;
        }
      } catch (serverError) {
        console.log(`Server name lookup failed: ${serverError.message}`);
      }
      
      // Source 2: Try UserContext specific storage keys
      const userDataSources = [
        `userData_${normalizedEmail}`,
        `directPatientData_${normalizedEmail}`,
        `syncedUserData_${normalizedEmail}`,
        `patientData_${normalizedEmail}`,
        `userProfile_${normalizedEmail}`,
        `formattedProfile_${normalizedEmail}`
      ];
      
      for (const source of userDataSources) {
        try {
          const data = await AsyncStorage.getItem(source);
          if (data) {
            const parsedData = JSON.parse(data);
            if (parsedData && parsedData.name) {
              console.log(`Found name in ${source}: ${parsedData.name}`);
              return parsedData.name;
            }
          }
        } catch (error) {
          console.log(`Error reading ${source}: ${error.message}`);
        }
      }
      
      // Source 3: Check if this email exists in the users list
      const matchingUser = users.find(user => normalizeEmail(user.email) === normalizedEmail);
      if (matchingUser && matchingUser.name) {
        console.log(`Found name in users list: ${matchingUser.name}`);
        return matchingUser.name;
      }
      
      // Last resort: Generic name
      console.log("Could not find a name from any source, using generic 'Patient'");
      return "Patient";
    } catch (error) {
      console.log(`Error getting patient name: ${error.message}`);
      return "Patient";
    }
  };

  // Add user data to patient when adding
  const addPatient = async () => {
    if (!newPatientEmail || newPatientEmail.trim() === '') {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const normalizedEmail = normalizeEmail(newPatientEmail);
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        setIsSubmitting(false);
        return;
      }
      
      console.log("Adding patient with email:", normalizedEmail);
      
      // Check if patient already exists in our list
      const existingPatient = patients.find(p => normalizeEmail(p.email) === normalizedEmail);
      if (existingPatient) {
        Alert.alert('Already Connected', 'You are already connected to this patient');
        setIsSubmitting(false);
        return;
      }
      
      // First check if the server is reachable
      let serverAvailable = false;
      let serverErrorMessage = "Network error: Could not connect to server";
      
      try {
        const serverUrl = getActiveServerUrl();
        console.log(`Checking server availability at ${serverUrl}/ping`);
        const pingResponse = await axios.get(`${serverUrl}/ping`, { timeout: 3000 });
        serverAvailable = pingResponse.status === 200;
        console.log(`Server availability for adding patient: ${serverAvailable ? 'ONLINE' : 'OFFLINE'}`);
      } catch (error) {
        console.log("Server unavailable for adding patient:", error.message);
        serverErrorMessage = `Network error: ${error.message}`;
      }
      
      // Try to find if the user exists (in local database or server)
      let foundUser = null;
      
      // Try server if available
      if (serverAvailable) {
        try {
          console.log("Checking if patient exists on server");
          const serverUrl = getActiveServerUrl();
          const response = await axios.get(
            `${serverUrl}/api/caregivers/check-patient/${normalizedEmail}`, 
            { timeout: 5000 }
          );
          
          if (response.data.exists) {
            console.log("Patient exists on server");
            
            // Try to get the patient name and profile data
            try {
              const profileResponse = await axios.get(
                `${serverUrl}/api/users/profile?email=${encodeURIComponent(normalizedEmail)}`,
                { timeout: 5000 }
              );
              
              if (profileResponse.data) {
                console.log("Found patient profile on server:", profileResponse.data.name);
                const patientName = await getPatientNameFromAllSources(normalizedEmail);
                foundUser = {
                  id: profileResponse.data.id || `patient-${Date.now()}`,
                  name: patientName,
                  email: normalizedEmail,
                  profileImage: profileResponse.data.profileImage || null
                };
              }
            } catch (profileError) {
              console.log("Could not get patient profile from server:", profileError.message);
            }
            
            // If profile fetch failed, create basic user object
            if (!foundUser) {
              console.log("Creating basic user object from server verification");
              foundUser = {
                id: `patient-${Date.now()}`,
                name: "Patient", // Generic name until we can fetch a proper one
                email: normalizedEmail,
                pendingVerification: true // Mark this as needing verification when online
              };
            }
          } else {
            console.log("Patient does not exist on server");
            Alert.alert(
              'User Not Found', 
              'This email is not registered in the system. Please check the email and try again, or ask the patient to create an account.'
            );
            setIsSubmitting(false);
            return;
          }
        } catch (serverError) {
          console.log("Error checking server for patient:", serverError.message);
          // Fall back to local database (don't return early)
        }
      }
      
      // If server check failed or server unavailable, try local database
      if (!foundUser) {
        console.log("Checking local database for patient");
        foundUser = await findPatientInUserDatabase(normalizedEmail);
      }
      
      // If still no user found, check all storage for any matching key
      if (!foundUser) {
        console.log("Checking all storage for any patient data");
        const possibleUserKeys = [
          `userData_${normalizedEmail}`,
          `directPatientData_${normalizedEmail}`,
          `patientData_${normalizedEmail}`,
          `syncedUserData_${normalizedEmail}`
        ];
        
        for (const key of possibleUserKeys) {
          try {
            const storedData = await AsyncStorage.getItem(key);
            if (storedData) {
              const userData = JSON.parse(storedData);
              if (userData && userData.email) {
                console.log(`Found user data in ${key}: ${userData.name || 'No name'}`);
                
                foundUser = {
                  id: userData.id || `patient-${Date.now()}`,
                  name: userData.name || "Patient", // Use name from user data or generic "Patient"
                  email: normalizedEmail,
                  profileImage: userData.profileImage || null
                };
                break;
              }
            }
          } catch (error) {
            console.log(`Error checking ${key}:`, error.message);
          }
        }
      }
      
      // If we still couldn't find a user and server is unavailable
      if (!foundUser && !serverAvailable) {
        // In this case, since we're in offline mode, allow creating a connection
        // with a basic user object with info derived from email
        console.log("Creating basic user object for offline mode");
        const offlinePatientName = await getPatientNameFromAllSources(normalizedEmail);
        foundUser = {
          id: `offline-patient-${Date.now()}`,
          name: offlinePatientName,
          email: normalizedEmail,
          pendingVerification: true // Mark this as needing verification when online
        };
        
        // Show a warning that this is an offline connection
        Alert.alert(
          'Offline Connection',
          'You are creating this connection while offline. The connection will be verified when you go online again.',
          [{ text: 'Continue' }]
        );
      }
      
      // If we found a user (from server, local DB, or created for offline mode)
      if (foundUser) {
        // Always try to register the connection on the server if available
        if (serverAvailable) {
          try {
            console.log(`Registering connection to patient ${normalizedEmail} on server`);
            const serverUrl = getActiveServerUrl();
            await axios.post(`${serverUrl}/api/caregivers/connect`, {
              caregiverId: caregiver.id,
              patientEmail: normalizedEmail,
            }, { timeout: 5000 });
            
            console.log("Connection registered on server successfully");
          } catch (connectError) {
            console.log("Error registering connection on server:", connectError.message);
            // Continue anyway to keep the connection locally
          }
        }
        
        // Add the found or created user to our patients list
        const newPatient = { ...foundUser };
        const updatedPatients = [...patients, newPatient];
        
        // Always update local storage
        setPatients(updatedPatients);
        await savePatients(updatedPatients);
        
        // Update caregiver-patient mapping for redundancy
        try {
          const mappingKey = 'caregiverPatientsMap';
          const mappingStr = await AsyncStorage.getItem(mappingKey) || '{}';
          let mappings;
          try {
            mappings = JSON.parse(mappingStr);
          } catch (error) {
            console.log("Error parsing mapping, creating new object");
            mappings = {};
          }
          
          // Set bidirectional mapping
          mappings[normalizedEmail] = caregiver.email.toLowerCase().trim();
          
          // Add to caregiver's patients array if it exists
          const caregiverKey = `caregiver_${caregiver.email.toLowerCase().trim()}`;
          if (!mappings[caregiverKey]) {
            mappings[caregiverKey] = [];
          }
          
          if (!mappings[caregiverKey].includes(normalizedEmail)) {
            mappings[caregiverKey].push(normalizedEmail);
          }
          
          await AsyncStorage.setItem(mappingKey, JSON.stringify(mappings));
          console.log("Updated caregiver-patient mapping");
        } catch (mappingError) {
          console.log("Error updating caregiver-patient mapping:", mappingError.message);
        }
        
        // Reset form
        setAddModalVisible(false);
        setNewPatientEmail('');
        
        // Show success message
        Alert.alert('Success', 'Patient added successfully');
        
        // If this is the first patient, set as active
        if (updatedPatients.length === 1) {
          handleSetPatientActive(newPatient);
        }
      } else {
        // We couldn't find or create a valid user
        Alert.alert(
          'User Not Found', 
          'Could not find a user with this email address. Please check the email and try again.'
        );
      }
    } catch (error) {
      console.error("Error adding patient:", error);
      Alert.alert("Error", "Failed to add patient. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removePatient = async (patientId) => {
    try {
      // Find the patient to get their email
      const patientToRemove = patients.find(p => p.id === patientId);
      if (!patientToRemove) {
        throw new Error("Patient not found");
      }
      
      // Remove the connection on the server side
      try {
        console.log(`Removing caregiver connection to patient ${patientToRemove.email}`);
        
        // Call server to remove connection
        await safeApiCall(
          () => axios.post(`${getActiveServerUrl()}/api/caregivers/disconnect`, {
            caregiverId: caregiver.id,
            patientEmail: patientToRemove.email
          }),
          null,
          "Server failed to remove connection:"
        );
        
        console.log("Server successfully removed connection");
      } catch (serverError) {
        console.error("Server failed to remove connection:", serverError.message);
        // Continue anyway to keep UI in sync
      }
      
      // Update local state
      const updatedPatients = patients.filter(patient => patient.id !== patientId);
      setPatients(updatedPatients);
      await savePatients(updatedPatients);
      
      // If this was the active patient, clear it
      if (activePatient && activePatient.id === patientId) {
        console.log("Removed patient was the active patient, clearing active patient");
        await clearActivePatient();
        
        // Force clear the active patient from AsyncStorage
        if (caregiver?.email) {
          const activePatientKey = `activePatient_${caregiver.email}`;
          await AsyncStorage.removeItem(activePatientKey);
          console.log(`Removed active patient from AsyncStorage: ${activePatientKey}`);
        }
        
        // Set a token to prevent auto-reactivation
        await AsyncStorage.setItem('lastPatientDeactivation', `patientDeactivated_${Date.now()}`);
        await AsyncStorage.setItem('blockAutoReactivation', 'true');
        
        // Remove the block after a few seconds
        setTimeout(async () => {
          await AsyncStorage.removeItem('blockAutoReactivation');
          console.log("Auto-reactivation block removed");
        }, 5000);
        
        // Notify the user specifically about active patient being removed
        Alert.alert(
          "Active Patient Removed",
          "The patient you removed was set as active. Please select another patient as active when needed.",
          [{ text: "OK" }]
        );
      } else {
        // Standard success message for non-active patients
        Alert.alert("Success", "Patient removed successfully");
      }
    } catch (error) {
      console.error("Failed to remove patient:", error);
      Alert.alert("Error", "Failed to remove patient");
    }
  };

  // Remove async from this function since we're using the local name property
  const confirmRemovePatient = (patient) => {
    const name = patient.name || patient.email;
    
    Alert.alert(
      "Remove Patient",
      `Are you sure you want to remove ${name} from your patients?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", onPress: () => removePatient(patient.id), style: "destructive" }
      ]
    );
  };

  const filteredPatients = searchQuery 
    ? patients.filter(patient => {
        const name = patient.name || "";
        return (
          name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          patient.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
    : patients;

  // Function to handle setting a patient as active
  const handleSetPatientActive = (patient) => {
    console.log(`Setting patient ${patient.name || patient.email} as active`);
    
    // First ensure we have a local reference
    const patientToActivate = { ...patient };
    
    // Use the context's setActivePatient function which will handle AsyncStorage save
    setActivePatient(patientToActivate)
      .then(success => {
        if (success) {
          console.log("Successfully set active patient via context");
          
          // Force update of the UI to show active status immediately
          const updatedPatients = patients.map(p => 
            p.id === patientToActivate.id ? patientToActivate : p
          );
          setPatients([...updatedPatients]);
          
          // Use setTimeout to ensure the activePatient is set before calling refresh
          setTimeout(() => {
            // This will refresh using the now-set activePatient
            refreshActivePatientData();
          }, 100);
        } else {
          console.log("Failed to set active patient via context");
          // Fallback direct state update if context method failed
          // This won't update AsyncStorage but at least updates the UI
          setActivePatient(patientToActivate);
          
          // Force immediate UI refresh
          const updatedPatients = [...patients];
          setPatients([]);
          setTimeout(() => setPatients(updatedPatients), 10);
          
          // Show alert for debugging
          console.log("Using direct state update as fallback for active patient");
        }
      })
      .catch(error => {
        console.error("Error setting active patient:", error);
        
        // Fallback direct state update
        setActivePatient(patientToActivate);
        Alert.alert("Warning", "Patient was set as active but may not persist across app restarts.");
      });
  };
  
  // Handle deactivating a patient
  const handleDeactivatePatient = () => {
    Alert.alert(
      "Remove Active Status?",
      "Are you sure you want to remove the active status from this patient? This will prevent you from adding new data for this patient until you make them active again.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove Active Status", 
          style: "destructive", 
          onPress: async () => {
            console.log("Deactivating patient");
            
            try {
              // Create a deactivation token in AsyncStorage to prevent auto-reactivation
              const deactivationToken = `patientDeactivated_${Date.now()}`;
              await AsyncStorage.setItem('lastPatientDeactivation', deactivationToken);
              
              // First clear locally
              setActivePatient(null);
              
              // Then use the context method to clear from AsyncStorage
              const success = await clearActivePatient();
              
              if (success) {
                console.log("Patient deactivated successfully");
                
                // Force clear the active patient key in AsyncStorage directly
                if (caregiver?.email) {
                  const activePatientKey = `activePatient_${caregiver.email}`;
                  await AsyncStorage.removeItem(activePatientKey);
                  console.log(`Directly removed active patient from storage: ${activePatientKey}`);
                }
                
                // Prevent auto-reactivation by setting a block flag
                await AsyncStorage.setItem('blockAutoReactivation', 'true');
                
                // Set a timeout to remove the block after 5 seconds
                setTimeout(async () => {
                  await AsyncStorage.removeItem('blockAutoReactivation');
                  console.log("Auto-reactivation block removed");
                }, 5000);
                
                // Trigger a re-render of the patients list
                const updatedPatients = [...patients];
                setPatients([]);
                setTimeout(() => {
                  setPatients(updatedPatients);
                }, 50);
                
                // Show success message to user
                Alert.alert(
                  "Patient Deactivated",
                  "The patient is no longer active. You can set them as active again at any time.",
                  [{ text: "OK" }]
                );
              } else {
                console.log("Failed to deactivate patient");
                Alert.alert(
                  "Deactivation Failed",
                  "There was a problem deactivating the patient. Please try again.",
                  [{ text: "OK" }]
                );
              }
            } catch (error) {
              console.error("Error deactivating patient:", error);
              Alert.alert(
                "Deactivation Error",
                "An error occurred while deactivating the patient.",
                [{ text: "OK" }]
              );
            }
          } 
        }
      ]
    );
  };

  const renderPatientItem = ({ item }) => {
    return (
      <PatientItem
        item={item}
        activePatient={activePatient}
        onSetActive={handleSetPatientActive}
        onDeactivate={handleDeactivatePatient}
        onDelete={confirmRemovePatient}
        setSelectedImage={setSelectedImage}
        setImageModalVisible={setImageModalVisible}
      />
    );
  };

  // Force synchronization of profile data across all storage locations
  const synchronizeProfileData = async (patientEmail) => {
    try {
      console.log(`===== SYNCHRONIZING PROFILE DATA FOR ${patientEmail} =====`);
      const normalizedEmail = normalizeEmail(patientEmail);
      
      // Collect profile data from all possible sources
      const sources = [
        { key: `formattedProfile_${normalizedEmail}`, priority: 1, type: 'User direct profile' },
        { key: `userData_${normalizedEmail}`, priority: 2, type: 'User data' },
        { key: `directPatientData_${normalizedEmail}`, priority: 3, type: 'Direct patient data' },
        { key: `syncedUserData_${normalizedEmail}`, priority: 4, type: 'Synced user data' }
      ];
      
      let bestProfile = null;
      let bestSource = null;
      let bestPriority = 999;
      
      // First pass - collect data from all sources
      for (const source of sources) {
        try {
          const data = await AsyncStorage.getItem(source.key);
          if (!data) continue;
          
          try {
            const profile = JSON.parse(data);
            if (profile && profile.name) {
              console.log(`Found profile in ${source.type}: ${profile.name}`);
              
              // If this source has higher priority than what we've found so far
              if (source.priority < bestPriority) {
                bestProfile = profile;
                bestSource = source;
                bestPriority = source.priority;
                console.log(`Using ${source.type} as best source: ${profile.name}`);
              }
            }
          } catch (parseError) {
            console.log(`Error parsing ${source.type}: ${parseError.message}`);
            // Remove corrupt data
            await AsyncStorage.removeItem(source.key);
          }
        } catch (error) {
          console.log(`Error accessing ${source.type}: ${error.message}`);
        }
      }
      
      // If we found valid profile data, ensure it's stored consistently
      if (bestProfile) {
        console.log(`Best profile data found: ${bestProfile.name} from ${bestSource.type}`);
        
        // Create a clean profile object
        const cleanProfile = {
          id: bestProfile.id || `user-${Date.now()}`,
          name: bestProfile.name,
          email: normalizedEmail,
          profileImage: bestProfile.profileImage,
          phone: bestProfile.phone || '',
          lastUpdate: new Date().toISOString()
        };
        
        const profileJson = JSON.stringify(cleanProfile);
        
        // Store in all locations for consistency
        let syncSuccess = true;
        
        for (const source of sources) {
          try {
            await AsyncStorage.setItem(source.key, profileJson);
          } catch (error) {
            console.log(`Error syncing to ${source.type}: ${error.message}`);
            syncSuccess = false;
          }
        }
        
        console.log(`Profile synchronization ${syncSuccess ? 'successful' : 'partially failed'}`);
        return cleanProfile;
      } else {
        console.log(`No valid profile data found for ${normalizedEmail}`);
        return null;
      }
    } catch (error) {
      console.error(`Error synchronizing profile data: ${error.message}`);
      return null;
    }
  };

  // Synchronize all patient profiles when component loads
  useEffect(() => {
    const syncAllPatientProfiles = async () => {
      if (!patients || patients.length === 0) return;
      
      console.log("===== SYNCHRONIZING ALL PATIENT PROFILES =====");
      let patientUpdates = [];
      
      for (const patient of patients) {
        try {
          const patientEmail = normalizeEmail(patient.email);
          const syncedProfile = await synchronizeProfileData(patientEmail);
          
          if (syncedProfile && syncedProfile.name !== patient.name) {
            console.log(`Will update ${patient.name || patientEmail} → ${syncedProfile.name}`);
            patientUpdates.push({
              ...patient,
              name: syncedProfile.name,
              image: validateAndProcessImageSource(syncedProfile.profileImage) || patient.image,
              profileImage: validateAndProcessImageSource(syncedProfile.profileImage) || patient.profileImage
            });
          }
        } catch (error) {
          console.log(`Error syncing profile for ${patient.email}: ${error.message}`);
        }
      }
      
      if (patientUpdates.length > 0) {
        console.log(`Updating ${patientUpdates.length} patients with synchronized profiles`);
        
        const updatedPatients = patients.map(patient => {
          const update = patientUpdates.find(p => p.id === patient.id);
          return update || patient;
        });
        
        setPatients(updatedPatients);
        await savePatients(updatedPatients);
        
        // If active patient was updated, update it too
        if (activePatient) {
          const activeUpdate = patientUpdates.find(p => p.id === activePatient.id);
          if (activeUpdate) {
            console.log(`Updating active patient: ${activePatient.name} → ${activeUpdate.name}`);
            setActivePatient(activeUpdate);
          }
        }
      } else {
        console.log("No patient profiles needed updating");
      }
    };
    
    // Run the sync when patients are loaded
    if (patients.length > 0 && !isLoading) {
      syncAllPatientProfiles();
    }
  }, [patients.length, isLoading]);

  // Force immediate data refresh for active patient
  const refreshActivePatientData = async () => {
    if (!activePatient) return;
    
    try {
      const patientEmail = normalizeEmail(activePatient.email);
      console.log(`Forcing data refresh for active patient: ${patientEmail}`);
      
      // First synchronize the profile data to ensure consistency
      const syncedProfile = await synchronizeProfileData(patientEmail);
      
      if (syncedProfile) {
        console.log(`Using synchronized profile for active patient: ${syncedProfile.name}`);
        
        // Update patient with synchronized data
        const updatedPatient = {
          ...activePatient,
          name: syncedProfile.name,
          image: validateAndProcessImageSource(syncedProfile.profileImage) || activePatient.image,
          profileImage: validateAndProcessImageSource(syncedProfile.profileImage) || activePatient.profileImage,
          phone: syncedProfile.phone || activePatient.phone || ''
        };
        
        // Update in patients list
        const updatedPatients = patients.map(p => 
          p.id === activePatient.id ? updatedPatient : p
        );
        
        setPatients(updatedPatients);
        setActivePatient(updatedPatient);
        await savePatients(updatedPatients);
        
        // Show success alert after update completes
        Alert.alert(
          "Active Patient Set",
          `${updatedPatient.name || updatedPatient.email} is now the active patient. All reminders, memories, family and emergency contacts will be associated with this patient.`,
          [{ text: "OK" }]
        );
        
        return;
      }
      
      // If synchronization fails, fall back to server and local data
      try {
        // Try server first (if available)
        const serverUrl = getActiveServerUrl();
        const response = await safeApiCall(
          () => axios.get(`${serverUrl}/api/users/profile/${patientEmail}`),
          null,
          "API error fetching user profile after setting active:"
        );
        
        if (response && response.data && response.data.name) {
          console.log(`SUCCESS: Got fresh data for active patient: ${response.data.name}`);
          
          // Update with server data
          const updatedPatient = {
            ...activePatient,
            name: response.data.name,
            image: validateAndProcessImageSource(response.data.profileImage) || activePatient.image,
            profileImage: validateAndProcessImageSource(response.data.profileImage) || activePatient.profileImage
          };
          
          // Update in patients list
          const updatedPatients = patients.map(p => 
            p.id === activePatient.id ? updatedPatient : p
          );
          
          setPatients(updatedPatients);
          setActivePatient(updatedPatient);
          await savePatients(updatedPatients);
          
          // Show success alert
          Alert.alert(
            "Active Patient Set",
            `${updatedPatient.name || updatedPatient.email} is now the active patient. All reminders, memories, family and emergency contacts will be associated with this patient.`,
            [{ text: "OK" }]
          );
          
          return;
        }
      } catch (serverError) {
        console.log(`Server fetch failed: ${serverError.message}`);
      }
      
      // If all else fails, just show the default success message
      Alert.alert(
        "Active Patient Set",
        `${activePatient.name || activePatient.email} is now the active patient. All reminders, memories, family and emergency contacts will be associated with this patient.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.log("Error refreshing active patient data:", error.message);
      
      // Still show a success message even if refresh failed
      Alert.alert(
        "Active Patient Set",
        `${activePatient.name || activePatient.email} is now the active patient. All reminders, memories, family and emergency contacts will be associated with this patient.`,
        [{ text: "OK" }]
      );
    }
  };

  // Add this function after the loadPatients function
  const synchronizePatientProfiles = async () => {
    if (!patients.length) return;
    
    console.log(`Synchronizing profiles for ${patients.length} patients...`);
    
    // First check server availability
    let serverAvailable = false;
    try {
      const serverUrl = getActiveServerUrl();
      const pingResponse = await axios.get(`${serverUrl}/ping`, { timeout: 3000 });
      serverAvailable = pingResponse.status === 200;
      console.log(`Server availability for profile sync: ${serverAvailable ? 'ONLINE' : 'OFFLINE'}`);
    } catch (error) {
      console.log("Server unavailable for profile sync:", error.message);
    }
    
    // Create an array to hold updated patients
    const updatedPatients = [...patients];
    let updateCount = 0;
    
    // Process each patient to ensure they have complete profile data
    for (const patient of updatedPatients) {
      if (!patient.email) continue;
      
      const normalizedEmail = normalizeEmail(patient.email);
      console.log(`Processing profile for patient: ${normalizedEmail}`);
      
      // Check all possible storage locations for the best profile data
      let bestProfile = { ...patient };
      let updated = false;
      
      // Storage keys that might contain patient profile data
      const possibleProfileKeys = [
        `userData_${normalizedEmail}`,
        `directPatientData_${normalizedEmail}`,
        `syncedUserData_${normalizedEmail}`,
        `patientData_${normalizedEmail}`
      ];
      
      // Check each storage location
      for (const key of possibleProfileKeys) {
        try {
          const storedData = await AsyncStorage.getItem(key);
          if (!storedData) continue;
          
          const profile = JSON.parse(storedData);
          if (!profile || !profile.email) continue;
          
          console.log(`Found profile data in ${key}: ${profile.name || 'No name'}`);
          
          // Check if this profile has better data (name, image)
          if (profile.name && (!bestProfile.name || profile.name.length > bestProfile.name.length)) {
            console.log(`Using better name from ${key}: ${profile.name}`);
            bestProfile.name = profile.name;
            updated = true;
          }
          
          // Check for profile image
          if (profile.profileImage && !bestProfile.profileImage) {
            console.log(`Using profile image from ${key}`);
            bestProfile.profileImage = profile.profileImage;
            updated = true;
          }
          
          // If this profile has an image property and we don't have one yet
          if (profile.image && !bestProfile.image && !bestProfile.profileImage) {
            console.log(`Using image from ${key}`);
            bestProfile.image = profile.image;
            updated = true;
          }
          
          // Use any additional useful data that might be present
          if (profile.phone && !bestProfile.phone) {
            bestProfile.phone = profile.phone;
            updated = true;
          }
        } catch (error) {
          console.log(`Error checking ${key}:`, error.message);
        }
      }
      
      // If we have a server connection, try to get data from there as well
      if (serverAvailable) {
        try {
          console.log(`Checking server for profile data: ${normalizedEmail}`);
          const response = await axios.get(
            `${getActiveServerUrl()}/api/users/profile?email=${encodeURIComponent(normalizedEmail)}`,
            { timeout: 5000 }
          );
          
          if (response.data && response.data.name) {
            console.log(`Found name on server: ${response.data.name}`);
            bestProfile.name = response.data.name;
            updated = true;
            
            // Also grab other fields if available
            if (response.data.profileImage) {
              bestProfile.profileImage = response.data.profileImage;
              updated = true;
            }
          }
        } catch (error) {
          console.log(`Server profile lookup failed for ${normalizedEmail}:`, error.message);
        }
      }
      
      // If we found better data, update the patient in our list
      if (updated) {
        // Find the patient index in our updatedPatients array
        const index = updatedPatients.findIndex(p => p.id === patient.id);
        if (index !== -1) {
          updatedPatients[index] = bestProfile;
          updateCount++;
        }
      }
    }
    
    // If we made updates, save the improved data
    if (updateCount > 0) {
      console.log(`Updated ${updateCount} patient profiles with better data`);
      setPatients(updatedPatients);
      await savePatients(updatedPatients);
    } else {
      console.log("No patient profiles needed updates");
    }
  };
  
  // Add this useEffect to run the synchronizePatientProfiles function after patients are loaded
  useEffect(() => {
    if (patients.length > 0 && !isLoading) {
      synchronizePatientProfiles();
    }
  }, [patients.length, isLoading]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#005BBB" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: fontSize + 4 }]}>Manage Patients</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#7F8C8D" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { fontSize }]}
          placeholder="Search patients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#005BBB" />
        </View>
      ) : (
        <>
          <FlatList
            data={filteredPatients}
            renderItem={renderPatientItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { fontSize }]}>
                  {searchQuery ? "No matching patients found" : "No patients connected yet"}
                </Text>
              </View>
            }
            contentContainerStyle={styles.patientsList}
          />

          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="add" size={24} color="#FFF" />
            <Text style={[styles.addButtonText, { fontSize }]}>Add Patient</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Add Patient Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { fontSize: fontSize + 2 }]}>Add New Patient</Text>
            
            <Text style={[styles.inputLabel, { fontSize }]}>Enter Patient Email</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              placeholder="patient@example.com"
              value={newPatientEmail}
              onChangeText={setNewPatientEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Text style={[styles.modalDescription, { fontSize: fontSize - 2 }]}>
              The patient must have an account in the app. You will be connected as their caregiver.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setNewPatientEmail("");
                  setAddModalVisible(false);
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.addPatientButton]}
                onPress={addPatient}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal
        visible={isImageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.closeImageButton}
            onPress={() => {
              console.log("Closing image modal");
              setImageModalVisible(false);
              setSelectedImage(null);
            }}
          >
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>
          
          {selectedImage && (
            <View style={styles.imageWrapper}>
              <Image
                source={(() => {
                  try {
                    // Always have a fallback ready
                    const fallbackImage = selectedImage.fallback || require('../images/boy.png');
                    
                    // Handle various source formats to prevent RCTImageView src errors
                    if (!selectedImage.source) {
                      console.log('No source provided, using fallback');
                      return fallbackImage;
                    }
                    
                    if (typeof selectedImage.source === 'number') {
                      // Already a require() result, use as is
                      console.log('Using numeric image source (require result)');
                      return selectedImage.source;
                    } 
                    
                    if (typeof selectedImage.source === 'object' && selectedImage.source !== null) {
                      // Handle null uri
                      if (!selectedImage.source.uri) {
                        console.log('Object source without URI, using fallback');
                        return fallbackImage;
                      }
                      
                      // Object with URI
                      const uri = selectedImage.source.uri;
                      
                      // Handle invalid URI strings
                      if (!uri || typeof uri !== 'string') {
                        console.log('Invalid URI in source object, using fallback');
                        return fallbackImage;
                      }
                      
                      // Handle Android URI format
                      if (Platform.OS === 'android' && 
                          !uri.startsWith('file://') && 
                          !uri.startsWith('content://') && 
                          !uri.startsWith('http')) {
                        console.log('Adding file:// prefix to Android URI:', uri);
                        return { uri: `file://${uri}` };
                      }
                      
                      console.log('Using URI source:', uri);
                      return selectedImage.source;
                    }
                    
                    // Any other case, use fallback
                    console.log('Unhandled source type, using fallback');
                    return fallbackImage;
                  } catch (error) {
                    console.log('Error preparing image source:', error);
                    return selectedImage.fallback || require('../images/boy.png');
                  }
                })()}
                style={styles.fullScreenImage}
                resizeMode="contain"
                defaultSource={require('../images/boy.png')}
                onError={(e) => {
                  console.log('Error loading image in modal:', e.nativeEvent?.error || 'Unknown error');
                  // We can't update state during render, so just log the error
                }}
              />
            </View>
          )}
          
          {/* Display patient name at the bottom of the modal */}
          {selectedImage && selectedImage.patientName && (
            <View style={styles.patientNameContainer}>
              <Text style={styles.patientNameInModal}>{selectedImage.patientName}</Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#FFF"
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#2C3E50",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 8,
    margin: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  patientsList: {
    padding: 15,
  },
  patientItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  activePatientItem: {
    borderWidth: 2,
    borderColor: "#005BBB",
    backgroundColor: "#F5F9FF",
  },
  patientImageContainer: {
    position: 'relative',
  },
  patientImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 20,
    backgroundColor: "#f0f0f0",
    resizeMode: "cover",
    borderWidth: 2,
    borderColor: "#005BBB",
  },
  activePatientImage: {
    borderWidth: 3,
    borderColor: "#005BBB",
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontWeight: "bold",
    color: "#2C3E50",
  },
  patientEmail: {
    color: "#7F8C8D",
    marginTop: 3,
  },
  patientPhone: {
    color: "#7F8C8D",
    marginTop: 3,
  },
  actionsContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 'auto',
    height: '100%',
  },
  activeStatusContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  activeText: {
    color: "#005BBB",
    fontWeight: "bold",
    fontSize: 12,
    marginBottom: 5,
  },
  setActiveButton: {
    backgroundColor: "#005BBB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  setActiveText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  deactivateButton: {
    backgroundColor: "#f8f9fa",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  deactivateText: {
    color: "#6c757d",
    fontSize: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  editButton: {
    marginRight: 10,
  },
  deleteButton: {
    padding: 5,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#7F8C8D",
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#005BBB",
    borderRadius: 10,
    margin: 15,
    padding: 15,
  },
  addButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 15,
    textAlign: "center",
  },
  inputLabel: {
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  modalDescription: {
    color: "#7F8C8D",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#95A5A6",
    marginRight: 10,
  },
  addPatientButton: {
    backgroundColor: "#005BBB",
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  imageModalContainer: {
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageWrapper: {
    width: '100%', 
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  fullScreenImage: {
    width: '90%',
    height: '90%',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  patientNameContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
  },
  patientNameInModal: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CaregiverPatientsScreen;