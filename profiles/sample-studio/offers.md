# Northlight Ops offers: what each page may say

Live offer pages are the source of truth. Re-read them before writing a page and never promise more than they do. Prices come from this profile's `offers.json` through `{{PRICE:offer}}`; booking buttons use `{{BOOK:offer}}`.

One row per offer. Keep the `offers.json` key in the first column so pages and prices line up. The sprint pipeline (`sprint/build_sprint.py`) uses the `sprint` key for a fixed-scope discovery offer; other modes use the section templates in `templates/sections/` or your own copies in this profile's `sections/` folder.

| Key | Offer | Source of truth (live page) | Length | What the page may say (scope, steps, price wording, what is excluded) | Who it is for |
|---|---|---|---|---|---|
| sprint | Ops Map | https://northlight.example/ops-map | 3 weeks | A map of how work flows, ranked opportunities and a plan. Building automations and ongoing support are not included. | Owners of service firms with 10 to 80 people |
