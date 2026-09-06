/* experiment.quibo.games — The Orrery
   A star system dealt by today's date, run on a live clock.
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

  function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
  function range(rand, a, b) { return a + rand() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- invented names ---------- */
  var ONSET = ['b','c','d','f','g','h','k','l','m','n','p','r','s','t','v','z',
               'th','sh','kh','br','dr','kr','tr','vh','zh','st','sk','gl','ll','my','ny'];
  var NUC   = ['a','e','i','o','u','a','e','i','o','ae','ei','ou','ia','au','yr','ei'];
  var CODA  = ['n','r','s','l','th','x','m','','','','nn','rr','sk','ph','ng'];

  function syllable(rand) {
    return pick(rand, ONSET) + pick(rand, NUC) + pick(rand, CODA);
  }
  function coinName(rand, minS, maxS) {
    var n = minS + Math.floor(rand() * (maxS - minS + 1));
    var s = '';
    for (var i = 0; i < n; i++) s += syllable(rand);
    s = s.replace(/(.)\1\1+/g, '$1$1');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  var ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  var GREEK = ['a','b','c','d','e','f','g','h'];

  /* ---------- the star ---------- */
  function makeStar(rand) {
    var m = 0.34 + Math.pow(rand(), 1.7) * 1.96;        // solar masses
    var lum = Math.pow(m, 3.5);
    var temp = Math.round(5772 * Math.pow(m, 0.54));
    var radius = Math.pow(m, 0.85);
    var cls = temp > 7300 ? 'A' : temp > 6000 ? 'F' : temp > 5300 ? 'G' : temp > 3900 ? 'K' : 'M';
    var color = { A: '#cfe0ff', F: '#f6f7ff', G: '#ffe9ae', K: '#ffc177', M: '#ff8f5f' }[cls];
    var lifetime = 10 * m / lum;                        // billions of years
    var age = range(rand, 0.3, Math.min(11.5, lifetime * 0.86));
    var flare = cls === 'M' && rand() < 0.55;
    return {
      name: coinName(rand, 2, 3),
      type: cls + Math.floor(rand() * 10) + ' V',
      cls: cls,
      mass: m,
      lum: lum,
      temp: temp,
      radius: radius,
      color: color,
      age: age,
      lifetime: lifetime,
      flare: flare,
      hzIn: Math.sqrt(lum / 1.10),
      hzOut: Math.sqrt(lum / 0.53),
      frost: 2.7 * Math.sqrt(lum)
    };
  }

  /* ---------- the worlds ---------- */
  var ROCK_SURFACE = [
    'basalt plains', 'iron sands', 'shattered highlands', 'salt flats',
    'a single continent', 'archipelagos', 'dust seas', 'ash terraces',
    'sulphur pans', 'glass deserts', 'folded ridges', 'shield volcanoes'
  ];
  var GIANT_BANDS = [
    'ochre and cream', 'slate and rust', 'pale gold', 'olive and bronze',
    'ivory with a red belt', 'green-grey', 'amber with white ovals', 'dull violet'
  ];
  var BIOSPHERES = [
    'A haze of methane the chemistry cannot account for.',
    'Oxygen at a quarter bar, which nothing dead maintains.',
    'Seasonal greening across the northern shelf.',
    'Sulphur cycling on a rhythm too regular to be weather.',
    'Shorelines fringed with something that reflects hard in the infrared.',
    'The atmosphere is out of equilibrium and stays that way.'
  ];

  function radiusFor(kind, mass, rand) {
    if (kind === 'gas') return 10.4 * Math.pow(mass / 318, 0.06) * range(rand, 0.9, 1.16);
    if (kind === 'ice') return 3.6 * Math.pow(mass / 17, 0.32) * range(rand, 0.9, 1.1);
    return mass <= 1.6 ? Math.pow(mass, 0.28) : Math.pow(mass, 0.55);
  }

  function makePlanet(rand, star, a, i) {
    var beyond = a > star.frost;
    var r = rand(), kind, mass;

    if (beyond) {
      if (r < 0.50) { kind = 'gas'; mass = range(rand, 80, 900); }
      else if (r < 0.85) { kind = 'ice'; mass = range(rand, 9, 60); }
      else { kind = 'rock'; mass = range(rand, 0.02, 1.4); }
    } else {
      if (r < 0.82) { kind = 'rock'; mass = 0.05 + Math.pow(rand(), 1.8) * 6.4; }
      else if (r < 0.95) { kind = 'ice'; mass = range(rand, 8, 42); }
      else { kind = 'gas'; mass = range(rand, 90, 620); }
    }

    var radius = radiusFor(kind, mass, rand);
    var grav = mass / (radius * radius);
    var albedo = kind === 'gas' ? 0.42 : kind === 'ice' ? 0.45 : range(rand, 0.10, 0.44);
    var teq = 278.6 * Math.pow(star.lum, 0.25) / Math.sqrt(a) * Math.pow(1 - albedo, 0.25);

    // thickness of any atmosphere the world managed to hold on to
    var thick = 0;
    if (kind === 'rock') {
      if (grav > 0.32 && teq < 1100) thick = clamp(rand() * (grav / 1.2) * clamp(900 / teq, 0, 1.4), 0, 1);
    } else {
      thick = 1;
    }
    var greenhouse = kind === 'rock' ? thick * thick * range(rand, 0, 280) : 0;
    var temp = teq + greenhouse;

    var period = Math.sqrt(a * a * a / star.mass);      // years
    var ecc = Math.pow(rand(), 2.5) * 0.3;
    var argp = rand() * Math.PI * 2;
    var m0 = rand() * Math.PI * 2;

    var days = period * 365.25;
    var locked = days < 14 && kind === 'rock';
    var dayHours = locked ? days * 24 : range(rand, 5.5, 64);
    var retro = !locked && rand() < 0.12;
    var tilt = rand() < 0.1 ? range(rand, 60, 110) : range(rand, 0, 34);

    /* classification */
    var type, color, surface = '';
    if (kind === 'gas') {
      type = mass > 400 ? 'Gas giant' : temp > 700 ? 'Hot Jupiter' : 'Gas giant';
      color = temp > 700 ? '#e88a5a' : pick(rand, ['#e6c08a','#d8b071','#c9a06a','#e0cfa8']);
      surface = 'banded in ' + pick(rand, GIANT_BANDS);
    } else if (kind === 'ice') {
      type = temp > 500 ? 'Scalded ice giant' : 'Ice giant';
      color = pick(rand, ['#7fd8e6','#6fbfe0','#8fd0ff','#5fb0c8']);
      surface = 'a deep cold atmosphere over a slush mantle';
    } else {
      if (temp > 900) { type = 'Molten world'; color = '#ff7a4d'; surface = 'an ocean of rock'; }
      else if (temp > 600) { type = 'Cinder world'; color = '#c2705a'; surface = 'nothing but ' + pick(rand, ROCK_SURFACE); }
      else if (thick > 0.72 && temp > 380) { type = 'Runaway greenhouse'; color = '#d9c07a'; surface = 'cloud deck the whole way down'; }
      else if (temp < 175) { type = 'Frozen world'; color = '#cfe6f2'; surface = 'ice over ' + pick(rand, ROCK_SURFACE); }
      else if (temp < 245) { type = 'Tundra world'; color = '#a9c6c2'; surface = pick(rand, ROCK_SURFACE) + ' under permanent frost'; }
      else if (thick > 0.4 && temp < 330 && rand() < 0.55) { type = 'Ocean world'; color = '#4aa8d8'; surface = 'water across most of it'; }
      else if (thick > 0.25 && temp < 340) { type = 'Terrestrial'; color = '#7fc98a'; surface = pick(rand, ROCK_SURFACE); }
      else if (thick < 0.12) { type = 'Airless rock'; color = '#9aa3b0'; surface = pick(rand, ROCK_SURFACE) + ', unweathered'; }
      else { type = 'Desert world'; color = '#d9b06a'; surface = pick(rand, ROCK_SURFACE); }
      if (mass > 3.2 && type === 'Terrestrial') type = 'Super-Earth';
      if (mass < 0.12) type = 'Dwarf world';
    }

    /* atmosphere */
    var atmo;
    if (kind !== 'rock') atmo = 'Hydrogen and helium, no surface to speak of.';
    else if (thick < 0.08) atmo = 'None worth measuring.';
    else if (thick < 0.3) atmo = 'Thin — ' + pick(rand, ['carbon dioxide','nitrogen','argon and neon','carbon monoxide']) + ', a fraction of a bar.';
    else if (thick < 0.7) atmo = pick(rand, ['Nitrogen and carbon dioxide','Nitrogen with some oxygen','Carbon dioxide','Nitrogen and methane']) + ', around a bar.';
    else atmo = 'Thick — ' + pick(rand, ['carbon dioxide','sulphur compounds','nitrogen and steam','ammonia']) + ', tens of bars.';

    /* life */
    var life = null;
    if (kind === 'rock' && temp > 248 && temp < 338 && grav > 0.32 && thick > 0.24 && rand() < 0.5) {
      life = pick(rand, BIOSPHERES);
    }

    /* moons */
    var nMoons = kind === 'gas' ? 2 + Math.floor(rand() * 6)
               : kind === 'ice' ? 1 + Math.floor(rand() * 4)
               : beyond ? Math.floor(rand() * 3)
               : (rand() < 0.45 ? 1 + Math.floor(rand() * 2) : 0);
    var moons = [];
    for (var mi = 0; mi < nMoons; mi++) {
      moons.push({
        name: coinName(rand, 2, 2),
        letter: GREEK[mi] || String(mi + 1),
        dist: 2.0 + mi * 0.85 + rand() * 0.5,          // in drawn planet radii
        period: range(rand, 1.2, 22) * (1 + mi * 0.7), // days
        phase: rand() * Math.PI * 2,
        size: range(rand, 0.16, 0.42),
        note: pick(rand, ['tidally locked','cratered through','ice over a sea','captured, orbiting backwards','venting from the south','bare rock'])
      });
    }

    var rings = (kind === 'gas' || kind === 'ice') ? rand() < 0.45 : rand() < 0.05;

    return {
      idx: i,
      designation: star.name + ' ' + (ROMAN[i] || String(i + 1)),
      name: coinName(rand, 2, 3),
      kind: kind,
      type: type,
      color: color,
      surface: surface,
      a: a, ecc: ecc, argp: argp, m0: m0, period: period,
      mass: mass, radius: radius, grav: grav,
      albedo: albedo, teq: teq, temp: temp, thick: thick,
      atmo: atmo, life: life, moons: moons, rings: rings,
      dayHours: dayHours, locked: locked, retro: retro, tilt: tilt,
      dA: a, x: 0, y: 0, sx: 0, sy: 0, pr: 5
    };
  }

  function makeSystem(seed) {
    var rand = rng(seed);
    var star = makeStar(rand);
    var n = 4 + Math.floor(rand() * 6);
    var a = range(rand, 0.16, 0.44) * Math.pow(star.lum, 0.22);
    var planets = [];
    for (var i = 0; i < n; i++) {
      if (i > 0) a *= range(rand, 1.36, 2.15);
      planets.push(makePlanet(rand, star, a, i));
    }
    // a background of fixed stars, so the field is not empty
    var bg = [];
    for (var s = 0; s < 260; s++) {
      bg.push({ x: rand(), y: rand(), r: 0.3 + rand() * 1.2, a: 0.18 + rand() * 0.6 });
    }
    return { seed: seed, star: star, planets: planets, bg: bg };
  }

  /* ---------- formatting ---------- */
  function f(n, d) { return n.toFixed(d === undefined ? 2 : d); }
  function yearText(p) {
    var days = p.period * 365.25;
    if (days < 900) return f(days, days < 10 ? 2 : 1) + ' days';
    return f(p.period, 1) + ' years';
  }
  function dayText(p) {
    if (p.locked) return 'locked to its year';
    if (p.dayHours > 48) return f(p.dayHours / 24, 1) + ' days' + (p.retro ? ', retrograde' : '');
    return f(p.dayHours, 1) + ' h' + (p.retro ? ', retrograde' : '');
  }
  function tempText(k) { return Math.round(k) + ' K (' + Math.round(k - 273.15) + ' °C)'; }

  /* ---------- state ---------- */
  var canvas = document.getElementById('orrery');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var sys = null;
  var W = 0, H = 0, DPR = 1, PPU = 40;
  var years = 0;
  var SPEEDS = [
    { label: 'Paused', v: 0 },
    { label: '1 day/s', v: 1 / 365.25 },
    { label: '1 week/s', v: 7 / 365.25 },
    { label: '1 month/s', v: 30.4 / 365.25 },
    { label: '1 year/s', v: 1 }
  ];
  var speedIdx = reduce ? 0 : 2;
  var opts = { layout: 'even', labels: true, orbits: true, hz: true };
  var zoom = 1, selected = null, hover = null, raf = null, last = 0;

  function $(id) { return document.getElementById(id); }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = Math.round(W * 620 / 960);
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fit();
  }

  function fit() {
    if (!sys) return;
    var ps = sys.planets, n = ps.length;
    var maxTrue = ps[n - 1].a;
    var step = maxTrue / n;
    for (var i = 0; i < n; i++) ps[i].dA = opts.layout === 'true' ? ps[i].a : (i + 1) * step;
    var outer = ps[n - 1].dA * (1 + ps[n - 1].ecc);
    PPU = (Math.min(W, H) * 0.44 / outer) * zoom;
  }

  // map a true distance in AU into drawn AU (so the habitable zone lands in the right place)
  function mapAU(au) {
    if (opts.layout === 'true') return au;
    var ps = sys.planets;
    if (au <= ps[0].a) return ps[0].a > 0 ? au / ps[0].a * ps[0].dA : 0;
    for (var i = 1; i < ps.length; i++) {
      if (au <= ps[i].a) {
        var t = (au - ps[i - 1].a) / (ps[i].a - ps[i - 1].a);
        return ps[i - 1].dA + t * (ps[i].dA - ps[i - 1].dA);
      }
    }
    var lastP = ps[ps.length - 1];
    return lastP.dA * (au / lastP.a);
  }

  function orbitPos(p, t) {
    var M = p.m0 + Math.PI * 2 * (t / p.period);
    var e = p.ecc, E = M;
    for (var i = 0; i < 6; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    var x = p.dA * (Math.cos(E) - e);
    var y = p.dA * Math.sqrt(1 - e * e) * Math.sin(E);
    var c = Math.cos(p.argp), s = Math.sin(p.argp);
    p.x = x * c - y * s;
    p.y = x * s + y * c;
  }

  function planetPixels(p) {
    return clamp(3.2 + 5.4 * Math.log10(1 + p.radius), 3.2, 15);
  }

  /* ---------- drawing ---------- */
  function draw() {
    var cx = W / 2, cy = H / 2;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05070b');
    g.addColorStop(1, '#080b12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // fixed stars
    for (var b = 0; b < sys.bg.length; b++) {
      var s = sys.bg[b];
      ctx.globalAlpha = s.a * 0.7;
      ctx.fillStyle = '#dfe8f6';
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // habitable zone
    if (opts.hz) {
      var ri = mapAU(sys.star.hzIn) * PPU;
      var ro = mapAU(sys.star.hzOut) * PPU;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, ro, 0, Math.PI * 2);
      ctx.arc(cx, cy, ri, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(100,240,200,0.055)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,240,200,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, ro, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // orbits
    if (opts.orbits) {
      for (var i = 0; i < sys.planets.length; i++) {
        var p = sys.planets[i];
        var A = p.dA * PPU, B = A * Math.sqrt(1 - p.ecc * p.ecc);
        var ox = cx - p.dA * p.ecc * Math.cos(p.argp) * PPU;
        var oy = cy - p.dA * p.ecc * Math.sin(p.argp) * PPU;
        ctx.beginPath();
        ctx.ellipse(ox, oy, A, B, p.argp, 0, Math.PI * 2);
        ctx.strokeStyle = (selected === p || hover === p) ? 'rgba(122,162,255,.55)' : 'rgba(255,255,255,.11)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // the star
    var sr = clamp(6 + sys.star.radius * 4.5, 6, 24);
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * 7);
    glow.addColorStop(0, sys.star.color);
    glow.addColorStop(0.14, 'rgba(255,220,160,.28)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, sr * 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sys.star.color;
    ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2); ctx.fill();

    // planets
    for (var k = 0; k < sys.planets.length; k++) {
      var pl = sys.planets[k];
      orbitPos(pl, years);
      var px = cx + pl.x * PPU, py = cy + pl.y * PPU;
      var pr = planetPixels(pl);
      pl.sx = px; pl.sy = py; pl.pr = pr;

      if (pl.rings) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(0.5);
        ctx.strokeStyle = 'rgba(230,220,200,.42)';
        ctx.lineWidth = Math.max(1, pr * 0.28);
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 2.05, pr * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      var pg = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.15, px, py, pr);
      pg.addColorStop(0, pl.color);
      pg.addColorStop(1, 'rgba(0,0,0,.72)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();

      if (pl.life) {
        ctx.strokeStyle = 'rgba(100,240,200,.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(px, py, pr + 3.5, 0, Math.PI * 2); ctx.stroke();
      }

      for (var mi = 0; mi < pl.moons.length; mi++) {
        var mo = pl.moons[mi];
        var ang = mo.phase + Math.PI * 2 * (years * 365.25 / mo.period);
        var md = pr * mo.dist + 4;
        ctx.fillStyle = 'rgba(220,228,240,.8)';
        ctx.beginPath();
        ctx.arc(px + Math.cos(ang) * md, py + Math.sin(ang) * md * 0.5, Math.max(1.1, pr * mo.size * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      if (selected === pl) {
        ctx.strokeStyle = 'rgba(122,162,255,.9)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(px, py, pr + 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      if (opts.labels) {
        ctx.font = '11px ui-monospace,Menlo,monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = (selected === pl || hover === pl) ? '#e8edf5' : 'rgba(180,192,210,.72)';
        ctx.fillText(pl.name, px, py + pr + 15);
      }
    }

    // star label
    if (opts.labels) {
      ctx.font = '600 12px ui-monospace,Menlo,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,233,174,.9)';
      ctx.fillText(sys.star.name, cx, cy - sr - 10);
    }

    // clock
    ctx.font = '11px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(139,151,171,.85)';
    ctx.fillText('elapsed  ' + f(years, 2) + ' yr', 14, H - 14);
    ctx.textAlign = 'right';
    ctx.fillText(opts.layout === 'true' ? 'true scale' : 'orbits spread evenly', W - 14, H - 14);
  }

  /* ---------- loop ---------- */
  function frame(ts) {
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;
    years += dt * SPEEDS[speedIdx].v;
    draw();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- cards ---------- */
  function starCard() {
    var s = sys.star;
    return '<div class="seed-num" style="color:' + s.color + '">' + s.name + '</div>' +
      '<p class="card-lead">' + s.type + ' — the only thing here that makes its own light. ' +
      (s.flare ? 'It flares, hard and often, which is bad news for anything close in. ' : '') +
      'It has been burning for ' + f(s.age, 1) + ' billion years and has roughly ' +
      f(Math.max(0.1, s.lifetime - s.age), 1) + ' billion left.</p>' +
      '<dl class="seed-grid">' +
      row('Mass', f(s.mass, 2) + ' M☉') +
      row('Radius', f(s.radius, 2) + ' R☉') +
      row('Luminosity', f(s.lum, s.lum < 1 ? 3 : 2) + ' L☉') +
      row('Surface', s.temp + ' K') +
      row('Habitable zone', f(s.hzIn, 2) + '–' + f(s.hzOut, 2) + ' AU') +
      row('Frost line', f(s.frost, 2) + ' AU') +
      row('Worlds', String(sys.planets.length)) +
      '</dl>';
  }

  function row(k, v) {
    return '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
  }

  function planetCard(p) {
    var moonTxt = p.moons.length === 0 ? 'None.' :
      p.moons.map(function (m) { return m.name + ' (' + m.note + ')'; }).join('; ') + '.';
    var band = p.a < sys.star.hzIn ? 'inside the habitable zone, too close'
             : p.a > sys.star.hzOut ? 'outside the habitable zone, too far'
             : 'inside the habitable zone';
    return '<div class="seed-num" style="color:' + p.color + '">' + p.name + '</div>' +
      '<p class="card-lead">' + p.designation + ' · ' + p.type + '. ' +
      'It orbits at ' + f(p.a, 2) + ' AU, ' + band + ', and shows ' + p.surface + '.' +
      (p.rings ? ' It carries a ring system.' : '') +
      (p.life ? ' <b class="bio">Biosignature: ' + p.life + '</b>' : '') + '</p>' +
      '<dl class="seed-grid">' +
      row('Mass', f(p.mass, p.mass < 10 ? 2 : 0) + ' M⊕') +
      row('Radius', f(p.radius, 2) + ' R⊕') +
      row('Gravity', f(p.grav, 2) + ' g') +
      row('Year', yearText(p)) +
      row('Day', dayText(p)) +
      row('Eccentricity', f(p.ecc, 3)) +
      row('Axial tilt', Math.round(p.tilt) + '°') +
      row('Temperature', tempText(p.temp)) +
      row('Albedo', f(p.albedo, 2)) +
      row('Moons', String(p.moons.length)) +
      '</dl>' +
      '<p class="card-note"><b>Atmosphere.</b> ' + p.atmo + '</p>' +
      '<p class="card-note"><b>Satellites.</b> ' + moonTxt + '</p>';
  }

  function renderCard() {
    var el = $('card');
    if (!el) return;
    el.innerHTML = selected ? planetCard(selected) : starCard();
  }

  function renderDossier() {
    var t = $('dossier');
    if (!t) return;
    var html = '<table><thead><tr><th>World</th><th>Type</th><th>AU</th><th>Year</th>' +
      '<th>Mass</th><th>Gravity</th><th>Temp</th><th>Moons</th></tr></thead><tbody>';
    for (var i = 0; i < sys.planets.length; i++) {
      var p = sys.planets[i];
      html += '<tr data-i="' + i + '"' + (p.life ? ' class="alive"' : '') + '>' +
        '<td><b>' + p.name + '</b><span class="desig">' + p.designation + '</span></td>' +
        '<td>' + p.type + '</td>' +
        '<td>' + f(p.a, 2) + '</td>' +
        '<td>' + yearText(p) + '</td>' +
        '<td>' + f(p.mass, p.mass < 10 ? 2 : 0) + ' M⊕</td>' +
        '<td>' + f(p.grav, 2) + ' g</td>' +
        '<td>' + Math.round(p.temp) + ' K</td>' +
        '<td>' + p.moons.length + '</td></tr>';
    }
    html += '</tbody></table>';
    t.innerHTML = html;
    var rows = t.querySelectorAll('tr[data-i]');
    for (var r = 0; r < rows.length; r++) {
      rows[r].addEventListener('click', function () {
        selected = sys.planets[+this.getAttribute('data-i')];
        renderCard();
        canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function renderReadout() {
    $('seedOut').textContent = String(sys.seed).padStart(10, '0');
    $('starOut').textContent = sys.star.name + ' · ' + sys.star.type;
    var alive = sys.planets.filter(function (p) { return p.life; }).length;
    $('lifeOut').textContent = alive === 0 ? 'nothing yet' : alive + (alive === 1 ? ' candidate' : ' candidates');
  }

  /* ---------- interaction ---------- */
  function hitTest(mx, my) {
    for (var i = 0; i < sys.planets.length; i++) {
      var p = sys.planets[i];
      var dx = mx - p.sx, dy = my - p.sy;
      if (dx * dx + dy * dy < Math.pow(p.pr + 9, 2)) return p;
    }
    var cdx = mx - W / 2, cdy = my - H / 2;
    if (cdx * cdx + cdy * cdy < 900) return 'star';
    return null;
  }

  function localPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  canvas.addEventListener('pointermove', function (e) {
    var pt = localPoint(e);
    var h = hitTest(pt.x, pt.y);
    hover = (h && h !== 'star') ? h : null;
    canvas.style.cursor = h ? 'pointer' : 'default';
  });

  canvas.addEventListener('pointerleave', function () { hover = null; });

  canvas.addEventListener('click', function (e) {
    var pt = localPoint(e);
    var h = hitTest(pt.x, pt.y);
    if (h === 'star') selected = null;
    else if (h) selected = h;
    else return;
    renderCard();
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoom = clamp(zoom * (e.deltaY > 0 ? 0.9 : 1.11), 0.35, 6);
    var zs = $('zoom');
    if (zs) zs.value = String(Math.round(zoom * 100));
    fit();
  }, { passive: false });

  /* ---------- controls ---------- */
  function chips(host, items, active, onPick) {
    var el = $(host);
    if (!el) return;
    el.innerHTML = '';
    items.forEach(function (it, i) {
      var b = document.createElement('button');
      b.className = 'chip' + (i === active ? ' on' : '');
      b.type = 'button';
      b.textContent = it;
      b.addEventListener('click', function () {
        var all = el.querySelectorAll('.chip');
        for (var j = 0; j < all.length; j++) all[j].classList.remove('on');
        b.classList.add('on');
        onPick(i);
      });
      el.appendChild(b);
    });
  }

  function toggle(id, key, label) {
    var b = $(id);
    if (!b) return;
    b.addEventListener('click', function () {
      opts[key] = !opts[key];
      b.classList.toggle('on', opts[key]);
      b.textContent = (opts[key] ? 'Hide ' : 'Show ') + label;
      if (key === 'layout') fit();
    });
    b.classList.toggle('on', opts[key]);
    b.textContent = (opts[key] ? 'Hide ' : 'Show ') + label;
  }

  function load(seed) {
    sys = makeSystem(seed);
    years = 0;
    selected = null;
    hover = null;
    fit();
    renderCard();
    renderDossier();
    renderReadout();
  }

  chips('speeds', SPEEDS.map(function (s) { return s.label; }), speedIdx, function (i) { speedIdx = i; });
  chips('layouts', ['Spread evenly', 'True scale'], 0, function (i) {
    opts.layout = i === 0 ? 'even' : 'true';
    fit();
  });
  toggle('btnLabels', 'labels', 'names');
  toggle('btnOrbits', 'orbits', 'orbits');
  toggle('btnHz', 'hz', 'habitable zone');

  var zs = $('zoom');
  if (zs) zs.addEventListener('input', function () { zoom = (+this.value) / 100; fit(); });

  var bn = $('btnNew');
  if (bn) bn.addEventListener('click', function () { load((Math.random() * 4294967295) >>> 0); });
  var bt = $('btnToday');
  if (bt) bt.addEventListener('click', function () { load(seedForToday()); });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      speedIdx = speedIdx === 0 ? 2 : 0;
      var all = document.querySelectorAll('#speeds .chip');
      for (var j = 0; j < all.length; j++) all[j].classList.toggle('on', j === speedIdx);
    }
  });

  window.addEventListener('resize', resize);

  /* ---------- go ---------- */
  resize();
  load(seedForToday());
  resize();
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      last = 0;
    } else if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  });
})();
