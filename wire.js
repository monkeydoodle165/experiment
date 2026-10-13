/* drift.quibo.games — The Wire
   Telegraphy. The day's number opens a Post Office telegraph office somewhere in Britain
   between 1871 and 1905, writes a telegram, and gives the clerk at the far end of the
   line a fist of his own: his speed, how long he holds his dashes, how much room he
   leaves between letters, how steady his hand is. The message comes in on a Morse inker
   as a strip of paper tape, with the weather on the line getting worse as it goes:
   clicks of static in the spaces and dashes broken in two where the line drops out.

   Read the tape, write out the copy, and deliver it. You may ask the far office to
   repeat two words. The page then scores your copy letter by letter against what was
   handed in, and against the office's mechanical reader, which sorts every mark and
   every space by length into two and three heaps and reads off whatever the heaps say.
   Self-contained. */
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
    var h = s ^ 0x3c6ef372;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }

  /* ---------- International (Continental) Morse ---------- */
  var MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
    K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '---..', '9': '----.'
  };
  var DEMORSE = {};
  Object.keys(MORSE).forEach(function (k) { DEMORSE[MORSE[k]] = k; });

  /* ---------- the day's telegram ---------- */
  var TOWNS = ['TRURO', 'PENZANCE', 'WHITBY', 'LUDLOW', 'KENDAL', 'HEXHAM', 'BOSTON', 'MALTON', 'SHERBORNE',
    'OBAN', 'WICK', 'STRANRAER', 'CROMER', 'ELY', 'HEREFORD', 'LEWES', 'DOVER', 'HOLYHEAD', 'BARNSTAPLE',
    'BRECON', 'ALNWICK', 'THIRSK', 'TENBY', 'BUXTON', 'RIPON', 'DEVIZES', 'OUNDLE', 'BALA', 'PEEBLES'];
  var SURNAMES = ['ASHDOWN', 'PENGELLY', 'TREVASKIS', 'HOLLOWAY', 'BRAITHWAITE', 'MOXON', 'CARLYON', 'FAIRWEATHER',
    'GARSIDE', 'KEMBLE', 'LOVIBOND', 'MERRYWEATHER', 'NANCARROW', 'OAKSHOTT', 'PRIDEAUX', 'ROWNTREE', 'SPARROW',
    'THWAITE', 'VOSPER', 'WHITLOCK', 'YARDLEY', 'DUNMORE', 'ELLERBY', 'HASKETT'];
  var TITLES = ['MRS', 'MR', 'MISS', 'REV', 'DR', 'CAPT'];
  var FIRST = ['ALICE', 'EDITH', 'FLORA', 'MAUD', 'NELLIE', 'ROSE', 'AGNES', 'HARRY', 'TOM', 'WILL', 'GEORGE',
    'ARTHUR', 'NED', 'JACK', 'KATE', 'LIZZIE', 'BERTIE', 'FRANK', 'ADA', 'JANE'];
  var DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'TOMORROW', 'TONIGHT'];
  var GOODS = [['BALES', 'WOOL'], ['EWES'], ['CASKS'], ['TONS', 'COAL'], ['SACKS', 'BARLEY'], ['CRATES', 'PILCHARDS']];
  var THINGS = ['UMBRELLA', 'BLACK', 'BAG', 'SHAWL', 'KEYS', 'MUSIC', 'LEDGER', 'BOOTS', 'SPECTACLES', 'TICKETS', 'PAPERS'];
  var REASONS = [['ROADS', 'FLOODED'], ['MOTHER', 'UNWELL'], ['SHOP', 'SHORTHANDED'], ['HORSE', 'LAME'],
    ['LINE', 'BLOCKED', 'BY', 'SNOW'], ['BOAT', 'NOT', 'SAILING']];
  var SHIPS = ['PELICAN', 'CORMORANT', 'ARIADNE', 'MAYFLOWER', 'SEAMEW', 'GLENDOWER', 'PROVIDENCE', 'SWIFTSURE', 'KITTIWAKE'];
  var HEADS = ['LIZARD', 'START', 'PORTLAND', 'BEACHY', 'FLAMBOROUGH', 'LUNDY', 'MUMBLES', 'FORELAND'];
  var INNS = ['ANGEL', 'BELL', 'GEORGE', 'SWAN', 'BULL', 'CROWN', 'FEATHERS', 'LAMB'];

  function timeTok(r) { return String(1 + Math.floor(r() * 11)) + pick(r, ['00', '10', '15', '20', '30', '40', '45', '50']); }
  var BODIES = [
    function (r, o) { return ['ARRIVING', o.near, timeTok(r), 'TRAIN', pick(r, DAYS), 'PLEASE', 'MEET']; },
    function (r) { return [pick(r, FIRST), 'SAFELY', 'DELIVERED', 'OF', 'A'].concat(pick(r, [['GIRL'], ['BOY'], ['FINE', 'BOY'], ['FINE', 'GIRL']])).concat(['BOTH', 'WELL']); },
    function (r) { return ['CANNOT', 'COME', pick(r, DAYS)].concat(pick(r, REASONS)); },
    function (r) { return ['SELL', String(4 + Math.floor(r() * 40))].concat(pick(r, GOODS)).concat(['AT', String(12 + Math.floor(r() * 50)), 'SHILLINGS', 'NOT', 'LESS']); },
    function (r, o) { return ['MISSED', 'CONNECTION', 'AT', o.near, 'HOME', 'BY', timeTok(r)]; },
    function (r) { return ['SHIP', pick(r, SHIPS), 'SIGHTED', 'OFF', pick(r, HEADS), 'DOCKING', pick(r, DAYS)]; },
    function (r) { return [pick(r, ['FATHER', 'MOTHER', 'UNCLE', 'GRANDMOTHER']), 'MUCH', 'BETTER', 'NO', 'NEED', 'TO', 'COME']; },
    function (r) { var a = pick(r, THINGS), b; do { b = pick(r, THINGS); } while (b === a); return ['BRING', a, 'AND', b, 'WE', 'LEAVE', pick(r, DAYS)]; },
    function (r) { return ['ROOMS', 'TAKEN', 'AT', 'THE', pick(r, INNS), 'FOR', String(2 + Math.floor(r() * 6)), 'NIGHTS']; },
    function (r, o) { return ['PARCEL', 'NOT', 'ARRIVED', 'PLEASE', 'ENQUIRE', 'AT', o.near, 'STATION']; }
  ];
  var TAILS = [['LETTER', 'FOLLOWS'], ['WIRE', 'REPLY'], ['REPLY', 'PAID'], ['ALL', 'WELL', 'HERE'], ['WRITING'], ['LOVE']];

  var CLERKS = ['Mr Penhaligon', 'Mr Gilbey', 'Miss Harker', 'Mr Teague', 'Miss Pollard', 'Mr Esslemont',
    'Miss Varley', 'Mr Rudd', 'Mr Quiller', 'Miss Dimond', 'Mr Abernethy', 'Miss Kerslake'];

  function build(seed) {
    var r = rng(seed);
    var D = { seed: seed };
    D.year = 1871 + Math.floor(r() * 35);
    D.from = pick(r, TOWNS);
    do { D.to = pick(r, TOWNS); } while (D.to === D.from);
    do { D.near = pick(r, TOWNS); } while (D.near === D.to);
    D.addressee = [pick(r, TITLES), pick(r, SURNAMES), D.to];
    var body = BODIES[Math.floor(r() * BODIES.length)](r, D);
    if (body.length < 9 || r() < 0.35) body = body.concat(pick(r, TAILS));
    body.push(pick(r, FIRST));
    D.words = body;
    D.handedH = 8 + Math.floor(r() * 10); D.handedM = Math.floor(r() * 60);
    D.clerk = pick(r, CLERKS);

    /* the far clerk's fist: every number below is in dot-lengths */
    var F = {};
    F.wpm = 13 + Math.floor(r() * 9);
    F.unitMs = 1200 / F.wpm;
    F.dash = lerp(2.55, 3.7, r());
    F.intra = lerp(0.85, 1.2, r());
    F.letter = lerp(2.2, 3.3, r());
    F.word = lerp(5.6, 8.2, r());
    F.jit = lerp(0.05, 0.14, r());
    F.crowd = lerp(0.03, 0.14, r());
    D.fist = F;
    D.storm = lerp(0.35, 1, r());
    D.clicks = 2 + Math.floor(r() * 5 + D.storm * 3);
    D.main = makeStrip(rng(mix(seed, 11)), D.words, F, D.storm, D.clicks, true);
    D.machine = machineRead(D.main);
    return D;
  }

  /* One strip of tape: marks in dot-lengths, with the kind of each mark and the kind of the space after it. */
  function makeStrip(r, words, F, storm, nClicks, noisy) {
    var marks = [], spans = [], t = 0, jit = noisy ? F.jit : F.jit * 0.4;
    function j() { return Math.max(0.55, 1 + gauss(r) * jit); }
    for (var wi = 0; wi < words.length; wi++) {
      var w = words[wi], t0 = t;
      for (var ci = 0; ci < w.length; ci++) {
        var code = MORSE[w[ci]];
        for (var ei = 0; ei < code.length; ei++) {
          var isDash = code[ei] === '-';
          var len = (isDash ? F.dash : 1) * j();
          var m = { t0: t, t1: t + len, kind: isDash ? 'dash' : 'dot', gap: null };
          marks.push(m); t += len;
          if (ei < code.length - 1) { m.gap = 'intra'; t += F.intra * j(); }
        }
        if (ci < w.length - 1) {
          var lg = F.letter * j();
          if (noisy && r() < F.crowd) lg = Math.max(F.intra * 1.15, lg * 0.52);
          marks[marks.length - 1].gap = 'letter'; t += lg;
        }
      }
      spans.push({ w: w, t0: t0, t1: t });
      if (wi < words.length - 1) { marks[marks.length - 1].gap = 'word'; t += F.word * j(); }
    }
    var total = t;
    if (noisy) {
      /* the line drops out for an instant in the middle of a dash, more often as the weather comes in */
      var out = [];
      marks.forEach(function (m) {
        var p = 0.015 + 0.11 * storm * Math.pow(m.t0 / total, 1.4);
        if (m.kind === 'dash' && r() < p) {
          var len = m.t1 - m.t0, cut = lerp(0.35, 0.65, r()) * len, hole = lerp(0.3, 0.75, r());
          out.push({ t0: m.t0, t1: m.t0 + cut - hole / 2, kind: 'frag', gap: 'noise' });
          out.push({ t0: m.t0 + cut + hole / 2, t1: m.t1, kind: 'frag', gap: m.gap });
        } else out.push(m);
      });
      marks = out;
      /* clicks of static in the spaces, crowding toward the end */
      for (var k = 0; k < nClicks; k++) {
        for (var tries = 0; tries < 40; tries++) {
          var at = Math.pow(r(), 0.55) * total, i;
          for (i = 0; i < marks.length - 1; i++) if (marks[i + 1].t0 > at) break;
          if (i >= marks.length - 1) continue;
          var g0 = marks[i].t1, g1 = marks[i + 1].t0;
          if (g1 - g0 < 1.9) continue;
          var len2 = lerp(0.15, 0.5, r());
          var c0 = lerp(g0 + 0.6, g1 - 0.6 - len2, r());
          marks.splice(i + 1, 0, { t0: c0, t1: c0 + len2, kind: 'noise', gap: 'noise' });
          marks[i].gap = 'noise';
          break;
        }
      }
    }
    return { words: words, marks: marks, spans: spans, total: total };
  }

  /* ---------- the office's mechanical reader ---------- */
  function quant(a, p) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
  /* natural breaks: split sorted log-lengths into k heaps with the least spread inside each */
  function breaks(vals, k) {
    var v = vals.slice().sort(function (a, b) { return a - b; }), n = v.length, P = [0], Q = [0];
    for (var i = 0; i < n; i++) { P.push(P[i] + v[i]); Q.push(Q[i] + v[i] * v[i]); }
    function sse(a, b) { var m = b - a; if (m <= 0) return 0; var s = P[b] - P[a]; return Q[b] - Q[a] - s * s / m; }
    var best = Infinity, cut = [];
    if (k === 2) {
      for (var c = 1; c < n; c++) { var e = sse(0, c) + sse(c, n); if (e < best) { best = e; cut = [c]; } }
    } else {
      for (var c1 = 1; c1 < n - 1; c1++) for (var c2 = c1 + 1; c2 < n; c2++) {
        var e2 = sse(0, c1) + sse(c1, c2) + sse(c2, n); if (e2 < best) { best = e2; cut = [c1, c2]; }
      }
    }
    return cut.map(function (c) { return Math.exp((v[c - 1] + v[c]) / 2); });
  }
  function machineRead(strip) {
    /* it ignores anything shorter than a third of the middling mark, as a relay would */
    var med = quant(strip.marks.map(function (m) { return m.t1 - m.t0; }), 0.5);
    var M = strip.marks.filter(function (m) { return m.t1 - m.t0 > med / 3; });
    var ml = M.map(function (m) { return Math.log(m.t1 - m.t0); });
    var gl = [];
    for (var i = 0; i < M.length - 1; i++) gl.push(Math.log(M[i + 1].t0 - M[i].t1));
    var mth = breaks(ml, 2)[0], gb = breaks(gl, 3), g1 = gb[0], g2 = gb[1];
    var out = '', cur = '';
    function flush() { if (cur) { out += DEMORSE[cur] || '?'; cur = ''; } }
    for (var k = 0; k < M.length; k++) {
      cur += (M[k].t1 - M[k].t0) > mth ? '-' : '.';
      if (k < M.length - 1) {
        var g = M[k + 1].t0 - M[k].t1;
        if (g > g2) { flush(); out += ' '; } else if (g > g1) flush();
      }
    }
    flush();
    return { text: out.replace(/\s+/g, ' ').trim(), markTh: mth, gapTh: [g1, g2] };
  }

  /* ---------- scoring ---------- */
  function norm(s) { return String(s).toUpperCase().replace(/[^A-Z0-9?]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function lev(a, b) {
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function charAcc(truth, copy) { return Math.max(0, 1 - lev(truth, copy) / truth.length); }
  /* word alignment: returns ops [{t: truthWord|null, c: copyWord|null}] */
  function alignWords(T, C) {
    var n = T.length, m = C.length, d = [], i, j;
    for (i = 0; i <= n; i++) { d[i] = []; for (j = 0; j <= m; j++) d[i][j] = i === 0 ? j : j === 0 ? i : 0; }
    for (i = 1; i <= n; i++) for (j = 1; j <= m; j++) {
      var sub = T[i - 1] === C[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub);
    }
    var ops = []; i = n; j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (T[i - 1] === C[j - 1] ? 0 : 1)) { ops.push({ t: T[i - 1], c: C[j - 1] }); i--; j--; }
      else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push({ t: T[i - 1], c: null }); i--; }
      else { ops.push({ t: null, c: C[j - 1] }); j--; }
    }
    return ops.reverse();
  }

  if (typeof module !== 'undefined' && typeof window === 'undefined') {
    module.exports = { build: build, makeStrip: makeStrip, machineRead: machineRead, seedForDate: seedForDate, charAcc: charAcc, norm: norm, alignWords: alignWords, rng: rng, mix: mix };
    return;
  }

  /* ================= page ================= */
  function $(id) { return document.getElementById(id); }
  var cv = $('tape'), ctx = cv.getContext('2d');
  var dayOff = 0, D = null, st = null, L = null, hover = null, audio = null;

  function fresh() { return { repeats: [], done: false, result: null }; }

  function load() {
    stopAudio();
    var date = dateFor(dayOff);
    D = build(seedForDate(date));
    st = fresh();
    $('copy').value = '';
    $('copy').disabled = false;
    $('dayOut').textContent = longDate(date) + (dayOff === 0 ? ' · today' : '');
    var F = D.fist;
    $('plWho').textContent = 'Handed in at ' + cap(D.from) + ' · ' + D.year;
    $('plName').textContent = cap(D.from) + ' to ' + cap(D.to);
    var traits = [];
    traits.push('sends at ' + F.wpm + ' words a minute');
    if (F.dash > 3.3) traits.push('holds his dashes long');
    else if (F.dash < 2.85) traits.push('clips his dashes short');
    if (F.letter < 2.55) traits.push('crowds his letters together');
    else if (F.letter > 3.05) traits.push('leaves good room between letters');
    if (F.jit > 0.11) traits.push('has an uneven hand');
    else if (F.jit < 0.075) traits.push('keeps a very steady hand');
    var who = D.clerk, her = /Miss/.test(who);
    var tr = traits.join(', ').replace(/ his /g, her ? ' her ' : ' his ');
    tr = tr.replace(/, ([^,]*)$/, ' and $1');
    var weather = D.storm > 0.75 ? 'There is weather coming over the hills between the two offices, and the line will be poor by the end.'
      : D.storm > 0.5 ? 'The line is fair, but there is rain about and it will crackle toward the end.'
      : 'The line is quiet today, with only the odd click of static.';
    $('plBlurb').innerHTML = '<b>' + esc(who) + '</b> at ' + esc(cap(D.from)) + ' ' + esc(tr) + '. ' + esc(weather) +
      ' The inker at ' + esc(cap(D.to)) + ' has run the message off onto tape. Read it, write out the copy and send it out with the boy. ' +
      'You may wire back for <b>two words</b> to be repeated: click a word on the tape.';
    var after85 = D.year >= 1885;
    var chargeWords = D.words.length + (after85 ? D.addressee.length : 0);
    var charge = after85 ? 6 + Math.max(0, chargeWords - 12) * 0.5 : 12 + Math.max(0, Math.ceil((chargeWords - 20) / 5)) * 3;
    $('form').innerHTML =
      '<div><span>Office of origin</span><b>' + esc(cap(D.from)) + '</b></div>' +
      '<div><span>Handed in</span><b>' + D.handedH % 12 + '.' + (D.handedM < 10 ? '0' : '') + D.handedM + (D.handedH < 12 ? ' a.m.' : ' p.m.') + '</b></div>' +
      '<div><span>Words</span><b>' + D.words.length + '</b></div>' +
      '<div><span>Charge</span><b>' + money(charge) + '</b></div>' +
      '<div class="wide"><span>To</span><b>' + esc(D.addressee.join(' ')) + '</b></div>';
    $('msg').textContent = '';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('analysis').innerHTML = '';
    $('rptLeft').textContent = 'Repeats left: 2';
    layout(); draw();
  }
  function cap(s) { return s.charAt(0) + s.slice(1).toLowerCase(); }
  function money(d) {
    var s = Math.floor(d / 12), p = d - s * 12, ps = p === Math.floor(p) ? String(p) : (Math.floor(p) ? Math.floor(p) : '') + '½';
    return (s ? s + 's. ' : '') + (p ? ps + 'd.' : (s ? '' : '0d.'));
  }

  /* ---------- layout of the tape strips on the form ---------- */
  function strips() { return [{ s: D.main, label: null, main: true }].concat(st.repeats.map(function (rp) { return { s: rp.strip, label: 'Repeated at your request: word ' + (rp.idx + 1), main: false, idx: rp.idx }; })); }
  function layout() {
    var cssW = cv.clientWidth || 800, dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cssW, ppu = Math.max(3.4, Math.min(8, W / 105)), mg = 14, rowH = 46, y = 12;
    var out = [];
    strips().forEach(function (S) {
      var s = S.s, lay = { S: S, ppu: ppu, wx: [], wrow: [], rows: [] };
      if (S.label) { y += 10; lay.labelY = y + 10; y += 20; }
      var x = mg, row = 0; lay.rows.push(y);
      s.spans.forEach(function (sp, k) {
        var w = (sp.t1 - sp.t0) * ppu;
        if (x + w > W - mg && x > mg) { row++; x = mg; lay.rows.push(y + row * rowH); }
        lay.wx[k] = x; lay.wrow[k] = row;
        var nx = k < s.spans.length - 1 ? s.spans[k + 1].t0 : sp.t1;
        x += w + Math.max(12, (nx - sp.t1) * ppu);
      });
      y += (row + 1) * rowH;
      out.push(lay);
    });
    var H = y + 8;
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = { W: W, H: H, mg: mg, lays: out };
  }
  function wordAt(lay, t) {
    var sp = lay.S.s.spans, k = 0;
    while (k < sp.length - 1 && sp[k + 1].t0 <= t) k++;
    return k;
  }
  function posOf(lay, t) {
    var k = wordAt(lay, t), sp = lay.S.s.spans[k];
    return { x: lay.wx[k] + (t - sp.t0) * lay.ppu, y: lay.rows[lay.wrow[k]], k: k };
  }

  function draw(playT) {
    if (!L) return;
    var W = L.W, H = L.H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e6dcc0'; ctx.fillRect(0, 0, W, H);
    L.lays.forEach(function (lay, li) {
      var s = lay.S.s;
      if (lay.S.label) {
        ctx.fillStyle = '#7a5a2a'; ctx.font = '600 11px ui-monospace,Menlo,monospace';
        ctx.fillText(lay.S.label.toUpperCase(), L.mg, lay.labelY);
      }
      /* paper strips, one per run of words on a row */
      var runs = {};
      s.spans.forEach(function (sp, k) {
        var r = lay.wrow[k], x0 = lay.wx[k] - 8, x1 = lay.wx[k] + (sp.t1 - sp.t0) * lay.ppu + 8;
        if (!runs[r]) runs[r] = [x0, x1]; else { runs[r][0] = Math.min(runs[r][0], x0); runs[r][1] = Math.max(runs[r][1], x1); }
      });
      Object.keys(runs).forEach(function (r) {
        var y = lay.rows[r] + 14, a = runs[r];
        ctx.fillStyle = 'rgba(80,60,20,.18)'; ctx.fillRect(a[0] + 2, y + 2, a[1] - a[0], 20);
        ctx.fillStyle = '#fbf6e8'; ctx.fillRect(a[0], y, a[1] - a[0], 20);
      });
      s.spans.forEach(function (sp, k) {
        var x = lay.wx[k], y = lay.rows[lay.wrow[k]];
        var isHover = hover && hover.li === li && hover.k === k && lay.S.main && !st.done;
        if (isHover) {
          ctx.strokeStyle = 'rgba(200,60,40,.7)'; ctx.lineWidth = 1.5;
          ctx.strokeRect(x - 5, y + 11, (sp.t1 - sp.t0) * lay.ppu + 10, 26);
        }
        var num = String(k + (lay.S.main ? 1 : lay.S.idx + 1));
        ctx.fillStyle = 'rgba(122,90,42,.75)'; ctx.font = '600 9px ui-monospace,Menlo,monospace';
        ctx.fillText(num, x, y + 9);
        if (st.done && lay.S.main) {
          ctx.fillStyle = '#2f6b4f'; ctx.font = '700 10px ui-monospace,Menlo,monospace';
          ctx.fillText(sp.w, x + ctx.measureText(num).width + 8, y + 9);
        }
      });
      s.marks.forEach(function (m) {
        var a = posOf(lay, m.t0), b = posOf(lay, m.t1);
        if (b.y !== a.y) b = { x: a.x + (m.t1 - m.t0) * lay.ppu, y: a.y };
        var x1 = Math.min(b.x, W - 6);
        ctx.fillStyle = st.done && (m.kind === 'noise' || m.kind === 'frag') ? '#c0392b' : '#2d2a52';
        ctx.fillRect(a.x, a.y + 21.5, Math.max(1.2, x1 - a.x), 5);
      });
      if (playT && playT.li === li) {
        var p = posOf(lay, playT.t);
        ctx.strokeStyle = '#d0402a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y + 10); ctx.lineTo(p.x, p.y + 38); ctx.stroke();
      }
    });
  }

  /* ---------- pointer: gauge and repeats ---------- */
  function hit(e) {
    var rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    for (var li = 0; li < L.lays.length; li++) {
      var lay = L.lays[li], s = lay.S.s;
      for (var k = 0; k < s.spans.length; k++) {
        var ry = lay.rows[lay.wrow[k]], x0 = lay.wx[k], x1 = x0 + (s.spans[k].t1 - s.spans[k].t0) * lay.ppu;
        if (y >= ry + 8 && y <= ry + 40 && x >= x0 - 8 && x <= x1 + 8) {
          var t = s.spans[k].t0 + (x - x0) / lay.ppu, mi = -1;
          for (var q = 0; q < s.marks.length; q++) if (s.marks[q].t0 - 0.25 <= t && t <= s.marks[q].t1 + 0.25) { mi = q; break; }
          return { li: li, k: k, mi: mi, lay: lay };
        }
      }
    }
    return null;
  }
  cv.addEventListener('mousemove', function (e) {
    var h = hit(e), prev = hover;
    hover = h;
    if (h && h.mi >= 0) {
      var M = h.lay.S.s.marks, m = M[h.mi];
      var s = 'Gauge: mark ' + (m.t1 - m.t0).toFixed(1) + ' dots long';
      if (h.mi > 0) s += ' · space before it ' + (m.t0 - M[h.mi - 1].t1).toFixed(1);
      if (h.mi < M.length - 1) s += ' · space after it ' + (M[h.mi + 1].t0 - m.t1).toFixed(1);
      $('gauge').textContent = s;
    } else $('gauge').textContent = h && h.lay.S.main && !st.done ? 'Click to wire back for word ' + (h.k + 1) + ' to be repeated.' : 'Gauge: hover over a mark to measure it against the sender’s dot.';
    if ((prev && prev.k) !== (h && h.k) || (prev && prev.li) !== (h && h.li)) draw();
  });
  cv.addEventListener('mouseleave', function () { hover = null; draw(); });
  cv.addEventListener('click', function (e) {
    var h = hit(e);
    if (!h || !h.lay.S.main || st.done) return;
    if (st.repeats.some(function (rp) { return rp.idx === h.k; })) { say('Word ' + (h.k + 1) + ' has already been repeated; it is below the message.'); return; }
    if (st.repeats.length >= 2) { say('The far office has repeated two words for you already. Any more and the telegram would be late.'); return; }
    var idx = h.k;
    var strip = makeStrip(rng(mix(D.seed, 300 + idx)), [D.words[idx]], D.fist, 0, 0, false);
    st.repeats.push({ idx: idx, strip: strip });
    $('rptLeft').textContent = 'Repeats left: ' + (2 - st.repeats.length);
    say('Wired back “RPT ' + (idx + 1) + '”. The far office has sent word ' + (idx + 1) + ' again on a clean line; it is pasted below the message.');
    layout(); draw();
  });
  function say(s) { $('msg').textContent = s; }

  /* ---------- sound: a sounder's clicks, or a tone ---------- */
  function stopAudio() {
    if (!audio) return;
    try { audio.master.disconnect(); } catch (e) { /* already gone */ }
    if (audio.osc) try { audio.osc.stop(); } catch (e) { /* already stopped */ }
    cancelAnimationFrame(audio.raf);
    audio = null;
    $('btnPlay').textContent = 'Listen to the line';
    draw();
  }
  var AC = null;
  function play(which) {
    stopAudio();
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { say('This browser has no Web Audio, so the line is silent. The tape is all you need.'); return; }
    if (!AC) AC = new Ctor();
    if (AC.state === 'suspended') AC.resume();
    var rate = parseFloat($('speed').value), mode = $('voice').value;
    var unit = D.fist.unitMs / 1000 / rate;
    var master = AC.createGain(); master.gain.value = 0.22; master.connect(AC.destination);
    var t0 = AC.currentTime + 0.15, seq = [], off = 0;
    L.lays.forEach(function (lay, li) {
      if (which === 'main' ? !lay.S.main : lay.S.main) return;
      seq.push({ li: li, start: off, dur: lay.S.s.total + 3 });
      off += lay.S.s.total + 3;
    });
    if (!seq.length) return;
    var osc = null, g = null;
    if (mode === 'tone') {
      osc = AC.createOscillator(); osc.frequency.value = 660; g = AC.createGain(); g.gain.value = 0;
      osc.connect(g); g.connect(master); osc.start(t0);
    }
    var nb = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.03), AC.sampleRate), nd = nb.getChannelData(0);
    var rr = rng(7);
    for (var i = 0; i < nd.length; i++) nd[i] = (rr() * 2 - 1) * Math.exp(-i / (nd.length * 0.18));
    function click(at, loud, f) {
      var src = AC.createBufferSource(); src.buffer = nb;
      var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
      var cg = AC.createGain(); cg.gain.value = loud;
      src.connect(bp); bp.connect(cg); cg.connect(master); src.start(at);
    }
    seq.forEach(function (q) {
      L.lays[q.li].S.s.marks.forEach(function (m) {
        var a = t0 + (q.start + m.t0) * unit, b = t0 + (q.start + m.t1) * unit;
        if (mode === 'tone') { g.gain.setTargetAtTime(1, a, 0.004); g.gain.setTargetAtTime(0, b, 0.004); }
        else { click(a, 2.4, 1900); click(b, 1.1, 1200); }
      });
    });
    var end = t0 + off * unit;
    if (osc) osc.stop(end + 0.2);
    audio = { master: master, osc: osc, raf: 0 };
    $('btnPlay').textContent = 'Stop';
    (function tick() {
      if (!audio) return;
      var now = AC.currentTime;
      if (now > end) { stopAudio(); return; }
      var u = (now - t0) / unit, cur = null;
      seq.forEach(function (q) { if (u >= q.start && u < q.start + q.dur) cur = { li: q.li, t: Math.min(u - q.start, L.lays[q.li].S.s.total) }; });
      draw(cur && cur.t >= 0 ? cur : null);
      audio.raf = requestAnimationFrame(tick);
    })();
  }
  $('btnPlay').addEventListener('click', function () { if (audio) stopAudio(); else play('main'); });
  $('btnPlayRpt').addEventListener('click', function () {
    if (!st.repeats.length) { say('Nothing has been repeated yet. Click a word on the tape to ask for it again.'); return; }
    play('repeats');
  });

  /* ---------- the code card ---------- */
  (function () {
    var html = '';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').forEach(function (k) {
      html += '<span><b>' + k + '</b><i>' + MORSE[k].replace(/\./g, '•').replace(/-/g, '—') + '</i></span>';
    });
    $('card').innerHTML = html;
  })();

  /* ---------- delivery ---------- */
  $('btnDeliver').addEventListener('click', function () {
    if (st.done) return;
    var copy = norm($('copy').value);
    if (!copy) { say('The form is blank. Write out what the tape says first.'); return; }
    stopAudio();
    st.done = true; $('copy').disabled = true;
    var truth = D.words.join(' ');
    var acc = charAcc(truth, copy), macc = charAcc(truth, D.machine.text);
    var ops = alignWords(D.words, copy.split(' '));
    var right = ops.filter(function (o) { return o.t && o.t === o.c; }).length;
    var html = '<div class="copyline">';
    ops.forEach(function (o) {
      if (o.t && o.t === o.c) html += '<span class="w ok">' + esc(o.t) + '</span>';
      else if (o.t && o.c) html += '<span class="w bad"><s>' + esc(o.c) + '</s>' + esc(o.t) + '</span>';
      else if (o.t) html += '<span class="w miss"><s>—</s>' + esc(o.t) + '</span>';
      else html += '<span class="w extra"><s>' + esc(o.c) + '</s></span>';
    });
    html += '</div>';
    var mops = alignWords(D.words, D.machine.text.split(' '));
    var mright = mops.filter(function (o) { return o.t && o.t === o.c; }).length;
    var grade, cls;
    if (acc === 1) { grade = '<b>A clean copy.</b> Every letter as it was handed in at ' + esc(cap(D.from)) + '. The boy can take it out.'; cls = 'good'; }
    else if (acc >= 0.95) { grade = '<b>Fit to go out, just.</b> ' + numw(D.words.length - right) + ' word' + (D.words.length - right === 1 ? '' : 's') + ' came out wrong, and a reader would most likely make sense of it anyway.'; cls = 'good'; }
    else if (acc >= 0.8) { grade = '<b>The supervisor sends it back.</b> ' + numw(right) + ' of ' + numw(D.words.length) + ' words right: enough to read the gist, not enough to put a name or a time on it.'; cls = 'warn'; }
    else { grade = '<b>Not fit to deliver.</b> ' + (right ? 'Only ' + numw(right) : 'None') + ' of the ' + numw(D.words.length) + ' words came out right.'; cls = 'warn'; }
    var cmp = acc > macc + 0.005 ? 'You beat the mechanical reader, which got ' + Math.round(macc * 100) + '% of the letters and ' + numw(mright) + ' words right.'
      : acc + 0.005 < macc ? 'The mechanical reader did better, with ' + Math.round(macc * 100) + '% of the letters and ' + numw(mright) + ' words right.'
      : 'You and the mechanical reader came out level, at ' + Math.round(macc * 100) + '% of the letters.';
    $('verdict').className = 'verdict ' + cls;
    $('verdict').innerHTML = '<p>' + grade + '</p><p>Your copy, letter by letter: <b>' + Math.round(acc * 100) + '%</b>. ' + cmp +
      (st.repeats.length ? ' You asked for ' + numw(st.repeats.length) + ' repeat' + (st.repeats.length > 1 ? 's' : '') + '.' : ' You asked for no repeats.') + '</p>' +
      '<h5>As handed in, with your copy struck through where it differs</h5>' + html +
      '<h5>What the mechanical reader made of the tape</h5><p class="mono">' + esc(D.machine.text) + '</p>';
    analysis();
    layout(); draw();
  });

  /* ---------- after delivery: why the tape reads the way it does ---------- */
  function analysis() {
    var M = D.main.marks, F = D.fist;
    var lo = Math.log(0.1), hi = Math.log(12), NB = 44;
    function bin(v) { return Math.max(0, Math.min(NB - 1, Math.floor((Math.log(v) - lo) / (hi - lo) * NB))); }
    function hist(items, kinds, ths, title) {
      var H = {}; kinds.forEach(function (k) { H[k[0]] = new Array(NB).fill(0); });
      items.forEach(function (it) { if (H[it.k]) H[it.k][bin(it.v)]++; });
      var mx = 1;
      for (var b = 0; b < NB; b++) { var s = 0; kinds.forEach(function (k) { s += H[k[0]][b]; }); mx = Math.max(mx, s); }
      var W = 560, Hh = 150, pl = 30, pb = 26, bw = (W - pl - 10) / NB;
      var svg = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(title) + '">';
      [0.25, 0.5, 1, 2, 3, 5, 8].forEach(function (v) {
        var x = pl + (Math.log(v) - lo) / (hi - lo) * (W - pl - 10);
        svg += '<line class="gd" x1="' + x + '" x2="' + x + '" y1="8" y2="' + (Hh - pb) + '"/><text class="ax" x="' + x + '" y="' + (Hh - 8) + '" text-anchor="middle">' + v + '</text>';
      });
      for (var b2 = 0; b2 < NB; b2++) {
        var y = Hh - pb;
        kinds.forEach(function (k) {
          var c = H[k[0]][b2]; if (!c) return;
          var h = c / mx * (Hh - pb - 12);
          svg += '<rect x="' + (pl + b2 * bw + 1) + '" y="' + (y - h) + '" width="' + Math.max(1, bw - 2) + '" height="' + h + '" fill="' + k[2] + '"/>';
          y -= h;
        });
      }
      ths.forEach(function (t) {
        var x = pl + (Math.log(t) - lo) / (hi - lo) * (W - pl - 10);
        svg += '<line class="th" x1="' + x + '" x2="' + x + '" y1="4" y2="' + (Hh - pb) + '"/>';
      });
      svg += '</svg>';
      var leg = '<div class="legend">' + kinds.map(function (k) { return '<span><i style="background:' + k[2] + '"></i>' + k[1] + '</span>'; }).join('') +
        '<span><i class="dash"></i>where the reader cut</span></div>';
      return '<h5>' + esc(title) + '</h5><div class="chart">' + svg + '</div>' + leg;
    }
    var marks = M.map(function (m) { return { v: m.t1 - m.t0, k: m.kind }; });
    var gaps = [];
    for (var i = 0; i < M.length - 1; i++) gaps.push({ v: M[i + 1].t0 - M[i].t1, k: M[i].gap });
    var out = hist(marks, [['dot', 'dots', '#7aa2ff'], ['dash', 'dashes', '#64f0c8'], ['frag', 'dashes broken by the line', '#ff9f6a'], ['noise', 'static', '#ff5d6c']], [D.machine.markTh], 'Every mark on the tape, by length in dots');
    out += hist(gaps, [['intra', 'inside a letter', '#7aa2ff'], ['letter', 'between letters', '#64f0c8'], ['word', 'between words', '#ffce6a'], ['noise', 'broken by static', '#ff5d6c']], D.machine.gapTh, 'Every space on the tape, by length in dots');
    var crowded = gaps.filter(function (g) { return g.k === 'letter' && g.v < D.machine.gapTh[0]; }).length;
    out += '<p class="formula">' + esc(D.clerk) + '’s dot was <b>' + Math.round(F.unitMs) + ' ms</b>; dashes averaged <b>' + F.dash.toFixed(1) +
      '</b> dots, spaces between letters <b>' + F.letter.toFixed(1) + '</b> and between words <b>' + F.word.toFixed(1) + '</b>. ' +
      (crowded ? numw(crowded).charAt(0).toUpperCase() + numw(crowded).slice(1) + ' letter space' + (crowded > 1 ? 's were' : ' was') + ' sent so short the reader ran the letters together. ' : '') +
      'The red marks on the tape above are the line, not the sender.</p>';
    $('analysis').innerHTML = out;
  }

  $('btnReset').addEventListener('click', function () { load(); });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
  });
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); draw(); }, 120); });

  load();
})();
