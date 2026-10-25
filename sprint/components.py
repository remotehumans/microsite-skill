# ABOUTME: Renders sprint sections from company slots and the locked claims library.
# ABOUTME: Keeps the approved page layout without patching the compiled HTML.
from datetime import date
from html import escape
import json
import math
from pathlib import Path

import provider

SKILL = Path(__file__).resolve().parents[1]
# Shared method art first, then the provider's own art (client logos, proof collage).
ART_DIRS = [SKILL / 'assets/art', provider.path('art')]


def e(value):
    return escape(str(value), quote=True)


def date_label(value, precision='day'):
    return date.fromisoformat(value).strftime('%B %Y' if precision == 'month' else '%d %B %Y').lstrip('0')


class Page:
    def __init__(self, company, claims, project, image_uri):
        self.c = company
        self.k = claims
        self.project = project
        self.image_uri = image_uri
        self.report = {**claims.get('report_defaults', {}), **company.get('report', {})}
        self.me = provider.load()['provider']

    def image(self, path, alt, photo=False, attrs=''):
        path = Path(path).resolve()
        roots = [*ART_DIRS, self.project / 'art']
        if not photo and not any(path.is_relative_to(root.resolve()) for root in roots):
            raise ValueError(f'Non-photo asset must be in assets/art, the profile art folder or the project art folder: {path}')
        marker = ' data-photo="true"' if photo else ''
        return f'<img src="{self.image_uri(path)}" alt="{e(alt)}"{marker} {attrs}>'

    def art(self, name, alt='', attrs=''):
        # A company can replace any shared illustration with art made in its own style (company.json design.art).
        own = ((self.c.get('design') or {}).get('art') or {}).get(name)
        if own:
            return self.image(self.project / own['path'], own.get('alt', alt), photo=True, attrs=attrs)
        found = next((root / f'{name}.png' for root in reversed(ART_DIRS) if (root / f'{name}.png').exists()), ART_DIRS[0] / f'{name}.png')
        return self.image(found, alt, attrs=attrs)


def section(identifier, eyebrow, heading, content, classes='rf-section'):
    return (f'<section id="{identifier}" class="{classes}"><div class="rf-wrap">'
            f'<p class="eyebrow">{e(eyebrow)}</p><h2>{e(heading)}</h2>{content}</div></section>')


def bridge(target, text):
    return f'<p class="bridge"><a href="{e(target)}">{e(text)}</a></p>'


def design(p, part):
    """The company's design choices for one part of the page (company.json design), mirroring their own site."""
    return (p.c.get('design') or {}).get(part) or {}


def topbar(p):
    # A utility bar above the main header, when their site has one (opening hours, phone, locations).
    items = design(p, 'header').get('topbar')
    if not items:
        return ''
    def item(i):
        kind = i.get('kind', 'text')
        if i.get('href'):
            return f'<a class="rf-top-{e(kind)}" href="{e(i["href"])}">{e(i["text"])}</a>'
        return f'<span class="rf-top-{e(kind)}">{e(i["text"])}</span>'
    return '<div class="rf-topbar"><div class="rf-wrap">' + ''.join(item(i) for i in items) + '</div></div>'


def header(p, links=None):
    links = links or [('noticed', 'Why now'), ('example', 'One example'), ('report', 'Your report'), ('sprint', 'Let’s talk')]
    nav = ''.join(f'<a href="#{key}">{text}</a>' for key, text in links)
    bar = topbar(p)
    menu = ('<button type="button" class="rf-menu" aria-expanded="false" aria-controls="rf-nav">Menu</button>'
            if design(p, 'header').get('phone_menu') else '')
    main = (f'<header class="rf-header"><a href="#intro" aria-label="Prepared for {e(p.c["name"])}">'
            f'{p.image(p.project / p.c["logo"], p.c["name"])}</a>{menu}'
            f'<nav{" id=\"rf-nav\"" if menu else ""} aria-label="Page sections">{nav}</nav></header>')
    return f'<div class="rf-masthead">{bar}{main}</div>' if bar else main


def headline(p):
    # Their sites often set the second line of a headline in an accent colour.
    text = p.c['goal']['headline']
    if design(p, 'hero').get('accent') != 'second-line' or '. ' not in text:
        return e(text)
    first, rest = text.split('. ', 1)
    return f'{e(first)}. <span class="rf-accent">{e(rest)}</span>'


def hero(p, line=None, button=None, target='#sprint'):
    # line, button and target default to the sprint page's locked copy; the general page passes its offer's own.
    c = p.c
    image = c['hero']
    line, button = line or p.k['copy']['hero_line'], button or p.k['copy']['hero_button']
    look = design(p, 'hero')
    if look.get('layout') == 'photo':
        return photo_hero(p, look, line, button, target)
    return (f'<section id="intro" class="rf-section rf-hero"><div class="rf-wrap">'
            f'<p class="eyebrow">Prepared for {e(c["name"])} · {e(c["prepared_date"])}</p>'
            f'<h1>{e(c["goal"]["headline"])}</h1><p class="lead">{e(c["goal"]["lead"])}</p>'
            f'<p>{e(line)}</p>'
            f'<a class="rf-button" href="{e(target)}">{e(button)}</a>'
            f'<p>By {e(p.me["person"])}, {e(p.me["byline"])}.</p>'
            + p.image(p.project / image['path'], image['alt'], image['photo'])
            + bridge('#noticed', 'What in your own material led us here?') + '</div></section>')


def photo_hero(p, look, line, button, target):
    """Full-width photo hero with an overlay, for sites that open on photography."""
    c, image = p.c, p.c['hero']
    second = look.get('secondary')
    buttons = (f'<a class="rf-button" href="{e(target)}">{e(button)}</a>'
               + (f'<a class="rf-button rf-button-alt" href="{e(second["href"])}">{e(second["text"])}</a>' if second else ''))
    tagline = f'<p class="rf-hero-tagline">{e(look["tagline"])}</p>' if look.get('tagline') else ''
    frame = ' rf-framed' if look.get('frame') else ''
    return (f'<section id="intro" class="rf-section rf-hero rf-hero-photo"><div class="rf-hero-media">'
            + p.image(p.project / image['path'], image['alt'], image['photo'])
            + f'<div class="rf-hero-shade"></div></div><div class="rf-wrap"><div class="rf-hero-box{frame}">'
            f'<p class="eyebrow">Prepared for {e(c["name"])} · {e(c["prepared_date"])}</p>'
            f'<h1>{headline(p)}</h1><p class="lead">{e(c["goal"]["lead"])}</p>'
            f'<p>{e(line)}</p><div class="rf-buttons">{buttons}</div>'
            f'<p class="rf-byline">By {e(p.me["person"])}, {e(p.me["byline"])}.</p></div>{tagline}'
            + bridge('#noticed', 'What in your own material led us here?') + '</div></section>')


def noticed(p, heading='You have a clear next stage to grow into.'):
    facts = ''.join(f'<li><time datetime="{e(f["date"][:7] if f.get("date_precision") == "month" else f["date"])}">{date_label(f["date"], f.get("date_precision", "day"))}</time>'
                    f'<a href="{e(f["url"])}">{e(f["text"])}</a></li>' for f in p.c['noticed'])
    return section('noticed', 'What we noticed', heading,
                   f'<ul class="rf-facts">{facts}</ul><p>{e(p.c["noticed_summary"])}</p>'
                   + bridge('#work', 'Where would we look for the biggest gains?'))


def work(p, next_target='#example', next_text='What could that look like in your own work?'):
    def card(c):
        if not c.get('image'):
            return f'<article class="rf-card"><h3>{e(c["title"])}</h3><p>{e(c["text"])}</p></article>'
        return (f'<article class="rf-card rf-card-photo">{p.image(p.project / c["image"]["path"], c["image"]["alt"], True)}'
                f'<div class="rf-card-label"><h3>{e(c["title"])}</h3><p>{e(c["text"])}</p></div></article>')
    cards = ''.join(card(c) for c in p.c['look_at_first'])
    return section('work', 'What we’d look at first', p.c.get('look_at_first_heading', 'Follow the work that turns into revenue.'),
                   f'<div class="rf-grid">{cards}</div>'
                   f'<p>{e(p.c.get("look_at_first_aim", "The aim is more room to sell and serve, with less time spent chasing information."))}</p>'
                   + bridge(next_target, next_text), 'rf-section rf-tint')


def example_tabs(p):
    example = p.c['example']
    tabs, panels = [], []
    for i, tab in enumerate(example['tabs']):
        tabs.append(f'<button type="button" role="tab" class="rf-tab" id="exampleTab{i}" '
                    f'aria-selected="{str(i == 0).lower()}" aria-controls="examplePanel{i}" '
                    f'tabindex="{0 if i == 0 else -1}">{i+1:02d} / {e(tab["title"])}</button>')
        panels.append(f'<article class="rf-panel" role="tabpanel" id="examplePanel{i}" '
                      f'aria-labelledby="exampleTab{i}" {"hidden" if i else ""}>'
                      f'<p class="eyebrow">Your published material</p><h3>{e(tab["title"])}</h3>'
                      f'<p class="rf-published">{e(tab["published"])}</p>'
                      f'<p class="eyebrow">What the sprint would explore</p><p>{e(tab["explore"])}</p></article>')
    return section('example', 'One example on your own material', example['heading'],
                   f'<p class="lead">{e(example["lead"])}</p>'
                   f'<p><a href="{e(example["source_url"])}">{e(example["source_label"])}</a></p>'
                   '<div class="rf-example"><div class="rf-tabs" role="tablist" aria-label="Explore your published work">'
                   + ''.join(tabs) + '</div><div>' + ''.join(panels) + '</div></div>'
                   '<p>AI can help find relevant information and draft a useful summary. Your people decide what reaches the client.</p>'
                   + bridge('#method', 'How would we turn those questions into a plan?'))


def method_story(p):
    images, beats = [], []
    for i, beat in enumerate(p.k['method_beats']):
        images.append(p.art(beat['art'], attrs=f'data-rf-art="{i}" class="{"on" if not i else ""}"'))
        beats.append(f'<article class="rf-beat" data-rf-beat="{i}"><p class="eyebrow">{i+1:02d} / {len(p.k["method_beats"]):02d}</p>'
                     f'<h3>{e(beat["title"])}</h3><p>{e(beat["text"])}</p></article>')
    return section('method', 'How the sprint works', 'Listen, map and choose the next move.',
                   f'<p>{e(p.c["method_intro"])}</p><div class="rf-story"><div class="rf-stage">'
                   + ''.join(images) + '</div><div>' + ''.join(beats) + '</div></div>'
                   + bridge('#people', 'How does your team shape the work?'))


def people(p):
    data = json.loads((p.project / p.c['team_json']).read_text())
    # Allowlist only group and tech. Names, links, photos and personal details never leave this function.
    members = [{'group': person['group'], 'tech': bool(person.get('tech'))} for person in data['people']]
    count = len(members)
    tech = sum(person['tech'] for person in members)
    # "roles" maps kinds of published role rather than people, for teams without a public team page.
    roles_only = p.c.get('people_mode') == 'roles'
    description = (f'A partial map of {count} published roles in {len(data["groups"])} groups.' if roles_only else
                   f'{count} people in {len(data["groups"])} groups. {tech} mention tech in their own team page bio.')
    svg = ['<svg viewBox="0 -40 1000 800" role="img" aria-labelledby="pm-t pm-d">'
           '<title id="pm-t">Your team by job title</title>'
           f'<desc id="pm-d">{e(description)}</desc>']
    for g in data['groups']:
        group = [person for person in members if person['group'] == g['id']]
        n = len(group)
        radius = g['r'] * (.5 if n == 2 else .56)
        svg.append(f'<circle class="pm-g" cx="{g["cx"]}" cy="{g["cy"]}" r="{g["r"]}"/>'
                   f'<text class="pm-l" x="{g["cx"]}" y="{g["cy"]-g["r"]-16}" text-anchor="middle">{e(g["label"])}</text>')
        for i, person in enumerate(group):
            angle = -math.pi/2 + i/n*math.pi*2 + (math.pi/2 if n == 2 else 0)
            x = g['cx'] if n == 1 else g['cx'] + math.cos(angle)*radius
            y = g['cy'] if n == 1 else g['cy'] + math.sin(angle)*radius
            svg.append(f'<circle class="pm-p{" pm-tech" if person["tech"] else ""}" cx="{x:.0f}" cy="{y:.0f}" r="30"/>')
    svg.append('</svg>')
    hidden = set(p.c.get('people_hide_promises', []))
    promises = ''.join(f'<li><div><b>{e(row["title"])}</b>{e(row["text"])}</div></li>' for row in p.k['people']['promises']
                       if row['title'] not in hidden)
    key = ('<div class="pm-key"><span><i></i>A published role · partial map</span></div>' if roles_only else
           '<div class="pm-key"><span><i></i>A person on your team page</span><span><i class="t"></i>Mentions tech in their own bio</span></div>')
    stat = (f'<p class="pm-big">{len(data["groups"])} groups</p><p class="pm-bigtext">{e(p.c["people_summary"])}</p>' if roles_only else
            f'<p class="pm-big">{tech} in {count}</p><p class="pm-bigtext">of you already say you love tech in your own team page bios. That’s where we start.</p>')
    timeline = ''.join(f'<div class="pm-row"><div class="pm-bar" style="--c:{e(row["column"])}">'
                       f'{e(row["title"])}<small>{e(row["text"])}</small></div></div>' for row in p.k['people']['timeline'])
    return section('people', 'Your people', 'Your team comes on the journey.',
                   '<p class="lead">AI should help with the work no one enjoys. It should never take away what makes your people good at their jobs.</p>'
                   '<div class="pm-grid"><div class="pm-map">' + ''.join(svg)
                   + key + '</div><div>' + stat
                   + f'<ul class="pm-promises">{promises}</ul></div></div>'
                   '<div class="pm-time"><h3>How we bring everyone along</h3>'
                   f'<p>The sprint takes {e(p.k["scope"]["duration"])}. Your people shape every step.</p>'
                   '<div class="pm-weeks"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div>'
                   f'<div class="pm-rows">{timeline}</div></div>', classes='')


def cards(rows):
    return '<div class="cards">' + ''.join(
        f'<div class="card"><div class="n">{i}</div><div><b>{e(title)}</b><span>{e(text)}</span></div></div>'
        for i, (title, text) in enumerate(rows, 1)) + '</div>'


def table(headings, rows, cls='tt'):
    head = ''.join(f'<th scope="col">{e(h)}</th>' for h in headings)
    body = ''.join('<tr>' + ''.join(f'<td>{cell}</td>' for cell in row) + '</tr>' for row in rows)
    return f'<table class="{cls}"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>'


def included_table(rows, headings, scope):
    body = ''.join(f'<tr><td>{e(a)}</td><td>{e(b)}</td><td><span class="ck" aria-label="Included">✓</span></td></tr>' for a, b in rows)
    body += (f'<tr class="out" data-not-included="true"><td>{e(scope["out"][0])}</td>'
             f'<td>{e(scope["out"][1])} are not included.</td>'
             '<td><span class="ck x" aria-label="Not included">✕</span></td></tr>')
    return '<table class="inc"><thead><tr>' + ''.join(f'<th scope="col">{e(h)}</th>' for h in headings) + '</tr></thead><tbody>' + body + '</tbody></table>'


def report_book(p):
    r = p.report
    c = p.c
    business, offer_label = e(p.me['business']), e(p.k['scope']['label'])
    # Their logo brands the report: large on the cover, small in each page footer. Use a dark version on the light pages if theirs is white.
    logo_path = p.project / c.get('logo_on_light', c['logo'])
    cover_logo = f'<div class="cover-logo">{p.image(logo_path, c["name"])}</div>'
    # Footers reuse one copy of the logo through a CSS variable, so it is embedded once for the whole book.
    footer_logo = '<span class="rf-logo" aria-hidden="true"></span>'
    pages = [f'<div class="pf-page"><div class="pg cover"><div class="rh"><b>{business}</b>'
             f'<span class="smp">{e(r["sample_label"])}</span><span>Prepared for {e(c["name"])}</span></div>'
             + cover_logo + p.art('report', attrs='class="art"')
             + f'<div class="kick">For the {e(c["name"])} team</div><h1>{offer_label} Report</h1>'
               f'<div class="by">by {business}</div></div></div>']

    def page(label, title, body):
        number = len(pages) + 1
        pages.append(f'<div class="pf-page"><div class="pg rp"><div class="rh"><span class="lbl">{e(label)}</span>'
                     f'<span class="smp">{e(r["sample_label"])}</span><b>{business}</b></div><h3>{e(title)}</h3>{body}'
                     f'<div class="rf"><span>{footer_logo}{offer_label} · {e(c["name"])}</span><span>{number}</span></div></div></div>')

    def lead(text):
        return f'<p class="lead">{e(text)}</p>'

    def tag(text=None):
        return f'<span class="tag">{e(text or r["example_tag"])}</span>'

    page('Start here', 'What this report gives you', lead(c['goal']['report']) + cards(r['goal_cards'])
         + '<div class="box"><b>You keep it all.</b> The report and the files to edit it are yours.</div>'
           '<p class="cap">This is a sample. Your real report comes after we talk to your team.</p>')
    stat = c['public_number']
    squares = ''.join(f'<i class="{"on" if i < round(stat["value"]) else ""}"></i>' for i in range(100))
    page(stat.get('eyebrow', 'Where the time goes'), stat.get('heading', 'How much work could a machine do?'), lead(stat['label'])
         + f'<div class="legend"><span><b></b>{e(stat.get("on_label", "Could be done by a machine"))}</span><span><b class="off"></b>{e(stat.get("off_label", "Needs a person"))}</span></div>'
         f'<div class="waffle" role="img" aria-label="{e(stat.get("aria_label", str(stat["value"]) + "% of team time"))}">{squares}</div>'
         f'<div class="bigrow"><div class="bignum">{stat["value"]}{e(stat["unit"])}</div><p>{e(stat["period"])}</p></div>'
         f'<p style="margin-top:2cqw">{e(stat.get("context", "We confirm this with your team. Then we find which tasks it is."))}</p>'
         f'<p class="src">Source: <a href="{e(stat["url"])}" target="_blank" rel="noopener">{e(stat["source_label"])} ↗</a>, '
         f'{date_label(stat["date"], stat.get("date_precision", "day"))}. {e(stat["square_label"])}</p>')
    route = c['example']['route']
    steps = ''.join(f'<div class="st{" hot" if i == c["example"]["stopped_at"] else ""}"><div class="c">{i}</div>'
                    f'<div><b>{e(row["name"])}</b><span>{e(row["text"])}</span></div></div>' for i, row in enumerate(route, 1))
    page('The work today', c['example']['route_heading'],
         lead(c['example'].get('route_lead', 'This is the road the work takes each month. We confirm it with your team.'))
         + f'<div class="steps">{steps}</div><div class="warn">{e(c["example"]["stopped_callout"])}</div>'
           '<p class="cap">A starting route to confirm with your team.</p>')
    biggest = max(row['example_hours'] for row in route)
    bars = ''.join(f'<div class="hb{" top" if row["example_hours"] == biggest else ""}"><em>{e(row["name"])}</em>'
                   f'<u style="--w:{round(row["example_hours"]/biggest*100)}%"></u><span class="v">{row["example_hours"]}h</span></div>' for row in route)
    slow = next(row['name'] for row in route if row['example_hours'] == biggest)
    page('Measure the work', 'Where do the hours go?', lead('We count the hours in each step. Then we see where the time is stuck.')
         + tag() + bars + f'<p>In this example, {e(slow)} takes the most hours. That is where we would look first.</p>'
           '<p class="cap">Hours per month for one team. Your real hours come from your team.</p>')
    page('AI and people', 'What AI does. What people do.', lead('AI helps with the first draft. A person makes every final choice.')
         + table(['Step', 'AI can', 'A person'], [[e(row[k]) for k in ('name', 'ai', 'person')] for row in route])
         + f'<div class="box"><b>One rule:</b> {e(r["ai_rule"])}</div>')
    solutions = r['solutions']
    dots = ''.join(f'<span class="dot{" t" if i == 1 else ""}" style="left:{row["x"]}%;top:{row["y"]}%">{i}</span>' for i, row in enumerate(solutions, 1))
    key = ' &nbsp; '.join(f'<b class="{"t" if i == 1 else ""}">{i}</b>{e(row["name"])}' for i, row in enumerate(solutions, 1))
    page('Choose what first', 'Which solution should go first?', lead('Top right is best: big value, and ready to start.')
         + tag('Example positions') + '<div class="grid2"><div>Plan for later</div><div class="go">Do first</div><div>Leave for now</div><div>Quick wins</div>'
         + dots + '<span class="ax x">Ready to start →</span><span class="ax y">Value to you →</span></div>' + f'<div class="key">{key}</div>')

    def pill(value):
        return f'<span class="pill {"m" if value == "Medium" else "h" if value == "High" else ""}">{e(value)}</span>'

    rows = [[str(i), e(row['name']), *[pill(row[k]) for k in ('value', 'effort', 'risk')]] for i, row in enumerate(solutions, 1)]
    page('The ranked list', 'The solutions, in order',
         lead('Each solution gets a score for value, effort and risk. Your team agrees the scores.') + tag('Example ranking')
         + table(['#', 'Solution', 'Value', 'Effort', 'Risk'], rows) + f'<p>{e(r["ranking_note"])}</p>'
           '<p class="cap">Scores show the format. The sprint sets the real ones.</p>')
    saving = r['saving']
    before, removed, review = (saving[k] for k in ('before', 'routine_removed', 'review'))
    after = before - removed + review
    equation = ''.join(f'<div><b>{value}h</b>{label}</div>{"<i>"+symbol+"</i>" if symbol else ""}' for value, label, symbol in
                       [(before, 'today', '−'), (removed, 'routine work gone', '+'), (review, 'new review time', '='), (after, 'after', '')])
    page('The benefit', 'How we work out the saving', lead('We measure one task before and plan the hours after. The gap is the benefit.')
         + tag() + f'<div class="cmp"><div class="before" style="--h:100%">{before}h<u></u></div>'
           f'<div class="after" style="--h:{after/before*100:g}%">{after}h<u></u></div></div>'
           '<div class="cmp-l"><span>Before</span><span>After</span></div>'
           f'<div class="sum">{equation}</div><p>Saved: <b>{before-after} {e(saving["unit"])}</b> {e(saving["period"])}.</p>')
    page('Your tools', 'Start with the tools you have', lead('You have already tested some tools. We learn from that first.')
         + table(['Tool', 'What we know', 'What we do'], [[e(row[k]) for k in ('name', 'known', 'action')] for row in c['tools']])
         + '<p>We ask one question about each: does the right person get the right information at the right time?</p>')
    ticks = ''.join(f'<div class="{"no" if i > 2 else ""}">{e(rule)}</div>' for i, rule in enumerate(r['rules']))
    page('Keep it safe', 'The rules we follow', lead(c.get('rules_lead', 'These keep your clients and your books safe.')) + f'<div class="yn">{ticks}</div>')
    road = ''.join(f'<div class="{"n1" if i == 0 else ""}"><span>{e(when)}</span><b>{e(title)}</b><p>{e(text)}</p></div>' for i, (when, title, text) in enumerate(r['roadmap']))
    page('The roadmap', 'The plan, in order', lead('Three steps. Each one has an owner and a review date.') + f'<div class="road2">{road}</div>')
    page('Next step', 'How to start', lead('Three easy steps.') + cards(r['start'])
         + '<div class="box"><b>You decide what happens next.</b> Use the report with your team or another partner.</div>')
    page('Included', 'What you keep', lead(f'Everything below is in your {p.k["scope"]["label"]}.')
         + included_table(r['keep'], ['You get', 'So you can', 'Included'], p.k['scope'])
         + f'<div class="by2">{e(p.me["person"])} · {business} · {e(p.me["email"])}</div>')
    if len(pages) != r['page_count']:
        raise ValueError(f'Report page count: {len(pages)}, expected {r["page_count"]}')
    return (f'<section id="report" style="--company-logo:url({p.image_uri(logo_path.resolve())})"><div class="wrap"><div class="sec-head"><div class="num"></div><div>'
            '<h2>Flip through your report</h2><p class="sub">This is a sample of the report you would keep. Drag a corner, tap the edges or use the arrows. '
            f'{e(c.get("report_note", "The numbers are examples. Your real numbers come from your team."))}</p></div></div>'
            f'<div class="bookwrap"><div class="book" id="df-book" data-page-count="{len(pages)}">' + ''.join(pages)
            + '</div></div><div class="booknav"><button type="button" id="df-bkPrev" aria-label="Previous page">←</button>'
              '<span id="df-bkLabel"></span><button type="button" id="df-bkNext" aria-label="Next page">→</button></div>'
              '<p class="rf-report-note">The report is the brief for any next phase, whoever does it. Building anything is a separate decision.</p>'
              '<div class="df-reader-launch"><button type="button" id="df-open-reader">Read with larger text ↗</button></div>'
              '<dialog id="df-report-reader"><form method="dialog"><button class="df-reader-close">Close report ✕</button></form>'
              '<div id="df-reader-pages"></div></dialog>' + bridge('#proof', 'What experience would we bring to your team?') + '</div></section>')


def proof(p, lead=None):
    tiles = []
    for tile in p.k['proof_tiles']:
        bars = ''
        if 'after_percent' in tile:
            bars = ('<div class="bars"><div><span>Before</span><u style="--w:100%"></u></div>'
                    f'<div class="after"><span>After</span><u style="--w:{tile["after_percent"]}%"></u></div></div>')
        tiles.append(f'<div class="metric" data-proof="{e(tile["id"])}"><div class="big">{e(tile["number"])}</div>'
                     f'<h3>{e(tile["heading"])}</h3><p>{e(tile["text"])}</p>{bars}<div class="who">{e(tile["who"])}</div></div>')
    return section('proof', 'Work like this, done before', p.k['proof_heading'],
                   f'<p class="lead">{e(lead or p.k["copy"]["proof_lead"])}</p>'
                   + (f'<figure class="byob-art">{p.art(p.k["proof_art"])}</figure>'
                      if p.k.get('proof_art') and (p.c.get('design') or {}).get('proof_art', True) else '')
                   + '<div class="metrics">' + ''.join(tiles) + '</div>'
                   f'<p class="links"><a href="{e(p.me["results_url"])}" target="_blank" rel="noopener">See work and client stories ↗</a>'
                   ' &nbsp;·&nbsp; <a href="#about">Who would guide the work with your team?</a></p>')


def about(p, cta='We can work remotely with your team. <a href="#sprint">What would it take to start?</a>'):
    data = p.k['about']
    facts = ''.join(f'<div class="fact"><b>{e(f["title"])}</b><span>{e(f["text"])}</span></div>' for f in data['facts'])
    logos = ''.join(p.art(Path(logo['file']).stem, logo['name']) for logo in p.k['logos'])
    return ('<section id="about"><div class="wrap about"><div class="ph2">'
            + p.image(provider.path(p.me['photo']), p.me['person'], photo=True)
            + f'</div><div><div class="eyebrow">About me</div><h2>{e(data["heading"])}</h2>'
            + '<p class="lead">' + e(data['lead']).replace(p.me['business'], f'<a href="{e(p.me["results_url"])}" target="_blank" rel="noopener">{e(p.me["business"])}</a>', 1)
            + '</p>' + provider.linkedin_html(provider.load()) + f'<div class="facts">{facts}</div>'
            + (f'<div class="clients" aria-label="Organisations {e(p.me["first_name"])} has worked with">'
               f'<small>{e(data["logo_label"])}</small><div class="clogos">{logos}</div></div>' if logos else '')
            + f'<p class="cta">{cta}</p></div></div></section>')


def offer(p, amount, call):
    rows = [(f'{i}. {row["title"]}', row['text']) for i, row in enumerate(p.k['method_steps'], 1)]
    return section('sprint', f'Your {p.k["scope"]["label"]}', 'Make room for the next stage of growth.',
                   f'<p class="lead">{e(p.k["scope"]["summary"])}</p><div class="plan"><div class="plan-left">'
                   f'<p class="rf-price">{e(amount)}</p><p>{e(p.k["copy"]["price_note"])}</p>'
                   f'<p class="meta">{e(p.c.get("offer_meta", p.k["copy"]["offer_meta"]))}</p>'
                   f'<a class="rf-button" href="{e(call)}">{e(p.k["copy"]["call_button"])} ↗</a></div>'
                   + included_table(rows, ['What happens', 'What you get', 'Included'], p.k['scope']) + '</div>'
                   + bridge(call, 'Where would you most like room to grow?'), 'rf-section rf-offer')


def footer(p, note='Examples and report pages are illustrative.'):
    return (f'<footer class="rf-footer"><p>Prepared independently for {e(p.c["name"])} using public information. '
            f'{e(note)} Names, logos and images belong to their owners; they do not imply endorsement.</p>'
            f'<a href="{e(p.me["website"])}">{e(p.me["business"])} ↗</a></footer>')
