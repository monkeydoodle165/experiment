/* engine.js — The Engine. experiment.quibo.games
   A working machine dealt by the day's number: gear trains with real involute
   teeth, belts, and output mechanisms that actually solve their own kinematics.
   No libraries, no assets. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var PA = 20 * Math.PI / 180;      /* pressure angle */

  /* ---------------- seeded random ---------------- */
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
  function seedForToday() {
    var d = new Date();
    var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function pick(r, a) { return a[Math.min(a.length - 1, Math.floor(r() * a.length))]; }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function rf(r, a, b) { return a + r() * (b - a); }
  function mod(x, m) { return ((x % m) + m) % m; }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  /* ---------------- vocabulary ---------------- */
  var MOVERS = [
    { name: 'hand crank', paddles: 0, note: 'turned by whoever was nearest' },
    { name: 'foot treadle', paddles: 0, note: 'worked with one foot, all day' },
    { name: 'overshot waterwheel', paddles: 12, note: 'fed off a leat from the millpond' },
    { name: 'undershot waterwheel', paddles: 10, note: 'sat in the race and took what the river gave it' },
    { name: 'weight and line', paddles: 0, note: 'a stone on a rope down the stairwell' },
    { name: 'donkey gin', paddles: 0, note: 'one animal, walking in a circle, forever' },
    { name: 'single-acting steam piston', paddles: 0, note: 'two boilers, one of which was trusted' },
    { name: 'windshaft and sails', paddles: 6, note: 'useless on a still day, which was most of them' }
  ];

  var PURPOSES = [
    'grinding pigment fine enough to sell',
    'raising water out of a deep well',
    'stamping blanks into buttons',
    'winding the tower clock overnight',
    'sorting seed by weight',
    'polishing spectacle lenses',
    'beating flax into fibre',
    'printing numbered tickets',
    'testing rope to destruction',
    'cutting cork to size',
    'drawing copper down to wire',
    'putting a point on needles',
    'turning a spit evenly',
    'stirring dye so it would not settle',
    'counting sheets of paper into hundreds',
    'shelling nuts without bruising them',
    'ringing a bell at the end of a shift',
    'folding tin into seams',
    'washing gravel for what was in it',
    'lifting a sluice gate on the hour'
  ];

  var SURNAMES = ['Harrowgate', 'Pell', 'Vance', 'Ostler', 'Quillam', 'Brandt', 'Morrow',
    'Skeffing', 'Tarrant', 'Lowry', 'Ashcombe', 'Merrick', 'Dunmore', 'Fettes',
    'Garrow', 'Hallam', 'Ingles', 'Kerrich', 'Lyle', 'Norbury', 'Peverell', 'Ravensworth'];
  var FIRMS = ['& Sons', '& Daughters', 'Brothers', 'Engineering Works', '& Co.',
    'Ironworks', 'Patent Machine Co.', '& Nephew'];
  var TOWNS = ['Netherfold', 'Cold Ashby', 'Marlhaven', 'Brindlewick', 'Stannage',
    'Water Enderby', 'Gantry Bridge', 'Ollerdale', 'Thurgood', 'Sallowmere',
    'Kirkbarrow', 'Pennyquick', 'Lower Crake', 'Windle Stanton'];
  var FATES = [
    'Broken up for scrap in the second year of the war.',
    'Still turning, in the basement of a museum that has no room to show it.',
    'Lost when the works flooded; the frame was recovered, nothing else.',
    'Superseded inside a decade by an electric one that did the job worse.',
    'The only one ever built. Two were ordered.',
    'Copied badly by three competitors, all of whom outlived the original firm.',
    'Sold at auction as garden ornament. Bought back forty years later.',
    'Ran for thirty-one years without a new part, then failed on a Tuesday.',
    'Withdrawn after an inquest into what it did to an apprentice.',
    'Left in the yard. Rained on until it was a shape rather than a machine.'
  ];
  var ADJ = ['Improved', 'Patent', 'Self-Acting', 'Compound', 'Registered', 'Double-Geared',
    'Continuous', 'Reversible', 'Silent', 'Universal'];
  var NOUN = ['Engine', 'Machine', 'Apparatus', 'Motion', 'Gear', 'Mechanism', 'Frame'];

  /* ---------------- involute gear geometry ---------------- */
  function inv(a) { return Math.tan(a) - a; }
  function psi(r, rb) {
    if (r <= rb) return 0;
    return inv(Math.acos(clamp(rb / r, -1, 1)));
  }
  function gearGeom(N, m) {
    var rp = m * N / 2;
    var ra = rp + m;
    var rr = Math.max(m * 0.5, rp - 1.25 * m);
    var rb = rp * Math.cos(PA);
    var half = Math.PI / (2 * N) + psi(rp, rb);
    var raEff = ra;
    if (half - psi(ra, rb) < 0.006) {
      var lo = rp, hi = ra;
      for (var i = 0; i < 26; i++) {
        var mid = (lo + hi) / 2;
        if (half - psi(mid, rb) > 0.006) lo = mid; else hi = mid;
      }
      raEff = lo;
    }
    return { rp: rp, ra: ra, raEff: raEff, rr: rr, rb: rb, half: half, N: N, m: m };
  }
  function gearPath(g) {
    var p = new Path2D();
    var N = g.N, first = true;
    var rStart = Math.max(g.rb, g.rr);
    var FL = 5;
    for (var k = 0; k < N; k++) {
      var c = TAU * k / N;
      var pts = [];
      /* right flank, root -> tip */
      pts.push([g.rr, c - g.half]);
      for (var i = 0; i <= FL; i++) {
        var rr2 = rStart + (g.raEff - rStart) * (i / FL);
        pts.push([rr2, c - (g.half - psi(rr2, g.rb))]);
      }
      /* tip */
      var ht = g.half - psi(g.raEff, g.rb);
      pts.push([g.raEff, c - ht * 0.34]);
      pts.push([g.raEff, c + ht * 0.34]);
      /* left flank, tip -> root */
      for (var j = FL; j >= 0; j--) {
        var rr3 = rStart + (g.raEff - rStart) * (j / FL);
        pts.push([rr3, c + (g.half - psi(rr3, g.rb))]);
      }
      pts.push([g.rr, c + g.half]);
      for (var q = 0; q < pts.length; q++) {
        var x = pts[q][0] * Math.cos(pts[q][1]);
        var y = pts[q][0] * Math.sin(pts[q][1]);
        if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y);
      }
      /* root arc across to the next tooth */
      var a0 = c + g.half, a1 = c + TAU / N - g.half;
      for (var s = 1; s <= 3; s++) {
        var aa = a0 + (a1 - a0) * (s / 3);
        p.lineTo(g.rr * Math.cos(aa), g.rr * Math.sin(aa));
      }
    }
    p.closePath();
    return p;
  }
  /* the web: wedge cut-outs between spokes, drawn in background colour */
  function webPath(g, arms) {
    var p = new Path2D();
    var rim = g.rr - g.m * 1.15;
    var hub = Math.max(g.m * 1.6, rim * 0.28);
    if (rim - hub < g.m * 1.4 || arms < 3) return null;
    var gap = TAU / arms;
    var spoke = clamp(g.m * 1.5 / rim, 0.08, 0.34);
    for (var k = 0; k < arms; k++) {
      var a0 = k * gap + spoke, a1 = (k + 1) * gap - spoke;
      if (a1 <= a0) continue;
      p.moveTo(rim * Math.cos(a0), rim * Math.sin(a0));
      var st = 12;
      for (var i = 1; i <= st; i++) {
        var a = a0 + (a1 - a0) * (i / st);
        p.lineTo(rim * Math.cos(a), rim * Math.sin(a));
      }
      for (var j = st; j >= 0; j--) {
        var b = a0 + (a1 - a0) * (j / st);
        p.lineTo(hub * Math.cos(b), hub * Math.sin(b));
      }
      p.closePath();
    }
    return p;
  }

  /* ---------------- convex hull (monotone chain) ---------------- */
  function hull(pts) {
    if (pts.length < 3) return pts.slice();
    var p = pts.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
    var lo = [], i;
    for (i = 0; i < p.length; i++) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop();
      lo.push(p[i]);
    }
    var up = [];
    for (i = p.length - 1; i >= 0; i--) {
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop();
      up.push(p[i]);
    }
    lo.pop(); up.pop();
    return lo.concat(up);
  }

  /* ---------------- the design ---------------- */
  function addWheel(M, shaft, N, m, kind, phi) {
    var g = kind === 'gear' ? gearGeom(N, m) : null;
    var sh = M.shafts[shaft];
    var w = {
      id: M.wheels.length, shaft: shaft, kind: kind, N: N, m: m,
      g: g, r: g ? g.rp : N, ro: g ? g.ra : N,
      x: sh.x, y: sh.y, w: sh.w, phi: phi || 0,
      arms: 0, path: null, web: null
    };
    if (kind === 'gear' && w.r > 34) w.arms = (N % 3 === 0) ? 6 : (N % 2 === 0 ? 4 : 5);
    M.wheels.push(w);
    return w;
  }

  function design(seed) {
    var r = rng(seed >>> 0);
    var M = {
      seed: seed >>> 0, wheels: [], shafts: [], stages: [], devices: [], belts: []
    };
    var m = pick(r, [5, 6, 7, 8]);
    M.m = m;
    M.mover = pick(r, MOVERS);

    M.shafts.push({ x: 0, y: 0, w: 1, name: 'A' });

    var cur = addWheel(M, 0, ri(r, 14, 26), m, 'gear', rf(r, 0, TAU));
    /* the flywheel sits on the same shaft, in a plane behind the first wheel */
    M.fly = {
      shaft: 0, r: clamp(cur.ro * rf(r, 1.06, 1.5), 46, 104),
      arms: ri(r, 4, 7), paddles: M.mover.paddles
    };
    var stages = ri(r, 3, 5);
    var heading = rf(r, -0.3, 0.3);
    var beltUsed = false;
    var names = 'ABCDEFGH';

    for (var s = 0; s < stages; s++) {
      var last = (s === stages - 1);
      var wantBelt = (!beltUsed && s > 0 && !last && r() < 0.34);
      var drivingWheel = cur;
      var kind = 'gear';
      var Nb, rB, dist, crossed = false;

      if (wantBelt) {
        kind = 'belt';
        beltUsed = true;
        var rPul = rf(r, 20, 40);
        drivingWheel = addWheel(M, cur.shaft, rPul, m, 'pulley', 0);
        rB = rf(r, 22, 52);
        dist = (rPul + rB) * rf(r, 1.9, 2.9);
        crossed = r() < 0.35;
      } else {
        Nb = ri(r, Math.max(18, Math.round(drivingWheel.N * 1.1)), Math.max(30, Math.round(drivingWheel.N * 2.6)));
        Nb = clamp(Nb, 16, 78);
        rB = m * Nb / 2;
        dist = drivingWheel.r + rB;
      }

      /* find a direction that keeps the new wheel clear of everything else.
         Wheels sharing the driving shaft are exempt: like any compound train,
         they live in their own plane and are allowed to overlap in plan. */
      var best = null, fallback = null;
      for (var t = 0; t < 60; t++) {
        var ang = heading + (t === 0 ? 0 : rf(r, -1.25, 1.25));
        var nx = drivingWheel.x + Math.cos(ang) * dist;
        var ny = drivingWheel.y + Math.sin(ang) * dist;
        var cand = { ang: ang, x: nx, y: ny };
        if (!fallback) fallback = cand;
        var ok = true;
        for (var q = 0; q < M.wheels.length; q++) {
          var W = M.wheels[q];
          if (W.shaft === drivingWheel.shaft) continue;
          var d = Math.hypot(W.x - nx, W.y - ny);
          if (d < W.ro + rB + m * 1.6) { ok = false; break; }
        }
        for (var z = 0; z < M.shafts.length && ok; z++) {
          if (Math.hypot(M.shafts[z].x - nx, M.shafts[z].y - ny) < 34) ok = false;
        }
        if (ok) { best = cand; break; }
      }
      if (!best) best = fallback;
      if (!best) break;

      var idx = M.shafts.length;
      var wB;
      if (kind === 'belt') {
        var wv = drivingWheel.w * (drivingWheel.N / rB) * (crossed ? -1 : 1);
        M.shafts.push({ x: best.x, y: best.y, w: wv, name: names[idx] || ('S' + idx) });
        wB = addWheel(M, idx, rB, m, 'pulley', 0);
        M.belts.push({ a: drivingWheel, b: wB, crossed: crossed });
        M.stages.push({
          type: 'belt', from: drivingWheel, to: wB, crossed: crossed,
          ratio: rB / drivingWheel.N
        });
      } else {
        var Na = drivingWheel.N;
        var wv2 = -drivingWheel.w * (Na / Nb);
        M.shafts.push({ x: best.x, y: best.y, w: wv2, name: names[idx] || ('S' + idx) });
        var C = best.ang * (1 + Na / Nb) + Math.PI - Math.PI / Nb;
        var phiB = -drivingWheel.phi * (Na / Nb) + C;
        wB = addWheel(M, idx, Nb, m, 'gear', phiB);
        M.stages.push({ type: 'gear', from: drivingWheel, to: wB, ratio: Nb / Na });
      }
      heading = best.ang * 0.55 + heading * 0.45;

      /* compound: a small pinion sharing the new shaft, driving the next stage */
      if (!last && r() < 0.62) {
        var Np = ri(r, 11, Math.max(13, Math.round(wB.N * 0.55)));
        Np = clamp(Np, 11, 26);
        var pin = addWheel(M, idx, Np, m, 'gear', rf(r, 0, TAU));
        pin.compound = true;
        cur = pin;
      } else {
        cur = wB;
      }
    }

    /* ---- centroid, for pointing devices outwards ---- */
    var cx = 0, cy = 0;
    for (var i = 0; i < M.shafts.length; i++) { cx += M.shafts[i].x; cy += M.shafts[i].y; }
    cx /= M.shafts.length; cy /= M.shafts.length;
    M.centroid = { x: cx, y: cy };

    /* ---- output mechanisms ---- */
    var kinds = ['piston', 'fourbar', 'hammer', 'geneva', 'escapement', 'governor'];
    for (var k1 = kinds.length - 1; k1 > 0; k1--) {
      var k2 = Math.floor(r() * (k1 + 1));
      var tmp = kinds[k1]; kinds[k1] = kinds[k2]; kinds[k2] = tmp;
    }
    var hosts = [M.shafts.length - 1];
    if (M.shafts.length >= 4 && r() < 0.6) hosts.push(ri(r, 1, M.shafts.length - 2));
    if (M.shafts.length >= 5 && r() < 0.3) hosts.push(1);
    var seen = {};
    for (var h = 0; h < hosts.length; h++) {
      var si = hosts[h];
      if (seen[si]) continue;
      seen[si] = 1;
      var dv = makeDevice(r, M, si, kinds[h % kinds.length]);
      if (dv) M.devices.push(dv);
    }

    /* ---- paperwork ---- */
    M.purpose = pick(r, PURPOSES);
    M.maker = pick(r, SURNAMES) + ' ' + pick(r, FIRMS);
    M.town = pick(r, TOWNS);
    M.fate = pick(r, FATES);
    M.title = 'The ' + pick(r, ADJ) + ' ' + pick(r, NOUN);
    M.patent = ri(r, 1104, 98741);
    M.year = ri(r, 1802, 1931);
    M.rpm = ri(r, 9, 26);

    var tot = 1;
    for (var st = 0; st < M.stages.length; st++) tot *= M.stages[st].ratio;
    M.reduction = tot;
    return M;
  }

  /* point a mechanism into the emptiest quarter available to its shaft */
  function outward(M, si, r, R) {
    var sh = M.shafts[si];
    var bias = rf(r, 0, TAU);
    var bestA = 0, bestScore = -1e9;
    for (var k = 0; k < 32; k++) {
      var a = bias + TAU * k / 32;
      var score = 1e9;
      for (var probe = 1; probe <= 3; probe++) {
        var px = sh.x + Math.cos(a) * R * probe * 0.9;
        var py = sh.y + Math.sin(a) * R * probe * 0.9;
        for (var j = 0; j < M.wheels.length; j++) {
          var w = M.wheels[j];
          if (w.shaft === si) continue;
          score = Math.min(score, Math.hypot(w.x - px, w.y - py) - w.ro);
        }
        score = Math.min(score, Math.hypot(M.shafts[0].x - px, M.shafts[0].y - py) - M.fly.r);
      }
      /* a mild preference for pointing away from the middle of the machine */
      var out = (Math.cos(a) * (sh.x - M.centroid.x) + Math.sin(a) * (sh.y - M.centroid.y));
      score += out * 0.12;
      if (score > bestScore) { bestScore = score; bestA = a; }
    }
    return { x: Math.cos(bestA), y: Math.sin(bestA), a: bestA };
  }
  function shaftWheelR(M, si) {
    var best = 20;
    for (var i = 0; i < M.wheels.length; i++) {
      if (M.wheels[i].shaft === si) best = Math.max(best, M.wheels[i].ro);
    }
    return best;
  }

  function makeDevice(r, M, si, kind) {
    var R = shaftWheelR(M, si);
    var u = outward(M, si, r, R);
    var sh = M.shafts[si];
    var d = { kind: kind, shaft: si, u: u, R: R, x: sh.x, y: sh.y };

    if (kind === 'piston') {
      d.rc = clamp(R * rf(r, 0.42, 0.68), 14, 46);
      d.L = Math.max(d.rc * rf(r, 2.8, 4.1), R + d.rc * 1.5);
      d.bore = d.rc * rf(r, 0.62, 0.85);
      d.off = d.L - d.rc - d.bore * 0.35;
      d.cyl = 2 * d.rc + d.bore * 1.1;
      d.label = 'crank and slider';
      d.does = 'converts the turning into a straight push';
      d.reach = d.off + d.cyl + d.rc;
    } else if (kind === 'fourbar') {
      d.r2 = clamp(R * rf(r, 0.34, 0.55), 12, 40);
      d.g = d.r2 * rf(r, 3.0, 4.2);
      d.L3 = d.r2 * rf(r, 2.9, 3.9);
      d.L4 = d.r2 * rf(r, 1.9, 3.0);
      d.branch = r() < 0.5;
      d.cu = d.L3 * rf(r, 0.35, 0.72);
      d.cv = d.L3 * rf(r, -0.62, 0.62);
      /* make sure the crank can actually go round */
      var okAll = false;
      for (var fix = 0; fix < 40 && !okAll; fix++) {
        okAll = true;
        for (var a = 0; a < TAU; a += TAU / 120) {
          if (!solveFourbar(d, a)) { okAll = false; break; }
        }
        if (!okAll) { d.L3 *= 1.06; d.L4 *= 1.03; }
      }
      d.ok = okAll;
      d.reach = d.g + d.L4 + d.L3 * 0.6;
      d.label = 'four-bar linkage';
      d.does = 'swings a beam back and forth on an uneven rhythm';
    } else if (kind === 'hammer') {
      d.base = clamp(R * rf(r, 0.5, 0.75), 16, 44);
      d.lift = d.base * rf(r, 0.35, 0.62);
      d.snail = r() < 0.55;
      d.stem = d.base * rf(r, 1.5, 2.4);
      d.headW = d.base * rf(r, 0.5, 0.8);
      d.reach = d.base + d.lift + d.stem + d.headW;
      d.label = d.snail ? 'snail cam and drop hammer' : 'harmonic cam and follower';
      d.does = d.snail ? 'lifts a hammer and lets it fall' : 'lifts and lowers a follower smoothly';
    } else if (kind === 'geneva') {
      d.n = ri(r, 4, 6);
      d.a = clamp(R * rf(r, 0.5, 0.72), 15, 40);
      d.c = d.a / Math.sin(Math.PI / d.n);
      d.wr = Math.sqrt(Math.max(1, d.c * d.c - d.a * d.a));
      d.pin = Math.max(3.4, d.a * 0.13);
      d.reach = d.c + d.wr + 6;
      d.label = d.n + '-slot Geneva wheel';
      d.does = 'turns continuous motion into ' + d.n + ' stops a revolution';
    } else if (kind === 'escapement') {
      d.Ne = ri(r, 15, 30);
      d.er = clamp(R * rf(r, 0.62, 0.9), 20, 48);
      d.anchor = d.er * 1.42;
      d.pend = d.er * rf(r, 4.2, 6.4);
      d.bob = d.er * 0.38;
      d.amp = rf(r, 0.11, 0.2);
      d.reach = d.anchor + d.pend + d.bob;
      d.label = 'anchor escapement';
      d.does = 'lets the train forward one tooth at a time';
    } else {
      d.kind = 'governor';
      d.dist = R * rf(r, 1.15, 1.6);
      d.spin = R * rf(r, 1.5, 2.2);
      d.arm = R * rf(r, 0.95, 1.5);
      d.ball = R * rf(r, 0.24, 0.36);
      d.reach = d.dist + d.spin + d.arm + d.ball;
      d.label = 'centrifugal governor';
      d.does = 'notices when the machine is running away with itself';
    }
    return d;
  }

  /* ---------------- kinematics ---------------- */
  function wAng(w, th) { return th * w.w + w.phi; }

  function solveFourbar(d, th) {
    var Px = Math.cos(th) * d.r2, Py = Math.sin(th) * d.r2;   /* local: O2 at origin */
    var Ox = d.g, Oy = 0;
    var dx = Ox - Px, dy = Oy - Py, dd = Math.hypot(dx, dy);
    if (dd > d.L3 + d.L4 || dd < Math.abs(d.L3 - d.L4) || dd < 1e-6) return null;
    var a = (d.L3 * d.L3 - d.L4 * d.L4 + dd * dd) / (2 * dd);
    var hh = Math.sqrt(Math.max(0, d.L3 * d.L3 - a * a));
    var mx = Px + a * dx / dd, my = Py + a * dy / dd;
    var ux = -dy / dd, uy = dx / dd;
    var s = d.branch ? 1 : -1;
    var Bx = mx + s * hh * ux, By = my + s * hh * uy;
    var ex = (Bx - Px) / d.L3, ey = (By - Py) / d.L3;
    return {
      P: { x: Px, y: Py }, B: { x: Bx, y: By },
      C: { x: Px + ex * d.cu - ey * d.cv, y: Py + ey * d.cu + ex * d.cv }
    };
  }

  function camR(d, phi) {
    var t = mod(phi, TAU) / TAU;
    if (d.snail) {
      var f = t < 0.94 ? (t / 0.94) : (1 - (t - 0.94) / 0.06);
      return d.base + d.lift * f;
    }
    if (t < 0.35) { var a = t / 0.35; return d.base + d.lift * (a - Math.sin(TAU * a) / TAU); }
    if (t < 0.5) return d.base + d.lift;
    if (t < 0.85) { var b = (t - 0.5) / 0.35; return d.base + d.lift * (1 - (b - Math.sin(TAU * b) / TAU)); }
    return d.base;
  }

  function genevaAngle(d, th) {
    var n = d.n;
    var ae = Math.PI / 2 - Math.PI / n;
    var turns = Math.floor((th + Math.PI) / TAU);
    var loc = th - turns * TAU;                 /* in (-pi, pi] */
    var b;
    if (loc > ae) b = Math.PI / n;
    else if (loc < -ae) b = -Math.PI / n;
    else b = Math.atan2(d.a * Math.sin(loc), d.c - d.a * Math.cos(loc));
    return turns * (TAU / n) + b;
  }

  /* ---------------- palettes ---------------- */
  var FINISHES = [
    {
      key: 'brass', name: 'Brass',
      bg: '#100d09', plate: '#241c12', plateEdge: '#4a3a22', screw: '#c9a25e',
      gear: ['#f0cd84', '#8f6725'], gearEdge: '#ffe7b8', pinion: ['#ffe1a0', '#a2762c'],
      steel: '#cbd4de', steelEdge: '#eef3f9', rod: '#b6c0cc',
      belt: '#6b5236', trace: '#64f0c8', ink: '#e8edf5', dim: '#9b8a6d', line: false
    },
    {
      key: 'iron', name: 'Cast iron',
      bg: '#0a0d13', plate: '#151b25', plateEdge: '#2b3646', screw: '#8fa1b6',
      gear: ['#9fb2c6', '#38455a'], gearEdge: '#d6e2f0', pinion: ['#c2d2e2', '#4a5a70'],
      steel: '#cfd8e3', steelEdge: '#f0f5fb', rod: '#a9b5c4',
      belt: '#3a4353', trace: '#64f0c8', ink: '#e8edf5', dim: '#7f8ea2', line: false
    },
    {
      key: 'blueprint', name: 'Blueprint',
      bg: '#07284a', plate: 'rgba(255,255,255,.035)', plateEdge: 'rgba(190,225,255,.5)',
      screw: '#bfe3ff', gear: ['rgba(255,255,255,.05)', 'rgba(255,255,255,.02)'],
      gearEdge: '#cfe9ff', pinion: ['rgba(255,255,255,.06)', 'rgba(255,255,255,.02)'],
      steel: 'rgba(255,255,255,.07)', steelEdge: '#dff0ff', rod: 'rgba(255,255,255,.07)',
      belt: 'rgba(215,240,255,.5)', trace: '#8ef7d6', ink: '#eaf6ff', dim: '#9fc8e8', line: true
    }
  ];

  /* ---------------- state ---------------- */
  var canvas = document.getElementById('engine');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var M = null, pal = FINISHES[0];
  var th = 0, rpm = 16, running = true, raf = null, lastT = 0;
  var showTrace = true, showLabels = false, sel = null;
  var view = { s: 1, ox: 0, oy: 0 };
  var W = 960, H = 620, DPR = 1;
  var drag = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }

  /* ---------------- fitting ---------------- */
  function bounds() {
    var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    function add(x, y, r) {
      r = r || 0;
      if (x - r < b.x0) b.x0 = x - r;
      if (y - r < b.y0) b.y0 = y - r;
      if (x + r > b.x1) b.x1 = x + r;
      if (y + r > b.y1) b.y1 = y + r;
    }
    for (var i = 0; i < M.wheels.length; i++) add(M.wheels[i].x, M.wheels[i].y, M.wheels[i].ro + 4);
    add(M.shafts[0].x, M.shafts[0].y, M.fly.r + 10);
    for (var j = 0; j < M.devices.length; j++) {
      var d = M.devices[j];
      add(d.x, d.y, d.R + 8);
      if (d.kind === 'governor') {
        var up = { x: -d.u.y, y: d.u.x };
        add(d.x + d.u.x * d.dist + up.x * d.spin, d.y + d.u.y * d.dist + up.y * d.spin,
          d.arm + d.ball + 6);
      } else {
        var wide = (d.kind === 'fourbar' || d.kind === 'geneva') ? 0.5 : 0.3;
        add(d.x + d.u.x * d.reach, d.y + d.u.y * d.reach,
          Math.max(d.R * 0.8, d.reach * wide));
      }
    }
    return b;
  }
  function fit() {
    var b = bounds();
    var bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    var pad = 26;
    var s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    view.s = s;
    view.ox = (W - bw * s) / 2 - b.x0 * s;
    view.oy = (H - bh * s) / 2 - b.y0 * s;
  }
  function toScreen(x, y) { return { x: x * view.s + view.ox, y: y * view.s + view.oy }; }
  function toWorld(x, y) { return { x: (x - view.ox) / view.s, y: (y - view.oy) / view.s }; }

  /* ---------------- drawing helpers ---------------- */
  function metal(x, y, r, cols) {
    var g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, cols[0]);
    g.addColorStop(0.55, cols[1]);
    g.addColorStop(1, cols[0]);
    return g;
  }
  function bar(x0, y0, x1, y1, w, fill, edge) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    var ux = dx / L, uy = dy / L, px = -uy * w / 2, py = ux * w / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + px, y0 + py);
    ctx.lineTo(x1 + px, y1 + py);
    ctx.arc(x1, y1, w / 2, Math.atan2(py, px), Math.atan2(py, px) + Math.PI, true);
    ctx.lineTo(x0 - px, y0 - py);
    ctx.arc(x0, y0, w / 2, Math.atan2(-py, -px), Math.atan2(-py, -px) + Math.PI, true);
    ctx.closePath();
    if (!pal.line && fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = edge || pal.steelEdge;
    ctx.lineWidth = pal.line ? 1.4 / view.s : 1 / view.s;
    ctx.stroke();
  }
  function disc(x, y, r, fill, edge, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = (lw || 1) / view.s;
      ctx.stroke();
    }
  }
  function pivot(x, y, r) {
    disc(x, y, r, pal.line ? null : pal.steel, pal.steelEdge, 1.2);
    disc(x, y, r * 0.35, pal.line ? null : pal.bg, pal.steelEdge, 1);
  }

  /* ---------------- parts ---------------- */
  function drawFrame() {
    var pts = [];
    for (var i = 0; i < M.shafts.length; i++) pts.push({ x: M.shafts[i].x, y: M.shafts[i].y });
    for (var j = 0; j < M.devices.length; j++) {
      var d = M.devices[j];
      if (d.kind === 'fourbar') pts.push(rotPt(d, d.g, 0));
      if (d.kind === 'geneva') pts.push({ x: d.x + d.u.x * d.c, y: d.y + d.u.y * d.c });
      if (d.kind === 'escapement') pts.push({ x: d.x + d.u.x * d.anchor, y: d.y + d.u.y * d.anchor });
      if (d.kind === 'governor') pts.push({ x: d.x + d.u.x * d.dist, y: d.y + d.u.y * d.dist });
    }
    var hp = hull(pts);
    if (hp.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(hp[0].x, hp[0].y);
    for (var k = 1; k < hp.length; k++) ctx.lineTo(hp[k].x, hp[k].y);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 62;
    ctx.strokeStyle = pal.plate;
    if (!pal.line) { ctx.stroke(); ctx.fillStyle = pal.plate; ctx.fill(); }
    ctx.lineWidth = pal.line ? 1.1 / view.s : 1.4 / view.s;
    ctx.strokeStyle = pal.plateEdge;
    ctx.beginPath();
    ctx.moveTo(hp[0].x, hp[0].y);
    for (var q = 1; q < hp.length; q++) ctx.lineTo(hp[q].x, hp[q].y);
    ctx.closePath();
    ctx.stroke();
    for (var z = 0; z < hp.length; z++) {
      var cx = M.centroid.x, cy = M.centroid.y;
      var dx = hp[z].x - cx, dy = hp[z].y - cy, L = Math.hypot(dx, dy) || 1;
      var sx = hp[z].x + dx / L * 20, sy = hp[z].y + dy / L * 20;
      disc(sx, sy, 5.5, pal.line ? null : pal.plateEdge, pal.screw, 1);
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy - 1.6); ctx.lineTo(sx + 4, sy + 1.6);
      ctx.strokeStyle = pal.screw; ctx.lineWidth = 1.3 / view.s; ctx.stroke();
    }
  }
  function rotPt(d, along, across) {
    return {
      x: d.x + d.u.x * along - d.u.y * across,
      y: d.y + d.u.y * along + d.u.x * across
    };
  }

  function drawBelts() {
    for (var i = 0; i < M.belts.length; i++) {
      var B = M.belts[i], A = B.a, b = B.b;
      var dx = b.x - A.x, dy = b.y - A.y, dd = Math.hypot(dx, dy);
      var al = Math.atan2(dy, dx);
      var rA = A.N, rB = b.N;
      ctx.lineWidth = Math.max(2.4, M.m * 0.55);
      ctx.strokeStyle = pal.belt;
      ctx.lineCap = 'butt';
      if (!B.crossed) {
        var gm = Math.acos(clamp((rA - rB) / dd, -1, 1));
        ctx.beginPath();
        ctx.arc(A.x, A.y, rA, al + gm, al - gm + TAU, false);
        ctx.lineTo(b.x + rB * Math.cos(al - gm), b.y + rB * Math.sin(al - gm));
        ctx.arc(b.x, b.y, rB, al - gm, al + gm, false);
        ctx.closePath();
        ctx.stroke();
      } else {
        var gc = Math.acos(clamp((rA + rB) / dd, -1, 1));
        ctx.beginPath();
        ctx.arc(A.x, A.y, rA, al + gc, al - gc + TAU, false);
        ctx.lineTo(b.x + rB * Math.cos(al - gc + Math.PI), b.y + rB * Math.sin(al - gc + Math.PI));
        ctx.arc(b.x, b.y, rB, al - gc + Math.PI, al + gc - Math.PI, true);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  function drawWheel(w) {
    var a = wAng(w, th);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(a);
    if (w.kind === 'gear') {
      if (!w.path) { w.path = gearPath(w.g); w.web = webPath(w.g, w.arms); }
      var cols = w.r < 45 ? pal.pinion : pal.gear;
      ctx.fillStyle = pal.line ? cols[0] : metal(0, 0, w.ro, cols);
      ctx.fill(w.path);
      ctx.strokeStyle = (sel && sel.type === 'wheel' && sel.ref === w) ? pal.trace : pal.gearEdge;
      ctx.lineWidth = (pal.line ? 1.1 : 0.9) / view.s * (sel && sel.ref === w ? 2.2 : 1);
      ctx.stroke(w.path);
      if (w.web) {
        ctx.fillStyle = pal.bg;
        if (!pal.line) ctx.fill(w.web);
        ctx.strokeStyle = pal.line ? pal.gearEdge : pal.plateEdge;
        ctx.lineWidth = (pal.line ? 0.9 : 0.8) / view.s;
        ctx.stroke(w.web);
      }
    } else {
      /* pulley */
      var R = w.N;
      disc(0, 0, R, pal.line ? null : metal(0, 0, R, pal.gear), pal.gearEdge, 1.2);
      disc(0, 0, R * 0.86, null, pal.plateEdge, 0.9);
      for (var s = 0; s < 6; s++) {
        var ang = TAU * s / 6;
        bar(Math.cos(ang) * R * 0.16, Math.sin(ang) * R * 0.16,
          Math.cos(ang) * R * 0.84, Math.sin(ang) * R * 0.84,
          Math.max(3, R * 0.1), pal.line ? null : pal.gear[1], pal.plateEdge);
      }
    }
    /* hub + keyway so rotation is legible */
    var hub = Math.max(6, (w.kind === 'gear' ? w.g.rp : w.N) * 0.17);
    disc(0, 0, hub, pal.line ? null : pal.steel, pal.steelEdge, 1);
    ctx.beginPath();
    ctx.moveTo(hub * 0.25, -hub * 0.95);
    ctx.lineTo(-hub * 0.25, -hub * 0.95);
    ctx.lineTo(-hub * 0.25, -hub * 0.4);
    ctx.lineTo(hub * 0.25, -hub * 0.4);
    ctx.closePath();
    ctx.strokeStyle = pal.steelEdge;
    ctx.lineWidth = 1 / view.s;
    ctx.stroke();
    ctx.restore();
  }

  function drawFlywheel() {
    var f = M.fly, s0 = M.shafts[0];
    var a = th * s0.w;
    ctx.save();
    ctx.translate(s0.x, s0.y);
    ctx.rotate(a);
    if (f.paddles) {
      for (var p = 0; p < f.paddles; p++) {
        var ang = TAU * p / f.paddles;
        ctx.save(); ctx.rotate(ang);
        ctx.beginPath();
        ctx.rect(f.r * 0.92, -f.r * 0.12, f.r * 0.2, f.r * 0.24);
        if (!pal.line) { ctx.fillStyle = pal.belt; ctx.fill(); }
        ctx.strokeStyle = pal.plateEdge; ctx.lineWidth = 1 / view.s; ctx.stroke();
        ctx.restore();
      }
    }
    disc(0, 0, f.r, null, pal.gearEdge, 2.2);
    disc(0, 0, f.r * 0.88, null, pal.gearEdge, 2.2);
    if (!pal.line) {
      ctx.beginPath();
      ctx.arc(0, 0, f.r * 0.94, 0, TAU);
      ctx.strokeStyle = metal(0, 0, f.r, pal.gear);
      ctx.lineWidth = f.r * 0.12;
      ctx.stroke();
    }
    for (var k = 0; k < f.arms; k++) {
      var b = TAU * k / f.arms;
      bar(Math.cos(b) * f.r * 0.14, Math.sin(b) * f.r * 0.14,
        Math.cos(b) * f.r * 0.88, Math.sin(b) * f.r * 0.88,
        f.r * 0.075, pal.line ? null : pal.gear[1], pal.gearEdge);
    }
    disc(0, 0, f.r * 0.17, pal.line ? null : pal.steel, pal.steelEdge, 1.2);
    /* crank handle */
    var hx = f.r * 0.62;
    bar(0, 0, hx, 0, f.r * 0.055, pal.line ? null : pal.rod, pal.steelEdge);
    disc(hx, 0, f.r * 0.1, pal.line ? null : pal.steel, pal.steelEdge, 1.2);
    ctx.restore();
  }

  /* ---- devices ---- */
  function drawDevice(d) {
    var sh = M.shafts[d.shaft];
    var a = th * sh.w;
    var hot = (sel && sel.type === 'device' && sel.ref === d);
    ctx.save();
    if (hot) { ctx.shadowColor = pal.trace; ctx.shadowBlur = 14; }
    if (d.kind === 'piston') drawPiston(d, a);
    else if (d.kind === 'fourbar') drawFourbar(d, a);
    else if (d.kind === 'hammer') drawHammer(d, a);
    else if (d.kind === 'geneva') drawGeneva(d, a);
    else if (d.kind === 'escapement') drawEscape(d, a);
    else drawGovernor(d, a);
    ctx.restore();
  }

  function drawPiston(d, a) {
    var px = d.x + Math.cos(a) * d.rc, py = d.y + Math.sin(a) * d.rc;
    /* slider runs along u */
    var proj = (px - d.x) * d.u.x + (py - d.y) * d.u.y;
    var lat = -(px - d.x) * d.u.y + (py - d.y) * d.u.x;
    var s = proj + Math.sqrt(Math.max(1, d.L * d.L - lat * lat));
    var sx = d.x + d.u.x * s, sy = d.y + d.u.y * s;
    /* cylinder */
    var c0 = rotPt(d, d.off, 0);
    var ax = d.u.x, ay = d.u.y, nx = -d.u.y, ny = d.u.x;
    ctx.beginPath();
    ctx.moveTo(c0.x + nx * d.bore, c0.y + ny * d.bore);
    ctx.lineTo(c0.x + ax * d.cyl + nx * d.bore, c0.y + ay * d.cyl + ny * d.bore);
    ctx.lineTo(c0.x + ax * d.cyl - nx * d.bore, c0.y + ay * d.cyl - ny * d.bore);
    ctx.lineTo(c0.x - nx * d.bore, c0.y - ny * d.bore);
    ctx.closePath();
    if (!pal.line) { ctx.fillStyle = pal.plate; ctx.fill(); }
    ctx.strokeStyle = pal.steelEdge; ctx.lineWidth = 1.6 / view.s; ctx.stroke();
    if (showTrace) {
      ctx.setLineDash([6 / view.s, 6 / view.s]);
      ctx.beginPath();
      ctx.moveTo(d.x + d.u.x * (d.L - d.rc), d.y + d.u.y * (d.L - d.rc));
      ctx.lineTo(d.x + d.u.x * (d.L + d.rc), d.y + d.u.y * (d.L + d.rc));
      ctx.strokeStyle = pal.trace; ctx.lineWidth = 1.2 / view.s; ctx.stroke();
      ctx.setLineDash([]);
    }
    bar(px, py, sx, sy, Math.max(4, d.rc * 0.22), pal.line ? null : pal.rod, pal.steelEdge);
    /* piston head */
    ctx.beginPath();
    ctx.moveTo(sx + nx * d.bore * 0.86, sy + ny * d.bore * 0.86);
    ctx.lineTo(sx + ax * d.rc * 0.7 + nx * d.bore * 0.86, sy + ay * d.rc * 0.7 + ny * d.bore * 0.86);
    ctx.lineTo(sx + ax * d.rc * 0.7 - nx * d.bore * 0.86, sy + ay * d.rc * 0.7 - ny * d.bore * 0.86);
    ctx.lineTo(sx - nx * d.bore * 0.86, sy - ny * d.bore * 0.86);
    ctx.closePath();
    if (!pal.line) { ctx.fillStyle = pal.steel; ctx.fill(); }
    ctx.strokeStyle = pal.steelEdge; ctx.lineWidth = 1.2 / view.s; ctx.stroke();
    pivot(px, py, Math.max(3.4, d.rc * 0.16));
  }

  function drawFourbar(d, a) {
    var s = solveFourbar(d, a - d.u.a);
    if (!s) return;
    function L(p) {
      return { x: d.x + d.u.x * p.x - d.u.y * p.y, y: d.y + d.u.y * p.x + d.u.x * p.y };
    }
    var O4 = L({ x: d.g, y: 0 });
    var P = L(s.P), B = L(s.B), C = L(s.C);
    if (showTrace) {
      ctx.beginPath();
      var first = true;
      for (var t = 0; t <= TAU + 0.01; t += TAU / 160) {
        var q = solveFourbar(d, t);
        if (!q) continue;
        var pc = L(q.C);
        if (first) { ctx.moveTo(pc.x, pc.y); first = false; } else ctx.lineTo(pc.x, pc.y);
      }
      ctx.strokeStyle = pal.trace;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1.4 / view.s;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    bar(d.x, d.y, P.x, P.y, Math.max(4.5, d.r2 * 0.24), pal.line ? null : pal.rod, pal.steelEdge);
    bar(O4.x, O4.y, B.x, B.y, Math.max(4.5, d.r2 * 0.22), pal.line ? null : pal.rod, pal.steelEdge);
    /* coupler as a triangle plate */
    ctx.beginPath();
    ctx.moveTo(P.x, P.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y);
    ctx.closePath();
    if (!pal.line) { ctx.fillStyle = pal.rod; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = pal.steelEdge; ctx.lineWidth = 1.4 / view.s; ctx.stroke();
    pivot(P.x, P.y, Math.max(3.4, d.r2 * 0.17));
    pivot(B.x, B.y, Math.max(3.4, d.r2 * 0.17));
    pivot(O4.x, O4.y, Math.max(4.2, d.r2 * 0.2));
    disc(C.x, C.y, Math.max(3, d.r2 * 0.13), pal.trace, pal.trace, 1);
  }

  function drawHammer(d, a) {
    /* cam profile in world space */
    ctx.beginPath();
    for (var i = 0; i <= 180; i++) {
      var f = TAU * i / 180;
      var R = camR(d, f);
      var x = d.x + Math.cos(f + a) * R, y = d.y + Math.sin(f + a) * R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (!pal.line) { ctx.fillStyle = metal(d.x, d.y, d.base, pal.pinion); ctx.fill(); }
    ctx.strokeStyle = pal.gearEdge; ctx.lineWidth = 1.4 / view.s; ctx.stroke();
    /* follower rides along u */
    var lift = camR(d, d.u.a - a);
    var f0 = rotPt(d, lift, 0);
    var f1 = rotPt(d, lift + d.stem, 0);
    if (showTrace) {
      ctx.setLineDash([5 / view.s, 5 / view.s]);
      ctx.beginPath();
      var g0 = rotPt(d, d.base + d.stem, 0), g1 = rotPt(d, d.base + d.lift + d.stem, 0);
      ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y);
      ctx.strokeStyle = pal.trace; ctx.lineWidth = 1.2 / view.s; ctx.stroke();
      ctx.setLineDash([]);
    }
    disc(f0.x, f0.y, Math.max(3.6, d.base * 0.14), pal.line ? null : pal.steel, pal.steelEdge, 1.2);
    bar(f0.x, f0.y, f1.x, f1.y, Math.max(4, d.base * 0.16), pal.line ? null : pal.rod, pal.steelEdge);
    /* head */
    var hw = d.headW, hh = d.headW * 0.6;
    var ax = d.u.x, ay = d.u.y, nx = -d.u.y, ny = d.u.x;
    ctx.beginPath();
    ctx.moveTo(f1.x + nx * hw, f1.y + ny * hw);
    ctx.lineTo(f1.x + ax * hh + nx * hw, f1.y + ay * hh + ny * hw);
    ctx.lineTo(f1.x + ax * hh - nx * hw, f1.y + ay * hh - ny * hw);
    ctx.lineTo(f1.x - nx * hw, f1.y - ny * hw);
    ctx.closePath();
    if (!pal.line) { ctx.fillStyle = pal.steel; ctx.fill(); }
    ctx.strokeStyle = pal.steelEdge; ctx.lineWidth = 1.3 / view.s; ctx.stroke();
    /* the anvil it works against */
    var an = rotPt(d, d.base + d.lift + d.stem + hh * 2.6, 0);
    ctx.beginPath();
    ctx.moveTo(an.x + nx * hw * 1.5, an.y + ny * hw * 1.5);
    ctx.lineTo(an.x + ax * hh * 1.2 + nx * hw * 1.1, an.y + ay * hh * 1.2 + ny * hw * 1.1);
    ctx.lineTo(an.x + ax * hh * 1.2 - nx * hw * 1.1, an.y + ay * hh * 1.2 - ny * hw * 1.1);
    ctx.lineTo(an.x - nx * hw * 1.5, an.y - ny * hw * 1.5);
    ctx.closePath();
    if (!pal.line) { ctx.fillStyle = pal.plate; ctx.fill(); }
    ctx.strokeStyle = pal.plateEdge; ctx.lineWidth = 1.4 / view.s; ctx.stroke();
  }

  function drawGeneva(d, a) {
    var ctr = rotPt(d, d.c, 0);
    var b = genevaAngle(d, a - d.u.a);
    /* driven wheel: turns the opposite way to the driver */
    ctx.save();
    ctx.translate(ctr.x, ctr.y);
    ctx.rotate(d.u.a + Math.PI - b);
    disc(0, 0, d.wr, pal.line ? null : metal(0, 0, d.wr, pal.gear), pal.gearEdge, 1.5);
    for (var k = 0; k < d.n; k++) {
      ctx.save();
      ctx.rotate(TAU * k / d.n);
      /* slot */
      ctx.beginPath();
      ctx.moveTo(d.c - d.a, -d.pin * 1.25);
      ctx.lineTo(d.wr + 2, -d.pin * 1.25);
      ctx.lineTo(d.wr + 2, d.pin * 1.25);
      ctx.lineTo(d.c - d.a, d.pin * 1.25);
      ctx.closePath();
      if (!pal.line) { ctx.fillStyle = pal.bg; ctx.fill(); }
      ctx.strokeStyle = pal.plateEdge; ctx.lineWidth = 1.1 / view.s; ctx.stroke();
      /* locking scallop between slots */
      ctx.beginPath();
      ctx.arc(Math.cos(Math.PI / d.n) * d.wr * 1.0, Math.sin(Math.PI / d.n) * d.wr * 1.0,
        d.a * 0.36, 0, TAU);
      if (!pal.line) { ctx.fillStyle = pal.bg; ctx.fill(); }
      ctx.strokeStyle = pal.plateEdge; ctx.lineWidth = 1 / view.s; ctx.stroke();
      ctx.restore();
    }
    disc(0, 0, Math.max(6, d.wr * 0.15), pal.line ? null : pal.steel, pal.steelEdge, 1.2);
    ctx.restore();
    /* driver disc with the pin */
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(a);
    disc(0, 0, d.a * 0.55, pal.line ? null : metal(0, 0, d.a, pal.pinion), pal.gearEdge, 1.3);
    ctx.restore();
    var px = d.x + Math.cos(a) * d.a, py = d.y + Math.sin(a) * d.a;
    bar(d.x, d.y, px, py, Math.max(4, d.a * 0.2), pal.line ? null : pal.rod, pal.steelEdge);
    disc(px, py, d.pin, pal.line ? null : pal.trace, pal.steelEdge, 1.2);
  }

  function drawEscape(d, a) {
    var Ne = d.Ne;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(a);
    ctx.beginPath();
    for (var k = 0; k < Ne; k++) {
      var a0 = TAU * k / Ne, a1 = TAU * (k + 0.62) / Ne, a2 = TAU * (k + 1) / Ne;
      var ir = d.er * 0.74;
      if (k === 0) ctx.moveTo(Math.cos(a0) * ir, Math.sin(a0) * ir);
      else ctx.lineTo(Math.cos(a0) * ir, Math.sin(a0) * ir);
      ctx.lineTo(Math.cos(a1) * d.er, Math.sin(a1) * d.er);
      ctx.lineTo(Math.cos(a2) * ir, Math.sin(a2) * ir);
    }
    ctx.closePath();
    if (!pal.line) { ctx.fillStyle = metal(0, 0, d.er, pal.pinion); ctx.fill(); }
    ctx.strokeStyle = pal.gearEdge; ctx.lineWidth = 1.2 / view.s; ctx.stroke();
    disc(0, 0, d.er * 0.16, pal.line ? null : pal.steel, pal.steelEdge, 1.1);
    ctx.restore();
    /* anchor + pendulum, driven at one swing per tooth */
    var ph = a * Ne / 2;
    var sw = Math.sin(ph) * d.amp;
    var piv = rotPt(d, d.anchor, 0);
    ctx.save();
    ctx.translate(piv.x, piv.y);
    ctx.rotate(d.u.a + sw);
    /* in this frame the escape wheel sits at local (-anchor, 0) */
    var span = d.er * 0.72;
    var reach = -(d.anchor - d.er * 1.02);
    bar(0, 0, reach, 0, Math.max(4, d.er * 0.13), pal.line ? null : pal.rod, pal.steelEdge);
    bar(reach, -span, reach, span, Math.max(4, d.er * 0.13), pal.line ? null : pal.rod, pal.steelEdge);
    /* the two pallets, dipping towards the wheel */
    bar(reach, -span, reach - d.er * 0.2, -span * 0.72, Math.max(4, d.er * 0.16),
      pal.line ? null : pal.steel, pal.steelEdge);
    bar(reach, span, reach - d.er * 0.2, span * 0.72, Math.max(4, d.er * 0.16),
      pal.line ? null : pal.steel, pal.steelEdge);
    ctx.restore();
    /* the pendulum swings about the same arbor, clear of the train */
    var bobA = d.u.a + sw;
    var bx = piv.x + Math.cos(bobA) * d.pend, by = piv.y + Math.sin(bobA) * d.pend;
    if (showTrace) {
      ctx.beginPath();
      ctx.arc(piv.x, piv.y, d.pend, d.u.a - d.amp, d.u.a + d.amp);
      ctx.strokeStyle = pal.trace; ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.2 / view.s; ctx.stroke(); ctx.globalAlpha = 1;
    }
    bar(piv.x, piv.y, bx, by, Math.max(3, d.er * 0.07), pal.line ? null : pal.rod, pal.steelEdge);
    disc(bx, by, d.bob, pal.line ? null : metal(bx, by, d.bob, pal.gear), pal.gearEdge, 1.4);
    disc(bx, by, d.bob * 0.45, null, pal.gearEdge, 1);
    pivot(piv.x, piv.y, Math.max(4, d.er * 0.14));
  }

  function drawGovernor(d, a) {
    var base = rotPt(d, d.dist, 0);
    var up = { x: -d.u.y, y: d.u.x };            /* spindle direction, across u */
    var top = { x: base.x + up.x * d.spin, y: base.y + up.y * d.spin };
    /* bevel pair */
    var bg1 = rotPt(d, d.dist * 0.55, 0);
    disc(bg1.x, bg1.y, d.R * 0.3, pal.line ? null : pal.pinion[1], pal.gearEdge, 1.2);
    bar(d.x, d.y, base.x, base.y, Math.max(4, d.R * 0.1), pal.line ? null : pal.rod, pal.steelEdge);
    bar(base.x, base.y, top.x, top.y, Math.max(5, d.R * 0.12), pal.line ? null : pal.steel, pal.steelEdge);
    var t = clamp((Math.abs(rpm * M.shafts[d.shaft].w) - 4) / 34, 0, 1);
    var phi = 0.3 + t * 0.95;                    /* how far the balls have flown out */
    var spin = Math.cos(a);                      /* the arms seen edge-on as they go round */
    var down = Math.cos(phi) * d.arm;
    var sleeve = { x: top.x - up.x * down * 0.55, y: top.y - up.y * down * 0.55 };
    for (var s = -1; s <= 1; s += 2) {
      var outv = Math.sin(phi) * d.arm * s * spin;
      var bxp = top.x + d.u.x * outv - up.x * down;
      var byp = top.y + d.u.y * outv - up.y * down;
      bar(top.x, top.y, bxp, byp, Math.max(3, d.R * 0.07), pal.line ? null : pal.rod, pal.steelEdge);
      bar(bxp, byp, sleeve.x, sleeve.y, Math.max(2.4, d.R * 0.05),
        pal.line ? null : pal.rod, pal.steelEdge);
      disc(bxp, byp, d.ball, pal.line ? null : metal(bxp, byp, d.ball, pal.gear), pal.gearEdge, 1.3);
    }
    disc(sleeve.x, sleeve.y, Math.max(4, d.R * 0.13), pal.line ? null : pal.steel, pal.steelEdge, 1.2);
    disc(top.x, top.y, Math.max(4, d.R * 0.12), pal.line ? null : pal.steel, pal.steelEdge, 1.2);
  }

  /* ---------------- labels ---------------- */
  function drawLabels() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < M.wheels.length; i++) {
      var w = M.wheels[i];
      var p = toScreen(w.x, w.y);
      var txt = w.kind === 'gear' ? (w.N + 'T') : ('⌀' + Math.round(w.N * 2));
      var off = w.compound ? 15 : 0;
      ctx.fillStyle = 'rgba(7,9,13,.72)';
      var tw = ctx.measureText(txt).width + 10;
      ctx.fillRect(p.x - tw / 2, p.y - 8 + off, tw, 16);
      ctx.fillStyle = pal.ink;
      ctx.fillText(txt, p.x, p.y + off);
    }
    for (var j = 0; j < M.shafts.length; j++) {
      var s = M.shafts[j], q = toScreen(s.x, s.y);
      ctx.fillStyle = pal.trace;
      ctx.fillText(s.name + '  ' + (Math.abs(rpm * s.w)).toFixed(1) + ' rpm', q.x, q.y - 22);
    }
  }

  /* ---------------- render ---------------- */
  function render() {
    if (!ctx || !M) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (pal.line) {
      ctx.strokeStyle = 'rgba(190,225,255,.09)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx < W; gx += 26) {
        ctx.beginPath(); ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, H); ctx.stroke();
      }
      for (var gy = 0; gy < H; gy += 26) {
        ctx.beginPath(); ctx.moveTo(0, gy + .5); ctx.lineTo(W, gy + .5); ctx.stroke();
      }
    }
    ctx.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * view.ox, DPR * view.oy);
    ctx.lineJoin = 'round';
    drawFrame();
    drawBelts();
    drawFlywheel();
    for (var i = 0; i < M.wheels.length; i++) drawWheel(M.wheels[i]);
    for (var j = 0; j < M.devices.length; j++) drawDevice(M.devices[j]);
    if (showLabels) drawLabels();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ---------------- loop ---------------- */
  function frame(now) {
    raf = null;
    if (!lastT) lastT = now;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (running && !drag) th += TAU * (rpm / 60) * dt;
    render();
    if (running || drag) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); }
  }

  /* ---------------- readouts ---------------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function ratioText(v) {
    if (v >= 1) return v.toFixed(2) + ' : 1 down';
    return (1 / v).toFixed(2) + ' : 1 up';
  }

  function outRates() {
    var out = [];
    for (var i = 0; i < M.devices.length; i++) {
      var d = M.devices[i];
      var s = Math.abs(rpm * M.shafts[d.shaft].w);
      var line;
      if (d.kind === 'piston') line = s.toFixed(1) + ' strokes a minute';
      else if (d.kind === 'fourbar') line = s.toFixed(1) + ' sweeps a minute';
      else if (d.kind === 'hammer') line = s.toFixed(1) + ' blows a minute';
      else if (d.kind === 'geneva') line = (s * d.n).toFixed(1) + ' stops a minute';
      else if (d.kind === 'escapement') line = (s * d.Ne * 2).toFixed(0) + ' ticks a minute';
      else line = s.toFixed(1) + ' rpm at the spindle';
      out.push({ d: d, s: s, line: line });
    }
    return out;
  }

  function paint() {
    var p = $('plaque');
    if (p) {
      p.innerHTML =
        '<div class="seed-num">' + esc(M.title) + '</div>' +
        '<p class="card-lead">Patent No. ' + M.patent + ', ' + M.year + '. Built by ' +
        esc(M.maker) + ' of ' + esc(M.town) + ' for ' + esc(M.purpose) + '. Driven by a ' +
        esc(M.mover.name) + ' &mdash; ' + esc(M.mover.note) + '.</p>' +
        '<dl class="seed-grid">' +
        '<div><dt>Shafts</dt><dd>' + M.shafts.length + '</dd></div>' +
        '<div><dt>Wheels</dt><dd>' + M.wheels.length + '</dd></div>' +
        '<div><dt>Train</dt><dd>' + ratioText(M.reduction) + '</dd></div>' +
        '<div><dt>Module</dt><dd>' + M.m + ' mm</dd></div>' +
        '</dl>' +
        '<p class="card-note"><b>Since:</b> ' + esc(M.fate) + '</p>';
    }

    var rows = [];
    for (var i = 0; i < M.stages.length; i++) {
      var st = M.stages[i];
      var a = M.shafts[st.from.shaft].name, b = M.shafts[st.to.shaft].name;
      var desc;
      if (st.type === 'gear') {
        desc = '<b>' + st.from.N + '</b> teeth driving <b>' + st.to.N + '</b>, ' +
          'centres ' + Math.round(st.from.r + st.to.r) + ' mm apart, turning the other way';
      } else {
        desc = 'a <b>' + Math.round(st.from.N * 2) + ' mm</b> pulley driving a <b>' +
          Math.round(st.to.N * 2) + ' mm</b> one on ' +
          (st.crossed ? 'a crossed belt, reversing it' : 'an open belt, same way round');
      }
      rows.push('<tr><th>Stage ' + (i + 1) + ' &middot; ' + a + '→' + b + '</th><td>' +
        desc + '. ' + ratioText(st.ratio) + '.</td></tr>');
    }
    var rr = outRates();
    for (var j = 0; j < rr.length; j++) {
      rows.push('<tr><th>Output ' + (j + 1) + ' &middot; shaft ' + M.shafts[rr[j].d.shaft].name +
        '</th><td>A <b>' + esc(rr[j].d.label) + '</b>: ' + esc(rr[j].d.does) + '. ' +
        rr[j].line + '.</td></tr>');
    }
    rows.push('<tr><th>Whole train</th><td>The driving wheel turns <b>' + rpm.toFixed(0) +
      '</b> times a minute; the last shaft turns <b>' +
      Math.abs(rpm * M.shafts[M.shafts.length - 1].w).toFixed(2) +
      '</b>. ' + ratioText(M.reduction) + ' overall.</td></tr>');
    var sp = $('spec');
    if (sp) sp.innerHTML = '<table>' + rows.join('') + '</table>';

    if ($('seedOut')) $('seedOut').textContent = String(M.seed).padStart(10, '0');
    if ($('ratioOut')) $('ratioOut').textContent = ratioText(M.reduction);
    if ($('partsOut')) $('partsOut').textContent = M.wheels.length + ' wheels, ' +
      M.devices.length + ' output' + (M.devices.length === 1 ? '' : 's');
    if ($('speedOut')) $('speedOut').textContent = rpm.toFixed(0) + ' rpm';
    paintPart();
  }

  function paintPart() {
    var el = $('partCard');
    if (!el) return;
    if (!sel) {
      el.innerHTML = '<p class="card-note">Click any wheel or mechanism for its numbers.</p>';
      return;
    }
    if (sel.type === 'wheel') {
      var w = sel.ref, sh = M.shafts[w.shaft];
      var spd = Math.abs(rpm * sh.w);
      if (w.kind === 'gear') {
        el.innerHTML = '<p class="card-lead"><b>' + w.N + '-tooth ' +
          (w.r < 45 ? 'pinion' : 'wheel') + '</b> on shaft ' + sh.name +
          (w.compound ? ', compounded onto the wheel beside it' : '') + '.</p>' +
          '<dl class="seed-grid">' +
          '<div><dt>Teeth</dt><dd>' + w.N + '</dd></div>' +
          '<div><dt>Pitch dia.</dt><dd>' + (w.g.rp * 2).toFixed(0) + ' mm</dd></div>' +
          '<div><dt>Speed</dt><dd>' + spd.toFixed(2) + ' rpm</dd></div>' +
          '<div><dt>Direction</dt><dd>' + (sh.w > 0 ? 'with the driver' : 'against it') + '</dd></div>' +
          '</dl>';
      } else {
        el.innerHTML = '<p class="card-lead"><b>Belt pulley</b> on shaft ' + sh.name + '.</p>' +
          '<dl class="seed-grid">' +
          '<div><dt>Diameter</dt><dd>' + (w.N * 2).toFixed(0) + ' mm</dd></div>' +
          '<div><dt>Rim speed</dt><dd>' + (Math.abs(rpm * sh.w) * TAU * w.N / 1000).toFixed(1) + ' m/min</dd></div>' +
          '<div><dt>Speed</dt><dd>' + spd.toFixed(2) + ' rpm</dd></div>' +
          '<div><dt>Direction</dt><dd>' + (sh.w > 0 ? 'with the driver' : 'against it') + '</dd></div>' +
          '</dl>';
      }
    } else {
      var d = sel.ref, r2 = outRates();
      var line = '';
      for (var i = 0; i < r2.length; i++) if (r2[i].d === d) line = r2[i].line;
      el.innerHTML = '<p class="card-lead"><b>' + esc(d.label) + '</b> on shaft ' +
        M.shafts[d.shaft].name + '. It ' + esc(d.does) + '.</p>' +
        '<dl class="seed-grid">' +
        '<div><dt>Rate</dt><dd>' + line + '</dd></div>' +
        '<div><dt>Driven at</dt><dd>' + Math.abs(rpm * M.shafts[d.shaft].w).toFixed(2) + ' rpm</dd></div>' +
        '</dl>';
    }
  }

  /* ---------------- picking ---------------- */
  function pickAt(sx, sy) {
    var p = toWorld(sx, sy);
    var best = null, bd = 1e9;
    for (var i = 0; i < M.devices.length; i++) {
      var d = M.devices[i];
      var dd = Math.hypot(p.x - d.x, p.y - d.y);
      if (dd < d.reach && dd > d.R * 0.6 && dd < bd) { bd = dd; best = { type: 'device', ref: d }; }
    }
    for (var j = 0; j < M.wheels.length; j++) {
      var w = M.wheels[j];
      var d2 = Math.hypot(p.x - w.x, p.y - w.y);
      if (d2 < w.ro && d2 < bd) { bd = d2; best = { type: 'wheel', ref: w }; }
    }
    return best;
  }

  /* ---------------- wiring ---------------- */
  function build(seed) {
    M = design(seed);
    rpm = M.rpm;
    var sl = $('speed');
    if (sl) sl.value = String(rpm);
    sel = null;
    fit();
    paint();
    render();
  }

  function resize() {
    if (!canvas) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || 960;
    H = Math.round(W * 620 / 960);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.height = H + 'px';
    if (M) { fit(); render(); }
  }

  function chips(host, list, current, cb) {
    var el = $(host);
    if (!el) return;
    el.innerHTML = '';
    list.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (item.key === current ? ' on' : '');
      b.textContent = item.name;
      b.addEventListener('click', function () {
        var kids = el.querySelectorAll('.chip');
        for (var i = 0; i < kids.length; i++) kids[i].classList.remove('on');
        b.classList.add('on');
        cb(item);
      });
      el.appendChild(b);
    });
  }

  function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }

  function init() {
    if (!canvas || !ctx) return;
    resize();
    build(seedForToday());

    chips('finishes', FINISHES, FINISHES[0].key, function (f) { pal = f; render(); });

    var sl = $('speed');
    if (sl) sl.addEventListener('input', function () {
      rpm = parseFloat(sl.value);
      if ($('speedOut')) $('speedOut').textContent = rpm.toFixed(0) + ' rpm';
      paint();
      render();
    });

    wire('btnRun', function () {
      running = !running;
      this.textContent = running ? 'Stop it' : 'Set it going';
      this.classList.toggle('on', running);
      if (running) kick();
    });
    wire('btnTrace', function () {
      showTrace = !showTrace;
      this.textContent = showTrace ? 'Hide the paths' : 'Show the paths';
      this.classList.toggle('on', showTrace);
      render();
    });
    wire('btnLabels', function () {
      showLabels = !showLabels;
      this.textContent = showLabels ? 'Hide the numbers' : 'Show the numbers';
      this.classList.toggle('on', showLabels);
      render();
    });
    wire('btnNew', function () { build((Math.random() * 4294967295) >>> 0); kick(); });
    wire('btnToday', function () { build(seedForToday()); kick(); });

    canvas.addEventListener('pointerdown', function (e) {
      var rct = canvas.getBoundingClientRect();
      var x = e.clientX - rct.left, y = e.clientY - rct.top;
      var w0 = toWorld(x, y);
      drag = {
        moved: 0,
        a0: Math.atan2(w0.y - M.shafts[0].y, w0.x - M.shafts[0].x),
        th0: th, x: x, y: y
      };
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      kick();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var rct = canvas.getBoundingClientRect();
      var x = e.clientX - rct.left, y = e.clientY - rct.top;
      drag.moved += Math.abs(x - drag.x) + Math.abs(y - drag.y);
      drag.x = x; drag.y = y;
      var w0 = toWorld(x, y);
      var a = Math.atan2(w0.y - M.shafts[0].y, w0.x - M.shafts[0].x);
      var da = a - drag.a0;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      th = drag.th0 + da;
      drag.th0 = th; drag.a0 = a;
      render();
    });
    function endDrag() {
      if (!drag) return;
      var moved = drag.moved;
      var x = drag.x, y = drag.y;
      drag = null;
      if (moved < 5) {
        sel = pickAt(x, y);
        paintPart();
        render();
      }
      if (running) kick();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName || '')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        var b = $('btnRun');
        if (b) b.click();
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
      else if (running) kick();
    });

    if (reduce) {
      running = false;
      var rb = $('btnRun');
      if (rb) { rb.textContent = 'Set it going'; rb.classList.remove('on'); }
      render();
    } else {
      kick();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
