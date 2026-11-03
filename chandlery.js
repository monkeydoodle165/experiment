/* drift.quibo.games — The Chandlery
   A tallow chandler's dipping room on a working day between 1790 and 1869, on today's calendar date. The day's
   number picks the town, the season (how warm the room is, and how it warms through the afternoon), the tallow
   (and so its melting point), the order on the slate (twelves, eights, sixes or fours to the pound, each a
   different thickness of candle), how many dozen are wanted, the price, and the hour the carrier calls.

   The model, in one breath: the fire sets a temperature the vat is heading for. Every round of the wheel dips
   every rod once. A dip into tallow only a little above its melting point leaves a thick coat; hotter tallow
   leaves a thin one and, hotter still, melts some of the last coat off. Tallow near its melting point drags
   ridges and lumps. Between dips the candle cools towards the room:
       surface = room + (just dipped - room) * exp(-minutes / (1.2 + 0.25 * radius in mm))
   and dipping it again before the last coat has set melts it back and makes it sag. There are no scales on the
   wheel: weigh a candle to know where you are, and cut the rods when the weight is right.
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
    var h = s ^ 0x7c4a11d3;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function $(id) { return document.getElementById(id); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function money(d) {
    var neg = d < 0;
    d = Math.round(Math.abs(d));
    var l = Math.floor(d / 240), s = Math.floor((d % 240) / 12), p = d % 12;
    var out = [];
    if (l) out.push('£' + l);
    if (s) out.push(s + 's');
    if (p || !out.length) out.push(p + 'd');
    return (neg ? 'minus ' : '') + out.join(' ');
  }
  function deg(t) { return Math.round(t) + '°F'; }
  /* ounces to the nearest eighth, as a chandler's scales would show */
  function oz(w) {
    var e = Math.round(w * 8), whole = Math.floor(e / 8), frac = e % 8;
    var F = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
    return (whole ? whole : frac ? '' : '0') + F[frac] + ' oz';
  }
  function lbs(x) { return x < 10 ? x.toFixed(1) + ' lb' : Math.round(x) + ' lb'; }

  /* normal CDF, Abramowitz and Stegun 7.1.26 */
  function Phi(x) {
    var t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
      Math.exp(-x * x / 2);
    return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }

  /* ---------- the world ---------- */
  var TOWNS = [
    { place: 'Whitechapel', county: 'London', warm: 3, carrier: 'the grocer’s own cart' },
    { place: 'Bristol', county: 'Gloucestershire', warm: 2, carrier: 'the Bath waggon' },
    { place: 'Norwich', county: 'Norfolk', warm: 0, carrier: 'the Yarmouth carrier' },
    { place: 'York', county: 'Yorkshire', warm: -1, carrier: 'the Malton carrier' },
    { place: 'Leeds', county: 'Yorkshire', warm: 0, carrier: 'a boat on the Aire and Calder' },
    { place: 'Bath', county: 'Somerset', warm: 2, carrier: 'the Devizes waggon' },
    { place: 'Exeter', county: 'Devon', warm: 3, carrier: 'the Topsham carrier' },
    { place: 'Shrewsbury', county: 'Shropshire', warm: 0, carrier: 'the Welshpool carrier' },
    { place: 'Lincoln', county: 'Lincolnshire', warm: -1, carrier: 'a boat down the Fossdyke' },
    { place: 'the Canongate', county: 'Edinburgh', warm: -3, carrier: 'the Leith carrier' },
    { place: 'the Gallowgate', county: 'Glasgow', warm: -2, carrier: 'a cart to the Broomielaw' },
    { place: 'Thomas Street', county: 'Dublin', warm: 1, carrier: 'the Grand Canal boat' }
  ];
  /* tm: the melting point, °F. lumpy: how readily it drags. price: pence a pound. */
  var TALLOWS = [
    { key: 'mutton', name: 'mutton tallow', tm: 120, lumpy: 0.8, price: 6.5, white: 1,
      text: 'hard white mutton tallow from the town’s own slaughterhouses, the best there is for candles' },
    { key: 'russia', name: 'Russian tallow', tm: 116, lumpy: 1, price: 5.5, white: 0.75,
      text: 'yellow candle tallow in casks from St Petersburg, the commonest tallow in the trade' },
    { key: 'beef', name: 'beef tallow', tm: 112, lumpy: 1, price: 5, white: 0.85,
      text: 'beef tallow rendered last week, softer than mutton and quicker to drip' },
    { key: 'mixed', name: 'mixed tallow', tm: 114, lumpy: 1.15, price: 5, white: 0.8,
      text: 'two parts beef to one of mutton, as most chandlers ran it' },
    { key: 'rough', name: 'rough fat', tm: 108, lumpy: 1.4, price: 4, white: 0.6,
      text: 'rough fat and kitchen stuff bought from the butchers and cooks, rendered in the yard: cheap, soft and greasy' }
  ];
  /* n to the pound, length in inches, dozen on a full wheel. */
  var ORDERS = [
    { n: 12, name: 'twelves', len: 8, wheel: 16, loads: [2, 3], price: [8, 10],
      text: 'twelves: thin cottage candles, twelve to the pound', buyer: ['a village shop at Hartley', 'the workhouse', 'a lodging-house keeper', 'the colliery stores'] },
    { n: 8, name: 'eights', len: 9.5, wheel: 14, loads: [2, 3], price: [8.5, 10.5],
      text: 'eights: kitchen and parlour candles, eight to the pound', buyer: ['a grocer in the High Street', 'the George inn', 'a farm household', 'the mill office'] },
    { n: 6, name: 'long sixes', len: 10.5, wheel: 12, loads: [2, 3], price: [9, 11],
      text: 'long sixes: the ordinary household candle, six to the pound', buyer: ['a wholesale grocer', 'the infirmary', 'a ship’s chandler', 'a draper with a big shop'] },
    { n: 4, name: 'fours', len: 12, wheel: 10, loads: [2, 2], price: [9.5, 11.5],
      text: 'fours: thick shop and counting-house candles, four to the pound', buyer: ['the bank in Market Street', 'a counting-house', 'the assembly rooms', 'a shop on the main street'] }
  ];

  var WICK = 1.0;          // radius of a bare plaited cotton wick, mm
  var TOL = 0.07;          // the buyer passes a candle within seven per cent of its weight
  var SPF = 0.22;          // seconds of real time per minute of the day, at the slow clock
  var RELOAD = 20;         // minutes to cut a wheel off and hang fresh wicks
  var START = 6 * 60;      // six in the morning

  function weightOf(r, len) {
    var rc = r / 10, L = len * 2.54;
    return 0.92 * Math.PI * rc * rc * L / 28.35;     // ounces
  }
  function radiusFor(w, len) { return 10 * Math.sqrt(w * 28.35 / (0.92 * Math.PI * len * 2.54)); }

  /* how thick a coat one dip leaves, and how much it melts back, at a vat x degrees above the melting point */
  function coatAt(x) {
    if (x < 2) return 0.62;
    return 0.05 + 0.55 * Math.exp(-x / 9);
  }
  function meltAt(x) { return x > 28 ? (x - 28) * 0.006 : 0; }
  function ridgesAt(x) { return x < 2 ? 1.2 : Math.max(0, (12 - x) / 12) * 0.35; }
  function tauOf(r) { return 1.2 + 0.25 * r; }

  function makeDay(off) {
    var d = dateFor(off), seed = seedForDate(d), r = rng(seed);
    var town = pick(r, TOWNS), tallow = pick(r, TALLOWS), order = pick(r, ORDERS);
    var year = 1790 + Math.floor(r() * 80);
    var start = new Date(d.getFullYear(), 0, 1);
    var doy = Math.round((d - start) / 864e5);
    var winter = (Math.cos((doy - 15) / 365.25 * 2 * Math.PI) + 1) / 2;
    var base = 40 + 24 * (1 - winter) + town.warm + (r() - 0.5) * 6;
    var swing = 4 + r() * 6 + 4 * (1 - winter);
    var loads = order.loads[0] + Math.floor(r() * (order.loads[1] - order.loads[0] + 1));
    var dozen = loads * order.wheel;
    var price = order.price[0] + 1 + r() * (order.price[1] - order.price[0]) + (tallow.white - 0.8) * 2;
    var tprice = tallow.price + (r() - 0.5) * 1 + (year < 1815 ? 1.5 : 0);
    var buyer = pick(r, order.buyer);
    var dayObj = {
      off: off, date: d, seed: seed, town: town, tallow: tallow, order: order, year: year, winter: winter,
      base: base, swing: swing, loads: loads, dozen: dozen, price: price, tprice: tprice, buyer: buyer,
      tw: 16 / order.n, duty: year < 1831,
      wd: WEEKDAYS[d.getDay()], dateText: d.getDate() + ' ' + MONTHS[d.getMonth()]
    };
    dayObj.rTarget = radiusFor(dayObj.tw, order.len);
    // the carrier: what a steady hand would take, and a little over
    var ref = reference(dayObj);
    dayObj.refMin = ref;
    dayObj.deadline = Math.ceil((ref * 1.3 + 40) / 15) * 15;
    return dayObj;
  }

  function ambAt(dy, t) {
    // t: minutes since six in the morning. Coolest at dawn, warmest at three in the afternoon.
    var h = (START + t) / 60;
    return dy.base + dy.swing * (Math.cos((h - 15) / 24 * 2 * Math.PI) - 0.2);
  }
  function readyThreshold(dy) { return dy.tallow.tm - 22; }
  function minutesToSet(dy, r, amb) {
    var s0 = dy.tallow.tm + 4, th = readyThreshold(dy);
    if (amb >= th - 0.5) return 60;
    return Math.max(0, tauOf(r) * Math.log((s0 - amb) / (th - amb)));
  }

  /* a good chandler: vat twelve degrees over, and wait just long enough each round */
  function reference(dy) {
    var t = 0, x = 12;
    for (var L = 0; L < dy.loads; L++) {
      var r = WICK, guard = 0;
      while (weightOf(r, dy.order.len) < dy.tw && guard++ < 400) {
        r += coatAt(x);
        t += Math.max(2, minutesToSet(dy, r, ambAt(dy, t)) + 0.3);
      }
      t += RELOAD;
    }
    return t;
  }

  /* ---------- state ---------- */
  var day, S;
  var dayOff = 0;
  var canvas = $('room'), ctx = canvas.getContext('2d');
  var dots = (function () {
    var r = rng(1831), a = [];
    for (var i = 0; i < 60; i++) a.push({ x: r(), y: r(), k: r() });
    return a;
  })();

  function fireText(f) {
    if (f < 8) return 'out';
    if (f < 30) return 'a low fire';
    if (f < 55) return 'steady';
    if (f < 80) return 'brisk';
    return 'roaring';
  }
  function waitText(w) { return w.toFixed(1).replace('.0', '') + ' min a round'; }

  function surface(now) {
    if (S.lastDip < 0) return ambAt(day, now);
    var a = ambAt(day, now);
    return a + (S.s0 - a) * Math.exp(-(now - S.lastDip) / tauOf(S.r));
  }
  function setText(sf) {
    var th = readyThreshold(day);
    if (S.lastDip < 0) return 'bare wicks';
    if (sf > th + 12) return 'soft and warm';
    if (sf > th) return 'nearly set';
    return 'set hard';
  }
  function sigma(st) {
    var dips = Math.max(1, st.dips);
    return 0.022 + 0.16 * st.lumps / dips + 0.12 * st.sag / dips;
  }
  function inSpec(mean, sig) {
    var lo = (Math.log(1 - TOL) - Math.log(mean / day.tw)) / sig;
    var hi = (Math.log(1 + TOL) - Math.log(mean / day.tw)) / sig;
    return { ok: Phi(hi) - Phi(lo), light: Phi(lo), heavy: 1 - Phi(hi) };
  }

  function fresh() {
    var amb = ambAt(day, 0);
    S = {
      phase: 'ready', t: 0, T: day.tallow.tm + 16, fire: 50, wait: 3, speed: 1, paused: false,
      load: 0, r: WICK, dips: 0, lumps: 0, sag: 0, scorch: 0, lastDip: -1, s0: 0, nextDip: 0, busy: 0,
      done: [], trace: [], events: [], anim: 0, weighed: null, used: 0, lastWarn: ''
    };
    $('pReady').style.display = '';
    $('pRun').style.display = 'none';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    setFire((day.tallow.tm + 16 - amb) / 1.9); setWait(3);
    $('bPause').textContent = 'Pause';
    $('bSpeed').textContent = 'Faster clock';
    say('The vat is half full of ' + day.tallow.name + ' warming over the fire, and the wheel is hung with <b>' + day.order.wheel +
      ' dozen</b> bare wicks. The room is at <b>' + deg(amb) + '</b>. The carrier calls at <b>' + clockOf(day.deadline) + '</b>.');
    hud(); draw();
  }

  function loadDay(off) {
    dayOff = off;
    day = makeDay(off);
    var tw = day.tallow, o = day.order;
    $('rWho').textContent = day.wd + ' ' + day.dateText + ' ' + day.year + ' · ' + day.town.place + ', ' + day.town.county;
    $('rName').textContent = day.dozen + ' dozen ' + o.name + ' for ' + day.buyer;
    $('rBlurb').innerHTML = 'The order on the slate is <b>' + o.text + '</b>, so every candle should weigh <b>' + oz(day.tw) +
      '</b>, give or take a fourteenth. That is ' + day.loads + ' full wheels of ' + o.wheel + ' dozen. In the vat is <b>' +
      tw.text + '</b>, which sets at about <b>' + deg(tw.tm) + '</b>. ' +
      (day.winter > 0.6 ? 'It is the dipping season, and the room is cold.' : day.winter < 0.35 ?
        'It is high summer, when most chandlers would rather not dip at all: the room is warm and the coats are slow to set.' :
        'The room is cool in the morning and warmer after dinner.') +
      ' The candles fetch <b>' + money(day.price) + '</b> a pound, the tallow costs <b>' + money(day.tprice) + '</b> a pound' +
      (day.duty ? ', and the exciseman takes <b>a penny a pound</b> on every candle made' : '') + '.';
    $('rBook').innerHTML = '“Have the tallow but just hot enough to run; too hot, and it melts off what you put on before; ' +
      'too cold, and it hangs in lumps and the coats will part. Let every coat set before the next, and in hot weather ' +
      'dip slow or not at all.” — the dipping-room rule';
    var lbl = off === 0 ? 'Today’s' : off === -1 ? 'Yesterday’s' : off === 1 ? 'Tomorrow’s' : (off > 0 ? '+' : '') + off + ' days';
    $('dayOut').textContent = lbl + ' order · ' + day.dateText;
    fresh();
  }

  function say(html) { $('msg').innerHTML = html; }

  function clockOf(t) {
    var m = Math.round(START + t);
    var hh = Math.floor(m / 60) % 24, mi = m % 60;
    var ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 === 0 ? 12 : hh % 12;
    return h12 + ':' + (mi < 10 ? '0' : '') + mi + ' ' + ap;
  }

  function hud() {
    var left = Math.max(0, day.deadline - S.t);
    $('hWhen').textContent = clockOf(S.t) + ' · ' + Math.floor(left / 60) + 'h ' + Math.round(left % 60) + 'm left';
    var amb = ambAt(day, S.t);
    $('hRoom').textContent = deg(amb);
    var x = S.T - day.tallow.tm;
    $('hVat').textContent = deg(S.T) + (x < 2 ? ', skinning over' : x < 8 ? ', thick' : x <= 24 ? ', running' : x <= 45 ? ', thin and hot' : ', smoking');
    $('hVatBox').className = (x < 2 || x > 45) ? 'alarm' : '';
    var sf = surface(S.t);
    $('hCoat').textContent = S.busy > 0 ? 'reloading' : setText(sf);
    $('hCoatBox').className = S.busy <= 0 && S.lastDip >= 0 && sf > readyThreshold(day) + 12 ? 'alarm' : '';
    $('hDips').textContent = S.dips + (S.busy > 0 ? '' : ' on this wheel');
    $('hWheel').textContent = Math.min(S.load + 1, day.loads) + ' of ' + day.loads;
    $('hWeighed').textContent = S.weighed ? oz(S.weighed.w) + ' at dip ' + S.weighed.dips : 'not yet';
    $('hDone').textContent = (S.done.length * day.order.wheel) + ' of ' + day.dozen + ' dozen';
    var running = S.phase === 'run';
    $('bWeigh').disabled = !running || S.busy > 0 || S.dips === 0;
    $('bCut').disabled = !running || S.busy > 0 || S.dips === 0;
  }

  /* ---------- the vat and the wheel ---------- */
  function dip() {
    var tm = day.tallow.tm, x = S.T - tm, sf = surface(S.t);
    if (x < -3) {     // set solid in the vat: the wheel cannot go down
      warn('solid', 'The tallow has <b>set in the vat</b>. The wheel stands still until the fire melts it again.');
      return;
    }
    var th = readyThreshold(day);
    var hot = clamp((sf - th) / 14, 0, 1.5);
    var add = coatAt(x), melt = meltAt(x) + hot * 0.15;
    var before = S.r;
    S.r = Math.max(WICK, S.r + add - melt);
    S.lumps += ridgesAt(x) * day.tallow.lumpy;
    S.sag += hot;
    S.dips++;
    S.lastDip = S.t;
    S.s0 = tm + 4;
    S.T -= 0.35 * day.order.wheel / 12;     // the cold rods take some heat out of the vat
    S.anim = 1;
    S.used += (weightOf(S.r, day.order.len) - weightOf(before, day.order.len)) * day.order.wheel * 12 / 16;
    if (hot > 0.6) warn('sag', 'That round went in <b>before the last coat had set</b>. The warm tallow slid and the foot of every candle is thickening. Give it longer between rounds.');
    else if (x < 2) warn('cold', 'The tallow is <b>skinning over</b> in the vat and the wheel drags clots of it up. Liven the fire.');
    else if (x > 45) warn('smoke', 'The vat is <b>smoking</b>: the tallow is darkening, and so is every coat that comes out of it.');
    else if (x > 30) warn('thin', 'The tallow is <b>running thin</b>: each round takes off nearly as much as it puts on.');
  }
  function warn(k, html) {
    if (S.lastWarn === k) return;
    S.lastWarn = k;
    say(html);
  }

  function step(dt) {
    var amb = ambAt(day, S.t);
    var teq = amb + S.fire / 100 * 190;
    S.teq = teq;
    S.T += (teq - S.T) * (1 - Math.exp(-dt / 22));
    var x = S.T - day.tallow.tm;
    if (x > 45) S.scorch += (x - 45) / 40 * dt / 10;
    if (S.busy > 0) {
      S.busy -= dt;
      if (S.busy <= 0) {
        S.busy = 0; S.r = WICK; S.dips = 0; S.lumps = 0; S.sag = 0; S.lastDip = -1; S.nextDip = S.t + 0.5; S.weighed = null;
        S.scorch = 0; S.lastWarn = '';
        say('A fresh wheel of bare wicks, <b>' + (S.load + 1) + ' of ' + day.loads + '</b>, is hung and turning.');
      }
    } else if (S.t >= S.nextDip) {
      dip();
      S.nextDip = S.t + S.wait;
    }
    S.anim = Math.max(0, S.anim - dt * 1.5);
    S.t += dt;
    if (S.t >= S.trace.length * 2) S.trace.push({ t: S.t, T: S.T, amb: amb, sf: S.busy > 0 ? null : surface(S.t) });
    if (S.t >= day.deadline) finish(false);
  }

  var last = 0, acc = 0;
  function loop(ts) {
    if (S.phase !== 'run') return;
    if (!last) last = ts;
    var dms = Math.min(100, ts - last); last = ts;
    if (!S.paused) {
      acc += dms / 1000 / SPF * S.speed;
      while (acc > 0.1) { step(0.1); acc -= 0.1; if (S.phase !== 'run') break; }
    }
    hud(); draw();
    if (S.phase === 'run') requestAnimationFrame(loop);
  }

  $('bStart').addEventListener('click', function () {
    S.phase = 'run';
    $('pReady').style.display = 'none';
    $('pRun').style.display = '';
    S.nextDip = 1;
    say('The boy sets the wheel turning. Each rod goes down into the vat and up again in its turn; a round of the wheel ' +
      'dips every candle once. Keep the tallow just running, and give each coat time to set.');
    last = 0; acc = 0; hud(); requestAnimationFrame(loop);
  });
  function setFire(v) {
    if (!S) return;
    S.fire = clamp(Math.round(v), 0, 100);
    $('fire').value = S.fire;
    $('fireOut').textContent = fireText(S.fire);
  }
  function setWait(v) {
    if (!S) return;
    S.wait = clamp(Math.round(v * 2) / 2, 2, 10);
    $('wait').value = S.wait;
    $('waitOut').textContent = waitText(S.wait);
  }
  $('fire').addEventListener('input', function () { setFire(+this.value); });
  $('wait').addEventListener('input', function () { setWait(+this.value); });

  function meanWeight() { return weightOf(S.r, day.order.len); }
  function doWeigh() {
    if (S.phase !== 'run' || S.busy > 0 || !S.dips) return;
    var r = rng(S.dips * 977 + S.load * 31 + day.seed);
    var z = Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * Math.cos(2 * Math.PI * r());
    var w = meanWeight() * Math.exp(sigma(S) * z);
    S.weighed = { w: w, dips: S.dips };
    var tw = day.tw, f = w / tw;
    say('You slip a candle off the end of a rod and put it in the scale: <b>' + oz(w) + '</b> against ' + oz(tw) + ' wanted' +
      (f < 0.75 ? '. A long way to go.' : f < 1 - TOL ? '. Getting close.' : f <= 1 + TOL ? '. <b>That one would pass.</b>' : '. <b>Heavy</b>: that is tallow given away.') +
      ' One candle is only one candle.');
    hud();
  }
  function doCut() {
    if (S.phase !== 'run' || S.busy > 0 || !S.dips) return;
    var sig = sigma(S), mean = meanWeight();
    S.done.push({ mean: mean, sig: sig, dips: S.dips, lumps: S.lumps, sag: S.sag, scorch: S.scorch, t: S.t });
    S.events.push({ t: S.t, k: 'cut' });
    S.load++;
    if (S.load >= day.loads) {
      say('The last wheel is cut down and the candles laid in their boxes.');
      finish(true);
      return;
    }
    S.busy = RELOAD;
    var sp = inSpec(mean, sig);
    say('Wheel ' + S.load + ' is cut down: on average <b>' + oz(mean) + '</b> a candle, and about <b>' + Math.round(sp.ok * 100) +
      '%</b> of them look true by eye. Twenty minutes to hang fresh wicks.');
    hud(); draw();
  }
  $('bWeigh').addEventListener('click', doWeigh);
  $('bCut').addEventListener('click', doCut);
  $('bPause').addEventListener('click', function () {
    S.paused = !S.paused;
    this.textContent = S.paused ? 'Carry on' : 'Pause';
  });
  $('bSpeed').addEventListener('click', function () {
    S.speed = S.speed === 1 ? 4 : 1;
    this.textContent = S.speed === 1 ? 'Faster clock' : 'Slower clock';
  });

  /* ---------- the carrier and the account ---------- */
  function finish(early) {
    if (S.phase === 'done') return;
    S.phase = 'done';
    S.trace.push({ t: S.t, T: S.T, amb: ambAt(day, S.t), sf: null });
    $('pRun').style.display = 'none';

    var o = day.order, perWheel = o.wheel * 12;
    var good = 0, light = 0, heavy = 0, lbGood = 0, lbOff = 0, scorchMax = 0;
    S.done.forEach(function (L) {
      var sp = inSpec(L.mean, L.sig);
      L.sp = sp;
      good += perWheel * sp.ok; light += perWheel * sp.light; heavy += perWheel * sp.heavy;
      lbGood += perWheel * sp.ok * L.mean / 16;
      lbOff += perWheel * (1 - sp.ok) * L.mean / 16;
      scorchMax = Math.max(scorchMax, L.scorch);
    });
    var made = S.done.length * perWheel, wanted = day.dozen * 12;
    var dark = clamp(1 - 0.06 * scorchMax, 0.7, 1);
    var revGood = lbGood * day.price * dark, revOff = lbOff * day.price * 0.6 * dark;
    var lbAll = lbGood + lbOff;
    var tallowCost = lbAll * day.tprice;
    var duty = day.duty ? lbAll : 0;
    var wages = (S.t / 60) / 12 * (42 + 12);     // the chandler at 3s 6d and the boy at a shilling, a twelve-hour day
    var coal = (S.t / 60) * 0.6;
    var profit = revGood + revOff - tallowCost - duty - wages - coal;

    var v = $('verdict');
    var short = wanted - good;
    var ok = short < wanted * 0.08 && profit > 0;
    v.className = 'verdict ' + (ok ? 'good' : 'warn');
    var lines = [];
    if (!S.done.length) lines.push('<b>The carrier goes away with nothing.</b> Not a wheel was cut down by ' + clockOf(day.deadline) + '.');
    else if (short < wanted * 0.08) lines.push('<b>The order goes out.</b> ' + Math.round(good / 12) + ' dozen of the ' + day.dozen + ' pass the buyer’s scale as ' + o.name + '.');
    else lines.push('<b>Short.</b> Only ' + Math.round(good / 12) + ' dozen of the ' + day.dozen + ' that ' + day.buyer + ' wanted pass as ' + o.name + '.');
    if (made && made < wanted) lines.push('Only ' + S.done.length + ' of ' + day.loads + ' wheels were finished when the carrier called.');
    if (made) {
      if (light > 0.15 * made && light > heavy) lines.push('Too many are <b>light</b> (' + Math.round(light / 12) + ' dozen): the wheel came down too soon.');
      else if (heavy > 0.15 * made) lines.push('Too many are <b>heavy</b> (' + Math.round(heavy / 12) + ' dozen): that is tallow given away, and the buyer counts them short to the pound.');
      var sag = 0, lump = 0, dips = 0;
      S.done.forEach(function (L) { sag += L.sag; lump += L.lumps; dips += L.dips; });
      if (sag / dips > 0.2) lines.push('The feet are <b>thick and dripping</b>: too many rounds went in before the last coat had set.');
      else if (lump / dips > 0.25) lines.push('The coats are <b>ridged and lumpy</b>: the tallow was kept too near its setting point.');
      else lines.push('The candles are smooth and straight, and they burn without guttering.');
      if (scorchMax > 1) lines.push('The tallow got hot enough to smoke, and the candles came out <b>dark</b>; they sell for less.');
    }
    if (early && S.t < day.deadline) lines.push('Done with ' + Math.round(day.deadline - S.t) + ' minutes to spare before the carrier.');
    v.innerHTML = '<p>' + lines.join(' ') + '</p><p>The shop clears <b>' + money(profit) + '</b> on the day.</p>';

    var rows = [
      [o.name + ' that pass', lbs(lbGood), money(revGood)],
      ['light or heavy, sold as seconds', lbs(lbOff), money(revOff)],
      [day.tallow.name, lbs(lbAll), 'minus ' + money(tallowCost)]
    ];
    if (day.duty) rows.push(['excise on candles, a penny a pound', lbs(lbAll), 'minus ' + money(duty)]);
    rows.push(['the chandler and the boy, ' + (S.t / 60).toFixed(1) + ' hours', '', 'minus ' + money(wages)]);
    rows.push(['coal under the vat', '', 'minus ' + money(coal)]);
    reveal(rows, profit);
    $('bAgain').style.display = '';
    hud(); draw();
  }

  function reveal(rows, profit) {
    var R = $('reveal');
    R.style.display = '';
    var html = '<h5>The vat and the room, through the day</h5>' +
      '<canvas id="trace" width="640" height="240" aria-label="The vat temperature, the room temperature and the candle surface, against the time of day."></canvas>' +
      '<div class="key"><span><i style="background:#ffb27a"></i>tallow in the vat</span><span><i style="background:rgba(242,211,107,.35);height:8px"></i>just running</span>' +
      '<span><i style="background:#c9ced6"></i>candle surface</span><span><i style="background:#7aa2ff"></i>the room</span><span><i style="background:#64f0c8"></i>set hard below this</span></div>' +
      '<p>Marks along the bottom: C a wheel cut down. The candle surface jumps at every dip and cools between; a dip taken while it is above the green line melts the last coat.</p>' +
      '<h5>The candles on the buyer’s scale</h5>' +
      '<canvas id="weights" width="640" height="170" aria-label="How the candles from each wheel are spread across weights, against the weight the order wanted."></canvas>' +
      '<p>Each wheel’s candles spread around their average weight; ridges and sagging feet spread them wider. The shaded band is what passes as ' + day.order.name + '.</p>' +
      '<h5>The account</h5><table class="card">';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n">' + r[2] + '</td></tr>';
    });
    html += '<tr class="tot"><td>Cleared</td><td class="n"></td><td class="n">' + money(profit) + '</td></tr></table>';
    R.innerHTML = html;
    drawTrace($('trace'));
    drawWeights($('weights'));
  }

  function drawTrace(cv) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    var L = 44, Rr = 16, T0 = 14, B = 34;
    var tr = S.trace.length ? S.trace : [{ t: 0, T: S.T, amb: ambAt(day, 0), sf: null }];
    var tmax = Math.max(day.deadline, tr[tr.length - 1].t);
    var tm = day.tallow.tm;
    var lo = Math.floor((ambAt(day, 0) - 10) / 20) * 20, hi = Math.max(tm + 60, 200);
    function X(t) { return L + (W - L - Rr) * t / tmax; }
    function Y(v) { return T0 + (H - T0 - B) * (1 - (clamp(v, lo, hi) - lo) / (hi - lo)); }
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(242,211,107,.13)';
    c.fillRect(L, Y(tm + 22), W - L - Rr, Y(tm + 8) - Y(tm + 22));
    c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#8b97ab';
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; c.textAlign = 'right';
    for (var v = lo; v <= hi; v += 20) {
      c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - Rr, Y(v)); c.stroke();
      c.fillText(v + '°', L - 6, Y(v) + 3);
    }
    c.textAlign = 'center';
    for (var h = 0; h * 60 <= tmax; h += 2) c.fillText(clockOf(h * 60).replace(':00', ''), X(h * 60), H - B + 14);
    // set-hard line
    c.strokeStyle = 'rgba(100,240,200,.6)'; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(L, Y(readyThreshold(day))); c.lineTo(W - Rr, Y(readyThreshold(day))); c.stroke();
    c.setLineDash([]);
    function line(key, col, w) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      var pen = false;
      tr.forEach(function (p) {
        if (p[key] == null) { pen = false; return; }
        if (!pen) c.moveTo(X(p.t), Y(p[key])); else c.lineTo(X(p.t), Y(p[key]));
        pen = true;
      });
      c.stroke();
    }
    line('amb', '#7aa2ff', 1.5);
    line('sf', 'rgba(201,206,214,.7)', 1);
    line('T', '#ffb27a', 2);
    c.fillStyle = '#e8edf5'; c.font = '600 10px ui-monospace,Menlo,monospace';
    S.events.forEach(function (e) { c.fillText('C', X(e.t), H - 6); });
    // the carrier
    c.strokeStyle = 'rgba(255,178,122,.6)'; c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(X(day.deadline), T0); c.lineTo(X(day.deadline), H - B); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#8b97ab'; c.textAlign = 'right'; c.fillText('carrier', X(day.deadline) - 4, T0 + 10);
  }

  function drawWeights(cv) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    var L = 20, Rr = 20, T0 = 12, B = 30;
    var tw = day.tw, lo = tw * 0.55, hi = tw * 1.45;
    function X(w) { return L + (W - L - Rr) * (w - lo) / (hi - lo); }
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(242,211,107,.13)';
    c.fillRect(X(tw * (1 - TOL)), T0, X(tw * (1 + TOL)) - X(tw * (1 - TOL)), H - T0 - B);
    c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#8b97ab'; c.textAlign = 'center';
    for (var k = -3; k <= 3; k++) {
      var w = tw * (1 + k * 0.125);
      c.fillText(oz(w), X(w), H - B + 14);
    }
    var cols = ['#64f0c8', '#ffb27a', '#7aa2ff', '#f2d36b'];
    var peak = 0;
    S.done.forEach(function (Ld) { peak = Math.max(peak, 1 / (Ld.sig * Ld.mean)); });
    if (!S.done.length) { c.fillText('no wheels were cut down', W / 2, H / 2); return; }
    S.done.forEach(function (Ld, i) {
      c.strokeStyle = cols[i % 4]; c.lineWidth = 2; c.beginPath();
      for (var px = 0; px <= W - L - Rr; px += 2) {
        var wv = lo + (hi - lo) * px / (W - L - Rr);
        var z = (Math.log(wv / Ld.mean)) / Ld.sig;
        var dens = Math.exp(-z * z / 2) / (Ld.sig * wv);
        var y = H - B - (H - T0 - B - 6) * dens / peak;
        if (px === 0) c.moveTo(L + px, y); else c.lineTo(L + px, y);
      }
      c.stroke();
      c.fillStyle = cols[i % 4]; c.textAlign = 'left';
      c.fillText('wheel ' + (i + 1) + ' · ' + Math.round(Ld.sp.ok * 100) + '% pass', L + 6, T0 + 12 + i * 13);
    });
  }

  /* ---------- the room ---------- */
  function draw() {
    var c = ctx, W = canvas.width, H = canvas.height, t = performance.now() / 1000;
    var running = S.phase === 'run';
    var amb = ambAt(day, S.t), hour = (START + S.t) / 60;
    // wall
    c.fillStyle = '#1d1712'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#16110d'; c.fillRect(0, 280, W, 60);
    // window: the sky through the day
    var light = clamp(Math.sin((hour - 6) / 12 * Math.PI) * (0.7 + 0.3 * (1 - day.winter)), 0, 1);
    var sky = 'rgb(' + Math.round(40 + 120 * light) + ',' + Math.round(50 + 130 * light) + ',' + Math.round(70 + 140 * light) + ')';
    c.fillStyle = sky; c.fillRect(24, 30, 76, 96);
    c.strokeStyle = '#3d3226'; c.lineWidth = 4; c.strokeRect(24, 30, 76, 96);
    c.lineWidth = 2; c.beginPath(); c.moveTo(62, 30); c.lineTo(62, 126); c.moveTo(24, 78); c.lineTo(100, 78); c.stroke();
    c.fillStyle = 'rgba(255,240,200,' + (0.05 * light) + ')';
    c.beginPath(); c.moveTo(24, 126); c.lineTo(100, 126); c.lineTo(220, 280); c.lineTo(60, 280); c.closePath(); c.fill();

    // the vat and its fire
    var vx = 168, vw = 230, vy = 226, vh = 50;
    var glow = S.fire / 100;
    c.fillStyle = '#2a2420'; c.fillRect(vx - 14, vy + vh, vw + 28, 30);
    c.fillStyle = 'rgba(255,' + Math.round(110 + 60 * glow) + ',40,' + (0.25 + 0.6 * glow) * (0.85 + 0.15 * Math.sin(t * 7)) + ')';
    c.fillRect(vx + 60, vy + vh + 8, vw - 120, 16);
    c.fillStyle = '#3b3530'; c.fillRect(vx - 6, vy, vw + 12, vh);
    var x = S.T - day.tallow.tm;
    var melt = clamp((x + 4) / 20, 0, 1), dk = clamp(S.scorch / 4, 0, 0.5);
    var wh = day.tallow.white;
    var tallowCol = 'rgb(' + Math.round((236 - 40 * (1 - wh)) * (1 - dk)) + ',' + Math.round((222 - 60 * (1 - wh)) * (1 - dk)) + ',' + Math.round((170 - 70 * (1 - wh) + 30 * (1 - melt)) * (1 - dk)) + ')';
    // smoke over a too-hot vat
    if (x > 40) {
      for (var j = 0; j < 12; j++) {
        var d1 = dots[j + 20], kk = (t * 0.25 + d1.k) % 1;
        c.fillStyle = 'rgba(180,170,160,' + (0.18 * (1 - kk) * clamp((x - 40) / 20, 0, 1)) + ')';
        c.beginPath(); c.arc(vx + d1.x * vw + Math.sin(t + j) * 6, vy - kk * 90, 5 + kk * 16, 0, Math.PI * 2); c.fill();
      }
    }

    // the rod of candles: it goes down into the vat at each dip
    var n = 9, len = day.order.len * 10.5, pxmm = Math.min(1.5, (vw - 24) / (n - 1) / (2 * day.rTarget * 1.25));
    var dipY = S.anim > 0 ? Math.sin(S.anim * Math.PI) * 52 : 0;
    var rodY = vy - len - 26 + dipY;
    c.fillStyle = '#6b4f33'; c.fillRect(vx - 30, rodY - 4, vw + 60, 6);
    c.fillStyle = '#4a3a2a'; c.fillRect(vx - 34, 10, 6, rodY - 6); c.fillRect(vx + vw + 28, 10, 6, rodY - 6);
    var showR = S.busy > 0 ? WICK : S.r;
    var sig = sigma(S), sagF = S.dips ? S.sag / S.dips : 0, lumpF = S.dips ? S.lumps / S.dips : 0;
    var col = 'rgb(' + Math.round((240 - 30 * (1 - wh)) * (1 - clamp(S.scorch / 6, 0, 0.4))) + ',' + Math.round((232 - 50 * (1 - wh)) * (1 - clamp(S.scorch / 6, 0, 0.4))) + ',' + Math.round((200 - 70 * (1 - wh)) * (1 - clamp(S.scorch / 6, 0, 0.4))) + ')';
    for (var i = 0; i < n; i++) {
      var cx = vx + 12 + i * (vw - 24) / (n - 1);
      var rr = showR * (1 + (dots[i].k - 0.5) * sig * 1.2) * pxmm;
      c.strokeStyle = '#d8d2c0'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx, rodY); c.lineTo(cx, rodY + 10); c.stroke();
      if (showR > WICK + 0.05) {
        c.fillStyle = col;
        c.beginPath();
        var top = rodY + 10, bot = top + len, foot = rr * (1 + sagF * 0.9);
        c.moveTo(cx - rr * 0.8, top);
        var segs = 8;
        for (var s = 0; s <= segs; s++) {
          var yy = top + (bot - top) * s / segs, ww = rr * (0.8 + 0.2 * Math.min(1, s / 2)) + (foot - rr) * (s / segs) * (s / segs);
          ww += lumpF * 2.2 * Math.sin(s * 2.3 + i);
          c.lineTo(cx - ww, yy);
        }
        for (var s2 = segs; s2 >= 0; s2--) {
          var yy2 = top + (bot - top) * s2 / segs, ww2 = rr * (0.8 + 0.2 * Math.min(1, s2 / 2)) + (foot - rr) * (s2 / segs) * (s2 / segs);
          ww2 += lumpF * 2.2 * Math.sin(s2 * 2.3 + i + 1);
          c.lineTo(cx + ww2, yy2);
        }
        c.closePath(); c.fill();
        if (sagF > 0.25) { c.beginPath(); c.arc(cx, bot + 2, foot * 0.55, 0, Math.PI * 2); c.fill(); }
        // soft coats shine
        if (running && S.lastDip >= 0 && surface(S.t) > readyThreshold(day)) {
          c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(cx - rr * 0.5, top + 4, Math.max(1, rr * 0.3), len - 8);
        }
      } else {
        c.beginPath(); c.moveTo(cx, rodY + 10); c.lineTo(cx, rodY + 10 + len); c.stroke();
      }
    }

    // the tallow in the vat, drawn over the feet of the candles when they go down into it
    c.fillStyle = tallowCol;
    c.fillRect(vx, vy + 8, vw, vh - 12);
    if (melt > 0.5) {
      c.fillStyle = 'rgba(255,255,255,' + (0.12 * melt) + ')';
      c.fillRect(vx, vy + 8, vw, 3);
    } else {
      c.fillStyle = 'rgba(160,140,100,.5)';
      for (var sk = 0; sk < 10; sk++) c.fillRect(vx + 8 + dots[sk].x * (vw - 30), vy + 9, 14 + dots[sk].k * 20, 2);
    }
    c.fillStyle = '#3b3530'; c.fillRect(vx - 6, vy + vh - 4, vw + 12, 4);

    // the room thermometer
    var tx = 128, ttop = 40, tbot = 128;
    function TY(v) { return tbot - (tbot - ttop) * (clamp(v, 20, 100) - 20) / 80; }
    c.fillStyle = '#2b2520'; c.fillRect(tx - 7, ttop - 6, 14, tbot - ttop + 18);
    c.fillStyle = '#c0392b'; c.fillRect(tx - 1.5, TY(amb), 3, tbot - TY(amb));
    c.beginPath(); c.arc(tx, tbot + 5, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8b97ab'; c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText('ROOM ' + Math.round(amb) + '°', tx, tbot + 24);

    // the vat thermometer
    c.fillText('VAT ' + Math.round(S.T) + '°', vx + vw / 2, vy + vh + 50);

    // the scale on the bench and the boxes of finished candles
    var bx = 452;
    c.fillStyle = '#3d3226'; c.fillRect(bx, 210, 172, 8);
    c.fillStyle = '#4a3a2a'; c.fillRect(bx + 6, 218, 6, 62); c.fillRect(bx + 160, 218, 6, 62);
    // balance
    var tilt = 0;
    if (S.weighed) tilt = clamp((S.weighed.w / day.tw - 1) * 2.5, -0.25, 0.25);
    var px0 = bx + 60;
    c.strokeStyle = '#b08d57'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px0, 210); c.lineTo(px0, 158); c.stroke();
    c.save(); c.translate(px0, 158); c.rotate(tilt);
    c.beginPath(); c.moveTo(-40, 0); c.lineTo(40, 0); c.stroke();
    c.beginPath(); c.moveTo(-40, 0); c.lineTo(-40, 26); c.moveTo(40, 0); c.lineTo(40, 26); c.stroke();
    c.fillStyle = '#b08d57'; c.fillRect(-52, 26, 24, 3); c.fillRect(28, 26, 24, 3);
    if (S.weighed) { c.fillStyle = col; c.fillRect(-50, 22, 20, 4); }
    c.fillStyle = '#8a8070'; c.fillRect(34, 20, 12, 6);
    c.restore();
    c.fillStyle = '#8b97ab'; c.textAlign = 'center';
    c.fillText(S.weighed ? oz(S.weighed.w) : 'SCALE', px0, 146);
    c.fillText('WANT ' + oz(day.tw), px0, 134);
    // boxes
    for (var b = 0; b < day.loads; b++) {
      var bxx = bx + 112 + (b % 2) * 28, byy = 192 - Math.floor(b / 2) * 20;
      c.strokeStyle = '#6b5a44'; c.lineWidth = 1; c.strokeRect(bxx, byy, 24, 16);
      if (b < S.done.length) { c.fillStyle = '#8a6d48'; c.fillRect(bxx, byy, 24, 16); c.fillStyle = col; c.fillRect(bxx + 3, byy + 3, 18, 3); }
    }
    c.fillText('BOXES ' + S.done.length + '/' + day.loads, bx + 138, 232);

    // the carrier
    c.textAlign = 'left';
    c.fillText('CARRIER ' + clockOf(day.deadline).toUpperCase(), bx, 262);
    c.fillText('ORDER ' + day.dozen + ' DOZ ' + day.order.name.toUpperCase(), bx, 276);
    c.fillText('FIRE ' + fireText(S.fire).toUpperCase(), bx, 30);
    c.fillText('CLOCK ' + clockOf(S.t).toUpperCase(), bx, 44);
    if (S.busy > 0 && running) {
      c.fillStyle = '#e8edf5'; c.textAlign = 'center'; c.font = '600 10px ui-monospace,Menlo,monospace';
      c.fillText('HANGING FRESH WICKS · ' + Math.ceil(S.busy) + ' MIN', vx + vw / 2, 22);
    }
  }

  /* ---------- keys and days ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (!S || S.phase !== 'run') return;
    if (e.code === 'ArrowUp') { e.preventDefault(); setFire(S.fire + 2); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); setFire(S.fire - 2); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); setWait(S.wait + 0.5); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); setWait(S.wait - 0.5); }
    else if (e.code === 'KeyW') doWeigh();
    else if (e.code === 'KeyC') doCut();
    else if (e.code === 'Space') { e.preventDefault(); $('bPause').click(); }
  });
  $('bAgain').addEventListener('click', function () { fresh(); });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  // keep the fire flickering while the page waits to start
  function idle() { if (S && S.phase !== 'run') draw(); requestAnimationFrame(idle); }

  loadDay(0);
  requestAnimationFrame(idle);
})();
