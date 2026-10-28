# Zero-service-budget demo plan — October 27, 2026

The user explicitly requires all service plans to be free. This supersedes the earlier proposal to consider paid hosting or Azure resources. Do not create paid resources, attach a paid plan, enable automatic upgrades, buy credits or silently fall back to a billable provider. Free-plan quotas and availability still apply; this is not unlimited or permanently guaranteed hosting.

## Verified candidates

| Component | Proposed plan | Verified conditions / limits |
| --- | --- | --- |
| HTTPS backend | [Render Free](https://render.com/docs/free) | Free web service; sleeps after 15 idle minutes and can take about a minute to wake. Included usage limits apply. Keep existing template `plan: free` and automatic deployment off |
| PostgreSQL | [Neon Free](https://neon.com/pricing) | Vendor advertises $0, no time limit and no credit card, currently 1 GB storage and 100 CU-hours per project monthly. Use a separate mock-defense project. This avoids the 30-day expiry of Render's free PostgreSQL |
| Genuine conversation | [Groq Free](https://console.groq.com/docs/rate-limits) | Free-plan model/request/token limits; exceeding limits yields 429. Do not upgrade to Developer. [Billing documentation](https://console.groq.com/docs/billing-faqs) distinguishes the paid upgrade. Verify available models/account limits before choosing the model |
| English acoustic feedback | [Lingolix Free](https://lingolix.com/en/pricing) | €0, 15 audio minutes/month, non-commercial use only; vendor states free requests are blocked at quota. [Homepage](https://lingolix.com/en) says no credit card required. It lists English among 17 languages, not Tagalog |
| Learn / reference playback / local word highlighting | Existing app and installed device voices/recognizer | No paid API needed for packaged exercises and on-device functions. Device language/voice installation and hardware testing remain necessary |

Lingolix's [API documentation](https://lingolix.com/en/api-portal/docs) describes full-audio assessment with reference text and an overall score in 0–1, with diagnostic fields and model provenance. That is a provider claim/contract, not a live result or independently validated acoustic model. Do not turn recognized-word counts into this score, invent missing results, or claim clinical/academic validity. The existing Azure adapter remains disabled; Lingolix is only a researched candidate, not implemented or activated.

## Remaining required work

- User creates/selects free Render, Neon, Groq and eligible non-commercial Lingolix accounts. No accounts or payment details have been created/changed here. Continue at the Render login first; account creation is not deployment.
- Implement and verify real Groq conversation behind the existing authenticated backend and approved personal-only boundaries. Existing scripted/sample replies and audio transcripts must not be presented as live AI/ASR.
- Add a separately configured Lingolix backend adapter and accurate provider/model results, errors and quota handling. Use a provider-specific deliberate audio-upload permission; do not reuse an Azure permission for a different recipient. Keep keys server-only, recording transient and research/school behavior unchanged.
- Verify Neon migration/runtime permissions on a new disposable mock-defense database before deploying. Use the direct connection for bootstrap/migrations; never reset/stamp unknown data. The existing Render start adapter accepts a supplied PostgreSQL URL and preserves its TLS query.
- Verify free-plan account entitlements, official limits, actual response shapes and phone audio before rebuilding the APK against a real public HTTPS backend. Rehearse after waking sleeping services. Tagalog remains unscored unless a genuinely suitable evaluator is separately supplied and tested.

No code deployment, database creation/migration, API call, provider key, paid request or new APK build occurred during this free-plan search. The previous APK is unchanged. This document records researched options, not operational readiness.
