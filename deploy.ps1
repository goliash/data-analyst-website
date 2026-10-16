<#
    john.goliash.com - deploy to Cloudflare Pages   (Windows / PowerShell 5.1 or 7)

    Usage:   .\deploy.ps1              stage, check, upload
             .\deploy.ps1 -DryRun      stage and check only; nothing uploaded
             .\deploy.ps1 -Create      create the Pages project first (one time)

    Needs: Node.js LTS (for npx wrangler). Sign-in: the first run opens a
    browser tab to log in to Cloudflare - no token or .env needed (a .env with
    an API token still works, see .env.example). Cost: $0 - Cloudflare Pages
    free plan, wrangler is free.

    Adapted from mixyz.xyz\deploy.ps1, itself adapted from
    OliUni-working\deploy.ps1. The rules it learned are kept:
      * an ALLOW-LIST is copied to a staging folder; nothing is excluded by
        hoping - so .env, the Worker source and these docs can never ship
      * the ?v= cache number is stamped into the STAGED copies only; your
        source files are never rewritten
      * all file IO is .NET UTF-8 without a BOM. PowerShell 5.1's
        Get-Content / Set-Content turn an em dash into mojibake and add a BOM
      * the counter only advances after wrangler exits 0
      * wrangler's own words are kept in deploy-last.log and reprinted on failure
#>

param(
    [switch]$DryRun,
    [switch]$Create
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$Utf8 = New-Object System.Text.UTF8Encoding($false)   # $false = no BOM
function Read-Text  ($p)     { [System.IO.File]::ReadAllText($p, $Utf8) }
function Write-Text ($p, $t) { [System.IO.File]::WriteAllText($p, $t, $Utf8) }

# ---------------------------------------------------------------- credentials
# Two ways to sign in to Cloudflare, both free:
#   1. NO .env (simplest). The script runs "npx wrangler login" the first time:
#      a browser tab asks you to allow wrangler on your Cloudflare account, and
#      wrangler remembers it on this PC. Nothing secret is stored in this folder.
#   2. A .env with an API token, for unattended runs - see .env.example.
$env:PAGES_PROJECT = 'your-pages-project'
$EnvFile  = Join-Path $Root '.env'
$UseToken = Test-Path $EnvFile

# Resolve npx to a real program, never to npm's npx.ps1. In PowerShell on
# Windows, plain "npx" runs npx.ps1, which re-reads the SOURCE TEXT of the line
# that called it instead of taking its arguments: anything passed as @args
# vanishes, wrangler receives no command, prints its help, and exits 0 - which
# looked like a successful deploy on the first real run (12 Oct 2026).
# npx.cmd passes arguments through normally.
$Npx = Get-Command npx.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $Npx) { $Npx = Get-Command npx -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 }

function Invoke-Wrangler {
    # wrangler writes progress to stderr. In Windows PowerShell 5.1, 2>&1 turns
    # each stderr line into an error record, and with ErrorActionPreference =
    # Stop the first one would end the script. Relax it for this call only.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & $Npx.Source --yes wrangler @args 2>&1 | ForEach-Object { Write-Host $_; "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    $text = ($out -join "`n")
    # Exit code 0 is not proof: wrangler with no command prints help and exits 0.
    if ($text -match '(?m)^\s*COMMANDS\s*$' -and $text -match 'GLOBAL FLAGS') {
        throw "wrangler printed its help instead of running 'wrangler $($args -join ' ')'. The command did not reach it. Nothing was deployed."
    }
    return @{ Code = $code; Text = $text; Output = @($out) }
}

if (-not $DryRun) {
    if (-not $Npx) {
        throw "npx was not found. Install Node.js LTS (free) from https://nodejs.org, open a NEW PowerShell window, and run this again."
    }

    # A .env is optional. It may hold just CLOUDFLARE_ACCOUNT_ID (needed only if
    # your login can see more than one Cloudflare account), or an account ID plus
    # an API token for runs where nobody is there to click Allow.
    if ($UseToken) {
        foreach ($line in [System.IO.File]::ReadAllLines($EnvFile, $Utf8)) {
            if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') {
                $value = $Matches[2].Trim().Trim('"').Trim("'")
                if ($value) { Set-Item -Path ("Env:" + $Matches[1]) -Value $value }
            }
        }
        if ($env:CLOUDFLARE_ACCOUNT_ID -and $env:CLOUDFLARE_ACCOUNT_ID -notmatch '^[0-9a-f]{32}$') {
            throw "CLOUDFLARE_ACCOUNT_ID in .env must be 32 hex characters. Got $($env:CLOUDFLARE_ACCOUNT_ID.Length) characters."
        }
        if ($env:CLOUDFLARE_API_TOKEN -and -not $env:CLOUDFLARE_ACCOUNT_ID) {
            throw "A .env with CLOUDFLARE_API_TOKEN also needs CLOUDFLARE_ACCOUNT_ID."
        }
    }

    if ($env:CLOUDFLARE_API_TOKEN) {
        Write-Host "Signing in with the API token from .env" -ForegroundColor DarkGray
    } else {
        Write-Host "Using your own Cloudflare login through wrangler (no token needed)." -ForegroundColor DarkGray
        $who = Invoke-Wrangler whoami
        if ($who.Text -notmatch 'You are logged in') {
            Write-Host "`nNot signed in yet. A browser tab will open - sign in to Cloudflare and click Allow." -ForegroundColor Yellow
            Invoke-Wrangler login | Out-Null
            $who = Invoke-Wrangler whoami
            if ($who.Text -notmatch 'You are logged in') {
                throw "Still not signed in to Cloudflare. Run  npx.cmd wrangler login  by itself, then run this script again."
            }
        }
        Write-Host "Signed in to Cloudflare." -ForegroundColor DarkGray
    }
}

# ------------------------------------------------------- build a clean staging
$Stage = Join-Path $env:TEMP ("jg-deploy-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

# The allow-list. Anything not named here does not ship.
$Files = @('index.html', 'disclosure.html', '404.html', 'Animal-Crossing-Villager-Data-Reports.html', 'unsubscribe.html',
           'kpi-lab.html', 'kpi-lab.webmanifest', 'kpi-sw.js',
           '_headers', '_redirects', 'robots.txt', 'llms.txt', 'sitemap.xml', 'site.webmanifest')
$Dirs  = @('css', 'js', 'img', 'files')

foreach ($f in $Files) {
    $p = Join-Path $Root $f
    if (Test-Path $p) { Copy-Item $p -Destination $Stage }
    else { throw "Missing $f - refusing to deploy an incomplete site." }
}
foreach ($d in $Dirs) {
    $p = Join-Path $Root $d
    if (Test-Path $p) { Copy-Item $p -Destination (Join-Path $Stage $d) -Recurse }
    else { throw "Missing folder $d\ - refusing to deploy." }
}
# The Download button's copy of the resume: the same PDF, sent as a download (see _headers), so an
# iPhone saves it to Files instead of only opening it. Made here so it can never be out of date.
$dlDir = Join-Path (Join-Path $Stage 'files') 'download'
New-Item -ItemType Directory -Force -Path $dlDir | Out-Null
Copy-Item (Join-Path (Join-Path $Root 'files') 'Example_Resume.pdf') -Destination $dlDir -Force

# ------------------------------------------------- stamp the cache version
# /css/* /js/* /img/* are cached for a week (_headers). Without a new ?v= a
# correct fix looks like a failure for up to seven days. Every ?v= on every
# page gets the SAME number, so style.css and main.js can never drift apart
# (the wint.win desync bug). ?i= on icons is left alone: bump it by hand only
# when the artwork changes.
$VerFile = Join-Path $Root '.deploy-version'
$version = 0
if (Test-Path $VerFile) { [int]::TryParse((Read-Text $VerFile).Trim(), [ref]$version) | Out-Null }
if ($version -le 0) {
    $m = [regex]::Match((Read-Text (Join-Path $Root 'index.html')), 'style\.css\?v=(\d+)')
    $version = if ($m.Success) { [int]$m.Groups[1].Value } else { 0 }
}
$version = $version + 1

Get-ChildItem $Stage -Filter *.html -Recurse | ForEach-Object {
    $t = Read-Text $_.FullName
    Write-Text $_.FullName ([regex]::Replace($t, '\?v=\d+', "?v=$version"))
}
Write-Host "Cache version: v$version" -ForegroundColor Cyan

# ------------------------------------------------------------------- gates
# 1. Encoding: the em dash in the <title> must survive, no BOM, no mojibake.
$probe = Read-Text (Join-Path $Stage 'index.html')
if ($probe -notmatch [char]0x2014) { throw "Encoding check failed - the em dash did not survive staging. Not deploying." }
if ([System.IO.File]::ReadAllBytes((Join-Path $Stage 'index.html'))[0] -eq 0xEF) { throw "Encoding check failed - a BOM was written. Not deploying." }
if ($probe.Contains([string][char]0x00E2 + [char]0x20AC)) { throw "Encoding check failed - mojibake found in index.html. Not deploying." }

# 2. Leaks: nothing secret or internal may be in the staging folder.
$deny = @('.env', '.env.example', '.deploy-version', 'deploy.ps1', 'deploy-last.log',
          'contact-worker.js', 'sheet-logger.gs', 'README.md')
$leaks = Get-ChildItem $Stage -Recurse -Force | Where-Object { $deny -contains $_.Name -or $_.Name -like 'TECHNICAL_*' -or $_.Name -like 'HANDOFF_*' }
if ($leaks) { throw "Refusing to deploy - found $($leaks.Name -join ', ') in the staging folder." }

# 3. Neither address may be in a shipped file as plain text (TECHNICAL section 4.8):
#    contact@example.com (the site mailbox) or you@example.com (John's own).
#    -imatch makes the case-insensitive match explicit.
#    The resume PDF in files\ carries you@example.com ON PURPOSE, by John's
#    decision (a resume needs an address). It is binary, so it is not scanned
#    here: only the text types listed below are.
$plain = Get-ChildItem $Stage -Recurse -File -Include *.html,*.js,*.css,*.webmanifest,*.xml,*.txt |
         Where-Object { (Read-Text $_.FullName) -imatch '(contact|john)@goliash\.com' }
if ($plain) { throw "Refusing to deploy - an email address (contact@ or you@example.com) appears in plain text in $($plain.Name -join ', ')." }

# 4. The resume must be in staging: the front page, the footer and the /resume
#    redirects in _redirects all point at it.
if (-not (Test-Path (Join-Path (Join-Path $Stage 'files') 'Example_Resume.pdf'))) {
    throw "Refusing to deploy - files\Example_Resume.pdf is missing from the staging folder."
}

$count = (Get-ChildItem $Stage -Recurse -File).Count
$size  = [math]::Round((Get-ChildItem $Stage -Recurse -File | Measure-Object Length -Sum).Sum / 1KB, 0)
Write-Host ("Staged {0} files, {1} KB" -f $count, $size) -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "`nDry run - nothing uploaded, version counter not advanced." -ForegroundColor Yellow
    Write-Host "Staging folder left at:`n  $Stage" -ForegroundColor Yellow
    return
}

# ------------------------------------------------------------------- deploy
$Log = Join-Path $Root 'deploy-last.log'

if ($Create) {
    Write-Host "`nCreating Pages project '$env:PAGES_PROJECT'..." -ForegroundColor Green
    $made = Invoke-Wrangler pages project create $env:PAGES_PROJECT --production-branch main
    if ($made.Text -match 'already exists') {
        Write-Host "The project already exists - carrying on to the deploy." -ForegroundColor DarkGray
    } elseif ($made.Code -ne 0 -or $made.Text -notmatch 'Successfully created') {
        Write-Text $Log ($made.Output -join "`r`n")
        if ($made.Text -match 'More than one account') {
            Write-Host "Your login sees more than one Cloudflare account. Create a file named .env here with one line:" -ForegroundColor Cyan
            Write-Host "  CLOUDFLARE_ACCOUNT_ID=<the 32-character ID from the dashboard URL>" -ForegroundColor Cyan
        }
        throw "Could not create the Pages project - see the lines above (also saved to deploy-last.log)."
    }
}

Write-Host "`nDeploying to Pages project '$env:PAGES_PROJECT'..." -ForegroundColor Green
$run = Invoke-Wrangler pages deploy $Stage --project-name=$env:PAGES_PROJECT --branch main --commit-dirty=true
# Not Tee-Object: in PowerShell 5.1 it writes UTF-16, which most editors can't read.
Write-Text $Log ($run.Output -join "`r`n")

# Success means exit 0 AND wrangler's own "Deployment complete" line.
if ($run.Code -ne 0 -or $run.Text -notmatch 'Deployment complete') {
    Write-Host "`n--- wrangler failed. Its last words: ---" -ForegroundColor Red
    ($run.Output | Select-Object -Last 30) | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkYellow }
    Write-Host "--- full output saved to deploy-last.log ---" -ForegroundColor Red
    $said = $run.Text
    if ($said -match 'More than one account') {
        Write-Host "Your login sees more than one Cloudflare account. Create a file named .env here with one line:" -ForegroundColor Cyan
        Write-Host "  CLOUDFLARE_ACCOUNT_ID=<the 32-character ID from the dashboard URL>" -ForegroundColor Cyan
    } elseif ($said -match 'not found|does not exist|8000007') {
        Write-Host "The Pages project doesn't exist yet. Run .\deploy.ps1 -Create once." -ForegroundColor Cyan
    } else {
        Write-Host "First deploy? Run .\deploy.ps1 -Create once." -ForegroundColor Cyan
    }
    throw "No deployment was confirmed (wrangler exit code $($run.Code)). Nothing was marked as deployed."
}

Write-Text $VerFile "$version"          # only after a successful upload
Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue

$url = [regex]::Match($run.Text, 'https://[a-z0-9.-]+\.pages\.dev').Value
Write-Host "`nDeployed as v$version" -ForegroundColor Green
if ($url) { Write-Host "Preview: $url" -ForegroundColor Green }
Write-Host "Now check it: open the site, then run the checklist in TECHNICAL_john.goliash.com.md section 8." -ForegroundColor Yellow
