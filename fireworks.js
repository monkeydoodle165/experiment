/* drift.quibo.games — The Fireworks
   A night's display at a Georgian or early Victorian pleasure garden, some time between 1749 and 1859 on
   today's calendar date. The day's number picks the garden, the occasion, the piece the band will play
   (its form, key, tempo and length), the wind, where the company stands, where the orchestra's wooden
   pavilion is, and how much the proprietor will spend.

   The visitor writes the programme on the band's score: sky rockets, balloons (the Georgian name for an
   aerial shell fired from a mortar), Roman candles and a wheel on the frame. A rocket or balloon is placed
   where it should BREAK, and the page lights it a fuse earlier, so a break on the beat means a launch off
   it. Stars are charcoal gold, steel brilliant and cast-iron Chinese fire until the chlorate colours come
   in during the 1830s and 1840s.

   Firing runs one deterministic simulation (fixed step, per-piece seeded spread) that is both drawn and
   judged: stars drift with the wind and burn out on their own clocks, rocket sticks fall back where the
   wind takes them, smoke hangs in still air and veils later breaks, the bang reaches the company after the
   light at 1,100 ft a second, and the company's favour rises with every break (more on the beat, more for
   something new, less through smoke) and sinks in the dark. The Master Pyrotechnist's programme for the
   same night is worked out from the same rules and judged by the same simulation.
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
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function words(n) { return n < WORDS.length ? WORDS[n] : String(n); }
  function money(sh) { var l = Math.floor(sh / 20), s = sh - 20 * l; return '£' + l + (s ? ' ' + s + 's' : ''); }

  /* ---------- the world ---------- */
  var G = 9.81, DT = 1 / 60, SOUND = 340, FT = 3.281;
  var W = 720, H = 440, GY = 404, SC = 2.2;          // canvas, ground line, pixels a metre
  var XMAX = W / 2 / SC;                            // the view runs from -XMAX to XMAX metres
  function PX(x) { return W / 2 + x * SC; }
  function PY(y) { return GY - y * SC; }

  var COMPS = [
    { id: 'gold', name: 'Gold', what: 'charcoal', col: [255, 186, 92], life: 2.6, from: 0, price: 1 },
    { id: 'brilliant', name: 'Brilliant', what: 'steel filings', col: [236, 242, 255], life: 1.5, from: 0, price: 1 },
    { id: 'chinese', name: 'Chinese fire', what: 'cast-iron borings', col: [255, 140, 58], life: 2.2, from: 0, price: 1.1 },
    { id: 'red', name: 'Red', what: 'strontia with chlorate', col: [255, 72, 84], life: 2.0, from: 1830, price: 1.6 },
    { id: 'green', name: 'Green', what: 'baryta with chlorate', col: [112, 255, 146], life: 2.0, from: 1838, price: 1.7 },
    { id: 'blue', name: 'Blue', what: 'copper with chlorate', col: [116, 152, 255], life: 1.6, from: 1845, price: 2 }
  ];
  var KINDS = {
    rocket: { name: 'Sky rocket', cost: 5, fuses: [1.0, 2.2, 3.0, 3.8, 4.6], lane: 0, stars: 34, speed: 17 },
    balloon: { name: 'Balloon', cost: 24, fuses: [3.0, 4.0, 5.0, 6.0, 7.0], lane: 1, stars: 80, speed: 26 },
    candle: { name: 'Roman candle', cost: 9, dur: 4.4, lane: 2, shots: 8, gap: 0.55 },
    wheel: { name: 'Wheel on the frame', cost: 28, dur: 10, lane: 3 }
  };
  var LANES = ['rocket', 'balloon', 'candle', 'wheel'];
  var GARDENS = [
    { name: 'Cuper’s Gardens', where: 'on the Surrey shore of the Thames', from: 1749, to: 1759 },
    { name: 'Marylebone Gardens', where: 'in the fields north of the town', from: 1749, to: 1776 },
    { name: 'Ranelagh Gardens', where: 'at Chelsea', from: 1749, to: 1803 },
    { name: 'Vauxhall Gardens', where: 'over the river at Lambeth', from: 1749, to: 1859 },
    { name: 'Sydney Gardens', where: 'at Bath', from: 1795, to: 1859 },
    { name: 'the Surrey Zoological Gardens', where: 'at Kennington', from: 1831, to: 1856 },
    { name: 'Cremorne Gardens', where: 'at Chelsea, by the river', from: 1845, to: 1859 }
  ];
  var FORMS = [
    { n: 'march', m: 4, b: [84, 104] }, { n: 'gavotte', m: 4, b: [92, 112] },
    { n: 'minuet', m: 3, b: [100, 126] }, { n: 'sarabande', m: 3, b: [60, 76] }
  ];
  var KEYS = [['C', 0], ['D', 2], ['E♭', 3], ['F', 5], ['G', 7], ['A', 9], ['B♭', 10]];
  var MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 11];
  var PROGS = [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3], [0, 3, 0, 4], [5, 3, 4, 0]];
  function beaufort(ms) {
    var a = Math.abs(ms);
    return a < 0.5 ? 'a dead calm' : a < 1.6 ? 'a light air' : a < 3.4 ? 'a light breeze' : a < 5.5 ? 'a gentle breeze' : a < 8 ? 'a moderate breeze' : 'a fresh breeze';
  }

  function buildDay(off) {
    var d = dateFor(off), seed = seedForDate(d), r = rng(seed);
    var year = 1749 + Math.floor(r() * 111);
    var gs = GARDENS.filter(function (g) { return year >= g.from && year <= g.to; });
    var garden = pick(r, gs);
    var form = pick(r, FORMS);
    var bpm = form.b[0] + Math.floor(r() * (form.b[1] - form.b[0] + 1)); bpm -= bpm % 2;
    var beat = 60 / bpm, m = form.m, nb = Math.max(16, Math.round(72 / (m * beat) / 4) * 4);
    var T = nb * m * beat;
    var key = pick(r, KEYS), minor = r() < 0.25;
    var wind = (r() < 0.5 ? -1 : 1) * Math.round(Math.pow(r(), 1.25) * 75) / 10;
    var crowdLeft = r() < 0.5, sgn = crowdLeft ? -1 : 1;
    var F = Math.round(-14 + r() * 28);
    var cNear = F + sgn * (30 + Math.round(r() * 28));
    var C0 = crowdLeft ? -XMAX : cNear, C1 = crowdLeft ? cNear : XMAX;
    var pNear = F - sgn * (12 + Math.round(r() * 12));
    var P0 = crowdLeft ? pNear : pNear - 34, P1 = P0 + 34;
    var PH = 22 + Math.round(r() * 8);
    var budget = 20 * (18 + Math.floor(r() * 15));
    var mon = year < 1837 ? 'King' : 'Queen';
    var occasion = pick(r, ['in honour of the ' + mon + '’s birthday', 'for the close of the season', 'for the proprietor’s benefit night',
      'to celebrate the news of a peace', 'for a grand gala night', 'for a masquerade']);
    var D = {
      date: d, seed: seed, year: year, garden: garden, form: form, bpm: bpm, beat: beat, m: m, nb: nb, T: T,
      key: key, minor: minor, wind: wind, crowdLeft: crowdLeft, F: F, C0: C0, C1: C1, P0: P0, P1: P1, PH: PH,
      budget: budget, occasion: occasion, avail: COMPS.filter(function (c) { return year >= c.from; })
    };
    D.Xc = (C0 + C1) / 2;
    D.rk = crowdLeft ? 7 : -7;            // the rocket trough is at the orchestra's end of the frame
    D.tune = writeTune(D, rng(mix(seed, 77)));
    D.heights = {};
    ['rocket', 'balloon'].forEach(function (k) {
      D.heights[k] = KINDS[k].fuses.map(function (fz) { return flight(D, k, fz); });
    });
    // a few faint stars in the sky and a line of trees, for drawing only
    var r3 = rng(mix(seed, 5)); D.sky = []; for (var i = 0; i < 90; i++) D.sky.push([r3() * W, r3() * (GY - 120), 0.2 + r3() * 0.5]);
    D.trees = []; for (var x = -10; x < W + 30; x += 14 + r3() * 18) D.trees.push([x, 18 + r3() * 34, 10 + r3() * 16]);
    return D;
  }

  /* ---------- the band's piece ---------- */
  function writeTune(D, r) {
    var sc = D.minor ? MINOR : MAJOR, notes = [], bass = [], timp = [], chords = [];
    var phrases = D.nb / 4, cur = 7;
    for (var p = 0; p < phrases; p++) {
      var pr = p === phrases - 1 ? [0, 3, 4, 0] : p === 0 ? [0, 3, 4, 0] : pick(r, PROGS);
      for (var k = 0; k < 4; k++) chords.push(pr[k]);
    }
    function midi(step) { var o = Math.floor(step / 7), dg = ((step % 7) + 7) % 7; return 60 + D.key[1] + 12 * o + sc[dg] - 12; }
    for (var b = 0; b < D.nb; b++) {
      var c = chords[b], t0 = b * D.m * D.beat, last = b === D.nb - 1;
      var ct = [c, c + 2, c + 4, c + 7, c + 9, c + 11];
      bass.push({ t: t0, d: D.m * D.beat * (D.m === 4 ? 0.5 : 1), n: 36 + D.key[1] + sc[c % 7] });
      if (D.m === 4) bass.push({ t: t0 + 2 * D.beat, d: 2 * D.beat, n: 36 + D.key[1] + sc[(c + 4) % 7] + (c + 4 >= 7 ? 12 : 0) });
      if (c === 0 || c === 4) timp.push({ t: t0, n: 36 + D.key[1] + (c === 4 ? 7 : 0) - (c === 4 ? 12 : 0) });
      if (last) { notes.push({ t: t0, d: D.m * D.beat, n: midi(7) }); break; }
      for (var q = 0; q < D.m; q++) {
        var t = t0 + q * D.beat;
        if (q === 0) {
          var best = ct[0], bd = 99;
          for (var i = 0; i < ct.length; i++) { var dd = Math.abs(ct[i] - cur) + r() * 0.8; if (dd < bd && ct[i] >= 3 && ct[i] <= 12) { bd = dd; best = ct[i]; } }
          cur = best;
        } else {
          var mv = r(); cur += mv < 0.4 ? 1 : mv < 0.8 ? -1 : mv < 0.9 ? 2 : -2; cur = clamp(cur, 3, 12);
        }
        if (q > 0 && r() < 0.28) {
          notes.push({ t: t, d: D.beat / 2, n: midi(cur) });
          notes.push({ t: t + D.beat / 2, d: D.beat / 2, n: midi(clamp(cur + (r() < 0.5 ? 1 : -1), 3, 12)) });
        } else notes.push({ t: t, d: D.beat * 0.95, n: midi(cur) });
      }
    }
    return { notes: notes, bass: bass, timp: timp };
  }

  /* ---------- flight ---------- */
  function newProj(D, kind, x, t0, tb, r) {
    if (kind === 'rocket') {
      var tilt = -clamp(D.wind * 0.045, -0.32, 0.32) + (r() - 0.5) * 0.06;
      return { kind: kind, x: x, y: 1, vx: 0, vy: 6, tilt: tilt, thrustEnd: t0 + 1.1, tb: tb };
    }
    return { kind: kind, x: x, y: 1, vx: (r() - 0.5) * 1.6, vy: 50 + (r() - 0.5) * 2, tb: tb };
  }
  function stepProj(D, p, t) {
    if (p.kind === 'rocket') {
      var ax = 0, ay = -G, k = 0.18;
      if (t < p.thrustEnd) { ax += 55 * Math.sin(p.tilt); ay += 55 * Math.cos(p.tilt); }
      ax -= k * (p.vx - D.wind); ay -= k * p.vy;
      p.vx += ax * DT; p.vy += ay * DT;
    } else {
      p.vx += -0.03 * (p.vx - D.wind) * DT; p.vy += (-G - 0.03 * p.vy) * DT;
    }
    p.x += p.vx * DT; p.y += p.vy * DT;
  }
  function flight(D, kind, fuse) { // where a piece lit at nought breaks, in still air of the day's wind
    var p = newProj(D, kind, 0, 0, fuse, function () { return 0.5; }), t = 0;
    while (t < fuse - 1e-9) { stepProj(D, p, t); t += DT; if (p.y <= 0) return { y: 0, x: p.x }; }
    return { y: p.y, x: p.x };
  }
  function cueCost(c) { var comp = COMPS.filter(function (q) { return q.id === c.comp; })[0]; return Math.round(KINDS[c.kind].cost * comp.price); }
  function compOf(id) { for (var i = 0; i < COMPS.length; i++) if (COMPS[i].id === id) return COMPS[i]; return COMPS[0]; }

  /* ---------- the night, simulated once and drawn as it goes ---------- */
  function Sim(D, cues) {
    this.D = D; this.t = 0; this.parts = []; this.proj = []; this.smoke = []; this.sticks = []; this.wheels = [];
    this.fx = [];         // what the drawing and the sound need to hear about
    var acts = [];
    cues.forEach(function (c, ci) {
      var lane = KINDS[c.kind].lane, r = rng(mix(D.seed, Math.round(c.tb * 1000) * 7 + lane));
      var jit = (r() - 0.5) * 4;
      if (c.kind === 'rocket') acts.push({ t: c.t0, a: 'launch', c: c, x: D.F + D.rk + jit, r: r });
      else if (c.kind === 'balloon') acts.push({ t: c.t0, a: 'launch', c: c, x: D.F - D.rk * 0.6 + jit, r: r });
      else if (c.kind === 'candle') for (var i = 0; i < KINDS.candle.shots; i++) acts.push({ t: c.t0 + i * KINDS.candle.gap, a: 'shot', c: c, x: D.F - 1 + jit * 0.5, r: r });
      else acts.push({ t: c.t0, a: 'wheel', c: c, x: D.F - D.rk * 1.8, r: r });
    });
    acts.sort(function (a, b) { return a.t - b.t; });
    this.acts = acts; this.ai = 0;
    this.end = D.T + 4;
    this.st = {
      breaks: [], onBeat: 0, onBar: 0, low: 0, blind: 0, crowdStars: 0, pavStars: 0, sticksCrowd: 0, fire: null,
      darkRun: 0, darkT: 0, longest: 0, longestAt: 0, fav: 0, favSum: 0, n: 0, series: [], veilSum: 0, veilN: 0, recent: [], lastComps: []
    };
  }
  Sim.prototype.veil = function (x, y) {
    var s = 0, S = this.smoke;
    for (var i = 0; i < S.length; i++) { var dx = x - S[i].x, dy = y - S[i].y; s += S[i].a * Math.exp(-(dx * dx + dy * dy) / (S[i].r * S[i].r)); }
    return clamp(s, 0, 0.75);
  };
  Sim.prototype.delight = function (base, t, x, y, comp, kind) {
    var D = this.D, st = this.st;
    var k = Math.round(t / D.beat), dd = Math.abs(t - k * D.beat), down = k % D.m === 0;
    var mb = 0.85;
    if (dd < 0.12) { mb = down ? 1.8 : 1.4; if (kind !== 'candle') { st.onBeat++; if (down) st.onBar++; } }
    else if (dd < 0.25) mb = 1.1;
    var fin = t > D.T * 0.85 && t <= D.T + 0.5;
    var nov = st.lastComps.indexOf(comp) < 0 ? 1.25 : 1;
    var same = st.lastComps.length >= 5 && st.lastComps.every(function (q) { return q === comp; }) ? 0.8 : 1;
    while (st.recent.length && st.recent[0] < t - 0.6) st.recent.shift();
    var n = st.recent.length; st.recent.push(t);
    var crowd = fin ? 1.3 : 1 / (1 + 0.35 * Math.max(0, n - 2));
    var hgt = y < 50 ? 0.5 : 1;
    var v = this.veil(x, y); st.veilSum += v; st.veilN++;
    var vis = Math.abs(x) > XMAX ? 0.4 : 1;
    if (kind !== 'candle') { st.lastComps.push(comp); if (st.lastComps.length > 5) st.lastComps.shift(); }
    var gain = base * mb * nov * same * crowd * hgt * (1 - v) * vis;
    if (t <= D.T + 3) st.fav += gain;
    return v;
  };
  Sim.prototype.burst = function (p, r) {
    var D = this.D, K = KINDS[p.kind], comp = compOf(p.c.comp), st = this.st;
    var v = this.delight(p.kind === 'balloon' ? 2.6 : 1, this.t, p.x, p.y, comp.id, p.kind);
    st.breaks.push({ t: this.t, x: p.x, y: p.y, kind: p.kind, veil: v });
    if (p.y < 50) st.low++;
    for (var i = 0; i < K.stars; i++) {
      var z = 2 * r() - 1, ph = 2 * Math.PI * r(), rr = Math.sqrt(1 - z * z), s = K.speed * (0.82 + 0.18 * r());
      this.parts.push({ x: p.x, y: p.y, vx: s * rr * Math.cos(ph) + p.vx * 0.3, vy: s * rr * Math.sin(ph) + p.vy * 0.3,
        life: comp.life * (0.85 + 0.3 * r()), k: 1.3, col: comp.col, big: p.kind === 'balloon' });
    }
    this.smoke.push({ x: p.x, y: p.y, r: p.kind === 'balloon' ? 14 : 8, a: p.kind === 'balloon' ? 0.5 : 0.28 });
    if (p.kind === 'rocket') this.sticks.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy * 0.4 });
    this.fx.push({ t: this.t, type: 'break', x: p.x, y: p.y, kind: p.kind, col: comp.col });
  };
  Sim.prototype.step = function () {
    var D = this.D, st = this.st, t = this.t, i;
    while (this.ai < this.acts.length && this.acts[this.ai].t <= t + 1e-9) {
      var a = this.acts[this.ai++];
      if (a.a === 'launch') {
        var p = newProj(D, a.c.kind, a.x, a.t, a.c.tb, a.r); p.c = a.c; p.r = a.r; this.proj.push(p);
        this.fx.push({ t: t, type: 'launch', x: a.x, kind: a.c.kind });
      } else if (a.a === 'shot') {
        var cc = compOf(a.c.comp);
        this.parts.push({ x: a.x, y: 3, vx: (a.r() - 0.5) * 3, vy: 29 + a.r() * 5, life: 2.3, k: 0.5, col: cc.col, big: true, candle: true });
        this.smoke.push({ x: a.x, y: 6, r: 5, a: 0.06 });
        this.delight(0.28, t, a.x, 25, cc.id, 'candle');
        this.fx.push({ t: t, type: 'shot', x: a.x });
      } else {
        this.wheels.push({ x: a.x, y: 7, t0: t, t1: t + KINDS.wheel.dur, col: compOf(a.c.comp).col, comp: a.c.comp });
      }
    }
    for (i = this.proj.length - 1; i >= 0; i--) {
      var q = this.proj[i];
      stepProj(D, q, t);
      if (t >= q.tb - 1e-9) { this.proj.splice(i, 1); if (q.y > 2) this.burst(q, q.r); else st.blind++; }
      else if (q.y <= 0 && q.vy < 0) { this.proj.splice(i, 1); st.blind++; }
    }
    for (i = this.parts.length - 1; i >= 0; i--) {
      var s = this.parts[i];
      s.vx += -s.k * (s.vx - D.wind) * DT; s.vy += (-G - s.k * s.vy) * DT;
      s.x += s.vx * DT; s.y += s.vy * DT; s.life -= DT;
      if (s.life <= 0) { this.parts.splice(i, 1); continue; }
      if (s.x >= D.P0 && s.x <= D.P1 && s.y <= D.PH) {
        this.parts.splice(i, 1); st.pavStars++;
        if (st.pavStars >= 12 && !st.fire) { st.fire = { t: t }; st.fav = Math.max(0, st.fav - 6); this.fx.push({ t: t, type: 'fire' }); }
        continue;
      }
      if (s.y <= 0) {
        this.parts.splice(i, 1);
        if (s.x >= D.C0 && s.x <= D.C1) { st.crowdStars++; st.fav = Math.max(0, st.fav - 0.8); }
      }
    }
    for (i = this.sticks.length - 1; i >= 0; i--) {
      var k = this.sticks[i];
      k.vx += -0.25 * (k.vx - D.wind) * DT; k.vy += (-G - 0.25 * k.vy) * DT; k.x += k.vx * DT; k.y += k.vy * DT;
      if (k.y <= 0) { this.sticks.splice(i, 1); if (k.x >= D.C0 && k.x <= D.C1) { st.sticksCrowd++; st.fav = Math.max(0, st.fav - 1.5); this.fx.push({ t: t, type: 'stick', x: k.x }); } }
    }
    var wl = 0;
    for (i = this.wheels.length - 1; i >= 0; i--) { var wh = this.wheels[i]; if (t > wh.t1) { this.wheels.splice(i, 1); continue; } wl++; }
    if (wl && t <= D.T + 3) { st.fav += 0.35 * DT * (wl > 1 ? 1.3 : 1); if (Math.floor(t * 2) !== Math.floor((t - DT) * 2)) this.smoke.push({ x: D.F - D.rk * 1.8, y: 10, r: 6, a: 0.03 }); }
    for (i = this.smoke.length - 1; i >= 0; i--) {
      var m = this.smoke[i], aw = Math.abs(D.wind);
      m.x += D.wind * DT; m.y += 0.4 * DT; m.r += (1.2 + 0.3 * aw) * DT; m.a *= Math.exp(-(0.025 + 0.03 * aw) * DT);
      if (m.a < 0.01 || Math.abs(m.x) > XMAX + 60) this.smoke.splice(i, 1);
    }
    var thrusting = false; for (i = 0; i < this.proj.length; i++) if (this.proj[i].kind === 'rocket' && t < this.proj[i].thrustEnd) thrusting = true;
    var lit = this.parts.length > 0 || wl > 0 || thrusting;
    if (t <= D.T) {
      if (lit) st.darkRun = 0;
      else { st.darkRun += DT; st.darkT += DT; if (st.darkRun > st.longest) { st.longest = st.darkRun; st.longestAt = t - st.darkRun; } }
    }
    if (!lit && st.darkRun > 2.5 && t <= D.T) st.fav = Math.max(0, st.fav - 0.4 * DT);
    if (st.fire) st.fav *= Math.exp(-0.5 * DT);
    st.fav *= Math.exp(-0.12 * DT);
    if (t <= D.T + 3) { st.favSum += st.fav; st.n++; }
    if (Math.floor(t * 4) !== Math.floor((t + DT) * 4)) st.series.push(st.fav);
    this.t = t + DT;
    return this.t < this.end;
  };
  Sim.prototype.lit = function () { return this.parts.length > 0 || this.wheels.length > 0; };
  function runSim(D, cues) { var s = new Sim(D, cues); while (s.step()) { s.fx.length = 0; } s.st.score = s.st.favSum / Math.max(1, s.st.n); return s.st; }

  /* ---------- the Master Pyrotechnist ---------- */
  function stickLand(D, fuse) { // where a rocket's stick comes down, lit from the rocket trough
    var p = newProj(D, 'rocket', D.F + D.rk, 0, fuse, function () { return 0.5; }), t = 0;
    while (t < fuse - 1e-9) { stepProj(D, p, t); t += DT; }
    var k = { x: p.x, y: p.y, vx: p.vx, vy: p.vy * 0.4 };
    while (k.y > 0) { k.vx += -0.25 * (k.vx - D.wind) * DT; k.vy += (-G - 0.25 * k.vy) * DT; k.x += k.vx * DT; k.y += k.vy * DT; }
    return k.x;
  }
  function bestFuse(D, kind) { // the highest break that the wind leaves inside the view, and (for a rocket) whose stick misses the company
    var h = D.heights[kind], b = -1;
    for (var i = 0; i < h.length; i++) {
      if (Math.abs(D.F + h[i].x) > XMAX - 20 || h[i].y < 40) continue;
      if (kind === 'rocket') { var xs = stickLand(D, KINDS.rocket.fuses[i]); if (xs > D.C0 - 8 && xs < D.C1 + 8) continue; }
      if (b < 0 || h[i].y > h[b].y + 0.5) b = i;
    }
    return b < 0 ? 0 : KINDS[kind].fuses[b];
  }
  function masterPlan(D) {
    // the programme is written in layers, the bones first and the flourishes last, and each layer goes in
    // whole or (if the purse runs short) every other piece of it, so that what is left is spread evenly
    var fr = bestFuse(D, 'rocket'), fb = bestFuse(D, 'balloon'), cols = D.avail.map(function (c) { return c.id; });
    var bar = D.m * D.beat, ci = 0, calm = Math.abs(D.wind) < 1.6, finBar = Math.floor(D.nb * 0.85), layers = [], b, q;
    function col() { var c = cols[ci % cols.length]; ci += cols.length > 2 ? 2 : 1; return c; }
    function cue(kind, tb, fuse, comp) {
      if (kind === 'rocket' && !fr) { kind = 'candle'; fuse = 0; tb -= 0.6; }   // no rocket tonight whose stick misses the company
      return { kind: kind, tb: tb, fuse: fuse || 0, t0: tb - (fuse || 0), comp: comp || col() };
    }
    function ok(c) { return c.t0 >= 0 && c.tb <= D.T + 1e-6; }
    var L1 = [cue('wheel', 0, 0, 'brilliant')], L2 = [], L3 = [], L4 = [], L5 = [], L6 = [], L7 = [];
    for (b = 0; b < finBar; b++) {
      var td = b * bar, mid = td + (D.m === 4 ? 2 : 1) * D.beat;
      if (b % 4 === 0 || (!calm && b % 2 === 0)) { var cb = cue('balloon', td, fb); (ok(cb) ? L1 : L2).push(ok(cb) ? cb : cue('rocket', td, fr)); }
      else L2.push(cue('rocket', td, fr));
      L4.push(cue('rocket', mid, fr));
      if (b % 8 === 4) L5.push(cue('candle', td, 0, D.avail.length > 3 ? 'red' : 'gold'));
      if (!calm && b % 2 === 1) L6.push(cue('balloon', td, fb));
    }
    for (b = finBar; b < D.nb; b++) for (q = 0; q < D.m; q++) {
      var tq = b * bar + q * D.beat;
      (q === 0 ? L3 : L7).push(cue('balloon', tq, fb));
      L4.push(cue('rocket', tq + D.beat / 2, fr));
    }
    L3.push(cue('balloon', (D.nb - 1) * bar, fb), cue('balloon', (D.nb - 1) * bar, fb));
    L5.push(cue('wheel', Math.round(D.nb / 2) * bar, 0, 'gold'));
    layers = [L1, L2, L3, L4, L5, L6, L7];
    var spent = 0, out = [];
    layers.forEach(function (L) {
      L = L.filter(ok);
      var cost = L.reduce(function (a, c) { return a + cueCost(c); }, 0);
      var take = spent + cost <= D.budget ? L : L.filter(function (c, i) { return i % 2 === 0; });
      take.forEach(function (c) { var k = cueCost(c); if (spent + k <= D.budget) { spent += k; out.push(c); } });
    });
    return out;
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { buildDay: buildDay, runSim: runSim, masterPlan: masterPlan, cueCost: cueCost, KINDS: KINDS };
    return;
  }

  /* ================================================================== the page ================ */
  function $(id) { return document.getElementById(id); }
  var cv = $('sky'), cx = cv.getContext('2d'), sv = $('score'), sx = sv.getContext('2d');
  var D, cues, dayOff = 0, comp = 'gold', fuse = { rocket: 3, balloon: 2 }, snap = true, sound = true;
  var anim = null, sim = null, finished = false, hover = null, showing = 'yours', mine = null, master = null;
  var ac = null, out = null, t0Audio = 0, listenStart = null;

  function spent() { var s = 0; for (var i = 0; i < cues.length; i++) s += cueCost(cues[i]); return s; }
  function say(s) { $('msg').textContent = s || ''; }

  function load() {
    stopAll();
    D = buildDay(dayOff); cues = []; finished = false; showing = 'yours'; mine = null;
    master = { cues: masterPlan(D) }; master.st = runSim(D, master.cues);
    if (!D.avail.some(function (c) { return c.id === comp; })) comp = 'gold';
    var d = D.date;
    $('plWho').textContent = D.garden.name + ' · ' + WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + D.year;
    $('plName').textContent = 'A ' + D.form.n + ' in ' + D.key[0] + (D.minor ? ' minor' : ' major') + ', and ' + money(D.budget) + ' to spend';
    var wdir = D.wind === 0 ? '' : (D.wind > 0) === D.crowdLeft ? ', blowing from the company towards the orchestra' : ', blowing from the orchestra over the company';
    $('plBlurb').innerHTML = 'The proprietor of ' + D.garden.name + ' ' + D.garden.where + ' has a display ' + D.occasion + '. The band in the orchestra will play a ' + D.form.n +
      ' of <b>' + D.nb + ' bars</b>, and the fireworks are to go with it. The night has <b>' + beaufort(D.wind) + '</b>' + wdir + '. ' +
      (Math.abs(D.wind) < 1.6 ? 'In air this still the smoke of every break will hang where it was made. ' : '') +
      'The company stands on the lawn to the ' + (D.crowdLeft ? 'west' : 'east') + ' of the firing frame; the orchestra is a wooden building ' + Math.round(Math.abs((D.P0 + D.P1) / 2 - D.F) * 1.094) + ' yards the other way, and it will burn. ' +
      (D.year < 1830 ? 'It is ' + D.year + ', so the stars come in gold, silver and Chinese fire and nothing else.' : 'The new chlorate colours have come in: ' + D.avail.slice(3).map(function (c) { return c.name.toLowerCase(); }).join(', ') + '.');
    var R = [['Bars', D.nb + ' in ' + D.m + '/4'], ['Tempo', D.bpm + ' a minute'], ['Length', Math.round(D.T) + ' s'], ['Wind', Math.round(Math.abs(D.wind) * 2.237) + ' mph ' + (D.wind >= 0 ? 'east' : 'west') + 'ward'], ['Purse', money(D.budget)]];
    $('rules').innerHTML = R.map(function (q) { return '<span>' + q[0] + ' <b>' + q[1] + '</b></span>'; }).join('');
    $('dayOut').textContent = (dayOff === 0 ? 'Tonight' : dayOff === -1 ? 'Last night' : dayOff === 1 ? 'Tomorrow night' : dayOff < 0 ? (-dayOff) + ' nights ago' : 'In ' + dayOff + ' nights') + ' · ' + D.garden.name + ', ' + D.year;
    buildChips();
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict'; $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    setBusy(false);
    say('Click a lane of the score where a piece should break. Rockets and balloons are lit a fuse earlier, so the dot is the launch and the diamond is the break. Click a piece again to take it off.');
    drawScene(null); drawScore();
  }

  function buildChips() {
    $('comps').innerHTML = COMPS.map(function (c) {
      var ok = D.year >= c.from;
      return '<button class="chip' + (c.id === comp ? ' on' : '') + '" type="button" data-comp="' + c.id + '"' + (ok ? '' : ' disabled title="Not until about ' + c.from + '"') +
        '><i class="sw" style="background:rgb(' + c.col.join(',') + ')"></i>' + c.name + (ok ? '' : ' · ' + c.from) + '</button>';
    }).join('');
    ['rocket', 'balloon'].forEach(function (k) {
      $('fz-' + k).innerHTML = KINDS[k].fuses.map(function (fz, i) {
        var h = D.heights[k][i];
        return '<button class="chip' + (i === fuse[k] ? ' on' : '') + '" type="button" data-k="' + k + '" data-i="' + i + '">' + fz.toFixed(1) + ' s · ' + (h.y > 0 ? Math.round(h.y * FT / 10) * 10 + ' ft' : 'on the ground') + '</button>';
      }).join('');
    });
    $('btnSnap').textContent = snap ? 'Breaks snap to the half beat' : 'Breaks go where you click';
    $('btnSnap').classList.toggle('on', snap);
    $('btnSound').textContent = sound ? 'Sound on' : 'Sound off';
    $('btnSound').classList.toggle('on', sound);
    purse();
  }
  function purse() {
    var s = spent();
    $('purse').innerHTML = 'Laid out <b>' + money(s) + '</b> of ' + money(D.budget) + ' · ' + cues.length + ' piece' + (cues.length === 1 ? '' : 's') +
      ' · prices: rocket ' + KINDS.rocket.cost + 's, balloon ' + KINDS.balloon.cost + 's, candle ' + KINDS.candle.cost + 's, wheel ' + KINDS.wheel.cost + 's, the coloured stars dearer';
  }

  /* ---------- the score ---------- */
  var SL = 92, SR = 712, ST = 30, LH = 36;
  function TX(t) { return SL + (SR - SL) * t / D.T; }
  function XT(x) { return (x - SL) / (SR - SL) * D.T; }
  function drawScore(playhead) {
    var c = sx, i;
    c.clearRect(0, 0, sv.width, sv.height);
    c.fillStyle = '#0e131b'; c.fillRect(0, 0, sv.width, sv.height);
    c.font = '11px ui-monospace,Menlo,monospace'; c.textBaseline = 'middle';
    for (i = 0; i < 4; i++) {
      c.fillStyle = i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.05)'; c.fillRect(SL, ST + i * LH, SR - SL, LH);
      c.fillStyle = '#8b97ab'; c.textAlign = 'right'; c.fillText(['Rockets', 'Balloons', 'Candles', 'Wheel'][i], SL - 8, ST + i * LH + LH / 2);
    }
    var nbeats = D.nb * D.m;
    for (i = 0; i <= nbeats; i++) {
      var x = TX(i * D.beat), down = i % D.m === 0;
      c.strokeStyle = down ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 0.5, ST - (down ? 6 : 0)); c.lineTo(x + 0.5, ST + 4 * LH); c.stroke();
      var bn = i / D.m;
      if (down && bn < D.nb && (D.nb <= 32 || bn % 2 === 0)) { c.fillStyle = '#8b97ab'; c.textAlign = 'left'; c.fillText(String(bn + 1), x + 3, ST - 12); }
    }
    c.fillStyle = 'rgba(255,206,106,.08)'; c.fillRect(TX(D.T * 0.85), ST, SR - TX(D.T * 0.85), 4 * LH);
    c.fillStyle = '#ffce6a'; c.textAlign = 'right'; c.fillText('finale', SR - 2, ST + 4 * LH + 12);
    c.fillStyle = '#8b97ab'; c.textAlign = 'left'; c.fillText('bar', SL - 30, ST - 12);
    var list = showing === 'master' ? master.cues : cues;
    for (i = 0; i < list.length; i++) drawCue(list[i], 1);
    if (hover && !anim && !finished) drawCue(hover, 0.4);
    if (playhead != null) {
      var px = TX(Math.min(playhead, D.T));
      c.strokeStyle = '#64f0c8'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, ST - 8); c.lineTo(px, ST + 4 * LH + 4); c.stroke();
    }
  }
  function drawCue(q, alpha) {
    var c = sx, lane = KINDS[q.kind].lane, y = ST + lane * LH + LH / 2, col = compOf(q.comp).col;
    var rgb = 'rgba(' + col.join(',') + ',' + alpha + ')';
    c.strokeStyle = rgb; c.fillStyle = rgb; c.lineWidth = 2;
    if (q.kind === 'rocket' || q.kind === 'balloon') {
      var a = TX(q.t0), b = TX(q.tb);
      c.beginPath(); c.moveTo(a, y + 7); c.lineTo(b, y - 5); c.stroke();
      c.beginPath(); c.arc(a, y + 7, 2.5, 0, 7); c.fill();
      var s = q.kind === 'balloon' ? 7 : 5;
      c.beginPath(); c.moveTo(b, y - 5 - s); c.lineTo(b + s, y - 5); c.lineTo(b, y - 5 + s); c.lineTo(b - s, y - 5); c.closePath(); c.fill();
    } else {
      var d = KINDS[q.kind].dur, x0 = TX(q.t0), x1 = TX(Math.min(D.T + 4, q.t0 + d));
      c.globalAlpha = alpha * 0.55; c.fillRect(x0, y - 7, x1 - x0, 14); c.globalAlpha = 1;
      c.fillRect(x0 - 1, y - 9, 3, 18);
    }
  }
  function scorePos(e) {
    var r = sv.getBoundingClientRect(), mx = (e.clientX - r.left) * sv.width / r.width, my = (e.clientY - r.top) * sv.height / r.height;
    var lane = Math.floor((my - ST) / LH);
    if (lane < 0 || lane > 3 || mx < SL - 4 || mx > SR + 4) return null;
    var kind = LANES[lane], t = clamp(XT(mx), 0, D.T);
    if (snap) t = Math.round(t / (D.beat / 2)) * (D.beat / 2);
    var fz = kind === 'rocket' || kind === 'balloon' ? KINDS[kind].fuses[fuse[kind]] : 0;
    return { kind: kind, tb: t, fuse: fz, t0: t - fz, comp: comp, mx: mx };
  }
  function nearCue(p) {
    for (var i = cues.length - 1; i >= 0; i--) if (cues[i].kind === p.kind) {
      var x = cues[i].kind === 'rocket' || cues[i].kind === 'balloon' ? TX(cues[i].tb) : TX(cues[i].t0);
      if (Math.abs(x - p.mx) < 7) return i;
    }
    return -1;
  }
  sv.addEventListener('mousemove', function (e) {
    if (anim || finished) return;
    var p = scorePos(e); hover = p && nearCue(p) < 0 && p.t0 >= 0 ? p : null; drawScore();
  });
  sv.addEventListener('mouseleave', function () { hover = null; if (!anim) drawScore(); });
  sv.addEventListener('click', function (e) {
    if (anim || finished) return;
    var p = scorePos(e); if (!p) return;
    if (showing !== 'yours') { showing = 'yours'; drawScore(); }
    var k = nearCue(p);
    if (k >= 0) { var gone = cues.splice(k, 1)[0]; say('Took off a ' + KINDS[gone.kind].name.toLowerCase() + '.'); }
    else if (p.t0 < 0) { say('That would have to be lit ' + f1(-p.t0) + ' s before the band starts. Use a shorter fuse, or break it later.'); return; }
    else if (p.tb > D.T + 0.01) { say('The band has finished by then.'); return; }
    else if (spent() + cueCost(p) > D.budget) { say('The proprietor will not run to it: that piece costs ' + cueCost(p) + 's and there is ' + money(D.budget - spent()) + ' left.'); return; }
    else {
      delete p.mx; cues.push(p);
      var h = p.kind === 'rocket' || p.kind === 'balloon' ? D.heights[p.kind][fuse[p.kind]].y : 0;
      say(KINDS[p.kind].name + ' of ' + compOf(p.comp).name.toLowerCase() + (p.fuse ? ', lit at ' + f1(p.t0) + ' s to break at ' + f1(p.tb) + ' s, about ' + Math.round(h * FT / 10) * 10 + ' ft up.' : ', lit at ' + f1(p.t0) + ' s.'));
    }
    hover = null; purse(); drawScore(); drawScene(null);
  });

  /* ---------- the garden at night ---------- */
  var glow = 0, glowCol = [255, 200, 120], sparks = [], rsp = rng(1), fireAt = null;
  function drawGround(c) {
    var i, L = glow, gc = function (base) { return 'rgb(' + base.map(function (v, k) { return Math.round(v + glowCol[k] * L * 0.10); }).join(',') + ')'; };
    c.fillStyle = gc([6, 9, 12]);
    c.beginPath(); c.moveTo(0, GY);
    for (i = 0; i < D.trees.length; i++) { var tr = D.trees[i]; c.quadraticCurveTo(tr[0] - tr[2], GY - tr[1] - 8, tr[0], GY - tr[1]); c.quadraticCurveTo(tr[0] + tr[2], GY - tr[1] - 6, tr[0] + tr[2] * 1.4, GY - tr[1] * 0.4); }
    c.lineTo(W, GY); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    c.fillStyle = gc([9, 14, 12]); c.fillRect(0, GY, W, H - GY);
    // the orchestra
    var x0 = PX(D.P0), x1 = PX(D.P1), yh = PY(D.PH);
    c.fillStyle = gc([16, 18, 22]); c.fillRect(x0, yh, x1 - x0, GY - yh);
    c.beginPath(); c.moveTo(x0 - 4, yh); c.lineTo((x0 + x1) / 2, yh - 16); c.lineTo(x1 + 4, yh); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,214,140,' + (fireAt != null ? 0.9 : 0.55) + ')';
    for (i = 0; i < 5; i++) c.fillRect(x0 + 6 + i * (x1 - x0 - 12) / 5, GY - 22, 4, 10);
    if (fireAt != null) {
      for (i = 0; i < 14; i++) { var fxp = x0 + rsp() * (x1 - x0), fh = 10 + rsp() * 40; c.fillStyle = 'rgba(255,' + Math.round(90 + rsp() * 100) + ',40,' + (0.25 + rsp() * 0.4) + ')'; c.beginPath(); c.ellipse(fxp, yh - fh / 3, 5 + rsp() * 6, fh, 0, 0, 7); c.fill(); }
    }
    // the firing frame
    var fx = PX(D.F);
    c.strokeStyle = gc([40, 34, 28]); c.lineWidth = 2;
    var wx = PX(D.F - D.rk * 1.8), ex = PX(D.F + D.rk * 1.3);
    c.beginPath(); c.moveTo(wx, GY); c.lineTo(wx, PY(7)); c.moveTo(Math.min(wx, ex), GY - 18); c.lineTo(Math.max(wx, ex), GY - 18);
    c.moveTo(ex, GY); c.lineTo(ex, GY - 18); c.moveTo(fx, GY); c.lineTo(fx, GY - 18); c.stroke();
    c.beginPath(); c.arc(wx, PY(7), 5, 0, 7); c.stroke();
    // the company
    var cA = PX(D.C0), cB = PX(D.C1), r2 = rng(mix(D.seed, 9));
    c.fillStyle = gc([3, 4, 7]);
    for (var x = Math.max(cA, 0); x < Math.min(cB, W); x += 5 + r2() * 3) {
      var hh = 9 + r2() * 5, yb = GY + 6 + r2() * 26;
      c.beginPath(); c.arc(x, yb - hh, 2.6, 0, 7); c.fill(); c.fillRect(x - 2.6, yb - hh + 2, 5.2, hh);
      if (r2() < 0.25) { c.beginPath(); c.ellipse(x, yb - hh - 2, 5, 1.4, 0, 0, 7); c.fill(); }
    }
    c.fillStyle = '#8b97ab'; c.font = '11px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText('the company', clamp((Math.max(cA, 0) + Math.min(cB, W)) / 2, 50, W - 50), H - 4);
    c.fillText('the orchestra', (x0 + x1) / 2, yh - 22);
    c.fillText('frame', fx + 6, GY + 14);
    // a vane on the frame
    var wv = clamp(D.wind / 7.5, -1, 1);
    c.strokeStyle = '#8b97ab'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx - 22, GY - 18); c.lineTo(fx - 22, GY - 34); c.stroke();
    c.fillStyle = '#c9a76a'; c.beginPath(); c.moveTo(fx - 22, GY - 34); c.lineTo(fx - 22 + 14 * wv, GY - 32); c.lineTo(fx - 22, GY - 29); c.closePath(); c.fill();
  }
  function drawScene(s) {
    var c = cx, i;
    if (!s) {
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#04060d'; c.fillRect(0, 0, W, H);
      for (i = 0; i < D.sky.length; i++) { c.fillStyle = 'rgba(220,230,255,' + D.sky[i][2] * 0.6 + ')'; c.fillRect(D.sky[i][0], D.sky[i][1], 1.2, 1.2); }
      // where today's pieces would break, for planning
      c.font = '10px ui-monospace,Menlo,monospace'; c.textAlign = 'left';
      ['rocket', 'balloon'].forEach(function (k, j) {
        var bx = D.F + (k === 'rocket' ? D.rk : -D.rk * 0.6);
        D.heights[k].forEach(function (h, n) {
          if (h.y <= 0) return;
          var on = n === fuse[k];
          c.strokeStyle = on ? (k === 'rocket' ? 'rgba(122,162,255,.7)' : 'rgba(100,240,200,.7)') : 'rgba(139,151,171,.22)';
          c.setLineDash(on ? [] : [3, 4]); c.beginPath(); c.arc(PX(bx + h.x), PY(h.y), (k === 'rocket' ? 13 : 22) * SC * 0.9, 0, 7); c.stroke(); c.setLineDash([]);
          if (on) { c.fillStyle = c.strokeStyle; c.fillText((k === 'rocket' ? 'rocket ' : 'balloon ') + Math.round(h.y * FT / 10) * 10 + ' ft', PX(bx + h.x) + (k === 'rocket' ? -96 : 52), PY(h.y) + 3); }
        });
      });
      glow = 0; drawGround(c); return;
    }
    // trails: fade what was there
    c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(4,6,13,0.24)'; c.fillRect(0, 0, W, GY);
    for (i = 0; i < D.sky.length; i += 3) { c.fillStyle = 'rgba(220,230,255,' + D.sky[i][2] * 0.25 + ')'; c.fillRect(D.sky[i][0], D.sky[i][1], 1.2, 1.2); }
    // smoke, lit by whatever is burning
    for (i = 0; i < s.smoke.length; i++) {
      var m = s.smoke[i], g = c.createRadialGradient(PX(m.x), PY(m.y), 0, PX(m.x), PY(m.y), m.r * SC);
      var lv = 40 + glow * 90;
      g.addColorStop(0, 'rgba(' + Math.round(lv + glowCol[0] * glow * 0.2) + ',' + Math.round(lv + glowCol[1] * glow * 0.15) + ',' + Math.round(lv + 10) + ',' + (m.a * 0.22) + ')');
      g.addColorStop(1, 'rgba(60,60,70,0)'); c.fillStyle = g; c.fillRect(PX(m.x) - m.r * SC, PY(m.y) - m.r * SC, 2 * m.r * SC, 2 * m.r * SC);
    }
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < s.proj.length; i++) {
      var p = s.proj[i];
      if (p.kind === 'rocket') { c.strokeStyle = 'rgba(255,190,110,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(PX(p.x), PY(p.y)); c.lineTo(PX(p.x - p.vx * 0.06), PY(p.y - p.vy * 0.06)); c.stroke(); }
      else { c.fillStyle = 'rgba(255,170,90,.5)'; c.fillRect(PX(p.x) - 1, PY(p.y) - 1, 2, 2); }
    }
    for (i = 0; i < s.parts.length; i++) {
      var q = s.parts[i], a = clamp(q.life / 0.6, 0, 1), col = q.col, flick = 0.75 + 0.25 * Math.sin(q.life * 37 + i);
      c.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (a * flick) + ')';
      var sz = q.big ? 2.4 : 1.8; c.fillRect(PX(q.x) - sz / 2, PY(q.y) - sz / 2, sz, sz);
    }
    // wheels: sparks for the eye only
    for (i = 0; i < s.wheels.length; i++) {
      var wh = s.wheels[i], ang = (s.t - wh.t0) * 9;
      for (var n = 0; n < 6; n++) { var aa = ang + n * Math.PI / 3 + rsp() * 0.3, sp = 8 + rsp() * 7; sparks.push({ x: wh.x + Math.cos(aa) * 2, y: wh.y + Math.sin(aa) * 2, vx: -Math.sin(aa) * sp, vy: Math.cos(aa) * sp, l: 0.5 + rsp() * 0.4, col: wh.col }); }
    }
    for (i = sparks.length - 1; i >= 0; i--) {
      var k = sparks[i]; k.vy -= G * DT * 0.6; k.x += k.vx * DT; k.y += k.vy * DT; k.l -= DT;
      if (k.l <= 0 || k.y < 0) { sparks.splice(i, 1); continue; }
      c.fillStyle = 'rgba(' + k.col.join(',') + ',' + clamp(k.l * 2, 0, 1) + ')'; c.fillRect(PX(k.x), PY(k.y), 1.5, 1.5);
    }
    // flashes
    for (i = 0; i < s.fx.length; i++) if (s.fx[i].type === 'break') {
      var b = s.fx[i], fg = c.createRadialGradient(PX(b.x), PY(b.y), 0, PX(b.x), PY(b.y), b.kind === 'balloon' ? 120 : 70);
      fg.addColorStop(0, 'rgba(' + b.col.join(',') + ',.35)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = fg; c.fillRect(0, 0, W, GY);
      glow = Math.min(1.4, glow + (b.kind === 'balloon' ? 0.9 : 0.5)); glowCol = b.col;
    }
    c.globalCompositeOperation = 'source-over';
    glow *= Math.exp(-3 * DT * 2);
    drawGround(c);
  }

  /* ---------- sound ---------- */
  function audio() {
    if (!sound) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { return null; }
    if (out) { try { out.disconnect(); } catch (e) {} }
    out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
    return ac;
  }
  function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function tone(t, d, f, type, vol, lp) {
    var o = ac.createOscillator(), g = ac.createGain(), node = o;
    o.type = type; o.frequency.value = f;
    if (lp) { var fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.08, d));
    node.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
  }
  var noiseBuf = null;
  function bang(t, dist, size) {
    if (!ac || !out) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); var ch = noiseBuf.getChannelData(0), r = rng(3); for (var i = 0; i < ch.length; i++) ch[i] = r() * 2 - 1; }
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = size > 1 ? 380 : 700;
    var v = clamp(60 / Math.max(30, dist), 0.08, 0.9) * (size > 1 ? 1 : 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + (size > 1 ? 1.1 : 0.6));
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 1.3);
  }
  function playTune(at) {
    var T = D.tune, i;
    for (i = 0; i < T.notes.length; i++) { var n = T.notes[i]; tone(at + n.t, n.d, hz(n.n), 'triangle', 0.10); tone(at + n.t, n.d, hz(n.n), 'sawtooth', 0.025, 1800); }
    for (i = 0; i < T.bass.length; i++) tone(at + T.bass[i].t, T.bass[i].d * 0.9, hz(T.bass[i].n), 'triangle', 0.12);
    for (i = 0; i < T.timp.length; i++) { var tp = T.timp[i]; tone(at + tp.t, 0.9, hz(tp.n), 'sine', 0.22); }
  }
  function stopSound() { if (out) { try { out.gain.setTargetAtTime(0, ac.currentTime, 0.05); } catch (e) {} out = null; } }

  /* ---------- firing ---------- */
  function setBusy(b) {
    $('btnFire').disabled = b || finished; $('btnListen').disabled = b && !listenStart; $('btnUndo').disabled = b || finished; $('btnClear').disabled = b || finished;
    $('btnSkip').style.display = b && sim ? '' : 'none';
    $('btnListen').textContent = listenStart != null ? 'Stop the band' : 'Listen to the band';
  }
  function stopAll() {
    if (anim) cancelAnimationFrame(anim); anim = null; sim = null; listenStart = null; stopSound(); sparks = []; fireAt = null;
  }
  function fire(list, who) {
    stopAll(); finished = false; showing = who;
    sim = new Sim(D, list); fireAt = null;
    var a = audio(); t0Audio = a ? a.currentTime + 0.15 : 0;
    if (a) playTune(t0Audio);
    var start = performance.now() + 150, steps = 0;
    cx.fillStyle = '#04060d'; cx.fillRect(0, 0, W, H);
    setBusy(true);
    say(who === 'master' ? 'The Master Pyrotechnist’s programme for the same night, under the same wind.' : 'The band strikes up.');
    function frame(now) {
      var want = Math.floor((now - start) / 1000 / DT), more = true;
      sim.fx.length = 0;
      while (steps < want && more) { more = sim.step(); steps++; }
      for (var i = 0; i < sim.fx.length; i++) {
        var e = sim.fx[i];
        if (e.type === 'break' && ac && out) bang(t0Audio + e.t + Math.hypot(e.x - D.Xc, e.y) / SOUND, Math.hypot(e.x - D.Xc, e.y), e.kind === 'balloon' ? 2 : 1);
        if (e.type === 'launch' && e.kind === 'balloon' && ac && out) bang(t0Audio + e.t + Math.abs(e.x - D.Xc) / SOUND, Math.abs(e.x - D.Xc) * 2.5, 2);
        if (e.type === 'fire') { fireAt = e.t; stopSound(); say('The orchestra has caught. The band has stopped playing and is coming down the steps.'); }
        if (e.type === 'stick') say('A rocket stick has come down among the company.');
      }
      drawScene(sim); drawScore(sim.t);
      if (!more) { finish(who); return; }
      anim = requestAnimationFrame(frame);
    }
    anim = requestAnimationFrame(frame);
  }
  function finish(who) {
    var st;
    if (sim) { while (sim.step()) { sim.fx.length = 0; } st = sim.st; st.score = st.favSum / Math.max(1, st.n); }
    if (anim) cancelAnimationFrame(anim); anim = null; sim = null;
    if (who === 'master') { master.st = st || master.st; } else { mine = { cues: cues.slice(), st: st }; finished = true; }
    setBusy(false); notice(who); drawScore();
  }

  /* ---------- the next morning's paper ---------- */
  function notice(who) {
    var me = who === 'master' ? master : mine, st = me.st, ms = master.st, list = me.cues;
    var n = st.breaks.length, beatPct = n ? Math.round(100 * st.onBeat / n) : 0;
    var V = $('verdict'), h = '';
    var ratio = st.score / Math.max(0.01, ms.score);
    V.className = 'verdict ' + (st.fire || st.sticksCrowd > 1 || ratio < 0.6 ? 'warn' : ratio > 0.85 ? 'good' : '');
    h += '<p><b>' + (who === 'master' ? 'Had the Master Pyrotechnist fired it. ' : '') + 'From the next morning’s paper. —</b> ';
    h += 'Last night at ' + D.garden.name + ', ' + D.occasion + ', the company was entertained with a display of fireworks to a ' + D.form.n + ' by the band. ';
    if (!list.length) h += 'Nothing went up. The company waited a long while in the dark and then went in to supper. ';
    else {
      h += (n === 1 ? 'There was one break' : 'There were ' + n + ' breaks') + ' in the air' + (st.blind ? ', and ' + words(st.blind) + ' piece' + (st.blind > 1 ? 's' : '') + ' went up blind' : '') + '. ';
      if (beatPct >= 60) h += 'They broke so exactly with the music that the band seemed to be playing the fireworks. ';
      else if (beatPct >= 30) h += 'A good many of them broke with the music. ';
      else h += 'The fireworks and the band went their own ways all evening. ';
      if (st.longest > 6) h += 'About bar ' + (Math.floor(st.longestAt / (D.m * D.beat)) + 1) + ' there was a pause of ' + Math.round(st.longest) + ' seconds in the dark in which the company began to talk among themselves. ';
      var vm = st.veilN ? st.veilSum / st.veilN : 0;
      if (vm > 0.22) h += (Math.abs(D.wind) < 1.6 ? 'The air was so still that the smoke' : 'The smoke') + ' hung over the frame, and the later pieces were seen through it as through a curtain. ';
      if (st.low > 2) h += words(st.low).replace(/^./, function (c) { return c.toUpperCase(); }) + ' pieces broke so low that the ladies drew back. ';
      if (st.sticksCrowd) h += (st.sticksCrowd === 1 ? 'A rocket stick' : words(st.sticksCrowd).replace(/^./, function (c) { return c.toUpperCase(); }) + ' rocket sticks') + ' came down among the company. ';
      if (st.crowdStars > 3) h += 'Burning stars fell on the lawn among the spectators. ';
      if (st.fire) h += '<b>The orchestra caught fire</b> at ' + Math.round(st.fire.t) + ' seconds, as the Royal Fireworks’ pavilion in Green Park did in 1749, and the band left off playing. ';
      var fin = st.series.slice(Math.floor(st.series.length * 0.82)), pk = Math.max.apply(null, fin.concat([0])), av = st.series.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, st.series.length);
      h += pk > av * 2 ? 'The finale was a blaze, and the applause went on after the band had finished. ' : pk > av * 1.3 ? 'The finale was handsome. ' : 'The piece ended rather than finished. ';
    }
    h += '</p><p>The company’s favour, averaged over the evening: <b>' + f1(st.score) + '</b>' + (who === 'master' ? '.' : '; the Master Pyrotechnist’s programme for the same night would have drawn <b>' + f1(ms.score) + '</b>.') +
      ' Laid out ' + money(list.reduce(function (a, c) { return a + cueCost(c); }, 0)) + ' of ' + money(D.budget) + '.</p>';
    V.innerHTML = h;
    reveal(who);
  }
  function reveal(who) {
    var A = (who === 'master' ? master : mine).st, B = master.st, Wd = 720, Hh = 200, L = 40, R = 12, Tp = 26, Bt = 26;
    var len = Math.max(A.series.length, B.series.length), top = Math.max.apply(null, A.series.concat(B.series).concat([1])) * 1.08;
    function X(i) { return L + (Wd - L - R) * i / Math.max(1, len - 1); }
    function Y(v) { return Hh - Bt - (Hh - Tp - Bt) * v / top; }
    var s = '<h5>The company’s favour through the evening</h5><svg class="bars" viewBox="0 0 ' + Wd + ' ' + Hh + '" role="img" aria-label="The company’s favour over the evening, your programme against the Master Pyrotechnist’s">';
    for (var b = 0; b <= D.nb; b += D.nb > 32 ? 8 : 4) { var xb = X(b * D.m * D.beat * 4); s += '<line x1="' + xb + '" x2="' + xb + '" y1="' + Tp + '" y2="' + (Hh - Bt) + '" stroke="rgba(255,255,255,.07)"/><text x="' + xb + '" y="' + (Hh - 8) + '" text-anchor="middle">' + (b + 1) + '</text>'; }
    s += '<text x="' + (Wd - R) + '" y="' + (Hh - 8) + '" text-anchor="end">bar</text>';
    function path(ser, col, fill) {
      var d = 'M' + X(0) + ' ' + Y(0);
      for (var i = 0; i < ser.length; i++) d += 'L' + X(i).toFixed(1) + ' ' + Y(ser[i]).toFixed(1);
      d += 'L' + X(ser.length - 1).toFixed(1) + ' ' + Y(0) + 'Z';
      return '<path d="' + d + '" fill="' + fill + '" stroke="' + col + '" stroke-width="1.6"/>';
    }
    if (who !== 'master') s += path(B.series, '#ffce6a', 'none');
    s += path(A.series, '#64f0c8', 'rgba(100,240,200,.10)');
    s += '<text x="' + (Wd - R) + '" y="14" text-anchor="end"><tspan fill="#64f0c8">— ' + (who === 'master' ? 'the Master’s programme' : 'your programme') + '</tspan>' + (who !== 'master' ? '  <tspan fill="#ffce6a">— the Master Pyrotechnist’s</tspan>' : '') + '</text></svg>';
    function row(k, a, b, bad) { return '<tr><td>' + k + '</td><td' + (bad ? ' class="bad"' : '') + '>' + a + '</td><td>' + b + '</td></tr>'; }
    function pct(st) { return st.breaks.length ? Math.round(100 * st.onBeat / st.breaks.length) + '%' : '—'; }
    function veil(st) { return st.veilN ? Math.round(100 * st.veilSum / st.veilN) + '%' : '—'; }
    s += '<div class="tablewrap" style="margin-top:12px"><table><tr><th></th><th>' + (who === 'master' ? 'The Master' : 'Yours') + '</th><th>The Master</th></tr>' +
      row('Breaks in the air', A.breaks.length, B.breaks.length) +
      row('Broke on a beat (on a bar line)', pct(A) + ' (' + A.onBar + ')', pct(B) + ' (' + B.onBar + ')') +
      row('Longest dark', f1(A.longest) + ' s', f1(B.longest) + ' s', A.longest > 6) +
      row('Seen through smoke, on average', veil(A), veil(B), A.veilN && A.veilSum / A.veilN > 0.22) +
      row('Broke under 160 ft', A.low, B.low, A.low > 2) +
      row('Sticks and stars among the company', A.sticksCrowd + ' / ' + A.crowdStars, B.sticksCrowd + ' / ' + B.crowdStars, A.sticksCrowd > 0) +
      row('Stars on the orchestra roof', A.pavStars + (A.fire ? ' (fire)' : ''), B.pavStars + (B.fire ? ' (fire)' : ''), !!A.fire) +
      row('Favour, averaged', f1(A.score), f1(B.score)) + '</table></div>';
    var noRk = !bestFuse(D, 'rocket');
    s += '<p>The Master Pyrotechnist breaks a balloon on the first beat of ' + (Math.abs(D.wind) < 1.6 ? 'every fourth bar, because tonight the smoke will not clear,' : 'every other bar') +
      (noRk ? ' and fires Roman candles between, because tonight every rocket stick would come down among the company,' : ' and rockets between,') +
      ' all on fuses chosen for the highest break the wind leaves in view, opens with a wheel, and keeps the last ' + Math.round(D.nb * 0.15) + ' bars for a finale on every beat. It is a rule, not genius: a programme that breaks more on the beat, varies its stars and keeps out of its own smoke can beat it.</p>';
    $('reveal').innerHTML = s; $('reveal').style.display = '';
  }

  /* ---------- wiring ---------- */
  $('comps').addEventListener('click', function (e) { var b = e.target.closest('[data-comp]'); if (b && !b.disabled) { comp = b.getAttribute('data-comp'); buildChips(); } });
  ['rocket', 'balloon'].forEach(function (k) {
    $('fz-' + k).addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) { fuse[k] = +b.getAttribute('data-i'); buildChips(); if (!anim) drawScene(null); } });
  });
  $('btnSnap').addEventListener('click', function () { snap = !snap; buildChips(); });
  $('btnSound').addEventListener('click', function () { sound = !sound; if (!sound) stopSound(); buildChips(); });
  $('btnUndo').addEventListener('click', function () { if (!finished && !anim && cues.length) { cues.pop(); purse(); drawScore(); } });
  $('btnClear').addEventListener('click', function () { if (!finished && !anim) { cues = []; purse(); drawScore(); say('The score is clean.'); } });
  $('btnFire').addEventListener('click', function () {
    if (finished || anim) return;
    if (!cues.length) { say('There is nothing on the score yet. Click a lane to put a piece where it should break.'); return; }
    fire(cues, 'yours');
  });
  $('btnListen').addEventListener('click', function () {
    if (listenStart != null) { stopAll(); setBusy(false); drawScore(); drawScene(null); return; }
    if (anim) return;
    var a = audio(); if (!a) { say('Turn the sound on to hear the band.'); return; }
    var at = a.currentTime + 0.1; playTune(at); listenStart = at; setBusy(true);
    (function tick() {
      if (listenStart == null) return;
      var t = ac.currentTime - listenStart;
      drawScore(Math.max(0, t));
      if (t > D.T + 0.5) { listenStart = null; setBusy(false); drawScore(); anim = null; return; }
      anim = requestAnimationFrame(tick);
    })();
  });
  $('btnSkip').addEventListener('click', function () { if (sim) { stopSound(); finish(showing); } });
  $('btnMaster').addEventListener('click', function () { if (!anim) fire(master.cues, 'master'); });
  $('btnEdit').addEventListener('click', function () {
    if (anim) stopAll();
    finished = false; showing = 'yours'; $('verdict').innerHTML = ''; $('verdict').className = 'verdict'; $('reveal').style.display = 'none';
    setBusy(false); drawScene(null); drawScore(); say('Back at the score. Change what you like and fire it again.');
  });
  $('btnReset').addEventListener('click', load);
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || anim) return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
    else if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && cues.length && !finished) { e.preventDefault(); cues.pop(); purse(); drawScore(); }
  });

  load();
})();
