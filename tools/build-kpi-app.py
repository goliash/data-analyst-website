#!/usr/bin/env python3
"""Build the two stand-alone KPI Lab pages from the one in index.html.

    python tools/build-kpi-app.py

index.html holds the only copy of the KPI Lab markup (<div class="kapp" id="kapp">).
This writes:
  kpi-lab.html                         the version you install from the browser (phones, computers)
  apps/kpi-lab-desktop/app/index.html  the desktop app's window (Electron)
and copies css/style.css, css/kpi-lab.css, css/kpi-lab-app.css and js/kpi-lab.js into
apps/kpi-lab-desktop/app/. Run it after any change to KPI Lab. Standard library only.
"""
import pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = (ROOT / 'index.html').read_text(encoding='utf-8')

def kapp_markup(html):
    start = html.index('<div class="kapp" id="kapp"')
    depth = 0
    for m in re.finditer(r'<div\b|</div>', html[start:]):
        depth += 1 if m.group(0) == '<div' else -1
        if depth == 0:
            return html[start:start + m.end()]
    raise SystemExit('KPI Lab markup not closed in index.html')

KAPP = kapp_markup(INDEX)
KAPP_APP = KAPP.replace('<div class="kapp" id="kapp"', '<div class="kapp is-desktop" id="kapp"')
THEME = """<script>
  /* light or dark: the app's own choice, else the device's */
  (function () { var t = null; try { t = localStorage.getItem('kpi-lab-theme'); } catch (e) {}
    if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t); })();
</script>"""

PWA = f"""<!DOCTYPE html>
<html lang="en" data-desktop data-pwa data-theme="dark" class="js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>KPI Lab</title>
<meta name="description" content="KPI Lab: 14 inventory, ordering, shipping and plant-floor measures, each with its formula and a plain-words lesson. Install it on your phone or computer; it works offline.">
<link rel="canonical" href="https://john.goliash.com/kpi-lab">
<link rel="manifest" href="kpi-lab.webmanifest">
<link rel="icon" href="img/kpi-lab-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="img/kpi-lab-apple-180.png" sizes="180x180">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="KPI Lab">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#12375f">
{THEME}
<link rel="stylesheet" href="css/style.css?v=1">
<link rel="stylesheet" href="css/kpi-lab.css?v=1">
<link rel="stylesheet" href="css/kpi-lab-app.css?v=1">
</head>
<body>
<!-- Built by tools/build-kpi-app.py from index.html. Edit KPI Lab there, then run the script. -->
<div id="site" class="site">
  <main id="main">
    <section id="lab">
      {KAPP_APP}
    </section>
  </main>
</div>
<script src="js/kpi-lab.js?v=1"></script>
</body>
</html>
"""

ELECTRON = f"""<!DOCTYPE html>
<html lang="en" data-desktop data-theme="dark" class="js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' file:; script-src 'self' 'unsafe-inline' file:; style-src 'self' 'unsafe-inline' file:; img-src 'self' data: file:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>KPI Lab</title>
{THEME}
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="kpi-lab.css">
<link rel="stylesheet" href="kpi-lab-app.css">
</head>
<body>
<!-- Built by tools/build-kpi-app.py from index.html. Edit KPI Lab there, then run the script. -->
<div id="site" class="site">
  <main id="main">
    <section id="lab">
      {KAPP_APP}
    </section>
  </main>
</div>
<script src="kpi-lab.js"></script>
</body>
</html>
"""

(ROOT / 'kpi-lab.html').write_text(PWA, encoding='utf-8')
app = ROOT / 'apps' / 'kpi-lab-desktop' / 'app'
app.mkdir(parents=True, exist_ok=True)
(app / 'index.html').write_text(ELECTRON, encoding='utf-8')
for f in ['css/style.css', 'css/kpi-lab.css', 'css/kpi-lab-app.css', 'js/kpi-lab.js']:
    shutil.copyfile(ROOT / f, app / pathlib.Path(f).name)
old = app / 'desktop.css'
if old.exists():
    old.unlink()   # replaced by kpi-lab-app.css
print('kpi-lab.html and apps/kpi-lab-desktop/app/ rebuilt from index.html')
