/* john.goliash.com — the unsubscribe page.
   Loaded after main.js, on unsubscribe.html only.

   Posts JSON to /api/contact, the same Worker route the contact form uses,
   with type:'unsubscribe'. The Worker checks it and hands it to the Apps Script
   logger, which adds one row to the "Unsubscribes" tab of the contact sheet.
   See TECHNICAL_john.goliash.com.md §4.21. No libraries, ES5 style.

   The ids are all unsub-*, on purpose: main.js looks for #form, #status and
   #send, and must not find anything here. */
(function () {
  'use strict';

  var form = document.getElementById('unsub-form');
  if (!form) return;

  var emailEl  = document.getElementById('unsub-email');
  var why      = document.getElementById('unsub-why');           // step 2: why did you leave?
  var whyMail  = document.getElementById('unsub-why-email');
  var whySend  = document.getElementById('unsub-why-send');
  var whySkip  = document.getElementById('unsub-why-skip');
  var whyStat  = document.getElementById('unsub-why-status');
  var reasonEl = document.getElementById('unsub-reason');
  var delEl    = document.getElementById('unsub-delete');
  var webEl    = document.getElementById('unsub-web');           // honeypot
  var btn      = document.getElementById('unsub-send');
  var statusEl = document.getElementById('unsub-status');
  var fallback = document.getElementById('unsub-fallback');
  var done     = document.getElementById('unsub-done');
  var doneMail = document.getElementById('unsub-done-email');
  var doneDel  = document.getElementById('unsub-done-del');
  var again    = document.getElementById('unsub-again');

  var BTN_LABEL = btn.textContent;
  var EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;    // same rule as the contact form and the Worker
  var REASON_MAX = 500;
  var SLOW_MS = 6000;       // after this, say we are still working
  var GIVE_UP_MS = 40000;   // the Worker gives up at 25s; this is only a safety net

  var busy = false, slowTimer = null, giveUpTimer = null;

  function say(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function stopTimers() {
    clearTimeout(slowTimer);
    clearTimeout(giveUpTimer);
    slowTimer = giveUpTimer = null;
  }

  function markBad(el, bad) {
    var row = el.closest ? el.closest('.row') : null;
    if (row) row.classList.toggle('bad', bad);
  }

  function failed() {
    busy = false;
    stopTimers();
    btn.disabled = false;
    btn.textContent = BTN_LABEL;
    say('That didn’t go through. Please try again in a minute. ' +
        'If it keeps failing, use the contact form and ask me to unsubscribe you.', 'err');
    fallback.hidden = false;
  }

  var lastMail = '';
  function succeeded(mail) {
    busy = false;
    stopTimers();
    lastMail = mail;
    whyMail.textContent = mail;                  // textContent, never innerHTML
    form.reset();
    btn.disabled = false;
    btn.textContent = BTN_LABEL;
    say('');
    fallback.hidden = true;
    form.hidden = true;
    why.reset();
    whyStat.textContent = '';
    why.hidden = false;
    why.focus();                                 // so a screen reader reads it
  }

  function finish(wantsDelete) {
    doneMail.textContent = lastMail;
    doneDel.hidden = !wantsDelete;
    why.hidden = true;
    done.hidden = false;
    done.focus();
  }

  function post(body) {
    var ctl = window.AbortController ? new AbortController() : null;
    if (ctl) giveUpTimer = setTimeout(function () { ctl.abort(); }, GIVE_UP_MS);
    body.type = 'unsubscribe';
    body.website = webEl.value;                  // honeypot
    return fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    })
    .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
    .then(function (d) { stopTimers(); if (!d || d.ok !== true) throw new Error('rejected'); });
  }

  /* step 1: just the address and one button */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var mail = emailEl.value.trim();
    fallback.hidden = true;
    if (!mail) {
      markBad(emailEl, true);
      say('Please type your email address.', 'err');
      emailEl.focus();
      return;
    }
    if (!EMAIL_RE.test(mail)) {
      markBad(emailEl, true);
      say('That email address doesn’t look right.', 'err');
      emailEl.focus();
      return;
    }
    markBad(emailEl, false);

    busy = true;
    btn.disabled = true;
    btn.textContent = 'Unsubscribing…';
    say('Working on it…');
    slowTimer = setTimeout(function () {
      say('Still working. Please keep this page open.');
    }, SLOW_MS);
    post({ email: mail, reason: '', deleteRequested: false })
      .then(function () { succeeded(mail); })
      .catch(failed);
  });

  /* step 2: why did you leave? (optional; saved as a second row with the reason) */
  why.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var pick = why.querySelector('input[name="why"]:checked');
    var extra = reasonEl.value.trim();
    var reason = ((pick ? pick.value : '') + (pick && extra ? ': ' : '') + extra).slice(0, REASON_MAX);
    var wantsDelete = !!delEl.checked;
    if (!reason && !wantsDelete) { finish(false); return; }
    busy = true;
    whySend.disabled = whySkip.disabled = true;
    whySend.textContent = 'Sending…';
    whyStat.textContent = '';
    post({ email: lastMail, reason: reason, deleteRequested: wantsDelete })
      .then(function () { busy = false; whySend.disabled = whySkip.disabled = false; whySend.textContent = 'Send'; finish(wantsDelete); })
      .catch(function () {
        busy = false;
        whySend.disabled = whySkip.disabled = false;
        whySend.textContent = 'Send';
        whyStat.className = 'status err';
        whyStat.textContent = 'That didn’t go through, but you are still unsubscribed. Try again, or press Skip.';
      });
  });
  whySkip.addEventListener('click', function () { if (!busy) finish(false); });

  form.addEventListener('input', function (e) {
    if (e.target === emailEl && emailEl.value.trim()) markBad(emailEl, false);
  });

  again.addEventListener('click', function () {
    done.hidden = true;
    why.hidden = true;
    form.hidden = false;
    emailEl.focus();
  });
})();
