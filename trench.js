/* drift.quibo.games — The Trench
   A strip of ground laid down by the day's number, one event at a time, and then
   handed to you to take apart in the right order. Single-context excavation, the
   Harris matrix and the terminus post quem are the real thing, and so are the date
   ranges of every kind of find; the site, its history and its address are not
   anywhere. Self-contained. No dependencies. */
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
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function smooth1(r) {
    var g = []; for (var i = 0; i < 260; i++) g.push(r());
    return function (x) {
      var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); i = ((i % 256) + 256) % 256;
      return g[i] + (g[i + 1] - g[i]) * f;
    };
  }
  function $(id) { return document.getElementById(id); }
  function an(n) { return (/^[aeiouAEIOU]/.test(n) ? 'an ' : 'a ') + n; }

  /* ---------- years ---------- */
  function fmtY(y) { return y < 0 ? (-y) + ' BC' : y < 1000 ? 'AD ' + y : String(y); }
  function fmtR(a, b) {
    if (a < 0 && b < 0) return (-a) + '–' + (-b) + ' BC';
    if (a < 0) return (-a) + ' BC–AD ' + b;
    if (a < 1000) return 'AD ' + a + '–' + b;
    return a + '–' + b;
  }
  function circa(y) { var r = Math.abs(y) < 1000 ? 10 : 5; return 'c. ' + fmtY(Math.round(y / r) * r); }

  /* ---------- the finds catalogue: real object types, real date ranges ---------- */
  // a = earliest it can have been made, b = when it stops turning up new
  var CAT = [
    { n: 'worked flint flake', a: -4000, b: -1500 },
    { n: 'flint scraper', a: -4000, b: -1800 },
    { n: 'sherd of Beaker pottery', a: -2500, b: -1700 },
    { n: 'sherd of Collared Urn', a: -2000, b: -1500 },
    { n: 'fragment of a saddle quern', a: -3500, b: -100 },
    { n: 'shell-tempered Iron Age sherd', a: -400, b: 50 },
    { n: 'triangular clay loomweight', a: -400, b: 50 },
    { n: 'coin of Cunobelinus', a: 10, b: 43 },
    { n: 'South Gaulish samian sherd', a: 43, b: 110 },
    { n: 'as of Vespasian', a: 69, b: 79 },
    { n: 'sestertius of Hadrian', a: 117, b: 138 },
    { n: 'Central Gaulish samian sherd', a: 120, b: 200 },
    { n: 'sherd of black-burnished ware', a: 120, b: 400 },
    { n: 'Oxfordshire colour-coated sherd', a: 240, b: 400 },
    { n: 'radiate of Tetricus I', a: 271, b: 274 },
    { n: 'nummus of Constantine I', a: 307, b: 337 },
    { n: 'nummus of Valens', a: 364, b: 378 },
    { n: 'fragment of Roman box-flue tile', a: 60, b: 400 },
    { n: 'grass-tempered sherd', a: 450, b: 850 },
    { n: 'sherd of Ipswich ware', a: 720, b: 850 },
    { n: 'sherd of St Neots-type ware', a: 900, b: 1150 },
    { n: 'sherd of sandy greyware', a: 1100, b: 1400 },
    { n: 'glazed jug sherd', a: 1200, b: 1500 },
    { n: 'long cross penny of Henry III', a: 1247, b: 1272 },
    { n: 'penny of Edward I', a: 1279, b: 1307 },
    { n: 'fragment of peg tile', a: 1250, b: 1800 },
    { n: 'sherd of Frechen stoneware', a: 1550, b: 1700 },
    { n: 'clay tobacco pipe stem', a: 1580, b: 1900 },
    { n: 'sherd of tin-glazed earthenware', a: 1600, b: 1800 },
    { n: 'sherd of creamware', a: 1760, b: 1820 },
    { n: 'transfer-printed whiteware sherd', a: 1790, b: 1920 },
    { n: 'bun penny of Victoria', a: 1860, b: 1894 },
    { n: 'machine-made bottle glass', a: 1905, b: 2026 },
    { n: 'aluminium ring-pull', a: 1965, b: 1990 },
    { n: 'fragment of plastic', a: 1950, b: 2026 }
  ];
  var UNDATED = ['animal bone', 'oyster shell', 'charcoal', 'burnt stone', 'iron nail, heavily corroded', 'fired clay'];

  var PERIODS = [
    { k: 'pre', name: 'Bronze Age', a: -2300, b: -1500 },
    { k: 'ia', name: 'Iron Age', a: -500, b: 30 },
    { k: 'rom', name: 'Roman', a: 70, b: 390 },
    { k: 'sax', name: 'early medieval', a: 480, b: 880 },
    { k: 'med', name: 'medieval', a: 1150, b: 1460 },
    { k: 'pm', name: 'post-medieval', a: 1560, b: 1860 },
    { k: 'mod', name: 'modern', a: 1890, b: 1980 }
  ];

  /* ---------- what things look like ---------- */
  // col: base colour; sp: speckle chance and colour; sp2: a second speckle
  var TYPES = {
    chalk:      { d: 'natural chalk, weathered and broken at the top', col: [214, 210, 194], sp: [0.05, [240, 238, 228]], sp2: [0.01, [120, 110, 90]] },
    gravel:     { d: 'natural sand and gravel, orange-yellow', col: [196, 158, 96], sp: [0.12, [150, 120, 80]], sp2: [0.06, [228, 214, 180]] },
    clay:       { d: 'natural clay, stiff, mottled orange and blue-grey', col: [168, 128, 84], sp: [0.08, [132, 132, 128]] },
    topsoil:    { d: 'topsoil: dark grey-brown loam, rooty', col: [66, 52, 40], sp: [0.04, [96, 80, 60]] },
    made:       { d: 'made ground: brick, concrete and ash in a loose black matrix', col: [58, 54, 52], sp: [0.08, [150, 70, 50]], sp2: [0.04, [170, 170, 165]] },
    garden:     { d: 'garden soil: mid grey-brown sandy loam, well worked', col: [92, 74, 56], sp: [0.03, [140, 110, 80]] },
    levelling:  { d: 'levelling: mixed yellow-brown clay with chalk flecks', col: [150, 118, 72], sp: [0.06, [220, 214, 196]] },
    demolition: { d: 'demolition rubble: mortar, tile and broken stone', col: [158, 128, 100], sp: [0.12, [160, 64, 44]], sp2: [0.1, [226, 220, 204]] },
    occupation: { d: 'occupation layer: dark grey silt, charcoal flecks throughout', col: [64, 60, 56], sp: [0.07, [24, 22, 22]] },
    darkearth:  { d: '"dark earth": thick, homogeneous dark grey-brown silty loam', col: [54, 46, 40], sp: [0.02, [90, 76, 60]] },
    floor:      { d: 'clay floor: compact orange-brown clay, trampled flat', col: [168, 96, 56], sp: [0.03, [120, 60, 36]] },
    yard:       { d: 'yard surface: compacted gravel and cobbles', col: [156, 138, 104], sp: [0.18, [190, 176, 150]], sp2: [0.08, [92, 84, 70]] },
    burnt:      { d: 'burnt layer: black, charcoal-rich, with reddened clay', col: [34, 30, 28], sp: [0.06, [150, 64, 40]] },
    colluvium:  { d: 'colluvium: pale yellow-brown sandy silt washed down the slope', col: [172, 146, 104], sp: [0.02, [130, 110, 80]] },
    oldground:  { d: 'buried soil: grey-brown silt, stone-free, leached at the top', col: [118, 100, 80], sp: [0.02, [160, 144, 120]] },
    primary:    { d: 'primary fill: pale sandy silt slumped in from the sides', col: [160, 138, 104], sp: [0.05, [196, 170, 120]] },
    secondary:  { d: 'secondary fill: dark organic silt, soft, with charcoal', col: [76, 62, 50], sp: [0.05, [30, 26, 24]] },
    tertiary:   { d: 'upper fill: mid brown clayey silt, occasional stones', col: [112, 88, 64], sp: [0.05, [168, 156, 132]] },
    backfill:   { d: 'backfill: mixed clay, soil and stone thrown straight back in', col: [124, 100, 72], sp: [0.1, [60, 50, 40]], sp2: [0.06, [196, 176, 140]] },
    packing:    { d: 'post packing: stones rammed round the base of a post', col: [138, 124, 100], sp: [0.2, [196, 190, 176]] },
    postpipe:   { d: 'post-pipe: very dark soft silt where the timber rotted away', col: [44, 36, 30], sp: [0.02, [80, 64, 48]] },
    rubble:     { d: 'robbing backfill: mortar and stone chips left behind', col: [176, 158, 128], sp: [0.16, [226, 222, 208]], sp2: [0.06, [110, 96, 80]] },
    service:    { d: 'service trench backfill: loose, with a ceramic pipe', col: [98, 82, 64], sp: [0.06, [150, 70, 50]] }
  };
  var LAYER_BY = {
    pre: ['oldground', 'colluvium'], ia: ['occupation', 'colluvium', 'burnt'],
    rom: ['yard', 'occupation', 'demolition', 'floor'], sax: ['darkearth', 'occupation'],
    med: ['occupation', 'floor', 'darkearth', 'levelling'], pm: ['levelling', 'demolition', 'garden'],
    mod: ['made', 'levelling']
  };
  var CUT_BY = {
    pre: ['pit', 'posthole', 'pit'], ia: ['pit', 'ditch', 'posthole', 'gully'],
    rom: ['pit', 'ditch', 'posthole', 'robber'], sax: ['pit', 'posthole', 'pit'],
    med: ['pit', 'ditch', 'posthole', 'robber'], pm: ['pit', 'ditch', 'pit'], mod: ['service', 'pit']
  };
  var CUTS = {
    pit:     { hw: [14, 30], D: [26, 52], shape: function (u) { return Math.pow(1 - u * u, 0.55); }, fills: [['primary', 'secondary'], ['primary', 'secondary', 'tertiary'], ['secondary', 'backfill']] },
    posthole:{ hw: [6, 9],   D: [18, 32], shape: function (u) { u = Math.abs(u); return u < 0.65 ? 1 : Math.sqrt(Math.max(0, 1 - (u - 0.65) / 0.35)); }, fills: [['packing', 'postpipe']] },
    ditch:   { hw: [34, 52], D: [34, 56], shape: function (u) { u = Math.abs(u); return u < 0.18 ? 1 : Math.pow(1 - (u - 0.18) / 0.82, 0.8); }, fills: [['primary', 'secondary', 'tertiary'], ['primary', 'tertiary']] },
    gully:   { hw: [9, 14],  D: [10, 18], shape: function (u) { return Math.sqrt(Math.max(0, 1 - u * u * u * u)); }, fills: [['tertiary'], ['secondary']] },
    robber:  { hw: [11, 18], D: [34, 58], shape: function (u) { u = Math.abs(u); return u < 0.8 ? 1 : Math.sqrt(Math.max(0, 1 - (u - 0.8) / 0.2)); }, fills: [['rubble'], ['rubble', 'tertiary']] },
    service: { hw: [7, 10],  D: [40, 70], shape: function (u) { u = Math.abs(u); return u < 0.85 ? 1 : Math.sqrt(Math.max(0, 1 - (u - 0.85) / 0.15)); }, fills: [['service']] }
  };
  var CUTNAME = { pit: 'pit', posthole: 'posthole', ditch: 'ditch', gully: 'gully', robber: 'robber trench', service: 'service trench' };
  var CUTWHY = {
    pit: 'a pit dug', posthole: 'a post set up', ditch: 'a ditch dug across the site', gully: 'a gully cut',
    robber: 'a wall dug out for its stone', service: 'a pipe laid'
  };
  var LAYERWHY = {
    topsoil: 'topsoil built up over everything', made: 'the site built up with rubble and ash', garden: 'a garden worked over the site',
    levelling: 'the ground made up and levelled', demolition: 'a building pulled down where it stood',
    occupation: 'people living here and dropping things', darkearth: 'the site given over to cultivation',
    floor: 'a clay floor laid', yard: 'a yard surfaced in gravel', burnt: 'something burnt down',
    colluvium: 'soil washed down the slope', oldground: 'ground left alone long enough to form a soil'
  };

  var COLS = 300, ROWS = 240, CM = 2, VE = 1.5; // each cell is 2 cm square; heights drawn half as tall again

  /* ---------- building the site ---------- */
  function build(seed) {
    var r = rng(seed), nz = smooth1(r), nz2 = smooth1(r);
    var grid = new Int16Array(COLS * ROWS).fill(-1);
    var C = [];
    function add(o) { o.id = C.length; o.finds = []; C.push(o); return o; }
    var s = new Int16Array(COLS);

    var nat = pick(r, ['chalk', 'gravel', 'clay']);
    var N = add({ kind: 'natural', type: nat, date: -1e9 });
    for (var x = 0; x < COLS; x++) {
      s[x] = 34 + Math.round((nz(x / 45) - 0.5) * 10);
      for (var e = 0; e < s[x]; e++) grid[e * COLS + x] = N.id;
    }

    // which periods this ground saw
    var start = Math.floor(r() * 4), per = [];
    for (var i = start; i < PERIODS.length - 1; i++) if (i === start || r() < 0.72) per.push(PERIODS[i]);
    per.push(PERIODS[PERIODS.length - 1]);
    var plan = [];
    per.forEach(function (p, pi) {
      var k = p.k === 'mod' ? 1 : 1 + Math.floor(r() * 2.7);
      for (var j = 0; j < k; j++) plan.push({ p: p, date: Math.round(p.a + r() * (p.b - p.a)), cut: r() < 0.55 });
    });
    plan.sort(function (a, b) { return a.date - b.date; });
    var nc = plan.filter(function (q) { return q.cut; }).length;
    for (i = 0; nc < 3 && i < plan.length; i++) if (!plan[i].cut && r() < 0.8) { plan[i].cut = true; nc++; }
    var nl = plan.length - nc;
    for (i = plan.length - 1; nl < 2 && i >= 0; i--) if (plan[i].cut) { plan[i].cut = false; nl++; }
    // make dates strictly increasing
    for (i = 1; i < plan.length; i++) if (plan[i].date <= plan[i - 1].date) plan[i].date = plan[i - 1].date + 3 + Math.floor(r() * 12);

    function doLayer(ev, type, full) {
      var maxS = 0; for (var x = 0; x < COLS; x++) maxS = Math.max(maxS, s[x]);
      var base = type === 'topsoil' ? 12 + r() * 4 : type === 'made' ? 10 + r() * 8 : 6 + r() * 10;
      base = Math.min(base, (ROWS - 18 - maxS));
      if (base < 3) return null;
      var partial = !full && r() < 0.42, a = 0, b = COLS;
      if (partial) {
        var len = 120 + Math.floor(r() * 120);
        a = Math.floor(r() * (COLS - len)); b = a + len;
        if (r() < 0.5) { if (r() < 0.5) a = -30; else b = COLS + 30; }
      }
      var L = add({ kind: 'layer', type: type, date: ev.date, p: ev.p });
      var off = r() * 200, got = 0;
      for (x = 0; x < COLS; x++) {
        var tap = 1;
        if (partial) {
          var dd = Math.min(x - a, b - x);
          tap = dd <= 0 ? 0 : dd >= 30 ? 1 : (dd / 30) * (dd / 30) * (3 - 2 * dd / 30);
        }
        var th = Math.round(base * (0.65 + 0.7 * nz2(off + x / 38)) * tap);
        for (var e = s[x]; e < s[x] + th && e < ROWS - 2; e++) { grid[e * COLS + x] = L.id; got++; }
        s[x] = Math.min(ROWS - 2, s[x] + th);
      }
      return got ? L : null;
    }
    function doCut(ev, ctype) {
      var T = CUTS[ctype];
      var hw = Math.round(T.hw[0] + r() * (T.hw[1] - T.hw[0])), D = T.D[0] + r() * (T.D[1] - T.D[0]);
      var c = Math.round(hw + 6 + r() * (COLS - 2 * hw - 12));
      var K = add({ kind: 'cut', type: ctype, date: ev.date, p: ev.p, x0: c - hw, x1: c + hw, fills: [] });
      var before = {}, bot = {};
      for (var x = c - hw; x <= c + hw; x++) {
        var u = (x - c) / hw, d = Math.round(T.shape(u) * D);
        before[x] = s[x]; bot[x] = Math.max(4, s[x] - d);
        for (var e = bot[x]; e < s[x]; e++) grid[e * COLS + x] = -1;
      }
      var scheme = pick(r, T.fills), n = scheme.length, fr = [];
      if (n === 1) fr = [1];
      else if (n === 2) fr = [0.3 + r() * 0.3, 1];
      else fr = [0.18 + r() * 0.18, 0.5 + r() * 0.2, 1];
      var prev = {};
      for (x = c - hw; x <= c + hw; x++) prev[x] = bot[x];
      scheme.forEach(function (ft, fi) {
        var F = add({ kind: 'fill', type: ft, date: ev.date + fi * (1 + Math.floor(r() * (ctype === 'ditch' ? 30 : 6))), p: ev.p, cut: K.id });
        K.fills.push(F.id);
        for (var x = c - hw; x <= c + hw; x++) {
          var top = fi === n - 1 ? before[x] : bot[x] + Math.round((before[x] - bot[x]) * fr[fi]);
          for (var e = prev[x]; e < top; e++) grid[e * COLS + x] = F.id;
          prev[x] = Math.max(prev[x], top);
        }
      });
      return K;
    }

    plan.forEach(function (ev) {
      if (ev.cut) doCut(ev, pick(r, CUT_BY[ev.p.k]));
      else doLayer(ev, pick(r, LAYER_BY[ev.p.k]), false);
    });
    var lastDate = plan.length ? plan[plan.length - 1].date : 1900;
    doLayer({ date: Math.max(lastDate + 10, 1990 + Math.floor(r() * 25)), p: PERIODS[6] }, 'topsoil', true);

    /* tidy: fold tiny slivers into whatever is underneath them */
    var cnt = new Int32Array(C.length);
    function count() { cnt.fill(0); for (var q = 0; q < grid.length; q++) if (grid[q] >= 0) cnt[grid[q]]++; }
    count();
    for (var pass = 0; pass < 3; pass++) {
      var tiny = {};
      C.forEach(function (c) { if (c.kind !== 'natural' && c.kind !== 'cut' && cnt[c.id] > 0 && cnt[c.id] < 40) tiny[c.id] = 1; });
      if (!Object.keys(tiny).length) break;
      for (e = 0; e < ROWS; e++) for (x = 0; x < COLS; x++) {
        var q = e * COLS + x, id = grid[q];
        if (id >= 0 && tiny[id]) {
          var dn = e > 0 ? grid[q - COLS] : N.id;
          grid[q] = dn >= 0 && !tiny[dn] ? dn : N.id;
        }
      }
      count();
    }
    C.forEach(function (c) { c.cells = cnt[c.id]; });
    C.forEach(function (c) { if (c.kind === 'cut') c.fills = c.fills.filter(function (f) { return C[f].cells > 0; }); });
    var alive = C.filter(function (c) { return c.kind === 'cut' ? c.fills.length > 0 : c.cells > 0; });

    /* stratigraphic relationships from contact: the later of two touching things is the
       one laid down later, and a fill touching something it doesn't belong with got
       there because its cut went through it */
    var later = {}; // id -> set of ids directly later than it (things over it / cutting it)
    var earlier = {};
    alive.forEach(function (c) { later[c.id] = {}; earlier[c.id] = {}; });
    function rel(a, b) { if (a === b) return; later[b][a] = 1; earlier[a][b] = 1; }
    function touch(a, b) {
      if (a < 0 || b < 0 || a === b) return;
      var L = a > b ? a : b, E = a > b ? b : a;
      if (C[L].kind === 'fill') {
        var K = C[L].cut;
        if (C[E].kind === 'fill' && C[E].cut === K) rel(L, E);
        else { rel(L, K); rel(K, E); }
      } else rel(L, E);
    }
    for (e = 0; e < ROWS; e++) for (x = 0; x < COLS; x++) {
      var q2 = e * COLS + x, id2 = grid[q2];
      if (id2 < 0) continue;
      if (x < COLS - 1) touch(id2, grid[q2 + 1]);
      if (e < ROWS - 1) touch(id2, grid[q2 + COLS]);
    }

    /* transitive reduction, for drawing the matrix the way it is drawn on a real site */
    var ids = alive.map(function (c) { return c.id; });
    var below = {}; // everything earlier, direct or not
    ids.slice().sort(function (a, b) { return a - b; }).forEach(function (id) {
      var set = {};
      Object.keys(earlier[id]).forEach(function (k) {
        set[k] = 1; Object.keys(below[k] || {}).forEach(function (j) { set[j] = 1; });
      });
      below[id] = set;
    });
    var red = {};
    ids.forEach(function (id) {
      red[id] = {};
      var ks = Object.keys(earlier[id]);
      ks.forEach(function (k) {
        var redundant = ks.some(function (m) { return m !== k && below[m][k]; });
        if (!redundant) red[id][k] = 1;
      });
    });

    /* geometry per context: extent, centroid, a good place for a label */
    var info = {};
    ids.forEach(function (id) { info[id] = { sx: 0, n: 0, minE: 1e9, maxE: -1, runs: {} }; });
    for (x = 0; x < COLS; x++) {
      var runId = -2, runStart = 0;
      for (e = 0; e <= ROWS; e++) {
        var v = e < ROWS ? grid[e * COLS + x] : -3;
        if (v !== runId) {
          if (runId >= 0 && info[runId]) {
            var ln = e - runStart, I = info[runId];
            if (!I.best || ln > I.best.len) I.best = { len: ln, x: x, e: runStart + ln / 2 };
            I.maxRun = Math.max(I.maxRun || 0, ln);
          }
          runId = v; runStart = e;
        }
        if (v >= 0 && info[v]) { var J = info[v]; J.sx += x; J.n++; J.minE = Math.min(J.minE, e); J.maxE = Math.max(J.maxE, e); }
      }
    }
    // spread labels of wide layers toward the widest thick part rather than an edge
    ids.forEach(function (id) {
      var c = C[id], I = info[id];
      c.cx = I.n ? I.sx / I.n : 0;
      if (c.kind === 'cut') {
        var fx = 0, fn = 0, mn = 1e9;
        c.fills.forEach(function (f) { fx += info[f].sx; fn += info[f].n; mn = Math.min(mn, info[f].minE); });
        c.cx = fx / fn; c.bottom = mn;
        c.depth = 0;
        c.fills.forEach(function (f) { c.depth = Math.max(c.depth, info[f].maxE + 1 - mn); });
      } else {
        c.lab = I.best ? { x: I.best.x, e: I.best.e } : null;
        c.thick = (I.maxRun || 0) * CM;
      }
    });
    // try to put layer labels near the middle of the thickest stretch
    ids.forEach(function (id) {
      var c = C[id]; if (c.kind !== 'layer' && c.kind !== 'fill' && c.kind !== 'natural') return;
      var bestScore = -1;
      for (var x = 4; x < COLS - 4; x += 2) {
        var lo = -1, hi = -1;
        for (var e = 0; e < ROWS; e++) if (grid[e * COLS + x] === id) { if (lo < 0) lo = e; hi = e; }
        if (lo < 0) continue;
        var th = hi - lo + 1, score = th * 3 - Math.abs(x - c.cx) * 0.05;
        if (c.kind === 'natural') score = th - Math.abs(x - COLS * 0.12) * 0.2;
        if (th >= 7 && score > bestScore) { bestScore = score; c.lab = { x: x, e: lo + th / 2 }; }
      }
    });

    /* numbering: handed out left to right as the section was drawn, cut first, then its fills from the top */
    var base = (1 + Math.floor(r() * 8)) * 100 + 1;
    var groups = [];
    alive.forEach(function (c) {
      if (c.kind === 'layer') groups.push({ key: c.type === 'topsoil' ? -1 : c.cx, list: [c.id] });
      else if (c.kind === 'cut') groups.push({ key: c.cx, list: [c.id].concat(c.fills.slice().reverse()) });
    });
    groups.sort(function (a, b) { return a.key - b.key; });
    var num = base;
    groups.forEach(function (g) { g.list.forEach(function (id) { C[id].num = num++; }); });
    N.num = num;

    /* finds */
    var dep = alive.filter(function (c) { return c.kind === 'layer' || c.kind === 'fill'; });
    dep.forEach(function (c) {
      var T = c.date, n = c.type === 'topsoil' || c.type === 'made' ? 2 + Math.floor(r() * 2) : [0, 1, 1, 2, 2, 3][Math.floor(r() * 6)];
      if (c.type === 'postpipe' || c.type === 'packing') n = Math.min(n, 1);
      var pool = [], tot = 0;
      CAT.forEach(function (f) {
        if (f.a > T) return;
        var w = T <= f.b + 60 ? 4 : T - f.b < 1500 ? 0.45 : 0;
        if (w) { pool.push([f, w]); tot += w; }
      });
      for (var k = 0; k < n; k++) {
        if (r() < 0.28 || !pool.length) { c.finds.push({ n: pick(r, UNDATED) }); continue; }
        var t = r() * tot, pi = 0;
        while (pi < pool.length - 1 && (t -= pool[pi][1]) > 0) pi++;
        var f = pool[pi][0];
        if (!c.finds.some(function (g) { return g.n === f.n; })) c.finds.push({ n: f.n, a: f.a, b: f.b });
      }
    });

    /* terminus post quem of every deposit: the latest-made thing in it, or in anything under it */
    function ownMax(c) { var m = null; c.finds.forEach(function (f) { if (f.a != null && (m == null || f.a > m.a)) m = f; }); return m; }
    ids.forEach(function (id) {
      var c = C[id]; if (c.kind !== 'layer' && c.kind !== 'fill') return;
      var own = ownMax(c), from = null, fromCtx = null;
      Object.keys(below[id]).forEach(function (k) {
        var m = ownMax(C[k]);
        if (m && (!from || m.a > from.a)) { from = m; fromCtx = C[k]; }
      });
      c.own = own; c.fromBelow = from; c.fromCtx = fromCtx;
      c.tpq = own && (!from || own.a >= from.a) ? own.a : from ? from.a : null;
    });

    // the question: prefer the top fill of a cut whose date is really set by something under it
    var cand = [];
    alive.forEach(function (c) {
      if (c.kind !== 'cut') return;
      var F = C[c.fills[c.fills.length - 1]];
      if (F.tpq == null) return;
      var gain = F.fromBelow && (!F.own || F.fromBelow.a > F.own.a) ? F.fromBelow.a - (F.own ? F.own.a : F.fromBelow.a - 400) : -1;
      cand.push({ F: F, score: gain > 0 ? 10000 + gain : F.tpq });
    });
    cand.sort(function (a, b) { return b.score - a.score; });
    var question = cand.length ? cand[0].F : null;

    // site name
    var A = ['Ash', 'Brad', 'Cold', 'Hal', 'Kel', 'Lang', 'Mar', 'Nor', 'Red', 'Stan', 'Thorn', 'Wal', 'Whit', 'Elm', 'Fen', 'Ock'];
    var B = ['bury', 'combe', 'ford', 'ham', 'ley', 'stow', 'thorpe', 'ton', 'wick', 'worth', 'field', 'well'];
    var town = pick(r, A) + pick(r, B);
    if (r() < 0.3) town = pick(r, ['Great ', 'Little ', 'Upper ', 'Long ']) + town;
    var street = pick(r, ['Mill Lane', 'Church Street', 'Back Lane', 'Pound Lane', 'Castle Hill', 'Well Street', 'Tithe Barn Close', 'Brewery Lane', 'Chapel Row', 'Station Road', 'Priory Road']);
    var code = (town.replace(/^(Great|Little|Upper|Long) /, '').slice(0, 2) + street.charAt(0)).toUpperCase();
    var trench = 1 + Math.floor(r() * 6);

    // top and bottom of what's worth drawing
    var top = 0, lo = ROWS;
    for (x = 0; x < COLS; x++) top = Math.max(top, s[x]);
    alive.forEach(function (c) { if (c.kind === 'cut') lo = Math.min(lo, c.bottom); });
    top = Math.min(ROWS, top + 12);
    var bot = Math.max(0, Math.min(lo - 12, 24));

    return {
      grid: grid, C: C, ids: ids, alive: alive, later: later, earlier: earlier, below: below, red: red,
      nat: nat, N: N, question: question, town: town, street: street, code: code, trench: trench,
      top: top, bot: bot, periods: per, surface: s
    };
  }

  /* ---------- state ---------- */
  var S = { day: 0, W: null, dug: {}, digT: {}, hover: -1, mistakes: 0, order: [], answered: null, msg: '' };
  var cv = $('section'), ctx = cv.getContext('2d');
  var off = document.createElement('canvas'), octx = off.getContext('2d');
  var base = null, img = null, CW = 0, CH = 0, VR = 0, dpr = 1;

  function tag(c) { return c.kind === 'cut' ? '[' + c.num + ']' : '(' + c.num + ')'; }
  function kindName(c) {
    if (c.kind === 'natural') return 'Natural';
    if (c.kind === 'cut') return 'Cut of ' + CUTNAME[c.type];
    if (c.kind === 'fill') return 'Fill of ' + tag(S.W.C[c.cut]);
    return 'Layer';
  }
  function isDeposit(c) { return c.kind === 'layer' || c.kind === 'fill'; }
  function blockers(id) {
    var W = S.W, out = [];
    Object.keys(W.later[id]).forEach(function (k) { if (!S.dug[k]) out.push(+k); });
    return out;
  }
  function canDig(id) { var c = S.W.C[id]; return isDeposit(c) && !S.dug[id] && blockers(id).length === 0; }
  function totalDeposits() { return S.W.alive.filter(isDeposit).length; }
  function dugDeposits() { return S.W.alive.filter(function (c) { return isDeposit(c) && S.dug[c.id]; }).length; }

  function load() {
    var d = dateFor(S.day);
    S.W = build(seedForDate(d));
    S.dug = {}; S.digT = {}; S.hover = -1; S.mistakes = 0; S.order = []; S.answered = null;
    S.msg = 'The section is cleaned and drawn. Start at the top: click whatever you think came last.';
    var W = S.W;
    VR = W.top - W.bot;
    off.width = COLS; off.height = VR;
    img = octx.createImageData(COLS, VR);
    base = new Uint8ClampedArray(COLS * VR * 3);
    var hr = rng(seedForDate(d) ^ 0x5bd1e995);
    for (var vy = 0; vy < VR; vy++) {
      var e = W.top - 1 - vy;
      for (var x = 0; x < COLS; x++) {
        var id = W.grid[e * COLS + x], q = (vy * COLS + x) * 3;
        if (id < 0) { base[q] = 6; base[q + 1] = 8; base[q + 2] = 12; continue; }
        var T = TYPES[W.C[id].type], col = T.col, rr = hr();
        if (T.sp2 && rr < T.sp2[0]) col = T.sp2[1];
        else if (rr < T.sp[0] + (T.sp2 ? T.sp2[0] : 0) && rr >= (T.sp2 ? T.sp2[0] : 0)) col = T.sp[1];
        var j = 0.9 + hr() * 0.16;
        base[q] = col[0] * j; base[q + 1] = col[1] * j; base[q + 2] = col[2] * j;
      }
    }
    $('siteWho').textContent = 'Site code ' + W.code + String(dateFor(S.day).getFullYear()).slice(2) + ' · evaluation trench ' + W.trench;
    $('siteName').textContent = 'Land off ' + W.street + ', ' + W.town;
    var nC = W.alive.filter(function (c) { return c.kind === 'cut'; }).length;
    $('siteBlurb').textContent = 'A six-metre trench, machined down to the first archaeology and then cleaned by hand. ' +
      'The long side has been scraped back and drawn: ' + totalDeposits() + ' deposits and ' + nC + ' cut' + (nC === 1 ? '' : 's') +
      ' sitting on natural ' + { chalk: 'chalk', gravel: 'sand and gravel', clay: 'clay' }[W.nat] +
      '. Somebody has to take it apart one deposit at a time, latest first, and keep what came out of each one separate. That is you.';
    $('dayOut').textContent = S.day === 0 ? 'today' : (S.day > 0 ? S.day + ' day' + (S.day > 1 ? 's' : '') + ' on' : -S.day + ' day' + (S.day < -1 ? 's' : '') + ' back');
    $('fDate').textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('fCode').textContent = W.code + String(d.getFullYear()).slice(2);
    $('fNat').textContent = TYPES[W.nat].d.replace(/^natural /, '');
    $('fCtx').textContent = W.alive.length - 1 + ' (' + totalDeposits() + ' deposits, ' + nC + ' cuts)';
    var deep = 0; W.alive.forEach(function (c) { if (c.kind === 'cut') deep = Math.max(deep, c.depth); });
    $('fDeep').textContent = (deep * CM / 100).toFixed(2) + ' m';
    $('fPer').textContent = 'dig it and see';
    resize();
    matrix(); register(); status(); verdict();
  }

  /* ---------- drawing the section ---------- */
  function resize() {
    if (!S.W) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    CW = cv.clientWidth; CH = Math.round(CW * VR * VE / COLS);
    cv.style.height = CH + 'px';
    cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
    draw(performance.now());
  }
  var animating = false;
  function draw(now) {
    var W = S.W; if (!W || !CW) return;
    var d = img.data, anim = false;
    var digK = {};
    Object.keys(S.digT).forEach(function (k) {
      var t = (now - S.digT[k]) / 420;
      if (t < 1) { digK[k] = t; anim = true; } else digK[k] = 1;
    });
    for (var vy = 0; vy < VR; vy++) {
      var e = W.top - 1 - vy;
      for (var x = 0; x < COLS; x++) {
        var id = W.grid[e * COLS + x], q = vy * COLS + x, b = q * 3, p = q * 4;
        var R = base[b], G = base[b + 1], B = base[b + 2];
        if (id >= 0 && S.dug[id]) {
          var k = digK[id] == null ? 1 : digK[id];
          var gr = ((x % 50 === 0) || (e % 50 === 0)) ? 22 : 13;
          R = R + (gr - R) * k; G = G + (gr + 3 - G) * k; B = B + (gr + 8 - B) * k;
        } else if (id >= 0 && id === S.hover) {
          R = R + (255 - R) * 0.22; G = G + (240 - G) * 0.22; B = B + (200 - B) * 0.22;
        }
        d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, CW, CH);

    // boundaries: faint between deposits, firm along cut lines, pale along the dug face
    var sx = CW / COLS, sy = CH / VR;
    var faint = new Path2D(), firm = new Path2D(), face = new Path2D(), hi = new Path2D();
    function lab(id) { return id < 0 ? -1 : S.dug[id] ? -2 : id; }
    function isCutEdge(a, b) {
      var A = W.C[a], B = W.C[b];
      if (A.kind === 'fill' && !(B.kind === 'fill' && B.cut === A.cut)) return true;
      if (B.kind === 'fill' && !(A.kind === 'fill' && A.cut === B.cut)) return true;
      return false;
    }
    for (vy = 0; vy < VR; vy++) {
      e = W.top - 1 - vy;
      for (x = 0; x < COLS; x++) {
        var a = lab(W.grid[e * COLS + x]);
        if (x < COLS - 1) {
          var bR = lab(W.grid[e * COLS + x + 1]);
          if (a !== bR) edge(a, bR, (x + 1) * sx, vy * sy, (x + 1) * sx, (vy + 1) * sy);
        }
        if (e < W.top - 1) {
          var bU = lab(W.grid[(e + 1) * COLS + x]);
          if (a !== bU) edge(a, bU, x * sx, vy * sy, (x + 1) * sx, vy * sy);
        }
      }
    }
    function edge(a, b, x0, y0, x1, y1) {
      var P;
      if (a === -1 || b === -1) { if (a === -2 || b === -2) return; P = face; }
      else if (a === -2 || b === -2) P = face;
      else P = isCutEdge(a, b) ? firm : faint;
      P.moveTo(x0, y0); P.lineTo(x1, y1);
      if (S.hover >= 0 && (a === S.hover || b === S.hover)) { hi.moveTo(x0, y0); hi.lineTo(x1, y1); }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(20,14,10,.38)'; ctx.stroke(faint);
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(12,8,6,.85)'; ctx.stroke(firm);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(232,237,245,.28)'; ctx.stroke(face);
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,233,168,.95)'; ctx.stroke(hi);

    // labels
    var showAll = $('labelChk').checked;
    ctx.font = '600 ' + (CW < 520 ? 9 : 11) + 'px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var placed = [], fs = CW < 520 ? 9 : 11;
    var list = W.alive.filter(function (c) { return !S.dug[c.id]; });
    list.sort(function (a, b) { return (b.id === S.hover) - (a.id === S.hover) || (b.cells || 0) - (a.cells || 0); });
    list.forEach(function (c) {
      var hov = c.id === S.hover || (S.hover >= 0 && W.C[S.hover].cut === c.id);
      if (c.kind === 'cut' ? !hov : !(showAll || hov)) return;
      var px, py;
      if (c.kind === 'cut') {
        px = c.cx * sx; py = (W.top - c.bottom + 1.8) * sy + 7;
        if (py > CH - 6) py = CH - 8;
      } else {
        if (!c.lab) return;
        px = (c.lab.x + 0.5) * sx; py = (W.top - 1 - c.lab.e + 0.5) * sy;
      }
      var t = tag(c), tw = ctx.measureText(t).width + 4;
      var bx = { x0: px - tw / 2, x1: px + tw / 2, y0: py - fs / 2 - 1, y1: py + fs / 2 + 1 };
      if (!hov && placed.some(function (q) { return bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0; })) return;
      placed.push(bx);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,8,10,.7)'; ctx.strokeText(t, px, py);
      ctx.fillStyle = c.kind === 'cut' ? '#ffe9a8' : canDig(c.id) ? '#ffffff' : 'rgba(240,236,226,.82)';
      ctx.fillText(t, px, py);
    });

    // scale: one-metre bar and depth ticks
    ctx.fillStyle = 'rgba(232,237,245,.8)'; ctx.strokeStyle = 'rgba(232,237,245,.8)'; ctx.lineWidth = 1;
    var m = 100 / CM * sx, bx = CW - m - 12, by = 12;
    ctx.fillRect(bx, by, m / 2, 3); ctx.strokeRect(bx + m / 2, by, m / 2, 3);
    ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.textAlign = 'right';
    ctx.fillText('1 m', bx - 5, by + 2);
    ctx.textAlign = 'left';

    if (anim) { if (!animating) { animating = true; requestAnimationFrame(function (t) { animating = false; draw(t); }); } }
  }

  /* ---------- the Harris matrix ---------- */
  var MW = 640;
  function matrix() {
    var W = S.W, lvl = {};
    var order = W.ids.slice().sort(function (a, b) { return b - a; });
    order.forEach(function (id) { lvl[id] = 0; });
    order.forEach(function (id) {
      Object.keys(W.red[id]).forEach(function (k) { lvl[k] = Math.max(lvl[k], lvl[id] + 1); });
    });
    var maxL = 0; W.ids.forEach(function (id) { if (id !== W.N.id) maxL = Math.max(maxL, lvl[id]); });
    lvl[W.N.id] = maxL + 1;
    var rows = {};
    W.ids.forEach(function (id) { (rows[lvl[id]] = rows[lvl[id]] || []).push(id); });
    var RH = 44, pos = {}, bw = 50;
    Object.keys(rows).forEach(function (L) {
      var list = rows[L].sort(function (a, b) { return W.C[a].cx - W.C[b].cx; });
      var sp = Math.min(60, (MW - 40) / list.length), w = Math.min(bw, sp - 6);
      var xs = list.map(function (id) { return 20 + w / 2 + (W.C[id].cx / COLS) * (MW - 40 - w); });
      for (var i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + sp);
      var R = MW - 20 - w / 2;
      if (xs[xs.length - 1] > R) {
        xs[xs.length - 1] = R;
        for (i = xs.length - 1; i > 0; i--) xs[i - 1] = Math.min(xs[i - 1], xs[i] - sp);
      }
      if (xs[0] < 20 + w / 2) { var sh = 20 + w / 2 - xs[0]; xs = xs.map(function (v) { return v + sh; }); }
      list.forEach(function (id, i) { pos[id] = { x: xs[i], y: 22 + (+L) * RH, w: w }; });
    });
    if (lvl[W.N.id] != null) pos[W.N.id] = { x: MW / 2, y: 22 + lvl[W.N.id] * RH, w: 90 };
    var H = 44 + lvl[W.N.id] * RH, h = 22;
    var svg = '<svg viewBox="0 0 ' + MW + ' ' + H + '" width="100%" role="img" aria-label="Harris matrix of the trench">';
    svg += '<g fill="none" stroke-width="1.2">';
    W.ids.forEach(function (id) {
      Object.keys(W.red[id]).forEach(function (k) {
        var a = pos[id], b = pos[k], ym = b.y - h / 2 - 9;
        var done = S.dug[id];
        svg += '<path d="M' + a.x.toFixed(1) + ' ' + (a.y + h / 2) + ' V' + ym.toFixed(1) + ' H' + b.x.toFixed(1) + ' V' + (b.y - h / 2) + '" stroke="' + (done ? 'rgba(100,240,200,.5)' : 'rgba(255,255,255,.22)') + '"/>';
      });
    });
    svg += '</g>';
    W.ids.forEach(function (id) {
      var c = W.C[id], p = pos[id], cls = 'mn';
      if (c.kind === 'natural') cls += ' nat';
      else if (S.dug[id]) cls += ' dug';
      else if (canDig(id)) cls += ' ready';
      if (c.kind === 'cut') cls += ' cut';
      if (id === S.hover) cls += ' hov';
      svg += '<g class="' + cls + '" data-id="' + id + '"><rect x="' + (p.x - p.w / 2).toFixed(1) + '" y="' + (p.y - h / 2) + '" width="' + p.w.toFixed(1) + '" height="' + h + '" rx="' + (c.kind === 'cut' ? 2 : 6) + '"/>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 4) + '">' + (c.kind === 'natural' ? 'natural' : c.num) + '</text></g>';
    });
    svg += '</svg>';
    $('matrix').innerHTML = svg;
  }

  /* ---------- notebook, register, verdict ---------- */
  function describe(id) {
    var W = S.W, c = W.C[id];
    if (c.kind === 'natural') return 'Natural: ' + TYPES[c.type].d.replace(/^natural /, '') + '. Nobody put this here. When you reach it everywhere, you are finished.';
    if (c.kind === 'cut') {
      var cutsWhat = Object.keys(W.earlier[id]).map(function (k) { return tag(W.C[k]); });
      return tag(c) + ' Cut of a ' + CUTNAME[c.type] + ', ' + (c.depth * CM / 100).toFixed(2) + ' m deep. Filled by ' + c.fills.map(function (f) { return tag(W.C[f]); }).join(', ') + '. Cuts ' + cutsWhat.join(', ') + '.' + (S.dug[id] ? ' Emptied.' : '');
    }
    var t = tag(c) + ' ' + kindName(c) + '. ' + TYPES[c.type].d.charAt(0).toUpperCase() + TYPES[c.type].d.slice(1) + ', up to ' + (c.thick / 100).toFixed(2) + ' m thick.';
    if (S.dug[id]) return t + ' Dug. ' + (c.finds.length ? c.finds.length + ' find' + (c.finds.length > 1 ? 's' : '') + ' bagged.' : 'Nothing in it.');
    var bl = blockers(id);
    if (!bl.length) return t + ' Nothing later is over it or cutting it now. It can come out.';
    return t + ' Not yet: ' + bl.map(function (k) { var o = W.C[k]; return o.kind === 'cut' ? tag(o) + ' cuts it' : tag(o) + ' is over it'; }).join(', ') + '.';
  }
  function status() {
    var n = dugDeposits(), T = totalDeposits();
    $('book').innerHTML = '<h4>Site notebook</h4>' +
      '<div>Deposits dug: <b>' + n + '</b> of ' + T + '</div>' +
      '<div>Dug out of order: <b>' + S.mistakes + '</b></div>' +
      '<div>Finds bagged: <b>' + S.order.reduce(function (s, id) { return s + S.W.C[id].finds.length; }, 0) + '</b></div>' +
      '<div class="last">' + esc(S.msg) + '</div>';
    $('btnUndo').disabled = !S.order.length || n === T && S.answered != null;
  }
  function register() {
    var W = S.W, rows = '';
    S.order.slice().reverse().forEach(function (id) {
      var c = W.C[id];
      if (!c.finds.length) { rows += '<tr><td class="m">' + tag(c) + '</td><td class="d">no finds</td><td></td></tr>'; return; }
      c.finds.forEach(function (f, i) {
        rows += '<tr><td class="m">' + (i ? '' : tag(c)) + '</td><td>' + esc(f.n) + '</td><td class="m">' + (f.a != null ? fmtR(f.a, f.b) : '<span class="d">undated</span>') + '</td></tr>';
      });
    });
    $('reg').innerHTML = rows || '<tr><td colspan="3" class="d">Nothing recorded yet. The register fills up as you dig.</td></tr>';
  }
  function verdict() {
    var W = S.W, v = $('verdict'), F = W.question;
    if (dugDeposits() < totalDeposits()) {
      v.className = 'verdict';
      v.innerHTML = 'Take it all down to natural. When the last deposit is out, there is a question about ' + (F ? '<b>' + tag(F) + '</b>' : 'the site') + ' waiting here.';
      return;
    }
    if (!F) {
      v.className = 'verdict good';
      v.innerHTML = 'Down to natural. Nothing on this site could be dated from its finds. It happens: some days it is all bone and charcoal. ' + history();
      $('fPer').textContent = W.periods.map(function (p) { return p.name; }).join(', ');
      return;
    }
    var K = W.C[F.cut];
    var dates = {};
    W.alive.forEach(function (c) { c.finds.forEach(function (f) { if (f.a != null) dates[f.a] = 1; }); });
    var all = Object.keys(dates).map(Number).sort(function (a, b) { return a - b; });
    var ci = all.indexOf(F.tpq), opts = all.slice(Math.max(0, ci - 4), ci + 4);
    if (S.answered == null) {
      v.className = 'verdict';
      v.innerHTML = '<b>Down to natural.</b> Now the question. What is the earliest date that ' + tag(F) + ', the top fill of ' + CUTNAME[K.type] + ' ' + tag(K) +
        ', could have gone in? Use the register and the matrix.' +
        '<div class="opts">' + opts.map(function (y) { return '<button class="btn small ghost" data-y="' + y + '">' + fmtY(y) + '</button>'; }).join('') + '</div>';
      return;
    }
    var ok = S.answered === F.tpq, h = '';
    h += ok ? '<b>Right: ' + fmtY(F.tpq) + '.</b> ' : '<b>Not ' + fmtY(S.answered) + '. It is ' + fmtY(F.tpq) + '.</b> ';
    if (F.fromBelow && (!F.own || F.fromBelow.a > F.own.a)) {
      h += (F.own ? 'The newest thing in ' + tag(F) + ' itself is ' + esc(an(F.own.n)) + ', made from ' + fmtY(F.own.a) + '. But ' : 'There is nothing dateable in ' + tag(F) + ' itself. But ') +
        tag(F) + ' lies above ' + tag(F.fromCtx) + ' in the matrix, and ' + tag(F.fromCtx) + ' holds ' + esc(an(F.fromBelow.n)) + ', which nobody made before ' + fmtY(F.fromBelow.a) +
        '. Whatever is on top of it has to be later still. ';
    } else {
      h += 'The newest thing in ' + tag(F) + ' is ' + esc(an(F.own.n)) + ', which nobody made before ' + fmtY(F.own.a) + ', and nothing underneath it is any later. ';
    }
    if (S.answered > F.tpq) h += 'A later date may well be true, but nothing you found proves it. The finds only ever give a floor. ';
    var viaBelow = F.fromBelow && (!F.own || F.fromBelow.a > F.own.a);
    if (S.answered < F.tpq) h += viaBelow ? 'That date is right for something in the trench, but it ignores what the fill is sitting on. ' : 'That is too early for what is in the fill itself. ';
    h += 'In fact it went in ' + circa(F.date) + '.';
    h += history();
    v.className = 'verdict ' + (ok ? 'good' : 'warn');
    v.innerHTML = h;
    $('fPer').textContent = W.periods.map(function (p) { return p.name; }).join(', ');
  }
  function history() {
    var W = S.W, ev = [];
    W.alive.forEach(function (c) {
      if (c.kind === 'layer') ev.push({ d: c.date, t: esc(LAYERWHY[c.type]) + ': ' + tag(c) });
      if (c.kind === 'cut') ev.push({ d: c.date, t: esc(CUTWHY[c.type]) + ': ' + tag(c) + ', filled by ' + c.fills.map(function (f) { return tag(W.C[f]); }).join(', ') });
    });
    ev.sort(function (a, b) { return a.d - b.d; });
    return '<div class="hist"><h4>What actually happened here</h4><ol>' + ev.map(function (e) { return '<li><span>' + circa(e.d) + '</span> ' + e.t + '</li>'; }).join('') +
      '</ol><p>You dug it out of order ' + (S.mistakes ? S.mistakes + ' time' + (S.mistakes > 1 ? 's' : '') + ' and were stopped' : 'no times at all') + '.</p></div>';
  }

  /* ---------- digging ---------- */
  function dig(id) {
    var W = S.W, c = W.C[id];
    if (!c || S.dug[id]) return;
    if (c.kind === 'natural') { S.msg = 'That is natural. Nobody put it there, and it stays.'; status(); return; }
    if (c.kind === 'cut') { S.msg = tag(c) + ' is a cut, an edge rather than a thing. It is empty once its fills are out.'; status(); return; }
    var bl = blockers(id);
    if (bl.length) {
      S.mistakes++;
      S.msg = 'Stop. ' + tag(c) + ' is not the latest thing here: ' + bl.map(function (k) { var o = W.C[k]; return o.kind === 'cut' ? tag(o) + ' cuts through it and is still full' : tag(o) + ' is on top of it'; }).join(', and ') +
        '. Dig it now and the finds from both end up in one bag.';
      status(); draw(performance.now());
      return;
    }
    S.dug[id] = 1; S.digT[id] = performance.now(); S.order.push(id);
    // an emptied cut comes away with its last fill
    var changed = true;
    while (changed) {
      changed = false;
      W.alive.forEach(function (k) {
        if (k.kind === 'cut' && !S.dug[k.id] && k.fills.every(function (f) { return S.dug[f]; }) && blockers(k.id).length === 0) { S.dug[k.id] = 1; changed = true; }
      });
    }
    var f = c.finds.length;
    S.msg = tag(c) + ' is out. ' + (f ? f + ' find' + (f > 1 ? 's' : '') + ' bagged and labelled ' + tag(c) + '.' : 'Nothing in it.');
    if (c.kind === 'fill' && S.dug[c.cut]) S.msg += ' ' + tag(W.C[c.cut]) + ' is empty.';
    if (dugDeposits() === totalDeposits()) S.msg = 'Down to natural everywhere. The question is below.';
    matrix(); register(); status(); verdict(); draw(performance.now());
  }
  function undo() {
    if (!S.order.length) return;
    var id = S.order.pop();
    delete S.dug[id]; delete S.digT[id];
    S.W.alive.forEach(function (k) { if (k.kind === 'cut' && S.dug[k.id] && !k.fills.every(function (f) { return S.dug[f]; })) delete S.dug[k.id]; });
    S.answered = null;
    S.msg = 'Put ' + tag(S.W.C[id]) + ' back.';
    matrix(); register(); status(); verdict(); draw(performance.now());
  }

  /* ---------- input ---------- */
  function cellAt(e) {
    var r = cv.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * COLS), vy = Math.floor((e.clientY - r.top) / r.height * VR);
    if (x < 0 || x >= COLS || vy < 0 || vy >= VR) return -1;
    var id = S.W.grid[(S.W.top - 1 - vy) * COLS + x];
    return id >= 0 && !S.dug[id] ? id : -1;
  }
  function setHover(id) {
    if (id === S.hover) return;
    S.hover = id;
    $('readout').textContent = id >= 0 ? describe(id) : 'Move over the section to read a context. Click one to dig it.';
    draw(performance.now());
    var gs = $('matrix').querySelectorAll('g[data-id]');
    for (var i = 0; i < gs.length; i++) gs[i].classList.toggle('hov', +gs[i].getAttribute('data-id') === id);
  }
  cv.addEventListener('pointermove', function (e) { setHover(cellAt(e)); });
  cv.addEventListener('pointerleave', function () { setHover(-1); });
  cv.addEventListener('pointerdown', function (e) { var id = cellAt(e); if (id >= 0) { dig(id); setHover(cellAt(e)); $('readout').textContent = describe(id); } });
  var mx = $('matrix');
  mx.addEventListener('pointerover', function (e) { var g = e.target.closest && e.target.closest('g[data-id]'); if (g) { var id = +g.getAttribute('data-id'); if (!S.dug[id] || S.W.C[id].kind === 'natural') setHover(id); $('readout').textContent = describe(id); } });
  mx.addEventListener('pointerleave', function () { setHover(-1); });
  mx.addEventListener('click', function (e) { var g = e.target.closest && e.target.closest('g[data-id]'); if (g) dig(+g.getAttribute('data-id')); });
  $('verdict').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-y]');
    if (!b || S.answered != null) return;
    S.answered = +b.getAttribute('data-y'); verdict(); status();
  });
  $('btnUndo').addEventListener('click', undo);
  $('btnRestart').addEventListener('click', load);
  $('labelChk').addEventListener('change', function () { draw(performance.now()); });
  function goDay(d) { S.day = d; load(); }
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  document.addEventListener('keydown', function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') goDay(S.day - 1);
    else if (e.key === 'ArrowRight') goDay(S.day + 1);
    else if (e.key === 'u' || e.key === 'U') undo();
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 60); });

  load();
})();
