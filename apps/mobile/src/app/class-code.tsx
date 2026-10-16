import { useState } from "react";
import { Text } from "react-native";
import { Screen, Input, Button, ErrorMessage, s } from "../components/ui";
import { validClassCode } from "../session/routing";
export default function ClassCode() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <Screen>
      <Text style={s.brand}>FLUENTT</Text>
      <Text style={s.eyebrow}>SCHOOL STUDENT · NEXT STEP</Text>
      <Text style={s.title}>Your class is a code away.</Text>
      <Text style={s.body}>
        Enter the six-digit code provided by your instructor.
      </Text>
      <Input
        accessibilityLabel="Six-digit class code"
        keyboardType="number-pad"
        value={code}
        maxLength={6}
        onChangeText={(value) => {
          setCode(value);
          setError("");
        }}
        placeholder="000000"
      />
      <Text style={s.body}>
        Class joining will be available in Section 06. Your profile is saved;
        you have not joined a class yet.
      </Text>
      {error && <ErrorMessage message={error} />}
      <Button
        label="Check class code"
        onPress={() =>
          setError(
            validClassCode(code)
              ? "Class verification is not available yet. No enrollment has been made."
              : "Enter exactly six digits (0–9).",
          )
        }
      />
    </Screen>
  );
}
