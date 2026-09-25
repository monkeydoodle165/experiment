/* drift.quibo.games — The Lights
   A coast drawn by the day's number, at night, with the electronics dead. The
   light characteristics, Allard's law for luminous range, the geographic range
   rule and the geometry of a three-bearing fix are the real thing; the coast,
   its names and every light on it are not anywhere. Self-contained. No dependencies. */
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
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var RAD = Math.PI / 180;
  function n360(a) { a %= 360; return a < 0 ? a + 360 : a; }
  function n180(a) { a = n360(a); return a > 180 ? a - 360 : a; }
  function brg3(a) { var v = Math.round(n360(a)) % 360; return (v < 10 ? '00' : v < 100 ? '0' : '') + v + '°'; }
  function az(x0, y0, x1, y1) { return n360(Math.atan2(x1 - x0, y1 - y0) / RAD); }
  function nm(d) { return d < 1 ? Math.round(d * 10) + ' cables' : d.toFixed(1) + ' nm'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function makeNoise(r) {
    var g = new Float32Array(65536);
    for (var i = 0; i < g.length; i++) g[i] = r();
    function at(x, y) { return g[((y & 255) << 8) + (x & 255)]; }
    function sm(t) { return t * t * (3 - 2 * t); }
    function v(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      var a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
    }
    return function (x, y) { return v(x, y) * 0.55 + v(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + v(x * 4.3 + 3, y * 4.3 + 29) * 0.15; };
  }

  /* ---------- light characteristics: real IALA rhythms, built as on/off segments ---------- */
  // each pattern is a list of [seconds, on] that adds up to one period
  function flashes(groups, P, f, gapIn, gapGroup) {
    var seg = [], used = 0;
    groups.forEach(function (n, gi) {
      for (var i = 0; i < n; i++) {
        seg.push([f, 1]); used += f;
        if (i < n - 1) { seg.push([gapIn, 0]); used += gapIn; }
      }
      if (gi < groups.length - 1) { seg.push([gapGroup, 0]); used += gapGroup; }
    });
    seg.push([Math.max(0.3, P - used), 0]);
    return seg;
  }
  function occult(n, P) {
    var seg = [], used = 0, e = 1, l = 1;
    for (var i = 0; i < n; i++) { seg.push([e, 0]); used += e; if (i < n - 1) { seg.push([l, 1]); used += l; } }
    seg.unshift([P - used, 1]);
    return seg;
  }
  function quick(n, P, tail) {
    var seg = [], used = 0;
    for (var i = 0; i < n; i++) { seg.push([0.35, 1]); seg.push([0.65, 0]); used += 1; }
    if (tail) { seg.push([2, 1]); used += 2; }
    seg.push([P - used, 0]);
    return seg;
  }
  function morse(code, P) {
    var seg = [], used = 0;
    code.split('').forEach(function (c, i) {
      var d = c === '.' ? 0.5 : 1.5;
      seg.push([d, 1]); used += d;
      if (i < code.length - 1) { seg.push([0.5, 0]); used += 0.5; }
    });
    seg.push([P - used, 0]);
    return seg;
  }

  var HOUSE = [
    { ch: 'Fl', P: 5, seg: function () { return flashes([1], 5, 0.5, 0, 0); } },
    { ch: 'Fl', P: 10, seg: function () { return flashes([1], 10, 0.7, 0, 0); } },
    { ch: 'Fl(2)', P: 10, seg: function () { return flashes([2], 10, 0.5, 1.5, 0); } },
    { ch: 'Fl(2)', P: 15, seg: function () { return flashes([2], 15, 0.6, 2, 0); } },
    { ch: 'Fl(3)', P: 15, seg: function () { return flashes([3], 15, 0.5, 1.5, 0); } },
    { ch: 'Fl(3)', P: 20, seg: function () { return flashes([3], 20, 0.6, 2, 0); } },
    { ch: 'Fl(4)', P: 20, seg: function () { return flashes([4], 20, 0.5, 1.5, 0); } },
    { ch: 'Fl(2+1)', P: 15, seg: function () { return flashes([2, 1], 15, 0.5, 1.2, 3); } },
    { ch: 'LFl', P: 10, seg: function () { return flashes([1], 10, 2.2, 0, 0); } },
    { ch: 'Oc', P: 8, seg: function () { return occult(1, 8); } },
    { ch: 'Oc(2)', P: 10, seg: function () { return occult(2, 10); } },
    { ch: 'Oc(3)', P: 15, seg: function () { return occult(3, 15); } },
    { ch: 'Iso', P: 6, seg: function () { return [[3, 1], [3, 0]]; } },
    { ch: 'Mo(A)', P: 8, seg: function () { return morse('.-', 8); } },
    { ch: 'Mo(U)', P: 15, seg: function () { return morse('..-', 15); } }
  ];
  var CARDINAL = {
    N: { ch: 'Q', P: 1, seg: function () { return [[0.35, 1], [0.65, 0]]; }, name: 'North cardinal' },
    E: { ch: 'Q(3)', P: 10, seg: function () { return quick(3, 10); }, name: 'East cardinal' },
    S: { ch: 'Q(6)+LFl', P: 15, seg: function () { return quick(6, 15, true); }, name: 'South cardinal' },
    W: { ch: 'Q(9)', P: 15, seg: function () { return quick(9, 15); }, name: 'West cardinal' }
  };
  var COL = { W: '#fff3cf', R: '#ff5b4d', G: '#52f59a' };
  var COLNAME = { W: 'white', R: 'red', G: 'green' };

  function lightOn(L, t) {
    var tt = ((t + L.phase) % L.P + L.P) % L.P, acc = 0;
    for (var i = 0; i < L.seg.length; i++) {
      acc += L.seg[i][0];
      if (tt < acc) return L.seg[i][1];
    }
    return 0;
  }
  function chartLabel(L) {
    var c = L.sector ? 'WRG' : (L.col === 'W' ? '' : L.col);
    var s = L.ch + (c ? ' ' + c : '') + (L.P > 1 ? ' ' + L.P + 's' : '');
    if (!L.buoy) s += ' ' + L.H + 'm ' + (L.sector ? L.Rn + '-' + L.RnC + 'M' : L.Rn + 'M');
    else s += ' ' + L.Rn + 'M';
    return s;
  }

  /* ---------- range: Allard's law with the IALA night threshold, and the geographic rule ---------- */
  var T10 = Math.pow(0.05, 1 / 10);          // transmissivity per mile in 10 nm visibility
  function bright(Rn, V, d) {                // illuminance over the threshold (1 = just visible)
    var T = Math.pow(0.05, 1 / V);
    d = Math.max(d, 0.05);
    return (Rn * Rn * Math.pow(T, d)) / (Math.pow(T10, Rn) * d * d);
  }
  function lumRange(Rn, V) {
    var lo = 0.05, hi = 200;
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (bright(Rn, V, m) > 1) lo = m; else hi = m; }
    return lo;
  }
  var EYE = 3;
  function geoRange(H) { return 2.03 * (Math.sqrt(H) + Math.sqrt(EYE)); }

  /* ---------- names ---------- */
  var ROOTS = ['Carn', 'Gull', 'Black', 'Rann', 'Mull', 'Howe', 'Dun', 'Scaur', 'Hare', 'Brough',
    'Lang', 'Fair', 'Seal', 'Maw', 'Corran', 'Rona', 'Stour', 'Kettle', 'Raven', 'Grey', 'Copper', 'Heron', 'Wether',
    'Otter', 'Sheep', 'Whin', 'Crane', 'Ebb', 'Bell', 'Needle', 'Saddle', 'Cairn'];
  var HEAD = [' Head', ' Point', ' Ness', ' Bill', ' Head', ' Point'];
  var ISLE = [' Rock', ' Skerry', ' Island', ' Stack'];
  var T1 = ['Kil', 'Ard', 'Port', 'Inver', 'Strath', 'Dal', 'Bal', 'Aber', 'Tor', 'Lin', 'Craig', 'Glen', 'Sand', 'Wester'];
  var T2 = ['haven', 'wick', 'mouth', 'ay', 'ross', 'ford', 'sound', 'more', 'lee', 'strand'];

  /* ---------- building a coast ---------- */
  var N = 240, SIZE = 24, CELL = SIZE / N;     // 0.1 nm cells on a 24 nm square

  function build(seed, attempt) {
    var r = rng(seed ^ Math.imul(attempt + 1, 0x85ebca6b));
    var noise = makeNoise(r), noise2 = makeNoise(r);
    var land = new Uint8Array(N * N), isle = new Uint8Array(N * N), hgt = new Float32Array(N * N);
    var th = r() * 360, nx = Math.sin(th * RAD), ny = Math.cos(th * RAD);
    var off = 3.5 + r() * 3, amp = 7 + r() * 5, fq = 0.12 + r() * 0.08;
    var islands = [], ni = 1 + Math.floor(r() * 3);
    for (var k = 0; k < ni; k++) {
      var d0 = off - 3 - r() * 8, lat = (r() - 0.5) * 16;
      islands.push({ x: 12 + nx * d0 - ny * lat, y: 12 + ny * d0 + nx * lat, rad: 0.5 + r() * 1.3 });
    }
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, idx = j * N + i;
      var s = (x - 12) * nx + (y - 12) * ny - off + (noise(x * fq, y * fq) - 0.5) * amp + (noise(x * 0.6 + 40, y * 0.6) - 0.5) * 1.6;
      if (s > 0) land[idx] = 1;
      else {
        for (var q = 0; q < islands.length; q++) {
          var I = islands[q], dd = Math.hypot(x - I.x, y - I.y);
          if (dd < I.rad * (0.65 + 0.7 * noise(x * 0.9 + q * 30, y * 0.9))) { land[idx] = 1; isle[idx] = 1; }
        }
      }
      hgt[idx] = land[idx] ? 10 + noise2(x * 0.25, y * 0.25) * 130 * clamp((s > 0 ? s : 1.5) / 2.5, 0.25, 1) : 0;
    }
    function L(i, j) { return i < 0 || j < 0 || i >= N || j >= N ? 0 : land[j * N + i]; }

    // coastal cells and how much sea each one looks out over
    var cand = [];
    var R = 12, tot = 0, offs = [];
    for (var b = -R; b <= R; b++) for (var a = -R; a <= R; a++) if (a * a + b * b <= R * R) { offs.push([a, b]); tot++; }
    for (j = 3; j < N - 3; j += 2) for (i = 3; i < N - 3; i += 2) {
      if (!L(i, j)) continue;
      if (L(i + 1, j) && L(i - 1, j) && L(i, j + 1) && L(i, j - 1) && L(i + 2, j) && L(i - 2, j) && L(i, j + 2) && L(i, j - 2)) continue;
      var sea = 0, vx = 0, vy = 0;
      for (var o = 0; o < offs.length; o++) {
        var ii = i + offs[o][0], jj = j + offs[o][1];
        if (!L(ii, jj)) { sea++; vx += offs[o][0]; vy += offs[o][1]; }
      }
      cand.push({ i: i, j: j, x: (i + 0.5) * CELL, y: (j + 0.5) * CELL, score: sea / tot, dir: n360(Math.atan2(vx, vy) / RAD), isle: isle[j * N + i] });
    }
    var inner = cand.filter(function (c) { return c.x > 1.5 && c.x < 22.5 && c.y > 1.5 && c.y < 22.5; });
    var heads = inner.filter(function (c) { return c.score > 0.58; }).sort(function (p, q) { return q.score - p.score; });

    var lights = [], used = {};
    var want = 4 + Math.floor(r() * 2);
    var pool = shuffle(HOUSE.slice(), r);
    function spaced(c, min) { return lights.every(function (l) { return Math.hypot(l.x - c.x, l.y - c.y) >= min; }); }
    [5, 3.8].forEach(function (min) {
      heads.forEach(function (c) {
        if (lights.length >= want || !spaced(c, min)) return;
        var sp = pool[lights.length];
        var root; do { root = pick(r, ROOTS); } while (used[root]); used[root] = 1;
        var H = Math.round(18 + r() * 42), Rn = Math.round(14 + r() * 9);
        lights.push({
          x: c.x, y: c.y, H: H, Rn: Rn, ch: sp.ch, P: sp.P, seg: sp.seg(), col: r() < 0.82 ? 'W' : 'R',
          name: root + (c.isle ? pick(r, ISLE) : pick(r, HEAD)), kind: c.isle ? 'island' : 'headland', dir: c.dir,
          phase: r() * 40, landH: H
        });
      });
    });
    if (lights.length < 3) return null;
    lights.forEach(function (l) { if (l.col === 'R') l.Rn = Math.max(10, l.Rn - 4); });

    // a harbour in a bay, with a sector light pointing out along the way in
    var town = pick(r, T1) + pick(r, T2);
    var bays = inner.filter(function (c) { return c.score > 0.26 && c.score < 0.42 && !c.isle; });
    shuffle(bays, r);
    var harbour = null;
    for (var bq = 0; bq < bays.length; bq++) { if (spaced(bays[bq], 3)) { harbour = bays[bq]; break; } }
    if (harbour) {
      lights.push({
        x: harbour.x, y: harbour.y, H: 8 + Math.round(r() * 8), Rn: 12, RnC: 9, ch: 'Oc', P: 5, seg: occult(1, 5),
        col: 'W', sector: { c: harbour.dir, w: 3, span: 32 }, name: town + ' harbour', kind: 'harbour', dir: harbour.dir,
        phase: r() * 40
      });
    }

    // a cardinal buoy off one of the headlands, on the side it guards
    if (r() < 0.7) {
      var hl = lights[Math.floor(r() * Math.min(lights.length, 3))];
      if (hl && !hl.sector) {
        var bd = hl.dir + (r() - 0.5) * 50, dist = 1.2 + r() * 0.8;
        var bx = hl.x + Math.sin(bd * RAD) * dist, by = hl.y + Math.cos(bd * RAD) * dist;
        var bi = Math.floor(bx / CELL), bj = Math.floor(by / CELL);
        if (bx > 1 && bx < 23 && by > 1 && by < 23 && !L(bi, bj)) {
          var qd = ['N', 'E', 'S', 'W'][Math.round(n360(bd) / 90) % 4], C = CARDINAL[qd];
          lights.push({
            x: bx, y: by, H: 5, Rn: 5, card: C.name, ch: C.ch, P: C.P, seg: C.seg(), col: 'W', buoy: qd,
            name: hl.name.split(' ')[0] + ' Ledge ' + C.name.split(' ')[0].toLowerCase() + ' buoy', kind: 'buoy', phase: r() * 40
          });
        }
      }
    }
    lights.forEach(function (l, n) { l.id = n; });

    return {
      seed: seed, land: land, hgt: hgt, isle: isle, lights: lights, town: town,
      vis: Math.round((6 + Math.pow(r(), 0.8) * 20) * 2) / 2,
      coastDir: th, stars: (function () {
        var s = []; for (var k2 = 0; k2 < 170; k2++) s.push([r() * 360, Math.pow(r(), 1.3), 0.2 + r() * 0.8]); return s;
      })()
    };
  }

  function landAt(W, x, y) {
    var i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    return W.land[j * N + i];
  }
  function blocked(W, sx, sy, L) {
    var d = Math.hypot(L.x - sx, L.y - sy), steps = Math.ceil(d / 0.05);
    for (var k = 1; k < steps; k++) {
      var t = k / steps, x = sx + (L.x - sx) * t, y = sy + (L.y - sy) * t;
      if ((1 - t) * d < 0.35) break;
      if (landAt(W, x, y)) return true;
    }
    return false;
  }

  // what a light looks like from a given spot: colour, how bright, and whether it's the lamp or only the loom
  function sectorColour(L, sx, sy) {
    if (!L.sector) return L.col;
    var b = az(L.x, L.y, sx, sy), dl = n180(b - L.sector.c);
    if (Math.abs(dl) > L.sector.span) return null;
    if (Math.abs(dl) <= L.sector.w) return 'W';
    return dl > 0 ? 'R' : 'G';
  }
  function sighting(W, L, sx, sy) {
    var d = Math.hypot(L.x - sx, L.y - sy), col = sectorColour(L, sx, sy);
    var out = { d: d, col: col, mode: 'none', geo: geoRange(L.H) };
    if (!col) { out.why = 'outside its sectors'; return out; }
    var Rn = (L.sector && col !== 'W') ? L.RnC : L.Rn;
    out.lum = lumRange(Rn, W.vis);
    out.b = bright(Rn, W.vis, d);
    if (d > out.lum) { out.why = 'beyond its range tonight'; return out; }
    var obs = blocked(W, sx, sy, L);
    if (d <= out.geo && !obs) { out.mode = 'lamp'; return out; }
    if (!L.buoy && d < out.geo * 1.7) { out.mode = 'loom'; out.why = obs ? 'behind the land' : 'below the horizon'; return out; }
    out.why = obs ? 'behind the land' : 'below the horizon';
    return out;
  }

  function placeShip(W, r) {
    var best = null;
    for (var k = 0; k < 500; k++) {
      var x = 2 + r() * 20, y = 2 + r() * 20;
      if (landAt(W, x, y)) continue;
      var clear = true;
      for (var a = 0; a < 360 && clear; a += 30) if (landAt(W, x + Math.sin(a * RAD) * 1.1, y + Math.cos(a * RAD) * 1.1)) clear = false;
      if (!clear) continue;
      var lamps = 0, seen = 0;
      W.lights.forEach(function (L) { var s = sighting(W, L, x, y); if (s.mode === 'lamp') { lamps++; if (!L.buoy) seen++; } });
      var sc = (seen >= 3 ? 10 : seen * 2) + (lamps < 6 ? lamps : 0) + r();
      if (!best || sc > best.sc) best = { x: x, y: y, sc: sc, seen: seen };
      if (seen >= 3 && k > 60 && r() < 0.15) break;
    }
    return best;
  }

  /* ---------- state ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var S = { day: 0, pos: 0, W: null, ship: null, dr: null, head: 0, sel: -1, rows: [], fix: null, revealed: false, hover: null, rowSeq: 0 };
  var ROWCOL = ['#7aa2ff', '#ffce6a', '#64f0c8', '#ff8ad8', '#b78cff', '#9bf6ff', '#ffa36a', '#c7f9cc'];

  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }

  function load() {
    var d = dateFor(S.day), seed = seedForDate(d), W = null;
    for (var a = 0; a < 300 && !W; a++) W = build(seed, a);
    var r = rng(seed ^ 0x51ed27 ^ Math.imul(S.pos + 1, 0x27d4eb2d));
    var sh = placeShip(W, r) || { x: 12, y: 12 };
    S.W = W; S.ship = { x: sh.x, y: sh.y };
    var drA = r() * 360, drD = 0.8 + r() * 1.6;
    S.dr = { x: clamp(sh.x + Math.sin(drA * RAD) * drD, 0.5, 23.5), y: clamp(sh.y + Math.cos(drA * RAD) * drD, 0.5, 23.5) };
    S.head = Math.round(r() * 360) % 360;
    S.nr = r;
    S.sel = -1; S.rows = []; S.fix = null; S.revealed = false;
    S.sights = W.lights.map(function (L) { return sighting(W, L, sh.x, sh.y); });
    skyline();
    describe(d);
    lightList();
    drawChart();
    notebook();
    verdict();
    $('btnBearing').disabled = true;
    $('btnReveal').disabled = true;
    $('watchOut').textContent = 'No light selected. Click one on the horizon.';
  }

  /* ---------- the skyline, seen from the boat ---------- */
  function skyline() {
    var W = S.W, sx = S.ship.x, sy = S.ship.y, prof = new Float32Array(720);
    for (var k = 0; k < 720; k++) {
      var a = k / 2 * RAD, dx = Math.sin(a), dy = Math.cos(a), best = 0;
      for (var t = 0.1; t < 32; t += 0.08) {
        var x = sx + dx * t, y = sy + dy * t;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) break;
        var i = Math.floor(x / CELL), j = Math.floor(y / CELL), idx = j * N + i;
        if (W.land[idx]) {
          var e = Math.atan(W.hgt[idx] / (t * 1852)) / RAD;
          if (e > best) best = e;
        }
      }
      prof[k] = best;
    }
    S.prof = prof;
  }

  /* ---------- words ---------- */
  function describe(d) {
    var W = S.W, houses = W.lights.filter(function (l) { return !l.buoy && !l.sector; });
    var hb = W.lights.filter(function (l) { return l.sector; })[0];
    var buoy = W.lights.filter(function (l) { return l.buoy; })[0];
    var visWord = W.vis < 9 ? 'a haze over the water' : W.vis < 15 ? 'moderate visibility' : W.vis < 22 ? 'good visibility' : 'a hard, clear night';
    $('coastWho').textContent = 'Night watch · ' + d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · stopped in the water';
    $('coastName').textContent = 'Off ' + houses[0].name;
    $('coastBlurb').textContent =
      'The chart shows ' + houses.length + ' lighthouses along this stretch' +
      (hb ? ', a sector light on the pier at ' + W.town : '') +
      (buoy ? ' and a ' + buoy.card.toLowerCase() + ' buoy guarding a ledge' : '') +
      '. There is ' + visWord + ', about ' + W.vis + ' miles. The plotter went dark an hour ago, and the dead reckoning worked up since then puts you somewhere near the circle marked DR, give or take a couple of miles. That is not good enough to go in on. Find out where you really are.';
    $('dayOut').textContent = S.day === 0 ? 'tonight' : (S.day > 0 ? S.day + ' night' + (S.day > 1 ? 's' : '') + ' on' : -S.day + ' night' + (S.day < -1 ? 's' : '') + ' back');
    $('fDate').textContent = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) + (S.pos ? ' · position ' + (S.pos + 1) : '');
    $('fVis').textContent = W.vis + ' nm, ' + visWord;
    $('fEye').textContent = EYE + ' m above the water';
    $('fHead').textContent = brg3(S.head) + ' T, lying stopped';
    var seen = [], hidden = [];
    W.lights.forEach(function (L, n) {
      var s = S.sights[n];
      if (s.mode === 'lamp') seen.push(L.name);
      else hidden.push(L.name + ' (' + (s.mode === 'loom' ? 'loom only, ' + s.why : s.why) + ')');
    });
    $('fSeen').textContent = seen.length;
    $('fHidden').textContent = hidden.length ? hidden.length + ' — not named until you reveal' : 'none';
    S.hiddenList = hidden;
  }

  function drawPeriod(cv, L, colKey) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = 170, h = 22;
    cv.width = w * dpr; cv.height = h * dpr;
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#05070c'; c.fillRect(0, 0, w, h);
    var P = L.P === 1 ? 5 : L.P, x = 0;
    var segs = L.P === 1 ? [].concat(L.seg, L.seg, L.seg, L.seg, L.seg) : L.seg;
    segs.forEach(function (s) {
      var sw = s[0] / P * w;
      if (s[1]) { c.fillStyle = COL[colKey]; c.fillRect(x, 3, Math.max(1, sw), h - 6); }
      x += sw;
    });
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  function lightList() {
    var W = S.W, tb = $('lol'); tb.innerHTML = '';
    W.lights.forEach(function (L) {
      var tr = document.createElement('tr');
      var lums = L.sector ? lumRange(L.Rn, W.vis).toFixed(1) + ' / ' + lumRange(L.RnC, W.vis).toFixed(1) + ' nm' : lumRange(L.Rn, W.vis).toFixed(1) + ' nm';
      tr.innerHTML = '<td>' + esc(L.name) + '</td><td class="m">' + esc(chartLabel(L)) + '</td><td><canvas></canvas></td>' +
        '<td class="d">' + L.H + ' m</td><td class="d">' + (L.sector ? L.Rn + ' / ' + L.RnC : L.Rn) + ' nm</td>' +
        '<td>' + lums + '</td><td class="d">' + geoRange(L.H).toFixed(1) + ' nm</td>';
      tb.appendChild(tr);
      drawPeriod(tr.querySelector('canvas'), L, L.col);
    });
  }

  /* ---------- the horizon ---------- */
  var hz = $('horizon'), hctx = hz.getContext('2d'), tr = $('trace'), tctx = tr.getContext('2d');
  var ch = $('chart'), cctx = ch.getContext('2d');
  var DPR = 1;
  function fit(cv, cx) {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, Math.floor(w * DPR)); cv.height = Math.max(1, Math.floor(h * DPR));
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { w: w, h: h };
  }
  var HZ = { w: 0, h: 0 }, TR = { w: 0, h: 0 }, CH = { w: 0, h: 0 };
  function resize() { HZ = fit(hz, hctx); TR = fit(tr, tctx); CH = fit(ch, cctx); drawChart(); }

  function screenOf(n) {
    var L = S.W.lights[n], s = S.sights[n];
    var b = az(S.ship.x, S.ship.y, L.x, L.y), ppd = HZ.w / 360, hor = HZ.h * 0.66, vs = ppd * 7;
    var e = Math.atan((L.H) / (s.d * 1852)) / RAD;
    var y = s.mode === 'loom' ? hor - 18 : hor - Math.min(e * vs, hor * 0.6);
    return { x: b * ppd, y: y, b: b };
  }

  function now() { return performance.now() / 1000; }

  function drawHorizon(t) {
    var w = HZ.w, h = HZ.h, c = hctx, W = S.W, ppd = w / 360, hor = h * 0.66, vs = ppd * 7;
    var g = c.createLinearGradient(0, 0, 0, hor);
    g.addColorStop(0, '#02030a'); g.addColorStop(1, '#0b1224');
    c.fillStyle = g; c.fillRect(0, 0, w, hor);
    var sg = c.createLinearGradient(0, hor, 0, h);
    sg.addColorStop(0, '#060a14'); sg.addColorStop(1, '#020308');
    c.fillStyle = sg; c.fillRect(0, hor, w, h - hor);
    // stars, fewer in haze
    var keep = clamp(W.vis / 20, 0.25, 1);
    W.stars.forEach(function (s, i) {
      if (i / W.stars.length > keep) return;
      c.fillStyle = 'rgba(220,230,255,' + (s[2] * 0.6) + ')';
      c.fillRect(s[0] * ppd, 4 + s[1] * (hor - 20), 1.2, 1.2);
    });
    // the land against the sky
    c.fillStyle = '#010205';
    c.beginPath(); c.moveTo(0, hor);
    for (var k = 0; k <= 720; k++) {
      var e = S.prof[k % 720];
      c.lineTo(k / 2 * ppd, hor - Math.min(e * vs, hor * 0.85));
    }
    c.lineTo(w, hor); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,140,180,.12)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, hor + 0.5); c.lineTo(w, hor + 0.5); c.stroke();

    // the lights
    W.lights.forEach(function (L, n) {
      var s = S.sights[n];
      if (s.mode === 'none') return;
      var p = screenOf(n), on = lightOn(L, t), col = COL[s.col];
      var mag = clamp(Math.log(s.b) / Math.log(400), 0.05, 1);
      if (s.mode === 'loom') {
        if (!on) return;
        var lg = c.createRadialGradient(p.x, hor, 0, p.x, hor, 26 + mag * 20);
        lg.addColorStop(0, hexA(col, 0.22 * (0.4 + mag))); lg.addColorStop(1, hexA(col, 0));
        c.fillStyle = lg; c.fillRect(p.x - 50, hor - 50, 100, 50);
        return;
      }
      if (!on) { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(p.x - 0.5, p.y - 0.5, 1, 1); return; }
      var rad = 5 + mag * 13;
      var gl = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      gl.addColorStop(0, hexA(col, 1)); gl.addColorStop(0.18, hexA(col, 0.85)); gl.addColorStop(1, hexA(col, 0));
      c.fillStyle = gl; c.beginPath(); c.arc(p.x, p.y, rad, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x, p.y, 1.3 + mag, 0, Math.PI * 2); c.fill();
      // reflection
      c.fillStyle = hexA(col, 0.12 * mag + 0.03);
      c.fillRect(p.x - 1, hor + 2, 2, 8 + mag * 22);
    });

    // selection and bearings already taken
    if (S.sel >= 0) {
      var ps = screenOf(S.sel);
      c.strokeStyle = 'rgba(122,162,255,.8)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(ps.x, S.sights[S.sel].mode === 'loom' ? hor - 6 : ps.y, 11, 0, Math.PI * 2); c.stroke();
    }
    S.rows.forEach(function (row) {
      var x = row.brg * ppd;
      c.fillStyle = row.colr; c.fillRect(x - 0.5, 0, 1, 9);
    });
    // ship's head
    var hx = S.head * ppd;
    c.fillStyle = 'rgba(100,240,200,.8)';
    c.beginPath(); c.moveTo(hx, h - 30); c.lineTo(hx - 5, h - 22); c.lineTo(hx + 5, h - 22); c.closePath(); c.fill();
    // compass scale
    c.fillStyle = 'rgba(2,3,8,.85)'; c.fillRect(0, h - 18, w, 18);
    c.strokeStyle = 'rgba(255,255,255,.25)';
    c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    var step = ppd > 1.8 ? 5 : 10;
    for (var a = 0; a < 360; a += step) {
      var tx = a * ppd, big = a % 30 === 0;
      c.beginPath(); c.moveTo(tx + 0.5, h - 18); c.lineTo(tx + 0.5, h - (big ? 11 : 14)); c.stroke();
      if (big && (ppd > 1.6 || a % 90 === 0)) {
        c.fillStyle = a % 90 === 0 ? '#e8edf5' : '#8b97ab';
        c.fillText(a % 90 === 0 ? ['N', 'E', 'S', 'W'][a / 90] : brg3(a).replace('°', ''), tx + (a === 0 ? 8 : 0), h - 3);
      }
    }
    if (S.hover != null) {
      c.strokeStyle = 'rgba(255,255,255,.15)';
      c.beginPath(); c.moveTo(S.hover * ppd + 0.5, 0); c.lineTo(S.hover * ppd + 0.5, h - 18); c.stroke();
    }
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
  }

  function drawTrace(t) {
    var c = tctx, w = TR.w, h = TR.h, span = 24;
    c.fillStyle = '#05070c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.06)'; c.fillStyle = '#56627a';
    c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    for (var s = 0; s <= span; s++) {
      var x = w - (s / span) * w;
      c.beginPath(); c.moveTo(x + 0.5, 12); c.lineTo(x + 0.5, h - 16); c.stroke();
      if (s % 4 === 0 && s > 0 && s < span) c.fillText('−' + s + ' s', x, h - 4);
    }
    c.textAlign = 'right'; c.fillText('now', w - 4, h - 4);
    if (S.sel < 0) {
      c.fillStyle = '#56627a'; c.textAlign = 'left'; c.font = '12px ui-sans-serif,system-ui,sans-serif';
      c.fillText('The stopwatch is idle.', 12, h / 2);
      return;
    }
    var L = S.W.lights[S.sel], si = S.sights[S.sel], col = COL[si.col];
    var hi = si.mode === 'loom' ? 0.45 : 1, top = 14, bot = h - 20;
    c.strokeStyle = hexA(col, hi); c.lineWidth = 1.6;
    c.fillStyle = hexA(col, 0.18 * hi);
    c.beginPath();
    var prev = null;
    for (var px = 0; px <= w; px++) {
      var tt = t - (1 - px / w) * span, on = lightOn(L, tt);
      var y = on ? top + (bot - top) * (1 - hi) : bot;
      if (prev === null) c.moveTo(px, y); else if (y !== prev) { c.lineTo(px, prev); c.lineTo(px, y); } else c.lineTo(px, y);
      prev = y;
    }
    c.stroke();
    c.lineTo(w, bot); c.lineTo(0, bot); c.closePath(); c.fill();
  }

  function frame() {
    var t = now();
    if (S.W && HZ.w) { drawHorizon(t); drawTrace(t); }
    requestAnimationFrame(frame);
  }

  /* ---------- the chart ---------- */
  var landImg = null;
  function landImage() {
    var W = S.W, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    var c = cv.getContext('2d'), im = c.createImageData(N, N);
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var src = j * N + i, dst = ((N - 1 - j) * N + i) * 4, isL = W.land[src];
      var shore = 0;
      if (isL) {
        if ((i > 0 && !W.land[src - 1]) || (i < N - 1 && !W.land[src + 1]) || (j > 0 && !W.land[src - N]) || (j < N - 1 && !W.land[src + N])) shore = 1;
      } else {
        for (var dj = -3; dj <= 3 && !shore; dj++) for (var di = -3; di <= 3; di++) {
          var ii = i + di, jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < N && jj < N && W.land[jj * N + ii]) { shore = 2; break; }
        }
      }
      var rgb;
      if (isL) { var hh = W.hgt[src] / 140; rgb = shore ? [150, 132, 86] : [46 + hh * 30, 42 + hh * 26, 26 + hh * 14]; }
      else rgb = shore === 2 ? [18, 38, 62] : [10, 20, 34];
      im.data[dst] = rgb[0]; im.data[dst + 1] = rgb[1]; im.data[dst + 2] = rgb[2]; im.data[dst + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    return cv;
  }

  function drawChart() {
    if (!S.W || !CH.w) return;
    var c = cctx, w = CH.w, sc = w / SIZE, W = S.W;
    function P(x, y) { return [x * sc, (SIZE - y) * sc]; }
    if (!landImg || landImg.seed !== W) { landImg = landImage(); landImg.seed = W; }
    c.imageSmoothingEnabled = true;
    c.drawImage(landImg, 0, 0, w, w);
    // grid
    c.strokeStyle = 'rgba(122,162,255,.07)'; c.lineWidth = 1;
    for (var g = 2; g < SIZE; g += 2) {
      c.beginPath(); c.moveTo(g * sc + 0.5, 0); c.lineTo(g * sc + 0.5, w); c.stroke();
      c.beginPath(); c.moveTo(0, g * sc + 0.5); c.lineTo(w, g * sc + 0.5); c.stroke();
    }
    var labels = $('labelChk').checked;

    // ranges
    if ($('rangeChk').checked) {
      W.lights.forEach(function (L) {
        var rr = Math.min(lumRange(L.Rn, W.vis), geoRange(L.H)), p = P(L.x, L.y);
        c.strokeStyle = 'rgba(224,74,223,.28)'; c.setLineDash([3, 4]);
        c.beginPath(); c.arc(p[0], p[1], rr * sc, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      });
    }

    // sector light arcs
    W.lights.forEach(function (L) {
      if (!L.sector) return;
      var p = P(L.x, L.y), R = 2.4 * sc, s = L.sector;
      [['G', -s.span, -s.w], ['W', -s.w, s.w], ['R', s.w, s.span]].forEach(function (q) {
        c.strokeStyle = hexA(COL[q[0]], 0.8); c.lineWidth = 3;
        c.beginPath();
        // canvas angle: bearing b → angle (b - 90) with y flipped
        c.arc(p[0], p[1], R, (s.c + q[1] - 90) * RAD, (s.c + q[2] - 90) * RAD); c.stroke();
      });
      c.strokeStyle = 'rgba(255,243,207,.35)'; c.lineWidth = 1; c.setLineDash([2, 3]);
      [-s.span, -s.w, s.w, s.span].forEach(function (o) {
        var b = (s.c + o) * RAD;
        c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.sin(b) * R * 1.15, p[1] - Math.cos(b) * R * 1.15); c.stroke();
      });
      c.setLineDash([]);
      if (labels) {
        c.fillStyle = 'rgba(255,243,207,.7)'; c.font = '9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
        var lb = (s.c) * RAD;
        c.fillText('W ' + brg3(s.c + 180 - s.w).replace('°', '') + '–' + brg3(s.c + 180 + s.w), p[0] + Math.sin(lb) * R * 1.45, p[1] - Math.cos(lb) * R * 1.45);
      }
    });

    // lines of position
    S.rows.forEach(function (row) {
      if (row.pick == null) return;
      var L = W.lights[row.pick], back = (row.brg + 180) * RAD, p = P(L.x, L.y);
      c.strokeStyle = row.colr; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.sin(back) * 40 * sc, p[1] - Math.cos(back) * 40 * sc); c.stroke();
      var m = [p[0] + Math.sin(back) * 3 * sc, p[1] - Math.cos(back) * 3 * sc];
      c.fillStyle = row.colr; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
      c.fillText(brg3(row.brg), m[0] + 12, m[1] - 4);
    });

    // cocked hat
    var X = crossings();
    if (X.length >= 3) {
      c.fillStyle = 'rgba(255,206,106,.18)'; c.strokeStyle = 'rgba(255,206,106,.6)';
      c.beginPath(); X.forEach(function (q, i) { var pp = P(q.x, q.y); if (i) c.lineTo(pp[0], pp[1]); else c.moveTo(pp[0], pp[1]); });
      c.closePath(); c.fill(); c.stroke();
    }

    // lights and buoys
    W.lights.forEach(function (L) {
      var p = P(L.x, L.y);
      if (L.buoy) {
        c.fillStyle = '#f2c14e'; c.strokeStyle = '#111';
        c.beginPath(); c.moveTo(p[0], p[1] - 6); c.lineTo(p[0] + 4, p[1]); c.lineTo(p[0], p[1] + 6); c.lineTo(p[0] - 4, p[1]); c.closePath(); c.fill();
        c.fillStyle = '#111'; c.fillRect(p[0] - 4, p[1] - 1, 8, 2);
      } else {
        c.fillStyle = '#e04adf';
        c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[0] + 9, p[1] - 5, p[0] + 13, p[1] - 12); c.quadraticCurveTo(p[0] + 4, p[1] - 9, p[0], p[1]); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(p[0], p[1], 2.2, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#e04adf'; c.lineWidth = 1.2; c.stroke();
      }
      if (labels) {
        var right = p[0] < w * 0.62;
        c.textAlign = right ? 'left' : 'right';
        var lx = p[0] + (right ? 10 : -10);
        c.font = '600 10.5px ui-sans-serif,system-ui,sans-serif'; c.fillStyle = '#f0e6ff';
        c.fillText(L.name, lx, p[1] + 13);
        c.font = '9.5px ui-monospace,Menlo,monospace'; c.fillStyle = '#e59be4';
        c.fillText(chartLabel(L), lx, p[1] + 25);
      }
    });

    // compass rose, in the most open corner
    var corners = [[2.6, 2.6], [21.4, 2.6], [2.6, 21.4], [21.4, 21.4]], cr = null;
    corners.forEach(function (q) { var sea = 0; for (var a = 0; a < 360; a += 20) if (!landAt(W, q[0] + Math.sin(a * RAD) * 2, q[1] + Math.cos(a * RAD) * 2)) sea++; if (!cr || sea > cr.sea) cr = { x: q[0], y: q[1], sea: sea }; });
    var rp = P(cr.x, cr.y), rr2 = 1.7 * sc;
    c.strokeStyle = 'rgba(224,74,223,.45)'; c.lineWidth = 1;
    c.beginPath(); c.arc(rp[0], rp[1], rr2, 0, Math.PI * 2); c.stroke();
    for (var a2 = 0; a2 < 360; a2 += 10) {
      var inn = a2 % 90 === 0 ? 0.72 : a2 % 30 === 0 ? 0.85 : 0.92;
      c.beginPath(); c.moveTo(rp[0] + Math.sin(a2 * RAD) * rr2 * inn, rp[1] - Math.cos(a2 * RAD) * rr2 * inn);
      c.lineTo(rp[0] + Math.sin(a2 * RAD) * rr2, rp[1] - Math.cos(a2 * RAD) * rr2); c.stroke();
    }
    c.fillStyle = 'rgba(224,74,223,.8)'; c.textAlign = 'center'; c.font = '600 10px ui-monospace,Menlo,monospace';
    c.fillText('N', rp[0], rp[1] - rr2 - 4);
    c.beginPath(); c.moveTo(rp[0], rp[1] - rr2 * 0.7); c.lineTo(rp[0] - 4, rp[1]); c.lineTo(rp[0] + 4, rp[1]); c.closePath(); c.fill();

    // scale bar
    c.fillStyle = 'rgba(232,237,245,.7)'; c.fillRect(10, w - 16, 2 * sc, 2);
    c.font = '9px ui-monospace,Menlo,monospace'; c.textAlign = 'left'; c.fillText('2 nm', 10, w - 22);

    // DR
    var dp = P(S.dr.x, S.dr.y);
    c.strokeStyle = 'rgba(232,237,245,.75)'; c.lineWidth = 1.3;
    c.beginPath(); c.arc(dp[0], dp[1], 6, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(dp[0], dp[1], 1.5, 0, Math.PI * 2); c.fillStyle = '#e8edf5'; c.fill();
    c.setLineDash([2, 4]); c.strokeStyle = 'rgba(232,237,245,.25)';
    c.beginPath(); c.arc(dp[0], dp[1], 2 * sc, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#e8edf5'; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'left';
    c.fillText('DR', dp[0] + 9, dp[1] - 6);

    // your fix
    if (S.fix) {
      var fp = P(S.fix.x, S.fix.y);
      c.strokeStyle = '#64f0c8'; c.lineWidth = 2;
      c.beginPath(); c.arc(fp[0], fp[1], 7, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(fp[0] - 11, fp[1]); c.lineTo(fp[0] + 11, fp[1]); c.moveTo(fp[0], fp[1] - 11); c.lineTo(fp[0], fp[1] + 11); c.stroke();
      c.fillStyle = '#64f0c8'; c.fillText('Fix', fp[0] + 12, fp[1] + 14);
    }
    // the truth
    if (S.revealed) {
      var sp = P(S.ship.x, S.ship.y);
      c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,243,207,.35)'; c.lineWidth = 1;
      W.lights.forEach(function (L, n) {
        if (S.sights[n].mode !== 'lamp') return;
        var lp = P(L.x, L.y); c.beginPath(); c.moveTo(sp[0], sp[1]); c.lineTo(lp[0], lp[1]); c.stroke();
      });
      c.setLineDash([]);
      c.fillStyle = '#ffce6a';
      c.beginPath();
      for (var k = 0; k < 10; k++) { var rad = k % 2 ? 3.5 : 9, an = k * Math.PI / 5; c[k ? 'lineTo' : 'moveTo'](sp[0] + Math.sin(an) * rad, sp[1] - Math.cos(an) * rad); }
      c.closePath(); c.fill();
      c.fillText('You were here', sp[0] + 11, sp[1] - 8);
      if (S.fix) { var fp2 = P(S.fix.x, S.fix.y); c.strokeStyle = 'rgba(255,206,106,.6)'; c.beginPath(); c.moveTo(fp2[0], fp2[1]); c.lineTo(sp[0], sp[1]); c.stroke(); }
    }
  }

  function crossings() {
    var W = S.W, lines = S.rows.filter(function (r) { return r.pick != null; }).map(function (r) {
      var L = W.lights[r.pick], b = r.brg * RAD;
      return { x: L.x, y: L.y, dx: Math.sin(b), dy: Math.cos(b) };
    });
    var out = [];
    for (var i = 0; i < lines.length; i++) for (var j = i + 1; j < lines.length; j++) {
      var a = lines[i], b = lines[j], den = a.dx * b.dy - a.dy * b.dx;
      if (Math.abs(den) < 0.05) continue;
      var t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / den;
      out.push({ x: a.x + a.dx * t, y: a.y + a.dy * t });
    }
    return out.length === 3 ? out : (out.length >= 3 ? out.slice(0, 3) : out);
  }

  /* ---------- the notebook ---------- */
  function notebook() {
    var W = S.W, box = $('book');
    var h = '<h4>Bearing book</h4>';
    if (!S.rows.length) h += '<p style="margin:0">Nothing taken yet. Click a light on the horizon, time it, then take a bearing. Then say which light on the chart you think it was.</p>';
    box.innerHTML = h;
    S.rows.forEach(function (row, n) {
      var d = document.createElement('div'); d.className = 'brg';
      var opts = '<option value="">— which light? —</option>' + W.lights.map(function (L) {
        return '<option value="' + L.id + '"' + (row.pick === L.id ? ' selected' : '') + '>' + esc(L.name) + ' · ' + esc(chartLabel(L)) + '</option>';
      }).join('');
      d.innerHTML = '<i style="background:' + row.colr + '"></i><b>' + brg3(row.brg) + '</b>' +
        (row.loom ? '<span title="Bearing on the loom, not the lamp">loom</span>' : '') +
        '<span>' + COLNAME[row.col] + '</span>' +
        '<select' + (S.revealed ? ' disabled' : '') + '>' + opts + '</select>' +
        (S.revealed ? (row.pick === row.trueId ? '<span style="color:#64f0c8">right</span>' : '<span style="color:#ff8a8a">was ' + esc(W.lights[row.trueId].name) + '</span>') : '<button type="button">strike</button>');
      var sel = d.querySelector('select');
      sel.addEventListener('change', function () { row.pick = sel.value === '' ? null : +sel.value; drawChart(); status(); });
      var bt = d.querySelector('button');
      if (bt) bt.addEventListener('click', function () { S.rows.splice(n, 1); notebook(); drawChart(); status(); });
      box.appendChild(d);
    });
    status();
  }

  function status() {
    var picked = S.rows.filter(function (r) { return r.pick != null; }).length, X = crossings(), msg;
    if (S.revealed) msg = 'Revealed. Move the boat or go to another night to try again.';
    else if (!S.rows.length) msg = 'You can see ' + S.sights.filter(function (s) { return s.mode === 'lamp'; }).length + ' lamps from here' + (S.sights.some(function (s) { return s.mode === 'loom'; }) ? ', and the loom of something else.' : '.');
    else if (picked < 2) msg = 'Two identified bearings give you a crossing. Three give you a check on it.';
    else if (X.length >= 3) {
      var sz = Math.max(Math.hypot(X[0].x - X[1].x, X[0].y - X[1].y), Math.hypot(X[1].x - X[2].x, X[1].y - X[2].y), Math.hypot(X[0].x - X[2].x, X[0].y - X[2].y));
      msg = 'Your cocked hat is ' + nm(sz) + ' across. ' + (sz < 0.3 ? 'That is a tight fix.' : sz < 1 ? 'Usable, but look again at one of them.' : 'Too big to trust. One of these bearings is probably on the wrong light.') + ' Click the chart to mark your fix.';
    } else msg = 'The lines cross. Click the chart where you think you are.';
    $('status').textContent = msg;
    $('btnReveal').disabled = !S.fix || S.revealed;
  }

  function verdict() {
    var v = $('verdict');
    if (!S.revealed) {
      v.className = 'verdict';
      v.innerHTML = 'Mark a fix on the chart, then reveal. Dead reckoning alone would put you <b>' + nm(Math.hypot(S.dr.x - S.ship.x, S.dr.y - S.ship.y)) + '</b> out, and on a coast like this, that is a long way.';
      return;
    }
    var err = Math.hypot(S.fix.x - S.ship.x, S.fix.y - S.ship.y);
    var wrong = S.rows.filter(function (r) { return r.pick != null && r.pick !== r.trueId; });
    var cls = err < 0.35 ? 'good' : err < 1 ? 'warn' : 'bad';
    var h = 'Your fix was <b>' + nm(err) + '</b> from where you really were';
    h += err < 0.35 ? '. Good enough to go in on.' : err < 1 ? '. Close, but not close enough for the harbour mouth in the dark.' : '. That is further out than you would want to be.';
    h += ' Dead reckoning was ' + nm(Math.hypot(S.dr.x - S.ship.x, S.dr.y - S.ship.y)) + ' out.';
    if (wrong.length) h += ' You plotted ' + wrong.map(function (r) { return 'the ' + brg3(r.brg) + ' bearing from ' + esc(S.W.lights[r.pick].name) + ' when it was ' + esc(S.W.lights[r.trueId].name); }).join(', and ') + '.';
    else if (S.rows.some(function (r) { return r.pick != null; })) h += ' Every light you plotted was the light you thought it was.';
    else if (S.rows.length) h += ' You took bearings but never said which lights they were, so none of them made it onto the chart.';
    if (S.hiddenList.length) h += ' Out of sight tonight: ' + esc(S.hiddenList.join('; ')) + '.';
    var hb = S.W.lights.filter(function (l) { return l.sector; })[0];
    if (hb) { var sc = sectorColour(hb, S.ship.x, S.ship.y); h += ' From here the harbour light at ' + esc(S.W.town) + (sc ? ' shows ' + COLNAME[sc] + '.' : ' is outside its sectors altogether.'); }
    v.className = 'verdict ' + cls; v.innerHTML = h;
    $('fHidden').textContent = S.hiddenList.length ? S.hiddenList.join('; ') : 'none';
  }

  /* ---------- input ---------- */
  function hzPos(e) { var r = hz.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  hz.addEventListener('pointermove', function (e) {
    var p = hzPos(e); S.hover = p.x / HZ.w * 360;
  });
  hz.addEventListener('pointerleave', function () { S.hover = null; });
  hz.addEventListener('pointerdown', function (e) {
    var p = hzPos(e), ppd = HZ.w / 360, best = -1, bd = 1e9;
    S.sights.forEach(function (s, n) {
      if (s.mode === 'none') return;
      var q = screenOf(n), dx = Math.abs(q.x - p.x); dx = Math.min(dx, HZ.w - dx);
      var dy = s.mode === 'loom' ? 0 : Math.abs(q.y - p.y) * 0.3;
      if (dx + dy < bd) { bd = dx + dy; best = n; }
    });
    if (best >= 0 && bd < Math.max(16, ppd * 5)) select(best);
  });
  function select(n) {
    S.sel = n;
    var s = S.sights[n];
    $('watchOut').textContent = 'Watching a ' + COLNAME[s.col] + ' ' + (s.mode === 'loom' ? 'loom' : 'light') + ' at about ' + brg3(screenOf(n).b) + '. Count the flashes, time the period.';
    $('btnBearing').disabled = S.revealed;
  }
  function takeBearing() {
    if (S.sel < 0 || S.revealed) return;
    var s = S.sights[S.sel], L = S.W.lights[S.sel];
    var trueB = az(S.ship.x, S.ship.y, L.x, L.y);
    var b = Math.round(n360(trueB + gauss(S.nr) * (s.mode === 'loom' ? 2.4 : 0.8))) % 360;
    S.rows.push({ brg: b, trueId: S.sel, pick: null, loom: s.mode === 'loom', col: s.col, colr: ROWCOL[S.rowSeq++ % ROWCOL.length] });
    notebook(); drawChart();
  }
  $('btnBearing').addEventListener('click', takeBearing);

  function chPos(e) { var r = ch.getBoundingClientRect(), sc = CH.w / SIZE; return { x: (e.clientX - r.left) / sc, y: SIZE - (e.clientY - r.top) / sc }; }
  ch.addEventListener('pointermove', function (e) {
    var p = chPos(e);
    $('chartOut').textContent = 'From the DR: ' + brg3(az(S.dr.x, S.dr.y, p.x, p.y)) + ', ' + nm(Math.hypot(p.x - S.dr.x, p.y - S.dr.y)) + (landAt(S.W, p.x, p.y) ? ' · that is dry land' : '');
  });
  ch.addEventListener('pointerdown', function (e) {
    if (S.revealed) return;
    S.fix = chPos(e); drawChart(); status();
  });
  $('btnReveal').addEventListener('click', function () {
    if (!S.fix) return;
    S.revealed = true; $('btnBearing').disabled = true;
    notebook(); drawChart(); verdict();
  });
  $('btnAnother').addEventListener('click', function () { S.pos++; load(); });
  $('rangeChk').addEventListener('change', drawChart);
  $('labelChk').addEventListener('change', drawChart);
  function goDay(d) { S.day = d; S.pos = 0; load(); }
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  document.addEventListener('keydown', function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') goDay(S.day - 1);
    else if (e.key === 'ArrowRight') goDay(S.day + 1);
    else if (e.key === 'b' || e.key === 'B') takeBearing();
    else if (e.key === 'n' || e.key === 'N') { S.pos++; load(); }
  });
  window.addEventListener('resize', resize);

  resize();
  load();
  requestAnimationFrame(frame);
})();
