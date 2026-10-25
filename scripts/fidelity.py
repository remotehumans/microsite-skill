# ABOUTME: Scores how closely a built microsite matches the company's live design: probes our page like their site, compares type, palette, buttons, header, hero, cards and motion.
# ABOUTME: Usage: python3 fidelity.py PROJECT_DIR [PAGE.html] [--threshold 80] [--ours desktop.json phone.json]  -> design/fidelity.json and side-by-side.jpg; exits 1 below the threshold or with no live capture.
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import provider

HERE = Path(__file__).resolve().parent
PROBE = (HERE / "design_probe.js").read_text()
BROWSER = provider.tool("browser", "agent-browser")
SESSION = "microsite-fidelity"


def ab(*args, timeout=120):
    try:
        out = subprocess.run([BROWSER, "--session", SESSION, *map(str, args)], capture_output=True, text=True, timeout=timeout).stdout
    except FileNotFoundError:
        raise SystemExit(f"{BROWSER} is not installed. Use your agent's own browser: run scripts/design_probe.js on the built page at desktop and phone size, "
                         "save the results (and screenshots as design/ours-desktop.png and design/ours-phone.png), then add --ours desktop.json phone.json.")
    return out.strip()


def probe_page(page: Path, device: str, shot: Path) -> dict:
    # Size applies to an open page, so open first, then resize and reload.
    ab("--allow-file-access", "open", page.resolve().as_uri())
    ab("set", "device", "iPhone 16 Pro") if device == "phone" else ab("set", "viewport", "1440", "900")
    ab("reload")
    ab("wait", "2500")
    raw = json.loads(ab("--json", "eval", PROBE))
    data = raw.get("data", raw)
    ab("screenshot", shot)
    return data.get("result", data)


def lab(hex_colour):
    r, g, b = (int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    x, y, z = (r * .4124 + g * .3576 + b * .1805) / .95047, r * .2126 + g * .7152 + b * .0722, (r * .0193 + g * .1192 + b * .9505) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def close(a, b, limit=12):
    if not a or not b or a == "transparent" or b == "transparent":
        return a == b
    return math.dist(lab(a), lab(b)) <= limit


def same_family(theirs, ours, font_map):
    if not theirs or not ours:
        return False
    return ours.lower() in {theirs.lower(), font_map.get(theirs, "").lower()}


def hero_brightness(shot: Path, probe: dict) -> float | None:
    """Mean brightness (0 to 1) of the hero photo area in a first-screen screenshot: how dark the shaded photo is behind the text."""
    hero = probe.get("hero") or {}
    if not shot.exists() or not hero.get("photo") or hero.get("top") is None:
        return None
    width = int(subprocess.run(["magick", "identify", "-format", "%w", str(shot)], capture_output=True, text=True).stdout or 0)
    scale = width / probe["viewport"][0]
    top = int(max(hero["top"], probe["header"].get("height", 0)) * scale)
    bottom = int(min(hero["bottom"], probe["viewport"][1]) * scale)
    if bottom - top < 40:
        return None
    out = subprocess.run(["magick", str(shot), "-crop", f"{width}x{bottom - top}+0+{top}", "+repage", "-colorspace", "Gray",
                          "-format", "%[fx:mean]", "info:"], capture_output=True, text=True).stdout
    return round(float(out), 3) if out else None


def compare(t: dict, o: dict, font_map: dict) -> list[tuple[str, int, bool, str]]:
    """(check, weight, passed, detail) for each part of the design."""
    T, O = t["type"], o["type"]
    td, od = T.get("display") or {}, O.get("display") or {}
    tb, ob = T.get("body") or {}, O.get("body") or {}
    checks = [
        ("Display font", 10, same_family(td.get("family"), od.get("family"), font_map), f"{td.get('family')} vs {od.get('family')}"),
        ("Body font", 8, same_family(tb.get("family"), ob.get("family"), font_map), f"{tb.get('family')} vs {ob.get('family')}"),
        ("Display alignment", 4, td.get("align") == od.get("align"), f"{td.get('align')} vs {od.get('align')}"),
        ("Display accent colour", 4, (not td.get("accent")) or close(td.get("accent"), od.get("accent")), f"{td.get('accent')} vs {od.get('accent')}"),
        ("Heading colour", 4, close((T.get("h2") or {}).get("color"), (O.get("h2") or {}).get("color"), 15), f"{(T.get('h2') or {}).get('color')} vs {(O.get('h2') or {}).get('color')}"),
    ]
    main = [p["color"] for p in t["palette"] if p["share"] >= 0.08][:4]
    ours = [p["color"] for p in o["palette"][:6]]
    hits = sum(any(close(c, x, 10) for x in ours) for c in main)
    checks.append(("Main colours used", 14, bool(main) and hits == len(main), f"{hits} of {len(main)} ({', '.join(main)})"))
    top_t, top_o = t["palette"][0]["color"], o["palette"][0]["color"]
    checks.append(("Dominant colour", 6, close(top_t, top_o, 10), f"{top_t} vs {top_o}"))
    checks.append(("Button shape", 8, t.get("button_shape") == o.get("button_shape"), f"{t.get('button_shape')} vs {o.get('button_shape')}"))
    tbg = [b["bg"] for b in t["buttons"] if b["bg"] != "transparent"]
    obg = [b["bg"] for b in o["buttons"] if b["bg"] != "transparent"]
    checks.append(("Button colours", 5, bool(tbg) and all(any(close(c, x) for x in obg) for c in set(tbg[:4])), f"{sorted(set(tbg[:4]))} vs {sorted(set(obg[:6]))}"))
    th, oh = t["header"], o["header"]
    checks.append(("Header layers", 6, th["layers"] == oh["layers"], f"{th['layers']} vs {oh['layers']}"))
    checks.append(("Header colours", 6, len(th["bars"]) == len(oh["bars"]) and all(close(a["bg"], b["bg"], 10) for a, b in zip(th["bars"], oh["bars"])),
                   f"{[b['bg'] for b in th['bars']]} vs {[b['bg'] for b in oh['bars']]}"))
    tr, orr = t["hero"], o["hero"]
    for key, weight in (("photo", 6), ("full_bleed", 4), ("overlay", 3), ("framed", 2)):
        checks.append((f"Hero {key.replace('_', ' ')}", weight, tr.get(key) == orr.get(key), f"{tr.get(key)} vs {orr.get(key)}"))
    checks.append(("Hero text colour", 3, close(tr.get("text_color"), orr.get("text_color")), f"{tr.get('text_color')} vs {orr.get('text_color')}"))
    if tr.get("photo") and tr.get("shown_ratio") and orr.get("shown_ratio"):
        ratio = orr["shown_ratio"] / tr["shown_ratio"]
        checks.append(("Hero framing", 4, 0.8 <= ratio <= 1.25, f"photo shown at {tr['shown_ratio']}:1 vs {orr['shown_ratio']}:1"))
    if "brightness" in t and "brightness" in o:
        checks.append(("Hero darkness", 4, abs(t["brightness"] - o["brightness"]) <= 0.06, f"brightness {t['brightness']} vs {o['brightness']} (0 black, 1 white)"))
    tc, oc = t.get("card") or {}, o.get("card") or {}
    checks.append(("Card images", 3, tc.get("image") == oc.get("image"), f"{tc.get('image')} vs {oc.get('image')}"))
    checks.append(("Card shape", 3, tc.get("radius") == oc.get("radius") and tc.get("shadow") == oc.get("shadow"),
                   f"{tc.get('radius')}/{'shadow' if tc.get('shadow') else 'flat'} vs {oc.get('radius')}/{'shadow' if oc.get('shadow') else 'flat'}"))
    tm, om = t["motion"], o["motion"]
    checks.append(("Transitions", 3, (tm["transitions"] < 20) or om["transitions"] >= 20, f"{tm['transitions']} vs {om['transitions']}"))
    checks.append(("Transition timing", 2, abs(tm["median_duration"] - om["median_duration"]) <= 0.15, f"{tm['median_duration']}s vs {om['median_duration']}s"))
    checks.append(("Smooth scroll", 2, tm["smooth_scroll"] == om["smooth_scroll"], f"{tm['smooth_scroll']} vs {om['smooth_scroll']}"))
    checks.append(("Reveal on scroll", 3, tm["reveal_on_scroll"] == om["reveal_on_scroll"], f"{tm['reveal_on_scroll']} vs {om['reveal_on_scroll']}"))
    return checks


def main():
    args = sys.argv[1:]
    threshold = 80
    if "--threshold" in args:
        i = args.index("--threshold"); threshold = int(args[i + 1]); del args[i:i + 2]
    provided = None
    if "--ours" in args:
        i = args.index("--ours"); provided = {"desktop": Path(args[i + 1]), "phone": Path(args[i + 2])}; del args[i:i + 3]
    if not args:
        raise SystemExit("Usage: python3 fidelity.py PROJECT_DIR [PAGE.html] [--threshold 80]")
    project = Path(args[0]).resolve()
    design = project / "design"
    capture = design / "design.json"
    if not capture.exists():
        raise SystemExit(f"FAIL no live capture: run scripts/capture_design.py on their website first ({capture} missing)")
    live = json.loads(capture.read_text())
    company = json.loads((project / "company.json").read_text()) if (project / "company.json").exists() else {}
    page = Path(args[1]) if len(args) > 1 else next((project / "build").glob("*.html"))
    font_map = (company.get("design") or {}).get("font_map", {})
    with tempfile.TemporaryDirectory() as tmp:
        if provided:
            # Measured with the agent's own browser: probe results plus optional screenshots saved in design/.
            unwrap = lambda raw: raw.get("result", raw) if isinstance(raw, dict) else raw
            ours = {d: unwrap(json.loads(f.read_text())) for d, f in provided.items()}
            shots = {d: design / f"ours-{d}.png" for d in provided}
        else:
            shots = {d: Path(tmp) / f"ours-{d}.png" for d in ("desktop", "phone")}
            ours = {d: probe_page(page, d, shots[d]) for d in shots}
            ab("close")
        results, report = {}, {"page": str(page), "live": live["url"], "captured": live["captured"], "threshold": threshold}
        for device in ("desktop", "phone"):
            theirs = live["pages"][0].get(device)
            if not theirs:
                continue
            for probe, shot in ((theirs, design / f"live-{device}.jpg"), (ours[device], shots[device])):
                b = hero_brightness(shot, probe)
                if b is not None:
                    probe["brightness"] = b
            checks = compare(theirs, ours[device], font_map)
            total = sum(w for _, w, _, _ in checks)
            score = round(100 * sum(w for _, w, ok, _ in checks if ok) / total)
            results[device] = score
            report[device] = {"score": score, "checks": [{"check": c, "weight": w, "pass": ok, "detail": d} for c, w, ok, d in checks]}
            print(f"\n{device.upper()} {score}/100")
            for c, w, ok, d in checks:
                print(f"  {'OK  ' if ok else 'MISS'} {c:<22} {d}")
        # Side by side: their first screen (left) and ours (right), desktop over phone.
        rows = []
        for device in ("desktop", "phone"):
            ref = design / f"live-{device}.jpg"
            if ref.exists() and shots[device].exists():
                row = Path(tmp) / f"row-{device}.png"
                h = "700" if device == "desktop" else "900"
                subprocess.run(["magick", "(", str(ref), "-resize", f"x{h}", ")", "(", str(shots[device]), "-resize", f"x{h}", ")",
                                "-background", "#e8e6e1", "-gravity", "west", "-splice", "16x0", "+append", str(row)], check=True)
                rows.append(str(row))
        if rows:
            subprocess.run(["magick", *rows, "-background", "#e8e6e1", "-gravity", "north", "-splice", "0x16", "-append",
                            "-resize", "1800x>", "-quality", "75", str(design / "side-by-side.jpg")], check=True)
    score = min(results.values()) if results else 0
    report["score"], report["pass"] = score, score >= threshold
    (design / "fidelity.json").write_text(json.dumps(report, indent=1))
    print(f"\n{'PASS' if score >= threshold else 'FAIL'} fidelity {score}/100 (threshold {threshold}). Look at {design / 'side-by-side.jpg'} as well; the score is a floor, not proof.")
    sys.exit(0 if score >= threshold else 1)


if __name__ == "__main__":
    main()
