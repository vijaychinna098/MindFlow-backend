// CaregiverLoginScreen.js
import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  StyleSheet,
  SafeAreaView,
  LogBox
} from "react-native";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
// Use relative path instead of absolute path
import { useCaregiver } from '../../CaregiverContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../../config';

// Ignore specific axios error warnings to prevent them from appearing in the app
LogBox.ignoreLogs(['AxiosError: Request failed with status code 400']);

const CaregiverLoginScreen = () => {
  const navigation = useNavigation();
  const { loginCaregiver } = useCaregiver();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      // First check if we have caregiver data stored locally for this email
      console.log(`Checking for existing stored data for caregiver ${email}`);
      const normalizedEmail = email.toLowerCase().trim();
      const caregiverDataKey = `caregiverData_${normalizedEmail}`;
      
      // Check AsyncStorage for existing caregiver data
      let existingCaregiverData = null;
      let hasLocalData = false;
      try {
        const storedData = await AsyncStorage.getItem(caregiverDataKey);
        if (storedData) {
          console.log("Found existing stored caregiver data");
          existingCaregiverData = JSON.parse(storedData);
          hasLocalData = true;
          console.log("Existing name:", existingCaregiverData.name);
          console.log("Existing profile image:", existingCaregiverData.profileImage ? "YES" : "NO");
        } else {
          console.log("No existing stored caregiver data found");
        }
      } catch (storageError) {
        console.log("Error checking AsyncStorage:", storageError.message);
      }
      
      // If we have local data, skip email check and try login directly
      if (!hasLocalData) {
        // First check if email exists
        try {
          console.log("Checking if email exists:", normalizedEmail);
          await axios.post(`${API_BASE_URL}/api/caregivers/check-email`, { email: normalizedEmail });
          console.log("Email exists, attempting login");
        } catch (emailCheckError) {
          if (emailCheckError.response && emailCheckError.response.status === 404) {
            setLoading(false);
            console.log("Email not found in database");
            Alert.alert(
              "Account Not Found",
              "This email is not registered. Would you like to create a new account?",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Sign Up", 
                  onPress: () => navigation.navigate("CaregiverSignup", { email }),
                  style: "default"
                }
              ]
            );
            return; // Exit the function early
          }
          // If there's another error with email check, continue with login attempt
          console.log("Error checking email, will try login anyway:", emailCheckError.message);
        }
      } else {
        console.log("Local data exists, bypassing email check and trying login directly");
      }
      
      // Proceed with server login
      try {
        const response = await axios.post(`${API_BASE_URL}/api/caregivers/login`, { email, password });
        if (response.status === 200) {
          console.log("Login response from server:", response.data);
          
          // Process profile image - use null if it's a placeholder to allow default to work
          let profileImage = response.data.caregiver.profileImage;
          if (profileImage && profileImage.includes('placeholder.com')) {
            console.log("Using null for placeholder image to allow default image to work");
            profileImage = null;
          }
          
          // Check if we have a backed up profile image for this caregiver
          try {
            const hasProfileImage = await AsyncStorage.getItem(`caregiverHasProfileImage_${normalizedEmail}`);
            
            if (hasProfileImage === "true" && !profileImage) {
              console.log("Found profile image flag but no profile image from server, checking local backup");
              const savedImagePath = await AsyncStorage.getItem(`caregiverProfileImagePath_${normalizedEmail}`);
              
              if (savedImagePath) {
                console.log("Found backed up profile image path:", savedImagePath);
                
                // Verify the file exists
                try {
                  const fileInfo = await FileSystem.getInfoAsync(savedImagePath);
                  
                  if (fileInfo.exists) {
                    console.log("Local profile image exists, using it");
                    profileImage = savedImagePath;
                  } else {
                    console.log("Local profile image doesn't exist anymore");
                  }
                } catch (fsError) {
                  console.log("Error checking profile image file:", fsError.message);
                }
              }
            }
          } catch (backupError) {
            console.log("Error checking backed up profile image:", backupError.message);
          }
          
          // Combine server data with existing stored data, prioritizing stored data for caregiver-editable fields
          // but keeping authentication data from the server
          const caregiverData = {
            id: response.data.caregiver.id,
            name: existingCaregiverData?.name || response.data.caregiver.name,
            email: response.data.caregiver.email,
            token: response.data.token,
            patientEmail: response.data.caregiver.patientEmail,
            profileImage: existingCaregiverData?.profileImage || profileImage,
            phone: existingCaregiverData?.phone || response.data.caregiver.phone || '',
            address: existingCaregiverData?.address || response.data.caregiver.address || '',
            age: existingCaregiverData?.age || response.data.caregiver.age || '',
            medicalInfo: existingCaregiverData?.medicalInfo || response.data.caregiver.medicalInfo || {
              conditions: '',
              medications: '',
              allergies: '',
              bloodType: ''
            },
            homeLocation: existingCaregiverData?.homeLocation || response.data.caregiver.homeLocation || null
          };
          
          console.log("CaregiverLoginScreen - Caregiver data being sent to loginCaregiver:", {
            email: caregiverData.email,
            phone: caregiverData.phone,
            hasPhoneNumber: !!caregiverData.phone,
            patientEmail: caregiverData.patientEmail || 'Not connected to patient'
          });
          
          console.log("Sending merged caregiver data to loginCaregiver");
          
          await loginCaregiver(caregiverData);
          
          // Navigate to CaregiverHome
          navigation.replace("CaregiverHome");
        }
      } catch (error) {
        // Don't log the raw 401 error to console
        if (!(error.response && error.response.status === 401)) {
          console.log("Caregiver login error:", error.message);
        } else {
          console.log("Caregiver login failed - handling gracefully");
        }
        
        // Handle caregiver not found errors (401 status with specific message)
        if (error.response && error.response.status === 401) {
          const errorMessage = error.response.data?.message || "";
          const isAccountNotFound = errorMessage.includes("Account not found") || 
                                   errorMessage.includes("not registered") || 
                                   errorMessage.includes("sign up");
          
          if (isAccountNotFound) {
            Alert.alert(
              "Account Not Found",
              "This email is not registered. Would you like to create a new account?",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Sign Up", 
                  onPress: () => navigation.navigate("CaregiverSignup", { email }),
                  style: "default"
                }
              ]
            );
          } else {
            // For other authentication errors like wrong password
            Alert.alert("Login Failed", "Invalid email or password. Please try again.");
          }
        } else {
          // Handle other errors, with special handling for network issues
          let errorMessage = "Login failed. Please try again.";
          
          if (error.response) {
            // Server responded with an error status code
            errorMessage = error.response.data?.message || errorMessage;
          } else if (error.request) {
            // The request was made but no response was received (network error)
            console.log("Network Error - No response received:", error.request);
            errorMessage = "Connection error. Please check your internet connection.";
            
            // Show a more helpful alert for network errors
            Alert.alert(
              "Connection Error",
              "Unable to connect to the MindFlow server. This could be due to:\n\n" +
              "• No internet connection\n" +
              "• The MindFlow server is temporarily down\n\n" +
              "Would you like to try again?",
              [
                { 
                  text: "Try Again", 
                  onPress: () => handleLogin(),
                  style: "default" 
                },
                { text: "Cancel", style: "cancel" }
              ]
            );
            setLoading(false);
            return; // Return early to prevent showing another alert
          } else if (error.message && error.message.includes('timeout')) {
            // Timeout error
            errorMessage = "Server is taking too long to respond. Please try again later.";
          }
          
          Alert.alert("Error", errorMessage);
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.log("Caregiver login error:", error.message);
      
      // Handle caregiver not found errors
      if (error.response && error.response.status === 401) {
        Alert.alert(
          "Login Failed",
          "Invalid email or password. Please try again.",
          [{ text: "OK" }]
        );
      } else {
        // Handle other errors
        let errorMessage = "Login failed. Please try again.";
        
        if (error.response) {
          errorMessage = error.response.data?.message || errorMessage;
        } else if (error.request) {
          errorMessage = "Connection error. Please check your internet connection.";
        }
        
        Alert.alert("Error", errorMessage);
      }
      
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email first");
      return;
    }
    setResetLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/caregivers/forgot-password`, { email });
      
      if (response.data.success) {
        Alert.alert(
          "Code Sent",
          "A verification code has been sent to your email. Please check your inbox and spam folder.",
          [{ text: "OK", onPress: () => navigation.navigate("CaregiverResetPassword", { email }) }]
        );
      } else {
        Alert.alert("Error", response.data.message || "Failed to send reset code");
      }
    } catch (error) {
      // Only log the error message, not the full error
      console.log("Forgot password error:", error.message);
      const errorMessage = error.response?.data?.message || "Failed to send reset code. Please try again later.";
      Alert.alert("Error", errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Caregiver Login</Text>
        <TextInput
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        <TouchableOpacity 
          onPress={handleLogin} 
          style={styles.loginButton}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleForgotPassword} 
          style={styles.forgotButton}
          disabled={resetLoading}
        >
          {resetLoading ? (
            <ActivityIndicator color="#2C3E50" />
          ) : (
            <Text style={styles.linkText}>Forgot Password?</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate("CaregiverSignup")} 
          style={styles.signupButton}
        >
          <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  innerContainer: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 30, color: "#2C3E50" },
  input: { borderWidth: 1, padding: 15, marginBottom: 15, borderRadius: 8, backgroundColor: "#fff", fontSize: 16, color: "#2C3E50" },
  loginButton: { backgroundColor: "#D9534F", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  forgotButton: { marginTop: 15, alignItems: "center" },
  signupButton: { marginTop: 10, alignItems: "center" },
  linkText: { color: "#2C3E50", fontWeight: "bold" },
});

export default CaregiverLoginScreen;
