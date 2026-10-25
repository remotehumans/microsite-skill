# ABOUTME: Builds a self-contained sprint microsite from company.json and the active profile's locked claims.
# ABOUTME: Imports shared image, offer-price and booking helpers and gates output with lint.
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
from build_page import booking_link, data_uri, price
import provider
import components as sections
from lint_sprint import check


def validate(company):
    required = ['slug', 'name', 'brand', 'logo', 'hero', 'goal', 'noticed', 'noticed_summary',
                'look_at_first', 'example', 'public_number', 'tools', 'method_intro', 'team_json',
                'currency', 'prepared_date']
    for key in required:
        if key not in company:
            raise ValueError(f'Unfilled company slot: {key}')

    def filled(value, path='company'):
        if value is None or value == '' or value == [] or value == {}:
            raise ValueError(f'Unfilled slot: {path}')
        if isinstance(value, dict):
            for key, child in value.items():
                filled(child, f'{path}.{key}')
        elif isinstance(value, list):
            for i, child in enumerate(value):
                filled(child, f'{path}[{i}]')
        elif isinstance(value, str) and re.search(r'\{\{|\[\[|\b(?:TODO|TBD|TBC)\b', value):
            raise ValueError(f'Unfilled token: {path}')
    filled(company)
    overrides = {'solutions', 'ranking_note', 'saving', 'roadmap', 'goal_cards', 'rules', 'start', 'keep'}
    unknown = set(company.get('report', {})) - overrides
    if unknown:
        raise ValueError('Report fields are locked or unknown: ' + ', '.join(sorted(unknown)))
    colours = {'teal', 'deep', 'yellow', 'ink', 'muted', 'paper', 'navy', 'soft', 'pale', 'line'}
    if set(company['brand']['colours']) != colours:
        raise ValueError('Brand colours must define exactly: ' + ', '.join(sorted(colours)))
    if len(company['noticed']) != 3 or not 3 <= len(company['look_at_first']) <= 5:
        raise ValueError('Supply three noticed facts and three to five look-at-first cards')
    if len(company['example']['tabs']) != 3:
        raise ValueError('Supply three example tabs')
    for row in company['example']['route']:
        if not isinstance(row['example_hours'], (int, float)) or row['example_hours'] <= 0:
            raise ValueError('Example route hours must be positive numbers')
    if len(company.get('report', {}).get('solutions', [1, 2, 3, 4])) != 4:
        raise ValueError('Supply four report solutions')
    for row in company.get('report', {}).get('solutions', []):
        if not all(row[key] in {'High', 'Medium', 'Low'} for key in ('value', 'effort', 'risk')):
            raise ValueError('Solution ratings must be High, Medium or Low')
        if not all(0 <= row[key] <= 100 for key in ('x', 'y')):
            raise ValueError('Solution chart positions must be between 0 and 100')
    saving = company.get('report', {}).get('saving')
    if saving:
        before, removed, review = (saving[key] for key in ('before', 'routine_removed', 'review'))
        if before <= 0 or not 0 <= removed <= before or not 0 <= review <= removed:
            raise ValueError('Example saving must retain valid before, after and review hours')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', company['slug']):
        raise ValueError('slug must use lower-case words joined by hyphens')
    number = company['public_number']
    if not 0 <= number['value'] <= 100 or number['unit'] != '%':
        raise ValueError('The waffle chart needs a real public percentage from 0 to 100')
    for fact in [*company['noticed'], number]:
        date.fromisoformat(fact['date'])
        if not fact['url'].startswith('https://'):
            raise ValueError('Every public fact needs an exact HTTPS source URL')
    if not 1 <= company['example']['stopped_at'] <= len(company['example']['route']):
        raise ValueError('stopped_at must point to an example route step')
    for name, colour in company['brand']['colours'].items():
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', colour):
            raise ValueError(f'Invalid brand colour: {name}')
    for key in ('body', 'heading'):
        if not re.fullmatch(r'[A-Za-z0-9 ]+', company['brand']['fonts'][key]):
            raise ValueError(f'Invalid font family: {key}')
    look = company.get('design') or {}
    unknown = set(look) - {'header', 'hero', 'motion', 'font_map', 'proof_art', 'art'}
    if unknown:
        raise ValueError('Unknown design parts: ' + ', '.join(sorted(unknown)) + ' (see sprint/company.schema.md)')
    if (look.get('hero') or {}).get('layout') not in (None, 'stacked', 'photo'):
        raise ValueError('design.hero.layout must be stacked or photo')
    for key in [key for key in ('call_url',) if key in company]:
        if not company[key].startswith('https://') or '?' in company[key]:
            raise ValueError(f'{key} must be an HTTPS URL without a query')


def build(project):
    company = json.loads((project / 'company.json').read_text())
    claims = provider.claims()
    validate(company)
    notes = []
    amount = price(claims['scope']['price_key'], company['currency'], notes)
    if notes:
        raise ValueError('An official offer price is required: ' + '; '.join(notes))
    url = company.get('call_url') or provider.offers()[claims['scope']['price_key']]['booking_url']
    call = booking_link({'booking': {'url': url, 'campaign': company['slug']}}, project, True)
    page = sections.Page(company, claims, project, data_uri)
    functions = [sections.header, sections.hero, sections.noticed, sections.work, sections.example_tabs,
                 sections.method_story, sections.people, sections.report_book, sections.proof, sections.about]
    body = sections.header(page) + '<main>' + ''.join(function(page) for function in functions[1:])
    body += sections.offer(page, amount, call) + '</main>' + sections.footer(page)
    colours = ''.join(f'--{key}:{value};' for key, value in company['brand']['colours'].items())
    fonts = company['brand']['fonts']
    variables = f':root{{{colours}--body-font:"{fonts["body"]}";--heading-font:"{fonts["heading"]}";}}'
    # Their own look: the design layer and motion only when company.json asks for them, then the project's theme.css last.
    look = company.get('design') or {}
    motion = look.get('motion') or {}
    extra_css, extra_js, body_attrs = '', '', ''
    if look:
        extra_css += '\n' + (HERE / 'design.css').read_text()
        extra_js = '<script>' + (HERE / 'design.js').read_text() + '</script>'
        body_attrs = (f' data-reveal="{escape(motion.get("reveal", "none"))}"'
                      f' style="--motion-duration:{float(motion.get("duration", 0.3))}s;--motion-ease:{escape(motion.get("easing", "ease"))}"'
                      + (' data-smooth="true"' if motion.get('smooth_scroll') else ''))
    if (project / 'theme.css').exists():
        extra_css += '\n' + (project / 'theme.css').read_text()
    title = escape(f'Prepared for {company["name"]} | {provider.load()["provider"]["business"]}')
    description = escape(company['goal']['headline'] + ' ' + company['goal']['lead'], quote=True)
    html = ('<!-- ABOUTME: Self-contained sprint page built from company slots and locked claims.\n'
            'ABOUTME: Rebuild with sprint/build_sprint.py; edit source, never this output. -->\n<!doctype html><html lang="en-GB"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<meta name="robots" content="noindex,nofollow"><title>{title}</title>'
            f'<meta name="description" content="{description}">'
            f'<link href="{escape(fonts["google_url"], quote=True)}" rel="stylesheet">'
            f'<style>{variables}\n{(HERE / "sprint.css").read_text()}{extra_css}</style></head><body class="refresh"{body_attrs}>'
            + body + '<script>' + (SKILL / 'assets/vendor/page-flip-2.0.7.browser.js').read_text()
            + '</script><script>' + (HERE / 'sprint.js').read_text() + '</script>' + extra_js + '</body></html>')
    problems, grade = check(html, project, claims)
    if problems:
        raise ValueError('Lint failed; no output written:\n  - ' + '\n  - '.join(problems))
    output = project / 'build' / f'{company["slug"]}.html'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html)
    print(f'PASS {output} ({output.stat().st_size // 1024} KB; grade {grade:.2f})')
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('project_dir', type=Path)
    args = parser.parse_args()
    try:
        build(args.project_dir.resolve())
    except (KeyError, ValueError, OSError) as error:
        raise SystemExit(f'Build failed: {error}') from error


if __name__ == '__main__':
    main()
