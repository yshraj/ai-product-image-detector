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

## Results (set2: 6 confident-AI / 13 validated-real, best threshold)

| Detector | Recall | Precision | F1 | Verdict |
|----------|--------|-----------|----|---------|
| On-device heuristic | 0% | — | 0.00 | Unshippable |
| Nahrawy/AIorNot | 33% | ~70% | 0.33 | Bad both ways |
| Organika/sdxl-detector | 100% | 38% | 0.57 | Flags everything |
| umm-maybe/AI-image-detector | 50% | 100% | 0.67 | Good; catches different imgs |
| **haywoodsloan (SwinV2)** | 50% | 100% | 0.67 | **Best single** |
| max-ensemble (haywood + umm) | 67% | 100% | 0.80 | Best; 0 false alarms |

Precision is the metric that matters (a false "this real product is AI" flag
erodes trust); haywoodsloan never false-flags. Ceiling of free off-the-shelf
detectors on modern fashion AI is ~50–67% recall.

## On-device ONNX parity — PROVEN

`export_onnx.py` exports haywoodsloan/SwinV2 to ONNX; `parity.py` runs it
locally with the exact `preprocessor_config.json` pipeline (256×256 bicubic,
/255, ImageNet mean/std, softmax[artificial]) and diffs against HF:

```
onnxvenv/bin/python research/accuracy-test/export_onnx.py   # -> onnx/model.onnx (783 MB fp32)
onnxvenv/bin/python research/accuracy-test/parity.py set2
# max abs diff HF vs local ONNX: 0 points   (all 19 images identical)
```

**On-device ONNX reproduces HF exactly — zero accuracy loss.** Open items for
shipping: FP16 (~393 MB) needs a clean conversion (op-block-list for Cast
nodes); INT8 (~200 MB) needs its own parity run; and either size is too big to
bundle in the CRX, so the model must be lazy-downloaded + cached, not shipped
in the zip.
