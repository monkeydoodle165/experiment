/* drift.quibo.games — The Gauge
   An Excise officer's round in a Georgian cellar. The day's number picks a town and a year between
   1745 and 1823, a trader (common brewer, victualler, wine merchant or spirit dealer), the liquor and
   three casks, one of them broached and lying in ullage.

   Each cask is a solid of revolution whose stave curve lies somewhere between the gauging books' four
   varieties (two cones, two paraboloids, the parabolic spindle, the spheroid), with two heads that are
   not quite equal and a cooper's wobble. The officer reads the bung diameter, both heads and the length,
   sights along the staves to choose a variety, and the book applies that variety's exact formula in the
   right gallon: 282 cubic inches for beer and ale, 231 for wine and spirits. For the broached cask the
   dip rod gives the wet inches at the bung and the book works the ullage section by section along
   the chosen variety; the plain segment rule is shown afterwards for comparison.

   The supervisor's resurvey is the true content, integrated section by section along the real curve.
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
    var h = s ^ 0x5be0cd19;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function pct(x) { return (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + '%'; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- the four varieties ---------- */
  var PI = Math.PI;
  var VARS = [
    { name: 'two frustums of cones', short: 'Cones', look: 'straight staves meeting at a sharp bilge',
      f: 'π·L·(B² + B·H + H²) ÷ 12', vol: function (B, H, L) { return PI * L * (B * B + B * H + H * H) / 12; },
      r: function (b, h, u) { return b - (b - h) * u; } },
    { name: 'two frustums of paraboloids', short: 'Paraboloids', look: 'staves that bend most near the heads and run nearly straight to the bung',
      f: 'π·L·(B² + H²) ÷ 8', vol: function (B, H, L) { return PI * L * (B * B + H * H) / 8; },
      r: function (b, h, u) { return Math.sqrt(b * b - (b * b - h * h) * u); } },
    { name: 'middle frustum of a parabolic spindle', short: 'Spindle', look: 'staves bent evenly from head to bung',
      f: 'π·L·(8B² + 4B·H + 3H²) ÷ 60', vol: function (B, H, L) { return PI * L * (8 * B * B + 4 * B * H + 3 * H * H) / 60; },
      r: function (b, h, u) { return b - (b - h) * u * u; } },
    { name: 'middle frustum of a spheroid', short: 'Spheroid', look: 'staves full and round, falling away fastest at the heads',
      f: 'π·L·(2B² + H²) ÷ 12', vol: function (B, H, L) { return PI * L * (2 * B * B + H * H) / 12; },
      r: function (b, h, u) { return Math.sqrt(Math.max(0, b * b - (b * b - h * h) * u * u)); } }
  ];

  /* ---------- the day's cellar ---------- */
  var ALE = 282, WINE = 231;
  var TOWNS = ['Bristol', 'Norwich', 'York', 'Exeter', 'Hull', 'Liverpool', 'Bath', 'Chester', 'Newcastle', 'Southwark', 'Plymouth', 'Ipswich', 'Shrewsbury', "King's Lynn", 'Lancaster', 'Whitby', 'Worcester', 'Gloucester', 'Portsmouth', 'Colchester'];
  var SURN = ['Ashby', 'Pell', 'Tolley', 'Marsh', 'Gedge', 'Hobday', 'Venn', 'Crisp', 'Nunn', 'Rudd', 'Brigg', 'Fenn', 'Quilter', 'Larkin', 'Tebbutt', 'Mold', 'Spurling', 'Catchpole', 'Gunn', 'Orme', 'Prigg', 'Wesson', 'Hollis', 'Dunthorne'];
  var GIVEN = ['Josiah', 'Thomas', 'William', 'Samuel', 'Hannah', 'Elizabeth', 'John', 'Mary', 'Joseph', 'Richard', 'Sarah', 'Benjamin', 'Ann', 'Edward'];
  var SIGNS = ['the Bell', 'the Three Tuns', 'the Swan', 'the Woolpack', 'the Crown and Anchor', 'the Black Boy', 'the Hope', 'the Plough', 'the Ship', 'the Wheatsheaf'];
  var TRADES = [
    { what: 'common brewer', gal: ALE, gname: 'ale', liquors: ['porter', 'strong beer', 'pale ale', 'stout porter'],
      casks: [['barrel', 36], ['hogshead', 54], ['kilderkin', 18], ['butt', 108]],
      blurb: function (n) { return 'The store cellar under ' + n + '’s brewhouse. The new brewing is racked into whatever the cooper sent this year, and the brewer swears every one of them is short.'; } },
    { what: 'victualler', gal: ALE, gname: 'ale', liquors: ['ale', 'porter', 'strong beer'],
      casks: [['firkin', 9], ['kilderkin', 18], ['barrel', 36]],
      blurb: function (n, r) { return 'The cellar of ' + pick(r, SIGNS) + ', kept by ' + n + '. The casks came from the brewer marked by the size they are meant to be, and the officer is not obliged to believe the mark.'; } },
    { what: 'wine merchant', gal: WINE, gname: 'wine', liquors: ['port', 'sherry', 'Madeira', 'claret', 'Lisbon'],
      casks: [['hogshead', 63], ['pipe', 126], ['tierce', 42]],
      blurb: function (n) { return 'Vaults under ' + n + '’s counting house, cool and dark. The casks were coopered abroad to someone else’s idea of a hogshead.'; } },
    { what: 'spirit dealer', gal: WINE, gname: 'wine', liquors: ['rum', 'brandy', 'geneva'],
      casks: [['puncheon', 84], ['hogshead', 63], ['anker', 10]],
      blurb: function (n) { return n + '’s spirit cellar by the quay. Every gallon of it pays dearly, so the dealer stands at your elbow while you rod.'; } }
  ];

  /* true radius at x (inches from the bung, −L/2 .. L/2) */
  function trueR(C, x) {
    var h = x < 0 ? C.h1 : C.h2, u = Math.min(1, Math.abs(x) / (C.L / 2));
    var i = Math.min(2, Math.floor(C.t)), fr = C.t - i;
    var r = (1 - fr) * VARS[i].r(C.b, h, u) + fr * VARS[i + 1].r(C.b, h, u);
    return r * (1 + C.wob * Math.sin(PI * (u * C.wk + C.wp)) * u * (1 - u) * 4);
  }
  var N = 400;
  function integrate(C, fn, rad) {
    var dx = C.L / N, s = 0;
    rad = rad || function (x) { return trueR(C, x); };
    for (var i = 0; i <= N; i++) {
      var x = -C.L / 2 + i * dx, w = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2);
      s += w * fn(rad(x));
    }
    return s * dx / 3;
  }
  function seg(r, d) {
    if (d <= 0) return 0; if (d >= 2 * r) return PI * r * r;
    return r * r * Math.acos((r - d) / r) - (r - d) * Math.sqrt(2 * r * d - d * d);
  }
  function trueFull(C) { return integrate(C, function (r) { return PI * r * r; }); }
  function trueWet(C, w) { return integrate(C, function (r) { return seg(r, r - C.b + w); }); }
  function segFrac(w, B) { var r = B / 2; return seg(r, w) / (PI * r * r); }

  /* the diagonal rod's scale is marked for one standard cask: B 2, H 2/1.2, L 2.6, spindle */
  var KDIAG = (function () { var B = 2, H = 2 / 1.2, L = 2.6; return VARS[2].vol(B, H, L) / Math.pow(Math.sqrt(L * L / 4 + Math.pow(B / 2 + H / 2, 2)), 3); })();

  function makeCask(r, kind, liquor, gal) {
    var C = { kind: kind[0], nominal: kind[1], liquor: liquor };
    var bh = 1.1 + 0.22 * r(), lb = 1.12 + 0.34 * r();
    C.t = Math.min(3, 3 * Math.pow(r(), 0.7));
    C.wob = (r() - 0.5) * 0.014; C.wk = 1 + r() * 2; C.wp = r();
    var target = kind[1] * gal * (0.93 + 0.13 * r());
    C.b = 1; C.h1 = C.h2 = 1 / bh; C.L = 2 * lb;
    var s = Math.cbrt(target / trueFull(C));
    var hd = (r() - 0.5) * 0.6;
    C.b = s; C.L = 2 * lb * s; C.h1 = s / bh + hd / 4; C.h2 = s / bh - hd / 4;
    function rd(v) { return Math.round((v + (r() - 0.5) * 0.12) * 10) / 10; }
    C.rB = rd(2 * C.b); C.rH1 = rd(2 * C.h1); C.rH2 = rd(2 * C.h2); C.rL = rd(C.L);
    C.full = trueFull(C);
    C.ull = false;
    return C;
  }

  function makeDay(date) {
    var r = rng(mix(seedForDate(date), 48)), D = { date: date };
    D.year = 1745 + Math.floor(r() * 79);
    D.town = pick(r, TOWNS);
    D.trade = pick(r, TRADES);
    D.trader = pick(r, GIVEN) + ' ' + pick(r, SURN);
    D.blurb = D.trade.blurb(D.trader, r);
    D.casks = [];
    for (var i = 0; i < 3; i++) D.casks.push(makeCask(r, pick(r, D.trade.casks), pick(r, D.trade.liquors), D.trade.gal));
    var u = Math.floor(r() * 3), C = D.casks[u];
    C.ull = true;
    var want = 0.22 + 0.6 * r(), lo = 0, hi = 2 * C.b;
    for (var k = 0; k < 40; k++) { var m = (lo + hi) / 2; if (trueWet(C, m) / C.full < want) lo = m; else hi = m; }
    C.w = (lo + hi) / 2; C.rW = Math.round(C.w * 10) / 10; C.wet = trueWet(C, C.w);
    return D;
  }

  /* ---------- state ---------- */
  var dayOff = 0, D, cur, st, finished;
  function fresh() { return { B: false, H: false, L: false, dip: false, v: -1, entered: false, gal: 0 }; }
  function C0() { return D.casks[cur]; }
  function S0() { return st[cur]; }
  function meanH(C) { return (C.rH1 + C.rH2) / 2; }
  /* the broached cask, worked section by section along the chosen pattern through the rod's readings */
  function patternWet(C, v) {
    var b = C.rB / 2, h = meanH(C) / 2, L = C.rL, w = C.rW;
    return integrate({ L: L }, function (r) { return seg(r, r - b + w); }, function (x) { return VARS[v].r(b, h, Math.min(1, Math.abs(x) / (L / 2))); });
  }
  function gauged(C, v) {
    return (C.ull ? patternWet(C, v) : VARS[v].vol(C.rB, meanH(C), C.rL)) / D.trade.gal;
  }
  function truth(C) { return (C.ull ? C.wet : C.full) / D.trade.gal; }
  function bestVar(C) {
    var t = truth(C), best = 0;
    for (var k = 1; k < 4; k++) if (Math.abs(gauged(C, k) - t) < Math.abs(gauged(C, best) - t)) best = k;
    return best;
  }
  function diag(C) { return Math.sqrt(C.rL * C.rL / 4 + Math.pow(C.rB / 2 + meanH(C) / 2, 2)); }

  /* ---------- drawing ---------- */
  function caskSVG(C, S) {
    var W = 640, H = 300, sc = Math.min(500 / (C.L + 3), 210 / (2 * C.b + 2)), cx = W / 2, cy = 160;
    function P(x, y) { return (cx + x * sc).toFixed(1) + ',' + (cy - y * sc).toFixed(1); }
    function R(x) { var e = C.L / 2; return trueR(C, Math.max(-e, Math.min(e, x))) + 0.9; }
    var ext = C.L / 2 + 1.1, top = [], bot = [], i, x;
    for (i = 0; i <= 80; i++) { x = -ext + 2 * ext * i / 80; top.push(P(x, R(x))); bot.push(P(x, -R(x))); }
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Side elevation of the ' + esc(C.kind) + ' lying on its side">';
    out += '<rect x="' + (cx - ext * sc - 10) + '" y="' + (cy + (C.b + 1) * sc + 4) + '" width="' + (2 * ext * sc + 20) + '" height="8" rx="2" fill="#3a3027"/>';
    out += '<path d="M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z" fill="#7a5634" stroke="#3b2816" stroke-width="1.5"/>';
    [-0.86, -0.5, 0, 0.5, 0.86].forEach(function (k) {
      var pts = []; for (var j = 0; j <= 60; j++) { var xx = -ext + 2 * ext * j / 60; pts.push(P(xx, R(xx) * k)); }
      out += '<path d="M' + pts.join('L') + '" fill="none" stroke="#5c3f25" stroke-width="1"/>';
    });
    [-0.9, -0.72, -0.28, 0.28, 0.72, 0.9].forEach(function (u) {
      var xx = u * C.L / 2, rr = R(xx);
      out += '<rect x="' + (cx + xx * sc - 3) + '" y="' + (cy - rr * sc - 1) + '" width="6" height="' + (2 * rr * sc + 2) + '" fill="#2b2f36" rx="1"/>';
    });
    out += '<ellipse cx="' + cx + '" cy="' + (cy - R(0) * sc + 1) + '" rx="7" ry="2.5" fill="#1a120a"/>';
    var lb = '#64f0c8';
    if (S.B) {
      out += '<line x1="' + cx + '" y1="' + (cy - C.b * sc) + '" x2="' + cx + '" y2="' + (cy + C.b * sc) + '" stroke="' + lb + '" stroke-dasharray="5 4" stroke-width="1.5"/>';
      out += '<text class="lab" x="' + (cx + 8) + '" y="' + (cy - 6) + '">B ' + f1(C.rB) + '″</text>';
    }
    if (S.H) {
      [[-1, C.h1, C.rH1], [1, C.h2, C.rH2]].forEach(function (a) {
        var xx = cx + a[0] * C.L / 2 * sc;
        out += '<line x1="' + xx + '" y1="' + (cy - a[1] * sc) + '" x2="' + xx + '" y2="' + (cy + a[1] * sc) + '" stroke="' + lb + '" stroke-dasharray="5 4" stroke-width="1.5"/>';
        out += '<text class="lab" text-anchor="' + (a[0] < 0 ? 'start' : 'end') + '" x="' + (xx + a[0] * -8) + '" y="' + (cy + 4) + '">H ' + f1(a[2]) + '″</text>';
      });
    }
    if (S.L) {
      var yy = cy + (C.b + 1) * sc + 24, x1 = cx - C.L / 2 * sc, x2 = cx + C.L / 2 * sc;
      out += '<line x1="' + x1 + '" y1="' + yy + '" x2="' + x2 + '" y2="' + yy + '" stroke="' + lb + '" stroke-width="1.5"/>';
      out += '<line x1="' + x1 + '" y1="' + (yy - 6) + '" x2="' + x1 + '" y2="' + (yy + 6) + '" stroke="' + lb + '"/><line x1="' + x2 + '" y1="' + (yy - 6) + '" x2="' + x2 + '" y2="' + (yy + 6) + '" stroke="' + lb + '"/>';
      out += '<text class="lab" text-anchor="middle" x="' + cx + '" y="' + (yy - 6) + '">L ' + f1(C.rL) + '″ inside the heads</text>';
    }
    if (C.ull && S.dip) {
      var yb = cy + C.b * sc, yw = cy + (C.b - C.w) * sc, xr = cx + 46;
      out += '<line x1="' + xr + '" y1="' + (cy - C.b * sc - 22) + '" x2="' + xr + '" y2="' + yb + '" stroke="#d9d2c0" stroke-width="4"/>';
      out += '<line x1="' + xr + '" y1="' + yw + '" x2="' + xr + '" y2="' + yb + '" stroke="#7aa2ff" stroke-width="4"/>';
      out += '<text class="lab" x="' + (xr + 8) + '" y="' + ((yw + yb) / 2 + 4) + '">wet ' + f1(C.rW) + '″</text>';
    }
    out += '<text x="12" y="20">' + esc(cap(C.kind)) + ' of ' + esc(C.liquor) + ', marked ' + C.nominal + ' ' + D.trade.gname + ' gallons' + (C.ull ? ' · broached' : '') + '</text>';
    return out + '</svg>';
  }

  function sightSVG(C, S) {
    var W = 640, H = 210, x0 = 30, x1 = 610, yT = 26, yB = 186;
    function X(u) { return x0 + (u + 1) / 2 * (x1 - x0); }
    function Y(n) { return yB - n * (yT - yB) * -1; }
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="The swell of the stave, magnified, with the chosen variety held against it">';
    out += '<line x1="' + x0 + '" y1="' + yB + '" x2="' + x1 + '" y2="' + yB + '" stroke="rgba(255,255,255,.12)"/>';
    out += '<line x1="' + X(0) + '" y1="' + (yT - 8) + '" x2="' + X(0) + '" y2="' + yB + '" stroke="rgba(255,255,255,.08)"/>';
    out += '<text x="' + x0 + '" y="' + (yB + 18) + '">head</text><text text-anchor="middle" x="' + X(0) + '" y="' + (yB + 18) + '">bung</text><text text-anchor="end" x="' + x1 + '" y="' + (yB + 18) + '">head</text>';
    if (!(S.B && S.H && S.L)) {
      out += '<text text-anchor="middle" x="' + X(0) + '" y="' + (H / 2) + '">Take the three dimensions first; then the swell can be drawn.</text>';
      return out + '</svg>';
    }
    function line(fn, col, wd, dash) {
      var p = [];
      for (var i = 0; i <= 120; i++) { var u = -1 + 2 * i / 120; p.push(X(u).toFixed(1) + ',' + Y(fn(u)).toFixed(1)); }
      return '<path d="M' + p.join('L') + '" fill="none" stroke="' + col + '" stroke-width="' + wd + '"' + (dash ? ' stroke-dasharray="6 5"' : '') + '/>';
    }
    out += line(function (u) { var h = u < 0 ? C.h1 : C.h2; return (trueR(C, u * C.L / 2) - h) / (C.b - h); }, '#c9965f', 3);
    if (S.v >= 0) {
      var V = VARS[S.v];
      out += line(function (u) { var h = u < 0 ? C.h1 : C.h2; return (V.r(C.b, h, Math.abs(u)) - h) / (C.b - h); }, '#64f0c8', 2, true);
      out += '<text x="' + x0 + '" y="16">the stave (brown) against the pattern for ' + esc(V.short.toLowerCase()) + ' (dashed)</text>';
    } else out += '<text x="' + x0 + '" y="16">the stave, swell magnified. Choose a pattern to hold against it.</text>';
    return out + '</svg>';
  }

  /* ---------- render ---------- */
  function render() {
    var C = C0(), S = S0();
    $('casks').innerHTML = D.casks.map(function (c, i) {
      return '<button class="chip' + (i === cur ? ' on' : '') + (st[i].entered ? ' done' : '') + '" type="button" data-c="' + i + '">' +
        (i + 1) + '. ' + esc(cap(c.kind)) + ' of ' + esc(c.liquor) + (c.ull ? ' (broached)' : '') + (st[i].entered ? ' ✓' : '') + '</button>';
    }).join('');
    $('draw').innerHTML = caskSVG(C, S);
    $('sight').innerHTML = sightSVG(C, S);
    var lock = S.entered || finished;
    $('btnB').disabled = S.B || lock; $('btnH').disabled = S.H || lock; $('btnL').disabled = S.L || lock;
    $('btnDip').style.display = C.ull ? '' : 'none'; $('btnDip').disabled = S.dip || lock;
    var r = [];
    r.push(S.B ? 'Bung diameter <b>' + f1(C.rB) + '″</b>' : 'Bung diameter not taken');
    r.push(S.H ? 'heads <b>' + f1(C.rH1) + '″</b> and <b>' + f1(C.rH2) + '″</b>, mean <b>' + f2(meanH(C)) + '″</b>' : 'heads not taken');
    r.push(S.L ? 'length <b>' + f1(C.rL) + '″</b>' : 'length not taken');
    if (C.ull) r.push(S.dip ? 'wet <b>' + f1(C.rW) + '″</b> at the bung' : 'not yet dipped');
    $('reads').innerHTML = r.join(' · ') + '.';
    var ready = S.B && S.H && S.L;
    $('vars').innerHTML = VARS.map(function (v, i) {
      return '<button class="chip' + (S.v === i ? ' on' : '') + '" type="button" data-v="' + i + '"' + (ready && !lock ? '' : ' disabled') + '>' + esc(v.short) + '</button>';
    }).join('');
    var bk;
    if (S.v < 0) bk = ready ? 'The book lists four varieties. Hold each against the stave and keep the one it follows.' : 'Rod the cask before you open the book.';
    else {
      var V = VARS[S.v], full = V.vol(C.rB, meanH(C), C.rL), g = full / D.trade.gal;
      bk = '<b>' + esc(cap(V.name)) + '</b>: ' + esc(V.look) + '. Content = ' + V.f + ' = <b>' + Math.round(full) + '</b> cubic inches, ÷ ' + D.trade.gal +
        ' = <b>' + f2(g) + '</b> ' + D.trade.gname + ' gallons full.';
      if (C.ull) bk += S.dip ? ' Wet ' + f1(C.rW) + ' of ' + f1(C.rB) + ' inches at the bung, worked section by section along the same pattern, leaves <b>' + f2(gauged(C, S.v)) + '</b> gallons in it.' : ' It is broached: dip it before you write.';
    }
    $('book').innerHTML = bk;
    $('btnEnter').disabled = lock || S.v < 0 || (C.ull && !S.dip);
    $('btnEnter').textContent = S.entered ? 'Written in the book' : 'Write it in the book →';
    ledger();
    $('btnClose').disabled = finished || !st.every(function (s) { return s.entered; });
    $('btnGive').disabled = finished;
  }

  function ledger() {
    var h = '<tr><th>Cask</th><th>Marked</th><th>B · H · L</th><th>Variety</th><th>Charged</th>' + (finished ? '<th>Resurvey</th><th>Off by</th>' : '') + '</tr>';
    D.casks.forEach(function (C, i) {
      var S = st[i];
      h += '<tr><td>' + (i + 1) + '. ' + esc(C.kind) + (C.ull ? ', ullage' : '') + '</td><td>' + C.nominal + '</td><td>' +
        (S.entered ? f1(C.rB) + ' · ' + f2(meanH(C)) + ' · ' + f1(C.rL) : '—') + '</td><td>' + (S.entered ? VARS[S.v].short : '—') + '</td><td>' + (S.entered ? f2(S.gal) : '—') + '</td>';
      if (finished) {
        var t = truth(C), e = (S.gal - t) / t;
        h += '<td>' + f2(t) + '</td><td class="' + (Math.abs(e) <= 0.01 ? 'ok' : 'bad') + '">' + pct(e) + '</td>';
      }
      h += '</tr>';
    });
    $('ledger').innerHTML = h;
  }

  /* ---------- the supervisor ---------- */
  function finish(bySup) {
    finished = true;
    var tot = 0, tru = 0, worst = 0, wi = 0;
    D.casks.forEach(function (C, i) {
      var t = truth(C); tot += st[i].gal; tru += t;
      var e = (st[i].gal - t) / t; if (Math.abs(e) > Math.abs(worst)) { worst = e; wi = i; }
    });
    var e = (tot - tru) / tru, gn = D.trade.gname, v = $('verdict'), m;
    if (bySup) { m = '<p><b>The supervisor rods the cellar himself.</b> He charges ' + f2(tot) + ' ' + gn + ' gallons against a true ' + f2(tru) + ', ' + pct(e) + ', and the error that is left is the book’s, not his: no cask follows any of the four varieties exactly.</p>'; v.className = 'verdict'; }
    else if (Math.abs(e) <= 0.01 && Math.abs(worst) <= 0.02) { m = '<p><b>The resurvey agrees.</b> You charged ' + f2(tot) + ' ' + gn + ' gallons and the supervisor finds ' + f2(tru) + ', ' + pct(e) + ' over the whole cellar. ' + esc(D.trader) + ' pays without a word.</p>'; v.className = 'verdict good'; }
    else if (e < 0) { m = '<p><b>The supervisor finds ' + f2(tru - tot) + ' ' + gn + ' gallons you did not charge.</b> You wrote ' + f2(tot) + ' against a true ' + f2(tru) + ' (' + pct(e) + '). The worst was cask ' + (wi + 1) + ', ' + pct(worst) + '. Undercharging is the fault the Board notices; it goes in your character book.</p>'; v.className = 'verdict warn'; }
    else { m = '<p><b>' + esc(D.trader) + ' appeals to the collector.</b> You charged ' + f2(tot) + ' ' + gn + ' gallons, and the resurvey finds only ' + f2(tru) + ' (' + pct(e) + '). The worst was cask ' + (wi + 1) + ', ' + pct(worst) + '. The duty on the difference is struck off and you are asked to look more carefully at staves.</p>'; v.className = 'verdict warn'; }
    v.innerHTML = '<h5>The supervisor’s resurvey</h5>' + m;
    reveal();
    render();
  }

  function bars(C) {
    var t = truth(C), rows = VARS.map(function (V, i) { return [V.short, gauged(C, i)]; });
    var dg = KDIAG * Math.pow(diag(C), 3) / D.trade.gal; if (C.ull) dg *= segFrac(C.rW, C.rB);
    rows.push(['Diagonal rod', dg]);
    if (C.ull) rows.push(['Plain segment rule', C.full / D.trade.gal * segFrac(C.rW, C.rB)]);
    var lo = t * 0.88, hi = t * 1.12;
    rows.forEach(function (r) { lo = Math.min(lo, r[1] * 0.98); hi = Math.max(hi, r[1] * 1.02); });
    var W = 640, rowH = 26, H = rows.length * rowH + 34, x0 = 170, x1 = 520;
    function X(g) { return x0 + (g - lo) / (hi - lo) * (x1 - x0); }
    var o = '<svg class="bars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Each method’s content against the resurvey">';
    rows.forEach(function (r, i) {
      var y = 14 + i * rowH, e = (r[1] - t) / t, col = Math.abs(e) <= 0.01 ? '#64f0c8' : '#7aa2ff';
      o += '<text x="10" y="' + (y + 13) + '">' + esc(r[0]) + '</text>';
      o += '<rect x="' + x0 + '" y="' + y + '" width="' + Math.max(1, X(r[1]) - x0) + '" height="16" rx="3" fill="' + col + '" opacity=".75"/>';
      o += '<text x="' + (x1 + 10) + '" y="' + (y + 13) + '">' + f2(r[1]) + ' ' + pct(e) + '</text>';
    });
    var xt = X(t);
    o += '<line x1="' + xt + '" y1="6" x2="' + xt + '" y2="' + (H - 18) + '" stroke="#ffce6a" stroke-width="2"/>';
    o += '<text text-anchor="middle" x="' + xt + '" y="' + (H - 4) + '" style="fill:#ffce6a">resurvey ' + f2(t) + '</text>';
    return o + '</svg>';
  }

  function reveal() {
    var h = '<h5>Every method against the truth, cask by cask</h5>';
    D.casks.forEach(function (C, i) {
      var lo = Math.min(2, Math.floor(C.t)), fr = C.t - lo, near = bestVar(C);
      var where = fr < 0.15 ? 'almost exactly ' + VARS[lo].short.toLowerCase() : fr > 0.85 ? 'almost exactly ' + VARS[lo + 1].short.toLowerCase() :
        Math.round((1 - fr) * 100) + '% of the way from ' + VARS[lo + 1].short.toLowerCase() + ' to ' + VARS[lo].short.toLowerCase();
      h += '<p style="margin-top:16px"><b>' + (i + 1) + '. ' + esc(cap(C.kind)) + ' of ' + esc(C.liquor) + '.</b> Its staves were ' + where +
        ', and the variety that came nearest in content was <b>' + VARS[near].short + '</b>' + (st[i].v === near ? ', which you chose.' : '; you chose ' + VARS[st[i].v].short.toLowerCase() + '.') +
        ' It holds ' + f2(C.full / D.trade.gal) + ' gallons brim full against the ' + C.nominal + ' it is marked for.' +
        (C.ull ? ' Lying in ullage it holds ' + f2(C.wet / D.trade.gal) + ' gallons, ' + (C.wet / C.full * 100).toFixed(1) + '% of full, where the plain rule, taking the wet share of the bung’s circle for the wet share of the cask, would have said ' + (segFrac(C.rW, C.rB) * 100).toFixed(1) + '%.' : '') + '</p>';
      h += bars(C);
    });
    h += '<p style="margin-top:14px">The diagonal rod is one reading from the bung to the far lower chime, cubed and multiplied by a constant marked for a cask of standard proportions, which is quick and goes wrong on anything else. The bars within 1% of the resurvey are green.</p>';
    $('reveal').innerHTML = h; $('reveal').style.display = '';
  }

  /* ---------- load ---------- */
  function load() {
    D = makeDay(dateFor(dayOff)); cur = 0; finished = false;
    st = D.casks.map(fresh);
    $('plWho').textContent = 'Excise · ' + D.town + ' · ' + D.year;
    $('plName').textContent = D.trader + ', ' + D.trade.what;
    $('plBlurb').textContent = D.blurb;
    $('rules').innerHTML = '<span><b>3</b> casks to charge</span><span>by the <b>' + D.trade.gname + ' gallon</b> of ' + D.trade.gal + ' cubic inches</span><span><b>4</b> varieties in the book</span><span>one cask <b>broached</b></span>';
    $('dayOut').textContent = longDate(D.date) + (dayOff === 0 ? ' (today)' : '');
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('msg').textContent = '';
    render();
  }

  /* ---------- controls ---------- */
  function say(t) { $('msg').textContent = t; }
  $('btnB').addEventListener('click', function () { S0().B = true; say('The rod goes in at the bung and touches the staves opposite: ' + f1(C0().rB) + ' inches.'); render(); });
  $('btnH').addEventListener('click', function () { S0().H = true; say('Across each head inside the chime: ' + f1(C0().rH1) + ' and ' + f1(C0().rH2) + ' inches. The cooper never makes them the same, so the book takes the mean.'); render(); });
  $('btnL').addEventListener('click', function () { S0().L = true; say('Head to head, less the thickness of both heads: ' + f1(C0().rL) + ' inches.'); render(); });
  $('btnDip').addEventListener('click', function () { S0().dip = true; say('The dip rod goes down through the bung until it touches the bottom staves, and comes up wet to ' + f1(C0().rW) + ' inches.'); render(); });
  $('vars').addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
    S0().v = +b.getAttribute('data-v'); render();
  });
  $('casks').addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]'); if (!b) return;
    cur = +b.getAttribute('data-c'); say(''); render();
  });
  $('btnEnter').addEventListener('click', function () {
    var C = C0(), S = S0(); if (S.entered || S.v < 0) return;
    S.entered = true; S.gal = gauged(C, S.v);
    say('Cask ' + (cur + 1) + ' entered at ' + f2(S.gal) + ' ' + D.trade.gname + ' gallons.');
    for (var i = 0; i < 3; i++) if (!st[i].entered) { cur = i; break; }
    render();
  });
  $('btnClose').addEventListener('click', function () { if (!finished) finish(false); });
  $('btnReset').addEventListener('click', function () { load(); });
  $('btnGive').addEventListener('click', function () {
    if (finished) return;
    D.casks.forEach(function (C, i) {
      var S = st[i], best = bestVar(C);
      S.B = S.H = S.L = true; S.dip = C.ull;
      S.v = best; S.entered = true; S.gal = gauged(C, best);
    });
    say('The supervisor rods every cask and chooses the variety that suits it best.');
    finish(true);
  });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
  });

  load();
})();
