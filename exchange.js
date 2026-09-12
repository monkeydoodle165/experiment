/* The Exchange — experiment.quibo.games
   A trading economy dealt by today's date. Towns make things, eat things and
   price whatever is left in the warehouse; merchants read the prices, haul
   goods down the roads and close the gaps. Nothing here is scripted and there
   is no equilibrium being solved for.
   Self-contained. No dependencies. */
(function () {
  'use strict';

  /* ================= seeded PRNG ================= */
  function mulberry(seed) {
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

  var rand = Math.random;
  function rr(a, b) { return a + rand() * (b - a); }
  function ri(a, b) { return Math.floor(a + rand() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(rand() * a.length)]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function money(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    if (n >= 100) return n.toFixed(0);
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(2);
  }

  /* ================= word stock ================= */
  var T_HEAD = ['Ald', 'Bram', 'Cold', 'Dun', 'Eer', 'Fen', 'Gar', 'Hall', 'Ith',
    'Kess', 'Lorn', 'Mar', 'Nest', 'Orm', 'Pell', 'Quar', 'Red', 'Sarn', 'Thorn',
    'Ulve', 'Vess', 'Wend', 'Yarl', 'Brack', 'Dour', 'Glim', 'Harrow', 'Isk',
    'Merrow', 'Stave', 'Tarn', 'Vint'];
  var T_TAIL = ['ford', 'holm', 'mouth', 'gate', 'mere', 'bury', 'stad', 'vik',
    'wick', 'burgh', 'cross', 'haven', 'reach', 'combe', 'fell', 'march', 'ness',
    'stow', 'dale', 'quay'];
  var M_HEAD = ['Aldi', 'Bret', 'Caro', 'Dova', 'Emr', 'Fenn', 'Gera', 'Hals',
    'Ives', 'Juno', 'Kalm', 'Lenn', 'Mirr', 'Nols', 'Osha', 'Peri', 'Ruve',
    'Sask', 'Tove', 'Ulla', 'Veyr', 'Wist', 'Yorr', 'Zeva'];
  var M_TAIL = ['a', 'en', 'is', 'or', 'ka', 'eth', 'ine', 'ard', 'ov', 'ale'];

  /* ================= goods ================= */
  var GOOD_POOL = [
    { n: 'Grain',     kind: 'food',  src: 'field',   base: 6,  bulk: 1.0,  col: '#e2c275' },
    { n: 'Salt fish', kind: 'food',  src: 'sea',     base: 10, bulk: 0.9,  col: '#7fc3d8' },
    { n: 'Cheese',    kind: 'food',  src: 'pasture', base: 15, bulk: 0.7,  col: '#f2e6c2' },
    { n: 'Honey',     kind: 'food',  src: 'wood',    base: 19, bulk: 0.6,  col: '#f0b24a' },
    { n: 'Timber',    kind: 'raw',   src: 'wood',    base: 5,  bulk: 1.6,  col: '#8a6b4a' },
    { n: 'Iron',      kind: 'raw',   src: 'mine',    base: 18, bulk: 1.3,  col: '#9aa6b5' },
    { n: 'Copper',    kind: 'raw',   src: 'mine',    base: 25, bulk: 1.2,  col: '#d08457' },
    { n: 'Wool',      kind: 'raw',   src: 'pasture', base: 12, bulk: 0.8,  col: '#dcd3c6' },
    { n: 'Furs',      kind: 'raw',   src: 'wood',    base: 40, bulk: 0.5,  col: '#a6785a' },
    { n: 'Cloth',     kind: 'craft', src: 'craft',   base: 31, bulk: 0.5,  col: '#b98ad1' },
    { n: 'Glass',     kind: 'craft', src: 'craft',   base: 38, bulk: 0.6,  col: '#8fe3d8' },
    { n: 'Pottery',   kind: 'craft', src: 'craft',   base: 16, bulk: 0.9,  col: '#cf7f6a' },
    { n: 'Tools',     kind: 'craft', src: 'craft',   base: 46, bulk: 0.7,  col: '#9fb3d9' },
    { n: 'Paper',     kind: 'craft', src: 'craft',   base: 34, bulk: 0.3,  col: '#e8e2d0' },
    { n: 'Wine',      kind: 'lux',   src: 'vine',    base: 27, bulk: 1.0,  col: '#c2415f' },
    { n: 'Spice',     kind: 'lux',   src: 'trade',   base: 72, bulk: 0.2,  col: '#e0713a' },
    { n: 'Amber',     kind: 'lux',   src: 'sea',     base: 96, bulk: 0.15, col: '#f2a63b' },
    { n: 'Dye',       kind: 'lux',   src: 'trade',   base: 58, bulk: 0.25, col: '#7a5cd6' }
  ];
  var DEMAND = { food: 1.0, raw: 0.5, craft: 0.3, lux: 0.16 };
  /* nothing keeps for ever, and food keeps least of all */
  function spoilOf(gd) { return gd.kind === 'food' ? 0.0025 : 0.0005; }
  /* the two elasticities: a dear good is worth more trouble to make and
     gets used more sparingly, which is half of how a price settles */
  function supplyPull(rel) { return clamp(Math.pow(rel, 0.4), 0.45, 1.9); }
  function demandPull(rel) { return clamp(Math.pow(1 / rel, 0.45), 0.4, 2.2); }
  var FREIGHT = 0.12;   // coin per league per unit of bulk

  var TERRAIN = [
    { n: 'coast',          w: { sea: 3.2, trade: 2.0, craft: 1.0, field: 0.6, pasture: 0.5, wood: 0.4, mine: 0.1, vine: 0.3 } },
    { n: 'plain',          w: { field: 3.2, pasture: 1.6, craft: 0.9, wood: 0.5, vine: 0.6, trade: 0.5, sea: 0, mine: 0.1 } },
    { n: 'hill country',   w: { pasture: 2.4, mine: 1.8, vine: 1.6, wood: 0.8, field: 0.7, craft: 0.6, trade: 0.3, sea: 0 } },
    { n: 'mountain',       w: { mine: 3.4, wood: 1.0, pasture: 0.8, craft: 0.5, field: 0.2, vine: 0.2, trade: 0.2, sea: 0 } },
    { n: 'deep forest',    w: { wood: 3.2, pasture: 0.9, craft: 0.8, field: 0.5, mine: 0.4, vine: 0.2, trade: 0.3, sea: 0 } },
    { n: 'river crossing', w: { craft: 3.0, trade: 2.2, field: 1.1, wood: 0.7, pasture: 0.6, mine: 0.3, vine: 0.6, sea: 0.2 } }
  ];

  /* ================= world ================= */
  var W = null;          // the world
  var seed = 0;
  var T = 0;             // days elapsed
  var speed = 2;
  var SPEEDS = [
    { n: 'Paused', v: 0 },
    { n: 'Slow',   v: 4 },
    { n: 'Steady', v: 12 },
    { n: 'Fast',   v: 34 }
  ];
  var embargo = false;
  var toll = 0.06;
  var selTown = 0;
  var selGood = 0;
  var trades = 0;

  var HN = 240;          // history samples kept
  var SAMPLE = 3;        // days between samples

  var TOWN_COLS = ['#64f0c8', '#7aa2ff', '#ffb45b', '#ff6f91', '#b78cff',
    '#4ad9e6', '#c7f9cc', '#ffd166', '#ff8a5b', '#8fd694'];

  function townName(used) {
    for (var i = 0; i < 60; i++) {
      var n = pick(T_HEAD) + pick(T_TAIL);
      if (used.indexOf(n) < 0) { used.push(n); return n; }
    }
    return 'Town ' + used.length;
  }
  function merchantName(town) {
    return pick(M_HEAD) + pick(M_TAIL) + ' of ' + town;
  }

  function build(newSeed) {
    seed = newSeed >>> 0;
    rand = mulberry(seed);
    T = 0; trades = 0; embargo = false;
    var i, j, g, t;

    /* --- goods: two of each kind --- */
    var byKind = { food: [], raw: [], craft: [], lux: [] };
    for (i = 0; i < GOOD_POOL.length; i++) byKind[GOOD_POOL[i].kind].push(GOOD_POOL[i]);
    var goods = [];
    ['food', 'raw', 'craft', 'lux'].forEach(function (k) {
      var pool = byKind[k].slice();
      for (var s = pool.length - 1; s > 0; s--) {
        var r = Math.floor(rand() * (s + 1));
        var tmp = pool[s]; pool[s] = pool[r]; pool[r] = tmp;
      }
      goods.push(pool[0], pool[1]);
    });
    var G = goods.length;

    /* --- towns: scattered with a minimum separation --- */
    var want = ri(8, 10);
    var pts = [], guard = 0;
    while (pts.length < want && guard < 8000) {
      guard++;
      var p = { x: rr(0.07, 0.93), y: rr(0.12, 0.88) };
      var ok = true;
      for (i = 0; i < pts.length; i++) {
        var dx = pts[i].x - p.x, dy = (pts[i].y - p.y) * 0.78;
        if (Math.sqrt(dx * dx + dy * dy) < 0.18) { ok = false; break; }
      }
      if (ok) pts.push(p);
    }
    var N = pts.length;

    var used = [];
    var towns = [];
    for (i = 0; i < N; i++) {
      var terr = TERRAIN[Math.floor(rand() * TERRAIN.length)];
      var pop = Math.round(rr(1.1, 13) * 1000);
      var pu = pop / 1000;
      t = {
        i: i, name: townName(used), x: pts[i].x, y: pts[i].y,
        terr: terr.n, tw: terr.w, pop: pop, col: TOWN_COLS[i % TOWN_COLS.length],
        prod: new Float64Array(G), cons: new Float64Array(G),
        stock: new Float64Array(G), price: new Float64Array(G),
        prodMul: new Float64Array(G), consMul: new Float64Array(G),
        adj: []
      };
      for (g = 0; g < G; g++) {
        t.prodMul[g] = 1; t.consMul[g] = 1;
        t.cons[g] = pu * DEMAND[goods[g].kind] * rr(0.72, 1.34) * 0.085;
      }
      /* production weights from the terrain, then specialise hard */
      var wts = [];
      for (g = 0; g < G; g++) {
        var aff = terr.w[goods[g].src];
        if (aff === undefined) aff = 0.4;
        wts.push({ g: g, v: aff * rr(0.35, 1.5) });
      }
      wts.sort(function (a, b) { return b.v - a.v; });
      var keep = rand() < 0.55 ? 4 : 3;
      for (j = 0; j < wts.length; j++) {
        var v = j < keep ? wts[j].v : 0;
        if (j === 3 && keep === 4) v *= 0.45;
        t.prod[wts[j].g] = v * Math.pow(pu, 0.62);
      }
      towns.push(t);
    }

    /* --- somebody has to make every good: if nowhere specialised in it,
           hand it to whichever town the land suits best --- */
    for (g = 0; g < G; g++) {
      var anyone = false;
      for (i = 0; i < N; i++) if (towns[i].prod[g] > 0) { anyone = true; break; }
      if (anyone) continue;
      var bi = 0, bv = -1;
      for (i = 0; i < N; i++) {
        var aff2 = towns[i].tw[goods[g].src];
        if (aff2 === undefined) aff2 = 0.4;
        var vv = (aff2 + 0.12) * Math.pow(towns[i].pop / 1000, 0.62);
        if (vv > bv) { bv = vv; bi = i; }
      }
      towns[bi].prod[g] = Math.max(0.2, bv);
    }

    /* --- balance: make each good's world output meet world appetite,
           with a little over the top to cover what spoils in store --- */
    for (g = 0; g < G; g++) {
      var sp = 0, sc = 0;
      for (i = 0; i < N; i++) { sp += towns[i].prod[g]; sc += towns[i].cons[g]; }
      var over = 1 + spoilOf(goods[g]) * 55;
      var scale = sp > 0 ? (sc * over * rr(0.94, 1.10)) / sp : 0;
      for (i = 0; i < N; i++) {
        towns[i].prod[g] *= scale;
        towns[i].stock[g] = Math.max(2, towns[i].cons[g] * rr(34, 82));
        towns[i].price[g] = goods[g].base;
      }
    }

    /* --- roads: a spanning tree, then a few useful extras --- */
    var WORLD = 27; // leagues across the map
    function dist(a, b) {
      var dx = towns[a].x - towns[b].x, dy = (towns[a].y - towns[b].y) * 0.78;
      return Math.sqrt(dx * dx + dy * dy) * WORLD;
    }
    var edges = [];
    function addEdge(a, b) {
      for (var k = 0; k < edges.length; k++) {
        if ((edges[k].a === a && edges[k].b === b) || (edges[k].a === b && edges[k].b === a)) return;
      }
      var e = { a: a, b: b, d: dist(a, b), open: true };
      edges.push(e);
      towns[a].adj.push({ to: b, e: e });
      towns[b].adj.push({ to: a, e: e });
    }
    var inTree = [0], out = [];
    for (i = 1; i < N; i++) out.push(i);
    while (out.length) {
      var bestA = -1, bestB = -1, bestD = 1e9;
      for (i = 0; i < inTree.length; i++) {
        for (j = 0; j < out.length; j++) {
          var d = dist(inTree[i], out[j]);
          if (d < bestD) { bestD = d; bestA = inTree[i]; bestB = out[j]; }
        }
      }
      addEdge(bestA, bestB);
      inTree.push(bestB);
      out.splice(out.indexOf(bestB), 1);
    }
    var cand = [];
    for (i = 0; i < N; i++) for (j = i + 1; j < N; j++) cand.push({ a: i, b: j, d: dist(i, j) });
    cand.sort(function (p, q) { return p.d - q.d; });
    var extras = ri(2, 4);
    for (i = 0; i < cand.length && extras > 0; i++) {
      var c = cand[i];
      if (towns[c.a].adj.length >= 4 || towns[c.b].adj.length >= 4) continue;
      var already = false;
      for (j = 0; j < towns[c.a].adj.length; j++) if (towns[c.a].adj[j].to === c.b) already = true;
      if (already) continue;
      addEdge(c.a, c.b);
      extras--;
    }

    /* --- merchants --- */
    var merchants = [];
    var mcount = clamp(Math.round(N * 4.5), 24, 44);
    for (i = 0; i < mcount; i++) merchants.push(newMerchant(towns));

    /* --- price history --- */
    var hist = [];
    for (g = 0; g < G; g++) {
      var perTown = [];
      for (i = 0; i < N; i++) perTown.push(new Float32Array(HN));
      hist.push(perTown);
    }

    W = {
      goods: goods, G: G, towns: towns, N: N, edges: edges,
      merchants: merchants, effects: [], news: [],
      hist: hist, head: 0, count: 0, nextEvent: ri(90, 220)
    };

    /* biggest town selected, first good charted */
    var big = 0;
    for (i = 1; i < N; i++) if (towns[i].pop > towns[big].pop) big = i;
    selTown = big;
    selGood = 0;

    say('The roads are open. ' + N + ' towns, ' + G + ' goods, ' +
        mcount + ' merchants with a purse each.', 'good');
    buildChips();
    drawTownCard();
    drawFeed();
    sample();
    readout();
  }

  function newMerchant(towns) {
    var home = towns[Math.floor(rand() * towns.length)];
    return {
      name: merchantName(home.name),
      at: home.i, from: home.i, to: home.i,
      coin: rr(500, 1600), cap: rr(14, 34),
      good: -1, qty: 0, paid: 0,
      pos: 0, len: 0, wait: ri(0, 12), trips: 0, profit: 0
    };
  }

  /* ================= news ================= */
  function say(text, tone) {
    W.news.unshift({ y: yearOf(T), text: text, tone: tone || '' });
    if (W.news.length > 40) W.news.pop();
  }
  function yearOf(d) { return 'Yr ' + (1 + Math.floor(d / 360)) + ', d' + (1 + (d % 360)); }

  /* ================= simulation ================= */
  function step() {
    T++;
    var i, g, t, G = W.G, N = W.N;

    /* effects that have run their course */
    for (i = W.effects.length - 1; i >= 0; i--) {
      if (T >= W.effects[i].until) {
        W.effects[i].undo();
        if (W.effects[i].over) say(W.effects[i].over, '');
        W.effects.splice(i, 1);
      }
    }

    /* production, consumption, spoilage, price */
    for (i = 0; i < N; i++) {
      t = W.towns[i];
      for (g = 0; g < G; g++) {
        var gd = W.goods[g];
        /* dear things get made harder and used more sparingly */
        var rel = t.price[g] / gd.base;
        var s = t.stock[g] + t.prod[g] * t.prodMul[g] * supplyPull(rel);
        var want = t.cons[g] * t.consMul[g] * demandPull(rel);
        s -= Math.min(s, want);
        s *= 1 - spoilOf(gd);
        t.stock[g] = s;

        var tgt = Math.max(1.5, want * 60);
        var p = gd.base * Math.pow(tgt / (s + tgt * 0.02), 0.45);
        p = clamp(p, gd.base * 0.33, gd.base * 3.4);
        t.price[g] += (p - t.price[g]) * 0.2;
      }
    }

    /* merchants */
    for (i = 0; i < W.merchants.length; i++) moveMerchant(W.merchants[i]);

    /* something happens */
    if (--W.nextEvent <= 0) { fireEvent(); W.nextEvent = ri(150, 420); }

    if (T % SAMPLE === 0) sample();
  }

  /* the best single load a merchant could pick up in a given town, judged on
     what it would fetch one road away less the cost of getting it there */
  function dealAt(ti, m) {
    var a = W.towns[ti], best = null, i, g;
    for (i = 0; i < a.adj.length; i++) {
      var link = a.adj[i];
      if (!link.e.open) continue;
      var b = W.towns[link.to], d = link.e.d;
      for (g = 0; g < W.G; g++) {
        var gd = W.goods[g];
        var buy = a.price[g] * 1.015;
        var sell = b.price[g] * 0.985 * (1 - toll);
        var net = sell - buy - d * FREIGHT * gd.bulk;
        if (net <= buy * 0.005) continue;
        var spare = a.stock[g] - a.cons[g] * a.consMul[g] * 5;
        if (spare < 1) continue;
        var qty = Math.floor(Math.min(m.cap / gd.bulk, m.coin / buy, spare * 0.5));
        if (qty < 1) continue;
        /* hauling a lot moves both prices against you — allow for that */
        var bite = 1 / (1 + (qty / Math.max(4, a.stock[g] * 0.5)) +
                            (qty / Math.max(4, b.stock[g] * 0.5)));
        var score = net * qty * (0.4 + 0.6 * bite) / (d + 3);
        if (!best || score > best.score) {
          best = { score: score, g: g, qty: qty, to: link.to, d: d, buy: buy };
        }
      }
    }
    return best;
  }

  function moveMerchant(m) {
    var i;
    if (m.len > 0) {                       // on the road
      m.pos += 0.75;
      if (m.pos < m.len) return;
      /* arrived */
      m.at = m.to; m.len = 0; m.pos = 0;
      var t = W.towns[m.at];
      if (m.qty > 0) {
        var g0 = m.good;
        var got = t.price[g0] * 0.985 * (1 - toll) * m.qty;
        t.stock[g0] += m.qty;
        m.coin += got;
        var gain = got - m.paid;
        m.profit += gain; m.trips++; trades++;
        if (gain > W.goods[g0].base * 6) {
          say('<b>' + m.name + '</b> clears ' + money(gain) + ' coin on ' +
              Math.round(m.qty) + ' of ' + W.goods[g0].n.toLowerCase() +
              ' into <b>' + t.name + '</b>.', 'good');
        } else if (gain < -W.goods[g0].base * 3) {
          say('<b>' + m.name + '</b> arrives in <b>' + t.name + '</b> to find the ' +
              W.goods[g0].n.toLowerCase() + ' market already full. Down ' +
              money(-gain) + ' coin.', 'bad');
        }
        m.qty = 0; m.good = -1; m.paid = 0;
      }
      m.wait = ri(0, 2);
      if (m.coin < 40) {
        var old = m.name;
        var nm = newMerchant(W.towns);
        for (var k in nm) if (Object.prototype.hasOwnProperty.call(nm, k)) m[k] = nm[k];
        m.coin = rr(260, 420);
        say('<b>' + old + '</b> is ruined and sells up. <b>' + m.name +
            '</b> takes over the route.', 'bad');
      }
      return;
    }

    if (m.wait > 0) { m.wait--; return; }
    if (embargo) { m.wait = 6; return; }

    /* is there anything here worth loading? */
    var a = W.towns[m.at];
    var best = dealAt(m.at, m);
    if (best) {
      a.stock[best.g] -= best.qty;
      m.paid = best.qty * best.buy;
      m.coin -= m.paid;
      m.good = best.g; m.qty = best.qty;
      m.from = m.at; m.to = best.to; m.len = best.d; m.pos = 0;
      return;
    }

    /* nothing here: go empty to whichever neighbour has something to sell,
       rather than sitting in a town that has run out of everything */
    var bt = -1, bv = 0;
    for (i = 0; i < a.adj.length; i++) {
      if (!a.adj[i].e.open) continue;
      var dd = dealAt(a.adj[i].to, m);
      if (!dd) continue;
      var v = dd.score / (1 + a.adj[i].e.d / 4);
      if (v > bv) { bv = v; bt = i; }
    }
    if (bt >= 0) {
      m.from = m.at; m.to = a.adj[bt].to; m.len = a.adj[bt].e.d;
      m.pos = 0; m.good = -1; m.qty = 0;
      return;
    }
    m.wait = ri(3, 10);
  }

  /* ================= events ================= */
  function fireEvent(forced) {
    var kinds = ['blight', 'seam', 'road', 'fashion', 'fire', 'fair', 'siege'];
    var kind = forced || pick(kinds);
    var t = W.towns[Math.floor(rand() * W.N)];
    var g = Math.floor(rand() * W.G), gd = W.goods[g], i;

    if (kind === 'blight') {
      var fg = -1;
      for (i = 0; i < W.G; i++) if (W.goods[i].kind === 'food' && t.prod[i] > 0) fg = i;
      if (fg < 0) return fireEvent('seam');
      var m1 = rr(0.1, 0.3);
      t.prodMul[fg] *= m1;
      W.effects.push({
        until: T + ri(200, 420),
        undo: function () { t.prodMul[fg] /= m1; },
        over: 'The harvest comes back in <b>' + t.name + '</b>.'
      });
      say('Blight in <b>' + t.name + '</b>. The ' + W.goods[fg].n.toLowerCase() +
          ' harvest fails.', 'bad');

    } else if (kind === 'seam') {
      var pg = -1;
      for (i = 0; i < W.G; i++) if (t.prod[i] > 0 && (pg < 0 || t.prod[i] > t.prod[pg])) pg = i;
      if (pg < 0) return;
      var m2 = rr(1.8, 2.8);
      t.prodMul[pg] *= m2;
      W.effects.push({
        until: T + ri(200, 400),
        undo: function () { t.prodMul[pg] /= m2; },
        over: 'The good years end in <b>' + t.name + '</b>.'
      });
      say('<b>' + t.name + '</b> has a run of good years. More ' +
          W.goods[pg].n.toLowerCase() + ' than anyone can shift.', 'good');

    } else if (kind === 'road') {
      var open = [];
      for (i = 0; i < W.edges.length; i++) if (W.edges[i].open) open.push(W.edges[i]);
      if (open.length < 2) return;
      var e = open[Math.floor(rand() * open.length)];
      e.open = false;
      var an = W.towns[e.a].name, bn = W.towns[e.b].name;
      W.effects.push({
        until: T + ri(140, 300),
        undo: function () { e.open = true; },
        over: 'The <b>' + an + '</b>–<b>' + bn + '</b> road is passable again.'
      });
      say('Floods take out the road between <b>' + an + '</b> and <b>' + bn + '</b>.', 'bad');

    } else if (kind === 'fashion') {
      var lg = -1;
      for (i = 0; i < W.G; i++) if (W.goods[i].kind === 'lux' || W.goods[i].kind === 'craft') {
        if (rand() < 0.5 || lg < 0) lg = i;
      }
      if (lg < 0) return;
      var m3 = rr(1.6, 2.3);
      for (i = 0; i < W.N; i++) W.towns[i].consMul[lg] *= m3;
      W.effects.push({
        until: T + ri(220, 460),
        undo: function () { for (var k = 0; k < W.N; k++) W.towns[k].consMul[lg] /= m3; },
        over: 'Nobody wants ' + W.goods[lg].n.toLowerCase() + ' any more.'
      });
      say('Everyone suddenly wants ' + W.goods[lg].n.toLowerCase() +
          '. Demand is up half again everywhere.', '');

    } else if (kind === 'fire') {
      var lost = t.stock[g] * rr(0.5, 0.85);
      t.stock[g] -= lost;
      say('Fire in the <b>' + t.name + '</b> warehouses. ' + Math.round(lost) +
          ' of ' + gd.n.toLowerCase() + ' gone.', 'bad');

    } else if (kind === 'fair') {
      var m4 = rr(1.4, 1.9);
      for (i = 0; i < W.G; i++) t.consMul[i] *= m4;
      var tn = t.name;
      W.effects.push({
        until: T + ri(90, 180),
        undo: function () { for (var k = 0; k < W.G; k++) t.consMul[k] /= m4; },
        over: 'The fair at <b>' + tn + '</b> packs up.'
      });
      say('<b>' + t.name + '</b> holds its great fair. The town will eat anything '
          + 'anyone brings.', 'good');

    } else if (kind === 'siege') {
      var closed = [];
      for (i = 0; i < t.adj.length; i++) if (t.adj[i].e.open) { t.adj[i].e.open = false; closed.push(t.adj[i].e); }
      if (!closed.length) return;
      var tn2 = t.name;
      W.effects.push({
        until: T + ri(120, 240),
        undo: function () { for (var k = 0; k < closed.length; k++) closed[k].open = true; },
        over: 'The blockade of <b>' + tn2 + '</b> is lifted.'
      });
      say('<b>' + t.name + '</b> is blockaded. No caravan goes in or out.', 'bad');
    }
    drawFeed();
  }

  /* ================= history ================= */
  function sample() {
    for (var g = 0; g < W.G; g++) {
      for (var i = 0; i < W.N; i++) W.hist[g][i][W.head] = W.towns[i].price[g];
    }
    W.head = (W.head + 1) % HN;
    if (W.count < HN) W.count++;
  }

  /* ================= drawing: map ================= */
  var map = document.getElementById('map');
  var mctx = map.getContext('2d');
  var chart = document.getElementById('chart');
  var cctx = chart.getContext('2d');
  var MW = 0, MH = 0, CW = 0, CH = 0, DPR = 1;

  function sizeCanvas(cv, ctx) {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, Math.round(w * DPR));
    cv.height = Math.max(1, Math.round(h * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return [w, h];
  }
  function resize() {
    var a = sizeCanvas(map, mctx); MW = a[0]; MH = a[1];
    var b = sizeCanvas(chart, cctx); CW = b[0]; CH = b[1];
  }

  function px(t) { return 44 + t.x * (MW - 88); }
  function py(t) { return 34 + t.y * (MH - 78); }

  function drawMap() {
    var i, j, t;
    mctx.clearRect(0, 0, MW, MH);

    /* roads */
    for (i = 0; i < W.edges.length; i++) {
      var e = W.edges[i], A = W.towns[e.a], B = W.towns[e.b];
      mctx.beginPath();
      mctx.moveTo(px(A), py(A));
      mctx.lineTo(px(B), py(B));
      if (e.open && !embargo) {
        mctx.strokeStyle = 'rgba(255,255,255,.13)';
        mctx.lineWidth = 1.6;
        mctx.setLineDash([]);
      } else {
        mctx.strokeStyle = 'rgba(255,138,91,.34)';
        mctx.lineWidth = 1.4;
        mctx.setLineDash([4, 6]);
      }
      mctx.stroke();
      mctx.setLineDash([]);
    }

    /* caravans */
    for (i = 0; i < W.merchants.length; i++) {
      var m = W.merchants[i];
      if (m.len <= 0) continue;
      var A2 = W.towns[m.from], B2 = W.towns[m.to];
      var f = clamp(m.pos / m.len, 0, 1);
      var x = px(A2) + (px(B2) - px(A2)) * f;
      var y = py(A2) + (py(B2) - py(A2)) * f;
      var col = m.good >= 0 ? W.goods[m.good].col : 'rgba(180,190,205,.5)';
      if (m.good >= 0) {
        mctx.beginPath();
        mctx.arc(x, y, 6.5, 0, Math.PI * 2);
        mctx.fillStyle = col;
        mctx.globalAlpha = 0.16;
        mctx.fill();
        mctx.globalAlpha = 1;
      }
      mctx.beginPath();
      mctx.arc(x, y, m.good >= 0 ? 3.2 : 2, 0, Math.PI * 2);
      mctx.fillStyle = col;
      mctx.fill();
    }

    /* towns */
    for (i = 0; i < W.N; i++) {
      t = W.towns[i];
      var r = clamp(5.5 + Math.pow(t.pop / 1000, 0.62) * 2.1, 6, 17);
      var X = px(t), Y = py(t);
      var sel = i === selTown;

      /* a ring in the colour of whatever it is deepest in */
      var topG = 0, topV = -1;
      for (j = 0; j < W.G; j++) {
        var v = t.stock[j] / Math.max(0.001, t.cons[j] * 60);
        if (v > topV) { topV = v; topG = j; }
      }
      mctx.beginPath();
      mctx.arc(X, Y, r + 5, 0, Math.PI * 2);
      mctx.strokeStyle = W.goods[topG].col;
      mctx.globalAlpha = 0.32;
      mctx.lineWidth = 2.2;
      mctx.stroke();
      mctx.globalAlpha = 1;

      mctx.beginPath();
      mctx.arc(X, Y, r, 0, Math.PI * 2);
      mctx.fillStyle = sel ? t.col : 'rgba(10,14,20,.92)';
      mctx.fill();
      mctx.strokeStyle = sel ? '#ffffff' : t.col;
      mctx.lineWidth = sel ? 2 : 1.5;
      mctx.stroke();

      mctx.font = '600 12px ui-monospace,Menlo,monospace';
      mctx.textAlign = 'center';
      mctx.fillStyle = sel ? '#ffffff' : '#c3ccdb';
      mctx.fillText(t.name, X, Y - r - 11);
      mctx.font = '10px ui-monospace,Menlo,monospace';
      mctx.fillStyle = 'rgba(139,151,171,.85)';
      mctx.fillText(t.terr, X, Y + r + 16);
    }

    if (embargo) {
      mctx.font = '600 12px ui-monospace,Menlo,monospace';
      mctx.textAlign = 'left';
      mctx.fillStyle = '#ff8a5b';
      mctx.fillText('ROADS CLOSED — NOBODY IS TRADING', 18, 24);
    }
  }

  /* ================= drawing: chart ================= */
  function drawChart() {
    cctx.clearRect(0, 0, CW, CH);
    var g = selGood, gd = W.goods[g];
    var padL = 52, padR = 14, padT = 14, padB = 22;
    var n = W.count;
    if (n < 2) return;

    var lo = 1e9, hi = -1e9, i, k, v;
    for (i = 0; i < W.N; i++) {
      var h = W.hist[g][i];
      for (k = 0; k < n; k++) {
        v = h[(W.head - n + k + HN * 2) % HN];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (gd.base < lo) lo = gd.base;
    if (gd.base > hi) hi = gd.base;
    var pad = (hi - lo) * 0.12 + 0.5;
    lo -= pad; hi += pad;
    if (hi - lo < 0.001) hi = lo + 1;

    function X(k) { return padL + (k / (n - 1)) * (CW - padL - padR); }
    function Y(val) { return padT + (1 - (val - lo) / (hi - lo)) * (CH - padT - padB); }

    /* grid */
    cctx.font = '10px ui-monospace,Menlo,monospace';
    cctx.textAlign = 'right';
    for (i = 0; i <= 4; i++) {
      var val = lo + (hi - lo) * (i / 4);
      var y = Y(val);
      cctx.beginPath();
      cctx.moveTo(padL, y); cctx.lineTo(CW - padR, y);
      cctx.strokeStyle = 'rgba(255,255,255,.05)';
      cctx.lineWidth = 1;
      cctx.stroke();
      cctx.fillStyle = 'rgba(139,151,171,.8)';
      cctx.fillText(money(val), padL - 8, y + 3.5);
    }

    /* what the thing is worth in the abstract */
    cctx.beginPath();
    cctx.moveTo(padL, Y(gd.base)); cctx.lineTo(CW - padR, Y(gd.base));
    cctx.setLineDash([5, 5]);
    cctx.strokeStyle = 'rgba(255,255,255,.28)';
    cctx.stroke();
    cctx.setLineDash([]);

    /* one line per town */
    for (i = 0; i < W.N; i++) {
      var hh = W.hist[g][i];
      cctx.beginPath();
      for (k = 0; k < n; k++) {
        v = hh[(W.head - n + k + HN * 2) % HN];
        if (k === 0) cctx.moveTo(X(k), Y(v)); else cctx.lineTo(X(k), Y(v));
      }
      cctx.strokeStyle = W.towns[i].col;
      cctx.globalAlpha = i === selTown ? 1 : 0.62;
      cctx.lineWidth = i === selTown ? 2.2 : 1.3;
      cctx.stroke();
      cctx.globalAlpha = 1;
    }
  }

  /* ================= panels ================= */
  function el(id) { return document.getElementById(id); }

  function buildChips() {
    var sp = el('speeds');
    sp.innerHTML = '';
    SPEEDS.forEach(function (s, i) {
      var b = document.createElement('button');
      b.className = 'chip' + (i === speed ? ' on' : '');
      b.textContent = s.n;
      b.addEventListener('click', function () {
        speed = i;
        [].forEach.call(sp.children, function (c, j) { c.className = 'chip' + (j === i ? ' on' : ''); });
      });
      sp.appendChild(b);
    });

    var gc = el('goods');
    gc.innerHTML = '';
    W.goods.forEach(function (gd, i) {
      var b = document.createElement('button');
      b.className = 'chip swatch' + (i === selGood ? ' on' : '');
      var sw = document.createElement('em');
      sw.style.background = gd.col;
      b.appendChild(sw);
      b.appendChild(document.createTextNode(gd.n));
      b.addEventListener('click', function () {
        selGood = i;
        [].forEach.call(gc.children, function (c, j) {
          c.className = 'chip swatch' + (j === i ? ' on' : '');
        });
      });
      gc.appendChild(b);
    });

    var lg = el('legend');
    lg.innerHTML = '';
    W.towns.forEach(function (t) {
      var s = document.createElement('span');
      var i2 = document.createElement('i');
      i2.style.background = t.col;
      s.appendChild(i2);
      s.appendChild(document.createTextNode(t.name));
      lg.appendChild(s);
    });
  }

  function drawTownCard() {
    var t = W.towns[selTown];
    var rows = '';
    for (var g = 0; g < W.G; g++) {
      var gd = W.goods[g];
      var rel = t.price[g] / gd.base;
      var net = t.prod[g] * t.prodMul[g] * supplyPull(rel) -
                t.cons[g] * t.consMul[g] * demandPull(rel);
      var cls = rel > 1.12 ? 'up' : rel < 0.9 ? 'down' : '';
      rows += '<tr><td><span class="gdot" style="background:' + gd.col + '"></span>' +
        gd.n + '</td>' +
        '<td>' + Math.round(t.stock[g]) + '</td>' +
        '<td class="' + cls + '">' + money(t.price[g]) + '</td>' +
        '<td class="' + (net >= 0 ? 'down' : 'up') + '">' +
        (net >= 0 ? '+' : '') + net.toFixed(2) + '</td></tr>';
    }
    el('townCard').innerHTML =
      '<h3>' + t.name + '</h3>' +
      '<p class="ex-sub">' + t.terr + ' · ' + t.pop.toLocaleString() +
      ' people · ' + t.adj.length + ' roads out</p>' +
      '<table class="ledger"><thead><tr><th>Good</th><th>In store</th>' +
      '<th>Price</th><th>Net/day</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function drawFeed() {
    var f = el('feed');
    var out = '';
    for (var i = 0; i < Math.min(W.news.length, 14); i++) {
      var n = W.news[i];
      out += '<li class="' + n.tone + '"><time>' + n.y + '</time>' + n.text + '</li>';
    }
    f.innerHTML = out;
  }

  function readout() {
    var moving = 0, i;
    for (i = 0; i < W.merchants.length; i++) if (W.merchants[i].len > 0) moving++;
    el('clockOut').textContent = yearOf(T);
    el('movingOut').textContent = moving + ' / ' + W.merchants.length;
    el('tradesOut').textContent = trades;
    el('merchOut').textContent = W.merchants.length;

    var g = selGood, lo = 1e9, hi = -1e9, sum = 0, loT = 0, hiT = 0;
    for (i = 0; i < W.N; i++) {
      var p = W.towns[i].price[g];
      sum += p;
      if (p < lo) { lo = p; loT = i; }
      if (p > hi) { hi = p; hiT = i; }
    }
    var gap = lo > 0 ? hi / lo : 1;
    var sEl = el('spreadOut');
    sEl.innerHTML = 'Dearest ÷ cheapest <b>×' + gap.toFixed(1) + '</b>';
    sEl.className = 'spread' + (gap > 2.6 ? ' wide' : '');
    el('cheapOut').textContent = W.towns[loT].name + ' ' + money(lo);
    el('dearOut').textContent = W.towns[hiT].name + ' ' + money(hi);
  }

  /* ================= loop ================= */
  var last = 0, acc = 0, uiAcc = 0, raf = null;
  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.25);
    last = ts;

    var rate = SPEEDS[speed].v;
    if (rate > 0) {
      acc += dt * rate;
      var budget = 0;
      while (acc >= 1 && budget < 90) { step(); acc -= 1; budget++; }
      if (acc > 4) acc = 0;
    }

    drawMap();
    drawChart();

    uiAcc += dt;
    if (uiAcc > 0.33) {
      uiAcc = 0;
      drawTownCard();
      drawFeed();
      readout();
    }
    raf = requestAnimationFrame(frame);
  }

  /* ================= events ================= */
  window.addEventListener('resize', function () { resize(); });

  map.addEventListener('click', function (e) {
    var r = map.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var best = -1, bd = 1e9;
    for (var i = 0; i < W.N; i++) {
      var t = W.towns[i];
      var dx = px(t) - x, dy = py(t) - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && bd < 34) { selTown = best; drawTownCard(); }
  });

  function wire(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', fn);
  }
  wire('btnEmbargo', function () {
    embargo = !embargo;
    this.textContent = embargo ? 'Open the roads' : 'Close the roads';
    say(embargo
      ? 'Every road is closed. Each town is on its own from here.'
      : 'The roads are open again. The merchants go back to work.',
      embargo ? 'bad' : 'good');
    drawFeed();
  });
  wire('btnShock', function () { fireEvent(); });
  wire('btnNew', function () { build((Math.random() * 4294967295) >>> 0); });
  wire('btnToday', function () { build(seedForToday()); });

  var tollEl = document.getElementById('toll');
  if (tollEl) {
    tollEl.addEventListener('input', function () {
      toll = (+this.value) / 100;
      document.getElementById('tollOut').textContent = this.value + '%';
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      speed = speed === 0 ? 2 : 0;
      buildChips();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  });

  /* ================= go ================= */
  resize();
  build(seedForToday());
  /* run a few seasons so the page does not open on a flat line */
  for (var w = 0; w < 260; w++) step();
  raf = requestAnimationFrame(frame);
})();
