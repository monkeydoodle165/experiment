/* drift.quibo.games — The Lock
   A day at the head of a flight of canal locks. The day's number cuts a canal somewhere in
   England between 1795 and 1845, climbs it up three to six locks to a summit pound, and sends
   nine to eleven boats to the flight between six in the morning and four in the afternoon,
   some coming up from the foot and some coming down from the summit, one or two of them
   fly-boats that the company will not have kept waiting.

   Every boat that goes up the flight takes a lockful of water out of the summit. A boat coming
   down takes one too, unless the flight was left full by a boat going up, in which case she
   comes down on that water for nothing. Working the boats alternately saves water and saves
   time (the locks are already set for the next one), but waiting for a boat coming the other
   way keeps boats waiting. The company allows only so many lockfuls a day.

   The old keeper's book is found by an exact search: for every set of boats already through
   and every way the flight was left, keep only the days not beaten at once on time, water and
   waiting, and extend them by every boat still to come. Self-contained. */
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
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function $(id) { return document.getElementById(id); }
  function hm(m) {
    m = Math.round(m);
    var h = Math.floor(m / 60), mm = m % 60, nx = h >= 24, hd = h % 24, ap = hd < 12 ? 'am' : 'pm', h12 = ((hd + 11) % 12) + 1;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap + (nx ? ' (night)' : '');
  }
  function dur(m) {
    m = Math.round(m);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' hr' + (r ? ' ' + r + ' min' : '');
  }
  function lockfuls(n) { return n === 1 ? 'one lockful' : numw(n) + ' lockfuls'; }

  /* ---------- the canal ---------- */
  var RIVERS = ['Soar', 'Churnet', 'Tame', 'Dane', 'Stour', 'Calder', 'Idle', 'Dearne', 'Wey', 'Nene', 'Lune', 'Rother', 'Arrow', 'Leadon', 'Frome', 'Teme'];
  var VILLAGES = ['Hatherley', 'Netherwick', 'Foxcote', 'Smallbrook', 'Aldermoor', 'Kingsditch', 'Brindle Heath', 'Wenlow', 'Cobley',
    'Ashby Parva', 'Tilsworth', 'Hollins Green', 'Marston Bank', 'Pelsall Wood', 'Rushbury', 'Coldharbour'];
  var BOATNAMES = ['Industry', 'Perseverance', 'Good Intent', 'Ann and Mary', 'Hope', 'Swallow', 'Providence', 'Endeavour', 'Two Brothers',
    'Speedwell', 'Prosperous', 'Kingfisher', 'Mayflower', 'Dove', 'Unity', 'Fanny', 'Eliza', 'Willing Mind', 'Heron', 'Lark', 'Content',
    'Diligence', 'Polly', 'Sisters'];
  var OWNERS = ['Crowther and Sons', 'Wm. Bellamy', 'Hartshorne and Gee', 'Thos. Pedley', 'Sarah Mottram', 'Jas. Tunnicliffe', 'Eli Bratt',
    'the Heath Colliery', 'the Lime Works', 'Ezra Toft', 'Josiah Fearn', 'the Brick Company'];
  var FLYOWNERS = ['Deakin\'s Fly-Boats', 'the Swift Carrying Company', 'Ormerod\'s Fly Packets'];
  var CARGO = ['coal', 'lime', 'salt', 'crated pottery', 'corn', 'deals', 'roadstone', 'bricks', 'flints for the potteries', 'pig iron',
    'china clay', 'manure for the farms', 'malt', 'nothing, going back light'];
  var PAINT = ['#c8483c', '#3f8f5a', '#3a6fb8', '#d9a53a', '#8a4fa6', '#2f9c9c', '#b86b2e', '#5d7d2c'];

  var UP = 0, DOWN = 1;

  function passage(D, dir, last) {
    var against = dir === last;
    return { against: against, dur: D.k * D.W + (against ? D.k * D.S : 0), water: dir === UP ? 1 : (last === DOWN ? 1 : 0) };
  }

  /* run boats through in a given order, each as soon as both she and the flight are ready */
  function simulate(D, order) {
    var t = D.open, last = D.dawn, out = [], w = 0, c = 0, fm = 0;
    order.forEach(function (b) {
      var bt = D.boats[b], st = Math.max(t, bt.arr), p = passage(D, bt.dir, last), wt = st - bt.arr;
      out.push({ b: b, st: st, en: st + p.dur, against: p.against, water: p.water, wait: wt, set: p.against ? D.k * D.S : 0 });
      t = st + p.dur; last = bt.dir; w += p.water; c += wt; if (bt.fly) fm = Math.max(fm, wt);
    });
    return { rows: out, t: t, w: w, c: c, fm: fm, last: last };
  }

  /* exact search over every order, with Pareto fronts on (time, water, waiting) */
  function solve(D) {
    var n = D.boats.length, full = (1 << n) - 1, F = new Array((full + 1) * 2), CAP = 16;
    function add(key, ne) {
      var fr = F[key];
      if (!fr) { F[key] = [ne]; return; }
      for (var i = 0; i < fr.length; i++) { var o = fr[i]; if (o.t <= ne.t && o.w <= ne.w && o.c <= ne.c) return; }
      fr = fr.filter(function (o) { return !(ne.t <= o.t && ne.w <= o.w && ne.c <= o.c); });
      fr.push(ne);
      if (fr.length > CAP) {
        var mw = fr[0], mt = fr[0];
        fr.forEach(function (o) { if (o.w < mw.w || (o.w === mw.w && o.c < mw.c)) mw = o; if (o.t < mt.t) mt = o; });
        fr.sort(function (a, b) { return a.c - b.c || a.w - b.w || a.t - b.t; });
        var keep = fr.slice(0, CAP - 2);
        if (keep.indexOf(mw) < 0) keep.push(mw);
        if (keep.indexOf(mt) < 0) keep.push(mt);
        fr = keep;
      }
      F[key] = fr;
    }
    F[D.dawn] = [{ t: D.open, w: 0, c: 0, prev: null, b: -1 }];
    for (var m = 0; m < full; m++) {
      for (var l = 0; l < 2; l++) {
        var fr = F[m * 2 + l];
        if (!fr) continue;
        for (var b = 0; b < n; b++) {
          if (m & (1 << b)) continue;
          var bt = D.boats[b], p = passage(D, bt.dir, l), key = (m | (1 << b)) * 2 + bt.dir;
          for (var i = 0; i < fr.length; i++) {
            var e = fr[i], st = Math.max(e.t, bt.arr), wt = st - bt.arr;
            if (bt.fly && wt > D.fly) continue;
            add(key, { t: st + p.dur, w: e.w + p.water, c: e.c + wt, prev: e, b: b });
          }
        }
      }
    }
    var ends = (F[full * 2] || []).concat(F[full * 2 + 1] || []);
    if (!ends.length) return null;
    var minW = Infinity; ends.forEach(function (e) { if (e.w < minW) minW = e.w; });
    function orderOf(e) { var o = []; while (e && e.b >= 0) { o.unshift(e.b); e = e.prev; } return o; }
    return {
      minW: minW,
      bestUnder: function (A) {
        var best = null;
        ends.forEach(function (e) { if (e.w <= A && (!best || e.c < best.c || (e.c === best.c && (e.w < best.w || (e.w === best.w && e.t < best.t))))) best = e; });
        return best ? orderOf(best) : null;
      }
    };
  }

  function gen(date, attempt) {
    var r = rng(mix(seedForDate(date), 46 + attempt * 7919)), D = { date: date };
    D.year = 1795 + Math.floor(r() * 51);
    var rv = shuffle(r, RIVERS);
    D.canal = 'the ' + rv[0] + ' and ' + rv[1] + ' Canal';
    D.village = pick(r, VILLAGES);
    D.k = 3 + Math.floor(r() * 4);
    D.rise = 6 + Math.floor(r() * 5);
    D.W = 6 + Math.floor(r() * 3);
    D.S = 4 + Math.floor(r() * 2);
    D.dawn = r() < 0.5 ? UP : DOWN;
    D.fly = 20;
    D.open = 360;
    D.inch = (8 + Math.floor(r() * 6)) / 10;
    D.month = 3 + Math.floor(r() * 6);
    D.dom = 1 + Math.floor(r() * 28);
    D.keeper = pick(r, ['Amos', 'Reuben', 'Hannah', 'Job', 'Martha', 'Isaac', 'Esther', 'Silas']) + ' ' + pick(r, ['Wardle', 'Cope', 'Hulme', 'Salt', 'Brough', 'Pegg', 'Shenton', 'Bloor']);
    var n = 9 + Math.floor(r() * 3);
    var nUp = Math.max(3, Math.min(n - 3, Math.round(n / 2 + (r() - 0.5) * 3)));
    var dirs = []; for (var i = 0; i < n; i++) dirs.push(i < nUp ? UP : DOWN);
    dirs = shuffle(r, dirs);
    var nc = 3 + Math.floor(r() * 2), centers = [];
    for (i = 0; i < nc; i++) centers.push(400 + r() * 520);
    var names = shuffle(r, BOATNAMES), paint = shuffle(r, PAINT);
    var boats = dirs.map(function (d, i) {
      var c = pick(r, centers), t = c + (r() + r() + r() - 1.5) * 55;
      t = Math.round(Math.max(360, Math.min(980, t)) / 5) * 5;
      return { dir: d, arr: t, name: names[i], owner: pick(r, OWNERS), cargo: pick(r, CARGO), fly: false, paint: paint[i % paint.length] };
    });
    boats.sort(function (a, b) { return a.arr - b.arr || a.dir - b.dir; });
    var nf = r() < 0.5 ? 1 : 2, fi = shuffle(r, boats.map(function (_, i) { return i; })).slice(0, nf);
    fi.forEach(function (i) { var b = boats[i]; b.fly = true; b.owner = pick(r, FLYOWNERS); b.cargo = 'parcels and general goods'; });
    boats.forEach(function (b, i) { b.id = i; });
    D.boats = boats;
    D.open = boats[0].arr;
    return D;
  }

  function build(date) {
    var D = null;
    for (var at = 0; at < 40; at++) {
      var G = gen(date, at), S = solve(G);
      if (!S) continue;
      G.fifo = simulate(G, G.boats.map(function (b) { return b.id; }));
      var gap = G.fifo.w - S.minW;
      if (gap < 2) { if (!D) { D = G; D._S = S; } continue; }
      G.allow = S.minW + Math.floor((gap - 1) / 2);
      G.best = simulate(G, S.bestUnder(G.allow));
      return G;
    }
    D.allow = D.fifo.w;
    D.best = simulate(D, D._S.bestUnder(D.allow));
    return D;
  }

  /* ---------- state ---------- */
  var dayOff = 0, D = null, P = null, busy = false, anim = null, gave = false;

  function fresh() {
    return { t: D.open, last: D.dawn, rows: [], w: 0, c: 0, fm: 0, mask: 0, f: D.dawn === UP ? 1 : 0, boat: null, clock: D.open };
  }

  function load() {
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    busy = false; gave = false;
    D = build(dateFor(dayOff));
    P = fresh();
    P.fl = []; for (var i = 0; i < D.k; i++) P.fl.push(P.f);
    var up = D.boats.filter(function (b) { return b.dir === UP; }).length;
    var flies = D.boats.filter(function (b) { return b.fly; });
    $('plWho').textContent = D.canal + ' · ' + D.dom + ' ' + MONTHS[D.month] + ' ' + D.year;
    $('plName').textContent = cap(D.village) + ' Locks';
    $('plBlurb').innerHTML = 'A flight of <b>' + numw(D.k) + ' locks</b>, ' + D.rise + ' feet each, lifting the canal ' + (D.k * D.rise) +
      ' feet from the ' + D.village + ' pound to the summit. You keep it today. <b>' + cap(numw(D.boats.length)) + ' boats</b> are expected: ' +
      numw(up) + ' to go up and ' + numw(D.boats.length - up) + ' to come down. The last boat last night went ' + (D.dawn === UP ? 'up, so the flight is <b>full</b>' : 'down, so the flight is <b>empty</b>') +
      ' this morning.' +
      '<br><br>The company\'s orders: draw no more than <b>' + lockfuls(D.allow) + '</b> from the summit today (each takes about ' + D.inch.toFixed(1) +
      ' inches off it, and the reservoir is low). ' + (flies.length === 1 ? 'The fly-boat <b>' + esc(flies[0].name) + '</b>' : 'The fly-boats <b>' + esc(flies[0].name) + '</b> and <b>' + esc(flies[1].name) + '</b>') +
      ' must not be kept more than ' + D.fly + ' minutes. And get everybody through without keeping them about.';
    $('rules').innerHTML =
      '<span><b>' + D.W + ' min</b> a lock to work a boat through</span>' +
      '<span><b>' + D.S + ' min</b> a lock to set it first, when it is against her</span>' +
      '<span><b>Up</b> always takes a lockful</span>' +
      '<span><b>Down</b> is free if the flight is full</span>';
    $('dayOut').textContent = longDate(D.date) + (dayOff === 0 ? ' (today)' : '');
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').innerHTML = ''; $('reveal').style.display = 'none';
    $('msg').textContent = '';
    render();
  }

  /* ---------- the queue and the book ---------- */
  function render() {
    renderStats();
    renderLanes();
    renderBook();
    draw();
  }

  function renderStats() {
    var through = P.rows.length;
    $('stats').innerHTML =
      stat('Clock', hm(P.clock)) +
      stat('Flight', P.fl.every(function (v) { return v > 0.5; }) ? 'full' : P.fl.every(function (v) { return v < 0.5; }) ? 'empty' : 'working') +
      stat('Summit drawn', P.w + ' of ' + D.allow, P.w > D.allow ? 'bad' : '') +
      stat('Through', through + ' of ' + D.boats.length) +
      stat('Boat-minutes waited', String(P.c));
  }
  function stat(k, v, cls) { return '<div class="stat ' + (cls || '') + '"><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>'; }

  function renderLanes() {
    var lanes = [[], []];
    D.boats.forEach(function (b) { if (!(P.mask & (1 << b.id))) lanes[b.dir].push(b); });
    [UP, DOWN].forEach(function (dir) {
      var el = $(dir === UP ? 'laneUp' : 'laneDown');
      if (!lanes[dir].length) { el.innerHTML = '<p class="empty">Nobody left ' + (dir === UP ? 'to go up' : 'to come down') + ' today.</p>'; return; }
      el.innerHTML = lanes[dir].map(function (b) {
        var here = b.arr <= P.t, st = Math.max(P.t, b.arr), p = passage(D, dir, P.last), wt = st - b.arr;
        var late = b.fly && wt > D.fly;
        var verb = dir === UP ? 'Work her up' : 'Work her down';
        var label = here ? verb : 'Hold the flight ' + dur(b.arr - P.t) + ' for her';
        var meta = dur(p.dur) + ' · ' + (p.water ? '1 lockful' : 'no water') + ' · ' + (p.against ? 'set against her' : 'in her favour');
        return '<div class="boat' + (here ? ' here' : '') + (b.fly ? ' fly' : '') + '">' +
          '<div class="boat-top"><i class="flag" style="background:' + b.paint + '"></i><b>' + esc(b.name) + '</b>' + (b.fly ? '<span class="tag">fly-boat</span>' : '') + '</div>' +
          '<p class="boat-who">' + esc(b.owner) + ' · ' + esc(b.cargo) + '</p>' +
          '<p class="boat-when">' + (here ? 'waiting since ' + hm(b.arr) + (P.t > b.arr ? ' (' + dur(P.t - b.arr) + ')' : '') : 'due at ' + hm(b.arr)) +
          (late ? ' · <span class="bad">past the ' + D.fly + ' minutes</span>' : '') + '</p>' +
          '<button class="btn small' + (here ? '' : ' ghost') + '" type="button" data-b="' + b.id + '"' + (busy || gave ? ' disabled' : '') + '>' + label + '</button>' +
          '<p class="boat-meta">' + meta + '</p></div>';
      }).join('');
    });
  }

  function renderBook() {
    if (!P.rows.length) { $('book').innerHTML = '<p class="empty">Nothing through yet. The first boat is due at ' + hm(D.boats[0].arr) + '.</p>'; return; }
    $('book').innerHTML = '<div class="tablewrap"><table><thead><tr><th>Boat</th><th>Way</th><th>Came</th><th>Started</th><th>Through</th><th>Waited</th><th>Summit</th></tr></thead><tbody>' +
      P.rows.map(function (r) {
        var b = D.boats[r.b];
        return '<tr><td><i class="flag" style="background:' + b.paint + '"></i>' + esc(b.name) + (b.fly ? ' <span class="tag">fly</span>' : '') + '</td><td>' + (b.dir === UP ? 'up' : 'down') + '</td><td>' + hm(b.arr) +
          '</td><td>' + hm(r.st) + '</td><td>' + hm(r.en) + '</td><td' + (b.fly && r.wait > D.fly ? ' class="bad"' : '') + '>' + dur(r.wait) + '</td><td>' + (r.water ? '1' : '–') + (r.against ? ' <span class="dimtxt">(set)</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  $('lanes').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-b]');
    if (!btn || busy || gave) return;
    work(+btn.getAttribute('data-b'));
  });

  function work(b) {
    var bt = D.boats[b], st = Math.max(P.t, bt.arr), p = passage(D, bt.dir, P.last), wt = st - bt.arr;
    var row = { b: b, st: st, en: st + p.dur, against: p.against, water: p.water, wait: wt, set: p.against ? D.k * D.S : 0 };
    busy = true;
    $('msg').innerHTML = (st > P.t ? 'The flight stands idle ' + dur(st - P.t) + ' until <b>' + esc(bt.name) + '</b> comes in sight. ' : '') +
      (p.against ? 'The flight is against her, so every lock is ' + (bt.dir === UP ? 'drawn off' : 'filled') + ' first' + (bt.dir === DOWN ? ', and that water comes out of the summit' : '') + '. ' :
        'The flight is set in her favour. ') +
      (bt.dir === UP ? 'She goes up, and fills the top lock from the summit.' : p.water ? 'She goes down.' : 'She comes down on the water the last boat left behind.');
    renderLanes();
    animate(P.t, row, function () {
      P.rows.push(row); P.t = row.en; P.clock = row.en; P.last = bt.dir; P.w += p.water; P.c += wt; if (bt.fly) P.fm = Math.max(P.fm, wt);
      P.mask |= (1 << b);
      busy = false;
      render();
      if (P.rows.length === D.boats.length) finish(false);
    });
  }

  /* ---------- the drawing ---------- */
  var cv = $('flight'), ctx = cv.getContext('2d'), G = null;

  function geom() {
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600, h = w < 520 ? 210 : 250;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var k = D.k, m = 10, avail = w - 2 * m, lp = avail * 0.17, rest = avail - 2 * lp, lc = rest / (k + 0.55 * (k - 1)), li = 0.55 * lc;
    var bot = h - 44, top = 74, step = (bot - top) / k, xs = [], cx = [], px = [], lv = [];
    for (var i = 0; i <= k; i++) lv.push(bot - i * step);
    for (i = 0; i < k; i++) { xs.push(m + lp + i * (lc + li)); cx.push(xs[i] + lc / 2); }
    px.push(m + lp * 0.55);
    for (i = 1; i < k; i++) px.push(xs[i] - li / 2);
    px.push(w - m - lp * 0.55);
    return { w: w, h: h, m: m, lp: lp, lc: lc, li: li, xs: xs, cx: cx, px: px, lv: lv, depth: Math.min(18, step * 0.6 + 6), k: k };
  }

  function levelAt(x) {
    var g = G;
    if (x < g.xs[0]) return g.lv[0];
    for (var i = 0; i < g.k; i++) {
      if (x <= g.xs[i] + g.lc) return x >= g.xs[i] ? g.lv[i] + (g.lv[i + 1] - g.lv[i]) * P.fl[i] : g.lv[i];
    }
    return g.lv[g.k];
  }

  function hull(x, y, len, col, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = '#1b1712';
    ctx.beginPath(); ctx.moveTo(x - len / 2, y - 4); ctx.lineTo(x + len / 2 - 4, y - 4); ctx.lineTo(x + len / 2, y + 1); ctx.lineTo(x + len / 2 - 5, y + 5); ctx.lineTo(x - len / 2, y + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(x - len / 2, y - 4, len - 6, 2.5);
    ctx.fillStyle = col; ctx.fillRect(x - len / 2, y - 12, len * 0.28, 8);
    ctx.fillStyle = '#e8d9b0'; ctx.fillRect(x - len / 2 + 3, y - 10, 3, 3);
    ctx.fillStyle = 'rgba(232,217,176,.55)'; ctx.fillRect(x - len / 2 + len * 0.3, y - 7, len * 0.6, 3);
    ctx.restore();
  }

  function draw() {
    if (!D) return;
    G = geom();
    var g = G, w = g.w, h = g.h, d = g.depth, i;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0e131b'; ctx.fillRect(0, 0, w, h);
    /* the hillside */
    ctx.fillStyle = '#141b14';
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, g.lv[0] - 10);
    ctx.lineTo(g.xs[0], g.lv[0] - 10);
    for (i = 0; i < g.k; i++) { ctx.lineTo(g.xs[i] + g.lc * 0.15, g.lv[i + 1] - 10); ctx.lineTo(i < g.k - 1 ? g.xs[i + 1] : w, g.lv[i + 1] - 10); }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    /* water */
    ctx.fillStyle = 'rgba(86,150,214,.62)';
    ctx.fillRect(0, g.lv[0], g.xs[0], d);
    for (i = 0; i < g.k; i++) {
      var y = g.lv[i] + (g.lv[i + 1] - g.lv[i]) * P.fl[i];
      ctx.fillRect(g.xs[i], y, g.lc, g.lv[i] + d - y);
      var x2 = g.xs[i] + g.lc, x3 = i < g.k - 1 ? g.xs[i + 1] : w;
      ctx.fillRect(x2, g.lv[i + 1], x3 - x2, d);
    }
    /* masonry: beds, chamber walls, sills */
    ctx.fillStyle = '#5a4a3c';
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, g.lv[0] + d);
    for (i = 0; i < g.k; i++) {
      ctx.lineTo(g.xs[i] + g.lc, g.lv[i] + d); ctx.lineTo(g.xs[i] + g.lc, g.lv[i + 1] + d);
    }
    ctx.lineTo(w, g.lv[g.k] + d); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
    for (var by = 0; by < h; by += 7) { ctx.beginPath(); ctx.moveTo(0, by + 0.5); ctx.lineTo(w, by + 0.5); ctx.stroke(); }
    /* gates and coping */
    for (i = 0; i < g.k; i++) {
      var a = g.xs[i], b = a + g.lc, tp = g.lv[i + 1] - 9;
      ctx.strokeStyle = '#8a7a66'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a, tp); ctx.lineTo(b, tp); ctx.stroke();
      ctx.strokeStyle = '#c9b28a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(a, tp); ctx.lineTo(a, g.lv[i] + d); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b, tp); ctx.lineTo(b, g.lv[i + 1] + d); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a, tp); ctx.lineTo(a - Math.min(26, g.li * 0.8 + 6), tp - 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b, tp); ctx.lineTo(b + Math.min(26, (i < g.k - 1 ? g.li : g.lp) * 0.8), tp - 3); ctx.stroke();
      ctx.fillStyle = '#8b97ab'; ctx.font = '600 10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), g.cx[i], g.lv[i] + d + 14);
    }
    /* boats waiting at the foot and the head */
    var wu = [], wd = [];
    D.boats.forEach(function (b) { if (!(P.mask & (1 << b.id)) && b.arr <= P.clock && !(P.boat && P.boat.id === b.id)) (b.dir === UP ? wu : wd).push(b); });
    var bl = Math.max(26, Math.min(48, g.lc * 0.78)), sl = Math.max(18, bl * 0.62);
    wu.slice(0, 4).forEach(function (b, j) { hull(g.m + sl / 2 + 2 + j * (sl + 3), g.lv[0] + 1, sl, b.paint, 0.85); });
    wd.slice(0, 4).forEach(function (b, j) { hull(w - g.m - sl / 2 - 2 - j * (sl + 3), g.lv[g.k] + 1, sl, b.paint, 0.85); });
    ctx.font = '600 10px ui-monospace,Menlo,monospace'; ctx.fillStyle = '#d8cbb4';
    ctx.textAlign = 'left'; if (wu.length) ctx.fillText(wu.length + ' waiting', g.m, g.lv[0] + d + 14);
    ctx.textAlign = 'right'; if (wd.length) ctx.fillText(wd.length + ' waiting', w - g.m, g.lv[g.k] + d + 14);
    /* the working boat */
    if (P.boat) {
      var yb = levelAt(P.boat.x) + 1;
      hull(P.boat.x, yb, bl, P.boat.paint, 1);
      ctx.fillStyle = '#e8edf5'; ctx.textAlign = 'center'; ctx.font = 'italic 12px Georgia,serif';
      ctx.fillText(P.boat.name, P.boat.x, yb - 18);
    }
    /* clock and gauge */
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8edf5'; ctx.font = '700 15px ui-monospace,Menlo,monospace';
    ctx.fillText(hm(P.clock), 12, 22);
    ctx.fillStyle = '#8b97ab'; ctx.font = '600 10px ui-monospace,Menlo,monospace';
    ctx.fillText(D.village.toUpperCase() + ' POUND', 12, 38);
    ctx.textAlign = 'right';
    ctx.fillStyle = P.w > D.allow ? '#ff8a7a' : '#64f0c8'; ctx.font = '700 13px ui-monospace,Menlo,monospace';
    ctx.fillText('SUMMIT ' + P.w + ' / ' + D.allow, w - 12, 22);
    ctx.fillStyle = '#8b97ab'; ctx.font = '600 10px ui-monospace,Menlo,monospace';
    ctx.fillText((P.w * D.inch).toFixed(1) + ' in drawn off', w - 12, 38);
    /* gauge ticks */
    var gx = w - 14, gy0 = 46, gh = 8;
    for (i = 0; i < Math.max(D.allow, P.w); i++) {
      ctx.fillStyle = i < P.w ? (i < D.allow ? '#64f0c8' : '#ff8a7a') : 'rgba(255,255,255,.12)';
      ctx.fillRect(gx - (i + 1) * 9 + 2, gy0, 7, gh - 3);
    }
  }

  window.addEventListener('resize', function () { draw(); });

  /* ---------- a passage, animated ---------- */
  function animate(t0, row, done) {
    var bt = D.boats[row.b], k = D.k, ph = [], i;
    var g = geom(); G = g;
    var bl = Math.max(26, Math.min(48, g.lc * 0.78));
    if (row.st > t0) ph.push({ d: row.st - t0, fn: function () { }, idle: true });
    function mv(a, b, d) { ph.push({ d: d, fn: function (p) { P.boat.x = a + (b - a) * p; } }); }
    function lvl(j, a, b, d) { ph.push({ d: d, fn: function (p) { P.fl[j] = a + (b - a) * p; } }); }
    if (bt.dir === UP) {
      if (row.against) for (i = 0; i < k; i++) lvl(i, 1, 0, D.S);
      ph.push({ d: 0, fn: function () { P.boat.x = g.px[0]; } });
      for (i = 0; i < k; i++) { mv(g.px[i], g.cx[i], D.W * 0.25); lvl(i, 0, 1, D.W * 0.5); mv(g.cx[i], g.px[i + 1], D.W * 0.25); }
      mv(g.px[k], g.w + bl, 0);
    } else {
      if (row.against) for (i = k - 1; i >= 0; i--) lvl(i, 0, 1, D.S);
      ph.push({ d: 0, fn: function () { P.boat.x = g.px[k]; } });
      for (i = k - 1; i >= 0; i--) { mv(g.px[i + 1], g.cx[i], D.W * 0.25); lvl(i, 1, 0, D.W * 0.5); mv(g.cx[i], g.px[i], D.W * 0.25); }
      mv(g.px[0], -bl, 0);
    }
    var total = row.en - t0, msPer = Math.min(42, 4200 / Math.max(1, total)), extra = 260;
    ph.forEach(function (p) { p.ms = p.idle ? Math.min(700, p.d * msPer) : (p.d ? p.d * msPer : extra); });
    var idx = 0, start = null, clockAt = t0;
    P.boat = { id: bt.id, x: bt.dir === UP ? -bl : g.w + bl, paint: bt.paint, name: bt.name };
    function frame(ts) {
      if (start === null) start = ts;
      var p = ph[idx], q = Math.min(1, (ts - start) / p.ms);
      p.fn(q);
      P.clock = clockAt + p.d * q;
      draw(); renderStats();
      if (q >= 1) {
        clockAt += p.d; idx++; start = ts;
        if (idx >= ph.length) { anim = null; P.boat = null; P.clock = row.en; done(); return; }
      }
      anim = requestAnimationFrame(frame);
    }
    anim = requestAnimationFrame(frame);
  }

  /* ---------- the end of the day ---------- */
  function finish(gaveUp) {
    var over = P.w > D.allow, flyBad = P.fm > D.fly, best = D.best, fifo = D.fifo, o = '';
    var good = !over && !flyBad && P.c <= best.c * 1.15 + 5;
    if (gaveUp) {
      o += '<p><b>The old keeper\'s book.</b> ' + cap(lockfuls(best.w)) + ' drawn of the ' + numw(D.allow) + ' allowed, the fly-boats through within ' + D.fly +
        ' minutes, and ' + best.c + ' boat-minutes of waiting in all. The last boat clears the flight at ' + hm(best.t) + '.</p>';
    } else {
      o += over ? '<p><b>The summit is down.</b> You drew ' + lockfuls(P.w) + ' against the company\'s ' + numw(D.allow) + ', about ' + ((P.w - D.allow) * D.inch).toFixed(1) +
        ' inches more than the engineer allows. He will walk the towpath in the morning with the bye-laws in his pocket.</p>' :
        '<p><b>The summit held.</b> ' + cap(lockfuls(P.w)) + ' drawn of the ' + numw(D.allow) + ' allowed' + (P.w < D.allow ? ', with ' + lockfuls(D.allow - P.w) + ' to spare' : '') + '.</p>';
      var flies = D.boats.filter(function (b) { return b.fly; });
      var worst = null; P.rows.forEach(function (r) { var b = D.boats[r.b]; if (b.fly && (!worst || r.wait > worst.wait)) worst = r; });
      o += flyBad ? '<p><b>' + esc(D.boats[worst.b].owner) + ' will complain.</b> Their <i>' + esc(D.boats[worst.b].name) + '</i> was kept ' + dur(worst.wait) +
        ' at the flight, and a fly-boat is paid to keep moving.</p>' :
        '<p>' + (flies.length === 1 ? 'The fly-boat was' : 'Both fly-boats were') + ' through within ' + D.fly + ' minutes.</p>';
      o += '<p>Boats waited <b>' + P.c + ' boat-minutes</b> in all, and the last cleared the flight at ' + hm(P.t) + '. The old keeper\'s book, keeping to the same orders, manages <b>' +
        best.c + '</b>. ' + (P.c < best.c ? 'You beat the book.' : P.c === best.c ? 'You matched it to the minute.' : P.c <= best.c * 1.15 + 5 ? 'Close enough that nobody on the towpath would notice.' : '') + '</p>';
    }
    o += '<p>Worked strictly as they came, the day would have drawn ' + lockfuls(fifo.w) + (fifo.w > D.allow ? ' (more than the company allows)' : '') + ', kept boats waiting ' + fifo.c +
      ' boat-minutes' + (fifo.fm > D.fly ? ' and kept a fly-boat ' + dur(fifo.fm) : '') + '.</p>';
    $('verdict').innerHTML = o;
    $('verdict').className = 'verdict ' + (gaveUp ? '' : good ? 'good' : 'warn');
    var rv = '';
    if (!gaveUp) rv += '<h5>Your day</h5>' + gantt(P.rows, P.t);
    rv += '<h5>The old keeper\'s book</h5>' + gantt(best.rows, best.t);
    rv += '<div class="legend"><span><i style="background:#64f0c8"></i>going up</span><span><i style="background:#7aa2ff"></i>coming down</span>' +
      '<span><i style="background:rgba(255,206,106,.75)"></i>setting the flight first</span><span><i class="dash"></i>waiting</span><span><i class="drop"></i>a lockful from the summit</span></div>';
    rv += '<p class="formula">The book is found by searching every order the boats could go in. For each set of boats already through, and each way the flight could have been left, ' +
      'it keeps only the part-days that nothing else beats at once on the clock, the water and the waiting, then tries every boat still to come after each. ' +
      'With ' + numw(D.boats.length) + ' boats that is ' + (1 << D.boats.length) + ' sets, instead of ' + factorial(D.boats.length) + ' orders.</p>';
    $('reveal').innerHTML = rv; $('reveal').style.display = '';
  }
  function factorial(n) { var f = 1; for (var i = 2; i <= n; i++) f *= i; return f.toLocaleString('en-GB'); }

  function gantt(rows, endT) {
    var t0 = Math.floor(D.open / 60) * 60, t1 = Math.max(18 * 60, Math.ceil((endT + 10) / 60) * 60), W = 680, l = 118, rr = 10, rh = 20, tp = 8;
    var order = rows.slice().sort(function (a, b) { return D.boats[a.b].arr - D.boats[b.b].arr; });
    var n = order.length, sh = 46, H = tp + n * rh + 26 + sh + 22;
    function X(t) { return l + (W - l - rr) * (t - t0) / (t1 - t0); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="curves" role="img" aria-label="Timeline of the boats through the flight">';
    for (var hh = t0; hh <= t1; hh += 60) {
      s += '<line x1="' + X(hh) + '" x2="' + X(hh) + '" y1="' + tp + '" y2="' + (tp + n * rh) + '" stroke="rgba(255,255,255,.07)"/>';
      s += '<text x="' + X(hh) + '" y="' + (tp + n * rh + 14) + '" text-anchor="middle">' + (((hh / 60 + 11) % 12) + 1) + '</text>';
    }
    order.forEach(function (r, i) {
      var b = D.boats[r.b], y = tp + i * rh + rh / 2, col = b.dir === UP ? '#64f0c8' : '#7aa2ff';
      s += '<text x="' + (l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + (b.dir === UP ? '↑ ' : '↓ ') + esc(b.name.length > 13 ? b.name.slice(0, 12) + '…' : b.name) + '</text>';
      if (r.wait > 0) s += '<line x1="' + X(b.arr) + '" x2="' + X(r.st) + '" y1="' + y + '" y2="' + y + '" stroke="' + (b.fly && r.wait > D.fly ? '#ff8a7a' : 'rgba(255,255,255,.45)') + '" stroke-dasharray="3 3"/>';
      s += '<circle cx="' + X(b.arr) + '" cy="' + y + '" r="2.5" fill="rgba(255,255,255,.6)"/>';
      if (r.set) s += '<rect x="' + X(r.st) + '" y="' + (y - 6) + '" width="' + (X(r.st + r.set) - X(r.st)) + '" height="12" rx="2" fill="rgba(255,206,106,.75)"/>';
      s += '<rect x="' + X(r.st + r.set) + '" y="' + (y - 6) + '" width="' + Math.max(1, X(r.en) - X(r.st + r.set)) + '" height="12" rx="2" fill="' + col + '"/>';
      if (b.fly) s += '<text x="' + (X(r.en) + 4) + '" y="' + (y + 4) + '" fill="#ffce6a" style="fill:#ffce6a">fly</text>';
    });
    /* the summit, lockful by lockful */
    var sy = tp + n * rh + 26, A = D.allow, maxW = Math.max(A + 1, rows.reduce(function (a, r) { return a + r.water; }, 0));
    function Y(v) { return sy + sh - sh * v / maxW; }
    s += '<text x="' + (l - 8) + '" y="' + (sy + sh / 2 + 4) + '" text-anchor="end">summit drawn</text>';
    s += '<line x1="' + l + '" x2="' + (W - rr) + '" y1="' + Y(A) + '" y2="' + Y(A) + '" stroke="#ffce6a" stroke-dasharray="5 4" opacity=".7"/>';
    s += '<text x="' + (W - rr) + '" y="' + (Y(A) - 4) + '" text-anchor="end" style="fill:#ffce6a">allowed ' + A + '</text>';
    var cum = 0, path = 'M' + l + ' ' + Y(0), byStart = rows.slice().sort(function (a, b) { return a.st - b.st; });
    byStart.forEach(function (r) {
      if (!r.water) return;
      var x = X(D.boats[r.b].dir === UP ? r.st + r.set + D.W * 0.5 : r.st);
      path += 'L' + x.toFixed(1) + ' ' + Y(cum).toFixed(1); cum++; path += 'L' + x.toFixed(1) + ' ' + Y(cum).toFixed(1);
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + Y(cum).toFixed(1) + '" r="2.6" fill="#5696d6"/>';
    });
    path += 'L' + (W - rr) + ' ' + Y(cum).toFixed(1);
    s += '<path d="' + path + '" fill="none" stroke="' + (cum > A ? '#ff8a7a' : '#5696d6') + '" stroke-width="2"/>';
    s += '<line x1="' + l + '" x2="' + (W - rr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="rgba(255,255,255,.12)"/>';
    s += '</svg>';
    return s;
  }

  /* ---------- buttons and days ---------- */
  $('btnReset').addEventListener('click', function () { load(); });
  $('btnGive').addEventListener('click', function () {
    if (busy) return;
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    gave = true;
    P = fresh(); P.fl = []; for (var i = 0; i < D.k; i++) P.fl.push(D.best.last === UP ? 1 : 0);
    D.best.rows.forEach(function (r) { P.mask |= (1 << r.b); });
    P.rows = D.best.rows.slice(); P.t = D.best.t; P.clock = D.best.t; P.w = D.best.w; P.c = D.best.c; P.fm = D.best.fm;
    $('msg').textContent = 'The old keeper takes the windlass and works the day from the book.';
    render();
    finish(true);
  });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
  });

  load();
})();
