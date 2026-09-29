/* drift.quibo.games — The Benchmark
   Levelling. The day's number lays a village across a hillside, puts a spring at one end of
   it and a trough at the other, and asks whether a pipe could carry the water down without a
   pump. You run a line of levels from an Ordnance Survey benchmark on the church tower to a
   second mark at the far end: set up the level, read an E-pattern staff through the telescope
   to the millimetre, book it rise-and-fall, check the arithmetic, close on the far mark,
   share out the misclosure, and give the parish its answer. The instrument carries a small
   collimation error, so unbalanced sights cost you. Village, ground and marks are invented.
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
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function m3(mm) { var s = mm < 0 ? '−' : ''; return s + (Math.abs(mm) / 1000).toFixed(3); }
  function sgn(mm) { return (mm > 0 ? '+' : mm < 0 ? '−' : '±') + Math.abs(mm); }
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- the rules of the job ---------- */
  var STAFF_MIN = 0.25, STAFF_MAX = 3.9;   // a 4 m staff, and nobody trusts the very ends
  var MAXSIGHT = 60, MINSIGHT = 3;          // metres
  var TOL_K = 12;                           // allowable misclosure, mm × √km
  var PIPE = 200;                           // the parish wants at least 1 in 200

  /* ---------- names ---------- */
  var PRE = ['Ash', 'Brack', 'Cold', 'Dun', 'Elder', 'Fern', 'Hollow', 'Kings', 'Long', 'Nether', 'Oak', 'Rush', 'Thorn', 'Wend', 'Yarn', 'Bram', 'Cress', 'Hart'];
  var SUF = ['combe', 'holt', 'mere', 'stow', 'ford', 'worthy', 'barrow', 'ley', 'hurst', 'wick', 'den', 'cote'];
  var TAIL = ['', '', '', '', ' Parva', ' Magna', ' St Mary', ' Cross'];
  var SPRINGS = ["St Anne's Well", 'the Lady Well', 'the Holy Well', "the Monk's Spring", 'the Lamb Spring', 'the Cold Spring', 'the Wishing Well', 'the Bubbler'];
  var TROUGHS = [
    ['the trough in the square', 'Trough'],
    ['the horse trough by the forge', 'Trough'],
    ['the pump on the green', 'Pump'],
    ['the conduit house by the school', 'Conduit'],
    ['the washing trough at the foot of Mill Lane', 'Trough']
  ];
  var BMS = [
    'the crow’s-foot cut mark on the south-west buttress of the church tower',
    'the cut mark on the church porch, left of the door',
    'the flush bracket in the church tower, just above the plinth'
  ];
  var TBMS = [
    'the flush bracket on the old school',
    'the cut mark on the bridge parapet',
    'the cut mark on the milestone at the parish boundary',
    'the bolt in the step of the chapel'
  ];
  var WHY = [
    'The pump in the square has run dry two summers running',
    'The vestry has been left money for a village water supply',
    'The new cottages at the bottom of the village have no water at all',
    'The squire has offered the pipe if the parish digs the trench'
  ];
  var LEVELS = ['a dumpy level', 'a tilting level', 'an automatic level', 'a quickset level'];

  /* ---------- build the day ---------- */
  function build(off) {
    var d = dateFor(off), r = rng(seedForDate(d) ^ 0x42454e43);
    var W = { date: d };
    W.village = pick(r, PRE) + pick(r, SUF) + pick(r, TAIL);
    W.spring = pick(r, SPRINGS);
    var tr = pick(r, TROUGHS); W.trough = tr[0]; W.troughShort = tr[1];
    W.bmDesc = pick(r, BMS); W.tbmDesc = pick(r, TBMS);
    W.why = pick(r, WHY); W.level = pick(r, LEVELS);
    W.checked = 1890 + Math.floor(r() * 70);

    var L = Math.round(460 + r() * 520);
    var base = Math.round((38 + r() * 110) * 1000) / 1000;
    var comps = [
      [3 + r() * 9, 260 + r() * 520, r() * 6.2832],
      [0.8 + r() * 2.4, 70 + r() * 110, r() * 6.2832],
      [0.2 + r() * 0.6, 22 + r() * 30, r() * 6.2832]
    ];
    var g = (r() - 0.5) * 0.05;
    function raw(x) {
      var z = g * x;
      for (var i = 0; i < comps.length; i++) z += comps[i][0] * Math.sin(6.2832 * x / comps[i][1] + comps[i][2]);
      return z;
    }
    var ms = 0;
    for (var x = 0; x < L; x++) ms = Math.max(ms, Math.abs(raw(x + 1) - raw(x)));
    var k = ms > 0.1 ? 0.1 / ms : 1, z0 = raw(0), flip = 1;
    var xs = Math.round(L * (0.16 + r() * 0.22) * 2) / 2, xt = Math.round(L * (0.58 + r() * 0.24) * 2) / 2;
    if (raw(xs) < raw(xt) && r() < 0.75) flip = -1;
    function Z(x) { return base + flip * k * (raw(x) - z0); }
    W.Z = Z; W.L = L;
    W.specials = [
      { x: xs, pt: 'Spring', kind: 'spring', remark: W.spring.replace(/^the /, '') + ', at the well head' },
      { x: xt, pt: W.troughShort, kind: 'trough', remark: W.trough.replace(/^the /, '') + ', rim' }
    ];
    W.xs = xs; W.xt = xt;
    W.bm = Math.round(base * 1000);                  // mm above datum
    W.tbm = Math.round(Z(L) * 1000);

    /* set-ups: from each staff position, find an instrument station and a change point that
       give readable staff readings, with the spring and trough as intermediate sights */
    var setups = [], xb = 0, guard = 0;
    while (xb < L && guard++ < 80) {
      var hi = 1.38 + r() * 0.25, best = null;
      for (var xi = xb + MINSIGHT; xi <= Math.min(xb + MAXSIGHT, L - MINSIGHT); xi += 1) {
        var H = Z(xi) + hi, bsr = H - Z(xb);
        if (bsr < STAFF_MIN || bsr > STAFF_MAX) continue;
        var cands = [];
        if (L - xi <= MAXSIGHT && L - xi >= MINSIGHT) cands.push(L);
        for (var xf = xi + MINSIGHT; xf <= Math.min(xi + MAXSIGHT, L - 12); xf += 2) cands.push(xf);
        for (var c = 0; c < cands.length; c++) {
          var f = cands[c], fsr = H - Z(f);
          if (fsr < STAFF_MIN || fsr > STAFF_MAX) continue;
          var ok = true;
          for (var p = 0; p < W.specials.length; p++) {
            var sp = W.specials[p];
            if (sp.x > xb && sp.x < f) { var ir = H - Z(sp.x); if (ir < STAFF_MIN || ir > STAFF_MAX || Math.abs(f - sp.x) < 1.5) ok = false; }
            if (Math.abs(sp.x - f) < 1.5) ok = false;
          }
          if (!ok) continue;
          var sc = (f - xb) - 1.2 * Math.abs((xi - xb) - (f - xi)) + (f === L ? 1000 : 0);
          if (!best || sc > best.sc) best = { sc: sc, xi: xi, xf: f };
        }
      }
      if (!best) best = { xi: Math.min(xb + MINSIGHT, L - 1), xf: Math.min(xb + 2 * MINSIGHT, L) };
      setups.push({ xb: xb, xi: best.xi, xf: best.xf, hi: hi, H: Z(best.xi) + hi });
      xb = best.xf;
    }
    W.setups = setups;

    /* the level book: rows, and the order the sights are taken in */
    var rows = [{ pt: 'BM', x: 0, k: 0, bs: -1, is: -1, fs: -1, kind: 'bm', remark: 'BM, ' + (W.bm / 1000).toFixed(3) + ' m OD' }];
    var sights = [];
    setups.forEach(function (su, j) {
      function mk(x, kind, row) { sights.push({ k: j + 1, kind: kind, x: x, dist: Math.abs(x - su.xi), H: su.H, row: row }); return sights.length - 1; }
      rows[rows.length - 1].bs = mk(su.xb, 'BS', rows.length - 1);
      W.specials.filter(function (s) { return s.x > su.xb && s.x < su.xf; })
        .sort(function (a, b) { return a.x - b.x; })
        .forEach(function (s) {
          rows.push({ pt: s.pt, x: s.x, k: j + 1, bs: -1, is: -1, fs: -1, kind: s.kind, remark: s.remark });
          rows[rows.length - 1].is = mk(s.x, 'IS', rows.length - 1);
        });
      var fin = su.xf === L;
      rows.push({ pt: fin ? 'TBM' : 'CP' + (j + 1), x: su.xf, k: j + 1, bs: -1, is: -1, fs: -1, kind: fin ? 'tbm' : 'cp',
        remark: fin ? 'TBM, ' + (W.tbm / 1000).toFixed(3) + ' m OD' : 'change point' });
      rows[rows.length - 1].fs = mk(su.xf, 'FS', rows.length - 1);
    });
    W.rows = rows; W.sights = sights;

    /* the instrument: a small collimation error, and a millimetre of doubt in every reading.
       Draw until the true misclosure is small but not nothing */
    W.allow = Math.round(TOL_K * Math.sqrt(L / 1000));
    var rn = rng(seedForDate(d) ^ 0x4c564c53), tries = 0, e;
    do {
      W.coll = (6 + rn() * 22) * (rn() < 0.5 ? -1 : 1);            // seconds of arc, + means tilted up
      var tc = W.coll / 206265;
      sights.forEach(function (s) {
        s.val = Math.round((s.H - Z(s.x) + s.dist * tc + gauss(rn) * 0.0006) * 1000);
      });
      e = W.bm;
      sights.forEach(function (s) { if (s.kind === 'BS') e += s.val; else if (s.kind === 'FS') e -= s.val; });
      e -= W.tbm;
    } while ((Math.abs(e) < 2 || Math.abs(e) > 0.75 * W.allow) && ++tries < 80);
    var dB = 0, dF = 0;
    sights.forEach(function (s) { if (s.kind === 'BS') dB += s.dist; else if (s.kind === 'FS') dF += s.dist; });
    W.dB = dB; W.dF = dF;
    W.collMM = Math.round(W.coll / 206265 * (dB - dF) * 1000 * 10) / 10;

    var rs = rng(seedForDate(d) ^ 0x5354);
    sights.forEach(function (s) { s.off = (rs() - 0.5) * 50; });
    return W;
  }

  /* ---------- state ---------- */
  var S = { day: 0, W: null, i: 0, got: [], tries: 0, ans: null, revealed: false, note: null };

  function got(ix) { return ix >= 0 ? S.got[ix] : null; }

  /* rise-and-fall reduction of whatever has been booked so far (all in mm) */
  function reduce() {
    var W = S.W, out = [], last = null, rl = W.bm, ok = true;
    W.rows.forEach(function (row, i) {
      var o = {};
      if (i === 0) { o.rl = rl; last = got(row.bs); out.push(o); return; }
      var cur = row.is >= 0 ? got(row.is) : got(row.fs);
      if (!ok || cur == null || last == null) { ok = false; out.push(o); return; }
      var dd = last - cur;
      if (dd >= 0) o.rise = dd; else o.fall = -dd;
      rl += dd; o.rl = rl;
      last = cur;
      if (row.bs >= 0) last = got(row.bs);
      out.push(o);
    });
    return out;
  }
  function done() { return S.i >= S.W.sights.length; }
  function closing() {
    var W = S.W, red = reduce(), n = W.setups.length;
    var e = red[red.length - 1].rl - W.tbm;
    var adj = W.rows.map(function (row, i) {
      var c = -Math.round(e * row.k / n);
      return { c: c, rl: red[i].rl + c };
    });
    var iS = rowOf('spring'), iT = rowOf('trough');
    return { red: red, e: e, n: n, adj: adj, fall: adj[iS].rl - adj[iT].rl, raw: red[iS].rl - red[iT].rl, iS: iS, iT: iT };
  }
  function rowOf(kind) { for (var i = 0; i < S.W.rows.length; i++) if (S.W.rows[i].kind === kind) return i; return -1; }

  /* ---------- the profile ---------- */
  var pv = $('profile'), pc = pv.getContext('2d'), scv = $('scope'), sc = scv.getContext('2d');
  var PV = {};
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = pv.clientWidth, h = pv.clientHeight;
    pv.width = Math.round(w * dpr); pv.height = Math.round(h * dpr);
    pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    PV.w = w; PV.h = h;
    var sw = scv.clientWidth;
    scv.width = Math.round(sw * dpr); scv.height = Math.round(sw * dpr);
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);
    PV.s = sw;
    drawProfile(); drawScope();
  }
  function drawProfile() {
    var W = S.W, w = PV.w, h = PV.h;
    if (!W || !w) return;
    var zmin = 1e9, zmax = -1e9;
    for (var x = 0; x <= W.L; x += 2) { var z = W.Z(x); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
    zmax += 3; zmin -= 1.5;
    var padL = 18, padR = 18, top = 30, bot = 26;
    var X = function (x) { return padL + (x / W.L) * (w - padL - padR); };
    var Y = function (z) { return top + (zmax - z) / (zmax - zmin) * (h - top - bot); };
    var ex = ((h - top - bot) / (zmax - zmin)) / ((w - padL - padR) / W.L);
    pc.clearRect(0, 0, w, h);
    var sky = pc.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1220'); sky.addColorStop(1, '#070a10');
    pc.fillStyle = sky; pc.fillRect(0, 0, w, h);
    // ground
    pc.beginPath(); pc.moveTo(X(0), h);
    for (x = 0; x <= W.L; x += 2) pc.lineTo(X(x), Y(W.Z(x)));
    pc.lineTo(X(W.L), Y(W.Z(W.L))); pc.lineTo(X(W.L), h); pc.closePath();
    var gg = pc.createLinearGradient(0, top, 0, h);
    gg.addColorStop(0, '#24402d'); gg.addColorStop(1, '#0f1a13');
    pc.fillStyle = gg; pc.fill();
    pc.beginPath();
    for (x = 0; x <= W.L; x += 2) { if (x === 0) pc.moveTo(X(x), Y(W.Z(x))); else pc.lineTo(X(x), Y(W.Z(x))); }
    pc.strokeStyle = '#5f8f69'; pc.lineWidth = 1.5; pc.stroke();

    // landmarks
    var bx = X(0), by = Y(W.Z(0));
    pc.fillStyle = '#6b7385';
    pc.fillRect(bx, by - 30, 12, 30); pc.beginPath(); pc.moveTo(bx - 1, by - 30); pc.lineTo(bx + 6, by - 44); pc.lineTo(bx + 13, by - 30); pc.fill();
    var ex2 = X(W.L), ey = Y(W.Z(W.L));
    pc.fillRect(ex2 - 16, ey - 13, 16, 13); pc.beginPath(); pc.moveTo(ex2 - 18, ey - 13); pc.lineTo(ex2 - 8, ey - 21); pc.lineTo(ex2 + 2, ey - 13); pc.fill();

    // pipe, once revealed
    if (S.revealed) {
      pc.beginPath();
      for (x = W.xs; x <= W.xt; x += 1) { var py = Y(W.Z(x)) + 5; if (x === W.xs) pc.moveTo(X(x), py); else pc.lineTo(X(x), py); }
      pc.strokeStyle = 'rgba(122,162,255,.8)'; pc.lineWidth = 2.5; pc.setLineDash([]); pc.stroke();
      // the spring's level carried across, to show the fall
      pc.beginPath(); pc.moveTo(X(W.xs), Y(W.Z(W.xs))); pc.lineTo(X(W.xt), Y(W.Z(W.xs)));
      pc.strokeStyle = 'rgba(122,162,255,.35)'; pc.lineWidth = 1; pc.setLineDash([3, 4]); pc.stroke(); pc.setLineDash([]);
    }
    // spring and trough
    var sx = X(W.xs), sy = Y(W.Z(W.xs));
    pc.fillStyle = '#7aa2ff'; pc.beginPath(); pc.arc(sx, sy - 6, 4.5, 0, 6.2832); pc.fill();
    var tx = X(W.xt), ty = Y(W.Z(W.xt));
    pc.fillStyle = '#9aa6bb'; pc.fillRect(tx - 7, ty - 7, 14, 7); pc.fillStyle = '#7aa2ff'; pc.fillRect(tx - 5, ty - 6, 10, 2);

    // set-ups taken so far
    var cur = done() ? null : W.sights[S.i];
    var curK = cur ? cur.k : W.setups.length + 1;
    W.setups.forEach(function (su, j) {
      if (j + 1 > curK) return;
      var ix = X(su.xi), iy = Y(W.Z(su.xi)), hy = Y(su.H);
      var active = j + 1 === curK;
      pc.strokeStyle = active ? '#ffce6a' : 'rgba(232,237,245,.35)'; pc.lineWidth = 1.2;
      pc.beginPath(); pc.moveTo(ix - 4, iy); pc.lineTo(ix, hy + 3); pc.lineTo(ix + 4, iy); pc.moveTo(ix, iy); pc.lineTo(ix, hy + 3); pc.stroke();
      pc.fillStyle = active ? '#ffce6a' : 'rgba(232,237,245,.5)'; pc.fillRect(ix - 4, hy - 2, 8, 4);
      W.sights.forEach(function (s, si) {
        if (s.k !== j + 1) return;
        var isCur = si === S.i, seen = si < S.i;
        if (!isCur && !seen) return;
        var stx = X(s.x), sty = Y(W.Z(s.x));
        pc.strokeStyle = isCur ? '#ffce6a' : 'rgba(232,237,245,.18)'; pc.lineWidth = 1;
        pc.setLineDash(isCur ? [4, 3] : []);
        pc.beginPath(); pc.moveTo(ix, hy); pc.lineTo(stx, hy); pc.stroke(); pc.setLineDash([]);
        if (isCur || active) {
          pc.strokeStyle = isCur ? '#ffce6a' : 'rgba(255,206,106,.4)'; pc.lineWidth = 2;
          pc.beginPath(); pc.moveTo(stx, sty); pc.lineTo(stx, Math.min(sty - 4, hy - 6)); pc.stroke();
        }
      });
    });
    // labels
    pc.font = '600 10px ui-monospace,Menlo,monospace'; pc.textAlign = 'center';
    function lab(t, x, y, col) { pc.fillStyle = col; pc.fillText(t, x, y); }
    lab('BM', bx + 6, by - 50, '#e8edf5');
    lab('TBM', ex2 - 8, ey - 27, '#e8edf5');
    lab('SPRING', sx, sy - 16, '#7aa2ff');
    lab(W.troughShort.toUpperCase(), tx, ty - 14, '#9aa6bb');
    if (S.revealed) {
      var C = closing();
      lab(m3(C.adj[C.iS].rl), sx, sy - 28, '#e8edf5');
      lab(m3(C.adj[C.iT].rl), tx, ty - 26, '#e8edf5');
    }
    pc.textAlign = 'left'; pc.fillStyle = '#8b97ab';
    pc.fillText(Math.round(W.L) + ' m  ·  heights exaggerated ×' + Math.round(ex), padL, h - 8);
  }

  /* ---------- the telescope ---------- */
  function drawScope() {
    var W = S.W, D = PV.s;
    if (!W || !D) return;
    var s = done() ? W.sights[W.sights.length - 1] : W.sights[S.i];
    var R = s.val, ppm = D / 230, cx = D / 2, cy = D / 2;
    sc.clearRect(0, 0, D, D);
    sc.save();
    sc.beginPath(); sc.arc(cx, cy, D / 2 - 2, 0, 6.2832); sc.clip();
    var bg = sc.createLinearGradient(0, 0, D, D);
    bg.addColorStop(0, '#5d7a4f'); bg.addColorStop(0.5, '#6f8a5b'); bg.addColorStop(1, '#4b6641');
    sc.fillStyle = bg; sc.fillRect(0, 0, D, D);
    // staff face: 70 mm wide
    var sw = 70 * ppm, x0 = cx + s.off * ppm - sw / 2, x1 = x0 + sw;
    sc.fillStyle = '#f4f0e2'; sc.fillRect(x0, 0, sw, D);
    sc.fillStyle = 'rgba(0,0,0,.18)'; sc.fillRect(x1, 0, 3, D);
    var Y = function (mm) { return cy - (mm - R) * ppm; };
    var lo = Math.floor((R - 140) / 100), hi = Math.ceil((R + 140) / 100);
    for (var dm = lo; dm <= hi; dm++) {
      if (dm < 0) continue;
      var b = dm * 100, m = Math.floor(dm / 10);
      var col = m % 2 ? '#b8222b' : '#141414';
      var left = dm % 2 === 0, half = sw / 2, arm = 35 * ppm, spine = 10 * ppm;
      sc.fillStyle = col;
      var ex = left ? x0 : x1 - spine;
      sc.fillRect(ex, Y(b + 50), spine, 50 * ppm);                       // the spine of the E
      [0, 20, 40].forEach(function (a) {                                  // its three arms
        sc.fillRect(left ? x0 : x1 - arm, Y(b + a + 10), arm, 10 * ppm);
      });
      [60, 80].forEach(function (a) {                                     // the rest of the decimetre
        sc.fillRect(left ? x1 - 16 * ppm : x0, Y(b + a + 10), 16 * ppm, 10 * ppm);
      });
      // the figures: decimetre large, metre small and red
      var nx = left ? x0 + half + 4 * ppm : x0 + 4 * ppm;
      sc.font = '700 ' + Math.round(38 * ppm) + 'px Helvetica,Arial,sans-serif';
      sc.textAlign = 'left'; sc.textBaseline = 'alphabetic';
      sc.fillStyle = col; sc.fillText(String(dm % 10), nx, Y(b + 6));
      var nw = sc.measureText(String(dm % 10)).width;
      sc.font = '700 ' + Math.round(13 * ppm) + 'px Helvetica,Arial,sans-serif';
      sc.fillStyle = '#b8222b'; sc.fillText(String(m), nx + nw + 2 * ppm, Y(b + 32));
    }
    // a little atmosphere
    var vg = sc.createRadialGradient(cx, cy, D * 0.3, cx, cy, D * 0.52);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    sc.fillStyle = vg; sc.fillRect(0, 0, D, D);
    // the reticule
    sc.strokeStyle = 'rgba(10,10,10,.9)'; sc.lineWidth = 1.2;
    sc.beginPath(); sc.moveTo(0, cy); sc.lineTo(D, cy); sc.moveTo(cx, cy - D * 0.36); sc.lineTo(cx, D); sc.stroke();
    sc.beginPath(); sc.moveTo(cx - D * 0.07, cy - D * 0.2); sc.lineTo(cx + D * 0.07, cy - D * 0.2);
    sc.moveTo(cx - D * 0.07, cy + D * 0.2); sc.lineTo(cx + D * 0.07, cy + D * 0.2); sc.stroke();
    sc.restore();
    sc.beginPath(); sc.arc(cx, cy, D / 2 - 2, 0, 6.2832);
    sc.strokeStyle = '#2a3242'; sc.lineWidth = 3; sc.stroke();
  }

  /* ---------- the book ---------- */
  function book() {
    var W = S.W, red = reduce(), C = done() ? closing() : null;
    var h = '<table class="lbook"><thead><tr><th>Point</th><th>Set-up</th><th>BS</th><th>IS</th><th>FS</th><th>Rise</th><th>Fall</th><th>Reduced level</th><th>Corr.</th><th>Adjusted</th><th>Remarks</th></tr></thead><tbody>';
    var cur = done() ? -1 : S.i;
    function cell(ix) {
      if (ix < 0) return '<td></td>';
      var v = got(ix), cls = ix === cur ? ' class="cur"' : '';
      return '<td' + cls + '>' + (v == null ? (ix === cur ? '?' : '') : m3(v)) + '</td>';
    }
    W.rows.forEach(function (row, i) {
      var o = red[i], sp = row.kind === 'spring' || row.kind === 'trough';
      h += '<tr' + (sp ? ' class="sp"' : row.kind === 'bm' || row.kind === 'tbm' ? ' class="bm"' : '') + '>';
      h += '<td>' + row.pt + '</td><td>' + (row.k || '') + '</td>' + cell(row.bs) + cell(row.is) + cell(row.fs);
      h += '<td>' + (o.rise != null ? m3(o.rise) : '') + '</td><td>' + (o.fall != null ? m3(o.fall) : '') + '</td>';
      h += '<td><b>' + (o.rl != null ? m3(o.rl) : '') + '</b></td>';
      if (S.revealed && C) h += '<td>' + (C.adj[i].c ? sgn(C.adj[i].c) : '0') + '</td><td><b>' + m3(C.adj[i].rl) + '</b></td>';
      else h += '<td></td><td></td>';
      h += '<td class="rm">' + row.remark + '</td></tr>';
    });
    if (C) {
      var sb = 0, sf = 0, sr = 0, sfl = 0;
      W.sights.forEach(function (s, ix) { if (s.kind === 'BS') sb += S.got[ix]; else if (s.kind === 'FS') sf += S.got[ix]; });
      red.forEach(function (o) { if (o.rise) sr += o.rise; if (o.fall) sfl += o.fall; });
      h += '<tr class="sum"><td>Σ</td><td></td><td>' + m3(sb) + '</td><td></td><td>' + m3(sf) + '</td><td>' + m3(sr) + '</td><td>' + m3(sfl) + '</td><td></td><td></td><td></td><td></td></tr>';
      S.checks = { sb: sb, sf: sf, sr: sr, sfl: sfl, first: red[0].rl, last: red[red.length - 1].rl };
    }
    h += '</tbody></table>';
    $('book').innerHTML = h;
    var c = $('book').querySelector('td.cur');
    if (c && c.scrollIntoView && S.follow) { var bx = $('book'); bx.scrollLeft = Math.max(0, c.offsetLeft - 120); }
  }

  /* ---------- the sight in hand ---------- */
  var KINDS = { BS: 'back sight', IS: 'intermediate sight', FS: 'fore sight' };
  function sightInfo() {
    var W = S.W;
    if (done()) {
      $('sInfo').innerHTML = '<b>Every sight is booked.</b> The line has closed on the far mark. Work down to the checks below.';
      $('rdIn').disabled = true; $('btnBook').disabled = true; $('btnRest').disabled = true;
      $('sCount').textContent = W.sights.length + ' of ' + W.sights.length + ' sights booked';
      return;
    }
    var s = W.sights[S.i], row = W.rows[s.row];
    $('sInfo').innerHTML = '<b>Set-up ' + s.k + ' of ' + W.setups.length + ' · ' + KINDS[s.kind] + '</b> to the staff on <b>' + row.pt + '</b>' +
      (row.kind === 'spring' || row.kind === 'trough' ? ' (' + row.remark + ')' : '') + ', ' + s.dist.toFixed(0) + ' m away.';
    $('rdIn').disabled = false; $('btnBook').disabled = false; $('btnRest').disabled = false;
    $('sCount').textContent = S.i + ' of ' + W.sights.length + ' sights booked';
  }
  function say(html, cls) { var el = $('rdMsg'); el.className = 'verdict' + (cls ? ' ' + cls : ''); el.innerHTML = html; }

  function bookIt() {
    if (done()) return;
    var s = S.W.sights[S.i], raw = $('rdIn').value.trim().replace(',', '.');
    var v = parseFloat(raw);
    if (v >= 10 && v < 5000) v = v / 1000;                 // typed in millimetres
    if (!(v >= 0) || v > 5) { $('rdIn').focus(); say('Type the reading in metres, to three places: something like <b>1.437</b>.'); return; }
    var mm = Math.round(v * 1000), diff = mm - s.val, ad = Math.abs(diff);
    if (ad <= 2) {
      S.got[S.i] = mm;
      say(ad === 0 ? 'Booked <b>' + m3(mm) + '</b>. Spot on.' : 'Booked <b>' + m3(mm) + '</b>. Within the millimetre or two anyone would estimate.', 'good');
      advance(); return;
    }
    S.tries++;
    var why;
    if (Math.abs(ad - 1000) <= 3) why = 'The centimetres are right but you are a whole <b>metre</b> out. Look at the small red figure beside the big one.';
    else if (Math.abs(ad - 100) <= 3) why = 'Out by exactly a <b>decimetre</b>. Take the big figure <em>below</em> the hair, not the one above it.';
    else if (Math.abs(ad - 50) <= 4) why = 'About <b>five centimetres</b> out. The E covers the bottom half of each decimetre; the loose bars are the top half.';
    else if (ad < 25) why = 'Close. Count the <b>centimetre</b> bars up from the big figure under the hair again: each black and each white band is 10 mm.';
    else why = 'Not that. Find the big figure just below the horizontal hair, that is the decimetre, then count the centimetre bands up to the hair and guess the millimetres.';
    if (S.tries >= 3) {
      S.got[S.i] = s.val;
      say('The staffman calls it out: <b>' + m3(s.val) + '</b>. ' + why.replace(/^[^.]*\. /, ''), 'warn');
      advance(); return;
    }
    say(why, 'warn');
  }
  function advance() {
    S.i++; S.tries = 0; $('rdIn').value = '';
    S.follow = true; refresh(); S.follow = false;
    if (!done()) $('rdIn').focus();
  }
  function bookRest() {
    while (!done()) { S.got[S.i] = S.W.sights[S.i].val; S.i++; }
    S.tries = 0;
    say('The staffman read the rest off for you. Everything from here on is arithmetic.', '');
    refresh();
  }

  /* ---------- closing the loop ---------- */
  function checks() {
    var W = S.W, box = $('close');
    if (!done()) {
      box.innerHTML = '<p class="sub">The checks appear once the last fore sight lands on the ' + W.tbmDesc.replace(/^the /, '') + '.</p>';
      $('ansIn').disabled = true; $('btnAns').disabled = true; $('btnShow').disabled = true;
      $('qhint').textContent = 'Book every sight first.';
      return;
    }
    var C = closing(), k = S.checks, a = k.sb - k.sf, b = k.sr - k.sfl, c = k.last - k.first;
    var arith = a === b && b === c;
    var within = Math.abs(C.e) <= W.allow;
    var h = '<dl class="facts tight">' +
      '<div><dt>ΣBS − ΣFS</dt><dd>' + m3(a) + '</dd></div>' +
      '<div><dt>ΣRise − ΣFall</dt><dd>' + m3(b) + '</dd></div>' +
      '<div><dt>Last RL − first RL</dt><dd>' + m3(c) + (arith ? ' <span class="ok">✓ the arithmetic checks</span>' : '') + '</dd></div>' +
      '<div><dt>TBM by your levels</dt><dd>' + m3(k.last) + '</dd></div>' +
      '<div><dt>TBM as published</dt><dd>' + m3(W.tbm) + '</dd></div>' +
      '<div><dt>Misclosure</dt><dd>' + sgn(C.e) + ' mm over ' + C.n + ' set-ups</dd></div>' +
      '<div><dt>Allowed, 12√K</dt><dd>±' + W.allow + ' mm for ' + (W.L / 1000).toFixed(2) + ' km</dd></div>' +
      '</dl>';
    h += within
      ? '<p class="sub">The line closes within tolerance, so it is accepted, and the error is shared out rather than hunted down. The usual rule: each set-up is assumed to have added an equal share, so every reduced level taken at set-up <i>k</i> gets a correction of −(misclosure) × <i>k</i> ÷ ' + C.n + ', rounded to the millimetre.</p>'
      : '<p class="sub"><b>This is outside tolerance.</b> In the field you would go back and level the line again. Here the error is almost certainly a reading or two a couple of millimetres out, so the page lets you carry on and share it out anyway: every level taken at set-up <i>k</i> gets −(misclosure) × <i>k</i> ÷ ' + C.n + '.</p>';
    box.innerHTML = h;
    $('ansIn').disabled = S.revealed; $('btnAns').disabled = S.revealed; $('btnShow').disabled = S.revealed;
    $('qhint').textContent = 'The spring was booked at set-up ' + W.rows[C.iS].k + ' and the ' + W.troughShort.toLowerCase() + ' at set-up ' + W.rows[C.iT].k +
      '. Adjust both, then give the fall from spring to ' + W.troughShort.toLowerCase() + ' in metres. Downhill is positive.';
  }

  function verdict() {
    var W = S.W, el = $('verdict');
    if (!done() || S.ans == null && !S.revealed) { el.className = 'verdict'; el.innerHTML = 'The parish is waiting for one number.'; return; }
    var C = closing(), f = C.fall, a = S.ans, head = '', cls = 'good';
    if (a != null) {
      var cS = C.adj[C.iS].c, cT = C.adj[C.iT].c, rev = C.raw - (cS - cT);
      if (Math.abs(a - f) <= 1) head = '<b>' + m3(a) + ' m. That is the adjusted fall.</b> ';
      else {
        cls = 'warn';
        if (Math.abs(a - C.raw) <= 1) head = '<b>' + m3(a) + ' m is the fall before adjustment.</b> The misclosure has to be shared out first: ' + sgn(cS) + ' mm at the spring, ' + sgn(cT) + ' mm at the ' + W.troughShort.toLowerCase() + '. ';
        else if (Math.abs(a - rev) <= 1) head = '<b>' + m3(a) + ' m has the corrections the wrong way round.</b> If your levels came out high, the corrections take height off. ';
        else if (Math.abs(a + f) <= 1) head = '<b>' + m3(a) + ' m is the right size, wrong sign.</b> The question wants spring minus ' + W.troughShort.toLowerCase() + ', so downhill comes out positive. ';
        else if (Math.abs(Math.abs(a - f) - 100) <= 2 || Math.abs(Math.abs(a - f) - 1000) <= 2) head = '<b>' + m3(a) + ' m is out by a slipped decimal place.</b> ';
        else head = '<b>' + m3(a) + ' m is not it.</b> ';
        head += 'The adjusted levels are ' + m3(C.adj[C.iS].rl) + ' and ' + m3(C.adj[C.iT].rl) + ', a fall of <b>' + m3(f) + ' m</b>. ';
      }
    } else head = 'The adjusted levels are ' + m3(C.adj[C.iS].rl) + ' and ' + m3(C.adj[C.iT].rl) + ', a fall of <b>' + m3(f) + ' m</b>. ';
    var len = W.xt - W.xs, need = Math.round(len / PIPE * 1000), grad = f > 0 ? Math.round(len * 1000 / f) : 0;
    var out;
    if (f >= need) out = 'Over ' + len.toFixed(0) + ' m of pipe that is <b>1 in ' + grad + '</b>, inside the parish’s 1 in ' + PIPE + '. <b>It will run.</b> Dig the trench.';
    else if (f > 0) { out = 'Downhill, but over ' + len.toFixed(0) + ' m of pipe that is only <b>1 in ' + grad + '</b>, and the parish wants 1 in ' + PIPE + '. It would trickle and silt up. <b>Not by gravity alone.</b>'; if (cls === 'good') cls = 'warn'; }
    else { out = 'The ' + W.troughShort.toLowerCase() + ' stands higher than the spring. <b>No pipe will carry water there on its own.</b> It will need a pump, or a hydraulic ram driven by the spring’s own overflow.'; if (cls === 'good') cls = 'warn'; }
    var tf = Math.round((W.Z(W.xs) - W.Z(W.xt)) * 1000);
    var tail = '<br><br>The true fall, from the ground the day’s number laid down, was ' + m3(tf) + ' m, so your line got it to within ' + Math.abs(f - tf) + ' mm. ' +
      'The ' + W.level.replace(/^an? /, '') + ' had not been checked since ' + W.checked + ', and its line of sight tilted ' + Math.abs(W.coll).toFixed(0) + '″ ' + (W.coll > 0 ? 'upwards' : 'downwards') + '. ' +
      (Math.abs(W.collMM) < 0.5
        ? 'Your back sights added up to ' + W.dB.toFixed(0) + ' m and your fore sights to ' + W.dF.toFixed(0) + ' m, so close to balanced that the tilt cancelled itself out. The misclosure is nearly all the ordinary millimetre of doubt in each reading.'
        : 'Your back sights added up to ' + W.dB.toFixed(0) + ' m and your fore sights to ' + W.dF.toFixed(0) + ' m, so that tilt put ' + sgn(Math.round(W.collMM)) + ' mm into the misclosure. With every set-up balanced it would have cancelled out completely.');
    el.className = 'verdict ' + cls; el.innerHTML = head + out + tail;
  }
  $('ansForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!done() || S.revealed) return;
    var v = parseFloat($('ansIn').value.replace(',', '.').replace('−', '-'));
    if (isNaN(v)) { $('ansIn').focus(); return; }
    S.ans = Math.round(v * 1000); S.revealed = true; refresh();
  });
  $('btnShow').addEventListener('click', function () { if (!done()) return; S.ans = null; S.revealed = true; refresh(); });

  /* ---------- plaque and facts ---------- */
  function plaque() {
    var W = S.W;
    $('plWho').textContent = W.village + ' · a line of levels';
    $('plName').textContent = 'From ' + W.spring + ' to ' + W.trough;
    $('plBlurb').innerHTML = W.why + ', and ' + W.village + ' wants to know whether a pipe from ' + W.spring +
      ' could feed ' + W.trough + ' with no pump. The nearest Ordnance Survey benchmark is ' + W.bmDesc + ', <em>' + (W.bm / 1000).toFixed(3) +
      ' m</em> above Ordnance Datum Newlyn. The line will close on ' + W.tbmDesc + ', <em>' + (W.tbm / 1000).toFixed(3) + ' m</em>. Between them are ' +
      W.L + ' m of hillside and ' + W.level + ' that nobody has checked since ' + W.checked + '.';
    $('dayOut').textContent = longDate(W.date) + (S.day === 0 ? ' · today' : '');
    $('fLen').textContent = W.L + ' m';
    $('fSet').textContent = W.setups.length;
    $('fSights').textContent = W.sights.length;
    $('fPipe').textContent = (W.xt - W.xs).toFixed(0) + ' m';
    $('fAllow').textContent = '±' + W.allow + ' mm';
    $('fInst').textContent = W.level.replace(/^an? /, '');
  }

  function refresh() { sightInfo(); drawProfile(); drawScope(); book(); checks(); verdict(); }
  function load() {
    S.W = build(S.day); S.i = 0; S.got = S.W.sights.map(function () { return null; });
    S.tries = 0; S.ans = null; S.revealed = false;
    $('rdIn').value = ''; $('ansIn').value = '';
    say('Read the staff where the horizontal hair crosses it, and book it in metres.');
    plaque(); resize(); refresh();
  }

  $('rdForm').addEventListener('submit', function (ev) { ev.preventDefault(); bookIt(); });
  $('btnRest').addEventListener('click', bookRest);
  function goDay(d) { S.day = d; load(); }
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  document.addEventListener('keydown', function (ev) {
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || tg === 'CANVAS' || tg === 'BUTTON') return;
    if (ev.key === 'ArrowLeft') goDay(S.day - 1);
    else if (ev.key === 'ArrowRight') goDay(S.day + 1);
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 60); });

  load();
})();
