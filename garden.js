/* experiment.quibo.games — The Garden
   Gray-Scott reaction-diffusion, painted by hand. No dependencies. */
(function () {
  'use strict';

  /* ---------- grid ---------- */
  var GW = 220, GH = 140, N = GW * GH;
  var A = new Float32Array(N), B = new Float32Array(N);
  var A2 = new Float32Array(N), B2 = new Float32Array(N);

  var dA = 1.0, dB = 0.5;
  var feed = 0.0545, kill = 0.062;
  var speed = 8;
  var running = false, raf = null;

  /* ---------- recipes ---------- */
  var RECIPES = [
    { name: 'Coral',    f: 0.0545, k: 0.0620 },
    { name: 'Mitosis',  f: 0.0367, k: 0.0649 },
    { name: 'Worms',    f: 0.0580, k: 0.0650 },
    { name: 'Solitons', f: 0.0300, k: 0.0620 },
    { name: 'Waves',    f: 0.0140, k: 0.0450 },
    { name: 'Maze',     f: 0.0290, k: 0.0570 },
    { name: 'U-Skate',  f: 0.0620, k: 0.0609 }
  ];

  /* ---------- palettes ---------- */
  var PALETTES = [
    { name: 'Aurora',      cols: ['#07090d', '#0f3b3a', '#64f0c8', '#dffff4'] },
    { name: 'Ember',       cols: ['#0d0705', '#5c1f12', '#ff8a5b', '#ffe9c9'] },
    { name: 'Ultraviolet', cols: ['#08060f', '#33206b', '#b388ff', '#f3e8ff'] },
    { name: 'Deepwater',   cols: ['#04090f', '#123c5c', '#59d2fe', '#e8fbff'] },
    { name: 'Moss',        cols: ['#060b07', '#1f4a33', '#8fd694', '#f0fff2'] }
  ];
  var palette = PALETTES[0];
  var LUT = new Uint8Array(256 * 3);

  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }

  function buildLUT() {
    var stops = palette.cols.map(hex);
    var segs = stops.length - 1;
    for (var i = 0; i < 256; i++) {
      var t = i / 255 * segs;
      var s = Math.min(segs - 1, Math.floor(t));
      var u = t - s;
      for (var c = 0; c < 3; c++) {
        LUT[i * 3 + c] = stops[s][c] + (stops[s + 1][c] - stops[s][c]) * u;
      }
    }
  }

  /* ---------- seeded PRNG ---------- */
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

  /* ---------- canvas ---------- */
  var cv = document.getElementById('garden');
  var ctx = cv.getContext('2d');
  var off = document.createElement('canvas');
  off.width = GW; off.height = GH;
  var octx = off.getContext('2d');
  var img = octx.createImageData(GW, GH);
  var pix = img.data;
  for (var q = 0; q < N; q++) pix[q * 4 + 3] = 255;

  /* ---------- seeding ---------- */
  function clear() {
    A.fill(1); B.fill(0);
    draw();
  }

  function blot(cx, cy, r, amount) {
    var r2 = r * r;
    for (var y = -r; y <= r; y++) {
      for (var x = -r; x <= r; x++) {
        if (x * x + y * y > r2) continue;
        var gx = ((cx + x) % GW + GW) % GW;
        var gy = ((cy + y) % GH + GH) % GH;
        var i = gy * GW + gx;
        B[i] = Math.min(1, B[i] + amount);
        A[i] = Math.max(0, A[i] - amount * 0.5);
      }
    }
  }

  function seedGarden(seed) {
    var rand = rng(seed);
    A.fill(1); B.fill(0);
    var blobs = 5 + Math.floor(rand() * 8);
    for (var i = 0; i < blobs; i++) {
      blot(Math.floor(rand() * GW), Math.floor(rand() * GH), 3 + Math.floor(rand() * 7), 1);
    }
    draw();
  }

  /* ---------- simulation ---------- */
  function tick() {
    for (var y = 0; y < GH; y++) {
      var ym = (y === 0 ? GH - 1 : y - 1) * GW;
      var yp = (y === GH - 1 ? 0 : y + 1) * GW;
      var yc = y * GW;
      for (var x = 0; x < GW; x++) {
        var xm = x === 0 ? GW - 1 : x - 1;
        var xp = x === GW - 1 ? 0 : x + 1;
        var i = yc + x;
        var a = A[i], b = B[i];

        var lapA = -a
          + 0.2 * (A[yc + xm] + A[yc + xp] + A[ym + x] + A[yp + x])
          + 0.05 * (A[ym + xm] + A[ym + xp] + A[yp + xm] + A[yp + xp]);
        var lapB = -b
          + 0.2 * (B[yc + xm] + B[yc + xp] + B[ym + x] + B[yp + x])
          + 0.05 * (B[ym + xm] + B[ym + xp] + B[yp + xm] + B[yp + xp]);

        var abb = a * b * b;
        var na = a + dA * lapA - abb + feed * (1 - a);
        var nb = b + dB * lapB + abb - (kill + feed) * b;

        A2[i] = na < 0 ? 0 : (na > 1 ? 1 : na);
        B2[i] = nb < 0 ? 0 : (nb > 1 ? 1 : nb);
      }
    }
    var ta = A; A = A2; A2 = ta;
    var tb = B; B = B2; B2 = tb;
  }

  function draw() {
    for (var i = 0; i < N; i++) {
      var v = B[i] * 3.4;
      if (v > 1) v = 1;
      var l = (v * 255) | 0;
      var o = i * 4, m = l * 3;
      pix[o] = LUT[m];
      pix[o + 1] = LUT[m + 1];
      pix[o + 2] = LUT[m + 2];
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }

  function loop() {
    for (var s = 0; s < speed; s++) tick();
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function setRunning(on) {
    running = on;
    var btn = document.getElementById('btnPlay');
    if (btn) btn.textContent = on ? 'Pause' : 'Play';
    if (on) raf = requestAnimationFrame(loop);
    else if (raf) cancelAnimationFrame(raf);
  }

  /* ---------- painting ---------- */
  var painting = false;

  function paintAt(e) {
    var r = cv.getBoundingClientRect();
    var gx = Math.floor((e.clientX - r.left) / r.width * GW);
    var gy = Math.floor((e.clientY - r.top) / r.height * GH);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return;
    blot(gx, gy, 4, 1);
    if (!running) draw();
  }

  cv.addEventListener('pointerdown', function (e) {
    painting = true;
    cv.setPointerCapture(e.pointerId);
    paintAt(e);
  });
  cv.addEventListener('pointermove', function (e) {
    if (painting) paintAt(e);
  });
  cv.addEventListener('pointerup', function () { painting = false; });
  cv.addEventListener('pointercancel', function () { painting = false; });

  /* ---------- ui ---------- */
  function $(id) { return document.getElementById(id); }

  function readout() {
    $('fVal').textContent = feed.toFixed(4);
    $('kVal').textContent = kill.toFixed(4);
  }

  function applyRecipe(r) {
    feed = r.f; kill = r.k;
    $('feed').value = feed;
    $('kill').value = kill;
    $('recipeName').textContent = r.name;
    readout();
  }

  var recipeBar = $('recipes');
  RECIPES.forEach(function (r, i) {
    var b = document.createElement('button');
    b.className = 'chip' + (i === 0 ? ' on' : '');
    b.textContent = r.name;
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(recipeBar.children, function (c) { c.classList.remove('on'); });
      b.classList.add('on');
      applyRecipe(r);
      seedGarden((Math.random() * 4294967295) >>> 0);
      if (!running) setRunning(true);
    });
    recipeBar.appendChild(b);
  });

  var palBar = $('palettes');
  PALETTES.forEach(function (p, i) {
    var b = document.createElement('button');
    b.className = 'chip swatch' + (i === 0 ? ' on' : '');
    b.title = p.name;
    b.innerHTML = '<em style="background:' + p.cols[2] + '"></em>' + p.name;
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(palBar.children, function (c) { c.classList.remove('on'); });
      b.classList.add('on');
      palette = p;
      buildLUT();
      draw();
    });
    palBar.appendChild(b);
  });

  $('feed').addEventListener('input', function () {
    feed = parseFloat(this.value);
    $('recipeName').textContent = 'Custom';
    Array.prototype.forEach.call(recipeBar.children, function (c) { c.classList.remove('on'); });
    readout();
  });
  $('kill').addEventListener('input', function () {
    kill = parseFloat(this.value);
    $('recipeName').textContent = 'Custom';
    Array.prototype.forEach.call(recipeBar.children, function (c) { c.classList.remove('on'); });
    readout();
  });
  $('speed').addEventListener('input', function () {
    speed = parseInt(this.value, 10);
    $('speedVal').textContent = speed + '×';
  });

  $('btnPlay').addEventListener('click', function () { setRunning(!running); });
  $('btnReseed').addEventListener('click', function () {
    seedGarden((Math.random() * 4294967295) >>> 0);
    if (!running) setRunning(true);
  });
  $('btnToday').addEventListener('click', function () {
    seedGarden(seedForToday());
    if (!running) setRunning(true);
  });
  $('btnClear').addEventListener('click', function () { clear(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && raf) cancelAnimationFrame(raf);
    else if (!document.hidden && running) raf = requestAnimationFrame(loop);
  });

  /* ---------- go ---------- */
  buildLUT();
  applyRecipe(RECIPES[0]);
  $('speedVal').textContent = speed + '×';
  seedGarden(seedForToday());

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    for (var w = 0; w < 400; w++) tick();
    draw();
    setRunning(false);
  } else {
    setRunning(true);
  }
})();
