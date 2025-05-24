import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Image 
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopSpeech, speakWithVoiceCheck, setupNavigationSpeechControl } from '../../utils/SpeechManager';
import * as ActivityTracker from '../../utils/ActivityTracker';
import { useFontSize } from "../user/FontSizeContext"; // Updated import path

const fruitsLocal = [
  require('../images/fruits/apple.jpg'),
  require('../images/fruits/Banana.jpg'),
  require('../images/fruits/grapes.jpg'),
  require('../images/fruits/orange.jpg'),
  require('../images/fruits/orange.jpg'),
  require('../images/fruits/orange.jpg'),
];

const animalsLocal = [
  require('../images/animals/lion.jpg'),
  require('../images/animals/tiger.jpg'),
  require('../images/animals/dog.jpg'),
  require('../images/animals/monkey.jpg'),
  require('../images/animals/zebra.jpg'),
  require('../images/animals/cat.jpg'),
  require('../images/animals/squrel.jpg'),
];

const birdsLocal = [
  require('../images/birds/eagle.jpg'),
  require('../images/birds/parrot.jpg'),
  require('../images/birds/pigeon.jpg'),
  require('../images/birds/whiteparrot.jpg'),
];

const getCardValues = (level) => {
  const pairsCount = level + 3;
  if (level === 1) {
    return Array.from({ length: pairsCount }, (_, i) => ({
      value: (i + 1).toString(),
      type: 'text'
    }));
  } else if (level === 2) {
    const alphabets = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return alphabets.slice(0, pairsCount).map(letter => ({
      value: letter,
      type: 'text'
    }));
  } else if (level === 3) {
    const count = Math.min(pairsCount, fruitsLocal.length);
    return fruitsLocal.slice(0, count).map(image => ({
      value: image,
      type: 'localImage'
    }));
  } else if (level === 4) {
    const count = Math.min(pairsCount, animalsLocal.length);
    return animalsLocal.slice(0, count).map(image => ({
      value: image,
      type: 'localImage'
    }));
  } else if (level === 5) {
    const combined = [...animalsLocal.slice(0, 8), ...birdsLocal.slice(0, 2)];
    return combined.map(image => ({
      value: image,
      type: 'localImage'
    }));
  }
  return [];
};

const generateCardsForLevel = (level) => {
  const values = getCardValues(level);
  let cards = [];
  const pairsCount = (level === 3 || level === 4 || level === 5) ? values.length : level + 3;
  for (let i = 0; i < pairsCount; i++) {
    cards.push({ id: `${i}-1`, value: values[i].value, type: values[i].type, isFlipped: false, isMatched: false, isMismatch: false });
    cards.push({ id: `${i}-2`, value: values[i].value, type: values[i].type, isFlipped: false, isMatched: false, isMismatch: false });
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
};

const allowedGuessesForLevel = (level) => 30 - 2 * (level - 1);

const MatchingPairsMultiLevelGame = ({ navigation }) => {
  const [level, setLevel] = useState(1);
  const [cards, setCards] = useState(generateCardsForLevel(1));
  const [flippedCards, setFlippedCards] = useState([]);
  const [guessCount, setGuessCount] = useState(0);
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const instructionSpoken = useRef({});

  const { fontSize } = useFontSize();

  const gameDescription = 'Find pairs of matching cards to improve your memory and concentration skills.';

  const getLevelInstruction = (level) => {
    switch (level) {
      case 1:
        return 'Match pairs of numbers. Take your time and focus.';
      case 2:
        return 'Now match pairs of letters. The challenge increases.';
      case 3:
        return 'Match pairs of fruit images. Visual memory is key.';
      case 4:
        return 'Match pairs of animal images. Stay focused.';
      case 5:
        return 'Final level! Match pairs of mixed animal and bird images.';
      default:
        return "";
    }
  };

  const gameOverMessage = 'Game over! You have used all your guesses. Try again.';

  const levelCompletedMessage = 'Great job! You completed this level successfully.';

  const gameCompletedMessage = 'Congratulations! You have completed all levels of the game.';

  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const storedVoiceSetting = await AsyncStorage.getItem('voiceAssistance');
        if (storedVoiceSetting === 'false') {
          setIsMuted(true);
        } else {
          speak('welcomeMessage');
        }
        setVoiceLoaded(true);
      } catch (error) {
        console.error('Error loading voice settings:', error);
        setVoiceLoaded(true);
      }
    };
    
    loadVoiceSettings();
    
    const unsubscribe = setupNavigationSpeechControl(navigation);
    
    return () => {
      stopSpeech();
      unsubscribe();
    };
  }, [navigation]);

  const speak = (message) => {
    if (!isMuted && voiceLoaded) {
      speakWithVoiceCheck(message, true, true);
    }
  };

  useEffect(() => {
    if (!isMuted && voiceLoaded && !instructionSpoken.current[level]) {
      let instruction = `level ${level}. `;
      instruction += getLevelInstruction(level);
      instruction += ` guessesAllowed`;
      speak(instruction);
      instructionSpoken.current[level] = true;
    }
  }, [level, isMuted, voiceLoaded]);

  useEffect(() => {
    if (voiceLoaded) {
      ActivityTracker.trackGameActivity(
        'Matching Pairs',
        'Started Level',
        `Level: ${level}`
      );
    }
  }, [level, voiceLoaded]);

  const handleCardPress = (cardIndex) => {
    stopSpeech();
    
    const card = cards[cardIndex];
    if (card.isFlipped || card.isMatched) return;

    const newCards = [...cards];
    newCards[cardIndex] = { ...card, isFlipped: true };
    setCards(newCards);
    const newFlipped = [...flippedCards, { ...card, index: cardIndex }];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      const newGuessCount = guessCount + 1;
      setGuessCount(newGuessCount);
      if (newGuessCount > allowedGuessesForLevel(level)) {
        speak(gameOverMessage);
        Alert.alert('Game Over', gameOverMessage, [
          { text: 'Restart Level', onPress: () => {
              setCards(generateCardsForLevel(level));
              setFlippedCards([]);
              setGuessCount(0);
            }
          }
        ]);
        return;
      }

      if (newFlipped[0].value === newFlipped[1].value) {
        newCards[newFlipped[0].index].isMatched = true;
        newCards[newFlipped[1].index].isMatched = true;
        setCards(newCards);
        setFlippedCards([]);
        speak('Correct Guess');
      } else {
        newCards[newFlipped[0].index].isMismatch = true;
        newCards[newFlipped[1].index].isMismatch = true;
        setCards([...newCards]);
        speak('Incorrect Guess');
        setTimeout(() => {
          newCards[newFlipped[0].index].isFlipped = false;
          newCards[newFlipped[0].index].isMismatch = false;
          newCards[newFlipped[1].index].isFlipped = false;
          newCards[newFlipped[1].index].isMismatch = false;
          setCards([...newCards]);
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (cards.every(card => card.isMatched)) {
      speak(levelCompletedMessage);
      Alert.alert(
        'Level Completed',
        levelCompletedMessage,
        [
          {
            text: 'Next Level',
            onPress: () => {
              if (level < 5) {
                setLevel(level + 1);
                setCards(generateCardsForLevel(level + 1));
                setFlippedCards([]);
                setGuessCount(0);
              } else {
                speak(gameCompletedMessage);
                Alert.alert(
                  'Game Completed',
                  gameCompletedMessage,
                  [
                    {
                      text: 'Restart Game',
                      onPress: () => {
                        setLevel(1);
                        setCards(generateCardsForLevel(1));
                        setFlippedCards([]);
                        setGuessCount(0);
                        instructionSpoken.current = {};
                      },
                    },
                  ]
                );
              }
            },
          },
        ]
      );
    }
  }, [cards, level]);

  const toggleMute = () => {
    if (!isMuted) {
      stopSpeech();
    }
    setIsMuted(prev => !prev);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            stopSpeech();
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#005BBB" />
        </TouchableOpacity>
        <Text style={[styles.levelText, { fontSize: fontSize }]}>Level {level}</Text>
        <Text style={[styles.guessText, { fontSize: fontSize - 2 }]}>
          Guesses Left: {allowedGuessesForLevel(level) - guessCount}
        </Text>
        <TouchableOpacity onPress={toggleMute} style={styles.speakerButton}>
          <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={24} color="#005BBB" />
        </TouchableOpacity>
      </View>
      <Text style={[styles.gameTitle, { fontSize: fontSize + 4 }]}>Matching Pairs</Text>
      <Text style={[styles.description, { fontSize: fontSize - 2 }]}>{gameDescription}</Text>
      <View style={styles.grid}>
        {cards.map((card, index) => (
          <TouchableOpacity 
            key={card.id} 
            style={[
              styles.card, 
              card.isMatched && styles.matchedCard,
              card.isMismatch && styles.mismatchCard
            ]}
            onPress={() => handleCardPress(index)}
          >
            {card.isFlipped || card.isMatched ? (
              card.type === "image" || card.type === "localImage" ? (
                <Image 
                  source={card.type === 'localImage' ? card.value : { uri: card.value }} 
                  style={styles.cardImage} 
                  resizeMode="contain" 
                />
              ) : (
                <Text style={styles.cardText}>{card.value}</Text>
              )
            ) : (
              <View style={styles.cardBack} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#F0F4F8' 
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  levelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  guessText: {
    fontSize: 16,
    color: '#005BBB',
  },
  speakerButton: {
    padding: 8,
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#005BBB',
    textAlign: 'center',
    marginBottom: 5,
  },
  description: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center' 
  },
  card: {
    width: 70,
    height: 70,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 2,
  },
  cardBack: {
    width: 70,
    height: 70,
    backgroundColor: '#005BBB',
    borderRadius: 8,
  },
  cardText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#005BBB',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  matchedCard: {
    backgroundColor: 'lightgreen',
  },
  mismatchCard: {
    backgroundColor: 'red',
  },
});

export default MatchingPairsMultiLevelGame;
