# Detection accuracy test

Measures AI-image detectors against a small hand-labeled set of real Flipkart
product photos, so we can decide the on-device approach **before** building it.

## Set

18 images from a Flipkart "navy blue casual shirt" search (`images/`), labeled
by eye in `labels.json`:

- **AI:** 01, 04, 07, 17
- **Real:** 02, 03, 05, 08, 09, 10, 11, 12, 13, 14, 15, 16, 18
- **Unsure (excluded):** 06

## Run

```bash
# 1. (re)scrape a fresh set — optional
node research/accuracy-test/scrape.cjs "navy blue casual shirt" 18

# 2. current on-device heuristic (the "preview" mode)
node research/accuracy-test/run-heuristic.cjs

# 3. Hugging Face model (needs a free Read token; never leaves your shell)
HF_TOKEN=hf_xxx node research/accuracy-test/run-hf.cjs
```

Each runner prints a per-image table, a confusion matrix at the extension's
default threshold and the best achievable threshold, and an F1 sweep. Scores
are also written to `*-scores.json`.

## Results so far

| Engine | F1 @ default | Best F1 | Notes |
|--------|--------------|---------|-------|
| On-device heuristic | **0.00** | 0.15 | Caught 0/4 AI; worse than "always real" (76% base rate). Do not ship. |
| Hugging Face (SwinV2) | _pending token_ | | |

The heuristic's assumption (AI = smooth/clean/flat) is inverted for modern AI
fashion renders. A real trained model — HF now, or the same SwinV2 exported to
ONNX for on-device — is required. ONNX with identical weights + preprocessing
reproduces HF accuracy; this harness will verify that once the ONNX path exists.
