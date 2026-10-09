/* drift.quibo.games — The Pyx
   Metrology. The day's number founds a mint, picks a year and a coin, and sends the year's
   sample box (the pyx) to a jury of goldsmiths. Four trials: a light coin among a handful
   with a beam balance; one false coin among a dozen, heavy or light, nobody knows which;
   thirteen of them with one true trial-plate coin to hand; and a row of sacks with a
   steelyard you may hang only once. The balance is honest but the false coin is not chosen
   until the weighings force it, so the only way to make par is to weigh as if the worst
   were true every time. A solver finds par for each trial and judges every weighing.
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
    var h = s ^ 0x5f3a91c7;
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
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function plural(n, one, many) { return numw(n) + ' ' + (n === 1 ? one : many); }
  function fmt1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  var $ = function (id) { return document.getElementById(id); };
  var LETTERS = 'ABCDEFGHJKLMN';
  var ROMAN = ['I', 'II', 'III', 'IV'];

  var TOWNS = ['Wexcombe', 'Carrow', 'Haldon Bridge', 'Stannary', 'Ludmere', 'Corbridge Vale', 'Ashenford', 'Pellow', 'Brantwick', 'Tamsworth', 'Kelling', 'Oxenhope'];
  var SURN = ['Hallam', 'Ferrers', 'Tolley', 'Garrard', 'Pinchbeck', 'Wyatt', 'Ormsby', 'Dacre', 'Fothergill', 'Lumley', 'Strype', 'Cotterell', 'Bayliss', 'Mander'];
  var COINS = [
    { name: 'guinea', pl: 'guineas', metal: 'gold', grains: 129.4, col: '#ffce6a' },
    { name: 'crown', pl: 'crowns', metal: 'silver', grains: 464.5, col: '#cfd8e6' },
    { name: 'half-crown', pl: 'half-crowns', metal: 'silver', grains: 232.3, col: '#cfd8e6' },
    { name: 'shilling', pl: 'shillings', metal: 'silver', grains: 92.9, col: '#cfd8e6' },
    { name: 'half-guinea', pl: 'half-guineas', metal: 'gold', grains: 64.7, col: '#ffce6a' },
    { name: 'sovereign', pl: 'sovereigns', metal: 'gold', grains: 123.3, col: '#ffce6a' }
  ];

  /* ---------- the day ---------- */
  function build(seed) {
    var r = rng(seed);
    var D = { seed: seed, r: r };
    D.town = pick(r, TOWNS);
    D.year = 1697 + Math.floor(r() * 100);
    D.coin = pick(r, COINS);
    var sn = shuffle(r, SURN);
    D.master = sn[0]; D.warden = sn[1]; D.foreman = sn[2];
    var nI = 7 + Math.floor(r() * 7);          // 7..13, known light
    var nII = 10 + Math.floor(r() * 3);        // 10..12, heavy or light
    var variant = r() < 0.5 ? 'one' : 'any';
    var nIV = variant === 'one' ? 8 + Math.floor(r() * 3) : 5 + Math.floor(r() * 3);
    var deficit = pick(r, [1.2, 1.5, 1.8, 2.1, 2.4, 3]);
    D.trials = [
      { kind: 'beam', n: nI, ref: false, known: 'light', title: 'The light coin',
        brief: 'The foreman says one of these ' + numw(nI) + ' ' + D.coin.pl + ' was struck from a clipped blank and is <b>light</b>. The rest are true. Find it with the beam.' },
      { kind: 'beam', n: nII, ref: false, known: null, title: 'Heavy or light',
        brief: 'One of these ' + numw(nII) + ' is false, and nobody can say whether it was struck too heavy or too light. Find it, and say which. There is no coin to hand that is known to be true.' },
      { kind: 'beam', n: 13, ref: true, known: null, title: 'Thirteen, and the plate',
        brief: 'Thirteen this time, one false, heavy or light. But the jury has brought a coin struck from the <b>trial plate</b> (marked T), which is true beyond argument. It may go on either pan.' },
      { kind: 'sacks', n: nIV, variant: variant, deficit: deficit, title: variant === 'one' ? 'The sacks' : 'The sacks, all of them',
        brief: variant === 'one'
          ? 'The year’s ' + numw(nIV) + ' sacks from the press-room. In <b>one</b> of them every coin is ' + fmt1(deficit) + ' grains light. You may take as many coins from each sack as you like and hang them on the steelyard <b>once</b>.'
          : 'The year’s ' + numw(nIV) + ' sacks. <b>Any number</b> of them, none, one or several, may hold coins that are each ' + fmt1(deficit) + ' grains light; a sack is all true or all light. Take what you like from each and hang them on the steelyard <b>once</b>.' }
    ];
    // the steelyard's truth is fixed by the number
    var t4 = D.trials[3];
    if (variant === 'one') { t4.bad = [Math.floor(r() * nIV)]; }
    else { t4.bad = []; for (var i = 0; i < nIV; i++) if (r() < 0.34) t4.bad.push(i); }
    t4.capacity = variant === 'one' ? 20 : 64;
    return D;
  }

  /* ---------- the solver ----------
     A beam state is counted by class: u coins that could be heavy or light, h that could
     only be heavy, l that could only be light, g known true. f(state) is the fewest weighings
     that are guaranteed to name the coin and its fault, whatever the balance does. */
  var memo = {};
  function hyps(s) { return 2 * s[0] + s[1] + s[2]; }
  function lb(n) { var k = 0, p = 1; while (p < n) { p *= 3; k++; } return k; }
  function outcomes(s, w) {
    var u = s[0], h = s[1], l = s[2], g = s[3], tot = u + h + l + g;
    var u1 = w[0], h1 = w[1], l1 = w[2], u2 = w[4], h2 = w[5], l2 = w[6];
    var B = [u - u1 - u2, h - h1 - h2, l - l1 - l2, 0];
    B[3] = tot - B[0] - B[1] - B[2];
    var Ld = [0, u1 + h1, u2 + l2, 0]; Ld[3] = tot - Ld[1] - Ld[2];
    var Lu = [0, u2 + h2, u1 + l1, 0]; Lu[3] = tot - Lu[1] - Lu[2];
    return { B: B, L: Ld, R: Lu };
  }
  function weighings(s) {
    var out = [], u = s[0], h = s[1], l = s[2], g = s[3];
    for (var u1 = 0; u1 <= u; u1++) for (var u2 = 0; u2 <= u - u1; u2++)
      for (var h1 = 0; h1 <= h; h1++) for (var h2 = 0; h2 <= h - h1; h2++)
        for (var l1 = 0; l1 <= l; l1++) for (var l2 = 0; l2 <= l - l1; l2++) {
          var n1 = u1 + h1 + l1, n2 = u2 + h2 + l2;
          if (n1 + n2 === 0) continue;
          var d = n1 - n2, g1 = 0, g2 = 0;
          if (d > 0) g2 = d; else g1 = -d;
          if (g1 + g2 > g) continue;
          if (n1 < n2 || (n1 === n2 && (u1 < u2 || (u1 === u2 && h1 < h2)))) continue; // mirror images
          out.push([u1, h1, l1, g1, u2, h2, l2, g2]);
        }
    return out;
  }
  function f(s) {
    var n = hyps(s);
    if (n <= 1) return 0;
    var key = s.join(',');
    if (memo[key] !== undefined) return memo[key];
    memo[key] = Infinity;          // guards against loops while we look
    var best = Infinity, floor = lb(n), ws = weighings(s);
    for (var i = 0; i < ws.length && best > floor; i++) {
      var o = outcomes(s, ws[i]), worst = 0, ok = true;
      ['B', 'L', 'R'].forEach(function (k) {
        if (!ok) return;
        var m = hyps(o[k]);
        if (m === n) { ok = false; return; }       // tells you nothing
        if (m > 0) worst = Math.max(worst, f(o[k]));
      });
      if (ok && 1 + worst < best) best = 1 + worst;
    }
    memo[key] = best;
    return best;
  }
  function bestFirst(s) {
    // of all the weighings that make par, the one that splits the possibilities most evenly
    var n = hyps(s), ws = weighings(s), target = f(s), best = null, bestSpread = Infinity;
    for (var i = 0; i < ws.length; i++) {
      var o = outcomes(s, ws[i]), worst = 0, spread = 0, ok = true;
      ['B', 'L', 'R'].forEach(function (k) { var m = hyps(o[k]); spread = Math.max(spread, m); if (m === n) ok = false; else if (m > 0) worst = Math.max(worst, f(o[k])); });
      if (ok && 1 + worst === target && spread < bestSpread) { best = ws[i]; bestSpread = spread; }
    }
    return best;
  }

  /* ---------- beam trial state ---------- */
  function newBeam(T, seed, idx) {
    var S = { T: T, r: rng(seed ^ (0x9e37 * (idx + 1))), canH: [], canL: [], pos: [], log: [], done: false, answer: null, tilt: 0 };
    for (var i = 0; i < T.n; i++) { S.canH.push(T.known !== 'light'); S.canL.push(true); S.pos.push(0); }
    S.refPos = 0;                  // where the trial-plate coin sits: 0 tray, 1 left, 2 right
    S.par = f(classOf(S));
    return S;
  }
  function classOf(S) {
    var u = 0, h = 0, l = 0, g = S.T.ref ? 1 : 0;
    for (var i = 0; i < S.T.n; i++) {
      if (S.canH[i] && S.canL[i]) u++; else if (S.canH[i]) h++; else if (S.canL[i]) l++; else g++;
    }
    return [u, h, l, g];
  }
  function hypList(S) {
    var a = [];
    for (var i = 0; i < S.T.n; i++) { if (S.canH[i]) a.push([i, 'H']); if (S.canL[i]) a.push([i, 'L']); }
    return a;
  }
  function verdictFor(i, s, S) {
    var p = S.pos[i];
    if (p === 0) return 'B';
    if (p === 1) return s === 'H' ? 'L' : 'R';
    return s === 'H' ? 'R' : 'L';
  }
  function doWeigh(S) {
    var nl = 0, nr = 0;
    for (var i = 0; i < S.T.n; i++) { if (S.pos[i] === 1) nl++; if (S.pos[i] === 2) nr++; }
    if (S.refPos === 1) nl++; if (S.refPos === 2) nr++;
    var before = classOf(S), fb = f(before);
    var H = hypList(S), groups = { B: [], L: [], R: [] };
    H.forEach(function (hp) { groups[verdictFor(hp[0], hp[1], S)].push(hp); });
    // the false coin is whichever leaves you worst off
    var cands = [];
    ['B', 'L', 'R'].forEach(function (k) {
      if (!groups[k].length) return;
      var canH = S.canH.map(function () { return false; }), canL = canH.slice();
      groups[k].forEach(function (hp) { if (hp[1] === 'H') canH[hp[0]] = true; else canL[hp[0]] = true; });
      var tmp = { T: S.T, canH: canH, canL: canL };
      var c = classOf(tmp);
      cands.push({ k: k, canH: canH, canL: canL, f: f(c), n: groups[k].length, tie: S.r() });
    });
    cands.sort(function (a, b) { return (b.f - a.f) || (b.n - a.n) || (a.tie - b.tie); });
    var o = cands[0];
    S.canH = o.canH; S.canL = o.canL;
    var after = f(classOf(S));
    var left = [], right = [];
    for (i = 0; i < S.T.n; i++) { if (S.pos[i] === 1) left.push(LETTERS[i]); if (S.pos[i] === 2) right.push(LETTERS[i]); }
    if (S.refPos === 1) left.push('T'); if (S.refPos === 2) right.push('T');
    S.log.push({ left: left, right: right, out: o.k, good: after <= fb - 1, after: after, left_n: hypList(S).length });
    S.tilt = o.k === 'L' ? 1 : o.k === 'R' ? -1 : 0;
    return o.k;
  }

  /* ---------- page state ---------- */
  var dayOff = 0, D, seed, trialIx = 0, beams = [], sacks = null, slate = false;

  function load() {
    seed = seedForDate(dateFor(dayOff));
    D = build(seed);
    beams = [0, 1, 2].map(function (i) { return newBeam(D.trials[i], seed, i); });
    sacks = { take: [], reading: null, chosen: [], done: false, result: null };
    for (var i = 0; i < D.trials[3].n; i++) { sacks.take.push(0); sacks.chosen.push(false); }
    trialIx = 0;
    $('plWho').textContent = 'The Mint at ' + D.town + ' · ' + D.year;
    $('plName').textContent = 'The Trial of the Pyx, ' + D.year;
    $('plBlurb').innerHTML = 'The pyx has come up from the Mint to the hall of the goldsmiths. It holds the year’s sample of <b>' + D.coin.pl + '</b> (' + D.coin.metal + ', ' + D.coin.grains + ' grains by the indenture). Master ' + esc(D.master) + ' says every one is true. Warden ' + esc(D.warden) + ' says not. The foreman of the jury, ' + esc(D.foreman) + ', has a beam balance that shows only which pan sinks, a steelyard that reads to a tenth of a grain, and four questions for you.';
    $('dayOut').textContent = longDate(dateFor(dayOff)) + (dayOff === 0 ? ' (today)' : '');
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    renderAll();
  }

  /* ---------- drawing the beam ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var W = 760, PIV = { x: 380, y: 70 }, ARM = 210, anim = { a: 0, target: 0, raf: 0 };
  function coinSVG(x, y, rr, label, col, extra) {
    return '<g class="coin' + (extra || '') + '" transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')">' +
      '<circle r="' + rr + '" fill="' + col + '" stroke="#0d121b" stroke-width="1.5"/>' +
      '<circle r="' + (rr - 3) + '" fill="none" stroke="rgba(13,18,27,.35)" stroke-width="1"/>' +
      '<text class="cl" y="4">' + label + '</text></g>';
  }
  function panCoins(S, side, cx, cy) {
    var list = [];
    for (var i = 0; i < S.T.n; i++) if (S.pos[i] === side) list.push(i);
    if (S.T.ref && S.refPos === side) list.push(-1);
    var s = '', per = 7, rr = 10.5;
    list.forEach(function (c, k) {
      var row = Math.floor(k / per), colN = Math.min(per, list.length - row * per), col = k % per;
      var x = cx + (col - (colN - 1) / 2) * 22.5, y = cy - 12 - row * 19;
      s += coinSVG(x, y, rr, c < 0 ? 'T' : LETTERS[c], c < 0 ? '#64f0c8' : D.coin.col, '');
    });
    return s;
  }
  function drawBeam() {
    var S = beams[trialIx], svg = $('beam');
    var a = anim.a * 7 * Math.PI / 180;    // left pan down is positive
    var lx = PIV.x - ARM * Math.cos(a), ly = PIV.y + ARM * Math.sin(a);
    var rx = PIV.x + ARM * Math.cos(a), ry = PIV.y - ARM * Math.sin(a);
    var hang = 92, s = '';
    s += '<rect x="372" y="40" width="16" height="150" rx="3" fill="#2a3343"/>';
    s += '<rect x="320" y="186" width="120" height="12" rx="4" fill="#2a3343"/>';
    s += '<path d="M372 60 L380 44 L388 60 Z" fill="#8b97ab"/>';
    s += '<line x1="' + lx.toFixed(1) + '" y1="' + ly.toFixed(1) + '" x2="' + rx.toFixed(1) + '" y2="' + ry.toFixed(1) + '" stroke="#cfd8e6" stroke-width="5" stroke-linecap="round"/>';
    s += '<line x1="380" y1="' + PIV.y + '" x2="' + (380 + Math.sin(a) * -46).toFixed(1) + '" y2="' + (PIV.y - Math.cos(a) * 46).toFixed(1) + '" stroke="#ff8fa3" stroke-width="2.5"/>';
    s += '<circle cx="380" cy="' + PIV.y + '" r="6" fill="#e8edf5"/>';
    [[lx, ly, 1], [rx, ry, 2]].forEach(function (p) {
      var px = p[0], py = p[1] + hang;
      s += '<line x1="' + px.toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + (px - 80).toFixed(1) + '" y2="' + py.toFixed(1) + '" stroke="#5d6a80" stroke-width="1.2"/>';
      s += '<line x1="' + px.toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + (px + 80).toFixed(1) + '" y2="' + py.toFixed(1) + '" stroke="#5d6a80" stroke-width="1.2"/>';
      s += panCoins(S, p[2], px, py);
      s += '<path d="M' + (px - 86).toFixed(1) + ' ' + py.toFixed(1) + ' Q' + px.toFixed(1) + ' ' + (py + 22).toFixed(1) + ' ' + (px + 86).toFixed(1) + ' ' + py.toFixed(1) + '" fill="none" stroke="#cfd8e6" stroke-width="3"/>';
      s += '<text class="pn" x="' + px.toFixed(1) + '" y="' + (py + 34).toFixed(1) + '">' + (p[2] === 1 ? 'LEFT PAN' : 'RIGHT PAN') + '</text>';
    });
    // the tray
    var n = S.T.n + (S.T.ref ? 1 : 0), gap = Math.min(52, (W - 60) / n), x0 = W / 2 - (n - 1) * gap / 2, ty = 290;
    s += '<rect x="20" y="' + (ty - 30) + '" width="720" height="78" rx="12" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.09)"/>';
    s += '<text class="pn" x="34" y="' + (ty - 36) + '" style="text-anchor:start">THE TRAY · CLICK A COIN TO MOVE IT: TRAY → LEFT → RIGHT → TRAY</text>';
    for (var i = 0; i < n; i++) {
      var isRef = S.T.ref && i === S.T.n, x = x0 + i * gap;
      var where = isRef ? S.refPos : S.pos[i];
      var label = isRef ? 'T' : LETTERS[i];
      var col = isRef ? '#64f0c8' : D.coin.col;
      s += '<g class="hit" data-c="' + (isRef ? -1 : i) + '" tabindex="0" role="button" aria-label="Coin ' + label + ', ' + ['in the tray', 'on the left pan', 'on the right pan'][where] + '">';
      if (where === 0) s += coinSVG(x, ty, 16, label, col, '');
      else s += '<g transform="translate(' + x.toFixed(1) + ',' + ty + ')"><circle r="16" fill="none" stroke="' + col + '" stroke-dasharray="3 3" opacity=".6"/><text class="cl ghost" y="4">' + label + '</text></g>';
      s += '<rect x="' + (x - 20).toFixed(1) + '" y="' + (ty - 22) + '" width="40" height="44" fill="transparent"/>';
      if (slate && !isRef) {
        var m = S.canH[i] && S.canL[i] ? '±' : S.canH[i] ? 'heavy?' : S.canL[i] ? 'light?' : 'true';
        s += '<text class="sl' + (m === 'true' ? ' t' : '') + '" x="' + x.toFixed(1) + '" y="' + (ty + 34) + '">' + m + '</text>';
      }
      s += '</g>';
    }
    svg.innerHTML = s;
  }
  function animateTo(t) {
    anim.target = t;
    cancelAnimationFrame(anim.raf);
    var from = anim.a, t0 = performance.now(), dur = 700;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 7) : 1;   // a little swing before it settles
      anim.a = from + (t - from) * e;
      drawBeam();
      if (k < 1) anim.raf = requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- rendering ---------- */
  function trialDone(i) { return i < 3 ? beams[i].done : sacks.done; }
  function renderTabs() {
    var s = '';
    D.trials.forEach(function (T, i) {
      var st = '';
      if (i < 3 && beams[i].done) st = beams[i].answer.correct ? (beams[i].log.length <= beams[i].par ? ' y' : ' w') : ' n';
      if (i === 3 && sacks.done) st = sacks.result.correct ? (sacks.result.sure ? ' y' : ' w') : ' n';
      s += '<button type="button" class="tab' + (i === trialIx ? ' on' : '') + st + '" data-t="' + i + '"><span>Trial ' + ROMAN[i] + '</span>' + esc(T.title) + '</button>';
    });
    $('tabs').innerHTML = s;
  }
  function renderAll() {
    renderTabs();
    var T = D.trials[trialIx];
    $('brief').innerHTML = '<span class="nt">Trial ' + ROMAN[trialIx] + '</span>' + T.brief;
    $('beamBox').hidden = T.kind !== 'beam';
    $('sackBox').hidden = T.kind !== 'sacks';
    if (T.kind === 'beam') renderBeam(); else renderSacks();
    renderVerdict();
  }
  function counts(S) {
    var nl = 0, nr = 0;
    for (var i = 0; i < S.T.n; i++) { if (S.pos[i] === 1) nl++; if (S.pos[i] === 2) nr++; }
    if (S.refPos === 1) nl++; if (S.refPos === 2) nr++;
    return [nl, nr];
  }
  function renderBeam() {
    var S = beams[trialIx];
    anim.a = S.tilt; drawBeam();
    var c = counts(S);
    $('btnWeigh').disabled = S.done || c[0] !== c[1] || c[0] === 0;
    $('panState').innerHTML = '<b>' + c[0] + '</b> on the left, <b>' + c[1] + '</b> on the right' +
      (c[0] !== c[1] ? ' · <span class="warnt">the pans must hold the same number, or the fuller one simply sinks</span>' : '') +
      ' · weighings used <b>' + S.log.length + '</b>';
    $('btnSlate').textContent = slate ? 'Hide the slate' : 'Show the slate';
    var L = '';
    if (!S.log.length) L = '<p class="sub empty">Nothing weighed yet.</p>';
    else {
      L = '<ol class="wlog">';
      S.log.forEach(function (w, k) {
        var out = w.out === 'B' ? 'balances' : w.out === 'L' ? 'left pan sinks' : 'right pan sinks';
        L += '<li><span class="wn">' + (k + 1) + '</span><b>' + w.left.join(' ') + '</b> against <b>' + w.right.join(' ') + '</b>: ' + out +
          (S.done ? ' <span class="tick ' + (w.good ? 'y' : 'n') + '">' + (w.good ? 'as good as any' : 'wasted ground') + '</span>' : '') + '</li>';
      });
      L += '</ol>';
    }
    $('wlog').innerHTML = L;
    // the declaration
    var opts = '';
    for (var i = 0; i < S.T.n; i++) opts += '<option value="' + i + '">' + LETTERS[i] + '</option>';
    var dec = '<label class="selh">The false coin is <select id="decCoin"' + (S.done ? ' disabled' : '') + '>' + opts + '</select></label>';
    if (S.T.known === 'light') dec += '<button class="btn small" type="button" id="btnDecL"' + (S.done ? ' disabled' : '') + '>It is light</button>';
    else dec += '<button class="btn small" type="button" id="btnDecH"' + (S.done ? ' disabled' : '') + '>It is heavy</button><button class="btn small" type="button" id="btnDecL"' + (S.done ? ' disabled' : '') + '>It is light</button>';
    $('declare').innerHTML = dec;
    if (S.answer) $('decCoin').value = S.answer.coin;
    if ($('btnDecH')) $('btnDecH').onclick = function () { declare('H'); };
    $('btnDecL').onclick = function () { declare('L'); };
    var M = '';
    if (S.done) M = trialMessage(trialIx);
    else if (S.log.length) {
      var last = S.log[S.log.length - 1];
      M = 'The beam ' + (last.out === 'B' ? 'comes to rest level.' : 'settles with the ' + (last.out === 'L' ? 'left' : 'right') + ' pan down.') + ' Clear the pans when you are ready for the next.';
    } else M = 'Par for this trial is <b>' + plural(S.par, 'weighing', 'weighings') + '</b>, and that is a guarantee whatever the beam does. Put coins on the pans and weigh.';
    $('msg').innerHTML = M;
  }
  function trialMessage(i) {
    var S = beams[i], a = S.answer, T = S.T;
    var name = LETTERS[a.trueCoin] + (T.known === 'light' ? '' : ', ' + (a.trueSign === 'H' ? 'heavy' : 'light'));
    if (a.correct) {
      return '<b>The jury agrees: ' + name + '.</b> ' + cap(plural(S.log.length, 'weighing', 'weighings')) + ' against a par of ' + S.par + '. ' +
        (S.log.length <= S.par ? 'No jury could have been surer sooner.' : 'Right, but the beam gave you more chances than it had to.');
    }
    return '<b>The jury finds otherwise.</b> With what you had weighed, the false coin could still have been ' + a.alts + ', and it was <b>' + name + '</b>. Nothing in the pyx is decided until the weighings leave it nowhere else to be.';
  }
  function declare(sign) {
    var S = beams[trialIx]; if (S.done) return;
    var coin = +$('decCoin').value;
    var H = hypList(S);
    var mine = H.filter(function (h) { return h[0] === coin && (S.T.known === 'light' || h[1] === sign); });
    var others = H.filter(function (h) { return !(h[0] === coin && (S.T.known === 'light' || h[1] === sign)); });
    var correct = mine.length > 0 && others.length === 0;
    var truth = correct ? mine[0] : others[Math.floor(S.r() * others.length)];
    var altNames = others.slice(0, 6).map(function (h) { return LETTERS[h[0]] + (S.T.known === 'light' ? '' : (h[1] === 'H' ? ' heavy' : ' light')); });
    if (others.length > 6) altNames.push('and ' + (others.length - 6) + ' more');
    S.answer = { coin: coin, sign: sign, correct: correct, trueCoin: truth[0], trueSign: truth[1], alts: altNames.join(', ') };
    S.done = true;
    renderAll();
    $('msg').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function renderSacks() {
    var T = D.trials[3], K = 0, s = '<table class="book"><thead><tr><th>Sack</th><th>Coins taken</th><th>Owed by the indenture</th>' + (sacks.reading !== null ? '<th>Light?</th>' : '') + '</tr></thead><tbody>';
    for (var i = 0; i < T.n; i++) {
      K += sacks.take[i];
      s += '<tr><td><b>' + (i + 1) + '</b></td><td><input class="num" type="number" min="0" max="' + T.capacity + '" step="1" data-s="' + i + '" value="' + sacks.take[i] + '"' + (sacks.reading !== null ? ' disabled' : '') + '></td><td>' + fmt1(sacks.take[i] * D.coin.grains) + ' gr</td>' +
        (sacks.reading !== null ? '<td><label class="chk"><input type="checkbox" data-k="' + i + '"' + (sacks.chosen[i] ? ' checked' : '') + (sacks.done ? ' disabled' : '') + '> light</label></td>' : '') + '</tr>';
    }
    s += '</tbody></table>';
    $('sackTable').innerHTML = s;
    var owed = K * D.coin.grains;
    var R = '';
    if (sacks.reading === null) R = 'On the hook: <b>' + K + '</b> coins, which by the indenture should weigh <b>' + fmt1(owed) + '</b> grains. Each sack holds ' + T.capacity + '.';
    else {
      var short = owed - sacks.reading;
      R = 'The steelyard reads <b>' + fmt1(sacks.reading) + ' grains</b> for ' + K + ' coins that should weigh ' + fmt1(owed) + '. Short by <b>' + fmt1(short) + '</b> grains, which is <b>' + fmt1(short / T.deficit) + '</b> light coins’ worth at ' + fmt1(T.deficit) + ' grains each. Tick the sacks you say are light.';
    }
    $('yardOut').innerHTML = R;
    $('btnHang').disabled = sacks.reading !== null || K === 0;
    $('btnSacks').disabled = sacks.reading === null || sacks.done;
    $('msgS').innerHTML = sacks.done ? sackMessage() : (sacks.reading === null ? 'Par is one hanging. Choose your coins so that whatever the steelyard says, it can only mean one thing.' : '');
    $('yardSvg').innerHTML = yardSVG(K);
  }
  function yardSVG(K) {
    // a steelyard: a beam on a hook, the draught on the short arm, the poise sliding on the long one
    var load = sacks.reading === null ? 0 : 1;
    var x = 120 + (sacks.reading === null ? 0 : Math.min(1, K / 120) * 460);
    var s = '<line x1="80" y1="0" x2="80" y2="34" stroke="#5d6a80" stroke-width="2"/>';
    s += '<line x1="40" y1="40" x2="700" y2="40" stroke="#cfd8e6" stroke-width="5" stroke-linecap="round"/>';
    for (var t = 120; t <= 680; t += 20) s += '<line x1="' + t + '" y1="34" x2="' + t + '" y2="' + (t % 100 === 20 ? 30 : 36) + '" stroke="#8b97ab" stroke-width="1"/>';
    s += '<circle cx="80" cy="40" r="4" fill="#e8edf5"/>';
    s += '<line x1="50" y1="40" x2="50" y2="78" stroke="#5d6a80" stroke-width="1.5"/>';
    s += '<path d="M30 78 L70 78 L64 104 L36 104 Z" fill="' + (load ? D.coin.col : '#2a3343') + '" opacity="' + (load ? .85 : 1) + '"/>';
    s += '<line x1="' + x.toFixed(1) + '" y1="40" x2="' + x.toFixed(1) + '" y2="66" stroke="#5d6a80" stroke-width="1.5"/>';
    s += '<rect x="' + (x - 12).toFixed(1) + '" y="66" width="24" height="30" rx="5" fill="#64f0c8"/>';
    s += '<text class="pn" x="' + x.toFixed(1) + '" y="112">POISE</text>';
    return s;
  }
  function hang() {
    var T = D.trials[3], K = 0, bad = 0;
    for (var i = 0; i < T.n; i++) { K += sacks.take[i]; if (T.bad.indexOf(i) >= 0) bad += sacks.take[i]; }
    if (!K) return;
    sacks.reading = Math.round((K * D.coin.grains - bad * T.deficit) * 10) / 10;
    renderSacks();
  }
  function sacksSure() {
    var T = D.trials[3], t = sacks.take, i, j;
    if (T.variant === 'one') {
      var seen = {};
      for (i = 0; i < T.n; i++) { if (seen[t[i]]) return false; seen[t[i]] = 1; }
      return true;
    }
    for (i = 0; i < T.n; i++) if (t[i] === 0) return false;
    var sums = {};
    for (var m = 0; m < (1 << T.n); m++) { var s = 0; for (j = 0; j < T.n; j++) if (m & (1 << j)) s += t[j]; if (sums[s]) return false; sums[s] = 1; }
    return true;
  }
  function judgeSacks() {
    var T = D.trials[3], chosen = [], i;
    for (i = 0; i < T.n; i++) if (sacks.chosen[i]) chosen.push(i);
    var correct = chosen.length === T.bad.length && chosen.every(function (c) { return T.bad.indexOf(c) >= 0; });
    if (T.variant === 'one' && chosen.length !== 1) correct = false;
    var total = sacks.take.reduce(function (a, b) { return a + b; }, 0);
    var min = T.variant === 'one' ? T.n * (T.n - 1) / 2 : Math.pow(2, T.n) - 1;
    sacks.result = { correct: correct, sure: sacksSure(), total: total, min: min };
    sacks.done = true;
    renderAll();
  }
  function sackMessage() {
    var T = D.trials[3], R = sacks.result;
    var truth = T.bad.length ? T.bad.map(function (b) { return 'sack ' + (b + 1); }).join(', ') : 'no sack at all';
    var s = R.correct ? '<b>The jury agrees: ' + truth + '.</b> ' : '<b>The jury finds otherwise.</b> It was ' + truth + '. ';
    if (R.sure) s += 'Your choice of coins could only ever have read one way, ' + (R.total <= R.min ? 'and no smaller handful would have done it (' + R.min + ' coins).' : 'though ' + R.min + ' coins would have done it and you hung ' + R.total + '.');
    else s += 'But your choice of coins could have read the same for two different answers' + (R.correct ? ', so the steelyard was kind to you today.' : '.') + ' ' + (T.variant === 'one' ? 'A different number from every sack (one of them may be none) would have made it certain.' : 'Taking 1, 2, 4, 8 and so on, doubling, would have made every reading mean one thing.');
    return s;
  }

  function describeW(w, T) {
    // w = [u1,h1,l1,g1,u2,h2,l2,g2] from the opening state, where only one class is in play
    var a = w[0] + w[1] + w[2], b = w[4] + w[5] + w[6];
    var s = numw(a) + (w[3] ? ' and the plate' : '') + ' against ' + numw(b) + (w[7] ? ' and the plate' : '');
    var off = T.n - a - b;
    return s + ', leaving ' + numw(off) + ' in the tray';
  }
  function renderVerdict() {
    var all = [0, 1, 2, 3].every(trialDone);
    var V = $('verdict');
    if (!all) { V.innerHTML = ''; V.className = 'verdict'; return; }
    var right = 0, onpar = 0, li = '';
    for (var i = 0; i < 3; i++) {
      var S = beams[i];
      if (S.answer.correct) right++;
      if (S.answer.correct && S.log.length <= S.par) onpar++;
      var bf = bestFirst([S.T.known === 'light' ? 0 : S.T.n, 0, S.T.known === 'light' ? S.T.n : 0, S.T.ref ? 1 : 0]);
      li += '<li><b>Trial ' + ROMAN[i] + ', ' + esc(S.T.title.toLowerCase()) + ':</b> ' + (S.answer.correct ? 'right' : 'wrong') + ', ' + plural(S.log.length, 'weighing', 'weighings') + ' (par ' + S.par + '). One way to open it: ' + (bf ? describeW(bf, S.T) : '—') + '.</li>';
    }
    var R = sacks.result; if (R.correct) right++; if (R.correct && R.sure && R.total <= R.min) onpar++;
    li += '<li><b>Trial IV, ' + esc(D.trials[3].title.toLowerCase()) + ':</b> ' + (R.correct ? 'right' : 'wrong') + ', ' + (R.sure ? 'certain' : 'a gamble') + ', ' + R.total + ' coins on the hook (the fewest that are certain: ' + R.min + ').</li>';
    var head = right === 4 ? (onpar === 4 ? 'The pyx is passed, and the jury has never seen it done so cleanly.' : 'The pyx is passed. Every answer stands.') : right >= 2 ? 'The jury signs, with reservations.' : 'The jury cannot sign.';
    V.className = 'verdict ' + (right === 4 ? 'good' : 'warn');
    V.innerHTML = '<b>The verdict of the jury, ' + D.year + '.</b> ' + head + ' ' + right + ' of four right, ' + onpar + ' of four at par.<ul class="per">' + li + '</ul>';
  }

  /* ---------- wiring ---------- */
  function moveCoin(c) {
    var S = beams[trialIx]; if (S.done) return;
    if (S.log.length && S.tilt !== 0) { S.tilt = 0; animateTo(0); }
    if (c < 0) S.refPos = (S.refPos + 1) % 3; else S.pos[c] = (S.pos[c] + 1) % 3;
    renderBeam();
    var el = document.querySelector('#beam .hit[data-c="' + c + '"]'); if (el) el.focus();
  }
  function wire() {
    $('beam').addEventListener('click', function (e) {
      var g = e.target.closest ? e.target.closest('.hit') : null;
      if (g) moveCoin(+g.getAttribute('data-c'));
    });
    $('beam').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var g = e.target.closest ? e.target.closest('.hit') : null;
      if (g) { e.preventDefault(); moveCoin(+g.getAttribute('data-c')); }
    });
    $('btnWeigh').onclick = function () {
      var S = beams[trialIx]; if (S.done) return;
      var c = counts(S); if (c[0] !== c[1] || !c[0]) return;
      anim.a = 0; doWeigh(S);
      $('btnWeigh').disabled = true;
      animateTo(S.tilt);
      setTimeout(renderBeam, 720);
    };
    $('btnClear').onclick = function () {
      var S = beams[trialIx]; if (S.done) return;
      for (var i = 0; i < S.pos.length; i++) S.pos[i] = 0; S.refPos = 0;
      S.tilt = 0; animateTo(0); renderBeam();
    };
    $('btnSlate').onclick = function () { slate = !slate; renderBeam(); };
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.tab') : null;
      if (b) { trialIx = +b.getAttribute('data-t'); renderAll(); }
    });
    $('sackTable').addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-s');
      if (k !== null) {
        var v = Math.max(0, Math.min(D.trials[3].capacity, Math.floor(+e.target.value || 0)));
        sacks.take[+k] = v;
        var K = sacks.take.reduce(function (a, b) { return a + b; }, 0);
        $('yardOut').innerHTML = 'On the hook: <b>' + K + '</b> coins, which by the indenture should weigh <b>' + fmt1(K * D.coin.grains) + '</b> grains. Each sack holds ' + D.trials[3].capacity + '.';
        var cell = e.target.parentNode.nextSibling; if (cell) cell.textContent = fmt1(v * D.coin.grains) + ' gr';
        $('btnHang').disabled = K === 0;
      }
    });
    $('sackTable').addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-k');
      if (k !== null) sacks.chosen[+k] = e.target.checked;
      if (e.target.getAttribute('data-s') !== null) e.target.value = sacks.take[+e.target.getAttribute('data-s')];
    });
    $('btnHang').onclick = hang;
    $('btnSacks').onclick = judgeSacks;
    $('btnReset').onclick = function () { var keep = trialIx; load(); trialIx = keep; renderAll(); };
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
