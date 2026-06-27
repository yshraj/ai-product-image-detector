# Privacy Policy — RealModel Filter

_Last updated: 2026-06-27_

**RealModel Filter does not collect, store, or transmit any personal data to us.**
There is no account system, no backend server operated by us, and no analytics,
advertising, or tracking of any kind.

## What stays on your device

- **Preferences** (display mode, minimum-confidence threshold, active marketplaces,
  enabled state) are stored with `chrome.storage.sync`, which syncs only across your
  own signed-in Chrome profile. We never receive them.
- **Detection results** are cached in your browser's `chrome.storage.local` (per image
  URL, with a 7-day expiry) purely to avoid re-analyzing the same image. You can clear
  this at any time from the popup or the Settings page.
- **Your Hugging Face access token** (if you connect one) is stored locally on your
  device and is used only to authenticate requests to Hugging Face. It is never sent to
  us, never bundled in the extension, and is excluded from exported settings.

## What leaves your device

- **Preview engine (default):** nothing leaves your browser — detection runs entirely
  on-device.
- **Hugging Face engine (optional):** when enabled, the bytes of the product images you
  view and your access token are sent **directly to Hugging Face's API**
  (`router.huggingface.co`, `huggingface.co`) to classify the image. This is governed by
  [Hugging Face's privacy policy](https://huggingface.co/privacy). We are not an
  intermediary and do not see this traffic.

## Permissions

Host access is limited to the supported marketplaces (Myntra, Flipkart, Meesho, Nykaa),
their image CDNs, and the Hugging Face API. The background service worker only fetches
public `http(s)` image URLs and refuses loopback/private network addresses.

## Data deletion

Uninstalling the extension removes all locally stored data. You can also use
**Settings → Reset all settings** and **Clear cache** at any time.

## Contact

Questions or requests: open an issue at
<https://github.com/yshraj/ai-product-image-detector/issues>.
