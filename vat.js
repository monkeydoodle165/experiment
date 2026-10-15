/* drift.quibo.games — The Vat
   Colour matching in a dye-house. The day's number sets up a wool dyer somewhere in Britain
   between 1745 and 1835, stocks a cupboard with five natural dyestuffs, and has a draper send
   in a pattern: a snip of cloth to be matched for a coat, a habit or a set of curtains. The
   pattern was dyed from the same cupboard, so a perfect match exists. Pick a mordant, weigh
   the dyes into the pot and dip test skeins (eight of them) until you dare dye the piece.

   The colour is computed, not painted. Every dye has an absorption spectrum; the mordant
   shifts, sharpens or saddens it; the dyes in the pot add up as Kubelka-Munk K/S, which gives
   a reflectance curve from 400 to 700 nm. That curve is lit by daylight (CIE D65) or by a
   candle (a black body near 1850 K), seen through the CIE 1931 observer, and compared with the
   pattern by CIEDE2000. Two curves can look the same by day and part company by candle.
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
    var h = s ^ 0x3c6ef372;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mix(a, b) { var h = Math.imul((a ^ 0x9e3779b9) >>> 0, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 2246822519); h ^= h >>> 15; return h >>> 0; }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(d) { return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function numw(n) { return n < NUMW.length ? NUMW[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function $(id) { return document.getElementById(id); }

  /* ---------- light and the eye ---------- */
  var WL = [];
  for (var w = 400; w <= 700; w += 10) WL.push(w);
  var NW = WL.length;

  /* CIE 1931 2° observer, the multi-lobe Gaussian fit of Wyman, Sloan and Shirley (2013) */
  function g(x, mu, s1, s2) { var t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
  var XB = WL.map(function (l) { return 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2); });
  var YB = WL.map(function (l) { return 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1); });
  var ZB = WL.map(function (l) { return 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8); });

  /* CIE D65 at 10 nm, 400 to 700 */
  var D65 = [82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35, 107.80, 104.79, 107.69,
    104.41, 104.05, 100.00, 96.33, 95.79, 88.69, 90.01, 89.60, 87.70, 83.29, 83.70, 80.03, 80.21, 82.28, 78.28, 69.72, 71.61];
  /* a candle flame, taken as a black body at 1850 K */
  function planck(l, T) { var m = l * 1e-9; return 1 / (Math.pow(m, 5) * (Math.exp(0.014388 / (m * T)) - 1)); }
  var CANDLE = (function () { var a = WL.map(function (l) { return planck(l, 1850); }), k = 100 / a[16]; return a.map(function (v) { return v * k; }); })();

  function lightOf(spd) {
    var n = 0, Xw = 0, Zw = 0;
    for (var i = 0; i < NW; i++) { n += spd[i] * YB[i]; Xw += spd[i] * XB[i]; Zw += spd[i] * ZB[i]; }
    return { spd: spd, n: n, white: [Xw / n, 1, Zw / n] };
  }
  var DAY = lightOf(D65), CAN = lightOf(CANDLE);

  function xyz(R, L) {
    var X = 0, Y = 0, Z = 0;
    for (var i = 0; i < NW; i++) { var e = R[i] * L.spd[i]; X += e * XB[i]; Y += e * YB[i]; Z += e * ZB[i]; }
    return [X / L.n, Y / L.n, Z / L.n];
  }
  function fLab(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
  function lab(R, L) {
    var c = xyz(R, L), wt = L.white;
    var fx = fLab(c[0] / wt[0]), fy = fLab(c[1] / wt[1]), fz = fLab(c[2] / wt[2]);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function lch(c) { var h = Math.atan2(c[2], c[1]) * 180 / Math.PI; if (h < 0) h += 360; return { L: c[0], C: Math.hypot(c[1], c[2]), h: h }; }

  /* show a colour: Lab (judged against its own light, as an eye adapted to it would) back to sRGB */
  function finv(t) { return t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787; }
  function rgbOf(c, tint) {
    var fy = (c[0] + 16) / 116, fx = fy + c[1] / 500, fz = fy - c[2] / 200;
    var X = 0.95047 * finv(fx), Y = finv(fy), Z = 1.08883 * finv(fz);
    var r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    var lin = [r, gg, b];
    if (tint) lin = [r * tint[0], gg * tint[1], b * tint[2]];
    return lin.map(function (v) {
      v = Math.max(0, Math.min(1, v));
      v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      return Math.round(v * 255);
    });
  }
  var CANDLE_TINT = [1, 0.8, 0.56];
  function css(rgb) { return 'rgb(' + rgb.join(',') + ')'; }

  /* CIEDE2000 */
  function de2000(p, q) {
    var L1 = p[0], a1 = p[1], b1 = p[2], L2 = q[0], a2 = q[1], b2 = q[2], rad = Math.PI / 180, P7 = Math.pow(25, 7);
    var C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, Cb7 = Math.pow(Cb, 7);
    var G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + P7)));
    var a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    function hue(b, a) { if (a === 0 && b === 0) return 0; var h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; }
    var h1p = hue(b1, a1p), h2p = hue(b2, a2p);
    var dLp = L2 - L1, dCp = C2p - C1p, dhp = 0;
    if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
    var Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2, hbp;
    if (C1p * C2p === 0) hbp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
    else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    var T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
    var dTh = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2)), Cbp7 = Math.pow(Cbp, 7);
    var RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + P7));
    var SL = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2)), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
    var RT = -Math.sin(2 * dTh * rad) * RC;
    return Math.sqrt(Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2) + RT * (dCp / SC) * (dHp / SH));
  }

  /* ---------- the dyes ----------
     Each band is [peak nm, width nm, height]; `per` is K/S at the peak for one unit in the pot. */
  var DYES = [
    { id: 'madder', name: 'Madder', src: 'ground root, a Zeeland crop', unit: 'oz', max: 8, step: 0.25, per: 0.85, fam: 'red',
      bands: [[470, 25, 0.3], [512, 26, 0.9], [546, 24, 1]], note: 'Turkey reds on alum, near-scarlet with tin, plums and browns with copperas.' },
    { id: 'cochineal', name: 'Cochineal', src: 'dried insects, by way of Cadiz', unit: 'dr', max: 24, step: 1, per: 0.42, fam: 'red',
      bands: [[492, 24, 0.3], [528, 20, 1], [562, 19, 0.95]], note: 'Crimson on alum; with tin the true scarlet; slate and lilac with copperas. Dear: weighed in drams.' },
    { id: 'weld', name: 'Weld', src: 'the whole dried plant', unit: 'oz', max: 8, step: 0.25, per: 1.0, fam: 'yellow',
      bands: [[392, 28, 1], [438, 20, 0.7]], note: 'The clearest, coolest yellow, and the one for greens over the blue vat.' },
    { id: 'fustic', name: 'Old fustic', src: 'chipped wood, from Jamaica', unit: 'oz', max: 8, step: 0.25, per: 0.8, fam: 'yellow',
      bands: [[405, 34, 1], [455, 24, 0.55], [560, 60, 0.06]], note: 'A warmer, browner yellow than weld; olives and drabs with copperas.' },
    { id: 'quercitron', name: 'Quercitron', src: 'bark of the American black oak', unit: 'oz', max: 4, step: 0.25, per: 1.6, fam: 'yellow',
      bands: [[418, 28, 1], [462, 20, 0.45]], note: 'Bancroft\'s patent bark. Strong, and bright as brass with tin.' },
    { id: 'logwood', name: 'Logwood', src: 'chipped heartwood, from Campeche', unit: 'oz', max: 4, step: 0.25, per: 2.2, fam: 'violet',
      bands: [[548, 50, 1], [600, 38, 0.6]], note: 'Purples and greys on alum, and the cheap black with copperas.' },
    { id: 'indigo', name: 'Indigo', src: 'the blue vat, woad and indigo', unit: 'dips', max: 8, step: 1, per: 1.2, fam: 'blue', vat: true,
      bands: [[540, 40, 0.18], [612, 42, 1], [662, 32, 0.55]], note: 'A vat dye: it takes no mordant and goes on a dip at a time, deeper with every dip.' }
  ];
  var BYID = {};
  DYES.forEach(function (d, i) { d.i = i; BYID[d.id] = d; });

  /* the mordant shifts (sh, nm), widens (w), strengthens (g) and saddens (fl, a flat browning absorption) */
  var MORDANTS = [
    { id: 'alum', name: 'Alum', with: 'alum and cream of tartar', note: 'The plain mordant: clear, true colours.',
      fx: { red: [0, 1, 1, 0], yellow: [0, 1, 1, 0], violet: [0, 1, 1, 0] }, base: 0 },
    { id: 'tin', name: 'Tin', with: 'tin spirits (tin in aqua regia)', note: 'Brightens and pushes reds toward scarlet; hard on the wool.',
      fx: { red: [-14, 0.9, 1.15, 0], yellow: [-4, 0.95, 1.3, 0], violet: [12, 1, 1, 0] }, base: 0 },
    { id: 'iron', name: 'Copperas', with: 'copperas (green vitriol)', note: 'Saddens everything: browns, olives, slates and blacks.',
      fx: { red: [18, 1.35, 0.85, 0.16], yellow: [10, 1.2, 0.8, 0.22], violet: [15, 1.3, 1.1, 0.55] }, base: 0.03 }
  ];
  var MBYID = {};
  MORDANTS.forEach(function (m) { MBYID[m.id] = m; });

  /* undyed scoured wool: creamy, a little yellow */
  var WOOL = WL.map(function (l) { var t = Math.max(0, Math.min(1, (l - 400) / 140)); t = t * t * (3 - 2 * t); return 0.5 + 0.32 * t; });
  var KS0 = WOOL.map(function (R) { return (1 - R) * (1 - R) / (2 * R); });

  /* recipe: { m: mordant id, a: { dye id: amount } } -> reflectance curve */
  function reflect(rec) {
    var M = MBYID[rec.m], ks = KS0.slice();
    for (var i = 0; i < NW; i++) ks[i] += M.base * (1 + 0.6 * (700 - WL[i]) / 300);
    Object.keys(rec.a).forEach(function (id) {
      var amt = rec.a[id];
      if (!(amt > 0)) return;
      var d = BYID[id], f = d.vat ? [0, 1, 1, 0] : M.fx[d.fam];
      for (var i = 0; i < NW; i++) {
        var k = 0;
        for (var j = 0; j < d.bands.length; j++) {
          var b = d.bands[j], t = (WL[i] - (b[0] + f[0])) / (b[1] * f[1]);
          k += b[2] * Math.exp(-0.5 * t * t);
        }
        ks[i] += amt * d.per * (f[2] * k + f[3] * (1 + 0.6 * (700 - WL[i]) / 300));
      }
    });
    return ks.map(function (k) { return 1 + k - Math.sqrt(k * k + 2 * k); });
  }
  function look(rec) {
    var R = reflect(rec), ld = lab(R, DAY), lc = lab(R, CAN);
    return { R: R, day: ld, can: lc, rgbD: rgbOf(ld), rgbC: rgbOf(lc, CANDLE_TINT) };
  }

  /* ---------- words for colours ---------- */
  function colourName(c) {
    var o = lch(c), L = o.L, C = o.C, h = o.h, n;
    if (C < 9) n = L > 66 ? 'stone' : L > 42 ? 'dove grey' : L > 24 ? 'slate' : 'black';
    else if (h < 15 || h >= 350) n = L < 38 ? 'claret' : L > 60 ? 'pink' : 'crimson';
    else if (h < 35) n = L < 40 ? 'maroon' : L > 58 ? 'carnation' : 'scarlet';
    else if (h < 55) n = L < 45 ? 'russet' : 'flame';
    else if (h < 75) n = L < 48 ? 'snuff brown' : 'tawny';
    else if (h < 100) n = L < 55 ? 'olive' : C < 30 ? 'straw' : 'gold';
    else if (h < 130) n = L < 58 ? 'olive green' : 'pea green';
    else if (h < 185) n = L < 42 ? 'bottle green' : 'green';
    else if (h < 230) n = 'teal';
    else if (h < 300) n = L < 34 ? 'navy' : 'blue';
    else if (h < 312) n = L < 22 ? 'navy' : 'violet';
    else if (h < 335) n = L < 38 ? 'damson' : 'purple';
    else n = L < 40 ? 'plum' : 'rose';
    var adj = [];
    if (C >= 9 && C < 16) adj.push('sad');
    if (L > 70) adj.push('pale'); else if (L < 30 && n !== 'black' && n !== 'navy') adj.push('dark');
    if (C > 45 && L >= 30) adj.push('bright');
    return adj.concat([n]).join(' ');
  }
  function article(s) { return (/^[aeiou]/.test(s) ? 'an ' : 'a ') + s; }
  function hueWord(h, plus) {
    var sec = Math.floor(((h + 45) % 360) / 90);
    return plus ? ['yellower', 'greener', 'bluer', 'redder'][sec] : ['bluer', 'redder', 'yellower', 'greener'][sec];
  }
  /* how `a` differs from the pattern `b`, in a dyer's words */
  function differs(a, b) {
    var A = lch(a), B = lch(b), out = [];
    var dL = A.L - B.L, dC = A.C - B.C, dh = A.h - B.h;
    if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    var dH = 2 * Math.sqrt(A.C * B.C) * Math.sin(dh * Math.PI / 360);
    var parts = [];
    if (Math.abs(dL) > 1.5) parts.push([Math.abs(dL), dL > 0 ? 'lighter' : 'darker']);
    if (Math.abs(dC) > 2) parts.push([Math.abs(dC) * 0.8, dC > 0 ? 'brighter' : 'sadder']);
    if (Math.abs(dH) > 2 && B.C > 6) parts.push([Math.abs(dH), hueWord(B.h, dh > 0)]);
    parts.sort(function (x, y) { return y[0] - x[0]; });
    parts.forEach(function (p) { out.push((p[0] > 8 ? 'much ' : p[0] < 3.5 ? 'a shade ' : '') + p[1]); });
    return out;
  }
  function listAnd(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  function fmtAmt(d, v) {
    if (d.unit === 'dips') return numw(v) + ' dip' + (v === 1 ? '' : 's');
    if (d.unit === 'dr') return v + ' dr';
    var w = Math.floor(v + 1e-9), q = Math.round((v - w) * 4), fr = ['', '¼', '½', '¾'][q];
    return (w ? w : (fr ? '' : '0')) + fr + ' oz';
  }
  function recipeText(rec) {
    var bits = [];
    DYES.forEach(function (d) { var v = rec.a[d.id]; if (v > 0) bits.push(d.name.toLowerCase() + ' ' + fmtAmt(d, v)); });
    return MBYID[rec.m].name + (bits.length ? '; ' + bits.join(', ') : '; nothing else in the pot');
  }

  /* ---------- the day's dye-house ---------- */
  var HOUSES = [['Stroud', 'on the Frome below Wallbridge', 'Gloucestershire scarlets'], ['Leeds', 'at the bottom of Kirkgate', 'broadcloth for the Cloth Hall'],
    ['Halifax', 'by the Hebble', 'shalloons and kerseys'], ['Norwich', 'on the river at Westwick', 'worsted stuffs'],
    ['Kendal', 'on the Kent by Nether Bridge', 'Kendal cottons and green'], ['Exeter', 'in Exe Island', 'serges for the Dutch trade'],
    ['Trowbridge', 'by the Biss', 'superfine West of England cloth'], ['Frome', 'at Spring Gardens', 'medley cloth'],
    ['Wakefield', 'on the Calder', 'the woollen trade of the Riding'], ['Coventry', 'by the Sherbourne', 'Coventry blue thread'],
    ['Galashiels', 'on the Gala Water', 'Border tweels'], ['Bradford', 'by the Beck', 'worsted pieces for the Piece Hall']];
  var DYERS = ['Jacob Hemmings', 'Thomas Pargeter', 'Samuel Ellwood', 'Josiah Brayshaw', 'Nathaniel Cripps', 'William Lowndes',
    'John Featherstone', 'Isaac Holroyd', 'Edward Pinfold', 'Benjamin Sykes', 'Richard Danvers', 'George Moffat'];
  var DRAPERS = ['Mr Ashworth, woollen draper', 'Messrs Hope and Tetley, mercers', 'Mr Quarrington, tailor and habit-maker',
    'Mrs Dakin, milliner', 'Messrs Gale and Son, drapers', 'Mr Ferrabee, army clothier', 'Mr Lisle, upholder', 'Mr Rowntree, draper'];
  var USES = [['for a coachman\'s livery', 'is worn on the box by day and in the hall by candle'],
    ['for a lady\'s riding habit', 'will be seen in the park and again at the assembly that evening'],
    ['for the facings of a militia regiment', 'must match the colonel\'s pattern on parade and at the mess dinner'],
    ['for a clergyman\'s winter coat', 'is worn at the morning service and at evensong'],
    ['for the curtains of a great parlour', 'hang in daylight and are drawn at dusk'],
    ['for a waistcoat for the assembly rooms', 'will be judged by candle, but bought by day'],
    ['for a ship-owner\'s greatcoat', 'goes to the counting-house by day and the club by night'],
    ['to piece out a damaged suit of hangings', 'must sit beside the old cloth in every light']];

  function makeDay(date) {
    var r = rng(mix(seedForDate(date), 45));
    var house = pick(r, HOUSES), dyer = pick(r, DYERS), draper = pick(r, DRAPERS), use = pick(r, USES);
    var year = 1745 + Math.floor(r() * 91);
    var target = null, lk = null, tries = 0;
    while (tries++ < 200) {
      var u = r(), m = u < 0.5 ? 'alum' : u < 0.75 ? 'tin' : 'iron';
      var nD = r() < 0.55 ? 2 : 3;
      var fams = shuffle(r, ['red', 'yellow', 'violet', 'blue']).slice(0, nD), a = {};
      fams.forEach(function (f) {
        var opts = DYES.filter(function (d) { return d.fam === f; }), d = pick(r, opts);
        var steps = Math.round(d.max / d.step), k = Math.max(1, Math.round(steps * (0.08 + 0.55 * r() * r() + 0.1 * r())));
        a[d.id] = k * d.step;
      });
      var rec = { m: m, a: a };
      lk = look(rec);
      var o = lch(lk.day);
      if (o.L < 20 || o.L > 82 || o.C < 6) continue;
      target = rec; break;
    }
    /* the cupboard: the pattern's dyes, made up to five */
    var ids = Object.keys(target.a), rest = shuffle(r, DYES.map(function (d) { return d.id; }).filter(function (id) { return ids.indexOf(id) < 0; }));
    while (ids.length < 5) ids.push(rest.shift());
    var cupboard = DYES.filter(function (d) { return ids.indexOf(d.id) >= 0; });
    return { date: date, house: house, dyer: dyer, draper: draper, use: use, year: year, target: target, look: lk,
      name: colourName(lk.day), cupboard: cupboard };
  }

  /* ---------- the master's fitting: a pattern search over amounts ---------- */
  function fit(m, ids, goal, r) {
    function cost(x) {
      var a = {}; ids.forEach(function (id, i) { a[id] = x[i]; });
      var L = look({ m: m, a: a });
      return goal(L);
    }
    var best = null, bestC = Infinity;
    for (var s = 0; s < 6; s++) {
      var x = ids.map(function (id) { return BYID[id].max * (0.05 + 0.6 * r()); }), c = cost(x);
      var stepF = 0.25;
      for (var it = 0; it < 300 && stepF > 1 / 600; it++) {
        var moved = false;
        for (var i = 0; i < x.length; i++) {
          var mx = BYID[ids[i]].max;
          for (var sg = -1; sg <= 1; sg += 2) {
            var y = x.slice(); y[i] = Math.max(0, Math.min(mx, y[i] + sg * stepF * mx));
            var cy = cost(y);
            if (cy < c - 1e-6) { x = y; c = cy; moved = true; break; }
          }
        }
        if (!moved) stepF /= 2;
      }
      if (c < bestC) { bestC = c; best = x; }
    }
    var a = {}; ids.forEach(function (id, i) { a[id] = best[i]; });
    return { rec: { m: m, a: a }, cost: bestC };
  }
  /* a rival house matches the pattern by daylight with one dye swapped for its cousin */
  function rivalMatch(D) {
    var r = rng(mix(seedForDate(D.date), 4545));
    var ids = Object.keys(D.target.a), best = null;
    ids.forEach(function (id, k) {
      var d = BYID[id];
      var cousins = DYES.filter(function (e) { return e.id !== id && (e.fam === d.fam || (d.fam === 'violet' && e.fam === 'blue') || (d.fam === 'blue' && e.fam === 'violet')); });
      cousins.forEach(function (c) {
        if (ids.indexOf(c.id) >= 0) return;
        var set = ids.slice(); set[k] = c.id;
        var f = fit(D.target.m, set, function (L) { return de2000(L.day, D.look.day); }, r);
        var L = look(f.rec);
        var res = { rec: f.rec, look: L, dDay: de2000(L.day, D.look.day), dCan: de2000(L.can, D.look.can), from: d, to: c };
        res.score = res.dDay * 3 - res.dCan;
        if (!best || res.score < best.score) best = res;
      });
    });
    return best;
  }

  /* ---------- state ---------- */
  var MAXTESTS = 8;
  var dayOff = 0, D = null, pot = null, tests = [], done = false;

  function load() {
    D = makeDay(dateFor(dayOff));
    pot = { m: 'alum', a: {} };
    D.cupboard.forEach(function (d) { pot.a[d.id] = 0; });
    tests = []; done = false;
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('dayOut').textContent = longDate(D.date) + (dayOff === 0 ? ' (today)' : '');
    $('plWho').textContent = D.dyer + ', dyer · ' + D.house[0] + ', ' + D.year;
    $('plName').textContent = 'A pattern of ' + D.name;
    $('plBlurb').innerHTML = 'A dye-house ' + esc(D.house[1]) + ', working mostly for ' + esc(D.house[2]) + '. This morning ' +
      esc(D.draper) + ' sent in a snip of cloth to be matched ' + esc(D.use[0]) + ', and it ' + esc(D.use[1]) +
      ', so <b>it must match by daylight and by candle</b>. The pattern was dyed in a house with the same cupboard as this one, so the match is there to be found. ' +
      'You have wool for <b>' + numw(MAXTESTS) + ' test skeins</b> before the piece goes in.';
    buildCupboard();
    renderPattern();
    renderTests();
    renderButtons();
  }

  function buildCupboard() {
    var mh = '';
    MORDANTS.forEach(function (m) {
      mh += '<button type="button" class="chip' + (pot.m === m.id ? ' on' : '') + '" data-m="' + m.id + '" title="' + esc(m.note) + '">' + esc(m.name) + '</button>';
    });
    $('mordants').innerHTML = mh;
    $('mordNote').textContent = MBYID[pot.m].note + ' Mordanted with ' + MBYID[pot.m].with + '.';
    var h = '';
    D.cupboard.forEach(function (d) {
      h += '<div class="dye"><div class="dye-top"><span class="dye-dot" style="background:' + css(look({ m: 'alum', a: oneOf(d) }).rgbD) + '"></span>' +
        '<b>' + esc(d.name) + '</b><span class="dye-src">' + esc(d.src) + '</span><output id="o_' + d.id + '">' + fmtAmt(d, pot.a[d.id]) + '</output></div>' +
        '<input type="range" id="s_' + d.id + '" min="0" max="' + d.max + '" step="' + d.step + '" value="' + pot.a[d.id] + '" aria-label="' + esc(d.name) + ', ' + (d.unit === 'dips' ? 'dips in the vat' : d.unit === 'dr' ? 'drams to the pound' : 'ounces to the pound') + '">' +
        '<p class="dye-note">' + esc(d.note) + '</p></div>';
    });
    $('cupboard').innerHTML = h;
    D.cupboard.forEach(function (d) {
      $('s_' + d.id).addEventListener('input', function (e) {
        pot.a[d.id] = parseFloat(e.target.value);
        $('o_' + d.id).textContent = fmtAmt(d, pot.a[d.id]);
        $('potLine').textContent = 'In the pot, to the pound of wool: ' + recipeText(pot) + '.';
      });
    });
    $('potLine').textContent = 'In the pot, to the pound of wool: ' + recipeText(pot) + '.';
  }
  function oneOf(d) { var a = {}; a[d.id] = d.max * 0.4; return a; }
  $('mordants').addEventListener('click', function (e) {
    var b = e.target.closest('[data-m]'); if (!b || done) return;
    pot.m = b.getAttribute('data-m');
    Array.prototype.forEach.call($('mordants').children, function (c) { c.classList.toggle('on', c.getAttribute('data-m') === pot.m); });
    $('mordNote').textContent = MBYID[pot.m].note + ' Mordanted with ' + MBYID[pot.m].with + '.';
    $('potLine').textContent = 'In the pot, to the pound of wool: ' + recipeText(pot) + '.';
  });

  function skein(rgb, cls) { return '<span class="skein' + (cls ? ' ' + cls : '') + '" style="background-color:' + css(rgb) + '"></span>'; }

  function renderPattern() {
    var last = tests.length ? tests[tests.length - 1] : null;
    function card(title, pat, mine, de) {
      return '<div class="lightcard"><h5>' + title + '</h5><div class="pair">' + skein(pat, 'big') +
        (mine ? skein(mine, 'big') : '<span class="skein big empty">no test yet</span>') + '</div>' +
        '<div class="pairlab"><span>pattern</span><span>' + (mine ? 'test ' + tests.length + (de != null ? ' · ΔE ' + de.toFixed(1) : '') : '') + '</span></div></div>';
    }
    $('pattern').innerHTML = card('By daylight', D.look.rgbD, last && last.look.rgbD, last && last.dDay) +
      card('By candle', D.look.rgbC, last && last.look.rgbC, last && last.dCan);
  }

  function remark(t) {
    if (Math.max(t.dDay, t.dCan) < 1) return 'The master holds them to the window and then to the candle, and cannot tell them apart.';
    var dw = differs(t.look.day, D.look.day), s;
    if (t.dDay < 1) s = 'By daylight it is the pattern to the eye.';
    else s = 'By daylight it is ' + (dw.length ? listAnd(dw) : 'off, though it is hard to say how') + ' than the pattern.';
    if (t.dCan > t.dDay + 1.5 && t.dCan > 2) {
      var cw = differs(t.look.can, D.look.can);
      s += ' By candle the two part company: yours goes ' + (cw.length ? listAnd(cw) : 'off') + '.';
    } else if (t.dDay >= 1) {
      var cw2 = differs(t.look.can, D.look.can);
      if (cw2.length) s += ' By candle, ' + listAnd(cw2) + '.';
    }
    return s;
  }

  function renderTests() {
    var h = '';
    tests.forEach(function (t, i) {
      h += '<li class="hank"><div class="hank-sw">' + skein(D.look.rgbD, 'sm') + skein(t.look.rgbD, 'sm') + '<i></i>' + skein(D.look.rgbC, 'sm') + skein(t.look.rgbC, 'sm') + '</div>' +
        '<div class="hank-txt"><b>Test ' + (i + 1) + '.</b> ' + esc(recipeText(t.rec)) + '. <span class="de">ΔE by day ' + t.dDay.toFixed(1) + ', by candle ' + t.dCan.toFixed(1) + '</span>' +
        '<p>' + esc(remark(t)) + '</p></div></li>';
    });
    $('tests').innerHTML = h || '<li class="formula">No skeins on the pole yet. Weigh something into the pot and dip one.</li>';
    $('count').textContent = (MAXTESTS - tests.length) + ' of ' + MAXTESTS + ' test skeins left';
  }
  function renderButtons() {
    $('btnTest').disabled = done || tests.length >= MAXTESTS;
    $('btnTest').textContent = tests.length >= MAXTESTS ? 'No test wool left' : 'Dip a test skein';
    $('btnPiece').disabled = done;
    $('btnEmpty').disabled = done;
  }

  function snapshot() {
    var a = {}; Object.keys(pot.a).forEach(function (k) { if (pot.a[k] > 0) a[k] = pot.a[k]; });
    var rec = { m: pot.m, a: a }, L = look(rec);
    return { rec: rec, look: L, dDay: de2000(L.day, D.look.day), dCan: de2000(L.can, D.look.can) };
  }

  $('btnTest').addEventListener('click', function () {
    if (done || tests.length >= MAXTESTS) return;
    tests.push(snapshot());
    renderPattern(); renderTests(); renderButtons();
    $('msg').textContent = '';
  });
  $('btnEmpty').addEventListener('click', function () {
    if (done) return;
    D.cupboard.forEach(function (d) { pot.a[d.id] = 0; });
    buildCupboard();
  });
  $('btnPiece').addEventListener('click', function () { if (!done) finish(snapshot(), false); });
  $('btnGive').addEventListener('click', function () {
    if (done) return;
    var L = D.look;
    finish({ rec: D.target, look: L, dDay: 0, dCan: 0 }, true);
  });

  function finish(t, gave) {
    done = true;
    var worst = Math.max(t.dDay, t.dCan), v = $('verdict'), grade, cls;
    if (gave) { grade = 'The master dyed it himself from his own book. Take the recipe below and see how close your tests came.'; cls = 'warn'; }
    else if (worst < 1) { grade = 'The draper lays the piece beside his pattern at the window and again by candle, and pays without a word.'; cls = 'good'; }
    else if (worst < 2.5) { grade = 'A good match. A draper with a sharp eye might see it side by side, and nobody else will.'; cls = 'good'; }
    else if (worst < 5) { grade = 'It passes across a room, but laid on the pattern it shows. The draper takes it at a discount.'; cls = 'warn'; }
    else { grade = 'The draper sends it back. It will have to be stripped and dyed over darker, or sold as seconds.'; cls = 'warn'; }
    v.className = 'verdict ' + cls;
    v.innerHTML = '<p><b>' + (gave ? 'The master\'s piece.' : 'The piece is dyed: ' + esc(colourName(t.look.day)) + '.') + '</b> ' +
      (gave ? '' : 'ΔE against the pattern ' + t.dDay.toFixed(1) + ' by daylight and ' + t.dCan.toFixed(1) + ' by candle, after ' + numw(tests.length) + ' test skein' + (tests.length === 1 ? '' : 's') + '.') + '</p><p>' + grade + '</p>';
    reveal(t, gave);
    renderButtons();
  }

  /* ---------- the reveal: the master's book, the curves, and the rival's metamer ---------- */
  function reveal(t, gave) {
    var rival = rivalMatch(D);
    var o = '<h5>The master\'s book</h5><p class="formula">The pattern was dyed: <b>' + esc(recipeText(D.target)) + '</b>, to the pound of wool.' +
      (gave ? '' : ' Yours: <b>' + esc(recipeText(t.rec)) + '</b>.') + '</p>';
    o += '<h5>What the cloth does to the light</h5>' + chart(t, gave, rival);
    o += '<p class="formula">Each curve is the share of light the cloth sends back at each wavelength, from violet at the left to deep red at the right. ' +
      'The faint bands are the two lights: daylight is nearly even, a candle is almost all red and has very little blue to give.</p>';
    if (rival) {
      var mm = rival.dDay < 2 && rival.dCan > rival.dDay + 1.5;
      o += '<h5>Across the street</h5><p class="formula">A rival house has no ' + esc(rival.from.name.toLowerCase()) + ', and matches the pattern with ' +
        esc(rival.to.name.toLowerCase()) + ' instead: <b>' + esc(recipeText(roundRec(rival.rec))) + '</b>. ' +
        'By daylight it comes to ΔE ' + rival.dDay.toFixed(1) + '; by candle, ΔE ' + rival.dCan.toFixed(1) + '. ' +
        (mm ? 'That is a <b>metamer</b>: a different curve that happens to look the same in one light. It is the dashed line above, crossing the pattern\'s where the eye cannot tell, and the candle finds it out.' :
          rival.dDay >= 2 ? 'Its curve is the dashed line above. The cousin dye cannot be pushed close enough even by day: the shapes of the curves are too different.' :
            'Its curve is the dashed line above. Today the substitute holds up in both lights; the curves are close enough in shape that the candle cannot pull them apart.') + '</p>';
    }
    $('reveal').innerHTML = o; $('reveal').style.display = '';
  }
  function roundRec(rec) {
    var a = {};
    Object.keys(rec.a).forEach(function (id) { var d = BYID[id], v = Math.round(rec.a[id] / d.step) * d.step; if (v > 0) a[id] = v; });
    return { m: rec.m, a: a };
  }

  function chart(t, gave, rival) {
    var W = 640, H = 270, l = 40, rr = 12, tp = 12, bt = 40, iw = W - l - rr, ih = H - tp - bt;
    function X(i) { return l + iw * i / (NW - 1); }
    function Y(v) { return tp + ih * (1 - v); }
    function path(R) { return R.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''); }
    function band(spd, col) {
      var mx = Math.max.apply(null, spd), p = 'M' + l + ' ' + Y(0);
      spd.forEach(function (v, i) { p += 'L' + X(i).toFixed(1) + ' ' + Y(0.35 * v / mx).toFixed(1); });
      return '<path d="' + p + 'L' + (l + iw) + ' ' + Y(0) + 'Z" fill="' + col + '" opacity=".13"/>';
    }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="curves" role="img" aria-label="Reflectance curves of the pattern and the dyed cloth from 400 to 700 nanometres">';
    s += '<defs><linearGradient id="spec" x1="0" x2="1"><stop offset="0" stop-color="#6a3cff"/><stop offset=".17" stop-color="#2f6bff"/><stop offset=".33" stop-color="#18c5d8"/>' +
      '<stop offset=".5" stop-color="#5bd649"/><stop offset=".63" stop-color="#e8e23a"/><stop offset=".75" stop-color="#ff9a2e"/><stop offset="1" stop-color="#d4202a"/></linearGradient></defs>';
    s += band(D65, '#cfe3ff') + band(CANDLE, '#ffb15c');
    for (var gy = 0; gy <= 1.0001; gy += 0.25) s += '<line x1="' + l + '" x2="' + (l + iw) + '" y1="' + Y(gy) + '" y2="' + Y(gy) + '" stroke="rgba(255,255,255,.08)"/><text x="' + (l - 6) + '" y="' + (Y(gy) + 4) + '" text-anchor="end">' + Math.round(gy * 100) + '%</text>';
    [400, 450, 500, 550, 600, 650, 700].forEach(function (wv) { var i = (wv - 400) / 10; s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + wv + '</text>'; });
    s += '<rect x="' + l + '" y="' + (tp + ih + 4) + '" width="' + iw + '" height="6" rx="2" fill="url(#spec)"/>';
    s += '<path d="' + path(WOOL) + '" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1" stroke-dasharray="2 4"/>';
    if (rival) s += '<path d="' + path(rival.look.R) + '" fill="none" stroke="' + css(rival.look.rgbD) + '" stroke-width="2" stroke-dasharray="7 5"/>';
    s += '<path d="' + path(D.look.R) + '" fill="none" stroke="#e8edf5" stroke-width="4" opacity=".9"/><path d="' + path(D.look.R) + '" fill="none" stroke="' + css(D.look.rgbD) + '" stroke-width="2.4"/>';
    if (!gave) s += '<path d="' + path(t.look.R) + '" fill="none" stroke="#64f0c8" stroke-width="2"/>';
    s += '</svg>';
    s += '<div class="legend"><span><i style="background:#e8edf5"></i>the pattern</span>' + (gave ? '' : '<span><i style="background:#64f0c8"></i>your piece</span>') +
      (rival ? '<span><i class="dash"></i>the rival\'s match</span>' : '') + '<span><i class="dot"></i>undyed wool</span>' +
      '<span><i style="background:#cfe3ff;opacity:.6"></i>daylight</span><span><i style="background:#ffb15c;opacity:.6"></i>candle</span></div>';
    return s;
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

  load();
})();
