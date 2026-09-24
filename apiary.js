/* drift.quibo.games — The Apiary
   An observation hive, a stretch of country invented by the day's number, and
   foragers dancing the way to the flowers in it. The sun's path, the rule of the
   waggle dance and its distance code are the real thing; the hive, the fields and
   where the flowers are is not anywhere. Self-contained. No dependencies. */
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
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var RAD = Math.PI / 180;
  function n360(a) { a %= 360; return a < 0 ? a + 360 : a; }
  function n180(a) { a = n360(a); return a > 180 ? a - 360 : a; }
  var COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function point(az) { return COMPASS[Math.round(n360(az) / 22.5) % 16]; }
  function hm(h) {
    h = ((h % 24) + 24) % 24;
    var H = Math.floor(h), M = Math.round((h - H) * 60);
    if (M === 60) { H++; M = 0; }
    return (H < 10 ? '0' : '') + H + ':' + (M < 10 ? '0' : '') + M;
  }
  function dist(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(2) + ' km'; }
  function deg(a) { return Math.round(n360(a)) + '°'; }

  function makeNoise(r) {
    var g = new Float32Array(65536);
    for (var i = 0; i < g.length; i++) g[i] = r();
    function at(x, y) { return g[((y & 255) << 8) + (x & 255)]; }
    function sm(t) { return t * t * (3 - 2 * t); }
    function v(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      var a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
    }
    return function (x, y) { return v(x, y) * 0.55 + v(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + v(x * 4.3 + 3, y * 4.3 + 29) * 0.15; };
  }

  /* ---------- the sun: real spherical astronomy, in local solar time ---------- */
  function dayOfYear(d) {
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 864e5);
  }
  function declination(n) { return 23.44 * Math.sin(2 * Math.PI * (284 + n) / 365); }
  function sunAt(lat, decl, hours) {
    var H = (hours - 12) * 15 * RAD, p = lat * RAD, d = decl * RAD;
    var alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
    var az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(p) - Math.tan(d) * Math.cos(p)) / RAD + 180;
    return { alt: alt / RAD, az: n360(az) };
  }
  function dayLength(lat, decl) {
    var c = clamp(-Math.tan(lat * RAD) * Math.tan(decl * RAD), -1, 1);
    return 2 * Math.acos(c) / RAD / 15;
  }

  /* ---------- what is in flower, month by month ---------- */
  /* q: how rewarding a visit is, 0..1. a..b: the hours (solar) it gives anything worth having. */
  var FLOWERS = [
    { n: 'gorse', c: '#ffd84a', m: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], q: 0.35, a: 10, b: 15, o: 'mostly pollen, a little thin nectar. Somewhere on the common it is in flower in every month of the year.' },
    { n: 'snowdrops', c: '#eef3f5', m: [1, 2, 3], q: 0.45, a: 11, b: 14.5, o: 'pollen and a little nectar, on the first days warm enough to fly.' },
    { n: 'hazel catkins', c: '#d4c566', m: [1, 2, 3], q: 0.4, a: 10, b: 15, o: 'pollen only. Hazel is wind-pollinated and makes no nectar at all; the colony wants the protein for its first brood.' },
    { n: 'winter heather', c: '#d86aa8', m: [11, 12, 1, 2, 3, 4], q: 0.55, a: 10, b: 15, o: 'nectar and pollen, from a bed of it in the churchyard.' },
    { n: 'mahonia', c: '#f3c623', m: [11, 12, 1, 2, 3], q: 0.6, a: 10, b: 15, o: 'nectar and a great deal of pollen, from a hedge of it round the car park.' },
    { n: 'crocuses', c: '#b58cf0', m: [2, 3], q: 0.6, a: 11, b: 15, o: 'bright orange pollen and some nectar. The flowers only open in sunshine.' },
    { n: 'sallow willow', c: '#e6e08a', m: [3, 4], q: 0.85, a: 9, b: 17, o: 'pollen and nectar: the first big flow of the year, and the one that sets the colony building.' },
    { n: 'blackthorn', c: '#f7f1ea', m: [3, 4], q: 0.6, a: 10, b: 16, o: 'nectar and pollen from the hedges, before the leaves are out.' },
    { n: 'dandelions', c: '#ffcf2e', m: [3, 4, 5], q: 0.75, a: 8, b: 13.5, o: 'nectar and deep orange pollen. The heads close in the afternoon, and the foragers stop dancing for them when they do.' },
    { n: 'oilseed rape', c: '#f4e04d', m: [4, 5], q: 0.95, a: 9, b: 17, o: 'heavy nectar, high in glucose; the honey sets hard in the comb within days if it is not taken off.' },
    { n: 'hawthorn', c: '#fbf4ef', m: [5, 6], q: 0.8, a: 10, b: 17, o: 'nectar, generous in some years and nothing at all in others, depending on the nights.' },
    { n: 'horse chestnut', c: '#f7e9d8', m: [5], q: 0.7, a: 9, b: 16, o: 'nectar and brick-red pollen, from an avenue of them along the lane.' },
    { n: 'field beans', c: '#ece8f4', m: [5, 6], q: 0.75, a: 9, b: 17, o: 'nectar, from the flowers and from little glands on the stipules too.' },
    { n: 'white clover', c: '#efeadc', m: [6, 7, 8], q: 0.8, a: 11, b: 18, o: 'nectar, secreted best on warm afternoons after a damp night.' },
    { n: 'bramble', c: '#f2d6e2', m: [6, 7, 8], q: 0.8, a: 8, b: 17, o: 'nectar and pollen from the long hedge, all summer.' },
    { n: 'lime trees', c: '#dfe98a', m: [7], q: 1.0, a: 11, b: 20, o: 'nectar, pouring, in warm humid weather; the trees can be heard humming from the road.' },
    { n: 'phacelia', c: '#8c8ff0', m: [6, 7, 8, 9], q: 0.9, a: 8, b: 17, o: 'nectar, refilled all day. Sown as a green manure, and sown by beekeepers on purpose.' },
    { n: 'borage', c: '#6f8ff5', m: [6, 7, 8, 9], q: 0.85, a: 8, b: 16, o: 'nectar, refilled within minutes of being emptied, so a forager can work the same flowers all morning.' },
    { n: 'rosebay willowherb', c: '#e36bb0', m: [7, 8], q: 0.8, a: 9, b: 18, o: 'nectar and blue-green pollen, from the old railway cutting.' },
    { n: 'lavender', c: '#a88ae0', m: [7, 8], q: 0.6, a: 10, b: 17, o: 'nectar, from a row of it in somebody\'s front garden.' },
    { n: 'ling heather', c: '#b76fb4', m: [8, 9], q: 0.85, a: 10, b: 16, o: 'nectar that sets to a jelly in the comb and has to be pressed out rather than spun.' },
    { n: 'Himalayan balsam', c: '#e98ac0', m: [7, 8, 9, 10], q: 0.8, a: 7, b: 19, o: 'nectar, and pollen that leaves every forager coming home with a white stripe down her back.' },
    { n: 'ivy', c: '#b9c66a', m: [9, 10, 11], q: 0.9, a: 10, b: 16, o: 'nectar, the last big flow of the year, from the ivy smothering an old wall.' },
    { n: 'Michaelmas daisies', c: '#9a8ff0', m: [9, 10], q: 0.6, a: 10, b: 16, o: 'nectar and pollen, from an overgrown border.' },
    { n: 'sunflowers', c: '#ffc21a', m: [8, 9, 10], q: 0.65, a: 9, b: 16, o: 'nectar and pollen, from a field grown for bird seed.' },
    { n: 'white mustard', c: '#f5ee7a', m: [9, 10, 11], q: 0.6, a: 10, b: 15, o: 'nectar, from a cover crop sown after the harvest.' },
    { n: 'strawberry tree', c: '#f1ead6', m: [10, 11, 12], q: 0.55, a: 10, b: 15, o: 'nectar, from an evergreen in the churchyard that flowers and fruits at once.' },
    { n: 'winter honeysuckle', c: '#f5f0dc', m: [12, 1, 2], q: 0.5, a: 11, b: 14.5, o: 'scented nectar, on mild days, from a shrub by a back door.' }
  ];

  var TOWN_A = ['Ash', 'Brom', 'Chal', 'Dray', 'Elm', 'Fern', 'Gold', 'Hax', 'Iver', 'Kings', 'Lang', 'Mickle',
                'Nether', 'Oak', 'Pens', 'Ripp', 'Stan', 'Thorn', 'Ux', 'Wend', 'Yar', 'Hol', 'Bram', 'Clay'];
  var TOWN_B = ['ley', 'ford', 'ham', 'ton', 'bury', 'worth', 'combe', 'stead', 'thorpe', 'well', 'field', 'by',
                'marsh', 'hope', 'den'];
  var ROOMS = ['in the back room of the village museum', 'in the window of a school science block',
               'in a shed at the end of an allotment', 'in the visitor centre of a country park',
               'in the porch of a walled kitchen garden', 'on the landing of a lending library'];
  var RACES = ['Carniolan bees', 'Buckfast bees', 'native dark bees', 'Italian bees',
               'local mongrel bees of no fixed ancestry'];
  var EXT = 3400;   /* metres from the hive to the edge of the map */

  /* ---------- state ---------- */
  var dayOffset = 0, today = null, land = null;
  var clock = 12, playing = false;
  var cur = 0, dance = null, guess = null, res = [], hinted = false;

  function $(id) { return document.getElementById(id); }
  function wire(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

  function buildDay() {
    var d = new Date(); d.setDate(d.getDate() + dayOffset);
    var seed = seedForDate(d) ^ 0xa91a2b3c;
    var r = rng(seed);
    var lat = 38 + r() * 18, n = dayOfYear(d), decl = declination(n), len = dayLength(lat, decl);
    var month = d.getMonth() + 1;
    var pool = shuffle(FLOWERS.filter(function (f) { return f.m.indexOf(month) >= 0; }), r);
    var count = Math.min(6, pool.length), near = r() < 0.45, patches = [];
    for (var i = 0; i < count; i++) {
      var p = null;
      for (var t = 0; t < 80 && !p; t++) {
        var dd = (i === 0 && near) ? 35 + r() * 50 : 240 + Math.pow(r(), 1.25) * 2850;
        var brg = r() * 360;
        var x = Math.sin(brg * RAD) * dd, y = Math.cos(brg * RAD) * dd;
        var ok = patches.every(function (q) { return Math.hypot(q.x - x, q.y - y) > 480; });
        if (ok) p = { f: pool[i], dist: dd, brg: brg, x: x, y: y, rad: dd < 100 ? 22 : 70 + r() * 100 };
      }
      if (p) patches.push(p);
    }
    shuffle(patches, r);
    patches.forEach(function (p, k) { p.id = k; });
    var summer = month >= 5 && month <= 8, shoulder = month === 3 || month === 4 || month === 9 || month === 10;
    var bees = Math.round((summer ? 35000 + r() * 20000 : shoulder ? 18000 + r() * 14000 : 8000 + r() * 7000) / 100) * 100;
    var town = pick(r, TOWN_A) + pick(r, TOWN_B);
    today = {
      date: d, seed: seed, lat: lat, n: n, decl: decl, len: len, rise: 12 - len / 2, set: 12 + len / 2,
      patches: patches, cal: Math.round((750 + r() * 650) / 5) * 5,
      town: town, room: pick(r, ROOMS), race: pick(r, RACES), bees: bees,
      foragers: Math.round(bees * (summer ? 0.22 : shoulder ? 0.16 : 0.08) / 10) * 10,
      winter: month === 12 || month <= 2
    };
    land = buildLand((seed ^ 0x51ed270b) >>> 0);
    var now = new Date();
    clock = clamp(now.getHours() + now.getMinutes() / 60, minClock(), maxClock());
    cur = 0; res = []; guess = null; hinted = false;
    startDance();
  }
  function minClock() { return today.rise + 0.75; }
  function maxClock() { return today.set - 0.75; }
  function sunNow() { return sunAt(today.lat, today.decl, clock); }

  /* ---------- the country round the hive ---------- */
  function buildLand(seed) {
    var r = rng(seed), noise = makeNoise(r), S = 340;
    var cv = document.createElement('canvas'); cv.width = cv.height = S;
    var cx = cv.getContext('2d'), img = cx.createImageData(S, S), D = img.data;
    var FIELD = [[38, 52, 36], [44, 56, 34], [52, 58, 36], [60, 58, 38], [34, 48, 40], [48, 50, 30], [62, 62, 44], [40, 47, 31], [56, 52, 34]];
    var sites = [];
    for (var i = 0; i < 90; i++) sites.push({ x: (r() * 2 - 1) * EXT * 1.1, y: (r() * 2 - 1) * EXT * 1.1, c: FIELD[Math.floor(r() * FIELD.length)], s: r() * Math.PI });
    var rivA = r() * Math.PI, rivOff = (r() * 2 - 1) * 1900, rivAmp = 250 + r() * 450, rivK = 0.0007 + r() * 0.001, rivPh = r() * 6.28;
    var ca = Math.cos(rivA), sa = Math.sin(rivA);
    var vb = r() * 360, vd = 1200 + r() * 1400;
    var vil = { x: Math.sin(vb * RAD) * vd, y: Math.cos(vb * RAD) * vd };
    var woodT = 0.6 + r() * 0.05;
    for (var py = 0; py < S; py++) for (var px = 0; px < S; px++) {
      var x = ((px + 0.5) / S * 2 - 1) * EXT, y = -((py + 0.5) / S * 2 - 1) * EXT;
      var b1 = 1e18, b2 = 1e18, bi = 0;
      for (var k = 0; k < sites.length; k++) {
        var dx = x - sites[k].x, dy = y - sites[k].y, q = dx * dx + dy * dy;
        if (q < b1) { b2 = b1; b1 = q; bi = k; } else if (q < b2) b2 = q;
      }
      var st = sites[bi], c = st.c, R = c[0], G = c[1], B = c[2];
      var fur = Math.sin((x * Math.cos(st.s) + y * Math.sin(st.s)) * 0.06) > 0.5 ? 4 : 0;
      R += fur; G += fur; B += fur;
      if (Math.sqrt(b2) - Math.sqrt(b1) < 24) { R = 24; G = 34; B = 24; }
      var nz = noise(x / 900 + 40, y / 900 + 40);
      if (nz > woodT) { var w = noise(x / 110, y / 110); R = 16 + w * 12; G = 32 + w * 16; B = 20 + w * 8; }
      var u = x * ca + y * sa, v = -x * sa + y * ca;
      var rv = rivOff + rivAmp * Math.sin(u * rivK + rivPh) + 110 * Math.sin(u * rivK * 3.1 + 1.3);
      var dr = Math.abs(v - rv);
      if (dr < 34) { R = 32; G = 64; B = 96; }
      else if (dr < 110 && nz <= woodT) { G += 6; B += 4; }
      if (Math.hypot(x - vil.x, y - vil.y) < 330) { R = 50; G = 48; B = 44; }
      var o = (py * S + px) * 4; D[o] = R; D[o + 1] = G; D[o + 2] = B; D[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    function P(x, y) { return [(x / EXT + 1) / 2 * S, (1 - y / EXT) / 2 * S]; }
    /* lanes: out of the village in three directions, and one past the hive */
    cx.strokeStyle = 'rgba(150,140,112,.55)'; cx.lineWidth = 1.4; cx.lineJoin = 'round';
    var ends = [];
    for (var l = 0; l < 3; l++) ends.push(vb + 180 + (l - 1) * (70 + r() * 40));
    ends.forEach(function (b) {
      cx.beginPath(); var x = vil.x, y = vil.y, h = b; var p0 = P(x, y); cx.moveTo(p0[0], p0[1]);
      for (var s = 0; s < 60; s++) {
        h += (r() - 0.5) * 18; x += Math.sin(h * RAD) * 120; y += Math.cos(h * RAD) * 120;
        var p = P(x, y); cx.lineTo(p[0], p[1]);
        if (Math.abs(x) > EXT * 1.1 || Math.abs(y) > EXT * 1.1) break;
      }
      cx.stroke();
    });
    /* houses */
    for (var hs = 0; hs < 46; hs++) {
      var a = r() * 6.28, rr = Math.sqrt(r()) * 300;
      var hp = P(vil.x + Math.cos(a) * rr, vil.y + Math.sin(a) * rr);
      cx.save(); cx.translate(hp[0], hp[1]); cx.rotate(r() * 3.14);
      cx.fillStyle = r() < 0.5 ? '#8a6c58' : '#6f6a64'; cx.fillRect(-1.6, -1, 3.2, 2); cx.restore();
    }
    return { cv: cv, vil: vil };
  }

  /* ---------- the dance ---------- */
  function trueAngle(p, h) { return n180(p.brg - sunAt(today.lat, today.decl, h).az); }
  function trueDur(p) { return p.dist / today.cal; }
  function reward(p, t) { return p.f.q * clamp(Math.min(t - p.f.a, p.f.b - t) / 1.2 + 0.5, 0, 1); }
  function vigour(p, t) { return clamp(reward(p, t) * (1 - p.dist / 6000), 0.12, 1); }

  function startDance() {
    var p = today.patches[cur];
    dance = { p: p, round: p.dist < 100, k: 0, phase: 'waggle', tau: 0, run: null, notes: [],
              r: rng((today.seed + (cur + 1) * 7919 + Math.floor(clock * 10)) >>> 0), x: 0, y: 0, h: 0 };
    guess = res[cur] ? { x: res[cur].gx, y: res[cur].gy } : null;
    hinted = false;
    newRun();
  }
  function newRun() {
    var p = dance.p, r = dance.r;
    if (dance.round) { dance.run = { T: 1.2 + r() * 0.35, side: dance.k % 2 ? 1 : -1 }; dance.phase = 'circle'; dance.tau = 0; return; }
    /* successive runs of one dance scatter, and scatter worse the nearer the flowers are */
    var sd = clamp(22 - 7 * p.dist / 1000, 6, 22);
    dance.run = {
      ang: trueAngle(p, clock) + gauss(r) * sd * 0.7,
      T: Math.max(0.12, trueDur(p) * (1 + 0.1 * gauss(r))),
      back: 0.9 + 2.6 * (1 - vigour(p, clock)),
      side: dance.k % 2 ? 1 : -1, at: clock
    };
    dance.phase = 'waggle'; dance.tau = 0;
  }

  /* ---------- the comb and everybody on it ---------- */
  var comb = { bg: null, w: 0, h: 0, bees: [], fol: [], speed: 36 };
  function fit(cv) {
    var rc = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(10, Math.round(rc.width * dpr)), h = Math.max(10, Math.round(rc.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: rc.width, h: rc.height, dpr: dpr };
  }
  function buildComb(W, H, dpr) {
    var c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = rng(4242 + Math.round(W));
    x.fillStyle = '#100c07'; x.fillRect(0, 0, W, H);
    var R = 8.5, cw = Math.sqrt(3) * R, rh = 1.5 * R;
    for (var j = -1; j * rh < H + R; j++) for (var i = -1; i * cw < W + cw; i++) {
      var cx = i * cw + (j & 1 ? cw / 2 : 0), cy = j * rh, yf = cy / H;
      var fill = '#17110a', q = r();
      if (yf < 0.18 && q < 0.85) fill = q < 0.7 ? '#4b3a18' : '#5a4519';
      else if (yf < 0.3 && q < 0.55) fill = pick(r, ['#8a6a20', '#9a5a2a', '#6b7a2a', '#a07a26', '#7a4a22']);
      else if (q < 0.1) fill = '#2a2010';
      x.beginPath();
      for (var s = 0; s < 6; s++) { var a = (60 * s - 30) * RAD; x.lineTo(cx + Math.cos(a) * (R - 0.9), cy + Math.sin(a) * (R - 0.9)); }
      x.closePath(); x.fillStyle = fill; x.fill();
      x.strokeStyle = 'rgba(214,168,82,.22)'; x.lineWidth = 1.1; x.stroke();
    }
    var g = x.createLinearGradient(0, H * 0.82, 0, H);
    g.addColorStop(0, 'rgba(16,12,7,0)'); g.addColorStop(1, 'rgba(16,12,7,.85)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    return c;
  }
  function seedBees() {
    var r = rng(99 + Math.round(comb.w)), W = comb.w, H = comb.h;
    comb.bees = [];
    for (var i = 0; i < 34; i++) comb.bees.push({ x: r() * W, y: r() * H, h: r() * 6.28, s: r() < 0.45 ? 0 : 5 + r() * 6 });
    comb.fol = [];
    var slots = [[0.55, 17], [-0.55, 17], [1.2, 15], [-1.2, 15], [0, 20]];
    slots.forEach(function (s) { comb.fol.push({ a: s[0], d: s[1], x: W / 2, y: H / 2, h: 0 }); });
  }
  function centre() { return { x: comb.w * 0.5, y: comb.h * 0.5 }; }

  function stepDance(dt) {
    var d = dance; if (!d || !d.run) return;
    d.tau += dt;
    var C = centre(), run = d.run;
    if (d.round) {
      var R = 15, a = (d.tau / run.T) * 2 * Math.PI * run.side;
      d.x = C.x + R * Math.sin(a); d.y = C.y - R * Math.cos(a);
      d.h = Math.atan2(Math.sin(a) * run.side, Math.cos(a) * run.side);
      if (d.tau >= run.T) { d.k++; newRun(); }
      return;
    }
    var u = { x: Math.sin(run.ang * RAD), y: -Math.cos(run.ang * RAD) }, nr = { x: -u.y, y: u.x };
    var L = comb.speed * run.T;
    if (d.phase === 'waggle') {
      var s = d.tau * comb.speed - L / 2, wag = Math.sin(d.tau * 2 * Math.PI * 13);
      d.x = C.x + u.x * s + nr.x * wag * 1.9; d.y = C.y + u.y * s + nr.y * wag * 1.9;
      d.h = Math.atan2(u.y, u.x) + wag * 0.35;
      if (d.tau >= run.T) {
        d.notes.push({ at: run.at, ang: run.ang, T: run.T });
        if (d.notes.length > 40) d.notes.shift();
        renderNotes();
        d.phase = 'back'; d.tau = 0;
      }
    } else {
      var q = clamp(d.tau / run.back, 0, 1), ph = q * Math.PI, sm = Math.max(L / 2, 16);
      var ex = Math.cos(ph) * L / 2, ey = Math.sin(ph) * sm * run.side;
      d.x = C.x + u.x * ex + nr.x * ey; d.y = C.y + u.y * ex + nr.y * ey;
      var tx = -Math.sin(ph) * L / 2 * u.x + Math.cos(ph) * sm * run.side * nr.x;
      var ty = -Math.sin(ph) * L / 2 * u.y + Math.cos(ph) * sm * run.side * nr.y;
      d.h = Math.atan2(ty, tx);
      if (q >= 1) { d.k++; newRun(); }
    }
  }
  function stepBees(dt) {
    var C = centre(), W = comb.w, H = comb.h, d = dance;
    comb.bees.forEach(function (b) {
      if (!b.s) { b.h += (Math.random() - 0.5) * dt * 1.2; return; }
      b.h += (Math.random() - 0.5) * dt * 5;
      var dx = b.x - C.x, dy = b.y - C.y, r2 = dx * dx + dy * dy;
      if (r2 < 95 * 95) { var want = Math.atan2(dy, dx), diff = Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h)); b.h += diff * dt * 3; }
      b.x += Math.cos(b.h) * b.s * dt; b.y += Math.sin(b.h) * b.s * dt;
      if (b.x < 8 || b.x > W - 8) { b.h = Math.PI - b.h; b.x = clamp(b.x, 8, W - 8); }
      if (b.y < 8 || b.y > H - 8) { b.h = -b.h; b.y = clamp(b.y, 8, H - 8); }
    });
    if (!d) return;
    comb.fol.forEach(function (f) {
      var a = d.h + Math.PI + f.a;
      var tx = d.x + Math.cos(a) * f.d, ty = d.y + Math.sin(a) * f.d;
      var k = Math.min(1, dt * 5);
      f.x += (tx - f.x) * k; f.y += (ty - f.y) * k;
      f.h = Math.atan2(d.y - f.y, d.x - f.x);
    });
  }
  function bee(ctx, x, y, h, dot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(h);
    ctx.fillStyle = 'rgba(214,226,255,.24)';
    ctx.beginPath(); ctx.ellipse(-1.5, -3.6, 4.8, 2.0, -0.35, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-1.5, 3.6, 4.8, 2.0, 0.35, 0, 7); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(-5, 0, 6, 3.6, 0, 0, 7); ctx.fillStyle = '#c8912e'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#2a1c0c'; ctx.fillRect(-8.6, -4, 1.7, 8); ctx.fillRect(-5.6, -4, 1.7, 8); ctx.fillRect(-2.7, -4, 1.4, 8);
    ctx.restore();
    ctx.fillStyle = '#5a3d1a'; ctx.beginPath(); ctx.arc(1.8, 0, 2.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#231708'; ctx.beginPath(); ctx.arc(5.4, 0, 2.1, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(35,23,8,.9)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(6.6, -1); ctx.lineTo(9.6, -3.2); ctx.moveTo(6.6, 1); ctx.lineTo(9.6, 3.2); ctx.stroke();
    if (dot) { ctx.fillStyle = '#64f0c8'; ctx.beginPath(); ctx.arc(1.8, 0, 1.5, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawComb() {
    var cv = $('comb'); if (!cv || !today) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    if (!comb.bg || comb.w !== W || comb.h !== H) {
      comb.w = W; comb.h = H; comb.bg = buildComb(W, H, f.dpr); seedBees();
      comb.speed = clamp(H * 0.08, 26, 40);
    }
    ctx.drawImage(comb.bg, 0, 0, W, H);
    var C = centre();
    if ($('protChk') && $('protChk').checked) {
      ctx.strokeStyle = 'rgba(232,237,245,.16)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(C.x, C.y, 118, 0, 7); ctx.stroke();
      ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var a = -180; a < 180; a += 15) {
        var ux = Math.sin(a * RAD), uy = -Math.cos(a * RAD), big = a % 45 === 0;
        ctx.beginPath(); ctx.moveTo(C.x + ux * (big ? 108 : 113), C.y + uy * (big ? 108 : 113)); ctx.lineTo(C.x + ux * 118, C.y + uy * 118); ctx.stroke();
        if (big) { ctx.fillStyle = 'rgba(232,237,245,.4)'; ctx.fillText(a === -180 ? '180' : (a > 0 ? '+' : '') + a, C.x + ux * 132, C.y + uy * 132); }
      }
      ctx.strokeStyle = 'rgba(255,206,106,.35)'; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(C.x, C.y); ctx.lineTo(C.x, C.y - 118); ctx.stroke(); ctx.setLineDash([]);
    }
    comb.bees.forEach(function (b) { bee(ctx, b.x, b.y, b.h, false); });
    comb.fol.forEach(function (b) { bee(ctx, b.x, b.y, b.h, false); });
    if (dance) {
      if (dance.phase === 'waggle' && !dance.round) {
        ctx.fillStyle = 'rgba(100,240,200,.12)';
        ctx.beginPath(); ctx.arc(dance.x, dance.y, 13, 0, 7); ctx.fill();
      }
      bee(ctx, dance.x, dance.y, dance.h, true);
    }
    ctx.fillStyle = 'rgba(255,206,106,.9)'; ctx.font = '600 11px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('↑ UP = TOWARDS THE SUN', 12, 12);
    ctx.fillStyle = 'rgba(232,237,245,.4)'; ctx.textBaseline = 'bottom';
    ctx.fillText('↓ entrance', 12, H - 10);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    if (dance && dance.round) { ctx.fillStyle = 'rgba(232,237,245,.75)'; ctx.fillText('round dance · circling, no waggle', W - 12, 12); }
    else if (dance && dance.phase === 'waggle') { ctx.fillStyle = '#64f0c8'; ctx.fillText('waggling  ' + dance.tau.toFixed(2) + ' s', W - 12, 12); }
    else if (dance) { ctx.fillStyle = 'rgba(232,237,245,.5)'; ctx.fillText('return  (' + (dance.run.side > 0 ? 'right' : 'left') + ')', W - 12, 12); }
  }

  /* ---------- the map ---------- */
  function drawMap() {
    var cv = $('map'); if (!cv || !today) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(land.cv, 0, 0, W, H);
    function P(x, y) { return [(x / EXT + 1) / 2 * W, (1 - y / EXT) / 2 * H]; }
    var C = P(0, 0), k = W / 2 / EXT;
    ctx.strokeStyle = 'rgba(232,237,245,.18)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.fillStyle = 'rgba(232,237,245,.55)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var rr = 1000; rr < EXT; rr += 1000) {
      ctx.beginPath(); ctx.arc(C[0], C[1], rr * k, 0, 7); ctx.stroke();
      ctx.fillText(rr / 1000 + ' km', C[0] + rr * k * 0.707 + 3, C[1] + rr * k * 0.707);
    }
    ctx.setLineDash([]);
    var vp = P(land.vil.x, land.vil.y);
    ctx.fillStyle = 'rgba(232,237,245,.65)'; ctx.textAlign = 'center';
    ctx.fillText(today.town.toUpperCase(), vp[0], vp[1] - 16 * (land.vil.y > 2800 ? -1 : 1));
    /* the sun's bearing */
    var s = sunNow(), sx = Math.sin(s.az * RAD), sy = -Math.cos(s.az * RAD), L = W * 0.44;
    ctx.strokeStyle = 'rgba(255,206,106,.75)'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(C[0] + sx * L, C[1] + sy * L); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffce6a'; ctx.beginPath(); ctx.arc(C[0] + sx * L, C[1] + sy * L, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1406'; ctx.font = '700 8px ui-monospace,Menlo,monospace'; ctx.fillText('☀', C[0] + sx * L, C[1] + sy * L + 0.5);
    /* flowers found so far */
    today.patches.forEach(function (p, i) {
      if (!res[i]) return;
      var q = P(p.x, p.y), g = P(res[i].gx, res[i].gy);
      ctx.strokeStyle = 'rgba(232,237,245,.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.fillStyle = p.f.c;
      ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(4, p.rad * k), 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = p.f.c; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = res[i].found ? 'rgba(100,240,200,.9)' : 'rgba(255,120,120,.8)';
      ctx.beginPath(); ctx.moveTo(g[0] - 4, g[1] - 4); ctx.lineTo(g[0] + 4, g[1] + 4); ctx.moveTo(g[0] + 4, g[1] - 4); ctx.lineTo(g[0] - 4, g[1] + 4); ctx.stroke();
      ctx.fillStyle = 'rgba(232,237,245,.9)'; ctx.font = '600 10px ui-sans-serif,system-ui,sans-serif';
      ctx.fillText(p.f.n, q[0], q[1] - Math.max(4, p.rad * k) - 8);
    });
    /* the hive */
    ctx.fillStyle = '#ffce6a'; ctx.strokeStyle = '#080b11'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(C[0] - 5, C[1] - 5, 10, 10); ctx.fill(); ctx.stroke();
    /* the scout */
    if (guess && !res[cur]) {
      var gp = P(guess.x, guess.y);
      ctx.strokeStyle = '#64f0c8'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(gp[0], gp[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#64f0c8'; ctx.beginPath(); ctx.arc(gp[0], gp[1], 5.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#080b11'; ctx.lineWidth = 2; ctx.stroke();
    }
    /* north */
    ctx.fillStyle = 'rgba(232,237,245,.8)'; ctx.font = '700 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
    ctx.fillText('N', W - 18, 18); ctx.beginPath(); ctx.moveTo(W - 18, 26); ctx.lineTo(W - 22, 38); ctx.lineTo(W - 14, 38); ctx.closePath(); ctx.fill();
  }
  function mapPoint(e) {
    var rc = $('map').getBoundingClientRect();
    return { x: ((e.clientX - rc.left) / rc.width * 2 - 1) * EXT, y: (1 - (e.clientY - rc.top) / rc.height * 2) * EXT };
  }
  function describe(x, y) {
    var b = n360(Math.atan2(x, y) / RAD), m = Math.hypot(x, y);
    return deg(b) + ' (' + point(b) + ') · ' + dist(m) + ' from the hive';
  }

  /* ---------- the sun, drawn ---------- */
  function drawSky() {
    var cv = $('sky'); if (!cv || !today) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    ctx.fillStyle = '#080b11'; ctx.fillRect(0, 0, W, H);
    var cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) / 2 - 30;
    function P(az, alt) { var rr = R * (90 - alt) / 90; return [cx + Math.sin(az * RAD) * rr, cy - Math.cos(az * RAD) * rr]; }
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    [0, 30, 60].forEach(function (a) { ctx.beginPath(); ctx.arc(cx, cy, R * (90 - a) / 90, 0, 7); ctx.stroke(); });
    ctx.font = '600 10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(139,151,171,.9)';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (c) { var p = P(c[1], -14); ctx.fillText(c[0], p[0], p[1]); });
    ctx.strokeStyle = 'rgba(255,206,106,.55)'; ctx.lineWidth = 2; ctx.beginPath();
    for (var t = today.rise; t <= today.set + 1e-6; t += 0.1) {
      var s = sunAt(today.lat, today.decl, t), p = P(s.az, Math.max(0, s.alt));
      if (t === today.rise) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(232,237,245,.55)'; ctx.font = '600 9px ui-monospace,Menlo,monospace';
    for (var h = Math.ceil(today.rise); h <= today.set; h++) {
      var s2 = sunAt(today.lat, today.decl, h), p2 = P(s2.az, s2.alt);
      ctx.beginPath(); ctx.arc(p2[0], p2[1], 2, 0, 7); ctx.fill();
      if (h % 2 === 0) ctx.fillText(String(h), p2[0], p2[1] - 10);
    }
    var sn = sunNow(), pn = P(sn.az, sn.alt);
    ctx.fillStyle = '#ffce6a'; ctx.beginPath(); ctx.arc(pn[0], pn[1], 7, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,206,106,.35)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(sn.az * RAD) * R, cy - Math.cos(sn.az * RAD) * R); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(139,151,171,.8)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('the sky from below · zenith at the centre', 10, 8);
  }
  function drawAngles() {
    var cv = $('angles'); if (!cv || !today) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    ctx.fillStyle = '#080b11'; ctx.fillRect(0, 0, W, H);
    var l = 46, r = 14, t = 22, b = 30, t0 = today.rise, t1 = today.set;
    function X(h) { return l + (h - t0) / (t1 - t0) * (W - l - r); }
    function Y(a) { return t + (180 - a) / 360 * (H - t - b); }
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
    ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.fillStyle = 'rgba(139,151,171,.85)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    [-180, -90, 0, 90, 180].forEach(function (a) {
      ctx.beginPath(); ctx.moveTo(l, Y(a)); ctx.lineTo(W - r, Y(a)); ctx.stroke();
      ctx.fillText((a > 0 ? '+' : '') + a + '°', l - 6, Y(a));
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var h = Math.ceil(t0); h <= t1; h++) if (h % 2 === 0) ctx.fillText(hm(h), X(h), H - b + 8);
    ctx.textAlign = 'left'; ctx.fillText('waggle angle, right of straight up', l, 6);
    var any = false;
    today.patches.forEach(function (p, i) {
      if (!res[i] || p.dist < 100) return;
      any = true;
      ctx.strokeStyle = p.f.c; ctx.lineWidth = 2; ctx.beginPath();
      var prev = null;
      for (var tt = t0; tt <= t1 + 1e-6; tt += 0.05) {
        var a = trueAngle(p, tt);
        if (prev === null || Math.abs(a - prev) > 180) ctx.moveTo(X(tt), Y(a)); else ctx.lineTo(X(tt), Y(a));
        prev = a;
      }
      ctx.stroke();
      var an = trueAngle(p, clock);
      ctx.fillStyle = p.f.c; ctx.beginPath(); ctx.arc(X(clock), Y(an), 3.5, 0, 7); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(255,206,106,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(clock), t); ctx.lineTo(X(clock), H - b); ctx.stroke();
    if (!any) {
      ctx.fillStyle = 'rgba(139,151,171,.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 12px ui-sans-serif,system-ui,sans-serif';
      ctx.fillText('Find a patch of flowers and its dance appears here, turning with the sun.', W / 2, H / 2 - 30);
    }
  }

  /* ---------- the colony's day ---------- */
  function simulate() {
    var P = today.patches, t0 = today.rise + 0.5, t1 = today.set - 0.5, dt = 1 / 12;
    var E = P.map(function () { return 0; }), U = today.foragers, out = [];
    var cap = P.map(function (p) { return p.dist < 100 ? 40 : Math.min(today.foragers * 0.5, p.rad * p.rad / 30); });
    for (var t = t0; t <= t1 + 1e-9; t += dt) {
      var q = P.map(function (p) { return reward(p, t) * (1 - p.dist / 6000); });
      var dsum = 0; P.forEach(function (p, i) { dsum += E[i] * q[i] * q[i]; });
      var dE = P.map(function (p, i) {
        var room = Math.max(0, 1 - E[i] / cap[i]);
        var rec = U * 2.2 * (E[i] * q[i] * q[i]) / (dsum + 30) * room;
        var sc = U * 0.03 * q[i] * room;
        var ab = E[i] * (0.45 * (1 - q[i]) + 0.04);
        return (rec + sc - ab) * dt;
      });
      var tot = dE.reduce(function (a, v) { return a + v; }, 0);
      if (tot > U) { dE = dE.map(function (v) { return v > 0 ? v * U / tot : v; }); }
      P.forEach(function (p, i) { E[i] = Math.max(0, E[i] + dE[i]); U -= dE[i]; });
      U = Math.max(0, U);
      out.push({ t: t, E: E.slice() });
    }
    return out;
  }
  var GREYS = ['rgba(139,151,171,.42)', 'rgba(139,151,171,.26)'];
  function colourOf(i) { return res[i] ? today.patches[i].f.c : GREYS[i % 2]; }
  function drawColony() {
    var cv = $('colony'); if (!cv || !today) return;
    var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
    ctx.fillStyle = '#080b11'; ctx.fillRect(0, 0, W, H);
    var sim = today.sim || (today.sim = simulate());
    var l = 50, r = 14, t = 16, b = 30, t0 = today.rise, t1 = today.set;
    var max = 1;
    sim.forEach(function (s) { var tot = s.E.reduce(function (a, v) { return a + v; }, 0); if (tot > max) max = tot; });
    max = Math.ceil(max / 50) * 50;
    function X(h) { return l + (h - t0) / (t1 - t0) * (W - l - r); }
    function Y(v) { return H - b - v / max * (H - t - b); }
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
    ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.fillStyle = 'rgba(139,151,171,.85)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) { var v = max * g / 4; ctx.beginPath(); ctx.moveTo(l, Y(v)); ctx.lineTo(W - r, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v), l - 6, Y(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var h = Math.ceil(t0); h <= t1; h++) if (h % 2 === 0) ctx.fillText(hm(h), X(h), H - b + 8);
    var n = today.patches.length;
    for (var i = n - 1; i >= 0; i--) {
      ctx.fillStyle = colourOf(i); ctx.globalAlpha = res[i] ? 0.8 : 1;
      ctx.beginPath();
      sim.forEach(function (s, k) {
        var top = 0; for (var j = 0; j <= i; j++) top += s.E[j];
        if (k === 0) ctx.moveTo(X(s.t), Y(top)); else ctx.lineTo(X(s.t), Y(top));
      });
      for (var k2 = sim.length - 1; k2 >= 0; k2--) {
        var bot = 0; for (var j2 = 0; j2 < i; j2++) bot += sim[k2].E[j2];
        ctx.lineTo(X(sim[k2].t), Y(bot));
      }
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(255,206,106,.7)';
    ctx.beginPath(); ctx.moveTo(X(clock), t); ctx.lineTo(X(clock), H - b); ctx.stroke();

    /* the words under it */
    var idx = clamp(Math.round((clock - (today.rise + 0.5)) * 12), 0, sim.length - 1), E = sim[idx].E;
    var total = E.reduce(function (a, v) { return a + v; }, 0), known = [], unknown = 0;
    today.patches.forEach(function (p, i) { if (res[i]) known.push({ n: p.f.n, v: E[i] }); else unknown += E[i]; });
    known.sort(function (a, c) { return c.v - a.v; });
    var txt = 'At ' + hm(clock) + ' about ' + Math.round(total) + ' of the colony\'s ' + today.foragers.toLocaleString() + ' foragers are out. ';
    if (known.length) txt += known.map(function (k) { return Math.round(k.v) + ' on the ' + k.n; }).join(', ') + (unknown >= 1 ? ', and ' + Math.round(unknown) + ' somewhere you have not found yet.' : '.');
    else txt += 'Where they are going is exactly what the dancers are saying.';
    $('colonyOut').textContent = txt;
    $('legend').innerHTML = today.patches.map(function (p, i) {
      return '<span><i style="background:' + colourOf(i) + '"></i>' + (res[i] ? p.f.n + ' · ' + dist(p.dist) : 'dancer ' + (i + 1) + ' · not yet read') + '</span>';
    }).join('');
  }

  /* ---------- the notebook, the working and the scout ---------- */
  function side(a) { return Math.abs(a) < 0.5 ? 'straight up' : Math.abs(Math.round(a)) + '° ' + (a > 0 ? 'right' : 'left') + ' of up'; }
  function renderNotes() {
    var el = $('notes'); if (!el || !dance) return;
    var on = $('notesChk') && $('notesChk').checked;
    if (dance.round) { el.innerHTML = '<h4>Field notebook</h4>She is circling, first one way and then the other, with no waggle run at all.'; return; }
    if (!on) { el.innerHTML = '<h4>Field notebook</h4>Closed. You are reading this one by eye — the protractor and the waggle clock on the comb are all you have.'; return; }
    var ns = dance.notes;
    if (!ns.length) { el.innerHTML = '<h4>Field notebook</h4>Waiting for the first waggle run…'; return; }
    var rows = ns.slice(-6).map(function (n, i) {
      return 'run ' + (ns.length - Math.min(6, ns.length) + i + 1) + ' · ' + hm(n.at) + ' · <b>' + side(n.ang) + '</b> · <b>' + n.T.toFixed(2) + ' s</b>';
    });
    var m = meanOf(ns);
    el.innerHTML = '<h4>Field notebook</h4>' + rows.join('<br>') +
      (ns.length >= 2 ? '<br><span style="color:var(--accent)">mean of ' + ns.length + ' runs · ' + side(m.ang) + ' · ' + m.T.toFixed(2) + ' s</span>' : '');
  }
  function meanOf(ns) {
    var sx = 0, sy = 0, st = 0, bx = 0, by = 0;
    ns.forEach(function (n) {
      sx += Math.sin(n.ang * RAD); sy += Math.cos(n.ang * RAD); st += n.T;
      var br = sunAt(today.lat, today.decl, n.at).az + n.ang;
      bx += Math.sin(br * RAD); by += Math.cos(br * RAD);
    });
    return { ang: Math.atan2(sx, sy) / RAD, T: st / ns.length, brg: n360(Math.atan2(bx, by) / RAD) };
  }
  function working() {
    var v = $('verdict'); if (!dance || res[cur]) return;
    v.className = 'verdict';
    if (dance.round) { v.innerHTML = '<b>A round dance.</b> She is circling, not waggling, and a round dance carries no bearing and no distance — only “close to home, go and look”. Put your scout down right beside the hive.'; hinted = true; return; }
    var ns = dance.notes;
    if (ns.length < 3) { v.innerHTML = '<b>Not yet.</b> Watch at least three waggle runs; any one of them on its own can be twenty degrees out.'; return; }
    var m = meanOf(ns), s = sunNow();
    hinted = true;
    v.innerHTML = '<b>The working.</b> Over ' + ns.length + ' runs she waggled on average ' + side(m.ang) + ' for ' + m.T.toFixed(2) + ' s. ' +
      'Straight up on the comb stands for the sun, which is at ' + deg(s.az) + ' now, so she means ' + deg(s.az) + ' ' + (m.ang >= 0 ? '+ ' : '− ') + Math.abs(Math.round(m.ang)) + '° = <b>' + deg(m.brg) + ' (' + point(m.brg) + ')</b>. ' +
      'This colony dances about ' + today.cal + ' m to each second of waggling, so ' + m.T.toFixed(2) + ' s is <b>about ' + dist(m.T * today.cal) + '</b>. ' +
      'Put the scout down there. (Using this marks your answer as helped.)';
  }
  function scout() {
    if (!guess || res[cur] || !dance) return;
    var p = today.patches[cur];
    var err = Math.hypot(guess.x - p.x, guess.y - p.y);
    var tol = p.dist < 100 ? 150 : Math.max(170, p.rad + p.dist * 0.12);
    res[cur] = { gx: guess.x, gy: guess.y, err: err, found: err <= tol, close: err <= tol * 2.2, hinted: hinted };
    var v = $('verdict'), rr = res[cur];
    var gb = n360(Math.atan2(guess.x, guess.y) / RAD), gd = Math.hypot(guess.x, guess.y);
    var where = dist(p.dist) + ' out on ' + deg(p.brg) + ' (' + point(p.brg) + ')';
    var diag = '';
    if (p.dist >= 100 && !rr.found) {
      var be = n180(gb - p.brg), de = (gd - p.dist) / p.dist;
      diag = ' Your bearing was ' + Math.abs(Math.round(be)) + '° too far ' + (be > 0 ? 'clockwise' : 'anticlockwise') +
        ' and your distance ' + Math.abs(Math.round(de * 100)) + '% too ' + (de > 0 ? 'long' : 'short') + '.';
    }
    var name = p.f.n.charAt(0).toUpperCase() + p.f.n.slice(1);
    if (rr.found) { v.className = 'verdict good'; v.innerHTML = '<b>Found.</b> The scout came down ' + dist(err) + ' from the middle of the ' + p.f.n + ', ' + where + '. ' + name + ': ' + p.f.o; }
    else if (rr.close) { v.className = 'verdict warn'; v.innerHTML = '<b>Warm.</b> The scout found the ' + p.f.n + ' after a long search — you were ' + dist(err) + ' off. The patch was ' + where + '.' + diag + ' ' + name + ': ' + p.f.o; }
    else { v.className = 'verdict bad'; v.innerHTML = '<b>Nothing there.</b> The scout came home empty. The patch of ' + p.f.n + ' was ' + where + ', ' + dist(err) + ' from where you sent her.' + diag; }
    if (p.dist < 100) v.innerHTML += ' A round dance never says which way; it only says “near”.';
    var done = res.filter(Boolean).length;
    if (done === today.patches.length) {
      var found = res.filter(function (x) { return x.found; }).length, helped = res.filter(function (x) { return x.hinted; }).length;
      var mean = res.reduce(function (a, x) { return a + x.err; }, 0) / res.length;
      v.innerHTML += '<br><br><b>Every dancer read.</b> You found ' + found + ' of ' + res.length + ' patches, missing by ' + dist(mean) + ' on average' +
        (helped ? ', and asked for the working ' + helped + ' time' + (helped > 1 ? 's' : '') + '.' : ', without once asking for the working.') +
        ' Tomorrow the flowers are somewhere else.';
    }
    setStatus(done < today.patches.length ? 'Press “Next dancer” for the next forager coming in.' : 'That is everybody who came home dancing today.');
    today.sim = today.sim || simulate();
    redrawStatic();
  }

  /* ---------- page ---------- */
  function setStatus(t) { var s = $('status'); if (s) s.textContent = t; }
  function renderPlaque() {
    var t = today;
    $('hiveWho').textContent = 'observation hive · ' + t.lat.toFixed(1) + '° N · ' + t.bees.toLocaleString() + ' bees';
    $('hiveName').textContent = 'The ' + t.town + ' hive';
    $('hiveBlurb').textContent = 'One frame of comb between two sheets of glass, ' + t.room + ', with a tube through the wall to the outside. ' +
      'A colony of ' + t.race + ', and a keeper who dabs a spot of paint on the thorax of each forager worth watching.' +
      (t.winter ? ' It is winter, so most of the colony is clustered for warmth; only a few foragers go out, and only on a mild afternoon.' : '');
    $('hiveMeta').textContent = t.patches.length + ' foragers are coming home today with something to say. Each one dances for a different patch of flowers.';
    $('dayOut').textContent = t.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + (dayOffset === 0 ? ' · today' : '');
  }
  function renderFacts() {
    var t = today, s = sunNow();
    var a1 = sunAt(t.lat, t.decl, clock - 0.1).az, a2 = sunAt(t.lat, t.decl, clock + 0.1).az;
    $('fPlace').textContent = t.town + ', ' + t.lat.toFixed(1) + '° N';
    $('fDate').textContent = t.date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) + ' · day ' + t.n;
    $('fDecl').textContent = (t.decl >= 0 ? '+' : '−') + Math.abs(t.decl).toFixed(1) + '°';
    $('fDay').textContent = hm(t.rise) + ' to ' + hm(t.set) + ' · ' + Math.floor(t.len) + ' h ' + Math.round((t.len % 1) * 60) + ' min';
    $('fSun').textContent = deg(s.az) + ' (' + point(s.az) + '), ' + Math.round(s.alt) + '° up';
    $('fTurn').textContent = Math.abs(n180(a2 - a1) / 0.2).toFixed(1) + '° an hour';
    $('fCal').textContent = '1 s of waggle ≈ ' + t.cal + ' m';
    $('fColony').textContent = t.foragers.toLocaleString() + ' foragers of ' + t.bees.toLocaleString();
    $('clockOut').textContent = hm(clock) + ' solar time';
    $('sunOut').textContent = 'Sun ' + deg(s.az) + ' (' + point(s.az) + '), ' + Math.round(s.alt) + '° up · ' + hm(clock);
    var cl = $('clock'); if (cl) { cl.min = minClock().toFixed(2); cl.max = maxClock().toFixed(2); if (document.activeElement !== cl) cl.value = clock.toFixed(2); }
  }
  function renderDancer() {
    var n = today.patches.length, done = res.filter(Boolean).length;
    $('combOut').textContent = 'Dancer ' + (cur + 1) + ' of ' + n + ' · ' + (dance.round ? 'round dance' : 'waggle dance') + ' · ' + done + ' read';
    $('btnScout').disabled = !guess || !!res[cur];
    var v = $('verdict');
    if (!res[cur]) {
      v.className = 'verdict';
      v.innerHTML = 'Watch her. When you think you know where she has been, click the map to put a scout down there, and send it.';
    }
    renderNotes();
  }
  function redrawStatic() { renderFacts(); renderDancer(); drawMap(); drawSky(); drawAngles(); drawColony(); }
  function rebuild() {
    playing = false; if ($('btnPlay')) $('btnPlay').textContent = 'Run the day';
    buildDay(); today.sim = simulate(); renderPlaque(); redrawStatic();
    setStatus('A painted forager has just come in. Watch the straight part of her dance: its angle, and how long it lasts.');
  }
  function nextDancer() {
    var n = today.patches.length;
    for (var s = 1; s <= n; s++) { var c = (cur + s) % n; if (!res[c]) { cur = c; startDance(); redrawStatic(); return; } }
    cur = (cur + 1) % n; startDance(); redrawStatic();
  }

  /* ---------- the buzz of the waggle run ---------- */
  var ac = null, buzz = null, buzzing = false;
  function ensureAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) {
      ac = new AC();
      var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 250;
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.9;
      var am = ac.createGain(); am.gain.value = 0.5;
      var lfo = ac.createOscillator(); lfo.frequency.value = 15;
      var lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      buzz = ac.createGain(); buzz.gain.value = 0;
      o.connect(bp); bp.connect(am); am.connect(buzz); buzz.connect(ac.destination);
      o.start(); lfo.start();
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function gate(on) {
    if (!buzz || on === buzzing) return;
    buzzing = on;
    buzz.gain.setTargetAtTime(on ? 0.07 : 0, ac.currentTime, 0.012);
  }

  /* ---------- the loop ---------- */
  var last = 0, slow = 0;
  function frame(ts) {
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
    if (today) {
      if (playing) {
        clock += dt * 0.4;
        if (clock > maxClock()) clock = minClock();
        slow += dt;
        if (slow > 0.12) { slow = 0; renderFacts(); drawMap(); drawSky(); drawAngles(); drawColony(); }
      }
      stepDance(dt); stepBees(dt); drawComb();
      var hear = $('hearChk') && $('hearChk').checked;
      gate(!!(hear && dance && !dance.round && dance.phase === 'waggle'));
    }
    requestAnimationFrame(frame);
  }

  /* ---------- wiring ---------- */
  wire('btnDancer', 'click', nextDancer);
  wire('btnScout', 'click', scout);
  wire('btnWork', 'click', working);
  wire('notesChk', 'change', renderNotes);
  wire('hearChk', 'change', function (e) { if (e.target.checked) ensureAudio(); else gate(false); });
  wire('clock', 'input', function (e) { clock = +e.target.value; renderFacts(); drawMap(); drawSky(); drawAngles(); drawColony(); });
  wire('btnPlay', 'click', function () { playing = !playing; this.textContent = playing ? 'Stop the clock' : 'Run the day'; });
  wire('btnDayPrev', 'click', function () { dayOffset--; rebuild(); });
  wire('btnDayNext', 'click', function () { dayOffset++; rebuild(); });
  wire('btnDayToday', 'click', function () { dayOffset = 0; rebuild(); });
  wire('map', 'pointerdown', function (e) {
    if (!today || res[cur]) return;
    guess = mapPoint(e);
    $('mapOut').textContent = 'Scout set: ' + describe(guess.x, guess.y);
    $('btnScout').disabled = false;
    drawMap();
  });
  wire('map', 'pointermove', function (e) {
    if (!today) return;
    var p = mapPoint(e);
    $('mapOut').textContent = (guess && !res[cur] ? 'Scout: ' + describe(guess.x, guess.y) + '   ·   cursor: ' : 'Cursor: ') + describe(p.x, p.y);
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { dayOffset--; rebuild(); }
    else if (e.key === 'ArrowRight') { dayOffset++; rebuild(); }
    else if (e.key === 'n' || e.key === 'N') nextDancer();
  });
  var rz = 0;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (today) redrawStatic(); }, 80); });

  rebuild();
  requestAnimationFrame(frame);
})();
