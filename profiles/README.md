# Profiles: who sends the microsite

A profile is everything about the person and business sending the page. The skill's method, templates and scripts are shared; a profile makes them yours. `_template/` is the blank starting point; `SETUP.md` interviews you to fill it. Three fictional examples show it fitting different businesses: `sample-web-studio/` (a project with a fixed price), `sample-recruiter/` (a service priced as a percentage) and `sample-studio/` (a discovery offer with a report page). `_template/` is copied (`python3 scripts/provider.py new your-business` copies it and selects it in `settings.json`).

| File | What it holds | Used by |
|---|---|---|
| `profile.json` | What you use it for (`use_for`), name, contact, photo, bio, brand accent, how you reach out (`outreach`), booking defaults, who you sell to (`qualification`), research sources, delivery host, skills and connectors per step, voice rules | Every script and reference |
| `offers.json` | Each offer in your words: what it is, who it is for, the result, what is included and not, the steps, length, price or price wording, button and booking link, and its page type | `page/build.py`, `{{PRICE:offer}}`, `{{BOOK:offer}}` |
| `offers.md` | When to choose each offer, what it must never promise, and its live source | Choosing the offer and writing the page |
| `claims.json` | Locked wording on every page: proof tiles, about facts, client logos, banned and hedge phrases, reading level. A `sprint` offer also keeps its scope, method beats and report defaults here | `page/build.py`, the lint |
| `method.md` | Your method's labels, verbatim | Template pages |
| `notes.md` | Where you are, proof per sector, proof facts, accounts agents may use | Research and delivery |
| `photo.jpg` | Your photo (square-ish, at least 800 px) | Hero and about |
| `art/` | Transparent PNG logos and art (`claims.json` logos, `proof_art`) | Page builders |
| `logos/` | Client logos for job-mode pages (`about.client_logos`) | `{{CLIENT_LOGOS}}` |
| `proof/` | Proof stories (`stories.json` plus images), custom slides (`custom/<id>.html`) and `built-with.json` | Proof carousel |
| `sections/` (optional) | Your own versions of `templates/sections/*.html`, used before the shared ones | Page builder |

Choose the active profile with `settings.json` (`"profile": "name"` or a path) or the `MICROSITE_PROFILE` environment variable. `python3 scripts/doctor.py` checks a profile is complete.
