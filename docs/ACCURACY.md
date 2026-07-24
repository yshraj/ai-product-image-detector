# Detection accuracy — methodology and results

TrueKart is explicit that it's **a signal, not a verdict**. This page is the
receipts for that claim: real numbers, not marketing copy, computed from the
benchmark harness in [`research/accuracy-test/`](../research/accuracy-test/),
reproducible by anyone.

## Methodology

- **Dataset:** 19 real product photos scraped from a Flipkart "navy blue
  casual shirt" search, hand-labeled by the maintainer: 6 confident-AI, 13
  validated-real. Ground truth: [`research/accuracy-test/set2/labels.json`](../research/accuracy-test/set2/labels.json).
- **Scope:** single product category, single marketplace, single point in
  time (2026-07), one labeler. This is a development R&D benchmark, **not** a
  large-scale or third-party-audited accuracy certification. Treat the
  percentages below as directional, not definitive — a 19-image set can't
  characterize real-world performance across every category, region, and
  generator. See [Limitations](#limitations).
- **Metric that matters:** precision. A false "this real photo is AI" flag
  erodes trust faster than a missed detection does — so results below lead
  with precision, not just recall.
- **Threshold:** all figures use the extension's actual shipped default flag
  threshold (**70% confidence**), not a best-case threshold chosen after the
  fact. `research/accuracy-test/metrics.cjs` — a small, transparent scoring
  script — computes accuracy/precision/recall/F1 from raw per-image scores.

## Results (2026-07-25, independently re-verified from committed score data)

| Detection path | Precision | Recall | F1 | What this means |
|---|---|---|---|---|
| **On-device Preview** (default, zero-setup) | **0%** (1 false positive / 1 flag) | 0% (0 / 6 AI images caught) | 0.00 | On this set, the lightweight canvas heuristic caught none of the AI images at the default threshold, **and** flagged one real photo as AI. This is a known, disclosed limitation — the UI labels Preview results "on-device estimate" and recommends connecting Hugging Face; this benchmark is the evidence behind that recommendation, not a new finding. |
| **Hugging Face** (`haywoodsloan/ai-image-detector-deploy`, the default connected model) | **100%** (3/3 flags correct) | 50% (3 / 6 AI images caught) | 0.67 | Zero false alarms on this set — every image it flagged as AI actually was. It misses roughly half the AI images (a "look closer" signal, not a guarantee), which matches the product's own framing. |
| **On-device ONNX** (gated, not in the default build — see [ONDEVICE.md](ONDEVICE.md)) | **100%** (identical to HF) | 50% (identical to HF) | 0.67 | Numerically identical to the Hugging Face result on every one of the 19 images — the local ONNX export reproduces the HF model exactly (max absolute score difference: 0 points). When this ships, it's the same accuracy as Hugging Face with nothing leaving the device. |

**Read this as:** the free, zero-setup default (Preview) is a convenience
layer, not a detector to rely on alone — connecting Hugging Face (free,
~1 minute, see the popup Settings tab) is what actually gets you a
trustworthy signal, with zero false alarms on this benchmark. This is exactly
why the UI nudges toward connecting an engine rather than treating Preview as
a finished product.

## Limitations

- **Small n.** 19 images, 6 positives. A single mislabel or an unusual image
  swings the percentages a lot — do not treat these as population-level
  accuracy claims.
- **One category, one marketplace.** Fashion photos on Flipkart. Accuracy on
  electronics, AliExpress, or a different generator's output could differ.
- **One labeler.** Ground truth is the maintainer's visual judgment (see the
  `sources` field in `labels.json` for per-image reasoning), not a panel or
  forensic analysis. "Confident AI" images include some that are visually
  obvious; borderline cases were deliberately excluded rather than guessed at.
- **A point-in-time snapshot.** Both the detector models and the generators
  producing fake photos keep changing; independent research puts AI-image
  detectors generally in the 88–94% accuracy range with 5–10% false-positive
  rates, and generators are improving faster than detectors in some cases.
  Re-run the benchmark periodically rather than treating this page as
  permanently current.

## Reproduce it yourself

```bash
node research/accuracy-test/run-heuristic.cjs set2      # on-device Preview
HF_TOKEN=hf_xxx node research/accuracy-test/run-hf.cjs set2   # Hugging Face
```

Full harness docs, including the ONNX parity check:
[`research/accuracy-test/README.md`](../research/accuracy-test/README.md).

**Contributions welcome.** A broader, community-run benchmark (more
categories, more marketplaces, more images, ideally more than one labeler)
would make this page meaningfully stronger — see
[CONTRIBUTING.md](../CONTRIBUTING.md).
