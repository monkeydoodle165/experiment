/* drift.quibo.games — The Dairy
   A farmhouse dairy on a churning morning between 1820 and 1899, on today's calendar date. The day's number picks
   the farm (and how mild its dairy keeps), the herd (which sets how easily the cream churns and how yellow the butter
   is), how many gallons of cream have been saved, how ripe it has got, what the butter is fetching, and the order:
   fresh rolls for a town market, a lightly salted print for a grocer, or a well salted firkin to keep.

   The season sets the best churning temperature: winter butterfat is harder and wants the cream several degrees
   warmer. Churning progress G rises at a rate that grows steeply with warmth around that best temperature, with the
   ripeness of the cream, the herd, and the pace of the churn (too fast and the cream rides round with the barrel).
     G < 0.35  thin, sloshing        G < 0.72  thick, heavy and quiet     G < 0.82  breaking
     G < 0.93  pinhead grains         G < 1.07  grains like wheat (stop)   G < 1.20  peas     beyond: lumps
   Gas builds in the first minutes and must be let out of the vent plug. Turning warms the cream a little; the dairy
   pulls it back toward its own temperature.
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
    var h = s ^ 0x0b077e12;
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
    d = Math.max(0, Math.round(d));
    var l = Math.floor(d / 240), s = Math.floor((d % 240) / 12), p = d % 12;
    var out = [];
    if (l) out.push('£' + l);
    if (s) out.push(s + 's');
    if (p || !out.length) out.push(p + 'd');
    return out.join(' ');
  }
  function deg(t) { return t.toFixed(1) + '°F'; }

  /* ---------- the world ---------- */
  var FARMS = [
    { place: 'Epping', county: 'Essex', mild: 0.5, market: 'Leadenhall Market' },
    { place: 'Cottenham', county: 'Cambridgeshire', mild: 0, market: 'Cambridge market, sold by the yard' },
    { place: 'Sturminster Newton', county: 'Dorset', mild: 1.2, market: 'the London dealers in Dorset butter' },
    { place: 'Mallow', county: 'County Cork', mild: 1.5, market: 'the Cork Butter Exchange' },
    { place: 'Llandeilo', county: 'Carmarthenshire', mild: 1, market: 'Carmarthen market' },
    { place: 'Ulverston', county: 'Lancashire', mild: 0.3, market: 'Ulverston market' },
    { place: 'Ashbourne', county: 'Derbyshire', mild: -0.8, market: 'Ashbourne butter cross' },
    { place: 'Nantwich', county: 'Cheshire', mild: 0, market: 'Nantwich market' },
    { place: 'Kendal', county: 'Westmorland', mild: -0.6, market: 'Kendal market hall' },
    { place: 'Aylesbury', county: 'Buckinghamshire', mild: 0.4, market: 'the London trade, by the carrier' },
    { place: 'Castle Douglas', county: 'Kirkcudbrightshire', mild: -0.4, market: 'Castle Douglas market' },
    { place: 'St Columb', county: 'Cornwall', mild: 2, market: 'Truro market' }
  ];
  var HERDS = [
    { name: 'Shorthorns', k: 0.95, dt: 0.5, fat: 0, yellow: 0.35, note: 'big roan Shorthorns, more milk than cream' },
    { name: 'Alderneys', k: 1.25, dt: -1.5, fat: 0.04, yellow: 1, note: 'little fawn Alderneys from the Channel Islands, whose cream is thick and churns easily' },
    { name: 'Guernseys', k: 1.2, dt: -1, fat: 0.03, yellow: 1, note: 'Guernseys, whose butter is the colour of a primrose even in winter' },
    { name: 'Ayrshires', k: 0.8, dt: 1.5, fat: -0.01, yellow: 0.3, note: 'Ayrshires, whose cream has small globules and is slow to come' },
    { name: 'North Devons', k: 1.05, dt: 0, fat: 0.01, yellow: 0.6, note: 'red North Devons, good butter cows' },
    { name: 'Kerries', k: 0.95, dt: 0.5, fat: 0, yellow: 0.5, note: 'small black Kerries that live on rough grazing' },
    { name: 'Longhorns', k: 1, dt: 0, fat: 0.01, yellow: 0.5, note: 'old-fashioned Longhorns, kept for the dairy' }
  ];
  var ORDERS = [
    { name: 'fresh rolls', salt: 0.1, text: 'fresh butter in pound rolls for the market, hardly salted at all' },
    { name: 'light salt prints', salt: 0.35, text: 'pound prints for the grocer, lightly salted' },
    { name: 'half-salt', salt: 0.5, text: 'half-salt butter in a crock for the house in town' },
    { name: 'a keeping firkin', salt: 0.8, text: 'a firkin to keep, well salted, packed hard' }
  ];

  var WELL = 50;        // well water, °F
  var THICK = 0.35, BREAK = 0.72, PIN = 0.82, WHEAT = 0.93, PEAS = 1.07, LUMPS = 1.2;
  var GIVEUP = 180;     // minutes

  function makeDay(off) {
    var d = dateFor(off), seed = seedForDate(d), r = rng(seed);
    var farm = pick(r, FARMS), herd = pick(r, HERDS);
    var year = 1820 + Math.floor(r() * 80);
    var start = new Date(d.getFullYear(), 0, 1);
    var doy = Math.round((d - start) / 864e5);
    var winter = (Math.cos((doy - 15) / 365.25 * 2 * Math.PI) + 1) / 2;   // 1 in mid January, 0 in mid July
    var room = 63 - 16 * winter + farm.mild + (r() - 0.5) * 3;
    var topt = 56.5 + 6 * winter + herd.dt + (r() - 0.5) * 1.6;
    var gallons = 2 + Math.floor(r() * 5);
    var fat = 0.3 + r() * 0.08 + herd.fat;
    var ripe = 0.55 + r() * 0.9;
    var crock = room - 1 + r() * 2;
    var order = pick(r, ORDERS);
    var price = 10 + r() * 6 + winter * 3 + (year > 1870 ? -1 : 0);   // pence a pound, dearer in winter
    return {
      off: off, date: d, farm: farm, herd: herd, year: year, winter: winter, room: room, topt: topt,
      gallons: gallons, fat: fat, ripe: ripe, crock: crock, order: order, price: price, seed: seed,
      wd: WEEKDAYS[d.getDay()], dateText: d.getDate() + ' ' + MONTHS[d.getMonth()]
    };
  }

  function ripeText(x) {
    if (x < 0.75) return 'sweet, hardly turned: it will be slow and flat in flavour';
    if (x < 0.88) return 'just turning sour, a shade under-ripe';
    if (x <= 1.12) return 'nicely sour, smelling clean and nutty, just right';
    if (x <= 1.28) return 'sharp, a day over-ripe';
    return 'sharp and over-ripe, close to cheesy';
  }
  function stageOf(G) {
    if (G < THICK) return { key: 'thin', text: 'thin cream, sloshing' };
    if (G < BREAK) return { key: 'thick', text: 'thick, swollen, heavy' };
    if (G < PIN) return { key: 'break', text: 'breaking' };
    if (G < WHEAT) return { key: 'pin', text: 'grains like pinheads' };
    if (G < PEAS) return { key: 'wheat', text: 'grains like wheat' };
    if (G < LUMPS) return { key: 'peas', text: 'grains like peas' };
    return { key: 'lumps', text: 'lumps, gathering' };
  }
  function soundOf(G, turning) {
    if (!turning) return 'still';
    if (G < 0.2) return 'a free slosh';
    if (G < THICK) return 'a softer slosh';
    if (G < BREAK) return 'a dull thud, heavy';
    if (G < PIN) return 'a sudden splash';
    if (G < PEAS) return 'splash and patter';
    return 'a lump thumping';
  }

  /* ---------- state ---------- */
  var day, S;
  var dayOff = 0;
  var canvas = $('room'), ctx = canvas.getContext('2d');
  var specks = (function () {
    var r = rng(77), a = [];
    for (var i = 0; i < 140; i++) a.push({ x: r() * 2 - 1, y: r() * 2 - 1, s: 0.6 + r() * 0.8, p: r() * 6.28 });
    return a;
  })();

  function fresh() {
    S = {
      phase: 'temper', T: day.crock, G: 0, P: 0, min: 0, turning: false, pace: 50, speed: 1,
      angle: 0, crank: 0, fatLb: day.gallons * 10.3 * day.fat, blown: 0, blowFlash: 0,
      warmPours: 0, breakWater: 0, vents: 0, tBreak: null, tAtBreak: null, events: [], trace: [],
      washes: 0, passes: 0, salt: 0, bm: 1, soft: 0, grain: 0, loss: 0, lastHalf: 0
    };
    $('pTemper').style.display = '';
    $('pChurn').style.display = 'none';
    $('pMake').style.display = 'none';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    $('pace').value = 50; $('salt').value = 0; $('saltOut').textContent = 'none';
    $('bTurn').textContent = 'Rest your arm';
    say('The cream has come up from the cellar shelf in its crock at <b>' + deg(day.crock) + '</b>. Bring it to the warmth you think right, then pour it in.');
    hud(); draw();
  }

  function loadDay(off) {
    dayOff = off;
    day = makeDay(off);
    var h = day.herd, f = day.farm;
    $('rWho').textContent = day.wd + ' ' + day.dateText + ' ' + day.year + ' · ' + f.place + ', ' + f.county;
    $('rName').textContent = day.gallons + ' gallons of cream from a herd of ' + h.name;
    $('rBlurb').innerHTML = 'The herd are ' + h.note + '. The cream is three or four days\' skimmings, and it is <b>' +
      ripeText(day.ripe) + '</b>. The dairy is standing at <b>' + deg(day.room) + '</b> this morning. The order is <b>' +
      day.order.text + '</b>, for ' + f.market + ', where good butter is fetching <b>' + money(day.price) + '</b> a pound.';
    $('rBook').innerHTML = '“In summer, churn at 56 to 58 degrees; in winter, when the cows are on dry food and the fat is hard, at ' +
      '60 to 64. Alderney and Guernsey cream will come a degree or two cooler, Ayrshire wants it warmer. Stop when the grains are ' +
      'the size of wheat.” — the dairy book on the shelf';
    var lbl = off === 0 ? 'Today’s' : off === -1 ? 'Yesterday’s' : off === 1 ? 'Tomorrow’s' : (off > 0 ? '+' : '') + off + ' days';
    $('dayOut').textContent = lbl + ' churning · ' + day.dateText;
    fresh();
  }

  function say(html) { $('msg').innerHTML = html; }

  function clockText() {
    var m = 6 * 60 + Math.round(S.min);
    var hh = Math.floor(m / 60), mm = m % 60;
    var ap = hh >= 12 ? 'pm' : 'am';
    var h12 = hh > 12 ? hh - 12 : hh;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap + (S.phase === 'temper' ? '' : ' · ' + Math.floor(S.min) + ' min');
  }

  function hud() {
    $('hWhen').textContent = clockText();
    $('hTemp').textContent = deg(S.T);
    $('hRoom').textContent = deg(day.room);
    $('hStage').textContent = S.phase === 'temper' ? 'nothing yet' : S.phase === 'churn' ? stageOf(S.G).text : 'butter, drawn';
    $('hSound').textContent = S.phase === 'churn' ? soundOf(S.G, S.turning) : '—';
    var p = S.P, pl = S.phase !== 'churn' ? '—' : p < 0.3 ? 'quiet' : p < 0.6 ? 'a faint hiss' : p < 0.85 ? 'hissing hard' : 'straining!';
    $('hPlug').textContent = pl;
    $('hPlugBox').className = S.phase === 'churn' && p >= 0.6 ? 'alarm' : '';
    $('hCream').textContent = day.gallons + ' gal · ' + Math.round(day.fat * 100) + '% fat';
    $('hOrder').textContent = day.order.name;
    if (S.phase === 'churn') {
      $('bBreak').disabled = S.G < BREAK || S.breakWater >= 2;
      $('bHot').disabled = S.warmPours >= 4;
    }
  }

  /* ---------- tempering ---------- */
  $('bWarm').addEventListener('click', function () {
    S.T = Math.min(S.T + 2, 80);
    say('The crock stands in a pail of hot water while you stir. The cream is at <b>' + deg(S.T) + '</b>.');
    hud(); draw();
  });
  $('bCool').addEventListener('click', function () {
    if (S.T - 2 < WELL + 1) { S.T = Math.max(WELL + 1, S.T - 0.5); say('Well water will not take it much below ' + (WELL + 1) + '°. The cream is at <b>' + deg(S.T) + '</b>.'); }
    else { S.T -= 2; say('The crock stands in the trough of running well water. The cream is at <b>' + deg(S.T) + '</b>.'); }
    hud(); draw();
  });
  $('bPour').addEventListener('click', function () {
    S.phase = 'churn'; S.turning = true; S.tPour = S.T;
    S.events.push({ t: 0, k: 'start' });
    $('pTemper').style.display = 'none';
    $('pChurn').style.display = '';
    say('The cream goes into the scalded churn at <b>' + deg(S.T) + '</b>, the lid is screwed down, and you take the handle. ' +
      'Listen to it. Mind the vent plug in the first few minutes.');
    hud(); last = 0; requestAnimationFrame(loop);
  });

  /* ---------- churning ---------- */
  function paceF(p) {
    if (p <= 60) return p / 50;
    return Math.max(0.15, 1.2 - (p - 60) * 0.035);
  }
  function rate() {
    var ripeF = 0.7 + 0.35 * day.ripe;
    return 0.026 * Math.exp((S.T - day.topt) / 4.2) * paceF(S.pace) * day.herd.k * ripeF * Math.sqrt(day.fat / 0.34);
  }

  function step(dt) {
    var wasStage = stageOf(S.G).key;
    if (S.turning) {
      S.G += rate() * dt;
      var gas = 0.16 * day.ripe * Math.exp(-S.min / 7) * (1 + (S.T - 55) / 30);
      S.P += Math.max(0, gas) * dt;
      S.T += 0.0006 * S.pace * dt;
    }
    S.T += (day.room - S.T) * 0.006 * dt;
    S.min += dt;
    if (S.P >= 1) {
      S.P = 0; S.blown++; S.blowFlash = 1;
      S.fatLb *= 0.92;
      S.events.push({ t: S.min, k: 'blow' });
      say('<b>Bang.</b> The gas blows the lid seal and a spray of cream goes over the flags. Pull the plug sooner next time: ' +
        'ripe cream gives off gas in the first quarter of an hour.');
    }
    var st = stageOf(S.G).key;
    if (st !== wasStage) {
      if (st === 'thick') say('The churn has gone <b>heavy</b>. The slosh has turned to a dull thud as the cream swells with air. Keep on.');
      else if (st === 'break') { S.tBreak = S.min; S.tAtBreak = S.T; S.events.push({ t: S.min, k: 'break' }); say('There. <b>It has broken.</b> The thud turns to a splash, and through the glass the foam has fallen into specks of butter in thin blue buttermilk. A little cold breaking water now firms the grains.'); }
      else if (st === 'pin') say('Grains like <b>pinheads</b>. Too small yet: they would run out through the strainer.');
      else if (st === 'wheat') say('Grains the size of <b>wheat</b>. This is when the book says to stop.');
      else if (st === 'peas') say('Grains like <b>peas</b> now. You are past the best; buttermilk is getting locked inside them.');
      else if (st === 'lumps') say('It is <b>gathering into lumps</b>. They will hold buttermilk that no washing will get out.');
    }
    if (S.min >= GIVEUP && S.G < BREAK) {
      S.turning = false;
      finishChurn(true);
    }
  }

  var last = 0, acc = 0;
  function loop(ts) {
    if (S.phase !== 'churn') return;
    if (!last) last = ts;
    var dms = Math.min(100, ts - last); last = ts;
    var mins = dms / 600 * S.speed;     // one churn minute is 0.6 s at the slow clock
    acc += mins;
    while (acc > 0.05) { step(0.05); acc -= 0.05; if (S.phase !== 'churn') break; }
    if (S.turning) {
      S.angle += S.pace / 60 * 2 * Math.PI * dms / 1000 * Math.min(S.speed, 1.6) * 0.5;
      var half = Math.floor(S.angle / Math.PI);
      if (half !== S.lastHalf) { S.lastHalf = half; thump(); }
    }
    if (Math.floor(S.min) > S.trace.length - 1) S.trace.push({ t: S.min, T: S.T, G: S.G, P: S.P, on: S.turning });
    if (S.blowFlash > 0) S.blowFlash = Math.max(0, S.blowFlash - dms / 900);
    hud(); draw();
    if (S.phase === 'churn') requestAnimationFrame(loop);
  }

  function toggleTurn() {
    if (S.phase !== 'churn') return;
    S.turning = !S.turning;
    $('bTurn').textContent = S.turning ? 'Rest your arm' : 'Take the handle again';
    if (!S.turning) say('You rest. The cream sits and drifts toward the warmth of the dairy, <b>' + deg(day.room) + '</b>.');
  }
  $('bTurn').addEventListener('click', toggleTurn);
  $('bSpeed').addEventListener('click', function () {
    S.speed = S.speed === 1 ? 3 : 1;
    this.textContent = S.speed === 1 ? 'Faster clock' : 'Slower clock';
  });
  function setPace(v) {
    S.pace = clamp(Math.round(v), 20, 90);
    $('pace').value = S.pace;
    $('paceOut').textContent = S.pace + ' a min';
    if (S.pace > 70 && S.phase === 'churn') say('At ' + S.pace + ' turns a minute the cream is <b>riding round with the barrel</b> instead of falling from end to end. Faster is slower.');
  }
  $('pace').addEventListener('input', function () { setPace(+this.value); });
  function vent() {
    if (S.phase !== 'churn') return;
    S.vents++;
    S.events.push({ t: S.min, k: 'vent' });
    say(S.P > 0.3 ? 'You stop, tip the churn and pull the plug. <b>Pssht.</b> The gas goes out with a smell of sour cream.' :
      'You pull the plug. Hardly a breath comes out.');
    S.P = 0; hud();
  }
  $('bVent').addEventListener('click', vent);
  $('bHot').addEventListener('click', function () {
    if (S.warmPours >= 4) return;
    S.warmPours++; S.T += 2.5;
    S.events.push({ t: S.min, k: 'warm' });
    say('A jug of warm water into the cream. It is at <b>' + deg(S.T) + '</b>, a little thinner, and the flavour a little poorer for it.');
    hud();
  });
  $('bBreak').addEventListener('click', function () {
    if (S.G < BREAK || S.breakWater >= 2) return;
    S.breakWater++; S.T = Math.max(WELL + 1, S.T - 3);
    S.events.push({ t: S.min, k: 'water' });
    say('A jug of cold well water to break it. The grains firm and stop growing so fast; the cream is at <b>' + deg(S.T) + '</b>.');
    hud();
  });
  $('bStop').addEventListener('click', function () {
    if (S.phase !== 'churn') return;
    if (S.G < BREAK) { say('There is <b>no butter in it yet</b>. Drawing the plug now would only pour away the cream.'); return; }
    finishChurn(false);
  });

  function finishChurn(failed) {
    S.turning = false;
    S.trace.push({ t: S.min, T: S.T, G: S.G, P: S.P, on: false });
    S.events.push({ t: S.min, k: 'stop' });
    if (failed) {
      S.phase = 'done';
      $('pChurn').style.display = 'none';
      say('');
      var v = $('verdict');
      v.className = 'verdict warn';
      v.innerHTML = '<p><b>It would not come.</b> Three hours of turning and the cream is still ' + stageOf(S.G).text +
        ' at ' + deg(S.T) + '. The old women of ' + day.farm.place + ' would have said the churn was overlooked and dropped a hot ' +
        'horseshoe in it. The trouble was the warmth: this cream wanted to be near <b>' + deg(day.topt) + '</b>.</p>';
      reveal(null);
      $('bAgain').style.display = '';
      draw();
      return;
    }
    S.phase = 'make';
    S.grain = S.G;
    var tTex = S.tAtBreak == null ? S.T : S.tAtBreak * 0.6 + S.T * 0.4;
    S.soft = tTex - day.topt;
    S.loss = 0.008 + 0.02 * Math.max(0, S.soft - 0.5) + (S.G < WHEAT ? (WHEAT - S.G) * 0.6 : 0) + (S.G < PIN ? (PIN - S.G) * 2.5 : 0);
    S.loss = clamp(S.loss, 0.005, 0.6);
    S.bm = S.G < PEAS ? 1 : 1 + (S.G - PEAS) * 12;
    S.bm = Math.min(S.bm, 3.2);
    $('pChurn').style.display = 'none';
    $('pMake').style.display = '';
    say('The buttermilk runs out through the hair sieve. You have <b>' + stageOf(S.G).text + '</b> lying in the churn, churned at about <b>' +
      deg(tTex) + '</b>. Now wash it, salt it and work it.');
    hud(); draw();
  }

  /* ---------- making up ---------- */
  function workLimit() { return Math.max(4, 9 - Math.max(0, S.soft) * 1.2); }
  $('bWash').addEventListener('click', function () {
    if (S.phase !== 'make') return;
    if (S.washes >= 4) { say('Four washes is plenty. The water is running clear.'); return; }
    S.washes++;
    S.bm *= S.grain >= LUMPS ? 0.72 : 0.4;
    S.soft -= 0.25;
    say(['The first water comes away white with buttermilk.', 'The second water is cloudy.', 'The third is nearly clear.', 'The fourth runs clear.'][S.washes - 1] +
      (S.grain >= LUMPS ? ' The lumps keep their buttermilk inside them.' : ''));
    draw();
  });
  $('bWork').addEventListener('click', function () {
    if (S.phase !== 'make') return;
    S.passes++;
    S.bm *= 0.85;
    var lim = workLimit();
    say(S.passes < 4 ? 'Pass ' + S.passes + ' on the worker. Water beads out of it.' :
      S.passes <= lim ? 'Pass ' + S.passes + '. It is closing up and the salt is spreading through it.' :
        'Pass ' + S.passes + '. <b>It is beginning to smear</b> under the roller, and the grain is going.');
    draw();
  });
  $('salt').addEventListener('input', function () {
    S.salt = +this.value;
    $('saltOut').textContent = S.salt === 0 ? 'none' : S.salt.toFixed(2) + ' oz/lb';
    draw();
  });
  $('bSend').addEventListener('click', function () { if (S.phase === 'make') judge(); });

  function judge() {
    S.phase = 'done';
    $('pMake').style.display = 'none';
    var lim = workLimit();
    var water = 0.125 + 0.03 * Math.min(S.bm, 3) + 0.012 * Math.max(0, 4 - S.passes) + 0.004 * Math.max(0, S.soft);
    var flavour = 45 - 30 * Math.max(0, Math.abs(day.ripe - 1) - 0.12) - 9 * Math.min(1.6, S.bm) - 2 * S.warmPours - (S.soft > 4 ? 3 : 0) - 2 * S.blown;
    var body = 25 - 3.5 * Math.max(0, S.soft - 1) - 1.5 * Math.max(0, -S.soft - 4) - 2 * Math.max(0, S.passes - lim) -
      (S.grain >= LUMPS ? 4 : 0) - 2 * Math.max(0, 4 - S.passes);
    var streaky = S.salt > 0.05 && S.passes < 6;
    var colour = 15 - (streaky ? (6 - S.passes) * 1.5 : 0) - (S.bm > 0.6 ? 3 : 0) - day.winter * 4 * (1 - day.herd.yellow) - (S.soft > 3 ? 2 : 0);
    var salting = 10 - 14 * Math.abs(S.salt - day.order.salt);
    var makeup = 5 - 60 * Math.max(0, Math.abs(water - 0.145) - 0.02);
    var rows = [
      ['Flavour', 45, clamp(flavour, 8, 45), flavourWhy()],
      ['Body and grain', 25, clamp(body, 4, 25), bodyWhy(lim)],
      ['Colour', 15, clamp(colour, 4, 15), colourWhy(streaky)],
      ['Salting', 10, clamp(salting, 0, 10), 'Asked for about ' + day.order.salt.toFixed(2) + ' oz to the pound; you gave ' + S.salt.toFixed(2) + '.'],
      ['Make-up', 5, clamp(makeup, 0, 5), 'About ' + Math.round(water * 100) + '% water left in it; a buyer wants 13 to 16.']
    ];
    var total = 0;
    rows.forEach(function (r) { r[2] = Math.round(r[2]); total += r[2]; });
    var fatRec = S.fatLb * (1 - S.loss);
    var lbs = fatRec / Math.max(0.6, 1 - water - S.salt / 16 - 0.012);
    var grade = total >= 94 ? 'extra' : total >= 85 ? 'firsts' : total >= 75 ? 'seconds' : total >= 62 ? 'thirds' : 'grease';
    var mult = { extra: 1.12, firsts: 1, seconds: 0.85, thirds: 0.68, grease: 0.4 }[grade];
    var pence = lbs * day.price * mult;
    var best = S.fatLb / 0.83;
    var v = $('verdict');
    v.className = 'verdict ' + (total >= 85 ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + lbs.toFixed(1) + ' lb of butter</b>, scored <b>' + total + ' out of 100</b> and sold as <b>' + grade + '</b> at ' +
      money(day.price * mult) + ' a pound: <b>' + money(pence) + '</b> for the morning. The cream held enough fat for about ' + best.toFixed(1) +
      ' lb; ' + Math.round(S.loss * 100) + '% of it went away in the buttermilk.</p>' +
      '<p>This cream wanted churning at about <b>' + deg(day.topt) + '</b>. You poured it in at ' + deg(S.tPour) +
      (S.tAtBreak != null ? ', it broke after ' + Math.round(S.tBreak) + ' minutes at ' + deg(S.tAtBreak) : '') +
      ', and you stopped at ' + stageOf(S.grain).text + '.</p>';
    reveal(rows, total);
    $('bAgain').style.display = '';
    say('');
    draw();
  }
  function flavourWhy() {
    var a = [];
    if (Math.abs(day.ripe - 1) > 0.12) a.push(day.ripe < 1 ? 'the cream was under-ripe, so the butter is flat' : 'the cream was over-ripe, so the butter is sharp');
    if (S.bm > 0.5) a.push('buttermilk left in it will turn it sour within the week');
    if (S.warmPours) a.push('warm water poured in thinned it');
    if (S.blown) a.push('the churn blew and the cream was handled');
    return a.length ? a.join('; ') + '.' : 'Clean, nutty and sweet.';
  }
  function bodyWhy(lim) {
    var a = [];
    if (S.soft > 1) a.push('churned ' + S.soft.toFixed(1) + '° too warm, so it is soft and greasy');
    if (S.soft < -4) a.push('churned cold, so it is hard and crumbly');
    if (S.passes > lim) { var over = S.passes - Math.floor(lim); a.push('worked ' + over + (over === 1 ? ' pass' : ' passes') + ' too many, so the grain is going'); }
    if (S.passes < 4) a.push('worked too little, so it weeps');
    if (S.grain >= LUMPS) a.push('lumpy from over-churning');
    return a.length ? a.join('; ') + '.' : 'Firm, waxy and breaks with a clean grain.';
  }
  function colourWhy(streaky) {
    var a = [];
    if (streaky) a.push('salted but not worked enough, so it is streaky');
    if (S.bm > 0.6) a.push('mottled with buttermilk');
    if (day.winter > 0.5 && day.herd.yellow < 0.7) a.push('winter butter from ' + day.herd.name + ' is pale');
    return a.length ? a.join('; ') + '.' : 'Even and bright.';
  }

  /* ---------- the reveal ---------- */
  function reveal(rows, total) {
    var R = $('reveal');
    R.style.display = '';
    var html = '<h5>The morning in the churn</h5>' +
      '<canvas id="trace" width="640" height="240" aria-label="The cream temperature and the churning progress against the minutes."></canvas>' +
      '<div class="key"><span><i style="background:#ffb27a"></i>cream temperature</span><span><i style="background:rgba(242,211,107,.35);height:8px"></i>best band for this cream</span>' +
      '<span><i style="background:#64f0c8"></i>churning, from thin cream to lumps</span><span><i style="background:#7aa2ff"></i>gas behind the plug</span></div>' +
      '<p>Letters along the bottom: V the plug pulled, W warm water, C cold breaking water, B the break, ! the lid blown.</p>';
    if (rows) {
      html += '<h5>The judge\'s card</h5><table class="card">';
      rows.forEach(function (r) {
        html += '<tr><td>' + r[0] + '<br><span style="font-size:.82rem">' + r[3] + '</span></td><td class="n">' + r[2] + ' / ' + r[1] + '</td></tr>';
      });
      html += '<tr class="tot"><td>Total</td><td class="n">' + total + ' / 100</td></tr></table>';
    }
    R.innerHTML = html;
    drawTrace($('trace'));
  }

  function drawTrace(cv) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    var L = 44, Rr = 40, T0 = 18, B = 34;
    var tr = S.trace.length ? S.trace : [{ t: 0, T: S.T, G: 0, P: 0 }];
    var tmax = Math.max(20, tr[tr.length - 1].t);
    var lo = Math.min(46, Math.floor(day.topt - 10)), hi = Math.max(lo + 24, Math.ceil(day.topt + 12));
    function X(t) { return L + (W - L - Rr) * t / tmax; }
    function YT(v) { return T0 + (H - T0 - B) * (1 - (v - lo) / (hi - lo)); }
    function YG(g) { return T0 + (H - T0 - B) * (1 - g / 1.35); }
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(242,211,107,.14)';
    c.fillRect(L, YT(day.topt + 1.5), W - L - Rr, YT(day.topt - 1.5) - YT(day.topt + 1.5));
    c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#8b97ab';
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
    for (var v = Math.ceil(lo / 4) * 4; v <= hi; v += 4) {
      c.beginPath(); c.moveTo(L, YT(v)); c.lineTo(W - Rr, YT(v)); c.stroke();
      c.textAlign = 'right'; c.fillText(v + '°', L - 6, YT(v) + 3);
    }
    [[BREAK, 'break'], [WHEAT, 'wheat'], [PEAS, 'peas']].forEach(function (g) {
      c.setLineDash([3, 4]); c.strokeStyle = 'rgba(100,240,200,.25)';
      c.beginPath(); c.moveTo(L, YG(g[0])); c.lineTo(W - Rr, YG(g[0])); c.stroke(); c.setLineDash([]);
      c.textAlign = 'left'; c.fillStyle = 'rgba(100,240,200,.7)'; c.fillText(g[1], W - Rr + 4, YG(g[0]) + 3);
    });
    c.textAlign = 'center'; c.fillStyle = '#8b97ab';
    var stepT = tmax > 120 ? 30 : tmax > 50 ? 10 : 5;
    for (var t = 0; t <= tmax; t += stepT) c.fillText(t + 'm', X(t), H - 8);
    function line(f, col, w) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      tr.forEach(function (p, i) { var y = f(p); if (i) c.lineTo(X(p.t), y); else c.moveTo(X(p.t), y); });
      c.stroke();
    }
    line(function (p) { return YG(Math.min(1.35, p.P * 0.6)); }, 'rgba(122,162,255,.75)', 1.2);
    line(function (p) { return YG(Math.min(1.35, p.G)); }, '#64f0c8', 2);
    line(function (p) { return YT(p.T); }, '#ffb27a', 2);
    c.font = '600 10px ui-monospace,Menlo,monospace';
    S.events.forEach(function (e) {
      var ch = { vent: 'V', warm: 'W', water: 'C', 'break': 'B', blow: '!' }[e.k];
      if (!ch) return;
      c.fillStyle = e.k === 'blow' ? '#ff7a7a' : e.k === 'break' ? '#64f0c8' : '#e8edf5';
      c.fillText(ch, X(e.t), H - 20);
    });
  }

  /* ---------- drawing the dairy ---------- */
  function draw() {
    var W = canvas.width, H = canvas.height, c = ctx;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b2129'); g.addColorStop(1, '#12161c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // stone courses
    c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = 1;
    for (var y = 22; y < 272; y += 26) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      for (var x = (y / 26 % 2) * 40; x < W; x += 80) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 26); c.stroke(); }
    }
    // window with slatted louvre (dairies faced north, with gauze and louvres)
    c.fillStyle = 'rgba(170,195,220,' + (0.16 + 0.1 * (1 - day.winter)) + ')';
    c.fillRect(28, 30, 84, 96);
    c.strokeStyle = '#2b333d'; c.lineWidth = 3; c.strokeRect(28, 30, 84, 96);
    c.lineWidth = 2;
    for (var ly = 42; ly < 126; ly += 12) { c.beginPath(); c.moveTo(30, ly); c.lineTo(110, ly - 4); c.stroke(); }
    c.fillStyle = '#c9ced6'; c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText('DAIRY', 70, 22);
    // slate shelf with pans
    c.fillStyle = '#2d3640'; c.fillRect(0, 150, 120, 8);
    c.fillStyle = '#8a8f96';
    c.beginPath(); c.ellipse(32, 148, 22, 5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(84, 148, 22, 5, 0, 0, Math.PI * 2); c.fill();
    // floor
    c.fillStyle = '#20262e'; c.fillRect(0, 272, W, H - 272);
    c.strokeStyle = 'rgba(0,0,0,.35)';
    for (var fx = 0; fx < W; fx += 64) { c.beginPath(); c.moveTo(fx, 272); c.lineTo(fx - 30, H); c.stroke(); }

    drawChurn(c);
    if (S.phase === 'make' || (S.phase === 'done' && S.grain)) drawWorker(c); else drawGlass(c);
    drawThermo(c);

    if (S.blowFlash > 0) {
      c.fillStyle = 'rgba(245,238,215,' + (0.5 * S.blowFlash) + ')';
      var r = rng(S.blown * 31 + 7);
      for (var i = 0; i < 40; i++) {
        c.beginPath(); c.arc(140 + r() * 140 * (1 + 1 - S.blowFlash), 60 + r() * 220, 2 + r() * 5, 0, Math.PI * 2); c.fill();
      }
    }
  }

  function drawChurn(c) {
    var cx = 205, cy = 168;
    // stand
    c.strokeStyle = '#5a4128'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - 70, 300); c.lineTo(cx - 8, cy); c.lineTo(cx + 54, 300); c.stroke();
    c.beginPath(); c.moveTo(cx - 52, 262); c.lineTo(cx + 36, 262); c.stroke();
    // barrel, turning end over end
    c.save(); c.translate(cx, cy); c.rotate(S.angle);
    var bw = 92, bh = 132;
    var grd = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    grd.addColorStop(0, '#6b4a2b'); grd.addColorStop(0.5, '#a5773f'); grd.addColorStop(1, '#6b4a2b');
    c.fillStyle = grd;
    c.beginPath();
    c.moveTo(-bw / 2 + 6, -bh / 2); c.quadraticCurveTo(-bw / 2 - 8, 0, -bw / 2 + 6, bh / 2);
    c.lineTo(bw / 2 - 6, bh / 2); c.quadraticCurveTo(bw / 2 + 8, 0, bw / 2 - 6, -bh / 2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
    for (var s = -30; s <= 30; s += 15) { c.beginPath(); c.moveTo(s, -bh / 2); c.lineTo(s * 1.15, 0); c.lineTo(s, bh / 2); c.stroke(); }
    c.strokeStyle = '#2b2f33'; c.lineWidth = 5;
    [-bh / 2 + 10, -bh / 6, bh / 6, bh / 2 - 10].forEach(function (hy) {
      var wv = bw / 2 + 6 - Math.abs(hy) / (bh / 2) * 10;
      c.beginPath(); c.moveTo(-wv, hy); c.lineTo(wv, hy); c.stroke();
    });
    // lid end with sight glass and vent plug
    c.fillStyle = '#3a2a1a'; c.fillRect(-bw / 2 + 8, -bh / 2 - 6, bw - 16, 8);
    c.fillStyle = '#c9d4d8'; c.beginPath(); c.arc(-14, -bh / 2 - 2, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = S.P > 0.6 && S.phase === 'churn' ? '#ff9a6a' : '#7d6a55';
    c.fillRect(14, -bh / 2 - 12, 7, 7);
    c.restore();
    // axle and crank
    c.fillStyle = '#2b2f33'; c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.fill();
    var ca = S.angle, hx = cx + Math.cos(ca) * 34, hy = cy + Math.sin(ca) * 34;
    c.strokeStyle = '#3d4248'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(hx, hy); c.stroke();
    c.fillStyle = '#6b4a2b'; c.beginPath(); c.arc(hx, hy, 6, 0, Math.PI * 2); c.fill();
    // cream crock while tempering
    if (S.phase === 'temper') {
      c.fillStyle = '#b9a383'; c.beginPath();
      c.moveTo(300, 300); c.quadraticCurveTo(290, 250, 304, 232); c.lineTo(346, 232); c.quadraticCurveTo(360, 250, 350, 300); c.closePath(); c.fill();
      c.fillStyle = '#efe6cc'; c.beginPath(); c.ellipse(325, 233, 21, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8b97ab'; c.font = '10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
      c.fillText('the crock', 325, 318);
    }
  }

  function drawGlass(c) {
    var gx = 438, gy = 150, R = 86;
    c.save();
    c.beginPath(); c.arc(gx, gy, R, 0, Math.PI * 2); c.clip();
    var G = S.phase === 'temper' ? 0 : S.G;
    var slosh = Math.sin(S.angle) * 14;
    var liquid, after = G >= BREAK;
    if (G < THICK) liquid = '#efe6cc';
    else if (!after) liquid = mix('#efe6cc', '#f7f2e4', (G - THICK) / (BREAK - THICK));
    else liquid = mix('#e4e6dc', '#cfd9dd', Math.min(1, (G - BREAK) / 0.15));
    c.fillStyle = '#0e1218'; c.fillRect(gx - R, gy - R, 2 * R, 2 * R);
    var level = S.phase === 'temper' ? gy + R : gy - 20 + slosh * 0.6;
    c.fillStyle = liquid;
    c.beginPath(); c.moveTo(gx - R, level - slosh); c.lineTo(gx + R, level + slosh); c.lineTo(gx + R, gy + R); c.lineTo(gx - R, gy + R); c.closePath(); c.fill();
    if (S.phase !== 'temper') {
      var t = performance.now() / 1000;
      if (G >= THICK * 0.6 && !after) {
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
        var nb = Math.floor(30 + 80 * clamp((G - THICK * 0.6) / (BREAK - THICK * 0.6), 0, 1));
        for (var i = 0; i < nb; i++) {
          var p = specks[i];
          c.beginPath(); c.arc(gx + p.x * R, gy + Math.abs(p.y) * R * 0.9 - 10, 2 + p.s * 3, 0, Math.PI * 2); c.stroke();
        }
      }
      if (after) {
        var rad = clamp(0.8 + (G - BREAK) * 15, 0.8, 9);
        var n = G >= LUMPS ? 14 : G >= PEAS ? 50 : 130;
        c.fillStyle = mix('#f6e3a0', '#f2cc4a', day.herd.yellow * (1 - day.winter * 0.5));
        for (var j = 0; j < n; j++) {
          var q = specks[j];
          var px = gx + q.x * R * 0.95 + Math.sin(t * 2 + q.p) * 3 + slosh * 0.4;
          var py = gy + (q.y * 0.5 + 0.35) * R + Math.cos(t * 1.7 + q.p) * 2;
          var rr = G >= LUMPS ? rad * 2.2 * q.s : rad * q.s;
          c.beginPath(); c.arc(px, py, rr, 0, Math.PI * 2); c.fill();
        }
      }
    }
    c.restore();
    c.strokeStyle = '#6f7a86'; c.lineWidth = 4; c.beginPath(); c.arc(gx, gy, R, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(gx - 30, gy - 40, 30, 14, -0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8b97ab'; c.font = '10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText(S.phase === 'temper' ? 'the sight glass (empty)' : 'through the sight glass', gx, gy + R + 16);
  }

  function drawWorker(c) {
    var x0 = 350, y0 = 90, w = 176, h = 120;
    c.fillStyle = '#7a5a36'; c.fillRect(x0 - 10, y0 + h - 6, w + 20, 16);
    c.fillStyle = '#5a4128'; c.fillRect(x0 - 10, y0 + h + 10, 8, 90); c.fillRect(x0 + w + 2, y0 + h + 10, 8, 90);
    var col = mix('#f3e6b8', '#f0c43c', day.herd.yellow * (1 - day.winter * 0.5));
    if (S.soft > 3) col = mix(col, '#fff6d8', 0.35);
    c.fillStyle = col;
    var lump = S.grain >= LUMPS;
    c.beginPath();
    if (lump) {
      for (var k = 0; k < 5; k++) { c.moveTo(x0 + 30 + k * 30, y0 + 60); c.arc(x0 + 20 + k * 30, y0 + 70, 22 + (k % 2) * 6, 0, Math.PI * 2); }
    } else {
      var squash = Math.min(S.passes, 14) * 2;
      c.moveTo(x0 + 10 - squash / 2, y0 + h - 6);
      c.quadraticCurveTo(x0 + 6, y0 + 30 + squash, x0 + w / 2, y0 + 24 + squash);
      c.quadraticCurveTo(x0 + w - 6, y0 + 30 + squash, x0 + w - 10 + squash / 2, y0 + h - 6);
      c.closePath();
    }
    c.fill();
    if (S.salt > 0.05 && S.passes < 6) {
      c.strokeStyle = 'rgba(255,255,255,' + (0.5 - S.passes * 0.07) + ')'; c.lineWidth = 3;
      for (var s = 0; s < 6; s++) { c.beginPath(); c.moveTo(x0 + 30 + s * 22, y0 + 50); c.lineTo(x0 + 20 + s * 24, y0 + h - 12); c.stroke(); }
    }
    var drops = Math.round(Math.min(S.bm, 3) * 10);
    c.fillStyle = 'rgba(205,220,230,.8)';
    var r = rng(5);
    for (var d = 0; d < drops; d++) { c.beginPath(); c.arc(x0 + 20 + r() * (w - 40), y0 + 50 + r() * 50, 2.2, 0, Math.PI * 2); c.fill(); }
    if (S.passes > workLimit()) {
      c.fillStyle = 'rgba(255,255,255,.18)';
      c.beginPath(); c.ellipse(x0 + w / 2, y0 + 70, 60, 12, 0, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#8b97ab'; c.font = '10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText(S.washes + ' wash' + (S.washes === 1 ? '' : 'es') + ' · ' + S.passes + ' pass' + (S.passes === 1 ? '' : 'es'), x0 + w / 2, y0 - 12);
    c.fillText('on the butter worker', x0 + w / 2, y0 + h + 28);
  }

  function drawThermo(c) {
    var x = 588, top = 34, bot = 290, lo = 40, hi = 80;
    function Y(v) { return bot - (bot - top) * (clamp(v, lo, hi) - lo) / (hi - lo); }
    c.fillStyle = '#d8d2c2'; c.fillRect(x - 16, top - 12, 32, bot - top + 40);
    c.fillStyle = '#20262e'; c.font = '9px ui-monospace,Menlo,monospace'; c.textAlign = 'right';
    for (var v = lo; v <= hi; v += 5) {
      c.fillRect(x - 13, Y(v), v % 10 ? 4 : 7, 1);
      if (v % 10 === 0) c.fillText(v, x + 14, Y(v) + 3);
    }
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x - 3, top, 6, bot - top);
    c.fillStyle = '#c0392b'; c.fillRect(x - 2, Y(S.T), 4, bot - Y(S.T));
    c.beginPath(); c.arc(x, bot + 12, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a7ab8'; c.fillRect(x - 15, Y(day.room) - 1, 6, 2);
    c.fillStyle = '#8b97ab'; c.font = '10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText(S.T.toFixed(1) + '°', x, top - 18);
  }

  function mix(a, b, t) {
    t = clamp(t, 0, 1);
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ---------- sound: one knock per half turn, its colour set by what is inside ---------- */
  var audio = null, soundOn = false;
  $('bSound').addEventListener('click', function () {
    soundOn = !soundOn;
    this.textContent = soundOn ? 'Sound off' : 'Sound on';
    if (soundOn && !audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
    }
    if (audio && audio.state === 'suspended') audio.resume();
  });
  function thump() {
    if (!soundOn || !audio) return;
    var G = S.G, f, dur, gain;
    if (G < THICK) { f = 1100; dur = 0.28; gain = 0.22; }
    else if (G < BREAK) { f = 260; dur = 0.12; gain = 0.35; }
    else if (G < PEAS) { f = 1800; dur = 0.32; gain = 0.22; }
    else { f = 420; dur = 0.16; gain = 0.32; }
    var n = Math.floor(audio.sampleRate * dur);
    var buf = audio.createBuffer(1, n, audio.sampleRate), ch = buf.getChannelData(0);
    for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var src = audio.createBufferSource(); src.buffer = buf;
    var flt = audio.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = f;
    var g = audio.createGain(); g.gain.value = gain;
    src.connect(flt); flt.connect(g); g.connect(audio.destination);
    src.start();
  }

  /* ---------- keys and days ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range')) return;
    if (S.phase !== 'churn') return;
    if (e.code === 'Space') { e.preventDefault(); toggleTurn(); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); setPace(S.pace + 2); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); setPace(S.pace - 2); }
    else if (e.code === 'KeyV') vent();
  });
  $('bAgain').addEventListener('click', function () { fresh(); });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
})();
