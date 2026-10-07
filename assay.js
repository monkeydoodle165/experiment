/* drift.quibo.games — The Assay
   Chemistry. The day's number floods the cellar of an old dispensing chemist's, washes the
   labels off four bottles on one shelf, and leaves the stock book that says what ought to be
   there: seven salts, four of them in the bottles and three long since sold. Each bottle holds
   enough for four tests. You have the bench reagents of a school laboratory (a flame, sodium
   hydroxide, ammonia, acid and limewater, silver nitrate, barium chloride, aluminium foil) and
   the bench card that says what each ion does with them. Spend the portions, read the tubes,
   write the labels. The page grades every label, works out the shortest set of tests that would
   have pinned each bottle against the stock book, and says which of your own observations a
   wrong label contradicts. Self-contained. */
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
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
  var $ = function (id) { return document.getElementById(id); };

  var BOTTLES = 4, DECOYS = 3, PORTIONS = 4;
  var LETTERS = ['A', 'B', 'C', 'D'];

  /* ---------- the ions ---------- */
  // sol: colour of a dilute solution (null = colourless); flame: [name, css colour] or null
  var CATIONS = {
    Li: { sym: 'Li', ch: 1, name: 'lithium', sol: null, flame: ['crimson', '#e3264f'] },
    Na: { sym: 'Na', ch: 1, name: 'sodium', sol: null, flame: ['yellow-orange', '#ffb21f'] },
    K: { sym: 'K', ch: 1, name: 'potassium', sol: null, flame: ['lilac', '#c49bff'] },
    NH4: { sym: 'NH<sub>4</sub>', ch: 1, name: 'ammonium', sol: null, flame: null, poly: true },
    Ca: { sym: 'Ca', ch: 2, name: 'calcium', sol: null, flame: ['brick red', '#ec5a2c'] },
    Ba: { sym: 'Ba', ch: 2, name: 'barium', sol: null, flame: ['apple green', '#a6e55c'] },
    Mg: { sym: 'Mg', ch: 2, name: 'magnesium', sol: null, flame: null },
    Cu: { sym: 'Cu', ch: 2, name: 'copper(II)', sol: ['blue', '#4f9be8'], flame: ['blue-green', '#2fd6b4'] },
    Fe2: { sym: 'Fe', ch: 2, name: 'iron(II)', sol: ['pale green', '#a9d68c'], flame: null },
    Fe3: { sym: 'Fe', ch: 3, name: 'iron(III)', sol: ['yellow-brown', '#d89a3c'], flame: null },
    Zn: { sym: 'Zn', ch: 2, name: 'zinc', sol: null, flame: null },
    Al: { sym: 'Al', ch: 3, name: 'aluminium', sol: null, flame: null }
  };
  var ANIONS = {
    Cl: { sym: 'Cl', ch: 1, name: 'chloride' },
    Br: { sym: 'Br', ch: 1, name: 'bromide' },
    I: { sym: 'I', ch: 1, name: 'iodide' },
    SO4: { sym: 'SO<sub>4</sub>', ch: 2, name: 'sulfate', poly: true },
    CO3: { sym: 'CO<sub>3</sub>', ch: 2, name: 'carbonate', poly: true },
    NO3: { sym: 'NO<sub>3</sub>', ch: 1, name: 'nitrate', poly: true }
  };
  // salts that would not sit dissolved in a bottle are left off the shelf
  function soluble(c, a) {
    if (a === 'CO3') return c === 'Na' || c === 'K' || c === 'NH4';
    if (a === 'SO4') return c !== 'Ba' && c !== 'Ca';
    if (a === 'I') return c !== 'Cu' && c !== 'Fe3';
    return true;
  }
  var ALL = [];
  Object.keys(CATIONS).forEach(function (c) { Object.keys(ANIONS).forEach(function (a) { if (soluble(c, a)) ALL.push({ c: c, a: a }); }); });

  function gcd(x, y) { return y ? gcd(y, x % y) : x; }
  function formula(s) {
    var C = CATIONS[s.c], A = ANIONS[s.a], g = gcd(C.ch, A.ch);
    var nc = A.ch / g, na = C.ch / g;
    function part(X, n) { if (n === 1) return X.sym; return (X.poly ? '(' + X.sym + ')' : X.sym) + '<sub>' + n + '</sub>'; }
    return part(C, nc) + part(A, na);
  }
  function saltName(s) { return CATIONS[s.c].name + ' ' + ANIONS[s.a].name; }
  var USES = {
    'Cu SO4': 'bluestone, for the vine growers and to dress seed corn',
    'Mg SO4': 'Epsom salts, a purge',
    'Na SO4': 'Glauber’s salt, a stronger purge',
    'NH4 Cl': 'sal ammoniac, for the tinsmith’s soldering',
    'NH4 CO3': 'sal volatile, for smelling salts',
    'NH4 NO3': 'for making laughing gas for the dentist',
    'Na CO3': 'washing soda',
    'K CO3': 'pearl ash, for soap and glass',
    'K NO3': 'saltpetre, for curing hams',
    'Na NO3': 'Chile saltpetre, for the market gardens',
    'K I': 'to make up tincture of iodine',
    'K Br': 'bromide, a sedative',
    'Na Br': 'bromide, a sedative',
    'Li Br': 'bromide of lithia, a sedative',
    'Na Cl': 'common salt, for saline',
    'Zn SO4': 'white vitriol, for eye lotions',
    'Zn Cl': 'Burnett’s fluid, a disinfectant',
    'Fe2 SO4': 'green vitriol, for ink and iron tonic',
    'Fe3 Cl': 'perchloride of iron, a styptic',
    'Al SO4': 'for sizing paper and clearing water',
    'Ba NO3': 'green fire, for the Guy Fawkes trade',
    'Ba Cl': 'a bench reagent',
    'Ca Cl': 'for drying gases',
    'K SO4': 'potash for the glasshouses',
    'Ca NO3': 'nitrate of lime, for the glasshouses',
    'Mg Cl': 'for the photographer'
  };
  function saltUse(s) { return USES[s.c + ' ' + s.a] || 'stock for the reagent shelf'; }

  /* ---------- the tests ---------- */
  var TESTS = [
    { key: 'flame', name: 'Flame test', short: 'Flame', how: 'A nichrome loop, cleaned in acid, dipped in the sample and held in the edge of a roaring Bunsen flame.' },
    { key: 'naoh', name: 'Sodium hydroxide', short: 'NaOH', how: 'A few drops of dilute sodium hydroxide, then more, in excess.' },
    { key: 'nh3', name: 'Aqueous ammonia', short: 'NH₃', how: 'A few drops of dilute ammonia solution, then more, in excess.' },
    { key: 'warm', name: 'Warm with alkali', short: 'Warm', how: 'Warmed with sodium hydroxide, a strip of damp red litmus held at the mouth of the tube.' },
    { key: 'acid', name: 'Acid and limewater', short: 'HCl', how: 'Dilute hydrochloric acid added; any gas bubbled through limewater.' },
    { key: 'silver', name: 'Silver nitrate', short: 'AgNO₃', how: 'Acidified with dilute nitric acid, then a few drops of silver nitrate.' },
    { key: 'barium', name: 'Barium chloride', short: 'BaCl₂', how: 'Acidified with dilute hydrochloric acid, then a few drops of barium chloride.' },
    { key: 'devarda', name: 'Aluminium and alkali', short: 'Al', how: 'Warmed with sodium hydroxide until no more ammonia comes off, then a piece of aluminium foil added and warmed again, damp red litmus at the mouth.' }
  ];
  var TEST_BY = {}; TESTS.forEach(function (t, i) { TEST_BY[t.key] = i; });

  // hydroxide precipitates: [colour name, css], whether they dissolve in excess
  var HYD = {
    Cu: { naoh: ['blue', '#3f7fdc', false], nh3: ['pale blue', '#7fb2ec', 'deep'] },
    Fe2: { naoh: ['dirty green', '#5b7440', false], nh3: ['dirty green', '#5b7440', false] },
    Fe3: { naoh: ['red-brown', '#8e3e16', false], nh3: ['red-brown', '#8e3e16', false] },
    Zn: { naoh: ['white', '#eef0f2', true], nh3: ['white', '#eef0f2', true] },
    Al: { naoh: ['white', '#eef0f2', true], nh3: ['white', '#eef0f2', false] },
    Mg: { naoh: ['white', '#eef0f2', false], nh3: ['white', '#eef0f2', false] },
    Ca: { naoh: ['white', '#eef0f2', false], nh3: null }
  };

  // what the bench sees. `sig` is the outcome code used for deduction; the rest is for drawing.
  function observe(s, key) {
    var C = CATIONS[s.c], o = { sig: 'none', text: '', ppt: null, dissolve: false, deep: false, bubbles: false, litmus: null, lime: null, flame: null };
    var h;
    switch (key) {
      case 'flame':
        if (C.flame) { o.sig = C.flame[0]; o.flame = C.flame[1]; o.text = 'The flame turns ' + C.flame[0] + '.'; }
        else { o.flame = null; o.text = 'No characteristic colour. The flame stays blue.'; }
        break;
      case 'naoh':
      case 'nh3':
        h = HYD[s.c] && HYD[s.c][key];
        if (!h) { o.text = 'No precipitate, even in excess.'; break; }
        o.ppt = h[1];
        if (h[2] === 'deep') { o.sig = h[0] + ' ppt, dissolves deep blue'; o.dissolve = true; o.deep = true; o.text = 'A ' + h[0] + ' precipitate, which dissolves in excess to a deep blue solution.'; }
        else if (h[2]) { o.sig = h[0] + ' ppt, dissolves'; o.dissolve = true; o.text = 'A ' + h[0] + ' precipitate, which dissolves in excess to a colourless solution.'; }
        else { o.sig = h[0] + ' ppt, stays'; o.text = 'A ' + h[0] + ' precipitate. It does not dissolve in excess.' + (s.c === 'Fe2' ? ' The top turns brown on standing.' : ''); }
        break;
      case 'warm':
        h = HYD[s.c] && HYD[s.c].naoh;
        if (h) { o.ppt = h[1]; o.dissolve = !!h[2]; }
        if (s.c === 'NH4') { o.sig = 'ammonia'; o.litmus = 'blue'; o.text = 'A sharp smell of ammonia. The damp red litmus turns blue.'; }
        else { o.litmus = 'red'; o.text = 'No gas. The litmus stays red.'; }
        break;
      case 'acid':
        if (s.a === 'CO3') { o.sig = 'fizz, milky'; o.bubbles = true; o.lime = 'milky'; o.text = 'Brisk effervescence. The gas turns the limewater milky: carbon dioxide.'; }
        else { o.lime = 'clear'; o.text = 'No effervescence. Nothing reaches the limewater.'; }
        break;
      case 'silver':
        if (s.a === 'Cl') { o.sig = 'white ppt'; o.ppt = '#f4f5f6'; o.text = 'A white precipitate.'; }
        else if (s.a === 'Br') { o.sig = 'cream ppt'; o.ppt = '#efe1b4'; o.text = 'A cream precipitate.'; }
        else if (s.a === 'I') { o.sig = 'yellow ppt'; o.ppt = '#f2d43a'; o.text = 'A yellow precipitate.'; }
        else if (s.a === 'CO3') { o.bubbles = true; o.text = 'The nitric acid fizzes; then no precipitate.'; }
        else o.text = 'No precipitate.';
        break;
      case 'barium':
        if (s.a === 'SO4') { o.sig = 'white ppt'; o.ppt = '#f4f5f6'; o.text = 'A dense white precipitate.'; }
        else if (s.a === 'CO3') { o.bubbles = true; o.text = 'The acid fizzes; then no precipitate.'; }
        else o.text = 'No precipitate.';
        break;
      case 'devarda':
        h = HYD[s.c] && HYD[s.c].naoh;
        if (h) { o.ppt = h[1]; o.dissolve = !!h[2]; }
        if (s.a === 'NO3') { o.sig = 'ammonia'; o.litmus = 'blue'; o.bubbles = true; o.text = 'After the foil goes in, ammonia comes off and the litmus turns blue: a nitrate.'; }
        else { o.litmus = 'red'; o.text = (s.c === 'NH4' ? 'Ammonia comes off at first and is driven out. ' : '') + 'After the foil goes in, no ammonia. The litmus stays red.'; }
        break;
    }
    return o;
  }
  function look(s) { var c = CATIONS[s.c].sol; return c ? c[0] : 'colourless'; }

  /* ---------- deduction ---------- */
  function key(s) { return s.c + ' ' + s.a; }
  function same(a, b) { return a.c === b.c && a.a === b.a; }
  // shortest set of tests that leaves only the true salt standing among the stock book (looking is free)
  function par(truth, book) {
    var rivals = book.filter(function (x) { return !same(x, truth) && look(x) === look(truth); });
    if (!rivals.length) return { n: 0, tests: [] };
    var best = null;
    for (var m = 1; m < (1 << TESTS.length); m++) {
      var bits = 0, t; for (t = 0; t < TESTS.length; t++) if (m & (1 << t)) bits++;
      if (best && bits >= best.n) continue;
      var ok = rivals.every(function (x) {
        for (var t2 = 0; t2 < TESTS.length; t2++) if ((m & (1 << t2)) && observe(x, TESTS[t2].key).sig !== observe(truth, TESTS[t2].key).sig) return true;
        return false;
      });
      if (ok) { var list = []; for (t = 0; t < TESTS.length; t++) if (m & (1 << t)) list.push(t); best = { n: bits, tests: list }; }
    }
    return best;
  }
  // which salts in the book agree with everything seen in one bottle
  function consistent(book, done, truth) {
    return book.filter(function (x) {
      if (look(x) !== look(truth)) return false;
      for (var i = 0; i < done.length; i++) if (observe(x, TESTS[done[i]].key).sig !== observe(truth, TESTS[done[i]].key).sig) return false;
      return true;
    });
  }

  /* ---------- the day ---------- */
  var TOWNS = ['Thornmere', 'Ashby Fold', 'Calder Mouth', 'Lowgill', 'Netherwick', 'Brigsley', 'Ormsby Staithe', 'Hollins Cross', 'Saltergate', 'Kelderby', 'Wrayholme', 'Fenny Stratton Parva'];
  var CHEMISTS = ['Thewlis', 'Pennock', 'Ackroyd', 'Fairbairn', 'Lumb', 'Sugden', 'Haigh', 'Crabtree', 'Moxon', 'Illingworth'];
  var FIRMS = ['& Son', '& Daughter', 'Brothers', '& Co.', '& Nephew'];
  var MISHAPS = [
    'the beck came over in the night and stood a foot deep in the cellar',
    'a carboy of distilled water split on the top shelf and ran down the whole run of bottles',
    'the new boy washed the bottles before the labels had been varnished',
    'the cellar drain backed up after three days of rain',
    'the roof over the store room gave way in the gale and let the weather in'
  ];
  var FINDERS = ['the apprentice', 'the new assistant', 'the proprietor’s granddaughter', 'the locum', 'the shop boy'];

  function build(seed) {
    var r = rng(seed), tries = 0, real, decoys, book, pars;
    do {
      tries++;
      real = shuffle(r, ALL).slice(0, BOTTLES);
      // no two bottles the same salt, and at most two sharing a cation
      var cs = {}; real.forEach(function (s) { cs[s.c] = (cs[s.c] || 0) + 1; });
      if (Object.keys(cs).some(function (c) { return cs[c] > 2; })) continue;
      // the decoys mostly share an ion with something on the shelf, so one test rarely settles it
      decoys = [];
      var guard = 0;
      while (decoys.length < DECOYS && guard++ < 400) {
        var d = pick(r, ALL);
        if (real.concat(decoys).some(function (x) { return same(x, d); })) continue;
        var shares = real.some(function (x) { return x.c === d.c || x.a === d.a; });
        if (!shares && r() < 0.85) continue;
        decoys.push(d);
      }
      if (decoys.length < DECOYS) continue;
      book = shuffle(r, real.concat(decoys));
      pars = real.map(function (s) { return par(s, book); });
      // every bottle must be settleable inside its portions, and at least two must need real work
      if (pars.some(function (p) { return !p || p.n > PORTIONS - 1; })) continue;
      if (pars.filter(function (p) { return p.n >= 2; }).length < 2 && tries < 60) continue;
      break;
    } while (tries < 200);
    return {
      seed: seed, real: real, book: book, pars: pars,
      town: pick(r, TOWNS), chemist: pick(r, CHEMISTS), firm: pick(r, FIRMS), mishap: pick(r, MISHAPS),
      finder: pick(r, FINDERS), year: 1878 + Math.floor(r() * 35)
    };
  }

  /* ---------- drawing ---------- */
  var WATER = '#cfe3f0';
  function solColour(s) { var c = CATIONS[s.c].sol; return c ? c[1] : WATER; }
  var uid = 0;
  function bottleSVG(s) {
    var col = solColour(s), op = CATIONS[s.c].sol ? 0.8 : 0.22; uid++;
    return '<svg class="bottle" viewBox="0 0 70 104" width="62" height="92" aria-hidden="true">' +
      '<defs><linearGradient id="bg' + uid + '" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient></defs>' +
      '<rect x="25" y="2" width="20" height="12" rx="3" fill="#6b4a2c"/>' +
      '<path d="M27 14 h16 v10 q20 6 20 24 v46 q0 8 -8 8 h-40 q-8 0 -8 -8 v-46 q0 -18 20 -24z" fill="rgba(140,170,160,.12)" stroke="rgba(200,230,220,.45)" stroke-width="1.5"/>' +
      '<path d="M9 52 q0 -4 4 -6 h44 q4 2 4 6 v42 q0 6 -6 6 h-40 q-6 0 -6 -6z" fill="' + col + '" fill-opacity="' + op + '"/>' +
      '<rect x="17" y="58" width="36" height="22" rx="2" fill="none" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 3"/>' +
      '<path d="M27 14 h16 v10 q20 6 20 24 v46 q0 8 -8 8 h-40 q-8 0 -8 -8 v-46 q0 -18 20 -24z" fill="url(#bg' + uid + ')"/>' +
      '</svg>';
  }
  function tubeSVG(s, testKey, o) {
    uid++;
    var base = solColour(s), op = CATIONS[s.c].sol ? 0.75 : 0.2;
    if (testKey === 'flame') {
      var outer = o.flame || '#7aa2ff';
      return '<svg class="tube flame' + (o.flame ? ' lit' : '') + '" viewBox="0 0 60 130" width="52" height="112" aria-hidden="true">' +
        '<rect x="22" y="100" width="16" height="28" rx="2" fill="#5d6675"/><rect x="18" y="124" width="24" height="5" rx="2" fill="#4a525f"/>' +
        '<g class="fl"><path d="M30 18 C 44 44, 46 70, 38 92 Q30 102 22 92 C 14 70, 16 44, 30 18z" fill="' + outer + '" fill-opacity="' + (o.flame ? .85 : .25) + '"/>' +
        '<path d="M30 58 C 36 72, 36 84, 33 94 Q30 98 27 94 C 24 84, 24 72, 30 58z" fill="#5b8cff" fill-opacity=".9"/></g>' +
        '<path d="M52 4 L33 40" stroke="#b9bfc8" stroke-width="1.6"/><circle cx="32" cy="42" r="3" fill="none" stroke="#e8edf5" stroke-width="1.4"/>' +
        '</svg>';
    }
    var s2 = '<svg class="tube" viewBox="0 0 60 130" width="52" height="112" aria-hidden="true">';
    var liq = '<path d="M20 50 v58 a10 10 0 0 0 20 0 v-58z" fill="' + base + '" fill-opacity="' + op + '"/>';
    if (o.deep) liq += '<path class="deep" d="M20 50 v58 a10 10 0 0 0 20 0 v-58z" fill="#1d3fd0" fill-opacity=".85"/>';
    var ppt = '';
    if (o.ppt) {
      ppt = '<g class="ppt' + (o.dissolve ? ' gone' : '') + '"><path d="M20 92 v16 a10 10 0 0 0 20 0 v-16z" fill="' + o.ppt + '" fill-opacity=".95"/>' +
        '<path class="cloud" d="M20 52 v56 a10 10 0 0 0 20 0 v-56z" fill="' + o.ppt + '" fill-opacity=".45"/></g>';
    }
    var bub = '';
    if (o.bubbles) { for (var i = 0; i < 7; i++) bub += '<circle class="bub" style="animation-delay:' + (i * 0.23).toFixed(2) + 's" cx="' + (24 + (i * 7) % 13) + '" cy="110" r="' + (1.2 + (i % 3) * 0.6) + '" fill="#fff" fill-opacity=".8"/>'; }
    var lit = '';
    if (o.litmus) lit = '<rect class="litmus' + (o.litmus === 'blue' ? ' turn' : '') + '" x="27" y="2" width="6" height="22" rx="1" fill="#d9465a"/>';
    var lime = '';
    if (o.lime) lime = '<path d="M40 32 q8 -14 14 0 v30" fill="none" stroke="rgba(200,230,220,.4)" stroke-width="1.2"/><rect x="48" y="62" width="10" height="44" rx="5" fill="none" stroke="rgba(200,230,220,.45)"/>' +
      '<rect class="lime' + (o.lime === 'milky' ? ' milky' : '') + '" x="49" y="78" width="8" height="27" rx="4" fill="#cfe3f0" fill-opacity=".25"/>';
    return s2 + liq + ppt + bub +
      '<path d="M18 22 v86 a12 12 0 0 0 24 0 v-86" fill="none" stroke="rgba(200,230,220,.55)" stroke-width="1.6"/>' +
      '<path d="M15 22 h30" stroke="rgba(200,230,220,.55)" stroke-width="1.6"/>' + lit + lime + '</svg>';
  }

  /* ---------- state ---------- */
  var S = { day: 0, D: null, sel: 0, done: [], log: [], filed: false };

  function renderBench() {
    var D = S.D, h = '';
    for (var b = 0; b < BOTTLES; b++) {
      var left = PORTIONS - S.done[b].length, dots = '';
      for (var p = 0; p < PORTIONS; p++) dots += '<i class="' + (p < left ? 'full' : '') + '"></i>';
      h += '<button type="button" class="bt' + (b === S.sel ? ' sel' : '') + '" data-b="' + b + '" aria-pressed="' + (b === S.sel) + '">' +
        bottleSVG(D.real[b]) +
        '<span class="bt-body"><span class="bt-l">Bottle ' + LETTERS[b] + '</span>' +
        '<span class="bt-look">' + cap(look(D.real[b])) + ' solution</span>' +
        '<span class="dots" title="' + left + ' portions left">' + dots + '</span></span></button>';
    }
    $('bench').innerHTML = h;
    Array.prototype.forEach.call($('bench').querySelectorAll('.bt'), function (el) {
      el.addEventListener('click', function () { S.sel = +el.getAttribute('data-b'); renderBench(); renderShelf(); });
    });
  }
  function renderShelf() {
    var b = S.sel, left = PORTIONS - S.done[b].length, h = '';
    TESTS.forEach(function (t, i) {
      var used = S.done[b].indexOf(i) >= 0;
      h += '<button type="button" class="rg" data-t="' + i + '"' + (used || left <= 0 || S.filed ? ' disabled' : '') + ' title="' + esc(t.how) + '">' +
        '<span class="rg-s">' + t.short + '</span><span class="rg-n">' + t.name + '</span></button>';
    });
    $('shelf').innerHTML = h;
    $('shelfMsg').innerHTML = S.filed ? 'The labels are written. Walk to another day for a new shelf.' :
      left <= 0 ? 'Bottle ' + LETTERS[b] + ' is empty. Pick another bottle.' :
      'Testing <b>bottle ' + LETTERS[b] + '</b>, ' + NUMW[left] + ' portion' + (left === 1 ? '' : 's') + ' left. Hover a reagent for the method.';
    Array.prototype.forEach.call($('shelf').querySelectorAll('.rg'), function (el) {
      el.addEventListener('click', function () { runTest(S.sel, +el.getAttribute('data-t')); });
    });
  }
  function runTest(b, t) {
    if (S.filed || S.done[b].length >= PORTIONS || S.done[b].indexOf(t) >= 0) return;
    S.done[b].push(t);
    S.log.unshift({ b: b, t: t, fresh: true });
    renderBench(); renderShelf(); renderRack(); renderLabels();
  }
  function renderRack() {
    var D = S.D;
    if (!S.log.length) { $('rack').innerHTML = '<p class="sub empty">Nothing tested yet. Pick a bottle, then a reagent.</p>'; return; }
    var h = '';
    for (var b = 0; b < BOTTLES; b++) {
      if (!S.done[b].length) continue;
      h += '<div class="row"><div class="row-h"><b>Bottle ' + LETTERS[b] + '</b> <span>' + look(D.real[b]) + '</span></div><div class="tubes">';
      S.done[b].forEach(function (t) {
        var o = observe(D.real[b], TESTS[t].key);
        var fresh = S.log.length && S.log[0].b === b && S.log[0].t === t && S.log[0].fresh;
        h += '<figure class="tb' + (fresh ? ' fresh' : '') + '">' + tubeSVG(D.real[b], TESTS[t].key, o) +
          '<figcaption><b>' + TESTS[t].name + '</b>' + esc(o.text) + '</figcaption></figure>';
      });
      h += '</div></div>';
    }
    $('rack').innerHTML = h;
    if (S.log.length) S.log[0].fresh = false;
  }
  function renderBook() {
    var D = S.D, h = '<table class="book"><thead><tr><th>Entry</th><th>Salt</th><th>Kept for</th></tr></thead><tbody>';
    D.book.forEach(function (s, i) {
      h += '<tr><td class="no">' + (i + 1) + '</td><td><span class="fm">' + formula(s) + '</span> ' + esc(saltName(s)) + '</td><td class="use">' + esc(saltUse(s)) + '</td></tr>';
    });
    $('book').innerHTML = h + '</tbody></table>';
  }
  function renderLabels() {
    var D = S.D, h = '';
    for (var b = 0; b < BOTTLES; b++) {
      var cur = S.labels[b];
      var opts = '<option value="">— not yet —</option>' + D.book.map(function (s, i) {
        return '<option value="' + i + '"' + (cur === i ? ' selected' : '') + '>' + esc(cap(saltName(s))) + '</option>';
      }).join('');
      h += '<label class="lab"><span class="lab-l">Bottle ' + LETTERS[b] + '</span><select data-b="' + b + '"' + (S.filed ? ' disabled' : '') + '>' + opts + '</select>' +
        '<span class="lab-n">' + (S.done[b].length ? NUMW[S.done[b].length] + ' test' + (S.done[b].length === 1 ? '' : 's') + ' run' : 'untested') + '</span></label>';
    }
    $('labels').innerHTML = h;
    Array.prototype.forEach.call($('labels').querySelectorAll('select'), function (el) {
      el.addEventListener('change', function () { var v = el.value; S.labels[+el.getAttribute('data-b')] = v === '' ? null : +v; });
    });
  }
  function renderCard() {
    var cat = ['Li', 'Na', 'K', 'Ca', 'Ba', 'Cu', 'Fe2', 'Fe3', 'Zn', 'Al', 'Mg', 'NH4'];
    var h = '<table class="book card"><thead><tr><th>Cation</th><th>Solution</th><th>Flame</th><th>NaOH, then excess</th><th>NH₃, then excess</th><th>Warm with NaOH</th></tr></thead><tbody>';
    cat.forEach(function (c) {
      var s = { c: c, a: 'NO3' }, C = CATIONS[c];
      var f = observe(s, 'flame'), n = observe(s, 'naoh'), m = observe(s, 'nh3'), w = observe(s, 'warm');
      h += '<tr><td><b>' + C.sym + '<sup>' + (C.ch > 1 ? C.ch : '') + '+</sup></b> ' + C.name + '</td><td>' + look(s) + '</td><td>' + (C.flame ? sw(C.flame[1]) + C.flame[0] : '—') + '</td><td>' + shortHyd(n) + '</td><td>' + shortHyd(m) + '</td><td>' + (w.sig === 'ammonia' ? 'ammonia; litmus blue' : '—') + '</td></tr>';
    });
    h += '</tbody></table>';
    var an = ['Cl', 'Br', 'I', 'SO4', 'CO3', 'NO3'];
    h += '<table class="book card"><thead><tr><th>Anion</th><th>Acid, gas to limewater</th><th>HNO₃ then AgNO₃</th><th>HCl then BaCl₂</th><th>NaOH and aluminium</th></tr></thead><tbody>';
    an.forEach(function (a) {
      var s = { c: 'Na', a: a }, A = ANIONS[a];
      var q = observe(s, 'acid'), g = observe(s, 'silver'), k = observe(s, 'barium'), d = observe(s, 'devarda');
      h += '<tr><td><b>' + A.sym + '<sup>' + (A.ch > 1 ? A.ch : '') + '−</sup></b> ' + A.name + '</td><td>' + (q.sig !== 'none' ? 'fizz; limewater milky' : '—') + '</td><td>' + (g.ppt ? sw(g.ppt) + g.sig.replace(' ppt', ' precipitate') : '—') + '</td><td>' + (k.ppt ? sw(k.ppt) + 'white precipitate' : '—') + '</td><td>' + (d.sig === 'ammonia' ? 'ammonia; litmus blue' : '—') + '</td></tr>';
    });
    $('card').innerHTML = h + '</tbody></table>';
    function sw(c) { return '<i class="sw" style="background:' + c + '"></i>'; }
    function shortHyd(o) {
      if (!o.ppt) return '—';
      var nm = o.text.replace(/^A /, '').split(' precipitate')[0];
      return '<i class="sw" style="background:' + o.ppt + '"></i>' + nm + (o.deep ? ', dissolves: deep blue' : o.dissolve ? ', dissolves' : ', stays');
    }
  }

  /* ---------- grading ---------- */
  function fileLabels() {
    if (S.filed) return;
    var missing = S.labels.filter(function (v) { return v === null; }).length;
    if (missing && !window.confirm(cap(NUMW[missing]) + ' bottle' + (missing === 1 ? ' has' : 's have') + ' no label chosen. Write the labels anyway?')) return;
    S.filed = true;
    var D = S.D, right = 0, used = 0, parSum = 0, items = [];
    for (var b = 0; b < BOTTLES; b++) {
      var truth = D.real[b], p = D.pars[b], chosen = S.labels[b] === null ? null : D.book[S.labels[b]];
      used += S.done[b].length; parSum += p.n;
      var ok = chosen && same(chosen, truth), line = '<b>Bottle ' + LETTERS[b] + '</b> ';
      if (ok) { right++; line += '<span class="tick y">right</span> ' + formula(truth) + ', ' + esc(saltName(truth)) + '. '; }
      else line += '<span class="tick n">' + (chosen ? 'wrong' : 'blank') + '</span> It was ' + formula(truth) + ', ' + esc(saltName(truth)) + (chosen ? ', not ' + esc(saltName(chosen)) : '') + '. ';
      if (chosen && !ok) {
        var contra = null;
        if (look(chosen) !== look(truth)) contra = 'You could see it: ' + saltName(chosen) + ' would make a ' + look(chosen) + ' solution, and this one is ' + look(truth) + '.';
        else for (var i = 0; i < S.done[b].length; i++) {
          var tk = TESTS[S.done[b][i]].key, A = observe(chosen, tk), T = observe(truth, tk);
          if (A.sig !== T.sig) { contra = 'Your own ' + TESTS[S.done[b][i]].name.toLowerCase() + ' tube says otherwise: you saw “' + T.text + '” where ' + saltName(chosen) + ' would give “' + A.text + '”'; break; }
        }
        if (!contra) {
          var split = null;
          for (var t = 0; t < TESTS.length && !split; t++) if (observe(chosen, TESTS[t].key).sig !== observe(truth, TESTS[t].key).sig) split = t;
          contra = 'Nothing you ran ruled it out. The ' + TESTS[split].name.toLowerCase() + ' would have: ' + observe(truth, TESTS[split].key).text;
        }
        line += esc(contra) + ' ';
      }
      line += 'You used ' + NUMW[S.done[b].length] + ' portion' + (S.done[b].length === 1 ? '' : 's') + '; ';
      line += p.n === 0 ? 'its colour alone settles it against the stock book.' :
        'the shortest route is ' + NUMW[p.n] + ' (' + listJoin(p.tests.map(function (t) { return TESTS[t].name.toLowerCase(); })) + ').';
      items.push('<li>' + line + '</li>');
    }
    var cls = right === BOTTLES ? 'verdict good' : 'verdict warn';
    var head = right === BOTTLES ? 'All four labels right.' : cap(NUMW[right]) + ' of four labels right.';
    head += ' ' + cap(NUMW[used]) + ' portions used against a par of ' + NUMW[parSum] + (right === BOTTLES && used <= parSum ? ': a clean assay, and nothing wasted.' : right === BOTTLES ? '.' : '. The shop will be relabelling again.');
    $('report').className = cls;
    $('report').innerHTML = '<b>' + head + '</b><ul class="per">' + items.join('') + '</ul>';
    var unused = D.book.filter(function (x) { return !D.real.some(function (y) { return same(x, y); }); });
    $('reveal').innerHTML = '<p class="sub small">Not on the shelf any more: ' + listJoin(unused.map(function (s) { return formula(s) + ' ' + esc(saltName(s)); })) +
      '. Par counts each bottle against the whole stock book on its own; a chemist who reasons across bottles (each entry fills at most one) can sometimes do better.</p>';
    renderShelf(); renderLabels();
  }

  function load() {
    var d = dateFor(S.day);
    S.D = build(seedForDate(d));
    S.sel = 0; S.done = []; S.labels = []; S.log = []; S.filed = false;
    for (var b = 0; b < BOTTLES; b++) { S.done.push([]); S.labels.push(null); }
    var D = S.D;
    $('plWho').textContent = D.chemist + ' ' + D.firm + ', dispensing chemists, ' + D.town + ' · ' + D.year;
    $('plName').textContent = 'Four bottles, no labels, seven lines in the stock book';
    $('plBlurb').innerHTML = 'In the spring of ' + D.year + ' ' + esc(D.mishap) + '. When it was over, ' + esc(D.finder) + ' found four bottles on the bottom shelf with their labels lying in the wet at their feet. ' +
      'The stock book lists <b>seven salts</b> for that shelf; three have been sold since and four are in the bottles. Each bottle holds enough for <b>four tests</b>, and no more can be spared.';
    $('dayOut').textContent = (S.day === 0 ? 'Today, ' : S.day === -1 ? 'Yesterday, ' : S.day === 1 ? 'Tomorrow, ' : '') + longDate(d);
    $('report').className = 'verdict'; $('report').innerHTML = ''; $('reveal').innerHTML = '';
    renderBench(); renderShelf(); renderRack(); renderBook(); renderLabels();
  }
  function goDay(n) { S.day = n; load(); }

  renderCard();
  $('btnFile').addEventListener('click', fileLabels);
  $('btnReset').addEventListener('click', function () { if (!S.log.length || window.confirm('Pour everything away and start the shelf again?')) load(); });
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
  window.__assay = { build: build, S: S, observe: observe, par: par, consistent: consistent, formula: formula, runTest: runTest, fileLabels: fileLabels, seedForDate: seedForDate, ALL: ALL };

  load();
})();
