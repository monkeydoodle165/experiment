/* experiment.quibo.games — The Almanac
   A deterministic dispatch from a place that does not exist.
   Every date produces exactly one page, forever. No dependencies. */
(function () {
  'use strict';

  /* ---------- seeded PRNG (mulberry32), same family as app.js ---------- */
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

  function hash32(n) {
    var h = n ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function seedForDate(d) {
    return hash32(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
  }

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function intBetween(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* pick n distinct members of arr */
  function pickSome(r, arr, n) {
    var pool = arr.slice(), out = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    }
    return out;
  }

  /* ---------- invented words ---------- */
  var ONSET_ONE = ['b', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's',
    't', 'v', 'w', 'y', 'z', 'sh', 'th'];
  var ONSET_TWO = ['br', 'dr', 'fl', 'gl', 'gr', 'kr', 'pl', 'sk', 'sl', 'sn',
    'st', 'tr', 'thr', 'wr'];
  var V_SIMPLE = ['a', 'e', 'i', 'o', 'u'];
  var V_DOUBLE = ['ae', 'ai', 'ea', 'ee', 'oa', 'oo', 'ou'];
  var CODA_LIGHT = ['l', 'n', 'r', 's', 'm', 'th', 'ck', 'sh', 'ng'];
  var CODA_HEAVY = ['ll', 'nd', 'nt', 'rk', 'rn', 'rt', 'st', 'sk', 'ft', 'lt', 'mb'];

  /* a small guard so the syllable soup never lands somewhere unpleasant */
  var BLOCK = ['fuk', 'fuc', 'fuq', 'shit', 'piss', 'cunt', 'sex', 'nig', 'fag',
    'coc', 'cok', 'dik', 'dic', 'tit', 'ass', 'rape', 'kill', 'nazi'];

  function clean(w) {
    var s = w.toLowerCase();
    for (var i = 0; i < BLOCK.length; i++) if (s.indexOf(BLOCK[i]) !== -1) return false;
    return true;
  }

  function makeWord(r, syllables) {
    for (var attempt = 0; attempt < 20; attempt++) {
      var syls = [];
      var prevHadCoda = false;
      for (var i = 0; i < syllables; i++) {
        /* a cluster onset is only allowed if the previous syllable ended open */
        var onset = (!prevHadCoda && r() < 0.32)
          ? pick(r, ONSET_TWO) : pick(r, ONSET_ONE);
        var doubled = r() < 0.24;
        var vowel = doubled ? pick(r, V_DOUBLE) : pick(r, V_SIMPLE);
        var last = (i === syllables - 1);
        var coda = '';
        if (doubled) {
          if (last || r() < 0.3) coda = r() < 0.7 ? pick(r, CODA_LIGHT) : '';
        } else if (last) {
          coda = r() < 0.72 ? (r() < 0.5 ? pick(r, CODA_LIGHT) : pick(r, CODA_HEAVY)) : '';
        } else if (r() < 0.4) {
          coda = pick(r, CODA_LIGHT);
        }
        prevHadCoda = coda.length > 0;
        syls.push(onset + vowel + coda);
      }
      var word = syls.join('');
      if (clean(word) && word.length > 3 && word.length < 12 &&
          !/(.)\1\1/.test(word)) {
        return { word: word, syls: syls };
      }
    }
    return { word: 'thennel', syls: ['then', 'nel'] };
  }

  function saying(entry) {
    /* KESS-en-drift style pronunciation hint */
    return entry.syls.map(function (s, i) {
      return i === 0 ? s.toUpperCase() : s;
    }).join('-');
  }

  /* ---------- banks ---------- */
  var SUFFIX = ['Fen', 'Hollow', 'Reach', 'Marches', 'Barrows', 'Downs', 'Shelf',
    'Weir', 'Verge', 'Sound', 'Strand', 'Drift', 'Scarp', 'Combe', 'Mire',
    'Steps', 'Ridge', 'Bight', 'Wold', 'Staithe', 'Cross', 'Lees'];

  var FEATURE = ['the tide steps', 'the old ropewalk', 'the reading room',
    'the ferry slip', 'the beacon field', 'the sunken lane', 'the glasshouse',
    'the coal wharf', 'the bell tower', 'the millpond', 'the salt flats',
    'the signal box', 'the north jetty', 'the drovers road', 'the lantern yard',
    'the weir', 'the pumphouse', 'the shingle bank', 'the orchard wall',
    'the boathouse', 'the long allotments', 'the winter market'];

  var CREATURE = ['herons', 'starlings', 'shore crabs', 'fen ponies', 'barn owls',
    'eels', 'hares', 'oystercatchers', 'lapwings', 'gulls', 'moths', 'geese',
    'otters', 'jackdaws', 'toads', 'swifts'];

  var SKY = ['low and unbothered', 'the colour of a cold kettle',
    'high, thin and going nowhere', 'bruised at the edges, clear in the middle',
    'overcast in a way that feels deliberate', 'clear enough to be suspicious',
    'three kinds of grey, none of them agreeing', 'washed out by mid-morning',
    'a single cloud, following people'];

  var WINDQ = ['and rude about it', 'though it drops after lunch',
    'with a smell of iron in it', 'not enough to move the reeds',
    'strong enough to argue with', 'coming and going like a bad excuse',
    'steady, which nobody trusts', 'warm, unseasonably, briefly'];

  var DIR = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west',
    'west', 'north-west'];

  var UNDERFOOT = ['soft, and getting softer', 'frozen in the ruts and nowhere else',
    'dry for once', 'shingle, loose, ankle-hostile', 'flooded to the second step',
    'clay, and it keeps your boot if you let it', 'ankle-deep in leaf mould',
    'firm, and unnervingly quiet'];

  var TIDE = ['high and early', 'low and sulking', 'neap, barely worth the walk',
    'spring, up over the causeway', 'slack for an hour around noon',
    'running out fast enough to notice'];

  var ADVICE = ['take the long way round', 'bring a second coat',
    'do not trust the causeway', 'go before the light does',
    'say nothing to the ferryman', 'carry a torch you do not need',
    'leave the dog at home', 'be somewhere indoors by four',
    'settle your debts at the market first'];

  var LIGHT = ['good until three, then apologetic', 'flat all day',
    'better than yesterday, which is a low bar', 'sharp, low, and short',
    'gold for eleven minutes at dusk and grey either side',
    'the sort that makes everyone look tired'];

  var OFFICE = ['the harbour office', 'the parish council', 'the tide committee',
    'the lending library', 'the almanac office', 'the ferry trust',
    'the bell fund', 'the drainage board'];

  var THING = ['boot', 'brass key', 'chair', 'bicycle', 'ledger', 'crate of apples',
    'weather vane', 'wedding ring', 'perfectly good umbrella', 'sack of onions',
    'ship\'s bell', 'painted door with no house attached'];

  var SHOP = ['the chandlery', 'the post office', 'the tea rooms',
    'the bakery on the steps', 'the ironmonger', 'the ferry hut'];

  var VERB_ING = ['humming', 'ticking', 'leaning', 'singing very quietly',
    'settling', 'answering back', 'giving off warmth', 'moving at night'];

  var COUNTER = ['a nine-year-old', 'two people who dislike each other',
    'the ferryman, working from memory', 'whoever was awake', 'the bell ringer',
    'a committee of three'];

  var BLAME = ['the damp', 'the new rope', 'the moon', 'a draught',
    'last year\'s repairs', 'the tide', 'nobody, loudly'];

  var FERRY_ADV = ['late, twice', 'early, which is worse', 'to time, unsettlingly',
    'not at all after two', 'with one passenger and no explanation'];

  var REPORT = ['a smell of oranges', 'no unusual events, firmly',
    'that the crossing took longer than the water allows',
    'a very ordinary journey', 'singing from the wrong bank'];

  var TIMES = ['first light', 'seven', 'the middle of the afternoon', 'dusk',
    'the last of the light', 'a quarter past eleven'];

  var STATE = ['flooded', 'frozen over', 'unaccountably warm', 'entirely fogbound',
    'loud with bees', 'empty', 'full of people with no reason to be there'];

  /* definition shapes for the lexicon, each carrying its own part of speech */
  var DEF = [
    { pos: 'n.', f: function (r) {
      return 'the particular quiet that arrives when everyone has left ' +
        pick(r, FEATURE) + ' at once'; } },
    { pos: 'v.', f: function () {
      return 'to keep tidying a room you have already finished, so as not to have to leave it'; } },
    { pos: 'n.', f: function (r) {
      return 'a ' + pick(r, THING) + ' kept long after its use, purely because ' +
        'throwing it out would be an admission'; } },
    { pos: 'n.', f: function () {
      return 'the small private resentment felt towards weather that arrives on the day you had plans'; } },
    { pos: 'n.', f: function (r, ctx) {
      return 'the hour between usable light and honest dark, when ' + ctx.place +
        ' is at its least trustworthy'; } },
    { pos: 'v.', f: function () {
      return 'to greet someone twice in one morning and have nothing new to say the second time'; } },
    { pos: 'n.', f: function (r) {
      return 'a promise made at ' + pick(r, FEATURE) +
        ' that both parties know will lapse by spring'; } },
    { pos: 'n.', f: function (r) {
      return 'the sound of ' + pick(r, CREATURE) + ' leaving, heard from indoors'; } },
    { pos: 'n.', f: function () {
      return 'a repair that holds, but only because nobody has tested it'; } },
    { pos: 'n.', f: function () {
      return 'the exact weight of a coat that was right yesterday and is wrong today'; } },
    { pos: 'v.', f: function (r) {
      return 'to walk the long way round in order to pass ' + pick(r, FEATURE) +
        ' without appearing to have chosen to'; } },
    { pos: 'n.', f: function () {
      return 'good news delivered so late that it has quietly become a fact instead'; } },
    { pos: 'adj.', f: function () {
      return 'said of weather that has plainly made up its mind and is waiting for you to notice'; } },
    { pos: 'adj.', f: function (r) {
      return 'said of a mechanism — ' + pick(r, ['a lock', 'a pump', 'a clock', 'a hinge', 'a lamp']) +
        ', usually — that works perfectly until it is watched'; } },
    { pos: 'adj.', f: function () {
      return 'said of a person who is forever leaving and never actually gone'; } },
    { pos: 'v.', f: function (r) {
      return 'to agree with ' + pick(r, OFFICE_WORDS) +
        ' in public and do the opposite before Thursday'; } },
    { pos: 'n.', f: function (r) {
      return 'the last warm hour of a year, identifiable only in hindsight and usually spent indoors'; } },
    { pos: 'adj.', f: function () {
      return 'said of a path that is shorter on the way out than on the way back'; } }
  ];

  var OFFICE_WORDS = ['the harbour office', 'the parish council', 'the tide committee',
    'the drainage board'];

  /* each ledger line gets a plausible range of its own */
  var LEDGER_KEYS = [
    { k: 'Bells heard', lo: 0, hi: 41 },
    { k: 'Ferries missed', lo: 0, hi: 4 },
    { k: 'Doors left open', lo: 0, hi: 12 },
    { k: 'Letters unanswered', lo: 1, hi: 60 },
    { k: 'Hours of usable light', lo: 5, hi: 15 },
    { k: 'Gloves handed in', lo: 0, hi: 9 },
    { k: 'Arguments about the tide', lo: 0, hi: 7 },
    { k: 'Lamps lit before dusk', lo: 0, hi: 30 },
    { k: 'Cups of tea logged', lo: 20, hi: 400 },
    { k: 'Visitors, unexplained', lo: 0, hi: 6 },
    { k: 'Boats counted at noon', lo: 0, hi: 24 },
    { k: 'Minutes of silence observed', lo: 0, hi: 10 }
  ];

  /* ---------- the notes ---------- */
  function makeNotes(r, ctx) {
    var shapes = [
      function () {
        return cap(pick(r, CREATURE)) + ' came back to ' + pick(r, FEATURE) +
          ' overnight. Nobody has offered an explanation and nobody has asked for one.';
      },
      function () {
        return cap(pick(r, FEATURE)) + ' was ' + pick(r, STATE) + ' again before ' +
          pick(r, TIMES) + ', which makes ' + intBetween(r, 3, 11) + ' mornings running.';
      },
      function () {
        return 'A ' + pick(r, THING) + ' was found at ' + pick(r, FEATURE) +
          '. It is behind the counter at ' + pick(r, SHOP) +
          ' until somebody claims it, which they will not.';
      },
      function () {
        return 'Something in ' + pick(r, FEATURE) + ' has started ' + pick(r, VERB_ING) +
          ' in the evenings. ' + cap(pick(r, OFFICE)) + ' is treating it as weather.';
      },
      function () {
        return cap(pick(r, CREATURE)) + ' were counted at first light: ' +
          intBetween(r, 12, 400) + ', up ' + intBetween(r, 2, 40) +
          ' on the week — though the counting was done by ' + pick(r, COUNTER) +
          ' and should be taken lightly.';
      },
      function () {
        return 'The bells at ' + pick(r, FEATURE) + ' rang ' + intBetween(r, 9, 19) +
          ' times instead of ' + intBetween(r, 3, 8) + '. The verger blames ' +
          pick(r, BLAME) + '.';
      },
      function () {
        return 'The ferry ran ' + pick(r, FERRY_ADV) + '. Passengers report ' +
          pick(r, REPORT) + '.';
      },
      function () {
        return 'Nothing whatsoever happened at ' + pick(r, FEATURE) +
          ' today, and this was noticed.';
      },
      function () {
        return cap(pick(r, OFFICE)) + ' has changed its opening hours again. Notices to that effect are posted inside, behind the locked door.';
      },
      function () {
        return 'The word here for this kind of afternoon is <em>' + ctx.wordOfDay +
          '</em>. It is not a compliment.';
      },
      function () {
        return 'Two people described the same ' + pick(r, THING) +
          ' to ' + pick(r, OFFICE) + ' and were told, separately, that it does not exist.';
      },
      function () {
        return 'Frost took the ' + pick(r, ['beans', 'late apples', 'dahlias', 'washing', 'nets', 'paintwork']) +
          ' on ' + pick(r, FEATURE) + '. It was forecast. It was still a surprise.';
      }
    ];
    return pickSome(r, shapes, 4).map(function (f) { return f(); });
  }

  /* ---------- the song ---------- */
  function makeSong(r, ctx) {
    var weatherNoun = pick(r, ['Rain', 'Fog', 'Frost', 'Wind', 'Dark', 'Salt', 'Smoke']);
    var plural = pick(r, ['lamps', 'boats', 'windows', 'bells', 'crossings', 'winters']);
    var a = intBetween(r, 3, 12), b = intBetween(r, 1, a - 1);
    return [
      weatherNoun + ' over ' + pick(r, FEATURE) + ',',
      cap(pick(r, CREATURE)) + ' going ' + pick(r, DIR) + ' without us.',
      'Count the ' + plural + ': ' + a + ', then ' + b + ', then none.',
      'Come back when the ' + pick(r, THING) + ' is ' +
        pick(r, ['dry', 'mended', 'yours', 'forgotten', 'warm', 'paid for']) + '.'
    ];
  }

  /* ---------- the sigil ---------- */
  function sigil(r) {
    var s = [];
    var cx = 60, cy = 60;
    var rings = intBetween(r, 1, 3);
    for (var i = 0; i < rings; i++) {
      var rad = 16 + i * intBetween(r, 7, 15);
      var dash = r() < 0.45 ? ' stroke-dasharray="' + intBetween(r, 2, 9) + ' ' + intBetween(r, 2, 8) + '"' : '';
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + rad +
        '" fill="none" stroke="currentColor" stroke-width="' + (r() < 0.5 ? 1 : 1.8) + '"' + dash + '/>');
    }
    var spokes = intBetween(r, 3, 9);
    var rot = r() * Math.PI * 2;
    var outer = 50, inner = intBetween(r, 6, 24);
    var poly = [];
    for (var k = 0; k < spokes; k++) {
      var ang = rot + (k / spokes) * Math.PI * 2;
      var x1 = cx + Math.cos(ang) * inner, y1 = cy + Math.sin(ang) * inner;
      var x2 = cx + Math.cos(ang) * outer, y2 = cy + Math.sin(ang) * outer;
      s.push('<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' +
        x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
        '" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>');
      poly.push(x2.toFixed(1) + ',' + y2.toFixed(1));
      if (r() < 0.55) {
        s.push('<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="' +
          (1.6 + r() * 2.4).toFixed(1) + '" fill="currentColor"/>');
      }
    }
    if (r() < 0.6) {
      s.push('<polygon points="' + poly.join(' ') +
        '" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/>');
    }
    if (r() < 0.5) {
      var bar = intBetween(r, 18, 34);
      s.push('<line x1="' + (cx - bar) + '" y1="' + cy + '" x2="' + (cx + bar) +
        '" y2="' + cy + '" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>');
    }
    s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + intBetween(r, 2, 5) +
      '" fill="currentColor"/>');
    return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="Seal of the day">' + s.join('') + '</svg>';
  }

  /* ---------- the whole page ---------- */
  function generate(seed) {
    var r = rng(seed >>> 0);

    var base = makeWord(r, intBetween(r, 2, 3));
    var place = cap(base.word);
    if (r() < 0.62) place += ' ' + pick(r, SUFFIX);
    var region = pick(r, ['the parish of ', 'the lower ', 'the upper ', 'greater ',
      'the hundred of ', 'old ']) + place;

    var wordEntries = [];
    for (var i = 0; i < 4; i++) {
      var w = makeWord(r, intBetween(r, 2, 3));
      wordEntries.push(w);
    }
    var ctx = { place: place, wordOfDay: wordEntries[0].word };

    var defs = pickSome(r, DEF, 4);
    var lexicon = wordEntries.map(function (w, idx) {
      return {
        word: w.word,
        say: saying(w),
        pos: defs[idx].pos,
        def: defs[idx].f(r, ctx)
      };
    });

    var pop = intBetween(r, 40, 2600);
    var conditions = [
      { k: 'Sky', v: pick(r, SKY) },
      { k: 'Wind', v: pick(r, DIR) + ', ' + intBetween(r, 2, 38) + ' knots, ' + pick(r, WINDQ) },
      { k: 'Light', v: pick(r, LIGHT) },
      { k: 'Underfoot', v: pick(r, UNDERFOOT) },
      { k: 'Tide', v: pick(r, TIDE) },
      { k: 'Advice', v: pick(r, ADVICE) }
    ];

    var ledger = pickSome(r, LEDGER_KEYS, 4).map(function (row) {
      return { k: row.k, v: intBetween(r, row.lo, row.hi) };
    });

    return {
      seed: seed >>> 0,
      place: place,
      region: region,
      population: pop,
      motto: cap(pick(r, ['nothing here is urgent', 'the water decides',
        'we were told, and we did not listen', 'built twice, kept once',
        'the bells are correct, the clock is not', 'later, and gladly',
        'we keep what floats'])) + '.',
      conditions: conditions,
      notes: makeNotes(r, ctx),
      lexicon: lexicon,
      song: makeSong(r, ctx),
      ledger: ledger,
      sigil: sigil(r)
    };
  }

  /* ---------- node-side export for offline checking ---------- */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generate: generate, seedForDate: seedForDate, rng: rng };
    return;
  }

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }

  var current = new Date();
  current.setHours(12, 0, 0, 0);

  function isoOf(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function longDate(d) {
    return d.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  var lastPage = null;

  function render() {
    var seed = seedForDate(current);
    var page = generate(seed);
    lastPage = page;

    $('alPlace').textContent = page.place;
    $('alRegion').textContent = page.region;
    $('alDate').textContent = longDate(current);
    $('alSeed').textContent = String(page.seed).padStart(10, '0');
    $('alPop').textContent = page.population.toLocaleString();
    $('alMotto').textContent = '“' + page.motto + '”';
    $('alSigil').innerHTML = page.sigil;

    var c = $('alConditions');
    c.innerHTML = '';
    page.conditions.forEach(function (row) {
      var d = document.createElement('div');
      d.innerHTML = '<dt>' + esc(row.k) + '</dt><dd>' + esc(row.v) + '</dd>';
      c.appendChild(d);
    });

    var n = $('alNotes');
    n.innerHTML = '';
    page.notes.forEach(function (text) {
      var li = document.createElement('li');
      li.innerHTML = text; /* templates supply only <em> */
      n.appendChild(li);
    });

    var lx = $('alLexicon');
    lx.innerHTML = '';
    page.lexicon.forEach(function (e) {
      var d = document.createElement('div');
      d.className = 'lex';
      d.innerHTML = '<b>' + esc(e.word) + '</b> <span class="say">' + esc(e.say) +
        '</span> <i>' + esc(e.pos) + '</i><p>' + esc(e.def) + '</p>';
      lx.appendChild(d);
    });

    $('alSong').innerHTML = page.song.map(esc).join('<br>');

    var lg = $('alLedger');
    lg.innerHTML = '';
    page.ledger.forEach(function (row) {
      var d = document.createElement('div');
      d.innerHTML = '<dt>' + esc(row.k) + '</dt><dd>' + row.v + '</dd>';
      lg.appendChild(d);
    });

    var input = $('alDatePick');
    if (input) input.value = isoOf(current);

    var today = new Date();
    $('alToday').disabled = sameDay(current, today);

    buildStrip();
    $('alCopy').textContent = 'Copy this page';
  }

  function buildStrip() {
    var strip = $('alStrip');
    if (!strip) return;
    strip.innerHTML = '';
    var today = new Date(); today.setHours(12, 0, 0, 0);
    for (var i = -3; i <= 3; i++) {
      var d = new Date(current.getTime() + i * 86400000);
      d.setHours(12, 0, 0, 0);
      var b = document.createElement('button');
      b.className = 'chip' + (i === 0 ? ' on' : '');
      b.textContent = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      if (sameDay(d, today)) b.textContent += ' •';
      b.title = longDate(d);
      (function (dd) {
        b.addEventListener('click', function () { current = dd; render(); });
      })(d);
      strip.appendChild(b);
    }
  }

  function asText() {
    var p = lastPage;
    if (!p) return '';
    var L = [];
    L.push('THE ALMANAC — ' + p.place);
    L.push(longDate(current) + '  ·  seed ' + String(p.seed).padStart(10, '0'));
    L.push('');
    L.push('Population ' + p.population + '. ' + p.motto);
    L.push('');
    L.push('CONDITIONS');
    p.conditions.forEach(function (r) { L.push('  ' + r.k + ': ' + r.v); });
    L.push('');
    L.push('FIELD NOTES');
    p.notes.forEach(function (t) { L.push('  - ' + t.replace(/<[^>]+>/g, '')); });
    L.push('');
    L.push('LEXICON');
    p.lexicon.forEach(function (e) {
      L.push('  ' + e.word + ' (' + e.say + ') ' + e.pos + ' — ' + e.def);
    });
    L.push('');
    L.push('SONG FRAGMENT');
    p.song.forEach(function (l) { L.push('  ' + l); });
    L.push('');
    L.push('THE LEDGER');
    p.ledger.forEach(function (r) { L.push('  ' + r.k + ': ' + r.v); });
    L.push('');
    L.push('experiment.quibo.games/almanac.html');
    return L.join('\n');
  }

  function shift(days) {
    current = new Date(current.getTime() + days * 86400000);
    current.setHours(12, 0, 0, 0);
    render();
  }

  function wire(id, fn) {
    var el = $(id);
    if (el) el.addEventListener('click', fn);
  }

  wire('alPrev', function () { shift(-1); });
  wire('alNext', function () { shift(1); });
  wire('alToday', function () {
    current = new Date(); current.setHours(12, 0, 0, 0); render();
  });
  wire('alFar', function () {
    /* somewhere in the next hundred years */
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setTime(d.getTime() + Math.floor(Math.random() * 36500) * 86400000);
    current = d;
    render();
  });
  wire('alCopy', function () {
    var txt = asText();
    var btn = this;
    function ok() { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy this page'; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, function () { btn.textContent = 'Could not copy'; });
    } else {
      var ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { btn.textContent = 'Could not copy'; }
      document.body.removeChild(ta);
    }
  });

  var picker = $('alDatePick');
  if (picker) {
    picker.addEventListener('change', function () {
      var parts = this.value.split('-');
      if (parts.length !== 3) return;
      var d = new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0, 0);
      if (isNaN(d.getTime())) return;
      current = d;
      render();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { shift(-1); }
    else if (e.key === 'ArrowRight') { shift(1); }
  });

  render();
})();
