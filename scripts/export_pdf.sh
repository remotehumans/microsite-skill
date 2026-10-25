#!/usr/bin/env bash
# ABOUTME: Exports a built microsite to PDF as a backup for when links or HTML attachments are blocked.
# ABOUTME: Usage: export_pdf.sh PAGE.html OUT.pdf  (reduced motion, so animated elements print in their final state; Chrome from settings.json tools.chrome or the usual install paths).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PAGE="$1"; OUT="$2"
CHROME="$(python3 "$HERE/provider.py" tool chrome "" 2>/dev/null || true)"
if [[ -z "$CHROME" ]]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "$(command -v google-chrome || true)" "$(command -v chromium || true)" "$(command -v chromium-browser || true)"; do
    [[ -n "$c" && -x "$c" ]] && { CHROME="$c"; break; }
  done
fi
[[ -n "$CHROME" ]] || { echo "No Chrome or Chromium found; set tools.chrome in settings.json" >&2; exit 1; }
"$CHROME" --headless --disable-gpu --force-prefers-reduced-motion --no-pdf-header-footer \
  --virtual-time-budget=8000 --print-to-pdf="$OUT" "file://$(cd "$(dirname "$PAGE")" && pwd)/$(basename "$PAGE")" 2>/dev/null
[[ -s "$OUT" ]] && echo "PDF $OUT ($(du -h "$OUT" | cut -f1))" || { echo "PDF export failed" >&2; exit 1; }
