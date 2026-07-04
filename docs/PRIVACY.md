# Privacy Policy — TrueKart

_Last updated: 2026-07-04_

**TrueKart does not collect, store, or transmit any personal data to us.**
There is no account system, no backend server operated by us, and no analytics,
advertising, or tracking of any kind.

## What stays on your device

- **Preferences** (detection engine, display mode, minimum-confidence threshold,
  enabled marketplaces, notification opt-in, enabled state) are stored with
  `chrome.storage.sync`, which syncs only across your own signed-in Chrome
  profile. We never receive them.
- **Detection results** are cached in your browser's `chrome.storage.local` (per
  image URL, with a 7-day expiry) purely to avoid re-analyzing the same image.
  You can clear this at any time from the popup or the Settings page.
- **Activity history** (flagged items) is stored locally in `chrome.storage.local`
  and never leaves your device unless you export it yourself.
- **Engine health and notification throttling** are kept in `chrome.storage.session`,
  which is cleared when the browser session ends and never written to disk.
- **Your Hugging Face access token** (if you provide one) is stored in the
  extension (currently `chrome.storage.sync` with your other preferences). It
  syncs only across your own signed-in Chrome profile on Google's infrastructure
  — we never receive it. It is used only when **you** enable the Hugging Face
  engine, sent **directly** from your browser to Hugging Face, never through a
  TrueKart server. The token is excluded from exported settings.

## What leaves your device

- **Preview engine (default):** nothing leaves your browser — the heuristic runs
  entirely on-device.
- **Hugging Face engine (optional):** when you enable it, the bytes of the product
  images you view and your access token are sent **directly to Hugging Face's API**
  (`router.huggingface.co`, `huggingface.co`) to classify the image. This is
  governed by [Hugging Face's privacy policy](https://huggingface.co/privacy). We
  are not an intermediary and do not see this traffic.
- **On-device engine (optional):** when you enable it, the extension downloads an
  open-source detection model from the https URL you (or the build) configure and
  caches it in your browser. Image classification then runs **entirely on-device**;
  no image is transmitted.
- **Reverse image search & external links (optional):** when you use "Find identical"
  or a manual search link, your browser opens those third-party services directly
  (e.g. Google Lens, Bing). We do not proxy or log those requests.

## Permissions

Host access is limited to the supported marketplaces (AliExpress, Temu, Shein,
Amazon — global and regional — Myntra, Flipkart, Meesho, Nykaa), their image
CDNs, and the Hugging Face API. The background service worker only fetches public
`http(s)` image URLs and refuses loopback/private/link-local network addresses
(an SSRF guard).

## Data deletion

Uninstalling the extension removes all locally stored data. You can also use
**Settings → Reset all settings** and **Clear cache** at any time.

## Contact

Questions or requests: open an issue at
<https://github.com/yshraj/ai-product-image-detector/issues>.
