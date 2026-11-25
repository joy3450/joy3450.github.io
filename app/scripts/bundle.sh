#!/bin/bash
# Build the app into one self-contained HTML file and copy it to the repo root,
# which is what GitHub Pages serves.
set -e
cd "$(dirname "$0")/.."
rm -rf dist .parcel-cache
pnpm exec parcel build index.html --dist-dir dist --no-source-maps
mkdir -p ../phrase-bank
node scripts/inline.mjs dist/index.html ../phrase-bank/index.html
echo "Wrote ../phrase-bank/index.html ($(du -h ../phrase-bank/index.html | cut -f1))"
