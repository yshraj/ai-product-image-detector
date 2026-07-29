#!/usr/bin/env bash
# Re-download the vendored exifr build into libs/exifr.min.js.
#
# Two things this script exists to guarantee, both of which a bare `curl` got
# wrong before:
#
#   1. The version is PINNED. Fetching `npm/exifr/dist/lite.umd.js` (no version)
#      silently pulls whatever is latest at download time into a git-tracked
#      file, so the bundled bytes could change without any commit explaining it.
#
#   2. The MIT notice is re-attached. exifr's published `lite.umd.js` is
#      minified with its copyright header stripped, but the MIT License requires
#      the notice to travel with every copy we redistribute — and we redistribute
#      this file in the repo AND inside the packaged .zip. Without this step the
#      next refresh would silently drop the attribution again.
#
# Bump EXIFR_VERSION here, run `npm run refresh-exifr`, and commit the result.
set -euo pipefail

EXIFR_VERSION="7.1.3"
BANNER="/*! exifr ${EXIFR_VERSION} | MIT License | Copyright (c) 2020 Mike Kovařík, Mutiny.cz | https://github.com/MikeKovarik/exifr */"
OUT="libs/exifr.min.js"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "Fetching exifr ${EXIFR_VERSION}..."
curl -fsSL -o "$TMP" "https://cdn.jsdelivr.net/npm/exifr@${EXIFR_VERSION}/dist/lite.umd.js"

printf '%s\n' "$BANNER" | cat - "$TMP" > "$OUT"

echo "Wrote ${OUT} ($(wc -c < "$OUT" | tr -d ' ') bytes, MIT notice attached)."
echo "Remember to update THIRD-PARTY-NOTICES.md if the version changed."
