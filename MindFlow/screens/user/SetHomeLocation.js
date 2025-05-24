import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Dimensions,
  Platform,
  ToastAndroid,
  Image,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useUser } from '../../UserContext';

const { width, height } = Dimensions.get('window');

// Google Maps Geocoding API Key (you need to replace with your actual API key)
const GOOGLE_MAPS_API_KEY = "AIzaSyDrvWr_RhEky9lKUgeyTxAipD_lhNJqH2s";

const SetHomeLocation = ({ route, navigation }) => {
  // Extract parameters
  const { locationData, returnScreen = 'Profile', onLocationSelect } = route.params || {};
  const { currentUser, updateUser, refreshUserData } = useUser();
  
  // State variables
  const [selectedLocation, setSelectedLocation] = useState(locationData || null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [address, setAddress] = useState(locationData?.address || '');
  const [manualAddress, setManualAddress] = useState(locationData?.address || '');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationUpdates, setLocationUpdates] = useState(0);
  const [manualLatitude, setManualLatitude] = useState(locationData?.latitude?.toString() || '');
  const [manualLongitude, setManualLongitude] = useState(locationData?.longitude?.toString() || '');
  const [isEditingCoordinates, setIsEditingCoordinates] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [googleMapsAvailable, setGoogleMapsAvailable] = useState(true);
  
  // Debug log function
  const logDebug = (message, data) => {
    console.log(`[SetHomeLocation] ${message}`, data || '');
  };
  
  // Use current location as home location
  const useCurrentLocation = async () => {
    try {
      if (!currentLocation) return;
      
      const coords = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      };
      
      logDebug('Using current location:', coords);
      setSelectedLocation(coords);
      
      // Get address for the selected coordinates
      const result = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      
      if (result && result.length > 0) {
        const loc = result[0];
        const addressComponents = [
          loc.name,
          loc.street,
          loc.city,
          loc.region,
          loc.country
        ].filter(Boolean);
        
        const formattedAddress = addressComponents.join(', ');
        logDebug('Address resolved:', formattedAddress);
        setAddress(formattedAddress);
        setManualAddress(formattedAddress);
      }
      
      // Show success feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show('Current location selected', ToastAndroid.SHORT);
      }
    } catch (error) {
      logDebug('Error using current location:', error);
      setAddress('Unknown location');
      Alert.alert('Error', 'Could not get location details');
    }
  };
  
  // Handle manual coordinate input
  const handleManualCoordinates = async () => {
    try {
      const lat = parseFloat(manualLatitude);
      const lng = parseFloat(manualLongitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        Alert.alert('Invalid Coordinates', 'Please enter valid coordinates');
        return;
      }
      
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        Alert.alert('Invalid Coordinates', 'Latitude must be between -90 and 90, longitude between -180 and 180');
        return;
      }
      
      const coords = { latitude: lat, longitude: lng };
      setSelectedLocation(coords);
      
      // Get address for the manually entered coordinates
      const result = await Location.reverseGeocodeAsync(coords);
      
      if (result && result.length > 0) {
        const loc = result[0];
        const addressComponents = [
          loc.name,
          loc.street,
          loc.city,
          loc.region,
          loc.country
        ].filter(Boolean);
        
        const formattedAddress = addressComponents.join(', ');
        logDebug('Address resolved for manual coordinates:', formattedAddress);
        setAddress(formattedAddress);
        setManualAddress(formattedAddress);
      } else {
        setAddress('Unknown Location');
      }
      
      setIsEditingCoordinates(false);
      
      // Show success feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show('Location updated', ToastAndroid.SHORT);
      }
    } catch (error) {
      logDebug('Error handling manual coordinates:', error);
      Alert.alert('Error', 'Could not process coordinates');
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
        
        // Set the selected location
        setSelectedLocation({ latitude, longitude });
        setManualLatitude(latitude.toString());
        setManualLongitude(longitude.toString());
        
        // Show success feedback
        if (Platform.OS === 'android') {
          ToastAndroid.show('Address located', ToastAndroid.SHORT);
        }
        
        setAddress(manualAddress);
      } else {
        Alert.alert('Address Not Found', 'Could not find the address');
      }
    } catch (error) {
      logDebug('Error geocoding address:', error);
      Alert.alert('Error', 'Could not convert address to coordinates');
    } finally {
      setIsSearchingAddress(false);
    }
  };
  
  // Save the selected location
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
        address: address
      };
      
      logDebug('Saving location:', locationToSave);
      
      // Check if this is a callback from caregiver flow
      if (onLocationSelect) {
        // Call the callback function provided by the caregiver flow
        onLocationSelect(locationToSave);
        // Navigate back to the returnScreen
        navigation.navigate(returnScreen);
        return;
      }
      
      // Normal user flow - update the user object
      const updatedUser = {
        ...currentUser,
        homeLocation: locationToSave
      };
      
      const success = await updateUser(updatedUser);
      
      if (success) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Home location updated', ToastAndroid.LONG);
        } else {
          Alert.alert('Success', 'Home location updated successfully');
        }
        
        navigation.navigate(returnScreen);
      } else {
        Alert.alert('Error', 'Failed to update home location');
      }
    } catch (error) {
      logDebug('Error saving location:', error);
      Alert.alert('Error', 'Error saving location');
    }
  };

  // Initialize location services after component has mounted
  const initializeLocationServices = async () => {
    try {
      setInitializing(true);
      
      // If we already have location data from params, use that first
      if (locationData) {
        setSelectedLocation({
          latitude: locationData.latitude,
          longitude: locationData.longitude
        });
        setAddress(locationData.address || '');
        setManualAddress(locationData.address || '');
        setManualLatitude(locationData.latitude.toString());
        setManualLongitude(locationData.longitude.toString());
      }
      // Or if user has existing home location, use that
      else if (currentUser?.homeLocation) {
        setSelectedLocation({
          latitude: currentUser.homeLocation.latitude,
          longitude: currentUser.homeLocation.longitude
        });
        setAddress(currentUser.homeLocation.address || '');
        setManualAddress(currentUser.homeLocation.address || '');
        setManualLatitude(currentUser.homeLocation.latitude.toString());
        setManualLongitude(currentUser.homeLocation.longitude.toString());
      }
      
      // Now get location permissions and current location in background
      setTimeout(async () => {
        try {
          // Request location permissions
          const { status } = await Location.requestForegroundPermissionsAsync();
          
          if (status !== 'granted') {
            logDebug('Location permission denied');
            setLocationPermissionDenied(true);
            setInitializing(false);
            return;
          }
          
          setLoading(true);
          
          // Get the current location
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          
          const { latitude, longitude } = position.coords;
          
          logDebug('Got current location', { latitude, longitude });
          
          // Set the current location
          setCurrentLocation({
            latitude,
            longitude
          });
          
          // If we don't have a selected location yet, use current location
          if (!selectedLocation && !locationData && !currentUser?.homeLocation) {
            setSelectedLocation({
              latitude,
              longitude
            });
            
            setManualLatitude(latitude.toString());
            setManualLongitude(longitude.toString());
            
            // Get the address for the current location
            try {
              const result = await Location.reverseGeocodeAsync({
                latitude,
                longitude
              });
              
              if (result && result.length > 0) {
                const loc = result[0];
                const addressComponents = [
                  loc.name,
                  loc.street,
                  loc.city,
                  loc.region,
                  loc.country
                ].filter(Boolean);
                
                const formattedAddress = addressComponents.join(', ');
                logDebug('Current address resolved:', formattedAddress);
                setAddress(formattedAddress);
                setManualAddress(formattedAddress);
              }
            } catch (error) {
              logDebug('Error getting current address:', error);
            }
          }
        } catch (error) {
          logDebug('Error in background location task:', error);
        } finally {
          setLoading(false);
          setInitializing(false);
        }
      }, 100); // Small delay to ensure UI renders first
      
    } catch (error) {
      logDebug('Error initializing location services:', error);
      setLoading(false);
      setInitializing(false);
    }
  };
  
  // Request and get the user's current location - now with deferred initialization
  useEffect(() => {
    let isActive = true; // Flag to prevent state updates after component unmounts
    
    // Start initialization after component has mounted
    initializeLocationServices();
    
    // Cleanup function
    return () => {
      isActive = false;
    };
  }, [locationUpdates]); // Only depend on locationUpdates
  
  // Render permission denied view
  if (locationPermissionDenied) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.permissionDeniedContainer}>
          <MaterialIcons name="location-off" size={50} color="#777" />
          <Text style={styles.permissionDeniedText}>Location Permission Denied</Text>
          <Text style={styles.permissionDeniedSubtext}>
            Enable location services to set your home location
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setLocationPermissionDenied(false);
              setLocationUpdates(prev => prev + 1);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
              <Text style={styles.headerTitle}>Set Home Location</Text>
            <Text style={styles.headerSubtitle}>
                Select or Enter Home Location
            </Text>
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
            
            {/* Location Options */}
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
                  <Text style={styles.locationTitle}>Getting Your Location...</Text>
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
                  placeholder='Enter full address or landmark'
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
                Enter an address, landmark, or place name to find it on the map
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
                    placeholder='Enter latitude (e.g., 37.7749)'
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
                    placeholder='Enter longitude (e.g., -122.4194)'
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
                  Your home location helps the app provide better services and navigation options
              </Text>
            </View>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={() => navigation.goBack()}
            >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.saveButton, !selectedLocation && styles.disabledButton]} 
              onPress={saveLocation}
              disabled={!selectedLocation} 
            >
                <Text style={styles.buttonText}>Save Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
  locationPreviewContainer: {
    margin: 15,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3
  },
  locationPreviewHeader: {
    backgroundColor: '#005BBB',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  locationPreviewTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1
  },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  viewOnMapText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 4
  },
  locationPreviewContent: {
    padding: 15
  },
  locationPreviewCoordinates: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: '#333',
    marginBottom: 8
  },
  locationPreviewAddress: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555'
  },
  permissionDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  permissionDeniedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 15,
    marginBottom: 10
  },
  permissionDeniedSubtext: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginBottom: 20
  },
  retryButton: {
    backgroundColor: '#005BBB',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  locationPickerContainer: {
    padding: 15,
    backgroundColor: '#FFF',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2
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
  addressHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 15,
    fontStyle: 'italic'
  },
  searchButton: {
    backgroundColor: '#005BBB',
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8
  },
  searchButtonText: {
    color: '#FFF',
    fontWeight: 'bold'
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
  instructionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF7E0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107'
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
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2
  },
  cancelButton: {
    backgroundColor: '#fff',
    marginRight: 8
  },
  saveButton: {
    backgroundColor: '#005BBB',
    marginLeft: 8
  },
  disabledButton: {
    backgroundColor: '#AAA',
    opacity: 0.7
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  cancelButtonText: {
    color: '#005BBB'
  }
});

export default SetHomeLocation;
