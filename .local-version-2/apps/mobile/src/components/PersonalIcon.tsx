import { Image, type ImageSourcePropType } from "react-native";

export type PersonalIconName = "home" | "learn" | "voice" | "tutor" | "stats" | "account" | "arrow" | "chevron";

const icons: Record<PersonalIconName, ImageSourcePropType> = {
  home: require("../../assets/icons/home.png"),
  learn: require("../../assets/icons/learn.png"),
  voice: require("../../assets/icons/voice.png"),
  tutor: require("../../assets/icons/tutor.png"),
  stats: require("../../assets/icons/stats.png"),
  account: require("../../assets/icons/account.png"),
  arrow: require("../../assets/icons/arrow.png"),
  chevron: require("../../assets/icons/chevron.png"),
};

/** Bundled line icons share the same shape on web and native. */
export function PersonalIcon({ name, color = "#173E3B", size = 22 }: { name: PersonalIconName; color?: string; size?: number }) {
  return <Image accessible={false} source={icons[name]} resizeMode="contain" style={{ width: size, height: size, tintColor: color }} />;
}
