/* drift.quibo.games — The Firebreak
   A fire in a market town some time between 1700 and 1789, in the small hours. The day's number lays out the town
   (a main street, a cross street down to the river, a market place, a church, frontages of thatch, timber and brick
   with yards, barns and hay ricks behind), picks the house where the fire starts, the wind and the hour it backs or
   veers, and when the engine from the next town will arrive.

   Fire moves from roof to roof by heat, faster downwind, and throws burning thatch over the streets ahead of itself.
   You have the parish engine, a crew with fire hooks for pulling houses down, and later a second engine. An engine
   cools and quenches the three-by-three block it is aimed at, but only as well as the bucket chain to the nearest well
   or the river can feed it. A house pulled down cannot burn, and the parish pays its owner. When the last roof is out
   the page sets your night beside the same fire left alone. Self-contained. */
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
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function $(id) { return document.getElementById(id); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pounds(v) { return '£' + Math.round(v).toLocaleString('en-GB'); }
  function clock(t) {
    var m = Math.round(t), h = Math.floor(m / 60) % 24, mm = ((m % 60) + 60) % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (mm < 10 ? '0' : '') + mm + (h < 12 ? ' am' : ' pm');
  }

  /* ---------- the world ---------- */
  var TOWNS = [
    { town: 'Blandford Forum', county: 'Dorset', next: 'Wimborne', river: 'the Stour' },
    { town: 'Tiverton', county: 'Devon', next: 'Crediton', river: 'the Exe' },
    { town: 'Wareham', county: 'Dorset', next: 'Poole', river: 'the Frome' },
    { town: 'Warwick', county: 'Warwickshire', next: 'Stratford', river: 'the Avon' },
    { town: 'Marlborough', county: 'Wiltshire', next: 'Hungerford', river: 'the Kennet' },
    { town: 'Buckingham', county: 'Buckinghamshire', next: 'Stony Stratford', river: 'the Ouse' },
    { town: 'Ledbury', county: 'Herefordshire', next: 'Ross', river: 'the Leadon' },
    { town: 'Wymondham', county: 'Norfolk', next: 'Norwich', river: 'the Tiffey' },
    { town: 'Thame', county: 'Oxfordshire', next: 'Aylesbury', river: 'the Thame' },
    { town: 'Crediton', county: 'Devon', next: 'Exeter', river: 'the Creedy' },
    { town: 'Northallerton', county: 'Yorkshire', next: 'Thirsk', river: 'the Willow Beck' },
    { town: 'Bungay', county: 'Suffolk', next: 'Beccles', river: 'the Waveney' }
  ];
  var ORIGINS = ['in a baker’s bakehouse', 'in a maltster’s kiln', 'in a stable where a candle was left burning', 'at a tallow chandler’s',
    'in a smithy', 'in a chimney nobody had swept', 'in a brewhouse where the fire was banked too high', 'in a yard where hot ashes were thrown out'];
  var WINDS = [
    { str: 0.35, name: 'a light breeze', short: 'light' },
    { str: 0.7, name: 'a fresh breeze', short: 'fresh' },
    { str: 1.0, name: 'a strong wind', short: 'strong' },
    { str: 1.3, name: 'a gale', short: 'gale' }
  ];
  var ABBR = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  var COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  /* materials: thr = heat to catch, I = how fiercely it burns, fuel = minutes it burns, pull = minutes to pull down, val = £ */
  var MAT = {
    thatch: { name: 'thatched house', thr: 1.0, I: 1.5, fuel: 30, pull: 4, val: 60, roof: '#5f5233' },
    timber: { name: 'timber-framed house, tiled', thr: 2.2, I: 1.1, fuel: 55, pull: 8, val: 95, roof: '#5b3a2e' },
    brick: { name: 'brick house, tiled', thr: 4.5, I: 0.7, fuel: 70, pull: 16, val: 160, roof: '#6b3b31' },
    church: { name: 'the church', thr: 7, I: 0.8, fuel: 140, pull: 0, val: 1500, roof: '#55585e' },
    hall: { name: 'the market hall', thr: 2.6, I: 1.0, fuel: 60, pull: 12, val: 400, roof: '#4e4a44' },
    rick: { name: 'hay rick', thr: 0.7, I: 1.8, fuel: 25, pull: 2, val: 20, roof: '#7a6a35' },
    barn: { name: 'barn or stable', thr: 1.2, I: 1.3, fuel: 35, pull: 6, val: 40, roof: '#4f4430' },
    yard: { name: 'yard with sheds and fences', thr: 1.4, I: 0.35, fuel: 12, pull: 1, val: 5, roof: '#2a2b22' }
  };
  var COLS = 32, ROWS = 20, CS = 20, CW = COLS * CS, CH = ROWS * CS;
  var PACES = [0.8, 0.45, 0.18], PACENAME = ['slow', 'steady', 'quick'];
  var MAXT = 720;
  var K1 = 0.135, K2 = 0.05, DECAY = 0.93, BRAND = 0.012;   // how heat passes from roof to roof, and how fast it is lost

  var day, W, CF, dayOff = 0, tool = 0, hover = -1;

  function idx(c, r) { return r * COLS + c; }

  function buildDay(off) {
    var date = dateFor(off), seed = seedForDate(date), r = rng(seed);
    var T = pick(r, TOWNS), year = 1700 + Math.floor(r() * 90);
    var mo = date.getMonth(), dd = date.getDate();
    if (mo === 1 && dd === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) dd = 28;
    var wd = new Date(Date.UTC(year, mo, dd)).getUTCDay();
    var Wi = WINDS[Math.min(3, Math.floor(r() * 3 + r() * 1.2))];
    var dir = Math.floor(r() * 8);                         // the way the wind blows towards, in eighths of a turn
    var shiftAt = 80 + Math.floor(r() * 140), shiftBy = r() < 0.5 ? -1 : 1;
    var start = 60 + Math.floor(r() * 170);                // minutes after midnight the fire is seen
    var bAt = 50 + Math.floor(r() * 50), bSide = r() < 0.5 ? 0 : COLS - 1;
    var aAt = 16 + Math.floor(r() * 12), hAt = 9 + Math.floor(r() * 5);   // the engine house key, the crew out of bed

    /* ---- the town ---- */
    var type = [], RIV = ROWS - 2, c, rr;
    for (rr = 0; rr < ROWS; rr++) for (c = 0; c < COLS; c++) type.push(rr >= RIV ? 'water' : 'field');
    var ms = 7 + Math.floor(r() * 4), cs = 9 + Math.floor(r() * 14);
    var cl = clamp(cs + (r() < 0.5 ? -1 : 1) * (6 + Math.floor(r() * 5)), 2, COLS - 3);
    var bl = ms - 5, blA = Math.floor(r() * 8), blB = COLS - 1 - Math.floor(r() * 8);
    function street(c, rr) { if (c >= 0 && c < COLS && rr >= 0 && rr < RIV) type[idx(c, rr)] = 'street'; }
    for (c = 0; c < COLS; c++) street(c, ms);
    for (rr = 1; rr < RIV; rr++) street(cs, rr);
    for (rr = ms; rr < RIV; rr++) street(cl, rr);
    for (c = blA; c <= blB; c++) street(c, bl);
    for (rr = ms - 2; rr <= ms; rr++) for (c = cs - 3; c <= cs + 3; c++) street(c, rr);
    var hallAt = idx(cs + 2, ms - 1); type[hallAt] = 'hall';
    // the church and its yard, off the main street
    var cc, cr, tries = 0;
    do {
      cc = 3 + Math.floor(r() * (COLS - 7)); cr = r() < 0.5 ? ms + 3 : ms - 4; tries++;
    } while ((Math.abs(cc - cs) < 4 || Math.abs(cc - cl) < 4 || Math.abs(cc + 1 - cl) < 3) && tries < 60);
    var church = [idx(cc, cr), idx(cc + 1, cr), idx(cc, cr + 1), idx(cc + 1, cr + 1)];
    for (rr = cr - 1; rr <= cr + 2; rr++) for (c = cc - 1; c <= cc + 2; c++) {
      var k = idx(c, rr); if (type[k] === 'field') type[k] = 'green';
    }
    church.forEach(function (k) { type[k] = 'church'; });
    // distance from the nearest street, to put frontages on the streets and yards behind them
    var dist = type.map(function (t) { return t === 'street' || t === 'hall' ? 0 : 99; });
    for (var pass = 0; pass < 6; pass++) {
      for (rr = 0; rr < RIV; rr++) for (c = 0; c < COLS; c++) {
        var i = idx(c, rr); if (dist[i] === 0) continue;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          var c2 = c + dc, r2 = rr + dr; if (c2 < 0 || c2 >= COLS || r2 < 0 || r2 >= RIV) continue;
          dist[i] = Math.min(dist[i], dist[idx(c2, r2)] + 1);
        }
      }
    }
    var pTh = 0.55 - (year - 1700) * 0.004, pBr = 0.1 + (year - 1700) * 0.004;
    var mat = [];
    for (rr = 0; rr < ROWS; rr++) for (c = 0; c < COLS; c++) {
      var j = idx(c, rr), t = type[j], d = dist[j], m = null;
      if (t === 'church') m = 'church';
      else if (t === 'hall') m = 'hall';
      else if (t === 'field' && rr > 0) {
        var u = r();
        if (d === 1 || (d === 2 && u < 0.7)) {
          var onMain = Math.abs(rr - ms) <= 3 && d === 1, v = r();
          m = v < pBr + (onMain ? 0.15 : 0) ? 'brick' : v < pBr + (onMain ? 0.15 : 0) + pTh ? 'thatch' : 'timber';
        } else if (d === 2 || d === 3) {
          m = u < 0.45 ? 'yard' : u < 0.6 ? 'rick' : u < 0.8 ? 'barn' : null;
        }
      }
      mat.push(m);
      if (m && t === 'field') type[j] = m === 'yard' ? 'yard' : m === 'rick' ? 'rick' : m === 'barn' ? 'barn' : 'house';
    }
    // wells in the streets
    var wells = [], streets = [];
    type.forEach(function (t, k) { if (t === 'street') streets.push(k); });
    var nw = 3 + Math.floor(r() * 3);
    while (wells.length < nw && streets.length) {
      var s = streets.splice(Math.floor(r() * streets.length), 1)[0];
      if (wells.every(function (w) { return Math.abs(w % COLS - s % COLS) + Math.abs(Math.floor(w / COLS) - Math.floor(s / COLS)) > 5; })) { wells.push(s); type[s] = 'well'; }
    }
    // how far each cell is from water, for the bucket chain
    var wdist = [];
    for (rr = 0; rr < ROWS; rr++) for (c = 0; c < COLS; c++) {
      var best = RIV - rr > 0 ? RIV - rr : 0;
      wells.forEach(function (w) { best = Math.min(best, Math.max(Math.abs(w % COLS - c), Math.abs(Math.floor(w / COLS) - rr))); });
      wdist.push(best);
    }
    // where it starts: a house or barn upwind of the market, so the wind drives it into town
    var wv = windVec(dir), cand = [];
    type.forEach(function (t, k) {
      if (t !== 'house' && t !== 'barn') return;
      var x = k % COLS - cs, y = Math.floor(k / COLS) - ms;
      cand.push({ k: k, s: -(x * wv.x + y * wv.y) + r() * 4 - Math.hypot(x, y) * 0.15 });
    });
    cand.sort(function (a, b) { return b.s - a.s; });
    var top = cand.slice(0, Math.max(1, Math.floor(cand.length * 0.3))), origin = top[0].k;
    var streetNames = { main: pick(r, ['High Street', 'Market Street', 'Fore Street', 'Sheep Street', 'East Street']),
      cross: pick(r, ['Church Lane', 'Bridge Street', 'Salisbury Street', 'Mill Street', 'Sheep Lane']) };

    var D = {
      date: date, seed: seed, T: T, year: year, mo: mo, dd: dd, wd: wd, Wi: Wi, dir: dir, shiftAt: shiftAt, shiftBy: shiftBy,
      start: start, aAt: aAt, hAt: hAt, bAt: bAt, bSide: bSide, type: type, mat: mat, wdist: wdist, wells: wells, church: church, hallAt: hallAt,
      origin: origin, originWhat: pick(r, ORIGINS), ms: ms, cs: cs, cl: cl, RIV: RIV, names: streetNames
    };
    // try a few houses from the upwind side and keep the first whose fire, left alone, would take a good part of the
    // town but not all of it, so every night has something to lose and something to save
    var houses = 0; mat.forEach(function (m) { if (m === 'thatch' || m === 'timber' || m === 'brick') houses++; });
    var order = top.map(function (o) { return o.k; }), bestK = order[0], bestErr = 1e9;
    for (var tr = 0; tr < Math.min(10, order.length); tr++) {
      var kk = order[Math.floor(r() * order.length)];
      D.origin = kk;
      var A = runAlone(D), f = tally(A).hBurnt / houses, err = f < 0.3 ? 0.3 - f : f > 0.8 ? f - 0.8 : 0;
      if (err < bestErr) { bestErr = err; bestK = kk; }
      if (err === 0) break;
    }
    D.origin = bestK;
    return D;
  }

  function windVec(dir) { var a = dir * Math.PI / 4; return { x: Math.cos(a), y: Math.sin(a), a: a }; }
  function windDirAt(D, t) { return t >= D.shiftAt ? (D.dir + D.shiftBy + 8) % 8 : D.dir; }
  function windFrom(dir) { return COMPASS[(dir + 4) % 8]; }

  /* ---------- the fire, as a world that can be stepped ---------- */
  function makeWorld(D, withHelp) {
    var cells = D.type.map(function (t, k) {
      var m = D.mat[k];
      if (!m) return { m: null, st: -1 };
      var M = MAT[m];
      return { m: m, st: 0, heat: 0, fuel: M.fuel, douse: 0, lost: 0, burnAt: -1, wetAt: -9 };
    });
    cells[D.origin].st = 1; cells[D.origin].burnAt = 0;
    var P = { x: D.church[0] % COLS - 1, y: Math.floor(D.church[0] / COLS) };
    return {
      D: D, help: withHelp, t: 0, cells: cells, fr: rng(D.seed ^ 0x51ed),
      engines: withHelp ? [
        { name: 'The parish engine', x: P.x, y: P.y, tx: null, ty: null, at: D.aAt },
        { name: 'The engine from ' + D.T.next, x: D.bSide, y: D.ms, tx: null, ty: null, at: D.bAt }
      ] : [],
      hooks: withHelp ? { x: P.x, y: P.y + 1, queue: [], work: -1, left: 0, at: D.hAt } : null,
      series: [], brands: [], log: [], pulledVal: 0, burning: 1
    };
  }

  function isFuel(c) { return c.m !== null; }

  function tick(Wd) {
    var D = Wd.D, cells = Wd.cells, t = Wd.t, wdir = windDirAt(D, t), wv = windVec(wdir), str = D.Wi.str, fr = Wd.fr;
    var i, c, r, k, x;
    // heat from what is burning
    for (k = 0; k < cells.length; k++) {
      x = cells[k];
      if (x.st !== 1) continue;
      var M = MAT[x.m], emit = M.I * (Wd.t - x.wetAt < 1.5 ? 0.45 : 1);
      var c0 = k % COLS, r0 = Math.floor(k / COLS);
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
        if (!dr && !dc) continue;
        c = c0 + dc; r = r0 + dr; if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
        var y = cells[idx(c, r)]; if (y.st !== 0) continue;
        var l = Math.sqrt(dc * dc + dr * dr), cos = (dc * wv.x + dr * wv.y) / l, wf = Math.max(0.15, 1 + str * cos);
        var cheb = Math.max(Math.abs(dc), Math.abs(dr));
        if (cheb === 2) { if (cos < 0.55) continue; y.heat += emit * K2 * wf * str; }
        else y.heat += emit * K1 * wf * (dc && dr ? 0.7 : 1);
      }
      // burning thatch and hay go up in the draught and come down ahead of the fire
      if (M.I >= 1 && fr() < BRAND * str * M.I) {
        var dd = 2 + fr() * 4.5 * str, aa = wv.a + (fr() - 0.5) * 0.9;
        var bc = Math.round(c0 + Math.cos(aa) * dd), br = Math.round(r0 + Math.sin(aa) * dd);
        if (bc >= 0 && bc < COLS && br >= 0 && br < ROWS) {
          var b = cells[idx(bc, br)]; if (b.st === 0) b.heat += 1.1;
          if (Wd.help) Wd.brands.push({ x0: c0, y0: r0, x1: bc, y1: br, t: t });
        }
      }
      x.fuel -= 1;
      if (x.fuel <= 0) { x.st = 2; x.lost = MAT[x.m].val; }
    }
    // the engines
    if (Wd.help) {
      Wd.engines.forEach(function (e) {
        if (t < e.at || e.tx === null) return;
        var dx = e.tx - e.x, dy = e.ty - e.y, dl = Math.sqrt(dx * dx + dy * dy);
        if (dl > 0.05) { var s = Math.min(dl, 2); e.x += dx / dl * s; e.y += dy / dl * s; return; }
        var eff = engineEff(D, e.tx, e.ty);
        for (var dr2 = -1; dr2 <= 1; dr2++) for (var dc2 = -1; dc2 <= 1; dc2++) {
          var c2 = e.tx + dc2, r2 = e.ty + dr2; if (c2 < 0 || c2 >= COLS || r2 < 0 || r2 >= ROWS) continue;
          var z = cells[idx(c2, r2)], w = dr2 || dc2 ? 0.6 : 1;
          if (z.st === 1) {
            z.wetAt = t; z.douse += eff * w;
            if (z.douse >= MAT[z.m].I * 3.5) {
              z.st = 4; z.lost = MAT[z.m].val * (0.25 + 0.75 * (1 - z.fuel / MAT[z.m].fuel));
            }
          } else if (z.st === 0) z.heat = Math.max(0, z.heat - 1.8 * eff * w);
        }
      });
      var H = Wd.hooks;
      if (t >= H.at) {
        while (H.work < 0 && H.queue.length) {
          var q = H.queue[0];
          if (cells[q].st === 0) { H.work = q; H.left = -1; } else H.queue.shift();
        }
        if (H.work >= 0) {
          var tc = H.work % COLS, tr = Math.floor(H.work / COLS), hx = tc - H.x, hy = tr - H.y, hl = Math.sqrt(hx * hx + hy * hy);
          if (cells[H.work].st !== 0) {
            Wd.log.push([t, 'The fire reached the ' + MAT[cells[H.work].m].name + ' the hook crew were on, and they fell back.']);
            H.queue.shift(); H.work = -1;
          } else if (hl > 0.05) { var hs = Math.min(hl, 4); H.x += hx / hl * hs; H.y += hy / hl * hs; }
          else {
            if (H.left < 0) H.left = MAT[cells[H.work].m].pull;
            H.left -= 1;
            if (H.left <= 0) {
              var pc = cells[H.work]; pc.st = 3; pc.lost = MAT[pc.m].val; Wd.pulledVal += pc.lost;
              H.queue.shift(); H.work = -1;
            }
          }
        }
      }
    }
    // catch or cool
    var burning = 0;
    for (k = 0; k < cells.length; k++) {
      x = cells[k];
      if (x.st === 0) {
        if (x.heat > MAT[x.m].thr) { x.st = 1; x.burnAt = t; x.heat = 0; }
        else x.heat *= DECAY;
      }
      if (x.st === 1) burning++;
    }
    Wd.burning = burning;
    Wd.series.push(burning);
    Wd.t = t + 1;
  }

  function engineEff(D, c, r) { return clamp(1.15 - D.wdist[idx(c, r)] / 12, 0.25, 1); }

  function tally(Wd) {
    var o = { houses: 0, hBurnt: 0, hSaved: 0, hPulled: 0, hDamaged: 0, fire: 0, water: 0, pulled: 0, total: 0, church: 'stands', hall: 'stands', value: 0 };
    Wd.cells.forEach(function (x) {
      if (!isFuel(x)) return;
      var M = MAT[x.m]; o.value += M.val;
      var isH = x.m === 'thatch' || x.m === 'timber' || x.m === 'brick';
      if (isH) o.houses++;
      if (x.st === 2 || x.st === 1) { o.fire += M.val; if (isH) o.hBurnt++; }
      else if (x.st === 4) { o.water += x.lost; if (isH) o.hDamaged++; }
      else if (x.st === 3) { o.pulled += x.lost; if (isH) o.hPulled++; }
      else if (isH) o.hSaved++;
      if (x.m === 'church' && (x.st === 1 || x.st === 2)) o.church = 'burnt';
      else if (x.m === 'church' && x.st === 4 && o.church === 'stands') o.church = 'damaged';
      if (x.m === 'hall') o.hall = x.st === 1 || x.st === 2 ? 'burnt' : x.st === 4 ? 'damaged' : x.st === 3 ? 'pulled down' : 'stands';
    });
    o.total = o.fire + o.water + o.pulled;
    return o;
  }

  function runAlone(D) {
    var Wd = makeWorld(D, false);
    while (Wd.burning > 0 && Wd.t < MAXT) tick(Wd);
    return Wd;
  }

  /* ---------- the night ---------- */
  var phase = 'ready', acc = 0, lastFrame = null, seenLog = 0, lastEngineArrive = false, shiftSaid = false;

  function fresh() {
    W = makeWorld(day, true);
    phase = 'ready'; acc = 0; seenLog = 0; lastEngineArrive = false; shiftSaid = false;
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    $('bGo').disabled = false; $('bGo').textContent = 'Ring the fire bell';
    setTool(0);
    say('Fire ' + day.originWhat + ' on the ' + side(day.origin) + ' of the town. The sexton has the engine-house key: the parish engine will be out at ' + clock(day.start + day.aAt) + ', and the hook crew out of bed by ' + clock(day.start + day.hAt) + '. Choose where to send them now if you like, then ring the bell.');
    hud();
  }

  function side(k) {
    var c = k % COLS, r = Math.floor(k / COLS), dx = c - day.cs, dy = r - day.ms, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return COMPASS[(a + 8) % 8] + ' side';
  }

  function say(html) { $('msg').innerHTML = html; }

  function setTool(n) {
    tool = n;
    Array.prototype.forEach.call(document.querySelectorAll('[data-tool]'), function (b) {
      b.classList.toggle('on', +b.getAttribute('data-tool') === n);
      b.setAttribute('aria-pressed', +b.getAttribute('data-tool') === n ? 'true' : 'false');
    });
  }

  function act(k) {
    if (phase === 'done' || k < 0) return;
    var c = k % COLS, r = Math.floor(k / COLS), x = W.cells[k];
    if (tool === 0 || tool === 1) {
      var e = W.engines[tool];
      if (day.type[k] === 'water') { say('The engine would sink. Aim it at the town and the bucket chain will run from the water.'); return; }
      e.tx = c; e.ty = r;
      var eff = Math.round(engineEff(day, c, r) * 100);
      say('<b>' + e.name + '</b> ' + (W.t < e.at ? 'will go' : 'goes') + ' to ' + where(k) + '. The bucket chain from the nearest water is ' +
        Math.round(day.wdist[k] * 12) + ' yards long, so it plays at ' + eff + '% of its full strength.' +
        (W.t < e.at ? ' It is not here until ' + clock(day.start + e.at) + '.' : ''));
    } else {
      var H = W.hooks, qi = H.queue.indexOf(k);
      if (qi >= 0) {
        if (H.work === k) { say('The crew are already at it; they will finish this one.'); return; }
        H.queue.splice(qi, 1); say('Taken off the hook crew’s list.'); return;
      }
      if (!isFuel(x)) { say('Nothing there to pull down.'); return; }
      if (x.m === 'church') { say('Nobody will put a hook to the church.'); return; }
      if (x.st !== 0) { say('Too late for hooks there.'); return; }
      H.queue.push(k);
      say('The hook crew will pull down the ' + MAT[x.m].name + ' at ' + where(k) + ': about ' + MAT[x.m].pull + ' minutes’ work, and ' +
        pounds(MAT[x.m].val) + ' to its owner from the parish. ' + (H.queue.length > 1 ? cap(num(H.queue.length)) + ' on their list.' : ''));
    }
    hud();
  }

  function where(k) {
    var c = k % COLS, r = Math.floor(k / COLS);
    if (r === day.ms || Math.abs(r - day.ms) <= 1) return 'the ' + day.names.main;
    if (c === day.cs) return day.names.cross;
    if (Math.abs(r - day.ms) <= 2 && Math.abs(c - day.cs) <= 3) return 'the market place';
    return 'the back of the ' + (r < day.ms ? 'north' : 'south') + ' side';
  }

  function start() {
    if (phase !== 'ready' && phase !== 'paused') {
      if (phase === 'run') { phase = 'paused'; $('bGo').textContent = 'Carry on'; }
      return;
    }
    phase = 'run'; $('bGo').textContent = 'Hold the clock';
  }

  function step() {
    tick(W);
    for (; seenLog < W.log.length; seenLog++) say(W.log[seenLog][1]);
    if (!lastEngineArrive && W.t === W.engines[1].at) {
      lastEngineArrive = true;
      say('<b>The engine from ' + day.T.next + '</b> comes in along the ' + day.names.main + ' from the ' + (day.bSide ? 'east' : 'west') + '. Press <code>2</code> or its button and aim it.');
    }
    if (!shiftSaid && W.t === day.shiftAt) {
      shiftSaid = true;
      say('The wind ' + (day.shiftBy > 0 ? 'veers' : 'backs') + ' and now blows from the ' + windFrom(windDirAt(day, W.t)) + '.');
    }
    if (W.burning === 0 || W.t >= MAXT) finish();
  }

  function finish() {
    phase = 'done';
    $('bGo').disabled = true; $('bGo').textContent = 'The fire is out';
    var me = tally(W), alone = tally(CF), v = $('verdict');
    var saved = alone.total - me.total;
    var head = W.burning === 0 ? 'The last roof is out at ' + clock(day.start + W.t) + '.' : 'Daylight, and the fire is still burning.';
    var judge;
    if (saved > alone.total * 0.6) judge = 'The vestry will vote you a piece of plate. The town that is still standing is mostly your doing.';
    else if (saved > alone.total * 0.3) judge = 'A hard night well spent. Half a street is gone, but the fire stopped where you made it stop.';
    else if (saved > 0) judge = 'Better than leaving it, if not by much. The fire mostly went where the wind sent it.';
    else if (saved === 0) judge = 'Exactly what it would have cost if nobody had got out of bed. The fire went where the wind sent it.';
    else judge = 'The town lost more than it would have if everyone had stood and watched. It happens: the hooks were in the wrong places, or the engines were.';
    v.className = 'verdict ' + (saved > alone.total * 0.3 ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + head + '</b> ' + num(me.hBurnt) + ' house' + (me.hBurnt === 1 ? '' : 's') + ' burnt out of ' + me.houses +
      ', against ' + alone.hBurnt + ' if the fire had been left alone. The loss to the town is <b>' + pounds(me.total) + '</b> against ' +
      pounds(alone.total) + '.</p><p>' + judge + '</p>';
    reveal(me, alone);
    $('bAgain').style.display = '';
    hud();
  }

  /* ---------- drawing ---------- */
  var cv = $('town'), cx = cv.getContext('2d'), SC = 2;
  cv.width = CW * SC; cv.height = CH * SC;

  function cellXY(k) { return { x: (k % COLS) * CS, y: Math.floor(k / COLS) * CS }; }

  function drawTown(c, Wd, now, live) {
    var D = Wd.D, k, p;
    c.fillStyle = '#0d120e'; c.fillRect(0, 0, CW, CH);
    for (k = 0; k < D.type.length; k++) {
      p = cellXY(k); var t = D.type[k];
      if (t === 'water') {
        c.fillStyle = '#0b1622'; c.fillRect(p.x, p.y, CS, CS);
        if (((k * 7) % 5) === 0) { c.strokeStyle = 'rgba(122,162,255,.18)'; c.beginPath(); c.moveTo(p.x + 3, p.y + 10); c.lineTo(p.x + 11, p.y + 10); c.stroke(); }
      } else if (t === 'street' || t === 'well' || t === 'hall') {
        c.fillStyle = '#1d1b18'; c.fillRect(p.x, p.y, CS, CS);
      } else if (t === 'green') {
        c.fillStyle = '#122016'; c.fillRect(p.x, p.y, CS, CS);
      }
    }
    // wells
    D.wells.forEach(function (w) {
      var q = cellXY(w);
      c.strokeStyle = '#7aa2ff'; c.lineWidth = 1.5; c.beginPath(); c.arc(q.x + 10, q.y + 10, 4.5, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(122,162,255,.35)'; c.fill();
    });
    // buildings
    for (k = 0; k < Wd.cells.length; k++) {
      var x = Wd.cells[k]; if (!isFuel(x)) continue;
      p = cellXY(k); var M = MAT[x.m], inset = x.m === 'yard' ? 5 : x.m === 'rick' ? 4 : 1.5;
      if (x.st === 0) {
        c.fillStyle = M.roof; c.fillRect(p.x + inset, p.y + inset, CS - 2 * inset, CS - 2 * inset);
        if (x.m === 'thatch') { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x + 2, p.y + 10); c.lineTo(p.x + 18, p.y + 10); c.stroke(); }
        if (x.m === 'brick' || x.m === 'timber') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(p.x + 1.5, p.y + 9, CS - 3, 2); }
        if (x.m === 'church' && k === D.church[0]) {
          c.strokeStyle = 'rgba(232,237,245,.55)'; c.lineWidth = 1.5; c.beginPath();
          c.moveTo(p.x + 20, p.y + 10); c.lineTo(p.x + 20, p.y + 30); c.moveTo(p.x + 13, p.y + 17); c.lineTo(p.x + 27, p.y + 17); c.stroke();
        }
        // a house warming up glows before it catches
        var hh = clamp(x.heat / M.thr, 0, 1);
        if (hh > 0.25) { c.fillStyle = 'rgba(255,120,40,' + (hh * 0.45) + ')'; c.fillRect(p.x + inset, p.y + inset, CS - 2 * inset, CS - 2 * inset); }
        // windows lit in the houses that are awake
        if (live && (x.m === 'thatch' || x.m === 'timber' || x.m === 'brick') && ((k * 2654435761) >>> 0) % 7 === 0) {
          c.fillStyle = 'rgba(255,214,120,.55)'; c.fillRect(p.x + 7, p.y + 13, 2.5, 2.5);
        }
      } else if (x.st === 1) {
        var f = 0.75 + 0.25 * Math.sin(now / 90 + k * 1.7);
        c.fillStyle = '#2a1408'; c.fillRect(p.x + 1, p.y + 1, CS - 2, CS - 2);
        var g = c.createRadialGradient(p.x + 10, p.y + 10, 1, p.x + 10, p.y + 10, 16);
        g.addColorStop(0, 'rgba(255,236,170,' + f + ')'); g.addColorStop(0.35, 'rgba(255,140,40,' + (0.85 * f) + ')'); g.addColorStop(1, 'rgba(255,60,10,0)');
        c.fillStyle = g; c.fillRect(p.x - 6, p.y - 6, CS + 12, CS + 12);
        if (Wd.t - x.wetAt < 1.5) { c.fillStyle = 'rgba(200,215,235,.35)'; c.fillRect(p.x + 2, p.y + 2, CS - 4, CS - 4); }
      } else if (x.st === 2) {
        c.fillStyle = '#131111'; c.fillRect(p.x + 1, p.y + 1, CS - 2, CS - 2);
        if (Wd.t - x.burnAt - MAT[x.m].fuel < 40) {
          c.fillStyle = 'rgba(255,90,30,' + (0.35 * (0.6 + 0.4 * Math.sin(now / 200 + k))) + ')';
          c.fillRect(p.x + 5 + (k % 3) * 3, p.y + 6 + (k % 5), 2, 2); c.fillRect(p.x + 12 - (k % 4), p.y + 13, 2, 2);
        }
      } else if (x.st === 3) {
        c.fillStyle = '#34312c'; c.fillRect(p.x + 2, p.y + 2, CS - 4, CS - 4);
        c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; c.beginPath();
        c.moveTo(p.x + 3, p.y + 15); c.lineTo(p.x + 16, p.y + 4); c.moveTo(p.x + 5, p.y + 18); c.lineTo(p.x + 18, p.y + 8); c.stroke();
      } else if (x.st === 4) {
        c.fillStyle = '#3a2a1f'; c.fillRect(p.x + 1.5, p.y + 1.5, CS - 3, CS - 3);
        c.fillStyle = 'rgba(200,215,235,.18)'; c.fillRect(p.x + 4, p.y + 4, CS - 8, CS - 8);
      }
    }
  }

  function drawLive(now) {
    var c = cx; c.setTransform(SC, 0, 0, SC, 0, 0);
    drawTown(c, W, now, true);
    var k;
    // flying brands of the last few minutes
    W.brands = W.brands.filter(function (b) { return W.t - b.t < 2; });
    W.brands.forEach(function (b) {
      var u = clamp((W.t - b.t + (acc / PACES[+$('pace').value])) / 1.2, 0, 1);
      var x = (b.x0 + (b.x1 - b.x0) * u) * CS + 10, y = (b.y0 + (b.y1 - b.y0) * u) * CS + 10 - Math.sin(u * Math.PI) * 18;
      c.fillStyle = 'rgba(255,200,90,' + (1 - u * 0.6) + ')'; c.beginPath(); c.arc(x, y, 1.8, 0, Math.PI * 2); c.fill();
    });
    // hook crew's list
    var H = W.hooks;
    c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    H.queue.forEach(function (q, i) {
      var p = cellXY(q);
      c.strokeStyle = '#ffd166'; c.setLineDash([3, 2]); c.lineWidth = 1.5; c.strokeRect(p.x + 1, p.y + 1, CS - 2, CS - 2); c.setLineDash([]);
      c.fillStyle = '#ffd166'; c.fillText(String(i + 1), p.x + 10, p.y + 13);
    });
    if (H.work >= 0 && H.left > 0) {
      var pw = cellXY(H.work), frac = 1 - H.left / MAT[W.cells[H.work].m].pull;
      c.fillStyle = 'rgba(255,209,102,.6)'; c.fillRect(pw.x + 2, pw.y + CS - 4, (CS - 4) * frac, 2);
    }
    if (W.t >= H.at || phase === 'ready') {
      c.fillStyle = '#ffd166'; c.beginPath(); c.arc(H.x * CS + 10, H.y * CS + 10, 3.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd166'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(H.x * CS + 10, H.y * CS + 10); c.lineTo(H.x * CS + 18, H.y * CS + 2);
      c.arc(H.x * CS + 16, H.y * CS + 2, 2, 0, Math.PI, true); c.stroke();
    }
    // engines and their jets
    W.engines.forEach(function (e, i) {
      if (W.t < e.at && i === 1) return;
      var ex = e.x * CS + 10, ey = e.y * CS + 10, col = i ? '#7aa2ff' : '#64f0c8';
      if (e.tx !== null) {
        var tx = e.tx * CS + 10, ty = e.ty * CS + 10;
        var there = Math.abs(e.tx - e.x) < 0.06 && Math.abs(e.ty - e.y) < 0.06;
        c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 1; c.setLineDash([2, 3]);
        c.strokeRect(tx - 30, ty - 30, 60, 60); c.setLineDash([]); c.globalAlpha = 1;
        if (there && phase !== 'ready') {
          for (var j = 0; j < 6; j++) {
            var a = now / 140 + j * 1.05, rr = 10 + 14 * ((now / 400 + j / 6) % 1);
            c.fillStyle = 'rgba(190,215,255,.5)'; c.fillRect(tx + Math.cos(a) * rr - 1, ty + Math.sin(a) * rr - 1, 2, 2);
          }
        }
      }
      c.fillStyle = col; c.fillRect(ex - 6, ey - 4, 12, 8);
      c.fillStyle = '#07090d'; c.fillRect(ex - 4, ey - 2, 8, 4);
      c.fillStyle = col; c.font = '700 8px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; c.fillText(String(i + 1), ex, ey + 3);
    });
    // hover
    if (hover >= 0 && phase !== 'done') {
      var ph = cellXY(hover);
      if (tool < 2) {
        c.strokeStyle = tool ? 'rgba(122,162,255,.8)' : 'rgba(100,240,200,.8)'; c.lineWidth = 1;
        c.strokeRect(ph.x - 20, ph.y - 20, 60, 60);
      } else { c.strokeStyle = 'rgba(255,209,102,.9)'; c.lineWidth = 1.5; c.strokeRect(ph.x + 1, ph.y + 1, CS - 2, CS - 2); }
    }
    drawWind(c, windDirAt(day, W.t));
  }

  function drawWind(c, dir) {
    var v = windVec(dir), x = CW - 36, y = 26, L = 10 + day.Wi.str * 8;
    c.fillStyle = 'rgba(7,9,13,.7)'; c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e8edf5'; c.lineWidth = 2; c.beginPath();
    c.moveTo(x - v.x * L, y - v.y * L); c.lineTo(x + v.x * L, y + v.y * L); c.stroke();
    c.beginPath(); c.moveTo(x + v.x * L, y + v.y * L);
    c.lineTo(x + v.x * (L - 6) - v.y * 4, y + v.y * (L - 6) + v.x * 4); c.lineTo(x + v.x * (L - 6) + v.y * 4, y + v.y * (L - 6) - v.x * 4);
    c.closePath(); c.fillStyle = '#e8edf5'; c.fill();
    c.fillStyle = '#8b97ab'; c.font = '600 8px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; c.fillText('WIND', x, y + 31);
  }

  function hud() {
    $('hWhen').textContent = clock(day.start + W.t);
    var me = tally(W), gone = 0;
    W.cells.forEach(function (x) { if (x.st === 2 && (x.m === 'thatch' || x.m === 'timber' || x.m === 'brick')) gone++; });
    $('hBurn').textContent = W.burning + ' alight · ' + gone + ' gone';
    $('hBurnBox').className = W.burning > 12 ? 'alarm' : '';
    var wd = windDirAt(day, W.t);
    $('hWind').textContent = day.Wi.short + ', from ' + ABBR[(wd + 4) % 8];
    $('hLoss').textContent = pounds(me.total);
    var e2 = W.engines[1];
    $('tEng2').disabled = false;
    $('tEng2Note').textContent = W.t < e2.at ? 'due ' + clock(day.start + e2.at) : 'arrived';
    $('tHookNote').textContent = W.hooks.queue.length ? num(W.hooks.queue.length) + ' on the list' : 'list empty';
  }

  /* ---------- the reveal ---------- */
  function reveal(me, alone) {
    var R = $('reveal'); R.style.display = '';
    var html = '<h5>The vestry’s account</h5><table class="card">' +
      '<tr><td>Burnt</td><td>' + me.hBurnt + ' houses, with the barns, ricks and sheds behind them</td><td class="n">' + pounds(me.fire) + '</td></tr>' +
      '<tr><td>Quenched</td><td>' + me.hDamaged + ' houses put out by the engines, scorched and soaked</td><td class="n">' + pounds(me.water) + '</td></tr>' +
      '<tr><td>Pulled down</td><td>' + me.hPulled + ' houses, paid to their owners by the parish</td><td class="n">' + pounds(me.pulled) + '</td></tr>' +
      '<tr class="tot"><td>Your night</td><td>the church ' + me.church + '; the market hall ' + me.hall + '</td><td class="n">' + pounds(me.total) + '</td></tr>' +
      '<tr><td>Left alone</td><td>' + alone.hBurnt + ' houses burnt; the church ' + alone.church + '; the market hall ' + alone.hall + '</td><td class="n">' + pounds(alone.total) + '</td></tr>' +
      '</table>' +
      '<h5>The town at first light</h5><canvas id="mapAfter" width="1280" height="800"></canvas>' +
      '<div class="key"><span><i style="background:#ff6a3d"></i>would have burnt if left alone, and did not</span>' +
      '<span><i style="background:#34312c"></i>pulled down</span><span><i style="background:#3a2a1f"></i>quenched</span>' +
      '<span><i style="background:#131111"></i>burnt</span></div>' +
      '<h5>Roofs alight, minute by minute</h5><canvas id="chart" width="1280" height="400"></canvas>' +
      '<div class="key"><span><i style="background:#ff8a5b"></i>your night</span><span><i style="background:rgba(232,237,245,.45)"></i>the same fire left alone</span></div>' +
      '<p>The fire is the same fire both times: the same house, the same wind, the same shift in it at ' + clock(day.start + day.shiftAt) +
      '. Burning thatch thrown ahead of the flames lands by chance, so once you change anything the two nights part company.</p>';
    R.innerHTML = html;
    var c = $('mapAfter').getContext('2d'); c.setTransform(SC, 0, 0, SC, 0, 0);
    drawTown(c, W, 0, false);
    c.strokeStyle = '#ff6a3d'; c.lineWidth = 1.5;
    CF.cells.forEach(function (x, k) {
      var mine = W.cells[k];
      if ((x.st === 2 || x.st === 1) && mine.st !== 2 && mine.st !== 1) { var p = cellXY(k); c.strokeRect(p.x + 2.5, p.y + 2.5, CS - 5, CS - 5); }
    });
    var o = cellXY(day.origin); c.fillStyle = '#ffd166'; c.font = '700 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; c.fillText('✶', o.x + 10, o.y + 14);
    drawWind(c, day.dir);
    // the chart
    var g = $('chart').getContext('2d'); g.setTransform(SC, 0, 0, SC, 0, 0);
    var Wc = 640, Hc = 200, L = 34, Rr = 630, Tt = 12, B = 172;
    var n = Math.max(W.series.length, CF.series.length, 60), mx = 1;
    W.series.concat(CF.series).forEach(function (v) { mx = Math.max(mx, v); });
    function X(i) { return L + i / n * (Rr - L); }
    function Y(v) { return B - v / mx * (B - Tt); }
    g.fillStyle = '#0b0f16'; g.fillRect(0, 0, Wc, Hc);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1;
    for (var h = 0; h <= n; h += 60) { g.beginPath(); g.moveTo(X(h), Tt); g.lineTo(X(h), B); g.stroke(); }
    function line(s, col, w) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); s.forEach(function (v, i) { if (i) g.lineTo(X(i), Y(v)); else g.moveTo(X(i), Y(v)); }); g.stroke(); }
    line(CF.series, 'rgba(232,237,245,.45)', 1.5);
    line(W.series, '#ff8a5b', 2);
    g.fillStyle = '#8b97ab'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
    for (h = 0; h <= n; h += 60) g.fillText(clock(day.start + h), X(h), B + 16);
    g.textAlign = 'right'; g.fillText(String(mx), L - 6, Tt + 8); g.fillText('0', L - 6, B);
  }

  /* ---------- the day ---------- */
  function loadDay(off) {
    dayOff = off; day = buildDay(off); CF = runAlone(day);
    var T = day.T;
    $('rWho').textContent = 'Fire · ' + T.town + ', ' + T.county + ' · the small hours of ' + WEEKDAYS[day.wd] + ' ' + day.dd + ' ' + MONTHS[day.mo] + ' ' + day.year;
    $('rName').textContent = 'Fire on the ' + side(day.origin);
    var houses = 0, th = 0, br = 0;
    day.mat.forEach(function (m) { if (m === 'thatch' || m === 'timber' || m === 'brick') { houses++; if (m === 'thatch') th++; if (m === 'brick') br++; } });
    $('rBlurb').innerHTML = 'At ' + clock(day.start) + ' the watch cries fire: it has started <b>' + day.originWhat + '</b>. The town has ' + houses + ' houses: <b>' +
      th + ' thatched</b>, ' + (houses - th - br) + ' timber-framed under tile and ' + br + ' of brick, with barns, yards and ricks behind them and ' +
      num(day.wells.length) + ' wells in the streets besides ' + T.river + '. There is <b>' + day.Wi.name + ' from the ' + windFrom(day.dir) + '</b>, and it will ' +
      (day.shiftBy > 0 ? 'veer' : 'back') + ' later. The engine from ' + T.next + ' has been sent for and should come in about ' + clock(day.start + day.bAt) + '.';
    $('rBook').textContent = 'Resolved, that the fire hooks be hung again in the church porch, and the engine be played once a quarter. — the vestry book';
    $('dayOut').textContent = (off === 0 ? 'Today: ' : off < 0 ? (off === -1 ? 'Yesterday: ' : -off + ' days ago: ') : (off === 1 ? 'Tomorrow: ' : off + ' days on: ')) +
      T.town + ', ' + day.year + ' · ' + day.Wi.name + ' from the ' + windFrom(day.dir);
    fresh();
  }

  /* ---------- the loop ---------- */
  function frame(ts) {
    if (lastFrame === null) lastFrame = ts;
    var dt = Math.min(0.1, (ts - lastFrame) / 1000); lastFrame = ts;
    if (phase === 'run') {
      acc += dt;
      var per = PACES[+$('pace').value], n = 0;
      while (acc >= per && phase === 'run' && n < 8) { acc -= per; step(); n++; }
      hud();
    }
    if (W) drawLive(ts);
    requestAnimationFrame(frame);
  }

  /* ---------- wiring ---------- */
  function cellAt(e) {
    var rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) * CW / rc.width, y = (e.clientY - rc.top) * CH / rc.height;
    var c = Math.floor(x / CS), r = Math.floor(y / CS);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS ? idx(c, r) : -1;
  }
  cv.addEventListener('pointerdown', function (e) { var k = cellAt(e); if (k >= 0) { e.preventDefault(); act(k); } });
  cv.addEventListener('pointermove', function (e) {
    hover = cellAt(e);
    if (hover >= 0 && W) {
      var x = W.cells[hover], t = day.type[hover];
      var what = isFuel(x) ? cap(MAT[x.m].name) + ' (' + pounds(MAT[x.m].val) + ')' + (x.st === 1 ? ', burning' : x.st === 2 ? ', burnt' : x.st === 3 ? ', pulled down' : x.st === 4 ? ', quenched' : '') :
        t === 'well' ? 'A well' : t === 'water' ? cap(day.T.river) : t === 'green' ? 'The churchyard' : t === 'street' ? 'The street' : 'Open ground';
      $('cellOut').textContent = what + ' · water ' + Math.round(day.wdist[hover] * 12) + ' yards away';
    }
  });
  cv.addEventListener('pointerleave', function () { hover = -1; $('cellOut').textContent = '—'; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-tool]'), function (b) {
    b.addEventListener('click', function () { setTool(+b.getAttribute('data-tool')); });
  });
  $('bGo').addEventListener('click', start);
  $('bAgain').addEventListener('click', fresh);
  function paceOut() { $('paceOut').textContent = PACENAME[+$('pace').value] + ' · ' + PACES[+$('pace').value] + ' s a minute'; }
  $('pace').addEventListener('input', paceOut); paceOut();
  document.addEventListener('keydown', function (e) {
    if (phase === 'done') return;
    if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var used = true;
    if (e.code === 'Digit1') setTool(0);
    else if (e.code === 'Digit2') setTool(1);
    else if (e.code === 'Digit3') setTool(2);
    else if (e.code === 'Space') { if (e.target && e.target.tagName === 'BUTTON') return; start(); }
    else if (e.code === 'Escape') { W.hooks.queue = W.hooks.work >= 0 ? [W.hooks.work] : []; say('The hook crew’s list is cleared.'); hud(); }
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
