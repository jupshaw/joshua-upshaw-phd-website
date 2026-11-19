# Deployment checklist

1. Review the browser preview at `http://localhost:8000/`.
2. Review contact details and publication statuses, and optionally add a current resume PDF.
3. Confirm the GitHub remote is under `jupshaw/joshua-upshaw-phd-website`.
4. Enable the workflow and complete a manual Pages deployment; no DNS edits required for a temporary GitHub Pages URL.
5. For the normal `https://jupshaw.github.io/joshua-upshaw-phd-website/` Pages URL, set `SITE_BASE_PATH` to `/joshua-upshaw-phd-website` in the workflow (already set by default there).
6. For a custom-domain deployment, set `SITE_BASE_PATH` to an empty string, and configure your host plus a `CNAME` if using GitHub Pages.
7. Point DNS at the selected host **only when ready**. Check existing MX, SPF, DKIM, and DMARC records before changing DNS.
8. After deployment, verify all routes, 404, HTTPS, mobile menu, source links, and any resume PDF.
9. Register the site with Google Search Console and submit `/sitemap.xml` once live.
10. Retain an offline copy of the GoDaddy Airo ZIP and separate backups of any associated databases or uploaded assets.

The site's generated `public/sitemap.xml` currently references the intended custom domain for eventual launch. When using a project-specific GitHub Pages URL as a temporary preview, don't submit that sitemap for indexing.
