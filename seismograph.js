/* drift.quibo.games — The Seismograph
   Location. The day's number sets off a small earthquake somewhere under an invented stretch
   of country and lets three or four stations of a seismic network record it. You pick the P
   and S arrivals and the largest swing on each record. The S minus P interval gives a
   distance (eight kilometres for every second, in this crust), each distance draws a circle
   round its station, and the circles meet over the epicentre. The amplitude and the interval
   together give a Richter local magnitude, read off a nomogram drawn by the same code.
   Places, stations and the agency are invented. Self-contained. */
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
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function log10(x) { return Math.log(x) / Math.LN10; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function clock(s, dec) {
    s = ((s % 86400) + 86400) % 86400;
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var ss = dec ? (sec < 10 ? '0' : '') + sec.toFixed(1) : pad2(Math.floor(sec + 1e-6));
    return pad2(h) + ':' + pad2(m) + ':' + ss;
  }
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- the physics, such as it is ---------- */
  var VP = 6.0;                 // km/s, upper crust
  var VS = 1 / (1 / VP + 1 / 8); // chosen so that distance = 8 x (S - P) exactly (about 3.43 km/s)
  var KM_PER_S = 8;
  var BOX = 320;                // the map is 320 km on a side
  var FS = 20;                  // samples per second on the records
  var COLS = ['#2bb894', '#4f7de0', '#d99a1e', '#d9506c'];
  var MAPCOLS = ['#64f0c8', '#7aa2ff', '#ffce6a', '#ff8fa3'];
  function richter(A, dt) { return log10(A) + 3 * log10(KM_PER_S * dt) - 2.92; }

  /* ---------- names ---------- */
  var RP = ['Carrow', 'Halden', 'Brennock', 'Ystrad', 'Morvale', 'Kessock', 'Tarn', 'Elmet', 'Dunmere', 'Penhallow', 'Corrie', 'Askern', 'Wenlow', 'Rhoscoll', 'Garth', 'Ellerby'];
  var RK = ['Vale', 'Basin', 'Uplands', 'Fells', 'Marches', 'Peninsula', 'Downs', 'Moors'];
  var TP = ['Ard', 'Bal', 'Car', 'Dun', 'Ell', 'Fen', 'Glen', 'Hal', 'Inver', 'Kil', 'Lan', 'Mor', 'Nor', 'Pen', 'Ros', 'Tre', 'Wes', 'Ash', 'Brad', 'Cal', 'Sel', 'Thorn', 'Ux', 'Yar'];
  var TS = ['ley', 'more', 'ford', 'by', 'wick', 'ton', 'ock', 'den', 'holm', 'well', 'combe', 'field', 'gate', 'ness', 'thwaite', 'stow', 'bridge', 'mouth'];
  function code(name, used) {
    var up = name.toUpperCase().replace(/[^A-Z]/g, ''), cons = up[0] + up.slice(1).replace(/[AEIOU]/g, '');
    var tries = [cons.slice(0, 3), up.slice(0, 3), up[0] + cons.slice(-2), up.slice(0, 2) + up.slice(-1), up.slice(0, 4)];
    for (var i = 0; i < tries.length; i++) if (tries[i].length >= 3 && !used[tries[i]]) { used[tries[i]] = 1; return tries[i]; }
    var c = up.slice(0, 3) + Object.keys(used).length; used[c] = 1; return c;
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function inPoly(p, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > p.y) !== (b[1] > p.y) && p.x < (b[0] - a[0]) * (p.y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function bearing(from, to) {
    var dx = to.x - from.x, dy = from.y - to.y; // y grows southward on the map
    var a = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8];
  }

  /* ---------- build the day ---------- */
  function build(off) {
    var d = dateFor(off), r = rng(seedForDate(d) ^ 0x53454953);
    var region = pick(r, RP), kind = pick(r, RK);
    var ev = { date: d, region: 'the ' + region + ' ' + kind, agency: region + ' Seismological Service' };

    // land: a lumpy blob, offset so that some edge of the map is usually sea
    var cx = BOX / 2 + (r() - 0.5) * 120, cy = BOX / 2 + (r() - 0.5) * 120, land = [];
    var ph = [r() * 6.3, r() * 6.3, r() * 6.3], am = [18 + r() * 20, 10 + r() * 14, 6 + r() * 8];
    for (var k = 0; k < 72; k++) {
      var th = k / 72 * Math.PI * 2;
      var rad = 225 + am[0] * Math.sin(2 * th + ph[0]) + am[1] * Math.sin(5 * th + ph[1]) + am[2] * Math.sin(11 * th + ph[2]);
      land.push([cx + Math.cos(th) * rad, cy + Math.sin(th) * rad]);
    }
    ev.land = land;

    // stations, well spread and on land; the epicentre somewhere among them
    var n = r() < 0.35 ? 4 : 3, st, epi, ok = false, guard = 0;
    while (!ok && guard++ < 400) {
      st = [];
      var g2 = 0;
      while (st.length < n && g2++ < 600) {
        var p = { x: 22 + r() * (BOX - 44), y: 22 + r() * (BOX - 44) };
        if (!inPoly(p, land)) continue;
        if (st.some(function (s) { return dist(s, p) < 95; })) continue;
        st.push(p);
      }
      if (st.length < n) continue;
      epi = { x: 40 + r() * (BOX - 80), y: 40 + r() * (BOX - 80) };
      if (st.some(function (s) { return dist(s, epi) < 28; })) continue;
      // reject near-collinear networks: the circles would meet at a glancing angle
      var a = st[0], b = st[1], c = st[2];
      var area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
      if (area < 6000) continue;
      ok = true;
    }
    var usedN = {}, usedC = {};
    function townName() { var t; do { t = pick(r, TP) + pick(r, TS); } while (usedN[t]); usedN[t] = 1; return t; }
    ev.stations = st.map(function (s, i) {
      var nm = townName();
      return { x: s.x, y: s.y, town: nm, code: code(nm, usedC), col: COLS[i], mcol: MAPCOLS[i] };
    });
    ev.towns = [];
    for (var t = 0, g3 = 0; t < 7 && g3 < 400; g3++) {
      var q = { x: 15 + r() * (BOX - 30), y: 15 + r() * (BOX - 30) };
      if (!inPoly(q, land)) continue;
      if (ev.stations.concat(ev.towns).some(function (s) { return dist(s, q) < 40; })) continue;
      q.name = townName(); ev.towns.push(q); t++;
    }
    ev.epi = epi;
    ev.ml = Math.round((2.8 + r() * 1.9) * 10) / 10;
    ev.depth = Math.round(5 + r() * 9);
    ev.t0 = Math.floor(r() * 86400 * 10) / 10;

    // nearest settlement, for the bulletin
    var all = ev.stations.map(function (s) { return { x: s.x, y: s.y, name: s.town }; }).concat(ev.towns);
    all.sort(function (p1, p2) { return dist(p1, epi) - dist(p2, epi); });
    ev.near = all[0];

    // the records
    ev.stations.forEach(function (s, i) {
      var rs = rng((seedForDate(d) ^ 0x7357) + Math.imul(i + 1, 0x9e3779b1));
      s.d = dist(s, epi);
      s.tP = s.d / VP; s.tS = s.d / VS; s.dt = s.tS - s.tP;
      s.A = Math.pow(10, ev.ml - 3 * log10(KM_PER_S * s.dt) + 2.92) * Math.pow(10, (rs() - 0.5) * 0.22);
      s.ws = Math.floor(s.tP - 7 - rs() * 5);
      s.W = Math.ceil((s.tS - s.ws + 34 + rs() * 8) / 10) * 10;
      synth(s, rs);
    });
    return ev;
  }

  function carrier(rs, fLo, fHi, nWaves) {
    var w = [];
    for (var i = 0; i < nWaves; i++) w.push({ f: fLo + rs() * (fHi - fLo), p: rs() * 6.283, a: 0.5 + rs() });
    var tot = w.reduce(function (s, x) { return s + x.a; }, 0);
    return function (t) { var v = 0; for (var i = 0; i < w.length; i++) v += w[i].a * Math.sin(6.283 * w[i].f * t + w[i].p); return v / tot * 1.6; };
  }
  function synth(s, rs) {
    var N = s.W * FS, x = new Float32Array(N);
    var cP = carrier(rs, 2.2, 7.5, 5), cS = carrier(rs, 0.9, 3.6, 6), cC = carrier(rs, 0.6, 2.2, 5);
    var micro = carrier(rs, 0.12, 0.3, 3);
    var aP = 0.13 + rs() * 0.13, noise = 0.012 + rs() * 0.014, mic = 0.01 + rs() * 0.015;
    var tauP = 2.5 + s.dt * 0.12, tauS = 5 + s.dt * 0.22, sign = rs() < 0.5 ? -1 : 1;
    // white noise via a cheap Box-Muller
    function gauss() { var u = rs() || 1e-9, v = rs(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283 * v); }
    for (var i = 0; i < N; i++) {
      var t = s.ws + i / FS, v = noise * gauss() + mic * micro(t);
      if (t >= s.tP) {
        var u = t - s.tP;
        var eP = (1 - Math.exp(-u / 0.12)) * Math.exp(-u / tauP);
        var floor = t < s.tS ? 0.28 : 0.28 * Math.exp(-(t - s.tS) / 4);
        v += aP * Math.max(eP, floor * Math.exp(-u / (tauP * 6))) * cP(t);
        v += sign * aP * 1.5 * Math.exp(-Math.pow((u - 0.1) / 0.09, 2));
      }
      if (t >= s.tS) {
        var w = t - s.tS;
        var eS = (1 - Math.exp(-w / 0.55)) * Math.exp(-w / tauS);
        v += eS * cS(t);
        v += 0.22 * (1 - Math.exp(-w / 3)) * Math.exp(-w / (tauS * 2.8)) * cC(t);
      }
      x[i] = v;
    }
    var mx = 0, mi = 0;
    for (var j = 0; j < N; j++) if (Math.abs(x[j]) > mx) { mx = Math.abs(x[j]); mi = j; }
    var k = s.A / mx;
    for (var j2 = 0; j2 < N; j2++) x[j2] *= k;
    s.trace = x; s.peakT = s.ws + mi / FS; s.peakV = x[mi];
  }

  /* ---------- state ---------- */
  var S = { day: 0, ev: null, picks: [], mode: 'P', pin: null, filed: false, hover: null };
  var MODES = [['P', 'P arrival'], ['S', 'S arrival'], ['A', 'Largest swing']];

  function load() {
    S.ev = build(S.day);
    S.picks = S.ev.stations.map(function () { return { P: null, S: null, A: null, Ay: null }; });
    S.mode = 'P'; S.pin = null; S.filed = false; S.hover = null;
    var ev = S.ev;
    $('plWho').textContent = ev.agency + ' · duty seismologist';
    $('plName').textContent = 'Event of ' + longDate(ev.date) + ', ' + clock(ev.t0).slice(0, 5) + ' UTC';
    $('plBlurb').innerHTML = 'At ' + clock(ev.t0 + 40).slice(0, 5) + ' the switchboard lit up with calls from across ' + esc(ev.region) +
      '. ' + ev.stations.length + ' stations of the network caught it: <b>' + ev.stations.map(function (s) { return esc(s.code) + '</b> at ' + esc(s.town); }).join(', <b>') +
      '. Pick the P and S arrivals and the largest swing on each record, let the circles fall where they will, put a pin where they meet and issue the bulletin.';
    $('dayOut').textContent = (S.day === 0 ? 'Today, ' : '') + longDate(ev.date);
    buildTraces(); renderModes(); renderAll();
    $('report').innerHTML = ''; $('report').className = 'verdict';
  }

  /* ---------- the records ---------- */
  function buildTraces() {
    var box = $('traces'); box.innerHTML = '';
    S.ev.stations.forEach(function (s, i) {
      var wrap = document.createElement('div'); wrap.className = 'trace';
      wrap.innerHTML = '<div class="trhead"><span class="sw" style="background:' + s.mcol + '"></span><b>' + esc(s.code) + '</b> ' + esc(s.town) +
        '<span class="trnote" id="trn' + i + '"></span></div>' +
        '<canvas id="cv' + i + '" aria-label="Seismogram from station ' + esc(s.code) + '"></canvas>' +
        '<div class="nudge"><span>Move the selected pick:</span>' +
        ['-0.5', '-0.1', '+0.1', '+0.5'].map(function (v) { return '<button type="button" class="chip" data-i="' + i + '" data-v="' + v + '">' + v.replace('-', '−') + ' s</button>'; }).join('') +
        '<button type="button" class="chip" data-i="' + i + '" data-clear="1">Clear this record</button></div>';
      box.appendChild(wrap);
      var cv = wrap.querySelector('canvas');
      cv.addEventListener('pointermove', function (e) { var b = cv.getBoundingClientRect(); S.hover = { i: i, x: e.clientX - b.left, y: e.clientY - b.top }; drawTrace(i); });
      cv.addEventListener('pointerleave', function () { if (S.hover && S.hover.i === i) { S.hover = null; drawTrace(i); } });
      cv.addEventListener('click', function (e) { var b = cv.getBoundingClientRect(); place(i, e.clientX - b.left, e.clientY - b.top); });
    });
    box.querySelectorAll('.nudge .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        if (S.filed) return;
        var i = +b.dataset.i, p = S.picks[i];
        if (b.dataset.clear) { S.picks[i] = { P: null, S: null, A: null, Ay: null }; renderAll(); return; }
        var m = S.mode === 'A' ? null : S.mode;
        if (!m || p[m] == null) return;
        p[m] = Math.round((p[m] + parseFloat(b.dataset.v)) * 10) / 10;
        renderAll();
      });
    });
  }
  function geom(i) {
    var cv = $('cv' + i), s = S.ev.stations[i];
    var w = cv.clientWidth, h = cv.clientHeight, L = 6, R = 6;
    var half = h / 2 - 16, ppm = half / (s.A * 1.08);
    return { cv: cv, w: w, h: h, x0: L, x1: w - R, base: h / 2 + 2, ppm: ppm,
      tx: function (t) { return L + (t - s.ws) / s.W * (w - L - R); },
      xt: function (x) { return s.ws + (x - L) / (w - L - R) * s.W; } };
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function fmtMm(v) { return v >= 10 ? Math.round(v).toString() : v >= 1 ? f1(v) : v >= 0.1 ? f2(v) : v.toPrecision(2); }
  function place(i, x, y) {
    if (S.filed) return;
    var g = geom(i), t = Math.round(g.xt(x) * 10) / 10, p = S.picks[i], s = S.ev.stations[i];
    t = Math.max(s.ws, Math.min(s.ws + s.W, t));
    if (S.mode === 'A') { p.A = Math.abs(y - g.base) / g.ppm; p.Ay = t; }
    else p[S.mode] = t;
    // move on to whatever this record still lacks
    var order = ['P', 'S', 'A'], nx = order.filter(function (m) { return p[m] == null; })[0];
    if (nx) S.mode = nx;
    renderModes(); renderAll();
  }
  function drawTrace(i) {
    var s = S.ev.stations[i], g = geom(i), cv = g.cv, dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(g.w * dpr) || cv.height !== Math.round(g.h * dpr)) { cv.width = Math.round(g.w * dpr); cv.height = Math.round(g.h * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#f3efe4'; c.fillRect(0, 0, g.w, g.h);
    // amplitude grid
    var step = niceStep(26 / g.ppm);
    c.strokeStyle = 'rgba(150,120,80,.22)'; c.lineWidth = 1; c.fillStyle = 'rgba(110,90,60,.75)'; c.font = '10px ui-monospace,Menlo,monospace';
    for (var k = -4; k <= 4; k++) { var yy = g.base - k * step * g.ppm; if (yy < 2 || yy > g.h - 12) continue; c.beginPath(); c.moveTo(g.x0, yy); c.lineTo(g.x1, yy); c.stroke(); }
    c.fillText('grid ' + fmtMm(step) + ' mm', g.x0 + 4, 12);
    // time ticks
    var t0 = Math.ceil(s.ws);
    for (var tt = t0; tt <= s.ws + s.W; tt++) {
      var x = g.tx(tt), big = Math.round(S.ev.t0 + tt) % 10 === 0;
      c.strokeStyle = big ? 'rgba(150,120,80,.45)' : 'rgba(150,120,80,.14)';
      c.beginPath(); c.moveTo(x, big ? 0 : g.h - 18); c.lineTo(x, g.h - 12); c.stroke();
      if (big) { c.fillStyle = 'rgba(110,90,60,.85)'; c.fillText(clock(S.ev.t0 + tt).slice(3), x + 2, g.h - 2); }
    }
    // the trace, min/max per pixel column
    c.strokeStyle = '#1d2230'; c.lineWidth = 1; c.beginPath();
    var tr = s.trace, N = tr.length, cols = Math.max(1, Math.floor(g.x1 - g.x0));
    for (var px = 0; px < cols; px++) {
      var a = Math.floor(px / cols * N), b = Math.max(a + 1, Math.floor((px + 1) / cols * N)), mn = 1e9, mx = -1e9;
      for (var j = a; j < b && j < N; j++) { if (tr[j] < mn) mn = tr[j]; if (tr[j] > mx) mx = tr[j]; }
      c.moveTo(g.x0 + px + 0.5, g.base - mx * g.ppm); c.lineTo(g.x0 + px + 0.5, g.base - mn * g.ppm - 0.6);
    }
    c.stroke();
    // truth, once filed
    if (S.filed) {
      c.fillStyle = 'rgba(30,140,90,.9)';
      [['P', s.tP], ['S', s.tS]].forEach(function (q) { var x = g.tx(q[1]); c.fillRect(x - 0.75, 0, 1.5, 10); c.fillText('true ' + q[0], x + 3, 22); });
      c.strokeStyle = 'rgba(30,140,90,.8)'; c.setLineDash([3, 3]);
      var ya = g.base - Math.abs(s.peakV) * g.ppm; c.beginPath(); c.moveTo(g.x0, ya); c.lineTo(g.x1, ya); c.stroke(); c.setLineDash([]);
    }
    // picks
    var p = S.picks[i];
    function vline(t, col, lab) { var x = g.tx(t); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, g.h - 12); c.stroke(); c.lineWidth = 1; c.fillStyle = col; c.font = 'bold 12px ui-monospace,Menlo,monospace'; c.fillText(lab, x + 4, 30); c.font = '10px ui-monospace,Menlo,monospace'; }
    if (p.P != null) vline(p.P, '#3a6fd8', 'P');
    if (p.S != null) vline(p.S, '#d4741c', 'S');
    if (p.A != null) {
      var yA = g.base - p.A * g.ppm;
      c.strokeStyle = '#c0365a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(g.tx(p.Ay) - 26, yA); c.lineTo(g.tx(p.Ay) + 26, yA); c.stroke();
      c.beginPath(); c.moveTo(g.tx(p.Ay), g.base); c.lineTo(g.tx(p.Ay), yA); c.stroke(); c.lineWidth = 1;
      c.fillStyle = '#c0365a'; c.fillText(fmtMm(p.A) + ' mm', g.tx(p.Ay) + 30, yA + 4);
    }
    // the loupe
    var hv = S.hover;
    if (hv && hv.i === i && !S.filed) {
      var lw = Math.min(230, g.w * 0.46), lh = g.h - 26, ly = 4;
      var lx = hv.x < g.w / 2 ? g.w - lw - 6 : 6, span = 5, tc = g.xt(hv.x);
      var vg = S.mode === 'A' ? 1 : 3;
      c.save();
      c.fillStyle = '#fbf8f0'; c.strokeStyle = '#2a2418'; c.lineWidth = 2; c.fillRect(lx, ly, lw, lh); c.strokeRect(lx, ly, lw, lh);
      c.beginPath(); c.rect(lx, ly, lw, lh); c.clip();
      var lb = ly + lh / 2;
      c.strokeStyle = 'rgba(150,120,80,.2)'; c.lineWidth = 1;
      for (var q = Math.ceil((tc - span / 2) * 2) / 2; q < tc + span / 2; q += 0.5) { var qx = lx + (q - tc + span / 2) / span * lw; c.beginPath(); c.moveTo(qx, ly); c.lineTo(qx, ly + lh); c.stroke(); }
      c.strokeStyle = '#1d2230'; c.lineWidth = 1.2; c.beginPath();
      var i0 = Math.max(0, Math.floor((tc - span / 2 - s.ws) * FS)), i1 = Math.min(N - 1, Math.ceil((tc + span / 2 - s.ws) * FS));
      for (var m = i0; m <= i1; m++) {
        var mt = s.ws + m / FS, mxp = lx + (mt - tc + span / 2) / span * lw, myp = lb - tr[m] * g.ppm * vg * (lh / g.h);
        if (m === i0) c.moveTo(mxp, myp); else c.lineTo(mxp, myp);
      }
      c.stroke();
      c.strokeStyle = '#c0365a'; c.beginPath(); c.moveTo(lx + lw / 2, ly); c.lineTo(lx + lw / 2, ly + lh); c.stroke();
      c.fillStyle = '#2a2418'; c.font = '10px ui-monospace,Menlo,monospace';
      c.fillText(clock(S.ev.t0 + tc, true) + (vg > 1 ? '  height ×3' : ''), lx + 6, ly + 12);
      c.restore();
      if (S.mode === 'A') {
        c.strokeStyle = 'rgba(192,54,90,.6)'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(g.x0, hv.y); c.lineTo(g.x1, hv.y); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#c0365a'; c.fillText(fmtMm(Math.abs(hv.y - g.base) / g.ppm) + ' mm', hv.x < g.w / 2 ? hv.x + 8 : hv.x - 70, hv.y - 4);
      } else {
        c.strokeStyle = 'rgba(192,54,90,.5)'; c.beginPath(); c.moveTo(hv.x, 0); c.lineTo(hv.x, g.h - 12); c.stroke();
      }
    }
  }

  /* ---------- derived numbers from your picks ---------- */
  function derived(i) {
    var p = S.picks[i], o = {};
    if (p.P != null && p.S != null && p.S > p.P) { o.dt = p.S - p.P; o.d = KM_PER_S * o.dt; }
    if (o.dt && p.A) o.ml = richter(p.A, o.dt);
    return o;
  }
  function bestFit(circles) {
    function cost(x, y) { var c = 0; circles.forEach(function (k) { var e = Math.hypot(x - k.x, y - k.y) - k.r; c += e * e; }); return c; }
    var bx = 0, by = 0, bc = 1e18;
    for (var x = -40; x <= BOX + 40; x += 4) for (var y = -40; y <= BOX + 40; y += 4) { var cc = cost(x, y); if (cc < bc) { bc = cc; bx = x; by = y; } }
    for (var st = 2; st > 0.05; st /= 2) {
      var moved = true;
      while (moved) {
        moved = false;
        [[st, 0], [-st, 0], [0, st], [0, -st]].forEach(function (dd) { var cc = cost(bx + dd[0], by + dd[1]); if (cc < bc) { bc = cc; bx += dd[0]; by += dd[1]; moved = true; } });
      }
    }
    return { x: bx, y: by, rms: Math.sqrt(bc / circles.length) };
  }

  /* ---------- rendering ---------- */
  function renderModes() {
    $('modes').innerHTML = MODES.map(function (m) { return '<button type="button" class="chip' + (S.mode === m[0] ? ' on' : '') + '" data-m="' + m[0] + '">' + m[1] + '</button>'; }).join('');
    $('modes').querySelectorAll('.chip').forEach(function (b) { b.addEventListener('click', function () { S.mode = b.dataset.m; renderModes(); }); });
  }
  function renderAll() {
    S.ev.stations.forEach(function (s, i) {
      drawTrace(i);
      var p = S.picks[i], need = [];
      if (p.P == null) need.push('P'); if (p.S == null) need.push('S'); if (p.A == null) need.push('swing');
      $('trn' + i).textContent = need.length ? 'still to pick: ' + need.join(', ') : 'picked';
    });
    renderTable(); renderMap(); renderNomo();
  }
  function renderTable() {
    var ev = S.ev, rows = ev.stations.map(function (s, i) {
      var p = S.picks[i], o = derived(i);
      return '<tr><td><span class="sw" style="background:' + s.mcol + '"></span>' + esc(s.code) + '</td>' +
        '<td>' + (p.P != null ? clock(ev.t0 + p.P, true) : '—') + '</td>' +
        '<td>' + (p.S != null ? clock(ev.t0 + p.S, true) : '—') + '</td>' +
        '<td>' + (o.dt ? f1(o.dt) + ' s' : '—') + '</td>' +
        '<td>' + (o.d ? Math.round(o.d) + ' km' : '—') + '</td>' +
        '<td>' + (p.A ? fmtMm(p.A) + ' mm' : '—') + '</td>' +
        '<td>' + (o.ml != null ? f1(o.ml) : '—') + '</td></tr>';
    });
    var mls = ev.stations.map(function (s, i) { return derived(i).ml; }).filter(function (v) { return v != null; });
    var mean = mls.length ? mls.reduce(function (a, b) { return a + b; }, 0) / mls.length : null;
    $('book').innerHTML = '<table class="book"><thead><tr><th>Station</th><th>P</th><th>S</th><th>S − P</th><th>Distance</th><th>Amplitude</th><th>M<sub>L</sub></th></tr></thead><tbody>' +
      rows.join('') + '</tbody><tfoot><tr><td colspan="6">Network magnitude (mean of stations)</td><td>' + (mean != null ? f1(mean) : '—') + '</td></tr></tfoot></table>';
  }
  function renderMap() {
    var ev = S.ev, o = '';
    o += '<rect x="-30" y="-30" width="' + (BOX + 60) + '" height="' + (BOX + 60) + '" fill="#0d2233"/>';
    o += '<polygon points="' + ev.land.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="#1b2a22" stroke="#4b6b55" stroke-width="1"/>';
    for (var g = 0; g <= BOX; g += 40) o += '<line x1="' + g + '" y1="0" x2="' + g + '" y2="' + BOX + '" stroke="rgba(255,255,255,.06)"/><line x1="0" y1="' + g + '" x2="' + BOX + '" y2="' + g + '" stroke="rgba(255,255,255,.06)"/>';
    ev.towns.forEach(function (t) { o += '<circle cx="' + t.x + '" cy="' + t.y + '" r="2.4" fill="#c9d3c0"/><text x="' + (t.x + 5) + '" y="' + (t.y + 3.5) + '" class="mt">' + esc(t.name) + '</text>'; });
    var circles = [];
    ev.stations.forEach(function (s, i) {
      var dd = derived(i);
      if (S.filed) o += '<circle cx="' + s.x + '" cy="' + s.y + '" r="' + s.d.toFixed(1) + '" fill="none" stroke="' + s.mcol + '" stroke-opacity=".55" stroke-dasharray="2 4" stroke-width="1"/>';
      if (dd.d) { circles.push({ x: s.x, y: s.y, r: dd.d }); o += '<circle cx="' + s.x + '" cy="' + s.y + '" r="' + dd.d.toFixed(1) + '" fill="' + s.mcol + '" fill-opacity=".05" stroke="' + s.mcol + '" stroke-width="1.6"/>'; }
    });
    ev.stations.forEach(function (s) {
      o += '<polygon points="' + s.x + ',' + (s.y - 6) + ' ' + (s.x - 5.5) + ',' + (s.y + 4) + ' ' + (s.x + 5.5) + ',' + (s.y + 4) + '" fill="' + s.mcol + '" stroke="#07090d" stroke-width="1"/>' +
        '<text x="' + (s.x + 8) + '" y="' + (s.y + 4) + '" class="ms">' + esc(s.code) + '</text>';
    });
    if (S.filed && circles.length >= 2) {
      var bf = bestFit(circles);
      o += '<circle cx="' + bf.x + '" cy="' + bf.y + '" r="4" fill="none" stroke="#e8edf5" stroke-width="1.2" stroke-dasharray="2 2"/>';
    }
    if (S.pin) o += '<g stroke="#ff8fa3" stroke-width="2"><line x1="' + (S.pin.x - 7) + '" y1="' + S.pin.y + '" x2="' + (S.pin.x + 7) + '" y2="' + S.pin.y + '"/><line x1="' + S.pin.x + '" y1="' + (S.pin.y - 7) + '" x2="' + S.pin.x + '" y2="' + (S.pin.y + 7) + '"/></g>';
    if (S.filed) {
      var e = ev.epi, sp = [];
      for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 3.4 : 8; sp.push((e.x + Math.cos(a) * rr).toFixed(1) + ',' + (e.y + Math.sin(a) * rr).toFixed(1)); }
      o += '<polygon points="' + sp.join(' ') + '" fill="#ffce6a" stroke="#07090d" stroke-width="1"/>';
    }
    // scale bar
    o += '<g transform="translate(12,' + (BOX - 14) + ')"><rect x="-4" y="-12" width="110" height="20" rx="4" fill="rgba(7,9,13,.7)"/><line x1="0" y1="0" x2="100" y2="0" stroke="#e8edf5" stroke-width="2"/><line x1="0" y1="-4" x2="0" y2="4" stroke="#e8edf5"/><line x1="100" y1="-4" x2="100" y2="4" stroke="#e8edf5"/><text x="50" y="-3" class="mt" text-anchor="middle">100 km</text></g>';
    o += '<g transform="translate(' + (BOX - 16) + ',22)"><path d="M0,-12 L5,4 L0,0 L-5,4 Z" fill="#e8edf5"/><text x="0" y="16" class="mt" text-anchor="middle">N</text></g>';
    $('map').innerHTML = o;
  }
  var NV0 = -2.4, NV1 = 5.7;
  function renderNomo() {
    var W = 420, H = 330, xL = 70, xR = 350, xM = (xL + xR) / 2, top = 26, bot = H - 22;
    function Y(v) { return bot - (v - NV0) / (NV1 - NV0) * (bot - top); }
    var o = '<rect width="' + W + '" height="' + H + '" fill="#f3efe4" rx="10"/>';
    o += '<line x1="' + xL + '" y1="' + top + '" x2="' + xL + '" y2="' + bot + '" class="na"/><line x1="' + xR + '" y1="' + top + '" x2="' + xR + '" y2="' + bot + '" class="na"/><line x1="' + xM + '" y1="' + top + '" x2="' + xM + '" y2="' + bot + '" class="na"/>';
    o += '<text x="' + xL + '" y="16" class="nh" text-anchor="middle">S − P (s) · km</text><text x="' + xM + '" y="16" class="nh" text-anchor="middle">M<tspan font-size="8" dy="2">L</tspan></text><text x="' + xR + '" y="16" class="nh" text-anchor="middle">amplitude (mm)</text>';
    [2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50, 60].forEach(function (dt) {
      var y = Y(3 * log10(KM_PER_S * dt) - 2.92);
      if (y < top || y > bot) return;
      o += '<line x1="' + (xL - 5) + '" y1="' + y + '" x2="' + xL + '" y2="' + y + '" class="na"/><text x="' + (xL - 8) + '" y="' + (y + 3) + '" class="nt" text-anchor="end">' + dt + '</text><text x="' + (xL + 5) + '" y="' + (y + 3) + '" class="nk">' + (KM_PER_S * dt) + '</text>';
    });
    [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].forEach(function (a) {
      var y = Y(log10(a));
      if (y < top || y > bot) return;
      o += '<line x1="' + xR + '" y1="' + y + '" x2="' + (xR + 5) + '" y2="' + y + '" class="na"/><text x="' + (xR + 8) + '" y="' + (y + 3) + '" class="nt">' + a + '</text>';
    });
    for (var m = 0; m <= 7.01; m += 0.5) {
      var ym = Y(m / 2), big = Math.abs(m - Math.round(m)) < 0.01;
      if (ym < top || ym > bot) continue;
      o += '<line x1="' + (xM - (big ? 6 : 3)) + '" y1="' + ym + '" x2="' + (xM + (big ? 6 : 3)) + '" y2="' + ym + '" class="na"/>' + (big ? '<text x="' + (xM - 9) + '" y="' + (ym + 3) + '" class="nt" text-anchor="end">' + m + '</text>' : '');
    }
    S.ev.stations.forEach(function (s, i) {
      var p = S.picks[i], dd = derived(i);
      if (!dd.dt || !p.A) return;
      var yl = Y(3 * log10(KM_PER_S * dd.dt) - 2.92), yr = Y(log10(p.A));
      o += '<line x1="' + xL + '" y1="' + yl + '" x2="' + xR + '" y2="' + yr + '" stroke="' + s.col + '" stroke-width="1.8"/>' +
        '<circle cx="' + xM + '" cy="' + ((yl + yr) / 2) + '" r="3.2" fill="' + s.col + '"/>';
    });
    if (S.filed) { var yt = Y(S.ev.ml / 2); o += '<path d="M' + (xM + 8) + ',' + yt + ' l9,-5 v10 z" fill="#1e8c5a"/><text x="' + (xM + 20) + '" y="' + (yt + 3) + '" class="nt" fill="#1e8c5a">true ' + f1(S.ev.ml) + '</text>'; }
    $('nomo').innerHTML = o;
  }

  /* ---------- the bulletin ---------- */
  function fileReport() {
    var ev = S.ev, miss = [];
    ev.stations.forEach(function (s, i) {
      var p = S.picks[i], m = [];
      if (p.P == null) m.push('P'); if (p.S == null) m.push('S'); if (p.A == null) m.push('the largest swing');
      if (p.P != null && p.S != null && p.S <= p.P) m.push('an S that comes after its P');
      if (m.length) miss.push(s.code + ' needs ' + m.join(', '));
    });
    if (!S.pin) miss.push('the map needs a pin where you think the epicentre is');
    if (miss.length) { $('report').className = 'verdict warn'; $('report').innerHTML = 'Not yet. ' + esc(miss.join('; ')) + '.'; return; }
    S.filed = true;
    var circles = ev.stations.map(function (s, i) { return { x: s.x, y: s.y, r: derived(i).d }; });
    var bf = bestFit(circles), pinErr = dist(S.pin, ev.epi), fitErr = dist(bf, ev.epi), pinFit = dist(S.pin, bf);
    var mls = ev.stations.map(function (s, i) { return derived(i).ml; }), myMl = mls.reduce(function (a, b) { return a + b; }, 0) / mls.length;
    var myT0 = ev.stations.map(function (s, i) { return S.picks[i].P - derived(i).d / VP; }).reduce(function (a, b) { return a + b; }, 0) / mls.length;
    // which record hurt most
    var worst = null;
    ev.stations.forEach(function (s, i) {
      var p = S.picks[i], dErr = derived(i).d - s.d;
      if (!worst || Math.abs(dErr) > Math.abs(worst.dErr)) worst = { s: s, dErr: dErr, eP: p.P - s.tP, eS: p.S - s.tS };
    });
    var good = pinErr < 15 && Math.abs(myMl - ev.ml) <= 0.3;
    var lines = [];
    lines.push('<pre class="bull">' + esc(ev.agency.toUpperCase()) + '\nPRELIMINARY BULLETIN  ' + esc(longDate(ev.date)) +
      '\n\nYOUR SOLUTION\n  origin   ' + clock(ev.t0 + myT0, true) + ' UTC' +
      '\n  epicentre ' + Math.round(dist(S.pin, ev.near)) + ' km ' + bearing(ev.near, S.pin) + ' of ' + esc(ev.near.name) +
      '\n  magnitude ML ' + f1(myMl) +
      '\n\nREVIEWED SOLUTION\n  origin   ' + clock(ev.t0, true) + ' UTC' +
      '\n  epicentre ' + Math.round(dist(ev.epi, ev.near)) + ' km ' + bearing(ev.near, ev.epi) + ' of ' + esc(ev.near.name) + ', depth ' + ev.depth + ' km' +
      '\n  magnitude ML ' + f1(ev.ml) + '</pre>');
    var v = 'Your pin is <b>' + Math.round(pinErr) + ' km</b> from the true epicentre (the gold star). ';
    v += pinFit > 6 ? 'The best fit to your own circles (the dashed ring) was ' + Math.round(fitErr) + ' km off, so ' + (fitErr < pinErr ? 'trusting the circles would have done better than the pin. ' : 'the pin actually beat your circles. ') : 'You put it right where your circles agree best. ';
    v += 'Magnitude: you said <b>' + f1(myMl) + '</b>, the review says <b>' + f1(ev.ml) + '</b>' + (Math.abs(myMl - ev.ml) <= 0.15 ? ', which is as close as two stations normally agree with each other. ' : Math.abs(myMl - ev.ml) <= 0.3 ? ', inside the usual scatter. ' : ', which would get a phone call from the reviewer. ');
    if (Math.abs(worst.dErr) > 8) {
      var why = Math.abs(worst.eS) >= Math.abs(worst.eP) ? 'the S on ' + worst.s.code + ' was picked ' + f1(Math.abs(worst.eS)) + ' s ' + (worst.eS > 0 ? 'late' : 'early') : 'the P on ' + worst.s.code + ' was picked ' + f1(Math.abs(worst.eP)) + ' s ' + (worst.eP > 0 ? 'late' : 'early');
      v += 'The biggest miss: ' + why + ', which made its circle ' + Math.round(Math.abs(worst.dErr)) + ' km too ' + (worst.dErr > 0 ? 'big' : 'small') + '. Every second of S − P is eight kilometres. ';
    } else v += 'Every circle is within ' + (Math.abs(worst.dErr) < 1 ? 'a kilometre' : Math.round(Math.abs(worst.dErr)) + ' km') + ' of the truth, which is good picking. ';
    v += good ? '<b>The bulletin goes out under your name.</b>' : '<b>The reviewer will want another look before it goes out.</b>';
    v += ' The true arrivals and largest swing are now marked in green on each record.';
    lines.push('<p style="margin:12px 0 0">' + v + '</p><div class="controls" style="margin-top:12px"><button class="btn small ghost" type="button" id="btnAgain">Clear the picks and try again</button></div>');
    $('report').className = 'verdict ' + (good ? 'good' : 'warn');
    $('report').innerHTML = lines.join('');
    $('btnAgain').addEventListener('click', function () {
      S.filed = false; S.pin = null; S.mode = 'P';
      S.picks = S.ev.stations.map(function () { return { P: null, S: null, A: null, Ay: null }; });
      $('report').innerHTML = ''; $('report').className = 'verdict'; renderModes(); renderAll();
    });
    renderAll();
  }

  /* ---------- wiring ---------- */
  $('map').addEventListener('click', function (e) {
    if (S.filed) return;
    var svg = $('map'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var q = pt.matrixTransform(svg.getScreenCTM().inverse());
    S.pin = { x: Math.max(0, Math.min(BOX, q.x)), y: Math.max(0, Math.min(BOX, q.y)) };
    renderMap();
  });
  $('btnFile').addEventListener('click', fileReport);
  function goDay(d) { S.day = d; load(); }
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  document.addEventListener('keydown', function (ev) {
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || tg === 'BUTTON') return;
    if (ev.key === 'ArrowLeft') goDay(S.day - 1);
    else if (ev.key === 'ArrowRight') goDay(S.day + 1);
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (S.ev) S.ev.stations.forEach(function (s, i) { drawTrace(i); }); }, 120); });

  // exposed for testing only
  if (typeof window !== 'undefined') window.__seismograph = { build: build, bestFit: bestFit, richter: richter, S: S, place: place, fileReport: fileReport };

  load();
})();
