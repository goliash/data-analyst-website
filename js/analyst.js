/* john.goliash.com — the Data analyst page (TECHNICAL §4.18).
   One engine, two uses:
     1. the villager dashboard: data checks, filters, bar charts, a birthday
        calendar, a random villager, findings and the full table;
     2. "Explore your own data": the same CSV reader, checks and bar chart for
        a file the visitor opens. The file is read by this page only. It is
        never uploaded, stored or saved anywhere.
   No outside code. Every value from a file is written with textContent,
   never innerHTML. */
(function () {
  'use strict';

  var REDUCED = false;
  REDUCED = document.documentElement.classList.contains('no-motion');   // the motion switch, disclosure §2

  /* ================================================================
     0. SMALL HELPERS
     ================================================================ */
  var NF = null, NF1 = null;
  try { NF = new Intl.NumberFormat('en-US'); NF1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }); } catch (e) {}
  function NUM(n) { return NF ? NF.format(n) : String(n); }
  function NUM1(n) { return NF1 ? NF1.format(n) : String(Math.round(n * 10) / 10); }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '0%'; }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  /* "NaN" only in that exact spelling: one villager is really called Nan. */
  var MISSING = /^\s*(|na|n\/a|null|none|-|\u2014)\s*$/i;
  function isMissing(v) { return v === undefined || v === null || MISSING.test(String(v)) || /^\s*NaN\s*$/.test(String(v)); }
  function countBy(rows, fn) {
    var m = {};
    rows.forEach(function (r) { var k = fn(r); if (k === null || k === undefined) return; m[k] = (m[k] || 0) + 1; });
    return m;
  }
  function entries(m) { return Object.keys(m).map(function (k) { return [k, m[k]]; }); }
  function byCount(a, b) { return b[1] - a[1] || String(a[0]).localeCompare(String(b[0])); }
  function niceCeil(v) {
    if (v <= 5) return Math.max(1, Math.ceil(v));
    var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * p;
  }

  /* ================================================================
     1. CSV READER — commas, tabs or semicolons; quoted cells; CRLF.
     ================================================================ */
  function sniff(text) {
    var line = '', i = 0;
    while (i < text.length && !line.trim()) { var j = text.indexOf('\n', i); if (j < 0) j = text.length; line = text.slice(i, j); i = j + 1; }
    var best = ',', bestN = -1, q = false, counts = { ',': 0, '\t': 0, ';': 0 };
    for (var k = 0; k < line.length; k++) {
      var c = line[k];
      if (c === '"') q = !q;
      else if (!q && counts.hasOwnProperty(c)) counts[c]++;
    }
    Object.keys(counts).forEach(function (d) { if (counts[d] > bestN) { best = d; bestN = counts[d]; } });
    return best;
  }

  function readCSV(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var d = sniff(text), rows = [], row = [], cell = '', q = false, i = 0, c;
    for (; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"' && cell === '') { q = true; }
      else if (c === d) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
    if (!rows.length) return { headers: [], rows: [], ragged: 0, delimiter: d };

    var seen = {};
    var headers = rows.shift().map(function (h, k) {
      h = String(h).trim() || 'Column ' + (k + 1);
      var base = h, n = 2;
      while (seen[h.toLowerCase()]) h = base + ' (' + (n++) + ')';
      seen[h.toLowerCase()] = true;
      return h;
    });
    var ragged = 0, w = headers.length;
    rows = rows.map(function (r) {
      if (r.length !== w) {
        ragged++;
        if (r.length > w) r = r.slice(0, w); else while (r.length < w) r.push('');
      }
      return r.map(function (v) { return String(v).trim(); });
    });
    return { headers: headers, rows: rows, ragged: ragged, delimiter: d };
  }

  /* ================================================================
     2. PROFILE AND CHECKS — what an analyst looks at first.
     ================================================================ */
  var NUM_RE = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][-+]?\d+)?$/;
  function toNumber(s) {
    s = String(s).trim();
    var neg = /^\(.*\)$/.test(s);
    if (neg) s = s.slice(1, -1);
    s = s.replace(/^[$\u20ac\u00a3]/, '').replace(/%$/, '').replace(/^[-+]?[$]/, function (m) { return m.replace('$', ''); });
    if (!s || !NUM_RE.test(s) || !/\d/.test(s)) return NaN;
    var n = parseFloat(s.replace(/,/g, ''));
    return neg ? -n : n;
  }
  function toDate(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s) || null, y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) { mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    else return null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y: y, m: mo, d: d };
  }

  function profile(t) {
    var cols = t.headers.map(function (h, i) {
      var filled = 0, missing = 0, naText = 0, nums = 0, dates = 0, set = {}, distinct = 0, first = [];
      var sum = 0, min = Infinity, max = -Infinity;
      t.rows.forEach(function (r) {
        var v = r[i];
        if (isMissing(v)) { missing++; if (v && v.trim()) naText++; return; }
        filled++;
        if (!set.hasOwnProperty(v)) { set[v] = 0; distinct++; if (first.length < 3) first.push(v); }
        set[v]++;
        var n = toNumber(v);
        if (!isNaN(n)) { nums++; sum += n; if (n < min) min = n; if (n > max) max = n; }
        if (toDate(v)) dates++;
      });
      var type = 'text';
      if (filled && nums / filled >= 0.8) type = 'number';
      else if (filled && dates / filled >= 0.8) type = 'date';
      return {
        name: h, index: i, filled: filled, missing: missing, naText: naText, distinct: distinct,
        values: set, examples: first, type: type,
        offType: type === 'number' ? filled - nums : type === 'date' ? filled - dates : 0,
        sum: sum, min: min, max: max
      };
    });
    var keys = {}, dupes = 0;
    t.rows.forEach(function (r) { var k = r.join('\u0001'); if (keys[k]) dupes++; else keys[k] = 1; });
    return { rows: t.rows.length, cols: cols, dupes: dupes, ragged: t.ragged || 0 };
  }

  function checksFor(p) {
    var out = [];
    out.push({ s: 'ok', t: NUM(p.rows) + ' ' + plural(p.rows, 'row', 'rows') + ' and ' + p.cols.length + ' ' + plural(p.cols.length, 'column', 'columns') + ' read.' });
    out.push(p.dupes ? { s: 'warn', t: NUM(p.dupes) + ' ' + plural(p.dupes, 'row is an exact copy', 'rows are exact copies') + ' of another row. Worth asking why before you count anything.' }
                     : { s: 'ok', t: 'No duplicate rows.' });
    if (p.ragged) out.push({ s: 'warn', t: NUM(p.ragged) + ' ' + plural(p.ragged, 'row had', 'rows had') + ' a different number of cells than the header. Short rows were padded with blanks; long rows were cut to fit.' });
    var holes = p.cols.filter(function (c) { return c.missing; });
    if (!holes.length) out.push({ s: 'ok', t: 'No blank cells anywhere.' });
    holes.forEach(function (c) {
      out.push({ s: 'warn', t: '\u201c' + c.name + '\u201d has ' + NUM(c.missing) + ' blank ' + plural(c.missing, 'cell', 'cells') +
        (c.naText ? ', including ' + NUM(c.naText) + ' written as text like \u201cNA\u201d' : '') + '. They\u2019re left out of that column\u2019s counts.' });
    });
    p.cols.forEach(function (c) {
      if (c.offType) out.push({ s: 'warn', t: '\u201c' + c.name + '\u201d is mostly ' + (c.type === 'number' ? 'numbers' : 'dates') + ', but ' + NUM(c.offType) + ' ' + plural(c.offType, 'value isn\u2019t', 'values aren\u2019t') + '. Check them before you add this column up.' });
    });
    var unique = p.cols.filter(function (c) { return c.filled === p.rows && c.distinct === p.rows && p.rows > 1; });
    if (unique.length) out.push({ s: 'info', t: '\u201c' + unique[0].name + '\u201d is different on every row, so it can serve as an ID.' });
    return out;
  }

  function renderChecks(host, list) {
    clear(host);
    list.forEach(function (c) {
      var li = el('li', 'da-check is-' + c.s);
      var ico = el('span', 'da-check-ico', c.s === 'ok' ? '\u2713' : c.s === 'warn' ? '!' : 'i');
      ico.setAttribute('aria-hidden', 'true');
      var label = el('span', 'vh', c.s === 'ok' ? 'Passed: ' : c.s === 'warn' ? 'Look at this: ' : 'Note: ');
      li.appendChild(ico); li.appendChild(label); li.appendChild(el('span', null, c.t));
      host.appendChild(li);
    });
  }

  /* ================================================================
     3. TOOLTIP — one for the page. It repeats what a mark shows;
     every value is also printed on the chart or in its table view.
     ================================================================ */
  var tipEl = el('div', 'da-tip');
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  var tipV = el('strong', 'da-tip-v'), tipL = el('span', 'da-tip-l'), tipX = el('span', 'da-tip-x');
  var tipKey = el('i', 'da-tip-k');
  tipEl.appendChild(tipKey); tipEl.appendChild(tipV); tipEl.appendChild(tipL); tipEl.appendChild(tipX);
  document.body.appendChild(tipEl);
  function showTip(target, data) {
    var d = data();
    tipV.textContent = d[0]; tipL.textContent = d[1]; tipX.textContent = d[3] || '';
    tipX.hidden = !d[3];
    tipKey.className = 'da-tip-k ' + (d[2] || 'c1');
    tipEl.hidden = false;
    var r = target.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    var y = r.top - h - 8;
    if (y < 70) y = r.bottom + 8;
    tipEl.style.left = Math.round(x + window.pageXOffset) + 'px';
    tipEl.style.top = Math.round(y + window.pageYOffset) + 'px';
  }
  function hideTip() { tipEl.hidden = true; }
  function tip(node, data) {
    node.addEventListener('pointerenter', function () { showTip(node, data); });
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', function () { showTip(node, data); });
    node.addEventListener('blur', hideTip);
  }
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ================================================================
     4. BAR CHARTS — thin bars, 4px rounded ends, one baseline,
     the site's three colours (css/analyst.css: --c1 --c2 --c3).
     ================================================================ */
  function grow(list, prop) {
    list.forEach(function (b) { b[0].style[prop] = REDUCED ? (b[1] * 100) + '%' : '0%'; });
    if (REDUCED) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      list.forEach(function (b) { b[0].style[prop] = (b[1] * 100) + '%'; });
    }); });
  }

  function tableView(head, rows) {
    var det = el('details', 'da-tv');
    det.appendChild(el('summary', null, 'Show as a table'));
    var wrap = el('div', 'da-table-wrap'), tbl = el('table', 'da-table');
    var thead = el('thead'), tr = el('tr');
    head.forEach(function (h) { tr.appendChild(el('th', null, h)); });
    thead.appendChild(tr); tbl.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var row = el('tr');
      r.forEach(function (v, i) { var td = el('td', i ? 'num' : null, v); row.appendChild(td); });
      tb.appendChild(row);
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); det.appendChild(wrap);
    return det;
  }

  /* items: [{ key, label, pic: () => node, value, color: 'c1'|'c2'|'c3', extra }]
     o: { fmt, onPick(key), selected, total, of, unit, head, empty } */
  function hbars(host, items, o) {
    o = o || {};
    clear(host);
    if (!items.length) { host.appendChild(el('p', 'da-empty', o.empty || 'Nothing to show for these filters.')); return; }
    var fmt = o.fmt || NUM;
    var max = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    var total = o.total !== undefined ? o.total : items.reduce(function (s, i) { return s + i.value; }, 0);
    var list = el('ul', 'hb' + (o.selected ? ' has-sel' : ''));
    var bars = [];
    items.forEach(function (it) {
      var li = el('li');
      var row = el(o.onPick ? 'button' : 'div', 'hb-row');
      if (o.onPick) {
        row.type = 'button';
        row.setAttribute('aria-pressed', String(o.selected === it.key));
        row.addEventListener('click', function () { hideTip(); o.onPick(it.key); });
      } else row.tabIndex = 0;
      row.setAttribute('aria-label', it.label + ': ' + fmt(it.value) + (o.unit ? ' ' + o.unit : ''));
      var lab = el('span', 'hb-label');
      if (it.pic) lab.appendChild(it.pic());
      if (it.swatch) lab.appendChild(swatch(it.swatch));
      lab.appendChild(document.createTextNode(it.label));
      var track = el('span', 'hb-track'), bar = el('span', 'hb-bar ' + (it.color || 'c1'));
      track.appendChild(bar);
      row.appendChild(lab); row.appendChild(track); row.appendChild(el('span', 'hb-val', fmt(it.value)));
      row.querySelectorAll('span').forEach(function (s) { s.setAttribute('aria-hidden', 'true'); });
      tip(row, function () {
        return [fmt(it.value) + (o.unit ? ' ' + o.unit : ''),
                it.label + (total && o.share !== false ? ' \u00b7 ' + pct(it.value, total) + ' of ' + (o.of || 'the total') : ''),
                it.color || 'c1', it.extra];
      });
      li.appendChild(row); list.appendChild(li);
      bars.push([bar, it.value / max]);
    });
    host.appendChild(list);
    grow(bars, 'width');
    host.appendChild(tableView(o.head || ['Item', 'Count'], items.map(function (it) { return [it.label, fmt(it.value)]; })));
  }

  /* Columns: for ordered categories (months, letters, lengths). Value
     labels only on the highest and lowest column; the axis and the
     tooltip carry the rest. */
  function vbars(host, items, o) {
    o = o || {};
    clear(host);
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }));
    if (!(max > 0)) { host.appendChild(el('p', 'da-empty', o.empty || 'Nothing to show for these filters.')); return; }
    var top = niceCeil(max);
    var nonZero = items.filter(function (i) { return i.value > 0; }).map(function (i) { return i.value; });
    var lo = Math.min.apply(null, nonZero);
    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    var wrap = el('div', 'vb-wrap' + (o.selected ? ' has-sel' : ''));
    var axis = el('div', 'vb-axis');
    axis.setAttribute('aria-hidden', 'true');
    [top, top / 2, 0].forEach(function (v) { axis.appendChild(el('span', null, NUM1(v))); });
    var plot = el('div', 'vb');
    plot.style.setProperty('--n', items.length);
    var grid = el('div', 'vb-grid'); grid.setAttribute('aria-hidden', 'true');
    grid.appendChild(el('i')); grid.appendChild(el('i')); grid.appendChild(el('i'));
    plot.appendChild(grid);
    var bars = [], markedHi = false, markedLo = false;
    items.forEach(function (it) {
      var col = el(o.onPick ? 'button' : 'div', 'vb-col');
      if (o.onPick) {
        col.type = 'button';
        col.setAttribute('aria-pressed', String(o.selected === it.key));
        col.addEventListener('click', function () { hideTip(); o.onPick(it.key); });
      } else col.tabIndex = 0;
      col.setAttribute('aria-label', (it.long || it.label) + ': ' + NUM(it.value) + (o.unit ? ' ' + o.unit : ''));
      /* the tallest column wears amber, the site's "look at this" colour */
      var colr = it.color || (o.peak !== false && it.value === max ? 'c3' : 'c1');
      var box = el('span', 'vb-box'), bar = el('span', 'vb-bar ' + colr);
      box.appendChild(bar);
      var showV = (it.value === max && !markedHi) || (it.value === lo && !markedLo && lo !== max);
      if (it.value === max && !markedHi) markedHi = true; else if (it.value === lo && !markedLo) markedLo = true;
      if (showV) { var v = el('span', 'vb-v', NUM(it.value)); bar.appendChild(v); }
      col.appendChild(box);
      col.appendChild(el('span', 'vb-lab', it.label));
      col.querySelectorAll('span').forEach(function (s) { s.setAttribute('aria-hidden', 'true'); });
      tip(col, function () {
        return [NUM(it.value) + (o.unit ? ' ' + o.unit : ''), (it.long || it.label) + (total ? ' \u00b7 ' + pct(it.value, total) : ''), colr, it.value === max ? 'The highest' + (it.extra ? '. ' + it.extra : '') : it.extra];
      });
      plot.appendChild(col);
      bars.push([bar, it.value / top]);
    });
    wrap.appendChild(axis); wrap.appendChild(plot);
    host.appendChild(wrap);
    grow(bars, 'height');
    host.appendChild(tableView(o.head || ['Item', 'Count'], items.map(function (it) { return [it.long || it.label, NUM(it.value)]; })));
  }

  function kpis(host, tiles) {
    clear(host);
    tiles.forEach(function (t) {
      var d = el('div', 'da-kpi');
      d.appendChild(el('p', 'da-kpi-l', t[0]));
      d.appendChild(el('p', 'da-kpi-v', t[1]));
      if (t[2]) d.appendChild(el('p', 'da-kpi-s', t[2]));
      host.appendChild(d);
    });
  }

  /* ================================================================
     5. THE VILLAGERS — three files joined in the browser:
        villagers (Kaggle, the notebook's file), the Nook Market wish
        ranking (a scraped web page, cleaned here) and a fan tier list.
        A second copy of the villagers (TidyTuesday) is only compared.
     ================================================================ */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = MONTHS.map(function (m) { return m.slice(0, 3); });
  var DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var PERS = { cranky: 'Cranky', jock: 'Jock', lazy: 'Lazy', smug: 'Smug', normal: 'Normal', peppy: 'Peppy', snooty: 'Snooty', 'big sister': 'Big sister', uchi: 'Big sister' };
  /* Real pictures, never made-up ones: each villager's own game icon and photo,
     found by the data's Filename column (Admiral is brd06). Files live in
     img/villagers/icon/ and img/villagers/photo/ (TECHNICAL §4.18). */
  var PIC_DIR = 'img/villagers/', FILE_OK = /^[a-z]{3}\d{2}$/;
  function pic(v, kind, cls) {
    var w = el('span', 'vpic ' + (cls || ''));
    w.setAttribute('aria-hidden', 'true');
    function none() { clear(w); w.classList.add('no-pic'); w.textContent = v ? v.name.charAt(0) : '?'; }
    if (!v || !FILE_OK.test(v.file || '')) { none(); return w; }
    var im = el('img');
    im.alt = ''; im.decoding = 'async'; im.loading = 'lazy';
    im.width = im.height = kind === 'photo' ? 256 : 128;
    im.addEventListener('error', none);
    im.src = PIC_DIR + kind + '/' + v.file + '.webp';
    w.appendChild(im);
    return w;
  }
  /* Swatches for the villagers' favourite colours. Decoration beside a
     label, never a data mark: the bars stay in the site's colours. */
  var SWATCH = {
    'Black': '#222', 'Blue': '#3b6fd8', 'Green': '#3a9a4a', 'Red': '#d33c3c', 'Yellow': '#e8c531', 'Purple': '#8a52c8',
    'Pink': '#ee8fbd', 'Light blue': '#8ec9f0', 'White': '#fff', 'Gray': '#9a9a9a', 'Orange': '#ee8a2f', 'Brown': '#8a5a35',
    'Beige': '#e2cfa7', 'Colorful': 'conic-gradient(#d33c3c, #e8c531, #3a9a4a, #3b6fd8, #8a52c8, #d33c3c)'
  };
  var SMALL = 5;   // groups smaller than this get a "read with care" colour
  var PLURAL = { wolf: 'wolves', octopus: 'octopuses', mouse: 'mice', sheep: 'sheep', deer: 'deer', ostrich: 'ostriches' };
  function many(sp) { return PLURAL[sp] || sp + 's'; }
  function persLabel(p) { return PERS[p] || cap(p); }
  function gColor(g) { return g === 'female' ? 'c1' : 'c2'; }
  function dayIndex(m, d) { var n = 0; for (var i = 0; i < m - 1; i++) n += DAYS_IN[i]; return n + d - 1; }   // 0..365, Feb 29 included
  function norm(s) {
    s = String(s || '');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function swatch(name) {
    var s = el('span', 'sw');
    s.setAttribute('aria-hidden', 'true');
    s.style.background = SWATCH[name] || 'transparent';
    return s;
  }
  function avg(list, f) { var s = 0; list.forEach(function (x) { s += f(x); }); return list.length ? s / list.length : 0; }

  var V = null, VP = null;
  if (window.VILLAGERS_CSV && $('dash')) (function () {
    var VT = readCSV(window.VILLAGERS_CSV);
    VP = profile(VT);
    var H = {};
    VT.headers.forEach(function (h, i) { H[h] = i; });
    var MIDX = {}; MON.forEach(function (m, i) { MIDX[m] = i + 1; });
    V = VT.rows.map(function (r) {
      var b = String(r[H.Birthday] || '').split('-');
      return {
        name: r[H.Name], species: r[H.Species].toLowerCase(), gender: r[H.Gender].toLowerCase(),
        personality: r[H.Personality].toLowerCase(), hobby: r[H.Hobby],
        m: MIDX[b[1]] || 0, d: +b[0], phrase: r[H.Catchphrase], song: isMissing(r[H['Favorite Song']]) ? '' : r[H['Favorite Song']],
        style1: r[H['Style 1']], style2: r[H['Style 2']], color1: r[H['Color 1']], color2: r[H['Color 2']],
        file: H.Filename !== undefined ? String(r[H.Filename] || '').trim() : '',
        wish: null, nbScore: null, pop: null, tier: null, tierPos: null
      };
    });
    var byName = {}, byNorm = {};
    V.forEach(function (v) { byName[v.name] = v; byNorm[norm(v.name)] = v; });
    var N = V.length;

    /* ---------- the wish ranking: a copied web page, cleaned here */
    var W = (function () {
      var lines = String(window.WISH_TXT || '').split(/\r?\n/), seen = {}, uniq = [];
      lines.forEach(function (l) { var s = l.trim(); if (s && !seen[s]) { seen[s] = 1; uniq.push(s); } });
      var isUp = function (c) { return c.toUpperCase() === c && c.toLowerCase() !== c; };
      var nb = uniq.filter(function (s) { return isUp(s.charAt(0)) && s !== 'Not in stock'; });   // the notebook's rule
      var names = uniq.filter(function (s) { return byName[s]; });                                // this page's rule
      var junk = nb.filter(function (s) { return !byName[s]; });
      names.forEach(function (s, i) {
        var v = byName[s];
        v.wish = i + 1;
        v.pop = names.length > 1 ? 100 * (names.length - 1 - i) / (names.length - 1) : 100;
        v.nbScore = (nb.length - 1) - nb.indexOf(s) - ((names.length - 1) - i);   // how far off the notebook's score is
      });
      var off = names.filter(function (s) { return byName[s].nbScore; });
      var maxOff = Math.max.apply(null, [0].concat(off.map(function (s) { return byName[s].nbScore; })));
      var minOff = off.length ? Math.min.apply(null, off.map(function (s) { return byName[s].nbScore; })) : 0;
      return { lines: lines.length, names: names, junk: junk, off: off.length, maxOff: maxOff, minOff: minOff };
    })();

    /* ---------- the tier list: match names, including 5 spelled differently */
    var T = (function () {
      var t = readCSV(window.TIER_CSV || ''), hi = {};
      t.headers.forEach(function (h, i) { hi[h.toLowerCase()] = i; });
      var rows = t.rows.map(function (r) { return { tier: +r[hi.tier], rank: +r[hi.rank], name: r[hi.name] }; })
                       .sort(function (a, b) { return a.tier - b.tier || a.rank - b.rank; });
      var exact = 0, fixed = [], later = [];
      rows.forEach(function (r, i) {
        var v = byName[r.name], how = 'exact';
        if (!v) {
          var parts = [r.name].concat((/^(.*?)\((.*)\)$/.exec(r.name) || []).slice(1));
          for (var k = 0; k < parts.length && !v; k++) v = byNorm[norm(parts[k])];
          how = 'fixed';
        }
        if (!v) { later.push(r.name); return; }
        if (how === 'exact') exact++; else fixed.push([r.name, v.name]);
        v.tier = r.tier; v.tierPos = i;
      });
      /* Spearman: do the wish list and the tier list put villagers in the same order? */
      var both = V.filter(function (v) { return v.wish && v.tier; });
      var a = both.slice().sort(function (x, y) { return x.wish - y.wish; }), b = both.slice().sort(function (x, y) { return x.tierPos - y.tierPos; });
      var ra = new Map(), rb = new Map();
      a.forEach(function (v, i) { ra.set(v, i + 1); }); b.forEach(function (v, i) { rb.set(v, i + 1); });
      var n = both.length, d2 = 0;
      both.forEach(function (v) { var d = ra.get(v) - rb.get(v); d2 += d * d; });
      var rho = n > 2 ? 1 - 6 * d2 / (n * (n * n - 1)) : 0;
      return { total: rows.length, exact: exact, fixed: fixed, later: later, rho: rho, n: n };
    })();

    /* ---------- the second copy, compared */
    var C = (function () {
      if (!window.VILLAGERS_TT_CSV) return null;
      var t = readCSV(window.VILLAGERS_TT_CSV), hi = {};
      t.headers.forEach(function (h, i) { hi[h] = i; });
      var matched = 0, bday = 0, species = 0, song = 0, phrase = 0, ex = null;
      t.rows.forEach(function (r) {
        var v = byName[r[hi.name]];
        if (!v) return;
        matched++;
        if (r[hi.birthday] === v.m + '-' + v.d) bday++;
        if (r[hi.species] === v.species) species++;
        if (r[hi.song] !== v.song) song++;
        if (r[hi.phrase] !== v.phrase) { phrase++; if (!ex && r[hi.phrase].toLowerCase().charAt(0) !== v.phrase.toLowerCase().charAt(0)) ex = [v.name, r[hi.phrase], v.phrase]; }
      });
      return { rows: t.rows.length, matched: matched, bday: bday, species: species, song: song, phrase: phrase, ex: ex };
    })();

    /* each species is shown by the face of its most wished-for villager */
    var FACE = {};
    V.forEach(function (v) { var f = FACE[v.species]; if (v.wish && (!f || v.wish < f.wish)) FACE[v.species] = v; });
    function speciesPic(sp) { return FACE[sp] ? function () { return pic(FACE[sp], 'icon', 'hb-ico'); } : null; }
    function faceNote(sp) { return FACE[sp] ? 'Face: ' + FACE[sp].name + ', the most wished-for ' + sp : ''; }

    /* ---------- the checks */
    var list = checksFor(VP);
    var validBd = V.filter(function (v) { return v.m >= 1 && v.d >= 1 && v.d <= DAYS_IN[v.m - 1]; }).length;
    var extra = [];
    extra.push(validBd === N ? { s: 'ok', t: 'Every birthday is a real day of the year.' } : { s: 'warn', t: NUM(N - validBd) + ' birthdays aren’t real dates.' });
    var ids = countBy(V.filter(function (v) { return FILE_OK.test(v.file); }), function (v) { return v.file; });
    var nIds = Object.keys(ids).length, shared = Object.keys(ids).filter(function (k) { return ids[k] > 1; }).length;
    extra.push(nIds === N && !shared
      ? { s: 'ok', t: 'Every villager has its own picture ID (the Filename column, like brd06 for Admiral), so each picture comes straight from the data.' }
      : { s: 'warn', t: NUM(N - nIds) + ' villagers have no usable picture ID' + (shared ? ' and ' + shared + ' IDs are shared' : '') + '. They show a letter instead of a picture.' });
    extra.push({ s: 'ok', t: 'Gender has 2 values, and there are ' + Object.keys(countBy(V, function (v) { return v.species; })).length + ' species, ' +
      Object.keys(countBy(V, function (v) { return v.personality; })).length + ' personalities and ' + Object.keys(countBy(V, function (v) { return v.hobby; })).length + ' hobbies, spelled the same way every time.' });
    extra.push(W.names.length === N
      ? { s: 'ok', t: 'The wish ranking came as a copied web page, ' + NUM(W.lines) + ' lines long. Keeping only lines that are a villager’s name leaves ' + W.names.length + ': every villager, once.' }
      : { s: 'warn', t: 'The wish ranking names ' + W.names.length + ' of ' + N + ' villagers.' });
    if (W.junk.length) extra.push({ s: 'warn', t: 'The notebook cleaned the ranking by keeping lines that start with a capital letter. That also keeps ' + W.junk.length +
      ' lines of website text, like “' + W.junk.slice(0, 3).join('”, “') + '”. Counted as villagers, they give the ' + W.off + ' most-wished villagers scores ' +
      W.minOff + ' to ' + W.maxOff + ' points too high. This page uses the corrected ranks.' });
    extra.push({ s: T.fixed.length ? 'info' : 'ok', t: 'The tier list has ' + T.total + ' names. ' + T.exact + ' match a villager exactly' +
      (T.fixed.length ? ', and ' + T.fixed.length + ' match once the spelling is cleaned up (' + T.fixed.map(function (f) { return f[0] + ' → ' + f[1]; }).join(', ') + ')' : '') +
      '. ' + (T.later.length ? 'The other ' + T.later.length + ' are villagers added to the game later, so they aren’t in this data.' : '') });
    if (C) extra.push({ s: (C.song || C.phrase) ? 'warn' : 'ok', t: 'A second copy of this data (TidyTuesday, from VillagerDB) agrees on every birthday and species, but gives a different favorite song for ' +
      NUM(C.song) + ' villagers and a different catchphrase for ' + NUM(C.phrase) + (C.ex ? ' (' + C.ex[0] + ': “' + C.ex[1] + '” or “' + C.ex[2] + '”?)' : '') +
      '. This page uses the Kaggle copy, the one the notebook reads. Before a report goes out, I’d ask which source is right.' });
    list.splice.apply(list, [list.length - 1, 0].concat(extra));
    renderChecks($('da-checks'), list);

    /* ---------- filters */
    var state = { species: '', personality: '', hobby: '', month: '', gender: '' };
    var EMPTY = JSON.stringify(state);
    var fSpecies = $('f-species'), fPers = $('f-personality'), fHobby = $('f-hobby'), fMonth = $('f-month');
    function fill(sel, key, label) {
      entries(countBy(V, function (v) { return v[key]; })).sort(function (a, b) { return label(a[0]).localeCompare(label(b[0])); }).forEach(function (e) {
        var o = el('option', null, label(e[0]) + ' (' + e[1] + ')'); o.value = e[0]; sel.appendChild(o);
      });
    }
    fill(fSpecies, 'species', cap); fill(fPers, 'personality', persLabel); if (fHobby) fill(fHobby, 'hobby', function (x) { return x; });
    MONTHS.forEach(function (m, i) { var o = el('option', null, m); o.value = String(i + 1); fMonth.appendChild(o); });
    var seg = $('f-gender');

    function syncControls() {
      fSpecies.value = state.species; fPers.value = state.personality; fMonth.value = state.month;
      if (fHobby) fHobby.value = state.hobby;
      [].forEach.call(seg.querySelectorAll('button'), function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-v') === state.gender)); });
      $('f-reset').hidden = JSON.stringify(state) === EMPTY;
    }
    function set(k, v) { state[k] = state[k] === v ? '' : v; syncControls(); render(); }
    [[fSpecies, 'species'], [fPers, 'personality'], [fHobby, 'hobby'], [fMonth, 'month']].forEach(function (p) {
      if (p[0]) p[0].addEventListener('change', function () { state[p[1]] = p[0].value; syncControls(); render(); });
    });
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.gender = b.getAttribute('data-v'); syncControls(); render();
    });
    seg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var bs = [].slice.call(seg.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      n.focus(); n.click();
    });
    $('f-reset').addEventListener('click', function () { state = JSON.parse(EMPTY); syncControls(); render(); });

    function pass(v, skip) {
      return (skip === 'species' || !state.species || v.species === state.species) &&
             (skip === 'personality' || !state.personality || v.personality === state.personality) &&
             (skip === 'hobby' || !state.hobby || v.hobby === state.hobby) &&
             (skip === 'month' || !state.month || v.m === +state.month) &&
             (skip === 'gender' || !state.gender || v.gender === state.gender);
    }
    function rowsWithout(skip) { return V.filter(function (v) { return pass(v, skip); }); }

    function toggler(id) {
      var b = $(id), on = false;
      if (!b) return function () { return false; };
      b.addEventListener('click', function () {
        on = !on;
        b.setAttribute('aria-expanded', String(on));
        b.textContent = on ? 'Show top 12' : 'Show all';
        render();
      });
      return function () { return on; };
    }
    var speciesAll = toggler('species-more'), popAll = toggler('pop-more');
    function top12(list, all, selKey, btn) {
      var shown = all ? list : list.slice(0, 12);
      if (!all && selKey && !shown.some(function (e) { return e.key === selKey; })) {
        var hit = list.filter(function (e) { return e.key === selKey; })[0];
        if (hit) shown.push(hit);
      }
      if ($(btn)) $(btn).hidden = list.length <= 12;
      return shown;
    }
    function withNote(host, text) {
      var p = el('p', 'da-note', text);
      host.insertBefore(p, host.querySelector('.da-tv'));
      return p;
    }

    /* ---------- render everything the filters touch */
    function render() {
      var rows = rowsWithout(null);
      var n = rows.length;
      var parts = [];
      if (state.species) parts.push(cap(state.species));
      if (state.personality) parts.push(persLabel(state.personality));
      if (state.hobby) parts.push('hobby ' + state.hobby.toLowerCase());
      if (state.gender) parts.push(state.gender);
      if (state.month) parts.push('born in ' + MONTHS[state.month - 1]);
      $('da-showing').textContent = n
        ? 'Showing ' + NUM(n) + ' of ' + NUM(N) + ' villagers' + (parts.length ? ': ' + parts.join(', ') + '.' : '.')
        : 'No villager matches all of these. Try clearing a filter.';

      /* KPI tiles */
      var f = rows.filter(function (v) { return v.gender === 'female'; }).length;
      var mon = entries(countBy(rows, function (v) { return v.m; })).sort(byCount)[0];
      var song = entries(countBy(rows, function (v) { return v.song || null; })).sort(byCount)[0];
      var star = rows.filter(function (v) { return v.wish; }).sort(function (a, b) { return a.wish - b.wish; })[0];
      kpis($('da-kpis'), n ? [
        ['Villagers', NUM(n), n === N ? 'every one in the data' : 'of ' + NUM(N)],
        ['Most wished-for', star ? star.name : '—', star ? '#' + star.wish + ' of ' + W.names.length + ' on the wish list' : ''],
        ['Female · male', pct(f, n) + ' · ' + pct(n - f, n), NUM(f) + ' and ' + NUM(n - f)],
        ['Species', NUM(Object.keys(countBy(rows, function (v) { return v.species; })).length), 'of 35'],
        ['Busiest birthday month', MONTHS[mon[0] - 1], NUM(mon[1]) + ' ' + plural(mon[1], 'birthday', 'birthdays')],
        ['Top favorite song', song ? song[0] : '—', song ? NUM(song[1]) + ' ' + plural(song[1], 'fan', 'fans') : '']
      ] : [['Villagers', '0', 'clear a filter']]);

      /* ---- popularity: the leaderboard */
      var lead = $('c-top'); clear(lead);
      var best = rows.filter(function (v) { return v.wish; }).sort(function (a, b) { return a.wish - b.wish; }).slice(0, 10);
      if (!best.length) lead.appendChild(el('p', 'da-empty', 'Nobody matches these filters.'));
      else {
        var ol = el('ol', 'da-lead');
        best.forEach(function (v, i) {
          var li = el('li'), b = el('button', 'lead-row');
          b.type = 'button';
          b.setAttribute('aria-label', '#' + v.wish + ' ' + v.name + ', ' + persLabel(v.personality).toLowerCase() + ' ' + v.species + (v.tier ? ', tier ' + v.tier : '') + '. Meet ' + v.name);
          var rk = el('span', 'lead-rank', '#' + v.wish);
          var ic = pic(v, 'icon', 'lead-ico ' + gColor(v.gender));
          var tx = el('span', 'lead-txt');
          tx.appendChild(el('span', 'lead-name', v.name));
          tx.appendChild(el('span', 'lead-meta', persLabel(v.personality) + ' ' + v.species + ' · ' + v.hobby.toLowerCase()));
          var tr = el('span', 'lead-tier', v.tier ? 'Tier ' + v.tier : 'no tier');
          [rk, ic, tx, tr].forEach(function (x) { x.setAttribute('aria-hidden', 'true'); b.appendChild(x); });
          b.addEventListener('click', function () { meetShow(v, true); });
          li.appendChild(b); ol.appendChild(li);
          if (!REDUCED) li.style.animationDelay = (i * 40) + 'ms';
        });
        lead.appendChild(ol);
        lead.appendChild(el('p', 'da-note', 'Tap a villager to meet them. #1 is the most wished-for on Nook Market’s list.'));
      }

      /* ---- popularity by species: average score, small groups flagged */
      var sp = groupAvg(rowsWithout('species'), 'species');
      hbars($('c-pop-species'), top12(sp.map(function (g) {
        return { key: g.key, label: cap(g.key) + ' (' + g.n + ')', pic: speciesPic(g.key), value: g.avg, color: g.n < SMALL ? 'c3' : 'c1',
                 extra: (g.n < SMALL ? 'Only ' + g.n + ' ' + plural(g.n, 'villager', 'villagers') + ': read with care' : g.n + ' villagers') + '. ' + faceNote(g.key) };
      }), popAll(), state.species, 'pop-more'), {
        fmt: NUM1, share: false, unit: 'average score', onPick: function (k) { set('species', k); }, selected: state.species,
        head: ['Species (villagers)', 'Average popularity score (100 = most wished)']
      });

      /* ---- popularity by personality, coloured by gender */
      var pg = {}; V.forEach(function (v) { pg[v.personality] = v.gender; });
      hbars($('c-pop-pers'), groupAvg(rowsWithout('personality'), 'personality').map(function (g) {
        return { key: g.key, label: persLabel(g.key) + ' (' + g.n + ')', value: g.avg, color: gColor(pg[g.key]), extra: 'Always ' + pg[g.key] };
      }), { fmt: NUM1, share: false, unit: 'average score', onPick: function (k) { set('personality', k); }, selected: state.personality,
            head: ['Personality (villagers)', 'Average popularity score'] });

      /* ---- popularity by tier: do the two lists agree? */
      var tr = groupAvg(rows.filter(function (v) { return v.tier; }), 'tier');
      vbars($('c-pop-tier'), [1, 2, 3, 4, 5, 6].map(function (t) {
        var g = tr.filter(function (x) { return +x.key === t; })[0];
        return { key: String(t), label: String(t), long: 'Tier ' + t + (g ? ' (' + g.n + ' villagers)' : ''), value: g ? Math.round(g.avg * 10) / 10 : 0 };
      }), { unit: 'average score', head: ['Tier (1 = top)', 'Average popularity score'], peak: true });
      withNote($('c-pop-tier'), 'Tier 1 is the fan list’s top. Over all ' + T.n + ' villagers on both lists, the two orders agree with a Spearman score of ' +
        T.rho.toFixed(2) + ' (1 means the same order, 0 means no link).');

      /* ---- who they are */
      var spc = entries(countBy(rowsWithout('species'), function (v) { return v.species; })).sort(byCount).map(function (e) {
        return { key: e[0], label: cap(e[0]), pic: speciesPic(e[0]), value: e[1], extra: faceNote(e[0]) };
      });
      hbars($('c-species'), top12(spc, speciesAll(), state.species, 'species-more'),
        { onPick: function (k) { set('species', k); }, selected: state.species, unit: 'villagers', of: 'these villagers', head: ['Species', 'Villagers'] });

      hbars($('c-personality'), entries(countBy(rowsWithout('personality'), function (v) { return v.personality; })).sort(byCount).map(function (e) {
        return { key: e[0], label: persLabel(e[0]), value: e[1], color: gColor(pg[e[0]]), extra: 'Always ' + pg[e[0]] };
      }), { onPick: function (k) { set('personality', k); }, selected: state.personality, unit: 'villagers', of: 'these villagers', head: ['Personality', 'Villagers'] });

      var hb = rowsWithout('hobby');
      hbars($('c-hobby'), entries(countBy(hb, function (v) { return v.hobby; })).sort(byCount).map(function (e) {
        return { key: e[0], label: e[0], value: e[1] };
      }), { onPick: function (k) { set('hobby', k); }, selected: state.hobby, unit: 'villagers', of: 'these villagers', head: ['Hobby', 'Villagers'] });

      /* styles and colours: each villager has two; counted once each */
      function both(a, b) { return function (v) { return v[a] === v[b] ? [v[a]] : [v[a], v[b]]; }; }
      function countMulti(list, fn) { var m = {}; list.forEach(function (v) { fn(v).forEach(function (k) { if (k) m[k] = (m[k] || 0) + 1; }); }); return m; }
      hbars($('c-style'), entries(countMulti(rows, both('style1', 'style2'))).sort(byCount).map(function (e) {
        return { key: e[0], label: e[0], value: e[1] };
      }), { unit: 'villagers', total: n, of: 'these villagers', head: ['Style', 'Villagers with it'] });
      hbars($('c-color'), entries(countMulti(rows, both('color1', 'color2'))).sort(byCount).map(function (e) {
        return { key: e[0], label: e[0], value: e[1], swatch: e[0] };
      }), { unit: 'villagers', total: n, of: 'these villagers', head: ['Colour', 'Villagers who like it'] });

      /* ---- birthdays and words */
      var mr = countBy(rowsWithout('month'), function (v) { return v.m; });
      vbars($('c-month'), MON.map(function (m, i) {
        return { key: String(i + 1), label: m.charAt(0), long: MONTHS[i], value: mr[i + 1] || 0 };
      }), { onPick: function (k) { set('month', k); }, selected: state.month, unit: 'birthdays', head: ['Month', 'Birthdays'] });

      var songsNote;
      var sg = entries(countBy(rows, function (v) { return v.song || null; })).sort(byCount).slice(0, 10);
      hbars($('c-songs'), sg.map(function (e) { return { key: e[0], label: e[0], value: e[1] }; }), {
        unit: 'fans', of: 'these villagers', total: n, head: ['Song', 'Fans'],
        onPick: function (k) {
          var who = rows.filter(function (v) { return v.song === k; }).map(function (v) { return v.name; });
          songsNote.textContent = '“' + k + '” fans: ' + who.join(', ') + '.';
        }
      });
      songsNote = withNote($('c-songs'), 'Click a song to see its fans.');

      var lenNote;
      var lc = countBy(rows, function (v) { return v.phrase.length; });
      var lens = Object.keys(countBy(V, function (v) { return v.phrase.length; })).map(Number).sort(function (a, b) { return a - b; });
      vbars($('c-phrase'), lens.map(function (L) {
        return { key: String(L), label: String(L), long: L + ' characters', value: lc[L] || 0 };
      }), { unit: 'catchphrases', head: ['Length', 'Catchphrases'], onPick: function (k) {
        var ex = rows.filter(function (v) { return v.phrase.length === +k; }).slice(0, 8).map(function (v) { return '“' + v.phrase + '” (' + v.name + ')'; });
        lenNote.textContent = ex.length ? k + ' characters: ' + ex.join(', ') + '.' : 'None with ' + k + ' characters in this filter.';
      } });
      lenNote = withNote($('c-phrase'), 'Click a column to see some of those catchphrases.');

      var letNote;
      var lt = countBy(rows, function (v) { return v.name.charAt(0).toUpperCase(); });
      vbars($('c-letters'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (L) {
        return { key: L, label: L, long: 'Names starting with ' + L, value: lt[L] || 0 };
      }), { unit: 'names', head: ['Letter', 'Names'], onPick: function (k) {
        var who = rows.filter(function (v) { return v.name.charAt(0).toUpperCase() === k; }).map(function (v) { return v.name; });
        letNote.textContent = who.length ? k + ': ' + who.join(', ') + '.' : 'No names start with ' + k + ' in this filter.';
      } });
      letNote = withNote($('c-letters'), 'Click a letter to see the names.');

      paintCalendar(rows);
      meetPool(rows);
      renderTable(rows);
    }

    function groupAvg(rows, key) {
      var g = {};
      rows.forEach(function (v) { if (v.pop === null) return; var k = v[key]; (g[k] = g[k] || []).push(v.pop); });
      return Object.keys(g).map(function (k) { return { key: k, n: g[k].length, avg: avg(g[k], function (x) { return x; }) }; })
                   .sort(function (a, b) { return b.avg - a.avg || a.key.localeCompare(b.key); });
    }

    /* ---------- birthday calendar */
    var cal = $('bd-cal'), cells = {};
    (function build() {
      var head = el('div', 'cal-row cal-head');
      head.setAttribute('role', 'row');
      head.appendChild(el('span', 'cal-m'));
      for (var d = 1; d <= 31; d++) {
        var h = el('span', 'cal-n', (d === 1 || d % 5 === 0 || d === 31) && d !== 30 ? String(d) : '');
        h.setAttribute('aria-hidden', 'true');
        head.appendChild(h);
      }
      cal.appendChild(head);
      MON.forEach(function (m, mi) {
        var row = el('div', 'cal-row');
        row.setAttribute('role', 'row');
        var lab = el('span', 'cal-m', m); lab.setAttribute('role', 'rowheader');
        row.appendChild(lab);
        for (var d = 1; d <= 31; d++) {
          if (d > DAYS_IN[mi]) { var x = el('span', 'cal-x'); x.setAttribute('aria-hidden', 'true'); row.appendChild(x); continue; }
          var b = el('button', 'cal-d');
          b.type = 'button';
          b.setAttribute('role', 'gridcell');
          cells[(mi + 1) + '-' + d] = b;
          row.appendChild(b);
        }
        cal.appendChild(row);
      });
    })();
    var calRows = [];
    function bornOn(rows, m, d) { return rows.filter(function (v) { return v.m === m && v.d === d; }); }
    function paintCalendar(rows) {
      calRows = rows;
      var c = countBy(rows, function (v) { return v.m + '-' + v.d; });
      Object.keys(cells).forEach(function (k) {
        var n = c[k] || 0, b = cells[k], p = k.split('-');
        b.className = 'cal-d s' + Math.min(n, 2) + (b.classList.contains('is-me') ? ' is-me' : '');
        var who = n ? bornOn(rows, +p[0], +p[1]).map(function (v) { return v.name; }).join(' and ') : 'nobody';
        b.setAttribute('aria-label', MONTHS[p[0] - 1] + ' ' + p[1] + ': ' + who);
        b._who = who;
      });
    }
    var bdM = $('bd-month'), bdD = $('bd-day');
    Object.keys(cells).forEach(function (k) {
      var b = cells[k], p = k.split('-');
      tip(b, function () {
        var n = bornOn(calRows, +p[0], +p[1]).length;
        return [n ? b._who : 'Nobody', MONTHS[p[0] - 1] + ' ' + p[1], 'c1'];
      });
      b.addEventListener('click', function () { hideTip(); bdM.value = p[0]; fillDays(); bdD.value = p[1]; showBirthday(+p[0], +p[1]); });
    });
    MONTHS.forEach(function (m, i) { var o = el('option', null, m); o.value = String(i + 1); bdM.appendChild(o); });
    function fillDays() {
      var keep = bdD.value, n = DAYS_IN[bdM.value - 1];
      clear(bdD);
      for (var d = 1; d <= n; d++) { var o = el('option', null, String(d)); o.value = String(d); bdD.appendChild(o); }
      if (keep && +keep <= n) bdD.value = keep;
    }
    bdM.addEventListener('change', fillDays);
    var today = new Date();
    bdM.value = String(today.getMonth() + 1); fillDays(); bdD.value = String(today.getDate());

    function chip(v) {
      var c = el('button', 'da-chip');
      c.type = 'button';
      c.appendChild(pic(v, 'icon', 'da-chip-ico'));
      c.appendChild(document.createTextNode(v.name + ', ' + persLabel(v.personality).toLowerCase() + ' ' + v.species));
      c.addEventListener('click', function () { meetShow(v, true); });
      return c;
    }
    function showBirthday(m, d) {
      var out = $('bd-out'); clear(out);
      var twins = bornOn(V, m, d), label = MONTHS[m - 1] + ' ' + d;
      if (twins.length) {
        out.appendChild(el('p', 'da-bd-h', twins.length > 1 ? 'You share ' + label + ' with ' + twins.length + ' villagers!' : 'You share ' + label + ' with a villager!'));
        twins.forEach(function (v) { out.appendChild(chip(v)); });
      } else {
        var me = dayIndex(m, d), best = null;
        V.forEach(function (v) {
          var x = dayIndex(v.m, v.d), after = (x - me + 366) % 366, before = (me - x + 366) % 366, near = Math.min(after, before);
          if (!best || near < best.near) best = { near: near, after: after <= before, v: v };
        });
        out.appendChild(el('p', 'da-bd-h', 'Nobody has ' + label + '. Closest: ' + MONTHS[best.v.m - 1] + ' ' + best.v.d + ', ' +
          best.near + ' ' + plural(best.near, 'day', 'days') + (best.after ? ' later.' : ' earlier.')));
        bornOn(V, best.v.m, best.v.d).forEach(function (v) { out.appendChild(chip(v)); });
      }
      Object.keys(cells).forEach(function (k) { cells[k].classList.remove('is-me'); });
      if (cells[m + '-' + d]) cells[m + '-' + d].classList.add('is-me');
    }
    $('bd-form').addEventListener('submit', function (e) { e.preventDefault(); showBirthday(+bdM.value, +bdD.value); });

    /* ---------- meet a villager */
    var pool = [], current = null, card = $('meet-card');
    function meetPool(rows) { pool = rows; if (!current || pool.indexOf(current) < 0) shuffle(true); }
    function meetShow(v, go) {
      current = v;
      clear(card);
      var face = pic(v, 'photo', 'vc-face ' + gColor(v.gender));
      var body = el('div', 'vc-body');
      body.appendChild(el('p', 'vc-name', v.name));
      var tags = el('p', 'vc-tags');
      [cap(v.species), persLabel(v.personality), cap(v.gender)].forEach(function (t) { tags.appendChild(el('span', null, t)); });
      body.appendChild(tags);
      var facts = el('dl', 'vc-facts');
      function fact(k, val, sw) {
        var w = el('div'); w.appendChild(el('dt', null, k));
        var dd = el('dd');
        if (sw) sw.forEach(function (c, i) { if (i) dd.appendChild(document.createTextNode(' and ')); dd.appendChild(swatch(c)); dd.appendChild(document.createTextNode(c.toLowerCase())); });
        else dd.textContent = val;
        w.appendChild(dd); facts.appendChild(w);
      }
      fact('Birthday', MONTHS[v.m - 1] + ' ' + v.d);
      fact('Hobby', v.hobby);
      fact('Style', v.style1 === v.style2 ? v.style1 : v.style1 + ' and ' + v.style2.toLowerCase());
      fact('Colours', '', v.color1 === v.color2 ? [v.color1] : [v.color1, v.color2]);
      fact('Favorite song', v.song || 'Not in the data');
      fact('Wish list', v.wish ? '#' + v.wish + ' of ' + W.names.length + (v.tier ? ' \u00b7 tier ' + v.tier : '') : 'Not ranked');
      var say = el('p', 'vc-say');
      say.appendChild(el('span', 'vh', v.name + '’s catchphrase: '));
      say.appendChild(document.createTextNode('“' + v.phrase + '!”'));
      card.appendChild(face); card.appendChild(body); card.appendChild(facts); card.appendChild(say);
      if (!REDUCED) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
      if (go) {
        try { $('meet').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); } catch (e) { $('meet').scrollIntoView(); }
      }
    }
    function shuffle(quiet) {
      if (!pool.length) { clear(card); card.appendChild(el('p', 'da-empty', 'Nobody matches the filters. Clear one to meet someone.')); current = null; return; }
      var next = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1) while (next === current) next = pool[Math.floor(Math.random() * pool.length)];
      if (quiet) { var r = REDUCED; REDUCED = true; meetShow(next, false); REDUCED = r; } else meetShow(next, false);
    }
    $('meet-shuffle').addEventListener('click', function () { shuffle(false); });

    /* ---------- the table */
    var COLS = [['name', 'Name'], ['species', 'Species'], ['personality', 'Personality'], ['hobby', 'Hobby'], ['birthday', 'Birthday'],
                ['wish', 'Wish rank'], ['tier', 'Tier'], ['song', 'Favorite song'], ['phrase', 'Catchphrase']];
    var sortKey = 'wish', sortDir = 1, shown = 25, tableRows = [];
    var tbl = $('tbl'), q = $('tbl-q'), more = $('tbl-more');
    function sortVal(v, k) {
      if (k === 'birthday') return dayIndex(v.m, v.d);
      if (k === 'wish') return v.wish || 9999;
      if (k === 'tier') return v.tier || 99;
      if (k === 'personality') return persLabel(v.personality);
      return String(v[k] || '').toLowerCase();
    }
    function renderTable(rows) {
      if (rows) { tableRows = rows; shown = 25; }
      var s = q.value.trim().toLowerCase();
      var list = tableRows.filter(function (v) {
        return !s || [v.name, v.species, persLabel(v.personality), v.gender, v.hobby, v.song, v.phrase, MONTHS[v.m - 1] + ' ' + v.d, v.style1, v.style2, v.color1, v.color2].join(' ').toLowerCase().indexOf(s) !== -1;
      }).sort(function (a, b) {
        var x = sortVal(a, sortKey), y = sortVal(b, sortKey);
        return (x < y ? -1 : x > y ? 1 : 0) * sortDir || a.name.localeCompare(b.name);
      });
      clear(tbl);
      tbl.appendChild(el('caption', 'vh', 'Villagers, ' + NUM(list.length) + ' rows, sorted by ' + COLS.filter(function (c) { return c[0] === sortKey; })[0][1]));
      var thead = el('thead'), tr = el('tr');
      COLS.forEach(function (c) {
        var th = el('th');
        th.setAttribute('scope', 'col');
        th.setAttribute('aria-sort', sortKey === c[0] ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
        var b = el('button', 'th-sort', c[1]);
        b.type = 'button';
        b.addEventListener('click', function () { if (sortKey === c[0]) sortDir = -sortDir; else { sortKey = c[0]; sortDir = 1; } renderTable(); });
        th.appendChild(b); tr.appendChild(th);
      });
      thead.appendChild(tr); tbl.appendChild(thead);
      var tb = el('tbody');
      list.slice(0, shown).forEach(function (v) {
        var r = el('tr');
        var nm = el('td', 'td-name');
        nm.appendChild(pic(v, 'icon', 'td-ico')); nm.appendChild(document.createTextNode(v.name));
        r.appendChild(nm);
        r.appendChild(el('td', null, cap(v.species)));
        r.appendChild(el('td', null, persLabel(v.personality)));
        r.appendChild(el('td', null, v.hobby));
        r.appendChild(el('td', null, MON[v.m - 1] + ' ' + v.d));
        r.appendChild(el('td', 'num', v.wish ? '#' + v.wish : '—'));
        r.appendChild(el('td', 'num' + (v.tier ? '' : ' td-blank'), v.tier ? String(v.tier) : 'none'));
        r.appendChild(el('td', v.song ? null : 'td-blank', v.song || 'not listed'));
        r.appendChild(el('td', null, v.phrase));
        tb.appendChild(r);
      });
      if (!list.length) { var r0 = el('tr'), td0 = el('td', 'da-empty', 'No villager matches that search.'); td0.colSpan = COLS.length; r0.appendChild(td0); tb.appendChild(r0); }
      tbl.appendChild(tb);
      more.hidden = list.length <= shown;
      more.textContent = 'Show ' + Math.min(25, list.length - shown) + ' more (' + NUM(list.length - shown) + ' left)';
    }
    q.addEventListener('input', function () { shown = 25; renderTable(); });
    more.addEventListener('click', function () { shown += 25; renderTable(); });

    /* ---------- findings, from all the villagers */
    (function notes() {
      var host = $('da-notes'), out = [];
      var ranked = V.filter(function (v) { return v.wish; }).sort(function (a, b) { return a.wish - b.wish; });
      var top10 = ranked.slice(0, 10);
      var cats = top10.filter(function (v) { return v.species === 'cat'; }).length;
      var fem = top10.filter(function (v) { return v.gender === 'female'; }).length;
      var topHobby = entries(countBy(top10, function (v) { return v.hobby; })).sort(byCount)[0];
      out.push(['Raymond is the island’s celebrity.', top10[0].name + ' (a ' + persLabel(top10[0].personality).toLowerCase() + ' ' + top10[0].species + ') tops the Nook Market wish list. ' +
        'In the top 10, ' + cats + ' are cats, ' + fem + ' are female, and ' + topHobby[1] + ' have ' + topHobby[0].toLowerCase() + ' as their hobby. ' +
        'The ranking slip in the notebook (see the checks) changes scores, never the order, so this top 10 holds either way.']);

      var sp = groupAvg(V, 'species'), big = sp.filter(function (g) { return g.n >= SMALL; }), small = sp.filter(function (g) { return g.n < SMALL; });
      out.push([cap(many(big[0].key)) + ' and ' + many(big[1].key) + ' are the crowd favourites.', 'Among species with at least ' + SMALL + ' villagers, ' + many(big[0].key) + ' score highest on average (' + NUM1(big[0].avg) + ' out of 100), then ' +
        many(big[1].key) + ' (' + NUM1(big[1].avg) + '). ' + cap(many(big[big.length - 1].key)) + ' score lowest (' + NUM1(big[big.length - 1].avg) + '). ' +
        (small.length ? small.map(function (g) { return cap(many(g.key)) + ' (' + g.n + ')'; }).join(' and ') + ' are too few to rank fairly: one star villager moves the whole average. Their bars are amber.' : '')]);

      var pp = groupAvg(V, 'personality');
      var pSpread = pp[0].avg - pp[pp.length - 1].avg, sSpread = big[0].avg - big[big.length - 1].avg;
      out.push([pSpread < sSpread ? 'Species matters more than personality.' : 'Personality matters as much as species.',
        'By personality, averages run from ' + NUM1(pp[pp.length - 1].avg) + ' (' + persLabel(pp[pp.length - 1].key).toLowerCase() + ') to ' +
        NUM1(pp[0].avg) + ' (' + persLabel(pp[0].key).toLowerCase() + '). By species (' + SMALL + ' or more villagers) they run from ' + NUM1(big[big.length - 1].avg) + ' to ' + NUM1(big[0].avg) + '. ' +
        (pSpread < sSpread ? 'So what a villager is counts for more than how they act.' : 'So how a villager acts counts as much as what they are.')]);

      var t1 = groupAvg(V.filter(function (v) { return v.tier; }), 'tier').sort(function (a, b) { return +a.key - +b.key; });
      /* usual rule of thumb for a rank correlation */
      var how = T.rho >= 0.8 ? 'very strongly' : T.rho >= 0.6 ? 'strongly' : T.rho >= 0.4 ? 'moderately' : 'only weakly';
      out.push([T.rho >= 0.6 ? 'Two popularity lists, one story.' : 'Two popularity lists, two stories.', 'The Nook Market wish list (2020) and the fan tier list agree ' + how + ': a Spearman score of ' + T.rho.toFixed(2) + ' over ' + T.n +
        ' villagers (1 would be the same order). Tier 1 villagers average ' + NUM1(t1[0].avg) + ' on the wish list, and tier 6 averages ' + NUM1(t1[t1.length - 1].avg) + '.' + (T.rho >= 0.6 ? ' Favourites stay favourites, though the lists differ on plenty of individual villagers.' : '')]);

      var pg = {};
      V.forEach(function (v) { pg[v.personality] = pg[v.personality] || {}; pg[v.personality][v.gender] = 1; });
      var males = Object.keys(pg).filter(function (p) { return pg[p].male && !pg[p].female; }).map(persLabel);
      var females = Object.keys(pg).filter(function (p) { return pg[p].female && !pg[p].male; }).map(persLabel);
      if (males.length + females.length === Object.keys(pg).length)
        out.push(['Personality decides gender.', males.join(', ') + ' villagers are always male. ' + females.join(', ') + ' villagers are always female. So a chart of personality by gender has nothing to compare. Good to know before building one.']);

      var hob = entries(countBy(V, function (v) { return v.hobby; })).sort(byCount);
      var stc = {}; V.forEach(function (v) { [v.style1, v.style2].filter(function (x, j, a) { return a.indexOf(x) === j; }).forEach(function (x) { stc[x] = (stc[x] || 0) + 1; }); });
      var st = entries(stc).sort(byCount);
      out.push(['Hobbies were dealt out evenly. Styles weren\u2019t.', 'Each of the ' + hob.length + ' hobbies has between ' + hob[hob.length - 1][1] + ' and ' + hob[0][1] + ' villagers, too even to be chance: someone balanced them. Styles vary much more: ' +
        st[0][1] + ' villagers have the \u201c' + st[0][0] + '\u201d style, against ' + st[st.length - 1][1] + ' for \u201c' + st[st.length - 1][0] + '\u201d.']);

      var lam = N / 366, e0 = Math.exp(-lam);
      var days = Object.keys(countBy(V, function (v) { return v.m + '-' + v.d; })).length;
      var shared = entries(countBy(V, function (v) { return v.m + '-' + v.d; })).filter(function (e) { return e[1] > 1; });
      var most = Math.max.apply(null, shared.map(function (e) { return e[1]; }));
      out.push(['Birthdays are spread out on purpose.', N + ' villagers have ' + days + ' different birthdays, and no day has more than ' + most + '. If birthdays were picked at random, you’d expect only about ' +
        Math.round(366 * (1 - e0)) + ' different days, and about ' + Math.round(366 * (1 - e0 * (1 + lam + lam * lam / 2))) + ' days with three or more.']);

      var nf = countBy(V, function (v) { return v.name.charAt(0).toLowerCase(); }), pf = countBy(V, function (v) { return v.phrase.charAt(0).toLowerCase(); });
      var expect = Object.keys(nf).reduce(function (s, l) { return s + nf[l] * (pf[l] || 0); }, 0) / N;
      var allit = V.filter(function (v) { return v.phrase.charAt(0).toLowerCase() === v.name.charAt(0).toLowerCase(); });
      out.push(['Some catchphrases match the name.', allit.length + ' villagers have a catchphrase that starts with the same letter as their name, like ' +
        allit.slice(0, 3).map(function (v) { return v.name + '’s “' + v.phrase + '”'; }).join(', ') + '. Shuffled at random, about ' + Math.round(expect) + ' would. ' +
        (allit.length > expect * 1.3 ? 'So it happens about ' + NUM1(allit.length / expect) + ' times more often than chance.' : 'So it looks like chance.')]);

      if (C) out.push(['Two copies, two answers.', 'The same 391 villagers in two public datasets agree on every birthday and species, but disagree on ' + NUM(C.song) + ' favorite songs (' + pct(C.song, C.matched) +
        ') and ' + C.phrase + ' catchphrases. A chart built on the wrong copy would look just as tidy. That’s why the checks come first.']);

      out.forEach(function (o) {
        var li = el('li');
        li.appendChild(el('strong', null, o[0] + ' '));
        li.appendChild(document.createTextNode(o[1]));
        host.appendChild(li);
      });
    })();

    /* the explorer's sample: the joined table, so visitors can slice it too */
    window.VILLAGERS_JOINED_CSV = (function () {
      var q2 = function (s) { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      var head = ['Name', 'Species', 'Gender', 'Personality', 'Hobby', 'Birthday', 'Catchphrase', 'Favorite Song', 'Style 1', 'Style 2', 'Color 1', 'Color 2', 'Wish rank', 'Popularity score', 'Tier'];
      return [head.join(',')].concat(V.map(function (v) {
        return [v.name, cap(v.species), cap(v.gender), persLabel(v.personality), v.hobby, MONTHS[v.m - 1] + ' ' + v.d, v.phrase, v.song,
                v.style1, v.style2, v.color1, v.color2, v.wish || '', v.pop === null ? '' : NUM1(v.pop), v.tier || ''].map(q2).join(',');
      })).join('\n');
    })();

    syncControls();
    render();
  })();

  /* ================================================================
     6. EXPLORE YOUR OWN DATA — read here, never sent anywhere.
     ================================================================ */
  if ($('explore')) (function () {
    var MAX_BYTES = 15 * 1024 * 1024, MAX_BARS = 300;
    var ex = null;
    var msg = $('ex-msg'), out = $('ex-out'), drop = $('ex-drop'), file = $('ex-file');
    var gSel = $('ex-group'), mSel = $('ex-measure'), sSel = $('ex-sort'), tSel = $('ex-top'), fCol = $('ex-fcol'), fVal = $('ex-fval'), exQ = $('ex-q');
    var lastResult = [];

    function say(t, bad) { msg.textContent = t; msg.classList.toggle('is-bad', !!bad); }

    function load(text, name) {
      var t;
      try { t = readCSV(text); } catch (e) { say('That file couldn\u2019t be read as a table. Is it saved as CSV?', true); return; }
      if (!t.headers.length || !t.rows.length) { say('No rows found. The first line should be the column names, with data under it.', true); return; }
      if (t.headers.length === 1 && t.rows.length && /[,;\t]/.test(t.rows[0][0])) say('Only one column was found. If the file uses an unusual separator, save it as a regular CSV.', true);
      else say('');
      ex = { t: t, p: profile(t), name: name };
      $('ex-name').textContent = name + ': ' + NUM(t.rows.length) + ' ' + plural(t.rows.length, 'row', 'rows') + ', ' + t.headers.length + ' ' + plural(t.headers.length, 'column', 'columns') + '.';
      renderChecks($('ex-checks'), checksFor(ex.p));
      renderCols();
      setupBuilder();
      out.hidden = false;
      exQ.value = '';
      draw();
    }

    function readFile(f) {
      if (!f) return;
      if (f.size > MAX_BYTES) { say('That file is ' + NUM1(f.size / 1048576) + ' MB. This page takes files up to 15 MB.', true); return; }
      say('Reading ' + f.name + '\u2026');
      var r = new FileReader();
      r.onload = function () { load(r.result, f.name); };
      r.onerror = function () { say('Your browser couldn\u2019t read that file.', true); };
      r.readAsText(f);
    }

    file.addEventListener('change', function () { readFile(file.files && file.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) { readFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    $('ex-sample').addEventListener('click', function () { load(window.VILLAGERS_JOINED_CSV || window.VILLAGERS_CSV || '', 'villagers, joined with the wish rank and tier (the sample)'); });
    $('ex-paste-go').addEventListener('click', function () {
      var v = $('ex-text').value;
      if (!v.trim()) { say('Paste some rows first.', true); return; }
      load(v, 'Pasted rows');
    });
    $('ex-clear').addEventListener('click', function () {
      ex = null; lastResult = [];
      out.hidden = true;
      file.value = ''; $('ex-text').value = '';
      ['ex-checks', 'ex-cols', 'ex-chart', 'ex-rows', 'ex-kpis'].forEach(function (id) { clear($(id)); });
      say('Done. The data is gone from this page.');
    });

    function typeName(c) { return c.type === 'number' ? 'Number' : c.type === 'date' ? 'Date' : 'Text'; }
    function renderCols() {
      var tbl = $('ex-cols'); clear(tbl);
      var thead = el('thead'), tr = el('tr');
      ['Column', 'Type', 'Filled', 'Blank', 'Different values', 'Example'].forEach(function (h) { var th = el('th', null, h); th.setAttribute('scope', 'col'); tr.appendChild(th); });
      thead.appendChild(tr); tbl.appendChild(thead);
      var tb = el('tbody');
      ex.p.cols.forEach(function (c) {
        var r = el('tr');
        r.appendChild(el('td', 'td-name', c.name));
        r.appendChild(el('td', null, typeName(c)));
        r.appendChild(el('td', 'num', NUM(c.filled)));
        r.appendChild(el('td', 'num' + (c.missing ? ' td-warn' : ''), NUM(c.missing)));
        r.appendChild(el('td', 'num', NUM(c.distinct)));
        r.appendChild(el('td', 'td-ex', c.examples.slice(0, 2).join(', ')));
        tb.appendChild(r);
      });
      tbl.appendChild(tb);
    }

    function opt(sel, value, label) { var o = el('option', null, label); o.value = value; sel.appendChild(o); }
    function setupBuilder() {
      var cols = ex.p.cols;
      clear(gSel); clear(mSel); clear(fCol);
      cols.forEach(function (c) {
        opt(gSel, 'c:' + c.index, c.name + ' (' + NUM(c.distinct) + ' ' + plural(c.distinct, 'value', 'values') + ')');
        if (c.type === 'date') { opt(gSel, 'm:' + c.index, c.name + ' by month'); opt(gSel, 'y:' + c.index, c.name + ' by year'); }
      });
      opt(mSel, 'count', 'Count of rows');
      cols.filter(function (c) { return c.type === 'number'; }).forEach(function (c) {
        opt(mSel, 'sum:' + c.index, 'Sum of ' + c.name);
        opt(mSel, 'avg:' + c.index, 'Average of ' + c.name);
      });
      opt(fCol, '', '(every row)');
      cols.filter(function (c) { return c.distinct <= 200; }).forEach(function (c) { opt(fCol, String(c.index), c.name); });
      fillFilterValues();
      /* start on the first text column with a handful of values */
      var pick = cols.filter(function (c) { return c.type === 'text' && c.distinct >= 3 && c.distinct <= 30; })[0] ||
                 cols.filter(function (c) { return c.type === 'text' && c.distinct >= 2 && c.distinct <= 40; })[0] ||
                 cols.filter(function (c) { return c.type !== 'number' && c.distinct >= 2; })[0] || cols[0];
      gSel.value = 'c:' + pick.index;
      mSel.value = 'count'; sSel.value = 'desc'; tSel.value = '20';
    }
    function fillFilterValues() {
      clear(fVal);
      opt(fVal, '', '(any value)');
      if (fCol.value === '') { fVal.disabled = true; return; }
      var c = ex.p.cols[+fCol.value];
      entries(c.values).sort(byCount).forEach(function (e) { opt(fVal, e[0], e[0] + ' (' + NUM(e[1]) + ')'); });
      if (c.missing) opt(fVal, '\u0000', '(blank) (' + NUM(c.missing) + ')');
      fVal.disabled = false;
    }
    fCol.addEventListener('change', function () { fillFilterValues(); draw(); });
    [gSel, mSel, sSel, tSel, fVal].forEach(function (s) { s.addEventListener('change', draw); });
    exQ.addEventListener('input', function () { drawRows(filtered()); });

    function filtered() {
      if (!ex) return [];
      var rows = ex.t.rows;
      if (fCol.value !== '' && fVal.value !== '') {
        var i = +fCol.value, want = fVal.value;
        rows = rows.filter(function (r) { return want === '\u0000' ? isMissing(r[i]) : r[i] === want; });
      }
      return rows;
    }

    function groupKey(spec, r) {
      var kind = spec.split(':')[0], c = ex.p.cols[+spec.split(':')[1]], v = r[c.index];
      if (isMissing(v)) return '(blank)';
      if (kind === 'm' || kind === 'y') {
        var d = toDate(v);
        if (!d) return '(not a date)';
        return kind === 'y' ? String(d.y) : d.y + '-' + (d.m < 10 ? '0' : '') + d.m;
      }
      if (c.type === 'number' && c.distinct > 20 && isFinite(c.min) && c.max > c.min) {
        var n = toNumber(v);
        if (isNaN(n)) return '(not a number)';
        var step = niceCeil((c.max - c.min) / 10), lo = Math.floor(c.min / step) * step;
        var k = Math.floor((n - lo) / step), a = lo + k * step;
        return NUM1(a) + ' to ' + NUM1(a + step);
      }
      return v;
    }

    function draw() {
      if (!ex) return;
      var rows = filtered();
      var g = gSel.value, m = mSel.value, kind = m.split(':')[0], mi = +m.split(':')[1];
      var mCol = kind === 'count' ? null : ex.p.cols[mi];
      var acc = {};
      rows.forEach(function (r) {
        var k = groupKey(g, r);
        var a = acc[k] || (acc[k] = { n: 0, sum: 0, cnt: 0 });
        a.n++;
        if (mCol) { var x = toNumber(r[mi]); if (!isNaN(x)) { a.sum += x; a.cnt++; } }
      });
      var res = Object.keys(acc).map(function (k) {
        var a = acc[k];
        var v = kind === 'count' ? a.n : kind === 'sum' ? a.sum : (a.cnt ? a.sum / a.cnt : 0);
        return { key: k, label: k, value: v, n: a.n };
      });
      var binned = /^c:/.test(g) && ex.p.cols[+g.slice(2)].type === 'number' && ex.p.cols[+g.slice(2)].distinct > 20;
      if (sSel.value === 'az' || binned || /^[my]:/.test(g)) res.sort(function (a, b) {
        if (binned) return toNumber(a.key.split(' to ')[0]) - toNumber(b.key.split(' to ')[0]) || a.key.localeCompare(b.key);
        return a.key.localeCompare(b.key, undefined, { numeric: true });
      });
      else res.sort(function (a, b) { return (sSel.value === 'asc' ? a.value - b.value : b.value - a.value) || a.key.localeCompare(b.key); });
      var top = +tSel.value, shownRes = top ? res.slice(0, top) : res.slice(0, MAX_BARS);
      lastResult = res;
      var gName = gSel.options[gSel.selectedIndex].text.replace(/ \(\d[\d,]* values?\)$/, '');
      var mName = mSel.options[mSel.selectedIndex].text;
      var fmt = kind === 'avg' ? NUM1 : function (x) { return NUM(Math.round(x * 100) / 100); };
      $('ex-chart-h').textContent = mName + ', by ' + gName;
      var total = res.reduce(function (s, r) { return s + (kind === 'avg' ? 0 : r.value); }, 0);
      kpis($('ex-kpis'), [
        ['Rows in view', NUM(rows.length), rows.length === ex.t.rows.length ? 'all of them' : 'of ' + NUM(ex.t.rows.length)],
        ['Groups', NUM(res.length), shownRes.length < res.length ? NUM(shownRes.length) + ' shown' : 'all shown'],
        kind === 'avg' ? ['Overall average', mCol ? NUM1(avgOf(rows, mi)) : '\u2014', mCol ? mCol.name : '']
                       : ['Total', fmt(total), kind === 'count' ? 'rows' : mCol.name]
      ]);
      hbars($('ex-chart'), shownRes, {
        fmt: fmt, total: kind === 'avg' ? 0 : total, share: kind !== 'avg', of: 'the total',
        head: [gName, mName], empty: 'No rows match that filter.'
      });
      if (!top && res.length > MAX_BARS) $('ex-chart').insertBefore(el('p', 'da-note', 'Showing the first ' + MAX_BARS + ' of ' + NUM(res.length) + ' groups. Download the CSV for all of them.'), $('ex-chart').querySelector('.da-tv'));
      drawRows(rows);
    }
    function avgOf(rows, i) {
      var s = 0, n = 0;
      rows.forEach(function (r) { var x = toNumber(r[i]); if (!isNaN(x)) { s += x; n++; } });
      return n ? s / n : 0;
    }

    function drawRows(rows) {
      var tbl = $('ex-rows'); clear(tbl);
      var s = exQ.value.trim().toLowerCase();
      var list = s ? rows.filter(function (r) { return r.join(' ').toLowerCase().indexOf(s) !== -1; }) : rows;
      var thead = el('thead'), tr = el('tr');
      ex.t.headers.forEach(function (h) { var th = el('th', null, h); th.setAttribute('scope', 'col'); tr.appendChild(th); });
      thead.appendChild(tr); tbl.appendChild(thead);
      var tb = el('tbody');
      list.slice(0, 50).forEach(function (r) {
        var row = el('tr');
        r.forEach(function (v, i) {
          var c = ex.p.cols[i];
          row.appendChild(el('td', (c.type === 'number' ? 'num' : '') + (isMissing(v) ? ' td-blank' : ''), isMissing(v) ? (v || 'blank') : v));
        });
        tb.appendChild(row);
      });
      tbl.appendChild(tb);
      $('ex-rows-note').textContent = list.length > 50 ? 'Showing the first 50 of ' + NUM(list.length) + ' matching rows.' : NUM(list.length) + ' matching ' + plural(list.length, 'row', 'rows') + '.';
    }

    $('ex-download').addEventListener('click', function () {
      if (!lastResult.length) return;
      var q = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var gName = gSel.options[gSel.selectedIndex].text.replace(/ \(\d[\d,]* values?\)$/, ''), mName = mSel.options[mSel.selectedIndex].text;
      var csv = [q(gName) + ',' + q(mName)].concat(lastResult.map(function (r) { return q(r.label) + ',' + (Math.round(r.value * 10000) / 10000); })).join('\r\n');
      try {
        var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        var a = el('a'); a.href = url; a.download = 'chart-data.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      } catch (e) { say('Your browser blocked the download.', true); }
    });
  })();
})();
