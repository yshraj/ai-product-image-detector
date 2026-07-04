# On-device AI detection (local ONNX engine)

TrueKart can run the AI-image detector **fully on the user's device** — no Hugging
Face token, and no image ever leaves the browser. This is the "works without a
token" path. It reproduces the research pipeline in
`research/accuracy-test/parity.py` exactly, so local predictions match the
Hugging Face reference model.

> **Status:** the engine is fully implemented and unit-checked, but it ships
> **inert by default** and requires the activation steps below, plus one live
> validation pass in a browser (which cannot be automated here because it needs
> the multi-hundred-MB model file, the ONNX Runtime WASM, and a real Chrome).

---

## Architecture

```
popup / options ──RMF_ONDEVICE_START/CANCEL/DELETE/STATUS──▶ service worker
                                                              │
                              detection/ondevice/engine.js ───┤ orchestrates
                                                              │
   download-manager.js  (resumable fetch, retry, timeout) ────┤ weights = DATA
   model-store.js       (IndexedDB, versioned cache) ─────────┤ (downloaded)
                                                              │
                              offscreen/detector.html ────────▶ offscreen doc
                              offscreen/detector.js            │  (ONNX Runtime,
                              libs/onnx/ort.min.js  ───────────┘   canvas preproc)
```

| Concern | Where | Notes |
|---------|-------|-------|
| Lazy download | `download-manager.js` | Fetches weights only on user action |
| Resume | `download-manager.js` + `model-store.js` | HTTP `Range` + `If-Range`(ETag); partial chunks checkpointed to IndexedDB every ~16 MB |
| Retry / backoff | `download-manager.js` | `DOWNLOAD_RETRIES` attempts, exponential backoff |
| Stall timeout | `download-manager.js` | Aborts if no bytes for `DOWNLOAD_TIMEOUT_MS` |
| Integrity | `download-manager.js` | Optional sha-256 verify before caching |
| Versioned cache + invalidation | `model-store.js` | Key = `MODEL_ID@MODEL_VERSION`; `pruneOldVersions()` drops stale entries |
| Progress UI | `engine.js` → `RMF_ONDEVICE_STATUS` → options page | Throttled `{received,total,pct}` |
| Inference | `offscreen/detector.js` | One warm `InferenceSession`, reads weights straight from IndexedDB |
| Preprocessing | `offscreen/detector.js` | 256×256 → /255 → ImageNet mean/std → CHW (matches `parity.py`) |
| Postprocessing | `offscreen/detector.js` | `softmax(logits)[AI_CLASS_INDEX]` = P(AI) |
| Memory cleanup | `offscreen/detector.js` | Tensor + `ImageBitmap` disposed per call; `dispose` releases the session |
| Graceful fallback | `engine.js` + `service-worker.js` | `runtimeMissing` / `modelMissing` → pipeline falls back to Hugging Face / preview |

Weights are **data**, so downloading them at runtime is Chrome-MV3 compliant. The
ONNX Runtime WASM is **code** and must be **bundled** (MV3 forbids remote code) —
hence the activation steps.

---

## Why it ships inert by default

Enabling on-device detection adds ~10 MB of ONNX Runtime WASM to the package and
requires the `offscreen` permission. To keep the default store package tiny
(~120 KB) and avoid an unused permission, the runtime is not bundled and the
`offscreen` permission is not requested until you deliberately turn this on.
Until then, `RMF_ONDEVICE_STATUS` reports `available: false` and the options UI
hides the on-device controls.

---

## Activation (build a full/on-device variant)

1. **Bundle the ONNX Runtime Web** (code, must ship):
   ```bash
   npm run refresh-onnx-runtime      # → libs/onnx/ort.min.js + *.wasm
   ```
2. **Add the `offscreen` permission** to `manifest.json`:
   ```json
   "permissions": ["activeTab","storage","scripting","tabs","notifications","contextMenus","offscreen"]
   ```
3. **Include the runtime in the package** — remove `libs/onnx` (and, if you use
   it, `offscreen`) from `ignoreFiles` in `web-ext-config.mjs`. (`offscreen/` is
   already needed; ensure `offscreen/detector.html` + `detector.js` ship.)
4. **Export + host the model** (weights, downloaded at runtime):
   ```bash
   onnxvenv/bin/python research/accuracy-test/export_onnx.py   # → onnx/model.onnx
   # Convert to int8/fp16 for a smaller download, then host it at an https URL
   # that supports Range requests (e.g. a Hugging Face repo `resolve` URL or a CDN).
   ```
5. **Point the extension at the model** — set `MODEL_URL` in
   `utils/ondevice-config.js`, or leave it blank and let the user paste the URL
   in **Options → On-device model → Model URL**. Bump `MODEL_VERSION` whenever the
   URL, preprocessing, or label mapping changes.
6. Rebuild: `npm run build`.

---

## Manual validation protocol (required before trusting verdicts)

This cannot be automated in CI (needs the model, the runtime, and a browser).

**A. Numerical parity vs. the reference**

1. Regenerate the reference scores:
   ```bash
   HF_TOKEN=hf_xxx node research/accuracy-test/run-hf.cjs          # hf-scores.json
   onnxvenv/bin/python research/accuracy-test/parity.py set2        # onnx-scores.json
   ```
   Expected: `max abs diff HF vs local ONNX: 0 points` (per the research README).
2. Load the activated extension unpacked, switch the engine to **On-device**,
   download the model, then run the extension over the same `set2` images (or use
   the right-click "Check this image" on each).
3. **Pass criterion:** the extension's P(AI) per image is within **±3 points** of
   `onnx-scores.json`. Small diffs are expected because the browser canvas uses
   high-quality bilinear resampling rather than PIL bicubic; **verdicts
   (AI/real at the flag threshold) must not change.** If verdicts flip, the
   resampling gap is too large — pre-resize with a Lanczos step or switch the
   export to accept the browser's tensor.

**B. Download subsystem**

| Test | How | Expected |
|------|-----|----------|
| Progress | Start download in Options | Bar advances; `pct/received/total` update |
| Resume | Kill the SW mid-download (`chrome://serviceworker-internals`) or go offline, then retry | Resumes from the last ~16 MB checkpoint, not from 0 |
| Retry | Throttle/drop the network briefly | Retries with backoff, then succeeds or errors cleanly |
| Timeout | Block the host after headers | Aborts after `DOWNLOAD_TIMEOUT_MS`, reports error |
| Integrity | Set `MODEL_SHA256` to the wrong hash | Download rejected: "integrity check failed" |
| Versioning | Bump `MODEL_VERSION`, reload | Old weights ignored; `pruneOldVersions` clears them |
| Cache hit | Reload after a completed download | Status = Ready instantly, no re-download |
| Delete | Options → Delete cached model | IndexedDB entry removed; status → Not downloaded |

**C. Fallback**

- Runtime not bundled → engine reports `runtimeMissing`; scanning falls back to
  Hugging Face / preview with no errors.
- Model not yet downloaded → provider `ondevice` falls back to the preview
  heuristic; the popup still shows download status.

### Likely failure cases to watch
- **Resampling drift** flipping a borderline verdict (see A3).
- **Model too large** for a smooth first-run — prefer int8 (~200 MB).
- **CDN without Range support** → resume silently restarts from 0 (still
  correct, just slower).
- **SW eviction** during a very long download on flaky networks → resume covers
  this, but the user may need to press Download again.
