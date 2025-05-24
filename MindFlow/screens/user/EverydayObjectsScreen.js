import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ScrollView,
  Alert,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import ActivityTracker from '../../utils/ActivityTracker';

// Everyday objects data with categories to make it more relatable to daily life
const everydayObjects = {
  kitchen: [
    { id: 'k1', name: 'cup', description: 'Used for drinking beverages', icon: 'cafe-outline' },
    { id: 'k2', name: 'spoon', description: 'Used for eating soup or stirring', icon: 'restaurant-outline' },
    { id: 'k3', name: 'fork', description: 'Used for eating solid food', icon: 'restaurant-outline' },
    { id: 'k4', name: 'plate', description: 'Used for serving food', icon: 'restaurant-outline' },
    { id: 'k5', name: 'kettle', description: 'Used for boiling water', icon: 'water-outline' },
    { id: 'k6', name: 'refrigerator', description: 'Used for keeping food cold', icon: 'snow-outline' },
  ],
  bathroom: [
    { id: 'b1', name: 'toothbrush', description: 'Used for cleaning teeth', icon: 'brush-outline' },
    { id: 'b2', name: 'soap', description: 'Used for cleaning', icon: 'water-outline' },
    { id: 'b3', name: 'towel', description: 'Used for drying off', icon: 'layers-outline' },
    { id: 'b4', name: 'comb', description: 'Used for styling hair', icon: 'brush-outline' },
    { id: 'b5', name: 'toilet', description: 'Used for waste disposal', icon: 'water-outline' },
  ],
  livingRoom: [
    { id: 'l1', name: 'television', description: 'Used for watching programs', icon: 'tv-outline' },
    { id: 'l2', name: 'sofa', description: 'Used for sitting comfortably', icon: 'bed-outline' },
    { id: 'l3', name: 'lamp', description: 'Used for providing light', icon: 'bulb-outline' },
    { id: 'l4', name: 'remote_control', description: 'Used for controlling electronic devices', icon: 'hardware-chip-outline' },
    { id: 'l5', name: 'clock', description: 'Used for showing time', icon: 'time-outline' },
  ],
  bedroom: [
    { id: 'bd1', name: 'bed', description: 'Used for sleeping', icon: 'bed-outline' },
    { id: 'bd2', name: 'pillow', description: 'Used for supporting the head', icon: 'square-outline' },
    { id: 'bd3', name: 'blanket', description: 'Used for keeping warm', icon: 'layers-outline' },
    { id: 'bd4', name: 'alarm_clock', description: 'Used for waking up at a specific time', icon: 'alarm-outline' },
    { id: 'bd5', name: 'dresser', description: 'Used for storing clothes', icon: 'file-tray-stacked-outline' },
  ],
  clothing: [
    { id: 'c1', name: 'shirt', description: 'Garment worn on upper body', icon: 'shirt-outline' },
    { id: 'c2', name: 'pants', description: 'Garment worn on lower body', icon: 'cut-outline' },
    { id: 'c3', name: 'shoes', description: 'Worn to protect feet', icon: 'footsteps-outline' },
    { id: 'c4', name: 'socks', description: 'Worn on feet', icon: 'happy-outline' },
    { id: 'c5', name: 'hat', description: 'Worn on head', icon: 'umbrella-outline' },
  ]
};

// Difficulty levels
const DIFFICULTY = {
  EASY: { 
    name: 'Easy',
    objectsToShow: 3,
    showTimeSeconds: 5,
    distractorObjects: 2
  },
  MEDIUM: { 
    name: 'Medium',
    objectsToShow: 5,
    showTimeSeconds: 4,
    distractorObjects: 5
  },
  HARD: { 
    name: 'Hard',
    objectsToShow: 7,
    showTimeSeconds: 3,
    distractorObjects: 7
  }
};

const EverydayObjectsScreen = () => {
  const navigation = useNavigation();
  const [difficulty, setDifficulty] = useState(DIFFICULTY.EASY);
  const [gamePhase, setGamePhase] = useState('setup'); // setup, learning, testing, results
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [objectsToRemember, setObjectsToRemember] = useState([]);
  const [allTestObjects, setAllTestObjects] = useState([]);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);
  const timerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Check for global voice assistance setting when screen loads
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        if (storedVoiceSetting === 'false') {
          setVoiceEnabled(false);
        }
        setVoiceSettingsLoaded(true);
      } catch (error) {
        console.error('Error loading voice settings:', error);
        setVoiceSettingsLoaded(true);
      }
    };
    
    loadVoiceSettings();
    
    // Setup navigation listener to stop speech when leaving this screen
    const unsubscribe = setupNavigationSpeechControl(navigation);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopSpeech();
      unsubscribe();
    };
  }, [navigation]);
  
  // Initial welcome message when screen loads
  useEffect(() => {
    if (voiceSettingsLoaded && voiceEnabled) {
      speak("Welcome to Everyday Objects. This game will help you recognize and remember common objects from your home.");
    }
  }, [voiceSettingsLoaded]);
  
  // Stop speech when navigating away from the screen
  useFocusEffect(
    React.useCallback(() => {
      // On screen focus, no action needed
      
      return () => {
        // On screen unfocus (navigating away)
        Speech.stop();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }, [])
  );

  // Helper function to speak if voice is enabled
  const speak = (message) => {
    if (voiceEnabled) {
      speakWithVoiceCheck(message, true, true);
    }
  };

  // Toggle voice on/off
  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      if (prev) {
        stopSpeech();
      } else {
        speak("Voice instructions enabled");
      }
      return !prev;
    });
  };

  // Render category selection
  const renderCategorySelection = () => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={styles.sectionTitle}>
          Choose a Room
        </Text>
        
        {Object.keys(everydayObjects).map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.selectedButton
            ]}
            onPress={() => selectCategory(category)}
          >
            <Text 
              style={[
                styles.categoryButtonText,
                selectedCategory === category && styles.selectedButtonText
              ]}
            >
              {category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Select a category of everyday objects
  const selectCategory = (category) => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    setSelectedCategory(category);
    
    // Format category name for speech
    const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1');
    speakWithVoiceCheck(`${formattedCategory} category selected`, true, true);
  };

  // Select difficulty level
  const selectDifficulty = (level) => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    setDifficulty(level);
    
    speakWithVoiceCheck(`${level.name} difficulty level selected`, true, true);
  };

  // Start the game
  const startGame = () => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    // Track that the Everyday Objects game was started
    ActivityTracker.trackActivity('Everyday Objects', 'memory_game_opened', {
      category: selectedCategory,
      difficulty: difficulty.name
    });
    
    // Select random objects from the chosen category to remember
    const categoryObjects = everydayObjects[selectedCategory];
    const shuffled = [...categoryObjects].sort(() => 0.5 - Math.random());
    const objectsToShow = shuffled.slice(0, difficulty.objectsToShow);
    
    setObjectsToRemember(objectsToShow);
    setGamePhase('learning');
    setTimeLeft(difficulty.showTimeSeconds);
    
    speak("Memorize these objects. Observe each object carefully.");
    
    // Start countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          prepareTestingPhase(objectsToShow);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Fade animation for transition
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      })
    ]).start();
  };

  // Prepare the testing phase by adding distractor objects
  const prepareTestingPhase = (objectsToShow) => {
    // Get objects from other categories as distractors
    let distractors = [];
    Object.keys(everydayObjects).forEach(category => {
      if (category !== selectedCategory) {
        distractors = [...distractors, ...everydayObjects[category]];
      }
    });
    
    // Also add unused objects from the same category
    const unusedCategoryObjects = everydayObjects[selectedCategory].filter(
      obj => !objectsToShow.find(o => o.id === obj.id)
    );
    distractors = [...distractors, ...unusedCategoryObjects];
    
    // Shuffle and take required number of distractors
    distractors = distractors.sort(() => 0.5 - Math.random()).slice(0, difficulty.distractorObjects);
    
    // Combine original objects and distractors and shuffle
    const allObjects = [...objectsToShow, ...distractors].sort(() => 0.5 - Math.random());
    
    setAllTestObjects(allObjects);
    setSelectedObjects([]);
    setGamePhase('testing');
    
    speak("Now, select all the objects you just saw. Tap each object that you remember.");
  };

  // Handle object selection during testing phase
  const handleObjectSelection = (object) => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    // Check if already selected
    if (selectedObjects.find(obj => obj.id === object.id)) {
      // Remove from selected
      setSelectedObjects(prev => prev.filter(obj => obj.id !== object.id));
    } else {
      // Add to selected
      setSelectedObjects(prev => [...prev, object]);
    }
  };

  // Submit selections and check results
  const checkResults = () => {
    // Count correct selections
    const correctSelections = selectedObjects.filter(
      selected => objectsToRemember.find(obj => obj.id === selected.id)
    ).length;
    
    // Count incorrect selections (false positives)
    const incorrectSelections = selectedObjects.length - correctSelections;
    
    // Count missed objects (false negatives)
    const missedObjects = objectsToRemember.length - correctSelections;
    
    // Calculate score (max 100)
    const calculatedScore = Math.max(
      0, 
      Math.round(
        (correctSelections / objectsToRemember.length * 100) - 
        (incorrectSelections * 10)
      )
    );
    
    setScore(calculatedScore);
    setGamePhase('results');
    
    // Track game completion in activity history
    ActivityTracker.trackActivity('Everyday Objects', 'memory_game_completed', {
      score: calculatedScore,
      difficulty: difficulty.name,
      category: selectedCategory
    });
    
    // Provide vocal feedback
    if (calculatedScore >= 80) {
      speak("Excellent work! You correctly remembered most of the objects.");
    } else if (calculatedScore >= 50) {
      speak("Good try! You remembered some objects.");
    } else {
      speak("It's okay to find this challenging. Practice again to improve your memory.");
    }
  };

  // Restart the game
  const restartGame = () => {
    setGamePhase('setup');
    setSelectedCategory(null);
    setObjectsToRemember([]);
    setAllTestObjects([]);
    setSelectedObjects([]);
    setScore(0);
    
    speak("Let's try again. Choose a category of everyday objects.");
  };

  // Render difficulty selection
  const renderDifficultySelection = () => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={styles.sectionTitle}>
          Select Difficulty
        </Text>
        
        <View style={styles.difficultyContainer}>
          {Object.values(DIFFICULTY).map((level) => {
            return (
              <TouchableOpacity
                key={level.name}
                style={[
                  styles.difficultyButton,
                  difficulty === level && styles.selectedButton,
                  level === DIFFICULTY.EASY && styles.easyButton,
                  level === DIFFICULTY.MEDIUM && styles.mediumButton,
                  level === DIFFICULTY.HARD && styles.hardButton,
                ]}
                onPress={() => selectDifficulty(level)}
              >
                <Text 
                  style={[
                    styles.difficultyButtonText,
                    difficulty === level && styles.selectedButtonText
                  ]}
                >
                  {level.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        <TouchableOpacity
          style={[
            styles.startButton,
            (!selectedCategory || !difficulty) && styles.disabledButton
          ]}
          onPress={startGame}
          disabled={!selectedCategory || !difficulty}
        >
          <Ionicons name="play" size={20} color="#FFFFFF" />
          <Text style={styles.startButtonText}>
            Start Game
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render learning phase
  const renderLearningPhase = () => {
    return (
      <Animated.View 
        style={[styles.gameContainer, { opacity: fadeAnim }]}
      >
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>
            Memorize Time Left: {timeLeft} seconds
          </Text>
        </View>
        
        <Text style={styles.instructionText}>
          Remember these objects and their names
        </Text>
        
        <View style={styles.objectsGrid}>
          {objectsToRemember.map((object) => {
            return (
              <View key={object.id} style={styles.objectItem}>
                <View style={styles.objectImagePlaceholder}>
                  <Ionicons name={object.icon} size={36} color="#FFFFFF" />
                </View>
                <Text style={styles.objectName}>{object.name.replace('_', ' ')}</Text>
                <Text style={styles.objectDescription}>{object.description}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  // Render testing phase
  const renderTestingPhase = () => {
    return (
      <View style={styles.gameContainer}>
        <Text style={styles.instructionText}>
          Select all objects you saw before
        </Text>
        
        <ScrollView style={styles.objectsScrollView}>
          <View style={styles.objectsGrid}>
            {allTestObjects.map((object) => {
              return (
                <TouchableOpacity 
                  key={object.id} 
                  style={[
                    styles.objectItem,
                    selectedObjects.find(obj => obj.id === object.id) && styles.selectedObjectItem
                  ]}
                  onPress={() => handleObjectSelection(object)}
                >
                  <View style={styles.objectImagePlaceholder}>
                    <Ionicons name={object.icon} size={36} color="#FFFFFF" />
                  </View>
                  <Text style={styles.objectName}>{object.name.replace('_', ' ')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={checkResults}
        >
          <Text style={styles.submitButtonText}>Check Answers</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render results phase
  const renderResultsPhase = () => {
    // Calculate correctly remembered object count
    const correctCount = selectedObjects.filter(
      selected => objectsToRemember.find(obj => obj.id === selected.id)
    ).length;
    
    return (
      <View style={styles.gameContainer}>
        <Text style={styles.resultTitle}>
          Your Score: {score}%
        </Text>
        
        <View style={styles.resultDetails}>
          <Text style={styles.resultText}>
            You correctly remembered {correctCount} out of {objectsToRemember.length} objects.
          </Text>
          
          {score < 100 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>The objects to remember were:</Text>
              {objectsToRemember.map((object) => {
                return (
                  <View key={object.id} style={styles.resultItemRow}>
                    <Ionicons 
                      name={selectedObjects.find(obj => obj.id === object.id) ? "checkmark-circle" : "close-circle"} 
                      size={20} 
                      color={selectedObjects.find(obj => obj.id === object.id) ? "#4CAF50" : "#F44336"} 
                    />
                    <Text style={styles.resultItemText}>{object.name.replace('_', ' ')}</Text>
                  </View>
                );
              })}
            </View>
          )}
          
          {selectedObjects.some(selected => !objectsToRemember.find(obj => obj.id === selected.id)) && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>You also selected these extra objects:</Text>
              {selectedObjects
                .filter(selected => !objectsToRemember.find(obj => obj.id === selected.id))
                .map((object) => {
                  return (
                    <View key={object.id} style={styles.resultItemRow}>
                      <Ionicons name="close-circle" size={20} color="#F44336" />
                      <Text style={styles.resultItemText}>{object.name.replace('_', ' ')}</Text>
                    </View>
                  );
                })
              }
            </View>
          )}
        </View>
        
        <View style={styles.resultButtonsContainer}>
          <TouchableOpacity 
            style={[styles.resultButton, styles.playAgainButton]}
            onPress={() => {
              setGamePhase('learning');
              setTimeLeft(difficulty.showTimeSeconds);
              startGame();
            }}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.resultButtonText}>Play Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.resultButton, styles.newGameButton]}
            onPress={restartGame}
          >
            <Ionicons name="home" size={20} color="#FFFFFF" />
            <Text style={styles.resultButtonText}>New Game</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.background}>
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Everyday Objects</Text>
          <TouchableOpacity onPress={toggleVoice} style={styles.controlButton}>
            <Ionicons 
              name={voiceEnabled ? "volume-high" : "volume-mute"} 
              size={24} 
              color={voiceEnabled ? "#005BBB" : "#888"} 
            />
          </TouchableOpacity>
        </View>
        
        {gamePhase === 'setup' && (
          <>
            <Text style={styles.introText}>
              In this game, you will see common objects found in the home and try to remember them. This will help strengthen your memory.
            </Text>
            {renderCategorySelection()}
            {selectedCategory && renderDifficultySelection()}
          </>
        )}
        
        {gamePhase === 'learning' && renderLearningPhase()}
        {gamePhase === 'testing' && renderTestingPhase()}
        {gamePhase === 'results' && renderResultsPhase()}
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            stopSpeech();
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back to Activities</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  container: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  controlButton: {
    padding: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
  },
  introText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 8,
    lineHeight: 22,
  },
  selectionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  categoryButton: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  selectedButton: {
    backgroundColor: '#005BBB',
  },
  categoryButtonText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  selectedButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  difficultyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    position: 'relative',
  },
  easyButton: {
    backgroundColor: '#4CAF50',
  },
  mediumButton: {
    backgroundColor: '#FFC107',
  },
  hardButton: {
    backgroundColor: '#F44336',
  },
  difficultyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  checkmark: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#005BBB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  gameContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  timerContainer: {
    backgroundColor: '#005BBB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold',
  },
  objectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  objectsScrollView: {
    maxHeight: 400,
  },
  objectItem: {
    width: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 1,
  },
  selectedObjectItem: {
    borderWidth: 2,
    borderColor: '#005BBB',
    backgroundColor: '#E3F2FD',
  },
  objectImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#005BBB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  objectImageText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  objectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  objectDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#005BBB',
    textAlign: 'center',
    marginBottom: 15,
  },
  resultDetails: {
    marginBottom: 20,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  resultSection: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  resultSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  resultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  resultItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  resultButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    width: '45%',
  },
  playAgainButton: {
    backgroundColor: '#4CAF50',
  },
  newGameButton: {
    backgroundColor: '#FF5722',
  },
  resultButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  backButton: {
    backgroundColor: '#005BBB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EverydayObjectsScreen;