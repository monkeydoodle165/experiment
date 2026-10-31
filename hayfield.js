/* drift.quibo.games — The Hayfield
   One week of haysel, Monday dawn to Saturday night, in a June or July some time between 1820 and 1899. The day's
   number picks the farm (and with it how wet the country is), the meadow and how many acres it holds, how many
   scythes there are, what hay is fetching that year, and the whole week's weather an hour at a time: one to four
   depressions coming in off the sea, each one dragging the glass down ahead of its rain, and on the warm days a
   chance of thunder showers in the afternoon.

   The meadow is cut into four lands. Each land of grass goes standing, mown into the swath, tedded (thrown about
   to dry), turned, raked into windrows, put up in cocks for the night or against a shower, and at last pitched
   onto the wagon and led to the rick. Cut grass is three parts water; hay that goes into the rick with more than a
   quarter of its weight in water heats, and too much heats until it chars or catches. Hay left spread in the rain
   is washed of its goodness; hay left lying wet too long goes musty; hay turned when it is already brittle leaves
   its leaf on the ground. There is one gang and they can only be in one place at once.

   Water is carried as a dry-basis ratio W (water / dry matter). It moves toward the equilibrium the air allows at a
   rate set by sun, wind and how open the hay lies, and rain adds to it in proportion to how exposed it is.
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
    var h = s ^ 0x5be1f00d;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  function money(d) {
    d = Math.max(0, Math.round(d));
    var l = Math.floor(d / 240), s = Math.floor((d % 240) / 12), p = d % 12;
    var out = [];
    if (l) out.push('£' + l);
    if (s) out.push(s + 's');
    if (p || !out.length) out.push(p + 'd');
    return out.join(' ');
  }

  /* ---------- constants ---------- */
  var HOURS = 6 * 24;       // Monday 00:00 to Saturday 24:00
  var START = 5, STOP = 20; // the gang works five in the morning till eight at night
  var W0 = 3.5;             // fresh grass: 78% water, 3.5 parts water to one of dry matter
  var SAFE = 0.33;          // 25% water: dry enough to rick (dry basis)
  var BRITTLE = 0.18;       // below about 15% water the leaf shatters when it is handled

  var FARMS = [
    { place: 'Hawes', county: 'Wensleydale', wet: 1.35, sea: 'the Irish Sea' },
    { place: 'Keswick', county: 'Cumberland', wet: 1.45, sea: 'the Irish Sea' },
    { place: 'Bala', county: 'Merionethshire', wet: 1.4, sea: 'Cardigan Bay' },
    { place: 'Ledbury', county: 'Herefordshire', wet: 1.0, sea: 'the Bristol Channel' },
    { place: 'Langport', county: 'Somerset', wet: 1.05, sea: 'the Bristol Channel' },
    { place: 'Sturminster Newton', county: 'Dorset', wet: 0.95, sea: 'the Channel' },
    { place: 'Tetbury', county: 'Gloucestershire', wet: 0.95, sea: 'the Bristol Channel' },
    { place: 'Thame', county: 'Oxfordshire', wet: 0.85, sea: 'the west' },
    { place: 'Stowmarket', county: 'Suffolk', wet: 0.7, sea: 'the west' },
    { place: 'Penrith', county: 'Cumberland', wet: 1.25, sea: 'the Solway' },
    { place: 'Whalley', county: 'Lancashire', wet: 1.3, sea: 'the Irish Sea' },
    { place: 'Melton Mowbray', county: 'Leicestershire', wet: 0.85, sea: 'the west' }
  ];
  var MEADOWS = ['Long Meadow', 'Church Close', 'the Ten Acre', 'Brook Meadow', 'Great Leaze', 'the Lammas Ground', 'Mill Mead', 'Far Ings', 'Broad Mead', 'the Hay Close'];
  var MASTERS = ['Atkinson', 'Bowden', 'Cottam', 'Dent', 'Fairclough', 'Garth', 'Hebden', 'Kitching', 'Lister', 'Metcalfe', 'Pratt', 'Raw', 'Sowerby', 'Tennant', 'Whitehead'];
  var LANDS = ['Top land', 'Second land', 'Third land', 'Brook end'];

  /* task: from which states, to which state, hours per acre for the whole gang (mowing: per scythe) */
  var TASKS = {
    mow:    { name: 'Mow',             verb: 'mowing',          from: ['standing'], to: 'swath', hpa: 9 },
    ted:    { name: 'Ted it out',      verb: 'tedding',         from: ['swath'], to: 'spread', hpa: 1.3 },
    turn:   { name: 'Turn it',         verb: 'turning',         from: ['spread'], to: 'spread', hpa: 1.1 },
    row:    { name: 'Rake into rows',  verb: 'raking into windrows', from: ['spread', 'swath'], to: 'windrow', hpa: 1.0 },
    cock:   { name: 'Put up in cocks', verb: 'cocking',         from: ['windrow', 'spread'], to: 'cocks', hpa: 1.6 },
    open:   { name: 'Shake out the cocks', verb: 'shaking out the cocks', from: ['cocks', 'windrow'], to: 'spread', hpa: 0.9 },
    carry:  { name: 'Lead it to the rick', verb: 'leading',     from: ['windrow', 'cocks'], to: 'rick', hpa: 2.4 }
  };
  var ORDER = ['mow', 'ted', 'turn', 'row', 'cock', 'open', 'carry'];
  /* how freely each state dries, and how much of the rain lands on it */
  var LIE = {
    standing: { dry: 0, wet: 0 },
    swath:    { dry: 0.34, wet: 0.7 },
    spread:   { dry: 1.0, wet: 1.0 },
    windrow:  { dry: 0.42, wet: 0.5 },
    cocks:    { dry: 0.1, wet: 0.12 },
    rick:     { dry: 0, wet: 0 }
  };

  /* ---------- the week's weather, hour by hour ---------- */
  function sunEl(hh) { return Math.max(0, Math.sin(Math.PI * (hh - 4.4) / 16.6)); }
  function makeWeather(r, farm) {
    var n = 1 + Math.floor(r() * (1.5 + 1.5 * farm.wet));
    var lows = [];
    for (var i = 0; i < n; i++) {
      lows.push({ t: -6 + r() * (HOURS + 12), w: 7 + r() * 12, d: 6 + r() * 17 * farm.wet });
    }
    lows.sort(function (a, b) { return a.t - b.t; });
    var base = 1019 + r() * 6, walk = 0;
    var showery = [];
    for (var dd = 0; dd < 6; dd++) showery.push(r() < 0.18 + 0.2 * farm.wet ? 0.4 + r() * 0.6 : 0);
    var P = [], RAIN = [], CLOUD = [], SUN = [], WIND = [], RH = [], noise = [];
    for (var h = -6; h < HOURS; h++) {
      walk = walk * 0.97 + (r() - 0.5) * 0.6;
      var p = base + walk, front = 0, gust = 0;
      for (var j = 0; j < lows.length; j++) {
        var L = lows[j], u = (h - L.t) / L.w;
        p -= L.d * Math.exp(-u * u);
        var uf = (h - (L.t - 0.1 * L.w)) / (0.42 * L.w);
        front += (L.d / 18) * Math.exp(-uf * uf);
        gust += (L.d / 7) * Math.exp(-u * u * 0.6);
      }
      if (h < 0) continue;
      var hh = h % 24, dayi = Math.floor(h / 24);
      var mm = 0;
      if (front > 0.4) mm = (front - 0.3) * 1.3 * farm.wet * (0.5 + r() * 1.0);
      var sh = showery[dayi];
      if (sh && hh >= 12 && hh <= 18 && r() < sh * 0.3 * smoothDay(hh)) mm += 0.5 + r() * 3 * sh;
      var cl = 0.12 + (1021 - p) / 22 + front * 0.6 + (sh && hh >= 11 && hh <= 19 ? sh * 0.35 : 0) + (r() - 0.5) * 0.25;
      if (mm > 0) cl = Math.max(cl, 0.85);
      cl = clamp(cl, 0.02, 1);
      var se = sunEl(hh), sun = se * (1 - 0.88 * cl);
      var wind = clamp(1.5 + gust + r() * 1.5 + se * 1.2, 0.3, 14);
      var rh = clamp(0.55 + 0.22 * cl - 0.32 * sun + (se === 0 ? 0.3 : 0) + (mm > 0 ? 0.4 : 0), 0.32, 1);
      P.push(p); RAIN.push(Math.round(mm * 10) / 10); CLOUD.push(cl); SUN.push(sun); WIND.push(wind); RH.push(rh);
    }
    return { P: P, RAIN: RAIN, CLOUD: CLOUD, SUN: SUN, WIND: WIND, RH: RH, lows: lows, showery: showery };
  }
  function smoothDay(hh) { return Math.sin(Math.PI * (hh - 11) / 8); }

  function makeDay(off) {
    var d = dateFor(off || 0), r = rng(seedForDate(d));
    var farm = pick(r, FARMS);
    var year = 1820 + Math.floor(r() * 80);
    /* a Monday between the middle of June and the middle of July */
    var st = new Date(year, 5, 14 + Math.floor(r() * 26), 12);
    while (st.getDay() !== 1) st.setDate(st.getDate() + 1);
    var acres = 6 + Math.floor(r() * 7);
    var scythes = 3 + Math.floor(r() * 4);
    var yieldPA = 1.1 + r() * 0.6;       // tons of hay to the acre
    var price = Math.round(60 + r() * 70); // shillings a ton for good hay that year
    var wx = makeWeather(r, farm);
    var split = [], tot = 0;
    for (var i = 0; i < 4; i++) { split.push(0.8 + r() * 0.4); tot += split[i]; }
    var lands = split.map(function (s, k) { return { name: LANDS[k], acres: Math.round(acres * s / tot * 10) / 10 }; });
    return {
      off: off || 0, date: d, farm: farm, year: year, start: st, acres: acres, scythes: scythes, yieldPA: yieldPA,
      price: price, wx: wx, lands: lands, meadow: pick(r, MEADOWS), master: pick(r, MASTERS),
      wage: 2 + Math.floor(r() * 2), // shillings a day a scythe, beer found
      dateStr: d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    };
  }
  function dayDate(d, h) { var x = new Date(d.start); x.setDate(x.getDate() + Math.floor(h / 24)); return x; }
  function whenStr(d, h) {
    var x = dayDate(d, h), hh = Math.floor(h) % 24;
    return WEEKDAYS[x.getDay()] + ' ' + (hh % 12 === 0 ? 12 : hh % 12) + (hh < 12 ? 'am' : 'pm');
  }

  /* ---------- a run ---------- */
  function newRun(d) {
    return {
      h: 0, lands: d.lands.map(function (L) {
        return { name: L.name, acres: L.acres, state: 'standing', W: W0, Q: 1, fluff: 0, log: [], hist: [], at: null, washed: 0 };
      }),
      task: null, rick: [], over: false, msgs: [], acts: []
    };
  }
  function taskHours(d, L, k) {
    var T = TASKS[k];
    return k === 'mow' ? L.acres * T.hpa / d.scythes : L.acres * T.hpa * (4 / Math.max(3, d.scythes - 0)) * 0.9;
  }
  function canDo(L, k) { return TASKS[k].from.indexOf(L.state) >= 0; }
  function working(h) { var hh = h % 24; return hh >= START && hh < STOP; }
  function wxAt(d, h) {
    var i = clamp(Math.floor(h), 0, HOURS - 1), w = d.wx;
    return { p: w.P[i], rain: w.RAIN[i], cloud: w.CLOUD[i], sun: w.SUN[i], wind: w.WIND[i], rh: w.RH[i] };
  }
  function weq(rh) { return 0.09 + 0.36 * rh * rh * rh; }

  function startTask(d, run, li, k) {
    var L = run.lands[li];
    if (!canDo(L, k) || run.over) return false;
    run.task = { li: li, k: k, need: taskHours(d, L, k), done: 0, h0: run.h };
    return true;
  }

  /* advance one hour (or part of one). Returns a list of things worth saying. */
  function tick(d, run, dt) {
    var out = [];
    if (run.over) return out;
    var h0 = run.h, x = wxAt(d, h0), hh = Math.floor(h0) % 24;
    /* the gang */
    var tk = run.task;
    if (tk && working(h0)) {
      tk.done += dt * (x.rain > 0.3 ? 0.7 : 1);
      if (tk.done >= tk.need) {
        var L = run.lands[tk.li], T = TASKS[tk.k];
        var M = L.W / (1 + L.W);
        if ((tk.k === 'ted' || tk.k === 'turn') && L.W < 0.45) { L.Q -= 0.035; L.shatter = (L.shatter || 0) + 1; }
        if ((tk.k === 'row' || tk.k === 'cock' || tk.k === 'open') && L.W < BRITTLE) { L.Q -= 0.02; L.shatter = (L.shatter || 0) + 1; }
        if (tk.k === 'carry' && L.W < BRITTLE) { L.Q -= 0.015; }
        if (tk.k === 'ted' || tk.k === 'turn' || tk.k === 'open') L.fluff = 1;
        L.state = T.to;
        run.acts.push({ h: run.h, li: tk.li, k: tk.k });
        if (tk.k === 'mow') L.mownAt = run.h;
        if (tk.k === 'carry') {
          var tons = L.acres * d.yieldPA * (0.82 + 0.18 * clamp(L.Q, 0, 1));
          run.rick.push({ li: tk.li, W: L.W, Q: L.Q, tons: tons, h: run.h });
          L.carriedAt = run.h;
        }
        out.push({ k: 'done', li: tk.li, task: tk.k, M: M });
        run.task = null;
      }
    }
    /* the hay */
    for (var i = 0; i < run.lands.length; i++) {
      var Ld = run.lands[i], lie = LIE[Ld.state];
      if (Ld.state === 'standing') {
        if (h0 > 60) Ld.Q -= 0.0007 * dt; // going past its best: seeding, stalky
        continue;
      }
      if (Ld.state === 'rick') continue;
      var eq = weq(x.rh);
      var dry = lie.dry;
      if (Ld.state === 'spread') { dry = 0.5 + 0.5 * Ld.fluff; Ld.fluff *= Math.exp(-dt / 9); }
      if (Ld.W > eq) {
        var k = 0.26 * dry * (0.1 + 0.9 * x.sun) * (0.7 + 0.08 * Math.min(x.wind, 6));
        Ld.W = eq + (Ld.W - eq) * Math.exp(-k * dt);
      } else {
        Ld.W = eq + (Ld.W - eq) * Math.exp(-0.05 * lie.wet * dt);
      }
      if (x.rain > 0) {
        var wetting = x.rain * dt * 0.13 * lie.wet;
        var halfDry = clamp(1 - Ld.W / W0, 0, 1);
        Ld.Q -= x.rain * dt * 0.011 * lie.wet * (0.4 + halfDry);
        Ld.washed += x.rain * dt * lie.wet;
        Ld.W = Math.min(W0 * 1.15, Ld.W + wetting);
      }
      if (Ld.W > 1.2) Ld.Q -= 0.0016 * dt * (Ld.state === 'cocks' ? 2.2 : 1); // lying wet and breathing: the goodness goes, and a wet cock goes musty
      if (Ld.state === 'spread' && Ld.W < 0.6 && x.sun > 0.5) Ld.Q -= 0.0012 * dt;  // bleaching
      Ld.Q = Math.max(0.15, Ld.Q);
    }
    run.h += dt;
    var ni = Math.floor(run.h);
    if (ni !== Math.floor(h0)) {
      for (var j = 0; j < run.lands.length; j++) run.lands[j].hist.push({ W: run.lands[j].W, s: run.lands[j].state, Q: run.lands[j].Q });
    }
    var allIn = run.lands.every(function (L) { return L.state === 'rick'; });
    if (run.h >= HOURS || allIn) { run.h = Math.min(run.h, HOURS); run.over = true; run.early = allIn && run.h < HOURS - 4; out.push({ k: 'end' }); }
    return out;
  }

  /* ---------- what is in the rick, and what it does over the next six weeks ---------- */
  function settle(d, run) {
    var tons = 0, wsum = 0, qsum = 0, worst = 0;
    run.rick.forEach(function (ld) { tons += ld.tons; wsum += ld.W * ld.tons; qsum += ld.Q * ld.tons; worst = Math.max(worst, ld.W); });
    var Wm = tons ? wsum / tons : 0, Qm = tons ? qsum / tons : 0;
    /* heat: from the average wetness, and from the wettest load, which sits somewhere in the middle */
    var heat = Math.max(0, Wm - 0.22) * 0.75 + Math.max(0, worst - 0.3) * 0.4;
    var peak = tons ? Math.min(84, Math.round(24 + 210 * heat)) : 0;
    var fate = !tons ? 'none' : peak >= 72 ? 'fired' : peak >= 58 ? 'mowburnt' : peak >= 36 ? 'sweated' : Wm < 0.2 ? 'dusty' : 'cool';
    var keep = 1, qf = 1;
    if (fate === 'fired') { keep = 0.55; qf = 0.55; }
    else if (fate === 'mowburnt') { qf = 0.78; }
    else if (fate === 'sweated') { qf = 1.03; }
    var Qf = clamp(Qm * qf, 0, 1);
    var sold = tons * keep;
    var grade = Qf >= 0.88 ? 'prime' : Qf >= 0.74 ? 'good' : Qf >= 0.58 ? 'middling' : Qf >= 0.42 ? 'poor' : 'fit only for litter';
    var mult = Qf >= 0.42 ? Math.pow(Qf, 1.6) : 0.18;
    var worth = sold * d.price * 12 * mult; // pence
    /* what was left behind in the field */
    var left = [];
    run.lands.forEach(function (L, i) { if (L.state !== 'rick') left.push(i); });
    var leftTons = 0;
    left.forEach(function (i) { var L = run.lands[i]; leftTons += L.acres * d.yieldPA; });
    var curve = [];
    for (var day = 0; day <= 42; day++) {
      var x = day / 6;
      curve.push(tons ? 16 + (peak - 16) * x * Math.exp(1 - x) : 0);
    }
    var wages = d.scythes * d.wage * 12 * 6 * 1.6; // the scythes and the women and boys behind them, for the week
    return { tons: tons, Wm: Wm, Qm: Qm, Qf: Qf, worst: worst, peak: peak, fate: fate, grade: grade, sold: sold, worth: Math.round(worth), wages: Math.round(wages), left: left, leftTons: leftTons, curve: curve };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { makeDay: makeDay, newRun: newRun, tick: tick, startTask: startTask, settle: settle, canDo: canDo, taskHours: taskHours, working: working, wxAt: wxAt, TASKS: TASKS, HOURS: HOURS, SAFE: SAFE, W0: W0 };
  }
  if (typeof document === 'undefined') return;

  /* ===================================================================== page ===================================================================== */
  function $(id) { return document.getElementById(id); }
  var offset = 0, day = null, run = null, cv, ctx, last = 0, paused = true, speed = 1, idleSaid = false, blades = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLS = ['#64f0c8', '#7aa2ff', '#ffce6a', '#ff8fb1'];
  var SECS = [0, 1.5, 0.55]; // real seconds to an hour of daylight, by speed

  function say(html) {
    run.msgs.unshift('<div>' + html + '</div>');
    run.msgs = run.msgs.slice(0, 3);
    $('msg').innerHTML = run.msgs.join('');
  }

  function feel(W, state) {
    if (state === 'standing') return 'standing grass';
    if (state === 'rick') return 'in the rick';
    if (W > 2.2) return 'green and sappy';
    if (W > 1.2) return 'limp, still cold to the hand';
    if (W > 0.65) return 'wilted, damp in the middle';
    if (W > 0.4) return 'rustles, but the stalks bend';
    if (W > SAFE) return 'nearly: a twisted wisp still sweats';
    if (W > BRITTLE) return 'fit: it rattles, and the wisp snaps';
    return 'brittle, the leaf falling off';
  }
  function goodness(Q) {
    return Q > 0.93 ? 'green and sweet' : Q > 0.84 ? 'good colour' : Q > 0.72 ? 'faded a little' : Q > 0.58 ? 'washed and dull' : Q > 0.42 ? 'brown and poor' : 'black, musty';
  }
  var STATE = { standing: 'standing', swath: 'in the swath', spread: 'tedded out', windrow: 'in windrows', cocks: 'in cocks', rick: 'led home' };
  function glassWord(p) { return p < 990 ? 'Stormy' : p < 1003 ? 'Rain' : p < 1015 ? 'Change' : p < 1027 ? 'Fair' : 'Very dry'; }
  function tendency(h) {
    var i = Math.floor(h), j = Math.max(0, i - 3), P = day.wx.P;
    var dp = P[Math.min(i, HOURS - 1)] - P[j];
    return dp < -2.5 ? 'falling fast' : dp < -0.8 ? 'falling' : dp > 2 ? 'rising fast' : dp > 0.6 ? 'rising' : 'steady';
  }
  function skyWord(x, hh) {
    if (x.rain > 2.5) return 'pouring';
    if (x.rain > 0.6) return 'raining';
    if (x.rain > 0) return 'spitting';
    if (sunEl(hh) === 0) return x.cloud > 0.7 ? 'dark, overcast' : 'night, clear';
    return x.cloud < 0.25 ? 'hot sun' : x.cloud < 0.5 ? 'sun and cloud' : x.cloud < 0.8 ? 'grey' : 'dull, low cloud';
  }
  function windWord(w) { return w < 2 ? 'still' : w < 4 ? 'a light air' : w < 7 ? 'a good drying breeze' : w < 10 ? 'fresh' : 'blowing hard'; }

  function plaque() {
    var d = day, st = d.start;
    $('rWho').textContent = d.dateStr + ' · ' + d.farm.place + ', ' + d.farm.county;
    $('rName').textContent = cap1(d.meadow) + ', ' + d.acres + ' acres · haysel ' + st.getDate() + ' ' + MONTHS[st.getMonth()] + ' ' + d.year;
    var wet = d.farm.wet > 1.25 ? 'wet country, where the weather comes straight in off ' + d.farm.sea : d.farm.wet > 0.95 ? 'middling country for weather, with ' + d.farm.sea + ' to windward' : 'dry country, a long way from ' + d.farm.sea;
    $('rBlurb').innerHTML = 'Mr ' + d.master + ' has <b>' + d.acres + ' acres</b> of meadow fit to cut, in four lands. You have <b>' + NUMW[d.scythes] + ' scythes</b>, with women and boys behind them to ted and rake, at ' + d.wage + 's a day a man and beer found. ' +
      'It is ' + wet + '. Good hay is fetching <b>' + d.price + 's a ton</b> this year. ' +
      'Mow it, make it and lead it all to the rick by Saturday night. Hay put up with more than a quarter of it water will heat in the rick; hay left out in the rain is washed of what it is worth. ' +
      'There is a weatherglass on the kitchen wall, and it is the only forecast you will get.';
    $('dayOut').textContent = (offset === 0 ? 'Today' : offset < 0 ? (-offset) + ' day' + (offset < -1 ? 's' : '') + ' ago' : 'In ' + offset + ' day' + (offset > 1 ? 's' : '')) + ' · ' + d.farm.place + ' ' + d.year;
  }

  function buildCards() {
    var box = $('lands'); box.innerHTML = '';
    run.lands.forEach(function (L, i) {
      var c = document.createElement('div');
      c.className = 'land'; c.id = 'land' + i;
      c.innerHTML = '<h4><i style="background:' + COLS[i] + '"></i>' + L.name + ' <small>' + L.acres + ' ac</small></h4>' +
        '<p class="st" id="lst' + i + '"></p><p class="fe" id="lfe' + i + '"></p><p class="qu" id="lqu' + i + '"></p><div class="acts" id="lac' + i + '"></div>';
      box.appendChild(c);
    });
  }
  var lastSig = '';
  function sync() {
    var d = day, h = run.h, hh = Math.floor(h) % 24, x = wxAt(d, h);
    $('hWhen').textContent = run.over && !run.early ? 'Saturday night' : whenStr(d, h);
    $('hSky').textContent = skyWord(x, hh);
    $('hGlass').textContent = glassWord(x.p) + ', ' + tendency(h);
    $('hWind').textContent = windWord(x.wind);
    $('hGlass').parentNode.className = /falling/.test(tendency(h)) ? 'alarm' : '';
    var tk = run.task;
    $('hGang').textContent = tk ? TASKS[tk.k].verb + ', ' + run.lands[tk.li].name.toLowerCase() : (working(h) ? 'waiting for you' : 'gone home');
    $('hLeft').textContent = tk ? Math.max(1, Math.ceil(tk.need - tk.done)) + ' h of work' : '—';
    var tons = run.rick.reduce(function (s, l) { return s + l.tons; }, 0);
    $('hRick').textContent = tons ? tons.toFixed(1) + ' tons' : 'nothing yet';
    var sig = (tk ? tk.li + tk.k : '-') + run.over;
    run.lands.forEach(function (L, i) {
      $('lst' + i).textContent = cap1(STATE[L.state]) + (tk && tk.li === i ? ' · ' + TASKS[tk.k].verb + ' ' + Math.round(100 * tk.done / tk.need) + '%' : '');
      $('lfe' + i).textContent = L.state === 'standing' || L.state === 'rick' ? (L.state === 'rick' ? 'Led home ' + whenStr(d, L.carriedAt).replace(/ \d+[ap]m/, '') : (h > 60 ? 'going past its best' : 'in flower, ready to cut')) : feel(L.W, L.state);
      $('lqu' + i).textContent = L.state === 'standing' ? '' : goodness(L.Q);
      $('land' + i).className = 'land' + (tk && tk.li === i ? ' now' : '') + (L.state === 'rick' ? ' home' : '');
      sig += L.state;
    });
    if (sig !== lastSig) {
      lastSig = sig;
      run.lands.forEach(function (L, i) {
        var a = $('lac' + i); a.innerHTML = '';
        if (run.over) return;
        ORDER.forEach(function (k) {
          if (!canDo(L, k)) return;
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'btn small ghost';
          b.textContent = TASKS[k].name + ' · ' + Math.round(taskHours(d, L, k) * 10) / 10 + 'h';
          b.addEventListener('click', function () { order(i, k); });
          a.appendChild(b);
        });
      });
    }
    $('btnPlay').textContent = paused ? (run.h === 0 ? 'Start the week' : 'Let the clock run') : 'Hold the clock';
    $('btnPlay').disabled = run.over;
  }

  function order(li, k) {
    var L = run.lands[li];
    if (run.task && run.task.done > 0.05) {
      var was = run.task;
      say('The gang leaves off ' + TASKS[was.k].verb + ' the ' + run.lands[was.li].name.toLowerCase() + ' half done and comes over. What they had done is lost.');
    }
    var M = L.W;
    startTask(day, run, li, k);
    idleSaid = false;
    var note = '';
    if (k === 'carry' && M > SAFE * 1.25) note = ' Mr ' + day.master + ' pulls a wisp out of the row and twists it: <b>it is not fit</b>, but he will lead it if you say so.';
    if ((k === 'ted' || k === 'turn') && M < 0.45) note = ' It is dry enough already that the leaf will break off as it is thrown about.';
    say(cap1(TASKS[k].verb) + ' the ' + L.name.toLowerCase() + ': about ' + Math.round(run.task.need) + ' hours of work.' + note);
    if (paused && !run.over) paused = false;
    sync();
  }

  var lastSign = -1, lastRainSaid = -10;
  function onHour(h) {
    var hh = h % 24, x = wxAt(day, h), dayi = Math.floor(h / 24);
    if (hh === START && lastSign !== dayi) {
      lastSign = dayi;
      var ahead = 0; for (var k = h; k < Math.min(HOURS, h + 20); k++) ahead += day.wx.RAIN[k];
      var rs = rng(seedForDate(day.date) ^ (dayi * 7919));
      var signs;
      if (ahead > 4) signs = rs() < 0.72 ? ['A red sky at sunrise, and the swallows flying low over the meadow.', 'The far hills look very near this morning, and the cattle are lying down.', 'There is no dew on the grass this morning.'] : ['A clear, still dawn with a heavy dew.', 'The swallows are high.'];
      else signs = rs() < 0.75 ? ['A heavy dew and a grey dawn that burns off.', 'The swallows are high and the smoke goes straight up from the chimneys.', 'Mist lying in the bottom by the brook at sunrise.'] : ['A red sky at sunrise.', 'The cattle are all lying down.'];
      say('<b>' + WEEKDAYS[dayDate(day, h).getDay()] + ' morning.</b> ' + pick(rs, signs) + ' The glass says <b>' + glassWord(x.p) + '</b> and it is ' + tendency(h) + '.');
    }
    if (x.rain > 0.3 && h - lastRainSaid > 4 && working(h)) {
      lastRainSaid = h;
      var out = run.lands.filter(function (L) { return L.state === 'spread' || L.state === 'swath'; }).map(function (L) { return L.name.toLowerCase(); });
      say('It comes on to rain' + (x.rain > 2 ? ' hard' : '') + '.' + (out.length ? ' The ' + out.join(' and the ') + (out.length > 1 ? ' are' : ' is') + ' lying open to it.' : ''));
    } else if (x.rain > 0.3) lastRainSaid = h;
  }

  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!paused && !run.over) {
      var hh = Math.floor(run.h) % 24;
      var night = !working(run.h);
      var secs = night ? 0.12 : SECS[speed];
      var adv = dt / secs;
      while (adv > 0 && !run.over) {
        var step = Math.min(adv, 0.25, Math.floor(run.h) + 1 - run.h);
        if (step <= 1e-6) step = Math.min(adv, 0.25);
        var hb = Math.floor(run.h);
        var evs = tick(day, run, step);
        adv -= step;
        if (Math.floor(run.h) !== hb) onHour(Math.floor(run.h));
        for (var e = 0; e < evs.length; e++) {
          var ev = evs[e];
          if (ev.k === 'done') {
            var L = run.lands[ev.li];
            if (ev.task === 'carry') say('The last load off the ' + L.name.toLowerCase() + ' goes up on the rick. It went in <b>' + feel(L.W, 'cocks').split(':')[0] + '</b>.');
            else if (ev.task === 'mow') say('The ' + L.name.toLowerCase() + ' is all down in the swath.');
            else say('The ' + L.name.toLowerCase() + ' is ' + STATE[L.state] + '. It is ' + feel(L.W, L.state) + '.');
            paused = true; adv = 0;
          }
          if (ev.k === 'end') finishWeek();
        }
        if (!run.task && working(run.h) && !idleSaid && run.h > 0.5 && !paused) { idleSaid = true; }
      }
      if (!paused && hh === STOP - 1 && Math.floor(run.h) % 24 === STOP) {
        var lying = run.lands.filter(function (L) { return L.state === 'spread' || L.state === 'swath' || L.state === 'windrow'; }).length;
        say('Eight o\'clock, and the gang goes home.' + (lying ? ' What is lying out will take the dew tonight.' : ''));
      }
      sync();
    }
    paint(now);
    requestAnimationFrame(loop);
  }

  /* ---------- drawing ---------- */
  function makeBlades() {
    var r = rng(seedForDate(day.date) ^ 0x1234), b = [];
    for (var i = 0; i < 4; i++) {
      var s = [];
      for (var k = 0; k < 150; k++) s.push({ x: r(), y: r(), a: r(), l: r() });
      b.push(s);
    }
    var cl = [];
    for (var c = 0; c < 9; c++) cl.push({ x: r(), y: r(), w: 0.6 + r() * 0.8, v: 0.4 + r() * 0.6 });
    return { lands: b, clouds: cl };
  }
  function rgbOf(c) {
    if (c.charAt(0) === '#') return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    return c.replace(/[^\d,]/g, '').split(',').map(Number);
  }
  function mix(a, b, t) {
    var pa = rgbOf(a), pb = rgbOf(b);
    return 'rgb(' + pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * t); }).join(',') + ')';
  }
  function hayCol(W, Q) {
    var dry = clamp(1 - Math.log(1 + W) / Math.log(1 + W0), 0, 1);
    var c = mix('#4f8a3a', '#cbb46a', dry);
    return Q < 0.7 ? mix(c, '#6b5a43', clamp((0.7 - Q) * 2, 0, 0.8)) : c;
  }
  function paint(now) {
    var g = ctx, W = cv.width, H = cv.height, d = day, h = run.h, hh = h % 24, x = wxAt(d, h);
    var se = sunEl(hh);
    var SKY = 118;
    /* sky */
    var top = se > 0 ? mix('#0e1726', '#4f7fae', se * (1 - 0.6 * x.cloud)) : '#060a12';
    var bot = se > 0 ? mix('#1a2233', '#a9c3d8', se * (1 - 0.5 * x.cloud)) : '#0b1220';
    if (se > 0 && se < 0.3) bot = mix('#d27a4a', bot, se / 0.3 * 0.9 + 0.1 * x.cloud);
    var gr = g.createLinearGradient(0, 0, 0, SKY);
    gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, W, SKY);
    /* sun */
    if (se > 0) {
      var sx = 40 + (W - 260) * clamp((hh - 4.4) / 16.6, 0, 1), sy = SKY - 12 - se * 80;
      g.fillStyle = 'rgba(255,236,170,' + (0.95 - 0.8 * x.cloud) + ')';
      g.beginPath(); g.arc(sx, sy, 11, 0, 7); g.fill();
    } else {
      g.fillStyle = 'rgba(220,226,240,.7)';
      for (var s = 0; s < 30; s++) { var r = (s * 7919) % 997 / 997, q = (s * 104729) % 991 / 991; g.fillRect(r * (W - 200), q * SKY * 0.8, 1, 1); }
    }
    /* clouds */
    var nc = Math.round(x.cloud * 9);
    for (var c = 0; c < nc; c++) {
      var C = blades.clouds[c], cx = ((C.x * W + h * 14 * C.v) % (W + 160)) - 80, cy = 14 + C.y * 46;
      var shade = se > 0 ? mix('#e8edf2', '#55606e', clamp(x.cloud * 1.1 - 0.2 + (x.rain > 0 ? 0.3 : 0), 0, 1)) : '#1b2333';
      g.fillStyle = shade; g.globalAlpha = 0.85;
      g.beginPath();
      g.ellipse(cx, cy, 46 * C.w, 13, 0, 0, 7); g.ellipse(cx + 22 * C.w, cy - 8, 26 * C.w, 12, 0, 0, 7); g.ellipse(cx - 20 * C.w, cy - 4, 22 * C.w, 10, 0, 0, 7);
      g.fill(); g.globalAlpha = 1;
    }
    /* rain */
    if (x.rain > 0) {
      g.strokeStyle = 'rgba(170,195,230,.45)'; g.lineWidth = 1;
      var n = Math.min(160, 20 + x.rain * 40), t = (now || 0) / 1000;
      g.beginPath();
      for (var i = 0; i < n; i++) {
        var rx = ((i * 7919) % 641 + t * 40) % W, ry = (((i * 104729) % 337) + t * 420) % (H);
        g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 9);
      }
      g.stroke();
    }
    /* field */
    var FX = 20, FW = W - 190, FY = SKY + 16, LH = 50;
    g.fillStyle = se > 0 ? '#16301a' : '#0b170e'; g.fillRect(0, SKY, W, H - SKY);
    g.fillStyle = se > 0 ? '#1f3c20' : '#0e1c10';
    for (var hx = 0; hx < W; hx += 16) { g.beginPath(); g.arc(hx + 8, SKY + 4, 10 + (hx * 13 % 6), Math.PI, 0); g.fill(); }
    var dim = 0.35 + 0.65 * Math.max(se, 0.05);
    for (var li = 0; li < 4; li++) {
      var L = run.lands[li], y0 = FY + li * (LH + 3), BL = blades.lands[li];
      g.save();
      g.beginPath(); g.rect(FX, y0, FW, LH); g.clip();
      g.fillStyle = '#1c3417'; g.fillRect(FX, y0, FW, LH);
      var col = hayCol(L.W, L.Q);
      g.globalAlpha = dim;
      var k, b, px, py;
      if (L.state === 'standing') {
        g.strokeStyle = mix('#5e9a3f', '#9a9a4a', clamp((h - 48) / 90, 0, 1)); g.lineWidth = 1.2; g.beginPath();
        for (k = 0; k < BL.length; k++) { b = BL[k]; px = FX + b.x * FW; py = y0 + 8 + b.y * (LH - 8); g.moveTo(px, py); g.lineTo(px + (b.a - 0.5) * 4 + x.wind * 0.4, py - 10 - b.l * 8); }
        g.stroke();
      } else if (L.state === 'swath') {
        g.fillStyle = '#7a8f4d'; g.fillRect(FX, y0, FW, LH);
        g.strokeStyle = col; g.lineWidth = 7;
        for (k = -2; k < 18; k++) { g.beginPath(); g.moveTo(FX + k * 26, y0 + LH); g.lineTo(FX + k * 26 + 30, y0); g.stroke(); }
      } else if (L.state === 'spread') {
        g.fillStyle = '#6f8547'; g.fillRect(FX, y0, FW, LH);
        g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
        for (k = 0; k < BL.length; k++) { b = BL[k]; px = FX + b.x * FW; py = y0 + 3 + b.y * (LH - 6); var an = b.a * 6.28; g.moveTo(px, py); g.lineTo(px + Math.cos(an) * 7, py + Math.sin(an) * 4); }
        for (k = 0; k < BL.length; k++) { b = BL[k]; px = FX + b.l * FW; py = y0 + 3 + b.a * (LH - 6); g.moveTo(px, py); g.lineTo(px + 6, py + (b.y - 0.5) * 5); }
        g.stroke();
      } else if (L.state === 'windrow') {
        g.fillStyle = '#7f8f55'; g.fillRect(FX, y0, FW, LH);
        g.strokeStyle = col; g.lineWidth = 9; g.lineCap = 'round';
        for (k = 0; k < 2; k++) { g.beginPath(); g.moveTo(FX + 4, y0 + 15 + k * 20); g.lineTo(FX + FW - 4, y0 + 15 + k * 20); g.stroke(); }
        g.lineCap = 'butt';
      } else if (L.state === 'cocks') {
        g.fillStyle = '#7f8f55'; g.fillRect(FX, y0, FW, LH);
        g.fillStyle = col;
        for (k = 0; k < 13; k++) for (var rr = 0; rr < 2; rr++) {
          px = FX + 18 + k * (FW - 30) / 12 + rr * 12; py = y0 + 22 + rr * 20;
          g.beginPath(); g.ellipse(px, py, 9, 10, 0, Math.PI, 0); g.fill();
        }
      } else if (L.state === 'rick') {
        g.fillStyle = '#8c9a5e'; g.fillRect(FX, y0, FW, LH);
        g.strokeStyle = '#a7ad72'; g.lineWidth = 1; g.beginPath();
        for (k = 0; k < BL.length; k++) { b = BL[k]; px = FX + b.x * FW; py = y0 + 4 + b.y * (LH - 6); g.moveTo(px, py); g.lineTo(px, py - 3); }
        g.stroke();
      }
      /* the gang working across it */
      var tk = run.task;
      if (tk && tk.li === li) {
        var f = clamp(tk.done / tk.need, 0, 1), gx = FX + f * FW;
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(FX, y0, f * FW, LH);
        g.fillStyle = '#e9dcc4';
        var nmen = tk.k === 'mow' ? day.scythes : 5;
        for (var m = 0; m < nmen; m++) { var my = y0 + 8 + m * (LH - 14) / Math.max(1, nmen - 1); g.beginPath(); g.arc(gx - (m % 2) * 6, my, 3, 0, 7); g.fill(); }
        if (tk.k === 'carry') { g.fillStyle = '#8a6a44'; g.fillRect(gx - 26, y0 + 14, 22, 14); g.fillStyle = col; g.beginPath(); g.ellipse(gx - 15, y0 + 14, 13, 8, 0, Math.PI, 0); g.fill(); }
      }
      g.globalAlpha = 1;
      g.restore();
      g.fillStyle = COLS[li]; g.fillRect(FX - 8, y0, 3, LH);
      g.fillStyle = 'rgba(7,9,13,.65)'; g.fillRect(FX + 4, y0 + 4, 96, 15);
      g.fillStyle = '#e8edf5'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'left';
      g.fillText(L.name.toUpperCase(), FX + 8, y0 + 15);
    }
    /* the rick in the corner */
    var RX = W - 150, RY = H - 30, tons = run.rick.reduce(function (s, l) { return s + l.tons; }, 0), full = clamp(tons / (d.acres * d.yieldPA), 0, 1);
    g.fillStyle = '#3a2c1c'; g.fillRect(RX - 6, RY, 132, 6);
    if (tons > 0) {
      var rh = 18 + 70 * full;
      g.fillStyle = '#b79a5a';
      g.beginPath(); g.moveTo(RX, RY); g.lineTo(RX, RY - rh * 0.7); g.lineTo(RX + 60, RY - rh); g.lineTo(RX + 120, RY - rh * 0.7); g.lineTo(RX + 120, RY); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
      for (var ri = 0; ri < run.rick.length; ri++) { var yy = RY - (ri + 1) * rh * 0.7 / Math.max(1, run.rick.length); g.beginPath(); g.moveTo(RX, yy); g.lineTo(RX + 120, yy); g.stroke(); }
    }
    g.fillStyle = '#c7b9a5'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
    g.fillText(tons ? 'THE RICK · ' + tons.toFixed(1) + ' T' : 'THE RICK-YARD', RX + 60, RY + 20);
    /* the weatherglass */
    var GX = W - 62, GY = 62, GR = 42;
    g.fillStyle = 'rgba(30,22,14,.92)'; g.beginPath(); g.arc(GX, GY, GR + 6, 0, 7); g.fill();
    g.strokeStyle = '#a8865a'; g.lineWidth = 2; g.beginPath(); g.arc(GX, GY, GR + 6, 0, 7); g.stroke();
    g.fillStyle = '#efe6d2'; g.beginPath(); g.arc(GX, GY, GR, 0, 7); g.fill();
    var ang = function (p) { return Math.PI * (0.75 + 1.5 * clamp((p - 975) / 60, 0, 1)); };
    g.fillStyle = '#3b2e20'; g.font = '600 7px ui-monospace,Menlo,monospace';
    [['STORMY', 982], ['RAIN', 996], ['CHANGE', 1009], ['FAIR', 1021], ['V.DRY', 1031]].forEach(function (w) {
      var a = ang(w[1]); g.fillText(w[0], GX + Math.cos(a) * (GR - 15), GY + Math.sin(a) * (GR - 15) + 3);
    });
    /* the setting hand: where the needle stood three hours ago */
    var i3 = Math.max(0, Math.floor(h) - 3), aS = ang(d.wx.P[Math.min(i3, HOURS - 1)]);
    g.strokeStyle = '#b08a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(GX, GY); g.lineTo(GX + Math.cos(aS) * (GR - 4), GY + Math.sin(aS) * (GR - 4)); g.stroke();
    var aN = ang(x.p);
    g.strokeStyle = '#1a140e'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(GX, GY); g.lineTo(GX + Math.cos(aN) * (GR - 6), GY + Math.sin(aN) * (GR - 6)); g.stroke();
    g.fillStyle = '#1a140e'; g.beginPath(); g.arc(GX, GY, 3, 0, 7); g.fill();
    g.fillStyle = '#c7b9a5'; g.font = '600 9px ui-monospace,Menlo,monospace';
    g.fillText('THE GLASS', GX, GY + GR + 18);
    /* the time */
    g.textAlign = 'left'; g.fillStyle = 'rgba(7,9,13,.6)'; g.fillRect(8, 8, 150, 20);
    g.fillStyle = '#e8edf5'; g.font = '600 11px ui-monospace,Menlo,monospace';
    g.fillText(run.over && !run.early ? 'SATURDAY NIGHT' : whenStr(d, h).toUpperCase() + (working(h) ? '' : ' · NIGHT'), 14, 22);
  }

  /* ---------- the end of the week ---------- */
  function finishWeek() {
    paused = true;
    var d = day, S = settle(d, run);
    run.S = S;
    var v = $('verdict');
    var good = S.fate === 'cool' || S.fate === 'sweated';
    v.className = 'verdict ' + (good && !S.left.length && S.Qf > 0.72 ? 'good' : 'warn');
    var p = [];
    if (S.tons) {
      p.push('<p>' + (run.early ? 'The last load is up by ' + whenStr(d, run.h) + ', and the gang has the rest of the week to thatch the rick. There are <b>' : 'By Saturday night there are <b>') + S.tons.toFixed(1) + ' tons</b> in the rick out of the ' + (d.acres * d.yieldPA).toFixed(1) + ' the meadow stood to give, put up at an average of <b>' + Math.round(100 * S.Wm / (1 + S.Wm)) + '% water</b>' +
        (S.worst > S.Wm + 0.04 ? ' (the wettest load ' + Math.round(100 * S.worst / (1 + S.worst)) + '%)' : '') + '.</p>');
      var fateTxt = {
        cool: 'The rick stays cool. It was put up so dry that it hardly warms at all; it will keep, though some of the leaf was left in the field.',
        dusty: 'The rick stays cool. It was put up so dry that it hardly warms at all; it will keep, though some of the leaf was left in the field.',
        sweated: 'The rick sweats for a week and settles, warm to the hand thrust into it and smelling of tobacco and honey. That is how good hay is supposed to behave.',
        mowburnt: 'The rick heats hard. Mr ' + d.master + ' drives an iron bar into it every morning and it comes out too hot to hold. It does not fire, but the middle comes out brown and mowburnt, and the beasts will eat it without much thanks.',
        fired: 'The rick heats and keeps heating. In the third week smoke comes out of the thatch, and the men cut it open and drag the charred middle out into the yard to stop it catching. What is left is brown and smells of burning.'
      }[S.fate];
      p.push('<p>' + fateTxt + ' The peak, if you had a thermometer to put in it: <b>about ' + S.peak + '°C</b>.</p>');
      p.push('<p>It is <b>' + S.grade + '</b> hay' + (S.fate === 'fired' ? ', what remains of it' : '') + ', and at this year\'s price it is worth <b>' + money(S.worth) + '</b>, against about ' + money(S.wages) + ' paid out to the gang.</p>');
    } else p.push('<p>Saturday night, and <b>nothing has been led home</b>. The rick-yard is empty.</p>');
    if (S.left.length) {
      var names = S.left.map(function (i) { return run.lands[i].name.toLowerCase() + ' (' + STATE[run.lands[i].state] + ')'; });
      p.push('<p>Still out in the field: the ' + names.join(', the ') + ', about ' + S.leftTons.toFixed(1) + ' tons that will have to wait for next week\'s weather, and nobody can tell you what that will be.</p>');
    }
    v.innerHTML = p.join('');
    reveal(S);
    $('btnAgain').style.display = '';
    sync();
  }

  function reveal(S) {
    var d = day, box = $('reveal');
    box.style.display = '';
    box.innerHTML = '<h5>The week, hour by hour</h5><canvas class="trace" id="trWeek" width="900" height="360"></canvas>' +
      '<div class="key">' + run.lands.map(function (L, i) { return '<span style="color:' + COLS[i] + '">● ' + L.name + '</span>'; }).join('') +
      '<span style="color:#9ab8e8">▮ rain</span><span style="color:#d4b47a">— the glass</span></div>' +
      '<p id="rvTxt"></p>' +
      (S.tons ? '<h5>The rick, for six weeks after</h5><canvas class="trace" id="trRick" width="900" height="200"></canvas>' : '');
    drawWeek($('trWeek'));
    if (S.tons) drawRick($('trRick'), S);
    $('rvTxt').innerHTML = weekText(S);
  }
  function drawWeek(c) {
    var g = c.getContext('2d'), W = c.width, H = c.height, d = day;
    var X0 = 46, X1 = W - 14, top = 18, mid = 92, Y0 = 112, Y1 = H - 30;
    var sx = function (h) { return X0 + (X1 - X0) * h / HOURS; };
    g.fillStyle = '#0b0f16'; g.fillRect(0, 0, W, H);
    /* nights */
    for (var dd = 0; dd < 6; dd++) {
      g.fillStyle = 'rgba(255,255,255,.035)';
      g.fillRect(sx(dd * 24), top, sx(START) - sx(0), Y1 - top);
      g.fillRect(sx(dd * 24 + STOP), top, sx(24 - STOP) - sx(0), Y1 - top);
      g.fillStyle = '#8b97ab'; g.font = '600 11px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
      g.fillText(WEEKDAYS[dayDate(d, dd * 24).getDay()].slice(0, 3).toUpperCase(), sx(dd * 24 + 12), H - 10);
    }
    /* the glass */
    var pmin = 975, pmax = 1035, py = function (p) { return mid - (mid - top) * clamp((p - pmin) / (pmax - pmin), 0, 1); };
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(X0, py(1009)); g.lineTo(X1, py(1009)); g.stroke();
    g.strokeStyle = '#d4b47a'; g.lineWidth = 1.6; g.beginPath();
    for (var h = 0; h < HOURS; h++) { var X = sx(h + 0.5), Y = py(d.wx.P[h]); if (h) g.lineTo(X, Y); else g.moveTo(X, Y); }
    g.stroke();
    g.fillStyle = '#8b97ab'; g.font = '10px ui-monospace,Menlo,monospace'; g.textAlign = 'right';
    g.fillText('glass', X0 - 6, py(1009) + 3);
    /* rain bars */
    g.fillStyle = 'rgba(154,184,232,.55)';
    for (h = 0; h < HOURS; h++) { var mm = d.wx.RAIN[h]; if (mm > 0) g.fillRect(sx(h), mid + 2, Math.max(1, sx(1) - sx(0) - 0.5), Math.min(16, mm * 4)); }
    /* moisture: % water, 80 at the top, 10 at the bottom */
    var my = function (W) { var M = W / (1 + W) * 100; return Y0 + (Y1 - Y0) * (1 - clamp((M - 10) / 70, 0, 1)); };
    g.fillStyle = 'rgba(100,240,200,.07)'; g.fillRect(X0, my(SAFE), X1 - X0, my(BRITTLE) - my(SAFE));
    g.fillStyle = '#8b97ab'; g.textAlign = 'right';
    [80, 60, 40, 25, 15].forEach(function (M) { var W = M / (100 - M); g.fillText(M + '%', X0 - 6, my(W) + 3); });
    run.lands.forEach(function (L, i) {
      g.strokeStyle = COLS[i]; g.lineWidth = 1.8; g.beginPath();
      var on = false;
      L.hist.forEach(function (pt, hh) {
        if (pt.s === 'standing' || pt.s === 'rick') { on = false; return; }
        var X = sx(hh + 1), Y = my(pt.W);
        if (on) g.lineTo(X, Y); else { g.moveTo(X, Y); on = true; }
      });
      g.stroke();
    });
    /* what was done */
    var mark = { mow: 'M', ted: 'T', turn: 't', row: 'R', cock: 'C', open: 'S', carry: '▲' };
    g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
    run.acts.forEach(function (a) {
      var L = run.lands[a.li], pt = L.hist[Math.max(0, Math.floor(a.h) - 1)];
      var Y = a.k === 'mow' ? my(3.4) : pt ? my(pt.W) : Y0;
      g.fillStyle = COLS[a.li]; g.fillText(mark[a.k], sx(a.h), Y - 6);
    });
  }
  function drawRick(c, S) {
    var g = c.getContext('2d'), W = c.width, H = c.height;
    var X0 = 46, X1 = W - 14, Y0 = 14, Y1 = H - 28;
    var sx = function (dd) { return X0 + (X1 - X0) * dd / 42; }, sy = function (T) { return Y1 - (Y1 - Y0) * clamp((T - 10) / 80, 0, 1); };
    g.fillStyle = '#0b0f16'; g.fillRect(0, 0, W, H);
    [[36, 58, 'rgba(100,240,200,.08)', 'a good sweat'], [58, 72, 'rgba(255,206,106,.08)', 'mowburnt'], [72, 90, 'rgba(255,120,100,.1)', 'fire risk']].forEach(function (b) {
      g.fillStyle = b[2]; g.fillRect(X0, sy(b[1]), X1 - X0, sy(b[0]) - sy(b[1]));
      g.fillStyle = '#8b97ab'; g.font = '10px ui-monospace,Menlo,monospace'; g.textAlign = 'right'; g.fillText(b[3], X1 - 6, sy(b[1]) + 12);
    });
    g.textAlign = 'right';
    [20, 40, 60, 80].forEach(function (T) { g.fillText(T + '°', X0 - 6, sy(T) + 3); });
    g.textAlign = 'center';
    [0, 7, 14, 21, 28, 35, 42].forEach(function (dd) { g.textAlign = dd === 42 ? 'right' : dd ? 'center' : 'left'; g.fillText(dd ? 'week ' + dd / 7 : 'led', sx(dd), H - 10); });
    g.strokeStyle = '#ffce6a'; g.lineWidth = 2; g.beginPath();
    S.curve.forEach(function (T, dd) { if (dd) g.lineTo(sx(dd), sy(T)); else g.moveTo(sx(dd), sy(T)); });
    g.stroke();
  }
  function weekText(S) {
    var d = day, out = [];
    var rainH = d.wx.RAIN.filter(function (m) { return m > 0.2; }).length, tot = d.wx.RAIN.reduce(function (a, b) { return a + b; }, 0);
    out.push('The week had ' + NUMW[Math.min(10, d.wx.lows.filter(function (L) { return L.t > -4 && L.t < HOURS + 4; }).length)] + ' depressions across it and about ' + Math.round(tot) + ' mm of rain in ' + rainH + ' hours. Every spell of rain came after the glass had started to fall: it falls ahead of a front, bottoms out about when the rain does, and rises behind it.');
    var washed = run.lands.map(function (L, i) { return { i: i, w: L.washed }; }).filter(function (x) { return x.w > 3; });
    if (washed.length) out.push('Rain fell on hay lying open on the ' + washed.map(function (x) { return run.lands[x.i].name.toLowerCase(); }).join(', the ') + ': each wetting washes the sugars out of it and adds a day\'s drying back on.');
    var sh = run.lands.filter(function (L) { return (L.shatter || 0) > 0; });
    if (sh.length) out.push('Some was tedded or raked when it was already brittle, and the leaf, which is most of the feed in hay, stayed on the ground.');
    if (S.worst > 0.4) out.push('One load went up more than a quarter water, and a wet load buried in a rick is where heating starts.');
    out.push('The flat band on the moisture chart is the range a farmer would lead in: dry enough not to fire, not so dry it falls to pieces on the fork.');
    return out.join(' ');
  }

  function setDay(off) {
    offset = off;
    day = makeDay(offset);
    run = newRun(day);
    blades = makeBlades();
    paused = true; idleSaid = false; lastSign = -1; lastRainSaid = -10; lastSig = '';
    $('msg').innerHTML = '';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none';
    $('btnAgain').style.display = 'none';
    buildCards(); plaque(); sync();
    say('Monday, before light. The grass is up to your knees and in flower. Choose a land to mow, then let the clock run; it stops by itself whenever the gang finishes a job.');
  }

  function init() {
    cv = $('meadow'); ctx = cv.getContext('2d');
    $('btnPlay').addEventListener('click', function () {
      if (run.over) return;
      paused = !paused;
      if (!paused && run.h === 0 && !run.task) say('The gang stands about at the gate waiting to be told which land to start on.');
      sync();
    });
    $('btnSpeed').addEventListener('click', function () { speed = speed === 1 ? 2 : 1; this.textContent = speed === 1 ? 'Faster' : 'Slower'; });
    $('btnAgain').addEventListener('click', function () { setDay(offset); });
    $('btnDayPrev').addEventListener('click', function () { setDay(offset - 1); });
    $('btnDayToday').addEventListener('click', function () { setDay(0); });
    $('btnDayNext').addEventListener('click', function () { setDay(offset + 1); });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' && e.target === document.body) { e.preventDefault(); $('btnPlay').click(); }
    });
    setDay(0);
    requestAnimationFrame(loop);
  }

  window.DriftHayfield = { makeDay: function (o) { return makeDay(o); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
