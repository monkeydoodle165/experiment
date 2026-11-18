/* drift.quibo.games — The Hop Garden
   Four weeks of hop-picking on a farm in one of twelve hop parishes, some time between 1850 and 1899. The day's
   number picks the parish, four to seven gardens with their varieties, acres and the day each comes ripe, the pickers
   and the rate they are paid, the kilns in the oast, the price of hops that year, and the weather of every day: the
   rain, the warm close spells that let the mould in, and the gales.

   Each morning you see the sky and the glass and choose which garden the pickers strip, or stand them down. A garden
   picked green dries light; one left past its best goes brown and shatters; the mould and the wind take what is left
   standing too long. At the end the page sets your season beside the bailiff's rule (ripest first) and picking the
   gardens in turn, on the same farm and the same weather. Self-contained. */
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
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { var u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function degF(c) { return Math.round(c * 9 / 5 + 32) + '°F'; }
  function money(p) {
    var neg = p < 0; p = Math.round(Math.abs(p));
    var L = Math.floor(p / 240), s = Math.floor((p % 240) / 12), d = p % 12;
    return (neg ? '−' : '') + '£' + L + ' ' + s + 's ' + d + 'd';
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-GB'); }

  /* ---------- the world ---------- */
  /* who: where the pickers come from; t: warmth; wind: how gale-prone; off: days after 28 August picking starts */
  var PLACES = [
    { name: 'Goudhurst', county: 'Kent', who: 'down from Bermondsey and Southwark on the hopping trains', t: 0.4, wind: 1.0, off: 3 },
    { name: 'Paddock Wood', county: 'Kent', who: 'down from the East End on the hopping trains', t: 0.5, wind: 0.9, off: 2 },
    { name: 'Yalding', county: 'Kent', who: 'down from Poplar and Stepney on the hopping trains', t: 0.5, wind: 0.9, off: 2 },
    { name: 'Faversham', county: 'Kent', who: 'from the town and down from London', t: 0.2, wind: 1.3, off: 4 },
    { name: 'Horsmonden', county: 'Kent', who: 'down from Deptford and Rotherhithe', t: 0.4, wind: 1.0, off: 3 },
    { name: 'Marden', county: 'Kent', who: 'down from Bethnal Green on the hopping trains', t: 0.5, wind: 0.9, off: 2 },
    { name: 'Bodiam', county: 'Sussex', who: 'from Hastings and down from London', t: 0.4, wind: 1.2, off: 4 },
    { name: 'Salehurst', county: 'Sussex', who: 'from the villages round and down from London', t: 0.3, wind: 1.1, off: 4 },
    { name: 'Farnham', county: 'Surrey', who: 'from the town, the gipsy camps and down from London', t: 0.3, wind: 0.9, off: 1 },
    { name: 'Bromyard', county: 'Herefordshire', who: 'down from the Black Country and in from Wales', t: -0.3, wind: 1.0, off: 5 },
    { name: 'Ledbury', county: 'Herefordshire', who: 'down from Dudley and Wolverhampton by train', t: -0.2, wind: 1.0, off: 5 },
    { name: 'Tenbury', county: 'Worcestershire', who: 'in from the Black Country and the Welsh hills', t: -0.4, wind: 1.1, off: 6 }
  ];
  /* rip: when in the season it tends to come ripe (days); px: price against the ordinary; from: first year grown widely */
  var HOPS = [
    { name: 'Bramling', rip: 2, px: 1.05, from: 1865 },
    { name: 'Cobb’s', rip: 3, px: 1.0, from: 1850 },
    { name: 'Whitebine', rip: 4, px: 1.08, from: 1850 },
    { name: 'Golding', rip: 7, px: 1.2, from: 1850 },
    { name: 'Jones', rip: 9, px: 0.92, from: 1850 },
    { name: 'Fuggle', rip: 11, px: 0.95, from: 1875 },
    { name: 'Mathon', rip: 10, px: 1.0, from: 1850 },
    { name: 'Grape', rip: 14, px: 0.9, from: 1850 },
    { name: 'Colegate', rip: 17, px: 0.82, from: 1850 }
  ];
  var GARDENS = ['Church Garden', 'Long Garden', 'Pond Garden', 'Kiln Field', 'Bushy Hill', 'Twenty Acre', 'Brook Garden', 'Upper Bines', 'Old Garden', 'Wood Garden', 'Ten Acre', 'Pound Field'];
  var MASTERS = ['Thomas', 'William', 'John', 'George', 'Henry', 'James', 'Richard', 'Edward', 'Samuel', 'Robert', 'Charles', 'Joseph'];
  var BAILIFFS = ['Mr Wickens', 'Mr Ashby', 'Mr Godden', 'Mr Pattenden', 'Mr Buss', 'Mr Hoad', 'Mr Burgess', 'Mr Tapp', 'Mr Funnell', 'Mr Bourner', 'Mr Mepham', 'Mr Igglesden'];
  var KINDS = {
    fine: { name: 'a fine, settled September', wet: 0.22, mean: 4, warm: 1.0, gale: 0.35 },
    close: { name: 'a close, muggy September', wet: 0.44, mean: 5, warm: 1.4, gale: 0.45 },
    broken: { name: 'a broken, windy September', wet: 0.5, mean: 7, warm: -0.6, gale: 0.95 }
  };
  var E = 24;            /* picking days in the season */
  var BU_CWT = 90;       /* bushels of green hops to a hundredweight dried */

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i, j;
    var P = pick(r, PLACES), year = 1850 + Math.floor(r() * 50);
    var dates = [], dt = new Date(year, 7, 28 + P.off, 12);
    while (dates.length < E) { if (dt.getDay() !== 0) dates.push(new Date(dt)); dt.setDate(dt.getDate() + 1); }
    var u = r(), kind = u < 0.34 ? 'fine' : u < 0.66 ? 'close' : 'broken', K = KINDS[kind];

    var pickers = 80 + 10 * Math.floor(r() * 13);
    var perHead = 8 + Math.floor(r() * 4);
    var kilns = 2 + Math.floor(r() * 4);
    var kilnLoad = Math.round(pickers * perHead * (0.85 + r() * 0.35) / kilns / 10) * 10;
    var oast = kilns * kilnLoad;
    var toShilling = 5 + Math.floor(r() * 4);              /* bushels to the shilling */
    var price = Math.round((3 + r() * r() * 11 + r() * 2) * 4) / 4;   /* pounds a hundredweight dried, an ordinary sample */

    /* the gardens */
    var n = 4 + Math.floor(r() * 4), avail = HOPS.filter(function (h) { return h.from <= year; });
    var names = shuffle(r, GARDENS.slice()), cap0 = Math.min(pickers * perHead, oast);
    var total = cap0 * E * (0.72 + r() * 0.2), w = [], ws = 0, gs = [];
    for (i = 0; i < n; i++) { w.push(0.6 + r()); ws += w[i]; }
    for (i = 0; i < n; i++) {
      var h = pick(r, avail), bu = Math.round(total * w[i] / ws / 10) * 10;
      gs.push({ name: names[i], hop: h, bu: bu, acres: Math.max(2, Math.round(bu / (650 + r() * 350))),
        ripe: clamp(Math.round(h.rip + gauss(r) * 2.2 + (kind === 'close' ? -1 : kind === 'broken' ? 1 : 0)), 0, E - 4) });
    }

    /* the weather */
    var rain = [], T = [], sky = [], gale = [], prevWet = r() < K.wet, an = gauss(r) * 1.2;
    for (i = 0; i < E; i++) {
      var p = K.wet * 0.55 + (prevWet ? 0.45 : 0) * (K.wet + 0.25);
      var wet = r() < clamp(p, 0.05, 0.9);
      var mm = wet ? Math.max(0.4, -Math.log(Math.max(1e-6, r())) * K.mean) : 0;
      an = an * 0.7 + gauss(r) * 1.4;
      var tc = 17.2 + P.t + K.warm - i * 0.12 + an - (mm > 2 ? 1.5 : 0);
      rain.push(Math.round(mm * 10) / 10); T.push(tc); gale.push(false);
      prevWet = wet;
    }
    /* gales come in the night after a falling day, with rain */
    var gales = r() < K.gale * P.wind ? 1 + (r() < 0.3 * K.gale ? 1 : 0) : 0;
    for (j = 0; j < gales; j++) {
      var gd = 5 + Math.floor(r() * (E - 7));
      gale[gd] = true;
      if (gd + 1 < E) rain[gd + 1] = Math.max(rain[gd + 1], Math.round((3 + r() * 8) * 10) / 10);
    }
    for (i = 0; i < E; i++) {
      var mm2 = rain[i], tc2 = T[i];
      sky.push(mm2 >= 8 ? 'heavy rain' : mm2 >= 2 ? 'rain' : mm2 > 0 ? 'showers' : tc2 >= 20 ? 'hot and bright' : tc2 >= 16 ? 'fair' : 'grey and cool');
    }
    /* the glass: what it says each morning about the night and tomorrow, mostly right */
    var glass = [];
    for (i = 0; i < E; i++) {
      var next = i + 1 < E ? rain[i + 1] : 0, sc = (gale[i] ? 3 : 0) + (next >= 2 ? 1.2 : next > 0 ? 0.5 : -0.6) + gauss(r) * 0.55;
      glass.push(gale[i] && r() < 0.85 ? 'falling fast' : sc > 1 ? 'falling' : sc > 0 ? 'unsettled' : sc > -0.9 ? 'steady' : 'rising');
    }

    return {
      off: off, P: P, year: year, dates: dates, kind: kind, K: K, pickers: pickers, perHead: perHead, kilns: kilns, kilnLoad: kilnLoad,
      oast: oast, toShilling: toShilling, price: price, gardens: gs, rain: rain, T: T, sky: sky, gale: gale, glass: glass,
      master: pick(r, MASTERS), bailiff: pick(r, BAILIFFS)
    };
  }

  /* ---------- the sample ---------- */
  function factor(dd) {
    if (dd < -6) return 0.55;
    if (dd <= -4) return 0.72;
    if (dd <= -2) return 0.87;
    if (dd <= 4) return 1;
    if (dd <= 7) return 0.88;
    if (dd <= 10) return 0.74;
    if (dd <= 14) return 0.6;
    return 0.45;
  }
  function ripeWord(dd) {
    if (dd < -6) return 'hard and green';
    if (dd <= -4) return 'still green';
    if (dd <= -2) return 'nearly ripe';
    if (dd <= 4) return 'ripe';
    if (dd <= 7) return 'going over';
    if (dd <= 10) return 'brown';
    return 'shattering';
  }
  function heavy(t) { return day.rain[t] >= 8; }
  function wetDay(t) { return day.rain[t] >= 2; }
  function moulding(t) { return day.rain[t] > 0 && day.T[t] >= 14.5; }

  /* ---------- the season as a model ---------- */
  function newState() {
    return {
      t: 0, pickers: day.pickers, cur: -1, done: false, log: [],
      g: day.gardens.map(function (g) { return { left: g.bu, mq: 1, picked: 0, val: 0, blown: 0, mouldy: false }; }),
      bu: 0, val: 0, pay: 0, dry: 0, qsum: 0, blown: 0, lost: 0, quit: 0
    };
  }
  function rate(s, t) {
    var pk = s.pickers * day.perHead, ov = day.oast;
    if (wetDay(t)) { pk *= 0.6; ov *= 0.75; }
    return Math.floor(Math.min(pk, ov));
  }
  function canPick(s, t, k) { return !heavy(t) && s.g[k].left > 0.5; }
  function perBu() { return day.price * 240 / BU_CWT; }

  function step(s, k) {
    var t = s.t, ev = { k: -1, bu: 0, val: 0, q: 0, quit: 0, mould: [], blown: 0, why: '' };
    if (k >= 0 && canPick(s, t, k)) {
      var G = s.g[k], gd = day.gardens[k], take = Math.min(G.left, rate(s, t));
      var q = factor(t - gd.ripe) * G.mq * (wetDay(t) ? 0.9 : 1), v = take * perBu() * gd.hop.px * q;
      G.left -= take; G.picked += take; G.val += v;
      s.bu += take; s.val += v; s.qsum += q * take; s.pay += take * 12 / day.toShilling; s.dry += take * 0.45;
      ev.k = k; ev.bu = take; ev.val = v; ev.q = q; s.cur = k;
    } else {
      if (k >= 0) ev.why = heavy(t) ? 'too wet to pick' : 'nothing left in that garden';
      if (!heavy(t)) {
        var gone = Math.round(s.pickers * (wetDay(t) ? 0.02 : 0.06));
        s.pickers -= gone; s.quit += gone; ev.quit = gone;
      }
    }
    /* the mould, on warm wet days, in anything near ripe and still standing */
    if (moulding(t)) {
      s.g.forEach(function (G, i) {
        var dd = t - day.gardens[i].ripe;
        if (G.left > 0.5 && dd >= -3) { G.mq *= dd > 4 ? 0.9 : 0.95; G.mouldy = true; ev.mould.push(i); }
      });
    }
    /* a gale in the night lays bines on the ground */
    if (day.gale[t]) {
      s.g.forEach(function (G, i) {
        var dd = t - day.gardens[i].ripe;
        if (G.left > 0.5 && dd >= -4) {
          var x = G.left * clamp(0.14 + 0.025 * Math.max(0, dd), 0.14, 0.45);
          G.left -= x; G.blown += x; s.blown += x; ev.blown += x;
        }
      });
    }
    s.log.push(ev);
    s.t++;
    if (s.t >= E) { s.done = true; s.g.forEach(function (G) { s.lost += G.left; }); }
    return ev;
  }
  function net(s) { return s.val - s.pay - s.dry; }

  /* other ways of picking the same September */
  function standing(s) { var a = []; s.g.forEach(function (G, i) { if (G.left > 0.5) a.push(i); }); return a; }
  var POLICIES = {
    rule: function (s, t) {
      var a = standing(s), best = -1, bd = -99;
      a.forEach(function (i) { var dd = t - day.gardens[i].ripe; if (dd > bd) { bd = dd; best = i; } });
      return best;
    },
    turn: function (s) { var a = standing(s); return a.length ? a[0] : -1; }
  };
  function play(pol) { var s = newState(); while (!s.done) step(s, pol(s, s.t)); return s; }

  /* ---------- page state ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('hops'), cx = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dayOff = 0, day = null, st = null, phase = 'season', hover = -1, tick = 0;
  var X0 = 106, X1 = CW - 12, SY = 258;

  function short(t) { var d = day.dates[t]; return d.getDate() + ' ' + MON[d.getMonth()]; }
  function long(t) { var d = day.dates[t]; return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function whenWord(dd) {
    if (dd < 0) return 'ripe in ' + num(-dd) + (dd === -1 ? ' day' : ' days');
    if (dd === 0) return 'ripe today';
    return ripeWord(dd) + ', ' + num(dd) + (dd === 1 ? ' day' : ' days') + ' past';
  }

  /* ---------- drawing ---------- */
  function hash(i) { var h = Math.imul(i ^ 0x9e3779b9, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
  var SKY = {
    'heavy rain': ['#2a3140', '#4a5262'], 'rain': ['#34404f', '#5a6574'], 'showers': ['#3d5a78', '#8aa3b8'],
    'hot and bright': ['#3f86c9', '#e6d9b8'], 'fair': ['#4f86b8', '#d2d6cc'], 'grey and cool': ['#56616f', '#98a2ad']
  };
  function hopCol(dd, mq) {
    var c = dd < -6 ? [70, 130, 52] : dd <= -4 ? [96, 156, 64] : dd <= -2 ? [150, 190, 80] : dd <= 4 ? [205, 214, 104] : dd <= 7 ? [196, 170, 84] : dd <= 10 ? [160, 120, 66] : [120, 88, 56];
    if (mq < 0.99) { var m = clamp((1 - mq) * 3, 0, 0.7); c = c.map(function (v, i) { return Math.round(v * (1 - m) + [110, 112, 104][i] * m); }); }
    return 'rgb(' + c.join(',') + ')';
  }
  function drawScene(t) {
    var tt = Math.min(t, E - 1), sk = SKY[day.sky[tt]] || SKY.fair, x = cx, i, j;
    var g = x.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    x.fillStyle = g; x.fillRect(0, 0, CW, SY);
    if (day.sky[tt] === 'hot and bright' || day.sky[tt] === 'fair') { x.fillStyle = '#fff2b0'; x.beginPath(); x.arc(70, 40, 16, 0, 7); x.fill(); }
    /* the weald */
    x.fillStyle = '#4a6a3e'; x.beginPath(); x.moveTo(0, 96);
    for (i = 0; i <= 32; i++) x.lineTo(i * CW / 32, 92 + Math.sin(i * 0.6 + day.year) * 8 + Math.sin(i * 0.21) * 10);
    x.lineTo(CW, SY); x.lineTo(0, SY); x.fill();
    x.fillStyle = '#6b5a3e'; x.fillRect(0, 214, CW, SY - 214);
    /* the oast: a roundel with its cowl, and the stowage */
    var ox = 548, drying = t > 0 && st.log[t - 1] && st.log[t - 1].bu > 0;
    x.fillStyle = '#a4553c'; x.fillRect(ox - 34, 128, 100, 86);
    x.fillStyle = '#5a3a2a'; x.beginPath(); x.moveTo(ox - 40, 130); x.lineTo(ox + 16, 98); x.lineTo(ox + 72, 130); x.fill();
    for (j = 0; j < Math.min(day.kilns, 3); j++) {
      var kx = ox - 22 + j * 30;
      x.fillStyle = '#b4644a'; x.fillRect(kx - 13, 112, 26, 102);
      x.fillStyle = '#4a3226'; x.beginPath(); x.moveTo(kx - 15, 114); x.lineTo(kx, 66); x.lineTo(kx + 15, 114); x.fill();
      x.fillStyle = '#f2f0ea'; x.beginPath(); x.moveTo(kx - 6, 70); x.lineTo(kx, 52); x.lineTo(kx + 6, 70); x.lineTo(kx + 7, 74); x.lineTo(kx - 6, 74); x.fill();
      if (drying) {
        for (i = 0; i < 6; i++) {
          var ph = ((tick * 0.5 + i * 13 + j * 7) % 60) / 60;
          x.fillStyle = 'rgba(230,230,225,' + (0.32 * (1 - ph)).toFixed(3) + ')';
          x.beginPath(); x.arc(kx + 3 + ph * 22 + Math.sin(ph * 6 + i) * 3, 50 - ph * 40, 3 + ph * 7, 0, 7); x.fill();
        }
      }
    }
    if (day.kilns > 3) { x.fillStyle = '#e8edf5'; x.font = '600 10px ui-monospace,Menlo,monospace'; x.textAlign = 'center'; x.fillText(num(day.kilns) + ' kilns', ox + 16, 228); }
    /* the gardens side by side */
    var n = day.gardens.length, gx0 = 16, gw = (480 - gx0) / n, sway = (t < E && day.gale[tt]) ? Math.sin(tick * 0.08) * 6 + 6 : Math.sin(tick * 0.03) * 1.2;
    for (i = 0; i < n; i++) {
      var G = st.g[i], gd = day.gardens[i], dd = tt - gd.ripe, frac = G.left / gd.bu, left = gx0 + i * gw;
      var col = hopCol(dd, G.mq);
      for (j = 0; j < 4; j++) {
        var px = left + 10 + j * (gw - 20) / 3;
        x.strokeStyle = '#7a5a38'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, 212); x.lineTo(px, 112); x.stroke(); x.lineWidth = 1;
        if (frac > 0.01) {
          var top = 212 - 100 * Math.min(1, 0.25 + frac);
          x.strokeStyle = '#3f7a34'; x.lineWidth = 4; x.beginPath(); x.moveTo(px, 212);
          x.quadraticCurveTo(px + 4 + sway * 0.5, (212 + top) / 2, px + sway, top); x.stroke(); x.lineWidth = 1;
          var cones = Math.round(14 * frac);
          x.fillStyle = col;
          for (var c = 0; c < cones; c++) {
            var cy = 206 - c * (190 - top - 10) / 14 - 4, cxp = px + (c % 2 ? 4 : -4) + sway * (212 - cy) / 100;
            x.beginPath(); x.ellipse(cxp, cy, 2.6, 3.6, 0, 0, 7); x.fill();
          }
        }
      }
      x.strokeStyle = 'rgba(40,30,20,.5)'; x.beginPath(); x.moveTo(left + 8, 112); x.lineTo(left + gw - 8, 112); x.stroke();
      x.fillStyle = 'rgba(7,9,13,.65)'; x.fillRect(left + 2, 218, gw - 4, 34);
      x.fillStyle = (st.cur === i && t < E) ? '#f2d36b' : '#e8edf5'; x.font = '600 10px ui-monospace,Menlo,monospace'; x.textAlign = 'center';
      x.fillText((i + 1) + ' ' + gd.hop.name, left + gw / 2, 231);
      x.fillStyle = '#8b97ab'; x.fillText(G.left > 0.5 ? fmt(G.left) + ' bu' : 'picked out', left + gw / 2, 245);
    }
    /* the pickers at their bins in the garden picked last */
    if (st.cur >= 0 && t > 0 && st.log[t - 1] && st.log[t - 1].bu > 0) {
      var bx = gx0 + st.cur * gw + gw / 2, figs = Math.min(9, Math.round(st.pickers / 20));
      x.fillStyle = '#d8c7a0'; x.fillRect(bx - 22, 200, 44, 10);
      for (i = 0; i < figs; i++) {
        var fx = bx - 24 + (i % 5) * 12 + hash(i) * 3, fy = 190 + Math.floor(i / 5) * 6;
        x.fillStyle = '#f2d36b'; x.beginPath(); x.arc(fx, fy, 2.6, 0, 7); x.fill();
        x.strokeStyle = '#f2d36b'; x.lineWidth = 2; x.beginPath(); x.moveTo(fx, fy + 3); x.lineTo(fx, fy + 11); x.stroke(); x.lineWidth = 1;
      }
    }
    /* rain */
    if (t < E && day.rain[t] > 0) {
      x.strokeStyle = 'rgba(200,220,240,.35)'; x.beginPath();
      var drops = Math.min(160, 20 + day.rain[t] * 8);
      for (i = 0; i < drops; i++) { var rx = (hash(i) * CW + tick * 3) % CW, ry = (hash(i + 999) * SY + tick * 9) % SY; x.moveTo(rx, ry); x.lineTo(rx - 3, ry + 9); }
      x.stroke();
    }
    x.textAlign = 'left';
  }
  function colX(j) { return X0 + j / E * (X1 - X0); }
  function drawStrip(t) {
    var x = cx, cw = (X1 - X0) / E, j, i, n = day.gardens.length, rh = Math.min(20, 132 / n), y0 = 306;
    x.fillStyle = '#0b0f16'; x.fillRect(0, SY, CW, CH - SY);
    x.font = '600 9px ui-monospace,Menlo,monospace'; x.fillStyle = '#8b97ab'; x.textAlign = 'right';
    x.fillText('RAIN', X0 - 6, 290);
    for (i = 0; i < n; i++) x.fillText((i + 1) + ' ' + day.gardens[i].name.toUpperCase(), X0 - 6, y0 + i * rh + rh / 2 + 3);
    if (hover >= 0) { x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(colX(hover), 266, cw, CH - 284); }
    if (t < E) { x.fillStyle = 'rgba(242,211,107,.10)'; x.fillRect(colX(t), 266, cw, CH - 284); }
    for (j = 0; j < E; j++) {
      var c0 = colX(j) + 1, w = cw - 2;
      if (j <= t && j < E) {
        var h = Math.min(26, day.rain[j] * 2.2);
        x.fillStyle = moulding(j) ? '#8fb0a0' : '#6fa8dc'; x.fillRect(c0, 296 - h, w, h);
        if (day.gale[j] && j < t) { x.fillStyle = '#ff8a5b'; x.font = '600 11px ui-monospace,Menlo,monospace'; x.textAlign = 'center'; x.fillText('≋', c0 + w / 2, 276); }
      }
      for (i = 0; i < n; i++) {
        var dd = j - day.gardens[i].ripe, y = y0 + i * rh;
        x.fillStyle = hopCol(dd, 1); x.globalAlpha = j <= t ? 0.55 : 0.22; x.fillRect(c0, y + 2, w, rh - 4); x.globalAlpha = 1;
        if (j < st.log.length && st.log[j].k === i) {
          x.fillStyle = '#ffffff'; x.fillRect(c0 + 1, y + rh / 2 - 3, w - 2, 6);
        }
      }
    }
    /* the best window for each garden */
    x.strokeStyle = 'rgba(242,211,107,.6)';
    for (i = 0; i < n; i++) {
      var a = Math.max(0, day.gardens[i].ripe - 1), b = Math.min(E, day.gardens[i].ripe + 5);
      if (b > a) x.strokeRect(colX(a) + 0.5, y0 + i * rh + 1.5, colX(b) - colX(a) - 1, rh - 3);
    }
    x.textAlign = 'center'; x.fillStyle = '#8b97ab'; x.font = '600 9px ui-monospace,Menlo,monospace';
    for (j = 0; j < E; j += 6) x.fillText(short(j), colX(j) + cw / 2, CH - 6);
    x.textAlign = 'left';
  }
  function draw() { drawScene(st.t); drawStrip(st.t); }
  function loop() { tick++; draw(); requestAnimationFrame(loop); }

  /* ---------- the HUD and the garden buttons ---------- */
  function buildButtons() {
    var box = $('plots'); box.innerHTML = '';
    day.gardens.forEach(function (g, i) {
      var b = document.createElement('button');
      b.className = 'btn plot'; b.type = 'button'; b.id = 'bG' + i;
      b.addEventListener('click', function () { act(i); });
      box.appendChild(b);
    });
  }
  function hud() {
    var t = st.t;
    if (t >= E) {
      $('hWhen').textContent = 'The pickers have gone home';
      $('hSky').textContent = '—'; $('hGlass').textContent = '—';
      $('hSkyBox').className = ''; $('hGlassBox').className = '';
    } else {
      $('hWhen').textContent = long(t);
      $('hSky').textContent = cap(day.sky[t]) + ', ' + degF(day.T[t]);
      $('hGlass').textContent = cap(day.glass[t]);
      $('hSkyBox').className = wetDay(t) ? 'alarm' : '';
      $('hGlassBox').className = day.glass[t] === 'falling fast' ? 'alarm' : '';
    }
    $('hPick').textContent = st.pickers + ' · ' + fmt(t < E ? rate(st, t) : 0) + ' bu a day';
    var s = 'Picked <b>' + fmt(st.bu) + '</b> bushels, about <b>' + (st.bu / BU_CWT).toFixed(1) + ' cwt</b> dried, worth <b>' + money(st.val) + '</b>';
    s += ' · tally paid ' + money(st.pay);
    if (st.blown >= 1) s += ' · <i>' + fmt(st.blown) + ' bu blown down</i>';
    var mouldy = st.g.filter(function (G) { return G.mouldy && G.left > 0.5; }).length;
    if (mouldy) s += ' · <i>mould in ' + num(mouldy) + (mouldy === 1 ? ' garden' : ' gardens') + '</i>';
    if (st.quit) s += ' · ' + st.quit + ' pickers gone to other farms';
    $('plan').innerHTML = s;
    var on = phase === 'season' && t < E;
    day.gardens.forEach(function (g, i) {
      var b = $('bG' + i), G = st.g[i], dd = Math.min(t, E - 1) - g.ripe;
      b.disabled = !on || !canPick(st, t, i);
      b.className = 'btn plot' + (G.left > 0.5 && dd >= -1 && dd <= 4 ? '' : ' ghost');
      b.innerHTML = (i + 1) + ' · ' + g.name + ' <small>' + g.hop.name + ' · ' + (G.left > 0.5 ? fmt(G.left) + ' bu · ' + whenWord(dd) + (G.mq < 0.99 ? ' · mould' : '') : 'picked out') + '</small>';
    });
    $('bRest').disabled = !on;
  }

  function act(k) {
    if (phase !== 'season' || st.t >= E) return;
    var t = st.t, ev = step(st, k), bits = [];
    if (ev.bu) bits.push('the pickers stripped <b>' + fmt(ev.bu) + ' bushels</b> in ' + day.gardens[ev.k].name + ', worth ' + money(ev.val) + ', the sample ' + Math.round(ev.q * 100) + ' in the hundred of its best' + (wetDay(t) ? ' (wet, and slow)' : ''));
    if (ev.why) bits.push('could not: ' + ev.why);
    if (!ev.bu && !ev.why) bits.push(heavy(t) ? 'too wet to pick; the pickers sat in the huts' : 'the pickers stood down');
    if (ev.quit) bits.push(ev.quit + ' pickers went off to the next farm');
    if (ev.mould.length) bits.push('<span style="color:#b9d0c4">warm and wet: the mould is in ' + ev.mould.map(function (i) { return day.gardens[i].name; }).join(', ') + '</span>');
    if (ev.blown >= 1) bits.push('<span style="color:#ff8a5b">a gale in the night laid ' + fmt(ev.blown) + ' bushels on the ground</span>');
    $('msg').innerHTML = '<b>' + short(t) + ':</b> ' + bits.join('; ') + '.';
    if (st.done) end();
    hud(); if (still) draw();
  }

  function row(a, b, c, d) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td><td class="n">' + d + '</td></tr>'; }
  function q(s) { return s.bu ? Math.round(s.qsum / s.bu * 100) + '%' : '—'; }
  function end() {
    phase = 'done';
    var R = play(POLICIES.rule), T = play(POLICIES.turn), me = net(st), best = Math.max(net(R), net(T));
    var v = $('verdict');
    v.className = 'verdict ' + (me >= best - 480 ? 'good' : 'warn');
    v.innerHTML = '<p>The last pocket is pressed and gone to ' + (/Hereford|Worcester/.test(day.P.county) ? 'Worcester' : 'the Borough') + ' at ' + money(day.price * 240) + ' a hundredweight for an ordinary sample. After the tally and the drying it made <b>' + money(me) + '</b>.</p>' +
      '<p>' + (me >= best + 480 ? 'That is better than ' + day.bailiff + ' would have done, either way.' : me >= best - 480 ? 'That is as good as ' + day.bailiff + ' would have done with the same September.' :
        (net(R) >= net(T) ? day.bailiff + '’s rule' : 'Picking the gardens in turn') + ' would have made ' + money(best - me) + ' more out of the same gardens and the same weather.') + '</p>';
    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>The same September, three ways</h5>' +
      '<table class="card"><tr><td></td><td class="n">Yours</td><td class="n">Ripest first</td><td class="n">In turn</td></tr>' +
      row('Bushels picked', fmt(st.bu), fmt(R.bu), fmt(T.bu)) +
      row('Blown down', fmt(st.blown), fmt(R.blown), fmt(T.blown)) +
      row('Left on the bines', fmt(st.lost), fmt(R.lost), fmt(T.lost)) +
      row('Pickers gone off', st.quit, R.quit, T.quit) +
      row('Sample, against its best', q(st), q(R), q(T)) +
      row('Hops sold', money(st.val), money(R.val), money(T.val)) +
      row('Tally and drying', money(st.pay + st.dry), money(R.pay + R.dry), money(T.pay + T.dry)) +
      '<tr class="tot"><td>Clear</td><td class="n">' + money(me) + '</td><td class="n">' + money(net(R)) + '</td><td class="n">' + money(net(T)) + '</td></tr></table>' +
      '<p><b>Ripest first</b> is ' + day.bailiff + '’s rule: every morning, the garden furthest on, whatever the glass says. <b>In turn</b> strips the gardens in the order they lie, one after another, as some farms did to save moving the bins. Neither knows the weather any better than you did.</p>';
    $('bAgain').style.display = '';
  }

  function fresh() {
    st = newState(); phase = 'season';
    $('msg').innerHTML = ''; $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = ''; $('bAgain').style.display = 'none';
    hud(); draw();
  }

  function loadDay(off) {
    dayOff = off; day = buildDay(off);
    var P = day.P, acres = 0;
    day.gardens.forEach(function (g) { acres += g.acres; });
    $('rWho').textContent = 'Hop garden · ' + P.name + ', ' + P.county + ' · ' + num(day.gardens.length) + ' gardens · ' + day.year;
    $('rName').textContent = 'Get the hops in';
    $('rBlurb').innerHTML = 'It is ' + long(0) + ', ' + day.year + ', and it will be ' + day.K.name + '. You are ' + day.master + ', with <b>' + acres + ' acres of hops in ' +
      num(day.gardens.length) + ' gardens</b>, ' + day.bailiff + ' for your bailiff, and <b>' + day.pickers + ' pickers</b> ' + P.who + ', each good for about ' + num(day.perHead) +
      ' bushels a day at ' + num(day.toShilling) + ' bushels to the shilling. The oast has ' + num(day.kilns) + (day.kilns === 1 ? ' kiln' : ' kilns') + ' and can dry <b>' + fmt(day.oast) + ' bushels a day</b>. ' +
      'Hops are fetching about <b>' + money(day.price * 240) + ' a hundredweight</b> this year, and the pickers go home on ' + long(E - 1) + '.';
    $('rBook').textContent = 'Pick them when they rustle in the hand and leave the yellow on your fingers. Never pick in the wet if you can help it, and when the glass goes down with a rush, get the ripest off the poles. — ' + day.bailiff;
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      P.name + ', ' + day.year;
    buildButtons();
    fresh();
  }

  /* ---------- wiring ---------- */
  function dayAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    if (y < SY + 4 || x < X0 || x > X1) return -1;
    return clamp(Math.floor((x - X0) / (X1 - X0) * E), 0, E - 1);
  }
  cv.addEventListener('pointermove', function (e) {
    var j = dayAt(e);
    if (j !== hover) { hover = j; if (still) draw(); }
    if (j < 0) { $('cellOut').textContent = '—'; return; }
    var s = long(j);
    if (j <= st.t && j < E) {
      s += ' · ' + day.sky[j] + ', ' + degF(day.T[j]) + (day.rain[j] ? ', ' + day.rain[j] + ' mm' : '') + ' · glass ' + day.glass[j];
      if (j < st.log.length) {
        var ev = st.log[j];
        s += ' · ' + (ev.bu ? fmt(ev.bu) + ' bu from ' + day.gardens[ev.k].name : 'no picking');
        if (ev.blown >= 1) s += ' · gale, ' + fmt(ev.blown) + ' bu down';
      } else s += ' · today';
    } else s += ' · still to come';
    var ripe = day.gardens.filter(function (g) { return g.ripe === j; }).map(function (g) { return g.name; });
    if (ripe.length) s += ' · ripe: ' + ripe.join(', ');
    $('cellOut').textContent = s;
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; if (still) draw(); });
  $('bRest').addEventListener('click', function () { act(-1); });
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'season') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var m = /^Digit([0-7])$/.exec(e.code);
    if (!m) return;
    var k = +m[1] - 1;
    if (k < 0) act(-1);
    else if (k < day.gardens.length && canPick(st, st.t, k)) act(k);
    e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  if (!still) requestAnimationFrame(loop);
})();
