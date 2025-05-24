// screens/CaregiverSignupScreen.js
import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, SafeAreaView, ScrollView } from "react-native";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useCaregiver } from '../../CaregiverContext';
import { API_BASE_URL } from '../../config';

const CaregiverSignupScreen = () => {
  const navigation = useNavigation();
  
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

  const emailRef = useRef(null);

  // Send verification code to email
  const sendVerificationCode = async () => {
    try {
      setResendLoading(true);
      console.log("Sending verification code to:", email);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/caregivers/send-email-verification`,
        { email: email.toLowerCase() }
      );
      
      if (response.data.success) {
        // Check if the server returned a verification code (in development mode)
        if (response.data.verificationCode) {
          setEmailVerificationCode(response.data.verificationCode);
          console.log("Verification code received from server:", response.data.verificationCode);
        } else {
          // In production, the code isn't sent back for security reasons
          // Instead, store a flag that we've sent a code
          console.log("Verification code sent to email (not returned by server)");
          setEmailVerificationCode("sent-to-email");
        }
        
        Alert.alert(
          "Verification Code Sent",
          "A verification code has been sent to your email. Please check your inbox and spam folder.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", response.data.message || "Failed to send verification code");
      }
    } catch (error) {
      console.error("Error sending verification code:", error);
      
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
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    
    // Proceed to email verification step
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
    
    // Get the entered code
    const enteredCodeStr = String(enteredEmailCode).trim();
    console.log("Entered code:", enteredCodeStr);
    
    // If we have the special flag "sent-to-email" instead of the actual code,
    // we need to verify it on the server
    if (emailVerificationCode === "sent-to-email") {
      try {
        console.log("Verifying code against server...");
        // Call the server to verify the code
        const response = await axios.post(
          `${API_BASE_URL}/api/caregivers/verify-code`,
          { 
            email: email.toLowerCase(),
            code: enteredCodeStr
          }
        );
        
        if (response.data.success) {
          // If server says the code is valid, proceed with signup
          console.log("Code verified by server");
          handleSignup();
        } else {
          Alert.alert("Error", "Invalid verification code. Please try again.");
        }
      } catch (error) {
        console.error("Error verifying code:", error);
        // If server can't be reached, fallback to direct signup for better UX
        // This is a somewhat risky approach but improves user experience in offline scenarios
        Alert.alert(
          "Verification Error", 
          "We couldn't verify your code with our server. Would you like to try again or proceed anyway?",
          [
            {
              text: "Try Again",
              style: "cancel"
            },
            {
              text: "Proceed Anyway",
              onPress: () => handleSignup()
            }
          ]
        );
      }
    } else {
      // We have the actual code to compare against (development mode)
      const expectedCodeStr = String(emailVerificationCode).trim();
      console.log("Expected code:", expectedCodeStr);
      
      if (enteredCodeStr === expectedCodeStr) {
        // Email verification passed, proceed with signup
        handleSignup();
      } else {
        Alert.alert("Error", "Invalid verification code. Please try again.");
      }
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/caregivers/signup`,
        { 
          firstName, 
          lastName, 
          name: `${firstName} ${lastName}`, 
          email: email.toLowerCase(), 
          password,
          phoneNumber 
        },
        { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data.success) {
        Alert.alert("Success", "Account created successfully!", [
          { text: "OK", onPress: () => navigation.replace("CaregiverLogin") }
        ]);
      } else {
        // Log the error for debugging but don't show to user
        console.log("Signup failed with response:", response.data);
        Alert.alert("Registration", "We couldn't complete your registration. Please try again later.");
      }
    } catch (error) {
      // Log the error for debugging purposes only, not visible to users
      console.error("Caregiver signup error:", error);
      
      // Handle specific error cases with user-friendly messages
      if (error.response?.data?.message === "Email already exists") {
        Alert.alert(
          "Account Exists", 
          "An account with this email already exists.", 
          [
            { 
              text: "Login Instead", 
              onPress: () => navigation.replace("CaregiverLogin")
            },
            {
              text: "Cancel",
              style: "cancel"
            }
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
    } finally {
      setLoading(false);
    }
  };

  // Render appropriate step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Text style={[styles.title, { fontSize: 20 }]}>Caregiver Sign Up</Text>
            <TextInput
              placeholder="First Name"
              placeholderTextColor="#666"
              value={firstName}
              onChangeText={setFirstName}
              style={[styles.input, { fontSize: 16 }]}
            />
            <TextInput
              placeholder="Last Name"
              placeholderTextColor="#666"
              value={lastName}
              onChangeText={setLastName}
              style={[styles.input, { fontSize: 16 }]}
            />
            <TextInput
              placeholder="Email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              ref={emailRef}
              style={[styles.input, { fontSize: 16 }]}
            />
            <TextInput
              placeholder="Password (min 6 characters)"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={[styles.input, { fontSize: 16 }]}
            />
            <TextInput
              placeholder="Phone Number (optional)"
              placeholderTextColor="#666"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              style={[styles.input, { fontSize: 16 }]}
            />
            <TouchableOpacity
              onPress={handleSubmitBasicInfo}
              style={styles.signupButton}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { fontSize: 16 }]}>Continue</Text>}
            </TouchableOpacity>
          </>
        );
      case 2:
        return (
          <>
            <Text style={[styles.title, { fontSize: 20 }]}>Email Verification</Text>
            <Text style={[styles.infoText, { fontSize: 16 }]}>We've sent a verification code to {email}</Text>
            <TextInput
              placeholder="Enter verification code"
              placeholderTextColor="#666"
              value={enteredEmailCode}
              onChangeText={setEnteredEmailCode}
              keyboardType="number-pad"
              style={[styles.input, { fontSize: 16 }]}
            />
            
            <TouchableOpacity 
              onPress={handleResendCode} 
              style={styles.resendButton}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <ActivityIndicator color="#212121" size="small" />
              ) : (
                <Text style={[styles.resendText, { fontSize: 15 }]}>Resend Code</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.backButton]} 
                onPress={() => setCurrentStep(1)}
              >
                <Text style={[styles.backButtonText, { fontSize: 16 }]}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={verifyEmailCodeAndSignup} 
                style={[styles.signupButton, styles.completeButton]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.buttonText, { fontSize: 16 }]}>Complete Signup</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.innerContainer}>
          {renderStepContent()}
          
          {currentStep === 1 && (
            <TouchableOpacity
              onPress={() => navigation.navigate("CaregiverLogin")}
              style={styles.loginLink}
            >
              <Text style={[styles.linkText, { fontSize: 15 }]}>Already have an account? Log In</Text>
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
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20, color: "#2C3E50" },
  infoText: { fontSize: 16, textAlign: "center", marginBottom: 20, color: "#2C3E50" },
  input: { borderWidth: 1, padding: 15, marginBottom: 15, borderRadius: 8, backgroundColor: "#fff", fontSize: 16, color: "#2C3E50" },
  signupButton: { backgroundColor: "#D9534F", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  loginLink: { marginTop: 15, alignItems: "center" },
  linkText: { color: "#2C3E50", fontWeight: "bold" },
  resendButton: { alignSelf: "center", marginVertical: 10, padding: 10 },
  resendText: { color: "#D9534F", fontWeight: "bold", textDecorationLine: "underline" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  backButton: { backgroundColor: "transparent", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: "#D9534F", flex: 1, marginRight: 5 },
  backButtonText: { color: "#D9534F", fontWeight: "bold", fontSize: 16 },
  completeButton: { flex: 1, marginLeft: 5 }
});

export default CaregiverSignupScreen;