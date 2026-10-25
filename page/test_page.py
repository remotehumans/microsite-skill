# ABOUTME: Tests the general page builder with two fictional businesses unlike Remote Humans: a web design studio and a recruitment agency.
# ABOUTME: Run: python3 page/test_page.py  (builds into temp folders; checks each page sells that business's own offer and nothing of the sprint).
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
SAMPLES = [("sample-web-studio", "sample-web-studio-page", "hartley-roofing"), ("sample-recruiter", "sample-recruiter-page", "calder-precision")]
SPRINT_WORDS = re.compile(r"AI Design Sprint|Ops Map|flip-book|PageFlip|Your report|Remote Humans|Elliott", re.I)


def build(profile, project):
    env = {**os.environ, "MICROSITE_PROFILE": profile}
    return subprocess.run([sys.executable, str(SKILL / "page/build.py"), str(project)], capture_output=True, text=True, env=env)


class PageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def copy(self, example):
        project = self.tmp / example
        shutil.copytree(SKILL / "examples" / example, project, ignore=shutil.ignore_patterns("build"))
        return project

    def test_each_business_gets_a_page_for_its_own_offer(self):
        for profile, example, slug in SAMPLES:
            with self.subTest(profile=profile):
                project = self.copy(example)
                result = build(profile, project)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                html = (project / "build" / f"{slug}.html").read_text()
                offers = json.loads((SKILL / "profiles" / profile / "offers.json").read_text())
                offer = offers[json.loads((project / "company.json").read_text())["offer"]]
                for text in (offer["deliverable"], offer["outcome"], offer["button"], *offer["includes"], *(s["title"] for s in offer["steps"])):
                    self.assertIn(text.replace("&", "&amp;"), html)
                self.assertEqual(SPRINT_WORDS.findall(re.sub(r'data:[^"\')]+', "", html)), [])
                self.assertIn('data-not-included="true"', html)

    def test_price_wording_without_a_fixed_price(self):
        project = self.copy("sample-recruiter-page")
        self.assertEqual(build("sample-recruiter", project).returncode, 0)
        self.assertIn("15% of first-year salary", (project / "build/calder-precision.html").read_text())

    def test_missing_offer_fields_stop_the_build(self):
        profile = self.tmp / "profile"
        shutil.copytree(SKILL / "profiles/sample-web-studio", profile)
        offers = json.loads((profile / "offers.json").read_text())
        del offers["website-rebuild"]["deliverable"]
        (profile / "offers.json").write_text(json.dumps(offers))
        result = build(str(profile), self.copy("sample-web-studio-page"))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('needs "deliverable"', result.stdout + result.stderr)

    def test_unknown_offer_is_named(self):
        project = self.copy("sample-web-studio-page")
        company = json.loads((project / "company.json").read_text())
        company["offer"] = "no-such-offer"
        (project / "company.json").write_text(json.dumps(company))
        result = build("sample-web-studio", project)
        self.assertIn('Offer "no-such-offer" is not in', result.stdout + result.stderr)

    def test_sprint_offers_still_use_the_sprint_page(self):
        project = self.copy("sample-sprint")
        result = build("sample-studio", project)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PageFlip", (project / "build/ashby-and-rowe.html").read_text())


if __name__ == "__main__":
    unittest.main()
