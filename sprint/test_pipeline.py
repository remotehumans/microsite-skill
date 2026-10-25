# ABOUTME: Exercises the rebuilt sample page and failure cases for the sprint quality gates.
# ABOUTME: Also checks company validation, privacy projection and transparent artwork borders.
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

# These checks run against the fictional sample profile and example, so they work in any copy of the skill.
os.environ['MICROSITE_PROFILE'] = 'sample-studio'
from build_sprint import build, validate
import components
import provider
from lint_sprint import Document, check

SKILL = Path(__file__).resolve().parents[1]
PROJECT = SKILL / 'examples/sample-sprint'


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with contextlib.redirect_stdout(io.StringIO()):
            cls.html = build(PROJECT).read_text()
        cls.company = json.loads((PROJECT / 'company.json').read_text())
        cls.claims = provider.claims()

    def problems(self, html):
        return check(html, PROJECT / 'build')[0]

    def append(self, text):
        return self.html.replace('</main>', text + '</main>')

    def test_real_build_passes(self):
        self.assertEqual(self.problems(self.html), [])

    def test_scope_words(self):
        for word in self.claims['scope_words']:
            with self.subTest(word=word):
                self.assertTrue(any('scope:' in p for p in self.problems(self.append(f'<p>We include {word}.</p>'))))

    def test_exclusion_marker_needs_a_negative_row(self):
        html = self.append('<div data-not-included="true">We include training.</div>')
        self.assertTrue(any('scope:' in p for p in self.problems(html)))

    def test_historical_claim_is_an_exact_exception(self):
        exception = self.claims['scope_exception']['text']
        changed = self.html.replace(exception, exception.replace('training', 'AI training'))
        self.assertTrue(any('scope:' in p for p in self.problems(changed)))
        self.assertTrue(any('claims:' in p for p in self.problems(changed)))

    def test_all_banned_and_hedge_phrases(self):
        for phrase in self.claims['banned_phrases'] + self.claims['hedge_phrases']:
            with self.subTest(phrase=phrase):
                self.assertTrue(any('banned or hedge' in p for p in self.problems(self.append(f'<p>{phrase}.</p>'))))

    def test_vocabulary(self):
        for old in self.claims['vocabulary_map']:
            with self.subTest(word=old):
                self.assertTrue(any('instead of' in p for p in self.problems(self.append(f'<p>{old}.</p>'))))

    def test_contrast_and_em_dash(self):
        for copy in ['Not a plan, a promise.', 'A plan, not a promise.', 'A plan &#8212; for you.']:
            with self.subTest(copy=copy):
                self.assertTrue(any('construction' in p or 'em dash' in p for p in self.problems(self.append(f'<p>{copy}</p>'))))

    def test_report_paragraphs(self):
        for copy in ['First sentence. Second sentence. Third sentence.', ' '.join(['work'] * 41) + '.']:
            html = self.html.replace('<div class="pg rp">', f'<div class="pg rp"><p>{copy}</p>', 1)
            self.assertTrue(any('paragraph is too long' in p for p in self.problems(html)))

    def test_image_format_and_alt(self):
        changed = self.html.replace('data:image/png;base64,', 'data:image/jpeg;base64,', 1)
        self.assertTrue(any('PNG with alpha' in p for p in self.problems(changed)))
        changed = self.html.replace('alt="Ashby &amp; Rowe"', '', 1)
        self.assertTrue(any('every img needs alt' in p for p in self.problems(changed)))
        opaque = subprocess.run(['magick', '-size', '3x3', 'xc:white', 'PNG24:-'], check=True, capture_output=True).stdout
        import base64
        changed = self.append('<img alt="Opaque test" src="data:image/png;base64,' + base64.b64encode(opaque).decode() + '">')
        self.assertTrue(any('PNG with alpha' in p for p in self.problems(changed)))

    def test_slots(self):
        for token in ['{{GOAL}}', '[[GOAL]]', 'TODO']:
            self.assertTrue(any('unreplaced' in p for p in self.problems(self.append(f'<p>{token}</p>'))))

    def test_reading_grade(self):
        copy = ('Institutionalisation operationalises interdisciplinary conceptualisation. ' * 500)
        self.assertTrue(any('Flesch-Kincaid' in p for p in self.problems(self.append(f'<p>{copy}</p>'))))

    def test_company_validation_and_report_locks(self):
        for key in ['goal', 'team_json', 'logo']:
            company = copy.deepcopy(self.company)
            del company[key]
            with self.assertRaises(ValueError):
                validate(company)
        company = copy.deepcopy(self.company)
        company['report']['ai_rule'] = 'Changed rule'
        with self.assertRaises(ValueError):
            validate(company)

    def test_book_and_waffle(self):
        document = Document(self.html)
        pages = [n for n in document.nodes if 'pf-page' in n.attrs.get('class', '').split()]
        squares = [n for n in document.nodes if n.tag == 'i' and n.parent.attrs.get('class') == 'waffle']
        self.assertEqual(len(pages), 14)
        self.assertEqual(len(squares), 100)
        self.assertEqual(sum(n.attrs.get('class') == 'on' for n in squares), self.company['public_number']['value'])

    def test_people_projection(self):
        html = re.search(r'<section id="people".*?</section>', self.html, re.S).group()
        data = json.loads((PROJECT / self.company['team_json']).read_text())
        tech = sum(bool(p.get('tech')) for p in data['people'])
        self.assertIn(f'{tech} in {len(data["people"])}', html)
        self.assertEqual(len(re.findall(r'class="pm-p(?: pm-tech)?"', html)), len(data['people']))

    def test_people_never_shows_personal_details(self):
        with tempfile.TemporaryDirectory() as folder:
            data = json.loads((PROJECT / self.company['team_json']).read_text())
            data['people'][0].update(name='Ada Example', linkedin='https://www.linkedin.com/in/ada-example')
            (Path(folder) / 'team.json').write_text(json.dumps(data))
            page = components.Page({**self.company, 'team_json': 'team.json'}, self.claims, Path(folder), lambda path: '')
            html = components.people(page)
        self.assertNotIn('Ada Example', html)
        self.assertNotIn('linkedin.com', html)

    def test_story_alpha_and_border(self):
        for name in ['interviews', 'knowledge', 'workflows', 'processmap-43', 'opportunities', 'report']:
            path = SKILL / 'assets/art' / f'{name}.png'
            result = subprocess.run(['magick', str(path), '-alpha', 'extract', '-format',
                                     '%[fx:p{0,0}] %[fx:mean]', 'info:'], check=True, capture_output=True, text=True)
            border, mean = map(float, result.stdout.split())
            self.assertEqual(border, 0)
            self.assertGreater(mean, 0)
            self.assertLess(mean, 1)


if __name__ == '__main__':
    unittest.main()
