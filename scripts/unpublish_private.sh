#!/usr/bin/env bash
# ABOUTME: Removes a private microsite from the profile's page URL and redeploys the site.
# ABOUTME: Usage: unpublish_private.sh SLUG  — run only after the provider approves taking the page down.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SLUG="$1"
eval "$(python3 "$HERE/provider.py" env)"
[[ -n "$SITE" && -d "$SITE/.git" ]] || { echo "Set paths.site_repo in settings.json to your website's git repo (SETUP.md, step 6)" >&2; exit 1; }
[[ "$(git -C "$SITE" branch --show-current)" == "$BRANCH" ]] || { echo "$SITE is not on $BRANCH; switch branch before publishing" >&2; exit 1; }
REL="${PUBLISH_SUBDIR:+$PUBLISH_SUBDIR/}$SLUG"
[[ -d "$SITE/$REL" ]] || { echo "No page at $REL" >&2; exit 1; }
cd "$SITE"
git pull -q --rebase
git restore --staged :/ 2>/dev/null || true
git rm -rq "$REL"
git commit -q -m "Remove private microsite for $SLUG"
git push -q origin "$BRANCH"
case "$HOOK_TYPE" in
  coolify) coolify deploy uuid "$HOOK_ID" >/dev/null ;;
  webhook) curl -fsS -X POST "$HOOK_ID" >/dev/null ;;
  none) ;;
  *) echo "Unknown deploy_hook type: $HOOK_TYPE" >&2; exit 1 ;;
esac
for i in $(seq 1 40); do
  [[ "$(curl -sL -o /dev/null -w '%{http_code}' "$BASE_URL/$SLUG")" == "404" ]] && { echo "REMOVED $BASE_URL/$SLUG"; exit 0; }
  sleep 15
done
echo "Still reachable: check your host's deploy log" >&2; exit 1
