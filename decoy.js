/* drift.quibo.games — The Decoy
   A season working a duck decoy in the fens and marshes of England, some time between 1800 and 1879. The day's number
   picks the decoy and its pond, how many pipes it has and which way each one points, the dog, the weather from the
   first of November to the last of January (the wind and its strength, the frosts that bring the fowl in from the
   Continent), the days a wildfowler's gun goes off on the water nearby, and the price of fowl at Leadenhall.

   Each morning you see the wind and choose: work one pipe, or leave the pond quiet. Fowl follow the dog up a pipe that
   faces into the wind; work a pipe with the wind behind it and the pond smells the man, and half the fowl go. Every
   drive leaves the rest a little warier, and only quiet days settle them again. At the end of January the page sets
   your season beside the decoyman's rule worked on the same weather. Self-contained. */
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
    var h = s ^ 0x5d3c0e1f;
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
    var d = Math.round(v * 240), l = Math.floor(d / 240), s = Math.floor((d % 240) / 12), p = d % 12;
    if (l === 0 && s === 0) return p + 'd';
    if (l === 0) return s + 's' + (p ? ' ' + p + 'd' : '');
    return '£' + l.toLocaleString('en-GB') + (s || p ? ' ' + s + 's' : '') + (p ? ' ' + p + 'd' : '');
  }
  function degF(c) { return Math.round(c * 9 / 5 + 32) + '°F'; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- the world ---------- */
  var POINT = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  var WINDN = ['northerly', 'north-easterly', 'easterly', 'south-easterly', 'southerly', 'south-westerly', 'westerly', 'north-westerly'];
  var ABBR = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var FORCE = ['calm', 'a light air', 'a fresh breeze', 'a strong wind', 'a gale'];
  var FORCE_S = ['calm', 'light', 'fresh', 'strong', 'gale'];
  var PLACES = [
    { name: 'Borough Fen Decoy', near: 'Peakirk', county: 'Northamptonshire', off: -0.3, fowl: 1.1 },
    { name: 'Ashby Decoy', near: 'Scunthorpe', county: 'Lincolnshire', off: -0.6, fowl: 1.2 },
    { name: 'Nacton Decoy', near: 'Ipswich', county: 'Suffolk', off: -0.2, fowl: 1.0 },
    { name: 'Fritton Decoy', near: 'Great Yarmouth', county: 'Suffolk', off: -0.3, fowl: 1.05 },
    { name: 'Dersingham Decoy', near: 'King’s Lynn', county: 'Norfolk', off: -0.4, fowl: 1.0 },
    { name: 'Steeple Decoy', near: 'Maldon', county: 'Essex', off: 0.0, fowl: 0.95 },
    { name: 'Goldhanger Decoy', near: 'Maldon', county: 'Essex', off: 0.0, fowl: 0.9 },
    { name: 'Boarstall Decoy', near: 'Brill', county: 'Buckinghamshire', off: -0.2, fowl: 0.75 },
    { name: 'Hale Decoy', near: 'Liverpool', county: 'Lancashire', off: 0.4, fowl: 0.85 },
    { name: 'Orielton Decoy', near: 'Pembroke', county: 'Pembrokeshire', off: 1.0, fowl: 0.9 },
    { name: 'Berkeley New Decoy', near: 'Slimbridge', county: 'Gloucestershire', off: 0.5, fowl: 0.95 },
    { name: 'Lilford Decoy', near: 'Oundle', county: 'Northamptonshire', off: -0.4, fowl: 0.8 }
  ];
  var DOGS = ['Piper', 'Nell', 'Toby', 'Rory', 'Fly', 'Jess', 'Rap', 'Gyp', 'Tib', 'Fox', 'Rusty', 'Sandy'];
  var KINDS = {
    hard: { name: 'a hard winter', spells: [3, 4], depth: [5, 9] },
    ordinary: { name: 'an ordinary winter', spells: [2, 3], depth: [3.5, 7] },
    open: { name: 'an open winter', spells: [1, 2], depth: [2, 4.5] }
  };
  /* mean daily temperature (°C) in the eastern counties, mid-month, November to February */
  var NORMAL = [7.0, 4.6, 3.8, 3.9];
  var FIT = [1, 0.7, 0.3, 0, 0];               /* how willing the fowl are, by points between wind and pipe */
  var SF = [0.3, 0.85, 1, 0.75, 0.3];           /* how well they work, by strength of wind */

  function angDiff(a, b) { var d = Math.abs(a - b) % 8; return d > 4 ? 8 - d : d; }

  function buildDay(off) {
    var d = dateFor(off), r = rng(seedForDate(d)), i;
    var P = pick(r, PLACES), year = 1800 + Math.floor(r() * 80);
    var E = 92, dates = [];
    for (i = 0; i < E; i++) dates.push(new Date(year - 1, 10, 1 + i, 12));
    var u = r(), kind = u < 0.25 ? 'hard' : u < 0.7 ? 'ordinary' : 'open', K = KINDS[kind];

    /* the pipes: four to six, spread round the pond, each named for the point it runs out towards */
    var np = 4 + Math.floor(r() * 3), heads = [];
    var startH = Math.floor(r() * 8), cand = [];
    for (i = 0; i < 8; i++) cand.push((startH + i) % 8);
    /* take every other point first, so the pipes spread, then fill in */
    var order = cand.filter(function (_, k) { return k % 2 === 0; }).concat(cand.filter(function (_, k) { return k % 2 === 1; }));
    var extra = order.slice(4);
    for (i = extra.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = extra[i]; extra[i] = extra[j]; extra[j] = t; }
    heads = order.slice(0, 4).concat(extra).slice(0, np).sort(function (a, b) { return a - b; });

    /* temperatures */
    var T = new Float32Array(E + 1), e = 0;
    for (i = 0; i <= E; i++) {
      var f = i / 30.44 - 0.5, k = clamp(Math.floor(f), 0, NORMAL.length - 2), fr = clamp(f - k, 0, 1);
      e = 0.72 * e + gauss(r) * 1.5;
      T[i] = NORMAL[k] + (NORMAL[k + 1] - NORMAL[k]) * fr + P.off + e;
    }
    var nSp = K.spells[0] + Math.floor(r() * (K.spells[1] - K.spells[0] + 1));
    for (i = 0; i < nSp; i++) {
      var s0 = 8 + Math.floor(r() * (E - 18)), len = 4 + Math.floor(r() * (kind === 'hard' ? 11 : 7)), dep = K.depth[0] + r() * (K.depth[1] - K.depth[0]);
      for (var q = s0; q < s0 + len && q <= E; q++) T[q] -= dep * Math.min(1, (q - s0 + 1) / 2, (s0 + len - q) / 2);
    }

    /* the wind: south-westerlies most days, backing into the north and east when the frost comes */
    var PREV = [0.08, 0.07, 0.08, 0.06, 0.12, 0.25, 0.2, 0.14];
    function prevailing() { var x = r(), c = 0; for (var k = 0; k < 8; k++) { c += PREV[k]; if (x < c) return k; } return 5; }
    var wind = [], str = [], w = prevailing(), sv = 1.7;
    for (i = 0; i < E; i++) {
      var x = r();
      if (T[i] < -1 && x < 0.45) w = Math.floor(r() * 3);
      else if (x < 0.62) { /* holds */ }
      else if (x < 0.88) w = (w + (r() < 0.5 ? 1 : 7)) % 8;
      else w = prevailing();
      sv = clamp(0.65 * sv + 0.35 * (1.8 + gauss(r) * 1.1) - (T[i] < -1 ? 0.35 : 0), 0, 4.49);
      wind.push(w); str.push(Math.round(sv));
    }

    var sky = [];
    for (i = 0; i < E; i++) {
      var tt = T[i], s;
      if (tt < -0.5) s = r() < 0.18 ? 'snow' : tt < -4 ? 'hard frost' : 'frost';
      else if (str[i] === 0) s = r() < 0.6 ? 'fog' : 'still and grey';
      else if (str[i] >= 4) s = 'wild and wet';
      else s = r() < 0.3 ? 'rain' : tt > 8 ? 'soft and mild' : r() < 0.5 ? 'grey' : 'bright';
      sky.push(s);
    }

    /* fowl coming in: more as the winter deepens, a rush from the Continent with every frost */
    var arr = new Float32Array(E), base = (22 + r() * 22) * P.fowl;
    for (i = 0; i < E; i++) {
      var m = 0.65 + 0.7 * Math.sin(Math.PI * (i + 8) / (E + 16));
      var cold = 0; for (var b = Math.max(0, i - 3); b <= i; b++) if (T[b] < -1) cold++;
      arr[i] = base * m * (1 + 0.65 * cold) * (str[i] >= 4 ? 0.55 : 1) * (0.8 + 0.4 * r());
    }

    /* a wildfowler on the water near by; nobody can stop him */
    var gun = new Array(E).fill(false), ng = 2 + Math.floor(r() * 4);
    for (i = 0; i < ng; i++) gun[6 + Math.floor(r() * (E - 8))] = true;

    var price = new Float32Array(E), pb = (0.042 + r() * 0.03) * (year >= 1846 ? 1.12 : 1);
    for (i = 0; i < E; i++) price[i] = pb * (T[i] < -1 ? 1.35 : 1) * (0.94 + 0.12 * r());

    return {
      off: off, P: P, year: year, E: E, dates: dates, kind: kind, K: K, heads: heads, np: np, T: T, wind: wind, str: str,
      sky: sky, arr: arr, base: base, gun: gun, price: price, pb: pb, n0: Math.round(base * (7 + r() * 5)),
      dog: pick(r, DOGS), knack: 0.9 + r() * 0.25
    };
  }

  /* ---------- the pond ---------- */
  function newState(day) {
    return { N: day.n0, W: 0.1, last: -1, run: 0, caught: 0, money: 0, worked: 0, flushes: 0, driven: 0, gunLost: 0,
      best: 0, bestDay: -1, curveN: [], curveC: [], daily: [] };
  }
  function bestPipe(day, i) {
    var b = 0, bd = 9;
    for (var k = 0; k < day.np; k++) { var dd = angDiff(day.wind[i], day.heads[k]); if (dd < bd) { bd = dd; b = k; } }
    return b;
  }
  /* act: -1 leaves the pond quiet, otherwise the index of the pipe worked */
  function step(day, st, act, i) {
    var w = day.wind[i], s = day.str[i], ev = { act: act, caught: 0, followed: 0, flush: false, lost: 0, gun: false, d: -1 };
    if (act >= 0) {
      var dd = angDiff(w, day.heads[act]); ev.d = dd;
      st.worked++;
      if (dd >= 3 || s === 0 && dd >= 2) {
        ev.flush = true;
        var lost = st.N * (dd === 4 ? 0.5 : dd === 3 ? 0.35 : 0.25);
        st.N -= lost; ev.lost = lost; st.driven += lost; st.flushes++;
        st.W = Math.min(0.95, st.W + 0.32);
      } else {
        var willing = FIT[dd] * SF[s] * Math.pow(1 - st.W, 1.3);
        var fol = Math.min(st.N * 0.5, st.N * 0.12 * willing * day.knack);
        var c = Math.round(fol * 0.88);
        st.N -= fol; ev.followed = Math.round(fol); ev.caught = c;
        st.caught += c; st.money += c * day.price[i];
        if (c > st.best) { st.best = c; st.bestDay = i; }
        st.W = Math.min(0.95, st.W * 0.8 + 0.08 + 0.12 * (1 - FIT[dd]) + (st.last === act ? 0.03 * Math.min(3, st.run) : 0));
      }
      st.run = st.last === act ? st.run + 1 : 1; st.last = act;
    } else {
      st.W *= 0.7; st.run = 0; st.last = -1;
    }
    var mild = day.T[i] > 8 ? 0.03 : 0;
    st.N += day.arr[i] - st.N * (0.035 + 0.1 * st.W + mild);
    if (day.gun[i]) { var gl = st.N * 0.3; st.N -= gl; st.gunLost += gl; st.W = Math.min(0.95, st.W + 0.15); ev.gun = true; }
    st.N = Math.max(0, st.N);
    st.curveN.push(st.N); st.curveC.push(st.caught); st.daily.push(ev.caught);
    return ev;
  }

  /* the decoyman's rule: work only a pipe that looks into the wind, never in a calm or a gale, never when the fowl are
     already wary or few; otherwise keep away and let the pond fill */
  function rulePolicy(day) {
    return function (i, st) {
      var b = bestPipe(day, i), dd = angDiff(day.wind[i], day.heads[b]), s = day.str[i];
      return dd <= 1 && s >= 1 && s <= 3 && st.W < 0.38 && st.N > 90 ? b : -1;
    };
  }
  function simulate(day, policy) {
    var st = newState(day);
    for (var i = 0; i < day.E; i++) step(day, st, policy(i, st), i);
    return st;
  }
  function policies(day) {
    return {
      rule: simulate(day, rulePolicy(day)),
      daily: simulate(day, function (i) { return bestPipe(day, i); }),
      same: simulate(day, function () { return 0; })
    };
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { buildDay: buildDay, policies: policies, newState: newState, step: step };
    return;
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('decoy'), g = cv.getContext('2d'), CW = cv.width, CH = cv.height;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var day = null, dayOff = 0, st = null, i0 = 0, sel = -1, phase = 'season', hover = -1, hist = [], dots = [], lastEv = null;

  function dlabel(i) { var t = day.dates[i]; return WEEKDAYS[t.getDay()] + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()]; }
  function short(i) { var t = day.dates[i]; return t.getDate() + ' ' + MON[t.getMonth()]; }
  function pipeName(k) { return 'the ' + POINT[day.heads[k]] + ' pipe'; }
  function say(h) { $('msg').innerHTML = h; }

  /* ---------- drawing ---------- */
  var PX = 210, PY = 168, PR = 62, PLEN = 108;
  function pipePts(k) {
    var a0 = day.heads[k] * Math.PI / 4, pts = [];
    for (var j = 0; j <= 12; j++) {
      var t = j / 12, a = a0 + t * t * 0.95, rr = PR - 6 + t * PLEN;
      pts.push([PX + Math.sin(a) * rr, PY - Math.cos(a) * rr * 0.86, 24 * (1 - t) + 4 * t]);
    }
    return pts;
  }
  function makeDots() {
    var r = rng(seedForDate(dateFor(dayOff)) ^ 0x77), a = [];
    for (var k = 0; k < 260; k++) {
      var ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * (PR - 8);
      a.push({ x: Math.sin(ang) * rad, y: Math.cos(ang) * rad * 0.86, ph: r() * 6.28, sp: 0.3 + r() * 0.6, c: r() });
    }
    dots = a;
  }
  function draw(now) {
    if (!day) return;
    now = now || 0;
    var i = Math.min(i0, day.E - 1), T = day.T[i], w = day.wind[i], s = day.str[i], tt = still ? 0 : now / 1000;
    g.fillStyle = T < -0.5 ? (day.sky[i] === 'snow' ? '#202832' : '#151c24') : '#0f1612'; g.fillRect(0, 0, CW, CH);

    /* reed beds and the wood round the decoy */
    var rr = rng(91);
    for (var k = 0; k < 340; k++) {
      var rx = rr() * 440, ry = 10 + rr() * 310, dx = rx - PX, dy = (ry - PY) / 0.86;
      if (Math.sqrt(dx * dx + dy * dy) < PR + 4) continue;
      var sway = still ? 0 : Math.sin(tt * (0.8 + s * 0.6) + rx * 0.05) * (0.6 + s * 0.8);
      g.strokeStyle = T < -0.5 ? 'rgba(180,195,210,.25)' : 'rgba(110,140,80,.35)';
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + sway + Math.sin(w * Math.PI / 4 + Math.PI) * s, ry - 7); g.stroke();
    }

    /* pond */
    g.fillStyle = T < -2 ? '#3a5068' : '#21415c';
    g.beginPath(); g.ellipse(PX, PY, PR, PR * 0.86, 0, 0, Math.PI * 2); g.fill();
    if (T < -2) { g.fillStyle = 'rgba(220,235,250,.25)'; g.beginPath(); g.ellipse(PX, PY, PR, PR * 0.86, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#21415c'; g.beginPath(); g.ellipse(PX, PY, PR * 0.55, PR * 0.47, 0, 0, Math.PI * 2); g.fill(); }

    /* pipes */
    for (k = 0; k < day.np; k++) {
      var pts = pipePts(k), isSel = k === sel && phase === 'season', isHov = k === hover;
      g.lineCap = 'round';
      for (var j = 0; j < pts.length - 1; j++) {
        g.strokeStyle = '#1f3a52'; g.lineWidth = pts[j][2];
        g.beginPath(); g.moveTo(pts[j][0], pts[j][1]); g.lineTo(pts[j + 1][0], pts[j + 1][1]); g.stroke();
      }
      /* the netting over the hoops */
      g.lineWidth = 1; g.strokeStyle = isSel ? 'rgba(242,211,107,.9)' : isHov ? 'rgba(242,211,107,.55)' : 'rgba(200,210,225,.35)';
      for (j = 1; j < pts.length - 1; j++) {
        var ax = pts[j + 1][0] - pts[j - 1][0], ay = pts[j + 1][1] - pts[j - 1][1], al = Math.sqrt(ax * ax + ay * ay) || 1;
        var nx = -ay / al * pts[j][2] / 2, ny = ax / al * pts[j][2] / 2;
        g.beginPath(); g.moveTo(pts[j][0] - nx, pts[j][1] - ny); g.lineTo(pts[j][0] + nx, pts[j][1] + ny); g.stroke();
      }
      /* screens along the outside of the curve */
      g.fillStyle = '#6b5236';
      for (j = 2; j < pts.length - 1; j += 2) {
        var bx = pts[j + 1][0] - pts[j - 1][0], by = pts[j + 1][1] - pts[j - 1][1], bl = Math.sqrt(bx * bx + by * by) || 1;
        var ox = -by / bl * (pts[j][2] / 2 + 5), oy = bx / bl * (pts[j][2] / 2 + 5);
        g.fillRect(pts[j][0] + ox - 2, pts[j][1] + oy - 2, 4, 4);
      }
      var end = pts[pts.length - 1];
      g.font = '600 11px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
      g.fillStyle = isSel ? '#f2d36b' : '#c8d0dc';
      g.fillText(String(k + 1) + ' ' + ABBR[day.heads[k]], end[0] + Math.sin(day.heads[k] * Math.PI / 4 + 0.95) * 16, end[1] - Math.cos(day.heads[k] * Math.PI / 4 + 0.95) * 14 + 4);
    }
    g.lineCap = 'butt';

    /* fowl on the pond */
    var show = Math.min(dots.length, Math.round(st.N / 3));
    for (k = 0; k < show; k++) {
      var p = dots[k], wob = still ? 0 : Math.sin(tt * p.sp + p.ph) * 2.5;
      var rad = PR - 10, x = p.x + wob, y = p.y + (still ? 0 : Math.cos(tt * p.sp * 0.7 + p.ph) * 1.5);
      if (T < -2) { x *= 0.55; y *= 0.55; }
      if (x * x + (y / 0.86) * (y / 0.86) > rad * rad) continue;
      g.fillStyle = p.c < 0.5 ? '#d9c79a' : p.c < 0.8 ? '#9fb7c9' : '#7fbf8a';
      g.fillRect(PX + x - 1.5, PY + y - 1, 3, 2);
    }

    /* the wind: a vane and streaks blowing across */
    var VX = 540, VY = 88, wa = w * Math.PI / 4;
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(VX, VY, 48, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#8b97ab'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
    for (k = 0; k < 8; k += 2) g.fillText(ABBR[k], VX + Math.sin(k * Math.PI / 4) * 60, VY - Math.cos(k * Math.PI / 4) * 60 + 4);
    /* arrow from the windward side toward the lee */
    var fx = VX + Math.sin(wa) * 40, fy = VY - Math.cos(wa) * 40, tx = VX - Math.sin(wa) * 40, ty = VY + Math.cos(wa) * 40;
    g.strokeStyle = s === 0 ? '#8b97ab' : '#9fd8ff'; g.lineWidth = 2 + s * 0.6;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(tx, ty); g.stroke();
    var ha = Math.atan2(ty - fy, tx - fx);
    g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 12 * Math.cos(ha - 0.4), ty - 12 * Math.sin(ha - 0.4)); g.lineTo(tx - 12 * Math.cos(ha + 0.4), ty - 12 * Math.sin(ha + 0.4)); g.fill();
    g.lineWidth = 1;
    g.fillStyle = '#e8edf5'; g.fillText(s === 0 ? 'CALM' : FORCE_S[s].toUpperCase() + ' ' + ABBR[w], VX, VY + 78);
    g.fillStyle = '#8b97ab'; g.fillText('THE WIND', VX, VY - 70 + 4 - 6);
    if (!still && s > 0) {
      g.strokeStyle = 'rgba(200,230,255,.13)';
      var vx = -Math.sin(wa), vy = Math.cos(wa);
      for (k = 0; k < 14; k++) {
        var ph = ((tt * (0.12 + s * 0.08) + k * 0.137) % 1), sx = (k * 97) % 440, sy = 20 + (k * 53) % 290;
        var cx = sx + vx * (ph - 0.5) * 300, cy = sy + vy * (ph - 0.5) * 300;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + vx * 18, cy + vy * 18); g.stroke();
      }
    }
    /* hud figures in the right column */
    g.textAlign = 'left'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillStyle = '#8b97ab';
    g.fillText('FOWL ON THE POND', 470, 196); g.fillText('WARINESS', 470, 244); g.fillText('TAKEN THIS SEASON', 470, 292);
    g.font = '600 18px ui-monospace,Menlo,monospace'; g.fillStyle = '#e8edf5';
    g.fillText(String(Math.round(st.N)), 470, 218);
    g.fillText(String(st.caught), 470, 314);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(470, 252, 140, 8);
    g.fillStyle = st.W > 0.55 ? '#ff8a5b' : st.W > 0.35 ? '#f2d36b' : '#64f0c8'; g.fillRect(470, 252, 140 * st.W, 8);

    /* the season so far */
    var L = 40, R = CW - 12, TOP = 350, B = CH - 24, n = day.E;
    function X(j) { return L + (j + 0.5) / n * (R - L); }
    g.font = '600 10px ui-monospace,Menlo,monospace'; g.fillStyle = '#8b97ab'; g.textAlign = 'left';
    g.fillText('LINE: FOWL ON THE POND · BARS: TAKEN · BLUE BELOW: FROST · ✕ GUN · ▼ FLUSHED', L, TOP - 8);
    var mxN = 400; for (j = 0; j < st.curveN.length; j++) mxN = Math.max(mxN, st.curveN[j]);
    var mxC = 30; for (j = 0; j < st.daily.length; j++) mxC = Math.max(mxC, st.daily[j]);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke();
    var bw = Math.max(1, (R - L) / n - 1);
    for (j = 0; j < hist.length; j++) {
      if (day.T[j] < -1) { g.fillStyle = 'rgba(122,162,255,.5)'; g.fillRect(X(j) - bw / 2, B + 1, bw, 4); }
      if (st.daily[j]) { var hh = st.daily[j] / mxC * (B - TOP) * 0.6; g.fillStyle = '#f2d36b'; g.fillRect(X(j) - bw / 2, B - hh, bw, hh); }
      if (hist[j].flush) { g.fillStyle = '#ff8a5b'; g.beginPath(); g.moveTo(X(j), TOP + 8); g.lineTo(X(j) - 4, TOP + 1); g.lineTo(X(j) + 4, TOP + 1); g.fill(); }
      if (day.gun[j]) { g.fillStyle = '#ff8a5b'; g.fillText('✕', X(j) - 3, TOP + 20); }
    }
    g.strokeStyle = '#9fd8ff'; g.lineWidth = 1.5; g.beginPath();
    for (j = 0; j < st.curveN.length; j++) { var yy = B - st.curveN[j] / mxN * (B - TOP); if (!j) g.moveTo(X(j), yy); else g.lineTo(X(j), yy); }
    g.stroke(); g.lineWidth = 1;
    g.textAlign = 'center'; g.fillStyle = '#8b97ab';
    for (j = 0; j < n; j++) if (day.dates[j].getDate() === 1) g.fillText(MON[day.dates[j].getMonth()], X(j) + 12, B + 16);
    if (phase === 'season') { g.strokeStyle = '#f2d36b'; g.beginPath(); g.moveTo(X(i0), TOP); g.lineTo(X(i0), B); g.stroke(); }
  }
  function loop(now) { draw(now); if (!still) requestAnimationFrame(loop); }

  /* ---------- the hud ---------- */
  function hud() {
    var i = Math.min(i0, day.E - 1), T = day.T[i];
    $('hWhen').textContent = phase === 'season' ? dlabel(i) : '31 January';
    $('hSky').textContent = day.sky[i] + ', ' + degF(T);
    $('hWind').textContent = day.str[i] === 0 ? 'calm' : FORCE_S[day.str[i]] + ', ' + WINDN[day.wind[i]];
    $('hWindBox').className = day.str[i] === 0 || day.str[i] >= 4 ? 'alarm' : '';
    $('hPrice').textContent = money(day.price[i]) + ' a bird';
    if (phase !== 'season') { $('plan').textContent = 'The pipes are quiet until next October.'; return; }
    var w = day.wind[i], s = day.str[i], p = '';
    p += 'The wind is <b>' + (s === 0 ? 'dead calm' : FORCE[s] + ' from the ' + POINT[w]) + '</b>. ';
    if (sel < 0) p += 'No pipe chosen: click one, or press its number. ';
    else {
      var dd = angDiff(w, day.heads[sel]);
      p += 'In ' + pipeName(sel) + ' it ' + (dd === 0 ? 'blows straight down the pipe into the fowls’ faces, as it should.' :
        dd === 1 ? 'blows a little across, but still into the fowls’ faces.' :
        dd === 2 ? 'blows square across the mouth: they will go up it only grudgingly.' :
        dd === 3 ? '<i>blows from behind you. The pond will wind the man before the dog has shown twice.</i>' :
        '<i>blows straight up the pipe from the pond. Every bird on the water will smell you.</i>') + ' ';
      if (s === 0 && dd < 3) p += '<i>In a calm the fowl sit tight and the peat smoke hangs.</i> ';
      if (s >= 4) p += '<i>In a gale they huddle under the lee bank and will hardly move.</i> ';
    }
    if (st.W > 0.55) p += '<i>The fowl are wary: heads up, swimming in the middle.</i> ';
    else if (st.W > 0.35) p += 'The fowl are a little uneasy. ';
    else p += 'The fowl are easy, preening and asleep along the banks. ';
    $('plan').innerHTML = p;
    $('bWork').disabled = sel < 0;
    $('bWork').textContent = sel < 0 ? 'Choose a pipe' : 'Work ' + pipeName(sel);
  }

  /* ---------- the season ---------- */
  function fresh() {
    st = newState(day); i0 = 0; sel = -1; phase = 'season'; hist = []; lastEv = null;
    $('seasonActs').style.display = ''; $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = ''; $('bAgain').style.display = 'none';
    say('<b>' + dlabel(0) + '.</b> The pipes are new-netted and the screens mended, and some ' + Math.round(st.N) + ' fowl are on the pond. ' +
      'Click a pipe, or press its number, then work it, or leave the pond quiet for the day.');
    hud(); if (still) draw();
  }
  function choose(k) { if (phase !== 'season' || k < 0 || k >= day.np) return; sel = k; hud(); if (still) draw(); }
  function act(a, n) {
    if (phase !== 'season') return;
    var notes = [];
    for (var k = 0; k < n && i0 < day.E; k++) {
      var i = i0, ev = step(day, st, a, i);
      hist.push(ev); i0++;
      var line = '';
      if (a >= 0) {
        if (ev.flush) line = '<b>' + short(i) + '.</b> You went to ' + pipeName(a) + ' with the wind ' + (ev.d === 4 ? 'behind you' : 'at your back') +
          '. The pond winded you, and <b>' + Math.round(ev.lost) + ' fowl got up</b> in a roar and went off over the wood.';
        else if (ev.caught === 0) line = '<b>' + short(i) + '.</b> ' + day.dog + ' showed at the screens of ' + pipeName(a) + ' again and again, and not a bird would follow.';
        else line = '<b>' + short(i) + '.</b> ' + day.dog + ' slipped in and out of the screens of ' + pipeName(a) + ', and ' + ev.followed +
          ' fowl swam after him up the pipe. You showed yourself behind them, they rose into the wind, and <b>' + ev.caught + '</b> were taken in the purse net' +
          (ev.caught * day.price[i] >= 1 ? ', worth ' + money(ev.caught * day.price[i]) + ' at Leadenhall.' : '.');
      }
      if (ev.gun) line += (line ? ' ' : '<b>' + short(i) + '.</b> ') + '<i>A punt-gun went off on the water beyond the wood, and the pond is thinner for it.</i>';
      if (i0 < day.E && day.T[i0] < -1 && day.T[i] >= -1) line += (line ? ' ' : '<b>' + short(i) + '.</b> ') + 'The wind has gone round into the east and a frost is setting in. Fowl will be coming over from the Continent, and they fetch more in London in hard weather.';
      if (line) { notes.push(line); if (n > 1 && (ev.gun || ev.flush || day.T[i0] < -1 && day.T[i] >= -1)) { k++; break; } }
    }
    if (i0 >= day.E) { finish(); return; }
    if (sel >= 0 && phase === 'season') { /* keep the chosen pipe */ }
    say(notes.length ? notes.slice(-2).join('<br>') : '<b>' + dlabel(i0) + '.</b> You kept away from the pond. ' + cap(day.sky[i0]) + ', and ' + Math.round(st.N) + ' fowl on the water.');
    hud(); if (still) draw();
  }

  /* ---------- the end of the season ---------- */
  function finish() {
    phase = 'done';
    $('seasonActs').style.display = 'none'; $('bAgain').style.display = '';
    var pol = policies(day), R = pol.rule;
    var good = st.money >= R.money * 0.97;
    var v = $('verdict');
    v.className = 'verdict ' + (good ? 'good' : 'warn');
    v.innerHTML = '<p><b>31 January.</b> The season closes. You worked the pipes on ' + num(st.worked) + (st.worked === 1 ? ' day' : ' days') +
      ' and took <b>' + st.caught.toLocaleString('en-GB') + ' fowl</b>, which went up to Leadenhall for <b>' + money(st.money) + '</b>' +
      (st.flushes ? '. ' + cap(num(st.flushes)) + (st.flushes === 1 ? ' time' : ' times') + ' you went to a pipe with the wind wrong, and the pond winded you and went up.' : ', and never once let the pond wind you.') + '</p>' +
      '<p>The decoyman’s rule, worked on the same weather, would have taken <b>' + R.caught.toLocaleString('en-GB') + '</b> for ' + money(R.money) +
      (Math.abs(st.money - R.money) < R.money * 0.03 ? ', about the same.' : st.money > R.money ? ', and you beat it.' : '.') +
      ' Working the best pipe every single day would have taken ' + pol.daily.caught.toLocaleString('en-GB') + '; working ' + pipeName(0) + ' every day whatever the wind, ' + pol.same.caught.toLocaleString('en-GB') + '.</p>';

    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>Fowl taken through the season</h5><canvas id="rc" width="640" height="260" aria-label="Fowl taken through the season, added up day by day, for your season, the decoyman’s rule, the best pipe worked every day, and one pipe worked every day."></canvas>' +
      '<div class="key"><span><i style="background:#f2d36b"></i>your season</span><span><i style="background:#64f0c8"></i>the decoyman’s rule</span><span><i style="background:#ff8a5b"></i>best pipe, every day</span><span><i style="background:#8b97ab"></i>' + pipeName(0) + ', every day</span></div>' +
      '<h5>The decoyman’s book</h5><table class="card"><tr><td></td><td class="n">yours</td><td class="n">the rule</td></tr>' +
      row('Days the pipes were worked', st.worked, R.worked) +
      row('Fowl taken', st.caught.toLocaleString('en-GB'), R.caught.toLocaleString('en-GB')) +
      row('Best day', st.bestDay >= 0 ? st.best + ', ' + short(st.bestDay) : '—', R.bestDay >= 0 ? R.best + ', ' + short(R.bestDay) : '—') +
      row('Times the pond was flushed', st.flushes, R.flushes) +
      row('Fowl driven off by flushing', Math.round(st.driven), Math.round(R.driven)) +
      row('Fowl left on the pond, 31 January', Math.round(st.N), Math.round(R.N)) +
      '<tr class="tot"><td>Sold at Leadenhall</td><td class="n">' + money(st.money) + '</td><td class="n">' + money(R.money) + '</td></tr></table>' +
      '<p>The punt-gun beyond the wood cost the pond ' + Math.round(st.gunLost) + ' fowl in your season; nobody could have stopped it.</p>';
    drawReveal($('rc'), [pol.same.curveC, pol.daily.curveC, R.curveC, st.curveC], ['#8b97ab', '#ff8a5b', '#64f0c8', '#f2d36b']);
    hud(); draw();
  }
  function row(a, b, c) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td><td class="n">' + c + '</td></tr>'; }
  function drawReveal(c, curves, cols) {
    var x = c.getContext('2d'), W = c.width, H = c.height, L = 50, R = W - 10, T0 = 14, B = H - 26, n = day.E, i, j;
    var mx = 100;
    curves.forEach(function (cu) { cu.forEach(function (v) { if (v > mx) mx = v; }); });
    var stepY = mx > 2000 ? 500 : mx > 800 ? 200 : 100; mx = Math.ceil(mx / stepY) * stepY;
    x.fillStyle = '#0b0f16'; x.fillRect(0, 0, W, H);
    x.font = '600 10px ui-monospace,Menlo,monospace'; x.fillStyle = '#8b97ab'; x.textAlign = 'right';
    for (i = 0; i <= mx; i += stepY) {
      var y = B - i / mx * (B - T0);
      x.strokeStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke();
      x.fillText(String(i), L - 6, y + 3);
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
    dayOff = off; day = buildDay(off); makeDots();
    var P = day.P;
    $('rWho').textContent = 'Duck decoy · ' + P.name + ', near ' + P.near + ', ' + P.county + ' · the season of ' + (day.year - 1) + '–' + String(day.year).slice(2);
    $('rName').textContent = 'Work the pipes';
    $('rBlurb').innerHTML = 'It is the first of November. The pond lies quiet in its wood with <b>' + num(day.np) + ' pipes</b> curving away from it, running out towards the ' +
      day.heads.map(function (h) { return POINT[h]; }).join(', ').replace(/, ([^,]*)$/, ' and $1') + '. You are the decoyman, and ' + day.dog + ' is your dog. It will be ' + day.K.name +
      '. Fowl fetch about <b>' + money(day.pb) + ' a bird</b> at Leadenhall, more in hard weather, and the season runs to the last day of January.';
    $('rBook').textContent = 'Work no pipe but the one that looks into the wind. Never go near the pond in a calm, nor in a gale. When the fowl are wild, leave them be a day or two; a quiet pond fills, and a worked one empties. — the decoyman’s rule';
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      P.name + ', ' + (day.year - 1) + '–' + String(day.year).slice(2);
    fresh();
  }

  /* ---------- wiring ---------- */
  function pipeAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    var best = -1, bd = 22 * 22;
    for (var k = 0; k < day.np; k++) {
      var pts = pipePts(k);
      for (var j = 1; j < pts.length; j++) { var dx = pts[j][0] - x, dy = pts[j][1] - y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = k; } }
    }
    return best;
  }
  cv.addEventListener('pointermove', function (e) {
    var k = pipeAt(e);
    if (k !== hover) { hover = k; if (still) draw(); }
    if (k < 0) { $('cellOut').textContent = '—'; return; }
    var dd = angDiff(day.wind[Math.min(i0, day.E - 1)], day.heads[k]);
    $('cellOut').textContent = 'Pipe ' + (k + 1) + ' · runs out to the ' + POINT[day.heads[k]] + ' · ' +
      (day.str[Math.min(i0, day.E - 1)] === 0 ? 'no wind today' : ['wind straight down it', 'wind a point across', 'wind square across', 'wind behind it', 'wind blowing up it from the pond'][dd]);
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; if (still) draw(); });
  cv.addEventListener('click', function (e) { choose(pipeAt(e)); });
  $('bWork').addEventListener('click', function () { if (sel >= 0) act(sel, 1); });
  $('bRest').addEventListener('click', function () { act(-1, 1); });
  $('bRest3').addEventListener('click', function () { act(-1, 3); });
  $('bWeek').addEventListener('click', function () { act(-1, 7); });
  $('bAgain').addEventListener('click', fresh);
  document.addEventListener('keydown', function (e) {
    if (phase !== 'season') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var used = true, m = /^Digit([1-8])$/.exec(e.code);
    if (m) choose(+m[1] - 1);
    else if (e.code === 'KeyW' || e.code === 'Enter') { if (sel >= 0) act(sel, 1); }
    else if (e.code === 'KeyR' || e.code === 'Space') act(-1, 1);
    else used = false;
    if (used) e.preventDefault();
  });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  if (!still) requestAnimationFrame(loop);
})();
