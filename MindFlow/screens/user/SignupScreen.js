import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, SafeAreaView, ScrollView, LogBox } from "react-native";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../../UserContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigationRef } from "../../NavigationRef";
import { API_BASE_URL } from '../../config';

// Ignore specific axios error warnings to prevent them from appearing in the app
LogBox.ignoreLogs(['AxiosError: Request failed with status code 400']);

const SignupScreen = () => {
  const navigation = useNavigation();
  const { currentUser, logoutUser } = useUser();
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  
  // User information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  // Verification codes
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [enteredEmailCode, setEnteredEmailCode] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Get email from navigation params if available
  useEffect(() => {
    const params = navigation.getState()?.routes[navigation.getState()?.index]?.params;
    if (params?.email) {
      setEmail(params.email);
    }
  }, [navigation]);

  // Send verification code to email
  const sendVerificationCode = async () => {
    try {
      setResendLoading(true);
      console.log("Sending verification code to:", email);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/send-email-verification`,
        { email: email.toLowerCase() }
      );
      
      if (response.data.success) {
        setEmailVerificationCode(response.data.verificationCode);
        Alert.alert(
          "Verification Code Sent",
          "A verification code has been sent to your email. Please check your inbox and spam folder.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", response.data.message || "Failed to send verification code");
      }
    } catch (error) {
      // Only log the error message, not the full error
      console.log("Error sending verification code:", error.message);
      
      let errorMessage = "Failed to send verification code. Please try again.";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message === "Network Error") {
        errorMessage = "Network error. Please check your internet connection and try again.";
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  // Step 1: Basic info collection
  const handleSubmitBasicInfo = () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    if (!email.toLowerCase().endsWith("@gmail.com")) {
      Alert.alert("Error", "Only Gmail addresses are allowed");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    
    // Proceed to email verification
    setCurrentStep(2);
    // Send verification code
    sendVerificationCode();
  };

  // Handle resend verification code
  const handleResendCode = () => {
    sendVerificationCode();
  };

  // Step 3: Verify email code and proceed to signup
  const verifyEmailCodeAndSignup = async () => {
    if (!enteredEmailCode) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }
    
    if (enteredEmailCode === emailVerificationCode) {
      // Email verification passed, proceed with signup
      try {
        setLoading(true);
        
        // Create user object
        const userData = {
          name: `${firstName} ${lastName}`,
          email: email.toLowerCase(),
          password: password,
          phone: phoneNumber || ""
        };
        
        console.log("SignupScreen - User data being sent:", {
          email: userData.email,
          phone: userData.phone,
          hasPhoneNumber: !!userData.phone
        });
        
        // Send signup request
        try {
          const response = await axios.post(`${API_BASE_URL}/api/auth/signup`, userData);
          
          if (response.data.success) {
            Alert.alert("Signup Successful", "Your account has been created successfully.", [
              { text: "OK", onPress: () => navigation.replace("Login") }
            ]);
          }
        } catch (error) {
          // Only log the error message, not the full error object that shows up in the UI
          console.log("Signup error: " + error.message);
          
          // Handle specific error cases with user-friendly messages
          if (error.response?.data?.message === "Email already exists") {
            Alert.alert(
              "Account Exists", 
              "An account with this email already exists. Please login instead.",
              [
                { text: "Login", onPress: () => navigation.replace("Login") },
                { text: "Cancel", style: "cancel" }
              ]
            );
          } else {
            // Generic user-friendly message for all other errors
            let friendlyMessage = "We couldn't complete your registration. Please try again later.";
            
            // Customize the message based on the error type without exposing technical details
            if (error.response?.status === 400) {
              friendlyMessage = "Please check your information and try again.";
            } else if (error.message === "Network Error") {
              friendlyMessage = "Network error. Please check your internet connection and try again.";
            }
            
            Alert.alert("Registration", friendlyMessage);
          }
        }
      } finally {
        setLoading(false);
      }
    } else {
      Alert.alert("Error", "Invalid verification code. Please try again.");
    }
  };

  // Render the appropriate step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Create Your Account</Text>
            <Text style={styles.stepSubtitle}>Step 1: Basic Information</Text>
            
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email (Gmail only)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password (min. 6 characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone Number (optional)"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleSubmitBasicInfo}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        );
        
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Email Verification</Text>
            <Text style={styles.stepSubtitle}>Step 2: Verify Your Email</Text>
            
            <Text style={styles.instructionText}>
              We've sent a verification code to {email}. Please enter it below.
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit verification code"
              value={enteredEmailCode}
              onChangeText={setEnteredEmailCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            
            <TouchableOpacity 
              onPress={handleResendCode} 
              style={styles.resendButton}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <ActivityIndicator color="#212121" size="small" />
              ) : (
                <Text style={styles.resendText}>Resend Code</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={() => setCurrentStep(1)}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.button} 
                onPress={verifyEmailCodeAndSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Complete Signup</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
        
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.innerContainer}>
          {renderStep()}
          
          {currentStep === 1 && (
            <TouchableOpacity 
              onPress={() => {
                navigationRef.current?.navigate("Login");
              }} 
              style={styles.loginLink}
            >
              <Text style={styles.linkText}>Already have an account? Log In</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  scrollContainer: { flexGrow: 1 },
  innerContainer: { flex: 1, justifyContent: "center", padding: 20 },
  stepContainer: { padding: 20 },
  stepTitle: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20, color: "#2C3E50" },
  stepSubtitle: { fontSize: 16, textAlign: "center", marginBottom: 20, color: "#2C3E50" },
  instructionText: { fontSize: 16, textAlign: "center", marginBottom: 20, color: "#2C3E50" },
  input: { borderWidth: 1, padding: 15, marginBottom: 15, borderRadius: 8, backgroundColor: "#fff", fontSize: 16, color: "#2C3E50" },
  button: { backgroundColor: "#005BBB", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  secondaryButton: { backgroundColor: "transparent", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  secondaryButtonText: { color: "#005BBB", fontWeight: "bold", fontSize: 16 },
  loginLink: { marginTop: 15, alignItems: "center" },
  linkText: { color: "#2C3E50", fontWeight: "bold" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  resendButton: { alignSelf: "center", marginVertical: 10, padding: 10 },
  resendText: { color: "#005BBB", fontWeight: "bold", textDecorationLine: "underline" },
});

export default SignupScreen;
