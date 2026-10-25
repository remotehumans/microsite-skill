# Design: reverse-engineer their site, then mirror it

The microsite should feel like a page from the company's own website that happens to be about AI. Swapping colours, font and logo into a fixed layout is not enough. One company's skyline, arches or colour blocks are that company's motifs; never reuse them unless a brand genuinely has the same motifs.

## 1. Capture the live site (required)

The page must be built from their real website, seen in a real browser. Nothing else stands in for it: newsletters, PDFs, social posts and memory miss their header, hero, buttons, cards and motion, and the page will not feel like theirs.

```bash
python3 scripts/capture_design.py https://their-site.com PROJECT/design about services
```

It opens a visible browser window (many sites refuse headless browsers), measures their design system with `scripts/design_probe.js` at desktop (1440) and phone size, and saves `design/design.json` plus compressed reference screenshots (`live-desktop.jpg`, `live-desktop-full.jpg`, `live-phone.jpg`). The probe records:

- **type**: the display headline (largest text in the first screen, whatever its tag), h1 to h3, body and nav, with accent colours inside headlines
- **palette by area**: which colours cover most of the page
- **buttons**: shape (pill, round, soft, square) and colours
- **header**: the stacked bars at the top (for example a cream utility bar over a black navigation bar)
- **hero**: photo or not, full width, overlay, frame, text alignment and colour; how the photo is framed (`shown_ratio` against `natural_ratio`, `position`) and the exact shading over it (`shades`: colours and gradients), at desktop and phone size. Copy both exactly: show the photo at the same shape so it is cropped the same, and use their overlay so it is as dark behind the text. Phones often use a different shape and a darker overlay.
- **cards**: images, corners, shadows
- **section bands**: the dark and light rhythm down the page
- **motion**: transitions, timing and easing, keyframes, animation libraries, smooth scroll, reveal on scroll

### Using your agent's own browser

Any browser tool or connector your agent has will do, as long as it can open a page, run JavaScript and take a screenshot. agent-browser only runs the same steps as one command.

1. Open their homepage at desktop size (1440 × 900). Run the whole of `scripts/design_probe.js` in the page; it returns one JSON object. Save it as `PROJECT/design/probe-desktop.json` and save a screenshot of the first screen as `PROJECT/design/live-desktop.jpg`.
2. Do the same at phone size (about 400 × 870): `probe-phone.json` and `live-phone.jpg`.
3. Record the capture: `python3 scripts/capture_design.py URL PROJECT/design --from-probe PROJECT/design/probe-desktop.json --phone-probe PROJECT/design/probe-phone.json`
4. To score your built page, open it the same way at both sizes, run the probe again and save `ours-desktop.json` and `ours-phone.json`, with first-screen screenshots `PROJECT/design/ours-desktop.png` and `ours-phone.png`. Then: `python3 scripts/fidelity.py PROJECT --ours ours-desktop.json ours-phone.json`

Without the screenshots the hero darkness check is skipped; everything else is measured from the probe.

**If the site blocks the browser**, the script stops and prints what to do. Never try to get round a block: no disguised user agents, stealth plugins or proxies, and fetch their images with plain requests. Ask the provider to open the site in their own browser and run `scripts/design_probe.js` there (any browser tool's JavaScript runner or the browser console), then pass the result with `--from-probe probe.json`. If that is not possible, stop and say so; do not build from other material.

Also read the screenshots yourself: the numbers miss motifs, rhythm and mood.

## 2. Write the design brief (design/brief.md, short)

For each item, write what their site does and what the microsite will do:

- **Header**: colour, height, logo treatment, nav case and weight, any rule lines.
- **Hero**: photo-led (use their own photos with `config.hero.variant = "photo"`), illustration-led, or type-led (keep the portrait hero and design its motif from theirs).
- **Type**: heading family (Google Fonts lookalike if licensed), case, weight, letter-spacing; body family and size.
- **Colour roles**: which colour is used for headings, bands, accents, buttons, captions; map onto palette slots (green, blue, red, yellow, teal, orange, dgreen).
- **Shapes**: corners, borders, shadows, dividers; any recurring shape (arches, circles, diagonals).
- **Sections**: band colours and order (e.g. light grey, black, slate), which microsite sections take which band.
- **Components**: how their cards, buttons, captions, lists and icons look; map ours onto theirs (ideas as their cards, CTA as their button).
- **Imagery**: which of their published photos to use, and the credit line.
- **Motifs to drop**: which template motifs don't fit (skyline, arches, colour blocks, playful animation for a sober brand).

## 3. Build their look

**Sprint pages**: set the structure in `company.json → design` (see `sprint/company.schema.md`): a top utility bar, a photo hero with overlay, frame, accent line, second button and tagline, photo cards, a phone Menu button, and motion that matches theirs (reveal on scroll, transition timing and easing, smooth scroll). Then write the project's `theme.css`, which the builder loads last, so it can restyle any part of the page: header bars, type scale, buttons, card shapes, section bands, footer. Use their own photos for the hero and cards. Read the capture's numbers for every value: the overlay colour and gradient, how the photo is framed, the button shape, the bands and the motion timing.

**Other modes**: write `theme.css` in the project and set `config.json → theme`. Implement the brief with overrides on the template's classes. Proven patterns:

- Header: `.top{background:...;border-top:4px solid ...}`, `.top nav a{color:...;text-transform:...}`, logo size.
- Headings: `h2{text-transform:uppercase;color:...}`; hide section numbers with `.sec-head .num{display:none}` when their site has none.
- Square brands: `*{border-radius:0!important}` with exceptions for genuinely round elements (dots, lens circles).
- Buttons: restyle `.cta-btn` to their button exactly.
- Bands: `.band{background:...}`; give a section their dark band (`#team{background:#000;color:#fff}`); a band under the photo hero via `#phero + section.band`.
- Footer: their footer colour and any closing bar (`footer::after`).
- Motion: keep it to the brand's temperament; a sober brand gets fades, not bouncing blocks.

## 4. Score it, then look at it

```bash
python3 scripts/fidelity.py PROJECT
```

It measures the built page with the same probe, scores it against their capture at desktop and phone size (including hero framing and how dark the hero photo is behind the text, measured from the screenshots), writes `design/fidelity.json` and `design/side-by-side.jpg` (their first screen beside ours), and fails below 80/100 or when there is no live capture. Fix every MISS that matters, rebuild and score again. Then look at the side-by-side and a full-page screenshot of both: the score is a floor, not proof. Pass when someone would believe the microsite is a page on their site. Report both scores and show the provider the side-by-side.

A page without a live capture and a passing fidelity score is not ready to send.
