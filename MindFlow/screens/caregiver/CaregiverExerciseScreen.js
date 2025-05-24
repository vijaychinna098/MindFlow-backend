import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useFontSize } from "./CaregiverFontSizeContext";

const exercises = [
  {
    id: 1,
    name: "Seated Marching",
    image: "https://images.pexels.com/photos/6649099/pexels-photo-6649099.jpeg",
    description: "Lift your knees while sitting to improve circulation and mobility.",
  },
  {
    id: 2,
    name: "Shoulder Rolls",
    image: "https://images.pexels.com/photos/7551593/pexels-photo-7551593.jpeg",
    description: "Roll your shoulders forward and backward to ease stiffness.",
  },
  {
    id: 3,
    name: "Hand & Finger Exercises",
    image: "https://images.pexels.com/photos/3758053/pexels-photo-3758053.jpeg",
    description: "Stretch and move your fingers to improve dexterity and coordination.",
  },
];

const CaregiverExerciseScreen = () => {
  const navigation = useNavigation();
  const { fontSize } = useFontSize();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#A7C7E7", padding: 16 }}>
      <Text style={{ fontSize: fontSize + 6, fontWeight: "bold", textAlign: "center", marginBottom: 20 }}>
        Alzheimer’s Exercises
      </Text>

      {exercises.map((exercise) => (
        <View key={exercise.id} style={{ backgroundColor: "#6FA3B7", padding: 12, borderRadius: 8, marginBottom: 15 }}>
          <Image source={{ uri: exercise.image }} style={{ width: "100%", height: 160, borderRadius: 8 }} />
          <Text style={{ marginTop: 8, fontSize: fontSize + 2, fontWeight: "bold", color: "#ffffff" }}>{exercise.name}</Text>
          <Text style={{ fontSize: fontSize, color: "#ffffff" }}>{exercise.description}</Text>
        </View>
      ))}

      {/* 🔹 Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ marginTop: 15,marginBottom:20, backgroundColor: "#FF4C4C", padding: 12, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontSize: fontSize }}>Go Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default CaregiverExerciseScreen;
