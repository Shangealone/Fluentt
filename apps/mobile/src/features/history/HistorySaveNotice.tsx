import { View } from "react-native";
import { Button, ErrorMessage } from "../../components/ui";

export function HistorySaveNotice({ error, retry }: { error: string; retry: () => void }) {
  return error ? <View style={{ gap: 8 }}><ErrorMessage message={error} /><Button secondary label="Retry saving history" onPress={retry} /></View> : null;
}
