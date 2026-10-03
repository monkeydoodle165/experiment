/* drift.quibo.games — The Herbarium
   Identification. The day's number invents the flora of a stretch of country: nine to twelve
   flowering plants, each with its own leaves, hairs, petals and colour. It then writes a
   dichotomous key to them, splitting the flora as evenly as it can at every couplet, and
   puts six pressed specimens on the bench. You key each sheet out by choosing between two
   leads at a time, check the name you reach against the species account, and determine the
   sheet. One of the six is not in the flora at all: it keys out cleanly to a species it is
   not, because a key only tests the characters it needs to separate the plants it knows.
   Plants, places and collectors are invented. Self-contained. */
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
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
  function longDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function f1(x) { return (Math.round(x * 10) / 10).toString(); }
  function joinOr(a) { return a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- the characters a key can use ---------- */
  var TRAITS = [
    { k: 'arr', pre: 'Leaves', name: 'leaf arrangement',
      vals: ['alternate', 'opposite', 'whorled'],
      long: { alternate: 'alternate, one at each node', opposite: 'opposite, in pairs at each node', whorled: 'in whorls of three at each node' },
      short: { alternate: 'alternate', opposite: 'opposite', whorled: 'in whorls of three' } },
    { k: 'type', pre: 'Leaves', name: 'leaf division',
      vals: ['simple', 'pinnate'],
      long: { simple: 'simple, with one undivided blade', pinnate: 'pinnate, cut right down into separate leaflets' },
      short: { simple: 'simple', pinnate: 'pinnate' } },
    { k: 'shape', pre: 'Leaf blade', name: 'leaf shape',
      vals: ['linear', 'lanceolate', 'ovate', 'cordate', 'palmate'],
      long: { linear: 'linear, long and grass-like', lanceolate: 'lanceolate, narrow and tapering to both ends', ovate: 'ovate, broadest below the middle', cordate: 'heart-shaped, with two rounded lobes at the base', palmate: 'palmately lobed, like a spread hand' },
      short: { linear: 'linear', lanceolate: 'lanceolate', ovate: 'ovate', cordate: 'heart-shaped', palmate: 'palmately lobed' } },
    { k: 'margin', pre: 'Leaf margins', name: 'leaf margin',
      vals: ['entire', 'toothed'],
      long: { entire: 'entire, smooth all the way round', toothed: 'toothed, like a saw' },
      short: { entire: 'entire', toothed: 'toothed' } },
    { k: 'hair', pre: 'Stem', name: 'stem surface',
      vals: ['hairy', 'smooth'],
      long: { hairy: 'hairy, with short spreading hairs (use the lens)', smooth: 'smooth and hairless' },
      short: { hairy: 'hairy', smooth: 'smooth' } },
    { k: 'infl', pre: 'Flowers', name: 'flower arrangement',
      vals: ['single', 'cluster'],
      long: { single: 'single, one at the top of the stem', cluster: 'several together in a cluster at the top of the stem' },
      short: { single: 'single', cluster: 'clustered' } },
    { k: 'petals', pre: 'Petals', name: 'petal number',
      vals: ['3', '4', '5', '6'],
      long: { 3: '3', 4: '4', 5: '5', 6: '6' },
      short: { 3: '3', 4: '4', 5: '5', 6: '6' } },
    { k: 'colour', pre: 'Flowers', name: 'flower colour',
      vals: ['white', 'yellow', 'pink', 'blue', 'purple'],
      long: { white: 'white', yellow: 'yellow', pink: 'pink', blue: 'blue', purple: 'purple' },
      short: { white: 'white', yellow: 'yellow', pink: 'pink', blue: 'blue', purple: 'purple' } }
  ];
  var T = {}; TRAITS.forEach(function (t, i) { t.i = i; T[t.k] = t; });
  function has(sp, k) { return sp[k] != null; }
  function lead(t, vals) {
    if (vals.length === 1) return t.pre + ' ' + t.long[vals[0]];
    return t.pre + ' ' + joinOr(vals.map(function (v) { return t.short[v]; }));
  }
  var FEAT = {
    arr: { alternate: 'alternate leaves', opposite: 'opposite leaves', whorled: 'leaves in whorls of three' },
    type: { simple: 'simple leaves', pinnate: 'pinnate leaves' },
    shape: { linear: 'linear leaf blades', lanceolate: 'lanceolate leaf blades', ovate: 'ovate leaf blades', cordate: 'heart-shaped leaf blades', palmate: 'palmately lobed leaves' },
    margin: { entire: 'entire leaf margins', toothed: 'toothed leaf margins' },
    hair: { hairy: 'a hairy stem', smooth: 'a smooth stem' },
    infl: { single: 'a single flower', cluster: 'flowers in a cluster' },
    petals: { 3: '3 petals', 4: '4 petals', 5: '5 petals', 6: '6 petals' },
    colour: { white: 'white flowers', yellow: 'yellow flowers', pink: 'pink flowers', blue: 'blue flowers', purple: 'purple flowers' }
  };
  function says(t, v) { return FEAT[t.k][v]; }

  /* ---------- names ---------- */
  var PRE = ['Ash', 'Brack', 'Cold', 'Dun', 'Elder', 'Fern', 'Hollow', 'Kings', 'Long', 'Nether', 'Oak', 'Rush', 'Thorn', 'Wend', 'Yarn', 'Bram', 'Cress', 'Hart', 'Sedge', 'Wold'];
  var SUF = ['combe', 'holt', 'mere', 'stow', 'ford', 'worthy', 'barrow', 'ley', 'hurst', 'wick', 'den', 'cote'];
  var LAND = ['Downs', 'Fells', 'Levels', 'Moors', 'Wolds', 'Marshes', 'Brecks', 'Vale', 'Heaths', 'Hills'];
  var GENERA = [
    ['Corvalia', 'crowbell'], ['Lumenella', 'lampwort'], ['Pratilla', 'meadowcup'], ['Calvissa', 'baldweed'],
    ['Merrowia', 'merrowflower'], ['Thallira', 'tallowort'], ['Vesperina', 'evenstar'], ['Pennaria', 'pennyquill'],
    ['Dorrena', 'dorweed'], ['Ossaria', 'bonewort'], ['Fennira', 'fenbell'], ['Sallowa', 'sallowcup'],
    ['Brumelia', 'mistflower'], ['Halcyra', 'kingfisher-weed'], ['Tinnaria', 'tinklebell']
  ];
  var EPI = {
    arr: { alternate: [['alternifolia', 'Alternate-leaved']], opposite: [['oppositifolia', 'Opposite-leaved'], ['geminata', 'Paired']], whorled: [['verticillata', 'Whorled'], ['stellata', 'Starry']] },
    type: { pinnate: [['pinnata', 'Fern-leaved'], ['filicifolia', 'Feathery']] },
    shape: { linear: [['linearis', 'Narrow-leaved'], ['graminea', 'Grassy']], lanceolate: [['lanceolata', 'Spear-leaved']], ovate: [['ovata', 'Broad-leaved'], ['latifolia', 'Wide-leaved']], cordate: [['cordata', 'Heart-leaved'], ['cordifolia', 'Round-hearted']], palmate: [['palmata', 'Hand-leaved'], ['digitata', 'Fingered']] },
    margin: { toothed: [['serrata', 'Saw-leaved'], ['dentata', 'Toothed']], entire: [['integrifolia', 'Smooth-edged']] },
    hair: { hairy: [['hirsuta', 'Hairy'], ['villosa', 'Shaggy'], ['pilosa', 'Downy']], smooth: [['glabra', 'Bald'], ['laevis', 'Smooth']] },
    infl: { cluster: [['umbellata', 'Clustered'], ['glomerata', 'Crowded']], single: [['uniflora', 'One-flowered'], ['solitaria', 'Lonely']] },
    colour: { white: [['alba', 'White'], ['nivea', 'Snowy']], yellow: [['lutea', 'Yellow'], ['aurea', 'Golden']], pink: [['rosea', 'Pink'], ['carnea', 'Blushing']], blue: [['caerulea', 'Blue'], ['azurea', 'Sky']], purple: [['purpurea', 'Purple'], ['violacea', 'Violet']] }
  };
  var GENERIC = [['vulgaris', 'Common'], ['sylvatica', 'Wood'], ['montana', 'Hill'], ['palustris', 'Marsh'], ['minor', 'Lesser'], ['major', 'Greater'], ['elegans', 'Elegant'], ['gracilis', 'Slender'], ['borealis', 'Northern'], ['serotina', 'Late']];
  var HABITATS = [
    ['chalk grassland', 'Short turf on the chalk bank'], ['damp woodland rides', 'Wet ride in the wood'], ['ditch banks', 'Bank of the drain'],
    ['old walls', 'Mortar of the churchyard wall'], ['dry heathland', 'Bare sand on the heath'], ['river shingle', 'Shingle bar in the river'],
    ['hedgebanks', 'Foot of the hedge'], ['wet flushes', 'Spring-line flush'], ['cornfield margins', 'Edge of the barley'],
    ['sea cliffs', 'Ledge on the cliff path'], ['limestone scree', 'Loose scree below the scar'], ['peaty bogs', 'Sphagnum lawn on the moss']
  ];
  var NEAR = ['above the mill', 'below the church', 'by Long Lane', 'near the old quarry', 'beside the ford', 'behind the forge', 'at the parish boundary', 'under the beacon', 'past the lime kiln'];
  var INIT = ['E. M.', 'R. A.', 'J. H.', 'C. F.', 'M. L.', 'W. T.', 'A. K.', 'H. G.', 'F. B.', 'G. S.'];
  var SURN = ['Thorne', 'Pellow', 'Ashby', 'Ruddle', 'Kemble', 'Garrow', 'Hensey', 'Lomax', 'Tilby', 'Wrenfield', 'Cobham', 'Dacre'];

  function genFlora(r) {
    var n = 9 + Math.floor(r() * 4), sp = [], guard = 0;
    while (sp.length < n && guard++ < 4000) {
      var s = {
        arr: pick(r, ['alternate', 'alternate', 'opposite', 'opposite', 'whorled']),
        type: r() < 0.24 ? 'pinnate' : 'simple',
        margin: pick(r, T.margin.vals), hair: pick(r, T.hair.vals), infl: pick(r, T.infl.vals),
        petals: pick(r, ['3', '4', '4', '5', '5', '5', '6']), colour: pick(r, T.colour.vals)
      };
      s.shape = s.type === 'simple' ? pick(r, T.shape.vals) : null;
      if (sp.every(function (o) { return diff(o, s) >= 2; })) sp.push(s);
    }
    return sp;
  }
  function diff(a, b) {
    var d = 0;
    TRAITS.forEach(function (t) {
      if (t.k === 'shape') { if (a.shape && b.shape && a.shape !== b.shape) d++; }
      else if (a[t.k] !== b[t.k]) d++;
    });
    return d;
  }
  function nameFlora(r, sp) {
    var gen = shuffle(r, GENERA.slice()), byP = {}, gi = 0;
    sp.forEach(function (s) {
      if (!byP[s.petals]) byP[s.petals] = { g: gen[gi++], used: {}, adj: {} };
      var G = byP[s.petals], cands = [];
      TRAITS.forEach(function (t) { var e = EPI[t.k] && EPI[t.k][s[t.k]]; if (e) e.forEach(function (x) { cands.push(x); }); });
      cands = shuffle(r, cands).concat(shuffle(r, GENERIC.slice()));
      var c = cands.filter(function (x) { return !G.used[x[0]] && !G.adj[x[1]]; })[0] || ['nova', 'New'];
      G.used[c[0]] = 1; G.adj[c[1]] = 1;
      s.genus = G.g[0]; s.gcommon = G.g[1]; s.epithet = c[0];
      s.common = c[1] + ' ' + G.g[1];
      var h = pick(r, HABITATS); s.habitat = h[0]; s.where = h[1];
      var m0 = 3 + Math.floor(r() * 5); s.months = MONTHS[m0] + (r() < 0.8 ? '–' + MONTHS[Math.min(9, m0 + 1 + Math.floor(r() * 3))] : '');
      s.m0 = m0;
    });
    sp.sort(function (a, b) { return (a.genus + a.epithet) < (b.genus + b.epithet) ? -1 : 1; });
    sp.forEach(function (s, i) { s.i = i; });
  }
  function binom(s) { return s.genus + ' ' + s.epithet; }

  /* ---------- write the key: split as evenly as possible at every couplet ---------- */
  function buildKey(r, sp) {
    var cs = [];
    function make(set) {
      var best = null;
      TRAITS.forEach(function (t) {
        if (!set.every(function (s) { return has(s, t.k); })) return;
        var present = t.vals.filter(function (v) { return set.some(function (s) { return s[t.k] === v; }); });
        var k = present.length; if (k < 2) return;
        for (var m = 1; m < (1 << k) - 1; m++) {
          if (!(m & 1)) continue;                      // each partition once; lead a holds the first value
          var A = [], B = [];
          present.forEach(function (v, j) { (m & (1 << j) ? A : B).push(v); });
          var na = set.filter(function (s) { return A.indexOf(s[t.k]) >= 0; }).length, nb = set.length - na;
          var score = Math.abs(na - nb) + t.i * 0.04 + (A.length + B.length - 2) * 0.05 + r() * 0.3;
          if (!best || score < best.score) best = { t: t, A: A, B: B, score: score };
        }
      });
      var c = { n: cs.length + 1, t: best.t }; cs.push(c);
      var setA = set.filter(function (s) { return best.A.indexOf(s[best.t.k]) >= 0; });
      var setB = set.filter(function (s) { return best.A.indexOf(s[best.t.k]) < 0; });
      c.a = { vals: best.A, text: lead(best.t, best.A) };
      c.b = { vals: best.B, text: lead(best.t, best.B) };
      c.a.to = setA.length === 1 ? { sp: setA[0].i } : { c: make(setA).n };
      c.b.to = setB.length === 1 ? { sp: setB[0].i } : { c: make(setB).n };
      return c;
    }
    make(sp.slice());
    return cs;
  }
  function pathTo(key, i) {
    var out = [];
    function walk(n, acc) {
      var c = key[n - 1];
      ['a', 'b'].forEach(function (l) {
        var st = acc.concat([{ c: n, l: l }]), to = c[l].to;
        if (to.sp != null) { if (to.sp === i) out = st; }
        else walk(to.c, st);
      });
    }
    walk(1, []);
    return out;
  }

  /* ---------- build the day ---------- */
  function build(off) {
    var d = dateFor(off), r = rng(seedForDate(d) ^ 0x48455242);
    var place = pick(r, PRE) + pick(r, SUF), land = pick(r, LAND);
    var sp = genFlora(r); nameFlora(r, sp);
    var key = buildKey(r, sp);
    sp.forEach(function (s) { s.path = pathTo(key, s.i); });

    // five sheets from the flora and one that is not in it
    var order = shuffle(r, sp.map(function (s) { return s.i; }));
    var sheets = order.slice(0, 5).map(function (i) { return { sp: i }; });
    var nov = null, tries = shuffle(r, sp.slice());
    for (var q = 0; q < tries.length && !nov; q++) {
      var S = tries[q], used = {};
      S.path.forEach(function (st) { used[key[st.c - 1].t.k] = 1; });
      var cand = TRAITS.filter(function (t) { return t.k !== 'type' && !used[t.k] && has(S, t.k); });
      if (!cand.length) continue;
      var t = pick(r, cand), v = pick(r, t.vals.filter(function (x) { return x !== S[t.k]; }));
      var ch = {}; TRAITS.forEach(function (u) { ch[u.k] = S[u.k]; }); ch[t.k] = v;
      if (sp.some(function (o) { return diff(o, ch) === 0; })) continue;
      var gN = sp.filter(function (o) { return o.genus === S.genus; }).map(function (o) { return o.epithet; });
      var ne = (EPI[t.k] && EPI[t.k][v] || []).concat(GENERIC).filter(function (x) { return gN.indexOf(x[0]) < 0; });
      nov = { near: S.i, t: t.k, v: v, ch: ch, epithet: ne.length ? ne[0][0] : 'nova' };
    }
    if (nov) sheets.splice(1 + Math.floor(r() * 5), 0, { nov: true, ch: nov.ch, near: nov.near });
    else sheets.push({ sp: order[5 % order.length] });

    var habs = HABITATS;
    sheets.forEach(function (sh, k) {
      var tr = sh.nov ? sh.ch : sp[sh.sp];
      sh.tr = tr;
      sh.seed = (Math.imul(seedForDate(d) ^ 0x5348, 2654435761) + Math.imul(k + 1, 0x85ebca6b)) >>> 0;
      var rs = rng(sh.seed);
      var home = sh.nov ? pick(rs, habs) : [sp[sh.sp].habitat, sp[sh.sp].where];
      sh.loc = home[1] + ' ' + pick(rs, NEAR) + ', ' + pick(rs, PRE) + pick(rs, SUF);
      sh.coll = pick(rs, INIT) + ' ' + pick(rs, SURN);
      sh.no = 20 + Math.floor(rs() * 900);
      var yr = 1872 + Math.floor(rs() * 90), mo = sh.nov ? 4 + Math.floor(rs() * 4) : sp[sh.sp].m0 + Math.floor(rs() * 2);
      sh.date = (1 + Math.floor(rs() * 28)) + ' ' + MONTHS[Math.min(9, mo)].slice(0, 3) + '. ' + yr;
      sh.k = k;
    });
    return { d: d, place: place, land: land, sp: sp, key: key, sheets: sheets, nov: nov,
      club: place + ' Field Club' };
  }

  /* ---------- drawing: leaves ---------- */
  var LEAF = ['#6f7d42', '#7a8446', '#86834b', '#6b7a48', '#7d7a40'];
  var PETAL = { white: ['#f3efe2', '#b9b19a'], yellow: ['#e5c65a', '#a88a2c'], pink: ['#d897a6', '#a35d6e'], blue: ['#8ea5d4', '#566fa3'], purple: ['#9a7ab4', '#644780'] };
  function prof(shape, s) {
    var sn = function (x) { return Math.max(0, Math.sin(Math.PI * x)); };
    switch (shape) {
      case 'linear': return 0.065 * Math.pow(sn(s), 0.55);
      case 'lanceolate': return 0.17 * Math.pow(sn(Math.pow(s, 0.8)), 1.0);
      case 'ovate': return 0.31 * Math.pow(sn(Math.pow(s, 0.68)), 0.85);
      case 'cordate': return 0.4 * Math.pow(sn(Math.pow(s, 0.6)), 0.7);
      default: return 0.21 * Math.pow(sn(Math.pow(s, 0.75)), 0.9);   // leaflet
    }
  }
  function leafPts(shape, L, toothed) {
    var pts = [], N = 40, i, s, w, x, tf;
    if (shape === 'palmate') {
      var cx = 0.2 * L, R = 0.56 * L, K = 2 * Math.PI / 0.72, M = 120;
      for (i = 0; i <= M; i++) {
        var ph = -Math.PI + 2 * Math.PI * i / M, r;
        if (Math.abs(ph) < 1.8) r = R * (0.42 + 0.58 * Math.pow((1 + Math.cos(K * ph)) / 2, 1.1));
        else r = R * 0.42;
        if (toothed && Math.abs(ph) < 1.8) r *= (i % 2 ? 1 : 0.93);
        pts.push([cx + r * Math.cos(ph), r * Math.sin(ph)]);
      }
      return pts;
    }
    var side = [];
    for (i = 0; i <= N; i++) {
      s = i / N; w = prof(shape, s) * L;
      x = s * L;
      if (shape === 'cordate' && s < 0.3) x = L * (s - 0.2 * Math.sin(Math.PI * s / 0.3));
      tf = toothed && i > 1 && i < N - 1 ? (i % 2 ? 1 : 0.86) : 1;
      side.push([x, w * tf]);
    }
    for (i = 0; i <= N; i++) pts.push(side[i]);
    for (i = N; i >= 0; i--) pts.push([side[i][0], -side[i][1]]);
    return pts;
  }
  function tf(P, th, p) { var c = Math.cos(th), s = Math.sin(th); return [P[0] + p[0] * c - p[1] * s, P[1] + p[0] * s + p[1] * c]; }
  function poly(P, th, pts) {
    return 'M' + pts.map(function (p) { var q = tf(P, th, p); return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + 'Z';
  }
  function line(a, b, st, w, extra) { return '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" stroke="' + st + '" stroke-width="' + w + '"' + (extra || '') + '/>'; }
  function blade(P, th, L, shape, toothed, fill) {
    var o = '<path d="' + poly(P, th, leafPts(shape, L, toothed)) + '" fill="' + fill + '" fill-opacity=".93" stroke="#3f4a25" stroke-width=".6" stroke-linejoin="round"/>';
    if (shape === 'palmate') {
      var c = tf(P, th, [0.2 * L, 0]);
      [-1.44, -0.72, 0, 0.72, 1.44].forEach(function (a) { o += line(c, tf(c, th + a, [0.5 * L, 0]), '#46522a', 0.5, ' stroke-opacity=".7"'); });
    } else {
      o += line(P, tf(P, th, [0.95 * L, 0]), '#46522a', shape === 'linear' ? 0.35 : 0.55, ' stroke-opacity=".7"');
      if (shape === 'ovate' || shape === 'cordate') {
        for (var v = 0.22; v < 0.8; v += 0.17) {
          var a0 = tf(P, th, [v * L, 0]), w = prof(shape, v + 0.12) * L * 0.8;
          o += line(a0, tf(P, th, [(v + 0.14) * L, w]), '#46522a', 0.35, ' stroke-opacity=".55"');
          o += line(a0, tf(P, th, [(v + 0.14) * L, -w]), '#46522a', 0.35, ' stroke-opacity=".55"');
        }
      }
    }
    return o;
  }
  function leaf(P, th, L, tr, rs) {
    var fill = pick(rs, LEAF), o = '';
    if (tr.type === 'pinnate') {
      var R = L * 1.05, end = tf(P, th, [R, 0]);
      o += line(P, end, '#4f5a2c', 0.9);
      [0.3, 0.52, 0.74].forEach(function (f, j) {
        var b = tf(P, th, [f * R, 0]), l = L * 0.33 * (1 - 0.12 * j);
        o += blade(b, th - 0.95, l, 'leaflet', tr.margin === 'toothed', fill);
        o += blade(b, th + 0.95, l, 'leaflet', tr.margin === 'toothed', fill);
      });
      o += blade(end, th, L * 0.32, 'leaflet', tr.margin === 'toothed', fill);
      return o;
    }
    var pet = tr.shape === 'linear' ? 0 : 0.13 * L;
    var B = tf(P, th, [pet, 0]);
    if (pet) o += line(P, B, '#4f5a2c', 0.8);
    return o + blade(B, th, tr.shape === 'linear' ? L * 1.15 : L * (tr.shape === 'palmate' ? 0.8 : tr.shape === 'cordate' ? 0.72 : tr.shape === 'ovate' ? 0.8 : 0.87), tr.shape, tr.margin === 'toothed', fill);
  }
  function flower(c, R, tr, rot) {
    var n = +tr.petals, col = PETAL[tr.colour], o = '';
    var ry = n <= 3 ? 0.42 : n === 4 ? 0.36 : n === 5 ? 0.3 : 0.25;
    for (var i = 0; i < n; i++) {
      var a = rot + i * 2 * Math.PI / n, px = c[0] + 0.52 * R * Math.cos(a), py = c[1] + 0.52 * R * Math.sin(a);
      o += '<ellipse cx="' + f1(px) + '" cy="' + f1(py) + '" rx="' + f1(0.5 * R) + '" ry="' + f1(ry * R) + '" transform="rotate(' + f1(a * 180 / Math.PI) + ' ' + f1(px) + ' ' + f1(py) + ')" fill="' + col[0] + '" fill-opacity=".9" stroke="' + col[1] + '" stroke-width=".55"/>';
    }
    return o + '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(0.2 * R) + '" fill="#d4ae46" stroke="#8a6d1f" stroke-width=".4"/>';
  }

  /* ---------- drawing: the whole sheet ---------- */
  function sheetSVG(W, sh, det) {
    var tr = sh.tr, rs = rng(sh.seed), o = '';
    o += '<rect x="0" y="0" width="300" height="420" fill="#efe8d2"/>';
    o += '<rect x="4" y="4" width="292" height="412" fill="none" stroke="#d8cfb4" stroke-width="1"/>';
    // stem as a quadratic curve
    var bx = 112 + rs() * 26, by = 384, tx = 128 + rs() * 44, ty = 66 + rs() * 26, mx = (bx + tx) / 2 + (rs() - 0.5) * 50, my = (by + ty) / 2;
    function B(u) { var v = 1 - u; return [v * v * bx + 2 * v * u * mx + u * u * tx, v * v * by + 2 * v * u * my + u * u * ty]; }
    function D(u) { return [2 * (1 - u) * (mx - bx) + 2 * u * (tx - mx), 2 * (1 - u) * (my - by) + 2 * u * (ty - my)]; }
    // roots
    for (var k = 0; k < 5; k++) {
      var ex = bx + (rs() - 0.5) * 50, ey = by + 12 + rs() * 18;
      o += '<path d="M' + f1(bx) + ' ' + f1(by) + 'Q' + f1(bx + (rs() - 0.5) * 20) + ' ' + f1(by + 10) + ' ' + f1(ex) + ' ' + f1(ey) + '" fill="none" stroke="#8a7350" stroke-width="' + f1(0.5 + rs() * 0.7) + '"/>';
    }
    var leaves = '', nodes = 4 + Math.floor(rs() * 3), L0 = (tr.arr === 'whorled' ? 50 : 60) + rs() * 14;
    if (tr.type === 'pinnate') L0 *= 0.95;
    for (var j = 0; j < nodes; j++) {
      var u = 0.16 + j * (0.6 / (nodes - 1)), P = B(u), dv = D(u), up = Math.atan2(dv[1], dv[0]);
      var L = L0 * (1 - 0.42 * u) * (0.92 + rs() * 0.16), spread = 0.95 + rs() * 0.3;
      if (tr.arr === 'alternate') {
        var sd = j % 2 ? 1 : -1;
        leaves += leaf(P, up + sd * spread, L, tr, rs);
      } else {
        leaves += leaf(P, up - spread, L, tr, rs);
        leaves += leaf(P, up + spread, L, tr, rs);
        if (tr.arr === 'whorled') leaves += leaf(P, up + (j % 2 ? 0.28 : -0.28), L * 0.62, tr, rs);
      }
    }
    var stem = '<path d="M' + f1(bx) + ' ' + f1(by) + 'Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(tx) + ' ' + f1(ty) + '" fill="none" stroke="#56632f" stroke-width="2.3" stroke-linecap="round"/>';
    var hairs = '';
    if (tr.hair === 'hairy') {
      for (var h = 0.01; h < 0.99; h += 0.016) {
        var p = B(h), dd = D(h), ln = Math.hypot(dd[0], dd[1]), tx2 = dd[0] / ln, ty2 = dd[1] / ln, nx = -ty2, ny = tx2;
        [-1, 1].forEach(function (s) {
          hairs += line([p[0] + s * nx * 1.2, p[1] + s * ny * 1.2], [p[0] + s * nx * 4.2 + tx2 * 1.6, p[1] + s * ny * 4.2 + ty2 * 1.6], '#5b6533', 0.45);
        });
      }
    }
    o += hairs + stem + leaves;
    // flowers
    var tp = B(1), td = D(1), ta = Math.atan2(td[1], td[0]);
    if (tr.infl === 'single') {
      var fc = tf(tp, ta, [9, 0]);
      o += line(tp, fc, '#56632f', 1.6);
      o += flower(fc, 13 + rs() * 3, tr, rs() * 6.28);
    } else {
      var nf = 4 + Math.floor(rs() * 3), fl = '';
      for (var q = 0; q < nf; q++) {
        var a = ta - 1.15 + 2.3 * (q + 0.5) / nf + (rs() - 0.5) * 0.2, len = 15 + rs() * 8, c2 = tf(tp, a, [len, 0]);
        o += line(tp, c2, '#56632f', 0.9);
        fl += flower(c2, 7 + rs() * 1.6, tr, rs() * 6.28);
      }
      o += fl;
    }
    // mounting strips
    for (var m = 0; m < 3; m++) {
      var mu = 0.08 + m * 0.3 + rs() * 0.1, mp = B(mu), md = D(mu), mang = Math.atan2(md[1], md[0]) * 180 / Math.PI + 90;
      o += '<rect x="' + f1(mp[0] - 9) + '" y="' + f1(mp[1] - 2.6) + '" width="18" height="5.2" transform="rotate(' + f1(mang) + ' ' + f1(mp[0]) + ' ' + f1(mp[1]) + ')" fill="#fbf8ec" fill-opacity=".82" stroke="#cfc6a9" stroke-width=".4"/>';
    }
    // sheet number stamp
    o += '<text x="14" y="22" font-family="ui-monospace,Menlo,monospace" font-size="7" fill="#9a2b2b" letter-spacing="1">No. ' + (sh.no * 37 % 9000 + 1000) + '</text>';
    // label
    var lx = 176, ly = 344;
    o += '<rect x="' + lx + '" y="' + ly + '" width="116" height="68" fill="#fbf8ee" stroke="#a89f84" stroke-width=".6"/>';
    var tx3 = function (y, s, sz, st) { return '<text x="' + (lx + 5) + '" y="' + (ly + y) + '" font-family="Georgia,serif" font-size="' + sz + '" fill="#2d2a22"' + (st || '') + '>' + esc(s) + '</text>'; };
    o += tx3(9, W.club.toUpperCase(), 4.2, ' letter-spacing=".4"');
    o += line([lx + 5, ly + 12], [lx + 111, ly + 12], '#a89f84', 0.4);
    var words = sh.loc.split(' '), ln1 = '', lines = [];
    words.forEach(function (w) { if ((ln1 + ' ' + w).length > 34) { lines.push(ln1); ln1 = w; } else ln1 = ln1 ? ln1 + ' ' + w : w; });
    lines.push(ln1);
    lines.slice(0, 3).forEach(function (s, i) { o += tx3(21 + i * 7, s, 5.4, ' font-style="italic"'); });
    o += tx3(46, 'Flowers ' + tr.colour + ' in life.', 5.2);
    o += tx3(55, 'Coll. ' + sh.coll + '  No. ' + sh.no, 5.2);
    o += tx3(63, sh.date, 5.2);
    if (det) {
      o += '<g transform="rotate(-2 230 330)"><rect x="168" y="318" width="124" height="20" fill="#fffdf4" stroke="#a89f84" stroke-width=".5"/>';
      o += '<text x="173" y="331" font-family="Georgia,serif" font-size="7" font-style="italic" fill="' + (det.ok ? '#1d3d6b' : '#8a2b2b') + '">' + esc(det.text) + '</text></g>';
    }
    return o;
  }
  function svgWrap(inner, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }

  /* ---------- state ---------- */
  var S = { day: 0, W: null, cur: 0, st: [] };

  function load() {
    S.W = build(S.day); S.cur = 0;
    S.st = S.W.sheets.map(function () { return { path: [], det: null }; });
    plaque(); renderTabs(); renderSheet(); renderWalker(); renderKey(); renderFlora(); renderScore();
    $('dayOut').textContent = longDate(S.W.d) + (S.day === 0 ? ' (today)' : '');
  }

  function plaque() {
    var W = S.W;
    $('plWho').textContent = 'A flora · ' + longDate(W.d);
    $('plName').textContent = 'The ' + W.place + ' ' + W.land;
    var gen = {}; W.sp.forEach(function (s) { gen[s.genus] = 1; });
    $('plBlurb').innerHTML = 'The ' + esc(W.club) + ' has kept a cupboard of pressed plants since the 1870s. ' +
      'Its flora of the ' + esc(W.land) + ' lists <b>' + W.sp.length + ' species</b> in <b>' + Object.keys(gen).length +
      ' genera</b>, and the key to them runs to <b>' + W.key.length + ' couplets</b>. Six sheets have turned up with no name on them. ' +
      'Key each one out, read the species account, and write a determination slip. Be warned that one of the six is not in the book.';
  }

  function renderTabs() {
    var o = '';
    S.W.sheets.forEach(function (sh, k) {
      var d = S.st[k].det, mark = d ? (d.ok ? ' ✓' : ' ✗') : '';
      o += '<button type="button" class="chip' + (k === S.cur ? ' on' : '') + (d ? (d.ok ? ' ok' : ' bad') : '') + '" data-k="' + k + '">Sheet ' + ROMAN[k] + mark + '</button>';
    });
    $('tabs').innerHTML = o;
  }
  $('tabs').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-k]'); if (!b) return;
    S.cur = +b.getAttribute('data-k'); renderTabs(); renderSheet(); renderWalker(); renderKey();
  });

  function renderSheet() {
    var sh = S.W.sheets[S.cur], d = S.st[S.cur].det;
    var inner = sheetSVG(S.W, sh, d);
    $('sheet').innerHTML = svgWrap(inner, 'main') + '<div class="lens" id="lens">' + svgWrap(inner) + '</div>';
  }

  /* the hand lens */
  var ZOOM = 3;
  function lensAt(ev) {
    var box = $('sheet'), lens = $('lens'); if (!lens || !S.lensOn) return;
    var r = box.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.style.display = 'none'; return; }
    var R = lens.offsetWidth / 2 || 75, sv = lens.firstChild;
    lens.style.display = 'block';
    lens.style.left = (x - R) + 'px'; lens.style.top = (y - R) + 'px';
    sv.style.width = (r.width * ZOOM) + 'px'; sv.style.height = (r.height * ZOOM) + 'px';
    sv.style.transform = 'translate(' + (R - x * ZOOM) + 'px,' + (R - y * ZOOM) + 'px)';
  }
  S.lensOn = true;
  $('sheet').addEventListener('pointermove', lensAt);
  $('sheet').addEventListener('pointerdown', lensAt);
  $('sheet').addEventListener('pointerleave', function () { var l = $('lens'); if (l) l.style.display = 'none'; });
  $('sheet').addEventListener('pointerup', function (ev) { if (ev.pointerType !== 'mouse') { var l = $('lens'); if (l) l.style.display = 'none'; } });
  $('btnLens').addEventListener('click', function () {
    S.lensOn = !S.lensOn;
    this.textContent = 'Hand lens: ' + (S.lensOn ? 'on' : 'off');
    $('sheet').classList.toggle('nolens', !S.lensOn);
  });

  /* ---------- walking the key ---------- */
  function where() {
    var p = S.st[S.cur].path, n = 1;
    for (var i = 0; i < p.length; i++) {
      var to = S.W.key[p[i].c - 1][p[i].l].to;
      if (to.sp != null) return { sp: to.sp };
      n = to.c;
    }
    return { c: n };
  }
  function account(s) {
    var o = 'Stem ' + T.hair.long[s.hair] + '. Leaves ' + T.arr.long[s.arr] + ', ';
    o += s.type === 'pinnate' ? T.type.long.pinnate : 'simple; blade ' + T.shape.long[s.shape];
    o += '; margins ' + T.margin.long[s.margin] + '. Flowers ' + s.colour + ', with ' + s.petals + ' petals, ' + T.infl.long[s.infl] + '. ';
    return o.replace('(use the lens)', '').replace(/\s+,/g, ',').replace(/\s+\./g, '.');
  }
  function renderWalker() {
    var W = S.W, st = S.st[S.cur], at = where(), o = '';
    var crumbs = st.path.map(function (p) { return p.c + p.l; });
    o += '<p class="scount">Sheet ' + ROMAN[S.cur] + ' · ' + (crumbs.length ? 'path ' + crumbs.join(' → ') : 'start at couplet 1') + '</p>';
    if (st.det) {
      o += '<div class="verdict ' + (st.det.ok ? 'good' : 'warn') + '">' + st.det.msg + '</div>';
      o += '<div class="controls" style="margin-top:14px">';
      var nx = nextOpen();
      if (nx != null) o += '<button class="btn small" type="button" data-act="next" data-k="' + nx + '">On to sheet ' + ROMAN[nx] + ' →</button>';
      o += '<button class="btn small ghost" type="button" data-act="again">Key it out again</button></div>';
    } else if (at.c) {
      var c = W.key[at.c - 1];
      o += '<h3 class="cnum">Couplet ' + c.n + '</h3>';
      ['a', 'b'].forEach(function (l) {
        o += '<button type="button" class="leadbtn" data-act="lead" data-l="' + l + '"><span class="ll">' + c.n + l + '</span>' + esc(c[l].text) + '</button>';
      });
      o += '<p class="qhint">Look at the sheet, not the name you hope for. Hairs, teeth and petals are clearer under the lens.</p>';
      if (st.path.length) o += '<div class="controls" style="margin-top:12px"><button class="btn small ghost" type="button" data-act="back">← Back a couplet</button></div>';
    } else {
      var s = W.sp[at.sp];
      o += '<p class="arrive">The key gives</p><h3 class="spname"><i>' + esc(binom(s)) + '</i></h3><p class="common">' + esc(s.common) + '</p>';
      o += '<div class="acct"><b>Species account.</b> ' + esc(account(s)) + 'In ' + esc(s.habitat) + '; flowering ' + esc(s.months) + '.</div>';
      o += '<p class="qhint">A key only gets you a candidate. Check every character in the account against the sheet before you write the slip.</p>';
      o += '<div class="controls" style="margin-top:12px">' +
        '<button class="btn small" type="button" data-act="name">It fits: determine as <i>' + esc(binom(s)) + '</i></button>' +
        '<button class="btn small ghost" type="button" data-act="nov">It does not fit: not in this flora</button>' +
        '<button class="btn small ghost" type="button" data-act="back">← Back a couplet</button></div>';
    }
    $('walker').innerHTML = o;
  }
  function nextOpen() {
    for (var i = 1; i <= S.W.sheets.length; i++) { var k = (S.cur + i) % S.W.sheets.length; if (!S.st[k].det) return k; }
    return null;
  }
  $('walker').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), st = S.st[S.cur];
    if (act === 'lead') { st.path.push({ c: where().c, l: b.getAttribute('data-l') }); }
    else if (act === 'back') { st.path.pop(); }
    else if (act === 'again') { st.path = []; st.det = null; st.redo = true; }
    else if (act === 'next') { S.cur = +b.getAttribute('data-k'); renderTabs(); renderSheet(); renderWalker(); renderKey(); return; }
    else if (act === 'name' || act === 'nov') { determine(act); }
    renderTabs(); renderWalker(); renderKey(); if (act === 'name' || act === 'nov' || act === 'again') { renderSheet(); renderScore(); }
  });

  function wrongTurn(path, tr) {
    for (var i = 0; i < path.length; i++) {
      var c = S.W.key[path[i].c - 1], ld = c[path[i].l], v = tr[c.t.k];
      if (ld.vals.indexOf(v) < 0) return { c: c, l: path[i].l, v: v };
    }
    return null;
  }
  function determine(act) {
    var W = S.W, sh = W.sheets[S.cur], st = S.st[S.cur], at = where(), s = W.sp[at.sp];
    var wt = wrongTurn(st.path, sh.tr), ok, msg, text;
    var turn = wt ? 'At couplet ' + wt.c.n + ' you took <b>' + wt.c.n + wt.l + '</b>, “' + esc(wt.c[wt.l].text) + '”, but this sheet has ' + esc(says(wt.c.t, wt.v)) + '.' : '';
    if (act === 'name') {
      text = 'Det. ' + binom(s);
      if (!sh.nov && sh.sp === at.sp) {
        ok = true; msg = '<b>Right.</b> This is <i>' + esc(binom(s)) + '</i>, ' + esc(s.common.toLowerCase()) + ', and every character in the account fits the sheet. The slip goes on.';
      } else if (sh.nov) {
        var t = T[W.nov.t];
        ok = false;
        msg = (wt ? turn + ' Even so, the real trap was further on. ' : '<b>You followed the key without a slip</b>, and it still gave the wrong answer. ') +
          'The account of <i>' + esc(binom(W.sp[sh.near])) + '</i> gives it ' + esc(says(t, W.sp[sh.near][t.k])) + ', and this sheet has ' + esc(says(t, sh.tr[t.k])) +
          '. The key never asks about ' + esc(t.name) + ' on the way to that name, because nothing else in the flora needed separating by it. This plant is not in the book.';
      } else {
        ok = false; msg = '<b>Not quite.</b> ' + (turn || 'The key led here, but this sheet is something else.') + ' It is really <i>' + esc(binom(W.sp[sh.sp])) + '</i>, ' + esc(W.sp[sh.sp].common.toLowerCase()) + '.';
      }
    } else {
      text = 'Det. ' + (sh.nov ? W.sp[sh.near].genus + ' sp. nov.?' : '?');
      if (sh.nov) {
        var t2 = T[W.nov.t];
        ok = true;
        msg = '<b>Well spotted.</b> It keys out to <i>' + esc(binom(W.sp[sh.near])) + '</i>, but the ' + esc(t2.name) + ' is wrong: the book’s plant has ' + esc(says(t2, W.sp[sh.near][t2.k])) +
          ' and this one has ' + esc(says(t2, sh.tr[t2.k])) + '. Nothing in the flora matches it. If it is new, it might be published as <i>' + esc(W.sp[sh.near].genus + ' ' + W.nov.epithet) + '</i> sp. nov.' +
          (wt ? ' (You did go astray on the way, though: ' + turn.charAt(0).toLowerCase() + turn.slice(1) + ')' : '');
      } else if (!wt && sh.sp === at.sp) {
        ok = false; text = 'Det. ?'; msg = '<b>It does fit.</b> Every character in the account of <i>' + esc(binom(s)) + '</i> matches this sheet. Not every odd-looking plant is new.';
      } else {
        ok = false; msg = '<b>It is in the flora.</b> ' + (turn || '') + ' Followed correctly, the key gives <i>' + esc(binom(W.sp[sh.sp])) + '</i>, and that account fits.';
      }
    }
    if (!st.det && !st.redo && st.first == null) st.first = ok;
    st.det = { ok: ok, msg: msg, text: text };
  }

  function renderScore() {
    var done = S.st.filter(function (s) { return s.det; }).length, first = S.st.filter(function (s) { return s.first; }).length;
    var o = '<b>' + done + ' of ' + S.W.sheets.length + '</b> sheets determined';
    if (done) o += ', <b>' + first + '</b> right at the first attempt';
    if (done === S.W.sheets.length) {
      o += '. ';
      if (S.W.nov) {
        var k = 0; S.W.sheets.forEach(function (sh, i) { if (sh.nov) k = i; });
        o += 'Sheet ' + ROMAN[k] + ' was the stranger: near <i>' + esc(binom(S.W.sp[S.W.nov.near])) + '</i> but differing in its ' + esc(T[S.W.nov.t].name) + '. ' +
          (first === S.W.sheets.length ? 'A clean bench. The society would let you near the type specimens.' : 'The society has seen worse. Try another day with the arrow keys.');
      }
    } else o += '.';
    $('score').innerHTML = o;
  }

  /* ---------- the full key and the flora ---------- */
  function renderKey() {
    var W = S.W, st = S.st[S.cur], on = {};
    st.path.forEach(function (p) { on[p.c + p.l] = 1; });
    var at = where(), o = '';
    W.key.forEach(function (c) {
      ['a', 'b'].forEach(function (l, j) {
        var to = c[l].to, dest = to.sp != null ? '<i>' + esc(binom(W.sp[to.sp])) + '</i>' : to.c;
        var cls = on[c.n + l] ? ' on' : (at.c === c.n && !st.det ? ' here' : '');
        o += '<div class="kl' + cls + (j ? ' b' : '') + '"><span class="kn">' + (j ? '' : c.n) + '</span><span class="kx">' + l + '</span><span class="kt">' + esc(c[l].text) + '</span><span class="kd">' + dest + '</span></div>';
      });
    });
    $('key').innerHTML = o;
  }
  function renderFlora() {
    var o = '';
    S.W.sp.forEach(function (s) {
      o += '<div class="acc"><h4><i>' + esc(binom(s)) + '</i></h4><p class="common">' + esc(s.common) + '</p><p>' + esc(account(s)) + 'In ' + esc(s.habitat) + '; flowering ' + esc(s.months) + '.</p></div>';
    });
    $('flora').innerHTML = o;
  }

  /* ---------- glossary pictures ---------- */
  function glossary() {
    var items = [], fill = '#7a8446';
    T.shape.vals.forEach(function (v) {
      var L = v === 'linear' ? 54 : v === 'palmate' ? 46 : 44;
      items.push([blade([v === 'palmate' ? 22 : 10, 32], 0, L, v, false, fill), T.shape.short[v]]);
    });
    items.push([leaf([6, 32], 0, 50, { type: 'pinnate', margin: 'entire' }, rng(1)), 'pinnate']);
    items.push([blade([8, 32], 0, 48, 'ovate', true, fill), 'toothed']);
    items.push([blade([8, 32], 0, 48, 'ovate', false, fill), 'entire']);
    T.arr.vals.forEach(function (v) {
      var o = line([32, 62], [32, 4], '#56632f', 1.6), tr = { type: 'simple', shape: 'lanceolate', margin: 'entire' };
      [44, 20].forEach(function (y, j) {
        if (v === 'alternate') o += leaf([32, y], -Math.PI / 2 + (j ? 1 : -1) * 1.05, 26, tr, rng(2));
        else { o += leaf([32, y], -Math.PI / 2 - 1.05, 26, tr, rng(2)) + leaf([32, y], -Math.PI / 2 + 1.05, 26, tr, rng(3)); if (v === 'whorled') o += leaf([32, y], -Math.PI / 2 + 0.25, 16, tr, rng(4)); }
      });
      items.push([o, T.arr.short[v]]);
    });
    var hs = line([32, 62], [32, 2], '#56632f', 2.2);
    for (var y = 4; y < 62; y += 3.2) hs += line([33.2, y], [36.5, y - 1.4], '#5b6533', 0.5) + line([30.8, y], [27.5, y - 1.4], '#5b6533', 0.5);
    items.push([hs, 'hairy stem']);
    $('gloss').innerHTML = items.map(function (it) {
      return '<figure><svg viewBox="0 0 64 64">' + it[0] + '</svg><figcaption>' + esc(it[1]) + '</figcaption></figure>';
    }).join('');
  }

  /* ---------- days ---------- */
  function goDay(d) { S.day = d; load(); }
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  document.addEventListener('keydown', function (ev) {
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || tg === 'BUTTON') return;
    if (ev.key === 'ArrowLeft') goDay(S.day - 1);
    else if (ev.key === 'ArrowRight') goDay(S.day + 1);
  });

  // exposed for testing only
  if (typeof window !== 'undefined') window.__herbarium = { build: build, sheetSVG: sheetSVG, svgWrap: svgWrap };

  glossary();
  load();
})();
