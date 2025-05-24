import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Alert, 
  Linking,
  ActivityIndicator,
  Platform,
  Image
} from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useCaregiver } from '../../CaregiverContext';
import { useFontSize } from './CaregiverFontSizeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck } from '../../utils/SpeechManager';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { getCurrentLocation } from '../../utils/LocationUtils';

const { width, height } = Dimensions.get('window');
const SAFE_RADIUS = 500; // Real-world radius in meters

const CaregiverMapScreen = () => {
  const { caregiver, activePatient, setActivePatient } = useCaregiver();
  const { fontSize } = useFontSize();
  const [patientLocation, setPatientLocation] = useState(null);
  const [patientHomeLocation, setPatientHomeLocation] = useState(null);
  const [caregiverLocation, setCaregiverLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [voiceAssistanceEnabled, setVoiceAssistanceEnabled] = useState(true);
  const navigation = useNavigation();

  // Load voice assistance setting
  useEffect(() => {
    const loadVoiceAssistanceSetting = async () => {
      try {
        const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
        setVoiceAssistanceEnabled(storedVoiceAssistance === 'true');
        console.log("Voice assistance is", storedVoiceAssistance === 'true' ? "enabled" : "disabled");
      } catch (error) {
        console.error('Error loading voice assistance setting:', error);
      }
    };
    
    loadVoiceAssistanceSetting();
  }, []);

  const calculateDistance = (loc1, loc2) => {
    if (!loc1 || !loc2) return null;
    
    const toRad = (x) => x * Math.PI / 180;
    const R = 6371e3;
    const lat1 = loc1.latitude;
    const lat2 = loc2.latitude;
    const deltaLat = toRad(lat2 - lat1);
    const deltaLon = toRad(loc2.longitude - loc1.longitude);
    const a = Math.sin(deltaLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Try to get patient data from cache first for instant display
  const loadCachedPatientData = useCallback(async () => {
    try {
      if (!activePatient?.email) return false;
      
      const patientEmail = activePatient.email.toLowerCase().trim();
      
      // Try to get cached patient home location
      const userDataKey = `userData_${patientEmail}`;
      const userData = await AsyncStorage.getItem(userDataKey);
      let foundHomeLocation = false;
      
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        if (parsedUserData.homeLocation) {
          console.log("Found cached home location for patient:", patientEmail);
          const homeLocation = {
            latitude: parseFloat(parsedUserData.homeLocation.latitude),
            longitude: parseFloat(parsedUserData.homeLocation.longitude),
            address: parsedUserData.homeLocation.address || "No address available",
            setByCaregiver: parsedUserData.homeLocation.setByCaregiver || false
          };
          setPatientHomeLocation(homeLocation);
          foundHomeLocation = true;
        }
      }
      
      // Try to get cached patient current location
      const patientCurrentLocKey = `currentLocation_${patientEmail}`;
      const storedLocation = await AsyncStorage.getItem(patientCurrentLocKey);
      let foundCurrentLocation = false;
      
      if (storedLocation) {
        try {
          const parsedLocation = JSON.parse(storedLocation);
          console.log("Found cached current location for patient:", patientEmail);
          
          if (parsedLocation && parsedLocation.latitude && parsedLocation.longitude) {
            setPatientLocation(parsedLocation);
            foundCurrentLocation = true;
            
            // If we also have home location, calculate initial distance
            if (foundHomeLocation) {
              const initialDistance = calculateDistance(parsedLocation, patientHomeLocation);
              if (initialDistance !== null) {
                setDistance(initialDistance);
              }
            }
          }
        } catch (parseError) {
          console.error("Error parsing patient's stored location:", parseError);
        }
      }
      
      // Also try to get cached caregiver location
      const cachedLocationString = await AsyncStorage.getItem('lastKnownLocation');
      if (cachedLocationString) {
        const cachedLocation = JSON.parse(cachedLocationString);
        console.log('Using cached location for caregiver');
        setCaregiverLocation(cachedLocation);
      }
      
      return foundHomeLocation || foundCurrentLocation;
    } catch (error) {
      console.log('Error loading cached patient data:', error);
      return false;
    }
  }, [activePatient]);
  
  // Fetch patient's home location from AsyncStorage
  const fetchPatientHomeLocation = async () => {
    try {
      if (!activePatient?.email) {
        console.log("No active patient selected");
        return;
      }
      
      const patientEmail = activePatient.email.toLowerCase().trim();
      
      // Get the patient's user data from AsyncStorage
      const userDataKey = `userData_${patientEmail}`;
      const userData = await AsyncStorage.getItem(userDataKey);
      
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        if (parsedUserData.homeLocation) {
          console.log("Found home location for patient:", patientEmail);
          const homeLocation = {
            latitude: parseFloat(parsedUserData.homeLocation.latitude),
            longitude: parseFloat(parsedUserData.homeLocation.longitude),
            address: parsedUserData.homeLocation.address || "No address available",
            setByCaregiver: parsedUserData.homeLocation.setByCaregiver || false
          };
          setPatientHomeLocation(homeLocation);
        } else {
          console.log("No home location set for patient:", patientEmail);
        }
      } else {
        console.log("No user data found for patient:", patientEmail);
      }
    } catch (error) {
      console.error("Error fetching patient's home location:", error);
    }
  };

  // Get caregiver's current location
  const fetchCaregiverLocation = async () => {
    try {
      const userLocation = await getCurrentLocation();
      if (userLocation) {
        setCaregiverLocation(userLocation);
        console.log("Set caregiver's current location");
      } else {
        console.log("Failed to get caregiver's location");
      }
    } catch (error) {
      console.error("Error fetching caregiver's location:", error);
    }
  };

  // Fetch patient's current location
  const fetchPatientCurrentLocation = async () => {
    try {
      if (!activePatient?.email) {
        console.log("No active patient selected");
        return;
      }

      const patientEmail = activePatient.email.toLowerCase().trim();
      
      const patientCurrentLocKey = `currentLocation_${patientEmail}`;
      const storedLocation = await AsyncStorage.getItem(patientCurrentLocKey);
      
      if (storedLocation) {
        try {
          const parsedLocation = JSON.parse(storedLocation);
          console.log("Found stored current location for patient:", patientEmail);
          
          if (parsedLocation && parsedLocation.latitude && parsedLocation.longitude) {
            setPatientLocation(parsedLocation);
            return;
          }
        } catch (parseError) {
          console.error("Error parsing patient's stored location:", parseError);
        }
      }
      
      const userDataKey = `userData_${patientEmail}`;
      const userData = await AsyncStorage.getItem(userDataKey);
      
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        if (parsedUserData.lastKnownLocation) {
          console.log("Using lastKnownLocation for patient:", patientEmail);
          setPatientLocation(parsedUserData.lastKnownLocation);
          return;
        }
      }

      console.log("No real location data found for patient, using simulation");
      Alert.alert(
        "Demo Mode",
        "Using simulated patient location. In a real app, this would use the patient's actual GPS data.",
        [{ text: "OK" }]
      );
      
      let location = await Location.getCurrentPositionAsync({});
      
      const randomDistance = Math.random() * 0.004 + 0.001;
      const randomAngle = Math.random() * 2 * Math.PI;
      
      const currentLocation = {
        latitude: location.coords.latitude + (randomDistance * Math.cos(randomAngle)),
        longitude: location.coords.longitude + (randomDistance * Math.sin(randomAngle)),
        timestamp: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(patientCurrentLocKey, JSON.stringify(currentLocation));
      
      setPatientLocation(currentLocation);
      console.log("Set simulated patient location");
      
      const patientData = userData ? JSON.parse(userData) : {};
      patientData.lastAccessedBy = caregiver?.email;
      patientData.lastAccessTime = new Date().toISOString();
      if (caregiverLocation) {
        patientData.lastAccessLocation = caregiverLocation;
      }
      await AsyncStorage.setItem(userDataKey, JSON.stringify(patientData));
      
    } catch (error) {
      console.error("Error fetching patient's current location:", error);
      Alert.alert(
        "Location Error",
        "Could not retrieve patient's location. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const loadFullLocationData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const deepLinkPatientEmail = await AsyncStorage.getItem('deepLinkPatientEmail');
      if (deepLinkPatientEmail) {
        console.log('Deep link patient email found:', deepLinkPatientEmail);
        
        const patientMatch = caregiver?.patients?.find(
          p => p.email?.toLowerCase() === deepLinkPatientEmail.toLowerCase()
        );
        
        if (patientMatch) {
          setActivePatient(patientMatch);
          console.log('Setting active patient from deep link:', patientMatch.name || patientMatch.email);
        } else {
          console.log('Patient from deep link not found in caregiver patients list');
        }
        
        await AsyncStorage.removeItem('deepLinkPatientEmail');
      }
      
      await Promise.all([
        fetchCaregiverLocation(),
        fetchPatientHomeLocation(),
        fetchPatientCurrentLocation()
      ]);
      
      setInitialLoadComplete(true);
    } catch (error) {
      console.error('Error loading location data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activePatient]);

  useEffect(() => {
    const initializeScreen = async () => {
      setHasSpoken(false);
      
      const foundCachedData = await loadCachedPatientData();
      
      loadFullLocationData();
    };
    
    initializeScreen();
  }, [activePatient, loadCachedPatientData, loadFullLocationData]);

  useEffect(() => {
    if (patientLocation && patientHomeLocation) {
      const dist = calculateDistance(patientHomeLocation, patientLocation);
      setDistance(dist);
    }
  }, [patientLocation, patientHomeLocation]);

  useEffect(() => {
    if (distance !== null && !hasSpoken && activePatient && initialLoadComplete) {
      const roundedDistance = Math.round(distance);
      const isOutOfRange = distance > SAFE_RADIUS;
      const caregiverName = caregiver?.name || "Caregiver";
      const patientName = activePatient?.name || "Patient";
      
      let message = "";
      
      if (distance < 50) {
        message = `Hey ${caregiverName}, ${patientName} is at home and safe.`;
      } else if (isOutOfRange) {
        message = `Hey ${caregiverName}, ${patientName} is ${roundedDistance} meters away from home which is outside the safe area. Click get directions to reach ${patientName}.`;
      } else {
        message = `Hey ${caregiverName}, ${patientName} is ${roundedDistance} meters away from home which is within the safe area.`;
      }
      
      if (voiceAssistanceEnabled) {
        speakWithVoiceCheck(message, true, true);
      }
      setHasSpoken(true);
    }
  }, [distance, activePatient, caregiver, hasSpoken, initialLoadComplete, voiceAssistanceEnabled]);

  useEffect(() => {
    return () => {
      stopSpeech();
      console.log("Stopping speech as caregiver is leaving map screen");
    };
  }, []);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', () => {
      stopSpeech();
      console.log("Stopping speech as caregiver is navigating away from map screen");
    });

    return unsubscribeBlur;
  }, [navigation]);

  const getDirections = () => {
    if (!patientLocation) {
      Alert.alert('Error', 'Patient location data is missing');
      return;
    }
    
    if (!caregiverLocation) {
      Alert.alert('Error', 'Your location data is missing. Please enable location services.');
      return;
    }
    
    const origin = `${caregiverLocation.latitude},${caregiverLocation.longitude}`;
    const destination = `${patientLocation.latitude},${patientLocation.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    Linking.openURL(url).catch(err => Alert.alert('Error', 'Failed to open maps'));
    
    const patientName = activePatient?.name || "Patient";
    speakWithVoiceCheck(`Opening directions to reach ${patientName}'s current location.`, true, true);
  };

  const getPatientStatusMessage = () => {
    if (!activePatient) {
      return "Please select an active patient to view their location.";
    }
    
    if (!distance) {
      return `Location data for ${activePatient.name || activePatient.email} is incomplete.`;
    }
    
    const roundedDistance = Math.round(distance);
    const isOutOfRange = distance > SAFE_RADIUS;
    const patientName = activePatient.name || "Patient";
    
    if (distance < 50) {
      return `${patientName} is at home.`;
    } else {
      return isOutOfRange 
        ? `${patientName} is ${roundedDistance} meters away from home which is outside the safe area.` 
        : `${patientName} is ${roundedDistance} meters away from home, within the safe area.`;
    }
  };

  const getButtonText = () => {
    if (distance === null || distance === undefined) {
      return "Get Directions to Patient";
    }
    
    return `Get Directions to ${activePatient?.name || "Patient"}`;
  };

  const handleSetPatientHomeLocation = async () => {
    if (!activePatient?.email) {
      Alert.alert('Error', 'No active patient selected');
      return;
    }

    navigation.navigate('CaregiverSetHomeLocation', {
      currentLocation: patientHomeLocation,
      isUserSetLocation: false,
      returnScreen: 'CaregiverMap',
      onLocationSelect: async (location) => {
        try {
          const patientEmail = activePatient.email.toLowerCase().trim();
          const userDataKey = `userData_${patientEmail}`;
          let userData = await AsyncStorage.getItem(userDataKey);
          let patientData = userData ? JSON.parse(userData) : {};
          
          patientData.homeLocation = {
            ...location,
            setByCaregiver: true,
            timestamp: new Date().toISOString()
          };
          
          await AsyncStorage.setItem(userDataKey, JSON.stringify(patientData));
          
          try {
            const notificationsKey = `notifications_${patientEmail}`;
            const existingNotifications = await AsyncStorage.getItem(notificationsKey);
            const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
            
            notifications.unshift({
              id: Date.now().toString(),
              title: 'Home Location Updated',
              message: `Your caregiver (${caregiver.name || 'Your caregiver'}) has updated your home location.`,
              type: 'info',
              read: false,
              timestamp: new Date().toISOString()
            });
            
            await AsyncStorage.setItem(notificationsKey, JSON.stringify(notifications));
            console.log('Added notification for patient about home location update');
          } catch (notificationError) {
            console.error('Error creating notification:', notificationError);
          }
          
          setPatientHomeLocation(location);
          
          Alert.alert(
            'Success',
            `Home location for ${activePatient.name || activePatient.email} has been ${patientHomeLocation ? 'updated' : 'set'}.`
          );
          
          setIsLoading(true);
          await fetchPatientHomeLocation();
          setIsLoading(false);
        } catch (error) {
          console.error('Error setting patient home location:', error);
          Alert.alert('Error', 'Failed to set patient home location.');
        }
      }
    });
  };

  if (!activePatient) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="person-search" size={60} color="#999" />
          <Text style={[styles.noLocationTitle, { fontSize: fontSize + 2 }]}>No active patient selected</Text>
          <Text style={[styles.noLocationSubtitle, { fontSize }]}>Please select a patient from the patients screen</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.contentContainer}>
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <MaterialIcons name="home" size={32} color="#005BBB" />
            <Text style={styles.locationTitle}>
              {activePatient ? activePatient.name || activePatient.email : "No active patient selected"}
            </Text>
          </View>
          
          {patientLocation && patientHomeLocation && (
            <View style={styles.mapVisualization}>
              <View style={styles.personIconContainer}>
                <Text style={styles.iconLabel}>
                  {activePatient?.name || "Patient"}
                </Text>
                <MaterialIcons name="person-pin" size={40} color="#4CAF50" />
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
          )}
          
          {isLoading && (!patientLocation || !patientHomeLocation) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#005BBB" />
              <Text style={styles.loadingText}>Loading location data...</Text>
            </View>
          )}
          
          {distance !== null && (
            <View style={[styles.safetyMessageContainer, { 
              backgroundColor: distance < 50 ? '#e0f7fa' : distance < SAFE_RADIUS ? '#e6f7e6' : '#ffebeb' 
            }]}>
              <MaterialIcons 
                name={distance < 50 ? "home" : distance < SAFE_RADIUS ? "check-circle" : "warning"} 
                size={24} 
                color={distance < 50 ? "#00BCD4" : distance < SAFE_RADIUS ? "#4CAF50" : "#FF5252"} 
              />
              <Text style={[styles.safetyMessage, { fontSize }]}>
                {getPatientStatusMessage()}
              </Text>
            </View>
          )}
          
          {activePatient && (
            <View style={styles.homeLocationActionContainer}>
              {patientHomeLocation ? (
                <View style={styles.homeLocationCard}>
                  <View style={styles.homeLocationInfo}>
                    <MaterialIcons name="home" size={24} color="#005BBB" />
                    <View>
                      <Text style={styles.homeLocationText}>
                        Patient home location is set
                      </Text>
                      <Text style={styles.homeLocationSourceText}>
                        {patientHomeLocation.setByCaregiver 
                          ? 'This location was set by you (caregiver)'
                          : 'This location was set by the patient'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.homeLocationButton}
                    onPress={handleSetPatientHomeLocation}
                  >
                    <Text style={styles.homeLocationButtonText}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.homeLocationCard}>
                  <View style={styles.homeLocationInfo}>
                    <MaterialIcons name="warning" size={24} color="#FFC107" />
                    <Text style={styles.homeLocationWarningText}>
                      No home location set for this patient
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.homeLocationButton}
                    onPress={handleSetPatientHomeLocation}
                  >
                    <Text style={styles.homeLocationButtonText}>
                      Set Home Location
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.mapButton} 
            onPress={getDirections}
            disabled={!patientLocation}
          >
            <MaterialIcons name="directions" size={20} color="#FFF" />
            <Text style={styles.mapButtonText}>{getButtonText()}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info-outline" size={24} color="#555" />
            <Text style={styles.infoTitle}>About Safe Area</Text>
          </View>
          
          <Text style={styles.infoText}>
            The patient's home location is set as a safe place. 
            The safe radius is {SAFE_RADIUS} meters around their home.
          </Text>
        </View>
      </View>
        
      {activePatient && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={handleSetPatientHomeLocation}
        >
          <MaterialIcons name="home" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>
            {patientHomeLocation ? 'Update Home' : 'Set Home'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: "#F0F4F8" 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#2C3E50"
  },
  noLocationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  noLocationSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
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
  homeLocationActionContainer: {
    marginBottom: 15,
  },
  homeLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
  },
  homeLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  homeLocationText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  homeLocationWarningText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#FFC107',
    fontWeight: 'bold',
  },
  homeLocationSourceText: {
    marginLeft: 10,
    fontSize: 12,
    color: '#777',
  },
  homeLocationButton: {
    backgroundColor: '#005BBB',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  homeLocationButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mapButton: {
    backgroundColor: '#005BBB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
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
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#005BBB',
    borderRadius: 30,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: 'bold',
  },
});

export default CaregiverMapScreen;
