import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView,
  Dimensions,
  Animated
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Updated import path

const WORD_DISPLAY_TYPES = {
  NORMAL: 'normal',
  SCRAMBLED_WITH_HINT: 'scrambledWithHint'
};

const WordScrambleScreen = () => {
  const navigation = useNavigation();
  const [scrambledWord, setScrambledWord] = useState('');
  const [correctWord, setCorrectWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [correctAnswersInLevel, setCorrectAnswersInLevel] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [wordDisplayType, setWordDisplayType] = useState(WORD_DISPLAY_TYPES.NORMAL);
  const [showHint, setShowHint] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showDefinition, setShowDefinition] = useState(false);
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const animatedScale = useRef(new Animated.Value(1)).current;
  const inputRef = useRef(null);
  const windowWidth = Dimensions.get('window').width;
  
  // Add hooks for font size
  const { fontSize } = useFontSize();
  
  const levels = {
    1: {
      words: [
        { word: 'cat', def: 'A small furry animal that is often kept as a pet' },
        { word: 'dog', def: 'A common four-legged animal that is often kept as a pet' },
        { word: 'bag', def: 'A container used to carry things' },
        { word: 'ball', def: 'A round object that can be thrown, kicked or hit' },
        { word: 'fish', def: 'An animal that lives in water and has fins' },
        { word: 'hat', def: 'An item of clothing worn on the head' },
        { word: 'sun', def: 'The star around which the earth orbits' },
        { word: 'car', def: 'A vehicle with four wheels and an engine' },
        { word: 'girl', def: 'A female child' },
        { word: 'game', def: 'An activity for fun or competition' }
      ],
      requiredCorrect: 3,
      points: 10,
      timeLimit: 30
    },
    2: {
      words: [
        { word: 'apple', def: 'A round fruit with red, yellow, or green skin' },
        { word: 'eagle', def: 'A large bird of prey with a hooked beak' },
        { word: 'book', def: 'A written or printed work consisting of pages' },
        { word: 'love', def: 'A deep feeling of affection' },
        { word: 'tree', def: 'A tall plant with a wooden trunk and branches' },
        { word: 'house', def: 'A building for human habitation' },
        { word: 'water', def: 'A transparent, odorless liquid that forms rivers and oceans' },
        { word: 'smile', def: 'A pleased or happy facial expression' },
        { word: 'chair', def: 'A separate seat for one person' },
        { word: 'cloud', def: 'A visible mass of water droplets in the atmosphere' }
      ],
      requiredCorrect: 4,
      points: 20,
      timeLimit: 45
    },
    3: {
      words: [
        { word: 'garden', def: 'A piece of ground used to grow flowers, vegetables, or fruit' },
        { word: 'planet', def: 'A celestial body moving in an orbit around a star' },
        { word: 'coffee', def: 'A hot drink made from roasted coffee beans' },
        { word: 'window', def: 'An opening in a wall to let in light and air' },
        { word: 'purple', def: 'A color mixing red and blue' },
        { word: 'orange', def: 'A round juicy fruit with orange skin' },
        { word: 'summer', def: 'The warmest season of the year' },
        { word: 'winter', def: 'The coldest season of the year' },
        { word: 'circle', def: 'A round plane figure whose points are all the same distance from the center' },
        { word: 'camera', def: 'A device for taking photographs or filming' }
      ],
      requiredCorrect: 4,
      points: 30,
      timeLimit: 60
    },
    4: {
      words: [
        { word: 'bicycle', def: 'A vehicle with two wheels powered by pedals' },
        { word: 'weather', def: 'The state of the atmosphere at a particular place and time' },
        { word: 'digital', def: 'Relating to or using signals or information in digital form' },
        { word: 'captain', def: 'The leader of a team or ship' },
        { word: 'history', def: 'The study of past events' },
        { word: 'library', def: 'A building containing collections of books' },
        { word: 'musical', def: 'Relating to music' },
        { word: 'victory', def: 'Success in a contest or competition' },
        { word: 'journey', def: 'An act of traveling from one place to another' },
        { word: 'diamond', def: 'A precious stone consisting of crystallized carbon' }
      ],
      requiredCorrect: 5,
      points: 40,
      timeLimit: 75
    },
    5: {
      words: [
        { word: 'challenge', def: 'A task that tests someone\'s abilities' },
        { word: 'beautiful', def: 'Pleasing to the senses or mind aesthetically' },
        { word: 'mountain', def: 'A large natural elevation of the earth\'s surface' },
        { word: 'adventure', def: 'An unusual and exciting experience' },
        { word: 'celebrate', def: 'Acknowledge a happy day or event with a social gathering' },
        { word: 'education', def: 'The process of receiving or giving instruction' },
        { word: 'friendship', def: 'A relationship between friends' },
        { word: 'happiness', def: 'The state of being happy' },
        { word: 'universe', def: 'All existing matter and space considered as a whole' },
        { word: 'wonderful', def: 'Inspiring delight or pleasure' }
      ],
      requiredCorrect: 5,
      points: 50,
      timeLimit: 90
    }
  };

  const gameDescription = "Welcome to Word Scramble! Unscramble the letters to form the correct word. You can use hints if you get stuck. Good luck!";

  // Load voice assistance settings first before any speech
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        // If the setting exists and is explicitly set to false, disable voice
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
  }, []);

  // Speak game description ONLY after voice settings are loaded
  useEffect(() => {
    if (voiceSettingsLoaded) {
      speakWithVoiceCheck(gameDescription, voiceEnabled);
    }
  }, [voiceSettingsLoaded]);

  // Toggle voice on/off
  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const newState = !prev;
      if (!newState) {
        stopSpeech();
      } else {
        speakWithVoiceCheck(gameDescription, newState);
      }
      return newState;
    });
  };

  // Trim user input when it changes to remove any whitespace
  const handleInputChange = (text) => {
    // Trim the input to remove any leading or trailing whitespace
    setUserInput(text.trim());
  };

  // Toggle pause game
  const togglePause = () => {
    setIsPaused(prev => !prev);
    setIsTimerRunning(prev => !prev);
    if (!isPaused) {
      speakWithVoiceCheck("Game paused", voiceEnabled);
    } else {
      speakWithVoiceCheck("Game resumed", voiceEnabled);
    }
  };

  // Stop speech when navigating away from the screen
  useFocusEffect(
    React.useCallback(() => {
      const unsubscribe = setupNavigationSpeechControl(navigation);
      
      // Track screen visit with proper game category
      ActivityTracker.trackScreenVisit('WordScrambleScreen');
      ActivityTracker.trackActivity(
        'Started Word Scramble game',
        'Memory Game',  // Using consistent category for game activities
        'Level ' + currentLevel
      );
      
      // Clean up function
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }, [navigation, currentLevel])
  );

  // Timer effect
  useEffect(() => {
    let timerInterval;
    if (isTimerRunning && timeLeft > 0 && !isPaused) {
      timerInterval = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerInterval);
            handleTimeUp();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      handleTimeUp();
    }
    
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isTimerRunning, timeLeft, isPaused]);

  const handleTimeUp = () => {
    if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      speakWithVoiceCheck("Time's up!", voiceEnabled);
      Alert.alert(
        "Time's up!", 
        "Let's try another word.", 
        [{ text: "Continue", onPress: getNewWord }]
      );
    }
  };

  // Letter animation when correct
  const animateSuccess = () => {
    Animated.sequence([
      Animated.timing(animatedScale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(animatedScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  };

  const scrambleWord = (word) => {
    let scrambled = word.split('')
      .map(a => ({ sort: Math.random(), value: a }))
      .sort((a, b) => a.sort - b.sort)
      .map(a => a.value)
      .join('');
      
    // Make sure the scrambled word is different from the original
    while (scrambled === word) {
      scrambled = scrambleWord(word);
    }
    return scrambled;
  };

  const getNewWord = () => {
    const levelData = levels[currentLevel];
    const randomIndex = Math.floor(Math.random() * levelData.words.length);
    const wordObj = levelData.words[randomIndex];
    setCorrectWord(wordObj.word);
    setScrambledWord(scrambleWord(wordObj.word));
    setUserInput('');
    setShowHint(false);
    setShowDefinition(false);
    setTimeLeft(levelData.timeLimit);
    setIsTimerRunning(true);
    setWordDisplayType(WORD_DISPLAY_TYPES.NORMAL);
    
    // Focus on input after a short delay (allows UI to update)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const checkAnswer = () => {
    // Make sure we're comparing trimmed values to avoid whitespace issues
    const trimmedInput = userInput.trim().toLowerCase();
    const trimmedCorrectWord = correctWord.trim().toLowerCase();
    
    if (trimmedInput === trimmedCorrectWord) {
      animateSuccess();
      
      const levelData = levels[currentLevel];
      const pointsEarned = levelData.points;
      // Bonus points for time remaining and not using hints
      const timeBonus = Math.round(timeLeft * 0.5);
      const hintPenalty = hintsUsed * 5;
      const totalPoints = pointsEarned + timeBonus - hintPenalty;
      
      const newScore = score + totalPoints;
      const newCorrectCount = correctAnswersInLevel + 1;
      
      setScore(newScore);
      setCorrectAnswersInLevel(newCorrectCount);
      setHintsUsed(0);
      setIsTimerRunning(false);
      
      speakWithVoiceCheck("Correct! You earned " + totalPoints + " points.", voiceEnabled);
      
      if (newCorrectCount >= levelData.requiredCorrect) {
        if (currentLevel < 5) {
          speakWithVoiceCheck(`Level ${currentLevel} complete! Advancing to level ${currentLevel + 1}.`, voiceEnabled);
          
          // Track level completion
          ActivityTracker.trackActivity(
            `Completed Word Scramble Level ${currentLevel}`,
            'Memory Game',
            `Score: ${newScore}`
          );
          
          Alert.alert(
            "Level Complete",
            `Congratulations! You've completed Level ${currentLevel}!\n\nTotal Score: ${newScore}\n\nAdvancing to Level ${currentLevel + 1}!`,
            [{ text: "Continue", onPress: () => {
              setCurrentLevel(prev => prev + 1);
              setCorrectAnswersInLevel(0);
              getNewWord();
            }}]
          );
        } else {
          speakWithVoiceCheck("All levels completed!", voiceEnabled);
          
          // Track game completion
          ActivityTracker.trackActivity(
            'Completed Word Scramble game',
            'Memory Game',
            `Final Score: ${newScore}`
          );
          
          Alert.alert(
            "Congratulations",
            `You've completed all levels!\n\nFinal Score: ${newScore}`,
            [{ text: "Play Again", onPress: restartGame }]
          );
        }
      } else {
        Alert.alert(
          "Correct", 
          `Time Bonus: +${timeBonus}\nHint Penalty: -${hintPenalty}\nTotal: +${totalPoints} Points!`, 
          [{ text: "Next Word", onPress: getNewWord }]
        );
      }
    } else {
      speakWithVoiceCheck("Incorrect", voiceEnabled);
      Alert.alert(
        "Incorrect", 
        "Try again or use a hint.",
        [
          { text: "Try Again", style: 'cancel' },
          { text: "Use Hint", onPress: showWordHint }
        ]
      );
    }
  };

  const showWordHint = () => {
    setHintsUsed(prev => prev + 1);
    setWordDisplayType(WORD_DISPLAY_TYPES.SCRAMBLED_WITH_HINT);
    setShowHint(true);
    speakWithVoiceCheck("Hint: The first letter is revealed.", voiceEnabled);
  };

  const toggleDefinition = () => {
    setShowDefinition(prev => !prev);
    
    if (!showDefinition) {
      const currentWordObj = levels[currentLevel].words.find(
        wordObj => wordObj.word === correctWord
      );
      
      if (currentWordObj && currentWordObj.def) {
        speakWithVoiceCheck("Definition: " + currentWordObj.def, voiceEnabled);
      }
    }
  };

  const restartGame = () => {
    speakWithVoiceCheck("Game reset.", voiceEnabled);
    setCurrentLevel(1);
    setScore(0);
    setCorrectAnswersInLevel(0);
    setHintsUsed(0);
    setIsPaused(false);
    getNewWord();
  };

  // Initialize game
  useEffect(() => {
    getNewWord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCurrentDefinition = () => {
    const wordObj = levels[currentLevel].words.find(w => w.word === correctWord);
    return wordObj ? wordObj.def : '';
  };

  const getLettersArray = () => {
    if (wordDisplayType === WORD_DISPLAY_TYPES.SCRAMBLED_WITH_HINT) {
      // Show the first letter as a hint
      return [
        correctWord.charAt(0),
        ...scrambledWord.slice(1).split('')
      ];
    } else {
      return scrambledWord.split('');
    }
  };

  const getTimerColor = () => {
    const levelData = levels[currentLevel];
    const percentage = (timeLeft / levelData.timeLimit) * 100;
    
    if (percentage > 60) return '#4CAF50'; // Green
    if (percentage > 30) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fontSize + 2 }]}>Word Scramble</Text>
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={toggleVoice} style={styles.controlButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={voiceEnabled ? "Turn voice off" : "Turn voice on"}
            >
              <Ionicons 
                name={voiceEnabled ? "volume-high" : "volume-mute"} 
                size={24} 
                color={voiceEnabled ? "#005BBB" : "#888"} 
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePause} style={styles.controlButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? "Resume game" : "Pause game"}
            >
              <Ionicons 
                name={isPaused ? "play" : "pause"} 
                size={24} 
                color="#005BBB" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.gameInfoCard}>
          <View style={styles.gameInfoItem}>
            <MaterialIcons name="leaderboard" size={20} color="#005BBB" />
            <Text style={[styles.gameInfoText, { fontSize: fontSize - 2 }]}>
              Level: {currentLevel}
            </Text>
          </View>
          <View style={styles.gameInfoItem}>
            <MaterialIcons name="done-all" size={20} color="#005BBB" />
            <Text style={[styles.gameInfoText, { fontSize: fontSize - 2 }]}>
              Progress: {correctAnswersInLevel}/{levels[currentLevel].requiredCorrect}
            </Text>
          </View>
          <View style={styles.gameInfoItem}>
            <MaterialIcons name="score" size={20} color="#005BBB" />
            <Text style={[styles.gameInfoText, { fontSize: fontSize - 2 }]}>
              Score: {score}
            </Text>
          </View>
        </View>

        {isPaused ? (
          <View style={styles.pauseOverlay}>
            <Text style={[styles.pauseText, { fontSize: fontSize + 4 }]}>Game Paused</Text>
            <Text style={[styles.pauseInstructions, { fontSize: fontSize - 2 }]}>Tap play to resume</Text>
          </View>
        ) : (
          <>
            <View style={styles.timerContainer}>
              <MaterialIcons name="timer" size={24} color={getTimerColor()} />
              <View style={styles.timerBarContainer}>
                <View 
                  style={[
                    styles.timerBar, 
                    { 
                      width: `${(timeLeft / levels[currentLevel].timeLimit) * 100}%`,
                      backgroundColor: getTimerColor()
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.timerText, { color: getTimerColor() }]}>
                {timeLeft}s
              </Text>
            </View>

            <View style={styles.instructionCard}>
              <View style={styles.instructionHeader}>
                <Ionicons name="information-circle-outline" size={22} color="#005BBB" />
                <Text style={[styles.instructionHeaderText, { fontSize: fontSize }]}>Instructions</Text>
              </View>
              <Text style={[styles.instructionText, { fontSize: fontSize - 2 }]}>
                Unscramble the letters to form the correct word.
              </Text>
            </View>

            <Animated.View 
              style={[
                styles.scrambledContainer, 
                { transform: [{ scale: animatedScale }] }
              ]}
            >
              <View style={styles.scrambledLettersContainer}>
                {getLettersArray().map((letter, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.letterTile,
                      showHint && index === 0 && styles.hintLetterTile
                    ]}
                  >
                    <Text style={[
                      styles.letterText,
                      showHint && index === 0 && styles.hintLetterText
                    ]}>
                      {letter.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {showDefinition && (
              <View style={styles.definitionContainer}>
                <Text style={styles.definitionText}>
                  {getCurrentDefinition()}
                </Text>
              </View>
            )}

            <TextInput
              ref={inputRef}
              style={[styles.input, { fontSize: fontSize }]}
              placeholder="Type your answer here"
              placeholderTextColor="#999"
              value={userInput}
              onChangeText={handleInputChange}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isPaused}
            />

            <View style={styles.helpButtonRow}>
              <TouchableOpacity 
                style={styles.helpButton} 
                onPress={showWordHint}
                disabled={showHint}
              >
                <Ionicons name="bulb-outline" size={20} color={showHint ? "#999" : "#005BBB"} />
                <Text style={[styles.helpButtonText, showHint && styles.disabledText, { fontSize: fontSize - 2 }]}>
                  Use Hint
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.helpButton}
                onPress={toggleDefinition}
              >
                <Ionicons 
                  name={showDefinition ? "book" : "book-outline"} 
                  size={20} 
                  color="#005BBB" 
                />
                <Text style={[styles.helpButtonText, { fontSize: fontSize - 2 }]}>
                  {showDefinition ? "Hide Definition" : "Show Definition"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.submitButton,
                  !userInput && styles.disabledButton
                ]}
                onPress={checkAnswer}
                disabled={!userInput}
              >
                <Text style={[
                  styles.buttonText,
                  !userInput && styles.disabledButtonText,
                  { fontSize: fontSize }
                ]}>
                  Submit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.skipButton]}
                onPress={getNewWord}
              >
                <Text style={[styles.skipButtonText, { fontSize: fontSize }]}>
                  Skip Word
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.levelInfo}>
              <Text style={[styles.levelText, { fontSize: fontSize - 2 }]}>
                Word Length: {correctWord.length} letters
              </Text>
              <Text style={[styles.levelText, { fontSize: fontSize - 2 }]}>
                Points: {levels[currentLevel].points} + Time Bonus
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color="white" />
              <Text style={[styles.backButtonText, { fontSize: fontSize - 2 }]}>
                Back to Activities
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F0F4F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
  },
  gameInfoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexWrap: 'wrap',
  },
  gameInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
    paddingRight: 8,
  },
  gameInfoText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 4,
    fontWeight: '500',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  timerBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  timerBar: {
    height: '100%',
    borderRadius: 5,
  },
  timerText: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'center',
  },
  instructionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#005BBB',
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 15,
    color: '#2C3E50',
    marginBottom: 8,
    lineHeight: 22,
  },
  scrambledContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 3,
    alignItems: 'center',
  },
  scrambledLettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  letterTile: {
    width: 45,
    height: 45,
    backgroundColor: '#E8F5E9',
    margin: 5,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  letterText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  hintLetterTile: {
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: '#FFA000',
  },
  hintLetterText: {
    color: '#FFA000',
  },
  definitionContainer: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  definitionText: {
    fontSize: 16,
    color: '#2C3E50',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 12,
    fontSize: 20,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    elevation: 2,
  },
  helpButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    width: '48%',
    justifyContent: 'center',
  },
  helpButtonText: {
    color: '#005BBB',
    marginLeft: 5,
    fontWeight: '500',
  },
  disabledText: {
    color: '#999',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    marginHorizontal: 5,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
  },
  skipButton: {
    backgroundColor: '#005BBB',
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButtonText: {
    color: '#999',
  },
  skipButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelInfo: {
    marginTop: 10,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
  },
  levelText: {
    fontSize: 16,
    color: '#1976D2',
    textAlign: 'center',
    marginVertical: 5,
  },
  backButton: {
    backgroundColor: '#005BBB',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  pauseOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 30,
    marginVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pauseText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#005BBB',
    marginBottom: 10,
  },
  pauseInstructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default WordScrambleScreen;
