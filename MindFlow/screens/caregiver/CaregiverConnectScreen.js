// screens/caregiver/CaregiverConnectScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import axios from 'axios';
import { useCaregiver } from '../../CaregiverContext';
import { useFontSize } from './CaregiverFontSizeContext';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL, handleApiError } from '../../config';

const CaregiverConnectScreen = () => {
  const { caregiver, loginCaregiver } = useCaregiver();
  const { fontSize } = useFontSize();
  const [patientEmail, setPatientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleConnect = async () => {
    if (!patientEmail) {
      Alert.alert('Error', 'Please enter the patient email.');
      return;
    }
    
    // Simple email validation
    if (!patientEmail.includes('@') || !patientEmail.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Normalize email for consistency
      const normalizedEmail = patientEmail.toLowerCase().trim();
      console.log(`Attempting to verify patient exists: ${normalizedEmail}`);
      console.log(`Making API call to: ${API_BASE_URL}/api/caregivers/check-patient/${normalizedEmail}`);
      
      // First check if the patient exists in the database
      try {
        const checkResponse = await axios.get(`${API_BASE_URL}/api/caregivers/check-patient/${normalizedEmail}`);
        console.log("Patient check response:", checkResponse.data);
        
        // If patient doesn't exist, show clear message and exit
        if (!checkResponse.data.exists) {
          Alert.alert(
            'Patient Not Found', 
            'This patient account does not exist or has been deleted. The patient needs to sign up before you can connect.'
          );
          setLoading(false);
          return;
        }
        
        console.log(`Patient ${normalizedEmail} verified, proceeding with connection`);
        console.log(`Making API call to: ${API_BASE_URL}/api/caregivers/connect`);
        
        // If the patient exists, proceed with connection
        try {
          const connectResponse = await axios.post(`${API_BASE_URL}/api/caregivers/connect`, {
            caregiverId: caregiver.id,
            patientEmail: normalizedEmail,
          });
          
          console.log("Connect response:", connectResponse.data);
          
          if (connectResponse.data.success) {
            // Update caregiver context with the connected patient info
            loginCaregiver(connectResponse.data.caregiver);
            Alert.alert('Success', 'Patient connected successfully.');
            navigation.replace('CaregiverHome');
          } else {
            Alert.alert('Connection Failed', connectResponse.data.message || 'Could not connect to patient.');
          }
        } catch (connectError) {
          const errorDetails = handleApiError(connectError, 'Failed to connect to patient');
          console.log("Connection error details:", errorDetails);
          
          Alert.alert(
            'Connection Failed', 
            errorDetails.message
          );
        }
      } catch (checkError) {
        const errorDetails = handleApiError(checkError, 'Failed to verify patient');
        console.log("Patient verification error details:", errorDetails);
        
        if (errorDetails.isNetworkError) {
          Alert.alert(
            'Connection Error', 
            'Could not reach the server. Please check your internet connection and try again.'
          );
        } else {
          Alert.alert(
            'Verification Error', 
            errorDetails.message
          );
        }
      }
    } catch (error) {
      console.error("General error:", error.message);
      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Connection',
      'You can connect to a patient later from the settings menu. Do you want to skip for now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => navigation.replace('CaregiverHome')
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: fontSize + 4 }]}>Connect to Patient</Text>
      <Text style={[styles.subtitle, { fontSize: fontSize }]}>Connect with a patient to monitor their activities and provide care.</Text>
      <TextInput
        style={[styles.input, { fontSize: fontSize }]}
        placeholder="Enter patient's email"
        value={patientEmail}
        onChangeText={setPatientEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity style={styles.button} onPress={handleConnect} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { fontSize: fontSize }]}>Connect</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={[styles.skipButtonText, { fontSize: fontSize - 1 }]}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F0F4F8' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#2C3E50' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 30, color: '#7F8C8D' },
  input: { borderWidth: 1, padding: 15, marginBottom: 15, borderRadius: 8, backgroundColor: '#fff', fontSize: 16, color: '#2C3E50' },
  button: { backgroundColor: '#D9534F', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  skipButton: { marginTop: 20, alignItems: 'center' },
  skipButtonText: { color: '#7F8C8D', fontSize: 16 }
});

export default CaregiverConnectScreen;
