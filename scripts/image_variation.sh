#!/usr/bin/env bash
# ABOUTME: Creates one AI concept variation of a company's published image with the image tool set in settings.json (default: Codex CLI on a ChatGPT subscription).
# ABOUTME: Usage: image_variation.sh SOURCE.png OUTPUT.png "what to change"; everything structural in the source is locked.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$1"; OUT="$2"; CHANGE="$3"
ROOT="$(cd "$(dirname "$OUT")" && pwd)"
TOOL="$(python3 "$HERE/provider.py" tool image codex 2>/dev/null || echo codex)"
PROMPT="Edit the attached image and create one raster image with the same aspect ratio. Save it exactly to $OUT.
KEEP IDENTICAL: every building, product, person's identity, outline, storey, window, door, sign position, material and colour of the built fabric, the layout, the camera angle and framing, and the image's illustration or photographic style.
CHANGE ONLY: $CHANGE
No text, captions, labels, logos or watermarks. Do not add or remove buildings or products. Do not commit, push or create git branches."
case "$TOOL" in
  none) echo "SKIP image generation is turned off in settings.json; use the company's own images" >&2; exit 2 ;;
  codex)
    command -v codex >/dev/null || { echo "codex is not installed; install it or set tools.image in settings.json (SETUP.md)" >&2; exit 1; }
    codex exec --enable image_generation -C "$ROOT" --skip-git-repo-check -i "$SRC" -- "\$imagegen $PROMPT" > "$OUT.log" 2>&1 || true ;;
  *)
    # A custom command reads SRC, OUT and PROMPT from the environment and writes OUT.
    SRC="$SRC" OUT="$OUT" PROMPT="$PROMPT" bash -c "$TOOL" > "$OUT.log" 2>&1 || true ;;
esac
if [[ -f "$OUT" ]]; then
  magick "$OUT" -resize "1920x>" -quality 90 -strip "$OUT"
  echo "OK $OUT"
else
  echo "FAIL $OUT (see $OUT.log)" >&2
  exit 1
fi
