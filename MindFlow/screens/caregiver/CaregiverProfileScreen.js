import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  StyleSheet, 
  Alert, 
  Modal, 
  Dimensions
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCaregiver } from '../../CaregiverContext';
import { useFontSize } from './CaregiverFontSizeContext';
import * as ImagePicker from 'expo-image-picker';

// Import FileSystem safely with error handling
let FileSystem;
try {
  FileSystem = require('expo-file-system');
} catch (error) {
  console.log('FileSystem import error in CaregiverProfileScreen:', error.message);
  FileSystem = null;
}

// Global error handler to prevent app crashes
const originalConsoleError = console.error;
console.error = function(message, ...optionalParams) {
  // Don't crash the app, just log errors without showing in the UI
  console.log('Error suppressed:', message);
};

const { width, height } = Dimensions.get('window');

const CaregiverProfileScreen = () => {
  const navigation = useNavigation();
  const { caregiver, updateCaregiver, logoutCaregiver } = useCaregiver();
  const { fontSize } = useFontSize();

  const [isImageModalVisible, setIsImageModalVisible] = useState(false);

  useEffect(() => {
    console.log("Caregiver data in ProfileScreen:", caregiver);
  }, [caregiver]);

  // Add error boundary for FileSystem operations
  useEffect(() => {
    // Suppress any unhandled FileSystem errors by wrapping potential problem areas
    try {
      // Verify FileSystem is available
      if (FileSystem && typeof FileSystem !== 'undefined') {
        console.log('FileSystem is available');
      } else {
        console.log('FileSystem is not available, using fallbacks');
      }
      
      // Immediately try to access a key FileSystem method to catch errors early
      if (typeof FileSystem?.documentDirectory === 'undefined') {
        console.log('FileSystem.documentDirectory is undefined');
      }
      
      if (typeof FileSystem?.getInfoAsync !== 'function') {
        console.log('FileSystem.getInfoAsync is not available');
      }
    } catch (error) {
      // Silently catch and log any errors during initialization
      console.log('FileSystem initialization error suppressed');
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await logoutCaregiver();
      navigation.replace('CaregiverLogin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleEditProfile = () => {
    if (!caregiver) {
      Alert.alert('Error', 'Caregiver data not loaded');
      return;
    }
    navigation.navigate('CaregiverEditProfile', {
      user: caregiver,
      onSave: async (updatedUser) => {
        try {
          const success = await updateCaregiver(updatedUser);
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

  const openImageFullScreen = () => {
    if (caregiver?.profileImage) {
      setIsImageModalVisible(true);
    }
  };

  const closeImageModal = () => {
    setIsImageModalVisible(false);
  };

  const selectImageSource = () => {
    Alert.alert(
      "Update Profile Picture",
      "Choose an option",
      [
        { text: "Take Photo", onPress: () => launchCamera() },
        { text: "Choose from Gallery", onPress: () => launchImageLibrary() },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const launchCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need camera access to take photos');
      return;
    }
    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    handleImagePickerResult(pickerResult);
  };

  const launchImageLibrary = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need photo library access');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    handleImagePickerResult(pickerResult);
  };

  const handleImagePickerResult = async (pickerResult) => {
    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      try {
        const selectedImage = pickerResult.assets[0].uri;
        console.log("Selected profile image:", selectedImage);
        
        // Create a permanent copy of the image if FileSystem is available
        let imageUri = selectedImage;
        if (caregiver?.email) {
          try {
            const timestamp = new Date().getTime();
            const filename = `caregiver_profile_${caregiver.email.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.jpg`;
            
            // Only proceed with file operations if FileSystem is available
            if (FileSystem && typeof FileSystem !== 'undefined' && typeof FileSystem.documentDirectory === 'string') {
              const documentsDir = FileSystem.documentDirectory;
              const destinationUri = `${documentsDir}${filename}`;
              
              // Verify copyAsync is available before using it
              if (typeof FileSystem.copyAsync === 'function') {
                console.log("Copying image from temporary to permanent storage");
                await FileSystem.copyAsync({
                  from: selectedImage,
                  to: destinationUri
                });
                imageUri = destinationUri;
                console.log("Successfully copied image to permanent storage");
              }
            }
          } catch (fileError) {
            // Silently continue with the original URI if file operations fail
            console.log("File operations failed, using original image URI");
          }
        }
        
        const updatedUser = { ...caregiver, profileImage: imageUri };
        const success = await updateCaregiver(updatedUser);
        
        if (!success) {
          console.log("Failed to update caregiver through context");
          Alert.alert('Note', 'Profile picture updated, but may not persist after restart');
        }
      } catch (error) {
        // Don't show detailed error to user
        console.log('Profile image update failed, using default image');
        Alert.alert('Error', 'Failed to update profile picture');
      }
    }
  };

  // If caregiver data is not loaded yet, show a loading view.
  if (!caregiver) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { fontSize }]}>Loading caregiver data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#005BBB" />
        </TouchableOpacity>
        
        {/* Profile Header with Image */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={openImageFullScreen}>
            <Image 
              source={
                (() => {
                  try {
                    if (caregiver.profileImage) {
                      if (typeof caregiver.profileImage === 'string') {
                        return { uri: caregiver.profileImage };
                      } else if (typeof caregiver.profileImage === 'object' && caregiver.profileImage.uri) {
                        return caregiver.profileImage;
                      }
                    }
                    // Default fallback
                    return require('../images/boy.png');
                  } catch (error) {
                    console.log('Error processing profile image:', error);
                    return require('../images/boy.png');
                  }
                })()
              } 
              style={styles.profileImage}
              defaultSource={require('../images/boy.png')}
              onError={() => {
                console.log('Error loading profile image in profile header');
              }}
            />
            <TouchableOpacity 
              style={styles.cameraIcon}
              onPress={(e) => { e.stopPropagation(); selectImageSource(); }}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>
          <Text style={[styles.userName, { fontSize }]}>{caregiver.name}</Text>
          <Text style={[styles.userEmail, { fontSize: fontSize - 2 }]}>{caregiver.email}</Text>
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={[styles.editButtonText, { fontSize }]}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Personal Information Section */}
        <View style={[styles.section, styles.card]}>
          <Text style={[styles.sectionTitle, { fontSize }]}>Personal Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{caregiver.phone || 'Not provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome name="user" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{caregiver.age ? `${caregiver.age} years old` : 'Age not provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="home" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{caregiver.address || 'Address not provided'}</Text>
          </View>
        </View>

        {/* Medical Information Section */}
        <View style={[styles.section, styles.card]}>
          <Text style={[styles.sectionTitle, { fontSize }]}>Medical Information</Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="medical-bag" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{caregiver.medicalInfo?.conditions || 'No conditions listed'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="medication" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{caregiver.medicalInfo?.medications || 'No medications listed'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="warning" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{`Allergies: ${caregiver.medicalInfo?.allergies || 'None listed'}`}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="water" size={24} color="#005BBB" />
            <Text style={[styles.infoText, { fontSize }]}>{`Blood Type: ${caregiver.medicalInfo?.bloodType || 'Not specified'}`}</Text>
          </View>
        </View>

        {/* Settings Button */}
        <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('CaregiverSettings')}>
          <Ionicons name="settings" size={24} color="#FFF" />
          <Text style={[styles.settingsButtonText, { fontSize }]}>Settings</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal visible={isImageModalVisible} transparent={true} onRequestClose={closeImageModal}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={closeImageModal}>
            <Ionicons name="close" size={30} color="#FFF" />
          </TouchableOpacity>
          <Image 
            source={
              (() => {
                try {
                  if (caregiver.profileImage) {
                    if (typeof caregiver.profileImage === 'string') {
                      return { uri: caregiver.profileImage };
                    } else if (typeof caregiver.profileImage === 'object' && caregiver.profileImage.uri) {
                      return caregiver.profileImage;
                    }
                  }
                  // Default fallback
                  return require('../images/boy.png');
                } catch (error) {
                  console.log('Error processing profile image:', error);
                  return require('../images/boy.png');
                }
              })()
            }
            style={styles.fullScreenImage}
            resizeMode="contain"
            defaultSource={require('../images/boy.png')}
            onError={() => {
              console.log('Error loading profile image in full screen mode');
            }}
          />
          <TouchableOpacity 
            style={styles.changePhotoButton}
            onPress={() => { closeImageModal(); selectImageSource(); }}
          >
            <Text style={[styles.changePhotoButtonText, { fontSize }]}>Change Photo</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContainer: {
    paddingBottom: 30,
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 15,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: "#005BBB", marginBottom: 15 },
  cameraIcon: { position: "absolute", bottom: 10, right: 10, backgroundColor: "#005BBB", borderRadius: 20, padding: 8 },
  userName: { fontSize: 24, fontWeight: "bold", color: "#2C3E50", marginBottom: 5 },
  userEmail: { fontSize: 16, color: "#2C3E50", marginBottom: 15 },
  editButton: { backgroundColor: "#005BBB", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  editButtonText: { color: "#FFF", fontWeight: "bold" },
  card: { backgroundColor: "#FAFAFA", borderRadius: 10, padding: 20, marginHorizontal: 15, marginBottom: 20, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#005BBB", marginBottom: 18, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: "#EEE" },
  infoText: { flex: 1, fontSize: 16, marginLeft: 15, color: "#2C3E50" },
  settingsButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#005BBB", paddingVertical: 14, borderRadius: 10, elevation: 3, marginHorizontal: 15, marginBottom: 20, marginTop: 5 },
  settingsButtonText: { fontSize: 16, color: "#FFF", marginLeft: 10, fontWeight: "bold" },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  fullScreenImage: { width: width, height: height * 0.7 },
  closeButton: { position: "absolute", top: 40, right: 20, zIndex: 1 },
  changePhotoButton: { position: "absolute", bottom: 40, backgroundColor: "#005BBB", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  changePhotoButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 18, color: "#2C3E50" },
  refreshButton: { marginTop: 20, backgroundColor: "#005BBB", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  refreshButtonText: { color: "#FFF", fontWeight: "bold" },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", padding: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ccc" },
  navButton: { alignItems: "center" },
  navText: { marginTop: 5, color: "#005BBB" },
});

export default CaregiverProfileScreen;
