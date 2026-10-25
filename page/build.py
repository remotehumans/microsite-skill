# ABOUTME: Builds a self-contained "Prepared for {company}" page from company.json and the active profile's own offer, for any kind of offer.
# ABOUTME: Usage: python3 page/build.py PROJECT [--offer KEY]. An offer whose "page" is "sprint" is handed to sprint/build_sprint.py instead.
import argparse
from datetime import date
from html import escape
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
sys.path.insert(0, str(SKILL / 'scripts'))
sys.path.insert(0, str(SKILL / 'sprint'))
from build_page import booking_link, data_uri, price
import provider
import components as parts
from components import e, section, bridge
from lint_sprint import check

REQUIRED = ['slug', 'name', 'prepared_date', 'brand', 'logo', 'hero', 'goal', 'noticed', 'noticed_summary', 'look_at_first', 'currency']
OFFER_REQUIRED = ['label', 'outcome', 'deliverable', 'includes', 'steps', 'booking_url', 'button']


def choose_offer(company):
    """The offer this page sells: company.json's "offer" key, else the profile's first offer."""
    offers = {k: v for k, v in provider.offers().items() if not k.startswith('_')}
    key = company.get('offer') or next(iter(offers))
    if key not in offers:
        raise ValueError(f'Offer "{key}" is not in the profile\'s offers.json ({", ".join(offers)})')
    return key, offers[key]


def validate(company, offer):
    for key in REQUIRED:
        if key not in company:
            raise ValueError(f'Unfilled company slot: {key} (see page/company.schema.md)')
    for key in OFFER_REQUIRED:
        if not offer.get(key):
            raise ValueError(f'The offer needs "{key}" in offers.json (SETUP.md, step 3)')
    text = json.dumps(company)
    if re.search(r'\{\{|\[\[|\b(?:TODO|TBD|TBC)\b', text + json.dumps(offer)):
        raise ValueError('Unfilled token or placeholder in company.json or the offer')
    if len(company['noticed']) != 3 or not 3 <= len(company['look_at_first']) <= 5:
        raise ValueError('Supply three noticed facts and three to five look-at-first cards')
    for fact in company['noticed']:
        date.fromisoformat(fact['date'])
        if not fact['url'].startswith('https://'):
            raise ValueError('Every public fact needs an exact HTTPS source URL')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', company['slug']):
        raise ValueError('slug must use lower-case words joined by hyphens')
    colours = {'teal', 'deep', 'yellow', 'ink', 'muted', 'paper', 'navy', 'soft', 'pale', 'line'}
    if set(company['brand']['colours']) != colours:
        raise ValueError('Brand colours must define exactly: ' + ', '.join(sorted(colours)))
    for name, colour in company['brand']['colours'].items():
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', colour):
            raise ValueError(f'Invalid brand colour: {name}')


def offer_price(key, offer, currency, notes):
    """The offer's price in the page's currency; a wording such as "Priced on a call" when there is no fixed price."""
    if currency in offer.get('prices', {}):
        return offer['prices'][currency]
    if offer.get('price_text'):
        return offer['price_text']
    return price(key, currency, notes)


def example(p):
    ex = p.c.get('example')
    if not ex:
        return ''
    side = lambda label, cls, s: f'<article class="{cls}"><p class="eyebrow">{e(s.get("title", label))}</p><p>{e(s["text"])}</p></article>'
    source = f'<p class="meta">From <a href="{e(ex["source_url"])}">{e(ex["source_label"])}</a>. Shown as an illustration.</p>' if ex.get('source_url') else ''
    return section('example', 'One example', ex['heading'],
                   f'<p class="lead">{e(ex["lead"])}</p><div class="pg-ba">{side("Today", "before", ex["before"])}{side("With us", "after", ex["after"])}</div>{source}'
                   + bridge('#get', 'What would you get?'))


def what_you_get(p, offer):
    rows = ''.join(f'<tr><td>{e(item)}</td><td aria-label="Included">✓</td></tr>' for item in offer['includes'])
    rows += ''.join(f'<tr class="out" data-not-included="true"><td>{e(item)}: not included</td><td aria-label="Not included">✕</td></tr>'
                    for item in offer.get('excludes', []))
    table = f'<table class="pg-include"><tbody>{rows}</tbody></table>'
    steps = '<ol class="pg-steps">' + ''.join(f'<li><b>{e(s["title"])}</b>{e(s["text"])}</li>' for s in offer['steps']) + '</ol>'
    return section('get', 'What you get', offer['deliverable'],
                   f'<p class="lead">{e(offer.get("for_line", offer["outcome"]))}</p>{table}<h3>How it works</h3>{steps}'
                   + bridge('#proof', 'Has this worked for others?'))


def offer_section(p, offer, amount, call):
    meta = ' · '.join(x for x in (offer.get('length'), offer.get('kind')) if x)
    return section('offer', offer['label'], offer['outcome'],
                   f'<div class="plan"><div class="plan-left"><p class="rf-price">{e(amount)}</p>'
                   + (f'<p>{e(offer["price_note"])}</p>' if offer.get('price_note') else '')
                   + (f'<p class="meta">{e(meta)}</p>' if meta else '')
                   + f'<a class="rf-button" href="{e(call)}">{e(offer["button"])} ↗</a></div></div>', 'rf-section rf-offer')


def lint_rules(claims, offer):
    """The voice and locked-proof rules the shared lint enforces, with sensible defaults when the profile leaves them out."""
    return {'banned_phrases': claims.get('banned_phrases', []), 'hedge_phrases': claims.get('hedge_phrases', []),
            'vocabulary_map': claims.get('vocabulary_map', {}), 'scope_words': offer.get('scope_words', []),
            'scope_exception': claims.get('scope_exception', {}), 'proof_tiles': claims.get('proof_tiles', []),
            'reading_level': claims.get('reading_level', {'max_grade': 8.0, 'report_max_paragraph_words': 60, 'report_max_paragraph_sentences': 3})}


def build(project, offer_key=None):
    company = json.loads((project / 'company.json').read_text())
    if offer_key:
        company['offer'] = offer_key  # preview any of your offers on this company, e.g. a sample prospect
    key, offer = choose_offer(company)
    if offer.get('page') == 'template':
        raise ValueError(f'Offer "{key}" uses the template page: build it with scripts/build_page.py (SKILL.md, step 5)')
    if offer.get('page') == 'sprint':
        import build_sprint
        return build_sprint.build(project)
    validate(company, offer)
    claims = provider.claims()
    notes = []
    amount = offer_price(key, offer, company['currency'], notes)
    for note in notes:
        print('NOTE:', note)
    call = booking_link({'booking': {'url': company.get('call_url') or offer['booking_url'], 'campaign': company['slug']}}, project, True)
    # The shared sections' default wording is written for the sprint; the general page speaks to this offer.
    company.setdefault('look_at_first_heading', 'Where we would start.')
    company.setdefault('look_at_first_aim', f'The aim: {offer["outcome"][0].lower() + offer["outcome"][1:]}.')
    p = parts.Page(company, claims, project, data_uri)
    links = [('noticed', 'Why now'), ('work', 'Where we’d help'), ('get', 'What you get'), ('offer', 'Let’s talk')]
    body = parts.header(p, links) + '<main>'
    body += parts.hero(p, offer.get('hero_line', offer['outcome']), offer['button'], '#offer')
    body += parts.noticed(p, company.get('noticed_heading', 'What is changing for you right now.'))
    body += parts.work(p, '#example' if company.get('example') else '#get',
                       'What could that look like?' if company.get('example') else 'What would you get?')
    body += example(p) + what_you_get(p, offer)
    if claims.get('proof_tiles'):
        body += parts.proof(p, claims.get('copy', {}).get('proof_lead', 'Results from work like this.'))
    if claims.get('about'):
        body += parts.about(p, f'<a href="#offer">{e(offer["button"])}</a>')
    body += offer_section(p, offer, amount, call) + '</main>' + parts.footer(p, 'Examples are illustrative.')
    colours = ''.join(f'--{k}:{v};' for k, v in company['brand']['colours'].items())
    fonts = company['brand']['fonts']
    accent = provider.load()['provider'].get('accent', '')
    accent = f'--provider-accent:{accent};' if re.fullmatch(r'#[0-9a-fA-F]{6}', accent) else ''
    variables = f':root{{{colours}{accent}--body-font:"{fonts["body"]}";--heading-font:"{fonts["heading"]}";}}'
    look = company.get('design') or {}
    motion = look.get('motion') or {}
    extra_css, extra_js, body_attrs = '', '', ''
    if look:
        extra_css += '\n' + (SKILL / 'sprint/design.css').read_text()
        extra_js = '<script>' + (SKILL / 'sprint/design.js').read_text() + '</script>'
        body_attrs = (f' data-reveal="{escape(motion.get("reveal", "none"))}"'
                      f' style="--motion-duration:{float(motion.get("duration", 0.3))}s;--motion-ease:{escape(motion.get("easing", "ease"))}"'
                      + (' data-smooth="true"' if motion.get('smooth_scroll') else ''))
    if (project / 'theme.css').exists():
        extra_css += '\n' + (project / 'theme.css').read_text()
    me = provider.load()['provider']
    lang = me.get('language', 'en-GB')
    title = escape(f'Prepared for {company["name"]} | {me["business"]}')
    description = escape(company['goal']['headline'] + ' ' + company['goal']['lead'], quote=True)
    html = ('<!-- ABOUTME: Self-contained page built from company slots and the provider\'s own offer.\n'
            'ABOUTME: Rebuild with page/build.py; edit source, never this output. -->\n'
            f'<!doctype html><html lang="{e(lang)}"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<meta name="robots" content="noindex,nofollow"><title>{title}</title><meta name="description" content="{description}">'
            f'<link href="{escape(fonts["google_url"], quote=True)}" rel="stylesheet">'
            f'<style>{variables}\n{(SKILL / "sprint/sprint.css").read_text()}\n{(HERE / "page.css").read_text()}{extra_css}</style></head><body class="refresh"{body_attrs}>'
            + body + extra_js + '</body></html>')
    problems, grade = check(html, project, lint_rules(claims, offer))
    if problems:
        raise ValueError('Lint failed; no output written:\n  - ' + '\n  - '.join(problems))
    output = project / 'build' / f'{company["slug"]}.html'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html)
    print(f'PASS {output} ({output.stat().st_size // 1024} KB; grade {grade:.2f}; offer {key})')
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('project_dir', type=Path)
    parser.add_argument('--offer', help='build the page for this offer key from offers.json, in place of company.json\'s')
    args = parser.parse_args()
    try:
        build(args.project_dir.resolve(), args.offer)
    except (KeyError, ValueError, OSError) as error:
        raise SystemExit(f'Build failed: {error}') from error


if __name__ == '__main__':
    main()
