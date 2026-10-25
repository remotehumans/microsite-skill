# Location: make the page belong to one place

Test: if you swapped the place names for another town and the page still read the same, rewrite it. Aim for substance that only makes sense for their patch.

## Locale (config.json → locale)

```json
"locale": {"country": "GB", "currency": "GBP", "lang": "en-GB", "place": "EC1M 4AA"}
```

- **Currency**: prices come from `{{PRICE:offer}}` tokens resolved against the profile's `offers.json`. Where the provider has set a price in that currency, it is used as written. Where they haven't, the page shows a live-rate estimate labelled "about", with the official price in brackets (for example "From about £1,890 (US$2,500)"), and the build prints a NOTE. Report every NOTE to Elliott and ask for an official price; never invent or round a price into a new official one. Never estimate exchange rates from memory.
- **Language**: copy stays in the provider's spelling for every reader (`provider.language` and `voice` in `profile.json`). `lang` sets the HTML tag. Use local units and formats where they help the reader (square feet in UK property, local date formats in the copy).
- **Booking and time**: if the prospect is in another time zone, say so near the call to action ("calls in UK or Thailand hours").

## Local entities

Run `python3 scripts/local_entities.py "<postcode or lat,lon>" 900 research/local.json`. For UK postcodes it returns the ward, borough, constituency and region (postcodes.io), plus nearby Wikipedia places with distances and links. Outside the UK, pass coordinates.

Curate, don't dump:

- Pick 3–4 entities that connect to their business: streets their stock or clients sit on, transport that changes who reaches them, district or council boundaries that change the rules, neighbouring trades or clusters, landmarks people use for directions.
- Leave out entities that are irrelevant or sensitive (fires, crimes, health or community services, people).
- Each tile says why it matters to *their* work and, where natural, to the AI work (for example a Company Brain keeping three councils' rules apart).
- Add official sources where they matter: the council's planning or licensing pages, business rates, local regulators, local business directories.
- Check every link returns 200 and record the date checked.

## The "local to you" section

`templates/sections/local.html`, inserted after the worked example. It holds: a heading "{Area}: why this matters here", a 2–3 sentence local intro with linked entities, 3–4 entity tiles, "Working with you in person" (only true statements about where the provider is and how they'd work), 3 local FAQs, and linked sources.

The provider's base is `provider.based_in` in `profile.json`, with any detail in the profile's `notes.md` (check their memory for changes). Say how near they are when it's genuinely close; offer remote or on-site honestly when it isn't.

## Beyond these pages

Prepared-for pages are noindexed, so they never rank. The same local-craft principles apply to the provider's public location pages built for search; that work belongs to the `seo-geo` skill.
