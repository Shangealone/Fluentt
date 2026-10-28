# Phone-only mock-defense setup — October 27, 2026

Hosting/account follow-up: the user requests help creating the required accounts. See MOCK_DEFENSE_HOSTING.md for the prepared Render template, tested startup adapter and explicit remaining live-provider/deployment work. Nothing has been deployed or billed.

The user confirms that the phone can have internet and requests functional Learn, pronunciation and AI conversation without connecting to a laptop. The intended arrangement is an Android app plus an independently hosted HTTPS backend. Internet availability alone does not configure a backend or a model provider.

## Verified current boundaries

| Feature | Available now | Remaining work for a live phone demo |
| --- | --- | --- |
| Learn | Packaged starter listening/choice and sentence-card exercises in personal preview; reference speech uses the device voice | Verify device English/Tagalog voices and real touch/audio interaction; live accounts/history need the backend |
| Pronunciation practice | Real on-device recognition adapter, progressive word highlights and final-phrase completion; no score inferred from recognition | Install a supported speech language and test the actual phone |
| Pronunciation score | Default-off Azure whole-recording English integration | Host/configure the authenticated backend and Azure resource/key; exercise the real audio/permission/provider path. Tagalog remains unscored |
| Conversation | Existing scenario UI and explicitly simulated local replies | Configure and implement a genuine hosted AI provider through the backend; existing registry only calls the deterministic engine. Do not describe its scripted replies or sample audio transcripts/scores as real AI/ASR |
| Independent server access | Existing authenticated FastAPI/PostgreSQL contracts | Hosting account, HTTPS API URL, separate database/runtime permissions and required service secrets. Do not embed provider keys in the APK or bypass sessions |

No hosting URL, hosted AI provider or Azure credentials were supplied in this request. Hosting/service account clarification is pending. No deployment, paid-service request, model call, production data mutation or research activation has been performed.

## Independent pronunciation improvement

The Android personal Voice screen can now offer the existing **Set up offline speech** action after a recognition error. The driver queries the installed/supported locales, requests Android's supported offline-model download only on deliberate setup, and verifies installation before reporting ready. Queued downloads and Android dialogs stay explicit; unavailable Tagalog support does not fall back to another language. Setup never starts recording or sends audio to a cloud service. The previous iOS instruction and browser setup remain.

Changed files: `apps/mobile/src/features/pronunciation/liveSpeech.ts`, `apps/mobile/src/features/pronunciation/LivePronunciationPractice.tsx`, `scripts/live-pronunciation.test.cjs`, this document and the decision log. These changes are source-only until a new APK is built; the previously delivered APK does not include them.

Verification: `node --test scripts/live-pronunciation.test.cjs scripts/personal-history.test.cjs scripts/personal-practice.test.cjs` — 40 passed, zero failed/skipped, using synthetic/mocked inputs. `npm run typecheck` passed. `npm run lint -- --ignore-pattern 'android/**' --ignore-pattern 'ios/**'` finished with zero errors and 29 existing warnings. No device download, real microphone, hosted model or Azure evaluation has been tested by these checks.

## Next configuration inputs

Obtain a hosting account or existing public HTTPS backend URL, an actual conversation-provider account/model, and Azure Speech access if the demonstration must show an English acoustic score. Enter secrets into server secret management, never chat messages or public mobile environment variables. Keep ordinary classrooms and research outside this personal demo scope. Rebuild the APK with the verified HTTPS API address once the backend is ready, then test the three flows on the actual phone without USB/laptop connectivity. A connected phone is also needed to verify its speech service and language availability.
