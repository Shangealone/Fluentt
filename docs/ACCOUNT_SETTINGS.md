# Account and settings — 2026-10-30

The shared `/account` page uses the approved Fluentt settings design. Its local panels cover account details, accessibility, personal learning preferences, a role-specific quick guide, About, and sign-out confirmation. Username and role are read-only. Account refresh, learning preference writes, notification navigation, and logout reuse the existing session and API operations.

## Reading preferences

`src/accessibility/provider.tsx` stores a versioned `fluentt.accessibility.v1` record in browser localStorage or native Expo SecureStore. This record contains only display preferences, never authentication credentials. It is device-wide, survives sign-out, and does not synchronize through the database. The default follows the device. Manual overrides provide Standard, Larger (1.15), or Extra large (1.32) text, higher text contrast, and reduced motion. Changes apply after storage confirms a successful save. Failed saves retain the editor's choices and show an error.

Shared text/input primitives apply the saved overrides throughout the app. Native font scaling remains authoritative when device settings are selected. Explicit overrides disable native font multiplication to avoid applying the same enlargement twice; nested text keeps its inherited size. Existing layouts that respond to `useWindowDimensions().fontScale` also receive the chosen override. Higher contrast strengthens the app's muted text palette and input outlines. Reduced motion disables app navigation animations and web transitions/animations. Device contrast and reduced-motion preferences are observed where the platform exposes them.

## Learning preferences

Personal learners can save language, starting level, and requested topics/lessons through the existing preferences endpoint. Easy preserves the legacy `some_words` value when saving the same language; otherwise the existing difficulty mapping is reused. Server-side per-language experience history stays authoritative. Existing nonempty learning focus cannot be cleared to an invalid empty value. Class grades and languages are managed in their own class pages.

## Verification boundary

The user requested implementation without app testing. No app execution, automated tests, typecheck, lint, or APK build was performed for this update. Web/native layout, storage failure handling, text scaling, high contrast, navigation motion, and device accessibility behavior require the user's hands-on review.
