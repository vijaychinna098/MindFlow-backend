import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  StyleSheet, 
  Alert, 
  Modal, 
  Dimensions,
  TextInput,
  Linking,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../UserContext';
import { useFontSize } from '../user/FontSizeContext';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { shareProfileDataDirectly } from '../../services/DataSynchronizationService';

// Import the server config
const { API_BASE_URL, handleApiError, checkServerConnectivity, getActiveServerUrl } = require('../../config');

const { width, height } = Dimensions.get('window');

const ProfileScreen = ({ route, navigation }) => {
  // Context and navigation
  const { currentUser, updateUser, logoutUser, isSignedIn, loadUser } = useUser();
  const { fontSize } = useFontSize();
  
  // State variables
  const [userData, setUserData] = useState(currentUser || {});
  const [localUserData, setLocalUserData] = useState(null);
  const [isLoadingCaregiver, setIsLoadingCaregiver] = useState(true);
  const [isLoadingLocalUser, setIsLoadingLocalUser] = useState(false);
  const [caregiverName, setCaregiverName] = useState(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  
  // Image handling
  const defaultProfileImage = require('../images/boy.png');
  const [profileImageSource, setProfileImageSource] = useState(defaultProfileImage);

  // Settings state
  const [settings] = useState({
    reminders: true,
    locationSharing: true,
    medicationAlerts: true,
    voiceAssistance: false
  });

  // Sync user data from context or local storage
  useEffect(() => {
    if (currentUser) {
      setUserData(currentUser);
      if (currentUser.profileImage) {
        setProfileImageSource({ uri: currentUser.profileImage });
      }
    } else if (localUserData) {
      setUserData(localUserData);
      if (localUserData.profileImage) {
        setProfileImageSource({ uri: localUserData.profileImage });
          }
    }
  }, [currentUser, localUserData]);

  // Handle profile image changes
  useEffect(() => {
    if (!userData?.profileImage) {
      setProfileImageSource(defaultProfileImage);
        return;
      }
      
    try {
      if (typeof userData.profileImage === 'string') {
        let imageUri = userData.profileImage;
        
        if (Platform.OS === 'android' && !imageUri.startsWith('file://') && 
            !imageUri.startsWith('content://') && !imageUri.startsWith('http')) {
          imageUri = `file://${imageUri}`;
        }
        
        setProfileImageSource({ uri: imageUri });
      } else if (typeof userData.profileImage === 'object' && userData.profileImage.uri) {
        setProfileImageSource(userData.profileImage);
      } else {
        setProfileImageSource(defaultProfileImage);
      }
    } catch (error) {
      console.log('Error processing profile image:', error);
      setProfileImageSource(defaultProfileImage);
    }
  }, [userData?.profileImage]);

  // Load user data on mount
  useEffect(() => {
    const isMounted = { current: true };
    
    const loadUserDataDirectly = async () => {
      if (!isMounted.current) return;
      
      if (!currentUser && isSignedIn && !isLoadingLocalUser) {
        try {
          setIsLoadingLocalUser(true);
          const email = await AsyncStorage.getItem('currentUserEmail');
          
          if (email && isMounted.current) {
            const userDataKey = `userData_${email.toLowerCase().trim()}`;
            const storedData = await AsyncStorage.getItem(userDataKey);
            
            if (storedData && isMounted.current) {
              const parsedData = JSON.parse(storedData);
              setLocalUserData(parsedData);
            }
        }
      } catch (error) {
          console.error("Error loading user data directly:", error);
        } finally {
          if (isMounted.current) {
            setIsLoadingLocalUser(false);
          }
      }
    }
  };
  
    loadUserDataDirectly();
    
    // Also try context loader with delay to prevent render cycles
    if (!currentUser && isSignedIn && loadUser) {
      const timer = setTimeout(() => {
        if (isMounted.current) {
          loadUser();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [currentUser, isSignedIn, loadUser, isLoadingLocalUser]);

  // Load caregiver info
  useEffect(() => {
      if (!currentUser) return;
      
    let isMounted = true;
    
    const loadCaregiverInfo = async () => {
      try {
        // Debounce check
        const lastLoadKey = 'lastCaregiverLoad';
        const now = Date.now();
        const lastLoadStr = await AsyncStorage.getItem(lastLoadKey);
        
        if (lastLoadStr) {
          const lastLoad = parseInt(lastLoadStr, 10);
          if (now - lastLoad < 3000) return; // Skip if less than 3 seconds
        }
        
        // Record this attempt
        await AsyncStorage.setItem(lastLoadKey, now.toString());
        
        if (!isMounted) return;
        setIsLoadingCaregiver(true);
        
        // Try to use cached caregiver name
            if (currentUser.caregiverName) {
              setCaregiverName(currentUser.caregiverName);
              setIsLoadingCaregiver(false);
              return;
            }
        
        // Otherwise try to find caregiver in storage
        const email = currentUser.email.toLowerCase().trim();
        const caregiverMapStr = await AsyncStorage.getItem('caregiverPatientsMap');
        
        if (caregiverMapStr) {
          const map = JSON.parse(caregiverMapStr);
          const caregiverEmail = map[email];
            
            if (caregiverEmail) {
            const caregiverData = await AsyncStorage.getItem(`caregiverData_${caregiverEmail}`);
                if (caregiverData) {
                    const caregiver = JSON.parse(caregiverData);
              if (isMounted) {
                      setCaregiverName(caregiver.name);
                  }
                }
              }
            }
          } catch (error) {
        console.error('Error loading caregiver info:', error);
      } finally {
        if (isMounted) {
              setIsLoadingCaregiver(false);
        }
            }
    };
    
    loadCaregiverInfo();
    
    return () => {
      isMounted = false;
    };
  }, [currentUser]);
    
  // Update route params
  useEffect(() => {
    if (route.params?.homeLocation) {
      const updatedUser = { ...userData, homeLocation: route.params.homeLocation };
      updateUser(updatedUser);
      navigation.setParams({ homeLocation: undefined });
    }
  }, [route.params?.homeLocation, userData, updateUser, navigation]);

  // Handle image errors
  const handleImageError = useCallback(() => {
    console.log('Error loading profile image, using default');
    setProfileImageSource(defaultProfileImage);
    
    // Cleanup bad image reference in storage
    if (userData?.email) {
      const email = userData.email.toLowerCase().trim();
      const userKey = `userData_${email}`;
      
      AsyncStorage.getItem(userKey)
        .then(data => {
          if (data) {
            const parsed = JSON.parse(data);
            delete parsed.profileImage;
            return AsyncStorage.setItem(userKey, JSON.stringify(parsed));
          }
        })
        .catch(error => console.log('Error clearing bad image:', error));
      }
      
    return defaultProfileImage;
  }, [userData?.email, defaultProfileImage]);
        
  // Handler functions
  const handleSignOut = async () => {
          try {
      await logoutUser();
    } catch (error) {
      console.error('Sign Out Error', error);
    }
  };

  const handleEditProfile = () => {
    if (!userData) {
      Alert.alert('Error', 'User data could not be loaded');
      return;
    }
    
    navigation.navigate('EditProfile', {
      user: userData,
      onSave: async (updatedUser) => {
        try {
          const success = await updateUser(updatedUser);
          if (success) {
            Alert.alert('Success', 'Profile updated successfully');
          } else {
            Alert.alert('Error', 'Failed to update profile');
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to update profile');
          console.error(error);
        }
      }
    });
  };

  const handleSetHomeLocation = async () => {
    navigation.navigate('SetHomeLocation', {
      locationData: userData.homeLocation,
      returnScreen: 'Profile'
    });
  };

  const openImageFullScreen = () => {
    if (userData?.profileImage) {
      setIsImageModalVisible(true);
          }
  };

  const closeImageModal = () => {
    setIsImageModalVisible(false);
  };

  const selectImageSource = () => {
    Alert.alert(
      'Update Profile Picture',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: () => launchCamera() },
        { text: 'Choose from Gallery', onPress: () => launchImageLibrary() },
        { text: 'Cancel', style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const launchCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take a photo');
            return;
          }
          
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    handleImagePickerResult(result);
  };

  const launchImageLibrary = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission Required', 'Photo library access is needed to select a photo');
              return;
            }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    handleImagePickerResult(result);
  };
          
  const handleImagePickerResult = async (result) => {
    if (result.canceled || !result.assets || !result.assets.length) return;
    
    try {
      const imageUri = result.assets[0].uri;
      if (!imageUri) return;
      
      // Create permanent copy
      const timestamp = new Date().getTime();
      const email = userData.email.toLowerCase().trim();
      const filename = `profile_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.jpg`;
      const documentsDir = FileSystem.documentDirectory;
      const destinationUri = `${documentsDir}${filename}`;
      
      await FileSystem.copyAsync({
        from: imageUri,
        to: destinationUri
      });
            
      // Update user
            const updatedUser = {
        ...userData,
        profileImage: destinationUri,
                updatedAt: new Date().toISOString()
              };
      
      const success = await updateUser(updatedUser);
      if (success) {
        Alert.alert('Success', 'Profile photo updated successfully');
          } else {
        Alert.alert('Error', 'Failed to update profile picture');
            }
        } catch (error) {
      console.log('Profile image update failed:', error);
      Alert.alert('Error', 'Failed to update profile picture');
      }
    };
    
  // Loading state
  if (isLoadingLocalUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#005BBB" />
        <Text style={[styles.loadingText, { fontSize }]}>Loading user profile...</Text>
      </View>
    );
  }

  // No user data state
  if (!userData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#005BBB" />
          <Text style={[styles.loadingText, { fontSize }]}>Loading user data...</Text>
          <TouchableOpacity
            style={styles.returnButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.returnButtonText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Debug log
  console.log('Profile screen - current user data:', {
    name: userData.name,
    email: userData.email,
    phone: userData.phone || 'Not Provided',
    hasPhoneNumber: !!userData.phone
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="arrow-back" size={24} color="#005BBB" />
          <Text style={styles.backButtonText}>back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={openImageFullScreen}>
            <Image 
              source={profileImageSource} 
              style={styles.profileImage}
              defaultSource={defaultProfileImage}
              onError={handleImageError}
            />
            <TouchableOpacity 
              style={styles.cameraIcon}
              onPress={(e) => { e.stopPropagation(); selectImageSource(); }}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>
          <Text style={[styles.userName, { fontSize }]}>{userData.name}</Text>
          <Text style={[styles.userEmail, { fontSize: fontSize - 2 }]}>{userData.email}</Text>
          
          {isLoadingCaregiver ? (
            <Text style={[styles.caregiverText, { fontSize: fontSize - 2 }]}>Loading caregiver information...</Text>
          ) : caregiverName ? (
            <View style={styles.caregiverContainer}>
              <MaterialIcons name="person-outline" size={18} color="#005BBB" style={styles.caregiverIcon} />
              <View>
                <Text style={[styles.caregiverLabel, { fontSize: fontSize - 2 }]}>Your Caregiver:</Text>
                <Text style={[styles.caregiverName, { fontSize: fontSize }]}>{caregiverName}</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.caregiverText, { fontSize: fontSize - 2 }]}>No caregiver assigned</Text>
          )}
          
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={[styles.editButtonText, { fontSize }]}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, styles.card]}>
          <Text style={[styles.sectionTitle, { fontSize }]}>Personal Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{userData.phone || 'Not Provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome name="user" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{userData.age ? `${userData.age} years old` : 'Age not provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="home" size={24} color="#005BBB" />
            <View style={styles.locationContainer}>
              <Text style={[styles.infoText, { fontSize }]}>
                {userData.homeLocation ? 
                 `Home: ${userData.homeLocation.address || userData.homeLocation.name || 'Location Set'}` : 
                 'Home location not set'}
              </Text>
              <TouchableOpacity style={styles.setLocationButton} onPress={handleSetHomeLocation}>
                <Text style={styles.setLocationText}>
                  {userData.homeLocation ? 'Change' : 'Set'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="home" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{userData.address || 'Address not provided'}</Text>
          </View>
        </View>

        <View style={[styles.section, styles.card]}>
          <Text style={[styles.sectionTitle, { fontSize }]}>Medical Information</Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="medical-bag" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{userData.medicalInfo?.conditions || 'No conditions listed'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="medication" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{userData.medicalInfo?.medications || 'No medications listed'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="warning" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{`Allergies: ${userData.medicalInfo?.allergies || 'None listed'}`}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="water" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{`Blood Type: ${userData.medicalInfo?.bloodType || 'Not specified'}`}</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={isImageModalVisible} transparent={true} onRequestClose={closeImageModal}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={closeImageModal}>
            <Ionicons name="close" size={30} color="#FFF" />
          </TouchableOpacity>
          <Image 
            source={profileImageSource} 
            style={styles.fullScreenImage}
            resizeMode="contain"
            defaultSource={defaultProfileImage}
            onError={handleImageError}
          />
          <TouchableOpacity 
            style={styles.changePhotoButton}
            onPress={() => { closeImageModal(); selectImageSource(); }}
          >
            <Text style={[styles.changePhotoButtonText, { fontSize }]}>Change Photo</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  backButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: "#005BBB",
    marginLeft: 5,
    fontWeight: '500',
  },
  profileHeader: { alignItems: "center", marginBottom: 30 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: "#005BBB", marginBottom: 15 },
  cameraIcon: { position: "absolute", bottom: 10, right: 10, backgroundColor: "#005BBB", borderRadius: 20, padding: 8 },
  userName: { fontSize: 24, fontWeight: "bold", color: "#2C3E50", marginBottom: 5 },
  userEmail: { fontSize: 16, color: "#2C3E50", marginBottom: 10 },
  caregiverContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#E8F4FD", 
    paddingVertical: 10, 
    paddingHorizontal: 15, 
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#D6EAF8",
    elevation: 1
  },
  caregiverIcon: {
    marginRight: 10
  },
  caregiverLabel: { 
    fontSize: 14, 
    color: "#7F8C8D", 
  },
  caregiverName: { 
    fontSize: 16, 
    color: "#005BBB", 
    fontWeight: "bold" 
  },
  caregiverText: { 
    fontSize: 14, 
    color: "#7F8C8D", 
    marginBottom: 15,
    fontStyle: "italic"
  },
  editButton: { backgroundColor: "#005BBB", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  editButtonText: { color: "#FFF", fontWeight: "bold" },
  card: { backgroundColor: "#FAFAFA", borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#005BBB", marginBottom: 15, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: "#EEE" },
  infoText: { flex: 1, fontSize: 16, marginLeft: 15, color: "#2C3E50" },
  locationContainer: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  setLocationButton: { backgroundColor: "#005BBB", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 15, marginLeft: 10 },
  setLocationText: { color: "#FFF", fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  fullScreenImage: { width: width, height: height * 0.7 },
  closeButton: { position: "absolute", top: 40, right: 20, zIndex: 1 },
  changePhotoButton: { position: "absolute", bottom: 40, backgroundColor: "#005BBB", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  changePhotoButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 18, color: "#2C3E50" },
  returnButton: { backgroundColor: "#005BBB", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20 },
  returnButtonText: { color: "#FFF", fontWeight: "bold" },
  errorText: { fontSize: 14, color: "#7F8C8D", marginVertical: 15, textAlign: 'center', maxWidth: '80%' },
});

export default ProfileScreen;
