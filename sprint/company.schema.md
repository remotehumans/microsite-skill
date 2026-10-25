# Company file contract

One `company.json` supplies company slots. Shared claims and layouts live in `sprint/`. Paths are relative to the company file, except `team_json`, which may be absolute. Use UTF-8 and British English. No em dashes, raw HTML, blank fields, nulls, TODOs or template tokens.

| Required field | Shape and purpose |
| --- | --- |
| `slug`, `name` | Lower-case hyphenated slug; real trading name |
| `prepared_date` | Visible month and year, such as `October 2026` |
| `brand.colours` | Six-digit hex values for `teal`, `deep`, `yellow`, `ink`, `muted`, `paper`, `navy`, `soft`, `pale`, `line`. These are CSS roles, even when the brand uses other hues. |
| `brand.fonts` | `body`, `heading`, `google_url`. Use plain family names and a Google Fonts stylesheet URL containing both families and all used weights. |
| `logo` | Path to a PNG with alpha or an SVG in the project's `art/` folder (or this skill's `assets/art/`). It appears in the header, large on the report cover and small in each report page footer. Optional `logo_on_light`: a dark version for the light report pages when their main logo is white. |
| `hero` | `path`, `alt`, `photo` boolean. A real photo may sit in the project. Art must sit in `assets/art/`. |
| `goal` | `headline`, `lead`, `report`. Their goal and the work outcome, using short sentences. |
| `noticed` | Three facts: `date` as `YYYY-MM-DD`, exact `url`, `text` |
| `noticed_summary` | One short outside view that links the facts to the goal |
| `look_at_first` | Three to five cards, each with `title` and `text`. Revenue first. |
| `example` | `heading`, `lead`, `source_label`, `source_url`, three `tabs`, `route_heading`, `route`, `stopped_at`, `stopped_callout` |
| `example.tabs[]` | `title`, `published`, `explore`. The published claim comes from the linked company source. |
| `example.route[]` | `name`, `text`, `ai`, `person`, positive `example_hours`. Hours are sample numbers. |
| `example.stopped_at` | One-based route step used by the stopped-here callout |
| `public_number` | `value` from 0 to 100, `unit` as `%`, `label`, `period`, exact `url`, ISO `date`, `source_label`, `square_label`. One real company percentage for the 100-square waffle. |
| `tools` | Rows with `name`, `known`, `action`. Public tool claims also carry `source_url` and ISO `date`. A row for tools found in interviews needs no public source. |
| `method_intro` | People and teams whose work the sprint follows |
| `team_json` | Read-only path to the existing team data. Never rewrite the Team tab or its data. |
| `call_url` | Optional. HTTPS booking URL with no query; leave it out to use the offer's `booking_url` in the profile's `offers.json`. The shared helper adds company tracking. |
| `currency` | A currency with an official sprint price in the profile's `offers.json`. A missing price stops the build. |

## Optional design slots (their look)

`design` turns on structure that mirrors the company's own site. Build it from `design/design.json` (the live capture), then write the project's `theme.css`, which the builder loads last.

- `header.topbar`: items for a utility bar above the main header, each `{text, href?, kind}` with `kind` `text`, `link` or `button`.
- `header.phone_menu`: `true` to fold the navigation behind a Menu button on phones.
- `hero.layout`: `photo` for a full-width photo hero with an overlay (default `stacked`). With it: `frame` (thin border box), `accent: "second-line"` (sets the headline after its first full stop in the accent colour), `secondary` `{text, href}` (a second button) and `tagline`.
- `look_at_first[].image`: `{path, alt}` gives a card a photo and a label panel. Use their own published photos.
- `motion`: `reveal` (`fade-up` or `none`), `duration` in seconds, `easing`, `smooth_scroll`. Match the capture's motion.
- `font_map`: `{"Their licensed font": "Free lookalike"}` so the fidelity check accepts the lookalike.
- `art`: `{"interviews": {"path": "images/collage/interviews.jpg", "alt": "..."}}` replaces a shared illustration (the six method beats `interviews`, `knowledge`, `workflows`, `processmap-43`, `opportunities`, `report`, which also sets the report cover) with art made in the company's style, for example the image skill's `collage` style in their palette for sober or premium brands.
- `proof_art`: `false` drops the provider's proof illustration, for sober brands (funeral, legal, medical, finance) where it would jar. Keep it for bold or playful brands.

With a `design` block, the proof and about sections keep the provider's locked wording, numbers, photo and logos but take the company's colour roles: `soft` background, `deep` text, `teal` for numbers and accents, `muted` and `line` for captions and rules.

## Optional copy slots

`look_at_first_heading`, `look_at_first_aim`, `rules_lead`, `report_note` and `offer_meta` replace the default wording in those places. `people_mode: "roles"` with `people_summary` maps kinds of published role in place of people; `people_hide_promises` lists promise titles to leave out. `noticed[].date_precision` and `public_number.date_precision` can be `month`. `public_number` also takes `eyebrow`, `heading`, `on_label`, `off_label`, `aria_label` and `context`, and `example.route_lead` replaces the route page lead.

## Optional report slots

`report` overrides report defaults by key. Keep all non-company scope and proof copy in claims. The example overrides `ranking_note` with a lesson from the company's own story.

- `solutions`: four rows with `name`, `value`, `effort`, `risk`, `x`, `y`. Ratings are `High`, `Medium` or `Low`; x/y are percentages inside the priorities chart. Positions and ratings are labelled examples.
- `ranking_note`: a short company lesson or reason for the order.
- `saving`: `before`, `routine_removed`, `review`, `unit`, `period`. The component computes after and saved hours. Label all values as examples.
- `roadmap`: three `[when, title, text]` rows using Now, Next, Then.
- `goal_cards`, `rules`, `start`, `keep`: use the shapes in `claims.json` when company wording is needed. Keep paragraphs to two short sentences and 40 words at most.

The book has 14 pages: cover, 12 inside pages, back page. Do not override `page_count`, `inside_pages`, the safety rule, sample labels or scope.

## Privacy

Use only business details people publish on their own company team page. Do not collect family details. The public people map projects only group and whether the person's own bio mentions tech; it never emits names, biographies, locations, photos or LinkedIn URLs. If another component later adds LinkedIn links, include one only when its decoded slug matches the person's name. A company link or another person's profile is never a substitute.

## Evidence

Fill the example from real company material. Keep source dates and exact URLs with facts; never invent an outcome, quote, tool connection or public number. The `examples/sample-sprint` file is fictional and only shows the shape; its links point at example.com.
