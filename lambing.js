/* drift.quibo.games — The Lambing Fold
   Six weeks of nights in a downland lambing fold, some time between 1820 and 1879. The day's number picks the farm and
   its breed, the size of the flock and how many thatched pens the fold has, which night each ewe will lamb and at what
   hour, which births go wrong, and the weather of every night: the frosts, the rain, the sleet and the snow.

   Each evening you look at the sky and at the ewes, and choose how many times to get up in the night with the lantern.
   A lamb born in the cold and found at once is rubbed dry and penned with its mother; one left till morning on a frosty
   night may be dead by then, and a ewe with a lamb laid wrong needs a hand within the hour. But every round costs sleep,
   and a shepherd who has walked four rounds a night for a week walks past what he is looking for. At the end the page
   sets your lambing beside the shepherd's rule worked on the same flock and the same nights. Self-contained. */
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
    var h = s ^ 0x2b7a19c3;
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
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function degF(c) { return Math.round(c * 9 / 5 + 32) + '°F'; }

  /* ---------- the world ---------- */
  var PLACES = [
    { name: 'Ditchling', county: 'Sussex', down: 'the South Downs', breed: 'Southdown', start: [0, 22], off: 0.6, tw: 0.42, pd: 0.09 },
    { name: 'Alfriston', county: 'Sussex', down: 'the South Downs', breed: 'Southdown', start: [0, 26], off: 0.8, tw: 0.42, pd: 0.09 },
    { name: 'Stockbridge', county: 'Hampshire', down: 'Stockbridge Down', breed: 'Hampshire Down', start: [0, 12], off: 0.0, tw: 0.4, pd: 0.12 },
    { name: 'Tilshead', county: 'Wiltshire', down: 'Salisbury Plain', breed: 'Hampshire Down', start: [0, 16], off: -0.6, tw: 0.38, pd: 0.12 },
    { name: 'Lambourn', county: 'Berkshire', down: 'the Berkshire Downs', breed: 'Hampshire Down', start: [0, 20], off: -0.4, tw: 0.4, pd: 0.12 },
    { name: 'Cerne Abbas', county: 'Dorset', down: 'the Dorset Downs', breed: 'Dorset Horn', start: [0, 3], off: 0.5, tw: 0.5, pd: 0.08 },
    { name: 'Brookland', county: 'Kent', down: 'Romney Marsh', breed: 'Romney Marsh', start: [2, 20], off: 0.3, tw: 0.3, pd: 0.07 },
    { name: 'Northleach', county: 'Gloucestershire', down: 'the Cotswolds', breed: 'Cotswold', start: [1, 20], off: -0.8, tw: 0.4, pd: 0.11 },
    { name: 'Burford', county: 'Oxfordshire', down: 'the Cotswolds', breed: 'Cotswold', start: [1, 15], off: -0.6, tw: 0.4, pd: 0.11 },
    { name: 'Louth', county: 'Lincolnshire', down: 'the Lincolnshire Wolds', breed: 'Lincoln Longwool', start: [1, 25], off: -0.7, tw: 0.35, pd: 0.11 },
    { name: 'Wold Newton', county: 'the East Riding', down: 'the Yorkshire Wolds', breed: 'Leicester', start: [2, 1], off: -1.0, tw: 0.42, pd: 0.11 },
    { name: 'Church Stretton', county: 'Shropshire', down: 'the Long Mynd', breed: 'Shropshire', start: [1, 25], off: -1.2, tw: 0.45, pd: 0.1 }
  ];
  var SHEPHERDS = ['Caleb', 'Amos', 'Isaac', 'Reuben', 'Joseph', 'Elijah', 'Silas', 'Abel', 'Jacob', 'Eli', 'Noah', 'Gideon'];
  var DOGS = ['Rough', 'Fly', 'Moss', 'Jess', 'Shep', 'Glen', 'Nell', 'Bob', 'Lass', 'Cap', 'Tib', 'Gyp'];
  /* mean daily temperature (°C) in southern England, mid-month, January to May */
  var NORMAL = [3.8, 4.1, 5.9, 8.1, 11.2];
  var KINDS = {
    hard: { name: 'a hard spring', spells: [2, 3], depth: [5, 9], wet: 0.36 },
    ordinary: { name: 'an ordinary spring', spells: [1, 2], depth: [3, 6.5], wet: 0.4 },
    open: { name: 'an open, wet spring', spells: [0, 1], depth: [2, 4], wet: 0.5 }
  };
  var E = 42;          /* nights in the lambing */
  var NIGHT_H = 8;     /* ten at night to six in the morning */
  var PEN_NIGHTS = 3;  /* nights a ewe and her lambs keep a pen before they go out to the fold */

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i, j;
    var P = pick(r, PLACES), year = 1820 + Math.floor(r() * 60);
    var dates = [];
    for (i = 0; i < E; i++) dates.push(new Date(year, P.start[0], P.start[1] + i, 12));
    var u = r(), kind = u < 0.28 ? 'hard' : u < 0.7 ? 'ordinary' : 'open', K = KINDS[kind];

    /* the flock and the fold */
    var N = 60 + 10 * Math.floor(r() * 9);
    var pens = Math.round(N * (0.1 + r() * 0.05));
    var tw = clamp(P.tw + (r() - 0.5) * 0.12, 0.2, 0.6), pd = clamp(P.pd + (r() - 0.5) * 0.04, 0.05, 0.16);
    var peak = 12 + r() * 6, spread = 6.5 + r() * 2.5;

    /* temperatures, a little warmer as the weeks go on, with cold spells laid over them */
    var T = new Float32Array(E), e = 0;
    for (i = 0; i < E; i++) {
      var f = dates[i].getMonth() + (dates[i].getDate() - 15) / 30.4, k = clamp(Math.floor(f), 0, NORMAL.length - 2), fr = clamp(f - k, 0, 1);
      e = 0.7 * e + gauss(r) * 1.5;
      T[i] = NORMAL[k] + (NORMAL[k + 1] - NORMAL[k]) * fr + P.off + e;
    }
    var nSp = K.spells[0] + Math.floor(r() * (K.spells[1] - K.spells[0] + 1));
    for (i = 0; i < nSp; i++) {
      var s0 = Math.floor(r() * (E - 6)), len = 3 + Math.floor(r() * (kind === 'hard' ? 9 : 6)), dep = K.depth[0] + r() * (K.depth[1] - K.depth[0]);
      for (j = s0; j < s0 + len && j < E; j++) T[j] -= dep * Math.min(1, (j - s0 + 1) / 2, (s0 + len - j) / 2);
    }

    /* the nights: wet or dry, the wind, how cold it gets before dawn, and how hard that is on a wet new lamb */
    var wet = [], wind = [], Tn = new Float32Array(E), sky = [], chill = new Float32Array(E), wv = r() < K.wet;
    for (i = 0; i < E; i++) {
      wv = r() < (wv ? 0.6 : K.wet * 0.75);
      var w = clamp(Math.round(1.3 + gauss(r) * 0.9 + (wv ? 0.5 : 0)), 0, 3);
      wet.push(wv); wind.push(w);
      Tn[i] = T[i] - 3.2 - (!wv && w <= 1 ? 1.6 : 0);
      var s;
      if (wv) s = Tn[i] < 0 ? 'snow' : Tn[i] < 2 ? 'sleet' : w >= 3 ? 'wild and wet' : 'rain';
      else s = Tn[i] < -4 ? 'a hard frost' : Tn[i] < 0 ? 'frost' : w === 0 ? (r() < 0.5 ? 'fog' : 'still and dry') : Tn[i] > 6 ? 'soft and mild' : 'dry and cold';
      sky.push(s);
      chill[i] = 0.03 + Math.max(0, 4 - Tn[i]) * 0.03 + (s === 'snow' ? 0.16 : s === 'sleet' ? 0.22 : wv ? 0.13 : 0) + w * 0.03;
    }

    /* every ewe: barren, or a night and an hour, single or twins, and whether the lamb comes the wrong way */
    var nightB = [], dayB = [];
    for (i = 0; i < E; i++) { nightB.push([]); dayB.push([]); }
    var barren = 0;
    for (j = 0; j < N; j++) {
      if (r() < 0.04) { barren++; continue; }
      var dn = -1;
      for (var tries = 0; tries < 6 && (dn < 0 || dn >= E); tries++) dn = Math.round(peak + gauss(r) * spread);
      dn = clamp(dn, 0, E - 1);
      var nl = 1 + (r() < tw ? 1 : 0); if (nl === 2 && r() < 0.05) nl = 3;
      var b = { id: j, n: nl, diff: r() < pd, t: r(), uE: r(), u: [r(), r(), r()], base: [r(), r(), r()], uF: [r(), r(), r(), r(), r()] };
      if (r() < 0.55) nightB[dn].push(b); else dayB[dn].push(b);
    }
    for (i = 0; i < E; i++) nightB[i].sort(function (a, c) { return a.t - c.t; });

    /* what the shepherd makes of the flock at dusk: ewes bagged up and restless, a guess at the night's lambings */
    var est = [];
    for (i = 0; i < E; i++) est.push(Math.max(0, Math.round(nightB[i].length + gauss(r) * 1.0)));

    return {
      off: off, P: P, year: year, dates: dates, kind: kind, K: K, N: N, pens: pens, tw: tw, pd: pd, barren: barren,
      T: T, Tn: Tn, wet: wet, wind: wind, sky: sky, chill: chill, nightB: nightB, dayB: dayB, est: est,
      shepherd: pick(r, SHEPHERDS), dog: pick(r, DOGS)
    };
  }

  /* ---------- the fold ---------- */
  function newState(day) {
    var pens = [];
    for (var p = 0; p < day.pens; p++) pens.push(0);
    return { F: 0, pens: pens, lambed: 0, born: 0, living: 0, lost: 0, ewesLost: 0, rounds: 0, missed: 0, helped: 0, outNoPen: 0,
      curveLost: [], nightLog: [] };
  }
  function eff(F) { return clamp(1.08 - 0.12 * F, 0.08, 1); }
  function roundTimes(k) { var a = []; for (var j = 1; j <= k; j++) a.push(j / (k + 1)); return a; }
  function freePens(st) { var n = 0; for (var p = 0; p < st.pens.length; p++) if (st.pens[p] === 0) n++; return n; }
  function takePen(st) { for (var p = 0; p < st.pens.length; p++) if (st.pens[p] === 0) { st.pens[p] = PEN_NIGHTS; return true; } return false; }

  /* one night with k rounds of the lantern, then the day after it */
  function step(day, st, k, i) {
    var p, j, m, ev = { k: k, eff: eff(st.F), births: [], born: 0, lost: 0, ewes: 0, dayBorn: 0, dayLost: 0, noPen: 0 };
    for (p = 0; p < st.pens.length; p++) if (st.pens[p] > 0) st.pens[p]--;
    var c = day.chill[i] * 0.55, checks = roundTimes(k), e = ev.eff, dawn = [];
    st.rounds += k;
    day.nightB[i].forEach(function (b) {
      var at = 1, by = -1;
      for (j = 0; j < checks.length; j++) if (checks[j] > b.t) { if (b.uF[j] < e) { at = checks[j]; by = j; break; } else st.missed++; }
      var h = (at - b.t) * NIGHT_H, out = { t: b.t, at: at, by: by, n: b.n, diff: b.diff, h: h, dead: 0, ewe: false, pen: false };
      var pCold = 1 - Math.exp(-c * h * (b.n > 1 ? 1.3 : 1));
      var pDiff = b.diff ? 1 - Math.exp(-Math.max(0, h - 0.75) * 0.5) : 0;
      var pOut = 0;
      if (by >= 0) {
        if (takePen(st)) out.pen = true;
        else { pOut = 1 - Math.exp(-c * 0.5 * (1 - at) * NIGHT_H); ev.noPen++; st.outNoPen++; }
        if (b.diff && h <= 0.75) st.helped++;
      } else dawn.push(out);
      for (m = 0; m < b.n; m++) {
        var live = (1 - pCold) * (1 - pDiff) * (1 - pOut);
        if (b.u[m] > live || b.base[m] < 0.03) out.dead++;
      }
      if (b.diff && b.uE < 1 - Math.exp(-Math.max(0, h - 2) * 0.08)) { out.ewe = true; ev.ewes++; }
      ev.births.push(out); ev.born += b.n; ev.lost += out.dead;
    });
    /* the night's late finds and the day's lambings go into whatever pens are left */
    dawn.forEach(function (o) { o.pen = takePen(st); });
    day.dayB[i].forEach(function (b) {
      takePen(st);
      ev.dayBorn += b.n;
      for (m = 0; m < b.n; m++) if (b.base[m] < 0.03) ev.dayLost++;
    });
    var lambed = day.nightB[i].length + day.dayB[i].length, born = ev.born + ev.dayBorn, lost = ev.lost + ev.dayLost;
    st.lambed += lambed; st.born += born; st.lost += lost; st.living += born - lost; st.ewesLost += ev.ewes;
    st.F = k === 0 ? Math.max(0, st.F - 2.2) : Math.max(0, st.F + 0.9 * k - 0.6);
    ev.F = st.F; ev.free = freePens(st);
    st.curveLost.push(st.lost); st.nightLog.push(ev);
    return ev;
  }

  /* the shepherd's rule: get up for the ewes that look like lambing and for the weather, and sleep when you can */
  function rulePolicy(day) {
    return function (i, st) {
      var est = day.est[i], c = day.chill[i];
      if (est <= 1 && c < 0.25) return 0;
      var k = Math.round(est * 0.35 + c * 5);
      if (st.F > 2) k--;
      if (st.F > 4) k--;
      k = clamp(k, 0, 3);
      return k;
    };
  }
  function simulate(day, policy) {
    var st = newState(day);
    for (var i = 0; i < E; i++) step(day, st, policy(i, st), i);
    return st;
  }
  function policies(day) {
    return {
      rule: simulate(day, rulePolicy(day)),
      four: simulate(day, function () { return 4; }),
      one: simulate(day, function () { return 1; }),
      none: simulate(day, function () { return 0; })
    };
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { buildDay: buildDay, policies: policies, newState: newState, step: step, E: E };
    return;
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('fold'), g = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var day = null, dayOff = 0, st = null, i0 = 0, phase = 'season', hover = -1, flock = [], flakes = [];

  function dlabel(i) { var t = day.dates[i]; return WEEKDAYS[t.getDay()] + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()]; }
  function short(i) { var t = day.dates[i]; return t.getDate() + ' ' + MON[t.getMonth()]; }
  function clock(t) {
    var mins = Math.round((22 * 60 + t * NIGHT_H * 60) / 15) * 15, hh = Math.floor(mins / 60) % 24, mm = mins % 60, h12 = hh % 12 || 12;
    if (hh === 0 && mm === 0) return 'midnight';
    if (mm === 0) return h12 + ' o’clock';
    if (mm === 30) return 'half past ' + h12;
    if (mm === 15) return 'a quarter past ' + h12;
    return 'a quarter to ' + (h12 % 12 + 1);
  }
  function guess(n) {
    if (n === 0) return 'none tonight, by the look of them';
    var lo = Math.max(1, n - 1), hi = n + 1;
    return num(lo) + (hi - lo === 1 ? ' or ' : ' to ') + num(hi);
  }
  function say(h) { $('msg').innerHTML = h; }
  function fatigueWord(F) { return F < 1.5 ? 'fresh' : F < 3.5 ? 'tired' : F < 5.5 ? 'weary' : F < 7.5 ? 'worn out' : 'asleep on his feet'; }
  function remaining() {
    var n = 0;
    for (var i = i0; i < E; i++) n += day.nightB[i].length + day.dayB[i].length;
    return n;
  }

  /* ---------- drawing ---------- */
  var FX = 24, FY = 64, FW = 400, FH = 170;
  function makeFlock() {
    var r = rng(seedForDate(dateFor(dayOff)) ^ 0x51), a = [], k;
    for (k = 0; k < 140; k++) a.push({ x: FX + 14 + r() * (FW - 28), y: FY + 46 + r() * (FH - 58), a: (r() - 0.5) * 0.8, ph: r() * 6.28 });
    flock = a; a = [];
    for (k = 0; k < 90; k++) a.push({ x: r() * CW, y: r() * 250, v: 0.4 + r() * 0.8, ph: r() * 6.28 });
    flakes = a;
  }
  function sheep(x, y, s, col, ang) {
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 6 * s, 4 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.ellipse(6.5 * s, 0, 2.2 * s, 1.8 * s, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function draw(now) {
    if (!day) return;
    var i = Math.min(i0, E - 1), sk = day.sky[i], tt = still ? 0 : (now || 0) / 1000, k, j;
    var cold = day.Tn[i] < 0, snow = sk === 'snow', wetN = day.wet[i];
    g.fillStyle = '#0b0f16'; g.fillRect(0, 0, CW, CH);
    var grd = g.createLinearGradient(0, 0, 0, 250);
    grd.addColorStop(0, wetN ? '#141a22' : '#0c1220'); grd.addColorStop(1, snow ? '#28303a' : cold ? '#18222a' : '#141e16');
    g.fillStyle = grd; g.fillRect(0, 0, CW, 250);
    if (!wetN && sk !== 'fog') {
      for (k = 0; k < 60; k++) {
        var f = flakes[k]; g.fillStyle = 'rgba(232,237,245,' + (0.25 + 0.35 * (still ? 0.5 : 0.5 + 0.5 * Math.sin(tt * f.v * 2 + f.ph))) + ')';
        g.fillRect(f.x, f.y * 0.22, 1.2, 1.2);
      }
    }
    /* the down rising behind the fold */
    g.fillStyle = snow ? '#3a4450' : cold ? '#26323a' : '#1d2a1e';
    g.beginPath(); g.moveTo(0, 70); g.quadraticCurveTo(160, 30, 330, 56); g.quadraticCurveTo(480, 76, CW, 44); g.lineTo(CW, 250); g.lineTo(0, 250); g.fill();
    g.fillStyle = snow ? '#4a5560' : cold ? '#2c3a40' : '#223424'; g.fillRect(0, FY - 6, CW, 250 - FY + 6);

    /* the fold: wattle hurdles round it, thatched pens along the top */
    g.fillStyle = snow ? 'rgba(220,230,240,.12)' : 'rgba(110,140,80,.12)'; g.fillRect(FX, FY, FW, FH);
    g.strokeStyle = '#8a6a44'; g.lineWidth = 3; g.strokeRect(FX, FY, FW, FH); g.lineWidth = 1;
    g.strokeStyle = 'rgba(138,106,68,.5)';
    for (k = FX + 8; k < FX + FW; k += 8) { g.beginPath(); g.moveTo(k, FY - 2); g.lineTo(k, FY + 2); g.stroke(); g.beginPath(); g.moveTo(k, FY + FH - 2); g.lineTo(k, FY + FH + 2); g.stroke(); }
    var np = day.pens, pw = (FW - 8) / np;
    for (k = 0; k < np; k++) {
      var px = FX + 4 + k * pw, used = st.pens[k] > 0;
      g.fillStyle = '#5a4630'; g.fillRect(px + 1, FY + 4, pw - 2, 34);
      g.fillStyle = snow ? '#c9d2dc' : '#a8894e'; g.fillRect(px + 1, FY + 4, pw - 2, 6);
      if (used) {
        sheep(px + pw / 2 - 1, FY + 24, Math.min(1, pw / 16), '#e6e1d4', 0);
        g.fillStyle = '#f4f0e6'; g.fillRect(px + pw / 2 - 5, FY + 31, 3, 2); if (st.pens[k] > 1) g.fillRect(px + pw / 2 + 1, FY + 32, 3, 2);
      }
    }
    /* ewes still to lamb in the body of the fold, and ewes with lambs already turned out */
    var left = remaining(), show = Math.round(left / day.N * Math.min(flock.length, day.N)), out = Math.min(flock.length - show, Math.round(st.lambed * 0.5));
    for (k = 0; k < show; k++) { var s = flock[k]; sheep(s.x, s.y + (still ? 0 : Math.sin(tt * 0.4 + s.ph) * 0.4), 0.9, snow ? '#d8d2c4' : '#e2dccd', s.a); }
    for (k = show; k < show + out; k++) {
      s = flock[k]; sheep(s.x, s.y, 0.85, '#bdb6a6', s.a);
      g.fillStyle = '#f4f0e6'; g.fillRect(s.x - 8, s.y + 3, 3, 2);
    }
    /* the hut on its wheels, its window lit if the shepherd will be up tonight */
    var HX = 470, HY = 98;
    g.fillStyle = '#3b3026'; g.fillRect(HX, HY, 74, 34);
    g.fillStyle = '#56483a'; g.beginPath(); g.moveTo(HX - 4, HY + 2); g.quadraticCurveTo(HX + 37, HY - 16, HX + 78, HY + 2); g.fill();
    g.fillStyle = '#1a1612'; g.beginPath(); g.arc(HX + 14, HY + 40, 7, 0, 7); g.fill(); g.beginPath(); g.arc(HX + 60, HY + 40, 7, 0, 7); g.fill();
    g.fillStyle = phase === 'season' ? '#f2d36b' : '#2a241c'; g.fillRect(HX + 46, HY + 10, 12, 10);
    g.fillStyle = '#2a2018'; g.fillRect(HX + 12, HY + 8, 14, 24);
    /* the right-hand figures */
    g.textAlign = 'left'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillStyle = '#8b97ab';
    g.fillText('LAMBS LIVING', 470, 172); g.fillText('LAMBS LOST', 560, 172); g.fillText('THE SHEPHERD', 470, 218);
    g.font = '600 18px ui-monospace,Menlo,monospace';
    g.fillStyle = '#7fd99a'; g.fillText(String(st.living), 470, 194);
    g.fillStyle = '#ff8a5b'; g.fillText(String(st.lost), 560, 194);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(470, 226, 150, 8);
    var fw = clamp(st.F / 9, 0, 1); g.fillStyle = st.F > 5.5 ? '#ff8a5b' : st.F > 3 ? '#f2d36b' : '#64f0c8'; g.fillRect(470, 226, 150 * fw, 8);
    g.fillStyle = '#c8d0dc'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillText(fatigueWord(st.F).toUpperCase(), 470, 246);
    g.fillStyle = '#8b97ab'; g.fillText('PENS FREE ' + freePens(st) + ' OF ' + day.pens, FX, FY - 12);
    g.textAlign = 'right'; g.fillText(left + ' EWES TO LAMB', FX + FW, FY - 12);

    /* weather over the scene */
    if (wetN && !still) {
      for (k = 0; k < flakes.length; k++) {
        f = flakes[k];
        if (snow) {
          var yy = (f.y + tt * 18 * f.v) % 250, xx = (f.x + Math.sin(tt * f.v + f.ph) * 8 + tt * 4 * day.wind[i]) % CW;
          g.fillStyle = 'rgba(240,244,250,.75)'; g.fillRect(xx, yy, 2, 2);
        } else {
          yy = (f.y + tt * 160 * f.v) % 250; xx = (f.x + tt * 30 * day.wind[i]) % CW;
          g.strokeStyle = sk === 'sleet' ? 'rgba(220,230,240,.35)' : 'rgba(159,190,220,.28)';
          g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - 2 - day.wind[i], yy + 8); g.stroke();
        }
      }
    } else if (wetN) {
      g.fillStyle = 'rgba(200,215,230,.07)'; g.fillRect(0, 0, CW, 250);
    }
    if (sk === 'fog') { g.fillStyle = 'rgba(180,190,200,.12)'; g.fillRect(0, 0, CW, 250); }

    drawNight();
    drawSeason();
  }

  /* last night, hour by hour: each lambing, and the round that found it */
  function drawNight() {
    var L = 70, R = CW - 16, TOP = 270, B = 344, ev = st.nightLog.length ? st.nightLog[st.nightLog.length - 1] : null, k, j;
    function X(t) { return L + t * (R - L); }
    g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillStyle = '#8b97ab'; g.textAlign = 'left';
    g.fillText(ev ? 'LAST NIGHT, ' + short(st.nightLog.length - 1).toUpperCase() + ' · ◆ ROUNDS · ● LAMBINGS, AND WHO FOUND THEM' : 'LAST NIGHT · NOTHING YET', 16, TOP - 6);
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(L, B - 14); g.lineTo(R, B - 14); g.stroke();
    g.textAlign = 'center';
    for (j = 0; j <= 8; j++) {
      var hh = (22 + j) % 24, lab = hh === 0 ? '12' : String(hh % 12 || 12);
      g.fillStyle = '#8b97ab'; g.fillText(j === 8 ? 'dawn' : lab, X(j / 8), B);
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(X(j / 8), TOP + 2); g.lineTo(X(j / 8), B - 12); g.stroke();
    }
    if (!ev) return;
    var rt = roundTimes(ev.k);
    for (j = 0; j < rt.length; j++) {
      var x = X(rt[j]); g.fillStyle = '#f2d36b';
      g.beginPath(); g.moveTo(x, TOP + 4); g.lineTo(x + 5, TOP + 10); g.lineTo(x, TOP + 16); g.lineTo(x - 5, TOP + 10); g.fill();
    }
    var lanes = Math.max(1, ev.births.length), lh = Math.min(10, (B - 20 - (TOP + 22)) / lanes);
    for (k = 0; k < ev.births.length; k++) {
      var b = ev.births[k], y = TOP + 24 + k * lh + lh / 2, col = b.ewe ? '#ff5b5b' : b.dead === 0 ? '#7fd99a' : b.dead < b.n ? '#f2d36b' : '#ff8a5b';
      g.strokeStyle = b.by >= 0 ? 'rgba(242,211,107,.7)' : 'rgba(139,151,171,.6)'; g.setLineDash(b.by >= 0 ? [] : [3, 3]);
      g.beginPath(); g.moveTo(X(b.t), y); g.lineTo(X(b.at), y); g.stroke(); g.setLineDash([]);
      g.fillStyle = col; g.beginPath(); g.arc(X(b.t), y, Math.min(4, lh / 2 + 0.5), 0, 7); g.fill();
      if (b.diff) { g.strokeStyle = '#ff8a5b'; g.beginPath(); g.arc(X(b.t), y, Math.min(4, lh / 2 + 0.5) + 2, 0, 7); g.stroke(); }
    }
    if (!ev.births.length) { g.fillStyle = '#8b97ab'; g.fillText('no ewe lambed in the night', (L + R) / 2, TOP + 44); }
  }

  /* the lambing so far, night by night */
  function drawSeason() {
    var L = 40, R = CW - 12, TOP = 380, B = CH - 22, n = E, j;
    function X(j) { return L + (j + 0.5) / n * (R - L); }
    g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillStyle = '#8b97ab'; g.textAlign = 'left';
    g.fillText('BARS: LAMBS BORN, GREEN LIVING, RED LOST · BLUE BELOW: COLD NIGHT · DOTS: ROUNDS WALKED', L, TOP - 10);
    var mx = 8; for (j = 0; j < n; j++) mx = Math.max(mx, (day.nightB[j].length + day.dayB[j].length) * 1.5);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke();
    var bw = Math.max(2, (R - L) / n - 2);
    for (j = 0; j < n; j++) {
      if (day.chill[j] > 0.2) { g.fillStyle = 'rgba(122,162,255,' + clamp(day.chill[j], 0.25, 0.8) + ')'; g.fillRect(X(j) - bw / 2, B + 2, bw, 4); }
      if (j === hover) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(X(j) - bw / 2 - 1, TOP, bw + 2, B - TOP); }
      if (j >= st.nightLog.length) continue;
      var ev = st.nightLog[j], born = ev.born + ev.dayBorn, lost = ev.lost + ev.dayLost;
      var hb = born / mx * (B - TOP - 16), hl = lost / mx * (B - TOP - 16);
      g.fillStyle = '#7fd99a'; g.fillRect(X(j) - bw / 2, B - hb, bw, hb - hl);
      g.fillStyle = '#ff8a5b'; g.fillRect(X(j) - bw / 2, B - hl, bw, hl);
      g.fillStyle = '#f2d36b';
      for (var q = 0; q < ev.k; q++) g.fillRect(X(j) - 1, TOP + 2 + q * 4, 2, 2);
    }
    g.textAlign = 'center'; g.fillStyle = '#8b97ab';
    for (j = 0; j < n; j++) if (day.dates[j].getDate() === 1 || j === 0) g.fillText(short(j), X(j) + (j === 0 ? 10 : 0), B + 16);
    if (phase === 'season') { g.strokeStyle = '#f2d36b'; g.beginPath(); g.moveTo(X(i0), TOP); g.lineTo(X(i0), B); g.stroke(); }
  }
  function loop(now) { draw(now); if (!still) requestAnimationFrame(loop); }

  /* ---------- the hud ---------- */
  function hud() {
    var i = Math.min(i0, E - 1);
    $('hWhen').textContent = phase === 'season' ? 'Night of ' + short(i) : 'The end';
    $('hSky').textContent = cap(day.sky[i]) + ', ' + degF(day.Tn[i]);
    $('hDue').textContent = phase === 'season' ? guess(day.est[i]).replace(', by the look of them', '') : '—';
    $('hMan').textContent = fatigueWord(st.F);
    $('hManBox').className = st.F > 5.5 ? 'alarm' : '';
    $('hSkyBox').className = day.chill[i] > 0.3 ? 'alarm' : '';
    if (phase !== 'season') { $('plan').textContent = 'The fold is empty of ewes still to lamb. The hut goes back to the farm until next winter.'; return; }
    var c = day.chill[i], p = 'Night of <b>' + dlabel(i) + '</b>: ' + day.sky[i] + ', ' + degF(day.Tn[i]) + ' before dawn. ';
    p += c > 0.35 ? '<i>A killing night for a wet new lamb.</i> ' : c > 0.2 ? '<i>A cold night: a lamb left till morning may not see it.</i> ' : c > 0.12 ? 'A raw night, not a killing one. ' : 'A kind night for lambs. ';
    p += 'At dusk you count the ewes that are bagged up and restless: <b>' + guess(day.est[i]) + '</b>. ';
    var fp = freePens(st);
    p += fp === 0 ? '<i>Every pen is full.</i> ' : fp <= 2 ? '<i>Only ' + num(fp) + (fp === 1 ? ' pen is' : ' pens are') + ' free.</i> ' : num(fp).replace(/^./, function (x) { return x.toUpperCase(); }) + ' pens are free. ';
    if (st.F > 5.5) p += '<i>You are ' + fatigueWord(st.F) + ': on a round tonight you may walk past a ewe in trouble.</i>';
    else if (st.F > 3) p += 'You are ' + fatigueWord(st.F) + '.';
    $('plan').innerHTML = p;
  }

  /* ---------- the lambing ---------- */
  function fresh() {
    st = newState(day); i0 = 0; phase = 'season';
    $('seasonActs').style.display = ''; $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = ''; $('bAgain').style.display = 'none';
    say('<b>' + dlabel(0) + '.</b> The hurdles are pitched, the pens thatched and the hut wheeled up beside the fold. ' +
      cap(num(day.N)) + ' ewes are in, and the first of them are close. Choose how many times to get up tonight.');
    hud(); if (still) draw();
  }
  function narrate(i, ev) {
    var bits = [];
    if (!ev.births.length) bits.push(ev.k ? 'You walked ' + (ev.k === 1 ? 'one round' : num(ev.k) + ' rounds') + ' with the lantern and no ewe lambed in the night.' :
      'You slept till dawn, and no ewe lambed in the night.');
    else {
      bits.push(cap(num(ev.births.length)) + (ev.births.length === 1 ? ' ewe' : ' ewes') + ' lambed in the night.');
      ev.births.slice(0, 4).forEach(function (b) {
        var what = b.n === 1 ? 'a single' : b.n === 2 ? 'twins' : 'triplets', s = cap(what) + (b.diff ? ', laid wrong,' : '') + ' at about ' + clock(b.t) + ', ';
        s += b.by >= 0 ? 'found on your ' + clock(b.at) + ' round' : 'found at dawn';
        if (b.diff && b.h <= 0.75) s += ', and you turned the lamb and drew it';
        if (b.dead === 0) s += b.h > 2.5 ? ', and all came through' : '.';
        else s += b.dead === b.n ? ', <b>' + (b.n === 1 ? 'dead' : 'all dead') + '</b>' : ', <b>' + num(b.dead) + ' dead</b>';
        if (b.ewe) s += ', <b>and the ewe lost too</b>';
        if (b.by >= 0 && !b.pen) s += ' (no pen free, so they lay out under a hurdle)';
        bits.push(s.replace(/\.$/, '') + '.');
      });
      if (ev.births.length > 4) bits.push('…and ' + num(ev.births.length - 4) + ' more.');
    }
    if (ev.dayBorn) bits.push('In the daylight ' + num(day.dayB[i].length) + ' more lambed with you there' + (ev.dayLost ? ', and ' + num(ev.dayLost) + ' lamb' + (ev.dayLost === 1 ? ' was' : 's were') + ' born weak and died.' : '.'));
    return '<b>' + short(i) + '.</b> ' + bits.join(' ');
  }
  function act(k) {
    if (phase !== 'season') return;
    var i = i0, ev = step(day, st, k, i);
    i0++;
    if (i0 >= E) { finish(); return; }
    say(narrate(i, ev));
    hud(); if (still) draw();
  }
  function sleepQuiet() {
    if (phase !== 'season') return;
    var n = 0, notes = [];
    while (i0 < E && n < 7 && day.est[i0] === 0 && day.chill[i0] < 0.2) {
      var i = i0, ev = step(day, st, 0, i); i0++; n++;
      if (ev.births.length) { notes.push(narrate(i, ev)); break; }
    }
    if (i0 >= E) { finish(); return; }
    if (!n) say('Tonight does not look quiet: ' + guess(day.est[i0]) + ' at dusk, and ' + day.sky[i0] + '. Choose your rounds.');
    else say(notes.length ? notes[0] : 'You slept ' + (n === 1 ? 'one quiet night' : num(n) + ' quiet nights') + ' through, and nothing lambed in the dark. Tonight is ' + short(i0) + '.');
    hud(); if (still) draw();
  }

  /* ---------- the end ---------- */
  function pct(s) { return Math.round(s.living / day.N * 100); }
  function finish() {
    phase = 'done';
    $('seasonActs').style.display = 'none'; $('bAgain').style.display = '';
    var pol = policies(day), R = pol.rule, good = pct(st) >= pct(R) - 1 && st.ewesLost <= R.ewesLost + 1;
    var v = $('verdict');
    v.className = 'verdict ' + (good ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + dlabel(E - 1) + '.</b> The last ewe is through. From ' + day.N + ' ewes put to the ram you have <b>' + st.living + ' lambs living</b>, ' +
      'a lambing of <b>' + pct(st) + ' per cent</b>, with ' + st.lost + ' lambs and ' + num(st.ewesLost) + (st.ewesLost === 1 ? ' ewe' : ' ewes') + ' lost. ' +
      'You walked ' + st.rounds + ' rounds of the fold in ' + E + ' nights.</p>' +
      '<p>The shepherd’s rule, worked on the same flock and the same nights, reared <b>' + R.living + '</b> (' + pct(R) + ' per cent) for ' + R.rounds + ' rounds' +
      (Math.abs(st.living - R.living) <= 1 ? ', about the same.' : st.living > R.living ? ', and you beat it.' : '.') +
      ' Four rounds every night, until the shepherd could hardly see, would have reared ' + pol.four.living + '; one round every night, ' + pol.one.living +
      '; and sleeping every night through, ' + pol.none.living + '.</p>';
    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>Lambs lost through the lambing</h5><canvas id="rc" width="640" height="240" aria-label="Lambs lost, added up night by night, for your lambing, the shepherd’s rule, four rounds every night, one round every night, and sleeping every night through."></canvas>' +
      '<div class="key"><span><i style="background:#f2d36b"></i>your lambing</span><span><i style="background:#64f0c8"></i>the shepherd’s rule</span><span><i style="background:#ff8a5b"></i>four rounds, every night</span><span><i style="background:#9fd8ff"></i>one round, every night</span><span><i style="background:#8b97ab"></i>slept every night</span></div>' +
      '<h5>The shepherd’s book</h5><table class="card"><tr><td></td><td class="n">yours</td><td class="n">the rule</td></tr>' +
      row('Ewes lambed', st.lambed, R.lambed) +
      row('Lambs born', st.born, R.born) +
      row('Lambs lost', st.lost, R.lost) +
      row('Ewes lost', st.ewesLost, R.ewesLost) +
      row('Rounds walked', st.rounds, R.rounds) +
      row('Ewes in trouble drawn in time', st.helped, R.helped) +
      row('Lambings walked past on a round', st.missed, R.missed) +
      row('Families left out with no pen', st.outNoPen, R.outNoPen) +
      '<tr class="tot"><td>Lambs living, per hundred ewes</td><td class="n">' + pct(st) + '</td><td class="n">' + pct(R) + '</td></tr></table>' +
      '<p>' + cap(num(day.barren)) + (day.barren === 1 ? ' ewe was' : ' ewes were') + ' barren, and some lambs are born too weak to live whatever anyone does; those were lost on every line of the chart.</p>';
    drawReveal($('rc'), [pol.none.curveLost, pol.one.curveLost, pol.four.curveLost, R.curveLost, st.curveLost], ['#8b97ab', '#9fd8ff', '#ff8a5b', '#64f0c8', '#f2d36b']);
    hud(); draw();
  }
  function row(a, b, c) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td></tr>'; }
  function drawReveal(c, curves, cols) {
    var x = c.getContext('2d'), W = c.width, H = c.height, L = 44, R = W - 10, T0 = 14, B = H - 26, n = E, i, j;
    var mx = 10;
    curves.forEach(function (cu) { cu.forEach(function (v) { if (v > mx) mx = v; }); });
    var stepY = mx > 60 ? 20 : mx > 25 ? 10 : 5; mx = Math.ceil(mx / stepY) * stepY;
    x.fillStyle = '#0b0f16'; x.fillRect(0, 0, W, H);
    x.font = '600 10px ui-monospace,Menlo,monospace'; x.fillStyle = '#8b97ab'; x.textAlign = 'right';
    for (i = 0; i <= mx; i += stepY) {
      var y = B - i / mx * (B - T0);
      x.strokeStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke();
      x.fillText(String(i), L - 6, y + 3);
    }
    x.textAlign = 'center';
    for (j = 0; j < n; j++) if (day.dates[j].getDate() === 1 || j === 0) x.fillText(short(j), L + j / n * (R - L) + 10, H - 8);
    curves.forEach(function (cu, k) {
      x.strokeStyle = cols[k]; x.lineWidth = k === curves.length - 1 ? 2.5 : 1.5; x.beginPath();
      for (j = 0; j < cu.length; j++) { var px = L + (j + 1) / n * (R - L), py = B - cu[j] / mx * (B - T0); if (!j) x.moveTo(px, py); else x.lineTo(px, py); }
      x.stroke();
    });
    x.lineWidth = 1;
  }

  /* ---------- the day ---------- */
  function loadDay(off) {
    dayOff = off; day = buildDay(off); makeFlock();
    var P = day.P;
    $('rWho').textContent = 'Lambing fold · ' + P.name + ', ' + P.county + ', on ' + P.down + ' · ' + P.breed + ' ewes · ' + day.year;
    $('rName').textContent = 'Keep the fold';
    $('rBlurb').innerHTML = 'It is ' + dlabel(0) + ', ' + day.year + ', and it will be ' + day.K.name + '. You are ' + day.shepherd + ', the shepherd, and ' + day.dog +
      ' is your dog. <b>' + cap(num(day.N)) + ' ' + P.breed + ' ewes</b> are in the fold, and it has <b>' + num(day.pens) + ' thatched pens</b> for the ewes that have lambed. ' +
      'The lambing will run about six weeks, busiest in the second and third. You sleep in the hut beside the fold; every evening, look at the sky and the ewes and choose how many times to go out in the night.';
    $('rBook').textContent = 'Sleep when only a ewe or so is near her time and the night is kind. Go out more for a busy fold and more again for a frost or a wet night, but fewer rounds as you tire: a shepherd who has not slept is no use to the ewes. — the shepherd’s rule';
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      P.name + ', ' + day.year;
    fresh();
  }

  /* ---------- wiring ---------- */
  function nightAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    if (y < 370 || x < 40 || x > CW - 12) return -1;
    return clamp(Math.floor((x - 40) / (CW - 52) * E), 0, E - 1);
  }
  cv.addEventListener('pointermove', function (e) {
    var j = nightAt(e);
    if (j !== hover) { hover = j; if (still) draw(); }
    if (j < 0) { $('cellOut').textContent = '—'; return; }
    var s = 'Night of ' + short(j) + ' · ' + day.sky[j] + ', ' + degF(day.Tn[j]);
    if (j < st.nightLog.length) {
      var ev = st.nightLog[j];
      s += ' · ' + (ev.k ? ev.k + (ev.k === 1 ? ' round' : ' rounds') : 'slept') + ' · ' + (ev.born + ev.dayBorn) + ' born, ' + (ev.lost + ev.dayLost) + ' lost';
      if (ev.ewes) s += ', ' + ev.ewes + (ev.ewes === 1 ? ' ewe' : ' ewes') + ' lost';
    } else if (j === i0) s += ' · tonight';
    else s += ' · still to come';
    $('cellOut').textContent = s;
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; if (still) draw(); });
  [0, 1, 2, 3, 4].forEach(function (k) { $('bR' + k).addEventListener('click', function () { act(k); }); });
  $('bQuiet').addEventListener('click', sleepQuiet);
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'season') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var used = true, m = /^Digit([0-4])$/.exec(e.code);
    if (m) act(+m[1]);
    else if (e.code === 'KeyQ') sleepQuiet();
    else used = false;
    if (used) e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  if (!still) requestAnimationFrame(loop);
})();
