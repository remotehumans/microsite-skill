# ABOUTME: Tests scripts/campaign.py: creating campaigns, adding companies without duplicates, checking records stage by stage, and the demo workspace.
# ABOUTME: Run: python3 scripts/test_campaign.py  (uses temp workspaces through MICROSITE_WORKSPACE; never touches settings.json).
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
SCRIPT = SKILL / "scripts/campaign.py"


def run(workspace, *args, check=True):
    env = {**os.environ, "MICROSITE_WORKSPACE": str(workspace), "MICROSITE_PROFILE": "sample-studio"}
    result = subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True, env=env)
    if check and result.returncode:
        raise AssertionError(result.stdout + result.stderr)
    return result


class CampaignTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def rows(self, name):
        return json.loads((self.ws / name / "data/prospects.json").read_text())

    def test_new_creates_the_folders_the_gallery_reads(self):
        run(self.ws, "new", "uk-accountants", "--mode", "many", "--title", "UK accountants")
        campaign = json.loads((self.ws / "uk-accountants/data/campaign.json").read_text())
        self.assertEqual((campaign["name"], campaign["mode"]), ("UK accountants", "many"))
        self.assertIn("icp", campaign["brief"])
        self.assertEqual(self.rows("uk-accountants"), [])
        for folder in ("microsites", "gallery"):
            self.assertTrue((self.ws / "uk-accountants" / folder).is_dir())
        self.assertEqual(run(self.ws, "new", "uk-accountants", check=False).returncode, 1)

    def test_add_makes_a_company_folder_and_refuses_duplicates(self):
        run(self.ws, "new", "direct", "--mode", "one")
        out = run(self.ws, "add", "direct", "--name", "Ashby & Rowe", "--website", "https://www.ashbyrowe.example/about").stdout
        self.assertIn("ashby-rowe", out)
        row = self.rows("direct")[0]
        self.assertEqual((row["id"], row["domain_key"], row["stage"]), ("ashby-rowe", "ashbyrowe.example", "found"))
        for folder in ("research", "enrichment", "images", "design"):
            self.assertTrue((self.ws / "direct/microsites/ashby-rowe" / folder).is_dir())
        again = run(self.ws, "add", "direct", "--name", "Ashby and Rowe LLP", "--website", "http://ashbyrowe.example", check=False)
        self.assertEqual(again.returncode, 1)
        self.assertIn("already", again.stdout + again.stderr)
        self.assertEqual(len(self.rows("direct")), 1)

    def test_check_names_what_each_stage_still_needs(self):
        run(self.ws, "new", "direct", "--mode", "one")
        run(self.ws, "add", "direct", "--name", "Ashby & Rowe", "--website", "https://ashbyrowe.example")
        path = self.ws / "direct/data/prospects.json"
        rows = json.loads(path.read_text())
        rows[0]["stage"] = "qualified"
        path.write_text(json.dumps(rows))
        result = run(self.ws, "check", "direct", check=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("score_total", result.stdout)
        self.assertIn("financial_capacity", result.stdout)
        rows[0].update(score_total=10, score_out_of=12, decision="go", financial_capacity="£2.1m turnover (FY2025 accounts)",
                       why_now="Hiring an operations manager (job ad, 3 Oct 2026)", sources=["https://ashbyrowe.example"])
        path.write_text(json.dumps(rows))
        result = run(self.ws, "check", "direct")
        self.assertIn("qualified 1", result.stdout)

    def test_list_ranks_by_score(self):
        run(self.ws, "new", "many", "--mode", "many")
        for name, site in (("Low Co", "https://low.example"), ("High Co", "https://high.example")):
            run(self.ws, "add", "many", "--name", name, "--website", site)
        path = self.ws / "many/data/prospects.json"
        rows = json.loads(path.read_text())
        rows[0]["score_total"], rows[1]["score_total"] = 4, 11
        path.write_text(json.dumps(rows))
        lines = run(self.ws, "list", "many").stdout.splitlines()
        self.assertLess(next(i for i, l in enumerate(lines) if "High Co" in l), next(i for i, l in enumerate(lines) if "Low Co" in l))

    def test_demo_builds_a_sample_campaign_the_gallery_can_show(self):
        run(self.ws, "demo")
        rows = self.rows("sample-campaign")
        self.assertGreaterEqual(len(rows), 3)
        built = [r for r in rows if r.get("page")]
        self.assertTrue(built and (self.ws / "sample-campaign" / built[0]["page"]).exists())
        self.assertTrue((self.ws / "sample-campaign/gallery/outreach-cards.json").exists())


if __name__ == "__main__":
    unittest.main()
