#!/usr/bin/env bash
# ABOUTME: Publishes a built page (plus optional og.jpg and extra files) to the profile's private page URL, noindexed, via a static-site git repo.
# ABOUTME: Usage: deploy_private.sh SLUG PAGE.html [extra files...]  — run only after the provider approves publishing. Host comes from profile.json delivery and settings.json paths.site_repo.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
abspath() { (cd "$(dirname "$1")" && echo "$(pwd)/$(basename "$1")"); }
SLUG="$1"; PAGE="$(abspath "$2")"; shift 2   # absolute, because the script later changes into the website repo
eval "$(python3 "$HERE/provider.py" env)"
[[ -n "$SITE" && -d "$SITE/.git" ]] || { echo "Set paths.site_repo in settings.json to your website's git repo (SETUP.md, step 6)" >&2; exit 1; }
[[ "$(git -C "$SITE" branch --show-current)" == "$BRANCH" ]] || { echo "$SITE is not on $BRANCH; switch branch before publishing" >&2; exit 1; }
URL="$BASE_URL/$SLUG"
DEST="$SITE/${PUBLISH_SUBDIR:+$PUBLISH_SUBDIR/}$SLUG"
URL_PATH="/${BASE_URL#*://*/}/"

if [[ -n "$NGINX_CHECK" ]]; then
  grep -q "location \^~ $URL_PATH" "$SITE/$NGINX_CHECK" || { echo "$NGINX_CHECK has no $URL_PATH noindex block; add it first (see references/delivery.md)" >&2; exit 1; }
fi
grep -q '<meta name="robots" content="noindex' "$PAGE" || { echo "Page is missing the robots noindex meta tag" >&2; exit 1; }

EXTRA=(); for f in "$@"; do EXTRA+=("$(abspath "$f")"); done
# Pull before copying: updating an existing page would otherwise leave unstaged changes that block the rebase.
git -C "$SITE" pull -q --rebase
mkdir -p "$DEST"
cp "$PAGE" "$DEST/index.html"
for f in ${EXTRA[@]+"${EXTRA[@]}"}; do cp "$f" "$DEST/"; done

cd "$SITE"
git restore --staged :/ 2>/dev/null || true
git add "${DEST#"$SITE"/}"
git commit -q -m "Add private microsite for $SLUG"
git push -q origin "$BRANCH"
case "$HOOK_TYPE" in
  coolify) coolify deploy uuid "$HOOK_ID" >/dev/null ;;
  webhook) curl -fsS -X POST "$HOOK_ID" >/dev/null ;;
  none) ;;  # the host deploys on push (Netlify, Vercel, Cloudflare Pages, GitHub Pages)
  *) echo "Unknown deploy_hook type: $HOOK_TYPE" >&2; exit 1 ;;
esac

# Some hosts answer unknown paths with the site shell, so wait for content unique to this page.
MARK=$(grep -o '<title>[^<]*</title>' "$PAGE" | head -1)
[[ -n "$MARK" ]] || { echo "Page has no <title>; cannot confirm it is live" >&2; exit 1; }
for i in $(seq 1 60); do
  curl -sL "$URL" | grep -qF "$MARK" && break
  sleep 15
done
curl -sIL "$URL" | grep -iE "^HTTP|x-robots-tag" || true
curl -sL "$URL" | grep -qF "$MARK" && echo "LIVE $URL" || { echo "Not live yet: check your host's deploy log" >&2; exit 1; }
curl -sIL "$URL" | grep -qi "x-robots-tag: noindex" || echo "WARNING: no X-Robots-Tag noindex header; the page relies on its meta tag" >&2
if [[ -n "$SITEMAP_URL" ]]; then
  curl -s "$SITEMAP_URL" | grep -q "$URL_PATH$SLUG" && echo "WARNING: page appears in sitemap" >&2 || echo "Not in sitemap"
fi
