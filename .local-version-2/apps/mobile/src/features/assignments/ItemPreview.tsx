import { Text, View } from "react-native";
import { s } from "../../components/ui";
import type { AssignmentItem } from "../../services/api/assignments";
import { choiceItemFromRevision } from "../questions/choice";
import { UnscoredChoicePreview } from "../questions/ChoiceQuestion";
import { textItemFromRevision } from "../questions/text";
import { UnscoredTextPreview } from "../questions/TextQuestion";
import { multiItemFromRevision } from "../questions/multi";
import { UnscoredMultiPreview } from "../questions/MultiSelectionQuestion";
import { arrangementItemFromRevision } from "../questions/arrangement";
import { UnscoredArrangementPreview } from "../questions/ArrangementQuestion";
import { matchingItemFromRevision } from "../questions/matching";
import { UnscoredMatchingPreview } from "../questions/MatchingQuestion";

export function ItemPreview({ row }: { row: AssignmentItem }) {
  const method = row.definition.method;
  if (method === "multiple_choice" || method === "true_false") return <UnscoredChoicePreview item={choiceItemFromRevision(row)} />;
  if (method === "identification" || method === "fill_in_the_blank") return <UnscoredTextPreview item={textItemFromRevision(row)} />;
  if (method === "multiple_select" || method === "error_identification") return <UnscoredMultiPreview item={multiItemFromRevision(row)} />;
  if (method === "word_arrangement" || method === "sentence_arrangement") return <UnscoredArrangementPreview item={arrangementItemFromRevision(row)} />;
  if (method === "matching_type") return <UnscoredMatchingPreview item={matchingItemFromRevision(row)} />;
  return <View style={s.card}><Text style={s.heading}>{row.definition.prompt}</Text>
    {!!row.definition.instructions && <Text style={s.body}>{row.definition.instructions}</Text>}
    <Text style={s.body}>{String(row.definition.content.cue ?? "")}</Text>
    <Text style={s.body}>Flashcard front only. Instructor assignment selection does not permit private back reveal.</Text></View>;
}
