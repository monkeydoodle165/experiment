/* drift.quibo.games — The Trial
   A sheepdog trial on a hill field somewhere in Wales or the north of England, in a year between 1873
   (the first public trial, at Bala) and 1914, on today's calendar date. The day's number picks the venue
   and with it the sheep (Welsh Mountain, Herdwick, Swaledale, Blackface, Cheviot or Gritstone, each with
   its own flight distance, pace and will to stay together), the dog you have been lent (how wide she runs
   out, how strongly she wants to bring the sheep to you, how fast she walks on), the wind that carries or
   swallows your whistle, the draw that pulls the sheep towards the field they came from, and the course:
   how far up the field the five sheep are let out, where the fetch gates stand, which way the drive goes
   and where the pen is.

   You never touch the sheep. You whistle, the dog hears (or does not), and the dog moves; the sheep move
   away from the dog. The sheep are a small flock model: each one runs from the dog in proportion to how far
   inside its flight distance the dog is, keeps near the others, keeps a little apart from its neighbour,
   grazes and drifts towards the draw when nobody is pressing it. The dog flanks round the sheep at a
   distance, walks on into them, lies down when told, and between commands drifts towards the far side
   of the sheep, because a sheepdog's instinct is to fetch: that makes the fetch easy and the drive hard.
   The judge marks outrun, lift, fetch, drive and pen against the lines between the gates. Self-contained. */
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
    var h = s ^ 0x2c9e4b17;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { return (r() + r() + r() + r() - 2) * 1.7; }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var EIGHT = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function pointName(deg) { return EIGHT[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
  function mmss(t) { t = Math.max(0, Math.round(t)); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function angDiff(a, b) { var d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }
  function fmt1(x) { return (Math.round(x * 2) / 2).toString(); }

  /* ---------- the field: metres, north at the top, the handler's post near the bottom ---------- */
  var FW = 400, FH = 460;
  var POST = { x: 200, y: 425 };
  var NSHEEP = 5;
  var LIMIT = 20 * 60;          // trial seconds allowed
  var PACE = 3;                 // trial seconds for each real second
  var DT = 0.025;
  var MAXPTS = { outrun: 20, lift: 10, fetch: 20, drive: 40, pen: 10 };

  var BREEDS = {
    welsh:   { name: 'Welsh Mountain', flight: 30, run: 6.0, coh: 0.8, flee: 7.2, note: 'small, quick and light on their feet, and inclined to split and run for the hill when a dog presses them' },
    herdwick:{ name: 'Herdwick', flight: 17, run: 4.4, coh: 1.0, flee: 5.2, note: 'hard, stubborn little sheep that let a dog come close and then move off grudgingly, and take some walking on' },
    swale:   { name: 'Swaledale', flight: 24, run: 5.2, coh: 1.1, flee: 6.4, note: 'strong fell ewes that keep together and move freely, though a careless dog will set them running' },
    black:   { name: 'Blackface', flight: 26, run: 5.6, coh: 0.9, flee: 6.8, note: 'lively hill sheep with plenty of spirit, quick to take fright and slow to settle again' },
    cheviot: { name: 'Cheviot', flight: 21, run: 5.0, coh: 1.35, flee: 6.0, note: 'big white-faced sheep that flock tightly and are steady to handle if the dog does not hurry them' },
    grit:    { name: 'Gritstone', flight: 20, run: 4.8, coh: 1.2, flee: 5.8, note: 'heavy, quiet moorland sheep that stay together and are easy to over-push into a trot' }
  };
  var VENUES = [
    { place: 'Bala', county: 'Merioneth', breed: 'welsh', from: 1873, welsh: true, hill: 'Arenig' },
    { place: 'Llangollen', county: 'Denbighshire', breed: 'welsh', from: 1876, welsh: true, hill: 'the Berwyns' },
    { place: 'Builth', county: 'Brecknockshire', breed: 'welsh', from: 1880, welsh: true, hill: 'the Epynt' },
    { place: 'Troutbeck', county: 'Westmorland', breed: 'herdwick', from: 1876, welsh: false, hill: 'the Kirkstone fells' },
    { place: 'Keswick', county: 'Cumberland', breed: 'herdwick', from: 1880, welsh: false, hill: 'Skiddaw' },
    { place: 'Hawes', county: 'the North Riding', breed: 'swale', from: 1880, welsh: false, hill: 'Wether Fell' },
    { place: 'Moffat', county: 'Dumfriesshire', breed: 'black', from: 1878, welsh: false, hill: 'Hart Fell' },
    { place: 'Alwinton', county: 'Northumberland', breed: 'cheviot', from: 1880, welsh: false, hill: 'the Cheviot' },
    { place: 'Longshaw', county: 'Derbyshire', breed: 'grit', from: 1898, welsh: false, hill: 'the Burbage moors' }
  ];
  var DOGS = ['Moss', 'Gyp', 'Fly', 'Nell', 'Cap', 'Sweep', 'Tib', 'Jed', 'Glen', 'Floss', 'Meg', 'Roy', 'Queen', 'Lassie', 'Mirk', 'Spot', 'Bess', 'Laddie', 'Tweed', 'Fan'];
  var BITCH = { Gyp: 1, Fly: 1, Nell: 1, Floss: 1, Meg: 1, Queen: 1, Lassie: 1, Bess: 1, Fan: 1, Tib: 1 };
  var SURW = ['Jones', 'Pugh', 'Roberts', 'Evans', 'Price', 'Lloyd', 'Morgan', 'Owen', 'Davies', 'Hughes', 'Thomas', 'Ellis', 'Rees', 'Williams'];
  var SURN = ['Scott', 'Armstrong', 'Elliot', 'Telfer', 'Dodd', 'Robson', 'Hogg', 'Bell', 'Wilson', 'Thompson', 'Gibson', 'Nixon', 'Milburn', 'Ritson', 'Wharton', 'Metcalfe'];
  var INIT = ['J.', 'W.', 'T.', 'R.', 'D.', 'E.', 'G.', 'H.', 'A.', 'J. W.', 'W. H.'];

  /* ---------- the day ---------- */
  function build(seed, date) {
    var r = rng(seed), D = { seed: seed, date: date };
    D.venue = pick(r, VENUES);
    D.year = D.venue.from + Math.floor(r() * (1915 - D.venue.from));
    D.breed = BREEDS[D.venue.breed];
    // the dog
    D.dog = pick(r, DOGS);
    D.bitch = !!BITCH[D.dog];
    D.age = 2 + Math.floor(r() * 7);
    D.width = 1.0 + r() * 0.95;          // outrun finishes this many flight distances off the sheep
    D.eye = 0.05 + r() * 0.17;           // rad/s pull towards the balance point when walking on
    D.walk = 2.1 + r() * 1.1;            // m/s walking on
    D.flank = 6 + r() * 2.5;             // m/s on a flank
    // the wind: from where, how strong (mph)
    D.windFrom = r() * 360;
    D.windMph = Math.round(3 + r() * r() * 30);
    // the draw: the sheep came from a field beyond one edge of this one
    var dside = r() < 0.5 ? -1 : 1;
    D.drawPt = { x: dside < 0 ? -40 : FW + 40, y: 60 + r() * 260 };
    D.drawSide = dside;
    D.drawK = 0.07 + r() * 0.22;
    // the course
    var outrun = 300 + Math.round(r() * 70);
    D.lift = { x: POST.x + Math.round(gauss(r) * 18), y: POST.y - outrun };
    D.outrunDist = Math.round(Math.hypot(D.lift.x - POST.x, D.lift.y - POST.y));
    var f = 0.45 + r() * 0.12;
    D.fetchGate = gate(lerpP(D.lift, POST, f), D.lift, POST, 8);
    D.driveSide = r() < 0.5 ? -1 : 1;     // -1: the drive goes away to the left first
    var dy = POST.y - 115 - Math.round(r() * 45);
    var d1 = { x: POST.x + D.driveSide * (120 + Math.round(r() * 25)), y: dy };
    var d2 = { x: POST.x - D.driveSide * (120 + Math.round(r() * 25)), y: dy + Math.round(gauss(r) * 8) };
    D.pen = { x: POST.x - D.driveSide * 42, y: POST.y - 2, w: 7, h: 5, mouth: 4.2 };
    D.mouth = { x: D.pen.x, y: D.pen.y - D.pen.h / 2 };
    D.drive1 = gate(d1, POST, d1, 7);
    D.drive2 = gate(d2, d1, d2, 7);
    D.legs = [
      { key: 'fetch', from: D.lift, to: POST, gate: D.fetchGate, name: 'the fetch' },
      { key: 'drive', from: POST, to: d1, gate: D.drive1, name: 'the drive away' },
      { key: 'drive', from: d1, to: d2, gate: D.drive2, name: 'the cross-drive' },
      { key: 'drive', from: d2, to: D.mouth, gate: null, name: 'the drive in to the pen' }
    ];
    D.walls = penWalls(D.pen);
    // the sheep, let out at the top
    D.start = [];
    for (var i = 0; i < NSHEEP; i++) D.start.push({ x: D.lift.x + gauss(r) * 2.2, y: D.lift.y + gauss(r) * 2.2 });
    // the other runs on the card
    var sur = D.venue.welsh ? SURW : SURN;
    D.rivals = [];
    var usedD = {}; usedD[D.dog] = 1;
    for (var k = 0; k < 7; k++) {
      var dn; for (var g = 0; g < 30; g++) { dn = pick(r, DOGS); if (!usedD[dn]) break; } usedD[dn] = 1;
      var sc = Math.round(clamp(58 + gauss(r) * 13, 22, 94));
      var ret = r() < 0.12;
      D.rivals.push({ who: pick(r, INIT) + ' ' + pick(r, sur), dog: dn, pts: ret ? null : sc });
    }
    D.rivals.sort(function (a, b) { return (b.pts === null ? -1 : b.pts) - (a.pts === null ? -1 : a.pts); });
    D.handler = D.venue.welsh ? 'a shepherd from ' + D.venue.hill : 'a shepherd off ' + D.venue.hill;
    return D;
  }
  function lerpP(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function gate(c, from, to, gap) {
    var dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1;
    var n = { x: dx / L, y: dy / L }, p = { x: -n.y, y: n.x };
    return { c: c, n: n, p: p, gap: gap,
      a: { x: c.x + p.x * gap / 2, y: c.y + p.y * gap / 2 }, b: { x: c.x - p.x * gap / 2, y: c.y - p.y * gap / 2 } };
  }
  function penWalls(P) {
    var l = P.x - P.w / 2, rt = P.x + P.w / 2, t = P.y - P.h / 2, b = P.y + P.h / 2, m = P.mouth / 2;
    return [
      [l, t, l, b], [l, b, rt, b], [rt, b, rt, t],
      [l, t, P.x - m, t], [P.x + m, t, rt, t]
    ];
  }

  /* ---------- state ---------- */
  var dayOff = 0, D = null, S = null, raf = 0, last = 0;

  function fresh() {
    var sheep = D.start.map(function (p) { return { x: p.x, y: p.y, vx: 0, vy: 0, fear: 0 }; });
    S = {
      state: 'ready', t: 0, phase: 'ready',
      sheep: sheep,
      dog: { x: POST.x + 2, y: POST.y + 3, vx: 0, vy: 0, mode: 'lie', dir: 0, steady: false, heading: -Math.PI / 2 },
      handler: { x: POST.x, y: POST.y, tx: POST.x, ty: POST.y },
      queue: [],               // whistles on their way to the dog
      rings: [],               // whistle rings for the picture
      out: null,               // outrun progress
      pts: { outrun: null, lift: null, fetch: null, drive: null, pen: null },
      ded: { outrun: [], lift: [], fetch: [], drive: [], pen: [] },
      leg: -1, legT: 0, mark: 0, gateX: null,
      gates: [],
      lift0: null, liftMaxV: 0,
      outMin: 1e9, outMaxV: 0, outStops: 0,
      linePen: 0, lineN: 0, runPen: 0, splitPen: 0,
      penStart: 0, penBreaks: 0, inPen: 0,
      track: [], dogTrack: [], trackT: 0,
      missed: 0, heard: 0, said: '', result: null
    };
    S.legLines = { fetch: 0, drive: 0 };
  }

  function centre() {
    var x = 0, y = 0;
    for (var i = 0; i < S.sheep.length; i++) { x += S.sheep[i].x; y += S.sheep[i].y; }
    return { x: x / S.sheep.length, y: y / S.sheep.length };
  }
  function spread(c) {
    var m = 0;
    for (var i = 0; i < S.sheep.length; i++) m = Math.max(m, Math.hypot(S.sheep[i].x - c.x, S.sheep[i].y - c.y));
    return m;
  }
  function flockSpeed() {
    var v = 0;
    for (var i = 0; i < S.sheep.length; i++) v += Math.hypot(S.sheep[i].vx, S.sheep[i].vy);
    return v / S.sheep.length;
  }

  /* ---------- the whistle ---------- */
  var CMD = {
    bye:   { word: 'Come bye', whistle: 'two rising notes', short: 'come bye' },
    away:  { word: 'Away to me', whistle: 'a falling slur', short: 'away' },
    walk:  { word: 'Walk up', whistle: 'two short pips', short: 'walk up' },
    lie:   { word: 'Lie down', whistle: 'one long blast', short: 'lie down' },
    steady:{ word: 'Steady', whistle: 'a slow warble', short: 'steady' }
  };
  function hearing(dist, ang) {
    // the wind carries the whistle downwind and swallows it upwind
    var to = (D.windFrom + 180) * Math.PI / 180;          // direction the wind blows towards (compass)
    var tv = { x: Math.sin(to), y: -Math.cos(to) };      // field coordinates: north is -y
    var c = Math.cos(ang) * tv.x + Math.sin(ang) * tv.y; // +1 when the dog is downwind of you
    var s = D.windMph / 30;
    var range = 270 + 150 * s * c - 60 * s;
    return { range: range, miss: clamp((dist - range) / 140, 0, 0.85) };
  }
  var noise = Math.random;   // whether a whistle is heard is weather, not the day's number
  function whistle(k) {
    if (S.state !== 'running') {
      if (S.state === 'ready' && (k === 'bye' || k === 'away')) start(k);
      return;
    }
    var dx = S.dog.x - S.handler.x, dy = S.dog.y - S.handler.y, dist = Math.hypot(dx, dy);
    var h = hearing(dist, Math.atan2(dy, dx));
    S.rings.push({ t: S.t, x: S.handler.x, y: S.handler.y });
    var heard = noise() >= h.miss;
    S.queue.push({ at: S.t + 0.15 + dist / 340, k: k, heard: heard });
    if (!heard) { S.missed++; say(D.dog + ' did not hear that: ' + CMD[k].whistle + ' into ' + (D.windMph > 12 ? 'a ' + D.windMph + ' mph wind' : 'the wind') + ' at ' + Math.round(dist) + ' m. Try again.'); }
    else S.heard++;
    hud();
  }
  function obey(k) {
    var g = S.dog;
    if (k === 'steady') { g.steady = true; return; }
    if (S.phase === 'outrun') {
      if (k === 'lie') { if (g.mode === 'outrun') { g.mode = 'lie'; S.outStops++; } return; }
      if ((k === 'bye' || k === 'away') && g.mode === 'lie') { g.mode = 'outrun'; return; }
      return;
    }
    g.steady = false;
    if (S.phase === 'lift' && k !== 'lie' && !S.lift0) { S.lift0 = centre(); S.liftT = S.t; }
    if (k === 'lie') { g.mode = 'lie'; }
    else if (k === 'walk') { g.mode = 'walk'; }
    else if (k === 'bye') { g.mode = 'flank'; g.dir = 1; }
    else if (k === 'away') { g.mode = 'flank'; g.dir = -1; }
  }

  function start(k) {
    S.state = 'running'; S.phase = 'outrun';
    var c = centre();
    var a0 = Math.atan2(POST.y - c.y, POST.x - c.x);
    var r0 = Math.hypot(S.dog.x - c.x, S.dog.y - c.y);
    // come bye is clockwise round the sheep, which on this map (y down) is increasing angle
    S.out = { s: 0, dir: k === 'bye' ? 1 : -1, a0: a0, r0: r0, side: k };
    S.dog.mode = 'outrun';
    S.rings.push({ t: S.t, x: S.handler.x, y: S.handler.y });
    say('Sent ' + (k === 'bye' ? 'on the come-bye side, clockwise, ' : 'on the away side, anticlockwise, ') + D.outrunDist + ' metres up the field.');
    last = 0;
    buttons(); hud();
  }

  /* ---------- the model ---------- */
  function step(dt) {
    S.t += dt;
    var B = D.breed, c = centre(), g = S.dog, i, j;
    // whistles arriving
    for (i = S.queue.length - 1; i >= 0; i--) if (S.queue[i].at <= S.t) { if (S.queue[i].heard) obey(S.queue[i].k); S.queue.splice(i, 1); }

    // ----- the dog -----
    var rx = g.x - c.x, ry = g.y - c.y, r = Math.hypot(rx, ry) || 1, psi = Math.atan2(ry, rx);
    var near = 1e9;
    for (i = 0; i < S.sheep.length; i++) near = Math.min(near, Math.hypot(S.sheep[i].x - g.x, S.sheep[i].y - g.y));
    var want = { x: 0, y: 0 }, F = B.flight;
    var sp = g.steady ? 0.62 : 1;
    if (g.mode === 'outrun' && S.out) {
      var o = S.out, Rend = F * D.width;
      var ua = o.a0, va = o.a0 + o.dir * Math.PI / 2;
      var vx0 = Math.cos(va), vy0 = Math.sin(va);
      var room = Math.min(vx0 > 0.01 ? (FW - 8 - c.x) / vx0 : vx0 < -0.01 ? (c.x - 8) / -vx0 : 1e9,
                          vy0 > 0.01 ? (FH - 8 - c.y) / vy0 : vy0 < -0.01 ? (c.y - 8) / -vy0 : 1e9);
      var Wd = clamp(Rend * 2 + 34, Rend + 4, Math.max(Rend + 4, room));
      var A = (o.r0 + Rend) / 2;
      var L = Math.PI * Math.sqrt((A * A + Wd * Wd) / 2);
      o.s = Math.min(1, o.s + D.flank * 1.1 * dt / L);
      var uu = (o.r0 - Rend) / 2 + A * Math.cos(Math.PI * o.s), vv = Wd * Math.sin(Math.PI * o.s);
      var tx = clamp(c.x + Math.cos(ua) * uu + vx0 * vv, 3, FW - 3), ty = clamp(c.y + Math.sin(ua) * uu + vy0 * vv, 3, FH - 3);
      var ex = tx - g.x, ey = ty - g.y, el = Math.hypot(ex, ey) || 1;
      var v = Math.min(D.flank * 1.15, el * 3);
      want.x = ex / el * v; want.y = ey / el * v;
      if (o.s >= 1 && el < 3) {
        g.mode = 'lie'; S.phase = 'lift';
        scoreOutrun();
        say(D.dog + ' has come round behind the sheep and dropped of ' + (D.bitch ? 'her' : 'his') + ' own accord. Walk ' + (D.bitch ? 'her' : 'him') + ' up for the lift.');
      }
    } else if (g.mode === 'flank') {
      var rt = Math.max(F * 0.9, r - 3);
      var vt = D.flank * sp, vr = clamp((rt - r) * 0.9, -2.5, 4);
      var tx2 = -Math.sin(psi) * g.dir, ty2 = Math.cos(psi) * g.dir;
      want.x = tx2 * vt + rx / r * vr; want.y = ty2 * vt + ry / r * vr;
    } else if (g.mode === 'walk') {
      var vin = near > 5.5 && r > spread(c) + 5 ? D.walk * sp : 0;
      // the dog's own wish to get to the far side of the sheep from you
      var hx = c.x - S.handler.x, hy = c.y - S.handler.y;
      var bal = Math.atan2(hy, hx);
      var om = D.eye * Math.sin(angDiff(bal, psi) / 1) ;
      var vtan = clamp(om * r, -3, 3);
      want.x = -rx / r * vin + -Math.sin(psi) * vtan; want.y = -ry / r * vin + Math.cos(psi) * vtan;
    }
    var acc = 14 * dt;
    g.vx += clamp(want.x - g.vx, -acc, acc); g.vy += clamp(want.y - g.vy, -acc, acc);
    if (g.mode === 'lie') { g.vx *= Math.exp(-dt * 8); g.vy *= Math.exp(-dt * 8); }
    g.x = clamp(g.x + g.vx * dt, 2, FW - 2); g.y = clamp(g.y + g.vy * dt, 2, FH - 2);
    var gsp = Math.hypot(g.vx, g.vy);
    if (gsp > 0.3) g.heading = Math.atan2(g.vy, g.vx);

    // ----- the handler walks to the pen once the drive is done -----
    var H = S.handler;
    var hdx = H.tx - H.x, hdy = H.ty - H.y, hl = Math.hypot(hdx, hdy);
    if (hl > 0.2) { H.x += hdx / hl * Math.min(hl, 1.4 * dt); H.y += hdy / hl * Math.min(hl, 1.4 * dt); }

    // ----- the sheep -----
    var mvx = 0, mvy = 0;
    for (i = 0; i < S.sheep.length; i++) { mvx += S.sheep[i].vx / S.sheep.length; mvy += S.sheep[i].vy / S.sheep.length; }
    var press = g.mode === 'lie' ? 0.55 : 0.7 + 0.3 * Math.min(1, gsp / 5);
    for (i = 0; i < S.sheep.length; i++) {
      var p = S.sheep[i], ax = 0, ay = 0;
      var dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 0.01;
      var fear = clamp((F - d) / F, 0, 1) * press;
      p.fear = Math.max(fear, p.fear * Math.exp(-dt * 0.8));
      ax += dx / d * B.flee * fear; ay += dy / d * B.flee * fear;
      // the handler, a little
      var qx = p.x - H.x, qy = p.y - H.y, qd = Math.hypot(qx, qy) || 0.01;
      if (qd < 6) { ax += qx / qd * (6 - qd) * 1.0; ay += qy / qd * (6 - qd) * 1.0; }
      // keep with the others
      var cx = c.x - p.x, cy = c.y - p.y, cd = Math.hypot(cx, cy);
      if (cd > 2.5) { var kc = 0.16 * B.coh * (1 + 3 * p.fear); ax += cx * kc; ay += cy * kc; }
      ax += (mvx - p.vx) * 0.7 * B.coh; ay += (mvy - p.vy) * 0.7 * B.coh;
      for (j = 0; j < S.sheep.length; j++) {
        if (j === i) continue;
        var o2 = S.sheep[j], sx = p.x - o2.x, sy = p.y - o2.y, sd = Math.hypot(sx, sy);
        if (sd < 1.4 && sd > 0.001) { ax += sx / sd * (1.4 - sd) * 4; ay += sy / sd * (1.4 - sd) * 4; }
      }
      // the draw, and grazing, when nobody is pressing
      var calm = 1 - Math.min(1, p.fear * 1.6);
      var wx = D.drawPt.x - p.x, wy = D.drawPt.y - p.y, wd = Math.hypot(wx, wy) || 1;
      ax += wx / wd * D.drawK * (0.35 + 0.65 * calm); ay += wy / wd * D.drawK * (0.35 + 0.65 * calm);
      ax += (noise() - 0.5) * 1.2 * calm; ay += (noise() - 0.5) * 1.2 * calm;
      // the walls of the field
      if (p.x < 6) ax += (6 - p.x) * 2; if (p.x > FW - 6) ax -= (p.x - FW + 6) * 2;
      if (p.y < 6) ay += (6 - p.y) * 2; if (p.y > FH - 6) ay -= (p.y - FH + 6) * 2;
      p.vx = (p.vx + ax * dt) * Math.exp(-dt * 1.2);
      p.vy = (p.vy + ay * dt) * Math.exp(-dt * 1.2);
      var v2 = Math.hypot(p.vx, p.vy);
      if (v2 > B.run) { p.vx *= B.run / v2; p.vy *= B.run / v2; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = clamp(p.x, 1, FW - 1); p.y = clamp(p.y, 1, FH - 1);
      // the hurdles of the pen
      for (j = 0; j < D.walls.length; j++) wallPush(p, D.walls[j]);
    }

    // ----- the judge -----
    judge(dt);

    if (S.t - S.trackT >= 1) {
      S.trackT = S.t;
      var cc = centre(); S.track.push([cc.x, cc.y, S.phase]); S.dogTrack.push([g.x, g.y]);
    }
    if (S.t >= LIMIT && S.state === 'running') finish('time');
  }
  function wallPush(p, w) {
    var x1 = w[0], y1 = w[1], x2 = w[2], y2 = w[3];
    var dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    var t = clamp(((p.x - x1) * dx + (p.y - y1) * dy) / L2, 0, 1);
    var qx = x1 + dx * t, qy = y1 + dy * t, ex = p.x - qx, ey = p.y - qy, d = Math.hypot(ex, ey);
    var R = 0.6;
    if (d < R) {
      if (d < 1e-4) { ex = -dy; ey = dx; d = Math.hypot(ex, ey); }
      var nx = ex / d, ny = ey / d;
      p.x = qx + nx * R; p.y = qy + ny * R;
      var vn = p.vx * nx + p.vy * ny;
      if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
    }
  }
  function inPen(p) {
    var P = D.pen;
    return Math.abs(p.x - P.x) < P.w / 2 && Math.abs(p.y - P.y) < P.h / 2;
  }

  function ded(phase, amt, why) {
    if (amt <= 0.05) return;
    S.ded[phase].push({ amt: amt, why: why });
  }
  function lost(phase) { var s = 0; S.ded[phase].forEach(function (d) { s += d.amt; }); return s; }

  function scoreOutrun() {
    var F = D.breed.flight;
    if (S.outMin < F * 1.2) ded('outrun', Math.min(12, (F * 1.2 - S.outMin) / F * 14), 'came in tight at the top, ' + Math.round(S.outMin) + ' m off the sheep when ' + Math.round(F * 1.2) + ' m would not have bothered them');
    else if (S.outMin > F * 2.1) ded('outrun', Math.min(4, (S.outMin / F - 2.1) * 3), 'ran so wide (' + Math.round(S.outMin) + ' m) that the sheep had time to wander');
    if (S.outMaxV > 1.8) ded('outrun', Math.min(6, (S.outMaxV - 1.8) * 3), 'disturbed the sheep before getting behind them');
    if (S.outStops) ded('outrun', Math.min(6, S.outStops * 2), 'stopped ' + (S.outStops === 1 ? 'once' : S.outStops + ' times') + ' on the outrun');
    S.pts.outrun = Math.max(0, MAXPTS.outrun - lost('outrun'));
  }

  function judge(dt) {
    var c = centre(), fv = flockSpeed(), g = S.dog;
    if (S.phase === 'outrun') {
      for (var i = 0; i < S.sheep.length; i++) S.outMin = Math.min(S.outMin, Math.hypot(S.sheep[i].x - g.x, S.sheep[i].y - g.y));
      S.outMaxV = Math.max(S.outMaxV, fv);
      return;
    }
    if (S.phase === 'lift') {
      if (!S.lift0) return;
      S.liftMaxV = Math.max(S.liftMaxV, fv);
      var mv = Math.hypot(c.x - S.lift0.x, c.y - S.lift0.y);
      if (mv >= 18) {
        var mvA = Math.atan2(c.y - S.lift0.y, c.x - S.lift0.x);
        var lineA = Math.atan2(D.fetchGate.c.y - S.lift0.y, D.fetchGate.c.x - S.lift0.x);
        var off = Math.abs(angDiff(mvA, lineA)) * 180 / Math.PI;
        if (S.liftMaxV > 2.3) ded('lift', Math.min(5, (S.liftMaxV - 2.3) * 2.5), 'a rough lift: the sheep went off at ' + S.liftMaxV.toFixed(1) + ' m/s');
        if (off > 12) ded('lift', Math.min(5, (off - 12) / 14), 'the sheep lifted ' + Math.round(off) + '° off the line to the fetch gates');
        S.pts.lift = Math.max(0, MAXPTS.lift - lost('lift'));
        S.phase = 'fetch'; beginLeg(0);
        say('Lifted. Now bring them down the field through the fetch gates and round behind you.');
      }
      return;
    }
    if (S.phase === 'fetch' || S.phase === 'drive') {
      var leg = D.legs[S.leg];
      legSample(leg, c, fv);
      gateWatch(leg);
      var len = Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y);
      var nx = (leg.to.x - leg.from.x) / len, ny = (leg.to.y - leg.from.y) / len;
      var along = (c.x - leg.from.x) * nx + (c.y - leg.from.y) * ny;
      var done = false;
      if (S.leg === 0) done = Math.hypot(c.x - POST.x, c.y - POST.y) < 16;
      else if (S.leg === 3) done = Math.hypot(c.x - D.mouth.x, c.y - D.mouth.y) < 22;
      else done = along >= len + 3;
      if (done) endLeg();
      return;
    }
    if (S.phase === 'pen') {
      var n = 0; for (var k = 0; k < S.sheep.length; k++) if (inPen(S.sheep[k])) n++;
      if (n < S.inPen && S.inPen > 0) S.penBreaks++;
      S.inPen = n;
      if (n === NSHEEP) {
        var tt = S.t - S.penStart;
        if (tt > 60) ded('pen', Math.min(5, (tt - 60) / 30), 'took ' + mmss(tt) + ' at the pen');
        if (S.penBreaks) ded('pen', Math.min(4, S.penBreaks * 1.5), (S.penBreaks === 1 ? 'a sheep broke' : 'sheep broke ' + S.penBreaks + ' times') + ' out of the pen mouth');
        S.pts.pen = Math.max(0, MAXPTS.pen - lost('pen'));
        finish('penned');
      }
    }
  }
  function beginLeg(k) {
    S.leg = k; S.mark = 10; S.gateX = null;
    if (D.legs[k].gate) S.gateX = S.sheep.map(function () { return null; });
  }
  function legSample(leg, c, fv) {
    var len = Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y);
    var nx = (leg.to.x - leg.from.x) / len, ny = (leg.to.y - leg.from.y) / len;
    var along = (c.x - leg.from.x) * nx + (c.y - leg.from.y) * ny;
    var dev = Math.abs((c.x - leg.from.x) * -ny + (c.y - leg.from.y) * nx);
    var pool = leg.key === 'fetch' ? 14 : 8;          // line points for this leg
    var per = pool / Math.max(1, Math.floor(len / 10));
    while (along >= S.mark && S.mark <= len) {
      var bad = clamp((dev - 4) / 18, 0, 1);
      if (bad > 0) { S.linePenLeg = (S.linePenLeg || 0) + per * bad; }
      if (fv > 2.7) S.runPenLeg = (S.runPenLeg || 0) + 0.25;
      if (spread(c) > 22) S.splitPenLeg = (S.splitPenLeg || 0) + 0.4;
      S.devMax = Math.max(S.devMax || 0, dev);
      S.mark += 10;
    }
  }
  function gateWatch(leg) {
    if (!leg.gate || !S.gateX) return;
    var G = leg.gate;
    for (var i = 0; i < S.sheep.length; i++) {
      if (S.gateX[i] !== null) continue;
      var p = S.sheep[i];
      var sd = (p.x - G.c.x) * G.n.x + (p.y - G.c.y) * G.n.y;
      if (sd > 0) {
        var lat = (p.x - G.c.x) * G.p.x + (p.y - G.c.y) * G.p.y;
        S.gateX[i] = Math.abs(lat) <= G.gap / 2 ? 'in' : 'out';
      }
    }
  }
  function endLeg() {
    var leg = D.legs[S.leg], ph = leg.key;
    var nm = leg.name;
    if (S.linePenLeg) ded(ph, S.linePenLeg, 'off line on ' + nm + ' (as much as ' + Math.round(S.devMax || 0) + ' m)');
    if (S.runPenLeg) ded(ph, Math.min(4, S.runPenLeg), 'sheep pushed into a run on ' + nm);
    if (S.splitPenLeg) ded(ph, Math.min(4, S.splitPenLeg), 'the sheep split on ' + nm);
    if (leg.gate) {
      var ins = 0, outs = 0;
      S.gateX.forEach(function (x) { if (x === 'in') ins++; else outs++; });
      var gn = S.leg === 0 ? 'the fetch gates' : S.leg === 1 ? 'the first drive gates' : 'the cross-drive gates';
      if (outs) ded(ph, ph === 'fetch' ? 5 : 6, (ins ? ins + ' of ' + NSHEEP + ' through ' : 'missed ') + gn);
      S.gates.push({ name: gn, ins: ins });
    }
    S.linePenLeg = 0; S.runPenLeg = 0; S.splitPenLeg = 0; S.devMax = 0;
    if (S.leg === 0) {
      S.pts.fetch = Math.max(0, MAXPTS.fetch - lost('fetch'));
      S.phase = 'drive'; beginLeg(1);
      say('Round the post. Now drive them away to the ' + (D.driveSide < 0 ? 'left' : 'right') + ' gates: ' + D.dog + ' will keep trying to swing round and bring them back to you, so flank ' + (D.bitch ? 'her' : 'him') + ' back each time.');
    } else if (S.leg < 3) {
      beginLeg(S.leg + 1);
      say(S.leg === 2 ? 'Turn them and take them across the field to the far gates.' : 'Bring them in to the pen.');
    } else {
      S.pts.drive = Math.max(0, MAXPTS.drive - lost('drive'));
      S.phase = 'pen'; S.penStart = S.t;
      S.handler.tx = D.pen.x + (D.pen.x > POST.x ? 6.5 : -6.5); S.handler.ty = D.mouth.y + 1;
      say('You leave the post and take the rope of the pen gate. Get all ' + NSHEEP + ' in.');
    }
  }

  function finish(why) {
    if (S.state !== 'running') return;
    S.state = 'done'; S.why = why;
    var total = 0;
    Object.keys(MAXPTS).forEach(function (k) { if (S.pts[k] === null) S.pts[k] = 0; total += S.pts[k]; });
    S.total = Math.round(total);
    if (why === 'time') say('Time. The judge waves his hat: your ' + (LIMIT / 60) + ' minutes are up.');
    else if (why === 'retire') say('You call ' + D.dog + ' off with a "that\'ll do" and walk off the field.');
    else say('All ' + NSHEEP + ' penned. You swing the gate shut.');
    buttons(); hud(); reveal();
  }

  /* ---------- drawing ---------- */
  function $(id) { return document.getElementById(id); }
  var cv = $('pitch'), ctx = cv.getContext('2d');
  var SC = 1, OX = 0, OY = 0;
  function layout() {
    SC = Math.min((cv.width - 20) / FW, (cv.height - 20) / FH);
    OX = (cv.width - FW * SC) / 2; OY = (cv.height - FH * SC) / 2;
  }
  function X(x) { return OX + x * SC; }
  function Y(y) { return OY + y * SC; }

  function draw() {
    layout();
    var W = cv.width, Hh = cv.height;
    ctx.fillStyle = '#0e131b'; ctx.fillRect(0, 0, W, Hh);
    // the field
    var grd = ctx.createLinearGradient(0, Y(0), 0, Y(FH));
    grd.addColorStop(0, '#24402a'); grd.addColorStop(1, '#2f5233');
    ctx.fillStyle = grd; ctx.fillRect(X(0), Y(0), FW * SC, FH * SC);
    // tussocks, fixed for the day
    var tr = rng(D.seed ^ 0x77);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (var i = 0; i < 260; i++) { ctx.beginPath(); ctx.arc(X(tr() * FW), Y(tr() * FH), 1 + tr() * 2.4, 0, 7); ctx.fill(); }
    // walls
    ctx.strokeStyle = '#6b6f66'; ctx.lineWidth = 3; ctx.strokeRect(X(0), Y(0), FW * SC, FH * SC);
    // the draw
    var dx = D.drawSide < 0 ? X(0) : X(FW), dy = Y(D.drawPt.y);
    ctx.strokeStyle = 'rgba(255,206,106,.55)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(dx, dy - 26); ctx.lineTo(dx, dy + 26); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,206,106,.75)'; ctx.font = '600 10px ui-monospace,Menlo,monospace';
    ctx.textAlign = D.drawSide < 0 ? 'left' : 'right';
    ctx.fillText('field gate', dx + (D.drawSide < 0 ? 6 : -6), dy - 30);
    // the course
    ctx.strokeStyle = 'rgba(232,237,245,.13)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.moveTo(X(D.lift.x), Y(D.lift.y)); ctx.lineTo(X(POST.x), Y(POST.y));
    ctx.lineTo(X(D.drive1.c.x), Y(D.drive1.c.y)); ctx.lineTo(X(D.drive2.c.x), Y(D.drive2.c.y)); ctx.lineTo(X(D.mouth.x), Y(D.mouth.y)); ctx.stroke();
    ctx.setLineDash([]);
    [D.fetchGate, D.drive1, D.drive2].forEach(function (G, k) {
      var made = S.gates[k];
      ctx.fillStyle = made ? (made.ins === NSHEEP ? '#64f0c8' : '#ff8a7a') : '#e8edf5';
      [G.a, G.b].forEach(function (q) { ctx.fillRect(X(q.x) - 2, Y(q.y) - 2, 4, 4); });
      ctx.strokeStyle = 'rgba(232,237,245,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(G.a.x), Y(G.a.y)); ctx.lineTo(X(G.a.x) - G.n.x * 7, Y(G.a.y) - G.n.y * 7);
      ctx.moveTo(X(G.b.x), Y(G.b.y)); ctx.lineTo(X(G.b.x) - G.n.x * 7, Y(G.b.y) - G.n.y * 7); ctx.stroke();
    });
    // the pen
    ctx.strokeStyle = '#d9a24a'; ctx.lineWidth = 2;
    D.walls.forEach(function (w) { ctx.beginPath(); ctx.moveTo(X(w[0]), Y(w[1])); ctx.lineTo(X(w[2]), Y(w[3])); ctx.stroke(); });
    // the post
    ctx.fillStyle = '#d9a24a'; ctx.fillRect(X(POST.x) - 1.5, Y(POST.y) - 6, 3, 9);
    // the letting-out pen
    ctx.strokeStyle = 'rgba(232,237,245,.3)'; ctx.strokeRect(X(D.lift.x) - 8, Y(D.lift.y) - 30, 16, 10);

    // tracks
    if (S.track.length > 1) {
      ctx.lineWidth = 2;
      for (var t = 1; t < S.track.length; t++) {
        var a = S.track[t - 1], b = S.track[t];
        ctx.strokeStyle = b[2] === 'fetch' || b[2] === 'lift' ? 'rgba(122,162,255,.75)' : b[2] === 'drive' ? 'rgba(183,140,255,.75)' : 'rgba(100,240,200,.75)';
        ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke();
      }
    }
    if (S.dogTrack.length > 1) {
      ctx.strokeStyle = 'rgba(232,237,245,.16)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(S.dogTrack[0][0]), Y(S.dogTrack[0][1]));
      for (var u = 1; u < S.dogTrack.length; u++) ctx.lineTo(X(S.dogTrack[u][0]), Y(S.dogTrack[u][1]));
      ctx.stroke();
    }
    // whistle rings
    S.rings = S.rings.filter(function (q) { return S.t - q.t < 2.5; });
    S.rings.forEach(function (q) {
      var age = S.t - q.t, rr = age * 60 * SC;
      ctx.strokeStyle = 'rgba(255,206,106,' + (0.5 * (1 - age / 2.5)).toFixed(3) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), rr, 0, 7); ctx.stroke();
    });
    // flight zone round the dog, faintly
    var g = S.dog;
    ctx.strokeStyle = 'rgba(255,138,122,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(X(g.x), Y(g.y), D.breed.flight * SC, 0, 7); ctx.stroke();
    // sheep
    S.sheep.forEach(function (p) {
      ctx.fillStyle = '#f2efe6';
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4.2, 0, 7); ctx.fill();
      ctx.fillStyle = D.venue.breed === 'cheviot' ? '#ddd' : '#2a2a2a';
      var hd = Math.atan2(p.vy, p.vx);
      ctx.beginPath(); ctx.arc(X(p.x) + Math.cos(hd) * 3.4, Y(p.y) + Math.sin(hd) * 3.4, 1.7, 0, 7); ctx.fill();
    });
    // the handler
    var H = S.handler;
    ctx.fillStyle = '#7aa2ff'; ctx.beginPath(); ctx.arc(X(H.x), Y(H.y), 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7aa2ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(H.x) + 4, Y(H.y) + 2); ctx.lineTo(X(H.x) + 6, Y(H.y) - 10); ctx.stroke();
    // the dog
    ctx.save(); ctx.translate(X(g.x), Y(g.y)); ctx.rotate(g.heading);
    ctx.fillStyle = '#111'; ctx.strokeStyle = '#f2efe6'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 3.4, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.arc(6, 0, 1.7, 0, 7); ctx.fill();
    ctx.restore();
    // labels
    ctx.font = '600 12px ui-monospace,Menlo,monospace'; ctx.fillStyle = 'rgba(232,237,245,.7)'; ctx.textAlign = 'left';
    ctx.fillText(D.dog.toUpperCase() + (g.mode === 'lie' ? ' · down' : g.mode === 'walk' ? ' · walking on' : g.mode === 'flank' ? (g.dir > 0 ? ' · come bye' : ' · away') : g.mode === 'outrun' ? ' · outrun' : '') + (g.steady ? ' · steady' : ''), X(g.x) + 9, Y(g.y) - 7);
    // compass and wind
    var cx = X(FW) - 34, cy = Y(0) + 34;
    ctx.fillStyle = 'rgba(11,15,22,.75)'; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.stroke();
    ctx.fillStyle = 'rgba(232,237,245,.55)'; ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - 13);
    var wa = (D.windFrom + 180) * Math.PI / 180, wl = 6 + D.windMph / 2;
    var ux = Math.sin(wa), uy = -Math.cos(wa);
    ctx.strokeStyle = '#64f0c8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - ux * wl, cy - uy * wl); ctx.lineTo(cx + ux * wl, cy + uy * wl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + ux * wl, cy + uy * wl);
    ctx.lineTo(cx + ux * wl - ux * 5 - uy * 4, cy + uy * wl - uy * 5 + ux * 4);
    ctx.lineTo(cx + ux * wl - ux * 5 + uy * 4, cy + uy * wl - uy * 5 - ux * 4); ctx.closePath(); ctx.fillStyle = '#64f0c8'; ctx.fill();
    ctx.fillStyle = 'rgba(232,237,245,.55)'; ctx.fillText(D.windMph + ' mph', cx, cy + 36);
    // clock
    ctx.textAlign = 'left'; ctx.fillStyle = S.t > LIMIT - 120 && S.state === 'running' ? '#ff8a7a' : 'rgba(232,237,245,.75)';
    ctx.font = '600 13px ui-monospace,Menlo,monospace';
    ctx.fillText(mmss(S.t) + ' / ' + mmss(LIMIT), X(0) + 10, Y(0) + 20);
  }

  /* ---------- the page ---------- */
  function say(t) { S.said = t; $('msg').textContent = t; }
  function hud() {
    var c = centre(), g = S.dog;
    var dist = Math.hypot(g.x - S.handler.x, g.y - S.handler.y);
    var h = hearing(dist, Math.atan2(g.y - S.handler.y, g.x - S.handler.x));
    $('hPhase').textContent = S.phase === 'ready' ? 'at the post' : S.phase === 'done' ? 'finished' : S.phase;
    $('hTime').textContent = mmss(S.t);
    $('hDog').textContent = Math.round(dist) + ' m off';
    var hw = $('hHear'); hw.textContent = h.miss <= 0 ? 'clear' : h.miss < 0.35 ? 'faint' : 'lost in the wind';
    hw.parentNode.className = h.miss >= 0.35 ? 'alarm' : '';
    $('hPace').textContent = flockSpeed().toFixed(1) + ' m/s';
    $('hSpread').textContent = Math.round(spread(c)) + ' m';
    var penned = 0; S.sheep.forEach(function (p) { if (inPen(p)) penned++; });
    $('hPen').textContent = penned + ' of ' + NSHEEP;
    var sc = 0, ks = Object.keys(MAXPTS);
    ks.forEach(function (k) { sc += S.pts[k] === null ? 0 : S.pts[k]; });
    $('hScore').textContent = Math.round(sc) + (S.state === 'done' ? ' of 100' : ' so far');
    // the card
    var rows = ks.map(function (k) {
      var got = S.pts[k], live = got === null ? MAXPTS[k] - lost(k) : got;
      var cls = got === null ? '' : got >= MAXPTS[k] * 0.75 ? 'ok' : got < MAXPTS[k] * 0.4 ? 'bad' : '';
      return '<tr><td>' + cap1(k) + '</td><td>' + MAXPTS[k] + '</td><td class="' + cls + '">' + (got === null ? (S.phase === k ? fmt1(Math.max(0, live)) + '…' : '—') : fmt1(got)) + '</td></tr>';
    }).join('');
    $('card').innerHTML = '<table><thead><tr><th>Phase</th><th>Out of</th><th>Kept</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function buttons() {
    var run = S.state === 'running', ready = S.state === 'ready';
    ['btnBye', 'btnAway'].forEach(function (id) { $(id).disabled = !(run || ready); });
    ['btnWalk', 'btnLie', 'btnSteady', 'btnRetire'].forEach(function (id) { $(id).disabled = !run; });
    ['btnDayPrev', 'btnDayNext', 'btnDayToday'].forEach(function (id) { $(id).disabled = run; });
    $('btnAgain').style.display = S.state === 'done' ? '' : 'none';
  }

  function plaque() {
    var d = D.date, v = D.venue, B = D.breed;
    var wd = new Date(D.year, d.getMonth(), d.getDate()).getDay();
    $('plWho').textContent = (wd === 0 ? '' : WEEKDAYS[wd] + ' ') + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + D.year + ' · ' + v.place + ', ' + v.county;
    $('plName').textContent = 'The ' + v.place + ' sheepdog trial';
    var her = D.bitch ? 'her' : 'his', she = D.bitch ? 'she' : 'he';
    var wide = D.width < 1.2 ? 'a tight runner who will cut in on the sheep if you let ' + (D.bitch ? 'her' : 'him') : D.width > 1.65 ? 'a wide, careful runner who gives the sheep plenty of room' : 'a sensible runner at a fair distance';
    var eye = D.eye > 0.16 ? 'a strong wish to bring the sheep to you, which makes the drive a fight' : D.eye < 0.09 ? 'very little pull of ' + her + ' own, so ' + she + ' goes where ' + she + ' is put and stays there' : 'the usual wish to fetch the sheep round to you';
    var pace = D.walk > 2.8 ? 'walks on briskly' : D.walk < 2.4 ? 'walks on slowly' : 'walks on at an even pace';
    $('plBlurb').innerHTML = 'Five ' + B.name + ' ewes, ' + B.note + ', are let out <b>' + D.outrunDist + ' metres</b> up the field. You have been lent <b>' + D.dog + '</b>, ' +
      (D.bitch ? 'a bitch' : 'a dog') + ' of ' + D.age + ': ' + wide + ', with ' + eye + ', who ' + pace + '. The wind is <b>' + (D.windMph < 6 ? 'light' : D.windMph < 14 ? 'moderate' : D.windMph < 22 ? 'fresh' : 'strong') + ' from the ' + pointName(D.windFrom) + '</b> (' + D.windMph + ' mph), and the sheep were brought in through the field gate on the <b>' + (D.drawSide < 0 ? 'west' : 'east') + '</b> side and will drift back that way whenever nobody is pressing them. The drive goes away to the <b>' + (D.driveSide < 0 ? 'left' : 'right') + '</b> first, and the pen is on the ' + (D.pen.x < POST.x ? 'left' : 'right') + ' of the post.';
    $('rules').innerHTML = '<span><b>→</b> come bye (clockwise)</span><span><b>←</b> away to me (anticlockwise)</span><span><b>↑</b> walk up</span><span><b>↓</b> or <b>space</b> lie down</span><span><b>S</b> steady</span><span><b>R</b> retire</span>';
  }

  function load() {
    var d = dateFor(dayOff);
    D = build(seedForDate(d), d);
    fresh();
    plaque();
    $('dayOut').textContent = (dayOff === 0 ? 'Today' : dayOff === -1 ? 'Yesterday' : dayOff === 1 ? 'Tomorrow' : (dayOff > 0 ? '+' : '') + dayOff + ' days') + ' · ' + D.year + ' · ' + D.venue.place + ' · ' + D.breed.name;
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    say('Your dog sits at your feet. Send ' + (D.bitch ? 'her' : 'him') + ' out on either side to begin: come bye takes ' + (D.bitch ? 'her' : 'him') + ' clockwise round the sheep, away to me anticlockwise.');
    buttons(); hud(); draw();
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (S.state === 'running') {
      if (!last) last = ts;
      var real = Math.min(0.1, (ts - last) / 1000); last = ts;
      var n = Math.round(real * PACE / DT);
      for (var i = 0; i < n && S.state === 'running'; i++) step(DT);
      if (S.state === 'running') hud();
    } else last = 0;
    draw();
  }

  function reveal() {
    var v = $('verdict'), tot = S.total;
    var all = D.rivals.slice(), me = { who: 'You', dog: D.dog, pts: tot, me: true };
    all.push(me);
    all.sort(function (a, b) { return ((b.pts === null ? -1 : b.pts) - (a.pts === null ? -1 : a.pts)) || ((b.me ? 1 : 0) - (a.me ? 1 : 0)); });
    var place = all.indexOf(me) + 1;
    var ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
    var prize = place === 1 ? 'the cup and two guineas' : place === 2 ? 'a pound and a new crook' : place === 3 ? 'ten shillings' : null;
    v.className = 'verdict ' + (tot >= 70 ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + tot + ' points of 100</b>, ' + ORD[place - 1] + ' of ' + all.length + ' on the card' + (prize ? ', and ' + prize + '.' : '.') + '</p>' +
      '<p>' + (S.why === 'penned' ? 'All five penned in ' + mmss(S.t) + '.' : S.why === 'time' ? 'Time ran out ' + (S.phase === 'pen' ? 'at the pen' : 'on ' + (S.phase === 'drive' ? 'the drive' : 'the ' + S.phase)) + '; the phases not finished score nothing.' : 'Retired on ' + (S.phase === 'pen' ? 'the pen' : 'the ' + S.phase) + '; the phases not finished score nothing.') +
      ' Of your whistles, <b>' + S.heard + '</b> reached ' + D.dog + ' and <b>' + S.missed + '</b> were lost in the wind.</p>';
    var s = '<h5>The judge’s card</h5><div class="tablewrap"><table><thead><tr><th>Phase</th><th>Points</th><th>Taken off for</th></tr></thead><tbody>';
    Object.keys(MAXPTS).forEach(function (k) {
      var why = S.ded[k].map(function (d) { return d.why + ' (−' + fmt1(d.amt) + ')'; }).join('; ');
      var unf = S.pts[k] === 0 && !S.ded[k].length;
      s += '<tr><td>' + cap1(k) + '</td><td>' + fmt1(S.pts[k]) + ' / ' + MAXPTS[k] + '</td><td style="white-space:normal">' + (unf ? 'not reached' : why || 'nothing') + '</td></tr>';
    });
    s += '</tbody></table></div>';
    s += '<h5>The card at ' + D.venue.place + '</h5><div class="tablewrap"><table><thead><tr><th></th><th>Handler</th><th>Dog</th><th>Points</th></tr></thead><tbody>';
    var n = 0;
    all.forEach(function (x) {
      n++;
      s += '<tr><td>' + (x.pts === null ? '—' : n) + '</td><td' + (x.me ? ' class="ok"' : '') + '>' + x.who + '</td><td>' + x.dog + '</td><td>' + (x.pts === null ? 'retired' : x.pts) + '</td></tr>';
    });
    s += '</tbody></table></div>';
    var best = D.rivals.filter(function (x) { return x.pts !== null; })[0];
    s += '<p>The blue line on the field is the sheep on the lift and fetch, purple the drive and green the pen; the grey thread is ' + D.dog + '. The dashes are the lines the judge holds you to.</p>';
    s += '<p>From the county paper: <i>“The ' + D.venue.place + ' trials were held in ' + (D.windMph > 18 ? 'a hard wind from the ' + pointName(D.windFrom) + ' that made the whistle of little use at the top of the field' : D.windMph < 6 ? 'still weather' : 'a ' + pointName(D.windFrom) + 'erly breeze') + '. The ' + D.breed.name + ' sheep ' + (D.breed.flight > 25 ? 'were wild and gave the dogs much trouble' : D.breed.flight < 19 ? 'were heavy and wanted a deal of moving' : 'ran fairly') + '. ' +
      (place === 1 ? 'The cup went to ' + D.handler + ' with ' + D.dog + ', who scored ' + tot + ' points.' : best ? 'The cup went to ' + best.who + ' with ' + best.dog + ' (' + best.pts + ' points); ' + D.handler + ' with ' + D.dog + ' was ' + ORD[place - 1] + ' with ' + tot + '.' : '') + '”</i></p>';
    $('reveal').innerHTML = s; $('reveal').style.display = '';
  }

  /* ---------- wiring ---------- */
  $('btnBye').addEventListener('click', function () { whistle('bye'); });
  $('btnAway').addEventListener('click', function () { whistle('away'); });
  $('btnWalk').addEventListener('click', function () { whistle('walk'); });
  $('btnLie').addEventListener('click', function () { whistle('lie'); });
  $('btnSteady').addEventListener('click', function () { whistle('steady'); });
  $('btnRetire').addEventListener('click', function () { if (S.state === 'running') finish('retire'); });
  $('btnAgain').addEventListener('click', function () { load(); });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key, live = S.state === 'running' || S.state === 'ready';
    if (!live) return;
    var map = { ArrowRight: 'bye', ArrowLeft: 'away', ArrowUp: 'walk', ArrowDown: 'lie', ' ': 'lie', s: 'steady', S: 'steady' };
    if (map[k]) {
      if (k === ' ' && tag === 'BUTTON') return;
      e.preventDefault();
      if (!e.repeat) whistle(map[k]);
    } else if ((k === 'r' || k === 'R') && S.state === 'running') finish('retire');
  });

  /* exposed for checking the model from the console; the page does not use it */
  window.__trial = { build: build, step: function (n) { for (var i = 0; i < n; i++) step(DT); }, state: function () { return S; }, day: function () { return D; }, whistle: whistle };

  load();
  raf = requestAnimationFrame(frame);
})();
