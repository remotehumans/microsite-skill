# ABOUTME: Pulls a company's brand cues from its website: fonts, most-used colours, logo candidates, page images and favicon.
# ABOUTME: Usage: python3 extract_brand.py https://example.com OUT_DIR  (writes brand.json and downloads logo/image candidates).
import json
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"}
# Bootstrap and framework defaults that show up in CSS but are rarely the brand.
FRAMEWORK = {"#007bff", "#6c757d", "#28a745", "#dc3545", "#ffc107", "#17a2b8", "#343a40", "#212529", "#dee2e6", "#e9ecef", "#f8f9fa", "#0d6efd", "#198754", "#0dcaf0", "#6610f2", "#6f42c1", "#d63384", "#fd7e14", "#20c997"}
NEUTRAL = re.compile(r"^#(?:f{3}|f{6}|0{3}|0{6}|[ef][ef][ef]|e[0-9a-f]e[0-9a-f]e[0-9a-f]|f[0-9a-f]f[0-9a-f]f[0-9a-f])$", re.I)


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return r.read()


def text(url: str) -> str:
    try:
        return get(url).decode("utf-8", "ignore")
    except Exception as exc:  # report and continue: one broken stylesheet should not stop the scan
        print(f"skip {url}: {exc}", file=sys.stderr)
        return ""


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python3 extract_brand.py URL OUT_DIR")
    base, out = sys.argv[1], Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    html = text(base)
    if not html:
        raise SystemExit(f"Could not fetch {base}")

    css_urls = [urljoin(base, h) for h in re.findall(r'<link[^>]+href="([^"]+\.css[^"]*)"', html)]
    google_fonts = [u for u in css_urls if "fonts.googleapis" in u]
    css = "\n".join(text(u) for u in css_urls if "fonts.googleapis" not in u) + "\n" + "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))

    colours = Counter(c.lower() if len(c) == 7 else "#" + "".join(ch * 2 for ch in c[1:]).lower()
                      for c in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b", css + html))
    fonts = Counter(f.strip().strip("'\"") for decl in re.findall(r"font-family\s*:\s*([^;}{]+)", css) for f in decl.split(",")[:1])
    imgs = re.findall(r'<img[^>]+src="([^"]+)"', html) + re.findall(r'url\(["\']?([^"\')]+\.(?:png|jpe?g|webp|svg))', css)
    logos = [u for u in imgs if re.search(r"logo|brand|wordmark", u, re.I)] or imgs[:3]
    icon = re.findall(r'<link[^>]+rel="[^"]*icon[^"]*"[^>]+href="([^"]+)"', html)

    brand = {
        "url": base,
        "title": (re.search(r"<title>(.*?)</title>", html, re.S) or [None, ""])[1].strip(),
        "description": (re.search(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', html) or [None, ""])[1],
        "google_fonts": google_fonts,
        "fonts": [f for f, _ in fonts.most_common(6)],
        "brand_colours": [c for c, n in colours.most_common(40) if not NEUTRAL.match(c) and c not in FRAMEWORK][:10],
        "logo_candidates": [urljoin(base, u) for u in dict.fromkeys(logos)][:6],
        "images": [urljoin(base, u) for u in dict.fromkeys(imgs)][:30],
        "favicon": urljoin(base, icon[0]) if icon else urljoin(base, "/favicon.ico"),
    }
    for i, u in enumerate(brand["logo_candidates"]):
        ext = Path(u.split("?")[0]).suffix or ".png"
        try:
            (out / f"logo-candidate-{i}{ext}").write_bytes(get(u))
        except Exception as exc:
            print(f"skip logo {u}: {exc}", file=sys.stderr)
    (out / "brand.json").write_text(json.dumps(brand, indent=2))
    print(json.dumps({k: brand[k] for k in ("title", "fonts", "brand_colours", "logo_candidates")}, indent=2))


if __name__ == "__main__":
    main()
