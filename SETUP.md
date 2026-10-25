# Set up the microsite skill for your business

This skill makes a private web page for one company: "Prepared for {company}". The page shows that business how you would help them, in their own brand, built from their public material.

**Three ways to use it**

- **A job.** Give it a job ad. It makes a page showing what you would do in your first 90 days.
- **One company.** Give it a website. It checks the fit, researches them and makes their page.
- **Many companies.** Ask for a number of companies by ideal client, industry, market, place or size: *"Find me 200 companies that match our ideal client"*, *"Find me 150 wellness companies with 5 to 100 staff and £1m to £10m in revenue"*, or *"Find me 500 companies in London that match my target customer"*. It finds them, checks they can pay, ranks them, and makes a page for the best.

**What happens to each company**

- Check they're worth pursuing, including their filed accounts
- Research them: news, hiring, reviews, culture
- Find the person who decides, with Treg and LinkedIn
- Capture their live website
- Build a page that looks like their site
- Score it against their site, on desktop and phone
- Write the outreach: LinkedIn message, Loom script, email
- Show it all in your gallery to review, approve and track

**The gallery** is your dashboard: every company, its page, research, people and outreach progress, on your own computer.

The skill comes with three fictional businesses, so you can see it fit very different offers: a web design studio (`profiles/sample-web-studio/`, page for a roofer in `examples/sample-web-studio-page/`), an engineering recruiter (`profiles/sample-recruiter/`, page for a manufacturer in `examples/sample-recruiter-page/`) and an operations consultancy selling a discovery report (`profiles/sample-studio/`, page for an accountancy in `examples/sample-sprint/`). This guide sets it up for **your** business: who you are, what you sell, who you sell to, your proof, how you sound and how you reach out. It takes about an hour, and most of that is answering questions.

**It works with any AI agent** that can read files, run terminal commands and browse the web: Claude Code, Codex, Cursor, Gemini CLI, Hermes, OpenClaw and others. Nothing in the steps depends on one agent.

## What you need before you start

Sign up for or install these first. Step 9 explains how each one is used and what happens without it. Check each provider's current pricing yourself; plans change.

**Essential**

| What | Why | Where | Cost |
|---|---|---|---|
| An AI agent that can run commands | Runs the whole workflow | [Claude Code](https://code.claude.com/) (Claude Pro or Max plan) or [Codex](https://developers.openai.com/codex) (ChatGPT plan); Cursor, Gemini CLI and others also work | Paid plan |
| Python 3.10 or newer | Every script | [python.org](https://www.python.org/downloads/) or `brew install python` | Free |
| ImageMagick 7 | Every build | [imagemagick.org](https://imagemagick.org/script/download.php) or `brew install imagemagick` | Free |
| Node.js 20 or newer | The gallery dashboard | [nodejs.org](https://nodejs.org/) or `brew install node` | Free |
| A browser your agent can use | Measures the prospect's live website and your page; reads LinkedIn for you | Your agent's own browser tool or connector (for example Claude in Chrome, Codex's browser, Cursor's browser). It must open pages, run JavaScript and take screenshots. You give the agent permission to use it | Usually included |
| A booking link | Every "book a call" button | [Cal.com](https://cal.com/) or [Calendly](https://calendly.com/) | Free plans available |
| Treg | Enrichment: company data, decision-makers' profiles, work emails and phone numbers, each checked against its source (`references/enrichment.md`) | [treg.to](https://treg.to/): sign up, then add the MCP server `https://treg.to/mcp/` to your agent | Pay per call, often fractions of a cent |
| LinkedIn | Checking the decision-maker, then connecting with them and keeping the gallery up to date | A [LinkedIn](https://www.linkedin.com/) account, signed in by you on the browser your agent uses. The agent follows safe-use rules so LinkedIn does not mistake it for a bot (`references/linkedin.md`) | Free; paid plans optional |

**Recommended**

| What | Why | Where | Cost |
|---|---|---|---|
| A website you can publish private pages to | A private link per prospect | A [GitHub](https://github.com/) repo for your site plus a host that deploys from it: [Netlify](https://www.netlify.com/), [Vercel](https://vercel.com/), [Cloudflare Pages](https://pages.cloudflare.com/) or GitHub Pages | Free tiers available |
| Image generation | The "wow" visuals and illustrations in the prospect's style | Codex on a ChatGPT plan (default), or any image tool you can call from a command | Included in a ChatGPT plan |
| agent-browser (optional) | Runs capture, scoring and visual QA as single commands, without driving the browser step by step | [github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser): `npm install -g agent-browser`, then `agent-browser install`. Needs a computer with a screen | Free |

**Optional connectors in your agent:** email drafts (Gmail or Outlook), a CRM or notes tool (Notion, HubSpot, Attio), call transcription, video, and a QR tool such as `qrencode`. Connect them in your agent's own settings, then name them in `profile.json → integrations` (Step 9).

## For the agent doing the setup

This is an interview. The person may know nothing about the skill's files; you turn their answers into their profile.

**Start** by telling them, in plain words, what you will do together and roughly how long it takes (about an hour), and show this checklist. Tick items off as you go:

- [ ] Install the skill and the free tools (Python, ImageMagick, Node.js)
- [ ] You and your business
- [ ] What you sell
- [ ] Your proof and about you
- [ ] Who you sell to
- [ ] How you sound
- [ ] How you reach out
- [ ] Where research comes from
- [ ] Treg, your browser and LinkedIn
- [ ] See the gallery with the sample campaign
- [ ] Your first real company

Then ask what they will use it for: **selling** (finding clients for what they offer), **finding a job or contract**, or **both**. Job seekers skip Steps 3 and 5 and answer "If you are looking for a job" instead.

**How to ask:**

1. A few questions at a time, in plain words. Give one or two examples with each question, ideally from a business like theirs.
2. Every question with a list of choices ends with **"or something else"**, and their own answer always counts. The lists are prompts, never limits.
3. When they are unsure, suggest a sensible default, say it is a default, and move on. They can change it later.
4. Use their words. Their offer, their results and their voice go on every page, so write them as they say them, tidied for spelling only.
5. At the end of each step, read back a short summary of what you heard and ask "Is that right?" Write to the files only after they confirm. A correction means a new summary, not a write.
6. After writing, run `python3 scripts/doctor.py` and show them what changed.

Never invent proof, prices, client names or numbers. Every `[[...]]` in every profile file needs an answer, including `delivery` and `integrations` (write `none` where something isn't used). If they don't know an answer yet, leave the placeholder in place; the doctor will list it and builds will refuse to run until it's filled. Run every command from this skill's folder.

**Where answers go:**

| Step | File |
|---|---|
| 2. You and your business | `profile.json → use_for, provider, about`, `photo.jpg` |
| 3. What you sell | `offers.json` (one entry per offer), `offers.md` |
| 4. Your proof and about you | `claims.json → proof_heading, proof_tiles, about, logos`, `proof/` |
| 5. Who you sell to | `profile.json → qualification` |
| 6. How you sound | `profile.json → voice`, `claims.json → banned_phrases, hedge_phrases, vocabulary_map, reading_level` |
| 7. How you reach out | `profile.json → outreach`, `integrations.writing_voice` and `outreach_method` |
| 8. Research sources | `profile.json → research` |
| 9. Apps and connectors | `settings.json → tools`, `profile.json → integrations, delivery` |

## Step 1. Install

**1a. Put the folder where your agent finds skills.**

If you were given access to the GitHub repo, clone it straight into place, for example `git clone https://github.com/remotehumans/microsite-skill.git ~/.claude/skills/microsite`. If you were sent a zip, unzip it there.

| Agent | Where the `microsite` folder goes |
|---|---|
| Claude Code | `~/.claude/skills/microsite/` (or `.claude/skills/microsite/` inside one project) |
| Codex | `~/.codex/skills/microsite/` |
| Any other agent | Anywhere. Add this line to the project's `AGENTS.md` (or the agent's rules file): "When asked for a microsite, follow `path/to/microsite/SKILL.md`." |

**1b. Install the three free tools the skill needs.**

- Python 3.10 or newer
- ImageMagick 7 (the `magick` command)
- Node.js 20 or newer (the gallery)

```bash
brew install python imagemagick node
```

On Linux, use `sudo apt install python3 imagemagick nodejs` (check `magick -version` says 7; older distributions ship 6, so use the ImageMagick AppImage there).

**See it working first (optional).** This builds a sample page: a fictional web design studio's offer, for a fictional roofer:

```bash
MICROSITE_PROFILE=sample-web-studio python3 page/build.py examples/sample-web-studio-page
```

Open `examples/sample-web-studio-page/build/hartley-roofing.html` in a browser, then delete the `build/` folder. The other samples build the same way: `MICROSITE_PROFILE=sample-recruiter` with `examples/sample-recruiter-page`, and `MICROSITE_PROFILE=sample-studio` with `examples/sample-sprint`.

**1c. Create your settings and your profile.**

```bash
cp settings.example.json settings.json
```

```bash
python3 scripts/provider.py new your-business
```

This copies `profiles/_template/` to `profiles/your-business/` and selects it in `settings.json`. Use your business name in lower case with hyphens.

**1d. Check where you are.**

```bash
python3 scripts/doctor.py
```

Expect a long list of FIX lines at this point. Each step below clears some of them.

**What goes where**

- `settings.json` is about **this computer**: which profile to use, folder paths (`site_repo` for publishing, `projects` for where each company's page folder goes), and which tool runs each step. Git ignores it.
- `profiles/your-business/` is about **you**: who you are, what you sell, your proof and your rules. You can share it with your team or keep it private.

`profiles/README.md` describes every file in a profile. `profiles/sample-studio/` is a complete fictional example to copy from.

## Step 2. You and your business

**File:** `profiles/your-business/profile.json` → `provider` and `about`. Add your photo as `profiles/your-business/photo.jpg`.

Ask:

- Your full name, first name, business name, and a short byline ("founder of ...").
- A tagline of five to eight words on what you do.
- Email, website, and (optional) phone and LinkedIn.
- A results or case-study page on your site, and the link pattern for one story (`.../results/{id}`). If you have none, use your homepage.
- Alt text for your photo on job pages (`photo_alt_event`), for example "Priya Shah speaking at an event".
- Where you're based, and your spelling (for example `en-GB`).
- Three or four sentences about you (`bio_html`), and two to four results you can prove (`highlights`).
- Client logos you have permission to show (optional). Put PNGs in `logos/` and list them in `client_logos`.
- Your brand colour as a hex code (`accent`, for example `#2f5d50`). It colours your proof and about-you sections on each page. Leave it empty to use each company's own colour.
- What you will use the skill for (`use_for`): selling, jobs, or both.

**Photo:** a clear, friendly photo, roughly square, at least 800 pixels wide.

## Step 3. What you sell

**Files:** `offers.json` (one entry per offer) and `offers.md` (notes for the agent). Every page sells one of these offers, in your words. Start with your main offer; add others the same way.

Ask, for each offer:

- **What is it called?** (`label`) For example "Website rebuild", "Retained search", "Monthly bookkeeping".
- **What form does it take?** (`kind`) For example a project, a retainer, a product, a service, a workshop, an audit, or something else.
- **Who is it for?** (`for`) For example "owner-led trades firms", "manufacturers hiring engineers".
- **What result does the buyer get, in their words?** (`outcome`) For example "More enquiries from your website", "The right engineer in post, sooner".
- **In one line, what is it?** (`hero_line`) For example "A new website that brings in work, built in six weeks."
- **What do they actually receive?** (`deliverable`) For example a website, a shortlist of candidates, a report, a working system, monthly support, a trained team, or something else.
- **What is included?** (`includes`) Three to six plain items.
- **What is not included?** (`excludes`) The things people often assume you do. The build refuses a page that promises them anywhere else.
- **How does it work, step by step?** (`steps`) Three to five steps, each a short title and one sentence.
- **How long does it take?** (`length`) For example "6 weeks", "Shortlist in 3 weeks", "Ongoing, monthly".
- **What does it cost?** One of:
  - a set price per currency (`prices`, for example "From £3,500") with a `base` amount;
  - a wording such as "15% of first-year salary", "£400 a month" or "Priced on a call" (`price_text`);
  - or something else, written as they would say it.

  Plus one line under the price (`price_note`), for example "Fixed fee, agreed before we start."
- **What should the button say, and where does it go?** (`button`, `booking_url`) For example "Book a 20-minute call" to their Cal.com or Calendly link.
- **When is this the right offer, and what must a page never promise?** (into `offers.md`) For example "Choose it when their website is old; never promise a number of new customers."

**Page type** (`page`): leave it as `standard`. Only a fixed discovery offer whose deliverable is a report may use `sprint`, a page with a page-turning report; it also needs the sprint wording in `claims.json` (copy `profiles/sample-studio/claims.json` as the model). Job applications use the template page (see "If you are looking for a job").

Example of a filled offer: `profiles/sample-web-studio/offers.json` (a project with a fixed price) and `profiles/sample-recruiter/offers.json` (a service priced as a percentage).

## Step 4. Your proof and about you

**File:** `claims.json`. These show on every page exactly as written.

Ask:

- **Three results you can prove**, each with a number, a short heading, one sentence and who it was for (`proof_tiles`). For example "3x · More quote requests · A roofer in Wakefield now gets most jobs through the site · Roofing firm". Real results only.
- **New, with little proof yet?** Use what is true: years of experience, a pilot, work at a previous employer described honestly, or a free first piece of work. Never invent a client or a number.
- **A heading over the results** (`proof_heading`) and one line before them (`copy.proof_lead`).
- **About you**: a heading such as "Hi, I'm Jo." and two sentences on why you run the business (`about.heading`, `about.lead`), plus three short facts (`about.facts`), for example "9 years · Building websites for trades firms".
- **Client logos** you have permission to show (optional): files in the profile's `art/`, listed in `logos`.
- **Longer stories** for a carousel (optional): `proof/stories.json`, one object per story with images in `proof/stories/`. If your website keeps the same list in `data/stories.json`, `python3 scripts/sync_proof.py` copies it over.

## Step 5. Who you sell to

**File:** `profile.json → qualification`. Before building a page for a company found cold, the agent scores it and reports go or no-go.

Ask:

- **Who is your ideal client?** Their industry, size (staff or revenue), place, and the sign they need you (`icp`). For example "Owner-led trades firms in Yorkshire with 3 to 40 staff whose website is old."
- **Who decides to buy?** The job titles to look for, for example owner, managing director, operations manager, head of talent, or something else. Write them into `icp` or `notes.md`.
- **What signs say they need you now?** For example hiring for a role, a new office, a new leader, complaints in reviews, a funding round, or something else.
- **What rules a company out straight away?** (`hard_no`) For example "too small to pay", "a current client", "a competitor".
- **What is the smallest company that can afford you?** A revenue or staff floor, so the agent can check their filed accounts. A useful rule: your price should be a small share of what they spend.
- **What makes a deal worth it to you?** Money, the kind of work, freedom, where it leads (`goals`).
- **Which questions decide fit?** The template has six (ideal client, evidence of the need, can they pay, a reachable decision-maker, relevant proof, an example possible from their material). Reword, add or remove them (`criteria`), choose the scale (`scale`, default 0 to 2) and the go mark (`go_threshold`; 8 of 12 is a good start).
- **What must the agent ask you before building?** (`ask_before_building`) For example your minimum fee or travel limits.
- **How much may paid data cost per company?** Treg calls are usually fractions of a cent. Note it in `notes.md`.

## Step 6. How you sound

**Files:** `profile.json → voice` and `claims.json`.

Ask:

- **How do you come across?** For example friendly and direct, calm and expert, formal, playful, or something else. Two or three short rules into `voice`.
- **Spelling:** British or American English, or another language (`provider.language`).
- **Words you always use, and words you never use.** Never-use words go into `banned_phrases`; words to swap go into `vocabulary_map` (for example "utilise" → "use").
- **How plain should the writing be?** `reading_level.max_grade` defaults to 6, easy to read on a phone. Lower is plainer.
- **Any wording you must include?** For example a regulator's line for financial or legal services. Note it in `notes.md` and on your offer.

## Step 7. How you reach out

**File:** `profile.json → outreach`. The agent writes your messages; you send them.

Ask:

- **How do you reach people?** (`channels`) For example LinkedIn, email, phone, in person, events, letters, or something else.
- **On LinkedIn, do you add a note to connection requests?** (`linkedin_note`) Connecting with no note often works best; then message once they accept.
- **Will you record a short video for each page?** (`video`) For example a Loom of about 90 seconds.
- **Will you send handwritten notes to your best prospects?** (`handwritten_notes`)
- **How do you follow up?** (`follow_up`) For example one friendly message after a week, then stop.
- **Who sends?** (`sender`) You, or a named colleague.
- **A writing-voice guide or skill, or a cold-outreach method you follow?** Name them in `integrations.writing_voice` and `integrations.outreach_method`, or write `none`.

## If you are looking for a job

Job seekers answer these in place of Steps 3 and 5, and keep Steps 2, 4, 6 and 7:

- **Your CV**: save it in the profile folder and note its name in `notes.md`.
- **The roles you want**: titles, seniority, industries, or something else.
- **Day rate or salary, and location limits**: on-site, hybrid, remote, travel.
- **Three achievements** with numbers, for the proof tiles.

Job pages use the template page in job mode ("The first 90 days at {company}"); see `references/modes.md`. Rate maths stays private and never appears on a page.

## Step 8. Research sources

**File:** `profile.json` → `research`. Each row is a question the research answers and the sources that answer it. The agent uses only rows with `"enabled": true`.

Ask:

- Which country are most of your prospects in (`country`)?
- Which company register applies? Change the first row to match: UK Companies House, Ireland CRO, US state Secretary of State filings or SEC EDGAR for public companies, Australia ASIC, New Zealand Companies Office, Canada's corporate registry.
- Which sector records matter in your niche? For example planning portals for architects, regulator registers for financial firms, tender portals for public-sector suppliers.
- Any source to switch off? Set `"enabled": false` and keep the row for later.
- Any source to add? Add a row:

```json
{"question": "Do they win public contracts?", "sources": ["Contracts Finder", "Find a Tender"], "enabled": true}
```

`decision_maker_sources` lists where to confirm who decides. Keep "never bulk-visit profiles": LinkedIn locks accounts that view dozens of profiles quickly.

Note that `scripts/local_entities.py` (the "local to you" section) looks up UK postcodes by itself; elsewhere, give it `latitude,longitude`. `scripts/rate_maths.py` and `references/money.md` cover UK contractor rules (IR35) only.

## Step 9. Apps and connectors

Two places hold these choices. `settings.json → tools` holds the programs on this computer. `profile.json → integrations` holds the skills or connectors your agent uses for each step. Each one is optional except where marked. When something is missing, that step is skipped or done by hand, and the doctor shows it as OFF.

| Capability | Used for | Default | Other options | Without it |
|---|---|---|---|---|
| ImageMagick (**required**) | Every build | `magick` | None | Nothing builds |
| A browser (**needed for real pages**) | Capturing the prospect's live website, the fidelity score, visual checks at desktop and phone size | Your agent's own browser tool runs `scripts/design_probe.js` and saves the results (`references/design.md`, "Using your agent's own browser") | [agent-browser](https://github.com/vercel-labs/agent-browser) runs the same steps as one command (`tools.browser` in settings); it opens a visible window, so use a computer with a screen | Without any browser there is no capture, and pages fail the fidelity check |
| Image generation | AI variations of their own photos for the "wow" moment | `codex` (Codex CLI on a ChatGPT subscription) | Any command that reads `SRC`, `OUT` and `PROMPT` and writes `OUT`, set in `tools.image`; or `none` | Use their own imagery and a worked example instead |
| Illustrations in their style | Replacing the shared method drawings for sober or premium brands (`company.json → design.art`) | Your image tool or illustrator. Remote Humans uses a vintage collage style in the prospect's colours | Keep the shared drawings (fine for playful brands) | The shared stick-figure drawings |
| Chrome or Chromium | PDF backup and share-preview image | Found automatically | A path in `tools.chrome` | No PDF backup |
| Website repo and host | Publishing the private link | `paths.site_repo` plus `delivery` in the profile | See "Publishing" below | Send the self-contained HTML file or a PDF |
| Booking | Every call-to-action button | `booking_url` per offer | Cal.com, Calendly, HubSpot meetings, a contact page | Required: every page has a button |
| Research data (enrichment, **needed**) | Decision-maker profiles, work emails, office numbers, company and page data to fill specific gaps (`references/enrichment.md`) | `integrations.research_data`: [Treg](https://treg.to/) via its MCP server `https://treg.to/mcp/` | Another paid data provider your agent can call | Gaps stay open and pages are weaker; research by hand from public sources |
| Transcription | Turning call recordings into notes | `integrations.transcription` | A transcription skill, your meeting app's transcript, Whisper | Paste notes in by hand |
| Memory or CRM | Filing research, links and outcomes | `integrations.memory` | Notion, HubSpot, Attio, an Obsidian vault, a notes folder, via your agent's connector | The agent reports in chat only |
| Writing voice | The covering note in your voice | `integrations.writing_voice` | A voice skill or a short style guide file | Plain, polite default |
| Outreach method | How the first message is structured | `integrations.outreach_method` | A cold-outreach skill or playbook | Short note: one insight, the link, the call to action |
| Email drafts | Saving the note as a draft | `integrations.email_drafts` | Gmail or Outlook connector | The agent shows the text to copy |
| Film | Optional short film of the concept | `integrations.film` | A video skill (for example HyperFrames), or none | Skip the film |
| QR code | Walk-in leave-behind | `integrations.qr_code` | `qrencode`, any QR tool | Print the short link |

Write `none` for anything you don't use. If `integrations` names a skill, install that skill next to this one so the doctor can find it.

**Publishing.** Pages go to a private, noindexed folder on your own website, for example `https://yourbusiness.com/for/{company}`. The script copies the page into your website's git repo, commits, pushes and waits until the page is live.

1. Set `paths.site_repo` in `settings.json` to your website's git folder.
2. In `profile.json → delivery`, set `public_base_url` (for example `https://yourbusiness.com/for`), `publish_subdir` (the repo folder served at that URL, for example `public/for`) and `branch`.
3. Set `deploy_hook`:
   - `{"type": "none"}` for hosts that deploy when you push (Netlify, Vercel, Cloudflare Pages, GitHub Pages)
   - `{"type": "webhook", "url": "https://..."}` for hosts with a deploy hook URL
   - `{"type": "coolify", "uuid": "..."}` for Coolify (needs the `coolify` CLI)
4. Tell search engines to stay out of that folder. On Netlify or Cloudflare Pages, add to `_headers`:

   ```text
   /for/*
     X-Robots-Tag: noindex, nofollow
   ```

   On nginx, add a `location ^~ /for/` block with that header and `try_files $uri $uri/index.html =404;`, and set `noindex_nginx_check` to `nginx.conf` so the script checks it. Every page also carries a noindex meta tag. Never link these pages from your site, sitemap or `llms.txt`.

## Step 9b. Connect Treg, your browser and LinkedIn

Check each connection works before the first real company.

**Treg.** Sign up at [treg.to](https://treg.to/), add its MCP server (`https://treg.to/mcp/`) to your agent, and add credit. Then the agent checks the balance with Treg's `balance` tool. It should answer with your balance. If the tool is missing, the MCP server is not connected yet: check the agent's connector settings and restart it.

**Your browser.** Give your agent permission to use your browser: for example install the Claude in Chrome extension, or turn on your agent's browser tool. The agent then opens one ordinary page (for example your own website) and takes a screenshot to prove it works.

**LinkedIn.** Sign in to LinkedIn yourself in that browser. The agent never types your password. Then the agent opens your LinkedIn feed once to check you are signed in, and opens nothing else. Read the safe-use rules in `references/linkedin.md` together: LinkedIn pauses accounts that act like bots, so the agent reads lists rather than profiles, goes at a person's pace, and stops at the first warning.

## Step 9c. Your workspace and gallery

Every page belongs to a campaign, a folder in your workspace (`settings.json → paths.projects`, default `~/microsites`). The gallery shows them all.

1. Load the fictional sample campaign:

   ```bash
   python3 scripts/campaign.py demo
   ```

2. Start the gallery and open [http://127.0.0.1:4347](http://127.0.0.1:4347):

   ```bash
   node gallery/server.mjs
   ```

3. Look around together: **Today** (who needs something from you now), **Companies** (each page with its research, people and outreach kit), **People** (everyone you are talking to, with their steps), **Dashboard** (how far people get).
4. Create the campaigns you will use. For example:

   ```bash
   python3 scripts/campaign.py new direct --mode one --title "Direct"
   ```

   ```bash
   python3 scripts/campaign.py new jobs --mode job --title "Jobs"
   ```

   For many companies, create one campaign per search, for example `python3 scripts/campaign.py new uk-accountants --mode many --title "UK accountants"`. Your agent fills in its brief with you when you start it.
5. On a Mac, to keep the gallery running in the background and starting at login (optional):

   ```bash
   node gallery/install-service.mjs --install
   ```

The gallery only listens on your own computer. Its records (outreach progress, reviews, share links) stay in `<workspace>/.gallery/`.

## How pages match the prospect's own site

A page should look and feel like a page from the prospect's website. Every real page goes through three steps (your agent follows them from `SKILL.md`):

1. **Capture their live site** in a real browser: with your agent's own browser tool (run `scripts/design_probe.js` at desktop and phone size, save the results and screenshots, then `python3 scripts/capture_design.py URL PROJECT/design --from-probe desktop.json --phone-probe phone.json`), or in one command with agent-browser: `python3 scripts/capture_design.py https://their-site.com PROJECT/design`. It measures their fonts, colours, buttons, header bars, hero (including how the photo is framed and how dark the overlay is), cards, section bands and motion at desktop and phone size. If the site blocks the browser, it stops: the person opens the site in their own browser and runs `scripts/design_probe.js` there. Never build from newsletters or PDFs in its place.
2. **Build their look**: options in `company.json → design` (a top utility bar, a photo hero with overlay and frame, photo cards, a phone menu, motion, their own illustrations) plus a `theme.css` that can restyle anything. Your proof and about sections keep your wording but take their colours. Their logo goes on the report cover and footers. Your LinkedIn link comes from `provider.linkedin`.
3. **Score it**: `python3 scripts/fidelity.py PROJECT` (add `--ours desktop.json phone.json` when you measured your page with your own browser) must reach 80/100 at desktop and phone size, and the side-by-side image (`PROJECT/design/side-by-side.jpg`) must look like one site. The score is a floor; always look as well.

## Step 10. Test it

Run these in order. Each one must pass before the next.

**1. The doctor, with a sample build.**

```bash
python3 scripts/doctor.py --smoke
```

You want "Ready to build." It builds a page for a fictional prospect with **your** first offer, in a temporary folder. FIX lines block building; OFF lines are optional features.

**2. Look at a real page with your details.**

```bash
python3 page/build.py examples/sample-web-studio-page --offer your-offer-key
```

Use your offer's key from `offers.json` (for a `sprint` offer, use `examples/sample-sprint` instead). Open `examples/sample-web-studio-page/build/hartley-roofing.html` in a browser. The page is still prepared for the sample roofer; you are now the sender, selling your offer. Check your name, photo, offer wording, what is included and not, the steps, the price, proof, LinkedIn link and button. Delete the `build/` folder afterwards.

**3. The skill's own tests.**

```bash
python3 scripts/test_portability.py
```

This proves the skill works for any business. It fills the blank template, builds an offer page and a job page, fails if any Remote Humans detail shows up, and publishes and removes a test page on a local site.

```bash
python3 page/test_page.py
```

This builds pages for the two fictional businesses (a web studio and a recruiter) and checks each sells its own offer.

```bash
cd sprint && python3 -m unittest test_pipeline test_design
```

These check the sprint page rules (scope, banned words, reading level, images, privacy), the design options and the fidelity scorer. They always run against the fictional sample, whichever profile you use.

```bash
python3 scripts/test_campaign.py
```

```bash
node --test gallery/
```

These check campaigns (creating, adding, checking, the demo) and the gallery (campaigns, pages, checks, review, deploy and outreach tracking), using made-up data in temporary folders.

**4. A dry run on a real company.** Ask your agent: "Make a microsite for https://a-real-prospect.com." (or, for many companies, "Run a small campaign: find three companies like my ideal client in my area"). Check that it:

- reports a qualification score and go or no-go before building
- cites a source and date for every fact
- captures their live site first, and stops to ask you if the site blocks it
- builds a page that looks like the prospect's own site
- scores 80/100 or more with `scripts/fidelity.py` and shows you the side-by-side
- shows what they can pay, from their filed accounts, and why now, with dates
- names the person to contact, with how their email was checked
- writes the outreach card, and the company appears in the gallery
- asks you before publishing anything, and never contacts anyone

**5. A publishing test (if you set up publishing).** Publish a throwaway page, check it, then take it down:

```bash
scripts/deploy_private.sh test-yourname examples/sample-web-studio-page/build/hartley-roofing.html
```

```bash
scripts/unpublish_private.sh test-yourname
```

The first should print `LIVE` with your URL and no sitemap warning; the second should print `REMOVED`.

**You're set up when:**

- [ ] `doctor.py --smoke` says "Ready to build."
- [ ] The sample page shows your details and nothing of Remote Humans
- [ ] `test_portability.py` passes
- [ ] Treg answers, the agent can use your browser, and LinkedIn is signed in
- [ ] The gallery opens and shows the sample campaign
- [ ] A dry run on a real prospect captured their site, scored 80+ and produced a page you'd be happy to send, and it shows in the gallery
- [ ] (If publishing) a test page went live, was noindexed, and was removed

## When something goes wrong

| You see | Do this |
|---|---|
| `NOTE: no settings.json; using the ... profile` | Run step 1c |
| `Profile not found` | Check `profile` in `settings.json` matches a folder in `profiles/` |
| `FIX Profile ... unfilled placeholder` | Fill that `[[...]]` in the named file |
| `An official offer price is required` | Add a price in the page's currency to `offers.json` (sprint pages refuse estimates) |
| `The offer needs "..." in offers.json` | Answer that question from Step 3 and add it to your offer |
| `Lint failed` with a banned or hedge phrase | Reword that sentence in `company.json` or your `claims.json`, then rebuild |
| `agent-browser cannot start` or `is not installed` | Use your agent's own browser tool with `--from-probe` and `--ours` (`references/design.md`), or install agent-browser on a computer with a screen |
| `... blocked the browser` during capture | The site refuses automated visitors. Open it in your own browser and run `scripts/design_probe.js` there (see `references/design.md`); never try to get round the block |
| `FAIL fidelity` | Fix the MISS lines (fonts, colours, buttons, header, hero framing and darkness, cards, motion) in `company.json → design` and `theme.css`, rebuild, score again |
| `is not on main; switch branch before publishing` | Switch your website repo to the branch in `delivery.branch` |
| `Not live yet` | Check your host's deploy log; the page is committed and pushed already |
| The gallery is empty | Check `settings.json → paths.projects` points at your workspace, and that each campaign has `data/campaign.json` (`python3 scripts/campaign.py check`) |
| `node: command not found` | Install Node.js 20 or newer (Step 1b) |
| LinkedIn shows a CAPTCHA, a limit or a sign-out | Stop LinkedIn work for the day. Sign in again yourself tomorrow and keep the pace slow (`references/linkedin.md`) |

## Sharing the skill

To give the skill to someone else, build a clean copy from the skill folder:

```bash
bash scripts/package.sh
```

It writes `dist/microsite-skill-<date>.zip` with the skill, this guide, the blank template and the fictional sample, and leaves out your own profile, your settings, any real prospect examples and old files. It then unpacks the zip in a temporary folder and runs the tests there, so you know the copy works before you send it.
