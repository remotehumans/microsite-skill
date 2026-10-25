# The "wow from their own material" moment

Pick one or two that fit the business. Build only from material they have published; label every output as an AI concept for illustration.

| Business type | Strong options |
|---|---|
| Architects, developers, property | Time-of-day slider and seasons switcher on their published CGIs; sketch-to-scene wipe; a short "day in the life" film; worked example on planning documents |
| Estate and letting agents | Listing photos re-lit (dusk exterior, staged-feel interior); a before/after of the viewing-request workflow; review-pattern analysis |
| Hospitality, retail, food | Seasonal or event versions of their venue photos; menu or product shots in new settings; review themes |
| Professional services (accountants, law, consultancies) | Worked example on their public content or a regulator's guidance; before/after of client onboarding; a sample client-update draft |
| Trades and maintenance | Before/after of quoting from a photo; job-sheet to invoice flow; review themes |

## Image variations

`scripts/image_variation.sh SOURCE.png OUT.png "change only: ..."` uses the image tool in `settings.json` (`tools.image`: `codex` for Codex image generation on a ChatGPT subscription, a custom command, or `none`). Run several in parallel in the background. Never use paid image APIs unless the provider asks. After generation, view each beside its source and discard any that changed structure, added text or watermarks, or look uncanny.

## Film

Use the `hyperframes` skill (general-video workflow, automation flow). A pattern that has worked: 37 seconds, 1920×1080, silent with captions, scenes for title, day, seasons, sketch-to-scene and an end card with "{title} · {person}, {business}" and the AI-concept note. Render locally, then re-encode for sharing:

```bash
ffmpeg -i film.mp4 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -an film-share.mp4
```

Link the film from the page with an absolute URL once it is hosted beside the page.

## App proof

For squuaad and distil, use current screenshots. distil can be captured from the simulator with launch arguments (`--uitesting --distilling-test`, add `--light-test` for light mode) and `xcrun simctl io <device> screenshot`. Demo videos from real iPhone recordings are a planned upgrade.
