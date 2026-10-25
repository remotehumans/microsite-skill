#!/usr/bin/env bash
# ABOUTME: Builds a clean, shareable zip of the microsite skill: code, guides, the blank template and the fictional sample, without the owner's profile, settings or real prospect examples.
# ABOUTME: Usage: bash scripts/package.sh  -> dist/microsite-skill-YYYY-MM-DD.zip, then unpacks it in a temp folder and runs the doctor, tests and a leak scan there.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d)"
OUT="$SKILL/dist/microsite-skill-$STAMP.zip"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/microsite"
mkdir -p "$STAGE" "$SKILL/dist"

# Everything except private profiles, machine settings, real prospect material, build output and old files.
rsync -a "$SKILL/" "$STAGE/" \
  --exclude 'dist/' --exclude 'settings.json' --exclude 'leak-patterns.txt' --exclude 'node_modules/' --exclude 'thumbs/' --exclude '.gallery/' --exclude '__pycache__/' --exclude '.DS_Store' --exclude '*.log' \
  --exclude 'build/' --exclude 'qa/' \
  --exclude 'scripts/check_sprint_page.py' --exclude 'templates/report/' \
  --exclude 'references/example-london-placemaking.md' \
  --exclude 'assets/art/*-logo.*'
# Keep only the blank template and the fictional sample profile.
find "$STAGE/profiles" -mindepth 1 -maxdepth 1 -type d ! -name '_template' ! -name 'sample-studio' ! -name 'sample-web-studio' ! -name 'sample-recruiter' -exec rm -rf {} +
# Keep only the fictional sample example.
find "$STAGE/examples" -mindepth 1 -maxdepth 1 -type d ! -name 'sample-sprint' ! -name 'sample-campaign' ! -name 'sample-web-studio-page' ! -name 'sample-recruiter-page' -exec rm -rf {} +

echo "Checking the packaged copy..."
cd "$STAGE"
fail() { echo "PACKAGE CHECK FAILED: $1" >&2; exit 1; }
# Nothing personal or from real prospects may travel.
# Your own names, emails, phone numbers and prospects go one per line in leak-patterns.txt beside settings.json. It is never packaged.
PATTERNS='/Users/'
[[ -f "$SKILL/leak-patterns.txt" ]] && PATTERNS="$PATTERNS|$(grep -v '^#' "$SKILL/leak-patterns.txt" | grep -v '^$' | paste -sd'|' -)"
LEAKS="$(grep -rIlE --exclude=package.sh "$PATTERNS" . || true)"
[[ -z "$LEAKS" ]] || fail "personal or prospect details in: $LEAKS"
[[ ! -e profiles/remote-humans ]] || fail "owner profile still present"
python3 scripts/doctor.py --smoke > "$WORK/doctor.txt" 2>&1 || true
grep -q "Ready to build." "$WORK/doctor.txt" || { cat "$WORK/doctor.txt"; fail "doctor smoke build"; }
(cd sprint && python3 -m unittest test_pipeline test_design > "$WORK/unit.txt" 2>&1) || { tail -20 "$WORK/unit.txt"; fail "sprint tests"; }
python3 scripts/test_portability.py > "$WORK/portability.txt" 2>&1 || { tail -20 "$WORK/portability.txt"; fail "portability tests"; }
python3 page/test_page.py > "$WORK/page.txt" 2>&1 || { tail -20 "$WORK/page.txt"; fail "offer page tests"; }
python3 scripts/test_campaign.py > "$WORK/campaign.txt" 2>&1 || { tail -20 "$WORK/campaign.txt"; fail "campaign tests"; }
MICROSITE_WORKSPACE="$WORK/no-workspace" node --test gallery/ > "$WORK/gallery.txt" 2>&1 || { tail -30 "$WORK/gallery.txt"; fail "gallery tests"; }
find . -name '__pycache__' -type d -exec rm -rf {} + ; find . -name 'build' -type d -prune -exec rm -rf {} +

rm -f "$OUT"
(cd "$WORK" && zip -qr "$OUT" microsite)
echo "PASS: doctor, offer page, sprint, portability, campaign and gallery tests, and leak scan on the packaged copy."
echo "Wrote $OUT ($(du -h "$OUT" | cut -f1)). Share this file; unzip it into the agent's skills folder and follow microsite/SETUP.md."
