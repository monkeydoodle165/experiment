/* drift.quibo.games — The Ledger
   A Georgian counting house at the end of the month. The day's number picks a town and a year between
   1762 and 1819, a merchant's trade, his customers, his suppliers and his bankers, the balances brought
   down from last month and fifteen to eighteen transactions written in the waste book.

   Every transaction is one debit and one credit of the same sum, and the junior clerk has posted both
   halves into the ledger in pounds, shillings and pence. He has made two or three of the classic slips
   that throw the trial balance out (figures transposed, a figure slid a column, a posting carried to the
   wrong side, one half never posted) and on some days a fourth that does not show in the trial balance
   at all: the right sum posted to the wrong customer.

   The ledger's own cross-references (the folio of each entry and the account named in each narrative)
   are honest, so most slips can be found by pairing the halves of each entry. Calling an entry over
   against the waste book settles which half is wrong, but costs twelve minutes, and the evening mail
   leaves at seven. Self-contained. */
(function () {
  'use strict';

  /* ---------- seeded PRNG (mulberry32), same family as the rest of the site ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedForDate(d) {
    var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    var h = s ^ 0x5be0cd19;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function rint(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function ord(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  /* ---------- money: everything is held in pence ---------- */
  function L(p) { return Math.floor(p / 240); }
  function lsd(p) {
    var neg = p < 0; p = Math.abs(Math.round(p));
    var l = Math.floor(p / 240), s = Math.floor((p % 240) / 12), d = p % 12;
    var out = '£' + l + ' ' + s + 's ' + d + 'd';
    return (neg ? '−' : '') + out;
  }
  function cols(p) {
    if (p == null) return '<td class="m"></td><td class="m"></td><td class="m"></td>';
    p = Math.round(p);
    return '<td class="m l">' + Math.floor(p / 240) + '</td><td class="m">' + Math.floor((p % 240) / 12) + '</td><td class="m">' + (p % 12) + '</td>';
  }

  /* ---------- the day's counting house ---------- */
  var TOWNS = ['Bristol', 'Norwich', 'York', 'Exeter', 'Hull', 'Liverpool', 'Leeds', 'Chester', 'Newcastle', 'Manchester', 'Plymouth', 'Ipswich', 'Shrewsbury', "King's Lynn", 'Lancaster', 'Whitehaven', 'Worcester', 'Gloucester', 'Halifax', 'Colchester', 'Birmingham', 'Sheffield'];
  var SURN = ['Ashby', 'Pell', 'Tolley', 'Marsh', 'Gedge', 'Hobday', 'Venn', 'Crisp', 'Nunn', 'Rudd', 'Brigg', 'Fenn', 'Quilter', 'Larkin', 'Tebbutt', 'Mold', 'Spurling', 'Catchpole', 'Gunn', 'Orme', 'Prigg', 'Wesson', 'Hollis', 'Dunthorne', 'Peel', 'Pell', 'Bagge', 'Raikes', 'Sturge', 'Hebb', 'Lusher', 'Kett'];
  var GIVEN = ['Josiah', 'Thomas', 'William', 'Samuel', 'Hannah', 'Elizabeth', 'John', 'Mary', 'Joseph', 'Richard', 'Sarah', 'Benjamin', 'Ann', 'Edward', 'Abraham', 'Martha', 'George', 'Isaac'];
  var PLACES = ['of Ware', 'of Bury', 'of Thirsk', 'of Leek', 'of Frome', 'of Ludlow', 'of Diss', 'of Kendal', 'of Wem', 'of Selby', 'of Holt', 'of Stroud', 'of Bawtry', 'of Penrith', 'of Ely'];
  var BANKS = ['Smith, Ellison & Co.', 'Gurney & Co.', 'Backhouse & Co.', 'Lloyd & Co.', 'Mortlock & Co.', 'Heywood & Co.', 'Peckover & Co.', 'Wakefield, Crewdson & Co.'];

  var TRADES = [
    { what: 'tea dealer and grocer', items: [
      { g: 'Bohea tea', u: 'lb', p: [24, 36], q: [60, 400] },
      { g: 'Congou tea', u: 'lb', p: [36, 54], q: [40, 260] },
      { g: 'Hyson tea', u: 'lb', p: [60, 96], q: [20, 120] },
      { g: 'loaf sugar', u: 'lb', p: [9, 13], q: [120, 700] }] },
    { what: 'wool stapler', items: [
      { g: 'fleece wool', u: 'tod', p: [240, 420], q: [10, 80] },
      { g: 'combing wool', u: 'tod', p: [300, 480], q: [8, 60] },
      { g: 'noils', u: 'cwt', p: [400, 700], q: [2, 20] }] },
    { what: 'ironmonger', items: [
      { g: 'bar iron', u: 'cwt', p: [300, 420], q: [5, 60] },
      { g: 'tenpenny nails', u: 'thousand', p: [40, 90], q: [20, 220] },
      { g: 'frying pans', u: 'dozen', p: [60, 120], q: [5, 30] }] },
    { what: 'hop factor', items: [
      { g: 'Kent hops', u: 'pocket', p: [900, 2000], q: [3, 24] },
      { g: 'Sussex hops', u: 'bag', p: [1600, 3000], q: [2, 12] }] },
    { what: 'linen draper', items: [
      { g: 'Irish linen', u: 'yard', p: [14, 36], q: [100, 900] },
      { g: 'Holland', u: 'yard', p: [30, 60], q: [50, 300] },
      { g: 'printed calico', u: 'piece', p: [120, 300], q: [5, 40] }] },
    { what: 'timber merchant', items: [
      { g: 'Memel fir', u: 'load', p: [900, 1500], q: [3, 25] },
      { g: 'Norway deals', u: 'hundred', p: [2400, 4800], q: [1, 6] },
      { g: 'English oak plank', u: 'load', p: [1500, 2400], q: [2, 10] }] }
  ];
  function priceStr(p) { var s = Math.floor(p / 12), d = p % 12; if (s >= 20) return lsd(p).replace(/ 0d$/, ''); return (s ? s + 's' : '') + (d ? (s ? ' ' : '') + d + 'd' : (s ? '' : '0d')); }

  var START = 16 * 60, POST = 19 * 60, CALL = 12, FIX = 3;
  function clock(t) { var m = START + t, h = Math.floor(m / 60), mm = m % 60; var h12 = h > 12 ? h - 12 : h; return h12 + '.' + (mm < 10 ? '0' : '') + mm + (h >= 12 ? ' pm' : ' am'); }

  function makeDay(date, variant) {
    var r = rng(mix(seedForDate(date), 49 + 1000 * (variant || 0)));
    var D = { date: date };
    D.town = pick(r, TOWNS);
    D.year = rint(r, 1762, 1819);
    D.month = rint(r, 0, 11);
    D.trade = pick(r, TRADES);
    var sn = shuffle(r, SURN.filter(function (v, i, a) { return a.indexOf(v) === i; }));
    D.master = pick(r, GIVEN) + ' ' + sn[0];
    D.clerk = pick(r, ['Ned', 'Will', 'Sam', 'Kit', 'Tom', 'Jack', 'Harry']) + ' ' + sn[1];
    D.bankName = pick(r, BANKS);

    /* accounts */
    var A = [];
    function acc(id, name, short, kind) { A.push({ id: id, name: name, short: short, kind: kind, fo: A.length + 1, open: 0 }); return A.length - 1; }
    var aStock = acc('stock', 'Stock (' + D.master + ', his capital)', 'Stock', 'cap');
    var aCash = acc('cash', 'Cash', 'Cash', 'asset');
    var aBank = acc('bank', D.bankName + ', bankers', D.bankName.split(',')[0].split(' &')[0] + ' & Co.', 'asset');
    var aBuy = acc('buy', 'Goods bought', 'Goods bought', 'exp');
    var aSell = acc('sell', 'Goods sold', 'Goods sold', 'inc');
    var cust = [], sup = [];
    for (var i = 0; i < 3; i++) {
      var nm = pick(r, GIVEN) + ' ' + sn[2 + i];
      cust.push(acc('c' + i, nm + ', ' + pick(r, PLACES), sn[2 + i], 'debtor'));
    }
    for (i = 0; i < 2; i++) sup.push(acc('s' + i, sn[5 + i] + ' & ' + sn[7 + i], sn[5 + i] + ' & ' + sn[7 + i], 'creditor'));
    var aBR = acc('br', 'Bills receivable', 'Bills receivable', 'asset');
    var aBP = acc('bp', 'Bills payable', 'Bills payable', 'liab');
    var aChg = acc('chg', 'Charges merchandise', 'Charges', 'exp');
    var aWag = acc('wag', 'Wages', 'Wages', 'exp');
    var aRent = acc('rent', 'Rent', 'Rent', 'exp');
    D.A = A; D.cust = cust; D.sup = sup;
    D.ids = { stock: aStock, cash: aCash, bank: aBank, buy: aBuy, sell: aSell, br: aBR, bp: aBP };

    /* opening balances (Dr positive, Cr negative) */
    function pounds(lo, hi) { return rint(r, lo, hi) * 240 + rint(r, 0, 19) * 12 + rint(r, 0, 11); }
    A[aCash].open = pounds(60, 160);
    A[aBank].open = pounds(250, 800);
    A[aBuy].open = pounds(300, 1100);
    cust.forEach(function (c) { A[c].open = pounds(20, 160); });
    sup.forEach(function (s) { A[s].open = -pounds(40, 220); });
    if (r() < 0.6) A[aBR].open = pounds(40, 140);
    if (r() < 0.5) A[aBP].open = -pounds(30, 160);
    var sum = 0; A.forEach(function (a, k) { if (k !== aStock) sum += a.open; });
    A[aStock].open = -sum;
    D.openGoods = A[aBuy].open;

    /* the month's transactions */
    var bal = A.map(function (a) { return a.open; });
    var n = rint(r, 15, 18), days = [];
    for (i = 0; i < n; i++) days.push(rint(r, 1, 28));
    days.sort(function (a, b) { return a - b; });
    var E = [], usedWage = false, usedRent = false, sales = 0, purch = 0, soldTo = {};
    function goods(markup) {
      var it = pick(r, D.trade.items), q = rint(r, it.q[0], it.q[1]), p = rint(r, it.p[0], it.p[1]);
      if (markup) p = Math.round(p * (1.18 + 0.2 * r()));
      return { it: it, q: q, p: p, amt: q * p };
    }
    function gtxt(g) { return g.q + ' ' + g.it.u + (g.q > 1 && !/^(lb|cwt|thousand|dozen|hundred)$/.test(g.it.u) ? 's' : '') + ' ' + g.it.g + ' at ' + priceStr(g.p) + ' per ' + g.it.u; }
    function roundS(p) { return Math.max(240, Math.round(p / 12) * 12); }
    for (var k = 0; k < n; k++) {
      var e = null, tries = 0;
      while (!e && tries++ < 40) {
        var t = pick(r, ['buyC', 'buyC', 'buyC', 'buyR', 'sellC', 'sellC', 'sellC', 'sellC', 'sellR', 'sellR', 'recv', 'recv', 'recvB', 'pay', 'pay', 'acc', 'carr', 'wage', 'rent', 'toBank', 'fromBank', 'ret']);
        var g, c, s, a;
        if (t === 'buyC') { g = goods(false); s = pick(r, sup); e = { dr: aBuy, cr: s, amt: g.amt, txt: 'Bought of ' + A[s].short + ', on credit, ' + gtxt(g) }; }
        else if (t === 'buyR') { g = goods(false); if (g.amt > bal[aCash] - 240) continue; e = { dr: aBuy, cr: aCash, amt: g.amt, txt: 'Bought for ready money at the quay, ' + gtxt(g) }; }
        else if (t === 'sellC') { g = goods(true); c = pick(r, cust); soldTo[c] = (soldTo[c] || 0) + 1; e = { dr: c, cr: aSell, amt: g.amt, txt: 'Sold to ' + A[c].name.split(',')[0] + ', on credit, ' + gtxt(g), sale: true }; }
        else if (t === 'sellR') { g = goods(true); if (g.amt > 60 * 240) continue; e = { dr: aCash, cr: aSell, amt: g.amt, txt: 'Sold over the counter for ready money, ' + gtxt(g) }; }
        else if (t === 'recv' || t === 'recvB') {
          c = pick(r, cust); if (bal[c] < 10 * 240) continue;
          a = roundS(bal[c] * (0.3 + 0.5 * r()));
          if (t === 'recv') e = { dr: aCash, cr: c, amt: a, txt: 'Received of ' + A[c].name.split(',')[0] + ' in cash, on account' };
          else { a = Math.round(a / 240) * 240; e = { dr: aBR, cr: c, amt: a, txt: 'Received of ' + A[c].name.split(',')[0] + ' his acceptance at two months, on account' }; }
        }
        else if (t === 'pay') { s = pick(r, sup); if (-bal[s] < 12 * 240) continue; a = roundS(-bal[s] * (0.3 + 0.5 * r())); if (a > bal[aBank] - 240) continue; e = { dr: s, cr: aBank, amt: a, txt: 'Paid ' + A[s].short + ' by a draft on ' + D.bankName + ', on account' }; }
        else if (t === 'acc') { s = pick(r, sup); if (-bal[s] < 20 * 240) continue; a = Math.round(-bal[s] * (0.4 + 0.4 * r()) / 240) * 240; e = { dr: s, cr: aBP, amt: a, txt: 'Accepted the bill of ' + A[s].short + ' at three months' }; }
        else if (t === 'carr') { a = rint(r, 5, 40) * 12 + rint(r, 0, 11); if (a > bal[aCash]) continue; e = { dr: aChg, cr: aCash, amt: a, txt: pick(r, ['Paid the carrier for bringing in goods', 'Paid wharfage and porterage', 'Paid the waggoner, carriage of goods sold', 'Paid for cordage, mats and sacking']) }; }
        else if (t === 'wage') { if (usedWage) continue; a = rint(r, 30, 90) * 12; if (a > bal[aCash]) continue; usedWage = true; e = { dr: aWag, cr: aCash, amt: a, txt: 'Paid the porter and the boy their month’s wages' }; }
        else if (t === 'rent') { if (usedRent) continue; a = rint(r, 8, 30) * 240 + pick(r, [0, 0, 120, 60]); if (a > bal[aCash]) continue; usedRent = true; e = { dr: aRent, cr: aCash, amt: a, txt: 'Paid a quarter’s rent of the warehouse' }; }
        else if (t === 'toBank') { if (bal[aCash] < 70 * 240) continue; a = Math.round(bal[aCash] * (0.4 + 0.3 * r()) / 240) * 240; e = { dr: aBank, cr: aCash, amt: a, txt: 'Paid into ' + D.bankName }; }
        else if (t === 'fromBank') { if (bal[aCash] > 50 * 240 || bal[aBank] < 60 * 240) continue; a = rint(r, 3, 8) * 10 * 240; if (a > bal[aBank]) continue; e = { dr: aCash, cr: aBank, amt: a, txt: 'Drew on ' + D.bankName + ' for the use of the house' }; }
        else if (t === 'ret') {
          var cs = cust.filter(function (x) { return soldTo[x]; }); if (!cs.length) continue;
          c = pick(r, cs); g = goods(true); g.q = Math.max(1, Math.round(g.q / 6)); g.amt = g.q * g.p; if (g.amt > bal[c]) continue;
          e = { dr: aSell, cr: c, amt: g.amt, txt: A[c].name.split(',')[0] + ' returned ' + gtxt(g) + ', found damaged' };
        }
      }
      if (!e) { a = rint(r, 5, 30) * 12; e = { dr: aChg, cr: aCash, amt: a, txt: 'Paid for postage of letters and stationery' }; }
      e.fo = E.length + 1; e.day = days[k];
      bal[e.dr] += e.amt; bal[e.cr] -= e.amt;
      if (e.dr === aBuy) purch += e.amt;
      if (e.cr === aSell) sales += e.amt;
      if (e.dr === aSell) sales -= e.amt;
      E.push(e);
    }
    D.E = E;

    /* postings: both halves of each entry, as they truly should be */
    var P = [];
    E.forEach(function (e) {
      P.push({ fo: e.fo, day: e.day, side: 'D', acct: e.dr, ctr: e.cr, amt: e.amt });
      P.push({ fo: e.fo, day: e.day, side: 'C', acct: e.cr, ctr: e.dr, amt: e.amt });
    });
    P.forEach(function (p, j) { p.id = j; p.posted = true; p.T = { acct: p.acct, side: p.side, amt: p.amt, posted: true }; p.err = null; });

    /* the clerk's slips */
    var nBal = r() < 0.5 ? 2 : 3, hasCom = r() < 0.55, used = {};
    function free(fo) { return !used[fo]; }
    var kinds = shuffle(r, ['trans', 'trans', 'slide', 'side', 'omit', 'side', 'omit', 'slide']);
    var made = 0;
    for (var q = 0; q < kinds.length && made < nBal; q++) {
      var kd = kinds[q];
      var cand = shuffle(r, P.filter(function (p) {
        if (!free(p.fo)) return false;
        var l = L(p.amt);
        if (kd === 'trans') return l >= 12 && l <= 98 && (l % 10) !== Math.floor(l / 10) % 10 && l % 10 !== 0;
        if (kd === 'slide') return (l >= 1 && l <= 9) || (l >= 20 && l % 10 === 0 && l <= 400);
        return true;
      }));
      if (!cand.length) continue;
      var p = cand[0]; used[p.fo] = true; p.err = kd; made++;
      var l = L(p.amt), rem = p.amt - l * 240;
      if (kd === 'trans') { var sw = (l % 10) * 10 + Math.floor(l / 10); p.amt = sw * 240 + rem; }
      else if (kd === 'slide') { p.amt = (l <= 9 ? l * 10 : l / 10) * 240 + rem; }
      else if (kd === 'side') { p.side = p.side === 'D' ? 'C' : 'D'; }
      else if (kd === 'omit') { p.posted = false; }
    }
    D.com = null;
    if (hasCom) {
      var cand2 = shuffle(r, P.filter(function (p) { return p.side === 'D' && E[p.fo - 1].sale && free(p.fo); }));
      if (cand2.length) {
        var pc = cand2[0], others = cust.filter(function (c) { return c !== pc.acct; });
        used[pc.fo] = true; pc.err = 'com'; pc.acct = pick(r, others); D.com = pc;
      }
    }
    P.forEach(function (p) { p.clerk = { acct: p.acct, side: p.side, amt: p.amt, posted: p.posted }; });
    D.P = P;
    D.nBal = made;

    /* the true closing position */
    var tb = A.map(function (a) { return a.open; });
    P.forEach(function (p) { tb[p.T.acct] += p.T.side === 'D' ? p.T.amt : -p.T.amt; });
    D.trueBal = tb;
    D.sales = sales; D.purch = purch;
    var costRatio = 0.68 + 0.12 * r();
    D.closeGoods = Math.max(Math.round(D.openGoods * 0.25), Math.round(D.openGoods + purch - sales * costRatio));

    /* a letter from one customer, giving the balance by his own books (which are right) */
    var who = D.com ? D.com.acct : pick(r, cust);
    D.letter = { acct: who, bal: tb[who] };
    D.ok = tb[aCash] >= 0 && tb[aBank] >= 0;
    return D;
  }
  function buildDay(date) {
    for (var v = 0; v < 12; v++) {
      var D = makeDay(date, v);
      if (D.nBal >= 2 && D.ok && tbDiff(D) !== 0) return D;
    }
    return D;
  }

  /* ---------- state ---------- */
  var dayOff = 0, D, sel = -1, called, t, hist, finished;
  function balances() {
    var b = D.A.map(function (a) { return a.open; });
    D.P.forEach(function (p) { if (p.posted) b[p.acct] += p.side === 'D' ? p.amt : -p.amt; });
    return b;
  }
  function tbDiff(Dx) {
    var dr = 0, cr = 0;
    Dx.A.forEach(function (a) { if (a.open > 0) dr += a.open; else cr -= a.open; });
    Dx.P.forEach(function (p) { if (p.posted) { if (p.side === 'D') dr += p.amt; else cr += p.amt; } });
    return dr - cr;
  }
  function totals() {
    var b = balances(), dr = 0, cr = 0;
    b.forEach(function (x) { if (x > 0) dr += x; else cr -= x; });
    return { b: b, dr: dr, cr: cr, diff: dr - cr };
  }
  function modded(p) { var c = p.clerk; return p.posted !== c.posted || (p.posted && (p.acct !== c.acct || p.side !== c.side || p.amt !== c.amt)); }
  function isRight(p) { return p.posted === p.T.posted && (!p.posted || (p.acct === p.T.acct && p.side === p.T.side && p.amt === p.T.amt)); }
  function partners(p) { return D.P.filter(function (q) { return q.fo === p.fo && q.id !== p.id && q.posted; }); }
  function sideWord(s) { return s === 'D' ? 'debit' : 'credit'; }
  function narr(p) { return (p.side === 'D' ? 'To ' : 'By ') + D.A[p.ctr].short; }

  /* ---------- rendering ---------- */
  function renderLedger() {
    var tt = totals(), html = '';
    D.A.forEach(function (a, ai) {
      var rows = D.P.filter(function (p) { return p.posted && p.acct === ai; }).sort(function (x, y) { return x.day - y.day || x.fo - y.fo; });
      if (!rows.length && !a.open) {
        html += '<div class="acct quiet"><div class="acct-h"><span>Fo. ' + a.fo + '</span><b>' + esc(a.name) + '</b><em>no entries</em></div></div>';
        return;
      }
      var dr = a.open > 0 ? a.open : 0, cr = a.open < 0 ? -a.open : 0;
      html += '<div class="acct"><div class="acct-h"><span>Fo. ' + a.fo + '</span><b>' + esc(a.name) + '</b></div><div class="tablewrap"><table class="ac"><thead><tr><th>' + MONTHS[D.month].slice(0, 3) + '</th><th></th><th>fo.</th><th colspan="3" class="r">Dr  £ s d</th><th colspan="3" class="r">Cr  £ s d</th></tr></thead><tbody>';
      if (a.open) html += '<tr class="open"><td>1</td><td>' + (a.open > 0 ? 'To' : 'By') + ' balance brought down</td><td></td>' + (a.open > 0 ? cols(a.open) + cols(null) : cols(null) + cols(-a.open)) + '</tr>';
      rows.forEach(function (p) {
        if (p.side === 'D') dr += p.amt; else cr += p.amt;
        var cls = 'post' + (p.id === sel ? ' sel' : '') + (sel >= 0 && D.P[sel].fo === p.fo && p.id !== sel ? ' mate' : '') + (modded(p) ? ' red' : '');
        html += '<tr class="' + cls + '" data-p="' + p.id + '" tabindex="0" role="button" aria-label="Folio ' + p.fo + ', ' + sideWord(p.side) + ' ' + lsd(p.amt) + '"><td>' + p.day + '</td><td>' + esc(narr(p)) + '</td><td class="fo">' + p.fo + '</td>' + (p.side === 'D' ? cols(p.amt) + cols(null) : cols(null) + cols(p.amt)) + '</tr>';
        if (p.id === sel) html += '<tr class="deskrow"><td colspan="9">' + desk(p) + '</td></tr>';
      });
      var b = tt.b[ai];
      html += '</tbody><tfoot><tr><td></td><td>' + (b === 0 ? 'Closed' : (b > 0 ? 'Balance, debit' : 'Balance, credit')) + '</td><td></td>' + (b > 0 ? cols(b) + cols(null) : cols(null) + cols(b < 0 ? -b : null)) + '</tr></tfoot></table></div></div>';
    });
    $('ledger').innerHTML = html;
  }

  function desk(p) {
    var mates = partners(p), e = D.E[p.fo - 1], h = '<div class="desk">';
    h += '<p><b>Folio ' + p.fo + ', the ' + ord(p.day) + '.</b> ' + cap(sideWord(p.side)) + ' ' + esc(D.A[p.acct].short) + ' ' + lsd(p.amt) + ', written “' + esc(narr(p)) + '”.</p>';
    if (!mates.length) h += '<p class="warn">No other half of folio ' + p.fo + ' is posted anywhere in the ledger. The narrative says it belongs in ' + esc(D.A[p.ctr].short) + '.</p>';
    else mates.forEach(function (m) {
      var notes = [];
      if (m.side === p.side) notes.push('it is on the same side');
      if (m.amt !== p.amt) notes.push('the sums disagree by ' + lsd(Math.abs(m.amt - p.amt)));
      if (m.acct !== p.ctr) notes.push('it is in ' + D.A[m.acct].short + ', though this narrative names ' + D.A[p.ctr].short);
      if (m.ctr !== p.acct) notes.push('its narrative names ' + D.A[m.ctr].short + ', not ' + D.A[p.acct].short);
      h += '<p>Its other half: ' + sideWord(m.side) + ' ' + esc(D.A[m.acct].short) + ' ' + lsd(m.amt) + (notes.length ? ' <span class="warn">— ' + esc(notes.join('; ')) + '.</span>' : ', which pairs with it.') + '</p>';
    });
    h += '<p class="wb">Waste book, No. ' + p.fo + ': ' + (called[p.fo] ? '<i>“' + esc(e.txt) + ', ' + lsd(e.amt) + '.”</i> Debit ' + esc(D.A[e.dr].short) + ', credit ' + esc(D.A[e.cr].short) + '.' : '<button class="btn small ghost" type="button" data-call="' + p.fo + '">Call it over (' + CALL + ' minutes)</button>') + '</p>';
    var l = Math.floor(p.amt / 240), s = Math.floor((p.amt % 240) / 12), d = p.amt % 12;
    h += '<div class="fix"><span>Write the sum as £</span><input type="number" min="0" max="9999" id="fxL" value="' + l + '" aria-label="pounds"><span>s</span><input type="number" min="0" max="19" id="fxS" value="' + s + '" aria-label="shillings"><span>d</span><input type="number" min="0" max="11" id="fxD" value="' + d + '" aria-label="pence"><button class="btn small ghost" type="button" data-act="amt">Write it</button></div>';
    h += '<div class="controls"><button class="btn small ghost" type="button" data-act="side">Carry it to the ' + (p.side === 'D' ? 'credit' : 'debit') + ' side</button>';
    h += '<select id="fxA" aria-label="account">' + D.A.map(function (a, i) { return '<option value="' + i + '"' + (i === p.acct ? ' selected' : '') + '>' + esc(a.short) + '</option>'; }).join('') + '</select><button class="btn small ghost" type="button" data-act="acct">Carry it to that account</button>';
    if (!mates.length) h += '<button class="btn small ghost" type="button" data-act="half">Post the missing half to ' + esc(D.A[p.ctr].short) + '</button>';
    if (modded(p)) h += '<button class="btn small ghost" type="button" data-act="undo">Restore the clerk’s figures</button>';
    h += '</div><p class="cost">Each correction in red ink takes ' + FIX + ' minutes.</p></div>';
    return h;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function renderTB() {
    var tt = totals(), h = '<table class="tb"><thead><tr><th>fo.</th><th>Account</th><th colspan="3" class="r">Dr</th><th colspan="3" class="r">Cr</th></tr></thead><tbody>';
    D.A.forEach(function (a, i) { var b = tt.b[i]; if (!b) return; h += '<tr><td class="fo">' + a.fo + '</td><td>' + esc(a.short) + '</td>' + (b > 0 ? cols(b) + cols(null) : cols(null) + cols(-b)) + '</tr>'; });
    h += '</tbody><tfoot><tr><td></td><td>Totals</td>' + cols(tt.dr) + cols(tt.cr) + '</tr></tfoot></table>';
    $('tb').innerHTML = h;
    var d = Math.abs(tt.diff), out;
    if (!tt.diff) out = '<b class="agree">The trial balance agrees.</b> Debits and credits both come to ' + lsd(tt.dr) + '. That is not the same as being right: a sum posted to the wrong customer, or a slip and its mirror, would agree too.';
    else {
      out = '<b class="off">Out by ' + lsd(d) + '</b>, the ' + (tt.diff > 0 ? 'debit' : 'credit') + ' side heavier. Half of that is ' + lsd(d / 2 | 0) + (d % 2 ? ' and a halfpenny, so no single posting on the wrong side explains it' : '') + '. ';
      if (d % 240 === 0) out += (L(d) % 9 === 0 ? 'The pounds divide by nine, which is what a transposed or slid figure leaves.' : 'The pounds do not divide by nine.');
      else out += 'The difference runs into shillings and pence, so it is not a pounds figure transposed or slid alone.';
    }
    $('tbOut').innerHTML = out;
    $('clock').innerHTML = '<b>' + clock(t) + '</b> · ' + (t < POST - START ? (POST - START - t) + ' minutes to the evening mail' : '<span class="off">the mail has gone</span>') + ' · ' + Object.keys(called).length + ' of ' + D.E.length + ' entries called over';
  }

  function renderWaste() {
    var h = '';
    D.E.forEach(function (e) {
      h += '<li><span class="no">' + e.fo + '</span><span class="dd">' + ord(e.day) + '</span>' + (called[e.fo] ? '<span class="tx">' + esc(e.txt) + ' <b>' + lsd(e.amt) + '</b></span>' : '<span class="tx dim">not yet called over <button class="chip" type="button" data-call="' + e.fo + '">Call over</button></span>') + '</li>';
    });
    $('waste').innerHTML = h;
  }

  function render() { renderLedger(); renderTB(); renderWaste(); }

  /* ---------- actions ---------- */
  function spend(m) { t += m; hist.push({ t: t, d: Math.abs(totals().diff) }); }
  function act(kind) {
    if (finished || sel < 0) return;
    var p = D.P[sel];
    if (kind === 'amt') {
      var l = Math.max(0, parseInt($('fxL').value, 10) || 0), s = Math.min(19, Math.max(0, parseInt($('fxS').value, 10) || 0)), d = Math.min(11, Math.max(0, parseInt($('fxD').value, 10) || 0));
      var v = l * 240 + s * 12 + d; if (v === p.amt || v <= 0) return;
      p.amt = v; say('Folio ' + p.fo + ' in ' + D.A[p.acct].short + ' rewritten in red as ' + lsd(v) + '.');
    } else if (kind === 'side') {
      p.side = p.side === 'D' ? 'C' : 'D'; say('Folio ' + p.fo + ' struck through and carried to the ' + sideWord(p.side) + ' side of ' + D.A[p.acct].short + '.');
    } else if (kind === 'acct') {
      var a = +$('fxA').value; if (a === p.acct) return;
      p.acct = a; say('Folio ' + p.fo + ' struck out and carried to ' + D.A[a].name + '.');
    } else if (kind === 'half') {
      var m = D.P.filter(function (q) { return q.fo === p.fo && q.id !== p.id && !q.posted; })[0];
      if (!m) return;
      m.posted = true; m.acct = p.ctr; m.side = p.side === 'D' ? 'C' : 'D'; m.amt = p.amt;
      say('The missing half of folio ' + p.fo + ' posted in red to the ' + sideWord(m.side) + ' of ' + D.A[m.acct].short + '.');
    } else if (kind === 'undo') {
      var o = p.clerk; p.acct = o.acct; p.side = o.side; p.amt = o.amt; p.posted = o.posted;
      say('Folio ' + p.fo + ' put back as the clerk wrote it.');
      if (!p.posted) sel = -1;
      hist.push({ t: t, d: Math.abs(totals().diff) }); render(); return;
    }
    spend(FIX); render();
  }
  function callOver(fo) {
    if (finished || called[fo]) return;
    called[fo] = true; spend(CALL);
    var e = D.E[fo - 1];
    say('Called over No. ' + fo + ': “' + e.txt + ', ' + lsd(e.amt) + '.”');
    render();
  }
  function say(s) { $('msg').textContent = s; }

  /* ---------- the master's check ---------- */
  var WHAT = {
    trans: 'transposed the pounds',
    slide: 'slid the pounds a column',
    side: 'posted it to the wrong side',
    omit: 'never posted this half',
    com: 'posted it to the wrong customer'
  };
  function finish(master) {
    finished = true; sel = -1;
    if (master) D.P.forEach(function (p) { if (!isRight(p)) { p.acct = p.T.acct; p.side = p.T.side; p.amt = p.T.amt; p.posted = p.T.posted; } });
    var errs = D.P.filter(function (p) { return p.err; }), found = errs.filter(isRight).length;
    var bad = D.P.filter(function (p) { return !p.err && !isRight(p); });
    var tt = totals(), late = t > POST - START;
    hist.push({ t: t, d: Math.abs(tt.diff) });
    render();
    var cls = (!master && found === errs.length && !bad.length) ? 'good' : 'warn', v = '';
    if (master) v = '<p><b>' + D.master + ' takes the pen himself</b> and finds every slip. ' + D.clerk + ' is sent home without his supper.</p>';
    else {
      v = '<p><b>' + found + ' of ' + errs.length + '</b> slips put right' + (bad.length ? ', and <b>' + bad.length + '</b> good posting' + (bad.length > 1 ? 's' : '') + ' altered that should have been left alone' : '') + '. ';
      v += tt.diff ? 'The balance went off still out by ' + lsd(Math.abs(tt.diff)) + '.' : 'The trial balance agreed when it went.';
      v += '</p><p>' + (late ? 'It was ' + clock(t) + ', and the evening mail had gone; the balance goes by tomorrow’s.' : 'Done by ' + clock(t) + ', with the evening mail still in the yard.') + '</p>';
      if (D.com && !isRight(D.com)) v += '<p>One slip could never show in the trial balance: the letter was the only witness to it.</p>';
    }
    $('verdict').className = 'verdict ' + cls; $('verdict').innerHTML = v;
    reveal(errs);
  }

  function reveal(errs) {
    var h = '<h5>What ' + esc(D.clerk) + ' did</h5><div class="tablewrap"><table><thead><tr><th>fo.</th><th>Account</th><th>He</th><th>He wrote</th><th>Should be</th><th></th></tr></thead><tbody>';
    errs.forEach(function (p) {
      var c = p.clerk, ok = isRight(p);
      var wrote = c.posted ? sideWord(c.side) + ' ' + D.A[c.acct].short + ' ' + lsd(c.amt) : 'nothing';
      h += '<tr><td>' + p.fo + '</td><td>' + esc(D.A[p.T.acct].short) + '</td><td>' + WHAT[p.err] + '</td><td>' + esc(wrote) + '</td><td>' + sideWord(p.T.side) + ' ' + esc(D.A[p.T.acct].short) + ' ' + lsd(p.T.amt) + '</td><td class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? 'put right' : 'missed') + '</td></tr>';
    });
    h += '</tbody></table></div>';

    /* the afternoon, as the difference fell */
    var W = 640, H = 170, pl = 46, pr = 14, pt = 14, pb = 28;
    var tmax = Math.max(POST - START, t) + 6, dmax = 1;
    hist.forEach(function (x) { if (x.d > dmax) dmax = x.d; });
    function X(v) { return pl + (W - pl - pr) * v / tmax; }
    function Y(v) { return pt + (H - pt - pb) * (1 - v / dmax); }
    var path = 'M' + X(0) + ',' + Y(hist[0].d);
    for (var i = 1; i < hist.length; i++) path += 'H' + X(hist[i].t) + 'V' + Y(hist[i].d);
    path += 'H' + X(Math.max(t, hist[hist.length - 1].t));
    var svg = '<svg class="bars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="The trial balance difference through the afternoon">';
    svg += '<line x1="' + pl + '" y1="' + Y(0) + '" x2="' + (W - pr) + '" y2="' + Y(0) + '" stroke="rgba(255,255,255,.18)"/>';
    for (var hh = 0; hh <= tmax; hh += 30) svg += '<text x="' + X(hh) + '" y="' + (H - 8) + '" text-anchor="middle">' + clock(hh).replace(' pm', '') + '</text>';
    svg += '<line x1="' + X(POST - START) + '" y1="' + pt + '" x2="' + X(POST - START) + '" y2="' + Y(0) + '" stroke="#ffce6a" stroke-dasharray="4 4"/><text x="' + (X(POST - START) - 4) + '" y="' + (pt + 10) + '" text-anchor="end" style="fill:#ffce6a">mail leaves</text>';
    svg += '<text x="' + (pl - 6) + '" y="' + (Y(dmax) + 4) + '" text-anchor="end">£' + L(dmax) + '</text><text x="' + (pl - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">£0</text>';
    svg += '<path d="' + path + '" fill="none" stroke="#64f0c8" stroke-width="2"/>';
    hist.forEach(function (x, j) { if (j) svg += '<circle cx="' + X(x.t) + '" cy="' + Y(x.d) + '" r="2.6" fill="#64f0c8"/>'; });
    svg += '</svg>';
    h += '<h5>The difference through the afternoon</h5>' + svg;

    /* the month's account, from the true ledger */
    var tb = D.trueBal, ids = D.ids;
    var exp = tb[D.A.findIndex(function (a) { return a.id === 'chg'; })] + tb[D.A.findIndex(function (a) { return a.id === 'wag'; })] + tb[D.A.findIndex(function (a) { return a.id === 'rent'; })];
    var gross = -tb[ids.sell] - (tb[ids.buy] - D.closeGoods), net = gross - exp;
    var debtors = D.cust.reduce(function (s, c) { return s + tb[c]; }, 0), creditors = D.sup.reduce(function (s, c) { return s - tb[c]; }, 0);
    var assets = [['Cash', tb[ids.cash]], ['At the bank', tb[ids.bank]], ['Goods on hand', D.closeGoods], ['Debtors', debtors], ['Bills receivable', tb[ids.br]]];
    var claims = [['Creditors', creditors], ['Bills payable', -tb[ids.bp]], ['Stock', -tb[ids.stock]]];
    if (net >= 0) claims.push(['Gain this month', net]); else assets.push(['Loss this month', -net]);
    var tot = assets.reduce(function (s, x) { return s + Math.max(0, x[1]); }, 0);
    var BW = 640, BH = 250, colw = 120, x1 = 120, x2 = 420, top = 16, hgt = BH - 40;
    var bs = '<svg class="bars" viewBox="0 0 ' + BW + ' ' + BH + '" role="img" aria-label="Balance sheet at the month end">';
    var shades = ['#64f0c8', '#4fc4a6', '#3a9884', '#2a7062', '#1e5248'], shades2 = ['#7aa2ff', '#5f84d6', '#4867ad', '#ffce6a'];
    function stack(list, x, pal, lab) {
      var y = top;
      list.forEach(function (it, j) {
        var v = it[1]; if (v <= 0) return;
        var hv = v / tot * hgt;
        if (it[0].indexOf('Loss') === 0) { bs += '<rect x="' + x + '" y="' + y + '" width="' + colw + '" height="' + Math.max(0.5, hv - 1) + '" fill="none" stroke="#ff8a7a" stroke-dasharray="3 3"/><text x="' + (x + colw + 8) + '" y="' + (y + hv / 2 + 4) + '" style="fill:#ff8a7a">Loss this month £' + L(v) + '</text>'; y += hv; return; }
        bs += '<rect x="' + x + '" y="' + y + '" width="' + colw + '" height="' + Math.max(0.5, hv - 1) + '" fill="' + pal[j % pal.length] + '"/>';
        if (hv > 11) bs += '<text x="' + (x + colw + 8) + '" y="' + (y + hv / 2 + 4) + '">' + it[0] + ' £' + L(v) + '</text>';
        y += hv;
      });
      bs += '<text x="' + (x + colw / 2) + '" y="' + (BH - 8) + '" text-anchor="middle" class="lab">' + lab + '</text>';
    }
    stack(assets, x1 - 100, shades, 'What the house has');
    stack(claims, x2 - 100, shades2, 'Whose it is');
    bs += '</svg>';
    h += '<h5>The month’s account, from the ledger as it should stand</h5>' + bs;
    h += '<p>Goods sold, net of returns, came to <b>' + lsd(-tb[ids.sell]) + '</b>. Goods bought, with last month’s stock on hand, came to <b>' + lsd(tb[ids.buy]) + '</b>, and the inventory taken tonight puts what is left at <b>' + lsd(D.closeGoods) + '</b>, so the goods earned <b>' + lsd(gross) + '</b>. Charges, wages and rent took <b>' + lsd(exp) + '</b>, which leaves the house ' + (net >= 0 ? '<b>' + lsd(net) + '</b> better off' : '<b>' + lsd(-net) + '</b> worse off') + ' than it began the month. ' + (net >= 0 ? 'That gain is the master’s, which is why it sits with his stock on the right.' : 'That loss comes out of the master’s stock, which is why it is drawn on the left to make the two sides meet.') + '</p>';
    $('reveal').innerHTML = h; $('reveal').style.display = '';
  }

  /* ---------- load ---------- */
  function load() {
    D = buildDay(dateFor(dayOff)); sel = -1; called = {}; t = 0; finished = false;
    hist = [{ t: 0, d: Math.abs(tbDiff(D)) }];
    var mo = MONTHS[D.month];
    $('plWho').textContent = 'Counting house · ' + D.town + ' · ' + mo + ' ' + D.year;
    $('plName').textContent = D.master + ', ' + D.trade.what;
    $('plBlurb').innerHTML = 'The last day of ' + mo + '. ' + esc(D.clerk) + ', the junior clerk, has posted the month’s ' + D.E.length + ' entries from the waste book into the ledger and drawn off a trial balance, and it does not agree. ' + esc(D.master) + ' wants it right and in the evening mail to his partner. You have until seven.';
    var lt = D.A[D.letter.acct];
    $('letter').innerHTML = '<p class="who">A letter came this morning</p><p>“Sir, I have made up my account with your house to the end of ' + mo + ' and find by my books that I stand indebted to you <b>' + lsd(D.letter.bal) + '</b>, which I hope you will find to agree with your own. I am, Sir, your humble servant, ' + esc(lt.name.split(',')[0]) + '.”</p>';
    $('rules').innerHTML = '<span><b>' + D.E.length + '</b> entries in the waste book</span><span><b>' + D.A.length + '</b> accounts in the ledger</span><span>calling over: <b>' + CALL + ' min</b> an entry</span><span>the mail leaves at <b>7.00</b></span>';
    $('dayOut').textContent = longDate(D.date) + (dayOff === 0 ? ' (today)' : '');
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    say('Click any posting in the ledger to take it to the desk. Its other half is marked in yellow.');
    render();
  }

  /* ---------- controls ---------- */
  $('ledger').addEventListener('click', function (e) {
    var c = e.target.closest('[data-call]'); if (c) { callOver(+c.getAttribute('data-call')); return; }
    var a = e.target.closest('[data-act]'); if (a) { act(a.getAttribute('data-act')); return; }
    if (e.target.closest('.desk')) return;
    var row = e.target.closest('[data-p]'); if (!row || finished) return;
    var id = +row.getAttribute('data-p');
    sel = sel === id ? -1 : id; render();
    var r2 = document.querySelector('tr.post.sel'); if (r2 && r2.focus) r2.focus({ preventScroll: true });
  });
  $('ledger').addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-p]')) { e.preventDefault(); e.target.click(); }
  });
  $('waste').addEventListener('click', function (e) { var c = e.target.closest('[data-call]'); if (c) callOver(+c.getAttribute('data-call')); });
  $('btnSend').addEventListener('click', function () { if (!finished) finish(false); });
  $('btnReset').addEventListener('click', function () { load(); });
  $('btnGive').addEventListener('click', function () { if (!finished) finish(true); });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
  });

  load();
})();
