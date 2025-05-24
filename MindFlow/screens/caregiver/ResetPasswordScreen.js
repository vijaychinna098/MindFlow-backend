import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, SafeAreaView } from "react-native";
import axios from "axios";
import { useNavigation, useRoute } from "@react-navigation/native";
import { API_BASE_URL } from '../../config';

const ResetPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email || "";
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState("Enter verification code sent to your email");

  useEffect(() => {
    if (email) {
      setMessage(`Enter verification code sent to ${email}`);
    }
  }, [email]);

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
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email: email.toLowerCase(),
        code,
        newPassword
      });
      if (response.data.success) {
        Alert.alert("Success", "Password reset successfully!", [
          { text: "OK", onPress: () => navigation.replace("Login") }
        ]);
      }
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email: email.toLowerCase() });
      if (response.data.success) {
        Alert.alert("Success", "New verification code sent");
      } else {
        Alert.alert("Error", response.data.message || "Failed to resend code");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send code. Please check your connection.");
    } finally {
      setResendLoading(false);
    }
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
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Reset Password</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={handleResendCode} 
        style={styles.resendButton}
        disabled={resendLoading}
      >
        {resendLoading ? (
          <ActivityIndicator color="#212121" />
        ) : (
          <Text style={styles.resendText}>Resend Code</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8", justifyContent: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 10, color: "#2C3E50" },
  subtitle: { textAlign: "center", marginBottom: 30, color: "#2C3E50" },
  input: { borderWidth: 1, padding: 15, marginBottom: 15, borderRadius: 8, backgroundColor: "#fff", fontSize: 16, color: "#2C3E50" },
  resetButton: { backgroundColor: "#005BBB", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  resendButton: { marginTop: 20, alignItems: "center" },
  resendText: { color: "#2C3E50", fontWeight: "bold", textDecorationLine: "underline" },
});

export default ResetPasswordScreen;
