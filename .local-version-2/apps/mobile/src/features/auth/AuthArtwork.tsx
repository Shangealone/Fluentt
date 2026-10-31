import { Image, StyleSheet, View } from "react-native";
import type { Role } from "../../services/api/identity";

export const authRoles = [
  { value: "personal_student", label: "Personal learner", hint: "Learn at your own pace." },
  { value: "school_student", label: "Student", hint: "Join your class." },
  { value: "instructor", label: "Teacher", hint: "Guide your learners." },
] as const;

export function WelcomeDoorArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.art}>
    <View style={s.doorframe}><View style={s.door}><View style={s.handle} /></View></View><View style={s.floor} />
    <View style={s.plant}><View style={s.leaf} /><View style={[s.leaf, s.otherLeaf]} /></View>
    <View style={s.namecard}><View style={s.avatarHead} /><View style={s.avatarBody} /><View style={s.nameLine} /><View style={[s.nameLine, s.secondNameLine]} /></View>
  </View>;
}
export function AccountTypeArt({ role }: { role: Role }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.tile, role === "school_student" && s.studentTile, role === "instructor" && s.teacherTile]}>
    <Image accessible={false} resizeMode="contain" style={s.roleImage} source={role === "personal_student"
      ? require("../../../assets/illustrations/activity-learn.png")
      : role === "school_student" ? require("../../../assets/illustrations/account-student.png")
        : require("../../../assets/illustrations/account-teacher.png")} />
  </View>;
}
const s = StyleSheet.create({
  art: { width: 92, height: 100, borderRadius: 29, backgroundColor: "#E9F0DA" }, doorframe: { position: "absolute", left: 24, top: 15, width: 41, height: 65, borderWidth: 2, borderColor: "#5A8367", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: "#FDF7E8", overflow: "hidden" }, door: { position: "absolute", left: 0, top: 3, width: 26, height: 61, borderWidth: 1.5, borderColor: "#5A8367", borderTopLeftRadius: 15, borderTopRightRadius: 3, backgroundColor: "#C3D7AA", transform: [{ skewY: "-12deg" }] }, handle: { position: "absolute", right: 4, top: 32, width: 4, height: 4, borderRadius: 2, backgroundColor: "#E5A779", borderWidth: 1, borderColor: "#7E7152" }, floor: { position: "absolute", width: 68, height: 2, backgroundColor: "#789B71", left: 12, top: 79, borderRadius: 2 },
  namecard: { position: "absolute", right: 8, bottom: 12, width: 42, height: 29, borderWidth: 1.5, borderColor: "#7C8A64", borderRadius: 5, backgroundColor: "#F5D0AB", transform: [{ rotate: "9deg" }] }, avatarHead: { position: "absolute", left: 6, top: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FAF4DF", borderWidth: 1, borderColor: "#82936C" }, avatarBody: { position: "absolute", left: 5, top: 15, width: 11, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: "#FAF4DF", borderWidth: 1, borderColor: "#82936C" }, nameLine: { position: "absolute", left: 21, top: 9, width: 13, height: 2, backgroundColor: "#A88962" }, secondNameLine: { top: 15, backgroundColor: "#C3A77B" },
  plant: { position: "absolute", left: 13, top: 66, width: 10, height: 12, backgroundColor: "#E6B58B", borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }, leaf: { position: "absolute", width: 9, height: 13, borderWidth: 1, borderColor: "#72916B", backgroundColor: "#B5CFA3", top: -17, left: -4, borderTopLeftRadius: 8, borderBottomRightRadius: 8, transform: [{ rotate: "-30deg" }] }, otherLeaf: { left: 3, top: -14, transform: [{ rotate: "60deg" }] },
  tile: { width: 44, height: 46, borderRadius: 14, backgroundColor: "#E7F1CF", alignItems: "center", justifyContent: "center" }, studentTile: { backgroundColor: "#EDE8FB" }, teacherTile: { backgroundColor: "#E2F2F8" },
  roleImage: { width: 36, height: 36 },
});
