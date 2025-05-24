import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache the last known location to show immediately while fetching a new one
let cachedLocation = null;

export const getCurrentLocation = async () => {
  try {
    // First check if we already have permission to avoid the permission request dialog
    const permissionStatus = await Location.getForegroundPermissionsAsync();
    if (permissionStatus.granted) {
      console.log('Location permission already granted');
    } else {
      console.log('Getting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied:', status);
        Alert.alert('Permission Denied', 'Location permission is required to fetch the current location.');
        return null;
      }
      console.log('Location permission granted');
    }
    
    // Try to get cached location from AsyncStorage first for immediate response
    try {
      if (!cachedLocation) {
        const cachedLocationString = await AsyncStorage.getItem('lastKnownLocation');
        if (cachedLocationString) {
          cachedLocation = JSON.parse(cachedLocationString);
          console.log('Using cached location while fetching current location');
          
          // Return cached location immediately (if it's not too old)
          const cachedTime = await AsyncStorage.getItem('lastLocationTime');
          if (cachedTime) {
            const timeDiff = Date.now() - parseInt(cachedTime);
            // If cached location is less than 5 minutes old, use it immediately
            if (timeDiff < 300000) {
              // Start getting a fresh location in the background
              fetchFreshLocationInBackground();
              return cachedLocation;
            }
          }
        }
      } else {
        // We have an in-memory cached location, use it while fetching in background
        console.log('Using in-memory cached location while fetching fresh location');
        fetchFreshLocationInBackground();
        return cachedLocation;
      }
    } catch (cacheError) {
      console.log('Error reading cached location:', cacheError);
      // Continue with normal location fetch
    }
    
    // Get current location with a faster timeout and lower accuracy for speed
    console.log('Getting current position with balanced accuracy...');
    
    // Use a faster accuracy setting on Android
    const accuracySetting = Platform.OS === 'android' 
      ? Location.Accuracy.Balanced 
      : Location.Accuracy.Balanced;
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: accuracySetting,
      maximumAge: 30000, // Accept locations that are at most 30 seconds old
      timeout: 3000 // Wait up to 3 seconds to get location (faster timeout)
    });
    
    if (!location || !location.coords) {
      console.log('Failed to get location coordinates:', location);
      return cachedLocation || null; // Return cached location as fallback
    }
    
    console.log('Got fresh location coordinates:', 
      location.coords.latitude, 
      location.coords.longitude
    );
    
    // Update cached location
    const newLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    // Store in memory and AsyncStorage
    cachedLocation = newLocation;
    AsyncStorage.setItem('lastKnownLocation', JSON.stringify(newLocation));
    AsyncStorage.setItem('lastLocationTime', Date.now().toString());
    
    return newLocation;
  } catch (error) {
    console.error('Error fetching location:', error);
    // Return cached location as fallback if available
    if (cachedLocation) {
      console.log('Returning cached location due to error');
      return cachedLocation;
    }
    
    Alert.alert('Error', 'Unable to fetch the current location.');
    return null;
  }
};

// Fetch a fresh location in the background without blocking the UI
const fetchFreshLocationInBackground = async () => {
  try {
    console.log('Fetching fresh location in background...');
    
    // Use high accuracy for background fetch to get more precise location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      maximumAge: 0, // Get a fresh location
      timeout: 10000 // Give it more time in the background
    });
    
    if (location && location.coords) {
      console.log('Background location fetch successful');
      
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      // Update cached location
      cachedLocation = newLocation;
      AsyncStorage.setItem('lastKnownLocation', JSON.stringify(newLocation));
      AsyncStorage.setItem('lastLocationTime', Date.now().toString());
    }
  } catch (error) {
    console.log('Background location fetch error:', error);
    // Silently fail - this is just a background refresh
  }
};