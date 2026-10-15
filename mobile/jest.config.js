const jestExpoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...jestExpoPreset,
  testTimeout: 20000,
  maxWorkers: 3,
  transform: {
    // Metro enables React Compiler, while jest-expo's default caller does not.
    // Exercise the timing hook with the Android build's compiler semantics.
    '[/\\\\]useReviewTiming\\.ts$': [
      'babel-jest',
      {
        ...jestExpoPreset.transform['\\.[jt]sx?$'][1],
        caller: {
          ...jestExpoPreset.transform['\\.[jt]sx?$'][1].caller,
          platform: 'android',
          engine: 'hermes',
          isDev: true,
          supportsReactCompiler: true,
        },
      },
    ],
    ...jestExpoPreset.transform,
  },
  transformIgnorePatterns: [
    'node_modules[\\\\/](?!((\\.pnpm)|((jest-)?react-native)|(@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
