/* drift.quibo.games — The Ferry
   A morning's ferrying across a tidal river between 1800 and 1879. The day's number picks the river and its two
   stairs, the year, the boat, the fare, the time of high water and whether it is springs or neaps, the wind, the run
   of passengers down to each stair and the vessels working up and down on the tide.

   The model. The river runs left to right towards the sea on the ebb and right to left on the flood:
       stream(y, t) = Umax * sin(2 pi (t - high water) / 12.42 h) * profile(y)
   where profile is 1 over the deep channel and falls to nothing at each bank. The boat moves through the water at
   a speed that follows your pull after a few seconds, slowed by its load, by tired arms and by a chop when the wind
   is against the tide. Its track over the ground is its own velocity plus the stream plus a little leeway from the
   wind. Land at a stair to set your passengers down and take up whoever is waiting. Self-contained. */
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
    var h = s ^ 0x5a1b7e29;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* money in pence, halfpennies allowed */
  function money(d) {
    var neg = d < 0;
    d = Math.round(Math.abs(d) * 2) / 2;
    var l = Math.floor(d / 240), s = Math.floor((d % 240) / 12), p = d % 12;
    var out = [];
    if (l) out.push('£' + l);
    if (s) out.push(s + 's');
    if (p || !out.length) {
      var whole = Math.floor(p), half = p - whole > 0.25;
      out.push((whole ? whole : '') + (half ? '½' : '') + (whole || half ? 'd' : '0d'));
    }
    return (neg ? 'minus ' : '') + out.join(' ');
  }
  function clock(t) {
    var m = Math.floor(t / 60), h = Math.floor(m / 60) % 24, mm = m % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (mm < 10 ? '0' : '') + mm + (h < 12 ? ' am' : ' pm');
  }
  function knots(u) { return (Math.abs(u) * 1.944).toFixed(1) + ' kn'; }
  function yards(m) { return Math.round(m * 1.094) + ' yd'; }
  var PULLS = [0, 0.55, 0.8, 1.0];
  var PULLNAME = ['oars shipped', 'easy', 'steady', 'hard'];
  var TIDE = 44712;      // seconds in a tidal cycle
  var SPEED = 12;        // seconds of the morning per real second
  var SHIFT = 90 * 60;   // the morning's ferrying
  var STAIR = 13;        // half the width of a stair, in metres

  /* ---------- the world ---------- */
  /* W: width in metres. U: strength of a spring tide over the channel, m/s. sea: which way the sea lies. */
  var PLACES = [
    { river: 'the Thames', a: 'Wapping Old Stairs', b: 'Church Stairs, Rotherhithe', W: 270, U: 1.3, sea: 'Gravesend', alt: 'walked round by London Bridge', busy: 1.6 },
    { river: 'the Dart', a: 'Dartmouth', b: 'Kingswear', W: 300, U: 1.0, sea: 'the castle', alt: 'went off to wait for the horse ferry', busy: 1.0 },
    { river: 'the Fowey', a: 'Fowey', b: 'Polruan', W: 250, U: 0.9, sea: 'the harbour mouth', alt: 'went off to find another boat', busy: 0.9 },
    { river: 'the Tamar', a: 'Saltash Passage', b: 'Saltash', W: 320, U: 1.4, sea: 'the Hamoaze', alt: 'went round by the boat at Torpoint', busy: 1.1 },
    { river: 'the Tyne', a: 'North Shields', b: 'South Shields', W: 340, U: 0.9, sea: 'Tynemouth bar', alt: 'took a sculler from the next stair', busy: 1.5 },
    { river: 'the Wear', a: 'the Bodlewell stair, Sunderland', b: 'Monkwearmouth', W: 200, U: 0.8, sea: 'the piers', alt: 'walked up to the iron bridge', busy: 1.3 },
    { river: 'the Deben', a: 'Felixstowe Ferry', b: 'Bawdsey', W: 210, U: 1.6, sea: 'the bar', alt: 'went back to the inn', busy: 0.6 },
    { river: 'the Hamble', a: 'Hamble', b: 'Warsash', W: 240, U: 0.9, sea: 'Southampton Water', alt: 'went round by Bursledon bridge', busy: 0.7 },
    { river: 'the Helford', a: 'Helford Passage', b: 'Helford', W: 300, U: 0.8, sea: 'the Manacles', alt: 'went back up the hill', busy: 0.5 },
    { river: 'the Medway', a: 'Upnor', b: 'Chatham Dockyard', W: 290, U: 1.1, sea: 'Sheerness', alt: 'walked round by Rochester bridge', busy: 1.2 },
    { river: 'the Itchen', a: 'Itchen Ferry village', b: 'Southampton', W: 260, U: 0.8, sea: 'Southampton Water', alt: 'went up to Northam bridge', busy: 1.2 },
    { river: 'the Orwell', a: 'Harwich', b: 'Shotley', W: 330, U: 1.2, sea: 'Landguard', alt: 'went to wait for the packet', busy: 0.7 }
  ];
  var BOATS = [
    { name: 'a sculler’s skiff', text: 'a light skiff you scull alone', cap: 4, v: 2.0, tire: 1.0 },
    { name: 'a pair-oared wherry', text: 'a long wherry with your boy at the bow oar', cap: 7, v: 2.1, tire: 0.85 },
    { name: 'the old ferry boat', text: 'a broad old ferry boat that rows like a barn door', cap: 10, v: 1.75, tire: 1.15 }
  ];
  var VESSELS = [
    { name: 'a sailing barge', sail: '#a4553a', len: 26, beam: 6, sp: 1.0 },
    { name: 'a collier brig', sail: '#d9cfb4', len: 32, beam: 8, sp: 1.2 },
    { name: 'a ketch', sail: '#b9a179', len: 22, beam: 6, sp: 1.3 },
    { name: 'a lighter on the tide', sail: null, len: 20, beam: 6, sp: 0.2 }
  ];

  function makeDay(off) {
    var d = dateFor(off);
    var r = rng(seedForDate(d) ^ 0x3f1e77a5);
    var place = PLACES[Math.floor(r() * PLACES.length)];
    var year = 1800 + Math.floor(r() * 80);
    var hd = new Date(year, d.getMonth(), d.getDate(), 12);
    var boat = BOATS[Math.floor(r() * BOATS.length)];
    var fare = pick(r, [0.5, 1, 1, 1, 2]);
    var spring = r();
    var Umax = Math.min(place.U * (0.55 + 0.5 * spring), 1.45);
    var start = (6.5 + r() * 2.5) * 3600;
    start = Math.round(start / 300) * 300;
    var tHW = start - 4 * 3600 + r() * 8 * 3600;
    var wx = (r() * 2 - 1) * (r() < 0.3 ? 9 : 5);   // m/s, positive blows down river towards the sea
    var chan = 0.5 + (r() * 2 - 1) * 0.17;           // where the deep channel lies across the river
    var offB = (r() * 2 - 1) * place.W * 0.35;       // how far along the far stair lies from the near one
    var market = WEEKDAYS[hd.getDay()] === pick(r, ['Saturday', 'Wednesday', 'Friday']) || r() < 0.2;
    var rate = (0.22 + r() * 0.3) * Math.min(place.busy, 1.3) * (market ? 1.4 : 1);
    var bias = 0.35 + r() * 0.3;
    var rent = Math.round((5 + r() * 9) * place.busy * 2) / 2;

    // passengers: a list of arrivals at each stair, fixed for the day
    var arr = [], t = start - 240;
    while (t < start + SHIFT - 60) {
      t += -Math.log(1 - r()) * 60 / rate;
      if (t >= start + SHIFT - 60) break;
      var n = r() < 0.18 ? 2 + Math.floor(r() * 3) : 1;
      var side = r() < bias ? 1 : 0;
      for (var i = 0; i < n; i++) arr.push({ t: Math.max(start - 240, t), side: side, pat: (10 + r() * 22) * 60 });
    }
    // vessels on the tide
    var ships = [], ts = start - 400;
    var halfX = 320 / (300 / place.W);
    while (ts < start + SHIFT + 900) {
      ts += 260 + r() * 520 / place.busy;
      var U0 = Umax * Math.sin(2 * Math.PI * (ts - tHW) / TIDE);
      var tug = year >= 1835 && r() < 0.28;
      var k = tug ? null : VESSELS[Math.floor(r() * VESSELS.length)];
      var dir = tug ? (r() < 0.5 ? 1 : -1) : (Math.abs(U0) > 0.2 ? (U0 > 0 ? 1 : -1) : (r() < 0.5 ? 1 : -1));
      var len = tug ? 18 + r() * 6 : k.len * (0.85 + r() * 0.3);
      var sp = tug ? 2.4 + r() * 1.2 : Math.max(0.5, Math.abs(U0) * 0.9 + k.sp * (0.6 + r() * 0.8));
      ships.push({
        t0: ts, dir: dir, sp: sp, len: len, beam: tug ? 5 : k.beam, name: tug ? 'a steam tug' : k.name,
        sail: tug ? null : k.sail, tug: tug, y: place.W * (0.22 + r() * 0.56), x0: -dir * (halfX + len)
      });
    }
    var init = [Math.floor(r() * 3) + 1, Math.floor(r() * 3)];
    return {
      off: off, place: place, year: year, date: hd, wd: WEEKDAYS[hd.getDay()],
      dateText: hd.getDate() + ' ' + MONTHS[hd.getMonth()], boat: boat, fare: fare, spring: spring, Umax: Umax,
      start: start, end: start + SHIFT, tHW: tHW, wx: wx, chan: chan, offB: offB, market: market, rate: rate,
      rent: rent, arr: arr, ships: ships, init: init, W: place.W
    };
  }

  function tideU(day, t) { return day.Umax * Math.sin(2 * Math.PI * (t - day.tHW) / TIDE); }
  function profile(day, y) {
    var f = y / day.W, c = day.chan;
    var q = f < c ? (f - c) / c : (f - c) / (1 - c);
    return Math.pow(Math.max(0, 1 - q * q), 0.55);
  }
  function chop(day, t) {
    var U = tideU(day, t);
    if (U * day.wx >= 0) return 0;
    return clamp(Math.abs(day.wx) * Math.abs(U) / 6, 0, 1);
  }
  function tideText(U) {
    if (Math.abs(U) < 0.12) return 'slack';
    return (U > 0 ? 'ebb ' : 'flood ') + knots(U);
  }
  function windText(day) {
    var w = Math.abs(day.wx);
    var f = w < 1 ? 'calm' : w < 3 ? 'light airs' : w < 5.5 ? 'a breeze' : w < 8 ? 'fresh' : 'strong';
    if (w < 1) return f;
    return f + (day.wx > 0 ? ' down river' : ' up river');
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var day, S, dayOff = 0;
  var canvas = $('river'), ctx = canvas.getContext('2d');
  var CW = 640, CH = 400, TOP = 52, BOT = 348;
  var K = 1, HALFX = 300;
  function px(x) { return CW / 2 + x * K; }
  function py(y) { return BOT - y * K; }
  function stairX(side) { return side === 0 ? 0 : day.offB; }
  function sideName(side) { return side === 0 ? day.place.a : day.place.b; }
  function say(html) { $('msg').innerHTML = html; }

  var streaks = (function () {
    var r = rng(1834), a = [];
    for (var i = 0; i < 150; i++) a.push({ x: r() * 2 - 1, y: r(), l: 0.5 + r() * 0.8 });
    return a;
  })();

  function loadDay(off) {
    dayOff = off;
    day = makeDay(off);
    K = (BOT - TOP) / day.W;
    HALFX = CW / 2 / K;
    var p = day.place, b = day.boat;
    var hw = ((day.tHW % 86400) + 86400) % 86400;
    $('rWho').textContent = day.wd + ' ' + day.dateText + ' ' + day.year + ' · ' + p.river;
    $('rName').textContent = 'The ferry from ' + p.a + ' to ' + p.b;
    var U0 = tideU(day, day.start);
    $('rBlurb').innerHTML = 'The river is <b>' + yards(day.W) + '</b> across here, with the deep water running nearer the ' +
      (day.chan < 0.47 ? p.a + ' side' : day.chan > 0.53 ? p.b + ' side' : 'middle') + '. You have <b>' + b.text +
      '</b>, licensed for ' + b.cap + ' passengers, and the fare is <b>' + money(day.fare) + '</b> a head. ' +
      'High water is at <b>' + clock(hw) + '</b> and it is ' + (day.spring > 0.66 ? '<b>springs</b>, so the stream runs hard' :
        day.spring < 0.33 ? '<b>neaps</b>, so the stream is gentle' : 'between springs and neaps') +
      '; when you take the oars it is ' + (Math.abs(U0) < 0.12 ? 'slack water' : (U0 > 0 ? 'ebbing' : 'flooding') + ' at ' + knots(U0 * profile(day, day.W * day.chan))) +
      '. Wind: <b>' + windText(day) + '</b>' + (Math.abs(day.wx) > 4 ? ', and if it comes against the tide there will be a chop' : '') + '. ' +
      (day.market ? 'It is market day and the stairs will be busy. ' : '') +
      'The far stair lies ' + (Math.abs(day.offB) < 15 ? 'straight across' : yards(Math.abs(day.offB)) + (day.offB > 0 ? ' down river' : ' up river')) +
      ', and the share of the ferry rent for the morning is ' + money(day.rent) + '.';
    $('rBook').innerHTML = '“Never point her at the stair you want. Point her at where the stair will be when the river has done ' +
      'with you, and if it has set you down, creep back up under the bank where it cannot get at you.” — an old ferryman';
    var lbl = off === 0 ? 'Today’s' : off === -1 ? 'Yesterday’s' : off === 1 ? 'Tomorrow’s' : (off > 0 ? '+' : '') + off + ' days';
    $('dayOut').textContent = lbl + ' morning · ' + day.dateText;
    fresh();
  }

  function fresh() {
    S = {
      t: day.start - 1, run: false, phase: 'ready', docked: true, side: 0, dest: 1,
      x: 0, y: 0, V: 0, arm: 1, aboard: [], unpaid: 0, q: [[], []], ai: 0,
      fares: 0, paid: 0, carried: 0, lost: 0, grounds: 0, fouls: 0, hard: 0, swept: 0, soaked: 0,
      onMud: false, cool: 0, trips: [], path: null, tripT: 0, tripN: 0, fast: false, lastLog: 0,
      tide: [], lastTideLog: -1e9, lostMsgAt: -1e9
    };
    for (var s = 0; s < 2; s++) for (var i = 0; i < day.init[s]; i++) S.q[s].push({ t: day.start - 60 * (i + 1), side: s, pat: 20 * 60 });
    $('aim').value = 0; $('pull').value = 2;
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    $('bGo').textContent = 'Take the oars';
    say('You are alongside <b>' + day.place.a + '</b> with ' + day.init[0] + ' waiting to cross and ' + day.init[1] +
      ' already at ' + day.place.b + '. The morning runs from <b>' + clock(day.start) + '</b> to <b>' + clock(day.end) +
      '</b>. Watch the streaks on the water: they show which way the tide is running and how much harder it runs over the deep channel.');
    boardAll();
    controls(); hud(); draw();
  }

  function controls() {
    var a = +$('aim').value;
    $('aimOut').textContent = a === 0 ? 'straight across' : Math.abs(a) + '° ' + (a < 0 ? 'up river' : 'down river');
    $('pullOut').textContent = PULLNAME[+$('pull').value];
    var btn = $('bGo');
    if (S.phase === 'ready') { btn.textContent = 'Take the oars'; btn.disabled = false; }
    else if (S.phase === 'done') { btn.disabled = true; }
    else if (S.docked) { btn.textContent = 'Push off for ' + sideName(S.dest); btn.disabled = false; }
    else { btn.textContent = 'Afloat'; btn.disabled = true; }
    $('bFast').disabled = !(S.phase === 'run' && S.docked);
    $('bFast').classList.toggle('ghost', !S.fast);
    $('bFast').textContent = S.fast ? 'Waiting faster (press to stop)' : 'Wait at the stair (faster)';
    $('bEnd').disabled = S.phase !== 'run' || !S.docked;
  }

  function hud() {
    var U = tideU(day, S.t);
    $('hWhen').textContent = clock(Math.max(S.t, day.start)) + (S.t > day.end && S.phase === 'run' ? ' (late)' : '');
    $('hTide').textContent = tideText(U);
    $('hWind').textContent = windText(day) + (chop(day, S.t) > 0.25 ? ', chop' : '');
    $('hDest').textContent = S.phase === 'done' ? 'home' : sideName(S.dest);
    $('hAboard').textContent = S.aboard.length + ' of ' + day.boat.cap + (S.unpaid ? ' (wet)' : '');
    $('hWait').textContent = S.q[0].length + ' here · ' + S.q[1].length + ' there';
    if (!S.docked) $('hWait').textContent = S.q[0].length + ' / ' + S.q[1].length;
    $('hArm').textContent = Math.round(S.arm * 100) + '%' + (S.arm < 0.35 ? ', aching' : '');
    $('hArmBox').classList.toggle('alarm', S.arm < 0.35);
    $('hFares').textContent = money(S.fares) + ' · ' + S.carried + ' carried';
  }

  function boardAll() {
    var q = S.q[S.side], n = 0;
    while (q.length && S.aboard.length < day.boat.cap && S.t < day.end) { S.aboard.push(q.shift()); n++; }
    return n;
  }

  function pushOff() {
    if (S.phase === 'ready') { S.phase = 'run'; S.t = day.start; S.run = true; S.last = null; controls(); return; }
    if (S.phase !== 'run' || !S.docked) return;
    boardAll();
    S.docked = false; S.fast = false;
    S.y = S.side === 0 ? 1.5 : day.W - 1.5;
    S.path = [[S.x, S.y]]; S.tripT = S.t; S.tripN = S.aboard.length; S.lastLog = S.t;
    say('Off from <b>' + sideName(S.side) + '</b> with ' + (S.aboard.length ? S.aboard.length + ' aboard' : 'nobody aboard, to fetch the ' +
      S.q[S.dest].length + ' waiting') + '.');
    controls();
  }

  function land(side, gs) {
    var n = S.aboard.length, paid = n - S.unpaid, note = '';
    if (gs > 1.9 && paid > 0) { paid--; S.hard++; note = ' You hit the stair hard enough to throw them forward, and one of them will not pay for it.'; }
    var took = paid * day.fare;
    S.fares += took; S.carried += n; S.paid += paid;
    S.trips.push({ from: S.side, to: side, t0: S.tripT, t1: S.t, n: n, path: S.path, U: tideU(day, S.tripT) });
    var mins = Math.round((S.t - S.tripT) / 60);
    S.aboard = []; S.unpaid = 0; S.docked = true; S.side = side; S.dest = 1 - side;
    S.x = stairX(side); S.y = side === 0 ? 0 : day.W; S.V = 0; S.path = null; S.onMud = false;
    var b = boardAll();
    say('Alongside <b>' + sideName(side) + '</b> in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.' +
      (n ? ' ' + n + ' ashore, ' + money(took) + ' in your hand.' : '') + note +
      (S.t < day.end ? (b ? ' ' + b + ' step down into the boat.' : ' Nobody waiting.') : ' And that is the morning.'));
    if (S.t >= day.end) endShift();
    controls();
  }

  function foul(v, vx) {
    S.fouls++; S.cool = 30;
    var side = S.y > v.y ? 1 : -1;
    S.y = clamp(v.y + side * (v.beam / 2 + 5), 1, day.W - 1);
    S.V = 0; S.arm = Math.max(0, S.arm - 0.15);
    var wet = S.aboard.length - S.unpaid;
    S.unpaid = S.aboard.length; S.soaked += wet;
    say('<b>' + v.name.charAt(0).toUpperCase() + v.name.slice(1) + '</b> comes down on you' +
      (v.tug ? ' with her paddles thrashing' : '') + ' and her ' + (v.tug ? 'wash' : 'bow') + ' half swamps the boat. ' +
      (S.aboard.length ? 'Your passengers bail with their hats, and not one of them will pay for this crossing.' : 'Luckily nobody was aboard.'));
  }

  function step(dt) {
    S.t += dt;
    if (S.cool > 0) S.cool -= dt;
    // arrivals and the impatient
    while (S.ai < day.arr.length && day.arr[S.ai].t <= S.t) { var a = day.arr[S.ai++]; S.q[a.side].push({ t: a.t, side: a.side, pat: a.pat }); }
    for (var s = 0; s < 2; s++) {
      var keep = [];
      for (var i = 0; i < S.q[s].length; i++) {
        var p = S.q[s][i];
        if (S.t - p.t > p.pat) {
          S.lost++;
          if (S.t - S.lostMsgAt > 300) { S.lostMsgAt = S.t; say('Someone at <b>' + sideName(s) + '</b> has waited long enough and ' + day.place.alt + '.'); }
        } else keep.push(p);
      }
      S.q[s] = keep;
    }
    if (S.t - S.lastTideLog >= 60) { S.lastTideLog = S.t; S.tide.push([S.t, S.q[0].length + S.q[1].length]); }

    if (S.docked) {
      S.arm = Math.min(1, S.arm + dt / 400);
      boardAll();
      if (S.t >= day.end) endShift();
      return;
    }
    var U = tideU(day, S.t);
    var u = U * profile(day, S.y) + 0.03 * day.wx;
    var pull = +$('pull').value;
    var vmax = day.boat.v * (1 - 0.025 * S.aboard.length) * (0.5 + 0.5 * S.arm) * (1 - 0.18 * chop(day, S.t));
    S.V += (PULLS[pull] * vmax - S.V) * Math.min(1, dt / 4);
    var tire = day.boat.tire * (1 + 0.04 * S.aboard.length);
    S.arm = clamp(S.arm + dt * [1 / 500, 1 / 1500, -1 / 2600 * tire, -1 / 650 * tire][pull], 0, 1);
    var a = +$('aim').value * Math.PI / 180, sg = S.dest === 1 ? 1 : -1;
    var vx = S.V * Math.sin(a) + u, vy = S.V * sg * Math.cos(a);
    S.x += vx * dt; S.y += vy * dt;
    var contact = -1;
    if (S.y <= 0) { S.y = 0; contact = 0; } else if (S.y >= day.W) { S.y = day.W; contact = 1; }
    if (contact >= 0) {
      var at = Math.abs(S.x - stairX(contact)) < STAIR;
      if (at && contact === S.dest) { land(contact, Math.sqrt(vx * vx + vy * vy)); return; }
      if (!at && !S.onMud) {
        S.onMud = true; S.grounds++;
        var dx = S.x - stairX(contact);
        say('On the mud under the ' + (contact === S.dest ? sideName(contact) : sideName(contact) + ' (wrong)') + ' bank, <b>' +
          yards(Math.abs(dx)) + (dx > 0 ? ' below' : ' above') + '</b> the stair. The stream is weak here: swing her along the bank and creep ' +
          (dx > 0 ? 'up' : 'down') + ' to it.');
      }
    } else if (S.onMud && S.y > 3 && S.y < day.W - 3) S.onMud = false;
    // vessels
    if (S.cool <= 0) {
      for (var j = 0; j < day.ships.length; j++) {
        var v = day.ships[j];
        if (S.t < v.t0) continue;
        var sx = v.x0 + v.dir * v.sp * (S.t - v.t0);
        if (Math.abs(sx) > HALFX + v.len) continue;
        if (Math.abs(S.x - sx) < v.len / 2 + 2 && Math.abs(S.y - v.y) < v.beam / 2 + 2) { foul(v, sx); break; }
      }
    }
    // swept off the reach
    if (Math.abs(S.x) > HALFX - 6) {
      S.swept++;
      var side = S.y < day.W / 2 ? 0 : 1;
      S.x = Math.sign(S.x) * (HALFX - 30); S.y = side === 0 ? 0 : day.W; S.V = 0; S.onMud = true;
      S.t += 6 * 60; S.arm = Math.max(0, S.arm - 0.2);
      say('The stream has carried you right off the reach. It takes <b>six minutes</b> of hauling along the ' + sideName(side) +
        ' bank to get her back where you can see the stairs.');
    }
    if (S.t - S.lastLog >= 3) { S.lastLog = S.t; S.path.push([S.x, S.y]); }
    if (S.t > day.end + 900) { say('It is long past the end of the morning and you are still on the water. The next man takes over the ferry.'); endShift(); }
  }

  /* ---------- drawing ---------- */
  function shipAt(v, t) { return v.x0 + v.dir * v.sp * (t - v.t0); }

  function draw() {
    var c = ctx, t = S.t;
    c.clearRect(0, 0, CW, CH);
    // land
    c.fillStyle = '#1b2219'; c.fillRect(0, 0, CW, TOP); c.fillRect(0, BOT, CW, CH - BOT);
    c.fillStyle = '#3a3528'; c.fillRect(0, TOP - 7, CW, 7); c.fillRect(0, BOT, CW, 7);
    // water
    var g = c.createLinearGradient(0, TOP, 0, BOT);
    g.addColorStop(0, '#173041'); g.addColorStop(day.chan, '#0e2232'); g.addColorStop(1, '#173041');
    c.fillStyle = g; c.fillRect(0, TOP, CW, BOT - TOP);
    var U = tideU(day, t), ch = chop(day, t);
    // streaks
    c.lineWidth = 1.2;
    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i], y = s.y * day.W, u = U * profile(day, y) + 0.03 * day.wx;
      var x = s.x * HALFX;
      var L = clamp(Math.abs(u) * 14 * s.l, 1.5, 30) * Math.sign(u || 1);
      c.strokeStyle = 'rgba(160,200,225,' + (0.12 + 0.35 * clamp(Math.abs(u), 0, 1.5) / 1.5) + ')';
      c.beginPath(); c.moveTo(px(x), py(y)); c.lineTo(px(x) - L, py(y)); c.stroke();
      if (ch > 0.2 && i % 3 === 0) { c.fillStyle = 'rgba(230,240,250,' + 0.35 * ch + ')'; c.fillRect(px(x) + 3, py(y) - 1, 3, 1.5); }
    }
    // stream arrows on the left edge
    c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'left';
    for (var k = 1; k < 5; k++) {
      var yy = day.W * k / 5, uu = U * profile(day, yy);
      var len = clamp(uu * 22, -40, 40);
      c.strokeStyle = 'rgba(242,211,107,.6)'; c.fillStyle = 'rgba(242,211,107,.6)';
      if (Math.abs(len) > 2) {
        c.beginPath(); c.moveTo(14, py(yy)); c.lineTo(14 + Math.abs(len), py(yy)); c.stroke();
        var hx = len > 0 ? 14 + Math.abs(len) : 14;
        c.beginPath(); c.moveTo(hx, py(yy)); c.lineTo(hx - 5 * Math.sign(len), py(yy) - 3); c.lineTo(hx - 5 * Math.sign(len), py(yy) + 3); c.fill();
      }
    }
    // stairs
    for (var sd = 0; sd < 2; sd++) {
      var sx = px(stairX(sd)), w = STAIR * K * 2;
      var y0 = sd === 0 ? BOT : TOP - 22;
      c.fillStyle = '#6d6a62'; c.fillRect(sx - w / 2, y0, w, 22);
      c.fillStyle = '#8a867b';
      for (var st = 0; st < 4; st++) c.fillRect(sx - w / 2, y0 + (sd === 0 ? st * 6 : 22 - st * 6 - 3), w, 2);
      // people
      var n = S.q[sd].length;
      c.fillStyle = '#e9dfc7';
      for (var pp = 0; pp < Math.min(n, 14); pp++) {
        var qx = sx + w / 2 + 8 + (pp % 7) * 7, qy = sd === 0 ? BOT + 14 + Math.floor(pp / 7) * 9 : TOP - 18 + Math.floor(pp / 7) * 9;
        c.beginPath(); c.arc(qx, qy, 2.6, 0, 7); c.fill();
      }
      c.fillStyle = '#cfd6e2'; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
      var label = sideName(sd).toUpperCase() + (n > 14 ? '  +' + (n - 14) : '');
      c.fillText(label, clamp(sx, 90, CW - 90), sd === 0 ? CH - 12 : 16);
    }
    // vessels
    for (var j = 0; j < day.ships.length; j++) {
      var v = day.ships[j];
      if (t < v.t0 - 1) continue;
      var vx = shipAt(v, t);
      if (Math.abs(vx) > HALFX + v.len) continue;
      var cx = px(vx), cy = py(v.y), hl = v.len * K / 2, hb = v.beam * K / 2;
      c.save(); c.translate(cx, cy); c.scale(v.dir, 1);
      c.fillStyle = v.tug ? '#2a2a2e' : '#4a3a2a';
      c.beginPath(); c.moveTo(hl, 0); c.quadraticCurveTo(hl * 0.6, -hb, -hl * 0.2, -hb); c.lineTo(-hl, -hb * 0.8);
      c.lineTo(-hl, hb * 0.8); c.lineTo(-hl * 0.2, hb); c.quadraticCurveTo(hl * 0.6, hb, hl, 0); c.fill();
      if (v.sail) {
        c.fillStyle = v.sail; c.globalAlpha = 0.85;
        c.beginPath(); c.moveTo(hl * 0.1, -1); c.lineTo(-hl * 0.7, -hb * 2.2); c.lineTo(-hl * 0.75, 0); c.fill();
        c.globalAlpha = 1;
      }
      if (v.tug) {
        c.fillStyle = '#111'; c.fillRect(-2, -3, 5, 6);
        c.fillStyle = 'rgba(150,150,150,.35)';
        for (var sm = 1; sm < 6; sm++) { c.beginPath(); c.arc(-sm * 7, -sm * 2, 3 + sm, 0, 7); c.fill(); }
      }
      c.restore();
    }
    // the trip so far
    if (S.path && S.path.length > 1) {
      c.strokeStyle = 'rgba(100,240,200,.5)'; c.setLineDash([3, 4]); c.beginPath();
      for (var pi = 0; pi < S.path.length; pi++) { var P = S.path[pi]; if (pi) c.lineTo(px(P[0]), py(P[1])); else c.moveTo(px(P[0]), py(P[1])); }
      c.lineTo(px(S.x), py(S.y)); c.stroke(); c.setLineDash([]);
    }
    // the boat
    var a = +$('aim').value * Math.PI / 180, sg = S.dest === 1 ? 1 : -1;
    var hx2 = Math.sin(a), hy2 = sg * Math.cos(a);
    var ang = Math.atan2(-hy2, hx2);
    var bx = px(S.x), by = py(S.y) + (S.docked ? (S.side === 0 ? -6 : 6) : 0);
    if (S.phase !== 'done') {
      c.strokeStyle = 'rgba(100,240,200,.35)'; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(ang) * 34, by + Math.sin(ang) * 34); c.stroke();
    }
    c.save(); c.translate(bx, by); c.rotate(ang);
    var stroke = S.docked ? 0 : Math.sin(t * (0.8 + 0.35 * +$('pull').value)) * 0.5 * (+$('pull').value ? 1 : 0);
    c.strokeStyle = '#d8cfb6'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(1, 0); c.lineTo(1 + Math.cos(Math.PI / 2 + stroke) * 13, -Math.sin(Math.PI / 2 + stroke) * 13); c.stroke();
    c.beginPath(); c.moveTo(1, 0); c.lineTo(1 + Math.cos(Math.PI / 2 + stroke) * 13, Math.sin(Math.PI / 2 + stroke) * 13); c.stroke();
    c.lineWidth = 1;
    c.fillStyle = '#d2b26a';
    c.beginPath(); c.moveTo(12, 0); c.quadraticCurveTo(6, -6, -9, -5); c.lineTo(-10, 5); c.quadraticCurveTo(6, 6, 12, 0); c.fill();
    c.fillStyle = S.unpaid ? '#8fb8d8' : '#3b2e20';
    for (var q = 0; q < S.aboard.length; q++) { c.beginPath(); c.arc(-7 + (q % 4) * 4, (Math.floor(q / 4) % 2 ? 2 : -2), 1.6, 0, 7); c.fill(); }
    c.restore();
    // labels
    c.fillStyle = '#8b97ab'; c.font = '600 10px ui-monospace,Menlo,monospace';
    c.textAlign = 'left'; c.fillText('← UP RIVER', 12, TOP + 16);
    c.textAlign = 'right'; c.fillText('DOWN TO ' + day.place.sea.toUpperCase() + ' →', CW - 12, TOP + 16);
    c.textAlign = 'right'; c.fillStyle = '#e8edf5';
    c.fillText(clock(Math.max(t, day.start)) + ' · ' + tideText(U).toUpperCase(), CW - 12, BOT - 10);
    if (S.phase === 'ready') {
      c.fillStyle = 'rgba(7,9,13,.55)'; c.fillRect(0, CH / 2 - 26, CW, 52);
      c.fillStyle = '#e8edf5'; c.textAlign = 'center'; c.font = '600 13px ui-monospace,Menlo,monospace';
      c.fillText('TAKE THE OARS TO BEGIN THE MORNING', CW / 2, CH / 2 + 4);
    }
  }

  /* ---------- the loop ---------- */
  var lastFrame = null;
  function frame(now) {
    if (S && S.phase === 'run') {
      var rdt = lastFrame == null ? 0 : Math.min(0.1, (now - lastFrame) / 1000);
      var gdt = rdt * SPEED * (S.fast && S.docked ? 5 : 1);
      while (gdt > 0 && S.phase === 'run') { var h = Math.min(0.5, gdt); step(h); gdt -= h; }
      hud(); controls();
    }
    lastFrame = now;
    if (S) draw();
    requestAnimationFrame(frame);
  }

  /* ---------- the end of the morning ---------- */
  function endShift() {
    if (S.phase === 'done') return;
    S.phase = 'done'; S.fast = false;
    var left = S.q[0].length + S.q[1].length;
    var offered = S.carried + S.lost + left + S.aboard.length;
    var share = offered ? S.carried / offered : 1;
    var net = S.fares - day.rent;
    var mins = S.trips.length ? S.trips.reduce(function (m, x) { return m + (x.t1 - x.t0); }, 0) / S.trips.length / 60 : 0;
    var v = $('verdict');
    v.className = 'verdict ' + (share > 0.8 && S.fouls === 0 ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + S.trips.length + ' crossing' + (S.trips.length === 1 ? '' : 's') + '</b>, ' + S.carried +
      ' passengers carried, ' + money(S.fares) + ' in fares' + (S.trips.length ? ', ' + mins.toFixed(1) + ' minutes a crossing on average' : '') + '.</p>' +
      '<p>' + (S.lost ? S.lost + ' gave up waiting and ' + day.place.alt + '. ' : 'Nobody gave up on you. ') +
      (S.grounds ? 'You touched the mud away from a stair ' + S.grounds + ' time' + (S.grounds === 1 ? '' : 's') + '. ' : 'You never missed a stair. ') +
      (S.fouls ? 'You were caught by passing vessels ' + S.fouls + ' time' + (S.fouls === 1 ? '' : 's') + (S.soaked ? ' and ' + S.soaked + ' passengers went home wet without paying' : '') + '. ' : '') +
      (S.swept ? 'You were swept off the reach ' + S.swept + ' time' + (S.swept === 1 ? '' : 's') + '. ' : '') +
      (S.hard ? 'You came in hard ' + S.hard + ' time' + (S.hard === 1 ? '' : 's') + '. ' : '') + '</p>' +
      '<p>' + (share > 0.9 ? 'The stairs were never kept waiting long. A ferryman who works like this keeps the lease.' :
        share > 0.7 ? 'A fair morning. Most of the people who came down to the water got across.' :
          'Too many people went away. The lessee will hear about it from the parish.') + '</p>';
    var rv = $('reveal');
    rv.style.display = '';
    rv.innerHTML = '<h5>Every crossing, over the ground</h5><canvas id="cTracks" width="640" height="300"></canvas>' +
      '<div class="key"><span><i style="background:#ffb27a"></i>on the ebb</span><span><i style="background:#7aa2ff"></i>on the flood</span><span><i style="background:#c9d1dc"></i>near slack</span></div>' +
      '<p>A crossing on a running tide bends down-stream through the middle of the river, where the stream is strongest, and straightens out under the banks. The good ones end exactly on a stair; the bad ones end on the mud and creep along it.</p>' +
      '<h5>The tide through the morning</h5><canvas id="cTide" width="640" height="200"></canvas>' +
      '<div class="key"><span><i style="background:#f2d36b"></i>stream over the channel, knots</span><span><i style="background:#64f0c8"></i>your crossings</span><span><i style="background:#e9dfc7"></i>people waiting</span></div>' +
      '<h5>The account</h5><table class="card">' +
      '<tr><td>' + S.paid + ' paying passenger' + (S.paid === 1 ? '' : 's') + ' at ' + money(day.fare) + '</td><td class="n">' + money(S.fares) + '</td></tr>' +
      '<tr><td>The morning’s share of the ferry rent</td><td class="n">' + money(-day.rent) + '</td></tr>' +
      '<tr class="tot"><td>Yours for the morning</td><td class="n">' + money(net) + '</td></tr>' +
      '<tr><td>For comparison, a labourer’s whole day in ' + day.year + '</td><td class="n">' + money(day.year < 1830 ? 22 : day.year < 1860 ? 26 : 30) + '</td></tr>' +
      '</table>';
    drawTracks($('cTracks'));
    drawTide($('cTide'));
    $('bAgain').style.display = '';
    controls(); hud();
  }

  function drawTracks(cv) {
    var c = cv.getContext('2d'), W = 640, H = 300, top = 30, bot = 270;
    var k = (bot - top) / day.W;
    function X(x) { return W / 2 + x * k; }
    function Y(y) { return bot - y * k; }
    c.fillStyle = '#1b2219'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#12283a'; c.fillRect(0, top, W, bot - top);
    c.fillStyle = '#6d6a62';
    c.fillRect(X(0) - STAIR * k, bot, STAIR * k * 2, 10); c.fillRect(X(day.offB) - STAIR * k, top - 10, STAIR * k * 2, 10);
    c.font = '600 10px ui-monospace,Menlo,monospace'; c.fillStyle = '#cfd6e2'; c.textAlign = 'center';
    c.fillText(day.place.a.toUpperCase(), clamp(X(0), 90, W - 90), H - 6);
    c.fillText(day.place.b.toUpperCase(), clamp(X(day.offB), 90, W - 90), 14);
    if (!S.trips.length) { c.fillStyle = '#8b97ab'; c.fillText('NO CROSSINGS MADE', W / 2, H / 2); return; }
    S.trips.forEach(function (tr) {
      c.strokeStyle = Math.abs(tr.U) < 0.25 ? 'rgba(201,209,220,.8)' : tr.U > 0 ? 'rgba(255,178,122,.8)' : 'rgba(122,162,255,.85)';
      c.lineWidth = 1.6; c.beginPath();
      tr.path.forEach(function (p, i) { if (i) c.lineTo(X(p[0]), Y(p[1])); else c.moveTo(X(p[0]), Y(p[1])); });
      c.lineTo(X(stairX(tr.to)), Y(tr.to ? day.W : 0));
      c.stroke();
    });
  }

  function drawTide(cv) {
    var c = cv.getContext('2d'), W = 640, H = 200, L = 40, R = 620, T = 16, B = 170;
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H);
    var t0 = day.start, t1 = Math.max(day.end, S.t);
    function X(t) { return L + (t - t0) / (t1 - t0) * (R - L); }
    var um = Math.max(day.Umax * 1.944, 0.5);
    function Y(kn) { return (T + B) / 2 - kn / um * (B - T) / 2; }
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(R, Y(0)); c.stroke();
    c.fillStyle = '#8b97ab'; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'right';
    c.fillText('EBB ' + um.toFixed(1), L + 34, T + 8); c.fillText('FLOOD', L + 34, B - 2);
    // crossings
    S.trips.forEach(function (tr) { c.fillStyle = 'rgba(100,240,200,.22)'; c.fillRect(X(tr.t0), T, Math.max(1, X(tr.t1) - X(tr.t0)), B - T); });
    // queue
    var qm = 1; S.tide.forEach(function (p) { qm = Math.max(qm, p[1]); });
    c.strokeStyle = 'rgba(233,223,199,.7)'; c.beginPath();
    S.tide.forEach(function (p, i) { var x = X(p[0]), y = B - p[1] / qm * (B - T) * 0.5; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
    // stream
    c.strokeStyle = '#f2d36b'; c.lineWidth = 2; c.beginPath();
    for (var i = 0; i <= 120; i++) {
      var t = t0 + (t1 - t0) * i / 120, kn = tideU(day, t) * 1.944;
      if (i) c.lineTo(X(t), Y(kn)); else c.moveTo(X(t), Y(kn));
    }
    c.stroke(); c.lineWidth = 1;
    c.textAlign = 'center'; c.fillStyle = '#8b97ab';
    for (var m = 0; m <= 90; m += 15) c.fillText(clock(t0 + m * 60), X(t0 + m * 60), H - 10);
  }

  /* ---------- wiring ---------- */
  ['aim', 'pull'].forEach(function (id) { $(id).addEventListener('input', function () { controls(); draw(); }); });
  $('bGo').addEventListener('click', pushOff);
  $('bFast').addEventListener('click', function () { if (S.phase === 'run' && S.docked) { S.fast = !S.fast; controls(); } });
  $('bEnd').addEventListener('click', function () { if (S.phase === 'run' && S.docked) { say('You make the boat fast and go up to the inn.'); endShift(); } });
  $('bAgain').addEventListener('click', function () { fresh(); });
  function nudge(id, d) { var e = $(id); e.value = clamp(+e.value + d, +e.min, +e.max); controls(); }
  document.addEventListener('keydown', function (e) {
    if (!S || S.phase === 'done') return;
    if (e.code === 'Space' && e.target && e.target.tagName === 'BUTTON') return;
    if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range' || e.target.tagName === 'TEXTAREA')) return;
    var c = e.code, used = true;
    if (c === 'ArrowLeft' || c === 'KeyA') nudge('aim', -4);
    else if (c === 'ArrowRight' || c === 'KeyD') nudge('aim', 4);
    else if (c === 'ArrowUp' || c === 'KeyW') nudge('pull', 1);
    else if (c === 'ArrowDown' || c === 'KeyS') nudge('pull', -1);
    else if (c === 'Space') pushOff();
    else used = false;
    if (used) e.preventDefault();
  });
  document.addEventListener('visibilitychange', function () { lastFrame = null; });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  requestAnimationFrame(frame);
})();
