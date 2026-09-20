/* drift — the kiln
   A pot thrown and a glaze mixed by today's date, then fired.
   Self-contained. No dependencies, no assets. */
(function () {
  'use strict';

  /* ================= helpers ================= */
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
  function hash32(n) {
    var h = (n ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function css(c) {
    return 'rgb(' + Math.round(clamp(c[0], 0, 255)) + ',' +
      Math.round(clamp(c[1], 0, 255)) + ',' + Math.round(clamp(c[2], 0, 255)) + ')';
  }
  function rr(r, a, b) { return a + r() * (b - a); }
  function pickOne(r, arr) { return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))]; }
  function step01(a, b, x) { return clamp((x - a) / (b - a || 1), 0, 1); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function $(id) { return document.getElementById(id); }
  function fx(v, n) { return (isFinite(v) ? v : 0).toFixed(n === undefined ? 2 : n); }

  /* ================= the three tables =================
     Everything else on this page is arithmetic on these. */

  /* molecular weights, g/mol */
  var MW = {
    SiO2: 60.08, Al2O3: 101.96, B2O3: 69.62, K2O: 94.20, Na2O: 61.98, Li2O: 29.88,
    CaO: 56.08, MgO: 40.31, ZnO: 81.38, BaO: 153.33, SrO: 103.62, P2O5: 141.94,
    Fe2O3: 159.69, TiO2: 79.87, ZrO2: 123.22, CoO: 74.93, CuO: 79.55, MnO: 70.94,
    Cr2O3: 151.99, SnO2: 150.71
  };

  /* linear expansion factors, 10^-6/degC per mole fraction */
  var EXP = {
    SiO2: 3.8, Al2O3: 6.3, B2O3: -0.7, K2O: 39.0, Na2O: 41.6, Li2O: 6.7,
    CaO: 16.3, MgO: 4.5, ZnO: 7.0, BaO: 14.0, SrO: 13.0, P2O5: 8.0,
    Fe2O3: 10.0, TiO2: 4.1, ZrO2: 2.1, CoO: 10.0, CuO: 10.0, MnO: 10.0,
    Cr2O3: 8.0, SnO2: 5.0
  };

  /* raw materials, oxide analyses in weight per cent (remainder is loss on ignition) */
  var MAT = {
    pot:  { name: 'Potash feldspar',       ox: { K2O: 12.0, Na2O: 2.8, Al2O3: 18.0, SiO2: 67.0 } },
    sod:  { name: 'Soda feldspar',         ox: { Na2O: 9.9, K2O: 2.5, CaO: 1.5, Al2O3: 19.4, SiO2: 66.5 } },
    neph: { name: 'Nepheline syenite',     ox: { Na2O: 9.8, K2O: 4.6, CaO: 0.7, Al2O3: 23.3, SiO2: 60.7 } },
    whit: { name: 'Whiting',               ox: { CaO: 56.0 } },
    dol:  { name: 'Dolomite',              ox: { CaO: 30.4, MgO: 21.7 } },
    talc: { name: 'Talc',                  ox: { MgO: 31.7, SiO2: 62.0 } },
    woll: { name: 'Wollastonite',          ox: { CaO: 46.3, SiO2: 51.0 } },
    kao:  { name: 'Kaolin',                ox: { Al2O3: 38.0, SiO2: 46.0 } },
    sil:  { name: 'Silica',                ox: { SiO2: 100 } },
    zinc: { name: 'Zinc oxide',            ox: { ZnO: 100 } },
    bar:  { name: 'Barium carbonate',      ox: { BaO: 77.7 } },
    str:  { name: 'Strontium carbonate',   ox: { SrO: 70.2 } },
    frit: { name: 'Boron frit',            ox: { B2O3: 23.1, CaO: 20.1, Na2O: 10.3, SiO2: 46.5 } },
    lith: { name: 'Lithium carbonate',     ox: { Li2O: 40.4 } },
    bone: { name: 'Bone ash',              ox: { CaO: 55.8, P2O5: 41.0 } }
  };

  /* colouring oxides and opacifiers, added over the hundred */
  var COL = {
    none: { name: 'nothing',              ox: {} },
    iron: { name: 'Red iron oxide',       ox: { Fe2O3: 100 } },
    cob:  { name: 'Cobalt carbonate',     ox: { CoO: 63 } },
    cop:  { name: 'Copper carbonate',     ox: { CuO: 71 } },
    rut:  { name: 'Rutile',               ox: { TiO2: 95, Fe2O3: 5 } },
    man:  { name: 'Manganese dioxide',    ox: { MnO: 77 } },
    chr:  { name: 'Chrome oxide',         ox: { Cr2O3: 100 } },
    tin:  { name: 'Tin oxide',            ox: { SnO2: 100 } },
    zir:  { name: 'Zirconium silicate',   ox: { ZrO2: 65, SiO2: 33 } }
  };

  var FLUX = ['K2O', 'Na2O', 'Li2O', 'CaO', 'MgO', 'ZnO', 'BaO', 'SrO'];
  var ORDER = ['K2O', 'Na2O', 'Li2O', 'CaO', 'MgO', 'SrO', 'BaO', 'ZnO'];

  var CONES = {
    '04': { label: 'cone 04', temp: 1060, need: 1.70, al: [0.08, 0.30], si: [1.1, 2.8] },
    '6':  { label: 'cone 6',  temp: 1222, need: 1.00, al: [0.18, 0.46], si: [1.9, 3.8] },
    '10': { label: 'cone 10', temp: 1285, need: 1.15, al: [0.28, 0.62], si: [2.8, 5.2] }
  };
  var CONEKEYS = ['04', '6', '10'];

  var BODIES = {
    porc:  { name: 'porcelain',              cte: 6.0, col: [236, 232, 224] },
    ston:  { name: 'buff stoneware',         cte: 5.8, col: [204, 184, 152] },
    iron:  { name: 'iron-bearing stoneware', cte: 6.3, col: [124, 84, 60] },
    earth: { name: 'red earthenware',        cte: 7.3, col: [176, 104, 72] }
  };
  var BODYKEYS = ['porc', 'ston', 'iron', 'earth'];

  /* ================= chemistry ================= */

  function normRecipe(rec) {
    var s = 0, k, o = {};
    for (k in rec) s += rec[k];
    if (s <= 0) return o;
    for (k in rec) o[k] = rec[k] * 100 / s;
    return o;
  }

  function oxidesOf(rec, table) {
    var m = {}, k, o;
    for (k in rec) {
      if (!table[k] || !rec[k]) continue;
      var ox = table[k].ox;
      for (o in ox) m[o] = (m[o] || 0) + rec[k] * ox[o] / 100 / MW[o];
    }
    return m;
  }

  function fluxPower(u, T) {
    var p = {
      Li2O: 1.70,
      Na2O: 1.35,
      K2O: 1.20,
      CaO: 0.15 + 1.05 * step01(1000, 1300, T),
      MgO: 0.05 + 0.80 * step01(1100, 1350, T),
      BaO: 0.15 + 0.70 * step01(1050, 1330, T),
      SrO: 0.25 + 0.75 * step01(1030, 1290, T),
      ZnO: 0.35 + 0.60 * step01(1020, 1280, T)
    };
    var s = 0;
    for (var i = 0; i < FLUX.length; i++) s += (u[FLUX[i]] || 0) * p[FLUX[i]];
    return s + (u.B2O3 || 0) * 1.40;
  }

  /* unity formula, expansion and melt index for a recipe */
  function chem(rec, cols, coneKey) {
    var cone = CONES[coneKey];
    var base = oxidesOf(normRecipe(rec), MAT);
    var extra = oxidesOf(cols, COL);
    var fs = 0, i, o;
    for (i = 0; i < FLUX.length; i++) fs += base[FLUX[i]] || 0;
    var u = {};
    if (fs > 0) for (o in base) u[o] = base[o] / fs;

    var all = {}, tot = 0;
    for (o in base) all[o] = (all[o] || 0) + base[o];
    for (o in extra) all[o] = (all[o] || 0) + extra[o];
    for (o in all) tot += all[o];
    var cte = 0;
    if (tot > 0) for (o in all) cte += (all[o] / tot) * (EXP[o] === undefined ? 5 : EXP[o]);

    var melt = fluxPower(u, cone.temp) / (0.28 + (u.Al2O3 || 0) * 0.90 + (u.SiO2 || 0) * 0.10);
    return {
      unity: u,
      cte: cte,
      ratio: (u.Al2O3 > 0) ? u.SiO2 / u.Al2O3 : 99,
      melt: melt / cone.need,
      ok: fs > 0 && isFinite(melt)
    };
  }

  function inLimits(c, coneKey) {
    var cone = CONES[coneKey], u = c.unity;
    if (!c.ok) return false;
    if (!(u.Al2O3 >= cone.al[0] && u.Al2O3 <= cone.al[1])) return false;
    if (!(u.SiO2 >= cone.si[0] && u.SiO2 <= cone.si[1])) return false;
    if (c.ratio < 3.2 || c.ratio > 12) return false;
    if (c.melt < 0.80 || c.melt > 1.35) return false;
    return true;
  }

  /* ================= drafting a recipe ================= */

  function draft(rand, coneKey) {
    var r = {};
    if (coneKey === '04') {
      r.frit = rr(rand, 42, 68);
      r[rand() < 0.5 ? 'neph' : 'sod'] = rr(rand, 2, 16);
      r.kao = rr(rand, 4, 15);
      r.sil = rr(rand, 4, 20);
      if (rand() < 0.5) r.whit = rr(rand, 0, 9);
      if (rand() < 0.3) r.zinc = rr(rand, 0, 7);
    } else if (coneKey === '6') {
      r[rand() < 0.5 ? 'pot' : 'neph'] = rr(rand, 18, 44);
      r.frit = rr(rand, 4, 26);
      r.whit = rr(rand, 3, 18);
      if (rand() < 0.6) r[rand() < 0.5 ? 'dol' : 'talc'] = rr(rand, 2, 13);
      if (rand() < 0.35) r[rand() < 0.5 ? 'str' : 'zinc'] = rr(rand, 2, 12);
      r.kao = rr(rand, 6, 22);
      r.sil = rr(rand, 6, 26);
    } else {
      r[rand() < 0.55 ? 'pot' : 'sod'] = rr(rand, 22, 50);
      r[rand() < 0.5 ? 'whit' : 'woll'] = rr(rand, 6, 24);
      if (rand() < 0.65) r[rand() < 0.5 ? 'dol' : 'talc'] = rr(rand, 2, 14);
      if (rand() < 0.28) r[rand() < 0.5 ? 'bar' : 'bone'] = rr(rand, 2, 11);
      if (rand() < 0.2) r.zinc = rr(rand, 2, 14);
      r.kao = rr(rand, 7, 27);
      r.sil = rr(rand, 8, 30);
    }
    for (var k in r) r[k] = Math.round(r[k] * 2) / 2;
    return r;
  }

  /* draft until the formula lands in the box; report how many that took */
  function dealGlaze(rand, coneKey) {
    var tries = 0, last = null;
    while (tries < 90) {
      tries++;
      var rec = draft(rand, coneKey);
      var c = chem(rec, {}, coneKey);
      last = rec;
      if (inLimits(c, coneKey)) return { recipe: rec, tries: tries, ok: true };
    }
    return { recipe: last, tries: tries, ok: false };
  }

  /* ================= what the fired thing looks like ================= */

  function surfaceOf(c, coneKey, cool) {
    var u = c.unity, T = CONES[coneKey].temp;
    if (c.melt < 0.55) return 'unmelted';
    if (c.melt < 0.80) return 'dry';
    if ((u.ZnO || 0) >= 0.16 && (u.Al2O3 || 0) <= 0.15 && (u.SiO2 || 0) >= 2.0 && cool === 'slow') return 'crystalline';
    if ((u.CaO || 0) > 0.56 && cool === 'slow' && T > 1200 && c.ratio < 9) return 'calcium matt';
    if (c.ratio < 5.5) return 'matt';
    if (c.ratio < 7.5) return (u.MgO || 0) > 0.18 ? 'magnesia satin' : 'satin';
    return 'gloss';
  }

  var FINISH = {
    gloss:            { shin: 46, spec: 0.92 },
    satin:            { shin: 15, spec: 0.34 },
    'magnesia satin': { shin: 11, spec: 0.26 },
    matt:             { shin: 5,  spec: 0.10 },
    'calcium matt':   { shin: 5,  spec: 0.09 },
    crystalline:      { shin: 28, spec: 0.62 },
    dry:              { shin: 3,  spec: 0.05 },
    unmelted:         { shin: 2,  spec: 0.02 }
  };

  function faultsOf(c, coneKey, bodyKey, cool, thick, rec) {
    var out = [], d = c.cte - BODIES[bodyKey].cte, n = normRecipe(rec);
    if (d > 1.8) out.push('crazed right across');
    else if (d > 0.95) out.push('crazed');
    if (d < -1.6) out.push('shivering off the edges');
    else if (d < -1.0) out.push('shivering at the rim');
    if (c.melt > 1.70) out.push('ran off the foot onto the shelf');
    else if (c.melt > 1.35) out.push('moved, and pooled at the foot');
    if (c.melt < 0.55) out.push('never melted');
    else if (c.melt < 0.80) out.push('dry and underfired');
    if ((n.kao || 0) > 26 && thick > 0.62) out.push('crawled away from the rim');
    if (c.melt > 1.45 && (c.unity.B2O3 || 0) > 0.42) out.push('blistered');
    return { list: out, fit: d };
  }

  /* colour is a lookup of what these oxides actually do, not a calculation */
  var POTENCY = { iron: 1.4, cob: 12, cop: 4, man: 1.2, rut: 0.8, chr: 8 };

  function colourOf(colKey, amt, opacKey, opacAmt, atm, u, surf) {
    var tint = [238, 236, 228], power = 0.30, name = 'clear';
    var t = clamp(amt / 6, 0, 1);
    if (colKey === 'iron') {
      if (atm === 'reduction') {
        tint = amt < 3 ? mix3([204, 226, 210], [124, 166, 140], clamp(amt / 3, 0, 1))
                       : mix3([96, 120, 102], [30, 20, 15], clamp((amt - 3) / 7, 0, 1));
        name = amt < 3 ? 'celadon' : 'tenmoku';
      } else {
        tint = amt < 3 ? mix3([228, 198, 140], [196, 134, 58], clamp(amt / 3, 0, 1))
                       : mix3([170, 110, 48], [52, 33, 21], clamp((amt - 3) / 7, 0, 1));
        name = amt < 3 ? 'amber' : 'treacle';
      }
      power = 0.5 + 1.1 * t;
    } else if (colKey === 'cob') {
      tint = mix3([150, 180, 226], [22, 34, 92], clamp(amt / 2, 0, 1));
      power = 1.0 + 1.6 * clamp(amt / 2, 0, 1); name = 'cobalt blue';
    } else if (colKey === 'cop') {
      if (atm === 'reduction') { tint = mix3([190, 108, 88], [122, 28, 24], clamp(amt / 3, 0, 1)); name = 'copper red'; }
      else if ((u.BaO || 0) > 0.22 || (u.Na2O || 0) > 0.34) { tint = mix3([124, 214, 208], [26, 138, 136], clamp(amt / 3, 0, 1)); name = 'turquoise'; }
      else { tint = mix3([152, 196, 138], [36, 104, 62], clamp(amt / 3, 0, 1)); name = 'copper green'; }
      power = 0.8 + 1.2 * clamp(amt / 3, 0, 1);
    } else if (colKey === 'man') {
      tint = mix3([176, 150, 160], [74, 42, 60], t); power = 0.6 + 1.1 * t; name = 'manganese purple';
    } else if (colKey === 'rut') {
      tint = mix3([226, 208, 170], [190, 158, 104], t); power = 0.9 + 1.0 * t; name = 'rutile';
    } else if (colKey === 'chr') {
      if (opacKey === 'tin' && opacAmt > 2) { tint = mix3([238, 190, 200], [204, 108, 138], t); name = 'chrome-tin pink'; }
      else { tint = mix3([120, 170, 120], [26, 84, 42], t); name = 'chrome green'; }
      power = 1.1 + 1.4 * t;
    }
    if (opacKey === 'tin') { tint = mix3(tint, [246, 246, 242], clamp(opacAmt / 14, 0, 0.55)); power += opacAmt * 0.18; }
    if (opacKey === 'zir') { tint = mix3(tint, [242, 243, 240], clamp(opacAmt / 20, 0, 0.5)); power += opacAmt * 0.09; }
    if (colKey === 'none' && opacKey !== 'none') name = 'opaque white';
    if (surf === 'matt' || surf === 'calcium matt' || surf === 'magnesia satin') power += 0.5;
    if (surf === 'unmelted' || surf === 'dry') { tint = mix3(tint, [224, 220, 210], 0.45); power += 0.7; }
    return { tint: tint, power: power, name: name };
  }

  /* ================= the pot ================= */

  var FORMS = {
    bowl:    { name: 'a bowl',            h: 0.56, pts: [[0, 0.22], [0.10, 0.19], [0.36, 0.45], [0.70, 0.68], [1, 0.80]] },
    teabowl: { name: 'a tea bowl',        h: 0.56, pts: [[0, 0.25], [0.08, 0.21], [0.32, 0.43], [0.72, 0.55], [1, 0.58]] },
    dish:    { name: 'a shallow dish',    h: 0.34, pts: [[0, 0.34], [0.10, 0.31], [0.46, 0.63], [0.80, 0.85], [1, 0.92]] },
    beaker:  { name: 'a beaker',          h: 0.80, pts: [[0, 0.34], [0.12, 0.33], [0.50, 0.36], [0.84, 0.38], [1, 0.40]] },
    jar:     { name: 'a storage jar',     h: 0.84, pts: [[0, 0.30], [0.14, 0.42], [0.44, 0.60], [0.72, 0.51], [0.90, 0.35], [1, 0.40]] },
    bottle:  { name: 'a bottle',          h: 1.00, pts: [[0, 0.29], [0.11, 0.43], [0.35, 0.57], [0.56, 0.40], [0.74, 0.19], [0.90, 0.16], [1, 0.22]] },
    vase:    { name: 'a vase',            h: 0.96, pts: [[0, 0.28], [0.13, 0.39], [0.39, 0.33], [0.66, 0.44], [0.88, 0.39], [1, 0.46]] },
    ewer:    { name: 'an ewer',           h: 0.96, pts: [[0, 0.30], [0.13, 0.45], [0.37, 0.58], [0.58, 0.44], [0.77, 0.25], [0.92, 0.23], [1, 0.34]] }
  };
  var FORMKEYS = ['bowl', 'teabowl', 'dish', 'beaker', 'jar', 'bottle', 'vase', 'ewer'];

  function dealForm(rand, key) {
    var f = FORMS[key], pts = [], i;
    for (i = 0; i < f.pts.length; i++) {
      pts.push([f.pts[i][0], clamp(f.pts[i][1] * rr(rand, 0.88, 1.12), 0.05, 0.98)]);
    }
    return { key: key, name: f.name, h: clamp(f.h * rr(rand, 0.92, 1.08), 0.2, 1.1), pts: pts };
  }

  function catmull(a, b, c, d, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }
  function sampleProfile(pts, n) {
    var out = [], m = pts.length, i, j;
    for (i = 0; i < n; i++) {
      var u = i / (n - 1) * (m - 1);
      var k = Math.min(Math.floor(u), m - 2), f = u - k;
      var p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(m - 1, k + 2)];
      out.push([catmull(p0[0], p1[0], p2[0], p3[0], f), Math.max(0.02, catmull(p0[1], p1[1], p2[1], p3[1], f))]);
    }
    out[0][0] = 0;
    for (j = 1; j < out.length; j++) if (out[j][0] <= out[j - 1][0]) out[j][0] = out[j - 1][0] + 1e-4;
    var mx = out[out.length - 1][0];
    for (j = 0; j < out.length; j++) out[j][0] /= mx;
    return out;
  }

  /* ================= naming and the plaque ================= */

  var NAMES = {
    celadon: ['Celadon', 'Kingfisher', 'River Glass', 'Green Ice'],
    tenmoku: ['Tenmoku', "Hare's Fur", 'Oil Spot', 'Black Persimmon'],
    amber: ['Honey', 'Amber', 'Straw Ash'],
    treacle: ['Treacle', 'Tortoiseshell', 'Burnt Umber'],
    'cobalt blue': ['Powder Blue', 'Smalt', 'Deep Sea', 'Gosu'],
    turquoise: ['Turquoise', 'Lagoon', 'Alkaline Blue'],
    'copper red': ['Oxblood', 'Peachbloom', 'Flambe'],
    'copper green': ['Verdigris', 'Apple', 'Copper Green'],
    'manganese purple': ['Mulberry', 'Ash Plum', "Bishop's Purple"],
    rutile: ['Oatmeal', 'Buttermilk', 'Tigerskin'],
    'chrome green': ['Laurel', 'Chrome Green', 'Bottle Green'],
    'chrome-tin pink': ['Rose Pink', "Maiden's Blush"],
    'opaque white': ['Bone White', 'Snow', 'Magnesia White'],
    clear: ['Clear', 'Water Glass', 'Dewdrop']
  };
  var HOUSES = ['Culvert', 'Marle', 'Stannary', 'Hollowbeck', 'Netherby', 'Saltmarsh', 'Cold Ash', 'Wray', 'Pennant', 'Blackdyke', 'Fell Foot', 'Gorsey'];
  var WORKS = ['Pottery', 'Works', 'Kiln', 'Yard', 'Manufactory'];
  var PURPOSE = [
    'for storing salt', 'for the Michaelmas fair', 'for a wedding',
    'against a standing order from a hotel', 'for the house’s own table',
    'to show what the new kiln could do', 'for the apothecary two doors down',
    'for nothing in particular, on a slow Tuesday'
  ];
  var FATE = [
    'One of nineteen. The rest went into the road as hardcore.',
    'Found in a ditch with the foot ring chipped.',
    'Never sold. Kept on the shelf above the wheel.',
    'Catalogued in 1931 and mislaid in 1932.',
    'Still in use, which is more than can be said for the pottery.',
    'Bought for the glaze and broken in the carrying home.',
    'The only one of the batch that came out of the kiln whole.'
  ];

  function nameGlaze(rand, colourName, surf) {
    var pool = NAMES[colourName] || NAMES.clear;
    var base = pickOne(rand, pool);
    if (surf === 'matt' || surf === 'calcium matt') return 'Matt ' + base;
    if (surf === 'crystalline') return 'Crystalline ' + base;
    if (surf === 'dry' || surf === 'unmelted') return 'Dry ' + base;
    if (surf === 'satin' || surf === 'magnesia satin') return 'Satin ' + base;
    return base;
  }

  /* ================= state ================= */

  var S = {
    seed: 0, dayOffset: 0, date: new Date(), tries: 1,
    form: null, recipe: {}, colKey: 'none', colAmt: 0, opacKey: 'none', opacAmt: 0,
    cone: '6', body: 'ston', atm: 'oxidation', cool: 'normal', thick: 0.5,
    yaw: 0.6, pitch: 0.36, fire: 1, cryst: 1, firing: false, fireT: 0,
    glazeName: '', plaque: null
  };
  var E = null;

  function deal(seed) {
    var rand = rng(seed);
    S.seed = seed;
    S.cone = pickOne(rand, ['04', '6', '6', '10', '10']);
    S.body = S.cone === '04' ? (rand() < 0.6 ? 'earth' : 'ston')
           : S.cone === '6' ? (rand() < 0.65 ? 'ston' : 'porc')
           : (rand() < 0.45 ? 'porc' : (rand() < 0.6 ? 'ston' : 'iron'));
    S.atm = S.cone === '04' ? 'oxidation'
          : S.cone === '6' ? (rand() < 0.25 ? 'reduction' : 'oxidation')
          : (rand() < 0.6 ? 'reduction' : 'oxidation');
    S.cool = pickOne(rand, ['fast', 'normal', 'normal', 'slow']);
    S.thick = Math.round(rr(rand, 0.28, 0.85) * 100) / 100;
    S.form = dealForm(rand, pickOne(rand, FORMKEYS));

    var g = dealGlaze(rand, S.cone);
    S.recipe = g.recipe; S.tries = g.tries;

    if (rand() < 0.38) { S.colKey = 'none'; S.colAmt = 0; }
    else {
      S.colKey = pickOne(rand, ['iron', 'iron', 'iron', 'cob', 'cop', 'rut', 'rut', 'man', 'chr']);
      var range = { iron: [0.5, 10], cob: [0.25, 2], cop: [0.5, 4], rut: [2, 10], man: [1, 6], chr: [0.5, 3] }[S.colKey];
      S.colAmt = Math.round(rr(rand, range[0], range[1]) * 4) / 4;
    }
    if (rand() < 0.28) { S.opacKey = rand() < 0.5 ? 'tin' : 'zir'; S.opacAmt = Math.round(rr(rand, 2, 12)); }
    else { S.opacKey = 'none'; S.opacAmt = 0; }

    S.yaw = rr(rand, -0.5, 0.9); S.pitch = 0.34;
    S.fire = 1; S.cryst = 1; S.firing = false;

    evaluate();
    S.glazeName = nameGlaze(rand, E.colour.name, E.surface);
    S.plaque = {
      house: pickOne(rand, HOUSES) + ' ' + pickOne(rand, WORKS),
      year: 1780 + Math.floor(rand() * 180),
      purpose: pickOne(rand, PURPOSE),
      fate: pickOne(rand, FATE)
    };
  }

  function colourants() {
    var c = {};
    if (S.colKey !== 'none' && S.colAmt > 0) c[S.colKey] = S.colAmt;
    if (S.opacKey !== 'none' && S.opacAmt > 0) c[S.opacKey] = S.opacAmt;
    return c;
  }

  function evaluate() {
    var cols = colourants();
    var c = chem(S.recipe, cols, S.cone);
    var surf = surfaceOf(c, S.cone, S.cool);
    var f = faultsOf(c, S.cone, S.body, S.cool, S.thick, S.recipe);
    E = {
      chem: c,
      surface: surf,
      finish: FINISH[surf] || FINISH.satin,
      faults: f.list,
      fit: f.fit,
      inBox: inLimits(c, S.cone),
      colour: colourOf(S.colKey, S.colAmt, S.opacKey, S.opacAmt, S.atm, c.unity, surf)
    };
    return E;
  }

  /* ================= geometry ================= */

  var RINGS = 36, SEG = 32;
  var GEO = null;

  function buildGeometry() {
    var prof = sampleProfile(S.form.pts, RINGS);
    var H = S.form.h, wall = 0.045, floorT = 0.16;
    var verts = [], faces = [], i, j;
    var cosT = [], sinT = [];
    for (j = 0; j <= SEG; j++) { cosT.push(Math.cos(j / SEG * Math.PI * 2)); sinT.push(Math.sin(j / SEG * Math.PI * 2)); }

    /* curvature per ring, for where the glaze runs thin */
    var edge = [];
    for (i = 0; i < RINGS; i++) {
      var a = prof[Math.max(0, i - 1)], b = prof[i], d = prof[Math.min(RINGS - 1, i + 1)];
      var k = Math.abs((d[1] - b[1]) - (b[1] - a[1])) / 0.02;
      edge.push(clamp(k, 0, 1));
    }
    edge[RINGS - 1] = 1;

    function vert(r, t) { var id = verts.length; verts.push([r, t * H, 0]); return id; }
    /* store as (radius, height, angleIndex) and expand on transform instead */
    verts.length = 0;
    var outIdx = [], inIdx = [];
    for (i = 0; i < RINGS; i++) {
      var row = [];
      for (j = 0; j < SEG; j++) { row.push(verts.length); verts.push([prof[i][1] * cosT[j], prof[i][0] * H, prof[i][1] * sinT[j]]); }
      outIdx.push(row);
    }
    var firstIn = -1;
    for (i = 0; i < RINGS; i++) {
      if (prof[i][0] < floorT) { inIdx.push(null); continue; }
      if (firstIn < 0) firstIn = i;
      var rin = Math.max(0.02, prof[i][1] - wall), row2 = [];
      for (j = 0; j < SEG; j++) { row2.push(verts.length); verts.push([rin * cosT[j], prof[i][0] * H, rin * sinT[j]]); }
      inIdx.push(row2);
    }

    function quad(a, b, c, d, kind, ring) { faces.push({ v: [a, b, c, d], k: kind, r: ring }); }

    for (i = 0; i < RINGS - 1; i++) {
      for (j = 0; j < SEG; j++) {
        var j2 = (j + 1) % SEG;
        quad(outIdx[i][j], outIdx[i + 1][j], outIdx[i + 1][j2], outIdx[i][j2], 'out', i);
      }
    }
    for (i = firstIn; i >= 0 && i < RINGS - 1; i++) {
      if (!inIdx[i] || !inIdx[i + 1]) continue;
      for (j = 0; j < SEG; j++) {
        var j3 = (j + 1) % SEG;
        quad(inIdx[i][j], inIdx[i][j3], inIdx[i + 1][j3], inIdx[i + 1][j], 'in', i);
      }
    }
    /* lip */
    var top = RINGS - 1;
    if (inIdx[top]) {
      for (j = 0; j < SEG; j++) {
        var j4 = (j + 1) % SEG;
        quad(outIdx[top][j], inIdx[top][j], inIdx[top][j4], outIdx[top][j4], 'lip', top);
      }
    }
    /* inner floor and outer base as fans */
    if (firstIn >= 0) {
      var cIn = verts.length; verts.push([0, prof[firstIn][0] * H, 0]);
      for (j = 0; j < SEG; j++) {
        var j5 = (j + 1) % SEG;
        quad(cIn, inIdx[firstIn][j], inIdx[firstIn][j5], cIn, 'floor', firstIn);
      }
    }
    var cB = verts.length; verts.push([0, 0, 0]);
    for (j = 0; j < SEG; j++) {
      var j6 = (j + 1) % SEG;
      quad(cB, outIdx[0][j6], outIdx[0][j], cB, 'base', 0);
    }

    GEO = { verts: verts, faces: faces, prof: prof, edge: edge, H: H, maxR: Math.max.apply(null, prof.map(function (p) { return p[1]; })) };
  }

  /* ================= the pot canvas ================= */

  var potC, potX, profC, profX, schC, schX;

  function fitCanvas(c) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return null;
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
    }
    var x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    return { x: x, w: w, h: h };
  }

  function drawPot() {
    var s = fitCanvas(potC); if (!s || !GEO) return;
    var x = s.x, w = s.w, h = s.h;
    x.fillStyle = '#080b11'; x.fillRect(0, 0, w, h);

    var body = BODIES[S.body].col, fin = E.finish, col = E.colour;
    var fire = S.fire, cryst = S.cryst;
    /* before the glaze melts it is a pale dusty coat */
    var raw = mix3(col.tint, [226, 222, 214], 0.75);
    var tint = mix3(raw, col.tint, smooth(fire));
    var shin = lerp(2.5, fin.shin, smooth(fire));
    var spec = lerp(0.02, fin.spec, smooth(fire));

    var H = GEO.H, maxR = GEO.maxR;
    var scale = Math.min(w * 0.80 / (2 * maxR), h * 0.80 / H);
    var cx = w * 0.5, cyPix = h * 0.56, cyObj = H * 0.5, D = 4.2;
    var cy2 = Math.cos(S.yaw), sy2 = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);

    var V = GEO.verts, n = V.length, vx = new Float64Array(n), vy = new Float64Array(n), vz = new Float64Array(n);
    var sx = new Float64Array(n), sy3 = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var p = V[i], X = p[0] * cy2 + p[2] * sy2, Z = -p[0] * sy2 + p[2] * cy2, Yo = p[1] - cyObj;
      var Y = Yo * cp - Z * sp, Z2 = Yo * sp + Z * cp;
      vx[i] = X; vy[i] = Y; vz[i] = Z2;
      var f = D / (D - Z2);
      sx[i] = cx + X * scale * f; sy3[i] = cyPix - Y * scale * f;
    }

    /* shadow */
    var sh = x.createRadialGradient(cx, cyPix + H * 0.5 * scale * 0.92, 2, cx, cyPix + H * 0.5 * scale * 0.92, maxR * scale * 1.7);
    sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(cx, cyPix + H * 0.5 * scale * 0.94); x.scale(1, 0.26); x.translate(-cx, -(cyPix + H * 0.5 * scale * 0.94));
    x.fillStyle = sh; x.beginPath(); x.arc(cx, cyPix + H * 0.5 * scale * 0.94, maxR * scale * 1.7, 0, 6.2832); x.fill(); x.restore();

    var L = [-0.40, 0.74, 0.54], ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]);
    L[0] /= ll; L[1] /= ll; L[2] /= ll;
    var Hx = L[0], Hy = L[1], Hz = L[2] + 1, hl = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
    Hx /= hl; Hy /= hl; Hz /= hl;

    var F = GEO.faces, list = [], k;
    for (k = 0; k < F.length; k++) {
      var f0 = F[k], a = f0.v[0], b = f0.v[1], c = f0.v[2], d = f0.v[3];
      var ux = vx[b] - vx[a], uy = vy[b] - vy[a], uz = vz[b] - vz[a];
      var wx = vx[d] - vx[a], wy = vy[d] - vy[a], wz = vz[d] - vz[a];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      var nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-9) continue;
      nx /= nl; ny /= nl; nz /= nl;
      if (nz <= 0.001) continue;
      list.push({ f: f0, nx: nx, ny: ny, nz: nz, z: (vz[a] + vz[b] + vz[c] + vz[d]) * 0.25 });
    }
    list.sort(function (p1, p2) { return p1.z - p2.z; });

    var run = clamp((E.chem.melt - 1.0) * 1.4, 0, 1) * smooth(fire);
    for (k = 0; k < list.length; k++) {
      var it = list[k], f = it.f, ring = f.r;
      var t01 = GEO.prof[ring][0];
      var thin = GEO.edge[ring];
      var thickness = S.thick * (1 + run * 1.5 * (1 - t01) * (1 - t01)) * (1 - 0.55 * thin);
      var cover = 1 - Math.exp(-col.power * thickness * 3.4);
      var base = mix3(body, tint, clamp(cover, 0, 1));
      if (f.k === 'in') base = mix3(base, [0, 0, 0], 0.30 + 0.35 * (1 - t01));
      if (f.k === 'base' || f.k === 'floor') base = mix3(base, [0, 0, 0], 0.45);

      var lam = Math.max(0, it.nx * L[0] + it.ny * L[1] + it.nz * L[2]);
      var sp2 = Math.pow(Math.max(0, it.nx * Hx + it.ny * Hy + it.nz * Hz), shin) * spec;
      var rim = Math.pow(1 - it.nz, 3) * 0.20;
      var sk = ((hash32(ring * 73856093 ^ k * 19349663) >>> 8) / 16777216 - 0.5);
      var grain = 1 + sk * (E.surface === 'crystalline' ? 0.20 * cryst : 0.055);
      var shade = (0.16 + 0.84 * lam) * grain + rim;
      var cc = [base[0] * shade + sp2 * 245, base[1] * shade + sp2 * 248, base[2] * shade + sp2 * 252];

      x.fillStyle = css(cc);
      x.beginPath();
      x.moveTo(sx[f.v[0]], sy3[f.v[0]]);
      x.lineTo(sx[f.v[1]], sy3[f.v[1]]);
      x.lineTo(sx[f.v[2]], sy3[f.v[2]]);
      x.lineTo(sx[f.v[3]], sy3[f.v[3]]);
      x.closePath();
      x.fill();
      x.strokeStyle = x.fillStyle; x.lineWidth = 0.6; x.stroke();
    }

    if (S.firing) {
      x.fillStyle = 'rgba(255,150,60,' + (0.16 * step01(500, 1100, S.fireT)) + ')';
      x.fillRect(0, 0, w, h);
    }
  }

  /* ================= profile editor ================= */

  var drag = -1;
  function profMap(s) {
    return { ax: s.w * 0.30, rs: s.w * 0.60, by: s.h * 0.94, hs: s.h * 0.86 };
  }
  function drawProfile() {
    var s = fitCanvas(profC); if (!s) return;
    var x = s.x, w = s.w, h = s.h, m = profMap(s);
    x.fillStyle = 'rgba(11,15,22,.6)'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.10)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(m.ax, h * 0.04); x.lineTo(m.ax, m.by); x.stroke();
    x.beginPath(); x.moveTo(w * 0.04, m.by); x.lineTo(w * 0.96, m.by); x.stroke();

    var prof = sampleProfile(S.form.pts, 80), i;
    x.beginPath();
    x.moveTo(m.ax, m.by);
    for (i = 0; i < prof.length; i++) x.lineTo(m.ax + prof[i][1] * m.rs, m.by - prof[i][0] * S.form.h / 1.1 * m.hs);
    x.lineTo(m.ax, m.by - prof[prof.length - 1][0] * S.form.h / 1.1 * m.hs);
    x.closePath();
    x.fillStyle = 'rgba(100,240,200,.14)'; x.fill();
    x.strokeStyle = '#64f0c8'; x.lineWidth = 1.6;
    x.beginPath();
    for (i = 0; i < prof.length; i++) {
      var px = m.ax + prof[i][1] * m.rs, py = m.by - prof[i][0] * S.form.h / 1.1 * m.hs;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.stroke();
    /* mirrored ghost */
    x.strokeStyle = 'rgba(122,162,255,.28)';
    x.beginPath();
    for (i = 0; i < prof.length; i++) {
      var px2 = m.ax - prof[i][1] * m.rs * 0.62, py2 = m.by - prof[i][0] * S.form.h / 1.1 * m.hs;
      if (i === 0) x.moveTo(px2, py2); else x.lineTo(px2, py2);
    }
    x.stroke();

    for (i = 0; i < S.form.pts.length; i++) {
      var q = S.form.pts[i];
      var hx = m.ax + q[1] * m.rs, hy = m.by - q[0] * S.form.h / 1.1 * m.hs;
      x.beginPath(); x.arc(hx, hy, i === drag ? 8 : 6, 0, 6.2832);
      x.fillStyle = i === drag ? '#64f0c8' : 'rgba(7,9,13,.9)';
      x.fill();
      x.strokeStyle = '#64f0c8'; x.lineWidth = 1.6; x.stroke();
    }
  }

  function profPointAt(ev) {
    var s = { w: profC.clientWidth, h: profC.clientHeight };
    var rect = profC.getBoundingClientRect(), m = profMap(s);
    var px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    var best = -1, bd = 26 * 26;
    for (var i = 0; i < S.form.pts.length; i++) {
      var q = S.form.pts[i];
      var hx = m.ax + q[1] * m.rs, hy = m.by - q[0] * S.form.h / 1.1 * m.hs;
      var d2 = (px - hx) * (px - hx) + (py - hy) * (py - hy);
      if (d2 < bd) { bd = d2; best = i; }
    }
    return { i: best, px: px, py: py, m: m };
  }

  /* ================= firing schedule ================= */

  function schedule() {
    var cone = CONES[S.cone], pts = [[0, 20]];
    function ramp(to, rate) { var l = pts[pts.length - 1]; pts.push([l[0] + (to - l[1]) / rate, to]); }
    ramp(600, 140); ramp(1000, 110); ramp(cone.temp, 70);
    pts.push([pts[pts.length - 1][0] + 0.33, cone.temp]);
    var rate = S.cool === 'fast' ? 260 : (S.cool === 'slow' ? 45 : 130);
    var l1 = pts[pts.length - 1]; pts.push([l1[0] + (cone.temp - 900) / rate, 900]);
    var l2 = pts[pts.length - 1]; pts.push([l2[0] + 800 / 300, 100]);
    return pts;
  }

  function tempAt(pts, hours) {
    for (var i = 1; i < pts.length; i++) {
      if (hours <= pts[i][0]) {
        var f = (hours - pts[i - 1][0]) / ((pts[i][0] - pts[i - 1][0]) || 1);
        return lerp(pts[i - 1][1], pts[i][1], clamp(f, 0, 1));
      }
    }
    return pts[pts.length - 1][1];
  }

  function drawSchedule(marker) {
    var s = fitCanvas(schC); if (!s) return;
    var x = s.x, w = s.w, h = s.h, pts = schedule();
    var total = pts[pts.length - 1][0], peak = CONES[S.cone].temp;
    var L = 46, R = w - 14, T = 14, B = h - 26;
    function px(t) { return L + (t / total) * (R - L); }
    function py(v) { return B - (v / 1400) * (B - T); }
    x.fillStyle = 'rgba(11,15,22,.6)'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1;
    x.font = '10px ui-monospace,Menlo,monospace'; x.fillStyle = '#8b97ab';
    for (var v = 0; v <= 1200; v += 400) {
      x.beginPath(); x.moveTo(L, py(v)); x.lineTo(R, py(v)); x.stroke();
      x.fillText(v + '°', 6, py(v) + 3);
    }
    x.strokeStyle = 'rgba(122,162,255,.5)';
    x.setLineDash([3, 4]);
    x.beginPath(); x.moveTo(L, py(peak)); x.lineTo(R, py(peak)); x.stroke();
    x.setLineDash([]);
    x.strokeStyle = '#64f0c8'; x.lineWidth = 2;
    x.beginPath();
    for (var i = 0; i < pts.length; i++) { if (i === 0) x.moveTo(px(pts[i][0]), py(pts[i][1])); else x.lineTo(px(pts[i][0]), py(pts[i][1])); }
    x.stroke();
    x.fillStyle = '#8b97ab';
    x.fillText(total.toFixed(1) + ' h', R - 34, B + 16);
    x.fillText(CONES[S.cone].label + ' · ' + peak + '°C · ' + S.cool + ' cool', L, B + 16);
    if (marker !== null && marker !== undefined) {
      var t = tempAt(pts, marker);
      x.fillStyle = '#ffce6a';
      x.beginPath(); x.arc(px(marker), py(t), 4.5, 0, 6.2832); x.fill();
      x.fillStyle = '#ffce6a';
      x.fillText(Math.round(t) + '°C', clamp(px(marker) - 16, L, R - 40), py(t) - 9);
    }
  }

  /* ================= firing ================= */

  var fireRaf = null;
  function startFiring() {
    if (S.firing) return;
    var pts = schedule(), total = pts[pts.length - 1][0], peak = CONES[S.cone].temp;
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var dur = 5200, maxT = 0;
    S.firing = true; S.fire = 0; S.cryst = 0;
    $('btnFire').disabled = true;
    function frame(now) {
      var p = clamp(((now || Date.now()) - t0) / dur, 0, 1);
      var hours = p * total;
      var T = tempAt(pts, hours);
      maxT = Math.max(maxT, T);
      S.fireT = T;
      S.fire = smooth(step01(peak - 210, peak - 25, maxT));
      if (maxT >= peak - 25 && T < maxT - 40) {
        S.cryst = smooth(step01(peak - 30, 960, T));
      }
      drawSchedule(hours);
      drawPot();
      if (p < 1) { fireRaf = requestAnimationFrame(frame); }
      else {
        S.firing = false; S.fire = 1; S.cryst = 1;
        $('btnFire').disabled = false;
        drawSchedule(null); drawPot(); report();
      }
    }
    fireRaf = requestAnimationFrame(frame);
  }

  /* ================= readouts ================= */

  function formulaText(u) {
    var parts = [], i;
    for (i = 0; i < ORDER.length; i++) {
      var o = ORDER[i];
      if (u[o] && u[o] >= 0.005) parts.push(fx(u[o]) + ' ' + o);
    }
    var mid = [];
    if (u.Al2O3) mid.push(fx(u.Al2O3) + ' Al₂O₃');
    if (u.B2O3 && u.B2O3 >= 0.005) mid.push(fx(u.B2O3) + ' B₂O₃');
    var right = u.SiO2 ? fx(u.SiO2) + ' SiO₂' : '';
    if (u.P2O5 && u.P2O5 >= 0.005) right += '   ' + fx(u.P2O5) + ' P₂O₅';
    return parts.join('  ·  ') + '   |   ' + mid.join('  ·  ') + '   |   ' + right;
  }

  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }

  function report() {
    var c = E.chem, u = c.unity;
    setText('formula', formulaText(u));
    setText('factCone', CONES[S.cone].label + ' · ' + CONES[S.cone].temp + '°C');
    setText('factBody', BODIES[S.body].name);
    setText('factAtm', S.atm);
    setText('factCool', S.cool + ' cool');
    setText('factRatio', fx(c.ratio) + ' : 1');
    setText('factCte', fx(c.cte) + ' ×10⁻⁶/°C');
    var d = E.fit;
    setText('factFit', (d > 0 ? '+' : '') + fx(d) + ' against the body');
    setText('factMelt', fx(c.melt) + ' × what the cone wants');
    setText('factSurface', E.surface);
    setText('factColour', E.colour.name);
    setText('factForm', S.form.name);
    setText('factSeed', String(S.seed).padStart(10, '0'));
    setText('factTries', S.tries === 1 ? 'first draft' : S.tries + ' drafts');
    setText('nameOut', S.glazeName);
    setText('potterOut', S.plaque.house + ', ' + S.plaque.year);
    setText('purposeOut', 'Thrown ' + S.plaque.purpose + '.');
    setText('fateOut', S.plaque.fate);
    setText('dayOut', S.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
    setText('thickOut', fx(S.thick * 1.6, 2) + ' mm');
    setText('colAmtOut', fx(S.colAmt, 2) + '%');
    setText('opacAmtOut', fx(S.opacAmt, 1) + '%');

    var v = $('verdict');
    if (v) {
      v.className = 'verdict ' + (E.faults.length ? (E.inBox ? 'warn' : 'bad') : 'good');
      var head = E.inBox ? 'Inside the limits for ' + CONES[S.cone].label + '.'
                         : 'Outside the limits for ' + CONES[S.cone].label + '.';
      v.innerHTML = '<b>' + head + '</b> ' +
        (E.faults.length ? 'Came out of the kiln ' + E.faults.join(', ') + '.'
                         : 'Came out of the kiln sound: no crazing, no shivering, nothing on the shelf.');
    }
    updateRecipeLabels();
  }

  /* ================= controls ================= */

  function chipRow(hostId, items, sel, onPick) {
    var host = $(hostId); if (!host) return;
    host.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (it.key === sel ? ' on' : '');
      b.textContent = it.label;
      b.addEventListener('click', function () { onPick(it.key); });
      host.appendChild(b);
    });
  }

  function buildRecipeUI() {
    var host = $('recipe'); if (!host) return;
    host.innerHTML = '';
    Object.keys(S.recipe).forEach(function (k) {
      var lab = document.createElement('label');
      lab.appendChild(document.createTextNode(MAT[k].name + ' '));
      var b = document.createElement('b'); b.id = 'rv_' + k; b.textContent = '';
      lab.appendChild(b);
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = '0'; inp.max = '70'; inp.step = '0.5';
      inp.value = String(S.recipe[k]);
      inp.addEventListener('input', function () {
        S.recipe[k] = parseFloat(inp.value);
        evaluate(); report(); drawPot();
      });
      lab.appendChild(inp);
      host.appendChild(lab);
    });
  }

  function updateRecipeLabels() {
    var n = normRecipe(S.recipe);
    for (var k in S.recipe) {
      var el = $('rv_' + k);
      if (el) el.textContent = fx(n[k] || 0, 1) + '%';
    }
  }

  function refreshChips() {
    chipRow('forms', FORMKEYS.map(function (k) { return { key: k, label: FORMS[k].name.replace(/^an? /, '') }; }), S.form.key, function (k) {
      S.form = dealForm(rng(hash32(S.seed ^ (k.length * 7919))), k);
      buildGeometry(); refreshChips(); report(); drawPot(); drawProfile();
    });
    chipRow('cones', CONEKEYS.map(function (k) { return { key: k, label: CONES[k].label }; }), S.cone, function (k) {
      S.cone = k; evaluate(); report(); drawPot(); drawSchedule(null);
    });
    chipRow('bodies', BODYKEYS.map(function (k) { return { key: k, label: BODIES[k].name }; }), S.body, function (k) {
      S.body = k; evaluate(); report(); drawPot();
    });
    chipRow('atms', [{ key: 'oxidation', label: 'oxidation' }, { key: 'reduction', label: 'reduction' }], S.atm, function (k) {
      S.atm = k; evaluate(); report(); drawPot();
    });
    chipRow('cools', [{ key: 'fast', label: 'fast cool' }, { key: 'normal', label: 'normal' }, { key: 'slow', label: 'slow cool' }], S.cool, function (k) {
      S.cool = k; evaluate(); report(); drawPot(); drawSchedule(null);
    });
    chipRow('colorchips', ['none', 'iron', 'cob', 'cop', 'rut', 'man', 'chr'].map(function (k) {
      return { key: k, label: k === 'none' ? 'no colour' : COL[k].name };
    }), S.colKey, function (k) {
      S.colKey = k;
      if (k !== 'none' && S.colAmt <= 0) S.colAmt = 2;
      var sl = $('colAmt'); if (sl) sl.value = String(S.colAmt);
      evaluate(); report(); drawPot();
    });
    chipRow('opacchips', ['none', 'tin', 'zir'].map(function (k) {
      return { key: k, label: k === 'none' ? 'transparent' : COL[k].name };
    }), S.opacKey, function (k) {
      S.opacKey = k;
      if (k !== 'none' && S.opacAmt <= 0) S.opacAmt = 6;
      var sl = $('opacAmt'); if (sl) sl.value = String(S.opacAmt);
      evaluate(); report(); drawPot();
    });
  }

  /* ================= benchmark, run once at load ================= */

  function benchmark() {
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var n = 240, sum = 0, worst = 0, fails = 0;
    for (var i = 0; i < n; i++) {
      var rand = rng(hash32(i * 2654435761));
      var ck = CONEKEYS[i % 3];
      var g = dealGlaze(rand, ck);
      sum += g.tries;
      if (g.tries > worst) worst = g.tries;
      if (!g.ok) fails++;
    }
    var ms = ((window.performance && performance.now) ? performance.now() : Date.now()) - t0;
    return { n: n, avg: sum / n, worst: worst, fails: fails, ms: ms };
  }

  /* ================= wiring ================= */

  function redrawAll() { buildGeometry(); report(); drawPot(); drawProfile(); drawSchedule(null); }

  function dealDay(offset) {
    S.dayOffset = offset;
    var d = new Date();
    d.setDate(d.getDate() + offset);
    S.date = d;
    var ymd = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    deal(hash32(ymd));
    buildRecipeUI(); refreshChips(); redrawAll();
  }

  function init() {
    potC = $('pot'); profC = $('profile'); schC = $('sched');
    if (!potC || !profC || !schC) return;

    dealDay(0);

    var b = benchmark();
    var el = $('benchOut');
    if (el) {
      el.textContent = 'Dealt ' + b.n + ' glazes at load, eighty at each cone: ' +
        b.avg.toFixed(2) + ' drafts on average before the formula landed in the box, ' +
        'worst ' + b.worst + ', ' + (b.fails === 0 ? 'none gave up' : b.fails + ' gave up') +
        ', ' + b.ms.toFixed(1) + ' ms for the lot.';
    }

    /* rotate the pot */
    var last = null;
    potC.addEventListener('pointerdown', function (e) {
      last = { x: e.clientX, y: e.clientY };
      potC.setPointerCapture(e.pointerId);
    });
    potC.addEventListener('pointermove', function (e) {
      if (!last) return;
      S.yaw += (e.clientX - last.x) * 0.010;
      S.pitch = clamp(S.pitch - (e.clientY - last.y) * 0.006, -0.35, 1.05);
      last = { x: e.clientX, y: e.clientY };
      drawPot();
    });
    potC.addEventListener('pointerup', function () { last = null; });
    potC.addEventListener('pointercancel', function () { last = null; });

    /* drag the profile */
    profC.addEventListener('pointerdown', function (e) {
      var p = profPointAt(e);
      if (p.i >= 0) { drag = p.i; profC.setPointerCapture(e.pointerId); drawProfile(); }
    });
    profC.addEventListener('pointermove', function (e) {
      if (drag < 0) return;
      var p = profPointAt(e), m = p.m, pts = S.form.pts;
      pts[drag][1] = clamp((p.px - m.ax) / m.rs, 0.04, 1.0);
      if (drag > 0 && drag < pts.length - 1) {
        var t = clamp((m.by - p.py) / (m.hs * S.form.h / 1.1), 0, 1);
        pts[drag][0] = clamp(t, pts[drag - 1][0] + 0.03, pts[drag + 1][0] - 0.03);
      }
      buildGeometry(); drawProfile(); drawPot();
    });
    profC.addEventListener('pointerup', function () { drag = -1; drawProfile(); });
    profC.addEventListener('pointercancel', function () { drag = -1; drawProfile(); });

    function slider(id, get, set) {
      var s = $(id); if (!s) return;
      s.value = String(get());
      s.addEventListener('input', function () { set(parseFloat(s.value)); evaluate(); report(); drawPot(); });
    }
    slider('thickRange', function () { return S.thick; }, function (v) { S.thick = v; });
    slider('colAmt', function () { return S.colAmt; }, function (v) { S.colAmt = v; });
    slider('opacAmt', function () { return S.opacAmt; }, function (v) { S.opacAmt = v; });

    function wire(id, fn) { var n2 = $(id); if (n2) n2.addEventListener('click', fn); }
    wire('btnFire', startFiring);
    wire('btnNew', function () {
      deal((Math.random() * 4294967295) >>> 0);
      buildRecipeUI(); refreshChips(); redrawAll();
      var t = $('thickRange'); if (t) t.value = String(S.thick);
      var c = $('colAmt'); if (c) c.value = String(S.colAmt);
      var o = $('opacAmt'); if (o) o.value = String(S.opacAmt);
    });
    wire('btnToday', function () {
      dealDay(0);
      var t = $('thickRange'); if (t) t.value = String(S.thick);
      var c = $('colAmt'); if (c) c.value = String(S.colAmt);
      var o = $('opacAmt'); if (o) o.value = String(S.opacAmt);
    });
    wire('btnCopy', function () {
      var n3 = normRecipe(S.recipe), lines = [];
      lines.push(S.glazeName + ' — ' + CONES[S.cone].label + ', ' + S.atm);
      for (var k in n3) lines.push(MAT[k].name + '  ' + fx(n3[k], 1));
      if (S.colKey !== 'none') lines.push('+ ' + COL[S.colKey].name + '  ' + fx(S.colAmt, 2));
      if (S.opacKey !== 'none') lines.push('+ ' + COL[S.opacKey].name + '  ' + fx(S.opacAmt, 1));
      lines.push('unity: ' + formulaText(E.chem.unity).replace(/\s+/g, ' '));
      var txt = lines.join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt);
        this.textContent = 'Copied';
        var self = this;
        setTimeout(function () { self.textContent = 'Copy the recipe'; }, 1400);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|button/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { dealDay(S.dayOffset - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { dealDay(S.dayOffset + 1); e.preventDefault(); }
    });

    window.addEventListener('resize', function () { drawPot(); drawProfile(); drawSchedule(null); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
