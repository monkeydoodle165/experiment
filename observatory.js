/* experiment.quibo.games — The Observatory
   A star chart dealt by the date. Self-contained. No dependencies. */
(function () {
  'use strict';

  /* ---------- seeded PRNG (mulberry32) ---------- */
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

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  /* ---------- tables ---------- */
  var GREEK = ['α', 'β', 'γ', 'δ', 'ε',
               'ζ', 'η', 'θ', 'ι', 'κ'];

  var SPECTRA = [
    { c: 'O', col: '#9db6ff', w: 0.004, note: 'blue-white, furious, short-lived' },
    { c: 'B', col: '#b3c9ff', w: 0.030, note: 'blue-white' },
    { c: 'A', col: '#dbe6ff', w: 0.090, note: 'white' },
    { c: 'F', col: '#f6f4ef', w: 0.140, note: 'yellow-white' },
    { c: 'G', col: '#ffe6ad', w: 0.200, note: 'yellow, unremarkable, like ours' },
    { c: 'K', col: '#ffc989', w: 0.270, note: 'orange' },
    { c: 'M', col: '#ff9c72', w: 0.266, note: 'red, cool, enormous' }
  ];

  var ONSET = ['b', 'br', 'c', 'd', 'dr', 'f', 'g', 'gl', 'h', 'k', 'kr', 'l',
               'm', 'n', 'p', 'pr', 'r', 's', 'sh', 'sk', 'st', 't', 'th',
               'tr', 'v', 'z'];
  var NUCL = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'o', 'u',
              'ae', 'ai', 'au', 'ea', 'ei', 'io', 'ou', 'ya'];
  var CODA = ['', '', '', '', 'l', 'n', 'r', 's', 'th', 'll', 'rn', 'st', 'x'];

  var EPITHETS = [
    'the Ferryman', 'the Hare', 'the Broken Wheel', 'the Lantern', 'the Weaver',
    'the Long Net', 'the Quiet Sister', 'the Hound', 'the Cartwright',
    'the Ash Tree', 'the Salt Road', 'the Watchman', 'the Kite', 'the Nine Lamps',
    'the Bell', 'the Otter', 'the Empty Chair', 'the Ladder', 'the Harrow',
    'the Drowned Bell', 'the Winter Gate', 'the Scribe', 'the Lesser Anvil',
    'the Fisher', 'the Turning Stone', 'the Old Argument'
  ];

  var LEGENDS = [
    'Said to rise only over water.',
    'Farmers here plant when its third star clears the roof line.',
    'Two of its stars may be the same star seen twice, if the old charts are honest.',
    'Nobody has ever agreed where it ends.',
    'Drawn upside down for four hundred years, and nobody minded.',
    'Named after a debt that was never settled.',
    'It vanishes entirely for one week a year and no one has explained why.',
    'The faintest member is the only one anybody remembers.',
    'Sailors used it to find the coast, and occasionally the rocks.',
    'The first thing children here are taught to point at.',
    'A late addition, assembled out of leftovers.',
    'Its brightest star has been renamed eleven times.',
    'The line between its middle stars is longer than it looks.',
    'Reported missing one winter and found again the next.',
    'Half of it is only visible from the far side of the hill.',
    'Considered unlucky to count out loud.'
  ];

  var STARNOTES = [
    'A double, if you are patient and the air is still.',
    'Dims slightly every few weeks, for reasons of its own.',
    'Used as a boundary marker on three separate charts.',
    'Younger than it looks.',
    'The last star charted before the observer went home.',
    'Catalogued twice, under two different names.',
    'Sits almost exactly on the meridian at midnight.',
    'Reddens noticeably near the horizon.',
    'Once mistaken for a comet by a very tired assistant.',
    'Its light left long before any of this was here.',
    'Officially unremarkable.',
    'Bright enough to read by, given a century.',
    'Listed in the margin, in a different hand.',
    'Two observers, two magnitudes, one argument.'
  ];

  /* ---------- helpers ---------- */
  function pickSpectrum(r) {
    var u = r(), acc = 0;
    for (var i = 0; i < SPECTRA.length; i++) {
      acc += SPECTRA[i].w;
      if (u <= acc) return SPECTRA[i];
    }
    return SPECTRA[SPECTRA.length - 1];
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function word(r, syl) {
    for (var attempt = 0; attempt < 8; attempt++) {
      var out = '';
      for (var i = 0; i < syl; i++) {
        var last = (i === syl - 1);
        out += ONSET[Math.floor(r() * ONSET.length)];
        out += NUCL[Math.floor(r() * NUCL.length)];
        if (last || r() < 0.22) out += CODA[Math.floor(r() * CODA.length)];
      }
      if (out.length >= 4 && out.length <= 11) return cap(out);
    }
    return cap(out);
  }

  function toXYZ(ra, dec) {
    var cd = Math.cos(dec);
    return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
  }

  function fromXYZ(v) {
    var len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    var x = v[0] / len, y = v[1] / len, z = v[2] / len;
    var ra = Math.atan2(y, x);
    if (ra < 0) ra += TAU;
    return { ra: ra, dec: Math.asin(Math.max(-1, Math.min(1, z))) };
  }

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function angDist(a, b) {
    return Math.acos(Math.max(-1, Math.min(1, dot(a.v, b.v))));
  }

  function gauss(r) {
    var u = 1 - r(), w = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * w);
  }

  /* ---------- sky generation ---------- */
  var sky = null;

  function buildSky(seed) {
    var r = rng(seed);
    var stars = [];
    var STAR_N = 1500;
    var i;

    for (i = 0; i < STAR_N; i++) {
      var dec = Math.asin(2 * r() - 1);
      var ra = r() * TAU;
      var mag = -1.1 + 7.9 * Math.pow(r(), 0.35);
      var sp = pickSpectrum(r);
      stars.push({
        ra: ra, dec: dec, v: toXYZ(ra, dec),
        mag: mag, sp: sp,
        dist: Math.round(6 + Math.pow(r(), 2.1) * 1600),
        note: STARNOTES[Math.floor(r() * STARNOTES.length)],
        con: -1, letter: '', name: '',
        _x: 0, _y: 0, _vis: false
      });
    }

    /* a galactic band: faint dust concentrated near a random great circle */
    var poleDec = Math.asin(2 * r() - 1), poleRa = r() * TAU;
    var w3 = toXYZ(poleRa, poleDec);
    var tmp = Math.abs(w3[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    var u3 = [
      tmp[1] * w3[2] - tmp[2] * w3[1],
      tmp[2] * w3[0] - tmp[0] * w3[2],
      tmp[0] * w3[1] - tmp[1] * w3[0]
    ];
    var ul = Math.sqrt(dot(u3, u3));
    u3 = [u3[0] / ul, u3[1] / ul, u3[2] / ul];
    var v3 = [
      w3[1] * u3[2] - w3[2] * u3[1],
      w3[2] * u3[0] - w3[0] * u3[2],
      w3[0] * u3[1] - w3[1] * u3[0]
    ];

    var dust = [];
    for (i = 0; i < 2600; i++) {
      var t = r() * TAU;
      var b = gauss(r) * 7 * DEG;
      var cb = Math.cos(b), sb = Math.sin(b);
      var p = [
        cb * (Math.cos(t) * u3[0] + Math.sin(t) * v3[0]) + sb * w3[0],
        cb * (Math.cos(t) * u3[1] + Math.sin(t) * v3[1]) + sb * w3[1],
        cb * (Math.cos(t) * u3[2] + Math.sin(t) * v3[2]) + sb * w3[2]
      ];
      var rd = fromXYZ(p);
      dust.push({ ra: rd.ra, dec: rd.dec, v: p });
    }

    /* ---- constellations ---- */
    var order = stars.slice().sort(function (a, b) { return a.mag - b.mag; });
    var pool = order.slice(0, 150);
    var used = [];
    for (i = 0; i < pool.length; i++) used.push(false);

    var cons = [];
    var target = 11 + Math.floor(r() * 5);
    var radius = (14 + r() * 9) * DEG;

    for (var s = 0; s < pool.length && cons.length < target; s++) {
      if (used[s]) continue;
      var cand = [];
      for (var j = 0; j < pool.length; j++) {
        if (j === s || used[j]) continue;
        var d = angDist(pool[s], pool[j]);
        if (d < radius) cand.push({ i: j, d: d });
      }
      if (cand.length < 3) continue;
      cand.sort(function (a, b) { return a.d - b.d; });
      var want = 3 + Math.floor(r() * 6);
      var members = [pool[s]];
      var idxs = [s];
      for (var c = 0; c < cand.length && members.length < want + 1; c++) {
        members.push(pool[cand[c].i]);
        idxs.push(cand[c].i);
      }
      for (c = 0; c < idxs.length; c++) used[idxs[c]] = true;

      members.sort(function (a, b) { return a.mag - b.mag; });

      var name = word(r, 2 + (r() < 0.35 ? 1 : 0));
      var epi = EPITHETS[Math.floor(r() * EPITHETS.length)];
      var legend = LEGENDS[Math.floor(r() * LEGENDS.length)];

      var acc = [0, 0, 0];
      for (c = 0; c < members.length; c++) {
        members[c].con = cons.length;
        members[c].letter = GREEK[Math.min(c, GREEK.length - 1)];
        acc[0] += members[c].v[0];
        acc[1] += members[c].v[1];
        acc[2] += members[c].v[2];
      }
      members[0].name = word(r, 2 + (r() < 0.4 ? 1 : 0));
      if (members.length > 1 && r() < 0.55) members[1].name = word(r, 2);

      var centre = fromXYZ(acc);
      cons.push({
        name: name,
        epithet: epi,
        legend: legend,
        stars: members,
        edges: mst(members),
        ra: centre.ra,
        dec: centre.dec
      });
    }

    /* de-duplicate constellation names */
    var seen = {};
    for (i = 0; i < cons.length; i++) {
      while (seen[cons[i].name]) cons[i].name = word(r, 3);
      seen[cons[i].name] = true;
    }

    /* the headline star is the brightest one that actually carries a name */
    var lead = order[0];
    for (i = 0; i < cons.length; i++) {
      if (cons[i].stars[0].mag < lead.mag || lead.con < 0) lead = cons[i].stars[0];
    }

    return { seed: seed, stars: stars, dust: dust, cons: cons, brightest: lead };
  }

  function mst(list) {
    var n = list.length;
    var inTree = [0], rest = [], out = [], i;
    for (i = 1; i < n; i++) rest.push(i);
    while (rest.length) {
      var bd = Infinity, bi = 0, bk = 0;
      for (var a = 0; a < inTree.length; a++) {
        for (var b = 0; b < rest.length; b++) {
          var d = angDist(list[inTree[a]], list[rest[b]]);
          if (d < bd) { bd = d; bi = inTree[a]; bk = b; }
        }
      }
      out.push([bi, rest[bk]]);
      inTree.push(rest[bk]);
      rest.splice(bk, 1);
    }
    return out;
  }

  /* ---------- view ---------- */
  var view = { ra: 0, dec: 0.2, scale: 300 };
  var opts = { lines: true, labels: true, grid: false, band: true, limit: 6.0 };
  var selected = null;
  var drifting = false;

  var canvas = document.getElementById('sky');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { alpha: false });
  var W = 0, H = 0, DPR = 1, raf = null;

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || 880;
    H = canvas.clientHeight || 495;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* stereographic projection about the current view centre */
  var sinD0 = 0, cosD0 = 1;
  function refreshCentre() {
    sinD0 = Math.sin(view.dec);
    cosD0 = Math.cos(view.dec);
  }

  function project(obj, out) {
    var sd = Math.sin(obj.dec), cd = Math.cos(obj.dec);
    var dra = obj.ra - view.ra;
    var cosdra = Math.cos(dra);
    var cosc = sinD0 * sd + cosD0 * cd * cosdra;
    if (cosc < -0.35) return false;
    var k = 2 / (1 + cosc);
    out.x = W / 2 + k * cd * Math.sin(dra) * view.scale;
    out.y = H / 2 - k * (cosD0 * sd - sinD0 * cd * cosdra) * view.scale;
    return true;
  }

  var P = { x: 0, y: 0 };

  /* ---------- render ---------- */
  function draw() {
    var i, st;
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, W, H);

    /* soft vignette wash */
    var g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(20,32,54,0.55)');
    g.addColorStop(1, 'rgba(4,6,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (opts.grid) drawGrid();

    if (opts.band) {
      ctx.fillStyle = 'rgba(190,208,255,0.13)';
      for (i = 0; i < sky.dust.length; i++) {
        if (!project(sky.dust[i], P)) continue;
        if (P.x < -4 || P.x > W + 4 || P.y < -4 || P.y > H + 4) continue;
        ctx.fillRect(P.x, P.y, 1.1, 1.1);
      }
    }

    /* project every star once */
    for (i = 0; i < sky.stars.length; i++) {
      st = sky.stars[i];
      st._vis = false;
      if (st.mag > opts.limit) continue;
      if (!project(st, P)) continue;
      if (P.x < -80 || P.x > W + 80 || P.y < -80 || P.y > H + 80) continue;
      st._x = P.x; st._y = P.y; st._vis = true;
    }

    if (opts.lines) drawLines();
    drawStars();
    if (opts.labels) drawLabels();
    drawSelection();
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(122,162,255,0.13)';
    ctx.lineWidth = 1;
    var a, d, started, ok;
    for (a = 0; a < 360; a += 30) {
      ctx.beginPath(); started = false;
      for (d = -84; d <= 84; d += 4) {
        ok = project({ ra: a * DEG, dec: d * DEG }, P);
        if (!ok) { started = false; continue; }
        if (!started) { ctx.moveTo(P.x, P.y); started = true; }
        else ctx.lineTo(P.x, P.y);
      }
      ctx.stroke();
    }
    for (d = -60; d <= 60; d += 30) {
      ctx.beginPath(); started = false;
      for (a = 0; a <= 360; a += 4) {
        ok = project({ ra: a * DEG, dec: d * DEG }, P);
        if (!ok) { started = false; continue; }
        if (!started) { ctx.moveTo(P.x, P.y); started = true; }
        else ctx.lineTo(P.x, P.y);
      }
      ctx.stroke();
    }
  }

  function drawLines() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(100,240,200,0.32)';
    for (var c = 0; c < sky.cons.length; c++) {
      var con = sky.cons[c];
      ctx.beginPath();
      var any = false;
      for (var e = 0; e < con.edges.length; e++) {
        var a = con.stars[con.edges[e][0]], b = con.stars[con.edges[e][1]];
        if (!a._vis || !b._vis) continue;
        var dx = a._x - b._x, dy = a._y - b._y;
        if (dx * dx + dy * dy > 900000) continue;
        ctx.moveTo(a._x, a._y);
        ctx.lineTo(b._x, b._y);
        any = true;
      }
      if (any) ctx.stroke();
    }
  }

  function drawStars() {
    for (var i = 0; i < sky.stars.length; i++) {
      var st = sky.stars[i];
      if (!st._vis) continue;
      var m = st.mag;
      var rr = Math.max(0.55, (6.9 - m) * 0.5);
      if (m < 1.8) {
        var halo = ctx.createRadialGradient(st._x, st._y, 0, st._x, st._y, rr * 6);
        halo.addColorStop(0, 'rgba(255,255,255,0.30)');
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(st._x, st._y, rr * 6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = st.sp.col;
      ctx.beginPath();
      ctx.arc(st._x, st._y, rr, 0, TAU);
      ctx.fill();
    }
  }

  function drawLabels() {
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(122,162,255,0.78)';
    for (var c = 0; c < sky.cons.length; c++) {
      var con = sky.cons[c];
      if (!project(con, P)) continue;
      if (P.x < 40 || P.x > W - 40 || P.y < 16 || P.y > H - 16) continue;
      ctx.textAlign = 'center';
      ctx.fillText(con.name.toUpperCase(), P.x, P.y);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(232,237,245,0.72)';
    for (var i = 0; i < sky.stars.length; i++) {
      var st = sky.stars[i];
      if (!st._vis || !st.name || st.mag > 3.2) continue;
      ctx.fillText(st.name, st._x + 8, st._y);
    }
  }

  function drawSelection() {
    if (!selected || !selected._vis) return;
    ctx.strokeStyle = '#64f0c8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(selected._x, selected._y, 11, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(selected._x - 17, selected._y);
    ctx.lineTo(selected._x - 12, selected._y);
    ctx.moveTo(selected._x + 12, selected._y);
    ctx.lineTo(selected._x + 17, selected._y);
    ctx.stroke();
  }

  /* ---------- loop ---------- */
  function frame() {
    if (drifting) {
      view.ra = (view.ra + 0.00009) % TAU;
      refreshCentre();
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- readouts ---------- */
  function $(id) { return document.getElementById(id); }

  function raText(ra) {
    var h = (ra / TAU) * 24;
    var hh = Math.floor(h);
    var mm = Math.floor((h - hh) * 60);
    return hh + 'h ' + (mm < 10 ? '0' : '') + mm + 'm';
  }

  function decText(dec) {
    var d = dec / DEG;
    return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '°';
  }

  function designation(st) {
    if (st.con < 0) return 'Unlisted';
    return st.letter + ' ' + sky.cons[st.con].name;
  }

  function updateReadout() {
    var vis = 0;
    for (var i = 0; i < sky.stars.length; i++) {
      if (sky.stars[i].mag <= opts.limit) vis++;
    }
    if ($('obsSeed')) $('obsSeed').textContent = String(sky.seed).padStart(10, '0');
    if ($('obsStars')) $('obsStars').textContent = vis;
    if ($('obsCons')) $('obsCons').textContent = sky.cons.length;
    if ($('obsCentre')) {
      $('obsCentre').textContent = raText(view.ra) + ' ' + decText(view.dec);
    }
    if ($('obsBright')) {
      var b = sky.brightest;
      $('obsBright').textContent = (b.name || designation(b)) +
        ' (' + b.mag.toFixed(2) + ')';
    }
  }

  function showStar(st) {
    var card = $('starCard');
    if (!card) return;
    if (!st) {
      card.innerHTML = '<p class="empty">Nothing selected. Click a star.</p>';
      return;
    }
    var con = st.con >= 0 ? sky.cons[st.con] : null;
    var html = '';
    html += '<h4>' + esc(st.name || designation(st)) + '</h4>';
    html += '<p class="desig">' + esc(designation(st));
    if (con) html += ' · ' + esc(con.name + ' ' + con.epithet);
    html += '</p>';
    html += '<dl class="kv tight">';
    html += row('Magnitude', st.mag.toFixed(2));
    html += row('Class', st.sp.c);
    html += row('Distance', st.dist + ' ly');
    html += row('Right asc.', raText(st.ra));
    html += row('Declination', decText(st.dec));
    html += '</dl>';
    html += '<p class="starnote">' + esc(st.sp.note) + '. ' + esc(st.note) + '</p>';
    if (con) html += '<p class="starnote dimmer">' + esc(con.legend) + '</p>';
    card.innerHTML = html;
  }

  function row(k, v) {
    return '<div><dt>' + k + '</dt><dd>' + esc(String(v)) + '</dd></div>';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildConList() {
    var box = $('conList');
    if (!box) return;
    box.innerHTML = '';
    sky.cons.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    }).forEach(function (con) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = con.name + ' · ' + con.stars.length;
      b.title = con.name + ' ' + con.epithet + ' — ' + con.legend;
      b.addEventListener('click', function () {
        view.ra = con.ra;
        view.dec = Math.max(-1.4, Math.min(1.4, con.dec));
        refreshCentre();
        selected = con.stars[0];
        showStar(selected);
        updateReadout();
      });
      box.appendChild(b);
    });
  }

  /* ---------- interaction ---------- */
  var dragging = false, moved = 0, lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; moved = 0;
    lastX = e.clientX; lastY = e.clientY;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    var k = 1 / Math.max(60, view.scale);
    view.ra -= dx * k / Math.max(0.25, Math.cos(view.dec));
    view.dec += dy * k;
    view.dec = Math.max(-1.45, Math.min(1.45, view.dec));
    view.ra = (view.ra % TAU + TAU) % TAU;
    refreshCentre();
    updateReadout();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) pick(e);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', function () { dragging = false; });

  function pick(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var best = null, bd = 18 * 18;
    for (var i = 0; i < sky.stars.length; i++) {
      var st = sky.stars[i];
      if (!st._vis) continue;
      var dx = st._x - mx, dy = st._y - my;
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = st; }
    }
    selected = best;
    showStar(best);
  }

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var f = e.deltaY > 0 ? 0.88 : 1.14;
    setZoom(view.scale * f);
  }, { passive: false });

  function setZoom(z) {
    view.scale = Math.max(110, Math.min(1400, z));
    var sl = $('zoom');
    if (sl) sl.value = Math.round(view.scale);
    var out = $('zoomVal');
    if (out) out.textContent = Math.round(view.scale);
  }

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    var step = 0.09;
    if (e.key === 'ArrowLeft') { view.ra -= step; }
    else if (e.key === 'ArrowRight') { view.ra += step; }
    else if (e.key === 'ArrowUp') { view.dec = Math.min(1.45, view.dec + step); }
    else if (e.key === 'ArrowDown') { view.dec = Math.max(-1.45, view.dec - step); }
    else if (e.key === '+' || e.key === '=') { setZoom(view.scale * 1.14); return; }
    else if (e.key === '-' || e.key === '_') { setZoom(view.scale * 0.88); return; }
    else return;
    e.preventDefault();
    view.ra = (view.ra % TAU + TAU) % TAU;
    refreshCentre();
    updateReadout();
  });

  /* ---------- controls ---------- */
  function toggleChip(id, key, label) {
    var box = $('skyToggles');
    if (!box) return;
    var b = document.createElement('button');
    b.className = 'chip' + (opts[key] ? ' on' : '');
    b.type = 'button';
    b.id = id;
    b.textContent = label;
    b.addEventListener('click', function () {
      opts[key] = !opts[key];
      b.classList.toggle('on', opts[key]);
    });
    box.appendChild(b);
  }

  function wire(id, fn) {
    var b = $(id);
    if (b) b.addEventListener('click', fn);
  }

  function load(seed, keepView) {
    sky = buildSky(seed >>> 0);
    selected = null;
    if (!keepView) {
      var c = sky.cons[0];
      view.ra = c ? c.ra : 0;
      view.dec = c ? Math.max(-1.2, Math.min(1.2, c.dec)) : 0.2;
      refreshCentre();
    }
    buildConList();
    showStar(null);
    updateReadout();
  }

  /* ---------- go ---------- */
  resize();
  refreshCentre();
  load(seedForToday());
  setZoom(Math.max(200, Math.min(420, W * 0.36)));

  toggleChip('tgLines', 'lines', 'Constellation lines');
  toggleChip('tgLabels', 'labels', 'Names');
  toggleChip('tgBand', 'band', 'Star cloud');
  toggleChip('tgGrid', 'grid', 'Coordinate grid');

  var limSl = $('lim');
  if (limSl) {
    limSl.value = String(opts.limit);
    limSl.addEventListener('input', function () {
      opts.limit = parseFloat(limSl.value);
      var o = $('limVal');
      if (o) o.textContent = opts.limit.toFixed(1);
      updateReadout();
    });
    var lo = $('limVal');
    if (lo) lo.textContent = opts.limit.toFixed(1);
  }

  var zoomSl = $('zoom');
  if (zoomSl) {
    zoomSl.addEventListener('input', function () {
      setZoom(parseFloat(zoomSl.value));
    });
  }

  wire('btnTonight', function () { load(seedForToday()); });
  wire('btnNewSky', function () { load((Math.random() * 4294967295) >>> 0); });
  wire('btnWander', function () {
    if (!sky.cons.length) return;
    var con = sky.cons[Math.floor(Math.random() * sky.cons.length)];
    view.ra = con.ra;
    view.dec = Math.max(-1.4, Math.min(1.4, con.dec));
    refreshCentre();
    selected = con.stars[0];
    showStar(selected);
    updateReadout();
  });
  wire('btnDrift', function () {
    drifting = !drifting;
    this.textContent = drifting ? 'Stop the drift' : 'Let it drift';
  });

  window.addEventListener('resize', function () {
    resize();
    draw();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } else if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  });

  drifting = !reduce;
  var db = $('btnDrift');
  if (db) db.textContent = drifting ? 'Stop the drift' : 'Let it drift';

  raf = requestAnimationFrame(frame);
})();
