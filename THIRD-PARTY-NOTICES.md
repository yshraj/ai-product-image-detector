# Third-party notices

TrueKart itself is licensed under the [MIT License](LICENSE). It also
redistributes the third-party component listed below — both in this repository
and inside the packaged `.zip` — and that component's license and copyright
notice are reproduced here as its license requires.

Build and test tooling (Playwright, ESLint, web-ext, and the rest of
`devDependencies`) is **not** redistributed and is therefore not listed here.

---

## exifr 7.1.3

- **Used for:** reading EXIF metadata from product images (`detection/exif-check.js`)
- **Vendored at:** [`libs/exifr.min.js`](libs/exifr.min.js) — the `dist/lite.umd.js` build
- **Upstream:** https://github.com/MikeKovarik/exifr
- **Refresh with:** `npm run refresh-exifr` (version-pinned; re-attaches the notice below)

```
MIT License

Copyright (c) 2020 Mike Kovařík, Mutiny.cz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Not redistributed

These are referenced by the project but never shipped inside it, so their
licenses do not attach to TrueKart's distribution:

| Component | Relationship |
|---|---|
| `haywoodsloan/ai-image-detector-deploy`, `umm-maybe/AI-image-detector` | Hugging Face models. Called at runtime over the HF Inference API using **the user's own token**. No weights are downloaded, bundled, or hosted by TrueKart. |
| ONNX Runtime Web | Excluded from the default build (`web-ext-config.mjs` ignores `libs/onnx`) and not committed to this repository. Fetched on demand by `npm run refresh-onnx-runtime` for on-device development only. |

> **Note for the on-device engine:** shipping the on-device path (see
> [docs/ONDEVICE.md](docs/ONDEVICE.md)) would mean hosting and redistributing
> model weights and the ONNX Runtime. Both carry their own licenses that must be
> reviewed and added to this file *before* that work ships.
