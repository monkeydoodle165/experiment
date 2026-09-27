/* drift.quibo.games — The Gnomon
   A horizontal sundial laid out by the day's number for a town that isn't anywhere,
   lit by the real sun for the real date. The hour lines come from the gnomonic formula
   tan(theta) = sin(latitude) tan(H), the sun from the NOAA solar equations, and the
   argument between the dial and the town clock from the equation of time, the town's
   distance from its zone meridian, and summer time. The town, its dial and its motto's
   stone are invented. Self-contained. No dependencies. */
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
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  function sind(x) { return Math.sin(x * RAD); }
  function cosd(x) { return Math.cos(x * RAD); }
  function tand(x) { return Math.tan(x * RAD); }

  /* ---------- time formatting ---------- */
  function wrapM(m) { return ((m % 1440) + 1440) % 1440; }
  function hm(m) {
    m = wrapM(Math.round(m));
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function mins(x, withSec) {
    var a = Math.abs(x), m = Math.floor(a), s = Math.round((a - m) * 60);
    if (s === 60) { m++; s = 0; }
    if (!withSec) return Math.round(a) + ' min';
    return m + ' min ' + (s < 10 ? '0' : '') + s + ' s';
  }
  function signed(x) { return (x >= 0 ? '+' : '−') + mins(x); }
  function dms(v, pos, neg) {
    var a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60);
    if (m === 60) { d++; m = 0; }
    return d + '°' + (m < 10 ? '0' : '') + m + '′ ' + (v >= 0 ? pos : neg);
  }
  var ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function longDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  /* ---------- the sun: NOAA solar position equations ---------- */
  // jd: Julian day (UTC). Returns declination (deg) and equation of time (minutes, sun minus mean).
  function sun(jd) {
    var T = (jd - 2451545) / 36525;
    var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
    if (L0 < 0) L0 += 360;
    var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var C = sind(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sind(2 * M) * (0.019993 - 0.000101 * T) + sind(3 * M) * 0.000289;
    var om = 125.04 - 1934.136 * T;
    var lam = L0 + C - 0.00569 - 0.00478 * sind(om);
    var eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var eps = eps0 + 0.00256 * cosd(om);
    var dec = Math.asin(sind(eps) * sind(lam)) * DEG;
    var y = Math.pow(tand(eps / 2), 2);
    var eot = 4 * DEG * (y * sind(2 * L0) - 2 * e * sind(M) + 4 * e * y * sind(M) * cosd(2 * L0) -
      0.5 * y * y * sind(4 * L0) - 1.25 * e * e * sind(2 * M));
    return { dec: dec, eot: eot };
  }
  function jdOf(y, m, d, stdMin, zone) {
    return Date.UTC(y, m, d) / 86400000 + 2440587.5 + (stdMin / 60 - zone) / 24;
  }
  // unit vector towards the sun in east-north-up, from hour angle H (deg, west +) and declination
  function sunVec(H, dec, lat) {
    return {
      e: -cosd(dec) * sind(H),
      n: sind(dec) * cosd(lat) - cosd(dec) * cosd(H) * sind(lat),
      u: sind(dec) * sind(lat) + cosd(dec) * cosd(H) * cosd(lat)
    };
  }

  /* ---------- summer time, EU rule: last Sunday in March to last Sunday in October ---------- */
  function lastSunday(y, m) { var d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); }
  function inSummer(d) {
    var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    if (m < 2 || m > 9) return false;
    if (m > 2 && m < 9) return true;
    if (m === 2) return day >= lastSunday(y, 2);
    return day < lastSunday(y, 9);
  }

  /* ---------- the town and its dial ---------- */
  var PRE = ['Ash', 'Mar', 'Hol', 'Wen', 'Brack', 'Caster', 'Lind', 'Sel', 'Thorn', 'Ov', 'Pen', 'Kel', 'Ros', 'Dun',
    'Aller', 'Wick', 'Stan', 'Ford', 'Bram', 'Kings', 'Lang', 'Nether', 'Chal', 'Hester', 'Oak', 'Tre', 'Cul', 'Sand'];
  var SUF = ['ford', 'wick', 'by', 'mere', 'ton', 'stow', 'ham', 'leigh', 'combe', 'hythe', 'bury', 'well', 'thwaite', 'minster', 'cot', 'field'];
  var PLACES = [
    'on a baluster in the churchyard, south of the porch',
    'on a pedestal in the middle of the market square',
    'on the lawn of the old rectory, where the vicar set it out',
    'on the parapet of the harbour wall, facing the moorings',
    'in the fellows’ garden of a small college',
    'on a stone post in the station forecourt, where it lost an argument with the railway',
    'in the middle of a walled kitchen garden, between the box hedges',
    'on the terrace of a house that is now a school',
    'on a column in the almshouse courtyard'
  ];
  var MATS = [
    { n: 'slate', face: ['#2b3440', '#1b222b'], line: 'rgba(232,237,245,.78)', dim: 'rgba(232,237,245,.38)', metal: '#c7a36a' },
    { n: 'bronze', face: ['#4a3a22', '#2d2414'], line: 'rgba(255,233,168,.82)', dim: 'rgba(255,233,168,.4)', metal: '#e1c07e' },
    { n: 'limestone', face: ['#6e6a5f', '#4c493f'], line: 'rgba(20,18,14,.85)', dim: 'rgba(20,18,14,.45)', metal: '#2e3a3a' },
    { n: 'brass on oak', face: ['#6d5327', '#453313'], line: 'rgba(250,236,200,.85)', dim: 'rgba(250,236,200,.42)', metal: '#f0d58f' }
  ];
  var MOTTOS = [
    ['HORAS NON NUMERO NISI SERENAS', 'I count only the sunny hours'],
    ['TEMPUS FUGIT', 'time flies'],
    ['UMBRA SUMUS', 'we are a shadow'],
    ['LUX MEA LEX', 'light is my law'],
    ['SINE SOLE SILEO', 'without the sun I am silent'],
    ['PEREUNT ET IMPUTANTUR', 'they pass, and are counted against us'],
    ['ULTIMA LATET', 'the last one is hidden'],
    ['VULNERANT OMNES ULTIMA NECAT', 'they all wound; the last one kills'],
    ['DUM SPECTAS FUGIO', 'while you look, I fly'],
    ['SOL OMNIBUS LUCET', 'the sun shines for everyone'],
    ['EX HOC MOMENTO PENDET AETERNITAS', 'on this moment hangs eternity'],
    ['CARPE DIEM', 'seize the day']
  ];

  function build(off) {
    var d = dateFor(off);
    var r = rng(seedForDate(d) ^ 0x676e6d6e);
    var W = { date: d, y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    W.name = pick(r, PRE) + pick(r, SUF);
    W.lat = 36 + r() * 23;
    W.zone = pick(r, [-1, 0, 0, 1, 1, 1, 2, 2, 3]);
    var offLon = (r() - 0.5) * 2 * (r() < 0.25 ? 16 : 9);
    W.lon = W.zone * 15 + offLon;
    W.keepsSummer = r() < 0.6;
    W.dst = W.keepsSummer && inSummer(d);
    W.place = pick(r, PLACES);
    W.mat = pick(r, MATS);
    W.motto = pick(r, MOTTOS);
    W.made = 1680 + Math.floor(r() * 190);
    W.maker = pick(r, ['cut by a local mason', 'signed by an instrument maker from the county town', 'set out by the schoolmaster', 'cast at a bell foundry', 'engraved by a clockmaker', 'given by a returning surveyor']);

    // sun for the day, taken at local clock noon
    var s = sun(jdOf(W.y, W.m, W.d, 720, W.zone));
    W.dec = s.dec; W.eot = s.eot;
    W.lonCorr = -4 * (W.lon - 15 * W.zone);        // minutes to add to sun time for zone time
    W.dstCorr = W.dst ? 60 : 0;
    // clock (displayed) minutes <-> apparent solar minutes
    W.toSun = function (clock) { return clock - W.dstCorr + W.eot - W.lonCorr; };
    W.toClock = function (ast) { return ast - W.eot + W.lonCorr + W.dstCorr; };
    var c0 = (sind(-0.833) - sind(W.lat) * sind(W.dec)) / (cosd(W.lat) * cosd(W.dec));
    W.H0 = c0 <= -1 ? 180 : c0 >= 1 ? 0 : Math.acos(c0) * DEG;
    W.riseAst = 720 - W.H0 * 4; W.setAst = 720 + W.H0 * 4;
    var hmax = Math.acos(clamp(-tand(W.lat) * tand(23.44), -1, 1)) * DEG;
    W.hStart = Math.ceil(12 - hmax / 15); W.hEnd = Math.floor(12 + hmax / 15);

    // geometry on the dial (units of the dial's radius). O is where the style meets the plate.
    W.O = { x: 0, y: -0.42 };
    var altW = 90 - W.lat - 23.44;
    var reach = 1.34;
    W.nod = clamp(reach / (cosd(W.lat) + sind(W.lat) / tand(altW)), 0.12, 0.5);

    // the reading
    W.r = r;
    return W;
  }

  /* ---------- state ---------- */
  var S = { day: 0, mode: 'read', W: null, q: null, ans: null, clock: 720, play: false, hoverAst: null, tries: 0 };

  function newQuestion() {
    var W = S.W, r = W.r;
    var lo = Math.max(W.riseAst + 75, 7 * 60), hi = Math.min(W.setAst - 75, 18 * 60);
    if (hi <= lo) { lo = 660; hi = 780; }
    var ast = lo + r() * (hi - lo);
    var clock = Math.round(W.toClock(ast));
    S.q = { clock: clock, ast: W.toSun(clock) };
    S.ans = null;
    $('ansIn').value = '';
  }

  /* ---------- canvas ---------- */
  var cv = $('dial'), ctx = cv.getContext('2d'), dpr = 1, CW = 0, CH = 0, R = 0, cx = 0, cy = 0;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    CW = cv.clientWidth;
    CH = Math.round(Math.min(CW * 0.92, 560));
    cv.style.height = CH + 'px';
    cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(CW, CH) / 2 - 12; cx = CW / 2; cy = CH / 2;
    draw();
  }
  function X(p) { return cx + p.x * R; }
  function Y(p) { return cy - p.y * R; }
  function dirFor(H) {                 // hour line direction on the plate for hour angle H
    var th = Math.atan2(sind(S.W.lat) * sind(H), cosd(H));
    return { x: Math.sin(th), y: Math.cos(th) };
  }
  function rayHit(O, d, rad) {         // distance along d from O to the circle of radius rad about the centre
    var b = O.x * d.x + O.y * d.y, c = O.x * O.x + O.y * O.y - rad * rad;
    return -b + Math.sqrt(Math.max(0, b * b - c));
  }
  function nodusShadow(H, dec) {       // where the tip's shadow falls, or null
    var W = S.W, s = sunVec(H, dec, W.lat);
    if (s.u <= 0.015) return null;
    var nx = 0, ny = W.nod * cosd(W.lat), nz = W.nod * sind(W.lat);
    return { x: W.O.x + nx - s.e * nz / s.u, y: W.O.y + ny - s.n * nz / s.u };
  }

  function currentClock() { return S.mode === 'read' ? S.q.clock : S.clock; }

  function draw() {
    var W = S.W; if (!W || !CW) return;
    var M = W.mat;
    ctx.clearRect(0, 0, CW, CH);

    // plinth and face
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, 7); ctx.fillStyle = '#0b0f16'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
    var g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
    g.addColorStop(0, M.face[0]); g.addColorStop(1, M.face[1]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.clip();

    var O = W.O, ox = X(O), oy = Y(O);

    // chapter ring
    ctx.strokeStyle = M.dim; ctx.lineWidth = 1;
    [0.84, 0.97].forEach(function (rr) { ctx.beginPath(); ctx.arc(cx, cy, rr * R, 0, 7); ctx.stroke(); });

    // ten-minute ticks and hour lines
    for (var h = W.hStart; h <= W.hEnd; h++) {
      for (var k = 0; k < 6; k++) {
        if (h === W.hEnd && k > 0) break;
        var H = (h + k / 6 - 12) * 15, d = dirFor(H);
        var t1 = rayHit(O, d, k === 0 ? 0.0 : 0.84), t2 = rayHit(O, d, k === 0 ? 0.97 : k === 3 ? 0.93 : 0.9);
        if (k === 0) t1 = 0.07;
        ctx.beginPath();
        ctx.moveTo(ox + d.x * t1 * R, oy - d.y * t1 * R);
        ctx.lineTo(ox + d.x * t2 * R, oy - d.y * t2 * R);
        ctx.strokeStyle = k === 0 ? M.line : M.dim;
        ctx.lineWidth = k === 0 ? 1.6 : k === 3 ? 1.2 : 0.8;
        ctx.stroke();
      }
      // numeral
      var dd = dirFor((h - 12) * 15), tn = rayHit(O, dd, 0.765);
      var px = ox + dd.x * tn * R, py = oy - dd.y * tn * R;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(dd.x, dd.y));
      ctx.fillStyle = M.line;
      ctx.font = '600 ' + Math.max(10, Math.round(R * 0.062)) + 'px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ROMAN[((h % 12) + 12) % 12], 0, 0);
      ctx.restore();
    }

    // declination lines: midsummer, equinox, midwinter, and today's
    var decs = [[23.44, 'midsummer'], [0, 'equinoxes'], [-23.44, 'midwinter']];
    ctx.setLineDash([3, 4]);
    decs.forEach(function (dl) { traceDec(dl[0], M.dim, 1); });
    ctx.setLineDash([]);
    traceDec(W.dec, 'rgba(100,240,200,.55)', 1.4);
    decs.forEach(function (dl) {
      var p = nodusShadow(0, dl[0]);
      if (p && Math.hypot(p.x, p.y) < 0.8) {
        ctx.fillStyle = M.dim; ctx.font = Math.max(9, Math.round(R * 0.036)) + 'px ui-monospace,Menlo,monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(dl[1], X(p) + 5, Y(p) - 2);
      }
    });

    // the clock-noon mark: an analemma, the tip's shadow at 12:00 standard time all year
    ctx.beginPath();
    var first = true;
    for (var doy = 0; doy <= 366; doy += 2) {
      var dt = new Date(Date.UTC(W.y, 0, 1 + doy));
      var so = sun(jdOf(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 720, W.zone));
      var ast = 720 + so.eot - W.lonCorr;
      var p2 = nodusShadow((ast - 720) / 4, so.dec);
      if (!p2 || Math.hypot(p2.x, p2.y) > 0.97) { first = true; continue; }
      if (first) ctx.moveTo(X(p2), Y(p2)); else ctx.lineTo(X(p2), Y(p2));
      first = false;
    }
    ctx.strokeStyle = 'rgba(255,233,168,.55)'; ctx.lineWidth = 1.2; ctx.stroke();

    // motto along the bottom of the chapter ring
    ctx.save();
    ctx.fillStyle = M.dim;
    var txt = W.motto[0], rr2 = 0.905 * R;
    var fs = Math.max(6, Math.min(R * 0.042, rr2 * 1.0 / (txt.length * 0.8)));
    ctx.font = '600 ' + fs.toFixed(1) + 'px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var span = Math.min(1.0, txt.length * fs * 0.8 / rr2);
    for (var i = 0; i < txt.length; i++) {
      var a = Math.PI / 2 + span / 2 - span * (i + 0.5) / txt.length;
      ctx.save(); ctx.translate(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); ctx.rotate(a - Math.PI / 2);
      ctx.fillText(txt[i], 0, 0); ctx.restore();
    }
    ctx.restore();

    // N mark
    ctx.fillStyle = M.dim; ctx.font = '600 ' + Math.max(9, Math.round(R * 0.04)) + 'px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - 0.905 * R);

    // the sun and the shadow
    var clock = currentClock(), astNow = W.toSun(clock), Hn = (astNow - 720) / 4;
    var sv = sunVec(Hn, W.dec, W.lat);
    var F = { x: O.x, y: O.y + W.nod * cosd(W.lat) };
    if (sv.u > 0.004) {
      var nz = W.nod * sind(W.lat);
      var tip = { x: F.x - sv.e * nz / sv.u, y: F.y - sv.n * nz / sv.u };
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(X(tip), Y(tip)); ctx.lineTo(X(F), Y(F)); ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(X(tip), Y(tip));
      ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(X(tip), Y(tip), 3, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(4,6,10,.62)'; ctx.fillRect(0, 0, CW, CH);
    }
    // the gnomon plate, seen from above
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(X(F), Y(F));
    ctx.strokeStyle = M.metal; ctx.lineWidth = Math.max(3, R * 0.014); ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(X(F), Y(F), Math.max(2.5, R * 0.01), 0, 7); ctx.fillStyle = M.metal; ctx.fill();

    // hover ray (move mode only)
    if (S.mode === 'move' && S.hoverAst != null) {
      var hd = dirFor((S.hoverAst - 720) / 4), ht = rayHit(O, hd, 0.97);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + hd.x * ht * R, oy - hd.y * ht * R);
      ctx.strokeStyle = 'rgba(122,162,255,.7)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();

    if (sv.u <= 0.004) {
      ctx.fillStyle = '#c3ccdb'; ctx.font = '600 14px ui-sans-serif,-apple-system,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('The sun is down. The dial has nothing to say.', cx, cy + R * 0.2);
    }
  }
  function traceDec(dec, col, lw) {
    var W = S.W, first = true;
    ctx.beginPath();
    for (var H = -180; H <= 180; H += 1) {
      var p = nodusShadow(H, dec);
      if (!p || Math.hypot(p.x, p.y) > 0.97) { first = true; continue; }
      if (first) ctx.moveTo(X(p), Y(p)); else ctx.lineTo(X(p), Y(p));
      first = false;
    }
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
  }

  /* ---------- the town clock ---------- */
  function clockSvg(m, hidden) {
    var s = '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="54" fill="#0b0f16" stroke="rgba(255,255,255,.28)" stroke-width="2"/>';
    for (var i = 0; i < 60; i++) {
      var a = i * 6 * RAD, big = i % 5 === 0, r1 = big ? 44 : 48;
      s += '<line x1="' + (60 + Math.sin(a) * r1).toFixed(1) + '" y1="' + (60 - Math.cos(a) * r1).toFixed(1) +
        '" x2="' + (60 + Math.sin(a) * 51).toFixed(1) + '" y2="' + (60 - Math.cos(a) * 51).toFixed(1) +
        '" stroke="' + (big ? '#e8edf5' : 'rgba(232,237,245,.35)') + '" stroke-width="' + (big ? 2 : 1) + '"/>';
    }
    if (hidden) {
      s += '<text x="60" y="68" text-anchor="middle" fill="#ffe9a8" font-size="26" font-family="Georgia,serif">?</text>';
    } else {
      m = wrapM(m);
      var ha = ((m / 60) % 12) * 30 * RAD, ma = (m % 60) * 6 * RAD;
      s += '<line x1="60" y1="60" x2="' + (60 + Math.sin(ha) * 28).toFixed(1) + '" y2="' + (60 - Math.cos(ha) * 28).toFixed(1) + '" stroke="#e8edf5" stroke-width="4" stroke-linecap="round"/>' +
        '<line x1="60" y1="60" x2="' + (60 + Math.sin(ma) * 42).toFixed(1) + '" y2="' + (60 - Math.cos(ma) * 42).toFixed(1) + '" stroke="#64f0c8" stroke-width="2.4" stroke-linecap="round"/>';
    }
    s += '<circle cx="60" cy="60" r="3" fill="#e8edf5"/></svg>';
    return s;
  }

  /* ---------- the chain from sun to clock ---------- */
  function lonWords(W) {
    var dl = W.lon - 15 * W.zone;
    return Math.abs(dl) < 0.05 ? 'on its zone meridian' :
      Math.abs(dl).toFixed(1) + '° ' + (dl > 0 ? 'east' : 'west') + ' of its zone meridian (' + Math.abs(15 * W.zone) + '°' + (W.zone > 0 ? 'E' : W.zone < 0 ? 'W' : '') + ')';
  }
  function eotWords(W) {
    return W.eot >= 0 ? 'the sun is fast by ' + mins(W.eot, true) : 'the sun is slow by ' + mins(W.eot, true);
  }
  function chain(ast, reveal) {
    var W = S.W, std = ast - W.eot + W.lonCorr;
    var rows = [];
    rows.push('<b>Dial reads</b> ' + (reveal ? hm(ast) + ' sun time' : 'what the shadow says'));
    rows.push('<b>Longitude</b> ' + lonWords(W) + (reveal ? ' → ' + signed(W.lonCorr) : ''));
    rows.push('<b>Equation of time</b> ' + eotWords(W) + (reveal ? ' → ' + signed(-W.eot) : ''));
    if (reveal) rows.push('<b>Standard time</b> ' + hm(std));
    rows.push('<b>Summer time</b> ' + (W.dst ? 'in force' + (reveal ? ' → +60 min' : '') : W.keepsSummer ? 'not today' : 'this town never changes its clocks'));
    if (reveal) rows.push('<b>Town clock</b> ' + hm(W.toClock(ast)));
    return rows.join('<br>');
  }

  /* ---------- verdict ---------- */
  function diagnose(ans) {
    var W = S.W, A = S.q.ast, T = S.q.clock;
    var cand = [
      ['read the dial as if it were the clock', A],
      ['left out the equation of time', A + W.lonCorr + W.dstCorr],
      ['left out the longitude correction', A - W.eot + W.dstCorr],
      ['put the longitude correction on the wrong way round', A - W.eot - W.lonCorr + W.dstCorr],
      ['put the equation of time on the wrong way round', A + W.eot + W.lonCorr + W.dstCorr]
    ];
    if (W.dst) cand.push(['forgot the clocks are forward for summer', A - W.eot + W.lonCorr]);
    var best = null;
    cand.forEach(function (c) {
      var e = Math.abs(wrapM(ans - c[1] + 720) - 720), eT = Math.abs(wrapM(c[1] - T + 720) - 720);
      if (eT > 4 && e <= 4 && (!best || e < best.e)) best = { why: c[0], e: e };
    });
    return best;
  }
  function verdict() {
    var W = S.W, v = $('verdict');
    if (S.mode === 'move') {
      v.className = 'verdict';
      v.innerHTML = 'Drag the slider, or press <b>P</b> to let the day run. The green curve is the path the tip of the shadow takes today; the gold figure of eight is where it falls at noon by the clock, through the year.';
      return;
    }
    if (S.ans == null) {
      v.className = 'verdict';
      v.innerHTML = 'Read the shadow, work through the notebook, and put down what the town clock says. The dial reads to about five minutes; the corrections can come to half an hour or more.';
      return;
    }
    var err = wrapM(S.ans - S.q.clock + 720) - 720, a = Math.abs(err);
    var t = '<b>The town clock says ' + hm(S.q.clock) + '.</b> You said ' + hm(S.ans) + ', ' +
      (a === 0 ? 'to the minute.' : (a >= 60 ? Math.floor(a / 60) + ' h ' + (a % 60) + ' min' : mins(a)) + (err > 0 ? ' fast.' : ' slow.')) + ' ';
    if (a <= 4) { v.className = 'verdict good'; t += 'That is as close as anyone reads a dial.'; }
    else if (a <= 10) { v.className = 'verdict good'; t += 'Close enough to catch a train in ' + esc(W.name) + ', just.'; }
    else {
      v.className = 'verdict warn';
      var dg = diagnose(S.ans);
      t += dg ? 'It looks as though you ' + dg.why + '.' : 'Check the reading against the hour lines, then go through the corrections one at a time.';
    }
    t += ' The shadow was on ' + hm(S.q.ast) + ' sun time.';
    t += '<div class="opts"><button class="btn small ghost" id="btnAgain">Another reading</button></div>';
    v.innerHTML = t;
  }

  /* ---------- status ---------- */
  function status() {
    var W = S.W, clock = currentClock(), reveal = S.mode === 'move' || S.ans != null;
    $('clockBox').innerHTML = clockSvg(clock, !reveal);
    $('clockDigits').textContent = reveal ? hm(clock) + (W.dst ? ' summer time' : '') : '—:—';
    $('book').innerHTML = chain(W.toSun(clock), reveal) +
      '<div class="last">' + (S.mode === 'read'
        ? (S.ans == null ? 'Sun time + longitude + equation of time + summer time = the clock. Signs matter.' : 'Every line of the sum above is on the dial somewhere, or on the chart under it.')
        : 'Sun ' + altAz(clock) + '.') + '</div>';
    $('answerRow').style.display = S.mode === 'read' ? 'contents' : 'none';
    $('moveRow').style.display = S.mode === 'move' ? '' : 'none';
    $('slider').value = S.clock;
    $('sliderOut').textContent = hm(S.clock) + ' by the clock';
    $('btnPlay').textContent = S.play ? 'Stop' : 'Let the day run';
    var chips = document.querySelectorAll('[data-mode]');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('on', chips[i].getAttribute('data-mode') === S.mode);
    readout();
  }
  function altAz(clock) {
    var W = S.W, H = (W.toSun(clock) - 720) / 4, s = sunVec(H, W.dec, W.lat);
    var alt = Math.asin(clamp(s.u, -1, 1)) * DEG, az = (Math.atan2(s.e, s.n) * DEG + 360) % 360;
    return alt < -0.833 ? 'below the horizon' : 'at ' + alt.toFixed(1) + '° altitude, bearing ' + az.toFixed(0) + '°';
  }
  function readout() {
    var W = S.W, out = $('readout');
    if (S.mode === 'move' && S.hoverAst != null) {
      out.textContent = 'That line on the dial is ' + hm(S.hoverAst) + ' sun time, which in ' + W.name + ' today is ' + hm(W.toClock(S.hoverAst)) + ' on the town clock.';
    } else if (S.mode === 'move') {
      out.textContent = 'Move over the dial to read any line on it and see what the clock would say.';
    } else {
      out.textContent = 'The shadow of the style is the reading; the dot at its tip is the nodus, which also tells the season.';
    }
  }

  function facts() {
    var W = S.W;
    $('plWho').textContent = dms(W.lat, 'N', 'S') + ' · ' + dms(W.lon, 'E', 'W') + ' · ' + W.mat.n + ', ' + W.made;
    $('plName').textContent = 'The dial at ' + W.name;
    $('plBlurb').innerHTML = esc('It stands ' + W.place + ', ' + W.maker + ' in ' + W.made + '. The style is set at ' + W.lat.toFixed(1) +
      '°, the latitude of the town, so that it points at the celestial pole and runs parallel to the axis the sky turns about. Round the edge: ') +
      '<em>' + esc(W.motto[0].charAt(0) + W.motto[0].slice(1).toLowerCase()) + '</em>' + esc(' — “' + W.motto[1] + '.”');
    $('dayOut').textContent = longDate(W.date) + (S.day === 0 ? ' (today)' : '');
    $('fDate').textContent = longDate(W.date);
    $('fLat').textContent = dms(W.lat, 'N', 'S') + ', style at ' + W.lat.toFixed(1) + '°';
    $('fLon').textContent = dms(W.lon, 'E', 'W') + ', zone UTC' + (W.zone >= 0 ? '+' : '−') + Math.abs(W.zone);
    $('fDec').textContent = (W.dec >= 0 ? '+' : '−') + Math.abs(W.dec).toFixed(2) + '°';
    $('fEot').textContent = (W.eot >= 0 ? 'sun fast ' : 'sun slow ') + mins(W.eot, true);
    $('fNoon').textContent = hm(W.toClock(720)) + ' by the clock';
    $('fSun').textContent = W.H0 >= 180 ? 'up all day' : W.H0 <= 0 ? 'down all day' : hm(W.toClock(W.riseAst)) + ' – ' + hm(W.toClock(W.setAst));
    $('fDst').textContent = W.dst ? 'clocks forward an hour' : W.keepsSummer ? 'not in force' : 'never kept here';
    eotChart();
  }

  /* ---------- the equation of time through the year ---------- */
  function eotChart() {
    var W = S.W, w = 900, h = 250, pl = 46, pr = 14, pt = 16, pb = 30;
    var ymin = -17, ymax = 18;
    function px(doy) { return pl + (w - pl - pr) * doy / 365; }
    function py(v) { return pt + (h - pt - pb) * (ymax - v) / (ymax - ymin); }
    var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="The equation of time through ' + W.y + '">';
    for (var v = -15; v <= 15; v += 5) {
      s += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + py(v) + '" y2="' + py(v) + '" stroke="' + (v === 0 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.07)') + '"/>' +
        '<text x="' + (pl - 8) + '" y="' + (py(v) + 4) + '" text-anchor="end" fill="#8b97ab" font-size="11" font-family="ui-monospace,Menlo,monospace">' + (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '</text>';
    }
    for (var mth = 0; mth < 12; mth++) {
      var dd = (Date.UTC(W.y, mth, 1) - Date.UTC(W.y, 0, 1)) / 86400000;
      s += '<line x1="' + px(dd) + '" x2="' + px(dd) + '" y1="' + pt + '" y2="' + (h - pb) + '" stroke="rgba(255,255,255,.05)"/>' +
        '<text x="' + (px(dd) + 4) + '" y="' + (h - pb + 18) + '" fill="#8b97ab" font-size="11" font-family="ui-monospace,Menlo,monospace">' + MON3[mth] + '</text>';
    }
    var path = '';
    for (var i = 0; i <= 365; i++) {
      var dt = new Date(Date.UTC(W.y, 0, 1 + i));
      var e = sun(jdOf(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 720, 0)).eot;
      path += (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(e).toFixed(1);
    }
    s += '<path d="' + path + '" fill="none" stroke="#7aa2ff" stroke-width="2"/>';
    var today = (Date.UTC(W.y, W.m, W.d) - Date.UTC(W.y, 0, 1)) / 86400000;
    s += '<line x1="' + px(today) + '" x2="' + px(today) + '" y1="' + pt + '" y2="' + (h - pb) + '" stroke="rgba(100,240,200,.45)" stroke-dasharray="3 3"/>' +
      '<circle cx="' + px(today) + '" cy="' + py(W.eot) + '" r="5" fill="#64f0c8"/>' +
      '<text x="' + (px(today) + (today > 300 ? -9 : 9)) + '" y="' + (py(W.eot) + (W.eot > 12 ? 18 : -9)) + '" text-anchor="' + (today > 300 ? 'end' : 'start') + '" fill="#64f0c8" font-size="12" font-family="ui-monospace,Menlo,monospace">' +
      (W.eot >= 0 ? 'sun fast ' : 'sun slow ') + mins(W.eot, true) + '</text>' +
      '<text x="' + (pl + 6) + '" y="' + (pt + 12) + '" fill="#8b97ab" font-size="11" font-family="ui-monospace,Menlo,monospace">sun ahead of the clock ↑</text>' +
      '<text x="' + (pl + 6) + '" y="' + (h - pb - 6) + '" fill="#8b97ab" font-size="11" font-family="ui-monospace,Menlo,monospace">sun behind the clock ↓</text>';
    s += '</svg>';
    $('eot').innerHTML = s;
  }

  /* ---------- loading and input ---------- */
  function load() {
    S.W = build(S.day);
    S.play = false;
    newQuestion();
    S.clock = clamp(Math.round(S.W.toClock(600) / 10) * 10, 0, 1439);
    $('slider').min = 0; $('slider').max = 1439;
    facts(); status(); verdict(); resize();
  }
  function setMode(m) { S.mode = m; S.play = false; S.hoverAst = null; status(); verdict(); draw(); }

  cv.addEventListener('pointermove', function (e) {
    if (S.mode !== 'move') return;
    var rc = cv.getBoundingClientRect();
    var x = (e.clientX - rc.left - cx) / R, y = -(e.clientY - rc.top - cy) / R;
    if (Math.hypot(x, y) > 0.99) { S.hoverAst = null; readout(); draw(); return; }
    var dx = x - S.W.O.x, dy = y - S.W.O.y;
    if (Math.hypot(dx, dy) < 0.04) return;
    var th = Math.atan2(dx, dy), H = Math.atan2(Math.sin(th), Math.cos(th) * sind(S.W.lat)) * DEG;
    S.hoverAst = 720 + H * 4;
    readout(); draw();
  });
  cv.addEventListener('pointerleave', function () { S.hoverAst = null; readout(); draw(); });

  function submit() {
    var v = $('ansIn').value, m = /^(\d{1,2}):(\d{2})/.exec(v || '');
    if (!m) { $('ansIn').focus(); return; }
    S.ans = (+m[1]) * 60 + (+m[2]);
    status(); verdict(); draw();
  }
  $('ansForm').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  $('verdict').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#btnAgain');
    if (b) { newQuestion(); status(); verdict(); draw(); }
  });
  var chipEls = document.querySelectorAll('[data-mode]');
  for (var ci = 0; ci < chipEls.length; ci++) chipEls[ci].addEventListener('click', function () { setMode(this.getAttribute('data-mode')); });
  $('slider').addEventListener('input', function () { S.clock = +this.value; S.play = false; status(); draw(); });
  var last = 0;
  function tick(t) {
    if (!S.play) return;
    if (last) {
      S.clock += (t - last) / 1000 * 40;       // forty minutes a second
      if (S.clock > 1439) S.clock = 0;
      status(); draw();
    }
    last = t;
    requestAnimationFrame(tick);
  }
  function togglePlay() {
    if (S.mode !== 'move') setMode('move');
    S.play = !S.play; last = 0; status();
    if (S.play) requestAnimationFrame(tick);
  }
  $('btnPlay').addEventListener('click', togglePlay);
  function goDay(d) { S.day = d; load(); }
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  document.addEventListener('keydown', function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') goDay(S.day - 1);
    else if (e.key === 'ArrowRight') goDay(S.day + 1);
    else if (e.key === 'p' || e.key === 'P') togglePlay();
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 60); });

  load();
})();
