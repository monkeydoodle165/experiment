/* drift.quibo.games — The Pump
   Epidemiology. The day's number lays out the streets of a crowded parish in a cholera year,
   sets half a dozen public pumps at its corners and lets something into the well under one of
   them. Every household walks to the pump nearest it on foot (a few walk further because they
   like the taste), and the people who drink from the bad one start to die. You arrive on the
   morning of the third day with the registrar's returns. Spend your hours on interviews, water
   samples and pacing out the walks, then put one pump to the Board of Guardians; they will take
   its handle off that evening. Deaths already on their way still come. The page counts how many
   your evening saved against the earliest evening anyone could have done it. Self-contained. */
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
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function plural(n, one, many) { return numw(n) + ' ' + (n === 1 ? one : many); }
  var $ = function (id) { return document.getElementById(id); };

  var NX = 7, NY = 5, W = 760, H = 520, MX = 46, MY = 44;
  var FIRST = 3, LAST = 15;            // you arrive the morning of day 3; the outbreak is over after day 15
  var DAY_START = 8, DAY_END = 18;     // ten working hours
  var COST = { interview: 1, sample: 2, pace: 5 };
  var PCOL = ['#64f0c8', '#7aa2ff', '#ffce6a', '#ff8fa3', '#b78cff', '#4ad9e6', '#a6e55c'];

  var SAINTS = ['Anselm', 'Botolph', 'Swithin', 'Olave', 'Mildred', 'Vedast', 'Ethelburga', 'Dunstan', 'Alphege', 'Werburgh', 'Benet', 'Clement', 'Giles', 'Magnus', 'Bride', 'Sepulchre'];
  var DISTRICTS = ['Coldharbour', 'Ludgrave', 'Hollins Fields', 'Tallow Hill', 'Saffron Rise', 'Marrowgate', 'Pennyfields', 'Lambsend', 'Ropewalk', 'Kettle Wharf', 'Hatcham', 'Dunsford'];
  var STREETS = ['Broad', 'Silver', 'Marlow', 'Tallow', 'Hosier', 'Chandos', 'Pelham', 'Garnet', 'Saffron', 'Vine', 'Mercer', 'Cutler', 'Bell', 'Lamb', 'Cooper', 'Dyer', 'Sheaf', 'Quill', 'Flint', 'Wren', 'Tanner', 'Haddon', 'Kemble', 'Bristow', 'Linden', 'Market', 'Orchard', 'Pewter', 'Rook', 'Cable'];
  var ROWS = ['Street', 'Street', 'Street', 'Street', 'Street'];
  var COLS = ['Street', 'Lane', 'Street', 'Row', 'Street', 'Place', 'Street'];
  var SURN = ['Lewis', 'Eley', 'Gould', 'Huggins', 'Whitehead', 'Barker', 'Pratt', 'Moss', 'Coker', 'Fenn', 'Haddock', 'Turle', 'Lamb', 'Ward', 'Cripps', 'Nunn', 'Rowe', 'Saunders'];
  var BREWS = ['Lion', 'Swan', 'Anchor', 'Phoenix', 'Bell', 'Star', 'Crown', 'Griffin'];
  var YEARS = [1848, 1849, 1853, 1854, 1866];

  /* ---------- the parish ---------- */
  function build(seed) {
    var r = rng(seed);
    var D = { seed: seed };
    D.year = pick(r, YEARS);
    D.start = new Date(D.year, 7, 24 + Math.floor(r() * 12), 12);   // day 1 falls between 24 August and 4 September
    D.parish = 'St ' + pick(r, SAINTS);
    D.district = pick(r, DISTRICTS);
    D.brewName = pick(r, BREWS);
    var sn = shuffle(r, SURN);
    D.widow = sn[0]; D.brewer = sn[1]; D.master = sn[2];

    // intersections on a jittered grid
    var names = shuffle(r, STREETS);
    D.rowName = []; D.colName = [];
    for (var j = 0; j < NY; j++) D.rowName.push(names[j] + ' ' + ROWS[j]);
    for (var i = 0; i < NX; i++) D.colName.push(names[NY + i] + ' ' + COLS[i]);
    var nodes = [];
    for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
      var jx = (i === 0 || i === NX - 1) ? 6 : 13, jy = (j === 0 || j === NY - 1) ? 6 : 12;
      nodes.push({ i: i, j: j, x: MX + i * (W - 2 * MX) / (NX - 1) + (r() * 2 - 1) * jx, y: MY + j * (H - 2 * MY) / (NY - 1) + (r() * 2 - 1) * jy });
    }
    D.nodes = nodes;
    var edges = [];
    for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
      var n = j * NX + i;
      if (i < NX - 1) edges.push({ a: n, b: n + 1, hz: true });
      if (j < NY - 1) edges.push({ a: n, b: n + NX, hz: false });
    }
    // build over some streets: blocks that are courts and yards, not thoroughfares
    var want = 7 + Math.floor(r() * 4), tries = 0;
    var order = shuffle(r, edges.map(function (_, k) { return k; }));
    var gone = {};
    for (var q = 0; q < order.length && Object.keys(gone).length < want && tries < 200; q++, tries++) {
      var k = order[q], e = edges[k];
      var ni = nodes[e.a], nb = nodes[e.b];
      if (e.hz && (ni.j === 0 || ni.j === NY - 1)) continue;       // keep the outer streets
      if (!e.hz && (ni.i === 0 || ni.i === NX - 1)) continue;
      gone[k] = true;
      if (!connectedOK(nodes.length, edges, gone)) delete gone[k];
    }
    D.edges = edges.filter(function (_, k) { return !gone[k]; });
    D.edges.forEach(function (e) {
      var A = nodes[e.a], B = nodes[e.b];
      e.L = Math.hypot(B.x - A.x, B.y - A.y);
      e.name = e.hz ? D.rowName[A.j] : D.colName[A.i];
    });
    D.adj = nodes.map(function () { return []; });
    D.edges.forEach(function (e, k) { D.adj[e.a].push([e.b, e.L]); D.adj[e.b].push([e.a, e.L]); });

    // pumps on corners, well spread out
    var pumpN = 6 + (r() < 0.35 ? 1 : 0), pumps = [], cand = shuffle(r, nodes.map(function (_, k) { return k; }));
    for (var sep = 200; pumps.length < pumpN && sep > 60; sep -= 20) {
      for (q = 0; q < cand.length && pumps.length < pumpN; q++) {
        var nd = nodes[cand[q]];
        if (pumps.some(function (p) { return p.node === cand[q] || Math.hypot(nodes[p.node].x - nd.x, nodes[p.node].y - nd.y) < sep; })) continue;
        pumps.push({ node: cand[q] });
      }
    }
    var used = {};
    pumps.forEach(function (p, k) {
      var nd = nodes[p.node], opts = [D.rowName[nd.j], D.colName[nd.i]];
      if (r() < 0.5) opts.reverse();
      var nm = used[opts[0]] ? opts[1] : opts[0];
      used[nm] = true;
      p.street = nm; p.name = 'the ' + nm + ' pump';
      p.col = PCOL[k % PCOL.length];
      p.dist = dijkstra(D, p.node);
    });
    D.pumps = pumps;
    var inner = pumps.map(function (p, k) { return k; }).filter(function (k) { var nd = nodes[pumps[k].node]; return nd.i > 0 && nd.i < NX - 1 && nd.j > 0 && nd.j < NY - 1; });
    D.source = inner.length ? pick(r, inner) : Math.floor(r() * pumps.length);
    D.attack = 0.15 + r() * 0.08;

    // samples under the lens, fixed for the day
    pumps.forEach(function (p, k) {
      var cloudy = k === D.source ? r() < 0.55 : r() < 0.22;
      p.sample = cloudy ? 'cloudy' : (r() < 0.5 ? 'clear' : 'iron');
      p.depth = 18 + Math.floor(r() * 14);
    });

    // houses along both sides of every street
    var houses = [];
    D.edges.forEach(function (e, ek) {
      var A = nodes[e.a], B = nodes[e.b];
      var ux = (B.x - A.x) / e.L, uy = (B.y - A.y) / e.L, px = -uy, py = ux;
      var m = Math.max(1, Math.floor((e.L - 26) / 15)), step = (e.L - 26) / m;
      for (var side = 0; side < 2; side++) for (var t = 0; t < m; t++) {
        var s = 13 + (t + 0.5) * step, sg = side ? 1 : -1;
        houses.push({ e: ek, s: s, side: side, no: t * 2 + 1 + side, x: A.x + ux * s + px * sg * 11, y: A.y + uy * s + py * sg * 11, ang: Math.atan2(uy, ux) * 180 / Math.PI, ox: px * sg, oy: py * sg, w: Math.min(12, step - 2.5), res: 2 + Math.floor(r() * 7) });
      }
    });
    // walking distance from each house to each pump
    houses.forEach(function (h) {
      var e = D.edges[h.e];
      h.walk = pumps.map(function (p) { return Math.min(h.s + p.dist[e.a], e.L - h.s + p.dist[e.b]); });
      var ord = h.walk.map(function (_, k) { return k; }).sort(function (a, b) { return h.walk[a] - h.walk[b]; });
      h.near = ord[0];
      h.use = ord[0]; h.taste = false;
      if (r() < 0.085 && h.walk[ord[1]] < h.walk[ord[0]] + 170) { h.use = ord[1]; h.taste = true; }
    });

    // the brewery and the workhouse, both on streets that walk to the bad pump
    function edgeWalk(ek) { var e = D.edges[ek]; return Math.min(pumps[D.source].dist[e.a], pumps[D.source].dist[e.b]) + e.L / 2; }
    function edgeNear(ek) {
      var e = D.edges[ek], best = -1, bd = 1e9;
      pumps.forEach(function (p, k) { var d = Math.min(p.dist[e.a], p.dist[e.b]) + e.L / 2; if (d < bd) { bd = d; best = k; } });
      return best;
    }
    var ek = D.edges.map(function (_, k) { return k; }).filter(function (k) { return D.edges[k].L > 80; });
    var mine = ek.filter(function (k) { return edgeNear(k) === D.source; }).sort(function (a, b) { return edgeWalk(a) - edgeWalk(b); });
    if (mine.length < 2) mine = ek.slice().sort(function (a, b) { return edgeWalk(a) - edgeWalk(b); });
    var bk = mine[Math.floor(r() * Math.min(3, mine.length))];
    var rest = mine.filter(function (k) { return k !== bk; });
    var wk = rest[Math.floor(r() * Math.min(4, rest.length))];
    function inst(kind, ek, side, people, label) {
      var e = D.edges[ek], A = nodes[e.a], B = nodes[e.b];
      var ux = (B.x - A.x) / e.L, uy = (B.y - A.y) / e.L, sg = side ? 1 : -1, px = -uy * sg, py = ux * sg;
      var s0 = 14, s1 = e.L - 14, o0 = 6, o1 = kind === 'workhouse' ? 34 : 26;
      var pts = [[s0, o0], [s1, o0], [s1, o1], [s0, o1]].map(function (c) { return [A.x + ux * c[0] + px * c[1], A.y + uy * c[0] + py * c[1]]; });
      var cx = A.x + ux * e.L / 2 + px * (o0 + o1) / 2, cy = A.y + uy * e.L / 2 + py * (o0 + o1) / 2;
      houses = houses.filter(function (h) { return !(h.e === ek && h.side === side); });
      return { kind: kind, e: ek, side: side, pts: pts, x: cx, y: cy, people: people, label: label, ang: Math.atan2(uy, ux) * 180 / Math.PI };
    }
    D.brewery = inst('brewery', bk, r() < 0.5 ? 0 : 1, 40 + Math.floor(r() * 41), 'Brewery');
    D.workhouse = inst('workhouse', wk, wk === bk ? 1 - D.brewery.side : (r() < 0.5 ? 0 : 1), 180 + Math.floor(r() * 300), 'Workhouse');
    D.houses = houses;

    // a house far from the bad pump that has its water carted from it
    var far = houses.filter(function (h) { return h.near !== D.source; }).sort(function (a, b) { return b.walk[D.source] - a.walk[D.source]; });
    var fh = far[Math.floor(r() * Math.max(1, Math.floor(far.length * 0.25)))];
    fh.use = D.source; fh.taste = false; fh.carted = true; fh.res = 2 + Math.floor(r() * 2);

    // who dies, and when (day 1 is the first death; exposure day e can be 0, the day before)
    var WEIGHTS = [];
    for (var e2 = 0; e2 <= 11; e2++) WEIGHTS.push(Math.pow(e2 + 0.6, 1.6) * Math.exp(-e2 / 1.5));
    var WSUM = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
    function exposure() { var x = r() * WSUM; for (var k = 0; k < WEIGHTS.length; k++) { x -= WEIGHTS[k]; if (x <= 0) return k; } return WEIGHTS.length - 1; }
    function baseline() { return { day: 1 + Math.floor(r() * LAST), e: null }; }
    houses.forEach(function (h) {
      h.deaths = [];
      if (h.carted) { h.deaths.push({ day: 1 + (r() < 0.5 ? 1 : 0), e: 0 }); h.deaths.push({ day: 3, e: 1 }); return; }
      for (var p = 0; p < h.res; p++) {
        if (h.use === D.source && r() < D.attack) { var e = exposure(); h.deaths.push({ day: e + 1 + (r() < 0.55 ? 1 : 0), e: e }); }
        else if (r() < 0.0045) h.deaths.push(baseline());
      }
      h.deaths.sort(function (a, b) { return a.day - b.day; });
    });
    D.workhouse.deaths = [];
    for (var p = 0; p < D.workhouse.people; p++) if (r() < 0.006) D.workhouse.deaths.push(baseline());
    D.brewery.deaths = [];
    D.carted = fh;
    return D;
  }

  function connectedOK(N, edges, gone) {
    var adj = []; for (var k = 0; k < N; k++) adj.push([]);
    edges.forEach(function (e, k) { if (!gone[k]) { adj[e.a].push(e.b); adj[e.b].push(e.a); } });
    for (k = 0; k < N; k++) if (adj[k].length < 2) return false;
    var seen = { 0: true }, st = [0], c = 1;
    while (st.length) { var u = st.pop(); adj[u].forEach(function (v) { if (!seen[v]) { seen[v] = true; c++; st.push(v); } }); }
    return c === N;
  }
  function dijkstra(D, src) {
    var N = D.nodes.length, dist = [], done = [];
    for (var k = 0; k < N; k++) { dist.push(1e9); done.push(false); }
    dist[src] = 0;
    for (var it = 0; it < N; it++) {
      var u = -1;
      for (k = 0; k < N; k++) if (!done[k] && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0 || dist[u] >= 1e9) break;
      done[u] = true;
      D.adj[u].forEach(function (a) { if (dist[u] + a[1] < dist[a[0]]) dist[a[0]] = dist[u] + a[1]; });
    }
    return dist;
  }

  /* ---------- the outbreak as it plays ---------- */
  function prevented(d, R) { return d.e !== null && R !== null && d.e > R; }
  function allDeaths(D) {
    var out = [];
    D.houses.forEach(function (h) { h.deaths.forEach(function (d) { out.push(d); }); });
    D.workhouse.deaths.forEach(function (d) { out.push(d); });
    return out;
  }
  function totalWith(D, R) { return allDeaths(D).filter(function (d) { return !prevented(d, R); }).length; }
  function shown(d) { return d.day < S.day && !prevented(d, S.R); }
  function dayDate(k) { var d = new Date(S.D.start.getTime()); d.setDate(d.getDate() + k - 1); return d; }
  function shortDay(k) { var d = dayDate(k); return WEEKDAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  function longDay(k) { var d = dayDate(k); return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function clock(h) { var hh = h > 12 ? h - 12 : h; return hh + (h < 12 ? ' in the morning' : h === 12 ? ' noon' : h < 17 ? ' in the afternoon' : ' in the evening'); }

  var S = { off: 0 };

  function reset() {
    S.day = FIRST; S.hour = DAY_START; S.R = null; S.removed = []; S.petitioned = -1; S.banUntil = -1;
    S.asked = {}; S.sampled = {}; S.paced = false; S.notes = []; S.sel = null; S.over = false;
  }

  function spend(h, what) {
    if (S.over) return false;
    if (S.hour + h > DAY_END) { flash('There are not ' + plural(h, 'hour', 'hours') + ' of daylight left for ' + what + '. Go home and come back to the morning\'s returns.'); return false; }
    S.hour += h; return true;
  }
  function note(html) { S.notes.unshift({ day: S.day, hour: S.hour, html: html }); }
  function flash(msg) { $('msg').innerHTML = msg; }

  function interviewHouse(h) {
    var D = S.D, key = 'h' + D.houses.indexOf(h);
    if (S.asked[key]) { flash('You have already been to No. ' + h.no + ' ' + esc(D.edges[h.e].name) + '.'); return; }
    if (!spend(COST.interview, 'another call')) return;
    S.asked[key] = true;
    var addr = 'No. ' + h.no + ' ' + esc(D.edges[h.e].name);
    var dead = h.deaths.filter(shown).length;
    var who = h.res + ' living there' + (dead ? ', ' + numw(dead) + ' dead so far' : '');
    var txt;
    if (h.carted) {
      txt = '<b>' + addr + '</b> (' + who + '). Mrs ' + D.widow + '\'s son: she had not set foot near ' + esc(D.pumps[D.source].street) + ' for months, ' +
        'but she liked the water from <b>' + esc(D.pumps[D.source].name) + '</b> so much that a carter brought her a stone bottle of it every day. Her niece was visiting and drank it too.';
    } else if (h.taste) {
      txt = '<b>' + addr + '</b> (' + who + '). They draw from <b>' + esc(D.pumps[h.use].name) + '</b>, though ' + esc(D.pumps[h.near].name) + ' is nearer: they say its water is flat and walk on.';
    } else {
      txt = '<b>' + addr + '</b> (' + who + '). They draw from <b>' + esc(D.pumps[h.use].name) + '</b>, the nearest.';
    }
    note(txt); flash(txt); render();
  }
  function interviewInst(inst) {
    var D = S.D, key = inst.kind;
    if (S.asked[key]) { flash('You have already called at the ' + inst.kind + '.'); return; }
    if (!spend(COST.interview, 'another call')) return;
    S.asked[key] = true;
    var dead = inst.deaths.filter(shown).length, txt;
    if (inst.kind === 'brewery') {
      txt = '<b>The ' + D.brewName + ' Brewery, ' + esc(D.edges[inst.e].name) + '</b> (' + inst.people + ' men, ' + (dead ? numw(dead) + ' dead' : 'not one of them ill') + '). Mr ' + D.brewer +
        ', the proprietor: the men have an allowance of malt liquor and never go to the pump, and the brewery has its own deep well besides.';
    } else {
      txt = '<b>The workhouse, ' + esc(D.edges[inst.e].name) + '</b> (' + inst.people + ' inmates, ' + (dead ? numw(dead) + ' dead' : 'none dead') + '). Mr ' + D.master +
        ', the master: the house has its own well in the yard and is supplied from a water company besides. Nobody inside goes out for water.';
    }
    note(txt); flash(txt); render();
  }
  function samplePump(k) {
    var D = S.D, p = D.pumps[k];
    if (S.sampled[k]) { flash('You already have a bottle from ' + esc(p.name) + '.'); return; }
    if (!spend(COST.sample, 'a sample')) return;
    S.sampled[k] = true;
    var look = p.sample === 'cloudy' ? 'After standing it throws down a few small white flocculent particles. Under the lens: shreds of something organic, nothing you could name or swear to.' :
      p.sample === 'iron' ? 'Clear, with a faint taste of iron. Under the lens: a little rust, a hair, nothing else.' :
      'Clear and cold and sparkling. Under the lens: nothing at all.';
    var txt = '<b>A bottle from ' + esc(p.name) + '</b> (well ' + p.depth + ' feet deep). ' + look;
    note(txt); flash(txt); render();
  }
  function pace() {
    if (S.paced) return;
    if (!spend(COST.pace, 'pacing the streets')) return;
    S.paced = true;
    var txt = '<b>You paced every street</b> from every pump and coloured each house by the pump nearest it on foot. The table under the map now counts the dead by walk.';
    note(txt); flash(txt); render();
  }
  function petition(k) {
    var D = S.D;
    if (S.over) return;
    if (S.petitioned === S.day) { flash('The Board has already sat tonight.'); return; }
    if (S.banUntil >= S.day) { flash('After last night the Board will not hear you again until ' + longDay(S.banUntil + 1) + '.'); return; }
    if (S.removed.some(function (x) { return x.pump === k; })) { flash('That handle is already off.'); return; }
    S.petitioned = S.day;
    S.removed.push({ pump: k, day: S.day });
    var txt;
    if (k === D.source) {
      S.R = S.day;
      txt = '<b>The Board of Guardians sat at seven.</b> They did not believe you, quite, but they sent a man with a spanner, and by nine the handle of <b>' + esc(D.pumps[k].name) + '</b> was off.';
    } else {
      S.banUntil = S.day + 1;
      txt = '<b>The Board of Guardians sat at seven</b> and took the handle off <b>' + esc(D.pumps[k].name) + '</b>. If the deaths go on, they will not be pleased to see you again before ' + longDay(S.day + 2) + '.';
    }
    S.hour = DAY_END;
    note(txt); flash(txt); render();
  }
  function sleep() {
    if (S.over) return;
    S.day++; S.hour = DAY_START;
    if (S.day > LAST) { finish(); return; }
    var today = allDeaths(S.D).filter(function (d) { return d.day === S.day - 1 && !prevented(d, S.R); }).length;
    flash('<b>The returns for ' + longDay(S.day - 1) + ':</b> ' + (today ? plural(today, 'death', 'deaths') + ' in the parish.' : 'not a death in the parish.'));
    render();
  }
  function runOn() {
    if (S.over) return;
    if (S.R === null && !window.confirm('Leave the parish to it? Nobody will take a handle off for you.')) return;
    S.day = LAST + 1; finish();
  }

  /* ---------- verdict ---------- */
  function finish() {
    var D = S.D;
    S.over = true; S.day = LAST + 1; S.hour = DAY_END;
    var none = totalWith(D, null), best = totalWith(D, FIRST), got = totalWith(D, S.R);
    var wrong = S.removed.filter(function (x) { return x.pump !== D.source; }).length;
    var src = D.pumps[D.source];
    var lines = [];
    var good = S.R !== null;
    lines.push('<li><span class="tick ' + (good ? 'y' : 'n') + '">' + (good ? 'right pump' : 'no') + '</span> ' +
      (good ? 'You had the handle taken off <b>' + esc(src.name) + '</b> on the evening of ' + longDay(S.R) + ' (day ' + S.R + ').' :
        'The water came from <b>' + esc(src.name) + '</b>, and its handle stayed on to the end.') + '</li>');
    if (good) {
      var lag = S.R - FIRST;
      lines.push('<li><span class="tick ' + (lag === 0 ? 'y' : lag <= 1 ? 'y' : 'n') + '">' + (lag === 0 ? 'first evening' : lag === 1 ? 'a day late' : lag + ' days late') + '</span> ' +
        'The earliest anyone could have done it was the evening you arrived. ' +
        (lag === 0 ? 'You did.' : 'Every day it stayed on, people who drank from it that day went on to die.') + '</li>');
    }
    lines.push('<li><span class="tick ' + (wrong ? 'n' : 'y') + '">' + (wrong ? plural(wrong, 'wrong handle', 'wrong handles') : 'no wrong handles') + '</span> ' +
      (wrong ? 'The Board took the handle off ' + S.removed.filter(function (x) { return x.pump !== D.source; }).map(function (x) { return esc(D.pumps[x.pump].name); }).join(' and ') + ' for nothing, and each one cost you a night of their patience.' :
        'You never sent the Board after the wrong pump.') + '</li>');
    var anom = ['brewery', 'workhouse'].filter(function (k) { return S.asked[k]; }).length + (S.asked['h' + D.houses.indexOf(D.carted)] ? 1 : 0);
    lines.push('<li><span class="tick ' + (anom === 3 ? 'y' : 'n') + '">' + anom + ' of 3 puzzles</span> ' +
      'Three places did not fit the map: a brewery and a workhouse beside the pump with almost no deaths, and a house far from it with two. ' +
      (anom === 3 ? 'You called at all three and heard why.' : 'You heard the explanation at ' + numw(anom) + '.') + '</li>');
    var saved = none - got, bestSaved = none - best;
    var head = good ? '<b>' + cap(plural(saved, 'life', 'lives')) + ' saved.</b> ' : '<b>No lives saved.</b> ';
    $('report').className = 'verdict ' + (good && S.R === FIRST && !wrong ? 'good' : 'warn');
    $('report').innerHTML = head + 'Left alone the outbreak would have killed <b>' + none + '</b>; with your evening it killed <b>' + got +
      '</b>. Had the handle come off the first evening it would have killed <b>' + best + '</b> (' + bestSaved + ' saved): people who had already drunk kept dying for a day or two whatever anyone did.' +
      '<ul class="per">' + lines.join('') + '</ul>' +
      '<p style="margin:10px 0 0">The map now shows the whole outbreak and every house coloured by the pump nearest it on foot. The pump that did it is ringed.</p>';
    render();
  }

  /* ---------- drawing ---------- */
  function render() {
    renderMap(); renderStatus(); renderSel(); renderNotes(); renderTable(); renderCurve();
  }
  function renderMap() {
    var D = S.D, o = [];
    var showAll = S.over, catch_ = S.paced || S.over;
    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0d121b"/>');
    // streets
    D.edges.forEach(function (e) {
      var A = D.nodes[e.a], B = D.nodes[e.b];
      o.push('<line x1="' + A.x.toFixed(1) + '" y1="' + A.y.toFixed(1) + '" x2="' + B.x.toFixed(1) + '" y2="' + B.y.toFixed(1) + '" stroke="#1d2533" stroke-width="13" stroke-linecap="round"/>');
    });
    // street names
    D.edges.forEach(function (e, k) {
      if (e.L < 90) return;
      var A = D.nodes[e.a], B = D.nodes[e.b], ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
      if ((e.hz && A.i % 2 === 1) || (!e.hz && A.j % 2 === 0 && A.j !== NY - 2)) {
        var cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2;
        o.push('<text x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) + '" transform="rotate(' + ang.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')" class="sname" dy="3">' + esc(e.name.toUpperCase()) + '</text>');
      }
    });
    // institutions
    [D.brewery, D.workhouse].forEach(function (I) {
      var asked = S.asked[I.kind];
      o.push('<polygon points="' + I.pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="' + (catch_ ? hexA(D.pumps[D.source].col, 0.16) : '#1a2130') + '" stroke="' + (asked ? '#64f0c8' : '#3a465c') + '" stroke-width="' + (asked ? 1.6 : 1) + '"/>');
      var a = I.ang; if (a > 90 || a < -90) a += 180;
      o.push('<text x="' + I.x.toFixed(1) + '" y="' + I.y.toFixed(1) + '" transform="rotate(' + a.toFixed(1) + ' ' + I.x.toFixed(1) + ' ' + I.y.toFixed(1) + ')" class="iname" dy="3">' + I.label.toUpperCase() + '</text>');
      var ds = I.deaths.filter(function (d) { return showAll ? !prevented(d, S.R) : shown(d); }).length;
      if (ds) {
        var g = '<g transform="translate(' + I.x.toFixed(1) + ' ' + I.y.toFixed(1) + ') rotate(' + a.toFixed(1) + ')">';
        for (var q = 0; q < ds; q++) g += '<circle cx="' + ((q - (ds - 1) / 2) * 5).toFixed(1) + '" cy="10" r="1.7" fill="#f2f4f8"/>';
        o.push(g + '</g>');
      }
    });
    // houses and their dead
    D.houses.forEach(function (h, k) {
      var asked = S.asked['h' + k];
      var fill = catch_ ? hexA(D.pumps[h.near].col, 0.42) : '#2a3343';
      o.push('<rect class="hs" x="' + (-h.w / 2).toFixed(1) + '" y="-3.5" width="' + h.w.toFixed(1) + '" height="7" rx="1" transform="translate(' + h.x.toFixed(1) + ' ' + h.y.toFixed(1) + ') rotate(' + h.ang.toFixed(1) + ')" fill="' + fill + '"' + (asked ? ' stroke="#64f0c8" stroke-width="1.4"' : '') + '/>');
      var n = h.deaths.filter(function (d) { return showAll ? !prevented(d, S.R) : shown(d); }).length;
      for (var q = 0; q < n; q++) {
        var off = 6 + q * 2.6, bx = h.x + h.ox * off, by = h.y + h.oy * off;
        var hw = Math.min(5, h.w / 2 - 0.5), dx = Math.cos(h.ang * Math.PI / 180) * hw, dy = Math.sin(h.ang * Math.PI / 180) * hw;
        o.push('<line x1="' + (bx - dx).toFixed(1) + '" y1="' + (by - dy).toFixed(1) + '" x2="' + (bx + dx).toFixed(1) + '" y2="' + (by + dy).toFixed(1) + '" stroke="#f2f4f8" stroke-width="1.6"/>');
      }
      if (S.over && h.deaths.length && h.deaths.every(function (d) { return prevented(d, S.R); })) {
        o.push('<circle cx="' + (h.x + h.ox * 7).toFixed(1) + '" cy="' + (h.y + h.oy * 7).toFixed(1) + '" r="1.8" fill="none" stroke="#64f0c8" stroke-width="1"/>');
      }
    });
    // pumps
    D.pumps.forEach(function (p, k) {
      var nd = D.nodes[p.node], off = S.removed.some(function (x) { return x.pump === k; }), sel = S.sel === k;
      if (S.over && k === D.source) o.push('<circle cx="' + nd.x.toFixed(1) + '" cy="' + nd.y.toFixed(1) + '" r="17" fill="none" stroke="#ff8fa3" stroke-width="2" stroke-dasharray="4 3"/>');
      if (sel) o.push('<circle cx="' + nd.x.toFixed(1) + '" cy="' + nd.y.toFixed(1) + '" r="13" fill="none" stroke="#e8edf5" stroke-width="1.5"/>');
      o.push('<circle cx="' + nd.x.toFixed(1) + '" cy="' + nd.y.toFixed(1) + '" r="8" fill="' + (off ? '#0d121b' : p.col) + '" stroke="' + p.col + '" stroke-width="2"/>');
      if (off) o.push('<path d="M' + (nd.x - 4) + ' ' + (nd.y - 4) + 'L' + (nd.x + 4) + ' ' + (nd.y + 4) + 'M' + (nd.x + 4) + ' ' + (nd.y - 4) + 'L' + (nd.x - 4) + ' ' + (nd.y + 4) + '" stroke="' + p.col + '" stroke-width="1.8"/>');
      else o.push('<text x="' + nd.x.toFixed(1) + '" y="' + (nd.y + 3.2).toFixed(1) + '" class="pl">P</text>');
      var lx = nd.x + 12, anchor = 'start';
      if (nd.x > W - 120) { lx = nd.x - 12; anchor = 'end'; }
      var ly = nd.y - 11 < 12 ? nd.y + 22 : nd.y - 11;
      o.push('<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" class="pname" text-anchor="' + anchor + '">' + esc(p.street.replace(/ (Street|Lane|Row|Place)$/, '')) + '</text>');
    });
    $('map').innerHTML = o.join('');
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function renderStatus() {
    var D = S.D;
    var left = DAY_END - S.hour;
    if (S.over) {
      $('when').innerHTML = '<b>The outbreak is over.</b> The last return was for ' + longDay(LAST) + '.';
    } else {
      $('when').innerHTML = '<b>' + longDay(S.day) + ' ' + D.year + '</b> · day ' + S.day + ' of the outbreak · ' +
        (left > 0 ? clock(S.hour) + ', ' + plural(left, 'hour', 'hours') + ' of daylight left' : 'evening') +
        (S.R !== null ? ' · <span class="ok">handle off ' + esc(D.pumps[D.source].street) + '</span>' : '');
    }
    var dead = allDeaths(D).filter(shown).length;
    if (S.over) dead = totalWith(D, S.R);
    $('deadOut').textContent = dead;
    $('btnPace').disabled = S.paced || S.over || left < COST.pace;
    $('btnPace').textContent = S.paced ? 'Walks paced' : 'Pace out the walks (' + COST.pace + ' h)';
    $('btnSleep').disabled = S.over;
    $('btnSleep').textContent = S.day >= LAST ? 'Wait for the last returns' : 'Go home until the morning\'s returns';
    $('btnEnd').disabled = S.over;
  }
  function renderSel() {
    var D = S.D, el = $('selBox');
    if (S.sel === null) { el.innerHTML = '<p class="sub empty">Tap a pump to sample it or put it to the Board. Tap a house, the brewery or the workhouse to call there (one hour).</p>'; return; }
    var p = D.pumps[S.sel], k = S.sel, off = S.removed.some(function (x) { return x.pump === k; });
    var left = DAY_END - S.hour;
    var nHouses = D.houses.filter(function (h) { return h.near === k; }).length;
    var html = '<div class="selh"><i class="sw" style="background:' + p.col + '"></i><b>' + esc(cap(p.name)) + '</b>' + (off ? ' <span class="tick n">handle off</span>' : '') + '</div>' +
      '<p class="sub small" style="margin-top:4px">At the corner of ' + esc(D.rowName[D.nodes[p.node].j]) + ' and ' + esc(D.colName[D.nodes[p.node].i]) + '.' + (S.paced ? ' Nearest on foot to ' + nHouses + ' houses.' : '') + '</p>' +
      '<div class="controls" style="margin-top:10px">' +
      '<button class="btn small ghost" type="button" id="bSample"' + (S.sampled[k] || S.over || left < COST.sample ? ' disabled' : '') + '>' + (S.sampled[k] ? 'Sampled' : 'Take a bottle to the lens (' + COST.sample + ' h)') + '</button>' +
      '<button class="btn small" type="button" id="bBoard"' + (off || S.over || S.petitioned === S.day || S.banUntil >= S.day ? ' disabled' : '') + '>Put it to the Board tonight</button>' +
      '</div>';
    if (!S.over && S.banUntil >= S.day) html += '<p class="sub small">The Board will not hear you again until ' + longDay(S.banUntil + 1) + '.</p>';
    el.innerHTML = html;
    var b1 = $('bSample'), b2 = $('bBoard');
    if (b1) b1.addEventListener('click', function () { samplePump(k); });
    if (b2) b2.addEventListener('click', function () {
      if (window.confirm('Ask the Board to take the handle off ' + p.name + ' tonight? That ends your day.')) petition(k);
    });
  }
  function renderNotes() {
    var el = $('notes');
    if (!S.notes.length) { el.innerHTML = '<p class="sub empty">Nothing yet. Calls and samples are written here as you make them.</p>'; return; }
    el.innerHTML = '<ul class="notes">' + S.notes.map(function (n) {
      return '<li><span class="nt">Day ' + n.day + '</span>' + n.html + '</li>';
    }).join('') + '</ul>';
  }
  function renderTable() {
    var D = S.D, el = $('tally');
    if (!S.paced && !S.over) { el.innerHTML = '<p class="sub empty">Pace out the walks to count the dead by the pump each house is nearest to on foot.</p>'; return; }
    var rows = D.pumps.map(function (p, k) {
      var hs = D.houses.filter(function (h) { return h.near === k; });
      var ppl = hs.reduce(function (a, h) { return a + h.res; }, 0);
      var dead = hs.reduce(function (a, h) { return a + h.deaths.filter(function (d) { return S.over ? !prevented(d, S.R) : shown(d); }).length; }, 0);
      return { k: k, p: p, n: hs.length, ppl: ppl, dead: dead, rate: ppl ? dead / ppl * 1000 : 0 };
    });
    var mx = Math.max.apply(null, rows.map(function (r) { return r.rate; })) || 1;
    el.innerHTML = '<table class="book"><thead><tr><th>Pump</th><th>Houses</th><th>People</th><th>Dead</th><th>Per 1,000</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><i class="sw" style="background:' + r.p.col + '"></i>' + esc(r.p.street) + '</td><td>' + r.n + '</td><td>' + r.ppl + '</td><td>' + r.dead + '</td><td>' + r.rate.toFixed(1) + '</td>' +
          '<td class="barcell"><span class="bar" style="width:' + (r.rate / mx * 100).toFixed(0) + '%;background:' + r.p.col + '"></span></td></tr>';
      }).join('') + '</tbody></table><p class="sub small">The brewery and the workhouse are left out; count them yourself.</p>';
  }
  function renderCurve() {
    var D = S.D, bw = 34, gap = 8, ch = 130, o = [];
    var counts = [], mx = 4;
    var all = allDeaths(D);
    for (var k = 1; k <= LAST; k++) {
      var c = all.filter(function (d) { return d.day === k && !prevented(d, S.R) && (S.over || d.day < S.day); }).length;
      counts.push(c); if (c > mx) mx = c;
    }
    var Wc = LAST * (bw + gap) + 30, Hc = ch + 52, T = 14;
    o.push('<svg viewBox="0 0 ' + Wc + ' ' + Hc + '" class="curve" role="img" aria-label="Deaths by day">');
    for (k = 1; k <= LAST; k++) {
      var x = 20 + (k - 1) * (bw + gap), c2 = counts[k - 1], known = S.over || k < S.day;
      var h = c2 / mx * ch;
      if (known) {
        o.push('<rect x="' + x + '" y="' + (T + 10 + ch - h).toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="3" fill="#e8edf5" fill-opacity=".85"/>');
        o.push('<text x="' + (x + bw / 2) + '" y="' + (T + 6 + ch - h).toFixed(1) + '" class="cv">' + c2 + '</text>');
      } else {
        o.push('<rect x="' + x + '" y="' + (T + 10 + ch - 6) + '" width="' + bw + '" height="6" rx="2" fill="none" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 3"/>');
      }
      o.push('<text x="' + (x + bw / 2) + '" y="' + (T + ch + 26) + '" class="cd">' + k + '</text>');
      if (k === S.day && !S.over) o.push('<text x="' + (x + bw / 2) + '" y="' + (T + ch + 38) + '" class="cd now">today</text>');
    }
    S.removed.forEach(function (rm) {
      var x = 20 + rm.day * (bw + gap) - gap / 2, ok = rm.pump === D.source;
      o.push('<line x1="' + x + '" y1="' + (T + 4) + '" x2="' + x + '" y2="' + (T + ch + 14) + '" stroke="' + (ok ? '#64f0c8' : '#ffce6a') + '" stroke-width="2" stroke-dasharray="' + (ok ? '0' : '4 3') + '"/>');
    });
    o.push('</svg>');
    $('curve').innerHTML = o.join('');
  }

  /* ---------- clicks on the map ---------- */
  function mapClick(ev) {
    var svg = $('map'), pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var m = svg.getScreenCTM(); if (!m) return;
    var p = pt.matrixTransform(m.inverse()), D = S.D;
    var best = null, bd = 1e9;
    D.pumps.forEach(function (pp, k) { var nd = D.nodes[pp.node], d = Math.hypot(nd.x - p.x, nd.y - p.y) - 6; if (d < bd) { bd = d; best = { t: 'p', k: k }; } });
    [D.brewery, D.workhouse].forEach(function (I) { var d = pointInPoly(p.x, p.y, I.pts) ? -1 : Math.hypot(I.x - p.x, I.y - p.y) - 8; if (d < bd) { bd = d; best = { t: 'i', I: I }; } });
    D.houses.forEach(function (h) { var d = Math.hypot(h.x - p.x, h.y - p.y); if (d < bd) { bd = d; best = { t: 'h', h: h }; } });
    if (!best || bd > 16) { S.sel = null; renderSel(); renderMap(); return; }
    if (best.t === 'p') { S.sel = best.k; renderSel(); renderMap(); return; }
    if (S.over) return;
    if (best.t === 'i') interviewInst(best.I); else interviewHouse(best.h);
  }
  function pointInPoly(x, y, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if (((pts[i][1] > y) !== (pts[j][1] > y)) && (x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0])) c = !c;
    }
    return c;
  }

  /* ---------- the day ---------- */
  function load() {
    var d = dateFor(S.off);
    S.D = build(seedForDate(d));
    reset();
    var D = S.D;
    var ppl = D.houses.reduce(function (a, h) { return a + h.res; }, 0) + D.workhouse.people;
    $('plWho').textContent = 'Parish of ' + D.parish + ', ' + D.district + ' · ' + D.year;
    $('plName').textContent = cap(plural(D.pumps.length, 'pump', 'pumps')) + ', ' + D.houses.length + ' houses and a sickness in the water';
    $('plBlurb').innerHTML = 'Cholera came into ' + D.district + ' in the last days of ' + MONTHS[D.start.getMonth()] + ' ' + D.year + ', and it came fast. You are the Board\'s medical officer, and you hold that it is carried in water, which not one of the Guardians believes. ' +
      'You have the registrar\'s returns for the first two days. Each evening the Board will sit and take <b>one pump handle</b> off for you; every day it stays on the right pump, the people who drink from it go on to die a day or two later. ' +
      'The parish has <b>' + ppl.toLocaleString('en-GB') + ' souls</b>. You have ten hours of daylight a day.';
    $('dayOut').textContent = (S.off === 0 ? 'Today, ' : S.off === -1 ? 'Yesterday, ' : S.off === 1 ? 'Tomorrow, ' : '') + longDate(d);
    $('report').className = 'verdict'; $('report').innerHTML = '';
    var first = allDeaths(D).filter(shown).length;
    flash('<b>The returns for ' + longDay(1) + ' and ' + longDay(2) + ':</b> ' + plural(first, 'death', 'deaths') + ' in the parish, every one of them plotted on the map as a bar against the house.');
    render();
  }
  function goDay(n) {
    if (S.notes && S.notes.length && !S.over && !window.confirm('Leave this parish for another day\'s?')) return;
    S.off = n; load();
  }

  $('map').addEventListener('click', mapClick);
  $('btnPace').addEventListener('click', pace);
  $('btnSleep').addEventListener('click', sleep);
  $('btnEnd').addEventListener('click', runOn);
  $('btnReset').addEventListener('click', function () { if (!S.notes.length || window.confirm('Start this parish again from the third morning?')) load(); });
  $('btnDayPrev').addEventListener('click', function () { goDay(S.off - 1); });
  $('btnDayToday').addEventListener('click', function () { goDay(0); });
  $('btnDayNext').addEventListener('click', function () { goDay(S.off + 1); });
  document.addEventListener('keydown', function (ev) {
    var tg = ev.target && ev.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || tg === 'BUTTON') return;
    if (ev.key === 'ArrowLeft') goDay(S.off - 1);
    else if (ev.key === 'ArrowRight') goDay(S.off + 1);
  });

  // exposed for testing only
  window.__pump = { build: build, S: S, totalWith: totalWith, allDeaths: allDeaths, seedForDate: seedForDate, petition: petition, sleep: sleep, pace: pace, finish: finish, interviewHouse: interviewHouse, interviewInst: interviewInst, samplePump: samplePump };

  load();
})();
