import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import Tts from 'react-native-tts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useFontSize } from '../../FontSizeContext';
import { useUser } from '../../UserContext';
import { useNavigation } from '@react-navigation/native';

const VoiceAssistanceScreen = () => {
  const { fontSize } = useFontSize();
  const { currentUser } = useUser();
  const navigation = useNavigation();
  const [reminders, setReminders] = useState([]);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [voiceAssistanceEnabled, setVoiceAssistanceEnabled] = useState(false);

  // Load voice assistance setting
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedVoiceAssistance = await AsyncStorage.getItem('voiceAssistance');
        if (storedVoiceAssistance !== null) {
          setVoiceAssistanceEnabled(storedVoiceAssistance === 'true');
        }
      } catch (error) {
        console.error('Error loading voice assistance setting:', error);
      }
    };
    
    loadSettings();
    
    // Add a listener to reload settings when the screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      loadSettings();
    });
    
    // Clean up the listener
    return () => unsubscribe();
  }, [navigation]);

  // When reminders or voice settings change, check if a reminder is due.
  useEffect(() => {
    if (voiceAssistanceEnabled) {
      checkReminders();
    }
  }, [reminders, voiceAssistanceEnabled]);

  // When screen is focused, fetch reminders from storage.
  useFocusEffect(
    React.useCallback(() => {
      fetchReminders();
    }, [])
  );

  const fetchReminders = async () => {
    try {
      const storedReminders = await AsyncStorage.getItem('reminders');
      if (storedReminders) {
        setReminders(JSON.parse(storedReminders));
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } 
  };

  // Check each reminder against the current time.
  const checkReminders = () => {
    if (!reminders || !Array.isArray(reminders)) return;
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    reminders.forEach(reminder => {
      if (reminder.time === currentTime) {
        speakReminder(reminder);
      }
    });
  };

  const speakReminder = (reminder) => {
    if (!voiceAssistanceEnabled) return;
    
    const username = currentUser?.name || "friend";
    const message = `Reminder, hey ${username}, now it's time to ${reminder.title} and the time is ${reminder.time}`;
    Tts.speak(message, { language: 'en-US', rate: 0.9 });
    Alert.alert('Reminder Alert', message);
  };

  // When the screen opens, immediately check if any reminder is due and speak it (only once).
  useEffect(() => {
    if (!reminders || !Array.isArray(reminders)) return;
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    reminders.forEach(reminder => {
      if (reminder.time === currentTime && !hasSpoken) {
        speakReminder(reminder);
        setHasSpoken(true);
      }
    });
  }, [reminders, hasSpoken]);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize }]}>Voice Assistance</Text>
      
      {voiceAssistanceEnabled ? (
        <Text style={[styles.info, { fontSize }]}>Listening for reminders...</Text>
      ) : (
        <View style={styles.disabledContainer}>
          <Text style={[styles.disabledText, { fontSize }]}>Voice Assistance is currently disabled</Text>
          <Text style={[styles.disabledSubtext, { fontSize: fontSize - 2 }]}>
            Enable Voice Assistance in Settings to use this feature.
          </Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F0F4F8' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#005BBB',
    marginBottom: 20
  },
  info: { 
    fontSize: 16, 
    color: '#2C3E50', 
    marginTop: 10 
  },
  disabledContainer: {
    alignItems: 'center',
    padding: 20
  },
  disabledText: {
    fontSize: 18,
    color: '#555',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  disabledSubtext: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20
  },
  settingsButton: {
    backgroundColor: '#005BBB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10
  },
  settingsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  }
});

export default VoiceAssistanceScreen;
