/* The Folly — a building dealt by today's date.
   Hand-rolled 3D: no libraries, no assets, no build step.
   experiment.quibo.games */
(function () {
  'use strict';

  /* ==========================================================
     1 — seed and randomness (same family as the rest of Drift)
     ========================================================== */
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
  function rr(r, a, b) { return a + r() * (b - a); }
  function ri(r, a, b) { return Math.floor(a + r() * (b - a + 1)); }
  function pick(r, a) { return a[Math.floor(r() * a.length) % a.length]; }
  function chance(r, p) { return r() < p; }

  /* ==========================================================
     2 — polygon and vector helpers
     ========================================================== */
  function polyRect(w, d, cx, cz) {
    cx = cx || 0; cz = cz || 0;
    return [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2],
            [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
  }
  function polyReg(n, rad, cx, cz, rot) {
    cx = cx || 0; cz = cz || 0; rot = rot || 0;
    var p = [];
    for (var i = 0; i < n; i++) {
      var a = rot + (i / n) * Math.PI * 2;
      p.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad]);
    }
    return p;
  }
  function polyCentroid(poly) {
    var x = 0, z = 0;
    for (var i = 0; i < poly.length; i++) { x += poly[i][0]; z += poly[i][1]; }
    return [x / poly.length, z / poly.length];
  }
  /* uniform outward offset, good enough for the convex-ish plans used here */
  function polyGrow(poly, amt) {
    var c = polyCentroid(poly), out = [];
    for (var i = 0; i < poly.length; i++) {
      var dx = poly[i][0] - c[0], dz = poly[i][1] - c[1];
      var L = Math.sqrt(dx * dx + dz * dz) || 1;
      out.push([poly[i][0] + (dx / L) * amt, poly[i][1] + (dz / L) * amt]);
    }
    return out;
  }
  function centroid3(pts) {
    var x = 0, y = 0, z = 0;
    for (var i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; z += pts[i][2]; }
    return [x / pts.length, y / pts.length, z / pts.length];
  }
  /* Newell's method — stable for near-degenerate polygons */
  function normalOf(pts) {
    var nx = 0, ny = 0, nz = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    var L = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(L > 1e-9)) return [0, 1, 0];
    return [nx / L, ny / L, nz / L];
  }
  function sideNormal(a, b, inside) {
    var dx = b[0] - a[0], dz = b[1] - a[1];
    var L = Math.sqrt(dx * dx + dz * dz) || 1;
    var n = [dz / L, -dx / L];
    var mx = (a[0] + b[0]) / 2 - inside[0], mz = (a[1] + b[1]) / 2 - inside[1];
    if (n[0] * mx + n[1] * mz < 0) { n = [-n[0], -n[1]]; }
    return n;
  }
  function mixc(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function shiftc(c, k) {
    return [Math.max(0, Math.min(255, c[0] * k)),
            Math.max(0, Math.min(255, c[1] * k)),
            Math.max(0, Math.min(255, c[2] * k))];
  }

  /* ==========================================================
     3 — materials and idioms
     ========================================================== */
  var WALLMATS = [
    { k: 'limestone', name: 'Pale limestone', c: [212, 205, 186] },
    { k: 'sandstone', name: 'Warm sandstone', c: [199, 164, 116] },
    { k: 'granite',   name: 'Grey granite',   c: [146, 149, 154] },
    { k: 'brick',     name: 'Red brick',      c: [158, 86, 66] },
    { k: 'whitewash', name: 'Whitewashed stone', c: [232, 229, 219] },
    { k: 'basalt',    name: 'Black basalt',   c: [80, 82, 90] },
    { k: 'concrete',  name: 'Board-marked concrete', c: [168, 167, 160] },
    { k: 'marble',    name: 'Veined marble',  c: [224, 222, 226] },
    { k: 'flint',     name: 'Knapped flint',  c: [110, 114, 118] },
    { k: 'timber',    name: 'Oak frame and lime plaster', c: [219, 211, 193] }
  ];
  var ROOFMATS = [
    { k: 'lead',       name: 'Lead',              c: [122, 127, 136] },
    { k: 'copper',     name: 'Verdigris copper',  c: [92, 164, 146] },
    { k: 'slate',      name: 'Blue slate',        c: [84, 92, 108] },
    { k: 'terracotta', name: 'Terracotta pantile', c: [176, 95, 64] },
    { k: 'gilt',       name: 'Gilt over timber',  c: [206, 171, 88] },
    { k: 'thatch',     name: 'Reed thatch',       c: [172, 146, 94] },
    { k: 'zinc',       name: 'Zinc',              c: [146, 149, 146] },
    { k: 'shingle',    name: 'Cedar shingle',     c: [139, 110, 80] }
  ];
  function mat(list, keys, r) {
    var pool = list.filter(function (m) { return keys.indexOf(m.k) >= 0; });
    return pick(r, pool.length ? pool : list);
  }

  var STYLES = [
    {
      k: 'classical', name: 'Classical temple front',
      walls: ['limestone', 'marble', 'whitewash', 'sandstone'],
      roofs: ['lead', 'slate', 'terracotta', 'copper'],
      types: ['Temple', 'Rotunda', 'Pavilion', 'Belvedere', 'Portico'],
      era: [1740, 1830]
    },
    {
      k: 'rotunda', name: 'Peristyle rotunda',
      walls: ['limestone', 'marble', 'whitewash'],
      roofs: ['copper', 'lead', 'gilt', 'zinc'],
      types: ['Rotunda', 'Belvedere', 'Temple', 'Tholos'],
      era: [1730, 1820]
    },
    {
      k: 'gothic', name: 'Gothic revival',
      walls: ['sandstone', 'granite', 'flint', 'limestone'],
      roofs: ['slate', 'lead', 'shingle'],
      types: ['Chantry', 'Spire', 'Oratory', 'Tower', 'Chapel'],
      era: [1790, 1880]
    },
    {
      k: 'moorish', name: 'Moorish kiosk',
      walls: ['whitewash', 'sandstone', 'marble'],
      roofs: ['gilt', 'copper', 'terracotta'],
      types: ['Kiosk', 'Pavilion', 'Bath-house', 'Divan'],
      era: [1800, 1875]
    },
    {
      k: 'pagoda', name: 'Tiered pagoda',
      walls: ['brick', 'timber', 'whitewash', 'sandstone'],
      roofs: ['terracotta', 'copper', 'shingle', 'zinc'],
      types: ['Pagoda', 'Tea-house', 'Tiered Tower'],
      era: [1755, 1840]
    },
    {
      k: 'keep', name: 'Sham castle',
      walls: ['granite', 'flint', 'basalt', 'sandstone'],
      roofs: ['lead', 'slate', 'zinc'],
      types: ['Keep', 'Bastion', 'Watchtower', 'Gatehouse'],
      era: [1760, 1850]
    },
    {
      k: 'brutalist', name: 'Late concrete',
      walls: ['concrete', 'basalt', 'granite'],
      roofs: ['zinc', 'lead'],
      types: ['Block', 'Tribune', 'Monument', 'Belvedere'],
      era: [1958, 1979]
    }
  ];

  /* ==========================================================
     4 — naming and the plaque copy
     ========================================================== */
  var NAME_A = ['Ash', 'Bram', 'Cold', 'Dun', 'Elder', 'Fen', 'Glass', 'Har',
    'Ivy', 'Kett', 'Lang', 'Mere', 'Nether', 'Ould', 'Pike', 'Quill', 'Rook',
    'Salt', 'Thorn', 'Under', 'Wick', 'Yarrow', 'Barrow', 'Grim', 'Hollow',
    'Marl', 'Stag', 'Wold', 'Bell', 'Crake', 'Dray', 'Ember'];
  var NAME_B = ['bourne', 'combe', 'mere', 'field', 'stead', 'wold', 'gate',
    'cross', 'holt', 'hythe', 'marsh', 'moor', 'ridge', 'shaw', 'thorpe',
    'vale', 'well', 'worth', 'fell', 'beck', 'ley', 'cliffe', 'garth', 'hope'];
  var PATRONS = [
    'a widowed cartographer', 'a wool merchant with no heirs',
    'the estate’s third baronet', 'a retired canal engineer',
    'an abbess with a private income', 'a mine owner who had read too much',
    'the parish’s absentee landlord', 'a botanist lately back from the tropics',
    'a clockmaker who had sold his workshop', 'a bankrupt improver',
    'two sisters who never agreed about the roof', 'a naval surgeon on half pay',
    'the county surveyor, for himself', 'a printer with one very good year'
  ];
  var PURPOSES = [
    'to be seen from the house at breakfast',
    'to mark the spot where a favourite dog is buried',
    'to hide a working chimney',
    'to give the eye somewhere to stop at the end of the long walk',
    'to win an argument about the picturesque',
    'to house a telescope that was never delivered',
    'to celebrate a treaty that failed the following spring',
    'to prove the estate quarry could cut it',
    'to shelter a well that had already run dry',
    'to be exactly as tall as the neighbour’s',
    'to be looked at from the lake and from nowhere else',
    'for no stated reason whatsoever'
  ];
  var FATES = [
    'Still standing, and structurally a surprise to everyone who surveys it.',
    'Struck by lightning twice and repaired once.',
    'Never finished above the first floor; the scaffolding was sold.',
    'Taken down stone by stone and re-erected two valleys over.',
    'Lost the roof void to a fire and kept everything else.',
    'Used as a hay barn for eighty years, which is why it survives.',
    'Left to the ivy, which is now the only thing holding it together.',
    'Bought back by the county and opened on Sundays.',
    'Sinking, politely, into its own hill at a hand’s breadth a century.',
    'Repainted every decade by a family who will not explain why.',
    'Condemned, reprieved, condemned again, still there.'
  ];
  var GROUNDS = [
    'on a false hill raised out of the spoil from the lake',
    'at the head of a ride cut through beech',
    'on the only outcrop the estate owns',
    'where three field boundaries meet at nothing in particular',
    'above a ha-ha nobody now needs',
    'at the far end of a causeway that floods twice a winter',
    'in the middle of a walled kitchen garden, awkwardly',
    'on the ridge, deliberately just off the summit'
  ];

  function makeName(r, style) {
    return pick(r, NAME_A) + pick(r, NAME_B) + ' ' + pick(r, style.types);
  }

  /* ==========================================================
     5 — the design: one number in, one building out
     ========================================================== */
  function makeDesign(seed) {
    var r = rng(seed);
    var style = pick(r, STYLES);
    var D = { seed: seed, style: style, r: r };

    D.wall = mat(WALLMATS, style.walls, r);
    D.roofMat = mat(ROOFMATS, style.roofs, r);
    D.trim = shiftc(D.wall.c, 1.12);
    D.name = makeName(r, style);
    D.patron = pick(r, PATRONS);
    D.purpose = pick(r, PURPOSES);
    D.fate = pick(r, FATES);
    D.ground = pick(r, GROUNDS);
    D.begun = ri(r, style.era[0], style.era[1]);
    D.built = D.begun + ri(r, 1, 14);

    D.storeyH = rr(r, 3.4, 4.8);
    D.winShape = 'rect';

    switch (style.k) {
      case 'classical':
        D.plan = 'rect';
        D.W = rr(r, 12, 19); D.Dp = D.W * rr(r, 0.62, 0.86);
        D.storeys = ri(r, 1, 2);
        D.storeyH = rr(r, 4.2, 5.4);
        D.portico = true;
        D.colCount = ri(r, 4, 6);
        D.roofType = 'gable';
        D.winShape = chance(r, 0.4) ? 'round' : 'rect';
        D.wings = chance(r, 0.45);
        break;
      case 'rotunda':
        D.plan = 'round';
        D.R = rr(r, 5.4, 8.2);
        D.storeys = 1;
        D.storeyH = rr(r, 6.2, 8.4);
        D.colCount = ri(r, 12, 18);
        D.roofType = 'dome';
        D.winShape = 'round';
        D.lantern = true;
        break;
      case 'gothic':
        D.plan = 'rect';
        D.W = rr(r, 9, 13); D.Dp = D.W * rr(r, 1.3, 1.9);
        D.storeys = 1;
        D.storeyH = rr(r, 8, 11);
        D.roofType = 'gable';
        D.winShape = 'pointed';
        D.tower = true;
        D.towerW = D.W * rr(r, 0.44, 0.58);
        D.towerH = D.storeyH * rr(r, 1.5, 2.1);
        D.spireH = D.towerH * rr(r, 0.7, 1.15);
        D.buttresses = true;
        D.apse = chance(r, 0.55);
        break;
      case 'moorish':
        D.plan = 'rect';
        D.W = rr(r, 11, 15); D.Dp = D.W * rr(r, 0.9, 1.05);
        D.storeys = ri(r, 1, 2);
        D.storeyH = rr(r, 4.6, 5.8);
        D.arcade = true;
        D.roofType = 'onion';
        D.winShape = 'round';
        D.kiosks = true;
        D.parapet = true;
        break;
      case 'pagoda':
        D.plan = 'tier';
        D.W = rr(r, 9, 13);
        D.Dp = D.W;                     /* square by definition */
        D.tiers = ri(r, 3, 5);
        D.storeys = D.tiers;
        D.storeyH = rr(r, 3.2, 4.1);
        D.roofType = 'tiered';
        D.winShape = 'rect';
        D.mast = true;
        break;
      case 'keep':
        D.plan = 'rect';
        D.W = rr(r, 11, 15); D.Dp = D.W * rr(r, 0.82, 1.0);
        D.storeys = ri(r, 2, 4);
        D.storeyH = rr(r, 3.6, 4.4);
        D.roofType = 'flat';
        D.winShape = 'slit';
        D.battlements = true;
        D.turrets = true;
        D.forebuilding = chance(r, 0.6);
        break;
      case 'brutalist':
        D.plan = 'stack';
        D.W = rr(r, 13, 19); D.Dp = D.W * rr(r, 0.55, 0.8);
        D.slabs = ri(r, 3, 4);
        D.storeys = D.slabs;
        D.storeyH = rr(r, 3.6, 4.6);
        D.roofType = 'flat';
        D.winShape = 'slot';
        D.core = true;
        break;
    }

    D.bays = ri(r, 3, 6);
    D.trees = ri(r, 3, 6);
    D.figures = true;
    D.steps = ri(r, 2, 4);
    return D;
  }

  /* ==========================================================
     6 — the builder: turns a design into shaded polygons
     ========================================================== */
  function makeBuilder() {
    var B = {
      faces: [], ground: [], shadows: [], tag: null,
      stats: { openings: 0, columns: 0, faces: 0 }
    };
    B.face = function (pts, col, inside, kind, glow) {
      if (pts.length < 3) return;
      var n = normalOf(pts);
      if (inside) {
        var c = centroid3(pts);
        var d = (c[0] - inside[0]) * n[0] + (c[1] - inside[1]) * n[1] + (c[2] - inside[2]) * n[2];
        if (d < 0) n = [-n[0], -n[1], -n[2]];
      }
      B.faces.push({ p: pts, n: n, c: col, k: B.tag || kind || 'wall', g: !!glow });
    };
    B.gface = function (pts, col, kind) {
      B.ground.push({ p: pts, n: [0, 1, 0], c: col, k: kind || 'ground' });
    };
    return B;
  }

  function addPrism(B, poly, y0, y1, col, opt) {
    opt = opt || {};
    var c = polyCentroid(poly);
    var inside = [c[0], (y0 + y1) / 2, c[1]];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      B.face([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]],
        col, inside, opt.kind || 'wall');
    }
    if (opt.cap !== false) {
      var top = poly.map(function (p) { return [p[0], y1, p[1]]; });
      B.face(top, opt.capCol || col, inside, opt.capKind || 'roof');
    }
  }

  /* --- openings ------------------------------------------------ */
  function openingPts(shape, a, b, nrm, u0, u1, yb, yt, eps) {
    var len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
    function P(u, y) {
      return [a[0] + (b[0] - a[0]) * u + nrm[0] * eps, y,
              a[1] + (b[1] - a[1]) * u + nrm[1] * eps];
    }
    var pts = [], k, t, ang;
    var uc = (u0 + u1) / 2, du = (u1 - u0) / 2;
    var halfW = du * len;
    if (shape === 'round') {
      var ys = Math.max(yb + 0.2, yt - halfW);
      pts.push(P(u0, yb)); pts.push(P(u1, yb)); pts.push(P(u1, ys));
      for (k = 1; k <= 9; k++) {
        ang = (k / 9) * Math.PI;
        pts.push(P(uc + Math.cos(ang) * du, ys + Math.sin(ang) * (yt - ys)));
      }
    } else if (shape === 'pointed') {
      var ysp = yb + (yt - yb) * 0.55;
      pts.push(P(u0, yb)); pts.push(P(u1, yb)); pts.push(P(u1, ysp));
      for (k = 1; k <= 6; k++) {
        t = k / 6;
        pts.push(P(u1 + (uc - u1) * t, ysp + (yt - ysp) * Math.sin(t * Math.PI / 2)));
      }
      for (k = 5; k >= 1; k--) {
        t = k / 6;
        pts.push(P(u0 + (uc - u0) * t, ysp + (yt - ysp) * Math.sin(t * Math.PI / 2)));
      }
      pts.push(P(u0, ysp));
    } else {
      pts.push(P(u0, yb)); pts.push(P(u1, yb)); pts.push(P(u1, yt)); pts.push(P(u0, yt));
    }
    return pts;
  }

  function wallOpenings(B, poly, y0, opt) {
    var c = polyCentroid(poly);
    var eps = 0.06;
    for (var i = 0; i < poly.length; i++) {
      if (opt.sides && opt.sides.indexOf(i) < 0) continue;
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      if (len < (opt.minLen || 1.5)) continue;
      var n = sideNormal(a, b, c);
      var bays = Math.max(1, Math.round(len / (opt.spacing || 3.4)));
      var wFrac = (opt.wFrac || 0.42) / bays;
      for (var s = 0; s < (opt.storeys || 1); s++) {
        var base = y0 + s * opt.storeyH;
        var yb = base + (opt.sill || 1.0);
        var yt = base + opt.storeyH * (opt.hFrac || 0.62);
        if (yt - yb < 0.5) continue;
        for (var j = 0; j < bays; j++) {
          var uc = (j + 0.5) / bays;
          var u0 = uc - wFrac / 2, u1 = uc + wFrac / 2;
          var pad = 0.012;
          var ref = [c[0], (yb + yt) / 2, c[1]];
          var frame = openingPts(opt.shape, a, b, n, u0 - pad, u1 + pad,
            yb - 0.16, yt + 0.2, eps * 0.45);
          B.face(frame, opt.trim, ref, 'trim');
          var glow = opt.lit ? (((i * 7 + j * 13 + s * 5) % 3) !== 0) : false;
          var glass = openingPts(opt.shape, a, b, n, u0, u1, yb, yt, eps);
          B.face(glass, opt.glass, ref, 'glass', glow);
          B.stats.openings++;
        }
      }
    }
  }

  /* --- roofs --------------------------------------------------- */
  function addGable(B, cx, cz, w, d, y0, h, col, over, alongZ) {
    over = over || 0;
    var x0 = cx - w / 2 - over, x1 = cx + w / 2 + over;
    var z0 = cz - d / 2 - over, z1 = cz + d / 2 + over;
    var yr = y0 + h;
    var inside = [cx, y0 + h * 0.35, cz];
    if (alongZ) {
      /* ridge runs along Z: the gable ends face front and back */
      B.face([[x0, y0, z0], [x0, y0, z1], [cx, yr, z1], [cx, yr, z0]], col, inside, 'roof');
      B.face([[x1, y0, z0], [x1, y0, z1], [cx, yr, z1], [cx, yr, z0]], col, inside, 'roof');
      B.face([[x0, y0, z0], [x1, y0, z0], [cx, yr, z0]], shiftc(col, 0.92), inside, 'roof');
      B.face([[x0, y0, z1], [x1, y0, z1], [cx, yr, z1]], shiftc(col, 0.92), inside, 'roof');
    } else {
      B.face([[x0, y0, z0], [x1, y0, z0], [x1, yr, cz], [x0, yr, cz]], col, inside, 'roof');
      B.face([[x0, y0, z1], [x1, y0, z1], [x1, yr, cz], [x0, yr, cz]], col, inside, 'roof');
      B.face([[x0, y0, z0], [x0, y0, z1], [x0, yr, cz]], shiftc(col, 0.92), inside, 'roof');
      B.face([[x1, y0, z0], [x1, y0, z1], [x1, yr, cz]], shiftc(col, 0.92), inside, 'roof');
    }
  }
  function addHip(B, cx, cz, w, d, y0, h, col, over) {
    over = over || 0;
    var x0 = cx - w / 2 - over, x1 = cx + w / 2 + over;
    var z0 = cz - d / 2 - over, z1 = cz + d / 2 + over;
    var yr = y0 + h;
    var inset = Math.min((x1 - x0), (z1 - z0)) * 0.26;
    var rx0 = x0 + inset, rx1 = x1 - inset, rz0 = z0 + inset, rz1 = z1 - inset;
    var inside = [cx, y0 + h * 0.35, cz];
    B.face([[x0, y0, z0], [x1, y0, z0], [rx1, yr, rz0], [rx0, yr, rz0]], col, inside, 'roof');
    B.face([[x0, y0, z1], [x1, y0, z1], [rx1, yr, rz1], [rx0, yr, rz1]], col, inside, 'roof');
    B.face([[x0, y0, z0], [x0, y0, z1], [rx0, yr, rz1], [rx0, yr, rz0]], shiftc(col, 0.94), inside, 'roof');
    B.face([[x1, y0, z0], [x1, y0, z1], [rx1, yr, rz1], [rx1, yr, rz0]], shiftc(col, 0.94), inside, 'roof');
    B.face([[rx0, yr, rz0], [rx1, yr, rz0], [rx1, yr, rz1], [rx0, yr, rz1]], shiftc(col, 1.05), inside, 'roof');
  }
  function addPyramid(B, poly, y0, apexY, col) {
    var c = polyCentroid(poly);
    var apex = [c[0], apexY, c[1]];
    var inside = [c[0], y0 + (apexY - y0) * 0.3, c[1]];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      B.face([[a[0], y0, a[1]], [b[0], y0, b[1]], apex], col, inside, 'roof');
    }
  }
  function domeProfile(t, onion) {
    if (onion) {
      var rad = Math.pow(1 - t, 0.62) * (1 + 0.42 * Math.sin(Math.PI * Math.pow(t, 0.9)));
      return [Math.max(0, rad), Math.pow(t, 0.86)];
    }
    return [Math.cos(t * Math.PI / 2), Math.sin(t * Math.PI / 2)];
  }
  function addDome(B, cx, cz, rad, y0, h, col, onion, seg, rings) {
    seg = seg || 20; rings = rings || 9;
    var inside = [cx, y0 + h * 0.4, cz];
    for (var i = 0; i < rings; i++) {
      var p0 = domeProfile(i / rings, onion);
      var p1 = domeProfile((i + 1) / rings, onion);
      var r0 = p0[0] * rad, r1 = p1[0] * rad;
      var y0i = y0 + p0[1] * h, y1i = y0 + p1[1] * h;
      var sh = 1 - i * 0.012;
      for (var j = 0; j < seg; j++) {
        var a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2;
        var q = [
          [cx + Math.cos(a0) * r0, y0i, cz + Math.sin(a0) * r0],
          [cx + Math.cos(a1) * r0, y0i, cz + Math.sin(a1) * r0],
          [cx + Math.cos(a1) * r1, y1i, cz + Math.sin(a1) * r1],
          [cx + Math.cos(a0) * r1, y1i, cz + Math.sin(a0) * r1]
        ];
        if (r1 < 0.02) q.splice(2, 1);
        B.face(q, shiftc(col, sh), inside, 'roof');
      }
    }
  }
  function addSpike(B, cx, cz, rad, y0, h, col) {
    addPyramid(B, polyReg(6, rad, cx, cz), y0, y0 + h, col);
  }

  /* --- columns, battlements, trees, people --------------------- */
  function addColumn(B, cx, cz, rad, y0, h, col) {
    addPrism(B, polyReg(6, rad * 1.5, cx, cz, 0.2), y0, y0 + rad * 0.9, shiftc(col, 0.97));
    addPrism(B, polyReg(6, rad, cx, cz, 0.2), y0 + rad * 0.9, y0 + h - rad * 1.1, col, { cap: false });
    addPrism(B, polyReg(6, rad * 1.45, cx, cz, 0.2), y0 + h - rad * 1.1, y0 + h, shiftc(col, 1.03));
    B.stats.columns++;
  }
  function addBattlements(B, poly, y0, h, size, col) {
    var c = polyCentroid(poly);
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      var n = Math.max(1, Math.round(len / (size * 2.1)));
      for (var j = 0; j < n; j++) {
        var u = (j + 0.5) / n;
        var mx = a[0] + (b[0] - a[0]) * u, mz = a[1] + (b[1] - a[1]) * u;
        var nx = mx - c[0], nz = mz - c[1];
        var L = Math.sqrt(nx * nx + nz * nz) || 1;
        mx -= (nx / L) * size * 0.35; mz -= (nz / L) * size * 0.35;
        addPrism(B, polyRect(size, size, mx, mz), y0, y0 + h, col);
      }
    }
  }
  function addTree(B, x, z, scale, kind) {
    var trunk = [96, 78, 60];
    var leaf = [76, 112, 84];
    addPrism(B, polyReg(5, 0.24 * scale, x, z), 0, 1.5 * scale, trunk, { cap: false });
    if (kind === 'cypress') {
      addPyramid(B, polyReg(7, 0.95 * scale, x, z), 1.0 * scale, 7.4 * scale, leaf);
    } else {
      addDome(B, x, z, 2.1 * scale, 1.4 * scale, 3.4 * scale, leaf, false, 10, 5);
      addDome(B, x, z, 2.1 * scale, 1.4 * scale, -1.1 * scale, shiftc(leaf, 0.8), false, 10, 3);
    }
  }
  function addFigure(B, x, z) {
    addPrism(B, polyRect(0.5, 0.32, x, z), 0, 1.42, [46, 50, 60], { cap: false });
    addDome(B, x, z, 0.19, 1.42, 0.3, [64, 60, 58], false, 8, 3);
  }

  /* ==========================================================
     7 — assemble the whole thing
     ========================================================== */
  function build(D) {
    var B = makeBuilder();
    var r = D.r;
    var wallC = D.wall.c, roofC = D.roofMat.c, trimC = D.trim;
    var glassC = [46, 56, 70];
    var stone = shiftc(wallC, 0.96);

    var footprint = D.plan === 'round' ? polyReg(20, D.R) : polyRect(D.W, D.Dp);

    var podH = 0;
    for (var s = 0; s < D.steps; s++) {
      var grow = (D.steps - s) * 0.95;
      addPrism(B, polyGrow(footprint, grow + 1.1), podH, podH + 0.34, shiftc(stone, 0.94 + s * 0.02));
      podH += 0.34;
    }
    var y0 = podH;
    var topY = y0;

    function block(poly, h, opt) {
      opt = opt || {};
      var b0 = opt.y0 === undefined ? y0 : opt.y0;
      addPrism(B, poly, b0, b0 + h, opt.col || wallC,
        { capKind: 'roof', capCol: opt.capCol || shiftc(wallC, 0.9) });
      B.shadows.push({ poly: poly, h: b0 + h });
    }

    var H = D.storeys * D.storeyH;

    if (D.style.k === 'classical') {
      var body = polyRect(D.W, D.Dp);
      block(body, H);
      wallOpenings(B, body, y0, {
        shape: D.winShape, storeys: D.storeys, storeyH: D.storeyH,
        spacing: D.W / D.bays, sill: D.storeyH * 0.26, hFrac: 0.82,
        wFrac: 0.5, trim: trimC, glass: glassC, lit: true
      });
      addPrism(B, polyGrow(body, 0.45), y0 + H, y0 + H + 0.55, trimC);
      var cornTop = y0 + H + 0.55;
      addGable(B, 0, 0, D.W + 0.9, D.Dp + 0.9, cornTop, D.W * 0.28, roofC, 0.5, true);
      topY = cornTop + D.W * 0.28;
      var colH = H + 0.55;
      var pz = D.Dp / 2 + 1.9;
      for (var i = 0; i < D.colCount; i++) {
        var u = D.colCount === 1 ? 0.5 : i / (D.colCount - 1);
        addColumn(B, -D.W / 2 + 0.9 + u * (D.W - 1.8), pz, 0.44, y0, colH, stone);
      }
      addPrism(B, polyRect(D.W, 3.2, 0, D.Dp / 2 + 1.2), y0 + colH, y0 + colH + 0.75, trimC);
      addGable(B, 0, D.Dp / 2 + 1.2, D.W, 3.2, y0 + colH + 0.75, D.W * 0.2, roofC, 0.35, true);
      B.shadows.push({ poly: polyRect(D.W, 3.2, 0, D.Dp / 2 + 1.2), h: y0 + colH });
      if (D.wings) {
        var ww = D.W * 0.42, wh = H * 0.7;
        [-1, 1].forEach(function (sgn) {
          var wp = polyRect(ww, D.Dp * 0.8, sgn * (D.W / 2 + ww / 2 - 0.4), 0);
          block(wp, wh);
          addHip(B, sgn * (D.W / 2 + ww / 2 - 0.4), 0, ww, D.Dp * 0.8, y0 + wh, ww * 0.3, roofC, 0.45);
          wallOpenings(B, wp, y0, {
            shape: D.winShape, storeys: 1, storeyH: wh, spacing: 3.2,
            sill: wh * 0.28, hFrac: 0.74, wFrac: 0.46,
            trim: trimC, glass: glassC, lit: true
          });
        });
      }
    } else if (D.style.k === 'rotunda') {
      var drum = polyReg(20, D.R);
      block(drum, D.storeyH);
      wallOpenings(B, drum, y0, {
        shape: 'round', storeys: 1, storeyH: D.storeyH, spacing: 1.6,
        sill: D.storeyH * 0.3, hFrac: 0.78, wFrac: 0.62, minLen: 1.0,
        trim: trimC, glass: glassC, lit: true
      });
      var pr = D.R + 2.4;
      for (var ci = 0; ci < D.colCount; ci++) {
        var ang = (ci / D.colCount) * Math.PI * 2;
        addColumn(B, Math.cos(ang) * pr, Math.sin(ang) * pr, 0.42, y0, D.storeyH * 0.94, stone);
      }
      addPrism(B, polyReg(24, pr + 0.75), y0 + D.storeyH * 0.94, y0 + D.storeyH * 0.94 + 0.7,
        trimC, { capCol: shiftc(roofC, 0.95) });
      var domeBase = y0 + D.storeyH * 0.94 + 0.7;
      addPrism(B, polyReg(20, D.R * 0.98), domeBase, domeBase + 1.0, trimC, { cap: false });
      addDome(B, 0, 0, D.R * 0.98, domeBase + 1.0, D.R * 1.05, roofC, false, 22, 10);
      var lanY = domeBase + 1.0 + D.R * 1.05;
      addPrism(B, polyReg(8, D.R * 0.2), lanY, lanY + D.R * 0.42, trimC, { cap: false });
      addDome(B, 0, 0, D.R * 0.2, lanY + D.R * 0.42, D.R * 0.26, roofC, true, 12, 6);
      addSpike(B, 0, 0, 0.12, lanY + D.R * 0.7, 1.5, shiftc(roofC, 1.15));
      topY = lanY + D.R * 0.7 + 1.5;
    } else if (D.style.k === 'gothic') {
      var nave = polyRect(D.W, D.Dp);
      block(nave, H);
      wallOpenings(B, nave, y0, {
        shape: 'pointed', storeys: 1, storeyH: H, spacing: D.Dp / (D.bays + 1),
        sill: H * 0.24, hFrac: 0.84, wFrac: 0.44, trim: trimC, glass: [48, 62, 82],
        lit: true, sides: [1, 3]
      });
      wallOpenings(B, nave, y0, {
        shape: 'pointed', storeys: 1, storeyH: H, spacing: D.W, sill: H * 0.3,
        hFrac: 0.8, wFrac: 0.55, trim: trimC, glass: [64, 58, 92], lit: true,
        sides: D.apse ? [] : [2]
      });
      addGable(B, 0, 0, D.W, D.Dp, y0 + H, D.W * 0.62, roofC, 0.55, true);
      topY = y0 + H + D.W * 0.62;
      if (D.buttresses) {
        var nb = Math.max(2, D.bays);
        for (var bi = 0; bi < nb; bi++) {
          var bz = -D.Dp / 2 + (bi + 0.5) * (D.Dp / nb);
          [-1, 1].forEach(function (sgn) {
            var bx = sgn * (D.W / 2 + 0.55);
            addPrism(B, polyRect(1.1, 1.1, bx, bz), y0, y0 + H * 0.62, shiftc(wallC, 0.97));
            addPrism(B, polyRect(0.8, 0.8, bx - sgn * 0.15, bz), y0 + H * 0.62, y0 + H * 0.82, shiftc(wallC, 0.97));
            addPyramid(B, polyRect(0.9, 0.9, bx - sgn * 0.15, bz), y0 + H * 0.82, y0 + H * 0.98, roofC);
          });
        }
      }
      if (D.tower) {
        var tw = D.towerW, tz = -D.Dp / 2 - tw / 2 + 0.4;
        var tp = polyRect(tw, tw, 0, tz);
        block(tp, D.towerH, { capCol: shiftc(wallC, 0.86) });
        wallOpenings(B, tp, y0 + D.towerH * 0.55, {
          shape: 'pointed', storeys: 1, storeyH: D.towerH * 0.4, spacing: tw,
          sill: 0.4, hFrac: 0.72, wFrac: 0.36, trim: trimC, glass: [40, 44, 54]
        });
        addPrism(B, polyGrow(tp, 0.35), y0 + D.towerH, y0 + D.towerH + 0.5, trimC);
        var oct = polyReg(8, tw * 0.62, 0, tz, Math.PI / 8);
        addPrism(B, oct, y0 + D.towerH + 0.5, y0 + D.towerH + 1.4, shiftc(wallC, 0.98));
        addPyramid(B, oct, y0 + D.towerH + 1.4, y0 + D.towerH + 1.4 + D.spireH, roofC);
        addSpike(B, 0, tz, 0.1, y0 + D.towerH + 1.4 + D.spireH, 1.1, shiftc(roofC, 1.2));
        topY = Math.max(topY, y0 + D.towerH + 2.5 + D.spireH);
        B.shadows.push({ poly: tp, h: y0 + D.towerH + D.spireH });
      }
      if (D.apse) {
        var ap = polyReg(12, D.W * 0.46, 0, D.Dp / 2 + D.W * 0.2);
        block(ap, H * 0.8);
        addPyramid(B, polyGrow(ap, 0.4), y0 + H * 0.8, y0 + H * 0.8 + D.W * 0.34, roofC);
      }
    } else if (D.style.k === 'moorish') {
      var cube = polyRect(D.W, D.Dp);
      block(cube, H);
      wallOpenings(B, cube, y0, {
        shape: 'round', storeys: 1, storeyH: D.storeyH, spacing: D.W / D.bays,
        sill: 0.25, hFrac: 0.88, wFrac: 0.66, trim: trimC, glass: [38, 46, 58], lit: true
      });
      if (D.storeys > 1) {
        wallOpenings(B, cube, y0 + D.storeyH, {
          shape: 'round', storeys: D.storeys - 1, storeyH: D.storeyH,
          spacing: D.W / D.bays, sill: D.storeyH * 0.3, hFrac: 0.74, wFrac: 0.4,
          trim: trimC, glass: glassC, lit: true
        });
      }
      addPrism(B, polyGrow(cube, 0.5), y0 + H, y0 + H + 0.5, trimC);
      var parY = y0 + H + 0.5;
      if (D.parapet) addBattlements(B, polyGrow(cube, 0.3), parY, 0.75, 0.55, trimC);
      addPrism(B, polyReg(8, D.W * 0.26, 0, 0, Math.PI / 8), parY, parY + D.W * 0.16, shiftc(wallC, 1.02));
      addDome(B, 0, 0, D.W * 0.26, parY + D.W * 0.16, D.W * 0.42, roofC, true, 22, 11);
      addSpike(B, 0, 0, 0.14, parY + D.W * 0.16 + D.W * 0.42, 1.4, shiftc(roofC, 1.15));
      topY = parY + D.W * 0.16 + D.W * 0.42 + 1.4;
      if (D.kiosks) {
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
          var kx = q[0] * (D.W / 2 - 0.9), kz = q[1] * (D.Dp / 2 - 0.9);
          addPrism(B, polyReg(8, 1.15, kx, kz, Math.PI / 8), parY, parY + 1.6, shiftc(wallC, 1.03), { cap: false });
          addDome(B, kx, kz, 1.15, parY + 1.6, 2.2, roofC, true, 14, 7);
          addSpike(B, kx, kz, 0.08, parY + 3.8, 0.7, shiftc(roofC, 1.15));
        });
      }
    } else if (D.style.k === 'pagoda') {
      var cy = y0, wCur = D.W;
      for (var ti2 = 0; ti2 < D.tiers; ti2++) {
        var tp2 = polyRect(wCur, wCur);
        block(tp2, D.storeyH, { y0: cy });
        wallOpenings(B, tp2, cy, {
          shape: 'rect', storeys: 1, storeyH: D.storeyH, spacing: wCur / 3,
          sill: D.storeyH * 0.26, hFrac: 0.72, wFrac: 0.5,
          trim: trimC, glass: glassC, lit: true
        });
        var eaveY = cy + D.storeyH;
        var over = wCur * 0.34;
        addPrism(B, polyRect(wCur + over * 2, wCur + over * 2), eaveY, eaveY + 0.28,
          shiftc(roofC, 0.88), { cap: false });
        addHip(B, 0, 0, wCur + over * 2, wCur + over * 2, eaveY + 0.28, wCur * 0.26, roofC, 0);
        cy = eaveY + 0.28 + wCur * 0.18;
        wCur *= 0.82;
      }
      topY = cy;
      if (D.mast) {
        addPrism(B, polyReg(6, 0.16), topY, topY + D.W * 0.34, shiftc(roofC, 1.1), { cap: false });
        for (var ringI = 0; ringI < 4; ringI++) {
          addPrism(B, polyReg(10, 0.42 - ringI * 0.07),
            topY + D.W * 0.06 + ringI * D.W * 0.06,
            topY + D.W * 0.06 + ringI * D.W * 0.06 + 0.1,
            shiftc(roofC, 1.2), { cap: false });
        }
        addSpike(B, 0, 0, 0.1, topY + D.W * 0.34, 0.9, shiftc(roofC, 1.25));
        topY += D.W * 0.34 + 0.9;
      }
    } else if (D.style.k === 'keep') {
      var keep = polyRect(D.W, D.Dp);
      block(keep, H, { capCol: shiftc(wallC, 0.82) });
      wallOpenings(B, keep, y0, {
        shape: 'rect', storeys: D.storeys, storeyH: D.storeyH, spacing: D.W / 3,
        sill: D.storeyH * 0.35, hFrac: 0.78, wFrac: 0.12,
        trim: shiftc(wallC, 0.8), glass: [30, 32, 40], lit: true
      });
      addPrism(B, polyGrow(keep, 0.45), y0 + H, y0 + H + 0.45, shiftc(wallC, 1.04));
      var battY = y0 + H + 0.45;
      addBattlements(B, polyGrow(keep, 0.25), battY, 1.1, 0.85, shiftc(wallC, 1.02));
      topY = battY + 1.1;
      if (D.turrets) {
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
          var tx = q[0] * (D.W / 2), tz = q[1] * (D.Dp / 2);
          var trp = polyReg(10, 1.7, tx, tz);
          addPrism(B, trp, y0, y0 + H + 2.6, shiftc(wallC, 1.03), { cap: false });
          addPrism(B, polyReg(10, 2.0, tx, tz), y0 + H + 2.6, y0 + H + 3.0, shiftc(wallC, 1.06));
          addBattlements(B, polyReg(10, 1.85, tx, tz), y0 + H + 3.0, 0.85, 0.6, shiftc(wallC, 1.02));
          addPyramid(B, polyReg(10, 1.7, tx, tz), y0 + H + 3.0, y0 + H + 6.4, roofC);
          B.shadows.push({ poly: trp, h: y0 + H + 6.4 });
        });
        topY = Math.max(topY, y0 + H + 6.4);
      }
      if (D.forebuilding) {
        var fb = polyRect(D.W * 0.36, 3.4, 0, D.Dp / 2 + 1.7);
        block(fb, D.storeyH * 1.4);
        addBattlements(B, polyGrow(fb, 0.2), y0 + D.storeyH * 1.4, 0.8, 0.55, shiftc(wallC, 1.02));
        wallOpenings(B, fb, y0, {
          shape: 'pointed', storeys: 1, storeyH: D.storeyH * 1.2, spacing: 9,
          sill: 0.1, hFrac: 0.8, wFrac: 0.42, trim: trimC, glass: [26, 28, 34], sides: [2]
        });
      }
    } else if (D.style.k === 'brutalist') {
      var cy2 = y0, cw = D.W, cd = D.Dp;
      for (var si = 0; si < D.slabs; si++) {
        var ox = (si % 2 === 0 ? -1 : 1) * cw * rr(r, 0.06, 0.16);
        var oz = (si % 3 === 0 ? 1 : -1) * cd * rr(r, 0.04, 0.14);
        var sp = polyRect(cw, cd, ox, oz);
        block(sp, D.storeyH, { y0: cy2, capCol: shiftc(wallC, 0.86) });
        wallOpenings(B, sp, cy2, {
          shape: 'rect', storeys: 1, storeyH: D.storeyH, spacing: 999,
          sill: D.storeyH * 0.42, hFrac: 0.78, wFrac: 0.82,
          trim: shiftc(wallC, 0.78), glass: [34, 40, 50], lit: true
        });
        cy2 += D.storeyH;
        cw *= rr(r, 0.82, 0.97);
        cd *= rr(r, 0.86, 1.06);
      }
      topY = cy2;
      if (D.core) {
        var core = polyRect(D.W * 0.26, D.Dp * 0.3, -D.W * 0.18, -D.Dp * 0.12);
        addPrism(B, core, y0, topY + D.storeyH * 1.4, shiftc(wallC, 1.05));
        B.shadows.push({ poly: core, h: topY + D.storeyH * 1.4 });
        topY += D.storeyH * 1.4;
      }
      addPrism(B, polyGrow(polyRect(cw, cd), 0.3), topY, topY + 0.35, shiftc(wallC, 0.92));
    }

    /* how big is it, for framing the camera — the building only */
    var maxR = 0, maxY = 0;
    for (var i2 = 0; i2 < B.faces.length; i2++) {
      var p = B.faces[i2].p;
      for (var j2 = 0; j2 < p.length; j2++) {
        var d2 = Math.sqrt(p[j2][0] * p[j2][0] + p[j2][2] * p[j2][2]);
        if (d2 > maxR) maxR = d2;
        if (p[j2][1] > maxY) maxY = p[j2][1];
      }
    }

    /* plaza, turf, planting, people */
    var extent = Math.max(maxR, 8);
    var plazaR = extent * 1.05 + 4;
    B.gface(polyReg(40, plazaR * 1.75).map(function (p) { return [p[0], -0.05, p[1]]; }),
      [64, 82, 66], 'turf');
    B.gface(polyReg(32, plazaR).map(function (p) { return [p[0], 0, p[1]]; }),
      [122, 118, 108], 'plaza');

    B.tag = 'tree';
    for (var ti = 0; ti < D.trees; ti++) {
      var ta = rr(r, 0, Math.PI * 2), tr = rr(r, plazaR * 0.95, plazaR * 1.5);
      addTree(B, Math.cos(ta) * tr, Math.sin(ta) * tr, rr(r, 0.8, 1.35),
        chance(r, 0.45) ? 'cypress' : 'round');
    }
    B.tag = 'fig';
    if (D.figures) {
      var fn = ri(r, 3, 5);
      for (var fi = 0; fi < fn; fi++) {
        var fa = rr(r, 0, Math.PI * 2), fr = rr(r, extent * 0.66, plazaR * 0.92);
        addFigure(B, Math.cos(fa) * fr, Math.sin(fa) * fr);
      }
    }
    B.tag = null;

    B.bbox = { r: maxR, top: maxY, plaza: plazaR };
    B.height = topY;
    B.stats.faces = B.faces.length;
    return B;
  }

  /* ==========================================================
     8 — the page
     ========================================================== */
  var canvas = document.getElementById('folly');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var D = null, MODEL = null;
  var cam = { yaw: -0.62, pitch: 0.30, dist: 60, f: 900, ty: 6, zoom: 1 };
  var finish = 'solid';
  var spin = !reduce;
  var showFigures = true;
  var hour = 15;
  var W = 960, H = 620, DPR = 1;
  var dirty = true;
  var stars = null;

  function $(id) { return document.getElementById(id); }

  function frame() {
    if (!MODEL) return;
    cam.f = W * 1.5;
    /* keep the whole thing on the canvas: width and height both have to fit */
    var need = Math.max(MODEL.bbox.r * 4.2, MODEL.bbox.top * 3.4, 34);
    cam.dist = need / cam.zoom;
    cam.ty = MODEL.bbox.top * 0.42;
  }

  function resize() {
    var cw = canvas.clientWidth || 960;
    var ch = Math.round(cw * 620 / 960);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * DPR);
    canvas.height = Math.round(ch * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    W = cw; H = ch;
    frame();
    dirty = true;
  }

  /* --- light ---------------------------------------------------- */
  function sunFor(h) {
    var t = (h - 5.2) / 13.6;
    var tc = Math.max(0, Math.min(1, t));
    var el = Math.sin(tc * Math.PI) * 1.05 - 0.06;
    if (h < 5.2 || h > 18.8) el = -0.25;
    var az = -1.9 + tc * 3.3;
    var ce = Math.cos(el);
    return {
      dir: [ce * Math.sin(az), Math.max(0.04, Math.sin(el)), ce * Math.cos(az)],
      el: el,
      night: el < 0.02
    };
  }
  function skyStops(h) {
    if (h < 5.6) return [[10, 12, 24], [26, 24, 44]];
    if (h < 7.2) return [[36, 40, 78], [190, 128, 104]];
    if (h < 9) return [[92, 128, 176], [214, 192, 168]];
    if (h < 16.5) return [[74, 118, 174], [176, 200, 220]];
    if (h < 18.3) return [[96, 112, 168], [226, 156, 106]];
    if (h < 19.6) return [[42, 48, 92], [196, 108, 92]];
    return [[8, 10, 22], [22, 26, 46]];
  }
  function lightRig(h) {
    var s = sunFor(h);
    var warm = h < 8 || h > 16.5;
    var sunCol = s.night ? [0.16, 0.19, 0.30]
      : warm ? [0.95, 0.72, 0.48] : [0.98, 0.94, 0.84];
    var ambCol = s.night ? [0.12, 0.14, 0.22]
      : warm ? [0.36, 0.36, 0.44] : [0.42, 0.45, 0.52];
    return { sun: s.dir, night: s.night, sunCol: sunCol, ambCol: ambCol, el: s.el };
  }

  /* --- projection ---------------------------------------------- */
  var cy_, sy_, cp_, sp_;
  function setCam() {
    cy_ = Math.cos(cam.yaw); sy_ = Math.sin(cam.yaw);
    cp_ = Math.cos(cam.pitch); sp_ = Math.sin(cam.pitch);
  }
  function rot(x, y, z) {
    var x1 = x * cy_ - z * sy_, z1 = x * sy_ + z * cy_;
    var y2 = y * cp_ - z1 * sp_, z2 = y * sp_ + z1 * cp_;
    return [x1, y2, z2];
  }
  function view(p) {
    var v = rot(p[0], p[1] - cam.ty, p[2]);
    return [v[0], v[1], v[2] + cam.dist];
  }
  function screenOf(v) {
    var k = cam.f / Math.max(0.4, v[2]);
    return [W / 2 + v[0] * k, H * 0.58 - v[1] * k];
  }

  var NEAR = 0.8;
  function project(f) {
    var vs = [], i;
    for (i = 0; i < f.p.length; i++) vs.push(view(f.p[i]));
    var any = false, all = true;
    for (i = 0; i < vs.length; i++) {
      if (vs[i][2] >= NEAR) any = true; else all = false;
    }
    if (!any) return null;
    if (!all) {
      /* clip against the near plane so nothing tears when you move in close */
      var out = [];
      for (i = 0; i < vs.length; i++) {
        var a = vs[i], b = vs[(i + 1) % vs.length];
        var ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) {
          var t = (NEAR - a[2]) / (b[2] - a[2]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
        }
      }
      vs = out;
      if (vs.length < 3) return null;
    }
    var pts2 = [], zsum = 0;
    for (i = 0; i < vs.length; i++) { zsum += vs[i][2]; pts2.push(screenOf(vs[i])); }
    return { s: pts2, z: zsum / vs.length };
  }

  /* --- draw ----------------------------------------------------- */
  function css(c) {
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }
  function shadeFace(f, rig) {
    var n = f.n;
    var d = Math.max(0, n[0] * rig.sun[0] + n[1] * rig.sun[1] + n[2] * rig.sun[2]);
    var up = Math.max(0, n[1]) * 0.18;
    var base = f.c;
    if (finish === 'card') {
      base = (f.k === 'turf' || f.k === 'plaza') ? [120, 118, 112] : [232, 229, 222];
    }
    return [base[0] * (rig.ambCol[0] + up * 0.3 + d * rig.sunCol[0]),
            base[1] * (rig.ambCol[1] + up * 0.3 + d * rig.sunCol[1]),
            base[2] * (rig.ambCol[2] + up * 0.34 + d * rig.sunCol[2])];
  }

  function drawSky(rig) {
    var st = skyStops(hour);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(st[0]));
    g.addColorStop(1, css(st[1]));
    ctx.fillStyle = finish === 'blue' ? '#08182f'
      : finish === 'card' ? '#14161c' : g;
    ctx.fillRect(0, 0, W, H);
    if (finish === 'solid' && rig.night) {
      if (!stars) {
        stars = [];
        var sr = rng(0x51a4c1);
        for (var i = 0; i < 90; i++) stars.push([sr(), sr() * 0.62, sr()]);
      }
      ctx.fillStyle = '#dfe7f5';
      for (var j = 0; j < stars.length; j++) {
        ctx.globalAlpha = 0.25 + stars[j][2] * 0.6;
        ctx.fillRect(stars[j][0] * W, stars[j][1] * H, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPolyPath(pts2) {
    ctx.beginPath();
    ctx.moveTo(pts2[0][0], pts2[0][1]);
    for (var i = 1; i < pts2.length; i++) ctx.lineTo(pts2[i][0], pts2[i][1]);
    ctx.closePath();
  }

  function drawShadows(rig) {
    if (rig.night || rig.el < 0.06 || finish === 'blue') return;
    var sun = rig.sun;
    if (sun[1] < 0.12) return;
    ctx.save();
    ctx.globalAlpha = finish === 'card' ? 0.20 : 0.26;
    ctx.fillStyle = finish === 'card' ? '#000000' : '#0a1410';
    ctx.beginPath();
    for (var i = 0; i < MODEL.shadows.length; i++) {
      var sh = MODEL.shadows[i];
      var ox = -(sun[0] / sun[1]) * sh.h, oz = -(sun[2] / sun[1]) * sh.h;
      var poly = sh.poly;
      var subs = [];
      subs.push(poly.map(function (p) { return [p[0], 0.02, p[1]]; }));
      subs.push(poly.map(function (p) { return [p[0] + ox, 0.02, p[1] + oz]; }));
      for (var j = 0; j < poly.length; j++) {
        var a = poly[j], b = poly[(j + 1) % poly.length];
        subs.push([[a[0], 0.02, a[1]], [b[0], 0.02, b[1]],
                   [b[0] + ox, 0.02, b[1] + oz], [a[0] + ox, 0.02, a[1] + oz]]);
      }
      for (var s = 0; s < subs.length; s++) {
        var pr = project({ p: subs[s] });
        if (!pr) continue;
        var pts2 = pr.s, area = 0;
        for (var k = 0; k < pts2.length; k++) {
          var p1 = pts2[k], p2 = pts2[(k + 1) % pts2.length];
          area += p1[0] * p2[1] - p2[0] * p1[1];
        }
        if (area < 0) pts2 = pts2.slice().reverse();
        ctx.moveTo(pts2[0][0], pts2[0][1]);
        for (var m = 1; m < pts2.length; m++) ctx.lineTo(pts2[m][0], pts2[m][1]);
        ctx.closePath();
      }
    }
    ctx.fill('nonzero');
    ctx.restore();
  }

  function paint(list, rig, cull, keepOrder) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (!showFigures && f.k === 'fig') continue;
      var pr = project(f);
      if (!pr) continue;
      if (cull) {
        var nv = rot(f.n[0], f.n[1], f.n[2]);
        var c = view(centroid3(f.p));
        if (nv[0] * c[0] + nv[1] * c[1] + nv[2] * c[2] >= 0) continue;
      }
      pr.f = f;
      out.push(pr);
    }
    if (!keepOrder) out.sort(function (a, b) { return b.z - a.z; });
    for (var j = 0; j < out.length; j++) {
      var it = out[j], fc = it.f, col;
      if (finish === 'blue') {
        drawPolyPath(it.s);
        ctx.fillStyle = '#0b1f3a';
        ctx.fill();
        ctx.strokeStyle = fc.k === 'glass' ? 'rgba(120,220,255,.75)' : 'rgba(150,205,255,.5)';
        ctx.lineWidth = fc.k === 'roof' ? 0.9 : 0.7;
        ctx.stroke();
        continue;
      }
      if (fc.k === 'glass' && fc.g && rig.night) {
        col = [255, 206, 138];
      } else if (fc.k === 'glass') {
        col = mixc(shadeFace(fc, rig), [120, 150, 180], rig.night ? 0.05 : 0.22);
      } else {
        col = shadeFace(fc, rig);
      }
      drawPolyPath(it.s);
      ctx.fillStyle = css(col);
      ctx.fill();
      ctx.strokeStyle = css(shiftc(col, finish === 'card' ? 0.78 : 0.84));
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  function render() {
    if (!MODEL) return;
    setCam();
    var rig = lightRig(hour);
    drawSky(rig);
    /* the ground is two flat layers: draw them in the order they were laid,
       not by depth, or the turf paints over the plaza it sits under */
    paint(MODEL.ground, rig, false, true);
    drawShadows(rig);
    paint(MODEL.faces, rig, true);
  }

  function loop() {
    if (spin) { cam.yaw += 0.0034; dirty = true; }
    if (dirty) { render(); dirty = false; }
    requestAnimationFrame(loop);
  }

  /* --- copy ----------------------------------------------------- */
  function metres(n) { return n.toFixed(1) + ' m'; }
  function feet(n) { return Math.round(n * 3.2808) + ' ft'; }

  function featureList(d) {
    var f = [];
    if (d.portico) f.push('a portico of ' + d.colCount + ' columns');
    if (d.style.k === 'rotunda') f.push('a peristyle of ' + d.colCount + ' columns');
    if (d.wings) f.push('two flanking wings');
    if (d.tower) f.push('a west tower and spire');
    if (d.buttresses) f.push('stepped buttresses');
    if (d.apse) f.push('an apse');
    if (d.arcade) f.push('an arcaded ground floor');
    if (d.kiosks) f.push('four corner kiosks');
    if (d.parapet) f.push('a crenellated parapet');
    if (d.lantern) f.push('a lantern');
    if (d.battlements) f.push('battlements');
    if (d.turrets) f.push('four corner turrets');
    if (d.forebuilding) f.push('a forebuilding');
    if (d.mast) f.push('a ringed finial mast');
    if (d.core) f.push('an exposed stair core');
    if (!f.length) f.push('no ornament of any kind');
    return f;
  }

  function describe(d, model) {
    var f = featureList(d);
    var list = f.length > 1
      ? f.slice(0, -1).join(', ') + ' and ' + f[f.length - 1]
      : f[0];
    return {
      lead: d.name + ' was put up ' + d.ground + ' by ' + d.patron +
        ', begun in ' + d.begun + ' and finished in ' + d.built + ', ' + d.purpose + '.',
      body: 'It is ' + d.style.name.toLowerCase() + ': ' +
        (d.storeys === 1 ? 'a single storey' : d.storeys + ' storeys') + ' of ' +
        d.wall.name.toLowerCase() + ' under ' + d.roofMat.name.toLowerCase() +
        ', with ' + list + '. It stands ' + metres(model.height) +
        ' (' + feet(model.height) + ') to the finial.',
      fate: d.fate
    };
  }

  function plaqueHTML(d, model) {
    var t = describe(d, model);
    return '<div class="seed-num">' + d.name + '</div>' +
      '<p class="card-lead">' + t.lead + '</p>' +
      '<p class="card-lead">' + t.body + '</p>' +
      '<p class="card-note"><b>Since:</b> ' + t.fate + '</p>';
  }

  var PLANNAMES = {
    rect: 'Rectangular', round: 'Circular',
    tier: 'Square, tiered', stack: 'Stacked slabs'
  };
  var ROOFNAMES = {
    gable: 'gabled', hip: 'hipped', dome: 'domed',
    onion: 'onion dome', flat: 'flat', tiered: 'tiered eaves'
  };

  function specHTML(d, model) {
    var rows = [
      ['Idiom', d.style.name],
      ['Plan', PLANNAMES[d.plan] || 'Rectangular'],
      ['Storeys', d.plan === 'tier' ? d.tiers + ' tiers' : String(d.storeys)],
      ['Height', metres(model.height) + '  (' + feet(model.height) + ')'],
      ['Footprint', d.plan === 'round'
        ? 'circle, ' + metres(d.R * 2) + ' across'
        : metres(d.W) + ' × ' + metres(d.Dp || d.W)],
      ['Walling', d.wall.name],
      ['Roof', d.roofMat.name + ', ' + (ROOFNAMES[d.roofType] || 'gabled')],
      ['Openings', String(model.stats.openings)],
      ['Columns', String(model.stats.columns)],
      ['Surfaces drawn', String(model.stats.faces)]
    ];
    var h = '<table><tbody>';
    for (var i = 0; i < rows.length; i++) {
      h += '<tr><th>' + rows[i][0] + '</th><td><b>' + rows[i][1] + '</b></td></tr>';
    }
    return h + '</tbody></table>';
  }

  /* --- wiring --------------------------------------------------- */
  function load(seed) {
    D = makeDesign(seed);
    MODEL = build(D);
    frame();
    dirty = true;
    var p = $('plaque'); if (p) p.innerHTML = plaqueHTML(D, MODEL);
    var sp = $('spec'); if (sp) sp.innerHTML = specHTML(D, MODEL);
    var so = $('seedOut'); if (so) so.textContent = String(seed).padStart(10, '0');
    var st = $('styleOut'); if (st) st.textContent = D.style.name;
    var ho = $('heightOut'); if (ho) ho.textContent = metres(MODEL.height);
  }

  function chipRow(el, items, current, onPick) {
    if (!el) return;
    el.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (it.k === current ? ' on' : '');
      b.textContent = it.name;
      b.addEventListener('click', function () {
        var kids = el.querySelectorAll('.chip');
        for (var i = 0; i < kids.length; i++) kids[i].className = 'chip';
        b.className = 'chip on';
        onPick(it.k);
      });
      el.appendChild(b);
    });
  }

  chipRow($('finishes'), [
    { k: 'solid', name: 'As built' },
    { k: 'card', name: 'Card model' },
    { k: 'blue', name: 'Blueprint' }
  ], 'solid', function (k) { finish = k; dirty = true; });

  function clockText(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { mm = 0; hh += 1; }
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  var lightEl = $('light');
  if (lightEl) {
    var now = new Date();
    var nowH = now.getHours() + now.getMinutes() / 60;
    if (nowH < 5) nowH = 5;
    if (nowH > 22.5) nowH = 22.5;
    hour = nowH;
    lightEl.value = String(Math.round(nowH * 10) / 10);
    var lo0 = $('lightOut');
    if (lo0) lo0.textContent = clockText(hour);
    lightEl.addEventListener('input', function () {
      hour = parseFloat(lightEl.value);
      var lo = $('lightOut');
      if (lo) lo.textContent = clockText(hour);
      dirty = true;
    });
  }

  function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }
  wire('btnSpin', function () {
    spin = !spin;
    this.textContent = spin ? 'Stop turning' : 'Turn it';
    this.className = 'chip' + (spin ? ' on' : '');
    dirty = true;
  });
  wire('btnFigures', function () {
    showFigures = !showFigures;
    this.textContent = showFigures ? 'Hide figures' : 'Show figures';
    this.className = 'chip' + (showFigures ? ' on' : '');
    dirty = true;
  });
  wire('btnNew', function () { load((Math.random() * 4294967295) >>> 0); });
  wire('btnToday', function () { load(seedForToday()); });

  /* orbit */
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY };
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    cam.yaw += (e.clientX - drag.x) * 0.008;
    cam.pitch += (e.clientY - drag.y) * 0.005;
    cam.pitch = Math.max(0.02, Math.min(1.25, cam.pitch));
    drag.x = e.clientX; drag.y = e.clientY;
    dirty = true;
  });
  function endDrag() { drag = null; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.zoom *= e.deltaY > 0 ? 0.92 : 1.087;
    cam.zoom = Math.max(0.45, Math.min(3.2, cam.zoom));
    frame();
    dirty = true;
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      spin = !spin;
      var b = $('btnSpin');
      if (b) {
        b.textContent = spin ? 'Stop turning' : 'Turn it';
        b.className = 'chip' + (spin ? ' on' : '');
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') { cam.yaw -= 0.09; dirty = true; }
    else if (e.key === 'ArrowRight') { cam.yaw += 0.09; dirty = true; }
    else if (e.key === 'ArrowUp') { cam.pitch = Math.min(1.25, cam.pitch + 0.05); dirty = true; }
    else if (e.key === 'ArrowDown') { cam.pitch = Math.max(0.02, cam.pitch - 0.05); dirty = true; }
  });

  window.addEventListener('resize', resize);

  load(seedForToday());
  resize();
  if (reduce) {
    var sb = $('btnSpin');
    if (sb) { sb.textContent = 'Turn it'; sb.className = 'chip'; }
  }
  loop();
})();
