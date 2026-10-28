/* drift.quibo.games — The Forge
   A village smithy on a working morning, some time between 1790 and 1889, on today's calendar date. The day's
   number picks the village (and with it the latitude, so how high the sun gets and how much daylight comes in at
   the door), the weather, the coal in the hearth (how hot it will burn and how fast it clinkers), the bar of wrought
   iron in the rack (where it welds and where it burns), the bar of cast steel (the heat at which it will harden and
   the heat at which it burns), and three orders from people who will call for them at a stated hour.

   The smith has no thermometer. Heat is judged by the colour of the iron, and colour is judged against the light
   in the shop: in a dark shop a dull red glows plainly, in a bright one it hardly shows. The page draws the iron as
   a hot body seen by an eye adapted to the room's daylight, so the same heat looks different at seven in the
   morning, at noon and when a cloud goes over. Blows struck at the right heat move the metal, blows struck cold
   split it, iron left too long in a fierce fire burns. A weld takes only if the scarf is fluxed and white hot
   on the first blow. Steel is hardened by quenching from just above its hardening heat and tempered by letting a
   heat run down the bright face until the right colour reaches the edge. Self-contained. */
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
    var h = s ^ 0x3f0e9a71;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function $(id) { return document.getElementById(id); }
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  function noise1(r) {
    var N = 512, v = new Float32Array(N);
    for (var i = 0; i < N; i++) v[i] = r() * 2 - 1;
    return function (x) {
      var i0 = Math.floor(x), f = x - i0, s = f * f * (3 - 2 * f);
      var a = v[((i0 % N) + N) % N], b = v[(((i0 + 1) % N) + N) % N];
      return a + (b - a) * s;
    };
  }

  /* money: pence to "1s 4d" */
  function money(d) {
    var neg = d < 0; d = Math.abs(Math.round(d));
    var s = Math.floor(d / 12), p = d % 12, out;
    if (s && p) out = s + 's ' + p + 'd'; else if (s) out = s + 's'; else out = p + 'd';
    return (neg ? '−' : '') + out;
  }
  function clockStr(min) {
    var h = Math.floor(min / 60), m = Math.floor(min % 60);
    var ap = h < 12 ? 'am' : 'pm', hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }

  /* ---------- constants ---------- */
  var FAST = 20;                 // shop minutes pass at twenty times real time
  var START = 7 * 60;            // the shop opens at seven
  var SHUT = 13 * 60;            // dinner at one; anything not done by then is not done today
  var BLOW_GAP = 0.5;            // seconds between hammer blows

  var VILLAGES = [
    { name: 'Thaxted', county: 'Essex', lat: 51.95 },
    { name: 'Lavenham', county: 'Suffolk', lat: 52.11 },
    { name: 'Bibury', county: 'Gloucestershire', lat: 51.76 },
    { name: 'Hawkshead', county: 'Lancashire', lat: 54.37 },
    { name: 'Grassington', county: 'the West Riding', lat: 54.07 },
    { name: 'Ruthin', county: 'Denbighshire', lat: 53.11 },
    { name: 'Moretonhampstead', county: 'Devon', lat: 50.66 },
    { name: 'Corfe', county: 'Dorset', lat: 50.64 },
    { name: 'Uppingham', county: 'Rutland', lat: 52.59 },
    { name: 'Alnmouth', county: 'Northumberland', lat: 55.39 },
    { name: 'Melrose', county: 'Roxburghshire', lat: 55.6 },
    { name: 'Kington', county: 'Herefordshire', lat: 52.2 },
    { name: 'Walsingham', county: 'Norfolk', lat: 52.89 },
    { name: 'Comrie', county: 'Perthshire', lat: 56.37 }
  ];
  var WEATHER = [
    { name: 'clear', w: 1.0, vary: 0.06, say: 'A clear sky, and the sun straight in at the door once it is up.' },
    { name: 'fair', w: 0.92, vary: 0.5, say: 'Fair, with big clouds going over: the light in the doorway comes and goes.' },
    { name: 'hazy', w: 0.7, vary: 0.15, say: 'A white haze over everything; the light is even and flat.' },
    { name: 'grey', w: 0.46, vary: 0.12, say: 'Low grey cloud from end to end. A dim, steady light.' },
    { name: 'rain', w: 0.3, vary: 0.2, say: 'Rain, and the door half shut against it. The shop is dark.' }
  ];
  var COALS = [
    { name: 'Welsh smithy coal', max: 1490, clink: 0.55, say: 'Good Welsh coal: it cakes, burns hot and clean and clinkers slowly.' },
    { name: 'Durham coal', max: 1460, clink: 0.8, say: 'Durham coal by the coaster: hot, and it clinkers if you blow it hard all morning.' },
    { name: 'Forest of Dean small coal', max: 1430, clink: 1.05, say: 'Small coal from the Forest of Dean: it burns well enough but it clinkers.' },
    { name: 'Staffordshire slack', max: 1400, clink: 1.4, say: 'Cheap Staffordshire slack: it struggles to make a welding heat and soon chokes with clinker.' }
  ];
  var IRONS = [
    { name: 'Staffordshire best bar', burnLo: 1385, burnHi: 1410 },
    { name: 'Low Moor iron', burnLo: 1400, burnHi: 1430 },
    { name: 'Swedish bar iron', burnLo: 1395, burnHi: 1425 },
    { name: 'common Shropshire bar', burnLo: 1375, burnHi: 1400 }
  ];
  var STEELS = [
    { name: 'Sheffield cast steel', cLo: 0.85, cHi: 1.15 },
    { name: 'shear steel', cLo: 0.7, cHi: 0.95 },
    { name: 'blister steel, faggoted', cLo: 0.75, cHi: 1.05 }
  ];
  var SURNAMES = ['Bray', 'Pettit', 'Hogg', 'Lusher', 'Mott', 'Garrod', 'Kemp', 'Tranter', 'Dowsett', 'Fairweather', 'Coote', 'Jessop', 'Rook', 'Hebden', 'Askew', 'Tilney', 'Nunn', 'Pomfret'];

  /* the orders. steps: forge (draw it out to shape), weld, harden, temper (target colour by temperature) */
  var JOBS_IRON = [
    { id: 'hook', title: 'a gate hook and its eye', who: 'the farmer at the Hall Farm', metal: 'iron', heat: 9, cool: 20,
      steps: [{ k: 'forge', work: 12 }], price: 5, say: 'drawn out and turned from a length of half-inch round' },
    { id: 'shoe', title: 'a heavy shoe for the carrier’s horse', who: 'the carrier', metal: 'iron', heat: 12, cool: 26,
      steps: [{ k: 'forge', work: 16 }], price: 8, say: 'fullered, punched and turned from a length of flat bar' }
  ];
  var JOBS_WELD = [
    { id: 'link', title: 'a broken plough chain', who: 'the ploughman', metal: 'iron', heat: 8, cool: 16,
      steps: [{ k: 'weld' }], price: 6, say: 'the broken link scarfed, closed and welded shut' },
    { id: 'tyre', title: 'a cart tyre to shut', who: 'the wheelwright', metal: 'iron', heat: 17, cool: 34,
      steps: [{ k: 'weld' }], price: 18, say: 'the two scarfed ends of a bent tyre band welded into a hoop' },
    { id: 'gate', title: 'a cracked gate hinge', who: 'the churchwarden', metal: 'iron', heat: 11, cool: 22,
      steps: [{ k: 'weld' }], price: 9, say: 'a new piece scarfed on and welded where the strap cracked through' }
  ];
  var JOBS_STEEL = [
    { id: 'cold', title: 'a cold chisel', who: 'the mason on the church tower', metal: 'steel', heat: 7, cool: 16,
      steps: [{ k: 'forge', work: 6 }, { k: 'harden' }, { k: 'temper', target: 272, colour: 'purple' }], price: 9,
      say: 'tough enough to be hit all day, so let down to a purple' },
    { id: 'firmer', title: 'a firmer chisel', who: 'the joiner', metal: 'steel', heat: 7, cool: 15,
      steps: [{ k: 'forge', work: 6 }, { k: 'harden' }, { k: 'temper', target: 255, colour: 'brown' }], price: 12,
      say: 'hard enough to hold an edge in oak, so let down only to a brown' },
    { id: 'knife', title: 'a clicking knife', who: 'the shoemaker', metal: 'steel', heat: 6, cool: 13,
      steps: [{ k: 'forge', work: 5 }, { k: 'harden' }, { k: 'temper', target: 228, colour: 'straw' }], price: 8,
      say: 'for cutting leather all day, left hard at a straw' },
    { id: 'spring', title: 'a latch spring', who: 'the innkeeper', metal: 'steel', heat: 6, cool: 13,
      steps: [{ k: 'forge', work: 5 }, { k: 'harden' }, { k: 'temper', target: 298, colour: 'blue' }], price: 5,
      say: 'springy, not brittle, so let down all the way to a blue' }
  ];

  /* temper colours: the oxide on bright steel, by the heat it reached */
  var TEMPER = [
    { t: 20, c: [196, 200, 206], n: 'bright' },
    { t: 205, c: [214, 206, 170], n: 'pale straw' },
    { t: 225, c: [224, 196, 120], n: 'straw' },
    { t: 242, c: [198, 150, 70], n: 'dark straw' },
    { t: 256, c: [150, 96, 52], n: 'brown' },
    { t: 266, c: [128, 70, 92], n: 'purple-brown' },
    { t: 276, c: [100, 58, 132], n: 'purple' },
    { t: 292, c: [52, 70, 168], n: 'blue' },
    { t: 312, c: [92, 140, 196], n: 'pale blue' },
    { t: 335, c: [130, 140, 146], n: 'grey' }
  ];
  function temperColour(T) {
    if (T <= TEMPER[0].t) return TEMPER[0].c;
    for (var i = 1; i < TEMPER.length; i++) {
      if (T < TEMPER[i].t) {
        var a = TEMPER[i - 1], b = TEMPER[i], f = (T - a.t) / (b.t - a.t);
        return [lerp(a.c[0], b.c[0], f), lerp(a.c[1], b.c[1], f), lerp(a.c[2], b.c[2], f)];
      }
    }
    return TEMPER[TEMPER.length - 1].c;
  }
  function temperName(T) {
    var n = TEMPER[0].n;
    for (var i = 0; i < TEMPER.length; i++) if (T >= TEMPER[i].t - 6) n = TEMPER[i].n;
    return n;
  }

  /* the colour of hot iron: hue by temperature (a blackbody, roughly) and how bright it is */
  var HUE = [
    [480, [1, 0.04, 0.0]], [600, [1, 0.06, 0.01]], [750, [1, 0.13, 0.02]], [900, [1, 0.26, 0.04]],
    [1050, [1, 0.46, 0.1]], [1200, [1, 0.7, 0.3]], [1300, [1, 0.86, 0.6]], [1450, [1, 0.97, 0.9]]
  ];
  function hue(T) {
    if (T <= HUE[0][0]) return HUE[0][1];
    for (var i = 1; i < HUE.length; i++) {
      if (T < HUE[i][0]) {
        var a = HUE[i - 1], b = HUE[i], f = (T - a[0]) / (b[0] - a[0]);
        return [lerp(a[1][0], b[1][0], f), lerp(a[1][1], b[1][1], f), lerp(a[1][2], b[1][2], f)];
      }
    }
    return HUE[HUE.length - 1][1];
  }
  function glowI(T) { var x = clamp((T - 480) / 820, 0, 1.3); return Math.pow(x, 1.8); }
  /* what the eye sees: the metal's own surface lit by the room, plus its glow, through an eye adapted to the room */
  function seen(T, amb, base) {
    base = base || [64, 62, 60];
    var adapt = 0.35 + 1.65 * amb;
    var h = hue(T), L = glowI(T) * 1.08 / adapt, g = 255 * (1 - Math.exp(-L * 2.2));
    var k = amb / adapt * 1.6;
    return [clamp(base[0] * k + h[0] * g, 0, 255), clamp(base[1] * k + h[1] * g, 0, 255), clamp(base[2] * k + h[2] * g, 0, 255)];
  }
  function css(c, a) { return a === undefined ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  var CARD = [
    { t: 560, n: 'black heat' }, { t: 700, n: 'dull red' }, { t: 820, n: 'cherry' }, { t: 950, n: 'bright red' },
    { t: 1080, n: 'orange' }, { t: 1200, n: 'yellow' }, { t: 1320, n: 'white, welding' }, { t: 1420, n: 'sparkling: burning' }
  ];

  /* ---------- the day ---------- */
  var offset = 0, day = null, run = null;

  function makeDay(off) {
    var date = dateFor(off), seed = seedForDate(date), r = rng(seed);
    var d = { date: date, seed: seed };
    d.year = 1790 + Math.floor(r() * 100);
    d.village = pick(r, VILLAGES);
    d.weather = pick(r, WEATHER);
    d.coal = pick(r, COALS);
    var ir = pick(r, IRONS);
    d.iron = { name: ir.name };
    d.iron.burn = Math.round(lerp(ir.burnLo, ir.burnHi, r()));
    d.iron.weldLo = d.iron.burn - Math.round(85 + r() * 30);
    var st = pick(r, STEELS);
    d.steel = { name: st.name };
    d.steel.carbon = Math.round(lerp(st.cLo, st.cHi, r()) * 100) / 100;
    d.steel.crit = Math.round(clamp(770 + (0.85 - d.steel.carbon) * 140, 752, 800) + (r() - 0.5) * 10);
    d.steel.burn = Math.round(1290 - (d.steel.carbon - 0.7) * 300 + (r() - 0.5) * 30);
    var m = date.getMonth();
    var base = [2, 3, 6, 9, 12, 15, 17, 17, 14, 10, 6, 3][m];
    d.air = Math.round(base + (r() - 0.5) * 8);
    d.doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    d.cloud = noise1(rng(seed ^ 0xa5a5));
    d.flick = noise1(rng(seed ^ 0x1234));
    var jobs = [pick(r, JOBS_IRON), pick(r, JOBS_WELD), pick(r, JOBS_STEEL)];
    shuffle(r, jobs);
    var names = shuffle(r, SURNAMES.slice());
    var call = START + 40 + Math.floor(r() * 20);
    d.jobs = jobs.map(function (j, i) {
      var c = call + i * (40 + Math.floor(r() * 20)) + (j.metal === 'steel' ? 15 : 0);
      c = Math.round(c / 15) * 15;
      return { def: j, name: names[i], call: c };
    });
    var dl = WEEKDAYS[new Date(d.year, m, date.getDate()).getDay()];
    d.weekday = dl;
    return d;
  }

  function sunElev(min) {
    var lat = day.village.lat * Math.PI / 180;
    var dec = 23.44 * Math.sin(2 * Math.PI * (284 + day.doy) / 365) * Math.PI / 180;
    var ha = ((min / 60) - 12.1) * 15 * Math.PI / 180;
    return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha));
  }
  /* daylight in the shop, 0..1 */
  function daylight(min, t) {
    var e = sunElev(min);
    var sky = clamp(Math.sin(e) / 0.7 + 0.08, 0, 1);
    sky = Math.pow(sky, 0.8);
    var w = day.weather, c = 1 - w.vary * (0.5 + 0.5 * day.cloud(t / 22));
    return clamp(sky * w.w * c, 0, 1);
  }
  function ambient(min, t) { return 0.07 + 0.85 * daylight(min, t); }

  /* ---------- the run ---------- */
  function newJobState(j) {
    return { j: j, si: 0, work: 0, fluxed: false, stuck: false, weldBlows: 0, weldTries: 0, cold: 0, crack: 0, burnt: 0,
      grade: 100, notes: [], spoils: 0, done: false, finished: null, hard: null, temper: null, trace: [], events: [],
      splitAt: 4 + Math.floor(rng(day.seed ^ (j.call * 7))() * 3), tStart: null };
  }
  function newRun() {
    run = { started: false, over: false, t: 0, min: START, F: 760, blow: 0, clinker: 0, cleaning: 0, blowing: false,
      T: day.air, where: 'anvil', lastBlow: -9, ji: 0, jobs: day.jobs.map(newJobState), purse: 0, stock: 0,
      sparks: [], hammer: 0, steam: 0, lastSample: -1, msgs: [] };
    run.jobs[0].tStart = 0;
  }
  function job() { return run.jobs[run.ji]; }
  function step() { var J = job(); return J ? J.j.def.steps[J.si] : null; }
  function metal() { var J = job(); return J && J.j.def.metal === 'steel' ? day.steel : day.iron; }

  function say(s, cls) {
    run.msgs.unshift({ s: s, cls: cls || '' });
    if (run.msgs.length > 4) run.msgs.length = 4;
    var el = $('msg');
    el.innerHTML = run.msgs.map(function (m, i) { return '<div style="opacity:' + (1 - i * 0.24) + '">' + m.s + '</div>'; }).join('');
  }
  function ev(type, extra) {
    var J = job(); if (!J) return;
    J.events.push({ t: run.t - J.tStart, type: type, T: run.T, x: extra });
  }

  /* spoiled: the piece goes on the scrap heap and the job starts again from fresh stock */
  function spoil(why) {
    var J = job();
    ev('spoil');
    J.spoils++;
    var cost = J.j.def.metal === 'steel' ? 3 : 1;
    if (J.j.def.id === 'tyre') cost = 6;
    run.stock += cost;
    say('<b>' + why + '</b> On the scrap heap with it: fresh stock from the rack (' + money(cost) + ').', 'bad');
    J.notes.push(why);
    J.si = 0; J.work = 0; J.fluxed = false; J.stuck = false; J.weldBlows = 0; J.cold = 0; J.crack = 0; J.burnt = 0;
    J.hard = null; J.temper = null;
    J.grade = Math.max(40, 100 - J.spoils * 6);
    run.T = day.air; run.where = 'anvil';
  }

  function nextStep() {
    var J = job();
    J.si++;
    if (J.si >= J.j.def.steps.length) finishJob();
    else {
      var s = step();
      if (s.k === 'harden') say('Shaped. Now <b>harden</b> it: let the bellows rest so the fire is gentle, bring it up slowly to a <b>cherry red</b> and no further, and quench it.');
      if (s.k === 'temper') {
        J.temper = { Ts: run.T, Te: run.T, max: new Float32Array(40) };
        for (var i = 0; i < 40; i++) J.temper.max[i] = run.T;
        say('Glass hard and brittle. Rub the face bright and <b>temper</b> it: lay the shank in the fire, watch the colours run down towards the edge, and quench when the edge is <b>' + J.j.def.steps[J.si].colour + '</b>.');
      }
    }
  }

  function finishJob() {
    var J = job();
    J.done = true; J.finished = run.min;
    ev('done');
    var p = J.j.def.price, g = J.grade, pay;
    if (g >= 85) pay = p; else if (g >= 65) pay = Math.round(p * 0.75); else if (g >= 45) pay = Math.round(p * 0.5); else pay = 0;
    var late = Math.max(0, Math.ceil((J.finished - J.j.call) / 30));
    if (J.finished <= J.j.call) late = 0;
    J.late = late;
    pay = Math.max(0, pay - late);
    J.pay = pay;
    run.purse += pay;
    say('<b>' + cap1(J.j.def.title) + '</b> done at ' + clockStr(run.min) + '. ' + verdictLine(J), 'good');
    run.ji++;
    run.T = day.air; run.where = 'anvil';
    if (run.ji >= run.jobs.length) endDay();
    else {
      job().tStart = run.t;
      briefJob();
    }
    renderJobs();
  }

  function verdictLine(J) {
    var who = 'Mr ' + J.j.name + ', ' + J.j.def.who + ',';
    var g = J.grade, s;
    if (g >= 92) s = who + ' turns it over twice and says nothing, which is high praise.';
    else if (g >= 85) s = who + ' is satisfied.';
    else if (g >= 65) s = who + ' grumbles about it and knocks a quarter off.';
    else if (g >= 45) s = who + ' says he could have done better himself and pays half.';
    else s = who + ' will not pay for that.';
    if (J.late) s += ' He had to wait ' + (J.late * 30) + ' minutes or so' + (J.late > 2 ? ', and says so.' : '.');
    return s;
  }

  function briefJob() {
    var J = job(), d = J.j.def;
    var s0 = d.steps[0];
    var how = s0.k === 'weld' ? 'Flux the scarf with sand once it is hot, bring it to a <b>white welding heat</b> and get it on the anvil: the first blow must be struck while it is still white or the weld will not take.'
      : d.metal === 'steel' ? 'Steel: forge it at a <b>red to orange</b> heat, never cold, and never let it near white or it will burn.'
        : 'Iron: forge it at a <b>bright red to yellow</b> heat and put it back in the fire before it goes dull.';
    say('Next: <b>' + d.title + '</b> for Mr ' + J.j.name + ', ' + d.who + ', who will call at ' + clockStr(J.j.call) + '. ' + how);
  }

  function endDay() {
    run.over = true;
    run.where = 'anvil';
    renderJobs();
    showVerdict();
  }

  /* ---------- actions ---------- */
  function begin() {
    if (run.started) return;
    run.started = true;
    briefJob();
    sync();
  }
  function toggleFire() {
    if (!run.started || run.over) return;
    if (run.where === 'fire') { run.where = 'anvil'; ev('out'); }
    else { run.where = 'fire'; ev('in'); }
    sync();
  }
  function flux() {
    if (!run.started || run.over) return;
    var s = step();
    if (!s || s.k !== 'weld') return;
    if (run.where !== 'fire') { say('Sand goes on in the fire, on the hot scarf.'); return; }
    if (run.T < 950) { say('The sand just sits on it. It wants to be hotter than that before the flux will run.'); return; }
    var J = job();
    if (J.fluxed) { say('It is fluxed already.'); return; }
    J.fluxed = true; ev('flux');
    say('A handful of sand on the scarf. It melts and runs over it like glass.');
  }
  function strike() {
    if (!run.started || run.over) return;
    if (run.where !== 'anvil') { say('It is in the fire. Bring it out to the anvil first.'); return; }
    if (run.t - run.lastBlow < BLOW_GAP) return;
    run.lastBlow = run.t; run.hammer = 0.16;
    var J = job(), s = step(), T = run.T, M = metal(), steel = J.j.def.metal === 'steel';
    if (!s) return;
    if (T > 950) for (var i = 0; i < 6 + T / 120; i++) spark(470 + Math.random() * 40, 182, 1);
    if (s.k === 'harden' || s.k === 'temper') {
      ev('blow', 'x');
      J.grade -= 4;
      say(s.k === 'harden' ? 'It is shaped already. Hardening wants heat and water, not the hammer.' : 'Hit it now and it will shatter. It wants tempering, not forging.', 'bad');
      if (s.k === 'temper' && T < 200) { spoil('It was glass hard, and it snapped under the hammer.'); }
      return;
    }
    if (s.k === 'forge') {
      var w = 0, kind = 'good';
      if (!steel) {
        if (T < 700) { kind = 'cold'; J.cold++; J.grade -= 6; say('A cold blow: it rings and jars your arm.', 'bad');
          if (J.cold >= J.splitAt) { ev('blow', kind); spoil('It has split along the grain from working it cold.'); return; } }
        else if (T < 880) { w = 0.18; kind = 'stiff'; }
        else w = clamp((T - 700) / 450, 0.35, 1.15) * 0.55;
      } else {
        if (T < 720) { kind = 'cold'; J.crack += 1; J.grade -= 8; say('Steel struck black: you hear it tick.', 'bad'); }
        else if (T < 830) { w = 0.16; kind = 'stiff'; J.crack += 0.25; }
        else w = 0.5;
        if (J.crack >= 3) { ev('blow', kind); spoil('A crack has opened across it from working it too cold.'); return; }
      }
      ev('blow', kind);
      J.work += w;
      run.T -= 4;
      if (J.work >= s.work) { say('That is the shape of it.'); nextStep(); }
      return;
    }
    if (s.k === 'weld') {
      if (!J.stuck) {
        J.weldTries++;
        if (T < 1000) { ev('blow', 'cold'); J.grade -= 4; say('Nowhere near a welding heat. Back in the fire with it.', 'bad'); return; }
        if (!J.fluxed) { ev('blow', 'fail'); J.grade -= 8; say('It would not take: there is scale in the joint. Flux it next time.', 'bad'); return; }
        if (T < M.weldLo) { ev('blow', 'fail'); J.fluxed = false; J.grade -= 8; say('It slid apart. Not hot enough to take; clean the scarf, flux it again and take a whiter heat.', 'bad'); return; }
        J.stuck = true; J.weldBlows = 1; ev('blow', 'weld');
        for (var k = 0; k < 24; k++) spark(470 + Math.random() * 40, 180, 1.6);
        say('<b>It takes.</b> The flux spits out of the joint in a shower. Close it up while it is hot.', 'good');
        return;
      }
      if (T < 800) { ev('blow', 'cold'); J.grade -= 6; say('Too cold to close the weld up: you will crack it. Take a second heat.', 'bad'); return; }
      if (T < 1050) { ev('blow', 'stiff'); say('It is not closing up any more. A second heat, and no flux needed now.'); return; }
      J.weldBlows++; ev('blow', 'good');
      if (J.weldBlows >= 4) { say('The weld is closed and dressed. You cannot see the joint.'); nextStep(); }
    }
  }
  function quench() {
    if (!run.started || run.over) return;
    var J = job(), s = step(), T = run.T;
    if (!s) return;
    run.steam = 1;
    run.where = 'anvil';
    if (s.k === 'harden') {
      var c = day.steel.crit;
      ev('quench');
      if (T < c - 25) { run.T = day.air; J.grade -= 5; J.notes.push('quenched too cold'); say('Into the trough with a hiss. You try a file on it: <b>the file bites</b>. It has not hardened; it was not hot enough.', 'bad'); return; }
      if (T > c + 150) { spoil('Quenched from far too hot: it cracked in the water.'); return; }
      if (T < c) { J.hard = 'part'; J.grade -= 10; say('The file skates over most of it but catches at the edge. Hard, mostly.'); }
      else if (T <= c + 60) { J.hard = 'good'; say('The file skates straight off it. <b>Glass hard.</b>', 'good'); }
      else { J.hard = 'coarse'; J.grade -= 18; say('Hard, but it went in too hot. The grain will be coarse and the edge will crumble.', 'bad'); }
      run.T = day.air;
      nextStep();
      return;
    }
    if (s.k === 'temper') {
      var te = J.temper, edge = te.max[39];
      run.T = day.air;
      ev('quench');
      var d = edge - s.target, ad = Math.abs(d);
      J.temper.got = edge;
      if (ad <= 8) say('The edge is <b>' + temperName(edge) + '</b> as you drop it in. Just right.', 'good');
      else if (ad <= 18) { J.grade -= 6; say('The edge is ' + temperName(edge) + ' when it goes in: near enough.'); }
      else { J.grade -= Math.min(45, ad * 1.1); say('The edge is <b>' + temperName(edge) + '</b>, not ' + s.colour + '. ' + (d < 0 ? 'It will be too hard and chip.' : 'It will be too soft and bend.'), 'bad'); }
      run.where = 'anvil';
      nextStep();
      return;
    }
    if (T > 500) { J.grade -= 3; ev('quench'); say('You cool it in the trough to handle it. Wrought iron does not mind much, but it costs you a heat.'); }
    else say('It is cold already.');
    run.T = day.air;
  }
  function cleanFire() {
    if (!run.started || run.over || run.cleaning > 0) return;
    run.cleaning = 6;
    say('You rake the clinker out of the hearth and build the fire up again. It will be weak for a minute.');
  }
  function shutShop() {
    if (!run.started || run.over) return;
    endDay();
  }

  function spark(x, y, k) {
    if (run.sparks.length > 220) return;
    var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    var v = (60 + Math.random() * 160) * k;
    run.sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.6 });
  }

  /* ---------- physics ---------- */
  function tick(dt) {
    if (!run.started || run.over) { run.t += dt; return; }
    run.t += dt;
    run.min = START + run.t * FAST / 60 * 1;
    // the bellows
    run.blow += ((run.blowing ? 1 : 0) - run.blow) * dt / (run.blowing ? 1.1 : 3.2);
    if (run.blowing) run.clinker += dt * day.coal.clink * 1.1;
    run.clinker += dt * day.coal.clink * 0.12;
    var target = 640 + (day.coal.max - 640) * (0.3 + 0.7 * run.blow) - run.clinker;
    if (run.cleaning > 0) {
      run.cleaning -= dt; target = 520;
      if (run.cleaning <= 0) { run.clinker = 0; say('The fire is clean.'); }
    }
    run.F += (target - run.F) * dt / 2.4;
    var J = job(), d = J ? J.j.def : null, s = step();
    if (!J) return;
    var Ta = day.air;
    if (s && s.k === 'temper') {
      var te = J.temper;
      if (run.where === 'fire') te.Ts += (Math.min(run.F, 900) * 0.62 - te.Ts) * dt / 10;
      else te.Ts += (Ta - te.Ts) * dt / 45;
      te.Te += (te.Ts - te.Te) * dt / 8;
      for (var i = 0; i < 40; i++) {
        var x = i / 39, T = te.Ts + (te.Te - te.Ts) * Math.pow(x, 0.75);
        if (T > te.max[i]) te.max[i] = T;
      }
      run.T = te.Ts;
      if (te.max[39] > 345) {
        J.grade -= 10; J.notes.push('drew the temper too far');
        say('The colours ran right off the edge: it is soft all through. <b>Harden it again.</b>', 'bad');
        J.si -= 1; J.temper = null; J.hard = null;
      }
    } else {
      if (run.where === 'fire') run.T += (run.F - run.T) * dt / d.heat;
      else {
        var f = 0.35 + 0.65 * Math.pow((run.T + 273) / 1600, 3);
        run.T -= (run.T - Ta) / d.cool * f * dt;
      }
      var M = metal();
      if (run.T > M.burn) {
        var b = dt * (run.T - M.burn) / 22;
        J.burnt += b; J.grade -= b * 30;
        if (Math.random() < 0.7) spark(run.where === 'fire' ? 150 + Math.random() * 40 : 450 + Math.random() * 60, run.where === 'fire' ? 146 : 182, 0.9);
        if (J.burnt >= 1) { spoil('It is burnt: the end has gone to sparks and crumbles like biscuit.'); }
      }
    }
    // keep a trace for afterwards
    if (run.t - run.lastSample >= 0.2) {
      run.lastSample = run.t;
      J.trace.push([run.t - J.tStart, run.T, run.where === 'fire' ? 1 : 0, run.F]);
      if (J.trace.length > 6000) J.trace.splice(0, 1);
    }
    if (run.min >= SHUT) { say('One o’clock: the shop shuts for dinner.'); endDay(); }
  }

  /* ---------- drawing ---------- */
  var cv, ctx, CW = 640, CH = 330;
  function draw() {
    var amb = ambient(run.min, run.t), dl = daylight(run.min, run.t);
    var J = job(), s = step();
    ctx.clearRect(0, 0, CW, CH);
    // the wall
    var wall = [46, 38, 32], k = 0.25 + amb * 1.0;
    ctx.fillStyle = css([wall[0] * k, wall[1] * k, wall[2] * k]);
    ctx.fillRect(0, 0, CW, CH);
    // the doorway and its light on the floor
    var sky = [lerp(30, 236, dl), lerp(34, 238, dl), lerp(44, 230, dl)];
    ctx.fillStyle = css(sky);
    ctx.fillRect(578, 30, 52, 210);
    ctx.fillStyle = css([wall[0] * k * 0.6, wall[1] * k * 0.6, wall[2] * k * 0.6]);
    ctx.fillRect(578, 30, 52, 6); ctx.fillRect(574, 30, 4, 210);
    var gr = ctx.createLinearGradient(630, 240, 420, 320);
    gr.addColorStop(0, css(sky, 0.35 * dl + 0.05)); gr.addColorStop(1, css(sky, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(578, 240); ctx.lineTo(630, 240); ctx.lineTo(640, 330); ctx.lineTo(430, 330); ctx.closePath(); ctx.fill();
    // the floor
    ctx.fillStyle = css([30 * k, 26 * k, 22 * k]); ctx.fillRect(0, 286, CW, 44);
    // hearth: hood, bricks and fire
    ctx.fillStyle = css([36 * k, 30 * k, 26 * k]);
    ctx.beginPath(); ctx.moveTo(30, 40); ctx.lineTo(240, 40); ctx.lineTo(262, 104); ctx.lineTo(8, 104); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css([96 * k, 52 * k, 38 * k]); ctx.fillRect(14, 150, 244, 136);
    ctx.strokeStyle = css([60 * k, 32 * k, 24 * k]); ctx.lineWidth = 1;
    for (var yy = 160; yy < 286; yy += 14) { ctx.beginPath(); ctx.moveTo(14, yy); ctx.lineTo(258, yy); ctx.stroke(); for (var xx = 14 + ((yy / 14) % 2) * 20; xx < 258; xx += 40) { ctx.beginPath(); ctx.moveTo(xx, yy - 14); ctx.lineTo(xx, yy); ctx.stroke(); } }
    var fl = run.F + day.flick(run.t * 3) * 25 * (0.4 + run.blow);
    var fc = seen(fl, amb, [30, 26, 24]);
    var rg = ctx.createRadialGradient(140, 150, 4, 140, 150, 120 + run.blow * 40);
    rg.addColorStop(0, css(fc, 0.95)); rg.addColorStop(0.35, css(fc, 0.45)); rg.addColorStop(1, css(fc, 0));
    ctx.fillStyle = rg; ctx.fillRect(10, 40, 260, 160);
    ctx.fillStyle = css([20, 18, 16]); ctx.beginPath(); ctx.ellipse(140, 152, 92, 16, 0, 0, Math.PI * 2); ctx.fill();
    for (var c = 0; c < 26; c++) {
      var cx = 58 + (c * 37) % 166, cy = 148 + ((c * 13) % 9) - 3, ci = fl - 120 - ((c * 53) % 300) - Math.abs(cx - 140) * 2;
      ctx.fillStyle = css(seen(Math.max(ci, 300), amb, [26, 24, 22]));
      ctx.beginPath(); ctx.arc(cx, cy, 6 + (c % 3), 0, Math.PI * 2); ctx.fill();
    }
    // bellows handle
    ctx.strokeStyle = css([110 * k, 84 * k, 54 * k]); ctx.lineWidth = 5;
    var hy = 70 + Math.sin(run.t * 6) * 18 * (run.blowing ? 1 : 0);
    ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(28, hy); ctx.stroke();
    // quench trough
    ctx.fillStyle = css([70 * k, 56 * k, 40 * k]); ctx.fillRect(272, 246, 100, 40);
    ctx.fillStyle = css([28 * k + 6, 40 * k + 8, 46 * k + 10]); ctx.fillRect(278, 250, 88, 10);
    if (run.steam > 0) {
      for (var p = 0; p < 6; p++) { ctx.fillStyle = 'rgba(220,226,232,' + (run.steam * 0.25) + ')'; ctx.beginPath(); ctx.arc(300 + p * 12, 240 - (1 - run.steam) * 60 - p * 4, 10 + (1 - run.steam) * 16, 0, Math.PI * 2); ctx.fill(); }
    }
    // the anvil on its block
    ctx.fillStyle = css([60 * k, 44 * k, 30 * k]); ctx.fillRect(452, 232, 76, 56);
    var av = [70 * k + 8, 72 * k + 8, 76 * k + 9];
    ctx.fillStyle = css(av);
    ctx.beginPath(); ctx.moveTo(400, 190); ctx.quadraticCurveTo(420, 200, 446, 202); ctx.lineTo(446, 190); ctx.closePath(); ctx.fill();
    ctx.fillRect(446, 188, 110, 16);
    ctx.beginPath(); ctx.moveTo(462, 204); ctx.lineTo(540, 204); ctx.lineTo(530, 220); ctx.lineTo(472, 220); ctx.closePath(); ctx.fill();
    ctx.fillRect(458, 220, 86, 14);
    ctx.fillStyle = css([av[0] * 1.3, av[1] * 1.3, av[2] * 1.3]); ctx.fillRect(446, 188, 110, 2);
    // the work
    if (J && !run.over) {
      var tempering = s && s.k === 'temper';
      var hot = tempering ? [180 * amb + 20, 182 * amb + 20, 186 * amb + 22] : seen(run.T, amb, [58, 56, 54]);
      var tong = [50 * k + 6, 48 * k + 6, 46 * k + 6];
      var x0, y0, x1, y1;
      if (run.where === 'fire') { x0 = 112; y0 = 146; x1 = 300; y1 = 120; }
      else { x0 = 452; y0 = 184; x1 = 360; y1 = 170; }
      var len = J.j.def.id === 'tyre' ? 90 : 62;
      var ang = Math.atan2(y1 - y0, x1 - x0), hx = x0 + Math.cos(ang) * len, hy2 = y0 + Math.sin(ang) * len;
      if (J.j.def.id === 'tyre') {
        ctx.strokeStyle = css(tong); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(run.where === 'fire' ? 140 : 500, run.where === 'fire' ? 40 : 76, 108, Math.PI * 0.62, Math.PI * 0.38, true); ctx.stroke();
      }
      ctx.strokeStyle = css(tong); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy2); ctx.lineTo(x1, y1); ctx.stroke();
      var lg = ctx.createLinearGradient(x0, y0, hx, hy2);
      lg.addColorStop(0, css(hot)); lg.addColorStop(0.7, css(hot)); lg.addColorStop(1, css(tempering ? hot : seen(run.T - 260, amb, [58, 56, 54])));
      ctx.strokeStyle = lg; ctx.lineWidth = J.j.def.metal === 'steel' ? 8 : 10;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy2); ctx.stroke();
      if (!tempering && glowI(run.T) > 0.05) {
        var gg = ctx.createRadialGradient(x0 + 20, y0, 2, x0 + 20, y0, 34);
        gg.addColorStop(0, css(hot, 0.5 * clamp(glowI(run.T) / (0.3 + amb), 0, 1))); gg.addColorStop(1, css(hot, 0));
        ctx.fillStyle = gg; ctx.fillRect(x0 - 30, y0 - 40, 100, 80);
      }
      ctx.lineCap = 'butt';
    }
    // the hammer
    if (run.hammer > 0) {
      ctx.save(); ctx.translate(560, 120); ctx.rotate(-0.5 + (0.16 - run.hammer) * 3);
      ctx.fillStyle = css([80 * k + 10, 60 * k + 8, 40 * k + 6]); ctx.fillRect(-4, 0, 8, 70);
      ctx.fillStyle = css([90 * k + 14, 92 * k + 14, 96 * k + 14]); ctx.fillRect(-16, 54, 32, 18);
      ctx.restore();
    }
    // sparks
    for (var q = 0; q < run.sparks.length; q++) {
      var sp = run.sparks[q];
      ctx.fillStyle = 'rgba(255,' + (200 + sp.life * 50 | 0) + ',140,' + clamp(sp.life * 1.4, 0, 1) + ')';
      ctx.fillRect(sp.x, sp.y, 2, 2);
    }
    // the bright face of the steel, while tempering
    if (J && s && s.k === 'temper' && J.temper) {
      var bx = 290, by = 22, bw = 270, bh = 30;
      ctx.fillStyle = 'rgba(8,10,14,.82)'; ctx.fillRect(bx - 10, by - 12, bw + 20, bh + 40);
      for (var i2 = 0; i2 < 40; i2++) {
        ctx.fillStyle = css(temperColour(J.temper.max[i2]));
        var w = bw / 40;
        if (i2 === 39) { ctx.beginPath(); ctx.moveTo(bx + i2 * w, by); ctx.lineTo(bx + bw + 8, by + bh / 2); ctx.lineTo(bx + i2 * w, by + bh); ctx.closePath(); ctx.fill(); }
        else ctx.fillRect(bx + i2 * w, by, w + 0.6, bh);
      }
      if (J.temper.Ts > 520) { ctx.fillStyle = css(seen(J.temper.Ts, amb), 0.6); ctx.fillRect(bx, by, 26, bh); }
      ctx.fillStyle = '#8b97ab'; ctx.font = '600 10px ui-monospace,Menlo,monospace';
      ctx.fillText('SHANK', bx, by + bh + 16); ctx.textAlign = 'right'; ctx.fillText('EDGE', bx + bw + 8, by + bh + 16); ctx.textAlign = 'left';
    }
  }

  function loop(ts) {
    var now = ts / 1000;
    var dt = loop.last ? Math.min(0.05, now - loop.last) : 0.016;
    loop.last = now;
    tick(dt);
    run.hammer = Math.max(0, run.hammer - dt);
    run.steam = Math.max(0, run.steam - dt * 0.7);
    for (var i = run.sparks.length - 1; i >= 0; i--) {
      var s = run.sparks[i];
      s.life -= dt; s.vy += 300 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) run.sparks.splice(i, 1);
    }
    draw();
    hud();
    requestAnimationFrame(loop);
  }

  /* ---------- the page ---------- */
  function hud() {
    var amb = ambient(run.min, run.t), J = job(), s = step();
    $('hClock').textContent = run.started ? clockStr(run.min) : clockStr(START);
    $('hLight').textContent = amb < 0.2 ? 'dark' : amb < 0.38 ? 'dim' : amb < 0.6 ? 'light' : amb < 0.8 ? 'bright' : 'full daylight';
    var fw;
    if (run.cleaning > 0) fw = 'being cleaned';
    else {
      fw = run.clinker > 90 ? 'choked with clinker' : run.clinker > 50 ? 'clinkering' : run.F > 1330 ? 'fierce' : run.F > 1150 ? 'hot' : run.F > 950 ? 'steady' : 'low';
      if (run.blow > 0.5) fw = 'roaring, ' + fw;
    }
    $('hFire').textContent = fw;
    $('hWhere').textContent = run.over ? '—' : run.where === 'fire' ? 'in the fire' : 'on the anvil';
    $('hPurse').textContent = money(run.purse - run.stock);
    var ph = '—';
    if (!run.started) ph = 'the shop is opening';
    else if (run.over) ph = 'shut';
    else if (s) {
      if (s.k === 'forge') ph = 'forging, ' + Math.min(99, Math.round(J.work / s.work * 100)) + '% shaped';
      else if (s.k === 'weld') ph = J.stuck ? 'closing the weld ' + J.weldBlows + '/4' : J.fluxed ? 'welding, fluxed' : 'welding, not fluxed';
      else if (s.k === 'harden') ph = 'hardening';
      else if (s.k === 'temper') ph = 'tempering to ' + s.colour;
    }
    $('hPhase').textContent = ph;
    $('hJob').textContent = J && !run.over ? J.j.def.title : '—';
    $('hCall').textContent = J && !run.over ? clockStr(J.j.call) + (run.min > J.j.call ? ' (waiting)' : '') : '—';
    var hc = $('hCall').parentNode; hc.className = J && !run.over && run.min > J.j.call ? 'alarm' : '';
    syncButtons();
  }
  function syncButtons() {
    var on = run.started && !run.over, s = step();
    $('btnStart').style.display = run.started ? 'none' : '';
    $('tools').style.display = run.started && !run.over ? '' : 'none';
    $('btnFire').textContent = run.where === 'fire' ? 'Out to the anvil (F)' : 'Into the fire (F)';
    $('btnFlux').disabled = !(on && s && s.k === 'weld' && run.where === 'fire');
    $('btnStrike').disabled = !(on && run.where === 'anvil');
    $('btnQuench').disabled = !on;
    $('btnClean').disabled = !(on && run.cleaning <= 0);
    $('btnBlow').classList.toggle('on', run.blowing);
  }
  function sync() { syncButtons(); renderJobs(); }

  function renderJobs() {
    var el = $('orders');
    el.innerHTML = run.jobs.map(function (J, i) {
      var cls = J.done ? 'done' : (i === run.ji && run.started && !run.over) ? 'now' : '';
      var st = J.done ? 'done at ' + clockStr(J.finished) + ' · ' + money(J.pay) : 'call ' + clockStr(J.j.call);
      return '<li class="' + cls + '"><b>' + cap1(J.j.def.title) + '</b><span>Mr ' + J.j.name + ', ' + J.j.def.who + '</span><em>' + st + '</em></li>';
    }).join('');
  }

  function plaque() {
    var d = day;
    $('fWho').textContent = d.weekday + ' ' + d.date.getDate() + ' ' + MONTHS[d.date.getMonth()] + ' ' + d.year + ' · ' + d.village.name + ', ' + d.village.county;
    $('fName').textContent = 'The forge at ' + d.village.name;
    var e = sunElev(12 * 60) * 180 / Math.PI;
    $('fBlurb').innerHTML = d.weather.say + ' The sun gets to ' + Math.round(e) + '° at noon today and the air in the shop is ' + Math.round(d.air * 9 / 5 + 32) + '°F. ' +
      'In the hearth: ' + d.coal.say.replace(d.coal.name, '<b>' + d.coal.name + '</b>') +
      ' In the rack: <b>' + d.iron.name + '</b> and a bar of <b>' + d.steel.name + '</b>. Three orders on the slate, and they will call at the hour they were promised.';
    var card = $('card');
    var amb0 = 0.1;
    card.innerHTML = '<h5>The heats, as they look in a dark shop</h5><div class="sw">' + CARD.map(function (c) {
      return '<span><i style="background:' + css(seen(c.t, amb0)) + '"></i>' + c.n + '</span>';
    }).join('') + '</div><h5>The temper colours on bright steel</h5><div class="sw">' + TEMPER.slice(1, 9).map(function (c) {
      return '<span><i style="background:' + css(c.c) + '"></i>' + c.n + '</span>';
    }).join('') + '</div>';
    $('dayOut').textContent = (offset === 0 ? 'Today' : offset < 0 ? (-offset) + ' day' + (offset < -1 ? 's' : '') + ' ago' : 'In ' + offset + ' day' + (offset > 1 ? 's' : '')) + ' · ' + d.village.name + ' ' + d.year;
  }

  function showVerdict() {
    var v = $('verdict');
    var done = run.jobs.filter(function (J) { return J.done; });
    var earned = run.purse, net = run.purse - run.stock;
    var possible = run.jobs.reduce(function (a, J) { return a + J.j.def.price; }, 0);
    var html = '<h5>Dinner time</h5><p>' + (done.length === run.jobs.length ? 'All three orders done' : NUMW[done.length] === 'no' ? 'Nothing finished' : cap1(NUMW[done.length]) + ' of three orders done') +
      '. Taken: <b>' + money(earned) + '</b> of the ' + money(possible) + ' on the slate; stock spoiled: ' + money(run.stock) + '; to the good: <b>' + money(net) + '</b>.</p>';
    run.jobs.forEach(function (J) {
      if (J.done) html += '<p><b>' + cap1(J.j.def.title) + '.</b> ' + verdictLine(J) + (J.spoils ? ' (' + cap1(NUMW[J.spoils]) + ' piece' + (J.spoils > 1 ? 's' : '') + ' on the scrap heap first.)' : '') + '</p>';
      else html += '<p><b>' + cap1(J.j.def.title) + '.</b> Mr ' + J.j.name + ' calls and goes away empty handed.</p>';
    });
    v.innerHTML = html;
    v.className = 'verdict ' + (net >= possible * 0.8 ? 'good' : 'warn');
    reveal();
    $('btnAgain').style.display = '';
  }

  function reveal() {
    var R = $('reveal');
    R.style.display = '';
    var d = day;
    var html = '<h5>What the day was really like</h5>' +
      '<p>The ' + d.coal.name + ' would make <b>' + d.coal.max + '°C</b> blown hard in a clean fire. The ' + d.iron.name + ' welded from <b>' + d.iron.weldLo + '°C</b> and began to burn at <b>' + d.iron.burn + '°C</b>, so the welding heat was a band ' + (d.iron.burn - d.iron.weldLo) + ' degrees wide. The ' + d.steel.name +
      ' had ' + d.steel.carbon.toFixed(2) + '% carbon: it hardened from <b>' + d.steel.crit + '°C</b> (best below ' + (d.steel.crit + 60) + '°C) and burned at <b>' + d.steel.burn + '°C</b>.</p>';
    run.jobs.forEach(function (J, i) {
      html += '<p><b>' + cap1(J.j.def.title) + '</b>' + (J.temper && J.temper.got ? ': the edge was let down to ' + Math.round(J.temper.got) + '°C (' + temperName(J.temper.got) + ') against ' + J.j.def.steps[2].target + '°C (' + J.j.def.steps[2].colour + ')' : '') + '.</p><canvas class="trace" id="tr' + i + '" width="600" height="170"></canvas>';
    });
    html += '<p class="key"><span style="color:#64f0c8">● a good blow</span> <span style="color:#ffce6a">● a stiff one</span> <span style="color:#ff8a7a">● cold or failed</span> <span style="color:#fff">◆ weld took</span> <span style="color:#7aa2ff">▼ quench</span> <span style="color:#c58cff">✕ scrapped</span></p>';
    R.innerHTML = html;
    run.jobs.forEach(function (J, i) { drawTrace($('tr' + i), J); });
  }

  function drawTrace(c, J) {
    var g = c.getContext('2d'), W = c.width, H = c.height, L = 38, B = 18;
    g.fillStyle = '#0e131b'; g.fillRect(0, 0, W, H);
    var tr = J.trace;
    if (!tr.length) { g.fillStyle = '#8b97ab'; g.font = '12px ui-monospace,Menlo,monospace'; g.fillText('Not started.', 50, 90); return; }
    var tmax = Math.max(20, tr[tr.length - 1][0]);
    function X(t) { return L + (t / tmax) * (W - L - 8); }
    function Y(T) { return H - B - (T / 1500) * (H - B - 8); }
    var M = J.j.def.metal === 'steel' ? day.steel : day.iron;
    function band(a, b, col) { g.fillStyle = col; g.fillRect(L, Y(b), W - L - 8, Y(a) - Y(b)); }
    band(M.burn, 1500, 'rgba(255,90,90,.16)');
    if (J.j.def.metal === 'steel') { band(day.steel.crit, day.steel.crit + 60, 'rgba(122,162,255,.2)'); band(830, Math.min(1150, M.burn), 'rgba(100,240,200,.07)'); }
    else if (J.j.def.steps[0].k === 'weld') band(day.iron.weldLo, day.iron.burn, 'rgba(255,255,255,.16)');
    else band(880, 1300, 'rgba(100,240,200,.07)');
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = '#8b97ab'; g.font = '10px ui-monospace,Menlo,monospace';
    for (var T = 0; T <= 1500; T += 300) { g.beginPath(); g.moveTo(L, Y(T)); g.lineTo(W - 8, Y(T)); g.stroke(); g.fillText(T + '°', 2, Y(T) + 3); }
    for (var t = 0; t <= tmax; t += 30) g.fillText(Math.round(t * FAST / 60) + 'm', X(t) - 6, H - 4);
    for (var i = 1; i < tr.length; i++) {
      var a = tr[i - 1], b = tr[i];
      g.strokeStyle = b[1] > 500 ? css(seen(b[1], 0.08)) : '#5b6475';
      g.lineWidth = b[2] ? 2.4 : 1.4;
      g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.lineTo(X(b[0]), Y(b[1])); g.stroke();
    }
    J.events.forEach(function (e) {
      var x = X(e.t), y = Y(e.T);
      if (e.type === 'blow') {
        g.fillStyle = e.x === 'good' ? '#64f0c8' : e.x === 'stiff' ? '#ffce6a' : e.x === 'weld' ? '#ffffff' : '#ff8a7a';
        if (e.x === 'weld') { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.closePath(); g.fill(); }
        else { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); }
      } else if (e.type === 'quench') { g.fillStyle = '#7aa2ff'; g.beginPath(); g.moveTo(x - 5, y - 8); g.lineTo(x + 5, y - 8); g.lineTo(x, y); g.closePath(); g.fill(); }
      else if (e.type === 'spoil') { g.strokeStyle = '#c58cff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke(); }
    });
  }

  function setDay(off) {
    offset = off;
    day = makeDay(offset);
    newRun();
    $('msg').innerHTML = '';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none';
    $('btnAgain').style.display = 'none';
    plaque();
    renderJobs();
    sync();
  }

  function init() {
    cv = $('forge');
    ctx = cv.getContext('2d');
    $('btnStart').addEventListener('click', begin);
    $('btnFire').addEventListener('click', toggleFire);
    $('btnStrike').addEventListener('click', strike);
    $('btnFlux').addEventListener('click', flux);
    $('btnQuench').addEventListener('click', quench);
    $('btnClean').addEventListener('click', cleanFire);
    $('btnShut').addEventListener('click', shutShop);
    $('btnAgain').addEventListener('click', function () { setDay(offset); });
    var bb = $('btnBlow');
    function down(e) { e.preventDefault(); if (run.started && !run.over) run.blowing = true; }
    function up() { run.blowing = false; }
    bb.addEventListener('pointerdown', down);
    bb.addEventListener('pointerup', up);
    bb.addEventListener('pointerleave', up);
    bb.addEventListener('pointercancel', up);
    bb.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('blur', up);
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      if (!run.started || run.over) return;
      if (k === ' ') { e.preventDefault(); strike(); }
      else if (k === 'b') { run.blowing = true; }
      else if (k === 'f') toggleFire();
      else if (k === 's') flux();
      else if (k === 'q') quench();
      else if (k === 'c') cleanFire();
    });
    document.addEventListener('keyup', function (e) { if (e.key.toLowerCase() === 'b') run.blowing = false; });
    $('btnDayPrev').addEventListener('click', function () { setDay(offset - 1); });
    $('btnDayToday').addEventListener('click', function () { setDay(0); });
    $('btnDayNext').addEventListener('click', function () { setDay(offset + 1); });
    setDay(0);
    requestAnimationFrame(loop);
  }

  window.DriftForge = { makeDay: function (o) { return makeDay(o); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
