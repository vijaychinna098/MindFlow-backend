import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useFontSize } from "./FontSizeContext";

// Create a replacement for useLanguage that just returns English strings
const useSafeLanguage = () => {
  return {
    translate: (key) => key,
    language: 'en',
    refreshKey: 0,
    translateName: (name) => name
  };
};

const ExerciseScreen = () => {
  const navigation = useNavigation();
  const { translate } = useSafeLanguage();
  const { fontSize } = useFontSize();

  const exercises = [
    {
      id: 1,
      name: translate("seatedMarching"),
      image: "https://images.pexels.com/photos/6649099/pexels-photo-6649099.jpeg",
      description: translate("seatedMarchingDesc"),
    },
    {
      id: 2,
      name: translate("shoulderRolls"),
      image: "https://images.pexels.com/photos/7551593/pexels-photo-7551593.jpeg",
      description: translate("shoulderRollsDesc"),
    },
    {
      id: 3,
      name: translate("handFingerExercises"),
      image: "https://images.pexels.com/photos/3758053/pexels-photo-3758053.jpeg",
      description: translate("handFingerExercisesDesc"),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#A7C7E7", padding: 16 }}>
      <Text style={{ 
        fontSize: fontSize + 4, 
        fontWeight: "bold", 
        textAlign: "center", 
        marginBottom: 20 
      }}>
        {translate("alzheimersExercises")}
      </Text>

      {exercises.map((exercise) => (
        <View key={exercise.id} style={{ backgroundColor: "#6FA3B7", padding: 12, borderRadius: 8, marginBottom: 15 }}>
          <Image source={{ uri: exercise.image }} style={{ width: "100%", height: 160, borderRadius: 8 }} />
          <Text style={{ 
            marginTop: 8, 
            fontSize: fontSize, 
            fontWeight: "bold", 
            color: "#ffffff" 
          }}>
            {exercise.name}
          </Text>
          <Text style={{ 
            fontSize: fontSize - 2, 
            color: "#ffffff" 
          }}>
            {exercise.description}
          </Text>
        </View>
      ))}

      {/* 🔹 Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ 
          marginTop: 15,
          marginBottom: 20, 
          backgroundColor: "#FF4C4C", 
          padding: 12, 
          borderRadius: 8, 
          alignItems: "center" 
        }}
      >
        <Text style={{ color: "#fff", fontSize: fontSize }}>
          {translate("goBack")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ExerciseScreen;
