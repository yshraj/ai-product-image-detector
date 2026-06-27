# RealModel Filter — Chrome Extension
## End-to-End Developer Guide

> **Purpose of this document:** Full technical spec to build a Chrome extension that detects AI-generated product images on Indian e-commerce sites (Myntra, Flipkart, Meesho, Nykaa) and overlays a badge + confidence score on detected images. Hand this file to Claude as context before starting any implementation session.

> ⚠️ **Historical reference.** This is the original design spec. The shipped product
> has since diverged in two notable ways — treat the README as the source of truth:
> 1. **The "AI or Not" API (Layer 3) was removed (v1.2.0).** The engines are now
>    **Hugging Face** (accurate, via `router.huggingface.co`) and the on-device
>    **Preview** heuristic only. Ignore all `api-detector.js` / `aiornot` / `apiKey`
>    references below.
> 2. **Hugging Face uses the inference router** (`router.huggingface.co/hf-inference`),
>    not the retired `api-inference.huggingface.co` host shown in older snippets.

---

## 1. Project Overview

### What it does
- Scans product image grids on supported e-commerce sites
- Detects whether each product image is AI-generated or a real photograph
- Overlays a visual badge (`🤖 AI Generated — 94%`) on detected images
- Shows a confidence bar at the bottom of each image card
- Provides a popup toggle: **Show All / Badge Only / Hide AI**
- Works on infinite-scroll pages using MutationObserver

### Supported sites (Phase 1)
- `www.myntra.com`
- `www.flipkart.com`
- `www.meesho.com`
- `www.nykaa.com`

### Tech stack
- **Manifest V3** (required for all new Chrome extensions)
- **Vanilla JavaScript** (no build step, no bundler for MVP)
- **TensorFlow.js** (on-device AI detection — loaded from CDN in content script)
- **No backend server** — everything runs client-side
- **chrome.storage.sync** for user preferences

---

## 2. Detection Strategy

Use a **three-layer pipeline** in order. Stop as soon as a layer gives a confident result. This keeps API costs at zero for most cases.

```
Image URL
    │
    ▼
Layer 1: EXIF Metadata Check         (free, ~0ms, catches ~50% of AI images)
    │  No EXIF or stripped EXIF → likely AI
    │  Camera EXIF present → likely real → skip to badge as Real
    ▼
Layer 2: TensorFlow.js On-Device     (free, ~80–150ms, catches another ~35%)
    │  Runs a MobileNet-based binary classifier locally in the browser
    │  confidence > 0.85 → AI HIGH
    │  confidence 0.60–0.85 → AI MEDIUM
    │  confidence < 0.60 → Real
    ▼
Layer 3: AI or Not API (optional)    (free tier: 10/month, paid: $5/month)
    │  Only hit this for images that Layer 2 returned 0.60–0.70 (uncertain zone)
    │  Returns { isAI: boolean, confidence: float }
    ▼
Final Decision → inject badge
```

### Confidence thresholds
| Score | Label | Badge color |
|---|---|---|
| > 85% | AI Generated | Red `#E24B4A` |
| 60–85% | Likely AI | Amber `#EF9F27` |
| < 60% | Real Photo | Green `#639922` |

### EXIF check implementation
Use the `exifr` library (loaded via CDN). Real camera photos always have `Make`, `Model`, `DateTime` fields. AI images have none.

```javascript
// Returns true if image is likely AI based on EXIF alone
async function checkExif(imageUrl) {
  try {
    const exif = await window.exifr.parse(imageUrl, ['Make', 'Model', 'DateTime'])
    if (!exif || (!exif.Make && !exif.Model)) return { likelyAI: true, confidence: 0.80 }
    return { likelyAI: false, confidence: 0.15 }
  } catch {
    // parse failure often means no EXIF (AI image)
    return { likelyAI: true, confidence: 0.75 }
  }
}
```

### TensorFlow.js model
Use a pre-trained MobileNetV2 checkpoint fine-tuned for AI vs real image classification. Load from `@tensorflow-models/mobilenet` and apply binary classification on top. The model runs in the content script context — no server needed.

If no pre-trained AI-detector model is available, fall back to visual heuristics:
- Background uniformity (AI images have near-zero variance in background pixels)
- Skin smoothness score (variance in skin-tone region)
- Edge sharpness at subject boundaries

---

## 3. File Structure

```
realmodel-filter/
├── manifest.json
├── content/
│   ├── content.js          ← main content script (injected into pages)
│   ├── content.css         ← badge styles injected into page
│   └── sites/
│       ├── myntra.js       ← Myntra-specific DOM selectors + logic
│       ├── flipkart.js     ← Flipkart-specific
│       ├── meesho.js       ← Meesho-specific
│       └── nykaa.js        ← Nykaa-specific
├── popup/
│   ├── popup.html          ← extension popup UI
│   ├── popup.js            ← popup logic
│   └── popup.css           ← popup styles
├── background/
│   └── service-worker.js   ← Manifest V3 background service worker
├── detection/
│   ├── exif-check.js       ← Layer 1: EXIF metadata
│   ├── tfjs-detector.js    ← Layer 2: TensorFlow.js on-device
│   └── api-detector.js     ← Layer 3: AI or Not API (optional)
├── utils/
│   ├── cache.js            ← cache results in chrome.storage.local
│   ├── logger.js           ← dev logging utility
│   └── throttle.js         ← rate limiter for API calls
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── libs/
    └── exifr.min.js        ← local copy of exifr (avoid CDN dependency)
```

---

## 4. manifest.json

```json
{
  "manifest_version": 3,
  "name": "RealModel Filter",
  "version": "1.0.0",
  "description": "Detects AI-generated product images on Myntra, Flipkart, Meesho, and Nykaa",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "https://www.myntra.com/*",
    "https://www.flipkart.com/*",
    "https://www.meesho.com/*",
    "https://www.nykaa.com/*",
    "https://api.aiornot.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://www.myntra.com/*",
        "https://www.flipkart.com/*",
        "https://www.meesho.com/*",
        "https://www.nykaa.com/*"
      ],
      "js": [
        "libs/exifr.min.js",
        "utils/cache.js",
        "utils/throttle.js",
        "detection/exif-check.js",
        "detection/tfjs-detector.js",
        "detection/api-detector.js",
        "content/sites/myntra.js",
        "content/sites/flipkart.js",
        "content/sites/meesho.js",
        "content/sites/nykaa.js",
        "content/content.js"
      ],
      "css": ["content/content.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "48": "icons/icon-48.png"
    }
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## 5. Site-Specific DOM Selectors

Each site has a different HTML structure. These selectors were accurate as of June 2026 — verify them in browser DevTools if they stop working.

### Myntra
```javascript
// content/sites/myntra.js
window.RMF_SITE = {
  name: 'myntra',
  // Container that holds all product cards
  gridSelector: '.results-base',
  // Individual product card
  cardSelector: '.product-base',
  // The image element inside each card
  imageSelector: '.product-imageSliderContainer img, .product-image img',
  // The wrapper to make position:relative for overlay
  overlayTargetSelector: '.product-imageSliderContainer',
  // Infinite scroll container to observe
  observeSelector: '.results-base'
}
```

### Flipkart
```javascript
// content/sites/flipkart.js
window.RMF_SITE = {
  name: 'flipkart',
  gridSelector: '._1YokD2._3Mn1Gg, ._1YokD2._2GoDe3',
  cardSelector: '._1AtVbE',
  imageSelector: '._396cs4, img.DByuf4',
  overlayTargetSelector: '._396cs4',
  observeSelector: '._1YokD2'
}
```

### Meesho
```javascript
// content/sites/meesho.js
window.RMF_SITE = {
  name: 'meesho',
  gridSelector: '.ProductList__GridCol-sc',
  cardSelector: '.ProductList__GridCol-sc > div',
  imageSelector: 'img.sc-eDvSVe',
  overlayTargetSelector: 'img.sc-eDvSVe',
  observeSelector: 'main'
}
```

### Nykaa
```javascript
// content/sites/nykaa.js
window.RMF_SITE = {
  name: 'nykaa',
  gridSelector: '.css-uo0ckf',
  cardSelector: '.css-d5z3ro',
  imageSelector: '.css-d5z3ro img',
  overlayTargetSelector: '.css-d5z3ro img',
  observeSelector: '.css-uo0ckf'
}
```

> **Important:** These selectors may break when sites update their CSS class names (they use CSS Modules which regenerate hashes). Use DevTools to re-identify selectors if the extension stops working. A better long-term approach is to target semantic attributes like `data-testid`, `aria-label`, or structural patterns rather than hashed class names.

---

## 6. content/content.js — Main Logic

This is the core file. It:
1. Reads site config from `window.RMF_SITE`
2. Finds all product image cards
3. Runs the detection pipeline on each image
4. Injects overlays
5. Sets up MutationObserver for infinite scroll

```javascript
// content/content.js

(async function () {
  const SITE = window.RMF_SITE
  if (!SITE) return // unsupported page

  // Load user preferences
  const prefs = await chrome.storage.sync.get({ mode: 'badge', enabled: true })
  if (!prefs.enabled) return

  let mode = prefs.mode // 'all' | 'badge' | 'hide'

  // --- CORE FUNCTIONS ---

  // Run full detection pipeline on a single image URL
  async function detectImage(imageUrl) {
    // Check cache first
    const cached = await RMF_Cache.get(imageUrl)
    if (cached) return cached

    // Layer 1: EXIF
    const exifResult = await RMF_ExifCheck(imageUrl)
    if (exifResult.confidence > 0.85) {
      await RMF_Cache.set(imageUrl, exifResult)
      return exifResult
    }

    // Layer 2: TensorFlow.js
    const tfjsResult = await RMF_TfjsDetector(imageUrl)
    if (tfjsResult.confidence > 0.70) {
      await RMF_Cache.set(imageUrl, tfjsResult)
      return tfjsResult
    }

    // Layer 3: API (only for uncertain cases)
    const apiResult = await RMF_ApiDetector(imageUrl)
    await RMF_Cache.set(imageUrl, apiResult)
    return apiResult
  }

  // Inject visual overlay onto a card element
  function injectOverlay(card, imgEl, result) {
    const { isAI, confidence } = result

    // Mark card with data attribute for CSS targeting
    card.setAttribute('data-rmf-scanned', 'true')
    card.setAttribute('data-rmf-ai', isAI ? 'true' : 'false')

    if (!isAI) return // no overlay for real photos (or add green badge if desired)

    // Make parent relative if not already
    const overlayTarget = card.querySelector(SITE.overlayTargetSelector) || card
    if (getComputedStyle(overlayTarget).position === 'static') {
      overlayTarget.style.position = 'relative'
    }

    // Remove existing badge if re-scanning
    overlayTarget.querySelector('.rmf-badge')?.remove()
    overlayTarget.querySelector('.rmf-bar')?.remove()

    // Badge
    const badge = document.createElement('div')
    badge.className = 'rmf-badge'
    badge.setAttribute('data-conf', confidence > 85 ? 'high' : 'med')
    badge.innerHTML = `
      <span class="rmf-label">${confidence > 85 ? '🤖 AI Generated' : '⚠️ Likely AI'}</span>
      <span class="rmf-score">${Math.round(confidence)}%</span>
    `
    overlayTarget.appendChild(badge)

    // Confidence bar
    const bar = document.createElement('div')
    bar.className = 'rmf-bar'
    bar.style.width = `${Math.round(confidence)}%`
    bar.style.background = confidence > 85 ? '#E24B4A' : '#EF9F27'
    overlayTarget.appendChild(bar)

    // Apply current display mode
    applyMode(card, mode)
  }

  // Apply hide/show mode to a single card
  function applyMode(card, currentMode) {
    const isAI = card.getAttribute('data-rmf-ai') === 'true'
    if (currentMode === 'hide' && isAI) {
      card.style.display = 'none'
    } else {
      card.style.display = ''
    }
  }

  // Process a single card element
  async function processCard(card) {
    if (card.getAttribute('data-rmf-scanned')) return // already done

    const imgEl = card.querySelector(SITE.imageSelector)
    if (!imgEl || !imgEl.src) return

    // Wait for image to load if needed
    if (!imgEl.complete) {
      await new Promise(resolve => imgEl.addEventListener('load', resolve, { once: true }))
    }

    const result = await detectImage(imgEl.src)
    injectOverlay(card, imgEl, result)
  }

  // Scan all cards currently in the DOM
  async function scanAll() {
    const cards = document.querySelectorAll(SITE.cardSelector)
    // Process in batches of 5 to avoid blocking the main thread
    const BATCH = 5
    for (let i = 0; i < cards.length; i += BATCH) {
      const batch = Array.from(cards).slice(i, i + BATCH)
      await Promise.all(batch.map(processCard))
    }
  }

  // --- MUTATION OBSERVER for infinite scroll ---
  function startObserver() {
    const observeTarget = document.querySelector(SITE.observeSelector) || document.body
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue // element nodes only
          // If the added node is a card or contains cards
          const cards = node.matches?.(SITE.cardSelector)
            ? [node]
            : Array.from(node.querySelectorAll?.(SITE.cardSelector) || [])
          cards.forEach(processCard)
        }
      }
    })
    observer.observe(observeTarget, { childList: true, subtree: true })
  }

  // --- MODE CHANGE LISTENER (from popup) ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SET_MODE') {
      mode = msg.mode
      document.querySelectorAll(SITE.cardSelector).forEach(card => applyMode(card, mode))
    }
  })

  // --- INIT ---
  await scanAll()
  startObserver()

})()
```

---

## 7. content/content.css — Injected Styles

```css
/* RealModel Filter — injected into page */

.rmf-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 9999;
  pointer-events: none;
}

.rmf-label {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 5px;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.rmf-badge[data-conf="high"] .rmf-label {
  background: rgba(226, 75, 74, 0.92);
  color: #fff;
}

.rmf-badge[data-conf="med"] .rmf-label {
  background: rgba(239, 159, 39, 0.92);
  color: #2a1800;
}

.rmf-score {
  font-size: 11px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.60);
  color: #fff;
  padding: 3px 7px;
  border-radius: 5px;
  line-height: 1.4;
}

.rmf-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 4px;
  border-radius: 0 2px 2px 0;
  transition: width 0.4s ease;
  pointer-events: none;
}

/* Hide AI mode */
[data-rmf-ai="true"].rmf-hidden {
  display: none !important;
}
```

---

## 8. detection/exif-check.js — Layer 1

```javascript
// detection/exif-check.js
// Requires: libs/exifr.min.js loaded before this file

async function RMF_ExifCheck(imageUrl) {
  try {
    const tags = await window.exifr.parse(imageUrl, {
      pick: ['Make', 'Model', 'DateTime', 'LensModel', 'FNumber']
    })

    const hasCameraMeta = tags && (tags.Make || tags.Model || tags.FNumber)

    if (!hasCameraMeta) {
      return { isAI: true, confidence: 78, source: 'exif', detail: 'No camera metadata' }
    }

    return { isAI: false, confidence: 15, source: 'exif', detail: `Camera: ${tags.Make || ''} ${tags.Model || ''}` }

  } catch (err) {
    // exifr throws on binary parse failure — usually means no EXIF at all
    return { isAI: true, confidence: 72, source: 'exif', detail: 'EXIF parse failed' }
  }
}
```

---

## 9. detection/tfjs-detector.js — Layer 2

> **Note to Claude when implementing this:** Load TensorFlow.js from CDN in the manifest's `content_scripts` array. Use `@tensorflow/tfjs` UMD build. For the actual model, either:
> (a) Use a Hugging Face image classification model via `@huggingface/transformers` (preferred), or
> (b) Use MobileNetV2 from `@tensorflow-models/mobilenet` and apply a binary classification head.

```javascript
// detection/tfjs-detector.js
// Requires: TensorFlow.js loaded before this script

let _model = null

async function RMF_TfjsDetector(imageUrl) {
  try {
    // Lazy load model on first call
    if (!_model) {
      _model = await loadAIDetectorModel()
    }

    // Load image into a tensor
    const img = await loadImageTensor(imageUrl)
    const prediction = await _model.predict(img)
    const confidence = await extractAIConfidence(prediction)

    // Clean up tensors
    img.dispose()
    prediction.dispose()

    return {
      isAI: confidence > 60,
      confidence: Math.round(confidence),
      source: 'tfjs'
    }

  } catch (err) {
    console.warn('[RMF] TF.js detection failed:', err)
    // Return low confidence so Layer 3 takes over
    return { isAI: false, confidence: 50, source: 'tfjs-failed' }
  }
}

async function loadImageTensor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tensor = tf.browser.fromPixels(img)
        .resizeBilinear([224, 224])
        .expandDims(0)
        .toFloat()
        .div(127.5)
        .sub(1)
      resolve(tensor)
    }
    img.onerror = reject
    img.src = imageUrl
  })
}
```

---

## 10. detection/api-detector.js — Layer 3

```javascript
// detection/api-detector.js
// Only called for uncertain cases (Layer 2 confidence 50–70%)
// Uses AI or Not API: https://aiornot.com

const API_ENDPOINT = 'https://api.aiornot.com/v1/reports/image'
const API_KEY = '' // Set via popup settings → stored in chrome.storage.sync

async function RMF_ApiDetector(imageUrl) {
  const { apiKey } = await chrome.storage.sync.get({ apiKey: '' })

  if (!apiKey) {
    // No API key configured — return neutral result
    return { isAI: false, confidence: 50, source: 'api-skipped' }
  }

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ object: imageUrl })
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)

    const data = await res.json()
    const confidence = Math.round(data.report?.ai?.confidence * 100 || 50)
    const isAI = data.report?.verdict === 'ai'

    return { isAI, confidence, source: 'api' }

  } catch (err) {
    console.warn('[RMF] API detection failed:', err)
    return { isAI: false, confidence: 50, source: 'api-failed' }
  }
}
```

---

## 11. utils/cache.js

Cache detection results so the same image URL is never processed twice. Use `chrome.storage.local` (50MB limit, much more than sync).

```javascript
// utils/cache.js

const CACHE_KEY_PREFIX = 'rmf_cache_'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const RMF_Cache = {
  async get(imageUrl) {
    const key = CACHE_KEY_PREFIX + btoa(imageUrl).slice(0, 40)
    const result = await chrome.storage.local.get(key)
    const entry = result[key]
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      chrome.storage.local.remove(key)
      return null
    }
    return entry.data
  },

  async set(imageUrl, data) {
    const key = CACHE_KEY_PREFIX + btoa(imageUrl).slice(0, 40)
    await chrome.storage.local.set({
      [key]: { data, timestamp: Date.now() }
    })
  },

  async clear() {
    const all = await chrome.storage.local.get(null)
    const cacheKeys = Object.keys(all).filter(k => k.startsWith(CACHE_KEY_PREFIX))
    await chrome.storage.local.remove(cacheKeys)
  }
}
```

---

## 12. popup/popup.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RealModel Filter</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div class="header">
    <span class="logo"><span class="logo-accent">Real</span>Model Filter</span>
    <label class="switch">
      <input type="checkbox" id="toggle-enabled" checked />
      <span class="slider"></span>
    </label>
  </div>

  <div class="stat-row" id="stat-row">
    <div class="stat"><span id="ai-count">–</span><small>AI Detected</small></div>
    <div class="stat"><span id="total-count">–</span><small>Total Scanned</small></div>
    <div class="stat"><span id="cache-count">–</span><small>Cached</small></div>
  </div>

  <div class="section-label">Display mode</div>
  <div class="mode-group">
    <button class="mode-btn active" data-mode="all">Show All</button>
    <button class="mode-btn" data-mode="badge">Badge Only</button>
    <button class="mode-btn" data-mode="hide">Hide AI</button>
  </div>

  <div class="section-label">API Key (optional)</div>
  <input type="password" id="api-key-input" placeholder="AI or Not API key" />
  <button id="save-api-key">Save</button>

  <div class="footer">
    <a href="https://aiornot.com" target="_blank">Get API key free →</a>
    <button id="clear-cache">Clear cache</button>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

---

## 13. popup/popup.js

```javascript
// popup/popup.js

document.addEventListener('DOMContentLoaded', async () => {
  const prefs = await chrome.storage.sync.get({
    mode: 'badge',
    enabled: true,
    apiKey: ''
  })

  // Set initial UI state
  document.getElementById('toggle-enabled').checked = prefs.enabled
  document.getElementById('api-key-input').value = prefs.apiKey
  setActiveMode(prefs.mode)

  // Load stats
  updateStats()

  // Enable/disable toggle
  document.getElementById('toggle-enabled').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ enabled: e.target.checked })
    sendToActiveTab({ type: 'SET_ENABLED', enabled: e.target.checked })
  })

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.getAttribute('data-mode')
      await chrome.storage.sync.set({ mode })
      setActiveMode(mode)
      sendToActiveTab({ type: 'SET_MODE', mode })
    })
  })

  // Save API key
  document.getElementById('save-api-key').addEventListener('click', async () => {
    const key = document.getElementById('api-key-input').value.trim()
    await chrome.storage.sync.set({ apiKey: key })
    showToast('API key saved')
  })

  // Clear cache
  document.getElementById('clear-cache').addEventListener('click', async () => {
    const all = await chrome.storage.local.get(null)
    const keys = Object.keys(all).filter(k => k.startsWith('rmf_cache_'))
    await chrome.storage.local.remove(keys)
    showToast(`Cleared ${keys.length} cached results`)
    updateStats()
  })
})

function setActiveMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode)
  })
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) chrome.tabs.sendMessage(tab.id, message)
}

async function updateStats() {
  const all = await chrome.storage.local.get(null)
  const cacheEntries = Object.values(all).filter((_, k) => k?.startsWith?.('rmf_cache_'))
  const aiCount = Object.values(all).filter(v => v?.data?.isAI).length
  document.getElementById('cache-count').textContent = Object.keys(all).filter(k => k.startsWith('rmf_cache_')).length
  document.getElementById('ai-count').textContent = aiCount
  document.getElementById('total-count').textContent = Object.keys(all).filter(k => k.startsWith('rmf_cache_')).length
}

function showToast(msg) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2000)
}
```

---

## 14. background/service-worker.js

Minimal service worker — Manifest V3 requires one even if unused.

```javascript
// background/service-worker.js

chrome.runtime.onInstalled.addListener(() => {
  console.log('[RMF] Extension installed')
  // Set default preferences
  chrome.storage.sync.set({
    mode: 'badge',
    enabled: true,
    apiKey: ''
  })
})
```

---

## 15. Known Issues & Edge Cases

| Issue | Cause | Fix |
|---|---|---|
| Images not detected on first load | Images load after content script runs | Add `img.addEventListener('load', ...)` check in processCard |
| Infinite scroll misses new cards | MutationObserver target too narrow | Observe `document.body` as fallback |
| CORS error on EXIF fetch | Image URL blocked cross-origin | Catch error, return low confidence result |
| CSS selectors break | Site updated class names | Re-identify selectors in DevTools, update site config file |
| Extension slows page down | Running TF.js on every image immediately | Process max 3 images at once, use `requestIdleCallback` |
| Badge covers product image on hover | Site has zoom-on-hover | Add `pointer-events: none` to badge, use `z-index` carefully |

---

## 16. Build & Load in Chrome (Dev Mode)

1. Clone/unzip the project folder
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **Load Unpacked** → select the `realmodel-filter/` folder
5. Pin the extension from the extensions menu
6. Navigate to `myntra.com` → browse any category page
7. Open DevTools Console → check for `[RMF]` logs

### To reload after code changes
Go to `chrome://extensions` → click the refresh icon on the RealModel Filter card. Or use **Extensions Reloader** Chrome extension for auto-reload.

---

## 17. Phase 1 vs Phase 2 Scope

### Phase 1 — MVP (build this first)
- [x] Myntra only
- [x] EXIF + simple heuristic detection (no TF.js yet)
- [x] Red badge overlay with confidence %
- [x] Toggle: Show All / Hide AI
- [x] No API key required
- [x] Manual cache (sessionStorage)

### Phase 2 — Polish
- [ ] All 4 sites (Flipkart, Meesho, Nykaa)
- [ ] TensorFlow.js on-device model
- [ ] AI or Not API integration with key config
- [ ] chrome.storage.local persistent cache
- [ ] Stats in popup (X of Y AI detected)
- [ ] Keyboard shortcut to toggle
- [ ] Chrome Web Store submission

---

## 18. Prompts for Development Sessions with Claude

Use these prompts when working with Claude on specific parts:

**Starting content.js:**
> "Using the RealModel Filter dev guide as context, implement content.js for Myntra. Start with just EXIF-based detection (no TF.js yet). Make the MutationObserver handle infinite scroll. Show me the full working file."

**Debugging selectors:**
> "The Myntra selector `.product-base` is not finding cards. Here's the HTML structure I see in DevTools: [paste HTML]. Update myntra.js with the correct selectors."

**Adding TF.js:**
> "Add the TensorFlow.js detection layer to tfjs-detector.js. Use MobileNetV2. The model should run inference on the image and return { isAI, confidence }. Keep it lazy-loaded."

**Popup UI:**
> "Build the popup HTML and CSS. Minimal design: header with logo + enable toggle, three mode buttons (Show All / Badge Only / Hide AI), stats row, API key input. Width 280px."

---

## 19. Resources

| Resource | URL |
|---|---|
| Chrome Extension Manifest V3 docs | https://developer.chrome.com/docs/extensions/mv3/ |
| TensorFlow.js | https://www.tensorflow.org/js |
| exifr library | https://github.com/MikeKovarik/exifr |
| AI or Not API docs | https://aiornot.com/docs |
| Hugging Face image classification | https://huggingface.co/tasks/image-classification |
| Chrome Extension samples | https://github.com/GoogleChrome/chrome-extensions-samples |

---

*Document version: 1.0 — June 2026*
*Project: RealModel Filter Chrome Extension*
