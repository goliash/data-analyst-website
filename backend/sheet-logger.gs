/**
 * john.goliash.com — contact form logger
 * ---------------------------------------------------------------------------
 * A Google Apps Script web app that, for each contact-form submission:
 *   1. appends one row to a Google Sheet,
 *   2. emails the message to contact@example.com (Reply-To: the visitor), then
 *   3. sends the visitor an instant acknowledgement from contact@example.com.
 *
 * ALSO (added 15 Oct 2026): the unsubscribe page, john.goliash.com/unsubscribe,
 * posts here through the same Worker with  type: 'unsubscribe'.  Those requests
 * go to their own "Unsubscribes" tab (no email is sent to the person), and the
 * acknowledgement in step 3 is never sent to an address listed on that tab.
 * Search this file for UNSUBSCRIBE to find every part of it.
 *
 * DESIGN NOTE (carried over from mixyz.xyz, 12 Oct 2026). On wint.win the
 * notification in step 2 comes from the Cloudflare Worker's send_email
 * binding. Here, as on mixyz.xyz, it comes from HERE, through Gmail, by John's
 * choice: the binding needs contact@example.com verified as a Cloudflare
 * destination AND Email Routing onboarded for the zone, and that onboarding
 * rewrites the MX records Google Workspace mail depends on. Sending through
 * Gmail needs neither, is already covered by example.com's SPF record
 * (v=spf1 include:_spf.google.com ~all), and costs nothing. The price is
 * quota: each submission uses TWO of the account's daily recipients
 * (notification + acknowledgement) — 100/day on a free Google account
 * (authorize() logs the real figure for this one), so about 50 submissions.
 * The notification is sent first, so if the quota runs out it is the courtesy
 * ack that gets skipped, never the message to us.
 *
 * QUOTA MARK (carried over from mixyz.xyz, 12 Oct 2026). Because the quota is
 * now the one real limit, every row records how many sends were left after it
 * ("Email quota left", amber at QUOTA_LOW or fewer, red at 0), and the
 * notification shows the same figure — with a banner and a flag in the subject
 * line once it runs low.
 *
 * On mixyz.xyz the first live test of the binding (12 Oct 2026) failed
 * exactly as predicted: the Worker log read "could not find domain config of
 * sending domain".
 *
 * SOURCE ONLY. This file is never deployed with the site — it lives in the
 * folder for version control and must stay out of the Pages upload —
 * deploy.ps1 refuses to ship it (TECHNICAL_john.goliash.com.md §3).
 *
 * Owner: create this project while signed in as the account that receives
 * contact@example.com, so the script, the spreadsheet and the mailbox it sends
 * from are one account. If contact@example.com is an alias rather than its own
 * Google account, the script runs as the account that owns it, and mail goes
 * out from that account's own address (Reply-To still points where the code
 * below says).
 * Cost: $0 — Apps Script is included with the Google account.
 *
 * Adapted from mixyz.xyz/sheet-logger.gs, which was adapted from
 * wint.win/sheet-logger.gs; the rules recorded in both all hold.
 *
 * SETUP, once:
 *   1. script.google.com → New project → paste this file over Code.gs
 *   2. Run  setup()  once. Grant the permissions it asks for.
 *      It creates the spreadsheet, writes the header row, and logs the URL.
 *   3. Run  authorize()  once. This grants the Gmail scope the auto-reply
 *      needs. A deployed web app runs headless and cannot show a consent
 *      screen, so without this every submission fails at the ack.
 *   4. Deploy → New deployment → Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Copy the /exec URL and put it in SHEET_ENDPOINT in contact-worker.js.
 *
 * NOTE: opening the /exec URL in a browser signed into several Google
 * accounts returns "Page Not Found" even when the deployment is fine —
 * Chrome rewrites it to /macros/u/<N>/s/... which does not serve web apps.
 * The Worker calls it with no cookies and is unaffected. Verify via
 * Executions (a Completed doPost) and the sheet itself, not a browser tab.
 *
 * AFTER ANY EDIT: Deploy → Manage deployments → pencil → Version: New version
 * → Deploy. Saving in the editor does NOT update /exec. This is the single
 * most common Apps Script mistake and the xyx.me reference calls it out too.
 */

/* Must match SHEET_TOKEN in contact-worker.js. Not a secret in the security
   sense — it only stops idle drive-by posts. The Worker is the only caller. */
const TOKEN = 'CHANGE-ME-to-a-long-random-string';

const SHEET_NAME = 'Submissions';
const PROP_ID    = 'JG_SHEET_ID';

/* ---------------------------------------------------------------- auto-reply

   Both emails are sent from here, as contact@example.com: the notification
   to us (further down) and this instant acknowledgement to the VISITOR.

   The visitor's copy could never come from Cloudflare anyway: the send_email
   binding delivers only to addresses verified under Email Routing, and the
   visitor's address is by definition not one of ours.

   Sending as the mailbox gives real Gmail delivery, Google's DKIM signature, a
   copy in Sent, and replies that land back in the site inbox with no routing.
   GmailApp (rather than MailApp) is deliberate: MailApp leaves no Sent copy,
   so there would be no record on our side of what the visitor was told.
   ------------------------------------------------------------------------- */

/* ON (15 Oct 2026). John turned the auto-reply on in the deployed version;
   this copy was older and still said false, and now matches it. Set it to
   false and deploy a new version to pause it again: sendAck_ then returns
   'off', the Worker reports acked:false, and the page says only that John
   will read the message himself and reply from his own email.

   History: it was PAUSED from the first version (14 Oct 2026) until delivery
   was proven. The reason comes from mixyz.xyz, which this logger was adapted from:
   every acknowledgement its script sent on 12 Oct 2026 shows in that mailbox's
   Sent folder, but none reached the visitor — not at gmail.com, not at a
   example.com address, no bounce — while another-site@example.org's identical acks from
   the same Workspace in August arrived. The cause is still unknown (Admin
   console → Email log search is where to look), and this site's own mailbox
   has not been tried yet. Until a test shows an ack landing in an outside
   inbox, the site must not tell visitors "I've emailed you a copy".
   TECHNICAL_john.goliash.com.md §0. */
const ACK_ENABLED   = true;
const ACK_FROM_NAME = 'John Goliash';
const ACK_SUBJECT   = 'Got your message — John Goliash';
const ACK_REPLY_TO  = 'contact@example.com';

/* Never auto-reply to ourselves. If one of these is typed into the form the
   ack would be a message from contact@example.com to one of our own addresses;
   harmless once, but it is the first half of a mail loop and costs nothing to
   refuse. */
const NO_ACK = ['contact@example.com', 'you@example.com'];

/* ---------------------------------------------------------------- UNSUBSCRIBE
   (added 15 Oct 2026 — TECHNICAL_john.goliash.com.md §4.21)

   The unsubscribe page posts here, through the Worker, with
   type:'unsubscribe'. doPost hands those to logUnsubscribe_, which adds one
   row to the tab below. Nobody is emailed. The tab is created, with a bold
   frozen header row, the first time it is needed (or by running migrate()).

   Columns: Received (UTC), Email (always lower case), Reason (the visitor's own
   words, 500 characters at most), Delete requested (Yes / No: they also asked
   for their messages to be deleted), Status (left blank for John: write
   "done", "deleted" and so on).

   Before any auto-reply goes out, sendAck_ looks the address up here (case
   does not matter) and sends nothing if it is listed. To take someone off
   the list, delete their row(s). Every request is kept as its own row, so a
   second request from the same address (say, one that adds a deletion
   request) is not lost. */
const UNSUB_SHEET   = 'Unsubscribes';
const UNSUB_HEADERS = ['Received (UTC)', 'Email', 'Reason', 'Delete requested', 'Status'];
const UNSUBSCRIBE_URL = 'https://john.goliash.com/unsubscribe';   // printed at the foot of the auto-reply

/* Second loop guard. If the far end is itself an autoresponder, a shared
   address could be acked repeatedly. One ack per address per 10 minutes.
   Real people submitting twice in ten minutes still get their mail logged —
   only the duplicate courtesy reply is suppressed. */
const ACK_DEDUPE_SECONDS = 600;

/* The daily send quota (100 on a free Google account; authorize() logs the
   real figure for this one; each submission uses 2). At or below QUOTA_LOW
   sends left, the row's quota cell turns amber and the notification carries a
   warning banner and a flag in its subject. At 0 the cell turns red: rows are
   still saved, but no email goes out until Google refreshes the count (once a
   day, at an hour it doesn't publish). */
const QUOTA_LOW = 20;

/* Column order. Add to the END when extending, or run migrate() after
   reordering — rows are written BY NAME (see rowFrom), so inserting a column
   mid-list can never relabel one field's data as another's. That failure is
   silent and permanent, which is why xyx.me records it as a hard rule. */
const HEADERS = [
  'Received (UTC)',
  'Name',
  'Email',
  'Company',            // optional field; sits next to Email only because this sheet was new
  'Reply',
  'Message',
  'IP address',
  'City',
  'Region',
  'Country',
  'Postal code',
  'Timezone (edge)',
  'Network',
  'ASN',
  'Edge location',
  'Device',
  'Platform',
  'Screen',
  'Viewport',
  'Pixel ratio',
  'Color depth',
  'Timezone (browser)',
  'UTC offset',
  'Languages',
  'CPU cores',
  'Device memory',
  'Touch',
  'Referrer',
  'User agent',
  'Auto-reply',
  'Notified',           // from mixyz.xyz, where it was added at the END (12 Oct 2026)
  'Email quota left'    // from mixyz.xyz (12 Oct 2026) — sends left today after this row
];

/* ------------------------------------------------------------------ setup */

function setup() {
  const ss = openOrCreate_();
  ensureHeaders_(ss);
  const url = ss.getUrl();
  Logger.log('Spreadsheet ready: ' + url);
  Logger.log('Sheet ID stored in script properties: ' + ss.getId());
  Logger.log('Effective user: ' + Session.getEffectiveUser().getEmail());
  return url;
}

function openOrCreate_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(PROP_ID);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through */ }
  }
  const ss = SpreadsheetApp.create('john.goliash.com — contact form submissions');
  ss.getSheets()[0].setName(SHEET_NAME);
  props.setProperty(PROP_ID, ss.getId());
  return ss;
}

function sheet_(ss) {
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

/* Header repair that preserves data. Looks each existing column up by its
   header TEXT and moves the values to wherever that name now lives, so a
   schema change can never shift one field's data under another's label.
   Unrecognised columns are carried to the right rather than dropped, so a
   hand-added "Notes" column survives. */
function ensureHeaders_(ss) {
  const sh = sheet_(ss);
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getLastRow() > 0
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
    : [];

  const upToDate = HEADERS.every((h, i) => existing[i] === h);
  if (upToDate) return sh;

  if (sh.getLastRow() <= 1 && existing.filter(String).length === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    styleHeader_(sh);
    return sh;
  }

  /* The common case — new names added at the END and nothing else changed:
     write just the new header cells. Existing rows are not touched at all. */
  const known = existing.filter(String).length;
  if (known > 0 && known === existing.length && known < HEADERS.length
      && existing.every((h, i) => h === HEADERS[i])) {
    sh.getRange(1, known + 1, 1, HEADERS.length - known).setValues([HEADERS.slice(known)]);
    styleHeader_(sh);
    return sh;
  }

  /* Rebuild by name, carrying unknown columns to the right. Formulas are read
     as formulas, so each row's Reply link survives (getValues alone would turn
     every =HYPERLINK into the plain word "Reply"). */
  const all = sh.getDataRange();
  const vals = all.getValues();
  const forms = all.getFormulas();
  const rows = vals.map((r, i) => r.map((v, j) => forms[i][j] || v));
  const oldHeader = rows.shift().map(String);
  const extras = oldHeader.filter(h => h && HEADERS.indexOf(h) === -1);
  const target = HEADERS.concat(extras);

  const rebuilt = rows.map(r => target.map(name => {
    const at = oldHeader.indexOf(name);
    return at === -1 ? '' : r[at];
  }));

  sh.clear();
  sh.getRange(1, 1, 1, target.length).setValues([target]);
  if (rebuilt.length) {
    sh.getRange(2, 1, rebuilt.length, target.length).setValues(rebuilt);
  }
  styleHeader_(sh);
  return sh;
}

function styleHeader_(sh) {
  const r = sh.getRange(1, 1, 1, sh.getLastColumn());
  r.setFontWeight('bold')
   .setBackground('#087250')
   .setFontColor('#ffffff')
   .setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 150);   // Received
  sh.setColumnWidth(5, 70);    // Reply   (column 5 since Company was added after Email)
  sh.setColumnWidth(6, 420);   // Message (column 6)
  quotaFormat_(sh);
}

/* Colours the "Email quota left" column: amber at QUOTA_LOW or fewer, red at
   0. Custom formulas rather than "less than" rules, because Sheets treats an
   empty cell as 0 and would paint every older row. Replaces only the rules
   that sit on this column, so any formatting John adds elsewhere survives.
   Called from styleHeader_, i.e. whenever the header row is (re)written. */
function quotaFormat_(sh) {
  const col = HEADERS.indexOf('Email quota left') + 1;
  if (col < 1 || sh.getMaxRows() < 2) return;
  const letter = colLetter_(col);
  const range = sh.getRange(2, col, sh.getMaxRows() - 1, 1);
  const cell = '$' + letter + '2';
  const keep = sh.getConditionalFormatRules().filter(rule =>
    !rule.getRanges().some(r => r.getColumn() === col && r.getNumColumns() === 1));
  const red = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER(' + cell + '),' + cell + '<=0)')
    .setBackground('#f4c7c3').setFontColor('#a50e0e').setBold(true)
    .setRanges([range]).build();
  const amber = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER(' + cell + '),' + cell + '<=' + QUOTA_LOW + ')')
    .setBackground('#fce8b2').setFontColor('#7a4f01').setBold(true)
    .setRanges([range]).build();
  sh.setConditionalFormatRules(keep.concat([red, amber]));   // first match wins
}

function colLetter_(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}

/* Run once after editing HEADERS if you want the change applied immediately
   rather than on the next submission. Also re-applies the quota colours and
   logs today's remaining quota. */
function migrate() {
  const ss = openOrCreate_();
  const sh = ensureHeaders_(ss);
  unsubSheet_(ss);   // UNSUBSCRIBE: makes the "Unsubscribes" tab now rather than at the first request
  quotaFormat_(sh);
  Logger.log('Schema applied. Email quota left today: ' + quotaLeft_());
}

/* ---------------------------------------------------------------------------
   RUN THIS ONCE AFTER ADDING THE AUTO-REPLY.

   GmailApp needs an OAuth scope the original deployment never requested. A
   deployed web app CANNOT prompt for consent — it runs headless as the owner —
   so until the scope is granted from the editor, every doPost fails at the
   ack line. Running any function that touches GmailApp from the editor is what
   triggers the consent screen.

   Then, separately: Deploy → Manage deployments → pencil → New version.
   Granting the scope does not republish the code, and republishing the code
   does not grant the scope. Both are required, in that order.
   ------------------------------------------------------------------------- */
function authorize() {
  const me = Session.getEffectiveUser().getEmail();
  const quota = MailApp.getRemainingDailyQuota();   // forces the mail scope
  GmailApp.getInboxUnreadCount();                   // forces the Gmail scope
  ensureHeaders_(openOrCreate_());                  // adds the Auto-reply column
  Logger.log('Authorised as: ' + me);
  Logger.log('Remaining mail quota today: ' + quota);
  Logger.log('Schema applied. Now deploy a NEW VERSION.');
  return me;
}

/* Sends the acknowledgement to yourself so you can see it in a real client
   without going through the form.

   It calls GmailApp directly rather than sendAck_(), because contact@example.com
   is in NO_ACK and sendAck_ would correctly refuse to mail our own address. That
   refusal is the feature working, not a fault — so the test steps around the
   guard instead of weakening it. */
function testAck() {
  const me = Session.getEffectiveUser().getEmail();
  const msg = 'First line of the test message.\n'
            + 'Second line, to prove the\nline breaks survive.';
  GmailApp.sendEmail(me, ACK_SUBJECT + ' [test]', ackText_('Test', msg), {
    name: ACK_FROM_NAME, htmlBody: ackHtml_('Test', msg), replyTo: ACK_REPLY_TO
  });
  Logger.log('Test acknowledgement sent to ' + me);
  return me;
}

/* ------------------------------------------------------------- the web app */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return json_({ ok: false, error: 'bad token' });

    /* UNSUBSCRIBE: a request from the unsubscribe page. It has its own tab and
       uses none of the contact-form columns, so it is dealt with here and
       returns. No email is sent, to the person or to us. */
    if (body.type === 'unsubscribe') return json_(logUnsubscribe_(body));

    const ss = openOrCreate_();
    const sh = ensureHeaders_(ss);

    /* A lock around the append: two submissions landing together could
       otherwise both read the same last row and one would overwrite the
       other. 20s is well past what an append needs. */
    const lock = LockService.getScriptLock();
    let header, writtenRow;
    lock.waitLock(20000);
    try {
      header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      sh.appendRow(rowFrom_(header, body));
      writtenRow = sh.getLastRow();
    } finally {
      lock.releaseLock();
    }

    /* The message to us, straight after the row. Never throws; the outcome is
       written to the Notified column so the sheet shows what was sent. */
    const notified = notifyOwner_(body, quotaLeft_());
    const notCol = header.indexOf('Notified') + 1;
    if (notCol > 0 && writtenRow > 1) {
      try { sh.getRange(writtenRow, notCol).setValue(notified); } catch (e) {
        Logger.log('Could not record notify status: ' + e);
      }
    }

    /* ORDER MATTERS. The row is committed BEFORE the auto-reply is attempted.
       Sending first would mean a Gmail quota error or a bad address threw away
       the only record we have of the submission — the visitor's message would
       be gone with nothing to show for it. Logged-but-not-acked is recoverable;
       acked-but-not-logged is not. The outcome is then written back into the
       Auto-reply column so the sheet never overstates what was sent. */
    const ack = sendAck_(body);
    const ackCol = header.indexOf('Auto-reply') + 1;
    if (ackCol > 0 && writtenRow > 1) {
      try { sh.getRange(writtenRow, ackCol).setValue(ack); } catch (e) {
        Logger.log('Could not record ack status: ' + e);
      }
    }

    /* The quota mark: what is left AFTER both sends, read back from Google
       rather than worked out, so the cell is exact even when the ack was
       skipped. A number, so the column can be sorted and coloured. */
    const left = quotaLeft_();
    const qCol = header.indexOf('Email quota left') + 1;
    if (qCol > 0 && writtenRow > 1 && left !== null) {
      try { sh.getRange(writtenRow, qCol).setValue(left); } catch (e) {
        Logger.log('Could not record quota: ' + e);
      }
    }

    /* The ack outcome goes back to the Worker, which passes it to the page.
       That is what lets the site say "we've emailed you a confirmation" only
       when one actually went out, instead of asserting it and hoping. */
    return json_({ ok: true, notified: notified, ack: ack, quotaLeft: left });
  } catch (err) {
    // Detail goes to the execution log, never to the caller.
    Logger.log('doPost failed: ' + err);
    return json_({ ok: false, error: 'server error' });
  }
}

/* Liveness check. Read-only, writes nothing, discloses nothing. */
function doGet() {
  return json_({ ok: true, note: 'john.goliash.com contact logger is live' });
}

/* Build the row BY NAME against the sheet's actual current header, never by
   position. A positional array has to be hand-reordered on every schema
   change and getting it wrong is silent — the data lands under the wrong
   headers and still looks plausible. */
/* Visitor text goes in with appendRow, so a value starting with = + - or @
   would be read by Sheets as a formula, and a formula can fetch a URL when
   the sheet is opened. A leading apostrophe keeps it as plain text (Sheets
   does not show the apostrophe). Only the Reply cell is meant to be a
   formula. Added for john.goliash.com, 14 Oct 2026; mixyz.xyz and wint.win
   still write these values raw. */
function plain_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function rowFrom_(header, body) {
  const d = body.device || {};
  const edge = body.edge || {};

  const values = {
    'Received (UTC)':     body.received || new Date().toISOString().replace('T', ' ').replace(/\..+/, ''),
    'Name':               plain_(body.name || ''),
    'Email':              plain_(body.email || ''),
    'Company':            plain_(body.company || ''),
    'Reply':              replyFormula_(body.name, body.email, body.message),
    'Message':            plain_(body.message || ''),
    'IP address':         plain_(edge.ip || ''),
    'City':               plain_(edge.city || ''),
    'Region':             plain_(edge.region || ''),
    'Country':            plain_(edge.country || ''),
    'Postal code':        plain_(edge.postalCode || ''),
    'Timezone (edge)':    plain_(edge.timezone || ''),
    'Network':            plain_(edge.network || ''),
    'ASN':                plain_(edge.asn || ''),
    'Edge location':      plain_(edge.colo || ''),
    'Device':             plain_(d.kind || ''),
    'Platform':           plain_(d.platform || ''),
    'Screen':             plain_(d.screen || ''),
    'Viewport':           plain_(d.vp || ''),
    'Pixel ratio':        plain_(d.dpr || ''),
    'Color depth':        plain_(d.depth || ''),
    'Timezone (browser)': plain_(d.tz || ''),
    'UTC offset':         plain_(d.tzOffset || ''),
    'Languages':          plain_(d.langs || ''),
    'CPU cores':          plain_(d.cores || ''),
    'Device memory':      plain_(d.mem || ''),
    'Touch':              plain_(d.touch || ''),
    'Referrer':           plain_(d.referrer || ''),
    'User agent':         plain_(d.ua || '')
  };

  return header.map(name => (name in values) ? values[name] : '');
}

/* A clickable Reply cell. HYPERLINK renders as a link in the sheet and opens
   the visitor's mail client with the reply pre-written.

   Line breaks in a mailto body MUST be CRLF (%0D%0A) per RFC 6068 — a bare
   %0A collapses the whole draft into one paragraph in the Gmail iOS app.
   Same trap the email's Reply button hit; see wint.win TECHNICAL §4.7a.

   The address itself must NOT be percent-encoded: %40 in the mailto path
   stops Gmail parsing an address at all and the To field arrives empty. */
function replyFormula_(name, email, message) {
  if (!email) return '';
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const quoted = String(message || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => '> ' + l)
    .join('\r\n');
  const body = [
    'Hi ' + first + ',', '', 'Thanks for your message.', '', '', '',
    '---', 'You wrote:', '', quoted, ''
  ].join('\r\n');

  const url = 'mailto:' + email
            + '?subject=' + encodeURIComponent('Re: your message to John Goliash')
            + '&body='    + encodeURIComponent(body);

  // Escape double quotes for the formula string.
  return '=HYPERLINK("' + url.replace(/"/g, '""') + '", "Reply")';
}

/* ------------------------------------------------------------ UNSUBSCRIBE */

/* The "Unsubscribes" tab, created on first use with a bold, frozen header row
   in the same green as the Submissions tab. An existing tab is left exactly as
   it is, so any formatting or columns John adds survive. */
function unsubSheet_(ss) {
  let sh = ss.getSheetByName(UNSUB_SHEET);
  if (!sh) sh = ss.insertSheet(UNSUB_SHEET);
  if (sh.getLastRow() === 0) {
    const head = sh.getRange(1, 1, 1, UNSUB_HEADERS.length);
    head.setValues([UNSUB_HEADERS])
        .setFontWeight('bold')
        .setBackground('#087250')
        .setFontColor('#ffffff')
        .setVerticalAlignment('middle');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);   // Received
    sh.setColumnWidth(2, 260);   // Email
    sh.setColumnWidth(3, 420);   // Reason
    sh.setColumnWidth(4, 130);   // Delete requested
    sh.setColumnWidth(5, 200);   // Status
  }
  return sh;
}

/* Adds one row for an unsubscribe request. Returns what doPost sends back to
   the Worker: {ok:true} only when the row is really in the sheet. The Worker
   has already checked the address; it is checked again here because this web
   app is public and the token only stops idle drive-by posts.
   Visitor text goes through plain_ like everywhere else, so a reason that
   starts with = + - or @ cannot become a formula. */
function logUnsubscribe_(body) {
  const email = String(body.email == null ? '' : body.email).trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'bad email' };
  const reason = String(body.reason == null ? '' : body.reason).replace(/[\r\n]+/g, ' ').trim().slice(0, 500);

  const values = {
    'Received (UTC)':   body.received || new Date().toISOString().replace('T', ' ').replace(/\..+/, ''),
    'Email':            plain_(email),
    'Reason':           plain_(reason),
    'Delete requested': body.deleteRequested === true ? 'Yes' : 'No',
    'Status':           ''    // for John
  };

  /* Same lock as the contact rows: two requests landing together must not
     both read the same last row. */
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = unsubSheet_(openOrCreate_());
    const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    sh.appendRow(header.map(name => (name in values) ? values[name] : ''));
  } finally {
    lock.releaseLock();
  }
  return { ok: true, logged: true };
}

/* True if the address is listed on the Unsubscribes tab. Case does not
   matter. A missing tab, or one with no rows yet, means nobody has
   unsubscribed. THROWS if the tab is there but cannot be read; sendAck_
   treats that as "do not send", because a missed courtesy reply costs
   nothing and mail to someone who asked to stop does. */
function isUnsubscribed_(email) {
  const want = String(email || '').trim().toLowerCase();
  if (!want) return false;
  const sh = openOrCreate_().getSheetByName(UNSUB_SHEET);
  if (!sh || sh.getLastRow() < 2) return false;
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const col = header.indexOf('Email') + 1;
  if (col < 1) throw new Error('the ' + UNSUB_SHEET + ' tab has no Email column');
  const rows = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < rows.length; i++) {
    // plain_ may have put a leading apostrophe on an address that starts with = + - or @
    if (String(rows[i][0]).trim().replace(/^'/, '').toLowerCase() === want) return true;
  }
  return false;
}

/* ------------------------------------------------- the notification to us */

const NOTIFY_TO = 'contact@example.com';

/* Labels in the order they appear in the email. Mirrors DEVICE_KEYS in the
   Worker and the tables in disclosure.html §1 — change all three together. */
const EDGE_LABELS = [
  ['ip', 'IP address'], ['city', 'City'], ['region', 'Region'], ['country', 'Country'],
  ['postalCode', 'Postal code'], ['timezone', 'Timezone'], ['network', 'Network'],
  ['asn', 'ASN'], ['colo', 'Edge location']
];
const DEVICE_LABELS = [
  ['kind', 'Device'], ['platform', 'Platform'], ['screen', 'Screen'], ['vp', 'Viewport'],
  ['dpr', 'Pixel ratio'], ['depth', 'Color depth'], ['tz', 'Timezone'],
  ['tzOffset', 'UTC offset (min)'], ['langs', 'Languages'], ['cores', 'CPU cores'],
  ['mem', 'Device memory'], ['touch', 'Touch'], ['referrer', 'Referrer'], ['ua', 'User agent']
];

/* Emails the submission to us. NEVER throws — returns a short reason for the
   Notified column. Reply-To is the visitor, set through GmailApp's own replyTo
   option, which (unlike the Worker's plain-object reply_to) is a real header:
   Gmail's ordinary Reply button addresses the visitor. */
function notifyOwner_(body, quota) {
  if (quota === 0) return 'no — quota reached';
  const q = quotaNote_(quota);

  const name  = String(body.name || '').trim() || 'Someone';
  const email = String(body.email || '').trim();
  const company = String(body.company || '').trim();   // optional: may be empty
  const msg   = String(body.message || '');
  const edge  = body.edge || {};
  const dev   = body.device || {};
  const pairs = (labels, src) => labels
    .filter(([k]) => src[k] != null && src[k] !== '')
    .map(([k, label]) => [label, String(src[k]).slice(0, 400)]);
  const edgeRows = pairs(EDGE_LABELS, edge).concat([['Received', (body.received || '') + ' UTC']]);
  const devRows  = pairs(DEVICE_LABELS, dev);

  try {
    GmailApp.sendEmail(NOTIFY_TO, '[john.goliash.com] ' + name + q.subject,
      notifyText_(name, email, company, msg, edgeRows, devRows, q), {
        name: 'john.goliash.com form',
        htmlBody: notifyHtml_(name, email, company, msg, edgeRows, devRows, q),
        replyTo: email || NOTIFY_TO
      });
    return 'sent ' + nowStamp_();
  } catch (err) {
    Logger.log('Notify failed: ' + err);
    return 'no — ' + String(err).slice(0, 120);
  }
}

/* Sends left today, or null if Google won't say. Shared by MailApp and
   GmailApp, counted per recipient. */
function quotaLeft_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (e) { return null; }
}

/* What the notification says about the quota. `before` is read just before
   the notification goes out; this email and the visitor's confirmation take
   it down by 2 (by 1 while ACK_ENABLED is off), so that is the figure shown (the sheet's cell has the exact
   count, read afterwards). level: ok | low | out. */
function quotaNote_(before) {
  if (before === null || before === undefined) {
    return { level: 'ok', left: null, subject: '', line: 'Daily email quota: unknown (Google did not report it).' };
  }
  const per = ACK_ENABLED ? 2 : 1;           // sends per submission
  const left = Math.max(before - per, 0);
  const subs = Math.floor(left / per);
  const level = left === 0 ? 'out' : (left <= QUOTA_LOW ? 'low' : 'ok');
  const line = 'Daily email quota: about ' + left + ' send' + (left === 1 ? '' : 's') + ' left today'
    + ' (' + subs + ' more submission' + (subs === 1 ? '' : 's') + ').';
  const subject = level === 'out' ? ' · email quota used up'
                : level === 'low' ? ' · ' + left + ' emails left today' : '';
  const warn = level === 'out'
    ? 'EMAIL QUOTA USED UP. Until Google refreshes it (once a day), new submissions are saved in the sheet only. Nobody is emailed — check the sheet.'
    : level === 'low'
      ? 'EMAIL QUOTA LOW. Past zero, submissions are still saved in the sheet, but no email goes out until the daily refresh.'
      : '';
  return { level: level, left: left, subject: subject, line: line, warn: warn };
}

/* The Reply button link. Same two production rules as everywhere else:
   the address goes in the mailto path RAW (a %40 empties Gmail's To field),
   and line breaks are CRLF (%0A alone collapses the draft in Gmail iOS). */
function replyHref_(name, email, message) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const quoted = String(message || '').replace(/\r\n?/g, '\n').split('\n')
    .map(l => '> ' + l).join('\r\n');
  const body = ['Hi ' + first + ',', '', 'Thanks for your message.', '', '', '',
    '---', 'You wrote:', '', quoted, ''].join('\r\n');
  return 'mailto:' + email + '?subject=' + encodeURIComponent('Re: your message to John Goliash')
       + '&body=' + encodeURIComponent(body);
}

function notifyText_(name, email, company, msg, edgeRows, devRows, q) {
  const flat = rows => rows.map(([k, v]) => '  ' + k + ': ' + v).join('\n');
  return (q.warn ? '*** ' + q.warn + ' ***\n\n' : '')
    + 'New message from the john.goliash.com contact form\n\n'
    + 'From: ' + name + ' <' + email + '>\n'
    + (company ? 'Company: ' + company + '\n' : '')      // under the email; only when given
    + '\n'
    + msg + '\n\n'
    + '----------------------------------------------------\n'
    + 'FROM THE EDGE - reliable\n' + flat(edgeRows) + '\n\n'
    + 'REPORTED BY THE BROWSER - self-declared\n' + flat(devRows) + '\n\n'
    + q.line + '\n';
}

/* Inline styles and tables only — Gmail strips <style> and ignores flex/grid.
   Every interpolated value goes through esc(); all of it is visitor-supplied. */
function notifyHtml_(name, email, company, msg, edgeRows, devRows, q) {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const rows = (pairs) => pairs.map(([k, v]) =>
    '<tr><td style="width:132px;padding:3px 10px 3px 0;color:#566573;vertical-align:top;">' + esc(k) + '</td>'
    + '<td style="padding:3px 0;color:#33424f;word-break:break-word;">' + esc(v) + '</td></tr>').join('');
  const heading = (t) => '<tr><td colspan="2" style="padding:14px 0 4px;color:#087250;font-weight:700;'
    + 'letter-spacing:.08em;text-transform:uppercase;font-size:10px;">' + esc(t) + '</td></tr>';
  /* The company line goes under the sender's email, and only when one was given. */
  const companyLine = company
    ? '<div style="font-size:13px;margin-top:2px;color:#566573;">Company: '
      + '<span style="color:#33424f;">' + esc(company) + '</span></div>'
    : '';
  /* Quota: a banner under the header once low or used up (same colours as the
     sheet's cell), and always a line in the details at the bottom. */
  const tone = q.level === 'out' ? ['#f4c7c3', '#a50e0e'] : ['#fce8b2', '#7a4f01'];
  const banner = q.warn
    ? '<tr><td style="padding:16px 26px 0;"><div style="background:' + tone[0] + ';color:' + tone[1] + ';'
      + 'border-radius:6px;padding:10px 14px;font-size:13px;line-height:1.5;font-weight:600;">'
      + esc(q.warn) + '<br><span style="font-weight:400;">' + esc(q.line) + '</span></div></td></tr>'
    : '';
  const quotaRow = q.left === null
    ? [['Left today', 'unknown']]
    : [['Left today', 'about ' + q.left + ' sends · ' + Math.floor(q.left / (ACK_ENABLED ? 2 : 1)) + ' submissions']];

  return '<!doctype html><html><body style="margin:0;padding:24px;background:#f6f8f4;'
    + 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;'
    + 'margin:0 auto;background:#ffffff;border:1px solid #d3ddd1;border-radius:10px;">'
    + '<tr><td style="padding:22px 26px;border-bottom:2px solid #087250;">'
    + '<div style="font-size:20px;font-weight:650;color:#141d26;">John Goliash</div>'
    + '<div style="font-size:12px;color:#566573;margin-top:2px;">New message from the john.goliash.com contact form</div>'
    + '</td></tr>'
    + banner
    + '<tr><td style="padding:22px 26px 0;">'
    + '<div style="font-size:15px;color:#141d26;"><strong>' + esc(name) + '</strong></div>'
    + '<div style="font-size:13px;margin-top:2px;"><a href="mailto:' + esc(email) + '" style="color:#1f5d97;text-decoration:none;">'
    + esc(email) + '</a></div>'
    + companyLine
    + '</td></tr>'
    + '<tr><td style="padding:16px 26px 0;"><div style="background:#f3f6f1;border-left:3px solid #087250;'
    + 'border-radius:0 6px 6px 0;padding:14px 16px;font-size:14px;line-height:1.6;color:#141d26;white-space:pre-wrap;">'
    + esc(msg) + '</div></td></tr>'
    + '<tr><td style="padding:20px 26px 0;"><a href="' + esc(replyHref_(name, email, msg)) + '" style="display:inline-block;'
    + 'background:#087250;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;'
    + 'border-radius:6px;">Reply to ' + esc(name) + '</a></td></tr>'
    + '<tr><td style="padding:22px 26px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
    + 'style="font-size:11px;line-height:1.5;border-top:1px solid #d3ddd1;">'
    + heading('From the edge — reliable') + rows(edgeRows)
    + heading('Reported by the browser — self-declared') + rows(devRows)
    + heading('Daily email quota') + rows(quotaRow)
    + '<tr><td colspan="2" style="padding:14px 0 0;color:#566573;font-size:10px;line-height:1.6;">'
    + 'Collected at the moment of submission only — nothing is recorded when the page loads. '
    + 'The first group is read from Cloudflare\'s view of the connection and is reliable. '
    + 'The second is reported by the sender\'s browser and can be set to anything. '
    + (ACK_ENABLED
      ? 'Each submission uses 2 of the mailbox\'s daily sends (this email and the visitor\'s confirmation).'
      : 'Each submission uses 1 of the mailbox\'s daily sends (this email). The visitor\'s confirmation is paused.')
    + '</td></tr></table></td></tr></table></body></html>';
}

/* ------------------------------------------------------- the instant reply */

/* Returns a short string for the Auto-reply column. NEVER throws: an ack is a
   courtesy, and no failure to send one may take down the logging path that
   called it. Every exit reports what actually happened rather than a bare
   yes/no, because "no" with no reason is the kind of entry you find six weeks
   later and cannot act on. */
function sendAck_(body) {
  if (!ACK_ENABLED) return 'off';

  const email = String(body.email || '').trim();
  if (!email) return 'no — no address';
  if (NO_ACK.indexOf(email.toLowerCase()) !== -1) return 'no — own address';

  /* UNSUBSCRIBE: never auto-reply to an address on the Unsubscribes tab. This
     comes before the quota check and the 10-minute cache, so nothing is
     counted or remembered for someone we are not going to write to. If the
     tab cannot be read, the answer is also "do not send". */
  try {
    if (isUnsubscribed_(email)) return 'no — unsubscribed';
  } catch (err) {
    Logger.log('Unsubscribe check failed, ack not sent: ' + err);
    return 'no — could not check the unsubscribe list';
  }

  /* Quota is per day and per account — 100 on a free one (QUOTA_LOW above).
     Checking first turns a thrown exception into a recorded fact, and the
     submission is already safely in the sheet. */
  const quota = quotaLeft_();
  if (quota === 0) {
    Logger.log('Ack skipped: daily mail quota exhausted.');
    return 'no — quota reached';
  }

  const cache = CacheService.getScriptCache();
  const key = 'ack:' + Utilities.base64Encode(email.toLowerCase()).slice(0, 200);
  try {
    if (cache.get(key)) return 'no — duplicate within 10 min';
    cache.put(key, '1', ACK_DEDUPE_SECONDS);
  } catch (e) { /* cache is best-effort; a miss just means we send */ }

  const first = String(body.name || '').trim().split(/\s+/)[0] || 'there';

  try {
    GmailApp.sendEmail(email, ACK_SUBJECT, ackText_(first, body.message), {
      name:     ACK_FROM_NAME,
      htmlBody: ackHtml_(first, body.message),
      replyTo:  ACK_REPLY_TO
    });
    return 'sent ' + nowStamp_();
  } catch (err) {
    Logger.log('Ack send failed: ' + err);
    return 'no — ' + String(err).slice(0, 120);
  }
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm') + ' UTC';
}

/* Plain-text part. Sent alongside the HTML, not instead of it — a message with
   no text alternative scores worse with filters and reads as broken in clients
   that prefer plain text. Keep ackText_ and ackHtml_ saying the same thing. */
function ackText_(first, message) {
  const quoted = String(message || '')
    .replace(/\r\n?/g, '\n').split('\n').map(l => '> ' + l).join('\n');
  return [
    'Hi ' + first + ',',
    '',
    'I got your message. Thanks for writing.',
    '',
    'I read every message myself, and I\'ll reply from my own email.',
    '',
    'Want to add something? Just reply to this email.',
    '',
    '— John Goliash',
    'contact@example.com',
    '',
    '',
    '----------------------------------------------------',
    'For your records, this is what you sent me:',
    '',
    quoted,
    '',
    '----------------------------------------------------',
    'Don\'t want email from me? Unsubscribe any time: ' + UNSUBSCRIBE_URL,   // UNSUBSCRIBE
    ''
  ].join('\n');
}

/* Same visual language as the notification and the site. Table layout and
   inline styles throughout — Gmail strips <style> blocks and ignores flex and
   grid. Colours are the LIGHT-mode tokens; email is read on white. */
function ackHtml_(first, message) {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  return '<!doctype html><html><body style="margin:0;padding:24px;background:#f6f8f4;'
    + 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;'
    + 'margin:0 auto;background:#ffffff;border:1px solid #d3ddd1;border-radius:10px;">'

    + '<tr><td style="padding:22px 26px;border-bottom:2px solid #087250;">'
    + '<div style="font-size:20px;font-weight:650;color:#141d26;">John Goliash</div>'
    + '<div style="font-size:12px;color:#566573;margin-top:2px;">Message received</div>'
    + '</td></tr>'

    + '<tr><td style="padding:24px 26px 0;font-size:15px;line-height:1.65;color:#141d26;">'
    + '<p style="margin:0 0 14px;">Hi ' + esc(first) + ',</p>'
    + '<p style="margin:0 0 14px;">I got your message. Thanks for writing.</p>'
    + '<p style="margin:0 0 14px;">I read every message myself, and I&rsquo;ll reply from my own email.</p>'
    + '<p style="margin:0 0 4px;">Want to add something? Just reply to this email.</p>'
    + '</td></tr>'

    + '<tr><td style="padding:18px 26px 0;">'
    + '<div style="font:600 11px/1 monospace;letter-spacing:.1em;text-transform:uppercase;'
    + 'color:#566573;padding-bottom:8px;">For your records</div>'
    + '<div style="background:#f3f6f1;border-left:3px solid #087250;border-radius:0 6px 6px 0;'
    + 'padding:14px 16px;font-size:14px;line-height:1.6;color:#141d26;white-space:pre-wrap;">'
    + esc(message) + '</div>'
    + '</td></tr>'

    + '<tr><td style="padding:22px 26px 26px;">'
    + '<div style="border-top:1px solid #d3ddd1;padding-top:16px;font-size:13px;'
    + 'line-height:1.6;color:#33424f;">'
    + '&mdash; <strong style="color:#087250;">John Goliash</strong><br>'
    + '<a href="mailto:contact@example.com" style="color:#1f5d97;text-decoration:none;">contact@example.com</a>'
    + '</div>'
    + '<div style="margin-top:14px;font-size:10px;line-height:1.6;color:#566573;">'
    + 'This is an automatic note to say your message arrived. '
    + 'If a reply is needed, I will write it separately.'
    + '</div>'
    // UNSUBSCRIBE: last line of the email; keep in step with the end of ackText_
    + '<div style="margin-top:10px;font-size:11px;line-height:1.6;color:#566573;">'
    + 'Don&rsquo;t want email from me? Unsubscribe any time: '
    + '<a href="' + UNSUBSCRIBE_URL + '" style="color:#1f5d97;text-decoration:underline;">' + UNSUBSCRIBE_URL + '</a>'
    + '</div>'
    + '</td></tr>'

    + '</table></body></html>';
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
