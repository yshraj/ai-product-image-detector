// utils/ondevice-config.js
// Single source of truth for the on-device (local ONNX) AI-image detector.
//
// The detector reproduces the research pipeline in research/accuracy-test/parity.py
// EXACTLY so local predictions match the Hugging Face reference:
//   resize 256x256 (bicubic) -> /255 -> normalize ImageNet mean/std -> CHW ->
//   ONNX SwinV2 -> softmax(logits)[artificial] = P(AI).
//
// The model weights are DATA (not code) and are downloaded lazily on first use,
// then cached in IndexedDB. The ONNX Runtime Web WASM is CODE and MUST be bundled
// in the package (Chrome MV3 forbids remotely-hosted code) — see libs/onnx/ and
// `npm run refresh-onnx-runtime`. When the runtime is not bundled, the engine
// reports `runtimeMissing` and the pipeline falls back to Hugging Face / preview.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMF_OndeviceConfig = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  return {
    // Bump MODEL_VERSION whenever MODEL_URL, preprocessing, or label mapping
    // changes — it is part of the IndexedDB cache key, so old cached weights are
    // ignored (and can be pruned) automatically.
    MODEL_ID: 'haywoodsloan-swinv2',
    MODEL_VERSION: 1,

    // Where the exported ONNX weights are hosted. This MUST be an https URL that
    // supports HTTP Range requests for resumable downloads (most CDNs and the
    // Hugging Face `resolve` endpoint do). Empty by default: the user hosts the
    // int8/fp16 export (see research/accuracy-test/export_onnx.py) and sets this
    // via Settings (stored key `ondeviceModelUrl`) or by editing MODEL_URL here.
    // Example: 'https://huggingface.co/<user>/<repo>/resolve/main/model.onnx'
    MODEL_URL: '',

    // Optional integrity check. When set (hex sha-256 of the ONNX file), the
    // download manager verifies the bytes before caching. Leave '' to skip.
    MODEL_SHA256: '',

    // Rough size hint (bytes) for progress UI before Content-Length is known.
    // int8 export ≈ 200 MB, fp16 ≈ 393 MB, fp32 ≈ 747 MB.
    MODEL_SIZE_HINT: 200 * 1024 * 1024,

    // Preprocessing — MUST match parity.py.
    INPUT_SIZE: 256,
    MEAN: [0.485, 0.456, 0.406],
    STD: [0.229, 0.224, 0.225],
    // Index in the softmax output that corresponds to "AI / artificial".
    AI_CLASS_INDEX: 0,

    // Flag threshold for the on-device verdict (P(AI) >= this ⇒ isAI). Kept in
    // step with the Hugging Face path so verdicts are comparable.
    FLAG_AT: 50,

    // Networking guardrails for the download manager.
    DOWNLOAD_RETRIES: 4,
    DOWNLOAD_TIMEOUT_MS: 120_000,        // overall stall timeout (no progress)
    DOWNLOAD_RETRY_BASE_MS: 1_000,       // exponential backoff base
    DOWNLOAD_PROGRESS_THROTTLE_MS: 250,  // UI update cadence

    // IndexedDB names.
    DB_NAME: 'rmf_ondevice',
    DB_VERSION: 1,
    STORE_MODELS: 'models',
    STORE_PARTIALS: 'partials',

    // Offscreen document that hosts the ONNX Runtime session.
    OFFSCREEN_URL: 'offscreen/detector.html',
    // Path to the bundled ONNX Runtime Web build (loaded by the offscreen doc).
    ORT_SCRIPT: 'libs/onnx/ort.min.js',
    ORT_WASM_DIR: 'libs/onnx/',
  };
}));
