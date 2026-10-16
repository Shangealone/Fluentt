import { Text } from "react-native";
import { Screen, EmptyState, s } from "../components/ui";
import { useSession } from "../session/provider";
export default function Dashboard() {
  const { profile } = useSession();
  return (
    <Screen>
      <Text style={s.brand}>FLUENTT</Text>
      <Text style={s.title}>Welcome, {profile?.username}.</Text>
      <EmptyState
        title="Your student space"
        description="Your profile setup is saved. Lessons, activities and dashboard features will arrive in a later section."
      />
      {profile?.grade && (
        <Text style={s.body}>
          Grade {profile.grade} · {profile.language}
        </Text>
      )}
    </Screen>
  );
}
