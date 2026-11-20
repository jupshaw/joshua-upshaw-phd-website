# Joshua Upshaw, PhD, Website

Independent, deployable professional portfolio for **joshuaupshawphd.com**, with navy, blue, and violet branding. Built using Python's standard library for static-page generation, and plain CSS/JavaScript for the browser. No npm packages, subscriptions, cookies, or client-side trackers are required.

> **Important:** This repository is a working independent website implementation based on our discussed design, **not a byte-for-byte backup of the GoDaddy Airo website**. For an exact original-code backup, export your Airo project from GoDaddy, then use the importer below. The importer does not auto-commit the export.

## Design reference (November 2026)

The current independent implementation incorporates the visual direction from a user-provided **unpublished GoDaddy Airo HTML preview**: deep midnight navy backgrounds, cyan/blue and violet accents, elegant Playfair Display headings, Inter body typography, a framed visual hero, and dark bordered research/project cards. It does **not** depend on the Airo runtime or its analytics scripts. The reference's invented biomedical projects/publications were excluded in favor of documented research evidence.

The generated pages and stylesheet are tracked in `public/`. Edit `scripts/build.py`, run the build and tests, and commit generated output alongside the generator. The hero uses a stylized monogram rather than the Airo preview's external headshot URL, because the downloaded HTML did not include that image asset.

## Pages

- Home and professional introduction
- About, scientific background, leadership perspective, and professional purpose
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

## GitHub repository and deployment

Source lives at [jupshaw/joshua-upshaw-phd-website](https://github.com/jupshaw/joshua-upshaw-phd-website). GitHub Actions builds and deploys changes to `main` to the temporary GitHub Pages URL when Pages is enabled: [jupshaw.github.io/joshua-upshaw-phd-website](https://jupshaw.github.io/joshua-upshaw-phd-website/). This preview does not alter GoDaddy DNS.

## Deploy independently of GoDaddy

### Vercel / Netlify
Build command: `python3 scripts/build.py`; output directory: `public`; no Node dependencies. If your host requires explicit Python availability, use a GitHub Actions build and deploy the generated static folder.

### GitHub Pages and the GoDaddy custom domain

The GitHub Actions workflow `.github/workflows/deploy.yml` builds and deploys `public/` after every push to `main`, or when manually run. In repository **Settings → Pages**, select **GitHub Actions** as the source.

The deployment defaults to the preview base path `/joshua-upshaw-phd-website`. When moving to `joshuaupshawphd.com`, go to **Settings → Secrets and variables → Actions → Variables**, add repository variable `SITE_BASE_PATH` with the value `/`, and manually trigger **Actions → Deploy static site to GitHub Pages → Run workflow**. This rebuilds all links and asset paths for the custom-domain root. Removing the variable restores the default project preview path.

Set `joshuaupshawphd.com` as the **Custom domain** under repository **Settings → Pages**. Because this website uses a GitHub Actions publishing workflow, GitHub stores the custom domain in Pages settings; a `CNAME` file is not required or used for domain configuration.

At GoDaddy, edit the domain DNS zone:

| Type | Host | Target |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | jupshaw.github.io |

Replace conflicting prior website records, but do not change MX, SPF, DKIM, DMARC, domain verification, or other unrelated DNS records. After propagation, turn on **Enforce HTTPS** in the Pages settings. Optional, recommended: verify the domain first using the GitHub profile-level **Settings → Pages** TXT challenge. Keep the TXT record after verification.

Official documentation: [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site); [GitHub Pages domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages); [GoDaddy A records](https://www.godaddy.com/help/add-an-a-record-19238).

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
