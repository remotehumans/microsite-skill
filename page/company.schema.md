# Company file contract: standard page

One `company.json` in the project folder holds what is true about the company. Everything about the provider and the offer comes from the profile (`offers.json`, `claims.json`, `profile.json`). Paths are relative to the company file. Plain words, no em dashes, no blank fields, no placeholders. Worked examples: `examples/sample-web-studio-page/` and `examples/sample-recruiter-page/` (both fictional).

| Field | Shape and purpose |
|---|---|
| `slug`, `name` | Lower-case hyphenated slug; their real trading name |
| `offer` | The key of the offer this page sells, from the profile's `offers.json`. Left out, the first offer is used |
| `currency` | The page's currency. A price set in that currency is shown; else the offer's `price_text`; else a labelled estimate |
| `prepared_date` | Visible month and year, such as `October 2026` |
| `brand.colours` | Six-digit hex values for the roles `teal` (accent), `deep`, `yellow` (highlight band), `ink`, `muted`, `paper`, `navy`, `soft`, `pale`, `line`, taken from their site |
| `brand.fonts` | `body`, `heading`, `google_url` (a Google Fonts stylesheet with both families) |
| `logo` | Their logo in the project's `art/` folder, PNG with transparency or SVG |
| `hero` | `path`, `alt`, `photo` (true for a real photo, which may sit anywhere in the project) |
| `goal` | `headline` (their goal and the result, in their words) and `lead` (one or two short sentences) |
| `noticed` | Three dated facts: `date` (`YYYY-MM-DD`), exact `url`, `text`. Optional `date_precision: "month"` |
| `noticed_summary` | One line that links the facts to the goal |
| `look_at_first` | Three to five cards, each `title` and `text`: where you would start, most valuable first |

## Optional

| Field | Shape and purpose |
|---|---|
| `example` | One example on their own material: `heading`, `lead`, `before` and `after` (each `text`, optional `title`), `source_label`, `source_url` |
| `noticed_heading`, `look_at_first_heading`, `look_at_first_aim` | Replace the default headings |
| `call_url` | An HTTPS booking link for this page only, with no query; by default the offer's `booking_url` |
| `design` | Their look: top bar, photo hero, photo cards, motion. Same parts as `sprint/company.schema.md`, "Optional design slots" |

The project's `theme.css`, when present, loads last and can restyle anything to match their site.

## What comes from the profile

- **The offer** (`offers.json`): `label`, `outcome`, `hero_line`, `deliverable`, `for_line`, `includes`, `excludes`, `steps`, `length`, `kind`, `prices` or `price_text`, `price_note`, `booking_url`, `button`.
- **Proof and about you** (`claims.json`): `proof_heading`, `copy.proof_lead`, `proof_tiles`, `about`, `logos`. Shown exactly as written.
- **Voice rules** (`claims.json`): `banned_phrases`, `hedge_phrases`, `vocabulary_map`, `reading_level`. The build refuses a page that breaks them.
- **Your accent** (`profile.json → provider.accent`): colours your proof and about sections; else they take the company's accent.

## Evidence

Every fact about the company has its source and date. Never invent a result, quote, number or customer. Mark examples as examples.
