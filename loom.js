/* The Loom — experiment.quibo.games
   A weaving draft dealt by the day's number, and then actually woven.
   Threading, tie-up, treadling, drawdown. No dependencies. */
(function () {
  'use strict';

  /* ---------------- seeded prng ---------------- */
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
  function $(id) { return document.getElementById(id); }
  function pk(r, a) { return a[Math.floor(r() * a.length)]; }
  function ri(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- the dye house ---------------- */
  var DYES = [
    { n: 'madder',        c: '#a63a2a' },
    { n: 'indigo',        c: '#2b3f6b' },
    { n: 'weld yellow',   c: '#c9a227' },
    { n: 'walnut',        c: '#5a4432' },
    { n: 'cochineal',     c: '#8e2846' },
    { n: 'woad',          c: '#3d6389' },
    { n: 'gall grey',     c: '#6d6b64' },
    { n: 'undyed linen',  c: '#d6cbb2' },
    { n: 'bleached white',c: '#ece7dc' },
    { n: 'lichen green',  c: '#7d8c5c' },
    { n: 'logwood',       c: '#4a3357' },
    { n: 'saffron',       c: '#e0942f' },
    { n: 'iron black',    c: '#24221f' },
    { n: 'rust',          c: '#b1653a' },
    { n: 'sea green',     c: '#3f7d6e' },
    { n: 'ash rose',      c: '#b5867f' },
    { n: 'oatmeal',       c: '#c2b69a' },
    { n: 'peat brown',    c: '#3b2f27' }
  ];

  function hx(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function lumOf(h) {
    var c = hx(h);
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  }

  /* ---------------- naming ---------------- */
  var PLACE_A = ['Ash', 'Raven', 'Holl', 'Brack', 'Mere', 'Thorn', 'Wester', 'Kir', 'Glen',
    'Bram', 'Slack', 'Crow', 'Fell', 'Dun', 'Quern', 'Laver', 'Tarn', 'Hind', 'Cald', 'Stow',
    'Har', 'Nether', 'Ling', 'Rush'];
  var PLACE_B = ['moor', 'beck', 'thwaite', 'ford', 'hope', 'garth', 'wick', 'ley', 'combe',
    'stead', 'holt', 'mere', 'fell', 'side', 'brig', 'worth', 'dale', 'shaw'];
  var FIBRES = ['worsted wool', 'soft-spun lambswool', 'line linen', 'tow linen', 'hemp',
    'mill-spun cotton', 'silk noil', 'tussah silk', 'goat hair', 'nettle fibre',
    'two-ply botany wool', 'hand-spun singles'];
  var PURPOSE = ['a coverlet for a bed nobody remembers',
    'twelve yards of curtaining for a hall that was later divided',
    'the lining of a coat ordered and never collected',
    'sacking, and it was never meant to be looked at',
    'a shawl for somebody who preferred the older pattern',
    'cloth sold by the yard to whoever came up the lane',
    'an altar frontal, changed each season',
    'sail cloth for a boat that worked one estuary',
    'a hall runner, walked thin in eleven years',
    'towelling, because the draft wastes nothing',
    'a horse blanket, and it outlasted the horse',
    'a bolt kept back for the weaver’s own house'];
  var FATE = ['cut from the loom on a wet Thursday and sold before it was dry',
    'folded into a chest and not looked at for forty years',
    'unpicked for the yarn within the month',
    'copied badly by three other weavers in the same valley',
    'still on the loom when the roof came in',
    'dyed a second time, darker, to hide a fault at the selvedge',
    'taken apart to work out how it was done, and put back wrong',
    'the last piece made before the mill went over to power',
    'given away as a wedding piece and never used',
    'entered for a prize and beaten by something plainer'];
  var TRADE = ['Shuttleworth', 'Weaver', 'Halliwell', 'Tenter', 'Warbrick', 'Reedman',
    'Clough', 'Hesketh', 'Dyer', 'Fulford', 'Loomer', 'Standish', 'Barcroft', 'Ollerton'];
  var GIVEN = ['Agnes', 'Elias', 'Marta', 'Josiah', 'Hebe', 'Cuthbert', 'Nan', 'Ambrose',
    'Isbel', 'Edric', 'Tabitha', 'Rowan', 'Merrick', 'Dorcas'];

  function placeName(r) { return pk(r, PLACE_A) + pk(r, PLACE_B); }

  /* ---------------- canvas ---------------- */
  var CW = 980, CH = 660;
  var cv = $('loom');
  var ctx = cv.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.floor(CW * DPR);
  cv.height = Math.floor(CH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- state ---------------- */
  var st = {
    seed: 0,
    S: 4, T: 4,
    tieup: [],
    thread: [],
    treadle: [],
    warpM: [], weftM: [],
    way: [],
    family: 'twill',
    names: {},
    plaque: {},
    cell: 9,
    view: 'cloth',
    showDraft: true,
    plan: 'dealt',
    woven: 0,
    animating: false,
    edited: false,
    L: null
  };

  function th(e) { return st.thread[((e % st.thread.length) + st.thread.length) % st.thread.length]; }
  function tr(p) { return st.treadle[((p % st.treadle.length) + st.treadle.length) % st.treadle.length]; }
  function warpUp(e, p) { return (st.tieup[tr(p)] >>> th(e)) & 1; }
  function warpHex(e) { return st.way[st.warpM[e % st.warpM.length]].c; }
  function weftHex(p) { return st.way[st.weftM[p % st.weftM.length]].c; }

  /* ---------------- structure ---------------- */

  function maskOf(list) {
    var m = 0;
    for (var i = 0; i < list.length; i++) m |= (1 << list[i]);
    return m;
  }
  function bitsOf(mask, S) {
    var out = [];
    for (var i = 0; i < S; i++) if ((mask >>> i) & 1) out.push(i + 1);
    return out;
  }

  function straightDraw(S, reps) {
    var a = [];
    for (var k = 0; k < (reps || 1); k++) for (var i = 0; i < S; i++) a.push(i);
    return a;
  }
  function pointDraw(S) {
    var a = [], i;
    for (i = 0; i < S; i++) a.push(i);
    for (i = S - 2; i > 0; i--) a.push(i);
    return a;
  }
  function undulatingDraw(r, S) {
    var a = [], legs = ri(r, 3, 5), cur = 0, dir = 1, i, j;
    for (i = 0; i < legs; i++) {
      var top = ri(r, Math.max(1, Math.floor(S / 2)), S - 1);
      var bot = ri(r, 0, Math.max(0, Math.floor(S / 2) - 1));
      var target = dir > 0 ? top : bot;
      while (cur !== target) { a.push(cur); cur += (target > cur ? 1 : -1); }
      a.push(cur);
      dir = -dir;
    }
    if (a.length < 6) for (j = 0; j < S; j++) a.push(j);
    return a;
  }
  function advancingDraw(r, S, adv, reps) {
    var a = [], start = 0, k, i;
    for (k = 0; k < reps; k++) {
      for (i = 0; i < S; i++) a.push((start + i) % S);
      start = (start + adv) % S;
    }
    return a;
  }
  function blockDraw(r, S, overlap) {
    var nb = ri(r, 4, 7), a = [], i, j;
    var lastB = -1;
    a.blocks = [];
    for (i = 0; i < nb; i++) {
      var b;
      do { b = ri(r, 0, (overlap ? S : Math.floor(S / 2)) - 1); } while (b === lastB && S > 2);
      lastB = b;
      var s1 = overlap ? b : b * 2;
      var s2 = overlap ? (b + 1) % S : b * 2 + 1;
      var pairs = ri(r, 2, 7);
      for (j = 0; j < pairs; j++) { a.push(s1); a.push(s2); }
      a.blocks.push({ b: b, pairs: pairs });
    }
    return a;
  }

  function twillTieup(S, T, n) {
    var t = [], i, j, list;
    for (i = 0; i < T; i++) {
      list = [];
      for (j = 0; j < n; j++) list.push((i + j) % S);
      t.push(maskOf(list));
    }
    return t;
  }
  function satinTieup(S, T, step, warpFaced) {
    var t = [], i, j, list;
    for (i = 0; i < T; i++) {
      var s = (i * step) % S;
      list = [];
      if (warpFaced) { for (j = 0; j < S; j++) if (j !== s) list.push(j); }
      else list.push(s);
      t.push(maskOf(list));
    }
    return t;
  }
  function tabbyTieup(S, T, groups) {
    var t = [], i, j, list;
    for (i = 0; i < T; i++) {
      list = [];
      for (j = 0; j < S; j++) if (Math.floor(j / groups) % 2 === (i % 2)) list.push(j);
      t.push(maskOf(list));
    }
    return t;
  }
  function honeycombTieup(S, T) {
    var t = [], i, j, list;
    for (i = 0; i < T; i++) {
      list = [];
      for (j = 0; j < S; j++) if (j !== i % S && j !== (i + 1) % S) list.push(j);
      t.push(maskOf(list));
    }
    return t;
  }
  function coprime(a, b) { while (b) { var t = a % b; a = b; b = t; } return a === 1; }

  function buildStructure(r, forced) {
    var fams = ['twill', 'twill', 'herringbone', 'herringbone', 'tabby', 'satin',
      'honeycomb', 'overshot', 'overshot', 'msoos', 'advancing', 'undulating'];
    var fam = forced || pk(r, fams);
    var S, T, n, tieup, thread, treadle, names = {}, weftPattern = null;

    if (fam === 'tabby') {
      var groups = pk(r, [1, 1, 2, 2, 3]);
      S = groups === 1 ? pk(r, [2, 4]) : groups * 2;
      T = 4;
      thread = straightDraw(S, 1);
      tieup = tabbyTieup(S, T, groups);
      treadle = [];
      for (var q = 0; q < 2 * groups; q++) treadle.push(q < groups ? 0 : 1);
      names.structure = groups === 1 ? 'plain weave (tabby)'
        : groups === 2 ? '2/2 hopsack' : groups + '/' + groups + ' basket';
      names.threading = 'straight draw over ' + S;
      names.tieup = groups === 1 ? 'the two tabby sheds' : 'alternating groups of ' + groups;
      names.treadling = 'alternated, ' + groups + ' and ' + groups;
    } else if (fam === 'satin') {
      S = pk(r, [5, 7, 8, 8, 10]);
      var steps = [];
      for (var k = 2; k < S - 1; k++) if (coprime(k, S)) steps.push(k);
      var step = steps.length ? pk(r, steps) : 2;
      T = S;
      var warpFaced = r() < 0.6;
      thread = straightDraw(S, 1);
      tieup = satinTieup(S, T, step, warpFaced);
      treadle = straightDraw(T, 1);
      names.structure = S + '-end ' + (warpFaced ? 'warp' : 'weft') + '-faced satin';
      names.threading = 'straight draw over ' + S;
      names.tieup = 'satin, counting ' + step;
      names.treadling = 'straight, one shaft at a time';
    } else if (fam === 'honeycomb') {
      S = pk(r, [5, 6, 7, 8]);
      T = S;
      thread = pointDraw(S);
      tieup = honeycombTieup(S, T);
      treadle = pointDraw(T);
      names.structure = 'honeycomb on ' + S + ' shafts';
      names.threading = 'point draw over ' + S;
      names.tieup = 'two shafts down, stepped';
      names.treadling = 'point, to match the threading';
    } else if (fam === 'overshot') {
      S = pk(r, [4, 4, 4, 6]);
      T = S + 2;
      thread = blockDraw(r, S, true);
      tieup = [];
      var fullS = (1 << S) - 1;
      for (var y2 = 0; y2 < S; y2++) tieup.push(fullS & ~maskOf([y2, (y2 + 1) % S]));
      var ev = [], od = [];
      for (var z = 0; z < S; z++) (z % 2 === 0 ? ev : od).push(z);
      tieup.push(maskOf(ev));
      tieup.push(maskOf(od));
      treadle = []; weftPattern = [];
      var tb = 0, bl = thread.blocks || [];
      for (var i2 = 0; i2 < bl.length; i2++) {
        for (var j2 = 0; j2 < bl[i2].pairs; j2++) {
          treadle.push(bl[i2].b); weftPattern.push(1);
          treadle.push(S + (tb % 2)); weftPattern.push(0);
          tb++;
        }
      }
      names.structure = 'overshot on ' + bl.length + ' blocks';
      names.threading = 'overlapping blocks, ' + bl.length + ' of them';
      names.tieup = 'each pattern treadle sinks its own block, plus two tabby treadles';
      names.treadling = 'tromp as writ, tabby between every pattern pick';
    } else if (fam === 'msoos') {
      S = 4; T = 4;
      thread = blockDraw(r, S, false);
      tieup = [maskOf([0, 1, 2]), maskOf([3]), maskOf([0, 2, 3]), maskOf([1])];
      treadle = [];
      var bl2 = thread.blocks || [];
      for (var i3 = 0; i3 < bl2.length; i3++) {
        var reps3 = bl2[i3].pairs;
        for (var j3 = 0; j3 < reps3; j3++) {
          if (bl2[i3].b === 0) { treadle.push(0); treadle.push(1); }
          else { treadle.push(2); treadle.push(3); }
        }
      }
      names.structure = 'Ms and Os';
      names.threading = 'two blocks, ' + bl2.length + ' of them in the run';
      names.tieup = 'one block paired while the other weaves plain, and the reverse';
      names.treadling = 'block for block with the threading';
    } else if (fam === 'advancing') {
      S = pk(r, [6, 8, 8, 10, 12]);
      T = S;
      n = ri(r, 2, Math.max(2, S - 2));
      var adv = pk(r, [1, 1, 2, 3]);
      thread = advancingDraw(r, S, adv, ri(r, 3, 6));
      tieup = twillTieup(S, T, n);
      treadle = straightDraw(T, 1);
      names.structure = n + '/' + (S - n) + ' advancing twill';
      names.threading = 'straight runs, each one advanced by ' + adv;
      names.tieup = n + ' up, ' + (S - n) + ' down, stepped one shaft a treadle';
      names.treadling = 'straight';
    } else if (fam === 'undulating') {
      S = pk(r, [6, 8, 8, 10, 12]);
      T = S;
      n = ri(r, 2, Math.max(2, S - 2));
      thread = undulatingDraw(r, S);
      tieup = twillTieup(S, T, n);
      treadle = r() < 0.5 ? pointDraw(T) : straightDraw(T, 1);
      names.structure = 'undulating ' + n + '/' + (S - n) + ' twill';
      names.threading = 'a point draw with legs of unequal length';
      names.tieup = n + ' up, ' + (S - n) + ' down, stepped one shaft a treadle';
      names.treadling = treadle.length > T ? 'point' : 'straight';
    } else if (fam === 'herringbone') {
      S = pk(r, [4, 6, 8, 8, 10, 12]);
      T = S;
      n = ri(r, 2, Math.max(2, S - 2));
      thread = pointDraw(S);
      tieup = twillTieup(S, T, n);
      treadle = r() < 0.45 ? pointDraw(T) : straightDraw(T, 2);
      names.structure = (treadle.length > T ? 'diamond ' : 'herringbone ') + n + '/' + (S - n) + ' twill';
      names.threading = 'point draw over ' + S;
      names.tieup = n + ' up, ' + (S - n) + ' down, stepped one shaft a treadle';
      names.treadling = treadle.length > T ? 'point' : 'straight';
    } else {
      fam = 'twill';
      S = pk(r, [3, 4, 4, 5, 6, 6, 8, 8, 10, 12]);
      T = S;
      n = ri(r, 1, Math.max(1, S - 1));
      thread = straightDraw(S, 1);
      tieup = twillTieup(S, T, n);
      treadle = r() < 0.2 ? straightDraw(T, 1).slice().reverse() : straightDraw(T, 1);
      names.structure = n + '/' + (S - n) + ' twill';
      names.threading = 'straight draw over ' + S;
      names.tieup = n + ' up, ' + (S - n) + ' down, stepped one shaft a treadle';
      names.treadling = 'straight';
    }

    for (var w = 0; w < tieup.length; w++) {
      var full = (1 << S) - 1;
      if (tieup[w] === 0) tieup[w] = 1;
      if (tieup[w] === full) tieup[w] = full & ~1;
    }

    st.S = S; st.T = T; st.tieup = tieup;
    st.thread = thread.slice(); st.treadle = treadle.slice();
    st.family = fam; st.names = names;
    st.weftPattern = weftPattern;
  }

  /* ---------------- colour ---------------- */
  function buildColour(r, plan) {
    var i;
    var way = [], tries = 0;
    do {
      way = [];
      var count = pk(r, [2, 2, 3, 3, 4]);
      var used = {};
      while (way.length < count) {
        var d = pk(r, DYES);
        if (used[d.n]) continue;
        used[d.n] = 1; way.push(d);
      }
      way.sort(function (a, b) { return lumOf(a.c) - lumOf(b.c); });
      tries++;
    } while (tries < 40 && (lumOf(way[way.length - 1].c) - lumOf(way[0].c)) < 0.3);
    st.way = way;

    var N = way.length;
    var plans = ['stripe', 'stripe', 'log cabin', 'tartan', 'solid', 'shadow'];
    if (st.family === 'overshot') plan = plan && plan !== 'dealt' ? plan : 'overshot';
    var p = (plan && plan !== 'dealt') ? plan : pk(r, plans);
    if (p === 'overshot' && st.family !== 'overshot') p = 'stripe';
    st.plan = p;

    var warp = [], weft = [];

    if (p === 'solid') {
      warp = [N - 1];
      weft = [0];
      st.planName = 'one colour in the warp, one in the weft';
    } else if (p === 'log cabin') {
      var light = N - 1, dark = 0;
      var blk = ri(r, 5, 12);
      for (i = 0; i < blk * 2; i++) {
        var phase = i < blk ? 0 : 1;
        warp.push((i % 2 === phase) ? light : dark);
      }
      weft = warp.slice();
      st.planName = 'log cabin: light and dark alternating end for end, flipped every ' + blk;
    } else if (p === 'tartan') {
      var sett = [], bands = ri(r, 3, 5);
      for (i = 0; i < bands; i++) sett.push({ c: i % N, w: ri(r, 2, 12) });
      var full = sett.slice();
      for (i = sett.length - 2; i >= 1; i--) full.push(sett[i]);
      for (i = 0; i < full.length; i++) for (var j = 0; j < full[i].w; j++) warp.push(full[i].c);
      weft = warp.slice();
      st.planName = 'a sett of ' + bands + ' bands, repeated warp and weft alike';
    } else if (p === 'shadow') {
      warp = [0, N - 1];
      weft = [N - 1, 0];
      st.planName = 'shadow weave: two colours alternating, out of step';
    } else if (p === 'overshot') {
      warp = [N - 1];
      weft = [0];
      st.planName = 'a pale warp, a dark pattern weft and a tabby the colour of the warp';
    } else {
      var stripes = ri(r, 2, 5);
      for (i = 0; i < stripes; i++) {
        var col = ri(r, 0, N - 1), wdt = ri(r, 3, 18);
        for (var m = 0; m < wdt; m++) warp.push(col);
      }
      if (r() < 0.5) { weft = warp.slice(); st.planName = 'stripes, and the weft repeats them'; }
      else {
        var s2 = ri(r, 1, 3);
        for (i = 0; i < s2; i++) {
          var c2 = ri(r, 0, N - 1), w2 = ri(r, 4, 20);
          for (var m2 = 0; m2 < w2; m2++) weft.push(c2);
        }
        st.planName = 'stripes in the warp, broader ones in the weft';
      }
      st.plan = 'stripe';
    }

    if (st.family === 'overshot' && st.weftPattern) {
      var pat = weft.length ? weft[0] : 0;
      var grd = warp.length ? warp[0] : N - 1;
      if (pat === grd) pat = (grd === 0) ? N - 1 : 0;
      weft = [];
      for (i = 0; i < st.weftPattern.length; i++) weft.push(st.weftPattern[i] ? pat : grd);
      if (p !== 'overshot') {
        st.planName += ', with the overshot weft kept dark and its tabby kept invisible';
      }
    }

    st.warpM = warp.length ? warp : [N - 1];
    st.weftM = weft.length ? weft : [0];
  }

  /* ---------------- the plaque ---------------- */
  function buildPlaque(r) {
    var place = placeName(r);
    var epi = ri(r, 12, 40);
    st.plaque = {
      name: place + ' ' + st.names.structure,
      weaver: pk(r, GIVEN) + ' ' + pk(r, TRADE),
      mill: r() < 0.5 ? 'the loom shop at ' + placeName(r) : placeName(r) + ' mill',
      fibre: pk(r, FIBRES),
      weft: pk(r, FIBRES),
      sett: epi + ' ends and ' + (epi + ri(r, -4, 3)) + ' picks to the inch',
      width: ri(r, 18, 46) + ' inches in the reed',
      length: ri(r, 4, 30) + ' yards',
      purpose: pk(r, PURPOSE),
      fate: pk(r, FATE)
    };
  }

  /* ---------------- build ---------------- */
  function build(seed, forcedFamily, forcedPlan) {
    st.seed = seed >>> 0;
    var r = rng(st.seed);
    buildStructure(r, forcedFamily);
    buildColour(r, forcedPlan);
    buildPlaque(r);
    st.edited = false;
    st.woven = 0;
    startWeaving();
    writeOut();
  }

  function recolour(plan) {
    var r = rng((st.seed ^ 0x5bf03635) >>> 0);
    buildColour(r, plan);
    st.woven = layout().P;
    render();
    writeOut();
  }

  /* ---------------- layout ---------------- */
  function layout() {
    var pad = 18, gap = 10, c = st.cell;
    var right = st.showDraft ? (st.T * c + gap) : 0;
    var top = st.showDraft ? (st.S * c + gap) : 0;
    var E = Math.max(8, Math.floor((CW - pad * 2 - right) / c));
    var P = Math.max(8, Math.floor((CH - pad * 2 - top) / c));
    return {
      c: c, E: E, P: P, pad: pad, gap: gap,
      dx: pad, dy: pad + top,
      thx: pad, thy: pad,
      tux: pad + E * c + gap, tuy: pad,
      trx: pad + E * c + gap, tly: pad + top
    };
  }

  /* ---------------- drawing ---------------- */
  function rrect(x, y, w, h, rad) {
    rad = Math.min(rad, w / 2, h / 2);
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); return; }
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function drawCloth(L) {
    var c = L.c, rows = Math.max(0, Math.min(Math.floor(st.woven), L.P));
    var mono = st.view === 'structure';
    var e, p;

    ctx.save();
    ctx.beginPath();
    ctx.rect(L.dx - 1, L.dy - 1, L.E * c + 2, L.P * c + 2);
    ctx.clip();

    for (p = 0; p < rows; p++) {
      var y = L.dy + p * c;
      ctx.fillStyle = mono ? '#15181e' : weftHex(p);
      ctx.fillRect(L.dx, y, L.E * c, c);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(L.dx, y, L.E * c, 1);
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      ctx.fillRect(L.dx, y + c - 1.6, L.E * c, 1);
    }

    for (e = 0; e < L.E; e++) {
      var run = 0, x = L.dx + e * c;
      for (p = 0; p <= rows; p++) {
        var up = p < rows && warpUp(e, p);
        if (up) { run++; continue; }
        if (run) {
          var y0 = L.dy + (p - run) * c;
          var h = run * c - 0.8;
          ctx.fillStyle = mono ? '#dfe6f0' : warpHex(e);
          rrect(x + 0.7, y0 + 0.4, c - 1.4, h, Math.min(c * 0.42, 4));
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.24)';
          ctx.fillRect(x + 0.7, y0 + 0.8, 1, h - 0.8);
          ctx.fillStyle = 'rgba(255,255,255,.12)';
          ctx.fillRect(x + c - 2.4, y0 + 0.8, 1, h - 0.8);
          run = 0;
        }
      }
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L.dx - 0.5, L.dy - 0.5, L.E * c + 1, Math.max(1, rows * c) + 1);
  }

  function drawShuttle(L) {
    var c = L.c, p = Math.floor(st.woven);
    if (p >= L.P) return;
    var frac = st.woven - p;
    var ltr = p % 2 === 0;
    var span = L.E * c;
    var x = L.dx + (ltr ? frac * span : (1 - frac) * span);
    var y = L.dy + p * c + c / 2;
    ctx.strokeStyle = weftHex(p);
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1.5, c * 0.5);
    ctx.beginPath();
    ctx.moveTo(ltr ? L.dx : L.dx + span, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d9c39a';
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(7, c * 1.5), Math.max(3.2, c * 0.42), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(2.4, c * 0.4), Math.max(1.6, c * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function grid(x, y, cols, rows, c) {
    ctx.strokeStyle = 'rgba(255,255,255,.075)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var i;
    for (i = 0; i <= cols; i++) {
      var gx = Math.round(x + i * c) + 0.5;
      ctx.moveTo(gx, y); ctx.lineTo(gx, y + rows * c);
    }
    for (i = 0; i <= rows; i++) {
      var gy = Math.round(y + i * c) + 0.5;
      ctx.moveTo(x, gy); ctx.lineTo(x + cols * c, gy);
    }
    ctx.stroke();
  }

  function drawDraft(L) {
    var c = L.c, i, j;

    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fillRect(L.thx, L.thy, L.E * c, st.S * c);
    ctx.fillStyle = '#64f0c8';
    for (i = 0; i < L.E; i++) {
      ctx.fillRect(L.thx + i * c + 1, L.thy + th(i) * c + 1, c - 2, c - 2);
    }
    grid(L.thx, L.thy, L.E, st.S, c);
    ctx.strokeStyle = 'rgba(122,162,255,.55)';
    ctx.beginPath();
    for (i = 0; i < L.E; i += st.thread.length) {
      var rx = Math.round(L.thx + i * c) + 0.5;
      ctx.moveTo(rx, L.thy - 5); ctx.lineTo(rx, L.thy + st.S * c);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fillRect(L.tux, L.tuy, st.T * c, st.S * c);
    ctx.fillStyle = '#7aa2ff';
    for (i = 0; i < st.T; i++) {
      for (j = 0; j < st.S; j++) {
        if ((st.tieup[i] >>> j) & 1) ctx.fillRect(L.tux + i * c + 1, L.tuy + j * c + 1, c - 2, c - 2);
      }
    }
    grid(L.tux, L.tuy, st.T, st.S, c);

    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fillRect(L.trx, L.tly, st.T * c, L.P * c);
    ctx.fillStyle = '#64f0c8';
    for (i = 0; i < L.P; i++) {
      ctx.fillRect(L.trx + tr(i) * c + 1, L.tly + i * c + 1, c - 2, c - 2);
    }
    grid(L.trx, L.tly, st.T, L.P, c);
    ctx.strokeStyle = 'rgba(122,162,255,.55)';
    ctx.beginPath();
    for (i = 0; i < L.P; i += st.treadle.length) {
      var ry = Math.round(L.tly + i * c) + 0.5;
      ctx.moveTo(L.trx, ry); ctx.lineTo(L.trx + st.T * c, ry);
    }
    ctx.stroke();
  }

  function render() {
    var L = layout();
    st.L = L;
    ctx.fillStyle = '#0c0f13';
    ctx.fillRect(0, 0, CW, CH);
    drawCloth(L);
    if (st.showDraft) drawDraft(L);
    if (st.animating) drawShuttle(L);
  }

  /* ---------------- weaving ---------------- */
  var raf = null, last = 0;
  function startWeaving() {
    var L = layout();
    if (reduce) { st.woven = L.P; st.animating = false; render(); return; }
    st.woven = 0;
    st.animating = true;
    last = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    var L = layout();
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    st.woven += dt * Math.max(24, L.P / 2.4);
    if (st.woven >= L.P) { st.woven = L.P; st.animating = false; }
    render();
    if (st.animating) raf = requestAnimationFrame(tick);
  }

  /* ---------------- stats ---------------- */
  function stats() {
    var L = st.L || layout();
    var e, p, longestWarp = 0, longestWeft = 0, up = 0, total = 0;
    for (e = 0; e < L.E; e++) {
      var run = 0;
      for (p = 0; p < L.P; p++) {
        if (warpUp(e, p)) { run++; if (run > longestWarp) longestWarp = run; }
        else run = 0;
      }
    }
    for (p = 0; p < L.P; p++) {
      var run2 = 0;
      for (e = 0; e < L.E; e++) {
        if (!warpUp(e, p)) { run2++; if (run2 > longestWeft) longestWeft = run2; }
        else { run2 = 0; up++; }
        total++;
      }
    }
    return {
      warpFloat: longestWarp, weftFloat: longestWeft,
      face: total ? up / total : 0.5, E: L.E, P: L.P
    };
  }

  /* ---------------- readouts ---------------- */
  function swatchRow() {
    var h = '<div class="swatches">';
    for (var i = 0; i < st.way.length; i++) {
      h += '<i style="background:' + st.way[i].c + '" title="' + esc(st.way[i].n) + '"></i>';
    }
    h += '</div><p class="card-note">' +
      st.way.map(function (d) { return esc(d.n); }).join(', ') + '.</p>';
    return h;
  }

  function writeOut() {
    var s = stats(), pl = st.plaque;
    var elS = $('seedOut'); if (elS) elS.textContent = String(st.seed);
    var elW = $('weaveOut'); if (elW) elW.textContent = st.names.structure;
    var elC = $('clothOut'); if (elC) elC.textContent = s.E + ' × ' + s.P;

    var pq = $('plaque');
    if (pq) {
      pq.innerHTML =
        '<div class="seed-num">' + esc(pl.name) + '</div>' +
        '<p class="card-lead">Woven by ' + esc(pl.weaver) + ' at ' + esc(pl.mill) +
        ', ' + esc(pl.length) + ' of it, ' + esc(pl.width) + ' wide, at ' + esc(pl.sett) + '. ' +
        'Warp of ' + esc(pl.fibre) + ', weft of ' + esc(pl.weft) + '. Made for ' +
        esc(pl.purpose) + '. It was ' + esc(pl.fate) + '.</p>' +
        swatchRow();
    }

    var sp = $('spec');
    if (sp) {
      var rows = [
        ['Structure', st.names.structure],
        ['Shafts and treadles', st.S + ' shafts, ' + st.T + ' treadles'],
        ['Threading', st.names.threading + ' — repeat of ' + st.thread.length + ' ends'],
        ['Tie-up', st.names.tieup],
        ['Treadling', st.names.treadling + ' — repeat of ' + st.treadle.length + ' picks'],
        ['Colour', st.planName],
        ['On the loom', s.E + ' ends by ' + s.P + ' picks at this sett'],
        ['Longest float', s.warpFloat + ' picks in the warp, ' + s.weftFloat + ' ends in the weft'],
        ['Face', Math.round(s.face * 100) + '% of the surface is warp'],
        ['State', st.edited ? 'altered at the loom by hand' : 'exactly as the day dealt it']
      ];
      var h = '<table>';
      for (var i = 0; i < rows.length; i++) {
        h += '<tr><th>' + rows[i][0] + '</th><td><b>' + esc(rows[i][1]) + '</b></td></tr>';
      }
      sp.innerHTML = h + '</table>';
    }
  }

  function cellCard(html) {
    var el = $('cellCard');
    if (el) el.innerHTML = html;
  }
  function idleCard() {
    cellCard('<p class="card-lead">Click anywhere on the draft or on the cloth and this card ' +
      'will tell you what you are looking at.</p>' +
      '<p class="card-note">The strip along the top is the <b>threading</b>: one mark for every ' +
      'warp thread, at the height of the shaft it is threaded through. The small square in the ' +
      'corner is the <b>tie-up</b>: which shafts each treadle lifts. The column down the right is ' +
      'the <b>treadling</b>: which treadle is pressed for each pick of weft. Everything else on ' +
      'this page is only what those three things make.</p>');
  }

  /* ---------------- interaction ---------------- */
  function toCanvas(ev) {
    var r = cv.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (CW / r.width),
      y: (ev.clientY - r.top) * (CH / r.height)
    };
  }

  function regionAt(pt) {
    var L = st.L || layout(), c = L.c;
    if (st.showDraft) {
      if (pt.y >= L.thy && pt.y < L.thy + st.S * c && pt.x >= L.thx && pt.x < L.thx + L.E * c) {
        return { r: 'threading', e: Math.floor((pt.x - L.thx) / c), s: Math.floor((pt.y - L.thy) / c) };
      }
      if (pt.y >= L.tuy && pt.y < L.tuy + st.S * c && pt.x >= L.tux && pt.x < L.tux + st.T * c) {
        return { r: 'tieup', t: Math.floor((pt.x - L.tux) / c), s: Math.floor((pt.y - L.tuy) / c) };
      }
      if (pt.y >= L.tly && pt.y < L.tly + L.P * c && pt.x >= L.trx && pt.x < L.trx + st.T * c) {
        return { r: 'treadling', p: Math.floor((pt.y - L.tly) / c), t: Math.floor((pt.x - L.trx) / c) };
      }
    }
    if (pt.x >= L.dx && pt.x < L.dx + L.E * c && pt.y >= L.dy && pt.y < L.dy + L.P * c) {
      return { r: 'cloth', e: Math.floor((pt.x - L.dx) / c), p: Math.floor((pt.y - L.dy) / c) };
    }
    return null;
  }

  function explain(hit) {
    if (hit.r === 'threading') {
      var idx = hit.e % st.thread.length;
      cellCard('<p class="card-lead">Warp end ' + (hit.e + 1) + ' now goes through shaft <b>' +
        (hit.s + 1) + '</b>.</p><p class="card-note">You have edited position ' + (idx + 1) +
        ' of a threading repeat ' + st.thread.length + ' ends long, so the change has run the ' +
        'whole width of the cloth — which is what happens at a real loom when you rethread ' +
        'a repeat.</p>');
    } else if (hit.r === 'tieup') {
      var on = (st.tieup[hit.t] >>> hit.s) & 1;
      cellCard('<p class="card-lead">Treadle ' + (hit.t + 1) + ' ' + (on ? 'now lifts' : 'no longer lifts') +
        ' shaft ' + (hit.s + 1) + '.</p><p class="card-note">It lifts shafts <b>' +
        (bitsOf(st.tieup[hit.t], st.S).join(', ') || 'none') + '</b>. Every pick woven on that ' +
        'treadle has just changed.</p>');
    } else if (hit.r === 'treadling') {
      var idxp = hit.p % st.treadle.length;
      cellCard('<p class="card-lead">Pick ' + (hit.p + 1) + ' is now woven on treadle <b>' +
        (hit.t + 1) + '</b>, which lifts shafts ' + (bitsOf(st.tieup[hit.t], st.S).join(', ') || 'none') +
        '.</p><p class="card-note">That is position ' + (idxp + 1) + ' of a treadling repeat ' +
        st.treadle.length + ' picks long, so it has changed all the way down the cloth.</p>');
    } else if (hit.r === 'cloth') {
      var sh = th(hit.e), t = tr(hit.p), up = warpUp(hit.e, hit.p);
      var col = up ? warpHex(hit.e) : weftHex(hit.p);
      var name = up ? st.way[st.warpM[hit.e % st.warpM.length]].n
        : st.way[st.weftM[hit.p % st.weftM.length]].n;
      cellCard('<p class="card-lead">End ' + (hit.e + 1) + ', pick ' + (hit.p + 1) + ': <b>' +
        (up ? 'the warp is over the weft' : 'the weft is over the warp') + '</b>, so what you see ' +
        'at that crossing is ' + esc(name) +
        '<span style="display:inline-block;width:13px;height:13px;border-radius:4px;' +
        'vertical-align:-1px;margin-left:8px;border:1px solid rgba(255,255,255,.25);background:' +
        col + '"></span></p>' +
        '<p class="card-note">That end is threaded on shaft ' + (sh + 1) + '. That pick is woven on ' +
        'treadle ' + (t + 1) + ', which lifts shafts ' + (bitsOf(st.tieup[t], st.S).join(', ') || 'none') +
        '. Shaft ' + (sh + 1) + ' is ' + (up ? '' : 'not ') + 'among them. That one test, asked ' +
        'again for every square on this cloth, is the whole of weaving.</p>');
    }
  }

  var painting = null;

  function applyAt(pt, first) {
    var hit = regionAt(pt);
    if (!hit) return;
    if (painting && painting !== hit.r) return;
    if (hit.r === 'threading') {
      st.thread[hit.e % st.thread.length] = Math.min(st.S - 1, Math.max(0, hit.s));
      st.edited = true;
    } else if (hit.r === 'tieup') {
      if (!first) return;
      st.tieup[hit.t] ^= (1 << hit.s);
      st.edited = true;
    } else if (hit.r === 'treadling') {
      st.treadle[hit.p % st.treadle.length] = Math.min(st.T - 1, Math.max(0, hit.t));
      st.edited = true;
    }
    if (hit.r !== 'cloth') {
      st.animating = false;
      st.woven = layout().P;
      render();
      writeOut();
    }
    if (first) explain(hit);
  }

  cv.addEventListener('pointerdown', function (ev) {
    var pt = toCanvas(ev);
    var hit = regionAt(pt);
    if (!hit) return;
    painting = hit.r === 'cloth' ? null : hit.r;
    if (painting && cv.setPointerCapture) { try { cv.setPointerCapture(ev.pointerId); } catch (err) {} }
    applyAt(pt, true);
    ev.preventDefault();
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!painting) return;
    applyAt(toCanvas(ev), false);
  });
  window.addEventListener('pointerup', function () { painting = null; });

  /* ---------------- controls ---------------- */
  var FAMILIES = [
    ['dealt', 'Today’s draft'],
    ['tabby', 'Plain weave'],
    ['twill', 'Twill'],
    ['herringbone', 'Herringbone'],
    ['satin', 'Satin'],
    ['honeycomb', 'Honeycomb'],
    ['overshot', 'Overshot'],
    ['msoos', 'Ms and Os'],
    ['advancing', 'Advancing twill'],
    ['undulating', 'Undulating twill']
  ];
  var PLANS = [
    ['dealt', 'As dyed'],
    ['solid', 'One colour'],
    ['stripe', 'Stripes'],
    ['log cabin', 'Log cabin'],
    ['tartan', 'Tartan sett'],
    ['shadow', 'Shadow weave']
  ];

  var curFam = 'dealt', curPlan = 'dealt';

  function chipRow(host, list, cur, fn) {
    var el = $(host);
    if (!el) return;
    el.innerHTML = '';
    list.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (item[0] === cur ? ' on' : '');
      b.textContent = item[1];
      b.addEventListener('click', function () {
        fn(item[0]);
        Array.prototype.forEach.call(el.children, function (k) { k.classList.remove('on'); });
        b.classList.add('on');
      });
      el.appendChild(b);
    });
  }

  function fams() {
    chipRow('families', FAMILIES, curFam, function (v) {
      curFam = v;
      build(st.seed, v === 'dealt' ? null : v, curPlan);
      idleCard();
    });
  }
  function plans() {
    chipRow('plans', PLANS, curPlan, function (v) { curPlan = v; recolour(v); });
  }
  fams(); plans();

  var sett = $('sett');
  if (sett) {
    sett.addEventListener('input', function () {
      st.cell = parseInt(sett.value, 10);
      var o = $('settOut');
      if (o) o.textContent = st.cell + ' px a thread';
      st.woven = layout().P;
      st.animating = false;
      render();
      writeOut();
    });
    st.cell = parseInt(sett.value, 10) || 9;
    var so = $('settOut');
    if (so) so.textContent = st.cell + ' px a thread';
  }

  function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }

  wire('btnDraft', function () {
    st.showDraft = !st.showDraft;
    this.textContent = st.showDraft ? 'Hide the draft' : 'Show the draft';
    this.classList.toggle('on', st.showDraft);
    st.woven = layout().P;
    st.animating = false;
    render();
    writeOut();
  });
  wire('btnView', function () {
    st.view = st.view === 'cloth' ? 'structure' : 'cloth';
    this.textContent = st.view === 'cloth' ? 'Black and white' : 'Back to the yarn';
    this.classList.toggle('on', st.view === 'structure');
    render();
  });
  wire('btnWeave', function () { startWeaving(); });
  wire('btnNew', function () {
    curFam = 'dealt'; curPlan = 'dealt'; fams(); plans();
    build((Math.random() * 4294967295) >>> 0, null, null);
    idleCard();
  });
  wire('btnToday', function () {
    curFam = 'dealt'; curPlan = 'dealt'; fams(); plans();
    build(seedForToday(), null, null);
    idleCard();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && raf) { cancelAnimationFrame(raf); st.animating = false; }
  });

  /* ---------------- go ---------------- */
  idleCard();
  build(seedForToday(), null, null);
})();
