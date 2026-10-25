# LinkedIn: safe use, and keeping the gallery up to date

## What the agent needs

The agent uses LinkedIn through the provider's own browser: their browser tool or connector (for example Claude in Chrome, or Codex's browser), with LinkedIn signed in there. The provider gives the agent permission to use that browser and signs in themselves. The agent never types a LinkedIn password. If LinkedIn shows a login screen, CAPTCHA or warning, the agent stops and tells the provider.

## Safe use: never look like a bot

LinkedIn watches for automated use. Fast or repetitive actions can get the provider's account restricted or paused, which costs them their network. Every LinkedIn step in this skill follows these rules:

- **Read lists, not profiles.** Use Connections, Sent invitations, search results and messages. Open at most 5 individual profiles in one session. About 75 profile visits in ten minutes has locked an account.
- **Go slowly.** Pause several seconds between actions, like a person reading. Never page through results quickly or open many tabs at once.
- **Connect at a person's pace.** The provider normally sends requests. If they ask the agent to send some for them, get their OK for the exact list first, then space them out over the day with a few minutes between each, rather than many in a row. Send no note unless they asked for one.
- **Messages are never sent in bulk.** One person at a time, each one approved by the provider.
- **One session at a time.** Never run LinkedIn work in parallel helpers.
- **Stop at the first warning.** A CAPTCHA, a "you've reached the limit" message, an unusual-activity notice or a sign-out means stop for the day and tell the provider.


The provider sends every connection request and message themselves. This check reads their LinkedIn and records what happened in the gallery: who accepted, who is still pending, and new messages. It never sends, accepts, withdraws, reacts or follows.

Run it when the provider asks ("check LinkedIn for my microsite contacts"), or schedule it once or twice a day with the agent's own scheduler. The computer and a signed-in browser must be available.

## Keeping the gallery up to date

### Before you start

- The gallery is running (`node gallery/server.mjs`, default `http://127.0.0.1:4347`).
- The browser is signed in to the provider's LinkedIn (above).
- Get every contact the gallery knows: `GET http://127.0.0.1:4347/api/contact-tracker`. Use this light endpoint rather than the full gallery.

### The check

1. **Connections.** Open the provider's own Connections list, sorted by recently added, back to the last check. A contact whose exact profile link appears there is `connected`. For a hand-added contact without a saved link, a unique exact first and last name match also counts; save that profile link with `action: "save"` and the contact `key`.
2. **Sent invitations.** An exact profile in Sent invitations, with its Withdraw button, is `pending`. A Message button, or a profile missing from invitations, does not prove acceptance. Leave anything you did not see unchanged.
3. **Messages.** For known gallery contacts only, read recent conversations. Record new messages the provider sent and replies they received, with the exact text. Use the message's own date; if none is shown, use the time you saw it and say so (`time_basis: "observed"`).
4. **Keep the provider's work.** Never change drafts, notes, follow-up dates or "do not contact" decisions.
5. **Follow the safe-use rules above.** Lists only, at most five profiles, slowly.

### Recording what you saw

A connection, as JSON to `POST /api/contact-tracker`:

```json
{"action": "check_connection", "company_id": "direct~ashby-and-rowe", "profile_url": "https://www.linkedin.com/in/...",
 "connection": "connected", "checked_at": "2026-10-24T10:00:00Z", "evidence": "Exact profile link in my own Connections list"}
```

A message: `action: "add_event"` with an `event` holding `id`, `kind` (`dm_sent`, `reply_received` or `note`), `body` and `at`. The gallery ignores an event ID it already has, so use a stable ID: the message's own ID if visible, otherwise one built from the profile, direction, text and date.

After each run, post to `POST /api/contact-monitor` with `status` (`ok`, `partial`, `login_needed` or `error`), `checked_at` and a plain `coverage` line saying what you checked. Only claim what you actually saw.

Then tell the provider about new acceptances, replies and anything that needs them. Stay quiet when nothing changed.
