// screens/CaregiverResetPasswordScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, SafeAreaView } from "react-native";
import axios from "axios";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCaregiver } from '../../CaregiverContext';
import { sendVerificationEmail } from "../../EmailService";
import { API_BASE_URL } from '../../config';

const CaregiverResetPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email || "";
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState(`Enter the verification code sent to your email`);
  const [emailSent, setEmailSent] = useState(true);

  useEffect(() => {
    if (email) {
      setMessage(`Enter the verification code sent to ${email}`);
    }
  }, [email]);

  const sendVerificationCode = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setResendLoading(true);
    try {
      // Send request to backend to generate and send verification code
      const response = await axios.post(
        `${API_BASE_URL}/api/caregivers/forgot-password`,
        { email: email.toLowerCase() }
      );
      
      if (response.data.success) {
        // Only show a generic message, not containing the actual code
        Alert.alert(
          'Verification Code Sent', 
          'A verification code has been sent to your email. Please check your inbox and spam folder.',
          [{ text: "OK" }]
        );
        setEmailSent(true);
      } else {
        Alert.alert('Error', 'Failed to send verification code. Please try again.');
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      
      // Extract detailed error message for better user feedback
      let errorMessage = "Failed to send verification code. Please try again.";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message === "Network Error") {
        errorMessage = "Network error. Please check your internet connection and try again.";
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    
    setLoading(true);
    try {
      console.log("Attempting to reset password with code:", code);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/caregivers/reset-password`,
        { 
          email: email.toLowerCase(), 
          code: code, 
          newPassword 
        }
      );
      
      console.log("Reset password response:", response.data);
      
      if (response.data.success) {
        Alert.alert("Success", "Password reset successfully!", [
          { text: "OK", onPress: () => navigation.replace("CaregiverLogin") }
        ]);
      } else {
        Alert.alert("Error", response.data.message || "Password reset failed. Please try again.");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      
      let userMessage = "Password reset failed. Please try again.";
      
      if (error.response?.data?.message) {
        userMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        userMessage = "Invalid verification code or password. Please check your code and try again.";
      } else if (error.response?.status === 404) {
        userMessage = "Account not found. Please check your email address.";
      } else if (error.response?.status === 500) {
        userMessage = "Server error. Please try again later.";
      } else if (!error.response) {
        userMessage = "Network error. Please check your internet connection and try again.";
      }
      
      Alert.alert("Error", userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    sendVerificationCode();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>{message}</Text>
      <TextInput
        placeholder="6-digit code"
        placeholderTextColor="#666"
        value={code}
        onChangeText={setCode}
        keyboardType="numeric"
        maxLength={6}
        style={styles.input}
      />
      <TextInput
        placeholder="New password (min 6 characters)"
        placeholderTextColor="#666"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        style={styles.input}
      />
      <TextInput
        placeholder="Confirm new password"
        placeholderTextColor="#666"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={styles.input}
      />
      <TouchableOpacity
        onPress={handleResetPassword}
        style={styles.resetButton}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleResendCode}
        style={styles.resendButton}
        disabled={resendLoading}
      >
        {resendLoading ? <ActivityIndicator color="#212121" /> : <Text style={styles.resendText}>Resend Code</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8", justifyContent: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 10, color: "#2C3E50" },
  subtitle: { textAlign: "center", marginBottom: 30, color: "#2C3E50" },
  input: { borderWidth: 1, padding: 15, marginBottom: 15, borderRadius: 8, backgroundColor: "#fff", fontSize: 16, color: "#2C3E50" },
  resetButton: { backgroundColor: "#D9534F", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  resendButton: { marginTop: 20, alignItems: "center" },
  resendText: { color: "#2C3E50", fontWeight: "bold", textDecorationLine: "underline" },
});

export default CaregiverResetPasswordScreen;