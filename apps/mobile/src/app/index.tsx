import { router } from "expo-router";
import { Text, View } from "react-native";
import { Screen, Button, s } from "../components/ui";
export default function Welcome() {
  return (
    <Screen>
      <Text style={s.brand}>FLUENTT ●</Text>
      <Text style={s.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</Text>
      <Text style={s.title}>Small steps. A world of words.</Text>
      <Text style={s.body}>
        Learn English and Tagalog with personalized lessons, vocabulary
        practice, and pronunciation activities.
      </Text>
      <View style={s.card}>
        <Text style={s.heading}>Personal Learning</Text>
        <Text style={s.body}>
          Learn at your pace. For independent learners, with no classroom code
          needed.
        </Text>
        <Button
          label="Start personal learning →"
          onPress={() =>
            router.push({
              pathname: "/username",
              params: { role: "personal_student" },
            })
          }
        />
      </View>
      <View style={s.card}>
        <Text style={s.heading}>School Learning</Text>
        <Text style={s.body}>
          A shared learning journey for students and instructors.
        </Text>
        <Button
          label="Continue with school →"
          onPress={() => router.push("/school-role")}
        />
      </View>
      <Text style={s.body}>One unique username. Your own learning space.</Text>
    </Screen>
  );
}
