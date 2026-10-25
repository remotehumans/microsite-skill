# ABOUTME: Builds one self-contained "prepared for" page from a project folder: page source, sections, shared components and config.
# ABOUTME: Usage: python3 build_page.py /path/to/project  (reads project/config.json; inlines images, logos and tools as data URIs).
import base64
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import provider

SKILL = Path(__file__).resolve().parent.parent
TEMPLATES = SKILL / "templates"
ASSETS = SKILL / "assets"
PROFILE = provider.load()
PROOF = provider.path("proof")

# Hover colours for Simple Icons logos; logos render monochrome until hovered.
BRAND = {"claude": "#D97757", "openai": "#10A37F", "googlegemini": "#8E75B2", "openrouter": "#6566F1", "cursor": "#000000",
         "github": "#181717", "python": "#3776AB", "typescript": "#3178C6", "swift": "#F05138", "react": "#087EA4",
         "expo": "#000020", "figma": "#F24E1E", "supabase": "#3ECF8E", "n8n": "#EA4B71", "make": "#6D00CC",
         "notion": "#000000", "googledrive": "#4285F4", "tailscale": "#242424", "linux": "#1d1d1b", "docker": "#2496ED",
         "cloudflare": "#F38020", "apple": "#000000", "caldotcom": "#292929", "obsidian": "#7C3AED",
         "elevenlabs": "#000000", "nvidia": "#76B900", "microsoft365": "#0078D4", "hetzner": "#D50C2D",
         "coolify": "#6B16ED", "railway": "#0B0D0E", "uptimekuma": "#5CDD8B", "appstore": "#0D96F6"}
# PNG logos that are light gradients and need a solid silhouette to sit with the monochrome set.
SILHOUETTE = {"hyperframes", "fish"}
ABOUTME = re.compile(r"<!-- ABOUTME:.*?-->\n?")


def data_uri(path: Path, width: int | None = None) -> str:
    """Inline a file as a data URI; with width, re-encode as a JPEG no wider than width to keep the page light."""
    if not path.exists():
        raise SystemExit(f"Missing asset: {path}")
    if width:
        jpg = subprocess.run(["magick", str(path), "-resize", f"{width}x>", "-quality", "82", "-strip", "jpg:-"],
                             check=True, capture_output=True).stdout
        return "data:image/jpeg;base64," + base64.b64encode(jpg).decode()
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp"}
    return f"data:{mime.get(path.suffix.lower(), 'application/octet-stream')};base64," + base64.b64encode(path.read_bytes()).decode()


def tool(slug: str, label: str) -> str:
    svg = (ASSETS / "logos" / f"{slug}.svg").read_text()
    svg = re.sub(r"<title>.*?</title>", "", svg).replace("<svg ", '<svg aria-hidden="true" fill="currentColor" ', 1)
    return f'<span class="tool" style="--b:{BRAND.get(slug, "#1d1d1b")}">{svg}<em>{label}</em></span>'


def tool_png(name: str, label: str) -> str:
    cls = "tool-png sil" if name in SILHOUETTE else "tool-png"
    return f'<span class="tool"><img class="{cls}" src="{data_uri(ASSETS / "logos" / (name + ".png"))}" alt=""><em>{label}</em></span>'


def fill_tokens(html: str, project: Path, images: dict) -> str:
    """Replace asset tokens. IMG names come from config.images (project-relative); PROOF comes from the profile, LOGOIMG from the skill assets."""
    html = ABOUTME.sub("", html)
    html = provider.fill(html, PROFILE)
    html = re.sub(r"\{\{IMG:([\w-]+)\}\}", lambda m: data_uri(project / images[m.group(1)], 1600), html)
    html = re.sub(r"\{\{PROOF:([\w./-]+)\}\}", lambda m: data_uri(PROOF / m.group(1), 1200), html)
    html = re.sub(r"\{\{LOGOIMG:([\w-]+)\}\}", lambda m: data_uri(ASSETS / "logos" / f"{m.group(1)}.png"), html)
    html = re.sub(r"\{\{TOOL:(\w+):([^}]+)\}\}", lambda m: tool(m.group(1), m.group(2)), html)
    html = re.sub(r"\{\{TOOLPNG:([\w-]+):([^}]+)\}\}", lambda m: tool_png(m.group(1), m.group(2)), html)
    return html


SYMBOL = {"GBP": "£", "USD": "$", "EUR": "€", "AUD": "A$", "CAD": "C$", "SGD": "S$", "THB": "฿", "AED": "AED ", "CHF": "CHF ", "NZD": "NZ$"}


def price(offer: str, currency: str, notes: list) -> str:
    """Return the offer's price for the page's currency: the provider's set price if there is one, else a labelled live-rate estimate."""
    o = provider.offers()[offer]
    if currency in o["prices"]:
        return o["prices"][currency]
    base = o["base"]
    url = f"https://open.er-api.com/v6/latest/{base['currency']}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "remote-humans-microsite"}), timeout=20) as r:
        fx = json.loads(r.read())
    local = round(base["amount"] * fx["rates"][currency] / 10) * 10
    notes.append(f"{o['label']}: no {currency} price set; showing a live-rate estimate ({fx['time_last_update_utc'][:16]}). Ask {PROFILE['provider']['first_name']} for an official {currency} price.")
    base_sym = "US$" if base["currency"] == "USD" else SYMBOL.get(base["currency"], base["currency"] + " ")
    return f"{base['prefix']}about {SYMBOL.get(currency, currency + ' ')}{local:,} ({base_sym}{base['amount']:,})"


def photo_hero(page: str, hero: dict, project: Path) -> str:
    """Swap the portrait-and-skyline hero for a full-bleed hero built from the company's own photos (mirrors photo-led sites)."""
    m = re.search(r'<div class="wrap">\s*<div class="hero">.*?<div class="sky" id="sky" aria-hidden="true"></div>\s*</div>\s*</div>', page, re.S)
    if not m:
        raise SystemExit("Hero block not found for photo hero")
    block = m.group(0)

    def grab(pat: str) -> str:
        found = re.search(pat, block, re.S)
        return found.group(1).strip() if found else ""

    eyebrow = grab(r'<div class="eyebrow">(.*?)</div>')
    title = re.sub(r"<[^>]+>", "", grab(r"<h1>(.*?)</h1>"))
    intro = grab(r'<p class="intro">(.*?)</p>')
    byline = grab(r'<div class="byline">(.*?)</div>')
    imgs = "".join(f'<img class="ph-img{" on" if k == 0 else ""}" src="{data_uri(project / src, 1800)}" alt="">' for k, src in enumerate(hero["images"]))
    dots = "".join('<span class="on"></span>' if k == 0 else "<span></span>" for k in range(len(hero["images"])))
    html = (f'<div class="phero" id="phero">\n  <div class="ph-slides">{imgs}</div>\n'
            f'  <div class="wrap ph-inner"><div class="ph-card">\n    <div class="eyebrow">{eyebrow}</div>\n    <h1>{title}</h1>\n'
            f'    <p class="intro">{intro}</p>\n    <div class="ph-me"><img src="{{{{PHOTO}}}}" alt="{PROFILE['provider']['person']}"><div class="byline">{byline}</div></div>\n'
            f'  </div></div>\n  <div class="ph-dots">{dots}</div>\n  <p class="ph-credit">{hero.get("credit", "")}</p>\n</div>')
    return page.replace(block, html, 1)


DEFAULT_PROOF = PROFILE.get("proof_default", [])
# Booking buttons go to the default offer's call, tagged with the page's company so bookings trace back to it.
BOOKING = PROFILE["booking"]
GENERIC_CALL = re.compile(BOOKING["legacy_link_pattern"]) if BOOKING.get("legacy_link_pattern") else None
SPRINT_CALL = provider.offers()[BOOKING["default_offer"]]["booking_url"]


def booking_link(cfg: dict, project: Path, full: bool) -> str:
    booking = cfg.get("booking", {})
    url = booking.get("url", SPRINT_CALL)
    query = f"metadata[utm_source]={BOOKING.get('utm_source', 'microsite')}&metadata[utm_campaign]=" + urllib.parse.quote(booking.get("campaign", project.name))
    link = f"{url}?{query}"
    return link if full or not BOOKING.get("short_prefix") else link.replace(BOOKING["short_prefix"], "")
TAB_COLOURS = ["var(--red)", "#1d1d1b", "var(--orange)", "var(--teal)", "var(--green)", "var(--blue)", "var(--dgreen)"]


def proof_carousel(ids: list[str]) -> str:
    """Build the proof carousel from the profile's results library (proof/stories.json) and custom slides (proof/custom/<id>.html)."""
    stories = {s["id"]: s for s in json.loads((PROOF / "stories.json").read_text())}
    built_with = json.loads((PROOF / "built-with.json").read_text()) if (PROOF / "built-with.json").exists() else {}
    tabs, slides = [], []
    for k, pid in enumerate(ids):
        colour = TAB_COLOURS[k % len(TAB_COLOURS)]
        custom = PROOF / "custom" / f"{pid}.html"
        if custom.exists():
            raw = custom.read_text()
            tab = re.search(r"<!-- TAB: (.*?) -->", raw).group(1)
            slide = re.sub(r"<!-- (TAB|ABOUTME):.*?-->\n?", "", raw)
        elif pid in stories:
            s = stories[pid]
            tab = re.split(r"[:.]", s["title"])[0].strip()
            if tab.lower().startswith(("ai coaching", "ai coding", "ai agents", "ai creative")):
                tab = s["person"].split("·")[0].strip()  # generic titles: name the client instead
            facts = "".join(f"<li><b>{f['value']}</b> {f['label'].lower()}</li>" for f in s.get("facts", [])[:3])
            tools = "".join(f"{{{{TOOL:{slug}:{label}}}}}" for slug, label in built_with.get(pid, []))
            tools_html = f'<div class="built-with"><span>Built with</span>{tools}</div>' if tools else ""
            img = Path(s["image"]["src"]).with_suffix(".jpg").name
            slide = (f'<article class="slide"><div class="sl-media wide"><img src="{{{{PROOF:stories/{img}}}}}" alt="{s["image"]["alt"]}"></div>'
                     f'<div class="sl-text"><div class="sl-kind">{s["type"]} · {s["person"]}</div><h3>{s["title"].rstrip(".")}</h3>'
                     f'<p>{s["lead"]}</p>{"<ul>" + facts + "</ul>" if facts else ""}{tools_html}'
                     f'<p class="sl-more"><a href="{PROFILE['provider']['story_url'].format(id=pid)}" target="_blank" rel="noopener">Read the full story →</a></p></div></article>')
        else:
            raise SystemExit(f"Unknown proof id: {pid} (see the profile's proof/stories.json and proof/custom/)")
        on = " on" if k == 0 else ""
        tabs.append(f'<button class="{on.strip()}" data-k="{k}" style="--c:{colour}">{tab}</button>')
        slides.append(slide.replace('<article class="slide', f'<article class="slide{on}', 1))
    return ('<div class="car-tabs" role="tablist">' + "".join(tabs) + '</div>\n<div class="car-track" id="carTrack">\n'
            + "\n".join(slides) + "\n</div>")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 build_page.py /path/to/project")
    project = Path(sys.argv[1]).resolve()
    cfg = json.loads((project / "config.json").read_text())
    images = cfg.get("images", {})

    page = (project / cfg.get("page", "page.src.html")).read_text()
    # Sections are inserted before an anchor, replace an existing <section id>, or drop one.
    for sec in cfg.get("sections", []):
        if "drop" in sec:
            page = re.sub(r'<section id="' + re.escape(sec["drop"]) + r'"[^>]*>.*?</div></section>\n?', "", page, count=1, flags=re.S)
            page = re.sub(r'<a href="#' + re.escape(sec["drop"]) + r'">[^<]*</a>', "", page)
            continue
        # Project copy first, then the profile's own offer sections, then the shared templates.
        path = next((p for p in (project / sec["file"], provider.path(sec["file"])) if p.exists()), TEMPLATES / sec["file"])
        html = fill_tokens(path.read_text(), project, images)
        if "replace" in sec:
            pattern = re.compile(r'<section id="' + re.escape(sec["replace"]) + r'"[^>]*>.*?</div></section>', re.S)
            if not pattern.search(page):
                raise SystemExit(f"Section to replace not found: {sec['replace']}")
            page = pattern.sub(lambda _: html, page, count=1)
        else:
            if sec["before"] not in page:
                raise SystemExit(f"Anchor not found for {sec['file']}: {sec['before']}")
            page = page.replace(sec["before"], html + "\n" + sec["before"], 1)
    # Location: prices in the prospect's currency and the page language tag.
    locale = cfg.get("locale", {})
    notes: list = []
    page = re.sub(r"\{\{PRICE:([\w-]+)\}\}", lambda m: price(m.group(1), locale.get("currency", "GBP"), notes), page)
    page = re.sub(r'<html lang="[^"]*"', f'<html lang="{locale.get("lang", "en-GB")}"', page, count=1)
    hero = cfg.get("hero", {})
    if hero.get("variant") == "photo":
        page = photo_hero(page, hero, project)
    if "{{PROOF_CAROUSEL}}" in page:
        page = page.replace("{{PROOF_CAROUSEL}}", fill_tokens(proof_carousel(cfg.get("proof", DEFAULT_PROOF)), project, images))

    # Brand palette: override CSS custom properties in :root with the company's colours.
    for name, value in cfg.get("palette", {}).items():
        page = re.sub(rf"--{re.escape(name)}:#[0-9A-Fa-f]{{3,8}}", f"--{name}:{value}", page, count=1)

    page = page.replace("</style>", (TEMPLATES / "components.css").read_text() + "\n" + cfg.get("extra_css", "") + "\n"
                        + ((project / cfg["theme"]).read_text() if cfg.get("theme") else "") + "\n</style>", 1)
    # Brand font: swap the template's Montserrat for a Google Fonts family (use a free lookalike for licensed fonts).
    font = cfg.get("font")
    if font:
        page = re.sub(r'https://fonts\.googleapis\.com/css2\?family=Montserrat[^"]*', font["google"], page, count=1)
        page = page.replace("Montserrat", font["family"])
    page = page.replace("</body>", "<script>\n" + (TEMPLATES / "components.js").read_text() + "\n</script>\n</body>", 1)
    page = page.replace("{{LOGO}}", data_uri(project / cfg["logo"]))
    page = page.replace("{{PHOTO}}", data_uri(provider.path(PROFILE["provider"]["photo"])))
    page = fill_tokens(page, project, images)
    page = re.sub(r"<!-- ABOUTME: Source template;.*?-->", "<!-- ABOUTME: Self-contained build with images inlined. -->", page)

    if GENERIC_CALL:
        page = GENERIC_CALL.sub(lambda m: booking_link(cfg, project, m.group(0).startswith("https://")), page)

    leftover = sorted(set(re.findall(r"\{\{[A-Z]+[:}][^}]*\}?\}", page)))
    placeholders = sorted(set(re.findall(r"\[\[(?!['\"\[])[^\]]{1,60}\]\]", page)))
    if placeholders:
        raise SystemExit(f"Unfilled placeholders: {placeholders[:10]}")
    if leftover:
        raise SystemExit(f"Unreplaced tokens: {leftover}")
    out = project / cfg["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
    for n in notes:
        print("NOTE:", n)


if __name__ == "__main__":
    main()
