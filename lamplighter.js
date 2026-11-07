/* drift.quibo.games — The Lamplighter
   An evening lighting the gas lamps of one district of a Victorian town. The day's number picks the town (and so its
   latitude), the year, the streets that run through and the ones that are built over, where the lamps stand, the wind,
   whether this parish keeps a moon table, and how long the contract gives you after sunset. The calendar date sets the
   sunset, the twilight and the moon, worked out from the sun's real position for that town.

   You start at the lamp room at sunset with a pole. Click lamps to plan the round; the lamplighter takes the shortest
   way through the streets to each in turn and lights it. Every lamp on the list must be burning by lighting-up time,
   gusts put out lamps with cracked panes, and the company's inspector walks the district a quarter of an hour later.
   At the end the page draws your round beside a good one. Self-contained. */
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
    var h = s ^ 0x1a3b9c47;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function $(id) { return document.getElementById(id); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function money(d) {
    var neg = d < 0; d = Math.round(Math.abs(d) * 2) / 2;
    var s = Math.floor(d / 12), p = d % 12, out = [];
    if (s) out.push(s + 's');
    if (p || !out.length) { var w = Math.floor(p), hf = p - w > 0.25; out.push((w ? w : '') + (hf ? '½' : '') + (w || hf ? 'd' : '0d')); }
    return (neg ? 'minus ' : '') + out.join(' ');
  }
  function clock(t) {
    var m = Math.round(t), h = Math.floor(m / 60) % 24, mm = ((m % 60) + 60) % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (mm < 10 ? '0' : '') + mm + (h < 12 ? ' am' : ' pm');
  }

  /* ---------- the sun and the moon ---------- */
  var DEG = Math.PI / 180;
  function dayOfYear(y, m, d) { return Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 864e5); }
  function decl(n) { return -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365) * DEG; }
  function eqTime(n) { var B = 2 * Math.PI * (n - 81) / 364; return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); }
  /* altitude of the sun in degrees at t minutes after local mean midnight */
  function altitude(lat, n, t) {
    var H = ((t + eqTime(n)) / 60 - 12) * 15 * DEG, dl = decl(n), ph = lat * DEG;
    return Math.asin(Math.sin(ph) * Math.sin(dl) + Math.cos(ph) * Math.cos(dl) * Math.cos(H)) / DEG;
  }
  function sunsetAt(lat, n) {
    var dl = decl(n), ph = lat * DEG;
    var c = (Math.sin(-0.833 * DEG) - Math.sin(ph) * Math.sin(dl)) / (Math.cos(ph) * Math.cos(dl));
    return 720 + Math.acos(clamp(c, -1, 1)) / DEG * 4 - eqTime(n);
  }
  function moonAge(y, m, d) {
    var days = (Date.UTC(y, m, d, 18) - Date.UTC(2000, 0, 6, 18, 14)) / 864e5, L = 29.530588;
    return ((days % L) + L) % L;
  }
  /* 0 = night, 1 = full daylight */
  function light(alt) { return clamp((alt + 9) / 11, 0, 1); }

  /* ---------- the world ---------- */
  var TOWNS = [
    { town: 'Westminster', lat: 51.50, co: 'the Gas Light and Coke Company', mark: 'the Abbey' },
    { town: 'Edinburgh', lat: 55.95, co: 'the Edinburgh Gas Light Company', mark: 'the Tron' },
    { town: 'Manchester', lat: 53.48, co: 'the Police Commissioners’ gasworks', mark: 'the Exchange' },
    { town: 'Bristol', lat: 51.45, co: 'the Bristol Gas Company', mark: 'the Exchange' },
    { town: 'Liverpool', lat: 53.41, co: 'the Liverpool Gas Light Company', mark: 'the Town Hall' },
    { town: 'Glasgow', lat: 55.86, co: 'the Glasgow Gas Light Company', mark: 'the Cross' },
    { town: 'Dublin', lat: 53.35, co: 'the Alliance Gas Company', mark: 'the Castle' },
    { town: 'York', lat: 53.96, co: 'the York Gas Light Company', mark: 'the Minster' },
    { town: 'Norwich', lat: 52.63, co: 'the Norwich Gas Light Company', mark: 'the Market' },
    { town: 'Bath', lat: 51.38, co: 'the Bath Gas Light and Coke Company', mark: 'the Pump Room' },
    { town: 'Newcastle', lat: 54.97, co: 'the Newcastle Subscription Gas Company', mark: 'the Cloth Market' },
    { town: 'Aberdeen', lat: 57.15, co: 'the Aberdeen Gas Light Company', mark: 'the Castlegate' }
  ];
  var ROWN = ['Market Street', 'High Street', 'King Street', 'Queen Street', 'Bridge Street', 'Castle Street', 'George Street',
    'Union Street', 'Water Lane', 'Back Lane', 'Mill Lane', 'Silver Street', 'Broad Street', 'Northgate', 'Westgate'];
  var COLN = ['Church Lane', 'Chapel Street', 'Friar Street', 'Tanner’s Row', 'Wellgate', 'Pump Court', 'Cross Street',
    'Bell Lane', 'Duke Street', 'Fleece Yard', 'Smithy Row', 'Hope Street', 'Paradise Row', 'Gin Alley', 'St Mary’s Gate'];
  var WIND = [
    { name: 'still', gusts: 0, says: 'Not a breath of wind; the flames will stand straight up.' },
    { name: 'light airs', gusts: 0, says: 'A light air from the west, nothing to worry a lamp.' },
    { name: 'fresh and gusty', gusts: 2, says: 'A fresh wind gusting round the corners. A lamp with a cracked pane will not stay lit long.' },
    { name: 'a blustery gale', gusts: 3, says: 'Half a gale, and the glazier is a week behind. Expect to go back for some.' }
  ];

  var CW = 640, CH = 420, COLS = 8, ROWS = 6, MX = 46, MY = 46;
  var MPX = 1.5;                   // metres per pixel of map
  var SPEED = 66;                  // pixels a minute at the lamplighter's trot (about 100 metres)
  var LIGHT_MIN = 0.3;             // minutes to raise the pole, turn the cock and catch the flame
  var GRACE = 15;                  // the inspector goes round this many minutes after lighting-up time
  var WAGE = 30, FINE_LATE = 1, FINE_OUT = 6, WASTE = 0.5;
  var PACES = [0.8, 1.2, 2], PACENAME = ['quick', 'steady', 'slow'];

  var day, S, dayOff = 0;

  function buildDay(off) {
    var date = dateFor(off), r = rng(seedForDate(date));
    var T = pick(r, TOWNS);
    var year = 1832 + Math.floor(r() * 66);
    var mo = date.getMonth(), dd = date.getDate();
    if (mo === 1 && dd === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) dd = 28;
    var n = dayOfYear(year, mo, dd), wd = new Date(Date.UTC(year, mo, dd)).getUTCDay();
    var sunset = sunsetAt(T.lat, n);
    var age = moonAge(year, mo, dd), illum = (1 - Math.cos(2 * Math.PI * age / 29.530588)) / 2;
    var moonTable = r() < 0.45, moonUp = age > 11.5 && age < 17;
    var W = WIND[Math.floor(r() * r() * 4 + r() * 0.6)] || WIND[1];

    // streets: a jittered grid with some links built over, kept connected
    var nodes = [];
    for (var j = 0; j < ROWS; j++) for (var i = 0; i < COLS; i++) {
      nodes.push({ i: i, j: j, x: MX + i * (CW - 2 * MX) / (COLS - 1) + (r() - 0.5) * 20, y: MY + j * (CH - 2 * MY) / (ROWS - 1) + (r() - 0.5) * 18 });
    }
    var rowN = shuffle(r, ROWN.slice()).slice(0, ROWS), colN = shuffle(r, COLN.slice()).slice(0, COLS);
    var majorRow = 1 + Math.floor(r() * (ROWS - 2)), majorCol = 1 + Math.floor(r() * (COLS - 2));
    var all = [];
    for (j = 0; j < ROWS; j++) for (i = 0; i < COLS; i++) {
      var k = j * COLS + i;
      if (i < COLS - 1) all.push({ a: k, b: k + 1, name: rowN[j], major: j === majorRow || j === 0 || j === ROWS - 1 });
      if (j < ROWS - 1) all.push({ a: k, b: k + COLS, name: colN[i], major: i === majorCol });
    }
    function connected(es) {
      var adj = nodes.map(function () { return []; });
      es.forEach(function (e) { adj[e.a].push(e.b); adj[e.b].push(e.a); });
      var seen = [0], mark = {}; mark[0] = 1;
      for (var q = 0; q < seen.length; q++) adj[seen[q]].forEach(function (v) { if (!mark[v]) { mark[v] = 1; seen.push(v); } });
      return seen.length === nodes.length;
    }
    var edges = all.slice(), cand = shuffle(r, all.filter(function (e) { return !e.major; })), want = Math.round(all.length * 0.24);
    for (var c = 0; c < cand.length && want > 0; c++) {
      var trial = edges.filter(function (e) { return e !== cand[c]; });
      if (connected(trial)) { edges = trial; want--; }
    }
    edges.forEach(function (e) { var A = nodes[e.a], B = nodes[e.b]; e.len = Math.hypot(B.x - A.x, B.y - A.y); });

    // all-pairs shortest paths through the streets
    var N = nodes.length, D = [], NX = [];
    for (i = 0; i < N; i++) { D.push(new Array(N).fill(Infinity)); NX.push(new Array(N).fill(-1)); D[i][i] = 0; NX[i][i] = i; }
    edges.forEach(function (e) { D[e.a][e.b] = D[e.b][e.a] = e.len; NX[e.a][e.b] = e.b; NX[e.b][e.a] = e.a; });
    for (k = 0; k < N; k++) for (i = 0; i < N; i++) { var dik = D[i][k]; if (dik === Infinity) continue; for (j = 0; j < N; j++) if (dik + D[k][j] < D[i][j]) { D[i][j] = dik + D[k][j]; NX[i][j] = NX[i][k]; } }

    // the lamps
    var nL = Math.min(edges.length - 4, 24 + Math.floor(r() * 9));
    var lampEdges = shuffle(r, edges.map(function (e, ix) { return ix; })).slice(0, nL);
    var lamps = lampEdges.map(function (ei) {
      var e = edges[ei], f = 0.32 + r() * 0.36, A = nodes[e.a], B = nodes[e.b];
      return { e: ei, f: f, x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, name: e.name, req: true, cracked: false };
    });
    var moonNight = moonTable && moonUp;
    if (moonNight) lamps.forEach(function (L) { if (!edges[L.e].major && r() < 0.5) L.req = false; });
    var reqL = lamps.filter(function (L) { return L.req; });
    shuffle(r, reqL.slice()).slice(0, W.gusts ? W.gusts - 1 + Math.floor(r() * 2) : 0).forEach(function (L) { L.cracked = true; L.blowDelay = 3 + r() * 6; });

    var depotNode = Math.floor(r() * ROWS) * COLS + (r() < 0.5 ? 0 : COLS - 1);

    // lit windows appear as the light goes
    var wins = [];
    for (var w = 0; w < 400 && wins.length < 120; w++) {
      var px = 6 + r() * (CW - 12), py = 6 + r() * (CH - 12), ok = true;
      for (var q2 = 0; q2 < edges.length && ok; q2++) if (segDist(px, py, nodes[edges[q2].a], nodes[edges[q2].b]) < 12) ok = false;
      if (ok) wins.push({ x: px, y: py, th: 0.15 + r() * 0.55 });
    }

    day = {
      date: date, T: T, year: year, mo: mo, dd: dd, n: n, wd: wd, sunset: sunset, age: age, illum: illum,
      moonTable: moonTable, moonUp: moonUp, moonNight: moonNight, W: W, nodes: nodes, edges: edges, D: D, NX: NX,
      lamps: lamps, depot: depotNode, wins: wins
    };

    // a good round: nearest neighbour from the lamp room, then 2-opt
    var places = [placeNode(depotNode)].concat(reqL.map(placeLamp)), M = places.length, dm = [];
    for (i = 0; i < M; i++) { dm.push([]); for (j = 0; j < M; j++) dm[i].push(i === j ? 0 : dist(places[i], places[j])); }
    var order = [0], used = {}; used[0] = 1;
    while (order.length < M) {
      var last = order[order.length - 1], best = -1;
      for (i = 1; i < M; i++) if (!used[i] && (best < 0 || dm[last][i] < dm[last][best])) best = i;
      order.push(best); used[best] = 1;
    }
    var improved = true, guard = 0;
    while (improved && guard++ < 60) {
      improved = false;
      for (i = 1; i < M - 1; i++) for (k = i + 1; k < M; k++) {
        var before = dm[order[i - 1]][order[i]] + (k + 1 < M ? dm[order[k]][order[k + 1]] : 0);
        var after = dm[order[i - 1]][order[k]] + (k + 1 < M ? dm[order[i]][order[k + 1]] : 0);
        if (after < before - 1e-6) { var seg = order.slice(i, k + 1).reverse(); for (var s = 0; s < seg.length; s++) order[i + s] = seg[s]; improved = true; }
      }
    }
    var goodLen = 0, goodPts = [];
    for (i = 1; i < M; i++) { goodLen += dm[order[i - 1]][order[i]]; goodPts = goodPts.concat(pathPts(places[order[i - 1]], places[order[i]])); }
    day.goodLen = goodLen; day.goodPts = goodPts;
    var goodMin = goodLen / SPEED + reqL.length * LIGHT_MIN;
    day.limit = Math.ceil((goodMin * 1.14 + 3) / 5) * 5;
    day.lightBy = sunset + day.limit;
    day.inspect = day.lightBy + GRACE;
    day.start = sunset;
    day.nReq = reqL.length;
  }

  function segDist(px, py, A, B) {
    var vx = B.x - A.x, vy = B.y - A.y, t = clamp(((px - A.x) * vx + (py - A.y) * vy) / (vx * vx + vy * vy), 0, 1);
    return Math.hypot(px - A.x - vx * t, py - A.y - vy * t);
  }

  /* ---------- places on the street graph ---------- */
  function placeNode(k) { var N = day.nodes[k]; return { node: k, x: N.x, y: N.y }; }
  function placeLamp(L) { return { e: L.e, f: L.f, x: L.x, y: L.y }; }
  function ends(P) {
    if (P.node != null) return [[P.node, 0]];
    var E = day.edges[P.e]; return [[E.a, P.f * E.len], [E.b, (1 - P.f) * E.len]];
  }
  function bestLink(P, Q) {
    var best = { d: Infinity };
    if (P.e != null && P.e === Q.e) best = { d: Math.abs(P.f - Q.f) * day.edges[P.e].len, direct: true };
    ends(P).forEach(function (a) {
      ends(Q).forEach(function (b) {
        var d = a[1] + day.D[a[0]][b[0]] + b[1];
        if (d < best.d) best = { d: d, a: a[0], b: b[0] };
      });
    });
    return best;
  }
  function dist(P, Q) { return bestLink(P, Q).d; }
  function pathPts(P, Q) {
    var L = bestLink(P, Q), pts = [];
    if (!L.direct) {
      var u = L.a;
      pts.push([day.nodes[u].x, day.nodes[u].y]);
      while (u !== L.b) { u = day.NX[u][L.b]; if (u < 0) break; pts.push([day.nodes[u].x, day.nodes[u].y]); }
    }
    pts.push([Q.x, Q.y]);
    return pts;
  }

  /* ---------- state ---------- */
  function fresh() {
    S = {
      phase: 'ready', t: day.start, pos: placeNode(day.depot), x: 0, y: 0, path: [], target: null, queue: [],
      lighting: 0, walked: 0, trail: [], hist: [[day.start, 0]], fast: false, hover: -1, wasted: 0,
      lit: day.lamps.map(function () { return false; }), firstLit: day.lamps.map(function () { return null; }),
      blowAt: day.lamps.map(function () { return null; }), blown: day.lamps.map(function () { return false; }), msgs: 0
    };
    S.x = S.pos.x; S.y = S.pos.y; S.trail.push([S.x, S.y]);
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    $('bGo').disabled = false; $('bGo').textContent = 'Set out from the lamp room';
    $('bFast').disabled = true;
    say('Plan the round before you go if you like: click the lamps in the order you mean to light them. The clock starts when you set out.');
    planOut(); hud();
  }

  function loadDay(off) {
    dayOff = off;
    buildDay(off);
    var d = day.date, T = day.T;
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ' → ' + T.town + ', ' + day.year;
    $('rWho').textContent = WEEKDAYS[day.wd] + ' ' + day.dd + ' ' + MONTHS[day.mo] + ' ' + day.year + ' · ' + T.town + ', ' + Math.abs(T.lat).toFixed(1) + '° N';
    $('rName').textContent = 'The streets behind ' + T.mark + ', ' + T.town;
    var moonTxt = day.moonUp ? 'The moon is ' + (day.age < 14.8 ? 'nearly full and already up' : 'just past full and rising') + '. '
      : day.illum < 0.15 ? 'No moon tonight. ' : 'The moon will not help: it is ' + (day.age < 14.8 ? 'a ' + (day.illum < 0.5 ? 'young crescent' : 'waxing') + ' moon' : 'down until late') + '. ';
    $('rBlurb').innerHTML = 'Sunset is at <b>' + clock(day.sunset) + '</b> local time. ' + cap(T.co) + '’s contract wants every lamp on the list burning within <b>' +
      day.limit + ' minutes</b>, by <b>' + clock(day.lightBy) + '</b>, and its inspector walks the district at ' + clock(day.inspect) + '. ' +
      'You have <b>' + num(day.nReq) + ' lamps</b> to light' + (day.lamps.length > day.nReq ? ' out of ' + day.lamps.length : '') + '. ' + moonTxt +
      'The wind is ' + day.W.name + '.';
    $('rBook').textContent = day.moonNight
      ? 'This parish keeps a moon table, and tonight is a moon night: the lamps in the back streets (drawn hollow) are off the list. Light one anyway and the company docks you for the gas. ' + day.W.says
      : (day.moonTable ? 'The parish keeps a moon table, but the moon is no use tonight, so every lamp is on the list. ' : 'This contract pays for every lamp, every night, moon or no moon. ') + day.W.says;
    fresh();
  }

  function say(html) { $('msg').innerHTML = html; }
  function hud() {
    var litReq = 0; day.lamps.forEach(function (L, i) { if (L.req && S.lit[i]) litReq++; });
    $('hWhen').textContent = clock(S.t);
    $('hLit').textContent = litReq + ' of ' + day.nReq;
    var left = day.lightBy - S.t;
    $('hLeft').textContent = S.phase === 'ready' ? day.limit + ' min' : left > 0 ? Math.ceil(left) + ' min' : 'past';
    $('hLeftBox').className = S.phase === 'run' && left < 5 && litReq < day.nReq ? 'alarm' : '';
    $('hWalk').textContent = Math.round(S.walked * MPX) + ' m';
  }
  function planOut() {
    var parts = [];
    if (S.target != null) parts.push('<b>now:</b> ' + day.lamps[S.target].name);
    S.queue.slice(0, 6).forEach(function (q, ix) { parts.push((ix === 0 && S.target == null ? '<b>first:</b> ' : '') + day.lamps[q].name); });
    $('plan').innerHTML = parts.length ? parts.join(' → ') + (S.queue.length > 6 ? ' → <i>and ' + (S.queue.length - 6) + ' more</i>' : '')
      : 'Nothing planned. Click a lamp on the map.';
  }

  function toggle(ix) {
    if (S.phase === 'done') return;
    var L = day.lamps[ix];
    if (S.target === ix) { say('You are already on your way to the lamp in ' + L.name + '.'); return; }
    var q = S.queue.indexOf(ix);
    if (q >= 0) { S.queue.splice(q, 1); planOut(); return; }
    if (S.lit[ix]) { say('The lamp in ' + L.name + ' is already burning.'); return; }
    S.queue.push(ix); planOut();
    if (!L.req) say('That lamp in ' + L.name + ' is off the list tonight. You can light it, but the company will charge you for the gas.');
  }

  function start() {
    if (S.phase !== 'ready') return;
    S.phase = 'run'; S.t = day.start; lastFrame = null;
    $('bGo').disabled = true; $('bFast').disabled = false;
    say('You shoulder the pole and step out of the lamp room as the sun goes down.');
  }

  /* ---------- the clock ---------- */
  function tick(dt) {
    S.t += dt;
    // gusts
    day.lamps.forEach(function (L, i) {
      if (S.lit[i] && S.blowAt[i] != null && S.t >= S.blowAt[i]) {
        S.lit[i] = false; S.blowAt[i] = null; S.blown[i] = true; record();
        say('A gust has put out the lamp in <b>' + L.name + '</b>: the pane is cracked. Click it to go back.');
      }
    });
    var budget = dt;
    while (budget > 1e-6) {
      if (S.lighting > 0) {
        var use = Math.min(budget, S.lighting); S.lighting -= use; budget -= use;
        if (S.lighting <= 1e-6) lightIt();
        continue;
      }
      if (S.target == null) {
        while (S.queue.length && S.lit[S.queue[0]]) S.queue.shift();
        if (!S.queue.length) break;
        S.target = S.queue.shift();
        S.path = pathPts(S.pos, placeLamp(day.lamps[S.target]));
        planOut();
      }
      // walk
      var stepPx = budget * SPEED;
      while (stepPx > 0 && S.path.length) {
        var p = S.path[0], dx = p[0] - S.x, dy = p[1] - S.y, d = Math.hypot(dx, dy);
        if (d <= stepPx) { S.x = p[0]; S.y = p[1]; S.walked += d; stepPx -= d; S.path.shift(); }
        else { S.x += dx / d * stepPx; S.y += dy / d * stepPx; S.walked += stepPx; stepPx = 0; }
        var lt = S.trail[S.trail.length - 1];
        if (Math.hypot(S.x - lt[0], S.y - lt[1]) > 5) S.trail.push([S.x, S.y]);
      }
      if (!S.path.length) {
        S.trail.push([S.x, S.y]);
        S.pos = placeLamp(day.lamps[S.target]);
        S.lighting = LIGHT_MIN;
        budget = stepPx / SPEED;
      } else budget = 0;
    }
    if (S.t >= day.inspect) finish();
  }
  function lightIt() {
    var i = S.target, L = day.lamps[i];
    S.target = null; S.lighting = 0;
    if (S.lit[i]) return;
    S.lit[i] = true;
    if (S.firstLit[i] == null) S.firstLit[i] = S.t;
    if (!L.req) S.wasted++;
    if (L.cracked && L.blowDelay != null) { S.blowAt[i] = S.t + L.blowDelay; L.blowDelay = null; }
    record(); planOut();
    var litReq = 0; day.lamps.forEach(function (M, k) { if (M.req && S.lit[k]) litReq++; });
    if (litReq === day.nReq) say(S.t <= day.lightBy ? 'Every lamp on the list is burning, with ' + Math.floor(day.lightBy - S.t) + ' minutes in hand. Keep an eye on them till the inspector comes, or hurry the clock.'
      : 'Every lamp on the list is burning at last, ' + Math.ceil(S.t - day.lightBy) + ' minutes after lighting-up time.');
  }
  function record() {
    var n = 0; day.lamps.forEach(function (L, i) { if (L.req && S.lit[i]) n++; });
    S.hist.push([S.t, n]);
  }

  /* ---------- drawing ---------- */
  var cv = $('town'), ctx = cv.getContext('2d');
  function mix(a, b, t) { return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * t); }).join(',') + ')'; }
  var NIGHT_B = [10, 13, 20], DUSK_B = [62, 64, 78], NIGHT_S = [20, 25, 34], DUSK_S = [118, 116, 118];

  function drawTown(c, t, opts) {
    var b = light(altitude(day.T.lat, day.n, t));
    c.fillStyle = mix(NIGHT_B, DUSK_B, b); c.fillRect(0, 0, CW, CH);
    // windows
    day.wins.forEach(function (w) { if (b < w.th) { c.fillStyle = 'rgba(242,196,107,' + (0.25 + 0.4 * (1 - b)) + ')'; c.fillRect(w.x, w.y, 3, 4); } });
    // streets
    c.lineCap = 'round'; c.lineJoin = 'round';
    day.edges.forEach(function (e) {
      var A = day.nodes[e.a], B = day.nodes[e.b];
      c.strokeStyle = mix(NIGHT_S, DUSK_S, b); c.lineWidth = e.major ? 16 : 12;
      c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
    });
    // pools of light
    c.save(); c.globalCompositeOperation = 'lighter';
    day.lamps.forEach(function (L, i) {
      if (!opts.lit[i]) return;
      var g = c.createRadialGradient(L.x, L.y, 1, L.x, L.y, 38), a = 0.18 + 0.5 * (1 - b);
      g.addColorStop(0, 'rgba(255,214,130,' + a + ')'); g.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = g; c.beginPath(); c.arc(L.x, L.y, 38, 0, 7); c.fill();
    });
    c.restore();
    // lamp room
    var Dn = day.nodes[day.depot];
    c.fillStyle = '#2b3446'; c.strokeStyle = '#7aa2ff'; c.lineWidth = 1.5;
    c.fillRect(Dn.x - 11, Dn.y - 11, 22, 22); c.strokeRect(Dn.x - 11, Dn.y - 11, 22, 22);
    c.fillStyle = '#cfd6e2'; c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText('LAMP ROOM', clamp(Dn.x, 34, CW - 34), Dn.y + (Dn.y > CH / 2 ? -16 : 24));
    // lamps
    day.lamps.forEach(function (L, i) {
      var on = opts.lit[i];
      c.lineWidth = 1.5;
      if (on) { c.fillStyle = '#ffe7a3'; c.beginPath(); c.arc(L.x, L.y, 4, 0, 7); c.fill(); }
      else if (L.req) {
        c.fillStyle = '#0b0f16'; c.strokeStyle = opts.blown && opts.blown[i] ? '#ff8fa3' : '#b9c2d0';
        c.beginPath(); c.arc(L.x, L.y, 4.5, 0, 7); c.fill(); c.stroke();
      } else {
        c.strokeStyle = 'rgba(185,194,208,.45)'; c.setLineDash([2, 2]);
        c.beginPath(); c.arc(L.x, L.y, 4.5, 0, 7); c.stroke(); c.setLineDash([]);
      }
      if (opts.hover === i) { c.strokeStyle = '#f2d36b'; c.beginPath(); c.arc(L.x, L.y, 10, 0, 7); c.stroke(); }
    });
  }

  function frameDraw() {
    drawTown(ctx, S.t, { lit: S.lit, blown: S.blown, hover: S.hover });
    // the plan
    if (S.phase !== 'done') {
      var from = S.target != null ? placeLamp(day.lamps[S.target]) : S.pos, pts = [];
      if (S.target != null) pts = [[S.x, S.y]].concat(S.path);
      else pts = [[S.x, S.y]];
      S.queue.forEach(function (q) { pts = pts.concat(pathPts(from, placeLamp(day.lamps[q]))); from = placeLamp(day.lamps[q]); });
      if (pts.length > 1) {
        ctx.strokeStyle = 'rgba(242,211,107,.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.font = '600 9px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
      S.queue.forEach(function (q, ix) {
        var L = day.lamps[q]; ctx.fillStyle = '#f2d36b'; ctx.fillText(String(ix + 1 + (S.target != null ? 1 : 0)), L.x, L.y - 9);
      });
      if (S.target != null) { var Lt = day.lamps[S.target]; ctx.fillStyle = '#f2d36b'; ctx.fillText('1', Lt.x, Lt.y - 9); }
    }
    // gusts: a cracked lamp about to go flickers
    day.lamps.forEach(function (L, i) {
      if (S.lit[i] && S.blowAt[i] != null && S.blowAt[i] - S.t < 0.8) {
        ctx.fillStyle = 'rgba(10,13,20,' + (0.4 + 0.4 * Math.sin(performance.now() / 40)) + ')'; ctx.beginPath(); ctx.arc(L.x, L.y, 5, 0, 7); ctx.fill();
      }
    });
    // the lamplighter
    var bob = S.phase === 'run' && S.path.length ? Math.sin(performance.now() / 90) * 1 : 0;
    ctx.strokeStyle = '#e8edf5'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(S.x + 2, S.y + 4 + bob); ctx.lineTo(S.x + 9, S.y - 14 - (S.lighting > 0 ? 6 : 0)); ctx.stroke();
    if (S.phase === 'run') { ctx.fillStyle = '#ffb45b'; ctx.beginPath(); ctx.arc(S.x + 9, S.y - 15 - (S.lighting > 0 ? 6 : 0), 1.8, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#e8edf5'; ctx.beginPath(); ctx.arc(S.x, S.y + bob, 4.5, 0, 7); ctx.fill();
    // the moon
    if (day.moonUp) {
      var alt = altitude(day.T.lat, day.n, S.t), b = light(alt);
      ctx.fillStyle = 'rgba(240,236,220,' + (0.35 + 0.55 * (1 - b)) + ')'; ctx.beginPath(); ctx.arc(CW - 26, 44, 9, 0, 7); ctx.fill();
    }
    // caption
    ctx.font = '600 11px ui-monospace,Menlo,monospace'; ctx.fillStyle = '#e8edf5'; ctx.textAlign = 'right';
    ctx.fillText(day.T.town.toUpperCase() + ' · ' + clock(S.t).toUpperCase(), CW - 10, 18);
    ctx.textAlign = 'left'; ctx.fillStyle = '#cfd6e2';
    ctx.fillText('SUNSET ' + clock(day.sunset).toUpperCase() + ' · LIGHT BY ' + clock(day.lightBy).toUpperCase(), 10, 18);
    if (S.phase === 'ready') { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(232,237,245,.9)'; ctx.fillText('THE SUN IS ON THE ROOFS. PLAN YOUR ROUND, THEN SET OUT.', CW / 2, CH - 10); }
  }

  var lastFrame = null;
  function frame(now) {
    if (S && day) {
      if (S.phase === 'run') {
        if (lastFrame != null) {
          var real = Math.min(0.1, (now - lastFrame) / 1000);
          tick(real / PACES[+$('pace').value] * (S.fast ? 10 : 1));
          hud();
        }
        lastFrame = now;
      }
      frameDraw();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- the inspector ---------- */
  function finish() {
    if (S.phase === 'done') return;
    S.phase = 'done'; S.t = Math.max(S.t, day.inspect); record();
    $('bGo').disabled = true; $('bFast').disabled = true; S.queue = []; S.target = null; S.path = []; planOut(); hud();
    var late = 0, out = 0, onTime = 0, outNames = [];
    day.lamps.forEach(function (L, i) {
      if (!L.req) return;
      if (S.firstLit[i] == null || S.firstLit[i] > day.lightBy) late++; else onTime++;
      if (!S.lit[i]) { out++; outNames.push(L.name); }
    });
    var fines = late * FINE_LATE + out * FINE_OUT + S.wasted * WASTE, net = WAGE - fines;
    var eff = S.walked > 0 ? Math.round(day.goodLen / S.walked * 100) : 0;
    var good = late === 0 && out === 0;
    $('verdict').className = 'verdict ' + (good ? 'good' : 'warn');
    $('verdict').innerHTML = '<p><b>' + (good ? 'Every lamp lit in time, and burning when the inspector came by.' : out ? 'The inspector found ' + num(out) + ' lamp' + (out > 1 ? 's' : '') + ' dark.' : 'All burning by the time the inspector came, but not all by lighting-up time.') + '</b></p>' +
      '<p><b>' + onTime + '</b> of ' + day.nReq + ' lit by ' + clock(day.lightBy) + '. You walked <b>' + Math.round(S.walked * MPX) + ' m</b>; a good round from the lamp room through every lamp on the list is about <b>' +
      Math.round(day.goodLen * MPX) + ' m</b>' + (S.walked > 0 ? ', so your round was <b>' + eff + '%</b> as efficient' : '') + '. You take home <b>' + money(net) + '</b> for the evening.</p>';
    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>Your round and a good one</h5><canvas id="mapOut" width="640" height="420"></canvas>' +
      '<div class="key"><span><i style="background:#ffb45b"></i>where you walked</span><span><i style="background:#64f0c8"></i>a good round</span></div>' +
      '<h5>Lamps burning through the evening</h5><canvas id="chart" width="640" height="200"></canvas>' +
      '<div class="key"><span><i style="background:#f2d36b"></i>lamps on the list burning</span><span><i style="background:#7aa2ff"></i>sunset, lighting-up time, the inspector</span></div>' +
      '<h5>The account</h5><table class="card">' +
      row('Wage for the round', money(WAGE)) +
      (late ? row(num(late) + ' lamp' + (late > 1 ? 's' : '') + ' not lit by lighting-up time, at ' + money(FINE_LATE), '− ' + money(late * FINE_LATE)) : '') +
      (out ? row(num(out) + ' found dark by the inspector, at ' + money(FINE_OUT) + ' (' + outNames.slice(0, 4).join(', ') + (outNames.length > 4 ? '…' : '') + ')', '− ' + money(out * FINE_OUT)) : '') +
      (S.wasted ? row(num(S.wasted) + ' lamp' + (S.wasted > 1 ? 's' : '') + ' lit off the list, gas at ' + money(WASTE), '− ' + money(S.wasted * WASTE)) : '') +
      '<tr class="tot"><td>Yours to keep</td><td class="n">' + money(net) + '</td></tr></table>';
    function row(a, b) { return '<tr><td>' + cap(a) + '</td><td class="n">' + b + '</td></tr>'; }
    drawMapOut($('mapOut')); drawChart($('chart'));
    $('bAgain').style.display = '';
  }

  function drawMapOut(cvs) {
    var c = cvs.getContext('2d');
    drawTown(c, day.inspect, { lit: S.lit, blown: S.blown, hover: -1 });
    function line(pts, col, dash, w) {
      if (pts.length < 2) return;
      c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash);
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
      c.setLineDash([]);
    }
    var Dn = day.nodes[day.depot];
    line([[Dn.x, Dn.y]].concat(day.goodPts), 'rgba(100,240,200,.85)', [5, 4], 2);
    line(S.trail.map(function (p) { return [p[0] + 2, p[1] + 2]; }), 'rgba(255,180,91,.9)', [], 2);
  }

  function drawChart(cvs) {
    var c = cvs.getContext('2d'), W = 640, H = 200, L = 34, R = 624, T = 14, B = 168;
    var t0 = day.sunset - 15, t1 = day.inspect + 5;
    function X(t) { return L + (t - t0) / (t1 - t0) * (R - L); }
    function Y(n) { return B - n / Math.max(1, day.nReq) * (B - T); }
    for (var x = L; x < R; x += 4) {
      var b = light(altitude(day.T.lat, day.n, t0 + (x - L) / (R - L) * (t1 - t0)));
      c.fillStyle = mix(NIGHT_B, DUSK_B, b); c.fillRect(x, T, 4, B - T);
    }
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, T); c.fillRect(0, B, W, H - B); c.fillRect(0, 0, L, H); c.fillRect(R, 0, W - R, H);
    c.strokeStyle = 'rgba(122,162,255,.8)'; c.lineWidth = 1;
    [day.sunset, day.lightBy, day.inspect].forEach(function (t) { c.beginPath(); c.moveTo(X(t), T); c.lineTo(X(t), B); c.stroke(); });
    c.strokeStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.moveTo(L, Y(day.nReq)); c.lineTo(R, Y(day.nReq)); c.stroke();
    c.strokeStyle = '#f2d36b'; c.lineWidth = 2; c.beginPath();
    var prev = 0; c.moveTo(X(day.sunset), Y(0));
    S.hist.forEach(function (h) { c.lineTo(X(h[0]), Y(prev)); c.lineTo(X(h[0]), Y(h[1])); prev = h[1]; });
    c.lineTo(X(day.inspect), Y(prev)); c.stroke();
    c.fillStyle = '#8b97ab'; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    c.fillText('sunset', X(day.sunset), H - 18); c.fillText('light by', X(day.lightBy), H - 18); c.fillText('inspector', X(day.inspect), H - 18);
    c.fillText(clock(day.sunset), X(day.sunset), H - 6); c.fillText(clock(day.lightBy), X(day.lightBy), H - 6); c.fillText(clock(day.inspect), X(day.inspect), H - 6);
    c.textAlign = 'right'; c.fillText(String(day.nReq), L - 6, Y(day.nReq) + 4); c.fillText('0', L - 6, B);
  }

  /* ---------- wiring ---------- */
  function lampAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    var best = -1, bd = 20;
    day.lamps.forEach(function (L, i) { var d = Math.hypot(L.x - x, L.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  cv.addEventListener('pointerdown', function (e) { var i = lampAt(e); if (i >= 0) { e.preventDefault(); toggle(i); } });
  cv.addEventListener('pointermove', function (e) { S.hover = lampAt(e); cv.style.cursor = S.hover >= 0 ? 'pointer' : 'default'; });
  cv.addEventListener('pointerleave', function () { S.hover = -1; });
  $('bGo').addEventListener('click', start);
  $('bUndo').addEventListener('click', function () { S.queue.pop(); planOut(); });
  $('bClear').addEventListener('click', function () { S.queue = []; planOut(); });
  $('bFast').addEventListener('click', function () {
    if (S.phase !== 'run') return;
    S.fast = !S.fast; $('bFast').textContent = S.fast ? 'Back to the ordinary clock' : 'Hurry the clock on';
  });
  $('bAgain').addEventListener('click', function () { fresh(); $('bFast').textContent = 'Hurry the clock on'; });
  function paceOut() { $('paceOut').textContent = PACENAME[+$('pace').value] + ' · ' + PACES[+$('pace').value] + ' s a minute'; }
  $('pace').addEventListener('input', paceOut); paceOut();
  document.addEventListener('keydown', function (e) {
    if (!S || S.phase === 'done') return;
    if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range' || e.target.tagName === 'TEXTAREA')) return;
    var used = true;
    if (e.code === 'Space' && S.phase === 'ready') { if (e.target && e.target.tagName === 'BUTTON') return; start(); }
    else if (e.code === 'Backspace') { S.queue.pop(); planOut(); }
    else if (e.code === 'Escape') { S.queue = []; planOut(); }
    else used = false;
    if (used) e.preventDefault();
  });
  document.addEventListener('visibilitychange', function () { lastFrame = null; });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  requestAnimationFrame(frame);
})();
