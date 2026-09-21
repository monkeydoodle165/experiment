/* The Lens — optics engine
   drift.quibo.games — self-contained, no dependencies, no build step.

   Everything in here is arithmetic on two things the site did not invent:
   a catalogue of real optical glasses, and Snell's law. */
(function (root) {
'use strict';

/* ---------------- small helpers ---------------- */

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
function hash32(s) {
  var h = s ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
function seedForDate(d) {
  return hash32(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
function lerp(a, b, t) { return a + (b - a) * t; }

/* ---------------- the glass catalogue ----------------
   nd  — refractive index at the helium d line, 587.6 nm
   vd  — Abbe number, (nd-1)/(nF-nC), how little the glass splits colour
   These are catalogue figures. Everything else about a glass on this page
   is worked out from them. */

var GLASS = [
  { n: 'Fused silica', nd: 1.4585, vd: 67.8, k: 'crown', note: 'pure silica, hard to melt, hard to scratch' },
  { n: 'N-BK7',        nd: 1.5168, vd: 64.2, k: 'crown', note: 'borosilicate crown, the workhorse of the trade' },
  { n: 'N-K5',         nd: 1.5225, vd: 59.5, k: 'crown', note: 'ordinary crown, cheap and obliging' },
  { n: 'N-BAK4',       nd: 1.5688, vd: 56.0, k: 'crown', note: 'barium crown, a little denser' },
  { n: 'N-SK16',       nd: 1.6204, vd: 60.3, k: 'crown', note: 'dense barium crown, high index for its dispersion' },
  { n: 'N-LAK22',      nd: 1.6511, vd: 55.9, k: 'crown', note: 'lanthanum crown, expensive and very useful' },
  { n: 'N-SSK8',       nd: 1.6180, vd: 49.8, k: 'crown', note: 'dense crown on the edge of being a flint' },
  { n: 'N-BAF10',      nd: 1.6700, vd: 47.1, k: 'flint', note: 'barium light flint, a halfway house' },
  { n: 'F2',           nd: 1.6200, vd: 36.4, k: 'flint', note: 'ordinary flint, the classic achromat partner' },
  { n: 'N-SF2',        nd: 1.6477, vd: 33.8, k: 'flint', note: 'dense flint' },
  { n: 'N-SF5',        nd: 1.6727, vd: 32.2, k: 'flint', note: 'dense flint, a touch stronger' },
  { n: 'N-SF8',        nd: 1.6889, vd: 31.2, k: 'flint', note: 'dense flint' },
  { n: 'N-SF10',       nd: 1.7283, vd: 28.5, k: 'flint', note: 'very dense flint, splits colour hard' },
  { n: 'N-SF11',       nd: 1.7847, vd: 25.7, k: 'flint', note: 'very dense flint, soft and heavy' },
  { n: 'N-SF57',       nd: 1.8467, vd: 23.8, k: 'flint', note: 'extra dense flint, almost a prism on its own' },
  { n: 'N-LASF9',      nd: 1.8503, vd: 32.2, k: 'flint', note: 'lanthanum dense flint, high index and costly' }
];

/* Two-term Cauchy, n(λ) = A + B/λ².  B is fixed by the Abbe number, which is
   the definition of nF - nC, and A by the d line.  So the fit passes exactly
   through all three catalogue wavelengths. */
var L_C = 0.6563, L_D = 0.5876, L_F = 0.4861;
(function () {
  var den = 1 / (L_F * L_F) - 1 / (L_C * L_C);
  for (var i = 0; i < GLASS.length; i++) {
    var g = GLASS[i];
    g.B = ((g.nd - 1) / g.vd) / den;
    g.A = g.nd - g.B / (L_D * L_D);
    g.i = i;
  }
})();

function glassByName(name) {
  for (var i = 0; i < GLASS.length; i++) if (GLASS[i].n === name) return GLASS[i];
  return null;
}
function nOf(g, lamNm) {
  if (!g) return 1;
  var l = lamNm / 1000;
  return g.A + g.B / (l * l);
}
function crowns() { return GLASS.filter(function (g) { return g.k === 'crown'; }); }
function flints() { return GLASS.filter(function (g) { return g.k === 'flint'; }); }

/* ---------------- surfaces ---------------- */
/* A surface is {c: curvature in 1/mm, t: distance to the next surface in mm,
   gl: the glass AFTER this surface, or null for air}.  Light runs +z. */

function surf(c, t, gl) { return { c: c, t: t, gl: gl }; }
function cloneSurf(s) {
  var o = [];
  for (var i = 0; i < s.length; i++) o.push({ c: s[i].c, t: s[i].t, gl: s[i].gl });
  return o;
}
function vertices(s) {
  var z = 0, out = [];
  for (var i = 0; i < s.length; i++) { out.push(z); z += s[i].t; }
  return out;
}
function sag(c, y) {
  if (!c) return 0;
  var k = c * c * y * y;
  if (k >= 0.9999) return NaN;
  return c * y * y / (1 + Math.sqrt(1 - k));
}

/* ---------------- paraxial ---------------- */

function paraxial(s, lam) {
  var y = 1, nu = 0, n = 1, i, np;
  for (i = 0; i < s.length; i++) {
    np = s[i].gl ? nOf(s[i].gl, lam) : 1;
    nu = nu - y * (np - n) * s[i].c;
    n = np;
    if (i < s.length - 1) y = y + s[i].t * nu / n;
  }
  if (!(nu < -1e-12)) return null;      // no useful positive power
  return { f: 1 / (-nu), bfl: -y / nu, yLast: y };
}

function scaleTo(s, f) {
  var p = paraxial(s, 587.6);
  if (!p || !(p.f > 0) || !isFinite(p.f)) return false;
  var k = f / p.f;
  if (!isFinite(k) || k <= 0 || k > 5000) return false;
  for (var i = 0; i < s.length; i++) { s[i].c /= k; s[i].t *= k; }
  return true;
}

/* ---------------- the built system ---------------- */

function buildSys(s, aperture, fieldDeg) {
  var zs = vertices(s), sd = [], i;
  var tf = Math.tan(fieldDeg * Math.PI / 180);
  for (i = 0; i < s.length; i++) sd.push(aperture * 0.5 * 1.45 + zs[i] * tf * 1.4 + 0.6);
  return {
    surf: s, zs: zs, sd: sd, aperture: aperture, field: fieldDeg,
    zStart: -Math.max(14, aperture * 0.95),
    zLast: zs[zs.length - 1],
    par: paraxial(s, 587.6)
  };
}

/* ---------------- exact ray trace ----------------
   Spherical surfaces, skew rays, vector Snell.  Returns null if the ray
   misses the glass, runs backwards, or turns round in total internal
   reflection — all three happen the moment you push a design too far. */

function traceRay(b, px, py, pz, dx, dy, dz, lam, path) {
  var s = b.surf, zs = b.zs, sd = b.sd, n = 1, i;
  for (i = 0; i < s.length; i++) {
    var c = s[i].c, zv = zs[i], t, R = 0, Cz = 0;
    if (Math.abs(c) < 1e-13) {
      if (Math.abs(dz) < 1e-9) return null;
      t = (zv - pz) / dz;
    } else {
      R = 1 / c; Cz = zv + R;
      var qz = pz - Cz;
      var bb = px * dx + py * dy + qz * dz;
      var cc = px * px + py * py + qz * qz - R * R;
      var disc = bb * bb - cc;
      if (disc < 0) return null;
      var sq = Math.sqrt(disc);
      t = -bb - (R > 0 ? sq : -sq);
    }
    if (!(t > 1e-9)) return null;
    px += dx * t; py += dy * t; pz += dz * t;
    if (px * px + py * py > sd[i] * sd[i]) return null;
    if (path) path.push(pz, py);

    var nx, ny, nz;
    if (Math.abs(c) < 1e-13) { nx = 0; ny = 0; nz = -1; }
    else { nx = px / R; ny = py / R; nz = (pz - Cz) / R; }

    var np = s[i].gl ? nOf(s[i].gl, lam) : 1;
    var mu = n / np;
    var cosI = -(dx * nx + dy * ny + dz * nz);
    var k = 1 - mu * mu * (1 - cosI * cosI);
    if (k < 0) return null;                       // total internal reflection
    var g = mu * cosI - Math.sqrt(k);
    dx = mu * dx + g * nx; dy = mu * dy + g * ny; dz = mu * dz + g * nz;
    n = np;
  }
  return { x: px, y: py, z: pz, dx: dx, dy: dy, dz: dz };
}

/* ---------------- pupil sampling ---------------- */

function pupil(rings, az) {
  var out = [[0, 0]], i, j;
  for (i = 1; i <= rings; i++) {
    var rr = i / rings;
    for (j = 0; j < az; j++) {
      var a = 2 * Math.PI * j / az + (i % 2 ? Math.PI / az : 0);
      out.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
  }
  return out;
}

/* ---------------- spot ----------------
   Every ray of every colour for one field angle, landed on the image plane,
   measured about their common centroid.  Lateral colour therefore counts as
   blur, which is exactly how it looks. */

function spotAt(b, thDeg, lams, pup, zimg) {
  var th = thDeg * Math.PI / 180, dy = Math.sin(th), dz = Math.cos(th);
  var a = b.aperture / 2, z0 = b.zStart;
  var pts = [], fails = 0, li, pi;
  for (li = 0; li < lams.length; li++) {
    for (pi = 0; pi < pup.length; pi++) {
      var ex = pup[pi][0] * a, ey = pup[pi][1] * a;
      var r = traceRay(b, ex, ey + dy * z0, z0, 0, dy, dz, lams[li], null);
      if (!r || r.dz <= 1e-6) { fails++; continue; }
      var t = (zimg - r.z) / r.dz;
      pts.push({ x: r.x + r.dx * t, y: r.y + r.dy * t, li: li });
    }
  }
  var nn = pts.length;
  if (!nn) return { pts: pts, cx: 0, cy: 0, rms: 1e6, fails: fails, n: 0 };
  var cx = 0, cy = 0, i;
  for (i = 0; i < nn; i++) { cx += pts[i].x; cy += pts[i].y; }
  cx /= nn; cy /= nn;
  var sum = 0;
  for (i = 0; i < nn; i++) {
    var ddx = pts[i].x - cx, ddy = pts[i].y - cy;
    sum += ddx * ddx + ddy * ddy;
  }
  return { pts: pts, cx: cx, cy: cy, rms: Math.sqrt(sum / nn), fails: fails, n: nn };
}

/* ---------------- edge thickness ----------------
   A lens whose rim comes to nothing cannot be made, whatever the rays say. */

function edges(b, cfg) {
  var s = b.surf, zs = b.zs, out = [], i;
  var tf = Math.tan(cfg.field * Math.PI / 180);
  for (i = 0; i < s.length - 1; i++) {
    if (!s[i].gl) continue;
    var h = cfg.aperture * 0.5 + zs[i] * tf + 0.3;
    var s1 = sag(s[i].c, h), s2 = sag(s[i + 1].c, h);
    if (isNaN(s1) || isNaN(s2)) { out.push({ i: i, et: -9 }); continue; }
    out.push({ i: i, et: s[i].t + s2 - s1, h: h });
  }
  return out;
}

/* ---------------- merit ---------------- */

var MERIT_LAMS = [656.3, 587.6, 486.1];
var MERIT_PUP = pupil(3, 8);
var FW = [0, 0.7, 1.0], FWT = [2.2, 1.4, 1.0];

function meritOf(s, cfg, defocus) {
  var b = buildSys(s, cfg.aperture, cfg.field), i;
  if (!b.par) return 1e9;
  var tf = Math.tan(cfg.field * Math.PI / 180);
  for (i = 0; i < s.length; i++) {
    var h = cfg.aperture * 0.5 + b.zs[i] * tf + 0.3;
    if (Math.abs(s[i].c) * h > 0.92) return 1e9;
  }
  var zimg = b.zLast + b.par.bfl + defocus;
  var tot = 0, pen = cfg.aperture * 0.18;
  for (i = 0; i < 3; i++) {
    var r = spotAt(b, cfg.field * FW[i], MERIT_LAMS, MERIT_PUP, zimg);
    if (r.n < 8) return 1e9;
    tot += FWT[i] * (r.rms * r.rms + r.fails * pen * pen);
  }
  var e = edges(b, cfg);
  for (i = 0; i < e.length; i++) {
    var want = Math.max(0.35, cfg.aperture * 0.02);
    if (e[i].et < want) { var d = want - e[i].et; tot += 0.05 * d * d; }
  }
  return tot;
}

/* ---------------- forms ----------------
   Each is a thin-lens power split, then a bending, then whatever the
   optimiser can make of it.  The focal length is not fixed here: the system
   is rescaled to the commissioned focal length before anything is measured,
   so a start that is merely the right shape is good enough. */

function elementRear(c1, phi, nd) { return c1 - phi / (nd - 1); }

function buildForm(form, f, gl) {
  var s = [], airIdx = [], g1, g2, g3, g4, k1, k2, k3, p1, p2, p3, c1, c2, c3, c4, c5, c6, V1, V2, dv;
  var phi = 1 / f;

  if (form === 'singlet') {
    g1 = gl[0];
    k1 = phi / (g1.nd - 1);
    c1 = -0.9 * k1; c2 = elementRear(c1, phi, g1.nd);
    s = [surf(c1, Math.max(1.6, f * 0.035), g1), surf(c2, 0, null)];

  } else if (form === 'cemented') {
    g1 = gl[0]; g2 = gl[1];
    V1 = g1.vd; V2 = g2.vd; dv = V1 - V2;
    p1 = phi * V1 / dv; p2 = -phi * V2 / dv;
    k1 = p1 / (g1.nd - 1); k2 = p2 / (g2.nd - 1);
    c1 = 0.52 * k1; c2 = elementRear(c1, p1, g1.nd); c3 = c2; c4 = elementRear(c3, p2, g2.nd);
    s = [surf(c1, Math.max(2, f * 0.016), g1),
         surf(c2, Math.max(1.4, f * 0.009), g2),
         surf(c4, 0, null)];

  } else if (form === 'airspaced') {
    g1 = gl[0]; g2 = gl[1];
    V1 = g1.vd; V2 = g2.vd; dv = V1 - V2;
    p1 = phi * V1 / dv; p2 = -phi * V2 / dv;
    k1 = p1 / (g1.nd - 1); k2 = p2 / (g2.nd - 1);
    c1 = 0.55 * k1; c2 = elementRear(c1, p1, g1.nd); c3 = c2 * 0.97; c4 = elementRear(c3, p2, g2.nd);
    s = [surf(c1, Math.max(2, f * 0.016), g1),
         surf(c2, Math.max(0.4, f * 0.004), null),
         surf(c3, Math.max(1.4, f * 0.009), g2),
         surf(c4, 0, null)];
    airIdx = [1];

  } else if (form === 'triplet') {
    g1 = gl[0]; g2 = gl[1]; g3 = gl[2];
    p1 = 1 / (0.34 * f); p2 = -1 / (0.175 * f); p3 = 1 / (0.30 * f);
    k1 = p1 / (g1.nd - 1); k2 = p2 / (g2.nd - 1); k3 = p3 / (g3.nd - 1);
    c1 = 0.80 * k1; c2 = elementRear(c1, p1, g1.nd);
    c3 = 0.50 * k2; c4 = elementRear(c3, p2, g2.nd);
    c5 = 0.35 * k3; c6 = elementRear(c5, p3, g3.nd);
    s = [surf(c1, f * 0.050, g1),
         surf(c2, f * 0.040, null),
         surf(c3, f * 0.015, g2),
         surf(c4, f * 0.040, null),
         surf(c5, f * 0.045, g3),
         surf(c6, 0, null)];
    airIdx = [1, 3];

  } else { /* petzval: two cemented doublets with a long air gap */
    g1 = gl[0]; g2 = gl[1]; g3 = gl[2]; g4 = gl[3];
    var pa = 0.65 * phi, pb = 0.60 * phi;
    var d = (pa + pb - phi) / (pa * pb);
    var a1 = pa * g1.vd / (g1.vd - g2.vd), a2 = -pa * g2.vd / (g1.vd - g2.vd);
    var b1 = pb * g4.vd / (g4.vd - g3.vd), b2 = -pb * g3.vd / (g4.vd - g3.vd);
    c1 = 0.55 * (a1 / (g1.nd - 1)); c2 = elementRear(c1, a1, g1.nd); c3 = elementRear(c2, a2, g2.nd);
    c4 = 0.30 * (b2 / (g3.nd - 1)); c5 = elementRear(c4, b2, g3.nd); c6 = elementRear(c5, b1, g4.nd);
    s = [surf(c1, Math.max(2, f * 0.030), g1),
         surf(c2, Math.max(1.4, f * 0.014), g2),
         surf(c3, Math.max(4, d), null),
         surf(c4, Math.max(1.4, f * 0.014), g3),
         surf(c5, Math.max(2, f * 0.030), g4),
         surf(c6, 0, null)];
    airIdx = [2];
  }
  return { surf: s, airIdx: airIdx };
}

/* ---------------- optimiser ----------------
   Coordinate descent with a shrinking step over every curvature, every
   airspace and the focal plane.  Slow and stupid next to damped least
   squares, and entirely honest about where it ends up. */

function getParams(st) {
  var v = [], i;
  for (i = 0; i < st.surf.length; i++) v.push(st.surf[i].c);
  for (i = 0; i < st.airIdx.length; i++) v.push(st.surf[st.airIdx[i]].t);
  v.push(st.defocus || 0);
  return v;
}
function applyParams(base, airIdx, v, f) {
  var s = cloneSurf(base), nc = s.length, i;
  for (i = 0; i < nc; i++) s[i].c = v[i];
  for (i = 0; i < airIdx.length; i++) s[airIdx[i]].t = Math.max(0.15, v[nc + i]);
  if (!scaleTo(s, f)) return null;
  return s;
}

function optimise(base, airIdx, cfg, opts) {
  opts = opts || {};
  var nc = base.length, nv = nc + airIdx.length + 1;
  var v = [], i, j;
  for (i = 0; i < nc; i++) v.push(base[i].c);
  for (i = 0; i < airIdx.length; i++) v.push(base[airIdx[i]].t);
  v.push(0);

  function ev(vv) {
    var s = applyParams(base, airIdx, vv, cfg.f);
    if (!s) return 1e9;
    return meritOf(s, cfg, vv[nv - 1]);
  }

  var step = [];
  for (i = 0; i < nc; i++) step.push(0.06 / cfg.f);
  for (i = 0; i < airIdx.length; i++) step.push(cfg.f * 0.02);
  step.push(cfg.f * 0.012);
  var step0 = step.slice();

  var best = ev(v), start = best, evals = 1;
  var maxEv = opts.maxEvals || 4200;
  var pass = 0;
  while (pass < 140 && evals < maxEv) {
    var moved = false;
    for (i = 0; i < nv; i++) {
      for (j = 0; j < 2; j++) {
        var t = v.slice();
        t[i] += j ? -step[i] : step[i];
        var m = ev(t); evals++;
        if (m < best - 1e-14) { best = m; v = t; moved = true; break; }
        if (evals >= maxEv) break;
      }
      if (evals >= maxEv) break;
    }
    if (!moved) {
      var done = true;
      for (i = 0; i < nv; i++) { step[i] *= 0.5; if (step[i] > step0[i] / 4096) done = false; }
      if (done) break;
    }
    pass++;
  }
  var s = applyParams(base, airIdx, v, cfg.f);
  return { surf: s, defocus: v[nv - 1], merit: best, start: start, evals: evals, passes: pass };
}

/* ---------------- exports ---------------- */

root.Optics = {
  rng: rng, hash32: hash32, seedForDate: seedForDate, clamp: clamp, pick: pick, lerp: lerp,
  GLASS: GLASS, glassByName: glassByName, nOf: nOf, crowns: crowns, flints: flints,
  surf: surf, cloneSurf: cloneSurf, vertices: vertices, sag: sag,
  paraxial: paraxial, scaleTo: scaleTo, buildSys: buildSys, traceRay: traceRay,
  pupil: pupil, spotAt: spotAt, edges: edges, meritOf: meritOf,
  buildForm: buildForm, optimise: optimise, applyParams: applyParams, getParams: getParams,
  LAMS: { C: 656.3, d: 587.6, F: 486.1, e: 546.1 }
};

})(window);
