import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Animated,
  SafeAreaView,
  Alert,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Updated import path
import * as FileSystem from 'expo-file-system';

// Task sequences organized by categories
const sequentialTasks = {
  morningRoutine: [
    { id: 'm1', name: 'Wake up', description: 'Get out of bed', icon: 'sunny-outline' },
    { id: 'm2', name: 'Brush teeth', description: 'Use toothbrush and toothpaste', icon: 'water-outline' },
    { id: 'm3', name: 'Take a shower', description: 'Wash your body', icon: 'rainy-outline' },
    { id: 'm4', name: 'Get dressed', description: 'Put on clean clothes', icon: 'shirt-outline' },
    { id: 'm5', name: 'Eat breakfast', description: 'Have a healthy meal', icon: 'restaurant-outline' },
    { id: 'm6', name: 'Take medicine', description: 'Take morning pills', icon: 'medical-outline' },
    { id: 'm7', name: 'Brush hair', description: 'Style your hair', icon: 'brush-outline' },
    { id: 'm8', name: 'Put on shoes', description: 'Prepare to go outside', icon: 'footsteps-outline' },
  ],
  mealPreparation: [
    { id: 'p1', name: 'Wash hands', description: 'Clean your hands before cooking', icon: 'water-outline' },
    { id: 'p2', name: 'Get ingredients', description: 'Take items from refrigerator/pantry', icon: 'basket-outline' },
    { id: 'p3', name: 'Prepare vegetables', description: 'Wash and cut vegetables', icon: 'nutrition-outline' },
    { id: 'p4', name: 'Heat pan', description: 'Turn on stove, add oil', icon: 'flame-outline' },
    { id: 'p5', name: 'Cook food', description: 'Follow recipe instructions', icon: 'timer-outline' },
    { id: 'p6', name: 'Set the table', description: 'Place plates, utensils, glasses', icon: 'restaurant-outline' },
    { id: 'p7', name: 'Serve food', description: 'Put food on plates', icon: 'fast-food-outline' },
    { id: 'p8', name: 'Clean up', description: 'Wash dishes, wipe counters', icon: 'trash-outline' },
  ],
  housecleaning: [
    { id: 'h1', name: 'Make bed', description: 'Straighten sheets and blankets', icon: 'bed-outline' },
    { id: 'h2', name: 'Dust furniture', description: 'Clean surfaces with cloth', icon: 'hand-left-outline' },
    { id: 'h3', name: 'Vacuum floor', description: 'Use vacuum on carpets', icon: 'flash-outline' },
    { id: 'h4', name: 'Clean bathroom', description: 'Wipe sink, toilet, shower', icon: 'water-outline' },
    { id: 'h5', name: 'Take out trash', description: 'Empty trash bins', icon: 'trash-outline' },
    { id: 'h6', name: 'Wash clothes', description: 'Use washing machine', icon: 'shirt-outline' },
    { id: 'h7', name: 'Fold laundry', description: 'Organize clean clothes', icon: 'layers-outline' },
    { id: 'h8', name: 'Water plants', description: 'Give plants fresh water', icon: 'flower-outline' },
  ],
  shopping: [
    { id: 's1', name: 'Make shopping list', description: 'Write down needed items', icon: 'list-outline' },
    { id: 's2', name: 'Get shopping bags', description: 'Bring reusable bags', icon: 'bag-outline' },
    { id: 's3', name: 'Drive to store', description: 'Travel to the market', icon: 'car-outline' },
    { id: 's4', name: 'Get shopping cart', description: 'Find cart at entrance', icon: 'cart-outline' },
    { id: 's5', name: 'Select items', description: 'Find and pick products', icon: 'basket-outline' },
    { id: 's6', name: 'Pay at checkout', description: 'Use money or card to pay', icon: 'card-outline' },
    { id: 's7', name: 'Pack bags', description: 'Put items in bags', icon: 'bag-outline' },
    { id: 's8', name: 'Return home', description: 'Drive back home', icon: 'home-outline' },
  ],
};

// Difficulty levels
const DIFFICULTY = {
  EASY: { 
    name: 'easy',
    tasksToShow: 3,
    viewingTimeMultiplier: 2.5, // 2.5 seconds per task
    backgroundColor: '#E8F5E9', // Light green background
  },
  MEDIUM: { 
    name: 'medium',
    tasksToShow: 5,
    viewingTimeMultiplier: 2, // 2 seconds per task
    backgroundColor: '#FFF3E0', // Light orange background
  },
  HARD: { 
    name: 'hard',
    tasksToShow: 7,
    viewingTimeMultiplier: 1.5, // 1.5 seconds per task
    backgroundColor: '#FFEBEE', // Light red background
  }
};

const SequentialTasksScreen = () => {
  const navigation = useNavigation();
  const [difficulty, setDifficulty] = useState(DIFFICULTY.EASY);
  const [gamePhase, setGamePhase] = useState('setup'); // setup, learning, testing, results
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [tasksToRemember, setTasksToRemember] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);
  const timerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Add a state to force re-render when language changes
  const [languageKey, setLanguageKey] = useState(0);
  
  // Add fontSize and translate hooks
  const { fontSize } = useFontSize();

  // Force re-render when language changes
  useEffect(() => {
    // Explicitly forcing a re-render when language changes
    setLanguageKey(prevKey => prevKey + 1); // Increment languageKey to trigger re-render
    setGamePhase(prevPhase => prevPhase); // This will trigger a secondary re-render mechanism
  }, []);

  // Load voice settings from storage
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
    
    // Track game opened in activity history
    ActivityTracker.trackActivity('Sequential Tasks', 'memory_game_opened');
    
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
  
  // Initial welcome message
  useEffect(() => {
    if (voiceSettingsLoaded && voiceEnabled) {
      speakText("Welcome to Sequential Tasks");
    }
  }, [voiceSettingsLoaded]);
  
  // Cleanup when leaving the screen
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        stopSpeech();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }, [])
  );

  // Helper function for text-to-speech
  const speakText = (message) => {
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
        speakText("Voice instructions enabled");
      }
      return !prev;
    });
  };

  // Select a category of tasks
  const selectCategory = (category) => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    setSelectedCategory(category);
    speakText(`Selected category: ${category}`);
  };

  // Select difficulty level
  const selectDifficulty = (level) => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    setDifficulty(level);
    speakText(`Selected difficulty: ${level.name}`);
  };

  // Start the game
  const startGame = () => {
    // Select tasks from the chosen category
    const categoryTasks = sequentialTasks[selectedCategory];
    const tasksToShow = categoryTasks.slice(0, difficulty.tasksToShow);
    
    setTasksToRemember(tasksToShow);
    setGamePhase('learning');
    
    // Calculate total viewing time
    const totalTime = Math.round(tasksToShow.length * difficulty.viewingTimeMultiplier);
    setTimeLeft(totalTime);
    
    speakText(`Remember these tasks in order. You have ${totalTime} seconds.`);
    
    // Start countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          startTestingPhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();
  };

  // Start the testing phase
  const startTestingPhase = () => {
    setSelectedTasks([]);
    setGamePhase('testing');
    
    speakText("Select tasks in the correct order.");
  };

  // Handle task selection during testing
  const handleTaskSelection = (task) => {
    // Stop any ongoing speech immediately
    stopSpeech();
    
    // Add to selected tasks if not already selected
    if (!selectedTasks.find(t => t.id === task.id)) {
      const newSelectedTasks = [...selectedTasks, task];
      setSelectedTasks(newSelectedTasks);
      
      // Announce the selection
      speakText(task.name);
      
      // If all tasks have been selected, check results
      if (newSelectedTasks.length === tasksToRemember.length) {
        setTimeout(() => {
          checkResults();
        }, 1000);
      }
    }
  };

  // Remove last selected task
  const undoLastSelection = () => {
    if (selectedTasks.length > 0) {
      const newSelectedTasks = [...selectedTasks];
      const removedTask = newSelectedTasks.pop();
      setSelectedTasks(newSelectedTasks);
      
      speakText(`Removed task: ${removedTask.name}`);
    }
  };

  // Check results and calculate score
  const checkResults = () => {
    let correctCount = 0;
    
    // Check each selection against the correct sequence
    for (let i = 0; i < selectedTasks.length; i++) {
      if (i < tasksToRemember.length && selectedTasks[i].id === tasksToRemember[i].id) {
        correctCount++;
      }
    }
    
    // Calculate score as percentage
    const calculatedScore = Math.round((correctCount / tasksToRemember.length) * 100);
    setScore(calculatedScore);
    setGamePhase('results');
    
    // Track game completion in activity history
    ActivityTracker.trackActivity('Sequential Tasks', 'memory_game_completed', {
      score: calculatedScore,
      difficulty: difficulty.name,
      category: selectedCategory
    });
    
    // Feedback
    if (calculatedScore === 100) {
      speakText("Perfect score! Well done!");
    } else if (calculatedScore >= 70) {
      speakText("Good job! Keep practicing.");
    } else {
      speakText("Keep practicing to improve your memory.");
    }
  };

  // Restart the game
  const restartGame = () => {
    setGamePhase('setup');
    setSelectedCategory(null);
    setTasksToRemember([]);
    setSelectedTasks([]);
    setScore(0);
    
    speakText("Game restarted.");
  };

  // Play again with same settings
  const playAgain = () => {
    setSelectedTasks([]);
    startGame();
  };

  // Render category selection
  const renderCategorySelection = useCallback(() => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={styles.sectionTitle}>
          Choose a routine
        </Text>
        
        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedCategory === 'morningRoutine' && styles.selectedButton
          ]}
          onPress={() => selectCategory('morningRoutine')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Select Morning Routine"
          accessibilityState={{ selected: selectedCategory === 'morningRoutine' }}
        >
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === 'morningRoutine' && styles.selectedButtonText
          ]}>
            Morning Routine
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedCategory === 'mealPreparation' && styles.selectedButton
          ]}
          onPress={() => selectCategory('mealPreparation')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Select Meal Preparation"
          accessibilityState={{ selected: selectedCategory === 'mealPreparation' }}
        >
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === 'mealPreparation' && styles.selectedButtonText
          ]}>
            Meal Preparation
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedCategory === 'housecleaning' && styles.selectedButton
          ]}
          onPress={() => selectCategory('housecleaning')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Select Housecleaning"
          accessibilityState={{ selected: selectedCategory === 'housecleaning' }}
        >
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === 'housecleaning' && styles.selectedButtonText
          ]}>
            House cleaning
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedCategory === 'shopping' && styles.selectedButton
          ]}
          onPress={() => selectCategory('shopping')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Select Shopping"
          accessibilityState={{ selected: selectedCategory === 'shopping' }}
        >
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === 'shopping' && styles.selectedButtonText
          ]}>
            Shopping
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [selectedCategory]);

  // Render difficulty selection
  const renderDifficultySelection = useCallback(() => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={styles.sectionTitle}>
          Select Difficulty
        </Text>
        
        <View style={styles.difficultyContainer}>
          {Object.values(DIFFICULTY).map((level) => (
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
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Select ${level.name} difficulty`}
              accessibilityState={{ selected: difficulty === level }}
            >
              <Text style={styles.difficultyButtonText}>
                {level.name}
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
            (!selectedCategory || !difficulty) && styles.disabledButton
          ]}
          onPress={startGame}
          disabled={!selectedCategory || !difficulty}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Start Game"
          accessibilityState={{ disabled: !selectedCategory || !difficulty }}
        >
          <Ionicons name="play" size={20} color="#FFFFFF" />
          <Text style={styles.startButtonText}>
            Start Game
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [difficulty, selectedCategory]);

  // Render learning phase view
  const renderLearningPhase = () => {
    return (
      <Animated.View 
        style={[
          styles.gameContainer, 
          { opacity: fadeAnim, backgroundColor: difficulty.backgroundColor }
        ]}
      >
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>
            Memorize the tasks
          </Text>
        </View>
        
        <Text style={styles.instructionText}>
          Remember these tasks in order
        </Text>
        
        <View style={styles.tasksList}>
          {tasksToRemember.map((task, index) => (
            <View key={index} style={styles.taskItem}>
              <View style={styles.taskNumber}>
                <Text style={styles.taskNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.taskIcon}>
                <Ionicons name={task.icon} size={28} color="#005BBB" />
              </View>
              <View style={styles.taskDetails}>
                <Text style={styles.taskName}>
                  {task.name}
                </Text>
                <Text style={styles.taskDescription}>
                  {task.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
        
        <View style={styles.instructionFooter}>
          <Text style={styles.memorizeText}>
            Memorize these tasks
          </Text>
        </View>
      </Animated.View>
    );
  };

  // Render testing phase (selecting tasks in order)
  const renderTestingPhase = () => {
    // All tasks from the selected category
    const categoryTasks = sequentialTasks[selectedCategory];
    
    return (
      <View style={[
        styles.gameContainer, 
        { backgroundColor: difficulty.backgroundColor }
      ]}>
        <Text style={styles.instructionText}>
          Select tasks in the correct order
        </Text>
        
        <View style={styles.selectionContainer}>
          <Text style={styles.selectionTitle}>
            Your sequence so far
          </Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedTasksContainer}
          >
            {selectedTasks.length > 0 ? (
              selectedTasks.map((task, index) => (
                <View key={index} style={styles.selectedTaskBadge}>
                  <Text style={styles.selectedTaskNumber}>{index + 1}</Text>
                  <Ionicons name={task.icon} size={20} color="#FFFFFF" />
                  <Text style={styles.selectedTaskText}>
                    {task.name}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noTasksText}>
                Tap tasks to build your sequence
              </Text>
            )}
          </ScrollView>
          
          {selectedTasks.length > 0 && (
            <TouchableOpacity 
              style={styles.undoButton}
              onPress={undoLastSelection}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Undo last selection"
              accessibilityState={{ disabled: false }}
            >
              <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
              <Text style={styles.undoButtonText}>
                Undo Last
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.selectionTitle}>
          Available tasks
        </Text>
        
        <ScrollView 
          style={styles.tasksScrollView}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.tasksScrollContent}
        >
          <View style={styles.taskGridContainer}>
            {categoryTasks.map((task) => {
              const isSelected = selectedTasks.some(t => t.id === task.id);
              return (
                <TouchableOpacity 
                  key={task.id}
                  style={[
                    styles.taskChoiceItem,
                    isSelected && styles.taskChoiceItemDisabled
                  ]}
                  onPress={() => handleTaskSelection(task)}
                  disabled={isSelected}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Select task: ${task.name}`}
                  accessibilityState={{ disabled: isSelected }}
                >
                  <Ionicons 
                    name={task.icon} 
                    size={28} 
                    color={isSelected ? "#AAAAAA" : "#005BBB"} 
                  />
                  <Text
                    style={[
                      styles.taskChoiceName,
                      isSelected && styles.taskChoiceNameDisabled
                    ]}
                  >
                    {task.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.scrollPadding}></View>
        </ScrollView>
        
        <TouchableOpacity 
          style={[
            styles.checkButton,
            selectedTasks.length === 0 && styles.disabledButton
          ]}
          onPress={checkResults}
          disabled={selectedTasks.length === 0}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Check sequence"
          accessibilityState={{ disabled: selectedTasks.length === 0 }}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.checkButtonText}>
            Check Sequence
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Helper function to determine feedback based on score
  const getFeedbackKey = (score) => {
    if (score === 100) {
      return "Perfect score! Well done!";
    } else if (score >= 70) {
      return "Good job! Keep practicing.";
    } else {
      return "Keep practicing to improve your memory.";
    }
  };

  // Render results view
  const renderResults = () => {
    return (
      <View style={styles.resultsContainer}>
        <Text style={styles.resultTitle}>
          Your Score
        </Text>
        
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreText}>{score}</Text>
          <Text style={styles.scoreLabel}>
            Points
          </Text>
        </View>
        
        <Text style={styles.resultSubtitle}>
          What you remembered
        </Text>
        
        <View style={styles.comparisonContainer}>
          {tasksToRemember.map((correctTask, index) => {
            const userSelected = selectedTasks[index];
            const isCorrect = userSelected && userSelected.id === correctTask.id;
            
            return (
              <View key={index} style={styles.comparisonRow}>
                <View style={styles.comparisonNumber}>
                  <Text style={styles.comparisonNumberText}>{index + 1}</Text>
                </View>
                
                <View style={styles.comparisonTaskContainer}>
                  <View style={[styles.comparisonTask, styles.correctTask]}>
                    <Ionicons name={correctTask.icon} size={20} color="#4CAF50" />
                    <Text style={styles.correctTaskText}>
                      {correctTask.name}
                    </Text>
                  </View>
                  
                  {userSelected && (
                    <View style={[styles.comparisonTask, isCorrect ? styles.matchedTask : styles.incorrectTask]}>
                      <Ionicons 
                        name={userSelected.icon} 
                        size={20} 
                        color={isCorrect ? "#4CAF50" : "#F44336"} 
                      />
                      <Text 
                        style={[
                          styles.comparisonTaskText, 
                          isCorrect ? styles.matchedTaskText : styles.incorrectTaskText
                        ]}
                      >
                        {userSelected.name}
                      </Text>
                      <Ionicons 
                        name={isCorrect ? "checkmark-circle" : "close-circle"} 
                        size={16} 
                        color={isCorrect ? "#4CAF50" : "#F44336"} 
                        style={styles.resultIcon}
                      />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        
        <Text 
          style={styles.feedbackText}
        >
          {getFeedbackKey(score)}
        </Text>
        
        <View style={styles.resultButtonsContainer}>
          <TouchableOpacity 
            style={[styles.resultButton, styles.playAgainButton]}
            onPress={playAgain}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Play again"
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.resultButtonText}>
              Play Again
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.resultButton, styles.newGameButton]}
            onPress={restartGame}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="New game"
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="home" size={20} color="#FFFFFF" />
            <Text style={styles.resultButtonText}>
              New Game
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Function to print/save the sequential tasks data
  const printSequentialTasksData = async () => {
    try {
      // Create a text representation of the current state
      const timestamp = new Date().toLocaleString();
      let textContent = `Sequential Tasks\n`;
      textContent += `Exported on: ${timestamp}\n\n`;
      
      // Add game state information
      if (gamePhase === 'setup') {
        textContent += `Phase: Setup\n`;
        textContent += selectedCategory ? 
          `Selected Category: ${selectedCategory}\n` : 
          `Selected Category: None\n`;
        textContent += difficulty ? 
          `Difficulty: ${difficulty.name}\n` : 
          `Difficulty: None\n`;
      } 
      else if (gamePhase === 'learning') {
        textContent += `Phase: Learning\n`;
        textContent += `Selected Category: ${selectedCategory}\n`;
        textContent += `Difficulty: ${difficulty.name}\n`;
        textContent += `Tasks to Remember:\n`;
        
        tasksToRemember.forEach((task, index) => {
          textContent += `${index + 1}. ${task.name} - ${task.description}\n`;
        });
      }
      else if (gamePhase === 'testing') {
        textContent += `Phase: Testing\n`;
        textContent += `Selected Category: ${selectedCategory}\n`;
        textContent += `Difficulty: ${difficulty.name}\n`;
        
        if (selectedTasks.length > 0) {
          textContent += `Selected Tasks:\n`;
          selectedTasks.forEach((task, index) => {
            textContent += `${index + 1}. ${task.name}\n`;
          });
        }
      }
      else if (gamePhase === 'results') {
        textContent += `Phase: Results\n`;
        textContent += `Selected Category: ${selectedCategory}\n`;
        textContent += `Difficulty: ${difficulty.name}\n`;
        textContent += `Score: ${score}\n\n`;
        
        textContent += `Correct Sequence:\n`;
        tasksToRemember.forEach((task, index) => {
          textContent += `${index + 1}. ${task.name}\n`;
        });
        
        textContent += `\nYour Sequence:\n`;
        selectedTasks.forEach((task, index) => {
          const correctTask = tasksToRemember[index];
          const isCorrect = correctTask && task.id === correctTask.id;
          textContent += `${index + 1}. ${task.name} ${isCorrect ? '✓' : '✗'}\n`;
        });
      }
      
      // Save to a file
      const filename = `sequential_tasks_${new Date().getTime()}.txt`;
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(filePath, textContent, { encoding: FileSystem.EncodingType.UTF8 });

      // Share the file
      const shareResult = await Share.share({
        title: "Sequential Tasks Data",
        message: textContent,
      });
      
      if (shareResult.action === Share.sharedAction) {
        // Successful share
        ActivityTracker.trackActivity('Sequential Tasks', 'data_exported');
        
        // Notify user
        if (voiceEnabled) {
          speakText("Data saved and shared successfully.");
        } else {
          Alert.alert(
            "Success",
            "Data saved and shared successfully.",
            [{ text: "OK" }]
          );
        }
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert(
        "Error",
        "Failed to export data.",
        [{ text: "OK" }]
      );
    }
  };

  // Main render function
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fontSize + 2 }]}>
            Sequential Tasks
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={toggleVoice} 
              style={styles.controlButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={voiceEnabled ? "Turn voice off" : "Turn voice on"}
              accessibilityState={{ checked: voiceEnabled }}
            >
              <Ionicons 
                name={voiceEnabled ? "volume-high" : "volume-mute"} 
                size={24} 
                color={voiceEnabled ? "#005BBB" : "#888"} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={printSequentialTasksData} 
              style={styles.controlButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Save data"
            >
              <Ionicons name="document-text-outline" size={24} color="#005BBB" />
            </TouchableOpacity>
          </View>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {gamePhase === 'setup' && (
            <>
              <Text style={[styles.introText, { fontSize: fontSize - 2 }]}>
                Welcome to Sequential Tasks. Select a routine and difficulty to begin.
              </Text>
              {renderCategorySelection()}
              {selectedCategory && renderDifficultySelection()}
            </>
          )}
          
          {gamePhase === 'learning' && renderLearningPhase()}
          {gamePhase === 'testing' && renderTestingPhase()}
          {gamePhase === 'results' && renderResults()}
          
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              stopSpeech();
              navigation.goBack();
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back to activities"
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.backButtonText}>
              Back to Activities
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    elevation: 3,
  },
  headerButtons: {
    flexDirection: 'row',
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
    marginLeft: 8,
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
  tasksList: {
    marginBottom: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  taskNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#005BBB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  taskNumberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  taskIcon: {
    marginRight: 15,
  },
  taskDetails: {
    flex: 1,
  },
  taskName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  selectedTasksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: 10,
  },
  selectedTaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005BBB',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    position: 'relative',
  },
  selectedTaskNumber: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF9800',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedTaskText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  noTasksText: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    flex: 1,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    alignSelf: 'flex-end',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  undoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 4,
  },
  tasksScrollView: {
    maxHeight: 280, // Increased from 200 to 280 to show more tasks
    marginBottom: 16,
  },
  tasksScrollContent: {
    paddingBottom: 70, // Add extra padding at bottom for better scrolling
  },
  taskGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  taskChoiceItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  taskChoiceItemDisabled: {
    backgroundColor: '#F0F0F0',
    opacity: 0.6,
  },
  taskChoiceName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 6,
    textAlign: 'center',
  },
  taskChoiceNameDisabled: {
    color: '#888',
  },
  scrollPadding: {
    height: 50, // Increased from 20 to 50 for better scrolling space
  },
  checkButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#005BBB',
    textAlign: 'center',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#005BBB',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  resultSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  comparisonContainer: {
    marginBottom: 20,
  },
  comparisonRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  comparisonNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 8,
  },
  comparisonNumberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  comparisonTaskContainer: {
    flex: 1,
  },
  comparisonTask: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  correctTask: {
    backgroundColor: '#E8F5E9',
  },
  matchedTask: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  incorrectTask: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  correctTaskText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  comparisonTaskText: {
    marginLeft: 8,
    flex: 1,
  },
  matchedTaskText: {
    color: '#4CAF50',
  },
  incorrectTaskText: {
    color: '#F44336',
  },
  resultIcon: {
    marginLeft: 4,
  },
  feedbackText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
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
  instructionFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  memorizeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default SequentialTasksScreen;