# ABOUTME: Refreshes the active profile's proof library from the provider's website repo: stories.json plus resized story images.
# ABOUTME: Usage: python3 sync_proof.py [/path/to/website]  (defaults to settings.json paths.site_repo; run whenever the results page changes).
import json
import shutil
import subprocess
import sys
from pathlib import Path

import provider


def main() -> None:
    site = Path(sys.argv[1] if len(sys.argv) > 1 else provider.settings().get("paths", {}).get("site_repo", "")).expanduser()
    src = site / "data" / "stories.json"
    if not src.exists():
        raise SystemExit(f"Not found: {src}")
    out = provider.path("proof")
    (out / "stories").mkdir(parents=True, exist_ok=True)
    stories = json.loads(src.read_text())
    shutil.copy(src, out / "stories.json")
    for s in stories:
        img = site / "public" / s["image"]["src"].lstrip("/")
        dest = out / "stories" / (Path(img).stem + ".jpg")
        if dest.exists():
            continue
        subprocess.run(["magick", str(img), "-background", "white", "-flatten", "-resize", "1400x>",
                        "-quality", "84", "-strip", str(dest)], check=True)
    print(f"Synced {len(stories)} stories: " + ", ".join(s["id"] for s in stories))


if __name__ == "__main__":
    main()
