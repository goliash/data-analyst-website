/**
 * your-contact-worker — standalone Cloudflare Worker for
 * john.goliash.com/api/contact
 *
 * NOT part of the deployed site (deploy.ps1 refuses to ship it). Deployed as
 * its own Worker — see TECHNICAL_john.goliash.com.md §6.2. Route:
 * john.goliash.com/api/contact.
 *
 * Adapted from mixyz.xyz/contact-worker.js; the rules recorded there all hold.
 *
 * WHAT IT DOES: checks the submission, adds Cloudflare's view of the
 * connection, and hands everything to the Apps Script logger, which saves the
 * row, emails contact@example.com and sends the visitor's acknowledgement.
 *
 * WHY IT SENDS NO EMAIL ITSELF (differs from wint.win; same design as
 * mixyz.xyz, where it was decided on 12 Oct 2026). The send_email binding
 * needs contact@example.com verified as a Cloudflare destination and Email
 * Routing onboarded for the zone; onboarding rewrites the Google Workspace MX
 * records. On mixyz.xyz the first live test of the binding failed with "could
 * not find domain config of sending domain". Gmail, through Apps Script,
 * needs neither.
 *
 * WHAT THAT CHANGES: the Apps Script call is now the delivery path, not an
 * extra. So it is awaited with a generous timeout, and if the row was NOT
 * saved the Worker answers ok:false — the page then offers the visitor a
 * pre-filled email, so the message is never silently lost.
 *
 * UNTIL THE ENDPOINT IS SET: SHEET_ENDPOINT below is a placeholder that starts
 * with PASTE_. While it does, deliver() logs 'SHEET_ENDPOINT not set' and
 * reports that nothing was saved, without calling anything. The Worker then
 * answers 502 {ok:false, error:'not_saved'} and the page offers the visitor a
 * pre-filled email instead, so a message is never lost. Paste the real /exec
 * URL after deploying the Apps Script (sheet-logger.gs, SETUP step 4).
 *
 * UNSUBSCRIBE (added 15 Oct 2026). The unsubscribe page (john.goliash.com/
 * unsubscribe) posts to this same route with  type: 'unsubscribe'  so no new
 * Cloudflare route is needed. unsubscribeRequest() below checks it and hands it
 * to the same Apps Script logger, which adds a row to the "Unsubscribes" tab.
 * Everything else in this file is the contact path and is unchanged.
 *
 * Cost: $0. Workers free plan (100,000 requests/day).
 */

const SHEET_ENDPOINT = 'PASTE_THE_EXEC_URL_HERE';   // paste the /exec URL; the script runs as the account that receives contact@example.com
const SHEET_TOKEN    = 'CHANGE-ME-to-a-long-random-string';   // must match TOKEN in sheet-logger.gs

/* Apps Script cold starts can take many seconds, and it now saves the row AND
   sends two emails before answering. The page's progress bar is built for a
   wait like this. Past the limit the Worker gives up and the page offers the
   email fallback. */
const SHEET_TIMEOUT_MS = 25000;

const ALLOWED_ORIGINS = ['https://john.goliash.com', 'https://www.john.goliash.com'];
const MIN_FILL_MS = 2000;          // anything faster is a bot
const CAP = { name: 120, email: 200, company: 160, message: 5000, field: 400, reason: 500 };

/* Browser-reported fields passed through, each ASCII-only and capped. Keep in
   step with deviceInfo() in main.js, DEVICE_LABELS in sheet-logger.gs and the
   tables in disclosure.html §1. */
const DEVICE_KEYS = ['kind', 'platform', 'screen', 'vp', 'dpr', 'depth', 'tz',
  'tzOffset', 'langs', 'cores', 'mem', 'touch', 'referrer', 'ua'];

const clean = (s, max) => String(s == null ? '' : s)
  .replace(/[\r\n]+/g, ' ').trim().slice(0, max);

const json = (obj, status = 200, origin) => new Response(JSON.stringify(obj), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0],
    'Vary': 'Origin'
  }
});

/* Cloudflare's own view of the connection. Never read from the request body:
   the body is written by whoever is posting and can say anything. */
function edgeFields(request) {
  const cf = request.cf || {};
  return {
    ip:         request.headers.get('CF-Connecting-IP') || '',
    city:       cf.city || '',
    region:     cf.region || '',
    country:    cf.country || '',
    postalCode: cf.postalCode || '',
    timezone:   cf.timezone || '',
    network:    cf.asOrganization || '',
    asn:        cf.asn ? 'AS' + cf.asn : '',
    colo:       cf.colo || ''
  };
}

/* Returns what Apps Script reports. Never throws. A 200 alone proves nothing:
   Apps Script answers 302 then 200 and can still carry {ok:false}, so the
   body is read. */
async function deliver(payload) {
  /* Placeholder guard. Until the real /exec URL is pasted into SHEET_ENDPOINT
     there is nowhere to send the row, so fail safely and say why. Nothing is
     fetched; the caller sees "not saved", answers 502, and the page offers the
     visitor a pre-filled email. */
  if (SHEET_ENDPOINT.startsWith('PASTE_')) {
    console.error('SHEET_ENDPOINT not set');
    return { logged: false, notified: null, ack: null };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SHEET_TIMEOUT_MS);
  try {
    const res = await fetch(SHEET_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal
    });
    const txt = await res.text();
    let j = null;
    try { j = JSON.parse(txt); } catch (e) { /* not JSON: treated as failure */ }
    if (!j || j.ok !== true) {
      console.error('apps script rejected:', res.status, txt.slice(0, 200));
      return { logged: false, notified: null, ack: null };
    }
    return { logged: true, notified: j.notified || null, ack: j.ack || null };
  } catch (err) {
    console.error('apps script unreachable:', err && err.message);
    return { logged: false, notified: null, ack: null };
  } finally {
    clearTimeout(timer);
  }
}

/* The unsubscribe request (type: 'unsubscribe'). Called from fetch() below,
   AFTER the origin check and the honeypot, so both still apply.

   Differences from the contact path, all on purpose:
   - Only email, an optional reason (500 chars) and the delete tick-box are
     read. name, company and message are not needed.
   - The 2-second "filled in too fast" gate is NOT applied. A person who follows
     a link from an email can press the button quickly, and a silent fake
     success would leave them thinking they were off the list when no row was
     saved. A bot is still stopped by the honeypot.
   - No IP address, location or device details are forwarded. The page tells
     the visitor it doesn't save them.
   - The visitor is told "ok" only if the row was saved, like the contact path. */
async function unsubscribeRequest(body, allowed) {
  const email  = clean(body.email, CAP.email);
  const reason = clean(body.reason, CAP.reason);    // optional: may be empty

  // Same email rule as the contact path (keep the two in step).
  if (!email) return json({ ok: false }, 400, allowed);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false }, 400, allowed);

  const result = await deliver({
    token: SHEET_TOKEN,
    type: 'unsubscribe',
    received: new Date().toISOString().replace('T', ' ').replace(/\..+/, ''),
    email, reason,
    deleteRequested: body.deleteRequested === true
  });

  if (!result.logged) {
    // Logged so a failed request can still be honoured by hand.
    console.error('unsubscribe NOT saved:', email);
    return json({ ok: false, error: 'not_saved' }, 502, allowed);
  }
  return json({ ok: true, logged: true }, 200, allowed);
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : null;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowed || ALLOWED_ORIGINS[0],
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin'
        }
      });
    }

    if (request.method !== 'POST') return json({ ok: false }, 405, allowed);
    if (origin && !allowed) return json({ ok: false }, 403, allowed);

    let body;
    try { body = await request.json(); } catch { return json({ ok: false }, 400, allowed); }

    // --- silent rejections: both return 200 so a bot learns nothing ---
    if (body.website) return json({ ok: true }, 200, allowed);

    // The unsubscribe page uses this route too. It skips the timing gate below.
    if (body.type === 'unsubscribe') return unsubscribeRequest(body, allowed);

    if (typeof body.elapsed === 'number' && body.elapsed < MIN_FILL_MS) {
      return json({ ok: true }, 200, allowed);
    }

    const name    = clean(body.name, CAP.name);
    const email   = clean(body.email, CAP.email);
    const company = clean(body.company, CAP.company);   // optional: may be empty
    const message = String(body.message == null ? '' : body.message).trim().slice(0, CAP.message);

    // company is deliberately NOT required: name, email and message are.
    if (!name || !email || !message) return json({ ok: false }, 400, allowed);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false }, 400, allowed);

    const d = (body.device && typeof body.device === 'object') ? body.device : {};
    const device = {};
    DEVICE_KEYS.forEach((k) => {
      if (d[k] != null && d[k] !== '') device[k] = clean(String(d[k]).replace(/[^\x20-\x7E]/g, ''), CAP.field);
    });

    const result = await deliver({
      token: SHEET_TOKEN,
      received: new Date().toISOString().replace('T', ' ').replace(/\..+/, ''),
      name, email, company, message,
      edge: edgeFields(request),
      device
    });

    /* The row is the durable record. If it was saved, the message is safe even
       if an email failed (the sheet's Notified and Auto-reply cells say which).
       If it was NOT saved, say so, and the page offers the email fallback. */
    if (!result.logged) {
      console.error('submission NOT saved:', email);
      return json({ ok: false, error: 'not_saved' }, 502, allowed);
    }
    if (!/^sent/.test(String(result.notified || ''))) {
      console.error('saved but notification not sent:', result.notified);
    }
    return json({
      ok: true,
      logged: true,
      notified: /^sent/.test(String(result.notified || '')),
      acked: /^sent/.test(String(result.ack || ''))
    }, 200, allowed);
  }
};
