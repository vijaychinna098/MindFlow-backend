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
import { useUser } from '../../UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../../config';
import { fetchProfileImageByEmail, forceProfileImageSync } from '../../services/DatabaseService';

// Ignore specific axios error warnings to prevent them from appearing in the app
LogBox.ignoreLogs(['AxiosError: Request failed with status code 400']);

const LoginScreen = () => {
  const navigation = useNavigation();
  const { loginUser } = useUser();
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
      console.log("Starting login process for:", email);
      
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();
      
      // Store the email early to ensure it's available throughout the process
      await AsyncStorage.setItem('currentUserEmail', normalizedEmail);
      console.log(`Stored current user email: ${normalizedEmail}`);
      
      // Call loginUser directly with correctly prepared parameters
      const userData = await loginUser(normalizedEmail, password);
      
      if (userData) {
        console.log("Login successful with user:", userData.name || normalizedEmail);
        console.log(`User email: ${userData.email}, Has profile image: ${userData.profileImage ? 'YES' : 'NO'}`);
        
        // Make sure the userData has the correct email
        if (!userData.email || userData.email !== normalizedEmail) {
          console.log(`Fixing email in user data from "${userData.email || 'missing'}" to "${normalizedEmail}"`);
          userData.email = normalizedEmail;
          
          // Update storage with correct email
          const userDataKey = `userData_${normalizedEmail}`;
          await AsyncStorage.setItem(userDataKey, JSON.stringify(userData));
        }
        
        // Force profile image synchronization to ensure cross-device consistency
        console.log("Starting aggressive profile image sync");
        try {
          // Try to force image synchronization between devices
          const forceSyncResult = await forceProfileImageSync(normalizedEmail);
          
          if (forceSyncResult.success) {
            console.log(`Forced image sync successful from ${forceSyncResult.source}`);
            
            // If we got a profile image, update the current user right away
            if (forceSyncResult.profileImage) {
              console.log("Updating current user with synced profile image");
              
              // Get the user update function to update in-memory state
              const { updateUser } = useUser();
              
              // Read latest user data and update it
              const userData = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
              if (userData) {
                const userObj = JSON.parse(userData);
                
                // Only update if image is different
                if (userObj.profileImage !== forceSyncResult.profileImage) {
                  userObj.profileImage = forceSyncResult.profileImage;
                  
                  // Save to local storage
                  await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userObj));
                  
                  // Update in-memory user object
                  await updateUser(userObj);
                  
                  console.log("User updated with synced profile image");
                }
              }
            }
          }
        } catch (syncError) {
          console.log(`Force image sync error: ${syncError.message}`);
          // Non-critical, continue with login
        }
        
        // Specifically fetch profile image by email as a backup approach
        try {
          const imageResult = await fetchProfileImageByEmail(normalizedEmail);
          
          if (imageResult.success) {
            console.log("Successfully fetched profile image by email");
            
            // If we got a profile image, update it in the current user data
            if (imageResult.profileImage) {
              console.log("Updating current user with fetched profile image");
              
              // Get the user update function
              const { updateUser } = useUser();
              
              // Read latest user data
              const userData = await AsyncStorage.getItem(`userData_${normalizedEmail}`);
              if (userData) {
                const userObj = JSON.parse(userData);
                
                // Only update if different
                if (userObj.profileImage !== imageResult.profileImage) {
                  userObj.profileImage = imageResult.profileImage;
                  
                  // Save to local storage
                  await AsyncStorage.setItem(`userData_${normalizedEmail}`, JSON.stringify(userObj));
                  
                  // Update in-memory user
                  await updateUser(userObj);
                }
              }
            }
          }
        } catch (imageError) {
          console.log("Error fetching profile image:", imageError.message);
          // Non-critical error, continue with login
        }
        
        // Force an additional profile sync as a final measure
        try {
          const { directDeviceToDeviceSync } = require('../../services/ImprovedProfileSyncService');
          console.log("Initiating direct device-to-device profile sync for data consistency");
          const syncResult = await directDeviceToDeviceSync(normalizedEmail);
          
          if (syncResult && syncResult.success) {
            console.log("Direct device-to-device sync completed successfully");
            
            // If sync returned updated user data, update it immediately
            if (syncResult.userData) {
              console.log("Direct sync returned updated user data, applying updates");
              await updateUser(syncResult.userData);
            }
            
            // Final verification to ensure user data is loaded properly
            const { loadUser } = useUser();
            await loadUser();
          }
        } catch (syncError) {
          console.log("Direct device sync error:", syncError.message);
          // Non-critical error, can continue
        }
        
        // No navigation needed - the app will automatically switch to UserStack
        // based on the isSignedIn state in UserContext
      } else {
        // Handle failed login
        Alert.alert(
          "Login Failed", 
          "Invalid email or password. Please try again or create a new account.",
          [
            { text: "Try Again", style: "default" },
            { 
              text: "Sign Up", 
              onPress: () => navigation.navigate("Signup", { email: normalizedEmail }),
              style: "default"
            }
          ]
        );
      }
    } catch (error) {
      // Handle network or unexpected errors
      console.log("Login error:", error.message);
      
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
    } finally {
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
      const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
      
      if (response.data.success) {
        Alert.alert(
          "Code Sent",
          "A verification code has been sent to your email. Please check your inbox and spam folder.",
          [{ text: "OK", onPress: () => navigation.navigate("ResetPassword", { email }) }]
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
        <Text style={styles.title}>Login</Text>
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
          onPress={() => navigation.navigate("Signup")} 
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
  loginButton: { backgroundColor: "#005BBB", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  forgotButton: { marginTop: 15, alignItems: "center" },
  signupButton: { marginTop: 10, alignItems: "center" },
  linkText: { color: "#2C3E50", fontWeight: "bold" },
});

export default LoginScreen;
