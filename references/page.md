# Building the page

## Structure (sections in the template, top to bottom)

The structure is shared; the look is not. Every section is restyled through the project theme to match their site (`design.md`).

1. Sticky header with their logo and a section nav; rainbow progress bar in their colours.
2. Hero: eyebrow "Prepared for {company}", title for the mode, one-line promise, byline "By {person}, {byline} · {Month Year}" from the profile, the provider's photo in one of *their* shape motifs (for a brand built on arches: an arch), their skyline or pattern building itself.
3. Lead line (no "you don't need X" construction).
4. `sections/building-blocks.html` (job mode) or `sections/building-blocks-sprint.html` (sprint mode): the tower that stacks floor by floor; in job mode, plus a "One task, before and after" wipe rewritten for one of their workflows.
5. The offer's method as stepped blocks (Remote Humans: Map, Match, Make, Measure); data look; outputs.
6. Ideas from the outside: 6–8 tiles.
7. Worked example on their public material: real numbers, a "where it's answered" table, next steps; sources linked.
8. `sections/reimagined-visuals.html` when they are visual: time-of-day slider, season switcher, sketch-to-scene wipe, film link.
9. How we work: three parts (People first; Understand the business with the five functions street, three lenses, function → workflow → task, how the change unfolds; Build it with you).
10. Bringing the whole team with you: enablement tiles and the side-by-side sessions panel.
11. Timeline for the mode; what success looks like.
12. `sections/things-built.html`: proof carousel from the profile's `proof/` library (`config.proof`, else `proof_default`) with real logos, iPhone frames, "Built with" lines, and the tools strip; link to the profile's results page.
13. About the provider: photo, bio and highlights from `profile.json`, with the business name linked to the results page.
14. Footer: contact, "Prepared independently for {company} using public information only. The {company} name and logo belong to {company}."

Drop sections that don't fit the mode (see `modes.md`). Section numbers are automatic (CSS counter).

## Tokens in templates

`{{LOGO}}` their logo (config.logo), `{{PHOTO}}` the provider's photo, `{{PROVIDER:key}}` profile fields (person, first_name, business, byline, email, results_url, bio_html, highlights_html, contact_html, public_base_url and others in `profile.json` provider), `{{BOOK:offer}}` an offer's booking link, `{{CLIENT_LOGOS}}` the profile's client logos, `{{IMG:name}}` project images from config.images, `{{PROOF:file}}` images in the profile's `proof/`, `{{LOGOIMG:name}}` product logos (squuaad-wordmark, distil-icon), `{{TOOL:slug:Label}}` Simple Icons in `assets/logos`, `{{TOOLPNG:file:Label}}` PNG logos (hermes-wordmark, hyperframes, fish), `{{PROOF_CAROUSEL}}` the carousel generated from `config.proof`. Text placeholders use `[[...]]`. The builder fails on any unreplaced token or placeholder.

## Brand fonts

Licensed fonts (ITC Lubalin, Gotham, Brandon, Futura PT and so on) cannot be embedded. Pick a free Google Fonts lookalike and set `config.font` (`family` plus the `google` CSS URL); the builder swaps it in everywhere. Examples: ITC Lubalin → Arvo; Gotham → Montserrat; Futura → Jost; Brandon Grotesque → Josefin Sans; Didot or Bodoni → Playfair Display.

## Shapes

Echo one of their shapes through `extra_css`: arches for a brand that uses them, plain rectangles for a classic agency (`.portrait .arch,.about .ph2,.roof{border-radius:0}`), circles for a playful brand.

## config.json

`out`, `page`, `logo` (project-relative), `font` (Google Fonts swap), `theme` (project CSS file mirroring their site, see `design.md`), `hero` (`{"variant": "photo", "images": [...], "credit": "..."}` for photo-led sites), `extra_css` (small extra touches), `palette` (map their colours onto green, blue, red, yellow, teal, orange, dgreen), `images` (name → project-relative path for `{{IMG:name}}`), `proof` (ids), `sections` (each `{file, before}`, `{file, replace}` or `{drop}`).

## Proof by sector

The active profile's `notes.md` lists which proof ids to lead with for each kind of prospect.

To add a tool logo, download it from `https://cdn.jsdelivr.net/npm/simple-icons@15.22.0/icons/<slug>.svg` into `assets/logos/` and add its hover colour to `BRAND` in `scripts/build_page.py`. Keep logos monochrome with brand colour on hover; light gradient PNGs go in `SILHOUETTE`.

## Proof facts

Use only the proof facts in the active profile's `notes.md` and `claims.json`, with their exact wording rules (for example "co-built" for shared work). Do not inflate.

## Verification checklist

- Every claim traces to the provider's CV, their memory (profile `integrations.memory`) or a linked public source; inference is labelled.
- Slop sweep: search the built page for ", not ", "Not ", "don't need", "forward", "unlock", "leverage", "game-chang", and em dashes; rewrite as plain positive statements (factual quotes excepted).
- Every external link returns 200 (`curl -sL -o /dev/null -w '%{http_code}'`).
- AI visuals: compare each against its source; discard any where the structure changed.
- Render in the browser tool (settings `tools.browser`, default agent-browser) on desktop (1280) and `set device "iPhone 16 Pro"`; confirm no horizontal scroll (`scrollWidth == innerWidth`), tabs, sliders and wipes work, and the page has loaded fully before screenshots (set `scrollBehavior='auto'` before programmatic scrolling).
- Page weight: keep under ~8 MB; images are re-encoded by the builder.
