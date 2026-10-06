/* drift.quibo.games — The Cloister
   Heredity. The day's number fills a priory seed drawer with two pure-breeding lines of an
   invented garden pea and one odd plant that came up by the well. Four characters are in play
   today. For each, the number decides which form wins in a plant that carries one copy of
   each, or whether neither does and the plant comes out in between. It also puts two of the
   four characters on the same chromosome, a set distance apart, so they travel together
   unless a crossover splits them.
   You get eight beds. Pick a seed parent and a pollen parent (or let a plant fertilise
   itself), sow, count the offspring, keep any plant you like for the next cross, and run the
   ratio bench over your counts. Then write up the notebook: which form wins for each
   character, which two characters are linked and how often they come apart, and what the
   well plant carries. The page checks it against the drawer, and reads your own crosses back
   to you through a maximum-likelihood estimate of the crossover rate. Self-contained. */
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
    var h = s ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function listJoin(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  var $ = function (id) { return document.getElementById(id); };

  var BEDS = 8;          // crosses allowed per day
  var KEEP_MAX = 14;     // plants the drawer will hold

  /* ---------- the characters ---------- */
  // each has two forms (0 and 1) and the look of a plant carrying one of each when neither wins (2)
  var TRAITS = [
    { key: 'height', name: 'Height', f: ['tall', 'dwarf', 'half-height'], noun: 'stem' },
    { key: 'flower', name: 'Flower', f: ['violet', 'white', 'lilac'], noun: 'flower' },
    { key: 'shape', name: 'Seed shape', f: ['round', 'wrinkled', 'dimpled'], noun: 'seed' },
    { key: 'seed', name: 'Seed colour', f: ['yellow', 'green', 'lime'], noun: 'seed' },
    { key: 'pod', name: 'Pod shape', f: ['inflated', 'pinched', 'waisted'], noun: 'pod' },
    { key: 'podc', name: 'Pod colour', f: ['green', 'golden', 'streaked'], noun: 'pod' }
  ];
  var LINES = ['Hallam Early', 'Greystone Marrowfat', 'Lammas Dwarf', 'Oxley Sugar', 'Wrenfield Purple', 'Abbey Tall', 'Harrow Green', 'Saltmarsh Round', 'Kettlewell Blue', 'Candlemas Long', 'Thornby Wonder', 'Brackenridge'];
  var PRIORIES = ['Saint Aldric', 'Saint Wenna', 'Saint Cuthwin', 'Saint Elfleda', 'Saint Brannoc', 'Saint Ninian of the Fens', 'Saint Osyth Minor', 'Saint Hilda by the Water'];
  var KEEPERS = ['the infirmarian', 'the cellarer', 'the sub-prior', 'the almoner', 'the novice master', 'the sacristan'];

  /* ---------- genetics ---------- */
  // a plant is two haplotypes (one from each parent), each an array of 0/1 alleles, one per active trait
  function geno(pl, k) { return pl.h[0][k] + pl.h[1][k]; }          // how many copies of form 1
  function phen1(D, g, k) {
    var m = D.mode[k];
    if (m === 0) return g === 2 ? 1 : 0;      // form 0 wins
    if (m === 1) return g === 0 ? 0 : 1;      // form 1 wins
    return g === 0 ? 0 : g === 2 ? 1 : 2;     // neither: heterozygote in between
  }
  function phen(D, pl) { var p = []; for (var k = 0; k < D.T.length; k++) p.push(phen1(D, geno(pl, k), k)); return p; }
  function gamete(D, pl, r) {
    var g = [], c;
    for (var k = 0; k < D.T.length; k++) g.push(pl.h[r() < 0.5 ? 0 : 1][k]);
    // the linked pair rides on one chromosome; a crossover between them swaps the second
    c = r() < 0.5 ? 0 : 1;
    g[D.link[0]] = pl.h[c][D.link[0]];
    g[D.link[1]] = pl.h[r() < D.rf ? 1 - c : c][D.link[1]];
    return g;
  }
  function mate(D, mo, fa, r) { return { h: [gamete(D, mo, r), gamete(D, fa, r)] }; }

  /* ---------- build the day ---------- */
  function build(seed) {
    var r = rng(seed);
    var idx = shuffle(r, [0, 1, 2, 3, 4, 5]).slice(0, 4).sort();
    var T = idx.map(function (i) { return TRAITS[i]; });
    var mode = [], blends = 0;
    for (var k = 0; k < 4; k++) {
      var u = r(), m;
      if (u < 0.22 && blends < 2) { m = 2; blends++; } else m = u < 0.61 ? 0 : 1;
      mode.push(m);
    }
    var pairs = [];
    for (var a = 0; a < 4; a++) for (var b = a + 1; b < 4; b++) pairs.push([a, b]);
    var link = pick(r, pairs);
    var rf = Math.round((0.06 + r() * 0.26) * 100) / 100;
    // two pure lines, opposite at every character; which forms each carries is the number's choice
    var x = []; for (k = 0; k < 4; k++) x.push(r() < 0.5 ? 0 : 1);
    if (x.every(function (v) { return v === x[0]; })) x[Math.floor(r() * 4)] ^= 1;
    var y = x.map(function (v) { return 1 - v; });
    var names = shuffle(r, LINES);
    var lineA = { id: 'A', name: names[0], h: [x.slice(), x.slice()], origin: 'pure line, true to type for as long as the priory has grown it', fixed: true };
    var lineB = { id: 'B', name: names[1], h: [y.slice(), y.slice()], origin: 'pure line, bought in from a seedsman and kept true since', fixed: true };
    // the well plant: mixed at two or three characters, never the same as either line
    var w0, w1, het;
    do {
      w0 = []; w1 = []; het = 0;
      for (k = 0; k < 4; k++) {
        var q = r();
        if (q < 0.55) { var s = r() < 0.5 ? 0 : 1; w0.push(s); w1.push(1 - s); het++; }
        else { var v = r() < 0.5 ? 0 : 1; w0.push(v); w1.push(v); }
      }
    } while (het < 2 || het > 3);
    var well = { id: 'W', name: 'The well plant', h: [w0, w1], origin: 'came up on its own by the cloister well; nobody knows its parents', fixed: true };
    return {
      seed: seed, T: T, mode: mode, link: link, rf: rf,
      priory: pick(r, PRIORIES), keeper: pick(r, KEEPERS), year: 1850 + Math.floor(r() * 16),
      start: [lineA, lineB, well]
    };
  }

  /* ---------- statistics ---------- */
  function lgamma(z) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    var s = 1.000000000190015; for (var j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function gammq(a, x) { // regularised upper incomplete gamma
    if (x <= 0) return 1;
    var gl = lgamma(a);
    if (x < a + 1) {
      var ap = a, sum = 1 / a, del = sum;
      for (var n = 0; n < 300; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - gl);
    }
    var b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (var i = 1; i < 300; i++) {
      var an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var del2 = d * c; h *= del2; if (Math.abs(del2 - 1) < 1e-12) break;
    }
    return Math.exp(-x + a * Math.log(x) - gl) * h;
  }
  function chiP(x2, df) { return df < 1 ? 1 : gammq(df / 2, x2 / 2); }
  function fmtP(p) { return p < 0.001 ? '< 0.001' : p < 0.01 ? p.toFixed(3) : p.toFixed(2); }
  function goodness(obs, ratio) {
    var n = obs.reduce(function (s, v) { return s + v; }, 0), tot = ratio.reduce(function (s, v) { return s + v; }, 0), x2 = 0, df = -1;
    for (var i = 0; i < obs.length; i++) {
      if (ratio[i] === 0) { if (obs[i] > 0) return { x2: Infinity, p: 0, df: 0 }; continue; }
      var e = n * ratio[i] / tot; x2 += (obs[i] - e) * (obs[i] - e) / e; df++;
    }
    return { x2: x2, df: df, p: df < 1 ? 1 : chiP(x2, df) };
  }
  function independence(tab) {
    var rows = [], cols = [], i, j;
    for (i = 0; i < tab.length; i++) if (tab[i].some(function (v) { return v > 0; })) rows.push(i);
    for (j = 0; j < tab[0].length; j++) if (tab.some(function (row) { return row[j] > 0; })) cols.push(j);
    if (rows.length < 2 || cols.length < 2) return null;
    var n = 0, rs = {}, cs = {};
    rows.forEach(function (a) { rs[a] = 0; cols.forEach(function (b) { rs[a] += tab[a][b]; }); n += rs[a]; });
    cols.forEach(function (b) { cs[b] = 0; rows.forEach(function (a) { cs[b] += tab[a][b]; }); });
    var x2 = 0;
    rows.forEach(function (a) { cols.forEach(function (b) { var e = rs[a] * cs[b] / n; x2 += (tab[a][b] - e) * (tab[a][b] - e) / e; }); });
    var df = (rows.length - 1) * (cols.length - 1);
    return { x2: x2, df: df, p: chiP(x2, df) };
  }

  // the likelihood of a cross's two-character counts for a given crossover rate, from the parents' true make-up
  function gametes2(pl, a, b, rf) {
    var out = {}, h = pl.h;
    function add(x, y, p) { var key = x + '' + y; out[key] = (out[key] || 0) + p; }
    add(h[0][a], h[0][b], (1 - rf) / 2); add(h[1][a], h[1][b], (1 - rf) / 2);
    add(h[0][a], h[1][b], rf / 2); add(h[1][a], h[0][b], rf / 2);
    return out;
  }
  function classProbs(D, mo, fa, rf) {
    var a = D.link[0], b = D.link[1], gm = gametes2(mo, a, b, rf), gf = gametes2(fa, a, b, rf), P = {};
    Object.keys(gm).forEach(function (km) {
      Object.keys(gf).forEach(function (kf) {
        var ga = +km[0] + +kf[0], gb = +km[1] + +kf[1];
        var key = phen1(D, ga, a) + '' + phen1(D, gb, b);
        P[key] = (P[key] || 0) + gm[km] * gf[kf];
      });
    });
    return P;
  }
  function mleRf(D, crosses) {
    var grid = [], best = null, ll0 = null, informative = [];
    crosses.forEach(function (c) {
      var p0 = classProbs(D, c.mo, c.fa, 0), p5 = classProbs(D, c.mo, c.fa, 0.5);
      var differs = Object.keys(p0).concat(Object.keys(p5)).some(function (k) { return Math.abs((p0[k] || 0) - (p5[k] || 0)) > 1e-9; });
      if (differs) informative.push(c);
    });
    if (!informative.length) return null;
    for (var i = 0; i <= 100; i++) {
      var rf = i * 0.005, ll = 0;
      informative.forEach(function (c) {
        var P = classProbs(D, c.mo, c.fa, rf), cnt = pairCounts(D, c, D.link[0], D.link[1]);
        Object.keys(cnt).forEach(function (k) { if (cnt[k]) ll += cnt[k] * Math.log(Math.max(P[k] || 0, 1e-12)); });
      });
      grid.push(ll);
      if (best === null || ll > grid[best]) best = i;
      if (i === 100) ll0 = ll;
    }
    var lod = (grid[best] - ll0) / Math.LN10;
    return { rf: best * 0.005, lod: lod, crosses: informative.length };
  }
  function pairCounts(D, c, a, b) {
    var out = {};
    c.kids.forEach(function (kid) { var key = phen1(D, geno(kid, a), a) + '' + phen1(D, geno(kid, b), b); out[key] = (out[key] || 0) + 1; });
    return out;
  }

  /* ---------- drawing a plant ---------- */
  var COL = {
    flower: ['#8a58d6', '#f3efe6', '#c7a8ee'],
    seed: ['#e7c94a', '#86b84a', '#b8c94a'],
    podc: ['#5ea24a', '#d9b846', null]
  };
  function look(D, p) {
    var o = { height: 0, flower: 0, shape: 0, seed: 0, pod: 0, podc: 0 };
    D.T.forEach(function (t, k) { o[t.key] = p[k]; });
    return o;
  }
  function plantSVG(D, p, size) {
    var L = look(D, p), s = size || 84;
    var top = [26, 70, 47][L.height], base = 120, sx = 46;
    var parts = [];
    parts.push('<rect x="12" y="118" width="68" height="16" rx="3" fill="#6b4a33"/><rect x="8" y="114" width="76" height="7" rx="2" fill="#81593d"/>');
    // stem, gently zig-zag, with a stake
    parts.push('<line x1="62" y1="116" x2="62" y2="' + (top - 4) + '" stroke="#a88a5d" stroke-width="1.4"/>');
    var pts = [], nodes = [], n = Math.max(3, Math.round((base - top) / 18));
    for (var i = 0; i <= n; i++) { var y = base - (base - top) * i / n, x = sx + (i % 2 ? 3 : -3) * (i ? 1 : 0); pts.push(x.toFixed(1) + ',' + y.toFixed(1)); nodes.push([x, y]); }
    parts.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#4f8a3a" stroke-width="2.2" stroke-linejoin="round"/>');
    // leaflets and stipules at the nodes
    for (i = 1; i < nodes.length; i++) {
      var nx = nodes[i][0], ny = nodes[i][1], sd = i % 2 ? 1 : -1;
      parts.push('<ellipse cx="' + (nx + sd * 9) + '" cy="' + (ny + 2) + '" rx="7" ry="4" transform="rotate(' + (sd * -24) + ' ' + (nx + sd * 9) + ' ' + (ny + 2) + ')" fill="#6fae52"/>');
      if (i < nodes.length - 1) parts.push('<path d="M' + nx + ' ' + ny + ' q' + (-sd * 8) + ' -4 ' + (-sd * 10) + ' -10 q' + (-sd * 1) + ' -4 ' + (sd * 2) + ' -4" fill="none" stroke="#6fae52" stroke-width="0.9"/>');
    }
    // the pod, hanging from a node part-way up
    var pn = nodes[Math.max(1, Math.floor(nodes.length / 2))], px = pn[0] - 3, py = pn[1] + 3;
    var pc = COL.podc[L.podc] || '#5ea24a', podPath;
    if (L.pod === 0) podPath = 'M0 0 C -4 6 -6 14 -4 26 C -2 32 3 32 4 26 C 6 14 4 6 0 0 Z';
    else if (L.pod === 1) podPath = 'M0 0 C -4 3 -4 6 -2 8 C -5 10 -5 13 -2 15 C -5 17 -5 20 -2 22 C -4 25 -2 30 1 29 C 3 27 2 24 2 22 C 4 20 4 17 2 15 C 4 13 4 10 2 8 C 4 6 3 2 0 0 Z';
    else podPath = 'M0 0 C -4 5 -5 9 -3 13 C -5 17 -5 23 -3 27 C -1 31 3 31 3 27 C 5 23 5 17 3 13 C 5 9 4 5 0 0 Z';
    parts.push('<g transform="translate(' + px + ' ' + py + ') rotate(18)"><path d="' + podPath + '" fill="' + pc + '" stroke="#2f5a25" stroke-width="0.7"/>' +
      (L.podc === 2 ? '<path d="M-1 4 L-1 26 M1.5 5 L1.5 25" stroke="#e2c84a" stroke-width="1.1" opacity=".9"/>' : '') + '</g>');
    // the flower at the top
    var fc = COL.flower[L.flower], fx = nodes[n][0], fy = nodes[n][1];
    parts.push('<g transform="translate(' + fx + ' ' + (fy - 2) + ')">' +
      '<path d="M0 0 C -12 -2 -14 -16 -2 -18 C 6 -18 10 -10 8 -2 Z" fill="' + fc + '" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>' +
      '<path d="M2 -2 C 10 -6 12 2 6 4 C 3 5 1 3 2 -2 Z" fill="' + fc + '" stroke="rgba(0,0,0,.25)" stroke-width=".6" opacity=".9"/>' +
      '<path d="M-2 0 C -4 4 0 6 3 3" fill="#4f8a3a"/></g>');
    // three seeds on the pot rim
    var sc = COL.seed[L.seed];
    for (i = 0; i < 3; i++) {
      var cx = 26 + i * 9, cy = 127;
      if (L.shape === 0) parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3.6" fill="' + sc + '" stroke="rgba(0,0,0,.35)" stroke-width=".5"/>');
      else if (L.shape === 1) parts.push('<path d="M' + (cx - 3.6) + ' ' + cy + ' l1.2 -2.6 l2.4 -.6 l1.6 1.2 l2 -.8 l.4 2.8 l-1 2.2 l-2.4 .9 l-1.8 -.9 l-2 .4 Z" fill="' + sc + '" stroke="rgba(0,0,0,.35)" stroke-width=".5"/><path d="M' + (cx - 1.5) + ' ' + (cy - .5) + ' l1.5 1 l1.5 -1.4" fill="none" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>');
      else parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="' + sc + '" stroke="rgba(0,0,0,.35)" stroke-width=".5"/><circle cx="' + (cx + .8) + '" cy="' + (cy - .8) + '" r="1.1" fill="rgba(0,0,0,.22)"/>');
    }
    return '<svg class="pea" viewBox="0 0 92 136" width="' + s + '" height="' + Math.round(s * 136 / 92) + '" aria-hidden="true">' + parts.join('') + '</svg>';
  }
  function describe(D, p) { return D.T.map(function (t, k) { return t.f[p[k]]; }).join(', '); }
  function describeLong(D, p) {
    // "tall, violet-flowered, with round yellow seeds in inflated green pods" style, built from what is active
    var L = {}; D.T.forEach(function (t, k) { L[t.key] = t.f[p[k]]; });
    var bits = [];
    if (L.height) bits.push(L.height);
    if (L.flower) bits.push(L.flower + '-flowered');
    var seed = [L.shape, L.seed].filter(Boolean).join(' '), pod = [L.pod, L.podc].filter(Boolean).join(' ');
    var s = bits.join(', ');
    if (seed) s += (s ? ', ' : '') + seed + ' seeds';
    if (pod) s += (s ? (seed ? ' in ' : ', ') : '') + pod + ' pods';
    return s;
  }

  /* ---------- state ---------- */
  var S = { day: 0, D: null, store: [], crosses: [], mo: null, fa: null, filed: false, nextId: 1 };

  function plantById(id) { for (var i = 0; i < S.store.length; i++) if (S.store[i].id === id) return S.store[i]; return null; }
  function plantName(pl) { return pl.name; }

  function renderStore() {
    var D = S.D;
    $('beds').textContent = (BEDS - S.crosses.length) + ' of ' + BEDS;
    $('store').innerHTML = S.store.map(function (pl) {
      var p = phen(D, pl), isMo = S.mo === pl.id, isFa = S.fa === pl.id;
      return '<div class="packet' + (isMo || isFa ? ' sel' : '') + '">' + plantSVG(D, p, 70) +
        '<div class="pk-body"><h4>' + esc(pl.name) + '</h4><p class="pk-look">' + esc(cap(describeLong(D, p))) + '</p><p class="pk-from">' + esc(pl.origin) + '</p>' +
        '<div class="pk-btns"><button type="button" class="chip' + (isMo ? ' on' : '') + '" data-mo="' + pl.id + '">♀ seed parent</button>' +
        '<button type="button" class="chip' + (isFa ? ' on' : '') + '" data-fa="' + pl.id + '">♂ pollen</button>' +
        (pl.fixed ? '' : '<button type="button" class="chip" data-drop="' + pl.id + '" title="Throw this plant out">×</button>') + '</div></div></div>';
    }).join('');
    $('store').querySelectorAll('[data-mo]').forEach(function (b) { b.addEventListener('click', function () { S.mo = S.mo === b.dataset.mo ? null : b.dataset.mo; renderStore(); }); });
    $('store').querySelectorAll('[data-fa]').forEach(function (b) { b.addEventListener('click', function () { S.fa = S.fa === b.dataset.fa ? null : b.dataset.fa; renderStore(); }); });
    $('store').querySelectorAll('[data-drop]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.store = S.store.filter(function (pl) { return pl.id !== b.dataset.drop; });
        if (S.mo === b.dataset.drop) S.mo = null; if (S.fa === b.dataset.drop) S.fa = null; renderStore(); renderCrosses();
      });
    });
    var mo = plantById(S.mo), fa = plantById(S.fa), msg;
    if (S.crosses.length >= BEDS) msg = 'All eight beds are sown. Write up the notebook.';
    else if (mo && fa) msg = mo === fa ? 'Let <b>' + esc(mo.name) + '</b> fertilise itself, as peas do when left alone.' : 'Pollen from <b>' + esc(fa.name) + '</b> onto the stigma of <b>' + esc(mo.name) + '</b>, after taking her anthers off.';
    else msg = 'Choose a seed parent and a pollen parent. Choose the same plant twice to let it fertilise itself.';
    $('crossMsg').innerHTML = msg;
    $('btnSow').disabled = !(mo && fa) || S.crosses.length >= BEDS || S.filed;
  }

  function sow() {
    var mo = plantById(S.mo), fa = plantById(S.fa);
    if (!mo || !fa || S.crosses.length >= BEDS) return;
    var D = S.D, no = S.crosses.length + 1;
    var r = rng((D.seed ^ Math.imul(no, 0x9e3779b1) ^ Math.imul(S.nextId, 0x85ebca6b)) >>> 0);
    var n = 90 + Math.floor(r() * 131);
    var kids = []; for (var i = 0; i < n; i++) kids.push(mate(D, mo, fa, r));
    var classes = {};
    kids.forEach(function (kid, j) { var p = phen(D, kid), key = p.join(''); (classes[key] = classes[key] || { p: p, idx: [] }).idx.push(j); });
    S.crosses.push({ no: no, mo: mo, fa: fa, moName: mo.name, faName: fa.name, self: mo === fa, kids: kids, classes: classes, r: r });
    S.nextId++;
    renderStore(); renderCrosses(); renderBench(true);
    var el = $('cross' + no); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function keep(cno, key) {
    var c = S.crosses[cno - 1], cl = c.classes[key];
    if (!cl || S.store.length >= KEEP_MAX) return;
    cl.kept = cl.kept || 0;
    var unused = cl.idx.filter(function (j) { return !(c.used && c.used[j]); });
    if (!unused.length) return;
    var j = unused[Math.floor(c.r() * unused.length)];
    c.used = c.used || {}; c.used[j] = true; cl.kept++;
    var kid = c.kids[j];
    var pl = { id: 'P' + (S.nextId++), name: 'Bed ' + c.no + ', plant ' + (j + 1), h: [kid.h[0].slice(), kid.h[1].slice()], origin: c.self ? 'from ' + c.moName + ' selfed' : 'from ' + c.moName + ' × ' + c.faName };
    S.store.push(pl);
    renderStore(); renderCrosses();
  }

  function traitSplit(D, c, k) {
    var cnt = [0, 0, 0];
    c.kids.forEach(function (kid) { cnt[phen1(D, geno(kid, k), k)]++; });
    return cnt;
  }

  function renderCrosses() {
    var D = S.D;
    if (!S.crosses.length) { $('crosses').innerHTML = '<p class="sub empty">No beds sown yet. The drawer holds two pure lines and the well plant. A good first question is what the children of the two lines look like.</p>'; return; }
    $('crosses').innerHTML = S.crosses.slice().reverse().map(function (c) {
      var keys = Object.keys(c.classes).sort(function (a, b) { return c.classes[b].idx.length - c.classes[a].idx.length; });
      var n = c.kids.length, max = c.classes[keys[0]].idx.length;
      var rows = keys.map(function (key) {
        var cl = c.classes[key], cnt = cl.idx.length, left = cnt - (cl.kept || 0);
        return '<tr><td class="pic">' + plantSVG(D, cl.p, 34) + '</td><td class="lk">' + esc(cap(describeLong(D, cl.p))) + '</td><td class="num">' + cnt + '</td>' +
          '<td class="barc"><span class="bar" style="width:' + Math.max(2, Math.round(cnt / max * 100)) + '%"></span></td>' +
          '<td>' + (S.filed ? '' : '<button type="button" class="chip" data-keep="' + c.no + ':' + key + '"' + (left < 1 || S.store.length >= KEEP_MAX ? ' disabled' : '') + '>Keep one</button>') + '</td></tr>';
      }).join('');
      var split = D.T.map(function (t, k) {
        var s = traitSplit(D, c, k), bits = [];
        [0, 2, 1].forEach(function (f) { if (s[f]) bits.push(s[f] + ' ' + t.f[f]); });
        return '<span><b>' + esc(t.name) + '</b> ' + esc(bits.join(' : ')) + '</span>';
      }).join('');
      return '<article class="bed" id="cross' + c.no + '"><header><span class="bed-no">Bed ' + c.no + '</span><h4>' + esc(c.self ? c.moName + ', selfed' : c.moName + ' ♀ × ' + c.faName + ' ♂') + '</h4><span class="bed-n">' + n + ' plants counted</span></header>' +
        '<div class="bookwrap"><table class="book classes"><thead><tr><th></th><th>Looks like</th><th>Count</th><th></th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="split">' + split + '</p></article>';
    }).join('');
    $('crosses').querySelectorAll('[data-keep]').forEach(function (b) {
      b.addEventListener('click', function () { var s = b.dataset.keep.split(':'); keep(+s[0], s[1]); });
    });
    if (S.store.length >= KEEP_MAX) $('crosses').insertAdjacentHTML('afterbegin', '<p class="sub empty">The drawer is full (' + KEEP_MAX + ' packets). Throw a plant out to keep another.</p>');
  }

  /* ---------- the ratio bench ---------- */
  function renderBench(newest) {
    var D = S.D, wrap = $('bench');
    if (!S.crosses.length) { wrap.innerHTML = '<p class="sub empty">Sow a bed first; the bench works on your own counts.</p>'; return; }
    var cSel = $('bCross') && $('bCross').value, tSel = $('bTrait') && $('bTrait').value, uSel = $('bTrait2') && $('bTrait2').value;
    var cOpts = S.crosses.map(function (c) { return '<option value="' + c.no + '">Bed ' + c.no + ' (' + esc(c.self ? c.moName + ' selfed' : c.moName + ' × ' + c.faName) + ')</option>'; }).join('');
    var tOpts = D.T.map(function (t, k) { return '<option value="' + k + '">' + esc(t.name) + '</option>'; }).join('');
    wrap.innerHTML = '<div class="benchbar"><label>Bed <select id="bCross">' + cOpts + '</select></label>' +
      '<label>Character <select id="bTrait">' + tOpts + '</select></label>' +
      '<label>against <select id="bTrait2"><option value="">nothing (one character)</option>' + tOpts + '</select></label></div><div id="benchOut"></div>';
    $('bCross').value = !newest && cSel && +cSel <= S.crosses.length ? cSel : String(S.crosses.length);
    if (tSel) $('bTrait').value = tSel;
    if (uSel !== undefined && uSel !== null) $('bTrait2').value = uSel;
    ['bCross', 'bTrait', 'bTrait2'].forEach(function (id) { $(id).addEventListener('change', benchOut); });
    benchOut();
  }
  function benchOut() {
    var D = S.D, c = S.crosses[+$('bCross').value - 1], k = +$('bTrait').value, u = $('bTrait2').value;
    var out = $('benchOut');
    if (u === '' || +u === k) {
      var t = D.T[k], s = traitSplit(D, c, k), n = c.kids.length;
      var obs = [s[0], s[1], s[2]];
      var tests = [
        ['3 : 1', '3 ' + t.f[0] + ' to 1 ' + t.f[1], [3, 1, 0]],
        ['1 : 3', '1 ' + t.f[0] + ' to 3 ' + t.f[1], [1, 3, 0]],
        ['1 : 1', 'half and half', [1, 1, 0]],
        ['1 : 2 : 1', '1 ' + t.f[0] + ', 2 ' + t.f[2] + ', 1 ' + t.f[1], [1, 1, 2]],
        ['1 : 1', 'half ' + t.f[0] + ', half ' + t.f[2], [1, 0, 1]],
        ['1 : 1', 'half ' + t.f[1] + ', half ' + t.f[2], [0, 1, 1]],
        ['all', 'all ' + t.f[0], [1, 0, 0]],
        ['all', 'all ' + t.f[1], [0, 1, 0]],
        ['all', 'all ' + t.f[2], [0, 0, 1]]
      ];
      // only offer tests that use the classes actually seen, plus any obvious ones
      var rows = tests.map(function (tt) { var g = goodness(obs, tt[2]); return { name: tt[0], words: tt[1], g: g }; })
        .filter(function (x) { return x.g.x2 !== Infinity; });
      rows.sort(function (a, b) { return b.g.p - a.g.p; });
      var cells = [0, 2, 1].filter(function (f) { return obs[f] > 0; }).map(function (f) { return obs[f] + ' ' + t.f[f]; });
      out.innerHTML = '<p class="obs"><b>' + esc(t.name) + ', bed ' + c.no + ':</b> ' + esc(cells.join(', ')) + ' (' + n + ' plants).</p>' +
        '<div class="bookwrap"><table class="book"><thead><tr><th>Ratio</th><th>Meaning</th><th>Expected</th><th>χ²</th><th>df</th><th>P</th><th>Reading</th></tr></thead><tbody>' +
        rows.map(function (x) {
          var tt = tests.filter(function (q) { return q[1] === x.words; })[0][2], tot = tt[0] + tt[1] + tt[2];
          var exp = [0, 2, 1].filter(function (f) { return tt[f]; }).map(function (f) { return (n * tt[f] / tot).toFixed(1); }).join(' : ');
          var rd = x.g.df < 1 ? 'nothing to test' : x.g.p > 0.05 ? '<span class="tick y">fits</span>' : x.g.p > 0.001 ? '<span class="tick m">doubtful</span>' : '<span class="tick n">rejected</span>';
          return '<tr><td>' + x.name + '</td><td>' + esc(x.words) + '</td><td>' + exp + '</td><td>' + (x.g.df < 1 ? '—' : x.g.x2.toFixed(2)) + '</td><td>' + (x.g.df < 1 ? '—' : x.g.df) + '</td><td>' + (x.g.df < 1 ? '—' : fmtP(x.g.p)) + '</td><td>' + rd + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="sub small">A P above 0.05 means counts this far from the ratio would turn up more than one time in twenty by chance alone, so the ratio stands. It never proves the ratio; a small bed fits several.</p>';
      return;
    }
    u = +u;
    var A = D.T[k], B = D.T[u], tab = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    c.kids.forEach(function (kid) { tab[phen1(D, geno(kid, k), k)][phen1(D, geno(kid, u), u)]++; });
    var order = [0, 2, 1], rr = order.filter(function (i) { return tab[i].some(function (v) { return v; }); }), cc = order.filter(function (j) { return tab.some(function (row) { return row[j]; }); });
    var ind = independence(tab);
    var html = '<div class="bookwrap"><table class="book cont"><thead><tr><th>' + esc(A.name) + ' \\ ' + esc(B.name) + '</th>' + cc.map(function (j) { return '<th>' + esc(B.f[j]) + '</th>'; }).join('') + '<th>total</th></tr></thead><tbody>' +
      rr.map(function (i) { var tot = 0; return '<tr><td>' + esc(A.f[i]) + '</td>' + cc.map(function (j) { tot += tab[i][j]; return '<td>' + tab[i][j] + '</td>'; }).join('') + '<td>' + tot + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    if (!ind) html += '<p class="sub small">Only one form of one of these characters turned up in this bed, so it cannot say whether they travel together.</p>';
    else html += '<p class="obs">If the two characters assort independently, each column should split the same way as the totals. χ² = ' + ind.x2.toFixed(2) + ' on ' + ind.df + ' df, P ' + (ind.p < 0.001 ? '' : '= ') + fmtP(ind.p) + ': ' +
      (ind.p > 0.05 ? '<span class="tick y">no sign of linkage</span>' : ind.p > 0.001 ? '<span class="tick m">suspicious</span>' : '<span class="tick n">they travel together</span>') + '</p>' +
      '<p class="sub small">To put a number on it, count the plants that show a combination neither grandparent had: those are the crossovers. In a backcross to the plant that is pure for the hidden forms of both, they are simply the two smaller classes over the whole bed.</p>';
    out.innerHTML = html;
  }

  /* ---------- the notebook ---------- */
  function pairName(D, pr) { return D.T[pr[0]].name.toLowerCase() + ' and ' + D.T[pr[1]].name.toLowerCase(); }
  function renderNotebook() {
    var D = S.D, rows = '';
    D.T.forEach(function (t, k) {
      rows += '<tr><td>' + esc(t.name) + '</td><td><select id="nbDom' + k + '"><option value="">—</option>' +
        '<option value="0">' + esc(cap(t.f[0])) + ' wins over ' + esc(t.f[1]) + '</option>' +
        '<option value="1">' + esc(cap(t.f[1])) + ' wins over ' + esc(t.f[0]) + '</option>' +
        '<option value="2">Neither: one of each looks ' + esc(t.f[2]) + '</option></select></td>' +
        '<td><select id="nbWell' + k + '"><option value="">—</option>' +
        '<option value="0">pure ' + esc(t.f[0]) + '</option><option value="1">one of each</option><option value="2">pure ' + esc(t.f[1]) + '</option></select></td><td id="nbRes' + k + '"></td></tr>';
    });
    $('nbTable').innerHTML = '<table class="book"><thead><tr><th>Character</th><th>Which form wins</th><th>The well plant carries</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    var opts = '<option value="">—</option>';
    for (var a = 0; a < 4; a++) for (var b = a + 1; b < 4; b++) opts += '<option value="' + a + b + '">' + esc(cap(pairName(D, [a, b]))) + '</option>';
    $('nbLink').innerHTML = opts;
    $('nbRf').value = '';
    $('nbLinkRes').innerHTML = '';
  }

  function fileNotebook() {
    var D = S.D, rep = $('report'), missing = [], ans = { dom: [], well: [] };
    D.T.forEach(function (t, k) {
      var d = $('nbDom' + k).value, w = $('nbWell' + k).value;
      if (d === '') missing.push('which ' + t.name.toLowerCase() + ' wins'); else ans.dom.push(+d);
      if (w === '') missing.push('the well plant\'s ' + t.name.toLowerCase()); else ans.well.push(+w);
    });
    var lk = $('nbLink').value, rfTxt = $('nbRf').value.trim(), rfv = parseFloat(rfTxt);
    if (lk === '') missing.push('which two characters are linked');
    if (rfTxt === '' || !isFinite(rfv) || rfv < 0 || rfv > 50) missing.push('how often they come apart (a percentage from 0 to 50)');
    if (missing.length) { rep.className = 'verdict warn'; rep.innerHTML = 'The notebook is not finished. Still to write: <b>' + esc(listJoin(missing)) + '</b>.'; return; }
    S.filed = true;
    var score = 0, per = [];
    D.T.forEach(function (t, k) {
      var okD = ans.dom[k] === D.mode[k];
      var wg = geno(D.start[2], k), okW = ans.well[k] === wg;
      score += okD + okW;
      $('nbRes' + k).innerHTML = '<span class="tick ' + (okD && okW ? 'y' : okD || okW ? 'm' : 'n') + '">' + (okD && okW ? 'right' : okD || okW ? 'half' : 'wrong') + '</span>';
      var truthD = D.mode[k] === 2 ? 'neither form wins: one of each comes out ' + t.f[2] : t.f[D.mode[k]] + ' wins over ' + t.f[1 - D.mode[k]];
      var truthW = wg === 1 ? 'one of each' : 'pure ' + t.f[wg === 0 ? 0 : 1];
      var why = '';
      if (!okW) {
        if (D.mode[k] === 2) why = ' Here the look gives the make-up away, because a mixed plant comes out ' + t.f[2] + '.';
        else {
          var hid = 1 - D.mode[k];
          if (wg === 2 * hid) why = ' Its look gives it away: only a plant pure for ' + t.f[hid] + ' can show ' + t.f[hid] + '.';
          else why = ' Crossing it to a plant pure for ' + t.f[hid] + ' settles it: a pure ' + t.f[D.mode[k]] + ' plant gives no ' + t.f[hid] + ' children at all, a mixed one gives about half.';
        }
      }
      per.push('<li><b>' + esc(t.name) + '.</b> ' + (okD ? 'Right' : 'Not quite') + ': ' + esc(truthD) + '. The well plant is ' + esc(truthW) + (okW ? ', as you said.' : ', not ' + (ans.well[k] === 1 ? 'one of each' : 'pure ' + t.f[ans.well[k] === 0 ? 0 : 1]) + '.') + esc(why) + '</li>');
    });
    var trueLk = '' + D.link[0] + D.link[1], okL = lk === trueLk;
    var okR = okL && Math.abs(rfv - D.rf * 100) <= Math.max(4, D.rf * 100 * 0.3);
    score += okL + okR;
    var mle = mleRf(D, S.crosses);
    var linkTxt = (okL ? 'Right: ' : 'The linked pair is ') + esc(pairName(D, D.link)) + ', on one chromosome, coming apart in ' + Math.round(D.rf * 100) + '% of gametes. ' +
      (okL ? (okR ? 'Your ' + rfv + '% is close enough.' : 'Your ' + rfv + '% is too far off.') : 'You named ' + esc(pairName(D, [+lk[0], +lk[1]])) + ', which assort independently.') + ' ';
    if (mle) linkTxt += 'Read perfectly, your ' + (mle.crosses === 1 ? 'one bed that could see it puts' : NUMW[mle.crosses] + ' beds that could see it put') + ' the figure at <b>' + (mle.rf * 100).toFixed(1) + '%</b> (LOD ' + mle.lod.toFixed(1) + (mle.lod >= 3 ? ', a convincing case' : ', not yet convincing; geneticists want 3') + ').';
    else linkTxt += 'None of your beds could have shown it: the linkage only appears when a parent is mixed at both characters.';
    $('nbLinkRes').innerHTML = '<span class="tick ' + (okL && okR ? 'y' : okL ? 'm' : 'n') + '">' + (okL && okR ? 'right' : okL ? 'half' : 'wrong') + '</span>';
    rep.className = 'verdict ' + (score === 10 ? 'good' : score >= 7 ? '' : 'warn');
    var head = score === 10 ? '<b>Ten out of ten.</b> ' + esc(cap(D.keeper)) + ' can send the paper to the society.' : '<b>' + score + ' out of 10.</b> ' + (score >= 7 ? 'A sound notebook with a gap or two.' : 'The drawer kept a few of its secrets.');
    rep.innerHTML = head + ' ' + S.crosses.length + ' of ' + BEDS + ' beds used.<ul class="per">' + per.join('') + '<li><b>Linkage.</b> ' + linkTxt + '</li></ul>';
    // reveal what every packet carries
    var reveal = '<h3>What is in the drawer</h3><div class="bookwrap"><table class="book"><thead><tr><th>Plant</th>' + D.T.map(function (t) { return '<th>' + esc(t.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      S.store.map(function (pl) {
        return '<tr><td>' + esc(pl.name) + '</td>' + D.T.map(function (t, k) {
          var a = pl.h[0][k], b = pl.h[1][k];
          return '<td>' + (a === b ? 'pure ' + esc(t.f[a]) : esc(t.f[a]) + ' / ' + esc(t.f[b])) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="sub small">For the linked pair, read the slashes in order: the first form of each sits on the chromosome from the seed parent, the second on the one from the pollen. In a mixed plant, that pairing is what a crossover breaks.</p>';
    $('reveal').innerHTML = reveal;
    renderStore(); renderCrosses();
    $('btnFile').disabled = true;
  }

  function load() {
    var d = dateFor(S.day);
    S.D = build(seedForDate(d));
    S.store = S.D.start.map(function (pl) { return { id: pl.id, name: pl.name, h: [pl.h[0].slice(), pl.h[1].slice()], origin: pl.origin, fixed: true }; });
    S.crosses = []; S.mo = null; S.fa = null; S.filed = false; S.nextId = 1;
    var D = S.D;
    $('plWho').textContent = 'Priory of ' + D.priory + ' · garden book, ' + D.year;
    $('plName').textContent = 'Today\'s drawer: ' + listJoin(D.T.map(function (t) { return t.name.toLowerCase(); }));
    $('plBlurb').innerHTML = 'Two pure lines, <b>' + esc(D.start[0].name) + '</b> and <b>' + esc(D.start[1].name) + '</b>, opposite in every character that matters today, and one plant that came up by the well. ' +
      esc(cap(D.keeper)) + ' has eight beds this summer and wants to know three things: which form of each character wins, which two characters are carried together, and what the well plant really is.';
    $('dayOut').textContent = (S.day === 0 ? 'Today, ' : S.day === -1 ? 'Yesterday, ' : S.day === 1 ? 'Tomorrow, ' : '') + longDate(d);
    $('report').className = 'verdict'; $('report').innerHTML = ''; $('reveal').innerHTML = '';
    $('btnFile').disabled = false;
    renderStore(); renderCrosses(); renderBench(); renderNotebook();
  }
  function goDay(n) { S.day = n; load(); }

  $('btnSow').addEventListener('click', sow);
  $('btnFile').addEventListener('click', fileNotebook);
  $('btnReset').addEventListener('click', function () { if (!S.crosses.length || window.confirm('Clear all the beds and start the drawer again?')) load(); });
  $('btnDayPrev').addEventListener('click', function () { goDay(S.day - 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.day + 1); });
  document.addEventListener('keydown', function (ev) {
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || tg === 'BUTTON') return;
    if (ev.key === 'ArrowLeft') goDay(S.day - 1);
    else if (ev.key === 'ArrowRight') goDay(S.day + 1);
  });

  // exposed for testing only
  window.__cloister = { build: build, S: S, phen: phen, mate: mate, mleRf: mleRf, goodness: goodness, independence: independence, chiP: chiP, sow: sow, keep: keep, fileNotebook: fileNotebook, seedForDate: seedForDate };

  load();
})();
