/* The Lens — drift.quibo.games
   A lens commissioned, cut and then ruined by today's date.
   Needs lens-optics.js and lens-draw.js. */
(function () {
'use strict';

var O = window.Optics, D = window.LensDraw;
function $(id) { return document.getElementById(id); }

/* ---------------- commissions ---------------- */

var COMS = [
  { form: 'cemented', tag: 'objective',
    title: 'the objective of a school refractor',
    need: 'Sixty millimetres of glass for a grammar school with rather more enthusiasm than money. It will spend its life pointed at Jupiter by people wearing gloves.',
    f: [520, 900], fno: [8, 14], field: [0.35, 0.75] },
  { form: 'airspaced', tag: 'objective',
    title: 'the objective of a surveyor’s level',
    need: 'It has to read a staff at eighty metres in flat light and survive being carried across a field in a canvas bag. Nobody will ever clean it.',
    f: [260, 430], fno: [7, 11], field: [0.6, 1.2] },
  { form: 'airspaced', tag: 'finder',
    title: 'a comet finder for somebody who works nights',
    need: 'Wide, fast and forgiving. The owner is looking for something that is not there yet, so the whole field has to be worth looking at, not just the middle of it.',
    f: [170, 300], fno: [4, 6], field: [1.4, 2.6] },
  { form: 'triplet', tag: 'camera',
    title: 'the lens of a folding plate camera',
    need: 'Three pieces of glass and no more, because the price of the camera is fixed and the shutter has already been bought. It must cover the whole plate corner to corner.',
    f: [90, 155], fno: [4.5, 8], field: [14, 21] },
  { form: 'triplet', tag: 'projector',
    title: 'a projection lens for a magic lantern',
    need: 'It will run hot, all evening, in front of a limelight, and the audience at the back of the hall will be looking at the corners of the slide as much as the middle.',
    f: [120, 230], fno: [3.5, 5.5], field: [7, 12] },
  { form: 'petzval', tag: 'portrait',
    title: 'a portrait lens for a studio over a draper’s shop',
    need: 'As fast as you can make it. The sitter has to hold still for the exposure, and every stop you can open is ten seconds they do not have to spend not blinking.',
    f: [130, 250], fno: [3, 4.5], field: [6, 11] },
  { form: 'singlet', tag: 'landscape',
    title: 'the landscape lens of a box camera',
    need: 'One piece of glass behind a hole in a card, sold by the thousand. Nobody expects it to be good. It is expected to be cheap and to be roughly in focus.',
    f: [80, 135], fno: [11, 16], field: [16, 24] },
  { form: 'cemented', tag: 'collimator',
    title: 'the collimator of a bench spectroscope',
    need: 'It looks at a slit and hands the prism a parallel beam. Any colour it smears here comes back as a line in the wrong place, which is the one thing the instrument is for.',
    f: [200, 350], fno: [9, 15], field: [0.5, 1.1] }
];

var MAKERS = ['Aldwyn', 'Brachet', 'Corvill', 'Dunmore', 'Estrell', 'Faverow', 'Gallier',
  'Hensbeck', 'Ivell', 'Jarrow', 'Kettner', 'Lovatt', 'Merrick', 'Norbury', 'Ostrand',
  'Pentrith', 'Quillan', 'Rathmore', 'Silvane', 'Trevick', 'Urwin', 'Vasey', 'Wetherall'];
var TOWNS = ['Ashgate', 'Belholm', 'Cold Harbour', 'Drennan', 'Elsbury', 'Farrowgate',
  'Grey Mill', 'Hallowfield', 'Innsmere', 'Kirkhowe', 'Larchwick', 'Morrow Bridge',
  'Netherby', 'Oldcastle', 'Penhallow', 'Quarry End', 'Redlinch', 'Stonemarch',
  'Thorn Rise', 'Uffing', 'Vane Street', 'Westwater'];
var TRADES = ['optician', 'instrument maker', 'glass grinder', 'philosophical instrument maker',
  'telescope maker', 'working optician', 'lens grinder'];
var FATES = [
  'It worked for thirty-one years, was recemented twice, and is now in a drawer that nobody has the key to.',
  'Sold to a school, dropped by a school, and the rear element is still in the case with a crack across one corner.',
  'The mount rusted through long before the glass did. The glass is fine.',
  'Repolished by somebody who should not have, which cost it about a fifth of its aperture.',
  'Still in use. The owner has been told twice that a better one exists and has declined twice.',
  'Lost in a house fire; the prescription survived because it was written in a notebook kept elsewhere.',
  'Copied within the year by two other workshops, one of which got the flint the wrong way round.',
  'Returned once with a complaint about the edges, and returned again with an apology.',
  'It outlived the instrument it was cut for and was put into a second one that did not suit it.'
];

function pickFrom(r, a) { return a[Math.floor(r() * a.length) % a.length]; }

function glassesFor(form, r) {
  var cr = O.crowns(), fl = O.flints().filter(function (g) { return g.vd <= 38; });
  var flAll = O.flints();
  if (form === 'singlet') return [pickFrom(r, cr)];
  if (form === 'cemented' || form === 'airspaced') return [pickFrom(r, cr), pickFrom(r, fl)];
  if (form === 'triplet') return [pickFrom(r, cr), pickFrom(r, fl), pickFrom(r, cr)];
  return [pickFrom(r, cr), pickFrom(r, flAll), pickFrom(r, flAll), pickFrom(r, cr)];
}

function makeCommission(seed) {
  var r = O.rng(seed);
  r(); r();
  var c = COMS[Math.floor(r() * COMS.length) % COMS.length];
  var f = Math.round(O.lerp(c.f[0], c.f[1], r()) / 5) * 5;
  var fno = Math.round(O.lerp(c.fno[0], c.fno[1], r()) * 10) / 10;
  var field = Math.round(O.lerp(c.field[0], c.field[1], r()) * 100) / 100;
  return {
    form: c.form, tag: c.tag, title: c.title, need: c.need,
    f: f, fno: fno, field: field,
    gl: glassesFor(c.form, r),
    maker: pickFrom(r, MAKERS), town: pickFrom(r, TOWNS), trade: pickFrom(r, TRADES),
    year: 1794 + Math.floor(r() * 138),
    fate: pickFrom(r, FATES)
  };
}

/* ---------------- state ---------------- */

var S = {
  date: new Date(), seed: 0, com: null, cfg: null, airIdx: [],
  design: null, cur: null, focusDof: 0,
  fields: [0, 0.7, 1.0], waves: [0, 1, 2], sel: -1,
  startRms: 0, endRms: 0, evals: 0
};
var seenTimer = null;

function axisRms(sarr, cfg, defocus) {
  var b = O.buildSys(sarr, cfg.aperture, cfg.field);
  if (!b.par) return Infinity;
  var zimg = b.zLast + b.par.bfl + defocus;
  return O.spotAt(b, 0, [656.3, 587.6, 486.1], O.pupil(4, 10), zimg).rms;
}

function cutLens(com, maxEvals) {
  var cfg = { f: com.f, aperture: com.f / com.fno, field: com.field };
  var bf = O.buildForm(com.form, com.f, com.gl);
  var start = O.cloneSurf(bf.surf);
  var ok = O.scaleTo(start, cfg.f);
  var sRms = ok ? axisRms(start, cfg, 0) : Infinity;
  var res = O.optimise(bf.surf, bf.airIdx, cfg, { maxEvals: maxEvals || 1600 });
  var surf = res.surf || start;
  var def = res.surf ? res.defocus : 0;
  return {
    cfg: cfg, airIdx: bf.airIdx, surf: surf, defocus: def,
    startRms: sRms, endRms: axisRms(surf, cfg, def), evals: res.evals, passes: res.passes
  };
}

function deal(seed, date) {
  S.seed = seed >>> 0;
  if (date) S.date = date;
  S.com = makeCommission(S.seed);
  var cut = cutLens(S.com, 1600);
  S.cfg = cut.cfg; S.airIdx = cut.airIdx;
  S.design = { surf: cut.surf, defocus: cut.defocus, glassNames: S.com.gl.map(function (g) { return g.n; }) };
  S.cur = { surf: O.cloneSurf(cut.surf), defocus: cut.defocus };
  S.startRms = cut.startRms; S.endRms = cut.endRms; S.evals = cut.evals;
  S.focusDof = 0; S.sel = -1;
  buildControls();
  fillPlaque();
  render();
}

/* ---------------- controls ---------------- */

function elementsOf(surfArr) {
  var gs = D.groups(surfArr), out = [], i, j;
  for (i = 0; i < gs.length; i++) for (j = gs[i].a; j < gs[i].b; j++) out.push(j);
  return out;
}

function buildControls() {
  var s = S.cur.surf, i;
  var zs = O.vertices(s), tf = Math.tan(S.cfg.field * Math.PI / 180);

  /* radius sliders */
  var box = $('radii'); box.innerHTML = '';
  for (i = 0; i < s.length; i++) {
    (function (idx) {
      var h = S.cfg.aperture * 0.5 + zs[idx] * tf + 0.3;
      var cmax = 0.9 / h;
      var lab = document.createElement('label');
      lab.innerHTML = 'Surface ' + (idx + 1) + ' <b id="rOut' + idx + '">—</b>';
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = (-cmax).toFixed(6); inp.max = cmax.toFixed(6);
      inp.step = (cmax / 700).toFixed(8); inp.value = s[idx].c;
      inp.addEventListener('input', function () {
        S.cur.surf[idx].c = parseFloat(inp.value);
        S.sel = idx;
        render();
      });
      inp.addEventListener('focus', function () { S.sel = idx; render(); });
      lab.appendChild(inp);
      box.appendChild(lab);
      S.cur.surf[idx]._inp = inp;
    })(i);
  }

  /* airspace sliders */
  var gbox = $('gaps'); gbox.innerHTML = '';
  if (!S.airIdx.length) {
    gbox.innerHTML = '<p class="hint" style="margin:0">This design has no air inside it — the elements are cemented.</p>';
  }
  for (i = 0; i < S.airIdx.length; i++) {
    (function (idx) {
      var t0 = S.design.surf[idx].t;
      var lab = document.createElement('label');
      lab.innerHTML = 'Air gap after surface ' + (idx + 1) + ' <b id="gOut' + idx + '">—</b>';
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = 0.2; inp.max = (t0 * 3 + 6).toFixed(2);
      inp.step = 0.05; inp.value = S.cur.surf[idx].t;
      inp.addEventListener('input', function () {
        S.cur.surf[idx].t = parseFloat(inp.value); render();
      });
      lab.appendChild(inp);
      gbox.appendChild(lab);
      S.cur.surf[idx]._ginp = inp;
    })(S.airIdx[i]);
  }

  /* glass selects */
  var el = elementsOf(S.cur.surf), gr = $('glassRow');
  gr.innerHTML = '';
  for (i = 0; i < el.length; i++) {
    (function (si, n) {
      var wrap = document.createElement('label');
      wrap.textContent = 'Element ' + (n + 1);
      var sel = document.createElement('select');
      sel.className = 'gsel';
      for (var k = 0; k < O.GLASS.length; k++) {
        var op = document.createElement('option');
        op.value = O.GLASS[k].n;
        op.textContent = O.GLASS[k].n + '  (nd ' + O.GLASS[k].nd.toFixed(4) + ', V ' + O.GLASS[k].vd.toFixed(1) + ')';
        if (S.cur.surf[si].gl && S.cur.surf[si].gl.n === O.GLASS[k].n) op.selected = true;
        sel.appendChild(op);
      }
      sel.addEventListener('change', function () {
        S.cur.surf[si].gl = O.glassByName(sel.value);
        render();
      });
      wrap.appendChild(sel);
      gr.appendChild(wrap);
    })(el[i], i);
  }

  /* aperture + focus */
  var ap = $('apRange');
  ap.min = Math.max(1.8, S.com.fno * 0.55).toFixed(1);
  ap.max = (S.com.fno * 2.3).toFixed(1);
  ap.step = 0.1; ap.value = S.com.fno;
  var fo = $('focusRange');
  fo.min = -8; fo.max = 8; fo.step = 0.1; fo.value = 0;
}

function syncControls(b) {
  var s = S.cur.surf, i;
  for (i = 0; i < s.length; i++) {
    var o = $('rOut' + i);
    if (o) o.textContent = Math.abs(s[i].c) < 1e-7 ? 'flat' :
      ((1 / s[i].c) > 0 ? '+' : '−') + Math.abs(1 / s[i].c).toFixed(1) + ' mm';
    if (s[i]._inp && parseFloat(s[i]._inp.value) !== s[i].c) s[i]._inp.value = s[i].c;
  }
  for (i = 0; i < S.airIdx.length; i++) {
    var j = S.airIdx[i], g = $('gOut' + j);
    if (g) g.textContent = s[j].t.toFixed(2) + ' mm';
    if (s[j]._ginp && parseFloat(s[j]._ginp.value) !== s[j].t) s[j]._ginp.value = s[j].t;
  }
  $('apOut').textContent = 'f/' + S.cfg.fnoNow.toFixed(1) + '  (' + S.cfg.aperture.toFixed(1) + ' mm)';
  $('focusOut').textContent = (S.focusDof >= 0 ? '+' : '−') +
    Math.abs(S.focusDof).toFixed(1) + ' depths of focus';
}

/* ---------------- prescription ---------------- */

function prescription(b) {
  var s = S.cur.surf, out = [], i;
  out.push(' #   radius (mm)   thickness   medium');
  for (i = 0; i < s.length; i++) {
    var R = Math.abs(s[i].c) < 1e-7 ? '        flat' :
      (((1 / s[i].c) > 0 ? '  +' : '  −') + pad(Math.abs(1 / s[i].c).toFixed(2), 10));
    var t = i === s.length - 1 ? b.par.bfl + S.cur.defocus + focusMm(b) : s[i].t;
    out.push(' ' + (i + 1) + '   ' + R + '  ' + pad(t.toFixed(2), 9) + '   ' +
      (s[i].gl ? s[i].gl.n : 'air'));
  }
  return out.join('\n');
}
function pad(str, n) { str = String(str); while (str.length < n) str = ' ' + str; return str; }

/* ---------------- render ---------------- */

function focusMm(b) {
  var N = b.par.f / S.cfg.aperture;
  var dof = 2 * 0.0005876 * N * N;
  return S.focusDof * dof;
}

function render() {
  var b = O.buildSys(S.cur.surf, S.cfg.aperture, S.cfg.field);
  var v = $('verdict');
  if (!b.par) {
    v.className = 'verdict bad';
    v.innerHTML = '<b>This is not a lens any more.</b> Whatever you have just done to it, ' +
      'the system has no positive power left, so there is nothing for it to bring to a focus. ' +
      'Put a curve back, or take the design as drawn again.';
    return;
  }
  S.cfg.fnoNow = b.par.f / S.cfg.aperture;
  var zimg = b.zLast + b.par.bfl + S.cur.defocus + focusMm(b);
  var cfgNow = { f: b.par.f, aperture: S.cfg.aperture, field: S.cfg.field };

  D.drawBench($('bench'), b, cfgNow, {
    zimg: zimg, fields: S.fields, waves: S.waves, sel: S.sel
  });

  var airy = 1.22 * 0.0005876 * S.cfg.fnoNow;
  var spots = D.drawSpots($('spots'), b, cfgNow, zimg, airy);
  D.drawFan($('fan'), b, cfgNow, zimg);

  /* longitudinal colour */
  var pF = O.paraxial(S.cur.surf, 486.1), pC = O.paraxial(S.cur.surf, 656.3);
  var chroma = (pF && pC) ? (pF.bfl - pC.bfl) : NaN;
  var dof = 2 * 0.0005876 * S.cfg.fnoNow * S.cfg.fnoNow;

  /* thinnest edge */
  var e = O.edges(b, cfgNow), thin = Infinity;
  for (var i = 0; i < e.length; i++) thin = Math.min(thin, e[i].et);

  var ax = spots[0].rms, corner = spots[2].rms, ratio = ax / airy;

  $('fEfl').textContent = b.par.f.toFixed(1) + ' mm' +
    (Math.abs(b.par.f - S.cfg.f) > S.cfg.f * 0.005 ? '  (asked for ' + S.cfg.f + ')' : '');
  $('fFno').textContent = 'f/' + S.cfg.fnoNow.toFixed(1);
  $('fAper').textContent = S.cfg.aperture.toFixed(1) + ' mm';
  $('fField').textContent = '±' + S.cfg.field.toFixed(2) + '°  (' +
    (2 * b.par.f * Math.tan(S.cfg.field * Math.PI / 180)).toFixed(1) + ' mm frame)';
  $('fAxis').textContent = (ax * 1000).toFixed(1) + ' µm rms';
  $('fCorner').textContent = (corner * 1000).toFixed(1) + ' µm rms';
  $('fAiry').textContent = (airy * 1000).toFixed(2) + ' µm radius';
  $('fRatio').textContent = ratio.toFixed(2) + ' × the Airy disc';
  $('fChroma').textContent = isNaN(chroma) ? '—' :
    (chroma * 1000).toFixed(0) + ' µm  (' + (chroma / dof).toFixed(1) + ' depths of focus)';
  $('fRim').textContent = isFinite(thin) ? (thin > 0 ? thin.toFixed(2) + ' mm' : 'nothing left') : '—';
  $('fWork').textContent = S.evals.toLocaleString() + ' trials at the bench';

  $('rx').textContent = prescription(b);
  syncControls(b);

  /* verdict */
  var cls = 'good', txt;
  if (ratio <= 1.0) txt = '<b>Diffraction limited.</b> The geometry is no longer what is stopping it — ' +
    'the rays land inside the Airy disc, and the blur you can see in the picture below is the ' +
    'wave nature of light rather than any fault of the glass.';
  else if (ratio <= 2.5) { txt = '<b>Sharp.</b> Residual aberration about ' + ratio.toFixed(1) +
    ' times the Airy disc, which in practice you would notice only by looking for it.'; }
  else if (ratio <= 6) { cls = 'warn'; txt = '<b>Soft.</b> The spot is ' + ratio.toFixed(1) +
    ' times the size of the Airy disc, so this lens is being beaten by its own geometry and not by diffraction.'; }
  else { cls = 'bad'; txt = '<b>Not usable.</b> The spot is ' + ratio.toFixed(0) +
    ' times the Airy disc. Whatever is being imaged is arriving as a smear.'; }
  if (isFinite(thin) && thin < 0.25) {
    cls = 'bad';
    txt += ' It also could not be made: one of the elements has ' +
      (thin > 0 ? 'only ' + thin.toFixed(2) + ' mm' : 'no glass at all') + ' left at the rim.';
  }
  v.className = 'verdict ' + cls;
  v.innerHTML = txt;

  scheduleSeen(b, cfgNow, zimg);
}

function scheduleSeen(b, cfgNow, zimg) {
  if (seenTimer) clearTimeout(seenTimer);
  $('seenNote').textContent = 'imaging…';
  seenTimer = setTimeout(function () {
    try { D.renderSeen($('seen'), b, cfgNow, zimg); } catch (err) { }
    $('seenNote').textContent =
      'The chart on the left is what is out there. The one on the right is what lands on the plate: ' +
      'every point in it spread out by the rays this lens actually traces, in three colours, with the ' +
      'diffraction limit folded in so that even a perfect design does not hand back a point.';
  }, 260);
}

/* ---------------- plaque ---------------- */

function fillPlaque() {
  var c = S.com;
  $('comWho').textContent = c.maker + ', ' + c.trade + ' · ' + c.town + ' · ' + c.year;
  $('comTitle').textContent = c.title.charAt(0).toUpperCase() + c.title.slice(1);
  $('comPurpose').textContent = c.need;
  $('comFate').textContent = c.fate;
  var gl = c.gl.map(function (g) { return g.n; }).join(', ');
  $('comMeta').innerHTML = c.f + ' mm at f/' + c.fno.toFixed(1) + ' · ±' +
    c.field.toFixed(2) + '° · ' + gl + ' · dealt from ' +
    String(S.seed).padStart(10, '0') + ' · <span id="dayOut">' +
    S.date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + '</span>';
  var first = isFinite(S.startRms) ? (S.startRms * 1000).toFixed(1) + ' µm' : 'nothing usable';
  $('cutNote').textContent = 'The first draft of this design blurred a point to ' + first +
    ' on axis. After ' + S.evals.toLocaleString() + ' trials of the curvatures, the airspaces and the ' +
    'focal plane it blurs it to ' + (S.endRms * 1000).toFixed(1) + ' µm. That is the lens you have been handed.';
}

/* ---------------- chips and buttons ---------------- */

function chipRow(el, items, isOn, onPick) {
  el.innerHTML = '';
  items.forEach(function (it, i) {
    var b = document.createElement('button');
    b.className = 'chip' + (isOn(i) ? ' on' : '');
    b.textContent = it;
    b.addEventListener('click', function () { onPick(i); });
    el.appendChild(b);
  });
}

var FIELDSETS = [[0], [0, 0.7, 1.0], [1.0]];
var WAVESETS = [[1], [0, 1, 2]];
var fieldPick = 1, wavePick = 1;

function wireChips() {
  chipRow($('fieldChips'), ['on axis', 'all three', 'corner only'],
    function (i) { return i === fieldPick; },
    function (i) { fieldPick = i; S.fields = FIELDSETS[i]; wireChips(); render(); });
  chipRow($('waveChips'), ['d line only', 'C, d and F'],
    function (i) { return i === wavePick; },
    function (i) { wavePick = i; S.waves = WAVESETS[i]; wireChips(); render(); });
}

function wire(id, fn) { var b = $(id); if (b) b.addEventListener('click', fn); }

/* dragging a surface on the bench */
function wireBenchDrag() {
  var cv = $('bench'), drag = null;
  cv.addEventListener('pointerdown', function (ev) {
    var b = O.buildSys(S.cur.surf, S.cfg.aperture, S.cfg.field);
    if (!b.par) return;
    var r = cv.getBoundingClientRect();
    var x = ev.clientX - r.left, y = ev.clientY - r.top;
    var zimg = b.zLast + b.par.bfl + S.cur.defocus + focusMm(b);
    var L = zimg - b.zStart;
    var sc = Math.min((r.width - 26) / Math.max(L, 1e-6), 1e9);
    var padX = (r.width - L * sc) / 2;
    var best = -1, bd = 1e9;
    for (var i = 0; i < b.surf.length; i++) {
      var sx = padX + (b.zs[i] - b.zStart) * sc;
      var d = Math.abs(sx - x);
      if (d < bd) { bd = d; best = i; }
    }
    if (bd > Math.max(14, r.width * 0.03)) return;
    S.sel = best;
    drag = { i: best, y: y, c: S.cur.surf[best].c,
             k: 1 / (r.height * 0.45 * (S.cfg.aperture * 0.5)) };
    cv.setPointerCapture(ev.pointerId);
    render();
    ev.preventDefault();
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var r = cv.getBoundingClientRect();
    var y = ev.clientY - r.top;
    var h = S.cfg.aperture * 0.5 + 0.3;
    var cmax = 0.9 / h;
    S.cur.surf[drag.i].c = O.clamp(drag.c + (drag.y - y) * drag.k * 1.4, -cmax, cmax);
    render();
  });
  cv.addEventListener('pointerup', function () { drag = null; });
  cv.addEventListener('pointercancel', function () { drag = null; });
}

/* ---------------- the quiet benchmark ---------------- */

function benchmark() {
  var n = 10, i = 0, sStart = 0, sEnd = 0, lim = 0, worst = 0, r = O.rng(0x51ce0f5);
  function step() {
    if (i >= n) {
      $('benchOut').textContent =
        'Measured rather than asserted: ten more commissions were dealt at random after this page ' +
        'loaded and cut exactly the same way. The first drafts blurred a point to ' +
        (sStart / n * 1000).toFixed(1) + ' µm on axis on average; the finished lenses blur it to ' +
        (sEnd / n * 1000).toFixed(1) + ' µm, which is ' + (worst / n).toFixed(1) +
        ' times the Airy disc on average, and ' + lim + ' of the ten came out inside it. ' +
        'A singlet behind a stop is in that sample and it never gets there, which is the point of it.';
      return;
    }
    var com = makeCommission(O.hash32((r() * 4294967295) >>> 0));
    var cut = cutLens(com, 700);
    if (isFinite(cut.startRms) && isFinite(cut.endRms)) {
      sStart += cut.startRms; sEnd += cut.endRms;
      var airy = 1.22 * 0.0005876 * com.fno;
      var ratio = cut.endRms / airy;
      worst += ratio;
      if (ratio <= 1.0) lim++;
    } else { sStart += 0; sEnd += 0; worst += 1; }
    i++;
    setTimeout(step, 16);
  }
  setTimeout(step, 700);
}

/* ---------------- go ---------------- */

function today() { return new Date(); }

function init() {
  wireChips();
  wireBenchDrag();

  wire('btnRecut', function () {
    var gl = [], el = elementsOf(S.cur.surf), i;
    for (i = 0; i < el.length; i++) gl.push(S.cur.surf[el[i]].gl);
    var com = { form: S.com.form, f: S.cfg.f, fno: S.cfg.f / S.cfg.aperture, field: S.cfg.field, gl: gl };
    var cut = cutLens(com, 1600);
    S.design = { surf: cut.surf, defocus: cut.defocus };
    S.cur = { surf: O.cloneSurf(cut.surf), defocus: cut.defocus };
    S.startRms = cut.startRms; S.endRms = cut.endRms; S.evals = cut.evals;
    S.focusDof = 0; $('focusRange').value = 0;
    buildControls(); render();
    $('cutNote').textContent = 'Re-cut for the glasses now in it: the starting form blurred a point to ' +
      (isFinite(cut.startRms) ? (cut.startRms * 1000).toFixed(1) + ' µm' : 'nothing usable') +
      ' on axis, and ' + cut.evals.toLocaleString() + ' trials later it blurs it to ' +
      (cut.endRms * 1000).toFixed(1) + ' µm.';
  });

  wire('btnRestore', function () {
    S.cur = { surf: O.cloneSurf(S.design.surf), defocus: S.design.defocus };
    S.cfg.aperture = S.cfg.f / S.com.fno;
    S.focusDof = 0;
    buildControls(); render();
  });

  wire('btnNew', function () {
    deal((Math.random() * 4294967295) >>> 0, S.date);
  });
  wire('btnToday', function () {
    S.date = today();
    deal(O.seedForDate(S.date), S.date);
  });
  wire('btnCopy', function () {
    var b = O.buildSys(S.cur.surf, S.cfg.aperture, S.cfg.field);
    if (!b.par) return;
    var txt = S.com.title + '\n' + S.com.maker + ', ' + S.com.town + ', ' + S.com.year +
      '\nEFL ' + b.par.f.toFixed(2) + ' mm, f/' + (b.par.f / S.cfg.aperture).toFixed(2) +
      ', semi-field ' + S.cfg.field.toFixed(2) + ' deg\n\n' + prescription(b) + '\n';
    var self = this;
    function done() { self.textContent = 'Copied'; setTimeout(function () { self.textContent = 'Copy the prescription'; }, 1400); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { });
    } else {
      var ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { }
      document.body.removeChild(ta);
    }
  });

  $('apRange').addEventListener('input', function () {
    S.cfg.aperture = S.cfg.f / parseFloat(this.value);
    render();
  });
  $('focusRange').addEventListener('input', function () {
    S.focusDof = parseFloat(this.value);
    render();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.target && /input|select|textarea/i.test(ev.target.tagName)) return;
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    var d = new Date(S.date.getTime());
    d.setDate(d.getDate() + (ev.key === 'ArrowRight' ? 1 : -1));
    S.date = d;
    deal(O.seedForDate(d), d);
    ev.preventDefault();
  });

  window.addEventListener('resize', function () { render(); });

  S.date = today();
  deal(O.seedForDate(S.date), S.date);
  benchmark();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
