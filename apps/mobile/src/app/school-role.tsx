import { router } from "expo-router";
import { Text, View } from "react-native";
import { Screen, Button, s } from "../components/ui";
export default function SchoolRole() {
  return (
    <Screen>
      <Button secondary label="← Welcome" onPress={() => router.replace("/")} />
      <Text style={s.eyebrow}>SCHOOL LEARNING</Text>
      <Text style={s.title}>How will you learn together?</Text>
      <View style={s.card}>
        <Text style={s.heading}>I’m a student</Text>
        <Text style={s.body}>
          Join a class using the six-digit code from your instructor.
        </Text>
        <Button
          label="Continue as student"
          onPress={() =>
            router.push({
              pathname: "/username",
              params: { role: "school_student" },
            })
          }
        />
      </View>
      <View style={s.card}>
        <Text style={s.heading}>I’m an instructor</Text>
        <Text style={s.body}>Create and manage classes for your learners.</Text>
        <Button
          label="Continue as instructor"
          onPress={() =>
            router.push({
              pathname: "/username",
              params: { role: "instructor" },
            })
          }
        />
      </View>
    </Screen>
  );
}
