/* The Menagerie — a one-day ecosystem that evolves while you watch.
   Everything here is generated in the browser from today's date. No assets,
   no libraries, nothing stored. */
(function () {
  'use strict';

  var cv = document.getElementById('menagerie');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height;

  var chartCv = document.getElementById('chart');
  var cctx = chartCv ? chartCv.getContext('2d') : null;

  /* ---------- deterministic randomness ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function todaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  var rnd = mulberry32(todaySeed());
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- climates ---------- */
  var CLIMATES = [
    { id: 'temperate', name: 'Temperate', plants: 3.0, cap: 430, cost: 1.0,
      note: 'Enough to go round, not enough to be careless.' },
    { id: 'lush', name: 'Lush', plants: 6.0, cap: 820, cost: 0.85,
      note: 'Food everywhere. Bodies get big and slow, then something learns to eat them.' },
    { id: 'harsh', name: 'Harsh', plants: 1.5, cap: 240, cost: 1.2,
      note: 'Thin grazing and an expensive body. Small and quick tends to win.' },
    { id: 'bloom', name: 'Boom and bust', plants: 3.0, cap: 620, cost: 1.0,
      swing: true, note: 'The pasture swells and collapses on a long cycle. Nothing settles.' }
  ];

  var params = {
    climate: CLIMATES[0],
    speed: 1,
    mutation: 1,
    paused: false
  };

  /* ---------- world state ---------- */
  var plants = [];
  var creatures = [];
  var plantAcc = 0;
  var tick = 0;
  var nextId = 1;
  var seedInUse = todaySeed();
  var history = [];
  var species = {};          // key -> {name, first, peak, seen}
  var notes = [];
  var selected = null;
  var births = 0, deaths = 0, maxGen = 1;

  var GRID = 64;
  var GW = Math.ceil(W / GRID), GH = Math.ceil(H / GRID);

  /* ---------- naming ---------- */
  var STEM_A = ['Vel', 'Cor', 'Ther', 'Mel', 'Ost', 'Bran', 'Cyn', 'Hal', 'Ryn',
    'Amb', 'Quil', 'Solv', 'Nith', 'Perr', 'Umbr', 'Kess', 'Dray', 'Fenn',
    'Olm', 'Tass', 'Wend', 'Ixor'];
  var STEM_B = ['ara', 'ona', 'ika', 'emis', 'ura', 'ythe', 'anda', 'oros',
    'ilia', 'esca', 'ynth', 'ovia', 'ella', 'idon'];

  function speciesKey(g) {
    var d = g.diet < 0.38 ? 0 : g.diet > 0.62 ? 2 : 1;
    var s = Math.min(4, Math.floor((g.size - 2.4) / 1.5));
    var v = Math.min(3, Math.floor(g.speed / 0.6));
    return d + ':' + s + ':' + v;
  }
  function epithet(g) {
    if (g.diet > 0.62) return g.speed > 1.4 ? 'raptrix' : 'vorax';
    if (g.diet < 0.38) return g.size > 6.4 ? 'placida' : (g.sense > 95 ? 'oculata' : 'pascua');
    return g.speed > 1.4 ? 'cursor' : 'media';
  }
  function nameFor(key, g) {
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    var r = mulberry32(h ^ seedInUse);
    var a = STEM_A[Math.floor(r() * STEM_A.length)];
    var b = STEM_B[Math.floor(r() * STEM_B.length)];
    return a + b + ' ' + epithet(g);
  }
  function registerSpecies(c) {
    var key = c.key;
    if (!species[key]) {
      species[key] = { name: nameFor(key, c.g), first: tick, gen: c.gen, count: 0, peak: 0 };
      if (tick > 0) {
        notes.unshift({ t: tick, text: species[key].name + ' appears, generation ' + c.gen + '.' });
        if (notes.length > 40) notes.pop();
      }
    }
    c.species = species[key];
  }

  /* ---------- genome ---------- */
  function newGenome(seedRandom) {
    return {
      size: 2.8 + seedRandom() * 3.0,
      speed: 0.55 + seedRandom() * 0.9,
      sense: 40 + seedRandom() * 60,
      diet: seedRandom() < 0.82 ? seedRandom() * 0.3 : 0.62 + seedRandom() * 0.3
    };
  }
  function mutate(g) {
    var m = params.mutation;
    return {
      size: clamp(g.size + gauss() * 0.28 * m, 2.2, 9.5),
      speed: clamp(g.speed + gauss() * 0.09 * m, 0.18, 2.4),
      sense: clamp(g.sense + gauss() * 7 * m, 18, 150),
      diet: clamp(g.diet + gauss() * 0.045 * m, 0, 1)
    };
  }
  function colourOf(g) {
    var hue = 150 - g.diet * 165;           // green herbivores -> red hunters
    if (hue < 0) hue += 360;
    var sat = 45 + g.speed * 22;
    var lig = 42 + (9.5 - g.size) * 2.6;
    return 'hsl(' + hue.toFixed(0) + ',' + clamp(sat, 30, 92).toFixed(0) + '%,' +
      clamp(lig, 34, 72).toFixed(0) + '%)';
  }

  function makeCreature(x, y, g, gen) {
    var c = {
      id: nextId++, x: x, y: y, dir: rnd() * Math.PI * 2,
      g: g, energy: 26 + g.size * 3, age: 0, gen: gen || 1,
      key: speciesKey(g), colour: colourOf(g), flash: 0
    };
    registerSpecies(c);
    return c;
  }

  function addPlant(x, y) {
    if (plants.length >= params.climate.cap) return;
    if (x === undefined) {
      if (plants.length > 12 && rnd() < 0.65) {
        var p = plants[Math.floor(rnd() * plants.length)];
        x = p.x + gauss() * 34; y = p.y + gauss() * 34;
      } else { x = rnd() * W; y = rnd() * H; }
    }
    plants.push({ x: (x + W) % W, y: (y + H) % H, e: 10 + rnd() * 5, a: 0 });
  }

  /* ---------- reset ---------- */
  function reset(seed) {
    seedInUse = seed;
    rnd = mulberry32(seed);
    plants = []; creatures = []; history = []; species = {}; notes = [];
    tick = 0; plantAcc = 0; births = 0; deaths = 0; maxGen = 1; selected = null;
    var founders = mulberry32(seed ^ 0x9e3779b9);
    var base = newGenome(founders);
    for (var i = 0; i < 140; i++) addPlant();
    for (var j = 0; j < 26; j++) {
      var g = {
        size: clamp(base.size + gauss() * 0.5, 2.4, 8),
        speed: clamp(base.speed + gauss() * 0.15, 0.25, 2),
        sense: clamp(base.sense + gauss() * 10, 20, 140),
        diet: clamp(base.diet + gauss() * 0.05, 0, 0.35)
      };
      creatures.push(makeCreature(rnd() * W, rnd() * H, g, 1));
    }
    // one opportunist, so the food chain has somewhere to go
    var hunter = { size: base.size * 1.25, speed: base.speed * 1.15, sense: base.sense * 1.1, diet: 0.72 };
    hunter.size = clamp(hunter.size, 3, 8);
    hunter.speed = clamp(hunter.speed, 0.4, 2);
    hunter.sense = clamp(hunter.sense, 30, 145);
    for (var k = 0; k < 3; k++) creatures.push(makeCreature(rnd() * W, rnd() * H, hunter, 1));
    syncSeedLabel();
  }

  /* ---------- spatial grid ---------- */
  var pGrid = [], cGrid = [];
  function cellIndex(x, y) {
    var gx = Math.floor(x / GRID), gy = Math.floor(y / GRID);
    if (gx < 0) gx = 0; if (gx >= GW) gx = GW - 1;
    if (gy < 0) gy = 0; if (gy >= GH) gy = GH - 1;
    return gy * GW + gx;
  }
  function buildGrids() {
    var n = GW * GH, i;
    pGrid = new Array(n); cGrid = new Array(n);
    for (i = 0; i < n; i++) { pGrid[i] = null; cGrid[i] = null; }
    for (i = 0; i < plants.length; i++) {
      var ci = cellIndex(plants[i].x, plants[i].y);
      (pGrid[ci] || (pGrid[ci] = [])).push(i);
    }
    for (i = 0; i < creatures.length; i++) {
      var cj = cellIndex(creatures[i].x, creatures[i].y);
      (cGrid[cj] || (cGrid[cj] = [])).push(i);
    }
  }
  function around(grid, x, y, r, fn) {
    var span = Math.max(1, Math.ceil(r / GRID));
    var gx = Math.floor(x / GRID), gy = Math.floor(y / GRID);
    for (var dy = -span; dy <= span; dy++) {
      var yy = gy + dy; if (yy < 0 || yy >= GH) continue;
      for (var dx = -span; dx <= span; dx++) {
        var xx = gx + dx; if (xx < 0 || xx >= GW) continue;
        var bucket = grid[yy * GW + xx];
        if (!bucket) continue;
        for (var i = 0; i < bucket.length; i++) if (fn(bucket[i]) === false) return;
      }
    }
  }

  /* ---------- simulation ---------- */
  function plantRate() {
    var base = params.climate.plants;
    if (params.climate.swing) base *= 0.55 + 1.5 * (0.5 + 0.5 * Math.sin(tick / 900));
    return base;
  }

  function step() {
    tick++;
    var cl = params.climate;

    plantAcc += plantRate();
    while (plantAcc >= 1) { plantAcc--; addPlant(); }

    buildGrids();

    var eatenPlants = {};
    var i, c;
    for (i = 0; i < creatures.length; i++) {
      c = creatures[i];
      if (c.dead) continue;
      var g = c.g;
      var tx = null, ty = null, flee = false;
      var best = Infinity;

      // predators first — being eaten outranks being hungry
      around(cGrid, c.x, c.y, g.sense, function (j) {
        var o = creatures[j];
        if (o === c || o.dead) return;
        if (o.g.diet > 0.55 && o.g.size > g.size * 1.03) {
          var dx = o.x - c.x, dy = o.y - c.y, d = dx * dx + dy * dy;
          if (d < g.sense * g.sense * 0.7 && d < best) { best = d; tx = c.x - dx; ty = c.y - dy; flee = true; }
        }
      });

      if (!flee) {
        best = Infinity;
        if (g.diet < 0.62) {
          around(pGrid, c.x, c.y, g.sense, function (j) {
            if (eatenPlants[j]) return;
            var p = plants[j];
            var dx = p.x - c.x, dy = p.y - c.y, d = dx * dx + dy * dy;
            if (d < g.sense * g.sense && d < best) { best = d; tx = p.x; ty = p.y; }
          });
        }
        if (g.diet > 0.38 && tx === null) {
          around(cGrid, c.x, c.y, g.sense, function (j) {
            var o = creatures[j];
            if (o === c || o.dead) return;
            if (o.g.size * 1.03 > g.size) return;
            var dx = o.x - c.x, dy = o.y - c.y, d = dx * dx + dy * dy;
            if (d < g.sense * g.sense && d < best) { best = d; tx = o.x; ty = o.y; }
          });
        }
      }

      // steer
      var want;
      if (tx !== null) {
        want = Math.atan2(ty - c.y, tx - c.x);
      } else {
        want = c.dir + gauss() * 0.35;
      }
      var diff = want - c.dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var turn = clamp(diff, -0.22, 0.22);
      c.dir += turn;

      var sp = g.speed * (flee ? 1.25 : (tx === null ? 0.62 : 1)) * 2.1;
      c.x = (c.x + Math.cos(c.dir) * sp + W) % W;
      c.y = (c.y + Math.sin(c.dir) * sp + H) % H;

      // metabolism
      var cost = (0.05 + 0.02 * Math.pow(g.size, 1.6) +
        0.10 * g.speed * g.speed * (0.6 + g.size / 8) +
        g.sense * 0.0005) * cl.cost * (1 - 0.18 * g.diet);
      c.energy -= cost;
      c.age++;
      if (c.flash > 0) c.flash--;

      // eat plants
      if (g.diet < 0.62) {
        var reach = 5 + g.size * 0.35;
        around(pGrid, c.x, c.y, reach, function (j) {
          if (eatenPlants[j]) return;
          var p = plants[j];
          var dx = p.x - c.x, dy = p.y - c.y;
          if (dx * dx + dy * dy < reach * reach) {
            eatenPlants[j] = 1;
            c.energy += p.e * (g.diet > 0.38 ? 0.7 : 1);
            c.flash = 6;
            return false;
          }
        });
      }
      // eat creatures
      if (g.diet > 0.38) {
        around(cGrid, c.x, c.y, g.size + 8, function (j) {
          var o = creatures[j];
          if (o === c || o.dead) return;
          if (o.g.size * 1.03 > g.size) return;
          var dx = o.x - c.x, dy = o.y - c.y;
          var reach2 = (g.size + o.g.size) * (g.size + o.g.size);
          if (dx * dx + dy * dy < reach2) {
            o.dead = true; deaths++;
            c.energy += (22 + o.energy * 0.8) * (g.diet < 0.62 ? 0.7 : 1);
            c.flash = 10;
            return false;
          }
        });
      }

      // death
      if (c.energy <= 0 || c.age > 2400) { c.dead = true; deaths++; continue; }

      // reproduction
      var thresh = 38 + g.size * 6;
      if (c.energy > thresh && c.age > 90 && creatures.length < 420) {
        c.energy *= 0.45;
        var kidG = mutate(g);
        var kid = makeCreature(
          (c.x + gauss() * 6 + W) % W, (c.y + gauss() * 6 + H) % H, kidG, c.gen + 1);
        kid.energy = c.energy * 0.85;
        creatures.push(kid);
        births++;
        if (kid.gen > maxGen) maxGen = kid.gen;
      }
    }

    // sweep
    var keptPlants = [];
    for (i = 0; i < plants.length; i++) {
      if (!eatenPlants[i]) { plants[i].a++; keptPlants.push(plants[i]); }
    }
    plants = keptPlants;
    var kept = [];
    for (i = 0; i < creatures.length; i++) if (!creatures[i].dead) kept.push(creatures[i]);
    if (selected && selected.dead) selected = null;
    creatures = kept;

    if (tick % 20 === 0) sample();
  }

  function sample() {
    var h = 0, ca = 0, om = 0, k;
    for (k in species) species[k].count = 0;
    for (var i = 0; i < creatures.length; i++) {
      var c = creatures[i];
      if (c.g.diet < 0.38) h++; else if (c.g.diet > 0.62) ca++; else om++;
      if (c.species) { c.species.count++; if (c.species.count > c.species.peak) c.species.peak = c.species.count; }
    }
    history.push({ h: h, c: ca, o: om, p: plants.length });
    if (history.length > 220) history.shift();
  }

  /* ---------- drawing ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, 'rgba(100,240,200,.045)');
    grd.addColorStop(1, 'rgba(122,162,255,.035)');
    ctx.fillStyle = '#07090d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    var i;
    ctx.fillStyle = 'rgba(120,220,150,.75)';
    for (i = 0; i < plants.length; i++) {
      var p = plants[i];
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }

    for (i = 0; i < creatures.length; i++) {
      var c = creatures[i], g = c.g;
      var r = g.size;
      if (c === selected) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, g.sense, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100,240,200,.16)';
        ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#64f0c8'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.dir);
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(-r, r * 0.78);
      ctx.lineTo(-r * 0.45, 0);
      ctx.lineTo(-r, -r * 0.78);
      ctx.closePath();
      ctx.fillStyle = c.flash > 0 ? '#ffffff' : c.colour;
      ctx.fill();
      if (g.diet > 0.62) {
        ctx.strokeStyle = 'rgba(255,180,180,.55)';
        ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawChart() {
    if (!cctx) return;
    var w = chartCv.width, h = chartCv.height;
    cctx.clearRect(0, 0, w, h);
    cctx.fillStyle = 'rgba(11,15,22,.6)';
    cctx.fillRect(0, 0, w, h);
    if (history.length < 2) return;
    var maxC = 8, maxP = 20, i;
    for (i = 0; i < history.length; i++) {
      var t = history[i].h + history[i].c + history[i].o;
      if (t > maxC) maxC = t;
      if (history[i].p > maxP) maxP = history[i].p;
    }
    function line(getter, max, colour, fill) {
      cctx.beginPath();
      for (i = 0; i < history.length; i++) {
        var x = i / (history.length - 1) * w;
        var y = h - (getter(history[i]) / max) * (h - 6) - 3;
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      if (fill) {
        cctx.lineTo(w, h); cctx.lineTo(0, h); cctx.closePath();
        cctx.fillStyle = fill; cctx.fill();
      } else {
        cctx.strokeStyle = colour; cctx.lineWidth = 1.6; cctx.stroke();
      }
    }
    line(function (d) { return d.p; }, maxP, null, 'rgba(120,220,150,.14)');
    line(function (d) { return d.h; }, maxC, '#64f0c8');
    line(function (d) { return d.o; }, maxC, '#e0d27a');
    line(function (d) { return d.c; }, maxC, '#ff7a7a');
  }

  /* ---------- readouts ---------- */
  function el(id) { return document.getElementById(id); }
  function setText(id, v) { var n = el(id); if (n) n.textContent = v; }

  function syncSeedLabel() { setText('seedOut', String(seedInUse)); }

  function updatePanels() {
    var h = 0, ca = 0, om = 0, ms = 0, mv = 0, mn = 0, i;
    for (i = 0; i < creatures.length; i++) {
      var g = creatures[i].g;
      if (g.diet < 0.38) h++; else if (g.diet > 0.62) ca++; else om++;
      ms += g.size; mv += g.speed; mn += g.sense;
    }
    var n = creatures.length || 1;
    setText('statPop', creatures.length);
    setText('statHerb', h);
    setText('statOmni', om);
    setText('statCarn', ca);
    setText('statPlants', plants.length);
    setText('statGen', maxGen);
    setText('statSize', (ms / n).toFixed(1));
    setText('statSpeed', (mv / n).toFixed(2));
    setText('statSense', (mn / n).toFixed(0));
    setText('statTick', tick);

    var extinct = el('extinct');
    if (extinct) extinct.hidden = creatures.length > 0;

    // species table
    var rows = [];
    for (var k in species) {
      if (species[k].count > 0) rows.push(species[k]);
    }
    rows.sort(function (a, b) { return b.count - a.count; });
    var tb = el('speciesBody');
    if (tb) {
      var html = '';
      for (i = 0; i < Math.min(rows.length, 7); i++) {
        html += '<tr><td>' + rows[i].name + '</td><td>' + rows[i].count +
          '</td><td>' + rows[i].peak + '</td></tr>';
      }
      if (!html) html = '<tr><td colspan="3">Nothing alive.</td></tr>';
      tb.innerHTML = html;
    }

    var nl = el('noteList');
    if (nl) {
      var out = '';
      for (i = 0; i < Math.min(notes.length, 8); i++) {
        out += '<li><time>t' + notes[i].t + '</time> ' + notes[i].text + '</li>';
      }
      if (!out) out = '<li><time>t0</time> The founders are turned loose.</li>';
      nl.innerHTML = out;
    }

    var card = el('card');
    if (card) {
      if (!selected) {
        card.innerHTML = '<p class="sub" style="margin:0">Click any animal to read its card.</p>';
      } else {
        var s = selected, sg = s.g;
        function bar(label, v, max, unit) {
          var pct = clamp(v / max * 100, 2, 100).toFixed(0);
          return '<div class="trait"><span>' + label + '</span>' +
            '<i><b style="width:' + pct + '%"></b></i>' +
            '<em>' + v.toFixed(unit === 0 ? 0 : 2) + '</em></div>';
        }
        var diet = sg.diet < 0.38 ? 'grazer' : sg.diet > 0.62 ? 'hunter' : 'omnivore';
        card.innerHTML =
          '<div class="card-head"><span class="blob" style="background:' + s.colour + '"></span>' +
          '<div><h3>' + (s.species ? s.species.name : '—') + '</h3>' +
          '<p>' + diet + ' &middot; generation ' + s.gen + ' &middot; age ' + s.age + '</p></div></div>' +
          bar('Size', sg.size, 9.5, 2) +
          bar('Speed', sg.speed, 2.4, 2) +
          bar('Sense', sg.sense, 150, 0) +
          bar('Meat in diet', sg.diet, 1, 2) +
          bar('Energy', s.energy, 120, 0);
      }
    }
  }

  /* ---------- loop ---------- */
  var acc = 0;
  function frame() {
    if (!params.paused) {
      acc += params.speed;
      var guard = 0;
      while (acc >= 1 && guard < 6) { step(); acc--; guard++; }
      if (acc > 6) acc = 0;
    }
    draw();
    if (tick % 6 === 0 || params.paused) { drawChart(); updatePanels(); }
    requestAnimationFrame(frame);
  }

  /* ---------- interaction ---------- */
  function canvasPoint(ev) {
    var r = cv.getBoundingClientRect();
    var t = ev.touches ? ev.touches[0] : ev;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }
  cv.addEventListener('pointerdown', function (ev) {
    var p = canvasPoint(ev);
    var best = null, bd = 900;
    for (var i = 0; i < creatures.length; i++) {
      var c = creatures[i];
      var dx = c.x - p.x, dy = c.y - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { selected = best; }
    else { for (var j = 0; j < 14; j++) addPlant(p.x + gauss() * 18, p.y + gauss() * 18); }
    updatePanels();
  });

  var chips = document.getElementById('climates');
  if (chips) {
    CLIMATES.forEach(function (cl) {
      var b = document.createElement('button');
      b.className = 'chip' + (cl === params.climate ? ' on' : '');
      b.textContent = cl.name;
      b.addEventListener('click', function () {
        params.climate = cl;
        setText('climateNote', cl.note);
        Array.prototype.forEach.call(chips.children, function (n) { n.classList.remove('on'); });
        b.classList.add('on');
      });
      chips.appendChild(b);
    });
    setText('climateNote', params.climate.note);
  }

  function bindRange(id, valId, fn, fmt) {
    var r = el(id); if (!r) return;
    function apply() { fn(parseFloat(r.value)); setText(valId, fmt(parseFloat(r.value))); }
    r.addEventListener('input', apply);
    apply();
  }
  bindRange('spd', 'spdVal', function (v) { params.speed = v; }, function (v) { return v.toFixed(2) + '×'; });
  bindRange('mut', 'mutVal', function (v) { params.mutation = v; }, function (v) { return v.toFixed(2) + '×'; });

  var bp = el('btnPause');
  if (bp) bp.addEventListener('click', function () {
    params.paused = !params.paused;
    bp.textContent = params.paused ? 'Resume' : 'Pause';
  });
  var bt = el('btnToday');
  if (bt) bt.addEventListener('click', function () { reset(todaySeed()); });
  var br = el('btnReseed');
  if (br) br.addEventListener('click', function () {
    reset(Math.floor(Math.random() * 90000000) + 1000);
  });
  var bf = el('btnFeed');
  if (bf) bf.addEventListener('click', function () {
    for (var i = 0; i < 160; i++) addPlant();
  });
  var bc = el('btnCull');
  if (bc) bc.addEventListener('click', function () {
    for (var i = creatures.length - 1; i >= 0; i--) if (Math.random() < 0.5) { creatures[i].dead = true; deaths++; }
    creatures = creatures.filter(function (c) { return !c.dead; });
    if (selected && selected.dead) selected = null;
    notes.unshift({ t: tick, text: 'A hard season: half the population is gone.' });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.code === 'Space' && !/input|textarea/i.test(ev.target.tagName)) {
      ev.preventDefault();
      params.paused = !params.paused;
      if (bp) bp.textContent = params.paused ? 'Resume' : 'Pause';
    }
  });

  reset(todaySeed());
  frame();
})();
