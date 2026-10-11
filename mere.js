/* drift.quibo.games — The Mere
   Population ecology. The day's number fills an inland lake with a few hundred fish,
   gathers them into shoals that keep to their own corners and gives each fish its own
   temper about nets. You have six days and three nets a day. Every fish you bring up is
   marked with a nick in the tail fin and put back; every marked fish that comes up again
   is a recapture. From the ratio you report to the angling club how many fish are in the
   water, with a range you will stand behind. Then the page drains the mere, counts every
   fish, and re-runs your week a hundred and twenty times with the nets spread out and a
   hundred and twenty times with them all in one bay, so you can see whether it was the
   arithmetic or the netting that went wrong.
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
    var h = s ^ 0x2b7e1516;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function pct(x) { return Math.round(x * 100) + '%'; }

  var MERES = ['Sallowmere', 'Brackenmere', 'Ullesmere', 'Whitlow Mere', 'Hartsmere', 'Linmere', 'Crowmere', 'Pennymere', 'Fennimere', 'Marbury Water', 'Quoisley Pool', 'Tarnside Water', 'Rushmere', 'Chelmere'];
  var CLUBS = ['Angling Association', 'Piscatorial Society', 'Fly and Bottom Club', 'Preservation Society', 'Anglers’ Club'];
  var COUNTIES = ['Cheshire', 'Shropshire', 'Norfolk', 'Staffordshire', 'Westmorland', 'Suffolk', 'Lancashire', 'Worcestershire'];
  var FISH = [
    { name: 'perch', pl: 'perch', roam: 0.045, shoal: 0.07, q: 0.62 },
    { name: 'roach', pl: 'roach', roam: 0.075, shoal: 0.09, q: 0.55 },
    { name: 'rudd', pl: 'rudd', roam: 0.065, shoal: 0.08, q: 0.58 },
    { name: 'tench', pl: 'tench', roam: 0.035, shoal: 0.06, q: 0.66 },
    { name: 'bream', pl: 'bream', roam: 0.085, shoal: 0.07, q: 0.52 },
    { name: 'crucian carp', pl: 'crucian carp', roam: 0.04, shoal: 0.065, q: 0.64 }
  ];
  var WHY = ['before it decides whether to restock', 'before it lets the water to a new tenant', 'because the members swear the fishing has gone off', 'because the miller wants to lower the sluice', 'before it buys five hundred fry from the hatchery', 'because a gentleman at the last dinner bet it could not be done'];
  var DAYS = 6, NETS = 3, W = 1.6, H = 1, NET_R = 0.1;

  /* ---------- the lake ---------- */
  function makeLake(r) {
    var harm = [];
    for (var k = 2; k <= 5; k++) harm.push({ k: k, a: (0.05 + r() * 0.13) / (k - 1) * 1.6, p: r() * Math.PI * 2 });
    var cx = 0.8, cy = 0.5;
    function raw(t) { var v = 1; harm.forEach(function (h) { v += h.a * Math.cos(h.k * t + h.p); }); return v; }
    // scale so the shore fits the box with a margin
    var sx = 0, sy = 0;
    for (var i = 0; i < 360; i++) { var t = i / 360 * Math.PI * 2, v = raw(t); sx = Math.max(sx, Math.abs(Math.cos(t) * v)); sy = Math.max(sy, Math.abs(Math.sin(t) * v)); }
    var ax = 0.74 / sx, ay = 0.45 / sy;
    function rad(t) { return raw(t); }
    function inside(x, y) {
      var dx = (x - cx) / ax, dy = (y - cy) / ay, t = Math.atan2(dy, dx);
      return Math.sqrt(dx * dx + dy * dy) < rad(t) * 0.97;
    }
    var pts = [];
    for (var j = 0; j <= 180; j++) { var tt = j / 180 * Math.PI * 2, rr = rad(tt); pts.push([cx + Math.cos(tt) * rr * ax, cy + Math.sin(tt) * rr * ay]); }
    // area by sampling
    var hit = 0, rs = rng(7);
    for (var s = 0; s < 4000; s++) if (inside(rs() * W, rs() * H)) hit++;
    return { cx: cx, cy: cy, inside: inside, shore: pts, area: hit / 4000 * W * H };
  }
  function randomIn(L, r) { for (var i = 0; i < 500; i++) { var x = r() * W, y = r() * H; if (L.inside(x, y)) return [x, y]; } return [L.cx, L.cy]; }
  function where(L, x, y) {
    var dx = x - L.cx, dy = y - L.cy, d = Math.sqrt(dx * dx / 0.55 + dy * dy / 0.2);
    if (d < 0.38) return 'the open water in the middle';
    var a = Math.atan2(-dy, dx) * 180 / Math.PI; // north is up
    var dir = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'][((Math.round(a / 45) % 8) + 8) % 8];
    return 'the ' + dir + ' ' + (d > 0.8 ? 'bay' : 'shore');
  }

  /* ---------- the day ---------- */
  function build(seed) {
    var r = rng(seed);
    var D = { seed: seed };
    D.mere = pick(r, MERES); D.county = pick(r, COUNTIES); D.club = D.mere.split(' ')[0] + ' ' + pick(r, CLUBS);
    D.year = 1886 + Math.floor(r() * 52); D.why = pick(r, WHY);
    D.sp = FISH[Math.floor(r() * FISH.length)];
    D.L = makeLake(r);
    D.N = 220 + Math.floor(r() * r() * 700) + Math.floor(r() * 80);
    // shoals: a handful of home grounds, unequal in size, plus a few loners
    var S = 4 + Math.floor(r() * 3), shoals = [], wsum = 0;
    for (var s = 0; s < S; s++) {
      var p = randomIn(D.L, r), w = 0.4 + r() * 1.6; wsum += w;
      shoals.push({ x: p[0], y: p[1], w: w, n: 0 });
    }
    var fish = [];
    for (var i = 0; i < D.N; i++) {
      var hx, hy, sh = -1;
      if (r() < 0.12) { var q = randomIn(D.L, r); hx = q[0]; hy = q[1]; }
      else {
        var u = r() * wsum; for (sh = 0; sh < S - 1; sh++) { u -= shoals[sh].w; if (u <= 0) break; }
        for (var k = 0; k < 40; k++) {
          hx = shoals[sh].x + gauss(r) * D.sp.shoal * 1.3; hy = shoals[sh].y + gauss(r) * D.sp.shoal;
          if (D.L.inside(hx, hy)) break;
          hx = shoals[sh].x; hy = shoals[sh].y;
        }
        shoals[sh].n++;
      }
      // temper: how readily this fish swims into a net (lognormal, mean about one)
      var c = Math.exp(gauss(r) * 0.32 - 0.05);
      fish.push({ hx: hx, hy: hy, sh: sh, c: c, roam: D.sp.roam * (0.8 + r() * 1.2) });
    }
    D.shoals = shoals; D.fish = fish;
    // where every fish is on each of the six mornings: fixed by the day's number, not by your nets
    D.pos = [];
    for (var d = 0; d < DAYS; d++) {
      var rd = rng(mix(seed, 100 + d)), P = new Float32Array(D.N * 2);
      for (var f = 0; f < D.N; f++) {
        var F = fish[f], x = F.hx, y = F.hy;
        for (var t = 0; t < 12; t++) {
          var nx = F.hx + gauss(rd) * F.roam, ny = F.hy + gauss(rd) * F.roam;
          if (D.L.inside(nx, ny)) { x = nx; y = ny; break; }
        }
        P[f * 2] = x; P[f * 2 + 1] = y;
      }
      D.pos.push(P);
    }
    return D;
  }

  // haul one day's nets. marks: Int8Array of 0/1 (mutated). returns the day's book entry
  function haul(D, day, nets, marks, r) {
    var P = D.pos[day], caught = [], C = 0, R = 0, before = 0;
    for (var f = 0; f < D.N; f++) if (marks[f]) before++;
    for (var f2 = 0; f2 < D.N; f2++) {
      var x = P[f2 * 2], y = P[f2 * 2 + 1], miss = 1;
      for (var n = 0; n < nets.length; n++) {
        var dx = x - nets[n][0], dy = y - nets[n][1], d2 = dx * dx + dy * dy;
        if (d2 < NET_R * NET_R) { var fall = 1 - 0.55 * d2 / (NET_R * NET_R); miss *= 1 - Math.min(0.95, D.sp.q * D.fish[f2].c * fall); }
      }
      var u = r();
      if (miss < 1 && u > miss) {
        C++;
        var re = !!marks[f2]; if (re) R++;
        caught.push({ f: f2, x: x, y: y, re: re });
      }
    }
    caught.forEach(function (k) { marks[k.f] = 1; });
    return { day: day, nets: nets.map(function (n) { return [n[0], n[1]]; }), C: C, R: R, M: before, marked: C - R, caught: caught };
  }

  /* ---------- the arithmetic ---------- */
  // Schnabel's estimate, with Chapman's +1 on the recaptures so it never divides by nothing
  function schnabel(book) {
    var CM = 0, R = 0;
    book.forEach(function (b) { CM += b.C * b.M; R += b.R; });
    if (CM === 0) return null;
    var lo = poissonLo(R), hi = poissonHi(R);
    return { n: CM / (R + 1), lo: CM / (hi + 1), hi: CM / (lo + 1), R: R, CM: CM };
  }
  // Wilson–Hilferty chi-square quantiles for an exact-ish Poisson interval on the recaptures
  function chi2q(k, z) { if (k <= 0) return 0; var a = 2 / (9 * k); return k * Math.pow(Math.max(0, 1 - a + z * Math.sqrt(a)), 3); }
  function poissonLo(R) { return R === 0 ? 0 : 0.5 * chi2q(2 * R, -1.96); }
  function poissonHi(R) { return 0.5 * chi2q(2 * R + 2, 1.96); }

  /* ---------- how other keepers would have done ---------- */
  function spreadNets(D, r) {
    // one net in each third of the shore's compass, somewhere inside it
    var out = [], off = r() * Math.PI * 2;
    for (var n = 0; n < NETS; n++) {
      for (var k = 0; k < 400; k++) {
        var p = randomIn(D.L, r), a = Math.atan2(p[1] - D.L.cy, p[0] - D.L.cx) - off;
        a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (Math.floor(a / (2 * Math.PI / NETS)) === n) { out.push(p); break; }
      }
      if (out.length < n + 1) out.push(randomIn(D.L, r));
    }
    return out;
  }
  function bayNets(D) {
    var big = 0; D.shoals.forEach(function (s, i) { if (s.n > D.shoals[big].n) big = i; });
    var s = D.shoals[big], out = [[s.x, s.y]];
    var a = [[NET_R * 1.4, 0], [-NET_R * 0.7, NET_R * 1.2], [-NET_R * 0.7, -NET_R * 1.2]];
    for (var i = 0; i < 2; i++) { var x = s.x + a[i + 1][0], y = s.y + a[i + 1][1]; out.push(D.L.inside(x, y) ? [x, y] : [s.x + a[0][0] * (i ? -1 : 1), s.y]); }
    return out;
  }
  function simulate(D, design, runs) {
    var errs = [], ests = [];
    for (var k = 0; k < runs; k++) {
      var r = rng(mix(D.seed, 9000 + k + (design === 'bay' ? 50000 : 0))), marks = new Int8Array(D.N), book = [];
      for (var d = 0; d < DAYS; d++) book.push(haul(D, d, design === 'bay' ? bayNets(D) : spreadNets(D, r), marks, r));
      var s = schnabel(book); if (!s) continue;
      ests.push(s.n); errs.push(Math.abs(s.n - D.N) / D.N);
    }
    ests.sort(function (a, b) { return a - b; }); errs.sort(function (a, b) { return a - b; });
    return { med: ests[ests.length >> 1], q1: ests[Math.floor(ests.length * 0.1)], q9: ests[Math.floor(ests.length * 0.9)], medErr: errs[errs.length >> 1] };
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { build: build, haul: haul, schnabel: schnabel, simulate: simulate, rng: rng, mix: mix, seedForDate: seedForDate, spreadNets: spreadNets, bayNets: bayNets };
    return;
  }

  /* =============================== the page =============================== */
  function $(id) { return document.getElementById(id); }
  var dayOff = 0, D = null, st = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = $('mere'), cx = cv.getContext('2d'), scale = 1, rises = [], raf = null;

  function fresh() {
    return { day: 0, nets: [], marks: new Int8Array(D.N), book: [], r: rng(mix(D.seed, 77)), done: false, report: null, sims: null, flash: 0 };
  }
  function load() {
    var date = dateFor(dayOff);
    D = build(seedForDate(date));
    st = fresh();
    $('dayOut').textContent = longDate(date) + (dayOff === 0 ? ' (today)' : '');
    $('plWho').textContent = D.county + ', ' + D.year;
    $('plName').textContent = D.mere;
    $('plBlurb').innerHTML = 'The <b>' + esc(D.club) + '</b> wants to know how many <b>' + esc(D.sp.pl) + '</b> there are in ' + esc(D.mere) + ', ' + esc(D.why) + '. Nobody is going to drain it to count. You have the boat for <b>six days</b> and <b>three nets</b> a day. Every fish you bring up gets a nick in the tail fin and goes back; any fish that comes up already nicked is a <b>recapture</b>. The mere covers about ' + Math.round(D.L.area / 0.012) + ' acres and nothing goes in or out of it this week.';
    $('estN').value = ''; $('estLo').value = ''; $('estHi').value = '';
    renderAll();
  }

  /* ---------- canvas ---------- */
  function resize() {
    var w = cv.clientWidth || 800, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(w / W * H * dpr);
    scale = cv.width / W;
    draw();
  }
  function X(x) { return x * scale; }
  function spawnRises() {
    if (st.done || st.day >= DAYS) { rises = []; return; }
    var P = D.pos[st.day], r = rng(mix(D.seed, 500 + st.day)), out = [];
    for (var i = 0; i < 16; i++) { var f = Math.floor(r() * D.N); out.push({ x: P[f * 2], y: P[f * 2 + 1], t0: r() * 3000, per: 2600 + r() * 2400 }); }
    rises = out;
  }
  function draw(now) {
    now = now || 0;
    var c = cx, w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0b1a14'; c.fillRect(0, 0, w, h);
    // reeds
    var rr = rng(D.seed ^ 0x5151);
    c.strokeStyle = 'rgba(120,170,110,.18)'; c.lineWidth = Math.max(1, scale * 0.002);
    for (var i = 0; i < 260; i++) { var p = D.L.shore[Math.floor(rr() * D.L.shore.length)], ox = (rr() - 0.5) * 0.06, oy = (rr() - 0.5) * 0.06; c.beginPath(); c.moveTo(X(p[0] + ox), X(p[1] + oy)); c.lineTo(X(p[0] + ox + (rr() - 0.5) * 0.01), X(p[1] + oy - 0.02 - rr() * 0.02)); c.stroke(); }
    // water
    c.beginPath(); D.L.shore.forEach(function (p, k) { if (k) c.lineTo(X(p[0]), X(p[1])); else c.moveTo(X(p[0]), X(p[1])); }); c.closePath();
    var g = c.createRadialGradient(X(D.L.cx), X(D.L.cy), 0, X(D.L.cx), X(D.L.cy), X(0.8));
    g.addColorStop(0, '#123049'); g.addColorStop(1, '#0d2233');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(160,200,190,.35)'; c.lineWidth = Math.max(1, scale * 0.003); c.stroke();
    c.save(); c.clip();
    // history: earlier nets, faint
    st.book.forEach(function (b) { b.nets.forEach(function (n) { c.beginPath(); c.arc(X(n[0]), X(n[1]), X(NET_R), 0, Math.PI * 2); c.fillStyle = 'rgba(122,162,255,.05)'; c.fill(); c.strokeStyle = 'rgba(122,162,255,.16)'; c.lineWidth = 1; c.stroke(); }); });
    // rises
    if (!st.done) rises.forEach(function (q) {
      var ph = reduce ? 0.5 : (((now + q.t0) % q.per) / q.per);
      if (ph > 0.6) return;
      var a = ph / 0.6;
      c.beginPath(); c.ellipse(X(q.x), X(q.y), X(0.004 + a * 0.03), X(0.002 + a * 0.016), 0, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(220,235,245,' + (0.55 * (1 - a)).toFixed(3) + ')'; c.lineWidth = Math.max(1, scale * 0.0022); c.stroke();
    });
    // the last haul
    var last = st.book[st.book.length - 1];
    if (last && !st.done) last.caught.forEach(function (k) {
      c.beginPath(); c.arc(X(k.x), X(k.y), Math.max(2, X(0.0055)), 0, Math.PI * 2);
      if (k.re) { c.strokeStyle = '#ffce6a'; c.lineWidth = 2; c.stroke(); } else { c.fillStyle = 'rgba(100,240,200,.85)'; c.fill(); }
    });
    // the drained mere: every fish, where it was on the last morning
    if (st.done) {
      var P = D.pos[Math.min(DAYS - 1, Math.max(0, st.book.length - 1))];
      for (var f = 0; f < D.N; f++) {
        c.beginPath(); c.arc(X(P[f * 2]), X(P[f * 2 + 1]), Math.max(1.6, X(0.0042)), 0, Math.PI * 2);
        c.fillStyle = st.marks[f] ? '#64f0c8' : 'rgba(139,151,171,.55)'; c.fill();
      }
    }
    // today's nets
    if (!st.done) st.nets.forEach(function (n, k) {
      c.beginPath(); c.arc(X(n[0]), X(n[1]), X(NET_R), 0, Math.PI * 2);
      c.fillStyle = 'rgba(122,162,255,.12)'; c.fill();
      c.setLineDash([X(0.008), X(0.006)]); c.strokeStyle = '#7aa2ff'; c.lineWidth = Math.max(1.5, scale * 0.003); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#7aa2ff'; c.font = '600 ' + Math.round(X(0.026)) + 'px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(k + 1), X(n[0]), X(n[1]));
    });
    c.restore();
    // compass
    c.fillStyle = 'rgba(232,237,245,.5)'; c.font = '600 ' + Math.round(X(0.022)) + 'px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText('N', X(1.54), X(0.07)); c.beginPath(); c.moveTo(X(1.54), X(0.09)); c.lineTo(X(1.53), X(0.13)); c.lineTo(X(1.55), X(0.13)); c.closePath(); c.fill();
  }
  function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
  function toLake(e) {
    var b = cv.getBoundingClientRect();
    return [(e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H];
  }
  function onTap(e) {
    if (st.done || st.day >= DAYS) return;
    var p = toLake(e);
    for (var i = 0; i < st.nets.length; i++) {
      var dx = p[0] - st.nets[i][0], dy = p[1] - st.nets[i][1];
      if (dx * dx + dy * dy < NET_R * NET_R) { st.nets.splice(i, 1); renderControls(); draw(); return; }
    }
    if (!D.L.inside(p[0], p[1])) { say('That is the bank. Put the net in the water.'); return; }
    if (st.nets.length >= NETS) { say('Three nets are all the club owns. Tap one to take it up first.'); return; }
    st.nets.push(p); say(''); renderControls(); draw();
  }
  function say(t) { $('msg').innerHTML = t; }

  /* ---------- actions ---------- */
  function doHaul() {
    if (st.done || st.day >= DAYS || !st.nets.length) return;
    var b = haul(D, st.day, st.nets, st.marks, st.r);
    st.book.push(b); st.day++; st.nets = [];
    var m = '<b>Day ' + st.book.length + '.</b> ' + (b.C ? b.C + ' ' + D.sp.pl + ' up: ' + (b.R ? '<b>' + b.R + '</b> already nicked, ' : 'none of them nicked yet, ') + b.marked + ' newly marked and back in the water.' : 'Nothing in the nets at all.');
    if (st.day >= DAYS) m += ' That was the last day of the boat. Write your report.';
    say(m); spawnRises(); renderAll();
  }
  function doReport() {
    if (st.done) return;
    var n = parseFloat($('estN').value), lo = parseFloat($('estLo').value), hi = parseFloat($('estHi').value);
    if (!(n > 0)) { say('Put a number in the report: how many ' + D.sp.pl + ' are in the mere?'); return; }
    if (!(lo > 0) || !(hi > 0) || lo > n || hi < n) { say('Give a range you will stand behind, with your number inside it.'); return; }
    var mk = 0; for (var f = 0; f < D.N; f++) if (st.marks[f]) mk++;
    if (mk === 0) { say('You have not caught anything yet. Haul at least once.'); return; }
    st.report = { n: n, lo: lo, hi: hi, mk: mk };
    st.done = true; say('');
    st.sims = { spread: simulate(D, 'spread', 120), bay: simulate(D, 'bay', 120) };
    renderAll();
  }

  /* ---------- rendering ---------- */
  function renderControls() {
    var left = DAYS - st.day;
    $('btnHaul').disabled = st.done || left <= 0 || !st.nets.length;
    $('btnHaul').textContent = left > 0 ? 'Haul ' + (st.nets.length ? numw(st.nets.length) + ' net' + (st.nets.length > 1 ? 's' : '') : 'the nets') + ' (day ' + (st.day + 1) + ' of ' + DAYS + ')' : 'The week is over';
    $('btnReport').disabled = st.done || !st.book.length;
    $('estN').disabled = $('estLo').disabled = $('estHi').disabled = st.done;
    $('netsLeft').textContent = st.done ? 'drained' : left > 0 ? (NETS - st.nets.length) + ' of ' + NETS + ' nets still in the boat' : 'boat returned';
  }
  function fmt(x) { return x == null || !isFinite(x) ? '—' : Math.round(x).toLocaleString('en-GB'); }
  function renderBook() {
    var rows = '', running = [];
    st.book.forEach(function (b, i) {
      var s = schnabel(st.book.slice(0, i + 1)); running.push(s);
      rows += '<tr><td>' + (i + 1) + '</td><td>' + b.nets.length + '</td><td>' + b.C + '</td><td>' + b.M + '</td><td class="' + (b.R ? 're' : '') + '">' + b.R + '</td><td>' + b.marked + '</td><td>' + b.C * b.M + '</td><td>' + (s && i > 0 ? fmt(s.n) : '—') + '</td></tr>';
    });
    var s = schnabel(st.book), tot = { C: 0, R: 0, CM: 0 };
    st.book.forEach(function (b) { tot.C += b.C; tot.R += b.R; tot.CM += b.C * b.M; });
    $('book').innerHTML = st.book.length ? '<table class="book"><thead><tr><th>Day</th><th>Nets</th><th>Caught C</th><th>Nicked before M</th><th>Recaught R</th><th>Newly nicked</th><th>C × M</th><th>Running estimate</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="2">Totals</td><td>' + tot.C + '</td><td></td><td>' + tot.R + '</td><td>' + (tot.C - tot.R) + '</td><td>' + tot.CM + '</td><td></td></tr></tfoot></table>' : '<p class="sub empty">The book is empty. Put the nets out on the map and haul.</p>';
    var f = $('formula');
    if (s && st.book.length > 1) {
      f.innerHTML = 'Schnabel’s sum: <b>N ≈ Σ(C × M) ÷ (ΣR + 1) = ' + s.CM + ' ÷ ' + (s.R + 1) + ' = ' + fmt(s.n) + '</b>. With ' + s.R + ' recapture' + (s.R === 1 ? '' : 's') + ' the recaptures alone could reasonably have been anywhere from ' + poissonLo(s.R).toFixed(1) + ' to ' + poissonHi(s.R).toFixed(1) + ', which puts the population between about <b>' + fmt(s.lo) + '</b> and <b>' + fmt(s.hi) + '</b>, if every fish was as likely as every other to be in your nets.';
    } else f.innerHTML = 'After a second haul the clerk can start the arithmetic: if the marked fish have mixed back in, the share of nicked fish in a catch should be the share of nicked fish in the mere.';
    renderChart(running);
  }
  function renderChart(running) {
    var pts = []; running.forEach(function (s, i) { if (s && i > 0) pts.push({ d: i + 1, n: s.n, lo: s.lo, hi: s.hi }); });
    var box = $('chart');
    if (!pts.length) { box.innerHTML = ''; return; }
    var top = 0; pts.forEach(function (p) { top = Math.max(top, Math.min(p.hi, p.n * 4)); });
    if (st.done) top = Math.max(top, D.N * 1.15);
    if (st.report) top = Math.max(top, st.report.hi * 1.05);
    top = Math.max(50, top);
    var w = 560, h = 210, l = 52, rgt = 14, t = 14, b = 30;
    function px(d) { return l + (d - 1) / (DAYS - 1) * (w - l - rgt); }
    function py(v) { return t + (1 - Math.min(v, top) / top) * (h - t - b); }
    var step = Math.pow(10, Math.floor(Math.log10(top / 4))); var nice = [1, 2, 5, 10].map(function (m) { return m * step; }).filter(function (s) { return top / s <= 6; })[0] || step * 10;
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Running estimate of the population after each day, with its range">';
    for (var v = 0; v <= top; v += nice) svg += '<line x1="' + l + '" x2="' + (w - rgt) + '" y1="' + py(v) + '" y2="' + py(v) + '" class="gd"/><text x="' + (l - 8) + '" y="' + (py(v) + 4) + '" class="ax" text-anchor="end">' + Math.round(v) + '</text>';
    for (var d = 1; d <= DAYS; d++) svg += '<text x="' + px(d) + '" y="' + (h - 10) + '" class="ax" text-anchor="middle">day ' + d + '</text>';
    if (st.report) svg += '<rect x="' + l + '" width="' + (w - l - rgt) + '" y="' + py(st.report.hi) + '" height="' + Math.max(1, py(st.report.lo) - py(st.report.hi)) + '" class="yr"/><text x="' + (w - rgt - 4) + '" y="' + (py(st.report.hi) - 4) + '" class="yl" text-anchor="end">your range</text>';
    pts.forEach(function (p) { svg += '<line x1="' + px(p.d) + '" x2="' + px(p.d) + '" y1="' + py(p.hi) + '" y2="' + py(p.lo) + '" class="wh"/><line x1="' + (px(p.d) - 5) + '" x2="' + (px(p.d) + 5) + '" y1="' + py(p.hi) + '" y2="' + py(p.hi) + '" class="wh"/><line x1="' + (px(p.d) - 5) + '" x2="' + (px(p.d) + 5) + '" y1="' + py(p.lo) + '" y2="' + py(p.lo) + '" class="wh"/>'; });
    svg += '<polyline points="' + pts.map(function (p) { return px(p.d) + ',' + py(p.n); }).join(' ') + '" class="ln"/>';
    pts.forEach(function (p) { svg += '<circle cx="' + px(p.d) + '" cy="' + py(p.n) + '" r="4.5" class="dt"><title>Day ' + p.d + ': ' + fmt(p.n) + ' (' + fmt(p.lo) + '–' + fmt(p.hi) + ')</title></circle>'; });
    if (st.done) svg += '<line x1="' + l + '" x2="' + (w - rgt) + '" y1="' + py(D.N) + '" y2="' + py(D.N) + '" class="tr"/><text x="' + (l + 6) + '" y="' + (py(D.N) - 6) + '" class="tl">drained and counted: ' + D.N + '</text>';
    svg += '</svg>';
    box.innerHTML = '<h5>The running estimate, with the range the recaptures allow</h5>' + svg;
  }
  function renderVerdict() {
    var V = $('verdict');
    if (!st.done) { V.innerHTML = ''; V.className = 'verdict'; $('legend').hidden = true; return; }
    $('legend').hidden = false;
    var R = st.report, N = D.N, err = (R.n - N) / N, cover = R.lo <= N && N <= R.hi, width = (R.hi - R.lo) / N;
    var s = schnabel(st.book), sp = st.sims.spread, bay = st.sims.bay;
    // marked share by shoal
    var byS = D.shoals.map(function (sh, i) { return { i: i, n: 0, m: 0, x: sh.x, y: sh.y }; }), loners = { n: 0, m: 0 };
    D.fish.forEach(function (F, f) { var o = F.sh >= 0 ? byS[F.sh] : loners; o.n++; if (st.marks[f]) o.m++; });
    byS.sort(function (a, b) { return b.m / Math.max(1, b.n) - a.m / Math.max(1, a.n); });
    var hiS = byS[0], loS = byS[byS.length - 1];
    var good = Math.abs(err) <= 0.15 && cover && width < 1.2;
    V.className = 'verdict ' + (good ? 'good' : 'warn');
    var grade = Math.abs(err) <= 0.1 ? 'within a tenth of the truth' : Math.abs(err) <= 0.25 ? 'within a quarter' : Math.abs(err) <= 0.5 ? 'out by ' + pct(Math.abs(err)) : 'badly out, by ' + pct(Math.abs(err));
    var html = '<b>The mere is drained.</b> The keepers count <b>' + N + ' ' + D.sp.pl + '</b>. You reported <b>' + fmt(R.n) + '</b> (' + fmt(R.lo) + ' to ' + fmt(R.hi) + '): ' + grade + (err < -0.02 ? ', low' : err > 0.02 ? ', high' : '') + ', and your range ' + (cover ? '<b>does</b> take in the true number' : '<b>misses</b> the true number') + (cover && width > 1.2 ? ', though a range that wide is barely a report' : '') + '. ';
    html += 'You nicked ' + R.mk + ' fish, ' + pct(R.mk / N) + ' of the mere. ';
    html += 'By the end ' + pct(hiS.m / Math.max(1, hiS.n)) + ' of the shoal on ' + where(D.L, hiS.x, hiS.y) + ' carried your mark and ' + pct(loS.m / Math.max(1, loS.n)) + ' of the one on ' + where(D.L, loS.x, loS.y) + '. ';
    html += (hiS.m / Math.max(1, hiS.n) > 3 * Math.max(0.01, loS.m / Math.max(1, loS.n)) ? 'That is the whole trouble with the arithmetic: it assumes the marked fish mix back into the mere evenly, and fish that keep to their own corner do not. Nets that keep going back to the same water catch the same fish, the recaptures run high and the estimate comes in low. ' : 'Your marks were spread fairly evenly between the shoals, which is what the arithmetic needs. ');
    html += '<br><br><b>Other keepers, the same fish, the same six mornings.</b> Spreading three nets around the mere every day, 120 trial weeks gave a middle estimate of <b>' + fmt(sp.med) + '</b> (eight in ten between ' + fmt(sp.q1) + ' and ' + fmt(sp.q9) + '). Setting all three on the biggest shoal every day gave <b>' + fmt(bay.med) + '</b> (' + fmt(bay.q1) + ' to ' + fmt(bay.q9) + '). ';
    html += (sp.med < N * 0.9 ? 'Even the spread design comes in a little low, because some ' + D.sp.pl + ' are simply bolder about nets than others and get caught over and over; Schnabel’s sum assumes every fish is equally catchable. ' : '');
    if (s) html += Math.abs(s.n - R.n) <= Math.max(2, R.n * 0.01) ? 'You reported the clerk’s figure from Schnabel’s sum, so the netting decided this, not the arithmetic.' : 'Schnabel’s sum on your own book said ' + fmt(s.n) + '; ' + (Math.abs(s.n - N) < Math.abs(R.n - N) ? 'you would have done better to trust it.' : 'your own judgement beat the formula.');
    V.innerHTML = html;
  }
  function renderAll() { renderControls(); renderBook(); renderVerdict(); if (!rises.length) spawnRises(); draw(performance.now()); }

  /* ---------- wiring ---------- */
  function wire() {
    cv.addEventListener('click', onTap);
    $('btnHaul').onclick = doHaul;
    $('btnClear').onclick = function () { if (!st.done) { st.nets = []; renderControls(); draw(); } };
    $('btnReport').onclick = doReport;
    $('btnUse').onclick = function () {
      var s = schnabel(st.book); if (!s || st.done) return;
      $('estN').value = Math.round(s.n); $('estLo').value = Math.round(s.lo); $('estHi').value = isFinite(s.hi) ? Math.round(s.hi) : '';
    };
    $('btnReset').onclick = function () { st = fresh(); rises = []; spawnRises(); say(''); $('estN').value = ''; $('estLo').value = ''; $('estHi').value = ''; renderAll(); };
    $('btnDayPrev').onclick = function () { dayOff--; rises = []; load(); };
    $('btnDayNext').onclick = function () { dayOff++; rises = []; load(); };
    $('btnDayToday').onclick = function () { dayOff = 0; rises = []; load(); };
    document.addEventListener('keydown', function (e) {
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { dayOff--; rises = []; load(); }
      else if (e.key === 'ArrowRight') { dayOff++; rises = []; load(); }
    });
    window.addEventListener('resize', resize);
  }

  wire();
  load();
  resize();
  if (!reduce) raf = requestAnimationFrame(loop);
})();
