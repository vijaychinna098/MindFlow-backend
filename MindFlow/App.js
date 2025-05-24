// App.js
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StatusBar, Platform, AppState } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FontSizeProvider } from "./screens/user/FontSizeContext";
import { FontSizeProvider as CaregiverFontSizeProvider } from "./screens/caregiver/CaregiverFontSizeContext";
import { UserProvider, useUser } from "./UserContext";
import { useCaregiver } from "./CaregiverContext";
import * as Linking from "expo-linking";
import "react-native-get-random-values";
import { navigationRef } from "./NavigationRef";

// Import Firebase Notifications component
import NotificationManager from './components/NotificationManager';
// Import FCM background handler
import { setupFirebaseMessaging } from './utils/FirebaseNotifications';
// Import FCM token utility (This will automatically log the token)
// import './utils/GetFCMToken';
import './utils/GetExpoToken';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
// Import ActivityTracker for app-wide activity tracking
import * as ActivityTracker from './utils/ActivityTracker';
// Import the backend connection initializer
import { initializeBackendConnection } from './config';
// Import SpeechManager
import { initSpeech } from './utils/SpeechManager';
// Import ServerSyncService for pending syncs
import { processPendingProfileSyncs } from './services/ServerSyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import DataSynchronizationService for direct profile sharing
import { shareProfileDataDirectly } from './services/DataSynchronizationService';

// User Screens
import LoginScreen from "./screens/user/LoginScreen";
import SignupScreen from "./screens/user/SignupScreen";
import HomeScreen from "./screens/user/HomeScreen";
import SettingsScreen from "./screens/user/SettingsScreen";
import ResetPasswordScreen from "./screens/user/ResetPasswordScreen";
import ExerciseScreen from "./screens/user/ExerciseScreen";
import MapScreen from "./screens/user/MapScreen";
import ProfileScreen from "./screens/user/ProfileScreen";
import EditProfileScreen from "./screens/user/EditProfileScreen";
import SetHomeLocation from "./screens/user/SetHomeLocation";
import RemindersScreen from "./screens/user/RemindersScreen";
import VoiceAssistanceScreen from "./screens/user/VoiceAssistanceScreen";
import FamilyScreen from "./screens/user/FamilyScreen";
import CaregiverScreen from "./screens/user/CaregiverScreen";
import MemoriesScreen from "./screens/user/MemoriesScreen";
import EmergencyContacts from "./screens/user/EmergencyContacts";
import ActivitiesScreen from "./screens/user/ActivitiesScreen";
import MemoryGamesScreen from "./screens/user/MemoryGamesScreen";
import MatchingPairsScreen from "./screens/user/MatchingPairsScreen";
import WordMemoryScreen from "./screens/user/WordMemoryScreen";
import PuzzleChallengeScreen from "./screens/user/PuzzleChallengeScreen";
import WordScrambleScreen from "./screens/user/WordScrambleScreen";
import ColorMatchingScreen from "./screens/user/ColorMatchingScreen";
import EverydayObjectsScreen from "./screens/user/EverydayObjectsScreen";
import SequentialTasksScreen from "./screens/user/SequentialTasksScreen";
import VisualPairsScreen from "./screens/user/VisualPairsScreen";
import WelcomeScreen from "./screens/user/WelcomeScreen";
import NotificationScreen from "./screens/user/NotificationScreen";
import HowToUseScreen from "./screens/shared/HowToUseScreen";
import ScreenTimeAnalyticsScreen from "./screens/user/ScreenTimeAnalyticsScreen";

// Caregiver Screens
import CaregiverHomeScreen from "./screens/caregiver/CaregiverHomeScreen";
import CaregiverSettingsScreen from "./screens/caregiver/CaregiverSettingsScreen";
import CaregiverExerciseScreen from "./screens/caregiver/CaregiverExerciseScreen";
import CaregiverMapScreen from "./screens/caregiver/CaregiverMapScreen";
import CaregiverProfileScreen from "./screens/caregiver/CaregiverProfileScreen";
import CaregiverEditProfileScreen from "./screens/caregiver/CaregiverEditProfileScreen";
import CaregiverRemindersScreen from "./screens/caregiver/CaregiverRemindersScreen";
import CaregiverVoiceAssistanceScreen from "./screens/caregiver/CaregiverVoiceAssistanceScreen";
import CaregiverFamilyScreen from "./screens/caregiver/CaregiverFamilyScreen";
import CaregiverMemoriesScreen from "./screens/caregiver/CaregiverMemoriesScreen";
import CaregiverEmergencyContacts from "./screens/caregiver/CaregiverEmergencyContacts";
import CaregiverLoginScreen from "./screens/caregiver/CaregiverLoginScreen";
import CaregiverSignupScreen from "./screens/caregiver/CaregiverSignupScreen";
import CaregiverResetPasswordScreen from "./screens/caregiver/CaregiverResetPasswordScreen";
import CaregiverConnectScreen from "./screens/caregiver/CaregiverConnectScreen";
import CaregiverPatientsScreen from "./screens/caregiver/CaregiverPatientsScreen";
import CaregiverNotificationsScreen from "./screens/caregiver/CaregiverNotificationsScreen";
import PatientHistoryScreen from "./screens/caregiver/PatientHistoryScreen";
import CaregiverSetHomeLocation from "./screens/caregiver/CaregiverSetHomeLocation";

// Shared Screens
import PrivacyPolicyScreen from "./screens/shared/PrivacyPolicyScreen";

import { ReminderProvider } from "./context/ReminderContext";
import { MemoriesProvider } from "./context/MemoriesContext";
import { EmergencyContactsProvider } from "./context/EmergencyContactsContext";
import { FamilyProvider } from "./context/FamilyContext";
import { CaregiverProvider } from "./CaregiverContext";

const Stack = createStackNavigator();

const linking = {
  prefixes: ["myalzapp://"],
  config: {
    screens: {
      ResetPassword: "reset-password/:token",
      CaregiverResetPassword: "caregiver/reset-password/:token",
      AppContent: {
        screens: {
          CaregiverMap: "caregiver-map/:patientEmail",
        }
      }
    },
  },
};

const UserStack = () => {
  console.log('Rendering UserStack with HomeScreen');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Exercise" component={ExerciseScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SetHomeLocation" component={SetHomeLocation} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="VoiceAssistance" component={VoiceAssistanceScreen} />
      <Stack.Screen name="Family" component={FamilyScreen} />
      <Stack.Screen name="Caregiver" component={CaregiverScreen} />
      <Stack.Screen name="Memories" component={MemoriesScreen} />
      <Stack.Screen name="EmergencyCall" component={EmergencyContacts} />
      <Stack.Screen name="Activities" component={ActivitiesScreen} />
      <Stack.Screen name="MemoryGames" component={MemoryGamesScreen} />
      <Stack.Screen name="EverydayObjects" component={EverydayObjectsScreen} />
      <Stack.Screen name="SequentialTasks" component={SequentialTasksScreen} />
      <Stack.Screen name="VisualPairs" component={VisualPairsScreen} />
      <Stack.Screen name="MatchingPairs" component={MatchingPairsScreen} />
      <Stack.Screen name="WordMemory" component={WordMemoryScreen} />
      <Stack.Screen name="PuzzleChallenge" component={PuzzleChallengeScreen} />
      <Stack.Screen name="WordScramble" component={WordScrambleScreen} />
      <Stack.Screen name="ColorMatching" component={ColorMatchingScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="HowToUse" component={HowToUseScreen} />
    </Stack.Navigator>
  );
};

const CaregiverStack = () => {
  const { caregiver } = useCaregiver();
  return (
    <CaregiverFontSizeProvider>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="CaregiverHome"
      >
        <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
        <Stack.Screen name="CaregiverProfile" component={CaregiverProfileScreen} />
        <Stack.Screen name="CaregiverSettings" component={CaregiverSettingsScreen} />
        <Stack.Screen name="CaregiverExercise" component={CaregiverExerciseScreen} />
        <Stack.Screen name="CaregiverMap" component={CaregiverMapScreen} />
        <Stack.Screen name="CaregiverEditProfile" component={CaregiverEditProfileScreen} />
        <Stack.Screen name="CaregiverReminders" component={CaregiverRemindersScreen} />
        <Stack.Screen name="CaregiverVoiceAssistance" component={CaregiverVoiceAssistanceScreen} />
        <Stack.Screen name="CaregiverFamily" component={CaregiverFamilyScreen} />
        <Stack.Screen name="CaregiverMemories" component={CaregiverMemoriesScreen} />
        <Stack.Screen name="CaregiverEmergencyCall" component={CaregiverEmergencyContacts} />
        <Stack.Screen name="CaregiverConnect" component={CaregiverConnectScreen} />
        <Stack.Screen name="CaregiverPatients" component={CaregiverPatientsScreen} />
        <Stack.Screen name="CaregiverNotifications" component={CaregiverNotificationsScreen} />
        <Stack.Screen name="PatientHistory" component={PatientHistoryScreen} />
        <Stack.Screen name="CaregiverSetHomeLocation" component={CaregiverSetHomeLocation} />
        <Stack.Screen name="SetHomeLocation" component={SetHomeLocation} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="HowToUse" component={HowToUseScreen} />
      </Stack.Navigator>
    </CaregiverFontSizeProvider>
  );
};

const AppContent = () => {
  const { currentUser, isLoading: userLoading, isSignedIn } = useUser();
  const { caregiver, isLoading: caregiverLoading } = useCaregiver();
  const [forceShowScreens, setForceShowScreens] = useState(false);
  const [verifyingAuth, setVerifyingAuth] = useState(false);

  // Authentication verification - help prevent unexpected logouts
  useEffect(() => {
    const verifyAuthState = async () => {
      try {
        setVerifyingAuth(true);
        const storedSignInStatus = await AsyncStorage.getItem('isUserSignedIn');
        const currentUserEmail = await AsyncStorage.getItem('currentUserEmail');
        
        console.log("[AUTH CHECK] Current auth state:");
        console.log("- storedSignInStatus:", storedSignInStatus);
        console.log("- currentUserEmail:", currentUserEmail);
        console.log("- isSignedIn state:", isSignedIn);
        console.log("- currentUser:", currentUser ? "exists" : "null");
        
        // Fix inconsistent state - if we have stored data but React state doesn't reflect it
        if (storedSignInStatus === 'true' && currentUserEmail && !isSignedIn) {
          console.log("[AUTH CHECK] Fixing inconsistent auth state - should be signed in");
          // The useEffect in UserContext will handle the rest
        }
        
        // If user is navigating between screens, ensure their session persists
        if (currentUser && isSignedIn) {
          console.log("[AUTH CHECK] User is authenticated, ensuring persistence");
          await AsyncStorage.setItem('isUserSignedIn', 'true');
          await AsyncStorage.setItem('currentUserEmail', currentUser.email);
        }
      } catch (error) {
        console.error("[AUTH CHECK] Error verifying auth state:", error);
      } finally {
        setVerifyingAuth(false);
      }
    };
    
    verifyAuthState();
  }, [currentUser, isSignedIn]);

  // Debug logging for state changes
  useEffect(() => {
    console.log("AppContent state changed:");
    console.log("- currentUser:", currentUser ? `${currentUser.name} (${currentUser.email})` : "null");
    console.log("- isSignedIn:", isSignedIn);
    console.log("- userLoading:", userLoading);
    console.log("- caregiver:", caregiver ? `${caregiver.name} (${caregiver.email})` : "null");
    console.log("- caregiverLoading:", caregiverLoading);
    console.log("- forceShowScreens:", forceShowScreens);
    console.log("- verifyingAuth:", verifyingAuth);
  }, [currentUser, isSignedIn, userLoading, caregiver, caregiverLoading, forceShowScreens, verifyingAuth]);

  // Force show screens after timeout to prevent infinite loading
  useEffect(() => {
    const forceShowTimer = setTimeout(() => {
      if (userLoading || caregiverLoading) {
        console.log("Loading timeout reached - forcing screens to display");
        setForceShowScreens(true);
      }
    }, 8000); // 8 second timeout
    
    return () => clearTimeout(forceShowTimer);
  }, [userLoading, caregiverLoading]);

  // Initialize FCM in the main app component
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const unsubscribe = await setupFirebaseMessaging();
        console.log('Firebase Messaging initialized successfully');
        
        return () => {
          if (unsubscribe) unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing Firebase Messaging:', error);
      }
    };

    initializeFirebase();
  }, []);

  useEffect(() => {
    const handleDeepLink = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const { path, queryParams } = Linking.parse(initialUrl);
          if (path) {
            console.log('Deep link detected:', path);
            const routeParts = path.split("/");
            
            if (routeParts[0] === "reset-password") {
              navigationRef.current?.navigate("ResetPassword", { token: routeParts[1] });
            } else if (routeParts[0] === "caregiver/reset-password") {
              navigationRef.current?.navigate("CaregiverResetPassword", { token: routeParts[1] });
            } else if (routeParts[0] === "caregiver-map" && routeParts[1]) {
              // If user is a caregiver, navigate to the map screen with the patient's email
              if (caregiver) {
                console.log('Navigating to CaregiverMap for patient:', routeParts[1]);
                // Find the patient by email 
                const patientEmail = routeParts[1];
                // Store the patientEmail for when the map screen is mounted
                await AsyncStorage.setItem('deepLinkPatientEmail', patientEmail);
                // Navigate to the caregiver map screen
                navigationRef.current?.navigate("CaregiverMap");
              } else {
                console.log('User is not a caregiver, cannot navigate to CaregiverMap');
              }
            }
          }
        }
      } catch (error) {
        console.error("Deep link error:", error);
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const { path, queryParams } = Linking.parse(url);
      if (path) {
        console.log('Deep link event detected:', path);
        const routeParts = path.split("/");
        
        if (routeParts[0] === "reset-password") {
          navigationRef.current?.navigate("ResetPassword", { token: routeParts[1] });
        } else if (routeParts[0] === "caregiver/reset-password") {
          navigationRef.current?.navigate("CaregiverResetPassword", { token: routeParts[1] });
        } else if (routeParts[0] === "caregiver-map" && routeParts[1]) {
          // If user is a caregiver, navigate to the map screen with the patient's email
          if (caregiver) {
            console.log('Navigating to CaregiverMap for patient:', routeParts[1]);
            // Find the patient by email 
            const patientEmail = routeParts[1];
            // Store the patientEmail
            AsyncStorage.setItem('deepLinkPatientEmail', patientEmail)
              .then(() => {
                // Navigate to the caregiver map screen
                navigationRef.current?.navigate("CaregiverMap");
              });
          } else {
            console.log('User is not a caregiver, cannot navigate to CaregiverMap');
          }
        }
      }
    });

    handleDeepLink();
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Improved conditional rendering logic
  if (userLoading || caregiverLoading) {
    // If we're still loading but reached the timeout, proceed to show screens
    if (forceShowScreens) {
      console.log("Showing screens despite loading state");
      // Continue to render with null currentUser/caregiver
    } else {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" />
        </SafeAreaView>
      );
    }
  }

  // CRITICAL FIX: First check if user is signed in
  if (isSignedIn) {
    console.log("User is signed in - showing UserStack EVEN IF currentUser is null");
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {currentUser && <NotificationManager userId={currentUser.email} />}
        <FontSizeProvider>
          <UserStack />
        </FontSizeProvider>
      </SafeAreaView>
    );
  } else if (caregiver) {
    console.log("Caregiver is signed in - showing CaregiverStack");
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <NotificationManager userId={caregiver.email} />
        <CaregiverFontSizeProvider>
          <CaregiverStack />
        </CaregiverFontSizeProvider>
      </SafeAreaView>
    );
  } else {
    console.log("No authenticated user - showing auth screens");
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Navigator screenOptions={{ 
          headerShown: false,
          contentStyle: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }
        }}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </Stack.Group>
          <Stack.Group>
            <Stack.Screen name="CaregiverLogin" component={CaregiverLoginScreen} />
            <Stack.Screen name="CaregiverSignup" component={CaregiverSignupScreen} />
            <Stack.Screen name="CaregiverResetPassword" component={CaregiverResetPasswordScreen} />
          </Stack.Group>
        </Stack.Navigator>
      </SafeAreaView>
    );
  }
};

export default function App() {
  // Initialize backend connection
  useEffect(() => {
    const init = async () => {
      try {
        // Set a timeout to ensure we don't wait too long for backend connection
        const connectionPromise = initializeBackendConnection();
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.log("Backend connection timeout reached, continuing with default URL");
            resolve("https://mindflow-backend-1vcl.onrender.com");
          }, 5000); // 5 seconds timeout
        });
        
        // Race between connection and timeout
        const activeUrl = await Promise.race([connectionPromise, timeoutPromise]);
        console.log(`App initialized with backend URL: ${activeUrl}`);
        
        // Initialize speech system but don't wait for it
        try {
          setTimeout(async () => {
            try {
              const speechInitialized = await initSpeech();
              console.log(`Speech system initialized: ${speechInitialized ? 'SUCCESS' : 'FAILED'}`);
            } catch (speechError) {
              console.log('Error suppressed: Error initializing speech system:');
            }
          }, 1000);
        } catch (speechError) {
          console.log('Error suppressed: Error initializing speech system:');
        }
      } catch (error) {
        console.log('Failed to initialize backend connection:', error.message);
        // Continue app initialization even if backend connection fails
      }
    };
    
    init();
  }, []);

  // Run pending profile syncs periodically
  useEffect(() => {
    // Function to process pending profile syncs
    const processPendingSyncs = async () => {
      try {
        console.log('Checking for pending profile syncs to process...');
        const result = await processPendingProfileSyncs();
        if (result.success) {
          if (result.synced > 0) {
            console.log(`Successfully processed ${result.synced} pending profile syncs, ${result.remaining} remaining`);
          } else {
            console.log('No pending profile syncs to process');
          }
        } else {
          console.log('Failed to process pending syncs:', result.error);
        }
        
        // Also try to perform direct device-to-device sync
        await performDirectDeviceSync();
      } catch (error) {
        console.error('Error in processPendingSyncs:', error);
      }
    };
    
    // Function to perform direct device-to-device sync
    const performDirectDeviceSync = async () => {
      try {
        // Check if sync was performed recently to prevent excessive syncs
        const now = Date.now();
        const lastSyncTimeStr = await AsyncStorage.getItem('lastDirectSyncTime');
        const lastSyncTime = lastSyncTimeStr ? parseInt(lastSyncTimeStr, 10) : 0;
        const timeSinceLastSync = now - lastSyncTime;
        
        // Only sync if it's been at least 2 minutes since the last sync
        if (timeSinceLastSync < 120000) { // 2 minutes
          console.log(`Skipping direct device-to-device sync - last sync was ${Math.floor(timeSinceLastSync/1000)}s ago`);
          return;
        }
        
        console.log('Attempting direct device-to-device profile sync...');
        
        // Update the last sync time
        await AsyncStorage.setItem('lastDirectSyncTime', now.toString());
        
        // Check if we have a user logged in
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          try {
            const user = JSON.parse(userData);
            if (user && user.email && user.caregiverEmail) {
              console.log(`User ${user.email} has caregiver ${user.caregiverEmail}, attempting direct sync`);
              
              // Perform direct sync between user and caregiver
              const result = await shareProfileDataDirectly(user.email, user.caregiverEmail);
              
              if (result.success) {
                console.log('Direct device-to-device sync successful');
              } else {
                console.log('Direct sync failed:', result.error);
              }
            } else {
              console.log('No caregiver associated with this user, skipping direct sync');
            }
          } catch (parseError) {
            console.log('Error parsing user data:', parseError.message);
          }
        }
        
        // Check if we have a caregiver logged in with patients
        const caregiverData = await AsyncStorage.getItem('caregiverData');
        if (caregiverData) {
          try {
            const caregiver = JSON.parse(caregiverData);
            if (caregiver && caregiver.email) {
              console.log(`Checking caregiver ${caregiver.email} for patient connections`);
              
              // Get the caregiver's patient map
              const patientKey = `caregiver_${caregiver.email.toLowerCase().trim()}`;
              const caregiverPatientsMapStr = await AsyncStorage.getItem('caregiverPatientsMap');
              
              if (caregiverPatientsMapStr) {
                try {
                  const mappings = JSON.parse(caregiverPatientsMapStr);
                  const patientEmails = mappings[patientKey] || [];
                  
                  console.log(`Found ${patientEmails.length} patients for caregiver`);
                  
                  // Process each patient
                  for (const patientEmail of patientEmails) {
                    console.log(`Performing caregiver->patient sync for patient: ${patientEmail}`);
                    
                    // Get caregiver's current profile and share it with the patient
                    try {
                      // Since we're a caregiver syncing with patient, just update the mappings
                      // to ensure the connection is maintained
                      mappings[patientEmail] = caregiver.email;
                      await AsyncStorage.setItem('caregiverPatientsMap', JSON.stringify(mappings));
                      console.log(`Updated caregiver-patient mapping for: ${patientEmail}`);
                    } catch (syncError) {
                      console.log(`Error syncing with patient ${patientEmail}:`, syncError.message);
                    }
                  }
                } catch (parseError) {
                  console.log('Error parsing caregiver patients map:', parseError.message);
                }
              }
            }
          } catch (parseError) {
            console.log('Error parsing caregiver data:', parseError.message);
          }
        }
      } catch (error) {
        console.log('Error in direct device sync:', error.message);
      }
    };

    // Process syncs on app start
    processPendingSyncs();
    
    // Set up interval to process syncs periodically (every 60 seconds instead of 15)
    const intervalId = setInterval(processPendingSyncs, 60000);
    
    // Also process syncs when app comes to foreground, but with a delay to let the UI load first
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('App came to foreground, scheduling pending syncs');
        // Delay sync to allow UI to initialize first
        setTimeout(() => {
          processPendingSyncs();
        }, 5000);
      }
    });
    
    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, []);

  // Add a navigation state listener to track screen changes
  useEffect(() => {
    // Track app state for screen time tracking when app goes to background
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      // Use the new handler for app state changes
      ActivityTracker.handleAppStateChange(nextAppState);
    });
    
    // Set up StatusBar configuration
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#ffffff');
      StatusBar.setBarStyle('dark-content');
      StatusBar.setTranslucent(true);
    }
    
    const unsubscribe = navigationRef.addListener('state', (e) => {
      const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
      if (currentRouteName) {
        // Track screen changes using ActivityTracker
        ActivityTracker.trackScreenVisit(currentRouteName);
      }
    });
    
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  console.log('Rendering AppContent with FontSizeProvider');

  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <UserProvider>
        <CaregiverProvider>
            <FontSizeProvider>
              <ReminderProvider>
                <MemoriesProvider>
                  <EmergencyContactsProvider>
                    <FamilyProvider>
                      <NavigationContainer ref={navigationRef} linking={linking}>
                        <Stack.Navigator>
                          <Stack.Screen name="AppContent" component={AppContent} options={{ headerShown: false }} />
                        </Stack.Navigator>
                      </NavigationContainer>
                    </FamilyProvider>
                  </EmergencyContactsProvider>
                </MemoriesProvider>
              </ReminderProvider>
            </FontSizeProvider>
        </CaregiverProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}