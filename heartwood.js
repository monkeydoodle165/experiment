/* drift.quibo.games — The Heartwood
   Tree-ring dating. The day's number grows a regional oak chronology several centuries
   long, puts up a timber building somewhere in it, and takes cores from its beams. Slide
   each core along the chronology until the rings agree, the way a dendrochronologist does:
   Baillie-Pilcher standardisation, Student's t, Gleichläufigkeit, the 3.5 line. Then turn
   the dated rings into felling dates with bark edge, sapwood estimates (9-41 rings, the
   range used for English oak) and terminus post quem, and say when the roof went up.
   The chronology, the building and its trees are invented. Self-contained. */
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
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function yy(y) { var a = String(y), b = String(y + 1); return a + '/' + (a.slice(0, 2) === b.slice(0, 2) ? b.slice(2).replace(/^0/, '') : b); }

  /* ---------- the sapwood rule: English oak, 95% range (Miles 1997) ---------- */
  var SAP_MIN = 9, SAP_MAX = 41, T_LINE = 3.5, MIN_OVERLAP = 50;

  /* ---------- Baillie-Pilcher standardisation and cross-dating statistics ---------- */
  // ln(100 * w_i / five-year centred mean); the two rings at each end are lost
  function bp(w) {
    var out = new Array(w.length);
    for (var i = 0; i < w.length; i++) {
      if (i < 2 || i > w.length - 3) { out[i] = NaN; continue; }
      var m = (w[i - 2] + w[i - 1] + w[i] + w[i + 1] + w[i + 2]) / 5;
      out[i] = Math.log(100 * w[i] / m) - Math.log(100);
    }
    return out;
  }
  // correlate a core whose outermost ring sits at year `end` against the master
  function stats(W, s, end) {
    var first = end - s.n + 1, a = [], b = [], glk = 0, gn = 0;
    var y0 = Math.max(first, W.S), y1 = Math.min(end, W.E);
    if (y1 - y0 + 1 < MIN_OVERLAP) return null;
    for (var y = y0; y <= y1; y++) {
      var x = s.bp[y - first], m = W.mbp[y - W.S];
      if (x === x && m === m) { a.push(x); b.push(m); }
      if (y > y0) {
        var ds = s.w[y - first] - s.w[y - 1 - first], dm = W.mw[y - W.S] - W.mw[y - 1 - W.S];
        gn++;
        if (ds === 0 || dm === 0) glk += 0.5; else if ((ds > 0) === (dm > 0)) glk += 1;
      }
    }
    var n = a.length;
    if (n < MIN_OVERLAP - 4) return null;
    var ma = 0, mb = 0, i;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var sab = 0, saa = 0, sbb = 0;
    for (i = 0; i < n; i++) { var da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
    var rr = sab / Math.sqrt(saa * sbb || 1);
    var t = rr * Math.sqrt((n - 2) / Math.max(1e-9, 1 - rr * rr));
    return { r: rr, t: t, n: y1 - y0 + 1, glk: gn ? 100 * glk / gn : 0 };
  }
  function range(W, s) { return { lo: W.S + MIN_OVERLAP - 1, hi: W.E + s.n - MIN_OVERLAP }; }
  function tCurve(W, s) {
    var R = range(W, s), out = [];
    for (var e = R.lo; e <= R.hi; e++) { var st = stats(W, s, e); out.push(st ? st.t : 0); }
    return out;
  }

  /* ---------- the building, the country and the trees ---------- */
  var PRE = ['Ash', 'Mar', 'Hol', 'Wen', 'Brack', 'Lind', 'Sel', 'Thorn', 'Ov', 'Kel', 'Dun', 'Aller', 'Wick', 'Stan',
    'Bram', 'Lang', 'Nether', 'Chal', 'Oak', 'Cul', 'Hazel', 'Wych', 'Ald', 'Bur', 'Coln', 'Ey', 'Frit', 'Hawk'];
  var SUF = ['ford', 'wick', 'by', 'mere', 'ton', 'stow', 'ham', 'leigh', 'combe', 'bury', 'well', 'hurst', 'den', 'field', 'ley', 'worth'];
  var BUILDINGS = [
    { n: 'tithe barn', the: 'the barn', raised: 'the barn was raised',
      what: 'A long aisled barn of eight bays, stone below and oak above, where the parish once paid its tenth in sheaves.',
      parts: ['arcade post, bay 2', 'tiebeam, truss III', 'principal rafter, truss IV', 'aisle tie, south side', 'wall plate, north', 'passing brace, truss II', 'arcade plate, bay 5'] },
    { n: 'hall house', the: 'the hall', raised: 'the hall was framed',
      what: 'A timber-framed house built round an open hall, with a jettied chamber at each end and a crown post roof black with old smoke.',
      parts: ['crown post, open truss', 'tiebeam over the hall', 'collar purlin', 'sill beam, rear wall', 'dragon beam', 'jetty bressumer', 'arch brace, hall truss'] },
    { n: 'church nave roof', the: 'the roof', raised: 'the roof went up',
      what: 'The nave roof of a parish church: tiebeams and king posts under the lead, painted once and limewashed since.',
      parts: ['tiebeam, truss 3', 'principal rafter, truss 5', 'arch brace, north', 'ridge piece', 'wall plate, south', 'king post, truss 2', 'purlin, bay 4'] },
    { n: 'guildhall', the: 'the guildhall', raised: 'the guildhall was framed',
      what: 'A jettied guildhall on the market place, open arcade below and a hall for the fraternity above.',
      parts: ['bridging beam', 'corner post, south-west', 'jetty bressumer', 'floor joist, bay 1', 'tiebeam, truss II', 'wall post, east front', 'dragon beam'] },
    { n: 'bell frame', the: 'the frame', raised: 'the bells were hung in it',
      what: 'The oak frame the bells hang in, low in the tower, pegged together without a nail and still carrying the ring.',
      parts: ['frame head, pit 1', 'frame sill, pit 2', 'king post, pit 3', 'raking brace, pit 1', 'cill beam, north', 'trestle post, pit 4', 'frame head, pit 3'] },
    { n: 'cruck-framed cottage', the: 'the cottage', raised: 'the cottage went up',
      what: 'A cottage built on pairs of curved crucks split from single trees, the blades meeting at the ridge like praying hands.',
      parts: ['cruck blade, north pair', 'cruck blade, south pair', 'collar, central truss', 'purlin, east', 'sill beam', 'tiebeam, gable', 'windbrace'] },
    { n: 'market hall', the: 'the market hall', raised: 'the market hall was framed',
      what: 'A market hall on posts, open below for the stalls and a room above for the court and the toll-keeper.',
      parts: ['arcade post, north-east', 'dragon beam', 'tiebeam, truss II', 'floor joist, bay 3', 'down brace', 'wall plate, south', 'bridging beam'] }
  ];
  var REUSE = [
    'An empty mortice in its soffit that matches nothing in this frame.',
    'Two redundant peg holes and a housing for a stud that is not there.',
    'A carpenter’s mark “XIIII” in a frame that only runs to six.',
    'A chamfer that stops short against nothing, as if it once met a post.'
  ];
  var WHY = [
    'is being repaired under listed-building consent, and the conservation officer wants a date before anything is replaced',
    'has been bought by a building preservation trust, which wants to know what it has bought',
    'is the subject of a local history society’s long argument, which a date would settle',
    'is being recorded before a new roof covering goes on, and the scaffold is already up'
  ];

  function build(off) {
    var d = dateFor(off), r = rng(seedForDate(d) ^ 0x48454152);
    var W = { date: d, day: off };
    W.place = pick(r, PRE) + pick(r, SUF);
    W.b = pick(r, BUILDINGS);
    W.why = pick(r, WHY);
    W.code = W.place.slice(0, 3).toUpperCase();

    // the regional chronology
    var L = 460;
    W.S = 1150 + Math.floor(r() * 290);
    W.E = W.S + L - 1;
    var c = [], p = 0, i;
    for (i = 0; i < L; i++) { p = 0.3 * p + gauss(r); c.push(p); }
    var ptr = [];
    while (ptr.length < 8) { var k = 6 + Math.floor(r() * (L - 12)); if (ptr.indexOf(k) < 0) ptr.push(k); }
    ptr.forEach(function (k, j) { if (j < 6) c[k] = -1.9 - r() * 0.6; else c[k] = 1.6 + r() * 0.4; });
    W.c = c;
    W.pointers = ptr.slice(0, 6).map(function (k) { return W.S + k; }).sort(function (a, b) { return a - b; });
    W.mw = c.map(function (v) { return Math.exp(0.32 * v + 0.05 * gauss(r)); });
    W.mbp = bp(W.mw);
    W.trees = 40 + Math.floor(r() * 90);

    // when it happened
    var F = W.S + 280 + Math.floor(r() * (L - 290));          // outermost ring of the latest-felled tree
    W.F = F;
    W.season = r() < 0.6 ? 'winter' : 'spring';
    W.build = W.season === 'winter' ? F + 1 : F;
    var styl = W.build + (r() < 0.5 ? -1 : 1) * (25 + Math.floor(r() * 60));
    W.stylistic = Math.round(styl / 10) * 10;

    // which cores
    var conds = ['bark', 'sap', 'heart'];
    if (r() < 0.55) conds.push(r() < 0.5 ? 'bark2' : 'sap');
    var reused = r() < 0.8;
    if (reused) conds.push('reused');
    conds = shuffle(r, conds);
    var parts = shuffle(r, W.b.parts.slice());
    W.cores = conds.map(function (cond, ci) { return tree(W, r, cond, parts[ci], ci); });
    W.reused = reused;
    return W;
  }

  function tree(W, r, cond, part, ci) {
    var s = { id: W.code + '-0' + (ci + 1), part: part, cond: cond === 'bark2' ? 'bark' : cond, reused: cond === 'reused' };
    var sapN = 12 + Math.floor(r() * 22);
    var Yf, season;
    if (cond === 'bark') { Yf = W.F; season = W.season; }
    else if (cond === 'bark2') { Yf = W.F - 1; season = 'winter'; }
    else if (cond === 'reused') { Yf = W.F - (35 + Math.floor(r() * 120)); season = r() < 0.5 ? 'winter' : 'spring'; s.cond = 'bark'; }
    else { Yf = W.F; season = W.season; }
    s.Yf = Yf; s.season = season; s.sapN = sapN;
    s.boundary = Yf - sapN;                                     // last heartwood ring
    if (s.cond === 'bark') s.last = Yf;
    else if (s.cond === 'sap') s.last = Yf - (2 + Math.floor(r() * (sapN - 5)));
    else s.last = s.boundary - Math.floor(r() * 22);
    var want = 60 + Math.floor(r() * 110);
    var first = s.last - want + 1;
    if (first < W.S + 4) first = W.S + 4;
    s.first = first; s.n = s.last - first + 1;
    s.pith = r() < 0.3;
    s.germ = s.pith ? first : first - (4 + Math.floor(r() * 30));
    s.sapHere = s.cond === 'heart' ? 0 : s.last - s.boundary;
    s.note = s.reused ? pick(r, REUSE) :
      s.cond === 'heart' ? 'Squared hard back into the heartwood; no sapwood survives.' :
      s.cond === 'sap' ? 'Sapwood partly lost to beetle; the outer surface is powdery.' :
      'Bark edge survives in one corner: the waney edge the carpenter left on.';
    // grow it, and keep regrowing until today's core matches the master cleanly
    var sn = 0.4 + r() * 0.16, best = null;
    for (var tries = 0; tries < 40; tries++) {
      var w = [], lf = 0, e = 0;
      for (var j = 0; j < s.n; j++) {
        var y = s.first + j, age = y - s.germ;
        lf = 0.97 * lf + 0.045 * gauss(r);
        e = 0.15 * e + gauss(r);
        var trend = 0.7 + 3.0 * Math.exp(-age / 38);
        var lw = Math.log(trend) + lf + 0.32 * W.c[y - W.S] + sn * e;
        w.push(Math.max(0.05, Math.round(Math.exp(lw) * 100) / 100));
      }
      s.w = w; s.bp = bp(w);
      var tc = tCurve(W, s), R = range(W, s), truth = s.last - R.lo, tt = tc[truth], second = 0;
      for (var q = 0; q < tc.length; q++) if (q !== truth && tc[q] > second) second = tc[q];
      var score = tt - second;
      if (!best || score > best.score) best = { w: w, bp: s.bp, score: score };
      if (tt >= 4.5 && second < 3.2) break;
    }
    s.w = best.w; s.bp = best.bp;
    return s;
  }

  // what the rings allow you to say about when a tree was felled
  function felling(s) {
    if (s.cond === 'bark') return { exact: true, lo: s.last, hi: s.last,
      text: s.season === 'winter' ? 'felled winter ' + yy(s.last) : 'felled spring ' + s.last };
    if (s.cond === 'sap') {
      var lo = Math.max(s.boundary + SAP_MIN, s.last + 1), hi = s.boundary + SAP_MAX;
      return { lo: lo, hi: hi, text: 'felled ' + lo + '–' + hi };
    }
    return { tpq: true, lo: s.last + SAP_MIN, hi: null, text: 'felled after ' + (s.last + SAP_MIN) };
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { build: build, stats: stats, tCurve: tCurve, range: range, felling: felling };
    return;
  }

  /* ---------- page state ---------- */
  function $(id) { return document.getElementById(id); }
  var S = { day: 0, W: null, act: 0, pos: [], dated: [], tries: [], runs: [], view: 0, ans: null, msg: null };
  var cv = $('bench'), ctx = cv.getContext('2d'), tp = $('tplot'), tctx = tp.getContext('2d');
  var dpr = 1, CW = 0, CH = 0, ppy = 6, PL = 12, PR = 12;
  var OV = { y: 10, h: 44 }, MP = { y: 74, h: 206 }, AX = 300;
  var COL = { master: '#7aa2ff', core: '#ffce6a', dated: '#64f0c8', ptr: 'rgba(255,120,120,.55)', dim: '#8b97ab', grid: 'rgba(255,255,255,.06)' };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    CW = cv.clientWidth; CH = 330;
    cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
    cv.style.height = CH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ppy = clamp(Math.floor((CW - PL - PR) / 140), 4, 8);
    tp.width = 0;                                               // resized on the next drawT
    follow(true); draw(); drawT();
  }
  function span() { return Math.floor((CW - PL - PR) / ppy); }
  function core() { return S.W.cores[S.act]; }
  function follow(force) {
    var s = core(), sp = span(), mid = S.pos[S.act] - s.n / 2;
    var lo = S.view + sp * 0.12, hi = S.view + sp * 0.88;
    if (force || mid < lo || mid > hi || s.n > sp) S.view = Math.round(mid - sp / 2);
    S.view = clamp(S.view, S.W.S - 30, S.W.E + 30 - sp);
  }
  function X(y) { return PL + (y - S.view) * ppy + ppy / 2; }
  function OX(y) { var W = S.W; return PL + (y - (W.S - 40)) / (W.E - W.S + 80) * (CW - PL - PR); }
  function OXinv(x) { var W = S.W; return (W.S - 40) + (x - PL) / (CW - PL - PR) * (W.E - W.S + 80); }

  /* ---------- the light table ---------- */
  function draw() {
    if (!S.W || !CW) return;
    var W = S.W, s = core(), sp = span(), y, i;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = '#06080c'; ctx.fillRect(0, 0, CW, CH);

    // overview strip: the whole chronology
    ctx.fillStyle = 'rgba(255,255,255,.02)'; ctx.fillRect(PL, OV.y, CW - PL - PR, OV.h);
    ctx.strokeStyle = 'rgba(122,162,255,.7)'; ctx.lineWidth = 1; ctx.beginPath();
    for (y = W.S + 2; y <= W.E - 2; y++) {
      var v = W.mbp[y - W.S], px = OX(y), py = OV.y + 16 - v * 14;
      if (y === W.S + 2) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    W.pointers.forEach(function (py) { ctx.fillStyle = COL.ptr; ctx.fillRect(OX(py) - 0.5, OV.y + 30, 1, 5); });
    W.cores.forEach(function (c, ci) {
      var e = S.pos[ci], a = OX(e - c.n + 1), b = OX(e);
      ctx.fillStyle = ci === S.act ? COL.core : S.dated[ci] ? COL.dated : 'rgba(139,151,171,.5)';
      ctx.globalAlpha = ci === S.act ? 0.95 : 0.7;
      ctx.fillRect(a, OV.y + 37 + (ci === S.act ? 0 : 2), Math.max(2, b - a), ci === S.act ? 5 : 3);
      ctx.globalAlpha = 1;
    });
    ctx.strokeStyle = 'rgba(232,237,245,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(OX(S.view), OV.y - 3, OX(S.view + sp) - OX(S.view), OV.h + 6);
    ctx.fillStyle = COL.dim; ctx.font = '10px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'left'; ctx.fillText(W.S, PL, OV.y + OV.h + 12);
    ctx.textAlign = 'right'; ctx.fillText(W.E, CW - PR, OV.y + OV.h + 12);
    ctx.textAlign = 'center'; ctx.fillText('the whole chronology — click to jump', CW / 2, OV.y + OV.h + 12);

    // main pane
    var mid = MP.y + MP.h / 2, ky = MP.h / 2 / 2.2;
    ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fillRect(PL, MP.y, CW - PL - PR, MP.h);
    var step = ppy >= 6 ? 10 : 20;
    ctx.font = '10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
    for (y = Math.ceil(S.view / 10) * 10; y <= S.view + sp; y += 10) {
      ctx.fillStyle = y % 50 === 0 ? 'rgba(255,255,255,.1)' : COL.grid;
      ctx.fillRect(Math.round(X(y)) - 0.5, MP.y, 1, MP.h);
      if (y % step === 0) { ctx.fillStyle = COL.dim; ctx.fillText(y, X(y), AX + 14); }
    }
    // chronology limits
    [W.S, W.E].forEach(function (yl) {
      if (yl < S.view || yl > S.view + sp) return;
      ctx.fillStyle = 'rgba(122,162,255,.35)'; ctx.fillRect(Math.round(X(yl)) - 1, MP.y, 2, MP.h);
    });
    // the core's span
    var e = S.pos[S.act], f = e - s.n + 1;
    var a0 = Math.max(PL, X(f) - ppy / 2), a1 = Math.min(CW - PR, X(e) + ppy / 2);
    if (a1 > a0) {
      ctx.fillStyle = S.dated[S.act] ? 'rgba(100,240,200,.06)' : 'rgba(255,206,106,.06)';
      ctx.fillRect(a0, MP.y, a1 - a0, MP.h);
      if (s.sapHere > 0) {
        var b0 = Math.max(PL, X(e - s.sapHere + 1) - ppy / 2);
        if (a1 > b0) { ctx.fillStyle = 'rgba(255,206,106,.08)'; ctx.fillRect(b0, MP.y, a1 - b0, MP.h); }
      }
    }
    // pointer years
    W.pointers.forEach(function (py) {
      if (py < S.view || py > S.view + sp) return;
      ctx.fillStyle = COL.ptr; ctx.fillRect(Math.round(X(py)) - 0.5, MP.y + MP.h - 10, 1, 10);
    });
    // curves
    function curve(get, y0, y1, col, lw) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath();
      var on = false;
      for (var yr = Math.max(y0, S.view - 1); yr <= Math.min(y1, S.view + sp + 1); yr++) {
        var v = get(yr);
        if (v !== v) { on = false; continue; }
        var px = X(yr), pyy = clamp(mid - v * ky, MP.y + 2, MP.y + MP.h - 2);
        if (!on) { ctx.moveTo(px, pyy); on = true; } else ctx.lineTo(px, pyy);
      }
      ctx.stroke();
    }
    curve(function (yr) { return W.mbp[yr - W.S]; }, W.S, W.E, COL.master, 1.6);
    curve(function (yr) { return s.bp[yr - f]; }, f, e, S.dated[S.act] ? COL.dated : COL.core, 1.8);
    // labels
    ctx.textAlign = 'left'; ctx.font = '600 10px ui-monospace,Menlo,monospace';
    ctx.fillStyle = COL.master; ctx.fillText('MASTER', PL + 6, MP.y + 14);
    ctx.fillStyle = S.dated[S.act] ? COL.dated : COL.core; ctx.fillText(s.id + (S.dated[S.act] ? ' · DATED' : ''), PL + 62, MP.y + 14);
    if (!S.dated[S.act]) {
      ctx.fillStyle = COL.dim; ctx.textAlign = 'right'; ctx.font = '10px ui-monospace,Menlo,monospace';
      ctx.fillText('drag to slide the core', CW - PR - 6, MP.y + 14);
    }
    readout();
  }

  function readout() {
    var s = core(), st = stats(S.W, s, S.pos[S.act]), e = S.pos[S.act];
    var h = '<b>' + s.id + '</b> · ' + s.n + ' rings · outermost ring at <b>' + e + '</b>';
    if (st) {
      h += ' · overlap ' + st.n + ' yrs · <b style="color:' + (st.t >= T_LINE ? '#64f0c8' : 'inherit') + '">t = ' + st.t.toFixed(2) + '</b>' +
        ' · r = ' + st.r.toFixed(2) + ' · Glk ' + Math.round(st.glk) + '%';
    } else h += ' · not enough overlap to say anything';
    $('readout').innerHTML = h;
  }

  /* ---------- the correlation run ---------- */
  function drawT() {
    var H = 120, s = core(), run = S.runs[S.act];
    $('tbox').style.display = run ? 'block' : 'none';
    if (!run) return;
    var w = tp.clientWidth;
    if (tp.width !== Math.round(w * dpr)) {
      tp.width = Math.round(w * dpr); tp.height = Math.round(H * dpr);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    tctx.clearRect(0, 0, w, H);
    tctx.fillStyle = '#06080c'; tctx.fillRect(0, 0, w, H);
    var R = range(S.W, s), n = run.length, tmax = 12, pl = 34, pr = 10, pt = 10, pb = 20;
    function px(i) { return pl + (w - pl - pr) * i / (n - 1); }
    function py(t) { return pt + (H - pt - pb) * (1 - clamp(t, 0, tmax) / tmax); }
    tctx.font = '10px ui-monospace,Menlo,monospace'; tctx.fillStyle = COL.dim; tctx.textAlign = 'right';
    [0, 3.5, 6, 9, 12].forEach(function (t) {
      tctx.fillStyle = t === 3.5 ? 'rgba(255,206,106,.5)' : COL.grid;
      tctx.fillRect(pl, Math.round(py(t)), w - pl - pr, 1);
      tctx.fillStyle = COL.dim; tctx.fillText(t, pl - 5, py(t) + 3);
    });
    tctx.strokeStyle = COL.master; tctx.lineWidth = 1; tctx.beginPath();
    for (var i = 0; i < n; i++) { if (i) tctx.lineTo(px(i), py(run[i])); else tctx.moveTo(px(i), py(run[i])); }
    tctx.stroke();
    var ci = S.pos[S.act] - R.lo;
    tctx.fillStyle = COL.core; tctx.fillRect(Math.round(px(ci)) - 1, pt, 2, H - pt - pb);
    tctx.textAlign = 'left'; tctx.fillStyle = COL.dim;
    tctx.fillText(R.lo, pl, H - 5);
    tctx.textAlign = 'right'; tctx.fillText(R.hi + '  (position of outermost ring)', w - pr, H - 5);
  }
  function runCorrelation() {
    var s = core();
    if (!S.runs[S.act]) S.runs[S.act] = tCurve(S.W, s);
    drawT();
  }
  tp.addEventListener('click', function (ev) {
    var run = S.runs[S.act]; if (!run || S.dated[S.act]) return;
    var rc = tp.getBoundingClientRect(), w = rc.width, pl = 34, pr = 10;
    var i = Math.round((ev.clientX - rc.left - pl) / (w - pl - pr) * (run.length - 1));
    i = clamp(i, 0, run.length - 1);
    // snap to the local peak within three positions
    var b = i; for (var k = Math.max(0, i - 3); k <= Math.min(run.length - 1, i + 3); k++) if (run[k] > run[b]) b = k;
    S.pos[S.act] = range(S.W, core()).lo + b; S.msg = null;
    follow(); draw(); drawT(); cards();
  });

  /* ---------- the cores, as cards ---------- */
  function coreSvg(s) {
    var w = 260, h = 26, tot = 0, i, x;
    for (i = 0; i < s.w.length; i++) tot += s.w[i];
    var gap = s.pith ? 0 : 10, bark = s.cond === 'bark' ? 5 : 0, k = (w - 4 - gap - bark) / tot;
    var sv = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" aria-hidden="true">';
    var sx = 2 + gap, sapX = null;
    x = sx;
    for (i = 0; i < s.w.length; i++) { if (s.first + i === s.boundary + 1) sapX = x; x += s.w[i] * k; }
    var end = x;
    sv += '<rect x="' + sx + '" y="4" width="' + (end - sx) + '" height="18" rx="3" fill="#7a5530"/>';
    if (s.sapHere > 0 && sapX !== null) sv += '<rect x="' + sapX + '" y="4" width="' + (end - sapX) + '" height="18" fill="#c9a36b"/>';
    if (!s.pith) sv += '<path d="M' + sx + ' 4 l-4 3 l5 3 l-5 4 l4 4 l0 4" fill="none" stroke="#8b97ab" stroke-width="1"/>';
    else sv += '<circle cx="' + (sx + 1) + '" cy="13" r="1.6" fill="#2a1a0c"/>';
    x = sx; var d = '';
    for (i = 0; i < s.w.length; i++) { x += s.w[i] * k; d += 'M' + x.toFixed(1) + ' 4v18'; }
    sv += '<path d="' + d + '" stroke="#3a2412" stroke-width="' + (k * 0.2 > 1 ? 1 : 0.6) + '" opacity=".85"/>';
    if (bark) sv += '<rect x="' + end + '" y="3" width="' + bark + '" height="20" rx="1.5" fill="#2a1c12"/>';
    return sv + '</svg>';
  }
  function cards() {
    var W = S.W, h = '';
    W.cores.forEach(function (s, ci) {
      var dated = S.dated[ci], fl = felling(s);
      var outer = s.cond === 'bark' ? (s.season === 'winter' ? 'bark edge, last ring complete' : 'bark edge, last ring earlywood only') :
        s.cond === 'sap' ? s.sapHere + ' sapwood rings, outer ones lost' : 'heartwood only';
      h += '<button type="button" class="core' + (ci === S.act ? ' on' : '') + (dated ? ' done' : '') + '" data-core="' + ci + '">' +
        '<span class="core-id">' + s.id + (dated ? ' · dated' : '') + '</span>' +
        '<span class="core-part">' + s.part + '</span>' + coreSvg(s) +
        '<span class="core-meta">' + s.n + ' rings' + (s.pith ? ', pith' : '') + ' · ' + outer + '</span>' +
        '<span class="core-note">' + s.note + '</span>' +
        (dated ? '<span class="core-date">' + (S.pos[ci] - s.n + 1) + '–' + S.pos[ci] + ' · ' + fl.text + '</span>' : '') +
        '</button>';
    });
    $('cores').innerHTML = h;
    var n = S.dated.filter(Boolean).length;
    $('progress').textContent = n + ' of ' + W.cores.length + ' cores dated';
    $('btnDate').disabled = !!S.dated[S.act];
    $('msg').className = 'verdict' + (S.msg ? ' ' + S.msg.k : '');
    $('msg').innerHTML = S.msg ? S.msg.h : 'Slide the core until the two lines rise and fall together, then date it. Short cores are harder: the evidence grows with the overlap.';
    bars(); question();
  }
  $('cores').addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-core]');
    if (!b) return;
    S.act = +b.getAttribute('data-core'); S.msg = null;
    follow(true); cards(); draw(); drawT();
  });

  function dateIt() {
    var s = core(), e = S.pos[S.act], st = stats(S.W, s, e);
    if (S.dated[S.act]) return;
    S.tries[S.act] = (S.tries[S.act] || 0) + 1;
    if (e === s.last) {
      S.dated[S.act] = true;
      var fl = felling(s);
      S.msg = { k: 'good', h: '<b>' + s.id + ' dated.</b> t = ' + st.t.toFixed(2) + ' over ' + st.n + ' years, and it replicates against the other chronologies for the region. ' +
        'Rings ' + (e - s.n + 1) + ' to ' + e + '. ' +
        (s.cond === 'bark' ? 'With the bark edge on, the last ring is the last summer the tree lived: ' + fl.text + '.' :
         s.cond === 'sap' ? 'The heartwood ends at ' + s.boundary + ' and ' + s.sapHere + ' sapwood rings survive. With ' + SAP_MIN + ' to ' + SAP_MAX + ' sapwood rings expected, it was ' + fl.text + '.' :
         'No sapwood, so only a floor: the last surviving ring is ' + s.last + ', and at least ' + SAP_MIN + ' sapwood rings have gone, so it was ' + fl.text + ', possibly long after.') };
    } else if (!st) {
      S.msg = { k: 'warn', h: 'Not enough overlap there to compute anything.' };
    } else if (st.t < T_LINE) {
      S.msg = { k: 'warn', h: '<b>t = ' + st.t.toFixed(2) + '.</b> Below 3.5 a match is indistinguishable from chance, and no lab would put its name to it. Keep sliding.' };
    } else {
      S.msg = { k: 'warn', h: '<b>t = ' + st.t.toFixed(2) + '</b> clears the line, but checked against the other regional chronologies the match falls apart. A false match, the kind replication exists to catch.' };
    }
    cards(); draw();
  }

  /* ---------- the bar diagram ---------- */
  function bars() {
    var W = S.W, cs = W.cores, y0 = Infinity, y1 = -Infinity;
    cs.forEach(function (s) { y0 = Math.min(y0, s.first); y1 = Math.max(y1, s.boundary + SAP_MAX, s.last + SAP_MIN + 20); });
    y0 = Math.floor((y0 - 5) / 10) * 10; y1 = Math.ceil((y1 + 45) / 10) * 10;
    var w = 900, rowH = 34, top = 18, h = top + cs.length * rowH + 34, pl = 70, pr = 16;
    function px(y) { return pl + (w - pl - pr) * (y - y0) / (y1 - y0); }
    var sv = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="Bar diagram of the dated cores">';
    sv += '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(201,163,107,.08)"/><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(201,163,107,.55)" stroke-width="2"/></pattern>' +
      '<linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="rgba(201,163,107,.5)"/><stop offset="1" stop-color="rgba(201,163,107,0)"/></linearGradient></defs>';
    var stepY = (y1 - y0) > 300 ? 50 : 25;
    for (var y = Math.ceil(y0 / stepY) * stepY; y <= y1; y += stepY) {
      sv += '<line x1="' + px(y) + '" x2="' + px(y) + '" y1="' + (top - 6) + '" y2="' + (h - 26) + '" stroke="rgba(255,255,255,.07)"/>' +
        '<text x="' + px(y) + '" y="' + (h - 10) + '" fill="#8b97ab" font-size="11" text-anchor="middle" font-family="ui-monospace,Menlo,monospace">' + y + '</text>';
    }
    cs.forEach(function (s, ci) {
      var yy0 = top + ci * rowH, cy = yy0 + 10;
      sv += '<text x="0" y="' + (cy + 4) + '" fill="' + (S.dated[ci] ? '#e8edf5' : '#8b97ab') + '" font-size="11" font-family="ui-monospace,Menlo,monospace">' + s.id + '</text>';
      if (!S.dated[ci]) {
        sv += '<text x="' + pl + '" y="' + (cy + 4) + '" fill="#8b97ab" font-size="11" font-style="italic">undated: ' + s.n + ' rings floating somewhere</text>';
        return;
      }
      var hb = s.cond === 'heart' ? s.last : s.boundary;
      sv += '<rect x="' + px(s.first) + '" y="' + (cy - 7) + '" width="' + Math.max(1, px(hb + 1) - px(s.first)) + '" height="14" fill="#7a5530"/>';
      if (s.cond !== 'heart') sv += '<rect x="' + px(s.boundary + 1) + '" y="' + (cy - 7) + '" width="' + Math.max(1, px(s.last + 1) - px(s.boundary + 1)) + '" height="14" fill="#c9a36b"/>';
      var fl = felling(s);
      if (s.cond === 'bark') sv += '<rect x="' + px(s.last + 1) + '" y="' + (cy - 9) + '" width="3" height="18" fill="#e8edf5"/>';
      else if (s.cond === 'sap') sv += '<rect x="' + px(fl.lo) + '" y="' + (cy - 7) + '" width="' + (px(fl.hi + 1) - px(fl.lo)) + '" height="14" fill="url(#hatch)" stroke="rgba(201,163,107,.6)" stroke-width="1"/>';
      else sv += '<rect x="' + px(fl.lo) + '" y="' + (cy - 3) + '" width="' + Math.min(w - pr - px(fl.lo), px(fl.lo + 60) - px(fl.lo)) + '" height="6" fill="url(#fade)"/>' +
        '<path d="M' + px(fl.lo) + ' ' + (cy - 8) + 'v16" stroke="#c9a36b" stroke-width="2"/>';
      sv += '<text x="' + (px(s.cond === 'sap' ? fl.hi + 1 : s.cond === 'bark' ? s.last + 1 : fl.lo) + 8) + '" y="' + (cy + 4) + '" fill="#c3ccdb" font-size="11">' + fl.text + '</text>';
    });
    if (S.ans != null) {
      var ax = px(S.ans);
      if (ax > pl && ax < w - pr) sv += '<line x1="' + ax + '" x2="' + ax + '" y1="' + (top - 10) + '" y2="' + (h - 26) + '" stroke="#64f0c8" stroke-dasharray="4 3"/>' +
        '<text x="' + (ax + 4) + '" y="' + (top - 8) + '" fill="#64f0c8" font-size="11">your date</text>';
    }
    $('bars').innerHTML = sv + '</svg>';
  }

  /* ---------- the question ---------- */
  function question() {
    var all = S.dated.every(Boolean) && S.dated.length === S.W.cores.length;
    $('ansIn').disabled = !all; $('btnAns').disabled = !all;
    $('qhint').textContent = all ? 'Every core is dated. The lab report needs one line: the year ' + S.W.b.raised + '.' :
      'The question opens when every core is dated. So far ' + S.dated.filter(Boolean).length + ' of ' + S.W.cores.length + '.';
    verdict();
  }
  function verdict() {
    var W = S.W, el = $('verdict');
    if (S.ans == null) { el.className = 'verdict'; el.innerHTML = 'The listing description says <b>c. ' + W.stylistic + '</b>, from the look of the joints. The rings will say something more exact.'; return; }
    var a = S.ans, B = W.build, ok = a === B || a === B + 1, cs = W.cores;
    var main = cs.filter(function (s) { return !s.reused && s.cond === 'bark'; }).sort(function (x, y) { return y.last - x.last; })[0];
    var why = 'The latest bark-edge core, ' + main.id + ', grew its last ring in ' + main.last + ' and was ' + felling(main).text +
      '. Oak was framed green, usually within a year or so of felling, so ' + W.b.raised + ' in <b>' + B + '</b> or very shortly after.';
    var reu = cs.filter(function (s) { return s.reused; })[0];
    var extra = '';
    if (reu) extra += ' ' + reu.id + ' is the odd one out: ' + felling(reu).text + ', ' + (main.last - reu.last) + ' years before the rest. ' + reu.note.replace(/\.$/, '') + '. It came from an older building.';
    extra += ' The listing guessed c. ' + W.stylistic + ', which was ' + Math.abs(W.stylistic - B) + ' years ' + (W.stylistic < B ? 'too early' : 'too late') + '.';
    var cls = 'warn', h;
    if (ok) { cls = 'good'; h = '<b>' + a + '. That is what the lab would write.</b> ' + why + extra; }
    else if (W.season === 'winter' && a === main.last && main === cs.filter(function (s) { return !s.reused && s.cond === 'bark'; }).sort(function (x, y) { return y.last - x.last; })[0]) {
      cls = 'good'; h = '<b>' + a + ' is just possible</b> if the trees came down in November or December and the carpenters were quick, but the last ring is complete, and the felling is written winter ' + yy(main.last) + '. The report would say ' + B + '. ' + why + extra;
    }
    else if (reu && (a === reu.last || a === reu.last + 1)) h = '<b>' + a + ' is the date of the reused timber.</b> ' + reu.id + ' was cut down long before the others, and the note on the card says why: it has joints for a frame that is not this one. A building is no older than its newest original timber. ' + why;
    else if (cs.some(function (s) { return s.cond === 'heart' && (a === s.last || a === s.last + SAP_MIN); })) {
      var hs = cs.filter(function (s) { return s.cond === 'heart' && (a === s.last || a === s.last + SAP_MIN); })[0];
      h = '<b>' + a + ' comes from ' + hs.id + ', which has no sapwood.</b> Its last ring is only the last one the carpenter left, so it gives a floor, never a date: after ' + (hs.last + SAP_MIN) + ', and possibly long after. ' + why;
    }
    else if (a < B) h = '<b>' + a + ' is too early.</b> Nothing can be built before its trees are felled. ' + why + extra;
    else h = '<b>' + a + ' is later than the timber suggests.</b> Not impossible, since oak was sometimes stockpiled, but seasoned oak is hard to work by hand and builders almost never waited. ' + why + extra;
    el.className = 'verdict ' + cls; el.innerHTML = h;
  }
  $('ansForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = parseInt($('ansIn').value, 10);
    if (!(v > 0)) { $('ansIn').focus(); return; }
    S.ans = v; bars(); verdict();
  });

  /* ---------- facts and plaque ---------- */
  function plaque() {
    var W = S.W;
    $('plWho').textContent = W.place + ' · ' + W.b.n;
    $('plName').textContent = 'The ' + W.b.n + ' at ' + W.place;
    $('plBlurb').innerHTML = W.b.what + ' It ' + W.why + '. Listed as <em>c. ' + W.stylistic + '</em> on the evidence of its carpentry. ' +
      W.cores.length + ' cores were drilled from it with a hollow auger, and they are on the bench below.';
    $('dayOut').textContent = longDate(W.date) + (S.day === 0 ? ' · today' : '');
    $('fSpan').textContent = W.S + '–' + W.E;
    $('fLen').textContent = (W.E - W.S + 1) + ' years';
    $('fTrees').textContent = W.trees + ' timbers';
    $('fPtr').textContent = W.pointers.join(', ');
    $('fCores').textContent = W.cores.length + (W.reused ? ', one of them suspicious' : '');
    $('fListed').textContent = 'c. ' + W.stylistic;
  }

  /* ---------- loading and input ---------- */
  function load() {
    S.W = build(S.day);
    var r2 = rng(seedForDate(S.W.date) ^ 0x1234567);
    S.act = 0; S.dated = []; S.tries = []; S.runs = []; S.ans = null; S.msg = null;
    S.pos = S.W.cores.map(function (s) {
      var R = range(S.W, s), p;
      do { p = R.lo + Math.floor(r2() * (R.hi - R.lo + 1)); } while (Math.abs(p - s.last) < 40);
      S.dated.push(false);
      return p;
    });
    $('ansIn').value = '';
    plaque(); cards(); resize();
  }
  function nudge(dy) {
    if (S.dated[S.act]) return;
    var R = range(S.W, core());
    S.pos[S.act] = clamp(S.pos[S.act] + dy, R.lo, R.hi); S.msg = null;
    follow(); draw(); drawT();
    $('msg').className = 'verdict'; $('msg').innerHTML = 'Slide the core until the two lines rise and fall together, then date it.';
  }

  var drag = null;
  cv.addEventListener('pointerdown', function (ev) {
    var rc = cv.getBoundingClientRect(), x = ev.clientX - rc.left, y = ev.clientY - rc.top;
    if (y < OV.y + OV.h + 16) {                                  // overview: jump
      var yr = Math.round(OXinv(x));
      if (!S.dated[S.act]) {
        var s = core(), R = range(S.W, s);
        S.pos[S.act] = clamp(Math.round(yr + s.n / 2), R.lo, R.hi); S.msg = null;
        follow(true); draw(); drawT();
      } else { S.view = Math.round(yr - span() / 2); follow(false); S.view = clamp(Math.round(yr - span() / 2), S.W.S - 30, S.W.E + 30 - span()); draw(); }
      return;
    }
    drag = { x: x, pos: S.pos[S.act], view: S.view, moveCore: !S.dated[S.act] };
    cv.setPointerCapture(ev.pointerId);
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var rc = cv.getBoundingClientRect(), dy = Math.round((ev.clientX - rc.left - drag.x) / ppy);
    if (drag.moveCore) {
      var R = range(S.W, core());
      S.pos[S.act] = clamp(drag.pos + dy, R.lo, R.hi);
    } else S.view = clamp(drag.view - dy, S.W.S - 30, S.W.E + 30 - span());
    draw(); drawT();
  });
  function endDrag() { if (!drag) return; var m = drag.moveCore; drag = null; if (m) { S.msg = null; follow(); draw(); cards(); } }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault(); ev.stopPropagation();
      nudge((ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 10 : 1));
    } else if (ev.key === 'Enter') { ev.preventDefault(); dateIt(); }
  });

  $('btnL10').addEventListener('click', function () { nudge(-10); });
  $('btnL1').addEventListener('click', function () { nudge(-1); });
  $('btnR1').addEventListener('click', function () { nudge(1); });
  $('btnR10').addEventListener('click', function () { nudge(10); });
  $('btnDate').addEventListener('click', dateIt);
  $('btnRun').addEventListener('click', runCorrelation);

  function goDay(d) { S.day = d; load(); }
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  document.addEventListener('keydown', function (ev) {
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || tg === 'CANVAS') return;
    if (ev.key === 'ArrowLeft') goDay(S.day - 1);
    else if (ev.key === 'ArrowRight') goDay(S.day + 1);
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 60); });

  load();
})();
