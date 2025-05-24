import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
// Import ActivityTracker
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Updated import path

// Get screen dimensions
const { width: screenWidth } = Dimensions.get('window');

// Colors for the game
const COLORS = {
  red: { hex: '#FF5252', icon: 'square', darkHex: '#D32F2F' },
  blue: { hex: '#448AFF', icon: 'square', darkHex: '#1976D2' },
  green: { hex: '#4CAF50', icon: 'square', darkHex: '#388E3C' },
  yellow: { hex: '#FFEB3B', icon: 'square', darkHex: '#FBC02D' },
  purple: { hex: '#9C27B0', icon: 'square', darkHex: '#7B1FA2' },
  orange: { hex: '#FF9800', icon: 'square', darkHex: '#F57C00' },
  pink: { hex: '#E91E63', icon: 'square', darkHex: '#C2185B' },
  teal: { hex: '#009688', icon: 'square', darkHex: '#00796B' }
};

// Difficulty levels
const DIFFICULTY = {
  EASY: { 
    name: 'easy', 
    colorCount: 3,     // Just 3 colors for easier play
    roundsToWin: 5,    // Updated from 3 to 5 rounds to win
    displayTime: 6000, // 6 seconds display time
    points: 5
  },
  MEDIUM: { 
    name: 'medium', 
    colorCount: 4,     // 4 colors
    roundsToWin: 5,    // 5 rounds
    displayTime: 5000, // 5 seconds
    points: 10
  },
  HARD: { 
    name: 'hard', 
    colorCount: 8,
    roundsToWin: 10,
    displayTime: 3000,
    points: 15
  }
};

// Game modes
const GAME_MODES = {
  COLOR_MEMORY: 'color Memory Mode',
  COLOR_FIND: 'color Find Mode'
};

const ColorMatchingScreen = () => {
  // Initialize animated values first
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const navigation = useNavigation();
  const [gameMode, setGameMode] = useState(null);
  const [difficulty, setDifficulty] = useState(DIFFICULTY.EASY);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [showingPattern, setShowingPattern] = useState(false);
  const [colorSequence, setColorSequence] = useState([]);
  const [userSequence, setUserSequence] = useState([]);
  const [availableColors, setAvailableColors] = useState([]);
  const [currentColorToFind, setCurrentColorToFind] = useState(null);
  const [colorOptions, setColorOptions] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [colorToGuess, setColorToGuess] = useState(null);
  const [optionsDisabled, setOptionsDisabled] = useState(false);
  const [globalVoiceEnabled, setGlobalVoiceEnabled] = useState(true);
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Add fontSize hook
  const { fontSize } = useFontSize();
  
  // Track timers that need to be cleared when leaving the screen
  const timeoutRefs = useRef([]);
  
  // Helper function to create tracked timeouts that can be cleared on unmount
  const createTrackedTimeout = (callback, delay) => {
    const timeoutId = setTimeout(callback, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  };
  
  // Clear all tracked timeouts
  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(id => clearTimeout(id));
    timeoutRefs.current = [];
  };
  
  // Force re-render when language changes
  useEffect(() => {
    // This effect runs when language changes, forcing component re-render
    setRefreshCounter(prev => prev + 1);
  }, []);
  
  // Load sound effects
  const [successSound, setSuccessSound] = useState();
  const [errorSound, setErrorSound] = useState();
  const [popSound, setPopSound] = useState();
  
  // Check for global voice assistance setting when screen loads
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        // If the setting exists and is explicitly set to false, disable voice
        if (storedVoiceSetting === 'false') {
          setGlobalVoiceEnabled(false);
          setVoiceEnabled(false);
        } else {
          setGlobalVoiceEnabled(true);
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
      stopSpeech();
      clearAllTimeouts();
      unsubscribe();
    };
  }, [navigation]);
  
  // Initial welcome message when screen loads
  useEffect(() => {
    if (voiceSettingsLoaded && voiceEnabled) {
      speak('Welcome to the Color Matching Challenge!');
    }
  }, [voiceSettingsLoaded]);
  
  // Use useFocusEffect to stop speech when navigating away
  useFocusEffect(
    React.useCallback(() => {
      // Track screen visit when user enters the screen
      ActivityTracker.trackScreenVisit('ColorMatching');
      
      // On screen focus
      return () => {
        // On screen unfocus (navigating away)
        Speech.stop();
      };
    }, [])
  );
  
  // Helper function to play sound
  const playSound = async (sound) => {
    if (soundEnabled && sound) {
      try {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } catch (error) {
        console.log('Error playing sound', error);
      }
    }
  };
  
  // Modified sound loading to not require actual sound files
  useEffect(() => {
    // We'll skip loading the sounds since the files don't exist
    // This prevents the errors from missing sound files
    
    return () => {
      // Cleanup function will still run
      if (successSound) successSound.unloadAsync();
      if (errorSound) errorSound.unloadAsync();
      if (popSound) popSound.unloadAsync();
      Speech.stop();
    };
  }, []);
  
  // Helper function to speak instructions if voice is enabled
  const speak = (message) => {
    if (voiceEnabled) {
      // Using immediate=true to ensure any ongoing speech is stopped before the new one starts
      speakWithVoiceCheck(message, true, true);
    }
  };
  
  // Toggle voice on/off
  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      if (prev) {
        stopSpeech();
      } else {
        speak('Voice instructions enabled.');
      }
      return !prev;
    });
  };
  
  // Toggle sound on/off
  const toggleSound = () => {
    setSoundEnabled(prev => {
      if (!prev) {
        speak('Sound effects enabled.');
      }
      return !prev;
    });
  };
  
  // Shuffle array
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  // Use the renderColorLabel helper for color names ONLY
  const renderColorLabel = (color) => {
    if (!color) return '';
    return color.toLowerCase();
  };

  // Select a game mode
  const selectGameMode = (mode) => {
    setGameMode(mode);
    speak(`You selected ${mode}. Now choose a difficulty.`);
  };
  
  // Select difficulty level
  const selectDifficulty = (level) => {
    setDifficulty(level);
    speak(`You selected ${level.name.toLowerCase()} difficulty.`);
  };
  
  // Start the game
  const startGame = () => {
    // Reset game state
    setGameStarted(true);
    setScore(0);
    setRound(1);
    setGameOver(false);
    setUserSequence([]);
    
    // Set available colors based on difficulty
    const colorKeys = Object.keys(COLORS);
    const selectedColors = colorKeys.slice(0, difficulty.colorCount);
    setAvailableColors(selectedColors);
    
    // Track game start in activity history
    ActivityTracker.trackActivity(
      `Started ${difficulty.name.toLowerCase()} Color Matching Game`, 
      'Memory Game',
      `Mode: ${gameMode === GAME_MODES.COLOR_MEMORY ? 'Memory Sequence' : 'Color Finding'}`
    );
    
    // Initialize based on game mode
    switch (gameMode) {
      case GAME_MODES.COLOR_MEMORY:
        initializeColorSequence(selectedColors);
        break;
      case GAME_MODES.COLOR_FIND:
        initializeColorFinding(selectedColors);
        break;
    }
    
    speak(`Round 1 starting. Get ready!`);
  };

  // Start a new game
  const startNewGame = () => {
    // Reset game state
    setScore(0);
    setRound(1);
    setGameOver(false);
    setUserSequence([]);
    
    // Track game start in activity history
    ActivityTracker.trackActivity(
      `Started Color Matching Game`, 
      'Memory Game', 
      `Difficulty: ${difficulty.name.toLowerCase()}`
    );
    
    // Restart the game with current settings
    startGame();
  };
  
  // Initialize color sequence game
  const initializeColorSequence = (colors) => {
    // Generate a random sequence
    const sequence = [];
    for (let i = 0; i < round + 1; i++) {
      const randomIndex = Math.floor(Math.random() * colors.length);
      sequence.push(colors[randomIndex]);
    }
    
    setColorSequence(sequence);
    setUserSequence([]);
    setShowingPattern(true);
    
    // Display the sequence
    showColorSequence(sequence);
  };
  
  // Display the color sequence to the user
  const showColorSequence = (sequence) => {
    speak('Watch the color sequence.');
    
    let i = 0;
    // Use a graduated interval timing - slower at first, then faster as levels increase
    const baseInterval = Math.max(1200 - (round * 50), 600); // Gets faster with higher rounds
    
    const showNextColor = () => {
      if (i < sequence.length) {
        // Clear previous highlight first
        setCurrentColorToFind(null);
        
        // Brief pause before showing the next color
        createTrackedTimeout(() => {
          // Highlight current color
          setCurrentColorToFind(sequence[i]);
          playSound(popSound);
          speak(renderColorLabel(sequence[i])); // Use renderColorLabel helper here
          
          // Move to next color after delay
          i++;
          createTrackedTimeout(showNextColor, baseInterval);
        }, 400);
      } else {
        // End of sequence
        setCurrentColorToFind(null);
        setShowingPattern(false);
        speak('Repeat the sequence in order.');
      }
    };
    
    // Start showing sequence after a brief delay
    createTrackedTimeout(showNextColor, 1500);
  };
  
  // Initialize color finding game
  const initializeColorFinding = (colors) => {
    // Choose a random color to find
    const randomIndex = Math.floor(Math.random() * colors.length);
    const colorToFind = colors[randomIndex];
    setCurrentColorToFind(colorToFind);
    
    // Create shuffled options
    const options = shuffleArray(colors);
    setColorOptions(options);
    
    speak(`Find the color ${renderColorLabel(colorToFind)}.`);
  };
  
  // Handle color press for sequence memory game
  const handleColorSequencePress = (color) => {
    if (showingPattern || gameOver) return;
    
    playSound(popSound);
    
    const newUserSequence = [...userSequence, color];
    setUserSequence(newUserSequence);
    
    // Check if correct
    if (color !== colorSequence[userSequence.length]) {
      // Incorrect
      playSound(errorSound);
      setGameOver(true);
      speak('Not the right color. Game over.');
      return;
    }
    
    // Check if completed sequence
    if (newUserSequence.length === colorSequence.length) {
      // Correct sequence
      playSound(successSound);
      animateSuccess();
      
      const pointsEarned = difficulty.points;
      setScore(prev => prev + pointsEarned);
      speak(`Correct! You earned ${pointsEarned} points.`);
      
      // Check if won the game
      if (round >= difficulty.roundsToWin) {
        speak('Congratulations! You won the game.');
        setGameOver(true);
        
        // Track game completion in activity history
        ActivityTracker.trackActivity(
          `Completed ${difficulty.name.toLowerCase()} Color Matching Game`, 
          'Memory Game',
          `Mode: ${gameMode === GAME_MODES.COLOR_MEMORY ? 'Memory Sequence' : 'Color Finding'}, Score: ${score + pointsEarned}`
        );
        
        return;
      }
      
      // Move to next round
      createTrackedTimeout(() => {
        setRound(prev => prev + 1);
        setUserSequence([]);
        initializeColorSequence(availableColors);
      }, 1500);
    }
  };
  
  // Handle color press for color finding game
  const handleColorFindingPress = (selectedColor) => {
    if (gameOver || optionsDisabled) return;
    
    setOptionsDisabled(true);
    playSound(popSound);
    
    // Check if correct
    if (selectedColor === currentColorToFind) {
      // Correct
      playSound(successSound);
      animateSuccess();
      
      const pointsEarned = difficulty.points;
      setScore(prev => prev + pointsEarned);
      speak(`Correct! You found ${renderColorLabel(selectedColor)}. You earned ${pointsEarned} points.`);
      
      // Check if won the game
      if (round >= difficulty.roundsToWin) {
        speak('Congratulations! You won the game.');
        setGameOver(true);
        
        // Track game completion in activity history
        ActivityTracker.trackActivity(
          `Completed ${difficulty.name.toLowerCase()} Color Matching Game`,
          'Memory Game',
          `Mode: ${gameMode === GAME_MODES.COLOR_MEMORY ? 'Memory Sequence' : 'Color Finding'}, Score: ${score + pointsEarned}`
        );
        
        return;
      }
      
      // Move to next round
      createTrackedTimeout(() => {
        setRound(prev => prev + 1);
        setOptionsDisabled(false);
        initializeColorFinding(availableColors);
      }, 1500);
    } else {
      // Incorrect
      playSound(errorSound);
      speak(`Incorrect. That's ${renderColorLabel(selectedColor)}, not ${renderColorLabel(currentColorToFind)}.`);
      setGameOver(true);
    }
  };
  
  // Handle game over
  const endGame = () => {
    setGameOver(true);
    
    // Track game completion in activity history
    ActivityTracker.trackActivity(
      `Completed Color Matching Game`, 
      'Memory Game', 
      `Difficulty: ${difficulty.name.toLowerCase()}, Score: ${score}`
    );
    
    // Announce results
    const resultMessage = `Game over! You scored ${score} points.`;
    speak(resultMessage);
  };
  
  // Reset the game
  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setShowingPattern(false);
    setUserSequence([]);
    setColorSequence([]);
    setOptionsDisabled(false);
    Speech.stop();
  };
  
  // Start a new game with same settings
  const playAgain = () => {
    setGameOver(false);
    setRound(1);
    setScore(0);
    setUserSequence([]);
    setColorSequence([]);
    setOptionsDisabled(false);
    
    // Restart the game with current settings
    startGame();
  };
  
  // Show success animation
  const animateSuccess = () => {
    console.log('animateSuccess called, scaleAnim:', scaleAnim);
    if (!scaleAnim) {
      console.error('scaleAnim is undefined!');
      return;
    }
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      })
    ]).start();
  };
  
  // Render color buttons for sequence memory game
  const renderColorSequenceButtons = () => {
    const buttonSize = (screenWidth - 80) / 2; // 2 columns with margins
    
    return (
      <View style={styles.colorButtonsContainer}>
        {availableColors.map((color, index) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              { 
                backgroundColor: COLORS[color].hex,
                width: buttonSize,
                height: buttonSize,
                borderColor: currentColorToFind === color ? '#000000' : 'transparent',
                borderWidth: currentColorToFind === color ? 4 : 0,
                // Add shadow for the highlighted color
                ...(currentColorToFind === color ? {
                  elevation: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 5 },
                  shadowOpacity: 0.8,
                  shadowRadius: 10,
                } : {})
              }
            ]}
            onPress={() => handleColorSequencePress(color)}
            disabled={showingPattern}
          >
            {currentColorToFind === color ? (
              // Add a semi-transparent black overlay for the highlighted color
              <View style={styles.highlightOverlay}>
                <Text style={[styles.colorButtonLabel, { fontSize: 18, color: '#FFFFFF' }]}>
                  {renderColorLabel(color)}
                </Text>
              </View>
            ) : (
              <Text style={styles.colorButtonLabel}>{renderColorLabel(color)}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  // Render color options for finding game
  const renderColorFindingOptions = () => {
    const buttonSize = (screenWidth - 80) / 2; // 2 columns with margins
    
    return (
      <View style={styles.gameContainer}>
        <View style={styles.colorToMatchContainer}>
          <Text style={[styles.colorToMatchLabel, { fontSize: fontSize - 1 }]}>Find this color:</Text>
          <Text style={[styles.colorToMatchName, { fontSize: fontSize + 4 }]}>{currentColorToFind ? renderColorLabel(currentColorToFind) : ''}</Text>
        </View>
        
        <View style={styles.colorButtonsContainer}>
          {colorOptions.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorButton,
                { 
                  backgroundColor: COLORS[color].hex,
                  width: buttonSize,
                  height: buttonSize
                }
              ]}
              onPress={() => handleColorFindingPress(color)}
              disabled={gameOver || optionsDisabled}
            >
              <Text style={styles.colorButtonLabel}>{renderColorLabel(color)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };
  
  // Render game type selection
  const renderGameModeSelection = () => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={[styles.sectionTitle, { fontSize: fontSize }]}>Choose Game Mode</Text>
        
        {Object.values(GAME_MODES).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeButton,
              gameMode === mode && styles.selectedModeButton
            ]}
            onPress={() => selectGameMode(mode)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Select ${mode}`}
            accessibilityState={{ selected: gameMode === mode }}
          >
            <MaterialCommunityIcons
              name={
                mode === GAME_MODES.COLOR_MEMORY ? 'brain' : 'magnify'
              }
              size={24}
              color={gameMode === mode ? '#FFFFFF' : '#333333'}
            />
            <Text style={[
              styles.modeButtonText,
              gameMode === mode && styles.selectedModeButtonText,
              { fontSize: fontSize - 2 }
            ]}>
              {mode}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  // Render difficulty selection
  const renderDifficultySelection = () => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={[styles.sectionTitle, { fontSize: fontSize }]}>Select Difficulty</Text>
        
        <View style={styles.difficultyContainer}>
          {Object.values(DIFFICULTY).map((level) => (
            <TouchableOpacity
              key={level.name}
              style={[
                styles.difficultyButton,
                difficulty === level && styles.selectedDifficultyButton,
                level === DIFFICULTY.EASY && styles.easyButton,
                level === DIFFICULTY.MEDIUM && styles.mediumButton,
                level === DIFFICULTY.HARD && styles.hardButton,
              ]}
              onPress={() => selectDifficulty(level)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Select ${level.name.toLowerCase()}`}
              accessibilityState={{ selected: difficulty === level }}
            >
              <Text style={[styles.difficultyButtonText, { fontSize: fontSize - 2 }]}>
                {level.name.toLowerCase()}
              </Text>
              {level === difficulty && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity
          style={[
            styles.startButton,
            (!gameMode || !difficulty) && styles.disabledButton
          ]}
          onPress={startGame}
          disabled={!gameMode || !difficulty}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Start Game"
          accessibilityState={{ disabled: !gameMode || !difficulty }}
        >
          <Ionicons name="play" size={20} color="#FFFFFF" />
          <Text style={[styles.startButtonText, { fontSize: fontSize - 1 }]}>Start Game</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render the current game based on mode
  const renderGame = () => {
    // Debug check
    console.log('renderGame - scaleAnim available:', !!scaleAnim);
    
    if (!gameStarted) {
      return (
        <>
          {renderGameModeSelection()}
          {renderDifficultySelection()}
        </>
      );
    }
    
    return (
      <>
        <Animated.View 
          style={[
            styles.gameInfoContainer,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <View style={styles.gameInfoItem}>
            <Text style={[styles.gameInfoLabel, { fontSize: fontSize - 2 }]}>Score</Text>
            <Text style={[styles.gameInfoValue, { fontSize: fontSize }]}>{score}</Text>
          </View>
          <View style={styles.gameInfoItem}>
            <Text style={[styles.gameInfoLabel, { fontSize: fontSize - 2 }]}>Round</Text>
            <Text style={[styles.gameInfoValue, { fontSize: fontSize }]}>{round}/{difficulty.roundsToWin}</Text>
          </View>
          <View style={styles.gameInfoItem}>
            <Text style={[styles.gameInfoLabel, { fontSize: fontSize - 2 }]}>Mode</Text>
            <Text style={[styles.gameInfoValue, { fontSize: fontSize }]}>
              {gameMode === GAME_MODES.COLOR_MEMORY ? 'Memory Mode' : 'Find Mode'}
            </Text>
          </View>
        </Animated.View>
        
        {gameMode === GAME_MODES.COLOR_MEMORY && renderColorSequenceButtons()}
        {gameMode === GAME_MODES.COLOR_FIND && renderColorFindingOptions()}
        
        {gameOver && (
          <View style={styles.gameOverContainer}>
            <Text style={[styles.gameOverTitle, { fontSize: fontSize + 2 }]}>
              {round >= difficulty.roundsToWin ? 'Congratulations!' : 'Game Over'}
            </Text>
            <Text style={[styles.gameOverScore, { fontSize: fontSize }]}>Score: {score}</Text>
            <Text style={[styles.gameOverRounds, { fontSize: fontSize - 1 }]}>Rounds Completed: {round}</Text>
            
            <View style={styles.gameOverButtonsContainer}>
              <TouchableOpacity
                style={[styles.gameButton, styles.tryAgainButton]}
                onPress={playAgain}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Play Again"
                accessibilityState={{ disabled: false }}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={[styles.gameButtonText, { fontSize: fontSize - 2 }]}>Play Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.gameButton, styles.newGameButton]}
                onPress={resetGame}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="New Game"
                accessibilityState={{ disabled: false }}
              >
                <Ionicons name="home" size={20} color="#FFFFFF" />
                <Text style={[styles.gameButtonText, { fontSize: fontSize - 2 }]}>New Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </>
    );
  };
  
  return (
    <View style={styles.background}>
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fontSize + 2 }]}>Color Matching Challenge</Text>
          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleVoice} style={styles.controlButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={voiceEnabled ? 'Turn Voice Off' : 'Turn Voice On'}
              accessibilityState={{ checked: voiceEnabled }}
            >
              <Ionicons 
                name={voiceEnabled ? "volume-high" : "volume-mute"} 
                size={24} 
                color={voiceEnabled ? "#005BBB" : "#888"} 
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSound} style={styles.controlButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={soundEnabled ? 'Turn Sound Off' : 'Turn Sound On'}
              accessibilityState={{ checked: soundEnabled }}
            >
             
            </TouchableOpacity>
          </View>
        </View>
        
        {!gameStarted && (
          <Text style={[styles.instructionsText, { fontSize: fontSize - 2 }]}>
            Match colors or find the correct color based on the game mode you choose.
          </Text>
        )}
        
        {renderGame()}
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            // Explicitly stop all speech when pressing back button
            Speech.stop();
            stopSpeech();
            navigation.goBack();
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Back to Activities"
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={[styles.backButtonText, { fontSize: fontSize }]}>Back to Activities</Text>
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
  controls: {
    flexDirection: 'row',
  },
  controlButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
  },
  instructionsText: {
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
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  selectedModeButton: {
    backgroundColor: '#005BBB',
  },
  modeButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  selectedModeButtonText: {
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
  selectedDifficultyButton: {
    borderWidth: 2,
    borderColor: '#000',
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
  gameInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    elevation: 2,
  },
  gameInfoItem: {
    alignItems: 'center',
  },
  gameInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  gameInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  gameContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  colorToMatchContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  colorToMatchLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  colorToMatchName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  colorButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  colorButton: {
    margin: 8,
    borderRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButtonLabel: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    padding: 4,
    borderRadius: 4,
    position: 'absolute',
    bottom: 8,
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    alignItems: 'center',
    elevation: 5,
  },
  gameOverTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#005BBB',
    marginBottom: 10,
  },
  gameOverScore: {
    fontSize: 18,
    color: '#333',
    marginBottom: 5,
  },
  gameOverRounds: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  gameOverButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  gameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    width: '45%',
  },
  tryAgainButton: {
    backgroundColor: '#4CAF50',
  },
  newGameButton: {
    backgroundColor: '#FF5722',
  },
  gameButtonText: {
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

export default ColorMatchingScreen;