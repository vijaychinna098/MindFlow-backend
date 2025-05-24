import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Import FontSizeContext hook

const ActivitiesScreen = () => {
  const navigation = useNavigation();
  const windowWidth = Dimensions.get('window').width;
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { fontSize } = useFontSize(); // Get the font size from context

  // Load voice settings and setup speech control on component mount
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        if (storedVoiceSetting === 'false') {
          setVoiceEnabled(false);
        } else {
          // Welcome message with immediate=true to stop any ongoing speech first
          speakWithVoiceCheck("Welcome to Brain Training Activities. Choose an activity to begin.", true, true);
        }
      } catch (error) {
        console.error('Error loading voice settings:', error);
      }
    };
    
    loadVoiceSettings();
    
    // Setup navigation listener to stop speech when leaving this screen
    const unsubscribe = setupNavigationSpeechControl(navigation);
    
    // Clean up
    return () => {
      stopSpeech();
      unsubscribe();
    };
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      ActivityTracker.trackScreenVisit('ActivitiesScreen');
    }, [])
  );

  // Helper function to speak if voice is enabled
  const speak = (message) => {
    if (voiceEnabled) {
      // Using immediate=true to ensure any ongoing speech is stopped before the new one starts
      speakWithVoiceCheck(message, true, true);
    }
  };

  // List of activities with icons, descriptions, and route names.
  const activities = [
    { 
      id: '1', 
      title: 'Memory Games', 
      description: 'Exercise your memory with fun games and challenges', 
      IconComponent: Ionicons, 
      iconName: 'game-controller', 
      route: 'MemoryGames',
      color: '#4e8abe'
    },
    { 
      id: '2', 
      title: 'Puzzle Challenge', 
      description: 'Solve puzzles to keep your mind sharp', 
      IconComponent: MaterialCommunityIcons, 
      iconName: 'puzzle',
      route: 'PuzzleChallenge',
      color: '#6b5b95'
    },
    { 
      id: '3', 
      title: 'Word Scramble', 
      description: 'Unscramble letters to form words', 
      IconComponent: FontAwesome5, 
      iconName: 'font',
      route: 'WordScramble',
      color: '#55a630'
    },
    { 
      id: '4', 
      title: 'Color Matching', 
      description: 'Match colors to improve focus and concentration', 
      IconComponent: Ionicons, 
      iconName: 'color-palette-outline',
      route: 'ColorMatching',
      color: '#ff7b25'
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            stopSpeech();
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#005BBB" />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { fontSize: fontSize }]}>Brain Training Activities</Text>
        
        <TouchableOpacity 
          style={styles.voiceButton}
          onPress={() => {
            setVoiceEnabled(prev => {
              if (prev) {
                stopSpeech();
              } else {
                speak('Voice instructions enabled');
              }
              return !prev;
            });
          }}
        >
          <Ionicons 
            name={voiceEnabled ? "volume-high" : "volume-mute"} 
            size={24} 
            color={voiceEnabled ? "#005BBB" : "#888"} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.chooseGameContainer}>
        <Text style={[styles.chooseGameText, { fontSize: fontSize + 2 }]}>Choose a game</Text>
      </View>
      
      <View style={styles.cardsContainer}>
        {activities.map((activity) => (
          <TouchableOpacity
            key={activity.id}
            style={[styles.card, { backgroundColor: activity.color }]}
            onPress={() => {
              if (activity.route) {
                // Track activity selection with the "Memory Game" category
                // so it appears under the Games filter in activity history
                ActivityTracker.trackActivity(
                  `Selected ${activity.title}`,
                  'Memory Game',  // Changed from 'Brain Activity' to 'Memory Game'
                  `From Activities Screen`
                );
                
                // Debug to identify any potential issues
                console.log(`Navigating to: ${activity.route}`);
                
                // Ensure we're navigating to the correct screen
                navigation.navigate(activity.route);
              } else {
                alert(`Selected Activity: ${activity.title}`);
              }
              speak(`Selected Activity: ${activity.title}`);
            }}
          >
            <View style={styles.iconContainer}>
              <activity.IconComponent 
                name={activity.iconName} 
                size={windowWidth < 400 ? 40 : 50} 
                color="#FFFFFF" 
              />
            </View>
            <Text style={[styles.cardTitle, { fontSize: fontSize - 2 }]}>{activity.title}</Text>
            <Text style={[styles.cardDescription, { fontSize: fontSize - 6 }]}>{activity.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F0F4F8',
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    elevation: 2,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#005BBB',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  chooseGameContainer: {
    marginBottom: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chooseGameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#005BBB',
    textAlign: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 18,
    marginBottom: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButton: {
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ActivitiesScreen;
