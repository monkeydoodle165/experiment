/* drift.quibo.games — The Water Meadow
   A winter drowning a water meadow in a chalk valley of Wessex, some time between 1780 and 1859. The day's number picks
   the river and the village, the winter (its frosts, mild spells and rain up on the downs), the eight beds of the meadow
   and their acres, how much water the river will spare, the flock that must be fed on the early grass in spring, and
   the price of hay.

   Each day you open or shut the hatch at the head of each bed. Water from the main carrier reaches the nearest beds
   first; open more than the river can cover and the farthest beds get only part of their water. Grass under a thin,
   moving sheet of chalk-spring water keeps growing all winter, and grows faster on the thick water after rain. But
   water left on a bed too long goes sour and rots the grass, faster in mild weather and slower in frost, and a bed left
   dry in a hard frost is browned by it. On the sixteenth of March the ewes and lambs go in, and the page sets your
   winter beside the drowner's rule worked on the same weather. Self-contained. */
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
    var h = s ^ 0x2c1b3c6d;
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
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function money(v) {
    var sh = Math.round(v * 20), l = Math.floor(sh / 20), s = sh % 20;
    return l === 0 ? s + 's' : '£' + l.toLocaleString('en-GB') + (s ? ' ' + s + 's' : '');
  }
  function inch(h) {
    var q = Math.round(h * 4) / 4, w = Math.floor(q), f = q - w;
    var fr = f === 0.25 ? '¼' : f === 0.5 ? '½' : f === 0.75 ? '¾' : '';
    return (w || !fr ? String(w) : '') + fr + ' in';
  }
  function acres(a) { return (Math.round(a * 10) / 10).toFixed(1) + (Math.abs(a - 1) < 0.05 ? ' acre' : ' acres'); }
  function degF(c) { return Math.round(c * 9 / 5 + 32) + '°F'; }
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  /* ---------- the world ---------- */
  var PLACES = [
    { river: 'Wylye', at: 'Wilton', county: 'Wiltshire', off: 0.0, flow: 1.0 },
    { river: 'Avon', at: 'Britford', county: 'Wiltshire', off: 0.1, flow: 1.12 },
    { river: 'Nadder', at: 'Dinton', county: 'Wiltshire', off: -0.1, flow: 0.92 },
    { river: 'Ebble', at: 'Coombe Bissett', county: 'Wiltshire', off: -0.1, flow: 0.82 },
    { river: 'Kennet', at: 'Hungerford', county: 'Berkshire', off: -0.3, flow: 1.05 },
    { river: 'Lambourn', at: 'Boxford', county: 'Berkshire', off: -0.3, flow: 0.86 },
    { river: 'Test', at: 'Wherwell', county: 'Hampshire', off: 0.1, flow: 1.15 },
    { river: 'Itchen', at: 'St Cross, by Winchester', county: 'Hampshire', off: 0.3, flow: 1.08 },
    { river: 'Bourne Rivulet', at: 'Hurstbourne Priors', county: 'Hampshire', off: -0.1, flow: 0.78 },
    { river: 'Frome', at: 'Maiden Newton', county: 'Dorset', off: 0.4, flow: 0.95 },
    { river: 'Piddle', at: 'Puddletown', county: 'Dorset', off: 0.4, flow: 0.86 },
    { river: 'Allen', at: 'Wimborne St Giles', county: 'Dorset', off: 0.3, flow: 0.8 }
  ];
  var KINDS = {
    hard: { name: 'a hard winter', spells: [3, 4], depth: [5, 9], rain: 0.07, mild: 1 },
    ordinary: { name: 'an ordinary winter', spells: [2, 3], depth: [3.5, 7], rain: 0.1, mild: 2 },
    mild: { name: 'a mild winter', spells: [1, 2], depth: [2, 4.5], rain: 0.13, mild: 3 }
  };
  /* mean daily temperature (°C) in the chalk valleys, mid-month, December to April */
  var NORMAL = [4.4, 3.7, 3.9, 5.6, 7.8];
  var NB = 8;          /* beds on the main carrier */
  var EWE = 100;       /* ewe-and-lamb days of keep from an inch of grass on an acre */
  var HAY_LB = 3;      /* pounds of hay a ewe eats in a day when there is no grass */

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i;
    var P = pick(r, PLACES), year = 1780 + Math.floor(r() * 80);
    var t0 = new Date(year - 1, 11, 1, 12);
    var E = Math.round((new Date(year, 2, 16, 12) - t0) / 864e5);   /* days from 1 December to 15 March */
    var dates = [];
    for (i = 0; i <= E; i++) dates.push(new Date(year - 1, 11, 1 + i, 12));
    var u = r(), kind = u < 0.25 ? 'hard' : u < 0.72 ? 'ordinary' : 'mild', K = KINDS[kind];

    /* the beds, nearest the head hatch first */
    var a = [], tot = 0;
    for (i = 0; i < NB; i++) { a.push(Math.round((1.1 + r() * 1.3) * 10) / 10); tot += a[i]; }

    /* temperatures: normal + place + red noise + cold spells and mild spells */
    var T = new Float32Array(E + 2), e = 0;
    for (i = 0; i <= E + 1; i++) {
      var f = i / 30.44 - 0.5, k = clamp(Math.floor(f), 0, NORMAL.length - 2), fr = clamp(f - k, 0, 1);
      e = 0.72 * e + gauss(r) * 1.5;
      T[i] = NORMAL[k] + (NORMAL[k + 1] - NORMAL[k]) * fr + P.off + e;
    }
    function spell(s, len, depth) {
      for (var q = s; q < s + len && q <= E + 1; q++) T[q] += depth * Math.min(1, (q - s + 1) / 2, (s + len - q) / 2);
    }
    var nSp = K.spells[0] + Math.floor(r() * (K.spells[1] - K.spells[0] + 1));
    for (i = 0; i < nSp; i++) spell(Math.floor(r() * (E - 10)), 4 + Math.floor(r() * (kind === 'hard' ? 12 : 8)), -(K.depth[0] + r() * (K.depth[1] - K.depth[0])));
    for (i = 0; i < K.mild; i++) spell(Math.floor(r() * (E - 8)), 4 + Math.floor(r() * 7), 2.5 + r() * 3);

    /* the river: a steady chalk stream, with rain up on the downs (and snow melting) bringing it down thick */
    var base = clamp(tot * (0.46 + r() * 0.2) * P.flow, tot * 0.38, tot * 0.78);
    var flow = new Float32Array(E + 1), silt = new Float32Array(E + 1), rain = [], pulse = 0, snow = 0;
    for (i = 0; i <= E; i++) {
      pulse *= 0.8;
      var rained = 0;
      if (T[i] < -0.5) { if (r() < K.rain) snow += 0.15 + r() * 0.3; }
      else {
        if (snow > 0 && T[i] > 2) { pulse += snow * tot * 0.6; rained = 3; snow = 0; }
        if (r() < K.rain) { var big = r() < 0.3; pulse += tot * (big ? 0.45 + r() * 0.45 : 0.12 + r() * 0.22); rained = Math.max(rained, big ? 2 : 1); }
      }
      rain.push(rained);
      flow[i] = base * (T[i] < -3 ? 0.9 : 1) * (1 + 0.03 * gauss(r)) + pulse;
      silt[i] = clamp(pulse / (tot * 0.35), 0, 1);
    }

    var sky = [], glass = [];
    for (i = 0; i <= E; i++) {
      var t = T[i], s;
      if (rain[i] === 3) s = 'thaw and rain';
      else if (t < -0.5) s = r() < 0.15 ? 'snow' : t < -4 ? 'hard frost' : 'frost';
      else if (rain[i] === 2) s = 'heavy rain';
      else if (rain[i] === 1) s = 'rain';
      else if (t < 3) s = r() < 0.35 ? 'fog' : 'raw and grey';
      else s = t > 8 ? 'soft and mild' : r() < 0.4 ? 'showers' : 'mild';
      sky.push(s);
      var dl = T[i + 1] - t + gauss(r) * 1.6 + (i < E && rain[i + 1] ? 2 : 0);
      glass.push(dl < -1.4 ? 'rising' : dl > 1.4 ? 'falling' : 'steady');
    }

    var g0 = [];
    for (i = 0; i < NB; i++) g0.push(0.25 + r() * 0.35);
    var need = 18 + Math.floor(r() * 9);
    var flock = Math.round(tot * 4.6 * EWE / need * (0.85 + r() * 0.2) / 10) * 10;
    return {
      off: off, P: P, year: year, E: E, dates: dates, kind: kind, K: K, a: a, tot: tot, T: T, base: base,
      flow: flow, silt: silt, sky: sky, glass: glass, g0: g0, need: need, flock: flock,
      hay: 2.6 + r() * 3.2, breed: year < 1820 ? 'Wiltshire Horn' : year < 1840 ? 'Southdown' : 'Hampshire Down'
    };
  }

  /* ---------- the meadow ---------- */
  function newState(day) {
    return { g: day.g0.slice(), s: new Array(NB).fill(0), rot: new Array(NB).fill(0), wet: new Array(NB).fill(0),
      frost: 0, sour: 0, curve: [] };
  }
  function allot(day, open, d) {
    var rem = day.flow[d], openAc = 0, cov = [], i;
    for (i = 0; i < NB; i++) {
      cov.push(0);
      if (!open[i]) continue;
      openAc += day.a[i];
      var got = Math.min(day.a[i], rem); rem -= got; cov[i] = got / day.a[i];
    }
    return { cov: cov, extra: openAc > 0 ? rem / openAc : 0, spare: rem };
  }
  function step(day, st, open, d) {
    var T = day.T[d], S = day.silt[d], w = allot(day, open, d), ev = { sour: [], frost: [], iced: [] };
    for (var i = 0; i < NB; i++) {
      var c = w.cov[i], gr = 0, loss = 0, wasSour = st.s[i] > 1;
      if (c > 0) {
        st.s[i] += c * (0.055 + 0.013 * Math.max(0, T)) * (1 + 0.35 * Math.min(1, w.extra));
        gr = wasSour ? 0 : c * (0.05 + 0.035 * S) * (1 - st.rot[i]);
        if (T < -3 && c < 0.85) { loss = 0.02 * (-3 - T) * (0.85 - c) / 0.85; ev.iced.push(i); }
        st.wet[i]++;
      } else {
        st.s[i] = Math.max(0, st.s[i] - (0.17 + 0.01 * Math.max(0, T)));
        gr = wasSour ? 0 : Math.max(0, T - 6) * 0.008 * (1 - st.rot[i]);
        if (T < -1) { loss = 0.012 * (-1 - T); ev.frost.push(i); }
        st.wet[i] = 0;
      }
      loss = Math.min(loss, st.g[i]);
      st.frost += loss * day.a[i];
      if (st.s[i] > 1) {
        var sl = Math.min(st.g[i] - loss, 0.035 * (st.s[i] - 1) + 0.01);
        st.sour += Math.max(0, sl) * day.a[i]; loss += Math.max(0, sl);
        st.rot[i] = Math.min(0.6, st.rot[i] + 0.015 * (st.s[i] - 1) + 0.003);
        if (!wasSour) ev.sour.push(i);
      }
      st.g[i] = Math.max(0, st.g[i] + gr - loss);
      st.s[i] = Math.min(1.8, st.s[i]);
    }
    st.curve.push(avg(day, st.g));
    ev.cov = w.cov; ev.spare = w.spare;
    return ev;
  }
  function avg(day, g) { var s = 0; for (var i = 0; i < NB; i++) s += g[i] * day.a[i]; return s / day.tot; }
  function keep(day, st) { return avg(day, st.g) * day.tot * EWE; }

  /* the drowner's rule: as many beds as the river will cover, the freshest first; rest a bed when it begins to sour
     and give it back the water when the ground has breathed; in a hard frost keep the water on a little longer */
  function bookPolicy(day) {
    var rest = new Array(NB).fill(false);
    return function (d, st) {
      var T = day.T[d], F = day.flow[d], lim = T < -2 ? 0.95 : 0.8, i, open = new Array(NB).fill(0), ac = 0;
      for (i = 0; i < NB; i++) { if (st.s[i] > lim) rest[i] = true; else if (rest[i] && st.s[i] < 0.12) rest[i] = false; }
      var order = [];
      for (i = 0; i < NB; i++) if (!rest[i]) order.push(i);
      order.sort(function (x, y) { return st.s[x] - st.s[y] || x - y; });
      order.forEach(function (k) { if (ac + day.a[k] <= F + 0.05) { open[k] = 1; ac += day.a[k]; } });
      return open;
    };
  }
  function simulate(day, policy) {
    var st = newState(day);
    for (var d = 0; d < day.E; d++) step(day, st, policy(d, st), d);
    return st;
  }
  function policies(day) {
    return {
      book: simulate(day, bookPolicy(day)),
      all: simulate(day, function () { return new Array(NB).fill(1); }),
      none: simulate(day, function () { return new Array(NB).fill(0); })
    };
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { buildDay: buildDay, policies: policies, keep: keep, newState: newState, step: step, NB: NB };
    return;
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('meadow'), g = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var day = null, dayOff = 0, st = null, d = 0, open = null, phase = 'winter', hist = [], hover = -1, lastEv = null;

  function dlabel(i) { var t = day.dates[i]; return WEEKDAYS[t.getDay()] + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()]; }
  function short(i) { var t = day.dates[i]; return t.getDate() + ' ' + MON[t.getMonth()]; }
  function bedName(i) { return 'bed ' + (i + 1); }
  function beds(ix) { return ix.length === 1 ? 'bed ' + (ix[0] + 1) : 'beds ' + list(ix.map(function (i) { return String(i + 1); })); }
  function say(h) { $('msg').innerHTML = h; }

  /* ---------- drawing ---------- */
  var BX = 70, Y0 = 52, RH = 31, BWMAX = 400, DRX = 492;
  function bedW(i) { var m = Math.max.apply(null, day.a); return Math.round(day.a[i] / m * BWMAX); }
  function grassCol(h, s, rot) {
    var k = clamp(h / 4.5, 0, 1);
    var r = 52 + 40 * k, gg = 58 + 150 * k, b = 34 + 40 * k;
    if (s > 0.6) { var y = clamp((s - 0.6) / 0.8, 0, 1); r += 90 * y; gg += 20 * y; b -= 10 * y; }
    if (rot > 0.05) { var q = clamp(rot / 0.5, 0, 1); r = r * (1 - 0.4 * q) + 96 * 0.4 * q; gg = gg * (1 - 0.5 * q) + 70 * 0.5 * q; b = b * (1 - 0.4 * q) + 40 * 0.4 * q; }
    return 'rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(b) + ')';
  }
  function draw(now) {
    if (!day) return;
    now = now || 0;
    var di = Math.min(d, day.E - 1), T = day.T[di], cov = phase === 'winter' ? allot(day, open, di).cov : new Array(NB).fill(0);
    var flowT = still ? 0 : now / 900;
    g.fillStyle = '#0e1410'; g.fillRect(0, 0, CW, CH);

    /* the river, flowing left to right, thicker and browner after rain */
    var sl = day.silt[di];
    g.fillStyle = 'rgb(' + Math.round(40 + 70 * sl) + ',' + Math.round(80 + 20 * sl) + ',' + Math.round(120 - 50 * sl) + ')';
    g.fillRect(0, 10, CW, 22);
    g.strokeStyle = 'rgba(255,255,255,.18)';
    for (var x = -40; x < CW; x += 38) { var xx = x + ((flowT * 30) % 38); g.beginPath(); g.moveTo(xx, 18); g.lineTo(xx + 14, 18); g.moveTo(xx + 18, 25); g.lineTo(xx + 28, 25); g.stroke(); }
    g.fillStyle = '#8b97ab'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'left';
    g.fillText('THE ' + day.P.river.toUpperCase() + ' →', 8, 8);

    /* frosted ground between the channels */
    g.fillStyle = T < -0.5 ? (day.sky[di] === 'snow' ? '#aeb8c2' : '#26302c') : '#162016';
    g.fillRect(0, 34, CW, Y0 + NB * RH - 30);

    /* main carrier down the left, main drain up the right back to the river */
    var anyOpen = open && open.some(function (v) { return v; }) && phase === 'winter';
    g.fillStyle = anyOpen ? '#4c86b8' : '#22303c';
    g.fillRect(44, 30, 9, Y0 + NB * RH - 34);
    g.fillStyle = '#5a3e2a'; g.fillRect(40, 30, 17, 4);
    g.fillStyle = '#22303c'; g.fillRect(DRX + 8, 30, 7, Y0 + NB * RH - 34);

    for (var i = 0; i < NB; i++) {
      var y = Y0 + i * RH, w = bedW(i), h = RH - 6;
      g.fillStyle = grassCol(st.g[i], st.s[i], st.rot[i]);
      g.fillRect(BX, y, w, h);
      /* the ridge with its little carrier, the panes falling away to the drains either side */
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(BX, y, w, 3); g.fillRect(BX, y + h - 3, w, 3);
      var c = cov[i];
      if (c > 0) {
        var reach = Math.round(w * c);
        g.fillStyle = 'rgba(120,190,255,' + (0.22 + 0.25 * day.silt[di]) + ')';
        g.fillRect(BX, y + 2, reach, h - 4);
        g.strokeStyle = 'rgba(200,235,255,.35)';
        for (var k = 0; k < reach - 6; k += 22) { var ox = (k + (flowT * 18) % 22); if (ox < reach - 6) { g.beginPath(); g.moveTo(BX + ox, y + h / 2 - 5); g.lineTo(BX + ox + 6, y + h / 2 - 5); g.moveTo(BX + ox + 10, y + h / 2 + 5); g.lineTo(BX + ox + 16, y + h / 2 + 5); g.stroke(); } }
        g.fillStyle = '#4c86b8'; g.fillRect(BX, y + h / 2 - 1, reach, 2);
        if (c >= 0.999) { g.fillStyle = '#3a6890'; g.fillRect(BX + w, y + h / 2 - 2, DRX + 8 - BX - w, 4); }
      } else {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(BX, y + h / 2 - 1, w, 2);
        if (T < -1 && phase === 'winter') { g.fillStyle = 'rgba(230,240,255,' + clamp((-1 - T) / 8, 0.15, 0.5) + ')'; g.fillRect(BX, y, w, h); }
      }
      /* the hatch: a board in the carrier, drawn up or down */
      var isOpen = open && open[i] && phase === 'winter';
      g.fillStyle = isOpen ? '#4c86b8' : '#22303c'; g.fillRect(53, y + h / 2 - 3, BX - 53, 6);
      g.fillStyle = isOpen ? '#c9a46a' : '#7a5a3a';
      g.fillRect(56, isOpen ? y - 2 : y + h / 2 - 7, 6, isOpen ? 8 : 14);
      g.fillStyle = '#8b97ab'; g.textAlign = 'right'; g.font = '600 11px ui-monospace,Menlo,monospace';
      g.fillText(String(i + 1), 36, y + h / 2 + 4);
      g.textAlign = 'left'; g.fillStyle = '#e8edf5';
      g.fillText(inch(st.g[i]), DRX + 24, y + h / 2 - 1);
      g.fillStyle = st.s[i] > 1 ? '#ffb27a' : st.s[i] > 0.7 ? '#f2d36b' : '#8b97ab'; g.font = '600 9px ui-monospace,Menlo,monospace';
      var word = st.s[i] > 1 ? 'SOUR' : st.s[i] > 0.7 ? 'SOURING' : st.wet[i] > 0 ? 'WET ' + st.wet[i] + 'D' : st.s[i] > 0.05 ? 'AIRING' : 'DRY';
      g.fillText(word, DRX + 24, y + h / 2 + 10);
      if (i === hover) { g.strokeStyle = '#f2d36b'; g.lineWidth = 2; g.strokeRect(BX - 1, y - 1, w + 2, h + 2); g.lineWidth = 1; }
    }

    /* the winter so far: frost below the line, mild above; the river, with the line it needs to cover every bed */
    var L = 40, R = CW - 12, FT = 330, FB = 386, mid = 428, B = CH - 22, n = day.E;
    function X(j) { return L + (j + 0.5) / n * (R - L); }
    g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillStyle = '#8b97ab'; g.textAlign = 'left';
    g.fillText('RIVER · DASHED: ENOUGH FOR EVERY BED · BARS: FROST BLUE, THAW ORANGE · ▲ SOUR', L, FT - 8);
    var fmax = day.tot * 1.8;
    function FY(f) { return FB - clamp(f / fmax, 0, 1) * (FB - FT); }
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(L, FY(day.tot)); g.lineTo(R, FY(day.tot)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(L, FB); g.lineTo(R, FB); g.moveTo(L, mid); g.lineTo(R, mid); g.stroke();
    g.textAlign = 'right'; g.fillText('32°F', L - 6, mid + 4);
    g.textAlign = 'center';
    for (var j = 0; j < n; j++) if (day.dates[j].getDate() === 1) g.fillText(MON[day.dates[j].getMonth()], X(j) + 12, B + 14);
    var bw = Math.max(1, (R - L) / n - 1);
    g.strokeStyle = '#9fd8ff'; g.lineWidth = 1.5; g.beginPath();
    for (j = 0; j < hist.length; j++) { var fy = FY(day.flow[j]); if (j === 0) g.moveTo(X(j), fy); else g.lineTo(X(j), fy); }
    g.stroke(); g.lineWidth = 1;
    for (j = 0; j < hist.length; j++) {
      var tc = day.T[j], hp = clamp(Math.abs(tc) * 3.2, 1, 30);
      g.fillStyle = tc <= 0 ? '#7aa2ff' : '#ff8a5b';
      if (tc <= 0) g.fillRect(X(j) - bw / 2, mid, bw, hp); else g.fillRect(X(j) - bw / 2, mid - hp, bw, hp);
      if (hist[j].sour) { g.fillStyle = '#ffb27a'; g.beginPath(); g.moveTo(X(j), B - 6); g.lineTo(X(j) - 4, B + 1); g.lineTo(X(j) + 4, B + 1); g.fill(); }
    }
    if (phase === 'winter') { g.strokeStyle = '#f2d36b'; g.beginPath(); g.moveTo(X(d), FT); g.lineTo(X(d), B); g.stroke(); }
  }
  function loop(now) { draw(now); if (!still) requestAnimationFrame(loop); }

  /* ---------- the hud ---------- */
  function hud() {
    var di = Math.min(d, day.E - 1), T = day.T[di], w = allot(day, open, di);
    $('hWhen').textContent = phase === 'winter' ? dlabel(di) : '16 March';
    $('hSky').textContent = day.sky[di] + ', ' + degF(T);
    $('hSkyBox').className = T < -3 ? 'alarm' : '';
    var F = day.flow[di];
    $('hRiver').textContent = acres(F) + ' of water' + (day.silt[di] > 0.45 ? ', thick' : day.silt[di] > 0.15 ? ', cloudy' : ', clear');
    $('hGrass').textContent = inch(avg(day, st.g)) + ' on average';
    if (phase !== 'winter') { $('plan').textContent = 'The hatches are down and the ewes are in.'; return; }
    var ix = [], ac = 0, short = [], i;
    for (i = 0; i < NB; i++) if (open[i]) { ix.push(i); ac += day.a[i]; if (w.cov[i] < 0.999) short.push(i); }
    var p;
    if (!ix.length) p = 'Every hatch is down. The river will cover <b>' + acres(F) + '</b> of the ' + acres(day.tot) + ' of meadow today.';
    else {
      p = 'Water on ' + beds(ix) + ': <b>' + acres(ac) + '</b>, and the river will cover <b>' + acres(F) + '</b>. ';
      if (short.length) p += '<b>The water will not reach the bottom of ' + beds(short) + '.</b> ';
      else if (w.extra > 0.35) p += 'There is water to spare: it runs deep, and deep water sours a bed faster. ';
      else p += 'Every open bed gets a full, thin sheet. ';
    }
    var souring = [];
    for (i = 0; i < NB; i++) if (open[i] && st.s[i] > 0.7) souring.push(i);
    if (souring.length) p += '<i>' + (souring.length === 1 ? 'Bed ' + (souring[0] + 1) + ' is' : cap(beds(souring)) + ' are') + ' going sour under the water.</i> ';
    p += '<i>The glass is ' + day.glass[di] + '.</i>';
    $('plan').innerHTML = p;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- the winter ---------- */
  function fresh() {
    st = newState(day); d = 0; open = new Array(NB).fill(0); phase = 'winter'; hist = []; lastEv = null;
    $('winterActs').style.display = ''; $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = ''; $('bAgain').style.display = 'none';
    say('<b>' + dlabel(0) + '.</b> The aftermath was grazed off in the autumn and the drains have been cleaned out. Every hatch is down. Click a bed, or press its number, to draw its hatch and let the water on.');
    hud(); if (still) draw();
  }
  function toggle(i) {
    if (phase !== 'winter' || i < 0 || i >= NB) return;
    open[i] = open[i] ? 0 : 1; hud(); if (still) draw();
  }
  function setAll(v) { if (phase !== 'winter') return; open = new Array(NB).fill(v); hud(); if (still) draw(); }
  function advance(n) {
    if (phase !== 'winter') return;
    var notes = [], k;
    for (k = 0; k < n && d < day.E; k++) {
      var wasFrost = day.T[d] < -1, ev = step(day, st, open, d);
      hist.push({ sour: ev.sour.length > 0, open: open.slice() });
      var dd = d; d++;
      var line = [];
      if (ev.sour.length) line.push('<b>' + cap(beds(ev.sour)) + (ev.sour.length === 1 ? ' has' : ' have') + ' gone sour:</b> the grass under the water is yellowing. Take the water off and let the ground breathe.');
      if (ev.iced.length && (k === 0 || ev.iced.length > 1)) line.push(cap(beds(ev.iced)) + (ev.iced.length === 1 ? ' is' : ' are') + ' freezing over: the water is too thin to keep running in this frost.');
      if (d < day.E) {
        if (day.T[d] < -1 && !wasFrost) line.push('A frost is setting in. Dry beds will be browned by it; running water keeps the grass from it.');
        if (day.silt[d] > 0.45 && day.silt[dd] <= 0.45) line.push('Rain up on the downs: the river is coming down thick, and thick water feeds the grass.');
      }
      if (line.length) { notes.push('<b>' + short(dd) + '.</b> ' + line.join(' ')); if (n > 1) { k++; break; } }
    }
    if (d >= day.E) { finish(); return; }
    say(notes.length ? notes.slice(-2).join('<br>') : '<b>' + dlabel(d) + '.</b> ' + cap(day.sky[d]) + '.');
    hud(); if (still) draw();
  }

  /* ---------- the spring ---------- */
  function finish() {
    phase = 'done';
    $('winterActs').style.display = 'none'; $('bAgain').style.display = '';
    var pol = policies(day), you = keep(day, st), book = keep(day, pol.book), F = day.flock;
    function days(k) { return k / F; }
    function hayCost(k) { var shortDays = Math.max(0, day.need - days(k)); return shortDays * F * HAY_LB / 2240 * day.hay; }
    var yd = days(you), bd = days(book), good = yd >= day.need - 0.05;
    var v = $('verdict');
    v.className = 'verdict ' + (good ? 'good' : 'warn');
    v.innerHTML = '<p><b>16 March.</b> The hatches are down, the meadow drains, and the shepherd brings the ' + F + ' ewes and their lambs down off the downs. ' +
      'The meadow carries them <b>' + yd.toFixed(1) + ' days</b> of the ' + day.need + ' before the downs give a bite' +
      (good ? ': the flock never touches the hay.' : '; for the rest they are on hay at ' + money(day.hay) + ' a ton, <b>' + money(hayCost(you)) + '</b> of it.') + '</p>' +
      '<p>The drowner’s rule, worked on the same winter, would have carried them <b>' + bd.toFixed(1) + ' days</b>' +
      (Math.abs(yd - bd) < 0.5 ? ', about the same.' : yd > bd ? ', and you beat it.' : '.') +
      ' Left dry all winter the meadow would have managed ' + days(keep(day, pol.none)).toFixed(1) + '; with every hatch drawn from December to March, ' + days(keep(day, pol.all)).toFixed(1) + '.</p>';

    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>The meadow through the winter</h5><canvas id="rc" width="640" height="260" aria-label="Average height of grass on the meadow through the winter, for your winter, the drowner’s rule, every hatch open, and the meadow left dry."></canvas>' +
      '<div class="key"><span><i style="background:#f2d36b"></i>your winter</span><span><i style="background:#64f0c8"></i>the drowner’s rule</span><span><i style="background:#ff8a5b"></i>every hatch open</span><span><i style="background:#8b97ab"></i>left dry</span></div>' +
      '<h5>The shepherd’s account</h5><table class="card"><tr><td></td><td class="n">yours</td><td class="n">the rule</td></tr>' +
      row('Grass on the meadow, 16 March', inch(avg(day, st.g)), inch(avg(day, pol.book.g))) +
      row('Spring keep, ewe-and-lamb days', Math.round(you).toLocaleString('en-GB'), Math.round(book).toLocaleString('en-GB')) +
      row('Days the flock is carried (of ' + day.need + ')', yd.toFixed(1), bd.toFixed(1)) +
      row('Grass lost to frost on dry beds or thin water', ae(st.frost), ae(pol.book.frost)) +
      row('Grass lost to sour water', ae(st.sour), ae(pol.book.sour)) +
      '<tr class="tot"><td>Hay bought for the flock</td><td class="n">' + money(hayCost(you)) + '</td><td class="n">' + money(hayCost(book)) + '</td></tr></table>' +
      '<p>An acre-inch is an inch of grass across an acre, about ' + EWE + ' days’ keep for a ewe and her lamb.</p>';
    drawReveal($('rc'), [pol.none.curve, pol.all.curve, pol.book.curve, st.curve], ['#8b97ab', '#ff8a5b', '#64f0c8', '#f2d36b']);
    hud(); draw();
  }
  function ae(x) { return (Math.round(x * 10) / 10).toFixed(1) + ' acre-in'; }
  function row(a, b, c) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td></tr>'; }
  function drawReveal(c, curves, cols) {
    var x = c.getContext('2d'), W = c.width, H = c.height, L = 44, R = W - 10, T0 = 14, B = H - 26, n = day.E, i, j;
    var mx = 1;
    curves.forEach(function (cu) { cu.forEach(function (v) { if (v > mx) mx = v; }); });
    mx = Math.ceil(mx);
    x.fillStyle = '#0b0f16'; x.fillRect(0, 0, W, H);
    x.font = '600 10px ui-monospace,Menlo,monospace'; x.fillStyle = '#8b97ab'; x.textAlign = 'right';
    for (i = 0; i <= mx; i++) {
      var y = B - i / mx * (B - T0);
      x.strokeStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke();
      x.fillText(i + ' in', L - 6, y + 3);
    }
    x.textAlign = 'center';
    for (j = 0; j < n; j++) if (day.dates[j].getDate() === 1) x.fillText(MON[day.dates[j].getMonth()], L + j / n * (R - L) + 12, H - 8);
    curves.forEach(function (cu, k) {
      x.strokeStyle = cols[k]; x.lineWidth = k === curves.length - 1 ? 2.5 : 1.5; x.beginPath();
      for (j = 0; j < cu.length; j++) { var px = L + (j + 1) / n * (R - L), py = B - cu[j] / mx * (B - T0); if (!j) x.moveTo(px, py); else x.lineTo(px, py); }
      x.stroke();
    });
    x.lineWidth = 1;
  }

  /* ---------- the day ---------- */
  function loadDay(off) {
    dayOff = off; day = buildDay(off);
    var P = day.P;
    $('rWho').textContent = 'Water meadow · the ' + P.river + ' at ' + P.at + ', ' + P.county + ' · the winter of ' + (day.year - 1) + '–' + String(day.year).slice(2);
    $('rName').textContent = 'Drown the meadow';
    $('rBlurb').innerHTML = 'It is the first of December. Below the village the farm has <b>' + acres(day.tot) + ' of water meadow</b> laid out in ' + num(NB) +
      ' beds off one main carrier, and you are the drowner. On an ordinary day the ' + P.river + ' will spare enough water to cover about <b>' + acres(day.base) +
      '</b>, nearest beds first. It is ' + day.K.name + '. On the sixteenth of March the shepherd brings down <b>' + day.flock + ' ' + day.breed +
      ' ewes and their lambs</b>, and the meadow must feed them for <b>' + day.need + ' days</b> until there is a bite on the downs. Whatever it cannot give them is hay, at ' + money(day.hay) + ' a ton.';
    $('rBook').textContent = 'Keep the water moving, a thin sheet and never standing. A week or ten days on and then let the ground breathe; in a hard frost give it all the water the river will spare. — the drowner’s rule';
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      'the ' + P.river + ', ' + (day.year - 1) + '–' + String(day.year).slice(2);
    fresh();
  }

  /* ---------- wiring ---------- */
  function bedAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    var i = Math.floor((y - Y0 + 3) / RH);
    return x > 20 && x < CW && i >= 0 && i < NB ? i : -1;
  }
  cv.addEventListener('pointermove', function (e) {
    var k = bedAt(e);
    if (k !== hover) { hover = k; if (still) draw(); }
    if (k < 0) { $('cellOut').textContent = '—'; return; }
    var s = st.s[k];
    $('cellOut').textContent = 'Bed ' + (k + 1) + ' · ' + acres(day.a[k]) + ' · ' + inch(st.g[k]) + ' of grass · ' +
      (st.wet[k] ? 'under water ' + st.wet[k] + (st.wet[k] === 1 ? ' day' : ' days') : 'dry') +
      (s > 1 ? ', sour' : s > 0.7 ? ', going sour' : s > 0.35 ? ', the ground tiring' : st.wet[k] ? ', fresh' : s > 0.05 ? ', airing' : '') +
      (st.rot[k] > 0.08 ? ' · the turf damaged by sourness' : '');
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; if (still) draw(); });
  cv.addEventListener('click', function (e) { toggle(bedAt(e)); });
  $('bDay').addEventListener('click', function () { advance(1); });
  $('b3').addEventListener('click', function () { advance(3); });
  $('bWeek').addEventListener('click', function () { advance(7); });
  $('bAll').addEventListener('click', function () { setAll(1); });
  $('bNone').addEventListener('click', function () { setAll(0); });
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'winter') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var used = true, m = /^Digit([1-8])$/.exec(e.code);
    if (m) toggle(+m[1] - 1);
    else if (e.code === 'Space') advance(1);
    else if (e.code === 'KeyW') advance(7);
    else used = false;
    if (used) e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  if (!still) requestAnimationFrame(loop);
})();
