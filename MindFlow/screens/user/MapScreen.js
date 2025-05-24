import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUser } from '../../UserContext';
import Svg, { Line, Polygon } from 'react-native-svg';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { speakWithVoiceCheck, stopSpeech } from '../../utils/SpeechManager';
import { 
  calculateDistance as calculateLocationDistance, 
  isOutsideSafeZone, 
  getConnectedCaregiver, 
  sendLocationAlertEmail 
} from '../../utils/LocationService';
import { getCurrentLocation } from '../../utils/LocationUtils';

const { width, height } = Dimensions.get('window');
const SAFE_DISTANCE = 500; // in meters

// Use the distance calculation from the LocationService
const calculateDistance = calculateLocationDistance;

const MapScreen = () => {
  const { currentUser, updateUser } = useUser();
  const [homeLocation, setHomeLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Immediately set home location from currentUser if available
  useEffect(() => {
    // Try to load home location from multiple sources
    const loadHomeLocation = async () => {
      try {
        // Priority 1: Check currentUser.homeLocation (from UserContext)
        if (currentUser?.homeLocation) {
          console.log('Found home location in currentUser');
          setHomeLocation(currentUser.homeLocation);
        } 
        // Priority 2: Check for a dedicated home location key
        else if (currentUser?.email) {
          const userEmail = currentUser.email.toLowerCase().trim();
          const homeLocationKey = `homeLocation_${userEmail}`;
          const storedHomeLocation = await AsyncStorage.getItem(homeLocationKey);
          
          if (storedHomeLocation) {
            try {
              const parsedLocation = JSON.parse(storedHomeLocation);
              console.log('Found home location in dedicated storage key');
              setHomeLocation(parsedLocation);
              
              // Also update the user context to keep everything in sync
              // Note: This is optional since the data is already displayed
              if (typeof updateUser === 'function') {
                const updatedUser = { ...currentUser, homeLocation: parsedLocation };
                updateUser(updatedUser).catch(err => 
                  console.error('Error updating user with home location:', err)
                );
              }
            } catch (parseError) {
              console.error('Error parsing stored home location:', parseError);
            }
          }
        }
        
        // Check if home location is missing, but this user has a caregiver
        if (!homeLocation && currentUser?.email) {
          const userEmail = currentUser.email.toLowerCase().trim();
          
          // Check caregiverPatientsMap for caregiver connection
          const caregiverPatientsMap = await AsyncStorage.getItem('caregiverPatientsMap') || '{}';
          const mappings = JSON.parse(caregiverPatientsMap);
          const caregiverEmail = mappings[userEmail];
          
          if (caregiverEmail) {
            console.log(`User has caregiver ${caregiverEmail}, checking for home location`);
            
            // Check for patient-specific home location set by caregiver
            const caregiverPatientLocationKey = `patientHomeLocation_${caregiverEmail}_${userEmail}`;
            const caregiverPatientLocationData = await AsyncStorage.getItem(caregiverPatientLocationKey);
            
            if (caregiverPatientLocationData) {
              try {
                const parsedLocation = JSON.parse(caregiverPatientLocationData);
                console.log('Found home location set by caregiver');
                setHomeLocation(parsedLocation);
                
                // Save to user's data for future use
                if (typeof updateUser === 'function') {
                  const updatedUser = { ...currentUser, homeLocation: parsedLocation };
                  updateUser(updatedUser).catch(err => 
                    console.error('Error updating user with caregiver home location:', err)
                  );
                }
                
                // Also save to dedicated key
                await AsyncStorage.setItem(`homeLocation_${userEmail}`, caregiverPatientLocationData);
              } catch (parseError) {
                console.error('Error parsing caregiver home location:', parseError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading home location:', error);
      }
    };
    
    loadHomeLocation();
    
    // Try to get cached current location from AsyncStorage for immediate display
    const getCachedLocation = async () => {
      try {
        const cachedLocationString = await AsyncStorage.getItem('lastKnownLocation');
        if (cachedLocationString) {
          const cachedLocation = JSON.parse(cachedLocationString);
          console.log('Using cached location for initial display');
          setCurrentLocation(cachedLocation);
          setIsLoading(false);
          
          // If we also have home location, calculate initial distance
          if (homeLocation && cachedLocation) {
            const initialDistance = calculateDistance(
              cachedLocation.latitude, 
              cachedLocation.longitude, 
              homeLocation.latitude, 
              homeLocation.longitude
            );
            setDistance(initialDistance);
          }
        }
      } catch (error) {
        console.log('Error loading cached location:', error);
      }
    };
    
    getCachedLocation();
  }, [currentUser]);

  // Load voice assistance setting
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        setVoiceEnabled(storedVoiceSetting === 'true');
      } catch (error) {
        console.error('Error loading voice settings:', error);
      }
    };
    
    loadVoiceSettings();
  }, []);

  // Check if location alert has been sent today to avoid sending duplicates
  useEffect(() => {
    const checkAlertStatus = async () => {
      if (currentUser?.email) {
        const alertKey = `locationAlert_${currentUser.email}_${new Date().toISOString().split('T')[0]}`;
        const lastAlertTime = await AsyncStorage.getItem(alertKey);
        if (lastAlertTime) {
          setAlertSent(true);
        } else {
          setAlertSent(false);
        }
      }
    };
    
    checkAlertStatus();
  }, [currentUser]);

  // Get user's location in the background
  const loadLocationData = useCallback(async () => {
    try {
      // Use our optimized location utility to get location without delay
      const userLocation = await getCurrentLocation();
      
      if (userLocation) {
        setCurrentLocation(userLocation);
        setIsLoading(false);
        
        // Log user's current location details when MapScreen opens
        console.log('======= USER LOCATION DETAILS =======');
        console.log(`User: ${currentUser?.name || 'Unknown User'} (${currentUser?.email || 'No email'})`);
        console.log(`Current location: Lat ${userLocation.latitude}, Lng ${userLocation.longitude}`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        
        if (currentUser?.homeLocation) {
          const distanceFromHome = calculateDistance(
            userLocation.latitude, 
            userLocation.longitude, 
            currentUser.homeLocation.latitude, 
            currentUser.homeLocation.longitude
          );
          console.log(`Distance from home: ${distanceFromHome} meters`);
          console.log(`Home location: Lat ${currentUser.homeLocation.latitude}, Lng ${currentUser.homeLocation.longitude}`);
          console.log(`Inside safe zone: ${distanceFromHome <= SAFE_DISTANCE ? 'YES' : 'NO'}`);
          
          setDistance(distanceFromHome);
        } else {
          console.log('Home location not set');
        }
        console.log('======= END USER LOCATION DETAILS =======');
        
        // Save current location to AsyncStorage for caregiver access
        if (currentUser?.email) {
          const userEmail = currentUser.email.toLowerCase().trim();
          await AsyncStorage.setItem(`currentLocation_${userEmail}`, JSON.stringify({
            ...userLocation,
            timestamp: new Date().toISOString()
          }));
          console.log('Saved current location to AsyncStorage for caregiver access');
        }
      } else {
        // If getCurrentLocation() failed but we previously set currentLocation from cache,
        // we don't need to show an error or loading state
        if (!currentLocation) {
          setLocationError('Could not determine your location');
          setIsLoading(false);
        }
      }
    } catch (error) {
      if (!currentLocation) {
        setLocationError('Could not determine your location');
        setIsLoading(false);
      }
      console.error('Error getting user location:', error);
    }
  }, [currentUser, currentLocation]);

  useEffect(() => {
    // Immediately start loading location data in the background
    loadLocationData();

    // Cleanup speech when unmounting
    return () => {
      stopSpeech();
    };
  }, [loadLocationData]);

  // Send alert to caregiver if user is outside safe zone
  useEffect(() => {
    const sendAlertToCaregiver = async () => {
      if (!homeLocation || !currentLocation || !currentUser || alertSent) {
        console.log("Not sending alert to caregiver: Missing data or alert already sent");
        console.log(`Home location: ${homeLocation ? 'Set' : 'Not Set'}`);
        console.log(`Current location: ${currentLocation ? 'Set' : 'Not Set'}`);
        console.log(`Current user: ${currentUser ? 'Set' : 'Not Set'}`);
        console.log(`Alert already sent today: ${alertSent ? 'Yes' : 'No'}`);
        return;
      }
      
      if (distance > SAFE_DISTANCE) {
        try {
          console.log('User is outside safe zone, checking for connected caregiver...');
          console.log(`Current user: ${currentUser.name || currentUser.email}`);
          console.log(`Distance from home: ${distance} meters (Safe limit: ${SAFE_DISTANCE} meters)`);
          
          if (currentUser.caregiverEmail) {
            console.log(`User has caregiver email in profile: ${currentUser.caregiverEmail}`);
          } else {
            console.log('No caregiver email found in user profile, will attempt to find from other sources');
          }
          
          const caregiver = await getConnectedCaregiver(currentUser);
          
          if (caregiver) {
            console.log(`Found caregiver: ${caregiver.name || caregiver.email}`);
            
            const alertSuccess = await sendLocationAlertEmail(
              currentUser,
              caregiver,
              distance,
              currentLocation
            );
            
            if (alertSuccess) {
              console.log('Successfully sent location alert to caregiver');
              setAlertSent(true);
            } else {
              console.error('Failed to send location alert to caregiver');
            }
          } else {
            console.log('No caregiver information found after all lookup attempts');
          }
        } catch (error) {
          console.error('Error sending alert to caregiver:', error);
        }
      } else {
        console.log(`User is within safe zone: ${distance} meters from home`);
      }
    };
    
    if (distance !== null) {
      console.log(`Distance updated: ${distance} meters from home. Checking if alert needed...`);
      sendAlertToCaregiver();
    }
  }, [distance, currentUser, homeLocation, currentLocation, alertSent]);

  useEffect(() => {
    if (distance !== null && voiceEnabled) {
      let speechText;
      
      if (distance <= 20) {
        speechText = `Hey ${currentUser?.name || 'User'}, you are at home.`;
      } else if (distance <= SAFE_DISTANCE) {
        speechText = `Hey ${currentUser?.name || 'User'}, you are ${distance} meters away from home which is in safe area. Please click on Go Home to reach home safely.`;
      } else {
        speechText = `Hey ${currentUser?.name || 'User'}, you are ${distance} meters away from home which is out of safe. Please click on Go Home to reach home safely.`;
      }
      
      speakWithVoiceCheck(speechText, voiceEnabled, true);
    }
  }, [distance, voiceEnabled, currentUser?.name]);

  const navigateToHome = () => {
    if (!homeLocation) return;
    
    const { latitude, longitude } = homeLocation;
    const url = Platform.select({
      ios: `maps://app?saddr=Current+Location&daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`
    });
    
    Linking.openURL(url).catch(err => 
      console.error('Error opening maps', err)
    );
  };

  if (!homeLocation) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom', 'left', 'right']}>
        <MaterialIcons name="location-off" size={60} color="#999" />
        <Text style={styles.noLocationTitle}>No home location set</Text>
        <Text style={styles.noLocationSubtitle}>Please set home location in settings</Text>
      </SafeAreaView>
    );
  }

  if (locationError) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom', 'left', 'right']}>
        <MaterialIcons name="location-off" size={60} color="#999" />
        <Text style={styles.noLocationTitle}>Location Error</Text>
        <Text style={styles.noLocationSubtitle}>{locationError}</Text>
      </SafeAreaView>
    );
  }

  if (!currentLocation && isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom', 'left', 'right']}>
        <MaterialIcons name="location-searching" size={60} color="#999" />
        <Text style={styles.noLocationTitle}>Getting your location</Text>
        <Text style={styles.noLocationSubtitle}>Please wait</Text>
      </SafeAreaView>
    );
  }

  const isInSafeZone = distance ? distance <= SAFE_DISTANCE : null;
  const displayDistance = distance || "Calculating...";
  const isAtHome = distance !== null && distance <= 20;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.contentContainer}>
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <MaterialIcons name="home" size={32} color="#005BBB" />
            <Text style={styles.locationTitle}>Your Home Location</Text>
          </View>
          
          <View style={styles.mapVisualization}>
            <View style={styles.personIconContainer}>
              <Text style={styles.iconLabel}>You</Text>
              <MaterialCommunityIcons name="account" size={40} color="#4CAF50" />
            </View>
            
            <Svg height="100" width="150" style={styles.svgContainer}>
              <Line 
                x1="30" 
                y1="50" 
                x2="120" 
                y2="50" 
                stroke="#777" 
                strokeWidth="2" 
              />
              <Polygon 
                points="120,50 110,45 110,55" 
                fill="#777" 
              />
            </Svg>
            
            <View style={styles.homeIconContainer}>
              <Text style={styles.iconLabel}>Home</Text>
              <MaterialIcons name="home" size={40} color="#005BBB" />
            </View>
          </View>
          
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceLabel}>Distance from home:</Text>
            <Text style={styles.distanceValue}>{displayDistance} {typeof displayDistance === 'number' ? 'meters' : ''}</Text>
          </View>
          
          {distance !== null && (
            <View style={[styles.safetyMessageContainer, { 
              backgroundColor: isAtHome ? '#e0f7fa' : isInSafeZone ? '#e6f7e6' : '#ffebeb' 
            }]}>
              <MaterialIcons 
                name={isAtHome ? "home" : isInSafeZone ? "check-circle" : "warning"} 
                size={24} 
                color={isAtHome ? "#00BCD4" : isInSafeZone ? "#4CAF50" : "#FF5252"} 
              />
              <Text style={styles.safetyMessage}>
                {isAtHome
                  ? `Hey ${currentUser?.name || 'User'}, you are at home.`
                  : isInSafeZone 
                    ? `Hey ${currentUser?.name || 'User'}, you are ${distance} meters away from home which is in safe area. Please click on Go Home to reach home safely.`
                    : `Hey ${currentUser?.name || 'User'}, you are ${distance} meters away from home which is out of safe. Please click on Go Home to reach home safely.`
                }
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.mapButton} 
            onPress={navigateToHome}
          >
            <MaterialIcons name="directions" size={20} color="#FFF" />
            <Text style={styles.mapButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info-outline" size={24} color="#555" />
            <Text style={styles.infoTitle}>About Your Safe Place</Text>
          </View>
          
          <Text style={styles.infoText}>
            Home location is set as safe place.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    padding: 20
  },
  noLocationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#444'
  },
  noLocationSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center'
  },
  contentContainer: {
    flex: 1,
    padding: 15
  },
  locationCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  mapVisualization: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    height: 100,
  },
  personIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
  },
  homeIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
  },
  iconLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#555',
  },
  svgContainer: {
    position: 'absolute',
    left: 40,
    top: 0,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  safetyMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  safetyMessage: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  mapButton: {
    backgroundColor: '#005BBB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  mapButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
});

export default MapScreen;
