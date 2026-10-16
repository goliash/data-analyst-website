/* john.goliash.com — intro, theme, header measure, menu, section marker,
   email, counters, count sheet, résumé feed, KPI lab, contact form, and the
   interview story.
   No dependencies, no build step. Section numbers match
   TECHNICAL_john.goliash.com.md. */
(function () {
  'use strict';

  var root = document.documentElement;
  var REDUCED = false;
  REDUCED = document.documentElement.classList.contains('no-motion');   // the motion switch, disclosure §2

  var MINUS = '−';
  var NUM = (function () {
    try { var f = new Intl.NumberFormat('en-US'); return function (n) { return f.format(n); }; }
    catch (e) { return function (n) { return String(n); }; }
  })();
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  /* ==================================================================
     1. INTRO  —  count meets system, two pairs are fixed, it all goes
     green, the name lands.  §4.5

     Plays ONCE PER VISIT (sessionStorage), not once per load. The footer's
     "Replay the intro" brings it back. The head script adds html.seen
     before first paint so a repeat load never flashes it.

     It runs for everyone, including visitors whose OS asks for reduced
     motion — the standing owner decision in TECHNICAL_BASELINE R-07. The
     four exits are what make that defensible; keep all four: the timer, a
     click anywhere, Esc / Enter / Space, the Skip button — plus a 6s
     backstop so nobody is ever stuck behind it.

     Beat sheet (must stay in step with style.css):
       0.15s baseline   0.25s count bars   0.35s system bars
       1.05s scan       1.42s pair 2 fixed  1.78s pair 5 fixed
       1.95s matched line, bars turn green   2.15s name   2.40s strapline
     RUNTIME must exceed the last beat (2.40 + 0.60 = 3.0s).
     ================================================================== */
  var RUNTIME  = 3200;
  var BACKSTOP = 6000;
  var SEEN_KEY = 'jg-intro';

  var intro = document.getElementById('intro');
  var site  = document.getElementById('site');
  var introTimers = [];
  var ended = true;
  var onIntroEnd = [];

  function markSeen() { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {} }

  function onIntroKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      endIntro();
    }
  }

  function endIntro() {
    if (ended) return;
    ended = true;
    introTimers.forEach(clearTimeout);
    introTimers = [];
    window.removeEventListener('keydown', onIntroKey);
    document.body.classList.remove('locked');
    intro.classList.add('done');
    site.classList.remove('no-intro');
    site.classList.remove('in');
    void site.offsetWidth;                  // restart the border expansion
    site.classList.add('in');
    introTimers.push(setTimeout(function () { intro.classList.add('gone'); }, 650));
    markSeen();
    var waiting = onIntroEnd; onIntroEnd = [];
    waiting.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function startIntro() {
    if (!intro || !site) return;
    /* A replay swaps in a fresh copy of the layer: the only reliable way to
       restart every CSS animation in it, and the old node takes its
       listeners with it, so replays can't stack them (OliUni §32.4). */
    var fresh = intro.cloneNode(true);
    intro.parentNode.replaceChild(fresh, intro);
    intro = fresh;
    intro.classList.remove('done', 'gone');
    root.classList.remove('seen');
    ended = false;
    document.body.classList.add('locked');
    intro.addEventListener('click', endIntro);
    var skip = intro.querySelector('#skip');
    if (skip) skip.addEventListener('click', function (e) { e.stopPropagation(); endIntro(); });
    window.addEventListener('keydown', onIntroKey);
    introTimers.push(setTimeout(endIntro, RUNTIME));
    introTimers.push(setTimeout(endIntro, BACKSTOP));
  }

  var seen = false;
  try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}

  /* index.html#replay — the footer link on the 404 lands here. */
  var askedReplay = location.hash === '#replay';
  if (askedReplay) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  if (intro && site) {
    if (seen && !askedReplay) {
      intro.classList.add('gone');
      site.classList.add('no-intro');
    } else {
      startIntro();
    }
  }

  var replay = document.getElementById('replay');
  if (replay && intro) {
    replay.addEventListener('click', function () {
      window.scrollTo(0, 0);
      startIntro();
    });
  } else if (replay) {
    replay.hidden = true;
  }

  function whenIntroDone(fn) { if (ended) fn(); else onIntroEnd.push(fn); }

  /* ==================================================================
     2. THEME  —  cookie → (older visits' localStorage) → OS, default dark.  §4.2
     Settings live in cookies (John, 15 Oct 2026). Nothing is stored on load;
     only an explicit click writes, so a visitor who never touches a control
     never gets a cookie.
     ================================================================== */
  var themeBtn = document.getElementById('theme');
  var chose = false;
  try {
    var saved = localStorage.getItem('theme');
    chose = /(?:^|;\s*)theme=(dark|light)\b/.test(document.cookie) || saved === 'dark' || saved === 'light';
  } catch (e) {}

  /* Point the tab icon at the artwork for the resolved theme. The folder is
     taken from the link's own resolved href, so this works from the root
     page, the 404 at any depth, or a file opened from disk.  §4.4 */
  var ICON_V = '?i=1';
  function paintFavicon(theme) {
    try {
      var svg = document.getElementById('fav-svg');
      var png = document.getElementById('fav-png');
      if (svg) svg.href = svg.href.replace(/[^\/]*$/, '') + 'favicon-' + theme + '.svg' + ICON_V;
      if (png) png.href = png.href.replace(/[^\/]*$/, '') + 'favicon' + (theme === 'dark' ? '-dark' : '') + '-32.png' + ICON_V;
    } catch (e) {}
  }

  var SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.3 8.3 0 1 0 10.2 10.2Z"/></svg>';

  function paintToggle() {
    if (!themeBtn) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    themeBtn.innerHTML = dark ? SUN : MOON;      // the icon for the mode you'd switch TO
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  paintToggle();

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      chose = true;
      setCookie('theme', next, 365);
      try { localStorage.removeItem('theme'); } catch (e) {}   // one store: the cookie
      paintToggle();
      paintFavicon(next);
    });
  }

  /* A first-party cookie for a setting: one year, this site only, sent
     over https only once the site is on https. days 0 deletes it. */
  function setCookie(name, value, days) {
    try {
      document.cookie = name + '=' + (days ? value : '') + ';path=/;SameSite=Lax;max-age=' + (days ? days * 86400 : 0) +
        (location.protocol === 'https:' ? ';Secure' : '');
    } catch (e) {}
  }

  /* ==================================================================
     2c. GOOGLE ANALYTICS SWITCH  —  disclosure.html §2, TECHNICAL §4.20.
     The <head> tag (Tag Manager, which sends Analytics) skips loading when the "analytics=off"
     cookie is set or the browser sends Global Privacy Control. Switching
     off also sets Google's own opt-out flag and deletes its _ga cookies.
     ================================================================== */
  var GA_ID = 'G-XXXXXXXXXX', gaSw = document.getElementById('ga-switch');
  if (gaSw) {
    var gaNote = document.getElementById('ga-note');
    var gpc = false;
    try { gpc = navigator.globalPrivacyControl === true; } catch (e) {}
    var gaOff = function () { return gpc || /(?:^|;\s*)analytics=off\b/.test(document.cookie); };
    var dropGaCookies = function () {
      var host = location.hostname, parts = host.split('.'), domains = ['', host];
      for (var i = 1; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (!/^(_ga(_|$)|_gid$|_gat|_gcl_)/.test(name)) return;   // GA and anything Tag Manager's Google tags set
        domains.forEach(function (d) { document.cookie = name + '=;path=/;max-age=0' + (d ? ';domain=' + d : ''); });
      });
    };
    var paintGa = function () {
      var on = !gaOff();
      gaSw.setAttribute('aria-checked', String(on));
      var st = gaSw.querySelector('.switch-state');
      if (st) st.textContent = on ? 'On' : 'Off';
    };
    paintGa();
    if (gpc) {
      gaSw.disabled = true;
      if (gaNote) gaNote.textContent = 'Your browser sends Global Privacy Control, so analytics is off and stays off.';
    }
    gaSw.addEventListener('click', function () {
      if (gpc) return;
      var turnOff = !gaOff();
      if (turnOff) {
        setCookie('analytics', 'off', 365);
        window['ga-disable-' + GA_ID] = true;
        dropGaCookies();
      } else {
        setCookie('analytics', 'off', 0);
        window['ga-disable-' + GA_ID] = false;
      }
      paintGa();
      if (gaNote) gaNote.textContent = turnOff
        ? 'Analytics is off. Google\u2019s code (Analytics and Tag Manager) won\u2019t load from the next page on, and its cookies are gone. A cookie remembers this for a year.'
        : 'Analytics is back on from the next page you open.';
    });
  }

  /* ==================================================================
     2b. MOTION  —  on for everyone. The switch on disclosure.html turns it
     off, and a "motion=off" cookie remembers that for a year. Turning it
     back on deletes the cookie. The <head> script reads it before paint.
     ================================================================== */
  var motionSw = document.getElementById('motion-switch');
  if (motionSw) {
    var motionNote = document.getElementById('motion-note');
    var paintMotion = function () {
      var on = !root.classList.contains('no-motion');
      motionSw.setAttribute('aria-checked', String(on));
      var st = motionSw.querySelector('.switch-state');
      if (st) st.textContent = on ? 'On' : 'Off';
    };
    paintMotion();
    motionSw.addEventListener('click', function () {
      var off = !root.classList.contains('no-motion');
      root.classList.toggle('no-motion', off);
      setCookie('motion', 'off', off ? 365 : 0);
      paintMotion();
      if (motionNote) motionNote.textContent = off
        ? 'Motion is off on every page. A cookie remembers this for a year.'
        : 'Motion is back on. The cookie is deleted.';
    });
  }

  try {
    var mqLight = matchMedia('(prefers-color-scheme: light)');
    var followOS = function (e) {
      if (chose) return;
      root.setAttribute('data-theme', e.matches ? 'light' : 'dark');
      paintToggle();
      // No paintFavicon: with no explicit choice, favicon.svg tracks the OS itself.
    };
    if (mqLight.addEventListener) mqLight.addEventListener('change', followOS); else mqLight.addListener(followOS);
  } catch (e) {}

  /* ==================================================================
     3. HEADER HEIGHT — measured, published, consumed.  §4.6
     Sections use scroll-margin-top: var(--hdr-h). The header's height
     depends on fonts, zoom and the viewport, so it is measured live; the
     72px in the stylesheet is only the fallback before this runs.
     ================================================================== */
  var hdr = document.querySelector('.hdr');
  var hdrH = 72;
  function publishHeader() {
    if (!hdr) return;
    hdrH = hdr.getBoundingClientRect().height;
    root.style.setProperty('--hdr-h', Math.round(hdrH + 14) + 'px');
  }
  publishHeader();
  if (hdr && 'ResizeObserver' in window) new ResizeObserver(publishHeader).observe(hdr);
  else window.addEventListener('resize', publishHeader);

  /* ==================================================================
     4. MENU — below 900px the nav folds behind a button.  §4.6
     Closes on a link, Esc (focus goes back to the button), a click
     outside, tabbing out of it, or the window growing past the breakpoint.
     ================================================================== */
  var menuBtn = document.getElementById('menu');
  var nav = document.getElementById('nav');
  var mqMenu = null;
  try { mqMenu = matchMedia('(max-width: 900px)'); } catch (e) {}
  function isMobile() { return !!(mqMenu && mqMenu.matches); }
  function menuIsOpen() { return !!(menuBtn && menuBtn.getAttribute('aria-expanded') === 'true'); }

  function setMenu(open, focusBack) {
    if (!menuBtn || !nav) return;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('open', open);
    if (open) {
      var first = nav.querySelector('a');
      if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }, 40);
    } else if (focusBack) {
      menuBtn.focus();
    }
    moveInk();
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function (e) { e.stopPropagation(); setMenu(!menuIsOpen()); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a') && menuIsOpen()) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuIsOpen()) { e.preventDefault(); setMenu(false, true); }
    });
    document.addEventListener('click', function (e) {
      if (menuIsOpen() && !nav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
    nav.addEventListener('focusout', function (e) {
      if (!menuIsOpen()) return;
      var to = e.relatedTarget;
      if (to && !nav.contains(to) && to !== menuBtn) setMenu(false);
    });
    if (mqMenu) {
      var onMenuMq = function (e) { if (!e.matches && menuIsOpen()) setMenu(false); moveInk(); };
      if (mqMenu.addEventListener) mqMenu.addEventListener('change', onMenuMq); else mqMenu.addListener(onMenuMq);
    }
  }

  /* ==================================================================
     5. SECTION MARKER — which part of the page you are reading.  §4.6
     The nav link for the current section gets aria-current, and on wide
     screens a green underline slides to it.
     ================================================================== */
  var spyLinks = nav ? [].slice.call(nav.querySelectorAll('a[href^="#"]')) : [];
  var spyTargets = spyLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
                           .filter(function (el) { return !!el; });
  var spyNow = null;

  function moveInk() {
    if (!nav) return;
    var a = nav.querySelector('a[aria-current="true"]:not(.nav-cta)');
    if (!a || isMobile()) { nav.classList.remove('has-ink'); return; }
    nav.style.setProperty('--ink-x', a.offsetLeft + 'px');
    nav.style.setProperty('--ink-w', a.offsetWidth + 'px');
    nav.classList.add('has-ink');
  }

  function spy() {
    if (!spyTargets.length) return;
    var line = hdrH + window.innerHeight * 0.3;
    var current = null;
    for (var i = 0; i < spyTargets.length; i++) {
      if (spyTargets[i].getBoundingClientRect().top <= line) current = spyTargets[i].id;
    }
    var doc = document.documentElement;
    if (window.innerHeight + window.pageYOffset >= doc.scrollHeight - 4) current = spyTargets[spyTargets.length - 1].id;
    if (current === spyNow) return;
    spyNow = current;
    spyLinks.forEach(function (a) {
      if (current && a.getAttribute('href') === '#' + current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    moveInk();
  }

  /* ==================================================================
     6. EMAIL — codes offset by +7; never plain text in a served file.  §4.8
     ================================================================== */
  var chip = document.getElementById('mailchip');
  var ADDRESS = '';
  if (chip) {
    try {
      ADDRESS = chip.getAttribute('data-e').split(' ')
        .map(function (n) { return String.fromCharCode(parseInt(n, 10) - 7); }).join('');
      chip.setAttribute('href', 'mail' + 'to:' + ADDRESS);
      var chipLabel = chip.querySelector('.chip-label');
      if (chipLabel) chipLabel.textContent = ADDRESS;
    } catch (e) { /* leaves the #contact fallback in place */ }
  }

  /* ==================================================================
     7. COUNTERS — once, on screen AND after the intro (R-17).  §4.7
     The real value lives in the HTML: text, data-count, data-suffix.
     ================================================================== */
  var tally = document.querySelector('.tally');
  var tallyNums = [].slice.call(document.querySelectorAll('.tally dd[data-count]'));
  if (tally && tallyNums.length) {
    var counted = false, tallyOnScreen = false, tallyIntroOk = false;
    var runCounters = function () {
      if (counted || !tallyOnScreen || !tallyIntroOk) return;
      counted = true;
      tallyNums.forEach(function (el, i) {
        var target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        if (isNaN(target)) return;
        if (target === 0) { el.classList.add('counted'); return; }
        var DUR = 900, t0 = null;
        el.textContent = '0' + suffix;
        setTimeout(function () {
          function frame(ts) {
            if (t0 === null) t0 = ts;
            var p = Math.min((ts - t0) / DUR, 1);
            el.textContent = Math.round(easeOut(p) * target) + suffix;
            if (p < 1) requestAnimationFrame(frame);
            else { el.textContent = target + suffix; el.classList.add('counted'); }
          }
          requestAnimationFrame(frame);
        }, i * 120);
      });
    };
    whenIntroDone(function () { setTimeout(function () { tallyIntroOk = true; runCounters(); }, 250); });
    if ('IntersectionObserver' in window) {
      var tallyIO = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { tallyOnScreen = true; runCounters(); if (counted) tallyIO.disconnect(); }
      }, { threshold: 0.5 });
      tallyIO.observe(tally);
    } else { tallyOnScreen = true; runCounters(); }
  }

  /* ==================================================================
     8. COUNT SHEET — the hero demo.  §4.9
     Each pass: two bins are thrown off, one for each cause below. The
     sheet is scanned bin by bin; the ones that disagree are flagged, traced
     to a cause and fixed, until all six match. Sample data only.

     It waits for the intro, runs only while on screen and the tab is
     visible, and under reduced motion makes one pass without movement and
     stops (with a "Run it again" button). With JavaScript off, the HTML
     shows the finished, reconciled sheet.
     ================================================================== */
  var sheet = document.getElementById('sheet');
  if (sheet) (function () {
    var trs = [].slice.call(sheet.querySelectorAll('#sheet-rows tr'));
    var scroller = sheet.querySelector('.sheet-scroll');
    var statusEl = document.getElementById('sheet-status');
    var matchEl = document.getElementById('sheet-match');
    var accEl = document.getElementById('sheet-acc');
    var meter = sheet.querySelector('.sheet-meter span');
    var runBtn = document.getElementById('sheet-run');

    /* [bin, item, quantity on hand] — sample data, not any company's stock */
    var ITEMS = [
      ['A-04-02', 'Caster wheel, 3 in',   48],
      ['A-07-11', 'Hex bolts, box of 50', 150],
      ['B-02-05', 'Stretch wrap, 18 in',  36],
      ['B-09-03', 'Pallet labels, roll',  14],
      ['C-01-08', 'Shipping box, 12 in',  210],
      ['C-05-14', 'Zip ties, bag of 100', 300]
    ];
    var WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

    /* Each cause throws one side off, says what tracing it found, and how
       it was fixed. Only the two causes John has actually traced at English
       Riding Supply are used (confirmed 14 Oct 2026): a shipment that went
       out but was never posted, and stock sitting in the wrong bin. */
    var CAUSES = {
      shipment: {
        make: function (q, k) { return { c: q, s: q + k }; },
        found: function () { return 'Found: a shipment not posted'; },
        fixed: function () { return 'Shipment posted'; }, side: 's'
      },
      wrongbin: {
        make: function (q, k) { return { c: q - k, s: q }; },
        found: function (it, r) { return 'Found: ' + NUM(r.s - r.c) + ' in the wrong bin'; },
        fixed: function () { return 'Moved to the right bin'; }, side: 'c'
      }
    };
    var CAUSE_IDS = ['shipment', 'wrongbin'];

    function cell(tr, cls) { return tr.querySelector('.' + cls); }
    function fmtDiff(d) { return d === 0 ? '0' : (d > 0 ? '+' + NUM(d) : MINUS + NUM(-d)); }

    function setTick(tr, state) {
      var t = cell(tr, 'st').querySelector('.tick');
      t.className = 'tick is-' + state + (state !== 'wait' && !REDUCED ? ' pop' : '');
      t.setAttribute('aria-label', state === 'ok' ? 'Matches' : state === 'bad' ? 'Does not match' : 'Not counted yet');
    }
    function flip(el) {
      if (REDUCED) return;
      el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
    }
    function tween(el, from, to, dur, done) {
      if (REDUCED || from === to) { el.textContent = NUM(to); if (done) done(); return; }
      var t0 = null;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        el.textContent = NUM(Math.round(from + (to - from) * easeOut(p)));
        if (p < 1) requestAnimationFrame(frame); else { el.textContent = NUM(to); if (done) done(); }
      }
      requestAnimationFrame(frame);
    }
    /* The band follows its row's height as the row grows (16 Oct 2026: on a phone, "Found: a shipment
       not posted" wraps onto more lines after the band arrives, and the band used to stop short,
       drawing a line through the words). */
    var scanRow = null, scanRO = null;
    function placeScan() {
      if (!scanRow) return;
      var y = scanRow.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      scroller.style.setProperty('--scan-y', y + 'px');
      scroller.style.setProperty('--scan-h', scanRow.offsetHeight + 'px');
    }
    if ('ResizeObserver' in window) scanRO = new ResizeObserver(placeScan);
    function scanTo(tr) {
      if (scanRO) scanRO.disconnect();
      scanRow = tr || null;
      if (!tr) { sheet.classList.remove('scanning'); return; }
      placeScan();
      if (scanRO) scanRO.observe(tr);
      sheet.classList.add('scanning');
    }
    function kpi(matched, total, known) {
      matchEl.textContent = known ? (matched + ' of ' + total) : ('– of ' + total);
      var pct = known ? Math.round(matched / total * 100) : 0;
      accEl.textContent = known ? pct + '%' : '–';
      if (meter) meter.style.setProperty('--acc', (known ? pct : 0) + '%');
      sheet.classList.toggle('has-var', known && matched < total);
    }
    function say(text) { statusEl.textContent = text; }

    /* ---- one pass, as a list of timed steps ---- */
    var state = [];
    function buildPass() {
      var rows = ITEMS.map(function (it) { return { it: it, c: it[2], s: it[2], cause: null }; });
      var a = Math.floor(Math.random() * rows.length), b;
      do { b = Math.floor(Math.random() * rows.length); } while (b === a);
      /* one of each cause, in a random order */
      var order = Math.random() < 0.5 ? CAUSE_IDS.slice() : CAUSE_IDS.slice().reverse();
      [a, b].sort(function (x, y) { return x - y; }).forEach(function (i, n) {
        var it = rows[i].it, id = order[n];
        var k = Math.min(it[2] - 1, 2 + Math.floor(Math.random() * 11));
        var v = CAUSES[id].make(it[2], k, it);
        rows[i].c = v.c; rows[i].s = v.s; rows[i].cause = id;
      });
      state = rows;

      var steps = [];
      var gap = REDUCED ? 700 : 520;
      steps.push({ wait: 700, run: function () {
        trs.forEach(function (tr, i) {
          var r = state[i];
          tr.className = '';
          cell(tr, 'c').textContent = NUM(r.c);
          cell(tr, 's').textContent = NUM(r.s);
          var v = cell(tr, 'v'); v.textContent = '–'; v.classList.remove('off');
          var why = tr.querySelector('.why'); why.textContent = ''; why.className = 'why';
          setTick(tr, 'wait');
        });
        kpi(0, trs.length, false);
        say('Counting six bins against the system…');
      } });

      var matched = 0;
      trs.forEach(function (tr, i) {
        steps.push({ wait: i === 0 ? 450 : gap, run: function () {
          var r = state[i], d = r.c - r.s, v = cell(tr, 'v');
          if (!REDUCED) scanTo(tr);
          v.textContent = fmtDiff(d); flip(v);
          if (d === 0) { matched++; setTick(tr, 'ok'); }
          else { v.classList.add('off'); tr.classList.add('is-flagged'); setTick(tr, 'bad'); }
          matchEl.textContent = matched + ' of ' + (i + 1) + ' so far';
        } });
      });

      steps.push({ wait: gap + 200, run: function () {
        scanTo(null);
        var bad = state.filter(function (r) { return r.c !== r.s; }).length;
        kpi(trs.length - bad, trs.length, true);
        say(WORDS[bad] + ' bins don’t match. Tracing the causes before anyone acts on it.');
      } });

      state.forEach(function (r, i) {
        if (!r.cause) return;
        var tr = trs[i], C = CAUSES[r.cause], why = tr.querySelector('.why');
        steps.push({ wait: 1300, run: function () {
          why.className = 'why'; why.textContent = 'Tracing…';
          say('Tracing ' + r.it[0] + ', ' + r.it[1].toLowerCase() + '.');
          if (!REDUCED) scanTo(tr);
        } });
        steps.push({ wait: 850, run: function () { why.textContent = C.found(r.it, r); } });
        steps.push({ wait: 1050, run: function () {
          var target = C.side === 's' ? cell(tr, 's') : cell(tr, 'c');
          var from = C.side === 's' ? r.s : r.c;
          tween(target, from, r.it[2], 600, function () {
            r.c = r.it[2]; r.s = r.it[2];
            var v = cell(tr, 'v'); v.textContent = '0'; v.classList.remove('off'); flip(v);
            tr.classList.remove('is-flagged'); tr.classList.add('is-fixed');
            setTick(tr, 'ok');
            why.className = 'why done'; why.textContent = C.fixed(r.it);
            var left = state.filter(function (x) { return x.c !== x.s; }).length;
            kpi(trs.length - left, trs.length, true);
          });
        } });
      });

      steps.push({ wait: 1100, run: function () {
        scanTo(null);
        say('All six bins match the system. Now the report can go out.');
      } });
      steps.push({ wait: 5200, run: function () {
        trs.forEach(function (tr) { tr.classList.remove('is-fixed'); });
      } });
      return steps;
    }

    var steps = [], at = 0, tmr = null, running = false;
    var onScreen = false, introOk = false, finishedOnce = false;

    function next() {
      if (!running) return;
      if (at >= steps.length) {
        finishedOnce = true;
        if (REDUCED) { running = false; if (runBtn) runBtn.hidden = false; return; }
        steps = buildPass(); at = 0;
      }
      var s = steps[at];
      tmr = setTimeout(function () {
        tmr = null;
        if (!running) return;
        at++;
        try { s.run(); } catch (e) {}
        next();
      }, s.wait);
    }
    function play() {
      if (running || !onScreen || !introOk || document.hidden) return;
      if (REDUCED && finishedOnce) return;
      if (!steps.length) { steps = buildPass(); at = 0; }
      running = true;
      next();
    }
    function pause() { running = false; if (tmr) clearTimeout(tmr); tmr = null; }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        if (onScreen) play(); else pause();
      }, { threshold: 0.35 }).observe(sheet);
    } else { onScreen = true; }
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else play(); });
    whenIntroDone(function () { setTimeout(function () { introOk = true; play(); }, 600); });

    if (runBtn) runBtn.addEventListener('click', function () {
      runBtn.hidden = true; finishedOnce = false; steps = buildPass(); at = 0; pause(); play();
    });
    window.addEventListener('resize', function () { if (sheet.classList.contains('scanning')) scanTo(null); });
  })();

  /* ==================================================================
     9. RÉSUMÉ — live job lengths and the feed holes.  §4.11
     Lengths count months inclusively (Mar 2022 to Jan 2026 is 3 yr 11 mo),
     the way LinkedIn does; "present" counts to this month. The HTML holds
     the figures as of October 2026.
     ================================================================== */
  [].slice.call(document.querySelectorAll('.job-len[data-from]')).forEach(function (el) {
    try {
      var a = el.getAttribute('data-from').split('-').map(Number);
      var to = el.getAttribute('data-to'), b;
      if (to === 'present') { var d = new Date(); b = [d.getFullYear(), d.getMonth() + 1]; }
      else b = to.split('-').map(Number);
      var months = (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1;
      if (!(months > 0)) return;
      var y = Math.floor(months / 12), m = months % 12;
      el.textContent = (y ? y + ' yr' : '') + (y && m ? ' ' : '') + (m ? m + ' mo' : '');
    } catch (e) {}
  });

  var paper = document.getElementById('paper');
  function feed() {
    if (!paper) return;
    var r = paper.getBoundingClientRect();
    var p = clamp((window.innerHeight * 0.62 - r.top) / Math.max(r.height, 1), 0, 1);
    paper.style.setProperty('--feed', p.toFixed(4));
  }

  /* ==================================================================
     9b. PRINT THE RÉSUMÉ — the button beside Download PDF and Open PDF.
     Prints the one-page PDF (see below). Ctrl+P on the page still uses the
     site's own print layout.  §4.11
     ================================================================== */
  var resumePrint = document.getElementById('resume-print');
  var resumeNote = document.getElementById('resume-print-note');
  /* Prints the one-page résumé exactly as the PDF looks (16 Oct 2026).
     files/resume-print.svg is the PDF page turned into a vector picture
     (pdftocairo -svg), so it prints sharp at any printer resolution. The
     button shows only that picture to the printer and prints this page:
     no PDF viewer in a hidden frame (Chrome and Brave cut the page off),
     and it works the same on Windows, Mac, iPhone and Android.
     Rebuild the SVG whenever the PDF changes (TECHNICAL §4.11). */
  var RESUME_SVG = 'files/resume-print.svg';
  var printPage = null;
  function getPrintPage() {
    if (printPage) return printPage;
    printPage = document.createElement('img');
    printPage.id = 'resume-print-page'; printPage.alt = ''; printPage.className = 'resume-print-page';
    printPage.decoding = 'sync';
    printPage.src = RESUME_SVG;
    document.body.appendChild(printPage);
    return printPage;
  }
  /* fetch it when the résumé comes near, so a tap prints at once */
  var resumeSec = document.getElementById('resume');
  if (resumePrint && resumeSec && 'IntersectionObserver' in window) {
    var rIO = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { getPrintPage(); rIO.disconnect(); }
    }, { rootMargin: '600px 0px' });
    rIO.observe(resumeSec);
  }
  if (resumePrint) resumePrint.addEventListener('click', function () {
    var img = getPrintPage();
    if (resumeNote) resumeNote.textContent = '';
    var opened = false;
    var onBefore = function () { opened = true; };
    /* No page margins while the résumé prints (16 Oct 2026, John: "remove the Safari header and footer").
       Browsers print their date / title / web-address lines inside the margins; with none, there is no
       room and they're left off. Added only for this print, so Ctrl+P keeps its normal margins. */
    var noMargins = null;
    var done = function () {
      root.classList.remove('resume-pdf');
      if (noMargins && noMargins.parentNode) noMargins.parentNode.removeChild(noMargins);
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', done);
    };
    function go() {
      window.addEventListener('beforeprint', onBefore);
      window.addEventListener('afterprint', done);
      noMargins = document.createElement('style');
      noMargins.textContent = '@page { size: letter; margin: 0; }';
      document.head.appendChild(noMargins);
      root.classList.add('resume-pdf');
      try { window.print(); } catch (e) {}
      setTimeout(function () {
        if (!opened && resumeNote) resumeNote.textContent = 'No print window? Open the PDF, then print it from there (on iPhone: Share, then Print).';
      }, 2500);
    }
    if (img.complete && img.naturalWidth) go();
    else {
      if (resumeNote) resumeNote.textContent = 'Getting the page ready…';
      img.onload = function () { img.onload = null; if (resumeNote) resumeNote.textContent = ''; go(); };
      img.onerror = function () { if (resumeNote) resumeNote.textContent = 'Couldn’t load the print page. Use Open PDF and print from there.'; };
    }
  });

  /* ==================================================================
     10. KPI LAB — moved to js/kpi-lab.js (15 Oct 2026), so the website and the
     desktop app (apps/kpi-lab-desktop) run the same code.  §4.10, §4.23
     ================================================================== */

  /* ==================================================================
     11. CONTACT FORM — same pipeline as wint.win and mixyz.xyz.  §4.12, §5
     Posts to /api/contact (a Worker). If that fails or isn't deployed
     yet, the visitor gets the same message as a pre-filled email.
     ================================================================== */
  var form = document.getElementById('form');
  var statusEl = document.getElementById('status');
  var sendBtn = document.getElementById('send');
  var fallback = document.getElementById('fallback');
  var loadedAt = Date.now();
  var SEND_LABEL = sendBtn ? sendBtn.textContent : 'Send';

  function say(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  var progWrap  = document.getElementById('progress');
  var progFill  = document.getElementById('prog-fill');
  var progMsg   = document.getElementById('prog-msg');
  var progTrack = progWrap && progWrap.querySelector('.prog-track');
  var progTimer = null, progPct = 0, progT0 = 0, inFlight = false;

  /* [elapsed ms, ceiling %, message] — each names real work. Last ceiling < 100. */
  var PROG_STEPS = [
    [    0, 10, 'Opening a secure connection…'],
    [  700, 28, 'Checking your details…'],
    [ 1900, 50, 'Saving your message…'],
    [ 3300, 70, 'Emailing it to John…'],
    [ 5200, 84, 'Waiting for the server to confirm…'],
    [ 8000, 91, 'Almost there. Thanks for waiting…']
  ];

  function progSet(p, msg) {
    progPct = Math.max(progPct, Math.min(p, 100));          // only ever advances
    if (progFill)  progFill.style.width = progPct + '%';
    if (progTrack) progTrack.setAttribute('aria-valuenow', String(Math.round(progPct)));
    if (msg && progMsg) progMsg.textContent = msg;
  }
  function progStart() {
    if (!progWrap) return;
    progPct = 0; progT0 = Date.now();
    progWrap.hidden = false;
    progWrap.classList.remove('done', 'failed');
    if (progFill) progFill.style.width = '0%';
    progSet(0, PROG_STEPS[0][2]);
    clearInterval(progTimer);
    progTimer = setInterval(function () {
      var t = Date.now() - progT0, step = PROG_STEPS[0];
      for (var i = 0; i < PROG_STEPS.length; i++) if (t >= PROG_STEPS[i][0]) step = PROG_STEPS[i];
      progSet(progPct + (step[1] - progPct) * 0.08, step[2]);
    }, 70);
  }
  function progEnd(ok, msg) {
    clearInterval(progTimer); progTimer = null;
    if (!progWrap) return;
    if (ok) { progWrap.classList.add('done'); progSet(100, msg); }
    else { progWrap.classList.add('failed'); if (progMsg) progMsg.textContent = msg; }   // left where it reached
  }

  window.addEventListener('beforeunload', function (e) {
    if (!inFlight) return;
    e.preventDefault(); e.returnValue = ''; return '';
  });

  /* Browser-reported details sent with a message. Keep in step with
     DEVICE_KEYS in contact-worker.js, DEVICE_LABELS in sheet-logger.gs and
     the tables in disclosure.html §1. */
  function deviceInfo() {
    var n = navigator, sc = screen, out = {};
    function put(k, v) {
      if (v === undefined || v === null || v === '') return;
      out[k] = String(v).replace(/[^\x20-\x7E]/g, '').slice(0, 400);   // ASCII, bounded
    }
    var ua = n.userAgent || '';
    var touch = (n.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    var iPad = /iPad/.test(ua) || (n.platform === 'MacIntel' && (n.maxTouchPoints || 0) > 1);
    var kind = iPad ? 'Tablet' : /Mobi|iPhone|Android.*Mobile/.test(ua) ? 'Phone' : /Android|Tablet/.test(ua) ? 'Tablet' : 'Desktop';
    put('kind', kind);
    put('platform', n.platform);
    put('screen', sc ? sc.width + 'x' + sc.height : '');
    put('vp', window.innerWidth + 'x' + window.innerHeight);
    put('dpr', window.devicePixelRatio);
    put('depth', sc ? sc.colorDepth : '');
    try { put('tz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) {}
    put('tzOffset', new Date().getTimezoneOffset());
    put('langs', (n.languages || [n.language]).join(','));
    put('cores', n.hardwareConcurrency);
    put('mem', n.deviceMemory);
    put('touch', touch ? 'yes' : 'no');
    put('referrer', document.referrer);
    put('ua', ua);
    return out;
  }

  /* The fallback email. Two rules from wint.win §4.7a: the address goes in
     the mailto path RAW (a %40 empties Gmail's To field), and line breaks
     are CRLF (a bare %0A collapses the draft in the Gmail iOS app). */
  function mailtoFor(name, company, msg) {
    if (!ADDRESS) return '#contact';
    var body = String(msg || '').replace(/\r\n?/g, '\n').split('\n').join('\r\n')
             + '\r\n\r\n' + '— ' + (name || '') + (company ? ', ' + company : '');
    return 'mail' + 'to:' + ADDRESS + '?subject=' + encodeURIComponent('Message from john.goliash.com')
         + '&body=' + encodeURIComponent(body);
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim(), mail = form.email.value.trim();
      var company = form.company.value.trim(), msg = form.message.value.trim();
      var bad = null;
      [['name', name], ['email', mail], ['message', msg]].forEach(function (p) {
        var row = form[p[0]].closest('.row'), empty = !p[1];
        if (row) row.classList.toggle('bad', empty);
        if (empty && !bad) bad = p[0];
      });
      if (bad) { say('Please fill in your name, email and message.', 'err'); form[bad].focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
        form.email.closest('.row').classList.add('bad');
        say('That email address doesn’t look right.', 'err');
        form.email.focus();
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      if (fallback) fallback.hidden = true;
      say('');
      inFlight = true;
      progStart();

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name, email: mail, company: company, message: msg,
          website: form.website.value,          // honeypot
          elapsed: Date.now() - loadedAt,       // timing gate
          device: deviceInfo()
        })
      })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error('rejected');
        inFlight = false;
        form.reset();
        sendBtn.textContent = 'Sent';
        progEnd(true, 'Delivered.');
        // Only promise a confirmation email when the server says one went out.
        say(d.acked
          ? 'Sent. I’ll read it myself, and I’ve emailed you a copy.'
          : 'Sent. I’ll read it myself and reply from my own email.', 'ok');
        // Left disabled on purpose: a delivered message can't be sent twice.
      })
      .catch(function () {
        inFlight = false;
        sendBtn.disabled = false;
        sendBtn.textContent = SEND_LABEL;
        progEnd(false, 'Couldn’t reach the server.');
        say('That didn’t send. Nothing was lost: you can send the same message from your email app.', 'err');
        if (fallback) { fallback.href = mailtoFor(name, company, msg); fallback.hidden = false; }
      });
    });

    form.addEventListener('input', function (e) {
      var row = e.target.closest('.row');
      if (row && e.target.value.trim()) row.classList.remove('bad');
    });
  }

  /* ==================================================================
     13. THE INTERVIEW — a scroll story.  §4.10a
     The beat you are reading picks the scene on the stage. Switching a
     scene drops and re-adds its .on class, which restarts its CSS
     timeline. The stage caption types out the interviewer's question.
     Loops pause while the story is off screen. All of it is decoration:
     the text column tells the whole story with or without JavaScript.
     ================================================================== */
  var stage = document.getElementById('stage');
  var beats = [].slice.call(document.querySelectorAll('#beats .beat'));
  var storyTick = function () {};
  if (stage && beats.length) (function () {
    var scenes = {};
    [].slice.call(stage.querySelectorAll('.scene')).forEach(function (g) { scenes[g.getAttribute('data-scene')] = g; });
    var whoEl = document.getElementById('stage-who');
    var textEl = document.getElementById('stage-text');
    var dots = [].slice.call(stage.querySelectorAll('.stage-dots button'));
    var mqStory = null;
    try { mqStory = matchMedia('(max-width: 980px)'); } catch (e) {}
    var current = -1, typeTimer = null, seenOnce = false, visible = false;

    // Nothing animates until the story is first on screen.
    Object.keys(scenes).forEach(function (k) { scenes[k].classList.remove('on', 'closing'); });

    function typeOut(text) {
      clearInterval(typeTimer);
      if (REDUCED) { textEl.textContent = text; return; }
      var i = 0, caret = document.createElement('span');
      caret.className = 'caret';
      textEl.textContent = '';
      textEl.appendChild(caret);
      typeTimer = setInterval(function () {
        i = Math.min(text.length, i + 2);
        textEl.textContent = text.slice(0, i);
        if (i < text.length) textEl.appendChild(caret); else clearInterval(typeTimer);
      }, 24);
    }

    function show(i) {
      if (i === current) return;
      current = i;
      var b = beats[i], name = b.getAttribute('data-scene'), closing = b.hasAttribute('data-closing');
      Object.keys(scenes).forEach(function (k) {
        var g = scenes[k];
        if (k === name) {
          g.classList.remove('on');
          g.classList.toggle('closing', closing);
          void g.getBoundingClientRect();      // restart the scene's timeline
          g.classList.add('on');
        } else {
          g.classList.remove('on', 'closing');
        }
      });
      beats.forEach(function (x, n) { x.classList.toggle('is-on', n === i); });
      dots.forEach(function (d, n) {
        if (n === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      whoEl.textContent = b.getAttribute('data-who') || '';
      typeOut(b.getAttribute('data-q') || '');
    }

    /* The reading line: 55% down the window on wide screens; on phones,
       a third of the way into the space left below the sticky stage. */
    function line() {
      if (mqStory && mqStory.matches) {
        var sb = stage.getBoundingClientRect().bottom;
        return sb + (window.innerHeight - sb) * 0.3;
      }
      return window.innerHeight * 0.55;
    }

    storyTick = function () {
      if (!seenOnce) return;
      var l = line(), idx = 0;
      for (var n = 0; n < beats.length; n++) if (beats[n].getBoundingClientRect().top <= l) idx = n;
      show(idx);
    };

    dots.forEach(function (d, n) {
      d.addEventListener('click', function () {
        var mobile = mqStory && mqStory.matches;
        var offset = mobile ? stage.getBoundingClientRect().bottom + 24 : window.innerHeight * 0.3;
        var y = beats[n].getBoundingClientRect().top + window.pageYOffset - offset;
        try { window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, y); }
      });
    });

    var story = document.getElementById('story');
    if ('IntersectionObserver' in window && story) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        stage.classList.toggle('paused', !visible);
        if (visible && !seenOnce) { seenOnce = true; storyTick(); }
      }, { threshold: 0 }).observe(story);   // any pixel: the section is far taller than the window
    } else {
      seenOnce = true; storyTick();
    }
    if (mqStory) {
      var onStoryMq = function () { storyTick(); };
      if (mqStory.addEventListener) mqStory.addEventListener('change', onStoryMq); else mqStory.addListener(onStoryMq);
    }
  })();

  /* ==================================================================
     14. POLISH — the finishing layer.  §4.16
     The headline sets itself word by word as the intro clears; the floor
     plan behind the hero pauses off screen; the header's edge shows how
     far you've read; section headings get their strip of tape on arrival;
     a spreadsheet-style cursor follows the project you point at; the green
     buttons lean toward a mouse pointer. All of it stands down under
     reduced motion.
     ================================================================== */
  var heroEl = document.querySelector('.hero');
  var display = document.querySelector('.hero .display');
  if (display && heroEl) {
    // Wrap each word: <span class="w"><span class="wi">word</span></span>.
    // Text nodes only, so entities and the <br>-free headline stay intact.
    var words = display.textContent.trim().split(/\s+/);
    display.setAttribute('aria-label', display.textContent.trim());
    display.innerHTML = words.map(function (w, i) {
      return '<span class="w" aria-hidden="true"><span class="wi" style="--i:' + i + '">' +
        w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></span>';
    }).join(' ');
    var reveal = function () {
      requestAnimationFrame(function () { display.classList.add('revealed'); heroEl.classList.add('revealed'); });
    };
    if (REDUCED) { display.classList.add('revealed'); heroEl.classList.add('revealed'); }
    else whenIntroDone(function () { setTimeout(reveal, 120); });
  }

  var plan = document.getElementById('hero-plan');
  if (plan && plan.pauseAnimations) {
    if (REDUCED) {
      try { plan.setCurrentTime(15.6); plan.pauseAnimations(); } catch (e) {}
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        try { if (es[0].isIntersecting && !document.hidden) plan.unpauseAnimations(); else plan.pauseAnimations(); } catch (e) {}
      }).observe(plan);
      document.addEventListener('visibilitychange', function () {
        try { if (document.hidden) plan.pauseAnimations(); else plan.unpauseAnimations(); } catch (e) {}
      });
    }
  }

  function readProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    root.style.setProperty('--read', max > 0 ? clamp(window.pageYOffset / max, 0, 1).toFixed(4) : '0');
  }

  var bands = [].slice.call(document.querySelectorAll('.band'));
  if (bands.length && 'IntersectionObserver' in window) {
    var bandIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in-view'); bandIO.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -18% 0px' });
    bands.forEach(function (b) { bandIO.observe(b); });
  } else bands.forEach(function (b) { b.classList.add('in-view'); });

  var finePointer = false;
  try { finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}

  var ledger = document.querySelector('.ledger');
  if (ledger && finePointer) {
    var cursor = document.createElement('span');
    cursor.className = 'ledger-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    ledger.insertBefore(cursor, ledger.firstChild);
    var moveTo = function (li) {
      ledger.style.setProperty('--cy', li.offsetTop + 'px');
      ledger.style.setProperty('--ch', li.offsetHeight + 'px');
      ledger.classList.add('has-cursor');
    };
    [].slice.call(ledger.querySelectorAll('li')).forEach(function (li) {
      li.addEventListener('pointerenter', function () { moveTo(li); });
      li.addEventListener('focusin', function () { moveTo(li); });
    });
    ledger.addEventListener('pointerleave', function () { ledger.classList.remove('has-cursor'); });
    ledger.addEventListener('focusout', function (e) { if (!ledger.contains(e.relatedTarget)) ledger.classList.remove('has-cursor'); });
  }

  if (finePointer && !REDUCED) {
    [].slice.call(document.querySelectorAll('.hero .cta .btn, .resume-get .btn, .beat-end .btn')).forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        btn.style.translate = (clamp(dx, -1, 1) * 5).toFixed(1) + 'px ' + (clamp(dy, -1, 1) * 3).toFixed(1) + 'px';
      });
      btn.addEventListener('pointerleave', function () { btn.style.translate = ''; });
    });
  }

  /* --- batch 2: tilt, odometer, footer --- */
  var heroSheet = document.querySelector('.hero .sheet');
  if (heroSheet && finePointer && !REDUCED) {
    heroSheet.addEventListener('pointermove', function (e) {
      var r = heroSheet.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      heroSheet.style.setProperty('--ry', ((px - .5) * 5).toFixed(2) + 'deg');
      heroSheet.style.setProperty('--rx', ((.5 - py) * 4).toFixed(2) + 'deg');
      heroSheet.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      heroSheet.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      heroSheet.classList.add('tilting');
    });
    heroSheet.addEventListener('pointerleave', function () {
      heroSheet.classList.remove('tilting');
      heroSheet.style.setProperty('--rx', '0deg'); heroSheet.style.setProperty('--ry', '0deg');
    });
  }

  var ftr = document.querySelector('.ftr');
  if (ftr) {
    if ('IntersectionObserver' in window) {
      var ftrIO = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { ftr.classList.add('in-view'); ftrIO.disconnect(); }
      }, { threshold: 0.25 });
      ftrIO.observe(ftr);
    } else ftr.classList.add('in-view');
  }

  /* ==================================================================
     15. WORD BUBBLES and the plain-English dictionary.  §4.17
     #words is the one source. Each entry's data-m is a pattern; the first
     match inside each block of text below becomes a highlighted word.
     Click or tap it (or Enter / Space) and a comic-style speech bubble
     shows the entry. Esc, the ×, or a click anywhere else closes it.
     The highlight sweeps in the first time a word scrolls into view.
     ================================================================== */
  (function () {
    var dict = document.getElementById('words-list');
    if (!dict || !document.createTreeWalker) return;

    var items = [].slice.call(dict.querySelectorAll('.w-item'));
    var byId = {};
    var entries = items.map(function (el) {
      var src = el.getAttribute('data-m');
      if (!src) return null;
      try {
        var e = {
          id: el.id,
          re: new RegExp('(^|[^A-Za-z0-9])(' + src + ')(?![A-Za-z0-9])', el.hasAttribute('data-i') ? 'i' : ''),
          term: el.querySelector('dt').textContent,
          def: el.querySelector('dd').textContent
        };
        byId[e.id] = e;
        return e;
      } catch (err) { return null; }
    }).filter(Boolean);

    /* Where words get highlighted. Each block is its own scope, so a word
       is marked once per answer, card or job, not once per page. */
    var SCOPES = '.hero .lede, #beats > li, .bring > li, #resume .summary, #resume .job, ' +
                 '#resume .skills > div, #resume .edu, #lab .band-lede, #projects .band-lede, #projects .pc-what';
    var SKIP = 'a, button, input, textarea, select, label, h1, h2, h3, h4, svg, code, .term, .vh, .beat-n';
    var terms = [];

    [].forEach.call(document.querySelectorAll(SCOPES), function (scope) {
      var used = {};
      var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null, false);
      var nodes = [];
      while (walker.nextNode()) {
        var p = walker.currentNode.parentElement;
        if (p && !p.closest(SKIP)) nodes.push(walker.currentNode);
      }
      nodes.forEach(function (node) {
        for (var guard = 0; node && guard < 25; guard++) {
          var text = node.nodeValue, best = null;
          entries.forEach(function (e) {
            if (used[e.id]) return;
            var m = e.re.exec(text);
            if (m) {
              var at = m.index + m[1].length;
              if (!best || at < best.at) best = { at: at, len: m[2].length, e: e };
            }
          });
          if (!best) break;
          used[best.e.id] = true;
          var mid = node.splitText(best.at);
          var after = mid.splitText(best.len);
          var t = document.createElement('span');
          t.className = 'term';
          t.setAttribute('role', 'button');
          t.setAttribute('tabindex', '0');
          t.setAttribute('aria-haspopup', 'dialog');
          t.setAttribute('aria-expanded', 'false');
          t.setAttribute('data-w', best.e.id);
          t.textContent = mid.nodeValue;
          mid.parentNode.replaceChild(t, mid);
          terms.push(t);
          node = after;
        }
      });
    });

    /* ---- the bubble: one element, moved to whichever word was tapped */
    var bub = document.createElement('div');
    bub.className = 'bubble';
    bub.id = 'word-bubble';
    bub.hidden = true;
    bub.setAttribute('role', 'dialog');
    bub.setAttribute('aria-labelledby', 'word-bubble-h');
    bub.innerHTML = '<button type="button" class="bubble-x" aria-label="Close">&times;</button>' +
      '<p class="bubble-h" id="word-bubble-h"></p><p class="bubble-b" id="word-bubble-b"></p>' +
      '<a class="bubble-more" href="#words">See all the words</a>';
    bub.setAttribute('aria-describedby', 'word-bubble-b');
    document.body.appendChild(bub);
    var bH = bub.querySelector('.bubble-h'), bB = bub.querySelector('.bubble-b'), bMore = bub.querySelector('.bubble-more');
    var openT = null;

    function place(t) {
      var rects = t.getClientRects();
      var r = rects.length ? rects[0] : t.getBoundingClientRect();   // a word can wrap; aim at its first line
      var vw = document.documentElement.clientWidth;
      var w = Math.min(320, vw - 24);
      bub.style.width = w + 'px';
      var left = clamp(r.left + r.width / 2 - w / 2, 12, vw - w - 12);
      var h = bub.offsetHeight;
      var above = r.top - h - 18 > hdrH + 8;
      var y = above ? r.top - h - 16 : r.bottom + 16;
      bub.style.left = Math.round(left + window.pageXOffset) + 'px';
      bub.style.top = Math.round(y + window.pageYOffset) + 'px';
      bub.style.setProperty('--tail', Math.round(clamp(r.left + r.width / 2 - left, 24, w - 24)) + 'px');
      bub.classList.toggle('below', !above);
    }
    function openBubble(t) {
      var e = byId[t.getAttribute('data-w')];
      if (!e) return;
      if (openT) openT.setAttribute('aria-expanded', 'false');
      openT = t;
      bH.textContent = e.term;
      bB.textContent = e.def;
      bMore.setAttribute('href', '#' + e.id);
      bub.hidden = false;
      place(t);
      t.setAttribute('aria-expanded', 'true');
      bub.classList.remove('pop'); void bub.offsetWidth; bub.classList.add('pop');
    }
    function closeBubble(focusBack) {
      if (!openT) return;
      var t = openT;
      openT = null;
      bub.hidden = true;
      t.setAttribute('aria-expanded', 'false');
      if (focusBack) t.focus();
    }
    function toggle(t) { if (openT === t) closeBubble(); else openBubble(t); }

    terms.forEach(function (t) {
      t.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(t); });
      t.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); toggle(t); }
      });
    });
    bub.addEventListener('click', function (ev) { ev.stopPropagation(); });
    bub.querySelector('.bubble-x').addEventListener('click', function () { closeBubble(true); });
    bMore.addEventListener('click', function () { closeBubble(); clearFind(); });
    document.addEventListener('click', function () { closeBubble(); });
    document.addEventListener('keydown', function (ev) { if ((ev.key === 'Escape' || ev.key === 'Esc') && openT) closeBubble(true); });
    window.addEventListener('resize', function () { if (openT) place(openT); });

    /* ---- the highlighter sweep, once per word */
    if ('IntersectionObserver' in window && !REDUCED) {
      var termIO = new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          if (x.isIntersecting) { x.target.classList.add('lit'); termIO.unobserve(x.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px' });
      terms.forEach(function (t) { termIO.observe(t); });
    } else {
      terms.forEach(function (t) { t.classList.add('lit'); });
    }

    /* ---- find a word in the dictionary */
    var q = document.getElementById('words-q'), none = document.getElementById('words-none');
    function filter() {
      var s = q.value.trim().toLowerCase(), n = 0;
      items.forEach(function (it) {
        var hit = !s || it.textContent.toLowerCase().indexOf(s) !== -1;
        it.hidden = !hit;
        if (hit) n++;
      });
      if (none) none.hidden = n !== 0;
    }
    function clearFind() { if (q && q.value) { q.value = ''; filter(); } }
    if (q) q.addEventListener('input', filter);
    window.addEventListener('hashchange', function () { if (/^#w-/.test(location.hash)) clearFind(); });
  })();

  /* ==================================================================
     16. PROJECTS CAROUSEL  —  TECHNICAL §4.19
     The john.cyou "Selected work" carousel, rebuilt here. The track is a
     native scroll-snap row, so swipe works on every phone; this adds the
     arrows, dots, autoplay (with a pause button), a 3D tilt and a particle
     field on each card. Motion is read live from html.no-motion (the switch
     on disclosure.html), not from the OS setting (John, 15 Oct 2026).
     ================================================================== */
  (function () {
    var pc = document.getElementById('pc');
    if (!pc) return;
    var view = pc.querySelector('.pc-view'), track = pc.querySelector('.pc-track');
    var cards = [].slice.call(track.children), N = cards.length;
    if (!N) return;
    var dotsHost = pc.querySelector('.pc-dots'), countEl = pc.querySelector('.pc-count b');
    var playBtn = pc.querySelector('.pc-play'), live = document.getElementById('pc-live');
    var DWELL = 6500;
    var active = 0, userPaused = false, hover = false, focusIn = false, touching = false, onScreen = false, greeted = false;
    var elapsed = 0, last = 0, raf = 0, lockUntil = 0, dots = [], dotCount = -1;
    function moving() { return !root.classList.contains('no-motion'); }
    function autoOn() { return moving() && !userPaused; }
    function held() { return hover || focusIn || touching || !onScreen || document.hidden; }

    /* ---- geometry: one step = one card plus the gap */
    function gapPx() { return parseFloat(getComputedStyle(track).columnGap) || 0; }
    function step() { return cards[0].offsetWidth + gapPx(); }
    function perView() { return Math.max(1, Math.floor((view.clientWidth + gapPx() + 2) / step())); }
    function maxIndex() { return Math.max(0, N - perView()); }
    function leftOf(i) { return cards[i].offsetLeft - cards[0].offsetLeft; }
    function indexFromScroll() { return Math.max(0, Math.min(maxIndex(), Math.round(view.scrollLeft / step()))); }

    /* ---- dots: one per stop (two cards show at once on wide screens) */
    function buildDots() {
      if (!dotsHost) return;
      var n = maxIndex() + 1;
      if (n === dotCount) return;
      dotCount = n; dots = [];
      while (dotsHost.firstChild) dotsHost.removeChild(dotsHost.firstChild);
      for (var i = 0; i < n; i++) (function (i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'pc-dot';
        b.setAttribute('aria-label', 'Show project ' + (i + 1) + ': ' + cards[i].getAttribute('data-name'));
        b.appendChild(document.createElement('span'));
        b.addEventListener('click', function () { go(i, true); });
        dotsHost.appendChild(b); dots.push(b);
      })(i);
    }
    function paintDots() {
      dots.forEach(function (d, i) {
        d.setAttribute('aria-current', i === active ? 'true' : 'false');
        d.classList.toggle('is-timed', i === active && autoOn());
        if (i !== active || !autoOn()) d.firstChild.style.removeProperty('--p');
      });
      if (countEl) countEl.textContent = String(active + 1);
    }

    /* ---- particles: a soft field drifting up, pushed by the pointer, and a
       burst of sparks from the logo when a card arrives. One canvas per
       card, drawn only while that card is on screen. */
    var DPR = Math.min(window.devicePixelRatio || 1, 2), sprites = {};
    function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
    function sprite(col) {
      if (sprites[col]) return sprites[col];
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(0.2, rgba(col, .9));
      r.addColorStop(0.5, rgba(col, .28)); r.addColorStop(1, rgba(col, 0));
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      return (sprites[col] = c);
    }
    var FX = cards.map(function (card) {
      var cv = card.querySelector('.pc-fx'), cs = getComputedStyle(card);
      var cols = ['--pc-acc', '--pc-acc2', '--pc-acc3'].map(function (v) { return cs.getPropertyValue(v).trim(); })
                 .filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });
      var ctx = null;
      try { ctx = cv && cv.getContext('2d'); } catch (e) {}
      return { card: card, cv: cv, ctx: ctx, cols: cols.length ? cols : ['#ffffff'], w: 0, h: 0, ps: [], sparks: [], vis: false, mx: -1e4, my: -1e4 };
    });
    function spawn(f, anywhere) {
      return { x: Math.random() * f.w, y: anywhere ? Math.random() * f.h : f.h + 12, vy: .12 + Math.random() * .36,
               sw: .4 + Math.random() * .9, ph: Math.random() * 6.283, s: 3 + Math.random() * 8, a: .22 + Math.random() * .45,
               c: f.cols[(Math.random() * f.cols.length) | 0], dx: 0, dy: 0 };
    }
    function size(f) {
      if (!f.ctx) return;
      var w = f.card.offsetWidth, h = f.card.offsetHeight;
      if (w === f.w && h === f.h) return;
      f.w = w; f.h = h; f.cv.width = Math.round(w * DPR); f.cv.height = Math.round(h * DPR);
      var want = Math.round(Math.min(44, Math.max(16, w * h / 9500)));
      f.ps = [];
      for (var i = 0; i < want; i++) f.ps.push(spawn(f, true));
    }
    function draw(f, t, k) {
      var g = f.ctx;
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.clearRect(0, 0, f.w, f.h);
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < f.ps.length; i++) {
        var p = f.ps[i];
        p.y -= p.vy * k;
        p.x += Math.sin(t * .0007 * p.sw + p.ph) * .22 * k;
        var dx = p.x - f.mx, dy = p.y - f.my, d2 = dx * dx + dy * dy;
        if (d2 < 9025) { var d = Math.sqrt(d2) || 1, push = (95 - d) / 95 * 1.4 * k; p.dx += dx / d * push; p.dy += dy / d * push; }
        p.dx *= .9; p.dy *= .9; p.x += p.dx; p.y += p.dy;
        if (p.y < -14 || p.x < -24 || p.x > f.w + 24) { f.ps[i] = spawn(f, false); continue; }
        g.globalAlpha = p.a * (.55 + .45 * Math.sin(t * .0022 + p.ph * 3));
        g.drawImage(sprite(p.c), p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
      }
      for (var j = f.sparks.length - 1; j >= 0; j--) {
        var s = f.sparks[j], fr = Math.pow(.94, k);
        s.x += s.vx * k; s.y += s.vy * k; s.vx *= fr; s.vy = s.vy * fr + .035 * k; s.life -= k;
        if (s.life <= 0) { f.sparks.splice(j, 1); continue; }
        g.globalAlpha = Math.min(1, s.life / 28) * .95;
        g.drawImage(sprite(s.c), s.x - s.s, s.y - s.s, s.s * 2, s.s * 2);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    function burst(f) {
      if (!f || !f.ctx || !moving()) return;
      var logo = f.card.querySelector('.pc-logo');
      var cx = logo ? logo.offsetLeft + logo.offsetWidth / 2 : f.w / 2, cy = logo ? logo.offsetTop + logo.offsetHeight / 2 : f.h / 2;
      for (var i = 0; i < 28; i++) {
        var a = Math.random() * 6.283, v = 1.2 + Math.random() * 3.4;
        f.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .7, s: 2 + Math.random() * 5,
                        c: f.cols[(Math.random() * f.cols.length) | 0], life: 38 + Math.random() * 42 });
      }
    }
    function wake(i) {
      var c = cards[i];
      if (!c || !moving()) return;
      c.classList.remove('wake'); void c.offsetWidth; c.classList.add('wake');
      burst(FX[i]);
    }

    /* ---- moving between cards */
    function setActive(i, user) {
      var pv = perView(), was = active;
      active = i; elapsed = 0;
      for (var k = i; k < Math.min(N, i + pv); k++) if (k < was || k >= was + pv) wake(k);
      paintDots();
      if (user && live) live.textContent = 'Project ' + (i + 1) + ' of ' + N + ': ' + cards[i].getAttribute('data-name');
    }
    function go(i, user) {
      var max = maxIndex(), wrap = false;
      if (i > max) { i = 0; wrap = true; } else if (i < 0) { i = max; wrap = true; }
      lockUntil = performance.now() + 900;
      if (wrap && moving()) {
        track.classList.add('pc-fade');
        setTimeout(function () { view.scrollLeft = leftOf(i); track.classList.remove('pc-fade'); }, 230);
      } else {
        try { view.scrollTo({ left: leftOf(i), behavior: moving() ? 'smooth' : 'auto' }); } catch (e) { view.scrollLeft = leftOf(i); }
      }
      setActive(i, user);
      kick();
    }
    [].forEach.call(pc.querySelectorAll('.pc-prev'), function (b) { b.addEventListener('click', function () { go(active - 1, true); }); });
    [].forEach.call(pc.querySelectorAll('.pc-next'), function (b) { b.addEventListener('click', function () { go(active + 1, true); }); });
    pc.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1, true); }
    });
    var sTick = 0;
    function syncFromScroll() { var i = indexFromScroll(); if (i !== active) setActive(i, false); }
    view.addEventListener('scroll', function () {
      if (sTick || performance.now() < lockUntil) return;
      sTick = requestAnimationFrame(function () { sTick = 0; syncFromScroll(); });
    }, { passive: true });
    view.addEventListener('scrollend', function () { lockUntil = 0; syncFromScroll(); });

    /* ---- autoplay holds while you point at it, focus it, touch it, or look away */
    /* Desktop fix (16 Oct 2026, Brave): a resting mouse pointer used to hold the
       slideshow forever, because on a desktop the pointer usually sits over the
       big carousel while you scroll with the wheel. Now it only holds while the
       mouse is actually moving over it (2.5 s), and focus only holds it for
       keyboard users, not after a mouse click on an arrow. */
    var hoverT = 0;
    pc.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      hover = true; clearTimeout(hoverT);
      hoverT = setTimeout(function () { hover = false; }, 2500);
    });
    pc.addEventListener('pointerleave', function () { hover = false; clearTimeout(hoverT); });
    pc.addEventListener('focusin', function (e) {
      var kb = false; try { kb = e.target.matches(':focus-visible'); } catch (x) {}
      focusIn = kb;
    });
    pc.addEventListener('focusout', function (e) { if (!pc.contains(e.relatedTarget)) focusIn = false; });
    view.addEventListener('touchstart', function () { touching = true; }, { passive: true });
    view.addEventListener('touchend', function () { touching = false; elapsed = 0; }, { passive: true });
    view.addEventListener('touchcancel', function () { touching = false; }, { passive: true });
    if (playBtn) playBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      playBtn.classList.toggle('is-paused', userPaused);
      playBtn.setAttribute('aria-label', userPaused ? 'Play the slideshow' : 'Pause the slideshow');
      elapsed = 0; paintDots(); kick();
    });
    document.addEventListener('visibilitychange', kick);

    /* ---- the whole card is clickable (16 Oct 2026): a click anywhere on it
       follows its link. Keyboard users still tab to the link itself.
       Ctrl/Cmd-click and middle-click open a new tab. Selecting text doesn't. */
    cards.forEach(function (card) {
      var link = card.querySelector('a.pc-visit[href]');
      if (!link) return;
      card.classList.add('pc-click');
      function follow(e, newTab) {
        if (e.target.closest('a, button')) return;
        var sel = window.getSelection && String(window.getSelection());
        if (sel) return;
        var href = link.getAttribute('href');
        /* project sites and the villager page open in a new tab (16 Oct 2026, John);
           the two "jump" links stay on this page */
        if (href.charAt(0) === '#') { link.click(); return; }
        window.open(link.href, '_blank', 'noopener');
      }
      card.addEventListener('click', function (e) { follow(e, false); });
      card.addEventListener('auxclick', function (e) { if (e.button === 1) follow(e, true); });
    });

    /* ---- tilt and spotlight follow the pointer */
    cards.forEach(function (card, i) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        FX[i].mx = x; FX[i].my = y;
        card.style.setProperty('--mx', x.toFixed(0) + 'px'); card.style.setProperty('--my', y.toFixed(0) + 'px');
        if (finePointer && moving()) {
          card.style.setProperty('--ry', ((x / r.width - .5) * 7).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((.5 - y / r.height) * 5).toFixed(2) + 'deg');
        }
      });
      card.addEventListener('pointerleave', function () {
        FX[i].mx = FX[i].my = -1e4;
        card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
      });
    });

    /* ---- one loop: the autoplay clock and the particles */
    function frame(t) {
      raf = 0;
      if (!onScreen || document.hidden || !moving()) { last = 0; return; }
      var dt = last ? Math.min(64, t - last) : 16.7, k = dt / 16.67;
      last = t;
      if (autoOn() && !held()) {
        elapsed += dt;
        var d = dots[active];
        if (d) d.firstChild.style.setProperty('--p', Math.min(1, elapsed / DWELL).toFixed(4));
        if (elapsed >= DWELL) go(active + 1, false);
      }
      for (var i = 0; i < FX.length; i++) if (FX[i].vis && FX[i].ctx) draw(FX[i], t, k);
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && onScreen && !document.hidden && moving()) { last = 0; raf = requestAnimationFrame(frame); } }

    if ('IntersectionObserver' in window) {
      var cardIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var f = FX[cards.indexOf(e.target)];
          f.vis = e.isIntersecting;
          if (f.vis) size(f);
          else if (f.ctx) { f.sparks = []; f.ctx.clearRect(0, 0, f.cv.width, f.cv.height); }
        });
      }, { root: view, threshold: 0.02 });
      cards.forEach(function (c) { cardIO.observe(c); });
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        if (onScreen && !greeted) {
          greeted = true;
          for (var k = 0; k < Math.min(N, perView()); k++) wake(k);
        }
        kick();
      }, { threshold: 0.18 }).observe(pc);
    } else { onScreen = true; FX.forEach(function (f) { f.vis = true; size(f); }); kick(); }

    window.addEventListener('resize', function () {
      buildDots();
      if (active > maxIndex()) active = maxIndex();
      view.scrollLeft = leftOf(active);
      paintDots();
      FX.forEach(function (f) { if (f.vis) size(f); });
    });

    buildDots(); paintDots();
    pc.classList.add('pc-ready');
  })();

  /* ==================================================================
     12. ONE SCROLL LOOP — section marker, feed holes and the story share one
     requestAnimationFrame per frame, however fast the scroll events come.
     ================================================================== */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; spy(); feed(); storyTick(); readProgress(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { onScroll(); moveInk(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { publishHeader(); moveInk(); });
  onScroll();
})();
