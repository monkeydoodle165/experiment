/* drift.quibo.games — The Tide
   A port invented by the day's number, and the water that goes in and out of it.
   Real harmonic method, real constituent speeds, entirely invented harbour.
   Self-contained. No dependencies. */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var EPOCH = new Date(2000, 0, 1, 0, 0, 0).getTime();   /* local midnight, 1 Jan 2000 */

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
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  /* ---------- the constituents, with their real angular speeds in degrees per mean solar hour ---------- */
  var CONS = [
    { k: 'M2',  speed: 28.9841042, name: 'Principal lunar semidiurnal',            band: 'semi' },
    { k: 'S2',  speed: 30.0000000, name: 'Principal solar semidiurnal',            band: 'semi' },
    { k: 'N2',  speed: 28.4397295, name: 'Larger lunar elliptic semidiurnal',      band: 'semi' },
    { k: 'K2',  speed: 30.0821373, name: 'Lunisolar semidiurnal',                  band: 'semi' },
    { k: 'K1',  speed: 15.0410686, name: 'Lunisolar diurnal',                      band: 'diur' },
    { k: 'O1',  speed: 13.9430356, name: 'Principal lunar diurnal',                band: 'diur' },
    { k: 'P1',  speed: 14.9589314, name: 'Principal solar diurnal',                band: 'diur' },
    { k: 'Q1',  speed: 13.3986609, name: 'Larger lunar elliptic diurnal',          band: 'diur' },
    { k: 'M4',  speed: 57.9682084, name: 'Shallow-water overtide of M2',           band: 'shal' },
    { k: 'MS4', speed: 58.9841042, name: 'Shallow-water lunisolar quarter-diurnal',band: 'shal' },
    { k: 'Mf',  speed: 1.0980331,  name: 'Lunar fortnightly',                      band: 'long' },
    { k: 'Mm',  speed: 0.5443747,  name: 'Lunar monthly',                          band: 'long' },
    { k: 'Sa',  speed: 0.0410686,  name: 'Solar annual',                           band: 'long' }
  ];

  var BAND_COLOUR = { semi: '#64f0c8', diur: '#7aa2ff', shal: '#ffce6a', long: '#c58bff' };

  /* ---------- naming a place that is not anywhere ---------- */
  var NAME_A = ['Kel', 'Brack', 'Ard', 'Hal', 'Stour', 'Clough', 'Mar', 'Tor', 'Wren', 'Gale',
                'Skerr', 'Pol', 'Cran', 'Rathe', 'Fen', 'Dun', 'Ilve', 'Corr', 'Mere', 'Salt',
                'Drum', 'Vane', 'Holm', 'Orre', 'Tarn', 'Grist', 'Lun', 'Whin', 'Barr', 'Sel'];
  var NAME_B = ['haven', 'mouth', 'wick', 'stow', 'burn', 'holm', 'ferry', 'strand', 'pool',
                'reach', 'bight', 'sound', 'quay', 'hithe', 'scar', 'ness', 'fleet', 'gate',
                'wade', 'combe'];
  var NAME_F = ['%', '%', '%', 'Port %', 'North %', 'Old %', '% on Sea', 'Little %', 'Great %',
                '% Bar', 'Nether %', 'Upper %'];

  var SHAPES = [
    'a long soft estuary that takes the flood four miles inland',
    'a rock harbour with one way in and a light on the end of it',
    'a river mouth sitting behind a shingle bar that moves every winter',
    'a drowned valley with deep water right up against the wall',
    'a bay that gives itself back to sand twice a day',
    'a working basin behind a half-tide sill',
    'a creek that winds up between saltings until it runs out of patience',
    'a lagoon reached through one narrow gut',
    'a pair of piers thrown out into a bight with no shelter behind them',
    'a cut dredged straight through a marsh and kept open by argument'
  ];

  var TRADES = [
    'Six boats, all of them shellfish.', 'A ferry, when the ferry feels like it.',
    'Timber in, ballast out.', 'Two dredgers and a pilot who is never on the phone.',
    'Nothing commercial since the cannery shut.', 'Grain, and a great deal of paperwork.',
    'Yachts in summer, silence in February.', 'A lifeboat and an opinion.',
    'Coal once. Now visitors.', 'Sand, gravel, and the argument about the sand and gravel.'
  ];

  var REGIMES = [
    { id: 'macro',  label: 'macrotidal semidiurnal',     m2: [3.0, 5.4],  k1: [0.05, 0.16], w: 2 },
    { id: 'meso',   label: 'semidiurnal',                m2: [1.1, 2.6],  k1: [0.05, 0.20], w: 5 },
    { id: 'mixedS', label: 'mixed, mainly semidiurnal',  m2: [0.55, 1.25],k1: [0.22, 0.55], w: 4 },
    { id: 'mixedD', label: 'mixed, mainly diurnal',      m2: [0.22, 0.50],k1: [0.45, 0.85], w: 2 },
    { id: 'diur',   label: 'diurnal',                    m2: [0.06, 0.18],k1: [0.55, 1.05], w: 1 }
  ];

  function pick(r, arr) { return arr[(r() * arr.length) | 0]; }
  function span(r, a) { return a[0] + r() * (a[1] - a[0]); }
  function wrap360(g) { g = g % 360; return g < 0 ? g + 360 : g; }
  function round(v, n) { var p = Math.pow(10, n); return Math.round(v * p) / p; }

  /* ---------- build a port out of one integer ---------- */
  function buildPort(seed) {
    var r = rng(seed);

    var total = 0, i;
    for (i = 0; i < REGIMES.length; i++) total += REGIMES[i].w;
    var roll = r() * total, reg = REGIMES[0];
    for (i = 0; i < REGIMES.length; i++) {
      roll -= REGIMES[i].w;
      if (roll <= 0) { reg = REGIMES[i]; break; }
    }

    var base = pick(r, NAME_A) + pick(r, NAME_B);
    var name = pick(r, NAME_F).replace('%', base.charAt(0).toUpperCase() + base.slice(1));

    var shallow = r();                 /* 0 = deep clean water, 1 = a creek full of mud */
    var A = {}, g = {};

    A.M2 = span(r, reg.m2);
    A.K1 = span(r, reg.k1);
    A.S2 = A.M2 * (0.26 + r() * 0.16);
    A.N2 = A.M2 * (0.16 + r() * 0.07);
    A.K2 = A.S2 * (0.24 + r() * 0.07);
    A.O1 = A.K1 * (0.52 + r() * 0.38);
    A.P1 = A.K1 * (0.29 + r() * 0.07);
    A.Q1 = A.O1 * (0.16 + r() * 0.08);
    A.M4 = A.M2 * (0.006 + shallow * shallow * 0.12);
    A.MS4 = A.M4 * (0.40 + r() * 0.40);
    A.Mf = 0.015 + r() * 0.055;
    A.Mm = 0.008 + r() * 0.035;
    A.Sa = 0.03 + r() * 0.11;

    /* phases. The lag of S2 behind M2 is the age of the tide: how long after
       new or full moon the biggest springs actually turn up. */
    var age = 0.2 + r() * 2.4;                                  /* hours */
    g.M2 = r() * 360;
    g.S2 = wrap360(g.M2 + age * (30.0 - 28.9841042));
    g.N2 = wrap360(g.M2 - (6 + r() * 26));
    g.K2 = wrap360(g.S2 + (-7 + r() * 14));
    g.K1 = r() * 360;
    g.O1 = wrap360(g.K1 - (8 + r() * 44));
    g.P1 = wrap360(g.K1 - (1 + r() * 9));
    g.Q1 = wrap360(g.O1 - (4 + r() * 32));
    g.M4 = wrap360(2 * g.M2 + (r() * 360));
    g.MS4 = wrap360(g.M4 + (-32 + r() * 64));
    g.Mf = r() * 360;
    g.Mm = r() * 360;
    g.Sa = r() * 360;

    var cons = CONS.map(function (c) {
      return {
        k: c.k, speed: c.speed, name: c.name, band: c.band,
        amp: round(A[c.k], 4), phase: round(g[c.k], 1), on: true
      };
    });

    var sum = 0;
    for (i = 0; i < cons.length; i++) sum += cons[i].amp;
    /* chart datum is put at the lowest the water can astronomically get, which is
       the convention, so every height on this page is a height above that datum. */
    var Z0 = Math.ceil(sum * 10) / 10;

    var meanRange = 2 * A.M2;
    var barDepth = round(-0.9 + (1 - shallow) * (1.2 + r() * 4.5) + meanRange * 0.12, 1);
    var berthDepth = round(barDepth + 0.3 + r() * 2.2, 1);

    return {
      seed: seed >>> 0,
      name: name,
      regime: reg.label,
      shape: pick(r, SHAPES),
      trade: pick(r, TRADES),
      lat: round(34 + r() * 26, 2),
      shallow: shallow,
      age: round(age, 1),
      cons: cons,
      Z0: Z0,
      barDepth: barDepth,
      berthDepth: berthDepth
    };
  }

  /* ---------- the prediction itself: a sum of cosines, which is the whole trick ---------- */
  function height(port, t) {
    var s = port.Z0, i, c;
    for (i = 0; i < port.cons.length; i++) {
      c = port.cons[i];
      if (!c.on) continue;
      s += c.amp * Math.cos((c.speed * t - c.phase) * DEG);
    }
    return s;
  }

  function extrema(port, t0, t1) {
    var step = 1 / 60, out = [];
    var a = height(port, t0 - step), b = height(port, t0), c;
    for (var t = t0; t <= t1; t += step) {
      c = height(port, t + step);
      var up = b > a && b >= c, down = b < a && b <= c;
      if (up || down) {
        var d = a - 2 * b + c, dt = 0;
        if (d !== 0) dt = 0.5 * (a - c) / d;
        if (dt > 1 || dt < -1) dt = 0;
        out.push({ t: t + dt * step, h: b - 0.25 * (a - c) * dt, hw: up });
      }
      a = b; b = c;
    }
    return out;
  }

  function windows(port, t0, t1, need) {
    var step = 1 / 60, out = [], open = null;
    var prev = height(port, t0) >= need;
    if (prev) open = t0;
    for (var t = t0 + step; t <= t1; t += step) {
      var now = height(port, t) >= need;
      if (now && !prev) open = refine(port, t - step, t, need);
      if (!now && prev && open !== null) { out.push([open, refine(port, t - step, t, need)]); open = null; }
      prev = now;
    }
    if (open !== null) out.push([open, t1]);
    return out;
  }

  function refine(port, lo, hi, need) {
    for (var i = 0; i < 24; i++) {
      var mid = (lo + hi) / 2;
      if ((height(port, lo) >= need) === (height(port, mid) >= need)) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- clock helpers ---------- */
  function hoursSinceEpoch(date) { return (date.getTime() - EPOCH) / 3600000; }

  function hhmm(t, t0) {
    var m = Math.round((t - t0) * 60);
    var d = Math.floor(m / 1440);
    m -= d * 1440;
    var h = Math.floor(m / 60);
    m -= h * 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + (d ? '⁺' : '');
  }

  function hrsMins(x) {
    var m = Math.round(x * 60), h = Math.floor(m / 60);
    m -= h * 60;
    if (!h) return m + ' min';
    return h + ' h ' + (m < 10 ? '0' : '') + m;
  }

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

  /* ---------- canvas plumbing ---------- */
  function fit(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, cv.clientWidth);
    var h = Math.max(1, cv.clientHeight || Math.round(w / 2));
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width !== pw) cv.width = pw;
    if (cv.height !== ph) cv.height = ph;
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function mono(ctx, px, weight) {
    ctx.font = (weight || 600) + ' ' + px + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
  }

  /* ---------- state ---------- */
  var dayOffset = 0;
  var port = null;
  var scrub = 0;          /* hours from the start of the plotted window */
  var draught = 1.8;
  var clearance = 0.5;
  var t0 = 0, t1 = 0;     /* the plotted window, in hours since epoch */
  var winStart = null;    /* Date at t0 */
  var cachedExtrema = [];

  function $(id) { return document.getElementById(id); }

  function currentDate() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }

  function rebuild(seedOverride) {
    winStart = currentDate();
    t0 = hoursSinceEpoch(winStart);
    t1 = t0 + 48;
    port = buildPort(seedOverride === undefined ? seedForDate(winStart) : seedOverride);
    scrub = dayOffset === 0 ? (new Date().getHours() + new Date().getMinutes() / 60) : 9;
    buildChips();
    buildPlaque();
    render();
  }

  function recompute() { cachedExtrema = extrema(port, t0, t1); }

  /* ---------- the plaque ---------- */
  function buildPlaque() {
    var d = winStart;
    var label = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    if ($('dayOut')) $('dayOut').textContent = label + (dayOffset === 0 ? ' · today' : '');
    if ($('portWho')) $('portWho').textContent = 'port of the day · ' + port.regime;
    if ($('portName')) $('portName').textContent = port.name;
    if ($('portBlurb')) {
      $('portBlurb').textContent = 'Charted as ' + port.shape + '. ' + port.trade +
        ' The bar carries ' + depthWord(port.barDepth) + ', the berths ' +
        (port.berthDepth < 0 ? depthWord(port.berthDepth) : port.berthDepth.toFixed(1) + ' m') + '.';
    }
    if ($('portMeta')) {
      $('portMeta').textContent = 'seed ' + port.seed + ' · latitude ' + port.lat.toFixed(2) +
        '° · thirteen constituents · all heights above chart datum';
    }
  }

  function depthWord(d) {
    if (d < 0) return 'a drying height of ' + Math.abs(d).toFixed(1) + ' m';
    return d.toFixed(1) + ' m at chart datum';
  }

  /* ---------- the curve ---------- */
  function drawCurve() {
    var cv = $('curve');
    if (!cv) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    var padL = 46, padR = 14, padT = 16, padB = 30;
    var gw = W - padL - padR, gh = H - padT - padB;

    var lo = Infinity, hi = -Infinity, t, v;
    for (t = t0; t <= t1; t += 1 / 30) {
      v = height(port, t);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    var pad = Math.max(0.25, (hi - lo) * 0.14);
    lo -= pad; hi += pad;
    if (hi - lo < 0.6) { var mid = (hi + lo) / 2; lo = mid - 0.3; hi = mid + 0.3; }

    function X(tt) { return padL + (tt - t0) / (t1 - t0) * gw; }
    function Y(hh) { return padT + (1 - (hh - lo) / (hi - lo)) * gh; }

    /* height grid */
    var stepH = (hi - lo) > 6 ? 2 : (hi - lo) > 3 ? 1 : 0.5;
    ctx.lineWidth = 1;
    mono(ctx, 9.5, 600);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var hv = Math.ceil(lo / stepH) * stepH; hv <= hi; hv += stepH) {
      var y = Y(hv);
      ctx.strokeStyle = Math.abs(hv) < 1e-9 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.06)';
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#8b97ab';
      ctx.fillText(hv.toFixed(stepH < 1 ? 1 : 0), padL - 8, y);
    }

    /* hour grid */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var hh = 0; hh <= 48; hh += 3) {
      var x = X(t0 + hh);
      ctx.strokeStyle = hh % 24 === 0 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)';
      ctx.beginPath();
      ctx.moveTo(x, padT); ctx.lineTo(x, padT + gh);
      ctx.stroke();
      if (hh % 6 === 0 && hh < 48) {
        ctx.fillStyle = hh % 24 === 0 ? '#c3ccdb' : '#8b97ab';
        ctx.fillText((hh % 24 === 0 ? (hh ? 'tomorrow' : 'midnight') : (hh % 24) + ':00'), x, padT + gh + 7);
      }
    }

    /* the required-water line and the windows under it */
    var need = draught + clearance - port.barDepth;
    if (need > lo && need < hi) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255,206,106,.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(padL, Y(need)); ctx.lineTo(W - padR, Y(need));
      ctx.stroke();
      ctx.restore();
    }
    var wins = windows(port, t0, t1, need);
    for (var i = 0; i < wins.length; i++) {
      ctx.fillStyle = 'rgba(255,206,106,.16)';
      ctx.fillRect(X(wins[i][0]), padT + gh - 6, Math.max(1, X(wins[i][1]) - X(wins[i][0])), 6);
    }

    /* the water */
    ctx.beginPath();
    ctx.moveTo(X(t0), Y(height(port, t0)));
    for (t = t0; t <= t1; t += (t1 - t0) / 900) ctx.lineTo(X(t), Y(height(port, t)));
    ctx.lineTo(X(t1), padT + gh);
    ctx.lineTo(X(t0), padT + gh);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, padT, 0, padT + gh);
    grad.addColorStop(0, 'rgba(100,240,200,.22)');
    grad.addColorStop(1, 'rgba(100,240,200,.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (t = t0; t <= t1; t += (t1 - t0) / 900) {
      var xx = X(t), yy = Y(height(port, t));
      if (t === t0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.strokeStyle = '#64f0c8';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(100,240,200,.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* high and low water */
    mono(ctx, 9, 700);
    for (i = 0; i < cachedExtrema.length; i++) {
      var e = cachedExtrema[i];
      var ex = X(e.t), ey = Y(e.h);
      ctx.fillStyle = e.hw ? '#64f0c8' : '#7aa2ff';
      ctx.beginPath();
      ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = e.hw ? 'bottom' : 'top';
      ctx.fillStyle = e.hw ? 'rgba(100,240,200,.9)' : 'rgba(122,162,255,.9)';
      var lbl = hhmm(e.t, t0) + '  ' + e.h.toFixed(1);
      var lx = Math.min(Math.max(ex, padL + 26), W - padR - 26);
      ctx.fillText(lbl, lx, e.hw ? ey - 7 : ey + 8);
    }

    /* the scrubber */
    var sx = X(t0 + scrub), sh = height(port, t0 + scrub);
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, padT); ctx.lineTo(sx, padT + gh);
    ctx.stroke();
    ctx.fillStyle = '#e8edf5';
    ctx.beginPath();
    ctx.arc(sx, Y(sh), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- the harbour in section ---------- */
  function bedDepth(port, x) {
    /* charted depth, metres below chart datum, along a line from sea (0) to quay (1) */
    var sea = Math.max(port.barDepth, port.berthDepth) + 7;
    var bar = port.barDepth, berth = port.berthDepth;
    if (x < 0.30) {
      var u = x / 0.30;
      return sea + (bar - sea) * (u * u * (3 - 2 * u));
    }
    if (x < 0.42) return bar;
    var v = (x - 0.42) / 0.50;
    if (v > 1) v = 1;
    return bar + (berth - bar) * (v * v * (3 - 2 * v));
  }

  function drawHarbour() {
    var cv = $('harbour');
    if (!cv) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    var padT = 18, padB = 14, padL = 10, padR = 74;
    var gw = W - padL - padR, gh = H - padT - padB;

    var level = height(port, t0 + scrub);
    var top = Math.max(level, port.Z0 + 0.4) + 1.0;
    var deepest = Math.max(bedDepth(port, 0), level + 1);
    var bot = -deepest;

    function X(x) { return padL + x * gw; }
    function Y(m) { return padT + (1 - (m - bot) / (top - bot)) * gh; }

    /* sky */
    ctx.fillStyle = 'rgba(122,162,255,.03)';
    ctx.fillRect(padL, padT, gw, gh);

    /* water */
    ctx.beginPath();
    ctx.moveTo(X(0), Y(level));
    var i, x;
    for (i = 0; i <= 60; i++) {
      x = i / 60;
      var ripple = Math.sin(x * 22 + scrub * 1.3) * 0.02 * Math.max(0.2, 1 - x);
      ctx.lineTo(X(x), Y(level + ripple));
    }
    for (i = 60; i >= 0; i--) {
      x = i / 60;
      ctx.lineTo(X(x), Y(Math.min(level, -bedDepth(port, x))));
    }
    ctx.closePath();
    var wg = ctx.createLinearGradient(0, Y(level), 0, Y(bot));
    wg.addColorStop(0, 'rgba(100,240,200,.30)');
    wg.addColorStop(1, 'rgba(60,110,160,.16)');
    ctx.fillStyle = wg;
    ctx.fill();

    /* the ground */
    ctx.beginPath();
    ctx.moveTo(X(0), Y(bot));
    for (i = 0; i <= 120; i++) {
      x = i / 120;
      ctx.lineTo(X(x), Y(-bedDepth(port, x)));
    }
    ctx.lineTo(X(1), Y(bot));
    ctx.closePath();
    ctx.fillStyle = 'rgba(139,151,171,.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,151,171,.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (i = 0; i <= 120; i++) {
      x = i / 120;
      var yy = Y(-bedDepth(port, x));
      if (i === 0) ctx.moveTo(X(x), yy); else ctx.lineTo(X(x), yy);
    }
    ctx.stroke();

    /* the quay wall */
    var quayTop = port.Z0 + Math.max(0.9, port.cons[0].amp * 1.25);
    ctx.fillStyle = 'rgba(232,237,245,.10)';
    ctx.fillRect(X(0.93), Y(quayTop), gw * 0.07 + padR * 0.35, Y(bot) - Y(quayTop));
    ctx.strokeStyle = 'rgba(232,237,245,.30)';
    ctx.lineWidth = 1;
    ctx.strokeRect(X(0.93), Y(quayTop), gw * 0.07 + padR * 0.35, Y(bot) - Y(quayTop));

    /* datum, mean level and the top of the tide */
    var sumAll = 0;
    for (i = 0; i < port.cons.length; i++) sumAll += port.cons[i].amp;
    var marks = [
      { m: 0, label: 'chart datum', c: 'rgba(255,255,255,.34)' },
      { m: port.Z0, label: 'mean level', c: 'rgba(122,162,255,.5)' },
      { m: port.Z0 + sumAll, label: 'highest astronomical', c: 'rgba(255,206,106,.45)' }
    ];
    mono(ctx, 9, 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (i = 0; i < marks.length; i++) {
      if (marks[i].m > top || marks[i].m < bot) continue;
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = marks[i].c;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, Y(marks[i].m)); ctx.lineTo(X(0.93), Y(marks[i].m));
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = marks[i].c;
      ctx.fillText(marks[i].label, X(0.93) + 4, Y(marks[i].m));
    }

    /* the boat, on the bar */
    var overBar = level + port.barDepth;
    var afloat = overBar >= draught;
    var bx = X(0.36), beam = Math.max(34, gw * 0.13);
    var keel = afloat ? level - draught : -port.barDepth;
    var deck = keel + draught + Math.max(0.5, draught * 0.45);
    var tilt = afloat ? 0 : 0.12;

    ctx.save();
    ctx.translate(bx, Y(keel));
    ctx.rotate(tilt);
    var hullH = Y(keel) - Y(deck);
    ctx.beginPath();
    ctx.moveTo(-beam / 2, -hullH);
    ctx.lineTo(beam / 2, -hullH);
    ctx.lineTo(beam / 2 - beam * 0.16, 0);
    ctx.lineTo(-beam / 2 + beam * 0.16, 0);
    ctx.closePath();
    ctx.fillStyle = afloat ? 'rgba(100,240,200,.85)' : 'rgba(255,140,120,.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(7,9,13,.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -hullH);
    ctx.lineTo(0, -hullH - Math.max(14, hullH * 1.6));
    ctx.strokeStyle = afloat ? 'rgba(100,240,200,.8)' : 'rgba(255,140,120,.75)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    /* the tide staff on the wall */
    var sx = X(0.955);
    ctx.strokeStyle = 'rgba(232,237,245,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, Y(Math.min(quayTop, top)));
    ctx.lineTo(sx, Y(Math.max(bot, -0.4)));
    ctx.stroke();
    ctx.fillStyle = '#64f0c8';
    ctx.beginPath();
    ctx.moveTo(sx - 7, Y(level));
    ctx.lineTo(sx, Y(level) - 5);
    ctx.lineTo(sx, Y(level) + 5);
    ctx.closePath();
    ctx.fill();

    /* readouts */
    mono(ctx, 10.5, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e8edf5';
    ctx.fillText(hhmm(t0 + scrub, t0) + '   ' + level.toFixed(2) + ' m', padL + 4, padT + 2);
    mono(ctx, 9.5, 600);
    ctx.fillStyle = afloat ? 'rgba(100,240,200,.9)' : 'rgba(255,140,120,.9)';
    ctx.fillText(afloat
      ? (overBar - draught).toFixed(2) + ' m under the keel'
      : 'aground — ' + (draught - overBar).toFixed(2) + ' m short',
      padL + 4, padT + 16);
  }

  /* ---------- a month of ranges ---------- */
  function drawSprings() {
    var cv = $('springs');
    if (!cv) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    var padL = 40, padR = 12, padT = 14, padB = 26;
    var gw = W - padL - padR, gh = H - padT - padB;

    var days = 30, start = t0 - 24 * 4, rows = [], i;
    for (i = 0; i < days; i++) {
      var a = start + i * 24, lo = Infinity, hi = -Infinity;
      for (var t = a; t <= a + 24; t += 1 / 12) {
        var v = height(port, t);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      rows.push({ range: hi - lo, hi: hi, lo: lo });
    }
    var maxR = 0;
    for (i = 0; i < days; i++) if (rows[i].range > maxR) maxR = rows[i].range;
    maxR = Math.max(maxR, 0.2) * 1.12;

    var bw = gw / days;
    mono(ctx, 9, 600);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    var stepR = maxR > 8 ? 2 : maxR > 4 ? 1 : 0.5;
    for (var rv = 0; rv <= maxR; rv += stepR) {
      var y = padT + (1 - rv / maxR) * gh;
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#8b97ab';
      ctx.fillText(rv.toFixed(stepR < 1 ? 1 : 0) + (rv === 0 ? ' m' : ''), padL - 7, y);
    }

    for (i = 0; i < days; i++) {
      var hgt = rows[i].range / maxR * gh;
      var x = padL + i * bw;
      var isToday = (i === 4);
      ctx.fillStyle = isToday ? 'rgba(100,240,200,.85)'
        : rows[i].range > (maxR / 1.12) * 0.82 ? 'rgba(100,240,200,.42)'
        : 'rgba(122,162,255,.34)';
      ctx.fillRect(x + bw * 0.16, padT + gh - hgt, bw * 0.68, hgt);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    mono(ctx, 9, 600);
    ctx.fillStyle = '#8b97ab';
    for (i = 0; i < days; i += 5) {
      var d = new Date(winStart.getTime());
      d.setDate(d.getDate() - 4 + i);
      ctx.fillText(d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3), padL + i * bw + bw / 2, padT + gh + 7);
    }
    ctx.fillStyle = 'rgba(100,240,200,.9)';
    ctx.fillText('the day you are looking at', padL + 4 * bw + bw / 2, padT - 12 + 0);
  }

  /* ---------- numbers ---------- */
  function renderFacts() {
    var i, sumAll = 0, A = {};
    for (i = 0; i < port.cons.length; i++) {
      A[port.cons[i].k] = port.cons[i].amp;
      sumAll += port.cons[i].amp;
    }
    var F = (A.K1 + A.O1) / (A.M2 + A.S2);
    var kind = F < 0.25 ? 'semidiurnal — two tides a day, much the same size'
      : F < 1.5 ? 'mixed, mainly semidiurnal — two a day, one of them shy'
      : F < 3.0 ? 'mixed, mainly diurnal — some days two, some days one'
      : 'diurnal — one tide a day and that is all you get';

    var springs = 2 * (A.M2 + A.S2);
    var neaps = 2 * Math.abs(A.M2 - A.S2);
    var hat = port.Z0 + sumAll, lat = port.Z0 - sumAll;
    var hwi = port.cons[0].phase / 28.9841042;   /* the lunitidal interval, near enough */

    var next = null, nextLow = null, nowT = t0 + scrub;
    for (i = 0; i < cachedExtrema.length; i++) {
      if (cachedExtrema[i].t < nowT) continue;
      if (cachedExtrema[i].hw && !next) next = cachedExtrema[i];
      if (!cachedExtrema[i].hw && !nextLow) nextLow = cachedExtrema[i];
    }

    function set(id, v) { var e = $(id); if (e) e.textContent = v; }
    set('fRegime', kind.split(' — ')[0] + ' (F = ' + F.toFixed(2) + ')');
    set('fSprings', springs.toFixed(2) + ' m');
    set('fNeaps', neaps.toFixed(2) + ' m');
    set('fMsl', port.Z0.toFixed(2) + ' m above datum');
    set('fHat', hat.toFixed(2) + ' m / ' + lat.toFixed(2) + ' m');
    set('fAge', port.age.toFixed(1) + ' h after the moon');
    set('fHwi', hrsMins(hwi) + ' after transit');
    set('fBar', depthWord(port.barDepth));
    set('fNext', next ? hhmm(next.t, t0) + ' at ' + next.h.toFixed(2) + ' m' : '—');
    set('fNextLow', nextLow ? hhmm(nextLow.t, t0) + ' at ' + nextLow.h.toFixed(2) + ' m' : '—');
    set('fNow', height(port, nowT).toFixed(2) + ' m at ' + hhmm(nowT, t0));

    /* verdict */
    var need = draught + clearance - port.barDepth;
    var wins = windows(port, t0, t0 + 24, need);
    var v = $('verdict');
    if (v) {
      if (!wins.length) {
        v.className = 'verdict bad';
        var best = -Infinity;
        for (i = 0; i < cachedExtrema.length; i++) if (cachedExtrema[i].h > best) best = cachedExtrema[i].h;
        v.innerHTML = 'A boat drawing <b>' + draught.toFixed(1) + ' m</b> with <b>' +
          clearance.toFixed(1) + ' m</b> to spare never gets over the bar today. It is short by <b>' +
          (need - best).toFixed(2) + ' m</b> at the very top of the tide.';
      } else {
        var total = 0;
        for (i = 0; i < wins.length; i++) total += wins[i][1] - wins[i][0];
        var head = 'A boat drawing <b>' + draught.toFixed(1) + ' m</b> keeping <b>' +
          clearance.toFixed(1) + ' m</b> under the keel ';
        if (total > 23.5) {
          v.className = 'verdict good';
          v.innerHTML = head + 'never has to wait. There is water over this bar at every state of ' +
            'the tide today, and <b>' + (lowestToday() + port.barDepth - draught).toFixed(2) +
            ' m</b> to spare at the worst of it.';
        } else {
          var parts = [];
          for (i = 0; i < wins.length; i++) parts.push(hhmm(wins[i][0], t0) + '–' + hhmm(wins[i][1], t0));
          v.className = total > 10 ? 'verdict good' : total > 4 ? 'verdict' : 'verdict warn';
          v.innerHTML = head + 'can cross the bar ' +
            (wins.length === 1 ? 'once today: ' : wins.length + ' times today: ') +
            '<b>' + parts.join('</b>, <b>') + '</b>. That is ' + hrsMins(total) +
            ' of water in twenty-four hours.';
        }
      }
    }

    /* the table */
    var pre = $('rx');
    if (pre) {
      var out = ['      speed °/h    amplitude    phase     constituent',
                 '      ---------    ---------    -----     -----------'];
      for (i = 0; i < port.cons.length; i++) {
        var c = port.cons[i];
        out.push(
          (c.on ? ' ' : '·') + ' ' + pad(c.k, 4) + ' ' + pad(c.speed.toFixed(4), 10) +
          '   ' + pad(c.amp.toFixed(3) + ' m', 9) + '  ' + pad(c.phase.toFixed(1) + '°', 8) +
          '  ' + c.name);
      }
      out.push('');
      out.push('  Z0 (mean level above chart datum)   ' + port.Z0.toFixed(2) + ' m');
      out.push('  form factor (K1+O1)/(M2+S2)         ' + F.toFixed(3));
      out.push('  mean spring range                   ' + springs.toFixed(2) + ' m');
      out.push('  mean neap range                     ' + neaps.toFixed(2) + ' m');
      out.push('  age of the tide                     ' + port.age.toFixed(1) + ' h');
      pre.textContent = out.join('\n');
    }

    /* the table of today's tides */
    var tt = $('table');
    if (tt) {
      var lines = [];
      for (i = 0; i < cachedExtrema.length; i++) {
        var e = cachedExtrema[i];
        if (e.t > t0 + 24) break;
        lines.push('<tr><td>' + (e.hw ? 'High water' : 'Low water') + '</td><td>' +
          hhmm(e.t, t0) + '</td><td>' + e.h.toFixed(2) + ' m</td><td>' +
          (e.h + port.barDepth).toFixed(2) + ' m</td></tr>');
      }
      tt.innerHTML = lines.join('');
    }
  }

  function lowestToday() {
    var lo = Infinity;
    for (var t = t0; t <= t0 + 24; t += 1 / 30) {
      var v = height(port, t);
      if (v < lo) lo = v;
    }
    return lo;
  }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  }

  /* ---------- chips for the constituents ---------- */
  function buildChips() {
    var host = $('consChips');
    if (!host) return;
    host.innerHTML = '';
    port.cons.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip swatch' + (c.on ? ' on' : '');
      b.innerHTML = '<em style="background:' + BAND_COLOUR[c.band] + '"></em>' + c.k;
      b.title = c.name + ' · ' + c.amp.toFixed(3) + ' m';
      b.addEventListener('click', function () {
        c.on = !c.on;
        b.className = 'chip swatch' + (c.on ? ' on' : '');
        render();
      });
      host.appendChild(b);
    });
  }

  function setAll(on, only) {
    for (var i = 0; i < port.cons.length; i++) {
      port.cons[i].on = only ? port.cons[i].k === only : on;
    }
    buildChips();
    render();
  }

  /* ---------- render everything ---------- */
  function render() {
    recompute();
    drawCurve();
    drawHarbour();
    drawSprings();
    renderFacts();
    var so = $('scrubOut');
    if (so) so.textContent = hhmm(t0 + scrub, t0);
    var dO = $('draughtOut');
    if (dO) dO.textContent = draught.toFixed(1) + ' m';
    var cO = $('clearOut');
    if (cO) cO.textContent = clearance.toFixed(1) + ' m';
  }

  /* ---------- wiring ---------- */
  function wire(id, ev, fn) {
    var e = $(id);
    if (e) e.addEventListener(ev, fn);
  }

  wire('scrubRange', 'input', function () { scrub = parseFloat(this.value); render(); });
  wire('draughtRange', 'input', function () { draught = parseFloat(this.value); render(); });
  wire('clearRange', 'input', function () { clearance = parseFloat(this.value); render(); });

  wire('btnPrev', 'click', function () { dayOffset--; rebuild(); });
  wire('btnNext', 'click', function () { dayOffset++; rebuild(); });
  wire('btnToday', 'click', function () { dayOffset = 0; rebuild(); });
  wire('btnOther', 'click', function () { rebuild((Math.random() * 4294967295) >>> 0); });
  wire('btnAll', 'click', function () { setAll(true); });
  wire('btnM2', 'click', function () { setAll(false, 'M2'); });
  wire('btnHw', 'click', function () {
    var best = null;
    for (var i = 0; i < cachedExtrema.length; i++) {
      if (!cachedExtrema[i].hw) continue;
      if (cachedExtrema[i].t < t0 + scrub) continue;
      best = cachedExtrema[i];
      break;
    }
    if (!best) best = cachedExtrema[0];
    if (!best) return;
    scrub = Math.min(48, Math.max(0, best.t - t0));
    var sr = $('scrubRange');
    if (sr) sr.value = String(scrub);
    render();
  });

  wire('btnCopy', 'click', function () {
    var pre = $('rx');
    if (!pre) return;
    var text = port.name + ' — harmonic constants\n\n' + pre.textContent + '\n';
    var done = function () {
      var b = $('btnCopy');
      if (!b) return;
      var old = b.textContent;
      b.textContent = 'Copied';
      setTimeout(function () { b.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
    }
  });

  /* dragging on the curve scrubs time */
  (function () {
    var cv = $('curve');
    if (!cv) return;
    var down = false;
    function at(e) {
      var r = cv.getBoundingClientRect();
      var padL = 46, padR = 14;
      var frac = ((e.clientX - r.left) - padL) / Math.max(1, r.width - padL - padR);
      scrub = Math.min(48, Math.max(0, frac * 48));
      var sr = $('scrubRange');
      if (sr) sr.value = String(scrub);
      render();
    }
    cv.addEventListener('pointerdown', function (e) { down = true; cv.setPointerCapture(e.pointerId); at(e); });
    cv.addEventListener('pointermove', function (e) { if (down) at(e); });
    cv.addEventListener('pointerup', function () { down = false; });
    cv.addEventListener('pointercancel', function () { down = false; });
  })();

  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { dayOffset--; rebuild(); }
    else if (e.key === 'ArrowRight') { dayOffset++; rebuild(); }
    else if (e.key === 't' || e.key === 'T') { dayOffset = 0; rebuild(); }
  });

  window.addEventListener('resize', function () { if (port) render(); });

  /* ---------- go ---------- */
  rebuild();
  var sr0 = $('scrubRange');
  if (sr0) sr0.value = String(scrub);
  render();
})();
