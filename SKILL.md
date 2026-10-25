---
name: microsite
description: Find, qualify and research companies, then create a personalised microsite for each (a 1:1 ABM or pitch page) titled "Prepared for {company}" that shows that business how the provider in the active profile would help them, styled in the company's own brand and built from their public material, and track the outreach in a private gallery. Works for one company, a job application, or a campaign of many companies found from the provider's ideal client. Works for any offer the provider sells (a project, service, retainer, product, audit, workshop or anything else). Use for prospecting and outbound campaigns ("find companies like X", "run a campaign", "find me 10 prospects"), job and contract applications, cold prospects with no brief, warm intros, and walk-in visits; triggers include "microsite", "make a microsite for this company", "make a page for this company", "pitch page", "prepared for", "first 90 days page", "show them how we'd help", a job ad, company URL or recruiter call to turn into a tailored page, or "open the gallery" and "check LinkedIn for my contacts". First-time setup for a new person or business is in SETUP.md.
---

# Microsite

Build one page that makes a specific business feel understood: their brand, their work, their likely pains, an example on their own material, the provider's own offer, and proof. Then deliver it privately. Fictional worked examples, one per page type: `examples/sample-web-studio-page/` (a web design studio's offer), `examples/sample-recruiter-page/` (a recruitment agency's offer) and `examples/sample-sprint/` (a report-style discovery offer).

## 0. Load the profile

The **provider** is the person and business sending the page. Everything about them lives in the active profile (`profiles/<name>/`, chosen in `settings.json` or `MICROSITE_PROFILE`): identity, offers and prices, locked proof and about wording, method, what is worth pursuing, research sources, delivery host, and which skills or connectors handle notes, drafts and transcripts. See `profiles/README.md`.

1. Run `python3 scripts/provider.py show`. If there is no `settings.json`, or the provider is not the person you are working for, stop and follow `SETUP.md`.
2. Run `python3 scripts/doctor.py`. Fix every FIX line before building; OFF lines are optional features to mention in your report.
3. Read the profile's `offers.md` and `notes.md`.

The references use Remote Humans as the worked example. Where they name Elliott, Remote Humans, the Elliott Brain or a Remote Humans link, use the active profile's equivalent: `provider` fields, `offers.json`, `integrations` and `delivery` in `profile.json`, and its `notes.md`. Where `integrations` names a skill your agent does not have, do that step directly with the tools you have, or skip it and say so.

Run every command from this skill's folder. The scripts need Python 3.10+ and ImageMagick; browser, image, Chrome and publishing steps are optional and `doctor.py` says which are on.

## Three ways in, one gallery

Every page belongs to a campaign in the workspace (`settings.json → paths.projects`), and the gallery shows them all. Read `references/campaign.md` first.

| The provider gives you | Campaign mode | What you do |
|---|---|---|
| A job ad, the company, or a recruiter call | `job` (campaign `jobs`) | One page in job mode: their first 90 days |
| One company's website, or a person they met | `one` (campaign `direct`) | Qualify, research, build one page |
| A search with a number: by ideal client, industry, market, place, or staff and revenue ("find me 200 companies that meet our ICP", "find me 150 wellness companies with 5–100 staff and £1–10m revenue", "find me 500 companies in London that match my target customer") | `many` (a named campaign) | Find, screen, qualify and rank many companies, then research and build a page for each `go` (`references/campaign.md`, "Many companies") |

Start with `python3 scripts/campaign.py add <campaign> --name ... --website ...` (create the campaign first with `campaign.py new` if it is missing). The company's project folder is then `<workspace>/<campaign>/microsites/<slug>/`; use it wherever the steps below say project folder. Finish each company by writing its outreach card (`references/outreach.md`), updating its record and running `python3 scripts/campaign.py check <campaign>`.

**The gallery** is the provider's dashboard: every company, its page, research, people, LinkedIn and email, and outreach progress. Start it with `node gallery/server.mjs` and give them `http://127.0.0.1:4347`. Pages are approved and published from there, by the provider.

## 1. Choose the offer

Read `references/modes.md`, the profile's `offers.json` and its `offers.md`. Every page sells one of the provider's own offers: pick the one whose `for` line and `outcome` fit what you found, not the wording of the request, and set it as `offer` in `company.json`. Job and contract applications use the template page in job mode. Walk-in visits add the walk-in pack in `references/delivery.md`.

The offer's `page` decides how the page is built:

| Page type | For | Build |
|---|---|---|
| `standard` | Most offers | `python3 page/build.py PROJECT` (contract: `page/company.schema.md`) |
| `sprint` | A fixed discovery offer whose deliverable is a report | `python3 page/build.py PROJECT`, which hands over to the sprint builder (contract: `sprint/company.schema.md`; read `references/outreach-clarity.md` and `references/sprint-page.md` first) |
| `template` | Job applications and older hand-built offer pages | Steps 5 and 6 below |

## Standard and sprint pages: company file to checked page

For `standard` and `sprint` offers, use this workflow in place of the template build and verify steps below. Keep research and brand discovery, then:

1. Capture their live website: `python3 scripts/capture_design.py URL PROJECT/design` (`references/design.md`). It uses a real browser window. If the site blocks it, stop and ask the provider; never build from newsletters, PDFs or memory in its place.
2. Fill `company.json` from the company's public material. Read `page/company.schema.md` (standard) or `sprint/company.schema.md` (sprint); the matching example shows what each section says, never how the page looks.
3. Build their look from the capture: `company.json → design` (top bar, photo hero, photo cards, motion) and the project's `theme.css` (loaded last; restyle anything). Use their own photos.
4. The offer's wording, price and button come from the profile's `offers.json`; proof, about facts and logos from its locked `claims.json` (sprint pages also take scope, method and report defaults from there).
5. Sprint pages only: prepare story stickers once with `python3 sprint/prepare_art.py story`. For new paper art use `python3 sprint/prepare_art.py normalise input.png assets/art/name.png`; for other illustrations use `sticker` in place of `normalise`. For white-backed logos use `logo`. Only photos may come from outside `assets/art/` and the profile's `art/`.
6. Build: `python3 page/build.py /path/to/project`. It assembles the sections for the offer's page type, runs lint and writes `build/<slug>.html` only after PASS.
7. Lint runs inside the build: resolve every failure it names in the source (`company.json`, the offer, or `claims.json` with the provider's say-so), then rebuild.
8. Fidelity: `python3 scripts/fidelity.py /path/to/project`. It must pass (80/100 or more at desktop and phone) and the side-by-side must look like their site. Fix and rebuild until both are true.
9. QA: `python3 sprint/qa_sprint.py /path/to/project/build/<slug>.html`. Use `--reference /read-only/golden.html` for section captures of both pages. Review `qa/results.json` and `qa/contact-sheet.png` at 1440 and 390 wide. If the browser tool cannot start, report the skip explicitly; visual QA remains unverified.
10. Deliver the checked HTML and a concise review note. State lint, fidelity and QA results, source dates and any intentional differences. Follow the delivery rules below for publication or sending.

Never patch compiled HTML. Edit company slots, the offer or locked claims with the provider's direction, or shared components, and rebuild.

## 2. Qualify before building

Use the profile's `qualification` (`python3 scripts/provider.py get qualification`).

- **With a brief** (job ad, recruiter call, enquiry): process any call recording with the profile's `integrations.transcription`, file it with `integrations.memory`, and evaluate fit against `qualification.goals`.
- **Without a brief** (a business the provider found): read them from the outside using `references/research.md` and infer the brief. Score every `qualification.criteria` on its `scale` against the `icp`, apply any `hard_no`, and report the total against `go_threshold` with a go or no-go before building.

Stop and ask the provider only for the consequential gaps in `qualification.ask_before_building`.

## 3. Research them like a client

Besides the steps below, every company gets three things from `references/research.md`: **can they pay** (their filed accounts, with the period), **why now** (dated buying signals), and **culture** (how they think and talk, used for the page's tone and the message).

Follow `references/research.md` with the profile's enabled `research.sources`: confirm the decision-maker from two independent sources, the company register, public documents for their sector, reviews, job ads, stakeholders, and 5–8 use cases ranked by the three lenses (increasing revenue, reducing costs, saving time). Every fact cites a source and a date; label inference as inference. Then fill the specific gaps that block qualifying, reaching the decision-maker or building the page with the profile's `integrations.research_data` connector (Treg by default), following `references/enrichment.md`: free saved sources first, verify every provider result against an original source, keep a cost ledger, and never contact anyone. In UK job mode, add `scripts/rate_maths.py` for IR35 and budget views (`references/money.md`).

## 3b. Place them

Read `references/location.md`. Set `config.json → locale` (country, currency, language, postcode), run `scripts/local_entities.py` on their address (UK postcode or `lat,lon`), and add the "local to you" section built from 3–4 curated, linked local entities, how the provider can work with them in person, and local FAQs. The page should only make sense for their place. Prices follow their currency via `{{PRICE:offer}}`; report any live-rate NOTE to the provider and ask for an official price.

## 4. Reverse-engineer their design

Read `references/design.md`. The microsite must look and feel like a page from their own website, including its motion, so never just reskin the template. The live site must be seen: run `scripts/capture_design.py` (a real browser window; desktop and phone measurements of type, colours, buttons, header, hero, cards, bands and motion, plus reference screenshots; if the site blocks it, stop and ask the provider) and `scripts/extract_brand.py`, write a short design brief (header, hero, type, colour roles, shapes, bands, components, imagery, motifs to drop), then implement it as the project's `theme.css` (`config.json → theme`), using a photo-led hero (`config.hero`) when their site opens on photography. Another company's motifs, such as a skyline, arches or colour blocks, are never defaults. Finish with `scripts/fidelity.py` (80/100 or more at desktop and phone) and a look at the side-by-side; it passes when the two look like one site.

## 5. Build the page

Read `references/page.md` and the profile's `method.md`. Use the company's project folder from `campaign.py add` (`<workspace>/<campaign>/microsites/<slug>/`), with `images/` holding their logo and any images, then:

- Copy `templates/page.src.html` (the neutral starter) and fill every `[[PLACEHOLDER]]` for this company and mode. Provider details fill themselves from the profile through `{{PROVIDER:key}}` tokens. The builder refuses to output a page with any placeholder or token left.
- Copy any section you need to rewrite from `templates/sections/` into the project (`building-blocks.html` in job mode always needs their before/after; sprint mode uses `building-blocks-sprint.html`; `reimagined-visuals.html` when visual). Sections you don't copy are read from the profile's `sections/` folder if it has one, then from the templates.
- An offer on the template page replaces the job-mode plan block with its own section from the profile's `sections/` via `{"file": ..., "replace": "sprint"}`; drop sections with `{"drop": "plan"}`. The section files in `templates/sections/` are worked examples to copy and rewrite in the provider's words.
- Choose proof by id in `config.json → proof`, sector-closest first (the profile's `notes.md` lists picks per sector): any story id in the profile's `proof/stories.json` (refresh from the provider's site with `scripts/sync_proof.py`) or a custom slide in its `proof/custom/`.
- Start from `templates/config.sprint.example.json` (or a job-mode example's `config.json` where your copy has one), then build:

```bash
python3 scripts/build_page.py /path/to/project
```

Make one "wow from their own material" moment (`references/visuals.md`): AI variations of their published imagery, a worked example on their public documents, or a short film. Use `scripts/image_variation.sh` for images (the tool in `settings.json → tools.image`; no paid APIs unless the provider asks) and the profile's `integrations.film` for film.

## 6. Verify

Standard and sprint pages are linted by their build and checked with `sprint/qa_sprint.py` above. For template pages, run the checklist in `references/page.md` and the side-by-side design check in `references/design.md`: facts traced, no slop phrases, sources clickable and returning 200, AI visuals checked against originals for fidelity, desktop and iPhone rendering in the browser tool, carousel and sliders working.

## 7. Deliver

Follow `references/delivery.md`, then `references/outreach.md` for the card, the outreach kit and the steps the provider takes: connect on LinkedIn without a note, message once they accept, then share the page with a Loom and, for the best fits, a handwritten note. Publishing, sending and posting need the provider's explicit approval each time; the gallery's Deploy button is that approval for publishing. Default delivery is a private noindexed link at `{delivery.public_base_url}/{slug}` via `scripts/deploy_private.sh`, plus a share preview image, a note drafted with the profile's `integrations.writing_voice`, and, for walk-ins, the printed leave-behind with a QR code. With no website repo set up, hand the provider the self-contained HTML file. File the outcome where `integrations.memory` says.

## Rules that always apply

- Honesty: only facts from the provider's CV, their memory (`integrations.memory`), the profile, or cited public sources. Use the locked proof wording in the profile's `claims.json`; on template pages, use "helped" or "co-built" for shared work. Label AI visuals as concepts based on the company's material, for illustration only.
- Voice: follow the profile's `voice` rules. Never use "not X, not Y" / "X, not Y" / "You don't need X. You need Y." constructions, hype-versus-real framing or AI-cliché names. Sprint lint enforces no em dashes, no "not X, Y" constructions, the reading level and the claims' banned and hedge phrases.
- Respect intermediaries: when an agency represents the provider, send material through them and never approach their client around them.
- Privacy: business information only; no profiling of private individuals beyond public business roles.
- LinkedIn: use only the provider's own signed-in browser, and follow the safe-use rules in `references/linkedin.md` every time: lists before profiles, at most five profiles a session, a person's pace with no rapid bursts of requests, never in parallel, and stop at the first warning. Their account is at stake.
- Never send, publish, post or contact anyone without the provider's explicit approval for that action.
