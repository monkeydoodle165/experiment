/* experiment.quibo.games — The Codex
   A writing system, a small language and an inscription slab, all dealt by
   today's date. Self-contained: no dependencies, no assets, nothing stored. */
(function () {
  'use strict';

  /* ---------- seeded PRNG (mulberry32), matching the rest of the site ---------- */
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

  function hashStr(str, salt) {
    var h = ((salt >>> 0) ^ 0x811c9dc5) >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function seedForToday() {
    var d = new Date();
    var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  function sample(r, arr, n) {
    var pool = arr.slice(), out = [];
    n = Math.min(n, pool.length);
    for (var i = 0; i < n; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- sound pools ---------- */
  var CONS = ['p','t','k','b','d','g','m','n','ng','s','sh','z','h','l','r',
              'w','y','th','f','v','ch','j','kh','ts'];
  var VOWS = ['a','e','i','o','u','ai','au','ei','ou','ia','uo','ae'];

  var GLOSSES = ['water','stone','sky','fire','night','road','hand','bird',
                 'river','mountain','house','name','song','friend','memory',
                 'morning','rain','salt','door','shadow','wind','city',
                 'question','edge'];

  var INKS = [
    { name: 'Aurora', col: '#64f0c8' },
    { name: 'Iron',   col: '#dfe6f2' },
    { name: 'Ochre',  col: '#ffc860' },
    { name: 'Violet', col: '#b388ff' }
  ];

  var HANDS = [
    { name: 'Carved',  weight: 0.85, cap: 'butt',  wobble: 0.15 },
    { name: 'Inked',   weight: 1.10, cap: 'round', wobble: 0.45 },
    { name: 'Brushed', weight: 1.75, cap: 'round', wobble: 0.95 }
  ];

  /* ---------- the 3x4 stroke lattice every glyph is grown on ---------- */
  var NODE = [];
  for (var gy = 0; gy < 4; gy++) {
    for (var gx = 0; gx < 3; gx++) NODE.push([gx / 2, gy / 3]);
  }

  /* ---------- state ---------- */
  var L = null;        // language + script
  var coinCache = {};
  var ink = INKS[0];
  var hand = HANDS[1];
  var size = 34;

  function $(id) { return document.getElementById(id); }

  /* ---------- build the language ---------- */
  function buildLanguage(seed) {
    var r = rng(seed);
    var cons = sample(r, CONS, 10 + Math.floor(r() * 8));
    var vows = sample(r, VOWS, 5 + Math.floor(r() * 3));
    var codas = sample(r, cons, Math.floor(r() * Math.min(5, cons.length)));
    var lang = {
      seed: seed,
      cons: cons,
      vows: vows,
      codas: codas,
      onsetOptional: r() < 0.42,
      order: pick(r, ['subject – object – verb',
                      'subject – verb – object',
                      'verb – subject – object',
                      'object – verb – subject']),
      pluralMode: pick(r, ['suffix', 'prefix', 'reduplication']),
      pluralAffix: [pick(r, vows), pick(r, cons)]
    };

    /* the script itself */
    var sr = rng((seed ^ 0x5bf03635) >>> 0);
    lang.script = {
      curviness: 0.15 + sr() * 0.95,
      slant: (sr() - 0.5) * 0.36,
      ticks: sr() < 0.42,
      spine: pick(sr, [null, null, 'left', 'top', 'base']),
      weight: 0.085 + sr() * 0.055,
      rtl: sr() < 0.34,
      abugida: sr() < 0.45
    };

    lang.glyphs = {};
    cons.concat(vows).forEach(function (p) {
      lang.glyphs[p] = makeGlyph(rng(hashStr('glyph:' + p, seed)), lang.script);
    });

    L = lang;
    coinCache = {};
    lang.name = cap(coin('the tongue itself').roman);
    lang.scriptName = cap(coin('the marks themselves').roman);
    return lang;
  }

  function makeGlyph(r, S) {
    var used = [Math.floor(r() * 12)];
    var strokes = [];
    var count = 2 + (r() < 0.55 ? 1 : 0) + (r() < 0.18 ? 1 : 0);
    for (var i = 0; i < count; i++) {
      var a = used[Math.floor(r() * used.length)];
      var b = a;
      for (var t = 0; t < 12 && b === a; t++) b = Math.floor(r() * 12);
      if (b === a) b = (a + 5) % 12;
      strokes.push({
        a: a, b: b,
        bend: (r() * 2 - 1) * S.curviness,
        jx: r() * 2 - 1, jy: r() * 2 - 1
      });
      if (used.indexOf(b) < 0) used.push(b);
    }
    if (r() < 0.3) {
      strokes.push({ dot: used[Math.floor(r() * used.length)], jx: r() * 2 - 1, jy: r() * 2 - 1 });
    }
    return { strokes: strokes };
  }

  /* ---------- coining words ---------- */
  function coin(word) {
    var key = String(word).toLowerCase();
    if (coinCache[key]) return coinCache[key];
    var r = rng(hashStr('word:' + key, L.seed));
    var syl = 1 + (key.length > 3 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
    var ph = [];
    for (var i = 0; i < syl; i++) {
      if (!(L.onsetOptional && i === 0 && r() < 0.32)) ph.push(pick(r, L.cons));
      ph.push(pick(r, L.vows));
      if (L.codas.length && r() < (i === syl - 1 ? 0.42 : 0.22)) ph.push(pick(r, L.codas));
    }
    var o = { ph: ph, roman: ph.join('') };
    coinCache[key] = o;
    return o;
  }

  function pluralise(o) {
    var ph;
    if (L.pluralMode === 'suffix') ph = o.ph.concat(L.pluralAffix);
    else if (L.pluralMode === 'prefix') ph = L.pluralAffix.concat(o.ph);
    else ph = o.ph.slice(0, Math.min(2, o.ph.length)).concat(o.ph);
    return { ph: ph, roman: ph.join('') };
  }

  function wordFor(english) {
    var w = english.toLowerCase().replace(/[^a-z']/g, '');
    if (!w) return null;
    if (w.length > 3 && w.charAt(w.length - 1) === 's' && w.charAt(w.length - 2) !== 's') {
      return pluralise(coin(w.slice(0, -1)));
    }
    return coin(w);
  }

  /* ---------- translation ---------- */
  function translate(text) {
    var toks = [];
    var re = /[A-Za-z']+|[.!?]|[,;:]/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var s = m[0];
      if (/[A-Za-z]/.test(s)) {
        var w = wordFor(s);
        if (w) toks.push({ type: 'word', ph: w.ph, roman: w.roman });
      } else if (s === ',' || s === ';' || s === ':') {
        toks.push({ type: 'mark', kind: 'pause' });
      } else {
        toks.push({ type: 'mark', kind: 'stop' });
      }
    }
    return toks;
  }

  function romanise(toks) {
    var out = '';
    toks.forEach(function (t) {
      if (t.type === 'word') out += (out && !/[·‖]$/.test(out.trim()) ? ' ' : (out ? ' ' : '')) + t.roman;
      else out += (t.kind === 'pause' ? ' ·' : ' ‖');
    });
    return out.trim();
  }

  /* ---------- clusters ---------- */
  function isVowel(p) { return L.vows.indexOf(p) >= 0; }

  function clusters(ph) {
    var out = [];
    if (!L.script.abugida) {
      for (var i = 0; i < ph.length; i++) out.push({ base: ph[i], mark: null });
      return out;
    }
    for (var j = 0; j < ph.length; j++) {
      if (!isVowel(ph[j]) && j + 1 < ph.length && isVowel(ph[j + 1])) {
        out.push({ base: ph[j], mark: ph[j + 1] });
        j++;
      } else {
        out.push({ base: ph[j], mark: null });
      }
    }
    return out;
  }

  /* ---------- drawing ---------- */
  function setupCanvas(cv, cssW, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.floor(cssW * dpr));
    cv.height = Math.max(1, Math.floor(cssH * dpr));
    cv.style.height = cssH + 'px';
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cssW, cssH);
    return c;
  }

  function drawGlyph(ctx, g, x, y, sz) {
    if (!g) return;
    var S = L.script;
    var w = sz * 0.62, h = sz;
    var jitter = hand.wobble * sz * 0.045;

    function P(idx, jx, jy) {
      var n = NODE[idx];
      return [
        x + n[0] * w + (1 - n[1]) * S.slant * h + (jx || 0) * jitter,
        y + n[1] * h + (jy || 0) * jitter
      ];
    }

    ctx.strokeStyle = ink.col;
    ctx.fillStyle = ink.col;
    ctx.lineWidth = Math.max(0.8, sz * S.weight * hand.weight);
    ctx.lineCap = hand.cap;
    ctx.lineJoin = 'round';

    if (S.spine) {
      var pair = S.spine === 'left' ? [0, 9] : (S.spine === 'top' ? [0, 2] : [9, 11]);
      var A0 = P(pair[0]), B0 = P(pair[1]);
      ctx.beginPath();
      ctx.moveTo(A0[0], A0[1]);
      ctx.lineTo(B0[0], B0[1]);
      ctx.stroke();
    }

    g.strokes.forEach(function (s) {
      if (s.dot !== undefined) {
        var D = P(s.dot, s.jx, s.jy);
        ctx.beginPath();
        ctx.arc(D[0], D[1], Math.max(1, sz * 0.055), 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      var A = P(s.a, s.jx, s.jy), B = P(s.b, -s.jx, -s.jy);
      var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      var dx = B[0] - A[0], dy = B[1] - A[1];
      var cx = mx - dy * s.bend * 0.4, cy = my + dx * s.bend * 0.4;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo(cx, cy, B[0], B[1]);
      ctx.stroke();
      if (S.ticks) {
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var tx = -dy / len * sz * 0.09, ty = dx / len * sz * 0.09;
        ctx.beginPath();
        ctx.moveTo(B[0] - tx / 2, B[1] - ty / 2);
        ctx.lineTo(B[0] + tx / 2, B[1] + ty / 2);
        ctx.stroke();
      }
    });
  }

  function clusterAdvance(sz) { return sz * 0.62 + sz * 0.2; }

  function measureWord(cl, sz) {
    if (!cl.length) return 0;
    return cl.length * clusterAdvance(sz) - sz * 0.2;
  }

  function drawWord(ctx, cl, x, yTop, sz) {
    var list = L.script.rtl ? cl.slice().reverse() : cl;
    var cx = x;
    list.forEach(function (c) {
      drawGlyph(ctx, L.glyphs[c.base], cx, yTop, sz);
      if (c.mark) drawGlyph(ctx, L.glyphs[c.mark], cx + sz * 0.16, yTop - sz * 0.58, sz * 0.46);
      cx += clusterAdvance(sz);
    });
    return measureWord(cl, sz);
  }

  function drawMark(ctx, kind, x, yTop, sz) {
    ctx.strokeStyle = ink.col;
    ctx.fillStyle = ink.col;
    ctx.lineWidth = Math.max(0.8, sz * L.script.weight * hand.weight);
    ctx.lineCap = hand.cap;
    if (kind === 'pause') {
      ctx.beginPath();
      ctx.arc(x + sz * 0.12, yTop + sz * 0.86, Math.max(1, sz * 0.06), 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (var i = 0; i < 2; i++) {
        var px = x + sz * (0.08 + i * 0.16);
        ctx.beginPath();
        ctx.moveTo(px, yTop + sz * 0.12);
        ctx.lineTo(px, yTop + sz * 0.96);
        ctx.stroke();
      }
    }
    return sz * (kind === 'pause' ? 0.24 : 0.34);
  }

  /* ---------- the slab ---------- */
  function renderSlab() {
    var cv = $('slab');
    if (!cv) return;
    var cssW = cv.clientWidth || 600;
    var toks = translate($('src').value || '');
    var sz = size;
    var pad = 30;
    var gap = sz * 0.5;
    var maxW = cssW - pad * 2;

    /* measure into lines */
    var lines = [], line = [], lw = 0;
    toks.forEach(function (t) {
      var item;
      if (t.type === 'word') {
        var cl = clusters(t.ph);
        item = { cl: cl, w: measureWord(cl, sz) };
      } else {
        item = { mark: t.kind, w: sz * (t.kind === 'pause' ? 0.24 : 0.34) };
      }
      var add = item.w + (line.length ? gap : 0);
      if (line.length && lw + add > maxW) {
        lines.push({ items: line, w: lw });
        line = []; lw = 0; add = item.w;
      }
      line.push(item);
      lw += add;
    });
    if (line.length) lines.push({ items: line, w: lw });
    if (!lines.length) lines.push({ items: [], w: 0 });

    var lineH = sz * 2.05;
    var cssH = Math.max(140, pad * 2 + lines.length * lineH);
    var ctx = setupCanvas(cv, cssW, cssH);

    lines.forEach(function (ln, i) {
      var yTop = pad + sz * 0.7 + i * lineH;
      var x = L.script.rtl ? cssW - pad - ln.w : pad;
      ln.items.forEach(function (it) {
        if (it.mark) drawMark(ctx, it.mark, x, yTop, sz);
        else drawWord(ctx, it.cl, x, yTop, sz);
        x += it.w + gap;
      });
    });

    var ro = $('romanOut');
    if (ro) ro.textContent = romanise(toks) || '—';
  }

  /* ---------- alphabet chart ---------- */
  function renderChart() {
    var cv = $('chart');
    if (!cv) return;
    var cssW = cv.clientWidth || 600;
    var list = L.cons.concat(L.vows);
    var cell = 78, sz = 34;
    var cols = Math.max(4, Math.floor(cssW / cell));
    var rows = Math.ceil(list.length / cols);
    var cw = cssW / cols;
    var rowH = 92;
    var ctx = setupCanvas(cv, cssW, rows * rowH + 12);

    list.forEach(function (p, i) {
      var r = Math.floor(i / cols), c = i % cols;
      var x = c * cw + (cw - sz * 0.62) / 2;
      var y = r * rowH + 16;
      drawGlyph(ctx, L.glyphs[p], x, y, sz);
      ctx.fillStyle = isVowel(p) ? '#7aa2ff' : '#8b97ab';
      ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p, c * cw + cw / 2, r * rowH + 16 + sz + 22);
      ctx.textAlign = 'left';
    });
  }

  /* ---------- lexicon ---------- */
  function renderLexicon() {
    var host = $('lex');
    if (!host) return;
    host.innerHTML = '';
    var cells = [];
    GLOSSES.forEach(function (gl) {
      var w = coin(gl);
      var cell = document.createElement('div');
      cell.className = 'lex-cell';
      var cv = document.createElement('canvas');
      cv.className = 'lex-canvas';
      cv.setAttribute('aria-hidden', 'true');
      cell.appendChild(cv);
      var meta = document.createElement('div');
      meta.className = 'lex-meta';
      var b = document.createElement('b');
      b.textContent = w.roman;
      var sp = document.createElement('span');
      sp.textContent = gl;
      meta.appendChild(b);
      meta.appendChild(sp);
      cell.appendChild(meta);
      host.appendChild(cell);
      cells.push({ cv: cv, ph: w.ph });
    });
    cells.forEach(function (c) {
      var ctx = setupCanvas(c.cv, c.cv.clientWidth || 180, 58);
      drawWord(ctx, clusters(c.ph), 4, 18, 24);
    });
  }

  /* ---------- readouts ---------- */
  function renderFacts() {
    var S = L.script;
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('nameOut', L.name);
    set('scriptOut', L.scriptName);
    set('seedOut', String(L.seed).padStart(10, '0'));
    set('soundsOut', L.cons.length + ' consonants, ' + L.vows.length + ' vowels');
    set('typeOut', S.abugida ? 'abugida — vowels ride above their consonant'
                             : 'alphabet — every sound gets its own glyph');
    set('dirOut', S.rtl ? 'right to left' : 'left to right');
    set('orderOut', L.order);
    set('shapeOut', (S.curviness < 0.45 ? 'angular' : (S.curviness < 0.8 ? 'half-curved' : 'rounded'))
      + (S.ticks ? ', with serifs' : ', unserifed')
      + (S.spine ? ', hung on a ' + (S.spine === 'left' ? 'left stem' : (S.spine === 'top' ? 'headline' : 'baseline')) : ', free-standing'));
    var plural = L.pluralMode === 'reduplication'
      ? 'reduplication — the first syllable is said twice'
      : L.pluralMode + ' –' + L.pluralAffix.join('') + '–';
    set('pluralOut', plural);
    var syl = (L.onsetOptional ? '(C)V' : 'CV') + (L.codas.length ? '(C)' : '');
    set('sylOut', syl + (L.codas.length ? ', codas from ' + L.codas.join(' ') : ', no closed syllables'));
  }

  function renderAll() {
    renderFacts();
    renderChart();
    renderSlab();
    renderLexicon();
  }

  /* ---------- controls ---------- */
  function buildChips(hostId, items, current, onPick, swatch) {
    var host = $(hostId);
    if (!host) return;
    host.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'chip' + (swatch ? ' swatch' : '') + (it === current ? ' on' : '');
      if (swatch) {
        var em = document.createElement('em');
        em.style.background = it.col;
        b.appendChild(em);
      }
      b.appendChild(document.createTextNode(it.name));
      b.addEventListener('click', function () {
        onPick(it);
        Array.prototype.forEach.call(host.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        renderAll();
      });
      host.appendChild(b);
    });
  }

  function wire(id, ev, fn) {
    var e = $(id);
    if (e) e.addEventListener(ev, fn);
  }

  function go(seed) {
    buildLanguage(seed >>> 0);
    renderAll();
  }

  buildChips('inks', INKS, ink, function (v) { ink = v; }, true);
  buildChips('hands', HANDS, hand, function (v) { hand = v; }, false);

  wire('src', 'input', renderSlab);
  wire('btnNew', 'click', function () { go((Math.random() * 4294967295) >>> 0); });
  wire('btnToday', 'click', function () { go(seedForToday()); });
  wire('btnRoman', 'click', function () {
    var t = $('romanOut');
    if (!t || !navigator.clipboard) return;
    navigator.clipboard.writeText(t.textContent).then(function () {
      var b = $('btnRoman');
      var old = b.textContent;
      b.textContent = 'Copied';
      setTimeout(function () { b.textContent = old; }, 1400);
    }, function () {});
  });

  var sizeEl = $('sizeRange');
  if (sizeEl) {
    sizeEl.addEventListener('input', function () {
      size = parseInt(sizeEl.value, 10) || 34;
      var o = $('sizeOut');
      if (o) o.textContent = size + 'px';
      renderSlab();
    });
  }

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(renderAll, 140);
  });

  go(seedForToday());
})();
