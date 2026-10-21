/* drift.quibo.games — The Sounding
   A day in an Admiralty surveying boat off a small harbour, some time between 1808 and 1858 on today's
   calendar date. The day's number raises the seabed: a coast with a bay, a basin inside it, a channel
   scoured by the ebb, a sand bar across the mouth with one gap in it, and one or two rocks the chart has
   never shown. Nothing of the seabed is drawn. A ship drawing more water than the bar has to come in on
   tomorrow's tide, and the harbour master wants a track with two feet under her keel all the way.

   Every cast of the hand lead is real work: the boat rows there at two and a half knots, the leadsman
   heaves, calls the depth in the old marks and deeps, and the tallow in the lead brings up the bottom.
   What he calls is the water at that moment; the boy at the tide pole on the quay gives the height of the
   tide, and the difference is the sounding reduced to low water springs, which is what goes on the chart.
   The light goes at half past three.

   Lay the track from the offing to the quay and bring her in. The page then traces her keel over the true
   seabed with the real tide (which the wind can hold up or let down), and the Hydrographer's track is the
   shortest path on the true seabed with a margin of water under it.
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
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function $(id) { return document.getElementById(id); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function hm(t) {
    t = ((Math.round(t) % 1440) + 1440) % 1440;
    var h = Math.floor(t / 60), m = t - h * 60;
    return h + ':' + (m < 10 ? '0' : '') + m;
  }
  function fmft(ft) { // reduced sounding as fathoms and feet
    if (ft < 0) return 'dries ' + Math.round(-ft) + ' ft';
    var f = Math.floor(ft / 6 + 1e-6), r = Math.round(ft - 6 * f);
    if (r === 6) { f++; r = 0; }
    return f + ' fm' + (r ? ' ' + r + ' ft' : '');
  }
  var WORDS = ['nothing', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  var MARKS = { 2: 1, 3: 1, 5: 1, 7: 1, 10: 1, 13: 1, 15: 1, 17: 1, 20: 1 };
  function leadCall(ft) { // the leadsman's call for a depth of water in feet, to the quarter fathom
    if (ft < 1) return 'She’s aground. The bottom is out of the water here';
    var q = Math.round(ft / 1.5) / 4; // fathoms to the quarter
    if (q < 1) return 'Under a fathom, ' + Math.round(ft) + ' feet';
    if (q > 20) return 'No bottom at twenty';
    var w = Math.floor(q), fr = q - w;
    if (fr < 0.01) return (MARKS[w] ? 'By the mark ' : 'By the deep ') + WORDS[w];
    if (Math.abs(fr - 0.25) < 0.01) return 'And a quarter ' + WORDS[w];
    if (Math.abs(fr - 0.5) < 0.01) return 'And a half ' + WORDS[w];
    return 'A quarter less ' + WORDS[w + 1];
  }

  /* ---------- the harbour ---------- */
  var GW = 150, GH = 100;           // cells; one cell is a hundredth of a nautical mile, a tenth of a cable
  var ROW = 0.24, CAST = 2;          // minutes a cell at two and a half knots, minutes a cast
  var START = 540, END = 930;        // 9:00 to 15:30
  var PERIOD = 745;                  // a semi-diurnal tide, minutes
  var CLEAR = 2;                     // feet the harbour master wants under her keel
  var PLACES = [
    ['Polwithen', 'the north coast of Cornwall'], ['Merrow Haven', 'the coast of Pembroke'], ['Skelmouth', 'the Yorkshire coast'],
    ['Carrick Hythe', 'the coast of Antrim'], ['Kilmorrow', 'the coast of Clare'], ['Abercrae', 'Cardigan Bay'],
    ['Dunbracken', 'the Moray Firth'], ['Polgarra', 'the south coast of Cornwall'], ['Wendle', 'the coast of Norfolk'],
    ['Strand Pill', 'the Bristol Channel'], ['Ardnacross', 'the Sound of Mull'], ['Saltash Pool', 'the coast of Devon'],
    ['Hollesmouth', 'the coast of Suffolk'], ['Inverlochy Bay', 'the coast of Argyll'], ['Portcallow', 'the coast of Galloway']
  ];
  var VESSELS = ['Starling', 'Fairy', 'Sylvia', 'Beacon', 'Shamrock', 'Comet', 'Raven', 'Mastiff', 'Sparrowhawk', 'Firefly'];
  var OFFICERS = ['Lieutenant Bedford', 'Lieutenant Frazer', 'Lieutenant Denham', 'Mr Thomas, Master', 'Lieutenant Wolfe', 'Lieutenant Otter', 'Lieutenant Slater', 'Mr Cudlip, Master'];
  var SHIPNAMES = ['Mary Ann', 'Brothers', 'Good Intent', 'Eliza', 'Hope', 'Ann and Jane', 'Industry', 'Providence', 'Thetis', 'Lord Collingwood', 'Margaret', 'Swift'];
  function shipKind(dr) {
    if (dr <= 10) return 'the revenue cutter';
    if (dr <= 13) return 'the collier brig';
    if (dr <= 16) return 'the timber barque';
    if (dr <= 19) return 'the West Indiaman';
    return 'the East Indiaman';
  }

  function noiseField(r, cell) {
    var nx = Math.ceil(GW / cell) + 3, ny = Math.ceil(GH / cell) + 3, g = new Float32Array(nx * ny);
    for (var i = 0; i < g.length; i++) g[i] = r();
    return function (x, y) {
      var fx = clamp(x, 0, GW) / cell, fy = clamp(y, 0, GH) / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = g[iy * nx + ix], b = g[iy * nx + ix + 1], c = g[(iy + 1) * nx + ix], d = g[(iy + 1) * nx + ix + 1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
  }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = clamp(t, 0, 1);
    var qx = ax + t * dx - px, qy = ay + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function polyDist(px, py, P) {
    var m = 1e9;
    for (var i = 0; i < P.length - 1; i++) m = Math.min(m, segDist(px, py, P[i].x, P[i].y, P[i + 1].x, P[i + 1].y));
    return m;
  }

  function seabed(r) {
    var H = { };
    var by = 34 + r() * 32, brx = 15 + r() * 5, bry = 10 + r() * 5, bx = 147 - brx - 2 - r() * 3;
    var coastX = 96 + r() * 6, p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
    function xs(y) { return coastX + 8 * Math.sin(y / 19 + p1) + 4 * Math.sin(y / 7.3 + p2) + 20 * Math.exp(-Math.pow((y - by) / 10, 2)); }
    var mouthX = xs(by) - 20;
    var xb = mouthX - 13 - r() * 9;
    var yg = clamp(by + (r() - 0.5) * 34, 14, 86);
    var Q = { x: bx + brx * 0.72, y: by + (r() - 0.5) * 4 };
    var P1 = { x: bx - brx * 0.2, y: by + (r() - 0.5) * bry * 0.9 };
    var P2 = { x: mouthX + 6, y: by + (r() - 0.5) * 8 };
    var G = { x: xb, y: yg };
    var O = { x: 5, y: clamp(yg + (r() - 0.5) * 36, 10, 90) };
    var C = [O, { x: (O.x + G.x) / 2, y: (O.y + G.y) / 2 + (r() - 0.5) * 8 }, G, P2, P1, Q];
    var cDepth = 12 + r() * 6, cW = 3.4 + r() * 1.8, gw = 4.5 + r() * 3, barW = 3.2 + r() * 2;
    var n1 = noiseField(r, 11), n2 = noiseField(r, 4), n3 = noiseField(r, 17);
    var rocks = [], nr = r() < 0.55 ? 2 : 1;
    for (var k = 0; k < nr; k++) {
      var seg = k === 0 ? [G, P2] : pick(r, [[P2, P1], [C[1], G], [G, P2]]), t = 0.15 + r() * 0.7;
      var sx = seg[0].x + (seg[1].x - seg[0].x) * t, sy = seg[0].y + (seg[1].y - seg[0].y) * t;
      var dx = seg[1].x - seg[0].x, dy = seg[1].y - seg[0].y, l = Math.sqrt(dx * dx + dy * dy) || 1, off = (r() < 0.5 ? -1 : 1) * (1.5 + r() * 4.5);
      rocks.push({ x: sx - dy / l * off, y: sy + dx / l * off, top: 1.5 + r() * 5, rad: 1.5 + r() * 1.3 });
    }
    var d = new Float32Array(GW * GH), bot = new Uint8Array(GW * GH);
    for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) {
      var v = 0.42 * (xs(y) - x) - 3;
      if (v > 0) v = 66 * (1 - Math.exp(-v / 66));
      var e = Math.pow((x - bx) / brx, 2) + Math.pow((y - by) / bry, 2);
      var bas = 9 * (1 - e) - 4 + 3 * (n3(x, y) - 0.5);
      var inBasin = bas > v;
      if (inBasin) v = bas;
      // the bar: the seabed is pulled up toward a crest a foot or four under low water, except in the gap
      var xc = xb + 5 * Math.sin(y / 13 + p3), kb = Math.exp(-Math.pow((x - xc) / barW, 2)) * Math.exp(-Math.pow((y - by) / 40, 4));
      kb *= 1 - 0.9 * Math.exp(-Math.pow((y - yg) / gw, 2));
      var crest = 1 + 4 * n1(x * 0.7, y);
      v = v + (crest - v) * kb * (v > crest ? 1 : 0);
      // the channel the ebb has scoured, fading out to sea
      var cd = polyDist(x, y, C), fade = x >= G.x - 4 ? 1 : Math.exp(-Math.pow((G.x - 4 - x) / 12, 2));
      var ch = cDepth * Math.exp(-Math.pow(cd / cW, 2)) * fade;
      v += ch;
      v += 3.2 * (n1(x, y) - 0.5) + 1.4 * (n2(x, y) - 0.5);
      var nearRock = false;
      for (k = 0; k < rocks.length; k++) {
        var R = rocks[k], rd = Math.sqrt(Math.pow(x - R.x, 2) + Math.pow(y - R.y, 2));
        if (v > R.top) v = v - (v - R.top) * Math.exp(-Math.pow(rd / R.rad, 2));
        if (rd < R.rad * 2.3) nearRock = true;
      }
      var i = y * GW + x;
      d[i] = v;
      // bottom: 0 mud, 1 sand, 2 fine sand, 3 shell, 4 gravel, 5 rock
      bot[i] = nearRock ? 5 : inBasin ? 0 : kb > 0.25 ? 1 : cd < cW * 0.8 && x > G.x - 6 ? 4 : v > 40 ? 3 : 2;
    }
    H.d = d; H.bot = bot; H.O = O; H.Q = Q; H.rocks = rocks; H.gap = G; H.chan = C;
    H.church = { x: clamp(Q.x + 2, 0, GW - 3), y: clamp(by - bry - 4, 4, GH - 4) };
    return H;
  }
  function idx(x, y) { return clamp(Math.round(y), 0, GH - 1) * GW + clamp(Math.round(x), 0, GW - 1); }
  function depthAt(H, x, y) {
    x = clamp(x, 0, GW - 1.001); y = clamp(y, 0, GH - 1.001);
    var ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, i = iy * GW + ix, d = H.d;
    return d[i] * (1 - tx) * (1 - ty) + d[i + 1] * tx * (1 - ty) + d[i + GW] * (1 - tx) * ty + d[i + GW + 1] * tx * ty;
  }

  /* ---------- the best and the shortest ways in, on the true seabed ---------- */
  function bottleneck(H) {
    var n = GW * GH, order = new Int32Array(n), par = new Int32Array(n), on = new Uint8Array(n), i;
    for (i = 0; i < n; i++) { order[i] = i; par[i] = i; }
    var arr = Array.prototype.slice.call(order).sort(function (a, b) { return H.d[b] - H.d[a]; });
    function find(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
    var o = idx(H.O.x, H.O.y), q = idx(H.Q.x, H.Q.y);
    for (var k = 0; k < n; k++) {
      var c = arr[k], cx = c % GW, cy = (c - cx) / GW; on[c] = 1;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var x = cx + dx, y = cy + dy; if ((!dx && !dy) || x < 0 || y < 0 || x >= GW || y >= GH) continue;
        var j = y * GW + x; if (on[j]) { var a = find(c), b = find(j); if (a !== b) par[a] = b; }
      }
      if (on[o] && on[q] && find(o) === find(q)) return H.d[c];
    }
    return -99;
  }
  function shortest(H, th) {
    var n = GW * GH, dist = new Float32Array(n), prev = new Int32Array(n), done = new Uint8Array(n), i;
    for (i = 0; i < n; i++) { dist[i] = 1e9; prev[i] = -1; }
    var o = idx(H.O.x, H.O.y), q = idx(H.Q.x, H.Q.y), heap = [];
    function ok(j) { return H.d[j] >= th || j === q || j === o; }
    function push(j, v) { heap.push([v, j]); var c = heap.length - 1; while (c > 0) { var p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; var t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var c = 0; for (;;) { var l = 2 * c + 1, r2 = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2; if (m === c) break; var t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m; } } return top; }
    dist[o] = 0; push(o, 0);
    while (heap.length) {
      var it = pop(), c = it[1]; if (done[c]) continue; done[c] = 1; if (c === q) break;
      var cx = c % GW, cy = (c - cx) / GW;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var x = cx + dx, y = cy + dy; if ((!dx && !dy) || x < 0 || y < 0 || x >= GW || y >= GH) continue;
        var j = y * GW + x; if (done[j] || !ok(j)) continue;
        if (dx && dy && (!ok(cy * GW + x) || !ok(y * GW + cx))) continue;
        var nd = dist[c] + (dx && dy ? 1.4142 : 1);
        if (nd < dist[j]) { dist[j] = nd; prev[j] = c; push(j, nd); }
      }
    }
    if (prev[q] < 0) return null;
    var path = []; for (var p = q; p >= 0; p = prev[p]) path.push({ x: p % GW, y: Math.floor(p / GW) });
    path.reverse(); path[0] = { x: H.O.x, y: H.O.y }; path[path.length - 1] = { x: H.Q.x, y: H.Q.y };
    // pull the string tight
    function los(a, b) {
      var L = Math.hypot(b.x - a.x, b.y - a.y), s = Math.max(1, Math.ceil(L / 0.3));
      for (var k = 1; k < s; k++) { var t = k / s; if (depthAt(H, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < th) return false; }
      return true;
    }
    var out = [path[0]], at = 0;
    while (at < path.length - 1) {
      var j2 = path.length - 1; while (j2 > at + 1 && !los(path[at], path[j2])) j2--;
      out.push(path[j2]); at = j2;
    }
    return out;
  }

  /* ---------- the day ---------- */
  function build(date) {
    var base = seedForDate(date), D, H, tries = 0;
    for (;;) {
      var r = rng(mix(base, 51 + tries * 7919));
      D = { date: date };
      D.year = 1808 + Math.floor(r() * 51);
      var P = pick(r, PLACES); D.place = P[0]; D.coast = P[1];
      D.vessel = pick(r, VESSELS); D.officer = pick(r, OFFICERS); D.ship = pick(r, SHIPNAMES);
      D.R = 9 + r() * 9; D.M = D.R / 2 + 0.6 + r() * 0.8;
      D.HW = 480 + r() * PERIOD;
      D.lead = pick(r, [180, 150, 120, 90]);
      var k = 0, ta; for (;;) { ta = D.HW + PERIOD * k - D.lead; if (ta >= 1440 + 360) break; k++; }
      if (ta > 1440 + 1260) ta -= PERIOD;
      if (ta < 1440 + 300) ta += PERIOD;
      D.tArr = ta; D.hwArr = ta + D.lead;
      D.surge = gauss(r) * 0.45;
      H = seabed(r);
      D.H = H;
      D.hArr = tide(D, ta); D.hTrue = D.hArr + D.surge;
      D.Bmax = bottleneck(H);
      var margin = 1 + r() * 2.5;
      D.draught = Math.floor(D.Bmax + D.hArr - CLEAR - margin);
      D.req = D.draught + CLEAR - D.hArr;
      var straight = trace(D, [H.O, H.Q], D.hArr);
      tries++;
      if (tries > 25) break;
      if (D.draught >= 8 && D.draught <= 22 && straight.minWater < D.draught + CLEAR && D.req > 1) break;
    }
    D.kind = shipKind(D.draught);
    var th = [D.req + 3, D.req + 2, D.req + 1, D.req + 0.25, D.Bmax - 0.01];
    for (var i = 0; i < th.length && !D.best; i++) if (D.Bmax >= th[i]) D.best = shortest(H, th[i]);
    D.obsSeed = mix(base, 6151);
    return D;
  }
  function tide(D, t) { return D.M + D.R / 2 * Math.cos(2 * Math.PI * (t - D.HW) / PERIOD); }

  // trace a keel along a track: every quarter of a cell, the water over the true seabed at height h
  function trace(D, pts, h) {
    var H = D.H, s = 0, prof = [], minW = 1e9, minAt = null, ground = null;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / 0.25));
      for (var k = (i ? 1 : 0); k <= n; k++) {
        var t = k / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, w = depthAt(H, x, y) + h, ss = s + L * t;
        prof.push({ s: ss, w: w, x: x, y: y });
        if (w < minW) { minW = w; minAt = { x: x, y: y, s: ss }; }
        if (!ground && D.draught && w < D.draught) ground = { x: x, y: y, s: ss, w: w, bot: H.bot[idx(x, y)] };
      }
      s += L;
    }
    return { len: s, prof: prof, minWater: minW, minAt: minAt, ground: ground };
  }

  /* ---------- state ---------- */
  var D, dayOff = 0, now, boat, casts, track, mode, lineA, finished, shade = true, obsR, shadeImg = null, baseImg = null, truthImg = null, anim = null, shipAt = null, result = null;
  var cv = $('chart'), cx = cv.getContext('2d'), CW = cv.width, CH = cv.height, S = CW / GW;

  function load() {
    stopAnim();
    D = build(dateFor(dayOff));
    obsR = rng(mix(D.obsSeed, 3));
    now = START; boat = { x: D.H.Q.x - 1, y: D.H.Q.y }; casts = []; track = []; mode = 'cast'; lineA = null; finished = false;
    shadeImg = null; truthImg = null; shipAt = null; result = null;
    baseImg = renderBase(false);
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    say('');
    var t = D.date;
    $('plWho').textContent = 'HM surveying vessel ' + D.vessel + ' · ' + D.coast + ' · ' + t.getDate() + ' ' + MONTHS[t.getMonth()] + ' ' + D.year;
    $('plName').textContent = 'The harbour of ' + D.place;
    $('plBlurb').innerHTML = D.officer + ' has the boat today, a leadsman in the bows, four hands at the oars and a boy at the tide pole on the quay. ' +
      'The old chart shows ' + D.place + ' as a bay with a bar across it and nothing more. <b>' + capital(D.kind) + ' ' + D.ship + '</b>, drawing <b>' + D.draught + ' feet</b>, ' +
      'is to come over the bar tomorrow at <b>' + hm(D.tArr) + '</b>, ' + leadWords(D.lead) + ' before high water, and the harbour master will have <b>two feet under her keel</b> ' +
      'from the offing to the quay or he will keep her outside. Find her a way in before the light goes at half past three.';
    $('rules').innerHTML =
      '<span>tomorrow’s tide at her arrival <b>' + f1(D.hArr) + ' ft</b></span>' +
      '<span>so the chart must show <b>' + f1(D.req) + ' ft</b> at low water</span>' +
      '<span>range today <b>' + f1(D.R) + ' ft</b></span>' +
      '<span>high water today <b>' + hm(D.HW) + '</b></span>' +
      '<span>a cast <b>2 min</b> · rowing <b>2½ kn</b></span>';
    $('dayOut').textContent = (dayOff === 0 ? 'Today’s harbour, ' : '') + WEEKDAYS[t.getDay()] + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()] + ' ' + t.getFullYear();
    setMode('cast');
    renderAll();
  }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function leadWords(m) { return { 180: 'three hours', 150: 'two hours and a half', 120: 'two hours', 90: 'an hour and a half' }[m]; }
  function say(h) { $('msg').innerHTML = h; }

  /* ---------- the boat ---------- */
  function rowAndCast(x, y) {
    var dist = Math.hypot(x - boat.x, y - boat.y), t = now + dist * ROW + CAST;
    if (t > END) { say('There is not light enough left to get there and cast. The boat is done for the day; lay the track with what you have.'); now = Math.max(now, END); renderAll(); return false; }
    var H = D.H, i = idx(x, y), trueD = depthAt(H, x, y);
    if (trueD < -5 && H.d[i] < -5) { say('That is dry land.'); return false; }
    now = t; boat = { x: x, y: y };
    var h = tide(D, now), water = trueD + h;
    var heard = Math.max(0, water + gauss(obsR) * 0.4);
    var called = water < 1 ? 0 : Math.round(heard / 1.5) * 1.5;
    var pole = Math.round(h * 2) / 2;
    var red = water < 1 ? Math.min(0, Math.round(trueD)) : called - pole;
    var BOT = ['mud', 'sand', 'fine sand', 'broken shell', 'gravel', 'nothing: the arming comes up clean and scored. Rock'];
    var c = { n: casts.length + 1, x: x, y: y, t: now, water: called, pole: pole, red: red, bot: H.bot[i], call: leadCall(water < 1 ? 0 : called), botName: BOT[H.bot[i]] };
    casts.push(c); shadeImg = null;
    say('<b>' + c.call + '.</b> ' + (water < 1 ? '' : 'The arming brings up ' + c.botName + '. ') + 'The pole reads ' + f1(pole) + ' ft, so it goes on the chart as <b>' + fmft(red) + '</b>.');
    return true;
  }
  function castLine(a, b) {
    var n = Math.max(2, Math.min(9, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 7) + 1)), got = 0;
    for (var k = 0; k < n; k++) {
      var t = k / (n - 1);
      if (!rowAndCast(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) break;
      got++;
    }
    if (got > 1) say($('msg').innerHTML + ' <span>(' + got + ' casts along the line.)</span>');
  }

  /* ---------- rendering ---------- */
  function renderBase(truth) {
    var c = document.createElement('canvas'); c.width = CW; c.height = CH;
    var g = c.getContext('2d'), im = g.createImageData(CW, CH), p = im.data, H = D.H, LV = [6, 12, 18, 30, 48];
    var lev = truth ? new Int8Array(CW * CH) : null;
    for (var py = 0; py < CH; py++) for (var px = 0; px < CW; px++) {
      var d = depthAt(H, px / S, py / S), o = (py * CW + px) * 4, R, G, B;
      if (d < -5) { R = 38; G = 42; B = 34; }
      else if (d < 0) { R = 70; G = 64; B = 46; }
      else if (!truth) { R = 14; G = 20; B = 30; }
      else {
        var t = Math.pow(clamp(d / 60, 0, 1), 0.55);
        R = Math.round(96 + (12 - 96) * t); G = Math.round(150 + (26 - 150) * t); B = Math.round(140 + (48 - 140) * t);
      }
      if (Math.abs(d) < 0.45) { R = 150; G = 138; B = 104; }
      p[o] = R; p[o + 1] = G; p[o + 2] = B; p[o + 3] = 255;
      if (truth) { var l = 0; while (l < LV.length && d >= LV[l]) l++; lev[py * CW + px] = d < 0 ? -1 : l; }
    }
    if (truth) for (py = 0; py < CH - 1; py++) for (px = 0; px < CW - 1; px++) {
      var a = lev[py * CW + px];
      if (a >= 0 && (a !== lev[py * CW + px + 1] || a !== lev[(py + 1) * CW + px]) && lev[py * CW + px + 1] >= 0 && lev[(py + 1) * CW + px] >= 0) {
        o = (py * CW + px) * 4; p[o] = 200; p[o + 1] = 215; p[o + 2] = 225;
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  function renderShade() { // inverse-distance estimate from the reduced soundings; red where it says too shoal
    var st = 2, c = document.createElement('canvas'); c.width = GW / st; c.height = GH / st;
    var g = c.getContext('2d');
    if (casts.length < 2) return c;
    for (var y = 0; y < GH; y += st) for (var x = 0; x < GW; x += st) {
      var cx0 = x + st / 2, cy0 = y + st / 2;
      if (D.H.d[idx(cx0, cy0)] < -5) continue;
      var sw = 0, sv = 0, near = 1e9;
      for (var k = 0; k < casts.length; k++) {
        var q = casts[k], dd = (q.x - cx0) * (q.x - cx0) + (q.y - cy0) * (q.y - cy0);
        near = Math.min(near, dd);
        if (dd > 400) continue;
        var w = 1 / (dd + 1); sw += w; sv += w * q.red;
      }
      if (near > 144 || !sw) continue;
      var est = sv / sw;
      g.fillStyle = est < D.req ? 'rgba(255,110,90,' + (est < D.req - 4 ? 0.36 : 0.24) + ')' : 'rgba(100,240,200,0.09)';
      g.fillRect(x / st, y / st, 1, 1);
    }
    return c;
  }
  function drawPolyline(pts, col, w, dash) {
    cx.save(); cx.strokeStyle = col; cx.lineWidth = w; if (dash) cx.setLineDash(dash);
    cx.beginPath(); for (var i = 0; i < pts.length; i++) { var X = pts[i].x * S, Y = pts[i].y * S; i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }
    cx.stroke(); cx.restore();
  }
  function draw() {
    var H = D.H;
    cx.clearRect(0, 0, CW, CH);
    cx.drawImage(finished && truthImg ? truthImg : baseImg, 0, 0);
    if (shade && !finished) { if (!shadeImg) shadeImg = renderShade(); cx.save(); cx.imageSmoothingEnabled = true; cx.drawImage(shadeImg, 0, 0, CW, CH); cx.restore(); }
    // furniture: scale, north, offing, quay, church
    cx.save();
    cx.font = '11px ui-monospace,Menlo,monospace'; cx.fillStyle = '#8b97ab'; cx.strokeStyle = '#8b97ab'; cx.lineWidth = 1.5;
    var sx = 14, sy = CH - 16; cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(sx + 20 * S, sy); cx.moveTo(sx, sy - 4); cx.lineTo(sx, sy + 4); cx.moveTo(sx + 10 * S, sy - 3); cx.lineTo(sx + 10 * S, sy + 3); cx.moveTo(sx + 20 * S, sy - 4); cx.lineTo(sx + 20 * S, sy + 4); cx.stroke();
    cx.fillText('2 cables', sx + 20 * S + 6, sy + 4);
    cx.beginPath(); cx.moveTo(CW - 22, 34); cx.lineTo(CW - 22, 12); cx.lineTo(CW - 27, 20); cx.moveTo(CW - 22, 12); cx.lineTo(CW - 17, 20); cx.stroke();
    cx.fillText('N', CW - 26, 48);
    cx.fillStyle = '#e8edf5';
    var O = H.O, Q = H.Q;
    cx.beginPath(); cx.arc(O.x * S, O.y * S, 5, 0, 7); cx.stroke();
    cx.fillText('the offing', O.x * S + 9, O.y * S - 7);
    cx.fillStyle = '#c9b98a'; cx.fillRect(Q.x * S + 2, Q.y * S - 7, 8, 14);
    cx.fillText('quay', Q.x * S - 6, Q.y * S - 11);
    var ch = H.church; cx.fillStyle = '#8b97ab';
    cx.fillRect(ch.x * S - 3, ch.y * S - 9, 6, 11); cx.beginPath(); cx.moveTo(ch.x * S - 4, ch.y * S - 9); cx.lineTo(ch.x * S, ch.y * S - 16); cx.lineTo(ch.x * S + 4, ch.y * S - 9); cx.fill();
    cx.restore();
    // the Hydrographer's track, once it is shown
    if (finished && D.best) drawPolyline(D.best, '#ffce6a', 2, [6, 5]);
    // your track
    if (track.length || mode === 'track') drawPolyline([H.O].concat(track).concat(finished || track.length ? [H.Q] : []), '#64f0c8', 2.2, finished ? null : [4, 3]);
    for (var i = 0; i < track.length; i++) { cx.fillStyle = '#64f0c8'; cx.beginPath(); cx.arc(track[i].x * S, track[i].y * S, 3.2, 0, 7); cx.fill(); }
    // soundings, Admiralty style: fathoms with the feet as a small figure
    cx.save(); cx.textAlign = 'center';
    for (i = 0; i < casts.length; i++) {
      var c = casts[i], X = c.x * S, Y = c.y * S;
      cx.fillStyle = finished ? '#0b0f16' : '#e8edf5';
      if (c.red < 0) { cx.font = '9px ui-monospace,Menlo,monospace'; cx.fillText('dr' + Math.round(-c.red), X, Y + 3); continue; }
      var f = Math.floor(c.red / 6 + 1e-6), r = Math.round(c.red - 6 * f); if (r === 6) { f++; r = 0; }
      cx.font = '600 11px ui-monospace,Menlo,monospace'; cx.fillText(String(f), X - (r ? 2 : 0), Y + 4);
      if (r) { cx.font = '8px ui-monospace,Menlo,monospace'; cx.fillText(String(r), X + 5, Y + 7); }
      if (c.bot === 5) { cx.fillStyle = '#ffce6a'; cx.font = 'italic 9px Georgia,serif'; cx.fillText('R', X + 1, Y - 6); }
    }
    cx.restore();
    if (lineA) { cx.strokeStyle = '#7aa2ff'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(lineA.x * S, lineA.y * S, 6, 0, 7); cx.stroke(); }
    // the boat
    if (!finished) { cx.fillStyle = '#7aa2ff'; cx.beginPath(); cx.arc(boat.x * S, boat.y * S, 4, 0, 7); cx.fill(); }
    // the ship
    if (shipAt) {
      cx.save(); cx.translate(shipAt.x * S, shipAt.y * S); cx.rotate(shipAt.a);
      cx.fillStyle = shipAt.bad ? '#ff8a7a' : '#e8edf5';
      cx.beginPath(); cx.moveTo(9, 0); cx.lineTo(-6, -4.5); cx.lineTo(-6, 4.5); cx.closePath(); cx.fill(); cx.restore();
    }
    if (finished && result && result.ground) {
      cx.strokeStyle = '#ff8a7a'; cx.lineWidth = 2; var gx = result.ground.x * S, gy = result.ground.y * S;
      cx.beginPath(); cx.moveTo(gx - 7, gy - 7); cx.lineTo(gx + 7, gy + 7); cx.moveTo(gx + 7, gy - 7); cx.lineTo(gx - 7, gy + 7); cx.stroke();
    }
    if (finished) for (i = 0; i < D.H.rocks.length; i++) {
      var rk = D.H.rocks[i]; cx.strokeStyle = '#ffce6a'; cx.lineWidth = 1.5; cx.setLineDash([2, 2]);
      cx.beginPath(); cx.arc(rk.x * S, rk.y * S, rk.rad * S * 1.6, 0, 7); cx.stroke(); cx.setLineDash([]);
    }
  }
  function renderStatus() {
    var h = tide(D, now), left = Math.max(0, END - now);
    $('dayHead').innerHTML = finished ? 'The boat is in. <b>' + casts.length + '</b> casts on the chart.' :
      'It is <b>' + hm(now) + '</b>. The pole reads <b>' + f1(h) + ' ft</b> and the tide is ' + (Math.sin(2 * Math.PI * (now - D.HW) / PERIOD) < 0 ? 'making' : 'ebbing') +
      '. <b>' + casts.length + '</b> casts so far; ' + (left > 0 ? '<b>' + Math.floor(left / 60) + ' h ' + Math.round(left % 60) + ' min</b> of light left.' : 'the light has gone.');
    $('btnUndo').disabled = finished || !track.length;
    $('btnClear').disabled = finished || !track.length;
    $('btnBring').disabled = finished;
    $('btnGive').disabled = finished;
    $('btnShade').textContent = shade ? 'Hide the shoal shading' : 'Shade what your soundings call too shoal';
  }
  function renderTide() {
    var W = 720, Hh = 150, L = 40, R = 14, T = 14, B = 26, t0 = 480, t1 = 960, hmax = D.M + D.R / 2 + 1;
    function X(t) { return L + (W - L - R) * (t - t0) / (t1 - t0); }
    function Y(h) { return T + (Hh - T - B) * (1 - h / hmax); }
    var s = '<svg class="bars" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Today\'s tide at the pole, the survey hours and the time of each cast">';
    s += '<rect x="' + X(START) + '" y="' + T + '" width="' + (X(END) - X(START)) + '" height="' + (Hh - T - B) + '" fill="rgba(122,162,255,.05)"/>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#2a3342"/>';
    s += '<text x="' + (L - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text><text x="' + (L - 6) + '" y="' + (Y(Math.floor(hmax)) + 4) + '" text-anchor="end">' + Math.floor(hmax) + ' ft</text>';
    for (var hr = 8; hr <= 16; hr += 2) s += '<text x="' + X(hr * 60) + '" y="' + (Hh - 8) + '" text-anchor="middle">' + hr + ':00</text>';
    var d = ''; for (var t = t0; t <= t1; t += 5) d += (t === t0 ? 'M' : 'L') + X(t).toFixed(1) + ' ' + Y(tide(D, t)).toFixed(1);
    s += '<path d="' + d + '" fill="none" stroke="#7aa2ff" stroke-width="2"/>';
    for (var i = 0; i < casts.length; i++) s += '<circle cx="' + X(casts[i].t).toFixed(1) + '" cy="' + Y(casts[i].pole).toFixed(1) + '" r="2.6" fill="#e8edf5"/>';
    if (!finished) s += '<line x1="' + X(now) + '" x2="' + X(now) + '" y1="' + T + '" y2="' + (Hh - B) + '" stroke="#64f0c8" stroke-dasharray="3 3"/>';
    s += '<text x="' + (W - R) + '" y="' + (T + 10) + '" text-anchor="end"><tspan fill="#7aa2ff">— the pole today</tspan>  ○ casts  <tspan fill="#64f0c8">¦ now</tspan></text></svg>';
    $('tide').innerHTML = s;
  }
  function renderBook() {
    if (!casts.length) { $('book').innerHTML = '<tr><td style="color:var(--dim);font-family:inherit;white-space:normal">Nothing in the book yet. Click the water on the chart to send the boat.</td></tr>'; return; }
    var s = '<tr><th>#</th><th>time</th><th>the leadsman</th><th>water</th><th>pole</th><th>on the chart</th><th>bottom</th></tr>';
    var BOTS = ['m', 's', 'fs', 'sh', 'g', 'R'];
    for (var i = casts.length - 1; i >= 0; i--) {
      var c = casts[i];
      s += '<tr><td>' + c.n + '</td><td>' + hm(c.t) + '</td><td style="font-family:Georgia,serif;font-style:italic">' + c.call + '</td><td>' + (c.water ? f1(c.water) + ' ft' : '—') + '</td><td>' + f1(c.pole) +
        '</td><td class="' + (c.red < D.req ? 'bad' : 'ok') + '">' + fmft(c.red) + '</td><td>' + BOTS[c.bot] + '</td></tr>';
    }
    $('book').innerHTML = s;
  }
  function renderAll() { draw(); renderStatus(); renderTide(); renderBook(); }

  /* ---------- modes and clicks ---------- */
  function setMode(m) {
    if (finished) return;
    mode = m; lineA = null;
    var bs = document.querySelectorAll('[data-mode]');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-mode') === m);
    $('modeHint').textContent = m === 'cast' ? 'Click the water: the boat rows there and the leadsman casts once.' :
      m === 'line' ? 'Click where the line starts, then where it ends: the boat rows it, casting about every three quarters of a cable.' :
      'Click the water to lay the track from the offing toward the quay, a mark at each turn. The last leg runs to the quay by itself.';
    draw();
  }
  function evPos(e) {
    var b = cv.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width * GW, 0, GW - 1), y: clamp((e.clientY - b.top) / b.height * GH, 0, GH - 1) };
  }
  cv.addEventListener('click', function (e) {
    if (finished || anim) return;
    var p = evPos(e);
    if (mode === 'track') { track.push(p); renderAll(); return; }
    if (D.H.d[idx(p.x, p.y)] < -5) { say('That is dry land.'); return; }
    if (mode === 'cast') rowAndCast(p.x, p.y);
    else if (!lineA) { lineA = p; say('Now click where the line ends.'); }
    else { var a = lineA; lineA = null; castLine(a, p); }
    renderAll();
  });

  /* ---------- bringing her in ---------- */
  function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }
  function bringIn(pts, byHydro) {
    if (finished || anim) return;
    finished = true; lineA = null;
    if (byHydro) track = pts.slice(1, -1);
    var tr = trace(D, pts, D.hTrue);
    result = tr;
    truthImg = renderBase(true);
    var stopS = tr.ground ? tr.ground.s : tr.len, t0 = null, dur = 900 + 2600 * stopS / Math.max(tr.len, 1);
    function step(ts) {
      if (t0 == null) t0 = ts;
      var u = Math.min(1, (ts - t0) / dur), s = u * stopS, k = 0;
      while (k < tr.prof.length - 1 && tr.prof[k + 1].s < s) k++;
      var p = tr.prof[k], q = tr.prof[Math.min(k + 1, tr.prof.length - 1)];
      shipAt = { x: p.x, y: p.y, a: Math.atan2(q.y - p.y, q.x - p.x) || shipAt && shipAt.a || 0, bad: u >= 1 && !!tr.ground };
      draw();
      if (u < 1) anim = requestAnimationFrame(step); else { anim = null; verdict(tr, byHydro); renderAll(); }
    }
    say('');
    renderStatus();
    anim = requestAnimationFrame(step);
  }
  function verdict(tr, byHydro) {
    var V = $('verdict'), cab = function (c) { return f1(c / 10) + ' cables'; };
    var under = tr.minWater - D.draught, hb = D.best ? trace(D, D.best, D.hTrue) : null;
    var surge = D.surge >= 0.15 ? 'The wind held the tide up ' + f1(D.surge) + ' ft over the prediction. ' : D.surge <= -0.15 ? 'An offshore wind let the tide down ' + f1(-D.surge) + ' ft under the prediction. ' : '';
    var h = '';
    if (tr.ground) {
      var g = tr.ground, onRock = g.bot === 5;
      V.className = 'verdict warn';
      h += '<p><b>Sir, —</b> ' + capital(D.kind) + ' ' + D.ship + ' took the ground at ' + hm(D.tArr + g.s * 0.15) + ', ' + cab(g.s) + ' inside the offing, in ' + f1(g.w) + ' ft of water, drawing ' + D.draught + '. ' +
        (onRock ? 'It was rock. She was got off on the flood and has gone into the dock with two planks started, and her owners will want to see the chart.' :
          'She lay over on the ' + ['mud', 'sand', 'sand', 'shell', 'gravel'][g.bot] + ' until the flood lifted her, and her master is not pleased.') + '</p>';
    } else if (under < CLEAR) {
      V.className = 'verdict warn';
      h += '<p><b>Sir, —</b> ' + capital(D.kind) + ' ' + D.ship + ' came up to the quay, but the leadsman in her chains called ' + f1(under) + ' ft under her keel at the shoalest, ' +
        cab(tr.minAt.s) + ' in. The harbour master’s two feet were not there, and he says so.</p>';
    } else {
      V.className = 'verdict good';
      h += '<p><b>Sir, —</b> ' + capital(D.kind) + ' ' + D.ship + ' came up to the quay at ' + hm(D.tArr + tr.len * 0.15) + ' with <b>' + f1(under) + ' ft</b> under her at the shoalest. The harbour master asks for a copy of the chart.</p>';
    }
    h += '<p>' + surge + (byHydro ? 'She came in by the Hydrographer’s track. ' : 'Your track is ' + cab(tr.len) + ' long' + (hb ? '; the Hydrographer’s, laid on the true seabed with a margin, is ' + cab(hb.len) + ' and has ' + f1(hb.minWater - D.draught) + ' ft under her at the shoalest.' : '.')) + '</p>';
    // how near did a cast come to the place that mattered?
    var near = 1e9; for (var i = 0; i < casts.length; i++) near = Math.min(near, Math.hypot(casts[i].x - tr.minAt.x, casts[i].y - tr.minAt.y));
    if (!byHydro) h += '<p>The shoalest water on your track was ' + (casts.length ? cab(near) + ' from your nearest cast' : 'never sounded at all') + '. ' +
      'You made ' + casts.length + ' casts. ' + rockWords() + '</p>';
    V.innerHTML = h;
    reveal(tr, hb);
  }
  function rockWords() {
    var R = D.H.rocks, found = 0;
    for (var k = 0; k < R.length; k++) for (var i = 0; i < casts.length; i++) if (Math.hypot(casts[i].x - R[k].x, casts[i].y - R[k].y) < R[k].rad * 2.3) { found++; break; }
    var n = R.length === 1 ? 'one rock' : 'two rocks';
    return 'The bay had ' + n + ' the old chart never showed; your lead found ' + (found === 0 ? 'none of it' : found === R.length ? (R.length === 1 ? 'it' : 'both') : 'one') + '.';
  }
  function reveal(tr, hb) {
    var W = 720, Hh = 220, L = 44, R = 14, T = 30, B = 30, smax = Math.max(tr.len, hb ? hb.len : 0), wmax = 0, i;
    for (i = 0; i < tr.prof.length; i++) wmax = Math.max(wmax, tr.prof[i].w);
    if (hb) for (i = 0; i < hb.prof.length; i++) wmax = Math.max(wmax, hb.prof[i].w);
    wmax = Math.min(Math.max(wmax, D.draught + 6), D.draught * 3);
    function X(s) { return L + (W - L - R) * s / smax; }
    function Y(w) { return T + (Hh - T - B) * clamp(w, -2, wmax) / wmax; }
    var s = '<h5>Her keel over the true seabed</h5><svg class="bars" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Depth of water along the track at her arrival, with her keel and the two feet the harbour master wanted">';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#7aa2ff"/>';
    s += '<text x="' + (L - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text><text x="' + (L - 6) + '" y="' + (Y(D.draught) + 4) + '" text-anchor="end">' + D.draught + ' ft</text>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(D.draught) + '" y2="' + Y(D.draught) + '" stroke="#ff8a7a" stroke-dasharray="5 4"/>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(D.draught + CLEAR) + '" y2="' + Y(D.draught + CLEAR) + '" stroke="#ffce6a" stroke-dasharray="2 4"/>';
    function area(pr, col, fill) {
      var d = 'M' + X(0) + ' ' + (Hh - B);
      for (var k = 0; k < pr.length; k += 2) d += 'L' + X(pr[k].s).toFixed(1) + ' ' + Y(pr[k].w).toFixed(1);
      d += 'L' + X(pr[pr.length - 1].s).toFixed(1) + ' ' + (Hh - B) + 'Z';
      return '<path d="' + d + '" fill="' + fill + '" stroke="' + col + '" stroke-width="1.6"/>';
    }
    if (hb) s += area(hb.prof, '#ffce6a', 'none');
    s += area(tr.prof, '#64f0c8', 'rgba(100,240,200,.10)');
    for (var c = 0; c <= smax * 0.7; c += 10) s += '<text x="' + X(c) + '" y="' + (Hh - 10) + '" text-anchor="middle">' + (c / 10) + '</text>';
    s += '<text x="' + (W - R) + '" y="' + (Hh - 10) + '" text-anchor="end">cables from the offing</text>';
    s += '<text x="' + (W - R) + '" y="14" text-anchor="end"><tspan fill="#64f0c8">— seabed under your track</tspan>  <tspan fill="#ffce6a">— under the Hydrographer’s</tspan>  <tspan fill="#ff8a7a">- - her keel</tspan></text></svg>';
    s += '<p>The chart above now shows the seabed as it is, with the fathom lines at 1, 2, 3, 5 and 8 fathoms, the rocks ringed, your track and the Hydrographer’s in amber. The gap in the bar was where the ebb runs out, ' +
      f1(Math.abs(D.H.gap.y - D.H.O.y) / 10) + ' cables ' + (D.H.gap.y > D.H.O.y ? 'south' : 'north') + ' of the offing. At low water it carried <b>' + fmft(D.Bmax) + '</b> on the best line in.</p>';
    var R2 = D.H.rocks; for (i = 0; i < R2.length; i++) s += '<p>Rock ' + (i + 1) + ': <b>' + fmft(R2[i].top) + '</b> over it at low water.</p>';
    $('reveal').innerHTML = s; $('reveal').style.display = '';
  }

  /* ---------- wiring ---------- */
  document.querySelector('.modes').addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (b) setMode(b.getAttribute('data-mode')); });
  $('btnUndo').addEventListener('click', function () { if (!finished) { track.pop(); renderAll(); } });
  $('btnClear').addEventListener('click', function () { if (!finished) { track = []; renderAll(); } });
  $('btnShade').addEventListener('click', function () { shade = !shade; renderAll(); });
  $('btnBring').addEventListener('click', function () {
    if (finished) return;
    if (!track.length && mode !== 'track') { setMode('track'); say('Lay the track first: click the water to put a mark at each turn, then bring her in. (Bring her in again to send her straight.)'); return; }
    bringIn([D.H.O].concat(track).concat([D.H.Q]), false);
  });
  $('btnGive').addEventListener('click', function () { if (!finished && D.best) bringIn(D.best, true); });
  $('btnReset').addEventListener('click', load);
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || anim) return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
    else if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && track.length && !finished) { e.preventDefault(); track.pop(); renderAll(); }
  });

  load();
})();
