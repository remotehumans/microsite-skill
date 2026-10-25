# ABOUTME: Tests the optional design layer (top bar, photo hero, photo cards, motion, project theme) and the fidelity scorer.
# ABOUTME: Builds a copy of the fictional sample example with a design block in a temp folder; the example stays untouched.
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

os.environ['MICROSITE_PROFILE'] = 'sample-studio'
from build_sprint import build, validate
import provider
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import fidelity

SKILL = Path(__file__).resolve().parents[1]
EXAMPLE = SKILL / 'examples/sample-sprint'
DESIGN = {'header': {'topbar': [{'text': 'Open every day', 'kind': 'text'}, {'text': 'Call us', 'href': 'tel:+440000', 'kind': 'button'}],
                     'phone_menu': True},
          'hero': {'layout': 'photo', 'frame': True, 'accent': 'second-line', 'secondary': {'text': 'See the report', 'href': '#report'},
                   'tagline': 'Every step of the way'},
          'motion': {'reveal': 'fade-up', 'duration': 0.3, 'easing': 'ease-in-out', 'smooth_scroll': True}}


class DesignLayerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        project = cls.tmp / 'project'
        shutil.copytree(EXAMPLE, project, ignore=shutil.ignore_patterns('build', 'qa'))
        company = json.loads((project / 'company.json').read_text())
        company['design'] = DESIGN
        company['look_at_first'][0]['image'] = {'path': company['hero']['path'], 'alt': 'Their office'}
        (project / 'company.json').write_text(json.dumps(company))
        (project / 'theme.css').write_text('.refresh .rf-topbar{letter-spacing:.01em}')
        cls.company = company
        with contextlib.redirect_stdout(io.StringIO()):
            cls.html = build(project).read_text()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_structure_from_design(self):
        self.assertIn('<div class="rf-topbar">', self.html)
        self.assertIn('<a class="rf-top-button" href="tel:+440000">Call us</a>', self.html)
        self.assertIn('class="rf-menu"', self.html)
        self.assertIn('rf-hero-photo', self.html)
        self.assertIn('rf-hero-box rf-framed', self.html)
        self.assertIn('<span class="rf-accent">', self.html)
        self.assertIn('rf-button-alt', self.html)
        self.assertIn('rf-hero-tagline', self.html)
        self.assertIn('rf-card rf-card-photo', self.html)

    def test_motion_and_theme_are_loaded(self):
        self.assertIn('data-reveal="fade-up"', self.html)
        self.assertIn('data-smooth="true"', self.html)
        self.assertIn('--motion-duration:0.3s', self.html)
        self.assertIn('beforeprint', self.html)
        self.assertIn('.refresh .rf-topbar{letter-spacing:.01em}', self.html)

    def test_proof_and_about_take_company_colours(self):
        self.assertIn('.refresh #proof,.refresh #about{--paper:var(--soft);--ink:var(--deep);--orange:var(--teal)', self.html)

    def test_proof_art_can_be_dropped(self):
        project = self.tmp / 'project'
        company = json.loads((project / 'company.json').read_text())
        self.assertIn('class="byob-art"', self.html)
        company['design']['proof_art'] = False
        (project / 'company.json').write_text(json.dumps(company))
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                html = build(project).read_text()
        finally:
            (project / 'company.json').write_text(json.dumps(self.company))
        self.assertNotIn('class="byob-art"', html)
        self.assertIn(f'data-proof="{provider.claims()["proof_tiles"][0]["id"]}"', html)

    def test_default_pages_have_no_design_layer(self):
        default = (EXAMPLE / 'build/ashby-and-rowe.html')
        if not default.exists():
            with contextlib.redirect_stdout(io.StringIO()):
                build(EXAMPLE)
        html = default.read_text()
        for marker in ('rf-topbar', 'data-reveal', 'rf-hero-photo', 'beforeprint'):
            self.assertNotIn(marker, html)

    def test_unknown_design_parts_are_refused(self):
        company = copy.deepcopy(self.company)
        company['design']['layout_magic'] = {}
        with self.assertRaises(ValueError):
            validate(company)
        company = copy.deepcopy(self.company)
        company['design']['hero']['layout'] = 'carousel'
        with self.assertRaises(ValueError):
            validate(company)


class FidelityTests(unittest.TestCase):
    PROBE = {'type': {'display': {'family': 'Playfair Display', 'align': 'center', 'accent': '#bb9d5d'}, 'body': {'family': 'Nunito'},
                      'h2': {'color': '#bb9d5d'}},
             'palette': [{'color': '#010003', 'share': 0.5}, {'color': '#f7f4eb', 'share': 0.3}],
             'button_shape': 'pill', 'buttons': [{'bg': '#bb9d5d'}],
             'header': {'layers': 2, 'bars': [{'bg': '#f7f4eb'}, {'bg': '#010003'}]},
             'hero': {'photo': True, 'full_bleed': True, 'overlay': True, 'framed': True, 'text_color': '#ffffff'},
             'card': {'image': True, 'radius': 'square', 'shadow': True},
             'motion': {'transitions': 80, 'median_duration': 0.3, 'smooth_scroll': True, 'reveal_on_scroll': True}}

    def score(self, ours, font_map=None):
        checks = fidelity.compare(self.PROBE, ours, font_map or {})
        return round(100 * sum(w for _, w, ok, _ in checks if ok) / sum(w for _, w, _, _ in checks))

    def test_identical_design_scores_full_marks(self):
        self.assertEqual(self.score(self.PROBE), 100)

    def test_template_look_scores_low(self):
        ours = copy.deepcopy(self.PROBE)
        ours['type'] = {'display': {'family': 'Libre Baskerville', 'align': 'start'}, 'body': {'family': 'Source Sans 3'}, 'h2': {'color': '#21162c'}}
        ours['palette'] = [{'color': '#ffffff', 'share': 0.6}]
        ours['button_shape'] = 'round'
        ours['header'] = {'layers': 1, 'bars': [{'bg': '#0c0417'}]}
        ours['hero'] = {'photo': False, 'full_bleed': False, 'overlay': False, 'framed': False, 'text_color': '#21162c'}
        self.assertLess(self.score(ours), 40)

    def test_hero_framing_and_darkness(self):
        theirs = copy.deepcopy(self.PROBE); theirs['hero']['shown_ratio'] = 2.0; theirs['brightness'] = 0.18
        ours = copy.deepcopy(self.PROBE); ours['hero']['shown_ratio'] = 1.2; ours['brightness'] = 0.3
        checks = {name: ok for name, _, ok, _ in fidelity.compare(theirs, ours, {})}
        self.assertFalse(checks['Hero framing'])
        self.assertFalse(checks['Hero darkness'])
        ours['hero']['shown_ratio'] = 1.9; ours['brightness'] = 0.2
        checks = {name: ok for name, _, ok, _ in fidelity.compare(theirs, ours, {})}
        self.assertTrue(checks['Hero framing'] and checks['Hero darkness'])

    def test_font_lookalike_counts(self):
        theirs_licensed = copy.deepcopy(self.PROBE)
        theirs_licensed['type']['display']['family'] = 'Gotham'
        checks = fidelity.compare(theirs_licensed, self.PROBE, {'Gotham': 'Playfair Display'})
        self.assertTrue(next(ok for name, _, ok, _ in checks if name == 'Display font'))


if __name__ == '__main__':
    unittest.main()
