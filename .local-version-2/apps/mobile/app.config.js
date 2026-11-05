// The online demo is a distinct install so existing app data can be retained.
module.exports = ({ config }) => {
  if (process.env.FLUENTT_BUILD_VARIANT !== "online-demo") return config;
  const origin = "https://fluentt-team-demo.onrender.com";
  if (process.env.EXPO_PUBLIC_ANDROID_API_URL !== origin) {
    throw new Error("The online APK must use the verified HTTPS team-demo backend.");
  }
  return {
    ...config,
    name: "FLUENTT Online",
    version: "1.0.8",
    scheme: "fluentt-online",
    android: {
      ...config.android,
      package: "com.shangealone.fluentt.classlearning",
      versionCode: 8,
    },
    extra: { ...config.extra, buildChannel: "online-demo" },
  };
};
