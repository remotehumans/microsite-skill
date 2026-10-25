# ABOUTME: Creates and checks campaigns: folders of companies that the gallery shows, each company with its research, page and outreach card.
# ABOUTME: Usage: python3 scripts/campaign.py new NAME [--mode many|one|job] [--title T] | add NAME --name N --website URL | check [NAME] | list NAME | demo
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import provider

SKILL = provider.SKILL
MODES = {"many": "Many companies found from your ideal client", "one": "One company you chose", "job": "Job and contract applications"}
# Each stage needs its own fields plus every earlier stage's. See references/campaign.md for what each field holds.
STAGES = [
    ("found", ["id", "name", "domain"]),
    ("qualified", ["decision", "score_total", "score_out_of", "financial_capacity", "why_now", "sources"]),
    ("researched", ["research", "buyer", "culture"]),
    ("built", ["page"]),
    ("ready", []),
]
CARD_FIELDS = ["chip", "what", "pay", "why_now", "opportunity", "contact_why", "opener"]


def workspace() -> Path:
    raw = os.environ.get("MICROSITE_WORKSPACE") or provider.settings().get("paths", {}).get("projects") or "~/microsites"
    return Path(raw).expanduser()


def slug(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", " "))).strip("-")[:60]


def domain_key(url: str) -> str:
    host = urlparse(url if "://" in url else "https://" + url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def read(path: Path, fallback=None):
    return json.loads(path.read_text()) if path.exists() else fallback


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    tmp.replace(path)


def folder(name: str) -> Path:
    path = workspace() / name
    if not (path / "data/campaign.json").exists():
        raise SystemExit(f"No campaign called {name} in {workspace()}. Create it with: python3 scripts/campaign.py new {name}")
    return path


def new(args) -> None:
    path = workspace() / slug(args.name)
    if (path / "data/campaign.json").exists():
        print(f"{path} already exists.")
        sys.exit(1)
    q = provider.load().get("qualification", {})
    write(path / "data/campaign.json", {
        "name": args.title or args.name, "mode": args.mode, "about": MODES[args.mode], "created": date.today().isoformat(),
        "brief": {"request": args.request or "", "icp": q.get("icp", ""), "industry": "", "area": "", "sectors": [], "size": "", "how_many": 10 if args.mode == "many" else 1,
                  "cost_ceiling": "", "notes": ""},
        "counts": {}, "last_updated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")})
    write(path / "data/prospects.json", [])
    for sub in ("microsites", "gallery"):
        (path / sub).mkdir(parents=True, exist_ok=True)
    print(f"Created {path}\nNext: fill data/campaign.json → brief with the provider, then add companies with: python3 scripts/campaign.py add {path.name} --name ... --website ...")


def add(args) -> None:
    path = folder(args.campaign)
    rows = read(path / "data/prospects.json", [])
    key = domain_key(args.website)
    clash = next((r for r in rows if r.get("domain_key") == key or r["id"] == (args.id or slug(args.name))), None)
    if clash:
        print(f"{clash['name']} is already in {path.name} ({clash['id']}, {clash.get('domain_key')}).")
        sys.exit(1)
    rid = args.id or slug(args.name)
    rows.append({"id": rid, "page_slug": rid, "name": args.name, "domain": args.website, "domain_key": key,
                 "stage": "found", "status": "Found", "found_by": args.found_by or "", "added": date.today().isoformat(),
                 "research": f"microsites/{rid}/research/research.json"})
    for sub in ("research", "enrichment", "images", "design"):
        (path / "microsites" / rid / sub).mkdir(parents=True, exist_ok=True)
    write(path / "data/prospects.json", rows)
    print(f"Added {args.name} as {rid}: {path / 'microsites' / rid}")


def missing(row: dict, path: Path, cards: dict) -> tuple[str, list[str]]:
    """The furthest stage a record has completed, and what its claimed stage still needs."""
    claimed = row.get("stage", "found")
    if claimed == "no-go":
        need = [f for f in ("decision", "no_go_reason") if not row.get(f)]
        return "no-go", need
    reached, need = "found", []
    for stage, fields in STAGES:
        gaps = [f for f in fields if row.get(f) in (None, "", [], {})]
        if stage == "researched" and not gaps and not (path / row["research"]).exists():
            gaps.append(f"research file {row['research']}")
        if stage == "built" and not gaps and not (path / row["page"]).exists():
            gaps.append(f"page file {row['page']}")
        if stage == "ready":
            card = cards.get(row["id"], {})
            gaps = [f"card.{f}" for f in CARD_FIELDS if not card.get(f)]
        if gaps:
            if [s for s, _ in STAGES].index(stage) <= [s for s, _ in STAGES].index(claimed):
                need += gaps
            break
        reached = stage
    return reached, need


def check(args) -> None:
    names = [args.campaign] if args.campaign else [p.name for p in sorted(workspace().iterdir()) if (p / "data/campaign.json").exists()] if workspace().exists() else []
    problems = 0
    for name in names:
        path = folder(name)
        rows, cards = read(path / "data/prospects.json", []), read(path / "gallery/outreach-cards.json", {})
        counts = {}
        for row in rows:
            reached, need = missing(row, path, cards)
            counts[reached] = counts.get(reached, 0) + 1
            if need:
                problems += 1
                print(f"FIX  {name}/{row['id']}: marked {row.get('stage', 'found')}, still needs {', '.join(need)}")
        campaign = read(path / "data/campaign.json")
        campaign["counts"] = {"researched_records": len(rows), "built": sum(1 for r in rows if r.get("page") and (path / r["page"]).exists()),
                              **{f"stage_{k}": v for k, v in counts.items()}}
        campaign["last_updated_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        write(path / "data/campaign.json", campaign)
        order = [s for s, _ in STAGES] + ["no-go"]
        print(f"{name}: " + ", ".join(f"{s} {counts[s]}" for s in order if counts.get(s)) if rows else f"{name}: no companies yet")
    sys.exit(1 if problems else 0)


def list_rows(args) -> None:
    path = folder(args.campaign)
    rows = sorted(read(path / "data/prospects.json", []), key=lambda r: (-(r.get("score_total") or 0), r["name"]))
    for i, r in enumerate(rows, 1):
        score = f"{r['score_total']}/{r.get('score_out_of', '?')}" if r.get("score_total") is not None else "-"
        print(f"{i:>3}. {r['name']:<34} {score:>6}  {r.get('stage', 'found'):<10} {r.get('why_now', '')[:70]}")


def demo(_args) -> None:
    """A fictional campaign with one built page, so a new user can open the gallery before doing any research."""
    target = workspace() / "sample-campaign"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(SKILL / "examples/sample-campaign", target)
    page = target / "microsites/ashby-and-rowe"
    shutil.copytree(SKILL / "examples/sample-sprint", page, dirs_exist_ok=True, ignore=shutil.ignore_patterns("build", "qa"))
    run = subprocess.run([sys.executable, str(SKILL / "sprint/build_sprint.py"), str(page)], capture_output=True, text=True,
                         env={**os.environ, "MICROSITE_PROFILE": provider.active().name})
    if run.returncode:
        raise SystemExit(run.stdout + run.stderr)
    print(f"Sample campaign ready in {target}\nOpen the gallery: node gallery/server.mjs   then go to http://127.0.0.1:4347")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create and check microsite campaigns.")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("new"); p.add_argument("name"); p.add_argument("--mode", choices=MODES, default="many"); p.add_argument("--title")
    p.add_argument("--request", help='the search in the provider\'s words, e.g. "find me 150 wellness companies with 5-100 staff"')
    p.set_defaults(func=new)
    p = sub.add_parser("add"); p.add_argument("campaign"); p.add_argument("--name", required=True); p.add_argument("--website", required=True)
    p.add_argument("--id"); p.add_argument("--found-by"); p.set_defaults(func=add)
    p = sub.add_parser("check"); p.add_argument("campaign", nargs="?"); p.set_defaults(func=check)
    p = sub.add_parser("list"); p.add_argument("campaign"); p.set_defaults(func=list_rows)
    p = sub.add_parser("demo"); p.set_defaults(func=demo)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
