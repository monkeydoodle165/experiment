/* drift.quibo.games — The Ballot
   Social choice. The day's number founds a Victorian literary and philosophical society,
   puts four or five members up for its presidency and has every member rank them all.
   The same papers are then counted five ways (first preferences, a second ballot, Hare's
   transfers, Borda's points and Condorcet's head-to-head question) and the generator keeps
   drawing electorates until those methods disagree. You call each count before it is
   made. Then the council adopts one method for the real election and hands you one
   faction's papers: rearrange them, once, and see whether lying gets them a better
   president than the truth. A brute-force search knows the best that could be done.
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
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  var TOWNS = ['Wexcombe', 'Carrow', 'Haldon Bridge', 'Stannary', 'Ludmere', 'Corbridge', 'Ashenford', 'Pellow', 'Brantwick', 'Tamsworth', 'Kelling', 'Oxenhope', 'Saltmarsh', 'Harrowgate Moor'];
  var SURN = ['Pettifer', 'Ormerod', 'Lightfoot', 'Quarles', 'Venning', 'Ashby', 'Treloar', 'Haverstock', 'Mabey', 'Greenhalgh', 'Sowerby', 'Fennimore', 'Catchpole', 'Dimmock', 'Rennard', 'Tulliver'];
  var TITLES = ['Dr', 'Mr', 'Miss', 'Mrs', 'The Revd', 'Professor', 'Captain'];
  var FIELDS = ['a geologist', 'an astronomer', 'a physician', 'a botanist', 'a chemist', 'an antiquary', 'an engineer', 'a mathematician', 'a naturalist', 'a schoolmaster', 'a printer', 'a surveyor'];
  var PLANKS = ['wants the subscriptions spent on a telescope', 'would buy fossils for the museum room', 'would print the Transactions twice a year', 'wants the reading room open on Sundays', 'proposes a dredging expedition to the estuary', 'would found a prize for the best essay', 'wants the library catalogued at last', 'would pay a curator a proper salary', 'wants the lectures moved to the evening', 'would lower the subscription to bring in the mills', 'wants a weather station on the roof', 'would sell the stuffed bear'];
  var COLS = ['#64f0c8', '#7aa2ff', '#ffce6a', '#ff8fa3', '#c89bff'];

  /* ---------- counting ---------- */
  // a profile is a list of factions {n, order:[candidate indices, best first]}
  function total(P) { var t = 0; P.forEach(function (f) { t += f.n; }); return t; }
  function topAlive(order, alive) { for (var i = 0; i < order.length; i++) if (alive[order[i]]) return order[i]; return -1; }
  function firsts(P, C, alive) {
    var t = []; for (var c = 0; c < C; c++) t.push(0);
    P.forEach(function (f) { var c = topAlive(f.order, alive); if (c >= 0) t[c] += f.n; });
    return t;
  }
  function allAlive(C) { var a = []; for (var c = 0; c < C; c++) a.push(true); return a; }
  // ties go by lot: lot[c] is c's place in the draw, 0 the luckiest
  function best(t, alive, lot) {
    var b = -1;
    for (var c = 0; c < t.length; c++) if (alive[c] && (b < 0 || t[c] > t[b] || (t[c] === t[b] && lot[c] < lot[b]))) b = c;
    return b;
  }
  function worst(t, alive, lot) {
    var w = -1;
    for (var c = 0; c < t.length; c++) if (alive[c] && (w < 0 || t[c] < t[w] || (t[c] === t[w] && lot[c] > lot[w]))) w = c;
    return w;
  }
  function headToHead(P, a, b) {
    var x = 0, y = 0;
    P.forEach(function (f) { if (f.order.indexOf(a) < f.order.indexOf(b)) x += f.n; else y += f.n; });
    return [x, y];
  }
  function plurality(P, C, lot) {
    var t = firsts(P, C, allAlive(C));
    return { tally: t, winner: best(t, allAlive(C), lot) };
  }
  function runoff(P, C, lot) {
    var al = allAlive(C), t = firsts(P, C, al), N = total(P);
    var a = best(t, al, lot);
    if (t[a] * 2 > N) return { tally: t, outright: true, winner: a };
    var al2 = al.slice(); al2[a] = false;
    var b = best(t, al2, lot);
    var h = headToHead(P, a, b);
    var w = h[0] > h[1] || (h[0] === h[1] && lot[a] < lot[b]) ? a : b;
    return { tally: t, outright: false, pair: [a, b], h: h, winner: w };
  }
  function hare(P, C, lot) {
    var al = allAlive(C), N = total(P), rounds = [];
    for (var k = 0; k < C; k++) {
      var t = firsts(P, C, al), lead = best(t, al, lot);
      if (t[lead] * 2 > N) { rounds.push({ tally: t, alive: al.slice(), out: -1 }); return { rounds: rounds, winner: lead }; }
      var out = worst(t, al, lot), al2 = al.slice(); al2[out] = false;
      var t2 = firsts(P, C, al2), gain = [];
      for (var c = 0; c < C; c++) gain.push(al2[c] ? t2[c] - t[c] : 0);
      rounds.push({ tally: t, alive: al.slice(), out: out, gain: gain });
      al = al2;
    }
    return { rounds: rounds, winner: best(firsts(P, C, al), al, lot) };
  }
  function borda(P, C, lot) {
    var s = []; for (var c = 0; c < C; c++) s.push(0);
    P.forEach(function (f) { f.order.forEach(function (c, i) { s[c] += f.n * (C - 1 - i); }); });
    return { scores: s, winner: best(s, allAlive(C), lot) };
  }
  function pairwise(P, C) {
    var M = [];
    for (var a = 0; a < C; a++) { M.push([]); for (var b = 0; b < C; b++) M[a].push(a === b ? 0 : headToHead(P, a, b)[0]); }
    return M;
  }
  function condorcet(P, C) {
    var M = pairwise(P, C);
    for (var a = 0; a < C; a++) {
      var ok = true;
      for (var b = 0; b < C; b++) if (a !== b && M[a][b] <= M[b][a]) { ok = false; break; }
      if (ok) return { M: M, winner: a };
    }
    return { M: M, winner: -1 };
  }
  var SYS = {
    plurality: plurality, runoff: runoff, hare: hare, borda: borda,
    condorcet: function (P, C) { return condorcet(P, C); }
  };
  function perms(C) {
    var out = [];
    (function go(pre, rest) {
      if (!rest.length) { out.push(pre); return; }
      rest.forEach(function (x, i) { go(pre.concat([x]), rest.slice(0, i).concat(rest.slice(i + 1))); });
    })([], (function () { var a = []; for (var c = 0; c < C; c++) a.push(c); return a; })());
    return out;
  }
  // the best a single faction can get for itself under sys by all filling in the same paper
  function manipulate(P, C, lot, sys, fi, PERMS) {
    var me = P[fi].order, w0 = SYS[sys](P, C, lot).winner, r0 = me.indexOf(w0);
    var res = { sincere: w0, best: w0, bestRank: r0, ballot: me.slice(), count: 0 };
    PERMS.forEach(function (p) {
      var Q = P.map(function (f, i) { return i === fi ? { n: f.n, order: p } : f; });
      var w = SYS[sys](Q, C, lot).winner, r = me.indexOf(w);
      if (r < r0) res.count++;
      if (r < res.bestRank) { res.best = w; res.bestRank = r; res.ballot = p.slice(); }
    });
    return res;
  }

  /* ---------- the day ---------- */
  var KEYS = ['plurality', 'runoff', 'hare', 'borda', 'condorcet'];
  function winnersOf(P, C, lot) { return KEYS.map(function (k) { return SYS[k](P, C, lot).winner; }); }
  function distinct(W) { var s = {}; W.forEach(function (w) { s[w] = 1; }); return Object.keys(s).length; }

  function drawProfile(r, C) {
    var cand = [], P = [], K = 5 + Math.floor(r() * 4), i, c;
    for (c = 0; c < C; c++) cand.push([r(), r()]);
    for (i = 0; i < K; i++) {
      var order;
      if (r() < 0.25) order = shuffle(r, cand.map(function (_, j) { return j; }));
      else {
        var p = [r(), r()];
        order = cand.map(function (q, j) { return { j: j, d: Math.hypot(q[0] - p[0], q[1] - p[1]) + r() * 0.12 }; })
          .sort(function (a, b) { return a.d - b.d; }).map(function (o) { return o.j; });
      }
      var n = 2 + Math.floor(Math.pow(r(), 1.4) * 14);
      var key = order.join(''), hit = null;
      P.forEach(function (f) { if (f.order.join('') === key) hit = f; });
      if (hit) hit.n += n; else P.push({ n: n, order: order });
    }
    if (total(P) % 2 === 0) P[Math.floor(r() * P.length)].n += 1;   // an odd house, so no head-to-head is ever tied
    P.sort(function (a, b) { return b.n - a.n; });
    return P;
  }

  function build(seed) {
    var r = rng(seed), D = { seed: seed };
    D.town = pick(r, TOWNS);
    D.year = 1838 + Math.floor(r() * 62);
    D.society = 'The ' + D.town + ' Literary and Philosophical Society';
    D.C = r() < 0.55 ? 4 : 5;
    var C = D.C, sn = shuffle(r, SURN), fl = shuffle(r, FIELDS), pl = shuffle(r, PLANKS);
    D.cands = [];
    for (var c = 0; c < C; c++) D.cands.push({ title: pick(r, TITLES), name: sn[c], field: fl[c], plank: pl[c], col: COLS[c] });
    D.secretary = sn[C];
    D.lotOrder = shuffle(r, D.cands.map(function (_, j) { return j; }));
    D.lot = []; D.lotOrder.forEach(function (c, i) { D.lot[c] = i; });
    var wantCycle = r() < 0.3;
    var PERMS = perms(C), bestP = null, bestScore = -1, bestManip = null;
    for (var tries = 0; tries < 900; tries++) {
      var P = drawProfile(r, C), W = winnersOf(P, C, D.lot), dd = distinct(W.filter(function (w) { return w >= 0; }));
      if (dd < 3 && tries < 800) continue;
      var score = dd * 100 + ((W[4] < 0) === wantCycle ? 40 : 0);
      if (score + 60 <= bestScore) continue;
      var opts = [];
      ['hare', 'borda', 'runoff'].forEach(function (sys) {
        P.forEach(function (f, fi) {
          if (f.n < 3) return;
          var m = manipulate(P, C, D.lot, sys, fi, PERMS);
          if (m.bestRank < f.order.indexOf(m.sincere)) opts.push({ sys: sys, fi: fi, m: m });
        });
      });
      if (opts.length) score += 60;
      if (score > bestScore) { bestScore = score; bestP = P; bestManip = opts; }
      if (opts.length && dd >= 3 && (W[4] < 0) === wantCycle && (dd >= 4 || tries > 300)) break;
    }
    D.P = bestP;
    D.N = total(bestP);
    D.res = {};
    KEYS.forEach(function (k) { D.res[k] = SYS[k](D.P, C, D.lot); });
    if (bestManip && bestManip.length) {
      var o = pick(r, bestManip);
      D.caucus = { sys: o.sys, fi: o.fi, m: o.m };
    } else {
      // nothing anyone can do today: hand over the biggest faction and let them find that out
      var fi0 = 0;
      D.caucus = { sys: 'hare', fi: fi0, m: manipulate(D.P, C, D.lot, 'hare', fi0, PERMS) };
    }
    return D;
  }

  /* ---------- exported for testing outside a browser ---------- */
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { build: build, seedForDate: seedForDate, SYS: SYS, manipulate: manipulate, perms: perms, winnersOf: winnersOf, distinct: distinct };
    return;
  }

  /* ---------- page state ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var dayOff = 0, D, tab = 0, calls, counted, caucus;
  var COUNTS = [
    { key: 'plurality', title: 'The show of hands', by: 'By a show of hands',
      brief: function () { return 'Count first preferences only. Whoever is named first on the most papers is president, majority or not. Most of the English-speaking world still elects its legislatures this way.'; } },
    { key: 'runoff', title: 'The second ballot', by: 'On the second ballot',
      brief: function () { return 'If somebody has more than half the first preferences they win outright. If not, everyone but the top two is struck off and the members choose again between those two. The papers already say how each member would.'; } },
    { key: 'hare', title: 'Hare’s transfers', by: 'By Hare’s transfers',
      brief: function () { return 'Strike off whoever has the fewest first preferences and pass each of their papers on to the next name on it still standing. Repeat until somebody holds more than half.'; } },
    { key: 'borda', title: 'Borda’s count', by: 'By Borda’s count',
      brief: function () { return 'Every paper gives ' + (D.C - 1) + ' points to the name it puts first, ' + (D.C - 2) + ' to the second, and so down to nothing for the last. Most points wins.'; } },
    { key: 'condorcet', title: 'Condorcet’s question', by: 'By Condorcet’s rule',
      brief: function () { return 'Set every pair of candidates against each other, head to head, using only which of the two each paper ranks higher. Is there one who beats every other? If so, who? There may be nobody.'; } }
  ];
  var SYSNAME = { hare: 'Hare’s transfers', borda: 'Borda’s count', runoff: 'the second ballot' };

  function nm(c) { return D.cands[c].name; }
  function full(c) { var k = D.cands[c]; return k.title + ' ' + k.name; }
  function chip(c, extra) { return '<span class="cc' + (extra || '') + '" style="--c:' + D.cands[c].col + '"><i></i>' + esc(nm(c)) + '</span>'; }

  function load() {
    var seed = seedForDate(dateFor(dayOff));
    D = build(seed);
    tab = 0; calls = [null, null, null, null, null]; counted = [false, false, false, false, false];
    caucus = { order: D.P[D.caucus.fi].order.slice(), lodged: false, result: null };
    $('plWho').textContent = D.society + ' · ' + D.year;
    $('plName').textContent = 'The election of a President, ' + D.year;
    $('plBlurb').innerHTML = 'The old President has died in office, and ' + numw(D.C) + ' members have put their names forward. All <b>' + D.N + '</b> members have ranked all ' + numw(D.C) + ' of them, first to last, and Mr ' + esc(D.secretary) + ', the Secretary, has sorted the papers into piles that read the same. The rules say only that the members shall <i>choose</i> a President. They do not say how the papers are to be counted, and the council has asked you to count them every way it has heard of before it decides.';
    var s = '';
    D.cands.forEach(function (k, c) { s += '<li><span class="cc" style="--c:' + k.col + '"><i></i>' + esc(k.title + ' ' + k.name) + '</span>, ' + esc(k.field) + ', ' + esc(k.plank) + '.</li>'; });
    $('candList').innerHTML = s;
    $('lots').innerHTML = 'Ties, if any, are settled by lot. The lots were drawn before the count: ' + D.lotOrder.map(function (c) { return chip(c); }).join(' <span class="gt">›</span> ') + '.';
    $('dayOut').textContent = longDate(dateFor(dayOff)) + (dayOff === 0 ? ' (today)' : '');
    renderProfile();
    renderAll();
  }

  function renderProfile() {
    var s = '';
    D.P.forEach(function (f, i) {
      var cauc = i === D.caucus.fi && tab === 5;
      s += '<div class="pile' + (cauc ? ' mine' : '') + '"><div class="pn"><b>' + f.n + '</b> papers</div><ol>';
      f.order.forEach(function (c) { s += '<li>' + chip(c) + '</li>'; });
      s += '</ol></div>';
    });
    $('piles').innerHTML = s;
  }

  function renderTabs() {
    var s = '';
    COUNTS.forEach(function (T, i) {
      var st = counted[i] ? (calls[i] === D.res[T.key].winner ? ' y' : ' n') : '';
      s += '<button type="button" class="tab' + (i === tab ? ' on' : '') + st + '" data-t="' + i + '"><span>Count ' + ROMAN[i] + '</span>' + T.title + '</button>';
    });
    var cs = caucus.lodged ? (caucus.result.rank <= D.caucus.m.bestRank ? ' y' : caucus.result.rank < D.P[D.caucus.fi].order.indexOf(D.caucus.m.sincere) ? ' w' : ' n') : '';
    s += '<button type="button" class="tab' + (tab === 5 ? ' on' : '') + cs + '" data-t="5"><span>Part ' + ROMAN[5] + '</span>The caucus</button>';
    $('tabs').innerHTML = s;
  }

  function renderAll() {
    renderTabs();
    renderProfile();
    $('countBox').hidden = tab === 5;
    $('caucusBox').hidden = tab !== 5;
    if (tab < 5) renderCount(); else renderCaucus();
    renderVerdict();
  }

  /* ---------- the five counts ---------- */
  function renderCount() {
    var T = COUNTS[tab], done = counted[tab];
    $('brief').innerHTML = '<span class="nt">Count ' + ROMAN[tab] + '</span>' + T.brief();
    var s = '<span class="lbl">Who wins?</span>';
    D.cands.forEach(function (k, c) {
      s += '<button type="button" class="chip pc' + (calls[tab] === c ? ' on' : '') + '" data-c="' + c + '"' + (done ? ' disabled' : '') + '><em style="background:' + k.col + '"></em>' + esc(k.name) + '</button>';
    });
    if (T.key === 'condorcet') s += '<button type="button" class="chip pc' + (calls[tab] === -1 ? ' on' : '') + '" data-c="-1"' + (done ? ' disabled' : '') + '>Nobody: it goes round</button>';
    $('calls').innerHTML = s;
    $('btnCount').disabled = done || calls[tab] === null;
    $('btnCount').textContent = done ? 'Counted' : 'Count the papers';
    if (!done) {
      $('countOut').innerHTML = '<p class="sub empty">' + (calls[tab] === null ? 'Read the piles above, make your call, then count.' : 'You say <b>' + (calls[tab] < 0 ? 'nobody' : esc(full(calls[tab]))) + '</b>. Count the papers and see.') + '</p>';
      $('msg').innerHTML = '';
      return;
    }
    $('countOut').innerHTML = drawCount(T.key);
    animateBars();
    var w = D.res[T.key].winner, right = calls[tab] === w;
    var wn = w < 0 ? 'nobody: every candidate loses to somebody' : '<b>' + esc(full(w)) + '</b>';
    $('msg').innerHTML = (right ? '<span class="tick y">called it</span> ' : '<span class="tick n">not this time</span> ') + T.by + ', the President is ' + wn + '.' + (right ? '' : ' You said ' + (calls[tab] < 0 ? 'nobody' : esc(nm(calls[tab]))) + '.') + ' ' + countNote(T.key);
  }

  function bars(vals, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, vals.filter(function (v, c) { return !opts.skip || !opts.skip[c]; }).concat([1, opts.max || 0]));
    var order = vals.map(function (v, c) { return c; });
    if (opts.sorted) order.sort(function (a, b) { return vals[b] - vals[a] || D.lot[a] - D.lot[b]; });
    var s = '<div class="bars">';
    order.forEach(function (c) {
      if (opts.skip && opts.skip[c]) return;
      var cls = c === opts.win ? ' win' : c === opts.out ? ' out' : opts.dim && opts.dim[c] ? ' dim' : '';
      s += '<div class="bar' + cls + '"><span class="bn">' + esc(nm(c)) + '</span><span class="bt"><i style="--w:' + (100 * vals[c] / max).toFixed(1) + '%;--c:' + D.cands[c].col + '"></i></span><span class="bv">' + vals[c] + (opts.unit ? ' ' + opts.unit : '') + (opts.extra && opts.extra[c] ? ' <em>' + opts.extra[c] + '</em>' : '') + '</span></div>';
    });
    if (opts.half) s += '<div class="half" style="--h:' + (100 * opts.half / max).toFixed(1) + '"><span>half the house</span></div>';
    return s + '</div>';
  }

  function drawCount(key) {
    var R = D.res[key], s = '';
    if (key === 'plurality') {
      s += '<h5>First preferences</h5>' + bars(R.tally, { win: R.winner, sorted: true, half: D.N / 2, max: D.N * 0.75 });
    } else if (key === 'runoff') {
      s += '<h5>First ballot</h5>' + bars(R.tally, { sorted: true, win: R.outright ? R.winner : -1, dim: R.outright ? null : R.tally.map(function (_, c) { return R.pair.indexOf(c) < 0; }), half: D.N / 2, max: D.N * 0.75 });
      if (!R.outright) {
        var v = []; for (var c = 0; c < D.C; c++) v.push(0);
        v[R.pair[0]] = R.h[0]; v[R.pair[1]] = R.h[1];
        var sk = v.map(function (_, c) { return R.pair.indexOf(c) < 0; });
        s += '<h5>Second ballot: ' + esc(nm(R.pair[0])) + ' against ' + esc(nm(R.pair[1])) + '</h5>' + bars(v, { skip: sk, win: R.winner, half: D.N / 2, max: D.N });
      }
    } else if (key === 'hare') {
      R.rounds.forEach(function (rd, k) {
        var sk = rd.alive.map(function (a) { return !a; });
        var ex = rd.out >= 0 ? rd.gain.map(function (g) { return g > 0 ? '+' + g + ' next' : ''; }) : null;
        s += '<h5>Round ' + (k + 1) + '</h5>' + bars(rd.tally, { skip: sk, sorted: true, out: rd.out, win: rd.out < 0 ? R.winner : -1, half: D.N / 2, max: D.N * 0.75, extra: ex });
        if (rd.out >= 0) {
          var g = []; rd.gain.forEach(function (n, c) { if (n > 0) g.push(esc(nm(c)) + ' ' + n); });
          s += '<p class="xfer">' + esc(nm(rd.out)) + ' is struck off' + (rd.tally[rd.out] ? '. Their ' + plural(rd.tally[rd.out], 'paper goes', 'papers go') + ' on to ' + g.join(', ') + '.' : ', named first on no paper at all, so nothing moves.') + '</p>';
        }
      });
    } else if (key === 'borda') {
      s += '<h5>Points</h5>' + bars(R.scores, { win: R.winner, sorted: true, unit: 'pts' });
      var row = '<tr><th></th>'; for (var i = 0; i < D.C; i++) row += '<th>' + (i + 1) + (i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th') + ' (' + (D.C - 1 - i) + ')</th>';
      row += '<th>Total</th></tr>';
      var body = '';
      D.cands.forEach(function (k, c) {
        var tr = '<tr><td>' + chip(c) + '</td>';
        for (var i = 0; i < D.C; i++) { var n = 0; D.P.forEach(function (f) { if (f.order[i] === c) n += f.n; }); tr += '<td>' + n + '</td>'; }
        body += tr + '<td><b>' + R.scores[c] + '</b></td></tr>';
      });
      s += '<div class="bookwrap"><table class="book"><thead>' + row + '</thead><tbody>' + body + '</tbody></table></div>';
    } else {
      s += '<div class="cgrid"><div>' + matrix(R.M) + '</div><div class="graph">' + graph(R.M, R.winner) + '</div></div>';
    }
    return s;
  }

  function matrix(M) {
    var s = '<div class="bookwrap"><table class="book mx"><thead><tr><th>prefer ↓ to →</th>';
    D.cands.forEach(function (_, c) { s += '<th>' + esc(nm(c)) + '</th>'; });
    s += '</tr></thead><tbody>';
    D.cands.forEach(function (_, a) {
      s += '<tr><td>' + chip(a) + '</td>';
      D.cands.forEach(function (_, b) {
        if (a === b) s += '<td class="nil">—</td>';
        else s += '<td class="' + (M[a][b] > M[b][a] ? 'wn' : 'ls') + '">' + M[a][b] + '</td>';
      });
      s += '</tr>';
    });
    return s + '</tbody></table></div><p class="sub small">Each cell is how many papers rank the row above the column. Bright cells are wins.</p>';
  }

  function graph(M, w) {
    var C = D.C, R = 112, cx = 150, cy = 140, pts = [];
    for (var c = 0; c < C; c++) { var a = -Math.PI / 2 + 2 * Math.PI * c / C; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    var s = '<svg viewBox="0 0 300 280" role="img" aria-label="Who beats whom, head to head"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8b97ab"/></marker></defs>';
    for (var a = 0; a < C; a++) for (var b = a + 1; b < C; b++) {
      var from = M[a][b] > M[b][a] ? a : b, to = from === a ? b : a;
      var p = pts[from], q = pts[to], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      var x1 = p[0] + ux * 22, y1 = p[1] + uy * 22, x2 = q[0] - ux * 24, y2 = q[1] - uy * 24;
      var mg = Math.abs(M[a][b] - M[b][a]);
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + (from === w ? D.cands[w].col : '#5d6a80') + '" stroke-width="' + (1.2 + Math.min(3, mg / 6)).toFixed(1) + '" marker-end="url(#ah)"/>';
      var mx = (x1 + x2) / 2 - uy * 9, my = (y1 + y2) / 2 + ux * 9;
      s += '<text class="mg" x="' + mx.toFixed(1) + '" y="' + (my + 3).toFixed(1) + '">' + mg + '</text>';
    }
    pts.forEach(function (p, c) {
      s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="19" fill="' + D.cands[c].col + '"' + (c === w ? ' stroke="#e8edf5" stroke-width="3"' : '') + '/>';
      s += '<text class="gl" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '">' + esc(nm(c).slice(0, 3)) + '</text>';
    });
    return s + '</svg><p class="sub small">An arrow runs from the winner of each straight fight to the loser, labelled by the margin.</p>';
  }

  function countNote(key) {
    var R = D.res[key];
    if (key === 'plurality') {
      var t = R.tally[R.winner];
      return t * 2 > D.N ? 'An outright majority, so nobody can argue.' : 'That is ' + t + ' of ' + D.N + ': more members put somebody else first than put ' + esc(nm(R.winner)) + ' first.';
    }
    if (key === 'runoff') return R.outright ? 'A majority on the first ballot, so there was no second.' : esc(nm(R.winner)) + ' takes the straight fight ' + Math.max(R.h[0], R.h[1]) + ' to ' + Math.min(R.h[0], R.h[1]) + '. Whoever came third never had the chance to face anyone.';
    if (key === 'hare') return 'It took ' + numw(R.rounds.length) + ' round' + (R.rounds.length === 1 ? '' : 's') + '. Notice that nobody’s second choice was ever looked at unless their first had already been struck off.';
    if (key === 'borda') {
      var c = D.res.condorcet.winner;
      return 'Borda rewards being nobody’s enemy: a name that is often second can beat one that is often first.' + (c >= 0 && c !== R.winner ? ' Here it even passes over ' + esc(nm(c)) + ', who beats everyone head to head.' : '');
    }
    if (R.winner >= 0) {
      var others = KEYS.slice(0, 4).filter(function (k) { return D.res[k].winner !== R.winner; }).length;
      return esc(nm(R.winner)) + ' would beat any rival in a straight fight' + (others ? ', and yet ' + (others === 4 ? 'all four of the other counts elect' : numw(others) + ' of the other four counts elect') + ' somebody else.' : ', and every other count agrees.');
    }
    return 'Condorcet saw this in 1785: the members as a body prefer one to another, that one to a third, and the third back to the first, though every member’s own ranking is perfectly consistent.';
  }

  function animateBars() {
    var els = document.querySelectorAll('#countOut .bt i, #caucusOut .bt i');
    els.forEach(function (e) { e.style.width = '0'; });
    requestAnimationFrame(function () { requestAnimationFrame(function () { els.forEach(function (e) { e.style.width = ''; }); }); });
  }

  /* ---------- the caucus ---------- */
  function renderCaucus() {
    var K = D.caucus, f = D.P[K.fi], sincere = K.m.sincere;
    $('brief').innerHTML = '<span class="nt">Part VI</span>The council has settled on <b>' + SYSNAME[K.sys] + '</b> for the real election. You speak for the <b>' + f.n + '</b> members whose papers read ' + f.order.map(function (c) { return esc(nm(c)); }).join(' › ') + ' (outlined above), and they will fill in their papers exactly as you tell them. Counted honestly, the President would be <b>' + esc(full(sincere)) + '</b>, their ' + ['first', 'second', 'third', 'fourth', 'fifth'][f.order.indexOf(sincere)] + ' choice. Can a different paper get them somebody they like better? Everyone else votes as they said. You may lodge it once.';
    var s = '<ol class="paper">';
    caucus.order.forEach(function (c, i) {
      s += '<li><span class="rk">' + (i + 1) + '</span>' + chip(c) +
        '<span class="mv"><button type="button" class="btn small ghost" data-u="' + i + '"' + (i === 0 || caucus.lodged ? ' disabled' : '') + ' aria-label="Move ' + esc(nm(c)) + ' up">↑</button>' +
        '<button type="button" class="btn small ghost" data-d="' + i + '"' + (i === caucus.order.length - 1 || caucus.lodged ? ' disabled' : '') + ' aria-label="Move ' + esc(nm(c)) + ' down">↓</button></span></li>';
    });
    $('paper').innerHTML = s + '</ol>';
    $('btnLodge').disabled = caucus.lodged;
    $('btnHonest').disabled = caucus.lodged;
    if (!caucus.lodged) { $('caucusOut').innerHTML = ''; $('msgC').innerHTML = 'Each of your ' + f.n + ' members will hand in this paper. Work it out from the piles before you lodge it.'; return; }
    var Rz = caucus.result, me = f.order;
    $('caucusOut').innerHTML = drawCaucusCount(Rz);
    animateBars();
    var m = K.m, best = m.best, msg;
    if (Rz.rank <= m.bestRank) msg = '<span class="tick y">as well as it could be done</span> Your paper makes <b>' + esc(full(Rz.winner)) + '</b> President, your members’ ' + ['first', 'second', 'third', 'fourth', 'fifth'][Rz.rank] + ' choice instead of their ' + ['first', 'second', 'third', 'fourth', 'fifth'][me.indexOf(sincere)] + '. ' + (m.count === 1 ? 'Only one paper of the ' + perms(D.C).length + ' possible does better than the truth.' : numw(m.count) + ' of the ' + perms(D.C).length + ' possible papers do better than the truth.');
    else if (Rz.rank < me.indexOf(sincere)) msg = '<span class="tick w">better, not best</span> <b>' + esc(full(Rz.winner)) + '</b> is an improvement on ' + esc(nm(sincere)) + ', but a paper reading ' + m.ballot.map(function (c) { return esc(nm(c)); }).join(' › ') + ' would have given them ' + esc(full(best)) + '.';
    else msg = '<span class="tick n">no gain</span> The President is <b>' + esc(full(Rz.winner)) + '</b>' + (Rz.winner === sincere ? ', exactly as if you had told the truth' : ', which your members like less than the honest result') + '. A paper reading ' + m.ballot.map(function (c) { return esc(nm(c)); }).join(' › ') + ' would have given them ' + esc(full(best)) + '.';
    msg += ' ' + (K.sys === 'borda' ? 'Under Borda the trick is to bury the strongest rival at the bottom, where it scores nothing.' : K.sys === 'hare' ? 'Under Hare the trick is usually to put a weaker candidate first so that the one you fear is struck off early, or meets a rival it cannot beat.' : 'Under a second ballot the trick is to choose who reaches the final, by lending first preferences to the opponent your favourite can beat.');
    $('msgC').innerHTML = msg;
  }
  function drawCaucusCount(Rz) {
    var R = Rz.R, s = '<h5>The real count, with your paper</h5>';
    if (D.caucus.sys === 'borda') s += bars(R.scores, { win: R.winner, sorted: true, unit: 'pts' });
    else if (D.caucus.sys === 'runoff') {
      s += bars(R.tally, { sorted: true, win: R.outright ? R.winner : -1, half: D.N / 2, max: D.N * 0.75 });
      if (!R.outright) s += '<p class="xfer">Second ballot: ' + esc(nm(R.pair[0])) + ' ' + R.h[0] + ', ' + esc(nm(R.pair[1])) + ' ' + R.h[1] + '.</p>';
    } else {
      R.rounds.forEach(function (rd, k) {
        s += '<p class="xfer"><b>Round ' + (k + 1) + ':</b> ' + D.cands.map(function (_, c) { return rd.alive[c] ? esc(nm(c)) + ' ' + rd.tally[c] : null; }).filter(Boolean).join(', ') + (rd.out >= 0 ? '. ' + esc(nm(rd.out)) + ' is struck off.' : '. ' + esc(nm(R.winner)) + ' has more than half.') + '</p>';
      });
    }
    return s;
  }
  function lodge() {
    if (caucus.lodged) return;
    var K = D.caucus, Q = D.P.map(function (f, i) { return i === K.fi ? { n: f.n, order: caucus.order.slice() } : f; });
    var R = SYS[K.sys](Q, D.C, D.lot);
    caucus.lodged = true;
    caucus.result = { R: R, winner: R.winner, rank: D.P[K.fi].order.indexOf(R.winner) };
    renderAll();
  }

  /* ---------- the report ---------- */
  function renderVerdict() {
    var V = $('verdict');
    var all = counted.every(Boolean) && caucus.lodged;
    if (!all) { V.innerHTML = ''; V.className = 'verdict'; return; }
    var right = 0;
    COUNTS.forEach(function (T, i) { if (calls[i] === D.res[T.key].winner) right++; });
    var W = KEYS.map(function (k) { return D.res[k].winner; }), dd = distinct(W);
    var gotBest = caucus.result.rank <= D.caucus.m.bestRank;
    V.className = 'verdict ' + (right === 5 && gotBest ? 'good' : 'warn');
    var names = {};
    W.forEach(function (w) { if (w >= 0) names[w] = 1; });
    V.innerHTML = '<b>The returning officer’s report, ' + D.year + '.</b> The same ' + D.N + ' papers, counted five ways, elect ' + numw(dd) + ' different results' + (W[4] < 0 ? ', one of them nobody at all' : '') + ' (' + Object.keys(names).map(function (c) { return esc(nm(+c)); }).join(', ') + '). You called ' + numw(right) + ' of five, and your caucus ' + (gotBest ? 'did as well as any paper could.' : 'left something on the table.') +
      ' Nothing was wrong with the members or their papers. Arrow proved in 1951 that no way of counting ranked papers can be fair in every way people mean by fair at once, and Gibbard and Satterthwaite that every one worth using sometimes rewards a lie.';
  }

  /* ---------- wiring ---------- */
  function wire() {
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.tab') : null;
      if (b) { tab = +b.getAttribute('data-t'); renderAll(); }
    });
    $('calls').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pc') : null;
      if (!b || counted[tab]) return;
      calls[tab] = +b.getAttribute('data-c'); renderCount();
    });
    $('btnCount').onclick = function () {
      if (calls[tab] === null || counted[tab]) return;
      counted[tab] = true; renderAll();
    };
    $('paper').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || caucus.lodged) return;
      var o = caucus.order, i, t;
      if (b.hasAttribute('data-u')) { i = +b.getAttribute('data-u'); if (i > 0) { t = o[i - 1]; o[i - 1] = o[i]; o[i] = t; } }
      else if (b.hasAttribute('data-d')) { i = +b.getAttribute('data-d'); if (i < o.length - 1) { t = o[i + 1]; o[i + 1] = o[i]; o[i] = t; } }
      renderCaucus();
      var q = document.querySelector('#paper button[data-' + (b.hasAttribute('data-u') ? 'u' : 'd') + '="' + (b.hasAttribute('data-u') ? Math.max(0, i - 1) : Math.min(o.length - 1, i + 1)) + '"]');
      if (q && !q.disabled) q.focus();
    });
    $('btnLodge').onclick = lodge;
    $('btnHonest').onclick = function () { caucus.order = D.P[D.caucus.fi].order.slice(); renderCaucus(); };
    $('btnReset').onclick = function () { var keep = tab; load(); tab = keep; renderAll(); };
    $('btnDayPrev').onclick = function () { dayOff--; load(); };
    $('btnDayNext').onclick = function () { dayOff++; load(); };
    $('btnDayToday').onclick = function () { dayOff = 0; load(); };
    document.addEventListener('keydown', function (e) {
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { dayOff--; load(); }
      else if (e.key === 'ArrowRight') { dayOff++; load(); }
    });
  }

  wire();
  load();
})();
