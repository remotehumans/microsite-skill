#!/bin/bash
# ABOUTME: Optional: captures 1440x960 desktop thumbnails of built pages into each campaign's gallery/thumbs/ for the cards (needs agent-browser and a running gallery).
# ABOUTME: Skips pages whose thumbnail is newer than the page. Without it, cards use the page's saved QA or design screenshots.
set -euo pipefail
port="${PORT:-4347}"
ids=$(curl -s "http://127.0.0.1:$port/api/gallery" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const g=JSON.parse(s);
for(const r of g.rows)if(r.page&&!r.thumb)console.log(r.collection_id+" "+(r.page_slug||r.source_id)+" "+r.page);});')
[ -z "$ids" ] && { echo "All thumbnails current"; exit 0; }
agent-browser --session thumbs set viewport 1440 960 >/dev/null
workspace=$(curl -s "http://127.0.0.1:$port/api/workspace")
while read -r campaign slug page; do
  mkdir -p "$workspace/$campaign/gallery/thumbs"
  agent-browser --session thumbs open "http://127.0.0.1:$port/collections/$campaign/$page" >/dev/null
  sleep 3
  agent-browser --session thumbs screenshot "$workspace/$campaign/gallery/thumbs/$slug.png" >/dev/null && echo "thumb $slug"
done <<< "$ids"
agent-browser --session thumbs close >/dev/null 2>&1 || true
