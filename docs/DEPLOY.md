# Deploy

## 1. The site (Cloudflare Pages, free)

Needs Node.js LTS. In PowerShell, in the project folder:

```powershell
.\deploy.ps1 -DryRun     # checks everything, uploads nothing
.\deploy.ps1 -Create     # first time: creates the Pages project
.\deploy.ps1             # every time after
```

The first run opens a browser tab to sign in to Cloudflare (`npx wrangler login`); no token is
stored. For unattended runs, copy `.env.example` to `.env` and fill it in (`.env` is git-ignored).
Rename the project from `your-pages-project` in `deploy.ps1`.

`deploy.ps1` uploads an allow-list of files only, stamps a new `?v=` cache number into the uploaded
copies, and refuses to deploy if a secret file, your private email addresses or a byte-order mark
would be published.

## 2. Contact form

1. **Sheet log (Google Apps Script).** At script.google.com, new project, paste
   `backend/sheet-logger.gs`. Set `TOKEN` to a long random string and the `example.com` addresses to
   yours. Run `setup()` then `authorize()`. Deploy as a Web app (Execute as: Me, Access: Anyone) and
   copy the `/exec` URL.
2. **Worker (Cloudflare).** Create a Worker, paste `backend/contact-worker.js`, set `SHEET_ENDPOINT`
   to the `/exec` URL and `SHEET_TOKEN` to the same random string, deploy, and add the route
   `yourdomain/api/contact`.
3. Send a test message: it should appear in the inbox and as a row in the sheet.

Keep the real token and URL in your local copy only.
