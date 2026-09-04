/* experiment.quibo.games — The Lattice
   A seeded pipe puzzle. Rotate every tile until the whole network lights up.
   Self-contained. No dependencies. */
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

  function seedForToday() {
    var d = new Date();
    var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  /* ---------- direction helpers: 0=N 1=E 2=S 3=W ---------- */
  var DX = [0, 1, 0, -1];
  var DY = [-1, 0, 1, 0];
  var BIT = [1, 2, 4, 8];
  var OPP = [4, 8, 1, 2];

  function rotMask(m, r) {
    r = ((r % 4) + 4) % 4;
    var out = 0;
    for (var i = 0; i < 4; i++) if (m & BIT[i]) out |= BIT[(i + r) % 4];
    return out;
  }

  function popcount(m) {
    var c = 0;
    while (m) { c += m & 1; m >>= 1; }
    return c;
  }

  /* ---------- sizes ---------- */
  var SIZES = [
    { name: 'Small', n: 5 },
    { name: 'Medium', n: 7 },
    { name: 'Large', n: 9 },
    { name: 'Unreasonable', n: 12 }
  ];

  /* ---------- state ---------- */
  var canvas = document.getElementById('lattice');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cols = 7, rows = 7, sizeIdx = 1;
  var seed = 0, isToday = true;
  var mask = null;      // solved orientation of every tile
  var rot = null;       // current rotation, 0..3
  var anim = null;      // visual offset in radians, eased back to 0
  var root = 0;         // the tile the current flows out of
  var moves = 0, hints = 0;
  var started = 0, finished = 0, solved = false;
  var pulse = 0;
  var W = 0, H = 0, DPR = 1, cell = 0, ox = 0, oy = 0;
  var needsDraw = true;

  function idx(x, y) { return y * cols + x; }
  function eff(i) { return rotMask(mask[i], rot[i]); }

  /* ---------- generation: randomised Prim spanning tree ---------- */
  function generate(s) {
    var rand = rng(s);
    var n = cols * rows;
    mask = new Uint8Array(n);
    rot = new Int8Array(n);
    anim = new Float32Array(n);

    var seen = new Uint8Array(n);
    var frontier = [];
    root = idx(cols >> 1, rows >> 1);

    function open(i) {
      var x = i % cols, y = (i / cols) | 0;
      for (var d = 0; d < 4; d++) {
        var nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var ni = ny * cols + nx;
        if (!seen[ni]) frontier.push([i, d, ni]);
      }
    }

    seen[root] = 1;
    open(root);
    while (frontier.length) {
      var k = (rand() * frontier.length) | 0;
      var e = frontier[k];
      frontier[k] = frontier[frontier.length - 1];
      frontier.pop();
      if (seen[e[2]]) continue;
      seen[e[2]] = 1;
      mask[e[0]] |= BIT[e[1]];
      mask[e[2]] |= OPP[e[1]];
      open(e[2]);
    }

    // scramble
    for (var i = 0; i < n; i++) rot[i] = (rand() * 4) | 0;

    // never hand out an already-finished puzzle
    if (checkSolved()) {
      for (var j = 0; j < n; j++) {
        if (rotMask(mask[j], 1) !== mask[j]) { rot[j] = (rot[j] + 1) & 3; break; }
      }
    }

    moves = 0; hints = 0; started = 0; finished = 0; solved = false; pulse = 0;
    seed = s >>> 0;
    updateReadout();
  }

  /* ---------- rules ---------- */
  function checkSolved() {
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = idx(x, y), m = eff(i);
        for (var d = 0; d < 4; d++) {
          if (!(m & BIT[d])) continue;
          var nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
          if (!(eff(ny * cols + nx) & OPP[d])) return false;
        }
      }
    }
    return true;
  }

  function power() {
    var n = cols * rows;
    var pw = new Uint8Array(n);
    var q = [root];
    pw[root] = 1;
    while (q.length) {
      var c = q.pop();
      var x = c % cols, y = (c / cols) | 0, m = eff(c);
      for (var d = 0; d < 4; d++) {
        if (!(m & BIT[d])) continue;
        var nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var ni = ny * cols + nx;
        if (pw[ni]) continue;
        if (eff(ni) & OPP[d]) { pw[ni] = 1; q.push(ni); }
      }
    }
    return pw;
  }

  /* ---------- layout ---------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var side = canvas.clientWidth || 520;
    W = side; H = side;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var pad = 10;
    cell = Math.floor(Math.min((W - pad * 2) / cols, (H - pad * 2) / rows));
    ox = Math.floor((W - cell * cols) / 2);
    oy = Math.floor((H - cell * rows) / 2);
  }

  /* ---------- drawing ---------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var pw = power();
    var half = cell / 2;
    var lw = Math.max(2.5, cell * 0.14);

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = idx(x, y);
        var cx = ox + x * cell + half;
        var cy = oy + y * cell + half;
        var lit = !!pw[i];

        // tile bed
        ctx.fillStyle = lit ? 'rgba(100,240,200,.055)' : 'rgba(255,255,255,.018)';
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        ctx.lineWidth = 1;
        roundRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, Math.max(4, cell * 0.14));
        ctx.fill();
        ctx.stroke();

        // pipes
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot[i] * Math.PI / 2 + anim[i]);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = lw;
        if (lit) {
          ctx.strokeStyle = '#64f0c8';
          ctx.fillStyle = '#64f0c8';
          ctx.shadowColor = 'rgba(100,240,200,.75)';
          ctx.shadowBlur = solved ? 10 + pulse * 12 : 7;
        } else {
          ctx.strokeStyle = '#46536a';
          ctx.fillStyle = '#46536a';
          ctx.shadowBlur = 0;
        }

        var reach = half - 2;
        var m = mask[i];
        ctx.beginPath();
        for (var d = 0; d < 4; d++) {
          if (!(m & BIT[d])) continue;
          ctx.moveTo(0, 0);
          ctx.lineTo(DX[d] * reach, DY[d] * reach);
        }
        ctx.stroke();

        // endpoints get a lamp, junctions get a hub
        var arms = popcount(m);
        ctx.beginPath();
        ctx.arc(0, 0, arms === 1 ? cell * 0.17 : cell * 0.09, 0, Math.PI * 2);
        ctx.fill();

        if (i === root) {
          ctx.beginPath();
          ctx.arc(0, 0, cell * 0.26, 0, Math.PI * 2);
          ctx.strokeStyle = lit ? '#7aa2ff' : '#46536a';
          ctx.lineWidth = Math.max(1.5, cell * 0.045);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.shadowBlur = 0;
  }

  /* ---------- loop ---------- */
  function frame() {
    var moving = false;
    for (var i = 0; i < anim.length; i++) {
      if (anim[i] !== 0) {
        anim[i] *= reduce ? 0 : 0.74;
        if (Math.abs(anim[i]) < 0.002) anim[i] = 0;
        moving = true;
      }
    }
    if (solved) pulse = (Math.sin(Date.now() / 420) + 1) / 2;
    if (moving || solved || needsDraw) { draw(); needsDraw = false; }
    if (!finished) tick();
    requestAnimationFrame(frame);
  }

  /* ---------- interaction ---------- */
  function turn(i, dir) {
    if (solved) return;
    if (!started) started = Date.now();
    rot[i] = (rot[i] + dir + 4) & 3;
    anim[i] = -dir * Math.PI / 2;
    moves++;
    needsDraw = true;
    if (checkSolved()) {
      solved = true;
      finished = Date.now();
    }
    updateReadout();
  }

  function cellAt(e) {
    var r = canvas.getBoundingClientRect();
    var x = Math.floor(((e.clientX - r.left) * (W / r.width) - ox) / cell);
    var y = Math.floor(((e.clientY - r.top) * (H / r.height) - oy) / cell);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
    return idx(x, y);
  }

  canvas.addEventListener('pointerdown', function (e) {
    var i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    turn(i, (e.shiftKey || e.button === 2) ? -1 : 1);
  });
  canvas.addEventListener('contextmenu', function (e) {
    var i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
  });

  /* ---------- readout ---------- */
  function $(id) { return document.getElementById(id); }

  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function tick() {
    var el = $('timeOut');
    if (!el) return;
    el.textContent = started ? fmt(Date.now() - started) : '0:00';
  }

  function updateReadout() {
    if ($('seedOut')) $('seedOut').textContent =
      (isToday ? 'today · ' : 'random · ') + String(seed).slice(0, 6);
    if ($('movesOut')) $('movesOut').textContent = moves + (hints ? ' (+' + hints + ' hinted)' : '');
    if ($('sizeOut')) $('sizeOut').textContent = cols + '×' + rows;
    var st = $('statusOut');
    if (st) {
      if (solved) {
        st.textContent = 'Complete — ' + moves + ' turns in ' + fmt(finished - started || 0);
        st.className = 'lat-status done';
      } else {
        var pw = power(), lit = 0;
        for (var i = 0; i < pw.length; i++) lit += pw[i];
        st.textContent = lit + ' of ' + (cols * rows) + ' tiles lit';
        st.className = 'lat-status';
      }
    }
    needsDraw = true;
  }

  /* ---------- chips + buttons ---------- */
  function buildChips() {
    var host = $('sizes');
    if (!host) return;
    host.innerHTML = '';
    SIZES.forEach(function (s, i) {
      var b = document.createElement('button');
      b.className = 'chip' + (i === sizeIdx ? ' on' : '');
      b.type = 'button';
      b.textContent = s.name + ' ' + s.n + '×' + s.n;
      b.addEventListener('click', function () {
        sizeIdx = i;
        cols = rows = s.n;
        Array.prototype.forEach.call(host.children, function (c, j) {
          c.className = 'chip' + (j === i ? ' on' : '');
        });
        resize();
        generate(isToday ? seedForToday() : (Math.random() * 4294967295) >>> 0);
      });
      host.appendChild(b);
    });
  }

  function wire(id, fn) {
    var b = $(id);
    if (b) b.addEventListener('click', fn);
  }

  wire('btnNew', function () {
    isToday = false;
    generate((Math.random() * 4294967295) >>> 0);
  });
  wire('btnToday', function () {
    isToday = true;
    generate(seedForToday());
  });
  wire('btnReset', function () { generate(seed); });
  wire('btnHint', function () {
    if (solved) return;
    var wrong = [];
    for (var i = 0; i < mask.length; i++) {
      if (eff(i) !== mask[i]) wrong.push(i);
    }
    if (!wrong.length) return;
    var pick = wrong[(Math.random() * wrong.length) | 0];
    if (!started) started = Date.now();
    anim[pick] = rot[pick] * Math.PI / 2;
    rot[pick] = 0;
    hints += 3;
    needsDraw = true;
    if (checkSolved()) { solved = true; finished = Date.now(); }
    updateReadout();
  });

  window.addEventListener('resize', function () { resize(); needsDraw = true; });

  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'n' || e.key === 'N') { isToday = false; generate((Math.random() * 4294967295) >>> 0); }
    if (e.key === 'r' || e.key === 'R') generate(seed);
  });

  /* ---------- go ---------- */
  buildChips();
  resize();
  generate(seedForToday());
  requestAnimationFrame(frame);
})();
