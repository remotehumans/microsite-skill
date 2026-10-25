# Campaigns: from an ideal client to a ranked list of ready pages

Every page lives in a **campaign**: a folder in the workspace (`settings.json → paths.projects`, default `~/microsites`). The gallery shows every campaign, with a filter to pick one. There are three kinds:

| Mode | Use it for | Typical campaign | What goes in |
|---|---|---|---|
| `job` | Job and contract applications | `jobs` | A job ad, the company, a recruiter call |
| `one` | One company the provider chose | `direct` | A website, or a person they met |
| `many` | Finding new clients | `wellness-150` | A number plus any of: ideal client, industry, market, place, staff and revenue range ("find me 150 wellness companies with 5–100 staff and £1–10m revenue") |

Create a campaign once, then add companies to it:

```bash
python3 scripts/campaign.py new direct --mode one --title "Direct"
python3 scripts/campaign.py new wellness-150 --mode many --title "Wellness 150" --request "Find me 150 wellness companies with 5-100 staff and £1-10m in revenue"
python3 scripts/campaign.py add direct --name "Ashby & Rowe" --website https://ashbyrowe.example
```

## Where things live

```text
<workspace>/
  <campaign>/
    data/campaign.json        the brief: mode, the search as asked, ideal client, industry, place, size, number, cost ceiling
    data/prospects.json       one record per company (fields below); only the lead agent edits it
    microsites/<slug>/        one folder per company: everything about that company
      research/research.json  facts, signals, culture, decision-maker, each with source and date
      research/brief.html     the client brief (optional)
      enrichment/             Treg calls: contact-research.json, cost-ledger.json, requests and responses
      design/                 live-site capture, fidelity.json, side-by-side.jpg
      company.json, theme.css the page source
      build/<slug>.html       the built page
      team-map.json           optional people map for the gallery's Team tab
    gallery/outreach-cards.json   the card and outreach kit per company
    gallery/contact-seeds.json    the people to contact per company: [name, role, why]
  .gallery/                   the gallery's own records: outreach progress, reviews, share links
```

A page's project folder is `microsites/<slug>/` inside its campaign. Every build, check and capture command in `SKILL.md` takes that folder.

## The company record

`data/prospects.json` is a list. `python3 scripts/campaign.py check` says what each record still needs for the stage it claims.

| Stage | Fields it adds | What they hold |
|---|---|---|
| `found` | `id`, `name`, `domain`, `found_by` | Where and how it was found |
| `qualified` | `decision` (`go` or `no-go`), `scores`, `score_total`, `score_out_of`, `financial_capacity`, `why_now`, `sources` | The qualification score, the money from filed accounts, the dated trigger |
| `researched` | `research`, `buyer`, `culture` | Research file path; people with `name`, `title`, `status`; how they think and work |
| `built` | `page` | `microsites/<slug>/build/<slug>.html` |
| `ready` | a card in `gallery/outreach-cards.json` | `chip`, `what`, `pay`, `why_now`, `why_now_url`, `opportunity`, `contact_why`, `opener`, and a `kit` |
| `no-go` | `decision`, `no_go_reason` | Why it stopped; keep the record so it is never researched twice |

Optional fields the gallery shows: `sector`, `location`, `rank`, `status` (a short plain label), `public_contact` (`email`, `phone`, `url`), `unknowns`.

## Many companies, step by step

### 1. Agree the brief

Providers ask in their own words. Each of these is a complete request:

- *"Find me 200 companies that meet our ICP."* (the profile's `qualification.icp`)
- *"Find me 150 wellness companies with 5–100 staff and £1–10m in revenue."* (an industry and a size)
- *"Find me 500 companies in London that match my target customer."* (a place)
- *"Find me 100 accountancy firms in Yorkshire for our month-end campaign."* (a market or campaign)

Save their words as `brief.request`, then fill in the rest of `data/campaign.json → brief`, asking only for what the request leaves open:

- **Who:** the ideal client from the profile, unless the request names an industry or market.
- **Where:** a country, region or city, if the request names one; otherwise the profile's `research.country`.
- **Size:** staff and revenue ranges from the request, else the profile's ideal client. The offer's price should be a small share of what they can spend.
- **The number:** how many companies to find and qualify. Ask how many of the best should get a page now; the rest wait on the ranked list.
- **Leave out:** sectors, current clients, competitors and anyone already contacted.
- How much may paid data cost for the whole campaign (`cost_ceiling`)? Treg calls cost fractions of a cent to a few cents.
- Anyone to exclude: current clients, competitors, people already contacted.

### 2. Find companies

Build a long list from the profile's enabled research sources, then add each with `campaign.py add ... --found-by "..."`. Good starting points:

- **The company register.** In the UK, Companies House advanced search by industry code (SIC), location and status, which also gives filed accounts. Elsewhere use the national register named in the profile.
- **Trade bodies and member directories** for the sector.
- **Job boards.** A business hiring for admin, operations or a role the offer helps with is a live signal.
- **News and press.** New offices, mergers, funding, new leaders, awards.
- **Maps and review sites** for local businesses.
- **LinkedIn company search**, in the provider's signed-in browser, following the safe-use rules in `linkedin.md`.
- **Treg** company and search tools to fill gaps (`references/enrichment.md`).

`campaign.py add` refuses a second record for the same website. Also check the company number: one business can trade under several names, and a group can own several brands.

### 3. Screen fast

For every company, spend a minute on three questions before any deep research. Mark a `no-go` with its reason as soon as one fails.

1. Is the website live and is it the kind of business in the brief?
2. Can they pay? Read the latest filed accounts (see `references/research.md`, "Can they pay"). Below the turnover floor is a no-go.
3. Is there any sign of the pain or change the offer helps with?

### 4. Qualify

Score the survivors on the profile's `qualification.criteria` and apply its `hard_no` rules (`references/research.md`). Record `decision`, `scores`, `score_total`, `score_out_of`, `financial_capacity` and `why_now` with its source and date. Then rank: `python3 scripts/campaign.py list <campaign>`.

### 5. Research, build and write the card

For each `go`, in rank order, follow `SKILL.md` from research to a checked page, using `microsites/<slug>/` as the project folder:

1. Research them like a client, including signals, culture and the decision-maker (`references/research.md`).
2. Fill the gaps with Treg (`references/enrichment.md`). Save what you find about people in `enrichment/contact-research.json`, so the gallery shows it.
3. Capture their live site, build the page, score fidelity and run QA.
4. Write the card and outreach kit (`references/outreach.md`) into `gallery/outreach-cards.json`, and the people to contact into `gallery/contact-seeds.json`.
5. Update the record's `stage` and run `python3 scripts/campaign.py check <campaign>`.

### 6. Hand over for review

Tell the provider how many pages are ready, how many are waiting and why, the no-gos with reasons, and what Treg cost. They review in the gallery (`node gallery/server.mjs`), ask for changes, approve, and send. Nothing is sent or published without their click.

## Working on several companies at once

If your agent can run helpers (subagents, parallel sessions), give each helper one company at a time:

- A helper writes only inside its own `microsites/<slug>/` folder and returns the record fields and card as its result.
- The lead agent alone writes `data/prospects.json` and the files in `gallery/`, so two helpers never overwrite each other.
- Work in batches of about five. Check each batch with `campaign.py check` before starting the next.
- Keep a running Treg total across helpers and stop at the brief's `cost_ceiling`.
- Live-site capture opens a browser window; run captures one or two at a time.
- LinkedIn work never runs in parallel. One session, slowly (`linkedin.md`).

## One company and job applications

The same folders, with one company per run:

- **One company:** `campaign.py add direct --name ... --website ...`, then follow `SKILL.md` from step 2. Qualification still runs, and a weak fit is reported before building.
- **A job:** `campaign.py add jobs --name ... --website ...`, then job mode in `SKILL.md`. The decision-maker is the hiring manager; the page shows the provider's first 90 days.
