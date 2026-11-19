/* drift.quibo.games — The Cider Mill
   Five weeks of October and November on a cider farm in one of twelve cider parishes, some time between 1840 and
   1899. The day's number picks the parish, three to five orchards with their apples, how much fruit each carries and
   the week it comes down, the women who gather it, the mill and press in the yard, the price of cider that year, and
   the weather of every day and night: the rain, the gales that shake the trees, and the frosts.

   Each morning you choose whether to send the women out to gather in one orchard, grind and press what is heaped in
   the yard, or do nothing. Apples left in the grass rot and frost; apples heaped in the yard must sweat a fortnight
   before they make good cider, and go rotten if they wait too long. At the end the page sets your season beside the
   farmer's rule (let it sweat a fortnight) and gathering and pressing by turns, on the same farm and the same weather.
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
    var h = s ^ 0x1f83d9ab;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { var u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function degF(c) { return Math.round(c * 9 / 5 + 32) + '°F'; }
  function money(p) {
    var neg = p < 0; p = Math.round(Math.abs(p));
    var L = Math.floor(p / 240), s = Math.floor((p % 240) / 12), d = p % 12;
    return (neg ? '−' : '') + '£' + L + ' ' + s + 's ' + d + 'd';
  }
  function pence(p) { var w = Math.floor(p), h = p - w >= 0.5; return w + (h ? '½' : '') + 'd'; }
  function fmt(n) { return Math.round(n).toLocaleString('en-GB'); }
  function bus(n) { return fmt(n) + (Math.round(n) === 1 ? ' bushel' : ' bushels'); }

  /* ---------- the world ---------- */
  /* R: which cider country; t: warmth; off: days after 30 September the fruit is first worth gathering */
  var PLACES = [
    { name: 'Much Marcle', county: 'Herefordshire', R: 'H', t: 0, off: 3 },
    { name: 'Putley', county: 'Herefordshire', R: 'H', t: 0, off: 4 },
    { name: 'Kingstone', county: 'Herefordshire', R: 'H', t: -0.3, off: 5 },
    { name: 'Dymock', county: 'Gloucestershire', R: 'H', t: 0.1, off: 3 },
    { name: 'Newent', county: 'Gloucestershire', R: 'H', t: 0.1, off: 4 },
    { name: 'Ombersley', county: 'Worcestershire', R: 'H', t: -0.1, off: 5 },
    { name: 'Kingsbury Episcopi', county: 'Somerset', R: 'S', t: 0.5, off: 2 },
    { name: 'Wedmore', county: 'Somerset', R: 'S', t: 0.5, off: 2 },
    { name: 'Baltonsborough', county: 'Somerset', R: 'S', t: 0.4, off: 3 },
    { name: 'Martock', county: 'Somerset', R: 'S', t: 0.5, off: 2 },
    { name: 'Whimple', county: 'Devon', R: 'D', t: 0.8, off: 1 },
    { name: 'Stoke Gabriel', county: 'Devon', R: 'D', t: 1.0, off: 1 }
  ];
  /* d: the day of the season it comes down hardest; px: price against an ordinary cider; c: colour of the fruit */
  var RED = [190, 52, 42], STRIPE = [206, 104, 48], GOLD = [214, 186, 78], GREEN = [146, 172, 72];
  var APPLES = {
    H: [
      { name: 'Foxwhelp', d: 5, px: 1.15, c: STRIPE }, { name: 'Redstreak', d: 10, px: 1.2, c: RED },
      { name: 'Skyrme’s Kernel', d: 10, px: 1.0, c: GOLD }, { name: 'Hagloe Crab', d: 9, px: 1.25, c: GREEN },
      { name: 'Cowarne Red', d: 13, px: 1.0, c: RED }, { name: 'Brown Snout', d: 17, px: 0.95, c: GOLD },
      { name: 'Forest Styre', d: 18, px: 1.1, c: GREEN }, { name: 'Strawberry Norman', d: 16, px: 0.9, c: STRIPE }
    ],
    S: [
      { name: 'Morgan Sweet', d: 3, px: 0.8, c: GOLD }, { name: 'Tom Putt', d: 5, px: 0.9, c: STRIPE },
      { name: 'Kingston Black', d: 11, px: 1.25, c: RED }, { name: 'Lambrook Pippin', d: 12, px: 1.0, c: GOLD },
      { name: 'Royal Wilding', d: 13, px: 1.05, c: STRIPE }, { name: 'Chisel Jersey', d: 17, px: 1.05, c: RED },
      { name: 'Porter’s Perfection', d: 18, px: 1.0, c: STRIPE }, { name: 'Somerset Redstreak', d: 9, px: 1.0, c: RED }
    ],
    D: [
      { name: 'Slack-ma-Girdle', d: 4, px: 0.85, c: GOLD }, { name: 'Tom Putt', d: 5, px: 0.9, c: STRIPE },
      { name: 'Sweet Coppin', d: 11, px: 0.95, c: GOLD }, { name: 'Fair Maid of Devon', d: 10, px: 1.0, c: STRIPE },
      { name: 'Ellis Bitter', d: 13, px: 1.05, c: RED }, { name: 'Bickington Grey', d: 17, px: 1.0, c: GREEN },
      { name: 'Woodbine', d: 15, px: 0.95, c: GREEN }, { name: 'Pig’s Nose', d: 18, px: 0.9, c: RED }
    ]
  };
  var ORCHARDS = ['Church Orchard', 'Home Orchard', 'Long Orchard', 'Pound Orchard', 'Hill Orchard', 'Brook Orchard', 'Old Orchard', 'Wall Orchard', 'Lower Orchard', 'Gospel Oak', 'Pigeon House', 'Barn Close'];
  var MASTERS = ['Thomas', 'William', 'John', 'George', 'Henry', 'James', 'Richard', 'Edward', 'Samuel', 'Robert', 'Charles', 'Joseph'];
  var CIDERMEN = ['old Pritchard', 'old Jenkins', 'old Powell', 'old Bevan', 'old Gane', 'old Hembrow', 'old Keedwell', 'old Vowles', 'old Dart', 'old Cornish', 'old Snell', 'old Heale'];
  var KINDS = {
    dry: { name: 'a dry, still autumn with clear cold nights', wet: 0.22, mean: 4, warm: 0.2, cold: -0.9, gale: 0.3, clear: 0.15 },
    wet: { name: 'a soft, wet autumn', wet: 0.5, mean: 6, warm: 1.1, cold: 1.2, gale: 0.7, clear: -0.25 },
    rough: { name: 'a rough autumn, with gales and an early frost', wet: 0.4, mean: 6, warm: -0.6, cold: -0.4, gale: 1.4, clear: 0 }
  };
  var E = 30;            /* working days until Martinmas, when the men are wanted elsewhere */
  var GAL = 2.6;         /* gallons of cider to a bushel of apples */
  var HOG = 110;         /* gallons to a hogshead */
  var PRESS_COST = 60;   /* two men and the horse, a day, in pence */
  var WAGE = 8;          /* a woman's day in the grass, in pence, and her cider */

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i, j;
    var P = pick(r, PLACES), year = 1840 + Math.floor(r() * 60);
    var dates = [], dt = new Date(year, 8, 30 + P.off, 12);
    while (dates.length < E) { if (dt.getDay() !== 0) dates.push(new Date(dt)); dt.setDate(dt.getDate() + 1); }
    var u = r(), kind = u < 0.34 ? 'dry' : u < 0.67 ? 'wet' : 'rough', K = KINDS[kind];

    var women = 5 + Math.floor(r() * 7);
    var perHead = 16 + Math.floor(r() * 9);
    var gather = women * perHead;
    var press = 50 + 10 * Math.floor(r() * 6);
    var price = Math.round((3 + r() * r() * 5 + r() * 1.5) * 2) / 2;   /* pence a gallon at the farm, an ordinary cider */

    /* the orchards */
    var n = 3 + Math.floor(r() * 3), vars = shuffle(r, APPLES[P.R].slice()), names = shuffle(r, ORCHARDS.slice());
    var total = press * E * (0.6 + r() * 0.14), w = [], ws = 0, os = [];
    for (i = 0; i < n; i++) { w.push(0.6 + r()); ws += w[i]; }
    for (i = 0; i < n; i++) {
      var v = vars[i], bu = Math.round(total * w[i] / ws / 10) * 10;
      os.push({ name: names[i], v: v, bu: bu, trees: Math.max(12, Math.round(bu / (6 + r() * 6))),
        d0: clamp(Math.round(v.d + gauss(r) * 2 + (kind === 'wet' ? -1 : 0)), 1, E - 8) });
    }
    os.sort(function (a, b) { return a.d0 - b.d0; });

    /* the weather: rain by day; the wind and the frost come in the night after each day */
    var rain = [], T = [], Tn = [], wind = [], prevWet = r() < K.wet, an = gauss(r) * 1.2;
    for (i = 0; i < E; i++) {
      var p = K.wet * 0.55 + (prevWet ? 0.45 : 0) * (K.wet + 0.25);
      var wet = r() < clamp(p, 0.05, 0.9);
      var mm = wet ? Math.max(0.4, -Math.log(Math.max(1e-6, r())) * K.mean) : 0;
      an = an * 0.7 + gauss(r) * 1.3;
      var tc = 14.2 + P.t + K.warm - i * 0.2 + an - (mm > 2 ? 1 : 0);
      var clear = mm === 0 && r() < 0.5 + K.clear;
      rain.push(Math.round(mm * 10) / 10); T.push(tc);
      Tn.push(tc - 6 - (clear ? 4 : 0) + K.cold + gauss(r) * 1.3);
      wind.push(r() < (wet ? 0.28 : 0.14) ? 1 : 0);
      prevWet = wet;
    }
    var gales = Math.floor(K.gale * (0.6 + r() * 1.6));
    for (j = 0; j < gales; j++) {
      var gd = 2 + Math.floor(r() * (E - 4));
      wind[gd] = 2; Tn[gd] = Math.max(Tn[gd], 3 + r() * 3);
      rain[gd] = Math.max(rain[gd], Math.round((2 + r() * 6) * 10) / 10);
      if (gd + 1 < E) rain[gd + 1] = Math.max(rain[gd + 1], Math.round((1 + r() * 6) * 10) / 10);
    }
    var sky = [];
    for (i = 0; i < E; i++) {
      var mm2 = rain[i];
      sky.push(mm2 >= 8 ? 'heavy rain' : mm2 >= 2 ? 'rain' : mm2 > 0 ? 'showers' :
        (i > 0 && Tn[i - 1] <= 0) ? 'white frost, then bright' : T[i] >= 14 ? 'mild and bright' : r() < 0.35 ? 'misty' : 'grey and still');
    }
    /* the glass: what it says each morning about the coming night, mostly right */
    var glass = [];
    for (i = 0; i < E; i++) {
      var g;
      if (wind[i] === 2) g = r() < 0.85 ? 'falling fast' : 'falling';
      else if (Tn[i] <= -2.5) g = r() < 0.8 ? 'high and clear' : 'steady';
      else if (Tn[i] <= 0) g = r() < 0.55 ? 'high and clear' : 'steady';
      else {
        var nx = i + 1 < E ? rain[i + 1] : 0, sc = (nx >= 2 ? 1.2 : nx > 0 ? 0.4 : -0.6) + (wind[i] ? 0.6 : 0) + gauss(r) * 0.55;
        g = sc > 1 ? 'falling' : sc > 0 ? 'unsettled' : r() < 0.15 ? 'high and clear' : 'steady';
      }
      glass.push(g);
    }

    return {
      off: off, P: P, year: year, dates: dates, kind: kind, K: K, women: women, perHead: perHead, gather: gather, press: press,
      price: price, orch: os, rain: rain, T: T, Tn: Tn, wind: wind, sky: sky, glass: glass,
      master: pick(r, MASTERS), old: pick(r, CIDERMEN)
    };
  }

  /* ---------- the fruit ---------- */
  function hazard(t, o) { return 0.015 + 0.22 / (1 + Math.exp(-(t - o.d0) / 2.2)); }
  function sweat(a) {
    if (a < 2) return 0.6;
    if (a < 4) return 0.75;
    if (a < 7) return 0.9;
    if (a <= 18) return 1;
    if (a <= 24) return 0.9;
    if (a <= 30) return 0.8;
    return 0.68;
  }
  function sweatWord(a) {
    if (a < 2) return 'straight off the grass';
    if (a < 4) return 'hard, barely sweated';
    if (a < 7) return 'sweating';
    if (a <= 18) return 'mellow';
    if (a <= 24) return 'over-mellow';
    return 'going rotten';
  }
  function heavy(t) { return day.rain[t] >= 8; }
  function wetDay(t) { return day.rain[t] >= 2; }
  function hard(t) { return day.Tn[t] <= -2.5; }
  function frost(t) { return day.Tn[t] <= 0; }
  function knockable(o, t) { return t >= o.d0 - 5; }

  /* ---------- the season as a model ---------- */
  function newState() {
    return {
      t: 0, done: false, log: [], cur: -1, last: -1,
      o: day.orch.map(function (o) { return { hang: o.bu * 0.94, ground: o.bu * 0.06, got: 0 }; }),
      heaps: [], bu: 0, pbu: 0, gal: 0, val: 0, cost: 0, qsum: 0, rotG: 0, rotH: 0, frosted: 0, lost: 0
    };
  }
  function gatherRate(t) { return heavy(t) ? 0 : wetDay(t) ? day.gather * 0.6 : day.gather; }
  function canGather(s, t, k) { var G = s.o[k]; return !heavy(t) && (G.ground > 0.5 || (knockable(day.orch[k], t) && G.hang > 0.5)); }
  function yard(s) { var a = 0; s.heaps.forEach(function (h) { a += h.bu; }); return a; }
  function oldest(s, t) { return s.heaps.length ? t - s.heaps[0].day : -1; }

  function step(s, a) {
    var t = s.t, ev = { a: a, bu: 0, knock: 0, pr: 0, gal: 0, val: 0, q: 0, why: '', fell: 0, rotG: 0, rotH: 0, fz: 0 };
    if (a >= 0) {
      if (canGather(s, t, a)) {
        var G = s.o[a], c = gatherRate(t), g1 = Math.min(G.ground, c);
        G.ground -= g1; c -= g1;
        var g2 = knockable(day.orch[a], t) ? Math.min(G.hang, c * 0.75) : 0;
        G.hang -= g2;
        var got = g1 + g2;
        s.heaps.push({ bu: got, day: t, k: a });
        G.got += got; s.bu += got; s.cost += day.women * WAGE;
        ev.bu = got; ev.knock = g2; s.cur = a; s.last = a;
      } else ev.why = heavy(t) ? 'too wet to be out in the grass' : 'nothing on the ground there, and the fruit too hard to shake down yet';
    } else if (a === -2) {
      if (s.heaps.length) {
        var room = day.press, qs = 0;
        while (room > 0.5 && s.heaps.length) {
          var h = s.heaps[0], take = Math.min(h.bu, room), q = sweat(t - h.day);
          var gal = take * GAL, v = gal * day.price * day.orch[h.k].v.px * q;
          h.bu -= take; room -= take;
          ev.pr += take; ev.gal += gal; ev.val += v; qs += q * take;
          if (h.bu < 0.5) s.heaps.shift();
        }
        ev.q = qs / ev.pr;
        s.pbu += ev.pr; s.gal += ev.gal; s.val += ev.val; s.qsum += qs; s.cost += PRESS_COST; s.last = -2;
      } else ev.why = 'nothing in the yard to grind';
    }
    if (a < 0 || ev.why) s.cur = -1;

    /* the night: the grass rots what lies in it, the wind and the frost bring more down, the frost bites */
    var rr = 0.025 + (wetDay(t) ? 0.02 : 0) + (day.T[t] >= 13 ? 0.01 : 0);
    var fz = hard(t) ? 0.2 : frost(t) ? 0.06 : 0;
    s.o.forEach(function (G, i) {
      var x = G.ground * rr; G.ground -= x; ev.rotG += x;
      var hz = hazard(t, day.orch[i]) * (day.wind[t] === 2 ? 3 : day.wind[t] === 1 ? 1.6 : 1) * (hard(t) ? 1.5 : 1);
      var f = G.hang * Math.min(0.8, hz); G.hang -= f; G.ground += f; ev.fell += f;
      var y = G.ground * fz; G.ground -= y; ev.fz += y;
    });
    s.heaps.forEach(function (h) {
      var age = t + 1 - h.day, lose = (age > 28 ? 0.06 : age > 20 ? 0.03 : 0) + (hard(t) ? 0.05 : 0);
      var x = h.bu * lose; h.bu -= x; ev.rotH += x;
    });
    s.heaps = s.heaps.filter(function (h) { return h.bu >= 0.5; });
    s.rotG += ev.rotG; s.frosted += ev.fz; s.rotH += ev.rotH;
    s.log.push(ev);
    s.t++;
    if (s.t >= E) {
      s.done = true;
      s.o.forEach(function (G) { s.lost += G.ground + G.hang; });
      s.lost += yard(s);
    }
    return ev;
  }
  function net(s) { return s.val - s.cost; }

  /* other ways of making the same cider */
  function mostDown(s, t) {
    var best = -1, bv = 0;
    s.o.forEach(function (G, i) {
      if (!canGather(s, t, i)) return;
      var v = G.ground + (knockable(day.orch[i], t) ? G.hang * 0.5 : 0);
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }
  var POLICIES = {
    rule: function (s, t) {
      var old = oldest(s, t), tot = yard(s);
      if (heavy(t)) return tot > 0 && old >= 6 ? -2 : -1;
      if (tot > 0 && (old >= 12 || tot >= day.press * 5 || (t >= E - 8 && old >= 4))) return -2;
      var k = mostDown(s, t);
      if (k >= 0) return k;
      return tot > 0 ? -2 : -1;
    },
    turns: function (s, t) {
      var tot = yard(s);
      if (heavy(t)) return tot > 0 ? -2 : -1;
      if (t % 2 && tot > 0) return -2;
      var k = mostDown(s, t);
      return k >= 0 ? k : tot > 0 ? -2 : -1;
    }
  };
  function play(pol) { var s = newState(); while (!s.done) step(s, pol(s, s.t)); return s; }

  /* ---------- page state ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('mill'), cx = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dayOff = 0, day = null, st = null, phase = 'season', hover = -1, tick = 0;
  var X0 = 112, X1 = CW - 12, SY = 258;

  function short(t) { var d = day.dates[t]; return d.getDate() + ' ' + MON[d.getMonth()]; }
  function long(t) { var d = day.dates[t]; return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function treeWord(o, t, G) {
    if (G.hang < 0.5) return 'trees bare';
    if (!knockable(o, t)) return 'hard on the tree';
    var h = hazard(t, o);
    return h > 0.17 ? 'coming down fast' : h > 0.08 ? 'starting to drop' : 'ripe enough to shake';
  }

  /* ---------- drawing ---------- */
  function hash(i) { var h = Math.imul(i ^ 0x9e3779b9, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
  function rgb(c, a) { return a === undefined ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')'; }
  function mix(a, b, m) { return a.map(function (v, i) { return Math.round(v * (1 - m) + b[i] * m); }); }
  var SKY = {
    'heavy rain': ['#2a3140', '#4a5262'], 'rain': ['#34404f', '#5a6574'], 'showers': ['#3d5a78', '#8aa3b8'],
    'white frost, then bright': ['#5b8fc4', '#dfe6ea'], 'mild and bright': ['#4f86b8', '#e3d4b0'],
    'misty': ['#8a929a', '#c4c8c8'], 'grey and still': ['#56616f', '#98a2ad']
  };
  function heapCol(age) {
    if (age < 4) return [150, 172, 72];
    if (age < 7) return [190, 170, 70];
    if (age <= 18) return [208, 146, 58];
    if (age <= 24) return [160, 104, 58];
    return [104, 80, 62];
  }
  function drawScene(t) {
    var tt = Math.min(t, E - 1), skyw = day.sky[tt], sk = SKY[skyw] || SKY['grey and still'], x = cx, i, j, k;
    var g = x.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    x.fillStyle = g; x.fillRect(0, 0, CW, SY);
    if (skyw === 'mild and bright' || skyw === 'white frost, then bright') { x.fillStyle = '#fff2c0'; x.beginPath(); x.arc(64, 44, 15, 0, 7); x.fill(); }
    /* the hills */
    x.fillStyle = '#3f5a3a'; x.beginPath(); x.moveTo(0, 104);
    for (i = 0; i <= 32; i++) x.lineTo(i * CW / 32, 98 + Math.sin(i * 0.5 + day.year) * 9 + Math.sin(i * 0.17 + 1) * 12);
    x.lineTo(CW, SY); x.lineTo(0, SY); x.fill();
    var frosty = t > 0 && t <= E && frost(t - 1);
    x.fillStyle = frosty ? '#8fa596' : '#4d6b3a'; x.fillRect(0, 178, 404, SY - 178);
    x.fillStyle = '#6d6456'; x.fillRect(404, 178, CW - 404, SY - 178);
    /* the orchards */
    var n = day.orch.length, ox0 = 10, ow = (400 - ox0) / n, autumn = clamp(tt / E, 0, 1);
    var leaf = mix([66, 108, 48], [150, 128, 58], autumn);
    var shake = (t < E && day.wind[tt] === 2) ? Math.sin(tick * 0.09) * 3 : 0;
    for (i = 0; i < n; i++) {
      var G = st.o[i], od = day.orch[i], left = ox0 + i * ow, hf = G.hang / od.bu, gf = G.ground / od.bu, col = od.v.c;
      for (k = 0; k < 3; k++) {
        var tx = left + ow * (0.22 + k * 0.28), ty = 150 + (k % 2) * 12, rad = Math.min(24, ow * 0.2);
        x.fillStyle = '#5a4230'; x.fillRect(tx - 2.5, ty, 5, 206 - ty - (k % 2) * 4);
        x.fillStyle = rgb(mix(leaf, [40, 40, 40], 0.15 * k)); x.globalAlpha = 0.35 + 0.65 * Math.max(0.15, 1 - autumn * 0.6);
        x.beginPath(); x.ellipse(tx + shake, ty - rad * 0.6, rad, rad * 0.85, 0, 0, 7); x.fill(); x.globalAlpha = 1;
        var on = Math.round(14 * hf);
        x.fillStyle = rgb(col);
        for (j = 0; j < on; j++) {
          var a = hash(i * 97 + k * 31 + j) * 6.283, rr = Math.sqrt(hash(i * 13 + k * 7 + j * 3 + 5)) * rad * 0.85;
          x.beginPath(); x.arc(tx + shake + Math.cos(a) * rr, ty - rad * 0.6 + Math.sin(a) * rr * 0.8, 2.3, 0, 7); x.fill();
        }
      }
      var down = Math.min(40, Math.round(36 * gf));
      for (j = 0; j < down; j++) {
        var gxp = left + 6 + hash(i * 211 + j) * (ow - 12), gyp = 200 + hash(i * 17 + j * 5 + 3) * 12;
        x.fillStyle = rgb(mix(col, [96, 74, 52], clamp(hash(j + i) * 0.6, 0, 0.6)));
        x.beginPath(); x.arc(gxp, gyp, 2, 0, 7); x.fill();
      }
      x.fillStyle = 'rgba(7,9,13,.65)'; x.fillRect(left + 2, 218, ow - 4, 34);
      x.fillStyle = (st.cur === i && t < E) ? '#f2d36b' : '#e8edf5'; x.font = '600 10px ui-monospace,Menlo,monospace'; x.textAlign = 'center';
      var nm = (i + 1) + ' ' + od.v.name;
      while (x.measureText(nm).width > ow - 8 && nm.length > 4) nm = nm.slice(0, -2) + '…';
      x.fillText(nm, left + ow / 2, 231);
      x.fillStyle = '#8b97ab'; x.fillText(fmt(G.ground) + ' down · ' + fmt(G.hang) + ' up', left + ow / 2, 245);
    }
    /* the women in the grass where they gathered last */
    if (st.cur >= 0 && t > 0) {
      var bx = ox0 + st.cur * ow + ow / 2, figs = Math.min(10, day.women);
      for (i = 0; i < figs; i++) {
        var fx = bx - ow * 0.38 + (i % 5) * ow * 0.19 + hash(i) * 4, fy = 196 + Math.floor(i / 5) * 8, bob = still ? 0 : Math.sin(tick * 0.06 + i) * 1.5;
        x.strokeStyle = '#e9dcc0'; x.lineWidth = 2; x.beginPath(); x.moveTo(fx, fy + 8); x.lineTo(fx + 3, fy + bob); x.stroke(); x.lineWidth = 1;
        x.fillStyle = '#e9dcc0'; x.beginPath(); x.arc(fx + 5, fy - 1 + bob, 2.4, 0, 7); x.fill();
        x.fillStyle = '#8a6a44'; x.fillRect(fx - 6, fy + 5, 5, 4);
      }
    }
    /* the yard: the tumps, oldest on the left */
    var hs = st.heaps, show = hs.slice(0, 5), hx = 412;
    show.forEach(function (h) {
      var age = tt - h.day, wdt = clamp(Math.sqrt(h.bu) * 2.6, 10, 34), ht = wdt * 0.55;
      x.fillStyle = rgb(heapCol(age)); x.beginPath(); x.ellipse(hx + wdt / 2, 212, wdt / 2, ht, 0, Math.PI, 0); x.fill();
      x.fillStyle = 'rgba(0,0,0,.18)';
      for (j = 0; j < 6; j++) { x.beginPath(); x.arc(hx + 4 + hash(h.day * 7 + j) * (wdt - 8), 212 - hash(h.day + j * 3) * ht * 0.8, 1.4, 0, 7); x.fill(); }
      hx += wdt + 3;
    });
    if (hs.length > 5) { x.fillStyle = '#e8edf5'; x.font = '600 9px ui-monospace,Menlo,monospace'; x.textAlign = 'left'; x.fillText('+' + (hs.length - 5), Math.min(hx, 500), 206); }
    /* the press: two posts, the beam, the screw and the cheese of straw and pomace */
    var px0 = 512, pressing = t > 0 && st.log[t - 1] && st.log[t - 1].pr > 0;
    x.fillStyle = '#6a4a30'; x.fillRect(px0, 150, 6, 64); x.fillRect(px0 + 30, 150, 6, 64); x.fillRect(px0 - 3, 146, 42, 8);
    x.fillStyle = '#9a9a9a'; x.fillRect(px0 + 16, 154, 4, 14);
    x.fillStyle = '#7a5838'; x.fillRect(px0 + 4, 166, 28, 5);
    var layers = pressing ? 6 : 2;
    for (j = 0; j < layers; j++) { x.fillStyle = j % 2 ? '#d8c27a' : '#b8864a'; x.fillRect(px0 + 7, 207 - j * 5 - 5, 22, 5); }
    x.fillStyle = '#5a3e28'; x.fillRect(px0 + 2, 207, 32, 7);
    if (pressing && !still) { x.fillStyle = 'rgba(214,170,70,.85)'; x.fillRect(px0 + 17, 214, 2, 3 + (tick % 20) / 4); }
    /* the mill: a round stone trough, the runner stone, and the horse going round */
    var mx = 590, my = 196;
    x.fillStyle = '#8c8a84'; x.beginPath(); x.ellipse(mx, my, 38, 13, 0, 0, 7); x.fill();
    x.fillStyle = '#5e5c58'; x.beginPath(); x.ellipse(mx, my - 2, 30, 9, 0, 0, 7); x.fill();
    x.fillStyle = '#9b988f'; x.beginPath(); x.ellipse(mx, my - 3, 10, 4, 0, 0, 7); x.fill();
    var ang = pressing && !still ? tick * 0.025 : 0.6, sx = mx + Math.cos(ang) * 22, sy = my - 3 + Math.sin(ang) * 6;
    x.strokeStyle = '#6a4a30'; x.lineWidth = 3; x.beginPath(); x.moveTo(mx, my - 8); x.lineTo(mx + Math.cos(ang) * 46, my - 8 + Math.sin(ang) * 15); x.stroke(); x.lineWidth = 1;
    x.fillStyle = '#b8b4aa'; x.beginPath(); x.ellipse(sx, sy - 6, 4, 9, ang, 0, 7); x.fill();
    var hx2 = mx + Math.cos(ang) * 46, hy2 = my - 8 + Math.sin(ang) * 15, face = Math.cos(ang + Math.PI / 2) >= 0 ? 1 : -1;
    x.fillStyle = '#7a4e2e'; x.fillRect(hx2 - 9, hy2 - 8, 18, 9);
    x.fillRect(hx2 - 8, hy2, 2, 8); x.fillRect(hx2 + 6, hy2, 2, 8);
    x.beginPath(); x.moveTo(hx2 + face * 8, hy2 - 8); x.lineTo(hx2 + face * 15, hy2 - 14); x.lineTo(hx2 + face * 15, hy2 - 9); x.lineTo(hx2 + face * 9, hy2 - 3); x.fill();
    /* the yard label */
    x.fillStyle = 'rgba(7,9,13,.65)'; x.fillRect(406, 218, CW - 410, 34);
    x.fillStyle = '#e8edf5'; x.font = '600 10px ui-monospace,Menlo,monospace'; x.textAlign = 'center';
    x.fillText('The yard · ' + fmt(yard(st)) + ' bu in ' + num(hs.length) + (hs.length === 1 ? ' tump' : ' tumps'), (406 + CW - 4) / 2, 231);
    x.fillStyle = '#8b97ab';
    x.fillText(hs.length ? 'oldest ' + num(tt - hs[0].day) + ' days, ' + sweatWord(tt - hs[0].day) : 'nothing heaped', (406 + CW - 4) / 2, 245);
    /* mist and rain */
    if (skyw === 'misty' && t < E) { x.fillStyle = 'rgba(220,224,226,.28)'; x.fillRect(0, 60, CW, 160); }
    if (t < E && day.rain[t] > 0) {
      x.strokeStyle = 'rgba(200,220,240,.35)'; x.beginPath();
      var drops = Math.min(160, 20 + day.rain[t] * 8);
      for (i = 0; i < drops; i++) { var rx = (hash(i) * CW + tick * 3) % CW, ry = (hash(i + 999) * SY + tick * 9) % SY; x.moveTo(rx, ry); x.lineTo(rx - 3, ry + 9); }
      x.stroke();
    }
    x.textAlign = 'left';
  }
  function colX(j) { return X0 + j / E * (X1 - X0); }
  function qCol(q) { return q >= 0.97 ? '#e8c35a' : q >= 0.85 ? '#c9a45a' : '#a8705a'; }
  function drawStrip(t) {
    var x = cx, cw = (X1 - X0) / E, j, i, n = day.orch.length, rh = Math.min(18, 92 / n), y0 = 316, yp = y0 + n * rh + 6;
    x.fillStyle = '#0b0f16'; x.fillRect(0, SY, CW, CH - SY);
    x.font = '600 9px ui-monospace,Menlo,monospace'; x.fillStyle = '#8b97ab'; x.textAlign = 'right';
    x.fillText('RAIN', X0 - 6, 288);
    x.fillText('NIGHT', X0 - 6, 306);
    for (i = 0; i < n; i++) x.fillText((i + 1) + ' ' + day.orch[i].name.toUpperCase(), X0 - 6, y0 + i * rh + rh / 2 + 3);
    x.fillText('PRESS', X0 - 6, yp + 11);
    if (hover >= 0) { x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(colX(hover), 264, cw, yp + 18 - 264); }
    if (t < E) { x.fillStyle = 'rgba(242,211,107,.10)'; x.fillRect(colX(t), 264, cw, yp + 18 - 264); }
    for (j = 0; j < E; j++) {
      var c0 = colX(j) + 1, w = cw - 2;
      if (j <= t && j < E) {
        var h = Math.min(24, day.rain[j] * 2.2);
        x.fillStyle = '#6fa8dc'; x.fillRect(c0, 292 - h, w, h);
      }
      if (j < t) {
        x.textAlign = 'center';
        if (day.wind[j] === 2) { x.fillStyle = '#ff8a5b'; x.font = '600 11px ui-monospace,Menlo,monospace'; x.fillText('≋', c0 + w / 2, 307); }
        else if (frost(j)) { x.fillStyle = hard(j) ? '#e8f4ff' : '#9fc4e0'; x.font = '600 11px ui-monospace,Menlo,monospace'; x.fillText(hard(j) ? '✱' : '·', c0 + w / 2, 307); }
        x.font = '600 9px ui-monospace,Menlo,monospace';
      }
      for (i = 0; i < n; i++) {
        var od = day.orch[i], y = y0 + i * rh, hz = clamp(hazard(j, od) / 0.2, 0, 1);
        x.fillStyle = rgb(od.v.c); x.globalAlpha = (0.08 + 0.6 * hz) * (j <= t ? 1 : 0.5); x.fillRect(c0, y + 2, w, rh - 4); x.globalAlpha = 1;
        if (j < st.log.length && st.log[j].a === i && st.log[j].bu > 0) { x.fillStyle = '#ffffff'; x.fillRect(c0 + 1, y + rh / 2 - 3, w - 2, 6); }
      }
      x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(c0, yp + 2, w, 12);
      if (j < st.log.length && st.log[j].pr > 0) { x.fillStyle = qCol(st.log[j].q); x.fillRect(c0, yp + 2, w, 12); }
    }
    /* when each orchard can first be shaken */
    x.strokeStyle = 'rgba(242,211,107,.55)';
    for (i = 0; i < n; i++) {
      var ks = Math.max(0, day.orch[i].d0 - 5);
      if (ks < E) { x.beginPath(); x.moveTo(colX(ks) + 0.5, y0 + i * rh + 2); x.lineTo(colX(ks) + 0.5, y0 + (i + 1) * rh - 2); x.stroke(); }
    }
    x.textAlign = 'center'; x.fillStyle = '#8b97ab'; x.font = '600 9px ui-monospace,Menlo,monospace';
    for (j = 0; j < E; j += 6) x.fillText(short(j), colX(j) + cw / 2, CH - 6);
    x.textAlign = 'left';
  }
  function draw() { drawScene(st.t); drawStrip(st.t); }
  function loop() { tick++; draw(); requestAnimationFrame(loop); }

  /* ---------- the HUD and the buttons ---------- */
  function buildButtons() {
    var box = $('plots'); box.innerHTML = '';
    day.orch.forEach(function (o, i) {
      var b = document.createElement('button');
      b.className = 'btn plot'; b.type = 'button'; b.id = 'bO' + i;
      b.addEventListener('click', function () { act(i); });
      box.appendChild(b);
    });
  }
  function hud() {
    var t = st.t, tt = Math.min(t, E - 1);
    if (t >= E) {
      $('hWhen').textContent = 'Martinmas: the season is done';
      $('hSky').textContent = '—'; $('hGlass').textContent = '—';
      $('hSkyBox').className = ''; $('hGlassBox').className = '';
    } else {
      $('hWhen').textContent = long(t);
      $('hSky').textContent = cap(day.sky[t]) + ', ' + degF(day.T[t]);
      $('hGlass').textContent = cap(day.glass[t]);
      $('hSkyBox').className = wetDay(t) ? 'alarm' : '';
      $('hGlassBox').className = day.glass[t] === 'falling fast' || day.glass[t] === 'high and clear' ? 'alarm' : '';
    }
    var old = oldest(st, tt);
    $('hYard').textContent = fmt(yard(st)) + ' bu' + (old >= 0 ? ' · ' + old + 'd old' : '');
    var s = 'Gathered <b>' + fmt(st.bu) + '</b> bushels · pressed <b>' + fmt(st.pbu) + '</b> into <b>' + fmt(st.gal) + ' gallons</b>, worth <b>' + money(st.val) + '</b>';
    s += ' · wages ' + money(st.cost);
    if (st.rotG >= 1) s += ' · <i>' + fmt(st.rotG) + ' bu rotted in the grass</i>';
    if (st.frosted >= 1) s += ' · <i>' + fmt(st.frosted) + ' bu frosted</i>';
    if (st.rotH >= 1) s += ' · <i>' + fmt(st.rotH) + ' bu gone bad in the tumps</i>';
    $('plan').innerHTML = s;
    var on = phase === 'season' && t < E;
    day.orch.forEach(function (o, i) {
      var b = $('bO' + i), G = st.o[i];
      b.disabled = !on || !canGather(st, t, i);
      b.className = 'btn plot' + (G.ground > day.gather * 0.5 ? '' : ' ghost');
      b.innerHTML = (i + 1) + ' · Gather in ' + o.name + ' <small>' + o.v.name + ' · ' + fmt(G.ground) + ' bu down · ' + treeWord(o, tt, G) + '</small>';
    });
    var bp = $('bPress');
    bp.disabled = !on || !st.heaps.length;
    bp.className = 'btn plot' + (old >= 7 && old <= 24 ? '' : ' ghost');
    bp.innerHTML = 'P · Grind and press <small>' + (st.heaps.length ? 'the oldest tump is ' + sweatWord(old) + ' · up to ' + fmt(day.press) + ' bu a day' : 'nothing in the yard yet') + '</small>';
    $('bRest').disabled = !on;
  }

  function act(a) {
    if (phase !== 'season' || st.t >= E) return;
    var t = st.t, ev = step(st, a), bits = [];
    if (ev.bu) bits.push('the women gathered <b>' + fmt(ev.bu) + ' bushels</b> in ' + day.orch[ev.a].name + (ev.knock >= 1 ? ' (' + fmt(ev.knock) + ' of them shaken and poled down)' : '') + (wetDay(t) ? ', slowly, in the wet' : '') + ', and tumped them in the yard');
    if (ev.pr) bits.push('the horse went round all day: <b>' + fmt(ev.pr) + ' bushels</b> ground and pressed into ' + fmt(ev.gal) + ' gallons, worth ' + money(ev.val) + ', the fruit ' + Math.round(ev.q * 100) + ' in the hundred of its best');
    if (ev.why) bits.push('could not: ' + ev.why);
    if (!ev.bu && !ev.pr && !ev.why) bits.push(heavy(t) ? 'too wet to be in the grass; nobody worked' : 'nobody worked');
    if (day.wind[t] === 2) bits.push('<span style="color:#ff8a5b">a gale in the night shook down ' + bus(ev.fell) + '</span>');
    else if (ev.fell >= 1) bits.push(bus(ev.fell) + ' came down in the night');
    if (ev.fz >= 1) bits.push('<span style="color:#cfe6ff">' + (hard(t) ? 'a hard frost' : 'a frost') + ' spoiled ' + bus(ev.fz) + ' lying in the grass' + (hard(t) && st.heaps.length ? ' and nipped the tumps' : '') + '</span>');
    $('msg').innerHTML = '<b>' + short(t) + ':</b> ' + bits.join('; ') + '.';
    if (st.done) end();
    hud(); if (still) draw();
  }

  function row(a, b, c, d) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td><td class="n">' + d + '</td></tr>'; }
  function q(s) { return s.pbu ? Math.round(s.qsum / s.pbu * 100) + '%' : '—'; }
  function hogs(s) { return (s.gal / HOG).toFixed(1); }
  function end() {
    phase = 'done';
    var R = play(POLICIES.rule), T = play(POLICIES.turns), me = net(st), best = Math.max(net(R), net(T));
    var v = $('verdict');
    v.className = 'verdict ' + (me >= best - 240 ? 'good' : 'warn');
    v.innerHTML = '<p>Martinmas, and the men are wanted for the threshing. There are <b>' + hogs(st) + ' hogsheads</b> working in the cellar, at about ' + pence(day.price) + ' a gallon for an ordinary cider. After the wages it made <b>' + money(me) + '</b>.</p>' +
      '<p>' + (me >= best + 240 ? 'That is better than ' + day.old + ' would have done, either way.' : me >= best - 240 ? 'That is as good as ' + day.old + ' would have done with the same autumn.' :
        (net(R) >= net(T) ? cap(day.old) + '’s rule' : 'Gathering and pressing by turns') + ' would have made ' + money(best - me) + ' more out of the same orchards and the same weather.') + '</p>';
    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>The same autumn, three ways</h5>' +
      '<table class="card"><tr><td></td><td class="n">Yours</td><td class="n">Sweat a fortnight</td><td class="n">By turns</td></tr>' +
      row('Bushels gathered', fmt(st.bu), fmt(R.bu), fmt(T.bu)) +
      row('Rotted in the grass', fmt(st.rotG), fmt(R.rotG), fmt(T.rotG)) +
      row('Frosted', fmt(st.frosted), fmt(R.frosted), fmt(T.frosted)) +
      row('Gone bad in the tumps', fmt(st.rotH), fmt(R.rotH), fmt(T.rotH)) +
      row('Left at Martinmas', fmt(st.lost), fmt(R.lost), fmt(T.lost)) +
      row('Fruit, against its best', q(st), q(R), q(T)) +
      row('Hogsheads made', hogs(st), hogs(R), hogs(T)) +
      row('Cider', money(st.val), money(R.val), money(T.val)) +
      row('Wages', money(st.cost), money(R.cost), money(T.cost)) +
      '<tr class="tot"><td>Clear</td><td class="n">' + money(me) + '</td><td class="n">' + money(net(R)) + '</td><td class="n">' + money(net(T)) + '</td></tr></table>' +
      '<p><b>Sweat a fortnight</b> is ' + day.old + '’s rule: gather wherever most is lying, and only grind once the oldest tump has had twelve days, or the yard is full, or Martinmas is close; on a wet day, press if anything is fit. <b>By turns</b> gathers one day and presses the next, whatever state the tumps are in. Neither knows the weather any better than you did.</p>';
    $('bAgain').style.display = '';
  }

  function fresh() {
    st = newState(); phase = 'season';
    $('msg').innerHTML = ''; $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = ''; $('bAgain').style.display = 'none';
    hud(); draw();
  }

  function loadDay(off) {
    dayOff = off; day = buildDay(off);
    var P = day.P, trees = 0, bu = 0;
    day.orch.forEach(function (o) { trees += o.trees; bu += o.bu; });
    $('rWho').textContent = 'Cider farm · ' + P.name + ', ' + P.county + ' · ' + num(day.orch.length) + ' orchards · ' + day.year;
    $('rName').textContent = 'Make the cider';
    $('rBlurb').innerHTML = 'It is ' + long(0) + ', ' + day.year + ', and it will be ' + day.K.name + '. You are ' + day.master + ', with <b>' + trees + ' standard trees in ' +
      num(day.orch.length) + ' orchards</b> carrying something like ' + fmt(Math.round(bu / 100) * 100) + ' bushels, <b>' + num(day.women) + ' women</b> from the village to gather at ' + WAGE + 'd a day and their cider, each good for about ' +
      num(day.perHead) + ' bushels a day, and a horse mill and a screw press in the yard that will take <b>' + fmt(day.press) + ' bushels a day</b>. Cider is fetching about <b>' + pence(day.price) + ' a gallon</b> this year, ' +
      'and at Martinmas, on ' + long(E - 1) + ', the men are wanted for the threshing and whatever is not in the cask goes to the pigs.';
    $('rBook').textContent = 'Pick ’em up afore the frost has ’em, and let ’em lie in the tump a fortnight till you can push your thumb in. Grind ’em green and you’ll be drinking vinegar by Lady Day. — ' + cap(day.old);
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      P.name + ', ' + day.year;
    buildButtons();
    fresh();
  }

  /* ---------- wiring ---------- */
  function dayAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    if (y < SY + 4 || x < X0 || x > X1) return -1;
    return clamp(Math.floor((x - X0) / (X1 - X0) * E), 0, E - 1);
  }
  cv.addEventListener('pointermove', function (e) {
    var j = dayAt(e);
    if (j !== hover) { hover = j; if (still) draw(); }
    if (j < 0) { $('cellOut').textContent = '—'; return; }
    var s = long(j);
    if (j <= st.t && j < E) {
      s += ' · ' + day.sky[j] + ', ' + degF(day.T[j]) + (day.rain[j] ? ', ' + day.rain[j] + ' mm' : '') + ' · glass ' + day.glass[j];
      if (j < st.log.length) {
        var ev = st.log[j];
        s += ' · ' + (ev.bu ? fmt(ev.bu) + ' bu gathered in ' + day.orch[ev.a].name : ev.pr ? fmt(ev.pr) + ' bu pressed, ' + fmt(ev.gal) + ' gal' : 'no work');
        s += day.wind[j] === 2 ? ' · gale in the night' : hard(j) ? ' · hard frost in the night' : frost(j) ? ' · frost in the night' : '';
      } else s += ' · today';
    } else s += ' · still to come';
    var peak = day.orch.filter(function (o) { return o.d0 === j; }).map(function (o) { return o.name; });
    if (peak.length) s += ' · coming down hardest: ' + peak.join(', ');
    $('cellOut').textContent = s;
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; if (still) draw(); });
  $('bPress').addEventListener('click', function () { act(-2); });
  $('bRest').addEventListener('click', function () { act(-1); });
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'season') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyP') { if (st.heaps.length) act(-2); e.preventDefault(); return; }
    var m = /^Digit([0-5])$/.exec(e.code);
    if (!m) return;
    var k = +m[1] - 1;
    if (k < 0) act(-1);
    else if (k < day.orch.length && canGather(st, st.t, k)) act(k);
    e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  if (!still) requestAnimationFrame(loop);
})();
