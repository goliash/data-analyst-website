/* KPI Lab: the app.  TECHNICAL §4.10 (the measures) and §4.23 (the app).
   One window: title bar, a File / Edit / Measures / View / Help menu bar,
   the inputs, the result and graph, the lesson cards and a status bar.
   Used by index.html and, unchanged, by the desktop app in
   apps/kpi-lab-desktop (Electron), which marks <html data-desktop>.
   Everything runs on the visitor's device. Nothing typed here is sent
   anywhere; File > Save keeps the numbers in this browser's own storage. */
(function () {
  'use strict';
  var root = document.documentElement;
  var kapp = document.getElementById('kapp');
  var labForm = document.getElementById('lab-form');
  var labTool = document.getElementById('lab-tool');
  if (!kapp || !labForm || !labTool) return;

  var DESKTOP = root.hasAttribute('data-desktop');         // the app has the whole window (desktop app or kpi-lab.html)
  var PWA = root.hasAttribute('data-pwa');                 // kpi-lab.html: the version you install from the browser
  var ELECTRON = DESKTOP && !PWA;                          // the Windows / Mac / Linux desktop app
  /* Where the Windows, Mac and Linux apps are published (GitHub Releases, TECHNICAL §4.25).
     Fill in 'owner/kpi-lab' once the repository exists; until then the dialog says they're on the way. */
  var GITHUB_REPO = 'goliash/kpi-lab';
  var REDUCED = root.classList.contains('no-motion');
  function moving() { return !root.classList.contains('no-motion'); }
  var NUM = (function () {
    try { var f = new Intl.NumberFormat('en-US'); return function (n) { return f.format(n); }; }
    catch (e) { return function (n) { return String(n); }; }
  })();
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

    var fieldsEl  = document.getElementById('lab-fields');
    var defEl     = document.getElementById('lab-def');
    var nameEl    = document.getElementById('lab-name');
    var valueEl   = document.getElementById('lab-value');
    var formulaEl = document.getElementById('lab-formula');
    var readEl    = document.getElementById('lab-read');
    var tgtLabel  = document.getElementById('lab-tgt-label');
    var factorsEl = document.getElementById('lab-factors');
    var unitEl    = document.getElementById('lab-vunit');
    var scaleMax  = document.getElementById('lab-scale-max');
    var bulletEl  = document.getElementById('lab-bullet');
    var plainEl   = document.getElementById('lab-plain');
    var eqEl      = document.getElementById('lab-eq');
    var whyEl     = document.getElementById('lab-why');
    var teachEl   = document.getElementById('lab-teach');
    var svg = document.querySelector('#lab-bullet svg');
    var bNear = svg.querySelector('.b-near'), bGood = svg.querySelector('.b-good');
    var bBar = svg.querySelector('.b-bar'), bTgt = svg.querySelector('.b-tgt');
    var W = 400;

    function pct(r, dp) { return (r * 100).toFixed(dp === undefined ? 1 : dp) + '%'; }
    function pts(x) { return Math.abs(x).toFixed(1) + (Math.abs(x).toFixed(1) === '1.0' ? ' point' : ' points'); }
    var FIXED = {};
    function dec(n, dp) {                       // 6 -> "6.0", 1234.56 -> "1,234.6"
      try {
        if (!FIXED[dp]) FIXED[dp] = new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
        return FIXED[dp].format(n);
      } catch (e) { return n.toFixed(dp); }
    }
    function money(n) { return '$' + NUM(Math.round(n)); }
    function cash(n) { return '$' + (n % 1 ? dec(n, 2) : NUM(n)); }   // what someone typed: $2.40, $50
    function an(numText) { return /^(8|11(?![\d.,])|18(?![\d.,]))/.test(numText) ? 'an' : 'a'; }
    function nice(n, dp) { var f = Number(n.toFixed(dp)); return f % 1 ? dec(f, dp) : NUM(f); }   // 16 -> "16", 2.5 -> "2.5"
    function shiftText(v) { return v.shift % 1 ? dec(v.shift, 1) : NUM(v.shift); }
    function plural(n, one, many) { return n === 1 ? one : many; }

    /* Three kinds of measure:
         kind 'pct' (default)  a rate, graded against a target on the bar
         lower: true           a rate where less is better; the target is a limit
         kind 'num'            a planning tool; a plain number with a unit, no bar
       Every measure also carries `teach`: the plain-words, formula and
       why-it-matters panel under the lab. */
    var KPIS = {
      /* ---------------- Inventory ---------------- */
      accuracy: {
        name: 'Inventory accuracy',
        def: 'Of the bins you counted, how many matched the system?',
        target: 98,
        fields: [
          { id: 'counted',  label: 'Bins counted',      value: 500, unit: 'bins' },
          { id: 'matching', label: 'Bins that matched', value: 492, unit: 'bins' }
        ],
        check: function (v) {
          if (!(v.counted > 0)) return ['counted', 'Count at least one bin.'];
          if (v.matching > v.counted) return ['matching', 'Matched bins can’t be more than bins counted.'];
        },
        calc: function (v) { return v.matching / v.counted; },
        formula: function (v) { return NUM(v.matching) + ' matched ÷ ' + NUM(v.counted) + ' counted'; },
        read: function (v) {
          var off = v.counted - v.matching;
          return off === 0 ? 'Every bin matched. Keep counting on a schedule so it stays that way.'
            : NUM(off) + ' of ' + NUM(v.counted) + ' bins were off. Recount those first. Then look for a pattern by item, aisle or shift so it doesn’t repeat.';
        },
        teach: {
          plain: 'Inventory accuracy tells you how often the computer is right about what’s on the shelf. Count a set of bins, then check each count against the system. A bin only counts as a match when the two agree exactly.',
          eq: 'Inventory accuracy = bins that matched ÷ bins counted × 100',
          why: 'If the computer says you have 10 and the shelf has 4, you’ll promise orders you can’t ship. Every other report is only as good as this number.'
        }
      },
      turns: {
        name: 'Inventory turns', kind: 'num', unit: 'turns a year',
        def: 'How many times a year do you sell through your stock and buy it again?',
        fields: [
          { id: 'cogs',  label: 'Cost of goods sold in a year', value: 1200000, unit: '$' },
          { id: 'start', label: 'Stock value at the start',     value: 210000,  unit: '$' },
          { id: 'end',   label: 'Stock value at the end',       value: 190000,  unit: '$' }
        ],
        check: function (v) {
          if (!(v.cogs > 0)) return ['cogs', 'Enter what the goods you sold cost you.'];
          if (!(v.start + v.end > 0)) return ['start', 'Enter the value of your stock.'];
        },
        avg: function (v) { return (v.start + v.end) / 2; },
        calc: function (v) { return v.cogs / this.avg(v); },
        fmt: function (r) { return dec(r, 1); },
        formula: function (v) { return money(v.cogs) + ' ÷ ' + money(this.avg(v)) + ' average stock'; },
        read: function (v, r) {
          var days = Math.round(365 / r);
          return 'At ' + dec(r, 1) + ' turns, an item sits about ' + NUM(days) + ' ' + plural(days, 'day', 'days') + ' before it sells. Higher usually means less cash tied up on the shelves. Too high can mean you keep running out. Compare it with last year, and look at the slowest items first.';
        },
        teach: {
          plain: 'Turns count how many times your whole stock is sold and replaced in a year. Think of a bakery: bread turns over every day, so it never sits long enough to go stale.',
          eq: 'Inventory turns = cost of goods sold ÷ average stock value. Average stock = (start + end) ÷ 2.',
          why: 'Stock on a shelf is cash you can’t spend. Faster turns free up that cash, as long as you still have what customers order.'
        }
      },
      dos: {
        name: 'Days of supply', kind: 'num', unit: 'days of supply',
        def: 'At today’s pace, how many days until this item runs out?',
        fields: [
          { id: 'onhand', label: 'Units on hand',            value: 780, unit: 'units' },
          { id: 'sold',   label: 'Units sold in the period', value: 900, unit: 'units' },
          { id: 'days',   label: 'Days in that period',      value: 30,  unit: 'days' },
          { id: 'lead',   label: 'Supplier lead time',       value: 21,  unit: 'days' }
        ],
        check: function (v) {
          if (!(v.days > 0)) return ['days', 'The period needs at least one day.'];
          if (!(v.sold > 0)) return ['sold', 'Enter how many sold. With no sales, the stock never runs out.'];
        },
        perDay: function (v) { return v.sold / v.days; },
        calc: function (v) { return v.onhand / this.perDay(v); },
        fmt: function (r) { return dec(r, 1); },
        tone: function (v, r) { return r < v.lead ? 'warn' : 'ok'; },
        formula: function (v) { return NUM(v.onhand) + ' on hand ÷ ' + nice(this.perDay(v), 1) + ' sold a day'; },
        read: function (v, r) {
          var left = dec(r, 1), lead = NUM(v.lead);
          if (r < v.lead) return 'You’ll run out in about ' + left + ' days, but a new order takes ' + lead + ' days to arrive. Order now, and ask the supplier if they can rush it.';
          if (r < v.lead + 3) return 'You have about ' + left + ' days left, and a new order takes ' + lead + ' days. Order today. It will only just arrive in time.';
          if (r < v.lead + 7) return 'You have about ' + left + ' days left, and a new order takes ' + lead + ' days. Place the order this week.';
          return 'You have about ' + left + ' days left, and a new order takes ' + lead + ' days, so there’s time. Check again next week.';
        },
        teach: {
          plain: 'Days of supply tells you how long your stock will last if sales keep the same pace. It’s like checking how many days of milk are left in the fridge.',
          eq: 'Days of supply = units on hand ÷ units sold per day. Units sold per day = units sold ÷ days in the period.',
          why: 'Compare it with how long the supplier takes to deliver. If the shelf empties before the new order arrives, customers wait.'
        }
      },

      /* ---------------- Ordering tools ---------------- */
      rop: {
        name: 'Reorder point', kind: 'num', unit: 'units',
        def: 'How low should the shelf get before you order more?',
        fields: [
          { id: 'daily',  label: 'Units used per day', value: 30, unit: 'units', step: '0.1' },
          { id: 'lead',   label: 'Supplier lead time', value: 14, unit: 'days' },
          { id: 'safety', label: 'Safety stock',       value: 90, unit: 'units' }
        ],
        check: function (v) {
          if (!(v.daily > 0)) return ['daily', 'Enter how many you use in a day.'];
          if (!(v.lead > 0)) return ['lead', 'Enter how many days an order takes to arrive.'];
        },
        wait: function (v) { return Math.ceil(v.daily * v.lead); },
        calc: function (v) { return this.wait(v) + Math.ceil(v.safety); },
        fmt: function (r) { return NUM(r); },
        formula: function (v) { return nice(v.daily, 1) + ' a day × ' + NUM(v.lead) + ' days + ' + NUM(v.safety) + ' safety'; },
        factors: function (v) {
          return [
            ['While you wait', NUM(this.wait(v)), 'units you’ll use before the order arrives'],
            ['Cushion',        NUM(Math.ceil(v.safety)), 'safety stock for a late truck or a busy week']
          ];
        },
        read: function (v, r) {
          var tail = v.safety > 0
            ? ' The ' + NUM(Math.ceil(v.safety)) + '-unit cushion covers a late truck or a busy week.'
            : ' With no safety stock, any delay means running out. Try the safety stock tool.';
          return 'When the shelf drops to ' + NUM(r) + ' units, place the order. You’ll use about ' + NUM(this.wait(v)) + ' while you wait ' + NUM(v.lead) + ' days for it to arrive.' + tail;
        },
        teach: {
          plain: 'The reorder point is a line on the shelf. When stock drops to it, you order. It’s like filling up the car when the gas light comes on: there’s still enough left to reach the station.',
          eq: 'Reorder point = units used per day × lead time in days + safety stock',
          why: 'Order too late and you run out. Order too early and cash sits on the shelf. This puts the order at the right moment.'
        }
      },
      safety: {
        name: 'Safety stock', kind: 'num', unit: 'units',
        def: 'How much extra should you keep for a busy week or a late delivery?',
        fields: [
          { id: 'avgUse',  label: 'Average used per day', value: 30, unit: 'units' },
          { id: 'maxUse',  label: 'Most used in one day', value: 45, unit: 'units' },
          { id: 'avgLead', label: 'Average lead time',    value: 14, unit: 'days' },
          { id: 'maxLead', label: 'Longest lead time',    value: 20, unit: 'days' }
        ],
        check: function (v) {
          if (!(v.avgUse > 0)) return ['avgUse', 'Enter how many you use on an average day.'];
          if (v.maxUse < v.avgUse) return ['maxUse', 'The busiest day can’t be less than an average day.'];
          if (!(v.avgLead > 0)) return ['avgLead', 'Enter how many days an order usually takes.'];
          if (v.maxLead < v.avgLead) return ['maxLead', 'The longest wait can’t be shorter than the average wait.'];
        },
        calc: function (v) { return Math.ceil(v.maxUse * v.maxLead - v.avgUse * v.avgLead); },
        fmt: function (r) { return NUM(r); },
        formula: function (v) { return '(' + NUM(v.maxUse) + ' × ' + NUM(v.maxLead) + ') − (' + NUM(v.avgUse) + ' × ' + NUM(v.avgLead) + ')'; },
        factors: function (v) {
          return [
            ['Worst case', NUM(Math.ceil(v.maxUse * v.maxLead)), 'busiest days while waiting on the slowest delivery'],
            ['Normal',     NUM(Math.ceil(v.avgUse * v.avgLead)), 'an average day and an average delivery']
          ];
        },
        read: function (v, r) {
          if (r === 0) return 'Your busiest day and slowest delivery match the average, so no cushion is needed. In real life that’s rare. Check the history again.';
          return 'Keep about ' + NUM(r) + ' extra units. That covers the worst case you’ve seen: your busiest days while you wait on your slowest delivery. Put this number into the reorder point tool.';
        },
        teach: {
          plain: 'Safety stock is a spare stash for bad days, like an extra roll of paper towels under the sink in case you go through them faster or the store runs out. This is the simplest way to size it. Bigger companies use a version based on statistics, but the idea is the same.',
          eq: 'Safety stock = (most used in a day × longest lead time) − (average used in a day × average lead time)',
          why: 'Sales and deliveries never run like clockwork. A small cushion keeps one late truck from turning into a lost customer.'
        }
      },
      eoq: {
        name: 'Order size (EOQ)', kind: 'num', unit: 'units an order',
        def: 'How many should you order at a time to keep the total cost lowest?',
        fields: [
          { id: 'demand', label: 'Units used per year',             value: 12000, unit: 'units' },
          { id: 'order',  label: 'Cost to place one order',         value: 50,    unit: '$', step: '0.01' },
          { id: 'hold',   label: 'Cost to store one unit a year',   value: 2.4,   unit: '$', step: '0.01' }
        ],
        check: function (v) {
          if (!(v.demand > 0)) return ['demand', 'Enter how many you use in a year.'];
          if (!(v.order > 0)) return ['order', 'Placing an order always costs something: time, paperwork, freight.'];
          if (!(v.hold > 0)) return ['hold', 'Storing stock always costs something: space, insurance, damage.'];
        },
        calc: function (v) { return Math.round(Math.sqrt(2 * v.demand * v.order / v.hold)); },
        fmt: function (r) { return NUM(r); },
        formula: function (v) { return '√(2 × ' + NUM(v.demand) + ' × ' + cash(v.order) + ' ÷ ' + cash(v.hold) + ')'; },
        factors: function (v, r) {
          var n = v.demand / r;
          return [
            ['Orders a year', dec(n, 1), 'how often you’ll order at this size'],
            ['Ordering cost', money(n * v.order), 'a year, for placing orders'],
            ['Storage cost',  money(r / 2 * v.hold), 'a year, for the stock on the shelf']
          ];
        },
        read: function (v, r) {
          return 'Order about ' + NUM(r) + ' at a time, roughly ' + dec(v.demand / r, 1) + ' times a year. At that size, the yearly cost of placing orders and the yearly cost of storing stock come out about equal, and the total is as low as it gets. Round it to a case or pallet size that makes sense.';
        },
        teach: {
          plain: 'Every order costs money to place: time, paperwork, freight. Every unit on the shelf costs money to keep: space, insurance, things getting damaged or going out of date. Order a little at a time and you pay to order all the time. Order a lot and you pay to store it. EOQ (economic order quantity) finds the middle.',
          eq: 'EOQ = √(2 × units used per year × cost per order ÷ cost to store one unit for a year)',
          why: 'It’s a starting point for how big each order should be. Then adjust it for case sizes, price breaks and shelf space.'
        }
      },

      /* ---------------- Orders and shipping ---------------- */
      fill: {
        name: 'Fill rate',
        def: 'Of the units customers ordered, how many shipped?',
        target: 97,
        fields: [
          { id: 'ordered', label: 'Units ordered', value: 1240, unit: 'units' },
          { id: 'shipped', label: 'Units shipped', value: 1198, unit: 'units' }
        ],
        check: function (v) {
          if (!(v.ordered > 0)) return ['ordered', 'Enter at least one unit ordered.'];
          if (v.shipped > v.ordered) return ['shipped', 'Units shipped can’t be more than units ordered.'];
        },
        calc: function (v) { return v.shipped / v.ordered; },
        formula: function (v) { return NUM(v.shipped) + ' shipped ÷ ' + NUM(v.ordered) + ' ordered'; },
        read: function (v) {
          var short = v.ordered - v.shipped;
          return short === 0 ? 'Every unit ordered went out.'
            : NUM(short) + ' units were ordered but not shipped. Check which items ran short. Then see if the cause was stock, picking or a hold.';
        },
        teach: {
          plain: 'Fill rate tells you how much of what customers asked for you actually sent them.',
          eq: 'Fill rate = units shipped ÷ units ordered × 100',
          why: 'Every unit you can’t ship is a customer who waits, or who buys it from someone else.'
        }
      },
      ontime: {
        name: 'On-time shipping',
        def: 'Of the orders that shipped, how many went out by the promised date?',
        target: 95,
        fields: [
          { id: 'orders', label: 'Orders shipped',  value: 860, unit: 'orders' },
          { id: 'ontime', label: 'Shipped on time', value: 831, unit: 'orders' }
        ],
        check: function (v) {
          if (!(v.orders > 0)) return ['orders', 'Enter at least one order shipped.'];
          if (v.ontime > v.orders) return ['ontime', 'On-time orders can’t be more than orders shipped.'];
        },
        calc: function (v) { return v.ontime / v.orders; },
        formula: function (v) { return NUM(v.ontime) + ' on time ÷ ' + NUM(v.orders) + ' shipped'; },
        read: function (v) {
          var late = v.orders - v.ontime;
          return late === 0 ? 'Every order went out on time.'
            : NUM(late) + ' orders shipped late. Sort them by cause: stock, picking, a credit hold or the carrier pickup.';
        },
        teach: {
          plain: 'On-time shipping checks whether you kept your promise. If you told the customer it would ship Tuesday, did it?',
          eq: 'On-time shipping = orders shipped on time ÷ orders shipped × 100',
          why: 'Customers plan around your date. Late orders cost trust, and some big customers charge a fee for every late one.'
        }
      },
      perfect: {
        name: 'Perfect orders',
        def: 'How many orders went out with nothing wrong at all?',
        target: 90,
        fields: [
          { id: 'ontime',   label: 'Shipped on time',          value: 96,   unit: '%', step: '0.1' },
          { id: 'complete', label: 'Shipped complete',         value: 97,   unit: '%', step: '0.1' },
          { id: 'intact',   label: 'Arrived undamaged',        value: 99.5, unit: '%', step: '0.1' },
          { id: 'docs',     label: 'Right paperwork and bill', value: 98,   unit: '%', step: '0.1' }
        ],
        check: function (v) {
          var ids = ['ontime', 'complete', 'intact', 'docs'];
          for (var i = 0; i < ids.length; i++) if (v[ids[i]] > 100) return [ids[i], 'A share can’t be more than 100%.'];
        },
        calc: function (v) { return (v.ontime / 100) * (v.complete / 100) * (v.intact / 100) * (v.docs / 100); },
        formula: function () { return 'On time × complete × undamaged × right paperwork'; },
        factorsLow: true,
        factors: function (v) {
          return [
            ['On time',         v.ontime / 100,   'shipped by the promised date'],
            ['Complete',        v.complete / 100, 'every item, every unit'],
            ['Undamaged',       v.intact / 100,   'arrived in good shape'],
            ['Right paperwork', v.docs / 100,     'packing slip and bill correct']
          ];
        },
        read: function (v, r) {
          var bad = Math.round((1 - r) * 100);
          return 'Four checks that each look fine still multiply down to ' + pct(r) + '. About ' + NUM(bad) + ' of every 100 orders had at least one problem. Fix the lowest one first.';
        },
        teach: {
          plain: 'A perfect order is one the customer has nothing to complain about: on time, complete, not damaged, and billed right. Miss any one of the four and it isn’t perfect. Multiplying the four rates is a quick, close estimate.',
          eq: 'Perfect orders ≈ on-time % × complete % × undamaged % × right-paperwork %',
          why: 'It’s the customer’s view of you. Four numbers in the high 90s can still add up to a lot of unhappy customers.'
        }
      },
      backorder: {
        name: 'Backorder rate', lower: true, scale: 20,
        def: 'Of the order lines you received, how many had to wait for stock?',
        target: 5,
        fields: [
          { id: 'lines', label: 'Order lines received',   value: 2400, unit: 'lines' },
          { id: 'back',  label: 'Lines put on backorder', value: 132,  unit: 'lines' }
        ],
        check: function (v) {
          if (!(v.lines > 0)) return ['lines', 'Enter at least one order line.'];
          if (v.back > v.lines) return ['back', 'Backordered lines can’t be more than lines received.'];
        },
        calc: function (v) { return v.back / v.lines; },
        formula: function (v) { return NUM(v.back) + ' backordered ÷ ' + NUM(v.lines) + ' lines'; },
        read: function (v) {
          return v.back === 0 ? 'Nothing had to wait. Every line shipped from stock.'
            : NUM(v.back) + ' lines had to wait for stock. Find the few items behind most of them. Then check their reorder points and safety stock.';
        },
        teach: {
          plain: 'An order line is one item on an order. A backorder is a line you can’t ship yet because that item is out of stock, so it waits until new stock comes in.',
          eq: 'Backorder rate = lines put on backorder ÷ order lines received × 100. Lower is better.',
          why: 'Backorders mean waiting customers, split shipments and extra freight. A rising rate is an early warning that ordering isn’t keeping up with sales.'
        }
      },
      pph: {
        name: 'Picks per hour', kind: 'num', unit: 'lines an hour',
        def: 'How fast does the warehouse pick, and how many hours will tomorrow take?',
        fields: [
          { id: 'lines',    label: 'Lines picked today',      value: 1150, unit: 'lines' },
          { id: 'hours',    label: 'Labor hours spent picking', value: 16, unit: 'hours', step: '0.25' },
          { id: 'tomorrow', label: 'Lines to pick tomorrow',  value: 1400, unit: 'lines' },
          { id: 'shift',    label: 'Hours in one shift',      value: 8,    unit: 'hours', step: '0.5' }
        ],
        check: function (v) {
          if (!(v.lines > 0)) return ['lines', 'Enter how many lines were picked.'];
          if (!(v.hours > 0)) return ['hours', 'Enter the hours spent picking.'];
          if (!(v.shift > 0)) return ['shift', 'Enter how long one shift is.'];
        },
        calc: function (v) { return v.lines / v.hours; },
        fmt: function (r) { return dec(r, 1); },
        formula: function (v) { return NUM(v.lines) + ' lines ÷ ' + nice(v.hours, 2) + ' labor hours'; },
        need: function (v, r) { return v.tomorrow / r; },
        factors: function (v, r) {
          var need = this.need(v, r), people = Math.ceil(need / v.shift);
          return [
            ['Hours needed', dec(need, 1), 'labor hours to pick tomorrow’s lines'],
            ['Pickers',      NUM(people), 'for one ' + shiftText(v) + '-hour shift']
          ];
        },
        read: function (v, r) {
          var need = this.need(v, r), people = Math.ceil(need / v.shift);
          if (v.tomorrow === 0) return 'At ' + dec(r, 1) + ' lines an hour, enter tomorrow’s lines to see the hours and people you’ll need.';
          return 'At ' + dec(r, 1) + ' lines an hour, tomorrow’s ' + NUM(v.tomorrow) + ' lines will take about ' + dec(need, 1) + ' labor hours. Plan on ' + NUM(people) + ' ' + plural(people, 'picker', 'pickers') + ' for ' + an(shiftText(v)) + ' ' + shiftText(v) + '-hour shift. Rates change with item size and aisle, so compare one shift with another, not one person with another.';
        },
        teach: {
          plain: 'A pick is taking one line of an order off the shelf. Picks per hour is how many lines get picked for each hour of work.',
          eq: 'Picks per hour = lines picked ÷ labor hours. Hours needed = lines to pick ÷ picks per hour.',
          why: 'It turns tomorrow’s orders into a staffing plan, so you know you need help before the trucks are waiting.'
        }
      },

      /* ---------------- Plant floor ---------------- */
      oee: {
        name: 'OEE',
        def: 'Of the time this machine was supposed to run, how much made good parts at full speed?',
        target: 80,
        fields: [
          { id: 'planned', label: 'Planned run time',  value: 480, unit: 'min' },
          { id: 'down',    label: 'Downtime',          value: 47,  unit: 'min' },
          { id: 'cycle',   label: 'Ideal cycle time',  value: 30,  unit: 'sec', step: '0.1' },
          { id: 'made',    label: 'Units made',        value: 760, unit: 'units' },
          { id: 'good',    label: 'Good units',        value: 741, unit: 'units' }
        ],
        check: function (v) {
          if (!(v.planned > 0)) return ['planned', 'Planned run time must be more than zero.'];
          if (v.down >= v.planned) return ['down', 'Downtime must be less than planned run time.'];
          if (!(v.cycle > 0)) return ['cycle', 'Ideal cycle time must be more than zero.'];
          if (!(v.made > 0)) return ['made', 'Enter at least one unit made.'];
          if (v.good > v.made) return ['good', 'Good units can’t be more than units made.'];
        },
        parts: function (v) {
          var run = v.planned - v.down;
          return { run: run, a: run / v.planned, p: (v.cycle * v.made / 60) / run, q: v.good / v.made };
        },
        calc: function (v) { var f = this.parts(v); return f.a * f.p * f.q; },
        /* Over 100% performance means the inputs are off, not the line: don't
           grade it against the target. */
        suspect: function (v) { return this.parts(v).p > 1; },
        formula: function () { return 'Availability × performance × quality'; },
        factorsLow: true,
        factors: function (v) {
          var f = this.parts(v);
          return [
            ['Availability', f.a, NUM(f.run) + ' run min ÷ ' + NUM(v.planned) + ' planned'],
            ['Performance',  f.p, NUM(v.made) + ' units × ' + v.cycle + ' s ÷ ' + NUM(f.run) + ' run min'],
            ['Quality',      f.q, NUM(v.good) + ' good ÷ ' + NUM(v.made) + ' made']
          ];
        },
        read: function (v) {
          var f = this.parts(v);
          if (f.p > 1) return 'Performance is over 100%. That usually means the ideal cycle time is set too slow. Check it before you trust this number.';
          var low = Math.min(f.a, f.p, f.q);
          if (low === f.a) return 'The biggest loss is downtime: ' + NUM(v.down) + ' minutes. Sort it by reason code and start with the biggest one.';
          if (low === f.p) return 'The biggest loss is speed: the line ran slower than its ideal cycle. Look for small stops and slow cycles.';
          return 'The biggest loss is quality: ' + NUM(v.made - v.good) + ' units weren’t good the first time. Look at scrap and rework by product and shift.';
        },
        teach: {
          plain: 'OEE (overall equipment effectiveness) grades a machine on three questions. Was it running? (availability) Was it running at full speed? (performance) Were the parts good? (quality) Multiply the three to get one score.',
          eq: 'OEE = availability × performance × quality',
          why: 'It shows where a machine’s time really goes. Most plants find more time lost to small stops and slow cycles than they expected. Many treat 85% as world class.'
        }
      },
      scrap: {
        name: 'Scrap rate', lower: true, scale: 10,
        def: 'Of the units you made, how many had to be thrown out?',
        target: 2,
        fields: [
          { id: 'made',  label: 'Units made',            value: 5200, unit: 'units' },
          { id: 'scrap', label: 'Units scrapped',        value: 86,   unit: 'units' },
          { id: 'cost',  label: 'Cost to make one unit', value: 14.5, unit: '$', step: '0.01' }
        ],
        check: function (v) {
          if (!(v.made > 0)) return ['made', 'Enter at least one unit made.'];
          if (v.scrap > v.made) return ['scrap', 'Scrapped units can’t be more than units made.'];
        },
        calc: function (v) { return v.scrap / v.made; },
        formula: function (v) { return NUM(v.scrap) + ' scrapped ÷ ' + NUM(v.made) + ' made'; },
        read: function (v) {
          if (v.scrap === 0) return 'Nothing was scrapped. Keep tracking it so you notice the first change.';
          return 'That scrap cost about ' + money(v.scrap * v.cost) + ' in material and labor, and earned nothing. Sort it by product, machine and shift to find where most of it comes from.';
        },
        teach: {
          plain: 'Scrap is anything you made that can’t be sold or fixed, so it goes in the bin. Scrap rate is the share of everything you made that ended up there.',
          eq: 'Scrap rate = units scrapped ÷ units made × 100. Lower is better.',
          why: 'Every scrapped unit used up material, machine time and wages. Cutting scrap goes straight to profit.'
        }
      },
      takt: {
        name: 'Takt time', kind: 'num', unit: 'seconds a unit',
        def: 'How often must the line finish one unit to keep up with orders?',
        fields: [
          { id: 'shift',  label: 'Shift length',                  value: 480, unit: 'min' },
          { id: 'breaks', label: 'Breaks and meetings',           value: 40,  unit: 'min' },
          { id: 'demand', label: 'Units customers need a shift',  value: 600, unit: 'units' },
          { id: 'cycle',  label: 'Your line’s actual cycle time', value: 47,  unit: 'sec', step: '0.1' }
        ],
        check: function (v) {
          if (!(v.shift > 0)) return ['shift', 'Enter how long the shift is.'];
          if (v.breaks >= v.shift) return ['breaks', 'Breaks must be shorter than the shift.'];
          if (!(v.demand > 0)) return ['demand', 'Enter how many units customers need.'];
        },
        avail: function (v) { return (v.shift - v.breaks) * 60; },
        calc: function (v) { return this.avail(v) / v.demand; },
        fmt: function (r) { return dec(r, 1); },
        tone: function (v, r) { return v.cycle > r ? 'warn' : 'ok'; },
        formula: function (v) { return NUM(v.shift - v.breaks) + ' min × 60 ÷ ' + NUM(v.demand) + ' units'; },
        read: function (v, r) {
          var t = dec(r, 1);
          if (!(v.cycle > 0)) return 'To keep up, the line has to finish one unit every ' + t + ' seconds. Enter your actual cycle time to compare.';
          if (v.cycle > r) {
            var made = Math.floor(this.avail(v) / v.cycle), short = v.demand - made;
            return 'Your line takes ' + dec(v.cycle, 1) + ' seconds a unit, but customers need one every ' + t + ' seconds. You’ll come up about ' + NUM(short) + ' ' + plural(short, 'unit', 'units') + ' short each shift. Find the slowest step and work on it first.';
          }
          return 'Your line takes ' + dec(v.cycle, 1) + ' seconds a unit, faster than the ' + t + '-second takt, so it keeps up with ' + dec(r - v.cycle, 1) + ' seconds to spare on each unit.';
        },
        teach: {
          plain: 'Takt is the beat of the line, like a drummer keeping time. It says how often one finished unit has to come off the end to match what customers order.',
          eq: 'Takt time = available work time ÷ units customers need',
          why: 'If each unit takes longer than takt, orders pile up. If it takes much less, people and machines stand around. It helps set staffing and pace.'
        }
      }
    };

    function isNum(K) { return K.kind === 'num'; }
    function show(K, r) { return isNum(K) ? K.fmt(r) : pct(r); }

    /* values[kpi] = { fieldId: number, target: number } — survives switching */
    var values = {};
    Object.keys(KPIS).forEach(function (k) {
      values[k] = { target: KPIS[k].target };
      KPIS[k].fields.forEach(function (f) { values[k][f.id] = f.value; });
    });
    var current = 'accuracy';
    var shown = 0.984;

    function fieldHtml(k, f, wide) {
      var id = 'lab-' + k + '-' + f.id;
      return '<div class="lab-field' + (wide ? ' wide' : '') + '" data-f="' + f.id + '">' +
        '<label for="' + id + '">' + f.label + '</label>' +
        '<div class="lab-input"><input id="' + id + '" name="' + f.id + '" type="number" min="0" step="' + (f.step || '1') + '"' +
        ' inputmode="' + (f.step ? 'decimal' : 'numeric') + '" value="' + values[k][f.id] + '" aria-describedby="' + id + '-err">' +
        '<span class="lab-unit" aria-hidden="true">' + f.unit + '</span></div>' +
        '<p class="lab-err" id="' + id + '-err"></p></div>';
    }

    function renderFields() {
      var K = KPIS[current];
      var n = K.fields.length, num = isNum(K);
      var html = K.fields.map(function (f, i) { return fieldHtml(current, f, num && n % 2 === 1 && i === n - 1); }).join('');
      if (!num) {
        var tid = 'lab-' + current + '-target';
        html += '<div class="lab-field lab-target' + (n % 2 ? '' : ' wide') + '" data-f="target">' +
          '<label for="' + tid + '">' + (K.lower ? 'Your limit' : 'Your target') + '</label>' +
          '<div class="lab-input"><input id="' + tid + '" name="target" type="number" min="1" max="100" step="0.1" inputmode="decimal"' +
          ' value="' + values[current].target + '" aria-describedby="' + tid + '-err"><span class="lab-unit" aria-hidden="true">%</span></div>' +
          '<p class="lab-err" id="' + tid + '-err"></p></div>';
      }
      fieldsEl.innerHTML = html;
      defEl.textContent = K.def;
      nameEl.textContent = K.name;
      if (unitEl) unitEl.textContent = num ? K.unit : '';
      bulletEl.hidden = num;
      if (plainEl) plainEl.textContent = K.teach.plain;
      if (eqEl) eqEl.textContent = K.teach.eq;
      if (whyEl) whyEl.textContent = K.teach.why;
    }

    function readInputs() {
      var v = {};
      [].slice.call(fieldsEl.querySelectorAll('input')).forEach(function (inp) {
        var n = parseFloat(inp.value);
        v[inp.name] = isNaN(n) ? NaN : n;
      });
      return v;
    }

    /* The bar runs 0–100% for "higher is better" rates. For "lower is
       better" ones (scrap, backorders) it runs 0–scale%, so a 2% result is
       still visible, and the good zone sits at the left, under the limit. */
    function setBullet(r, t, K) {
      var max = K.lower ? (K.scale || 100) : 100;
      var x = function (p) { return clamp(p, 0, max) / max * W; };
      if (K.lower) {
        var nearTo = Math.min(max, t * 1.5);
        bGood.setAttribute('x', 0);    bGood.setAttribute('width', x(t));
        bNear.setAttribute('x', x(t)); bNear.setAttribute('width', Math.max(0, x(nearTo) - x(t)));
      } else {
        var nearFrom = Math.max(0, t - 5);
        bNear.setAttribute('x', x(nearFrom)); bNear.setAttribute('width', Math.max(0, x(t) - x(nearFrom)));
        bGood.setAttribute('x', x(t));        bGood.setAttribute('width', Math.max(0, W - x(t)));
      }
      bBar.setAttribute('width', isNaN(r) ? 0 : x(r * 100));
      bTgt.setAttribute('x', x(t) - 1.2);
      tgtLabel.textContent = (K.lower ? 'Tick: your limit, ' : 'Tick: your target, ') + t + '%';
      if (scaleMax) scaleMax.textContent = (r * 100 > max ? max + '%+' : max + '%');
    }

    /* The odometer: one column of 0-9 per digit, rolled into place. The
       real value stays in the <output> for screen readers. */
    var odoEl = document.getElementById('lab-odo');
    var odoHost = odoEl && odoEl.parentNode;
    function odo(text) {
      if (!odoEl) return;
      var chars = text.split('');
      var shape = chars.map(function (c) { return /\d/.test(c) ? 'd' : c; }).join('');
      if (odoEl.getAttribute('data-shape') !== shape) {
        odoEl.setAttribute('data-shape', shape);
        odoEl.innerHTML = chars.map(function (c) {
          if (!/\d/.test(c)) return '<span class="odo-ch">' + (c === '<' ? '&lt;' : c) + '</span>';
          return '<span class="odo"><span class="odo-col"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span>';
        }).join('');
      }
      requestAnimationFrame(function () {
        var cols = odoEl.querySelectorAll('.odo-col'), n = 0;
        chars.forEach(function (c) {
          if (/\d/.test(c) && cols[n]) { cols[n].style.transform = 'translateY(' + (-parseInt(c, 10) * 10) + '%)'; n++; }
        });
      });
    }
    if (odoEl && !REDUCED) odoHost.classList.add('odo-on');

    function showValue(r) {
      var K = KPIS[current];
      if (odoEl && !REDUCED) {
        shown = r;
        var txt = isNaN(r) ? '—' : show(K, r);
        valueEl.textContent = txt;
        odo(txt);
        return;
      }
      var from = shown, to = r;
      shown = r;
      if (REDUCED || isNaN(from) || isNaN(to)) { valueEl.textContent = isNaN(to) ? '—' : show(K, to); return; }
      var t0 = null, dur = 380;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        valueEl.textContent = show(K, from + (to - from) * easeOut(p));
        if (p < 1 && shown === to) requestAnimationFrame(frame);
        else if (shown === to) valueEl.textContent = show(K, to);
      }
      requestAnimationFrame(frame);
    }

    function compute() {
      var K = KPIS[current], num = isNum(K);
      var v = readInputs();
      [].slice.call(fieldsEl.querySelectorAll('.lab-field')).forEach(function (f) {
        f.classList.remove('bad'); f.querySelector('.lab-err').textContent = '';
      });

      var problem = null;
      Object.keys(v).forEach(function (k) {
        if (!problem && (isNaN(v[k]) || v[k] < 0)) problem = [k, 'Enter a number, zero or more.'];
      });
      if (!problem && !num && !(v.target > 0 && v.target <= 100)) problem = ['target', 'Pick a ' + (K.lower ? 'limit' : 'target') + ' between 1 and 100.'];
      if (!problem) problem = K.check(v) || null;
      var r = problem ? NaN : K.calc(v);
      if (!problem && !isFinite(r)) problem = [K.fields[0].id, 'Those numbers don’t give an answer. Check them again.'];

      if (problem) {
        var bad = fieldsEl.querySelector('.lab-field[data-f="' + problem[0] + '"]');
        if (bad) { bad.classList.add('bad'); bad.querySelector('.lab-err').textContent = problem[1]; }
        showValue(NaN);
        formulaEl.textContent = 'Fix the highlighted number to see the result.';
        readEl.textContent = problem[1];
        factorsEl.hidden = true;
        labTool.style.setProperty('--lab-tone', 'var(--danger)');
        if (!num) setBullet(NaN, isNaN(v.target) ? K.target : clamp(v.target, 1, 100), K);
        return;
      }

      Object.keys(v).forEach(function (k) { values[current][k] = v[k]; });
      var suspect = !!(K.suspect && K.suspect(v));
      var good, head = '';
      if (num) {
        good = !K.tone || K.tone(v, r) !== 'warn';
        formulaEl.textContent = K.formula(v) + ' = ' + K.fmt(r) + ' ' + K.unit;
      } else {
        var t = v.target, val = r * 100;
        var gap = K.lower ? t - val : val - t;          // above zero = the good side
        var word = K.lower ? 'limit' : 'target';
        good = gap >= -1e-9;
        formulaEl.textContent = K.formula(v) + ' = ' + pct(r);
        setBullet(r, t, K);
        head = suspect ? ''
          : Math.abs(gap) < 0.05 ? 'Right on your ' + t + '% ' + word + '. '
          : good ? pts(gap) + (K.lower ? ' under' : ' above') + ' your ' + t + '% ' + word + '. '
          : pts(gap) + (K.lower ? ' over' : ' below') + ' your ' + t + '% ' + word + '. ';
      }
      labTool.style.setProperty('--lab-tone', good && !suspect ? 'var(--match)' : 'var(--count)');
      showValue(r);

      if (K.factors) {
        var fs = K.factors(v, r);
        var nums = fs.filter(function (f) { return typeof f[1] === 'number'; }).map(function (f) { return f[1]; });
        var low = K.factorsLow && nums.length ? Math.min.apply(null, nums) : null;
        factorsEl.innerHTML = fs.map(function (f) {
          var shownVal = typeof f[1] === 'number' ? pct(f[1]) : f[1];
          return '<li' + (f[1] === low ? ' class="low"' : '') + '><b>' + f[0] + '</b><span class="f-val">' + shownVal + '</span><span>' + f[2] + '</span></li>';
        }).join('');
        factorsEl.hidden = false;
      } else {
        factorsEl.hidden = true;
      }

      readEl.textContent = head + K.read(v, r);
    }

    /* ==================================================================
       THE APP: measures, menus, save, download, print, exit, full screen
       and, on phones, the take-over.
       ================================================================== */
    var GROUPS = [
      ['Inventory', ['accuracy', 'turns', 'dos']],
      ['Ordering tools', ['rop', 'safety', 'eoq']],
      ['Orders and shipping', ['fill', 'ontime', 'perfect', 'backorder', 'pph']],
      ['Plant floor', ['oee', 'scrap', 'takt']]
    ];
    function groupOf(k) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][1].indexOf(k) >= 0) return GROUPS[i][0]; return ''; }
    var docEl = document.getElementById('kapp-doc'), catEl = document.getElementById('lab-cat');
    var stL = document.getElementById('kapp-st-l'), stR = document.getElementById('kapp-st-r');
    var bodyEl = document.getElementById('kapp-body');
    var stTimer = null;
    function status(msg, keep) {
      if (!stL) return;
      stL.textContent = msg;
      clearTimeout(stTimer);
      if (!keep) stTimer = setTimeout(function () { stL.textContent = 'Ready'; }, 6000);
    }

    /* ---------- Google Tag Manager & Google Analytics (TECHNICAL §4.20, §4.23) ----------
       Pushes custom events to window.dataLayer for GTM / GA4.
       Sends measure name, OS version, runtime, time of use, viewport, and platform.
       NEVER sends typed numbers or private values. Respects analytics=off and GPC. */
    var sessionStart = Date.now();
    var sessionActiveSeconds = 0;
    var lastActiveTick = Date.now();
    var viewedMeasuresMap = {};
    var calculationCount = 0;
    var actionCount = 0;

    function getSystemMetrics() {
      var m = {};
      try {
        var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
        var os = 'Unknown OS';
        var osVer = 'standard';
        if (/Windows NT 10.0/i.test(ua)) { os = 'Windows'; osVer = '10/11'; }
        else if (/Windows NT 6.3/i.test(ua)) { os = 'Windows'; osVer = '8.1'; }
        else if (/Windows NT 6.1/i.test(ua)) { os = 'Windows'; osVer = '7'; }
        else if (/Mac OS X ([0-9_]+)/i.test(ua)) { os = 'macOS'; osVer = RegExp.$1.replace(/_/g, '.'); }
        else if (/iPhone|iPad|iPod/i.test(ua)) { os = 'iOS'; }
        else if (/Android ([0-9.]+)/i.test(ua)) { os = 'Android'; osVer = RegExp.$1; }
        else if (/Linux/i.test(ua)) { os = 'Linux'; }
        m.os_name = os;
        m.os_version = osVer;

        var d = new Date();
        var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        m.local_hour = d.getHours();
        m.local_day = days[d.getDay()];
        m.time_of_use = days[d.getDay()] + ' ' + d.getHours() + ':00';
        try { m.user_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}

        var sw = typeof window !== 'undefined' && window.screen ? window.screen.width : 0;
        var sh = typeof window !== 'undefined' && window.screen ? window.screen.height : 0;
        var vw = typeof window !== 'undefined' ? window.innerWidth : 0;
        var vh = typeof window !== 'undefined' ? window.innerHeight : 0;
        m.screen_resolution = sw + 'x' + sh;
        m.viewport_size = vw + 'x' + vh;
        m.device_category = vw >= 1200 ? 'desktop_wide' : (vw >= 900 ? 'desktop' : (vw >= 600 ? 'tablet' : 'mobile'));

        m.theme_mode = root.getAttribute('data-theme') || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        m.reduced_motion = root.classList.contains('no-motion');
        m.is_online = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
        if (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.effectiveType) {
          m.connection_type = navigator.connection.effectiveType;
        }
        m.runtime_seconds = Math.round((Date.now() - sessionStart) / 1000);
        m.active_duration_seconds = sessionActiveSeconds;
        m.session_measures_count = Object.keys(viewedMeasuresMap).length;
      } catch (e) {}
      return m;
    }

    function trackKpi(eventName, extra) {
      try {
        if (typeof window === 'undefined') return;
        var off = false;
        try {
          off = /(?:^|;\s*)analytics=off\b/.test(document.cookie) || navigator.globalPrivacyControl === true;
        } catch (e) {}
        if (off) return;

        window.dataLayer = window.dataLayer || [];
        var mid = (extra && extra.measure_id) || current;
        var mname = (extra && extra.measure_name) || (KPIS[mid] && KPIS[mid].name) || mid;
        var mgrp = (extra && extra.measure_group) || groupOf(mid);
        var sys = getSystemMetrics();
        var data = {
          event: eventName,
          measure_id: mid,
          measure_name: mname,
          measure_group: mgrp,
          app_platform: PWA ? 'pwa' : (ELECTRON ? 'desktop' : 'website'),
          content_type: 'kpi_measure',
          item_id: mid,
          item_name: mname,
          os_name: sys.os_name,
          os_version: sys.os_version,
          local_hour: sys.local_hour,
          local_day: sys.local_day,
          time_of_use: sys.time_of_use,
          screen_resolution: sys.screen_resolution,
          viewport_size: sys.viewport_size,
          device_category: sys.device_category,
          theme_mode: sys.theme_mode,
          reduced_motion: sys.reduced_motion,
          is_online: sys.is_online,
          runtime_seconds: sys.runtime_seconds,
          active_duration_seconds: sys.active_duration_seconds,
          session_measures_count: sys.session_measures_count
        };
        if (sys.user_timezone) data.user_timezone = sys.user_timezone;
        if (sys.connection_type) data.connection_type = sys.connection_type;
        if (extra) {
          for (var p in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, p)) {
              data[p] = extra[p];
            }
          }
        }
        window.dataLayer.push(data);
        if (typeof window.__electronTelemetry === 'function') {
          try { window.__electronTelemetry(data); } catch (te) {}
        }
      } catch (e) {}
    }

    function setMeasure(k, quiet) {
      if (!KPIS[k]) return;
      viewedMeasuresMap[k] = true;
      var prev = current;
      current = k;
      renderFields(); compute();
      if (docEl) docEl.textContent = KPIS[k].name;
      if (catEl) catEl.textContent = groupOf(k);
      [].forEach.call(kapp.querySelectorAll('[data-kpi]'), function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-kpi') === k)); });
      if (!quiet && teachEl && !REDUCED) { teachEl.classList.remove('swap'); void teachEl.offsetWidth; teachEl.classList.add('swap'); }
      if (!quiet) status(KPIS[k].name);
      if (!quiet) {
        trackKpi('kpi_measure_select', {
          measure_id: k,
          measure_name: KPIS[k].name,
          measure_group: groupOf(k),
          previous_measure: prev
        });
      }
    }

    /* ---------- the Measures menu is built from KPIS, grouped ---------- */
    /* One line per measure, in plain words (16 Oct 2026, John: "little definitions that slide out so you know
       the term before even opening it"). Desktop: a card slides out beside the item you point at or arrow to.
       Phones (no hover): the line sits under the name. */
    var HINT = {
      accuracy: 'How often the computer’s count matches what’s really on the shelf.',
      turns: 'How many times a year you sell and replace your whole stock.',
      dos: 'How many days your stock will last at today’s sales pace.',
      rop: 'The stock level that tells you it’s time to order more.',
      safety: 'Spare stock kept for late trucks and busy weeks.',
      eoq: 'The order size that balances the cost of ordering against the cost of storing.',
      fill: 'The share of what customers asked for that you actually shipped.',
      ontime: 'The share of orders that left on or before the date you promised.',
      perfect: 'The share of orders that were on time, complete, undamaged and billed right.',
      backorder: 'The share of order lines you couldn’t ship because the item was out of stock.',
      pph: 'How many order lines a worker picks off the shelves each hour.',
      oee: 'How much of a machine’s planned time turns into good parts at full speed.',
      scrap: 'The share of everything you made that had to be thrown away.',
      takt: 'How often one finished unit has to come off the line to meet what customers order.'
    };
    var mPop = document.getElementById('km-measures-pop');
    var mList = null;                              // the scrolling list inside the Measures menu
    if (mPop) { mList = document.createElement('div'); mList.className = 'km-list'; mList.setAttribute('role', 'none'); mPop.appendChild(mList); }

    /* the slide-out card (desktop). It repeats what screen readers already hear from the item's own
       text (.km-hint), so it is aria-hidden. */
    var fly = null, flyBtn = null, flyHideT = 0;
    function flyKind(k) {
      var m = KPIS[k];
      if (m.kind === 'num') return ['Planning tool', 'plan'];
      return m.lower ? ['Lower is better', 'low'] : ['Higher is better', 'high'];
    }
    function flyPlace() {
      if (!fly || !flyBtn || fly.hidden) return;
      var pad = 6, rowTop = mPop.offsetTop + mList.offsetTop + flyBtn.offsetTop - mList.scrollTop;
      var h = fly.offsetHeight, w = fly.offsetWidth;
      var minTop = mPop.offsetTop, maxTop = mPop.offsetTop + mPop.offsetHeight - h;
      var top = Math.max(minTop, Math.min(rowTop - pad, maxTop));
      /* to the right of the menu, or to the left when the window has no room */
      var host = fly.parentNode.getBoundingClientRect(), win = kapp.getBoundingClientRect();
      /* flush against the menu's edge, sharing its border (16 Oct 2026, John: "right up against") */
      var left = mPop.offsetLeft + mPop.offsetWidth - 1, side = 'r';
      if (host.left + left + w > Math.min(window.innerWidth, win.right) - 8) { left = mPop.offsetLeft - w + 1; side = 'l'; }
      fly.style.top = top + 'px'; fly.style.left = left + 'px';
      fly.setAttribute('data-side', side);
      fly.style.setProperty('--row-top', Math.round(rowTop - top) + 'px');
      fly.style.setProperty('--row-h', flyBtn.offsetHeight + 'px');
    }
    function flyShow(btn) {
      if (!fly || !btn) return;
      var k = btn.getAttribute('data-kpi'); if (!HINT[k]) return;
      clearTimeout(flyHideT);
      var was = !fly.hidden;
      flyBtn = btn;
      var kind = flyKind(k);
      fly.querySelector('.km-fly-g').textContent = groupOf(k);
      fly.querySelector('.km-fly-n').textContent = KPIS[k].name;
      fly.querySelector('.km-fly-d').textContent = HINT[k];
      var tag = fly.querySelector('.km-fly-tag'); tag.textContent = kind[0]; tag.setAttribute('data-k', kind[1]);
      fly.classList.toggle('is-current', k === current);
      fly.hidden = false;
      fly.classList.toggle('glide', was);           // already open: glide to the new row, don't re-slide
      if (!was) { fly.classList.remove('in', 'opening'); void fly.offsetWidth; }
      flyPlace();
      /* the words rise in, one after another, every time the measure changes */
      fly.classList.remove('swap'); void fly.offsetWidth; fly.classList.add('swap');
      fly.classList.add('in');
      if (!was) fly.classList.add('opening');      // one light sweep across a newly opened card
    }
    function flyHide(now) {
      clearTimeout(flyHideT);
      var go = function () { if (fly) { fly.hidden = true; fly.classList.remove('in', 'glide', 'swap', 'opening'); } flyBtn = null; };
      if (now) go(); else flyHideT = setTimeout(go, 90);   // a short grace, so moving row to row doesn't blink
    }
    if (mPop) {
      fly = document.createElement('div');
      fly.className = 'km-fly'; fly.hidden = true; fly.setAttribute('aria-hidden', 'true');
      fly.innerHTML = '<p class="km-fly-g"></p><p class="km-fly-n"></p><p class="km-fly-d"></p>' +
        '<p class="km-fly-f"><span class="km-fly-tag"></span><span class="km-fly-go"><kbd>Enter</kbd> or click to open</span></p>';
      mPop.parentNode.appendChild(fly);
      mList.addEventListener('scroll', flyPlace, { passive: true });
      /* pointer leaves the menu: the card goes back to the item that has keyboard focus, or away */
      mPop.addEventListener('mouseleave', function () {
        var a = document.activeElement;
        if (a && mPop.contains(a) && a.classList.contains('km-i')) flyShow(a); else flyHide();
      });
    }
    if (mPop) GROUPS.forEach(function (g) {
      var h = document.createElement('p'); h.className = 'km-h'; h.setAttribute('role', 'presentation'); h.textContent = g[0]; mList.appendChild(h);
      g[1].forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'km-i'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('data-kpi', k);
        b.setAttribute('aria-checked', String(k === current)); b.tabIndex = -1;
        b.innerHTML = '<span class="km-tick" aria-hidden="true"></span><span class="km-t"></span><span class="km-hint"></span>';
        b.querySelector('.km-t').textContent = KPIS[k].name;
        b.querySelector('.km-hint').textContent = HINT[k] || '';
        b.addEventListener('mouseenter', function () { flyShow(b); });
        b.addEventListener('focus', function () { flyShow(b); });
        b.addEventListener('blur', function () { flyHide(); });
        /* phones: a "?" beside each measure slides open a small card under it (16 Oct 2026, John: "make it
           somehow work on mobile too"). Tapping the name still opens the measure at once. */
        var row = document.createElement('div'); row.className = 'km-row'; row.setAttribute('role', 'none');
        var info = document.createElement('button');
        info.type = 'button'; info.className = 'km-info'; info.tabIndex = -1;
        info.setAttribute('aria-expanded', 'false'); info.setAttribute('aria-controls', 'km-peek-' + k);
        info.setAttribute('aria-label', 'What is ' + KPIS[k].name + '?');
        var peek = document.createElement('div'); peek.className = 'km-peek'; peek.id = 'km-peek-' + k; peek.setAttribute('role', 'none');
        var kind = flyKind(k);
        peek.innerHTML = '<div class="km-peek-in"><p class="km-peek-d"></p><p class="km-peek-f"><span class="km-fly-tag"></span>' +
          '<button type="button" class="km-peek-open" tabindex="-1">Open <span aria-hidden="true">&rsaquo;</span></button></p></div>';
        peek.querySelector('.km-peek-d').textContent = HINT[k] || '';
        var ptag = peek.querySelector('.km-fly-tag'); ptag.textContent = kind[0]; ptag.setAttribute('data-k', kind[1]);
        peek.querySelector('.km-peek-open').addEventListener('click', function (e) { e.stopPropagation(); b.click(); });
        info.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = !row.classList.contains('is-peek');
          [].forEach.call(mPop.querySelectorAll('.km-row.is-peek'), function (r) {
            r.classList.remove('is-peek'); r.querySelector('.km-info').setAttribute('aria-expanded', 'false');
          });
          if (!open) return;
          row.classList.add('is-peek'); info.setAttribute('aria-expanded', 'true');
          peek.classList.remove('swap'); void peek.offsetWidth; peek.classList.add('swap');
          setTimeout(function () { try { row.scrollIntoView({ block: 'nearest', behavior: moving() ? 'smooth' : 'auto' }); } catch (x) {} }, 230);
        });
        row.appendChild(b); row.appendChild(info); row.appendChild(peek);
        mList.appendChild(row);
      });
    });

    /* ---------- the Measures menu's own scroll bar (16 Oct 2026; restyled to match the title bar) ----------
       John: "the measure menu need to have a old school interface scrolling bar on the right side on mobile
       and desktop". Built in the page, because phones won't let a site style their own scroll bars:
       ▲ and ▼ buttons (hold to keep scrolling), a dotted track (press to jump a page) and a box you drag. */
    var rail = null, railSync = function () {};
    if (mPop) (function () {
      rail = document.createElement('div'); rail.className = 'km-rail'; rail.setAttribute('aria-hidden', 'true');
      var chev = function (d) { return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; };
      rail.innerHTML = '<span class="km-rail-b km-rail-up">' + chev('M3.5 10l4.5-4.5 4.5 4.5') + '</span>' +
        '<span class="km-rail-t"><span class="km-rail-th"></span></span>' +
        '<span class="km-rail-b km-rail-dn">' + chev('M3.5 6l4.5 4.5 4.5-4.5') + '</span>';
      mPop.appendChild(rail);
      var up = rail.querySelector('.km-rail-up'), dn = rail.querySelector('.km-rail-dn');
      var track = rail.querySelector('.km-rail-t'), thumb = rail.querySelector('.km-rail-th');
      var STEP = 40, holdT = 0, repT = 0;
      function maxScroll() { return Math.max(0, mList.scrollHeight - mList.clientHeight); }
      railSync = function () {
        var max = maxScroll();
        mPop.classList.toggle('has-rail', max > 1);
        if (max <= 1) return;
        var th = track.clientHeight, size = Math.max(30, Math.round(th * mList.clientHeight / mList.scrollHeight));
        thumb.style.height = size + 'px';
        thumb.style.transform = 'translateY(' + Math.round((th - size) * mList.scrollTop / max) + 'px)';
        up.classList.toggle('off', mList.scrollTop <= 0);
        dn.classList.toggle('off', mList.scrollTop >= max - 1);
      };
      function stop() { clearTimeout(holdT); clearInterval(repT); [up, dn, track].forEach(function (x) { x.classList.remove('down'); }); }
      function hold(el, fn) {
        el.addEventListener('pointerdown', function (e) {
          e.preventDefault(); e.stopPropagation(); stop();
          el.classList.add('down'); fn(e);
          holdT = setTimeout(function () { repT = setInterval(function () { fn(e); }, 55); }, 380);
        });
      }
      hold(up, function () { mList.scrollTop -= STEP; });
      hold(dn, function () { mList.scrollTop += STEP; });
      hold(track, function (e) {
        if (e.target === thumb) return;
        var r = thumb.getBoundingClientRect(), page = mList.clientHeight * .9;
        if (e.clientY < r.top) mList.scrollTop -= page; else if (e.clientY > r.bottom) mList.scrollTop += page; else stop();
      });
      ['pointerup', 'pointercancel', 'blur'].forEach(function (t) { window.addEventListener(t, stop); });
      /* drag the box */
      thumb.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var y0 = e.clientY, s0 = mList.scrollTop, room = track.clientHeight - thumb.offsetHeight;
        thumb.classList.add('drag'); try { thumb.setPointerCapture(e.pointerId); } catch (x) {}
        function move(ev) { if (room > 0) mList.scrollTop = s0 + (ev.clientY - y0) * maxScroll() / room; }
        function end() { thumb.classList.remove('drag'); thumb.removeEventListener('pointermove', move); thumb.removeEventListener('pointerup', end); thumb.removeEventListener('pointercancel', end); }
        thumb.addEventListener('pointermove', move); thumb.addEventListener('pointerup', end); thumb.addEventListener('pointercancel', end);
      });
      /* the wheel over the bar scrolls the list */
      rail.addEventListener('wheel', function (e) { mList.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
      mList.addEventListener('scroll', railSync, { passive: true });
      mList.addEventListener('transitionend', railSync);      // a "?" card opening or closing on phones
      window.addEventListener('resize', railSync);
    })();

    /* ---------- menus: a classic menu bar, by mouse, touch or keyboard ---------- */
    var bar = document.getElementById('kapp-menus');
    var tops = bar ? [].slice.call(bar.querySelectorAll('.km-top')) : [];
    var openTop = null, hoverOpened = null;
    function itemsOf(top) { return [].slice.call(top.nextElementSibling.querySelectorAll('[role^="menuitem"]:not([hidden]):not([disabled])')); }
    function closeMenus(focusTop) {
      if (!openTop) return;
      var t = openTop; openTop = null; hoverOpened = null;
      t.setAttribute('aria-expanded', 'false'); t.nextElementSibling.hidden = true; flyHide(true);
      [].forEach.call(t.nextElementSibling.querySelectorAll('.km-row.is-peek'), function (r) { r.classList.remove('is-peek'); r.querySelector('.km-info').setAttribute('aria-expanded', 'false'); });
      kapp.classList.remove('menu-open');
      if (focusTop) t.focus();
    }
    /* a menu never runs past the bottom of the window: it is as tall as the room below it, and scrolls
       (with the big bar and its arrows) when the list is longer (16 Oct 2026) */
    function fitMenu(pop) {
      if (!pop) return;
      pop.style.maxHeight = '';
      var room = Math.floor(window.innerHeight - pop.getBoundingClientRect().top - 12);
      var css = parseFloat(getComputedStyle(pop).maxHeight) || Infinity;
      if (room < css) pop.style.maxHeight = Math.max(160, room) + 'px';
      if (pop === mPop) railSync();
    }
    var fitTick = 0;
    window.addEventListener('scroll', function () {
      if (!openTop || fitTick) return;
      fitTick = requestAnimationFrame(function () { fitTick = 0; if (openTop) fitMenu(openTop.nextElementSibling); });
    }, { passive: true });
    window.addEventListener('resize', function () { if (openTop) fitMenu(openTop.nextElementSibling); });
    function openMenu(top, focus) {
      if (openTop && openTop !== top) closeMenus(false);
      openTop = top; refreshChecks();
      top.setAttribute('aria-expanded', 'true'); top.nextElementSibling.hidden = false;
      kapp.classList.add('menu-open');
      fitMenu(top.nextElementSibling);
      if (focus) {
        var its = itemsOf(top), on = top.nextElementSibling.querySelector('[aria-checked="true"][data-kpi]');
        (focus === 'last' ? its[its.length - 1] : (on || its[0])).focus();
      }
    }
    tops.forEach(function (t, i) {
      /* Classic menu bar: once one menu is open, pointing at another opens it.
         The click that usually follows must not then close it again (the bug
         John found in Brave, 15 Oct 2026: every second menu "did nothing"). */
      t.addEventListener('click', function () {
        if (openTop === t && hoverOpened !== t) closeMenus(false);
        else if (openTop !== t) openMenu(t, 'first');
        hoverOpened = null;
      });
      t.addEventListener('mouseenter', function () { if (openTop && openTop !== t) { openMenu(t, false); hoverOpened = t; } });
      t.addEventListener('mouseleave', function () { if (hoverOpened === t) setTimeout(function () { if (hoverOpened === t) hoverOpened = null; }, 600); });
      t.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowLeft') {
          e.preventDefault();
          var n = tops[(i + (k === 'ArrowRight' ? 1 : tops.length - 1)) % tops.length];
          if (openTop) openMenu(n, 'first'); else n.focus();
        } else if (k === 'ArrowDown' || k === 'Enter' || k === ' ') { e.preventDefault(); openMenu(t, 'first'); }
        else if (k === 'ArrowUp') { e.preventDefault(); openMenu(t, 'last'); }
        else if (k === 'Escape') { closeMenus(true); }
      });
      t.nextElementSibling.addEventListener('keydown', function (e) {
        var its = itemsOf(t), at = its.indexOf(document.activeElement), k = e.key;
        if (k === 'ArrowDown') { e.preventDefault(); its[(at + 1) % its.length].focus(); }
        else if (k === 'ArrowUp') { e.preventDefault(); its[(at - 1 + its.length) % its.length].focus(); }
        else if (k === 'Home') { e.preventDefault(); its[0].focus(); }
        else if (k === 'End') { e.preventDefault(); its[its.length - 1].focus(); }
        else if (k === 'Escape') { e.preventDefault(); closeMenus(true); }
        else if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); openMenu(tops[(i + (k === 'ArrowRight' ? 1 : tops.length - 1)) % tops.length], 'first'); }
        else if (k === 'Tab') { closeMenus(false); }
      });
    });
    document.addEventListener('pointerdown', function (e) { if (openTop && !bar.contains(e.target) && !(changeBtn && changeBtn.contains(e.target))) closeMenus(false); });

    function refreshChecks() {
      var dark = root.getAttribute('data-theme') === 'dark';
      var dm = kapp.querySelector('[data-cmd="dark"]'); if (dm) dm.setAttribute('aria-checked', String(dark));
      var lc = kapp.querySelector('[data-cmd="lessons"]'); if (lc) lc.setAttribute('aria-checked', String(!kapp.classList.contains('no-lessons')));
      var fs = kapp.querySelector('[data-cmd="full"]'); if (fs) fs.querySelector('.km-t').textContent = isFull() ? 'Leave full screen' : 'Full screen';
      var hasSave = !!readSaved(); var op = kapp.querySelector('[data-cmd="open"]'); if (op) op.disabled = !hasSave;
      var cl = kapp.querySelector('[data-cmd="clear"]'); if (cl) cl.disabled = !hasSave;
    }

    /* "Change measure" under the title opens the Measures menu */
    var changeBtn = document.getElementById('lab-change');
    var measuresTop = document.getElementById('km-measures');
    if (changeBtn && measuresTop) changeBtn.addEventListener('click', function () {
      if (openTop === measuresTop) closeMenus(false);
      else { try { bar.scrollIntoView({ block: 'nearest' }); } catch (e) {} openMenu(measuresTop, 'first'); }
    });

    kapp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kpi], [data-cmd]');
      if (!b || !kapp.contains(b) || b.disabled) return;
      var k = b.getAttribute('data-kpi');
      closeMenus(false);
      if (k) { setMeasure(k); return; }
      run(b.getAttribute('data-cmd'));
    });

    /* ---------- save and open (this browser's own storage, never sent) ---------- */
    var SAVE_KEY = 'jg-kpi-lab';
    function readSaved() { try { var s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
    function when(iso) {
      try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
    }
    function save() {
      var data = { v: 1, current: current, values: values, saved: new Date().toISOString() };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); status('Saved on this device, ' + when(data.saved) + '.'); }
      catch (e) { status('This browser wouldn’t let me save. Try File > Download instead.'); }
    }
    function open(quiet) {
      var s = readSaved();
      if (!s) { if (!quiet) status('Nothing saved yet. Use File > Save first.'); return false; }
      Object.keys(s.values || {}).forEach(function (k) {
        if (!values[k]) return;
        Object.keys(values[k]).forEach(function (f) { var n = Number(s.values[k][f]); if (isFinite(n)) values[k][f] = n; });
      });
      setMeasure(KPIS[s.current] ? s.current : current, true);
      status('Opened your numbers saved ' + when(s.saved) + '.');
      return true;
    }
    function clearSaved() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} status('Saved numbers deleted from this device.'); }

    /* ---------- results as plain data, for download and copy ---------- */
    function resultFor(k) {
      var K = KPIS[k], v = values[k], num = isNum(K), problem = null;
      Object.keys(v).forEach(function (f) { if (!problem && (isNaN(v[f]) || v[f] < 0)) problem = 'Enter a number, zero or more.'; });
      if (!problem) { var c = K.check(v); if (c) problem = c[1]; }
      var r = problem ? NaN : K.calc(v);
      if (!problem && !isFinite(r)) problem = 'Those numbers don’t give an answer.';
      var inputs = K.fields.map(function (f) { return f.label + ': ' + NUM(v[f.id]) + (f.unit && f.unit !== '$' ? ' ' + f.unit : ''); });
      if (!num) inputs.push((K.lower ? 'Limit: ' : 'Target: ') + v.target + '%');
      return {
        name: K.name, group: groupOf(k), inputs: inputs.join('; '),
        result: problem ? '' : (num ? K.fmt(r) + ' ' + K.unit : pct(r)),
        working: problem ? '' : K.formula(v), formula: K.teach.eq,
        reading: problem ? problem : K.read(v, r)
      };
    }
    function csvCell(s) { s = String(s == null ? '' : s); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function download(all) {
      var keys = all ? GROUPS.reduce(function (a, g) { return a.concat(g[1]); }, []) : [current];
      var head = ['Measure', 'Group', 'Your numbers', 'Result', 'Working', 'Formula', 'What it means'];
      var rows = keys.map(function (k) { var x = resultFor(k); return [x.name, x.group, x.inputs, x.result, x.working, x.formula, x.reading]; });
      var csv = '﻿' + [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
      var day = new Date(), stamp = day.getFullYear() + '-' + ('0' + (day.getMonth() + 1)).slice(-2) + '-' + ('0' + day.getDate()).slice(-2);
      var name = 'kpi-lab-' + (all ? 'all' : current) + '-' + stamp + '.csv';
      try {
        var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
        status('Downloaded ' + name + '.');
        trackKpi('kpi_download', { download_type: all ? 'csv_all_14' : 'csv_single', filename: name, measure_id: current });
      } catch (e) { status('This browser wouldn’t download the file.'); }
    }
    function copyResult() {
      var x = resultFor(current);
      var text = x.name + ': ' + (x.result || 'no result yet') + (x.working ? ' (' + x.working + ')' : '') + '. ' + x.reading;
      var done = function () { status('Result copied.'); }, fail = function () { status('Couldn’t copy here. Select the text instead.'); };
      try { navigator.clipboard.writeText(text).then(done, fail); } catch (e) { fail(); }
    }
    function resetOne(k) {
      var K = KPIS[k]; values[k] = { target: K.target };
      K.fields.forEach(function (f) { values[k][f.id] = f.value; });
    }

    /* ---------- dialogs: one small window inside the app ---------- */
    var dlg = document.getElementById('kapp-dlg'), dlgH = document.getElementById('kapp-dlg-h'), dlgB = document.getElementById('kapp-dlg-b');
    var dlgBack = null;
    var DIALOGS = {
      howto: ['How to use KPI Lab', '<ol><li>Pick a measure from the <b>Measures</b> menu, or press <b>Change measure</b>.</li><li>Change the numbers. The result, the bar and the reading update as you type.</li><li>Under the result, the lesson cards explain it in plain words, show the formula and say why it matters.</li><li><b>File &gt; Save</b> keeps your numbers on this device. <b>File &gt; Download</b> gives you a spreadsheet file.</li></ol>'],
      kpi: ['What is a KPI?', '<p>A KPI (key performance indicator) is one number that tells you how something is going, like a grade on a report card.</p><p>A good KPI has a clear formula, a target you agree on ahead of time, and someone who acts when it slips.</p>'],
      about: ['About KPI Lab', '<p><b>KPI Lab 1.0</b>, by John Goliash.</p><p>Fourteen measures and planning tools for inventory, ordering, shipping and the plant floor. It runs on your device. Nothing you type is sent anywhere.</p><p class="kapp-links"><a href="https://john.goliash.com/" target="_blank" rel="noopener">My website: john.goliash.com</a><br><a href="https://john.goliash.com/files/Example_Resume.pdf" target="_blank" rel="noopener">My résumé (PDF)</a></p>'],
    };
    function openDialog(id) {
      var d = id === 'app' ? appDialog() : id === 'install' ? installDialog() : DIALOGS[id];
      if (!dlg || !d) return;
      dlgBack = document.activeElement;
      dlgH.textContent = d[0]; dlgB.innerHTML = d[1];
      dlg.hidden = false; kapp.classList.add('dlg-open');
      var f = dlg.querySelector('.kapp-dlg-x'); if (f) f.focus();
    }
    function closeDialog() {
      if (!dlg || dlg.hidden) return;
      dlg.hidden = true; kapp.classList.remove('dlg-open');
      if (dlgBack && dlgBack.focus) dlgBack.focus();
    }
    if (dlg) {
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.kapp-dlg-x, .kapp-dlg-ok')) closeDialog(); });
      dlg.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); } });
    }

    /* ---------- install and download (16 Oct 2026, TECHNICAL §4.25) ----------
       John: "the download should be a self executable app, one for Mac, one for PC and one for Linux;
       there should be an icon creating on mobile; the app should be cross platform". */
    var ua = navigator.userAgent || '';
    var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/.test(ua);
    function osName() {
      var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '') + ' ' + ua;
      if (isIOS || isAndroid) return 'phone';
      if (/Win/i.test(p)) return 'win';
      if (/Mac/i.test(p)) return 'mac';
      if (/Linux|X11|CrOS/i.test(p)) return 'linux';
      return '';
    }
    function standalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
    var installEvt = null;
    var instBtn = document.getElementById('kapp-install');
    function showInstallChip() { if (instBtn) instBtn.hidden = !(PWA && !standalone() && (installEvt || isIOS)); }
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; showInstallChip(); });
    window.addEventListener('appinstalled', function () { installEvt = null; showInstallChip(); status('Installed. Look for KPI Lab with your other apps.', true); });
    if (instBtn) instBtn.addEventListener('click', function () { installApp(); });
    var ICON = {
      win: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M1 3l5.5-.8v5.3H1zM7.5 2.1L15 1v6.5H7.5zM1 8.5h5.5v5.3L1 13zM7.5 8.5H15V15l-7.5-1.1z"/></svg>',
      mac: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="9" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 14h5M8 11.5V14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      linux: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M3 3.5l3 3-3 3M7.5 12h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      phone: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><rect x="4" y="1.5" width="8" height="13" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 12.3h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    };
    function card(os, name, links, note, you) {
      return '<div class="kdl' + (you ? ' is-you' : '') + '"><span class="kdl-ico">' + ICON[os] + '</span>' +
        '<p class="kdl-n">' + name + (you ? '<small>your computer</small>' : '') + '</p>' +
        '<p class="kdl-links">' + links + '</p>' + (note ? '<p class="kdl-note">' + note + '</p>' : '') + '</div>';
    }
    function appDialog() {
      var me = osName(), base = GITHUB_REPO ? 'https://github.com/' + GITHUB_REPO + '/releases/latest/download/' : '';
      var a = function (file, label) { return base ? '<a href="' + base + file + '" rel="noopener">' + label + '</a>' : '<span class="kdl-soon">' + label + ': coming soon</span>'; };
      var cards = [
        ['win', 'Windows', a('KPI-Lab-Setup.exe', 'Installer (.exe)') + a('KPI-Lab-Portable.exe', 'No-install version (.exe)'),
          'Windows may say it protected your PC: choose <b>More info</b>, then <b>Run anyway</b>.'],
        ['mac', 'Mac', a('KPI-Lab-mac-arm64.dmg', 'Apple chip (M1 and newer)') + a('KPI-Lab-mac-x64.dmg', 'Intel'),
          'The first time, open it, then go to <b>System Settings &rsaquo; Privacy &amp; Security</b> and choose <b>Open Anyway</b>. It isn&rsquo;t signed with a paid Apple account yet.'],
        ['linux', 'Linux', a('KPI-Lab-linux-x86_64.AppImage', 'AppImage') + a('KPI-Lab-linux-amd64.deb', '.deb (Ubuntu, Debian)'),
          'For the AppImage: right-click it, <b>Properties &rsaquo; Allow executing</b>, then double-click.']
      ];
      if (me !== 'phone') cards.sort(function (x, y) { return (y[0] === me) - (x[0] === me); });
      var html = '<p>KPI Lab in its own window. It works without the internet and nothing you type is sent anywhere.</p><div class="kdl-grid">' +
        cards.map(function (c) { return card(c[0], c[1], c[2], c[3], c[0] === me); }).join('') + '</div>';
      if (!base) html += '<p class="kdl-note">The ready-made apps are being built. Until then, <b>File &rsaquo; Install on this device</b> gives you the same lab with its own icon, or <a href="files/kpi-lab-desktop.zip" download>download the source</a> and run <code>npm install</code> then <code>npm start</code>.</p>';
      else html += '<p class="kdl-note">On a phone? Use <b>File &rsaquo; Install on this device</b> instead.</p>';
      return ['KPI Lab for your computer', html];
    }
    function installDialog() {
      var h = '<p>KPI Lab can sit on your home screen or desktop with its own icon, open in its own window and work offline, like any other app.</p>';
      if (standalone()) return ['Already installed', '<p>You&rsquo;re using the installed KPI Lab right now. Find it with your other apps any time.</p>'];
      if (isIOS) h += '<ol class="kinst-steps"><li>In Safari, tap the <b>Share</b> button <span class="kinst-key">&#x2191;</span> (the square with the arrow).</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. The KPI Lab icon appears on your home screen.</li></ol><p class="kdl-note">On iPhone and iPad this works from Safari.</p>';
      else if (isAndroid) h += '<ol class="kinst-steps"><li>Tap the browser menu <span class="kinst-key">&#8942;</span>.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Tap <b>Install</b>. The KPI Lab icon appears with your apps.</li></ol>';
      else h += '<ol class="kinst-steps"><li><b>Chrome, Edge or Brave:</b> click the install icon at the right end of the address bar, or the browser menu &rsaquo; <b>Install KPI Lab</b>.</li><li><b>Safari on a Mac:</b> <b>File &rsaquo; Add to Dock</b>.</li><li><b>Firefox:</b> it can&rsquo;t install web apps. Use <b>File &rsaquo; Download for Windows, Mac, Linux</b> instead.</li></ol>';
      return ['Install KPI Lab', h];
    }
    function installApp() {
      if (ELECTRON) return;
      if (!PWA) { location.href = 'kpi-lab.html#install'; return; }   // the app page is the one that installs
      if (installEvt) {
        var ev = installEvt; installEvt = null; showInstallChip();
        ev.prompt();
        if (ev.userChoice) ev.userChoice.then(function (c) { status(c && c.outcome === 'accepted' ? 'Installing KPI Lab…' : 'Not installed. You can install it any time from File.', true); });
        return;
      }
      openDialog('install');
    }

    /* ---------- print just the app ---------- */
    function printApp() {
      var opened = false;
      var onBefore = function () { opened = true; };
      var done = function () {
        root.classList.remove('kapp-print');
        window.removeEventListener('beforeprint', onBefore);
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('beforeprint', onBefore);
      window.addEventListener('afterprint', done);
      root.classList.add('kapp-print');            // print colours come from style.css, never from the screen theme
      try { window.print(); } catch (e) {}        // straight from the tap, for iPhone and Android
      setTimeout(function () { if (!opened) status('No print window here? Try File > Download instead.'); }, 2500);
    }

    /* ---------- full screen (desktop) ---------- */
    function isFull() { return document.fullscreenElement === kapp || kapp.classList.contains('is-takeover'); }
    /* The □ button (16 Oct 2026, John: "should only open it up in the browser with the navigation menu of
       the main site still at the top"): the app fills the page below the site's own menu bar, the same
       take-over as a phone. The browser's full-screen mode is used only inside the desktop app. */
    function toggleFull() {
      if (kapp.classList.contains('is-takeover')) { release('close'); return; }
      if (DESKTOP) {
        if (document.fullscreenElement === kapp) { try { document.exitFullscreen(); } catch (e) {} return; }
        try { kapp.requestFullscreen().catch(function () {}); } catch (e) {}
        return;
      }
      takeover(true);
    }
    document.addEventListener('fullscreenchange', function () { kapp.classList.toggle('is-full', document.fullscreenElement === kapp); });

    /* ---------- exit ---------- */
    function leaveApp() {                          // kpi-lab.html: close the installed window, or go to the website
      if (standalone()) { window.close(); setTimeout(function () { status('Close this window to leave KPI Lab.', true); }, 300); return; }
      location.href = root.getAttribute('data-leave') || '/#lab';
    }
    function exitApp() {
      if (PWA) { leaveApp(); return; }
      if (DESKTOP) { if (window.__electronClose) window.__electronClose(); else window.close(); return; }
      if (kapp.classList.contains('is-takeover')) { release('close'); return; }
      if (document.fullscreenElement === kapp) { try { document.exitFullscreen(); } catch (e) {} return; }
      var next = document.getElementById('lab'); next = next && next.nextElementSibling;
      if (next) { try { next.scrollIntoView({ behavior: moving() ? 'smooth' : 'auto' }); } catch (e) { next.scrollIntoView(); } }
    }

    function run(cmd) {
      actionCount++;
      trackKpi('kpi_action', { action_name: cmd });
      switch (cmd) {
        case 'save': save(); break;
        case 'open': open(false); break;
        case 'dl-one': download(false); break;
        case 'dl-all': download(true); break;
        case 'app': openDialog('app'); break;
        case 'install': installApp(); break;
        case 'print': printApp(); break;
        case 'exit': exitApp(); break;
        case 'copy': copyResult(); break;
        case 'reset': resetOne(current); setMeasure(current, true); status('Back to the example numbers.'); break;
        case 'reset-all': Object.keys(KPIS).forEach(resetOne); setMeasure(current, true); status('All 14 are back to the example numbers.'); break;
        case 'clear': clearSaved(); break;
        case 'lessons': kapp.classList.toggle('no-lessons'); break;
        case 'dark':
          var tb = document.getElementById('theme');
          if (tb) tb.click();
          else { var nx = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', nx); try { localStorage.setItem('kpi-lab-theme', nx); } catch (e) {} }
          break;
        case 'full': toggleFull(); break;
        case 'howto': case 'kpi': case 'about': openDialog(cmd); break;
        case 'words':
          if (PWA) { window.open('https://john.goliash.com/#words', '_blank', 'noopener'); break; }
          if (kapp.classList.contains('is-takeover')) release('close');
          location.hash = '#words'; break;
      }
    }

    /* keyboard shortcuts, only while you are in the app */
    document.addEventListener('keydown', function (e) {
      var inApp = kapp.contains(document.activeElement) || kapp.classList.contains('is-takeover') || DESKTOP || document.fullscreenElement === kapp;
      if (!inApp) return;
      var mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
      if (mod && k === 's') { e.preventDefault(); save(); }
      else if (mod && k === 'o') { e.preventDefault(); open(false); }
      else if (mod && k === 'p') { e.preventDefault(); printApp(); }
      else if (e.key === 'Escape' && !openTop && (dlg ? dlg.hidden : true) && kapp.classList.contains('is-takeover')) { release('close'); }
    });

    /* ==================================================================
       PHONES AND DESKTOPS (desktop added at John's request, 15 Oct 2026):
       as you scroll down to it, the app pops up and takes over the
       screen. It stays there until you press X, or keep scrolling past
       its end (or back past its top). Then it lets the page go on, and
       waits until it has left the screen before it can take over again.
       ================================================================== */
    var mq = null; try { mq = matchMedia('(max-width: 900px)'); } catch (e) {}
    function phone() { return !!(mq && mq.matches); }
    var spacer = document.createElement('div'); spacer.className = 'kapp-spacer'; spacer.setAttribute('aria-hidden', 'true');
    var armed = true, lockY = 0, lastY = window.pageYOffset, endCap = document.getElementById('kapp-end');
    function takeover(manual) {
      if (DESKTOP || kapp.classList.contains('is-takeover')) return;
      closeMenus(false);
      var kh = kapp.offsetHeight;
      var hdr = document.querySelector('.hdr'), hb = 0;
      if (hdr && !DESKTOP) hb = Math.max(0, Math.round(hdr.getBoundingClientRect().bottom));
      spacer.style.height = kh + 'px';
      kapp.parentNode.insertBefore(spacer, kapp);
      lockY = window.pageYOffset;
      /* the site's top menu stays on screen: the app fills the window below it */
      kapp.style.top = hb + 'px'; kapp.style.height = 'auto';
      root.classList.add('kapp-open');
      kapp.classList.add('is-takeover');
      kapp.setAttribute('role', 'dialog'); kapp.setAttribute('aria-modal', 'true');
      if (bodyEl) bodyEl.scrollTop = 0;
      if (moving()) {
        kapp.classList.remove('pop');
        requestAnimationFrame(function () { kapp.classList.add('pop'); });
      }
      var x = document.getElementById('kapp-x'); if (x && manual !== 'auto') x.focus({ preventScroll: true });
      status(phone() ? 'Tap X, or scroll past the end, to leave.' : 'Press X or Esc, or keep scrolling past the end, to leave.', true);
      trackKpi('kpi_takeover_open', { trigger: manual || 'scroll' });
    }
    function release(how) {
      if (!kapp.classList.contains('is-takeover')) return;
      trackKpi('kpi_takeover_close', { exit_method: how });
      armed = false;
      var sec = document.getElementById('lab'), y = lockY;
      if (how === 'down' && sec) y = sec.getBoundingClientRect().bottom + window.pageYOffset - 70;
      if (how === 'up' && sec) y = Math.max(0, sec.getBoundingClientRect().top + window.pageYOffset - window.innerHeight * .9);
      kapp.classList.remove('is-takeover', 'pop', 'pulling');
      kapp.removeAttribute('role'); kapp.removeAttribute('aria-modal');
      kapp.style.top = ''; kapp.style.height = '';
      root.classList.remove('kapp-open');
      if (spacer.parentNode) spacer.parentNode.removeChild(spacer);
      if (how !== 'nav') { try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } }
      lastY = how === 'nav' ? window.pageYOffset : y;
      status('Ready');
    }
    var xBtn = document.getElementById('kapp-x'); if (xBtn) xBtn.addEventListener('click', function () { if (PWA) leaveApp(); else if (DESKTOP) { if (window.__electronClose) window.__electronClose(); else window.close(); } else if (document.fullscreenElement === kapp) document.exitFullscreen(); else release('close'); });
    var maxBtn = document.getElementById('kapp-max'); if (maxBtn) maxBtn.addEventListener('click', toggleFull);
    var contBtn = document.getElementById('kapp-continue'); if (contBtn) contBtn.addEventListener('click', function () { release('down'); });

    /* Only YOUR scrolling can make it pop up (16 Oct 2026, John: "none of the navigation links that need to
       scroll past the KPI lab, always end up on the KPI lab"). A finger drag, the wheel or a scroll key opens
       a short window, kept open while the page keeps gliding from that flick; a menu link's scroll never
       opens it, so the link carries you straight past. */
    var userUntil = 0;
    function userScrolled() { userUntil = Date.now() + 900; }
    window.addEventListener('touchmove', userScrolled, { passive: true });
    window.addEventListener('wheel', userScrolled, { passive: true });
    window.addEventListener('keydown', function (e) { if (/^(ArrowDown|PageDown|End| )$/.test(e.key)) userScrolled(); });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a[href*="#"]')) userUntil = 0; }, true);
    window.addEventListener('hashchange', function () { userUntil = 0; if (kapp.classList.contains('is-takeover')) release('nav'); });
    /* A link outside the app (the site's top menu, the logo, a footer link) while it's maximized: let the
       page go first, then the link scrolls or opens as usual (16 Oct 2026, John: "when I use the navigation
       on the top while the kpi tool is maximized it does not exit out"). Runs before the site's own link
       handling, so the page is already unlocked when that scrolls. */
    document.addEventListener('click', function (e) {
      if (!kapp.classList.contains('is-takeover')) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && !kapp.contains(a)) release('nav');
    }, true);

    var sTick = false;
    window.addEventListener('scroll', function () {
      var now = Date.now();
      if (now < userUntil) userUntil = Math.max(userUntil, now + 250);   // a flick's glide still counts
      if (sTick) return; sTick = true;
      requestAnimationFrame(function () {
        sTick = false;
        if (DESKTOP || kapp.classList.contains('is-takeover') || !phone()) return;
        var y = window.pageYOffset, down = y > lastY; lastY = y;
        var r = kapp.getBoundingClientRect(), vh = window.innerHeight;
        if (!armed) { if (r.bottom < 0 || r.top > vh) armed = true; return; }
        /* phones only (16 Oct 2026): on desktop the app stays in the page */
        if (down && Date.now() < userUntil && r.top < vh * .42 && r.top > -r.height * .5) takeover('auto');
      });
    }, { passive: true });

    /* keep scrolling past the end (or back past the top) to leave */
    var startY = 0, pull = 0, pullDir = 0;
    function atBottom() { return bodyEl.scrollTop + bodyEl.clientHeight >= bodyEl.scrollHeight - 2; }
    function atTop() { return bodyEl.scrollTop <= 0; }
    if (bodyEl) {
      bodyEl.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; pull = 0; pullDir = 0; }, { passive: true });
      bodyEl.addEventListener('touchmove', function (e) {
        if (!kapp.classList.contains('is-takeover')) return;
        var dy = e.touches[0].clientY - startY;
        if (dy < 0 && atBottom()) { pullDir = 1; pull = -dy; }
        else if (dy > 0 && atTop()) { pullDir = -1; pull = dy; }
        else { pullDir = 0; pull = 0; }
        kapp.classList.toggle('pulling', pullDir === 1 && pull > 12);
        if (endCap) endCap.style.setProperty('--pull', Math.min(1, pull / 40).toFixed(2));
      }, { passive: true });
      bodyEl.addEventListener('touchend', function () {
        if (!kapp.classList.contains('is-takeover')) return;
        var go = pull > 40 ? pullDir : 0;
        kapp.classList.remove('pulling'); if (endCap) endCap.style.setProperty('--pull', 0);
        pull = 0; pullDir = 0;
        if (go === 1) release('down'); else if (go === -1) release('up');
      }, { passive: true });
      var wheelSum = 0, wheelT = null;
      bodyEl.addEventListener('wheel', function (e) {
        if (!kapp.classList.contains('is-takeover')) return;
        if ((e.deltaY > 0 && atBottom()) || (e.deltaY < 0 && atTop())) {
          wheelSum += e.deltaY; clearTimeout(wheelT); wheelT = setTimeout(function () { wheelSum = 0; }, 400);
          if (endCap && e.deltaY > 0) endCap.style.setProperty('--pull', Math.min(1, wheelSum / 80).toFixed(2));
          kapp.classList.toggle('pulling', wheelSum > 15);
          if (wheelSum > 80) { wheelSum = 0; kapp.classList.remove('pulling'); release('down'); } else if (wheelSum < -80) { wheelSum = 0; release('up'); }
        } else wheelSum = 0;
      }, { passive: true });
    }
    /* keyboard scrolling while it holds the screen: Page Down / Space / arrows
       scroll the app; at the end (or the top) they let the page go on */
    document.addEventListener('keydown', function (e) {
      if (!kapp.classList.contains('is-takeover') || openTop || (dlg && !dlg.hidden)) return;
      var tag = (e.target && e.target.tagName) || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      var k = e.key, down = k === 'PageDown' || k === 'ArrowDown' || (k === ' ' && !e.shiftKey) || k === 'End';
      var up = k === 'PageUp' || k === 'ArrowUp' || (k === ' ' && e.shiftKey) || k === 'Home';
      if (!down && !up) return;
      if (/^(BUTTON|A)$/.test(tag) && k === ' ') return;
      e.preventDefault();
      if (down && atBottom()) { release('down'); return; }
      if (up && atTop()) { release('up'); return; }
      var step = (k === 'ArrowDown' || k === 'ArrowUp') ? 60 : bodyEl.clientHeight * .85;
      if (k === 'End') bodyEl.scrollTop = bodyEl.scrollHeight; else if (k === 'Home') bodyEl.scrollTop = 0;
      else bodyEl.scrollBy({ top: down ? step : -step, behavior: moving() ? 'smooth' : 'auto' });
    });

    /* ---------- start ---------- */
    if (DESKTOP) {
      kapp.classList.add('is-desktop');
      if (ELECTRON) {                               // the desktop app: no downloads, install or website links
        ['app', 'install', 'words'].forEach(function (c) { var it = kapp.querySelector('[data-cmd="' + c + '"]'); if (it) it.hidden = true; });
      }
      if (PWA) {
        if ('serviceWorker' in navigator) {        // works offline once opened
          try { navigator.serviceWorker.register('kpi-sw.js', { scope: root.getAttribute('data-sw-scope') || './kpi-lab' }).catch(function () {}); } catch (e) {}
        }
        showInstallChip();
        if (location.hash === '#install') { try { history.replaceState(null, '', location.pathname); } catch (e) {} setTimeout(installApp, 600); }
      }
      try { var th = localStorage.getItem('kpi-lab-theme'); if (th === 'light' || th === 'dark') root.setAttribute('data-theme', th); } catch (e) {}
    }
    renderFields();
    compute();
    if (!open(true)) { setMeasure(current, true); status('Ready'); }
    var calcTrackTimer = null;
    labForm.addEventListener('input', function () {
      compute();
      calculationCount++;
      clearTimeout(calcTrackTimer);
      calcTrackTimer = setTimeout(function () {
        trackKpi('kpi_measure_calculate', {
          measure_id: current,
          measure_name: KPIS[current] ? KPIS[current].name : current,
          measure_group: groupOf(current)
        });
      }, 1000);
    });
    labForm.addEventListener('submit', function (e) { e.preventDefault(); });
    kapp.classList.add('kapp-ready');

    /* Track initial view when the KPI Lab is first viewed */
    if (DESKTOP) {
      trackKpi('kpi_lab_view', { is_first_view: true });
    } else if ('IntersectionObserver' in window) {
      var viewObs = new IntersectionObserver(function (entries) {
        if (entries[0] && entries[0].isIntersecting) {
          trackKpi('kpi_lab_view', { is_first_view: true });
          viewObs.disconnect();
        }
      }, { threshold: 0.25 });
      viewObs.observe(kapp);
    }

    /* Track clicks on executable and source downloads */
    kapp.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a || !a.href) return;
      var h = a.getAttribute('href') || '';
      var dt = null, fn = '';
      if (/KPI-Lab-Setup\.exe/i.test(h)) { dt = 'win_installer'; fn = 'KPI-Lab-Setup.exe'; }
      else if (/KPI-Lab-Portable\.exe/i.test(h)) { dt = 'win_portable'; fn = 'KPI-Lab-Portable.exe'; }
      else if (/KPI-Lab-mac-arm64\.dmg/i.test(h)) { dt = 'mac_arm64'; fn = 'KPI-Lab-mac-arm64.dmg'; }
      else if (/KPI-Lab-mac-x64\.dmg/i.test(h)) { dt = 'mac_intel'; fn = 'KPI-Lab-mac-x64.dmg'; }
      else if (/KPI-Lab-linux.*\.AppImage/i.test(h)) { dt = 'linux_appimage'; fn = 'KPI-Lab-linux.AppImage'; }
      else if (/KPI-Lab-linux.*\.deb/i.test(h)) { dt = 'linux_deb'; fn = 'KPI-Lab-linux.deb'; }
      else if (/kpi-lab-desktop\.zip/i.test(h)) { dt = 'source_zip'; fn = 'kpi-lab-desktop.zip'; }
      if (dt) {
        trackKpi('kpi_download', { download_type: dt, filename: fn });
      }
    });

    /* Active runtime and engagement tracking */
    setInterval(function () {
      var now = Date.now();
      if (!document.hidden) {
        sessionActiveSeconds += Math.round((now - lastActiveTick) / 1000);
      }
      lastActiveTick = now;
    }, 5000);

    var reportedMinutes = {};
    setInterval(function () {
      if (document.hidden) return;
      var mins = Math.floor(sessionActiveSeconds / 60);
      if (mins >= 1 && !reportedMinutes[mins]) {
        reportedMinutes[mins] = true;
        trackKpi('kpi_session_heartbeat', {
          active_duration_minutes: mins,
          active_duration_seconds: sessionActiveSeconds,
          session_calculations_count: calculationCount,
          session_actions_count: actionCount
        });
      }
    }, 15000);

    function reportSessionDuration() {
      var totalSec = Math.round((Date.now() - sessionStart) / 1000);
      if (totalSec < 3) return;
      trackKpi('kpi_session_duration', {
        total_session_seconds: totalSec,
        active_duration_seconds: sessionActiveSeconds,
        distinct_measures_count: Object.keys(viewedMeasuresMap).length,
        session_calculations_count: calculationCount,
        session_actions_count: actionCount
      });
    }
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') reportSessionDuration();
    });
    window.addEventListener('pagehide', reportSessionDuration);
})();
