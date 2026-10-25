# AI Design Sprint component workflow

The sprint page structure (see the fictional `examples/sample-sprint/`) is the reference for **what each section says and in what order**, never for how the page looks. Every sprint page takes its look from the company's own live website: their header, hero, type, colours, buttons, cards, bands and motion (`design.md`). A page that looks like the sample page in another company's colours has failed. The layout and image logic live in `sprint/components.py`, `sprint/sprint.css`, `sprint/sprint.js` and `sprint/prepare_art.py`.

## Inputs and build

Read `outreach-clarity.md` for the 30-second owner test and the split between research and page copy. This document takes precedence where older advice conflicts with the rules below. Then read `company-file.md` and `sprint/company.schema.md`.

A project has one `company.json`. It supplies brand roles, fonts, logo, hero, goal, linked and dated facts, first areas to explore, a real example route, one public percentage, tools, team-data path and call URL. Use the fictional `examples/sample-sprint/` as the worked example.

The active profile's `claims.json` locks scope, price key, six proof tiles, about facts, client logos, four method steps, six story beats, report defaults and copy rules. Only the provider changes those claims. The builder reads the actual price from the profile's `offers.json` and imports the existing image, price and booking helpers from `scripts/build_page.py`.

Run from the skill folder:

```bash
python3 sprint/prepare_art.py story
python3 sprint/build_sprint.py /path/to/project
python3 sprint/lint_sprint.py /path/to/project/build/slug.html
python3 sprint/qa_sprint.py /path/to/project/build/slug.html
```

Correct sources and rebuild after every change. Never post-patch compiled HTML. A blank slot, token, missing asset, unavailable official price or lint failure stops the build.

## Scope and copy

- The sprint understands how work gets done, finds where AI could help and shows what changes and how. It ends with discovery, design and a report.
- Coaching, training and implementation appear only in a not-included table row. The sole exception is the exact locked historical Beazley proof, which mentions internal training. It never adds training to the sprint offer.
- Use short sentences, common words and contractions such as "I've". Say "solutions". State results plainly. Avoid hedges, disclaimers about results, invented codes and "not X, Y" or "X, not Y" copy. Use British English and no em dashes.
- Show concepts as charts, tables, steps or tick lists. A report paragraph has at most two short sentences and 40 words.
- The Flesch-Kincaid ceiling is grade 5. The bundled heuristic measures the golden page at 3.21 and the rebuilt example at 3.13. It treats chart labels and headings as text blocks and ignores scripts, styles and head metadata. The metric is a consistent copy gate, not a substitute for reading the page.
- The real public percentage is linked and dated. Sample hours, savings, rankings and positions carry an example label. Never invent a result or promise an uplift.

## Sections

Keep the section order: header, hero, noticed facts, work cards, example tabs, method story, people, report, proof, about, offer, footer. Their look comes from `company.json → design` (structure: top bar, photo hero, photo cards, motion) and the project's `theme.css` (everything else), both built from the live capture.

- **Hero:** their goal and outcome, one line explaining the sprint, one CTA and their real image.
- **Noticed:** three linked, dated facts from their material.
- **Work:** first areas to explore, with revenue first.
- **Example:** three tabs tied to their own material, from the published fact to what the sprint explores.
- **Method:** six beats, with sticky transparent art: listen, capture knowledge, map workflows, draw process maps, rank opportunities, set out the roadmap. Four offer steps: agree goals, map work, match and design, walk through the report.
- **People:** a names-free group map from the unchanged team JSON. Count the dots and tech mentions from data, with yellow for tech mentions and a computed "6 in 14" style stat. Four promises: keep expertise; start with your people; show what changes; work well apart. The four-week timeline contains only Listen, Map the work, Rank the opportunities, Walk through the report.
- **Offer:** current official price, four included sprint steps and Build the solutions as a not-included row. No second offer or price.

## Report book

Use the shared `assets/vendor/page-flip-2.0.7.browser.js`, with page dragging and arrow buttons. Include a full-size reader. Do not add a download.

The golden has 14 pages: cover, 12 inside pages, back page. This resolves the brief's shorthand "12 sample pages" while retaining every listed concept:

1. Cover, with company name and AI Design Sprint Report masthead.
2. Goal, with Look, Choose, Plan cards.
3. One real company percentage, as a 100-square waffle chart, with source and date.
4. Route steps, with the stopped-here callout.
5. Hours bar chart, tagged "Example numbers · not yours".
6. AI versus people table. Rule: "AI never changes the books or emails a client on its own".
7. Priorities in a 2x2 chart.
8. Ranked solutions table, with value, effort and risk.
9. Before and after saving, tagged as example numbers.
10. Tools table: what we know, what we do.
11. Rules as ticks.
12. Roadmap: Now, Next, Then.
13. How to start, in three steps.
14. What you keep, as an included and not-included tick table.

Report slots come from the company file, with shared defaults from claims. Page count, sample labels and the AI safety rule are locked.

## Proof and about

The proof band uses alabaster `#F2F0E9`, Remote Humans orange `#E04F18` and ink `#0F0F0D`. Heading: "I've done this kind of work before." Use the profile's `proof_art` image (Remote Humans: `proofs-collage` in the profile's `art/`) and six number tiles with the exact claim wording:

| Result | Context |
| --- | --- |
| 36 days cut to a few hours | Shopify product work |
| 1,000+ messages a week drafted by AI and checked by a person; three planned hires avoided | Private equity client service |
| 3 days, down from 2 weeks | Luxury hotel group audit app |
| 21 hands-on sessions over three days for 30+ people, associates to C-suite, using Claude and Replit | Private equity AI residency |
| 100+ on the waitlist; 14 founding users in two weeks | Social wellness app |
| 1 innovation report supporting the business case for internal training, presented by the innovation manager to the CEO and C-suite | Beazley |

About begins with the profile's `about.heading` (for example "Hi, I'm Priya."). Use the profile's real photo as a plain framed photo. Show the three facts from `claims.json → about.facts`. Label logos "I've run learning and consulting programmes for". End with a link to the offer.

## Art and privacy

Every non-photo image is a PNG with alpha or SVG inside `assets/art/`. This includes company and client logos, story art, report cover art and the proof collage. Photos stay plain framed and are marked `data-photo="true"`; never use the photo marker to exempt an illustration.

`prepare_art.py story` seals small gaps with diamond dilation, finds the outside from border pixels, erodes that outside with the equivalent of `border_value=1`, keeps a thin halo, softens the edge and zeros the border strip. It uses only the Python standard library and ImageMagick.

For generated paper art, run `prepare_art.py normalise input.png assets/art/name.png`. It divides by the sampled paper colour, levels to white, then makes a transparent sticker. Use `sticker` directly for art that already has the right colour. Use `logo` for white-backed logos; it keys only white and keeps coloured fills intact. Existing alpha is preserved during normalisation and sticker preparation. No cream rectangles.

Use only business details on each person's own team page. No family details. The map emits no names, profiles, photos, locations or LinkedIn links. Any later LinkedIn feature must match the decoded slug to the person's name; never substitute another person's or the company's profile.

## Gates and delivery

Lint checks sprint scope, locked claims, banned and hedge phrases, vocabulary, em dashes, contrast copy, reading grade, report paragraph length, image formats, alt attributes and unreplaced tokens. It exits non-zero with a clear failure list.

QA uses the browser tool (default agent-browser) at 1440 and 390 wide. It scrolls to and captures every section, checks document width, image loading, book page count, tab changes, page turning, reader pages and console errors. It makes a labelled contact sheet with `magick montage` and saves results in the project's `qa/` folder. Add `--reference /read-only/golden.html` to capture both pages into the rebuilt project's QA folder. Never write QA files beside a read-only reference.

A browser startup block is recorded as SKIP with exit code 2. Report it; do not claim visual parity or a QA PASS. Later interaction, browser or image errors are failures. Check the screenshots section by section before delivery and report intentional differences. Publication and sending still follow the main skill's delivery rules.
