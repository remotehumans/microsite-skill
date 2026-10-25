# Offers and page types

Every page sells one of the provider's own offers, in their words. The offers live in the profile's `offers.json` (what it is, who it is for, the result, what is included and not, the steps, the price and the button); `offers.md` says when to choose each and what never to promise. Live offer pages are the source of truth: re-read them before writing a page and never promise more than they do.

## Choosing the offer

Pick the offer whose `for` line and `outcome` fit what you found about the company, not the wording of the request. Set it as `offer` in the project's `company.json`. If two fit, choose the smaller first step and say why in your report. If none fits, tell the provider rather than stretching one.

## Page types

Each offer names its page type in `offers.json → page`:

| Page type | For | Built with | Content contract |
|---|---|---|---|
| `standard` | Most offers: a project, service, retainer, product, audit, workshop or anything else | `python3 page/build.py PROJECT` | `page/company.schema.md` |
| `sprint` | A fixed discovery offer whose deliverable is a report, shown as a page-turning report book | `python3 page/build.py PROJECT` (hands over to `sprint/build_sprint.py`) | `sprint/company.schema.md`, `references/sprint-page.md` |
| `template` | Job and contract applications, and older hand-built offer pages | `python3 scripts/build_page.py PROJECT` from `templates/page.src.html` | `references/page.md` |

## How a standard page fits the offer

The sections stay in the same order; what each says follows the kind of offer:

| Section | Project (a website, a build) | Service or retainer (recruiting, bookkeeping, support) | Product or tool | Audit, review or workshop |
|---|---|---|---|---|
| Hero | Their goal, and the result of the project | Their goal, and what the service keeps true for them | Their goal, and what the product changes | Their goal, and what they will know or be able to do after |
| What we noticed | Three dated facts that make the project timely | Three facts that show the need now (hiring, growth, strain) | Three facts that show the problem the product solves | Three facts that raise the question the audit answers |
| Where we would start | The parts of the project with the most value first | The roles, tasks or areas you would take on first | The uses that matter most for them | The questions you would look at first |
| One example | One of their own pages, documents or processes before and after | One of their own open roles or tasks done your way | Their own case worked through the product | One finding you can already see from the outside |
| What you get | The thing delivered, what is included and not, the steps | What the service includes, how often, and the steps | What they get, set-up, and the steps | The report, session or plan, and the steps |
| Price and next step | Fixed price or "from" | A percentage, a monthly fee or "priced on a call" | The price or plan | The fee |

Keep every claim on the page true to the source (`research.md`), and the price and wording true to `offers.json`.

## Job and contract applications

The template page in job mode: the hero is "The first 90 days at {company}", the opening insight is why the role exists, the example is a worked piece of their real work, and the plan is the first weeks of the role. The call to action goes through the recruiter when there is one. Rate maths stays private and never appears on the page.

Use "I" for the provider's personal practice and "we" where the business speaks.
