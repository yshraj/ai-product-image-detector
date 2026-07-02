# Privacy Policy — TrueKart

_Last updated: 2026-07-02_

**TrueKart does not collect, store, or transmit any personal data to us.**
There is no account system, no backend server operated by us, and no analytics,
advertising, or tracking of any kind.

## What stays on your device

- **Preferences** (display mode, minimum-confidence threshold, active marketplaces,
  compare marketplace toggles, enabled state) are stored with `chrome.storage.sync`, which
  syncs only across your own signed-in Chrome profile. We never receive them.
- **Detection results** are cached in your browser's `chrome.storage.local` (per image
  URL, with a 7-day expiry) purely to avoid re-analyzing the same image. You can clear
  this at any time from the popup or the Settings page.
- **Activity history** (flagged items) is stored locally in `chrome.storage.local` and
  never leaves your device unless you export it yourself.
- **Your Hugging Face access token and SerpApi key** (if you provide them) are stored
  in the extension (currently `chrome.storage.sync` with your other preferences). They
  sync only across your own signed-in Chrome profile on Google's infrastructure — we
  never receive them. They are used only when **you** enable those features, sent
  **directly** from your browser to Hugging Face or SerpApi, never through a TrueKart
  server. Keys are excluded from exported settings.

## What leaves your device

- **Preview engine (default):** nothing leaves your browser — detection runs entirely
  on-device.
- **Hugging Face engine (optional):** when enabled, the bytes of the product images you
  view and your access token are sent **directly to Hugging Face's API**
  (`router.huggingface.co`, `huggingface.co`) to classify the image. This is governed by
  [Hugging Face's privacy policy](https://huggingface.co/privacy). We are not an
  intermediary and do not see this traffic.
- **Compare / Similar products (optional):** when you look for the same product on other
  marketplaces, your browser sends the product's search query directly to those
  marketplaces (Amazon, Flipkart, Myntra, Meesho, Nykaa). If you have configured a SerpApi
  key, the query is also sent to **SerpApi** (`serpapi.com`), which searches Google
  Shopping on your behalf. To rank results by image similarity, the extension downloads an
  open-source CLIP model from **Hugging Face** (`huggingface.co`) the first time you use
  this feature and caches it in your browser; the image comparison itself then runs
  on-device. We do not proxy or log any of these requests.
- **Reverse image search & external links (optional):** when you use reverse image search
  or a manual search link, your browser opens or contacts those third-party services
  directly (Google Lens, Bing, Amazon, etc.). We do not proxy or log those requests.

## Permissions

Host access is limited to the supported marketplaces (Myntra, Flipkart, Meesho, Nykaa and
Amazon.in), their image CDNs, the Hugging Face API, and SerpApi. The background service
worker only fetches public `http(s)` image URLs and refuses loopback/private network
addresses.

## Data deletion

Uninstalling the extension removes all locally stored data. You can also use
**Settings → Reset all settings** and **Clear cache** at any time.

## Contact

Questions or requests: open an issue at
<https://github.com/yshraj/ai-product-image-detector/issues>.
