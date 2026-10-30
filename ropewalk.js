/* drift.quibo.games — The Ropewalk
   A ropewalk some time between 1780 and 1859, on today's calendar date. The day's number picks the walk (and so
   how far you have to go), the hemp (how long its fibre is, and so how little twist will hold it, and how evenly it
   was hackled), the boy on the wheel (how steadily he turns and how soon he flags), and the order on the slate:
   a lead line, a bolt rope, a hawser, a bell rope, each wanting its own hardness of yarn.

   The spinner wraps a bundle of hemp round his waist, hooks a few fibres to the whirl on the wheel, and walks
   backwards down the walk letting the hemp out through his fingers. The boy turns the wheel; the wheel puts in the
   twist. The spinner has two things to keep even with one body: how fast he walks back, which together with the
   wheel decides how hard the yarn is twisted, and how fast he lets the hemp go, which together with his walking
   decides how thick it is. When the boy slows, walk slower; when you walk slower, let less hemp through.

   Local twist is turns of the wheel per foot walked. Local thickness is hemp let through per foot walked. Stand
   still and you put a hard lump in it; walk off too fast and the twist will not hold the fibres and the yarn parts.
   Three yarns are laid up into the rope at the end, and the rope is as strong as its weakest foot. Self-contained. */
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
    var h = s ^ 0x2c71a5e3;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  function money(d) {
    d = Math.max(0, Math.round(d));
    var s = Math.floor(d / 12), p = d % 12;
    if (s && p) return s + 's ' + p + 'd';
    if (s) return s + 's';
    return p + 'd';
  }

  /* ---------- constants ---------- */
  var V0 = 12;          // a good steady walk, in feet per second of page time
  var VMAX = 22;        // as fast as anybody walks backwards
  var FMAX = 24;        // hemp let through, in yarn-feet per second (1 per foot = the sample's thickness)
  var YARNS = 3;        // three yarns to the rope here; a real rope has hundreds
  var ENDS = 30;        // feet cut off each end of a yarn before it is laid
  var PIECE = 3;        // seconds to piece a parted yarn
  var BAND_T = 0.12;    // twist within 12% of the sample counts as even
  var BAND_D = 0.12;    // and thickness the same

  var WALKS = [
    { town: 'Chatham', county: 'Kent', where: 'the double ropehouse in the Dockyard', L: 1110, roof: true },
    { town: 'Portsmouth', county: 'Hampshire', where: 'the ropehouse in the Dockyard', L: 1060, roof: true },
    { town: 'Plymouth Dock', county: 'Devon', where: 'the Dockyard ropery', L: 1020, roof: true },
    { town: 'Bridport', county: 'Dorset', where: 'an open walk between hedges behind West Street', L: 640, roof: false },
    { town: 'Hull', county: 'the East Riding', where: 'a walk off the Holderness road', L: 900, roof: true },
    { town: 'Whitby', county: 'the North Riding', where: 'a walk on the cliff above the harbour', L: 760, roof: false },
    { town: 'Sunderland', county: 'County Durham', where: 'a long shed by the Wear', L: 820, roof: true },
    { town: 'Liverpool', county: 'Lancashire', where: 'a walk out towards Everton', L: 880, roof: false },
    { town: 'Leith', county: 'Midlothian', where: 'a ropery behind the Links', L: 700, roof: true },
    { town: 'Port Glasgow', county: 'Renfrewshire', where: 'the ropework above the Clyde', L: 900, roof: true },
    { town: 'Bristol', county: 'Gloucestershire', where: 'a walk on the edge of the town', L: 780, roof: false },
    { town: 'Great Yarmouth', county: 'Norfolk', where: 'a walk out on the Denes', L: 720, roof: false }
  ];
  var HEMPS = [
    { name: 'Riga Rhine hemp', slip: 0.56, hack: 0.035, say: 'long, clean and well hackled, the best that comes into the country' },
    { name: 'St Petersburg clean hemp', slip: 0.6, hack: 0.055, say: 'good hemp but with some short tow left in it' },
    { name: 'Königsberg hemp', slip: 0.63, hack: 0.075, say: 'coarse, short in the fibre and hackled in a hurry' },
    { name: 'Italian hemp', slip: 0.52, hack: 0.03, say: 'fine, long and silky, too dear for anything but small work' },
    { name: 'Manila', slip: 0.68, hack: 0.045, from: 1830, say: 'from the Philippines, not true hemp at all: strong, light and so smooth that it wants more twist to hold' }
  ];
  var BOYS = [
    { name: 'Tom', amp: 0.06, tire: 0.04, say: 'steady as a clock' },
    { name: 'Billy', amp: 0.1, tire: 0.06, say: 'willing but given to looking round' },
    { name: 'Jem', amp: 0.14, tire: 0.05, say: 'new to the wheel, and goes by fits and starts' },
    { name: 'Ned', amp: 0.08, tire: 0.11, say: 'quick to begin with and quick to flag' },
    { name: 'Sam', amp: 0.11, tire: 0.03, say: 'a big lad who turns hard and does not tire, though not evenly' }
  ];
  var ORDERS = [
    { what: 'a lead line', for: 'for a leadsman to sound with', T: 14, take: 0.3, need: 0.78, pay: 22,
      why: 'Hard laid, so it will not stretch and spoil the marks.' },
    { what: 'a bolt rope', for: 'for the sailmakers to sew round the edge of a topsail', T: 9, take: 0.24, need: 0.7, pay: 20,
      why: 'Soft laid, so the sailmaker’s needle goes through it and it gives with the canvas.' },
    { what: 'a hawser', for: 'for a collier brig to warp in by', T: 11, take: 0.28, need: 0.8, pay: 26,
      why: 'Common laid and strong, because it will take the whole brig on it.' },
    { what: 'a tiller rope', for: 'to go round the barrel of a ship’s wheel', T: 13, take: 0.3, need: 0.78, pay: 22,
      why: 'Hard laid and round, so it runs true round the barrel and does not stretch.' },
    { what: 'a bell rope', for: 'for a church tower out in the country', T: 9, take: 0.24, need: 0.67, pay: 18,
      why: 'Soft laid, kind to the hands and to the sally.' },
    { what: 'a well rope', for: 'for a farm with a deep well', T: 10, take: 0.26, need: 0.7, pay: 16,
      why: 'Common laid; it must not unlay itself when the bucket spins.' }
  ];
  var FOREMEN = ['Hollis', 'Pengelly', 'Rudd', 'Mackay', 'Gurney', 'Trotter', 'Venning', 'Ogle', 'Dunster', 'Pratt', 'Lumsden', 'Crabb'];

  /* smooth seeded noise: a few sines with seeded frequencies and phases, mean 0, roughly unit amplitude */
  function wobble(r, scale) {
    var k = [];
    for (var i = 0; i < 4; i++) k.push({ f: (0.4 + r() * 1.4) / scale * (i + 1) * 0.6, p: r() * 6.283, a: 1 / (i + 1) });
    var norm = k.reduce(function (s, q) { return s + q.a; }, 0) * 0.6;
    return function (x) { var s = 0; for (var i = 0; i < k.length; i++) s += k[i].a * Math.sin(k[i].f * x + k[i].p); return s / norm; };
  }

  function makeDay(off, dateIn) {
    var date = dateIn || dateFor(off), seed = seedForDate(date), r = rng(seed);
    var d = { date: date, seed: seed };
    d.year = 1780 + Math.floor(r() * 80);
    d.walk = pick(r, WALKS);
    d.L = d.walk.L + Math.round((r() - 0.5) * 40);
    d.hemp = pick(r, HEMPS.filter(function (h) { return !h.from || d.year >= h.from; }));
    d.boy = pick(r, BOYS);
    d.order = pick(r, ORDERS);
    d.foreman = pick(r, FOREMEN);
    d.Tt = d.order.T;
    d.slip = d.hemp.slip;
    /* the rope wanted: what three good full-length yarns would lay up into, less a margin */
    d.fathoms = Math.floor((d.L - 2 * ENDS) * (1 - d.order.take) / 6 * 0.95);
    d.pay = d.order.pay + Math.floor(r() * 6);
    d.dateStr = WEEKDAYS[new Date(d.year, date.getMonth(), date.getDate()).getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + d.year;
    /* a wheel for each yarn: its own wander, the boy flagging through it, and two or three things that happen */
    d.wheels = [];
    for (var y = 0; y < YARNS; y++) {
      var ev = [], n = 2 + Math.floor(r() * 2), est = d.L / V0;
      for (var i = 0; i < n; i++) {
        var at = est * (0.15 + 0.75 * (i + r() * 0.8) / n);
        var kind = r() < 0.55 ? 'lull' : 'spurt';
        ev.push({ at: at, len: 3 + r() * 3, k: kind, f: kind === 'lull' ? 0.68 + r() * 0.1 : 1.2 + r() * 0.1 });
      }
      d.wheels.push({ n: wobble(r, 9), ev: ev, tire0: y * d.boy.tire * 0.5 });
    }
    d.hackle = [];
    for (var j = 0; j < YARNS; j++) d.hackle.push(wobble(r, 18));
    return d;
  }

  /* the wheel's turns per second at the hook, at time t into yarn y */
  function wheel(d, y, t) {
    var W = d.wheels[y], est = d.L / V0;
    var w = 1 + d.boy.amp * W.n(t);
    w *= 1 - W.tire0 - d.boy.tire * clamp(t / est, 0, 1.4) * 0.5;
    for (var i = 0; i < W.ev.length; i++) {
      var e = W.ev[i], k = smooth(e.at, e.at + 0.8, t) * (1 - smooth(e.at + e.len, e.at + e.len + 1, t));
      w *= lerp(1, e.f, k);
    }
    return d.Tt * V0 * w;
  }
  function wheelEvent(d, y, t0, t1) {
    var ev = d.wheels[y].ev;
    for (var i = 0; i < ev.length; i++) {
      if (ev[i].at >= t0 && ev[i].at < t1) return { k: ev[i].k, start: true };
      var e = ev[i].at + ev[i].len;
      if (e >= t0 && e < t1) return { k: ev[i].k, start: false };
    }
    return null;
  }

  function newRun(d) {
    return { y: 0, yarns: [], cur: null, started: false, over: false, laid: false, msgs: [] };
  }
  function newYarn(d, run) {
    var Lb = d.L + 2;
    run.cur = {
      i: run.yarns.length, t: 0, x: 0, v: 0, f: 0, hemp: d.L * 1.08,
      m: new Float32Array(Lb), n: new Float32Array(Lb), bin: 0,
      splice: [], kinks: 0, breaks: 0, piece: 0, lowT: 0, Tn: d.Tt, Dn: 1, end: false, why: ''
    };
    return run.cur;
  }

  /* advance the spinner by dt seconds with walk v and feed f; returns a message or null */
  function step(d, run, dt, v, f) {
    var c = run.cur;
    if (!c || c.end) return null;
    var msg = null;
    var w = wheel(d, c.i, c.t);
    if (c.piece > 0) { c.piece -= dt; v = 0; f = 0; }
    if (c.hemp <= 0) f = 0;
    var hn = 1 + d.hemp.hack * d.hackle[c.i](c.x) * 2.2;
    var fe = Math.min(f * hn * dt, Math.max(0, c.hemp));
    c.hemp -= f * dt;
    /* twist and hemp go into the foot of yarn under the hand; walking moves the hand on to the next foot */
    var nx = Math.min(d.L, c.x + v * dt), b = Math.floor(c.x);
    var fb = Math.floor(nx);
    if (fb === b) { c.m[b] += fe; c.n[b] += w * dt; }
    else {
      /* spread across the feet crossed, by the fraction of the step spent in each */
      var span = nx - c.x;
      for (var k = b; k <= fb && k < c.m.length; k++) {
        var lo = Math.max(c.x, k), hi = Math.min(nx, k + 1), fr = span > 0 ? (hi - lo) / span : 0;
        c.m[k] += fe * fr; c.n[k] += w * dt * fr;
      }
    }
    c.x = nx; c.t += dt;
    var vv = Math.max(v, 0.4);
    var Tnow = Math.min(w / vv, d.Tt * 3), Dnow = Math.min((f * hn) / vv, 3);
    var a = 1 - Math.exp(-dt * 5);
    c.Tn += (Tnow - c.Tn) * a; c.Dn += (Dnow - c.Dn) * a;
    c.w = w;
    /* too little twist under a moving hand and the fibres slide past one another */
    if (v > 2 && c.piece <= 0 && Tnow < d.slip * d.Tt && c.x > ENDS) {
      c.lowT += dt;
      if (c.lowT > 0.45) {
        c.lowT = 0; c.breaks++; c.splice.push(Math.floor(c.x)); c.piece = PIECE;
        msg = 'The yarn parts in your hand at <b>' + Math.floor(c.x) + ' ft</b>: you walked away from the twist. You stop and piece it.';
      }
    } else c.lowT = Math.max(0, c.lowT - dt);
    if (c.x >= d.L - 0.01) { c.end = true; c.why = 'walk'; }
    else if (c.hemp <= 0 && v > 0.5) { c.end = true; c.why = 'hemp'; }
    return msg;
  }

  /* what one finished yarn is like, foot by foot */
  function finish(d, run) {
    var c = run.cur, len = Math.floor(c.x), D = [], T = [], S = [], spl = {};
    c.splice.forEach(function (s) { spl[s] = 1; spl[s + 1] = 1; });
    var kinks = 0, lumps = 0, thin = 0, out = 0, cnt = 0;
    for (var i = 0; i < len; i++) {
      var dd = c.m[i], tt = c.n[i] / d.Tt, s;
      D.push(dd); T.push(c.n[i]);
      s = strength(d, dd, tt);
      if (spl[i]) s *= 0.55;
      S.push(s);
      if (i >= ENDS && i < len - ENDS) {
        cnt++;
        if (Math.abs(tt - 1) > BAND_T || Math.abs(dd - 1) > BAND_D) out++;
        if (tt > 1.7) kinks++;
        if (dd > 1.35) lumps++;
        if (dd < 0.7) thin++;
      }
    }
    var y = { i: c.i, len: len, D: D, T: T, S: S, splice: c.splice.slice(), breaks: c.breaks, kinks: kinks, lumps: lumps, thin: thin,
      out: cnt ? out / cnt : 1, why: c.why, hempLeft: Math.max(0, c.hemp) };
    run.yarns.push(y);
    run.cur = null;
    return y;
  }
  function strength(d, dd, tt) {
    /* the hemp gives strength in proportion to how much of it there is, up to a point: a lump is not shared out */
    var mass = Math.min(dd, 1.25) - Math.max(0, dd - 1.25) * 0.4;
    var q;
    var rs = d.slip;
    if (tt < rs) q = 0.12;
    else if (tt < 0.92) q = lerp(0.35, 0.97, smooth(rs, 0.92, tt));
    else if (tt <= 1.12) q = 1;
    else q = Math.max(0.45, 1 - (tt - 1.12) * 0.55);
    if (tt > 1.7) q *= 0.8; // a kink
    return Math.max(0, mass) * q;
  }

  /* lay the three yarns up into a rope and put it on the proving machine */
  function lay(d, run) {
    var ys = run.yarns, len = Math.min.apply(null, ys.map(function (y) { return y.len; }));
    var R = [], weakest = 9, wAt = 0;
    for (var i = ENDS; i < len - ENDS; i++) {
      var sum = 0, dmax = 0, dmin = 9, dsum = 0;
      ys.forEach(function (y) { sum += y.S[i]; dmax = Math.max(dmax, y.D[i]); dmin = Math.min(dmin, y.D[i]); dsum += y.D[i]; });
      var share = clamp(1 - 0.55 * (dmax - dmin) / Math.max(0.2, dsum / ys.length), 0.5, 1);
      R.push(sum / ys.length * share);
    }
    /* a rope breaks over a short length, not at a single foot */
    var Rs = R.map(function (_, i) { var s = 0, n = 0; for (var k = -2; k <= 2; k++) { if (R[i + k] !== undefined) { s += R[i + k]; n++; } } return s / n; });
    Rs.forEach(function (s, i) { if (s < weakest) { weakest = s; wAt = i + ENDS; } });
    if (!Rs.length) { weakest = 0; wAt = 0; }
    var ropeFt = Math.max(0, len - 2 * ENDS) * (1 - d.order.take);
    var fathoms = Math.floor(ropeFt / 6);
    var outAll = ys.reduce(function (s, y) { return s + y.out; }, 0) / ys.length;
    var passed = weakest >= d.order.need, longEnough = fathoms >= d.fathoms;
    var pay = 0;
    if (passed) pay = d.pay * (longEnough ? 1 : 0.6) * (1 - 0.5 * clamp(outAll, 0, 1));
    run.rope = { R: Rs, weakest: weakest, wAt: wAt, fathoms: fathoms, passed: passed, longEnough: longEnough, out: outAll, pay: Math.round(pay), len: len };
    run.laid = true;
    return run.rope;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { makeDay: makeDay, newRun: newRun, newYarn: newYarn, step: step, finish: finish, lay: lay, wheel: wheel, V0: V0, VMAX: VMAX, FMAX: FMAX, YARNS: YARNS };
  }
  if (typeof document === 'undefined') return;

  /* ===================================================================== page ===================================================================== */
  function $(id) { return document.getElementById(id); }
  var offset = 0, day = null, run = null, cv, ctx, last = 0, phase = 0, wheelA = 0, layT = -1, flash = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLS = ['#64f0c8', '#7aa2ff', '#ffce6a'];

  function say(html) {
    run.msgs.unshift('<div>' + html + '</div>');
    run.msgs = run.msgs.slice(0, 3);
    $('msg').innerHTML = run.msgs.join('');
  }
  function vIn() { return +$('walk').value / 100 * VMAX; }
  function fIn() { return +$('feed').value / 100 * FMAX; }

  function plaque() {
    var d = day, o = d.order;
    $('rWho').textContent = d.dateStr + ' · ' + d.walk.town + ', ' + d.walk.county;
    $('rName').textContent = cap1(o.what) + ', ' + d.fathoms + ' fathoms';
    $('rBlurb').innerHTML = 'Mr ' + d.foreman + ' has chalked it on the slate: <b>' + o.what + '</b> ' + o.for + ', ' + d.fathoms + ' fathoms when it is laid. ' + o.why + ' ' +
      'The walk is ' + d.walk.where + ', <b>' + d.L + ' feet</b> from the wheel to the far end. ' +
      'The hemp is <b>' + d.hemp.name + '</b>, ' + d.hemp.say + '. ' +
      'The boy on the wheel is ' + d.boy.name + ', ' + d.boy.say + '. ' +
      'Three yarns to spin, and then the rope is laid and tried on the machine. The yard pays <b>' + money(d.pay) + '</b> for it if it holds.';
    $('dayOut').textContent = (offset === 0 ? 'Today' : offset < 0 ? (-offset) + ' day' + (offset < -1 ? 's' : '') + ' ago' : 'In ' + offset + ' day' + (offset > 1 ? 's' : '')) + ' · ' + d.walk.town + ' ' + d.year;
  }

  function word(r, soft, hard) {
    if (r < 1 - 0.2) return soft[1];
    if (r < 1 - 0.07) return soft[0];
    if (r <= 1 + 0.07) return 'just right';
    if (r <= 1 + 0.2) return hard[0];
    return hard[1];
  }
  function sync() {
    var c = run.cur, d = day;
    var yarnNo = run.laid ? '—' : Math.min(run.yarns.length + (c ? 1 : 0), YARNS) + ' of ' + YARNS;
    $('hYarn').textContent = yarnNo;
    if (c) {
      var wr = (c.w || wheel(d, c.i, c.t)) / (d.Tt * V0);
      $('hDown').textContent = Math.floor(c.x) + ' of ' + d.L + ' ft';
      $('hWheel').textContent = wr < 0.84 ? 'slack, nearly stopped' : wr < 0.94 ? 'slowing' : wr <= 1.06 ? 'steady' : wr < 1.16 ? 'brisk' : 'racing';
      $('hWalk').textContent = c.piece > 0 ? 'piecing' : c.v < 0.4 ? 'standing' : c.v < V0 * 0.75 ? 'slow' : c.v <= V0 * 1.2 ? 'steady' : 'fast';
      $('hTwist').textContent = word(c.Tn / d.Tt, ['a little soft', 'slack'], ['a little hard', 'hard as wire']);
      $('hThick').textContent = word(c.Dn, ['a little fine', 'thin'], ['a little fat', 'lumpy']);
      $('hHemp').textContent = Math.round(clamp(c.hemp / (d.L * 1.08), 0, 1) * 100) + '% left';
      $('hHemp').parentNode.className = c.hemp < (d.L - c.x) * 0.95 ? 'alarm' : '';
      $('hTwist').parentNode.className = Math.abs(c.Tn / d.Tt - 1) > 0.2 ? 'alarm' : '';
      $('hThick').parentNode.className = Math.abs(c.Dn - 1) > 0.2 ? 'alarm' : '';
    } else {
      ['hDown', 'hWheel', 'hWalk', 'hTwist', 'hThick', 'hHemp'].forEach(function (id) { $(id).textContent = '—'; $(id).parentNode.className = ''; });
    }
    var ul = $('yarns'); ul.innerHTML = '';
    for (var i = 0; i < YARNS; i++) {
      var li = document.createElement('li'), y = run.yarns[i], s;
      if (y) {
        s = y.len + ' ft · ' + Math.round((1 - y.out) * 100) + '% even' + (y.breaks ? ' · ' + NUMW[Math.min(10, y.breaks)] + ' piece' + (y.breaks > 1 ? 's' : '') : '') + (y.lumps > 4 ? ' · lumpy' : '') + (y.kinks > 4 ? ' · kinked' : '');
        li.className = 'done';
      } else if (c && c.i === i) { s = 'on the hook, ' + Math.floor(c.x) + ' ft down'; li.className = 'now'; }
      else s = 'not begun';
      li.innerHTML = '<b style="color:' + COLS[i] + '">Yarn ' + (i + 1) + '</b><span>' + s + '</span>';
      ul.appendChild(li);
    }
  }

  function begin() {
    if (run.over) return;
    if (run.yarns.length >= YARNS) return;
    newYarn(day, run);
    run.started = true;
    $('walk').value = 0; $('feed').value = 0;
    $('btnStart').style.display = 'none';
    $('tools').style.display = '';
    $('btnLay').style.display = 'none';
    say('Yarn ' + (run.yarns.length + 1) + ': you hook a few fibres to the whirl, ' + day.boy.name + ' starts the wheel and you begin to walk backwards.');
    sync();
  }
  function endYarn() {
    var c = run.cur; if (!c) return;
    var why = c.why;
    var y = finish(day, run);
    var bits = [];
    if (why === 'hemp') bits.push('you ran out of hemp at <b>' + y.len + ' ft</b>, short of the end of the walk');
    else if (why === 'walk') bits.push('you reach the far end of the walk');
    else bits.push('you stop and break it off at <b>' + y.len + ' ft</b>');
    bits.push(Math.round((1 - y.out) * 100) + '% of it within a finger of the sample');
    say('Yarn ' + (y.i + 1) + ': ' + bits.join('; ') + '. ' + (y.i + 1 < YARNS ? 'It goes up on the stakeheads and you walk back to the wheel.' : 'That is the three.'));
    $('tools').style.display = 'none';
    if (run.yarns.length < YARNS) { $('btnStart').textContent = 'Hook on yarn ' + (run.yarns.length + 1); $('btnStart').style.display = ''; }
    else { $('btnLay').style.display = ''; }
    sync();
  }
  function startLay() {
    $('btnLay').style.display = 'none';
    lay(day, run);
    layT = reduce ? 3 : 0;
    say('The three yarns are hooked to the forming hooks, the top goes in between them and walks down the walk as they close up into rope.');
  }

  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    var c = run && run.cur;
    if (c && !c.end) {
      var v = vIn(), f = fIn(), t0 = c.t;
      c.v = c.piece > 0 ? 0 : v; c.f = f;
      var m = step(day, run, dt, v, f);
      if (m) { say(m); flash = 0.6; }
      var ev = wheelEvent(day, c.i, t0, c.t);
      if (ev) {
        if (ev.k === 'lull' && ev.start) say('Behind you the wheel goes quiet: ' + day.boy.name + ' is looking out of the door. Walk slower or the yarn will come out soft.');
        else if (ev.k === 'lull') say(day.boy.name + ' has been shouted at and the wheel picks up again.');
        else if (ev.start) say('Mr ' + day.foreman + ' walks past the wheel and ' + day.boy.name + ' turns for all he is worth. Walk faster or the yarn goes hard.');
        else say('Mr ' + day.foreman + ' has gone, and so has ' + day.boy.name + '’s hurry.');
      }
      if (c.end) endYarn();
      if (Math.floor(now / 200) !== Math.floor((now - dt * 1000) / 200)) sync();
    }
    if (layT >= 0 && layT < 3) {
      layT += dt;
      if (layT >= 3) showVerdict();
    }
    if (flash > 0) flash -= dt;
    if (!reduce) { phase += dt * (c && !c.end ? (c.w || 0) / (day.Tt * V0) : 0.15) * 3; wheelA += dt * (c && !c.end ? (c.w || 0) / (day.Tt * V0) * 7 : 0); }
    paint();
    requestAnimationFrame(loop);
  }

  /* ---------- drawing ---------- */
  function yarnBand(g, x0, x1, y, dd, T, ph, col, edge) {
    var w = clamp(dd, 0.25, 2.6) * 20;
    g.fillStyle = col;
    g.fillRect(x0, y - w / 2, x1 - x0, w);
    /* the lay of the fibres: closer and steeper stripes with more twist */
    var pitch = clamp(30 * day.Tt / Math.max(1, T), 5, 70) * clamp(dd, 0.6, 1.6);
    var lean = w * clamp(T / day.Tt, 0.3, 3) * 0.55;
    g.save();
    g.beginPath(); g.rect(x0, y - w / 2, x1 - x0, w); g.clip();
    g.strokeStyle = edge; g.lineWidth = 1.4;
    var off = ((ph * pitch) % pitch + pitch) % pitch;
    for (var x = x0 - lean - pitch + off; x < x1 + pitch; x += pitch) {
      g.beginPath(); g.moveTo(x, y - w / 2); g.lineTo(x + lean, y + w / 2); g.stroke();
    }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    g.strokeRect(x0, y - w / 2, x1 - x0, w);
  }
  function paint() {
    var g = ctx, W = cv.width, H = cv.height, d = day, c = run.cur;
    g.clearRect(0, 0, W, H);
    /* --- the whole walk --- */
    g.fillStyle = d.walk.roof ? '#14110d' : '#0f1612';
    g.fillRect(0, 0, W, 118);
    var X0 = 64, X1 = W - 22, sx = function (ft) { return X0 + (X1 - X0) * ft / d.L; };
    if (d.walk.roof) {
      g.fillStyle = '#211a12'; g.fillRect(0, 0, W, 16);
      g.fillStyle = 'rgba(255,220,160,.06)';
      for (var wi = 0; wi < 14; wi++) g.fillRect(X0 + wi * (X1 - X0) / 14 + 10, 16, 18, 6);
    } else {
      g.fillStyle = '#1d2a1c';
      for (var hx = 0; hx < W; hx += 14) { g.beginPath(); g.arc(hx, 10, 9 + (hx * 7 % 5), 0, 7); g.fill(); }
    }
    g.fillStyle = '#2a2219'; g.fillRect(0, 100, W, 18);
    /* stakeheads */
    g.strokeStyle = '#5b4a36'; g.lineWidth = 2;
    for (var ft = 60; ft < d.L; ft += 60) {
      var px = sx(ft); g.beginPath(); g.moveTo(px, 100); g.lineTo(px, 40); g.moveTo(px - 6, 40); g.lineTo(px + 6, 40); g.stroke();
    }
    /* the wheel */
    var wx = 30, wy = 62;
    g.strokeStyle = '#a8865a'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(wx, wy, 22, 0, 7); g.stroke();
    g.lineWidth = 1.5;
    for (var s = 0; s < 6; s++) { var a = wheelA + s * Math.PI / 3; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(a) * 22, wy + Math.sin(a) * 22); g.stroke(); }
    g.beginPath(); g.moveTo(wx - 10, 100); g.lineTo(wx, wy); g.lineTo(wx + 10, 100); g.stroke();
    /* the boy */
    g.fillStyle = '#8a7a66'; g.beginPath(); g.arc(wx - 2, 30, 4.5, 0, 7); g.fill();
    g.fillRect(wx - 5, 35, 6, 14);
    g.fillStyle = '#c7b9a5'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'left';
    g.fillText(d.boy.name, 4, 112);
    /* finished yarns hanging on the stakeheads */
    run.yarns.forEach(function (y, i) {
      g.strokeStyle = COLS[i]; g.globalAlpha = 0.75; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(X0, 42 + i * 4); g.lineTo(sx(y.len), 42 + i * 4); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#ff8a7a';
      y.splice.forEach(function (p) { g.fillRect(sx(p) - 1.5, 39 + i * 4, 3, 6); });
    });
    /* laying: the top walking down the walk */
    if (run.laid && layT >= 0) {
      var lt = clamp(layT / 3, 0, 1), lx = lerp(X0, sx(run.rope.len), lt);
      g.strokeStyle = '#e3c58f'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(X0, 80); g.lineTo(lx, 80); g.stroke();
      g.fillStyle = '#8b5a2b'; g.beginPath(); g.moveTo(lx, 72); g.lineTo(lx + 16, 80); g.lineTo(lx, 88); g.closePath(); g.fill();
    }
    /* the yarn being spun and the spinner */
    if (c) {
      var spx = sx(c.x);
      g.strokeStyle = COLS[c.i]; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(wx + 22, wy); g.quadraticCurveTo((wx + spx) / 2, wy + 10, spx, 66); g.stroke();
      g.fillStyle = '#d6c7b0';
      g.beginPath(); g.arc(spx + 3, 52, 5, 0, 7); g.fill();
      g.fillRect(spx, 58, 7, 22);
      g.fillRect(spx + 1, 80, 2.5, 18); g.fillRect(spx + 4, 80, 2.5, 18);
      var hr = clamp(c.hemp / (d.L * 1.08), 0, 1);
      g.fillStyle = '#c9a86a'; g.beginPath(); g.ellipse(spx + 6, 70, 4 + hr * 8, 5 + hr * 3, 0, 0, 7); g.fill();
    }
    g.fillStyle = '#8b97ab'; g.textAlign = 'right';
    g.fillText(d.L + ' ft', X1, 112);
    g.textAlign = 'left';

    /* --- the close-up at the hand --- */
    g.fillStyle = '#0b0f16'; g.fillRect(0, 122, W, H - 122);
    g.fillStyle = '#8b97ab'; g.font = '600 10px ui-monospace,Menlo,monospace';
    g.fillText('THE SAMPLE ON THE POST', 24, 146);
    yarnBand(g, 24, 300, 168, 1, d.Tt, 0, '#c9a86a', 'rgba(70,45,15,.75)');
    g.fillText('THE YARN UNDER YOUR HAND', 24, 214);
    var Y = 268, hand = 460;
    if (c) {
      yarnBand(g, 0, hand, Y, c.Dn, c.Tn, -phase, '#d4b47a', 'rgba(80,52,18,.8)');
      /* the gauge: the sample's thickness, give or take */
      g.strokeStyle = 'rgba(100,240,200,.55)'; g.lineWidth = 1; g.setLineDash([4, 4]);
      [1 - BAND_D, 1 + BAND_D].forEach(function (k) { g.beginPath(); g.moveTo(330, Y - k * 10); g.lineTo(440, Y - k * 10); g.moveTo(330, Y + k * 10); g.lineTo(440, Y + k * 10); g.stroke(); });
      g.setLineDash([]);
      /* fibres fanning back to the bundle */
      g.strokeStyle = 'rgba(214,180,122,.5)';
      for (var fi = 0; fi < 22; fi++) {
        var spread = (fi / 21 - 0.5) * (50 + c.f * 3);
        g.beginPath(); g.moveTo(hand, Y + (fi / 21 - 0.5) * c.Dn * 10); g.quadraticCurveTo(hand + 70, Y + spread * 0.4, W - 10, Y + spread); g.stroke();
      }
      /* the hand */
      g.fillStyle = '#c99c7a';
      g.beginPath(); g.ellipse(hand + 18, Y, 22, 16, 0, 0, 7); g.fill();
      g.fillStyle = '#4a5a6a'; g.beginPath(); g.ellipse(hand + 18, Y + 2, 16, 11, 0, 0, 7); g.fill(); // the wet rag
      if (c.piece > 0 || flash > 0) { g.fillStyle = '#ff8a7a'; g.font = '600 12px ui-monospace,Menlo,monospace'; g.fillText('PARTED — PIECING', 24, H - 14); }
    } else {
      g.fillStyle = '#5d6878'; g.font = 'italic 13px Georgia,serif';
      g.fillText(run.laid ? 'The rope is laid.' : run.yarns.length ? 'Walking back up to the wheel.' : 'The hemp is round your waist. Hook on when you are ready.', 24, Y + 4);
    }
  }

  /* ---------- verdict and the trace ---------- */
  function showVerdict() {
    var d = day, R = run.rope;
    run.over = true;
    var v = $('verdict');
    var ps = [];
    if (R.R.length) ps.push('<p>The rope is laid up, <b>' + R.fathoms + ' fathoms</b> of it against the ' + d.fathoms + ' on the slate' + (R.longEnough ? '' : ', short') + '. Mr ' + d.foreman + ' has a length put on the machine and the weights hung on.</p>');
    if (!R.R.length) ps.push('<p>There is <b>not enough yarn</b> to lay: once the ends are cut off the shortest yarn has nothing left. Mr ' + d.foreman + ' sends the hemp to be picked for oakum and the job to another spinner.</p>');
    else if (R.passed) ps.push('<p>It <b>holds</b>. Its weakest place, ' + R.wAt + ' ft from the wheel end, bore ' + Math.round(R.weakest * 100) + ' parts in a hundred of what a rope of perfect yarn would; the yard asks ' + Math.round(d.order.need * 100) + '. ' +
      (R.out < 0.2 ? 'It is round and even all the way along.' : R.out < 0.45 ? 'It has some soft places and some fat ones, which he looks at but lets go.' : 'It is lumpy, hard in one place and slack in the next, and he says so.') + '</p>');
    else ps.push('<p>It <b>breaks</b>, at ' + R.wAt + ' ft from the wheel end, bearing ' + Math.round(R.weakest * 100) + ' parts in a hundred of what it should; the yard asks ' + Math.round(d.order.need * 100) + '. The rope is condemned and goes to be picked apart for oakum.</p>');
    ps.push('<p>You are paid <b>' + (R.pay ? money(R.pay) : 'nothing') + '</b>' + (R.passed && !R.longEnough ? ', at the short rate' : '') + '.</p>');
    v.innerHTML = ps.join('');
    v.className = 'verdict ' + (R.passed && R.longEnough ? 'good' : 'warn');
    reveal();
    $('btnAgain').style.display = '';
    sync();
  }
  function reveal() {
    var d = day, R = run.rope, box = $('reveal');
    box.style.display = '';
    box.innerHTML = '<h5>What the three yarns really were, foot by foot</h5>' +
      '<p>Twist and thickness along each yarn against the sample, with the green band the finger’s breadth that passes for even, and below them the strength of the laid rope against what the machine asks. The dull ends are cut off before laying. Red marks are where a yarn parted and was pieced.</p>' +
      '<canvas class="trace" id="trace" width="640" height="400"></canvas>' +
      '<div class="key">' + run.yarns.map(function (y, i) { return '<span style="color:' + COLS[i] + '">■ Yarn ' + (i + 1) + '</span>'; }).join('') + '<span style="color:#ff8a7a">■ the rope’s weakest place</span></div>' +
      '<p>' + lesson() + '</p>';
    var g = $('trace').getContext('2d'), W = 640, L = d.L;
    var P = [{ y: 10, h: 110, lo: 0, hi: 2.2, key: 'T', name: 'TWIST (× SAMPLE)' }, { y: 140, h: 110, lo: 0, hi: 2.2, key: 'D', name: 'THICKNESS (× SAMPLE)' }, { y: 270, h: 110, lo: 0, hi: 1.25, key: 'R', name: 'ROPE STRENGTH' }];
    var X = function (ft) { return 40 + (W - 52) * ft / L; };
    g.font = '600 10px ui-monospace,Menlo,monospace';
    P.forEach(function (p) {
      var Y = function (v) { return p.y + p.h - (clamp(v, p.lo, p.hi) - p.lo) / (p.hi - p.lo) * p.h; };
      g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(40, p.y, W - 52, p.h);
      if (p.key !== 'R') { g.fillStyle = 'rgba(100,240,200,.12)'; g.fillRect(40, Y(1 + 0.12), W - 52, Y(1 - 0.12) - Y(1 + 0.12)); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(40, p.y, X(ENDS) - 40, p.h);
      g.fillStyle = '#8b97ab'; g.textAlign = 'left'; g.fillText(p.name, 44, p.y + 12);
      g.textAlign = 'right'; g.fillText(p.key === 'R' ? '1.0' : '×1', 36, Y(1) + 3); g.fillText('0', 36, Y(0) + 3);
      if (p.key === 'R') {
        g.strokeStyle = '#ff8a7a'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(40, Y(d.order.need)); g.lineTo(W - 12, Y(d.order.need)); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ff8a7a'; g.textAlign = 'left'; g.fillText('the machine asks ' + Math.round(d.order.need * 100), 44, Y(d.order.need) - 4);
        g.strokeStyle = '#e3c58f'; g.lineWidth = 1.6; g.beginPath();
        R.R.forEach(function (s, i) { var x = X(i + ENDS); if (i) g.lineTo(x, Y(s)); else g.moveTo(x, Y(s)); });
        g.stroke();
        g.fillStyle = '#ff8a7a'; g.beginPath(); g.arc(X(R.wAt), Y(R.weakest), 4, 0, 7); g.fill();
      } else {
        run.yarns.forEach(function (y, i) {
          g.strokeStyle = COLS[i]; g.globalAlpha = 0.85; g.lineWidth = 1.2; g.beginPath();
          var arr = p.key === 'T' ? y.T.map(function (t) { return t / d.Tt; }) : y.D;
          for (var k = 0; k < arr.length; k += 2) { var vv = (arr[k] + (arr[k + 1] !== undefined ? arr[k + 1] : arr[k])) / 2; if (k) g.lineTo(X(k), Y(vv)); else g.moveTo(X(k), Y(vv)); }
          g.stroke(); g.globalAlpha = 1;
          g.fillStyle = '#ff8a7a'; y.splice.forEach(function (s) { g.fillRect(X(s) - 1, p.y + p.h - 8, 2, 8); });
        });
      }
      g.lineWidth = 1;
    });
    g.fillStyle = '#8b97ab'; g.textAlign = 'center';
    for (var ft = 0; ft <= L; ft += 200) g.fillText(ft + ' ft', X(ft), 396);
  }
  function lesson() {
    var ys = run.yarns, d = day, R = run.rope;
    var br = ys.reduce(function (s, y) { return s + y.breaks; }, 0), lumps = ys.reduce(function (s, y) { return s + y.lumps; }, 0);
    var kinks = ys.reduce(function (s, y) { return s + y.kinks; }, 0), thin = ys.reduce(function (s, y) { return s + y.thin; }, 0);
    var short = ys.filter(function (y) { return y.why === 'hemp'; }).length;
    var out = [];
    if (br) out.push('The yarn parted ' + (br === 1 ? 'once' : NUMW[Math.min(10, br)] + ' times') + ': each time you were walking faster than ' + d.boy.name + ' was turning, and ' + d.hemp.name + ' will not hold together below about ' + Math.round(d.slip * 100) + ' parts in a hundred of the sample’s twist. A pieced place is the weakest foot in a yarn.');
    if (kinks) out.push('Where you stood still the wheel kept turning, and that foot of yarn took all the twist: hard, kinked, and weaker for it.');
    if (lumps) out.push('The fat places are where you let the hemp go faster than you were walking; a lump does not share the load with the yarns beside it.');
    if (thin) out.push('The thin places are where you walked on and forgot to let more hemp through.');
    if (short) out.push('Feeding fat used up the bundle before the end of the walk, and a rope can only be as long as its shortest yarn.');
    if (R.out > 0.15) out.push('The steps in the twist are where ' + d.boy.name + ' slowed or hurried and your walk did not follow him; every change in the wheel is written into the yarn for as long as it takes you to answer it.');
    if (!out.length) out.push('You kept your walk to the wheel and your hand to your walk the whole way down. That is the whole craft, and it took a spinner years.');
    if (!R.passed && R.weakest > 0) out.push('A rope is as strong as its worst few feet: the machine found the place at ' + R.wAt + ' ft and did not care how good the rest was.');
    return out.join(' ');
  }

  function setDay(off) {
    offset = off;
    day = makeDay(offset);
    run = newRun(day);
    layT = -1; flash = 0;
    $('msg').innerHTML = '';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none';
    $('btnAgain').style.display = 'none';
    $('btnLay').style.display = 'none';
    $('btnStart').textContent = 'Hook on the first yarn';
    $('btnStart').style.display = '';
    $('tools').style.display = 'none';
    $('walk').value = 0; $('feed').value = 0;
    plaque(); sync();
  }

  function nudge(id, by) { var el = $(id); el.value = clamp(+el.value + by, 0, 100); }
  function init() {
    cv = $('walkway'); ctx = cv.getContext('2d');
    $('btnStart').addEventListener('click', begin);
    $('btnCut').addEventListener('click', function () { if (run.cur && !run.cur.end) { run.cur.end = true; run.cur.why = 'cut'; endYarn(); } });
    $('btnLay').addEventListener('click', startLay);
    $('btnAgain').addEventListener('click', function () { setDay(offset); });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!run.cur || run.cur.end) return;
      var k = e.key;
      if (e.target && e.target.tagName === 'INPUT' && k.indexOf('Arrow') === 0) return; // a focused slider handles its own arrows
      if (k === 'ArrowRight' || k === 'd' || k === 'D') nudge('walk', 4);
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') nudge('walk', -4);
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') nudge('feed', 4);
      else if (k === 'ArrowDown' || k === 's' || k === 'S') nudge('feed', -4);
      else return;
      e.preventDefault();
    });
    $('btnDayPrev').addEventListener('click', function () { setDay(offset - 1); });
    $('btnDayToday').addEventListener('click', function () { setDay(0); });
    $('btnDayNext').addEventListener('click', function () { setDay(offset + 1); });
    setDay(0);
    requestAnimationFrame(loop);
  }

  window.DriftRopewalk = { makeDay: function (o) { return makeDay(o); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
