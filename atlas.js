/* experiment.quibo.games — The Atlas
   A whole world generated from today's date: height, water, weather, biomes,
   rivers, regions, towns and the roads between them. No dependencies. */
(function () {
  'use strict';

  /* ================= seeded randomness ================= */
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

  function makeNoise(rand) {
    var N = 256, g = new Float32Array(N * N), i;
    for (i = 0; i < g.length; i++) g[i] = rand();
    function at(x, y) { return g[((y & (N - 1)) * N) + (x & (N - 1))]; }
    function sm(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = sm(x - xi), yf = sm(y - yi);
      var a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      var t = a + (b - a) * xf, u = c + (d - c) * xf;
      return t + (u - t) * yf;
    };
  }

  function fbm(n, x, y, oct) {
    var s = 0, amp = 1, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) { s += n(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }
  function ridged(n, x, y, oct) {
    var s = 0, amp = 1, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) {
      var v = 1 - Math.abs(n(x * f, y * f) * 2 - 1);
      s += v * v * amp; norm += amp; amp *= 0.5; f *= 2;
    }
    return s / norm;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ================= naming ================= */
  var ONSET = ['b', 'br', 'c', 'ch', 'd', 'dr', 'f', 'g', 'gl', 'gr', 'h', 'k', 'kr', 'l',
    'm', 'n', 'p', 'pr', 'r', 's', 'sh', 'sk', 'sl', 'st', 't', 'th', 'tr', 'v', 'w'];
  var VOWEL = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'o',
    'ae', 'ai', 'au', 'ea', 'ee', 'ei', 'ia', 'ie', 'oa', 'oo', 'ou', 'y'];
  var CODA = ['', '', 'n', 'r', 'l', 'm', 's', 'th', 'ng', 'ck', 'ld', 'rn', 'st', 'sk', 'ft', 'rk'];
  var SIMPLE = ['b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'r', 's', 't', 'v', 'w', 'th', 'sh'];
  var SUFFIX = ['holm', 'ford', 'mere', 'gate', 'wick', 'bury', 'fell', 'moor', 'stead',
    'haven', 'cross', 'reach', 'barrow', 'marsh', 'ness', 'combe', 'thorpe', 'dale',
    'keep', 'hollow', 'bridge', 'stow', 'garth', 'weir'];

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function makeNamer(rand) {
    var used = {};
    function pick(a) { return a[Math.floor(rand() * a.length)]; }
    function syll(light) {
      var o = light ? pick(SIMPLE) : pick(ONSET);
      var v = pick(VOWEL);
      var c = pick(CODA);
      if (v.length > 1 && c.length > 1) c = c.charAt(0);
      if (light && c.length > 1) c = c.charAt(0);
      return o + v + c;
    }
    function stem() {
      var s = syll(false);
      if (rand() < 0.5) s += syll(true);
      return s.replace(/([a-z])\1\1+/g, '$1$1');
    }
    return {
      pick: pick,
      place: function () {
        for (var tries = 0; tries < 40; tries++) {
          var s = stem();
          var n = cap(s);
          if (s.length <= 6 && rand() < 0.6) n += pick(SUFFIX);
          if (n.length > 4 && n.length < 13 && !used[n]) { used[n] = 1; return n; }
        }
        return cap(stem()) + pick(SUFFIX);
      },
      bare: function () {
        for (var tries = 0; tries < 20; tries++) {
          var n = cap(stem());
          if (n.length > 3 && n.length < 11 && !used[n]) { used[n] = 1; return n; }
        }
        return cap(stem());
      }
    };
  }

  var REGION_PATTERNS = [
    function (n, r) { return 'The ' + n + ' March'; },
    function (n, r) { return n + ' Weald'; },
    function (n, r) { return 'Upper ' + n; },
    function (n, r) { return 'Lower ' + n; },
    function (n, r) { return 'The Hundred of ' + n; },
    function (n, r) { return n + ' Vale'; },
    function (n, r) { return 'The ' + n + ' Reach'; },
    function (n, r) { return n + ' Downs'; },
    function (n, r) { return 'Old ' + n; },
    function (n, r) { return 'The ' + n + ' Wold'; }
  ];

  var SEA_ADJ = ['Grey', 'Slow', 'Sunken', 'Bitter', 'Quiet', 'Long', 'Iron', 'Glass',
    'Cold', 'Wandering', 'Patient', 'Salt'];
  var TRADES = ['salt', 'wool', 'tin', 'glass', 'amber', 'rope', 'smoked eel', 'peat',
    'iron', 'cider', 'dye', 'vellum', 'copper', 'beeswax', 'lamp oil', 'blue clay',
    'dried figs', 'boat nails', 'charcoal', 'goat cheese'];
  var QUIRKS = [
    'the bells are rung backwards on the shortest day',
    'nobody there will say the name of the previous mayor',
    'every roof is the same shade of green, by law',
    'the market opens at dusk and closes at dawn',
    'the bridge has been half-finished for sixty years',
    'they keep a cat on the payroll of the harbour office',
    'the well at the centre is older than the town around it',
    'letters are delivered by boat even to the inland houses',
    'the town clock runs four minutes fast, deliberately',
    'strangers are given bread before they are given directions',
    'the walls were built from a shipwreck',
    'the whole place smells faintly of woodsmoke and vinegar',
    'they hold a funeral for the last fire of winter',
    'there are more chimneys than there are households'
  ];

  /* ================= biomes ================= */
  var BIOMES = {
    deep:    { name: 'Deep water',       col: [8, 20, 36] },
    ocean:   { name: 'Open sea',         col: [14, 38, 64] },
    shelf:   { name: 'Shelf water',      col: [23, 66, 104] },
    shallow: { name: 'Shallows',         col: [42, 104, 142] },
    lake:    { name: 'Lake',             col: [34, 92, 134] },
    beach:   { name: 'Sand',             col: [199, 180, 133] },
    marsh:   { name: 'Saltmarsh',        col: [110, 124, 92] },
    desert:  { name: 'Desert',           col: [201, 176, 114] },
    steppe:  { name: 'Steppe',           col: [168, 164, 104] },
    savanna: { name: 'Savanna',          col: [176, 154, 79] },
    grass:   { name: 'Grassland',        col: [127, 160, 90] },
    forest:  { name: 'Broadleaf forest', col: [63, 116, 68] },
    jungle:  { name: 'Rainforest',       col: [42, 122, 74] },
    boreal:  { name: 'Boreal forest',    col: [47, 93, 74] },
    moor:    { name: 'Moorland',         col: [109, 122, 92] },
    tundra:  { name: 'Tundra',           col: [138, 145, 132] },
    scree:   { name: 'Bare rock',        col: [125, 117, 102] },
    snow:    { name: 'Snowcap',          col: [232, 238, 240] }
  };
  var HABIT = {
    beach: 0.7, marsh: 0.2, desert: 0.05, steppe: 0.5, savanna: 0.45, grass: 1.0,
    forest: 0.8, jungle: 0.35, boreal: 0.45, moor: 0.4, tundra: 0.1, scree: 0.05, snow: 0
  };

  /* ================= grid ================= */
  var GW = 240, GH = 160, CELL = 4;
  var CW = GW * CELL, CH = GH * CELL;
  var IDX = function (x, y) { return y * GW + x; };

  /* ================= terrain (seed only) ================= */
  function makeTerrain(seed) {
    var rand = rng(seed);
    var n1 = makeNoise(rand), n2 = makeNoise(rand), n3 = makeNoise(rand), n4 = makeNoise(rand);
    var AX = GW / GH;

    var blobs = [{ x: AX / 2, y: 0.5, r: 0.44 + rand() * 0.1, w: 1 }];
    var extra = 1 + Math.floor(rand() * 3);
    for (var b = 0; b < extra; b++) {
      blobs.push({
        x: 0.25 + rand() * (AX - 0.5),
        y: 0.2 + rand() * 0.6,
        r: 0.09 + rand() * 0.17,
        w: 0.55 + rand() * 0.5
      });
    }

    var warp = 0.18 + rand() * 0.3;
    var fs = 2.3 + rand() * 2.4;
    var rmix = 0.2 + rand() * 0.5;
    var landTarget = 0.22 + rand() * 0.26;
    var relief = 1900 + Math.round(rand() * 2900);

    var h = new Float32Array(GW * GH);
    var min = Infinity, max = -Infinity;
    for (var y = 0; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var nx = x / GH, ny = y / GH;
        var px = nx + (fbm(n3, nx * 2.6 + 5, ny * 2.6 + 9, 3) - 0.5) * warp;
        var py = ny + (fbm(n4, nx * 2.6 + 21, ny * 2.6 + 3, 3) - 0.5) * warp;

        var mask = 0;
        for (var i = 0; i < blobs.length; i++) {
          var B = blobs[i];
          var dx = px - B.x, dy = py - B.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var m = B.w * (1 - smoothstep(B.r * 0.3, B.r, d));
          if (m > mask) mask = m;
        }
        // hard fade at the frame so the world always sits in open water
        var edge = Math.min(
          smoothstep(0, 0.09, nx / AX), smoothstep(0, 0.09, 1 - nx / AX),
          smoothstep(0, 0.09, ny), smoothstep(0, 0.09, 1 - ny)
        );
        mask = clamp(mask, 0, 1) * edge;

        var base = fbm(n1, px * fs, py * fs, 6);
        var rid = ridged(n2, px * fs * 0.85 + 13, py * fs * 0.85 + 7, 5);
        var v = lerp(base, rid, rmix);
        var e = v * Math.pow(mask, 1.2) - 0.03;
        h[IDX(x, y)] = e;
        if (e < min) min = e;
        if (e > max) max = e;
      }
    }
    var span = (max - min) || 1;
    for (var k = 0; k < h.length; k++) h[k] = (h[k] - min) / span;

    var sorted = Float32Array.from(h);
    sorted.sort();

    return {
      seed: seed, h: h, sorted: sorted, landTarget: landTarget, relief: relief,
      moistNoise: makeNoise(rand), tempNoise: makeNoise(rand)
    };
  }

  function quantile(sorted, p) {
    var i = clamp(Math.round(p * (sorted.length - 1)), 0, sorted.length - 1);
    return sorted[i];
  }

  /* ================= world (terrain + sea level) ================= */
  function makeWorld(T, seaShift) {
    var rand = rng((T.seed ^ 0x5bf03635) >>> 0);
    var namer = makeNamer(rand);
    var h = T.h;
    var land = clamp(T.landTarget + seaShift, 0.05, 0.80);
    var sea = quantile(T.sorted, 1 - land);
    var n = GW * GH;

    var isLand = new Uint8Array(n);
    var elev = new Float32Array(n);   // 0..1 above sea
    var i, x, y;
    for (i = 0; i < n; i++) {
      isLand[i] = h[i] > sea ? 1 : 0;
      elev[i] = isLand[i] ? (h[i] - sea) / Math.max(0.0001, 1 - sea) : 0;
    }

    /* --- flow accumulation --- */
    var order = new Int32Array(n);
    for (i = 0; i < n; i++) order[i] = i;
    var arr = Array.prototype.slice.call(order);
    arr.sort(function (a, b) { return h[b] - h[a]; });

    var down = new Int32Array(n).fill(-1);
    var flow = new Float32Array(n).fill(1);
    for (y = 0; y < GH; y++) {
      for (x = 0; x < GW; x++) {
        var c = IDX(x, y);
        if (!isLand[c]) continue;
        var best = -1, bh = h[c];
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            var ax = x + dx, ay = y + dy;
            if (ax < 0 || ay < 0 || ax >= GW || ay >= GH) continue;
            var a = IDX(ax, ay);
            if (h[a] < bh) { bh = h[a]; best = a; }
          }
        }
        down[c] = best;
      }
    }
    for (i = 0; i < arr.length; i++) {
      var c2 = arr[i];
      if (!isLand[c2]) continue;
      var d2 = down[c2];
      if (d2 >= 0) flow[d2] += flow[c2];
    }

    var riverMin = 34;
    var isRiver = new Uint8Array(n);
    var isLake = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      if (!isLand[i]) continue;
      if (flow[i] >= riverMin) {
        if (down[i] < 0) isLake[i] = 1; else isRiver[i] = 1;
      }
    }

    /* --- distance to any water (BFS) --- */
    var dist = new Int16Array(n).fill(9999);
    var q = new Int32Array(n), qh = 0, qt = 0;
    for (i = 0; i < n; i++) {
      if (!isLand[i] || isRiver[i] || isLake[i]) { dist[i] = 0; q[qt++] = i; }
    }
    while (qh < qt) {
      var cur = q[qh++];
      var cx = cur % GW, cy = (cur / GW) | 0, nd = dist[cur] + 1;
      if (nd > 34) continue;
      for (var k = 0; k < 4; k++) {
        var mx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        var my = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (mx < 0 || my < 0 || mx >= GW || my >= GH) continue;
        var ni = IDX(mx, my);
        if (dist[ni] > nd) { dist[ni] = nd; q[qt++] = ni; }
      }
    }

    /* --- climate + biomes --- */
    var biome = new Array(n);
    var moist = new Float32Array(n);
    var temp = new Float32Array(n);
    var windAngle = rand() * Math.PI * 2;
    var wx = Math.cos(windAngle), wy = Math.sin(windAngle);

    for (y = 0; y < GH; y++) {
      for (x = 0; x < GW; x++) {
        i = IDX(x, y);
        if (!isLand[i]) {
          var depth = (sea - h[i]) / Math.max(0.0001, sea);
          biome[i] = depth > 0.62 ? 'deep' : depth > 0.36 ? 'ocean' : depth > 0.14 ? 'shelf' : 'shallow';
          continue;
        }
        if (isLake[i]) { biome[i] = 'lake'; continue; }

        // rain shadow: sample upwind elevation
        var ux = clamp(Math.round(x - wx * 9), 0, GW - 1);
        var uy = clamp(Math.round(y - wy * 9), 0, GH - 1);
        var shadow = clamp(elev[IDX(ux, uy)] - elev[i], 0, 1);

        var m = fbm(T.moistNoise, x / GH * 3.1 + 4, y / GH * 3.1 + 11, 4);
        m = m * 0.55 + (1 - clamp(dist[i] / 30, 0, 1)) * 0.5 - elev[i] * 0.22 - shadow * 0.55;
        moist[i] = clamp(m, 0, 1);

        var latitude = 1 - Math.abs((y / GH) * 2 - 1);
        var t = latitude * 0.86 + fbm(T.tempNoise, x / GH * 2.2 + 31, y / GH * 2.2 + 2, 3) * 0.2 - elev[i] * 0.8;
        temp[i] = clamp(t, 0, 1);

        var e = elev[i], mo = moist[i], te = temp[i];
        var b;
        if (e > 0.80) b = te < 0.5 ? 'snow' : 'scree';
        else if (e > 0.63) b = te < 0.32 ? 'snow' : 'scree';
        else if (dist[i] === 1 && e < 0.05) b = mo > 0.62 ? 'marsh' : 'beach';
        else if (te < 0.22) b = 'tundra';
        else if (te < 0.42) b = mo > 0.5 ? 'boreal' : 'moor';
        else if (te < 0.70) b = mo > 0.63 ? 'forest' : (mo > 0.36 ? 'grass' : 'steppe');
        else b = mo > 0.68 ? 'jungle' : (mo > 0.44 ? 'savanna' : (mo > 0.22 ? 'steppe' : 'desert'));
        biome[i] = b;
      }
    }

    /* --- settlements --- */
    var cands = [];
    for (y = 2; y < GH - 2; y++) {
      for (x = 2; x < GW - 2; x++) {
        i = IDX(x, y);
        if (!isLand[i] || isLake[i]) continue;
        var bi = biome[i];
        var hab = HABIT[bi] || 0;
        if (hab <= 0.05) continue;
        var coastal = 0;
        if (!isLand[IDX(x + 1, y)] || !isLand[IDX(x - 1, y)] ||
            !isLand[IDX(x, y + 1)] || !isLand[IDX(x, y - 1)]) coastal = 1;
        var river = isRiver[i] ? 1 : 0;
        var nearLake = (isLake[IDX(x + 1, y)] || isLake[IDX(x - 1, y)] ||
                        isLake[IDX(x, y + 1)] || isLake[IDX(x, y - 1)]) ? 1 : 0;
        var s = hab * 1.1 + coastal * 1.5 + river * 1.35 + nearLake * 0.8 +
                (1 - elev[i]) * 0.9 + rand() * 0.7;
        if (s < 1.5) continue;
        cands.push({ i: i, x: x, y: y, s: s, coastal: coastal, river: river, lake: nearLake, b: bi });
      }
    }
    cands.sort(function (a, b2) { return b2.s - a.s; });

    var towns = [];
    var wantTowns = 8 + Math.floor(rand() * 5);
    var sep = 17;
    for (var ci = 0; ci < cands.length && towns.length < wantTowns; ci++) {
      var c3 = cands[ci], ok = true;
      for (var ti = 0; ti < towns.length; ti++) {
        var ddx = towns[ti].x - c3.x, ddy = towns[ti].y - c3.y;
        if (ddx * ddx + ddy * ddy < sep * sep) { ok = false; break; }
      }
      if (ok) towns.push(c3);
    }

    towns.forEach(function (t2, idx) {
      t2.name = namer.place();
      var kind, pop;
      if (idx === 0) { kind = t2.coastal ? 'free port' : 'city'; pop = 6000 + Math.floor(rand() * 22000); }
      else if (t2.coastal && rand() < 0.7) { kind = 'harbour town'; pop = 900 + Math.floor(rand() * 5200); }
      else if (t2.river && rand() < 0.6) { kind = 'river town'; pop = 500 + Math.floor(rand() * 3400); }
      else if (elev[t2.i] > 0.45) { kind = rand() < 0.5 ? 'hill keep' : 'watch station'; pop = 40 + Math.floor(rand() * 320); }
      else if (rand() < 0.35) { kind = 'abbey'; pop = 60 + Math.floor(rand() * 400); }
      else { kind = rand() < 0.5 ? 'market village' : 'village'; pop = 120 + Math.floor(rand() * 1500); }
      t2.kind = kind;
      t2.pop = pop;
      t2.founded = 180 + Math.floor(rand() * 760);
      t2.trade = TRADES[Math.floor(rand() * TRADES.length)];
      t2.quirk = QUIRKS[Math.floor(rand() * QUIRKS.length)];
      t2.big = pop > 3000;
    });

    /* --- regions --- */
    var regionCount = Math.max(3, Math.min(6, Math.floor(towns.length / 2)));
    var regions = [];
    var HUES = [[100, 240, 200], [122, 162, 255], [255, 170, 120], [200, 140, 255],
                [255, 214, 140], [130, 220, 150]];
    for (var r = 0; r < regionCount && r < towns.length; r++) {
      regions.push({
        x: towns[r].x, y: towns[r].y,
        name: REGION_PATTERNS[Math.floor(rand() * REGION_PATTERNS.length)](namer.bare()),
        col: HUES[r % HUES.length],
        seat: towns[r].name
      });
    }
    var region = new Int8Array(n).fill(-1);
    for (y = 0; y < GH; y++) {
      for (x = 0; x < GW; x++) {
        i = IDX(x, y);
        if (!isLand[i]) continue;
        var bd = Infinity, bri = -1;
        for (var q2 = 0; q2 < regions.length; q2++) {
          var rx = regions[q2].x - x, ry = regions[q2].y - y;
          var dd = rx * rx + ry * ry;
          if (dd < bd) { bd = dd; bri = q2; }
        }
        region[i] = bri;
      }
    }

    /* --- roads: minimum spanning tree, routed over the terrain --- */
    var roads = [];
    if (towns.length > 1) {
      var inTree = [0], out = [];
      for (var z = 1; z < towns.length; z++) out.push(z);
      while (out.length) {
        var bestA = 0, bestB = 0, bestD = Infinity, bo = 0;
        for (var ai = 0; ai < inTree.length; ai++) {
          for (var oi = 0; oi < out.length; oi++) {
            var A = towns[inTree[ai]], Bt = towns[out[oi]];
            var dxx = A.x - Bt.x, dyy = A.y - Bt.y;
            var dd2 = dxx * dxx + dyy * dyy;
            if (dd2 < bestD) { bestD = dd2; bestA = inTree[ai]; bestB = out[oi]; bo = oi; }
          }
        }
        var path = route(towns[bestA], towns[bestB]);
        if (path) roads.push(path);
        inTree.push(bestB);
        out.splice(bo, 1);
      }
    }

    function route(a, b) {
      var cost = new Float32Array(n).fill(Infinity);
      var prev = new Int32Array(n).fill(-1);
      var start = a.i, goal = b.i;
      cost[start] = 0;
      var heap = [[0, start]];
      function push(c, v) {
        heap.push([c, v]);
        var idx2 = heap.length - 1;
        while (idx2 > 0) {
          var p = (idx2 - 1) >> 1;
          if (heap[p][0] <= heap[idx2][0]) break;
          var tmp = heap[p]; heap[p] = heap[idx2]; heap[idx2] = tmp; idx2 = p;
        }
      }
      function pop() {
        var top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          var idx3 = 0;
          for (;;) {
            var l = idx3 * 2 + 1, rr = l + 1, sm2 = idx3;
            if (l < heap.length && heap[l][0] < heap[sm2][0]) sm2 = l;
            if (rr < heap.length && heap[rr][0] < heap[sm2][0]) sm2 = rr;
            if (sm2 === idx3) break;
            var t3 = heap[sm2]; heap[sm2] = heap[idx3]; heap[idx3] = t3; idx3 = sm2;
          }
        }
        return top;
      }
      var guard = 0;
      while (heap.length && guard++ < 400000) {
        var top2 = pop();
        var cu = top2[1];
        if (top2[0] > cost[cu]) continue;
        if (cu === goal) break;
        var ux2 = cu % GW, uy2 = (cu / GW) | 0;
        for (var dy2 = -1; dy2 <= 1; dy2++) {
          for (var dx2 = -1; dx2 <= 1; dx2++) {
            if (!dx2 && !dy2) continue;
            var vx = ux2 + dx2, vy = uy2 + dy2;
            if (vx < 0 || vy < 0 || vx >= GW || vy >= GH) continue;
            var vi = IDX(vx, vy);
            var step = (dx2 && dy2) ? 1.41 : 1;
            var dh = Math.abs(h[vi] - h[cu]);
            var w = step * (1 + dh * 320 + elev[vi] * 2.4);
            if (!isLand[vi]) w += 90;
            if (isRiver[vi]) w += 12;
            var nc = cost[cu] + w;
            if (nc < cost[vi]) { cost[vi] = nc; prev[vi] = cu; push(nc, vi); }
          }
        }
      }
      if (cost[goal] === Infinity) return null;
      var pts = [], cur2 = goal, guard2 = 0;
      while (cur2 !== -1 && guard2++ < 20000) { pts.push(cur2); cur2 = prev[cur2]; }
      pts.reverse();
      return pts;
    }

    /* --- naming the world --- */
    var worldName = namer.bare();
    if (rand() < 0.4) worldName += namer.pick(['ia', 'mark', 'holt', 'rest', 'watch', 'and']);
    var seaName = rand() < 0.5
      ? 'The ' + SEA_ADJ[Math.floor(rand() * SEA_ADJ.length)] + ' Sea'
      : 'Sea of ' + namer.bare();

    /* --- statistics --- */
    var landCells = 0, peak = 0, riverCells = 0, lakeCells = 0;
    for (i = 0; i < n; i++) {
      if (isLand[i]) { landCells++; if (elev[i] > peak) peak = elev[i]; }
      if (isRiver[i]) riverCells++;
      if (isLake[i]) lakeCells++;
    }

    return {
      seed: T.seed, sea: sea, relief: T.relief, h: h, isLand: isLand, elev: elev, biome: biome,
      moist: moist, temp: temp, flow: flow, down: down, isRiver: isRiver, isLake: isLake,
      dist: dist, towns: towns, regions: regions, region: region, roads: roads,
      worldName: worldName, seaName: seaName,
      stats: {
        land: landCells / n, peak: Math.round(peak * T.relief / 10) * 10,
        rivers: riverCells, lakes: lakeCells,
        towns: towns.length, regions: regions.length,
        people: towns.reduce(function (s, t4) { return s + t4.pop; }, 0)
      }
    };
  }

  /* ================= rendering ================= */
  var canvas = document.getElementById('atlasCanvas');
  if (!canvas) return;
  canvas.width = CW; canvas.height = CH;
  var ctx = canvas.getContext('2d');
  var off = document.createElement('canvas');
  off.width = GW; off.height = GH;
  var octx = off.getContext('2d');

  var view = 'relief';
  var showLabels = true;
  var showRoads = true;
  var selected = -1;

  function shadeOf(W2, x, y) {
    var i = IDX(x, y);
    if (!W2.isLand[i]) return 1;
    var l = W2.h[IDX(Math.max(0, x - 1), y)];
    var r = W2.h[IDX(Math.min(GW - 1, x + 1), y)];
    var u = W2.h[IDX(x, Math.max(0, y - 1))];
    var d = W2.h[IDX(x, Math.min(GH - 1, y + 1))];
    var gx = (l - r) * 26, gy = (u - d) * 26;
    var len = Math.sqrt(gx * gx + gy * gy + 1);
    var s = (gx * -0.6 + gy * -0.6 + 1.1) / (len * 1.45);
    return clamp(0.62 + s * 0.62, 0.55, 1.45);
  }

  function px(gx) { return (gx + 0.5) * CELL; }

  function drawBase(W2) {
    var img = octx.createImageData(GW, GH);
    var data = img.data;
    for (var y = 0; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var i = IDX(x, y), o = i * 4;
        var b = W2.biome[i], col = BIOMES[b].col;
        var rr = col[0], gg = col[1], bb = col[2];

        if (view === 'political' && W2.isLand[i]) {
          var reg = W2.region[i];
          if (reg >= 0) {
            var rc = W2.regions[reg].col;
            var grey = 165 - W2.elev[i] * 45;
            rr = lerp(grey, rc[0], 0.42);
            gg = lerp(grey, rc[1], 0.42);
            bb = lerp(grey, rc[2], 0.42);
          }
        } else if (view === 'relief' && W2.isLand[i]) {
          // hypsometric wash over the biome colour
          var e = W2.elev[i];
          var hy = e < 0.28 ? [104, 138, 92] : e < 0.5 ? [150, 148, 96] :
                   e < 0.7 ? [156, 126, 92] : e < 0.85 ? [138, 128, 122] : [236, 240, 242];
          rr = lerp(rr, hy[0], 0.55); gg = lerp(gg, hy[1], 0.55); bb = lerp(bb, hy[2], 0.55);
        }

        var sh = (view === 'political') ? lerp(1, shadeOf(W2, x, y), 0.45) : shadeOf(W2, x, y);
        data[o] = clamp(rr * sh, 0, 255);
        data[o + 1] = clamp(gg * sh, 0, 255);
        data[o + 2] = clamp(bb * sh, 0, 255);
        data[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, CW, CH);
  }

  function contour(field, level, emit) {
    for (var y = 0; y < GH - 1; y++) {
      for (var x = 0; x < GW - 1; x++) {
        var a = field[IDX(x, y)], b = field[IDX(x + 1, y)];
        var c = field[IDX(x + 1, y + 1)], d = field[IDX(x, y + 1)];
        var idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        var T2 = { x: x + (level - a) / (b - a), y: y };
        var R2 = { x: x + 1, y: y + (level - b) / (c - b) };
        var B2 = { x: x + (level - d) / (c - d), y: y + 1 };
        var L2 = { x: x, y: y + (level - a) / (d - a) };
        switch (idx) {
          case 1: case 14: emit(L2, B2); break;
          case 2: case 13: emit(B2, R2); break;
          case 3: case 12: emit(L2, R2); break;
          case 4: case 11: emit(T2, R2); break;
          case 6: case 9: emit(T2, B2); break;
          case 7: case 8: emit(L2, T2); break;
          case 5: emit(L2, T2); emit(B2, R2); break;
          case 10: emit(L2, B2); emit(T2, R2); break;
        }
      }
    }
  }

  function strokeContour(W2, level, style, width) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    contour(W2.h, level, function (p, q) {
      ctx.moveTo(px(p.x), px(p.y));
      ctx.lineTo(px(q.x), px(q.y));
    });
    ctx.stroke();
  }

  function drawRivers(W2, colour) {
    for (var y = 0; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var i = IDX(x, y);
        if (!W2.isRiver[i]) continue;
        var d = W2.down[i];
        if (d < 0) continue;
        var w = clamp(0.5 + Math.log(W2.flow[i]) * 0.42, 0.6, 4.2);
        ctx.strokeStyle = colour;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px(x), px(y));
        ctx.lineTo(px(d % GW), px((d / GW) | 0));
        ctx.stroke();
      }
    }
    // lakes as little discs
    for (var k = 0; k < GW * GH; k++) {
      if (!W2.isLake[k]) continue;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(px(k % GW), px((k / GW) | 0), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRoads(W2, colour, dash) {
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(dash);
    for (var r = 0; r < W2.roads.length; r++) {
      var p = W2.roads[r];
      ctx.beginPath();
      for (var i = 0; i < p.length; i += 3) {
        var xx = px(p[i] % GW), yy = px((p[i] / GW) | 0);
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      var last = p[p.length - 1];
      ctx.lineTo(px(last % GW), px((last / GW) | 0));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawInk(W2) {
    var rand = rng((W2.seed ^ 0x2f9a3c1d) >>> 0);
    ctx.fillStyle = '#e9dcbe';
    ctx.fillRect(0, 0, CW, CH);

    // sea: pale wash + hatching
    var img = octx.createImageData(GW, GH), data = img.data;
    for (var i = 0; i < GW * GH; i++) {
      var o = i * 4;
      if (W2.isLand[i]) { data[o] = 233; data[o + 1] = 220; data[o + 2] = 190; }
      else {
        var depth = clamp((W2.sea - W2.h[i]) / Math.max(0.0001, W2.sea), 0, 1);
        data[o] = 215 - depth * 40; data[o + 1] = 216 - depth * 30; data[o + 2] = 198 - depth * 8;
      }
      data[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.drawImage(off, 0, 0, CW, CH);

    // depth hatching, clipped to the sea by testing the grid
    ctx.strokeStyle = 'rgba(70,86,96,0.30)';
    ctx.lineWidth = 0.7;
    for (var yy = 0; yy < CH; yy += 7) {
      var gy = clamp(Math.floor(yy / CELL), 0, GH - 1);
      var run = -1;
      for (var gx = 0; gx <= GW; gx++) {
        var water = gx < GW && !W2.isLand[IDX(gx, gy)] && W2.h[IDX(gx, gy)] < W2.sea - 0.02;
        if (water && run < 0) run = gx;
        if (!water && run >= 0) {
          ctx.beginPath();
          ctx.moveTo(px(run), yy);
          ctx.lineTo(px(gx - 1), yy);
          ctx.stroke();
          run = -1;
        }
      }
    }

    // contour lines
    for (var lv = 1; lv <= 7; lv++) {
      var level = W2.sea + (1 - W2.sea) * (lv / 8);
      strokeContour(W2, level, 'rgba(120,94,60,' + (0.16 + lv * 0.035) + ')', 0.8);
    }
    // coastline, drawn twice for weight
    strokeContour(W2, W2.sea, 'rgba(56,44,30,0.9)', 1.7);
    strokeContour(W2, W2.sea + 0.004, 'rgba(56,44,30,0.28)', 0.9);

    drawRivers(W2, 'rgba(40,70,96,0.85)');
    if (showRoads) drawRoads(W2, 'rgba(120,72,44,0.75)', [5, 4]);

    // hand-drawn glyphs: mountains, trees, dunes
    var glyphs = 0;
    for (var y2 = 1; y2 < GH - 1 && glyphs < 1800; y2 += 2) {
      for (var x2 = 1; x2 < GW - 1 && glyphs < 1800; x2 += 2) {
        var ii = IDX(x2, y2);
        if (!W2.isLand[ii] || W2.isRiver[ii] || W2.isLake[ii]) continue;
        var b = W2.biome[ii], e = W2.elev[ii];
        var cx2 = px(x2) + (rand() - 0.5) * 4, cy2 = px(y2) + (rand() - 0.5) * 4;
        ctx.strokeStyle = 'rgba(74,58,40,0.72)';
        ctx.lineWidth = 0.9;
        if (e > 0.55 && rand() < 0.5) {
          var s = 3 + e * 5;
          ctx.beginPath();
          ctx.moveTo(cx2 - s, cy2 + s * 0.55);
          ctx.lineTo(cx2, cy2 - s * 0.7);
          ctx.lineTo(cx2 + s, cy2 + s * 0.55);
          ctx.stroke();
          glyphs++;
        } else if ((b === 'forest' || b === 'boreal' || b === 'jungle') && rand() < 0.4) {
          ctx.beginPath();
          ctx.arc(cx2, cy2, 1.9, Math.PI * 0.15, Math.PI * 1.05);
          ctx.moveTo(cx2, cy2 + 1.2);
          ctx.lineTo(cx2, cy2 + 3);
          ctx.stroke();
          glyphs++;
        } else if ((b === 'desert' || b === 'steppe') && rand() < 0.18) {
          ctx.beginPath();
          ctx.moveTo(cx2 - 3, cy2);
          ctx.quadraticCurveTo(cx2, cy2 - 2.2, cx2 + 3, cy2);
          ctx.stroke();
          glyphs++;
        } else if ((b === 'marsh') && rand() < 0.3) {
          ctx.beginPath();
          ctx.moveTo(cx2 - 3, cy2); ctx.lineTo(cx2 + 3, cy2);
          ctx.moveTo(cx2 - 2, cy2 + 2.4); ctx.lineTo(cx2 + 2, cy2 + 2.4);
          ctx.stroke();
          glyphs++;
        }
      }
    }

    // border
    ctx.strokeStyle = 'rgba(56,44,30,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, CW - 12, CH - 12);
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, CW - 24, CH - 24);
  }

  var boxes = [];
  function fits(x, y, w, h2) {
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h2 > b.y) return false;
    }
    return true;
  }

  function drawLabels(W2, ink) {
    boxes = [];
    var serif = 'Iowan Old Style, Palatino, Georgia, serif';
    var textCol = ink ? '#3a2e1e' : '#f2f6fb';
    var haloCol = ink ? 'rgba(233,220,190,0.9)' : 'rgba(6,10,16,0.75)';

    // region names, in political view only
    if (view === 'political') {
      for (var r = 0; r < W2.regions.length; r++) {
        var reg = W2.regions[r];
        ctx.font = '600 13px ' + serif;
        ctx.textAlign = 'center';
        var label = reg.name.toUpperCase();
        var w = ctx.measureText(label).width;
        ctx.lineWidth = 3;
        ctx.strokeStyle = haloCol;
        ctx.strokeText(label, px(reg.x), px(reg.y) - 22);
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText(label, px(reg.x), px(reg.y) - 22);
        boxes.push({ x: px(reg.x) - w / 2, y: px(reg.y) - 34, w: w, h: 16 });
      }
    }

    ctx.textAlign = 'left';
    for (var i = 0; i < W2.towns.length; i++) {
      var t = W2.towns[i];
      var x = px(t.x), y = px(t.y);
      var big = t.big || i === 0;

      // marker
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink ? '#3a2e1e' : '#0a0e14';
      ctx.fillStyle = i === selected ? '#ff9b54' : (ink ? '#8c2f1d' : '#64f0c8');
      ctx.beginPath();
      if (big) {
        ctx.arc(x, y, 4.6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = ink ? '#e9dcbe' : '#07090d'; ctx.fill();
      } else {
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      if (i === selected) {
        ctx.strokeStyle = '#ff9b54';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
      }

      if (!showLabels) continue;
      ctx.font = (big ? '600 15px ' : '500 12.5px ') + serif;
      var tw = ctx.measureText(t.name).width;
      var placements = [[x + 8, y + 4], [x - 8 - tw, y + 4], [x - tw / 2, y - 9], [x - tw / 2, y + 17]];
      for (var p = 0; p < placements.length; p++) {
        var lx = placements[p][0], ly = placements[p][1];
        if (p === placements.length - 1 || fits(lx - 2, ly - 12, tw + 4, 16)) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = haloCol;
          ctx.strokeText(t.name, lx, ly);
          ctx.fillStyle = textCol;
          ctx.fillText(t.name, lx, ly);
          boxes.push({ x: lx - 2, y: ly - 12, w: tw + 4, h: 16 });
          break;
        }
      }
    }

    // sea name, placed in the emptiest corner of open water
    var best = null;
    var corners = [[0.16, 0.2], [0.84, 0.2], [0.16, 0.82], [0.84, 0.82], [0.5, 0.9]];
    for (var c = 0; c < corners.length; c++) {
      var gx = Math.round(corners[c][0] * GW), gy = Math.round(corners[c][1] * GH);
      var score = 0;
      for (var oy = -8; oy <= 8; oy += 2) {
        for (var ox = -14; ox <= 14; ox += 2) {
          var ax = clamp(gx + ox, 0, GW - 1), ay = clamp(gy + oy, 0, GH - 1);
          if (!W2.isLand[IDX(ax, ay)]) score++;
        }
      }
      if (!best || score > best.score) best = { x: gx, y: gy, score: score };
    }
    if (best && best.score > 80) {
      ctx.textAlign = 'center';
      ctx.font = 'italic 600 17px ' + serif;
      var sn = W2.seaName.toUpperCase().split('').join(' ');
      ctx.lineWidth = 3;
      ctx.strokeStyle = haloCol;
      ctx.strokeText(sn, px(best.x), px(best.y));
      ctx.fillStyle = ink ? 'rgba(58,46,30,0.8)' : 'rgba(190,215,240,0.75)';
      ctx.fillText(sn, px(best.x), px(best.y));
      ctx.textAlign = 'left';
    }

    // compass rose
    var cxr = CW - 52, cyr = 52;
    ctx.strokeStyle = ink ? 'rgba(58,46,30,0.8)' : 'rgba(232,237,245,0.6)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cxr, cyr, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cxr, cyr - 22); ctx.lineTo(cxr - 5, cyr); ctx.lineTo(cxr, cyr + 22);
    ctx.lineTo(cxr + 5, cyr); ctx.closePath(); ctx.stroke();
    ctx.font = '600 10px ' + serif;
    ctx.textAlign = 'center';
    ctx.fillText('N', cxr, cyr - 26);
    ctx.textAlign = 'left';

    // scale bar
    var barW = 120;
    ctx.strokeStyle = ink ? 'rgba(58,46,30,0.85)' : 'rgba(232,237,245,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, CH - 26); ctx.lineTo(24 + barW, CH - 26);
    ctx.moveTo(24, CH - 31); ctx.lineTo(24, CH - 21);
    ctx.moveTo(24 + barW, CH - 31); ctx.lineTo(24 + barW, CH - 21);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = '600 10px ' + serif;
    ctx.fillText('30 leagues', 24 + barW + 8, CH - 22);
  }

  function render(W2) {
    ctx.setLineDash([]);
    if (view === 'ink') {
      drawInk(W2);
      drawLabels(W2, true);
      return;
    }
    drawBase(W2);
    strokeContour(W2, W2.sea, 'rgba(6,12,20,0.75)', 1.6);
    if (view === 'political') {
      // region borders: draw where neighbouring cells belong elsewhere
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var y = 0; y < GH - 1; y++) {
        for (var x = 0; x < GW - 1; x++) {
          var i = IDX(x, y);
          if (!W2.isLand[i]) continue;
          if (W2.isLand[IDX(x + 1, y)] && W2.region[IDX(x + 1, y)] !== W2.region[i]) {
            ctx.moveTo(px(x) + CELL / 2, px(y) - CELL / 2);
            ctx.lineTo(px(x) + CELL / 2, px(y) + CELL / 2);
          }
          if (W2.isLand[IDX(x, y + 1)] && W2.region[IDX(x, y + 1)] !== W2.region[i]) {
            ctx.moveTo(px(x) - CELL / 2, px(y) + CELL / 2);
            ctx.lineTo(px(x) + CELL / 2, px(y) + CELL / 2);
          }
        }
      }
      ctx.stroke();
    }
    drawRivers(W2, 'rgba(120,190,235,0.85)');
    if (showRoads) drawRoads(W2, 'rgba(255,214,165,0.55)', [4, 4]);
    drawLabels(W2, false);
  }

  /* ================= page wiring ================= */
  var terrain = null, world = null, seaShift = 0;

  function $(id) { return document.getElementById(id); }
  function txt(id, v) { var e = $(id); if (e) e.textContent = v; }

  function rebuild(shift) {
    seaShift = shift;
    world = makeWorld(terrain, shift);
    selected = -1;
    render(world);
    readMeta();
    hideCard();
  }

  function fresh(seed) {
    terrain = makeTerrain(seed);
    rebuild(seaShift);
  }

  function readMeta() {
    var s = world.stats;
    txt('worldName', world.worldName);
    txt('atlasSeed', String(world.seed).padStart(10, '0'));
    txt('statLand', Math.round(s.land * 100) + '%');
    txt('statPeak', s.peak.toLocaleString() + ' m');
    txt('statTowns', String(s.towns));
    txt('statRegions', String(s.regions));
    txt('statPeople', s.people.toLocaleString());
    txt('statSea', world.seaName);
  }

  function cellFromEvent(e) {
    var r = canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * GW);
    var y = Math.floor((e.clientY - r.top) / r.height * GH);
    if (x < 0 || y < 0 || x >= GW || y >= GH) return null;
    return { x: x, y: y, i: IDX(x, y) };
  }

  function letters(x) { return String.fromCharCode(65 + Math.floor(x / GW * 12)); }

  canvas.addEventListener('pointermove', function (e) {
    if (!world) return;
    var c = cellFromEvent(e);
    if (!c) return;
    var i = c.i;
    txt('rdCoord', letters(c.x) + (Math.floor(c.y / GH * 9) + 1) + ' · ' + c.x + ',' + c.y);
    if (!world.isLand[i]) {
      var fath = Math.round((world.sea - world.h[i]) / Math.max(0.0001, world.sea) * 2400);
      txt('rdElev', '−' + fath.toLocaleString() + ' m');
      txt('rdBiome', BIOMES[world.biome[i]].name);
      txt('rdRegion', world.seaName);
      txt('rdNear', '—');
      return;
    }
    txt('rdElev', Math.round(world.elev[i] * world.relief).toLocaleString() + ' m');
    txt('rdBiome', BIOMES[world.biome[i]].name +
      (world.isRiver[i] ? ' · river' : '') +
      (world.dist[i] === 1 ? ' · shoreline' : ''));
    var reg = world.region[i];
    txt('rdRegion', reg >= 0 && world.regions[reg] ? world.regions[reg].name : 'unclaimed');
    var bd = Infinity, bt = null;
    for (var t = 0; t < world.towns.length; t++) {
      var dx = world.towns[t].x - c.x, dy = world.towns[t].y - c.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd) { bd = d; bt = world.towns[t]; }
    }
    txt('rdNear', bt ? bt.name + ' (' + Math.round(bd * 1.4) + ' leagues)' : '—');
  }, { passive: true });

  canvas.addEventListener('click', function (e) {
    if (!world) return;
    var c = cellFromEvent(e);
    if (!c) return;
    var bd = Infinity, bi = -1;
    for (var t = 0; t < world.towns.length; t++) {
      var dx = world.towns[t].x - c.x, dy = world.towns[t].y - c.y;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = t; }
    }
    if (bi >= 0 && bd < 90) {
      selected = bi;
      showCard(world.towns[bi]);
    } else {
      selected = -1;
      hideCard();
    }
    render(world);
  });

  function showCard(t) {
    var card = $('placeCard');
    if (!card) return;
    card.hidden = false;
    txt('pcName', t.name);
    txt('pcKind', t.kind);
    txt('pcPop', t.pop.toLocaleString() + ' people');
    var reg = world.region[t.i];
    txt('pcRegion', reg >= 0 && world.regions[reg] ? world.regions[reg].name : 'unclaimed country');
    txt('pcBody',
      'Founded in the year ' + t.founded + ' on ' +
      (t.coastal ? 'the coast' : t.river ? 'a river bend' : t.lake ? 'a lake shore' : 'open ground') +
      ', ' + t.name + ' lives off ' + t.trade + '. Ground here is ' +
      BIOMES[t.b].name.toLowerCase() + ' at about ' +
      Math.round(world.elev[t.i] * world.relief).toLocaleString() + ' metres. Locally, ' + t.quirk + '.');
  }
  function hideCard() {
    var card = $('placeCard');
    if (card) card.hidden = true;
  }

  function chips(containerId, items, current, cb) {
    var box = $(containerId);
    if (!box) return;
    box.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'chip' + (it.id === current ? ' on' : '');
      b.type = 'button';
      b.textContent = it.label;
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        cb(it.id);
      });
      box.appendChild(b);
    });
  }

  chips('views', [
    { id: 'relief', label: 'Relief' },
    { id: 'biome', label: 'Biome' },
    { id: 'political', label: 'Regions' },
    { id: 'ink', label: 'Ink' }
  ], view, function (id) { view = id; render(world); });

  var seaEl = $('seaSlider');
  var seaTimer = null;
  if (seaEl) {
    seaEl.addEventListener('input', function () {
      var v = Number(seaEl.value);
      txt('seaVal', (v > 0 ? '+' : '') + v + ' m');
      if (seaTimer) clearTimeout(seaTimer);
      seaTimer = setTimeout(function () { rebuild(-v / 1400); }, 110);
    });
  }

  function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }
  wire('btnTodayWorld', function () {
    if (seaEl) { seaEl.value = 0; txt('seaVal', '0 m'); }
    seaShift = 0;
    fresh(seedForToday());
  });
  wire('btnRoll', function () {
    if (seaEl) { seaEl.value = 0; txt('seaVal', '0 m'); }
    seaShift = 0;
    fresh((Math.random() * 4294967295) >>> 0);
  });
  wire('btnLabels', function () {
    showLabels = !showLabels;
    this.textContent = showLabels ? 'Hide names' : 'Show names';
    render(world);
  });
  wire('btnRoads', function () {
    showRoads = !showRoads;
    this.textContent = showRoads ? 'Hide roads' : 'Show roads';
    render(world);
  });

  fresh(seedForToday());
})();
