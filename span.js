/* The Span — today's number cuts a gorge, and you have to get something across it.
   A mass-spring truss with real axial forces, Euler buckling and members that
   break. Self-contained: no dependencies, no assets. */
(function () {
  'use strict';

  /* ---------- seeded PRNG (mulberry32), same as the rest of the site ---------- */
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
  function seedForToday() {
    var d = new Date();
    var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- the yard ---------- */
  var SPAN_W = 64;       // metres across the whole view
  var GRID = 4;          // metres between joints
  var MAXLEN = 12.7;     // longest single member
  var G = 9.81;
  var SUB = 5, DT = 1 / 300;        // live: five substeps a frame
  var DTH = 1 / 300;                // headless

  var MAT = {
    timber: { key: 'timber', name: 'Timber', cost: 9, ea: 3.4e6, limit: 4.2e4, buckle: 1.7e6, mass: 11, col: '#c08a55', w: 3.6 },
    steel:  { key: 'steel',  name: 'Steel',  cost: 26, ea: 8.7e6, limit: 1.3e5, buckle: 5.2e6, mass: 18, col: '#9fb3c8', w: 3.1 },
    cable:  { key: 'cable',  name: 'Cable',  cost: 6, ea: 6.7e6, limit: 1.0e5, buckle: 0, mass: 5, col: '#e3cf94', w: 1.5, rope: true },
    /* the roadway is bolted end to end: it pushes well and pulls badly, so it
       cannot quietly turn itself into a chain bridge and do your job for you */
    deck:   { key: 'deck',   name: 'Deck',   cost: 0, ea: 1.2e7, limit: 1.8e5, tlimit: 5.0e4, buckle: 4.0e6, mass: 24, col: '#6d7a8a', w: 7 }
  };
  var ORDER = ['timber', 'steel', 'cable'];

  var SETTINGS = [
    { place: 'the slate quarry at Bryn Glas', rock: '#3a4048', rock2: '#22262d', water: 0,
      crossing: 'a wagon of dressed slate', mass: 2400, kind: 'wagon',
      line: 'The tramway stops dead at the lip and starts again forty yards on.' },
    { place: 'the tideway below the old custom house', rock: '#4a4136', rock2: '#2c261f', water: 3,
      crossing: 'the morning milk lorry', mass: 1900, kind: 'lorry',
      line: 'Two hours either side of low water you could walk it. The lorry cannot wait.' },
    { place: 'the cutting north of Gledhill', rock: '#3f4642', rock2: '#252a27', water: 0,
      crossing: 'a shunting engine in light steam', mass: 2900, kind: 'loco',
      line: 'The rails are laid to the edge on both sides and nothing joins them.' },
    { place: 'the pass above Corrie Dhu', rock: '#474455', rock2: '#282734', water: 0,
      crossing: 'the post bus and eleven passengers', mass: 2100, kind: 'bus',
      line: 'The old road went round by the head of the glen and took four hours.' },
    { place: 'the flooded clay pit at Marle End', rock: '#4a443c', rock2: '#2a2622', water: 4,
      crossing: 'a tractor and a trailer of beet', mass: 2300, kind: 'tractor',
      line: 'Nobody has got to the far field since the pumps were sold.' },
    { place: "the ravine at Fenner's Leap", rock: '#3d444f', rock2: '#232830', water: 0,
      crossing: 'a cattle float, twelve head', mass: 2500, kind: 'float',
      line: 'It is named after a man who tried it on a horse and is not otherwise remembered.' }
  ];

  /* =====================================================================
     1. The site
     ===================================================================== */

  function makeSite(seed, shrink) {
    var rand = rng(seed ^ 0x5bf03635);
    var set = SETTINGS[Math.floor(rand() * SETTINGS.length)];
    var gap = 28 + Math.floor(rand() * 5) * GRID - shrink * GRID;
    if (gap < 20) gap = 20;
    var xL = Math.round(((SPAN_W - gap) / 2) / GRID) * GRID;
    var xR = xL + gap;
    var D = [12, 16, 20, 24][Math.floor(rand() * 4)];
    var run = GRID * (1 + Math.floor(rand() * 3));
    if (run > (gap - GRID) / 2) run = GRID;

    var site = {
      seed: seed >>> 0, set: set, xL: xL, xR: xR, gap: gap, D: D,
      fx0: xL + run, fx1: xR - run,
      waterY: set.water ? D - set.water : null,
      viewY0: -20, viewY1: D + 6
    };
    site.deckXs = [];
    for (var x = xL; x <= xR; x += GRID) site.deckXs.push(x);
    return site;
  }

  function groundAt(site, x) {
    if (x <= site.xL || x >= site.xR) return 0;
    if (x >= site.fx0 && x <= site.fx1) return site.D;
    if (x < site.fx0) return site.D * smooth((x - site.xL) / (site.fx0 - site.xL));
    return site.D * smooth((site.xR - x) / (site.xR - site.fx1));
  }
  function isAnchor(site, x, y) { return y >= groundAt(site, x) - 0.02; }
  function inRock(site, x, y) { return y > groundAt(site, x) + 0.02; }

  function buildableAt(site, x, y) {
    if (x < 0 || x > SPAN_W) return false;
    if (y < -20 || y > site.D + 0.01) return false;
    return !inRock(site, x, y);
  }

  /* a member may not be threaded through solid rock */
  function clearOfRock(site, ax, ay, bx, by) {
    for (var i = 1; i < 6; i++) {
      var t = i / 6;
      var x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (y > groundAt(site, x) + 0.35) return false;
    }
    return true;
  }

  /* =====================================================================
     2. Structure
     ===================================================================== */

  function key(x, y) { return x.toFixed(2) + '|' + y.toFixed(2); }

  function makeWorld(site, design) {
    var w = { nodes: [], members: [], index: {}, deck: [], site: site };

    function node(x, y) {
      var k = key(x, y);
      if (w.index[k] !== undefined) return w.index[k];
      var n = {
        x: x, y: y, x0: x, y0: y, vx: 0, vy: 0, fx: 0, fy: 0,
        m: 0, fixed: isAnchor(site, x, y), deck: false
      };
      w.index[k] = w.nodes.length;
      w.nodes.push(n);
      return w.nodes.length - 1;
    }
    function member(ax, ay, bx, by, mat, isDeck) {
      var a = node(ax, ay), b = node(bx, by);
      if (a === b) return null;
      var dx = bx - ax, dy = by - ay;
      var rest = Math.sqrt(dx * dx + dy * dy);
      var m = {
        a: a, b: b, rest: rest, mat: MAT[mat], deck: !!isDeck,
        k: MAT[mat].ea / rest, c: 0, force: 0, ratio: 0, over: 0, broken: false
      };
      m.comp = MAT[mat].rope ? 0 : Math.min(MAT[mat].limit, MAT[mat].buckle / (rest * rest));
      w.members.push(m);
      return m;
    }

    // the roadway is given, and it is the thing that has to survive
    for (var i = 0; i < site.deckXs.length - 1; i++) {
      var m = member(site.deckXs[i], 0, site.deckXs[i + 1], 0, 'deck', true);
      w.deck.push(m);
    }
    for (i = 0; i < site.deckXs.length; i++) {
      var ni = w.index[key(site.deckXs[i], 0)];
      w.nodes[ni].deck = true;
      w.nodes[ni].deckIndex = i;
    }

    for (i = 0; i < design.length; i++) {
      var d = design[i];
      member(d.ax, d.ay, d.bx, d.by, d.mat, false);
    }

    // masses: half of every member hanging on it, with a floor for stability
    for (i = 0; i < w.nodes.length; i++) w.nodes[i].m = 0;
    for (i = 0; i < w.members.length; i++) {
      var mm = w.members[i];
      var half = 0.5 * mm.mat.mass * mm.rest;
      w.nodes[mm.a].m += half;
      w.nodes[mm.b].m += half;
    }
    for (i = 0; i < w.nodes.length; i++) if (w.nodes[i].m < 60) w.nodes[i].m = 60;

    for (i = 0; i < w.members.length; i++) {
      var mo = w.members[i];
      var ma = w.nodes[mo.a].m, mb = w.nodes[mo.b].m;
      var red = (ma * mb) / (ma + mb);
      mo.c = 2 * 0.45 * Math.sqrt(mo.k * red);
    }
    return w;
  }

  function designCost(design) {
    var c = 0;
    for (var i = 0; i < design.length; i++) {
      var d = design[i];
      var L = Math.sqrt((d.bx - d.ax) * (d.bx - d.ax) + (d.by - d.ay) * (d.by - d.ay));
      c += L * MAT[d.mat].cost;
    }
    return c;
  }

  /* =====================================================================
     3. Physics
     ===================================================================== */

  function newSim(site, design, live) {
    return {
      site: site, w: makeWorld(site, design), t: 0, phase: 'settle',
      worst: 0, worstMem: null, fail: null, ok: false, done: false,
      breaks: [], live: !!live,
      veh: { x: site.xL - 7, y: 0, vy: 0, falling: false, speed: 7, wt: site.set.mass * G }
    };
  }

  function deckYAt(sim, x) {
    var w = sim.w, site = sim.site;
    var i = Math.floor((x - site.xL) / GRID);
    if (i < 0 || i >= w.deck.length) return 0;
    var dm = w.deck[i];
    var a = w.nodes[dm.a], b = w.nodes[dm.b];
    var t = (x - site.xL - i * GRID) / GRID;
    return { y: a.y + (b.y - a.y) * t, seg: dm, a: a, b: b, t: t };
  }

  function step(sim, dt) {
    var w = sim.w, n = w.nodes, ms = w.members, i;
    sim.t += dt;

    var ramp = sim.phase === 'settle' ? Math.min(1, sim.t / 0.6) : 1;
    var damp = sim.phase === 'settle' ? 0.99 : 0.9985;

    for (i = 0; i < n.length; i++) { n[i].fx = 0; n[i].fy = n[i].m * G * ramp; }

    // the load, where it happens to be standing
    if (sim.phase === 'cross' && !sim.veh.falling) {
      var vx = sim.veh.x;
      if (vx >= sim.site.xL && vx <= sim.site.xR) {
        var d = deckYAt(sim, Math.min(vx, sim.site.xR - 0.001));
        if (d && d.seg) {
          if (d.seg.broken) { sim.veh.falling = true; failNow(sim, 'the roadway went out from under it'); }
          else {
            d.a.fy += sim.veh.wt * (1 - d.t);
            d.b.fy += sim.veh.wt * d.t;
            sim.veh.y = d.y;
          }
        }
      }
    }

    for (i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.broken) continue;
      var a = n[m.a], b = n[m.b];
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (!(len > 1e-6)) continue;
      var ux = dx / len, uy = dy / len;
      var f = m.k * (len - m.rest);            // positive = tension
      if (m.mat.rope && f < 0) f = 0;
      var tot = f;
      if (f !== 0) {
        var vr = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
        tot += m.c * vr;
      }
      a.fx += tot * ux; a.fy += tot * uy;
      b.fx -= tot * ux; b.fy -= tot * uy;

      m.force = f;
      var cap = f >= 0 ? (m.mat.tlimit || m.mat.limit) : m.comp;
      m.ratio = cap > 0 ? Math.abs(f) / cap : 0;
      if (m.ratio > sim.worst) { sim.worst = m.ratio; sim.worstMem = m; }
      if (m.ratio > 1) {
        m.over += dt;
        if (m.over > 0.03) snap(sim, m);
      } else if (m.over > 0) {
        m.over = Math.max(0, m.over - dt * 0.5);
      }
    }

    for (i = 0; i < n.length; i++) {
      var p = n[i];
      if (p.fixed) { p.vx = 0; p.vy = 0; continue; }
      p.vx += (p.fx / p.m) * dt;
      p.vy += (p.fy / p.m) * dt;
      p.vx *= damp; p.vy *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!isFinite(p.x) || !isFinite(p.y) || Math.abs(p.vy) > 4000) {
        failNow(sim, 'the whole thing came apart');
        return;
      }
      if (p.deck && p.y > 2.5) failNow(sim, 'the roadway sagged away under it');
    }

    // phases
    if (sim.phase === 'settle') {
      if (sim.t > 1.2) { sim.phase = 'cross'; sim.t = 0; sim.worst = 0; sim.worstMem = null; }
    } else if (sim.phase === 'cross') {
      var v = sim.veh;
      if (v.falling) {
        v.vy += G * dt; v.y += v.vy * dt;
        if (v.y > sim.site.D + 2) { sim.done = true; }
      } else {
        v.x += v.speed * dt;
        if (v.x < sim.site.xL || v.x > sim.site.xR) v.y += (0 - v.y) * Math.min(1, dt * 12);
        if (v.x > sim.site.xR + 6) { sim.ok = true; sim.done = true; sim.phase = 'done'; }
      }
    }
  }

  function snap(sim, m) {
    m.broken = true;
    var a = sim.w.nodes[m.a], b = sim.w.nodes[m.b];
    sim.breaks.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, age: 0, mat: m.mat });
    if (m.deck && !sim.fail) failNow(sim, sim.phase === 'settle'
      ? 'the roadway broke under its own weight'
      : 'a panel of the roadway let go');
  }

  function failNow(sim, why) {
    if (sim.fail) return;
    sim.fail = why;
    if (sim.phase === 'settle') sim.done = true;
    sim.veh.falling = true;
  }

  /* headless: run the whole crossing as fast as the machine will do it */
  function testDesign(site, design) {
    var sim = newSim(site, design, false);
    var guard = 0;
    while (!sim.done && guard++ < 9000) step(sim, DTH);
    return sim;
  }

  /* =====================================================================
     4. The reference design — the page will not deal a gorge it cannot cross
     ===================================================================== */

  function underTruss(site, mat, depth) {
    var xs = site.deckXs, n = xs.length, i, out = [];
    var low = {};
    for (i = 1; i < n - 1; i++) low[i] = { x: xs[i], y: depth };
    function add(ax, ay, bx, by) { out.push({ ax: ax, ay: ay, bx: bx, by: by, mat: mat }); }
    for (i = 1; i < n - 2; i++) add(low[i].x, depth, low[i + 1].x, depth);
    for (i = 1; i < n - 1; i++) add(xs[i], 0, xs[i], depth);
    for (i = 0; i < n - 1; i++) {
      if (low[i + 1]) add(xs[i], 0, xs[i + 1], depth);
      if (low[i]) add(xs[i + 1], 0, xs[i], depth);
    }
    return out;
  }

  function chooseReference(site) {
    var cands = [
      { mat: 'timber', d: 4, name: 'a timber lattice four metres deep' },
      { mat: 'timber', d: 8, name: 'a timber lattice eight metres deep' },
      { mat: 'steel', d: 4, name: 'a steel lattice four metres deep' },
      { mat: 'steel', d: 8, name: 'a steel lattice eight metres deep' }
    ];
    var best = null;
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].d > site.D - 2) continue;
      var design = underTruss(site, cands[i].mat, cands[i].d);
      var cost = designCost(design);
      var sim = testDesign(site, design);
      if (sim.ok && !sim.fail) {
        if (!best || cost < best.cost) best = { design: design, cost: cost, name: cands[i].name, worst: sim.worst };
      }
    }
    return best;
  }

  function dealSite(seed) {
    for (var shrink = 0; shrink < 6; shrink++) {
      var site = makeSite(seed, shrink);
      var ref = chooseReference(site);
      if (ref) {
        site.ref = ref;
        site.budget = Math.ceil((ref.cost * 1.45) / 25) * 25;
        return site;
      }
    }
    var s = makeSite(seed, 6);
    s.ref = { design: underTruss(s, 'steel', 8), cost: designCost(underTruss(s, 'steel', 8)), name: 'a steel lattice eight metres deep', worst: 0 };
    s.budget = Math.ceil((s.ref.cost * 1.6) / 25) * 25;
    return s;
  }

  /* =====================================================================
     5. Page state
     ===================================================================== */

  var cv = document.getElementById('span');
  if (!cv) return;
  var ctx = cv.getContext('2d');

  var site = null, design = [], sim = null, raf = null;
  var tool = 'timber';
  var drag = null, hoverPt = null, hoverMem = -1;
  var undoStack = [];
  var S = 10, DPR = 1, CW = 0, CH = 0;

  function $(id) { return document.getElementById(id); }
  function money(v) { return '£' + Math.round(v).toLocaleString('en-GB'); }
  function cost() { return designCost(design); }
  function left() { return site.budget - cost(); }

  /* ---------- geometry helpers ---------- */
  function sx(x) { return x * S; }
  function sy(y) { return (y - site.viewY0) * S; }
  function wx(px) { return px / S; }
  function wy(py) { return py / S + site.viewY0; }

  function snapPoint(x, y) {
    var gx = Math.round(x / GRID) * GRID;
    var gy = Math.round(y / GRID) * GRID;
    if (!buildableAt(site, gx, gy)) return null;
    var d = Math.hypot(gx - x, gy - y);
    if (d > GRID * 0.62) return null;
    return { x: gx, y: gy };
  }

  function hasMember(ax, ay, bx, by) {
    for (var i = 0; i < design.length; i++) {
      var d = design[i];
      if ((d.ax === ax && d.ay === ay && d.bx === bx && d.by === by) ||
          (d.ax === bx && d.ay === by && d.bx === ax && d.by === ay)) return i;
    }
    if (ay === 0 && by === 0 && Math.abs(ax - bx) === GRID &&
        Math.min(ax, bx) >= site.xL && Math.max(ax, bx) <= site.xR) return -2; // the deck itself
    return -1;
  }

  function validPair(a, b) {
    if (!a || !b) return { ok: false, why: '' };
    if (a.x === b.x && a.y === b.y) return { ok: false, why: '' };
    var L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L > MAXLEN) return { ok: false, why: 'nothing longer than twelve metres in one piece' };
    if (hasMember(a.x, a.y, b.x, b.y) !== -1) return { ok: false, why: 'there is already something there' };
    if (!clearOfRock(site, a.x, a.y, b.x, b.y)) return { ok: false, why: 'that runs through the rock' };
    if (isAnchor(site, a.x, a.y) && isAnchor(site, b.x, b.y) && a.y > 0.01 && b.y > 0.01)
      return { ok: false, why: 'both ends are already in the ground' };
    var c = L * MAT[tool].cost;
    if (c > left() + 0.01) return { ok: false, why: 'that costs ' + money(c) + ' and you have ' + money(left()) };
    return { ok: true, cost: c };
  }

  function addMember(a, b) {
    var v = validPair(a, b);
    if (!v.ok) { flash(v.why); return false; }
    design.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, mat: tool });
    undoStack.push(design.length - 1);
    readout();
    return true;
  }

  function removeAt(x, y) {
    var best = -1, bd = 1e9;
    for (var i = 0; i < design.length; i++) {
      var d = design[i];
      var dist = segDist(x, y, d.ax, d.ay, d.bx, d.by);
      if (dist < bd) { bd = dist; best = i; }
    }
    if (best >= 0 && bd < 1.4) {
      design.splice(best, 1);
      undoStack = [];
      readout();
      return true;
    }
    return false;
  }

  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  /* =====================================================================
     6. Drawing
     ===================================================================== */

  function resize() {
    var cssW = cv.clientWidth || 900;
    var viewH = site.viewY1 - site.viewY0;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    S = cssW / SPAN_W;
    CW = cssW; CH = cssW * (viewH / SPAN_W);
    cv.style.aspectRatio = SPAN_W + '/' + viewH;
    cv.width = Math.round(CW * DPR);
    cv.height = Math.round(CH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function groundPath() {
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0));
    for (var x = 0; x <= SPAN_W + 0.001; x += 0.5) ctx.lineTo(sx(x), sy(groundAt(site, x)));
    ctx.lineTo(sx(SPAN_W), sy(site.viewY1 + 2));
    ctx.lineTo(sx(0), sy(site.viewY1 + 2));
    ctx.closePath();
  }

  function draw() {
    var i;
    ctx.clearRect(0, 0, CW, CH);

    // sky
    var sky = ctx.createLinearGradient(0, 0, 0, CH);
    sky.addColorStop(0, '#080b11');
    sky.addColorStop(0.42, '#0d1420');
    sky.addColorStop(0.55, '#141d2b');
    sky.addColorStop(1, '#0a0e15');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CW, CH);

    // far hills, for depth
    ctx.fillStyle = 'rgba(122,162,255,.055)';
    ctx.beginPath();
    ctx.moveTo(0, sy(0));
    for (i = 0; i <= 40; i++) {
      var hx = (i / 40) * SPAN_W;
      var h = -3 - 4 * Math.sin(i * 0.7 + site.seed % 7) - 2 * Math.sin(i * 0.23);
      ctx.lineTo(sx(hx), sy(h));
    }
    ctx.lineTo(sx(SPAN_W), sy(0)); ctx.closePath(); ctx.fill();

    // rock
    var g = ctx.createLinearGradient(0, sy(-2), 0, sy(site.D + 6));
    g.addColorStop(0, site.set.rock);
    g.addColorStop(1, site.set.rock2);
    groundPath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0));
    for (var x2 = 0; x2 <= SPAN_W + 0.001; x2 += 0.5) ctx.lineTo(sx(x2), sy(groundAt(site, x2)));
    ctx.stroke();

    // water
    if (site.waterY !== null) {
      ctx.save();
      groundPath();
      ctx.clip();
      ctx.fillStyle = 'rgba(80,150,190,.34)';
      ctx.fillRect(0, sy(site.waterY), CW, CH);
      ctx.restore();
      ctx.strokeStyle = 'rgba(160,220,240,.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx(site.fx0 - 3), sy(site.waterY));
      ctx.lineTo(sx(site.fx1 + 3), sy(site.waterY));
      ctx.stroke();
    }

    // approach roads
    ctx.strokeStyle = '#59636f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(site.xL), sy(0));
    ctx.moveTo(sx(site.xR), sy(0)); ctx.lineTo(sx(SPAN_W), sy(0));
    ctx.stroke();

    // build grid
    if (!sim) {
      for (var gx = 0; gx <= SPAN_W; gx += GRID) {
        for (var gy = -20; gy <= site.D; gy += GRID) {
          if (!buildableAt(site, gx, gy)) continue;
          var anch = isAnchor(site, gx, gy);
          ctx.fillStyle = anch ? 'rgba(100,240,200,.5)' : 'rgba(255,255,255,.13)';
          if (anch) ctx.fillRect(sx(gx) - 2.5, sy(gy) - 2.5, 5, 5);
          else { ctx.beginPath(); ctx.arc(sx(gx), sy(gy), 1.4, 0, 6.2832); ctx.fill(); }
        }
      }
    }

    // members
    if (sim) drawWorld(); else drawDesign();

    // drag preview
    if (drag && hoverPt) {
      var v = validPair(drag, hoverPt);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = v.ok ? MAT[tool].col : '#e0687f';
      ctx.lineWidth = MAT[tool].w;
      ctx.beginPath();
      ctx.moveTo(sx(drag.x), sy(drag.y));
      ctx.lineTo(sx(hoverPt.x), sy(hoverPt.y));
      ctx.stroke();
      ctx.restore();
    }
    if (drag) {
      ctx.fillStyle = '#64f0c8';
      ctx.beginPath(); ctx.arc(sx(drag.x), sy(drag.y), 4.5, 0, 6.2832); ctx.fill();
    }
    if (hoverPt && !drag && tool !== 'erase') {
      ctx.strokeStyle = 'rgba(100,240,200,.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx(hoverPt.x), sy(hoverPt.y), 5, 0, 6.2832); ctx.stroke();
    }

    if (sim) {
      drawBreaks();
      drawVehicle();
    }
  }

  function memberLine(ax, ay, bx, by, col, wpx, rope) {
    ctx.strokeStyle = col;
    ctx.lineWidth = wpx;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(ax), sy(ay));
    ctx.lineTo(sx(bx), sy(by));
    ctx.stroke();
    if (rope) return;
  }

  function drawDesign() {
    var i;
    // deck
    for (i = 0; i < site.deckXs.length - 1; i++)
      memberLine(site.deckXs[i], 0, site.deckXs[i + 1], 0, MAT.deck.col, MAT.deck.w);
    for (i = 0; i < design.length; i++) {
      var d = design[i];
      var hi = (i === hoverMem);
      memberLine(d.ax, d.ay, d.bx, d.by, hi ? '#ffffff' : MAT[d.mat].col, MAT[d.mat].w + (hi ? 1.5 : 0));
    }
    // joints
    var seen = {};
    function jt(x, y) {
      var k = key(x, y);
      if (seen[k]) return; seen[k] = 1;
      if (isAnchor(site, x, y)) {
        ctx.fillStyle = '#64f0c8';
        ctx.beginPath();
        ctx.moveTo(sx(x) - 5, sy(y) + 5); ctx.lineTo(sx(x) + 5, sy(y) + 5); ctx.lineTo(sx(x), sy(y) - 3);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#dce4ef';
        ctx.beginPath(); ctx.arc(sx(x), sy(y), 2.6, 0, 6.2832); ctx.fill();
      }
    }
    for (i = 0; i < site.deckXs.length; i++) jt(site.deckXs[i], 0);
    for (i = 0; i < design.length; i++) { jt(design[i].ax, design[i].ay); jt(design[i].bx, design[i].by); }
  }

  function stressCol(r) {
    r = clamp(r, 0, 1);
    var h = (1 - r) * 135;
    return 'hsl(' + h.toFixed(0) + ',72%,' + (48 + r * 12).toFixed(0) + '%)';
  }

  function drawWorld() {
    var w = sim.w, n = w.nodes, i;
    for (i = 0; i < w.members.length; i++) {
      var m = w.members[i];
      if (m.broken) continue;
      var a = n[m.a], b = n[m.b];
      memberLine(a.x, a.y, b.x, b.y, m.deck ? MAT.deck.col : stressCol(m.ratio), m.mat.w);
    }
    for (i = 0; i < n.length; i++) {
      var p = n[i];
      if (p.fixed) continue;
      ctx.fillStyle = 'rgba(220,228,239,.8)';
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 2.1, 0, 6.2832); ctx.fill();
    }
  }

  function drawBreaks() {
    for (var i = 0; i < sim.breaks.length; i++) {
      var b = sim.breaks[i];
      if (b.age > 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - b.age;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      var mx = (b.ax + b.bx) / 2, my = (b.ay + b.by) / 2;
      var r = 6 + b.age * 26;
      ctx.beginPath(); ctx.arc(sx(mx), sy(my), r, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }
  }

  function drawVehicle() {
    var v = sim.veh, k = site.set.kind;
    var len = k === 'loco' ? 6 : (k === 'float' || k === 'lorry' ? 6.5 : 5);
    var hgt = k === 'bus' ? 3.2 : 2.6;
    var col = { wagon: '#8e6a4a', lorry: '#7d8fa6', loco: '#5a4a52', bus: '#4f6b57', tractor: '#8a6a3a', float: '#6d6a5a' }[k] || '#7d8fa6';
    var x = v.x, y = v.y;
    ctx.save();
    ctx.translate(sx(x), sy(y));
    var Lp = len * S, Hp = hgt * S, wr = 0.7 * S;
    ctx.fillStyle = col;
    ctx.fillRect(-Lp / 2, -Hp - wr * 0.6, Lp, Hp);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(-Lp / 2, -Hp - wr * 0.6, Lp, Hp * 0.28);
    if (k === 'loco') {
      ctx.fillStyle = '#2f2a2e';
      ctx.fillRect(Lp * 0.22, -Hp * 1.75 - wr * 0.6, Lp * 0.14, Hp * 0.75);
    }
    if (k === 'bus' || k === 'lorry' || k === 'tractor') {
      ctx.fillStyle = 'rgba(180,220,255,.5)';
      ctx.fillRect(Lp * 0.12, -Hp * 0.94 - wr * 0.6, Lp * 0.3, Hp * 0.34);
    }
    ctx.fillStyle = '#20252c';
    var wheels = [-Lp * 0.32, 0, Lp * 0.32];
    for (var i = 0; i < wheels.length; i++) {
      ctx.beginPath(); ctx.arc(wheels[i], -wr * 0.6, wr, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  /* =====================================================================
     7. Running a test
     ===================================================================== */

  function startTest() {
    if (sim) { stopTest(); return; }
    if (!design.length) { flash('there is nothing there to test'); return; }
    sim = newSim(site, design, true);
    $('btnTest').textContent = 'Stop';
    setStatus('load crossing…', false);
    verdict('');
    loop();
  }

  function stopTest() {
    if (raf) cancelAnimationFrame(raf);
    raf = null; sim = null;
    $('btnTest').textContent = 'Send it across';
    setStatus('building', false);
    draw();
  }

  function loop() {
    for (var i = 0; i < SUB && !sim.done; i++) step(sim, DT);
    for (var b = 0; b < sim.breaks.length; b++) sim.breaks[b].age += SUB * DT * 1.1;
    draw();
    liveReadout();
    if (sim.done) { finish(); return; }
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    var ok = sim.ok && !sim.fail;
    var spent = cost();
    var worst = Math.round(sim.worst * 100);
    if (ok) {
      setStatus('across', true);
      verdict('<b>' + cap1(site.set.crossing) + ' is across.</b> ' + money(spent) +
        ' of the ' + money(site.budget) + ' you were given, and the hardest-worked member in the bridge ran at ' +
        worst + ' per cent of what it can take' +
        (worst > 92 ? ' — which is closer than an engineer would like.' :
         worst < 45 ? ' — you could probably have built it cheaper.' : '.'), 'right');
    } else {
      setStatus('collapsed', false);
      var m = sim.worstMem;
      var extra = '';
      if (m) {
        var capN = (m.force >= 0 ? m.mat.limit : m.comp) / 1000;
        extra = ' The worst of it was a ' + m.rest.toFixed(1) + ' m ' + m.mat.name.toLowerCase() +
          ' member ' + (m.force >= 0 ? 'pulled' : 'pushed') + ' to ' +
          Math.abs(m.force / 1000).toFixed(0) + ' kN, against the ' + capN.toFixed(0) + ' kN ' +
          (m.force >= 0 ? 'it will take in tension' : 'a piece that long will take before it buckles') + '.';
      }
      verdict('<b>It did not hold: ' + (sim.fail || 'the structure failed') + '.</b>' + extra, 'wrong');
    }
    $('btnTest').textContent = 'Back to building';
  }

  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* =====================================================================
     8. Readouts and controls
     ===================================================================== */

  function readout() {
    $('costOut').textContent = money(cost());
    $('budgetOut').textContent = money(site.budget);
    $('membersOut').textContent = String(design.length);
    var bar = $('bar');
    if (bar) bar.style.width = clamp((cost() / site.budget) * 100, 0, 100).toFixed(1) + '%';
    draw();
  }

  function liveReadout() {
    $('stressOut').textContent = Math.round(sim.worst * 100) + '%';
  }

  function setStatus(txt, done) {
    var el = $('statusOut');
    el.textContent = txt;
    el.className = 'span-status' + (done ? ' done' : '');
  }

  var flashTimer = null;
  function flash(msg) {
    if (!msg) return;
    var el = $('noteOut');
    el.textContent = msg;
    el.style.opacity = '1';
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { el.style.opacity = '0'; }, 2600);
  }

  function verdict(html, cls) {
    var v = $('verdict');
    if (!html) { v.style.display = 'none'; v.className = 'verdict'; v.innerHTML = ''; return; }
    v.innerHTML = html;
    v.className = 'verdict ' + (cls || '');
    v.style.display = 'block';
  }

  function chips() {
    var box = $('tools');
    box.innerHTML = '';
    var items = ORDER.map(function (k) {
      return { k: k, label: MAT[k].name + ' · ' + money(MAT[k].cost) + '/m', col: MAT[k].col };
    });
    items.push({ k: 'erase', label: 'Take it down', col: '#e0687f' });
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'chip swatch' + (tool === it.k ? ' on' : '');
      b.innerHTML = '<em style="background:' + it.col + '"></em>' + it.label;
      b.addEventListener('click', function () {
        tool = it.k;
        chips();
        draw();
      });
      box.appendChild(b);
    });
  }

  function newSite(seed) {
    if (sim) stopTest();
    var t0 = performance.now();
    site = dealSite(seed);
    var ms = performance.now() - t0;
    design = [];
    undoStack = [];
    resize();
    $('gapOut').textContent = site.gap + ' m';
    $('depthOut').textContent = site.D + ' m';
    $('loadOut').textContent = (site.set.mass / 1000).toFixed(1) + ' t';
    $('seedOut').textContent = String(site.seed).padStart(10, '0');
    $('briefOut').innerHTML =
      '<p class="lead-line">' + cap1(site.set.crossing) + ' has to get across ' + site.set.place + '.</p>' +
      '<p>' + site.set.line + ' The gap is <b>' + site.gap + ' metres</b> and the floor of it is <b>' +
      site.D + ' metres</b> down. The roadway is already laid across the opening and it is the thing that has to survive: ' +
      'everything else is yours to build, out of ' + money(site.budget) + '.</p>' +
      '<p class="dimline">Proved before you were shown it: ' + site.ref.name + ' gets ' +
      (site.set.mass / 1000).toFixed(1) + ' tonnes across this gorge for ' + money(site.ref.cost) +
      ', which is where your budget came from. The page ran that crossing in ' + ms.toFixed(0) +
      ' ms before it drew any of this.</p>';
    verdict('');
    setStatus('building', false);
    readout();
  }

  /* ---------- pointer ---------- */
  function ptFromEvent(e) {
    var r = cv.getBoundingClientRect();
    return { x: wx((e.clientX - r.left) * (CW / r.width)), y: wy((e.clientY - r.top) * (CH / r.height)) };
  }

  cv.addEventListener('pointerdown', function (e) {
    if (sim) return;
    cv.setPointerCapture(e.pointerId);
    var p = ptFromEvent(e);
    if (tool === 'erase') { if (!removeAt(p.x, p.y)) flash('nothing there to take down'); return; }
    var s = snapPoint(p.x, p.y);
    if (!s) { drag = null; draw(); return; }
    if (drag && (drag.x !== s.x || drag.y !== s.y)) {
      // tap-tap building, for touch
      if (addMember(drag, s)) { drag = s; draw(); return; }
    }
    drag = s;
    draw();
  });

  cv.addEventListener('pointermove', function (e) {
    if (sim) return;
    var p = ptFromEvent(e);
    hoverPt = snapPoint(p.x, p.y);
    if (tool === 'erase') {
      var best = -1, bd = 1e9;
      for (var i = 0; i < design.length; i++) {
        var d = design[i];
        var dist = segDist(p.x, p.y, d.ax, d.ay, d.bx, d.by);
        if (dist < bd) { bd = dist; best = i; }
      }
      hoverMem = bd < 1.4 ? best : -1;
    } else {
      hoverMem = -1;
    }
    draw();
  });

  cv.addEventListener('pointerup', function (e) {
    if (sim || !drag) return;
    var p = ptFromEvent(e);
    var s = snapPoint(p.x, p.y);
    if (s && (s.x !== drag.x || s.y !== drag.y)) {
      if (addMember(drag, s)) drag = s;
    }
    draw();
  });

  cv.addEventListener('pointerleave', function () { hoverPt = null; hoverMem = -1; if (site) draw(); });

  /* ---------- buttons and keys ---------- */
  function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }

  wire('btnTest', startTest);
  wire('btnUndo', function () {
    if (sim) return;
    if (!design.length) return;
    design.pop();
    readout();
  });
  wire('btnClear', function () {
    if (sim) stopTest();
    design = []; undoStack = []; verdict(''); readout();
  });
  wire('btnSolve', function () {
    if (sim) stopTest();
    design = site.ref.design.map(function (d) { return { ax: d.ax, ay: d.ay, bx: d.bx, by: d.by, mat: d.mat }; });
    verdict('');
    flash('this is the cheapest of the four standard lattices the page tried — ' + money(site.ref.cost));
    readout();
  });
  wire('btnNew', function () { newSite((Math.random() * 4294967295) >>> 0); });
  wire('btnToday', function () { newSite(seedForToday()); });

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === '1') { tool = 'timber'; chips(); draw(); }
    else if (k === '2') { tool = 'steel'; chips(); draw(); }
    else if (k === '3') { tool = 'cable'; chips(); draw(); }
    else if (k === 'e') { tool = 'erase'; chips(); draw(); }
    else if (k === 'z') { if (!sim && design.length) { design.pop(); readout(); } }
    else if (k === 'escape') { drag = null; draw(); }
    else if (k === ' ') { e.preventDefault(); startTest(); }
    else if (k === 'n') { newSite((Math.random() * 4294967295) >>> 0); }
    else if (k === 't') { newSite(seedForToday()); }
  });

  window.addEventListener('resize', function () {
    if (!site) return;
    resize();
    draw();
  });

  /* ---------- go ---------- */
  chips();
  newSite(seedForToday());
})();
