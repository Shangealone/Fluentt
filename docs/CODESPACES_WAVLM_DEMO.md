# Temporary English WavLM Codespaces demo

Status: **PREPARED, NOT DEPLOYED OR MODEL-TESTED**. This is a synthetic-account, time-limited demonstration plan. It does not alter the existing Render service or Supabase project. Tagalog MMS and Tagalog pronunciation scoring stay disabled. Existing model predictions remain unvalidated for Filipino-accented English and are not academic grades.

## Scope and prerequisites

- Use the saved standalone redesigned-app branch in the owner's personal GitHub repository, on a **4-core / 16 GB** Linux Codespace. Inspect the offered machine before creation; do not select an 8 GB machine and lower the WavLM 5 GiB **available** RAM gate.
- The repository's `.devcontainer/devcontainer.json` asks for Python 3.12, Node 24 and the 4-core machine. `scripts/setup-codespace-wavlm.sh` installs the pinned API requirements and the isolated WavLM dependencies. PyTorch/TorchAudio 2.11 CPU wheels come from PyTorch's official CPU index, not a CUDA index. Pinned model revisions are unchanged.
- Use only the separate `fluentt_synthetic_staging` PostgreSQL database. Place its connection URL in a Codespaces secret named `FLUENTT_DATABASE_URL`; never put it in Git, a terminal command, Expo variables, logs or chat. This transfers a database credential to GitHub and requires the owner's explicit approval at that step. The start script accepts only the exact synthetic database name and expected migration revision through the existing initializer. It cannot connect to the owner's real Supabase database by name.
- The Codespace's port 8000 must be made **Public** only for the supervised demo. Anyone with its URL can reach the app while it is public; registration and the API must contain synthetic data only. The port may return to Private after restart. Stop or make the port Private when the demonstration ends.
- GitHub Codespaces has a limited personal-account free allowance and an idle timeout. It is not a persistent deployment. The database is Render Free and expires after 30 days. Do not use this setup for real students, retained research recordings or production classes.

## Operator sequence

1. Create the Codespace from the dedicated demo branch after the source preparation is reviewed. Confirm at least 5 GiB **available** physical RAM and 8 GiB free disk before downloading weights. Check the Codespace's monthly free quota.
2. Run `bash scripts/setup-codespace-wavlm.sh`. This installs packages and exports the browser app. No model is loaded and WavLM stays disabled.
3. Run `bash scripts/prepare-codespace-wavlm.sh`. It downloads only the reviewed pinned scorer, backbone metadata, alignment model and language resources into ignored `private-data/wavlm-cache`, then verifies the manifest and every file SHA-256. Do not commit or redistribute this cache.
4. Start the API with `bash scripts/start-codespace-wavlm.sh` while `FLUENTT_PRONUNCIATION_WAVLM_ENABLED` is unset. Verify its health, browser registration/login and a synthetic student session at the forwarded HTTPS URL. No simulated score is allowed.
5. With a speaker's consent and the **exact spoken English sentence**, run the copied `services/api/ml/wavlm/benchmark.py` using the isolated model Python, ignored cache and private temporary audio. Save only non-sensitive timing/memory results. A complete overall, word and phoneme result must come from the real model. If the 5 GiB gate or alignment fails, leave scoring disabled.
6. Only after that benchmark passes, restart with `FLUENTT_PRONUNCIATION_WAVLM_ENABLED=true`, verify capabilities show `ready`, and submit an authenticated synthetic account's full-phrase recording. Confirm `simulated=false`, pinned model version, feedback and history, plus temporary-file cleanup. Do not represent this as model validation.
7. For an Android APK, set `EXPO_PUBLIC_ANDROID_API_URL` at build time to the **exact forwarded HTTPS URL** and use an internal APK build. The native app has not yet been built or tested. The link is Codespace-specific; stopping the Codespace or making the port Private makes the app unavailable. Do not put secrets in `EXPO_PUBLIC_*` values.

## Current evidence and blockers

- The redesigned backend already routes English recordings to WavLM and refuses simulated scoring (`VOICE_REAL_MODEL_INTEGRATION.md`). Its 5 GiB available-memory preflight is unchanged. Root `C:/Users/shang/Desktop/Fluent/services/api/ml/wavlm/prepare.py`, `benchmark.py` and `requirements.in` were reviewed and copied unchanged into this standalone app to make the Codespace self-contained.
- The upstream scorer is pinned to `19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da`; backbone `c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c`; alignment `2c733782da5604684829819a5eb744c193fe9398`. The scorer metadata declares MIT but its upstream copyright/notice file is absent at that revision; preserve `services/api/ml/wavlm/NOTICE.md`. Backend-hosted weights are not copied into the APK. Deployment-specific rights review remains partial.
- No Codespace, package installation, model download, benchmark, microphone recording, Android build or live score is claimed by this preparation. The existing Render staging service remains a separate 512 MB service with WavLM off.

References: [GitHub free Codespaces allowance](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces), [Codespaces port access](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace), [PyTorch 2.11 CPU installation](https://pytorch.org/get-started/previous-versions/).
