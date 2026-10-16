#!/usr/bin/env python3
"""Download the villager pictures the Animal Crossing reports page shows.

    pip install pillow
    python tools/get-villager-pictures.py

The pictures are Nintendo's game art, so they are not stored in this repository.
This script fetches each villager's icon (128 px) and photo (256 px) from the
public ACNH API project (github.com/alexislours/ACNHAPI, release v1.8.0), which
names every file by the game's own villager ID: the same value as the Filename
column in js/villagers-data.js (Admiral is brd06). It saves them as WebP in
img/villagers/icon/ and img/villagers/photo/. Nothing is drawn or retouched.

Without the pictures the page still works: each villager shows its initial.
"""
import io, pathlib, re, sys, urllib.request

try:
    from PIL import Image
except ImportError:
    sys.exit('Needs Pillow: pip install pillow')

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://raw.githubusercontent.com/alexislours/ACNHAPI/v1.8.0/'
SOURCES = {'icon': ('icons/villagers/', 128), 'photo': ('images/villagers/', 256)}

data = (ROOT / 'js' / 'villagers-data.js').read_text(encoding='utf-8')
ids = sorted(set(re.findall(r'\b([a-z]{3}\d{2})\b', data)))
if not ids:
    sys.exit('No villager IDs found in js/villagers-data.js')
print('%d villagers' % len(ids))

got = missing = 0
for kind, (folder, size) in SOURCES.items():
    out = ROOT / 'img' / 'villagers' / kind
    out.mkdir(parents=True, exist_ok=True)
    for vid in ids:
        dst = out / (vid + '.webp')
        if dst.exists():
            continue
        try:
            with urllib.request.urlopen(BASE + folder + vid + '.png', timeout=30) as r:
                im = Image.open(io.BytesIO(r.read())).convert('RGBA')
        except Exception as e:
            missing += 1
            print('  no %s for %s (%s)' % (kind, vid, e))
            continue
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=88, method=6)
        got += 1
print('Saved %d pictures%s.' % (got, ', %d not found' % missing if missing else ''))
