# ABOUTME: Finds real local entities near a business (UK postcode or lat,lon) from Wikipedia, with links, for the "local to you" section.
# ABOUTME: Usage: python3 local_entities.py "EC1M 4AA" [radius_m] [OUT.json]  or  python3 local_entities.py "51.52,-0.10" ...
import json
import sys
import urllib.parse
import urllib.request

import provider

# Wikipedia asks API users to identify themselves with a contact address.
UA = {"User-Agent": f"MicrositeResearch/1.0 ({provider.load()['provider'].get('email', 'no-contact')})"}


def get_json(url: str) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return json.loads(r.read())


def locate(place: str) -> tuple[float, float, dict]:
    if "," in place and all(p.replace(".", "").replace("-", "").strip().isdigit() for p in place.split(",")):
        lat, lon = (float(p) for p in place.split(","))
        return lat, lon, {}
    # UK postcodes via postcodes.io (free, no key): also gives ward, borough and region names.
    d = get_json("https://api.postcodes.io/postcodes/" + urllib.parse.quote(place))["result"]
    area = {k: d.get(k) for k in ("admin_ward", "admin_district", "region", "country", "parliamentary_constituency")}
    return d["latitude"], d["longitude"], area


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit('Usage: python3 local_entities.py "EC1M 4AA" [radius_m] [OUT.json]')
    place = sys.argv[1]
    radius = int(sys.argv[2]) if len(sys.argv) > 2 else 1000
    lat, lon, area = locate(place)
    geo = get_json("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "list": "geosearch", "gscoord": f"{lat}|{lon}", "gsradius": min(radius, 10000),
        "gslimit": 40, "format": "json"}))["query"]["geosearch"]
    entities = []
    for g in geo:
        title = g["title"]
        try:
            s = get_json("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_")))
        except Exception:  # skip a page that fails rather than lose the whole list
            continue
        entities.append({"title": title, "distance_m": round(g["dist"]), "url": s.get("content_urls", {}).get("desktop", {}).get("page"),
                         "description": s.get("description", ""), "extract": s.get("extract", "")[:300]})
    out = {"place": place, "lat": lat, "lon": lon, "area": area, "radius_m": radius, "entities": entities}
    text = json.dumps(out, indent=2, ensure_ascii=False)
    if len(sys.argv) > 3:
        open(sys.argv[3], "w").write(text)
    print(json.dumps(area, ensure_ascii=False))
    for e in entities:
        print(f'{e["distance_m"]:>5} m  {e["title"]}: {e["description"]}')


if __name__ == "__main__":
    main()
