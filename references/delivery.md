# Delivery

Every publish, send, post or contact needs the provider's explicit approval for that action. Hosts, URLs and the skills for notes and drafts come from the active profile (`delivery`, `integrations`) and `settings.json`.

## Private link (default)

1. In the page `<head>`: `<meta name="robots" content="noindex, nofollow">`, a description, Open Graph and Twitter tags with an absolute `og:image` at `{public_base_url}/{slug}/og.jpg`, and the provider's favicon (the job-mode template fills these from the profile).
2. Make `og.jpg` (1200×630) from the hero: headless Chrome at `--window-size=1200,630 --force-device-scale-factor=2 --force-prefers-reduced-motion`, then resize.
3. Publish with `scripts/deploy_private.sh {slug} page.html og.jpg [film.mp4]`. It copies files to `{paths.site_repo}/{delivery.publish_subdir}/{slug}/`, commits only those files, pushes `delivery.branch` (refusing if the repo is on another branch), runs the deploy hook (`coolify`, a `webhook` URL, or `none` for hosts that deploy on push), waits for the page's own title (some hosts answer unknown paths with the site shell, so a 200 alone proves nothing), and checks the noindex header and the sitemap. With no website repo, hand the provider the self-contained HTML to upload.
4. The host should serve the private folder with `X-Robots-Tag: noindex, nofollow` (nginx: a `location ^~ /for/` block with `try_files $uri $uri/index.html =404;`; Netlify or Cloudflare Pages: a `_headers` rule). Set `delivery.noindex_nginx_check` to make the script refuse when that nginx block is missing.
5. Confirm on desktop and iPhone emulation against the live URL. File the link where the profile's `integrations.memory` says.

Never link these pages from the public site, sitemap or llms.txt.

## Through an intermediary

When a recruiter or agency represents the provider, send them the link (and film) to forward. Draft the note with the profile's `integrations.writing_voice`; keep it short, warm and founder-led. Do not contact the end client directly unless the provider decides to.

## Direct to a prospect

Draft a short note with the profile's `integrations.outreach_method` for method and `integrations.writing_voice` for voice: the single strongest insight about them, the link, and the call to action for the mode. The provider approves and sends.

## Walk-in pack

- **Leave-behind**: one A4 or A5 page in their brand: title, the strongest insight, three ideas, the engagement offer, the provider's photo and contact, and a QR code to the private page, made with the profile's `integrations.qr_code` (or `qrencode`).
- **Offline copy**: the built page is self-contained; copy it to the provider's phone or tablet so it opens without signal.
- **30-second opener**: in the provider's voice, built on the strongest insight and ending with a question.

## Backup formats

If their IT blocks links, run `scripts/export_pdf.sh page.html page.pdf` (reduced motion, so animated elements print in their final state). Sliders and carousels become static.

## Taking a page down

When an opportunity closes, `scripts/unpublish_private.sh {slug}` removes it and redeploys (the provider approves first).
