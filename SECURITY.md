# Security

## No secrets in this repository

Nothing here is a password, key, token or private address. Where the real project needs one, the
file holds a placeholder such as `CHANGE-ME-to-a-long-random-string`, `PASTE_THE_EXEC_URL_HERE`,
`G-XXXXXXXXXX` or `you@example.com`. Put your own values in your local copy only, never in a commit.

Every push and pull request is checked by [gitleaks](https://github.com/gitleaks/gitleaks)
(`.github/workflows/secret-scan.yml`). GitHub's own secret scanning and push protection are also on.

Files that must never be committed are listed in `.gitignore` (`.env`, `.wrangler/`, logs, build
output, `node_modules/`).

## Reporting a problem

If you find a security problem, please open a GitHub issue that says only "security issue, please
contact me", without the details, and I'll get in touch. Thank you.
