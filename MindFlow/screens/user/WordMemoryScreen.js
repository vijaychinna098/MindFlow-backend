import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  TextInput 
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Updated import path

// Define word sets for levels 1 to 5.
const wordsForLevel = {
  1: ["cat", "dog", "sun", "cup", "pen", "hat", "toy", "car", "red", "box", "map", "bat", "run", "leg", "arm"],
  2: ["apple", "table", "house", "chair", "water", "bread", "clock", "plant", "phone", "music", "river", "money", "paper", "shoes", "books"],
  3: ["elephant", "mountain", "bicycle", "computer", "airplane", "hospital", "calendar", "dinosaur", "telescope", "vegetable", "magazine", "exercise", "furniture", "medicine", "interview"],
  4: ["democracy", "hurricane", "algorithm", "philosophy", "metabolism", "bankruptcy", "escalator", "conspiracy", "innovation", "confidence", "orchestra", "reflection", "trajectory", "mechanism", "destination"],
  5: ["congratulations", "extraordinary", "determination", "comprehensive", "responsibility", "investigation", "classification", "recommendation", "representative", "identification", "interpretation", "unpredictability", "misunderstanding", "environmentalist", "characteristic"],
};

// Helper function: Shuffle an array using the Fisher-Yates algorithm.
const shuffleArray = (array) => {
  let newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const SequenceRecallScreen = () => {
  const navigation = useNavigation();
  const [level, setLevel] = useState(1);
  const [wordSequence, setWordSequence] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayWord, setDisplayWord] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { fontSize } = useFontSize();

  // Refs to ensure instructions are spoken only once per level.
  const levelInstructionSpoken = useRef({});
  const initialInstructionSpoken = useRef(false);
  
  // Helper: speak message if not muted.
  const speak = (message) => {
    if (!isMuted) {
      // Using immediate=true to ensure ongoing speech is stopped before new one starts
      speakWithVoiceCheck(message, true, true);
    }
  };

  // Check for global voice assistance setting when screen loads
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        // If the setting exists and is explicitly set to false, disable voice
        if (storedVoiceSetting === 'false') {
          setIsMuted(true);
        } else if (!initialInstructionSpoken.current) {
          // Only speak initial instructions if voice is enabled, with immediate=true to stop any ongoing speech
          const generalInstructions = "Welcome to Word Memory! In this game, you'll be shown words to memorize and then asked to recall them.";
          speakWithVoiceCheck(generalInstructions, true, true);
          initialInstructionSpoken.current = true;
        }
      } catch (error) {
        console.error('Error loading voice settings:', error);
      }
    };
    
    loadVoiceSettings();
    
    // Setup navigation listener to stop speech when leaving this screen
    const unsubscribe = setupNavigationSpeechControl(navigation);
    
    return () => {
      stopSpeech();
      unsubscribe();
    };
  }, [navigation]);

  // Stop speech when navigating away from the screen
  useFocusEffect(
    React.useCallback(() => {
      // On screen focus, track screen visit
      ActivityTracker.trackScreenVisit('Word Memory');
      
      return () => {
        // On screen unfocus (navigating away)
        Speech.stop();
      };
    }, [])
  );

  // Return a level-specific description.
  const getLevelDescription = (level) => {
    switch (level) {
      case 1:
        return 'You will see simple 3-letter words. Try to remember them.';
      case 2:
        return 'Now you will see 5-letter words. Pay attention to each letter.';
      case 3:
        return 'This level has longer words. Focus and remember each one.';
      case 4:
        return 'These words are more complex. Take your time to memorize them.';
      case 5:
        return 'This is the final level with challenging words. Good luck!';
      default:
        return '';
    }
  };

  // Start the game for the current level.
  const startGame = () => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    // Track game start activity
    ActivityTracker.trackGameActivity(
      'Word Memory Game',
      'Started',
      `Level: ${level}`
    );
    
    // Shuffle words for the current level so that the order is random each time.
    const seq = shuffleArray(wordsForLevel[level]);
    setWordSequence(seq);
    setCurrentIndex(0);
    setUserInput('');
    setIsPlaying(true);
    // Speak level-specific instructions only once per level.
    if (!isMuted && !levelInstructionSpoken.current[level]) {
      const levelDesc = getLevelDescription(level);
      const instruction = `Level ${level}. ${levelDesc} Remember each word and type it when prompted.`;
      speak(instruction);
      levelInstructionSpoken.current[level] = true;
    }
    // Show the first word for 3 seconds.
    setDisplayWord(true);
    setTimeout(() => {
      setDisplayWord(false);
    }, 3000);
  };

  // Handle submission for the current word.
  const handleSubmit = () => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    const correctWord = wordSequence[currentIndex];
    if (userInput.trim().toLowerCase() === correctWord.toLowerCase()) {
      speak("Correct! Well done!");
      if (currentIndex === wordSequence.length - 1) {
        // Level completed.
        // Track level completion
        ActivityTracker.trackGameActivity(
          'Word Memory Game',
          'Completed Level',
          `Level: ${level}`
        );
        
        Alert.alert("Level Completed", `You've completed Level ${level}!`, [
          { 
            text: "Next Level", 
            onPress: () => {
              if (level < 5) {
                setLevel(level + 1);
                setIsPlaying(false);
                setWordSequence([]);
                setCurrentIndex(0);
                setUserInput('');
                levelInstructionSpoken.current[level + 1] = false;
              } else {
                // Track game completion
                ActivityTracker.trackGameActivity(
                  'Word Memory Game',
                  'Completed All Levels',
                  'Score: 100%'
                );
                
                speak("Congratulations! You've completed all levels!");
                Alert.alert("Game Completed", "You've completed all levels!", [
                  { 
                    text: "Restart", 
                    onPress: () => {
                      setLevel(1);
                      setIsPlaying(false);
                      setWordSequence([]);
                      setCurrentIndex(0);
                      setUserInput('');
                      levelInstructionSpoken.current = {};
                      initialInstructionSpoken.current = false;
                    }
                  }
                ]);
              }
            }
          }
        ]);
      } else {
        // Move to next word.
        setCurrentIndex(currentIndex + 1);
        setUserInput('');
        setDisplayWord(true);
        setTimeout(() => {
          setDisplayWord(false);
        }, 3000);
      }
    } else {
      speak("Incorrect. Please try again.");
      Alert.alert("Incorrect", "Your answer was incorrect. Please try again.", [
        { text: "Retry", onPress: () => setUserInput('') }
      ]);
    }
  };

  // Toggle mute; if muting, stop any ongoing speech.
  const toggleMute = () => {
    if (!isMuted) {
      stopSpeech();
    }
    setIsMuted(prev => !prev);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { fontSize: fontSize + 4 }]}>Word Memory</Text>
      <View style={styles.topRow}>
        <Text style={[styles.levelIndicator, { fontSize: fontSize }]}>Level {level}</Text>
        <TouchableOpacity style={styles.speakerButton} onPress={toggleMute}>
          <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={24} color="#005BBB" />
        </TouchableOpacity>
      </View>
      {!isPlaying && (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { fontSize: fontSize - 2 }]}>
            This game helps improve your memory skills. You'll see a word briefly, then you'll need to recall and type it correctly.
          </Text>
          <TouchableOpacity style={styles.playButton} onPress={startGame}>
            <Text style={[styles.playButtonText, { fontSize: fontSize }]}>Play</Text>
          </TouchableOpacity>
        </View>
      )}
      {isPlaying && (
        <View style={styles.gameArea}>
          {displayWord ? (
            <View style={styles.wordDisplay}>
              <Text style={[styles.wordText, { fontSize: fontSize + 12 }]}>{wordSequence[currentIndex]}</Text>
              <Text style={[styles.instructionText, { fontSize: fontSize - 2 }]}>Memorize this word!</Text>
            </View>
          ) : (
            <View style={styles.inputArea}>
              <Text style={[styles.instructionText, { fontSize: fontSize - 2 }]}>Enter the word you just saw</Text>
              <TextInput
                style={[styles.textInput, { fontSize: fontSize }]}
                value={userInput}
                onChangeText={setUserInput}
                keyboardType="default"
                placeholder="Your answer"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={[styles.submitButtonText, { fontSize: fontSize }]}>Submit</Text>
              </TouchableOpacity>
              <Text style={[styles.progressText, { fontSize: fontSize - 2 }]}>
                {`Word ${currentIndex + 1} of ${wordSequence.length}`}
              </Text>
            </View>
          )}
        </View>
      )}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => {
          stopSpeech();
          navigation.goBack();
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#005BBB" />
        <Text style={[styles.backButtonText, { fontSize: fontSize - 2 }]}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F0F4F8', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20 
  },
  header: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#005BBB', 
    marginBottom: 20 
  },
  topRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelIndicator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  speakerButton: {
    padding: 8,
  },
  descriptionContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  playButton: { 
    backgroundColor: '#005BBB', 
    padding: 15, 
    borderRadius: 10 
  },
  playButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  gameArea: {
    alignItems: 'center',
    width: '100%',
  },
  wordDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  wordText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#005BBB',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  inputArea: {
    alignItems: 'center',
    width: '100%',
  },
  textInput: {
    width: '80%',
    borderColor: '#005BBB',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    color: '#005BBB',
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#005BBB',
    padding: 15,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressText: {
    fontSize: 16,
    color: '#005BBB',
    marginTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#005BBB',
    marginLeft: 5,
    fontWeight: 'bold',
  },
});

export default SequenceRecallScreen;
