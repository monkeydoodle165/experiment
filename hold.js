/* drift.quibo.games — The Hold
   Naval architecture. The day's number fits out a small Victorian merchant sailing ship,
   fills the quay beside her with a dozen or so lots of cargo bound for two or three ports
   and leaves you to stow them in her hold. Six bays, three tiers. The cargo for the first
   port has to come out first, wet goods must not sit over goods that have to stay dry,
   and nothing can float in mid-air. Underneath all that is Bouguer's metacentre: put the
   weight too high and she is tender and lies over in a squall; put it all at the bottom
   and she is stiff and snaps back so fast she shakes her own masts out. Too much weight
   forward and she will not steer. A small end-on view rolls live as you stow.
   When you sign the plan the page sails the voyage, unloads at each port, and shows the
   mate's own plan, found by annealing through the arrangements of the hold.
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
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function ftin(ft) { var neg = ft < 0; ft = Math.abs(ft); var f = Math.floor(ft), i = Math.round((ft - f) * 12); if (i === 12) { f++; i = 0; } return (neg ? '−' : '') + f + '′ ' + i + '″'; }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }

  /* ---------- the day's world ---------- */
  var NAMES = ['Margaret Ann', 'Hopewell', 'Brothers’ Pride', 'Elizabeth Jane', 'Good Intent', 'Ocean Bride', 'Lady Avon', 'Jessie Kerr', 'Providence', 'Mary Isabella', 'Harvest Home', 'Celtic Star', 'Kate Rowlands', 'Fanny Crossfield', 'Sarah Bell', 'Morning Star', 'Ellen Owens', 'Agnes Craig'];
  var RIGS = ['brig', 'brigantine', 'barquentine', 'topsail schooner', 'snow', 'barque'];
  var HOMES = ['Liverpool', 'Bristol', 'Glasgow', 'Hull', 'London', 'Cardiff', 'Leith', 'Newcastle', 'Swansea', 'Whitehaven'];
  var ROUTES = [
    ['Bordeaux', 'Bilbao', 'Oporto', 'Lisbon', 'Cadiz'],
    ['Gibraltar', 'Malaga', 'Marseilles', 'Genoa', 'Leghorn'],
    ['Hamburg', 'Copenhagen', 'Stettin', 'Danzig', 'Riga'],
    ['St John’s', 'Halifax', 'Saint John', 'Quebec'],
    ['Rouen', 'Nantes', 'La Rochelle', 'Corunna', 'Vigo']
  ];
  var MASTER = ['Captain Owen', 'Captain Pritchard', 'Captain Maclean', 'Captain Tregenza', 'Captain Robson', 'Captain Hughes', 'Captain Gilchrist', 'Captain Pengelly'];
  var HEAVY = [
    { n: 'pig iron', c: 'IRON', w: [36, 58] },
    { n: 'railway iron', c: 'RAIL', w: [32, 52] },
    { n: 'roofing slate', c: 'SLATE', w: [28, 46] },
    { n: 'machinery in cases', c: 'MACH', w: [24, 40] },
    { n: 'coal in bags', c: 'COAL', w: [22, 34] }
  ];
  var WET = [
    { n: 'herrings in brine', c: 'HERRING', w: [12, 20], wet: 1 },
    { n: 'linseed oil in casks', c: 'OIL', w: [14, 22], wet: 1 },
    { n: 'coal tar in barrels', c: 'TAR', w: [12, 20], wet: 1 },
    { n: 'Burton ale in hogsheads', c: 'ALE', w: [12, 22], wet: 1 }
  ];
  var DRY = [
    { n: 'tinplate in boxes', c: 'TIN', w: [22, 34], dry: 1 },
    { n: 'cement in casks', c: 'CEMENT', w: [18, 30], dry: 1 },
    { n: 'salt in bags', c: 'SALT', w: [16, 28], dry: 1 },
    { n: 'flour in barrels', c: 'FLOUR', w: [10, 18], dry: 1 },
    { n: 'cotton piece-goods', c: 'CLOTH', w: [6, 12], dry: 1 },
    { n: 'tea in chests', c: 'TEA', w: [5, 9], dry: 1 },
    { n: 'refined sugar', c: 'SUGAR', w: [10, 16], dry: 1 }
  ];
  var PLAIN = [
    { n: 'earthenware in crates', c: 'CROCK', w: [9, 16] },
    { n: 'firebricks', c: 'BRICK', w: [18, 28] },
    { n: 'rope and cordage', c: 'ROPE', w: [6, 12] }
  ];
  var BAYS = 6, TIERS = 3, CELLS = BAYS * TIERS;
  var TIERNAME = ['lower hold', 'upper hold', '’tween deck'];
  var PORTCOL = ['#ffce6a', '#7aa2ff', '#ff8fa3'];
  var TRIM_LO = 2, TRIM_HI = 18, TRIM_MID = 10, GM_MIN = 1.25, ROLL_MIN = 7.5;

  function xOf(b) { return -37.5 + 15 * b; }      // feet from midships, + forward
  function zOf(t) { return 4 + 5 * t; }           // feet above the keel
  function cellOf(b, t) { return b * TIERS + t; }

  /* ---------- physics ---------- */
  function physics(D, cells) {
    var W = D.W0, M = D.W0 * D.KG0, X = D.W0 * D.LCG0, aboard = 0;
    for (var i = 0; i < CELLS; i++) {
      var k = cells[i]; if (k < 0) continue;
      var w = D.lots[k].w, b = Math.floor(i / TIERS), t = i % TIERS;
      W += w; M += w * zOf(t); X += w * xOf(b); aboard++;
    }
    var KG = M / W, LCG = X / W, GM = D.KM - KG;
    var trim = (D.LCB - LCG) * D.tf;               // inches, + by the stern
    var draft = W * 35 / (0.68 * D.L * D.B);
    var roll = GM > 0.02 ? 0.44 * D.B / Math.sqrt(GM) : Infinity;
    return { W: W, KG: KG, LCG: LCG, GM: GM, trim: trim, draft: draft, fwd: draft - trim / 24, aft: draft + trim / 24, roll: roll, aboard: aboard };
  }
  function breaches(D, cells) {
    var out = { floating: [], buried: [], wet: [], unstowed: 0 };
    var seen = {};
    for (var i = 0; i < CELLS; i++) if (cells[i] >= 0) seen[cells[i]] = 1;
    for (var k = 0; k < D.lots.length; k++) if (!seen[k]) out.unstowed++;
    for (var b = 0; b < BAYS; b++) {
      for (var t = 1; t < TIERS; t++) if (cells[cellOf(b, t)] >= 0 && cells[cellOf(b, t - 1)] < 0) out.floating.push(cellOf(b, t));
      for (var lo = 0; lo < TIERS; lo++) {
        var a = cells[cellOf(b, lo)]; if (a < 0) continue;
        for (var hi = lo + 1; hi < TIERS; hi++) {
          var c = cells[cellOf(b, hi)]; if (c < 0) continue;
          if (D.lots[a].port < D.lots[c].port) out.buried.push([a, c]);
          if (D.lots[a].dry && D.lots[c].wet) out.wet.push([a, c]);
        }
      }
    }
    return out;
  }
  function gmMax(D) { var g = 0.44 * D.B / ROLL_MIN; return g * g; }
  function cost(D, cells) {
    var br = breaches(D, cells), p = physics(D, cells);
    var c = 1000 * (br.floating.length + br.buried.length + br.wet.length + br.unstowed);
    if (p.GM < GM_MIN) c += (GM_MIN - p.GM) * 400; else if (p.GM > D.gmMax) c += (p.GM - D.gmMax) * 400;
    c += Math.abs(p.GM - D.gmMid) * 12;
    if (p.trim < TRIM_LO) c += (TRIM_LO - p.trim) * 25; else if (p.trim > TRIM_HI) c += (p.trim - TRIM_HI) * 25;
    c += Math.abs(p.trim - TRIM_MID) * 1.2;
    return c;
  }
  function anneal(D, seed) {
    var r = rng(seed), best = null, bestC = Infinity;
    for (var run = 0; run < 6; run++) {
      var cells = []; for (var i = 0; i < CELLS; i++) cells.push(-1);
      var slots = shuffle(r, Array.apply(null, { length: CELLS }).map(function (_, j) { return j; }));
      for (var k = 0; k < D.lots.length; k++) cells[slots[k]] = k;
      var cur = cost(D, cells), N = 22000;
      for (var it = 0; it < N; it++) {
        var T = 300 * Math.pow(0.0004, it / N);
        var a = Math.floor(r() * CELLS), b = Math.floor(r() * CELLS);
        if (a === b || (cells[a] < 0 && cells[b] < 0)) continue;
        var tmp = cells[a]; cells[a] = cells[b]; cells[b] = tmp;
        var nc = cost(D, cells);
        if (nc <= cur || r() < Math.exp((cur - nc) / T)) cur = nc;
        else { tmp = cells[a]; cells[a] = cells[b]; cells[b] = tmp; }
        if (cur < bestC) { bestC = cur; best = cells.slice(); }
      }
    }
    return { cells: best, cost: bestC };
  }
  function passes(D, cells) {
    var br = breaches(D, cells), p = physics(D, cells);
    return {
      stowed: br.unstowed === 0, floating: br.floating.length === 0, buried: br.buried.length === 0, wet: br.wet.length === 0,
      tender: p.GM >= GM_MIN, stiff: p.GM <= D.gmMax, trim: p.trim >= TRIM_LO && p.trim <= TRIM_HI, br: br, p: p
    };
  }
  function allPass(q) { return q.stowed && q.floating && q.buried && q.wet && q.tender && q.stiff && q.trim; }

  /* ---------- the day ---------- */
  function draw1(r, list) { var g = pick(r, list); return { n: g.n, c: g.c, w: Math.round(g.w[0] + r() * (g.w[1] - g.w[0])), wet: !!g.wet, dry: !!g.dry }; }
  function attempt(seed) {
    var r = rng(seed), D = { seed: seed };
    D.name = pick(r, NAMES); D.rig = pick(r, RIGS); D.home = pick(r, HOMES); D.master = pick(r, MASTER);
    D.year = 1856 + Math.floor(r() * 49);
    var route = pick(r, ROUTES), k = r() < 0.55 ? 2 : 3;
    var idx = shuffle(r, route.map(function (_, i) { return i; })).slice(0, k).sort(function (a, b) { return a - b; });
    D.ports = idx.map(function (i) { return route[i]; });
    D.L = 116 + Math.floor(r() * 28); D.B = 25 + Math.floor(r() * 6) + (r() < 0.5 ? 0.5 : 0);
    D.tf = 13.3 * 130 / D.L;
    D.W0 = 170 + Math.floor(r() * 60); D.KG0 = 11 + r() * 1.2;
    D.LCB = -(0.8 + r() * 1.4); D.LCG0 = D.LCB - (1.2 + r() * 1.6);
    var n = 13 + Math.floor(r() * 3), lots = [];
    var nh = 3 + Math.floor(r() * 2), nw = 2 + Math.floor(r() * 2), nd = 3 + Math.floor(r() * 2);
    for (var i = 0; i < nh; i++) lots.push(draw1(r, HEAVY));
    for (i = 0; i < nw; i++) lots.push(draw1(r, WET));
    for (i = 0; i < nd; i++) lots.push(draw1(r, DRY));
    while (lots.length < n) lots.push(draw1(r, r() < 0.5 ? PLAIN : DRY));
    // heavies go round the ports starting with the first, so the first port always has something heavy to bury
    var p0 = 0;
    lots.forEach(function (L, j) { L.port = j < nh ? (p0++ % k) : Math.floor(r() * k); });
    for (var p = 0; p < k; p++) {
      var have = lots.filter(function (L) { return L.port === p; }).length;
      while (have < 3) { var v = lots[nh + Math.floor(r() * (lots.length - nh))]; var cnt = lots.filter(function (L) { return L.port === v.port; }).length; if (v.port !== p && cnt > 3) { v.port = p; have++; } else if (r() < 0.02) break; }
    }
    lots.sort(function (a, b) { return a.port - b.port || b.w - a.w; });
    D.lots = lots;
    D.cargo = lots.reduce(function (s, L) { return s + L.w; }, 0);
    // calibrate the metacentre so that "everything heavy at the bottom" is too stiff
    var ws = lots.map(function (L) { return L.w; }).sort(function (a, b) { return b - a; });
    function kgFill(order) { var m = D.W0 * D.KG0, w = D.W0; order.forEach(function (x, j) { m += x * zOf(Math.floor(j / BAYS)); w += x; }); return m / w; }
    var kgLo = kgFill(ws), kgHi = kgFill(ws.slice().reverse());
    D.gmMax = gmMax(D); D.gmMid = (GM_MIN + D.gmMax) / 2;
    var kgTarget = kgLo + (kgHi - kgLo) * (0.4 + r() * 0.14);
    D.KM = Math.round((kgTarget + D.gmMid) * 100) / 100;
    return D;
  }
  function build(seed) {
    var best = null;
    for (var a = 0; a < 30; a++) {
      var D = attempt(mix(seed, a));
      var m = anneal(D, mix(seed, 1000 + a));
      D.mate = m.cells;
      var q = passes(D, m.cells);
      var stiffNaive = physics(D, naive(D)).GM > D.gmMax;
      if (allPass(q) && stiffNaive) return D;
      if (allPass(q) && !best) best = D;
    }
    return best || D;
  }
  // the obvious plan: heaviest lots in the lower hold
  function naive(D) {
    var order = D.lots.map(function (_, k) { return k; }).sort(function (a, b) { return D.lots[b].w - D.lots[a].w; });
    var cells = []; for (var i = 0; i < CELLS; i++) cells.push(-1);
    order.forEach(function (k, j) { var t = Math.floor(j / BAYS), b = j % BAYS; cells[cellOf(b, t)] = k; });
    return cells;
  }

  /* ---------- state ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var dayOff = 0, D = null, st = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fresh() { var c = []; for (var i = 0; i < CELLS; i++) c.push(-1); return { cells: c, sel: -1, done: false, showMate: false }; }
  function shown() { return st.showMate ? D.mate : st.cells; }
  function cellIndexOfLot(cells, k) { for (var i = 0; i < CELLS; i++) if (cells[i] === k) return i; return -1; }

  function load() {
    var d = dateFor(dayOff);
    D = build(seedForDate(d));
    D.date = d;
    st = fresh();
    $('dayOut').textContent = longDate(d) + (dayOff === 0 ? ' (today)' : '');
    $('plWho').textContent = 'The ' + D.rig + ' ' + D.name + ' of ' + D.home + ', ' + D.year;
    $('plName').textContent = D.cargo + ' tons on the quay for ' + D.ports.join(D.ports.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1');
    $('plBlurb').innerHTML = esc(D.master) + ' sails on the morning tide and has left the stowage to you. She is <b>' + D.L + ' feet</b> between perpendiculars and <b>' + D.B + ' feet</b> in the beam, ' +
      D.W0 + ' tons light, and her builder’s book puts her metacentre <b>' + ftin(D.KM) + '</b> above the keel at her loaded draught. ' +
      numw(D.lots.length).replace(/^./, function (c) { return c.toUpperCase(); }) + ' lots for ' + numw(D.ports.length) + ' ports, in the order she will call. ' +
      'The owners want at least <b>' + GM_MIN + ' feet</b> of metacentric height, a roll no quicker than <b>' + ROLL_MIN + ' seconds</b> (a GM of ' + f2(D.gmMax) + ' feet or less in this beam), and between ' + TRIM_LO + ' and ' + TRIM_HI + ' inches by the stern.';
    renderAll();
  }

  /* ---------- rendering: plan, quay, readouts ---------- */
  function lotLabel(L) { return L.c + ' ' + L.w + 't'; }
  function renderPlan() {
    var cells = shown(), q = passes(D, cells), bad = {};
    q.br.floating.forEach(function (i) { bad[i] = 'floats over an empty space'; });
    q.br.buried.forEach(function (pr) { var i = cellIndexOfLot(cells, pr[0]); bad[i] = (bad[i] ? bad[i] + '; ' : '') + 'buried under ' + D.ports[D.lots[pr[1]].port] + ' cargo'; });
    q.br.wet.forEach(function (pr) { var i = cellIndexOfLot(cells, pr[0]); bad[i] = (bad[i] ? bad[i] + '; ' : '') + 'under wet goods'; });
    var html = '';
    for (var t = TIERS - 1; t >= 0; t--) {
      html += '<div class="tier-lab">' + TIERNAME[t] + '</div>';
      for (var b = 0; b < BAYS; b++) {
        var i = cellOf(b, t), k = cells[i], cls = 'cell', inner = '', title = TIERNAME[t] + ', bay ' + (b + 1) + ' from aft';
        if (k >= 0) {
          var L = D.lots[k];
          cls += ' full p' + L.port + (st.sel === k && !st.showMate ? ' sel' : '') + (bad[i] ? ' bad' : '');
          inner = '<b>' + esc(L.c) + '</b><span>' + L.w + ' t</span>' + (L.wet ? '<i class="tg wet">wet</i>' : L.dry ? '<i class="tg dry">dry</i>' : '');
          title += ': ' + L.w + ' tons of ' + L.n + ' for ' + D.ports[L.port] + (bad[i] ? ' (' + bad[i] + ')' : '');
        } else { inner = '<span class="em">·</span>'; title += ': empty'; }
        html += '<button type="button" class="' + cls + '" data-i="' + i + '" title="' + esc(title) + '" aria-label="' + esc(title) + '"' + (st.done || st.showMate ? ' disabled' : '') + '>' + inner + '</button>';
      }
    }
    html += '<div></div>';
    for (b = 0; b < BAYS; b++) html += '<div class="bay-lab">' + (b === 0 ? '← aft ' : '') + (b + 1) + (b === BAYS - 1 ? ' fore →' : '') + '</div>';
    $('plan').innerHTML = html;
    Array.prototype.forEach.call($('plan').querySelectorAll('button.cell'), function (el) { el.onclick = function () { tapCell(+el.getAttribute('data-i')); }; });
  }
  function renderQuay() {
    var cells = st.cells, html = '';
    D.ports.forEach(function (port, p) {
      html += '<div class="qrow"><span class="qport" style="color:' + PORTCOL[p] + '">' + (p + 1) + '. ' + esc(port) + '</span><div class="qlots">';
      D.lots.forEach(function (L, k) {
        if (L.port !== p) return;
        var on = cellIndexOfLot(cells, k) >= 0;
        html += '<button type="button" class="lot p' + p + (on ? ' aboard' : '') + (st.sel === k ? ' sel' : '') + '" data-k="' + k + '"' + (st.done ? ' disabled' : '') + '>' +
          '<b>' + L.w + ' t</b> ' + esc(L.n) + (L.wet ? ' <i class="tg wet">wet</i>' : L.dry ? ' <i class="tg dry">keep dry</i>' : '') + (on ? ' <i class="tg">aboard</i>' : '') + '</button>';
      });
      html += '</div></div>';
    });
    $('quay').innerHTML = html;
    Array.prototype.forEach.call($('quay').querySelectorAll('button.lot'), function (el) { el.onclick = function () { tapLot(+el.getAttribute('data-k')); }; });
    var left = D.lots.length - physics(D, cells).aboard;
    $('quayLeft').textContent = left ? numw(left).replace(/^./, function (c) { return c.toUpperCase(); }) + ' lot' + (left === 1 ? '' : 's') + ' still on the quay.' : 'Everything is aboard.';
    $('btnQuay').disabled = st.done || st.sel < 0 || cellIndexOfLot(cells, st.sel) < 0;
  }
  function row(ok, label, val) { return '<li class="' + (ok === null ? 'na' : ok ? 'ok' : 'no') + '"><span class="mk">' + (ok === null ? '–' : ok ? '✓' : '✗') + '</span><span class="lb">' + label + '</span><span class="vl">' + val + '</span></li>'; }
  function renderReadouts() {
    var cells = shown(), q = passes(D, cells), p = q.p, part = !q.stowed;
    var html = '<li class="hd"><span></span><span class="lb">' + (st.showMate ? 'The mate’s plan' : part ? 'With what is aboard so far' : 'As stowed') + '</span><span></span></li>';
    html += row(null, 'Displacement', Math.round(p.W) + ' tons');
    html += row(null, 'Draught forward / aft', ftin(p.fwd) + ' / ' + ftin(p.aft));
    html += row(null, 'Centre of gravity KG', ftin(p.KG));
    html += row(null, 'Metacentre KM', ftin(D.KM));
    html += row(part ? null : q.tender && q.stiff, 'Metacentric height GM', (p.GM < 0 ? '−' : '') + f2(Math.abs(p.GM)) + ' ft');
    html += row(part ? null : q.stiff && q.tender, 'Roll period', isFinite(p.roll) ? p.roll.toFixed(1) + ' s' : 'she will not stand up');
    html += row(part ? null : q.trim, 'Trim', Math.abs(p.trim) < 0.5 ? 'on an even keel' : Math.round(Math.abs(p.trim)) + ' in by the ' + (p.trim > 0 ? 'stern' : 'head'));
    $('readouts').innerHTML = html;
    var rules = '';
    rules += row(q.stowed, 'Every lot aboard', q.stowed ? 'yes' : q.br.unstowed + ' left');
    rules += row(q.floating, 'Nothing stowed over an empty space', q.floating ? 'yes' : q.br.floating.length + ' lot' + (q.br.floating.length > 1 ? 's' : ''));
    rules += row(q.buried, 'Each port’s cargo on top of later ports’', q.buried ? 'yes' : q.br.buried.length + ' buried');
    rules += row(q.wet, 'No wet goods above dry goods', q.wet ? 'yes' : q.br.wet.length + ' at risk');
    rules += row(part ? null : q.tender, 'GM at least ' + GM_MIN + ' ft', part ? '' : q.tender ? 'yes' : 'tender');
    rules += row(part ? null : q.stiff, 'Roll no quicker than ' + ROLL_MIN + ' s', part ? '' : q.stiff ? 'yes' : 'stiff');
    rules += row(part ? null : q.trim, TRIM_LO + '–' + TRIM_HI + ' in by the stern', part ? '' : q.trim ? 'yes' : p.trim < TRIM_LO ? 'too little' : 'too much');
    $('rules').innerHTML = rules;
  }
  function renderControls() {
    $('btnSign').disabled = st.done;
    $('btnClear').disabled = st.done;
    $('btnMate').hidden = !st.done;
    $('btnMate').textContent = st.showMate ? 'Show your plan' : 'Show the mate’s plan';
  }
  function say(h) { $('msg').innerHTML = h; }

  /* ---------- interaction ---------- */
  function tapLot(k) {
    if (st.done) return;
    st.sel = st.sel === k ? -1 : k;
    say(st.sel >= 0 ? 'Now tap a space in the plan for the <b>' + D.lots[k].w + ' tons of ' + esc(D.lots[k].n) + '</b>.' : '');
    renderAll();
  }
  function tapCell(i) {
    if (st.done || st.showMate) return;
    var c = st.cells, here = c[i];
    if (st.sel < 0) { if (here >= 0) { st.sel = here; say('Tap another space to move the <b>' + esc(D.lots[here].n) + '</b>, or send it back to the quay.'); } renderAll(); return; }
    var k = st.sel, from = cellIndexOfLot(c, k);
    if (here === k) { st.sel = -1; say(''); renderAll(); return; }
    if (from >= 0) c[from] = here; // swap (or leave empty)
    c[i] = k;
    st.sel = -1; say('');
    renderAll();
  }
  function toQuay() {
    if (st.sel < 0 || st.done) return;
    var i = cellIndexOfLot(st.cells, st.sel); if (i >= 0) st.cells[i] = -1;
    st.sel = -1; say(''); renderAll();
  }
  function sign() {
    var q = passes(D, st.cells);
    if (!q.stowed) { say('There is still cargo on the quay. The master will not sail without all of it.'); return; }
    st.done = true; st.sel = -1; say('');
    renderAll();
    renderVerdict();
  }

  /* ---------- verdict: the voyage ---------- */
  function renderVerdict() {
    var V = $('verdict');
    if (!st.done) { V.innerHTML = ''; V.className = 'verdict'; return; }
    var q = passes(D, st.cells), p = q.p, m = passes(D, D.mate), mp = m.p;
    var score = [q.floating, q.buried, q.wet, q.tender, q.stiff, q.trim].filter(Boolean).length;
    V.className = 'verdict ' + (score === 6 ? 'good' : 'warn');
    var h = '<b>' + (score === 6 ? 'The surveyor signs it.' : score >= 4 ? 'The surveyor signs it, with a note in the margin.' : 'The surveyor signs it, shaking his head.') + '</b> ' + score + ' of six conditions met.<br><br>';
    h += '<b>Outward bound.</b> ';
    if (p.GM <= 0) h += 'She came off the quay with a list she would not lose, and in the first squall in the Channel she lay over on her beam ends and hung there while the crew shifted cargo by hand in the dark. With G above M she has nothing to bring her back.';
    else if (p.GM < GM_MIN) h += 'She was tender. Every gust laid her over and she came back slowly, about once every ' + p.roll.toFixed(0) + ' seconds; the master took in sail early and lost two days doing it. A ship like this one is a gust and a shifted lot away from capsizing.';
    else if (p.GM > D.gmMax) h += 'She was stiff. In the swell off the land she snapped back every ' + p.roll.toFixed(1) + ' seconds, so hard that the fore-topmast backstays parted and the cook was thrown across the galley. Too much weight too low makes a ship safe and miserable, and the rigging pays for it.';
    else h += 'She was easy in a seaway, rolling once every ' + p.roll.toFixed(1) + ' seconds and coming back without fuss. That is what the GM was for.';
    h += ' ';
    if (p.trim < 0) h += 'Down by the head, she griped, buried her bow in every sea and needed two men at the wheel.';
    else if (p.trim < TRIM_LO) h += 'On a near-even keel she steered a little wild; sailing ships like a few inches by the stern.';
    else if (p.trim > TRIM_HI) h += 'Too far down by the stern, she dragged her quarter, made leeway and was slow to answer the helm.';
    else h += 'With ' + Math.round(p.trim) + ' inches by the stern she held her course and steered small.';
    h += '<br><br>';
    D.ports.forEach(function (port, pi) {
      var over = q.br.buried.filter(function (pr) { return D.lots[pr[0]].port === pi; });
      var soaked = q.br.wet.filter(function (pr) { return D.lots[pr[0]].port === pi; });
      h += '<b>At ' + esc(port) + '.</b> ';
      if (!over.length) h += 'Her ' + port + ' cargo came straight out of the hatches. ';
      else {
        var blockers = {}; over.forEach(function (pr) { blockers[pr[1]] = 1; });
        var nb = Object.keys(blockers).length;
        h += 'The stevedores had to lift ' + numw(nb) + ' lot' + (nb > 1 ? 's' : '') + ' meant for later ports out of the way to reach her cargo and stow ' + (nb > 1 ? 'them' : 'it') + ' again: ' + numw(Math.min(6, nb + 1)) + ' days’ demurrage. ';
      }
      if (soaked.length) {
        var seenL = {}; soaked.forEach(function (pr) { if (!seenL[pr[0]]) { seenL[pr[0]] = 1; var a = D.lots[pr[0]], b = D.lots[pr[1]]; h += 'The ' + a.w + ' tons of ' + esc(a.n) + ' came out stained from the ' + esc(b.n) + ' above it, and the consignee lodged a claim. '; } });
      }
      h += '<br>';
    });
    h += '<br><b>The mate’s plan</b> (found by annealing through some hundred thousand rearrangements of the hold): GM ' + f2(mp.GM) + ' ft, rolling every ' + mp.roll.toFixed(1) + ' s, ' + Math.round(mp.trim) + ' in by the stern. ';
    h += 'Yours: GM ' + f2(p.GM) + ' ft, ' + (isFinite(p.roll) ? 'rolling every ' + p.roll.toFixed(1) + ' s' : 'no roll at all, only a list') + ', ' + (p.trim >= 0 ? Math.round(p.trim) + ' in by the stern' : Math.round(-p.trim) + ' in by the head') + '. ';
    var nv = physics(D, naive(D));
    if (Math.abs(nv.GM - p.GM) > 0.005) h += 'For comparison, putting the heaviest lots in the lower hold and ignoring the ports would have given a GM of ' + f2(nv.GM) + ' ft and a roll every ' + nv.roll.toFixed(1) + ' s: that is the trap in today’s cargo.';
    V.innerHTML = h;
  }

  /* ---------- canvases ---------- */
  var cvP = $('profile'), gP = cvP.getContext('2d'), cvR = $('roll'), gR = cvR.getContext('2d');
  var dpr = 1, raf = 0, t0 = performance.now();
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    [cvP, cvR].forEach(function (cv) { var w = cv.clientWidth || 600, h = Math.round(w * (+cv.getAttribute('height')) / (+cv.getAttribute('width'))); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); });
    frame(performance.now());
  }
  function hullPts(D) {
    var L = D.L, H = 17, pts = [];
    pts.push([-L / 2 - 6, H + 1.6]);           // taffrail
    pts.push([-L / 2 - 3, H - 3]);             // counter
    pts.push([-L / 2, 6]);                     // sternpost
    pts.push([-L / 2 + 2, 0]);
    pts.push([L / 2 - 14, 0]);                 // keel to forefoot
    for (var a = 0; a <= 10; a++) { var u = a / 10; pts.push([L / 2 - 14 + 14 * Math.sin(u * Math.PI / 2) + u * u * 6, u * (H + 2.2)]); }
    pts.push([L / 2 + 6, H + 2.4]);
    // sheer, back aft
    for (a = 10; a >= 0; a--) { var x = -L / 2 - 6 + (L + 12) * a / 10, s = 0.0007 * x * x; pts.push([x, H + s]); }
    return pts;
  }
  function frame(now) {
    if (!D) return;
    var cells = shown(), p = physics(D, cells);
    drawProfile(cells, p);
    drawRoll(p, now);
  }
  function drawProfile(cells, p) {
    var W = cvP.width, H = cvP.height, g = gP;
    g.setTransform(1, 0, 0, 1, 0, 0);
    var sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0b1220'); sky.addColorStop(1, '#101a2a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    var s = W / (D.L + 34), wl = H * 0.66, cx = W / 2;
    var ang = -Math.atan2(p.trim / 12, D.L) * 5; // exaggerated five times; stern (left) down for + trim
    g.save();
    g.translate(cx, wl);
    g.rotate(ang);
    g.translate(0, p.draft * s);                 // keel line sits draft below the waterline
    function P(x, z) { return [x * s, -z * s]; }
    // masts
    var masts = D.rig === 'topsail schooner' || D.rig === 'brigantine' || D.rig === 'brig' || D.rig === 'snow' ? [0.22, -0.18] : [0.26, -0.02, -0.28];
    g.strokeStyle = 'rgba(200,190,170,.55)'; g.lineWidth = Math.max(1, 2 * dpr);
    masts.forEach(function (f) { var a = P(f * D.L, 17), b = P(f * D.L, 17 + D.L * 0.55); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
    var bs0 = P(D.L / 2 + 4, 19.5), bs1 = P(D.L / 2 + 26, 25);
    g.beginPath(); g.moveTo(bs0[0], bs0[1]); g.lineTo(bs1[0], bs1[1]); g.stroke();
    // hull
    var hp = hullPts(D);
    g.beginPath(); hp.forEach(function (pt, i) { var q = P(pt[0], pt[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath();
    g.fillStyle = '#2a2219'; g.fill();
    g.strokeStyle = 'rgba(255,230,190,.35)'; g.lineWidth = 1.2 * dpr; g.stroke();
    // hold
    for (var b = 0; b < BAYS; b++) for (var t = 0; t < TIERS; t++) {
      var i = cellOf(b, t), k = cells[i];
      var a0 = P(xOf(b) - 7.5, zOf(t) - 2.5), a1 = P(xOf(b) + 7.5, zOf(t) + 2.5);
      var x0 = a0[0] + 1, y0 = a1[1] + 1, w = a1[0] - a0[0] - 2, h = a0[1] - a1[1] - 2;
      if (k >= 0) {
        var L = D.lots[k];
        g.globalAlpha = 0.35 + 0.6 * Math.min(1, L.w / 50);
        g.fillStyle = PORTCOL[L.port]; g.fillRect(x0, y0, w, h);
        g.globalAlpha = 1;
        if (L.wet) { g.fillStyle = 'rgba(120,200,255,.9)'; g.fillRect(x0, y0 + h - 3 * dpr, w, 3 * dpr); }
        if (h > 14 * dpr) { g.fillStyle = '#0b0f16'; g.font = '600 ' + Math.round(Math.min(11 * dpr, h * 0.42)) + 'px ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L.c, x0 + w / 2, y0 + h / 2); }
      } else { g.strokeStyle = 'rgba(255,255,255,.08)'; g.strokeRect(x0, y0, w, h); }
      if (!st.showMate && st.sel >= 0 && k === st.sel) { g.strokeStyle = '#64f0c8'; g.lineWidth = 2 * dpr; g.strokeRect(x0, y0, w, h); }
    }
    // G and B on the keel line
    function mark(x, label, col, dx) {
      var q = P(x, -1.2); g.fillStyle = col; g.beginPath(); g.moveTo(q[0], q[1] - 6 * dpr); g.lineTo(q[0] - 5 * dpr, q[1] + 3 * dpr); g.lineTo(q[0] + 5 * dpr, q[1] + 3 * dpr); g.closePath(); g.fill();
      g.font = '600 ' + Math.round(10 * dpr) + 'px ui-monospace,Menlo,monospace'; g.textAlign = dx < 0 ? 'right' : 'left'; g.textBaseline = 'top'; g.fillText(label, q[0] + dx * dpr, q[1] + 5 * dpr);
    }
    g.restore();
    // sea in front
    g.fillStyle = 'rgba(20,60,80,.55)'; g.fillRect(0, wl, W, H - wl);
    g.strokeStyle = 'rgba(100,240,200,.6)'; g.lineWidth = 1.2 * dpr; g.beginPath(); g.moveTo(0, wl); g.lineTo(W, wl); g.stroke();
    // centres, drawn in the sea frame
    g.save(); g.translate(cx, wl); g.rotate(ang); g.translate(0, p.draft * s);
    mark(D.LCB, 'B', '#64f0c8', -3); mark(p.LCG, 'G', '#ffce6a', 3);
    g.restore();
    g.fillStyle = '#8b97ab'; g.font = '600 ' + Math.round(10 * dpr) + 'px ui-monospace,Menlo,monospace'; g.textBaseline = 'alphabetic';
    g.textAlign = 'left'; g.fillText('AFT ' + ftin(p.aft), 8 * dpr, H - 8 * dpr);
    g.textAlign = 'right'; g.fillText(ftin(p.fwd) + ' FWD', W - 8 * dpr, H - 8 * dpr);
    g.textAlign = 'center'; g.fillText('trim drawn five times over', W / 2, H - 8 * dpr);
  }
  function drawRoll(p, now) {
    var W = cvR.width, H = cvR.height, g = gR;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H);
    var tt = (now - t0) / 1000, s = Math.min(W / (D.B * 2.1), H / 52), cx = W / 2, wl = H * 0.62;
    var phi;
    if (p.GM > 0.02) { phi = (12 * Math.PI / 180) * (reduce ? 0.6 : Math.sin(2 * Math.PI * tt / p.roll)); }
    else { var BM = D.B * D.B / (12 * p.draft); var loll = Math.min(0.6, Math.sqrt(2 * Math.max(0.05, -p.GM) / BM)); phi = loll + (reduce ? 0 : 0.03 * Math.sin(2 * Math.PI * tt / 14)); }
    g.save(); g.translate(cx, wl); g.rotate(phi); g.translate(0, p.draft * s);
    function P(y, z) { return [y * s, -z * s]; }
    var hb = D.B / 2;
    // mast
    g.strokeStyle = 'rgba(200,190,170,.55)'; g.lineWidth = 2 * dpr;
    var m0 = P(0, 17), m1 = P(0, 46); g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
    var y0 = P(-hb * 1.3, 38), y1 = P(hb * 1.3, 38); g.beginPath(); g.moveTo(y0[0], y0[1]); g.lineTo(y1[0], y1[1]); g.stroke();
    // hull section
    g.beginPath();
    var c0 = P(-hb, 17.5), c1 = P(-hb * 0.98, 5), c2 = P(-hb * 0.95, 0.4), c3 = P(-hb + 6, 0), c4 = P(hb - 6, 0), c5 = P(hb * 0.95, 0.4), c6 = P(hb * 0.98, 5), c7 = P(hb, 17.5);
    g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.quadraticCurveTo(c2[0], c2[1], c3[0], c3[1]); g.lineTo(c4[0], c4[1]); g.quadraticCurveTo(c5[0], c5[1], c6[0], c6[1]); g.lineTo(c7[0], c7[1]); g.closePath();
    g.fillStyle = '#2a2219'; g.fill(); g.strokeStyle = 'rgba(255,230,190,.35)'; g.lineWidth = 1.2 * dpr; g.stroke();
    // G and M on the centreline
    var G = P(0, p.KG), M = P(0, D.KM);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([3 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(G[0], G[1]); g.lineTo(M[0], M[1]); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffce6a'; g.beginPath(); g.arc(G[0], G[1], 4 * dpr, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#64f0c8'; g.beginPath(); g.arc(M[0], M[1], 4 * dpr, 0, Math.PI * 2); g.fill();
    g.font = '600 ' + Math.round(10 * dpr) + 'px ui-monospace,Menlo,monospace'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = '#ffce6a'; g.fillText('G', G[0] + 7 * dpr, G[1] + (p.GM >= 0 ? 4 : -4) * dpr);
    g.fillStyle = '#64f0c8'; g.fillText('M', M[0] + 7 * dpr, M[1] - (p.GM >= 0 ? 4 : -4) * dpr);
    g.restore();
    // sea
    g.fillStyle = 'rgba(20,60,80,.6)';
    g.beginPath(); g.moveTo(0, H);
    for (var x = 0; x <= W; x += 6 * dpr) g.lineTo(x, wl + Math.sin(x / (40 * dpr) - (reduce ? 0 : tt * 1.3)) * 3 * dpr);
    g.lineTo(W, H); g.closePath(); g.fill();
    g.fillStyle = '#8b97ab'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = '600 ' + Math.round(10 * dpr) + 'px ui-monospace,Menlo,monospace';
    g.fillText(p.GM > 0.02 ? 'rolling every ' + p.roll.toFixed(1) + ' s' : 'lolling: G is above M', W / 2, H - 8 * dpr);
  }
  function loop(now) { frame(now); raf = requestAnimationFrame(loop); }

  function renderAll() { renderPlan(); renderQuay(); renderReadouts(); renderControls(); renderVerdict(); frame(performance.now()); }

  /* ---------- wiring ---------- */
  function wire() {
    $('btnSign').onclick = sign;
    $('btnQuay').onclick = toQuay;
    $('btnClear').onclick = function () { if (st.done) return; st = fresh(); say(''); renderAll(); };
    $('btnReset').onclick = function () { st = fresh(); say(''); renderAll(); };
    $('btnMate').onclick = function () { st.showMate = !st.showMate; renderAll(); };
    $('btnDayPrev').onclick = function () { dayOff--; load(); };
    $('btnDayNext').onclick = function () { dayOff++; load(); };
    $('btnDayToday').onclick = function () { dayOff = 0; load(); };
    document.addEventListener('keydown', function (e) {
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { dayOff--; load(); }
      else if (e.key === 'ArrowRight') { dayOff++; load(); }
      else if (e.key === 'Escape') { st.sel = -1; say(''); renderAll(); }
    });
    window.addEventListener('resize', resize);
  }

  // exposed for testing in a console; harmless otherwise
  window.__hold = { build: build, physics: physics, passes: passes, naive: naive, seedForDate: seedForDate };

  wire();
  load();
  resize();
  if (!reduce) raf = requestAnimationFrame(loop);
})();
