/* drift.quibo.games — The Sheepwash
   Five weeks of June at a sheepwash on a river, some time between 1830 and 1879. The day's number picks the river and
   the breed, the size of the flock, how many hands you have to wash with, the shearing gang and the days it is booked
   to you, the price of wool that year, and the weather of every day: the dry spells, the thunder and the rain that
   puts the river up over the wash-pool.

   Each morning you see the sky and the river and choose: wash a batch in the pool, have the gang shear what is ready,
   do both, or wait. A fleece shorn too soon after the pool is wet and harsh and light; one left too long is dirty again
   and the stapler marks it down; a sheep left unshorn into the hot weather may be struck by the fly. The gang only
   comes on the days it is booked to you, and it will not shear a wet sheep. At the end the page sets your clip beside
   the farmer's rule and a farmer in a hurry, worked on the same flock and the same weather. Self-contained. */
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
    var h = s ^ 0x3c6ef372;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { var u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function degF(c) { return Math.round(c * 9 / 5 + 32) + '°F'; }
  function pence(x) { var w = Math.floor(x), f = Math.round((x - w) * 4); return (w || '') + ['', '¼', '½', '¾'][f] + 'd'; }
  function money(p) {
    var neg = p < 0; p = Math.round(Math.abs(p));
    var L = Math.floor(p / 240), s = Math.floor((p % 240) / 12), d = p % 12;
    return (neg ? '−' : '') + '£' + L + ' ' + s + 's ' + d + 'd';
  }

  /* ---------- the world ---------- */
  /* lb: fleece weight washed; px: pence a pound in an ordinary year; flash: how quickly the river rises; t: warmth */
  var PLACES = [
    { name: 'Ashford-in-the-Water', county: 'Derbyshire', river: 'the Wye', pool: 'the sheepwash by the packhorse bridge', breed: 'Gritstone', lb: 4.5, px: 12, flash: 1.25, t: -0.8, off: 4 },
    { name: 'Bibury', county: 'Gloucestershire', river: 'the Coln', pool: 'a wash-pool dammed below the mill', breed: 'Cotswold', lb: 8.5, px: 15, flash: 0.75, t: 0.2, off: 0 },
    { name: 'Wilton', county: 'Wiltshire', river: 'the Wylye', pool: 'a hatch-pool on the water meadows', breed: 'Hampshire Down', lb: 5, px: 17, flash: 0.7, t: 0.6, off: 0 },
    { name: 'Alfriston', county: 'Sussex', river: 'the Cuckmere', pool: 'a pool penned with hurdles at the ford', breed: 'Southdown', lb: 3.8, px: 19, flash: 0.9, t: 0.8, off: 0 },
    { name: 'Louth', county: 'Lincolnshire', river: 'the Lud', pool: 'a brick wash-dyke off the beck', breed: 'Lincoln Longwool', lb: 11, px: 14, flash: 0.85, t: -0.2, off: 2 },
    { name: 'Exford', county: 'Somerset', river: 'the Exe', pool: 'a pool below the village bridge', breed: 'Exmoor Horn', lb: 5, px: 12, flash: 1.4, t: -0.4, off: 2 },
    { name: 'Hawes', county: 'the North Riding', river: 'the Ure', pool: 'a walled wash-fold on the beck', breed: 'Swaledale', lb: 3.6, px: 9, flash: 1.45, t: -1.6, off: 8 },
    { name: 'Grassington', county: 'the West Riding', river: 'the Wharfe', pool: 'a wash-fold below the bridge', breed: 'Swaledale', lb: 3.6, px: 9, flash: 1.35, t: -1.3, off: 7 },
    { name: 'Keswick', county: 'Cumberland', river: 'the Greta', pool: 'a dub penned off with stones', breed: 'Herdwick', lb: 3.2, px: 7, flash: 1.5, t: -1.8, off: 9 },
    { name: 'Kelso', county: 'Roxburghshire', river: 'the Tweed', pool: 'a stell by a backwater', breed: 'Cheviot', lb: 4, px: 13, flash: 1.0, t: -1.4, off: 9 },
    { name: 'Builth', county: 'Brecknockshire', river: 'the Wye', pool: 'a pool under the alders', breed: 'Welsh Mountain', lb: 2.6, px: 10, flash: 1.3, t: -0.6, off: 5 },
    { name: 'Bampton', county: 'Oxfordshire', river: 'the Shill Brook', pool: 'a sheepwash by the green', breed: 'Oxford Down', lb: 7, px: 15, flash: 0.65, t: 0.4, off: 0 }
  ];
  var MASTERS = ['Thomas', 'William', 'John', 'George', 'Henry', 'James', 'Richard', 'Edward', 'Samuel', 'Robert', 'Charles', 'Joseph'];
  var CAPTAINS = ['Long Dick', 'Old Harry', 'Ned Parsons', 'Jem Cole', 'Bill Hayter', 'Sam Kemp', 'Tom Barnes', 'Kit Mallard', 'Joe Hobbs', 'Will Spragg', 'Dan Fowler', 'Abe Pike'];
  var KINDS = {
    dry: { name: 'a dry, hot June', wet: 0.24, mean: 5, warm: 1.4 },
    broken: { name: 'a broken June, sun and showers', wet: 0.42, mean: 6, warm: 0 },
    wet: { name: 'a wet, cold June', wet: 0.58, mean: 8, warm: -1.3 }
  };
  var E = 35;            /* days in the season */
  var FLOOD = 1.0;       /* river level over which the pool cannot be worked */
  var THICK = 0.62;      /* level over which the water runs thick */
  var READY = 3;         /* days after the pool before a fleece is dry enough to shear at all */

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i;
    var P = pick(r, PLACES), year = 1830 + Math.floor(r() * 50);
    var dates = [];
    for (i = 0; i < E; i++) dates.push(new Date(year, 5, 1 + P.off + i, 12));
    var u = r(), kind = u < 0.3 ? 'dry' : u < 0.72 ? 'broken' : 'wet', K = KINDS[kind];

    var N = 200 + 20 * Math.floor(r() * 26);
    var hands = 4 + Math.floor(r() * 5);
    var washCap = hands * (25 + Math.floor(r() * 3) * 5);
    var men = 4 + Math.floor(r() * 4);
    var gangCap = men * (30 + Math.floor(r() * 3) * 5);
    var price = Math.round(P.px * (0.78 + r() * 0.44) * 4) / 4;
    var payScore = 36 + 6 * Math.floor(r() * 4);          /* pence a score shorn, with the beer */
    var washDay = hands * (14 + Math.floor(r() * 4) * 2);  /* pence a day for the hands in the pool, with the beer */

    /* the weather */
    var rain = [], T = [], L = [], sky = [], prevWet = r() < K.wet, an = gauss(r) * 1.2, lev = 0.3 + r() * 0.35;
    for (i = 0; i < E; i++) {
      var p = K.wet * 0.55 + (prevWet ? 0.45 : 0) * (K.wet + 0.25);
      var wet = r() < clamp(p, 0.05, 0.9);
      var mm = wet ? Math.max(0.4, -Math.log(Math.max(1e-6, r())) * K.mean) : 0;
      if (wet && r() < 0.06) mm += 12 + r() * 18;         /* a thunderstorm or a soaking day */
      an = an * 0.72 + gauss(r) * 1.5;
      var tc = 14.2 + P.t + K.warm + i * 0.07 + an - (mm > 2 ? 1.8 : 0) + (wet ? 0 : 0.8);
      lev = 0.3 + (lev - 0.3) * 0.6 + mm * 0.043 * P.flash;
      rain.push(Math.round(mm * 10) / 10); T.push(tc); L.push(lev);
      sky.push(mm >= 8 ? 'heavy rain' : mm >= 2 ? 'rain' : mm > 0 ? 'showers' : tc >= 20 ? 'hot and bright' : tc >= 15.5 ? 'fair' : 'dull and cool');
      prevWet = wet;
    }

    /* the gang's round: two or three spells of days booked to this farm */
    var gang = [], g;
    for (i = 0; i < E; i++) gang.push(false);
    var spells = 2 + (r() < 0.45 ? 1 : 0), at = 3 + Math.floor(r() * 5);
    for (g = 0; g < spells; g++) {
      var len = 3 + Math.floor(r() * 3);
      for (i = at; i < Math.min(E, at + len); i++) gang[i] = true;
      at += len + 4 + Math.floor(r() * 6);
      if (at >= E - 2) break;
    }
    /* make sure the gang could shear the flock twice over in the days booked */
    var booked = gang.filter(Boolean).length, fill = E - 3;
    while (booked * gangCap < N * 1.8 && fill > 0) { if (!gang[fill]) { gang[fill] = true; booked++; } fill--; }

    return {
      off: off, P: P, year: year, dates: dates, kind: kind, K: K, N: N, hands: hands, washCap: washCap, men: men, gangCap: gangCap,
      price: price, payScore: payScore, washDay: washDay, rain: rain, T: T, L: L, sky: sky, gang: gang,
      master: pick(r, MASTERS), captain: pick(r, CAPTAINS)
    };
  }

  /* ---------- the fleece ---------- */
  function factor(d) {
    if (d < READY) return 0;
    if (d <= 4) return 0.78;
    if (d <= 6) return 0.9;
    if (d <= 14) return 1;
    if (d <= 18) return 0.96;
    if (d <= 24) return 0.9;
    return 0.84;
  }
  function fleeceWord(d) {
    if (d < READY) return 'still wet from the pool';
    if (d <= 4) return 'dry, but the yolk not risen';
    if (d <= 6) return 'nearly risen';
    if (d <= 14) return 'risen, fit to clip';
    if (d <= 18) return 'going off';
    if (d <= 24) return 'dirty again';
    return 'as bad as unwashed';
  }
  var GREASE = 0.66;  /* unwashed wool sold in the grease */
  var STRUCK = 0.4;   /* what a fly-struck fleece is worth against a sound one */

  function isWet(t) { return day.rain[t] >= 2 || (t > 0 && day.rain[t - 1] >= 10); }
  function flood(t) { return day.L[t] > FLOOD; }

  /* ---------- the season as a model ---------- */
  function newState() {
    return { t: 0, U: day.N, Us: 0, groups: [], shorn: 0, struckShorn: 0, wool: 0, pay: 0, washCost: 0, fleeceSum: 0, log: [], late: 0, done: false };
  }
  function ready(s, t) { var n = 0; s.groups.forEach(function (g) { if (t - g.day >= READY) n += g.n; }); return n; }
  function washed(s) { var n = 0; s.groups.forEach(function (g) { n += g.n; }); return n; }
  function canWash(s, t) { return s.U > 0.5 && !flood(t); }
  function canShear(s, t) { return day.gang[t] && !isWet(t) && ready(s, t) > 0.5; }
  function fleeceValue(n, struck, f) { return (n - struck + struck * STRUCK) * day.P.lb * day.price * f; }

  function step(s, act) {
    var t = s.t, ev = { wash: 0, shear: 0, val: 0, fly: 0, f: 0, why: [] };
    if (act.shear) {
      if (canShear(s, t)) {
        var left = day.gangCap;
        s.groups.sort(function (a, b) { return a.day - b.day; });
        for (var k = 0; k < s.groups.length && left > 0.5; k++) {
          var g = s.groups[k], dd = t - g.day;
          if (dd < READY || g.n < 0.5) continue;
          var take = Math.min(left, g.n), st = g.s * take / g.n, f = factor(dd) * g.q;
          var v = fleeceValue(take, st, f);
          g.n -= take; g.s -= st; left -= take;
          ev.shear += take; ev.val += v; ev.f += f * take;
          s.wool += v; s.shorn += take; s.struckShorn += st; s.fleeceSum += f * take;
          s.pay += take / 20 * day.payScore;
        }
        s.groups = s.groups.filter(function (g) { return g.n > 0.5; });
        if (ev.shear) ev.f /= ev.shear;
      } else ev.why.push(!day.gang[t] ? 'the gang is not here' : isWet(t) ? 'the sheep are wet' : 'nothing is ready');
    }
    if (act.wash) {
      if (canWash(s, t)) {
        var n = Math.min(day.washCap, s.U), sn = s.U > 0 ? s.Us * n / s.U : 0;
        s.U -= n; s.Us -= sn;
        s.groups.push({ n: n, s: sn, day: t, q: day.L[t] > THICK ? 0.88 : 1 });
        s.washCost += day.washDay; ev.wash = n;
      } else ev.why.push(flood(t) ? 'the river is over the pool' : 'there are none left to wash');
    }
    /* the fly, from the second week, on warm days, on anything still in its wool */
    if (t >= 7 && day.T[t] >= 16) {
      var rate = 0.0055 * (day.T[t] - 15.5) * ((day.rain[t] > 0 || (t > 0 && day.rain[t - 1] > 0)) ? 1.5 : 1);
      var flyU = (s.U - s.Us) * rate; s.Us += flyU; ev.fly += flyU;
      s.groups.forEach(function (g) { var x = (g.n - g.s) * rate * 0.8; g.s += x; ev.fly += x; });
    }
    s.log.push(ev);
    s.t++;
    if (s.t >= E) finish(s);
    return ev;
  }
  /* what is still in its wool at the end is clipped in July as best it can be */
  function finish(s) {
    var v = 0, n = 0, f = 0;
    /* July: the fly takes another tenth of what is left in its wool before the gang can come back */
    if (s.U > 0.5) {
      s.Us += (s.U - s.Us) * 0.1;
      v += fleeceValue(s.U, s.Us, GREASE * 0.92); n += s.U; f += GREASE * 0.92 * s.U; s.struckShorn += s.Us;
    }
    s.groups.forEach(function (g) {
      g.s += (g.n - g.s) * 0.1;
      var ff = Math.min(factor(E + 5 - g.day), 0.9) * g.q * 0.92;
      v += fleeceValue(g.n, g.s, ff); n += g.n; f += ff * g.n; s.struckShorn += g.s;
    });
    s.late = n; s.lateVal = v;
    s.wool += v; s.fleeceSum += f; s.shorn += n; s.pay += n / 20 * day.payScore * 1.1;
    s.U = 0; s.Us = 0; s.groups = []; s.done = true;
  }
  function net(s) { return s.wool - s.pay - s.washCost; }

  /* other ways of keeping the same June */
  var POLICIES = {
    rule: function (s, t) {
      var soon = false, j;
      for (j = t + 5; j <= Math.min(E - 1, t + 12); j++) if (day.gang[j]) soon = true;
      var queued = washed(s), risen = 0, more = false;
      s.groups.forEach(function (g) { if (t - g.day >= 6) risen += g.n; });
      for (j = t + 1; j < E; j++) if (day.gang[j]) more = true;
      return { wash: canWash(s, t) && (soon || t >= E - 10) && queued < day.gangCap * 3, shear: canShear(s, t) && (risen > 0 || !more) };
    },
    hurry: function (s, t) { return { wash: canWash(s, t), shear: canShear(s, t) }; }
  };
  function play(pol) { var s = newState(); while (!s.done) step(s, pol(s, s.t)); return s; }

  /* ---------- page state ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('wash'), cx = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dayOff = 0, day = null, st = null, phase = 'season', hover = -1, tick = 0;
  var X0 = 40, X1 = CW - 12;

  function short(t) { var d = day.dates[t]; return d.getDate() + ' ' + MON[d.getMonth()]; }
  function long(t) { var d = day.dates[t]; return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function riverWord(t) { var l = day.L[t]; return l > FLOOD ? 'over the pool' : l > THICK ? 'high and thick' : l > 0.45 ? 'running full' : 'low and clear'; }
  function gangWord(t) {
    if (day.gang[t]) return 'here, ' + num(day.men) + ' men';
    for (var j = t + 1; j < E; j++) if (day.gang[j]) return 'comes ' + (j - t === 1 ? 'tomorrow' : 'in ' + num(j - t) + ' days');
    return 'gone on for good';
  }

  /* ---------- drawing ---------- */
  function hash(i) { var h = Math.imul(i ^ 0x9e3779b9, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
  var SKY = {
    'heavy rain': ['#2a3140', '#4a5262'], 'rain': ['#34404f', '#5a6574'], 'showers': ['#3d5a78', '#8aa3b8'],
    'hot and bright': ['#3f86c9', '#cfe6f2'], 'fair': ['#4f86b8', '#bcd6e6'], 'dull and cool': ['#56616f', '#98a2ad']
  };
  function drawScene(t) {
    var tt = Math.min(t, E - 1), sk = SKY[day.sky[tt]] || SKY.fair, x = cx, i;
    var g = x.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    x.fillStyle = g; x.fillRect(0, 0, CW, 250);
    if (day.sky[tt] === 'hot and bright' || day.sky[tt] === 'fair') { x.fillStyle = '#fff2b0'; x.beginPath(); x.arc(560, 46, 18, 0, 7); x.fill(); }
    /* hills */
    x.fillStyle = '#4c6b3c'; x.beginPath(); x.moveTo(0, 120);
    for (i = 0; i <= 32; i++) x.lineTo(i * CW / 32, 112 + Math.sin(i * 0.7 + day.P.flash * 3) * 10 + Math.sin(i * 0.23) * 14);
    x.lineTo(CW, 250); x.lineTo(0, 250); x.fill();
    x.fillStyle = '#5d8046'; x.fillRect(0, 140, CW, 70);
    /* the river */
    var lev = day.L[tt], top = 236 - clamp(lev, 0, 1.5) * 28, muddy = lev > THICK;
    x.fillStyle = muddy ? '#7a6a4c' : '#3b6f8f'; x.fillRect(0, top, CW, 250 - top);
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.beginPath();
    for (i = 0; i < 12; i++) { var wx = (i * 61 + tick * (0.4 + lev)) % (CW + 40) - 20; x.moveTo(wx, top + 6 + (i % 3) * 5); x.lineTo(wx + 14, top + 6 + (i % 3) * 5); }
    x.stroke();
    /* the pool's hurdles */
    x.strokeStyle = '#2e2418'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(250, 214); x.lineTo(250, 250); x.moveTo(390, 214); x.lineTo(390, 250); x.stroke(); x.lineWidth = 1;
    if (lev > FLOOD) { x.fillStyle = 'rgba(122,106,76,.9)'; x.fillRect(240, top - 4, 160, 10); }
    /* pens */
    var pens = [
      { x: 20, w: 200, label: 'Unwashed', n: st.U, s: st.Us, col: '#a89c84' },
      { x: 232, w: 176, label: 'Washed, drying', n: washed(st), s: 0, col: '#ece6d6' },
      { x: 420, w: 200, label: 'Shorn', n: st.shorn - st.late, s: 0, col: '#f3d9cf' }
    ];
    pens.forEach(function (p, k) {
      x.strokeStyle = '#3a2d1d'; x.lineWidth = 2; x.strokeRect(p.x, 150, p.w, 56); x.lineWidth = 1;
      var dots = Math.round(p.n / 5), struckDots = Math.round(p.s / 5), cols = Math.floor((p.w - 8) / 6);
      for (var j = 0; j < Math.min(dots, 160); j++) {
        var cxp = p.x + 6 + (j % cols) * 6 + hash(j * 7 + k) * 2, cyp = 158 + Math.floor(j / cols) * 6 + hash(j * 13 + k) * 2;
        x.fillStyle = j < struckDots ? '#c96a4a' : p.col;
        x.beginPath(); x.arc(cxp, cyp, k === 2 ? 2 : 2.6, 0, 7); x.fill();
      }
      x.fillStyle = 'rgba(7,9,13,.65)'; x.fillRect(p.x, 132, p.w, 16);
      x.fillStyle = '#e8edf5'; x.font = '600 11px ui-monospace,Menlo,monospace'; x.textAlign = 'left';
      x.fillText(p.label + ' ' + Math.round(p.n), p.x + 4, 144);
    });
    /* the gang at the barn end */
    if (t < E && day.gang[t]) {
      for (i = 0; i < day.men; i++) {
        var gx = 432 + i * 22, gy = 112;
        x.fillStyle = '#f2d36b'; x.beginPath(); x.arc(gx, gy, 4, 0, 7); x.fill();
        x.strokeStyle = '#f2d36b'; x.lineWidth = 2; x.beginPath(); x.moveTo(gx, gy + 4); x.lineTo(gx, gy + 16); x.stroke(); x.lineWidth = 1;
      }
      x.fillStyle = '#f2d36b'; x.font = '600 10px ui-monospace,Menlo,monospace'; x.fillText(day.captain + '’s gang', 432, 100);
    }
    /* rain */
    if (t < E && day.rain[t] > 0) {
      x.strokeStyle = 'rgba(200,220,240,.35)'; x.beginPath();
      var drops = Math.min(160, 20 + day.rain[t] * 8);
      for (i = 0; i < drops; i++) { var rx = (hash(i) * CW + tick * 3) % CW, ry = (hash(i + 999) * 250 + tick * 9) % 250; x.moveTo(rx, ry); x.lineTo(rx - 3, ry + 9); }
      x.stroke();
    }
  }
  function colX(j) { return X0 + j / E * (X1 - X0); }
  function drawStrip(t) {
    var x = cx, cw = (X1 - X0) / E, j, maxN = Math.max(day.washCap, day.gangCap);
    x.fillStyle = '#0b0f16'; x.fillRect(0, 250, CW, CH - 250);
    x.font = '600 9px ui-monospace,Menlo,monospace'; x.fillStyle = '#8b97ab'; x.textAlign = 'right';
    x.fillText('GANG', X0 - 4, 276); x.fillText('RAIN', X0 - 4, 300); x.fillText('RIVER', X0 - 4, 318); x.fillText('WASH', X0 - 4, 370); x.fillText('CLIP', X0 - 4, 410);
    if (hover >= 0) { x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(colX(hover), 262, cw, CH - 280); }
    if (t < E) { x.fillStyle = 'rgba(242,211,107,.10)'; x.fillRect(colX(t), 262, cw, CH - 280); }
    for (j = 0; j < E; j++) {
      var cx0 = colX(j) + 1, w = cw - 2;
      if (day.gang[j]) { x.fillStyle = j < t ? 'rgba(242,211,107,.5)' : '#f2d36b'; x.fillRect(cx0, 268, w, 8); }
      if (j <= t && j < E) {
        var rh = Math.min(30, day.rain[j] * 2.2);
        x.fillStyle = '#6fa8dc'; x.fillRect(cx0, 340 - rh, w, rh);
      }
      if (j < st.log.length) {
        var ev = st.log[j];
        if (ev.wash) { var h1 = ev.wash / maxN * 34; x.fillStyle = '#9fd8ff'; x.fillRect(cx0, 380 - h1, w, h1); }
        if (ev.shear) { var h2 = ev.shear / maxN * 34; x.fillStyle = '#f3d9cf'; x.fillRect(cx0, 386, w, h2); }
        if (ev.fly > 0.5) { x.fillStyle = '#ff8a5b'; x.beginPath(); x.arc(cx0 + w / 2, 428, Math.min(4, 1 + ev.fly / 3), 0, 7); x.fill(); }
      }
    }
    /* river line and flood mark */
    var ly = function (l) { return 340 - clamp(l, 0, 1.6) / 1.6 * 40; };
    x.setLineDash([3, 3]); x.strokeStyle = 'rgba(255,138,91,.6)'; x.beginPath(); x.moveTo(X0, ly(FLOOD)); x.lineTo(X1, ly(FLOOD)); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#c9b48a'; x.lineWidth = 1.5; x.beginPath();
    for (j = 0; j <= Math.min(t, E - 1); j++) { var px = colX(j) + cw / 2; if (!j) x.moveTo(px, ly(day.L[j])); else x.lineTo(px, ly(day.L[j])); }
    x.stroke(); x.lineWidth = 1;
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(X0, 383); x.lineTo(X1, 383); x.stroke();
    x.textAlign = 'center'; x.fillStyle = '#8b97ab';
    for (j = 0; j < E; j++) if (j % 7 === 0) x.fillText(short(j), colX(j) + cw / 2, CH - 6);
    x.textAlign = 'left';
  }
  function draw() { drawScene(st.t); drawStrip(st.t); }
  function loop() { tick++; draw(); requestAnimationFrame(loop); }

  /* ---------- the HUD ---------- */
  function hud() {
    var t = st.t;
    if (t >= E) {
      $('hWhen').textContent = 'The clip is in';
      $('hSky').textContent = '—'; $('hRiver').textContent = '—'; $('hGang').textContent = '—';
      $('hSkyBox').className = ''; $('hRiverBox').className = '';
    } else {
      $('hWhen').textContent = long(t);
      $('hSky').textContent = cap(day.sky[t]) + ', ' + degF(day.T[t]);
      $('hRiver').textContent = cap(riverWord(t));
      $('hGang').textContent = cap(gangWord(t));
      $('hSkyBox').className = isWet(t) ? 'alarm' : '';
      $('hRiverBox').className = flood(t) ? 'alarm' : '';
    }
    var r = t < E ? ready(st, t) : 0, oldest = null;
    st.groups.forEach(function (g) { if (oldest === null || g.day < oldest) oldest = g.day; });
    var s = '<b>' + Math.round(st.U) + '</b> unwashed · <b>' + Math.round(washed(st)) + '</b> washed and drying';
    if (oldest !== null && t < E) s += ' (the oldest washed ' + num(t - oldest) + (t - oldest === 1 ? ' day' : ' days') + ' ago, <i>' + fleeceWord(t - oldest) + '</i>)';
    s += ' · <b>' + Math.round(st.shorn) + '</b> shorn · wool so far <b>' + money(st.wool) + '</b>';
    var fly = st.Us + st.struckShorn; st.groups.forEach(function (g) { fly += g.s; });
    if (fly >= 0.5) s += ' · <i>' + Math.round(fly) + ' struck by the fly</i>';
    $('plan').innerHTML = s;
    var on = phase === 'season' && t < E;
    $('bWash').disabled = !on || !canWash(st, t);
    $('bShear').disabled = !on || !canShear(st, t);
    $('bBoth').disabled = !on || !canWash(st, t) || !canShear(st, t);
    $('bWait').disabled = !on;
    $('bShear').textContent = 'Shear' + (on && canShear(st, t) ? ' (' + Math.round(Math.min(r, day.gangCap)) + ' ready)' : '');
  }

  function act(a) {
    if (phase !== 'season' || st.t >= E) return;
    var t = st.t, ev = step(st, a), bits = [];
    if (ev.wash) bits.push('washed <b>' + Math.round(ev.wash) + '</b> in the pool' + (day.L[t] > THICK ? ' (the water thick, they will not come up as white)' : ''));
    if (ev.shear) bits.push('the gang clipped <b>' + Math.round(ev.shear) + '</b>, worth ' + money(ev.val) + ', the fleeces ' + Math.round(ev.f * 100) + ' in the hundred of their best');
    if (ev.why.length) bits.push('could not: ' + ev.why.join(', '));
    if (!bits.length) bits.push('a day left alone');
    if (ev.fly >= 0.5) bits.push('<span style="color:#ff8a5b">the fly struck ' + Math.round(ev.fly) + '</span>');
    $('msg').innerHTML = '<b>' + short(t) + ':</b> ' + bits.join('; ') + '.';
    if (st.done) end();
    hud(); if (still) draw();
  }

  function row(a, b, c, d) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td><td class="n">' + d + '</td></tr>'; }
  function q(s) { return s.shorn ? Math.round(s.fleeceSum / s.shorn * 100) + '%' : '—'; }
  function end() {
    phase = 'done';
    var R = play(POLICIES.rule), H = play(POLICIES.hurry), me = net(st), best = Math.max(net(R), net(H));
    var v = $('verdict');
    v.className = 'verdict ' + (me >= best - 240 ? 'good' : 'warn');
    v.innerHTML = '<p>The clip is in and gone to the stapler at ' + pence(day.price) + ' a pound. After the gang and the hands are paid it made <b>' + money(me) + '</b>.</p>' +
      '<p>' + (me >= best + 240 ? 'That is better than either way the neighbours would have kept it.' : me >= best - 240 ? 'That is as good as the old hands would have done with the same June.' :
        (net(R) >= net(H) ? 'The farmer’s rule' : 'A farmer in a hurry') + ' would have made ' + money(best - me) + ' more out of the same flock and the same weather.') + '</p>';
    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>The same June, three ways</h5>' +
      '<table class="card"><tr><td></td><td class="n">Yours</td><td class="n">Rule</td><td class="n">Hurry</td></tr>' +
      row('Clipped in June', Math.round(st.shorn - st.late), Math.round(R.shorn - R.late), Math.round(H.shorn - H.late)) +
      row('Left to July', Math.round(st.late), Math.round(R.late), Math.round(H.late)) +
      row('Fleeces struck by the fly', Math.round(st.struckShorn), Math.round(R.struckShorn), Math.round(H.struckShorn)) +
      row('Fleece, against its best', q(st), q(R), q(H)) +
      row('Wool sold', money(st.wool), money(R.wool), money(H.wool)) +
      row('The gang and the hands', money(st.pay + st.washCost), money(R.pay + R.washCost), money(H.pay + H.washCost)) +
      '<tr class="tot"><td>Clear</td><td class="n">' + money(me) + '</td><td class="n">' + money(net(R)) + '</td><td class="n">' + money(net(H)) + '</td></tr></table>' +
      '<p><b>The rule</b> washes only when the gang is due in five days to a fortnight, so each batch has risen by the time the shears reach it, and never gets more than three days\' clipping ahead. ' +
      '<b>Hurry</b> washes every day the pool can be worked and shears whenever the gang is here. Neither knows the weather any better than you did.</p>';
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
    var P = day.P;
    $('rWho').textContent = 'Sheepwash · ' + P.name + ', ' + P.county + ', on ' + P.river + ' · ' + P.breed + ' sheep · ' + day.year;
    $('rName').textContent = 'Wash and clip the flock';
    $('rBlurb').innerHTML = 'It is ' + long(0) + ', ' + day.year + ', and it will be ' + day.K.name + '. You are ' + day.master + ', and the flock is <b>' +
      day.N + ' ' + P.breed + ' sheep</b>. The wash is ' + P.pool + '; with ' + num(day.hands) + ' hands in the water you can wash <b>' + day.washCap +
      ' a day</b>. ' + day.captain + '’s gang of ' + num(day.men) + ' shearers can clip <b>' + day.gangCap + ' a day</b> on the days they are booked to you (the gold marks on the strip), at ' +
      Math.floor(day.payScore / 12) + 's' + (day.payScore % 12 ? ' ' + day.payScore % 12 + 'd' : '') + ' a score. Wool is fetching <b>' + pence(day.price) + ' a pound</b> this year, and a good fleece here weighs about ' + P.lb + ' lb.';
    $('rBook').textContent = 'Wash ten days afore the shears, and never clip a wet sheep. Leave them in the wool past midsummer and the fly will have them. — the farmer’s rule';
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      P.name + ', ' + day.year;
    fresh();
  }

  /* ---------- wiring ---------- */
  function dayAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    if (y < 258 || x < X0 || x > X1) return -1;
    return clamp(Math.floor((x - X0) / (X1 - X0) * E), 0, E - 1);
  }
  cv.addEventListener('pointermove', function (e) {
    var j = dayAt(e);
    if (j !== hover) { hover = j; if (still) draw(); }
    if (j < 0) { $('cellOut').textContent = '—'; return; }
    var s = long(j) + (day.gang[j] ? ' · gang booked' : '');
    if (j <= st.t && j < E) {
      s += ' · ' + day.sky[j] + ', ' + degF(day.T[j]) + (day.rain[j] ? ', ' + day.rain[j] + ' mm' : '') + ' · river ' + riverWord(j);
      if (j < st.log.length) {
        var ev = st.log[j];
        s += ' · ' + (ev.wash ? Math.round(ev.wash) + ' washed' : 'none washed') + ', ' + (ev.shear ? Math.round(ev.shear) + ' clipped' : 'none clipped');
        if (ev.fly >= 0.5) s += ', ' + Math.round(ev.fly) + ' struck';
      } else s += ' · today';
    } else s += ' · still to come';
    $('cellOut').textContent = s;
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; if (still) draw(); });
  $('bWait').addEventListener('click', function () { act({}); });
  $('bWash').addEventListener('click', function () { act({ wash: true }); });
  $('bShear').addEventListener('click', function () { act({ shear: true }); });
  $('bBoth').addEventListener('click', function () { act({ wash: true, shear: true }); });
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'season') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = st.t, used = true;
    if (e.code === 'Digit0' || e.code === 'Period') act({});
    else if (e.code === 'KeyW') { if (canWash(st, t)) act({ wash: true }); }
    else if (e.code === 'KeyS') { if (canShear(st, t)) act({ shear: true }); }
    else if (e.code === 'KeyB') { if (canWash(st, t) && canShear(st, t)) act({ wash: true, shear: true }); }
    else used = false;
    if (used) e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  if (!still) requestAnimationFrame(loop);
})();
