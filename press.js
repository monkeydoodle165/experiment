/* drift.quibo.games — The Press
   Imposition. The day's number sets up a printing house somewhere in Britain between
   1695 and 1795, gives it a book in the press and hands you one sheet of it: a quarto,
   an octavo or a sixteenmo, its pages made up and tied, and the folder's habit (which
   half she turns over first, and which way). Lay the pages in the two formes on the
   stone so that when the printed sheet is folded and cut, the gathering reads in order
   and every page stands head up.

   The page folds the sheet for real: every cell of it is carried through each fold as a
   rotation in three dimensions, stacked, and read off top to bottom once the last fold
   (the back of the book) is made. Pull a proof to fold your own sheet and see the
   gathering it makes. Self-contained. */
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
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function roman(n) {
    var v = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1], s = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'], o = '';
    for (var i = 0; i < v.length; i++) while (n >= v[i]) { o += s[i]; n -= v[i]; }
    return o;
  }

  /* ---------- formats ----------
     The grid is pages across by pages down, as the sheet lies for folding. Folds alternate
     across and down, halving the sheet each time; the last is always down the middle with the
     left half turned over onto the right, and that crease is the back of the book. */
  var FORMATS = [
    { name: 'quarto', mark: '4to', C: 2, R: 2, folds: ['h', 'v'] },
    { name: 'octavo', mark: '8vo', C: 4, R: 2, folds: ['v', 'h', 'v'] },
    { name: 'sixteenmo', mark: '16mo', C: 4, R: 4, folds: ['h', 'v', 'h', 'v'] }
  ];
  var FOLDTXT = {
    vL: 'turn the left half over onto the right',
    vR: 'turn the right half over onto the left',
    hT: 'bring the head down over the foot',
    hB: 'bring the foot up over the head'
  };
  var SIGS = 'BCDEFGHIKLMNOPQRSTVXYZ';

  /* ---------- folding: every cell carried through as a 180° turn about an axis in the table ----------
     A cell has a position in the current footprint, a depth in the pile there, and an orientation
     R = (rx, ry, rz): the signs of its own x, y and z axes in the world. Turning the left or right half
     over is a half-turn about the y axis (x and z change sign); bringing the head or foot over is a
     half-turn about the x axis (y and z change sign). The turned half lands on top in reverse order. */
  function simulate(C, R, folds, outerUp) {
    var cells = [];
    for (var k = 0; k < C * R; k++) {
      var c = k % C, r = Math.floor(k / C);
      cells.push({ k: k, x: outerUp ? c : C - 1 - c, y: r, z: 0, R: outerUp ? [1, 1, 1] : [-1, 1, -1], moved: false });
    }
    var W = C, H = R, L = 1, ox = 0, oy = 0;
    var stages = [{ cells: cells, W: W, H: H, L: L, ox: ox, oy: oy }];
    folds.forEach(function (f) {
      var m = f.a === 'v' ? W / 2 : H / 2;
      var next = cells.map(function (cl) {
        var n = { k: cl.k, x: cl.x, y: cl.y, z: cl.z, R: cl.R.slice(), moved: false };
        if (f.a === 'v') {
          var mv = f.d === 'L' ? cl.x < m : cl.x >= m;
          if (mv) { n.moved = true; n.x = f.d === 'L' ? m - 1 - cl.x : 2 * m - 1 - cl.x; n.R = [-cl.R[0], cl.R[1], -cl.R[2]]; n.z = 2 * L - 1 - cl.z; }
          else n.x = f.d === 'L' ? cl.x - m : cl.x;
        } else {
          var mh = f.d === 'T' ? cl.y < m : cl.y >= m;
          if (mh) { n.moved = true; n.y = f.d === 'T' ? m - 1 - cl.y : 2 * m - 1 - cl.y; n.R = [cl.R[0], -cl.R[1], -cl.R[2]]; n.z = 2 * L - 1 - cl.z; }
          else n.y = f.d === 'T' ? cl.y - m : cl.y;
        }
        return n;
      });
      if (f.a === 'v') { if (f.d === 'L') ox += m; W = m; } else { if (f.d === 'T') oy += m; H = m; }
      L *= 2;
      cells = next;
      stages.push({ cells: cells, W: W, H: H, L: L, ox: ox, oy: oy, fold: f, m: m });
    });
    var order = cells.slice().sort(function (a, b) { return b.z - a.z; });
    return { stages: stages, order: order };
  }

  function solve(fmt, folds, first) {
    var sim = simulate(fmt.C, fmt.R, folds, true), outerUp = true;
    if (sim.order[0].R[2] < 0) { sim = simulate(fmt.C, fmt.R, folds, false); outerUp = false; }
    var n = fmt.C * fmt.R, outer = new Array(n), inner = new Array(n);
    sim.order.forEach(function (cl, i) {
      var up = { p: first + 2 * i, s: cl.R[1] }, dn = { p: first + 2 * i + 1, s: cl.R[1] };
      if (cl.R[2] > 0) { outer[cl.k] = up; inner[cl.k] = dn; } else { outer[cl.k] = dn; inner[cl.k] = up; }
    });
    return { sim: sim, outerUp: outerUp, outer: outer, inner: inner };
  }

  /* read a laid sheet off the folded pile: what each page of the gathering turns out to be */
  function readGathering(D, lay) {
    var seq = [];
    D.sol.sim.order.forEach(function (cl, i) {
      var upF = cl.R[2] > 0 ? 0 : 1;
      [upF, 1 - upF].forEach(function (f, j) {
        var got = lay[f][cl.k], exp = D.first + 2 * i + j, st;
        var upright = got ? got.s * cl.R[1] === 1 : false;
        if (!got) st = 'blank';
        else if (got.p !== exp) st = 'wrong';
        else st = upright ? 'ok' : 'inv';
        seq.push({ exp: exp, got: got, upright: upright, st: st, recto: j === 0, leaf: i, forme: f, cell: cl.k });
      });
    });
    return seq;
  }

  /* ---------- the day's house and book ---------- */
  var PRINTERS = ['Hallowes', 'Pettigrew', 'Marsden', 'Ormerod', 'Truscott', 'Callander', 'Ibbotson', 'Lavington',
    'Wragg', 'Fenwick', 'Sowerby', 'Gedge', 'Rudd', 'Kilvington', 'Thackwray', 'Bowden', 'Gillies', 'Penhale'];
  var INITIALS = ['W.', 'J.', 'T.', 'R.', 'S.', 'H.', 'E.', 'A.', 'G.', 'M.'];
  var TOWNS = [['London', 'at the Bible and Crown in Paternoster Row'], ['London', 'near Temple Bar'], ['Edinburgh', 'in the Parliament Close'],
    ['Dublin', 'in Dame Street'], ['Bristol', 'in Wine Street'], ['Norwich', 'in the Market Place'], ['York', 'in Stonegate'],
    ['Glasgow', 'in the Saltmarket'], ['Newcastle', 'on the Side'], ['Bath', 'in Cheap Street'], ['Chester', 'in Eastgate Street'],
    ['Exeter', 'in the Fore Street'], ['Shrewsbury', 'on the Wyle Cop']];
  var BOOKS = [
    ['A Treatise of', ['Bees', 'Fevers', 'the Longitude', 'Husbandry', 'Brewing', 'Fluxions', 'Planting', 'Timber', 'Mineral Waters', 'Mensuration', 'Dialling']],
    ['An Essay on', ['the Tides', 'the Culture of Hops', 'Fen Drainage', 'the Rot in Sheep', 'Hedging and Ditching', 'the Northern Lights', 'Bells and Ringing']],
    ['Observations upon', ['the Weather of Several Years', 'the Herring Fishery', 'Lime as a Manure', 'the Late Earthquakes', 'the Coal Trade']],
    ['The Compleat', ['Brewer', 'Gardener', 'Surveyor', 'Angler', 'Dyer', 'Navigator', 'Cheesemaker', 'Farrier']],
    ['A New Method of', ['Raising Water', 'Keeping Accounts', 'Curing Bacon', 'Finding the Latitude', 'Teaching Writing']],
    ['A Discourse concerning', ['Comets', 'the Plague', 'Turnpike Roads', 'Weights and Measures', 'the Use of Tea']]
  ];
  var AUTHROLE = ['Gardener', 'Surveyor', 'M.D.', 'Schoolmaster', 'F.R.S.', 'Clerk', 'Land Steward', 'Teacher of the Mathematicks', 'Apothecary'];
  var AUTHSUR = ['Harrow', 'Quiller', 'Bellamy', 'Ruddock', 'Tremayne', 'Skelton', 'Gwynne', 'Laidlaw', 'Fothergill', 'Ashby', 'Croft', 'Leaper'];
  var WORDS = ['the', 'and', 'of', 'which', 'that', 'upon', 'being', 'whereas', 'but', 'for', 'this', 'as', 'it', 'they', 'when', 'from',
    'with', 'there', 'so', 'such', 'by', 'all', 'where', 'some', 'in', 'not', 'what', 'having', 'our', 'these', 'one', 'water', 'ground',
    'season', 'quantity', 'manner', 'experience', 'others', 'great', 'little', 'second', 'third', 'part', 'common', 'nature', 'reason'];
  var FOLDERS = ['Mrs', 'Mrs', 'Widow', 'Miss'];
  var FSURN = ['Pratt', 'Leggatt', 'Duckett', 'Wildbore', 'Snell', 'Goodyear', 'Toft', 'Ivatt'];

  function makeDay(date) {
    var r = rng(mix(seedForDate(date), 44));
    var u = r(), fmt = u < 0.3 ? FORMATS[0] : u < 0.8 ? FORMATS[1] : FORMATS[2];
    var folds = fmt.folds.map(function (a, i) {
      if (i === fmt.folds.length - 1) return { a: 'v', d: 'L' };
      return { a: a, d: a === 'v' ? (r() < 0.5 ? 'L' : 'R') : (r() < 0.5 ? 'T' : 'B') };
    });
    var N = fmt.C * fmt.R * 2;
    var si = Math.floor(r() * (fmt.name === 'sixteenmo' ? 5 : 10));
    var first = si * N + 1, last = first + N - 1;
    var town = pick(r, TOWNS), printer = pick(r, INITIALS) + ' ' + pick(r, PRINTERS);
    var bk = pick(r, BOOKS), title = bk[0] + ' ' + pick(r, bk[1]);
    var author = pick(r, INITIALS) + ' ' + pick(r, AUTHSUR) + ', ' + pick(r, AUTHROLE);
    var year = 1695 + Math.floor(r() * 101);
    var folder = pick(r, FOLDERS) + ' ' + pick(r, FSURN);
    var words = {};
    for (var p = first; p <= last + 1; p++) words[p] = pick(r, WORDS);
    var D = { date: date, fmt: fmt, folds: folds, N: N, first: first, last: last, sig: SIGS.charAt(si), title: title,
      author: author, printer: printer, town: town, year: year, folder: folder, words: words };
    D.sol = solve(fmt, folds, first);
    return D;
  }

  /* ---------- state ---------- */
  function $(id) { return document.getElementById(id); }
  var dayOff = 0, D = null, lay = null, sel = null, view = 'sheet', proofs = 0, scraps = 0, done = false, gaveUp = false,
    hintCell = null, anim = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function placedAt(p) {
    for (var f = 0; f < 2; f++) for (var k = 0; k < lay[f].length; k++) if (lay[f][k] && lay[f][k].p === p) return { f: f, k: k };
    return null;
  }
  function nextUnplaced(after) {
    for (var p = after + 1; p <= D.last; p++) if (!placedAt(p)) return p;
    for (p = D.first; p <= D.last; p++) if (!placedAt(p)) return p;
    return null;
  }

  var GPH = '<h5>The gathering</h5><p class="formula">Pull a proof to see how the folded sheet reads.</p>';
  function load() {
    stopAnim();
    D = makeDay(dateFor(dayOff));
    var n = D.fmt.C * D.fmt.R;
    lay = [new Array(n), new Array(n)];
    for (var i = 0; i < n; i++) { lay[0][i] = null; lay[1][i] = null; }
    sel = D.first; proofs = 0; scraps = 0; done = false; gaveUp = false; hintCell = null;
    $('dayOut').textContent = longDate(D.date) + (dayOff === 0 ? ' · today' : '');
    $('plWho').textContent = D.printer + ', printer · ' + D.town[0] + ' · ' + D.year;
    $('plName').textContent = D.title;
    var leaves = n, nf = D.folds.length;
    $('plBlurb').innerHTML = 'By ' + esc(D.author) + '. Printed by ' + esc(D.printer) + ' ' + esc(D.town[1]) + ', ' + roman(D.year) +
      '. On the stone today: sheet <b>' + D.sig + '</b> of the ' + D.fmt.name + ' (' + D.fmt.mark + '), pages <b>' + D.first + '</b> to <b>' + D.last +
      '</b>. That is ' + numw(D.N) + ' pages to the sheet, ' + numw(D.N / 2) + ' in each forme, folded ' + numw(nf) + ' times into ' + numw(leaves) +
      ' leaves. The pages are made up and tied; the chases are on the stone.';
    var steps = '<li>' + (D.sol.outerUp ? 'Lay the sheet <b>outer forme uppermost</b>' : 'Lay the sheet <b>inner forme uppermost</b>') + ', head of the sheet away from you.</li>';
    D.folds.forEach(function (f, i) {
      steps += '<li>' + cap(FOLDTXT[f.a + f.d]) + (i === nf - 1 ? '. This crease is the back of the book.' : '.') + '</li>';
    });
    $('folder').innerHTML = '<h5>' + esc(D.folder) + ', the folder, always folds a sheet the same way</h5><ol>' + steps + '</ol>' +
      '<p class="formula">Then the folds at the head and the fore-edge are cut open, and the leaves should read ' + D.first + ', ' + (D.first + 1) +
      ', ' + (D.first + 2) + ' … ' + D.last + ', every page head up.</p>';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('gathering').innerHTML = GPH; $('rules').innerHTML = ''; $('rules').style.display = 'none';
    $('msg').textContent = '';
    renderAll();
    resizeCanvas();
    drawFlat();
  }

  /* ---------- the tray and the stone ---------- */
  function pageFace(pc, cls) {
    if (!pc) return '<span class="pg empty"><em>empty</em></span>';
    var t = (pc.s < 0 ? ' inv' : '') + (view === 'stone' ? ' mir' : '');
    return '<span class="pg' + t + (cls || '') + '"><b>' + pc.p + '</b><i></i><i></i><i></i><i class="s"></i></span>';
  }
  function renderAll() {
    var t = '';
    for (var p = D.first; p <= D.last; p++) {
      var at = placedAt(p);
      t += '<button type="button" class="chip pchip' + (at ? ' used' : '') + (sel === p ? ' on' : '') + '" data-p="' + p + '">' + p + '</button>';
    }
    $('tray').innerHTML = t;
    var C = D.fmt.C, R = D.fmt.R;
    var names = ['Outer forme', 'Inner forme'];
    var out = '';
    for (var f = 0; f < 2; f++) {
      var ins = f === 0 ? 'the side with page ' + D.first + ' on it' : 'the back of the same sheet, turned over left to right';
      out += '<div class="forme"><h5>' + names[f] + ' <span>' + ins + '</span></h5><div class="chase" style="grid-template-columns:repeat(' + C + ',minmax(0,1fr))">';
      for (var r = 0; r < R; r++) for (var cc = 0; cc < C; cc++) {
        var c = cc;
        if (f === 1) c = C - 1 - c;            /* inner forme seen from its own side */
        if (view === 'stone') c = C - 1 - c;    /* the type lies the mirror way round */
        var k = r * C + c, pc = lay[f][k];
        var h = hintCell && hintCell.f === f && hintCell.k === k;
        out += '<button type="button" class="slot' + (pc ? ' full' : '') + (h ? ' hint' : '') + '" data-f="' + f + '" data-k="' + k + '" aria-label="' +
          names[f] + ', row ' + (r + 1) + ', place ' + (cc + 1) + (pc ? ': page ' + pc.p + (pc.s < 0 ? ', head down' : ', head up') : ': empty') + '">' +
          pageFace(pc) + (h ? '<span class="hintlab">' + D.sol[f === 0 ? 'outer' : 'inner'][k].p + (D.sol[f === 0 ? 'outer' : 'inner'][k].s < 0 ? ' head down' : ' head up') + '</span>' : '') + '</button>';
      }
      out += '</div></div>';
    }
    $('stone').innerHTML = out;
    $('stone').className = view;
    $('btnView').textContent = view === 'sheet' ? 'Show the type as it lies on the stone' : 'Show it as it will print';
    var placed = 0;
    for (f = 0; f < 2; f++) for (k = 0; k < lay[f].length; k++) if (lay[f][k]) placed++;
    $('count').textContent = placed + ' of ' + D.N + ' pages laid · proofs pulled: ' + proofs + ' · scraps folded: ' + scraps;
  }

  $('tray').addEventListener('click', function (e) {
    var b = e.target.closest('.pchip'); if (!b || done) return;
    sel = +b.getAttribute('data-p'); hintCell = null; renderAll();
  });
  $('stone').addEventListener('click', function (e) {
    var b = e.target.closest('.slot'); if (!b || done || anim) return;
    var f = +b.getAttribute('data-f'), k = +b.getAttribute('data-k'), pc = lay[f][k];
    hintCell = null;
    if (!pc) {
      if (sel == null) { $('msg').textContent = 'Every page is laid. Click a page on the stone to turn it head down, and again to lift it off.'; return; }
      var at = placedAt(sel); if (at) lay[at.f][at.k] = null;
      lay[f][k] = { p: sel, s: 1 };
      sel = nextUnplaced(sel);
    } else if (pc.s > 0) pc.s = -1;
    else { lay[f][k] = null; sel = pc.p; }
    $('msg').textContent = '';
    renderAll(); drawFlat();
  });
  $('btnView').addEventListener('click', function () { view = view === 'sheet' ? 'stone' : 'sheet'; renderAll(); });
  $('btnClear').addEventListener('click', function () {
    if (done || anim) return;
    for (var f = 0; f < 2; f++) for (var k = 0; k < lay[f].length; k++) lay[f][k] = null;
    sel = D.first; hintCell = null; renderAll(); drawFlat();
  });
  $('btnScrap').addEventListener('click', function () {
    if (done || anim) return;
    var p = sel != null ? sel : D.first;
    for (var f = 0; f < 2; f++) for (var k = 0; k < lay[f].length; k++) {
      var s = (f === 0 ? D.sol.outer : D.sol.inner)[k];
      if (s.p === p) hintCell = { f: f, k: k };
    }
    scraps++;
    $('msg').textContent = 'You fold a scrap of waste the way ' + D.folder + ' does, write ' + p + ' on the right leaf and open it out again. It is marked on the stone.';
    renderAll();
  });
  $('btnGive').addEventListener('click', function () {
    if (done || anim) return;
    var n = lay[0].length;
    for (var k = 0; k < n; k++) { lay[0][k] = { p: D.sol.outer[k].p, s: D.sol.outer[k].s }; lay[1][k] = { p: D.sol.inner[k].p, s: D.sol.inner[k].s }; }
    gaveUp = true; sel = null; hintCell = null; renderAll(); drawFlat(); proof();
  });
  $('btnProof').addEventListener('click', function () { if (!done && !anim) proof(); });
  $('btnFoldAgain').addEventListener('click', function () { if (!anim) runFold(function () {}); });

  /* ---------- the folding table (canvas) ---------- */
  var cv = $('fold'), ctx = cv.getContext('2d'), CW = 0, CH = 0, cw = 0, ch = 0, x0 = 0, y0 = 0;
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600;
    var C = D.fmt.C, R = D.fmt.R, ar = 0.66;
    ch = Math.min(300 / R, (w - 24) / (C * ar)); cw = ch * ar;
    CW = w; CH = Math.round(R * ch + 30);
    cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr); cv.style.height = CH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    x0 = (CW - C * cw) / 2; y0 = 15;
  }
  function drawFace(cx, cy, sx, sy, f, pc, rot) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(Math.max(sx, 0.001), Math.max(sy, 0.001));
    var w = cw - 4, h = ch - 4;
    ctx.fillStyle = f === 0 ? '#efe6cf' : '#dfe3d6';
    ctx.strokeStyle = 'rgba(70,55,30,.55)'; ctx.lineWidth = 1;
    ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2 + .5, -h / 2 + .5, w - 1, h - 1);
    ctx.fillStyle = 'rgba(70,55,30,.5)';
    ctx.font = '600 ' + Math.max(8, Math.min(11, ch * 0.09)) + 'px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(f === 0 ? 'outer' : 'inner', 0, h / 2 - 3);
    if (pc) {
      if (rot) ctx.rotate(Math.PI);
      ctx.fillStyle = '#3b2f17';
      ctx.font = '700 ' + Math.max(11, Math.min(22, ch * 0.2)) + 'px Georgia,"Times New Roman",serif';
      ctx.textBaseline = 'top';
      ctx.fillText(String(pc.p), 0, -h / 2 + 6);
      ctx.fillStyle = 'rgba(59,47,23,.28)';
      var lh = Math.max(3, h * 0.06), top = -h / 2 + 6 + Math.min(22, ch * 0.2) + 6;
      for (var i = 0; i < 4; i++) ctx.fillRect(-w / 2 + w * 0.16, top + i * lh * 1.8, w * (i === 3 ? 0.4 : 0.68), lh);
    }
    ctx.restore();
  }
  function faceOf(cl, side) {           /* side 0: the face now uppermost */
    var f = (cl.R[2] > 0) === (side === 0) ? 0 : 1;
    return { f: f, pc: lay[f][cl.k] };
  }
  function tops(cells, filter) {
    var t = {};
    cells.forEach(function (cl) {
      if (filter && !filter(cl)) return;
      var key = cl.x + ',' + cl.y;
      if (!t[key] || t[key].z < cl.z) t[key] = cl;
    });
    return Object.keys(t).map(function (k) { return t[k]; });
  }
  function drawCell(cl, st, cx, cy, sx, sy) {
    var fc = faceOf(cl, 0);
    drawFace(cx, cy, sx, sy, fc.f, fc.pc, fc.pc ? fc.pc.s * cl.R[1] < 0 : false);
  }
  function drawStage(si, t) {
    ctx.clearRect(0, 0, CW, CH);
    var st = D.sol.sim.stages[si];
    var nx = D.sol.sim.stages[si + 1];
    var moving = t > 0 && nx;
    var thick = Math.min(5, Math.log2(st.L));
    function cxOf(st2, cl) { return x0 + (st2.ox + cl.x + 0.5) * cw; }
    function cyOf(st2, cl) { return y0 + (st2.oy + cl.y + 0.5) * ch; }
    /* stationary part (or everything) */
    var still = moving ? nx.cells.filter(function (c) { return !c.moved; }) : st.cells;
    var stillStage = moving ? nx : st;
    if (thick > 0 || moving) {
      tops(still).forEach(function (cl) {
        for (var i = thick; i > 0; i--) {
          ctx.fillStyle = 'rgba(200,190,160,' + (0.18 + 0.05 * i) + ')';
          ctx.fillRect(cxOf(stillStage, cl) - cw / 2 + 2 + i * 1.5, cyOf(stillStage, cl) - ch / 2 + 2 + i * 1.5, cw - 4, ch - 4);
        }
      });
    }
    tops(still).forEach(function (cl) { drawCell(cl, stillStage, cxOf(stillStage, cl), cyOf(stillStage, cl), 1, 1); });
    if (!moving) return;
    var f = nx.fold, ang = t * Math.PI, co = Math.cos(ang);
    var creaseX = x0 + (st.ox + nx.m) * cw, creaseY = y0 + (st.oy + nx.m) * ch;
    var lift = Math.sin(ang) * 6;
    if (co >= 0) {
      var movedKeys = {};
      nx.cells.forEach(function (c) { if (c.moved) movedKeys[c.k] = 1; });
      tops(st.cells, function (c) { return movedKeys[c.k]; }).forEach(function (cl) {
        var bx = cxOf(st, cl), by = cyOf(st, cl);
        if (f.a === 'v') drawCell(cl, st, creaseX + (bx - creaseX) * co, by - lift, co, 1);
        else drawCell(cl, st, bx - lift, creaseY + (by - creaseY) * co, 1, co);
      });
    } else {
      tops(nx.cells, function (c) { return c.moved; }).forEach(function (cl) {
        var ax = cxOf(nx, cl), ay = cyOf(nx, cl);
        if (f.a === 'v') drawCell(cl, nx, creaseX + (ax - creaseX) * -co, ay - lift, -co, 1);
        else drawCell(cl, nx, ax - lift, creaseY + (ay - creaseY) * -co, 1, -co);
      });
    }
  }
  function drawFlat() { if (!anim) { drawStage(0, 0); $('foldNote').textContent = 'The sheet as ' + D.folder + ' lays it, ' + (D.sol.outerUp ? 'outer' : 'inner') + ' forme up. Pull a proof to fold it.'; } }
  function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } }
  function runFold(cb) {
    stopAnim();
    var nf = D.folds.length;
    if (reduce) { drawStage(nf, 0); $('foldNote').textContent = 'Folded ' + numw(nf) + ' times: ' + numw(D.N / 2) + ' leaves, back to the left.'; cb(); return; }
    var dur = 850, gap = 260, t0 = performance.now();
    anim = { raf: 0 };
    (function frame(now) {
      var el = now - t0, per = dur + gap, i = Math.floor(el / per), w = el - i * per;
      if (i >= nf) {
        drawStage(nf, 0); anim = null;
        $('foldNote').textContent = 'Folded ' + numw(nf) + ' times: ' + numw(D.N / 2) + ' leaves, back to the left. Cut the head and fore-edge and turn the leaves.';
        cb(); return;
      }
      if (w < gap) drawStage(i, 0);
      else drawStage(i, Math.min(1, (w - gap) / dur));
      $('foldNote').textContent = 'Fold ' + (i + 1) + ' of ' + nf + ': ' + FOLDTXT[D.folds[i].a + D.folds[i].d] + '.';
      anim.raf = requestAnimationFrame(frame);
    })(t0);
  }

  /* ---------- the proof ---------- */
  function proof() {
    proofs++;
    renderAll();
    var seq = readGathering(D, lay);
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict'; $('gathering').innerHTML = '<h5>The gathering</h5><p class="formula">Folding…</p>';
    runFold(function () { showGathering(seq); });
  }
  function sigFor(e) {
    if (!e.recto || e.leaf >= D.N / 4) return '';
    return D.sig + (e.leaf === 0 ? '' : String(e.leaf + 1));
  }
  function showGathering(seq) {
    var html = '<h5>The gathering, leaf by leaf as it comes off the fold</h5><div class="strip">';
    seq.forEach(function (e, i) {
      var g = e.got, cls = 'leafpg ' + e.st + (e.recto ? ' recto' : ' verso');
      var inner = '';
      if (g) {
        var sig = e.st === 'ok' || e.st === 'inv' ? sigFor(e) : '';
        inner = '<span class="lp' + (e.upright ? '' : ' inv') + '"><b>' + g.p + '</b><em>' + esc(D.words[g.p]) + '</em><i></i><i></i><i></i><i></i>' +
          '<span class="foot"><span class="sig">' + sig + '</span><span class="cw">' + esc(D.words[g.p + 1]) + '</span></span></span>';
      } else inner = '<span class="lp blankpg">blank</span>';
      html += '<div class="' + cls + '" title="should be page ' + e.exp + '">' + inner + '<span class="want">' + (e.st === 'ok' ? '✓ ' + e.exp : e.st === 'inv' ? e.exp + ' upside down' : e.st === 'blank' ? 'want ' + e.exp : 'want ' + e.exp) + '</span></div>';
      if (i % 2 === 1 && i < seq.length - 1) html += '<span class="turn"></span>';
    });
    html += '</div><p class="formula">Each page carries its first word and, bottom right, the catchword: the first word of the page that ought to follow. ' +
      'Signatures (' + D.sig + ', ' + D.sig + '2 …) mark the rectos of the first half of the gathering, so the binder can check the fold.</p>';
    $('gathering').innerHTML = html;
    var ok = seq.filter(function (e) { return e.st === 'ok'; }).length;
    var inv = seq.filter(function (e) { return e.st === 'inv'; }).length;
    var wrong = seq.filter(function (e) { return e.st === 'wrong'; }).length;
    var blank = seq.filter(function (e) { return e.st === 'blank'; }).length;
    var v = $('verdict');
    if (ok === D.N) {
      done = true;
      var grade;
      if (gaveUp) grade = 'The overseer laid it for you. Fold this proof again and watch where each page goes, then try tomorrow\'s sheet.';
      else if (proofs === 1 && scraps === 0) grade = 'First proof, no waste folded. That is a compositor who knows the scheme.';
      else if (proofs === 1) grade = 'Clean on the first proof, with ' + numw(scraps) + ' scrap' + (scraps > 1 ? 's' : '') + ' of waste folded on the way.';
      else grade = 'Right on proof ' + numw(proofs) + (scraps ? ', with ' + numw(scraps) + ' scrap' + (scraps > 1 ? 's' : '') + ' of waste folded' : '') + '. Every spoilt proof is a sheet the warehouse will not get back.';
      v.className = 'verdict good';
      v.innerHTML = '<p><b>Passed for press.</b> Sheet ' + D.sig + ' reads ' + D.first + ' to ' + D.last + ' in order, every page head up.</p><p>' + grade + '</p>';
      showRules();
    } else {
      v.className = 'verdict warn';
      var bits = [];
      if (ok) bits.push(numw(ok) + ' right');
      if (inv) bits.push(numw(inv) + ' in the right place but upside down');
      if (wrong) bits.push(numw(wrong) + ' out of order');
      if (blank) bits.push(numw(blank) + ' blank');
      v.innerHTML = '<p><b>Proof ' + numw(proofs) + ' will not do.</b> Of ' + numw(D.N) + ' pages: ' + bits.join(', ') + '.</p>' +
        '<p>Mend the formes and pull another, or fold a scrap of waste for the page you are stuck on.</p>';
    }
    renderAll();
  }

  function showRules() {
    var C = D.fmt.C, R = D.fmt.R, S = D.first + D.last;
    var order = D.sol.sim.order, L = order.length;
    /* conjugate leaves: k and L-1-k, joined at the back */
    var adj = 0, pairs = 0;
    for (var k = 0; k < L / 2; k++) {
      var a = order[k].k, b = order[L - 1 - k].k;
      pairs++;
      var ra = Math.floor(a / C), rb = Math.floor(b / C);
      if (ra === rb && Math.abs(a - b) === 1) adj++;
    }
    var invRows = [];
    for (var r = 0; r < R; r++) if (D.sol.outer[r * C].s < 0) invRows.push(r + 1);
    function list(arr) { return arr.map(function (x) { return x.p + (x.s < 0 ? '↓' : ''); }); }
    var o = '<h5>What the scheme comes to</h5><ul class="rulelist">';
    o += '<li>A page and the page it is folded against at the back always add to <b>' + S + '</b> (' + D.first + ' + ' + D.last + '): ' +
      'recto of one leaf, verso of its conjugate. Here ' + (adj === pairs ? 'all ' + numw(pairs) : numw(adj) + ' of ' + numw(pairs)) + ' conjugate pairs lie side by side on the sheet.</li>';
    o += '<li>The outer forme carries the first page and the last, ' + D.first + ' and ' + D.last + '; the inner forme carries ' + (D.first + 1) + ' and ' + (D.last - 1) + '.</li>';
    o += '<li>' + (invRows.length ? 'Row' + (invRows.length > 1 ? 's ' : ' ') + invRows.join(' and ') + ' of the outer forme stand' + (invRows.length > 1 ? '' : 's') + ' head down, because the folds across the sheet bring those heads round to meet the others.' : 'Every page stands head up: no fold here turns a head round.') + '</li>';
    o += '<li>Outer forme, as it prints, row by row: ' + rowsOf(0) + '. Inner forme: ' + rowsOf(1) + '. (↓ head down.)</li>';
    o += '</ul>';
    function rowsOf(f) {
      var rows = [];
      for (var r2 = 0; r2 < R; r2++) {
        var row = [];
        for (var c = 0; c < C; c++) { var cc = f === 1 ? C - 1 - c : c; row.push((f === 0 ? D.sol.outer : D.sol.inner)[r2 * C + cc]); }
        rows.push(list(row).join(' '));
      }
      return rows.join(' / ');
    }
    $('rules').innerHTML = o; $('rules').style.display = '';
  }

  /* ---------- days ---------- */
  $('btnReset').addEventListener('click', function () { load(); });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { dayOff--; load(); }
    else if (e.key === 'ArrowRight') { dayOff++; load(); }
  });
  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (anim) return; resizeCanvas(); if (done) drawStage(D.folds.length, 0); else drawFlat(); }, 120);
  });

  load();
})();
