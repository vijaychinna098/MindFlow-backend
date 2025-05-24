import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Platform,
  TextInput,
  ScrollView,
  Linking,
  ToastAndroid
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentLocation } from '../../utils/LocationUtils';

// Google Maps Geocoding API Key (same as in the user's SetHomeLocation)
const GOOGLE_MAPS_API_KEY = "AIzaSyDrvWr_RhEky9lKUgeyTxAipD_lhNJqH2s";

const CaregiverSetHomeLocation = ({ route, navigation }) => {
  const { onLocationSelect, currentLocation: existingLocation, isUserSetLocation } = route.params;
  const [selectedLocation, setSelectedLocation] = useState(existingLocation || null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [address, setAddress] = useState(existingLocation?.address || '');
  const [manualAddress, setManualAddress] = useState(existingLocation?.address || '');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [manualLatitude, setManualLatitude] = useState(existingLocation?.latitude?.toString() || '');
  const [manualLongitude, setManualLongitude] = useState(existingLocation?.longitude?.toString() || '');
  const [isEditingCoordinates, setIsEditingCoordinates] = useState(false);
  const [isLocationAlreadySet, setIsLocationAlreadySet] = useState(!!existingLocation);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [googleMapsAvailable, setGoogleMapsAvailable] = useState(true);

  // Debug log function
  const logDebug = (message, data) => {
    console.log(`[CaregiverSetHomeLocation] ${message}`, data || '');
  };

  // Initialize location data asynchronously after component has mounted
  const initializeLocationData = useCallback(async () => {
    try {
      // Check if we already have a location passed in (for edit mode)
      if (existingLocation && existingLocation.latitude && existingLocation.longitude) {
        // We've already set state in the initial useState calls, so just update address if needed
        if (!address && existingLocation.latitude && existingLocation.longitude) {
          await reverseGeocode({
            latitude: existingLocation.latitude,
            longitude: existingLocation.longitude
          });
        }
        setInitializing(false);
        return;
      }

      // Try to get cached location from AsyncStorage for immediate display
      try {
        const cachedLocationString = await AsyncStorage.getItem('lastKnownLocation');
        if (cachedLocationString) {
          const cachedLocation = JSON.parse(cachedLocationString);
          logDebug('Using cached location for initial display');
          setCurrentLocation(cachedLocation);
          
          // If we don't have a selected location yet, use cached as default
          if (!selectedLocation) {
            setSelectedLocation(cachedLocation);
            setManualLatitude(cachedLocation.latitude.toString());
            setManualLongitude(cachedLocation.longitude.toString());
            await reverseGeocode(cachedLocation);
          }
        }
      } catch (error) {
        logDebug('Error loading cached location:', error);
      }

      // Get location permissions and current location in background
      setTimeout(async () => {
        try {
          setLoading(true);
          
          // Use optimized location function
          const userLocation = await getCurrentLocation();
          
          if (userLocation) {
            setCurrentLocation(userLocation);
            
            // Only set as selected location if we don't already have one
            if (!selectedLocation) {
              setSelectedLocation(userLocation);
              setManualLatitude(userLocation.latitude.toString());
              setManualLongitude(userLocation.longitude.toString());
              await reverseGeocode(userLocation);
            }
          }
        } catch (error) {
          logDebug('Error getting location:', error);
        } finally {
          setLoading(false);
          setInitializing(false);
        }
      }, 100); // Small delay to ensure UI renders first
    } catch (error) {
      logDebug('Error in initializeLocationData:', error);
      setInitializing(false);
    }
  }, [existingLocation, selectedLocation, address]);

  useEffect(() => {
    // Start initialization after component has mounted
    initializeLocationData();
  }, [initializeLocationData]);

  const useCurrentLocation = async () => {
    if (!currentLocation) return;
    
    setSelectedLocation(currentLocation);
    setManualLatitude(currentLocation.latitude.toString());
    setManualLongitude(currentLocation.longitude.toString());
    await reverseGeocode(currentLocation);
    
    // Show success feedback
    if (Platform.OS === 'android') {
      ToastAndroid.show('Current location selected', ToastAndroid.SHORT);
    }
  };

  const handleManualCoordinates = async () => {
    try {
      const lat = parseFloat(manualLatitude);
      const lng = parseFloat(manualLongitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        Alert.alert('Invalid Coordinates', 'Please enter valid numeric coordinates.');
        return;
      }
      
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        Alert.alert('Invalid Coordinates', 'Latitude must be between -90 and 90, and longitude between -180 and 180.');
        return;
      }
      
      const coords = { latitude: lat, longitude: lng };
      setSelectedLocation(coords);
      await reverseGeocode(coords);
      setIsEditingCoordinates(false);
      
      // Show success feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show('Location updated', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('Error handling manual coordinates:', error);
      Alert.alert('Error', 'Could not process these coordinates. Please try again.');
    }
  };

  // Function to geocode using Google Maps API
  const geocodeAddressWithGoogleMaps = async (address) => {
    try {
      // Check if API key is set
      if (GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE") {
        logDebug('Google Maps API key not configured');
        setGoogleMapsAvailable(false);
        throw new Error('Google Maps API key not configured');
      }
      
      // Encode the address for URL
      const encodedAddress = encodeURIComponent(address);
      
      // Construct the Google Maps Geocoding API URL
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
      
      // Make the request
      const response = await fetch(url);
      const data = await response.json();
      
      // Check if the request was successful
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        const formattedAddress = result.formatted_address;
        
        return {
          latitude: lat,
          longitude: lng,
          address: formattedAddress
        };
      } else {
        logDebug('Google Maps Geocoding API error:', data.status);
        throw new Error('Could not find location with Google Maps');
      }
    } catch (error) {
      logDebug('Error with Google Maps geocoding:', error);
      throw error;
    }
  };

  // Handle manual address input
  const handleManualAddress = async () => {
    if (!manualAddress.trim()) {
      Alert.alert('Address Required', 'Please enter an address');
      return;
    }
    
    try {
      setIsSearchingAddress(true);
      
      let locationResult;
      
      // Try Google Maps API first if available
      if (googleMapsAvailable) {
        try {
          locationResult = await geocodeAddressWithGoogleMaps(manualAddress);
          
          // Set the selected location from Google Maps result
          setSelectedLocation({ 
            latitude: locationResult.latitude, 
            longitude: locationResult.longitude 
          });
          setManualLatitude(locationResult.latitude.toString());
          setManualLongitude(locationResult.longitude.toString());
          setAddress(locationResult.address);
          
          // Show success feedback
          if (Platform.OS === 'android') {
            ToastAndroid.show('Address located with Google Maps', ToastAndroid.SHORT);
          }
          
          setIsSearchingAddress(false);
          return;
        } catch (error) {
          logDebug('Google Maps geocoding failed, falling back to Expo Location:', error);
          // Fall back to Expo Location if Google Maps fails
        }
      }
      
      // Fallback to Expo Location geocoding
      const result = await Location.geocodeAsync(manualAddress);
      
      if (result && result.length > 0) {
        const { latitude, longitude } = result[0];
        
        // Set the selected location from Expo Location result
        setSelectedLocation({ latitude, longitude });
        setManualLatitude(latitude.toString());
        setManualLongitude(longitude.toString());
        
        // Get a full address for the coordinates
        await reverseGeocode({ latitude, longitude });
        
        // Show success feedback
        if (Platform.OS === 'android') {
          ToastAndroid.show('Address located', ToastAndroid.SHORT);
        }
      } else {
        Alert.alert('Address Not Found', 'Could not find the specified address. Please try a different address or enter coordinates manually.');
      }
    } catch (error) {
      logDebug('Error processing manual address:', error);
      Alert.alert('Error', 'Could not process this address. Please try again with a different address or use coordinates.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Function to view location on Google Maps
  const viewOnGoogleMaps = () => {
    if (!selectedLocation) return;
    
    const { latitude, longitude } = selectedLocation;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Could not open Google Maps');
      }
    });
  };

  const reverseGeocode = async (coords) => {
    try {
      const addresses = await Location.reverseGeocodeAsync(coords);
      if (addresses.length > 0) {
        const addr = addresses[0];
        const addressComponents = [
          addr.name,
          addr.street,
          addr.city,
          addr.region,
          addr.postalCode,
          addr.country
        ].filter(Boolean);
        
        const addressStr = addressComponents.join(', ');
        setAddress(addressStr);
        setManualAddress(addressStr);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setAddress('Address not available');
    }
  };

  const saveLocation = async () => {
    if (!selectedLocation) {
      Alert.alert('No Location Selected', 'Please select a location');
      return;
    }
    
    try {
      // Create the location object to save
      const locationToSave = {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: address,
        setByCaregiver: true,
        timestamp: new Date().toISOString()
      };
      
      // 1. Save to a patient-specific location key for direct sync
      if (route.params?.patientEmail) {
        const patientEmail = route.params.patientEmail.toLowerCase().trim();
        
        // Special key format for patient-specific locations set by caregiver
        const patientLocationKey = `patientHomeLocation_${route.params.caregiverEmail}_${patientEmail}`;
        await AsyncStorage.setItem(patientLocationKey, JSON.stringify(locationToSave));
        console.log(`Saved home location for patient ${patientEmail}`);
        
        // 2. Also update caregiver's patientHomeLocations map in userData
        try {
          const caregiverDataKey = `userData_${route.params.caregiverEmail}`;
          const caregiverData = await AsyncStorage.getItem(caregiverDataKey);
          
          if (caregiverData) {
            const parsedData = JSON.parse(caregiverData);
            
            // Initialize or update the patientHomeLocations map
            parsedData.patientHomeLocations = parsedData.patientHomeLocations || {};
            parsedData.patientHomeLocations[patientEmail] = locationToSave;
            
            // Save updated caregiver data
            await AsyncStorage.setItem(caregiverDataKey, JSON.stringify(parsedData));
            console.log(`Updated caregiver's patientHomeLocations map for ${patientEmail}`);
          }
        } catch (error) {
          console.error('Error updating caregiver data with patient home location:', error);
          // Continue anyway since we already saved to the direct key
        }
      }
      
      // 3. Call the callback function if provided
      if (onLocationSelect) {
        onLocationSelect(locationToSave);
      }
      
      // Show success message
      if (Platform.OS === 'android') {
        ToastAndroid.show('Location saved successfully', ToastAndroid.SHORT);
      } else {
        Alert.alert('Location Saved', 'The location has been saved successfully.');
      }
      
      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'An error occurred while saving the location.');
    }
  };

  // Render now with loading spinner only for the location card, not the whole screen
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isLocationAlreadySet ? 'Change Patient\'s Home' : 'Set Patient\'s Home'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isLocationAlreadySet 
                ? 'Update the patient\'s home location' 
                : 'Select or enter the patient\'s home location'}
            </Text>
            {isLocationAlreadySet && isUserSetLocation && (
              <View style={styles.existingLocationNote}>
                <MaterialIcons name="info-outline" size={20} color="#005BBB" />
                <Text style={styles.existingLocationText}>
                  This location was previously set by the patient
                </Text>
              </View>
            )}
          </View>
          
          {/* Location Preview */}
          {selectedLocation && (
            <View style={styles.locationPreviewContainer}>
              <View style={styles.locationPreviewHeader}>
                <MaterialIcons name="home" size={24} color="#FFF" />
                <Text style={styles.locationPreviewTitle}>Selected Location</Text>
                
                <TouchableOpacity 
                  style={styles.viewOnMapButton}
                  onPress={viewOnGoogleMaps}
                >
                  <MaterialIcons name="map" size={16} color="#FFF" />
                  <Text style={styles.viewOnMapText}>View on Maps</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.locationPreviewContent}>
                <Text style={styles.locationPreviewCoordinates}>
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </Text>
                <Text style={styles.locationPreviewAddress} numberOfLines={2}>
                  {address || 'Address not available'}
                </Text>
              </View>
            </View>
          )}
          
          {/* Location Picker */}
          <View style={styles.locationPickerContainer}>
            {/* Current Location Card */}
            {currentLocation ? (
              <View style={styles.locationInfoCard}>
                <MaterialIcons name="my-location" size={36} color="#005BBB" />
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationTitle}>Use Current Location</Text>
                  <Text style={styles.locationCoordinates}>
                    {currentLocation?.latitude.toFixed(6)}, {currentLocation?.longitude.toFixed(6)}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.useLocationButton} 
                  onPress={useCurrentLocation}
                >
                  <Text style={styles.useLocationButtonText}>Use</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.locationInfoCard}>
                <MaterialIcons name="location-searching" size={36} color="#999" />
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationTitle}>Getting your location...</Text>
                  {loading && <ActivityIndicator size="small" color="#005BBB" style={{marginTop: 5}} />}
                </View>
              </View>
            )}
            
            <View style={styles.divider} />
            
            {/* Manual Address Entry */}
            <Text style={styles.sectionTitle}>Enter Address</Text>
            <View style={styles.addressInputContainer}>
              <TextInput
                style={styles.addressInput}
                value={manualAddress}
                onChangeText={setManualAddress}
                placeholder="Enter full address or landmark"
                multiline={false}
              />
              <TouchableOpacity 
                style={styles.searchButton}
                onPress={handleManualAddress}
                disabled={isSearchingAddress}
              >
                {isSearchingAddress ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.addressHint}>
              Enter a physical address, landmark, or city/region
            </Text>
            
            <View style={styles.divider} />
            
            {/* Manual Coordinate Entry */}
            <Text style={styles.sectionTitle}>Enter Coordinates Manually</Text>
            <View style={styles.coordinateInputContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Latitude:</Text>
                <TextInput
                  style={styles.coordinateInput}
                  value={isEditingCoordinates ? manualLatitude : selectedLocation?.latitude.toFixed(6)}
                  onChangeText={setManualLatitude}
                  keyboardType="numeric"
                  placeholder="Latitude (e.g. 37.7749)"
                  onFocus={() => setIsEditingCoordinates(true)}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Longitude:</Text>
                <TextInput
                  style={styles.coordinateInput}
                  value={isEditingCoordinates ? manualLongitude : selectedLocation?.longitude.toFixed(6)}
                  onChangeText={setManualLongitude}
                  keyboardType="numeric"
                  placeholder="Longitude (e.g. -122.4194)"
                  onFocus={() => setIsEditingCoordinates(true)}
                />
              </View>
              
              <TouchableOpacity 
                style={styles.updateButton}
                onPress={handleManualCoordinates}
              >
                <Text style={styles.updateButtonText}>Update Location</Text>
              </TouchableOpacity>
            </View>
            
            {/* Quick Instructions */}
            <View style={styles.instructionsContainer}>
              <MaterialIcons name="info-outline" size={24} color="#666" style={styles.infoIcon} />
              <Text style={styles.instructionsText}>
                The patient's home location will be used to track if they wander too far.
              </Text>
            </View>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, !selectedLocation && styles.buttonDisabled]}
              onPress={saveLocation}
              disabled={!selectedLocation}
            >
              <Text style={styles.buttonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8"
  },
  scrollContainer: {
    flexGrow: 1
  },
  contentContainer: {
    flex: 1
  },
  header: {
    padding: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666'
  },
  existingLocationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#E8F4FF',
    padding: 10,
    borderRadius: 8,
  },
  existingLocationText: {
    fontSize: 14,
    color: '#005BBB',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555'
  },
  locationPreviewContainer: {
    margin: 15,
    borderRadius: 10,
    backgroundColor: '#005BBB',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  locationPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  locationPreviewTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10
  },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 30
  },
  viewOnMapText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 5
  },
  locationPreviewContent: {
    padding: 15
  },
  locationPreviewCoordinates: {
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    marginBottom: 5
  },
  locationPreviewAddress: {
    color: '#FFFFFF',
    fontSize: 14
  },
  locationPickerContainer: {
    padding: 15,
    backgroundColor: '#FFF',
    margin: 15,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  locationInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  locationCoordinates: {
    fontSize: 14,
    color: '#555',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  useLocationButton: {
    backgroundColor: '#005BBB',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20
  },
  useLocationButtonText: {
    color: '#FFF',
    fontWeight: 'bold'
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 15
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5
  },
  addressInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginRight: 10
  },
  searchButton: {
    backgroundColor: '#005BBB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80
  },
  searchButtonText: {
    color: '#FFF',
    fontWeight: 'bold'
  },
  addressHint: {
    fontSize: 12,
    color: '#777',
    marginBottom: 10
  },
  coordinateInputContainer: {
    marginBottom: 15
  },
  inputGroup: {
    marginBottom: 10
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5
  },
  coordinateInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  updateButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5
  },
  updateButtonText: {
    color: '#FFF',
    fontWeight: 'bold'
  },
  addressContainer: {
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 8,
    marginVertical: 15,
    display: 'none' // Hide this since we now show address in the preview
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5
  },
  addressText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20
  },
  instructionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF7E0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
    marginTop: 15
  },
  infoIcon: {
    marginRight: 10
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    lineHeight: 20
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    marginTop: 'auto'
  },
  button: {
    flex: 1,
    backgroundColor: '#005BBB',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default CaregiverSetHomeLocation;
