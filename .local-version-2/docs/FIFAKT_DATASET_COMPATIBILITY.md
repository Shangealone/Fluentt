# FIFAKT dataset compatibility
2026-11-05. Compatible production training dataset: BLOCKED.

| Resource | Verified evidence | Decision |
|---|---|---|
| Local Duolingo 2016 | actual gzip/schema/hash verified; learner, lexeme, timestamp, delta, prior counts and session recall proportions; CC BY-NC 4.0 publisher terms saved | Usable for bounded noncommercial public-data development; lacks app formats/arbitrary-horizon outcome contract |
| Duolingo SLAM 2018 | official documentation describes token errors, learner-relative days and three exercise formats | CONDITIONAL transfer investigation, not a direct FLUENTT dataset; release license/files not verified or downloaded here |
| Tagetomo | author repository explicitly states private Obunsha data | BLOCKED access/permission |
| FLUENTT development cohort | no approved compatible training export supplied | BLOCKED; future approved development collection only |

Sources: [2016 publisher](https://doi.org/10.7910/DVN/N8XJME), [HLR authors](https://github.com/duolingo/halflife-regression), [FIFAKT authors](https://github.com/BoxuanMa/FIFAKT), [official SLAM task](https://sharedtask.duolingo.com/2018.html). SLAM formats are reverse_translate, reverse_tap and listen; its labels are token mistakes, not vocabulary recall at a requested future horizon. Do not equate those formats with the app's multiple-choice/typed-recall contract. Its documented missing/negative response durations require a declared missingness policy. No alternative dataset license clearance is claimed.

Required feature contract: coded learner/study/pool/configuration scope; stable vocabulary/version and semantic mapping; actual observed and next formats; objective response labels separate from recall ratings; timezone-aware presentation/finalization; strictly earlier finalized history; elapsed gaps in days; explicit requested prediction horizon; independently observed future outcome. Preserve missing outcomes as missing, never manufacture positives/negatives. Invalid identity/time/format/mapping must reject or fall back, not guess. Fit all encoders/calibration on training/development partitions only.

See training/esr/FLUENTT_DATA_REQUIREMENTS.md for later approved data collection. Development participants must remain distinct from formal study outcomes; consent/guardian/site/retention approval precedes collection. No production export or participant recruitment occurred. No sufficiently compatible dataset was established; additional training and production adaptation are BLOCKED, not silently substituted with another public benchmark.
