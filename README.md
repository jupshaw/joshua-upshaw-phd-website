# Joshua Upshaw, PhD | Professional Portfolio

Source for [joshuaupshawphd.com](https://joshuaupshawphd.com), an independent professional portfolio presenting cognitive neuroscience, clinical data science, healthcare AI research, and product leadership.

The site uses Python's standard library to generate static HTML, plus standard CSS and a small amount of JavaScript. It does not require Node.js, a site builder, or a client-side framework.

## Website sections

- **Home:** professional positioning, research highlights, and selected work
- **About:** background, career timeline, scientific values, and professional vision
- **Projects:** detailed healthcare AI, clinical modeling, neuroscience, and dissertation case studies
- **Research:** peer-reviewed publications, dissertation, and scholarly work
- **Resume:** experience, education, selected credentials, and printable overview
- **Expertise:** capabilities, evidence, and collaboration interests
- **Contact:** professional email, LinkedIn, GitHub portfolio, and Google Scholar

## Contact

**Joshua Upshaw, PhD**  
Email: [joshua@joshuaupshawphd.com](mailto:joshua@joshuaupshawphd.com)

## Build locally

Requires Python 3.10+.

```bash
python3 scripts/build.py
python3 scripts/check_site.py
python3 -m http.server 8000 --directory public
```

Visit http://localhost:8000 to preview the site.

The generated pages are stored in `public/`. Edit source material in `scripts/build.py` and the page-specific templates in `scripts/page_sections/`, then rebuild and validate. Keep generated files in sync with the source when committing revisions.

## Design system

The website uses a midnight navy, cyan-blue, and violet palette, Playfair Display display headings, Inter body text, high-contrast project and research cards, and responsive page layouts. Decorative visuals are CSS-based or inline SVG. No personal portrait image is bundled.

## GitHub Pages deployment

GitHub Actions automatically validates and publishes commits to `main` using:

- `.github/workflows/ci.yml`: website build and link checks
- `.github/workflows/deploy.yml`: builds `public/` and deploys to GitHub Pages

The publishing workflow sets `SITE_BASE_PATH: /`, appropriate for the root of the custom domain. The custom domain is configured in **Settings → Pages**, and DNS is managed independently at GoDaddy.

**Website:** https://joshuaupshawphd.com  
**Deployment settings:** https://github.com/jupshaw/joshua-upshaw-phd-website/settings/pages

Expected website DNS records:

| Type | Host | Target |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | jupshaw.github.io |

Do not change mail-related MX, SPF, DKIM, DMARC, or domain verification records when maintaining website DNS. GitHub manages the website HTTPS certificate. See [deployment guidance](docs/DEPLOYMENT.md).

## Research integrity and privacy

- Retrospective research metrics are identified as retrospective results.
- Modeled or simulated outcomes are not described as realized clinical improvements.
- No patient data, confidential research exports, or proprietary private company code is included.
- Scientific publications link to authoritative external sources.
- The Resume page is an online summary; any standalone downloadable resume should be reviewed before publication.

## Repository structure

- `scripts/build.py`: page definitions, shared templates, and asset generation
- `scripts/page_sections/`: individual content sections and responsive styling for five inner pages
- `scripts/check_site.py`: HTML/link smoke tests
- `public/`: generated static website
- `docs/`: operational and content notes
- `.github/workflows/`: validation and deployment

View the site at [joshuaupshawphd.com](https://joshuaupshawphd.com).
