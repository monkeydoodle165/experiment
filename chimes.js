/* The Chimes — a seeded, playable music box.
   Web Audio + canvas. No dependencies, no build step. */
(function () {
  'use strict';

  var STEPS = 16;
  var ROWS = 7;

  /* ---------- seeded randomness (same trick as the flow field) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function todaySeed() {
    var d = new Date();
    return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0;
  }

  /* Euclidean-ish rhythm: k hits spread as evenly as possible over n steps. */
  function euclid(k, n, rot) {
    var out = new Array(n);
    for (var i = 0; i < n; i++) {
      var j = (i + rot) % n;
      out[i] = ((j * k) % n) < k;
    }
    return out;
  }

  /* ---------- musical material ---------- */
  var SCALES = [
    { name: 'Pentatonic', steps: [0, 3, 5, 7, 10, 12, 15] },
    { name: 'Hirajoshi', steps: [0, 2, 3, 7, 8, 12, 14] },
    { name: 'Kumoi', steps: [0, 2, 3, 7, 9, 12, 14] },
    { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
    { name: 'Overtone', steps: [0, 4, 7, 10, 12, 14, 16] }
  ];

  var VOICES = ['Bell', 'Pluck', 'Glass', 'Reed'];

  var ROOT_HZ = 174.61; // F3, low enough to stay warm

  function freqOf(semi) { return ROOT_HZ * Math.pow(2, semi / 12); }

  /* ---------- state ---------- */
  var state = {
    seed: todaySeed(),
    grid: [],
    scale: 0,
    voice: 0,
    bpm: 96,
    volume: 0.55,
    playing: false,
    step: 0
  };

  var flash = [];       // per-cell brightness decay, ROWS*STEPS
  for (var i = 0; i < ROWS * STEPS; i++) flash.push(0);

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var s = 0; s < STEPS; s++) row.push(false);
      g.push(row);
    }
    return g;
  }

  function seedGrid(seed) {
    var rnd = mulberry32(seed);
    var g = emptyGrid();
    for (var r = 0; r < ROWS; r++) {
      // Lower rows (bass) get sparser, steadier patterns.
      var lowness = (ROWS - 1 - r) / (ROWS - 1);
      var maxHits = Math.round(2 + lowness * 5);
      var k = Math.floor(rnd() * (maxHits + 1));
      if (rnd() < 0.15) k = 0;
      if (k === 0) continue;
      var rot = Math.floor(rnd() * STEPS);
      var pat = euclid(k, STEPS, rot);
      for (var s = 0; s < STEPS; s++) g[r][s] = pat[s];
    }
    // Guarantee at least something on the downbeat.
    var anchor = Math.floor(rnd() * ROWS);
    g[anchor][0] = true;
    state.scale = Math.floor(rnd() * SCALES.length);
    state.voice = Math.floor(rnd() * VOICES.length);
    state.bpm = 76 + Math.floor(rnd() * 60);
    return g;
  }

  state.grid = seedGrid(state.seed);

  /* ---------- audio ---------- */
  var ctx = null, master = null, wet = null;

  function initAudio() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = state.volume;
    master.connect(ctx.destination);

    // Cheap shimmer: two feedback delays, slightly detuned in time.
    wet = ctx.createGain();
    wet.gain.value = 0.34;

    var d1 = ctx.createDelay(1.5); d1.delayTime.value = 0.23;
    var d2 = ctx.createDelay(1.5); d2.delayTime.value = 0.37;
    var fb = ctx.createGain(); fb.gain.value = 0.36;
    var damp = ctx.createBiquadFilter();
    damp.type = 'lowpass'; damp.frequency.value = 2600;

    wet.connect(d1); d1.connect(d2); d2.connect(damp);
    damp.connect(fb); fb.connect(d1);
    damp.connect(master);
  }

  function env(g, t, attack, decay, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function playNote(freq, t, vel) {
    if (!ctx) return;
    var out = ctx.createGain();
    out.gain.value = 1;
    out.connect(master);
    out.connect(wet);

    var kind = VOICES[state.voice];
    var g = ctx.createGain();
    g.connect(out);

    if (kind === 'Bell') {
      var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
      var g2 = ctx.createGain(); g2.gain.value = 0.28;
      o1.connect(g); o2.connect(g2); g2.connect(g);
      env(g, t, 0.004, 2.2, 0.22 * vel);
      o1.start(t); o2.start(t); o1.stop(t + 2.4); o2.stop(t + 2.4);
    } else if (kind === 'Pluck') {
      var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(7000, freq * 9), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.2), t + 0.5);
      o.connect(lp); lp.connect(g);
      env(g, t, 0.003, 0.75, 0.30 * vel);
      o.start(t); o.stop(t + 0.9);
    } else if (kind === 'Glass') {
      var a = ctx.createOscillator(); a.type = 'sine'; a.frequency.value = freq;
      var b = ctx.createOscillator(); b.type = 'sine';
      b.frequency.value = freq * 3.01;
      var bg = ctx.createGain(); bg.gain.value = 0.12;
      var c = ctx.createOscillator(); c.type = 'sine';
      c.frequency.value = freq * 1.002;
      a.connect(g); b.connect(bg); bg.connect(g); c.connect(g);
      env(g, t, 0.05, 3.0, 0.16 * vel);
      a.start(t); b.start(t); c.start(t);
      a.stop(t + 3.2); b.stop(t + 3.2); c.stop(t + 3.2);
    } else { // Reed
      var s1 = ctx.createOscillator(); s1.type = 'sawtooth'; s1.frequency.value = freq;
      var s2 = ctx.createOscillator(); s2.type = 'sawtooth';
      s2.frequency.value = freq * 0.997;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = Math.min(4200, freq * 5); f.Q.value = 6;
      s1.connect(f); s2.connect(f); f.connect(g);
      env(g, t, 0.09, 1.1, 0.13 * vel);
      s1.start(t); s2.start(t); s1.stop(t + 1.4); s2.stop(t + 1.4);
    }
  }

  /* ---------- scheduler ---------- */
  var nextTime = 0, timer = null, lookahead = 25, aheadSec = 0.12;
  var visualQueue = [];

  function stepDur() { return 60 / state.bpm / 2; } // eighth notes

  function scheduleStep(s, t) {
    var scale = SCALES[state.scale].steps;
    for (var r = 0; r < ROWS; r++) {
      if (!state.grid[r][s]) continue;
      var degree = scale[ROWS - 1 - r];
      var vel = 0.75 + (ROWS - 1 - r) * 0.03;
      if (s % 4 === 0) vel += 0.2;
      playNote(freqOf(degree), t, vel);
      visualQueue.push({ r: r, s: s, t: t });
    }
  }

  function tick() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + aheadSec) {
      scheduleStep(state.step, nextTime);
      visualQueue.push({ r: -1, s: state.step, t: nextTime });
      nextTime += stepDur();
      state.step = (state.step + 1) % STEPS;
    }
  }

  function start() {
    initAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    state.playing = true;
    nextTime = ctx.currentTime + 0.06;
    timer = setInterval(tick, lookahead);
    els.play.textContent = 'Stop';
  }

  function stop() {
    state.playing = false;
    if (timer) clearInterval(timer);
    timer = null;
    visualQueue.length = 0;
    els.play.textContent = 'Play';
  }

  /* ---------- canvas ---------- */
  var cv = document.getElementById('chimes');
  var g2d = cv.getContext('2d');
  var W = cv.width, H = cv.height;
  var padX = 10, padY = 10;
  var cw = (W - padX * 2) / STEPS;
  var ch = (H - padY * 2) / ROWS;
  var drawStep = -1;

  function cellRect(r, s) {
    return {
      x: padX + s * cw + 3,
      y: padY + r * ch + 3,
      w: cw - 6,
      h: ch - 6
    };
  }

  function roundRect(x, y, w, h, rad) {
    g2d.beginPath();
    g2d.moveTo(x + rad, y);
    g2d.arcTo(x + w, y, x + w, y + h, rad);
    g2d.arcTo(x + w, y + h, x, y + h, rad);
    g2d.arcTo(x, y + h, x, y, rad);
    g2d.arcTo(x, y, x + w, y, rad);
    g2d.closePath();
  }

  function draw() {
    // drain the visual queue for events that have now sounded
    if (ctx) {
      var now = ctx.currentTime;
      for (var i = visualQueue.length - 1; i >= 0; i--) {
        if (visualQueue[i].t <= now) {
          var ev = visualQueue[i];
          if (ev.r < 0) drawStep = ev.s;
          else flash[ev.r * STEPS + ev.s] = 1;
          visualQueue.splice(i, 1);
        }
      }
    }

    g2d.clearRect(0, 0, W, H);

    // playhead column
    if (state.playing && drawStep >= 0) {
      g2d.fillStyle = 'rgba(100,240,200,.07)';
      g2d.fillRect(padX + drawStep * cw, 0, cw, H);
    }

    for (var r = 0; r < ROWS; r++) {
      for (var s = 0; s < STEPS; s++) {
        var rect = cellRect(r, s);
        var on = state.grid[r][s];
        var f = flash[r * STEPS + s];
        var beat = s % 4 === 0;

        roundRect(rect.x, rect.y, rect.w, rect.h, 5);
        if (on) {
          var lit = 0.30 + f * 0.7;
          var hue = 165 - (ROWS - 1 - r) * 9;
          g2d.fillStyle = 'hsla(' + hue + ',' + (62 + f * 25) + '%,' + (46 + f * 26) + '%,' + lit + ')';
          g2d.fill();
          if (f > 0.02) {
            g2d.strokeStyle = 'rgba(180,255,232,' + (f * 0.9) + ')';
            g2d.lineWidth = 1.5;
            g2d.stroke();
          }
        } else {
          g2d.fillStyle = beat ? 'rgba(255,255,255,.055)' : 'rgba(255,255,255,.028)';
          g2d.fill();
        }
        if (f > 0) flash[r * STEPS + s] = Math.max(0, f - 0.045);
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  /* ---------- interaction ---------- */
  var painting = false, paintVal = true;

  function cellAt(evt) {
    var b = cv.getBoundingClientRect();
    var x = (evt.clientX - b.left) * (W / b.width);
    var y = (evt.clientY - b.top) * (H / b.height);
    var s = Math.floor((x - padX) / cw);
    var r = Math.floor((y - padY) / ch);
    if (s < 0 || s >= STEPS || r < 0 || r >= ROWS) return null;
    return { r: r, s: s };
  }

  cv.addEventListener('pointerdown', function (e) {
    var c = cellAt(e);
    if (!c) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    paintVal = !state.grid[c.r][c.s];
    state.grid[c.r][c.s] = paintVal;
    if (paintVal) {
      flash[c.r * STEPS + c.s] = 1;
      initAudio();
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        playNote(freqOf(SCALES[state.scale].steps[ROWS - 1 - c.r]), ctx.currentTime + 0.01, 0.9);
      }
    }
    painting = true;
  });

  cv.addEventListener('pointermove', function (e) {
    if (!painting) return;
    var c = cellAt(e);
    if (!c) return;
    if (state.grid[c.r][c.s] !== paintVal) {
      state.grid[c.r][c.s] = paintVal;
      if (paintVal) flash[c.r * STEPS + c.s] = 1;
    }
  });

  function endPaint() { painting = false; }
  cv.addEventListener('pointerup', endPaint);
  cv.addEventListener('pointercancel', endPaint);
  window.addEventListener('blur', endPaint);

  /* ---------- controls ---------- */
  var els = {
    scales: document.getElementById('scales'),
    voices: document.getElementById('voices'),
    bpm: document.getElementById('bpm'),
    bpmVal: document.getElementById('bpmVal'),
    vol: document.getElementById('vol'),
    volVal: document.getElementById('volVal'),
    play: document.getElementById('btnPlay'),
    reseed: document.getElementById('btnReseed'),
    today: document.getElementById('btnToday'),
    clear: document.getElementById('btnClear'),
    seedOut: document.getElementById('seedOut'),
    nowScale: document.getElementById('nowScale')
  };

  function chip(label, on, fn) {
    var b = document.createElement('button');
    b.className = 'chip' + (on ? ' on' : '');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function renderChips() {
    els.scales.innerHTML = '';
    SCALES.forEach(function (sc, i) {
      els.scales.appendChild(chip(sc.name, i === state.scale, function () {
        state.scale = i; renderChips(); syncReadout();
      }));
    });
    els.voices.innerHTML = '';
    VOICES.forEach(function (v, i) {
      els.voices.appendChild(chip(v, i === state.voice, function () {
        state.voice = i; renderChips(); syncReadout();
      }));
    });
  }

  function syncReadout() {
    els.bpm.value = state.bpm;
    els.bpmVal.textContent = state.bpm + ' bpm';
    els.volVal.textContent = Math.round(state.volume * 100) + '%';
    els.seedOut.textContent = state.seed;
    els.nowScale.textContent = SCALES[state.scale].name + ' / ' + VOICES[state.voice];
  }

  els.bpm.addEventListener('input', function () {
    state.bpm = parseInt(els.bpm.value, 10);
    els.bpmVal.textContent = state.bpm + ' bpm';
  });

  els.vol.addEventListener('input', function () {
    state.volume = parseInt(els.vol.value, 10) / 100;
    els.volVal.textContent = Math.round(state.volume * 100) + '%';
    if (master) master.gain.value = state.volume;
  });

  els.play.addEventListener('click', function () {
    if (state.playing) stop(); else start();
  });

  function loadSeed(seed) {
    state.seed = seed >>> 0;
    state.grid = seedGrid(state.seed);
    state.step = 0;
    drawStep = -1;
    renderChips();
    syncReadout();
  }

  els.reseed.addEventListener('click', function () {
    loadSeed(Math.floor(Math.random() * 4294967295));
  });

  els.today.addEventListener('click', function () {
    loadSeed(todaySeed());
  });

  els.clear.addEventListener('click', function () {
    state.grid = emptyGrid();
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea|button/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); els.play.click(); }
  });

  renderChips();
  syncReadout();
})();
