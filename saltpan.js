/* drift.quibo.games — The Saltpan
   An open-pan salt works between 1800 and 1899, starting on today's calendar date. The day's number picks the works
   (and how strong its brine runs and how much lime it carries), the season (how cold the pan house is), the order on
   the slate (lump salt, butter salt, common salt or fishery salt, each wanting its own size of grain), the pan that
   suits it, the hours until the boat leaves, the price, the coal, and the wind across the chimney hour by hour.

   The model, in one breath: the firing and the draught set a temperature the pan is heading for, slowed by the
   scale and the salt lying on the bottom. Evaporation rises steeply with temperature and, at the boil, with how
   hard the fire drives it. Once the brine is saturated, every ton of water that goes off leaves salt behind in
   proportion to the brine's strength. Salt forming in a hot pan comes down as fine grain, in a cool one as coarse:
       size (mm) = 0.35 * exp((226 - T) / 35)
   and crystals left lying in a cool pan keep growing. Lime comes down too, as scale, which has to be scratched off
   with the fire out or the plate burns.
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
    var h = s ^ 0x5a17ba2e;
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
  function tons(t) { return t < 10 ? t.toFixed(1) + ' t' : Math.round(t) + ' t'; }
  function mm(s) { return s < 1 ? s.toFixed(2) + ' mm' : s.toFixed(1) + ' mm'; }

  /* normal CDF, Abramowitz and Stegun 7.1.26 */
  function Phi(x) {
    var t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
      Math.exp(-x * x / 2);
    return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }

  /* ---------- the world ---------- */
  var WORKS = [
    { place: 'Winsford', county: 'Cheshire', brine: 25.8, lime: 1, coal: 6, ship: 'a Weaver flat down to Liverpool', src: 'wild brine pumped from the rock head' },
    { place: 'Northwich', county: 'Cheshire', brine: 25.6, lime: 1.05, coal: 6, ship: 'a Weaver flat to Runcorn', src: 'wild brine from a shaft beside the works, where the ground is sinking' },
    { place: 'Middlewich', county: 'Cheshire', brine: 25.2, lime: 0.95, coal: 7, ship: 'narrow boats on the Trent and Mersey', src: 'brine from the old town pits' },
    { place: 'Nantwich', county: 'Cheshire', brine: 24.6, lime: 0.9, coal: 7, ship: 'the Shropshire Union canal', src: 'brine from the town spring' },
    { place: 'Anderton', county: 'Cheshire', brine: 25.7, lime: 1.1, coal: 6, ship: 'a Weaver flat from the riverside', src: 'brine pumped up by a beam engine' },
    { place: 'Droitwich', county: 'Worcestershire', brine: 26.3, lime: 1.2, coal: 8, ship: 'the Droitwich Canal to the Severn', src: 'the famous Droitwich brine, about as strong as brine can be' },
    { place: 'Stoke Prior', county: 'Worcestershire', brine: 26.1, lime: 1.15, coal: 7, ship: 'the Worcester and Birmingham Canal', src: 'brine from a bore hole by the canal' },
    { place: 'Shirleywich', county: 'Staffordshire', brine: 23.8, lime: 0.85, coal: 6, ship: 'boats on the Trent and Mersey', src: 'a weaker brine spring' },
    { place: 'Dungeon, by Hale', county: 'Lancashire', brine: 25, lime: 0.8, coal: 9, ship: 'a coaster down the Mersey', src: 'Northwich rock salt dissolved in Mersey water' },
    { place: 'Prestonpans', county: 'Haddingtonshire', brine: 21.5, lime: 1.3, coal: 5, ship: 'a sloop out of Morrison’s Haven', src: 'sea water strengthened with rock salt from Cheshire' },
    { place: 'Lymington', county: 'Hampshire', brine: 19, lime: 1.35, coal: 11, ship: 'a coaster from the Lymington river', src: 'sea brine run off the salterns on the marsh' },
    { place: 'Maldon', county: 'Essex', brine: 16, lime: 1.4, coal: 10, ship: 'a barge down the Blackwater', src: 'sea water off the creeks at the top of a spring tide' }
  ];
  /* lo/hi: the merchant's grain, mm. area: square feet of pan. hrs: hours until the boat. price: shillings a ton. */
  var ORDERS = [
    { key: 'lump', name: 'lump salt', lo: 0, hi: 0.6, area: [480, 680], hrs: [36, 56], price: [13, 16],
      text: 'lump salt for the table: the finest grain, lifted into conical tubs and stoved into hard white loaves',
      buyer: ['a grocer in Manchester', 'the London salt merchants', 'a wholesale grocer in Birmingham', 'a house in Bristol'] },
    { key: 'butter', name: 'butter salt', lo: 0.5, hi: 1.2, area: [760, 1050], hrs: [48, 72], price: [12, 14],
      text: 'butter salt: a fine, clean grain that melts evenly through the butter',
      buyer: ['the dairies round Carmarthen', 'the Cork Butter Exchange', 'the Dorset butter factors', 'a Cheshire cheese factor'] },
    { key: 'common', name: 'common salt', lo: 1, hi: 3, area: [1250, 1700], hrs: [72, 112], price: [8, 10],
      text: 'common salt: a middling grain for the bacon curers, the tanners and the kitchen',
      buyer: ['the Wiltshire bacon curers', 'a tanner in Bermondsey', 'a chemical works at Widnes', 'a ship’s chandler in Liverpool'] },
    { key: 'fishery', name: 'fishery salt', lo: 4, hi: 14, area: [2300, 3200], hrs: [128, 180], price: [12, 15],
      text: 'fishery salt: big hard hopper crystals that dissolve slowly into the fish',
      buyer: ['the herring curers at Yarmouth', 'the curers at Wick', 'the Newfoundland cod trade', 'the pilchard cellars at Mevagissey'] }
  ];

  var BOIL = 226;          // saturated brine boils near 226°F
  var SAT = 26.4;          // percent salt by weight at saturation
  var SIGMA = 0.28;        // spread of grain about its size, log units
  var SPF = 0.5;           // seconds of real time per hour at the slow clock
  var EV = 3;              // tons of water an hour off a thousand square feet at a plain boil

  function sizeAt(T) { return 0.35 * Math.exp((BOIL - T) / 35); }
  function tempFor(s) { return BOIL - 35 * Math.log(s / 0.35); }

  function makeDay(off) {
    var d = dateFor(off), seed = seedForDate(d), r = rng(seed);
    var works = pick(r, WORKS), order = pick(r, ORDERS);
    // weak sea brines were boiled for fine salt; nobody waited a week for coarse salt from them
    if (works.brine < 22 && (order.key === 'fishery' || order.key === 'common')) works = pick(r, WORKS.filter(function (x) { return x.brine >= 23; }));
    var year = 1800 + Math.floor(r() * 100);
    var start = new Date(d.getFullYear(), 0, 1);
    var doy = Math.round((d - start) / 864e5);
    var winter = (Math.cos((doy - 15) / 365.25 * 2 * Math.PI) + 1) / 2;
    var amb = 60 - 18 * winter + (r() - 0.5) * 5;
    var hum = 0.6 + r() * 0.3;
    var area = Math.round((order.area[0] + r() * (order.area[1] - order.area[0])) / 10) * 10;
    var hrs = order.hrs[0] + Math.floor(r() * (order.hrs[1] - order.hrs[0] + 1) / 4) * 4;
    var price = (order.price[0] + r() * (order.price[1] - order.price[0])) * (1 + Math.max(0, 25.5 - works.brine) / 18);   // sea salt fetched a premium
    var coal = works.coal + (r() - 0.5) * 2 + (year < 1830 ? 2 : 0);
    var buyer = pick(r, order.buyer);
    var startHour = 6;

    // the wind across the chimney, one value an hour, with now and then a blow
    var N = hrs + 30, ctrl = [], wind = [];
    for (var i = 0; i <= Math.ceil(N / 6) + 1; i++) ctrl.push(0.15 + r() * 0.6);
    var gales = Math.floor(r() * 2.6);
    var galeAt = [];
    for (var gI = 0; gI < gales; gI++) galeAt.push({ h: 8 + r() * (hrs - 16), w: 6 + r() * 8, a: 0.45 + r() * 0.4 });
    for (var h = 0; h < N; h++) {
      var k = Math.floor(h / 6), f = (h % 6) / 6, sm = (1 - Math.cos(f * Math.PI)) / 2;
      var v = ctrl[k] * (1 - sm) + ctrl[k + 1] * sm;
      galeAt.forEach(function (g) { var x = (h - g.h) / g.w; if (Math.abs(x) < 1) v += g.a * (1 + Math.cos(x * Math.PI)) / 2; });
      wind.push(clamp(v, 0, 1.4));
    }

    // what a steady hand at the right warmth would make, so the order can be fair
    var tMid = order.lo > 0 ? tempFor(Math.sqrt(order.lo * order.hi)) : BOIL;
    if (order.key === 'fishery') tMid += 8;     // a fishery pan can run a little warmer and let the crystals grow
    var eMid = EV * Math.exp((tMid - BOIL) / 30) + 0.075 * 0.45 * (1 - hum);
    var yieldPerWater = works.brine / (100 - works.brine);
    var mw = area * 0.036, preSat = mw * Math.max(0.02, 1 - works.brine / SAT);
    var perHour = eMid * area / 1000 * yieldPerWater;
    var spare = order.key === 'lump' ? 12 : order.key === 'butter' ? 6 : 3;
    var warm = Math.max(4, (tMid - amb) / 30);
    var target = Math.max(2, Math.round(perHour * (hrs - spare - warm - preSat / (eMid * area / 1000)) * 0.78 * 2) / 2);

    return {
      off: off, date: d, seed: seed, works: works, order: order, year: year, winter: winter, amb: amb, hum: hum,
      area: area, hrs: hrs, price: price, coal: coal, buyer: buyer, startHour: startHour, wind: wind,
      yieldPerWater: yieldPerWater, preSat: preSat, target: target, tau: 2 + area / 1200,
      wd: WEEKDAYS[d.getDay()], dateText: d.getDate() + ' ' + MONTHS[d.getMonth()]
    };
  }

  function windAt(h) {
    var i = Math.floor(h), f = h - i, w = day.wind;
    var a = w[Math.min(i, w.length - 1)], b = w[Math.min(i + 1, w.length - 1)];
    return a + (b - a) * f;
  }
  function windText(w) {
    if (w < 0.15) return 'calm';
    if (w < 0.4) return 'light air';
    if (w < 0.7) return 'a breeze';
    if (w < 0.95) return 'a fresh wind';
    if (w < 1.15) return 'a strong wind';
    return 'blowing a gale';
  }
  function fireText(f) {
    if (f < 8) return 'banked';
    if (f < 30) return 'a slow fire';
    if (f < 55) return 'steady';
    if (f < 80) return 'firing hard';
    return 'forced';
  }
  function scaleText(s) {
    if (s < 0.2) return 'clean';
    if (s < 0.45) return 'a skin of scale';
    if (s < 0.7) return 'thick scale';
    return 'heavy, needs scratching';
  }

  /* ---------- state ---------- */
  var day, S;
  var dayOff = 0;
  var canvas = $('room'), ctx = canvas.getContext('2d');
  var dots = (function () {
    var r = rng(2026), a = [];
    for (var i = 0; i < 90; i++) a.push({ x: r() * 2 - 1, y: r() * 2 - 1, a: r() * Math.PI, k: 0.75 + r() * 0.5, sh: r() });
    return a;
  })();

  function inPan() { var m = 0; S.pan.forEach(function (c) { m += c.m; }); return m; }
  function drawnMass() { var m = 0; S.drawn.forEach(function (c) { m += c.m; }); return m; }
  function inSpec(c) {
    var o = day.order, ls = Math.log(c.s);
    var hi = Phi((Math.log(o.hi) - ls) / SIGMA), lo = o.lo > 0 ? Phi((Math.log(o.lo) - ls) / SIGMA) : 0;
    return Math.max(0, hi - lo);
  }

  function fresh() {
    S = {
      phase: 'ready', h: 0, T: day.amb + 6, fire: 35, speed: 1, paused: false,
      scale: 0.03, burn: 0, burnt: 0, scratch: 0, scratches: 0, evapFill: 0, water: 0, made: 0, coal: 0, repairs: 0,
      pan: [], drawn: [], draws: 0, trace: [], events: [], steam: 0, boost: 1, hazard: 0, Teq: day.amb, cohortH: -1,
      lastWarn: ''
    };
    $('pReady').style.display = '';
    $('pRun').style.display = 'none';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    $('fire').value = 35; $('fireOut').textContent = fireText(35);
    $('bPause').textContent = 'Pause';
    $('bSpeed').textContent = 'Faster clock';
    say('The pan is full of fresh brine, ' + day.works.brine.toFixed(1) + ' per cent salt, standing at <b>' + deg(S.T) +
      '</b> in a pan house at ' + deg(day.amb) + '. The boat for ' + day.buyer + ' leaves in <b>' + day.hrs + ' hours</b>.');
    hud(); draw();
  }

  function loadDay(off) {
    dayOff = off;
    day = makeDay(off);
    var w = day.works, o = day.order;
    $('rWho').textContent = day.wd + ' ' + day.dateText + ' ' + day.year + ' · ' + w.place + ', ' + w.county;
    $('rName').textContent = day.target + ' tons of ' + o.name + ' for ' + day.buyer;
    $('rBlurb').innerHTML = 'The works boils ' + w.src + ', at <b>' + w.brine.toFixed(1) + ' per cent</b> salt' +
      (w.brine < 23 ? ', weak enough that a good deal of water has to go before any salt comes down' : '') +
      '. The order on the slate is <b>' + o.text + '</b>, grain ' + (o.lo > 0 ? 'between ' + o.lo + ' and ' + o.hi + ' mm' : 'under ' + o.hi + ' mm') +
      '. You have a ' + day.area + ' square foot pan and <b>' + day.hrs + ' hours</b> before ' + w.ship + ' takes it away. It fetches <b>' +
      money(day.price * 12) + '</b> a ton at the works, and coal is costing <b>' + money(day.coal * 12) + '</b> a ton.';
    $('rBook').innerHTML = '“Lump salt is boiled briskly, at 225 or 226 degrees, and drawn every few hours. Butter salt somewhat ' +
      'lower, near 200. Common salt is made at 160 to 180 degrees and drawn twice a day. Fishery salt is made slowest of all, at ' +
      '100 to 130, and left to lie in the pan for days to grow. Scratch the pan before the scale is thick, or it will burn.” ' +
      '— the pan foreman’s rule';
    var lbl = off === 0 ? 'Today’s' : off === -1 ? 'Yesterday’s' : off === 1 ? 'Tomorrow’s' : (off > 0 ? '+' : '') + off + ' days';
    $('dayOut').textContent = lbl + ' order · ' + day.dateText;
    fresh();
  }

  function say(html) { $('msg').innerHTML = html; }

  function clockText() {
    var m = Math.round((day.startHour + S.h) * 60);
    var dd = Math.floor(m / 1440), hh = Math.floor(m / 60) % 24, mi = m % 60;
    var ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 === 0 ? 12 : hh % 12;
    return 'Day ' + (dd + 1) + ', ' + h12 + ':' + (mi < 10 ? '0' : '') + mi + ' ' + ap;
  }

  function hud() {
    var left = Math.max(0, day.hrs - S.h);
    $('hWhen').textContent = clockText() + ' · ' + Math.ceil(left) + 'h left';
    $('hTemp').textContent = S.scratch > 0 ? deg(S.T) + ', pan empty' : deg(S.T) + (S.T >= BOIL - 0.3 ? (S.boost > 1.25 ? ', boiling hard' : ', boiling') : S.T > 180 ? ', steaming' : S.T > 110 ? ', warm' : ', cold');
    var forming = S.scratch > 0 || S.evapFill < day.preSat ? '—' : mm(sizeAt(S.T));
    $('hGrain').textContent = S.scratch > 0 ? 'none, scratching' : S.evapFill < day.preSat ? 'none yet, brine weak' : forming;
    var w = windAt(S.h);
    $('hWind').textContent = windText(w) + ' · draught ' + (w > 0.75 ? 'strong' : w < 0.3 ? 'slack' : 'fair');
    $('hPan').textContent = tons(inPan());
    var dm = drawnMass();
    $('hDrawn').textContent = tons(dm) + ' of ' + day.target;
    $('hScale').textContent = scaleText(S.scale);
    $('hScaleBox').className = S.scale >= 0.7 ? 'alarm' : '';
    var b = S.scratch > 0 ? 'cold' : S.hazard > 0.5 ? (S.burn > 0.5 ? 'glowing red!' : 'hot at the scale') : 'sound';
    $('hBottom').textContent = b;
    $('hBottomBox').className = S.hazard > 0.5 && S.scratch <= 0 ? 'alarm' : '';
    $('bDraw').disabled = S.phase !== 'run' || inPan() < 0.05;
    $('bScratch').disabled = S.phase !== 'run' || S.scratch > 0;
  }

  /* ---------- the pan ---------- */
  function evapRate(T, boost, w) {
    return EV * Math.exp((T - BOIL) / 30) * boost + 0.075 * w * (1 - day.hum) * (T > day.amb ? 1 : 0.3);
  }

  function step(dt) {
    var A = day.area / 1000, w = windAt(S.h), dr = 0.88 + 0.26 * w;
    if (S.scratch > 0) {
      S.scratch -= dt;
      S.T += (day.amb - S.T) * Math.min(1, dt / 1.5);
      S.hazard = 0; S.steam = 0; S.boost = 1;
      S.coal += A * 0.003 * dt;
      if (S.scratch <= 0) {
        S.scratch = 0; S.scale = 0.02; S.burn = 0; S.evapFill = 0;
        S.events.push({ h: S.h, k: 'fill' });
        say('The plate is clean, the pan is filled again with fresh brine and the fire is relit. It has to come to strength again before any salt falls.');
      }
    } else {
      var ins = S.scale + 0.06 * inPan() / A;
      S.Teq = day.amb + S.fire / 100 * 240 * dr * (1 - 0.45 * Math.min(1, ins));
      S.T += (S.Teq - S.T) * Math.min(1, dt / day.tau);
      S.boost = 1;
      if (S.T >= BOIL) { S.T = BOIL; S.boost = 1 + Math.min(0.6, Math.max(0, S.Teq - BOIL) / 120); }
      var e = evapRate(S.T, S.boost, w) * A * dt;
      S.steam = e / (A * dt);
      S.evapFill += e; S.water += e;
      if (S.evapFill >= day.preSat) {
        var salt = e * day.yieldPerWater;
        var hr = Math.floor(S.h);
        var last = S.pan[S.pan.length - 1];
        var s0 = sizeAt(S.T);
        if (last && last.h === hr) {
          last.s = Math.exp((Math.log(last.s) * last.m + Math.log(s0) * salt) / (last.m + salt));
          last.s0 = Math.min(last.s0, last.s);
          last.m += salt;
        } else S.pan.push({ h: hr, m: salt, s: s0, s0: s0 });
        S.made += salt;
      }
      S.scale += e / A * 0.007 * day.works.lime;
      var g = 0.005 * Math.exp((140 - S.T) / 30);
      S.pan.forEach(function (c) { c.s = Math.min(c.s0 * 3, c.s * (1 + g * dt)); });
      S.coal += A * 0.25 * Math.pow(S.fire / 100, 2) * dr * dt + A * 0.003 * dt;
      S.hazard = S.fire / 100 * dr * Math.min(1.2, ins);
      if (S.hazard > 0.5) S.burn += (S.hazard - 0.5) * 0.7 * dt;
      else S.burn = Math.max(0, S.burn - 0.08 * dt);
      if (S.burn >= 1) burnPlate();
    }
    S.h += dt;
    if (S.h >= S.trace.length * 0.5) {
      S.trace.push({ h: S.h, T: S.T, scale: S.scale, made: S.made, drawn: drawnMass(), fire: S.scratch > 0 ? 0 : S.fire, w: w, sc: S.scratch > 0 });
    }
    // advice, once per kind of trouble
    var warn = '';
    if (S.scratch <= 0 && S.hazard > 0.5) warn = 'hot';
    else if (S.scratch <= 0 && S.scale >= 0.7) warn = 'scale';
    else if (inPan() / A > 7) warn = 'deep';
    if (warn && warn !== S.lastWarn) {
      if (warn === 'hot') say('The pan bottom is <b>running hot under the scale</b>; you can see a dull glow on the plate through the flue door. Ease the fire, draw the salt, or let it down and scratch it.');
      else if (warn === 'scale') say('The <b>scale is getting thick</b>. It takes the heat before the brine does, and the plate under it gets hotter than it should.');
      else say('The salt is lying <b>deep in the pan</b>, keeping the heat off the brine. Time to draw.');
    }
    S.lastWarn = warn;
    if (S.h >= day.hrs) finish(false);
  }

  function burnPlate() {
    S.burnt++;
    S.repairs += 720;
    var lost = 0;
    S.pan.forEach(function (c) { lost += c.m * 0.5; c.m *= 0.5; });
    drawAll(true);
    S.events.push({ h: S.h, k: 'burn' });
    S.scratch = 16; S.scratches++;
    say('<b>The plate has burned.</b> A plate under the thickest scale went red, buckled and split, and brine is pouring into the flue. ' +
      'Half the salt in the pan is spoiled with soot. The smith will take sixteen hours and ' + money(720) + ' to rivet a new plate in.');
  }

  function drawAll(quiet) {
    var m = inPan();
    if (m < 0.01) return 0;
    S.pan.forEach(function (c) { S.drawn.push({ h: S.h, m: c.m, s: c.s }); });
    S.pan = [];
    S.draws++;
    if (!quiet) S.events.push({ h: S.h, k: 'draw' });
    return m;
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
    say('The stoker lights the fires under the pan. Set the firing for the grain you want, and watch the wind: a stiff breeze ' +
      'across the chimney top pulls the fire harder than you set it.');
    last = 0; acc = 0; hud(); requestAnimationFrame(loop);
  });
  function setFire(v) {
    S.fire = clamp(Math.round(v), 0, 100);
    $('fire').value = S.fire;
    $('fireOut').textContent = fireText(S.fire);
  }
  $('fire').addEventListener('input', function () { setFire(+this.value); });
  function doDraw() {
    if (S.phase !== 'run') return;
    var hot = S.T > 200;
    var m = drawAll(false);
    if (!m) { say('There is nothing worth drawing yet.'); return; }
    var c = S.drawn[S.drawn.length - 1];
    say('The wallers ' + (hot ? 'lift the salt out of the steam with long skimmers into tubs' : 'rake the salt up the sloping side boards onto the hurdles') +
      ': <b>' + tons(m) + '</b>, grain about <b>' + mm(c.s) + '</b>. It drains there until the boat comes.');
    hud(); draw();
  }
  $('bDraw').addEventListener('click', doDraw);
  $('bScratch').addEventListener('click', function () {
    if (S.phase !== 'run' || S.scratch > 0) return;
    var m = drawAll(false);
    S.scratch = 9; S.scratches++;
    S.events.push({ h: S.h, k: 'scratch' });
    say((m ? 'The last ' + tons(m) + ' of salt is drawn, the ' : 'The ') + 'fire is let down and the pan run off. When it has cooled, men climb in with picks and ' +
      'scratch the lime off the plates. Nine hours without making any salt.');
    hud(); draw();
  });
  $('bPause').addEventListener('click', function () {
    S.paused = !S.paused;
    this.textContent = S.paused ? 'Carry on' : 'Pause';
  });
  $('bSpeed').addEventListener('click', function () {
    S.speed = S.speed === 1 ? 4 : 1;
    this.textContent = S.speed === 1 ? 'Faster clock' : 'Slower clock';
  });
  $('bShip').addEventListener('click', function () {
    if (S.phase !== 'run') return;
    finish(true);
  });

  /* ---------- the boat and the merchant ---------- */
  function finish(early) {
    S.phase = 'done';
    var left = drawAll(true);
    if (left > 0.01) S.events.push({ h: S.h, k: 'draw' });
    S.trace.push({ h: S.h, T: S.T, scale: S.scale, made: S.made, drawn: drawnMass(), fire: S.fire, w: windAt(S.h), sc: false });
    $('pRun').style.display = 'none';
    say('');

    var good = 0, off = 0, wet = 0, fine = 0, coarse = 0;
    var o = day.order;
    S.drawn.forEach(function (c) {
      var f = inSpec(c), isWet = S.h - c.h < 8;
      var ls = Math.log(c.s);
      var below = o.lo > 0 ? Phi((Math.log(o.lo) - ls) / SIGMA) : 0;
      var above = 1 - Phi((Math.log(o.hi) - ls) / SIGMA);
      fine += c.m * below; coarse += c.m * above;
      good += c.m * f; off += c.m * (1 - f);
      if (isWet) wet += c.m;
    });
    var total = good + off;
    var wetShare = total > 0 ? wet / total : 0;
    var p = day.price * 12;
    var sold = Math.min(good, day.target), extra = Math.max(0, good - day.target);
    var dock = 1 - 0.1 * wetShare;
    var revGood = sold * p * dock, revExtra = extra * p * 0.7 * dock, revOff = off * p * 0.45 * dock;
    var coalCost = S.coal * day.coal * 12;
    var wages = (S.h / 24) * 3 * 30;    // the wallers and the stoker, about half a crown a day each for three men's worth
    var profit = revGood + revExtra + revOff - coalCost - S.repairs - wages;
    var short = day.target - good;

    var v = $('verdict');
    var ok = short <= 0.05 && profit > 0;
    v.className = 'verdict ' + (ok ? 'good' : 'warn');
    var lines = [];
    if (total < 0.05) lines.push('<b>The boat leaves empty.</b> Not a basket of salt was drawn.');
    else if (short <= 0.05) lines.push('<b>The order is filled.</b> ' + tons(good) + ' of salt the merchant will pass as ' + o.name + ' against ' + day.target + ' tons ordered.');
    else lines.push('<b>Short by ' + tons(short) + '.</b> Only ' + tons(good) + ' of what you drew passes as ' + o.name + '; ' + day.buyer + ' wanted ' + day.target + ' tons.');
    if (total > 0.05) {
      if (fine > coarse && fine > 0.15 * total) lines.push('Too much of it is <b>finer than the order</b> (' + tons(fine) + '): the pan was run too hot for this grain.');
      else if (coarse > 0.15 * total) lines.push('Too much of it is <b>coarser than the order</b> (' + tons(coarse) + '): the pan was run too cool, or the salt was left to grow too long.');
      else if (off > 0.15 * total) lines.push('The grain is <b>mixed</b>: the temperature wandered, and so did the salt.');
      else lines.push('The grain is even and true: the merchant runs it through his fingers and says nothing, which is praise.');
    }
    if (wetShare > 0.05) lines.push(Math.round(wetShare * 100) + '% of it was drawn in the last eight hours and goes aboard <b>still dripping</b>; the merchant docks it a tenth for the water.');
    if (S.burnt) lines.push((S.burnt > 1 ? S.burnt + ' burned plates cost ' : 'The burned plate cost ') + money(S.repairs) + ' and ' + (16 * S.burnt) + ' hours.');
    if (early) lines.push('You loaded the boat ' + Math.round(day.hrs - S.h) + ' hours early.');
    v.innerHTML = '<p>' + lines.join(' ') + '</p><p>The works clears <b>' + money(profit) + '</b> on the order.</p>';

    var rows = [
      [o.name + ' for the order', tons(sold), money(revGood)],
      ['more of it, sold on cheaper', tons(extra), money(revExtra)],
      ['off-grain salt, sold as seconds', tons(off), money(revOff)],
      ['coal burned', tons(S.coal), 'minus ' + money(coalCost)],
      ['wallers and stoker, ' + Math.round(S.h) + ' hours', '', 'minus ' + money(wages)]
    ];
    if (S.repairs) rows.push(['the smith, for the plate', '', 'minus ' + money(S.repairs)]);
    reveal(rows, profit);
    $('bAgain').style.display = '';
    hud(); draw();
  }

  function reveal(rows, profit) {
    var R = $('reveal');
    R.style.display = '';
    var html = '<h5>The pan, hour by hour</h5>' +
      '<canvas id="trace" width="640" height="250" aria-label="The brine temperature, the scale and the salt drawn, against the hours."></canvas>' +
      '<div class="key"><span><i style="background:#ffb27a"></i>brine temperature</span><span><i style="background:rgba(242,211,107,.35);height:8px"></i>warmth that makes this grain</span>' +
      '<span><i style="background:#64f0c8"></i>salt drawn</span><span><i style="background:#c9a27a"></i>scale</span><span><i style="background:#7aa2ff"></i>wind</span></div>' +
      '<p>Marks along the bottom: D a draw, S the fire let down to scratch, F the pan refilled, ! a plate burned. The dashed line is the order.</p>' +
      '<h5>The grain on the hurdles</h5>' +
      '<canvas id="grain" width="640" height="170" aria-label="How the salt drawn is spread across sizes of grain, against the size the order wanted."></canvas>' +
      '<p>Every draw is spread across a range of sizes. The shaded band is what the merchant will take as ' + day.order.name + '.</p>' +
      '<h5>The account</h5><table class="card">';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n">' + r[2] + '</td></tr>';
    });
    html += '<tr class="tot"><td>Cleared</td><td class="n"></td><td class="n">' + money(profit) + '</td></tr></table>';
    R.innerHTML = html;
    drawTrace($('trace'));
    drawGrain($('grain'));
  }

  function drawTrace(cv) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    var L = 44, Rr = 44, T0 = 16, B = 34;
    var tr = S.trace.length ? S.trace : [{ h: 0, T: S.T, scale: 0, drawn: 0, w: 0 }];
    var hmax = Math.max(day.hrs, tr[tr.length - 1].h);
    var lo = 40, hi = 240;
    var mmax = Math.max(day.target * 1.25, drawnMass() * 1.1, 1);
    function X(h) { return L + (W - L - Rr) * h / hmax; }
    function YT(v) { return T0 + (H - T0 - B) * (1 - (v - lo) / (hi - lo)); }
    function YM(m) { return T0 + (H - T0 - B) * (1 - m / mmax); }
    function Y1(f) { return T0 + (H - T0 - B) * (1 - f); }
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H);
    var o = day.order;
    var tHi = o.lo > 0 ? Math.min(hi, tempFor(o.lo)) : hi, tLo = Math.max(lo, tempFor(o.hi));
    c.fillStyle = 'rgba(242,211,107,.13)';
    c.fillRect(L, YT(tHi), W - L - Rr, YT(tLo) - YT(tHi));
    // scratch periods
    c.fillStyle = 'rgba(255,255,255,.05)';
    tr.forEach(function (p, i) { if (p.sc && i) c.fillRect(X(tr[i - 1].h), T0, X(p.h) - X(tr[i - 1].h) + 0.5, H - T0 - B); });
    c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#8b97ab';
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
    for (var v = 60; v <= hi; v += 40) {
      c.beginPath(); c.moveTo(L, YT(v)); c.lineTo(W - Rr, YT(v)); c.stroke();
      c.textAlign = 'right'; c.fillText(v + '°', L - 6, YT(v) + 3);
    }
    c.textAlign = 'left'; c.fillStyle = 'rgba(100,240,200,.75)';
    c.fillText(day.target + ' t', W - Rr + 4, YM(day.target) + 3);
    c.setLineDash([4, 4]); c.strokeStyle = 'rgba(100,240,200,.35)';
    c.beginPath(); c.moveTo(L, YM(day.target)); c.lineTo(W - Rr, YM(day.target)); c.stroke(); c.setLineDash([]);
    c.textAlign = 'center'; c.fillStyle = '#8b97ab';
    var stepH = hmax > 120 ? 24 : 12;
    for (var h = 0; h <= hmax; h += stepH) c.fillText(h + 'h', X(h), H - 8);
    function line(f, col, w) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      tr.forEach(function (p, i) { var y = f(p); if (i) c.lineTo(X(p.h), y); else c.moveTo(X(p.h), y); });
      c.stroke();
    }
    line(function (p) { return Y1(Math.min(1.4, p.w) / 1.4 * 0.3); }, 'rgba(122,162,255,.6)', 1);
    line(function (p) { return Y1(Math.min(1, p.scale)); }, 'rgba(201,162,122,.8)', 1.2);
    line(function (p) { return YM(p.drawn); }, '#64f0c8', 2);
    line(function (p) { return YT(p.T); }, '#ffb27a', 2);
    c.font = '600 10px ui-monospace,Menlo,monospace';
    S.events.forEach(function (e) {
      var ch = { draw: 'D', scratch: 'S', fill: 'F', burn: '!' }[e.k];
      if (!ch) return;
      c.fillStyle = e.k === 'burn' ? '#ff7a7a' : e.k === 'draw' ? '#64f0c8' : '#e8edf5';
      c.fillText(ch, X(e.h), H - 20);
    });
  }

  function drawGrain(cv) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    var L = 44, Rr = 20, T0 = 12, B = 28;
    var smin = 0.1, smax = 30, NB = 60;
    function X(s) { return L + (W - L - Rr) * Math.log(s / smin) / Math.log(smax / smin); }
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H);
    var o = day.order;
    c.fillStyle = 'rgba(242,211,107,.14)';
    var xa = X(Math.max(smin, o.lo || smin)), xb = X(o.hi);
    c.fillRect(xa, T0, xb - xa, H - T0 - B);
    var bins = [], maxv = 0;
    for (var i = 0; i < NB; i++) {
      var a = smin * Math.pow(smax / smin, i / NB), b = smin * Math.pow(smax / smin, (i + 1) / NB), sum = 0;
      S.drawn.forEach(function (d) {
        var ls = Math.log(d.s);
        sum += d.m * (Phi((Math.log(b) - ls) / SIGMA) - Phi((Math.log(a) - ls) / SIGMA));
      });
      bins.push({ a: a, b: b, v: sum });
      if (sum > maxv) maxv = sum;
    }
    if (maxv > 0) bins.forEach(function (bn) {
      var x0 = X(bn.a), x1 = X(bn.b), hgt = (H - T0 - B) * bn.v / maxv;
      var mid = Math.sqrt(bn.a * bn.b), ok = mid <= o.hi && mid >= (o.lo || 0);
      c.fillStyle = ok ? 'rgba(100,240,200,.75)' : 'rgba(255,178,122,.7)';
      c.fillRect(x0 + 0.5, H - B - hgt, Math.max(1, x1 - x0 - 1), hgt);
    });
    c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#8b97ab'; c.textAlign = 'center';
    [0.1, 0.3, 1, 3, 10, 30].forEach(function (s) { c.fillText(s + ' mm', X(s), H - 9); });
    c.textAlign = 'left';
    c.fillText('fine', L, T0 + 8);
    c.textAlign = 'right';
    c.fillText('coarse', W - Rr, T0 + 8);
  }

  /* ---------- drawing the pan house ---------- */
  function draw() {
    var W = canvas.width, H = canvas.height, c = ctx;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1f26'); g.addColorStop(1, '#11151a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var running = S.phase === 'run' && S.scratch <= 0;
    var w = windAt(S.h);

    // roof louvre and timbers, dark with steam
    c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 70); c.lineTo(215, 14); c.lineTo(430, 70); c.stroke();
    c.fillStyle = '#232a33'; c.fillRect(185, 6, 60, 16);
    c.strokeStyle = '#1a2028'; c.lineWidth = 2;
    for (var lx = 190; lx < 245; lx += 8) { c.beginPath(); c.moveTo(lx, 8); c.lineTo(lx + 4, 20); c.stroke(); }

    // chimney and smoke, leaning with the wind
    c.fillStyle = '#3a2a22'; c.fillRect(440, 30, 22, 220);
    c.fillStyle = '#2c2019'; c.fillRect(436, 26, 30, 8);
    var smoke = S.phase === 'run' ? (S.scratch > 0 ? 0.08 : 0.1 + S.fire / 140) : 0.06;
    var t = performance.now() / 1000;
    for (var i = 0; i < 9; i++) {
      var k = ((t * 0.35 + i / 9) % 1);
      var sx = 451 + k * (30 + 110 * w), sy = 22 - k * (40 - 22 * Math.min(1, w));
      c.fillStyle = 'rgba(150,150,155,' + (smoke * (1 - k)) + ')';
      c.beginPath(); c.arc(sx, sy, 5 + k * 16, 0, Math.PI * 2); c.fill();
    }

    // brick furnace and flues under the pan
    c.fillStyle = '#4a2c22'; c.fillRect(22, 246, 418, 70);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
    for (var by = 250; by < 316; by += 9) {
      c.beginPath(); c.moveTo(22, by); c.lineTo(440, by); c.stroke();
      for (var bx = 22 + ((by / 9) % 2) * 12; bx < 440; bx += 24) { c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by + 9); c.stroke(); }
    }
    // the fire door and the glow along the flue
    var glow = S.phase === 'run' && S.scratch <= 0 ? S.fire / 100 * (0.88 + 0.26 * w) : 0;
    var fg = c.createLinearGradient(40, 0, 440, 0);
    fg.addColorStop(0, 'rgba(255,140,40,' + (0.15 + 0.75 * glow) + ')');
    fg.addColorStop(0.4, 'rgba(255,90,30,' + (0.35 * glow) + ')');
    fg.addColorStop(1, 'rgba(255,60,20,0)');
    c.fillStyle = fg; c.fillRect(30, 256, 410, 22);
    c.fillStyle = '#16100c'; c.fillRect(36, 282, 40, 26);
    c.fillStyle = 'rgba(255,150,50,' + (0.2 + 0.7 * glow) + ')';
    c.fillRect(40, 286, 32, 18);
    if (glow > 0) {
      for (var fl = 0; fl < 5; fl++) {
        var fh = 6 + 10 * glow * (0.6 + 0.4 * Math.sin(t * 7 + fl * 1.7));
        c.fillStyle = 'rgba(255,' + (190 - fl * 20) + ',80,' + (0.5 + 0.4 * glow) + ')';
        c.beginPath(); c.moveTo(42 + fl * 6, 304); c.lineTo(45 + fl * 6, 304 - fh); c.lineTo(48 + fl * 6, 304); c.fill();
      }
    }
    // a red patch where the plate is burning under the scale
    if (S.hazard > 0.5 && S.scratch <= 0) {
      c.fillStyle = 'rgba(255,60,30,' + clamp(0.25 + S.burn * 0.6, 0, 0.9) * (0.75 + 0.25 * Math.sin(t * 5)) + ')';
      c.fillRect(70, 244, 120, 6);
    }

    // the pan: an iron tray with the brine in it, scale on the plate and salt lying on the scale
    var px = 30, pw = 404, py = 196, ph = 50;
    c.fillStyle = '#2b3036'; c.fillRect(px - 4, py, pw + 8, ph + 2);
    var scaleH = Math.min(10, S.scale * 10);
    var saltH = Math.min(30, inPan() / (day.area / 1000) * 3.2);
    var brineTop = py + 8;
    if (S.scratch > 0) brineTop = py + ph - scaleH;     // run off
    var heat = clamp((S.T - 60) / 170, 0, 1);
    c.fillStyle = 'rgba(' + Math.round(70 + 60 * heat) + ',' + Math.round(110 + 30 * heat) + ',' + Math.round(140 - 10 * heat) + ',.85)';
    c.fillRect(px, brineTop, pw, py + ph - brineTop);
    c.fillStyle = 'rgba(201,162,122,.9)';
    c.fillRect(px, py + ph - scaleH, pw, scaleH);
    if (saltH > 0.3) {
      c.fillStyle = 'rgba(238,240,236,.92)';
      c.beginPath();
      c.moveTo(px, py + ph - scaleH);
      for (var sx2 = 0; sx2 <= pw; sx2 += 16) c.lineTo(px + sx2, py + ph - scaleH - saltH * (0.75 + 0.25 * Math.sin(sx2 * 0.07 + 1)));
      c.lineTo(px + pw, py + ph - scaleH); c.closePath(); c.fill();
    }
    // salt crusting on the surface of a cool pan: little floating hoppers
    if (running && S.evapFill >= day.preSat) {
      var nF = S.T < 160 ? 26 : S.T < 205 ? 14 : 0;
      for (var hf = 0; hf < nF; hf++) {
        var d0 = dots[hf], hx = px + 10 + (d0.x + 1) / 2 * (pw - 20), sz = clamp(sizeAt(S.T) * 1.3, 2, 9);
        c.fillStyle = 'rgba(240,242,238,.75)';
        c.fillRect(hx, brineTop - sz * 0.35, sz, sz * 0.5);
      }
    }
    // the wallers' sloping hurdles beside the pan, with the salt drawn heaped on them
    var dm = drawnMass(), fill = clamp(dm / Math.max(1, day.target), 0, 1.3);
    c.fillStyle = '#3d3226'; c.fillRect(22, 176, 120, 6);
    c.fillStyle = 'rgba(238,240,236,.9)';
    if (dm > 0.01) {
      c.beginPath(); c.moveTo(26, 176);
      c.quadraticCurveTo(82, 176 - 46 * fill, 138, 176); c.closePath(); c.fill();
    }
    c.fillStyle = '#8b97ab'; c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText('HURDLES ' + tons(dm), 82, 192);

    // steam
    if (running) {
      var st = clamp(S.steam / EV, 0, 2);
      var n = Math.round(6 + 24 * Math.min(1, st));
      for (var j = 0; j < n; j++) {
        var d1 = dots[j + 30], kk = ((t * (0.18 + 0.12 * st) + d1.sh) % 1);
        var cx = px + 20 + (d1.x + 1) / 2 * (pw - 40) + Math.sin(t + j) * 8 + kk * 40 * w;
        var cy = brineTop - 4 - kk * (110 + 40 * st);
        c.fillStyle = 'rgba(220,228,236,' + (0.05 + 0.18 * Math.min(1, st)) * (1 - kk) + ')';
        c.beginPath(); c.arc(cx, cy, 6 + kk * 22 * (0.5 + st / 2), 0, Math.PI * 2); c.fill();
      }
      if (S.T >= BOIL - 0.3) {
        c.fillStyle = 'rgba(255,255,255,.35)';
        for (var bb = 0; bb < 18 * S.boost; bb++) {
          var d2 = dots[bb % 90];
          c.beginPath(); c.arc(px + 8 + ((d2.x + 1) / 2 * (pw - 16) + t * 30 * d2.k) % (pw - 16), brineTop + 1 + Math.abs(Math.sin(t * 6 + bb)) * 4, 1.6, 0, Math.PI * 2); c.fill();
        }
      }
    }
    if (S.scratch > 0 && S.phase === 'run') {
      c.fillStyle = '#c9ced6'; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
      c.fillText('PAN RUN OFF · SCRATCHING · ' + Math.ceil(S.scratch) + 'h', px + pw / 2, py + 26);
    }

    drawThermo(c);
    drawLoupe(c);
    drawProgress(c);
  }

  function drawThermo(c) {
    var x = 486, top = 40, bot = 280;
    function Y(v) { return bot - (bot - top) * (v - 40) / (240 - 40); }
    c.fillStyle = '#1b2129'; c.fillRect(x - 12, top - 8, 24, bot - top + 26);
    c.strokeStyle = '#3a4350'; c.lineWidth = 1; c.strokeRect(x - 12, top - 8, 24, bot - top + 26);
    var o = day.order;
    var tHi = o.lo > 0 ? tempFor(o.lo) : 240, tLo = tempFor(o.hi);
    c.fillStyle = 'rgba(242,211,107,.22)';
    c.fillRect(x - 10, Y(Math.min(240, tHi)), 20, Y(Math.max(40, tLo)) - Y(Math.min(240, tHi)));
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - 3, top, 6, bot - top);
    c.fillStyle = '#c0392b'; c.fillRect(x - 2, Y(clamp(S.T, 40, 240)), 4, bot - Y(clamp(S.T, 40, 240)));
    c.beginPath(); c.arc(x, bot + 8, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8b97ab'; c.font = '9px ui-monospace,Menlo,monospace'; c.textAlign = 'right';
    [60, 100, 140, 180, 226].forEach(function (v) { c.fillText(v, x - 14, Y(v) + 3); });
    c.textAlign = 'center'; c.fillStyle = '#e8edf5'; c.font = '600 10px ui-monospace,Menlo,monospace';
    c.fillText(Math.round(S.T) + '°', x, top - 14);
  }

  function drawLoupe(c) {
    var cx = 572, cy = 112, r = 58;
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#26303a'; c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    // show the newest salt: in the pan if there is any, else the last drawn
    var src = S.pan.length ? S.pan[S.pan.length - 1] : S.drawn.length ? S.drawn[S.drawn.length - 1] : null;
    var s = src ? src.s : sizeAt(S.T);
    var px = clamp(s * 9, 1.4, 34);     // 9 px to the millimetre under the glass
    var n = clamp(Math.round(1600 / (px * px)), 3, 90);
    for (var i = 0; i < n; i++) {
      var d = dots[i], z = px * d.k;
      var x = cx + d.x * (r - 4), y = cy + d.y * (r - 4);
      c.save(); c.translate(x, y); c.rotate(d.a);
      c.fillStyle = src ? 'rgba(242,244,240,.9)' : 'rgba(242,244,240,.2)';
      c.fillRect(-z / 2, -z / 2, z, z);
      if (z > 9) {     // hopper crystals: stepped hollow faces
        c.strokeStyle = 'rgba(120,130,140,.55)'; c.lineWidth = 1;
        for (var q = 0.25; q < 0.9; q += 0.22) c.strokeRect(-z * q / 2, -z * q / 2, z * q, z * q);
      }
      c.restore();
    }
    c.restore();
    c.strokeStyle = '#8a7a5a'; c.lineWidth = 5;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 7; c.beginPath(); c.moveTo(cx + r * 0.72, cy + r * 0.72); c.lineTo(cx + r * 1.05, cy + r * 1.05); c.stroke();
    c.fillStyle = '#8b97ab'; c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText(src ? (S.pan.length ? 'IN THE PAN ' : 'LAST DRAWN ') + mm(s) : 'NO SALT YET', cx, cy + r + 30);
    // a millimetre rule under the glass
    c.fillStyle = '#c9ced6'; c.fillRect(cx - 4.5, cy + r + 14, 9, 2);
    c.fillText('1 mm', cx + 24, cy + r + 18);
  }

  function drawProgress(c) {
    var x = 514, y = 238, w = 112, h = 10;
    var o = day.order, good = 0;
    S.drawn.forEach(function (d) { good += d.m * inSpec(d); });
    var all = drawnMass();
    c.fillStyle = '#8b97ab'; c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'left';
    c.fillText('ORDER ' + day.target + ' t ' + o.name.toUpperCase(), x, y - 6);
    c.fillStyle = '#1b2129'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,178,122,.7)'; c.fillRect(x, y, w * clamp(all / day.target, 0, 1), h);
    c.fillStyle = 'rgba(100,240,200,.85)'; c.fillRect(x, y, w * clamp(good / day.target, 0, 1), h);
    c.strokeStyle = '#3a4350'; c.strokeRect(x, y, w, h);
    c.fillStyle = '#8b97ab'; c.fillText('on grain ' + tons(good), x, y + 24);
    c.fillText('coal ' + tons(S.coal), x, y + 38);
    c.fillText('fire: ' + (S.scratch > 0 ? 'out' : fireText(S.fire)), x, y + 52);
  }

  /* ---------- keys and days ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (S.phase !== 'run') return;
    if (e.code === 'ArrowUp') { e.preventDefault(); setFire(S.fire + 2); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); setFire(S.fire - 2); }
    else if (e.code === 'KeyD') doDraw();
    else if (e.code === 'Space') { e.preventDefault(); $('bPause').click(); }
  });
  $('bAgain').addEventListener('click', function () { fresh(); });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  // keep the smoke and steam moving while the page waits to start
  function idle() { if (S && S.phase !== 'run') draw(); requestAnimationFrame(idle); }

  loadDay(0);
  requestAnimationFrame(idle);
})();
