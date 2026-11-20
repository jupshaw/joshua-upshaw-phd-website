# Deployment and verification

## Local build and quality checks

1. Edit page definitions in `scripts/build.py` and page-specific content in `scripts/page_sections/`.
2. Run `python3 scripts/build.py` to regenerate `public/`.
3. Run `python3 scripts/check_site.py` to validate headings and internal links.
4. Preview with `python3 -m http.server 8000 --directory public`.
5. Confirm correct contact details, research metrics, publication statuses, mobile navigation, and accessibility.

## GitHub Pages

- Repository: [jupshaw/joshua-upshaw-phd-website](https://github.com/jupshaw/joshua-upshaw-phd-website)
- Branch: `main`
- Publishing source: **GitHub Actions**
- Workflow: `.github/workflows/deploy.yml`
- Build base path: `SITE_BASE_PATH: /`
- Custom domain: `joshuaupshawphd.com`

Every push to `main` triggers both validation and deployment. The deployed artifact is built directly from the source. The generated `public/` files are also version controlled for easy inspection.

## Domain and HTTPS

The domain is registered with GoDaddy, but the website is hosted on GitHub Pages.

Expected DNS records:

| Type | Host | Target |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | jupshaw.github.io |

Check that no conflicting apex A/AAAA or `www` records remain. Preserve the MX, SPF, DKIM, DMARC, and Microsoft 365 discovery records used for email.

GitHub provisions the HTTPS certificate automatically. Once the custom domain passes validation and the certificate is issued, enable **Enforce HTTPS** in repository Settings → Pages.

## Post-deployment checks

1. Open https://joshuaupshawphd.com and https://www.joshuaupshawphd.com.
2. Check every main navigation route, the 404 page, responsive menu, and external publications.
3. Verify that Contact uses `joshua@joshuaupshawphd.com` and its mailto link matches.
4. Confirm HTTPS loads without certificate warnings.
5. Inspect `sitemap.xml` and `robots.txt`; register in Search Console if desired.

For detailed content policy, see [evidence and content guidance](EVIDENCE_AND_CONTENT.md).
