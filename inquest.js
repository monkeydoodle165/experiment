/* The Inquest — drift.quibo.games
   A deduction case dealt by the day's number.

   The day's seed lays out a building: a line of rooms, one person in each, a
   trade apiece, something left on the floor of each, and a clock in each
   reading a different time. It then writes every true statement it can about
   that arrangement, and a solver decides which of them you actually get.

   The solver is a constraint propagator (arc consistency over bitmask domains,
   plus all-different in both directions) wrapped in a backtracking search that
   counts solutions and gives up at two. Statements are added until the count is
   one, then removed one at a time for as long as it stays one. So the set you
   are handed is minimal, and its uniqueness has been proved before the page
   drew anything.

   Self-contained. No dependencies. */
(function () {
  'use strict';

  /* ================= seeded rng ================= */

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

  function mix(seed, salt) {
    var h = (seed ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function shuffle(arr, rand) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function take(pool, n, rand) { return shuffle(pool.slice(), rand).slice(0, n); }
  function pickOne(pool, rand) { return pool[Math.floor(rand() * pool.length)]; }
  function ucfirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function idx(n) { var a = [], i; for (i = 0; i < n; i++) a.push(i); return a; }
  function catIndex(cats, key) {
    for (var i = 0; i < cats.length; i++) if (cats[i].key === key) return i;
    return -1;
  }

  var WORDS = { 4: 'Four', 5: 'Five', 6: 'Six' };

  /* ================= the clocks ================= */

  var HOURS = [
    'ten past seven', 'half past seven', "eight o'clock", 'twenty past eight',
    'a quarter to nine', "nine o'clock", 'twenty-five past nine',
    'half past ten', 'a quarter past eleven', 'five to midnight'
  ];

  /* ================= settings ================= */

  var CORRIDOR = {
    along: 'strung out along one corridor', fromEnd: 'west end first',
    lowPhrase: 'west of', endLow: 'at the west end', endHigh: 'at the east end',
    adjPhrase: 'next door to', unit: 'room', units: 'rooms', unitCap: 'Room'
  };

  var SETTINGS = [
    {
      where: 'Hallerby Hall, shut up for the winter',
      axis: CORRIDOR,
      missing: 'the snuffbox is gone from the cabinet on the landing — gold, a hunting scene on the lid, and the cabinet shut again afterwards',
      rooms: ['the Library', 'the Morning Room', 'the Gun Room', 'the Still Room',
              'the Long Gallery', 'the Billiard Room', 'the Boot Room', 'the Orangery'],
      people: ['Ashgrove', 'Penhale', 'Quillon', 'Marbury', 'Veitch', 'Rookwood', 'Stannard', 'Delagarde'],
      roles: ['housekeeper', 'under-gardener', 'clockwinder', 'cook', 'gamekeeper',
              'laundress', 'estate clerk', 'stable hand'],
      objects: ['candle stub', 'folded newspaper', 'ring of keys', 'jar of blacking',
                'length of twine', 'pair of spectacles', 'bundle of letters', 'tin of nails'],
      telltales: ['torn grey glove', 'smear of lamp black', 'snapped hatpin', 'bootprint in plaster dust']
    },
    {
      where: 'the Marine Hotel, out of season, nine guests and no band',
      axis: CORRIDOR,
      missing: 'the brass barometer is gone from the lobby, unscrewed cleanly from its bracket and the screws left in a saucer',
      rooms: ['the Reading Room', 'the Palm Court', 'the Card Room', 'the Linen Store',
              'the Smoking Room', 'the Sun Lounge', "the Porter's Lodge", 'the Ballroom'],
      people: ['Ferris', 'Okonkwo', 'Lindqvist', 'Baptiste', 'Merriweather', 'Szabo', 'Calloway', 'Nwosu'],
      roles: ['night porter', 'pastry cook', 'dance teacher', 'bookkeeper',
              'lift attendant', 'piano tuner', 'chambermaid', 'wine steward'],
      objects: ['saucer of milk', 'room key on a fob', 'damp umbrella', 'folded tide table',
                'tin of cachous', 'pack of cards', 'guest ledger', 'sprig of dried lavender'],
      telltales: ['torn cloakroom ticket', 'button off a striped waistcoat', 'blot of green ink', 'heel print in sand']
    },
    {
      where: 'the 11.40 sleeper, somewhere north of Crewe and not stopping',
      axis: {
        along: 'one to a carriage down the length of the train', fromEnd: 'engine end first',
        lowPhrase: 'ahead of', endLow: 'at the front of the train', endHigh: 'at the back of the train',
        adjPhrase: 'coupled directly to', unit: 'carriage', units: 'carriages', unitCap: 'Carriage'
      },
      missing: 'the registered mail bag for Carlisle has been cut open along the seam and emptied, and the seal put back on the outside of it',
      rooms: ["the Guard's Van", 'the Mail Car', 'the Kitchen Car', 'the Dining Car',
              'Sleeper A', 'Sleeper B', 'the Saloon', 'the Observation Car'],
      people: ['Attwater', 'Kirkbride', 'Sowande', 'Halloran', 'Petrucci', 'Yeo', 'Brandram', 'Ilves'],
      roles: ['guard', 'sleeping-car attendant', 'dining-car chef', 'post office sorter',
              'relief driver', 'ticket inspector', 'pastry cook', 'engineer travelling home'],
      objects: ['thermos of tea', 'punched ticket', 'waybill', 'fiddle case',
                'scuttle of coal', 'folded timetable', 'hurricane lamp', 'strap off a mail sack'],
      telltales: ['torn luggage label', 'cufflink under the seat', 'smear of engine grease', 'dropped sleeper key']
    },
    {
      where: 'the Borough Museum, an hour after closing, one lamp in six still lit',
      axis: {
        along: 'one to a gallery along the enfilade', fromEnd: 'west end first',
        lowPhrase: 'west of', endLow: 'at the west end', endHigh: 'at the east end',
        adjPhrase: 'next along from', unit: 'gallery', units: 'galleries', unitCap: 'Gallery'
      },
      missing: 'the best coin of the Dunmore hoard is gone, lifted out of its tray and the tray put back straight',
      rooms: ['the Hall of Casts', 'the Coin Room', 'the Herbarium', 'the Map Room',
              'the Lecture Theatre', 'the Conservation Bench', 'the Egyptian Gallery', 'the Boiler Room'],
      people: ['Achterberg', 'Pelling', 'Mwangi', 'Sorensen', 'Trevaskis', 'Datta', 'Lourdes', 'Bishopgate'],
      roles: ['night warder', 'conservator', 'cataloguer', 'taxidermist',
              'draughtsman', 'curator of coins', 'cleaner', 'apprentice binder'],
      objects: ['tray of unsorted coins', 'jar of paste', 'labelled skull', 'magnifying glass',
                'roll of blotting paper', 'watering can', 'stack of index cards', 'paraffin heater'],
      telltales: ['thumbprint in fresh wax', 'torn accession label', 'trail of sawdust', 'snapped scalpel blade']
    },
    {
      where: 'the Alhambra, twenty minutes after the curtain came down',
      axis: {
        along: 'one to a room along the back corridor', fromEnd: 'prompt side first',
        lowPhrase: 'promptward of', endLow: 'at the prompt end', endHigh: 'at the far end',
        adjPhrase: 'next door to', unit: 'room', units: 'rooms', unitCap: 'Room'
      },
      missing: "the night's takings are gone from the box office, counted twice by two people and then not there",
      rooms: ['the Green Room', 'the Wardrobe', 'the Prompt Corner', 'the Scene Dock',
              'the Property Store', 'the Orchestra Pit', 'the Front of House', 'the Paint Frame'],
      people: ['Considine', 'Achebe', 'Rusk', 'Varga', 'Fenwick', 'Delacroix', 'Oyelaran', 'Strange'],
      roles: ['stage manager', 'wardrobe mistress', 'repetiteur', 'scene painter',
              'call boy', 'house manager', 'flyman', 'property master'],
      objects: ['pot of size', 'prompt book', 'box of greasepaint', 'coil of sash cord',
                'tray of paste jewels', 'dented trumpet', 'bundle of gel frames', 'kettle'],
      telltales: ['smudge of carmine', 'torn call sheet', 'single sequin', 'chalk mark where none was wanted']
    },
    {
      where: 'Vestbukta Station, eleven weeks into the dark',
      axis: {
        along: 'one to a hut along the covered way', fromEnd: 'seaward end first',
        lowPhrase: 'seaward of', endLow: 'at the seaward end', endHigh: 'at the inland end',
        adjPhrase: 'next along from', unit: 'hut', units: 'huts', unitCap: 'Hut'
      },
      missing: 'the station\'s one spare transmitter valve is gone, out of its box, and the box put back in the rack',
      rooms: ['the Radio Shack', 'the Mess', 'the Generator Hut', 'the Ice Laboratory',
              'the Drying Room', 'the Store Hut', 'the Garage', 'the Bunkroom'],
      people: ['Sandvik', 'Odede', 'Kaasinen', 'Brightwell', 'Ruiz', 'Thorsby', 'Nakagawa', 'Egede'],
      roles: ['radio operator', 'cook', 'diesel mechanic', 'glaciologist',
              'met observer', 'carpenter', 'dog handler', 'surveyor'],
      objects: ['mug of cocoa going cold', 'spare valve crate', 'tin of dubbin', 'core sample in a sleeve',
                'pack of playing cards', 'wind-up torch', 'mitten drying out', 'station logbook'],
      telltales: ['boot print in engine oil', 'torn windproof cuff', 'spill of paraffin', 'glove left on the bench']
    }
  ];

  /* ================= difficulty ================= */

  var LEVELS = [
    { id: 'brief',      label: 'Brief',      rooms: 4, role: true,  hour: false, salt: 11 },
    { id: 'standard',   label: 'Standard',   rooms: 5, role: false, hour: true,  salt: 23 },
    { id: 'thorough',   label: 'Thorough',   rooms: 5, role: true,  hour: true,  salt: 37 },
    { id: 'exhaustive', label: 'Exhaustive', rooms: 6, role: true,  hour: true,  salt: 53 }
  ];

  /* ================= solver ================= */

  function popcount(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }
  function bits(x) { var r = [], i = 0; while (x) { if (x & 1) r.push(i); x >>>= 1; i++; } return r; }

  /* does value p for variable idx of this clue have any support in the other
     variables' current domains? arity is at most three, so brute force is fine. */
  function support(clue, dom, target, p, N) {
    var vars = clue.vars, n = vars.length, vals = new Array(n);
    function rec(k) {
      if (k === n) {
        for (var i = 0; i < n; i++) {
          for (var j = i + 1; j < n; j++) {
            if (vars[i][0] === vars[j][0] && vals[i] === vals[j]) return false;
          }
        }
        return clue.test(vals);
      }
      if (k === target) { vals[k] = p; return rec(k + 1); }
      var d = dom[vars[k][0]][vars[k][1]];
      for (var q = 0; q < N; q++) {
        if (!(d & (1 << q))) continue;
        vals[k] = q;
        if (rec(k + 1)) return true;
      }
      return false;
    }
    return rec(0);
  }

  function propagate(dom, clues, K, N) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var ci = 0; ci < clues.length; ci++) {
        var clue = clues[ci], vars = clue.vars;
        for (var vi = 0; vi < vars.length; vi++) {
          var c = vars[vi][0], v = vars[vi][1], d = dom[c][v], allowed = 0;
          for (var p = 0; p < N; p++) {
            if (!(d & (1 << p))) continue;
            if (support(clue, dom, vi, p, N)) allowed |= (1 << p);
          }
          if (allowed !== d) {
            dom[c][v] = allowed;
            changed = true;
            if (!allowed) return false;
          }
        }
      }
      for (var cc = 0; cc < K; cc++) {
        /* a value pinned to one room takes that room away from the rest */
        for (var w = 0; w < N; w++) {
          var dw = dom[cc][w];
          if (!dw) return false;
          if (popcount(dw) === 1) {
            for (var u = 0; u < N; u++) {
              if (u !== w && (dom[cc][u] & dw)) {
                dom[cc][u] &= ~dw;
                changed = true;
                if (!dom[cc][u]) return false;
              }
            }
          }
        }
        /* and a room only one value can still occupy belongs to that value */
        for (var pp = 0; pp < N; pp++) {
          var bit = 1 << pp, cnt = 0, last = -1;
          for (var vv = 0; vv < N; vv++) if (dom[cc][vv] & bit) { cnt++; last = vv; }
          if (cnt === 0) return false;
          if (cnt === 1 && dom[cc][last] !== bit) { dom[cc][last] = bit; changed = true; }
        }
      }
    }
    return true;
  }

  /* counts solutions, stopping at `stopAt`. `truncated` means the node budget
     ran out, in which case the count is not to be trusted and callers treat the
     puzzle as not yet proved unique. */
  function solve(clues, K, N, stopAt) {
    var found = 0, first = null, nodes = 0, truncated = false;
    var dom = [], c, v;
    for (c = 0; c < K; c++) {
      dom[c] = [];
      for (v = 0; v < N; v++) dom[c][v] = (1 << N) - 1;
    }
    rec(dom);
    return { count: found, solution: first, truncated: truncated };

    function rec(d) {
      if (found >= stopAt || truncated) return;
      if (++nodes > 400000) { truncated = true; return; }
      if (!propagate(d, clues, K, N)) return;
      var bc = -1, bv = -1, best = 99, cx, vx, pc;
      for (cx = 0; cx < K; cx++) {
        for (vx = 0; vx < N; vx++) {
          pc = popcount(d[cx][vx]);
          if (pc > 1 && pc < best) { best = pc; bc = cx; bv = vx; }
        }
      }
      if (bc < 0) {
        found++;
        if (!first) {
          first = [];
          for (cx = 0; cx < K; cx++) {
            first[cx] = [];
            for (vx = 0; vx < N; vx++) first[cx][vx] = bits(d[cx][vx])[0];
          }
        }
        return;
      }
      var opts = bits(d[bc][bv]);
      for (var i = 0; i < opts.length; i++) {
        var nd = [];
        for (var cy = 0; cy < K; cy++) nd[cy] = d[cy].slice();
        nd[bc][bv] = 1 << opts[i];
        rec(nd);
        if (found >= stopAt || truncated) return;
      }
    }
  }

  /* ================= statements ================= */

  function mk(kind, vars, test, text) {
    return { kind: kind, vars: vars, test: test, text: text };
  }
  function cAt(c, v, p, text) { return mk('at', [[c, v]], function (x) { return x[0] === p; }, text); }
  function cNotAt(c, v, p, text) { return mk('notat', [[c, v]], function (x) { return x[0] !== p; }, text); }
  function cSame(a, b, text) { return mk('same', [a, b], function (x) { return x[0] === x[1]; }, text); }
  function cDiff(a, b, text) { return mk('diff', [a, b], function (x) { return x[0] !== x[1]; }, text); }
  function cAdj(a, b, text) { return mk('adj', [a, b], function (x) { return Math.abs(x[0] - x[1]) === 1; }, text); }
  function cNotAdj(a, b, text) { return mk('notadj', [a, b], function (x) { return Math.abs(x[0] - x[1]) !== 1; }, text); }
  function cImm(a, b, text) { return mk('imm', [a, b], function (x) { return x[1] - x[0] === 1; }, text); }
  function cDir(a, b, text) { return mk('dir', [a, b], function (x) { return x[0] < x[1]; }, text); }
  function cDist(a, b, k, text) { return mk('dist', [a, b], function (x) { return Math.abs(x[0] - x[1]) === k; }, text); }
  function cBetween(a, b, c, text) {
    return mk('between', [a, b, c], function (x) {
      return (x[1] < x[0] && x[0] < x[2]) || (x[2] < x[0] && x[0] < x[1]);
    }, text);
  }

  var RANK = { person: 0, role: 1, object: 2, hour: 3 };

  function sameText(cats, A, B) {
    var a = A, b = B;
    if (RANK[cats[A[0]].key] > RANK[cats[B[0]].key]) { a = B; b = A; }
    var x = cats[a[0]], y = cats[b[0]];
    var xv = x.values[a[1]], yv = y.values[b[1]];
    if (x.key === 'person' && y.key === 'role') return xv + ' is the ' + yv + '.';
    if (y.key === 'object') return 'The ' + yv + ' was on the floor of ' + x.rp(a[1]) + '.';
    if (y.key === 'hour') return 'The clock in ' + x.rp(a[1]) + ' reads ' + yv + '.';
    return ucfirst(x.rp(a[1])) + ' is ' + y.rp(b[1]) + '.';
  }

  function diffText(cats, A, B) {
    var a = A, b = B;
    if (RANK[cats[A[0]].key] > RANK[cats[B[0]].key]) { a = B; b = A; }
    var x = cats[a[0]], y = cats[b[0]];
    var xv = x.values[a[1]], yv = y.values[b[1]];
    if (x.key === 'person' && y.key === 'role') return xv + ' is not the ' + yv + '.';
    if (y.key === 'object') return 'The ' + yv + ' was not on the floor of ' + x.rp(a[1]) + '.';
    if (y.key === 'hour') return 'The clock in ' + x.rp(a[1]) + ' does not read ' + yv + '.';
    return ucfirst(x.rp(a[1])) + ' is not ' + y.rp(b[1]) + '.';
  }

  function distText(ax, k, ra, rb) {
    var n = k - 1;
    var body = (n === 1)
      ? 'is exactly one ' + ax.unit
      : 'are exactly two ' + ax.units;
    return 'There ' + body + ' between ' + ra + ' and ' + rb + '.';
  }

  /* ================= categories ================= */

  function makeCat(key, head, values, unit) {
    var c = { key: key, head: head, values: values };
    if (key === 'person') {
      c.rp = function (i) { return values[i] + "'s " + unit; };
      c.at = function (i, R) { return values[i] + ' was in ' + R; };
      c.notat = function (i, R) { return values[i] + ' was not in ' + R; };
    } else if (key === 'role') {
      c.rp = function (i) { return 'the ' + values[i] + "'s " + unit; };
      c.at = function (i, R) { return 'The ' + values[i] + ' was in ' + R; };
      c.notat = function (i, R) { return 'The ' + values[i] + ' was not in ' + R; };
    } else if (key === 'object') {
      c.rp = function (i) { return 'the ' + unit + ' with the ' + values[i]; };
      c.at = function (i, R) { return 'The ' + values[i] + ' was on the floor of ' + R; };
      c.notat = function (i, R) { return 'The ' + values[i] + ' was not on the floor of ' + R; };
    } else {
      c.rp = function (i) { return 'the ' + unit + ' whose clock reads ' + values[i]; };
      c.at = function (i, R) { return 'The clock in ' + R + ' reads ' + values[i]; };
      c.notat = function (i, R) { return 'The clock in ' + R + ' does not read ' + values[i]; };
    }
    return c;
  }

  /* ================= writing and pruning the statements ================= */

  function chooseClues(cats, truth, N, ax, roomNames, rand) {
    var K = cats.length, pool = [], atPool = [], items = [], c, v, i, j;
    for (c = 0; c < K; c++) for (v = 0; v < N; v++) items.push([c, v]);

    function P(it) { return truth[it[0]][it[1]]; }
    function rp(it) { return cats[it[0]].rp(it[1]); }

    for (i = 0; i < items.length; i++) {
      var A = items[i], pa = P(A), cat = cats[A[0]];
      atPool.push(cAt(A[0], A[1], pa, cat.at(A[1], roomNames[pa]) + '.'));
      var wrong = [];
      for (var q = 0; q < N; q++) if (q !== pa) wrong.push(q);
      shuffle(wrong, rand);
      for (var w = 0; w < Math.min(2, wrong.length); w++) {
        pool.push(cNotAt(A[0], A[1], wrong[w], cat.notat(A[1], roomNames[wrong[w]]) + '.'));
      }
      if (pa === 0) pool.push(cAt(A[0], A[1], 0, ucfirst(rp(A)) + ' is ' + ax.endLow + '.'));
      if (pa === N - 1) pool.push(cAt(A[0], A[1], N - 1, ucfirst(rp(A)) + ' is ' + ax.endHigh + '.'));
    }

    for (i = 0; i < items.length; i++) {
      for (j = i + 1; j < items.length; j++) {
        var a = items[i], b = items[j];
        var pa2 = P(a), pb2 = P(b), d = pb2 - pa2, ad = Math.abs(d);
        if (a[0] !== b[0]) {
          if (d === 0) pool.push(cSame(a, b, sameText(cats, a, b)));
          else if (rand() < 0.35) pool.push(cDiff(a, b, diffText(cats, a, b)));
        }
        if (ad === 1) {
          pool.push(cAdj(a, b, ucfirst(rp(a)) + ' is ' + ax.adjPhrase + ' ' + rp(b) + '.'));
          if (d === 1) pool.push(cImm(a, b, ucfirst(rp(a)) + ' is immediately ' + ax.lowPhrase + ' ' + rp(b) + '.'));
          else pool.push(cImm(b, a, ucfirst(rp(b)) + ' is immediately ' + ax.lowPhrase + ' ' + rp(a) + '.'));
        } else if (ad >= 2) {
          if (rand() < 0.3) pool.push(cNotAdj(a, b, ucfirst(rp(a)) + ' is not ' + ax.adjPhrase + ' ' + rp(b) + '.'));
          if (ad === 2 || ad === 3) pool.push(cDist(a, b, ad, distText(ax, ad, rp(a), rp(b))));
        }
        if (d !== 0 && rand() < 0.45) {
          if (d > 0) pool.push(cDir(a, b, ucfirst(rp(a)) + ' is somewhere ' + ax.lowPhrase + ' ' + rp(b) + '.'));
          else pool.push(cDir(b, a, ucfirst(rp(b)) + ' is somewhere ' + ax.lowPhrase + ' ' + rp(a) + '.'));
        }
      }
    }

    for (var t = 0; t < N * 8; t++) {
      var A3 = items[Math.floor(rand() * items.length)];
      var B3 = items[Math.floor(rand() * items.length)];
      var C3 = items[Math.floor(rand() * items.length)];
      if (A3 === B3 || A3 === C3 || B3 === C3) continue;
      var x3 = P(A3), y3 = P(B3), z3 = P(C3);
      if (!((y3 < x3 && x3 < z3) || (z3 < x3 && x3 < y3))) continue;
      pool.push(cBetween(A3, B3, C3,
        ucfirst(rp(A3)) + ' lies somewhere between ' + rp(B3) + ' and ' + rp(C3) + '.'));
    }

    shuffle(pool, rand);
    if (pool.length > 260) pool = pool.slice(0, 260);
    var ats = shuffle(atPool.slice(), rand);
    /* one anchor to start with, everything else in the middle, and the rest of
       the direct statements at the back as a guarantee that the pool as a whole
       always pins the answer down. */
    var order = [ats[0]].concat(pool, ats);

    var chosen = [], unique = false, r;
    for (i = 0; i < order.length; i++) {
      chosen.push(order[i]);
      if (chosen.length < 4) continue;
      r = solve(chosen, K, N, 2);
      if (r.count === 1 && !r.truncated) { unique = true; break; }
    }
    if (unique) {
      for (j = chosen.length - 1; j >= 0; j--) {
        if (chosen.length <= 2) break;
        var trial = chosen.slice(0, j).concat(chosen.slice(j + 1));
        r = solve(trial, K, N, 2);
        if (r.count === 1 && !r.truncated) chosen = trial;
      }
    }
    return { clues: shuffle(chosen, rand), unique: unique };
  }

  /* ================= dealing a case ================= */

  function buildCase(seed, level) {
    var rand = rng(mix(seed, level.salt));
    var S = SETTINGS[Math.floor(rand() * SETTINGS.length)];
    var ax = S.axis, N = level.rooms, c, v;

    var roomNames = take(S.rooms, N, rand);
    var telltale = pickOne(S.telltales, rand);
    var objects = take(S.objects, N - 1, rand);
    objects.push(telltale);
    shuffle(objects, rand);

    var cats = [];
    cats.push(makeCat('person', 'Who', take(S.people, N, rand), ax.unit));
    if (level.role) cats.push(makeCat('role', 'Trade', take(S.roles, N, rand), ax.unit));
    cats.push(makeCat('object', 'On the floor', objects, ax.unit));
    if (level.hour) cats.push(makeCat('hour', 'Clock reads', take(HOURS, N, rand), ax.unit));

    var K = cats.length, truth = [], truthAt = [];
    for (c = 0; c < K; c++) {
      var perm = shuffle(idx(N), rand);
      truth[c] = new Array(N);
      truthAt[c] = new Array(N);
      for (v = 0; v < N; v++) { truth[c][v] = perm[v]; truthAt[c][perm[v]] = v; }
    }

    var personCat = catIndex(cats, 'person');
    var objCat = catIndex(cats, 'object');
    var scenePos = truth[objCat][objects.indexOf(telltale)];
    var culprit = truthAt[personCat][scenePos];

    var built = chooseClues(cats, truth, N, ax, roomNames, rand);

    return {
      seed: seed, level: level, S: S, ax: ax, N: N, K: K,
      cats: cats, roomNames: roomNames, truth: truth, truthAt: truthAt,
      clues: built.clues, proved: built.unique,
      telltale: telltale, scenePos: scenePos, culprit: culprit,
      personCat: personCat, objCat: objCat
    };
  }

  var API = {
    buildCase: buildCase, solve: solve, LEVELS: LEVELS,
    SETTINGS: SETTINGS, seedForToday: seedForToday, rng: rng
  };
  window.Inquest = API;

  /* ================= the page ================= */

  function $(id) { return document.getElementById(id); }
  if (!$('sheet')) return;

  var LEVEL = LEVELS[1];
  var currentSeed = seedForToday();
  var state = null;

  function deal(seed) {
    currentSeed = seed >>> 0;
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var C = buildCase(currentSeed, LEVEL);
    var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
    C.ms = Math.max(1, Math.round(t1 - t0));
    state = { C: C, grid: [], given: [], hints: 0, wrong: [], done: false, revealed: false };
    for (var p = 0; p < C.N; p++) {
      state.grid[p] = []; state.given[p] = [];
      for (var c = 0; c < C.K; c++) { state.grid[p][c] = -1; state.given[p][c] = false; }
    }
    renderBrief();
    renderTestimony();
    renderSheet();
    renderAccuse();
    setVerdict('', '');
    refresh();
  }

  function renderBrief() {
    var C = state.C, S = C.S, ax = C.ax, box = $('caseBrief');
    box.innerHTML = '';
    var lines = [];
    lines.push(ucfirst(S.where) + '.');
    lines.push(WORDS[C.N] + ' people were there, one to a ' + ax.unit + ', ' + ax.along +
      ' and nowhere else. ' + ucfirst(S.missing) + '.');
    var ev = 'Whoever took it left the ' + C.telltale + ' on the floor of the ' + ax.unit +
      ' they were standing in, and that is the whole of the evidence.';
    if (catIndex(C.cats, 'hour') >= 0) {
      ev += ' No two clocks in the place agree with each other, which turns out to be useful.';
    }
    lines.push(ev);
    lines.push('Every statement below is true, and exactly one way of filling in the sheet ' +
      'satisfies all of them at once. The ' + ax.units + ' are listed in order, ' + ax.fromEnd +
      '. Work out the sheet, then name the thief.');
    for (var i = 0; i < lines.length; i++) {
      var p = document.createElement('p');
      if (i === 0) p.className = 'lead-line';
      p.textContent = lines[i];
      box.appendChild(p);
    }
  }

  function renderTestimony() {
    var C = state.C, ol = $('testimony');
    ol.innerHTML = '';
    for (var i = 0; i < C.clues.length; i++) {
      var li = document.createElement('li');
      li.textContent = C.clues[i].text;
      ol.appendChild(li);
    }
  }

  function th(text) { var e = document.createElement('th'); e.textContent = text; return e; }

  function renderSheet() {
    var C = state.C, wrap = $('sheet'), p, c, v;
    wrap.innerHTML = '';
    var tb = document.createElement('table');
    tb.className = 'sheet';
    var thead = document.createElement('thead'), hr = document.createElement('tr');
    hr.appendChild(th(C.ax.unitCap));
    for (c = 0; c < C.K; c++) hr.appendChild(th(C.cats[c].head));
    thead.appendChild(hr);
    tb.appendChild(thead);
    var tbody = document.createElement('tbody');
    for (p = 0; p < C.N; p++) {
      var tr = document.createElement('tr');
      var tdr = document.createElement('td');
      tdr.className = 'room';
      tdr.textContent = C.roomNames[p];
      tr.appendChild(tdr);
      for (c = 0; c < C.K; c++) {
        var td = document.createElement('td');
        var sel = document.createElement('select');
        sel.setAttribute('data-p', String(p));
        sel.setAttribute('data-c', String(c));
        sel.setAttribute('aria-label', C.cats[c].head + ' in ' + C.roomNames[p]);
        var blank = document.createElement('option');
        blank.value = '-1';
        blank.textContent = '—';
        sel.appendChild(blank);
        for (v = 0; v < C.N; v++) {
          var o = document.createElement('option');
          o.value = String(v);
          o.textContent = C.cats[c].values[v];
          sel.appendChild(o);
        }
        sel.value = String(state.grid[p][c]);
        td.appendChild(sel);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tb.appendChild(tbody);
    wrap.appendChild(tb);
  }

  function renderAccuse() {
    var C = state.C, box = $('accuse');
    box.innerHTML = '';
    var names = C.cats[C.personCat].values;
    for (var v = 0; v < names.length; v++) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = names[v];
      b.setAttribute('data-v', String(v));
      box.appendChild(b);
    }
  }

  function setVerdict(text, cls) {
    var el = $('verdict');
    el.textContent = text;
    el.className = 'verdict' + (cls ? ' ' + cls : '');
    el.style.display = text ? 'block' : 'none';
  }

  function refresh() {
    var C = state.C, K = C.K, N = C.N, c, v, p;
    var pos = [], cnt = [];
    for (c = 0; c < K; c++) {
      pos[c] = []; cnt[c] = [];
      for (v = 0; v < N; v++) { pos[c][v] = -1; cnt[c][v] = 0; }
    }
    var filled = 0;
    for (p = 0; p < N; p++) {
      for (c = 0; c < K; c++) {
        v = state.grid[p][c];
        if (v >= 0) { cnt[c][v]++; pos[c][v] = p; filled++; }
      }
    }

    var sels = $('sheet').getElementsByTagName('select'), dups = 0;
    for (var s = 0; s < sels.length; s++) {
      var sp = +sels[s].getAttribute('data-p'), sc = +sels[s].getAttribute('data-c');
      var sv = state.grid[sp][sc], td = sels[s].parentNode, cls = '';
      if (sv >= 0 && cnt[sc][sv] > 1) { cls = 'dup'; dups++; }
      else if (state.given[sp][sc]) cls = 'given';
      td.className = cls;
      sels[s].value = String(sv);
    }

    var lis = $('testimony').children, bad = 0;
    for (var i = 0; i < C.clues.length; i++) {
      var cl = C.clues[i], vals = [], undecided = false;
      for (var k = 0; k < cl.vars.length; k++) {
        var vc = cl.vars[k][0], vv = cl.vars[k][1];
        if (cnt[vc][vv] !== 1) { undecided = true; break; }
        vals.push(pos[vc][vv]);
      }
      var li = lis[i];
      li.classList.remove('bad');
      li.classList.remove('good');
      if (!undecided) {
        if (cl.test(vals)) li.classList.add('good');
        else { li.classList.add('bad'); bad++; }
      }
    }

    var total = N * K, txt;
    if (state.done) {
      txt = 'Case closed.';
    } else if (state.revealed) {
      txt = 'Answer shown.';
    } else if (filled === total && bad === 0 && dups === 0) {
      txt = 'Sheet complete and consistent — now name the thief';
    } else {
      txt = filled + ' of ' + total + ' filled';
      if (dups) txt += ' · two rows claiming the same thing';
      if (bad) txt += ' · ' + bad + (bad === 1 ? ' statement contradicted' : ' statements contradicted');
      else if (!dups) txt += ' · nothing contradicted yet';
    }
    var st = $('statusOut');
    st.textContent = txt;
    if (filled === total && bad === 0 && dups === 0) st.classList.add('done');
    else st.classList.remove('done');

    $('caseOut').textContent = String(C.seed).padStart(10, '0');
    $('cluesOut').textContent = C.clues.length + (C.proved ? ' · one solution, proved' : ' · unproved');
  }

  function fillTruth() {
    var C = state.C;
    for (var p = 0; p < C.N; p++) {
      for (var c = 0; c < C.K; c++) state.grid[p][c] = C.truthAt[c][p];
    }
  }

  function tally() {
    var bits2 = [];
    if (state.hints) bits2.push(state.hints + (state.hints === 1 ? ' hint' : ' hints'));
    if (state.wrong.length) bits2.push(state.wrong.length + (state.wrong.length === 1 ? ' wrong name' : ' wrong names'));
    return bits2.length ? 'Solved with ' + bits2.join(' and ') + '.' : 'Solved with no help at all.';
  }

  function accuse(v) {
    var C = state.C;
    if (state.done) return;
    if (v === C.culprit) {
      state.done = true;
      fillTruth();
      refresh();
      var name = C.cats[C.personCat].values[v];
      var rc = catIndex(C.cats, 'role');
      var roleTxt = rc >= 0 ? ', the ' + C.cats[rc].values[C.truthAt[rc][C.scenePos]] + ',' : '';
      setVerdict(name + roleTxt + ' in ' + C.roomNames[C.scenePos] + ', with the ' +
        C.telltale + ' on the floor. That is the only arrangement the statements allow. ' +
        tally(), 'right');
    } else {
      if (state.wrong.indexOf(v) < 0) state.wrong.push(v);
      setVerdict('Not ' + C.cats[C.personCat].values[v] + '. The ' + C.telltale +
        ' was not on the floor of that ' + C.ax.unit + '.', 'wrong');
      refresh();
    }
  }

  function hint() {
    var C = state.C, cands = [], p, c;
    if (state.done) return;
    for (p = 0; p < C.N; p++) {
      for (c = 0; c < C.K; c++) if (state.grid[p][c] !== C.truthAt[c][p]) cands.push([p, c]);
    }
    if (!cands.length) { setVerdict('The sheet is already right. Name the thief.', ''); return; }
    var empty = [];
    for (var i = 0; i < cands.length; i++) if (state.grid[cands[i][0]][cands[i][1]] < 0) empty.push(cands[i]);
    var use = empty.length ? empty : cands;
    var g = use[Math.floor(Math.random() * use.length)];
    state.grid[g[0]][g[1]] = C.truthAt[g[1]][g[0]];
    state.given[g[0]][g[1]] = true;
    state.hints++;
    refresh();
  }

  function reveal() {
    var C = state.C;
    if (state.done) return;
    state.revealed = true;
    fillTruth();
    refresh();
    setVerdict('It was ' + C.cats[C.personCat].values[C.culprit] + ', in ' +
      C.roomNames[C.scenePos] + '. The sheet above is the arrangement, and there was never another one.', '');
  }

  function clear() {
    var C = state.C;
    for (var p = 0; p < C.N; p++) {
      for (var c = 0; c < C.K; c++) { state.grid[p][c] = -1; state.given[p][c] = false; }
    }
    state.done = false; state.revealed = false; state.hints = 0; state.wrong = [];
    setVerdict('', '');
    refresh();
  }

  /* ---------- wiring ---------- */

  $('sheet').addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'SELECT') return;
    if (state.done) { refresh(); return; }
    var p = +t.getAttribute('data-p'), c = +t.getAttribute('data-c');
    state.grid[p][c] = parseInt(t.value, 10);
    state.given[p][c] = false;
    refresh();
  });

  $('testimony').addEventListener('click', function (e) {
    var li = e.target;
    while (li && li.tagName !== 'LI') li = li.parentNode;
    if (!li || li.parentNode !== $('testimony')) return;
    li.classList.toggle('struck');
  });

  $('accuse').addEventListener('click', function (e) {
    var b = e.target;
    if (!b || b.tagName !== 'BUTTON') return;
    accuse(+b.getAttribute('data-v'));
  });

  var chipBox = $('levels');
  for (var li2 = 0; li2 < LEVELS.length; li2++) {
    var ch = document.createElement('button');
    ch.className = 'chip' + (LEVELS[li2] === LEVEL ? ' on' : '');
    ch.type = 'button';
    ch.textContent = LEVELS[li2].label;
    ch.setAttribute('data-i', String(li2));
    chipBox.appendChild(ch);
  }
  chipBox.addEventListener('click', function (e) {
    var b = e.target;
    if (!b || b.tagName !== 'BUTTON') return;
    LEVEL = LEVELS[+b.getAttribute('data-i')];
    var kids = chipBox.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] === b) kids[i].classList.add('on');
      else kids[i].classList.remove('on');
    }
    deal(currentSeed);
  });

  function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }
  wire('btnNew', function () { deal((Math.random() * 4294967295) >>> 0); });
  wire('btnToday', function () { deal(seedForToday()); });
  wire('btnClear', clear);
  wire('btnHint', hint);
  wire('btnReveal', reveal);

  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key ? e.key.toLowerCase() : '';
    if (k === 'n') deal((Math.random() * 4294967295) >>> 0);
    else if (k === 't') deal(seedForToday());
    else if (k === 'h') hint();
  });

  deal(seedForToday());
})();
