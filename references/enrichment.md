# Enrichment: fill specific gaps with paid data, cheaply and honestly

Research (`research.md`) finds what is public. Enrichment fills the specific gaps that block qualifying, reaching the right person or making the page: the decision-maker's profile, a work email, an office number, company size or filed figures, review data. It uses the profile's `integrations.research_data` connector. The default is [Treg](https://treg.to/), which gives an agent pay-per-call access to data providers through one MCP server (`https://treg.to/mcp/`): LinkedIn profile search (HarvestAPI), work-email finding (BlitzAPI, ContactOut), email verification (Icypeas), page fetch and web search (Exa, fast search, Crawl4AI), company and SERP data. Calls cost fractions of a cent to a few cents; a ten-business pilot cost about $0.02.

## Order of work

1. **Free first.** Read what you already saved: the company's own site capture, team and contact pages, published inboxes, office numbers, filed accounts, job ads. Many gaps close here at no cost.
2. **Name the gap.** Only look up a field that would change the qualification, the route to a person, or the page. Write down which field and why before calling.
3. **Look it up.** Search the connector's catalogue for the job (for example "find a LinkedIn profile by name and company", "find a work email"), read the endpoint's price and billing unit, then call. Set a cost ceiling for the batch and stay under it.
4. **Verify against an original source.** A provider result is a lead until it matches a separate source: the person's role on the company's own site, the company's registered officers, a dated press item. A name match alone is not enough.
5. **Record it.** Keep the request, the response and the decision for every call, and a cost ledger.

## Rules

- **Provider-listed and published are different.** Label an email or number as published (on the company's own pages) or provider-listed (from a data service). Never present a provider result as something the company published.
- **Only "valid" emails are routes.** Catch-all, "probable" or unverified addresses stay private and unconfirmed; use the company's published inbox instead. Never guess an address pattern.
- **Wrong person, wrong company: reject.** If the result belongs to a different employer or an ambiguous identity, exclude it and say why.
- **Business details only.** Work emails, office numbers and public business roles. No personal phone numbers, home details or family information.
- **No contact.** Enrichment never sends a message, connection request or email. Outreach is a separate step that needs the provider's approval.
- **Never use paid data to get round a block.** If a website refuses automated visitors, do not fetch it through a scraping service; see `design.md`.
- **Quality beats cost, within reason.** Pay for data that makes a page or a route clearly better; skip calls that only add volume. Revenue estimates from data providers do not establish profit or budget.

## What to keep (per campaign, `enrichment/<run>/`)

- `README.md`: what was looked up, why, what changed, and the total cost.
- `cost-ledger.json`: one row per call with business, provider, endpoint, time, call ID, charged and listed price, and paths to the saved request and response. Use the connector's charged amount per call ID, not a guess from the balance.
- `lookups/<business>/`: the request, the response and a verification record (source URL, date checked, accepted or rejected and why).
- A contact export only of verified routes, marked published or provider-listed.

Without a connector (`research_data` set to `none`), do steps 1, 2 and 4 by hand and say which gaps stay open.
