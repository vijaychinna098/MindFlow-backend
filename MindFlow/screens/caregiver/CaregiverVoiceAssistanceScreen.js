import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Tts from 'react-native-tts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useFontSize } from './CaregiverFontSizeContext';
import { useCaregiver } from '../../CaregiverContext';

const CaregiverVoiceAssistanceScreen = () => {
  const { fontSize } = useFontSize();
  const { caregiver } = useCaregiver();
  const [reminders, setReminders] = useState([]);
  const [hasSpoken, setHasSpoken] = useState(false);

  // When reminders or voice settings change, check if a reminder is due.
  useEffect(() => {
    if (caregiver?.voiceAssistance) {
      checkReminders();
    }
  }, [reminders, caregiver]);

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
    const username = caregiver?.name || "friend";
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
      <Text style={[styles.info, { fontSize }]}>Listening for reminders...</Text>
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
    color: '#005BBB' 
  },
  info: { 
    fontSize: 16, 
    color: '#2C3E50', 
    marginTop: 10 
  },
});

export default CaregiverVoiceAssistanceScreen;
