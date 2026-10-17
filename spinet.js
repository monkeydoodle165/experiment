/* drift.quibo.games — The Spinet
   A tuner's morning in a Georgian music room. The day's number picks a town and a year between
   1725 and 1799, an instrument (spinet, harpsichord, clavichord, or after 1766 a square piano),
   a pitch for the tuning fork and a temperament the owner wants: quarter- or sixth-comma meantone,
   Werckmeister III, Vallotti, Kirnberger III or equal. The strings have drifted since the last visit.

   Nothing is tuned by a number on the screen. The page lays a bearing up the octave from the fork,
   fifth by fourth by fifth, the way tuners did, and for every string the book only says how fast the
   interval should beat: pure, or narrow or wide at so many beats a second. A beat is the difference
   between the two partials that nearly coincide: 3 x the lower note against 2 x the upper in a fifth,
   4 x against 3 x in a fourth. You hear it (Web Audio, harmonic strings) and you see its envelope.

   Each temperament is defined the way its author defined it, as how much of the Pythagorean or
   syntonic comma each of the eleven fifths from E flat to G sharp gives up, and the twelve pitches
   are worked out from that. Self-contained. */
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
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function sgn(x) { return (x > 0 ? '+' : x < 0 ? '−' : '±') + f1(Math.abs(x)); }

  /* ---------- music ---------- */
  var NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
  var KEYNAME = ['C', 'D flat', 'D', 'E flat', 'E', 'F', 'F sharp', 'G', 'A flat', 'A', 'B flat', 'B'];
  var PC = 23.460, SC = 21.506, SCHISMA = PC - SC;
  var PURE5 = 701.955, PURE3 = 386.314;
  /* the chain of fifths each temperament is written on: E flat, B flat, F, C, G, D, A, E, B, F sharp, C sharp, G sharp */
  var CHAIN = [3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1, 8];

  var TEMPS = [
    { id: 'q', name: 'quarter-comma meantone', who: 'after Pietro Aron, 1523', from: 0, w: 3,
      fifths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(function () { return SC / 4; }),
      blurb: 'Every fifth gives up a quarter of the syntonic comma so that eight of the major thirds come out dead pure. The four that are left are not thirds at all, and the fifth from G sharp to E flat howls: the wolf. Play in the keys near C and nothing is sweeter.' },
    { id: 's', name: 'sixth-comma meantone', who: 'as the organ builders liked it', from: 0, w: 2,
      fifths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(function () { return SC / 6; }),
      blurb: 'Every fifth gives up a sixth of the syntonic comma. The thirds are no longer pure but only a little wide, and the wolf is tamer, so a few more keys can be borrowed.' },
    { id: 'w', name: 'Werckmeister III', who: 'from Andreas Werckmeister’s book of 1691', from: 0, w: 3,
      fifths: [0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0].map(function (k) { return k * PC / 4; }),
      blurb: 'Four fifths (C to G, G to D, D to A and B to F sharp) each give up a quarter of the Pythagorean comma and the other eight are pure. Every key can be played, and each sounds a little different from the next.' },
    { id: 'v', name: 'Vallotti', who: 'as the Paduan friar Francescantonio Vallotti tuned it', from: 1754, w: 3,
      fifths: [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0].map(function (k) { return k * PC / 6; }),
      blurb: 'The six fifths from F to B each give up a sixth of the Pythagorean comma and the six from B round to F are pure. The keys with few sharps or flats are best and the far ones are only a little rougher.' },
    { id: 'k', name: 'Kirnberger III', who: 'as Johann Philipp Kirnberger printed it in 1779', from: 1779, w: 3,
      fifths: [0, 0, 0, SC / 4, SC / 4, SC / 4, SC / 4, 0, 0, SCHISMA, 0],
      blurb: 'The four fifths from C to E each give up a quarter of the syntonic comma, so C to E is a pure third; F sharp to C sharp gives up the little schisma that is left, and every other fifth is pure.' },
    { id: 'e', name: 'equal temperament', who: 'as the mathematicians would have it', from: 0, w: 1,
      fifths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(function () { return PC / 12; }),
      blurb: 'Every fifth gives up a twelfth of the Pythagorean comma, so every key is exactly like every other. Many players of the day thought that was precisely what was wrong with it.' }
  ];

  /* cents from equal temperament of each pitch class, with A at 0 */
  function offsets(fifths) {
    var pos = {}, c = 0;
    pos[CHAIN[0]] = 0;
    for (var i = 0; i < 11; i++) { c += PURE5 - fifths[i]; pos[CHAIN[i + 1]] = c; }
    var off = [];
    for (var pc = 0; pc < 12; pc++) {
      var x = pos[pc] - (pc - 3) * 100;
      x = ((x % 1200) + 1800) % 1200 - 600;
      off[pc] = x;
    }
    var a = off[9];
    return off.map(function (x) { return x - a; });
  }
  function fifthDev(off, pc) { return 700 + off[(pc + 7) % 12] - off[pc] - PURE5; }
  function thirdDev(off, pc) { return 400 + off[(pc + 4) % 12] - off[pc] - PURE3; }

  /* the bearing: [string tuned, from, kind, tuned is the lower note] */
  var BEARING = [
    [9, -1, 'unison', false],
    [4, 9, 'fourth', true], [11, 4, 'fifth', false], [6, 11, 'fourth', true], [1, 6, 'fourth', true], [8, 1, 'fifth', false],
    [2, 9, 'fifth', true], [7, 2, 'fourth', false], [0, 7, 'fifth', true], [5, 0, 'fourth', false], [10, 5, 'fourth', false], [3, 10, 'fifth', true]
  ];
  var RATIO = { unison: [1, 1], fifth: [3, 2], fourth: [4, 3] };
  var KINDWORD = { unison: 'unison', fifth: 'fifth', fourth: 'fourth' };

  /* ---------- the day ---------- */
  var TOWNS = ['Bath', 'Norwich', 'York', 'Lichfield', 'Bristol', 'Salisbury', 'Edinburgh', 'Shrewsbury', 'Dublin', 'Chester', 'Winchester', 'Durham'];
  var OWNERS = ['Mrs Ashworth', 'the Revd Mr Pettifer', 'Miss Cotterell', 'Dr Halloran', 'Lady Brereton', 'Mr Ingleby', 'the Misses Fairlie',
    'Captain Ord', 'Mrs Delacourt', 'Mr Tregarthen', 'Miss Pomfret', 'the Dean’s widow'];
  var ROOMS = ['the first-floor drawing room', 'a music room over the street', 'the parlour behind the shop', 'a cold library with a good fire laid',
    'the long room at the back of the house', 'a panelled closet hardly bigger than the instrument'];
  var OCCASIONS = ['a musical evening for twelve', 'a lesson for the youngest daughter', 'the curate and his flute after supper',
    'a subscription concert in the assembly rooms', 'a quartet of amateurs who play every Thursday', 'a singer engaged for the race week'];
  var PIECES = ['a sonata', 'a set of lessons', 'a concerto with the strings', 'a song with a figured bass', 'a chaconne', 'variations on a Scotch tune'];
  var INSTR = [
    { name: 'a bentside spinet', short: 'spinet', from: 0, tilt: 0.75 },
    { name: 'a single-manual harpsichord', short: 'harpsichord', from: 0, tilt: 0.6 },
    { name: 'a double-manual harpsichord', short: 'harpsichord', from: 0, tilt: 0.55 },
    { name: 'a fretless clavichord', short: 'clavichord', from: 0, tilt: 1.15 },
    { name: 'a new square piano', short: 'square piano', from: 1766, tilt: 1.0 }
  ];
  var FORKS = [409, 415, 418, 422.5, 427, 430];

  function build(date) {
    var r = rng(mix(seedForDate(date), 47)), D = { date: date };
    D.year = 1725 + Math.floor(r() * 75);
    D.town = pick(r, TOWNS); D.owner = pick(r, OWNERS); D.room = pick(r, ROOMS);
    D.occasion = pick(r, OCCASIONS); D.piece = pick(r, PIECES);
    var ins = INSTR.filter(function (x) { return D.year >= x.from; });
    D.inst = pick(r, ins);
    var ts = [];
    TEMPS.forEach(function (t) { if (D.year >= t.from) for (var i = 0; i < t.w; i++) ts.push(t); });
    D.temp = pick(r, ts);
    D.fork = pick(r, FORKS);
    D.target = offsets(D.temp.fifths);
    /* the owner's key: one of the five sweetest tonic thirds; the visitor's key: the roughest */
    var keys = [];
    for (var k = 0; k < 12; k++) keys.push({ k: k, d: thirdDev(D.target, k) + Math.abs(fifthDev(D.target, k)) * 0.3 + r() * 0.01 });
    keys.sort(function (a, b) { return a.d - b.d; });
    D.key = keys[Math.floor(r() * 5)].k;
    D.far = keys[11].k;
    if (D.far === D.key) D.far = keys[10].k;
    /* the strings have drifted since the tuner last came */
    D.start = D.target.map(function (t) {
      var x = t + (r() < 0.5 ? -1 : 1) * (5 + r() * 22);
      return Math.max(-45, Math.min(45, x));
    });
    return D;
  }

  /* ---------- state ---------- */
  var dayOff = 0, D = null, pins = null, step = 0, reach = 0, finished = false;

  function freq(pc, o) { return D.fork * Math.pow(2, (pc - 9) / 12 + (o || pins)[pc] / 1200); }
  function stepInfo(i, o) {
    var b = BEARING[i], kind = b[2], ra = RATIO[kind];
    var ft = freq(b[0], o), fr = b[1] < 0 ? D.fork : freq(b[1], o);
    var lo = b[3] ? ft : fr, hi = b[3] ? fr : ft;
    if (kind === 'unison') { lo = D.fork; hi = ft; }
    var s = ra[0] * lo - ra[1] * hi;            /* > 0: narrow (upper flat of pure) */
    return { kind: kind, lo: lo, hi: hi, p: ra[0], q: ra[1], s: s, beat: Math.abs(s), ft: ft, fr: fr };
  }
  function amp(n) { return Math.pow(n, -D.inst.tilt); }

  /* ---------- audio ---------- */
  var ac = null, master = null, voices = [], waveCache = {};
  function audio() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.22;
      var dc = ac.createDynamicsCompressor();
      master.connect(dc); dc.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function wave() {
    var key = D.inst.tilt;
    if (waveCache[key]) return waveCache[key];
    var N = 12, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (var n = 1; n <= N; n++) im[n] = amp(n);
    return (waveCache[key] = ac.createPeriodicWave(re, im));
  }
  function stopAll() {
    var t = ac ? ac.currentTime : 0;
    voices.forEach(function (v) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, 0.05); v.o.stop(t + 0.3); } catch (e) { } });
    voices = [];
    $('btnHold').textContent = 'Hold them sounding';
  }
  function voice(f, role, when, dur, gain, sine) {
    var o = ac.createOscillator(), g = ac.createGain();
    if (sine) o.type = 'sine'; else o.setPeriodicWave(wave());
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
    o.connect(g); g.connect(master); o.start(when);
    if (dur) { g.gain.exponentialRampToValueAtTime(gain * 0.25, when + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); o.stop(when + dur + 0.05); }
    var v = { o: o, g: g, role: role };
    voices.push(v);
    return v;
  }
  function strikePair(hold) {
    if (!audio()) { $('msg').textContent = 'This browser will not make a sound, so count the swells on the trace instead.'; return; }
    stopAll();
    var info = stepInfo(step), t = ac.currentTime + 0.02, dur = hold ? 0 : 6;
    var fork = BEARING[step][1] < 0;
    voice(info.fr, 'ref', t, dur, fork ? 0.35 : 0.3, fork);
    voice(info.ft, 'tuned', t, dur, 0.3, false);
    if (hold) $('btnHold').textContent = 'Let them stop';
  }
  function retune() {
    if (!ac || !voices.length) return;
    var info = stepInfo(step), t = ac.currentTime;
    voices.forEach(function (v) { if (v.role === 'tuned') v.o.frequency.setTargetAtTime(info.ft, t, 0.015); });
  }
  function cadence(off, k) {
    if (!audio()) return;
    stopAll();
    var r = 60 + k; if (r > 65) r -= 12;
    var chords = [[r - 12, r, r + 4, r + 7], [r - 7, r + 5, r + 9, r + 12], [r - 5, r + 7, r + 11, r + 14], [r - 12, r + 4, r + 7, r + 12]];
    var t = ac.currentTime + 0.05;
    chords.forEach(function (c, i) {
      var len = i === 3 ? 2.6 : 1.15;
      c.forEach(function (m, j) {
        var pc = ((m % 12) + 12) % 12, f = D.fork * Math.pow(2, (m - 69) / 12 + off[pc] / 1200);
        voice(f, 'c', t + j * 0.025, len + 0.4, 0.17, false);
      });
      t += len;
    });
  }

  /* ---------- drawing: the keyboard and the beat trace ---------- */
  function keyboard() {
    var b = BEARING[step], W = [0, 2, 4, 5, 7, 9, 11], B = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]], s = '';
    function cls(pc) { return pc === b[0] ? 'k-on' : pc === b[1] ? 'k-ref' : (doneSet()[pc] ? 'k-done' : ''); }
    W.forEach(function (pc, i) { s += '<rect class="kw ' + cls(pc) + '" x="' + (i * 40 + 1) + '" y="1" width="38" height="108" rx="4"/><text x="' + (i * 40 + 20) + '" y="98" text-anchor="middle">' + NOTE[pc] + '</text>'; });
    B.forEach(function (p) { var pc = p[0], x = p[1] * 40 - 12; s += '<rect class="kb ' + cls(pc) + '" x="' + x + '" y="1" width="24" height="66" rx="3"/><text class="kbt" x="' + (x + 12) + '" y="58" text-anchor="middle">' + NOTE[pc] + '</text>'; });
    $('keys').innerHTML = '<svg viewBox="0 0 282 112" role="img" aria-label="One octave of the keyboard, C to B, with the string being tuned and the one it is tuned from marked">' + s + '</svg>';
  }
  function doneSet() { var o = {}; for (var i = 0; i < reach; i++) o[BEARING[i][0]] = 1; return o; }

  function trace() {
    var cv = $('trace'), dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = cv.clientWidth || 600, h = cv.clientHeight || 170;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var info = stepInfo(step), fork = BEARING[step][1] < 0;
    var a1 = fork ? 1 : amp(info.p), a2 = amp(info.q);
    var T = 10, pad = 12, top = 14, bot = h - 24, mid = (top + bot) / 2;
    /* seconds */
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = '#8b97ab'; g.font = '10px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
    for (var sI = 0; sI <= T; sI++) {
      var x = pad + (w - 2 * pad) * sI / T;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
      if (sI < T) g.fillText(sI + 's', x + 10, h - 8);
    }
    /* the envelope of the two coinciding partials, mirrored like a trace of the sound */
    var amax = a1 + a2, n = Math.max(200, Math.floor(w - 2 * pad));
    var grd = g.createLinearGradient(0, top, 0, bot);
    grd.addColorStop(0, 'rgba(100,240,200,.55)'); grd.addColorStop(0.5, 'rgba(100,240,200,.12)'); grd.addColorStop(1, 'rgba(100,240,200,.55)');
    g.fillStyle = grd; g.strokeStyle = '#64f0c8'; g.lineWidth = 1.4;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = T * i / n;
      var e = Math.sqrt(a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(2 * Math.PI * info.beat * t)) / amax;
      e *= Math.exp(-t / 14);
      pts.push([pad + (w - 2 * pad) * i / n, e * (bot - top) / 2]);
    }
    g.beginPath();
    pts.forEach(function (p, j) { if (j) g.lineTo(p[0], mid - p[1]); else g.moveTo(p[0], mid - p[1]); });
    for (var j = pts.length - 1; j >= 0; j--) g.lineTo(pts[j][0], mid + pts[j][1]);
    g.closePath(); g.fill();
    g.beginPath(); pts.forEach(function (p, j) { if (j) g.lineTo(p[0], mid - p[1]); else g.moveTo(p[0], mid - p[1]); }); g.stroke();
    g.beginPath(); pts.forEach(function (p, j) { if (j) g.lineTo(p[0], mid + p[1]); else g.moveTo(p[0], mid + p[1]); }); g.stroke();
  }

  /* ---------- the book's words ---------- */
  function bookWords(i) {
    var b = BEARING[i], tg = stepInfo(i, D.target), st;
    if (b[2] === 'unison') return 'Bring A to the fork: a unison, <b>no beats at all</b>.';
    var dir = b[3] ? 'below' : 'above';
    var line = 'Tune <b>' + NOTE[b[0]] + '</b> from ' + NOTE[b[1]] + ', a ' + KINDWORD[b[2]] + ' ' + dir + '.';
    if (tg.beat < 0.06) st = ' The book says <b>pure</b>: no beats at all.';
    else st = ' The book says <b>' + (tg.s > 0 ? 'narrow' : 'wide') + '</b>, about <b>' + f1(tg.beat) + ' beats a second</b> (' + Math.round(tg.beat * 10) + ' in the ten seconds traced).';
    return line + st;
  }
  function stepChips() {
    var s = '';
    BEARING.forEach(function (b, i) {
      var c = i === step ? 'chip on' : 'chip';
      var lab = b[1] < 0 ? 'fork → A' : NOTE[b[1]] + ' → ' + NOTE[b[0]];
      s += '<button type="button" class="' + c + '" data-s="' + i + '"' + (i > reach || finished ? ' disabled' : '') + '>' + (i + 1) + '. ' + lab + '</button>';
    });
    $('bearing').innerHTML = s;
  }

  function render() {
    var b = BEARING[step];
    $('stepN').textContent = 'String ' + (step + 1) + ' of 12';
    $('book').innerHTML = bookWords(step);
    $('pin').value = pins[b[0]].toFixed(1);
    $('pinLab').textContent = 'The pin for ' + NOTE[b[0]];
    $('btnNext').textContent = step < 11 ? 'On to the next string →' : 'Close the lid and leave it for tonight';
    $('btnNext').disabled = finished;
    $('pin').disabled = finished;
    stepChips(); keyboard(); trace();
  }

  /* ---------- the evening ---------- */
  function bars(title, yours, book, labels, note) {
    var W = 640, rowH = 22, H = labels.length * rowH + 34, x0 = 70, x1 = W - 16;
    var lo = 0, hi = 0;
    yours.concat(book).forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); });
    lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1);
    function X(v) { return x0 + (x1 - x0) * (v - lo) / (hi - lo); }
    var s = '<svg class="curves" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(title) + '">';
    var stepT = (hi - lo) > 30 ? 10 : (hi - lo) > 12 ? 5 : 2;
    for (var t = Math.ceil(lo / stepT) * stepT; t <= hi; t += stepT) {
      s += '<line x1="' + X(t) + '" x2="' + X(t) + '" y1="10" y2="' + (H - 20) + '" stroke="rgba(255,255,255,' + (t === 0 ? '.35' : '.07') + ')"/>';
      s += '<text x="' + X(t) + '" y="' + (H - 6) + '" text-anchor="middle">' + (t > 0 ? '+' : '') + t + '</text>';
    }
    labels.forEach(function (l, i) {
      var y = 12 + i * rowH, a = X(Math.min(0, yours[i])), bb = X(Math.max(0, yours[i]));
      s += '<text x="' + (x0 - 8) + '" y="' + (y + 13) + '" text-anchor="end">' + l + '</text>';
      s += '<rect x="' + a + '" y="' + (y + 3) + '" width="' + Math.max(1, bb - a) + '" height="12" rx="2" fill="rgba(100,240,200,.75)"/>';
      s += '<line x1="' + X(book[i]) + '" x2="' + X(book[i]) + '" y1="' + y + '" y2="' + (y + 18) + '" stroke="#ffce6a" stroke-width="2.5"/>';
    });
    s += '</svg>';
    return '<h5>' + title + '</h5>' + s + '<p class="formula">' + note + '</p>';
  }

  function finish(gave) {
    finished = true; stopAll();
    var err = pins.map(function (p, i) { return p - D.target[i]; });
    var rms = Math.sqrt(err.reduce(function (a, e) { return a + e * e; }, 0) / 12);
    var worst = 0; err.forEach(function (e, i) { if (Math.abs(e) > Math.abs(err[worst])) worst = i; });
    var wrong = [];
    BEARING.forEach(function (b, i) {
      if (i === 0) return;
      var y = stepInfo(i), t = stepInfo(i, D.target);
      if (t.beat > 0.15 && y.beat > 0.15 && (y.s > 0) !== (t.s > 0)) wrong.push(NOTE[b[0]]);
    });
    var kt = thirdDev(pins, D.key), kb = thirdDev(D.target, D.key);
    var cls, head;
    if (gave) { cls = 'good'; head = 'The master tuner takes the hammer and lays the bearing from the book.'; }
    else if (rms < 1.2) { cls = 'good'; head = 'The master would not touch it. Every string is within a cent or so of the book.'; }
    else if (rms < 3) { cls = 'good'; head = 'Fit to play. A tuner could find a string to fuss over, but nobody in the room will.'; }
    else if (rms < 6) { cls = 'warn'; head = 'It will do for the ' + D.inst.short + ', but ' + D.owner + ' hears it in the thirds.'; }
    else { cls = 'warn'; head = 'Send for the tuner again. The errors have run round the circle and piled up somewhere.'; }
    var v = '<p><b>' + head + '</b></p>';
    v += '<p>Across the twelve strings you are ' + f1(rms) + ' cents from the book on average (root mean square); the worst is ' + NOTE[worst] + ', ' + sgn(err[worst]) + ' cents. ' +
      'The tonic third of ' + KEYNAME[D.key] + ' major is ' + f1(kt) + ' cents wide of pure as you left it, against ' + f1(kb) + ' in the book.</p>';
    if (wrong.length && !gave) v += '<p>Tempered on the wrong side of pure: ' + wrong.join(', ') + '. The beats were the right speed but the interval was wide where the book wanted narrow, or the other way, so the error doubled instead of cancelling.</p>';
    $('verdict').className = 'verdict ' + cls;
    $('verdict').innerHTML = v;

    var R = $('reveal'); R.style.display = '';
    var circle = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
    var fl = circle.map(function (pc) { return NOTE[pc] + '–' + NOTE[(pc + 7) % 12]; });
    var tl = circle.map(function (pc) { return NOTE[pc] + '–' + NOTE[(pc + 4) % 12]; });
    var h = '<h5>Play it for ' + esc(D.owner) + '</h5><div class="controls">' +
      '<button class="btn small" type="button" data-c="you">' + KEYNAME[D.key] + ' major, as you left it</button>' +
      '<button class="btn small ghost" type="button" data-c="book">' + KEYNAME[D.key] + ' major, from the book</button>' +
      '<button class="btn small ghost" type="button" data-c="far">' + KEYNAME[D.far] + ' major, from the book</button>' +
      '<button class="btn small ghost" type="button" data-c="eq">' + KEYNAME[D.key] + ' major, in equal temperament</button></div>' +
      '<p class="formula">A cadence: tonic, subdominant, dominant, tonic. ' + KEYNAME[D.far] + ' major is the key a guest will ask for after supper; ' + (D.temp.id === 'e' ? 'in equal temperament it sounds exactly like every other key.' : 'it is the roughest key this temperament has.') + '</p>';
    h += bars('The fifths, cents from pure (narrow is negative)', circle.map(function (pc) { return fifthDev(pins, pc); }), circle.map(function (pc) { return fifthDev(D.target, pc); }), fl,
      'Green bars are your strings; the gold mark is the book. A pure fifth is 701.96 cents. The twelve fifths must between them give up one Pythagorean comma, 23.46 cents, and where a temperament puts that loss is all it is.');
    h += bars('The major thirds, cents from pure (wide is positive)', circle.map(function (pc) { return thirdDev(pins, pc); }), circle.map(function (pc) { return thirdDev(D.target, pc); }), tl,
      'A pure major third is 386.31 cents. Every temperament is a bargain between these two charts: the more the fifths give up, the purer the thirds near C.');
    h += '<h5>The strings, cents from equal temperament</h5><div class="tablewrap"><table><thead><tr><th>String</th><th>Before you came</th><th>The book</th><th>As you left it</th><th>Out by</th></tr></thead><tbody>';
    for (var i = 0; i < 12; i++) {
      var e = err[i];
      h += '<tr><td>' + NOTE[i] + '</td><td>' + sgn(D.start[i]) + '</td><td>' + sgn(D.target[i]) + '</td><td>' + sgn(pins[i]) + '</td><td' + (Math.abs(e) > 3 ? ' class="bad"' : '') + '>' + sgn(e) + '</td></tr>';
    }
    h += '</tbody></table></div>';
    R.innerHTML = h;
    R.querySelectorAll('[data-c]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = btn.getAttribute('data-c');
        if (c === 'you') cadence(pins, D.key);
        else if (c === 'book') cadence(D.target, D.key);
        else if (c === 'far') cadence(D.target, D.far);
        else cadence([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], D.key);
      });
    });
    render();
  }

  /* ---------- load a day ---------- */
  function load() {
    if (ac) stopAll();
    D = build(dateFor(dayOff));
    pins = D.start.slice(); step = 0; reach = 0; finished = false;
    $('plWho').textContent = D.town + ', ' + D.year + ' · ' + D.inst.short;
    $('plName').textContent = D.owner + ' wants it in ' + D.temp.name;
    $('plBlurb').innerHTML = 'You are shown up to ' + esc(D.room) + ', where ' + esc(D.inst.name) + ' has gone out of tune since the last visit. Tonight is ' +
      esc(D.occasion) + ', and ' + esc(D.piece) + ' in <b>' + KEYNAME[D.key] + ' major</b>. The house fork gives A at <b>' + D.fork + ' vibrations a second</b>. ' +
      '<i>' + esc(D.temp.name.charAt(0).toUpperCase() + D.temp.name.slice(1)) + ', ' + esc(D.temp.who) + '.</i> ' + esc(D.temp.blurb);
    $('rules').innerHTML = '<span><b>12</b> strings, one octave, C to B</span><span><b>A = ' + D.fork + '</b> from the fork</span><span>bearing by <b>fifths and fourths</b></span><span>judge by <b>beats</b>, not by numbers</span>';
    $('dayOut').textContent = longDate(D.date) + (dayOff === 0 ? ' (today)' : '');
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('msg').textContent = '';
    render();
  }

  /* ---------- controls ---------- */
  $('pin').addEventListener('input', function () {
    if (finished) return;
    pins[BEARING[step][0]] = parseFloat($('pin').value);
    trace(); retune();
  });
  function nudge(d) {
    if (finished) return;
    var pc = BEARING[step][0];
    pins[pc] = Math.max(-50, Math.min(50, Math.round((pins[pc] + d) * 10) / 10));
    $('pin').value = pins[pc].toFixed(1);
    trace(); retune();
  }
  $('btnDn').addEventListener('click', function () { nudge(-0.2); });
  $('btnUp').addEventListener('click', function () { nudge(0.2); });
  $('btnDn5').addEventListener('click', function () { nudge(-2); });
  $('btnUp5').addEventListener('click', function () { nudge(2); });
  $('btnStrike').addEventListener('click', function () { strikePair(false); });
  $('btnHold').addEventListener('click', function () {
    if (voices.length && $('btnHold').textContent !== 'Hold them sounding') { stopAll(); return; }
    strikePair(true);
  });
  $('btnNext').addEventListener('click', function () {
    if (finished) return;
    if (step < 11) { step++; reach = Math.max(reach, step); if (ac) stopAll(); $('msg').textContent = ''; render(); }
    else { reach = 12; finish(false); }
  });
  $('bearing').addEventListener('click', function (e) {
    var b = e.target.closest('[data-s]'); if (!b || b.disabled) return;
    step = +b.getAttribute('data-s'); if (ac) stopAll(); render();
  });
  $('btnReset').addEventListener('click', function () { load(); });
  $('btnGive').addEventListener('click', function () {
    if (finished) return;
    pins = D.target.slice(); reach = 12; step = 11;
    $('msg').textContent = 'The master tuner sets every string by the book.';
    finish(true);
  });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
  });
  window.addEventListener('resize', function () { if (D) trace(); });

  load();
})();
