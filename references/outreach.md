# Outreach: connect, talk, then share the page

The page earns a conversation. The aim of every step is a call with the right person. The provider sends every request and message themselves; the agent prepares, the gallery tracks.

## The steps

1. **Connect on LinkedIn, without a note.** Open the decision-maker's profile from the gallery and send a plain connection request. When the provider's profile fits what the person cares about, most accept without a note, and an empty request reads as a peer rather than a pitch. Then open the person in the gallery and click **LinkedIn request sent**.
2. **Wait for them to accept.** Check LinkedIn every few days. Click **They accepted** in the gallery when they do, or let the agent check for you (`linkedin.md`). If they have not accepted after about two weeks, use email instead (step 6).
3. **Send a short message.** Thank them for connecting, mention the one thing you noticed about their business (the card's `why_now`), and ask a light question. No link yet unless the message reads naturally with one.
4. **Share the page and a Loom.** Once they reply, or in the second message, share the private link and a short Loom video (about 90 seconds) walking through the page. The video shows there is a real person who did the work.
5. **Handwritten note (optional, high value).** For the best-fit companies, post a short handwritten card to their office with the page's QR code. It stands out because almost nobody does it.
6. **Email as well, or instead.** If they do not use LinkedIn, or have not accepted, email the work address found and checked in enrichment. Same content: the insight, the link, the Loom, one question.
7. **Follow up once, about a week later.** One short, friendly line. Then stop, and mark **Not now** in the gallery.
8. **Book the call.** When they say yes, send the booking link from the profile (`offers.json → booking_url`) and record **Call booked**.

Never send connection requests or messages in rapid bursts. LinkedIn pauses accounts that view or contact many people quickly, so spread them out over the day. Any LinkedIn work the agent does follows the safe-use rules in `linkedin.md`.

## What the agent prepares for each company

Write the card and kit into the campaign's `gallery/outreach-cards.json`, keyed by the company's `id`. Fill `{link}` and `{loom}` placeholders; the gallery fills them from the live link and `loom_url`.

```json
{
 "ashby-and-rowe": {
  "chip": "New Leeds office",
  "what": "Accountancy firm in York and Leeds. About 30 staff.",
  "pay": "£3.4m turnover, £610k operating profit (FY2026 accounts).",
  "why_now": "Opened a second office in Leeds in May.",
  "why_now_url": "https://...",
  "opportunity": "One or two sentences, revenue first.",
  "contact_why": "Helen Ashby, Managing Partner, signs off spend.",
  "opener": "First message, under 280 characters, with {link}.",
  "kit": {
   "contact": "Helen Ashby",
   "facts": ["three short facts to say on the Loom"],
   "beats": ["the order of the Loom"],
   "loom_script": "About 90 seconds, in the provider's voice.",
   "connection_note": "",
   "linkedin_dm": "The message after they accept.",
   "on_yes": "The reply with the booking link.",
   "email_to": "a checked work address",
   "email_subject": "Short and specific",
   "email_body": "The email version.",
   "follow_up_when": "day 7",
   "follow_up": "One friendly line."
  }
 }
}
```

Leave `connection_note` empty unless the provider asks for one. Write every message with the profile's `integrations.writing_voice` and `integrations.outreach_method`, in the company's own words where you can (their culture notes), and follow the prospect card contract in `outreach-clarity.md`. Also list the people to contact in `gallery/contact-seeds.json` as `[name, role, why they matter]`, decision-maker first.

## Tracking in the gallery

Click a person (on a company card, or in **People**) to track them: **LinkedIn request sent**, **They accepted**, then **DM sent**, **Replied**, **Call link** and **Booked**, or **Not now**. Each is saved with its date, and the message box keeps your draft. The **Today** view lists who needs something now: accepted requests to message, follow-ups due and replies. The **Dashboard** shows how many people reach each step, so the provider can see where people drop off. The agent can keep connections and messages up to date for them with `linkedin.md`.
