"""Regression tests for the Insights publication pipeline."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from xml.etree import ElementTree as ET
import json

from publish_insights import register_insights, load_entries, article_schema, markdown

SITE = "https://joshuaupshawphd.com"

class InsightsTests(TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.out = self.root / "public"
        self.folder = self.root / "content" / "insights" / "sample-paper"
        self.folder.mkdir(parents=True)
        self.meta = dict(title="Sample paper", description="A sufficiently descriptive test publication for the website.",
                         abstract="A synthetic fixture.", topic="healthcare-ai", type="white-paper",
                         status="published", approved_for_publication=True, peer_reviewed=False,
                         published="2025-01-01", version="1.0", assets=["paper.pdf"],
                         pdf="paper.pdf", keywords=["validation"])
        (self.folder / "paper.md").write_text("## Evidence\n\n**Results** and [source](https://example.org).\n\n## Evidence\n\n- Item\n", encoding="utf-8")
        (self.folder / "paper.pdf").write_bytes(b"%PDF-1.4 test fixture")
    def save(self):
        (self.folder / "metadata.json").write_text(json.dumps(self.meta), encoding="utf-8")
    def build(self):
        self.save()
        pages = {"/": {"content": "Home"}, "/research/": {"content": "Research"}}
        register_insights(self.root, self.out, SITE, pages)
        return pages
    def test_published_and_then_withdrawn(self):
        pages = self.build()
        route = "/insights/healthcare-ai/sample-paper/"
        self.assertIn(route, pages)
        self.assertIn("/insights/healthcare-ai/", pages)
        self.assertIn(route, pages["/"]["content"])
        self.assertIn("Not peer reviewed", pages[route]["content"])
        self.assertIn('id="section-evidence-2"', pages[route]["content"])
        self.assertIn('href="#section-evidence"', pages[route]["content"])
        self.assertIn('href="paper.pdf"', pages[route]["content"])
        self.assertTrue((self.out / route.strip("/") / "paper.pdf").is_file())
        self.assertEqual(article_schema(pages[route]["article"], SITE)["encoding"]["contentUrl"], SITE + route + "paper.pdf")
        feed = ET.parse(self.out / "insights/feed.xml")
        self.assertEqual(feed.findtext("./channel/item/link"), SITE + route)
        self.meta["status"] = "draft"
        pages = self.build()
        self.assertNotIn(route, pages)
        self.assertNotIn("/insights/healthcare-ai/", pages)
        self.assertFalse((self.out / route.strip("/")).exists())
        self.assertIsNone(ET.parse(self.out / "insights/feed.xml").find("./channel/item"))
    def test_approval_required(self):
        self.meta["approved_for_publication"] = False
        self.save()
        with self.assertRaises(ValueError):
            load_entries(self.root)
    def test_missing_asset_rejected(self):
        (self.folder / "paper.pdf").unlink()
        self.save()
        with self.assertRaises(ValueError):
            load_entries(self.root)
    def test_raw_html_and_unsafe_links(self):
        result, _ = markdown("<script>alert(1)</script>", [])
        self.assertIn("&lt;script&gt;", result)
        with self.assertRaises(ValueError):
            markdown("[Unsafe](javascript:alert(1))", [])
        with self.assertRaises(ValueError):
            markdown("![Unknown](unapproved.png)", [])
    def test_peer_review_status_required(self):
        self.meta["peer_reviewed"] = True
        self.save()
        with self.assertRaises(ValueError):
            load_entries(self.root)

if __name__ == "__main__":
    main()
