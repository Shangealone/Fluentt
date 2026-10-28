import { useState } from "react";
import { Text, View } from "react-native";
import { Button, ErrorMessage, Input, s } from "../../components/ui";
import { assignmentMethods, type AssignmentItem } from "../../services/api/assignments";
import type { DemoQuestionInput } from "../../demo/demoData";
import { questionTypes } from "./questionTypes";

type Method = DemoQuestionInput["method"];
type Pair = { left: string; right: string };
const gapCount = (prompt: string) => (prompt.match(/___/g) ?? []).length;

export function DemoQuestionComposer({ create, onCreated }: {
  create: (input: DemoQuestionInput) => AssignmentItem;
  onCreated: (item: AssignmentItem) => void;
}) {
  const [method, setMethod] = useState<Method>("multiple_choice");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState<number | null>(null);
  const [correctOptions, setCorrectOptions] = useState<number[]>([]);
  const [correctBoolean, setCorrectBoolean] = useState<boolean | null>(null);
  const [expectedText, setExpectedText] = useState("");
  const [blankAnswers, setBlankAnswers] = useState(["", "", "", "", "", ""]);
  const [tokens, setTokens] = useState(["", "", ""]);
  const [errorTokens, setErrorTokens] = useState<number[]>([]);
  const [units, setUnits] = useState(["", "", ""]);
  const [pairs, setPairs] = useState<Pair[]>([{ left: "", right: "" }, { left: "", right: "" }]);
  const [cue, setCue] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function submit() {
    setError(""); setNotice("");
    try {
      const item = create({ method, prompt, options,
        correct_option: correctOption ?? undefined, correct_options: correctOptions,
        correct_boolean: correctBoolean ?? undefined, expected_text: expectedText,
        blank_answers: blankAnswers.slice(0, gapCount(prompt)), tokens, error_tokens: errorTokens,
        ordered_units: units, pairs, cue, back });
      onCreated(item);
      setPrompt(""); setOptions(["", "", "", ""]); setCorrectOption(null); setCorrectOptions([]);
      setCorrectBoolean(null); setExpectedText(""); setBlankAnswers(["", "", "", "", "", ""]);
      setTokens(["", "", ""]); setErrorTokens([]); setUnits(["", "", ""]);
      setPairs([{ left: "", right: "" }, { left: "", right: "" }]); setCue(""); setBack("");
      setNotice("Question created and added to this draft. Save the draft when ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the question.");
    }
  }

  const choiceMethod = method === "multiple_choice" || method === "multiple_select";
  const arrangement = method === "word_arrangement" || method === "sentence_arrangement";
  return <View style={[s.card, { gap: 12 }]}>
    <Text accessibilityRole="header" style={s.heading}>Create your own question</Text>
    <Text style={s.body}>Choose any of the ten question types. New questions belong to this demo class lesson and are added to the draft. Student attempts are unscored.</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {assignmentMethods.map(choice => <Button key={choice} label={questionTypes[choice].label}
        secondary={method !== choice} onPress={() => { setMethod(choice); setError(""); setNotice(""); }} />)}
    </View>
    <Text style={s.heading}>Question prompt</Text>
    <Input accessibilityLabel="New question prompt" value={prompt} maxLength={2000} multiline
      onChangeText={setPrompt} placeholder={method === "fill_in_the_blank" ? "Write a sentence with ___ for each gap" : "Write the question students will see"} />
    {choiceMethod && <>
      <Text style={s.heading}>Choices</Text>
      {options.map((value, index) => <View key={index} style={{ gap: 6 }}>
        <Input accessibilityLabel={`Choice ${index + 1}`} value={value} maxLength={500}
          onChangeText={text => setOptions(previous => previous.map((current, position) => position === index ? text : current))}
          placeholder={`Choice ${index + 1}`} />
        {method === "multiple_choice" ? <Button label={`${correctOption === index ? "✓ " : ""}Mark choice ${index + 1} correct`}
          secondary={correctOption !== index} onPress={() => setCorrectOption(index)} />
          : <Button label={`${correctOptions.includes(index) ? "✓ " : ""}Choice ${index + 1} is correct`}
            secondary={!correctOptions.includes(index)} onPress={() => setCorrectOptions(previous => previous.includes(index)
              ? previous.filter(value => value !== index) : [...previous, index])} />}
      </View>)}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label="Add choice" secondary disabled={options.length >= 8} onPress={() => setOptions(previous => [...previous, ""])} />
        <Button label="Remove last choice" secondary disabled={options.length <= 2} onPress={() => {
          setOptions(previous => previous.slice(0, -1));
          setCorrectOption(previous => previous === options.length - 1 ? null : previous);
          setCorrectOptions(previous => previous.filter(index => index < options.length - 1));
        }} />
      </View>
    </>}
    {method === "true_false" && <>
      <Text style={s.heading}>Correct answer</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button label={`${correctBoolean === true ? "✓ " : ""}True`} secondary={correctBoolean !== true} onPress={() => setCorrectBoolean(true)} />
        <Button label={`${correctBoolean === false ? "✓ " : ""}False`} secondary={correctBoolean !== false} onPress={() => setCorrectBoolean(false)} />
      </View>
    </>}
    {method === "identification" && <>
      <Text style={s.heading}>Expected answer</Text>
      <Input accessibilityLabel="Expected identification answer" value={expectedText} maxLength={500}
        onChangeText={setExpectedText} placeholder="Answer kept out of student question cards" />
    </>}
    {method === "fill_in_the_blank" && <>
      <Text style={s.body}>Type ___ where each missing word belongs. Add one expected answer for each gap (up to six).</Text>
      {Array.from({ length: Math.min(gapCount(prompt), 6) }, (_, index) => <Input key={index}
        accessibilityLabel={`Answer for gap ${index + 1}`} value={blankAnswers[index]} maxLength={500}
        onChangeText={text => setBlankAnswers(previous => previous.map((current, position) => position === index ? text : current))}
        placeholder={`Expected answer for gap ${index + 1}`} />)}
    </>}
    {method === "error_identification" && <>
      <Text style={s.body}>Enter the sentence in parts, then mark every part that contains an error.</Text>
      {tokens.map((value, index) => <View key={index} style={{ gap: 6 }}>
        <Input accessibilityLabel={`Sentence part ${index + 1}`} value={value} maxLength={500}
          onChangeText={text => setTokens(previous => previous.map((current, position) => position === index ? text : current))}
          placeholder={`Word or phrase ${index + 1}`} />
        <Button label={`${errorTokens.includes(index) ? "✓ " : ""}Part ${index + 1} contains an error`}
          secondary={!errorTokens.includes(index)} onPress={() => setErrorTokens(previous => previous.includes(index)
            ? previous.filter(value => value !== index) : [...previous, index])} />
      </View>)}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label="Add sentence part" secondary disabled={tokens.length >= 8} onPress={() => setTokens(previous => [...previous, ""])} />
        <Button label="Remove last part" secondary disabled={tokens.length <= 1} onPress={() => {
          setTokens(previous => previous.slice(0, -1)); setErrorTokens(previous => previous.filter(index => index < tokens.length - 1));
        }} />
      </View>
    </>}
    {arrangement && <>
      <Text style={s.body}>Enter {method === "word_arrangement" ? "words" : "sentences"} in the correct order. Students see the cards in a different order.</Text>
      {units.map((value, index) => <Input key={index} accessibilityLabel={`Correct sequence item ${index + 1}`}
        value={value} maxLength={500} multiline={method === "sentence_arrangement"}
        onChangeText={text => setUnits(previous => previous.map((current, position) => position === index ? text : current))}
        placeholder={`Correct item ${index + 1}`} />)}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label="Add sequence item" secondary disabled={units.length >= 8} onPress={() => setUnits(previous => [...previous, ""])} />
        <Button label="Remove last item" secondary disabled={units.length <= 2} onPress={() => setUnits(previous => previous.slice(0, -1))} />
      </View>
    </>}
    {method === "matching_type" && <>
      <Text style={s.body}>Enter each correct left and right pair. Students see the right side in a different order.</Text>
      {pairs.map((pair, index) => <View key={index} style={{ gap: 6 }}>
        <Text style={s.heading}>Pair {index + 1}</Text>
        <Input accessibilityLabel={`Pair ${index + 1} left`} value={pair.left} maxLength={500}
          onChangeText={text => setPairs(previous => previous.map((current, position) => position === index ? { ...current, left: text } : current))}
          placeholder="Left item" />
        <Input accessibilityLabel={`Pair ${index + 1} right`} value={pair.right} maxLength={500}
          onChangeText={text => setPairs(previous => previous.map((current, position) => position === index ? { ...current, right: text } : current))}
          placeholder="Matching right item" />
      </View>)}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label="Add matching pair" secondary disabled={pairs.length >= 8} onPress={() => setPairs(previous => [...previous, { left: "", right: "" }])} />
        <Button label="Remove last pair" secondary disabled={pairs.length <= 2} onPress={() => setPairs(previous => previous.slice(0, -1))} />
      </View>
    </>}
    {method === "flashcards" && <>
      <Text style={s.heading}>Front cue</Text>
      <Input accessibilityLabel="Flashcard front cue" value={cue} maxLength={500} onChangeText={setCue} placeholder="Word or idea to recall" />
      <Text style={s.heading}>Back to reveal</Text>
      <Input accessibilityLabel="Flashcard private back" value={back} maxLength={2000} multiline onChangeText={setBack}
        placeholder="Meaning or explanation shown only after Reveal" />
    </>}
    {!!error && <ErrorMessage message={error} />}
    {!!notice && <Text accessibilityRole="alert" style={s.body}>{notice}</Text>}
    <Button label="Create and select question" onPress={submit} />
  </View>;
}
