import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  StyleSheet, 
  Alert, 
  Modal, 
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { useFontSize } from './CaregiverFontSizeContext';
import { useCaregiver } from '../../CaregiverContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncCaregiverProfile } from '../../services/ServerSyncService';

const { width, height } = Dimensions.get('window');

const CaregiverEditProfileScreen = ({ route }) => {
  const navigation = useNavigation();
  const { user: initialUser, onSave } = route.params;
  
  // Get fontSize from FontSizeContext
  const { fontSize } = useFontSize();
  const { updateCaregiver } = useCaregiver();
  
  // Get default profile image
  const defaultProfileImage = require('../images/boy.png');

  const [formData, setFormData] = useState({
    name: initialUser.name || '',
    email: initialUser.email || '',
    phone: initialUser.phone || '',
    age: initialUser.age || '',
    address: initialUser.address || '',
    profileImage: initialUser.profileImage || null,
    medicalInfo: {
      conditions: initialUser.medicalInfo?.conditions || '',
      medications: initialUser.medicalInfo?.medications || '',
      allergies: initialUser.medicalInfo?.allergies || '',
      bloodType: initialUser.medicalInfo?.bloodType || ''
    }
  });
  
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get profile image source (user's image or default)
  const profileImageSource = formData.profileImage 
    ? { uri: formData.profileImage } 
    : defaultProfileImage;

  const openImageFullScreen = () => {
    setIsImageModalVisible(true);
  };

  const closeImageModal = () => {
    setIsImageModalVisible(false);
  };

  const selectImageSource = () => {
    Alert.alert(
      "Select Photo",
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
      aspect: [1, 1],
      quality: 0.8,
    });
    await handleImagePickerResult(pickerResult);
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
      aspect: [1, 1],
      quality: 0.8,
    });
    await handleImagePickerResult(pickerResult);
  };

  const handleImagePickerResult = async (pickerResult) => {
    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      try {
        const selectedImage = pickerResult.assets[0].uri;
        console.log("Selected profile image:", selectedImage);
        
        if (!selectedImage) {
          console.error("Selected image URI is empty");
          throw new Error("Selected image URI is empty");
        }
        
        if (typeof selectedImage !== 'string') {
          console.error("Selected image URI is not a string:", typeof selectedImage);
          throw new Error("Selected image URI must be a string");
        }
        
        // Create a permanent copy of the image with a fixed path that can be reused across sessions
        const permanentImageUri = await createPermanentImageCopy(selectedImage, formData.email);
        console.log("Created permanent image URI:", permanentImageUri);
        
        // Update form data with the permanent image URI
        const newData = { ...formData, profileImage: permanentImageUri };
        setFormData(newData);
        console.log("Updated form data with permanent image URI");
        
        // Double-save to ensure persistence:
        
        // 1. Save to database through caregiver context
        const contextSuccess = await updateCaregiver(newData);
        if (!contextSuccess) {
          console.error("Failed to update caregiver through context");
        }
        
        // 2. Save updated image to caregiver data key for persistence
        try {
          const caregiverDataKey = `caregiverData_${formData.email.toLowerCase().trim()}`;
          const storedData = await AsyncStorage.getItem(caregiverDataKey);
          
          if (storedData) {
            const caregiverData = JSON.parse(storedData);
            caregiverData.profileImage = permanentImageUri;
            await AsyncStorage.setItem(caregiverDataKey, JSON.stringify(caregiverData));
            console.log("Permanent profile image URI saved to caregiver data:", caregiverData.email);
            
            // Verify the save
            const verifyData = await AsyncStorage.getItem(caregiverDataKey);
            if (verifyData) {
              const parsedData = JSON.parse(verifyData);
              console.log("Verified profile image saved:", parsedData.profileImage ? "YES" : "NO");
            }
            
            // Also save an image flag to a separate key for redundancy
            await AsyncStorage.setItem(`caregiverHasProfileImage_${formData.email.toLowerCase().trim()}`, "true");
            await AsyncStorage.setItem(`caregiverProfileImagePath_${formData.email.toLowerCase().trim()}`, permanentImageUri);
          } else {
            console.error("No caregiver data found for direct update");
          }
        } catch (storageError) {
          console.error("Failed to directly update caregiver data in storage:", storageError);
        }
        
        Alert.alert("Success", "Profile picture updated successfully");
      } catch (error) {
        console.error('Error updating profile image:', error);
        Alert.alert('Error', 'Failed to update profile picture: ' + error.message);
      }
    } else {
      console.log("Image picker canceled or no image selected");
    }
  };
  
  // Creates a permanent copy of an image
  const createPermanentImageCopy = async (sourceUri, userEmail) => {
    try {
      // Create a unique filename based on the user's email and timestamp
      const timestamp = new Date().getTime();
      const filename = `caregiver_profile_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.jpg`;
      
      // Get the app's documents directory
      const documentsDir = FileSystem.documentDirectory;
      const destinationUri = `${documentsDir}${filename}`;
      
      console.log(`Copying image from ${sourceUri} to ${destinationUri}`);
      
      // Copy the file to the permanent location
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri
      });
      
      console.log(`Successfully copied image to ${destinationUri}`);
      return destinationUri;
    } catch (error) {
      console.error("Error creating permanent image copy:", error);
      // If copy fails, return the original URI as fallback
      return sourceUri;
    }
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMedicalChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      medicalInfo: { ...prev.medicalInfo, [field]: value }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const userToSave = {
        ...formData,
        updatedAt: new Date().toISOString()
      };
      
      console.log("Saving caregiver profile with image:", userToSave.profileImage ? "YES" : "NO");
      console.log("Medical info being saved:", 
        JSON.stringify({
          conditions: userToSave.medicalInfo?.conditions || '',
          medications: userToSave.medicalInfo?.medications || '',
          allergies: userToSave.medicalInfo?.allergies || '',
          bloodType: userToSave.medicalInfo?.bloodType || ''
        })
      );
      
      // Use updateCaregiver from the context to ensure proper saving
      const success = await updateCaregiver(userToSave);
      
      if (success) {
        // Additionally, ensure all data is directly saved to AsyncStorage for extra redundancy
        const caregiverDataKey = `caregiverData_${userToSave.email.toLowerCase().trim()}`;
        const storedData = await AsyncStorage.getItem(caregiverDataKey);
        
        if (storedData) {
          const caregiverData = JSON.parse(storedData);
          
          // Update all important fields
          caregiverData.name = userToSave.name;
          caregiverData.phone = userToSave.phone;
          caregiverData.age = userToSave.age;
          caregiverData.address = userToSave.address;
          
          // Update medical info
          caregiverData.medicalInfo = {
            conditions: userToSave.medicalInfo?.conditions || '',
            medications: userToSave.medicalInfo?.medications || '',
            allergies: userToSave.medicalInfo?.allergies || '',
            bloodType: userToSave.medicalInfo?.bloodType || ''
          };
          
          // Update profile image
          if (userToSave.profileImage) {
            caregiverData.profileImage = userToSave.profileImage;
          }
          
          // Save updated caregiver data
          await AsyncStorage.setItem(caregiverDataKey, JSON.stringify(caregiverData));
          console.log("Caregiver data directly saved during full profile update");
          
          // Verify the medical info was saved properly
          const verifyData = await AsyncStorage.getItem(caregiverDataKey);
          if (verifyData) {
            const parsedData = JSON.parse(verifyData);
            console.log("Verified medical info saved:", parsedData.medicalInfo ? "YES" : "NO");
            if (parsedData.medicalInfo) {
              console.log("Medical conditions saved:", parsedData.medicalInfo.conditions ? "YES" : "NO");
              console.log("Medications saved:", parsedData.medicalInfo.medications ? "YES" : "NO");
            }
          }
          
          // Also save profile image backup flags
          if (userToSave.profileImage) {
            await AsyncStorage.setItem(`caregiverHasProfileImage_${userToSave.email.toLowerCase().trim()}`, "true");
            await AsyncStorage.setItem(`caregiverProfileImagePath_${userToSave.email.toLowerCase().trim()}`, userToSave.profileImage);
          }
          
          // Sync profile data with server
          try {
            console.log("Syncing caregiver profile with server...");
            const syncResult = await syncCaregiverProfile(caregiverData.id);
            if (syncResult.success) {
              console.log("Caregiver profile synced successfully with server");
            } else {
              console.log("Caregiver profile sync failed, but local updates were successful");
            }
          } catch (syncError) {
            console.error("Error syncing caregiver profile with server:", syncError);
            // Continue with local updates even if sync fails
          }
        }
        
        if (onSave) {
          await onSave(userToSave);
        }
        
        Alert.alert('Success', 'Profile updated successfully');
        navigation.goBack();
      } else {
        throw new Error("Failed to update caregiver data through context");
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <TouchableOpacity onPress={openImageFullScreen}>
            <Image 
              source={profileImageSource}
              style={styles.profileImage}
              defaultSource={defaultProfileImage}
            />
            <TouchableOpacity 
              style={styles.cameraIcon}
              onPress={(e) => { e.stopPropagation(); selectImageSource(); }}
            >
              <Ionicons name="camera" size={24} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>
          <Text style={[styles.changePhotoText, { fontSize }]}>Tap photo to view full screen</Text>
          <Text style={[styles.changePhotoText, { fontSize }]}>Tap camera icon to change photo</Text>
        </View>

        {/* Basic Information Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize }]}>Basic Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              value={formData.name}
              onChangeText={(text) => handleChange('name', text)}
              placeholder="Enter your full name"
              placeholderTextColor="#666"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Email</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              value={formData.email}
              onChangeText={(text) => handleChange('email', text)}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#666"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              value={formData.phone}
              onChangeText={(text) => handleChange('phone', text)}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              placeholderTextColor="#666"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Age</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              value={formData.age}
              onChangeText={(text) => handleChange('age', text)}
              placeholder="Enter your age"
              keyboardType="numeric"
              placeholderTextColor="#666"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Address</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              value={formData.address}
              onChangeText={(text) => handleChange('address', text)}
              placeholder="Enter your address"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Medical Information Section */}
        <View style={[styles.section]}>
          <Text style={[styles.sectionTitle, { fontSize }]}>Medical Information</Text>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Medical Conditions</Text>
            <TextInput
              style={[styles.input, { height: 80, fontSize }]}
              value={formData.medicalInfo.conditions}
              onChangeText={(text) => handleMedicalChange('conditions', text)}
              placeholder="List your medical conditions"
              multiline
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Current Medications</Text>
            <TextInput
              style={[styles.input, { height: 80, fontSize }]}
              value={formData.medicalInfo.medications}
              onChangeText={(text) => handleMedicalChange('medications', text)}
              placeholder="List your current medications"
              multiline
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Allergies</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              value={formData.medicalInfo.allergies}
              onChangeText={(text) => handleMedicalChange('allergies', text)}
              placeholder="List any allergies"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontSize }]}>Blood Type</Text>
            <TextInput
              style={[styles.input, { fontSize }]}
              value={formData.medicalInfo.bloodType}
              onChangeText={(text) => handleMedicalChange('bloodType', text)}
              placeholder="Enter your blood type (e.g. A+)"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.saveButtonText, { fontSize }]}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Full Screen Image Modal */}
        <Modal
          visible={isImageModalVisible}
          transparent={true}
          onRequestClose={closeImageModal}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeImageModal}
            >
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
            <Image 
              source={profileImageSource}
              style={styles.fullScreenImage}
              resizeMode="contain"
              defaultSource={defaultProfileImage}
            />
            <TouchableOpacity 
              style={styles.changePhotoButton}
              onPress={() => {
                closeImageModal();
                selectImageSource();
              }}
            >
              <Text style={[styles.changePhotoButtonText, { fontSize }]}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  profilePictureSection: { alignItems: "center", marginBottom: 30 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: "#005BBB", marginBottom: 15 },
  cameraIcon: { position: "absolute", bottom: 10, right: 10, backgroundColor: "#005BBB", borderRadius: 20, padding: 8 },
  changePhotoText: { marginTop: 5, color: "#005BBB", fontWeight: "500", fontSize: 14 },
  section: { backgroundColor: "#FFF", borderRadius: 10, padding: 15, marginBottom: 20, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#005BBB", marginBottom: 15, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  inputContainer: { marginBottom: 15 },
  inputLabel: { fontSize: 16, color: "#2C3E50", marginBottom: 5, fontWeight: "500" },
  input: { backgroundColor: "#F0F5FF", borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: "#005BBB", color: "#2C3E50" },
  saveButton: { backgroundColor: "#005BBB", borderRadius: 8, padding: 15, alignItems: "center", marginTop: 10, elevation: 2 },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  fullScreenImage: { width: width, height: height * 0.7 },
  closeButton: { position: "absolute", top: 40, right: 20, zIndex: 1 },
  changePhotoButton: { position: "absolute", bottom: 40, backgroundColor: "#005BBB", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  changePhotoButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});

export default CaregiverEditProfileScreen;