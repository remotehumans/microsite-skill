# ABOUTME: Captures a company's live website design in a real browser window: measured design system (design_probe.js) at desktop and phone size, plus reference screenshots.
# ABOUTME: Usage: python3 capture_design.py URL OUT_DIR [extra paths...]  (agent-browser), or URL OUT_DIR --from-probe desktop.json [--phone-probe phone.json] (any browser; see references/design.md). Stops if the site blocks the browser.
import json
import subprocess
import sys
import time
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import provider

HERE = Path(__file__).resolve().parent
SESSION = "microsite-design"
BROWSER = provider.tool("browser", "agent-browser")
PROBE = (HERE / "design_probe.js").read_text()
BLOCKED = ("403 forbidden", "access denied", "just a moment", "attention required", "verify you are human", "are you a robot", "request rejected")
HELP = """{url} blocked the browser ({why}).
Do not try to get round it. The page must still be seen before building, so either:
  1. ask the provider to open {url} in their own browser, then run scripts/design_probe.js there
     (any browser tool's JavaScript runner, or the browser console) and save the result as probe.json, then run:
     python3 scripts/capture_design.py {url} OUT_DIR --from-probe probe.json
  2. or ask them for full-page screenshots at desktop and phone size, saved in OUT_DIR as live-desktop.jpg and live-phone.jpg.
Never build the page from other material (newsletters, PDFs, social posts) as a stand-in for their site."""


def ab(*args: str, timeout=120) -> str:
    try:
        result = subprocess.run([BROWSER, "--session", SESSION, "--headed", *args], capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise SystemExit(f"{BROWSER} is not installed. Use your agent's own browser instead: run scripts/design_probe.js on their site at desktop and phone size, "
                         "save the results and first-screen screenshots, then run this script with --from-probe (references/design.md, 'Using your own browser').")
    return result.stdout.strip()


def probe() -> dict:
    raw = ab("--json", "eval", PROBE)
    data = json.loads(raw)
    result = data.get("data", data)
    return result.get("result", result) if isinstance(result, dict) else result


def blocked(title: str) -> str | None:
    t = title.lower()
    return next((b for b in BLOCKED if b in t), None)


def shoot(path: Path, full: bool = False) -> None:
    png = path.with_suffix(".png")
    ab("screenshot", *(["--full"] if full else []), str(png))
    if png.exists():
        # Reference screenshots are for comparison, so keep them small.
        subprocess.run(["magick", str(png), "-resize", "1440x>", "-quality", "70", "-strip", str(path)], check=True)
        png.unlink()


def main() -> None:
    args = [a for a in sys.argv[1:]]
    from_probe = phone_probe = None
    if "--from-probe" in args:
        i = args.index("--from-probe")
        from_probe = Path(args[i + 1])
        del args[i:i + 2]
    if "--phone-probe" in args:
        i = args.index("--phone-probe")
        phone_probe = Path(args[i + 1])
        del args[i:i + 2]
    if len(args) < 2:
        raise SystemExit("Usage: python3 capture_design.py URL OUT_DIR [extra paths...] [--from-probe probe.json]")
    base, out = args[0], Path(args[1])
    out.mkdir(parents=True, exist_ok=True)
    report = {"url": base, "captured": date.today().isoformat(), "method": "provided probe" if from_probe else "real browser window", "pages": []}
    if from_probe:
        # Probe results saved from any browser tool; screenshots (live-desktop.jpg, live-phone.jpg) sit in OUT_DIR.
        unwrap = lambda raw: raw.get("result", raw) if isinstance(raw, dict) else raw
        entry = {"url": base, "desktop": unwrap(json.loads(from_probe.read_text()))}
        if phone_probe:
            entry["phone"] = unwrap(json.loads(phone_probe.read_text()))
        report["pages"].append(entry)
        for shot in ("live-desktop.jpg", "live-phone.jpg"):
            if not (out / shot).exists():
                print(f"NOTE: no {shot} in {out}; the fidelity check will skip hero darkness without it.", file=sys.stderr)
    else:
        for i, url in enumerate([base] + [urljoin(base, p) for p in args[2:]]):
            entry = {"url": url}
            for device in ("desktop", "phone"):
                # Size applies to an open page, so open first, then resize and reload.
                ab("open", url)
                ab("set", "device", "iPhone 16 Pro") if device == "phone" else ab("set", "viewport", "1440", "900")
                ab("reload")
                time.sleep(5)
                title = ab("get", "title")
                why = blocked(title)
                if why:
                    ab("close")
                    print(HELP.format(url=url, why=why), file=sys.stderr)
                    sys.exit(3)
                entry[device] = probe()
                if i == 0:
                    shoot(out / f"live-{device}.jpg")
                    if device == "desktop":
                        shoot(out / "live-desktop-full.jpg", full=True)
            report["pages"].append(entry)
        ab("close")
    (out / "design.json").write_text(json.dumps(report, indent=1))
    d = report["pages"][0]["desktop"]
    print(json.dumps({k: d.get(k) for k in ("type", "palette", "button_shape", "header", "hero", "card", "motion")}, indent=1)[:4000])
    print(f"Saved {out / 'design.json'}")


if __name__ == "__main__":
    main()
