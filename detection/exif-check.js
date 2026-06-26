// detection/exif-check.js  — Layer 1
// Requires: libs/exifr.min.js. Operates on bytes fetched by the service worker
// (passed as a data URL) so it works on cross-origin CDN images.
//
// IMPORTANT: absence of EXIF is NOT treated as an AI signal — every e-commerce
// CDN strips EXIF, so "no metadata" is the norm for real photos too. EXIF only
// produces a DECISIVE result when genuine camera metadata is present (→ real).
(function () {
  function dataUrlToUint8(dataUrl) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function RMF_ExifCheck(imageUrl, dataUrl) {
    if (!window.exifr) return { hasSignal: false, source: 'exif-unavailable' };
    try {
      const input = dataUrl ? dataUrlToUint8(dataUrl) : imageUrl;
      const tags = await window.exifr.parse(input, {
        pick: ['Make', 'Model', 'LensModel', 'FNumber', 'ISO', 'ExposureTime'],
      });
      const hasCameraMeta = tags && (tags.Make || tags.Model || tags.FNumber || tags.ISO);
      if (hasCameraMeta) {
        // Real camera capture — decisive.
        return {
          hasSignal: true,
          isAI: false,
          confidence: 8,
          source: 'exif',
          detail: `Camera: ${tags.Make || ''} ${tags.Model || ''}`.trim(),
        };
      }
      // No camera metadata — no opinion either way.
      return { hasSignal: false, source: 'exif-none' };
    } catch {
      return { hasSignal: false, source: 'exif-none' };
    }
  }

  window.RMF_ExifCheck = RMF_ExifCheck;
})();
