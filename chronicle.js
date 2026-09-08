/* experiment.quibo.games — The Chronicle
   Eight hundred years of invented history, dealt by today's date.
   Self-contained. No dependencies. */
(function () {
  'use strict';

  /* ================= seeded PRNG ================= */
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

  function makeNoise(rand) {
    var N = 256;
    var grid = new Float32Array(N * N);
    for (var i = 0; i < grid.length; i++) grid[i] = rand();
    function at(x, y) { return grid[((y & (N - 1)) * N) + (x & (N - 1))]; }
    function smooth(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = smooth(x - xi), yf = smooth(y - yi);
      var a = at(xi, yi), b = at(xi + 1, yi);
      var c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      var top = a + (b - a) * xf, bot = c + (d - c) * xf;
      return top + (bot - top) * yf;
    };
  }

  /* ================= constants ================= */
  var W = 80, H = 48, N = W * H, YEARS = 800;
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
    'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV'];
  function roman(n) { return ROMAN[n] || ('#' + n); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var INVENTIONS = [
    'the heavy plough', 'kiln-fired brick', 'the mortared arch', 'bronze casting',
    'the horse collar', 'rag paper', 'the water mill', 'the compass needle',
    'the lateen sail', 'terraced irrigation', 'the crossbow', 'window glass',
    'the mechanical clock', 'double-entry ledgers', 'canal locks', 'the astrolabe',
    'the blast furnace', 'the printing frame', 'quarantine', 'the deep keel',
    'the seed drill', 'the spinning wheel', 'chain mail', 'lime mortar',
    'the pendulum', 'the vaulted dome', 'the drainage screw', 'inoculation',
    'the ledger post', 'the star table'
  ];

  var WONDER_FORMS = [
    'the Grey Column at %C', 'the Hanging Library of %C', 'the Long Bridge at %C',
    'the Drowned Cathedral of %C', 'the Nine Gates of %C', 'the Salt Palace at %C',
    'the Observatory of %C', 'the Thousand Steps at %C', 'the Bell Tower of %C',
    'the Cold Aqueduct at %C'
  ];

  var EPITHETS = [
    'the Great', 'the Bold', 'the Wise', 'the Lawgiver', 'the Builder',
    'the Unready', 'the Quiet', 'the Younger', 'the Navigator', 'the Iron',
    'the Grey', 'the Twice-Crowned', 'the Pious', 'the Cruel', 'the Fortunate',
    'the Last', 'the Patient', 'the Doubtful'
  ];

  /* ================= lexicon ================= */
  function makeLexicon(rand) {
    var ONS = ['b', 'br', 'd', 'dr', 'f', 'g', 'gr', 'h', 'k', 'kr', 'l', 'm', 'n',
      'p', 'pr', 'r', 's', 'sh', 'sk', 'st', 't', 'th', 'tr', 'v', 'z', 'kh',
      'ch', 'y', 'w', 'vr', 'gl', 'fl', 'ph', 'q'];
    var VOW = ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ia', 'io', 'ou', 'au', 'ai', 'y', 'oa'];
    var COD = ['n', 'r', 's', 'l', 'th', 'm', 'k', 'sh', 'st', 'nd', 'rn', 'rk',
      'll', 'ss', 't', 'd', 'g', 'ng'];
    function pick(a) { return a[Math.floor(rand() * a.length)]; }
    function subset(pool, n) {
      var c = pool.slice(), out = [];
      while (out.length < n && c.length) out.push(c.splice(Math.floor(rand() * c.length), 1)[0]);
      return out;
    }
    var on = subset(ONS, 9 + Math.floor(rand() * 6));
    var vo = subset(VOW, 5 + Math.floor(rand() * 4));
    var co = subset(COD, 5 + Math.floor(rand() * 5));
    var codaRate = 0.28 + rand() * 0.34;
    var used = {}, spare = 0;

    function syl() { return pick(on) + pick(vo) + (rand() < codaRate ? pick(co) : ''); }
    function word(minS, maxS) {
      var n = minS + Math.floor(rand() * (maxS - minS + 1)), s = '';
      for (var i = 0; i < n; i++) s += syl();
      return s;
    }
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function uniq(min, max) {
      for (var k = 0; k < 60; k++) {
        var w = word(min, max);
        if (!used[w] && w.length >= 4 && w.length <= 11) { used[w] = 1; return w; }
      }
      spare++;
      return word(min, max) + (spare > 1 ? String(spare) : '');
    }
    return {
      place: function () { return cap(uniq(2, 3)); },
      city: function () { return cap(uniq(2, 3)); },
      person: function () { return cap(word(2, 2)); },
      house: function () { return cap(uniq(2, 2)); },
      faith: function () { return cap(uniq(2, 3)); },
      era: function () { return cap(uniq(2, 3)); }
    };
  }

  /* ================= world ================= */
  function makeWorld(rand) {
    var n1 = makeNoise(rand), n2 = makeNoise(rand);
    var elev = new Float32Array(N), fert = new Float32Array(N);
    var land = new Uint8Array(N);
    var ox = rand() * 60, oy = rand() * 60;
    var warm = 0.35 + rand() * 0.4;   // where the fertile band sits

    var i, x, y;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        var fx = x / W, fy = y / H;
        var e = 0, amp = 1, freq = 1, sum = 0;
        for (var o = 0; o < 5; o++) {
          e += n1(ox + fx * freq * 7.5, oy + fy * freq * 5.2) * amp;
          sum += amp; amp *= 0.52; freq *= 2.05;
        }
        e /= sum;
        var dx = (fx - 0.5) * 2, dy = (fy - 0.5) * 2;
        var d = Math.sqrt(dx * dx * 0.8 + dy * dy * 1.35);
        e -= Math.max(0, d - 0.52) * 1.15;
        elev[i] = e;
      }
    }

    var sorted = Array.prototype.slice.call(elev).sort(function (a, b) { return a - b; });
    var seaFrac = 0.50 + rand() * 0.12;
    var sea = sorted[Math.floor(seaFrac * N)];
    var landCells = [];
    for (i = 0; i < N; i++) {
      if (elev[i] > sea) { land[i] = 1; landCells.push(i); }
    }

    // fertility: climate band + noise, penalised on high ground, helped on coasts
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (!land[i]) continue;
        var lat = y / H;
        var climate = 1 - Math.min(1, Math.abs(lat - warm) * 2.4);
        var rough = n2(x * 0.19 + 11, y * 0.19 + 7);
        var high = clamp((elev[i] - sea) / 0.42, 0, 1);
        var coast = 0;
        if (x > 0 && !land[i - 1]) coast = 1;
        if (x < W - 1 && !land[i + 1]) coast = 1;
        if (y > 0 && !land[i - W]) coast = 1;
        if (y < H - 1 && !land[i + W]) coast = 1;
        var f = 0.5 * climate + 0.42 * rough + 0.12 * coast - 0.42 * high * high;
        fert[i] = clamp(f, 0.04, 1);
      }
    }
    return { elev: elev, fert: fert, land: land, sea: sea, landCells: landCells, warm: warm };
  }

  function neighbours(i) {
    var x = i % W, y = (i / W) | 0, out = [];
    if (x > 0) out.push(i - 1);
    if (x < W - 1) out.push(i + 1);
    if (y > 0) out.push(i - W);
    if (y < H - 1) out.push(i + W);
    return out;
  }

  /* ================= the simulation ================= */
  function simulate(rand, world) {
    var lex = makeLexicon(rand);
    var owner = new Int16Array(N);
    for (var z = 0; z < N; z++) owner[z] = -1;

    var diffs = new Array(YEARS + 1);
    for (z = 0; z <= YEARS; z++) diffs[z] = [];
    var stats = new Array(YEARS + 1);
    var polities = [], events = [], faiths = [], wars = [];
    var hue0 = rand() * 360, hueStep = 41 + rand() * 18;
    var calendar = lex.era();

    function pick(a) { return a[Math.floor(rand() * a.length)]; }

    function ev(year, kind, text, pid) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
      var e = { y: year, k: kind, t: text, p: (pid === undefined ? -1 : pid) };
      events.push(e);
      if (e.p >= 0) polities[e.p].log.push(e);
      return e;
    }

    function setOwner(i, pid, year) {
      var old = owner[i];
      if (old === pid) return;
      if (old >= 0) {
        var oa = polities[old].cells;
        var k = oa.indexOf(i);
        if (k >= 0) oa.splice(k, 1);
      }
      owner[i] = pid;
      if (pid >= 0) polities[pid].cells.push(i);
      diffs[year].push(i, pid);
    }

    function shadesFor(hue) {
      var out = [];
      for (var s = 0; s < 4; s++) {
        out.push('hsl(' + hue.toFixed(0) + ',' + (44 + s * 4) + '%,' + (30 + s * 7) + '%)');
      }
      return out;
    }

    function titleFor(p) {
      var t;
      if (p.piety > 0.72) t = pick(['the Holy State of %', 'the Crown of %', 'the Sanctum of %']);
      else if (p.aggr > 0.68) t = pick(['the % Empire', 'the % Hegemony', 'the Marches of %', 'the Kingdom of %']);
      else if (p.trade > 0.66) t = pick(['the Free Cities of %', 'the Republic of %', 'the % Compact']);
      else t = pick(['the Kingdom of %', 'the Principality of %', 'the % Confederacy', 'the Dominion of %', 'the Crown of %']);
      return t.replace('%', p.name);
    }

    function crown(p, year) {
      if (p.reigns.length) p.reigns[p.reigns.length - 1].to = year;
      var nm = lex.person();
      var count = 1;
      for (var i = 0; i < p.reigns.length; i++) if (p.reigns[i].name === nm) count++;
      p.reigns.push({
        name: nm, num: count, house: p.house, from: year, to: -1,
        epithet: '', deeds: 0
      });
      p.reign = 0;
      p.lifespan = 14 + Math.floor(rand() * 34);
    }

    function rulerOf(p) { return p.reigns[p.reigns.length - 1]; }
    function rulerName(r) { return r.name + ' ' + roman(r.num) + (r.epithet ? ' ' + r.epithet : ''); }

    function newPolity(cell, year, parent) {
      var p = {
        id: polities.length,
        name: lex.place(),
        hue: (hue0 + polities.length * hueStep) % 360,
        founded: year, ended: -1,
        capital: cell,
        capitals: [],
        cells: [],
        pop: 3200 + rand() * 2600,
        tech: parent ? Math.max(0, parent.tech - 1) : 0,
        learning: 0,
        stability: 0.58 + rand() * 0.26,
        aggr: 0.18 + rand() * 0.72,
        trade: 0.18 + rand() * 0.72,
        piety: 0.14 + rand() * 0.78,
        scholar: 0.18 + rand() * 0.72,
        faith: parent ? parent.faith : -1,
        house: lex.house(),
        reigns: [], reign: 0, lifespan: 30,
        parent: parent ? parent.id : -1,
        wonders: [], log: [],
        peakCells: 0, peakPop: 0, invented: []
      };
      p.shades = shadesFor(p.hue);
      p.capitals.push({ from: year, cell: cell, name: lex.city() });
      polities.push(p);
      crown(p, year);
      p.title = titleFor(p);
      setOwner(cell, p.id, year);
      neighbours(cell).forEach(function (nb) {
        if (world.land[nb] && owner[nb] < 0) setOwner(nb, p.id, year);
      });
      return p;
    }

    function capitalOf(p, year) {
      var c = p.capitals[0];
      for (var i = 0; i < p.capitals.length; i++) if (p.capitals[i].from <= year) c = p.capitals[i];
      return c;
    }

    /* ---- found the first states ---- */
    var seeds = [];
    var pool = world.landCells.slice().sort(function (a, b) { return world.fert[b] - world.fert[a]; });
    pool = pool.slice(0, Math.max(24, Math.floor(pool.length * 0.35)));
    var wanted = 5 + Math.floor(rand() * 4);
    var guard = 0;
    while (seeds.length < wanted && guard++ < 900) {
      var c = pool[Math.floor(rand() * pool.length)];
      var cx = c % W, cy = (c / W) | 0, ok = true;
      for (var s = 0; s < seeds.length; s++) {
        var sx = seeds[s] % W, sy = (seeds[s] / W) | 0;
        if (Math.abs(sx - cx) + Math.abs(sy - cy) < 13) { ok = false; break; }
      }
      if (ok) seeds.push(c);
    }
    seeds.forEach(function (c) { newPolity(c, 0, null); });

    events.push({ y: 0, k: 'era', t: 'The reckoning of ' + calendar + ' begins. ' + seeds.length + ' peoples keep records from this year.', p: -1 });
    polities.forEach(function (p) {
      ev(0, 'found', p.title + (/Cities|Marches/.test(p.title) ? ' are' : ' is') +
        ' founded from the town of ' + capitalOf(p, 0).name + ', under ' + rulerName(rulerOf(p)) +
        ' of the house of ' + p.house + '.', p.id);
    });

    /* ---- helpers used per year ---- */
    var deck = INVENTIONS.slice();
    for (var d = deck.length - 1; d > 0; d--) {
      var j = Math.floor(rand() * (d + 1));
      var tmp = deck[d]; deck[d] = deck[j]; deck[j] = tmp;
    }
    var deckAt = 0;

    function alive(p) { return p.ended < 0 && p.cells.length > 0; }

    function capacityOf(p) {
      var cap = 0, per = 940 + p.tech * 420;
      for (var i = 0; i < p.cells.length; i++) cap += world.fert[p.cells[i]] * per;
      return Math.max(2000, cap);
    }

    function frontier(p, reach) {
      var out = [], seen = {};
      for (var i = 0; i < p.cells.length; i++) {
        var nbs = neighbours(p.cells[i]);
        for (var k = 0; k < nbs.length; k++) {
          var nb = nbs[k];
          if (world.land[nb] && owner[nb] < 0 && !seen[nb]) { seen[nb] = 1; out.push(nb); }
          if (reach && !world.land[nb]) {
            var far = neighbours(nb);
            for (var m = 0; m < far.length; m++) {
              var f2 = far[m];
              if (world.land[f2] && owner[f2] < 0 && !seen[f2]) { seen[f2] = 1; out.push(f2); }
            }
          }
        }
      }
      return out;
    }

    function borderWith(p, q) {
      var out = [];
      for (var i = 0; i < q.cells.length; i++) {
        var nbs = neighbours(q.cells[i]);
        for (var k = 0; k < nbs.length; k++) if (owner[nbs[k]] === p.id) { out.push(q.cells[i]); break; }
      }
      return out;
    }

    function neighbourIds(p) {
      var seen = {}, out = [];
      for (var i = 0; i < p.cells.length; i++) {
        var nbs = neighbours(p.cells[i]);
        for (var k = 0; k < nbs.length; k++) {
          var o = owner[nbs[k]];
          if (o >= 0 && o !== p.id && !seen[o]) { seen[o] = 1; out.push(o); }
        }
      }
      return out;
    }

    function atWar(p) {
      for (var i = 0; i < wars.length; i++) if (wars[i].a === p.id || wars[i].b === p.id) return wars[i];
      return null;
    }

    function kill(p, year, how) {
      p.ended = year;
      for (var i = p.cells.length - 1; i >= 0; i--) setOwner(p.cells[i], -1, year);
      ev(year, 'end', how, p.id);
    }

    function moveCapital(p, year) {
      if (!p.cells.length) return;
      var best = p.cells[0];
      for (var i = 0; i < p.cells.length; i++) if (world.fert[p.cells[i]] > world.fert[best]) best = p.cells[i];
      var nm = lex.city();
      p.capitals.push({ from: year, cell: best, name: nm });
      p.capital = best;
      ev(year, 'court', 'The court of ' + p.name + ' removes to ' + nm + '.', p.id);
    }

    /* ---- the years ---- */
    var plague = null;
    for (var year = 1; year <= YEARS; year++) {
      var i, k, p, q;

      /* --- per polity --- */
      for (i = 0; i < polities.length; i++) {
        p = polities[i];
        if (!alive(p)) continue;

        var cap = capacityOf(p);
        var health = 0.55 + p.stability * 0.9;
        var g = 0.016 * health * (1 - p.pop / cap);
        p.pop = Math.max(400, p.pop * (1 + g));
        if (p.pop > p.peakPop) p.peakPop = p.pop;
        if (p.cells.length > p.peakCells) p.peakCells = p.cells.length;

        // learning and invention
        p.learning += (p.pop / 26000) * (0.35 + p.scholar) * (0.5 + p.stability);
        var need = 6 + p.tech * p.tech * 1.5 + p.tech * 7;
        if (p.learning > need && deckAt < deck.length) {
          p.learning = 0;
          p.tech++;
          var inv = deck[deckAt++];
          p.invented.push({ y: year, what: inv });
          rulerOf(p).deeds++;
          ev(year, 'idea', 'The first clear account of ' + inv + ' is written down in ' + p.name + '.', p.id);
        }

        // expansion
        var pressure = p.pop / cap;
        var admin = 46 + p.tech * 11;
        var crowd = p.cells.length > admin ? 0.35 : 1;
        var tries = (rand() < 0.14 + 0.5 * pressure * crowd * (0.4 + p.aggr)) ? 1 : 0;
        if (tries) {
          var fr = frontier(p, p.trade > 0.55 && p.tech >= 3);
          var floor = p.tech >= 6 ? 0.12 : 0.26;   // nobody settles the bad ground early
          var bestC = -1, bestS = -1;
          for (k = 0; k < fr.length; k++) {
            if (world.fert[fr[k]] < floor) continue;
            var sc = world.fert[fr[k]] * (0.6 + rand() * 0.9);
            if (sc > bestS) { bestS = sc; bestC = fr[k]; }
          }
          if (bestC >= 0) setOwner(bestC, p.id, year);
        }

        // stability drifts back toward a baseline set by size and rulership
        var target = 0.66 - Math.max(0, (p.cells.length - admin)) * 0.004 + (p.tech * 0.006);
        p.stability += (target - p.stability) * 0.05;
        p.stability = clamp(p.stability, 0.02, 0.98);

        // succession
        p.reign++;
        if (p.reign > p.lifespan) {
          var r = rulerOf(p);
          if (r.deeds >= 2) r.epithet = pick(EPITHETS.slice(0, 8));
          else if (rand() < 0.22) r.epithet = pick(EPITHETS);
          var reignLen = year - r.from;
          var crisis = rand() < 0.18 + (1 - p.stability) * 0.3;
          crown(p, year);
          if (crisis) {
            p.stability -= 0.2 + rand() * 0.18;
            if (rand() < 0.4) p.house = lex.house();
            ev(year, 'crown', 'The death of ' + rulerName(r) + ' leaves ' + p.name +
              ' to a disputed succession; ' + rulerName(rulerOf(p)) + ' takes the seat by force of argument and arms.', p.id);
          } else if (reignLen > 38 || rand() < 0.1) {
            ev(year, 'crown', rulerName(r) + ' of ' + p.name + ' dies after ' + reignLen +
              ' years on the seat; ' + rulerName(rulerOf(p)) + ' is raised in ' + capitalOf(p, year).name + '.', p.id);
          }
        }

        // quiet prosperity, wonders, famine
        if (p.stability > 0.78 && p.pop > 60000 && rand() < 0.006) {
          var wn = pick(WONDER_FORMS).replace('%C', capitalOf(p, year).name);
          p.wonders.push({ y: year, name: wn });
          rulerOf(p).deeds++;
          p.stability = clamp(p.stability + 0.08, 0, 1);
          ev(year, 'wonder', p.name + ' completes ' + wn + ' after a generation of work.', p.id);
        }
        if (rand() < 0.0012 + (p.pop / cap) * 0.0026) {
          p.pop *= 0.84 + rand() * 0.08;
          p.stability -= 0.07;
          ev(year, 'famine', 'A failed harvest in ' + p.name + ' empties the granaries; the assessors count fewer households for a decade.', p.id);
        }
      }

      /* --- faiths --- */
      if (!faiths.length && year > 60 && rand() < 0.02) {
        var host = null, tries2 = 0;
        while (!host && tries2++ < 30) {
          var cand = polities[Math.floor(rand() * polities.length)];
          if (alive(cand)) host = cand;
        }
        if (host) {
          var fname = lex.faith();
          var form = pick(['the Way of %', 'the % Rite', 'the Covenant of %', 'the Order of %', 'the % Confession']);
          faiths.push({ name: form.replace('%', fname), founded: year, origin: host.id, hue: (hue0 + 180) % 360 });
          host.faith = 0;
          host.piety = clamp(host.piety + 0.2, 0, 1);
          ev(year, 'faith', faiths[0].name + ' is preached in ' + capitalOf(host, year).name + ' and taken up by the court of ' + host.name + '.', host.id);
        }
      }
      if (faiths.length) {
        for (i = 0; i < polities.length; i++) {
          p = polities[i];
          if (!alive(p) || p.faith >= 0) continue;
          var nbi = neighbourIds(p);
          for (k = 0; k < nbi.length; k++) {
            q = polities[nbi[k]];
            if (q.faith >= 0 && rand() < 0.012 * (0.4 + p.piety) * (0.4 + q.trade)) {
              p.faith = q.faith;
              ev(year, 'faith', p.name + ' takes up ' + faiths[p.faith].name + ', carried over the border from ' + q.name + '.', p.id);
              break;
            }
          }
        }
        if (faiths.length === 1 && year > 260 && rand() < 0.004) {
          var sch = null;
          for (i = 0; i < polities.length; i++) if (alive(polities[i]) && polities[i].faith === 0 && polities[i].id !== faiths[0].origin) { sch = polities[i]; break; }
          if (sch) {
            var f2n = lex.faith();
            faiths.push({ name: pick(['the Reformed %', 'the % Schism', 'the Second Covenant of %']).replace('%', f2n), founded: year, origin: sch.id, hue: (hue0 + 250) % 360 });
            sch.faith = 1;
            ev(year, 'faith', 'A council at ' + capitalOf(sch, year).name + ' breaks with ' + faiths[0].name +
              ', and from this year ' + sch.name + ' keeps ' + faiths[1].name + ' instead.', sch.id);
          }
        }
      }

      /* --- plague --- */
      if (!plague && year > 80 && rand() < 0.004) {
        var living = polities.filter(alive);
        if (living.length) {
          var origin = living[Math.floor(rand() * living.length)];
          plague = { name: pick(['the Grey Fever', 'the Long Sickness', 'the Ashen Cough', 'the Summer Plague', 'the Still Winter']), left: 3 + Math.floor(rand() * 5), hit: {}, told: 0, count: 1 };
          plague.hit[origin.id] = 1;
          origin.pop *= 0.66 + rand() * 0.14;
          origin.stability -= 0.14;
          ev(year, 'plague', plague.name + ' appears in the ports of ' + capitalOf(origin, year).name + '. Within a season ' + origin.name + ' is burying more than it can name.', origin.id);
        }
      } else if (plague) {
        var spread = [];
        for (i = 0; i < polities.length; i++) {
          p = polities[i];
          if (!alive(p) || plague.hit[p.id]) continue;
          var nb2 = neighbourIds(p);
          for (k = 0; k < nb2.length; k++) if (plague.hit[nb2[k]] && rand() < 0.5) { spread.push(p); break; }
        }
        spread.forEach(function (sp) {
          plague.hit[sp.id] = 1;
          plague.count++;
          sp.pop *= 0.63 + rand() * 0.17;
          sp.stability -= 0.12;
          if (plague.told < 2) {
            plague.told++;
            ev(year, 'plague', plague.name + ' crosses into ' + sp.name + '; the roads are closed and the fairs are cancelled.', sp.id);
          }
        });
        plague.left--;
        if (plague.left <= 0) {
          ev(year, 'plague', 'The last houses are unsealed. ' + plague.name + ' has run through ' + plague.count +
            ' countries, and every chronicle in the world now counts years from before it and after it.', -1);
          plague = null;
        }
      }

      /* --- wars --- */
      if (wars.length < 3) {
        var pool2 = polities.filter(alive);
        for (i = 0; i < pool2.length; i++) {
          p = pool2[i];
          if (atWar(p)) continue;
          var opts = neighbourIds(p).filter(function (id) { return alive(polities[id]) && !atWar(polities[id]); });
          if (!opts.length) continue;
          q = polities[opts[Math.floor(rand() * opts.length)]];
          var holy = (p.faith >= 0 && q.faith >= 0 && p.faith !== q.faith) ? 2.1 : 1;
          var chance = (0.006 + p.aggr * 0.02) * holy * (0.6 + (1 - p.stability));
          if (rand() < chance) {
            var cause = holy > 1 ? 'over the rites' : pick(['over a disputed valley', 'over a broken marriage treaty', 'over tolls on the river', 'over a murdered envoy', 'over an old claim to the coast', 'over grazing rights in the uplands']);
            wars.push({
              a: p.id, b: q.id, since: year, left: 5 + Math.floor(rand() * 14), swing: 0,
              cause: cause, ca: p.cells.length, cb: q.cells.length
            });
            ev(year, 'war', p.name + ' declares war on ' + q.name + ' ' + cause + '.', p.id);
            break;
          }
        }
      }
      for (i = wars.length - 1; i >= 0; i--) {
        var w = wars[i];
        var A = polities[w.a], B = polities[w.b];
        if (!alive(A) || !alive(B)) { wars.splice(i, 1); continue; }
        var sA = Math.sqrt(A.pop) * (1 + A.tech * 0.11) * (0.6 + A.aggr) * A.stability * (0.6 + rand() * 0.9);
        var sB = Math.sqrt(B.pop) * (1 + B.tech * 0.11) * (0.6 + B.aggr) * B.stability * (0.6 + rand() * 0.9);
        var win = sA > sB ? A : B, lose = sA > sB ? B : A;
        var ratio = Math.max(sA, sB) / Math.max(1, Math.min(sA, sB));
        var take = borderWith(win, lose);
        var n = Math.min(take.length, ratio > 1.9 ? 5 : (ratio > 1.35 ? 3 : 1));
        for (k = 0; k < n; k++) {
          var cell = take[Math.floor(rand() * take.length)];
          if (owner[cell] === lose.id) setOwner(cell, win.id, year);
        }
        A.pop *= 0.988 - rand() * 0.012;
        B.pop *= 0.988 - rand() * 0.012;
        lose.stability -= 0.02;
        win.stability -= 0.004;
        w.swing += (win === A ? 1 : -1);
        rulerOf(win).deeds += 0.25;

        var capLost = owner[capitalOf(lose, year).cell] !== lose.id;
        if (capLost && lose.cells.length) {
          ev(year, 'war', win.name + ' takes ' + capitalOf(lose, year).name + ' by siege.', win.id);
          moveCapital(lose, year);
          lose.stability -= 0.2;
        }
        w.left--;
        if (!lose.cells.length) {
          kill(lose, year, lose.name + ' is annexed entire by ' + win.name + ' after ' + (year - w.since) + ' years of war. Its records are carried off to ' + capitalOf(win, year).name + '.');
          win.stability -= 0.05;
          wars.splice(i, 1);
          continue;
        }

        // capitulation: a realm reduced to a third of what it started with folds
        var startL = (lose.id === w.a) ? w.ca : w.cb;
        if (lose.cells.length <= Math.max(3, startL * 0.34) && rand() < 0.3) {
          if (ratio > 1.5 && rand() < 0.6) {
            var rest = lose.cells.slice();
            for (k = 0; k < rest.length; k++) setOwner(rest[k], win.id, year);
            kill(lose, year, 'What is left of ' + lose.name + ' is signed away to ' + win.name +
              ' in the ' + (rand() < 0.5 ? 'peace' : 'settlement') + ' of ' + year + '. ' + win.name +
              ' now holds ' + win.cells.length + ' districts, and everyone with a border says so nervously.');
            win.stability -= 0.09;
            wars.splice(i, 1);
            continue;
          }
          ev(year, 'peace', lose.name + ' sues for peace on any terms. ' + win.name +
            ' keeps the country it has taken and leaves a rump state around ' + capitalOf(lose, year).name + '.', win.id);
          lose.stability -= 0.1;
          wars.splice(i, 1);
          continue;
        }

        if (w.left <= 0) {
          if (Math.abs(w.swing) < 3) {
            ev(year, 'peace', A.name + ' and ' + B.name + ' sign a peace that changes almost nothing, after ' +
              (year - w.since) + ' years and a great many ruined harvests.', A.id);
          } else {
            ev(year, 'peace', lose.name + ' cedes the border country to ' + win.name +
              ' and the war of ' + w.since + ' is closed.', win.id);
          }
          wars.splice(i, 1);
        }
      }

      /* --- collapse into successor states --- */
      for (i = 0; i < polities.length; i++) {
        p = polities[i];
        if (!alive(p)) continue;
        if (p.stability < 0.17 && p.cells.length >= 16 && rand() < 0.06) {
          // split off the half of the realm furthest from the capital
          var capCell = capitalOf(p, year).cell;
          var cx2 = capCell % W, cy2 = (capCell / W) | 0;
          var ranked = p.cells.slice().sort(function (a, b) {
            var ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
            return (Math.abs(bx - cx2) + Math.abs(by - cy2)) - (Math.abs(ax - cx2) + Math.abs(ay - cy2));
          });
          var cut = Math.floor(ranked.length * (0.34 + rand() * 0.22));
          if (cut >= 3) {
            var breakaway = ranked.slice(0, cut);
            var np = newPolity(breakaway[0], year, p);
            for (k = 0; k < breakaway.length; k++) if (owner[breakaway[k]] === p.id) setOwner(breakaway[k], np.id, year);
            np.pop = p.pop * (cut / (ranked.length || 1));
            p.pop -= np.pop;
            np.stability = 0.5 + rand() * 0.2;
            p.stability = clamp(p.stability + 0.22, 0, 1);
            ev(year, 'break', 'The outer provinces of ' + p.name + ' stop answering the capital. They are ' +
              np.title + ' from this year, with ' + rulerName(rulerOf(np)) + ' at ' + capitalOf(np, year).name + '.', np.id);
          }
        }
      }

      /* --- unions --- */
      if (rand() < 0.004) {
        var lv = polities.filter(alive);
        for (i = 0; i < lv.length; i++) {
          p = lv[i];
          if (atWar(p) || p.stability < 0.62) continue;
          var ns = neighbourIds(p).filter(function (id) {
            var o = polities[id];
            return alive(o) && !atWar(o) && o.stability > 0.6 && o.faith === p.faith && o.cells.length < p.cells.length;
          });
          if (!ns.length) continue;
          q = polities[ns[Math.floor(rand() * ns.length)]];
          var qc = q.cells.slice();
          for (k = 0; k < qc.length; k++) setOwner(qc[k], p.id, year);
          p.pop += q.pop;
          kill(q, year, 'The crowns of ' + p.name + ' and ' + q.name + ' are joined by marriage. ' + q.name + ' keeps its laws and loses its throne.');
          p.stability = clamp(p.stability - 0.06, 0, 1);
          break;
        }
      }

      /* --- a new state appears in empty land --- */
      if (year > 40 && year < 420 && rand() < 0.004) {
        var free = [];
        for (k = 0; k < world.landCells.length; k++) {
          var lc = world.landCells[k];
          if (owner[lc] < 0 && world.fert[lc] > 0.5) {
            var nb3 = neighbours(lc), open = 0;
            for (var m2 = 0; m2 < nb3.length; m2++) if (world.land[nb3[m2]] && owner[nb3[m2]] < 0) open++;
            if (open >= 3) free.push(lc);
          }
        }
        if (free.length) {
          var np2 = newPolity(free[Math.floor(rand() * free.length)], year, null);
          ev(year, 'found', 'Villages on the unclaimed ground swear to one another and to ' + rulerName(rulerOf(np2)) +
            '. They call the arrangement ' + np2.title + '.', np2.id);
        }
      }

      /* --- record the year --- */
      var row = [];
      for (i = 0; i < polities.length; i++) {
        p = polities[i];
        if (!alive(p)) continue;
        row.push({ id: p.id, pop: Math.round(p.pop), cells: p.cells.length, tech: p.tech });
      }
      stats[year] = row;
    }

    stats[0] = polities.map(function (p) {
      return { id: p.id, pop: Math.round(p.pop), cells: 0, tech: 0 };
    });
    polities.forEach(function (p) {
      if (p.reigns.length) p.reigns[p.reigns.length - 1].to = p.ended < 0 ? YEARS : p.ended;
    });
    events.sort(function (a, b) { return a.y - b.y; });

    return {
      polities: polities, events: events, faiths: faiths,
      diffs: diffs, stats: stats, calendar: calendar
    };
  }

  function build(seed) {
    var rand = rng(seed >>> 0);
    var world = makeWorld(rand);
    var hist = simulate(rand, world);
    return { seed: seed >>> 0, world: world, hist: hist };
  }

  /* ================= headless export (for checking the sim) ================= */
  var doc = (typeof document !== 'undefined') ? document : null;
  if (!doc) {
    if (typeof module !== 'undefined' && module.exports) module.exports = { build: build, YEARS: YEARS, W: W, H: H };
    return;
  }

  /* ================= view ================= */
  var CS = 12, CW = W * CS, CH = H * CS;
  var cvs = doc.getElementById('chronicle');
  var ctx = cvs.getContext('2d');
  var tideCvs = doc.getElementById('tide');
  var tideCtx = tideCvs.getContext('2d');
  var base = doc.createElement('canvas');
  base.width = CW; base.height = CH;
  var bctx = base.getContext('2d');

  var tideBase = doc.createElement('canvas');
  tideBase.width = tideCvs.width; tideBase.height = tideCvs.height;
  var tbctx = tideBase.getContext('2d');

  var state = null;          // {seed, world, hist}
  var view = new Int16Array(N);
  var year = 0, fyear = 0, playing = false, speed = 10, selected = -1, last = 0, raf = null;
  var counts = [], uiDirty = true, uiClock = 0;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return doc.getElementById(id); }

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'm';
    if (n >= 1e3) return Math.round(n / 1e3) + 'k';
    return String(Math.round(n));
  }

  function paintBase() {
    var w = state.world;
    bctx.fillStyle = '#05070b';
    bctx.fillRect(0, 0, CW, CH);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x;
        if (w.land[i]) {
          var f = w.fert[i];
          var l = 13 + f * 12;
          bctx.fillStyle = 'hsl(' + (150 - f * 40).toFixed(0) + ',10%,' + l.toFixed(0) + '%)';
        } else {
          var deep = clamp((w.sea - w.elev[i]) * 2.2, 0, 1);
          bctx.fillStyle = 'hsl(215,42%,' + (13 - deep * 6).toFixed(1) + '%)';
        }
        bctx.fillRect(x * CS, y * CS, CS, CS);
      }
    }
    // coastline
    bctx.strokeStyle = 'rgba(140,190,220,.22)';
    bctx.lineWidth = 1;
    bctx.beginPath();
    for (var y2 = 0; y2 < H; y2++) {
      for (var x2 = 0; x2 < W; x2++) {
        var j = y2 * W + x2;
        if (x2 < W - 1 && state.world.land[j] !== state.world.land[j + 1]) {
          bctx.moveTo((x2 + 1) * CS, y2 * CS); bctx.lineTo((x2 + 1) * CS, (y2 + 1) * CS);
        }
        if (y2 < H - 1 && state.world.land[j] !== state.world.land[j + W]) {
          bctx.moveTo(x2 * CS, (y2 + 1) * CS); bctx.lineTo((x2 + 1) * CS, (y2 + 1) * CS);
        }
      }
    }
    bctx.stroke();
  }

  function rebuildView(to) {
    var i;
    for (i = 0; i < N; i++) view[i] = -1;
    for (var y = 0; y <= to; y++) {
      var dd = state.hist.diffs[y];
      for (i = 0; i < dd.length; i += 2) view[dd[i]] = dd[i + 1];
    }
    recount();
  }

  function stepView(from, to) {
    for (var y = from + 1; y <= to; y++) {
      var dd = state.hist.diffs[y];
      for (var i = 0; i < dd.length; i += 2) view[dd[i]] = dd[i + 1];
    }
    recount();
  }

  function recount() {
    counts = [];
    for (var i = 0; i < state.hist.polities.length; i++) counts.push({ n: 0, sx: 0, sy: 0 });
    for (i = 0; i < N; i++) {
      var o = view[i];
      if (o >= 0) {
        var c = counts[o];
        c.n++; c.sx += i % W; c.sy += (i / W) | 0;
      }
    }
  }

  function setYear(y, force) {
    y = clamp(y, 0, YEARS);
    fyear = y;
    y = Math.round(y);
    if (y === year && !force) return;
    if (y >= year && !force) stepView(year, y); else rebuildView(y);
    year = y;
    uiDirty = true;
    var sl = $('scrub');
    if (sl && +sl.value !== year) sl.value = year;
    $('yearOut').textContent = 'Year ' + year;
    draw();
  }

  function draw() {
    ctx.drawImage(base, 0, 0);
    var pol = state.hist.polities, x, y, i, o;

    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        o = view[i];
        if (o < 0) continue;
        var f = state.world.fert[i];
        var s = f > 0.66 ? 3 : (f > 0.48 ? 2 : (f > 0.3 ? 1 : 0));
        ctx.fillStyle = pol[o].shades[s];
        ctx.fillRect(x * CS, y * CS, CS, CS);
      }
    }

    // borders
    ctx.strokeStyle = 'rgba(4,6,10,.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        o = view[i];
        if (x < W - 1 && view[i + 1] !== o && (o >= 0 || view[i + 1] >= 0)) {
          ctx.moveTo((x + 1) * CS, y * CS); ctx.lineTo((x + 1) * CS, (y + 1) * CS);
        }
        if (y < H - 1 && view[i + W] !== o && (o >= 0 || view[i + W] >= 0)) {
          ctx.moveTo(x * CS, (y + 1) * CS); ctx.lineTo((x + 1) * CS, (y + 1) * CS);
        }
      }
    }
    ctx.stroke();

    // selection halo
    if (selected >= 0 && counts[selected] && counts[selected].n) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          i = y * W + x;
          if (view[i] !== selected) continue;
          if (x === W - 1 || view[i + 1] !== selected) { ctx.moveTo((x + 1) * CS, y * CS); ctx.lineTo((x + 1) * CS, (y + 1) * CS); }
          if (x === 0 || view[i - 1] !== selected) { ctx.moveTo(x * CS, y * CS); ctx.lineTo(x * CS, (y + 1) * CS); }
          if (y === H - 1 || view[i + W] !== selected) { ctx.moveTo(x * CS, (y + 1) * CS); ctx.lineTo((x + 1) * CS, (y + 1) * CS); }
          if (y === 0 || view[i - W] !== selected) { ctx.moveTo(x * CS, y * CS); ctx.lineTo((x + 1) * CS, y * CS); }
        }
      }
      ctx.stroke();
    }

    // capitals + names
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (i = 0; i < pol.length; i++) {
      var p = pol[i], c = counts[i];
      if (!c || !c.n) continue;
      var capc = null;
      for (var k = 0; k < p.capitals.length; k++) if (p.capitals[k].from <= year) capc = p.capitals[k];
      if (capc && view[capc.cell] === i) {
        var cx = (capc.cell % W) * CS + CS / 2, cy = (((capc.cell / W) | 0)) * CS + CS / 2;
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath(); ctx.arc(cx, cy, 3.1, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, 3.1, 0, 6.2832); ctx.stroke();
      }
      if (c.n >= 13) {
        var lx = (c.sx / c.n) * CS + CS / 2, ly = (c.sy / c.n) * CS + CS / 2;
        ctx.font = '600 ' + (c.n > 90 ? 15 : 12) + 'px ui-sans-serif,system-ui,sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,.62)';
        ctx.strokeText(p.name, lx, ly);
        ctx.fillStyle = 'rgba(255,255,255,.94)';
        ctx.fillText(p.name, lx, ly);
      }
    }
  }

  /* ---------- the tide strip ---------- */
  function paintTide() {
    var TW = tideBase.width, TH = tideBase.height;
    tbctx.clearRect(0, 0, TW, TH);
    tbctx.fillStyle = 'rgba(255,255,255,.03)';
    tbctx.fillRect(0, 0, TW, TH);
    var pol = state.hist.polities, stats = state.hist.stats;
    var totalLand = state.world.landCells.length;
    for (var y = 1; y <= YEARS; y++) {
      var row = stats[y] || [];
      var x = ((y - 1) / YEARS) * TW, w = (TW / YEARS) + 0.7;
      var acc = 0;
      for (var i = 0; i < row.length; i++) {
        var h = (row[i].cells / totalLand) * TH;
        tbctx.fillStyle = pol[row[i].id].shades[2];
        tbctx.fillRect(x, TH - acc - h, w, h);
        acc += h;
      }
    }
  }

  function drawPlayhead() {
    var TW = tideCvs.width, TH = tideCvs.height;
    tideCtx.clearRect(0, 0, TW, TH);
    tideCtx.drawImage(tideBase, 0, 0);
    var x = (year / YEARS) * TW;
    tideCtx.strokeStyle = 'rgba(255,255,255,.85)';
    tideCtx.lineWidth = 1.5;
    tideCtx.beginPath();
    tideCtx.moveTo(x, 0); tideCtx.lineTo(x, TH);
    tideCtx.stroke();
  }

  /* ---------- panels ---------- */
  var KIND_LABEL = {
    era: 'era', found: 'founded', war: 'war', peace: 'peace', idea: 'learning',
    plague: 'plague', faith: 'faith', crown: 'crown', break: 'revolt',
    end: 'ended', wonder: 'works', famine: 'famine', court: 'court'
  };

  function renderFeed() {
    var evs = state.hist.events, out = [], shown = 0;
    for (var i = evs.length - 1; i >= 0 && shown < 46; i--) {
      var e = evs[i];
      if (e.y > year) continue;
      var pol = e.p >= 0 ? state.hist.polities[e.p] : null;
      out.push('<li class="ev k-' + e.k + '"' + (pol ? ' data-p="' + e.p + '"' : '') + '>' +
        '<span class="ev-y">' + e.y + '</span>' +
        '<span class="ev-k">' + (KIND_LABEL[e.k] || e.k) + '</span>' +
        '<p>' + e.t + '</p></li>');
      shown++;
    }
    $('feed').innerHTML = out.join('') || '<li class="ev"><p>Nothing has happened yet.</p></li>';
  }

  function renderTable() {
    var pol = state.hist.polities;
    var row = state.hist.stats[year] || [];
    var live = row.slice().sort(function (a, b) { return b.cells - a.cells; });
    var out = ['<table><thead><tr><th>Power</th><th>Since</th><th>Ruler</th><th>Land</th><th>People</th><th>Learning</th><th>Faith</th></tr></thead><tbody>'];
    for (var i = 0; i < live.length; i++) {
      var p = pol[live[i].id];
      var r = p.reigns[0];
      for (var k = 0; k < p.reigns.length; k++) if (p.reigns[k].from <= year) r = p.reigns[k];
      var faith = p.faith >= 0 && state.hist.faiths[p.faith] ? state.hist.faiths[p.faith].name : '—';
      out.push('<tr data-p="' + p.id + '"' + (selected === p.id ? ' class="on"' : '') + '>' +
        '<td><span class="sw" style="background:' + p.shades[3] + '"></span><b>' + p.name + '</b>' +
        '<span class="desig">' + p.title + '</span></td>' +
        '<td>' + p.founded + '</td>' +
        '<td>' + r.name + ' ' + roman(r.num) + (r.epithet && r.to <= year ? ' <i>' + r.epithet + '</i>' : '') + '</td>' +
        '<td>' + live[i].cells + '</td>' +
        '<td>' + fmt(live[i].pop) + '</td>' +
        '<td>' + live[i].tech + '</td>' +
        '<td>' + faith + '</td></tr>');
    }
    out.push('</tbody></table>');
    $('powers').innerHTML = out.join('');
  }

  function renderCard() {
    var el = $('card');
    if (selected < 0) {
      var h = state.hist;
      var live = (h.stats[year] || []).length;
      var totalPop = (h.stats[year] || []).reduce(function (a, b) { return a + b.pop; }, 0);
      el.innerHTML = '<div class="seed-num">' + String(state.seed).padStart(10, '0') + '</div>' +
        '<dl class="seed-grid">' +
        '<div><dt>Reckoning</dt><dd>' + h.calendar + '</dd></div>' +
        '<div><dt>Year</dt><dd>' + year + ' of ' + YEARS + '</dd></div>' +
        '<div><dt>Powers standing</dt><dd>' + live + '</dd></div>' +
        '<div><dt>People counted</dt><dd>' + fmt(totalPop) + '</dd></div>' +
        '<div><dt>States recorded</dt><dd>' + h.polities.filter(function (p) { return p.founded <= year; }).length + '</dd></div>' +
        '<div><dt>Faiths</dt><dd>' + (h.faiths.filter(function (f) { return f.founded <= year; }).length || 'none yet') + '</dd></div>' +
        '</dl><p class="card-note">Click any country on the map, or any line in the chronicle, for its file.</p>';
      return;
    }
    var p = state.hist.polities[selected];
    var st = null, row = state.hist.stats[year] || [];
    for (var i = 0; i < row.length; i++) if (row[i].id === p.id) st = row[i];
    var r = p.reigns[0];
    for (var k = 0; k < p.reigns.length; k++) if (p.reigns[k].from <= year) r = p.reigns[k];
    var cap = p.capitals[0];
    for (k = 0; k < p.capitals.length; k++) if (p.capitals[k].from <= year) cap = p.capitals[k];

    var status;
    if (p.founded > year) status = 'not yet founded';
    else if (p.ended >= 0 && p.ended <= year) status = 'ended in ' + p.ended;
    else status = 'standing';

    var traits = [];
    if (p.aggr > 0.62) traits.push('warlike'); else if (p.aggr < 0.3) traits.push('slow to fight');
    if (p.trade > 0.62) traits.push('mercantile');
    if (p.piety > 0.66) traits.push('devout');
    if (p.scholar > 0.62) traits.push('lettered');
    if (!traits.length) traits.push('unremarkable');

    var lines = p.log.filter(function (e) { return e.y <= year; }).slice(-9).reverse()
      .map(function (e) {
        return '<li><span class="ev-y">' + e.y + '</span><p>' + e.t + '</p></li>';
      }).join('');

    el.innerHTML =
      '<h3 class="card-title"><span class="sw big" style="background:' + p.shades[3] + '"></span>' +
      p.title.charAt(0).toUpperCase() + p.title.slice(1) + '</h3>' +
      '<dl class="seed-grid">' +
      '<div><dt>Status</dt><dd>' + status + '</dd></div>' +
      '<div><dt>Founded</dt><dd>Year ' + p.founded + '</dd></div>' +
      '<div><dt>Seat</dt><dd>' + cap.name + '</dd></div>' +
      '<div><dt>Ruler</dt><dd>' + rulerLine(r) + '</dd></div>' +
      '<div><dt>House</dt><dd>' + p.house + '</dd></div>' +
      '<div><dt>People</dt><dd>' + (st ? fmt(st.pop) : '—') + '</dd></div>' +
      '<div><dt>Land held</dt><dd>' + (st ? st.cells : 0) + ' districts</dd></div>' +
      '<div><dt>Ideas first set down here</dt><dd>' + (st ? st.tech : p.tech) + '</dd></div>' +
      '<div><dt>Faith</dt><dd>' + (p.faith >= 0 && state.hist.faiths[p.faith] ? state.hist.faiths[p.faith].name : 'none') + '</dd></div>' +
      '<div><dt>Character</dt><dd>' + traits.join(', ') + '</dd></div>' +
      '<div><dt>Rulers so far</dt><dd>' + p.reigns.filter(function (q) { return q.from <= year; }).length + '</dd></div>' +
      '<div><dt>Largest so far</dt><dd>' + peakTo(p.id, year) + ' districts</dd></div>' +
      '</dl>' +
      (p.wonders.filter(function (w) { return w.y <= year; }).length
        ? '<p class="card-note"><b>Standing works.</b> ' + p.wonders.filter(function (w) { return w.y <= year; })
          .map(function (w) { return w.name + ' (' + w.y + ')'; }).join('; ') + '.</p>' : '') +
      (p.invented.filter(function (w) { return w.y <= year; }).length
        ? '<p class="card-note"><b>First written down here.</b> ' + p.invented.filter(function (w) { return w.y <= year; })
          .map(function (w) { return w.what + ' (' + w.y + ')'; }).join('; ') + '.</p>' : '') +
      '<ul class="mini-log">' + lines + '</ul>' +
      '<p class="card-note"><button class="chip" type="button" id="clearSel">Back to the whole world</button></p>';

    var cs = $('clearSel');
    if (cs) cs.addEventListener('click', function () { selected = -1; uiDirty = true; renderAll(); draw(); });
  }

  // the largest the realm had ever been as of this year — no peeking ahead
  function peakTo(id, upto) {
    var peak = 0, stats = state.hist.stats;
    for (var y = 0; y <= upto; y++) {
      var row = stats[y];
      if (!row) continue;
      for (var i = 0; i < row.length; i++) {
        if (row[i].id === id && row[i].cells > peak) peak = row[i].cells;
      }
    }
    return peak;
  }

  function rulerLine(r) {
    var ended = r.to >= 0 && r.to <= year;
    return r.name + ' ' + roman(r.num) + (ended && r.epithet ? ' ' + r.epithet : '') +
      ' <span class="desig">' + r.from + '–' + (ended ? r.to : '') + '</span>';
  }

  function renderAll() {
    renderFeed();
    renderTable();
    renderCard();
    drawPlayhead();
    uiDirty = false;
  }

  /* ---------- loop ---------- */
  function tick(ts) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.25, (ts - last) / 1000);
    last = ts;
    if (playing) {
      var next = fyear + speed * dt;
      if (next >= YEARS) { setYear(YEARS); setPlaying(false); }
      else setYear(next);
    }
    uiClock += dt;
    if (uiDirty && uiClock > 0.12) { uiClock = 0; renderAll(); }
  }

  function setPlaying(v) {
    playing = v;
    $('btnPlay').textContent = playing ? 'Pause' : (year >= YEARS ? 'Replay' : 'Run the centuries');
    if (playing && year >= YEARS) { setYear(0, true); }
  }

  /* ---------- wiring ---------- */
  function boot(seed) {
    state = build(seed);
    selected = -1;
    year = 0;
    fyear = 0;
    paintBase();
    rebuildView(0);
    paintTide();
    $('seedOut').textContent = String(state.seed).padStart(10, '0');
    $('eraOut').textContent = state.hist.calendar;
    $('yearOut').textContent = 'Year 0';
    $('scrub').value = 0;
    draw();
    renderAll();
  }

  function cellFromEvent(e) {
    var r = cvs.getBoundingClientRect();
    var x = Math.floor(((e.clientX - r.left) / r.width) * W);
    var y = Math.floor(((e.clientY - r.top) / r.height) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    return y * W + x;
  }

  cvs.addEventListener('click', function (e) {
    var i = cellFromEvent(e);
    if (i < 0) return;
    var o = view[i];
    selected = (o >= 0 && o !== selected) ? o : -1;
    uiDirty = true;
    renderAll();
    draw();
  });

  cvs.addEventListener('mousemove', function (e) {
    var i = cellFromEvent(e);
    var o = i >= 0 ? view[i] : -1;
    cvs.style.cursor = o >= 0 ? 'pointer' : 'default';
    var tip = $('tip');
    if (o >= 0) {
      tip.textContent = state.hist.polities[o].title;
      tip.style.opacity = 1;
    } else { tip.style.opacity = 0.35; tip.textContent = 'open water, or ground nobody has claimed'; }
  });

  $('feed').addEventListener('click', function (e) {
    var li = e.target.closest ? e.target.closest('li[data-p]') : null;
    if (!li) return;
    selected = +li.getAttribute('data-p');
    uiDirty = true;
    renderAll();
    draw();
  });

  $('powers').addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-p]') : null;
    if (!tr) return;
    var id = +tr.getAttribute('data-p');
    selected = (id === selected) ? -1 : id;
    uiDirty = true;
    renderAll();
    draw();
  });

  tideCvs.addEventListener('click', function (e) {
    var r = tideCvs.getBoundingClientRect();
    setYear(((e.clientX - r.left) / r.width) * YEARS, true);
    renderAll();
  });

  $('scrub').addEventListener('input', function () {
    setPlaying(false);
    setYear(+this.value, true);
    renderAll();
  });

  $('btnPlay').addEventListener('click', function () { setPlaying(!playing); });
  $('btnEnd').addEventListener('click', function () {
    setPlaying(false); setYear(YEARS, true); renderAll();
  });
  $('btnRestart').addEventListener('click', function () {
    setYear(0, true); renderAll(); setPlaying(true);
  });
  $('btnNew').addEventListener('click', function () {
    setPlaying(false);
    boot((Math.random() * 4294967295) >>> 0);
    if (!reduce) setPlaying(true); else { setYear(YEARS, true); renderAll(); }
  });
  $('btnToday').addEventListener('click', function () {
    setPlaying(false);
    boot(seedForToday());
    if (!reduce) setPlaying(true); else { setYear(YEARS, true); renderAll(); }
  });

  var speeds = [['slow', 3], ['steady', 10], ['brisk', 30], ['a life a blink', 90]];
  var sc = $('speeds');
  speeds.forEach(function (s, i) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (i === 1 ? ' on' : '');
    b.textContent = s[0] + ' · ' + s[1] + ' yrs/s';
    b.addEventListener('click', function () {
      speed = s[1];
      Array.prototype.forEach.call(sc.children, function (c) { c.classList.remove('on'); });
      b.classList.add('on');
    });
    sc.appendChild(b);
  });

  doc.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === 'ArrowRight') { setPlaying(false); setYear(year + (e.shiftKey ? 25 : 1), true); renderAll(); }
    else if (e.key === 'ArrowLeft') { setPlaying(false); setYear(year - (e.shiftKey ? 25 : 1), true); renderAll(); }
  });

  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden && playing) setPlaying(false);
  });

  boot(seedForToday());
  raf = requestAnimationFrame(function (t) { last = t; tick(t); });
  if (!reduce) setPlaying(true);
  else { setYear(YEARS, true); renderAll(); }
})();
