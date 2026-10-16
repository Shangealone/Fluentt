# AI and adaptive learning integration plan

No models, schedulers, training runs, datasets or validated performance exist in Section 00. These are backend-only interfaces. Screens consume versioned domain contracts and do not select vendors or experimental conditions.

## Common result envelope

Every model operation records request_id, task, language_track, schema_version, model_version_id, configuration_version, simulated, status, started_at, completed_at and task result or safe error. Store sanitized parameters, artifact/library versions and research context where applicable. Never record secrets. Simulated responses must be labeled in API data, UI, analytics and exports, and excluded from actual experiment analyses. Production research must reject simulated providers.

## Interfaces (conceptual, not code)

| Interface | Input | Output and constraints |
|---|---|---|
| Scheduler.schedule | immutable previous state, recall outcome, server event time, item/context, frozen config | next state, next due time, implementation/config version; deterministic replay where possible |
| ForgettingPredictor.predict | approved learning history/features, prediction time, language, model/config version | prediction, calibration/provenance and unavailable status; no automatic scheduling side effects |
| SpeechRecognizer.transcribe | private audio handle, language hint, reference context, model config | transcript, detected language, optional confidence/segments; confidence only if meaningful for provider |
| PronunciationEvaluator.evaluate | private audio, reference text/audio, explicit target language, config | supported metrics, feedback, validity scope, unavailable/unsupported status; independent of transcription |
| ConversationProvider.reply | allowed topic, language, minimal learner context, approved conversation history, config | assistant text, learning feedback, finish/error metadata and version |

Providers are selected by backend configuration and capability checks. Mock implementations return clearly simulated fixtures without downloads. Contract tests cover unsupported language, malformed output, timeouts, retry limits and version recording. AI outputs are untrusted data and never authorize users or database actions.

## Scheduling research

SM-2 is the planned control adapter. FSRS-6 is the proposed base adapter for ESR; specific library/version, parameters, license and compatibility must be evaluated before use. Implement independently testable adapters against review history and immutable states. Do not claim algorithm equivalence without fixtures and reproducibility evidence.

FIFAKT is a feasibility dependency: identify authoritative implementation/paper, licensing, required features, dataset permissions, language/age fit, training/reproduction needs, calibration and compatibility with FSRS-6. No trained model is assumed. ESR fusion must have a written rule for how a prediction changes scheduling, parameter bounds, missing-feature behavior and versioned evaluation protocol before experimental deployment. It is not approved merely by naming the components.

Lock condition, scheduler implementation/configuration and item set per protocol. Preserve previous/next state and event order. No silent fallback from ESR to SM-2 or from a real provider to mocks in research. Pause/mark failed activity if the locked provider is unavailable; an approved protocol amendment is required for substitutions.

## Speech and pronunciation

Investigate multilingual Whisper and alternatives for English and Tagalog at the later integration stage; actual availability, licenses, deployment cost and language quality require verification then. ASR transcript agreement is not a validated pronunciation score. An English pronunciation evaluator cannot score Tagalog by assumption. Provide unsupported/unavailable feedback until a target-language evaluation method is validated. Separate research pronunciation consent, instruments and analyses from vocabulary outcomes.

Upload lifecycle: validate → private storage → processing job if needed → ASR and independent pronunciation evaluation → authorized result → policy-driven deletion. Expose retry without duplicate attempts/cost. Define maximum sizes/duration, retention, job concurrency and provider timeouts before implementation. Reference audio requires usage rights and provenance.

## Conversation

Use a replaceable hosted API or self-hosted multilingual model such as Qwen; no provider selected. Evaluate English/Tagalog quality, hosting resources, privacy terms, age suitability, topic fidelity and cost before adoption. Keep prompts versioned. Pass only needed learning context, avoid identity/consent data and apply approved content boundaries. Do not use LLM feedback as the authoritative grader of objective items. Stored messages and external transfer require approved retention/data handling.

## Evaluation gates

1. Obtain authoritative artifacts and licensing at implementation time; document exact versions.
2. Use synthetic adapter fixtures for engineering, clearly separated from research evidence.
3. Evaluate task/language validity with approved data and rubrics; record limitations and missing results.
4. Freeze protocol, content, model/config and scheduler versions before participant activity.
5. Reproduce exports and scheduler trajectories from retained versioned events without identity mapping.

Unresolved: approved datasets, FIFAKT reproduction/training, ESR fusion, Tagalog pronunciation validity, provider selection, resource budgets and ethics/data retention. These are dependencies, not completed research.
