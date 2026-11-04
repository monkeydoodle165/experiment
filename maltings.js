/* drift.quibo.games — The Maltings
   A floor maltings between 1820 and 1879, from the day the barley comes out of the steep to the day it goes on
   the kiln. The day's number picks the town, the barley (how fast it grows and how much heat it throws), how many
   quarters were steeped, how deep the excise couch lies, the weather outside (a cold or a warm spell coming
   through), the brewer's order (pale, amber or brown malt) and the day the kiln is wanted.

   The model, in one breath, an hour at a time. The growing corn breathes and makes heat in proportion to how
   deep the piece lies and how warm it already is:
       heat in  = 0.57 * barley * (depth / 4) * exp((T - 55) / 20) * vigour * wetness
       heat out = (0.05 + 0.08 * windows) * sqrt(4 / depth) * (T - outside)
   The acrospire creeps up the back of every corn at a rate set by the same exp((T - 55) / 20) and by how wet the
   grain still is; the rootlets grow faster still when it is warm, and knit the piece into a mat if nobody turns
   it. A deep piece grows unevenly. Turning airs it, evens it, tears the mat and dries it a little. You decide
   once a watch, four watches a day; the brewer judges the malt by its extract and its colour.
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
  function frac(a) {
    // the acrospire as a maltster would say it, in eighths of the corn
    var e = Math.round(clamp(a, 0, 1.5) * 8);
    if (e === 0) return 'not yet showing';
    if (e >= 8) return e === 8 ? 'the whole corn' : 'out past the tip';
    var F = ['', 'an eighth', 'a quarter', 'three-eighths', 'half', 'five-eighths', 'three-quarters', 'seven-eighths'];
    return F[e];
  }

  /* ---------- the world ---------- */
  var TOWNS = [
    { place: 'Ware', county: 'Hertfordshire', warm: 1, brewer: 'a porter brewery in Southwark' },
    { place: 'Bishop’s Stortford', county: 'Hertfordshire', warm: 1, brewer: 'a brewhouse in Whitechapel' },
    { place: 'Mistley', county: 'Essex', warm: 1, brewer: 'a London porter brewery by the river' },
    { place: 'Great Yarmouth', county: 'Norfolk', warm: 0, brewer: 'a brewer at Lambeth' },
    { place: 'Ditchingham', county: 'Norfolk', warm: 0, brewer: 'a Norwich brewer' },
    { place: 'Bury St Edmunds', county: 'Suffolk', warm: 0, brewer: 'a brewer in the town' },
    { place: 'Newark', county: 'Nottinghamshire', warm: -1, brewer: 'a Burton pale-ale house' },
    { place: 'Burton upon Trent', county: 'Staffordshire', warm: -1, brewer: 'a Burton brewer across the yard' },
    { place: 'Grantham', county: 'Lincolnshire', warm: -1, brewer: 'a brewer at Sheffield' },
    { place: 'Wallingford', county: 'Berkshire', warm: 1, brewer: 'a Reading brewer' },
    { place: 'Warminster', county: 'Wiltshire', warm: 1, brewer: 'a brewer in Bath' },
    { place: 'Knaresborough', county: 'Yorkshire', warm: -2, brewer: 'a brewer at Tadcaster' }
  ];
  /* vig: how fast it grows. heat: how much heat it throws for its growth. base: lb of extract a quarter it will give at best. */
  var BARLEYS = [
    { name: 'Chevalier barley', vig: 1.0, heat: 0.95, base: 95, bp: [34, 48],
      text: 'Chevalier, the plump, thin-skinned barley the brewers most wanted, from the light lands nearby' },
    { name: 'Norfolk barley', vig: 1.05, heat: 1.0, base: 93, bp: [32, 44],
      text: 'good Norfolk barley off the light soils, quick to grow' },
    { name: 'clay-land barley', vig: 0.9, heat: 1.1, base: 90, bp: [28, 40],
      text: 'heavy-land barley with a thick skin, slower to grow and apt to heat' },
    { name: 'Saale barley', vig: 1.0, heat: 1.05, base: 94, bp: [36, 50],
      text: 'bright German barley shipped from Hamburg, even in the corn' },
    { name: 'Scotch bere', vig: 1.12, heat: 1.15, base: 86, bp: [24, 34],
      text: 'six-rowed bere, cheap and lively, that grows fast and runs hot' }
  ];
  /* lo..hi: the band of finishing heat (corrected for the wet the malt goes on with) that gives the colour. */
  var ORDERS = [
    { key: 'pale', name: 'pale malt', lo: 140, hi: 165, base: 0, margin: [18, 24],
      text: 'pale malt for bitter beer and India ale, dried slowly with coke and never let get hot' },
    { key: 'amber', name: 'amber malt', lo: 175, hi: 200, base: -4, margin: [16, 22],
      text: 'amber malt, finished warm until it is the colour of a biscuit' },
    { key: 'brown', name: 'brown malt', lo: 205, hi: 235, base: -10, margin: [18, 25],
      text: 'brown malt for porter, blown at the end over a fierce fire until the corns pop and darken' }
  ];

  var TARGET = 0.75;   // the acrospire three-quarters of the way up the corn
  var WATCH = 6;       // hours in a watch
  var DUTY = 31 * 8;   // the malt tax, 2s 7d a bushel, in pence a quarter
  var G = 0.57;        // heat a growing piece throws, °F an hour

  function makeDay(off) {
    var d = dateFor(off), seed = seedForDate(d), r = rng(seed);
    var town = pick(r, TOWNS), barley = pick(r, BARLEYS), order = pick(r, ORDERS);
    var year = 1820 + Math.floor(r() * 60);
    var start = new Date(d.getFullYear(), 0, 1);
    var doy = Math.round((d - start) / 864e5);
    var winter = (Math.cos((doy - 15) / 365.25 * 2 * Math.PI) + 1) / 2;
    var base = 37 + 24 * (1 - winter) + town.warm + (r() - 0.5) * 6;
    var swing = 3 + r() * 4 + 3 * (1 - winter);
    var quarters = 10 + Math.floor(r() * 5) * 5;
    var couch = (winter > 0.6 ? 13 : winter < 0.35 ? 8 : 10) + Math.floor(r() * 4);
    var days = 8 + Math.floor(r() * 3) + (winter > 0.7 ? 1 : 0);
    var spells = [];
    for (var k = 0; k < 3; k++) spells.push({ a: (r() - 0.35) * 7, at: 24 + r() * (days - 1) * 24, w: 18 + r() * 30 });
    var bp = barley.bp[0] + r() * (barley.bp[1] - barley.bp[0]);
    var margin = order.margin[0] + r() * (order.margin[1] - order.margin[0]);
    var dy = {
      off: off, date: d, seed: seed, town: town, barley: barley, order: order, year: year, winter: winter,
      base: base, swing: swing, quarters: quarters, couch: couch, days: days, spells: spells,
      M0: 44 + r() * 2.5, T0: clamp(base + 5, 49, 58) + r() * 2,
      bp: bp * 12, mp: (bp + margin) * 12 + (year < 1880 ? DUTY : 0), duty: year < 1880,
      wd: WEEKDAYS[d.getDay()], dateText: d.getDate() + ' ' + MONTHS[d.getMonth()]
    };
    dy.extract = barley.base + order.base;
    return dy;
  }

  /* the air coming in at the windows, h hours after six in the morning of the first day */
  function airAt(dy, h) {
    var hod = (6 + h) % 24;
    var t = dy.base + dy.swing * Math.cos((hod - 15) / 24 * 2 * Math.PI);
    dy.spells.forEach(function (s) { var z = (h - s.at) / s.w; t += s.a * Math.exp(-z * z); });
    return t;
  }
  /* breathing quickens with warmth, and falls away again once the germ is being cooked */
  function rate(T) { return Math.exp((T - 55) / 20) / (1 + Math.exp((T - 84) / 4)); }
  function wetness(M) { return clamp((M - 36) / 6, 0, 1); }

  function freshState(dy) {
    return {
      h: 0, T: dy.T0, M: dy.M0, A: 0, R: 0, mat: 0, U: 0.06, mo: 0, L: 0, F: 0,
      depth: dy.couch, win: 1, turns: 0, sprinkle: false, sprinkles: 0, turned: 0,
      trace: [{ h: 0, T: dy.T0, Ta: airAt(dy, 0), A: 0, d: dy.couch }], phase: 'floor', notes: []
    };
  }

  function hour(dy, S) {
    var Ta = airAt(dy, S.h), w = S.win / 2, d = S.depth;
    var mf = wetness(S.M), r = rate(S.T);
    var act = Math.min(1, 0.1 + S.h / 72) * (1.15 - 0.35 * Math.min(S.A, 1.2));
    var gen = G * dy.barley.heat * (d / 4) * r * act * (0.3 + 0.7 * mf);
    var k = (0.05 + 0.08 * w) * Math.sqrt(4 / d);
    S.T += gen - k * (S.T - Ta);
    S.A += 0.006 * dy.barley.vig * r * mf * act;
    S.R += 0.006 * Math.pow(r, 1.4) * mf * act;
    S.M -= (0.010 + 0.018 * w) * r * (1 + Math.max(0, S.T - Ta) / 30);
    S.mat += 0.012 * Math.max(0, S.R - 0.25) * (d / 6);
    S.U += 0.001 * (d / 6) * r + 0.0004 * S.mat;
    S.mo += 0.006 * Math.max(0, S.T - 64) * clamp((S.M - 37) / 6, 0, 1.6) + (S.M > 46.5 ? 0.004 : 0);
    S.L += 0.02 * r * act * mf;
    if (S.T > 76) S.F += (S.T - 76) * 0.01;
    S.h++;
  }
  function turnOnce(dy, S) {
    var Ta = airAt(dy, S.h);
    S.T -= 0.22 * (S.T - Ta);
    S.U *= 0.82;
    S.mat *= 0.45;
    S.M -= 0.08;
    S.turned++;
  }
  /* one watch: the turns spread through it, the sprinkling at the start */
  function watch(dy, S) {
    if (S.sprinkle) { S.M += 1.5; S.sprinkles++; S.sprinkle = false; }
    var every = S.turns ? WATCH / S.turns : 99;
    for (var i = 0; i < WATCH; i++) {
      hour(dy, S);
      if (S.turns && (i + 1) % Math.round(every) === 0 && (i + 1) / Math.round(every) <= S.turns) turnOnce(dy, S);
      S.trace.push({ h: S.h, T: S.T, Ta: airAt(dy, S.h), A: S.A, d: S.depth });
    }
  }
  function inCouch(S) { return S.h < 26; }

  /* the brewer's verdict on a kiln of malt finished at heat H */
  function judge(dy, S, H) {
    var eff = H + (H > 160 ? 1.2 : 0.3) * (S.M - 40);
    var dev = S.A - TARGET, under = Math.max(0, -dev), over = Math.max(0, dev);
    var parts = [];
    var ex = dy.extract;
    function knock(v, why) { if (v > 0.25) parts.push({ v: v, why: why }); ex -= v; }
    knock(32 * under, 'short-grown: the acrospire never got far enough up the corn to open it, and the hard ends will not give their sugar');
    knock(14 * over + (S.A > 1 ? 22 * (S.A - 1) : 0), 'over-grown: the acrospire ran past where it should, and the corn fed it with the starch the brewer was paying for');
    knock(30 * Math.max(0, S.U - 0.05), 'uneven: some corns on the floor grew far and some hardly at all, so the malt is part short and part long');
    knock(4 * Math.min(S.mat, 2.5), 'felted: the rootlets knitted into a mat, and corns tore and bruised when it was broken up');
    knock(Math.max(0, S.L - 7) * 0.8, 'wasted: the piece breathed away more of its weight than it needed to');
    knock(6 * Math.min(Math.max(0, S.mo - 0.4), 3), 'mouldy: there were mould and a musty smell in the warm wet places');
    knock(5 * Math.min(S.F, 3), 'fired: the piece got hot enough to scorch the growth in the middle of the floor');
    knock(Math.max(0, eff - Math.max(165, dy.order.hi)) * 0.07, 'the kiln ran hotter than even this malt wanted, and took some of the extract with it');
    var slack = eff < 132;
    if (slack) knock(4, 'slack-dried: the kiln was never hot enough to cure it, and it will not keep');
    var colour = eff < dy.order.lo - 8 ? 'too pale' : eff > dy.order.hi + 8 ? 'too dark' :
      eff < dy.order.lo ? 'a shade pale' : eff > dy.order.hi ? 'a shade dark' : 'right';
    var mouldy = S.mo > 1.6;
    ex = Math.max(ex, dy.extract * 0.55);
    var q = clamp(1 - 0.025 * (dy.extract - ex), 0.4, 1.04);
    if (colour === 'too pale' || colour === 'too dark') q *= 0.85;
    else if (colour !== 'right') q *= 0.96;
    if (mouldy) q = Math.min(q, 0.5);
    var malt = dy.quarters * (1.04 - 0.01 * Math.max(0, S.L - 6));
    var account = {
      barley: dy.quarters * dy.bp,
      duty: dy.duty ? dy.quarters * 1.15 * DUTY : 0,
      firing: 40 * dy.quarters + Math.max(0, H - 140) * dy.quarters * 0.6,
      wages: Math.round(S.h / 24) * 2 * 24 + S.turned * 2,
      malt: malt, price: dy.mp * q
    };
    account.sales = malt * account.price;
    account.net = account.sales - account.barley - account.duty - account.firing - account.wages;
    return { eff: eff, ex: ex, parts: parts, colour: colour, mouldy: mouldy, q: q, acc: account, slack: slack };
  }

  /* outside the browser, just hand the model over (the page is the only caller that matters) */
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { makeDay: makeDay, freshState: freshState, watch: watch, judge: judge, airAt: airAt };
    return;
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var day, S, dayOff = 0, H = 150;
  var canvas = $('floor'), ctx = canvas.getContext('2d');
  var corns = (function () {
    var r = rng(1880), a = [];
    for (var i = 0; i < 400; i++) a.push({ x: r(), y: r(), k: r(), z: (r() + r() + r() - 1.5) * 1.4 });
    return a;
  })();

  function clockOf(h) {
    var dd = Math.floor((h + 6) / 24) + 1, hod = (h + 6) % 24;
    var name = hod === 6 ? '6 am' : hod === 12 ? 'noon' : hod === 18 ? '6 pm' : hod === 0 ? 'midnight' :
      (hod % 12 === 0 ? 12 : hod % 12) + (hod < 12 ? ' am' : ' pm');
    return 'Day ' + dd + ', ' + name;
  }
  function winText(v) { return ['shut', 'half open', 'wide open'][v]; }
  function turnText(n) { return n === 0 ? 'let it lie' : n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'; }
  function feel(S) {
    if (S.M > 46.5) return 'wet, sticky';
    if (S.M > 43) return 'moist';
    if (S.M > 40) return 'mellow';
    if (S.M > 38) return 'drying';
    return 'hard, dry';
  }
  function rootText(S) {
    if (S.R < 0.08) return 'chitting';
    if (S.mat > 0.6) return 'matted';
    if (S.R < 0.35) return 'short, white';
    if (S.R < 0.8) return 'forked, curling';
    return 'long, withering';
  }
  function say(html) { $('msg').innerHTML = html; }

  function loadDay(off) {
    dayOff = off;
    day = makeDay(off);
    var b = day.barley, o = day.order;
    $('rWho').textContent = day.wd + ' ' + day.dateText + ' ' + day.year + ' · ' + day.town.place + ', ' + day.town.county;
    $('rName').textContent = day.quarters + ' quarters of ' + o.name + ' for ' + day.town.brewer;
    $('rBlurb').innerHTML = 'Out of the steep this morning: <b>' + day.quarters + ' quarters of ' + b.text + '</b>. ' +
      'The order is <b>' + o.text + '</b>, and the kiln is wanted for it on <b>day ' + day.days + '</b>. ' +
      (day.winter > 0.6 ? 'It is the heart of the malting season and the air off the fields is cold.' : day.winter < 0.35 ?
        'It is summer, when most maltings stood empty: the air is warm, and the floor will run hot whatever you do.' :
        'It is the edge of the season, cool at night and mild in the day.') +
      ' Barley cost <b>' + money(day.bp) + '</b> a quarter, good malt of this kind fetches <b>' + money(day.mp) + '</b>' +
      (day.duty ? ', and the excise officer will gauge the couch and charge the malt tax on what he finds there' : '') + '.';
    $('rBook').innerHTML = '“Keep the floor cool and the growth slow. Thin the piece as it warms, turn it before the roots ' +
      'can take hold of one another, and when the spire is three parts up the back of the corn, it is malt.” — the maltster’s rule';
    var lbl = off === 0 ? 'Today’s' : off === -1 ? 'Yesterday’s' : off === 1 ? 'Tomorrow’s' : (off > 0 ? '+' : '') + off + ' days';
    $('dayOut').textContent = lbl + ' steeping · ' + day.dateText;
    fresh();
  }

  function fresh() {
    S = freshState(day);
    S.turns = 0;
    $('depth').value = day.couch; $('turns').value = 0; $('win').value = 1;
    $('pFloor').style.display = ''; $('pKiln').style.display = 'none';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    $('bSprinkle').classList.add('ghost');
    say('The barley has come out of the cistern swollen and wet and lies in the <b>couch</b>, a heap ' + day.couch +
      ' inches deep in a wooden frame, where it must stay untouched for twenty-six hours while the excise gauges it. ' +
      'The piece is at <b>' + deg(S.T) + '</b>; outside it is <b>' + deg(airAt(day, 0)) + '</b>. You can only work the ' +
      'windows until it comes out of the couch.');
    controls(); hud(); draw();
  }

  function controls() {
    var couch = inCouch(S);
    $('depth').disabled = couch; $('turns').disabled = couch; $('bSprinkle').disabled = couch;
    if (couch) { S.depth = day.couch; S.turns = 0; $('depth').value = day.couch; $('turns').value = 0; }
    S.depth = +$('depth').value; S.turns = +$('turns').value; S.win = +$('win').value;
    $('depthOut').textContent = S.depth + ' in' + (couch ? ' (couch)' : '');
    $('turnsOut').textContent = turnText(S.turns);
    $('winOut').textContent = winText(S.win);
    $('bSprinkle').textContent = S.sprinkle ? 'Will sprinkle ✓' : 'Sprinkle the floor';
    $('bSprinkle').classList.toggle('ghost', !S.sprinkle);
    $('bKiln').disabled = couch;
    var left = day.days * 24 - S.h;
    $('bDay').disabled = left <= WATCH;
  }

  function hud() {
    var Ta = airAt(day, S.h);
    $('hWhen').textContent = clockOf(S.h);
    $('hAir').textContent = deg(Ta);
    $('hT').textContent = deg(S.T);
    $('hTBox').className = S.T > 66 || S.T < 48 ? 'alarm' : '';
    $('hM').textContent = feel(S);
    $('hMBox').className = S.M < 39 || S.M > 46.5 ? 'alarm' : '';
    $('hA').textContent = frac(S.A);
    $('hR').textContent = rootText(S);
    $('hRBox').className = S.mat > 0.6 ? 'alarm' : '';
    $('hKiln').textContent = 'day ' + day.days + ' (' + Math.max(0, Math.ceil((day.days * 24 - S.h) / 24 * 4) / 4) + ' d)';
    $('hTurned').textContent = S.turned + (S.sprinkles ? ' · ' + S.sprinkles + ' wet' : '');
  }

  function step(n) {
    if (S.phase !== 'floor') return;
    var was = inCouch(S), notes = [];
    for (var i = 0; i < n; i++) {
      if (S.h >= day.days * 24) break;
      var T0 = S.T, mat0 = S.mat, mo0 = S.mo;
      watch(day, S);
      if (S.T > 66 && T0 <= 66) notes.push('The piece is <b>heating</b>: ' + deg(S.T) + ' and a sweet, warm smell off the floor. Thin it and turn it.');
      if (S.T < 48 && T0 >= 48) notes.push('The piece has gone <b>cold</b> (' + deg(S.T) + ') and growth has all but stopped. Thicken it or shut the windows.');
      if (S.mat > 0.6 && mat0 <= 0.6) notes.push('The rootlets are <b>knitting together</b>: lift a handful and the floor comes up in a cake.');
      if (S.mo > 0.8 && mo0 <= 0.8) notes.push('A <b>musty smell</b>, and white fur on a few corns in the warm middle of the floor.');
      if (T0 <= 76 && S.T > 76) notes.push('The middle of the piece is <b>firing</b> at ' + deg(S.T) + '.');
    }
    if (was && !inCouch(S)) {
      notes.unshift('The officer has gauged the couch' + (day.duty ? ' and gone away with his figures' : '') +
        '. The barley is <b>out on the floor</b>: you can spread it thinner, turn it and sprinkle it now.');
      $('depth').value = Math.min(day.couch, 8);
    }
    if (S.M < 39) notes.push('The corns feel <b>hard and dry</b> between the fingers and the growth is slowing. Sprinkle the floor.');
    if (S.A > 0.95 && S.A < 1.1) notes.push('The acrospire is near the tip of the corn. Load the kiln now or lose it.');
    controls(); hud(); draw();
    if (S.h >= day.days * 24) {
      say((notes.length ? notes.join(' ') + ' ' : '') + 'It is day ' + day.days + ' and the kiln is wanted. The piece goes up as it is.');
      toKiln();
      return;
    }
    say(notes.length ? notes.join(' ') : 'Another watch on the floor. The piece is at <b>' + deg(S.T) + '</b> with the air at <b>' +
      deg(airAt(day, S.h)) + '</b>; split a corn and the spire is <b>' + frac(S.A) + '</b> of the way up.');
  }

  function toKiln() {
    S.phase = 'kiln';
    $('pFloor').style.display = 'none'; $('pKiln').style.display = '';
    $('kilnNote').innerHTML = 'The brewer wants <b>' + day.order.name + '</b>, which wants a finishing heat of about <b>' +
      day.order.lo + ' to ' + day.order.hi + '°F</b>. Pale malt is dried slowly and never let get hot; amber is finished ' +
      'warm; brown is blown over a fierce wood fire. Malt that goes up wet colours faster on a hot fire, and this piece ' +
      'feels <b>' + feel(S) + '</b>.';
    setHeat(150);
    draw();
  }
  function heatText(h) {
    return h < 135 ? 'barely warm' : h < 168 ? 'a slow coke fire' : h < 200 ? 'a good warm fire' : 'blown over wood';
  }
  function setHeat(v) {
    H = clamp(Math.round(v), 120, 240);
    $('heat').value = H;
    $('heatOut').textContent = H + '°F · ' + heatText(H);
  }

  function fire() {
    if (S.phase !== 'kiln') return;
    S.phase = 'done';
    var J = judge(day, S, H);
    $('pKiln').style.display = 'none';
    var good = J.q >= 0.92 && !J.mouldy;
    var v = $('verdict');
    v.className = 'verdict ' + (good ? 'good' : 'warn');
    var grade = J.mouldy ? 'Refused: musty malt, sold to a distiller for what it would fetch' :
      J.q >= 0.98 ? 'Malt of the first quality' : J.q >= 0.92 ? 'Good, sound malt' : J.q >= 0.8 ? 'Middling malt, taken at a lower price' :
        'Poor malt, taken grudgingly';
    var html = '<p><b>' + grade + '.</b> The brewer mashed a sample and got <b>' + J.ex.toFixed(1) + ' lb of extract a quarter</b>' +
      ' against the ' + day.extract + ' this barley could have given, and found the colour <b>' + J.colour + '</b> for ' +
      day.order.name + '.</p>';
    if (J.parts.length) {
      J.parts.sort(function (a, b) { return b.v - a.v; });
      html += '<p>Where it went: ' + J.parts.slice(0, 4).map(function (p) { return p.why + ' (−' + p.v.toFixed(1) + ' lb)'; }).join('; ') + '.</p>';
    } else html += '<p>The corn was evenly grown, mellow and sweet, with nothing lost.</p>';
    html += '<p>Floor time ' + (S.h / 24).toFixed(1) + ' days, turned ' + S.turned + ' times, sprinkled ' + S.sprinkles +
      ' times. The account comes to <b>' + money(J.acc.net) + '</b>.</p>';
    v.innerHTML = html;
    reveal(J);
    $('bAgain').style.display = '';
  }

  function reveal(J) {
    var R = $('reveal');
    R.style.display = '';
    var a = J.acc;
    R.innerHTML = '<h5>The floor, watch by watch</h5>' +
      '<canvas id="chart" width="640" height="230" aria-label="The temperature of the piece and of the air outside, and how far the acrospire grew, through the floor."></canvas>' +
      '<div class="key"><span><i style="background:#ffb27a"></i>the piece</span><span><i style="background:#7aa2ff"></i>the air outside</span>' +
      '<span><i style="background:#64f0c8"></i>acrospire (right scale)</span><span><i style="background:rgba(242,211,107,.5)"></i>the depth of the floor</span></div>' +
      '<p>The maltster’s band is 55 to 62°F on the floor. The dashed line is three-quarters of the corn.</p>' +
      '<h5>The account</h5><table class="card">' +
      '<tr><td>' + a.malt.toFixed(1) + ' quarters of malt at ' + money(a.price) + '</td><td class="n">' + money(a.sales) + '</td></tr>' +
      '<tr><td>' + day.quarters + ' quarters of barley at ' + money(day.bp) + '</td><td class="n">−' + money(a.barley) + '</td></tr>' +
      (day.duty ? '<tr><td>Malt tax on the couch gauge</td><td class="n">−' + money(a.duty) + '</td></tr>' : '') +
      '<tr><td>Coke and wood for the kiln</td><td class="n">−' + money(a.firing) + '</td></tr>' +
      '<tr><td>Wages on the floor</td><td class="n">−' + money(a.wages) + '</td></tr>' +
      '<tr class="tot"><td>To the house</td><td class="n">' + money(a.net) + '</td></tr></table>';
    chart($('chart'));
  }

  function chart(cv) {
    var c = cv.getContext('2d'), W = cv.width, Hh = cv.height, L = 34, Rr = 34, T0 = 12, B = 26;
    var tr = S.trace, hmax = Math.max(24, tr[tr.length - 1].h);
    var lo = 30, hi = 85;
    function X(h) { return L + (W - L - Rr) * h / hmax; }
    function Y(t) { return Hh - B - (Hh - T0 - B) * (clamp(t, lo, hi) - lo) / (hi - lo); }
    function YA(a) { return Hh - B - (Hh - T0 - B) * clamp(a, 0, 1.25) / 1.25; }
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = 'rgba(100,240,200,.07)'; c.fillRect(L, Y(62), W - L - Rr, Y(55) - Y(62));
    c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#8b97ab';
    c.textAlign = 'right';
    for (var t = 30; t <= 80; t += 10) { c.fillText(t + '°', L - 4, Y(t) + 3); c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(L, Y(t), W - L - Rr, 1); c.fillStyle = '#8b97ab'; }
    c.textAlign = 'left';
    ['0', '¼', '½', '¾', '1'].forEach(function (s, i) { c.fillText(s, W - Rr + 4, YA(i / 4) + 3); });
    c.textAlign = 'center';
    for (var dd = 1; (dd - 1) * 24 + 6 <= hmax; dd++) {
      c.fillText('day ' + dd, X((dd - 1) * 24 + 6), Hh - 8);
      if (dd * 24 - 6 < hmax) { c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(X(dd * 24 - 6), T0, 1, Hh - T0 - B); c.fillStyle = '#8b97ab'; }
    }
    // depth as a floor band
    c.fillStyle = 'rgba(242,211,107,.12)';
    tr.forEach(function (p, i) { if (i) c.fillRect(X(tr[i - 1].h), Hh - B - p.d * 3, X(p.h) - X(tr[i - 1].h) + 0.5, p.d * 3); });
    c.setLineDash([4, 4]); c.strokeStyle = 'rgba(100,240,200,.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(L, YA(TARGET)); c.lineTo(W - Rr, YA(TARGET)); c.stroke(); c.setLineDash([]);
    function line(col, f) {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      tr.forEach(function (p, i) { if (i) c.lineTo(X(p.h), f(p)); else c.moveTo(X(p.h), f(p)); });
      c.stroke();
    }
    line('#7aa2ff', function (p) { return Y(p.Ta); });
    line('#ffb27a', function (p) { return Y(p.T); });
    line('#64f0c8', function (p) { return YA(p.A); });
  }

  /* ---------- the floor, drawn ---------- */
  function draw() {
    var c = ctx, W = canvas.width, Hc = canvas.height;
    var hod = (6 + S.h) % 24, Ta = airAt(day, S.h);
    var light = clamp(Math.sin((hod - 6) / 12 * Math.PI) * (0.7 + 0.3 * (1 - day.winter)), 0, 1);
    // the long low room
    c.fillStyle = '#1b1712'; c.fillRect(0, 0, W, Hc);
    c.fillStyle = '#231d16'; c.fillRect(0, 0, 400, 26);
    for (var bm = 0; bm < 5; bm++) { c.fillStyle = '#2e261c'; c.fillRect(10 + bm * 80, 0, 14, 30); }
    // windows with their shutters
    for (var wi = 0; wi < 3; wi++) {
      var wx = 30 + wi * 128, wy = 54, ww = 64, wh = 58;
      var sky = 'rgb(' + Math.round(30 + 120 * light) + ',' + Math.round(40 + 130 * light) + ',' + Math.round(60 + 140 * light) + ')';
      c.fillStyle = sky; c.fillRect(wx, wy, ww, wh);
      var open = S.win / 2, sh = ww / 2 * (1 - open);
      c.fillStyle = '#4a3a28'; c.fillRect(wx, wy, sh, wh); c.fillRect(wx + ww - sh, wy, sh, wh);
      c.strokeStyle = '#3d3226'; c.lineWidth = 3; c.strokeRect(wx, wy, ww, wh);
      if (open > 0) {
        c.fillStyle = 'rgba(255,240,200,' + (0.05 * light * open + 0.01) + ')';
        c.beginPath(); c.moveTo(wx, wy + wh); c.lineTo(wx + ww, wy + wh); c.lineTo(wx + ww + 60, 250); c.lineTo(wx + 20, 250); c.closePath(); c.fill();
      }
    }
    // the floor and the piece on it
    var fy = 280;
    c.fillStyle = '#2a2622'; c.fillRect(0, fy, 400, Hc - fy);
    for (var tl = 0; tl < 400; tl += 25) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(tl, fy, 1, Hc - fy); }
    var px = 6 * S.depth, x0 = 14, x1 = 386;
    if (inCouch(S)) { x0 = 120; x1 = 290; }
    var ripe = clamp(S.A, 0, 1), warm = clamp((S.T - 55) / 20, -0.5, 1);
    var gr = Math.round(176 + 30 * ripe), gg = Math.round(140 + 30 * ripe), gb = Math.round(70 + 20 * ripe);
    c.fillStyle = 'rgb(' + gr + ',' + gg + ',' + gb + ')';
    c.beginPath(); c.moveTo(x0 - 8, fy);
    for (var sx = 0; sx <= 20; sx++) {
      var xx = x0 + (x1 - x0) * sx / 20, bump = Math.sin(sx * 1.7 + S.turned) * 1.5;
      c.lineTo(xx, fy - px + bump);
    }
    c.lineTo(x1 + 8, fy); c.closePath(); c.fill();
    // warmth glows in the middle of a hot piece
    if (warm > 0.3) {
      c.fillStyle = 'rgba(255,120,60,' + (0.35 * (warm - 0.3)) + ')';
      c.fillRect(x0 + 20, fy - px * 0.7, x1 - x0 - 40, px * 0.5);
    }
    // corns and their white rootlets
    for (var i = 0; i < 260; i++) {
      var cn = corns[i], cx = x0 + cn.x * (x1 - x0), cy = fy - cn.y * px;
      c.fillStyle = 'rgba(120,90,40,.5)'; c.fillRect(cx, cy, 2, 1);
      if (S.R > 0.08 && cn.k < 0.3 + S.R * 0.5) { c.fillStyle = 'rgba(240,235,220,' + clamp(S.R * 0.6, 0, 0.7) + ')'; c.fillRect(cx + 1, cy - 1, 1 + S.R * 2, 1); }
      if (S.mo > 0.5 && cn.k > 1 - (S.mo - 0.5) * 0.12) { c.fillStyle = 'rgba(200,215,200,.65)'; c.beginPath(); c.arc(cx, cy, 2.5, 0, 7); c.fill(); }
    }
    if (S.mat > 0.6) { c.strokeStyle = 'rgba(240,235,220,.25)'; c.lineWidth = 1; c.beginPath(); for (var m = 0; m < 30; m++) { var mx = x0 + corns[m + 300].x * (x1 - x0); c.moveTo(mx, fy - px + 2); c.lineTo(mx + 12, fy - px + 4); } c.stroke(); }
    if (inCouch(S)) { c.strokeStyle = '#6b4f33'; c.lineWidth = 4; c.strokeRect(x0 - 10, fy - day.couch * 6 - 4, x1 - x0 + 20, day.couch * 6 + 4); }
    // the thermometer stuck in the piece, and the one by the window
    function therm(x, top, v, label) {
      var bot = top + 90;
      function TY(t) { return bot - 90 * (clamp(t, 25, 85) - 25) / 60; }
      c.fillStyle = '#2b2520'; c.fillRect(x - 6, top - 4, 12, 98);
      c.fillStyle = '#c0392b'; c.fillRect(x - 1.5, TY(v), 3, bot - TY(v)); c.beginPath(); c.arc(x, bot + 4, 4, 0, 7); c.fill();
      c.fillStyle = 'rgba(100,240,200,.5)'; c.fillRect(x + 4, TY(62), 3, TY(55) - TY(62));
      c.fillStyle = '#8b97ab'; c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
      c.fillText(label + ' ' + Math.round(v) + '°', x, top - 8);
    }
    therm(214, 150 - 0, S.T, 'PIECE');
    therm(372, 40, Ta, 'AIR');
    c.textAlign = 'left'; c.fillStyle = '#8b97ab'; c.font = '600 9px ui-monospace,Menlo,monospace';
    c.fillText(clockOf(S.h).toUpperCase(), 12, 16 + 0);
    c.fillText('DEPTH ' + S.depth + ' IN', 12, fy + 22);
    c.fillText(S.phase === 'kiln' ? 'ON THE KILN' : S.phase === 'done' ? 'FIRED' : inCouch(S) ? 'IN THE COUCH · ' + (26 - S.h) + ' H' : 'ON THE FLOOR', 12, fy + 36);

    // the corns, split: five of them, each grown a little differently
    var gx = 420, gy = 30, gw = 210, gh = 290;
    c.fillStyle = '#0e1219'; c.fillRect(gx, gy, gw, gh);
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.strokeRect(gx, gy, gw, gh);
    c.fillStyle = '#8b97ab'; c.textAlign = 'center'; c.fillText('FIVE CORNS, SPLIT', gx + gw / 2, gy - 10);
    for (var g = 0; g < 5; g++) {
      var ccx = gx + 26 + g * 40, top = gy + 40, len = 150;
      var a = clamp(S.A + S.U * corns[g + 350].z * 2.2, 0, 1.3);
      // husk
      c.fillStyle = 'rgb(' + gr + ',' + gg + ',' + gb + ')';
      c.beginPath(); c.ellipse(ccx, top + len / 2, 13, len / 2, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,250,235,.85)';
      c.beginPath(); c.ellipse(ccx + 2, top + len / 2, 8, len / 2 - 6, 0, 0, 7); c.fill();
      // the three-quarter mark
      c.strokeStyle = 'rgba(100,240,200,.5)'; c.setLineDash([3, 3]); c.beginPath();
      c.moveTo(ccx - 16, top + len * (1 - TARGET)); c.lineTo(ccx + 16, top + len * (1 - TARGET)); c.stroke(); c.setLineDash([]);
      // acrospire up the back, from the root end
      if (a > 0.01) {
        c.strokeStyle = '#7fae4a'; c.lineWidth = 3; c.beginPath();
        c.moveTo(ccx - 9, top + len - 4);
        c.quadraticCurveTo(ccx - 13, top + len * (1 - a / 2), ccx - 8 + (a > 1 ? 10 : 0), top + len * (1 - a) + 2);
        c.stroke(); c.lineWidth = 1;
      }
      // rootlets
      var rl = clamp(S.R, 0, 1.4) * 60 * (1 + corns[g + 360].z * 0.15);
      if (rl > 2) {
        c.strokeStyle = S.R > 0.9 ? 'rgba(200,190,160,.8)' : 'rgba(245,242,230,.9)';
        for (var q = -1; q <= 1; q++) {
          c.beginPath(); c.moveTo(ccx, top + len);
          c.quadraticCurveTo(ccx + q * 12, top + len + rl * 0.5, ccx + q * 8 + Math.sin(g + q) * 6, top + len + Math.min(rl, 80));
          c.stroke();
        }
      }
    }
    c.fillStyle = '#8b97ab'; c.textAlign = 'center';
    c.fillText('SPIRE ' + frac(S.A).toUpperCase(), gx + gw / 2, gy + gh - 10);

    if (S.phase === 'kiln' || S.phase === 'done') {
      c.fillStyle = 'rgba(11,15,22,.55)'; c.fillRect(0, 0, 400, Hc);
      var col = H + (H > 160 ? 1.2 : 0.3) * (S.M - 40);
      var tone = clamp((col - 130) / 110, 0, 1);
      c.fillStyle = 'rgb(' + Math.round(220 - 120 * tone) + ',' + Math.round(190 - 130 * tone) + ',' + Math.round(120 - 90 * tone) + ')';
      c.fillRect(60, 210, 280, 36);
      c.fillStyle = '#3b3530'; c.fillRect(50, 246, 300, 8);
      c.fillStyle = 'rgba(255,140,50,' + (0.3 + 0.5 * tone) + ')'; c.fillRect(120, 262, 160, 14);
      c.fillStyle = '#e8edf5'; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
      c.fillText('THE KILN · ' + H + '°F', 200, 196);
    }
  }

  /* ---------- wiring ---------- */
  ['depth', 'turns', 'win'].forEach(function (id) { $(id).addEventListener('input', function () { controls(); draw(); }); });
  $('bSprinkle').addEventListener('click', function () { if (!inCouch(S)) { S.sprinkle = !S.sprinkle; controls(); } });
  $('bWatch').addEventListener('click', function () { step(1); });
  $('bDay').addEventListener('click', function () { step(4); });
  $('bKiln').addEventListener('click', function () {
    if (inCouch(S)) return;
    say('The piece goes up to the kiln with the spire <b>' + frac(S.A) + '</b> of the way up the corn. Now the fire decides the colour.');
    toKiln();
  });
  $('heat').addEventListener('input', function () { setHeat(+$('heat').value); draw(); });
  $('bFire').addEventListener('click', fire);
  $('bAgain').addEventListener('click', function () { fresh(); });
  document.addEventListener('keydown', function (e) {
    if (!S || S.phase !== 'floor') return;
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.code === 'KeyN') step(1);
    else if (e.code === 'KeyD') step(4);
    else if (e.code === 'KeyK') $('bKiln').click();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
})();
