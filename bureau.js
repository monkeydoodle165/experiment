/* drift.quibo.games — The Bureau
   Page twenty-one. An intercepted dispatch written and enciphered by today's
   number, and a desk to break it on.
   Self-contained. No dependencies. */
(function () {
  'use strict';

  /* ================= seeded PRNG ================= */
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
  function irnd(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffled(r, arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function li(c) { return c.charCodeAt(0) - 65; }
  function lc(i) { return String.fromCharCode(65 + i); }
  function letters(s) { return s.replace(/[^A-Z]/g, ''); }

  /* ================= the language of the desk ================= */
  var HEAD = ['ASH', 'BRACK', 'COLD', 'DUN', 'FEN', 'GRIM', 'HALE', 'IRON', 'KIRK',
    'LONG', 'MAR', 'NETHER', 'OLD', 'PEN', 'RAVEN', 'STAN', 'THORN', 'WEND', 'YAR',
    'BRAM', 'CALE', 'DOVE', 'ELM', 'GAR', 'HOLME', 'KELD', 'LANG', 'MEL', 'ORMS',
    'RUD', 'SEL', 'TARN', 'ULL', 'WICK', 'BARR', 'CRAN', 'DRUM', 'FOLD', 'HEST', 'MOR'];
  var TAIL = ['BRIDGE', 'FORD', 'WICK', 'THORPE', 'HAM', 'TON', 'FIELD', 'GATE',
    'MOOR', 'BANK', 'DALE', 'COMBE', 'CLIFF', 'HEAD', 'WORTH', 'STEAD', 'HURST',
    'MERE', 'ROW', 'CROSS', 'HILL', 'SIDE', 'PORT', 'MARCH', 'HOLT', 'STONE', 'WELL',
    'HAVEN', 'LEY', 'BURN', 'BECK', 'GARTH', 'SCAR', 'REACH', 'POOL'];
  var NAMES = ['HARDING', 'MERCER', 'ASHBY', 'COLLIER', 'DEANE', 'FENWICK', 'GRAYLING',
    'HOLLAND', 'IRVINE', 'KETTLE', 'LOWRIE', 'MARLOW', 'NORBURY', 'ORCHARD', 'PARRY',
    'QUINCE', 'REDMAN', 'SALTER', 'TREVENA', 'UNWIN', 'VANE', 'WEATHERALL', 'YOXALL',
    'BARROW', 'CHANDLER', 'DRUMMOND', 'ELVERS', 'GATTING', 'HULME', 'JARRETT'];
  var GOODS = ['FLOUR', 'ROPE', 'LAMP OIL', 'SALT', 'COAL', 'WIRE', 'CANVAS',
    'NAILS', 'BLANKETS', 'QUININE', 'TIMBER', 'SPIRIT', 'PAPER', 'CHARTS', 'BALLAST',
    'SLEEPERS', 'PITCH', 'CANDLES', 'SPARES', 'WINTER CLOTHING'];
  var FEATURE = ['HEAD', 'BAR', 'REACH', 'CUTTING', 'VIADUCT', 'MOOR', 'FERRY',
    'LOCK', 'QUAY', 'BRIDGE', 'PASS', 'CROSSING', 'ESTUARY', 'SANDS', 'RIDGE',
    'TUNNEL', 'LIGHT', 'JETTY'];
  var TIMEW = ['MIDNIGHT', 'NOON', 'FIRST LIGHT', 'THE TURN OF THE TIDE',
    'FOUR IN THE MORNING', 'DUSK', 'THE LATE WATCH', 'SIX SHARP'];
  var DAYW = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
    'SUNDAY', 'THE FIRST OF THE MONTH', 'QUARTER DAY'];
  var NUMW = ['TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'FIFTEEN', 'TWENTY', 'THIRTY', 'FORTY', 'A HUNDRED'];
  var ORDW = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'TENTH', 'TWELFTH'];
  var ADJW = ['AGROUND', 'OVERDUE', 'LOADED', 'EMPTY', 'HELD UP', 'IN HAND',
    'STILL MISSING', 'MADE FAST', 'UNDER REPAIR'];

  var POOLS = {
    supply: [
      'SEND {goods} AND {goods} BY THE {ord}',
      'WE ARE SHORT OF {goods} AGAIN',
      'THE {goods} DID NOT COME UP WITH THE {num} TRAIN',
      'NO MORE {goods} UNTIL {day}',
      'PUT THE {goods} UNDER COVER BEFORE {time}'
    ],
    movement: [
      '{num} WAGONS LEFT {place} AT {time}',
      'THE {name} PARTY HAS NOT REPORTED SINCE {day}',
      '{name} GOES DOWN TO {place} ON {day}',
      'THE BOAT FROM {place} IS {adj}',
      'WE MOVE EVERYTHING OFF THE {feature} BEFORE {day}'
    ],
    weather: [
      'FOG ON THE {feature} UNTIL {time}',
      'THE RIVER AT {place} IS STILL RISING',
      'WIND OFF THE {feature} ALL {day}',
      'SNOW ABOVE THE {feature} AND MORE COMING',
      'GLASS FALLING FAST SINCE {time}'
    ],
    warning: [
      'DO NOT USE THE {feature} ROAD AFTER DARK',
      'THE OLD KEY IS BURNED AND THE NEW ONE IS IN YOUR HAND',
      'TELL NOBODY AT {place} WHAT IS IN THIS',
      'IF I DO NOT WIRE BY {day} ASSUME THE WORST',
      'THEY ARE READING OUR TRAFFIC AT {place}'
    ],
    admin: [
      'REPLY BY THE USUAL HAND',
      'ACKNOWLEDGE ON RECEIPT',
      'THIS IS THE {ord} TIME OF ASKING',
      'COST TO BE PUT AGAINST THE {place} ACCOUNT',
      'BURN THIS AFTER YOU HAVE READ IT'
    ],
    people: [
      '{name} IS TO BE RELIEVED AT {place} ON {day}',
      'TELL {name} THAT THE {feature} WORK IS AGREED',
      '{name} WANTS {num} MORE HANDS BY {day}',
      'NOBODY HERE WILL SIGN FOR IT EXCEPT {name}'
    ]
  };

  var DESKS = [
    { name: 'the harbour office', pools: ['weather', 'movement', 'supply', 'admin'],
      about: 'harbour traffic and what the tide is doing to it' },
    { name: 'the northern survey', pools: ['weather', 'people', 'warning', 'supply'],
      about: 'a survey party three weeks overdue' },
    { name: 'the grain board', pools: ['supply', 'admin', 'movement', 'people'],
      about: 'who is being fed and who is not' },
    { name: 'a district engineer', pools: ['movement', 'people', 'supply', 'weather'],
      about: 'works on the line and the men doing them' },
    { name: 'the light service', pools: ['weather', 'warning', 'admin', 'supply'],
      about: 'lights, fog signals and the state of the sands' },
    { name: 'a border post', pools: ['warning', 'people', 'movement', 'admin'],
      about: 'who crossed, and when' }
  ];

  function placeName(r) { return pick(r, HEAD) + pick(r, TAIL); }

  function fill(r, tpl) {
    return tpl.replace(/\{(\w+)\}/g, function (_, k) {
      if (k === 'place') return placeName(r);
      if (k === 'name') return pick(r, NAMES);
      if (k === 'goods') return pick(r, GOODS);
      if (k === 'feature') return pick(r, FEATURE);
      if (k === 'time') return pick(r, TIMEW);
      if (k === 'day') return pick(r, DAYW);
      if (k === 'num') return pick(r, NUMW);
      if (k === 'ord') return pick(r, ORDW);
      if (k === 'adj') return pick(r, ADJW);
      return '';
    });
  }

  /* one dispatch: telegram English, capitals only, STOP between sentences */
  function dispatch(r) {
    var desk = pick(r, DESKS);
    var from = placeName(r);
    var lines = ['FROM ' + from + ' TO THE BUREAU'];
    var n = irnd(r, 6, 9);
    var used = {}, i, poolName, tpl, guard;
    for (i = 0; i < n; i++) {
      guard = 0;
      do {
        poolName = pick(r, desk.pools);
        tpl = pick(r, POOLS[poolName]);
        guard++;
      } while (used[tpl] && guard < 12);
      used[tpl] = 1;
      lines.push(fill(r, tpl));
    }
    lines.push('MESSAGE ENDS');
    return {
      desk: desk,
      from: from,
      lines: lines,
      plain: lines.join(' STOP ')
    };
  }

  /* ================= what English looks like here ================= */
  var MODEL = null;
  function model() {
    if (MODEL) return MODEL;
    var counts = new Float64Array(676);
    var uni = new Float64Array(26);
    var r = rng(0x5eedbeef), k, i, s, total = 0;
    for (k = 0; k < 260; k++) {
      s = letters(dispatch(r).plain);
      for (i = 0; i < s.length; i++) {
        uni[li(s[i])]++; total++;
        if (i) counts[li(s[i - 1]) * 26 + li(s[i])]++;
      }
    }
    var lp = new Float64Array(676), a, b, tot;
    for (a = 0; a < 26; a++) {
      tot = 0;
      for (b = 0; b < 26; b++) tot += counts[a * 26 + b] + 0.4;
      for (b = 0; b < 26; b++) lp[a * 26 + b] = Math.log((counts[a * 26 + b] + 0.4) / tot);
    }
    var freq = new Float64Array(26);
    for (a = 0; a < 26; a++) freq[a] = uni[a] / total;
    MODEL = { lp: lp, freq: freq };
    return MODEL;
  }

  function scoreNums(nums) {
    var lp = model().lp, s = 0, i;
    for (i = 1; i < nums.length; i++) s += lp[nums[i - 1] * 26 + nums[i]];
    return s / (nums.length - 1 || 1);
  }

  /* ================= the ciphers ================= */
  function keyedAlphabet(keyword, r) {
    var seen = {}, out = [], i, c;
    for (i = 0; i < keyword.length; i++) {
      c = keyword[i];
      if (c >= 'A' && c <= 'Z' && !seen[c]) { seen[c] = 1; out.push(c); }
    }
    /* fill the rest from a moving start, so it is not simply alphabetical */
    var start = irnd(r, 0, 25);
    for (i = 0; i < 26; i++) {
      c = lc((start + i) % 26);
      if (!seen[c]) { seen[c] = 1; out.push(c); }
    }
    return out.join('');
  }

  /* substitution: alpha[plainIndex] = cipher letter */
  function encSub(plain, alpha) {
    var out = '', i, c;
    for (i = 0; i < plain.length; i++) {
      c = plain[i];
      out += (c >= 'A' && c <= 'Z') ? alpha[li(c)] : c;
    }
    return out;
  }

  /* vigenere / beaufort over letters only */
  function encPoly(plainLetters, key, beaufort) {
    var out = '', i, p, k;
    for (i = 0; i < plainLetters.length; i++) {
      p = li(plainLetters[i]);
      k = li(key[i % key.length]);
      out += lc(beaufort ? ((k - p) % 26 + 26) % 26 : (p + k) % 26);
    }
    return out;
  }
  function decPoly(ct, key, beaufort) {
    var out = '', i, c, k;
    for (i = 0; i < ct.length; i++) {
      c = li(ct[i]);
      k = li(key[i % key.length]);
      out += lc(beaufort ? ((k - c) % 26 + 26) % 26 : ((c - k) % 26 + 26) % 26);
    }
    return out;
  }

  /* ================= breaking it ================= */
  /* simple substitution: hill climbing on bigram fit, several restarts */
  function crackSub(ctLetters, restarts) {
    var m = model(), lp = m.lp;
    var n = ctLetters.length;
    var ct = new Int32Array(n), i;
    for (i = 0; i < n; i++) ct[i] = li(ctLetters[i]);

    var cnt = new Float64Array(26);
    for (i = 0; i < n; i++) cnt[ct[i]]++;
    var byFreqC = [], byFreqP = [];
    for (i = 0; i < 26; i++) { byFreqC.push(i); byFreqP.push(i); }
    byFreqC.sort(function (a, b) { return cnt[b] - cnt[a]; });
    byFreqP.sort(function (a, b) { return m.freq[b] - m.freq[a]; });

    var work = new Int32Array(n);
    function sc(key) {
      var s = 0, j;
      for (j = 0; j < n; j++) work[j] = key[ct[j]];
      for (j = 1; j < n; j++) s += lp[work[j - 1] * 26 + work[j]];
      return s;
    }

    var r = rng((0xc0ffee ^ n) >>> 0), best = null, bestS = -Infinity, t;
    restarts = restarts || 18;
    for (t = 0; t < restarts; t++) {
      var key = new Int32Array(26);
      if (t === 0) {
        for (i = 0; i < 26; i++) key[byFreqC[i]] = byFreqP[i];
      } else {
        var perm = shuffled(r, byFreqP.slice());
        for (i = 0; i < 26; i++) key[byFreqC[i]] = perm[i];
      }
      var cur = sc(key), improved = true, a, b, tmp, s2;
      while (improved) {
        improved = false;
        for (a = 0; a < 25; a++) {
          for (b = a + 1; b < 26; b++) {
            tmp = key[a]; key[a] = key[b]; key[b] = tmp;
            s2 = sc(key);
            if (s2 > cur) { cur = s2; improved = true; }
            else { tmp = key[a]; key[a] = key[b]; key[b] = tmp; }
          }
        }
      }
      if (cur > bestS) { bestS = cur; best = new Int32Array(key); }
    }
    return best;
  }

  /* periodic ciphers: coincidence counting for the period, then column by column */
  function icFor(ct, p) {
    var total = 0, groups = 0, i, j;
    for (i = 0; i < p; i++) {
      var c = new Float64Array(26), n = 0;
      for (j = i; j < ct.length; j += p) { c[li(ct[j])]++; n++; }
      if (n < 2) continue;
      var s = 0;
      for (j = 0; j < 26; j++) s += c[j] * (c[j] - 1);
      total += s / (n * (n - 1));
      groups++;
    }
    return groups ? total / groups : 0;
  }

  function crackPoly(ct, beaufort, maxPeriod) {
    var m = model(), best = { p: 1, ic: -1 }, p;
    for (p = 1; p <= (maxPeriod || 12); p++) {
      var ic = icFor(ct, p);
      /* prefer the shortest period that gets close to English */
      if (ic > best.ic + 0.004) best = { p: p, ic: ic };
    }
    var period = best.p, key = '', i, j;
    for (i = 0; i < period; i++) {
      var bestK = 0, bestFit = -Infinity, k;
      for (k = 0; k < 26; k++) {
        var fit = 0;
        for (j = i; j < ct.length; j += period) {
          var c = li(ct[j]);
          var pl = beaufort ? ((k - c) % 26 + 26) % 26 : ((c - k) % 26 + 26) % 26;
          fit += Math.log(m.freq[pl] + 1e-6);
        }
        if (fit > bestFit) { bestFit = fit; bestK = k; }
      }
      key += lc(bestK);
    }
    return { key: key, period: period, ic: best.ic };
  }

  /* ================= building today's intercept ================= */
  var SYSTEMS = {
    sub: { label: 'a simple substitution' },
    vig: { label: 'a Vigenere' },
    bft: { label: 'a Beaufort' }
  };

  function buildIntercept(seed) {
    var r = rng(seed);
    var d = dispatch(r);
    var plain = d.plain;
    var pl = letters(plain);

    var roll = r();
    var sys = roll < 0.44 ? 'sub' : (roll < 0.78 ? 'vig' : 'bft');
    var keepWords = sys === 'sub' ? (r() < 0.7) : false;

    var out = { seed: seed, sys: sys, dispatch: d, plain: plain, plainLetters: pl,
      keepWords: keepWords };

    var t0 = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    if (sys === 'sub') {
      var kw = pick(r, ['NIGHTFALL', 'QUARTERMASTER', 'BLACKWATER', 'FOGHORN',
        'KINGFISHER', 'STORMGLASS', 'LAMPLIGHT', 'WHITETHORN', 'SALTMARSH',
        'COPPERWORKS', 'MIDWINTER', 'BRIGANTINE', 'CROSSWIND', 'HALFMOON']);
      var alpha = keyedAlphabet(kw, r);
      out.keyword = kw;
      out.alpha = alpha;
      out.answer = new Array(26);              /* answer[cipher] = plain */
      for (var i = 0; i < 26; i++) out.answer[li(alpha[i])] = lc(i);
      out.cipherText = encSub(plain, alpha);
      out.cipherLetters = letters(out.cipherText);
      var got = crackSub(out.cipherLetters, 16);
      var hit = 0, dec = '';
      for (var j = 0; j < out.cipherLetters.length; j++) {
        var ch = lc(got[li(out.cipherLetters[j])]);
        dec += ch;
        if (ch === pl[j]) hit++;
      }
      out.machine = { accuracy: hit / pl.length, key: got, text: dec };
      out.slotCount = 26;
    } else {
      var kwords = ['HERON', 'SPINDLE', 'TALLOW', 'MARLIN', 'GANTRY', 'PLOVER',
        'CISTERN', 'BRACKEN', 'FURLONG', 'KESTREL', 'WINDLASS', 'CAPSTAN',
        'THIMBLE', 'GUNWALE', 'RAMPART'];
      var key = pick(r, kwords);
      out.key = key;
      out.answer = key.split('');
      out.cipherLetters = encPoly(pl, key, sys === 'bft');
      out.cipherText = out.cipherLetters;
      var res = crackPoly(out.cipherLetters, sys === 'bft', 12);
      var dec2 = decPoly(out.cipherLetters, res.key, sys === 'bft');
      var hit2 = 0;
      for (var q = 0; q < dec2.length; q++) if (dec2[q] === pl[q]) hit2++;
      out.machine = { accuracy: hit2 / pl.length, key: res.key, period: res.period,
        ic: res.ic, text: dec2 };
      out.slotCount = key.length;
    }

    var t1 = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    out.machine.ms = Math.max(1, Math.round(t1 - t0));

    /* baselines for the "reads as English" gauge */
    var nums = [], z;
    for (z = 0; z < pl.length; z++) nums.push(li(pl[z]));
    out.trueScore = scoreNums(nums);
    var cnums = [], y;
    for (y = 0; y < out.cipherLetters.length; y++) cnums.push(li(out.cipherLetters[y]));
    out.nullScore = scoreNums(cnums);
    return out;
  }

  /* keep dealing until the desk's own attack gets most of it back */
  function interceptFrom(seed, tries) {
    var s = seed >>> 0, best = null, n = 0;
    tries = tries || 5;
    while (n < tries) {
      var cand = buildIntercept(s);
      cand.deals = n + 1;
      if (!best || cand.machine.accuracy > best.machine.accuracy) {
        best = cand;
        best.deals = n + 1;
      }
      if (cand.machine.accuracy >= 0.95) return cand;
      s = Math.imul(s ^ 0x9e3779b9, 2246822507) >>> 0;
      n++;
    }
    return best;
  }

  if (typeof window === 'undefined') {
    module.exports = { interceptFrom: interceptFrom, buildIntercept: buildIntercept,
      dispatch: dispatch, rng: rng, decPoly: decPoly, model: model,
      seedForToday: seedForToday };
    return;
  }

  /* ================= the desk ================= */
  var el = function (id) { return document.getElementById(id); };
  var ctOut = el('ctOut'), slotsOut = el('slotsOut'), briefOut = el('briefOut'),
      verdict = el('verdict'), noteOut = el('noteOut');

  var S = {
    puz: null, guess: [], sel: 0, nudges: 0, machineUsed: false,
    started: 0, elapsed: 0, solved: false, cells: [], tiles: []
  };

  function slotOfIndex(i) {
    if (S.puz.sys === 'sub') return li(S.puz.cipherLetters[i]);
    return i % S.puz.slotCount;
  }

  function plainAt(i) {
    var c = S.puz.cipherLetters[i];
    if (S.puz.sys === 'sub') return S.guess[li(c)] || '';
    var k = S.guess[i % S.puz.slotCount];
    if (!k) return '';
    var ci = li(c), ki = li(k);
    return lc(S.puz.sys === 'bft' ? ((ki - ci) % 26 + 26) % 26 : ((ci - ki) % 26 + 26) % 26);
  }

  function readout() {
    var s = '', i;
    for (i = 0; i < S.puz.cipherLetters.length; i++) s += plainAt(i) || '.';
    return s;
  }

  /* ---------- rendering ---------- */
  function buildCells() {
    ctOut.innerHTML = '';
    S.cells = [];
    var p = S.puz, i = 0, frag = document.createDocumentFragment();

    function cell(idx) {
      var sp = document.createElement('span');
      sp.className = 'cell';
      sp.setAttribute('data-i', idx);
      var b = document.createElement('b'); b.textContent = p.cipherLetters[idx];
      var em = document.createElement('i'); em.textContent = '·';
      sp.appendChild(b); sp.appendChild(em);
      S.cells.push({ node: sp, ink: em, i: idx });
      return sp;
    }

    if (p.keepWords) {
      var words = p.cipherText.split(/\s+/), w, j;
      for (w = 0; w < words.length; w++) {
        if (!words[w]) continue;
        var g = document.createElement('span');
        g.className = 'grp';
        for (j = 0; j < words[w].length; j++) g.appendChild(cell(i++));
        frag.appendChild(g);
      }
    } else {
      var total = p.cipherLetters.length, k;
      while (i < total) {
        var gg = document.createElement('span');
        gg.className = 'grp';
        for (k = 0; k < 5 && i < total; k++) gg.appendChild(cell(i++));
        frag.appendChild(gg);
      }
    }
    ctOut.appendChild(frag);
  }

  function buildTiles() {
    slotsOut.innerHTML = '';
    S.tiles = [];
    var p = S.puz, i, frag = document.createDocumentFragment();

    if (p.sys === 'sub') {
      var cnt = new Array(26), order = [];
      for (i = 0; i < 26; i++) { cnt[i] = 0; order.push(i); }
      for (i = 0; i < p.cipherLetters.length; i++) cnt[li(p.cipherLetters[i])]++;
      order.sort(function (a, b) { return cnt[b] - cnt[a] || a - b; });
      var max = cnt[order[0]] || 1;
      for (i = 0; i < 26; i++) {
        var s = order[i];
        var t = document.createElement('button');
        t.className = 'tile';
        t.type = 'button';
        t.setAttribute('data-slot', s);
        t.innerHTML = '<u>' + lc(s) + '</u><i></i>' +
          '<em class="bar"><span style="width:' + Math.round(100 * cnt[s] / max) +
          '%"></span></em><small>' + cnt[s] + '</small>';
        S.tiles.push({ node: t, ink: t.querySelector('i'), slot: s });
        frag.appendChild(t);
      }
    } else {
      for (i = 0; i < p.slotCount; i++) {
        var tv = document.createElement('button');
        tv.className = 'tile key';
        tv.type = 'button';
        tv.setAttribute('data-slot', i);
        tv.innerHTML = '<u>' + (i + 1) + '</u><i></i><small>letter ' + (i + 1) +
          ' of the key</small>';
        S.tiles.push({ node: tv, ink: tv.querySelector('i'), slot: i });
        frag.appendChild(tv);
      }
    }
    slotsOut.appendChild(frag);
  }

  function clashes() {
    if (S.puz.sys !== 'sub') return {};
    var seen = {}, bad = {}, i, v;
    for (i = 0; i < 26; i++) {
      v = S.guess[i];
      if (!v) continue;
      if (seen[v] !== undefined) { bad[i] = 1; bad[seen[v]] = 1; }
      else seen[v] = i;
    }
    return bad;
  }

  function paint() {
    var p = S.puz, i, k;
    for (i = 0; i < S.cells.length; i++) {
      var g = plainAt(S.cells[i].i);
      S.cells[i].ink.textContent = g || '·';
      S.cells[i].node.className = 'cell' + (g ? ' got' : '') +
        (slotOfIndex(S.cells[i].i) === S.sel ? ' sel' : '');
    }
    var bad = clashes(), settled = 0;
    for (k = 0; k < S.tiles.length; k++) {
      var t = S.tiles[k];
      t.ink.textContent = S.guess[t.slot] || '';
      if (S.guess[t.slot]) settled++;
      t.node.className = 'tile' + (p.sys === 'sub' ? '' : ' key') +
        (S.guess[t.slot] ? ' filled' : '') +
        (bad[t.slot] ? ' clash' : '') +
        (t.slot === S.sel ? ' sel' : '');
    }

    el('settledOut').textContent = settled + '/' + (p.sys === 'sub' ? 26 : p.slotCount);
    el('nudgeOut').textContent = String(S.nudges);

    var nums = [], r = readout();
    for (i = 0; i < r.length; i++) nums.push(r[i] === '.' ? -1 : li(r[i]));
    var lp = model().lp, s = 0, n = 0;
    for (i = 1; i < nums.length; i++) {
      if (nums[i] < 0 || nums[i - 1] < 0) continue;
      s += lp[nums[i - 1] * 26 + nums[i]]; n++;
    }
    var pct = 0;
    if (n > 4) {
      var avg = s / n;
      pct = Math.round(100 * (avg - p.nullScore) / ((p.trueScore - p.nullScore) || 1));
      pct = Math.max(0, Math.min(100, pct));
    }
    el('fitOut').textContent = n > 4 ? pct + '%' : '—';
    el('fitBar').style.width = pct + '%';

    checkSolved();
  }

  function checkSolved() {
    if (S.solved) return;
    if (readout() !== S.puz.plainLetters) return;
    S.solved = true;
    stopClock();
    var p = S.puz;
    var body = p.dispatch.lines.map(function (l) {
      return '<span class="wire">' + l + '</span>';
    }).join('');
    var keyLine = p.sys === 'sub'
      ? 'Their alphabet was cut from the word <b>' + p.keyword + '</b>.'
      : 'Their key was <b>' + p.key + '</b>, ' + p.key.length + ' letters long.';
    var help = S.nudges
      ? 'You took ' + S.nudges + ' letter' + (S.nudges === 1 ? '' : 's') + ' off the desk' +
        (S.machineUsed ? ', and let the machine have a go' : '') + '.'
      : (S.machineUsed ? 'The machine did the first reading.' : 'No help taken.');
    verdict.className = 'verdict right';
    verdict.innerHTML = '<p><b>Broken.</b> ' + keyLine + ' ' + help + ' ' +
      fmtClock(S.elapsed) + ' on the clock.</p><div class="wireout">' + body + '</div>';
    verdict.style.display = 'block';
    note('That is the whole dispatch.');
  }

  /* ---------- interaction ---------- */
  var noteTimer = null;
  function note(msg) {
    noteOut.textContent = msg;
    noteOut.style.opacity = msg ? '1' : '0';
    if (noteTimer) clearTimeout(noteTimer);
    if (msg) noteTimer = setTimeout(function () { noteOut.style.opacity = '0'; }, 3200);
  }

  function select(slot) { S.sel = slot; paint(); }

  function assign(slot, letter) {
    if (S.solved) return;
    startClock();
    S.guess[slot] = letter;
    paint();
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!S.puz) return;
    var k = e.key, m = S.puz.sys === 'sub' ? 26 : S.puz.slotCount;
    if (!k) return;
    if (k.length === 1 && /[a-zA-Z]/.test(k)) {
      assign(S.sel, k.toUpperCase());
      e.preventDefault();
      if (S.puz.sys !== 'sub') select((S.sel + 1) % m);
      return;
    }
    if (k === 'Backspace' || k === 'Delete') { assign(S.sel, ''); e.preventDefault(); return; }
    if (k === 'ArrowRight' || k === 'ArrowDown') { select((S.sel + 1) % m); e.preventDefault(); }
    if (k === 'ArrowLeft' || k === 'ArrowUp') { select((S.sel + m - 1) % m); e.preventDefault(); }
  }

  /* ---------- the clock ---------- */
  var tick = null;
  function fmtClock(ms) {
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function startClock() {
    if (S.started || S.solved) return;
    S.started = Date.now();
    tick = setInterval(function () {
      S.elapsed = Date.now() - S.started;
      el('clockOut').textContent = fmtClock(S.elapsed);
    }, 1000);
  }
  function stopClock() {
    if (tick) { clearInterval(tick); tick = null; }
    S.elapsed = S.started ? Date.now() - S.started : 0;
    el('clockOut').textContent = fmtClock(S.elapsed);
  }

  /* ---------- help from the desk ---------- */
  function nudge() {
    if (S.solved) return;
    startClock();
    var p = S.puz, i, wrong = [], live = {};
    var scope = p.sys === 'sub' ? 26 : p.slotCount;
    if (p.sys === 'sub') {
      for (i = 0; i < p.cipherLetters.length; i++) live[li(p.cipherLetters[i])] = 1;
    } else {
      for (i = 0; i < scope; i++) live[i] = 1;
    }
    var counts = new Array(scope), j;
    for (j = 0; j < scope; j++) counts[j] = 0;
    for (j = 0; j < p.cipherLetters.length; j++) counts[slotOfIndex(j)]++;
    for (i = 0; i < scope; i++) {
      if (!live[i]) continue;
      if (S.guess[i] !== p.answer[i]) wrong.push(i);
    }
    if (!wrong.length) { note('Nothing left to give you.'); return; }
    wrong.sort(function (a, b) { return counts[b] - counts[a]; });
    var target = wrong[0];
    S.nudges++;
    S.guess[target] = p.answer[target];
    select(target);
    note(p.sys === 'sub'
      ? lc(target) + ' stands for ' + p.answer[target] + '.'
      : 'Letter ' + (target + 1) + ' of the key is ' + p.answer[target] + '.');
  }

  var machineTimer = null;
  function machine() {
    if (S.solved || machineTimer) return;
    startClock();
    S.machineUsed = true;
    var p = S.puz, guessed = [], i;
    if (p.sys === 'sub') {
      for (i = 0; i < 26; i++) guessed[i] = lc(p.machine.key[i]);
    } else {
      for (i = 0; i < p.slotCount; i++) guessed[i] = p.machine.key[i % p.machine.key.length] || '';
    }
    var step = 0;
    note('The desk is running its own attack.');
    machineTimer = setInterval(function () {
      if (step >= guessed.length) {
        clearInterval(machineTimer); machineTimer = null;
        note(S.solved
          ? 'The machine read the whole thing. There is no sport in that.'
          : 'That is as far as the machine gets — ' +
            Math.round(p.machine.accuracy * 100) +
            ' per cent of the letters. The rest is yours.');
        return;
      }
      S.guess[step] = guessed[step];
      step++;
      paint();
    }, 60);
  }

  function clearSheet() {
    if (S.solved) return;
    if (machineTimer) { clearInterval(machineTimer); machineTimer = null; }
    S.guess = [];
    paint();
    note('Sheet cleared.');
  }

  /* ---------- the brief ---------- */
  var WHEN = ['a wet Tuesday in the eighteen nineties', 'the first week of a bad winter',
    'the night before a strike', 'a morning of dead calm', 'the end of a long quarter',
    'the third week of the shutdown'];

  function fillBrief() {
    var p = S.puz, r = rng((p.seed ^ 0x51ce) >>> 0);
    var d = new Date();
    var when = pick(r, WHEN);
    var lenNote = p.sys === 'sub'
      ? 'One cipher letter for each plain one, the same the whole way through.'
      : 'The shift walks along a repeating key, so the same plain letter comes out ' +
        'differently depending on where it falls.';
    var spacing = p.keepWords
      ? 'The operator left the word divisions in, which was careless of them.'
      : 'The word divisions have been stripped out and it has been sent in fives.';
    briefOut.innerHTML =
      '<p class="lead-line">Intercept ' + d.getFullYear() + '/' + (p.seed % 1000) +
        ' — ' + p.dispatch.desk.name + ', on ' + when + '.</p>' +
      '<p>Traffic off this circuit is usually about ' + p.dispatch.desk.about + '. ' +
        p.cipherLetters.length + ' letters. The analyst says it is <b>' +
        SYSTEMS[p.sys].label + '</b>' +
        (p.sys === 'sub' ? '' : ' with a key of <b>' + p.slotCount + '</b> letters') +
        '. ' + lenNote + ' ' + spacing + '</p>' +
      '<p>Two things are known about this circuit from older traffic: every dispatch ' +
        'opens <b>FROM</b> somewhere <b>TO THE BUREAU</b>, and every one closes ' +
        '<b>MESSAGE ENDS</b>. Sentences are divided by <b>STOP</b>. That is your way in.</p>' +
      '<p class="dimline">Before any of this was put in front of you the desk ran its own ' +
        'attack on it — bigram hill climbing for a substitution, coincidence counting ' +
        'for a periodic key — and recovered <b>' +
        Math.round(p.machine.accuracy * 100) + ' per cent</b> of the letters in <b>' +
        p.machine.ms + ' milliseconds</b>' +
        (p.deals > 1 ? ', after throwing out ' + (p.deals - 1) + ' message' +
          (p.deals === 2 ? '' : 's') + ' it could not get into' : '') +
        '. It is breakable. That is the only promise made here.</p>';

    el('sysOut').textContent = p.sys === 'sub' ? 'Substitution'
      : (p.sys === 'vig' ? 'Vigenere' : 'Beaufort');
    el('lenOut').textContent = p.cipherLetters.length;
  }

  /* ---------- wiring ---------- */
  function load(seed) {
    S.puz = interceptFrom(seed, 5);
    S.guess = [];
    S.sel = 0;
    S.nudges = 0;
    S.machineUsed = false;
    S.solved = false;
    S.started = 0;
    S.elapsed = 0;
    if (tick) { clearInterval(tick); tick = null; }
    if (machineTimer) { clearInterval(machineTimer); machineTimer = null; }
    el('clockOut').textContent = '0:00';
    verdict.style.display = 'none';
    verdict.className = 'verdict';
    fillBrief();
    buildCells();
    buildTiles();
    paint();
    note('');
  }

  ctOut.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== ctOut && !(t.getAttribute && t.getAttribute('data-i'))) t = t.parentNode;
    if (!t || t === ctOut || !t.getAttribute) return;
    select(slotOfIndex(parseInt(t.getAttribute('data-i'), 10)));
  });
  slotsOut.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== slotsOut && !(t.getAttribute && t.getAttribute('data-slot'))) t = t.parentNode;
    if (!t || t === slotsOut || !t.getAttribute) return;
    select(parseInt(t.getAttribute('data-slot'), 10));
  });
  document.addEventListener('keydown', onKey);

  el('btnNudge').addEventListener('click', nudge);
  el('btnMachine').addEventListener('click', machine);
  el('btnClear').addEventListener('click', clearSheet);
  el('btnNew').addEventListener('click', function () {
    load((Math.random() * 4294967296) >>> 0);
    note('A different circuit, a different day.');
  });
  el('btnToday').addEventListener('click', function () {
    load(seedForToday());
    note('Back to the intercept of the day.');
  });

  load(seedForToday());
})();
