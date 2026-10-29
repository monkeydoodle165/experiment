/* drift.quibo.games — The Bakehouse
   A village bakehouse with a brick oven, some time between 1800 and 1899, on today's calendar date. The day's
   number picks the village, the oven (how much brick it has to soak up heat, and so how slowly it falls), the
   faggots in the stack (furze that flares and is gone, or beech bavins that burn long), the barm in the dough
   (and so the hour it will be proved), the price of the quartern loaf that year, and three dishes that neighbours
   will carry in at the door to be baked in the falling oven after the bread.

   The baker has no thermometer. The oven is fired with the door open, the fire is raked out, the floor swabbed,
   and from then on the oven only ever cools. The heat is judged three ways the old bakers used: the soot burning
   off the crown, a pinch of flour thrown on the floor and how fast it browns, and how long you can bear your bare
   arm in the mouth. The trap is that the crown and the floor tell you about the surface of the brick, while what
   bakes the last dish at eleven o'clock is the heat that has soaked into the depth of it.

   The oven is two lumps of heat: a thin surface the fire and the dough touch, and a deep mass behind it that
   fills slowly and empties slowly. Every dish browns faster than it bakes through as the heat goes up, so each
   has a band of heat where crust and crumb finish together. Self-contained. */
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
    var h = s ^ 0x5b4e1c27;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

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

  /* ---------- constants (temperatures in °F, which is what an English baker would have heard of) ---------- */
  var START = 4 * 60;          // the baker is down at four
  var SHUT = 13 * 60;          // and the oven is finished with at one
  var PACE = 4;                // bakehouse minutes per real second
  var HURRY = 16;              // with the clock hurried
  var SLOTS = 6;               // room on the oven floor
  var GAP = 0.13;              // how well the surface of the brick talks to the depth of it
  var CS = 1;                  // heat the surface holds (relative)
  var HS_OPEN = 0.022;         // loss from the surface with the door open (firing)
  var HS_SHUT = 0.0045;        // ... and with it shut
  var MAXIN = 3;               // faggots in the oven at once

  var VILLAGES = [
    { name: 'Steeple Bumpstead', county: 'Essex' }, { name: 'Long Melford', county: 'Suffolk' },
    { name: 'Chipping Campden', county: 'Gloucestershire' }, { name: 'Ambleside', county: 'Westmorland' },
    { name: 'Helmsley', county: 'the North Riding' }, { name: 'Llandovery', county: 'Carmarthenshire' },
    { name: 'Chagford', county: 'Devon' }, { name: 'Cerne Abbas', county: 'Dorset' },
    { name: 'Oakham', county: 'Rutland' }, { name: 'Rothbury', county: 'Northumberland' },
    { name: 'Selkirk', county: 'Selkirkshire' }, { name: 'Weobley', county: 'Herefordshire' },
    { name: 'Wells-next-the-Sea', county: 'Norfolk' }, { name: 'Midhurst', county: 'Sussex' },
    { name: 'Woodstock', county: 'Oxfordshire' }, { name: 'Tenterden', county: 'Kent' }
  ];
  var OVENS = [
    { name: 'a small oven in the wall of the cottage', cd: 3.0, hd: 0.0068, loaves: 28,
      say: 'a small oven built into the cottage wall: it heats quickly and does not keep its heat long' },
    { name: 'a beehive oven of common brick', cd: 4.0, hd: 0.0058, loaves: 36,
      say: 'a beehive oven of common brick, a sack-and-a-half oven, middling slow to heat and to cool' },
    { name: 'an old deep oven floored with Stourbridge tiles', cd: 5.2, hd: 0.005, loaves: 44,
      say: 'an old deep oven with a floor of Stourbridge tiles and a great mass of brick: slow to fire and slow to fall' }
  ];
  var WOODS = [
    { name: 'furze faggots', bt: 4, e: 210, cost: 0.5, stack: 34, ash: 0.6,
      say: 'furze faggots off the common: they roar, throw a great flame across the crown and are gone in a few minutes' },
    { name: 'hedge brush, thorn and hazel', bt: 7, e: 290, cost: 1, stack: 24, ash: 0.8,
      say: 'bundles of hedge brush, thorn and hazel: a quick, bright fire' },
    { name: 'ash faggots', bt: 9, e: 360, cost: 1.5, stack: 20, ash: 0.9,
      say: 'ash faggots, the bakers’ favourite: a steady hot flame that lasts' },
    { name: 'beech bavins', bt: 12, e: 410, cost: 2, stack: 18, ash: 1.2,
      say: 'beech bavins from the hanger: slow to catch and long burning, with a lot of ash to rake' }
  ];
  var BARMS = [
    { name: 'barm from the brewhouse at the inn', lo: 115, hi: 175, say: 'barm fetched from the inn’s brewhouse last night: lively, and never quite the same twice' },
    { name: 'a leaven kept back from yesterday', lo: 170, hi: 225, say: 'a lump of leaven kept back from yesterday’s dough: slow and sure' },
    { name: 'patent yeast of the baker’s own brewing', lo: 135, hi: 185, say: 'patent yeast of malt and hops brewed in the bakehouse copper' },
    { name: 'German yeast from the carrier', lo: 105, hi: 140, say: 'pressed German yeast that came out with the carrier: quick', from: 1850 }
  ];
  /* tref: the heat at which crumb and crust finish together; bake: minutes it takes there */
  var DISHES = [
    { id: 'pork', title: 'a raised pork pie', tref: 400, bake: 95, slots: 1, fee: 2 },
    { id: 'rabbit', title: 'a rabbit pie', tref: 420, bake: 60, slots: 1, fee: 1 },
    { id: 'mutton', title: 'a shoulder of mutton on a bed of potatoes', tref: 410, bake: 110, slots: 1, fee: 2 },
    { id: 'rice', title: 'a dish of baked rice pudding', tref: 310, bake: 110, slots: 1, fee: 1 },
    { id: 'plum', title: 'a plum cake for a christening', tref: 345, bake: 125, slots: 1, fee: 3 },
    { id: 'seed', title: 'a seed cake', tref: 360, bake: 75, slots: 1, fee: 1 },
    { id: 'rusks', title: 'two dozen rusks to dry', tref: 270, bake: 140, slots: 1, fee: 1 },
    { id: 'ham', title: 'a ham baked in a flour crust', tref: 380, bake: 150, slots: 2, fee: 3 },
    { id: 'tarts', title: 'a tray of apple turnovers', tref: 430, bake: 40, slots: 1, fee: 1 }
  ];
  var NAMES = ['Mrs Pinnock', 'Mrs Day', 'Mrs Gotobed', 'the Rectory cook', 'Mrs Sallis', 'Mrs Whybrow', 'the Hall kitchen', 'Mrs Fitch', 'Mrs Clutterbuck', 'old Mrs Ling', 'Mrs Alabaster', 'the landlady of the Bell', 'Mrs Sparrow', 'Mrs Hurrell'];
  var BAKERS = ['Pettigrew', 'Hobday', 'Crisp', 'Manning', 'Boniface', 'Snell', 'Kibble', 'Wiseman', 'Loveday', 'Bunyard', 'Hutley', 'Purkiss'];

  /* the flour test and what the old bakers said of it */
  var FLOUR = [
    { t: 0, n: 'stays white', c: [236, 230, 214] },
    { t: 290, n: 'turns cream', c: [226, 208, 166] },
    { t: 340, n: 'goes a biscuit colour', c: [210, 172, 112] },
    { t: 400, n: 'browns slowly, in a count of twenty', c: [184, 128, 66] },
    { t: 460, n: 'browns in a count of ten', c: [150, 92, 42] },
    { t: 545, n: 'goes dark brown in a count of five', c: [92, 52, 24] },
    { t: 615, n: 'catches and blackens at once', c: [34, 22, 16] }
  ];
  function flourAt(T) { var f = FLOUR[0]; for (var i = 0; i < FLOUR.length; i++) if (T >= FLOUR[i].t) f = FLOUR[i]; return f; }
  function flourCol(T) {
    for (var i = 1; i < FLOUR.length; i++) if (T < FLOUR[i].t) {
      var a = FLOUR[i - 1], b = FLOUR[i], u = i === 1 ? smooth(190, 290, T) : clamp((T - a.t) / (b.t - a.t), 0, 1);
      return [lerp(a.c[0], b.c[0], u), lerp(a.c[1], b.c[1], u), lerp(a.c[2], b.c[2], u)];
    }
    return FLOUR[FLOUR.length - 1].c;
  }
  function crownWord(w) {
    return w < 0.08 ? 'black with soot' : w < 0.3 ? 'black, greying at the top' : w < 0.6 ? 'grey' : w < 0.9 ? 'whitening' : 'white';
  }
  function proofWord(p) {
    return p < 0.6 ? 'tight, barely moved' : p < 0.85 ? 'rising' : p < 0.97 ? 'nearly proved' : p < 1.12 ? 'proved: ready' : p < 1.28 ? 'going over' : 'over-proved, sinking';
  }

  /* ---------- the day ---------- */
  function makeDay(off, dateIn) {
    var date = dateIn || dateFor(off), seed = seedForDate(date), r = rng(seed);
    var d = { date: date, seed: seed };
    d.year = 1800 + Math.floor(r() * 100);
    d.village = pick(r, VILLAGES);
    d.baker = pick(r, BAKERS);
    d.oven = pick(r, OVENS);
    d.wood = pick(r, WOODS);
    var barms = BARMS.filter(function (b) { return !b.from || d.year >= b.from; });
    d.barm = pick(r, barms);
    var m = date.getMonth();
    d.air = Math.round([38, 39, 43, 48, 54, 60, 63, 62, 58, 51, 44, 40][m] + (r() - 0.5) * 8);
    /* a warm kitchen proves faster */
    var warm = clamp((d.air - 50) / 30, -0.3, 0.3);
    d.proofAt = START + Math.round(lerp(d.barm.lo, d.barm.hi, r()) * (1 - warm));
    d.proof0 = 0.22 + r() * 0.1;
    d.ovenStart = Math.round(d.air + 25 + r() * 35);  // yesterday's heat still in the brick
    d.stack = d.wood.stack + Math.floor(r() * 4);
    d.loaves = d.oven.loaves + Math.floor(r() * 5) - 2;
    d.bread = { id: 'bread', title: d.loaves + ' quartern loaves', tref: Math.round(455 + r() * 30), bake: Math.round(48 + r() * 12), slots: 4 };
    /* the price of the quartern loaf: dear in the war years, cheaper after the Corn Laws went */
    var p = d.year < 1816 ? 13 : d.year < 1846 ? 10 : d.year < 1870 ? 8 : 7;
    d.price = p + (r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1));
    d.flourCost = Math.round(d.loaves * d.price * 0.62);
    var pool = shuffle(r, DISHES.slice()), dishes = [], hot = 0;
    for (var i = 0; i < pool.length && dishes.length < 3; i++) {
      var D = pool[i];
      if (D.tref >= 395 && hot >= 2) continue;
      if (D.tref >= 395) hot++;
      dishes.push(D);
    }
    if (dishes.every(function (D) { return D.tref >= 380; })) dishes[2] = pick(r, DISHES.filter(function (D) { return D.tref < 330; }));
    dishes.sort(function (a, b) { return b.tref - a.tref; });
    var names = shuffle(r, NAMES.slice());
    d.dishes = dishes.map(function (D, i) {
      var arrive = Math.round((d.proofAt + 30 + i * (35 + r() * 35) + r() * 25) / 15) * 15;
      arrive = Math.min(arrive, Math.floor((SHUT - D.bake * 1.3 - 15) / 15) * 15);
      var call = Math.min(SHUT, Math.round((arrive + D.bake + 50 + r() * 70) / 15) * 15);
      if (call - arrive < D.bake + 30) call = Math.min(SHUT, arrive + D.bake + 30);
      return { def: D, who: names[i], arrive: arrive, call: call };
    });
    d.weekday = WEEKDAYS[new Date(d.year, m, date.getDate()).getDay()];
    d.dateStr = d.weekday + ' ' + date.getDate() + ' ' + MONTHS[m] + ' ' + d.year;
    return d;
  }

  /* ---------- the oven model ---------- */
  function newRun(d) {
    var R = {
      d: d, t: START, Ts: d.ovenStart, Td: d.ovenStart, peak: d.ovenStart, fag: [], burnt: 0, ash: false,
      raked: false, swabbed: false, fired: false, used: 0, door: 0, proof: d.proof0, hurry: false,
      started: false, over: false, trace: [], marks: [], msgs: [], warned: {}, rakeT: null, flour: null
    };
    R.items = [{ def: d.bread, who: null, arrive: START, call: SHUT, bread: true }].concat(d.dishes).map(function (x) {
      return { def: x.def, who: x.who, arrive: x.arrive, call: x.call, bread: !!x.bread, st: 'wait', dn: 0, cr: 0, inAt: null, outAt: null, inT: null, proofIn: null };
    });
    return R;
  }
  function firePower(R) {
    var P = 0, w = R.d.wood;
    R.fag.forEach(function (f) { if (f.age < w.bt) P += (w.e / w.bt) * 2 * (1 - f.age / w.bt); });
    return P;
  }
  function onFloor(R) { return R.items.filter(function (it) { return it.st === 'in'; }); }
  function slotsUsed(R) { return onFloor(R).reduce(function (a, it) { return a + it.def.slots; }, 0); }

  /* advance the oven by dt minutes */
  function step(R, dt) {
    var d = R.d, w = d.wood, n = Math.max(1, Math.ceil(dt / 0.25)), h = dt / n;
    for (var k = 0; k < n; k++) {
      var P = firePower(R);
      var open = R.fag.length > 0 || R.ash || R.door > 0;
      var hs = open ? HS_OPEN : HS_SHUT;
      var q = GAP * (R.Ts - R.Td);
      R.Ts += h * (P * (1 - R.Ts / 1250) - q - hs * (R.Ts - d.air)) / CS;
      R.Td += h * (q - d.oven.hd * (R.Td - d.air)) / d.oven.cd;
      if (R.Ts > R.peak) R.peak = R.Ts;
      for (var i = R.fag.length - 1; i >= 0; i--) {
        R.fag[i].age += h;
        if (R.fag[i].age >= w.bt) { R.fag.splice(i, 1); R.burnt++; R.ash = true; }
      }
      if (R.door > 0) R.door = Math.max(0, R.door - h);
      R.items.forEach(function (it) {
        if (it.st !== 'in') return;
        var D = it.def, db = D.tref - 220, cb = D.tref - 140;
        it.dn += h / D.bake * Math.max(0, (R.Ts - db) / (D.tref - db));
        var c = Math.max(0, (R.Ts - cb) / (D.tref - cb));
        it.cr += h / D.bake * c * c;
      });
      var bread = R.items[0];
      if (bread.st === 'wait') R.proof += h * (1 - d.proof0) / (d.proofAt - START);
      R.t += h;
    }
  }
  function addFaggot(R) {
    if (R.raked) return 'The oven is raked out and swabbed; it will not be fired again today.';
    if (R.used >= R.d.stack) return 'The stack is gone.';
    if (R.fag.length >= MAXIN) return 'The mouth is full: no room for another until one burns down.';
    R.fag.push({ age: 0 }); R.used++; R.fired = true;
    R.marks.push({ t: R.t, k: 'fag' });
    return null;
  }
  function rakeOut(R) {
    if (R.raked) return 'Already raked out.';
    if (!R.fired) return 'There is nothing in the oven to rake out yet.';
    var left = R.fag.length;
    R.fag = []; R.ash = false; R.raked = true; R.rakeT = R.t; R.door = 3;
    R.rakeTs = R.Ts; R.rakeTd = R.Td;
    R.marks.push({ t: R.t, k: 'rake' });
    return left ? 'Raked out with ' + NUMW[left] + ' faggot' + (left > 1 ? 's' : '') + ' still burning: they go into the ash pit.' : null;
  }
  function swab(R) {
    if (!R.raked) return 'Rake the fire out first.';
    if (R.swabbed) return 'The floor is already swabbed.';
    R.swabbed = true; R.Ts -= 22; R.door = Math.max(R.door, 2);
    R.marks.push({ t: R.t, k: 'swab' });
    return null;
  }
  function load(R, it) {
    if (!R.raked) return R.fired ? 'Not with the fire still in.' : 'The oven has not been fired.';
    if (it.st !== 'ready' && !(it.bread && it.st === 'wait')) return null;
    if (slotsUsed(R) + it.def.slots > SLOTS) return 'No room on the floor for that.';
    it.st = 'in'; it.inAt = R.t; it.inT = R.Ts; it.ash = !R.swabbed;
    if (it.bread) it.proofIn = R.proof;
    R.Ts -= 5 + 7 * it.def.slots; R.Td -= 0.7 * it.def.slots; R.door = Math.max(R.door, 1.5);
    return null;
  }
  function draw(R, it) {
    if (it.st !== 'in') return null;
    it.st = 'out'; it.outAt = R.t; it.outT = R.Ts;
    R.Ts -= 4 + 2 * it.def.slots; R.door = Math.max(R.door, 1);
    return null;
  }

  /* how a thing came out */
  function judge(it) {
    var o = { q: 1, bits: [] };
    if (it.st === 'wait' || it.st === 'ready' || it.st === 'gone') { o.q = 0; o.bits.push('never baked'); return o; }
    var dn = it.dn, cr = it.cr;
    if (dn < 0.6) { o.q -= 0.9; o.bits.push('raw in the middle'); }
    else if (dn < 0.88) { o.q -= 0.45; o.bits.push('sad and doughy in the middle'); }
    else if (dn > 1.7) { o.q -= 0.5; o.bits.push('dried hard'); }
    else if (dn > 1.3) { o.q -= 0.2; o.bits.push('a little dry'); }
    if (cr > 1.85) { o.q -= 0.7; o.bits.push('burnt'); }
    else if (cr > 1.4) { o.q -= 0.2; o.bits.push('high-coloured'); }
    else if (cr < 0.35) { o.q -= 0.35; o.bits.push('white as a ghost'); }
    else if (cr < 0.6) { o.q -= 0.15; o.bits.push('pale'); }
    if (it.bread) {
      if (it.proofIn < 0.7) { o.q -= 0.45; o.bits.push('put in long before it was proved, so it burst and came out close and heavy'); }
      else if (it.proofIn < 0.88) { o.q -= 0.2; o.bits.push('a little under-proved, torn at the side'); }
      else if (it.proofIn > 1.45) { o.q -= 0.55; o.bits.push('over-proved till it sank, sour and flat'); }
      else if (it.proofIn > 1.25) { o.q -= 0.25; o.bits.push('over-proved, flat topped'); }
    }
    if (it.ash) { o.q -= 0.08; o.bits.push('ash on the bottoms'); }
    if (!o.bits.length) o.bits.push(it.bread ? 'well risen, a good brown crust and a crumb that springs back' : 'done to a turn');
    o.q = clamp(o.q, 0, 1);
    return o;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { makeDay: makeDay, newRun: newRun, step: step, addFaggot: addFaggot, rakeOut: rakeOut, swab: swab, load: load, draw: draw, judge: judge, START: START, SHUT: SHUT };
  }
  if (typeof document === 'undefined') return;

  /* ===================================================================== page ===================================================================== */
  function $(id) { return document.getElementById(id); }
  function css(c, a) { return a === undefined ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  var offset = 0, day = null, run = null, cv, ctx, last = 0, flick = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function say(html) {
    run.msgs.unshift('<div>' + '<b>' + clockStr(run.t) + '</b> · ' + html + '</div>');
    run.msgs = run.msgs.slice(0, 3);
    $('msg').innerHTML = run.msgs.join('');
  }
  function act(fn) {
    return function () {
      if (!run.started || run.over) return;
      var m = fn();
      if (m) say(m);
      renderItems(); sync();
    };
  }

  function plaque() {
    var d = day;
    $('bWho').textContent = d.dateStr + ' · ' + d.village.name + ', ' + d.village.county;
    $('bName').textContent = 'Mr ' + d.baker + '’s bakehouse';
    $('bBlurb').innerHTML = 'The oven is ' + d.oven.say.replace(d.oven.name, '<b>' + d.oven.name + '</b>') + '. ' +
      'Stacked by the door, ' + d.stack + ' ' + d.wood.say.replace(d.wood.name, '<b>' + d.wood.name + '</b>') + '. ' +
      'The dough for <b>' + d.loaves + ' quartern loaves</b> was set last night with ' + d.barm.say.replace(d.barm.name, '<b>' + d.barm.name + '</b>') + '; it is in the trough by the oven, and the kitchen is ' + d.air + '°F. ' +
      'Bread is ' + d.price + 'd the quartern this year. After the bread, three neighbours will bring dishes to the door to go in the falling oven, a penny or two each.';
    $('card').innerHTML = '<h5>The flour test, as the old bakers told it</h5><div class="sw">' + FLOUR.map(function (f) {
      return '<span><i style="background:' + css(f.c) + '"></i>' + f.n + '</span>';
    }).join('') + '</div><p class="lore">Bread wants the flour to brown in a count of ten, and your arm to bear the mouth for no more than a count of seven or eight. Pies and meat go in when it browns slowly; cakes at a biscuit colour; rusks and puddings last of all, when the flour hardly turns cream.</p>';
    $('dayOut').textContent = (offset === 0 ? 'Today' : offset < 0 ? (-offset) + ' day' + (offset < -1 ? 's' : '') + ' ago' : 'In ' + offset + ' day' + (offset > 1 ? 's' : '')) + ' · ' + d.village.name + ' ' + d.year;
  }

  function itemTitle(it) { return it.bread ? 'The bread: ' + it.def.title : cap1(it.def.title); }
  function renderItems() {
    var ul = $('orders');
    ul.innerHTML = '';
    run.items.forEach(function (it, i) {
      var li = document.createElement('li');
      var state, btn = null;
      if (it.st === 'wait') {
        if (it.bread) { state = 'in the trough · ' + proofWord(run.proof); btn = 'Set the loaves in'; }
        else state = 'coming at ' + clockStr(it.arrive) + ' · calling at ' + clockStr(it.call);
      } else if (it.st === 'ready') { state = 'at the door · calling at ' + clockStr(it.call); btn = 'Put it in'; }
      else if (it.st === 'in') { state = 'in the oven since ' + clockStr(it.inAt); btn = it.bread ? 'Draw the batch' : 'Draw it'; }
      else if (it.st === 'out') { var j = judge(it); state = 'out at ' + clockStr(it.outAt) + ' · ' + j.bits[0]; }
      else state = 'never baked';
      li.className = it.st === 'in' ? 'now' : it.st === 'out' ? 'done' : it.st === 'ready' ? 'ready' : '';
      li.innerHTML = '<b>' + itemTitle(it) + '</b>' + (it.who ? '<span>' + cap1(it.who) + (it.def.slots > 1 ? ' · takes two places' : '') + '</span>' : '<span>takes most of the floor</span>') + '<em>' + state + '</em>';
      if (btn && run.started && !run.over) {
        var b = document.createElement('button');
        b.className = 'btn small' + (it.st === 'in' ? '' : ' ghost'); b.type = 'button';
        b.textContent = btn + ' (' + (i + 1) + ')';
        b.addEventListener('click', act(function () { return it.st === 'in' ? draw(run, it) : load(run, it); }));
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
  }

  function phase() {
    if (!run.started) return 'Before light';
    if (run.over) return 'Shut';
    if (!run.fired) return 'Oven cold';
    if (!run.raked) return run.fag.length ? 'Firing' : 'Fire burnt down';
    if (onFloor(run).length) return 'Baking';
    return 'Raked out, soaking';
  }
  function sync() {
    $('hPhase').textContent = phase();
    $('hClock').textContent = clockStr(run.t) + (run.hurry ? ' »' : '');
    var nf = run.fag.length;
    $('hFire').textContent = run.raked ? 'raked out' : nf ? NUMW[nf] + ' faggot' + (nf > 1 ? 's' : '') + ' blazing' : run.ash ? 'burnt down to ash' : 'none';
    $('hCrown').textContent = crownWord(whiteness());
    $('hDough').textContent = run.items[0].st === 'wait' ? proofWord(run.proof) : 'in the oven';
    var fl = onFloor(run);
    $('hFloor').textContent = fl.length ? slotsUsed(run) + ' of ' + SLOTS + ' places' : run.raked ? (run.swabbed ? 'empty, swabbed' : 'empty, ashy') : run.fired ? 'fire' : 'empty';
    $('hStack').textContent = (day.stack - run.used) + ' faggots';
    $('hDoor').textContent = (run.fag.length || run.ash || run.door > 0) ? 'open' : 'shut';
    var live = run.started && !run.over;
    $('btnFag').disabled = !live || run.raked || run.used >= day.stack || run.fag.length >= MAXIN;
    $('btnRake').disabled = !live || run.raked || !run.fired;
    $('btnSwab').disabled = !live || !run.raked || run.swabbed;
    $('btnFlour').disabled = !live || run.fag.length > 0;
    $('btnHand').disabled = !live || run.fag.length > 0;
    $('btnHurry').classList.toggle('on', run.hurry);
    $('btnHurry').textContent = run.hurry ? 'Hurrying the clock (Z)' : 'Hurry the clock (Z)';
  }
  function whiteness() { return smooth(600, 740, run.peak); }

  function begin() {
    run.started = true;
    $('btnStart').style.display = 'none';
    $('tools').style.display = '';
    say('The lamp is lit. The dough is ' + proofWord(run.proof) + ' in the trough and the oven is cold from yesterday. Fire it with the door open, rake it out, swab the floor, shut the door and let it settle.');
    renderItems(); sync();
  }

  function flourTest() {
    if (run.fag.length) return 'Not with the fire roaring in it.';
    var T = run.Ts + (Math.random() - 0.5) * 12, f = flourAt(T);
    run.flour = { T: T, until: performance.now() + 4500 };
    run.door = Math.max(run.door, 0.5);
    run.marks.push({ t: run.t, k: 'flour', T: run.Ts });
    say('A pinch of flour on the floor: it <b>' + f.n + '</b>.');
    return null;
  }
  function handTest() {
    if (run.fag.length) return 'Not with the fire in.';
    var T = run.Ts, n = Math.round(clamp(3400 / Math.max(60, T - 60), 3, 60) + (Math.random() - 0.5) * 1.6);
    run.door = Math.max(run.door, 0.4);
    run.marks.push({ t: run.t, k: 'hand', T: run.Ts });
    say(T > 620 ? 'You cannot get your arm past the door: the heat drives it back.' : 'You hold your bare arm in the mouth for a count of <b>' + n + '</b>.');
    return null;
  }

  function events() {
    var R = run, W = R.warned;
    R.items.forEach(function (it) {
      if (!it.bread && it.st === 'wait' && R.t >= it.arrive) { it.st = 'ready'; say(cap1(it.who) + ' brings ' + it.def.title + ' to the door, to be called for at ' + clockStr(it.call) + '.'); renderItems(); }
      if (!it.bread && it.st !== 'out' && it.st !== 'gone' && R.t >= it.call && !it.late) { it.late = true; say(cap1(it.who) + ' has come for ' + it.def.title.replace(/^an? /, 'the ').replace(/^two dozen/, 'the') + ' and is waiting.'); }
    });
    var p = R.proof, b = R.items[0];
    if (b.st === 'wait') {
      if (p >= 0.97 && !W.ready) { W.ready = 1; say('The dough is <b>proved</b>: it has doubled and springs back slowly when pressed.'); }
      if (p >= 1.2 && !W.over) { W.over = 1; say('The dough is <b>going over</b>. It wants the oven now.'); }
      if (p >= 1.4 && !W.sink) { W.sink = 1; say('The dough has begun to sink in the trough.'); }
    }
    var w = whiteness();
    if (w > 0.25 && !W.c1) { W.c1 = 1; say('The soot is beginning to burn off the top of the crown.'); }
    if (w > 0.9 && !W.c2) { W.c2 = 1; say('The crown has gone <b>white</b>.'); }
    if (R.fired && !R.raked && !R.fag.length && R.ash && !W.down) { W.down = 1; say('The fire has burnt down. More faggots, or rake out.'); }
    if (R.fag.length) W.down = 0;
  }

  function loop(now) {
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    flick += dt;
    if (run && run.started && !run.over) {
      step(run, dt * (run.hurry ? HURRY : PACE));
      if (Math.floor(run.t) % 2 === 0 && (!run.trace.length || run.t - run.trace[run.trace.length - 1][0] >= 2)) run.trace.push([run.t, run.Ts, run.Td]);
      events();
      if (run.t >= SHUT) shutShop();
      if (Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) { sync(); renderItemsLight(); }
    }
    paint(now);
    requestAnimationFrame(loop);
  }
  /* refresh only the dough line and in-oven states without rebuilding buttons too often */
  var lastSig = '';
  function renderItemsLight() {
    var sig = run.items.map(function (it) { return it.st; }).join() + proofWord(run.proof);
    if (sig !== lastSig) { lastSig = sig; renderItems(); }
  }

  function shutShop() {
    if (run.over) return;
    run.items.forEach(function (it) { if (it.st === 'in') draw(run, it); });
    run.trace.push([run.t, run.Ts, run.Td]);
    run.over = true;
    renderItems(); sync();
    showVerdict();
  }

  /* ---------- drawing the bakehouse ---------- */
  var OX = 230, OY = 236, RX = 168, RY = 140;
  function paint(now) {
    var g = ctx, W = cv.width, H = cv.height, R = run;
    g.fillStyle = '#16110d'; g.fillRect(0, 0, W, H);
    /* lamp glow */
    var lg = g.createRadialGradient(540, 70, 4, 540, 70, 260);
    lg.addColorStop(0, 'rgba(255,196,120,.22)'); lg.addColorStop(1, 'rgba(255,196,120,0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    /* floor of the bakehouse */
    g.fillStyle = '#211a14'; g.fillRect(0, 292, W, 38);
    /* brickwork of the oven */
    g.fillStyle = '#4a2c20'; g.fillRect(30, 70, 420, 222);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    for (var y = 74; y < 292; y += 12) {
      g.beginPath(); g.moveTo(30, y); g.lineTo(450, y); g.stroke();
      for (var x = 30 + ((y / 12) % 2) * 14; x < 450; x += 28) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); }
    }
    /* the deep heat shows as a faint warmth in the brick around the dome */
    var deep = clamp((R.Td - 150) / 450, 0, 1);
    if (deep > 0) {
      var dg = g.createRadialGradient(OX, OY, RX * 0.6, OX, OY, RX + 50);
      dg.addColorStop(0, 'rgba(255,110,40,' + (0.22 * deep) + ')'); dg.addColorStop(1, 'rgba(255,110,40,0)');
      g.fillStyle = dg; g.fillRect(30, 70, 420, 222);
    }
    /* interior */
    var P = firePower(R), fireOn = R.fag.length > 0;
    g.save();
    g.beginPath(); g.ellipse(OX, OY, RX, RY, 0, Math.PI, 2 * Math.PI); g.closePath(); g.clip();
    var lit = fireOn ? clamp(P / 140, 0.25, 1) : clamp((R.Ts - 380) / 600, 0, 0.35);
    g.fillStyle = css([lerp(14, 120, lit), lerp(10, 50, lit), lerp(8, 18, lit)]);
    g.fillRect(OX - RX, OY - RY, RX * 2, RY);
    if (fireOn) {
      var fl = g.createRadialGradient(OX - 20, OY - 10, 6, OX - 20, OY - 10, RX);
      fl.addColorStop(0, 'rgba(255,220,140,' + (0.65 * lit) + ')'); fl.addColorStop(0.5, 'rgba(255,120,40,' + (0.35 * lit) + ')'); fl.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = fl; g.fillRect(OX - RX, OY - RY, RX * 2, RY);
    }
    g.restore();
    /* crown soot */
    var w = whiteness();
    g.strokeStyle = css([lerp(20, 222, w), lerp(16, 214, w), lerp(14, 200, w)]);
    g.lineWidth = 9;
    g.beginPath(); g.ellipse(OX, OY, RX - 4, RY - 4, 0, Math.PI + 0.06, 2 * Math.PI - 0.06); g.stroke();
    /* the oven floor */
    g.fillStyle = '#2b1c15'; g.fillRect(OX - RX, OY, RX * 2, 10);
    g.fillStyle = css(flourCol(Math.max(0, R.Ts - 60)), 0.12); g.fillRect(OX - RX, OY, RX * 2, 3);
    /* faggots and flame */
    if (fireOn) {
      R.fag.forEach(function (f, i) {
        var fx = OX - 70 + i * 42, life = 1 - f.age / day.wood.bt;
        g.fillStyle = '#3a2614';
        for (var s = -3; s <= 3; s++) { g.save(); g.translate(fx, OY - 6); g.rotate(s * 0.06); g.fillRect(-26, -2 + s, 52, 3); g.restore(); }
        var fh = 30 + 80 * life;
        for (var k = 0; k < 5; k++) {
          var ph = reduce ? 0 : Math.sin(now / 90 + k * 1.7 + i) * 0.5 + Math.sin(now / 53 + k) * 0.3;
          var hx = fx - 20 + k * 10, hh = fh * (0.6 + 0.4 * Math.abs(ph));
          g.fillStyle = k % 2 ? 'rgba(255,196,90,.75)' : 'rgba(255,120,40,.7)';
          g.beginPath(); g.moveTo(hx - 8, OY - 6); g.quadraticCurveTo(hx + ph * 10, OY - 6 - hh * 0.6, hx + ph * 6, OY - 6 - hh); g.quadraticCurveTo(hx + 4, OY - 6 - hh * 0.5, hx + 8, OY - 6); g.fill();
        }
      });
    }
    if (R.ash && !R.raked) {
      g.fillStyle = '#5d554e'; g.beginPath(); g.ellipse(OX - 20, OY - 2, 70, 9, 0, Math.PI, 2 * Math.PI); g.fill();
      g.fillStyle = 'rgba(255,110,40,.55)';
      for (var e = 0; e < 14; e++) { var ex = OX - 80 + ((e * 37) % 120), ey = OY - 3 - ((e * 13) % 6); g.fillRect(ex, ey, 3, 2); }
    }
    if (R.raked && !R.swabbed) { g.fillStyle = 'rgba(140,130,120,.55)'; g.fillRect(OX - RX + 10, OY - 2, RX * 2 - 20, 2); }
    /* things on the floor */
    var sx = OX - RX + 26;
    onFloor(R).forEach(function (it) {
      var col = crustCol(it.cr), wdt = it.def.slots * 46;
      if (it.bread) {
        for (var b = 0; b < 4; b++) for (var rr = 0; rr < 2; rr++) {
          var bx = sx + b * 46 + 22, by = OY - 12 - rr * 4, bw = 18, bh = 11 + 3 * clamp(it.proofIn, 0.5, 1.2) * Math.min(1, it.dn * 2);
          g.fillStyle = css(col, rr ? 0.75 : 1);
          g.beginPath(); g.ellipse(bx + (rr ? 6 : -6), by, bw, bh, 0, Math.PI, 2 * Math.PI); g.fill();
          g.fillRect(bx + (rr ? 6 : -6) - bw, by - 1, bw * 2, 6);
        }
      } else {
        var cx = sx + wdt / 2;
        g.fillStyle = '#8c6a4a'; g.fillRect(cx - wdt / 2 + 6, OY - 10, wdt - 12, 10);
        g.fillStyle = css(col);
        g.beginPath(); g.ellipse(cx, OY - 10, wdt / 2 - 8, 9, 0, Math.PI, 2 * Math.PI); g.fill();
      }
      sx += wdt;
    });
    /* the flour patch */
    if (R.flour && now < R.flour.until) {
      var a = clamp((R.flour.until - now) / 1200, 0, 1);
      var age = 1 - (R.flour.until - now) / 4500, Tshow = lerp(200, R.flour.T, clamp(age * 2.2, 0, 1));
      g.fillStyle = css(flourCol(Tshow), a);
      g.beginPath(); g.ellipse(OX + RX - 52, OY - 1, 20, 4, 0, 0, Math.PI * 2); g.fill();
    }
    /* the mouth and its iron door */
    var open = R.fag.length > 0 || R.ash || R.door > 0;
    g.fillStyle = '#100b08'; g.fillRect(OX + RX - 6, OY - 52, 30, 52);
    if (fireOn) { g.fillStyle = 'rgba(255,150,60,' + (0.3 + 0.3 * lit) + ')'; g.fillRect(OX + RX - 6, OY - 52, 30, 52); }
    if (open) { g.fillStyle = '#2d2d31'; g.fillRect(OX + RX + 24, OY - 56, 6, 58); }
    else { g.fillStyle = '#34343a'; g.fillRect(OX + RX - 8, OY - 56, 34, 58); g.fillStyle = '#55555d'; g.fillRect(OX + RX + 14, OY - 32, 8, 4); }
    /* the trough and the dough */
    g.fillStyle = '#5a3e26'; g.beginPath(); g.moveTo(468, 226); g.lineTo(624, 226); g.lineTo(612, 270); g.lineTo(480, 270); g.closePath(); g.fill();
    g.fillStyle = '#3e2a19'; g.fillRect(486, 270, 8, 22); g.fillRect(598, 270, 8, 22);
    var bread = R.items[0];
    if (bread.st === 'wait') {
      var pr = R.proof, hgt = 6 + 30 * Math.min(pr, 1.15) - (pr > 1.3 ? (pr - 1.3) * 40 : 0);
      g.fillStyle = pr > 1.25 ? '#d8c9a4' : '#eadcb8';
      g.beginPath(); g.moveTo(474, 228); g.quadraticCurveTo(546, 228 - hgt * 2, 618, 228); g.closePath(); g.fill();
      if (pr > 1.12) { g.fillStyle = 'rgba(120,100,70,.5)'; for (var bb = 0; bb < 7; bb++) { g.beginPath(); g.arc(500 + bb * 15, 226 - hgt * 0.9 + (bb % 2) * 4, 1.6, 0, 7); g.fill(); } }
    }
    g.fillStyle = '#c7b9a5'; g.font = '11px ui-monospace,Menlo,monospace';
    g.fillText('the trough', 506, 304);
    /* faggot stack */
    var left = day.stack - R.used;
    for (var s2 = 0; s2 < Math.min(left, 14); s2++) {
      var stx = 470 + (s2 % 7) * 21, sty = 190 - Math.floor(s2 / 7) * 12;
      g.fillStyle = '#5b4426'; g.fillRect(stx, sty, 19, 9);
      g.fillStyle = '#7a5c33'; g.fillRect(stx + 8, sty, 3, 9);
    }
    g.fillStyle = '#c7b9a5'; g.fillText('the stack · ' + left, 480, 140 + (left > 7 ? 26 : 38));
    /* clock */
    g.fillStyle = '#e8dcc6'; g.font = '600 15px ui-monospace,Menlo,monospace';
    g.fillText(clockStr(R.t), 40, 40);
    g.fillStyle = '#9d907f'; g.font = '11px ui-monospace,Menlo,monospace';
    g.fillText(phase().toLowerCase(), 40, 58);
  }
  function crustCol(c) {
    var stops = [[0, [234, 220, 184]], [0.6, [222, 178, 110]], [1, [190, 122, 54]], [1.45, [126, 70, 30]], [1.9, [44, 28, 20]]];
    for (var i = 1; i < stops.length; i++) if (c < stops[i][0]) {
      var a = stops[i - 1], b = stops[i], u = (c - a[0]) / (b[0] - a[0]);
      return [lerp(a[1][0], b[1][0], u), lerp(a[1][1], b[1][1], u), lerp(a[1][2], b[1][2], u)];
    }
    return stops[stops.length - 1][1];
  }

  /* ---------- the reckoning ---------- */
  function showVerdict() {
    var R = run, d = day, v = $('verdict');
    var bread = R.items[0], jb = judge(bread);
    var sold = 0, html = '<h5>The reckoning</h5>';
    if (bread.st === 'out') {
      var good = Math.round(d.loaves * jb.q), seconds = jb.q > 0.25 ? d.loaves - good : 0;
      sold = good * d.price + seconds * Math.floor(d.price / 2);
      html += '<p><b>The bread</b> went in at ' + clockStr(bread.inAt) + ' and came out at ' + clockStr(bread.outAt) + ': ' + jb.bits.join(', ') + '. ' +
        (jb.q > 0.95 ? 'Every loaf sold at ' + d.price + 'd.' : good + ' loaves sold at ' + d.price + 'd' + (seconds ? ' and ' + seconds + ' as seconds at ' + Math.floor(d.price / 2) + 'd' : '') + (jb.q <= 0.25 ? '; the rest went to the pigs' : '') + '.') + '</p>';
    } else html += '<p><b>The bread</b> was never baked. The flour is wasted and the village goes without.</p>';
    var fees = 0;
    R.items.slice(1).forEach(function (it) {
      var j = judge(it), late = it.outAt && it.outAt > it.call + 1, fee = 0;
      if (it.st === 'out') fee = j.q > 0.7 ? it.def.fee : j.q > 0.35 ? Math.max(0, it.def.fee - 1) : 0;
      if (late && fee > 0) fee -= 0.5;
      fees += fee;
      var who = cap1(it.who);
      if (it.st !== 'out') html += '<p><b>' + cap1(it.def.title) + '.</b> ' + (it.st === 'wait' ? who + ' never got it to you before the oven was done.' : who + ' takes it home unbaked and will tell everyone at chapel.') + '</p>';
      else html += '<p><b>' + cap1(it.def.title) + '</b>, in at ' + clockStr(it.inAt) + ', out at ' + clockStr(it.outAt) + ': ' + j.bits.join(', ') + '. ' +
        (fee >= it.def.fee ? who + ' pays ' + money(it.def.fee) + ' and is pleased.' : fee > 0 ? who + ' pays ' + money(fee) + ' and says so' + (late ? ', having been kept waiting' : '') + '.' : who + ' will not pay for that.') + '</p>';
    });
    var wood = Math.round(R.used * d.wood.cost);
    var net = sold + fees - wood - d.flourCost;
    html += '<p>Bread money <b>' + money(sold) + '</b>, oven pennies <b>' + money(fees) + '</b>; against ' + R.used + ' faggots (' + money(wood) + ') and the flour, barm and salt (' + money(d.flourCost) + '). ' +
      (net >= 0 ? 'To the good on the day: <b>' + money(net) + '</b>.' : 'Out of pocket: <b>' + money(-net) + '</b>.') + '</p>';
    v.innerHTML = html;
    v.className = 'verdict ' + (jb.q > 0.8 && net > 0 ? 'good' : 'warn');
    reveal();
    $('btnAgain').style.display = '';
  }

  function reveal() {
    var R = run, d = day, X = $('reveal');
    X.style.display = '';
    var html = '<h5>What the oven was really doing</h5>';
    if (R.raked) html += '<p>You raked out at <b>' + clockStr(R.rakeT) + '</b> after ' + R.used + ' faggots, with the surface of the brick at <b>' + Math.round(R.rakeTs) + '°F</b> and the depth of it at <b>' + Math.round(R.rakeTd) + '°F</b>. ' +
      (R.rakeTs - R.rakeTd > 170 ? 'The crown and the flour were telling you about the surface; the depth had not soaked, so once the door was shut the floor fell fast towards it.' : R.rakeTd < 430 ? 'The brick never soaked up enough heat to carry the whole morning.' : R.rakeTd > 600 ? 'The brick was soaked very hot: it took a long while to come down to a bread heat.' : 'The oven was fired well through: surface and depth were close, so it fell slowly.') + '</p>';
    else html += '<p>The oven was never raked out, so nothing was baked.</p>';
    html += '<canvas class="trace" id="trace" width="640" height="240"></canvas>';
    html += '<p class="key"><span style="color:#ff9a3c">— the floor (the surface of the brick)</span> <span style="color:#b07a5a">— the depth of the brick</span> <span style="color:#8b97ab">▏ a faggot</span> <span style="color:#e8dcc6">● flour or arm test</span> <span>▭ each thing in the oven, drawn over the band of heat it wanted</span></p>';
    R.items.forEach(function (it) {
      if (it.st !== 'out') return;
      html += '<p><b>' + (it.bread ? 'The bread' : cap1(it.def.title)) + '</b> wanted about <b>' + it.def.tref + '°F</b> for ' + it.def.bake + ' minutes. It went in with the floor at <b>' + Math.round(it.inT) + '°F</b> and came out with it at <b>' + Math.round(it.outT) + '°F</b>' +
        (it.bread ? ', the dough ' + (it.proofIn < 0.88 ? 'not yet proved' : it.proofIn > 1.25 ? 'over-proved' : 'proved') : '') + '.</p>';
    });
    html += '<p>The dough was proved at <b>' + clockStr(d.proofAt) + '</b> and would have been going over by about ' + clockStr(d.proofAt + Math.round((d.proofAt - START) * 0.2 / (1 - d.proof0))) + '.</p>';
    X.innerHTML = html;
    drawTrace($('trace'));
  }

  function drawTrace(c) {
    var g = c.getContext('2d'), W = c.width, H = c.height, L = 44, B = 20, R = run;
    g.fillStyle = '#0e131b'; g.fillRect(0, 0, W, H);
    var t0 = START, t1 = Math.max(R.t, START + 60), Tmax = Math.max(700, Math.ceil(R.peak / 100) * 100);
    function X(t) { return L + (t - t0) / (t1 - t0) * (W - L - 8); }
    function Y(T) { return H - B - (T / Tmax) * (H - B - 10); }
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = '#8b97ab'; g.font = '10px ui-monospace,Menlo,monospace';
    for (var T = 0; T <= Tmax; T += 100) { g.beginPath(); g.moveTo(L, Y(T)); g.lineTo(W - 8, Y(T)); g.stroke(); if (T % 200 === 0) g.fillText(T + '°F', 2, Y(T) + 3); }
    for (var t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) g.fillText(clockStr(t).replace(':00', ''), X(t) - 10, H - 5);
    var cols = ['rgba(255,206,106,', 'rgba(122,162,255,', 'rgba(100,240,200,', 'rgba(197,140,255,'];
    R.items.forEach(function (it, i) {
      if (!it.inAt) return;
      var x0 = X(it.inAt), x1 = X(it.outAt || R.t);
      g.fillStyle = cols[i] + '.16)'; g.fillRect(x0, Y(it.def.tref + 30), x1 - x0, Y(it.def.tref - 30) - Y(it.def.tref + 30));
      g.strokeStyle = cols[i] + '.7)'; g.lineWidth = 1; g.strokeRect(x0, Y(it.def.tref + 30), x1 - x0, Y(it.def.tref - 30) - Y(it.def.tref + 30));
      g.fillStyle = cols[i] + '.95)'; g.fillText(it.bread ? 'bread' : it.def.id, x0 + 3, Y(it.def.tref + 30) - 3);
    });
    function line(k, col, wd) {
      g.strokeStyle = col; g.lineWidth = wd; g.beginPath();
      R.trace.forEach(function (p, i) { if (i) g.lineTo(X(p[0]), Y(p[k])); else g.moveTo(X(p[0]), Y(p[k])); });
      g.stroke();
    }
    line(2, '#b07a5a', 1.6);
    line(1, '#ff9a3c', 2);
    R.marks.forEach(function (m) {
      var x = X(m.t);
      if (m.k === 'fag') { g.fillStyle = '#8b97ab'; g.fillRect(x, H - B - 6, 1.5, 6); }
      else if (m.k === 'rake' || m.k === 'swab') { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, 8); g.lineTo(x, H - B); g.stroke(); g.setLineDash([]); g.fillStyle = '#c7b9a5'; g.fillText(m.k === 'rake' ? 'raked' : 'swabbed', x + 3, m.k === 'rake' ? 16 : 28); }
      else { g.fillStyle = '#e8dcc6'; g.beginPath(); g.arc(x, Y(m.T), 2.8, 0, 7); g.fill(); }
    });
  }

  function setDay(off) {
    offset = off;
    day = makeDay(offset);
    run = newRun(day);
    lastSig = '';
    $('msg').innerHTML = '';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none';
    $('btnAgain').style.display = 'none';
    $('btnStart').style.display = '';
    $('tools').style.display = 'none';
    plaque(); renderItems(); sync();
  }

  function init() {
    cv = $('oven'); ctx = cv.getContext('2d');
    $('btnStart').addEventListener('click', begin);
    $('btnFag').addEventListener('click', act(function () { return addFaggot(run); }));
    $('btnRake').addEventListener('click', act(function () { return rakeOut(run); }));
    $('btnSwab').addEventListener('click', act(function () { return swab(run); }));
    $('btnFlour').addEventListener('click', act(flourTest));
    $('btnHand').addEventListener('click', act(handTest));
    $('btnHurry').addEventListener('click', act(function () { run.hurry = !run.hurry; return null; }));
    $('btnShut').addEventListener('click', function () { if (run.started && !run.over) shutShop(); });
    $('btnAgain').addEventListener('click', function () { setDay(offset); });
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) && e.key === ' ') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!run.started || run.over) return;
      var k = e.key.toLowerCase(), f = null;
      if (k === 'a') f = function () { return addFaggot(run); };
      else if (k === 'r') f = function () { return rakeOut(run); };
      else if (k === 's') f = function () { return swab(run); };
      else if (k === 't') f = flourTest;
      else if (k === 'h') f = handTest;
      else if (k === 'z') f = function () { run.hurry = !run.hurry; return null; };
      else if (/^[1-4]$/.test(k)) { var it = run.items[+k - 1]; if (it) f = function () { return it.st === 'in' ? draw(run, it) : load(run, it); }; }
      if (f) { e.preventDefault(); act(f)(); }
    });
    $('btnDayPrev').addEventListener('click', function () { setDay(offset - 1); });
    $('btnDayToday').addEventListener('click', function () { setDay(0); });
    $('btnDayNext').addEventListener('click', function () { setDay(offset + 1); });
    setDay(0);
    requestAnimationFrame(loop);
  }

  window.DriftBakehouse = { makeDay: function (o) { return makeDay(o); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
