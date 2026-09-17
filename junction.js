/* drift.quibo.games — The Junction
   Page twenty. A station dealt by today's date, a working timetable to go with it,
   and an interlocking that will not let you have two things at once.
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
  function irnd(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffled(r, arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ================= naming ================= */
  var HEAD = ['Ash', 'Brack', 'Cold', 'Dun', 'Fen', 'Grim', 'Hale', 'Iron', 'Kirk',
    'Long', 'Mar', 'Nether', 'Old', 'Pen', 'Raven', 'Stan', 'Thorn', 'Wend', 'Yar',
    'Bram', 'Cale', 'Dove', 'Elm', 'Gar', 'Holme', 'Keld', 'Lang', 'Mel', 'Orms',
    'Rud', 'Sel', 'Tarn', 'Ull', 'Wick', 'Barr', 'Cran', 'Drum', 'Fold', 'Hest', 'Mor'];
  var TAIL = ['bridge', 'ford', 'wick', 'thorpe', 'by', 'ham', 'ton', 'field', 'gate',
    'moor', 'bank', 'dale', 'combe', 'cliff', 'head', 'worth', 'stead', 'hurst',
    'mere', 'row', 'cross', 'hill', 'side', 'port', 'march', 'holt', 'stone', 'well',
    'minster', 'haven', 'ley', 'burn', 'beck', 'garth', 'scar'];
  var STN_SUFFIX = ['Junction', 'Central', 'Road', 'Parkway', 'Exchange', 'Bridge',
    'Low Level', 'Midland', 'Priory', 'Quay'];

  /* ================= the station ================= */
  var DESIGN_W = 1000;
  var X_EDGE_L = 8, X_LINE_L = 152, X_THROAT_L = 268;
  var X_THROAT_R = 732, X_LINE_R = 848, X_EDGE_R = 992;
  var BAY_END = 556;
  var TOP = 92, GAP = 46, COACH = 26;

  function buildLayout(r) {
    var nPlat = irnd(r, 3, 4);
    var hasLoop = r() < 0.65;
    var hasBay = r() < 0.55;
    var i, k;

    var order = [];
    if (hasBay) order.push('bay');
    for (i = 0; i < nPlat; i++) order.push('plat');
    if (hasLoop) order.push('loop');
    if (r() < 0.5) order.reverse();

    var roads = [], pn = 1;
    for (k = 0; k < order.length; k++) {
      var kind = order[k];
      var rd = { idx: k, kind: kind };
      if (kind === 'plat') {
        rd.label = String(pn++); rd.title = 'Platform ' + rd.label;
        rd.len = irnd(r, 8, 12);
      } else if (kind === 'bay') {
        rd.label = String(pn++); rd.title = 'Bay platform ' + rd.label;
        rd.len = irnd(r, 4, 6);
      } else {
        rd.label = 'L'; rd.title = 'Goods loop';
        rd.len = irnd(r, 12, 16);
      }
      roads.push(rd);
    }
    var n = roads.length;

    var eastMin = 0, eastMax = n - 1;
    for (k = 0; k < n; k++) {
      if (roads[k].kind === 'bay') {
        roads[k].noEast = true;
        if (k === 0) eastMin = 1; else eastMax = n - 2;
      }
    }

    for (k = 0; k < n; k++) {
      roads[k].y = TOP + k * GAP;
      roads[k].x0 = X_THROAT_L;
      roads[k].x1 = roads[k].noEast ? BAY_END : X_THROAT_R;
      roads[k].cx = (roads[k].x0 + roads[k].x1) / 2;
    }

    var used = {};
    function place() {
      var s, guard = 0;
      do { s = pick(r, HEAD) + pick(r, TAIL); guard++; } while (used[s] && guard < 60);
      used[s] = 1; return s;
    }

    var wCand = [], eCand = [];
    for (i = 0; i < n; i++) {
      if (roads[i].kind === 'bay') continue;
      wCand.push(i);
      if (i >= eastMin && i <= eastMax) eCand.push(i);
    }
    var nW = Math.min(irnd(r, 2, 3), wCand.length);
    var nE = Math.min(irnd(r, 2, 3), eCand.length);
    var wPick = shuffled(r, wCand).slice(0, nW).sort(function (a, b) { return a - b; });
    var ePick = shuffled(r, eCand).slice(0, nE).sort(function (a, b) { return a - b; });

    var letters = shuffled(r, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K',
      'M', 'O', 'P', 'S', 'T', 'V', 'X', 'Z']);
    var li = 0;
    var west = wPick.map(function (a, j) {
      return { side: 'W', idx: j, attach: a, name: place(), letter: letters[li++] };
    });
    var east = ePick.map(function (a, j) {
      return { side: 'E', idx: j, attach: a, name: place(), letter: letters[li++] };
    });

    var station = place();
    if (r() < 0.6) station += ' ' + pick(r, STN_SUFFIX);

    return {
      roads: roads, west: west, east: east,
      eastMin: eastMin, eastMax: eastMax,
      station: station,
      height: TOP + (n - 1) * GAP + 62
    };
  }

  function lineOf(layout, side, idx) {
    return (side === 'W' ? layout.west : layout.east)[idx];
  }

  /* ================= the interlocking ================= */
  function routeSections(layout, side, lineIdx, roadIdx) {
    var a = lineOf(layout, side, lineIdx).attach;
    var out = [(side === 'W' ? 'w:' : 'e:') + lineIdx];
    var lo = Math.min(a, roadIdx), hi = Math.max(a, roadIdx);
    var pre = (side === 'W' ? 'wl:' : 'el:');
    for (var k = lo; k < hi; k++) out.push(pre + k);
    out.push('r:' + roadIdx);
    return out;
  }

  function blocker(st, secs, id) {
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      if (st.lock[s] && st.lock[s] !== id) return { sec: s, by: st.lock[s] };
      if (st.occ[s] && st.occ[s] !== id) return { sec: s, by: st.occ[s] };
    }
    return null;
  }

  function lockAll(st, secs, id) {
    for (var i = 0; i < secs.length; i++) st.lock[secs[i]] = id;
  }
  function releaseAll(st, secs, id) {
    if (!secs) return;
    for (var i = 0; i < secs.length; i++) if (st.lock[secs[i]] === id) st.lock[secs[i]] = null;
  }

  function sectionName(layout, s) {
    var p = s.split(':'), k = parseInt(p[1], 10);
    if (p[0] === 'w') return 'the ' + layout.west[k].name + ' line';
    if (p[0] === 'e') return 'the ' + layout.east[k].name + ' line';
    if (p[0] === 'r') return layout.roads[k].title.toLowerCase();
    return 'the ' + (p[0] === 'wl' ? 'west' : 'east') + ' throat';
  }

  /* ================= paths ================= */
  function fanPts(x0, y0, x1, y1) {
    if (Math.abs(y1 - y0) < 0.5) return [{ x: x1, y: y1 }];
    var out = [], N = 12, i, t, s;
    for (i = 1; i <= N; i++) {
      t = i / N; s = t * t * (3 - 2 * t);
      out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * s });
    }
    return out;
  }
  function makePath(pts) {
    var cum = [0], total = 0, i, dx, dy;
    for (i = 1; i < pts.length; i++) {
      dx = pts[i].x - pts[i - 1].x; dy = pts[i].y - pts[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
      cum.push(total);
    }
    return { pts: pts, cum: cum, len: total };
  }
  function ptAt(p, d) {
    var last = p.pts[p.pts.length - 1];
    if (d <= 0) return { x: p.pts[0].x, y: p.pts[0].y };
    if (d >= p.len) return { x: last.x, y: last.y };
    var i = 1;
    while (i < p.cum.length - 1 && p.cum[i] < d) i++;
    var span = p.cum[i] - p.cum[i - 1] || 1;
    var t = (d - p.cum[i - 1]) / span;
    return {
      x: p.pts[i - 1].x + (p.pts[i].x - p.pts[i - 1].x) * t,
      y: p.pts[i - 1].y + (p.pts[i].y - p.pts[i - 1].y) * t
    };
  }
  function sliceAt(p, d0, d1) {
    d0 = Math.max(0, d0); d1 = Math.min(p.len, d1);
    if (d1 <= d0) return [ptAt(p, Math.max(0, Math.min(p.len, d0)))];
    var out = [ptAt(p, d0)];
    for (var i = 0; i < p.pts.length; i++) {
      if (p.cum[i] > d0 && p.cum[i] < d1) out.push(p.pts[i]);
    }
    out.push(ptAt(p, d1));
    return out;
  }

  function arrivalPath(layout, side, lineIdx, roadIdx) {
    var ly = layout.roads[lineOf(layout, side, lineIdx).attach].y;
    var rd = layout.roads[roadIdx], ry = rd.y, pts;
    if (side === 'W') {
      pts = [{ x: -110, y: ly }, { x: X_LINE_L, y: ly }]
        .concat(fanPts(X_LINE_L, ly, X_THROAT_L, ry));
    } else {
      pts = [{ x: DESIGN_W + 110, y: ly }, { x: X_LINE_R, y: ly }]
        .concat(fanPts(X_LINE_R, ly, X_THROAT_R, ry));
    }
    pts.push({ x: rd.cx, y: ry });
    return makePath(pts);
  }
  function departurePath(layout, side, lineIdx, roadIdx) {
    var ly = layout.roads[lineOf(layout, side, lineIdx).attach].y;
    var rd = layout.roads[roadIdx], ry = rd.y, pts;
    if (side === 'W') {
      pts = [{ x: rd.cx, y: ry }, { x: X_THROAT_L, y: ry }]
        .concat(fanPts(X_THROAT_L, ry, X_LINE_L, ly));
      pts.push({ x: -110, y: ly });
    } else {
      pts = [{ x: rd.cx, y: ry }, { x: X_THROAT_R, y: ry }]
        .concat(fanPts(X_THROAT_R, ry, X_LINE_R, ly));
      pts.push({ x: DESIGN_W + 110, y: ly });
    }
    return makePath(pts);
  }

  /* ================= the timetable ================= */
  var KINDS = [
    { k: 'express', cls: '1', label: 'Express', pax: 1, len: [7, 11], dwell: [2, 3], speed: 430, col: '#64f0c8', w: 0.26 },
    { k: 'stopper', cls: '2', label: 'Stopping service', pax: 1, len: [3, 6], dwell: [2, 4], speed: 350, col: '#7aa2ff', w: 0.34 },
    { k: 'freight', cls: '6', label: 'Freight', pax: 0, len: [10, 16], dwell: [5, 9], speed: 235, col: '#c08a55', w: 0.18 },
    { k: 'parcels', cls: '3', label: 'Parcels', pax: 0, len: [4, 7], dwell: [4, 6], speed: 320, col: '#e3cf94', w: 0.11 },
    { k: 'ecs', cls: '5', label: 'Empty stock', pax: 0, len: [4, 8], dwell: [3, 5], speed: 340, col: '#9fb3c8', w: 0.11 }
  ];
  function pickKind(r) {
    var x = r(), acc = 0;
    for (var i = 0; i < KINDS.length; i++) {
      acc += KINDS[i].w;
      if (x < acc) return KINDS[i];
    }
    return KINDS[KINDS.length - 1];
  }

  function roadOk(layout, tr, i) {
    var rd = layout.roads[i];
    if (rd.len < tr.len) return 'only ' + rd.len + ' coaches long';
    if (tr.pax && !tr.nonstop && rd.kind === 'loop') return 'no platform on the loop';
    if (rd.kind === 'bay' && !(tr.fromSide === 'W' && tr.toSide === 'W')) {
      return 'the bay is a dead end facing west';
    }
    return null;
  }
  function feasibleRoads(layout, tr) {
    var out = [];
    for (var i = 0; i < layout.roads.length; i++) if (!roadOk(layout, tr, i)) out.push(i);
    return out;
  }

  function buildTimetable(r, layout) {
    var n = irnd(r, 13, 17);
    var clock0 = irnd(r, 5, 20) * 60 + pick(r, [0, 15, 30, 45]);
    var trains = [], lastOn = {}, t = 4 + r() * 3, num = 2, i, guard;

    for (i = 0; i < n; i++) {
      var kind = pickKind(r);
      var fromSide = r() < 0.5 ? 'W' : 'E';
      var fromPool = fromSide === 'W' ? layout.west : layout.east;
      var order = shuffled(r, fromPool.map(function (l, j) { return j; }));
      order.sort(function (a, b) {
        return (lastOn[fromSide + a] || -99) - (lastOn[fromSide + b] || -99);
      });
      var fromLine = order[0];
      var last = lastOn[fromSide + fromLine];
      if (last != null && last > t - 5) t = last + 5;

      var terminates = r() < (kind.k === 'ecs' ? 0.55 : (kind.pax ? 0.26 : 0.18));
      var toSide = terminates ? fromSide : (fromSide === 'W' ? 'E' : 'W');
      var toPool = toSide === 'W' ? layout.west : layout.east;
      var toLine = Math.floor(r() * toPool.length);

      var tr = {
        kind: kind.k, cls: kind.cls, label: kind.label, pax: kind.pax,
        col: kind.col, speed: kind.speed,
        fromSide: fromSide, fromLine: fromLine,
        toSide: toSide, toLine: toLine,
        terminates: terminates ? 1 : 0,
        nonstop: 0,
        len: irnd(r, kind.len[0], kind.len[1])
      };
      if (!terminates && kind.pax) {
        tr.nonstop = r() < (kind.k === 'express' ? 0.34 : 0.1) ? 1 : 0;
      }

      guard = 0;
      while (feasibleRoads(layout, tr).length === 0 && guard < 30) {
        tr.len = Math.max(2, tr.len - 1); guard++;
        if (guard > 14) { tr.nonstop = 0; tr.pax = 0; }
      }
      if (feasibleRoads(layout, tr).length === 0) { i--; continue; }

      tr.id = 't' + i;
      tr.code = kind.cls + toPool[toLine].letter + pad2(num);
      num += irnd(r, 2, 6);
      tr.dwell = tr.nonstop ? 0 : irnd(r, kind.dwell[0], kind.dwell[1]) + (terminates ? 2 : 0);
      tr.bookedArr = Math.round(t * 10) / 10;
      tr.bookedDep = Math.round((t + tr.dwell) * 10) / 10;
      tr.enterAt = tr.bookedArr - 2.4;
      trains.push(tr);

      lastOn[fromSide + fromLine] = t;
      t += 2.1 + r() * 3.4;
    }

    var hardEnd = 0;
    trains.forEach(function (x) { hardEnd = Math.max(hardEnd, x.bookedDep); });
    return { trains: trains, clock0: clock0, hardEnd: hardEnd + 38 };
  }

  /* ================= live state ================= */
  function makeState(layout, tt) {
    var st = {
      layout: layout, tt: tt,
      trains: tt.trains.map(function (x) {
        var c = {}, k;
        for (k in x) if (Object.prototype.hasOwnProperty.call(x, k)) c[k] = x[k];
        c.state = 'due'; c.roadIdx = null; c.path = null; c.dist = 0;
        c.locked = null; c.pending = null; c.depAt = null; c.arrAt = null;
        c.dwellUntil = 0; c.delay = 0;
        return c;
      }),
      lock: {}, occ: {}, queues: {},
      time: 0, sel: null, over: false, finished: false
    };
    st.byId = {};
    st.trains.forEach(function (t) { st.byId[t.id] = t; });
    return st;
  }

  function qkey(tr) { return tr.fromSide + tr.fromLine; }
  function isHead(st, tr) {
    var q = st.queues[qkey(tr)];
    return !!(q && q[0] === tr.id);
  }
  function dequeue(st, tr) {
    var q = st.queues[qkey(tr)];
    if (!q) return;
    var i = q.indexOf(tr.id);
    if (i >= 0) q.splice(i, 1);
  }

  function setArrival(st, tr, roadIdx) {
    var L = st.layout;
    if (tr.state !== 'approach') return { ok: false, why: tr.code + ' is not waiting to come in.' };
    if (!isHead(st, tr)) {
      var ahead = st.byId[st.queues[qkey(tr)][0]];
      return { ok: false, why: tr.code + ' is stood behind ' + ahead.code + ' on the ' +
        lineOf(L, tr.fromSide, tr.fromLine).name + ' line.' };
    }
    var bad = roadOk(L, tr, roadIdx);
    if (bad) {
      return { ok: false, why: L.roads[roadIdx].title + ': ' + bad + ', and ' + tr.code +
        ' is ' + tr.len + ' coaches.' };
    }
    var secs = routeSections(L, tr.fromSide, tr.fromLine, roadIdx);
    var b = blocker(st, secs, tr.id);
    if (b) {
      return { ok: false, why: 'Will not set — ' + sectionName(L, b.sec) + ' is held by ' +
        st.byId[b.by].code + '.' };
    }

    lockAll(st, secs, tr.id);
    st.occ['r:' + roadIdx] = tr.id;
    tr.locked = secs;
    tr.roadIdx = roadIdx;
    tr.path = arrivalPath(L, tr.fromSide, tr.fromLine, roadIdx);
    tr.dist = 0;
    tr.state = 'running';
    dequeue(st, tr);
    return { ok: true };
  }

  function setDeparture(st, tr) {
    var L = st.layout;
    if (tr.state === 'departing') return { ok: false, why: tr.code + ' is already away.' };
    if (tr.state !== 'standing' && tr.state !== 'running') {
      return { ok: false, why: tr.code + ' is not in the station yet.' };
    }
    if (tr.pending) return { ok: false, why: 'The road is already set for ' + tr.code + '.' };
    var secs = routeSections(L, tr.toSide, tr.toLine, tr.roadIdx);
    var b = blocker(st, secs, tr.id);
    if (b) {
      return { ok: false, why: 'Will not clear — ' + sectionName(L, b.sec) + ' is held by ' +
        st.byId[b.by].code + '.' };
    }

    lockAll(st, secs, tr.id);
    tr.pending = { secs: secs, path: departurePath(L, tr.toSide, tr.toLine, tr.roadIdx) };
    if (tr.state === 'standing' && st.time >= tr.dwellUntil) startDeparture(st, tr);
    return { ok: true };
  }

  function startDeparture(st, tr) {
    releaseAll(st, tr.locked, tr.id);
    tr.locked = tr.pending.secs;
    tr.path = tr.pending.path;
    tr.pending = null;
    tr.dist = 0;
    tr.state = 'departing';
    tr.depAt = st.time;
    tr.delay = Math.max(0, st.time - tr.bookedDep);
  }

  function advance(st, tr, dt) {
    var v = tr.speed;
    if (tr.state === 'running') {
      var rem = tr.path.len - tr.dist;
      if (rem < 110) v *= Math.max(0.30, rem / 110);
    } else {
      v *= Math.min(1, 0.32 + tr.dist / 80);
    }
    tr.dist += v * dt;
    if (tr.dist < tr.path.len) return;
    tr.dist = tr.path.len;
    if (tr.state === 'running') {
      releaseAll(st, tr.locked, tr.id);
      tr.locked = null;
      // a road already set ahead of it must not be let go with the arrival route
      if (tr.pending) lockAll(st, tr.pending.secs, tr.id);
      tr.state = 'standing';
      tr.arrAt = st.time;
      tr.dwellUntil = st.time + tr.dwell;
    } else {
      releaseAll(st, tr.locked, tr.id);
      if (st.occ['r:' + tr.roadIdx] === tr.id) st.occ['r:' + tr.roadIdx] = null;
      tr.locked = null;
      tr.state = 'gone';
    }
  }

  function step(st, dt) {
    st.time += dt;
    var i, tr, k;
    for (i = 0; i < st.trains.length; i++) {
      tr = st.trains[i];
      if (tr.state === 'due') {
        if (st.time >= tr.enterAt) {
          tr.state = 'approach';
          k = qkey(tr);
          (st.queues[k] || (st.queues[k] = [])).push(tr.id);
        }
      } else if (tr.state === 'running' || tr.state === 'departing') {
        advance(st, tr, dt);
      } else if (tr.state === 'standing') {
        if (tr.pending && st.time >= tr.dwellUntil) startDeparture(st, tr);
      }
    }
    var live = 0;
    for (i = 0; i < st.trains.length; i++) if (st.trains[i].state !== 'gone') live++;
    if (live === 0 || st.time > st.tt.hardEnd) st.over = true;
  }

  function trainDelay(st, tr) {
    if (tr.state === 'gone' || tr.state === 'departing') return tr.delay || 0;
    return Math.max(0, st.time - tr.bookedDep);
  }
  function tally(st) {
    var total = 0, right = 0, done = 0;
    st.trains.forEach(function (tr) {
      var d = trainDelay(st, tr);
      total += d;
      if (tr.depAt != null) { done++; if (d < 1.5) right++; }
    });
    return { total: total, right: right, done: done, n: st.trains.length };
  }

  /* ================= the panel working it itself ================= */
  function autoDispatch(st) {
    var L = st.layout, i, tr;
    var order = st.trains.slice().sort(function (a, b) { return a.bookedDep - b.bookedDep; });
    for (i = 0; i < order.length; i++) {
      tr = order[i];
      if (tr.state === 'standing' && !tr.pending && st.time >= tr.dwellUntil) setDeparture(st, tr);
    }
    for (i = 0; i < order.length; i++) {
      tr = order[i];
      if (tr.state !== 'approach' || !isHead(st, tr)) continue;
      var cands = feasibleRoads(L, tr), best = -1, bestScore = 1e9;
      for (var j = 0; j < cands.length; j++) {
        var rid = cands[j];
        var secs = routeSections(L, tr.fromSide, tr.fromLine, rid);
        if (blocker(st, secs, tr.id)) continue;
        var rd = L.roads[rid];
        var score = Math.abs(rd.idx - lineOf(L, tr.fromSide, tr.fromLine).attach)
          + (rd.len - tr.len) * 0.28
          + (rd.kind === 'loop' ? (tr.pax ? 3 : -1.2) : 0)
          + (rd.kind === 'bay' ? -0.8 : 0);
        if (score < bestScore) { bestScore = score; best = rid; }
      }
      if (best >= 0) setArrival(st, tr, best);
    }
  }

  function referenceRun(layout, tt) {
    var st = makeState(layout, tt), guard = 0;
    while (!st.over && guard < 20000) {
      autoDispatch(st);
      step(st, 0.05);
      guard++;
    }
    var t = tally(st);
    return { delay: t.total, right: t.right, done: t.done, n: t.n };
  }

  function deal(seed) {
    var r = rng(seed);
    var layout = buildLayout(r);
    var best = null, deals = 0;
    for (var a = 0; a < 16; a++) {
      var tt = buildTimetable(r, layout);
      var res = referenceRun(layout, tt);
      deals++;
      if (!best || res.delay < best.res.delay) best = { tt: tt, res: res };
      if (res.delay <= 4) break;
    }
    return { seed: seed, layout: layout, tt: best.tt, ref: best.res, deals: deals };
  }

  /* ================= presentation ================= */
  var cv = document.getElementById('jn');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var scale = 1, DPR = 1;

  var deck = null, st = null, running = false, auto = false, rate = 1;
  var lastFrame = 0, noteUntil = 0, listDue = 0;

  function $(id) { return document.getElementById(id); }
  function fmtClock(s2, m) {
    var t = Math.floor(s2.tt.clock0 + m) % 1440;
    if (t < 0) t += 1440;
    return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60);
  }
  function say(msg, good) {
    var el = $('noteOut');
    if (!el) return;
    el.textContent = msg;
    el.style.color = good ? '#64f0c8' : '#ffc2cd';
    el.style.opacity = msg ? '1' : '0';
    noteUntil = msg ? (Date.now() + 4600) : 0;
  }

  function resize() {
    if (!deck) return;
    var cssW = cv.clientWidth || 900;
    scale = cssW / DESIGN_W;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var h = deck.layout.height;
    cv.style.height = Math.round(h * scale) + 'px';
    cv.width = Math.max(1, Math.round(cssW * DPR));
    cv.height = Math.max(1, Math.round(h * scale * DPR));
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, 0, 0);
    draw();
  }

  function roundRect(x, y, w, h, r2) {
    ctx.beginPath();
    ctx.moveTo(x + r2, y);
    ctx.arcTo(x + w, y, x + w, y + h, r2);
    ctx.arcTo(x + w, y + h, x, y + h, r2);
    ctx.arcTo(x, y + h, x, y, r2);
    ctx.arcTo(x, y, x + w, y, r2);
    ctx.closePath();
  }
  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  function draw() {
    if (!st) return;
    var L = st.layout, H = L.height, i, rd;

    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, DESIGN_W, H);

    ctx.textBaseline = 'middle';
    ctx.font = '600 13px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b97ab';
    ctx.fillText(L.station.toUpperCase() + '  ·  SIGNAL BOX', 14, 24);
    ctx.textAlign = 'right';
    ctx.fillStyle = st.over ? '#8b97ab' : '#64f0c8';
    ctx.font = '700 22px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.fillText(fmtClock(st, st.time), DESIGN_W - 14, 24);

    var tx0 = 14, tx1 = DESIGN_W - 14, span = st.tt.hardEnd;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tx0, 50); ctx.lineTo(tx1, 50); ctx.stroke();
    st.trains.forEach(function (tr) {
      var x = tx0 + (tx1 - tx0) * (tr.bookedArr / span);
      ctx.strokeStyle = tr.state === 'gone' ? 'rgba(255,255,255,.18)'
        : (trainDelay(st, tr) > 1.5 ? '#e0687f' : tr.col);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, 56); ctx.stroke();
    });
    var nx = tx0 + (tx1 - tx0) * Math.min(1, st.time / span);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(nx, 40); ctx.lineTo(nx, 60); ctx.stroke();

    var sel = st.sel ? st.byId[st.sel] : null;
    if (sel && sel.state === 'approach') {
      for (i = 0; i < L.roads.length; i++) {
        rd = L.roads[i];
        var why = roadOk(L, sel, i);
        var b2 = why ? null : blocker(st, routeSections(L, sel.fromSide, sel.fromLine, i), sel.id);
        ctx.fillStyle = why ? 'rgba(224,104,127,.07)'
          : (b2 ? 'rgba(255,180,91,.08)' : 'rgba(100,240,200,.10)');
        ctx.fillRect(rd.x0 - 6, rd.y - 17, rd.x1 - rd.x0 + 12, 34);
      }
    }

    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.085)';
    ctx.lineWidth = 1.6;
    L.west.forEach(function (l) {
      var ly = L.roads[l.attach].y;
      for (var k = 0; k < L.roads.length; k++) {
        poly([{ x: X_LINE_L, y: ly }].concat(fanPts(X_LINE_L, ly, X_THROAT_L, L.roads[k].y)));
        ctx.stroke();
      }
    });
    L.east.forEach(function (l) {
      var ly = L.roads[l.attach].y;
      for (var k = L.eastMin; k <= L.eastMax; k++) {
        poly([{ x: X_LINE_R, y: ly }].concat(fanPts(X_LINE_R, ly, X_THROAT_R, L.roads[k].y)));
        ctx.stroke();
      }
    });

    for (i = 0; i < L.roads.length; i++) {
      rd = L.roads[i];
      var occ = st.occ['r:' + i], lk = st.lock['r:' + i];
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = occ ? 'rgba(255,180,91,.55)'
        : (lk ? 'rgba(122,162,255,.55)' : 'rgba(255,255,255,.20)');
      ctx.beginPath(); ctx.moveTo(rd.x0, rd.y); ctx.lineTo(rd.x1, rd.y); ctx.stroke();
      if (rd.noEast) {
        ctx.strokeStyle = 'rgba(224,104,127,.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(rd.x1 + 3, rd.y - 9); ctx.lineTo(rd.x1 + 3, rd.y + 9); ctx.stroke();
      }
    }

    ctx.lineWidth = 3.2;
    L.west.forEach(function (l, j) {
      var ly = L.roads[l.attach].y;
      ctx.strokeStyle = st.lock['w:' + j] ? 'rgba(122,162,255,.6)' : 'rgba(255,255,255,.20)';
      ctx.beginPath(); ctx.moveTo(X_EDGE_L, ly); ctx.lineTo(X_LINE_L, ly); ctx.stroke();
    });
    L.east.forEach(function (l, j) {
      var ly = L.roads[l.attach].y;
      ctx.strokeStyle = st.lock['e:' + j] ? 'rgba(122,162,255,.6)' : 'rgba(255,255,255,.20)';
      ctx.beginPath(); ctx.moveTo(X_LINE_R, ly); ctx.lineTo(X_EDGE_R, ly); ctx.stroke();
    });

    for (i = 0; i < L.roads.length; i++) {
      rd = L.roads[i];
      var w = Math.min(rd.len * COACH, rd.x1 - rd.x0 - 6);
      var px = rd.cx - w / 2;
      if (rd.kind === 'loop') {
        ctx.strokeStyle = 'rgba(255,255,255,.14)';
        ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px, rd.y + 12); ctx.lineTo(px + w, rd.y + 12); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.11)';
        roundRect(px, rd.y + 8, w, 8, 4); ctx.fill();
      }
      ctx.font = '700 11px ui-monospace,SFMono-Regular,Menlo,monospace';
      ctx.textAlign = 'right'; ctx.fillStyle = '#8b97ab';
      ctx.fillText(rd.label, rd.x0 - 12, rd.y);
      ctx.textAlign = 'left';
      ctx.font = '10px ui-monospace,SFMono-Regular,Menlo,monospace';
      ctx.fillStyle = 'rgba(139,151,171,.6)';
      ctx.fillText(rd.len + ' coach', px, rd.y + 27);
    }

    st.trains.forEach(function (tr) {
      if (!tr.path && !tr.pending) return;
      if (tr.state !== 'running' && tr.state !== 'departing' && !tr.pending) return;
      var p = tr.pending ? tr.pending.path : tr.path;
      ctx.strokeStyle = 'rgba(122,162,255,.75)';
      ctx.lineWidth = 2.4;
      poly(p.pts); ctx.stroke();
    });

    ctx.font = '600 10px ui-monospace,SFMono-Regular,Menlo,monospace';
    L.west.forEach(function (l) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#8b97ab';
      ctx.fillText(l.name.toUpperCase(), X_EDGE_L + 2, L.roads[l.attach].y - 15);
    });
    L.east.forEach(function (l) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#8b97ab';
      ctx.fillText(l.name.toUpperCase(), X_EDGE_R - 2, L.roads[l.attach].y - 15);
    });

    st.trains.forEach(function (tr) {
      if (tr.state !== 'running' && tr.state !== 'departing' && tr.state !== 'standing') return;
      var half = tr.len * COACH * 0.46;
      var body = sliceAt(tr.path, tr.dist - half, tr.dist + half);
      var late = trainDelay(st, tr) > 1.5;
      ctx.lineCap = 'butt';
      if (st.sel === tr.id || late) {
        ctx.strokeStyle = st.sel === tr.id ? '#ffffff' : '#e0687f';
        ctx.lineWidth = 19;
        ctx.globalAlpha = 0.3;
        poly(body); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = tr.col;
      ctx.lineWidth = 14;
      ctx.globalAlpha = 0.92;
      poly(body); ctx.stroke();
      ctx.globalAlpha = 1;
      var mid = ptAt(tr.path, tr.dist);
      ctx.font = '700 10px ui-monospace,SFMono-Regular,Menlo,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#07090d';
      ctx.fillText(tr.code, mid.x, mid.y + 0.5);
      ctx.lineCap = 'round';
    });

    var counts = {};
    st.trains.forEach(function (tr) {
      if (tr.state !== 'approach') return;
      var k = qkey(tr);
      var nth = counts[k] || 0;
      counts[k] = nth + 1;
      var ly = L.roads[lineOf(L, tr.fromSide, tr.fromLine).attach].y;
      var w = 58, h = 18;
      var x = tr.fromSide === 'W'
        ? X_LINE_L - 40 - nth * (w + 8) - w
        : X_LINE_R + 40 + nth * (w + 8);
      var late = trainDelay(st, tr) > 1.5;
      ctx.fillStyle = late ? 'rgba(224,104,127,.22)' : 'rgba(255,255,255,.08)';
      roundRect(x, ly - h / 2, w, h, 9); ctx.fill();
      ctx.strokeStyle = st.sel === tr.id ? '#ffffff' : (late ? '#e0687f' : 'rgba(255,255,255,.22)');
      ctx.lineWidth = 1.4;
      roundRect(x, ly - h / 2, w, h, 9); ctx.stroke();
      ctx.font = '700 10px ui-monospace,SFMono-Regular,Menlo,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = late ? '#ffc2cd' : '#c3ccdb';
      ctx.fillText(tr.code, x + w / 2, ly + 0.5);
    });
  }

  function designPt(e) {
    var rect = cv.getBoundingClientRect();
    var k = rect.width / DESIGN_W;
    return { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k };
  }
  function hitTrain(p) {
    var L = st.layout, hit = null;
    st.trains.forEach(function (tr) {
      if (tr.state === 'running' || tr.state === 'departing' || tr.state === 'standing') {
        var mid = ptAt(tr.path, tr.dist);
        var half = tr.len * COACH * 0.5;
        if (Math.abs(p.y - mid.y) < 13 && Math.abs(p.x - mid.x) < half + 6) hit = tr;
      } else if (tr.state === 'approach') {
        var ly = L.roads[lineOf(L, tr.fromSide, tr.fromLine).attach].y;
        if (Math.abs(p.y - ly) < 14 &&
          (tr.fromSide === 'W' ? p.x < X_LINE_L : p.x > X_LINE_R)) hit = tr;
      }
    });
    return hit;
  }
  function hitRoad(p) {
    var L = st.layout;
    for (var i = 0; i < L.roads.length; i++) {
      var rd = L.roads[i];
      if (Math.abs(p.y - rd.y) < 17 && p.x > rd.x0 - 8 && p.x < rd.x1 + 8) return i;
    }
    return -1;
  }

  function tryDepart(tr) {
    if (tr.state === 'standing' && st.time < tr.dwellUntil) {
      say(tr.code + ' is still working — booked away at ' + fmtClock(st, tr.bookedDep) + '.', 0);
      return;
    }
    var res = setDeparture(st, tr);
    if (res.ok) {
      say('Road set for ' + tr.code + ' to ' + lineOf(st.layout, tr.toSide, tr.toLine).name + '.', 1);
      nextSel();
    } else say(res.why, 0);
  }

  function tryArrive(tr, ri) {
    var res = setArrival(st, tr, ri);
    if (res.ok) {
      say('Road set for ' + tr.code + ' into ' + st.layout.roads[ri].title + '.', 1);
      nextSel();
    } else say(res.why, 0);
  }

  function onClick(e) {
    if (!st) return;
    var p = designPt(e);
    var tr = hitTrain(p);
    if (tr) {
      if (st.sel === tr.id && (tr.state === 'standing' || tr.state === 'running')) tryDepart(tr);
      else { st.sel = tr.id; say('', 1); }
      refresh();
      return;
    }
    var ri = hitRoad(p);
    var sel = st.sel ? st.byId[st.sel] : null;
    if (ri >= 0 && sel) {
      if (sel.state === 'approach') tryArrive(sel, ri);
      else if ((sel.state === 'standing' || sel.state === 'running') && sel.roadIdx === ri) tryDepart(sel);
      refresh();
    }
  }

  function nextSel() {
    var best = null;
    st.trains.forEach(function (tr) {
      if (tr.state === 'approach' && isHead(st, tr)) {
        if (!best || tr.bookedArr < best.bookedArr) best = tr;
      }
    });
    if (!best) {
      st.trains.forEach(function (tr) {
        if (tr.state === 'standing' && !tr.pending) {
          if (!best || tr.bookedDep < best.bookedDep) best = tr;
        }
      });
    }
    st.sel = best ? best.id : null;
  }

  var STATE_WORDS = {
    due: 'not yet due', approach: 'waiting outside', running: 'coming in',
    standing: 'at the platform', departing: 'away', gone: 'cleared'
  };
  function renderList() {
    var el = $('board');
    if (!el) return;
    var L = st.layout;
    var rows = ['<table class="stock"><tr><th>Code</th><th>Service</th><th>From</th>' +
      '<th>To</th><th>In</th><th>Away</th><th>Road</th><th>State</th></tr>'];
    st.trains.forEach(function (tr) {
      var d = trainDelay(st, tr);
      var cls = [];
      if (st.sel === tr.id) cls.push('sel');
      if (d > 1.5 && tr.state !== 'gone') cls.push('late');
      if (tr.state === 'gone') cls.push('done');
      var word = STATE_WORDS[tr.state];
      if (tr.state === 'standing' && tr.pending) word = 'road set away';
      if (tr.state === 'gone') word = d < 1.5 ? 'right time' : 'late ' + d.toFixed(0) + 'm';
      else if (d > 1.5) word += ' · ' + d.toFixed(0) + 'm late';
      rows.push('<tr class="' + cls.join(' ') + '" data-id="' + tr.id + '">' +
        '<td class="mat">' + tr.code + '</td>' +
        '<td>' + tr.label + ' · ' + tr.len + '</td>' +
        '<td>' + lineOf(L, tr.fromSide, tr.fromLine).name + '</td>' +
        '<td>' + lineOf(L, tr.toSide, tr.toLine).name + (tr.nonstop ? ' (non-stop)' : '') + '</td>' +
        '<td>' + fmtClock(st, tr.bookedArr) + '</td>' +
        '<td>' + fmtClock(st, tr.bookedDep) + '</td>' +
        '<td>' + (tr.roadIdx == null ? '—' : L.roads[tr.roadIdx].label) + '</td>' +
        '<td>' + word + '</td></tr>');
    });
    rows.push('</table>');
    el.innerHTML = rows.join('');
  }

  function refresh() {
    var t = tally(st);
    $('clockOut').textContent = fmtClock(st, st.time);
    $('workedOut').textContent = t.done + '/' + t.n;
    $('lateOut').textContent = t.total.toFixed(0) + ' min';
    $('rightOut').textContent = t.done ? Math.round(100 * t.right / t.done) + '%' : '—';
    var sel = st.sel ? st.byId[st.sel] : null;
    var go = $('btnGo');
    var canGo = !!(sel && (sel.state === 'standing' || sel.state === 'running') && !sel.pending);
    go.textContent = canGo ? 'Send ' + sel.code + ' away' : 'Send it away';
    go.disabled = !canGo;
    go.style.opacity = canGo ? '1' : '.45';
    renderList();
    draw();
    if (st.over) finish();
  }

  function finish() {
    if (st.finished) return;
    st.finished = true;
    running = false;
    $('btnPlay').textContent = 'Shift over';
    var t = tally(st);
    var v = $('verdict');
    var pct = t.done ? Math.round(100 * t.right / t.done) : 0;
    var ref = deck.ref;
    var good = t.total <= ref.delay + 0.5;
    v.className = 'verdict ' + (good ? 'right' : 'wrong');
    v.style.display = 'block';
    v.innerHTML = '<b>' + fmtClock(st, st.time) + ' — relieved.</b> ' +
      t.done + ' of ' + t.n + ' trains got away, ' + pct + '% of them at right time, ' +
      t.total.toFixed(0) + ' minutes lost in all. The panel worked this same shift before ' +
      'you arrived and lost ' + ref.delay.toFixed(0) + '. ' +
      (good ? 'You are better at this than it is.' : 'It is still better at this than you are.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(140, now - lastFrame) / 1000;
    lastFrame = now;
    if (st && running && !st.over) {
      var left = dt * rate;
      while (left > 0) {
        var s = Math.min(0.05, left);
        if (auto) autoDispatch(st);
        step(st, s);
        left -= s;
        if (st.over) break;
      }
      if (now > listDue) { listDue = now + 220; refresh(); }
      else draw();
    }
    if (noteUntil && Date.now() > noteUntil) {
      noteUntil = 0;
      var n = $('noteOut');
      if (n) n.style.opacity = '0';
    }
  }

  function start(seed) {
    deck = deal(seed);
    st = makeState(deck.layout, deck.tt);
    running = false; auto = false;
    $('verdict').style.display = 'none';
    $('btnPlay').textContent = 'Start the shift';
    $('btnAuto').classList.remove('on');
    $('seedOut').textContent = String(seed);
    $('stationOut').textContent = deck.layout.station;
    $('refOut').textContent = deck.ref.delay.toFixed(0) + ' min';
    nextSel();
    resize();
    refresh();

    var L = deck.layout;
    var plats = L.roads.filter(function (x) { return x.kind === 'plat'; }).length;
    var bays = L.roads.filter(function (x) { return x.kind === 'bay'; }).length;
    var loops = L.roads.filter(function (x) { return x.kind === 'loop'; }).length;
    var first = deck.tt.trains[0], last = deck.tt.trains[deck.tt.trains.length - 1];
    $('briefOut').innerHTML =
      '<p class="lead-line">' + L.station + '. ' + L.west.length + ' line' +
      (L.west.length === 1 ? '' : 's') + ' in from the west, ' + L.east.length +
      ' from the east, ' + plats + ' through platform' + (plats === 1 ? '' : 's') +
      (bays ? ', a bay' : '') + (loops ? ' and a goods loop' : '') + '.</p>' +
      '<p>Booked over your turn of duty: <b>' + deck.tt.trains.length + '</b> trains, the ' +
      'first due at <b>' + fmtClock(st, first.bookedArr) + '</b> and the last away at <b>' +
      fmtClock(st, last.bookedDep) + '</b>. You decide which road each of them goes into ' +
      'and when it is let out again. The interlocking decides whether it will let you.</p>' +
      '<p class="dimline">This timetable was drafted ' + deck.deals + ' time' +
      (deck.deals === 1 ? '' : 's') + ' and each draft worked right through before you ' +
      'arrived. The one you have is the draft the panel itself got round with the least ' +
      'delay — <b>' + deck.ref.delay.toFixed(0) + ' minute' +
      (Math.round(deck.ref.delay) === 1 ? '' : 's') + ' lost</b>. That is the number to beat.</p>';
  }

  function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }

  wire('btnPlay', function () {
    if (!st || st.over) return;
    running = !running;
    lastFrame = performance.now();
    this.textContent = running ? 'Pause' : 'Carry on';
  });
  wire('btnGo', function () {
    var sel = st && st.sel ? st.byId[st.sel] : null;
    if (sel) { tryDepart(sel); refresh(); }
  });
  wire('btnAuto', function () {
    auto = !auto;
    if (auto) this.classList.add('on'); else this.classList.remove('on');
    if (auto && !running && st && !st.over) {
      running = true;
      lastFrame = performance.now();
      $('btnPlay').textContent = 'Pause';
    }
  });
  wire('btnNew', function () { start((Math.random() * 4294967295) >>> 0); });
  wire('btnToday', function () { start(seedForToday()); });

  cv.addEventListener('click', onClick);

  $('board').addEventListener('click', function (e) {
    var row = e.target;
    while (row && row.tagName !== 'TR') row = row.parentNode;
    if (!row || !row.getAttribute) return;
    var id = row.getAttribute('data-id');
    if (!id) return;
    var t = st.byId[id];
    if (st.sel === id && (t.state === 'standing' || t.state === 'running')) tryDepart(t);
    else st.sel = id;
    refresh();
  });

  document.addEventListener('keydown', function (e) {
    if (!st) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var k = e.key;
    if (k === ' ') {
      e.preventDefault();
      if (!st.over) {
        running = !running;
        lastFrame = performance.now();
        $('btnPlay').textContent = running ? 'Pause' : 'Carry on';
      }
      return;
    }
    var sel = st.sel ? st.byId[st.sel] : null;
    if (k >= '1' && k <= '9') {
      var i = parseInt(k, 10) - 1;
      if (sel && sel.state === 'approach' && i < st.layout.roads.length) {
        tryArrive(sel, i);
        refresh();
      }
      return;
    }
    if (k === 'd' || k === 'D' || k === 'Enter') {
      if (sel) { tryDepart(sel); refresh(); }
      return;
    }
    if (k === 'n' || k === 'N') start((Math.random() * 4294967295) >>> 0);
    if (k === 't' || k === 'T') start(seedForToday());
  });

  var speeds = document.getElementById('speeds');
  [0.5, 1, 2, 4].forEach(function (s) {
    var b = document.createElement('button');
    b.className = 'chip' + (s === 1 ? ' on' : '');
    b.textContent = '×' + s;
    b.addEventListener('click', function () {
      rate = s;
      Array.prototype.forEach.call(speeds.children, function (c) { c.classList.remove('on'); });
      b.classList.add('on');
    });
    speeds.appendChild(b);
  });

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && running) {
      running = false;
      $('btnPlay').textContent = 'Carry on';
    }
  });

  start(seedForToday());
  lastFrame = performance.now();
  requestAnimationFrame(frame);
})();
