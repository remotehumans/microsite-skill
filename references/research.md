# Research: read the business like a client

Record every fact with its source URL and the date checked. Label inference as inference. Business information only.

## Decision-maker

Identify the person who decides (hiring manager, owner, director). Confirm identity with at least two independent sources from the profile's `research.decision_maker_sources` (for example LinkedIn through the job advert's hiring team or the company People tab, the company register's officers, the company site, trade press, or a third-party directory). The profile's `notes.md` says which logged-in sessions exist. Follow the LinkedIn safe-use rules in `linkedin.md`: lists first, at most five profiles a session, slowly. Note mutual connections. If unconfirmed, list candidates and say so. Save each person's LinkedIn profile link for the gallery; the provider connects themselves (`outreach.md`).

## Sources by question

Use the enabled rows of the profile's `research.sources` (`python3 scripts/provider.py get research.sources`). Each row is a question and the sources that answer it; providers add, remove or switch off rows for their country and sector (SETUP.md, step 4). Two rules hold for every row: for tools, check each one's official API, access terms and official or community MCP servers, and check every docs link returns 200 and date it; for brand, CSS often carries framework defaults (`extract_brand.py` drops Bootstrap's) and logos are often white for a coloured header, so place them on their own header colour via `extra_css`.

For job mode, also process the recruiter call (role facts, rate, location, contract length, decision process) and check the agency relationship.

## Can they pay

The offer should be a small share of what they can spend. Read the latest filed accounts from the company register (UK: Companies House filing history, the PDF of the accounts):

- **Record the facts with their period:** turnover, operating profit, cash, staff numbers, and the year end. "£3.4m turnover, £610k operating profit, year to March 2026."
- **Look at the trend** across two or three years: growing, flat or falling. Falling profit or cash is a reason for care, and a reason to say so.
- **Know what small accounts leave out.** Micro-entity and small-company accounts often show no turnover or profit. Say "small-company accounts, turnover not filed" and use other size signals (staff, offices, clients, job ads). Never work out profit from reserves or net assets.
- **Groups and LLPs:** say which entity the figures are for. Group figures and one company's figures differ.
- Write one plain line for the card: what they have, from which accounts. Never claim to know their budget.

Where there is no public register, use published size signals and say the money is unknown.

## Buying signals: why now

A signal is a dated, public change that makes the offer more useful now. Look for:

- **Hiring:** job ads for admin, operations, data, AI or the work the offer covers.
- **Growth:** new offices, sites, products, contracts, acquisitions or mergers.
- **New people:** a new owner, managing director or head of operations.
- **Stated plans:** a leader talking about AI, efficiency or growth in press, a podcast, a post or an annual report.
- **Strain:** reviews about slow replies or mistakes, a paused project, a backlog they mention.
- **Rules changing** in their sector.

Record each signal with its date, link and what it probably means for them, labelled as inference. Keep the strongest one as the card's `why_now` and `chip`. A generic sector trend, an old website or a single complaint is not a signal on its own.

## Culture: how they think

The page and the message should sound like they were written for this company. From their own words (about page, values, blog, careers page, leaders' posts, how they talk to customers, reviews of working there), note:

- what they are proud of and what they promise customers
- how they talk: formal or casual, careful or bold, technical or plain
- what they care about: craft, speed, people, family, tradition, growth
- how they make decisions: owner-led, partners, a board

Save two or three lines in `culture` with sources. Use it to choose the page's tone, the outcome to lead with and the words in the opening message. Business culture only: never profile individuals' private lives.

## Enrichment

When a gap would change the qualification, the route to a person or the page (a decision-maker's profile, a work email, an office number, company figures), follow `enrichment.md`: free saved sources first, then the profile's `integrations.research_data` connector (Treg by default), verify every result against an original source, and keep a cost ledger.

## Qualification score (cold prospects)

Score each criterion in the profile's `qualification.criteria` on its `scale` (default 0–2: ICP fit, evidence of pain, size and budget signals, a reachable owner or director, a relevant proof point, and whether a worked example is possible from public material), against the profile's `icp` and `goals`. Any `hard_no` stops the build. Report the total against `go_threshold` and a go or no-go recommendation with reasons before building.

## Use cases

List 5–8. For each: the workflow (mapped to one of the five core functions), the public evidence it exists, the three-lens value (revenue, costs, time), ease, data readiness and risk. Each top use case must point to a real artefact (a document, review pattern, job ad or page). Drop any that cannot.

## Stakeholder map

Who decides, who uses, who could block, external partners; what each likely cares about (labelled as inference). Finish with 6–8 discovery questions that test the biggest assumptions.

Save the research as a client brief HTML next to the page (see `examples/` for structure) and file durable facts where the profile's `integrations.memory` says.

## When a site blocks automated access

If a site returns 403 or shows a "verify you are human" check (Cloudflare and similar), do not attempt to bypass it. Use other public sources (LinkedIn company page, Companies House, Google Business profile, property portals, Instagram), or ask the provider to open the site in their own browser and share the brand details. If too little is visible, pick another prospect and say why.
