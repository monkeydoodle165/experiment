/* drift.quibo.games — The Belfry
   A tower invented by the day's number, a real method rung on its bells, and a
   rope for you. Place notation, truth, bell partials and the handstroke gap are
   the genuine article; the tower, its band and its bells are not anywhere.
   Self-contained. No dependencies. */
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
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }

  /* ---------- place notation ---------- */
  var SYM = '1234567890ET';
  function parsePN(s) {
    return s.split('.').map(function (t) {
      if (t === 'x' || t === '-') return [];
      return t.split('').map(function (c) { return SYM.indexOf(c) + 1; });
    });
  }
  /* one change: every bell not making a place swaps with its neighbour */
  function apply(row, places) {
    var r = row.slice(), i = 0, n = r.length;
    while (i < n) {
      if (places.indexOf(i + 1) >= 0) { i++; continue; }
      if (i + 1 < n) { var t = r[i]; r[i] = r[i + 1]; r[i + 1] = t; }
      i += 2;
    }
    return r;
  }
  function pnText(places) { return places.length ? places.map(function (p) { return SYM[p - 1]; }).join('') : 'x'; }
  function rounds(n) { var r = []; for (var i = 1; i <= n; i++) r.push(i); return r; }
  function key(row) { return row.map(function (b) { return SYM[b - 1]; }).join(''); }

  /* ---------- the methods: real ones, with their real notation ---------- */
  var METHODS = [
    { id: 'pbd', name: 'Plain Bob Doubles',        stage: 5, pn: '5.1.5.1.5.1.5.1.5.125', calls: { b: '145', s: '123' }, w: 3,
      note: 'The first method nearly everyone learns. The treble plain hunts; everybody else hunts too, except at the lead end, where whoever meets the treble in seconds makes a place and turns the course.' },
    { id: 'gsd', name: 'Grandsire Doubles',        stage: 5, pn: '3.1.5.1.5.1.5.1.5.1', calls: null, w: 2,
      note: 'Two hunt bells, the treble and the second, and a thirds place made at every lead end. Rung since the seventeenth century, and still what a great many village towers ring for Sunday service.' },
    { id: 'std', name: 'Stedman Doubles',          stage: 5, pn: '3.1.5.3.1.3.1.3.5.1.3.1', calls: null, w: 2,
      note: 'No hunt bell at all. The rows come in sixes, rung forwards and backwards in turn, while the bells go in and out of the front three. Named for Fabian Stedman, who published it in the 1670s.' },
    { id: 'pbm', name: 'Plain Bob Minor',          stage: 6, pn: 'x.16.x.16.x.16.x.16.x.16.x.12', calls: { b: '14', s: '1234' }, w: 3,
      note: 'Plain Bob on six. The cross changes, where every pair swaps at once, are what give even-bell ringing its rolling sound.' },
    { id: 'lbm', name: 'Little Bob Minor',         stage: 6, pn: 'x.16.x.14.x.16.x.12', calls: { b: '14', s: '1234' }, w: 2,
      note: 'The treble only hunts to fourths and back, so the leads are eight rows long and the back bells spend a long time dodging with each other.' },
    { id: 'csm', name: 'Cambridge Surprise Minor', stage: 6, pn: 'x.36.x.14.x.12.x.36.x.14.x.56.x.14.x.36.x.12.x.14.x.36.x.12', calls: { b: '14', s: '1234' }, w: 2,
      note: 'A surprise method: places are made internally, away from the lead and the back, which is what makes it hard. Most ringers remember the day they first rang a course of Cambridge.' },
    { id: 'pbt', name: 'Plain Bob Triples',        stage: 7, pn: '7.1.7.1.7.1.7.1.7.1.7.1.7.127', calls: null, w: 1,
      note: 'Plain Bob on seven working bells, with the tenor covering behind so the rhythm stays even.' },
    { id: 'gst', name: 'Grandsire Triples',        stage: 7, pn: '3.1.7.1.7.1.7.1.7.1.7.1.7.1', calls: null, w: 2,
      note: 'For centuries the standard eight-bell method of English towers, with the tenor covering. A peal of it is five thousand and forty changes, every one of them different.' },
    { id: 'pbmj', name: 'Plain Bob Major',         stage: 8, pn: 'x.18.x.18.x.18.x.18.x.18.x.18.x.18.x.12', calls: { b: '14', s: '1234' }, w: 2,
      note: 'Plain Bob on eight: the treble takes sixteen rows to go down to the back and up again, and the plain course is a hundred and twelve.' }
  ];
  METHODS.forEach(function (m) { m.changes = parsePN(m.pn); m.lead = m.changes.length; });

  var STAGE = { 5: 'Doubles', 6: 'Minor', 7: 'Triples', 8: 'Major' };
  var PLACE = ['lead', '2nds', '3rds', '4ths', '5ths', '6ths', '7ths', '8ths'];
  var WORD = ['', 'treble', '2nd', '3rd', '4th', '5th', '6th', '7th', 'tenor'];

  /* ---------- towers that are not anywhere ---------- */
  var DEDIC = ['St Mary', 'St Peter', 'All Saints', 'Holy Trinity', 'St Michael', 'St Andrew', 'St Lawrence',
               'St Margaret', 'St Giles', 'St Botolph', 'St Nicholas', 'St Helen', 'St John the Baptist', 'St Wystan'];
  var TOWN_A = ['Ash', 'Brom', 'Chal', 'Dray', 'Elm', 'Fern', 'Gold', 'Hax', 'Iver', 'Kings', 'Lang', 'Mickle',
                'Nether', 'Oak', 'Pens', 'Ripp', 'Stan', 'Thorn', 'Ux', 'Wend', 'Yar', 'Hol'];
  var TOWN_B = ['ley', 'ford', 'ham', 'ton', 'bury', 'worth', 'combe', 'stead', 'thorpe', 'well', 'field', 'by',
                'marsh', 'hope', 'den'];
  var TOWERS = [
    'A squat Norman tower with the ropes hanging straight down into the nave.',
    'A tall perpendicular tower; the ringing chamber is up forty-one steps and a ladder.',
    'A Victorian rebuild, with a ringing room that still smells of the gas lamps.',
    'A detached bell tower standing across the churchyard, as if it had fallen out with the church.',
    'A crossing tower, so the ropes come down through the vault in one long draught.',
    'A timber frame on a brick base that sways, visibly, when the tenor is up.',
    'A tower rehung last year after forty years silent; the frame is new, the bells are not.'
  ];
  var BANDS = [
    'The Tuesday band, who have rung together since before the new frame.',
    'A Sunday service band with two learners and a very steady tenor ringer.',
    'Visitors from the next parish, here on an outing and running late for lunch.',
    'The local branch practice, at which everybody wants to ring the treble.',
    'A band that has been trying to ring a quarter peal here for three months.',
    'Four regulars and whoever turned up.'
  ];
  var NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  /* ---------- state ---------- */
  var dayOffset = 0;
  var today = null;     /* the day's tower */
  var method = null;
  var myBell = 2;
  var comp = '';        /* one char per lead: p, b, s */
  var paceMs = 230;

  function $(id) { return document.getElementById(id); }
  function wire(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

  function buildDay() {
    var d = new Date();
    d.setDate(d.getDate() + dayOffset);
    var r = rng(seedForDate(d) ^ 0xbe11f12e);
    var tot = 0; METHODS.forEach(function (m) { tot += m.w; });
    var x = r() * tot, m0 = METHODS[0];
    for (var i = 0; i < METHODS.length; i++) { x -= METHODS[i].w; if (x <= 0) { m0 = METHODS[i]; break; } }
    var bells = m0.stage % 2 ? m0.stage + 1 : m0.stage;
    var cwt = bells <= 6 ? 5 + r() * 11 : 9 + r() * 18;
    /* a tenor's pitch goes roughly as the inverse cube root of its weight: 25 cwt is about a D */
    var nominal = 587 * Math.pow(25 / cwt, 1 / 3);
    var semi = Math.round(12 * Math.log(nominal / 261.63) / Math.LN2);
    nominal = 261.63 * Math.pow(2, semi / 12);
    var c = Math.floor(cwt), q = Math.floor((cwt - c) * 4), lb = Math.floor(((cwt - c) * 4 - q) * 28);
    var place = pick(r, TOWN_A) + pick(r, TOWN_B);
    today = {
      date: d, method: m0, bells: bells,
      tower: pick(r, DEDIC) + ', ' + place,
      blurb: pick(r, TOWERS), band: pick(r, BANDS),
      tenor: c + '–' + q + '–' + lb, key: NOTES[((semi % 12) + 12) % 12],
      nominal: nominal,
      my: 2 + Math.floor(r() * (m0.stage - 1)),
      pace: Math.round(200 + r() * 70),
      jitter: []
    };
    for (var j = 0; j < 9; j++) today.jitter.push(6 + r() * 14);
    method = m0; myBell = today.my; paceMs = today.pace;
    comp = plainComp(method);
  }

  /* ---------- courses and touches ---------- */
  function leadRows(m, lh, call) {
    var rows = [], r = lh;
    for (var j = 0; j < m.lead - 1; j++) { r = apply(r, m.changes[j]); rows.push(r); }
    var last = m.changes[m.lead - 1];
    if (call === 'b' && m.calls) last = parsePN(m.calls.b)[0];
    if (call === 's' && m.calls) last = parsePN(m.calls.s)[0];
    r = apply(r, last); rows.push(r);
    return rows;
  }
  function plainComp(m) {
    var R = key(rounds(m.stage)), lh = rounds(m.stage), n = 0, s = '';
    do { var rows = leadRows(m, lh, 'p'); lh = rows[rows.length - 1]; s += 'p'; n++; } while (key(lh) !== R && n < 200);
    return s;
  }
  /* rings a composition on paper and says what happened: rows, lead heads, truth */
  function prove(m, cs) {
    var R = key(rounds(m.stage));
    var lh = rounds(m.stage), rows = [], heads = [], seen = {}, first = null, round = -1;
    for (var i = 0; i < cs.length; i++) {
      var lr = leadRows(m, lh, cs[i]);
      for (var q = 0; q < lr.length; q++) {
        var k = key(lr[q]);
        if (seen[k] !== undefined && !first) first = { row: rows.length, again: seen[k], k: k };
        if (seen[k] === undefined) seen[k] = rows.length;
        rows.push(lr[q]);
      }
      lh = lr[lr.length - 1];
      heads.push({ call: cs[i], row: key(lh) });
      if (key(lh) === R) { round = i; break; }
    }
    return { rows: rows, heads: heads, falseAt: first, round: round >= 0, used: round >= 0 ? round + 1 : cs.length };
  }
  /* a blind depth-first search for a true touch of a given length, pruned on the first repeated row */
  function search(m, target, seed) {
    var r = rng(seed), R = key(rounds(m.stage));
    for (var attempt = 0; attempt < 6; attempt++) {
      var seen = {}, out = [], nodes = 0, budget = 60000;
      var ok = (function rec(lh, len) {
        if (++nodes > budget) return false;
        var opts = ['p', 'b', 's'];
        for (var i = 2; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
        for (var o = 0; o < 3; o++) {
          var rows = leadRows(m, lh, opts[o]), good = true, added = [];
          for (var q = 0; q < rows.length; q++) {
            var k = key(rows[q]);
            if (seen[k] || (k === R && q !== rows.length - 1)) { good = false; break; }
            seen[k] = 1; added.push(k);
          }
          if (good) {
            var end = key(rows[rows.length - 1]);
            out.push(opts[o]);
            if (end === R) { if (len + m.lead === target) return true; }
            else if (len + m.lead < target && rec(rows[rows.length - 1], len + m.lead)) return true;
            out.pop();
          }
          for (q = 0; q < added.length; q++) delete seen[added[q]];
        }
        return false;
      })(rounds(m.stage), 0);
      if (ok) return out.join('');
    }
    return null;
  }
  function lengthsFor(m) {
    if (!m.calls) return [];
    var out = [];
    var want = m.stage === 5 ? [60, 120] : m.stage === 6 ? [120, 240, 360, 720] : [448, 1008, 1280];
    want.forEach(function (w) {
      if (w % m.lead) return;
      if (m.id === 'pbm' && w === 720) return;   /* the extent exists, but a blind search is too slow to find it here */
      if (m.id === 'lbm' && w > 480) return;
      out.push(w);
    });
    return out;
  }

  /* ---------- the bells themselves ---------- */
  var ac = null, master = null;
  function audio() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.32;
      var dc = ac.createDynamicsCompressor();
      master.connect(dc); dc.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  /* partials of a tuned English bell, relative to the nominal: hum, prime, minor-third tierce,
     quint, nominal, superquint, octave nominal. The tierce is why a bell sounds faintly minor. */
  var PARTIALS = [[0.25, 0.30, 3.2], [0.5, 0.40, 2.0], [0.6, 0.30, 1.5], [0.75, 0.12, 1.0],
                  [1.0, 0.55, 1.1], [1.5, 0.18, 0.6], [2.0, 0.10, 0.4]];
  var SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
  function bellFreq(b) {
    /* bell 1 is the treble, the highest; the back bell is the key note */
    var stepsUp = today.bells - b;
    return today.nominal * Math.pow(2, SCALE[stepsUp] / 12);
  }
  function strike(b, when, gain) {
    if (!ac) return;
    var f = bellFreq(b), g = gain == null ? 1 : gain;
    var weight = Math.pow(261.63 / f, 0.6);
    PARTIALS.forEach(function (p) {
      var o = ac.createOscillator(), v = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * p[0];
      var dur = p[2] * (0.9 + weight * 0.9);
      v.gain.setValueAtTime(0.0001, when);
      v.gain.exponentialRampToValueAtTime(p[1] * g * 0.5, when + 0.004);
      v.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(v); v.connect(master);
      o.start(when); o.stop(when + dur + 0.05);
    });
  }

  /* ---------- a performance: rounds, the touch, rounds, stand ---------- */
  var perf = null;
  function buildPerformance() {
    var n = today.bells, R = rounds(n);
    var p = prove(method, comp);
    var body = p.round ? p.rows : p.rows.slice(0, 400);
    var rows = [], calls = {};
    var pad = function (r) { return method.stage < n ? r.concat([n]) : r; };
    for (var i = 0; i < 6; i++) rows.push(R.slice());
    calls[2] = 'Go ' + method.name.replace(/ (Doubles|Minor|Triples|Major)$/, '');
    rows.push.apply(rows, body.map(pad));
    /* the conductor calls a bob or a single at a handstroke just before the lead end */
    var leadEnd = 5;
    for (var l = 0; l < p.heads.length; l++) {
      leadEnd += method.lead;
      var c = p.heads[l].call;
      if (c !== 'p') { var at = leadEnd - 2; at -= at % 2; calls[at] = c === 'b' ? 'Bob' : 'Single'; }
    }
    var end = rows.length;
    if (p.round) { var a2 = end - 3; a2 -= a2 % 2; if (!calls[a2]) calls[a2] = "That's all"; }
    for (i = 0; i < 4; i++) rows.push(R.slice());
    calls[rows.length - 2] = 'Stand';
    perf = { rows: rows, calls: calls, proof: p, start: 0, mode: 'listen', scheduled: 0, n: n,
             hits: [], due: [], playing: false, spoken: {} };
  }
  function timeOf(k, pos) {
    /* every handstroke after the first is preceded by the handstroke gap: one empty blow */
    var n = perf.n, g = paceMs / 1000;
    var hs = Math.floor((k + 1) / 2);
    return perf.start + (k * n + hs + pos) * g;
  }
  var timer = null, raf = 0;
  function play(mode) {
    if (!audio()) { setStatus('This browser has no Web Audio, so the bells cannot be heard here.'); return; }
    stop(true);
    buildPerformance();
    perf.mode = mode; perf.playing = true;
    perf.start = ac.currentTime + 0.8;
    perf.rows.forEach(function (row, k) {
      perf.due.push({ k: k, t: timeOf(k, row.indexOf(myBell)), done: false, err: null });
    });
    timer = setInterval(schedule, 25);
    schedule();
    loop();
    setStatus(mode === 'ring'
      ? 'You have the ' + WORD[myBell] + '. Press Space (or tap the rope) each time the blue line says it is your turn.'
      : 'Listening. The ' + WORD[myBell] + ' is rung for you; its path is the blue line.');
    if ($('btnListen')) $('btnListen').textContent = mode === 'listen' ? 'Stand' : 'Listen to the band';
  }
  function stop(quiet) {
    if (timer) clearInterval(timer);
    timer = null;
    cancelAnimationFrame(raf);
    var was = perf && perf.playing;
    if (perf) perf.playing = false;
    if ($('btnListen')) $('btnListen').textContent = 'Listen to the band';
    if (!quiet && was) { report(); setStatus('Stood. Press Listen or Ring to go again.'); }
    drawRinging();
  }
  function schedule() {
    if (!perf || !perf.playing) return;
    var horizon = ac.currentTime + 0.18;
    var g = paceMs / 1000;
    while (perf.scheduled < perf.rows.length * perf.n) {
      var k = Math.floor(perf.scheduled / perf.n), pos = perf.scheduled % perf.n;
      var t = timeOf(k, pos);
      if (t > horizon) break;
      var b = perf.rows[k][pos];
      if (!(perf.mode === 'ring' && b === myBell)) {
        var jit = (Math.sin(k * 12.9898 + b * 78.233) * 43758.5453) % 1;
        strike(b, Math.max(ac.currentTime, t + jit * today.jitter[b % 9] / 1000), 0.9 + 0.2 * Math.abs(jit));
      }
      perf.scheduled++;
    }
    if (perf.mode === 'ring') {
      perf.due.forEach(function (d) {
        if (!d.done && ac.currentTime > d.t + perf.n * g * 0.5) { d.done = true; perf.hits.push({ t: d.t, err: null }); }
      });
    }
    Object.keys(perf.calls).forEach(function (k) {
      k = +k;
      if (perf.spoken[k]) return;
      if (ac.currentTime >= timeOf(k, 0) - 0.05) { perf.spoken[k] = 1; say(perf.calls[k]); }
    });
    if (ac.currentTime > timeOf(perf.rows.length - 1, perf.n) + 1.2) stop(false);
  }
  var callShownAt = 0, callText = '';
  function say(text) {
    callText = text; callShownAt = performance.now();
    if (!$('speak') || !$('speak').checked || !window.speechSynthesis) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15; u.pitch = 0.8; u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) { /* no voice, no matter */ }
  }

  function pull() {
    if (!perf || !perf.playing || perf.mode !== 'ring') return;
    var now = ac.currentTime, g = paceMs / 1000, best = null;
    perf.due.forEach(function (d) {
      if (d.done) return;
      if (Math.abs(now - d.t) < perf.n * g * 0.5 && (!best || Math.abs(now - d.t) < Math.abs(now - best.t))) best = d;
    });
    strike(myBell, now, 1);
    var rope = $('rope');
    if (rope) { rope.classList.remove('pulled'); void rope.offsetWidth; rope.classList.add('pulled'); }
    if (best) { best.done = true; best.err = (now - best.t) * 1000; perf.hits.push({ t: best.t, err: best.err }); }
  }

  function report() {
    if (!perf || perf.mode !== 'ring') return;
    var el = $('verdict');
    if (!el) return;
    var hits = perf.hits.filter(function (h) { return h.err !== null; });
    var miss = perf.hits.length - hits.length;
    if (!perf.hits.length) { el.className = 'verdict'; el.innerHTML = 'You stood before your first blow. The rope is still there.'; return; }
    var rms = Math.sqrt(hits.reduce(function (a, h) { return a + h.err * h.err; }, 0) / Math.max(1, hits.length));
    var clean = hits.filter(function (h) { return Math.abs(h.err) < 50; }).length;
    var mean = hits.reduce(function (a, h) { return a + h.err; }, 0) / Math.max(1, hits.length);
    var cls = hits.length && rms < 45 && miss < 3 ? 'good' : hits.length && rms < 90 && miss < perf.hits.length * 0.2 ? 'warn' : 'bad';
    var word = cls === 'good' ? 'That would stand up in a quarter peal.' : cls === 'warn' ? 'Recognisably the method. The band noticed.' : 'The conductor would have called “stand” some while ago.';
    el.className = 'verdict ' + cls;
    el.innerHTML = '<b>' + word + '</b> ' + hits.length + ' blows struck, ' + miss + ' missed, ' +
      clean + ' within 50 ms of where they belonged.' + (hits.length ? ' Root-mean-square error ' + Math.round(rms) + ' ms; on average you were ' +
      Math.abs(Math.round(mean)) + ' ms ' + (mean < 0 ? 'early — clipping the bell in front.' : 'late — holding up the bell behind.') : '');
  }

  /* ---------- drawing ---------- */
  function fit(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }
  var BLUE = '#7aa2ff', MINT = '#64f0c8', GOLD = '#ffce6a';

  function loop() {
    drawRinging();
    if (perf && perf.playing) raf = requestAnimationFrame(loop);
  }
  function previewRows() {
    var n = today.bells;
    var pad = function (r) { return method.stage < n ? r.concat([n]) : r; };
    return [rounds(n)].concat(prove(method, comp).rows.slice(0, 40).map(pad));
  }
  function drawRinging() {
    var cv = $('ringing'); if (!cv || !today) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    ctx.fillStyle = '#080b11'; ctx.fillRect(0, 0, W, H);
    var n = today.bells;
    var live = perf && perf.playing && ac;
    var rows = perf ? perf.rows : previewRows();
    var now = live ? ac.currentTime : null;
    var g = paceMs / 1000;
    var curK = 0, curPos = -1, frac = 0;
    if (now !== null) {
      for (var k = 0; k < rows.length; k++) { if (timeOf(k, 0) - g * 0.5 <= now) curK = k; else break; }
      var off = (now - timeOf(curK, 0)) / g;
      curPos = Math.floor(off + 0.5);
      frac = Math.max(0, Math.min(1, off / (n + 0.5)));
    }
    var rowH = 26, colW = Math.min(46, (W - 150) / n), x0 = (W - colW * n) / 2;
    var yMid = H * 0.38;
    var yOf = function (k) { return yMid + (k - curK - frac) * rowH; };

    function line(b, col, wd) {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.beginPath();
      var started = false;
      for (var k = 0; k < rows.length; k++) {
        var y = yOf(k); if (y < -rowH * 2 || y > H + rowH * 2) { started = false; continue; }
        var x = x0 + (rows[k].indexOf(b) + 0.5) * colW;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (myBell !== 1) line(1, 'rgba(255,122,122,.5)', 2);
    line(myBell, BLUE, 3);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var k2 = 0; k2 < rows.length; k2++) {
      var y = yOf(k2);
      if (y < -rowH || y > H + rowH) continue;
      var past = now !== null && k2 < curK;
      if (k2 === curK && now !== null) {
        ctx.fillStyle = 'rgba(100,240,200,.07)';
        ctx.fillRect(x0 - 10, y - rowH / 2, colW * n + 20, rowH);
      }
      ctx.font = '600 10px ui-monospace,Menlo,monospace';
      ctx.fillStyle = 'rgba(139,151,171,.55)';
      ctx.fillText(k2 % 2 ? 'back' : 'hand', x0 - 30, y);
      for (var p = 0; p < n; p++) {
        var b = rows[k2][p];
        var x = x0 + (p + 0.5) * colW;
        var isMe = b === myBell;
        if (k2 === curK && p === curPos && now !== null) {
          ctx.fillStyle = isMe ? BLUE : MINT;
          ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#080b11';
        } else {
          ctx.fillStyle = isMe ? BLUE : b === 1 ? '#ff9a9a' : past ? 'rgba(232,237,245,.35)' : 'rgba(232,237,245,.85)';
        }
        ctx.font = (isMe ? '700 ' : '500 ') + '14px ui-monospace,Menlo,monospace';
        ctx.fillText(SYM[b - 1], x, y);
      }
      if (perf && perf.calls[k2]) {
        ctx.textAlign = 'left'; ctx.font = '600 11px ui-monospace,Menlo,monospace';
        ctx.fillStyle = GOLD; ctx.fillText(perf.calls[k2], x0 + colW * n + 16, y);
        ctx.textAlign = 'center';
      }
    }
    var gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(8,11,17,1)'); gr.addColorStop(0.1, 'rgba(8,11,17,0)');
    gr.addColorStop(0.82, 'rgba(8,11,17,0)'); gr.addColorStop(1, 'rgba(8,11,17,1)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);

    var age = (performance.now() - callShownAt) / 1000;
    if (callText && age < 2.2 && now !== null) {
      ctx.globalAlpha = Math.max(0, 1 - age / 2.2);
      ctx.fillStyle = GOLD; ctx.font = '700 24px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'left'; ctx.fillText(callText + '!', 18, 28);
      ctx.globalAlpha = 1;
    }
    if (perf && perf.mode === 'ring' && perf.hits.length) {
      var sx = W - 150, sy = H - 30;
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 130, sy); ctx.moveTo(sx + 65, sy - 6); ctx.lineTo(sx + 65, sy + 6); ctx.stroke();
      ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.fillStyle = 'rgba(139,151,171,.85)';
      ctx.textAlign = 'center'; ctx.fillText('early · last 12 blows · late', sx + 65, sy + 16);
      perf.hits.slice(-12).forEach(function (h, i, a) {
        var alpha = 0.3 + 0.7 * (i + 1) / a.length;
        if (h.err === null) { ctx.fillStyle = 'rgba(255,122,122,' + alpha + ')'; ctx.font = '700 12px ui-monospace,Menlo,monospace'; ctx.fillText('×', sx + 65, sy - 14); return; }
        var xx = sx + 65 + Math.max(-65, Math.min(65, h.err / 3));
        ctx.fillStyle = Math.abs(h.err) < 50 ? 'rgba(100,240,200,' + alpha + ')' : 'rgba(255,206,106,' + alpha + ')';
        ctx.beginPath(); ctx.arc(xx, sy, 4, 0, Math.PI * 2); ctx.fill();
      });
    }
    var info = $('placeOut');
    if (info) {
      if (now !== null && rows[curK]) {
        var nxt = rows[Math.min(rows.length - 1, curK + 1)];
        info.textContent = 'Row ' + curK + (curK % 2 ? ' · backstroke' : ' · handstroke') + ' · the ' + WORD[myBell] + ' is in ' +
          PLACE[rows[curK].indexOf(myBell)] + ', next ' + PLACE[nxt.indexOf(myBell)];
      } else {
        info.textContent = 'The first rows of the touch. Your bell is blue, the treble red.';
      }
    }
  }

  function drawLine() {
    var cv = $('blueline'); if (!cv) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    ctx.fillStyle = '#080b11'; ctx.fillRect(0, 0, W, H);
    var m = method, n = m.stage, pc = prove(m, plainComp(m));
    var rows = [rounds(n)].concat(pc.rows);
    var leads = pc.heads.length;
    var padT = 30, padB = 14, colGap = 16;
    var colW = Math.min(90, (W - 30 - colGap * (leads - 1)) / leads);
    var totalW = colW * leads + colGap * (leads - 1);
    var x0 = (W - totalW) / 2;
    var rh = (H - padT - padB) / m.lead;
    for (var l = 0; l < leads; l++) {
      var cx = x0 + l * (colW + colGap), pw = colW / n;
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (var p = 0; p <= n; p++) { ctx.beginPath(); ctx.moveTo(cx + p * pw, padT); ctx.lineTo(cx + p * pw, padT + rh * m.lead); ctx.stroke(); }
      [[1, 'rgba(255,122,122,.55)', 1.5], [myBell, BLUE, 2.5]].forEach(function (s) {
        if (s[0] === 1 && myBell === 1) return;
        ctx.strokeStyle = s[1]; ctx.lineWidth = s[2]; ctx.lineJoin = 'round'; ctx.beginPath();
        for (var j = 0; j <= m.lead; j++) {
          var row = rows[l * m.lead + j];
          var x = cx + (row.indexOf(s[0]) + 0.5) * pw, y = padT + j * rh;
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.fillStyle = 'rgba(139,151,171,.85)'; ctx.font = '600 10px ui-monospace,Menlo,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(key(rows[l * m.lead]), cx + colW / 2, 16);
    }
  }

  /* ---------- page ---------- */
  function setStatus(t) { var s = $('status'); if (s) s.textContent = t; }
  function factorial(n) { var f = 1; for (var i = 2; i <= n; i++) f *= i; return f; }

  function renderPlaque() {
    var n = today.bells, m = method;
    $('towerWho').textContent = n + ' bells · tenor ' + today.tenor + ' in ' + today.key;
    $('towerName').textContent = today.tower;
    $('towerBlurb').textContent = today.blurb + ' ' + today.band;
    $('towerMeta').textContent = 'Tonight: ' + m.name + '. You have the ' + WORD[myBell] + ' rope.' +
      (m.stage < n ? ' The tenor covers behind.' : '');
    $('dayOut').textContent = today.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + (dayOffset === 0 ? ' · today' : '');
  }
  function renderChips() {
    var mc = $('methodChips'); mc.innerHTML = '';
    METHODS.forEach(function (m) {
      var b = document.createElement('button');
      b.className = 'chip' + (m === method ? ' on' : ''); b.textContent = m.name;
      b.addEventListener('click', function () {
        stop(true); method = m; comp = plainComp(m);
        today.bells = m.stage % 2 ? m.stage + 1 : m.stage;
        if (myBell > m.stage) myBell = m.stage;
        perf = null; renderAll();
      });
      mc.appendChild(b);
    });
    var bc = $('bellChips'); bc.innerHTML = '';
    for (var i = 1; i <= method.stage; i++) (function (i) {
      var b = document.createElement('button');
      b.className = 'chip' + (i === myBell ? ' on' : ''); b.textContent = WORD[i];
      b.addEventListener('click', function () { stop(true); myBell = i; perf = null; renderAll(); });
      bc.appendChild(b);
    })(i);
  }
  function renderFacts() {
    var m = method, n = today.bells;
    var pc = prove(m, plainComp(m));
    var rowSecs = (n + 0.5) * paceMs / 1000;
    var hms = function (s) { var h = Math.floor(s / 3600), mi = Math.round((s % 3600) / 60); return (h ? h + ' h ' : '') + mi + ' min'; };
    $('fMethod').textContent = m.name;
    $('fPn').textContent = m.changes.map(pnText).join('.');
    $('fLead').textContent = m.lead + ' rows';
    $('fCourse').textContent = pc.rows.length + ' rows, ' + pc.heads.length + ' leads';
    $('fExtent').textContent = factorial(m.stage).toLocaleString() + ' rows (' + m.stage + '!)';
    $('fPeal').textContent = hms(5040 * rowSecs) + ' for 5,040 changes';
    var starts = [key(rounds(m.stage))].concat(pc.heads.map(function (h) { return h.row; })).slice(0, -1);
    $('fPlace').textContent = starts.map(function (s) { return PLACE[s.indexOf(SYM[myBell - 1])]; }).join(' → ');
    $('noteOut').textContent = m.note;
    $('paceOut').textContent = paceMs + ' ms a blow';
    var pr = $('paceRange'); if (pr) pr.value = String(paceMs);
  }
  function renderRows() {
    var m = method, n = today.bells;
    var pc = prove(m, plainComp(m));
    var rows = [rounds(m.stage)].concat(pc.rows);
    var me = SYM[myBell - 1];
    var html = rows.map(function (r, i) {
      var s = key(r) + (m.stage < n ? SYM[n - 1] : '');
      s = s.replace(me, '<b>' + me + '</b>');
      return i > 0 && i % m.lead === 0 ? '<span class="lh">' + s + '</span>' : s;
    });
    var cols = [];
    for (var c = 0; c * m.lead < rows.length - 1; c++) cols.push(html.slice(c * m.lead, (c + 1) * m.lead + 1).join('\n'));
    $('rows').innerHTML = cols.map(function (c) { return '<pre>' + c + '</pre>'; }).join('');
  }
  function renderComp() {
    var m = method, box = $('compBox'), out = $('compOut'), chips = $('lenChips');
    chips.innerHTML = '';
    if (!m.calls) {
      box.disabled = true; box.value = comp;
      out.className = 'verdict';
      out.innerHTML = '<b>No calls modelled for ' + m.name + '.</b> Its bobs and singles alter more than the one change at the lead end, and this room only knows how to swap that one. The plain course still rings: ' + prove(m, comp).rows.length + ' rows, and true.';
      $('heads').innerHTML = '';
      return;
    }
    box.disabled = false;
    if (document.activeElement !== box) box.value = comp.replace(/(.{10})/g, '$1 ').trim();
    lengthsFor(m).forEach(function (L) {
      var b = document.createElement('button');
      b.className = 'chip'; b.textContent = 'Find a ' + L;
      b.addEventListener('click', function () { findTouch(L); });
      chips.appendChild(b);
    });
    var p = prove(m, comp);
    var len = p.rows.length, cls, msg;
    if (p.falseAt) {
      cls = 'bad';
      msg = '<b>False.</b> Row ' + (p.falseAt.row + 1) + ', ' + p.falseAt.k + ', was already rung as row ' + (p.falseAt.again + 1) + '. A touch may never repeat a row, and this one does.';
    } else if (!p.round) {
      cls = 'warn';
      msg = '<b>Does not come round.</b> ' + len + ' rows, all different so far, but the last lead head is ' + (p.heads.length ? p.heads[p.heads.length - 1].row : '—') + ', not rounds. Add leads or move a call.';
    } else {
      cls = 'good';
      msg = '<b>True, and comes round.</b> ' + len + ' rows, every one of them different' +
        (len === factorial(m.stage) ? ' — and that is every row there is on ' + m.stage + ' bells: an extent.' : '.') +
        (p.used < comp.length ? ' Rounds came up after lead ' + p.used + ', so the calls after that are never reached.' : '');
    }
    out.className = 'verdict ' + cls; out.innerHTML = msg;
    var CW = { b: 'Bob', s: 'Single' };
    $('heads').innerHTML = p.heads.map(function (h, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + (CW[h.call] || '—') + '</td><td>' + h.row + '</td></tr>';
    }).join('');
  }
  function findTouch(L) {
    var out = $('compOut');
    out.className = 'verdict'; out.innerHTML = 'Composing a touch of ' + L + '…';
    setTimeout(function () {
      var s = search(method, L, (seedForDate(today.date) ^ Math.imul(L, 2654435761)) >>> 0);
      if (!s) { out.className = 'verdict warn'; out.innerHTML = '<b>Gave up.</b> A blind search did not find a true ' + L + ' in the time it was allowed. They exist; try building one by hand.'; return; }
      stop(true); comp = s; perf = null; renderComp(); drawRinging();
    }, 30);
  }
  function renderAll() {
    renderPlaque(); renderChips(); renderFacts(); renderRows(); renderComp();
    drawRinging(); drawLine();
    var v = $('verdict');
    if (v) { v.className = 'verdict'; v.innerHTML = 'Ring the touch yourself and your striking is marked here: how many blows, how many clean, and which way you tend to be out.'; }
  }
  function rebuild() {
    stop(true); perf = null; buildDay(); renderAll();
    setStatus('Press Listen to hear the band ring it, or Ring to take the ' + WORD[myBell] + ' yourself.');
  }

  /* ---------- wiring ---------- */
  wire('btnListen', 'click', function () { if (perf && perf.playing && perf.mode === 'listen') stop(false); else play('listen'); });
  wire('btnRing', 'click', function () { play('ring'); });
  wire('btnStand', 'click', function () { stop(false); });
  wire('btnPlain', 'click', function () { stop(true); comp = plainComp(method); perf = null; renderComp(); drawRinging(); });
  wire('btnPrev', 'click', function () { dayOffset--; rebuild(); });
  wire('btnNext', 'click', function () { dayOffset++; rebuild(); });
  wire('btnToday', 'click', function () { dayOffset = 0; rebuild(); });
  wire('paceRange', 'input', function (e) { paceMs = +e.target.value; renderFacts(); });
  wire('paceRange', 'change', function () { if (perf && perf.playing) play(perf.mode); });
  wire('compBox', 'input', function (e) {
    var s = e.target.value.toLowerCase().replace(/-/g, 'b').replace(/[^pbs]/g, '');
    if (!s) return;
    stop(true); comp = s; perf = null; renderComp(); drawRinging();
  });
  wire('rope', 'pointerdown', function (e) { e.preventDefault(); pull(); });
  wire('ringing', 'pointerdown', function () { pull(); });

  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'j' || e.key === 'J') {
      if (perf && perf.playing && perf.mode === 'ring') { e.preventDefault(); if (!e.repeat) pull(); }
      return;
    }
    if (e.key === 'ArrowLeft') { dayOffset--; rebuild(); }
    else if (e.key === 'ArrowRight') { dayOffset++; rebuild(); }
    else if (e.key === 't' || e.key === 'T') { dayOffset = 0; rebuild(); }
  });
  window.addEventListener('resize', function () { if (today) { drawRinging(); drawLine(); } });

  rebuild();
})();
