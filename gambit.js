/* The Gambit — a board game invented by today's date, and an opponent that plays it.
   experiment.quibo.games. Self-contained, no dependencies. */
(function (root) {
  'use strict';

  /* ================= seeded random ================= */
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
  function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
  function shuffle(rand, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ================= invented words ================= */
  var ONS = ['t', 'k', 's', 'm', 'n', 'r', 'v', 'd', 'th', 'sh', 'br', 'dr', 'gr', 'kh', 'l', 'p', 'z', 'st', 'tr', 'ph', 'ch', 'g', 'b', 'f', 'h', 'j', 'w', 'y'];
  var VOW = ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ou', 'ia', 'au', 'ie', 'oa'];
  var COD = ['n', 'r', 'l', 's', 'k', 'th', 'm', 'sh', 'nd', 'rk', '', '', '', ''];
  function coin(rand, syls) {
    var w = '';
    for (var i = 0; i < syls; i++) {
      w += pick(rand, ONS) + pick(rand, VOW);
      if (i === syls - 1 || rand() < 0.35) w += pick(rand, COD);
    }
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  /* ================= direction sets ================= */
  var SETS = {
    ortho: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    diag: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    all8: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
    knight: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
    camel: [[-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1]],
    dab: [[-2, 0], [2, 0], [0, -2], [0, 2]],
    alfil: [[-2, -2], [-2, 2], [2, -2], [2, 2]],
    fwd: [[-1, 0]],
    fwdDiag: [[-1, -1], [-1, 1]],
    side: [[0, -1], [0, 1]],
    back: [[1, 0]]
  };

  /* ================= movement vocabulary ================= */
  /* m: 'b' both, 'm' quiet only, 'c' capture only.  r: steps (99 = a rider). */
  var VOCAB = {
    wazir: { atoms: [{ s: 'ortho', r: 1, m: 'b' }], tag: 'one square orthogonally' },
    ferz: { atoms: [{ s: 'diag', r: 1, m: 'b' }], tag: 'one square diagonally' },
    step: { atoms: [{ s: 'all8', r: 1, m: 'b' }], tag: 'one square in any direction' },
    knight: { atoms: [{ s: 'knight', r: 1, m: 'b' }], tag: 'two and one, leaping whatever stands in the way' },
    camel: { atoms: [{ s: 'camel', r: 1, m: 'b' }], tag: 'three and one, leaping whatever stands in the way' },
    dab: { atoms: [{ s: 'dab', r: 1, m: 'b' }], tag: 'exactly two squares orthogonally, leaping the square between' },
    alfil: { atoms: [{ s: 'alfil', r: 1, m: 'b' }], tag: 'exactly two squares diagonally, leaping the square between' },
    rook: { atoms: [{ s: 'ortho', r: 99, m: 'b' }], tag: 'any distance orthogonally' },
    bishop: { atoms: [{ s: 'diag', r: 99, m: 'b' }], tag: 'any distance diagonally' },
    srook: { atoms: [{ s: 'ortho', r: 2, m: 'b' }], tag: 'up to two squares orthogonally' },
    sbish: { atoms: [{ s: 'diag', r: 2, m: 'b' }], tag: 'up to two squares diagonally' },
    pawn: { atoms: [{ s: 'fwd', r: 1, m: 'm' }, { s: 'fwdDiag', r: 1, m: 'c' }], dir: 1, tag: 'one square forward, and takes only forward-diagonally' },
    spear: { atoms: [{ s: 'fwd', r: 99, m: 'b' }], dir: 1, tag: 'any distance straight forward, and never back' },
    crab: { atoms: [{ s: 'fwdDiag', r: 1, m: 'b' }, { s: 'side', r: 1, m: 'b' }], dir: 1, tag: 'one square forward-diagonally or sideways' },
    ox: { atoms: [{ s: 'fwd', r: 2, m: 'b' }, { s: 'side', r: 1, m: 'b' }], dir: 1, tag: 'up to two squares forward, or one sideways' },
    drover: { atoms: [{ s: 'fwd', r: 1, m: 'b' }, { s: 'back', r: 1, m: 'b' }, { s: 'fwdDiag', r: 1, m: 'c' }], dir: 1, tag: 'one square forward or back, and takes forward-diagonally as well' }
  };

  var POOL_FOOT = ['pawn', 'pawn', 'wazir', 'ferz', 'crab', 'ox', 'drover'];
  var POOL_MID = ['knight', 'knight', 'srook', 'sbish', 'dab', 'alfil', 'camel', 'spear',
    ['wazir', 'ferz'], ['knight', 'wazir'], ['sbish', 'wazir'], ['dab', 'ferz'], ['alfil', 'wazir']];
  var POOL_MAJOR = ['rook', 'bishop', ['rook', 'ferz'], ['bishop', 'wazir'], ['srook', 'sbish'],
    ['rook', 'knight'], ['bishop', 'knight'], ['rook', 'alfil']];

  function compose(keys) {
    if (typeof keys === 'string') keys = [keys];
    var atoms = [], tags = [], dir = 0;
    for (var i = 0; i < keys.length; i++) {
      var v = VOCAB[keys[i]];
      atoms = atoms.concat(v.atoms);
      tags.push(v.tag);
      if (v.dir) dir = 1;
    }
    return { atoms: atoms, tag: tags.join(', and '), dir: dir, keys: keys.slice() };
  }

  var SHAPES = ['disc', 'triangle', 'square', 'diamond', 'pentagon', 'chevron', 'hex', 'star'];

  /* mobility on an empty board, used as the piece's worth */
  function mobility(atoms, N) {
    var total = 0, cells = 0;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      cells++;
      var seen = {};
      for (var a = 0; a < atoms.length; a++) {
        var at = atoms[a], dirs = SETS[at.s];
        for (var d = 0; d < dirs.length; d++) {
          var rr = r, cc = c;
          for (var st = 1; st <= at.r; st++) {
            rr += dirs[d][0]; cc += dirs[d][1];
            if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
            seen[rr * N + cc] = 1;
          }
        }
      }
      total += Object.keys(seen).length;
    }
    return total / cells;
  }

  /* ================= the invention ================= */
  var BLOCK = 100;

  function buildGame(seed) {
    var rand = rng(seed);
    var G = { seed: seed >>> 0 };

    var N = G.N = 6 + Math.floor(rand() * 3);           // 6, 7 or 8
    var cells = N * N;

    /* --- win condition --- */
    var wroll = rand();
    G.win = wroll < 0.42 ? 'regicide' : (wroll < 0.74 ? 'breakthrough' : 'annihilation');

    /* --- blocked squares, always 180-degree symmetric --- */
    G.blocked = [];
    var holeRoll = rand();
    var nHoles = holeRoll < 0.55 ? 0 : (holeRoll < 0.85 ? 1 : 2);
    var loR = 2, hiR = N - 3;
    if (hiR >= loR) {
      var tries = 0;
      while (G.blocked.length < nHoles * 2 && tries++ < 60) {
        var hr = loR + Math.floor(rand() * (hiR - loR + 1));
        var hc = Math.floor(rand() * N);
        var i1 = hr * N + hc, i2 = (N - 1 - hr) * N + (N - 1 - hc);
        if (i1 === i2) continue;
        if (G.blocked.indexOf(i1) >= 0 || G.blocked.indexOf(i2) >= 0) continue;
        G.blocked.push(i1, i2);
      }
    }

    /* --- the pieces --- */
    var types = [];
    function addType(spec, tier) {
      var p = compose(spec);
      p.value = Math.max(28, Math.round(mobility(p.atoms, N) * 13));
      p.tier = tier;
      p.royal = false;
      p.shape = SHAPES[types.length % SHAPES.length];
      types.push(p);
      return types.length - 1;
    }

    var footIdx = addType(pick(rand, POOL_FOOT), 'foot');
    var midIdx = addType(pick(rand, POOL_MID), 'mid');
    var majorIdx = -1;
    if (N >= 7 || rand() < 0.55) majorIdx = addType(pick(rand, POOL_MAJOR), 'major');

    G.royalIdx = -1;
    if (G.win === 'regicide') {
      G.royalIdx = addType('step', 'royal');
      types[G.royalIdx].royal = true;
      types[G.royalIdx].value = 240;
      types[G.royalIdx].shape = 'star';
    }
    G.types = types;

    /* --- promotion --- */
    var anyDir = false, promoteTo = -1, bestVal = -1;
    for (var t = 0; t < types.length; t++) {
      if (types[t].dir) anyDir = true;
      if (!types[t].dir && !types[t].royal && types[t].value > bestVal) { bestVal = types[t].value; promoteTo = t; }
    }
    G.promoteTo = promoteTo;
    G.promote = (G.win !== 'breakthrough') && anyDir && promoteTo >= 0;

    /* --- the sandwich rule --- */
    G.custodian = rand() < 0.3;

    /* --- opening array, mirrored by half-turn so both sides get the same --- */
    var back = new Array(N).fill(-1);
    var half = Math.floor(N / 2);
    var heavy = majorIdx >= 0 ? majorIdx : midIdx;
    var backStyle = Math.floor(rand() * 3);
    for (var c = 0; c < half; c++) {
      var kind;
      if (backStyle === 0) kind = (c === 0) ? heavy : (c % 2 === 1 ? midIdx : footIdx);
      else if (backStyle === 1) kind = (c === 0) ? midIdx : (c === 1 ? heavy : (c % 2 === 0 ? midIdx : footIdx));
      else kind = (c < 2) ? midIdx : heavy;
      back[c] = kind; back[N - 1 - c] = kind;
    }
    if (N % 2 === 1) back[half] = majorIdx >= 0 ? heavy : midIdx;
    if (G.royalIdx >= 0) back[N % 2 === 1 ? half : half - 1] = G.royalIdx;

    var front = new Array(N).fill(-1);
    var frontStyle = Math.floor(rand() * 3);
    for (var c2 = 0; c2 < N; c2++) {
      var on = frontStyle === 0 ? true
        : frontStyle === 1 ? (c2 > 0 && c2 < N - 1)
          : (c2 % 2 === 0 || c2 === N - 1);
      if (on) front[c2] = footIdx;
    }

    var b = new Int8Array(cells);
    for (var k = 0; k < G.blocked.length; k++) b[G.blocked[k]] = BLOCK;
    for (var c3 = 0; c3 < N; c3++) {
      if (back[c3] >= 0) {
        var ib = (N - 1) * N + c3;
        if (b[ib] !== BLOCK) b[ib] = back[c3] + 1;
      }
      if (front[c3] >= 0) {
        var ifr = (N - 2) * N + c3;
        if (b[ifr] !== BLOCK) b[ifr] = front[c3] + 1;
      }
    }
    /* half-turn rotation gives the other army */
    for (var i = 0; i < cells; i++) {
      var v = b[i];
      if (v > 0 && v !== BLOCK) b[cells - 1 - i] = -v;
    }
    G.start = b;

    /* --- names and provenance --- */
    G.name = coin(rand, 2 + Math.floor(rand() * 2));
    var tierName = { foot: ['runner', 'foot', 'hand', 'reed', 'stone', 'boy'], mid: ['rider', 'horse', 'wheel', 'hawk', 'drum', 'smith'], major: ['tower', 'ship', 'bell', 'flame', 'gate', 'wind'], royal: ['crown', 'mother', 'sun', 'heart', 'seat'] };
    for (var t2 = 0; t2 < types.length; t2++) {
      types[t2].name = coin(rand, types[t2].tier === 'foot' ? 1 : (1 + Math.floor(rand() * 2)));
      types[t2].plain = pick(rand, tierName[types[t2].tier]);
    }
    G.place = coin(rand, 2);
    G.material = pick(rand, ['bone', 'river slate', 'fired clay', 'olive wood', 'sea glass', 'horn', 'pressed tin', 'blackened oak', 'bottle glass', 'walrus ivory']);
    G.surface = pick(rand, ['scratched into a table top', 'cut into a ferry deck', 'inked onto sailcloth', 'painted on a customs-house floor', 'burnt into a cart tailgate', 'chalked on a quay stone', 'stitched into a saddle blanket']);
    G.who = pick(rand, ['lock-keepers', 'salt carriers', 'night watchmen', 'ferrymen', 'copyists', 'goat-herds', 'tally clerks', 'lamp-lighters', 'wool factors', 'quarantine officers']);
    G.since = pick(rand, [
      'It was banned for a season over a wager and came back with the same rules.',
      'Two towns still argue about whether the sandwich rule was ever part of it.',
      'The last players of it were photographed once, and nobody wrote the names down.',
      'It survives because a customs officer copied the board into a ledger margin.',
      'A single set exists, short two pieces, which are replaced with buttons.',
      'It was taught to children as arithmetic and to adults as a way of settling debts.'
    ]);

    /* --- housekeeping --- */
    G.drawPlies = 150;
    return G;
  }

  /* ================= move generation ================= */
  /* move = from | to<<6 */
  function genMoves(G, b, side, out, capsOnly) {
    var N = G.N, goalRow = side === 0 ? 0 : N - 1;
    var wantGoal = capsOnly && G.win === 'breakthrough';
    for (var i = 0; i < b.length; i++) {
      var v = b[i];
      if (v === 0 || v === BLOCK) continue;
      var s = v > 0 ? 0 : 1;
      if (s !== side) continue;
      var pd = G.types[(v > 0 ? v : -v) - 1];
      var r0 = (i / N) | 0, c0 = i % N;
      for (var a = 0; a < pd.atoms.length; a++) {
        var at = pd.atoms[a], dirs = SETS[at.s];
        for (var d = 0; d < dirs.length; d++) {
          var dr = side === 0 ? dirs[d][0] : -dirs[d][0];
          var dc = dirs[d][1];
          var rr = r0, cc = c0;
          for (var st = 1; st <= at.r; st++) {
            rr += dr; cc += dc;
            if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
            var j = rr * N + cc, tv = b[j];
            if (tv === BLOCK) break;
            if (tv === 0) {
              if (at.m !== 'c' && (!capsOnly || (wantGoal && rr === goalRow))) out.push(i | (j << 6));
            } else {
              if ((tv > 0 ? 0 : 1) !== side && at.m !== 'm') out.push(i | (j << 6));
              break;
            }
          }
        }
      }
    }
    return out;
  }

  function make(G, b, mv) {
    var N = G.N, from = mv & 63, to = (mv >> 6) & 63;
    var v = b[from];
    var rec = { from: from, to: to, moved: v, cap: b[to], cust: null, quiet: b[to] === 0 };
    var side = v > 0 ? 0 : 1;
    var pd = G.types[(v > 0 ? v : -v) - 1];
    b[from] = 0;
    var nv = v;
    if (G.promote && pd.dir) {
      var rr = (to / N) | 0;
      if ((side === 0 && rr === 0) || (side === 1 && rr === N - 1)) {
        nv = side === 0 ? (G.promoteTo + 1) : -(G.promoteTo + 1);
      }
    }
    b[to] = nv;
    if (G.custodian) {
      var r = (to / N) | 0, c = to % N, od = SETS.ortho;
      for (var d = 0; d < 4; d++) {
        var r1 = r + od[d][0], c1 = c + od[d][1];
        var r2 = r + od[d][0] * 2, c2 = c + od[d][1] * 2;
        if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
        if (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N) continue;
        var j1 = r1 * N + c1, j2 = r2 * N + c2, v1 = b[j1], v2 = b[j2];
        if (v1 === 0 || v1 === BLOCK || v2 === 0 || v2 === BLOCK) continue;
        if ((v1 > 0 ? 0 : 1) === side) continue;
        if ((v2 > 0 ? 0 : 1) !== side) continue;
        if (G.types[(v1 > 0 ? v1 : -v1) - 1].royal) continue;
        if (!rec.cust) rec.cust = [];
        rec.cust.push(j1, v1);
        b[j1] = 0;
      }
      if (rec.cust) rec.quiet = false;
    }
    return rec;
  }

  function unmake(G, b, rec) {
    if (rec.cust) for (var k = rec.cust.length - 2; k >= 0; k -= 2) b[rec.cust[k]] = rec.cust[k + 1];
    b[rec.to] = rec.cap;
    b[rec.from] = rec.moved;
  }

  /* returns 0 or 1 if that side has won, -1 otherwise */
  function winner(G, b) {
    var N = G.N;
    if (G.win === 'breakthrough') {
      for (var c = 0; c < N; c++) {
        var top = b[c];
        if (top > 0 && top !== BLOCK) return 0;
        var bot = b[(N - 1) * N + c];
        if (bot < 0) return 1;
      }
      return -1;
    }
    var r0 = false, r1 = false, n0 = 0, n1 = 0;
    for (var i = 0; i < b.length; i++) {
      var v = b[i];
      if (v === 0 || v === BLOCK) continue;
      if (v > 0) { n0++; if (G.types[v - 1].royal) r0 = true; }
      else { n1++; if (G.types[-v - 1].royal) r1 = true; }
    }
    if (G.win === 'regicide') {
      if (!r1) return 0;
      if (!r0) return 1;
      return -1;
    }
    if (n1 === 0) return 0;
    if (n0 === 0) return 1;
    return -1;
  }

  /* ================= evaluation ================= */
  var HUNT_A = new Int8Array(64), HUNT_B = new Int8Array(64);

  function evaluate(G, b, side) {
    var N = G.N, mid = (N - 1) / 2;
    var m0 = 0, m1 = 0, pos = 0, k0 = -1, k1 = -1, n0 = 0, n1 = 0;
    for (var i = 0; i < b.length; i++) {
      var v = b[i];
      if (v === 0 || v === BLOCK) continue;
      var s = v > 0 ? 0 : 1;
      var pd = G.types[(v > 0 ? v : -v) - 1];
      if (s === 0) { m0 += pd.value; HUNT_A[n0++] = i; } else { m1 += pd.value; HUNT_B[n1++] = i; }
      if (pd.royal) { if (s === 0) k0 = i; else k1 = i; }
      var sign = s === 0 ? 1 : -1;
      var r = (i / N) | 0, c = i % N;
      if (G.win === 'breakthrough') {
        var adv = s === 0 ? (N - 1 - r) : r;
        pos += sign * adv * adv * 3;
      } else {
        pos += sign * Math.round((2 * mid - Math.abs(c - mid) - Math.abs(r - mid)) * 3);
      }
    }
    var sc = m0 - m1 + pos;

    if (G.win === 'regicide') {
      /* drive the enemy crown off the middle, and bring the army to it */
      if (k1 >= 0) sc += Math.round((Math.abs((k1 % N) - mid) + Math.abs(((k1 / N) | 0) - mid)) * 5);
      if (k0 >= 0) sc -= Math.round((Math.abs((k0 % N) - mid) + Math.abs(((k0 / N) | 0) - mid)) * 5);
      for (var j = 0; j < b.length; j++) {
        var w = b[j];
        if (w === 0 || w === BLOCK) continue;
        var ws = w > 0 ? 0 : 1;
        if (G.types[(w > 0 ? w : -w) - 1].royal) continue;
        var tk = ws === 0 ? k1 : k0;
        if (tk < 0) continue;
        var dr = Math.abs(((j / N) | 0) - ((tk / N) | 0)), dc = Math.abs((j % N) - (tk % N));
        sc += (ws === 0 ? 1 : -1) * (N - (dr > dc ? dr : dc)) * 2;
      }
    } else if (G.win === 'annihilation') {
      if (G.startMat === undefined) {
        var sm = 0;
        for (var q = 0; q < G.start.length; q++) {
          var sv = G.start[q];
          if (sv > 0 && sv !== BLOCK) sm += G.types[sv - 1].value;
        }
        G.startMat = sm * 2;
      }
      /* a lead is worth more the emptier the board gets, so trade when ahead */
      var tot = m0 + m1;
      sc += Math.round((m0 - m1) * (G.startMat - tot) / (G.startMat || 1) * 1.4);
      /* once it is down to stragglers, the side in front has to go and find them */
      if (n0 + n1 <= 12 && n0 > 0 && n1 > 0) {
        var chase = m0 > m1 ? 0 : (m1 > m0 ? 1 : -1);
        if (chase >= 0) {
          var hunters = chase === 0 ? HUNT_A : HUNT_B, nh = chase === 0 ? n0 : n1;
          var prey = chase === 0 ? HUNT_B : HUNT_A, np = chase === 0 ? n1 : n0;
          var near = 0;
          for (var h = 0; h < nh; h++) {
            var hr = (hunters[h] / N) | 0, hc = hunters[h] % N, bestd = 99;
            for (var p = 0; p < np; p++) {
              var pr2 = Math.abs(((prey[p] / N) | 0) - hr), pc2 = Math.abs((prey[p] % N) - hc);
              var dd = pr2 > pc2 ? pr2 : pc2;
              if (dd < bestd) bestd = dd;
            }
            near += (N - bestd);
          }
          sc += (chase === 0 ? 1 : -1) * near * 4;
        }
      }
    }
    return side === 0 ? sc : -sc;
  }

  /* ================= search ================= */
  var MATE = 1000000, INF = 9999999;
  var nodes = 0, deadline = 0, aborted = false;

  function orderMoves(G, b, mv) {
    mv.sort(function (x, y) { return score(y) - score(x); });
    function score(m) {
      var t = b[(m >> 6) & 63];
      if (t === 0) return 0;
      return 100 + G.types[(t > 0 ? t : -t) - 1].value;
    }
  }

  function quiesce(G, b, side, alpha, beta, ply, d) {
    var w = winner(G, b);
    if (w >= 0) return w === side ? MATE - ply : -(MATE - ply);
    var stand = evaluate(G, b, side);
    if (d <= 0 || stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    var mv = genMoves(G, b, side, [], true);
    if (!mv.length) return stand;
    orderMoves(G, b, mv);
    var best = stand;
    for (var k = 0; k < mv.length; k++) {
      var rec = make(G, b, mv[k]);
      var v = -quiesce(G, b, 1 - side, -beta, -alpha, ply + 1, d - 1);
      unmake(G, b, rec);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function negamax(G, b, side, depth, alpha, beta, ply) {
    if (((++nodes) & 1023) === 0 && Date.now() > deadline) aborted = true;
    if (aborted) return 0;
    var w = winner(G, b);
    if (w >= 0) return w === side ? MATE - ply : -(MATE - ply);
    if (depth <= 0) return quiesce(G, b, side, alpha, beta, ply, 4);
    var mv = genMoves(G, b, side, [], false);
    if (!mv.length) return -(MATE - ply);
    orderMoves(G, b, mv);
    var best = -INF;
    for (var k = 0; k < mv.length; k++) {
      var rec = make(G, b, mv[k]);
      var v = -negamax(G, b, 1 - side, depth - 1, -beta, -alpha, ply + 1);
      unmake(G, b, rec);
      if (aborted) return best === -INF ? 0 : best;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMove(G, b, side, maxDepth, ms, rand) {
    deadline = Date.now() + (ms || 700);
    aborted = false; nodes = 0;
    var mv = genMoves(G, b, side, [], false);
    if (!mv.length) return { move: -1, score: 0, depth: 0, nodes: 0 };
    shuffle(rand || Math.random, mv);
    orderMoves(G, b, mv);
    var best = mv[0], bestScore = 0, reached = 0;
    for (var d = 1; d <= maxDepth; d++) {
      var localBest = -1, localScore = -INF, alpha = -INF;
      for (var k = 0; k < mv.length; k++) {
        var rec = make(G, b, mv[k]);
        var v = -negamax(G, b, 1 - side, d - 1, -INF, -alpha, 1);
        unmake(G, b, rec);
        if (aborted) break;
        if (v > localScore) { localScore = v; localBest = mv[k]; }
        if (v > alpha) alpha = v;
      }
      if (aborted || localBest < 0) break;
      best = localBest; bestScore = localScore; reached = d;
      var idx = mv.indexOf(best);
      if (idx > 0) { mv.splice(idx, 1); mv.unshift(best); }
      if (bestScore > MATE - 200) break;
    }
    return { move: best, score: bestScore, depth: reached, nodes: nodes };
  }

  var ENGINE = {
    rng: rng, seedForToday: seedForToday, buildGame: buildGame, genMoves: genMoves,
    make: make, unmake: unmake, winner: winner, evaluate: evaluate, bestMove: bestMove,
    BLOCK: BLOCK, SETS: SETS, MATE: MATE, coin: coin
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
  root.GambitEngine = ENGINE;

  /* ================================================================
     Everything below here is the page. Skipped outside a browser.
     ================================================================ */
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };

  var cv = $('board'), cx = cv && cv.getContext('2d');
  if (!cv) return;

  var COL = ['#64f0c8', '#7aa2ff'];
  var COL_DARK = ['#0d3a30', '#11224d'];

  var G, board, side, human = 0, flip = false, sel = -1, legal = [], last = null,
    history = [], over = null, quietRun = 0, thinking = false, aiDepth = 5, prand = Math.random;

  /* ---------- game lifecycle ---------- */
  function newGame(seed, keepSides) {
    G = buildGame(seed);
    board = Int8Array.from(G.start);
    side = 0; sel = -1; legal = []; last = null; history = []; over = null; quietRun = 0;
    if (!keepSides) human = 0;
    prand = rng((seed ^ 0x51ed270b) >>> 0);
    fit();
    describe();
    draw();
    status();
    if (side !== human) setTimeout(aiMove, 320);
  }

  function legalFor(from) {
    var all = genMoves(G, board, side, [], false), out = [];
    for (var i = 0; i < all.length; i++) if ((all[i] & 63) === from) out.push((all[i] >> 6) & 63);
    return out;
  }

  function applyMove(mv) {
    var rec = make(G, board, mv);
    history.push({ mv: mv, rec: rec, side: side, quiet: rec.quiet, run: quietRun });
    quietRun = rec.quiet ? quietRun + 1 : 0;
    last = { from: mv & 63, to: (mv >> 6) & 63 };
    side = 1 - side;
    sel = -1; legal = [];
    checkOver();
  }

  function checkOver() {
    var w = winner(G, board);
    if (w >= 0) { over = { w: w, why: 'condition' }; return; }
    if (!genMoves(G, board, side, [], false).length) { over = { w: 1 - side, why: 'stuck' }; return; }
    if (quietRun >= G.drawPlies) { over = { w: -1, why: 'exhausted' }; return; }
    over = null;
  }

  function aiMove() {
    if (over || side === human) { thinking = false; return; }
    thinking = true; status(); draw();
    setTimeout(function () {
      var budget = aiDepth <= 3 ? 300 : (aiDepth === 5 ? 900 : 2000);
      var res = bestMove(G, board, side, aiDepth, budget, prand);
      thinking = false;
      if (res.move < 0) { checkOver(); draw(); status(); return; }
      applyMove(res.move);
      draw(); status(); logMove();
      if (!over && side !== human) setTimeout(aiMove, 220);
    }, 40);
  }

  /* ---------- interaction ---------- */
  function cellAt(px, py) {
    var g = geom();
    var c = Math.floor((px - g.ox) / g.cell), r = Math.floor((py - g.oy) / g.cell);
    if (r < 0 || r >= G.N || c < 0 || c >= G.N) return -1;
    if (flip) { r = G.N - 1 - r; c = G.N - 1 - c; }
    return r * G.N + c;
  }

  cv.addEventListener('pointerdown', function (e) {
    if (!G || over || thinking || side !== human) return;
    var rect = cv.getBoundingClientRect();
    var i = cellAt(e.clientX - rect.left, e.clientY - rect.top);
    if (i < 0) return;
    if (sel >= 0 && legal.indexOf(i) >= 0) {
      applyMove(sel | (i << 6));
      draw(); status(); logMove();
      if (!over) setTimeout(aiMove, 200);
      return;
    }
    var v = board[i];
    if (v !== 0 && v !== BLOCK && (v > 0 ? 0 : 1) === side) {
      sel = i; legal = legalFor(i);
    } else { sel = -1; legal = []; }
    draw();
  });

  /* ---------- drawing ---------- */
  var DPR = 1;
  function fit() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(260, Math.min(cv.parentElement.clientWidth || 560, 560));
    cv.style.width = w + 'px';
    cv.style.height = w + 'px';
    cv.width = Math.floor(w * DPR);
    cv.height = Math.floor(w * DPR);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function geom() {
    var w = cv.clientWidth, pad = 20;
    var cell = (w - pad * 2) / G.N;
    return { ox: pad, oy: pad, cell: cell, w: w };
  }
  function view(i) {
    var r = (i / G.N) | 0, c = i % G.N;
    if (flip) { r = G.N - 1 - r; c = G.N - 1 - c; }
    return { r: r, c: c };
  }

  function drawGlyph(g, shape, x, y, rad, fill, line, royal) {
    g.beginPath();
    switch (shape) {
      case 'square': g.rect(x - rad * .82, y - rad * .82, rad * 1.64, rad * 1.64); break;
      case 'triangle':
        g.moveTo(x, y - rad); g.lineTo(x + rad * .92, y + rad * .72); g.lineTo(x - rad * .92, y + rad * .72); g.closePath(); break;
      case 'diamond':
        g.moveTo(x, y - rad); g.lineTo(x + rad, y); g.lineTo(x, y + rad); g.lineTo(x - rad, y); g.closePath(); break;
      case 'chevron':
        g.moveTo(x, y - rad); g.lineTo(x + rad, y + rad * .35); g.lineTo(x + rad * .45, y + rad * .95);
        g.lineTo(x, y + rad * .2); g.lineTo(x - rad * .45, y + rad * .95); g.lineTo(x - rad, y + rad * .35); g.closePath(); break;
      case 'pentagon': case 'hex': {
        var n = shape === 'hex' ? 6 : 5;
        for (var k = 0; k < n; k++) {
          var a = -Math.PI / 2 + k * 2 * Math.PI / n;
          var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath(); break;
      }
      case 'star': {
        for (var k2 = 0; k2 < 10; k2++) {
          var rr = k2 % 2 ? rad * .46 : rad;
          var a2 = -Math.PI / 2 + k2 * Math.PI / 5;
          var sx = x + Math.cos(a2) * rr, sy = y + Math.sin(a2) * rr;
          if (k2 === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
        }
        g.closePath(); break;
      }
      default: g.arc(x, y, rad, 0, Math.PI * 2);
    }
    g.fillStyle = fill; g.fill();
    g.lineWidth = Math.max(1.2, rad * .16); g.strokeStyle = line; g.stroke();
    if (royal) {
      g.beginPath(); g.arc(x, y, rad * 1.42, 0, Math.PI * 2);
      g.lineWidth = Math.max(1, rad * .12); g.strokeStyle = line; g.stroke();
    }
  }

  function draw() {
    if (!G) return;
    var g = geom(), N = G.N;
    cx.clearRect(0, 0, g.w, g.w);
    cx.fillStyle = '#07090d';
    cx.fillRect(0, 0, g.w, g.w);

    var goal0 = flip ? N - 1 : 0, goal1 = flip ? 0 : N - 1;

    for (var i = 0; i < N * N; i++) {
      var v = view(i), x = g.ox + v.c * g.cell, y = g.oy + v.r * g.cell;
      var dark = (v.r + v.c) % 2 === 1;
      cx.fillStyle = dark ? 'rgba(122,162,255,.075)' : 'rgba(232,237,245,.035)';
      cx.fillRect(x, y, g.cell, g.cell);
      if (board[i] === BLOCK) {
        cx.fillStyle = '#04060a';
        cx.fillRect(x + 1, y + 1, g.cell - 2, g.cell - 2);
        cx.strokeStyle = 'rgba(255,255,255,.1)';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(x + g.cell * .3, y + g.cell * .3); cx.lineTo(x + g.cell * .7, y + g.cell * .7);
        cx.moveTo(x + g.cell * .7, y + g.cell * .3); cx.lineTo(x + g.cell * .3, y + g.cell * .7);
        cx.stroke();
      }
    }

    if (G.win === 'breakthrough') {
      cx.fillStyle = 'rgba(100,240,200,.35)';
      cx.fillRect(g.ox, g.oy + goal0 * g.cell, g.cell * N, 3);
      cx.fillStyle = 'rgba(122,162,255,.35)';
      cx.fillRect(g.ox, g.oy + (goal1 + 1) * g.cell - 3, g.cell * N, 3);
    }

    if (last) {
      [last.from, last.to].forEach(function (i2) {
        var vv = view(i2);
        cx.strokeStyle = 'rgba(255,255,255,.22)';
        cx.lineWidth = 2;
        cx.strokeRect(g.ox + vv.c * g.cell + 1, g.oy + vv.r * g.cell + 1, g.cell - 2, g.cell - 2);
      });
    }

    if (sel >= 0) {
      var vs = view(sel);
      cx.strokeStyle = COL[side]; cx.lineWidth = 2.4;
      cx.strokeRect(g.ox + vs.c * g.cell + 1.5, g.oy + vs.r * g.cell + 1.5, g.cell - 3, g.cell - 3);
      for (var m = 0; m < legal.length; m++) {
        var vm = view(legal[m]);
        var cxm = g.ox + vm.c * g.cell + g.cell / 2, cym = g.oy + vm.r * g.cell + g.cell / 2;
        if (board[legal[m]] !== 0) {
          cx.beginPath(); cx.arc(cxm, cym, g.cell * .42, 0, Math.PI * 2);
          cx.strokeStyle = '#ff8a5b'; cx.lineWidth = 2.4; cx.stroke();
        } else {
          cx.beginPath(); cx.arc(cxm, cym, g.cell * .14, 0, Math.PI * 2);
          cx.fillStyle = 'rgba(100,240,200,.6)'; cx.fill();
        }
      }
    }

    for (var i3 = 0; i3 < N * N; i3++) {
      var pv = board[i3];
      if (pv === 0 || pv === BLOCK) continue;
      var s = pv > 0 ? 0 : 1, pd = G.types[(pv > 0 ? pv : -pv) - 1];
      var vw = view(i3);
      drawGlyph(cx, pd.shape,
        g.ox + vw.c * g.cell + g.cell / 2,
        g.oy + vw.r * g.cell + g.cell / 2,
        g.cell * .32, s === 0 ? COL[0] : COL_DARK[1],
        s === 0 ? '#04120e' : COL[1], pd.royal);
    }

    cx.fillStyle = 'rgba(139,151,171,.75)';
    cx.font = '600 10px ui-monospace,Menlo,monospace';
    for (var c4 = 0; c4 < N; c4++) {
      var fc = flip ? N - 1 - c4 : c4;
      cx.textAlign = 'center';
      cx.fillText('abcdefgh'[fc], g.ox + c4 * g.cell + g.cell / 2, g.w - 6);
    }
    for (var r4 = 0; r4 < N; r4++) {
      var fr = flip ? N - 1 - r4 : r4;
      cx.textAlign = 'left';
      cx.fillText(String(N - fr), 4, g.oy + r4 * g.cell + g.cell / 2 + 3);
    }
  }

  /* ---------- readouts ---------- */
  function sq(i) { return 'abcdefgh'[i % G.N] + String(G.N - ((i / G.N) | 0)); }

  function status() {
    var el = $('gStatus'); if (!el) return;
    var cls = '';
    var txt;
    if (over) {
      if (over.w === -1) txt = 'Drawn — nothing has been taken for a long time.';
      else {
        var youWon = over.w === human;
        txt = (youWon ? 'You win' : 'It wins') + (over.why === 'stuck' ? ' — the other side has no move left.' : '.');
        cls = youWon ? 'done' : 'lost';
      }
    } else if (thinking) txt = 'It is thinking…';
    else if (side === human) txt = 'Your move.';
    else txt = 'Its move.';
    el.textContent = txt;
    el.className = 'g-status ' + cls;
    var mv = $('gPly'); if (mv) mv.textContent = String(history.length);
  }

  function logMove() {
    var el = $('gLog'); if (!el || !history.length) return;
    var h = history[history.length - 1];
    var line = document.createElement('div');
    line.className = 'g-move' + (h.side === human ? ' mine' : '');
    var pd = G.types[(h.rec.moved > 0 ? h.rec.moved : -h.rec.moved) - 1];
    var txt = (h.side === human ? 'you' : 'it') + '  ' + pd.name + ' ' + sq(h.rec.from) +
      (h.rec.cap ? '×' : '–') + sq(h.rec.to);
    if (h.rec.cust) txt += ' +' + (h.rec.cust.length / 2) + ' sandwiched';
    line.textContent = txt;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function moveDiagram(pd) {
    var S = 7, px = 13, cvs = document.createElement('canvas');
    cvs.width = S * px; cvs.height = S * px;
    cvs.style.width = (S * px) + 'px'; cvs.style.height = (S * px) + 'px';
    cvs.className = 'g-diagram';
    var g = cvs.getContext('2d');
    g.fillStyle = '#080b11'; g.fillRect(0, 0, S * px, S * px);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
    for (var k = 0; k <= S; k++) {
      g.beginPath(); g.moveTo(k * px, 0); g.lineTo(k * px, S * px); g.stroke();
      g.beginPath(); g.moveTo(0, k * px); g.lineTo(S * px, k * px); g.stroke();
    }
    var mid = 3;
    for (var a = 0; a < pd.atoms.length; a++) {
      var at = pd.atoms[a], dirs = SETS[at.s];
      for (var d = 0; d < dirs.length; d++) {
        var rr = mid, cc = mid;
        var lim = Math.min(at.r, 3);
        for (var st = 1; st <= lim; st++) {
          rr += dirs[d][0]; cc += dirs[d][1];
          if (rr < 0 || rr >= S || cc < 0 || cc >= S) break;
          var alpha = at.r > 3 ? Math.max(.28, 1 - (st - 1) * .28) : 1;
          var x = cc * px + px / 2, y = rr * px + px / 2;
          g.beginPath(); g.arc(x, y, px * .24, 0, Math.PI * 2);
          if (at.m === 'c') { g.strokeStyle = 'rgba(255,138,91,' + alpha + ')'; g.lineWidth = 1.6; g.stroke(); }
          else if (at.m === 'm') { g.strokeStyle = 'rgba(100,240,200,' + alpha + ')'; g.lineWidth = 1.6; g.stroke(); }
          else { g.fillStyle = 'rgba(100,240,200,' + alpha + ')'; g.fill(); }
        }
      }
    }
    drawGlyph(g, pd.shape, mid * px + px / 2, mid * px + px / 2, px * .38, COL[0], '#04120e', pd.royal);
    return cvs;
  }

  function describe() {
    $('gName').textContent = G.name;
    $('gSeedOut').textContent = String(G.seed).padStart(10, '0');
    $('gBoardOut').textContent = G.N + '×' + G.N + (G.blocked.length ? ' — ' + G.blocked.length + ' squares blocked' : '');

    var winText = {
      regicide: 'Take the other side’s ' + (G.royalIdx >= 0 ? G.types[G.royalIdx].name : 'crown') + ' and the game is over.',
      breakthrough: 'Get any one piece onto the far rank — the row the other side started on — and the game is over.',
      annihilation: 'Take every last piece the other side owns.'
    }[G.win];
    $('gWinOut').textContent = winText;

    var extra = [];
    if (G.custodian) extra.push('A piece of yours that ends its move with an enemy piece directly between it and another of yours takes that piece, orthogonally only' + (G.royalIdx >= 0 ? ', except the ' + G.types[G.royalIdx].name + ', which cannot be taken this way' : '') + '.');
    if (G.promote) extra.push('A piece that only moves forwards becomes a ' + G.types[G.promoteTo].name + ' when it reaches the far rank.');
    extra.push('A side with no legal move loses. If neither side takes anything for ' + G.drawPlies + ' moves the game is drawn.');
    $('gExtraOut').innerHTML = extra.map(function (s) { return '<li>' + s + '</li>'; }).join('');

    var tbl = $('gPieces');
    tbl.innerHTML = '';
    for (var t = 0; t < G.types.length; t++) {
      var pd = G.types[t];
      var count = 0;
      for (var i = 0; i < G.start.length; i++) if (G.start[i] === t + 1) count++;
      var row = document.createElement('div');
      row.className = 'g-piece';
      var dia = document.createElement('div');
      dia.className = 'g-dia';
      dia.appendChild(moveDiagram(pd));
      var body = document.createElement('div');
      body.innerHTML = '<h4>' + pd.name + ' <em>the ' + pd.plain + '</em></h4>' +
        '<p>' + pd.tag.charAt(0).toUpperCase() + pd.tag.slice(1) + '.' +
        (pd.dir ? ' It never turns round.' : '') + '</p>' +
        '<p class="g-meta">' + count + ' a side · worth ' + pd.value + (pd.royal ? ' · royal' : '') + '</p>';
      row.appendChild(dia); row.appendChild(body);
      tbl.appendChild(row);
    }

    $('gPlaque').innerHTML =
      '<p>' + G.name + ' is played by the ' + G.who + ' of ' + G.place +
      ', on a board ' + G.surface + ', with men of ' + G.material + '. ' + G.since + '</p>';

    var log = $('gLog'); if (log) log.innerHTML = '';
  }

  /* ---------- controls ---------- */
  function wire(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }

  wire('gNew', function () { newGame((Math.random() * 4294967295) >>> 0, false); });
  wire('gToday', function () { newGame(seedForToday(), false); });
  wire('gRestart', function () { newGame(G.seed, true); });
  wire('gUndo', function () {
    if (thinking || !history.length) return;
    var steps = 0;
    while (history.length && steps < 2) {
      var h = history.pop();
      unmake(G, board, h.rec);
      side = h.side;
      quietRun = h.run;
      steps++;
      var el = $('gLog'); if (el && el.lastChild) el.removeChild(el.lastChild);
      if (side === human) break;
    }
    last = history.length ? { from: history[history.length - 1].rec.from, to: history[history.length - 1].rec.to } : null;
    over = null; sel = -1; legal = [];
    draw(); status();
    if (side !== human) setTimeout(aiMove, 260);
  });
  wire('gFlip', function () { flip = !flip; draw(); });
  wire('gSwap', function () {
    human = 1 - human; flip = human === 1;
    sel = -1; legal = [];
    draw(); status();
    if (!over && side !== human) setTimeout(aiMove, 240);
  });

  var lvl = $('gLevels');
  if (lvl) {
    [['Gentle', 3], ['Even', 5], ['Sharp', 7]].forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'chip' + (p[1] === aiDepth ? ' on' : '');
      b.textContent = p[0];
      b.addEventListener('click', function () {
        aiDepth = p[1];
        Array.prototype.forEach.call(lvl.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      });
      lvl.appendChild(b);
    });
  }

  window.addEventListener('resize', function () { fit(); draw(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'n' || e.key === 'N') { newGame((Math.random() * 4294967295) >>> 0, false); }
    if (e.key === 'f' || e.key === 'F') { flip = !flip; draw(); }
  });

  newGame(seedForToday(), false);

})(typeof window !== 'undefined' ? window : globalThis);
