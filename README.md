# Data analyst website

The source of [john.goliash.com](https://john.goliash.com): a one-person portfolio site for data,
reporting and inventory work, hand-written in HTML, CSS and JavaScript (no framework, no build step)
and hosted free on Cloudflare Pages.

> **The résumé here is an example.** Its employers, towns, school and PDF are fictional. Contact
> details, analytics IDs and server secrets are placeholders. See [SECURITY.md](SECURITY.md).

## What's in it

| Page / feature | Files |
|---|---|
| Home page: hero "count sheet" demo, interview story, résumé, projects carousel, contact form | `index.html`, `js/main.js`, `css/style.css` |
| **KPI Lab**: 14 inventory and operations measures with menus, save, CSV export, print | `js/kpi-lab.js`, `css/kpi-lab.css` ([own project](https://github.com/goliash/kpi-lab)) |
| KPI Lab you can install on a phone or computer (works offline) | `kpi-lab.html`, `kpi-lab.webmanifest`, `kpi-sw.js` |
| **Animal Crossing villager data reports** | `Animal-Crossing-Villager-Data-Reports.html`, `js/analyst.js` ([own project](https://github.com/goliash/animal-crossing-villager-data-reports)) |
| Plain-English dictionary with word bubbles | in `index.html` and `js/main.js` |
| Privacy and settings (motion, analytics switch), unsubscribe, 404 | `disclosure.html`, `unsubscribe.html`, `404.html` |
| Contact form back end: Cloudflare Worker + Google Apps Script sheet log | `backend/contact-worker.js`, `backend/sheet-logger.gs` |
| Security headers, redirects, search and AI-crawler files | `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, `llms.txt` |

## Run it locally

Any static server works:

```bash
python -m http.server 8000      # then open http://localhost:8000
```

The contact form needs the Worker (below); everything else runs as is.

## Make it yours

1. Replace the example résumé text in `index.html` and put your PDF at `files/Example_Resume.pdf`
   (or rename it everywhere). Rebuild the print copy:
   `pdftocairo -svg files/Example_Resume.pdf files/resume-print.svg`.
2. Swap `G-XXXXXXXXXX` / `GTM-XXXXXXX` for your Google Analytics and Tag Manager IDs, or delete
   that block from each page's `<head>`.
3. Contact form: see [docs/DEPLOY.md](docs/DEPLOY.md).
4. After changing KPI Lab in `index.html`, run `python tools/build-kpi-app.py` to rebuild
   `kpi-lab.html`.
5. Optional: `python tools/get-villager-pictures.py` downloads the villager pictures (game art, not
   stored here). Without them each villager shows its initial.

## Deploy

[docs/DEPLOY.md](docs/DEPLOY.md): Cloudflare Pages with `deploy.ps1` (Windows PowerShell), the
contact Worker and the Apps Script sheet. Cost: $0.

## License

The code is [MIT](LICENSE). Not covered: the site's personal text and branding, the logos of other
businesses, Nintendo's Animal Crossing names and art, and third-party data (credited where used).
