# ABOUTME: Proves the skill works for a provider other than Remote Humans: fills the blank profile template, builds both page types and publishes to a local site.
# ABOUTME: Run: python3 scripts/test_portability.py  (needs magick, git and curl; uses temp folders and never touches settings.json).
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
# Remote Humans names, plus offer terms that once were hard-coded and must now come from the profile.
LEAKS = re.compile(r"Elliott|Remote Humans|remotehumans|Callender|2 to 4 weeks|30-minute|London", re.I)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def fill_placeholder(match):
    """A plausible value for each [[...]] in the template, so the test checks the template's shape and nothing else."""
    text = match.group(1)
    lower = text.lower()
    if "currency code" in lower:
        return "GBP"
    if "price as shown" in lower:
        return "From £1,000"
    if "two-letter country" in lower:
        return "GB"
    if "folder inside your website repo" in lower:
        return "public/for"
    if "/for" in lower:
        return "{BASE_URL}"
    if "{id}" in text:
        return "https://sample.example/results/{id}"
    if "https://" in text:
        return "https://sample.example/"
    if "@" in text:
        return "sam@sample.example"
    if "full name" in lower or "speaking at" in lower:
        return "Sam Sample"
    if "first name" in lower:
        return "Sam"
    if "business" in lower and "name" in lower:
        return "Sample Studio"
    if "e.g. en-gb" in lower:
        return "en-GB"
    return "Plain words for the test"


class PortabilityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(cls.tmp / "site/public")))
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}/for"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        profile = cls.tmp / "sample-studio"
        shutil.copytree(SKILL / "profiles/_template", profile)
        for path in profile.rglob("*"):
            if path.suffix in {".json", ".md"}:
                text = re.sub(r"\[\[([^\]]{1,120})\]\]", fill_placeholder, path.read_text())
                path.write_text(text.replace("{BASE_URL}", cls.base_url))
        offers = json.loads((profile / "offers.json").read_text())
        offers["main-offer"]["base"]["amount"] = 1000
        (profile / "offers.json").write_text(json.dumps(offers))
        subprocess.run(["magick", "-size", "800x800", "xc:#4b5d74", str(profile / "photo.jpg")], check=True)
        settings = cls.tmp / "settings.json"
        settings.write_text(json.dumps({"profile": str(profile), "paths": {"site_repo": str(cls.tmp / "site")}, "tools": {"image": "none"}}))
        cls.env = {**os.environ, "MICROSITE_PROFILE": str(profile), "MICROSITE_SETTINGS": str(settings)}
        cls.profile = profile

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        shutil.rmtree(cls.tmp)

    def run_skill(self, *args):
        result = subprocess.run([*args], cwd=SKILL, env=self.env, capture_output=True, text=True, timeout=300)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def assert_clean(self, html):
        leaks = sorted(set(LEAKS.findall(re.sub(r'data:[^"\')]+', "", html))))
        self.assertEqual(leaks, [], "Remote Humans details leaked into another provider's page")
        self.assertIn("Sam Sample", html)

    def test_new_profile_after_copying_example_settings(self):
        """SETUP.md step 1c: copy settings.example.json (which names a profile that does not exist yet), then create it."""
        settings = self.tmp / "fresh-settings.json"
        shutil.copy(SKILL / "settings.example.json", settings)
        env = {k: v for k, v in self.env.items() if k != "MICROSITE_PROFILE"} | {"MICROSITE_SETTINGS": str(settings)}
        name = f"portability-check-{os.getpid()}"
        try:
            result = subprocess.run([sys.executable, "scripts/provider.py", "new", name], cwd=SKILL, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads(settings.read_text())["profile"], name)
            self.assertTrue((SKILL / "profiles" / name / "profile.json").exists())
        finally:
            shutil.rmtree(SKILL / "profiles" / name, ignore_errors=True)

    def test_doctor_passes(self):
        out = self.run_skill(sys.executable, "scripts/doctor.py")
        self.assertIn("Ready to build.", out)

    def test_offer_page_from_the_blank_template(self):
        """A new provider's first offer, straight from the filled-in template, builds a page for a sample prospect."""
        project = self.tmp / "offer-project"
        shutil.copytree(SKILL / "examples/sample-web-studio-page", project, ignore=shutil.ignore_patterns("build", "qa"))
        company = json.loads((project / "company.json").read_text())
        company["offer"] = "main-offer"
        (project / "company.json").write_text(json.dumps(company))
        self.run_skill(sys.executable, "page/build.py", str(project))
        html = (project / "build/hartley-roofing.html").read_text()
        self.assert_clean(html)
        self.assertIn("Prepared for Hartley Roofing | Sample Studio", html)
        self.assertIn("From £1,000", html)

    def test_job_page_from_neutral_starter(self):
        project = self.tmp / "job-project"
        (project / "images").mkdir(parents=True)
        subprocess.run(["magick", "-size", "200x80", "xc:#cc0000", str(project / "images/logo.png")], check=True)
        page = (SKILL / "templates/page.src.html").read_text()
        (project / "page.src.html").write_text(re.sub(r"\[\[(?!['\"\[])[^\]]{1,400}\]\]", "Example", page, flags=re.S))
        (project / "config.json").write_text(json.dumps({
            "out": "build/page.html", "logo": "images/logo.png", "images": {}, "proof": [],
            "sections": [{"file": "sections/things-built.html", "before": '<section><div class="wrap about">'}]}))
        self.run_skill(sys.executable, "scripts/build_page.py", str(project))
        html = (project / "build/page.html").read_text()
        self.assert_clean(html)
        self.assertIn(f'<meta property="og:url" content="{self.base_url}/Example">', html)

    def test_publish_and_unpublish(self):
        site = self.tmp / "site"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(self.tmp / "remote.git")], check=True)
        subprocess.run(["git", "clone", "-q", str(self.tmp / "remote.git"), str(site)], check=True, capture_output=True)
        (site / "public").mkdir()
        (site / "public/index.html").write_text("<title>Home</title>")
        for args in (["checkout", "-q", "-b", "main"], ["add", "."], ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init"], ["push", "-q", "origin", "main"]):
            subprocess.run(["git", "-C", str(site), *args], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(site), "config", "user.name", "t"], check=True)
        subprocess.run(["git", "-C", str(site), "config", "user.email", "t@t"], check=True)
        page = self.tmp / "page.html"
        page.write_text('<html><head><meta name="robots" content="noindex,nofollow"><title>Prepared for Test Co</title></head></html>')
        out = self.run_skill("bash", "scripts/deploy_private.sh", "test-co", str(page))
        self.assertIn(f"LIVE {self.base_url}/test-co", out)
        out = self.run_skill("bash", "scripts/unpublish_private.sh", "test-co")
        self.assertIn(f"REMOVED {self.base_url}/test-co", out)


if __name__ == "__main__":
    unittest.main()
