# ABOUTME: Gates sprint scope, plain copy, report paragraphs, image formats and unfilled slots.
# ABOUTME: Uses one DOM parser and the active profile's locked claims; failures return a non-zero exit code.
import argparse
import base64
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import struct
import sys
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import provider

VOID = {'img', 'meta', 'link', 'br', 'hr', 'input', 'source', 'wbr', 'area', 'base', 'embed', 'param', 'track', 'col'}
BLOCKS = {'p', 'h1', 'h2', 'h3', 'h4', 'li', 'td', 'th', 'div', 'span', 'b', 'small', 'time', 'button', 'a', 'text'}


class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag = tag
        self.attrs = dict(attrs)
        self.parent = parent
        self.children = []

    def text(self):
        return re.sub(r'\s+', ' ', ' '.join(child if isinstance(child, str) else child.text() for child in self.children)).strip()

    def within(self, predicate):
        node = self
        while node:
            if predicate(node):
                return True
            node = node.parent
        return False


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.current = self.root
        self.nodes = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        self.nodes.append(node)
        if tag not in VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, text):
        if not self.current.within(lambda n: n.tag in {'script', 'style', 'head'}):
            self.current.children.append(text)


def words(text):
    return re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)?", text)


def sentences(text):
    return [s for s in re.split(r'[.!?]+(?:\s|$)', text) if words(s)]


def syllables(word):
    word = word.lower().replace('’', "'")
    if len(word) <= 3:
        return 1
    word = re.sub(r"(?:'s|s')$", '', word)
    count = len(re.findall(r'[aeiouy]+', word))
    if word.endswith('e') and not re.search(r'[^aeiouy]le$', word):
        count -= 1
    if word.endswith('ed') and not word.endswith(('ted', 'ded')):
        count -= 1
    return max(1, count)


def reading_grade(document):
    # Whole paragraphs keep inline emphasis; bare chart labels count once each.
    chunks = []
    def collect(node):
        if node.tag in {'p', 'h1', 'h2', 'h3', 'h4', 'li', 'td', 'th', 'button', 'text'}:
            if node.text():
                chunks.append(node.text())
            return
        for child in node.children:
            if isinstance(child, Node):
                collect(child)
            elif words(child):
                chunks.append(child.strip())
    collect(document.root)
    text = '. '.join(chunk.rstrip('.!?') for chunk in chunks)
    tokens = words(text)
    count = max(1, len(sentences(text)))
    return 0.39 * len(tokens)/count + 11.8 * sum(map(syllables, tokens))/max(1, len(tokens)) - 15.59


def png_alpha(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return False
    offset = 8
    while offset + 12 <= len(data):
        size = struct.unpack('>I', data[offset:offset+4])[0]
        kind = data[offset+4:offset+8]
        if offset + 12 + size > len(data):
            return False
        if kind == b'IHDR' and size == 13 and data[offset+17] in (4, 6):
            return True
        if kind == b'tRNS':
            return True
        offset += 12 + size
    return False


def check_images(document, folder):
    problems, checked = [], set()
    for node in document.nodes:
        if node.tag != 'img':
            continue
        label = node.attrs.get('alt', '(missing alt)')
        if 'alt' not in node.attrs:
            problems.append('image: every img needs alt, including decorative images')
        src = node.attrs.get('src', '')
        photo = node.attrs.get('data-photo') == 'true'
        if not src:
            problems.append(f'image: empty src ({label})')
            continue
        if photo or src in checked:
            continue
        checked.add(src)
        try:
            if src.startswith('data:'):
                header, payload = src.split(',', 1)
                data = base64.b64decode(payload, validate=True) if ';base64' in header else unquote(payload).encode()
                mime = header.split(';')[0][5:]
            else:
                url = urlparse(src)
                if url.scheme or url.netloc:
                    raise ValueError('non-photo images must be inlined or local')
                path = folder / unquote(url.path)
                data = path.read_bytes()
                mime = 'image/svg+xml' if path.suffix.lower() == '.svg' else 'image/png'
            if mime == 'image/svg+xml' and re.search(rb'<svg\b', data):
                continue
            if mime != 'image/png' or not png_alpha(data):
                raise ValueError('non-photo image must be a PNG with alpha or an SVG')
        except (OSError, ValueError) as error:
            problems.append(f'image {label or "decorative"}: {error}')
    return problems


def check(html, folder=Path('.'), claims=None):
    claims = claims or provider.claims()
    doc = Document(html)
    problems = []
    text = doc.root.text().replace('’', "'")
    if '—' in text:
        problems.append('copy: em dash found')
    # The gallery marks a page "old" when it uses "check" more than five times (outreach-clarity.md).
    if len(re.findall(r'\bcheck', text.lower())) > 5:
        problems.append('copy: more than five uses of "check"')
    for phrase in claims['banned_phrases'] + claims['hedge_phrases']:
        if re.search(r'(?<!\w)' + re.escape(phrase) + r'(?!\w)', text, re.I):
            problems.append(f'copy: banned or hedge phrase "{phrase}"')
    for old, new in claims['vocabulary_map'].items():
        if re.search(r'\b' + re.escape(old) + r'\b', text, re.I):
            problems.append(f'copy: use "{new}" instead of "{old}"')
    if any(re.search(r'\bnot\s+[^.!?;,:]{1,90},\s*\w', node.text(), re.I) or re.search(r",\s+not\s+\w|\byou don't need\b", node.text(), re.I) for node in doc.nodes if node.tag in {'p', 'h1', 'h2', 'h3', 'li', 'td', 'th'}):
        problems.append('copy: "not X, Y" construction found')
    if re.search(r'\{\{[^{}]*\}\}|\[\[[A-Za-z][^\]]*\]\]|\b(?:TODO|TBC|TBD|PLACEHOLDER)\b', html):
        problems.append('slots: unreplaced token or placeholder')
    exception = claims.get('scope_exception') or {}
    for node in doc.nodes:
        for child in node.children:
            if not isinstance(child, str):
                continue
            for word in claims['scope_words']:
                if not re.search(r'\b' + re.escape(word) + r'\b', child, re.I):
                    continue
                excluded = node.within(lambda n: n.tag == 'tr' and 'out' in n.attrs.get('class', '').split()
                                       and n.attrs.get('data-not-included') == 'true' and 'not included' in n.text().lower())
                historical = (bool(exception) and node.tag == 'p' and node.text() == exception['text']
                              and node.within(lambda n: n.attrs.get('data-proof') == exception['proof_id'])
                              and node.within(lambda n: n.attrs.get('id') == 'proof'))
                if not excluded and not historical:
                    problems.append(f'scope: "{word}" outside a not-included row: {child[:90]}')
    for claim in claims['proof_tiles']:
        tiles = [n for n in doc.nodes if n.attrs.get('data-proof') == claim['id']
                 and n.within(lambda n: n.attrs.get('id') == 'proof')]
        if len(tiles) != 1:
            problems.append(f'claims: expected one proof tile for {claim["id"]}')
        elif any(claim[key].replace('’', "'") not in tiles[0].text().replace('’', "'")
                 for key in ('number', 'heading', 'text', 'who')):
            problems.append(f'claims: locked proof wording changed for {claim["id"]}')
    limit = claims['reading_level']
    for node in doc.nodes:
        if node.tag == 'p' and node.within(lambda n: 'pg' in n.attrs.get('class', '').split()):
            if len(words(node.text())) > limit['report_max_paragraph_words'] or len(sentences(node.text())) > limit['report_max_paragraph_sentences']:
                problems.append(f'report: paragraph is too long: {node.text()[:100]}')
    grade = reading_grade(doc)
    if grade > limit['max_grade']:
        problems.append(f'copy: Flesch-Kincaid grade {grade:.2f} exceeds {limit["max_grade"]}')
    problems.extend(check_images(doc, folder))
    return problems, grade


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('html', type=Path)
    args = parser.parse_args()
    problems, grade = check(args.html.read_text(), args.html.resolve().parent)
    print(f'{"FAIL" if problems else "PASS"} {args.html} (Flesch-Kincaid grade {grade:.2f})')
    for problem in problems:
        print(f'  - {problem}')
    return int(bool(problems))


if __name__ == '__main__':
    sys.exit(main())
