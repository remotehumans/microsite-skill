# ABOUTME: Loads the active provider profile (who sends the page) and machine settings, and fills {{PROVIDER:key}} and {{BOOK:offer}} tokens.
# ABOUTME: CLI: provider.py show | get KEY | env | tool NAME DEFAULT | new NAME  (new copies profiles/_template and points settings.json at it).
import base64
import json
import os
import re
import shutil
import sys
from html import escape
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
PROFILES = SKILL / "profiles"
SETTINGS = Path(os.environ.get("MICROSITE_SETTINGS", SKILL / "settings.json")).expanduser()
# Before setup: Remote Humans' own copy uses its profile; shared copies fall back to the fictional sample.
DEFAULT_PROFILES = ("remote-humans", "sample-studio")
DEFAULT_PROFILE = next((name for name in DEFAULT_PROFILES if (PROFILES / name / "profile.json").exists()), DEFAULT_PROFILES[-1])


def settings() -> dict:
    """Machine-local settings (paths, tools). Missing file means defaults."""
    return json.loads(SETTINGS.read_text()) if SETTINGS.exists() else {}


def profile_dir() -> Path:
    """MICROSITE_PROFILE (name or path) wins, then settings.json profile, then the Remote Humans example profile."""
    choice = os.environ.get("MICROSITE_PROFILE") or settings().get("profile")
    if not choice:
        print(f"NOTE: no settings.json; using the {DEFAULT_PROFILE} profile. Run SETUP.md to use your own.", file=sys.stderr)
        choice = DEFAULT_PROFILE
    path = Path(choice).expanduser()
    path = path if path.is_absolute() else PROFILES / choice
    if not (path / "profile.json").exists():
        raise SystemExit(f"Profile not found: {path} (expected profile.json inside)")
    return path.resolve()


_active = None


def active() -> Path:
    """The active profile folder, resolved on first use so `new` works before any profile exists."""
    global _active
    if _active is None:
        _active = profile_dir()
    return _active


def load() -> dict:
    return json.loads((active() / "profile.json").read_text())


def claims() -> dict:
    return json.loads((active() / "claims.json").read_text())


def offers() -> dict:
    return json.loads((active() / "offers.json").read_text())


def path(relative: str) -> Path:
    return active() / relative


def tool(name: str, default: str) -> str:
    """Command or choice for an external tool from settings.json tools, e.g. browser, image, chrome."""
    return settings().get("tools", {}).get(name, default)


def lookup(data: dict, key: str):
    value = data
    for part in key.split("."):
        value = value[part]
    return value


def contact_html(p: dict) -> str:
    me = p["provider"]
    parts = [f"<b>{escape(me['person'])}</b>", escape(me["business"])]
    if me.get("email"):
        parts.append(f'<a href="mailto:{escape(me["email"])}">{escape(me["email"])}</a>')
    if me.get("phone"):
        parts.append(escape(me["phone"]))
    if me.get("linkedin"):
        parts.append(f'<a href="{escape(me["linkedin"])}">LinkedIn</a>')
    return " · ".join(parts)


def client_logos_html(p: dict) -> str:
    imgs = []
    for logo in p["about"].get("client_logos", []):
        data = base64.b64encode((active() / logo["file"]).read_bytes()).decode()
        imgs.append(f'<img src="data:image/png;base64,{data}" alt="{escape(logo["name"])}">')
    return "".join(imgs)


def linkedin_html(p: dict) -> str:
    """A LinkedIn icon link to the provider's profile, or nothing when the profile has no LinkedIn URL."""
    me = p["provider"]
    if not me.get("linkedin"):
        return ""
    icon = re.sub(r"<title>.*?</title>", "", (SKILL / "assets/logos/linkedin.svg").read_text())
    icon = icon.replace("<svg ", '<svg aria-hidden="true" focusable="false" ', 1).replace(' role="img"', "")
    return (f'<a class="me-linkedin" href="{escape(me["linkedin"])}" target="_blank" rel="noopener">'
            f'{icon}<span>Connect with me on LinkedIn</span></a>')


def derived(p: dict) -> dict:
    return {
        "linkedin_html": linkedin_html(p),
        "bio_html": p["about"]["bio_html"],
        "highlights_html": "\n".join(f"      <li>{h}</li>" for h in p["about"].get("highlights", [])),
        "clients_label": p["about"].get("clients_label", ""),
        "contact_html": contact_html(p),
        "public_base_url": p["delivery"]["public_base_url"],
    }


def fill(html: str, p: dict | None = None) -> str:
    """Replace {{PROVIDER:key}} (provider fields or derived HTML), {{BOOK:offer}} and {{CLIENT_LOGOS}}."""
    p = p or load()
    values = {**p["provider"], **derived(p)}

    def provider(m):
        if m.group(1) not in values:
            raise SystemExit(f"Profile has no provider value for {{{{PROVIDER:{m.group(1)}}}}}")
        return str(values[m.group(1)])

    def book(m):
        offer = offers().get(m.group(1))
        if not offer or not offer.get("booking_url"):
            raise SystemExit(f"offers.json has no booking_url for {m.group(1)}")
        return offer["booking_url"]

    html = re.sub(r"\{\{PROVIDER:([\w.]+)\}\}", provider, html)
    html = re.sub(r"\{\{BOOK:([\w-]+)\}\}", book, html)
    if "{{CLIENT_LOGOS}}" in html:
        html = html.replace("{{CLIENT_LOGOS}}", client_logos_html(p))
    return html


def shell_env(p: dict) -> str:
    """Delivery values as shell assignments for the deploy scripts."""
    s = settings()
    hook = p["delivery"].get("deploy_hook") or {}
    pairs = {
        "SITE": os.path.expanduser(s.get("paths", {}).get("site_repo", "")),
        "BASE_URL": p["delivery"]["public_base_url"],
        "PUBLISH_SUBDIR": p["delivery"].get("publish_subdir", ""),
        "BRANCH": p["delivery"].get("branch", "main"),
        "HOOK_TYPE": hook.get("type", "none"),
        "HOOK_ID": hook.get("uuid", hook.get("url", "")),
        "NGINX_CHECK": p["delivery"].get("noindex_nginx_check", ""),
        "SITEMAP_URL": p["delivery"].get("sitemap_url", ""),
        "AUTHOR": p["provider"]["person"],
    }
    return "\n".join(f"{k}={json.dumps(v)}" for k, v in pairs.items())


def new(name: str) -> None:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        raise SystemExit("Profile name must be lower-case words joined by hyphens")
    target = PROFILES / name
    if target.exists():
        raise SystemExit(f"Already exists: {target}")
    shutil.copytree(PROFILES / "_template", target)
    current = settings()
    current["profile"] = name
    SETTINGS.write_text(json.dumps(current, indent=2) + "\n")
    print(f"Created {target}\nsettings.json now uses profile {name}. Fill every [[...]] in its files (see SETUP.md).")


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["new"] and len(args) == 2:
        return new(args[1])
    if args[:1] == ["tool"] and len(args) == 3:
        return print(tool(args[1], args[2]))
    p = load()
    if args[:1] == ["get"] and len(args) == 2:
        value = lookup(p, args[1])
        print(value if isinstance(value, str) else json.dumps(value, indent=2, ensure_ascii=False))
    elif args == ["env"]:
        print(shell_env(p))
    elif args in ([], ["show"]):
        me = p["provider"]
        print(f"Profile:  {active()}\nProvider: {me['person']}, {me['business']} ({me.get('email', 'no email')})")
        print("Offers:   " + ", ".join(f"{k} ({v['label']})" for k, v in offers().items() if not k.startswith("_")))
        print(f"Pages:    {p['delivery']['public_base_url']}/<slug>")
    else:
        raise SystemExit("Usage: provider.py show | get KEY | env | tool NAME DEFAULT | new NAME")


if __name__ == "__main__":
    main()
