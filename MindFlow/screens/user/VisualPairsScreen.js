import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext";

const GAME_PAIRS = [
  {
    level: 'easy',
    pairs: [
      { id: 'e1a', name: 'Sun', image: require('../../assets/images/memory-game/sun.jpeg'), paired: 'e1b' },
      { id: 'e1b', name: 'Moon', image: require('../../assets/images/memory-game/moon.jpeg'), paired: 'e1a' },
      { id: 'e2a', name: 'Dog', image: require('../../assets/images/memory-game/dog.jpeg'), paired: 'e2b' },
      { id: 'e2b', name: 'Bone', image: require('../../assets/images/memory-game/bone.jpeg'), paired: 'e2a' },
      { id: 'e3a', name: 'Key', image: require('../../assets/images/memory-game/key.jpeg'), paired: 'e3b' },
      { id: 'e3b', name: 'Lock', image: require('../../assets/images/memory-game/lock.png'), paired: 'e3a' },
      { id: 'e4a', name: 'Cup', image: require('../../assets/images/memory-game/cup.jpeg'), paired: 'e4b' },
      { id: 'e4b', name: 'Tea', image: require('../../assets/images/memory-game/tea.jpeg'), paired: 'e4a' },
    ]
  },
  {
    level: 'medium',
    pairs: [
      { id: 'm1a', name: 'Sun', image: require('../../assets/images/memory-game/sun.jpeg'), paired: 'm1b' },
      { id: 'm1b', name: 'Moon', image: require('../../assets/images/memory-game/moon.jpeg'), paired: 'm1a' },
      { id: 'm2a', name: 'Dog', image: require('../../assets/images/memory-game/dog.jpeg'), paired: 'm2b' },
      { id: 'm2b', name: 'Bone', image: require('../../assets/images/memory-game/bone.jpeg'), paired: 'm2a' },
      { id: 'm3a', name: 'Key', image: require('../../assets/images/memory-game/key.jpeg'), paired: 'm3b' },
      { id: 'm3b', name: 'Lock', image: require('../../assets/images/memory-game/lock.png'), paired: 'm3a' },
      { id: 'm4a', name: 'Needle', image: require('../../assets/images/memory-game/needle.jpeg'), paired: 'm4b' },
      { id: 'm4b', name: 'Thread', image: require('../../assets/images/memory-game/thread.jpeg'), paired: 'm4a' },
      { id: 'm5a', name: 'Shoe', image: require('../../assets/images/memory-game/shoe.webp'), paired: 'm5b' },
      { id: 'm5b', name: 'Sock', image: require('../../assets/images/memory-game/sock.jpeg'), paired: 'm5a' },
      { id: 'm6a', name: 'Phone', image: require('../../assets/images/memory-game/phone.jpeg'), paired: 'm6b' },
      { id: 'm6b', name: 'Charger', image: require('../../assets/images/memory-game/charger.jpeg'), paired: 'm6a' },
    ]
  },
  {
    level: 'hard',
    pairs: [
      { id: 'h1a', name: 'Sun', image: require('../../assets/images/memory-game/sun.jpeg'), paired: 'h1b' },
      { id: 'h1b', name: 'Moon', image: require('../../assets/images/memory-game/moon.jpeg'), paired: 'h1a' },
      { id: 'h2a', name: 'Dog', image: require('../../assets/images/memory-game/dog.jpeg'), paired: 'h2b' },
      { id: 'h2b', name: 'Bone', image: require('../../assets/images/memory-game/bone.jpeg'), paired: 'h2a' },
      { id: 'h3a', name: 'Key', image: require('../../assets/images/memory-game/key.jpeg'), paired: 'h3b' },
      { id: 'h3b', name: 'Lock', image: require('../../assets/images/memory-game/lock.png'), paired: 'h3a' },
      { id: 'h4a', name: 'Cup', image: require('../../assets/images/memory-game/cup.jpeg'), paired: 'h4b' },
      { id: 'h4b', name: 'Tea', image: require('../../assets/images/memory-game/tea.jpeg'), paired: 'h4a' },
      { id: 'h5a', name: 'Needle', image: require('../../assets/images/memory-game/needle.jpeg'), paired: 'h5b' },
      { id: 'h5b', name: 'Thread', image: require('../../assets/images/memory-game/thread.jpeg'), paired: 'h5a' },
      { id: 'h6a', name: 'Shoe', image: require('../../assets/images/memory-game/shoe.webp'), paired: 'h6b' },
      { id: 'h6b', name: 'Sock', image: require('../../assets/images/memory-game/sock.jpeg'), paired: 'h6a' },
      { id: 'h7a', name: 'Pen', image: require('../../assets/images/memory-game/pen.jpeg'), paired: 'h7b' },
      { id: 'h7b', name: 'Paper', image: require('../../assets/images/memory-game/paper.jpg'), paired: 'h7a' },
      { id: 'h8a', name: 'Phone', image: require('../../assets/images/memory-game/phone.jpeg'), paired: 'h8b' },
      { id: 'h8b', name: 'Charger', image: require('../../assets/images/memory-game/charger.jpeg'), paired: 'h8a' },
    ]
  },
];

const VisualPairsScreen = ({ navigation }) => {
  const [difficulty, setDifficulty] = useState('easy');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameItems, setGameItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [forceRender, setForceRender] = useState({});

  const timerRef = useRef(null);
  const screenWidth = Dimensions.get('window').width;
  const { fontSize } = useFontSize();
  const scoreAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setForceRender({});
    const updateUI = async () => {
      if (gameStarted) {
      } else {
        speakWithVoiceCheck("Welcome to Visual Pairs!", true, false);
      }
    };
    updateUI();
  }, []);

  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        if (storedVoiceSetting === 'false') {
          setVoiceEnabled(false);
        } else {
          setVoiceEnabled(true);
          speakWithVoiceCheck("Welcome to Visual Pairs! Match the related images to complete each level.", true, true);
        }
      } catch (error) {
        console.error('Error loading voice settings:', error);
      }
    };
    loadVoiceSettings();
    const unsubscribe = setupNavigationSpeechControl(navigation);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopSpeech();
      unsubscribe();
    };
  }, [navigation]);

  const startGame = () => {
    const difficultySet = GAME_PAIRS.find(set => set.level === difficulty);
    if (difficultySet) {
      const shuffledItems = [...difficultySet.pairs].sort(() => Math.random() - 0.5);
      setGameItems(shuffledItems);
      setMatchedPairs([]);
      setSelectedItems([]);
      setScore(0);
      setTimer(0);
      setGameStarted(true);
      speak(`${difficulty} level game started`);
      ActivityTracker.trackGameActivity(
        'Visual Pairs',
        'Started Game',
        `Difficulty: ${difficulty}`
      );
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
  };

  const endGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    let stars = 3;
    if (difficulty === 'easy') {
      if (timer > 60) stars = 2;
      if (timer > 90) stars = 1;
    } else if (difficulty === 'medium') {
      if (timer > 120) stars = 2;
      if (timer > 180) stars = 1;
    } else {
      if (timer > 180) stars = 2;
      if (timer > 240) stars = 1;
    }
    const timeString = `${Math.floor(timer / 60)}:${timer % 60 < 10 ? '0' : ''}${timer % 60}`;
    speak(`Great job! You completed ${difficulty} level in ${timeString}.`);
    ActivityTracker.trackGameActivity(
      'Visual Pairs',
      'Completed Game',
      `Difficulty: ${difficulty}, Time: ${timeString}, Stars: ${stars}`
    );
    Alert.alert(
      'Game Completed',
      `You matched all pairs in ${timeString}!\n\nPerformance: ${stars} ${stars !== 1 ? 'stars' : 'star'}`,
      [
        {
          text: 'Play Again',
          onPress: () => startGame(),
        },
        {
          text: 'Change Difficulty',
          onPress: () => setGameStarted(false),
          style: 'cancel',
        },
      ]
    );
  };

  const speak = (message) => {
    if (voiceEnabled) {
      speakWithVoiceCheck(message, true, true);
    }
  };

  const selectItem = (item) => {
    if (matchedPairs.includes(item.id)) return;
    if (selectedItems.length === 2) return;
    speak(item.name);
    setSelectedItems((prev) => [...prev, item]);
  };

  useEffect(() => {
    if (selectedItems.length === 2) {
      const [first, second] = selectedItems;
      if (first.paired === second.id) {
        setMatchedPairs(prev => [...prev, first.id, second.id]);
        setScore(prev => prev + 10);
        Animated.sequence([
          Animated.timing(scoreAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scoreAnimation, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        speak("Good match!");
        setTimeout(() => {
          setSelectedItems([]);
        }, 500);
      } else {
        speak("Try again");
        setTimeout(() => {
          setSelectedItems([]);
        }, 1500);
      }
    }
  }, [selectedItems]);

  useEffect(() => {
    if (gameStarted && matchedPairs.length === gameItems.length) {
      endGame();
    }
  }, [matchedPairs, gameItems, gameStarted]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return (
      <Text>
        {mins}:{secs < 10 ? '0' : ''}{secs}
      </Text>
    );
  };

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const newValue = !prev;
      if (!newValue) {
        stopSpeech();
      } else {
        speak("Voice instructions enabled");
      }
      return newValue;
    });
  };

  const getItemSize = () => {
    if (difficulty === 'easy') {
      return Math.min(screenWidth / 2 - 24, 140);
    } else if (difficulty === 'medium') {
      return Math.min(screenWidth / 3 - 24, 110);
    } else {
      // Hard difficulty - 3 images per row with increased size
      return Math.min(screenWidth / 3 - 24, 120);
    }
  };

  const getNumColumns = () => {
    if (difficulty === 'easy') return 2;
    if (difficulty === 'medium') return 3;
    return 3; // Hard difficulty shows 3 images per row
  };

  const gameDescription = "Match the pairs of images that are related to each other. Remember their locations to complete the game faster.";
  const howToPlaySteps = [
    'Tap on any image to reveal it.',
    'Try to find another image that makes a pair with the first one.',
    'If the images match, they will stay face up. If not, they will flip back.',
    'Complete the level by matching all pairs in the shortest time possible.'
  ];

  const memoryTipTitle = 'Memory Tip';
  const memoryTipDescription = 'Try to create a mental story connecting the items you see. This can help you remember their locations more effectively.';

  if (!gameStarted) {
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
          
          <Text style={[styles.headerTitle, { fontSize: fontSize }]}>Visual Pairs</Text>
          
          <TouchableOpacity 
            style={styles.voiceButton}
            onPress={toggleVoice}
            accessibilityLabel={voiceEnabled ? 'Turn voice off' : 'Turn voice on'}
          >
            <Ionicons 
              name={voiceEnabled ? "volume-high" : "volume-mute"} 
              size={24} 
              color={voiceEnabled ? "#005BBB" : "#888"} 
            />
          </TouchableOpacity>
        </View>
        
        <ScrollView contentContainerStyle={styles.setupContainer}>
          <Text style={[styles.title, { fontSize: fontSize + 4 }]}>Visual Pairs</Text>
          <Text style={[styles.description, { fontSize: fontSize - 2 }]}>{gameDescription}</Text>
          
          <View style={styles.difficultyContainer}>
            <Text style={[styles.difficultyTitle, { fontSize: fontSize }]}>Select Difficulty</Text>
            
            <View style={styles.difficultyButtons}>
              <TouchableOpacity 
                style={[
                  styles.difficultyButton, 
                  difficulty === 'easy' && styles.selectedDifficulty
                ]}
                onPress={() => {
                  setDifficulty('easy');
                  speak("Easy level: 4 pairs to match");
                }}
              >
                <Text style={[
                  styles.difficultyText,
                  difficulty === 'easy' && styles.selectedDifficultyText,
                  { fontSize: fontSize - 2 }
                ]}>Easy</Text>
                <View style={{flexDirection: 'row'}}>
                  <Text style={[styles.difficultySubtext, { fontSize: fontSize - 4 }]}>4 </Text>
                  <Text style={[styles.difficultySubtext, { fontSize: fontSize - 4 }]}>pairs</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.difficultyButton, 
                  difficulty === 'medium' && styles.selectedDifficulty
                ]}
                onPress={() => {
                  setDifficulty('medium');
                  speak("Medium level: 6 pairs to match");
                }}
              >
                <Text style={[
                  styles.difficultyText,
                  difficulty === 'medium' && styles.selectedDifficultyText,
                  { fontSize: fontSize - 2 }
                ]}>Medium</Text>
                <View style={{flexDirection: 'row'}}>
                  <Text style={[styles.difficultySubtext, { fontSize: fontSize - 4 }]}>6 </Text>
                  <Text style={[styles.difficultySubtext, { fontSize: fontSize - 4 }]}>pairs</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.difficultyButton, 
                  difficulty === 'hard' && styles.selectedDifficulty
                ]}
                onPress={() => {
                  setDifficulty('hard');
                  speak("Hard level: 8 pairs to match");
                }}
              >
                <Text style={[
                  styles.difficultyText,
                  difficulty === 'hard' && styles.selectedDifficultyText,
                  { fontSize: fontSize - 2 }
                ]}>Hard</Text>
                <View style={{flexDirection: 'row'}}>
                  <Text style={[styles.difficultySubtext, { fontSize: fontSize - 4 }]}>8 </Text>
                  <Text style={[styles.difficultySubtext, { fontSize: fontSize - 4 }]}>pairs</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.instructionsContainer}>
            <Text style={[styles.instructionsTitle, { fontSize: fontSize }]}>How To Play</Text>
            {howToPlaySteps.map((step, index) => (
              <View key={index} style={styles.instructionStep}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>{index + 1}</Text>
                </View>
                <Text style={[styles.instructionText, { fontSize: fontSize - 2 }]}>{step}</Text>
              </View>
            ))}
          </View>
          
          <TouchableOpacity 
            style={styles.startButton}
            onPress={startGame}
          >
            <Text style={[styles.startButtonText, { fontSize: fontSize }]}>Start Game</Text>
            <Ionicons name="play" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.tipContainer}>
            <Text style={[styles.tipTitle, { fontSize: fontSize - 2 }]}>{memoryTipTitle}</Text>
            <Text style={[styles.tipText, { fontSize: fontSize - 2 }]}>{memoryTipDescription}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            stopSpeech();
            if (timerRef.current) clearInterval(timerRef.current);
            setGameStarted(false);
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#005BBB" />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { fontSize: fontSize }]}>Visual Pairs</Text>
        
        <TouchableOpacity 
          style={styles.voiceButton}
          onPress={toggleVoice}
          accessibilityLabel={voiceEnabled ? 'Turn voice off' : 'Turn voice on'}
        >
          <Ionicons 
            name={voiceEnabled ? "volume-high" : "volume-mute"} 
            size={24} 
            color={voiceEnabled ? "#005BBB" : "#888"} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.gameStats}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={20} color="#555" />
          <Text style={[styles.statText, { fontSize: fontSize - 2 }]}>{formatTime(timer)}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="trophy-outline" size={20} color="#555" />
          <Animated.Text style={[
            styles.statText,
            {
              fontSize: fontSize - 2,
              transform: [
                { scale: scoreAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.3]
                }) }
              ],
              color: scoreAnimation.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: ['#555', '#4CAF50', '#555']
              })
            }
          ]}>
            <Text>{score}</Text> <Text>points</Text>
          </Animated.Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="cellular-outline" size={20} color="#555" />
          <Text style={[styles.statText, { fontSize: fontSize - 2 }]}>
            <Text>{matchedPairs.length / 2} / {gameItems.length / 2}</Text> <Text>pairs</Text>
          </Text>
        </View>
      </View>
      
      <ScrollView contentContainerStyle={[
        styles.gameGrid, 
        { padding: difficulty === 'hard' ? 8 : 16 }
      ]}>
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {gameItems.map(item => {
            const isSelected = selectedItems.find(selected => selected.id === item.id);
            const isMatched = matchedPairs.includes(item.id);
            const itemSize = getItemSize();
            
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.gameItem,
                  { 
                    width: itemSize, 
                    height: itemSize,
                    margin: difficulty === 'hard' ? 4 : 8,
                  },
                  isSelected && styles.selectedItem,
                  isMatched && styles.matchedItem,
                ]}
                onPress={() => selectItem(item)}
                disabled={isMatched}
              >
                <Image
                  source={item.image}
                  style={styles.itemImage}
                  resizeMode="contain"
                />
                <Text style={[styles.itemName, { fontSize: fontSize - 4 }]}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
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
  setupContainer: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  difficultyContainer: {
    width: '100%',
    marginBottom: 24,
  },
  difficultyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  difficultyButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  selectedDifficulty: {
    backgroundColor: '#005BBB',
  },
  difficultyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedDifficultyText: {
    color: '#FFFFFF',
  },
  difficultySubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  instructionsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#005BBB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    marginBottom: 24,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
  },
  tipContainer: {
    width: '100%',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
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
  gameStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    elevation: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginLeft: 6,
  },
  gameGrid: {
    paddingVertical: 16,
  },
  gameItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    padding: 8,
  },
  selectedItem: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#005BBB',
    elevation: 3,
  },
  matchedItem: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  itemImage: {
    width: '70%',
    height: '70%',
  },
  itemName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default VisualPairsScreen;