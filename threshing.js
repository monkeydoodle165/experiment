/* drift.quibo.games — The Threshing Barn
   Nineteen weeks from Martinmas to Lady Day on a corn farm in one of twelve arable parishes, some time between 1820
   and 1869. The day's number picks the parish, three to five ricks of wheat, barley, oats and beans standing in the
   rickyard, the men with flails, the weeks the travelling threshing machine is booked to the parish, the winter, and
   the corn market: whether it rises towards spring, falls away, or will not make up its mind.

   Each week you choose which rick the men thresh on the barn floor (or hire the machine to do it in a week, and pay
   the poor rate for the men it puts out of work), and whether to cart what is threshed to market at that week's price.
   The rats eat the ricks, the half-year's rent falls due at Christmas, and at Lady Day the men go to the spring work and
   whatever is still in the rick is sold standing to the dealer at three-quarters of its worth. At the end the page sets
   your winter beside the old farmer's way and selling as you go, on the same farm, the same winter and the same market.
   Self-contained. */
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
    var h = s ^ 0x5b2e7c41;
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
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function money(p) {
    var neg = p < 0; p = Math.round(Math.abs(p));
    var L = Math.floor(p / 240), s = Math.floor((p % 240) / 12), d = p % 12;
    return (neg ? '−' : '') + '£' + L + ' ' + s + 's ' + d + 'd';
  }
  function shil(p) { return Math.round(p / 12) + 's'; }
  function qr(n) { return (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10) + ' qr'; }

  /* ---------- the world ---------- */
  var PLACES = [
    { name: 'Great Coxwell', county: 'Berkshire' }, { name: 'Cressing', county: 'Essex' },
    { name: 'Thaxted', county: 'Essex' }, { name: 'Lenham', county: 'Kent' },
    { name: 'Harmondsworth', county: 'Middlesex' }, { name: 'Tisbury', county: 'Wiltshire' },
    { name: 'Alciston', county: 'Sussex' }, { name: 'Swaffham', county: 'Norfolk' },
    { name: 'Holkham', county: 'Norfolk' }, { name: 'Sledmere', county: 'the East Riding' },
    { name: 'Bredon', county: 'Worcestershire' }, { name: 'Bishop’s Cleeve', county: 'Gloucestershire' }
  ];
  /* base: pence a quarter in an ordinary year; rate: quarters a man threshes in a week with the flail;
     piece: what he is paid a quarter; rat: what the rats take from a rick in a week */
  var CROPS = {
    wheat: { name: 'wheat', base: 672, rate: 3, piece: 36, rat: 0.012, c: [222, 184, 88] },
    barley: { name: 'barley', base: 408, rate: 5, piece: 24, rat: 0.010, c: [232, 214, 156] },
    oats: { name: 'oats', base: 288, rate: 7, piece: 16, rat: 0.008, c: [170, 178, 122] },
    beans: { name: 'beans', base: 456, rate: 5, piece: 20, rat: 0.006, c: [160, 116, 84] }
  };
  var ORDER = ['wheat', 'barley', 'oats', 'beans'];
  var FIELDS = ['Long Field', 'Barn Close', 'Church Piece', 'Upper Ground', 'Mill Field', 'Twelve Acres', 'Hollow Field', 'Windmill Hill', 'Broad Mead', 'Furze Close', 'Gallows Hill', 'Pond Piece'];
  var MASTERS = ['Thomas', 'William', 'John', 'George', 'Henry', 'James', 'Richard', 'Edward', 'Samuel', 'Robert', 'Charles', 'Joseph'];
  var FATHERS = ['old Mr Bushell', 'old Mr Tull', 'old Mr Coke', 'old Mr Read', 'old Mr Ellman', 'old Mr Webb', 'old Mr Pusey', 'old Mr Lawes', 'old Mr Hudson', 'old Mr Garrett', 'old Mr Mechi', 'old Mr Spooner'];
  var WINTERS = {
    open: { name: 'an open winter, mild and wet', cold: 2.5, wet: 0.55, snow: 0.05, flood: 0.15 },
    hard: { name: 'a hard winter, with long frosts and snow on the roads', cold: -1.8, wet: 0.35, snow: 0.7, flood: 0.05 },
    wet: { name: 'a wet winter, with the brooks out over the meadows', cold: 1.4, wet: 0.7, snow: 0.15, flood: 0.38 }
  };
  var MARKETS = {
    rising: 'the corn trade will climb towards spring',
    falling: 'the corn trade will fall away all winter',
    unsettled: 'the corn trade will not make up its mind'
  };
  var W = 19;            /* weeks from the Monday after Martinmas to Lady Day */
  var MACH_WEEK = 14;    /* the machine does fourteen men's weeks in one */
  var MACH_FEE = 360;    /* the machine, its horses and its man for the week, in pence, and then so much a quarter */
  var MACH_QR = 8;
  var RELIEF = 108;      /* the parish pays a man out of work about nine shillings a week, and the poor rate pays the parish */

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i, j;
    var P = pick(r, PLACES), year = 1820 + Math.floor(r() * 50);
    var start = new Date(year, 10, 12, 12);
    while (start.getDay() !== 1) start.setDate(start.getDate() + 1);
    var dates = [], xd = new Date(year, 11, 25, 12), xmas = 6;
    for (i = 0; i < W; i++) { var dd = new Date(start); dd.setDate(start.getDate() + 7 * i); dates.push(dd); }
    for (i = 0; i < W; i++) { var e = new Date(dates[i]); e.setDate(e.getDate() + 7); if (dates[i] <= xd && xd < e) xmas = i; }

    var u = r(), wk = u < 0.34 ? 'open' : u < 0.67 ? 'hard' : 'wet', K = WINTERS[wk];
    u = r(); var mk = u < 0.4 ? 'rising' : u < 0.7 ? 'falling' : 'unsettled';
    var men = 2 + Math.floor(r() * 4), f = 0.82 + r() * 0.42;

    /* the ricks: always some wheat and some barley */
    var n = 3 + Math.floor(r() * 3), crops = ['wheat', 'barley'], extra = shuffle(r, ORDER.slice());
    for (i = 0; crops.length < n; i++) crops.push(extra[i % extra.length]);
    shuffle(r, crops);
    var fields = shuffle(r, FIELDS.slice()), ricks = [], work = 0;
    for (i = 0; i < n; i++) {
      var q0 = 22 + r() * 48;
      ricks.push({ c: crops[i], field: fields[i], qr: q0, staddle: r() < 0.45 });
      work += q0 / (men * CROPS[crops[i]].rate);
    }
    var scale = W * (0.68 + r() * 0.2) / work, total = 0;
    ricks.forEach(function (k) { k.qr = Math.max(8, Math.round(k.qr * scale)); total += k.qr * CROPS[k.c].base * f; });

    /* the market: a common run for the whole trade, and each grain wandering a little off it */
    var trend = mk === 'rising' ? 0.1 + r() * 0.14 : mk === 'falling' ? -(0.08 + r() * 0.12) : (r() - 0.5) * 0.08;
    var vol = mk === 'unsettled' ? 0.05 : 0.028, common = [], cn = 0;
    for (i = 0; i < W; i++) { cn = cn * 0.7 + gauss(r) * vol; common.push(trend * i / (W - 1) + cn); }
    var price = {};
    ORDER.forEach(function (c) {
      var own = 0, a = [], tilt = gauss(r) * 0.04;
      for (i = 0; i < W; i++) { own = own * 0.6 + gauss(r) * 0.014; a.push(Math.round(CROPS[c].base * f * (1 + common[i] + own + tilt * i / (W - 1)) / 3) * 3); }
      price[c] = a;
    });
    /* the merchant's word on the trade next week, mostly right */
    var word = [];
    for (i = 0; i < W; i++) {
      if (i === W - 1) { word.push('Lady Day'); continue; }
      var dl = common[i + 1] - common[i] + gauss(r) * vol * 0.55;
      word.push(dl > 0.012 ? 'rising' : dl > 0 ? 'firm' : dl > -0.012 ? 'dull' : 'falling');
    }

    /* the winter, a week at a time; snow and floods shut the roads to market */
    var T = [], sky = [], shut = [], an = gauss(r) * 1.5;
    for (i = 0; i < W; i++) {
      an = an * 0.6 + gauss(r) * 1.8;
      var t = 4 + K.cold + an - 2.2 * Math.sin(Math.PI * i / (W - 1)), wet = r() < K.wet, s, sh = false;
      if (t < 0.8 && wet && r() < 0.35 + K.snow * 0.6) { s = 'snow'; sh = r() < 0.6; }
      else if (t < -1.5) s = 'hard frost';
      else if (t < 1.2) s = 'frost';
      else if (wet && r() < K.flood) { s = 'floods'; sh = r() < 0.75; }
      else if (wet) s = 'rain';
      else s = t >= 6 ? 'open and mild' : 'grey and raw';
      T.push(t); sky.push(s); shut.push(sh);
    }
    shut[W - 1] = false;

    /* the machine's round: none in 1830, when the labourers broke them */
    var mach = [];
    if (year !== 1830) {
      mach.push(1 + Math.floor(r() * 6));
      if (r() < 0.65) mach.push(9 + Math.floor(r() * 8));
    }

    var rent = Math.max(240, Math.round(total * (0.27 + r() * 0.08) / 240) * 240);
    return {
      off: off, P: P, year: year, dates: dates, xmas: xmas, wk: wk, K: K, mk: mk, men: men, f: f, ricks: ricks, price: price,
      word: word, T: T, sky: sky, shut: shut, mach: mach, rent: rent, cash0: Math.round(total * 0.05 / 12) * 12,
      master: pick(r, MASTERS), father: pick(r, FATHERS)
    };
  }

  /* ---------- the winter as a model ---------- */
  function C(k) { return CROPS[day.ricks[k].c]; }
  function machHere(w) { return day.mach.indexOf(w) >= 0; }
  function damp(w) { return day.sky[w] === 'rain' || day.sky[w] === 'floods'; }
  function cold(w) { return day.sky[w] === 'hard frost' || day.sky[w] === 'snow'; }
  function flailRate(k, w) { return day.men * C(k).rate * (w === day.xmas ? 4 / 6 : 1) * (damp(w) ? 0.85 : 1); }
  function machRate(k) { return C(k).rate * MACH_WEEK; }
  function ratRate(k, w) { return C(k).rat * (day.ricks[k].staddle ? 0.4 : 1) * (cold(w) ? 1.4 : 1); }

  function newState() {
    var g = {}; ORDER.forEach(function (c) { g[c] = 0; });
    return {
      w: 0, done: false, log: [], cash: day.cash0, rk: day.ricks.map(function (k) { return { qr: k.qr }; }), gran: g,
      flail: 0, byMach: 0, ratsR: 0, ratsG: 0, wages: 0, fees: 0, rates: 0, sales: 0, interest: 0, rentPaid: false,
      standing: 0, standQr: 0, sold: [], cur: -1, machNow: false, lastMach: false
    };
  }
  function granTotal(s) { var a = 0; ORDER.forEach(function (c) { a += s.gran[c]; }); return a; }
  function rickTotal(s) { var a = 0; s.rk.forEach(function (k) { a += k.qr; }); return a; }

  function sell(s, c) {
    var w = s.w;
    if (s.done || day.shut[w] || s.gran[c] < 0.05) return 0;
    var q = s.gran[c], v = q * day.price[c][w];
    s.cash += v; s.sales += v; s.gran[c] = 0;
    s.sold.push({ w: w, c: c, q: q, v: v });
    return v;
  }

  /* a: rick index to thresh, or -1; m: with the machine */
  function step(s, a, m) {
    var w = s.w, ev = { a: a, m: false, q: 0, cost: 0, rates: 0, ratsR: 0, ratsG: 0, rent: 0, int: 0, why: '' };
    if (a >= 0 && s.rk[a].qr < 0.05) { ev.why = 'that rick is threshed out'; a = -1; ev.a = -1; }
    if (a >= 0) {
      var R = s.rk[a], c = day.ricks[a].c, q;
      if (m && machHere(w)) {
        q = Math.min(R.qr, machRate(a));
        ev.m = true; ev.cost = MACH_FEE + MACH_QR * q; ev.rates = day.men * RELIEF;
        s.fees += ev.cost; s.rates += ev.rates; s.byMach += q;
      } else {
        q = Math.min(R.qr, flailRate(a, w));
        ev.cost = q * CROPS[c].piece; s.wages += ev.cost; s.flail += q;
      }
      R.qr -= q; if (R.qr < 0.05) R.qr = 0;
      s.gran[c] += q; ev.q = q; s.cash -= ev.cost + ev.rates; s.cur = a;
    } else s.cur = -1;
    s.lastMach = ev.m;

    /* the week goes by: the rats in the ricks and the granary */
    s.rk.forEach(function (R, k) { var x = R.qr * ratRate(k, w); R.qr -= x; ev.ratsR += x; });
    ORDER.forEach(function (c) { var x = s.gran[c] * 0.002; s.gran[c] -= x; ev.ratsG += x; });
    s.ratsR += ev.ratsR; s.ratsG += ev.ratsG;

    /* the rent at Christmas, and interest on what is owed after it */
    if (w === day.xmas) { s.cash -= day.rent; ev.rent = day.rent; s.rentPaid = true; }
    else if (w > day.xmas && s.cash < 0) { ev.int = -s.cash * 0.006; s.cash -= ev.int; s.interest += ev.int; }

    s.log.push(ev);
    s.w++;
    if (s.w >= W) {
      s.done = true;
      var L = W - 1;
      ORDER.forEach(function (c) { if (s.gran[c] > 0.05) { var v = s.gran[c] * day.price[c][L]; s.cash += v; s.sales += v; s.sold.push({ w: L, c: c, q: s.gran[c], v: v, end: true }); s.gran[c] = 0; } });
      s.rk.forEach(function (R, k) { var v = R.qr * day.price[day.ricks[k].c][L] * 0.75; s.standing += v; s.standQr += R.qr; s.cash += v; R.qr = 0; });
    }
    return ev;
  }
  function clear(s) { return s.cash - day.cash0; }

  /* other ways of getting through the same winter */
  function ratWorst(s, w, only) {
    var best = -1, bv = -1;
    s.rk.forEach(function (R, k) {
      if (R.qr < 0.05 || (only && day.ricks[k].c !== only)) return;
      var v = R.qr * ratRate(k, w) * day.price[day.ricks[k].c][w] + R.qr * 0.001;
      if (v > bv) { bv = v; best = k; }
    });
    return best;
  }
  var POLICIES = {
    father: function (s) {
      var w = s.w;
      if (w <= day.xmas) {
        if (!day.shut[w]) sell(s, 'wheat');
        var k = ratWorst(s, w, 'wheat');
        return { a: k >= 0 ? k : ratWorst(s, w), m: false };
      }
      if (w >= W - 4 && !day.shut[w]) ORDER.forEach(function (c) { sell(s, c); });
      return { a: ratWorst(s, w), m: false };
    },
    asYouGo: function (s) {
      var w = s.w;
      if (!day.shut[w]) ORDER.forEach(function (c) { sell(s, c); });
      var k = ratWorst(s, w);
      if (machHere(w)) { var big = -1, bv = 0; s.rk.forEach(function (R, i) { var v = R.qr * day.price[day.ricks[i].c][w]; if (v > bv) { bv = v; big = i; } }); k = big; }
      return { a: k, m: machHere(w) };
    }
  };
  function play(pol) { var s = newState(); while (!s.done) { var c = pol(s); step(s, c.a, c.m); } return s; }

  /* ---------- page state ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('barn'), cx = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dayOff = 0, day = null, st = null, phase = 'season', hover = -1, tick = 0;
  var X0 = 112, X1 = CW - 12, SY = 258;

  function short(w) { var d = day.dates[w]; return d.getDate() + ' ' + MON[d.getMonth()]; }
  function long(w) { var d = day.dates[w]; return 'the week of ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function rickName(k) { return cap(day.ricks[k].c) + ', ' + day.ricks[k].field; }

  /* ---------- drawing ---------- */
  function hash(i) { var h = Math.imul(i ^ 0x9e3779b9, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
  function rgb(c, a) { return a === undefined ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')'; }
  var SKY = {
    'snow': ['#6d7684', '#c9ced6'], 'hard frost': ['#4f7fb4', '#dde6ee'], 'frost': ['#5a86b2', '#cfd8de'],
    'floods': ['#323d4c', '#5d6876'], 'rain': ['#38434f', '#64707c'], 'open and mild': ['#4f86b8', '#d9d2b8'],
    'grey and raw': ['#58626e', '#9aa3ab']
  };
  function drawScene(w) {
    var ww = Math.min(w, W - 1), skyw = day.sky[ww], sk = SKY[skyw] || SKY['grey and raw'], x = cx, i, j;
    var white = skyw === 'snow' || skyw === 'hard frost', ending = w >= W;
    var g = x.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    x.fillStyle = g; x.fillRect(0, 0, CW, SY);
    if (skyw === 'open and mild' || skyw === 'hard frost' || skyw === 'frost') { x.fillStyle = '#fff2c8'; x.beginPath(); x.arc(600, 40, 13, 0, 7); x.fill(); }
    /* the downs and the ground */
    x.fillStyle = white ? '#c8ced4' : '#56664a'; x.beginPath(); x.moveTo(0, 112);
    for (i = 0; i <= 32; i++) x.lineTo(i * CW / 32, 104 + Math.sin(i * 0.45 + day.year) * 8 + Math.sin(i * 0.19 + 2) * 10);
    x.lineTo(CW, SY); x.lineTo(0, SY); x.fill();
    x.fillStyle = white ? '#e2e6ea' : skyw === 'floods' ? '#5a6458' : '#6e6450'; x.fillRect(0, 196, CW, SY - 196);
    if (skyw === 'floods') { x.fillStyle = 'rgba(150,175,200,.45)'; x.fillRect(0, 118, CW, 12); }

    /* the barn: weatherboard, a deep thatch, the great doors open on the floor */
    var bx = 14, bw = 250, by = 96;
    x.fillStyle = '#3a2c22'; x.fillRect(bx, by, bw, 108);
    x.strokeStyle = 'rgba(0,0,0,.25)';
    for (i = 0; i < 12; i++) { x.beginPath(); x.moveTo(bx, by + 6 + i * 9); x.lineTo(bx + bw, by + 6 + i * 9); x.stroke(); }
    x.fillStyle = white ? '#e8ecef' : '#8a7448'; x.beginPath(); x.moveTo(bx - 12, by + 4); x.lineTo(bx + 40, by - 52); x.lineTo(bx + bw - 40, by - 52); x.lineTo(bx + bw + 12, by + 4); x.fill();
    var dx = bx + 84, dw = 82, dy = by + 14;
    x.fillStyle = '#1b1712'; x.fillRect(dx, dy, dw, 204 - dy);
    var lit = x.createLinearGradient(0, dy, 0, 204); lit.addColorStop(0, 'rgba(255,220,150,.04)'); lit.addColorStop(1, 'rgba(255,220,150,.22)');
    x.fillStyle = lit; x.fillRect(dx, dy, dw, 204 - dy);
    x.fillStyle = '#4a3828'; x.fillRect(dx - 26, dy, 24, 204 - dy); x.fillRect(dx + dw + 2, dy, 24, 204 - dy);
    x.fillStyle = '#7a6040'; x.fillRect(dx, 196, dw, 8);
    var working = w > 0 && st.log[w - 1] && st.log[w - 1].q > 0 && !ending, machLast = working && st.log[w - 1].m;
    if (working && !machLast) {
      /* the men at the flails, swinging by turns */
      var nm = Math.min(day.men, 4), col = C(st.log[w - 1].a).c;
      for (j = 0; j < 14; j++) { x.fillStyle = rgb(col, 0.8); x.fillRect(dx + 8 + hash(j) * (dw - 16), 194 + hash(j + 7) * 3, 3, 1.5); }
      for (i = 0; i < nm; i++) {
        var mx = dx + 14 + i * (dw - 28) / Math.max(1, nm - 1), side = i % 2 ? -1 : 1, ph = still ? 0.6 : tick * 0.11 + i * Math.PI / nm;
        var sw = (Math.sin(ph) + 1) / 2, hx = mx + side * 2, hy = 168;
        x.strokeStyle = '#e9dcc0'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(mx, 196); x.lineTo(mx, 176); x.stroke();
        x.fillStyle = '#e9dcc0'; x.beginPath(); x.arc(mx, 170, 3, 0, 7); x.fill();
        var ex = hx + side * (4 + 8 * sw), ey = hy - 8 + 14 * (1 - sw);
        x.strokeStyle = '#a07a4a'; x.lineWidth = 2; x.beginPath(); x.moveTo(mx, 178); x.lineTo(ex, ey); x.stroke();
        var sa = -Math.PI / 2 + side * (0.2 + 2.6 * (1 - sw)), sl = 12;
        x.strokeStyle = '#c8a46a'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex + Math.cos(sa) * sl * side, ey + Math.sin(sa) * sl); x.stroke();
        x.lineWidth = 1;
      }
      if (!still) { x.fillStyle = 'rgba(240,220,170,.18)'; for (j = 0; j < 10; j++) { var px = dx + 6 + hash(j * 3 + 1) * (dw - 12), py = 150 + ((hash(j * 5) * 46 + tick * 0.3 * (0.5 + hash(j))) % 46); x.fillRect(px, py, 2, 2); } }
    }
    if (machLast) {
      /* the machine in the doorway and the horses at the gear outside */
      x.fillStyle = '#8a2e22'; x.fillRect(dx + 10, 168, dw - 20, 26); x.fillStyle = '#5a1e16'; x.fillRect(dx + 14, 160, dw - 28, 8);
      x.fillStyle = '#222'; x.beginPath(); x.arc(dx + 22, 196, 7, 0, 7); x.arc(dx + dw - 22, 196, 7, 0, 7); x.fill();
      var gx = bx + bw + 6, gy = 222, ang = still ? 0.6 : tick * 0.03;
      x.strokeStyle = '#6a4a30'; x.lineWidth = 3; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + Math.cos(ang) * 22, gy + Math.sin(ang) * 7); x.stroke(); x.lineWidth = 1;
      var hx2 = gx + Math.cos(ang) * 22, hy2 = gy + Math.sin(ang) * 7;
      x.fillStyle = '#7a4e2e'; x.fillRect(hx2 - 8, hy2 - 9, 16, 8); x.fillRect(hx2 - 7, hy2 - 1, 2, 7); x.fillRect(hx2 + 5, hy2 - 1, 2, 7);
      if (!still) { x.fillStyle = 'rgba(240,220,170,.25)'; for (j = 0; j < 18; j++) x.fillRect(dx + hash(j) * dw, dy + ((hash(j + 3) * 60 + tick * 0.6) % 60), 2, 2); }
    }
    /* the granary: sacks by the barn end */
    var gt = granTotal(st), sacks = Math.min(24, Math.ceil(gt / 4));
    for (i = 0; i < sacks; i++) {
      var sx = bx + 180 + (i % 6) * 11, sy = 196 - Math.floor(i / 6) * 9;
      x.fillStyle = i % 3 ? '#cbb68a' : '#b9a374'; x.beginPath(); x.ellipse(sx, sy - 4, 5, 5, 0, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(7,9,13,.65)'; x.fillRect(bx, 218, bw, 34);
    x.fillStyle = '#e8edf5'; x.font = '600 10px ui-monospace,Menlo,monospace'; x.textAlign = 'center';
    x.fillText(working ? (machLast ? 'The machine is in the barn' : cap(num(day.men)) + (day.men === 1 ? ' man' : ' men') + ' at the flails') : 'The barn floor is quiet', bx + bw / 2, 231);
    x.fillStyle = '#8b97ab'; x.fillText('Granary · ' + qr(gt) + ' threshed, unsold', bx + bw / 2, 245);

    /* the rickyard */
    var n = day.ricks.length, rx0 = 290, rw = (CW - 8 - rx0) / n;
    for (i = 0; i < n; i++) {
      var R = st.rk[i], k0 = day.ricks[i], f = clamp(R.qr / k0.qr, 0, 1), cc = CROPS[k0.c].c, cxr = rx0 + i * rw + rw / 2;
      var rwid = Math.min(54, rw * 0.72), base = k0.staddle ? 196 : 204;
      if (k0.staddle) { x.fillStyle = '#9a968c'; for (j = 0; j < 3; j++) { var stx = cxr - rwid / 2 + 5 + j * (rwid - 10) / 2; x.fillRect(stx - 1.5, 198, 3, 6); x.fillRect(stx - 4, 196, 8, 2); } }
      if (R.qr >= 0.05) {
        var ht = 12 + 52 * f;
        x.fillStyle = rgb(cc); x.fillRect(cxr - rwid / 2, base - ht, rwid, ht);
        x.fillStyle = 'rgba(0,0,0,.12)'; for (j = 0; j < 4; j++) x.fillRect(cxr - rwid / 2, base - ht + j * ht / 4, rwid, 1);
        x.fillStyle = white ? '#eef1f3' : '#7d6a44'; x.beginPath(); x.moveTo(cxr - rwid / 2 - 4, base - ht + 1); x.lineTo(cxr, base - ht - 24); x.lineTo(cxr + rwid / 2 + 4, base - ht + 1); x.fill();
        if (st.cur === i && !ending) { x.strokeStyle = '#f2d36b'; x.lineWidth = 1.5; x.strokeRect(cxr - rwid / 2 - 2, base - ht - 2, rwid + 4, ht + 4); x.lineWidth = 1; }
        /* the rats */
        if (!k0.staddle && !still && w < W) {
          x.fillStyle = '#2a221c';
          for (j = 0; j < 2; j++) { var rp = (tick * (0.6 + j * 0.3) + hash(i * 9 + j) * 200) % 220; if (rp < 60) { x.beginPath(); x.ellipse(cxr - rwid / 2 + rp, 205, 3, 1.6, 0, 0, 7); x.fill(); } }
        }
      } else { x.fillStyle = 'rgba(200,180,120,.35)'; x.fillRect(cxr - rwid / 2, base - 3, rwid, 3); }
      x.fillStyle = 'rgba(7,9,13,.65)'; x.fillRect(rx0 + i * rw + 2, 218, rw - 4, 34);
      x.fillStyle = st.cur === i && !ending ? '#f2d36b' : '#e8edf5'; x.font = '600 10px ui-monospace,Menlo,monospace';
      var nmx = (i + 1) + ' ' + cap(k0.c);
      x.fillText(nmx, cxr, 231);
      x.fillStyle = '#8b97ab'; var sub = qr(R.qr) + (k0.staddle ? ' · staddles' : '');
      while (x.measureText(sub).width > rw - 8 && sub.length > 4) sub = sub.slice(0, -2) + '…';
      x.fillText(sub, cxr, 245);
    }
    /* snow and rain */
    if (w < W && (skyw === 'snow' || skyw === 'rain' || skyw === 'floods')) {
      var drops = skyw === 'snow' ? 90 : 120;
      x.strokeStyle = 'rgba(200,220,240,.35)'; x.fillStyle = 'rgba(245,248,252,.85)'; x.beginPath();
      for (i = 0; i < drops; i++) {
        var qx = (hash(i) * CW + tick * (skyw === 'snow' ? 0.6 : 3)) % CW, qy = (hash(i + 999) * SY + tick * (skyw === 'snow' ? 1.1 : 9)) % SY;
        if (skyw === 'snow') x.fillRect(qx, qy, 2, 2); else { x.moveTo(qx, qy); x.lineTo(qx - 3, qy + 9); }
      }
      x.stroke();
    }
    x.textAlign = 'left';
  }
  function colX(j) { return X0 + j / W * (X1 - X0); }
  function crops() { var a = []; day.ricks.forEach(function (k) { if (a.indexOf(k.c) < 0) a.push(k.c); }); return ORDER.filter(function (c) { return a.indexOf(c) >= 0; }); }
  function drawStrip(w) {
    var x = cx, cw = (X1 - X0) / W, j, i, n = day.ricks.length, cs = crops();
    var py0 = 268, py1 = 352, yr = 374, y0 = 390, rh = Math.min(13, 52 / n);
    x.fillStyle = '#0b0f16'; x.fillRect(0, SY, CW, CH - SY);
    if (hover >= 0) { x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(colX(hover), py0 - 4, cw, y0 + n * rh + 4 - py0); }
    if (w < W) { x.fillStyle = 'rgba(242,211,107,.10)'; x.fillRect(colX(w), py0 - 4, cw, y0 + n * rh + 4 - py0); }
    /* Christmas and the machine's weeks are known in advance */
    x.fillStyle = 'rgba(255,138,91,.14)'; x.fillRect(colX(day.xmas), py0 - 4, cw, y0 + n * rh + 4 - py0);
    x.font = '600 9px ui-monospace,Menlo,monospace'; x.textAlign = 'right'; x.fillStyle = '#8b97ab';
    x.fillText('PRICE', X0 - 6, py0 + 8);
    x.fillText('AGAINST', X0 - 6, py0 + 19);
    x.fillText('NOVEMBER', X0 - 6, py0 + 30);
    /* the price of each grain, as a share of where it stood in November */
    var lo = 0.8, hi = 1.24;
    function yp(v) { return py1 - (clamp(v, lo, hi) - lo) / (hi - lo) * (py1 - py0); }
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.setLineDash([3, 4]); x.beginPath(); x.moveTo(X0, yp(1)); x.lineTo(X1, yp(1)); x.stroke(); x.setLineDash([]);
    x.textAlign = 'left'; x.fillStyle = '#5f6b7e'; x.fillText('100', X1 - 20, yp(1) - 3);
    var upto = Math.min(w, W - 1);
    cs.forEach(function (c, ci) {
      var a = day.price[c], p0 = a[0];
      x.strokeStyle = rgb(CROPS[c].c); x.lineWidth = 1.6; x.beginPath();
      for (j = 0; j <= upto; j++) { var X = colX(j) + cw / 2, Y = yp(a[j] / p0); if (j) x.lineTo(X, Y); else x.moveTo(X, Y); }
      x.stroke(); x.lineWidth = 1;
      x.textAlign = 'right'; x.fillStyle = rgb(CROPS[c].c); x.fillText(c.toUpperCase(), X0 - 6, py0 + 46 + ci * 10);
    });
    st.sold.forEach(function (s) {
      var X = colX(s.w) + cw / 2, Y = yp(day.price[s.c][s.w] / day.price[s.c][0]);
      x.fillStyle = rgb(CROPS[s.c].c); x.strokeStyle = '#0b0f16'; x.beginPath(); x.arc(X, Y, 2.5 + Math.min(4, Math.sqrt(s.q) * 0.6), 0, 7); x.fill(); x.stroke();
    });
    /* the weather and the market */
    x.textAlign = 'right'; x.fillStyle = '#8b97ab'; x.fillText('ROADS', X0 - 6, yr + 3);
    for (j = 0; j < W; j++) {
      var c0 = colX(j) + 1, ww = cw - 2;
      x.textAlign = 'center';
      if (j <= upto) {
        if (day.shut[j]) { x.fillStyle = '#ff8a5b'; x.fillText('shut', c0 + ww / 2, yr + 3); }
        else { x.fillStyle = day.sky[j] === 'snow' ? '#e8f4ff' : cold(j) ? '#9fc4e0' : damp(j) ? '#6fa8dc' : '#5f6b7e'; x.fillText(day.sky[j] === 'snow' ? '✱' : cold(j) || day.sky[j] === 'frost' ? '·' : damp(j) ? '╱' : '–', c0 + ww / 2, yr + 3); }
      }
      if (machHere(j)) { x.strokeStyle = 'rgba(214,90,70,.8)'; x.strokeRect(c0 + 0.5, y0 - 2.5, ww - 1, n * rh + 3); }
      for (i = 0; i < n; i++) {
        var y = y0 + i * rh;
        x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(c0, y + 1, ww, rh - 2);
        if (j < st.log.length && st.log[j].a === i && st.log[j].q > 0) {
          x.fillStyle = st.log[j].m ? '#d65a46' : rgb(CROPS[day.ricks[i].c].c);
          var hh = clamp(st.log[j].q / (day.men * C(i).rate), 0.3, 1) * (rh - 2);
          x.fillRect(c0, y + rh - 1 - hh, ww, hh);
        }
      }
    }
    x.textAlign = 'right';
    for (i = 0; i < n; i++) { x.fillStyle = rgb(CROPS[day.ricks[i].c].c); x.fillText((i + 1) + ' ' + day.ricks[i].field.toUpperCase(), X0 - 6, y0 + i * rh + rh / 2 + 3); }
    x.textAlign = 'center'; x.fillStyle = '#ff8a5b'; x.fillText('RENT', colX(day.xmas) + cw / 2, py0 + 2);
    x.fillStyle = '#8b97ab';
    for (j = 0; j < W; j += 3) x.fillText(short(j), colX(j) + cw / 2, CH - 6);
    x.textAlign = 'left';
  }
  function draw() { drawScene(st.w); drawStrip(st.w); }
  function loop() { tick++; draw(); requestAnimationFrame(loop); }

  /* ---------- the HUD and the buttons ---------- */
  function buildButtons() {
    var box = $('plots'); box.innerHTML = '';
    day.ricks.forEach(function (k, i) {
      var b = document.createElement('button');
      b.className = 'btn plot'; b.type = 'button'; b.id = 'bR' + i;
      b.addEventListener('click', function () { act(i); });
      box.appendChild(b);
    });
    var sb = $('sells'); sb.innerHTML = '';
    crops().forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'btn plot ghost'; b.type = 'button'; b.id = 'bS' + c;
      b.addEventListener('click', function () { doSell(c); });
      sb.appendChild(b);
    });
  }
  function hud() {
    var w = st.w, ww = Math.min(w, W - 1);
    if (w >= W) {
      $('hWhen').textContent = 'Lady Day: the winter is done';
      $('hSky').textContent = '—'; $('hMkt').textContent = '—';
      $('hSkyBox').className = ''; $('hMktBox').className = '';
    } else {
      $('hWhen').textContent = cap(long(w)) + (w === day.xmas ? ' · Christmas' : '');
      $('hSky').textContent = cap(day.sky[w]);
      $('hMkt').textContent = day.shut[w] ? 'Roads shut' : 'Trade ' + day.word[w];
      $('hSkyBox').className = cold(w) || damp(w) ? 'alarm' : '';
      $('hMktBox').className = day.shut[w] ? 'alarm' : '';
    }
    $('hCash').textContent = money(st.cash);
    $('hCashBox').className = st.cash < 0 || (!st.rentPaid && st.cash < day.rent) ? 'alarm' : '';
    var s = 'Threshed <b>' + qr(st.flail + st.byMach) + '</b>' + (st.byMach ? ' (' + qr(st.byMach) + ' by the machine)' : '') +
      ' · sold <b>' + money(st.sales) + '</b> of corn · wages ' + money(st.wages) + (st.fees ? ' · machine ' + money(st.fees) + ' · poor rate ' + money(st.rates) : '');
    if (st.ratsR + st.ratsG >= 0.5) s += ' · <i>the rats have had ' + qr(st.ratsR + st.ratsG) + '</i>';
    s += ' · ' + (st.rentPaid ? 'rent of ' + money(day.rent) + ' paid at Christmas' : '<i>' + money(day.rent) + ' rent due at Christmas</i>');
    if (st.interest >= 1) s += ' · <i>' + money(st.interest) + ' interest to the bank</i>';
    $('plan').innerHTML = s;
    var on = phase === 'season' && w < W, mh = on && machHere(w);
    if (!mh) st.machNow = false;
    day.ricks.forEach(function (k, i) {
      var b = $('bR' + i), R = st.rk[i], rate = st.machNow ? machRate(i) : flailRate(i, ww);
      b.disabled = !on || R.qr < 0.05;
      b.className = 'btn plot' + (st.machNow ? '' : ' ghost');
      b.innerHTML = (i + 1) + ' · ' + (st.machNow ? 'Machine' : 'Thresh') + ' the ' + k.c + ' from ' + k.field +
        ' <small>' + qr(R.qr) + ' in the rick · ' + (R.qr < 0.05 ? 'threshed out' : 'about ' + qr(Math.min(R.qr, rate)) + ' this week · rats ' + (k.staddle ? 'kept off by the staddles' : 'taking ' + qr(R.qr * ratRate(i, ww)) + ' a week')) + '</small>';
    });
    var bm = $('bMach');
    bm.disabled = !mh;
    bm.setAttribute('aria-pressed', st.machNow ? 'true' : 'false');
    bm.className = 'btn plot' + (st.machNow || !mh ? ' ghost' : '');
    var next = day.mach.filter(function (m) { return m >= w; })[0];
    bm.innerHTML = 'M · ' + (st.machNow ? 'Back to the flails' : 'Hire the threshing machine') + ' <small>' +
      (mh ? (st.machNow ? 'now choose the rick it threshes' : 'here this week: ' + money(MACH_FEE) + ' and ' + MACH_QR + 'd a quarter, and ' + money(day.men * RELIEF) + ' on the poor rate for the men') :
        day.year === 1830 ? 'no machine will come to the parish this winter' : next !== undefined ? 'next in the parish the ' + long(next) : 'not coming to the parish again') + '</small>';
    crops().forEach(function (c) {
      var b = $('bS' + c), g = st.gran[c], p = day.price[c][ww];
      b.disabled = !on || day.shut[ww] || g < 0.05;
      b.innerHTML = 'Sell the ' + c + ' <small>' + (g < 0.05 ? 'none in the granary' : qr(g) + ' at ' + shil(p) + ' = ' + money(g * p)) + (day.shut[ww] && on ? ' · roads shut' : '') + '</small>';
    });
    $('bRest').disabled = !on;
  }

  function doSell(c) {
    if (phase !== 'season') return;
    var q = st.gran[c], v = sell(st, c);
    if (v) {
      $('msg').innerHTML = '<b>' + short(st.w) + ':</b> carted ' + qr(q) + ' of ' + c + ' to market and sold it at ' + shil(day.price[c][st.w]) + ' a quarter, for <b>' + money(v) + '</b>.';
      hud(); if (still) draw();
    }
  }
  function act(a) {
    if (phase !== 'season' || st.w >= W) return;
    var w = st.w, ev = step(st, a, st.machNow), bits = [];
    st.machNow = false;
    if (ev.q && ev.m) bits.push('the machine threshed <b>' + qr(ev.q) + ' of ' + day.ricks[ev.a].c + '</b> from ' + day.ricks[ev.a].field + ' for ' + money(ev.cost) + ', and the men were on the parish all week, ' + money(ev.rates) + ' on the poor rate');
    else if (ev.q) bits.push('the men threshed <b>' + qr(ev.q) + ' of ' + day.ricks[ev.a].c + '</b> from ' + day.ricks[ev.a].field + ' at ' + CROPS[day.ricks[ev.a].c].piece + 'd a quarter' + (w === day.xmas ? ', a short week for Christmas' : damp(w) ? ', slowly, the corn tough in the damp' : ''));
    if (ev.why) bits.push('could not: ' + ev.why);
    if (!ev.q && !ev.why) bits.push('the barn floor was quiet all week');
    if (ev.ratsR >= 0.1) bits.push((cold(w) ? 'the cold drove the rats into the ricks, and they took ' : 'the rats took ') + qr(ev.ratsR));
    if (ev.rent) bits.push('<span style="color:#ff8a5b">the landlord’s agent came for the half-year’s rent, ' + money(ev.rent) + (st.cash < 0 ? ', and the bank lent the ' + money(-st.cash) + ' you were short' : '') + '</span>');
    if (ev.int >= 1) bits.push('<span style="color:#ff8a5b">' + money(ev.int) + ' interest to the bank</span>');
    $('msg').innerHTML = '<b>' + cap(long(w)) + ':</b> ' + bits.join('; ') + '.';
    if (st.done) end();
    hud(); if (still) draw();
  }

  function row(a, b, c, d) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td><td class="n">' + d + '</td></tr>'; }
  function end() {
    phase = 'done';
    var F = play(POLICIES.father), G = play(POLICIES.asYouGo), me = clear(st), best = Math.max(clear(F), clear(G)), tol = day.rent * 0.03;
    var v = $('verdict');
    v.className = 'verdict ' + (me >= best - tol ? 'good' : 'warn');
    v.innerHTML = '<p>Lady Day, and the men go out to the spring ploughing.' + (st.standQr >= 0.5 ? ' The dealer took the ' + qr(st.standQr) + ' still in the rick standing, at three-quarters of the price, for ' + money(st.standing) + '.' : ' Every rick was threshed.') +
      ' After the wages, the rent and everything else, the winter’s corn cleared <b>' + money(me) + '</b>.</p>' +
      '<p>' + (me >= best + tol ? 'That is better than ' + day.father + ' would have done, and better than selling as you go.' : me >= best - tol ? 'That is as good as the best of the other two ways with the same winter.' :
        (clear(F) >= clear(G) ? cap(day.father) + '’s way' : 'Selling as you go') + ' would have cleared ' + money(best - me) + ' more out of the same ricks, the same winter and the same market.') + '</p>';
    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>The same winter, three ways</h5>' +
      '<table class="card"><tr><td></td><td class="n">Yours</td><td class="n">' + cap(day.father.replace('old ', '')) + '’s way</td><td class="n">As you go</td></tr>' +
      row('Threshed with the flail', qr(st.flail), qr(F.flail), qr(G.flail)) +
      row('Threshed by the machine', qr(st.byMach), qr(F.byMach), qr(G.byMach)) +
      row('Eaten by the rats', qr(st.ratsR + st.ratsG), qr(F.ratsR + F.ratsG), qr(G.ratsR + G.ratsG)) +
      row('Sold standing at Lady Day', qr(st.standQr), qr(F.standQr), qr(G.standQr)) +
      row('Corn sold', money(st.sales + st.standing), money(F.sales + F.standing), money(G.sales + G.standing)) +
      row('Threshers’ wages', money(st.wages), money(F.wages), money(G.wages)) +
      row('Machine and poor rate', money(st.fees + st.rates), money(F.fees + F.rates), money(G.fees + G.rates)) +
      row('Rent', money(day.rent), money(day.rent), money(day.rent)) +
      row('Interest', money(st.interest), money(F.interest), money(G.interest)) +
      '<tr class="tot"><td>Cleared</td><td class="n">' + money(me) + '</td><td class="n">' + money(clear(F)) + '</td><td class="n">' + money(clear(G)) + '</td></tr></table>' +
      '<p><b>' + cap(day.father) + '’s way</b> threshes the wheat first and sells it every week the roads are open until the rent is paid, then threshes whatever the rats are hurting most and holds it all for the spring prices, selling in the last four weeks. ' +
      '<b>As you go</b> sells everything the day it is threshed, threshes the rick the rats are hurting most, and hires the machine every time it comes. Neither knows the market any better than you did.</p>';
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
    var P = day.P, tot = 0, val = 0;
    day.ricks.forEach(function (k) { tot += k.qr; val += k.qr * day.price[k.c][0]; });
    $('rWho').textContent = 'Corn farm · ' + P.name + ', ' + P.county + ' · ' + num(day.ricks.length) + ' ricks · ' + day.year + '–' + String(day.year + 1).slice(2);
    $('rName').textContent = 'Thresh the harvest';
    $('rBlurb').innerHTML = 'It is ' + long(0) + ', ' + day.year + ', the Monday after Martinmas. It will be ' + day.K.name + '. Which way the corn trade will go this winter nobody can say. You are ' + day.master +
      ', with <b>' + num(day.ricks.length) + ' ricks</b> in the yard holding about ' + Math.round(tot) + ' quarters of corn worth ' + money(val) + ' at November’s prices, <b>' + num(day.men) + (day.men === 1 ? ' man' : ' men') + '</b> to thresh it with the flail at so much a quarter, and ' +
      money(day.cash0) + ' in hand. The half-year’s rent of <b>' + money(day.rent) + '</b> is due at Christmas. ' +
      (day.year === 1830 ? 'This is the winter of the Swing riots, and no threshing machine will come into the parish. ' :
        'The travelling threshing machine is booked to the parish for ' + day.mach.map(function (m) { return long(m); }).join(' and ') + '. ') +
      'At Lady Day the men go to the spring work, and whatever is still in the rick goes to the dealer standing, at three-quarters of its price.';
    $('rBook').textContent = 'Wheat first, for the rent, and sell it as it comes off the floor. The rest can bide in the granary till the spring, when corn is always dearer. And never let one of they machines in the barn while there’s men on the parish. — ' + cap(day.father);
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      P.name + ', ' + day.year;
    buildButtons();
    fresh();
  }

  /* ---------- wiring ---------- */
  function weekAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    if (y < SY + 4 || x < X0 || x > X1) return -1;
    return clamp(Math.floor((x - X0) / (X1 - X0) * W), 0, W - 1);
  }
  cv.addEventListener('pointermove', function (e) {
    var j = weekAt(e);
    if (j !== hover) { hover = j; if (still) draw(); }
    if (j < 0) { $('cellOut').textContent = '—'; return; }
    var s = cap(long(j));
    if (j === day.xmas) s += ' · Christmas, the rent';
    if (machHere(j)) s += ' · the machine in the parish';
    if (j <= st.w && j < W) {
      s += ' · ' + day.sky[j] + (day.shut[j] ? ', roads shut' : '');
      s += ' · ' + crops().map(function (c) { return c + ' ' + shil(day.price[c][j]); }).join(', ');
      if (j < st.log.length) {
        var ev = st.log[j];
        s += ' · ' + (ev.q ? qr(ev.q) + ' of ' + day.ricks[ev.a].c + (ev.m ? ' by machine' : ' threshed') : 'no threshing');
        var sold = st.sold.filter(function (x) { return x.w === j && !x.end; });
        if (sold.length) s += ' · sold ' + sold.map(function (x) { return qr(x.q) + ' ' + x.c; }).join(', ');
      } else s += ' · this week';
    } else s += ' · still to come';
    $('cellOut').textContent = s;
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; if (still) draw(); });
  $('bMach').addEventListener('click', function () { if (phase === 'season' && machHere(st.w)) { st.machNow = !st.machNow; hud(); } });
  $('bRest').addEventListener('click', function () { act(-1); });
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'season') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyM') { if (machHere(st.w)) { st.machNow = !st.machNow; hud(); } e.preventDefault(); return; }
    var m = /^Digit([0-5])$/.exec(e.code);
    if (!m) return;
    var k = +m[1] - 1;
    if (k < 0) act(-1);
    else if (k < day.ricks.length && st.rk[k].qr >= 0.05) act(k);
    e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  if (!still) requestAnimationFrame(loop);
})();
