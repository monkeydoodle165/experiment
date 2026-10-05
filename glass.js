/* drift.quibo.games — The Glass
   Weather. The day's number draws a stretch of sea and islands, divides it into named sea
   areas, and sends one or two depressions and perhaps an anticyclone across it. You get the
   bureau's chart for midday today and its forecast chart for midday tomorrow, isobars every
   four hectopascals, and a ruler. From the chart alone you write the wind part of the shipping
   forecast for every area: the direction (Buys Ballot: back to the wind, low pressure on your
   left) and the Beaufort force (from the spacing of the isobars through a geostrophic wind
   scale). The page then works out the real wind from the pressure field it drew, and reads
   both bulletins out side by side. Places and the bureau are invented. Self-contained. */
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
    var h = s ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- the chart and the physics ---------- */
  var W = 1600, H = 1200;          // km, east by south
  var CW = 800, CH = 600;          // canvas units; 2 km each
  var KM = 2;
  var LAT_TOP = 62, LAT_SPAN = 11; // the chart runs from 62°N down to 51°N
  var RHO = 1.25, OMEGA = 7.292e-5, KT = 1.94384, NMI = 1.852;
  var SURF = 0.7, BACK = 15;       // over the sea: 70% of geostrophic, backed 15 degrees toward the low
  var BF = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64]; // knots at which forces 1..12 begin
  var POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var POINTW = ['Northerly', 'Northeasterly', 'Easterly', 'Southeasterly', 'Southerly', 'Southwesterly', 'Westerly', 'Northwesterly'];
  var BFNAME = ['calm', 'light air', 'light breeze', 'gentle breeze', 'moderate breeze', 'fresh breeze', 'strong breeze', 'near gale', 'gale', 'severe gale', 'storm', 'violent storm', 'hurricane force'];
  function latAt(y) { return LAT_TOP - (y / H) * LAT_SPAN; }
  function cor(lat) { return 2 * OMEGA * Math.sin(lat * Math.PI / 180); }
  function beaufort(kt) { var f = 0; while (f < 12 && kt >= BF[f]) f++; return f; }
  function geoKt(hpaPerKm, lat) { return (hpaPerKm * 100 / 1000) / (RHO * cor(lat)) * KT; }
  function spacingFor4(hpaPerKm) { return 4 / hpaPerKm / NMI; } // nautical miles between 4 hPa isobars
  function point8(deg) { return Math.round(((deg % 360) + 360) % 360 / 45) % 8; }

  /* ---------- names ---------- */
  var AREAS = ['Skerrin', 'Brannock', 'Outer Morra', 'Tolsey', 'Gannet Bank', 'Wester Deep', 'Holm', 'Kittle', 'Sule Rise', 'Dunlin', 'Marram', 'Corrag', 'Selkie', 'Ardwell', 'Hesta', 'Fethan', 'Lorne Edge', 'Vaila', 'Rockall Deep', 'Tarbet', 'Inner Sound', 'Grimsay', 'Ness', 'Cullen'];
  var COAST = ['Isles of Hesketh', 'Morrow Islands', 'Brennack Archipelago', 'Western Holms', 'Selsey Skerries', 'Carrowmore Isles', 'Outer Tarns', 'Fenwick Isles'];
  var STATIONS = ['Halsund Light', 'Kirk Ness', 'Garth Head', 'Ullapen', 'Stornholm', 'Barra Mor', 'Lochend', 'Fair Skerry'];

  /* ---------- value noise for the coastline ---------- */
  function makeNoise(r) {
    var N = 64, g = new Float32Array(N * N);
    for (var i = 0; i < g.length; i++) g[i] = r();
    function lat(i, j) { return g[((j & (N - 1)) * N) + (i & (N - 1))]; }
    function sm(t) { return t * t * (3 - 2 * t); }
    function v(x, y) {
      var i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
      var a = lat(i, j), b = lat(i + 1, j), c = lat(i, j + 1), d = lat(i + 1, j + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }
    return function (x, y) { return v(x / 260, y / 260) * 0.6 + v(x / 110 + 17, y / 110 + 9) * 0.28 + v(x / 45 + 3, y / 45 + 31) * 0.12; };
  }

  /* ---------- the pressure field ---------- */
  function pressure(ev, x, y, t) {
    var p = ev.base + ev.gx * (x - W / 2) + ev.gy * (y - H / 2);
    for (var i = 0; i < ev.sys.length; i++) {
      var s = ev.sys[i], cx = s.x0 + s.vx * t, cy = s.y0 + s.vy * t, A = s.a0 + (s.a1 - s.a0) * t;
      var dx = x - cx, dy = y - cy;
      p += A * Math.exp(-(dx * dx + dy * dy) / (2 * s.sg * s.sg));
    }
    return p;
  }
  function grad(ev, x, y, t) {
    var h = 4;
    return { gx: (pressure(ev, x + h, y, t) - pressure(ev, x - h, y, t)) / (2 * h), gy: (pressure(ev, x, y + h, t) - pressure(ev, x, y - h, t)) / (2 * h) };
  }
  // the true wind at a point: geostrophic, then reduced and backed for the sea surface
  function windAt(ev, x, y, t) {
    var g = grad(ev, x, y, t), lat = latAt(y), f = cor(lat);
    var dpdE = g.gx, dpdN = -g.gy;                         // hPa per km, east and north
    var mag = Math.hypot(dpdE, dpdN);
    var k = 100 / 1000 / (RHO * f);                        // (hPa/km) -> m/s
    var u = -k * dpdN, v = k * dpdE;                        // geostrophic, m/s east and north
    var geo = Math.hypot(u, v) * KT;
    var b = BACK * Math.PI / 180, us = u * Math.cos(b) - v * Math.sin(b), vs = u * Math.sin(b) + v * Math.cos(b);
    var toward = (Math.atan2(us, vs) * 180 / Math.PI + 360) % 360;
    var from = (toward + 180) % 360;
    var isoDir = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360; // the way the isobars run, low on the left
    var kt = geo * SURF;
    return { from: from, pt: point8(from), kt: kt, geo: geo, force: beaufort(kt), spacing: mag > 1e-6 ? spacingFor4(mag) : Infinity, lat: lat, p: pressure(ev, x, y, t), iso: isoDir };
  }

  /* ---------- build the day ---------- */
  function build(seed) {
    var r = rng(seed);
    var noise = makeNoise(r);
    // land: threshold the noise so roughly a fifth of the chart is land, pushed away from the centre
    var GX = 160, GY = 120, field = new Float32Array((GX + 1) * (GY + 1)), vals = [];
    var bias = pick(r, ['east', 'north', 'south', 'scatter']);
    for (var j = 0; j <= GY; j++) for (var i = 0; i <= GX; i++) {
      var x = i * 10, y = j * 10, n = noise(x, y);
      if (bias === 'east') n += 0.18 * (x / W - 0.55);
      else if (bias === 'north') n += 0.18 * (0.45 - y / H);
      else if (bias === 'south') n += 0.18 * (y / H - 0.55);
      field[j * (GX + 1) + i] = n; vals.push(n);
    }
    vals.sort(function (a, b) { return a - b; });
    var thr = vals[Math.floor(vals.length * (0.78 + r() * 0.06))];
    function isLand(x, y) {
      var i = Math.max(0, Math.min(GX, Math.round(x / 10))), j = Math.max(0, Math.min(GY, Math.round(y / 10)));
      return field[j * (GX + 1) + i] > thr;
    }
    function nearLand(x, y, d) {
      for (var a = 0; a < 12; a++) { var an = a * Math.PI / 6; if (isLand(x + Math.cos(an) * d, y + Math.sin(an) * d)) return true; }
      return isLand(x, y);
    }
    // sea areas: reference points over open water, well spread
    var names = shuffle(r, AREAS), areas = [];
    for (var md = 330; md >= 220 && areas.length < 6; md -= 30) {
      areas = [];
      for (var tries = 0; tries < 900 && areas.length < 7; tries++) {
        var px = 110 + r() * (W - 220), py = 110 + r() * (H - 220);
        if (nearLand(px, py, 40)) continue;
        var ok = true;
        for (var k = 0; k < areas.length; k++) if (Math.hypot(areas[k].x - px, areas[k].y - py) < md) { ok = false; break; }
        if (ok) areas.push({ x: px, y: py });
      }
    }
    areas.forEach(function (a, i) { a.name = names[i]; });

    // weather: try until the day has some shape to it
    var ev = null;
    for (var attempt = 0; attempt < 60; attempt++) {
      var e = { base: 1012 + r() * 6, gx: (r() - 0.5) * 0.006, gy: (r() - 0.5) * 0.006, sys: [] };
      var nLow = r() < 0.55 ? 1 : 2;
      for (var l = 0; l < nLow; l++) {
        var hx = 250 + r() * 1100, hy = 200 + r() * 800;   // where it is at midday tomorrow
        var sp = 22 + r() * 26, hd = (-25 + r() * 55) * Math.PI / 180; // km/h, heading east-ish (screen y is south)
        var vx = Math.cos(hd) * sp * 24, vy = -Math.sin(hd) * sp * 24;
        var D = 11 + r() * 15;
        var deep = r() < 0.6;
        e.sys.push({ kind: 'L', x0: hx - vx, y0: hy - vy, vx: vx, vy: vy, a1: -D, a0: -D * (deep ? 0.6 + r() * 0.25 : 1.0 + r() * 0.2), sg: 320 + r() * 220 });
      }
      if (r() < 0.75) {
        var corner = pick(r, [[1700, 1250], [1750, 200], [-150, 1250], [800, 1450], [1500, 1400]]);
        var hvx = (r() - 0.5) * 300, hvy = (r() - 0.5) * 200;
        var HA = 10 + r() * 14;
        e.sys.push({ kind: 'H', x0: corner[0] - hvx, y0: corner[1] - hvy, vx: hvx, vy: hvy, a0: HA * (0.9 + r() * 0.2), a1: HA, sg: 600 + r() * 300 });
      }
      var forces = areas.map(function (a) { return windAt(e, a.x, a.y, 1).force; });
      var mx = Math.max.apply(null, forces), mn = Math.min.apply(null, forces);
      var pts = {}; areas.forEach(function (a) { var w = windAt(e, a.x, a.y, 1); if (w.force > 2) pts[w.pt] = 1; });
      ev = e;
      if (mx <= 10 && mx >= 5 && mx - mn >= 2 && Object.keys(pts).length >= 3) break;
    }

    // the truth, area by area, at midday tomorrow
    areas.forEach(function (a) { a.w = windAt(ev, a.x, a.y, 1); a.w0 = windAt(ev, a.x, a.y, 0); });

    return {
      seed: seed, areas: areas, ev: ev, isLand: isLand, field: field, GX: GX, GY: GY, thr: thr,
      region: pick(r, COAST), station: pick(r, STATIONS), issueNo: 100 + Math.floor(r() * 800)
    };
  }

  /* ---------- the words of a shipping forecast ---------- */
  function nearestArea(day, x, y) {
    var best = null, bd = 1e9;
    day.areas.forEach(function (a) { var d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } });
    return { a: best, d: bd };
  }
  function relPlace(day, x, y) {
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) {
      var side = x < 0 ? 'west' : x > W ? 'east' : y < 0 ? 'north' : 'south';
      return 'well to the ' + side + ' of the chart';
    }
    var n = nearestArea(day, x, y);
    if (n.d < 120) return n.a.name;
    var dx = x - n.a.x, dy = n.a.y - y, b = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    var dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return dirs[point8(b)] + ' of ' + n.a.name;
  }
  function synopsis(day) {
    var ev = day.ev, bits = [];
    ev.sys.forEach(function (s) {
      var p0 = Math.round(pressure(ev, s.x0, s.y0, 0)), p1 = Math.round(pressure(ev, s.x0 + s.vx, s.y0 + s.vy, 1));
      var trend;
      if (s.kind === 'L') trend = p1 < p0 - 8 ? 'deepening rapidly' : p1 < p0 - 2 ? 'deepening' : p1 > p0 + 2 ? 'filling' : 'changing little';
      else trend = p1 > p0 + 2 ? 'building' : p1 < p0 - 2 ? 'declining' : 'slow-moving';
      bits.push('<b>' + (s.kind === 'L' ? 'Low' : 'High') + '</b> ' + relPlace(day, s.x0, s.y0) + ', ' + p0 + ', ' + trend + ', expected ' +
        relPlace(day, s.x0 + s.vx, s.y0 + s.vy) + ' ' + p1 + ' by midday tomorrow.');
    });
    return bits.join(' ');
  }
  function weatherFor(day, a) {
    var ev = day.ev, w = a.w, near = 1e9, side = 0;
    ev.sys.forEach(function (s) {
      if (s.kind !== 'L') return;
      var cx = s.x0 + s.vx, cy = s.y0 + s.vy, d = Math.hypot(a.x - cx, a.y - cy) / s.sg;
      if (d < near) { near = d; side = a.x - cx; }
    });
    if (near < 1.0) return ['Rain', 'moderate or poor'];
    if (near < 2.0) return side > 0 ? ['Rain or drizzle', 'moderate, occasionally poor'] : ['Showers', 'good, occasionally moderate'];
    if (w.p > 1018) return ['Fair', 'good'];
    return ['Occasional rain', 'good, occasionally moderate'];
  }
  function seaState(f) { return ['Smooth', 'Smooth', 'Slight', 'Slight', 'Moderate', 'Rough', 'Rough or very rough', 'Very rough', 'High', 'Very high', 'Very high', 'Phenomenal', 'Phenomenal'][f]; }
  function windWords(pt, f) {
    if (pt === 'V') return 'Variable ' + Math.max(1, f);
    var name = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][pt];
    var tail = f >= 8 ? ', ' + ['', '', '', '', '', '', '', '', 'gale 8', 'severe gale 9', 'storm 10', 'violent storm 11', 'hurricane force 12'][f] : ' ' + f;
    return f <= 2 ? 'Variable ' + Math.max(1, f) : name + tail;
  }
  function bulletin(day, getWind, withWeather) {
    var gales = [], lines = [];
    day.areas.forEach(function (a, i) {
      var w = getWind(a, i); if (!w) return;
      if (w.force >= 8) gales.push(a.name);
      var wx = weatherFor(day, a);
      lines.push(a.name + '. ' + windWords(w.pt, w.force) + '. ' + seaState(w.force) + '.' + (withWeather ? ' ' + wx[0] + '. ' + wx[1].charAt(0).toUpperCase() + wx[1].slice(1) + '.' : ''));
    });
    var head = gales.length ? 'There are warnings of gales in ' + listJoin(gales) + '.\n\n' : 'No gale warnings.\n\n';
    return head + lines.join('\n');
  }
  function listJoin(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  /* ---------- marching squares ---------- */
  function contour(get, nx, ny, step, level) {
    var segs = [];
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var a = get(i, j), b = get(i + 1, j), c = get(i + 1, j + 1), d = get(i, j + 1);
      var idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      var x0 = i * step, y0 = j * step;
      var T = [x0 + step * (level - a) / (b - a), y0], R = [x0 + step, y0 + step * (level - b) / (c - b)];
      var B = [x0 + step * (level - d) / (c - d), y0 + step], L = [x0, y0 + step * (level - a) / (d - a)];
      switch (idx) {
        case 1: case 14: segs.push([L, B]); break;
        case 2: case 13: segs.push([B, R]); break;
        case 3: case 12: segs.push([L, R]); break;
        case 4: case 11: segs.push([T, R]); break;
        case 5: segs.push([L, T], [B, R]); break;
        case 6: case 9: segs.push([T, B]); break;
        case 7: case 8: segs.push([L, T]); break;
        case 10: segs.push([T, R], [L, B]); break;
      }
    }
    return segs;
  }

  /* ---------- state ---------- */
  var S = { day: 0, D: null, t: 1, ruler: null, drag: false, user: [], filed: false, base: null };
  var cv = $('chart'), ctx = cv.getContext('2d');

  function renderBase() {
    var D = S.D, off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    var c = off.getContext('2d'), img = c.createImageData(CW, CH), px = img.data;
    // nearest-area index for every 2 px cell, so the boundaries can be drawn
    var owner = new Int8Array(CW * CH);
    for (var y = 0; y < CH; y++) for (var x = 0; x < CW; x++) {
      var kx = x * KM, ky = y * KM, land = D.isLand(kx, ky), o = (y * CW + x) * 4;
      if (land) { px[o] = 222; px[o + 1] = 211; px[o + 2] = 178; }
      else { px[o] = 230; px[o + 1] = 239; px[o + 2] = 243; }
      px[o + 3] = 255;
      if ((x & 1) === 0 && (y & 1) === 0) {
        var bi = 0, bd = 1e12;
        for (var a = 0; a < D.areas.length; a++) { var dd = (D.areas[a].x - kx) * (D.areas[a].x - kx) + (D.areas[a].y - ky) * (D.areas[a].y - ky); if (dd < bd) { bd = dd; bi = a; } }
        owner[y * CW + x] = bi;
      }
    }
    // area boundaries: a dotted line over the sea
    for (var y2 = 0; y2 < CH - 2; y2 += 2) for (var x2 = 0; x2 < CW - 2; x2 += 2) {
      var me = owner[y2 * CW + x2];
      if ((owner[y2 * CW + x2 + 2] !== me || owner[(y2 + 2) * CW + x2] !== me) && ((x2 + y2) % 8 < 4) && !D.isLand(x2 * KM, y2 * KM)) {
        for (var q = 0; q < 2; q++) for (var p2 = 0; p2 < 2; p2++) { var o2 = ((y2 + q) * CW + x2 + p2) * 4; px[o2] = 112; px[o2 + 1] = 140; px[o2 + 2] = 162; }
      }
    }
    c.putImageData(img, 0, 0);
    // coastline
    c.strokeStyle = '#8a7a52'; c.lineWidth = 1;
    var segs = contour(function (i, j) { return D.field[j * (D.GX + 1) + i]; }, D.GX, D.GY, 5, D.thr);
    c.beginPath(); segs.forEach(function (s) { c.moveTo(s[0][0], s[0][1]); c.lineTo(s[1][0], s[1][1]); }); c.stroke();
    // graticule
    c.strokeStyle = 'rgba(60,80,100,.18)'; c.fillStyle = 'rgba(60,80,100,.55)'; c.font = '9px ui-monospace,Menlo,monospace';
    for (var lat = 52; lat <= 61; lat += 3) {
      var yy = (LAT_TOP - lat) / LAT_SPAN * H / KM;
      c.beginPath(); c.moveTo(0, yy); c.lineTo(CW, yy); c.stroke();
      c.fillText(lat + '°N', 4, yy - 3);
    }
    S.base = off;
  }

  function sizeCanvas() {
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || CW;
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * CH / CW * dpr);
    ctx.setTransform(cv.width / CW, 0, 0, cv.height / CH, 0, 0);
  }

  function draw() {
    var D = S.D, ev = D.ev, t = S.t;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(S.base, 0, 0, CW, CH);
    // pressure grid every 10 px (20 km)
    var nx = 80, ny = 60, P = new Float32Array((nx + 1) * (ny + 1)), lo = 1e9, hi = -1e9;
    for (var j = 0; j <= ny; j++) for (var i = 0; i <= nx; i++) {
      var v = pressure(ev, i * 20, j * 20, t); P[j * (nx + 1) + i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    var get = function (i, j) { return P[j * (nx + 1) + i]; };
    var labels = [];
    ctx.lineJoin = 'round';
    for (var L = Math.ceil(lo / 4) * 4; L <= hi; L += 4) {
      var segs = contour(get, nx, ny, 10, L);
      ctx.strokeStyle = '#262b36'; ctx.lineWidth = L % 8 === 0 ? 1.5 : 1.1;
      ctx.beginPath(); segs.forEach(function (s) { ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); }); ctx.stroke();
      var placed = 0;
      for (var k = 0; k < segs.length && placed < 2; k += 7) {
        var mx = (segs[k][0][0] + segs[k][1][0]) / 2, my = (segs[k][0][1] + segs[k][1][1]) / 2;
        if (mx < 30 || mx > CW - 30 || my < 18 || my > CH - 14) continue;
        var clash = false;
        for (var m = 0; m < labels.length; m++) if (Math.hypot(labels[m][0] - mx, labels[m][1] - my) < 120) { clash = true; break; }
        if (clash) continue;
        labels.push([mx, my, L]); placed++;
      }
    }
    ctx.font = 'bold 10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    labels.forEach(function (l) {
      var s = String(l[2]), w = ctx.measureText(s).width + 6;
      ctx.fillStyle = 'rgba(236,241,244,.95)'; ctx.fillRect(l[0] - w / 2, l[1] - 7, w, 14);
      ctx.fillStyle = '#262b36'; ctx.fillText(s, l[0], l[1]);
    });
    // centres, and tracks on the forecast chart
    ev.sys.forEach(function (s) {
      var cx = (s.x0 + s.vx * t) / KM, cy = (s.y0 + s.vy * t) / KM;
      if (s.kind === 'L') {
        ctx.strokeStyle = 'rgba(200,60,70,.7)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(s.x0 / KM, s.y0 / KM); ctx.lineTo((s.x0 + s.vx) / KM, (s.y0 + s.vy) / KM); ctx.stroke(); ctx.setLineDash([]);
      }
      if (cx < 10 || cx > CW - 10 || cy < 10 || cy > CH - 10) return;
      var pv = Math.round(pressure(ev, s.x0 + s.vx * t, s.y0 + s.vy * t, t));
      ctx.fillStyle = s.kind === 'L' ? '#c43c46' : '#2f5fbf';
      ctx.font = 'bold 22px ui-sans-serif,Helvetica,Arial,sans-serif'; ctx.fillText(s.kind, cx, cy - 6);
      ctx.font = 'bold 11px ui-monospace,Menlo,monospace'; ctx.fillText(pv, cx, cy + 12);
    });
    // areas
    D.areas.forEach(function (a, i) {
      var x = a.x / KM, y = a.y / KM;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3d5566'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = 'italic 600 12px Georgia,serif'; ctx.fillStyle = '#2f4a5c'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(230,239,243,.9)';
      ctx.strokeText(a.name, x, y - 14); ctx.fillText(a.name, x, y - 14);
      if (S.filed && t === 1) barb(x, y, a.w, verdictColour(i));
    });
    // ruler
    if (S.ruler) {
      var R = S.ruler, len = Math.hypot(R.x1 - R.x0, R.y1 - R.y0) * KM / NMI;
      ctx.strokeStyle = '#d9506c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(R.x0, R.y0); ctx.lineTo(R.x1, R.y1); ctx.stroke();
      [[R.x0, R.y0], [R.x1, R.y1]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fillStyle = '#d9506c'; ctx.fill(); });
      var mx2 = (R.x0 + R.x1) / 2, my2 = (R.y0 + R.y1) / 2, txt = Math.round(len) + ' nmi';
      ctx.font = 'bold 11px ui-monospace,Menlo,monospace'; var tw = ctx.measureText(txt).width + 8;
      ctx.fillStyle = '#d9506c'; ctx.fillRect(mx2 + 8, my2 - 18, tw, 15);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(txt, mx2 + 12, my2 - 10);
    }
    ctx.textAlign = 'left'; ctx.font = 'bold 10px ui-monospace,Menlo,monospace'; ctx.fillStyle = 'rgba(38,43,54,.75)';
    ctx.fillText(t === 1 ? 'FORECAST CHART · VALID 1200 TOMORROW · ISOBARS EVERY 4 hPa' : 'ANALYSIS · 1200 TODAY · ISOBARS EVERY 4 hPa', 8, CH - 10);
    // scale bar: 100 nmi
    var sb = 100 * NMI / KM;
    ctx.strokeStyle = '#262b36'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(CW - 14 - sb, CH - 14); ctx.lineTo(CW - 14, CH - 14);
    ctx.moveTo(CW - 14 - sb, CH - 18); ctx.lineTo(CW - 14 - sb, CH - 10); ctx.moveTo(CW - 14, CH - 18); ctx.lineTo(CW - 14, CH - 10); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText('100 nmi', CW - 14 - sb / 2, CH - 24);
  }

  // a wind barb: shaft pointing into the wind, feathers for every ten knots, pennant for fifty
  function barb(x, y, w, col) {
    var th = w.from * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th), L = 36;
    var ex = x + dx * L, ey = y + dy * L, nx = -dy, ny = dx; // feathers to the right of the shaft looking downwind
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    var kt = Math.round(w.kt / 5) * 5, pos = 0;
    function at(d) { return [ex - dx * d, ey - dy * d]; }
    while (kt >= 50) { var a = at(pos), b = at(pos + 7); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + nx * 14, a[1] + ny * 14); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); pos += 9; kt -= 50; }
    while (kt >= 10) { var c = at(pos); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + nx * 13 + dx * 4, c[1] + ny * 13 + dy * 4); ctx.stroke(); pos += 5; kt -= 10; }
    if (kt >= 5) { if (pos === 0) pos = 5; var e = at(pos); ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[0] + nx * 7 + dx * 2, e[1] + ny * 7 + dy * 2); ctx.stroke(); }
  }

  /* ---------- grading ---------- */
  function judge(i) {
    var a = S.D.areas[i], u = S.user[i], w = a.w;
    if (!u || u.pt === null || u.force === null) return null;
    var dOK, dExact;
    if (w.force <= 2) { dOK = true; dExact = true; }
    else if (u.pt === 'V') { dOK = false; dExact = false; }
    else { var dd = Math.abs(u.pt - w.pt) % 8; dd = Math.min(dd, 8 - dd); dExact = dd === 0; dOK = dd <= 1; }
    var fd = u.force - w.force;
    return { dOK: dOK, dExact: dExact, fOK: Math.abs(fd) <= 1, fExact: fd === 0, fd: fd };
  }
  function verdictColour(i) {
    var j = judge(i);
    if (!j) return '#262b36';
    if (j.dOK && j.fOK) return j.dExact && j.fExact ? '#1e9c78' : '#2f7a5e';
    if (j.dOK || j.fOK) return '#c98a12';
    return '#c43c46';
  }
  function explain(i) {
    var a = S.D.areas[i], w = a.w, u = S.user[i], j = judge(i), out = [];
    var isoTo = POINTS[point8(w.iso)];
    out.push('Isobars here run toward the ' + isoTo + ' with low pressure on the left, ' + (isFinite(w.spacing) ? Math.round(w.spacing) + ' nmi between 4 hPa lines' : 'with almost no gradient') +
      ' at ' + w.lat.toFixed(1) + '°N. That is a geostrophic ' + Math.round(w.geo) + ' kt; at the surface about ' + Math.round(w.kt) + ' kt from ' + Math.round(w.from) + '°, force ' + w.force + ' (' + BFNAME[w.force] + ').');
    if (!j.dOK) {
      if (u.pt === 'V') out.push('It is not light enough to call variable.');
      else {
        var dd = ((u.pt - w.pt) % 8 + 8) % 8, d2 = Math.min(dd, 8 - dd);
        if (d2 === 4) out.push('Your direction is the wrong way round: stand with your back to the wind and the low is on your left. Wind blows out of the place you named into it.');
        else if (d2 >= 2) out.push('Your direction cuts across the isobars. The wind follows them, turned in only a little toward the low.');
      }
    }
    if (!j.fOK) {
      if (j.fd > 0) out.push('Too strong by ' + j.fd + ': the isobars are further apart than you measured, or the reading came from a tighter part of the chart.');
      else out.push('Too light by ' + (-j.fd) + ': the isobars are closer than you measured. Measure square across them, at the area\'s point, between two neighbouring lines.');
    }
    return out.join(' ');
  }

  /* ---------- UI ---------- */
  function renderForm() {
    var D = S.D;
    var dirOpts = '<option value="">—</option><option value="V">Variable</option>' + POINTS.map(function (p, i) { return '<option value="' + i + '">' + POINTW[i] + '</option>'; }).join('');
    var fOpts = '<option value="">—</option>' + BFNAME.map(function (n, i) { return '<option value="' + i + '">' + i + ' · ' + n + '</option>'; }).join('');
    var h = '<table class="book"><thead><tr><th>Sea area</th><th>Lat</th><th>Wind direction</th><th>Force</th><th id="thRes"></th></tr></thead><tbody>';
    D.areas.forEach(function (a, i) {
      h += '<tr><td><b>' + esc(a.name) + '</b></td><td>' + a.w.lat.toFixed(1) + '°N</td>' +
        '<td><select data-i="' + i + '" data-k="pt" aria-label="Wind direction for ' + esc(a.name) + '">' + dirOpts + '</select></td>' +
        '<td><select data-i="' + i + '" data-k="force" aria-label="Beaufort force for ' + esc(a.name) + '">' + fOpts + '</select></td><td class="res" id="res' + i + '"></td></tr>';
    });
    h += '</tbody></table>';
    $('form').innerHTML = h;
    $('form').querySelectorAll('select').forEach(function (s) {
      var i = +s.dataset.i, k = s.dataset.k, u = S.user[i];
      var cur = u[k]; if (cur !== null) s.value = String(cur);
      s.addEventListener('change', function () {
        var v = s.value; u[k] = v === '' ? null : (v === 'V' ? 'V' : +v);
      });
    });
  }

  function renderScale() {
    var cols = [40, 50, 60, 75, 90, 110, 130, 160, 200, 260, 340], lats = [53, 57, 61];
    var hi = null, hiLat = null;
    if (S.ruler) {
      var len = Math.hypot(S.ruler.x1 - S.ruler.x0, S.ruler.y1 - S.ruler.y0) * KM / NMI;
      var best = 1e9; cols.forEach(function (c, i) { var d = Math.abs(Math.log(c / Math.max(1, len))); if (d < best) { best = d; hi = i; } });
      var lat = latAt((S.ruler.y0 + S.ruler.y1) / 2 * KM); var bl = 1e9; lats.forEach(function (l, i) { if (Math.abs(l - lat) < bl) { bl = Math.abs(l - lat); hiLat = i; } });
    }
    var h = '<table class="book scale"><thead><tr><th>4 hPa every</th>' + cols.map(function (c, i) { return '<th' + (i === hi ? ' class="hl"' : '') + '>' + c + ' nmi</th>'; }).join('') + '</tr></thead><tbody>';
    lats.forEach(function (l, li) {
      h += '<tr' + (li === hiLat ? ' class="hlr"' : '') + '><td>' + l + '°N</td>' + cols.map(function (c, i) {
        var g = 4 / (c * NMI), kt = geoKt(g, l) * SURF;
        return '<td' + (i === hi && li === hiLat ? ' class="hl hit"' : i === hi ? ' class="hl"' : '') + '><b>F' + beaufort(kt) + '</b><span>' + Math.round(kt) + ' kt</span></td>';
      }).join('') + '</tr>';
    });
    h += '</tbody></table>';
    $('scale').innerHTML = h;
    $('rulerOut').textContent = S.ruler ? 'Ruler: ' + Math.round(Math.hypot(S.ruler.x1 - S.ruler.x0, S.ruler.y1 - S.ruler.y0) * KM / NMI) + ' nautical miles, at ' + latAt((S.ruler.y0 + S.ruler.y1) / 2 * KM).toFixed(1) + '°N.' : 'Drag across the chart to measure.';
  }

  function renderTimes() {
    var opts = [[0, 'Analysis, midday today'], [1, 'Forecast chart, midday tomorrow']];
    $('times').innerHTML = opts.map(function (o) { return '<button type="button" class="chip' + (S.t === o[0] ? ' on' : '') + '" data-t="' + o[0] + '">' + o[1] + '</button>'; }).join('');
    $('times').querySelectorAll('.chip').forEach(function (b) { b.addEventListener('click', function () { S.t = +b.dataset.t; renderTimes(); draw(); }); });
  }

  function fileReport() {
    var D = S.D, missing = [];
    D.areas.forEach(function (a, i) { var u = S.user[i]; if (u.pt === null || u.force === null) missing.push(a.name); });
    var rep = $('report');
    if (missing.length) { rep.className = 'verdict warn'; rep.innerHTML = 'The bulletin is not complete. Still to write: <b>' + esc(listJoin(missing)) + '</b>.'; return; }
    S.filed = true; S.t = 1; renderTimes();
    var good = 0, exact = 0;
    D.areas.forEach(function (a, i) {
      var j = judge(i), cell = $('res' + i);
      var ok = j.dOK && j.fOK; if (ok) good++; if (ok && j.dExact && j.fExact) exact++;
      cell.innerHTML = '<span class="tick ' + (ok ? 'y' : (j.dOK || j.fOK) ? 'm' : 'n') + '">' + (ok ? (j.dExact && j.fExact ? 'spot on' : 'within') : 'out') + '</span>';
    });
    var n = D.areas.length;
    rep.className = 'verdict ' + (good === n ? 'good' : good >= n - 2 ? '' : 'warn');
    var head = good === n ? '<b>A clean bulletin.</b> Every area within one point of direction and one force of the truth' + (exact ? ', ' + exact + ' of them exactly' : '') + '.'
      : '<b>' + good + ' of ' + n + ' areas</b> within one point and one force' + (exact ? ' (' + exact + ' exactly right)' : '') + '.';
    var per = D.areas.map(function (a, i) {
      var j = judge(i), u = S.user[i];
      var said = (u.pt === 'V' ? 'Variable' : POINTW[u.pt]) + ' ' + u.force;
      return '<li><b>' + esc(a.name) + '</b>: you said ' + said + '; the chart says ' + (a.w.force <= 2 ? 'variable' : POINTW[a.w.pt].toLowerCase()) + ' ' + a.w.force + '. ' + esc(explain(i)) + '</li>';
    }).join('');
    rep.innerHTML = head + ' The true winds are now drawn on the forecast chart as barbs (a long feather is ten knots, a short one five, a flag fifty), coloured by how close you were.<ul class="per">' + per + '</ul>';
    $('bulls').innerHTML = '<div><h3>Your bulletin</h3><pre class="bull">' + esc(bulletin(D, function (a, i) { var u = S.user[i]; return { pt: u.pt === 'V' ? 'V' : u.pt, force: u.force }; }, true)) + '</pre></div>' +
      '<div><h3>The bureau\'s</h3><pre class="bull">' + esc(bulletin(D, function (a) { return { pt: a.w.pt, force: a.w.force }; }, true)) + '</pre></div>';
    draw();
  }

  function load() {
    var d = dateFor(S.day), tm = dateFor(S.day + 1);
    S.D = build(seedForDate(d));
    S.t = 1; S.ruler = null; S.filed = false;
    S.user = S.D.areas.map(function () { return { pt: null, force: null }; });
    $('plWho').textContent = S.D.region + ' Marine Bureau · issue ' + S.D.issueNo;
    $('plName').textContent = 'Shipping forecast for the ' + S.D.region + ', valid 1200 ' + longDate(tm);
    $('plBlurb').innerHTML = 'General synopsis at midday today: ' + synopsis(S.D) + ' The forecast desk at ' + esc(S.D.station) + ' has drawn the chart. The words are yours.';
    $('dayOut').textContent = (S.day === 0 ? 'Today, ' : S.day === -1 ? 'Yesterday, ' : S.day === 1 ? 'Tomorrow, ' : '') + longDate(d);
    $('report').className = 'verdict'; $('report').innerHTML = ''; $('bulls').innerHTML = '';
    renderTimes(); renderForm(); renderScale(); renderBase(); sizeCanvas(); draw();
  }
  function goDay(n) { S.day = n; load(); }

  /* ---------- the ruler ---------- */
  function toChart(ev) {
    var r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * CW, y: (ev.clientY - r.top) / r.height * CH };
  }
  cv.addEventListener('pointerdown', function (ev) {
    var p = toChart(ev); S.ruler = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; S.drag = true;
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    draw(); ev.preventDefault();
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!S.drag) return; var p = toChart(ev); S.ruler.x1 = p.x; S.ruler.y1 = p.y; draw(); renderScale();
  });
  function endDrag() {
    if (!S.drag) return; S.drag = false;
    if (S.ruler && Math.hypot(S.ruler.x1 - S.ruler.x0, S.ruler.y1 - S.ruler.y0) < 3) S.ruler = null;
    draw(); renderScale();
  }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  $('btnClearRuler').addEventListener('click', function () { S.ruler = null; draw(); renderScale(); });
  $('btnFile').addEventListener('click', fileReport);
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  document.addEventListener('keydown', function (ev) {
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || tg === 'BUTTON') return;
    if (ev.key === 'ArrowLeft') goDay(S.day - 1);
    else if (ev.key === 'ArrowRight') goDay(S.day + 1);
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { sizeCanvas(); draw(); }, 120); });

  // exposed for testing only
  window.__glass = { build: build, windAt: windAt, pressure: pressure, S: S, fileReport: fileReport, judge: judge, bulletin: bulletin, seedForDate: seedForDate };

  load();
})();
