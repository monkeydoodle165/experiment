/* drift.quibo.games — The Aerostat
   A gas balloon ascent from an English town some time between 1785 and 1859, on today's calendar date.
   The day's number picks the year (and so the gas: hydrogen from iron and vitriol before 1821, coal gas
   from the town's works after), the size of the envelope and how full it is, the sand, the hour of the
   ascent, and the winds in a stack of layers that turn with height and drift through the afternoon.
   It also picks a town where the subscribers have been promised you will come down.

   A balloon cannot steer. The only control is height: valve gas to sink, throw sand to rise, and let the
   layer you are in carry you. The page simulates the gas honestly enough to bite: a balloon that is not
   full keeps the same lift as it climbs, until it swells full at its pressure height and the gas spills
   out of the open neck, so every climb past that height costs gas, every lost cubic foot must be paid
   for in sand on the way down, and the sun that warmed the gas at noon takes its lift away at evening.
   From 1828 a guide rope trails below the car and props the balloon up as it lies on the ground.

   The target is not placed at random: the number first flies a two-layer route of its own, kinematically,
   and puts the subscribers' town where that route ends, so the town is always reachable. Self-contained. */
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
    var h = s ^ 0x1f83d9ab;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { return (r() + r() + r() + r() - 2) * 1.7; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
  function words(n) { return n < WORDS.length ? WORDS[n] : String(n); }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- units ---------- */
  var FT = 3.2808, MPH = 2.2369, MILE = 1609.34, LB = 2.2046;
  function ft(m) { return Math.round(m * FT / 10) * 10; }
  function ftS(m) { return ft(m).toLocaleString('en-GB') + ' ft'; }
  function miles(m) { var x = m / MILE; return (x < 10 ? x.toFixed(1) : String(Math.round(x))) + (Math.abs(x - 1) < 0.05 ? ' mile' : ' miles'); }
  function clock(hrs) {
    var m = Math.round(hrs * 60), h = Math.floor(m / 60) % 24, mm = m % 60;
    var ap = h < 12 ? 'a.m.' : 'p.m.', h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + '.' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  var POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function point(deg) { return POINTS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }
  var EIGHT = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function pointName(deg) { return EIGHT[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
  function bearing(dx, dy) { return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360; }

  /* ---------- the physics ---------- */
  var HS = 8000;            // scale height of the air, metres
  var BAG = 10;             // a bag of sand, kg
  var SCOOP = 2;            // a scoop out of a bag, kg
  var VALVE = 0.0002;       // fraction of the gas that leaves each second with the valve held open
  var ROPE_M = 30, ROPE_L = 120;
  var WEIGH = 6;            // free lift the balloon is weighed off with, kg
  var LAYERS = [0, 250, 600, 1000, 1500, 2100, 2800, 3600, 4400];
  var GASES = {
    hydrogen: { name: 'hydrogen', lift: 1.08, how: 'made on the spot in casks of iron filings and oil of vitriol' },
    coal: { name: 'coal gas', lift: 0.70, how: 'piped from the town gasworks' }
  };

  function sunsetFor(d) {
    var n = Math.round((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    var decl = 23.44 * Math.sin(2 * Math.PI * (284 + n) / 365) * Math.PI / 180;
    var phi = 52 * Math.PI / 180;
    var w = Math.acos(clamp(-Math.tan(phi) * Math.tan(decl), -1, 1)) * 180 / Math.PI;
    return 12 + w / 15;
  }

  /* winds: a vector at each layer, turning slowly through the afternoon */
  function windAt(D, h, t) {
    var L = D.layers, i = 0;
    if (h <= 0) i = 0; else { while (i < L.length - 2 && h > L[i + 1].h) i++; }
    var a = L[i], b = L[Math.min(i + 1, L.length - 1)];
    var f = b.h > a.h ? clamp((h - a.h) / (b.h - a.h), 0, 1) : 0;
    var hr = t / 3600;
    var da = (a.dir + a.rot * hr) * Math.PI / 180, db = (b.dir + b.rot * hr) * Math.PI / 180;
    var sa = a.sp * (1 + a.grow * hr), sb = b.sp * (1 + b.grow * hr);
    return [sa * Math.sin(da) * (1 - f) + sb * Math.sin(db) * f, sa * Math.cos(da) * (1 - f) + sb * Math.cos(db) * f];
  }

  function flyKinematic(D, plan, T, step) {
    var x = 0, y = 0, pts = [[0, 0]];
    step = step || 30;
    for (var t = 0; t < T; t += step) {
      var h = plan(t), w = windAt(D, h, t);
      x += w[0] * step; y += w[1] * step;
      pts.push([x, y]);
    }
    return pts;
  }

  var PRE = ['Ash', 'Brack', 'Chil', 'Dun', 'Elm', 'Fen', 'Gras', 'Hal', 'Ick', 'Kel', 'Lang', 'Mar', 'Nor', 'Ock', 'Pen', 'Rad',
    'Sal', 'Thorn', 'Wex', 'Yar', 'Brom', 'Cold', 'Hart', 'Stan', 'Wool', 'Bur', 'Lyd', 'Mead', 'Ought', 'Wick', 'Bram', 'Cran',
    'Ditch', 'Holm', 'Lin', 'Sut', 'Tad', 'Whit', 'Ather', 'Bex', 'Cher', 'Ever', 'Hamb', 'Kings', 'Little', 'Much', 'Over', 'Sher'];
  var SUF = ['ford', 'ham', 'ley', 'bury', 'ton', 'well', 'field', 'den', 'stead', 'by', 'combe', 'minster', 'hurst', 'borough', 'wick', 'thorpe', 'ing', 'mere', 'cote', 'stow'];
  var OCCASIONS = [
    { what: 'a fête in aid of the county infirmary', who: 'the infirmary’s subscribers' },
    { what: 'a wager laid at the assembly rooms', who: 'the gentlemen who laid the wager' },
    { what: 'the anniversary of the King’s accession', who: 'the mayor and corporation' },
    { what: 'a scientific ascent with thermometers and a barometer', who: 'the members of the Philosophical Society' },
    { what: 'the opening of the new gasworks', who: 'the proprietors of the gas company' },
    { what: 'a benefit for the aeronaut, advertised for a month', who: 'the ticket holders' },
    { what: 'the races', who: 'the stewards of the races' }
  ];

  function build(seed, date) {
    for (var attempt = 0; attempt < 120; attempt++) {
      var D = tryBuild(mix(seed, 0xae705 + attempt * 7919), date);
      if (D) return D;
    }
    return tryBuild(mix(seed, 0xae705), date, true);
  }

  function tryBuild(seed, date, force) {
    var r = rng(seed);
    var D = { date: date };
    D.year = 1785 + Math.floor(r() * 75);
    D.gas = D.year < 1821 ? 'hydrogen' : (r() < 0.85 ? 'coal' : 'hydrogen');
    var G = GASES[D.gas];
    D.rope = D.year >= 1828;
    D.V = D.gas === 'hydrogen' ? 650 + r() * 400 : 1400 + r() * 900;
    D.fill = 0.74 + r() * 0.15;
    D.bags = 9 + Math.floor(r() * 7);
    D.sunset = sunsetFor(date);
    D.launch = Math.round(Math.max(9.5, D.sunset - (2.6 + r() * 1.3)) * 12) / 12;
    D.smax = 0.012 + r() * 0.016;
    D.Vg0 = D.V * D.fill;
    D.s0 = superheat(D, 0);
    D.M = D.Vg0 * G.lift * (1 + D.s0) - WEIGH;          // everything aboard, sand and rope included
    D.Mnb = D.M - D.bags * BAG;
    D.hmax = -HS * Math.log(D.Mnb / (D.V * G.lift));      // the ceiling with every bag gone, gas cold
    D.hp0 = HS * Math.log(D.V / (D.Vg0 * (1 + D.s0)));

    /* the winds */
    var baseDir = r() * 360, Ug = 6.5 + r() * 8.5, odd = 2 + Math.floor(r() * 5), oddOff = (r() < 0.5 ? -1 : 1) * (80 + r() * 80);
    var rotAll = (r() - 0.5) * 14;
    D.layers = LAYERS.map(function (h, i) {
      var frac = Math.min(1, h / 1100);
      var dir = baseDir - 32 * (1 - frac) + gauss(r) * 22 + (i === odd ? oddOff : 0);
      var sp = Ug * (0.42 + 0.58 * Math.sqrt(frac)) * (0.75 + 0.5 * r()) * (i === odd ? 0.8 : 1);
      return { h: h, dir: dir, sp: sp, rot: rotAll + (r() - 0.5) * 8, grow: (r() - 0.5) * 0.1 };
    });
    D.oddLayer = odd;

    /* the route the number has in mind: two heights it can reach, held in turn */
    D.window = (D.sunset - D.launch) * 3600;
    var T = D.window - 1500;
    var cand = [300, 600, 1000, 1500, 2100, 2800].filter(function (h) { return h <= D.hmax * 0.68; });
    if (cand.length < 2 && !force) return null;
    if (cand.length < 2) cand = [300, 600];
    var hA = pick(r, cand), hB = pick(r, cand); var guard = 0;
    while (hB === hA && guard++ < 20) hB = pick(r, cand);
    if (hB === hA) return null;
    var t1 = T * (0.3 + r() * 0.4);
    D.plan = { hA: hA, hB: hB, t1: t1, T: T };
    D.planPts = flyKinematic(D, function (t) { return t < t1 ? hA : hB; }, T);
    var tg = D.planPts[D.planPts.length - 1];
    var dist = Math.hypot(tg[0], tg[1]);
    if (!force && (dist < 22000 || dist > 120000)) return null;

    /* it must not be possible to get there by holding one height */
    var best = { d: 1e12 };
    for (var hh = 100; hh <= Math.min(3600, D.hmax * 0.9); hh += 100) {
      var p = flyKinematic(D, function () { return hh; }, D.window, 60);
      for (var k = 0; k < p.length; k++) {
        var dd = Math.hypot(p[k][0] - tg[0], p[k][1] - tg[1]);
        if (dd < best.d) best = { d: dd, h: hh, k: k, pts: p };
      }
    }
    if (!force && best.d < 7000) return null;
    D.single = best;

    /* the sea: lying across the way the low wind would take you, beyond the town */
    var low = flyKinematic(D, function () { return 400; }, D.window, 60), E = low[low.length - 1];
    var el = Math.hypot(E[0], E[1]) || 1;
    var n = [E[0] / el, E[1] / el];
    var c = Math.max(tg[0] * n[0] + tg[1] * n[1] + 11000, 0.72 * el, 15000);
    D.sea = { n: n, t: [-n[1], n[0]], c: c, p1: r() * 6.28, p2: r() * 6.28 };
    if (isSea(D, tg[0], tg[1]) && !force) return null;

    /* the map: everything that matters, padded */
    var xs = [-20000, 20000, tg[0] - 8000, tg[0] + 8000], ys = [-20000, 20000, tg[1] - 8000, tg[1] + 8000];
    D.planPts.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var mpp = Math.max((x1 - x0) * 1.25 / MW, (y1 - y0) * 1.25 / MH, 60000 / MW);
    D.map = { cx: cx, cy: cy, mpp: mpp };

    /* towns */
    var used = {};
    function name() { for (var g = 0; g < 50; g++) { var s = pick(r, PRE) + pick(r, SUF); if (!used[s]) { used[s] = 1; return s; } } return 'Market ' + pick(r, PRE); }
    D.home = { name: name(), x: 0, y: 0 };
    D.target = { name: name(), x: tg[0], y: tg[1] };
    D.towns = [D.home, D.target];
    for (var j = 0; j < 140 && D.towns.length < 13; j++) {
      var tx = cx + (r() - 0.5) * MW * mpp * 0.95, ty = cy + (r() - 0.5) * MH * mpp * 0.95;
      if (isSea(D, tx, ty)) continue;
      var ok = D.towns.every(function (q) { return Math.hypot(q.x - tx, q.y - ty) > 9000; });
      if (ok) D.towns.push({ name: name(), x: tx, y: ty, small: r() < 0.6 });
    }
    D.occasion = pick(r, OCCASIONS);
    D.pilotSeed = mix(seed, 77);
    D.fieldSeed = mix(seed, 991);
    return D;
  }

  function superheat(D, t) {
    var hrsLeft = D.sunset - (D.launch + t / 3600);
    return D.smax * clamp(hrsLeft / 3, 0, 1);
  }
  function wobble(D, s) { return 2600 * Math.sin(s / 7000 + D.sea.p1) + 1300 * Math.sin(s / 2900 + D.sea.p2); }
  function isSea(D, x, y) {
    var S = D.sea, a = x * S.n[0] + y * S.n[1], s = x * S.t[0] + y * S.t[1];
    return a > S.c + wobble(D, s);
  }

  /* ---------- one flight, stepped a second at a time ---------- */
  function newFlight(D) {
    return {
      t: 0, x: 0, y: 0, h: 0, vz: 0, Vg: D.Vg0, sand: D.bags * BAG, ropeOut: false,
      state: 'ready', valve: false, track: [[0, 0, 0, 0]], hmaxSeen: 0, gasOut: 0, dragged: 0, dragT: 0,
      bounces: 0, impact: 0, touchT: null, sandUsed: 0, valveT: 0, pilots: [], end: null, lastTrack: 0
    };
  }

  function stepFlight(D, F, dt) {
    var G = GASES[D.gas];
    var s = superheat(D, F.t), rho = Math.exp(-F.h / HS);
    var capV = D.V * rho / (1 + s);
    if (F.Vg > capV) { F.gasOut += F.Vg - capV; F.Vg = capV; }
    if (F.valve && F.state !== 'done') { var dv = F.Vg * VALVE * dt; F.Vg -= dv; F.valveT += dt; }
    var lift = F.Vg * G.lift * (1 + s);
    var mass = D.M - (D.bags * BAG - F.sand);
    if (D.rope && F.h > ROPE_L) F.ropeOut = true;
    var ropeFrac = (D.rope && F.ropeOut) ? clamp((ROPE_L - F.h) / ROPE_L, 0, 1) : 0;
    var net = lift - mass + ropeFrac * ROPE_M;
    F.net = net; F.ropeFrac = ropeFrac; F.lift = lift; F.s = s;

    if (F.state === 'flying') {
      var vt = (net >= 0 ? 1 : -1) * Math.min(8, 0.6 * Math.sqrt(Math.abs(net)));
      F.vz += (vt - F.vz) * Math.min(1, dt / 18);
      F.h += F.vz * dt;
      var w = windAt(D, F.h, F.t), slow = 1 - 0.35 * ropeFrac;
      F.x += w[0] * slow * dt; F.y += w[1] * slow * dt;
      if (F.h <= 0) {
        F.h = 0;
        if (F.vz < 0) { F.impact = Math.max(F.impact, -F.vz); if (F.touchT == null) F.touchT = F.t; }
        F.vz = 0; F.state = 'ground'; F.bounces++;
        if (isSea(D, F.x, F.y)) F.end = 'sea';
      }
      if (F.h > F.hmaxSeen) F.hmaxSeen = F.h;
    } else if (F.state === 'ground') {
      if (isSea(D, F.x, F.y)) { F.end = 'sea'; }
      else if (net > 1.5) { F.state = 'flying'; F.vz = 0.3; }
      else {
        var w0 = windAt(D, 0, F.t), sp = Math.hypot(w0[0], w0[1]) * 0.45;
        F.x += w0[0] * 0.45 * dt; F.y += w0[1] * 0.45 * dt; F.dragged += sp * dt; F.dragT += dt;
        if (F.dragT > 900) F.end = 'caught';
      }
    }
    F.t += dt;
    if (F.t - F.lastTrack >= 20) { F.track.push([F.x, F.y, F.h, F.t]); F.lastTrack = F.t; }
    if (!F.end && F.t > D.window + 75 * 60) F.end = 'dark';
  }

  var MW = 720, MH = 460;

  /* ---------- for testing outside a browser ---------- */
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { build: build, newFlight: newFlight, stepFlight: stepFlight, windAt: windAt, seedForDate: seedForDate, GASES: GASES, isSea: isSea, BAG: BAG };
    return;
  }
  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var mapC = $('map'), mctx = mapC.getContext('2d');
  var altC = $('alt'), actx = altC.getContext('2d');
  var bg = document.createElement('canvas'); bg.width = MW; bg.height = MH;
  var dayOff = 0, D, F, raf = null, lastTs = 0, paused = false, hurry = false, pilotsLeft = 3, reading = null, finished = false, touchedSaid = false, lastHud = 0;

  function SX(x) { return MW / 2 + (x - D.map.cx) / D.map.mpp; }
  function SY(y) { return MH / 2 - (y - D.map.cy) / D.map.mpp; }
  function say(s) { $('msg').innerHTML = s || ''; }
  function nearest(x, y, skip) {
    var b = null, bd = 1e12;
    D.towns.forEach(function (q) { if (q === skip) return; var d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; b = q; } });
    return { town: b, d: bd };
  }
  function where(x, y) {
    var n = nearest(x, y), q = n.town;
    if (n.d < 900) return 'at ' + q.name;
    return miles(n.d) + ' ' + point(bearing(x - q.x, y - q.y)) + ' of ' + q.name;
  }

  function load() {
    stopLoop();
    var date = dateFor(dayOff);
    D = build(seedForDate(date), date);
    F = newFlight(D);
    pilotsLeft = 3; reading = null; finished = false; paused = false; touchedSaid = false;
    var G = GASES[D.gas], tg = D.target;
    $('plWho').textContent = WEEKDAYS[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + D.year + ' · ' + clock(D.launch);
    $('plName').textContent = 'An ascent from ' + D.home.name;
    $('plBlurb').innerHTML = 'For ' + D.occasion.what + '. The envelope holds <b>' + Math.round(D.V * 35.315 / 100) * 100 + ' cubic feet</b> of ' + G.name + ', ' + G.how +
      ', and it goes up <b>' + Math.round(D.fill * 100) + ' per cent full</b>, so it will swell tight at about <b>' + ftS(D.hp0) + '</b> and spill gas from its open neck above that. ' +
      'You have <b>' + words(D.bags) + ' bags of sand</b> of ' + Math.round(BAG * LB) + ' lb' + (D.rope ? ' and a guide rope of ' + Math.round(ROPE_L * FT) + ' ft to let down once you are clear of the trees' : ', and no guide rope: nobody has yet thought to trail one') + '. ' +
      cap1(D.occasion.who) + ' have been promised that you will come down at <b>' + tg.name + '</b>, ' + miles(Math.hypot(tg.x, tg.y)) + ' to the ' + point(bearing(tg.x, tg.y)) +
      '. The sun sets at <b>' + clock(D.sunset) + '</b>.';
    $('rules').innerHTML = '<span><b>Space</b> cast off / pause</span><span><b>V</b> hold the valve</span><span><b>S</b> a scoop of sand</span><span><b>B</b> a whole bag</span><span><b>P</b> a pilot balloon</span><span><b>R</b> rip the panel</span><span><b>F</b> hurry the clock</span>';
    $('dayOut').textContent = (dayOff === 0 ? 'Today' : dayOff === -1 ? 'Yesterday' : dayOff === 1 ? 'Tomorrow' : (dayOff > 0 ? '+' : '') + dayOff + ' days') + ' · ' + D.year + ' · ' + G.name;
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict'; $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('pilot').innerHTML = '<p class="formula">No pilot balloon thrown yet. Each one shows the winds it meets on the way up, as the aeronaut reads them through a glass. You have three.</p>';
    paintBackground();
    say('The balloon is weighed off with ' + Math.round(WEIGH * LB) + ' lb of lift to spare and held down by the crowd. Throw a pilot balloon first if you want to know what the winds are doing aloft, then cast off.');
    buttons(); draw(); hud(true);
  }

  /* ---------- the map ---------- */
  function paintBackground() {
    var g = bg.getContext('2d'), r = rng(D.fieldSeed);
    var pal = [[27, 41, 31], [31, 47, 33], [36, 45, 29], [40, 43, 31], [29, 39, 35], [33, 50, 37]];
    var hashes = []; for (var i = 0; i < 997; i++) hashes.push(Math.floor(r() * pal.length));
    var C = 4;
    for (var py = 0; py < MH; py += C) for (var px = 0; px < MW; px += C) {
      var x = D.map.cx + (px + C / 2 - MW / 2) * D.map.mpp, y = D.map.cy - (py + C / 2 - MH / 2) * D.map.mpp;
      if (isSea(D, x, y)) {
        var dd = (x * D.sea.n[0] + y * D.sea.n[1]) - D.sea.c - wobble(D, x * D.sea.t[0] + y * D.sea.t[1]);
        var k = clamp(dd / 20000, 0, 1);
        g.fillStyle = 'rgb(' + Math.round(14 - 6 * k) + ',' + Math.round(30 - 10 * k) + ',' + Math.round(52 - 8 * k) + ')';
      } else {
        var fx = Math.floor(x / 1500 + (Math.floor(y / 1100) % 2) * 0.5), fy = Math.floor(y / 1100);
        var hsh = ((fx * 73856093) ^ (fy * 19349663)) >>> 0, c = pal[hashes[hsh % 997]];
        g.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      }
      g.fillRect(px, py, C, C);
    }
    /* the shore */
    g.strokeStyle = 'rgba(190,210,230,.35)'; g.lineWidth = 1.2; g.beginPath();
    var span = Math.hypot(MW, MH) * D.map.mpp, ctr = D.map.cx * D.sea.t[0] + D.map.cy * D.sea.t[1], first = true;
    for (var s = ctr - span; s <= ctr + span; s += D.map.mpp * 3) {
      var a = D.sea.c + wobble(D, s), wx = D.sea.n[0] * a + D.sea.t[0] * s, wy = D.sea.n[1] * a + D.sea.t[1] * s;
      if (first) { g.moveTo(SX(wx), SY(wy)); first = false; } else g.lineTo(SX(wx), SY(wy));
    }
    g.stroke();
    /* the subscribers' field */
    var tg = D.target, rr = MILE / D.map.mpp;
    g.strokeStyle = 'rgba(255,206,106,.7)'; g.setLineDash([4, 4]); g.lineWidth = 1.4;
    g.beginPath(); g.arc(SX(tg.x), SY(tg.y), rr, 0, 7); g.stroke(); g.setLineDash([]);
    /* towns */
    g.font = '11px ui-monospace,Menlo,monospace'; g.textBaseline = 'middle';
    var boxes = [];
    D.towns.forEach(function (q) {
      var sx = SX(q.x), sy = SY(q.y);
      if (sx < -40 || sx > MW + 40 || sy < -20 || sy > MH + 20) return;
      var big = q === D.target || q === D.home;
      g.fillStyle = q === D.target ? '#ffce6a' : q === D.home ? '#64f0c8' : 'rgba(220,226,236,.75)';
      var z = big ? 4 : q.small ? 2 : 3;
      var label = q.name, w = g.measureText(label).width, lx = sx + 8;
      if (lx + w > MW - 4) lx = sx - 8 - w;
      var box = [Math.min(lx, sx - z) - 3, sy - 8, Math.max(lx + w, sx + z) + 3, sy + 8];
      var hit = boxes.some(function (o) { return box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]; });
      if (hit && !big) return;
      boxes.push(box);
      g.fillRect(sx - z, sy - z, z * 2, z * 2);
      g.fillStyle = q === D.target ? '#ffce6a' : q === D.home ? '#64f0c8' : 'rgba(200,208,222,.62)';
      g.fillText(label, lx, sy);
    });
    /* scale and north */
    var ten = 10 * MILE / D.map.mpp, five = 5 * MILE / D.map.mpp, use = ten < 180 ? [ten, '10 miles'] : [five, '5 miles'];
    g.strokeStyle = 'rgba(220,226,236,.6)'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(16, MH - 18); g.lineTo(16 + use[0], MH - 18); g.moveTo(16, MH - 22); g.lineTo(16, MH - 14); g.moveTo(16 + use[0], MH - 22); g.lineTo(16 + use[0], MH - 14); g.stroke();
    g.fillStyle = 'rgba(220,226,236,.7)'; g.fillText(use[1], 22 + use[0], MH - 18);
    g.beginPath(); g.moveTo(MW - 20, 14); g.lineTo(MW - 26, 32); g.lineTo(MW - 20, 28); g.lineTo(MW - 14, 32); g.closePath(); g.fill();
    g.fillText('N', MW - 24, 42);
  }

  function arrow(g, x, y, ang, len, col, wid) {
    var dx = Math.sin(ang) * len, dy = -Math.cos(ang) * len;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = wid || 1.5;
    g.beginPath(); g.moveTo(x - dx / 2, y - dy / 2); g.lineTo(x + dx / 2, y + dy / 2); g.stroke();
    var hx = x + dx / 2, hy = y + dy / 2, a = Math.atan2(dy, dx);
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - 6 * Math.cos(a - 0.45), hy - 6 * Math.sin(a - 0.45)); g.lineTo(hx - 6 * Math.cos(a + 0.45), hy - 6 * Math.sin(a + 0.45)); g.closePath(); g.fill();
  }

  function polyline(g, pts, col, wid, dash) {
    g.strokeStyle = col; g.lineWidth = wid; g.setLineDash(dash || []); g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(SX(p[0]), SY(p[1])); else g.moveTo(SX(p[0]), SY(p[1])); });
    g.stroke(); g.setLineDash([]);
  }

  function drawMap() {
    var g = mctx;
    g.drawImage(bg, 0, 0);
    if (finished) {
      polyline(g, D.single.pts.slice(0, D.single.k + 1), 'rgba(122,162,255,.55)', 1.4, [2, 4]);
      polyline(g, D.planPts, 'rgba(255,206,106,.85)', 1.6, [7, 5]);
    }
    /* your track, coloured by height */
    var T = F.track.concat([[F.x, F.y, F.h, F.t]]);
    g.lineWidth = 2.2; g.lineCap = 'round';
    for (var i = 1; i < T.length; i++) {
      var k = clamp(T[i][2] / 3000, 0, 1);
      g.strokeStyle = 'rgba(' + Math.round(100 + 155 * k) + ',' + Math.round(240 - 40 * k) + ',' + Math.round(200 - 90 * k) + ',.95)';
      g.beginPath(); g.moveTo(SX(T[i - 1][0]), SY(T[i - 1][1])); g.lineTo(SX(T[i][0]), SY(T[i][1])); g.stroke();
    }
    g.lineCap = 'butt';
    /* the balloon: a shadow on the ground, and the balloon lifted off it by its height */
    var sx = SX(F.x), sy = SY(F.y);
    var off = clamp(sx, 10, MW - 10) !== sx || clamp(sy, 10, MH - 10) !== sy;
    if (off) {
      var cx = clamp(sx, 14, MW - 14), cy = clamp(sy, 14, MH - 14);
      arrow(g, cx, cy, Math.atan2(sx - MW / 2, -(sy - MH / 2)), 18, '#ffce6a', 2);
      g.fillStyle = '#ffce6a'; g.font = '11px ui-monospace,Menlo,monospace';
      g.fillText('off the map', clamp(cx - 30, 4, MW - 80), clamp(cy + (cy > MH / 2 ? -14 : 18), 10, MH - 6));
    } else {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(sx, sy, 6, 3, 0, 0, 7); g.fill();
      var lift = 4 + clamp(F.h / 4000, 0, 1) * 34, by = sy - lift;
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, by + 8); g.stroke();
      var flab = F.Vg * (1 + (F.s || 0)) / Math.exp(-F.h / HS) / D.V;
      var rad = 5 + 3 * clamp(flab, 0.5, 1);
      var grd = g.createRadialGradient(sx - 2, by - 3, 1, sx, by, rad);
      grd.addColorStop(0, '#fff2d0'); grd.addColorStop(1, F.end === 'ripped' ? '#7a6a50' : '#d9a24a');
      g.fillStyle = grd; g.beginPath(); g.ellipse(sx, by, rad, rad * (0.85 + 0.2 * clamp(flab, 0.5, 1)), 0, 0, 7); g.fill();
      g.fillStyle = '#3a2a18'; g.fillRect(sx - 2, by + rad + 2, 4, 3);
      if (F.state !== 'done' && !F.end) {
        var w = windAt(D, F.h, F.t), sp = Math.hypot(w[0], w[1]);
        if (sp > 0.3) arrow(g, sx + Math.sin(Math.atan2(w[0], w[1])) * 26, by - Math.cos(Math.atan2(w[0], w[1])) * 26, Math.atan2(w[0], w[1]), 10 + sp * 1.4, 'rgba(232,237,245,.8)', 1.6);
      }
    }
    /* evening */
    var hrs = D.launch + F.t / 3600, dark = clamp((hrs - (D.sunset - 0.5)) / 1.4, 0, 0.62);
    if (dark > 0) { g.fillStyle = 'rgba(2,4,14,' + dark + ')'; g.fillRect(0, 0, MW, MH); }
  }

  /* ---------- the height chart ---------- */
  var AW = 720, AH = 220, AX0 = 58, AX1 = 628, AY0 = 200, AY1 = 12;
  function drawAlt() {
    var g = actx, top = Math.max(4000, Math.ceil((D.hmax + 300) / 1000) * 1000), tEnd = D.window + 75 * 60;
    function X(t) { return AX0 + (AX1 - AX0) * t / tEnd; }
    function Y(h) { return AY0 - (AY0 - AY1) * h / top; }
    g.fillStyle = '#0e131b'; g.fillRect(0, 0, AW, AH);
    g.font = '11px ui-monospace,Menlo,monospace'; g.textBaseline = 'middle';
    for (var f = 0; f * 0.3048 <= top; f += 2000) {
      var y = Y(f * 0.3048);
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(AX0, y); g.lineTo(AX1, y); g.stroke();
      g.fillStyle = '#8b97ab'; g.fillText((f ? f.toLocaleString('en-GB') : '0') + ' ft', 4, y);
    }
    /* hours */
    for (var hr = Math.ceil(D.launch); hr < D.launch + tEnd / 3600; hr++) {
      var x = X((hr - D.launch) * 3600);
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x, AY1); g.lineTo(x, AY0); g.stroke();
      g.fillStyle = '#5d6879'; g.fillText((hr % 12 || 12) + (hr < 12 ? ' am' : ' pm'), x - 12, AY0 + 11);
    }
    var xs = X(D.window);
    g.fillStyle = 'rgba(2,4,14,.5)'; g.fillRect(xs, AY1, AX1 - xs, AY0 - AY1);
    g.strokeStyle = 'rgba(255,206,106,.6)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(xs, AY1); g.lineTo(xs, AY0); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffce6a'; g.fillText('sunset', xs + 4, AY0 - 8);
    /* where the balloon would be full now, and the ceiling if every grain of sand went */
    if (!F.end) {
      var s = F.s == null ? D.s0 : F.s, hp = HS * Math.log(D.V / (F.Vg * (1 + s)));
      var hc = -HS * Math.log((D.Mnb - (D.rope ? 0 : 0)) / (D.V * GASES[D.gas].lift * (1 + s)));
      g.strokeStyle = 'rgba(122,162,255,.55)'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(AX0, Y(hp)); g.lineTo(AX1, Y(hp)); g.stroke();
      g.fillStyle = '#7aa2ff'; g.fillText('full here', AX0 + 4, Y(hp) - 8);
      if (hc < top) { g.strokeStyle = 'rgba(255,138,122,.4)'; g.beginPath(); g.moveTo(AX0, Y(hc)); g.lineTo(AX1, Y(hc)); g.stroke(); g.fillStyle = '#ff8a7a'; g.fillText('ceiling, all sand gone', AX0 + 80, Y(hc) - 8); }
      g.setLineDash([]);
    }
    if (finished) {
      g.strokeStyle = 'rgba(255,206,106,.75)'; g.setLineDash([7, 5]); g.lineWidth = 1.5; g.beginPath();
      g.moveTo(X(0), Y(D.plan.hA)); g.lineTo(X(D.plan.t1), Y(D.plan.hA)); g.lineTo(X(D.plan.t1), Y(D.plan.hB)); g.lineTo(X(D.plan.T), Y(D.plan.hB)); g.stroke(); g.setLineDash([]);
    }
    /* the trace */
    var T = F.track.concat([[F.x, F.y, F.h, F.t]]);
    g.strokeStyle = '#64f0c8'; g.lineWidth = 2; g.beginPath();
    T.forEach(function (p, i) { if (i) g.lineTo(X(p[3]), Y(p[2])); else g.moveTo(X(p[3]), Y(p[2])); });
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#e8edf5'; g.beginPath(); g.arc(X(F.t), Y(F.h), 3.5, 0, 7); g.fill();
    /* the pilot balloon's winds, on the right */
    g.fillStyle = '#8b97ab'; g.fillText(reading ? 'pilot ' + clock(reading.at) : 'winds aloft', AX1 + 10, AY1 - 2 + 6);
    LAYERS.forEach(function (h, i) {
      if (h > top) return;
      var y = Y(h), x = AX1 + 50;
      if (reading) {
        var q = reading.rows[i];
        arrow(g, x, y, (q.from + 180) * Math.PI / 180, 8 + q.mph * 0.55, 'rgba(232,237,245,.8)', 1.4);
      } else { g.fillStyle = '#3b4556'; g.fillText('?', x - 3, y); }
    });
    var w = windAt(D, F.h, F.t);
    if (Math.hypot(w[0], w[1]) > 0.2) arrow(g, AX1 + 22, Y(F.h), Math.atan2(w[0], w[1]), 18, '#64f0c8', 2);
  }

  function draw() { drawMap(); drawAlt(); }

  /* ---------- the instruments ---------- */
  function hud(force) {
    var now = performance.now();
    if (!force && now - lastHud < 90) return; lastHud = now;
    var w = windAt(D, F.h, F.t), sp = Math.hypot(w[0], w[1]);
    var tg = D.target, dx = tg.x - F.x, dy = tg.y - F.y;
    var vfm = Math.round(F.vz * FT * 60 / 10) * 10;
    $('hTime').textContent = clock(D.launch + F.t / 3600);
    $('hHeight').textContent = ftS(F.h);
    $('hBaro').textContent = (29.92 * Math.exp(-F.h / HS)).toFixed(2) + ' in';
    $('hClimb').textContent = F.state === 'ground' ? 'on the ground' : Math.abs(vfm) < 20 ? 'steady' : (vfm > 0 ? 'rising ' : 'falling ') + Math.abs(vfm) + ' ft/min';
    $('hWind').textContent = sp < 0.4 ? 'calm' : 'from ' + point(bearing(-w[0], -w[1])) + ', ' + Math.round(sp * MPH) + ' mph';
    var bagsLeft = F.sand / BAG;
    $('hSand').textContent = (Math.abs(bagsLeft - Math.round(bagsLeft)) < 0.05 ? Math.round(bagsLeft) : bagsLeft.toFixed(1)) + ' of ' + D.bags + ' bags';
    $('hGas').textContent = Math.round(F.Vg / D.Vg0 * 100) + ' per cent' + (F.valve ? ', valve open' : '');
    $('hTarget').textContent = miles(Math.hypot(dx, dy)) + ' ' + point(bearing(dx, dy));
    $('hRope').textContent = !D.rope ? 'none' : !F.ropeOut ? 'coiled in the car' : F.ropeFrac > 0 ? Math.round(F.ropeFrac * ROPE_L * FT / 10) * 10 + ' ft on the ground' : 'hanging free';
  }

  function buttons() {
    var air = F.state === 'flying' || F.state === 'ground';
    $('btnGo').textContent = F.state === 'ready' ? 'Cast off →' : finished ? 'Flight over' : paused ? 'Carry on' : 'Pause';
    $('btnGo').disabled = finished;
    ['btnValve', 'btnScoop', 'btnBag', 'btnRip'].forEach(function (id) { $(id).disabled = !air || finished; });
    $('btnBag').disabled = $('btnBag').disabled || F.sand < BAG - 0.01;
    $('btnScoop').disabled = $('btnScoop').disabled || F.sand < 0.01;
    $('btnPilot').disabled = finished || pilotsLeft <= 0;
    $('btnPilot').textContent = 'Throw a pilot balloon (' + pilotsLeft + ' left)';
    $('btnHurry').classList.toggle('on', hurry);
    $('btnHurry').textContent = hurry ? 'Clock hurried, ×4' : 'Hurry the clock';
    $('btnAgain').style.display = finished ? '' : 'none';
    ['btnDayPrev', 'btnDayNext', 'btnDayToday'].forEach(function (id) { $(id).disabled = air && !finished; });
  }

  /* ---------- actions ---------- */
  function go() {
    if (finished) return;
    if (F.state === 'ready') { F.state = 'flying'; F.vz = 0.5; paused = false; say('Let go! The crowd falls away beneath the car. Watch the barometer: the balloon will rise until it is full, and then the gas begins to spill.'); startLoop(); }
    else { paused = !paused; if (!paused) startLoop(); else say('Paused. The winds wait for you.'); }
    buttons();
  }
  function sand(kg) {
    if (finished || F.state === 'ready' || F.sand <= 0.01) return;
    var k = Math.min(kg, F.sand); F.sand -= k; F.sandUsed += k;
    say(kg >= BAG ? 'A whole bag goes over the side. The balloon is ' + Math.round(k * LB) + ' lb lighter.' : 'A scoop of sand goes over the side, ' + Math.round(k * LB) + ' lb.');
    buttons(); hud(true);
  }
  function valve(on) {
    if (finished || F.state === 'ready') { F.valve = false; return; }
    if (on && !F.valve) say('The valve is open. Gas you let go now must be paid for in sand later.');
    F.valve = on; $('btnValve').classList.toggle('on', on); hud(true);
  }
  function rip() {
    if (finished || F.state === 'ready') return;
    if (F.state === 'ground' || F.h < 4) {
      if (F.state !== 'ground') { F.impact = Math.max(F.impact, Math.abs(F.vz), 2); if (F.touchT == null) F.touchT = F.t; }
      F.end = 'ripped'; finish();
    } else say('You are ' + ftS(F.h) + ' up. Rip the panel now and the balloon falls like a stone; wait until the car is on the ground.');
  }
  function pilot() {
    if (finished || pilotsLeft <= 0) return;
    pilotsLeft--;
    var r = rng(mix(D.pilotSeed, 3 - pilotsLeft)), t = F.t;
    reading = { at: D.launch + t / 3600, rows: LAYERS.map(function (h) {
      var w = windAt(D, h, t), sp = Math.hypot(w[0], w[1]);
      return { h: h, from: bearing(-w[0], -w[1]) + gauss(r) * 7, mph: Math.max(0, sp * MPH * (1 + gauss(r) * 0.06)) };
    }) };
    var rows = reading.rows.map(function (q) {
      return '<tr><td>' + (q.h ? ftS(q.h) : 'ground') + '</td><td>' + (q.mph < 1 ? 'calm' : 'from ' + point(q.from)) + '</td><td>' + Math.round(q.mph) + ' mph</td><td>towards ' + point(q.from + 180) + '</td></tr>';
    }).join('');
    $('pilot').innerHTML = '<h5>Pilot balloon, ' + clock(reading.at) + '</h5><div class="tablewrap"><table><tr><th>Height</th><th>Wind</th><th>Speed</th><th>Carries you</th></tr>' + rows + '</table></div>';
    say('A little paper balloon goes up and you follow it through the glass as it climbs, turning with each wind it meets. The arrows beside the height chart are what it saw.');
    buttons(); draw();
  }

  /* ---------- the clock ---------- */
  function startLoop() { if (raf) return; lastTs = 0; raf = requestAnimationFrame(frame); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }
  function frame(ts) {
    raf = null;
    if (paused || finished) return;
    var dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
    var n = Math.round(dt * (hurry ? 160 : 40));
    var was = F.state;
    for (var i = 0; i < n && !F.end; i++) {
      stepFlight(D, F, 1);
      if (F.state === 'ground' && was === 'flying') break;
    }
    if (F.state === 'ground' && was === 'flying' && !F.end) {
      var imp = F.impact * FT;
      say('The car strikes the ground at ' + Math.round(imp) + ' ft a second' + (imp > 16 ? ', hard enough to throw you against the rim' : imp > 9 ? ', with a bump that rattles the instruments' : ', gently') + ', ' + where(F.x, F.y) +
        '. The balloon is dragging the car across the field. Rip the panel (R) to let the gas out and stay here, or throw sand to go up again.');
    }
    if (was === 'ground' && F.state === 'flying') say('Lightened, the balloon lifts off the ground again.');
    if (F.end) { finish(); return; }
    draw(); hud();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- the end of the flight ---------- */
  function finish() {
    stopLoop(); finished = true; F.valve = false; $('btnValve').classList.remove('on');
    var tg = D.target, d = Math.hypot(tg.x - F.x, tg.y - F.y), at = D.launch + (F.touchT != null ? F.touchT : F.t) / 3600;
    var imp = F.impact * FT, late = at > D.sunset, sea = F.end === 'sea', darkEnd = F.end === 'dark';
    var cls = 'warn', head, body;
    if (sea) { head = 'Down in the sea'; body = 'The car came down in the water ' + where(F.x, F.y) + ' and the balloon, half empty, dragged it through the waves until a fishing boat came up. You are wet through, the instruments are lost, and ' + D.occasion.who + ' at ' + tg.name + ' waited until dark.'; }
    else if (darkEnd) { head = 'Lost in the dark'; body = 'Night came on with the balloon still aloft. You valved down blind and came to ground somewhere ' + where(F.x, F.y) + ', and spent the night in a barn.'; }
    else if (imp > 18) { head = 'The car stove in'; body = 'You struck the ground at ' + Math.round(imp) + ' ft a second ' + where(F.x, F.y) + '. The wicker gave way, the barometer broke and so, the surgeon thinks, did a rib.'; }
    else if (d < MILE && !late) { cls = 'good'; head = 'Down among the subscribers'; body = 'You came down ' + (d < 400 ? 'in the very field' : miles(d) + ' from the market cross') + ' at ' + tg.name + ', where ' + D.occasion.who + ' were waiting, and they carried the car into the town on their shoulders.'; }
    else if (d < 3 * MILE) { cls = 'good'; head = 'Within sight of ' + tg.name; body = 'You came down ' + miles(d) + ' from ' + tg.name + '. ' + cap1(D.occasion.who) + ' came out on horseback and in carts to fetch you in.'; }
    else { head = miles(d) + ' from ' + tg.name; body = 'You came down ' + where(F.x, F.y) + ', ' + miles(d) + ' ' + point(bearing(F.x - tg.x, F.y - tg.y)) + ' of where ' + D.occasion.who + ' were waiting.'; }
    if (late && !sea && !darkEnd) body += ' It was after sunset when the car touched.';
    if (F.dragged > 300 && F.end !== 'sea') body += ' The balloon dragged the car ' + (F.dragged > MILE ? miles(F.dragged) : Math.round(F.dragged * FT / 10) * 10 + ' ft') + ' through hedges before ' + (F.end === 'caught' ? 'the grapnel caught at last' : 'you ripped the panel') + '.';
    $('verdict').className = 'verdict ' + cls;
    var row = function (a, b, bad) { return '<tr><td>' + a + '</td><td class="' + (bad ? 'bad' : 'ok') + '">' + b + '</td></tr>'; };
    $('verdict').innerHTML = '<h5>' + head + '</h5><p>' + body + '</p><div class="tablewrap"><table>' +
      row('Came down', where(F.x, F.y), d > 3 * MILE) +
      row('From ' + tg.name, miles(d) + ' ' + point(bearing(F.x - tg.x, F.y - tg.y)), d > 3 * MILE) +
      row('Struck the ground at', sea ? 'in the water' : Math.round(imp) + ' ft a second', imp > 10) +
      row('Came down at', clock(at) + (late ? ', after sunset' : ', ' + Math.round((D.sunset - at) * 60) + ' minutes before sunset'), late) +
      row('Highest', ftS(F.hmaxSeen), false) +
      row('Sand left', (F.sand / BAG).toFixed(1) + ' of ' + D.bags + ' bags', F.sand < BAG) +
      row('Gas spilled from the neck', Math.round(F.gasOut / D.Vg0 * 100) + ' per cent', F.gasOut / D.Vg0 > 0.15) +
      row('Gas let go at the valve', Math.round(F.valveT / 60) + ' minutes open', false) +
      '</table></div><p style="margin-top:12px">' + paper(d, at, imp) + '</p>';
    reveal();
    buttons(); draw(); hud(true);
    say('');
  }

  function paper(d, at, imp) {
    var tg = D.target;
    var s = '<i>From the county paper.</i> “BALLOON ASCENT.—On ' + WEEKDAYS[D.date.getDay()] + ' last, being the day appointed for ' + D.occasion.what + ', the aeronaut ascended from ' + D.home.name + ' at ' + clock(D.launch) +
      ' amid the acclamations of a great concourse. The machine rose with majesty and was carried towards the ' + pointName(bearing(F.track[Math.min(F.track.length - 1, 8)][0], F.track[Math.min(F.track.length - 1, 8)][1])) + ', and the barometer is said to have fallen to ' +
      (29.92 * Math.exp(-F.hmaxSeen / HS)).toFixed(2) + ' inches, which gives an elevation of ' + ftS(F.hmaxSeen) + '. ';
    if (F.end === 'sea') s += 'We regret to state that the aeronaut was carried out over the sea, and owes his life to the crew of a fishing smack.';
    else if (d < 3 * MILE) s += 'He descended at ' + clock(at) + ' within ' + (d < MILE ? 'a short walk' : miles(d)) + ' of ' + tg.name + ', exactly as he had engaged to do, and was received by the inhabitants with every mark of respect.';
    else s += 'He descended at ' + clock(at) + ' ' + where(F.x, F.y) + ', and we understand that ' + D.occasion.who + ' at ' + tg.name + ', who had waited until dusk, are not satisfied.';
    if (imp > 12 && F.end !== 'sea') s += ' The descent was violent.';
    return s + '”';
  }

  function reveal() {
    var P = D.plan, t0 = D.launch;
    var rows = LAYERS.map(function (h) {
      var a = windAt(D, h, 0), b = windAt(D, h, D.window);
      function c(w) { var sp = Math.hypot(w[0], w[1]); return sp < 0.4 ? 'calm' : point(bearing(-w[0], -w[1])) + ' ' + Math.round(sp * MPH) + ' mph'; }
      return '<tr><td>' + (h ? ftS(h) : 'ground') + '</td><td>' + c(a) + '</td><td>' + c(b) + '</td></tr>';
    }).join('');
    var s = '<h5>What the winds were doing</h5><div class="tablewrap"><table><tr><th>Height</th><th>From, at ' + clock(t0) + '</th><th>From, at sunset</th></tr>' + rows + '</table></div>';
    s += '<p>The gold dashes are the route the day’s number flew before it put the subscribers at ' + D.target.name + ': hold <b>' + ftS(P.hA) + '</b> until <b>' + clock(t0 + P.t1 / 3600) + '</b>, then <b>' + ftS(P.hB) + '</b> until ' + clock(t0 + P.T / 3600) +
      '. It is flown on the winds alone, without the sand and gas it would cost, so it is a route and not a promise.</p>';
    s += '<p>The blue dots are the best you could have done by holding a single height the whole way: <b>' + ftS(D.single.h) + '</b> would have brought you within ' + miles(D.single.d) + ' of ' + D.target.name + ' and no nearer.</p>';
    $('reveal').innerHTML = s; $('reveal').style.display = '';
  }

  /* ---------- wiring ---------- */
  $('btnGo').addEventListener('click', go);
  $('btnScoop').addEventListener('click', function () { sand(SCOOP); });
  $('btnBag').addEventListener('click', function () { sand(BAG); });
  $('btnPilot').addEventListener('click', pilot);
  $('btnRip').addEventListener('click', rip);
  $('btnHurry').addEventListener('click', function () { hurry = !hurry; buttons(); });
  var vb = $('btnValve');
  vb.addEventListener('pointerdown', function (e) { e.preventDefault(); try { vb.setPointerCapture(e.pointerId); } catch (x) {} valve(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { vb.addEventListener(ev, function () { valve(false); }); });
  vb.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) valve(true); } });
  vb.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') valve(false); });
  $('btnAgain').addEventListener('click', load);
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  window.addEventListener('blur', function () { valve(false); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase(), air = F.state === 'flying' || F.state === 'ground';
    if (k === ' ' && tag !== 'BUTTON') { e.preventDefault(); go(); }
    else if (k === 'v') { e.preventDefault(); if (!e.repeat) valve(true); }
    else if (k === 's') sand(SCOOP);
    else if (k === 'b') sand(BAG);
    else if (k === 'p') pilot();
    else if (k === 'r') rip();
    else if (k === 'f') { hurry = !hurry; buttons(); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (!air || finished)) { dayOff += e.key === 'ArrowLeft' ? -1 : 1; load(); }
  });
  document.addEventListener('keyup', function (e) { if (e.key.toLowerCase() === 'v') valve(false); });

  load();
})();
