# ABOUTME: Checks this machine and the active profile are ready to build, check and publish microsites, and says what each missing piece affects.
# ABOUTME: Usage: python3 scripts/doctor.py [--smoke]  (--smoke also builds and lints the fictional sample example with your profile in a temp folder).
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import provider

SKILL = provider.SKILL
results = []  # (level, area, message): level is ok, fail (blocks building), warn (a feature is off)


def report(level, area, message):
    results.append((level, area, message))


def placeholders(path):
    return sorted(set(re.findall(r"\[\[[^\]]{1,80}\]\]", path.read_text()))) if path.exists() else []


def check_machine():
    if sys.version_info < (3, 10):
        report("fail", "Python", f"Python 3.10 or newer is needed (found {sys.version.split()[0]})")
    else:
        report("ok", "Python", sys.version.split()[0])
    if shutil.which("magick"):
        report("ok", "ImageMagick", "magick found")
    else:
        report("fail", "ImageMagick", "Install ImageMagick 7 (magick): every build resizes and inlines images with it")
    if not provider.SETTINGS.exists():
        report("warn", "Settings", "No settings.json: copy settings.example.json (SETUP.md, step 1)")
    else:
        report("ok", "Settings", str(provider.SETTINGS))


def check_tools(profile):
    browser = provider.tool("browser", "agent-browser")
    if shutil.which(browser):
        report("ok", "Browser", f"{browser} found: design capture, visual QA and logged-in research work")
    else:
        report("warn", "Browser", f"{browser} not found: use your agent's own browser tool with design_probe.js for capture and scoring (references/design.md)")
    node = shutil.which("node")
    version = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip() if node else ""
    if node and int(version.lstrip("v").split(".")[0] or 0) >= 20:
        report("ok", "Gallery", f"Node.js {version}: start the gallery with node gallery/server.mjs")
    else:
        report("warn", "Gallery", "Node.js 20 or newer not found: install it (nodejs.org) to use the gallery dashboard")
    work = Path(provider.settings().get("paths", {}).get("projects") or "~/microsites").expanduser()
    campaigns = [p.name for p in work.glob("*/data/campaign.json")] if work.exists() else []
    report("ok", "Campaigns", f"{work}: {len(campaigns)} campaign(s)" if work.exists() else f"{work} will be created by scripts/campaign.py new")
    image = provider.tool("image", "codex")
    if image == "none":
        report("warn", "Images", "Image generation is off: use the company's own imagery for the wow moment")
    elif image == "codex":
        report("ok" if shutil.which("codex") else "warn", "Images",
               "codex found: AI concept variations work" if shutil.which("codex") else "codex not found: set tools.image to a command or none")
    else:
        report("ok", "Images", f"Custom image command: {image[:60]}")
    chrome = provider.tool("chrome", "")
    found = chrome or next((c for c in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                                         shutil.which("google-chrome") or "", shutil.which("chromium") or ""] if c and Path(c).exists()), "")
    report("ok" if found else "warn", "Chrome", "Chrome found: PDF backups and share images work" if found else "No Chrome or Chromium: PDF backup and share image are off")
    site = Path(provider.settings().get("paths", {}).get("site_repo", "") or "/nonexistent").expanduser()
    hook = profile["delivery"].get("deploy_hook", {}).get("type", "none")
    if not (site / ".git").exists():
        report("warn", "Publishing", "No website repo in settings paths.site_repo: hand over the HTML file or upload it yourself")
    elif hook == "coolify" and not shutil.which("coolify"):
        report("warn", "Publishing", "deploy_hook is coolify but the coolify CLI is missing")
    else:
        report("ok", "Publishing", f"{site} on deploy hook '{hook}'")
    for step, value in profile.get("integrations", {}).items():
        skill = re.match(r"([a-z0-9-]+) skill", value or "")
        if skill and not (SKILL.parent / skill.group(1) / "SKILL.md").exists():
            report("warn", "Connectors", f"{step}: {value} is not installed next to this skill")
        elif "[[" in (value or ""):
            report("warn", "Connectors", f"{step}: not chosen yet")
        else:
            report("ok", "Connectors", f"{step}: {value}")


def check_profile(profile):
    d = provider.active()
    report("ok", "Profile", f"{d.name}: {profile['provider']['person']}, {profile['provider']['business']}")
    if d.name in provider.DEFAULT_PROFILES:
        report("warn", "Profile", f"This is the {d.name} example profile; pages will say {profile['provider']['person']}. Create yours with provider.py new (SETUP.md)")
    for name in ("profile.json", "offers.json", "claims.json", "offers.md", "method.md", "notes.md"):
        left = placeholders(d / name)
        if left:
            report("fail", "Profile", f"{name} has {len(left)} unfilled placeholder(s), e.g. {left[0]}")
    if not (d / profile["provider"]["photo"]).exists():
        report("fail", "Profile", f"Missing photo: {profile['provider']['photo']}")
    offers = {k: v for k, v in provider.offers().items() if not k.startswith("_")}
    if not offers:
        report("fail", "Offers", "offers.json has no offers yet (SETUP.md, step 3)")
    claims = provider.claims()
    for key, offer in offers.items():
        if not str(offer.get("booking_url", "")).startswith("https://"):
            report("fail", "Offers", f"{key}: booking_url must be an https link")
        if "prices" in offer and (not offer["prices"] or offer.get("base", {}).get("amount", 0) <= 0):
            report("fail", "Offers", f"{key}: set at least one price and a base amount above 0")
        before = len(results)
        if offer.get("page") == "template":
            pass  # built from templates/page.src.html with scripts/build_page.py, like job pages
        elif offer.get("page") == "sprint":
            if claims.get("scope", {}).get("price_key") != key:
                report("fail", "Offers", f"{key}: the sprint page needs claims.json scope.price_key set to '{key}' and the sprint wording in claims.json")
        else:
            missing = [f for f in ("label", "outcome", "deliverable", "includes", "steps", "button") if not offer.get(f)]
            if missing:
                report("fail", "Offers", f"{key}: add {', '.join(missing)} (SETUP.md, step 3)")
            if "prices" not in offer and not offer.get("price_text"):
                report("fail", "Offers", f"{key}: set prices, or price_text such as \"Priced on a call\"")
        if not any(r[0] == "fail" for r in results[before:]):
            report("ok", "Offers", f"{key}: {offer.get('label', key)} ({offer.get('page', 'standard')} page)")
    art = [d / "art" / logo["file"] for logo in claims.get("logos", [])]
    # Illustrations can come from the profile's art folder or the skill's shared one, as in the builder.
    if claims.get("proof_art") and not (SKILL / "assets/art" / f"{claims['proof_art']}.png").exists():
        art.append(d / "art" / f"{claims['proof_art']}.png")
    art += [d / logo["file"] for logo in profile["about"].get("client_logos", [])]
    for path in art:
        if not path.exists():
            report("fail", "Profile", f"Missing image: {path.relative_to(d)}")
    stories = json.loads((d / "proof/stories.json").read_text()) if (d / "proof/stories.json").exists() else []
    known = {s["id"] for s in stories} | {p.stem for p in (d / "proof/custom").glob("*.html")}
    for pid in profile.get("proof_default", []):
        if pid not in known:
            report("fail", "Proof", f"proof_default id '{pid}' has no story or custom slide")
    report("ok", "Proof", f"{len(known)} proof stories or slides; {len(claims['proof_tiles'])} sprint proof tiles")
    q = profile["qualification"]
    report("ok", "Qualifying", f"{len(q['criteria'])} criteria, go at {q['go_threshold']}+ ({q['scale']})")
    enabled = [s for s in profile["research"]["sources"] if s.get("enabled", True)]
    report("ok", "Research", f"{len(enabled)} of {len(profile['research']['sources'])} source rows on, country {profile['research']['country']}")


def smoke():
    """Build and lint a fictional sample prospect with this profile's first offer, in a temp folder."""
    key, offer = next((k, v) for k, v in provider.offers().items() if not k.startswith("_"))
    sample = "sample-sprint" if offer.get("page") == "sprint" else "sample-web-studio-page"
    with tempfile.TemporaryDirectory() as tmp:
        project = Path(tmp) / sample
        shutil.copytree(SKILL / "examples" / sample, project, ignore=shutil.ignore_patterns("build", "qa"))
        company = json.loads((project / "company.json").read_text())
        company["offer"] = key
        company["currency"] = next(iter(offer.get("prices", {})), company["currency"])
        (project / "company.json").write_text(json.dumps(company))
        run = subprocess.run([sys.executable, str(SKILL / "page/build.py"), str(project)], capture_output=True, text=True)
        lines = (run.stdout + run.stderr).strip().splitlines()
        if run.returncode:
            report("fail", "Smoke build", " | ".join(line for line in lines if not line.startswith("NOTE:"))[:400])
        else:
            report("ok", "Smoke build", f"Built and linted a sample page for your {offer.get('label', key)} offer (" + lines[-1].split(" (")[-1])


def main():
    profile = provider.load()
    check_machine()
    check_profile(profile)
    check_tools(profile)
    if "--smoke" in sys.argv:
        smoke()
    marks = {"ok": "OK  ", "warn": "OFF ", "fail": "FIX "}
    for level, area, message in results:
        print(f"{marks[level]} {area:<12} {message}")
    failed = [r for r in results if r[0] == "fail"]
    print(f"\n{'Ready to build.' if not failed else f'{len(failed)} thing(s) to fix before building.'} "
          f"{sum(r[0] == 'warn' for r in results)} optional feature(s) off.")
    return int(bool(failed))


if __name__ == "__main__":
    sys.exit(main())
