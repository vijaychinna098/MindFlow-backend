import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Switch, 
  TouchableOpacity, 
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFontSize } from './CaregiverFontSizeContext';
import { useCaregiver } from '../../CaregiverContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const CaregiverSettingsScreen = () => {
  const navigation = useNavigation();
  const { fontSize, setFontSize } = useFontSize();
  const { logoutCaregiver, caregiver, activePatient } = useCaregiver(); 
  const [reminders, setReminders] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [medicationAlerts, setMedicationAlerts] = useState(true);
  const [voiceAssistance, setVoiceAssistance] = useState(false);

  // Extract patient ID from activePatient or patientEmail
  const patientId = activePatient?.id || (caregiver.patientEmail ? caregiver.patientEmail.split('@')[0] : null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
        
        if (storedVoiceAssistance !== null) {
          setVoiceAssistance(storedVoiceAssistance === 'true');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  const toggleVoiceAssistance = async () => {
    try {
      const newValue = !voiceAssistance;
      setVoiceAssistance(newValue);
      await AsyncStorage.setItem('voiceAssistance', newValue.toString());
    } catch (error) {
      console.error('Error saving Voice Assistance setting:', error);
    }
  };

  const handleLogout = async () => {
    const success = await logoutCaregiver();
    if (success) {
      navigation.navigate("CaregiverLogin");
    }
  };

  const handlePatientHistory = () => {
    if (activePatient) {
      // If we have an active patient, navigate to their history with full patient details
      navigation.navigate("PatientHistory", { 
        patientId: activePatient.id,
        patientEmail: activePatient.email,
        patientName: activePatient.name
      });
    } else if (caregiver.patientEmail) {
      // If no active patient but we have patientEmail, try to use that
      navigation.navigate("PatientHistory", { 
        patientId: null, // Let the PatientHistory screen resolve ID from email
        patientEmail: caregiver.patientEmail,
        patientName: "Patient" // Default name if not known
      });
    } else {
      // No patient connected
      Alert.alert(
        "No Patient Connected", 
        "Please connect to a patient first to view their history.",
        [{ text: "OK" }]
      );
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. You will need to sign up again if you want to access the app.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            // Check if we have a valid caregiver ID first
            if (!caregiver || (!caregiver.id && !caregiver.email)) {
              console.error('Cannot delete account: No caregiver ID or email found');
              Alert.alert('Error', 'Unable to identify your account. Please try logging out and back in.');
              return;
            }

            console.log(`Attempting to delete caregiver account: ${caregiver.id || caregiver.email}`);

            // Create payload with both ID and email to ensure one works
            const deletePayload = {
              caregiverId: caregiver.id || undefined,
              caregiverEmail: caregiver.email || undefined
            };

            console.log("Delete payload:", JSON.stringify(deletePayload));

            // Ensure we have a valid API URL
            const apiUrl = `${API_BASE_URL}/api/caregivers/deleteAccount`;
            console.log(`Using API URL: ${apiUrl}`);

            // Send deletion request
            const response = await axios.post(apiUrl, deletePayload);

            if (response.data && response.data.success) {
              // Clear all local storage
              await AsyncStorage.clear();
              
              // Handle patientEmails if available (clean up other connections)
              if (caregiver.patients && Array.isArray(caregiver.patients)) {
                console.log(`Removing connections with ${caregiver.patients.length} patients`);
                // This is optional cleanup and won't block account deletion if it fails
              }
              
              // Logout and navigate to welcome screen
              await logoutCaregiver();
              
              // Navigate to Welcome screen instead of Signup
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            } else {
              Alert.alert('Error', response.data?.message || 'Failed to delete account. Please try again.');
            }
          } catch (error) {
            console.log('Delete account error:', error.message || error);
            
            // Add more detailed error logging
            if (error.response) {
              console.log('Error response data:', JSON.stringify(error.response.data));
              console.log('Error response status:', error.response.status);
            } else if (error.request) {
              console.log('Error request:', 'No response received from server');
            } else {
              console.log('Error message:', error.message);
            }
            
            // Try alternative approach with just the email if ID approach failed
            if ((error.response?.status === 404 || error.message?.includes('404')) && caregiver.email) {
              try {
                console.log(`Attempting to delete by email as fallback: ${caregiver.email}`);
                const alternativeResponse = await axios.post(`${API_BASE_URL}/api/caregivers/deleteAccount`, {
                  caregiverEmail: caregiver.email
                });
                
                if (alternativeResponse.data && alternativeResponse.data.success) {
                  await AsyncStorage.clear();
                  await logoutCaregiver();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Welcome' }],
                  });
                  return;
                }
              } catch (fallbackError) {
                console.log('Fallback delete attempt failed:', fallbackError.message || fallbackError);
                
                // If both attempts failed but we're seeing server responses, try to delete directly in AsyncStorage
                try {
                  console.log('Attempting local cleanup as last resort');
                  await AsyncStorage.clear();
                  await logoutCaregiver();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Welcome' }],
                  });
                  return;
                } catch (localError) {
                  console.log('Local cleanup failed:', localError.message);
                }
              }
            }
            
            // Show error to user
            Alert.alert('Error', `Failed to delete account: ${error.response?.data?.message || error.message || 'Please try again.'}`);
          }
        }}
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { fontSize }]}>Settings</Text>
      
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontSize }]}>App Settings</Text>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Reminders</Text>
          <Switch 
            value={reminders} 
            onValueChange={setReminders} 
            trackColor={{ false: "#E0E0E0", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Location Sharing</Text>
          <Switch 
            value={locationSharing} 
            onValueChange={setLocationSharing} 
            trackColor={{ false: "#E0E0E0", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Medication Alerts</Text>
          <Switch 
            value={medicationAlerts} 
            onValueChange={setMedicationAlerts} 
            trackColor={{ false: "#E0E0E0", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Voice Assistance</Text>
          <Switch 
            value={voiceAssistance} 
            onValueChange={toggleVoiceAssistance}
            trackColor={{ false: "#E0E0E0", true: "#005BBB" }} 
            thumbColor="#FFF" 
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { fontSize }]}>Font Size</Text>
          <Slider
            style={{ flex: 1 }}
            minimumValue={14}
            maximumValue={22}
            value={fontSize}
            onValueChange={setFontSize}
            minimumTrackTintColor="#005BBB"
            maximumTrackTintColor="#E0E0E0"
            thumbTintColor="#FFF"
          />
          <Text style={[styles.fontSizeText, { fontSize }]}>{Math.round(fontSize)}</Text>
        </View>
      </View>

      {!caregiver.patientEmail && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { fontSize }]}>Patient Connection</Text>
          <TouchableOpacity 
            style={styles.row}
            onPress={() => navigation.navigate("CaregiverConnect")}
          >
            <Text style={[styles.helpText, { fontSize }]}>Connect to Patient</Text>
            <Ionicons name="chevron-forward" size={20} color="#005BBB" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontSize }]}>Help & Support</Text>
        <TouchableOpacity 
          style={styles.row}
          onPress={() => navigation.navigate("HowToUse", { isCaregiver: true })}
        >
          <Text style={[styles.helpText, { fontSize }]}>How to Use This App</Text>
          <Ionicons name="chevron-forward" size={20} color="#005BBB" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.row}
          onPress={handlePatientHistory}
        >
          <Text style={[styles.helpText, { fontSize }]}>Patient History</Text>
          <Ionicons name="chevron-forward" size={20} color="#005BBB" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.row}
          onPress={() => navigation.navigate("PrivacyPolicy")}
        >
          <Text style={[styles.helpText, { fontSize }]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color="#005BBB" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="#D9534F" />
        <Text style={[styles.logoutText, { fontSize }]}>Logout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Ionicons name="trash" size={24} color="#D9534F" />
        <Text style={[styles.deleteText, { fontSize }]}>Delete Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8", padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: "#2C3E50", textAlign: "center", marginBottom: 20 },
  card: { backgroundColor: "#FAFAFA", borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#005BBB", marginBottom: 15, borderBottomWidth: 1, borderBottomColor: "#EEE", paddingBottom: 5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  settingLabel: { fontSize: 16, color: "#2C3E50" },
  helpText: { fontSize: 16, color: "#2C3E50" },
  fontSizeText: { fontSize: 16, color: "#2C3E50", marginLeft: 10 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9534F",
    backgroundColor: "#FFF"
  },
  logoutText: { fontSize: 16, color: "#D9534F", fontWeight: "bold", marginLeft: 10 },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 40,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9534F",
    backgroundColor: "#FFF"
  },
  deleteText: { fontSize: 16, color: "#D9534F", fontWeight: "bold", marginLeft: 10 }
});

export default CaregiverSettingsScreen;
