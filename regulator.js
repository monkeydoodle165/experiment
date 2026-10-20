/* drift.quibo.games — The Regulator
   A clockmaker's week with a longcase clock in a Georgian house. The day's number picks the town and a
   year between 1752 and 1829 (the calendar date is today's), the owner and what they want the clock for,
   the maker, the pendulum rod and the rating nut, how far the bob was knocked when the clock was moved,
   the weather at noon for eight days and the temperature of the house for the five weeks after.

   Nothing on the page tells you the clock's rate. Every noon that the sun shows, its image crosses a
   brass meridian line on the sill and you mark the moment each limb touches and leaves it; the mean is
   the clock's reading at apparent noon. The equation of time (computed for the date) turns that into
   the clock's error against local mean time. Between noons the clock runs at a rate set by the hidden
   position of the bob, the temperature of the rod and a little irregularity of its own. You may turn
   the rating nut and set the hands. A month after you leave, the owner writes to say how it went.

   The master's book is a fixed policy run on the same clock and the same weather with his own sights:
   least squares on the rate since his last turn of the nut, corrected for warmth, trimmed for the
   temperature the house will have while he is away, hands set on the last sunny noon.
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
    var h = s ^ 0x5be0cd19;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function sgn1(x) { return (x >= 0 ? '+' : '−') + f1(Math.abs(x)); }
  function fastSlow(e) {
    var a = Math.abs(e), s;
    if (a < 0.05) return 'right';
    if (a >= 60) { var m = Math.floor(a / 60); s = m + 'm ' + f1(a - m * 60) + 's'; } else s = f1(a) + 's';
    return s + (e > 0 ? ' fast' : ' slow');
  }
  function hms(t, tenths) {
    t = ((t % 86400) + 86400) % 86400;
    var h = Math.floor(t / 3600), m = Math.floor((t - h * 3600) / 60), s = t - h * 3600 - m * 60;
    var ss = tenths ? (s < 10 ? '0' : '') + s.toFixed(1) : (Math.floor(s) < 10 ? '0' : '') + Math.floor(s);
    if (tenths && ss === '60.0') ss = '59.9';
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
  }
  function eotMS(E) { var a = Math.abs(E), m = Math.floor(a / 60); return (E >= 0 ? '+' : '−') + m + 'm ' + f1(a - m * 60) + 's'; }

  /* ---------- sun: equation of time and declination for a day of the year ---------- */
  function dayOfYear(d) { var s = new Date(d.getFullYear(), 0, 1, 12); return Math.round((d - s) / 864e5) + 1; }
  function eqTime(N) { // apparent minus mean, seconds
    var B = 2 * Math.PI * (N - 81) / 364;
    return 60 * (9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B));
  }
  function decl(N) { return 23.44 * Math.sin(2 * Math.PI * (284 + N) / 365); }
  function houseTemp(N) { return 57 + 9 * Math.sin(2 * Math.PI * (N - 115) / 365); } // °F, unheated rooms of a stone house

  /* ---------- the day's house ---------- */
  var TREF = 60, VISIT = 8, AWAY = 30, CHECK = VISIT - 1 + AWAY; // owner's letter on day CHECK
  var TOWNS = ['Bristol', 'Norwich', 'York', 'Bath', 'Exeter', 'Lincoln', 'Shrewsbury', 'Chester', 'Lichfield', 'Derby', 'Salisbury', 'Ludlow', 'Durham', 'Kendal', 'Hereford', 'Canterbury', 'Warwick', 'Beverley', 'Stamford', 'Whitby'];
  var MAKERS = ['John Holmes', 'Thomas Mudge', 'John Whitehurst', 'Thomas Lister', 'Edward Pashley', 'Samuel Deacon', 'John Bonner', 'Jonas Barber', 'William Barker', 'James Wilson', 'Thomas Tompion (it says)', 'John Wyke'];
  var SURN = ['Ashby', 'Pell', 'Tolley', 'Marsh', 'Hobday', 'Venn', 'Crisp', 'Rudd', 'Fenn', 'Quilter', 'Larkin', 'Tebbutt', 'Spurling', 'Catchpole', 'Orme', 'Wesson', 'Hollis', 'Dunthorne', 'Peart', 'Goodricke'];
  var RODS = {
    steel: { name: 'a steel rod', k: 0.276, wob: 0.06, noise: 0.35, note: 'It gains about 0.28 s a day for every degree Fahrenheit colder.' },
    brass: { name: 'a brass rod', k: 0.45, wob: 0.08, noise: 0.35, note: 'It gains about 0.45 s a day for every degree Fahrenheit colder.' },
    deal: { name: 'a varnished deal rod', k: 0.095, wob: 0.03, noise: 0.8, note: 'Wood hardly minds the cold, about 0.1 s a day a degree, but it drinks the damp and wanders a little from day to day.' },
    grid: { name: 'a gridiron of brass and steel', k: 0.03, wob: 0.07, noise: 0.3, note: 'Harrison’s gridiron is meant to cancel the cold. The book calls it 0.03 s a day a degree, if the bars were cut right.' },
    merc: { name: 'Graham’s jar of mercury', k: 0.02, wob: 0.05, noise: 0.25, note: 'The mercury rises as the rod falls. The book calls it 0.02 s a day a degree, if the jar was filled right.' }
  };
  var OWNERS = [
    { who: 'the rector', tol: 90, rods: ['steel', 'brass', 'deal'],
      blurb: function (n, t) { return n + ', rector of St ' + pick(t, ['Mary’s', 'Michael’s', 'Peter’s', 'Helen’s', 'Martin’s']) + ', rings the bell for service by the hall clock, and the parish sets its watches by the bell. A minute wrong and he hears of it.'; } },
    { who: 'the banker', tol: 40, rods: ['steel', 'brass', 'grid'],
      blurb: function (n) { return n + ' keeps the bank. The doors open and the post goes by the clock in the counting room, and the bills fall due to the minute.'; } },
    { who: 'the innkeeper', tol: 60, rods: ['steel', 'deal', 'brass'],
      blurb: function (n, t) { return n + ' keeps ' + pick(t, ['the George', 'the Angel', 'the Bull', 'the White Hart', 'the Swan']) + ', where the mail coach changes horses. The guard’s timepiece is locked and checked against the clock in the yard, and the Post Office fines the house for every minute lost.'; } },
    { who: 'the gentleman astronomer', tol: 20, rods: ['grid', 'merc'],
      blurb: function (n) { return n + ' has a transit room at the top of the house and times Jupiter’s moons by the regulator in the hall. He means to send his observations to the Royal Society and wants the clock to hold its rate to seconds.'; } },
    { who: 'the chronometer dealer', tol: 25, rods: ['grid', 'merc', 'steel'],
      blurb: function (n) { return n + ' rates ships’ chronometers for the captains in the port, and every one is compared against this clock. An error here is carried out to sea.'; } }
  ];

  function build(date) {
    var r = rng(mix(seedForDate(date), 50)), D = { date: date };
    D.year = 1752 + Math.floor(r() * 78);
    D.town = pick(r, TOWNS);
    D.maker = pick(r, MAKERS);
    var O = pick(r, OWNERS); D.owner = O;
    D.ownerName = pick(r, ['Mr', 'Mr', 'Mrs', 'Dr', 'Mr']) + ' ' + pick(r, SURN);
    D.blurb = O.blurb(D.ownerName, r);
    D.rodKey = pick(r, O.rods); D.rod = RODS[D.rodKey];
    var kk = D.rod.k;
    D.kTrue = (D.rodKey === 'grid' || D.rodKey === 'merc') ? kk + (r() * 2 - 1) * D.rod.wob * 1.2 : kk * (0.85 + r() * 0.3);
    var pitch = pick(r, [[32, 20], [40, 20], [50, 30], [40, 30]]); // threads to the inch, divisions on the nut
    D.pitch = pitch;
    D.nutPer = 86400 * (25.4 / pitch[0] / pitch[1]) / (2 * 994); // s/day per division, nominal
    D.nutTrue = D.nutPer * (0.88 + r() * 0.24);
    D.base0 = (r() < 0.5 ? -1 : 1) * (10 + r() * 55);  // s/day at TREF, bob knocked in the move
    D.e0 = (r() < 0.5 ? -1 : 1) * (90 + r() * 1100);   // seconds wrong at the first noon
    // days: weather, temperature, the clock's own irregularity
    D.days = [];
    var N0 = dayOfYear(date), wave = r() * 6.28, sunP = 0.42 + 0.3 * Math.max(0, Math.sin(2 * Math.PI * (N0 - 80) / 365));
    for (var i = 0; i <= CHECK + 1; i++) {
      var d = new Date(D.year, date.getMonth(), date.getDate() + i, 12);
      var N = dayOfYear(d);
      D.days.push({
        d: d, N: N, E: eqTime(N), dec: decl(N),
        T: houseTemp(N) + 2.2 * Math.sin(wave + i * 0.9) + gauss(r) * 1.4,
        sun: i === 0 ? true : r() < sunP,
        noise: gauss(r) * D.rod.noise
      });
    }
    var sunny = 0; for (i = 1; i < VISIT; i++) if (D.days[i].sun) sunny++;
    for (i = 1; sunny < 3 && i < VISIT; i += 2) if (!D.days[i].sun) { D.days[i].sun = true; sunny++; }
    D.Tnow = houseTemp(N0); D.Taway = 0;
    for (i = VISIT; i < CHECK; i++) D.Taway += houseTemp(D.days[i].N);
    D.Taway /= (CHECK - VISIT);
    D.Tend = houseTemp(D.days[CHECK].N);
    D.obsSeed = mix(seedForDate(date), 5001);
    return D;
  }

  /* ---------- the clock itself ---------- */
  function rateOn(D, base, i) { var dd = D.days[i]; return base + D.kTrue * (TREF - dd.T) + dd.noise; }
  // run a policy's record (nut per day, hands shift per day) to the owner's letter
  function runTrue(D, nut, shift) {
    var err = [D.e0], base = D.base0;
    for (var i = 0; i < CHECK; i++) {
      var e = err[i] + (i < VISIT ? (shift[i] || 0) : 0);
      if (i < VISIT) base += (nut[i] || 0) * D.nutTrue;
      err.push(e + rateOn(D, base, i));
    }
    return { err: err, base: base };
  }

  /* ---------- the master's book ---------- */
  function master(D) {
    var r = rng(mix(D.obsSeed, 77)), sig = 1.8;
    var nut = [], shift = [], obs = [], err = D.e0, base = D.base0;
    var lastSun = 0; for (var j = 0; j < VISIT; j++) if (D.days[j].sun) lastSun = j;
    var pts = []; // since last turn: {i, e (book error after hands), T}
    var target = D.rod.k * (D.Taway - TREF);
    for (var i = 0; i < VISIT; i++) {
      nut[i] = 0; shift[i] = 0;
      var dd = D.days[i];
      if (dd.sun) {
        var o = err + gauss(r) * sig; obs[i] = o;
        pts.push({ i: i, e: o });
        if (pts.length >= 2) {
          // temperature-corrected rate at TREF by least squares on corrected errors
          var x = [], y = [], acc = 0;
          for (var p = 0; p < pts.length; p++) {
            if (p > 0) for (var q = pts[p - 1].i; q < pts[p].i; q++) acc -= D.rod.k * (TREF - D.days[q].T);
            x.push(pts[p].i); y.push(pts[p].e + acc);
          }
          var n = x.length, mx = 0, my = 0; for (p = 0; p < n; p++) { mx += x[p]; my += y[p]; } mx /= n; my /= n;
          var sxx = 0, sxy = 0; for (p = 0; p < n; p++) { sxx += (x[p] - mx) * (x[p] - mx); sxy += (x[p] - mx) * (y[p] - my); }
          var est = sxy / sxx, se = sig * Math.sqrt(2) / Math.max(1, Math.sqrt(sxx) * 1.2) + D.rod.noise / Math.sqrt(n);
          var want = target - est;
          if (Math.abs(want) > 2 * se && Math.abs(want) >= D.nutPer * 0.75) {
            nut[i] = Math.round(want / D.nutPer);
          }
        }
        if (i === 0 || i === lastSun || Math.abs(o) > 20) { shift[i] = -o; }
        if (nut[i] || shift[i]) pts = [{ i: i, e: o + shift[i] }];
      }
      err = err + shift[i]; base += nut[i] * D.nutTrue;
      err = err + rateOn(D, base, i);
    }
    var run = runTrue(D, nut, shift);
    return { nut: nut, shift: shift, obs: obs, run: run };
  }

  /* ---------- state ---------- */
  var D, M, dayOff = 0, day, err, base, book, pend, finished, obsR;
  var SPEED = 8, anim = null;
  function load() {
    D = build(dateFor(dayOff)); M = master(D);
    obsR = rng(mix(D.obsSeed, 13));
    day = 0; err = D.e0; base = D.base0; finished = false;
    book = []; pend = { nut: 0, hands: false };
    stopAnim();
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    say('');
    renderPlaque(); renderDay(); renderBook(); draw(null);
    var t = D.date;
    $('dayOut').textContent = (dayOff === 0 ? 'Today’s house, ' : '') + WEEKDAYS[t.getDay()] + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()] + ' ' + t.getFullYear();
  }
  function say(s) { $('msg').innerHTML = s; }

  function renderPlaque() {
    $('plWho').textContent = D.town + ', ' + D.days[0].d.getDate() + ' ' + MONTHS[D.days[0].d.getMonth()] + ' ' + D.year;
    $('plName').textContent = 'A longcase clock by ' + D.maker + ', for ' + D.ownerName;
    var cool = D.Tend < D.Tnow - 0.5 ? 'cool from about ' + Math.round(D.Tnow) + '°F to about ' + Math.round(D.Tend) + '°F'
      : D.Tend > D.Tnow + 0.5 ? 'warm from about ' + Math.round(D.Tnow) + '°F to about ' + Math.round(D.Tend) + '°F' : 'stay at about ' + Math.round(D.Tnow) + '°F';
    $('plBlurb').innerHTML = esc(D.blurb) + ' The clock came by cart from the old house, the bob has been knocked on its rod and nobody knows how it goes. You have <b>eight noons</b> in the house. Then you leave, and a month later the owner writes to say how far it has wandered: <b>' +
      (D.owner.tol === 60 ? 'a minute' : D.owner.tol === 90 ? 'a minute and a half' : D.owner.tol + ' seconds') + '</b> is all ' + esc(D.owner.who) + ' will forgive.' +
      '<br><br>The pendulum hangs from ' + esc(D.rod.name) + '. ' + esc(D.rod.note) + ' The house will ' + cool + ' over the month you are away (an average of ' + f1(D.Taway) + '°F).';
    $('rules').innerHTML = '<span><b>' + D.pitch[0] + '</b> threads to the inch on the rating nut</span><span><b>' + D.pitch[1] + '</b> divisions round it</span>' +
      '<span>one division ≈ <b>' + D.nutPer.toFixed(2) + ' s</b> a day</span><span>raise the bob: <b>gains</b></span><span>marks: <b>' + TREF + '°F</b> is the book’s standard</span>';
  }

  function renderDay() {
    var done = finished || day >= VISIT;
    var dd = D.days[Math.min(day, VISIT - 1)], b = book[day];
    $('dayHead').innerHTML = done ? 'You have gone home. The clock is the owner’s now.' :
      'Noon ' + (day + 1) + ' of ' + VISIT + ' · ' + WEEKDAYS[dd.d.getDay()] + ' ' + dd.d.getDate() + ' ' + MONTHS[dd.d.getMonth()] + ' ' + dd.d.getFullYear() +
      ' · thermometer <b>' + f1(dd.T) + '°F</b> · ' + (dd.sun ? 'the sun is out' : '<b>overcast, no sun at noon</b>');
    var haveObs = b && b.obs != null;
    $('btnWatch').disabled = done || !dd.sun || haveObs || !!anim;
    $('btnLimb').disabled = !anim || anim.marks.length >= 2;
    $('btnLimb').textContent = !anim ? 'Mark the limb' : anim.marks.length === 0 ? 'First limb touches the line' : 'Second limb leaves it';
    $('btnApp').disabled = done || !dd.sun || haveObs || !!anim;
    $('nutOut').innerHTML = done ? '—' : (pend.nut === 0 ? 'Leave the nut alone today' :
      (pend.nut > 0 ? 'Raise' : 'Lower') + ' the bob <b>' + Math.abs(pend.nut) + '</b> division' + (Math.abs(pend.nut) === 1 ? '' : 's') +
      ' (the book says it will ' + (pend.nut > 0 ? 'gain' : 'lose') + ' about ' + f1(Math.abs(pend.nut) * D.nutPer) + ' s a day more)');
    var nb = document.querySelectorAll('[data-nut]'); for (var i = 0; i < nb.length; i++) nb[i].disabled = done;
    $('btnHands').disabled = done || !haveObs;
    $('btnHands').textContent = pend.hands ? 'Hands will be set by today’s sight ✓' : 'Set the hands by today’s sight';
    $('btnHands').className = 'btn small ' + (pend.hands ? '' : 'ghost');
    $('btnNext').disabled = done || !!anim;
    $('btnNext').textContent = day === VISIT - 1 ? 'Wind it, pack the tools and leave it with the owner →' : 'Wind it and wait for tomorrow’s noon →';
  }

  /* ---------- the observation ---------- */
  function sdSec(dd) { return 16 * 60 / 15 / Math.cos(dd.dec * Math.PI / 180); } // semi-diameter in seconds of time
  function trueTransitClock(i) { return 43200 - D.days[i].E + err; }
  function watch() {
    var dd = D.days[day], sd = sdSec(dd), tc = trueTransitClock(day);
    anim = { tc: tc, sd: sd, t0: performance.now(), from: tc - sd - 28, to: tc + sd + 24, marks: [], jit: rng(mix(D.obsSeed, day * 31 + 7)) };
    say('Watch the bright spot on the sill. Mark the moment its leading edge touches the brass line, then the moment its trailing edge leaves it.');
    renderDay();
    tick();
  }
  function gameT() { return anim.from + (performance.now() - anim.t0) / 1000 * SPEED; }
  function tick() {
    if (!anim) return;
    var g = gameT();
    draw(g);
    if (g > anim.to) {
      var a = anim; stopAnim();
      if (a.marks.length < 2) say('The sun has gone over the line. Today’s sight is lost, unless you let the apprentice say what he saw.');
      renderDay(); return;
    }
    anim.raf = requestAnimationFrame(tick);
  }
  function stopAnim() { if (anim && anim.raf) cancelAnimationFrame(anim.raf); anim = null; }
  function mark() {
    if (!anim || anim.marks.length >= 2) return;
    anim.marks.push(gameT());
    if (anim.marks.length === 2) {
      var m = (anim.marks[0] + anim.marks[1]) / 2;
      var wid = anim.marks[1] - anim.marks[0];
      record(m, 'you: limbs at ' + hms(anim.marks[0], true) + ' and ' + hms(anim.marks[1], true));
      if (Math.abs(wid - 2 * anim.sd) > 12) say(document.getElementById('msg').innerHTML + ' The two limbs were ' + f1(wid) + ' s apart; the sun’s disc should take ' + f1(2 * anim.sd) + ' s, so one of the marks was early or late.');
      var a = anim; stopAnim(); draw(a.marks[1]);
    }
    renderDay();
  }
  function apprentice() {
    var dd = D.days[day];
    var m = trueTransitClock(day) + gauss(obsR) * 3.2;
    record(m, 'the apprentice');
    renderDay(); draw(null);
  }
  function record(clockAt, by) {
    var dd = D.days[day], meanAt = 43200 - dd.E, e = clockAt - meanAt;
    book[day] = book[day] || {};
    var b = book[day];
    b.obs = clockAt; b.err = e; b.by = by;
    // rate since the last sight, with the book's knowledge of hands set and nut turned
    var j = day - 1; while (j >= 0 && !(book[j] && book[j].obs != null)) j--;
    if (j >= 0) {
      var pj = book[j], after = pj.err + (pj.shift || 0), tc = 0, turned = false;
      for (var q = j; q < day; q++) { tc += D.rod.k * (TREF - D.days[q].T); if (book[q] && book[q].nut) turned = true; }
      b.rate = (e - after) / (day - j);
      b.rateRef = (e - after - tc) / (day - j);
      b.turned = turned;
    }
    say('Apparent noon by ' + by + '. The clock read <b>' + hms(clockAt, true) + '</b>. Today the sun is ' + eotMS(Math.abs(dd.E)).slice(1) + (dd.E >= 0 ? ' ahead of' : ' behind') + ' the mean sun, so mean time at apparent noon was ' + hms(meanAt, true) +
      ' and the clock is <b>' + fastSlow(e) + '</b>.' + (b.rate != null ? ' Since the last sight it has gone at <b>' + sgn1(b.rate) + ' s a day</b>' +
      (b.turned ? ' (the nut was turned in between, so that is a mixture)' : '') + '; allowing for the warmth, at ' + TREF + '°F that is ' + sgn1(b.rateRef) + ' s a day.' : ''));
    renderBook();
  }

  function nextDay() {
    if (finished || anim) return;
    book[day] = book[day] || {};
    var b = book[day];
    b.nut = pend.nut; b.shift = (pend.hands && b.obs != null) ? -b.err : 0;
    err += b.shift; base += pend.nut * D.nutTrue;
    err += rateOn(D, base, day);
    pend = { nut: 0, hands: false };
    day++;
    say(day < VISIT ? '' : '');
    if (day >= VISIT) { finish(); return; }
    renderDay(); renderBook(); draw(null);
  }

  /* ---------- the book ---------- */
  function renderBook() {
    var h = '<tr><th>Noon</th><th>Date</th><th>°F</th><th>Clock at app. noon</th><th>Eq. of time</th><th>Clock</th><th>Rate s/day</th><th>At ' + TREF + '°F</th><th>Nut</th><th>Hands</th></tr>';
    for (var i = 0; i < VISIT; i++) {
      var dd = D.days[i], b = book[i] || {};
      if (i > day && !finished) break;
      var tol = D.owner.tol;
      h += '<tr><td>' + (i + 1) + '</td><td>' + dd.d.getDate() + ' ' + MONTHS[dd.d.getMonth()].slice(0, 3) + '</td><td>' + f1(dd.T) + '</td>' +
        '<td>' + (b.obs != null ? hms(b.obs, true) : dd.sun ? (i === day && !finished ? '…' : 'not taken') : 'overcast') + '</td>' +
        '<td>' + eotMS(dd.E) + '</td>' +
        '<td' + (b.err != null ? ' class="' + (Math.abs(b.err) <= tol ? 'ok' : 'bad') + '"' : '') + '>' + (b.err != null ? fastSlow(b.err) : '—') + '</td>' +
        '<td>' + (b.rate != null ? sgn1(b.rate) + (b.turned ? '*' : '') : '—') + '</td>' +
        '<td>' + (b.rateRef != null ? sgn1(b.rateRef) + (b.turned ? '*' : '') : '—') + '</td>' +
        '<td>' + (b.nut ? (b.nut > 0 ? '+' : '−') + Math.abs(b.nut) : (i === day && pend.nut && !finished ? '(' + (pend.nut > 0 ? '+' : '−') + Math.abs(pend.nut) + ')' : '')) + '</td>' +
        '<td>' + (b.shift ? 'set' : (i === day && pend.hands && !finished ? '(set)' : '')) + '</td></tr>';
    }
    $('book').innerHTML = h;
    plotBook();
  }
  function plotBook() {
    var W = 640, H = 170, L = 52, R = 14, T = 14, B = 26;
    var pts = [];
    for (var i = 0; i < VISIT; i++) { var b = book[i]; if (b && b.obs != null) pts.push({ i: i, e: b.err, a: b.err + (b.shift || 0) }); }
    var lim = 10; pts.forEach(function (p) { lim = Math.max(lim, Math.abs(p.e) * 1.15); });
    lim = Math.min(lim, 1500);
    function X(i) { return L + (W - L - R) * i / (VISIT - 1); }
    function Y(e) { e = Math.max(-lim, Math.min(lim, e)); return T + (H - T - B) * (1 - (e + lim) / (2 * lim)); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="The book plotted: the clock\'s error at each sight">';
    s += '<rect x="' + L + '" y="' + Y(D.owner.tol) + '" width="' + (W - L - R) + '" height="' + (Y(-D.owner.tol) - Y(D.owner.tol)) + '" fill="rgba(100,240,200,.07)"/>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#2a3342"/>';
    s += '<text x="' + (L - 6) + '" y="' + (T + 8) + '" text-anchor="end">+' + Math.round(lim) + 's</text><text x="' + (L - 6) + '" y="' + (H - B) + '" text-anchor="end">−' + Math.round(lim) + 's</text><text x="' + (L - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text>';
    for (i = 0; i < VISIT; i++) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + (i + 1) + '</text>';
    var prev = null;
    pts.forEach(function (p) {
      if (prev) s += '<line x1="' + X(prev.i) + '" y1="' + Y(prev.a) + '" x2="' + X(p.i) + '" y2="' + Y(p.e) + '" stroke="#7aa2ff" stroke-width="1.6"/>';
      if (p.a !== p.e) s += '<line x1="' + X(p.i) + '" y1="' + Y(p.e) + '" x2="' + X(p.i) + '" y2="' + Y(p.a) + '" stroke="#ffce6a" stroke-dasharray="3 3"/>';
      s += '<circle cx="' + X(p.i) + '" cy="' + Y(p.e) + '" r="4" fill="#64f0c8"/>';
      prev = p;
    });
    s += '<text x="' + (W - R) + '" y="' + (T + 8) + '" text-anchor="end">fast ↑ · slow ↓ · shaded: what the owner will forgive</text></svg>';
    $('plot').innerHTML = s;
  }

  /* ---------- the canvas: dial, pendulum, sill and meridian line ---------- */
  function draw(g) {
    var c = $('sky'), ctx = c.getContext('2d');
    var dpr = window.devicePixelRatio || 1, cw = c.clientWidth || 720, chh = Math.round(cw * 0.38);
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(chh * dpr); }
    ctx.setTransform(c.width / 720, 0, 0, c.height / 274, 0, 0);
    var W = 720, H = 274;
    ctx.fillStyle = '#0e131b'; ctx.fillRect(0, 0, W, H);
    var dd = D.days[Math.min(day, VISIT - 1)], done = finished || day >= VISIT;
    var clockT = g != null ? g : (book[day] && book[day].obs != null && !done ? book[day].obs : 43200 - dd.E + err - 75);
    // the hood and dial
    var cx = 128, cy = 104, R = 76;
    ctx.fillStyle = '#2b1d14'; roundRect(ctx, cx - R - 18, cy - R - 22, 2 * R + 36, 2 * R + 40, 10); ctx.fill();
    ctx.fillStyle = '#e9e0c9'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#3a2d20'; ctx.lineWidth = 1;
    for (var i = 0; i < 60; i++) {
      var a = i / 60 * 6.2832, r1 = i % 5 ? R - 7 : R - 12;
      ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); ctx.lineTo(cx + Math.sin(a) * (R - 3), cy - Math.cos(a) * (R - 3)); ctx.lineWidth = i % 5 ? 1 : 2.2; ctx.stroke();
    }
    ctx.fillStyle = '#3a2d20'; ctx.font = '600 12px Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var RN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (i = 0; i < 12; i++) { var a2 = i / 12 * 6.2832; ctx.fillText(RN[i], cx + Math.sin(a2) * (R - 23), cy - Math.cos(a2) * (R - 23)); }
    var tt = ((clockT % 43200) + 43200) % 43200, sec = Math.floor(tt % 60);
    hand(ctx, cx, cy, tt / 43200 * 6.2832, R * 0.5, 4, '#1a120c');
    hand(ctx, cx, cy, (tt % 3600) / 3600 * 6.2832, R * 0.78, 2.6, '#1a120c');
    hand(ctx, cx, cy, sec / 60 * 6.2832, R * 0.86, 1.2, '#9b2b1e');
    ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.2832); ctx.fill();
    // pendulum through the trunk door
    var swing = Math.sin(Math.PI * (clockT % 2)) * 0.07;
    ctx.fillStyle = '#1c140e'; roundRect(ctx, cx - 34, cy + R + 22, 68, H - (cy + R + 22) - 26, 6); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(cx - 34, cy + R + 22, 68, H - (cy + R + 22) - 26); ctx.clip();
    var px = cx, py = cy + R + 4, Lp = 150;
    ctx.strokeStyle = '#a7a9ad'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(swing) * Lp, py + Math.cos(swing) * Lp); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#8b97ab'; ctx.font = '11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('the clock reads ' + hms(clockT, false), cx, H - 6);
    // the sill
    var sx = 280, sw = W - sx - 16, sy = 22, sh = H - 44;
    var grd = ctx.createLinearGradient(sx, 0, sx + sw, 0); grd.addColorStop(0, '#3b2a1d'); grd.addColorStop(1, '#4a3524');
    ctx.fillStyle = grd; roundRect(ctx, sx, sy, sw, sh, 8); ctx.fill();
    ctx.save(); ctx.beginPath(); roundRect(ctx, sx, sy, sw, sh, 8); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(sx, sy + 12 + i * 26 + Math.sin(i) * 4); ctx.bezierCurveTo(sx + sw * .3, sy + 6 + i * 26, sx + sw * .6, sy + 20 + i * 26, sx + sw, sy + 10 + i * 26); ctx.stroke(); }
    var lx = sx + sw / 2;
    // sun image
    var sunVisible = !done && dd.sun, Rs = 46, centreX;
    if (sunVisible) {
      var at = g != null ? g : (book[day] && book[day].obs != null ? trueTransitClock(day) + 30 : trueTransitClock(day) - 75);
      var sd = sdSec(dd);
      centreX = lx + (at - trueTransitClock(day)) / sd * Rs;
      var jx = anim ? (anim.jit() - 0.5) * 1.6 : 0, jy = anim ? (anim.jit() - 0.5) * 1.2 : 0;
      var cy2 = sy + sh / 2 + jy;
      var halo = ctx.createRadialGradient(centreX + jx, cy2, Rs * 0.6, centreX + jx, cy2, Rs * 2.2);
      halo.addColorStop(0, 'rgba(255,214,140,.22)'); halo.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = halo; ctx.fillRect(sx, sy, sw, sh);
      var sg = ctx.createRadialGradient(centreX + jx, cy2, 0, centreX + jx, cy2, Rs);
      sg.addColorStop(0, '#fff8e2'); sg.addColorStop(0.7, '#ffe6a8'); sg.addColorStop(1, '#f2b766');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(centreX + jx, cy2, Rs, Rs * 0.98, 0, 0, 6.2832); ctx.fill();
    } else if (!done) {
      ctx.fillStyle = 'rgba(160,170,185,.08)'; ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.restore();
    // brass line
    ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(lx, sy + 4); ctx.lineTo(lx, sy + sh - 4); ctx.stroke();
    ctx.fillStyle = '#8b97ab'; ctx.font = '11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
    ctx.fillText(done ? 'the noon line, for the owner now' : dd.sun ? 'the meridian line on the south sill, through a hole in the shutter' : 'overcast: no image on the line today', sx + sw / 2, H - 6);
    if (anim) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#64f0c8';
      ctx.fillText('marks: ' + (anim.marks.length ? anim.marks.map(function (m) { return hms(m, true); }).join(' · ') : 'none yet') + '   (time runs ' + SPEED + '× fast)', sx + 10, sy + 16);
    }
  }
  function hand(ctx, x, y, a, len, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * len * 0.15, y + Math.cos(a) * len * 0.15); ctx.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); ctx.stroke(); }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /* ---------- the owner's letter ---------- */
  function finish(given) {
    finished = true; stopAnim();
    var nut = [], shift = [];
    for (var i = 0; i < VISIT; i++) { var b = book[i] || {}; nut[i] = b.nut || 0; shift[i] = b.shift || 0; }
    var Y = runTrue(D, nut, shift), mr = M.run;
    var e = Y.err[CHECK], me = mr.err[CHECK], tol = D.owner.tol, good = Math.abs(e) <= tol;
    var last = D.days[CHECK].d;
    // decomposition of the month away
    var sumT = 0, sumN = 0;
    for (i = VISIT; i < CHECK; i++) { sumT += D.kTrue * (TREF - D.days[i].T); sumN += D.days[i].noise; }
    var atLeave = Y.err[VISIT], fromRate = Y.base * (CHECK - VISIT), lastDayRate = Y.err[VISIT] - Y.err[VISIT - 1];
    var v = $('verdict');
    v.className = 'verdict ' + (good ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + esc(D.ownerName) + ' writes, ' + last.getDate() + ' ' + MONTHS[last.getMonth()] + ' ' + last.getFullYear() + ':</b> “' +
      (good ? (Math.abs(e) < tol / 3 ? 'The clock agrees with the noon line to a hair. I have recommended you to everyone.' : 'The clock has kept good time. It is ' + fastSlow(e) + ' by the noon line, and I am content.')
        : (Math.abs(e) < tol * 3 ? 'The clock is ' + fastSlow(e) + ' by the noon line. It is not what I was promised.' : 'The clock is ' + fastSlow(e) + '. I have had to send for another man.')) + '”</p>' +
      '<p>A month after you left it was <b>' + fastSlow(e) + '</b>; ' + esc(D.owner.who) + ' forgives ' + tol + ' s. The master, with the same clock and the same weather, left it <b>' + fastSlow(me) + '</b>' + (Math.abs(me) <= tol ? '.' : ', which would not have pleased the owner either.') + '</p>';
    // reveal
    var rv = $('reveal'); rv.style.display = '';
    var h = '<h5>What the clock was really doing</h5>';
    h += '<p>The move had knocked the bob so that at ' + TREF + '°F the clock went <b>' + sgn1(D.base0) + ' s a day</b>, and it was <b>' + fastSlow(D.e0) + '</b> at the first noon. You left it going <b>' + sgn1(Y.base) + ' s a day at ' + TREF + '°F</b>; the master left it at ' + sgn1(mr.base) + '. ' +
      'One division of the nut really moved it ' + D.nutTrue.toFixed(2) + ' s a day, where the book says ' + D.nutPer.toFixed(2) + ', and the rod really answered ' + D.kTrue.toFixed(3) + ' s a day to the degree, where the book says ' + D.rod.k.toFixed(3) + '.</p>';
    h += '<p>The month away, piece by piece: it was <b>' + fastSlow(atLeave) + '</b> the noon after you left; the rate you left at ' + TREF + '°F added <b>' + sgn1(fromRate) + ' s</b> over ' + (CHECK - VISIT) + ' days; the house at an average of ' + f1(D.Taway) + '°F added <b>' + sgn1(sumT) + ' s</b>; and the clock’s own irregularity <b>' + sgn1(sumN) + ' s</b>.</p>';
    h += '<h5>The visit and the month after</h5>' + chart(Y.err, mr.err);
    h += '<h5>The master’s book</h5><div class="tablewrap"><table><tr><th>Noon</th><th>°F</th><th>Sight</th><th>Nut</th><th>Hands</th></tr>';
    for (i = 0; i < VISIT; i++) {
      h += '<tr><td>' + (i + 1) + '</td><td>' + f1(D.days[i].T) + '</td><td>' + (M.obs[i] != null ? fastSlow(M.obs[i]) : 'overcast') + '</td><td>' + (M.nut[i] ? (M.nut[i] > 0 ? '+' : '−') + Math.abs(M.nut[i]) : '') + '</td><td>' + (M.shift[i] ? 'set' : '') + '</td></tr>';
    }
    h += '</table></div><p>The master takes his own sights (a little steadier than the apprentice’s), works the rate at ' + TREF + '°F by least squares over every sight since he last touched the nut, turns it only when the rate is clearly not what he wants, and wants not zero but the rate that will come out even at the temperature the house will have while he is away. He sets the hands on the last sunny noon.</p>';
    rv.innerHTML = h;
    say(given ? 'The master has kept the week for you.' : '');
    renderDay(); renderBook(); draw(null);
  }
  function chart(ye, me) {
    var W = 680, H = 230, L = 52, R = 14, T = 16, B = 28, n = CHECK;
    var lim = D.owner.tol * 1.6;
    for (var i = 1; i <= n; i++) { lim = Math.max(lim, Math.abs(ye[i]) * 1.1, Math.abs(me[i]) * 1.1); }
    lim = Math.min(lim, 1800);
    function X(i) { return L + (W - L - R) * i / n; }
    function Yy(e) { e = Math.max(-lim, Math.min(lim, e)); return T + (H - T - B) * (1 - (e + lim) / (2 * lim)); }
    var s = '<svg class="bars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="The clock\'s true error, yours and the master\'s, through the visit and the month after">';
    s += '<rect x="' + X(VISIT - 0.5) + '" y="' + T + '" width="' + (X(n) - X(VISIT - 0.5)) + '" height="' + (H - T - B) + '" fill="rgba(122,162,255,.05)"/>';
    s += '<rect x="' + L + '" y="' + Yy(D.owner.tol) + '" width="' + (W - L - R) + '" height="' + (Yy(-D.owner.tol) - Yy(D.owner.tol)) + '" fill="rgba(100,240,200,.07)"/>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Yy(0) + '" y2="' + Yy(0) + '" stroke="#2a3342"/>';
    s += '<text x="' + (L - 6) + '" y="' + (T + 8) + '" text-anchor="end">+' + Math.round(lim) + 's</text><text x="' + (L - 6) + '" y="' + (H - B) + '" text-anchor="end">−' + Math.round(lim) + 's</text>';
    s += '<text x="' + X(VISIT / 2) + '" y="' + (H - 8) + '" text-anchor="middle">your eight noons</text><text x="' + X((VISIT + n) / 2) + '" y="' + (H - 8) + '" text-anchor="middle">the month away</text>';
    function path(arr, col, dash) {
      var d = '';
      for (var i = 0; i <= n; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Yy(arr[i]).toFixed(1);
      return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    }
    s += path(me, '#ffce6a', true) + path(ye, '#64f0c8', false);
    for (i = 0; i < VISIT; i++) { var b = book[i]; if (b && b.obs != null) s += '<circle cx="' + X(i) + '" cy="' + Yy(b.err) + '" r="3.5" fill="none" stroke="#e8edf5"/>'; }
    s += '<text x="' + (W - R) + '" y="' + (T + 10) + '" text-anchor="end"><tspan fill="#64f0c8">— yours</tspan>  <tspan fill="#ffce6a">- - the master’s</tspan>  ○ your sights</text></svg>';
    return s;
  }

  /* ---------- wiring ---------- */
  $('btnWatch').addEventListener('click', watch);
  $('btnLimb').addEventListener('click', mark);
  $('btnApp').addEventListener('click', apprentice);
  document.querySelector('.nutrow').addEventListener('click', function (e) {
    var b = e.target.closest('[data-nut]'); if (!b || finished) return;
    var v = +b.getAttribute('data-nut');
    if (v === 0) pend.nut = 0; else pend.nut = Math.max(-60, Math.min(60, pend.nut + v));
    renderDay(); renderBook();
  });
  $('btnHands').addEventListener('click', function () { if (finished) return; pend.hands = !pend.hands; renderDay(); renderBook(); });
  $('btnNext').addEventListener('click', nextDay);
  $('btnReset').addEventListener('click', load);
  $('btnGive').addEventListener('click', function () {
    if (finished) return;
    // replay the master's week into the book so it can be read
    stopAnim();
    day = 0; err = D.e0; base = D.base0; book = [];
    for (var i = 0; i < VISIT; i++) {
      if (M.obs[i] != null) { record(43200 - D.days[i].E + M.obs[i], 'the master'); }
      book[i] = book[i] || {};
      book[i].nut = M.nut[i]; book[i].shift = M.shift[i];
      err += M.shift[i]; base += M.nut[i] * D.nutTrue; err += rateOn(D, base, i); day++;
    }
    finish(true);
  });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (anim && tag !== 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); mark(); return; }
    if (anim) return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
  });
  window.addEventListener('resize', function () { if (!anim) draw(null); });

  load();
})();
