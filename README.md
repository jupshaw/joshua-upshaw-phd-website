# Joshua Upshaw, PhD, Website

Independent, deployable professional portfolio for **joshuaupshawphd.com**, with navy, blue, and violet branding. Built using Python's standard library for static-page generation, and plain CSS/JavaScript for the browser. No npm packages, subscriptions, cookies, or client-side trackers are required.

> **Important:** This repository is a working independent website implementation based on our discussed design, **not a byte-for-byte backup of the GoDaddy Airo website**. For an exact original-code backup, export your Airo project from GoDaddy, then use the importer below. The importer does not auto-commit the export.

## Pages

- Home and professional introduction
- Projects with detailed case studies for Hidalga product leadership, clinical AI, and neuroscience
- Research and peer-reviewed publications
- Professional experience and resume overview
- Expertise and collaboration
- Contact links

## Build and preview

Requirements: Python 3.10+.

```bash
python3 scripts/build.py
python3 scripts/check_site.py
python3 -m http.server 8000 --directory public
```

Then open http://localhost:8000/. The website includes responsive navigation, a 404 page, sitemap, robots file, accessible markup, and social metadata.

To edit content, modify the corresponding entry in `scripts/build.py`. After changes, rebuild and test. Deployment serves `public/`, not the Python files.

## Backup the original GoDaddy Airo app

1. In GoDaddy Airo AI Builder, open the website and select **Settings**.
2. Under **Download Project**, select **Download** and save the ZIP.
3. Keep an untouched copy of that ZIP offline or in secure storage.
4. Review and unpack locally:

```bash
python3 scripts/import_airo_export.py ~/Downloads/your-airo-export.zip
cat AIRO_IMPORT_REVIEW.txt
```

The importer extracts to `airo-export/` (ignored by Git until you have reviewed it). It rejects unsafe ZIP paths and obvious symlinks, limits file size, and flags potential secrets. The import is **not** guaranteed to be an exhaustive secret scanner. Only after careful review should you remove the `airo-export/` ignore rule and commit approved project files. An actual GoDaddy backup may require a runtime, database, secrets, or platform configuration not included in the ZIP. Read GoDaddy's project documentation.

Documentation: [GoDaddy project export](https://www.godaddy.com/help/download-my-airo-ai-builder-files-and-code-42993).

## GitHub repository creation and push

This project has an initial **local Git commit**. A remote repository must be created in the connected GitHub account before pushing, because `jupshaw/joshua-upshaw-phd-website` did not exist at preparation time.

1. On GitHub, create a repository named `joshua-upshaw-phd-website` (without initializing a README, license, or .gitignore).
2. From the project folder, run:

```bash
git remote add origin https://github.com/jupshaw/joshua-upshaw-phd-website.git
git branch -M main
git push -u origin main
```

Or restore the included local commit using the separately downloadable `.bundle` file.

## Deploy independently of GoDaddy

### Vercel / Netlify
Build command: `python3 scripts/build.py`; output directory: `public`; no Node dependencies. If your host requires explicit Python availability, use a GitHub Actions build and deploy the generated static folder.

### GitHub Pages
The `.github/workflows/deploy.yml` workflow builds and uploads `public/` on manual workflow dispatch, with optional `SITE_BASE_PATH` support for the default GitHub Pages repo URL. In GitHub repository settings, enable Pages with GitHub Actions as the source. The deployment workflow does **not** alter GoDaddy DNS automatically.

### GoDaddy domain
Do **not** change DNS until you choose the public host and are ready to switch traffic from Airo. Then follow your host's exact A/CNAME instructions, preserving unrelated MX/TXT records for email and verification.

## Claims and privacy

- Research metrics are labeled as retrospective results.
- Modeled workflow improvements are not presented as realized outcomes.
- No private patient data, original research datasets, unpublished source code, or proprietary Hidalga documentation is included.
- No resume PDF is published yet. Review contact information and choose the version before uploading.
- Links to public research and articles are used rather than uploading copyrighted journal PDFs.
- The site currently uses a public professional contact address from supplied resume materials. Confirm it before deployment.

## Project files

- `scripts/build.py`: content, templates, and style-generation
- `scripts/check_site.py`: internal-link and heading smoke tests
- `scripts/import_airo_export.py`: safe ZIP extraction and review report
- `public/`: deployable static site
- `.github/workflows/`: CI and manual deployment
- `docs/`: launch and content guidance

**Content review is required before a public launch**. Publication statuses, domain routing, and hiring positioning may change over time.
