import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Dimensions, 
  Alert,
  Animated,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
// Import ActivityTracker
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Updated import path

// Animal images for the puzzle
const animalImages = {
  cat: require('../images/animals/cat.jpg'),
  dog: require('../images/animals/dog.jpg'),
  lion: require('../images/animals/lion.jpg'),
  monkey: require('../images/animals/monkey.jpg'),
  squirrel: require('../images/animals/squrel.jpg'),
  tiger: require('../images/animals/tiger.jpg'),
  zebra: require('../images/animals/zebra.jpg')
};

// Animal names for voice instructions
const animalNames = {
  cat: "Cat",
  dog: "Dog",
  lion: "Lion",
  monkey: "Monkey",
  squirrel: "Squirrel",
  tiger: "Tiger",
  zebra: "Zebra"
};

// Difficulty levels
const DIFFICULTY = {
  EASY: { size: 3, name: 'Easy' },
  MEDIUM: { size: 4, name: 'Medium' },
  HARD: { size: 5, name: 'Hard' }
};

const PuzzleChallengeScreen = () => {
  const navigation = useNavigation();
  const [difficulty, setDifficulty] = useState(DIFFICULTY.EASY);
  const [selectedAnimal, setSelectedAnimal] = useState('cat');
  const [tiles, setTiles] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [moves, setMoves] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(5); // seconds
  const [timer, setTimer] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);
  const previewTimerRef = useRef(null);
  const windowWidth = Dimensions.get('window').width;
  const tileScale = useRef(new Animated.Value(1)).current;
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Add hooks for font size
  const { fontSize } = useFontSize();

  // Check for global voice assistance setting when screen loads
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
    
    // Setup navigation listener to stop speech when leaving this screen
    const unsubscribe = setupNavigationSpeechControl(navigation);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
      stopSpeech();
      unsubscribe();
    };
  }, [navigation]);
  
  // Initial welcome message when screen loads
  useEffect(() => {
    if (voiceSettingsLoaded) {
      speak('Welcome to the Sliding Puzzle Challenge!');
    }
  }, [voiceSettingsLoaded]);
  
  // Stop speech when navigating away from the screen
  useFocusEffect(
    React.useCallback(() => {
      // Track screen visit when user enters the screen
      ActivityTracker.trackScreenVisit('PuzzleChallenge');
      
      return () => {
        // On screen unfocus (navigating away)
        Speech.stop();
      };
    }, [])
  );

  // Helper function to speak instructions if voice is enabled
  const speak = (message) => {
    if (voiceEnabled) {
      // Using immediate=true to ensure ongoing speech is stopped before new one starts
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

  // Setup the puzzle board
  const setupPuzzle = () => {
    const { size } = difficulty;
    const totalTiles = size * size;
    const initialTiles = [];
    
    // Create tiles in order (leave the last slot empty)
    for (let i = 0; i < totalTiles - 1; i++) {
      initialTiles.push({ id: i, position: i });
    }
    // Add the empty tile at the end
    initialTiles.push({ id: totalTiles - 1, position: totalTiles - 1, empty: true });
    
    // Shuffle the tiles (ensuring the puzzle is solvable)
    const shuffledTiles = shuffleTiles(initialTiles, size);
    setTiles(shuffledTiles);
    setMoves(0);
    setIsComplete(false);
    setTimerRunning(false);
    setTimer(0);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Function to check if a puzzle configuration is solvable
  const isSolvable = (tiles, size) => {
    // Create a flat array of tile IDs with empty represented as size*size
    const flatTiles = tiles.map(tile => tile.empty ? size * size : tile.id);
    
    // Find position of empty tile from the bottom
    const emptyPos = size - 1 - Math.floor(tiles.findIndex(t => t.empty) / size);
    
    // Count inversions
    let inversions = 0;
    for (let i = 0; i < flatTiles.length; i++) {
      for (let j = i + 1; j < flatTiles.length; j++) {
        if (flatTiles[i] > flatTiles[j] && flatTiles[i] !== size * size && flatTiles[j] !== size * size) {
          inversions++;
        }
      }
    }
    
    // For odd-sized grids, the puzzle is solvable if inversions is even
    if (size % 2 === 1) {
      return inversions % 2 === 0;
    } 
    // For even-sized grids, the puzzle is solvable if:
    // (inversions + emptyPos) is odd
    else {
      return (inversions + emptyPos) % 2 === 1;
    }
  };

  // Shuffle the tiles ensuring the puzzle is solvable
  const shuffleTiles = (tiles, size) => {
    let shuffled = [...tiles];
    
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // Swap positions
      const tempPos = shuffled[i].position;
      shuffled[i].position = shuffled[j].position;
      shuffled[j].position = tempPos;
    }
    
    // Check if the shuffle resulted in a solvable puzzle
    if (!isSolvable(shuffled, size)) {
      // If not solvable, swap two tiles (not including the empty tile)
      const nonEmptyTiles = shuffled.filter(tile => !tile.empty);
      if (nonEmptyTiles.length >= 2) {
        const i = 0;
        const j = 1;
        const tempPos = nonEmptyTiles[i].position;
        nonEmptyTiles[i].position = nonEmptyTiles[j].position;
        nonEmptyTiles[j].position = tempPos;
      }
    }
    
    return shuffled;
  };

  // Check if the puzzle is completed
  const checkCompletion = () => {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].id !== tiles[i].position && !tiles[i].empty) {
        return false;
      }
    }
    return true;
  };

  // Move a tile if it's adjacent to the empty slot
  const moveTile = (tile) => {
    if (isComplete || !gameStarted) return;
    
    // Start the timer on first move
    if (!timerRunning && moves === 0) {
      setTimerRunning(true);
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    
    // Get the empty tile
    const emptyTile = tiles.find(t => t.empty);
    if (!emptyTile) return;
    
    const size = difficulty.size;
    const tilePos = tile.position;
    const emptyPos = emptyTile.position;
    
    // Check if the tile is adjacent to the empty slot
    // Calculate row and column of tile and empty slot
    const tileRow = Math.floor(tilePos / size);
    const tileCol = tilePos % size;
    const emptyRow = Math.floor(emptyPos / size);
    const emptyCol = emptyPos % size;
    
    // Check if they're adjacent
    const isAdjacent = 
      (tileRow === emptyRow && Math.abs(tileCol - emptyCol) === 1) || 
      (tileCol === emptyCol && Math.abs(tileRow - emptyRow) === 1);
    
    if (isAdjacent) {
      // Animate the tile movement
      Animated.sequence([
        Animated.timing(tileScale, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(tileScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Swap positions
      const newTiles = [...tiles];
      const tileIndex = tiles.findIndex(t => t.id === tile.id);
      const emptyIndex = tiles.findIndex(t => t.empty);
      
      newTiles[tileIndex].position = emptyPos;
      newTiles[emptyIndex].position = tilePos;
      
      setTiles(newTiles);
      setMoves(prev => prev + 1);
      
      // Check if the puzzle is complete after this move
      setTimeout(() => {
        const complete = checkCompletion();
        if (complete) {
          setIsComplete(true);
          
          if (timerRef.current) {
            clearInterval(timerRef.current);
            setTimerRunning(false);
          }
          
          // Track puzzle completion in Memory Game category
          ActivityTracker.trackActivity(
            `Completed ${difficulty.name} Puzzle Challenge`, 
            'Memory Game', 
            `Animal: ${animalNames[selectedAnimal]}, Moves: ${moves + 1}, Time: ${formatTime(timer)}`
          );
          
          speak('Congratulations! You have completed the puzzle.');
          Alert.alert(
            'Puzzle Complete',
            `You completed the ${selectedAnimal} puzzle in ${moves + 1} moves and ${formatTime(timer)}.`,
            [{ text: 'Great!' }]
          );
        }
      }, 300);
    }
  };

  // Format time for display (mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start a new game
  const startGame = () => {
    speak(`Starting ${difficulty.name} puzzle with the ${animalNames[selectedAnimal]}. You'll have ${previewTime} seconds to see the complete image.`);
    
    // Track starting a puzzle game in the Memory Game category
    ActivityTracker.trackActivity(
      `Started ${difficulty.name} Puzzle Challenge`, 
      'Memory Game', 
      `Animal: ${animalNames[selectedAnimal]}, Difficulty: ${difficulty.name}`
    );
    
    setGameStarted(true);
    setShowPreview(true);
    setupPuzzle();
    
    // Preview timer
    let countdown = previewTime;
    setPreviewTime(countdown);
    
    previewTimerRef.current = setInterval(() => {
      countdown--;
      setPreviewTime(countdown);
      
      if (countdown <= 0) {
        clearInterval(previewTimerRef.current);
        setShowPreview(false);
        speak("Start moving the tiles to complete the puzzle!");
      }
    }, 1000);
  };

  // Reset the game
  const resetGame = () => {
    setGameStarted(false);
    setShowPreview(false);
    setIsComplete(false);
    setMoves(0);
    setTimer(0);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    
    Speech.stop();
  };

  // Show a hint (preview of completed puzzle)
  const showHint = () => {
    setShowPreview(true);
    speak("Here's a preview of the completed puzzle.");
    
    setTimeout(() => {
      setShowPreview(false);
    }, 3000);
  };

  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
      Speech.stop();
    };
  }, []);

  // Render a tile in the grid
  const renderTile = (tile, index) => {
    const { size } = difficulty;
    const tileSize = (windowWidth - 60) / size; // 60 is for padding
    
    if (tile.empty) {
      return (
        <View
          key={`tile-${index}`}
          style={[
            styles.tile, 
            styles.emptyTile,
            { width: tileSize, height: tileSize }
          ]}
        />
      );
    }
    
    // Calculate the coordinates for image clipping
    const originalWidth = 300; // Assume square images of 300x300
    const originalHeight = 300;
    const tileWidth = originalWidth / size;
    const tileHeight = originalHeight / size;
    
    // Calculate the original position for this tile ID
    const originalRow = Math.floor(tile.id / size);
    const originalCol = tile.id % size;
    
    return (
      <TouchableOpacity
        key={`tile-${index}`}
        onPress={() => moveTile(tile)}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.tile,
            { 
              width: tileSize, 
              height: tileSize,
              transform: [{ scale: tileScale }]
            }
          ]}
        >
          <View style={styles.tileImageContainer}>
            <Image
              source={animalImages[selectedAnimal]}
              style={{
                width: tileSize * size,
                height: tileSize * size,
                position: 'absolute',
                top: -originalRow * tileSize,
                left: -originalCol * tileSize,
              }}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.tileNumber}>{tile.id + 1}</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Render the game board
  const renderBoard = () => {
    const { size } = difficulty;
    const sortedTiles = [...tiles].sort((a, b) => a.position - b.position);
    
    return (
      <View style={styles.puzzleContainer}>
        {showPreview ? (
          <View style={styles.previewContainer}>
            <Image
              source={animalImages[selectedAnimal]}
              style={styles.previewImage}
              resizeMode="contain"
            />
            {!isComplete && (
              <View style={styles.previewOverlay}>
                <Text style={[styles.previewText, { fontSize: fontSize - 2 }]}>
                  {`Preview ends in ${previewTime} seconds`}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.puzzleGrid, { flexDirection: 'column' }]}>
            {Array(size).fill().map((_, rowIndex) => (
              <View key={`row-${rowIndex}`} style={{ flexDirection: 'row' }}>
                {Array(size).fill().map((_, colIndex) => {
                  const position = rowIndex * size + colIndex;
                  const tile = sortedTiles.find(t => t.position === position);
                  return renderTile(tile, position);
                })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Render the animal selection
  const renderAnimalSelection = () => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={[styles.selectionTitle, { fontSize: fontSize }]}>Choose an Animal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.animalScroll}>
          {Object.keys(animalImages).map((animal) => (
            <TouchableOpacity
              key={animal}
              style={[
                styles.animalItem,
                selectedAnimal === animal && styles.selectedAnimalItem
              ]}
              onPress={() => {
                setSelectedAnimal(animal);
                speak(`Selected ${animalNames[animal]} puzzle.`);
              }}
            >
              <Image 
                source={animalImages[animal]}
                style={styles.animalImage}
                resizeMode="cover"
              />
              <Text style={[styles.animalName, { fontSize: fontSize - 4 }]}>{animal}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Render difficulty selection
  const renderDifficultySelection = () => {
    return (
      <View style={styles.selectionContainer}>
        <Text style={[styles.selectionTitle, { fontSize: fontSize }]}>Select Difficulty</Text>
        <View style={styles.difficultyContainer}>
          {Object.keys(DIFFICULTY).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.difficultyButton,
                difficulty === DIFFICULTY[level] && styles.selectedDifficulty,
                level === 'EASY' && styles.easyButton,
                level === 'MEDIUM' && styles.mediumButton,
                level === 'HARD' && styles.hardButton,
              ]}
              onPress={() => {
                setDifficulty(DIFFICULTY[level]);
                speak(`Selected ${DIFFICULTY[level].name} difficulty. This will be a ${DIFFICULTY[level].size} by ${DIFFICULTY[level].size} puzzle.`);
              }}
            >
              <Text style={[styles.difficultyText, { fontSize: fontSize - 2 }]}>{DIFFICULTY[level].name}</Text>
              <Text style={[styles.difficultySize, { fontSize: fontSize - 4 }]}>{DIFFICULTY[level].size}×{DIFFICULTY[level].size}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: fontSize + 2 }]}>Puzzle Challenge</Text>
        <TouchableOpacity onPress={toggleVoice} style={styles.voiceButton}>
          <Ionicons 
            name={voiceEnabled ? "volume-high" : "volume-mute"} 
            size={24} 
            color={voiceEnabled ? "#005BBB" : "#888"} 
          />
        </TouchableOpacity>
      </View>
      
      {gameStarted ? (
        <>
          <View style={styles.gameInfoContainer}>
            <View style={styles.gameInfo}>
              <Text style={[styles.infoLabel, { fontSize: fontSize - 4 }]}>Moves</Text>
              <Text style={[styles.infoValue, { fontSize: fontSize - 2 }]}>{moves}</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={[styles.infoLabel, { fontSize: fontSize - 4 }]}>Time</Text>
              <Text style={[styles.infoValue, { fontSize: fontSize - 2 }]}>{formatTime(timer)}</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={[styles.infoLabel, { fontSize: fontSize - 4 }]}>Size</Text>
              <Text style={[styles.infoValue, { fontSize: fontSize - 2 }]}>{difficulty.size}×{difficulty.size}</Text>
            </View>
          </View>
          
          {renderBoard()}
          
          <View style={styles.gameControls}>
            {!isComplete && !showPreview && (
              <TouchableOpacity style={styles.hintButton} onPress={showHint}>
                <Ionicons name="eye" size={20} color="white" />
                <Text style={[styles.buttonText, { fontSize: fontSize - 2 }]}>Show Hint</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={[styles.buttonText, { fontSize: fontSize - 2 }]}>New Game</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.instructionsText, { fontSize: fontSize - 2 }]}>
            Solve the sliding puzzle by arranging the tiles to form the complete image.
          </Text>
          
          {renderAnimalSelection()}
          {renderDifficultySelection()}
          
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Ionicons name="play" size={24} color="white" />
            <Text style={[styles.startButtonText, { fontSize: fontSize }]}>Start Puzzle</Text>
          </TouchableOpacity>
        </>
      )}
      
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => {
          resetGame();
          navigation.goBack();
        }}
      >
        <Ionicons name="arrow-back" size={20} color="white" />
        <Text style={[styles.backButtonText, { fontSize: fontSize - 2 }]}>Back to Activities</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F0F4F8',
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
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  voiceButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F4F8',
  },
  instructionsText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    lineHeight: 22,
  },
  selectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  animalScroll: {
    flexDirection: 'row',
  },
  animalItem: {
    alignItems: 'center',
    marginRight: 12,
    width: 100,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  selectedAnimalItem: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  animalImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  animalName: {
    marginTop: 4,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  difficultyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
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
  selectedDifficulty: {
    borderWidth: 2,
    borderColor: '#000',
  },
  difficultyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  difficultySize: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 4,
  },
  startButton: {
    backgroundColor: '#005BBB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    elevation: 3,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
  gameInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    elevation: 2,
  },
  gameInfo: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  puzzleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  puzzleGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    overflow: 'hidden',
  },
  tileImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  tileNumber: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    color: '#333',
  },
  emptyTile: {
    backgroundColor: '#DDD',
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  previewImage: {
    width: Dimensions.get('window').width - 60,
    height: Dimensions.get('window').width - 60,
    borderRadius: 12,
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
  },
  previewText: {
    color: '#FFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  gameControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  hintButton: {
    flex: 1,
    backgroundColor: '#009688',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    elevation: 2,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#FF5722',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    elevation: 2,
  },
  buttonText: {
    color: '#FFF',
    marginLeft: 6,
    fontWeight: 'bold',
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
    color: '#FFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PuzzleChallengeScreen;
