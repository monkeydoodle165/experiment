/* drift.quibo.games — The Icehouse
   A winter on a country estate some time between 1780 and 1879. The day's number picks the house, the pond, the
   winter (its cold spells, thaws and snow), the gang and their wages, the size of the ice house, what the household
   will want from it through the summer, and whether the family goes up to town for the Season.

   Ice grows on the pond night by night with the frost (thicker the longer and harder it freezes) and goes again in a
   thaw. Each day you can send the gang out to cut the thickest squares and cart them to the ice house, or wait for
   the ice to thicken. Thin ice and ice cut in a thaw pack loosely: it takes more room and melts faster all summer.
   After the tenth of March the merchant will sell you Norway ice, if it is late enough in the century. Then the year
   runs on to Michaelmas, the house draws on the store, and whatever it lacks is fetched from town at a summer price.
   The page sets your year beside a plan made knowing the whole year's weather. Self-contained. */
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
    var h = s ^ 0x1b873593;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { var u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function money(v) {
    var sh = Math.round(v * 20), l = Math.floor(sh / 20), s = sh % 20;
    return l === 0 ? s + 's' : '£' + l.toLocaleString('en-GB') + (s ? ' ' + s + 's' : '');
  }
  function inch(h) {
    var q = Math.round(h * 4) / 4, w = Math.floor(q), f = q - w;
    var fr = f === 0.25 ? '¼' : f === 0.5 ? '½' : f === 0.75 ? '¾' : '';
    return (w || !fr ? String(w) : '') + fr + ' in';
  }
  function tons(t) { return (t < 9.95 ? (Math.round(t * 10) / 10).toFixed(1) : String(Math.round(t))) + (Math.abs(t - 1) < 0.05 ? ' ton' : ' tons'); }
  function degF(c) { return Math.round(c * 9 / 5 + 32) + '°'; }

  /* ---------- the world ---------- */
  var PLACES = [
    { near: 'Hexham', county: 'Northumberland', off: -1.3, port: 'Newcastle', dist: 1 },
    { near: 'Penrith', county: 'Cumberland', off: -1.0, port: 'Liverpool', dist: 2 },
    { near: 'Ripon', county: 'Yorkshire', off: -0.6, port: 'Hull', dist: 1 },
    { near: 'Bakewell', county: 'Derbyshire', off: -0.9, port: 'Hull', dist: 2 },
    { near: 'Melton Mowbray', county: 'Leicestershire', off: -0.3, port: 'King’s Lynn', dist: 2 },
    { near: 'Bury St Edmunds', county: 'Suffolk', off: -0.2, port: 'King’s Lynn', dist: 1 },
    { near: 'Ludlow', county: 'Shropshire', off: -0.3, port: 'Gloucester', dist: 2 },
    { near: 'Petersfield', county: 'Hampshire', off: 0.4, port: 'Portsmouth', dist: 0 },
    { near: 'Blandford', county: 'Dorset', off: 0.5, port: 'Poole', dist: 0 },
    { near: 'Tavistock', county: 'Devon', off: 1.1, port: 'Plymouth', dist: 0 },
    { near: 'Brecon', county: 'Breconshire', off: -0.5, port: 'Cardiff', dist: 2 },
    { near: 'Perth', county: 'Perthshire', off: -1.6, port: 'Dundee', dist: 1 }
  ];
  var EVENTS = [
    { what: 'a ball for the eldest daughter', tons: 3.0 },
    { what: 'the tenants’ harvest dinner', tons: 2.0 },
    { what: 'a christening dinner', tons: 1.6 },
    { what: 'the races and a house full of guests', tons: 2.6 },
    { what: 'a dinner for the Lord Lieutenant', tons: 1.8 },
    { what: 'a wedding breakfast', tons: 2.4 }
  ];
  var KINDS = {
    hard: { name: 'a hard winter', spells: [3, 4], depth: [5, 9] },
    ordinary: { name: 'an ordinary winter', spells: [2, 3], depth: [3.5, 7] },
    mild: { name: 'a mild winter', spells: [1, 2], depth: [1.5, 4] }
  };
  /* mean daily temperature (°C) in lowland England, mid-month, December to October */
  var NORMAL = [4.6, 3.9, 4.1, 5.8, 8.0, 11.2, 14.3, 16.4, 16.1, 13.6, 10.5];
  var COLS = 16, ROWS = 10;
  var K_ICE = 7;          /* cm² of ice per frost degree-day */
  var MELT = 0.0072;      /* ice-house melt coefficient */
  var MIN_CUT = 2;        /* inches: thinner will not bear a man */
  var NORWAY_FROM = 1822; /* the first Norway ice came into London that year */

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i, j;
    var P = pick(r, PLACES), year = 1780 + Math.floor(r() * 100);
    var t0 = new Date(year - 1, 11, 1, 12);
    function at(k) { return new Date(year - 1, 11, 1 + k, 12); }
    var wEnd = Math.round((new Date(year, 2, 10, 12) - t0) / 864e5);
    var N = Math.round((new Date(year, 8, 30, 12) - t0) / 864e5) + 1;
    var aprilDay = Math.round((new Date(year, 3, 15, 12) - t0) / 864e5);
    var dates = [], wd = [], noWork = [];
    for (i = 0; i < N; i++) {
      var dt = at(i); dates.push(dt); wd.push(dt.getDay());
      noWork.push(dt.getDay() === 0 || (dt.getMonth() === 11 && dt.getDate() === 25));
    }
    var u = r(), kind = u < 0.27 ? 'hard' : u < 0.74 ? 'ordinary' : 'mild', Kd = KINDS[kind];

    /* temperatures: seasonal normal + place + red noise + cold spells in winter, hot spells in summer */
    var temp = new Float32Array(N + 1), e = 0;
    for (i = 0; i <= N; i++) {
      var f = i / 30.44 - 0.5, k = clamp(Math.floor(f), 0, NORMAL.length - 2), fr = clamp(f - k, 0, 1);
      e = 0.72 * e + gauss(r) * 1.55;
      temp[i] = NORMAL[k] + (NORMAL[k + 1] - NORMAL[k]) * fr + P.off + e;
    }
    function spell(s, len, depth) {
      for (var q = s; q < s + len && q <= N; q++) temp[q] += depth * Math.min(1, (q - s + 1) / 2, (s + len - q) / 2);
    }
    var nSp = Kd.spells[0] + Math.floor(r() * (Kd.spells[1] - Kd.spells[0] + 1));
    for (i = 0; i < nSp; i++) spell(Math.floor(r() * (wEnd - 8)), 4 + Math.floor(r() * (kind === 'hard' ? 12 : 8)), -(Kd.depth[0] + r() * (Kd.depth[1] - Kd.depth[0])));
    var nHot = 1 + Math.floor(r() * 3);
    for (i = 0; i < nHot; i++) spell(aprilDay + 50 + Math.floor(r() * 110), 5 + Math.floor(r() * 8), 3.5 + r() * 3.5);

    var sky = [], glass = [];
    for (i = 0; i < N; i++) {
      var T = temp[i], s;
      if (T < -0.3) s = r() < 0.15 ? 'snow' : T < -4 ? 'hard frost' : 'frost';
      else if (T < 2.2) s = r() < 0.35 ? 'fog' : 'raw and grey';
      else s = r() < 0.45 ? 'rain' : 'mild';
      sky.push(s);
      var dl = temp[i + 1] - T + gauss(r) * 1.6;
      glass.push(dl < -1.2 ? 'rising' : dl > 1.2 ? 'falling' : 'steady');
    }

    /* the pond: an oval of squares, a spring or two where the ice is always thin */
    var mask = new Uint8Array(COLS * ROWS), fac = new Float32Array(COLS * ROWS), wob = 0.08 + r() * 0.1;
    for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) {
      var dx = (i + 0.5 - COLS / 2) / (COLS / 2), dy = (j + 0.5 - ROWS / 2) / (ROWS / 2);
      var ang = Math.atan2(dy, dx);
      var rad = 1 + wob * Math.sin(3 * ang + r() * 0.3 + 1.7) - 0.04;
      if (dx * dx + dy * dy <= rad * rad) { mask[j * COLS + i] = 1; fac[j * COLS + i] = 0.9 + r() * 0.2; }
    }
    var springs = 1 + Math.floor(r() * 2), placed = 0, guard = 0;
    while (placed < springs && guard++ < 200) {
      var c = 2 + Math.floor(r() * (COLS - 4)), rw = 2 + Math.floor(r() * (ROWS - 4)), q0 = rw * COLS + c;
      if (!mask[q0]) continue;
      fac[q0] = 0.45;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var q = (rw + o[1]) * COLS + c + o[0]; if (mask[q]) fac[q] = Math.min(fac[q], 0.72); });
      placed++;
    }

    var men = 8 + Math.floor(r() * 7), carts = 2 + Math.floor(r() * 2);
    var wage = men * (1.25 + r() * 0.75) / 20 + carts * 0.3;
    var G = Math.round(men * (0.8 + r() * 0.25));
    var tpi = 0.42 + r() * 0.08;
    var C = 10 * Math.round(4 + r() * 5);

    /* what the household draws, before scaling */
    var away = r() < 0.5, awayFrom = Math.round((new Date(year, 4, 8 + Math.floor(r() * 14), 12) - t0) / 864e5);
    var awayTo = Math.round((new Date(year, 6, 8 + Math.floor(r() * 16), 12) - t0) / 864e5);
    var ev = pick(r, EVENTS), evDay;
    do { evDay = aprilDay + 50 + Math.floor(r() * 150); } while (evDay >= N - 2 || (away && evDay >= awayFrom && evDay <= awayTo));
    var BASE = [0.02, 0.02, 0.025, 0.035, 0.06, 0.11, 0.16, 0.19, 0.19, 0.13];
    var raw = new Float32Array(N), sum = 0;
    for (i = 0; i < N; i++) {
      var mi = clamp(Math.floor(i / 30.44), 0, BASE.length - 1);
      var v = BASE[mi] * (1 + 0.07 * Math.max(0, temp[i] - 14));
      if (away && i >= awayFrom && i <= awayTo) v *= 0.25;
      raw[i] = v; sum += v;
    }
    var hf = C * (0.36 + r() * 0.18) / sum;
    var draw = new Float32Array(N);
    for (i = 0; i < N; i++) draw[i] = raw[i] * hf;
    draw[evDay] += ev.tons * (C / 60);

    var norway = year >= NORWAY_FROM ? 1.05 + 0.3 * P.dist + r() * 0.3 : null;
    var fetch = 3.4 + 0.45 * P.dist + r() * 0.6;

    var day = {
      off: off, P: P, year: year, N: N, wEnd: wEnd, aprilDay: aprilDay, dates: dates, wd: wd, noWork: noWork, kind: kind,
      temp: temp, sky: sky, glass: glass, mask: mask, fac: fac, men: men, carts: carts, wage: wage, G: G, tpi: tpi, C: C,
      away: away, awayFrom: awayFrom, awayTo: awayTo, ev: ev, evDay: evDay, draw: draw, norway: norway, fetch: fetch
    };
    day.plan = bestPlan(day);
    return day;
  }

  /* ---------- the model ---------- */
  function newPond(day) {
    var h = new Float32Array(COLS * ROWS);
    for (var q = 0; q < h.length; q++) h[q] = day.mask[q] ? 0 : -1;
    return h;
  }
  function newStore() { return { T: 0, V: 0, M: 0, melted: 0, short: 0, wages: 0, days: 0, packed: 0, norway: 0, series: [], shortDays: [] }; }
  function voids(h, wet) { return 1 + 0.09 * Math.max(0, 4.5 - h) + (wet ? 0.12 : 0); }
  function meltF(h, wet) { return (1 + 0.14 * Math.max(0, 4.5 - h)) * (wet ? 1.3 : 1); }
  function maxIce(pond) { var m = 0; for (var q = 0; q < pond.length; q++) if (pond[q] > m) m = pond[q]; return m; }
  function meanIce(pond) { var s = 0, n = 0; for (var q = 0; q < pond.length; q++) if (pond[q] >= 0) { s += pond[q]; n++; } return n ? s / n : 0; }
  function canCut(day, pond, st, i, minH) {
    return i <= day.wEnd && !day.noWork[i] && maxIce(pond) >= minH && st.V < day.C - 1;
  }
  /* the gang cuts the thickest squares at least minH thick, up to G of them, until the house is full */
  function cut(day, pond, st, i, minH) {
    var wet = day.temp[i] > 0.3, list = [], q;
    for (q = 0; q < pond.length; q++) if (pond[q] >= minH) list.push(q);
    list.sort(function (a, b) { return pond[b] - pond[a]; });
    var got = 0, n = 0, hs = 0, cutList = [];
    for (var k = 0; k < list.length && n < day.G; k++) {
      q = list[k];
      var h = pond[q], t = h * day.tpi, v = voids(h, wet), room = day.C - st.V;
      if (room < 0.05) break;
      var fr = Math.min(1, room / (t * v));
      t *= fr;
      st.T += t; st.V += t * v; st.M += t * meltF(h, wet);
      got += t; hs += h; n++;
      pond[q] = fr < 1 ? h * (1 - fr) : 0;
      cutList.push(q);
    }
    if (n) { st.wages += day.wage; st.days++; st.packed += got; }
    return { tons: got, n: n, h: n ? hs / n : 0, wet: wet, list: cutList };
  }
  function take(st, x) {
    if (st.T <= 1e-6) { st.T = st.V = st.M = 0; return; }
    var k = Math.max(0, st.T - x) / st.T;
    st.T *= k; st.V *= k; st.M *= k;
  }
  /* the end of day i: the house draws on the store, the store melts, the pond freezes or thaws overnight */
  function endDay(day, pond, st, i, norwayTons) {
    if (norwayTons && i === day.aprilDay) {
      var room = Math.max(0, day.C - st.V), t = Math.min(norwayTons, room);
      st.T += t; st.V += t; st.M += t * 0.85; st.norway += t;
    }
    var need = day.draw[i], got = Math.min(need, st.T);
    take(st, got);
    if (need - got > 1e-4 && i > day.wEnd) { st.short += need - got; st.shortDays.push(i); }
    if (st.T > 1e-6) {
      var loss = Math.min(st.T, MELT * (st.M / st.T) * Math.pow(st.T, 2 / 3) * (0.6 + 0.06 * Math.max(0, day.temp[i])));
      take(st, loss); st.melted += loss;
    }
    st.series[i] = st.T;
    if (pond && i <= day.wEnd + 1) {
      var T = day.temp[i], sn = day.sky[i] === 'snow' ? 0.5 : 1, rain = day.sky[i] === 'rain' ? 1.6 : 1;
      for (var q = 0; q < pond.length; q++) {
        if (pond[q] < 0) continue;
        var hc = pond[q] * 2.54;
        if (T < 0) hc = Math.sqrt(hc * hc + K_ICE * -T * day.fac[q] * sn);
        else hc = Math.max(0, hc - 0.38 * T * rain * (2 - day.fac[q]));
        pond[q] = hc / 2.54;
      }
    }
  }
  function cost(day, st) { return st.wages + st.norway * (day.norway || 0) + st.short * day.fetch; }
  function cloneStore(st) { var s = JSON.parse(JSON.stringify(st)); return s; }
  function runOn(day, st, from, norwayTons) {
    for (var i = from; i < day.N; i++) endDay(day, null, st, i, norwayTons);
    return st;
  }
  /* a plan made knowing the whole year's weather: the best of a family of simple rules */
  function bestPlan(day) {
    var best = null;
    [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 99].forEach(function (X) {
      [false, true].forEach(function (dry) {
        var pond = newPond(day), st = newStore(), cuts = [];
        for (var i = 0; i <= day.wEnd; i++) {
          if (canCut(day, pond, st, i, X) && (!dry || day.temp[i] <= 0.3)) { var c = cut(day, pond, st, i, X); if (c.n) cuts.push(i); }
          endDay(day, pond, st, i, 0);
        }
        var room = Math.max(0, Math.floor(day.C - st.V)), top = day.norway ? room : 0;
        for (var n = 0; n <= top; n += (top > 40 ? 2 : 1)) {
          var s2 = runOn(day, cloneStore(st), day.wEnd + 1, n), c2 = cost(day, s2);
          if (!best || c2 < best.cost - 1e-6) best = { cost: c2, st: s2, X: X, dry: dry, n: n, cuts: cuts.slice() };
          if (n && s2.short < 1e-3) break;
        }
      });
    });
    return best;
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('pond'), g = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var CS = 22, PX = 18, PY = 16;
  var day, dayOff = 0, pond, st, i0, phase, diary, cutMarks, hist, hover = -1, flash = null;

  function dlabel(i) { var d = day.dates[i]; return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function slabel(i) { var d = day.dates[i]; return d.getDate() + ' ' + MON[d.getMonth()]; }
  function say(html) { diary.unshift(html); diary.length = Math.min(diary.length, 5); $('msg').innerHTML = diary.map(function (s, k) { return '<p style="margin:' + (k ? '6px' : '0') + ' 0 0' + (k ? ';opacity:.6' : '') + '">' + s + '</p>'; }).join(''); }
  function skyWords(i) {
    var s = day.sky[i];
    return s === 'snow' ? 'snowing' : s === 'hard frost' ? 'a hard frost' : s === 'frost' ? 'frosty' : s === 'fog' ? 'foggy' : s === 'raw and grey' ? 'raw and grey' : s === 'rain' ? 'raining' : 'mild';
  }

  function fresh() {
    pond = newPond(day); st = newStore(); i0 = 0; phase = 'winter'; diary = []; cutMarks = []; hist = [];
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none'; $('order').style.display = 'none'; $('winterActs').style.display = '';
    say('The pond is open water and the ice house is empty and swept, its drain clear and a load of clean straw ready by the door.');
    morning();
  }
  function morning() {
    hist[i0] = { T: day.temp[i0], h: maxIce(pond) };
    var i = i0;
    $('hWhen').textContent = dlabel(i).replace(/ \d{4}$/, '');
    $('hSky').textContent = degF(day.temp[i]) + ' · ' + skyWords(i);
    $('hSkyBox').className = day.temp[i] > 0.3 ? 'alarm' : '';
    var mx = maxIce(pond);
    $('hIce').textContent = mx < 0.13 ? 'open water' : mx < 1 ? 'a skin' : 'up to ' + inch(mx);
    $('hStore').textContent = tons(st.T) + ' · ' + Math.round(100 * st.V / day.C) + '% full';
    var left = day.wEnd - i;
    var why = day.noWork[i] ? (day.wd[i] === 0 ? 'It is Sunday and the gang will not work.' : 'It is Christmas Day and the gang will not work.') :
      st.V >= day.C - 1 ? 'The ice house is full.' : mx < MIN_CUT ? 'The ice will not bear a man yet: it wants ' + inch(MIN_CUT) + '.' : '';
    $('plan').innerHTML = 'The glass is <b>' + day.glass[i] + '</b>' + (day.glass[i] === 'rising' ? ', which in winter means settled and cold' : day.glass[i] === 'falling' ? ', which in winter means wind and wet' : '') + '. ' +
      (why ? '<i>' + why + '</i> ' : 'The gang can cut <b>up to ' + num(day.G) + ' squares</b> today for ' + money(day.wage) + '. ') +
      (left === 1 ? 'One day' : left > 0 ? (left < NUM.length ? cap(num(left)) : left) + ' days' : 'Today is the last day') + (left > 0 ? ' left until the tenth of March.' : ' of the cutting season.');
    $('bCut').disabled = !canCut(day, pond, st, i, MIN_CUT);
    draw();
  }
  function endOfDay() {
    endDay(day, pond, st, i0, 0);
    i0++;
    if (i0 > day.wEnd) { closeWinter(); return false; }
    return true;
  }
  function doCut() {
    if (phase !== 'winter' || !canCut(day, pond, st, i0, MIN_CUT)) return;
    var c = cut(day, pond, st, i0, MIN_CUT);
    cutMarks.push(i0);
    flash = { list: c.list, t: performance.now() };
    say('<b>' + dlabel(i0) + '.</b> The gang cut ' + num(c.n) + ' squares of ' + inch(c.h) + ' ice and carted <b>' + tons(c.tons) + '</b> up to the ice house, ' +
      (c.wet ? 'wet and rotten from the thaw, so it packs loosely and will not keep.' : c.h < 3.5 ? 'dry but thin, so it breaks small and leaves gaps between the pieces.' : 'thick and dry, rammed down hard between layers of straw.') +
      (st.V >= day.C - 1 ? ' The house is full to the crown.' : ''));
    if (endOfDay()) morning();
  }
  function wait(n) {
    if (phase !== 'winter') return;
    var sign = day.temp[i0] <= 0, k = 0;
    do {
      if (endOfDay() === false) return;
      k++;
      if (n === 'turn' && (day.temp[i0] <= 0) !== sign) break;
    } while (k < (n === 'turn' ? 21 : n));
    morning();
    if (k > 1 || n !== 1) say(dlabel(i0) + '. ' + cap(num(k)) + ' day' + (k > 1 ? 's' : '') + ' gone by; today it is ' + skyWords(i0) + ', ' + degF(day.temp[i0]) + '.');
  }
  function closeWinter() {
    phase = 'order';
    i0 = Math.min(i0, day.wEnd + 1);
    // run any remaining winter days with the doors shut
    for (; i0 <= day.wEnd; i0++) endDay(day, pond, st, i0, 0);
    $('winterActs').style.display = 'none';
    $('bCut').disabled = true;
    var room = Math.max(0, Math.floor(day.C - st.V));
    $('hWhen').textContent = '10 March'; $('hStore').textContent = tons(st.T) + ' · ' + Math.round(100 * st.V / day.C) + '% full';
    if (day.norway && room > 0) {
      $('order').style.display = '';
      var inp = $('nTons'); inp.max = room; inp.value = 0; orderOut();
      $('plan').innerHTML = 'The doors are shut on <b>' + tons(st.T) + '</b>. A letter comes from the ice merchant at ' + day.P.port + ': Norway ice, cut in clear blocks on the lakes above Christiania, ' +
        'delivered by cart in the middle of April at <b>' + money(day.norway) + ' a ton</b>. There is room for ' + num(room) + ' tons.';
    } else {
      $('plan').innerHTML = 'The doors are shut on <b>' + tons(st.T) + '</b>. ' + (day.norway ? 'The house is full; there is no room to buy more.' :
        'In ' + day.year + ' no ice yet comes from Norway, so what is in the house is what there is.') + ' The year runs on to Michaelmas.';
      var dref = day;
      setTimeout(function () { if (day === dref && phase === 'order') finish(); }, 700);
    }
    draw();
  }
  function orderOut() {
    var n = +$('nTons').value;
    $('nOut').textContent = n ? tons(n) + ' · ' + money(n * day.norway) : 'none';
  }

  /* ---------- the summer and the account ---------- */
  function finish() {
    if (phase === 'done') return;
    var n = day.norway && $('order').style.display !== 'none' ? +$('nTons').value : 0;
    phase = 'done';
    $('order').style.display = 'none';
    runOn(day, st, day.wEnd + 1, n);
    var P = day.plan, my = cost(day, st), best = P.cost;
    var lastIce = -1; for (var i = day.N - 1; i >= 0; i--) if (st.series[i] > 0.05) { lastIce = i; break; }
    var firstShort = st.shortDays.length ? st.shortDays[0] : -1;
    var evShort = st.shortDays.indexOf(day.evDay) >= 0;
    var v = $('verdict');
    v.className = 'verdict ' + (my <= best * 1.12 + 0.5 ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + (st.short < 0.05 ? 'The ice lasted to Michaelmas.' : 'The ice house ran dry on ' + slabel(firstShort) + '.') + '</b> ' +
      (st.short < 0.05 ? 'The cook never once sent to town, and there were ' + tons(st.T) + ' left on the thirtieth of September.' :
        'From then on the kitchen sent to town for ice at ' + money(day.fetch) + ' a ton, ' + tons(st.short) + ' of it in all' + (evShort ? ', including the ice for ' + day.ev.what : '') + '.') + '</p>' +
      '<p>Your year cost <b>' + money(my) + '</b>. A plan made knowing the whole year’s weather would have cost <b>' + money(best) + '</b>' + (my < best - 0.02 ? ', and you beat it' : '') + ': ' + planWords(P) + '</p>';
    reveal(my);
    $('bAgain').style.display = '';
    draw();
  }
  function planWords(P) {
    var s = P.cuts.length ? 'send the gang out on ' + num(P.cuts.length) + ' day' + (P.cuts.length > 1 ? 's' : '') + (P.X < 90 ? ', never for ice under ' + inch(P.X) : '') +
      (P.dry ? ' and only in frost' : '') + ', starting on ' + slabel(P.cuts[0]) : 'leave the pond alone';
    s += P.n ? ', then buy ' + tons(P.n) + ' of Norway ice.' : (day.norway ? ', and buy no Norway ice.' : '.');
    return s;
  }
  function reveal(my) {
    var R = $('reveal'), P = day.plan, S = P.st;
    R.style.display = '';
    R.innerHTML = '<h5>The ice house, December to Michaelmas</h5><canvas id="year" width="640" height="250" aria-label="A chart of the tons of ice in the house through the year, yours against the plan made with hindsight."></canvas>' +
      '<div class="key"><span><i style="background:#9fd8ff"></i>your ice house</span><span><i style="background:rgba(232,237,245,.45)"></i>the plan made with hindsight</span>' +
      '<span><i style="background:#ff8a5b"></i>days the kitchen sent to town</span><span><i style="background:#f2d36b"></i>' + day.ev.what + '</span></div>' +
      '<h5>The account</h5><table class="card"><tbody>' +
      row('Days the gang worked', num(st.days), num(S.days)) +
      row('Ice packed from the pond', tons(st.packed), tons(S.packed)) +
      row('Wages and carts', money(st.wages), money(S.wages)) +
      (day.norway ? row('Norway ice', st.norway ? tons(st.norway) + ', ' + money(st.norway * day.norway) : 'none', S.norway ? tons(S.norway) + ', ' + money(S.norway * day.norway) : 'none') : '') +
      row('Lost to melting', tons(st.melted), tons(S.melted)) +
      row('Fetched from town in summer', st.short > 0.05 ? tons(st.short) + ', ' + money(st.short * day.fetch) : 'none', S.short > 0.05 ? tons(S.short) + ', ' + money(S.short * day.fetch) : 'none') +
      '<tr class="tot"><td>The year’s ice cost</td><td class="n">' + money(my) + '</td><td class="n">' + money(P.cost) + '</td></tr>' +
      '</tbody></table>' +
      '<p>Melting is the hidden charge. A pound of thin ice cut in a thaw goes much faster than a pound of thick ice cut in a hard frost, and it took more room going in. ' +
      'The hindsight plan is the cheapest of a family of simple rules (a thickness to wait for, whether to cut in a thaw, how much Norway ice to buy), tried against the weather that actually came.</p>';
    function row(a, b, c) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td></tr>'; }
    R.querySelector('table').insertAdjacentHTML('afterbegin', '<thead><tr><td></td><td class="n" style="color:var(--dim)">yours</td><td class="n" style="color:var(--dim)">plan</td></tr></thead>');
    var c = $('year'), y = c.getContext('2d'), W = c.width, H = c.height, L = 40, Rr = W - 12, Tt = 14, B = H - 28, n = day.N, mx = day.C * 1.02;
    function X(i) { return L + i / (n - 1) * (Rr - L); }
    function Y(v) { return B - v / mx * (B - Tt); }
    y.fillStyle = '#0b0f16'; y.fillRect(0, 0, W, H);
    y.fillStyle = 'rgba(255,255,255,.03)'; y.fillRect(X(0), Tt, X(day.wEnd) - X(0), B - Tt);
    y.strokeStyle = 'rgba(255,255,255,.08)'; y.lineWidth = 1;
    y.fillStyle = '#8b97ab'; y.font = '600 10px ui-monospace,Menlo,monospace'; y.textAlign = 'center';
    for (var i = 0; i < n; i++) if (day.dates[i].getDate() === 1) {
      y.beginPath(); y.moveTo(X(i), Tt); y.lineTo(X(i), B); y.stroke();
      y.fillText(MON[day.dates[i].getMonth()], X(i) + 14, B + 16);
    }
    y.setLineDash([4, 4]); y.beginPath(); y.moveTo(L, Y(day.C)); y.lineTo(Rr, Y(day.C)); y.stroke(); y.setLineDash([]);
    y.textAlign = 'right'; y.fillText(day.C + ' t', L - 6, Y(day.C) + 4); y.fillText('0', L - 6, B);
    if (day.away) { y.fillStyle = 'rgba(122,162,255,.08)'; y.fillRect(X(day.awayFrom), Tt, X(day.awayTo) - X(day.awayFrom), B - Tt); y.fillStyle = '#8b97ab'; y.textAlign = 'center'; y.fillText('in town', (X(day.awayFrom) + X(day.awayTo)) / 2, Tt + 12); }
    function line(s, col, w) { y.strokeStyle = col; y.lineWidth = w; y.beginPath(); for (var i = 0; i < n; i++) { var v = s[i] || 0; if (i) y.lineTo(X(i), Y(v)); else y.moveTo(X(i), Y(v)); } y.stroke(); }
    line(S.series, 'rgba(232,237,245,.45)', 1.5);
    line(st.series, '#9fd8ff', 2);
    y.fillStyle = '#ff8a5b'; st.shortDays.forEach(function (i) { y.fillRect(X(i) - 0.5, B - 5, Math.max(1.5, X(1) - X(0)), 5); });
    y.fillStyle = '#f2d36b'; y.beginPath(); y.arc(X(day.evDay), B - 12, 4, 0, 7); y.fill();
  }

  /* ---------- drawing ---------- */
  function iceCol(h) {
    if (h < 0.13) return '#13283d';
    var k = clamp(h / 6, 0, 1);
    var r = Math.round(60 + 170 * k), gg = Math.round(90 + 145 * k), b = Math.round(120 + 128 * k);
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }
  function draw() {
    if (!day) return;
    var now = performance.now();
    g.fillStyle = '#0d1410'; g.fillRect(0, 0, CW, CH);
    /* frosted or green grass round the pond */
    var T = day.temp[Math.min(i0, day.N - 1)];
    g.fillStyle = T <= 0 ? (day.sky[i0] === 'snow' ? '#c9d2dc' : '#2c3b3a') : '#1d3020';
    g.fillRect(4, 4, COLS * CS + PX * 2 - 8, ROWS * CS + PY * 2 - 8);
    for (var j = 0; j < ROWS; j++) for (var i = 0; i < COLS; i++) {
      var q = j * COLS + i; if (pond[q] < 0) continue;
      var x = PX + i * CS, y = PY + j * CS;
      g.fillStyle = iceCol(pond[q]); g.fillRect(x, y, CS, CS);
      if (pond[q] >= 0.13) { g.strokeStyle = 'rgba(255,255,255,' + (0.05 + 0.1 * clamp(pond[q] / 6, 0, 1)) + ')'; g.strokeRect(x + 0.5, y + 0.5, CS - 1, CS - 1); }
      if (day.fac[q] < 0.5) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + CS / 2, y + CS / 2, 3, 0, 7); g.fill(); }
      if (q === hover) { g.strokeStyle = '#f2d36b'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, CS - 2, CS - 2); g.lineWidth = 1; }
    }
    if (flash && now - flash.t < 1200) {
      var a = 1 - (now - flash.t) / 1200;
      g.fillStyle = 'rgba(159,216,255,' + (0.6 * a) + ')';
      flash.list.forEach(function (q) { g.fillRect(PX + (q % COLS) * CS, PY + Math.floor(q / COLS) * CS, CS, CS); });
      requestAnimationFrame(draw);
    }
    g.fillStyle = '#8b97ab'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'left';
    g.fillText('THE POND', PX, ROWS * CS + PY * 2 + 10);

    /* the ice house in section: an egg of brick under a mound of earth */
    var hx = 420, hy = 20, hw = 200, cx = hx + hw / 2;
    g.fillStyle = '#16120e'; g.fillRect(hx, hy + 40, hw, 200);
    g.fillStyle = '#1f2a1c'; g.beginPath(); g.moveTo(hx, hy + 60); g.quadraticCurveTo(cx, hy - 20, hx + hw, hy + 60); g.lineTo(hx + hw, hy + 64); g.lineTo(hx, hy + 64); g.fill();
    var top = hy + 46, bot = hy + 222, rx = 62;
    function egg() { g.beginPath(); g.moveTo(cx, top); g.bezierCurveTo(cx + rx * 1.35, top, cx + rx * 1.05, bot, cx, bot); g.bezierCurveTo(cx - rx * 1.05, bot, cx - rx * 1.35, top, cx, top); }
    egg(); g.fillStyle = '#0b0f16'; g.fill();
    var frac = clamp(st.V / day.C, 0, 1);
    if (frac > 0.002) {
      g.save(); egg(); g.clip();
      var lvl = bot - 8 - frac * (bot - 8 - top - 6);
      var q2 = st.T > 0 ? st.M / st.T : 1;
      g.fillStyle = q2 < 1.12 ? '#cfe9ff' : q2 < 1.35 ? '#a9c9e2' : '#86a3b8';
      g.fillRect(hx, lvl, hw, bot - lvl);
      g.strokeStyle = 'rgba(194,170,96,.55)'; g.lineWidth = 1;
      for (var yy = bot - 14; yy > lvl; yy -= 9) { g.beginPath(); g.moveTo(hx, yy); g.lineTo(hx + hw, yy); g.stroke(); }
      g.restore();
    }
    egg(); g.strokeStyle = '#8a4b35'; g.lineWidth = 4; g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#3a2a20'; g.fillRect(hx + hw - 40, hy + 64, 40, 18);
    g.fillStyle = '#8b97ab'; g.textAlign = 'center';
    g.fillText('THE ICE HOUSE', cx, bot + 22);
    g.fillStyle = '#e8edf5'; g.font = '600 12px ui-monospace,Menlo,monospace';
    g.fillText(tons(st.T) + ' of ' + day.C, cx, bot + 38);

    /* the winter so far: frost below the line, thaw above, the thickest ice on the pond, the days the gang went out */
    var L = 40, Rr = CW - 12, IB = 350, B = CH - 22, mid = 398, n = day.wEnd + 1;
    function X(i) { return L + (i + 0.5) / n * (Rr - L); }
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(L, mid); g.lineTo(Rr, mid); g.stroke();
    g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillStyle = '#8b97ab'; g.textAlign = 'right';
    g.fillText('32°F', L - 6, mid + 4); g.fillText('10 in', L - 6, IB - 46); g.fillText('0', L - 6, IB + 3);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(L, IB); g.lineTo(Rr, IB); g.stroke();
    g.textAlign = 'center';
    for (i = 0; i < n; i++) if (day.dates[i].getDate() === 1) g.fillText(MON[day.dates[i].getMonth()], X(i) + 12, B + 14);
    var bw = Math.max(1, (Rr - L) / n - 1);
    for (i = 0; i < hist.length && i < n; i++) {
      if (!hist[i]) continue;
      var tc = hist[i].T, hpx = clamp(Math.abs(tc) * 4, 1, 32);
      g.fillStyle = tc <= 0 ? '#7aa2ff' : '#ff8a5b';
      if (tc <= 0) g.fillRect(X(i) - bw / 2, mid, bw, hpx); else g.fillRect(X(i) - bw / 2, mid - hpx, bw, hpx);
    }
    g.strokeStyle = '#e8edf5'; g.lineWidth = 1.5; g.beginPath();
    var started = false;
    for (i = 0; i < hist.length && i < n; i++) { if (!hist[i]) continue; var yv = IB - Math.min(hist[i].h, 10) * 5; if (!started) { g.moveTo(X(i), yv); started = true; } else g.lineTo(X(i), yv); }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#9fd8ff';
    cutMarks.forEach(function (i) { g.beginPath(); g.moveTo(X(i), IB + 3); g.lineTo(X(i) - 4, IB + 10); g.lineTo(X(i) + 4, IB + 10); g.fill(); });
    if (phase === 'winter') { g.strokeStyle = '#f2d36b'; g.beginPath(); g.moveTo(X(i0), IB - 50); g.lineTo(X(i0), B); g.stroke(); }
    g.fillStyle = '#8b97ab'; g.textAlign = 'left';
    g.fillText('THICKEST ICE ON THE POND · ▲ DAYS THE GANG CUT · BARS: FROST BLUE, THAW ORANGE', L, IB - 56);
  }

  /* ---------- the day ---------- */
  function loadDay(off) {
    dayOff = off; day = buildDay(off);
    var P = day.P;
    $('rWho').textContent = 'Ice · a house near ' + P.near + ', ' + P.county + ' · the winter of ' + (day.year - 1) + '–' + String(day.year).slice(2);
    $('rName').textContent = 'Fill the ice house';
    $('rBlurb').innerHTML = 'It is the first of December and the head gardener has the ice house to fill before the spring. The pond below the house freezes over ' +
      'when the frost holds; the gang is <b>' + num(day.men) + ' men and ' + num(day.carts) + ' carts</b>, ' + money(day.wage) + ' a day, and the house holds about <b>' + day.C + ' tons</b> packed tight. ' +
      'The household will want ice until Michaelmas' + (day.away ? ', though the family goes up to town for the Season from ' + slabel(day.awayFrom) + ' to ' + slabel(day.awayTo) : '') +
      ', and on <b>' + slabel(day.evDay) + '</b> there is ' + day.ev.what + '. Whatever runs short is fetched from town at ' + money(day.fetch) + ' a ton.' +
      (day.norway ? ' After the tenth of March the merchant at ' + P.port + ' will sell Norway ice.' : ' In ' + day.year + ' there is no Norway ice to be had.');
    $('rBook').textContent = 'The ice to be got in at the first hard frost and not before, and well rammed with straw; and the door kept shut. — the head gardener’s book';
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      'near ' + P.near + ', ' + (day.year - 1) + '–' + String(day.year).slice(2);
    fresh();
  }

  /* ---------- wiring ---------- */
  function cellAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    var c = Math.floor((x - PX) / CS), r = Math.floor((y - PY) / CS);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && pond[r * COLS + c] >= 0 ? r * COLS + c : -1;
  }
  cv.addEventListener('pointermove', function (e) {
    var k = cellAt(e);
    if (k !== hover) { hover = k; draw(); }
    $('cellOut').textContent = k < 0 ? '—' : (pond[k] < 0.13 ? 'Open water' : pond[k] < 1 ? 'A skin of ice' : inch(pond[k]) + ' of ice') + (day.fac[k] < 0.5 ? ', where a spring comes in' : day.fac[k] < 0.8 ? ', near the spring' : '');
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; draw(); });
  $('bCut').addEventListener('click', doCut);
  $('bWait').addEventListener('click', function () { wait(1); });
  $('bTurn').addEventListener('click', function () { wait('turn'); });
  $('bShut').addEventListener('click', function () { if (phase === 'winter') { say('<b>' + dlabel(i0) + '.</b> The head gardener has the doors shut and the straw banked against them.'); closeWinter(); } });
  $('nTons').addEventListener('input', orderOut);
  $('bOrder').addEventListener('click', finish);
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'winter') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var used = true;
    if (e.code === 'KeyC') doCut();
    else if (e.code === 'Space') wait(1);
    else if (e.code === 'KeyT') wait('turn');
    else used = false;
    if (used) e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
})();
