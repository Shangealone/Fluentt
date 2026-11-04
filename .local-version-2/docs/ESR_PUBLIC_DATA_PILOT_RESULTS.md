# ESR public-data CPU pilot results

Date: 2026-11-04, Asia/Manila.

The user authorized starting a small real-data CPU experiment on F:. A bounded English-only FIFAKT-derived pilot completed using the isolated existing Torch CPU environment. **This does not enable the ESR study or produce a study-ready FIFAKT model.** See [pilot instructions and adaptations](../services/api/training/esr/PUBLIC_PILOT.md).

## Verified dataset

The author-linked Duolingo archive downloaded to the ignored F: training directory. Size: 379,004,009 bytes; publisher MD5 verified. SHA-256: `26cf9b33f2e9b2e8aa9a8f262a017b30699ca2f625c56a12ce699d4ea7076873`. Current publisher metadata and CC BY-NC 4.0 attribution were retained locally. Download plus verification took about 154 seconds.

The pilot scanned 500,000 source rows, including 216,945 English rows, retaining at most 1,500 English learners and 64 events each. Eligible learner counts were 760 training, 93 validation and 94 reserved test. These produced 5,828 training, 705 validation and 718 reserved test examples. Only 512 validation examples were evaluated; test examples remain unevaluated. This bounded prefix is not representative-corpus sampling.

## Actual measurements

| Measurement | Final recorded run |
|---|---:|
| Device | CPU, two threads |
| Optimization steps | 100 |
| Batch / maximum earlier encounters | 16 / 16 |
| Training plus periodic validation | 5.516 seconds |
| Total worker time, including imports, integrity check and preprocessing | 19.083 seconds |
| Peak process working set | 287,526,912 bytes, approximately 274.2 MiB |
| Initial validation MAE to recall proportion | 0.481418 |
| Best validation MAE to recall proportion | 0.156177 |
| Constant training-mean baseline validation MAE | 0.158042 |
| Best validation MSE to recall proportion | 0.064662 |

The earlier cold run took 61.923 seconds in total and 7.988 seconds for training/validation. Cache and machine load affect timing. Neither run estimates full-corpus training time or proves that the GT 1030 is suitable; the GPU was not used.

The small MAE difference from the constant baseline is not evidence of useful deployment performance, paper reproduction or improved retention. No accuracy percentage is inferred from these errors. The observed labels are session recall proportions; no multiple-choice/typed-recall labels were invented.

## Checks and remaining work

Five focused engineering tests passed. The real-data run completed finite, nonzero gradient updates, checked batch-order independence, and verified identical predictions after a weights-only checkpoint round trip. Static Ruff checks passed. A separate read-only source review found no blocking issue in learner splitting, causal histories, normalization, padding or test isolation.

The checkpoint is under `private-data/esr-training/public-pilot/`, excluded from Git. It uses reduced dimensions and learned random embeddings, without pretrained semantic vectors, format-aware training, Tagalog validation or future-recall calibration. The API environment, database, production inference adapter and study activation guards remain unchanged.

Next: retain this result as a hardware/engineering benchmark; establish a larger documented development sample and full architecture/embedding comparison before scaling training. Obtain permitted real-format development encounters and complete validation/calibration and participant workflows before formal-study activation. No commit or push was performed for this pilot.
