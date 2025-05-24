import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Updated import path

const MemoryGamesScreen = () => {
  const navigation = useNavigation();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const windowWidth = Dimensions.get('window').width;
  const { fontSize } = useFontSize();

  const MEMORY_GAMES = [
    {
      id: 'visualpairs',
      title: 'Visual Pairs',
      description: 'Match visual elements and strengthen your visual memory',
      icon: 'images-outline',
      screen: 'VisualPairs',
      color: '#4CAF50',
    },
    {
      id: 'matchingpairs',
      title: 'Matching Pairs',
      description: 'Find pairs of matching cards to exercise your memory',
      icon: 'duplicate-outline',
      screen: 'MatchingPairs',
      color: '#2196F3',
    },
    {
      id: 'wordmemory',
      title: 'Word Memory',
      description: 'Memorize and recall words to improve verbal memory',
      icon: 'text-outline',
      screen: 'WordMemory',
      color: '#9C27B0',
    },
    {
      id: 'sequentialtasks',
      title: 'Sequential Tasks',
      description: 'Follow step-by-step instructions to build cognitive sequencing',
      icon: 'git-branch-outline',
      screen: 'SequentialTasks',
      color: '#FF9800',
    },
    {
      id: 'everydayobjects',
      title: 'Everyday Objects',
      description: 'Identify and remember common objects from daily life',
      icon: 'cube-outline',
      screen: 'EverydayObjects',
      color: '#795548',
    }
  ];

  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        if (storedVoiceSetting === 'false') {
          setVoiceEnabled(false);
        } else {
          speakWithVoiceCheck('Welcome to Memory Games', true, true);
        }
      } catch (error) {
        console.error('Error loading voice settings:', error);
      }
    };
    
    loadVoiceSettings();
    
    const unsubscribe = setupNavigationSpeechControl(navigation);
    
    return () => {
      stopSpeech();
      unsubscribe();
    };
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      ActivityTracker.trackScreenVisit('MemoryGames');
      return () => {};
    }, [])
  );

  const speak = (message) => {
    if (voiceEnabled) {
      speakWithVoiceCheck(message, true, true);
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const newValue = !prev;
      if (newValue) {
        speakWithVoiceCheck('Voice instructions enabled', true);
        ActivityTracker.trackSettingChange('Voice Instructions', 'enabled');
      } else {
        stopSpeech();
        ActivityTracker.trackSettingChange('Voice Instructions', 'disabled');
      }
      return newValue;
    });
  };

  const navigateToGame = (game) => {
    speakWithVoiceCheck(`Opening ${game.title}`, voiceEnabled);
    ActivityTracker.trackGameActivity(
      game.title,
      'Started',
      'Memory Game'
    );
    navigation.navigate(game.screen);
  };

  const cardWidth = windowWidth > 600 
    ? (windowWidth - 60) / 2 
    : windowWidth - 40;

  return (
    <View style={styles.container}>
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
        
        <Text style={[styles.headerTitle, { fontSize: fontSize + 2 }]}>
          Memory Games
        </Text>
        
        <TouchableOpacity 
          style={styles.voiceButton}
          onPress={toggleVoice}
        >
          <Ionicons 
            name={voiceEnabled ? "volume-high" : "volume-mute"} 
            size={24} 
            color={voiceEnabled ? "#005BBB" : "#888"} 
          />
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { fontSize: fontSize + 2 }]}>
          Exercise Your Memory
        </Text>
        <Text style={[styles.sectionDescription, { fontSize: fontSize - 2 }]}>
          Regular memory exercises can help maintain cognitive health and improve recall.
        </Text>
        
        <View style={styles.gamesGrid}>
          {MEMORY_GAMES.map(game => (
            <TouchableOpacity 
              key={game.id}
              style={[styles.gameCard, { width: cardWidth, borderColor: game.color }]}
              onPress={() => navigateToGame(game)}
              activeOpacity={0.7}
            >
              <View style={[styles.gameIconContainer, { backgroundColor: game.color }]}>
                <Ionicons name={game.icon} size={32} color="#FFFFFF" />
              </View>
              
              <View style={styles.gameInfo}>
                <Text style={[styles.gameTitle, { fontSize: fontSize }]}>
                  {game.title}
                </Text>
                <Text style={[styles.gameDescription, { fontSize: fontSize - 3 }]}>
                  {game.description}
                </Text>
              </View>
              
              <View style={styles.playButtonContainer}>
                <View style={[styles.playButton, { backgroundColor: game.color }]}>
                  <Ionicons name="play" size={20} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.tipContainer}>
          <Text style={[styles.tipTitle, { fontSize: fontSize }]}>
            Memory Tip
          </Text>
          <Text style={[styles.tipText, { fontSize: fontSize - 2 }]}>
            Try to make mental associations between new information and things you already know. This technique, called "chunking," can make memorization easier.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  voiceButton: {
    padding: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 20,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gameCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    borderLeftWidth: 4,
    flexDirection: 'row',
  },
  gameIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  gameDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  playButtonContainer: {
    justifyContent: 'center',
    paddingLeft: 8,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0D47A1',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default MemoryGamesScreen;
