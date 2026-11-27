# Publishing Research & Insights

The existing Python build generates the Insights library, topic pages, full HTML articles, RSS, and SEO metadata. No database or new hosting service is needed.

## Publish a paper

1. Write and review your paper locally. This is a **public GitHub repository**; do not commit confidential drafts, patient data, unpublished company IP, or documents without redistribution permission.
2. Create a directory such as `content/insights/healthcare-ai-evaluation/`. The directory name becomes the permanent URL slug.
3. Save the full text as `paper.md` and the metadata below as `metadata.json`. Add only approved, public PDF and image assets to the same directory.
4. Verify all claims, references, author attribution, coauthor permissions, publisher rights and privacy. Set publication dates to the actual dates, and only then set status to published and approved_for_publication to true.
5. Run `python3 scripts/build.py`, `python3 scripts/check_site.py`, and `python3 -m unittest discover -s scripts -p 'test_insights.py'`. Preview the generated site with `python3 -m http.server 8000 --directory public`.
6. Open a pull request. After review and deployment, check the actual page and sitemap in Google Search Console.

## Metadata example (not a published article)

```json
{
  "title": "Beyond Accuracy: Evaluating Healthcare AI",
  "description": "A practical framework for evaluating healthcare AI beyond predictive performance and assessing its real-world impact.",
  "abstract": "Replace this example with the reviewed executive summary.",
  "topic": "healthcare-ai",
  "type": "white-paper",
  "status": "draft",
  "approved_for_publication": false,
  "peer_reviewed": false,
  "published": "2026-11-26",
  "modified": "2026-11-26",
  "version": "1.0",
  "keywords": ["healthcare AI evaluation", "clinical AI validation"],
  "assets": ["paper.pdf", "cover.webp", "figure-1.png"],
  "pdf": "paper.pdf",
  "cover": "cover.webp",
  "cover_alt": "Describe the cover image",
  "related": [
    {"title": "Clinical AI research", "url": "/projects/clinical-ai/"},
    {"title": "Scientific publications", "url": "/research/"}
  ]
}
```

Available topics: healthcare-ai, cognitive-neuroscience, neurotechnology, product-innovation. Types: white-paper, perspective, technical-report, research-summary. Remove optional asset fields if not using them. The optional assets list defaults to empty. The PDF must be an authorized searchable publication; figures must use descriptive alt text. Only listed assets are copied.

## Authoring format

The dependency-free Markdown subset supports paragraphs, second through fourth level headings, ordered and unordered lists, bold, italic, inline code, HTTPS links, root-relative internal links, and local declared images. Do not repeat the article title as an H1 (the template adds it). Raw HTML is escaped. Complex tables, LaTeX, nested lists, and fenced code are not supported yet; render complex diagrams as accessible figures and provide explanatory text.

Example:

```markdown
## Introduction

Explain the problem, why it matters, and the evidence.

## Framework

- Define the outcome.
- Evaluate data quality.
- Document limitations.

![Descriptive figure alt text](figure-1.png)

## References

1. [Article DOI](https://doi.org/10.1371/journal.pone.0277220)
```

Every article has an author byline, executive summary, section navigation, visible non-peer-reviewed status, citation, related resources and optional PDF download. Peer-reviewed publications remain in Research. Topic pages are generated only after their first approved entry. Drafts are excluded from the deployed build, but not hidden from GitHub if committed.

## SEO and measurement

The build generates individual canonical URLs, Article JSON-LD, Open Graph dates and cover metadata, sitemap entries and RSS. The current consent-based analytics integration is unchanged. Use Google Search Console to verify indexing; configure PDF download and publication engagement events in the existing analytics setup if needed. Search ranking and Google Scholar inclusion are not guaranteed.

Changing a slug or topic after publishing changes the URL; preserve both or implement a redirect. Removing approval or setting status to draft removes previously generated Insights files on the next build. Previously indexed or archived content may persist externally.
