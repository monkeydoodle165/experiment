/* drift.quibo.games — The Plate
   A wet-collodion portrait studio: a glasshouse on the top floor of a shop in an English or Scottish town,
   in a year between 1854 and 1880, on today's calendar date. The day's number picks the town (and with it
   the latitude, so how high the sun gets today, and how much smoke hangs over the roof), the hour of the
   sitting, the weather that passes over the glass, how warm the darkroom is, how tired the silver bath has
   grown, and the sitter: who they are, what they are wearing, how long they can keep still against the
   head-rest and how long they will wait.

   The plate is a collodion positive on glass (an ambrotype): the silver that develops where light fell looks
   pale against a black backing. Collodion sees almost nothing but blue and violet, so a scarlet tunic comes
   out black, blue eyes come out pale, and a ruddy face comes out darker than it looked. The exposure is the
   light from the sky through the roof, integrated over the seconds the lens is open, scaled by the stop and
   the speed of the plate (temperature, the bath, a plate pulled from the bath too soon). The sitter sways a
   little more with every second; the page records the sway and the light together and builds the image
   from both. Development brings the image up and, left too long, fogs it. A plate left waiting too long
   between bath and developer dries at the edges. Self-contained. */
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
    var h = s ^ 0x5b1d3c29;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { return (r() + r() + r() + r() - 2) * 1.7; }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function mmss(t) { t = Math.max(0, Math.round(t)); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function rgb(c, k) { k = k === undefined ? 1 : k; return 'rgb(' + Math.round(clamp(c[0] * k, 0, 255)) + ',' + Math.round(clamp(c[1] * k, 0, 255)) + ',' + Math.round(clamp(c[2] * k, 0, 255)) + ')'; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function $(id) { return document.getElementById(id); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

  /* smooth seeded value noise in one dimension, roughly -1..1 */
  function noise1(r) {
    var N = 512, v = new Float32Array(N);
    for (var i = 0; i < N; i++) v[i] = r() * 2 - 1;
    return function (x) {
      var i0 = Math.floor(x), f = x - i0, s = f * f * (3 - 2 * f);
      var a = v[((i0 % N) + N) % N], b = v[(((i0 + 1) % N) + N) % N];
      return a + (b - a) * s;
    };
  }

  /* ---------- the plate and the studio ---------- */
  var PW = 240, PH = 312;              // the plate, in pixels (a quarter plate stood upright)
  var FAST = 8;                        // studio seconds per real second, except while the lens is open or the developer is on
  var STOPS = [3.6, 5, 7, 10];         // a Petzval portrait lens and its Waterhouse stops
  var BOOK = 3;                        // the book's exposure: seconds at f/3.6 under a bright midsummer sky, fresh bath, 62°F
  var MAXPLATES = 4;
  var G = 2.16;                        // how fast density builds with exposure
  var T_COAT = 50, T_CARRY = 25, T_FIX = 60, T_BATH_MIN = 180;

  var TOWNS = [
    { name: 'Brighton', lat: 50.8, street: 'King’s Road', smoke: 0.96 },
    { name: 'Hastings', lat: 50.86, street: 'Robertson Street', smoke: 0.97 },
    { name: 'Bath', lat: 51.38, street: 'Milsom Street', smoke: 0.9 },
    { name: 'Cheltenham', lat: 51.9, street: 'the Promenade', smoke: 0.94 },
    { name: 'Norwich', lat: 52.63, street: 'London Street', smoke: 0.88 },
    { name: 'Chester', lat: 53.19, street: 'Eastgate Street', smoke: 0.88 },
    { name: 'Leeds', lat: 53.8, street: 'Briggate', smoke: 0.7 },
    { name: 'York', lat: 53.96, street: 'Coney Street', smoke: 0.87 },
    { name: 'Scarborough', lat: 54.28, street: 'Huntriss Row', smoke: 0.96 },
    { name: 'Whitby', lat: 54.49, street: 'Flowergate', smoke: 0.95 },
    { name: 'Edinburgh', lat: 55.95, street: 'Princes Street', smoke: 0.78 },
    { name: 'Aberdeen', lat: 57.15, street: 'Union Street', smoke: 0.9 }
  ];
  var SURNAMES = ['Ashdown', 'Pellow', 'Garnett', 'Rudd', 'Marchbank', 'Tolley', 'Fairweather', 'Hebden', 'Kitching', 'Lowther', 'Orchard', 'Pybus', 'Quarrie', 'Sowerby', 'Tennant', 'Varley', 'Bramwell', 'Dunnett', 'Ellerby', 'Gedge', 'Hoskins', 'Inchbald', 'Jessop', 'Lumb'];
  var BOYS = ['Arthur', 'Albert', 'Frederick', 'Walter', 'Herbert', 'Alfred', 'Ernest', 'Harry'];
  var GIRLS = ['Ellen', 'Harriet', 'Louisa', 'Emily', 'Ada', 'Martha', 'Clara', 'Fanny'];
  var BRIGS = ['Good Intent', 'Brothers', 'Mary Ann', 'Providence', 'Hopewell', 'Friends’ Goodwill', 'Industry'];
  var REGTS = ['the 33rd Foot', 'the 19th Foot', 'the 42nd Highlanders', 'the 7th Fusiliers', 'the 55th Foot', 'the 93rd Highlanders'];

  /* colours are what the eye sees; the plate sees mostly the blue */
  var C = {
    black: [26, 24, 28], crape: [18, 18, 20], white: [236, 232, 222], linen: [226, 220, 204],
    buff: [200, 170, 110], crimson: [140, 30, 36], dove: [150, 150, 158], navy: [30, 40, 92],
    scarlet: [172, 30, 26], brass: [204, 168, 64], gold: [201, 162, 58], belt: [234, 231, 220],
    paleblue: [165, 190, 226], lilac: [182, 152, 202], rose: [216, 142, 150], muslin: [236, 233, 224],
    apple: [140, 182, 108], mauve: [142, 70, 162], tartan: [44, 82, 54], skyfrock: [140, 182, 222],
    plum: [92, 40, 70], brown: [96, 62, 40]
  };
  var KINDS = [
    { k: 'alderman', male: true, hold: 22, patience: 40, fussy: 68, figure: 0.9, price: 'half a guinea for the plate in a morocco case' },
    { k: 'bride', male: false, hold: 14, patience: 34, fussy: 72, figure: 0.6, price: 'five shillings and the case with the gilt mat' },
    { k: 'captain', male: true, hold: 26, patience: 44, fussy: 62, figure: 0.5, price: 'three and sixpence, cased' },
    { k: 'soldier', male: true, hold: 18, patience: 30, fussy: 58, figure: 0.7, price: 'half a crown, in a plain case for the post' },
    { k: 'widow', male: false, hold: 30, patience: 45, fussy: 66, figure: 0.4, price: 'four shillings, in a case lined with black velvet' },
    { k: 'child', male: true, hold: 5, patience: 24, fussy: 50, figure: 0.2, price: 'half a crown, and a sugar mouse for the sitter' },
    { k: 'curate', male: true, hold: 20, patience: 38, fussy: 64, figure: 0.5, price: 'three shillings, cased' }
  ];
  var SKINS = [[224, 182, 152], [214, 168, 140], [204, 152, 124], [230, 190, 164]];
  var HAIRS = { black: [32, 26, 24], brown: [92, 62, 42], auburn: [142, 70, 40], fair: [192, 162, 112], grey: [164, 160, 154] };

  /* how the plate sees a colour: almost all blue, a little green, next to no red */
  function blueOf(c) {
    var e = (0.05 * c[0] + 0.30 * c[1] + 1.0 * c[2]) / (1.35 * 255);
    return Math.pow(clamp(e, 0, 1), 1.6);
  }

  /* ---------- the day ---------- */
  function build(seed, date) {
    var r = rng(seed);
    var D = { seed: seed, date: date };
    D.year = 1854 + Math.floor(r() * 27);
    D.town = pick(r, TOWNS);
    D.operator = pick(r, SURNAMES);
    var doy = Math.floor((new Date(2001, date.getMonth(), date.getDate()) - new Date(2001, 0, 0)) / 86400000);
    D.doy = doy;
    D.dec = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365);
    D.hour = 10 + Math.floor(r() * 10) * 0.5;          // 10:00 to 14:30
    // weather over the roof
    var month = date.getMonth();
    var wet = month >= 9 || month <= 2;
    var wx = r();
    D.weather = wx < (wet ? 0.12 : 0.25) ? 'clear' : wx < (wet ? 0.38 : 0.6) ? 'fair' : wx < (wet ? 0.66 : 0.82) ? 'broken' : wx < (wet ? 0.88 : 0.95) ? 'overcast' : 'dull';
    var W = { clear: [1.0, 0.06, 160], fair: [0.97, 0.26, 70], broken: [0.82, 0.36, 46], overcast: [0.56, 0.12, 150], dull: [0.42, 0.08, 200] }[D.weather];
    D.wBase = W[0]; D.wAmp = W[1]; D.wPeriod = W[2];
    D.n1 = noise1(rng(seed ^ 0x11)); D.n2 = noise1(rng(seed ^ 0x22));
    // the darkroom
    var tout = 50 - 12 * Math.cos(2 * Math.PI * (doy - 15) / 365);
    D.temp = Math.round(clamp(tout + 8 + (r() * 6 - 3), 41, 78));
    D.bathWeeks = Math.floor(r() * 9);
    D.bathSpeed = clamp(1.1 - 0.055 * D.bathWeeks + gauss(r) * 0.03, 0.55, 1.15);
    D.tempSpeed = Math.pow(2, (D.temp - 62) / 18);
    D.tau = 6 * Math.pow(2, (62 - D.temp) / 25);       // development time constant, seconds
    D.dryLimit = clamp(9 * 60 * Math.pow(2, (62 - D.temp) / 20), 4 * 60, 14 * 60);
    // the sitter
    var K = pick(r, KINDS);
    D.kind = K;
    var sur = pick(r, SURNAMES.filter(function (s) { return s !== D.operator; }));
    var skin = pick(r, SKINS), eyes = r() < 0.45 ? [96, 128, 170] : r() < 0.5 ? [92, 66, 46] : [110, 116, 90];
    var hairK = K.k === 'widow' || (K.k === 'alderman' && r() < 0.6) ? 'grey' : pick(r, ['black', 'brown', 'brown', 'auburn', 'fair']);
    if (K.k === 'child') hairK = pick(r, ['fair', 'brown', 'auburn']);
    var P = { skin: skin, eyes: eyes, hair: HAIRS[hairK], hairName: hairK, male: K.male, beard: 'none', child: K.k === 'child' };
    var dressNames;
    if (K.k === 'alderman') {
      P.coat = C.black; P.vestName = pick(r, ['buff', 'crimson', 'dove']); P.vest = C[P.vestName]; P.chain = true; P.shirt = C.white;
      P.beard = pick(r, ['full', 'chops', 'chops', 'none']);
      D.sitter = 'Alderman ' + sur; D.why = 'who wants a likeness in his chain of office for the council chamber';
      dressNames = 'a black broadcloth coat, a ' + { buff: 'buff', crimson: 'crimson', dove: 'dove-grey' }[P.vestName] + ' waistcoat, a white shirt-front and the gold chain';
    } else if (K.k === 'bride') {
      var opts = ['paleblue', 'lilac', 'rose', 'muslin', 'apple'];
      if (D.year >= 1857) opts.push('mauve', 'mauve');
      P.dressName = pick(r, opts); P.dress = C[P.dressName]; P.collar = C.white;
      D.sitter = 'Miss ' + pick(r, GIRLS) + ' ' + sur; D.why = 'the week before her wedding';
      dressNames = { paleblue: 'a pale blue silk', lilac: 'a lilac poplin', rose: 'a rose-pink silk', muslin: 'a white muslin', apple: 'an apple-green silk', mauve: 'a new mauve silk, the colour everyone has been wearing since Mr Perkin’s dye' }[P.dressName] + ' with a white lace collar';
    } else if (K.k === 'captain') {
      P.coat = C.navy; P.shirt = C.white; P.brass = true; P.beard = pick(r, ['full', 'chops', 'none']);
      D.sitter = 'Captain ' + sur + ' of the brig <i>' + pick(r, BRIGS) + '</i>'; D.why = 'before he sails, for his wife to keep';
      dressNames = 'a navy blue coat with brass buttons and a black stock';
    } else if (K.k === 'soldier') {
      P.tunic = true; P.coat = C.scarlet;
      D.sitter = 'Corporal ' + sur + ' of ' + pick(r, REGTS); D.why = 'on embarkation leave, for his mother';
      dressNames = 'a scarlet tunic with white cross-belts and brass buttons';
    } else if (K.k === 'widow') {
      P.dress = C.crape; P.dressName = 'crape'; P.cap = true; P.collar = C.white;
      D.sitter = 'Mrs ' + sur; D.why = 'in her first year of mourning';
      dressNames = 'black crape, a white widow’s cap and a narrow white collar';
    } else if (K.k === 'child') {
      P.dressName = pick(r, ['tartan', 'skyfrock', 'plum']); P.dress = C[P.dressName]; P.collar = C.white;
      D.sitter = 'Master ' + pick(r, BOYS) + ' ' + sur + ', aged ' + NUMW[4 + Math.floor(r() * 3)]; D.why = 'brought in by his mother, who is holding him still from behind the chair';
      dressNames = { tartan: 'a green tartan frock', skyfrock: 'a sky-blue frock', plum: 'a plum-coloured velvet suit' }[P.dressName] + ' with a white collar, as small boys wear';
    } else {
      P.coat = C.black; P.shirt = C.white; P.bands = true;
      D.sitter = 'The Reverend Mr ' + sur; D.why = 'for the parishioners he is leaving';
      dressNames = 'a black clerical coat and white bands';
    }
    D.P = P; D.dressNames = dressNames;
    D.backdrop = pick(r, ['park', 'curtain', 'cloth']);
    D.hold = K.hold * (0.8 + r() * 0.4);
    D.patience = K.patience * 60 * (0.85 + r() * 0.3);
    D.fussy = K.fussy;
    D.plateSeeds = [];
    for (var i = 0; i < MAXPLATES; i++) D.plateSeeds.push((r() * 4294967296) >>> 0);
    // the plate's response to the sitter's own colours
    D.effSkin = blueOf(skin);
    var bright = P.shirt || P.collar || (P.tunic ? C.belt : null) || P.dress;
    D.effWhite = blueOf(bright);
    var darks = [P.coat, P.dress, P.vest, P.hair].filter(Boolean).map(blueOf);
    D.effDark = Math.min.apply(null, darks);
    return D;
  }

  /* the sky over the roof, in units of the book's midsummer sky */
  function sunSin(D, t) {
    var h = D.hour + t / 3600, H = (h - 12) * 15 * Math.PI / 180;
    var la = D.town.lat * Math.PI / 180, de = D.dec * Math.PI / 180;
    return Math.max(0.02, Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(H));
  }
  function clearSky(D, t) { return Math.pow(sunSin(D, t) / 0.88, 1.2); }
  function cloud(D, t) {
    var x = t / D.wPeriod;
    return clamp(D.wBase + D.wAmp * (0.65 * D.n1(x) + 0.35 * D.n2(x * 2.7 + 9)), 0.15, 1.25);
  }
  function light(D, t) { return clearSky(D, t) * D.town.smoke * cloud(D, t); }

  /* ---------- drawing the scene in colour ---------- */
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function ell(ctx, x, y, rx, ry, col) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); }
  function poly(ctx, pts, col) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }

  function drawBackdrop(ctx, D) {
    var r = rng(D.seed ^ 0x77);
    if (D.backdrop === 'park') {
      var g = ctx.createLinearGradient(0, 0, 0, PH);
      g.addColorStop(0, '#c4cfd8'); g.addColorStop(0.55, '#aebcc6'); g.addColorStop(1, '#8f9a88');
      ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
      for (var i = 0; i < 14; i++) ell(ctx, r() * PW, 120 + r() * 70, 30 + r() * 40, 24 + r() * 30, rgb([100 + r() * 30, 118 + r() * 25, 86 + r() * 20]));
      ctx.fillStyle = '#cfc6ae'; ctx.fillRect(0, 214, PW, 12);
      for (var b = 6; b < PW; b += 18) { ell(ctx, b, 240, 5, 14, '#c6bca2'); }
      ctx.fillStyle = '#c2b89e'; ctx.fillRect(0, 252, PW, 10);
      ctx.fillStyle = '#8c8270'; ctx.fillRect(0, 262, PW, PH - 262);
    } else if (D.backdrop === 'curtain') {
      ctx.fillStyle = '#6c2426'; ctx.fillRect(0, 0, PW, PH);
      for (var x = -10; x < PW + 20; x += 22) {
        var g2 = ctx.createLinearGradient(x, 0, x + 22, 0);
        g2.addColorStop(0, 'rgba(30,6,8,.45)'); g2.addColorStop(0.5, 'rgba(170,70,70,.25)'); g2.addColorStop(1, 'rgba(30,6,8,.45)');
        ctx.fillStyle = g2; ctx.fillRect(x, 0, 22, PH);
      }
      ctx.fillStyle = '#c0b6a2'; ctx.fillRect(14, 30, 34, PH); ctx.fillStyle = '#d4cab6'; ctx.fillRect(20, 30, 8, PH);
      ctx.fillStyle = '#cbc1ab'; ctx.fillRect(8, 22, 46, 12);
      ctx.fillStyle = '#5a4a3c'; ctx.fillRect(0, 280, PW, PH - 280);
    } else {
      var g3 = ctx.createRadialGradient(PW * 0.45, PH * 0.35, 20, PW * 0.5, PH * 0.5, PH * 0.7);
      g3.addColorStop(0, '#9eaab6'); g3.addColorStop(1, '#6e7884');
      ctx.fillStyle = g3; ctx.fillRect(0, 0, PW, PH);
    }
  }

  function headPos(D) { return D.P.child ? { x: 120, y: 142, s: 0.84 } : { x: 120, y: 112, s: 1 }; }

  function drawBody(ctx, D) {
    var P = D.P, hp = headPos(D), hx = hp.x, s = hp.s, sy = hp.y + 58 * s;
    var main = P.coat || P.dress;
    var sw = (P.male && !P.child ? 76 : 64) * s;
    // the table and the book, at the sitter's right hand (the left of the plate as you look at it, but we draw it at the right)
    ctx.fillStyle = rgb(C.brown, 0.8); ctx.fillRect(hx + 46, PH - 40, PW - hx - 46, 40);
    ctx.fillStyle = rgb([104, 64, 46]); ctx.fillRect(hx + 46, PH - 42, PW - hx - 46, 6);
    ctx.fillStyle = rgb([70, 36, 30]); ctx.fillRect(hx + 62, PH - 54, 50, 14);
    ctx.fillStyle = rgb([210, 196, 160]); ctx.fillRect(hx + 64, PH - 50, 46, 3);
    // torso
    ctx.beginPath();
    ctx.moveTo(hx - sw - 6, PH);
    ctx.lineTo(hx - sw, sy + 34 * s);
    ctx.quadraticCurveTo(hx - sw + 6, sy + 2, hx - 26 * s, sy);
    ctx.lineTo(hx + 26 * s, sy);
    ctx.quadraticCurveTo(hx + sw - 6, sy + 2, hx + sw, sy + 34 * s);
    ctx.lineTo(hx + sw + 6, PH);
    ctx.closePath(); ctx.fillStyle = rgb(main); ctx.fill();
    // the right arm, reaching to the book
    poly(ctx, [hx + sw - 12, sy + 40 * s, hx + sw + 6, sy + 46 * s, hx + 104, PH - 50, hx + 84, PH - 42, hx + sw - 18, PH - 70], rgb(main, 0.86));
    ell(ctx, hx + 96, PH - 50, 13, 8, rgb(P.skin, 0.95));
    ctx.strokeStyle = rgb(P.skin, 0.75); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + 90, PH - 54); ctx.lineTo(hx + 104, PH - 51); ctx.stroke();
    if (P.coat && !P.tunic) {
      if (P.vest) poly(ctx, [hx - 24 * s, sy + 14, hx + 24 * s, sy + 14, hx + 22, PH, hx - 22, PH], rgb(P.vest));
      poly(ctx, [hx - 18 * s, sy - 2, hx + 18 * s, sy - 2, hx, sy + 74 * s], rgb(P.shirt));
      if (P.bands) { ctx.fillStyle = rgb(C.white); ctx.fillRect(hx - 7, sy + 2, 6, 26); ctx.fillRect(hx + 1, sy + 2, 6, 26); }
      else { ell(ctx, hx, sy + 8, 11, 5, rgb(C.black, 0.8)); }
      // lapels
      ctx.strokeStyle = rgb(P.coat, 0.6); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx - 22 * s, sy); ctx.lineTo(hx - 6, sy + 84 * s); ctx.moveTo(hx + 22 * s, sy); ctx.lineTo(hx + 6, sy + 84 * s); ctx.stroke();
      if (P.vest) for (var b = 0; b < 4; b++) ell(ctx, hx, sy + 88 + b * 16, 2.4, 2.4, rgb(P.vest, 0.6));
      if (P.brass) for (var bb = 0; bb < 4; bb++) { ell(ctx, hx - 30, sy + 50 + bb * 22, 3.2, 3.2, rgb(C.brass)); ell(ctx, hx + 30, sy + 50 + bb * 22, 3.2, 3.2, rgb(C.brass)); }
      if (P.chain) {
        ctx.strokeStyle = rgb(C.gold); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(hx - 50, sy + 8); ctx.quadraticCurveTo(hx, sy + 96, hx + 50, sy + 8); ctx.stroke();
        ell(ctx, hx, sy + 58, 9, 11, rgb(C.gold, 1.05));
      }
    } else if (P.tunic) {
      ctx.strokeStyle = rgb(C.belt); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(hx - 58, sy + 12); ctx.lineTo(hx + 50, PH); ctx.moveTo(hx + 58, sy + 12); ctx.lineTo(hx - 50, PH); ctx.stroke();
      ell(ctx, hx, sy + 92, 9, 9, rgb(C.brass));
      for (var t = 0; t < 6; t++) ell(ctx, hx, sy + 16 + t * 22, 2.8, 2.8, rgb(C.brass));
      ctx.fillStyle = rgb(C.navy); ctx.fillRect(hx - 22, sy - 6, 44, 12);
    } else {
      // a dress: pleats, a lace collar, a brooch
      ctx.strokeStyle = rgb(main, 0.82); ctx.lineWidth = 2;
      for (var p = -3; p <= 3; p++) { ctx.beginPath(); ctx.moveTo(hx + p * 9, sy + 34); ctx.lineTo(hx + p * 14, PH); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(hx, sy + 4, 36 * s, 14 * s, 0, 0, Math.PI); ctx.lineWidth = (P.cap ? 5 : 9) * s; ctx.strokeStyle = rgb(P.collar); ctx.stroke();
      if (!P.child) ell(ctx, hx, sy + 18, 5, 6, rgb(P.dressName === 'crape' ? C.crape : C.gold, 0.9));
    }
  }

  function drawHead(ctx, D) {
    var P = D.P, hp = headPos(D), hx = hp.x, hy = hp.y, s = hp.s;
    var skin = P.skin, hair = P.hair;
    // neck
    ctx.fillStyle = rgb(skin, 0.86); ctx.fillRect(hx - 13 * s, hy + 26 * s, 26 * s, 36 * s);
    if (P.male) {
      ell(ctx, hx, hy - 6 * s, 31 * s, 38 * s, rgb(hair));
      ell(ctx, hx - 28 * s, hy + 4 * s, 5 * s, 9 * s, rgb(skin, 0.9)); ell(ctx, hx + 28 * s, hy + 4 * s, 5 * s, 9 * s, rgb(skin, 0.9));
      ell(ctx, hx, hy + 4 * s, 27 * s, 34 * s, rgb(skin));
      // hair over the brow, parted
      ctx.beginPath(); ctx.ellipse(hx, hy - 22 * s, 29 * s, 16 * s, 0, Math.PI, Math.PI * 2); ctx.fillStyle = rgb(hair); ctx.fill();
      poly(ctx, [hx - 29 * s, hy - 22 * s, hx + 6 * s, hy - 22 * s, hx - 22 * s, hy - 12 * s], rgb(hair));
    } else {
      ell(ctx, hx, hy - 4 * s, 33 * s, 40 * s, rgb(hair));
      ell(ctx, hx, hy + 6 * s, 25 * s, 33 * s, rgb(skin));
      ell(ctx, hx - 24 * s, hy, 10 * s, 20 * s, rgb(hair)); ell(ctx, hx + 24 * s, hy, 10 * s, 20 * s, rgb(hair));
      ctx.beginPath(); ctx.ellipse(hx, hy - 20 * s, 27 * s, 18 * s, 0, Math.PI, Math.PI * 2); ctx.fillStyle = rgb(hair); ctx.fill();
      ctx.strokeStyle = rgb(skin, 0.95); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx, hy - 38 * s); ctx.lineTo(hx, hy - 20 * s); ctx.stroke();
    }
    var fy = P.male ? hy + 4 * s : hy + 6 * s;
    // cheeks
    var cg = ctx.createRadialGradient(hx - 14 * s, fy + 10 * s, 1, hx - 14 * s, fy + 10 * s, 11 * s);
    cg.addColorStop(0, 'rgba(214,120,104,.45)'); cg.addColorStop(1, 'rgba(214,120,104,0)');
    ctx.fillStyle = cg; ctx.fillRect(hx - 30 * s, fy - 4 * s, 30 * s, 30 * s);
    var cg2 = ctx.createRadialGradient(hx + 14 * s, fy + 10 * s, 1, hx + 14 * s, fy + 10 * s, 11 * s);
    cg2.addColorStop(0, 'rgba(214,120,104,.45)'); cg2.addColorStop(1, 'rgba(214,120,104,0)');
    ctx.fillStyle = cg2; ctx.fillRect(hx, fy - 4 * s, 30 * s, 30 * s);
    // beard
    if (P.beard === 'full') {
      ctx.beginPath(); ctx.ellipse(hx, fy + 18 * s, 27 * s, 22 * s, 0, 0, Math.PI); ctx.fillStyle = rgb(hair); ctx.fill();
      ctx.fillRect(hx - 27 * s, fy + 2 * s, 8 * s, 18 * s); ctx.fillRect(hx + 19 * s, fy + 2 * s, 8 * s, 18 * s);
      ell(ctx, hx, fy + 20 * s, 9 * s, 4 * s, rgb(skin, 0.9));
    } else if (P.beard === 'chops') {
      ell(ctx, hx - 22 * s, fy + 14 * s, 7 * s, 16 * s, rgb(hair)); ell(ctx, hx + 22 * s, fy + 14 * s, 7 * s, 16 * s, rgb(hair));
    }
    // eyes, brows, nose, mouth
    [-1, 1].forEach(function (k) {
      ell(ctx, hx + k * 10 * s, fy - 2 * s, 4.6 * s, 2.4 * s, rgb([232, 226, 214]));
      ell(ctx, hx + k * 10 * s, fy - 2 * s, 2.2 * s, 2.2 * s, rgb(P.eyes));
      ell(ctx, hx + k * 10 * s, fy - 2 * s, 0.9 * s, 0.9 * s, rgb([20, 16, 14]));
      ctx.strokeStyle = rgb(hair, 0.9); ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(hx + k * 4 * s, fy - 8 * s); ctx.quadraticCurveTo(hx + k * 10 * s, fy - 11 * s, hx + k * 16 * s, fy - 8 * s); ctx.stroke();
    });
    ctx.strokeStyle = rgb(skin, 0.72); ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(hx + 1 * s, fy); ctx.lineTo(hx - 2 * s, fy + 12 * s); ctx.lineTo(hx + 3 * s, fy + 13 * s); ctx.stroke();
    if (P.beard !== 'full') ell(ctx, hx, fy + 20 * s, 7 * s, 2.4 * s, rgb([178, 88, 82]));
    // a widow's cap
    if (P.cap) {
      ctx.beginPath(); ctx.ellipse(hx, hy - 8, 38, 44, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 7; ctx.strokeStyle = rgb(C.white); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx, hy - 12, 34, 38, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.lineWidth = 4; ctx.strokeStyle = rgb(C.crape); ctx.stroke();
    }
  }

  /* light from the glass roof, upper left */
  function shade(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    var g = ctx.createLinearGradient(30, 0, PW, PH * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH); ctx.restore();
  }

  /* Float32 copies, premultiplied, and a three-pass box blur */
  function toF(cv) {
    var d = cv.getContext('2d').getImageData(0, 0, PW, PH).data, n = PW * PH, f = new Float32Array(n * 4);
    for (var i = 0; i < n; i++) {
      var a = d[i * 4 + 3] / 255;
      f[i * 4] = d[i * 4] * a; f[i * 4 + 1] = d[i * 4 + 1] * a; f[i * 4 + 2] = d[i * 4 + 2] * a; f[i * 4 + 3] = a;
    }
    return f;
  }
  function boxPass(src, dst, w, h, rad, horiz) {
    var len = horiz ? w : h, lines = horiz ? h : w, win = rad * 2 + 1;
    for (var L = 0; L < lines; L++) {
      for (var ch = 0; ch < 4; ch++) {
        var acc = 0, k;
        for (k = -rad; k <= rad; k++) { var j = clamp(k, 0, len - 1); acc += src[(horiz ? L * w + j : j * w + L) * 4 + ch]; }
        for (var i = 0; i < len; i++) {
          dst[(horiz ? L * w + i : i * w + L) * 4 + ch] = acc / win;
          var out = clamp(i - rad, 0, len - 1), inn = clamp(i + rad + 1, 0, len - 1);
          acc += src[(horiz ? L * w + inn : inn * w + L) * 4 + ch] - src[(horiz ? L * w + out : out * w + L) * 4 + ch];
        }
      }
    }
  }
  function blur(f, sigma) {
    if (sigma < 0.6) return f;
    var rad = Math.max(1, Math.round(sigma * 0.9)), tmp = new Float32Array(f.length), a = f;
    for (var p = 0; p < 3; p++) { var out = new Float32Array(f.length); boxPass(a, tmp, PW, PH, rad, true); boxPass(tmp, out, PW, PH, rad, false); a = out; }
    return a;
  }

  /* the scene for one stop: background, figure and head, each with its own softness */
  function layers(D, N) {
    var bg = mk(PW, PH), bc = bg.getContext('2d');
    drawBackdrop(bc, D);
    var body = mk(PW, PH), yc = body.getContext('2d');
    drawBody(yc, D); shade(yc);
    var head = mk(PW, PH), hc = head.getContext('2d');
    drawHead(hc, D); shade(hc);
    var rBg = 7 * (3.6 / N), rBody = 2.2 * (3.6 / N);
    var B = blur(toF(bg), rBg), Y = blur(toF(body), rBody), H = toF(head);
    var n = PW * PH, Sx = new Float32Array(n * 4);
    for (var i = 0; i < n * 4; i += 4) {
      var ha = H[i + 3];
      Sx[i] = H[i] + Y[i] * (1 - ha); Sx[i + 1] = H[i + 1] + Y[i + 1] * (1 - ha); Sx[i + 2] = H[i + 2] + Y[i + 2] * (1 - ha);
      Sx[i + 3] = ha + Y[i + 3] * (1 - ha);
    }
    return { bg: B, sitter: Sx, rBody: rBody, rBg: rBg, N: N };
  }
  /* composite with the sitter shifted (dx, dy) pixels; returns rgb 0..255 */
  function composite(Lr, dx, dy, out) {
    var n = PW * PH, B = Lr.bg, Sx = Lr.sitter;
    out = out || new Float32Array(n * 3);
    for (var y = 0; y < PH; y++) {
      var sy = y - dy;
      for (var x = 0; x < PW; x++) {
        var i = y * PW + x, sx = x - dx, r = 0, g = 0, b = 0, a = 0;
        if (sx >= 0 && sx < PW && sy >= 0 && sy < PH) { var j = (sy * PW + sx) * 4; r = Sx[j]; g = Sx[j + 1]; b = Sx[j + 2]; a = Sx[j + 3]; }
        else if (sy >= PH && sx >= 0 && sx < PW) { var j2 = ((PH - 1) * PW + sx) * 4; r = Sx[j2]; g = Sx[j2 + 1]; b = Sx[j2 + 2]; a = Sx[j2 + 3]; }
        out[i * 3] = r + B[i * 4] * (1 - a); out[i * 3 + 1] = g + B[i * 4 + 1] * (1 - a); out[i * 3 + 2] = b + B[i * 4 + 2] * (1 - a);
      }
    }
    return out;
  }

  /* ---------- the plate's chemistry ---------- */
  function devF(td) { return 1 - Math.exp(-td / D.tau); }
  function fogOf(td) { return 0.02 + 0.09 * Math.pow(Math.max(0, td / D.tau - 3.2), 1.25); }
  function toneOf(e, H, td) { var d = 1 - Math.exp(-G * e * H * devF(td)); var f = fogOf(td); return d + f * (1 - d); }

  /* ---------- state ---------- */
  var D, S, Lr, dayOff = 0, raf, last = 0;
  var cv = $('plate'), ctx = cv.getContext('2d');
  var sky = $('sky'), sctx = sky.getContext('2d');
  var ggCanvas = mk(PW, PH), plateCanvas = mk(PW, PH);

  function fresh() {
    S = { phase: 'ready', t: 0, stop: 0, plates: [], cur: null, over: false, why: '' };
  }
  function newPlate() {
    var i = S.plates.length, r = rng(D.plateSeeds[i]);
    return { n: i + 1, r: r, nx: noise1(rng(D.plateSeeds[i] ^ 0x5)), ny: noise1(rng(D.plateSeeds[i] ^ 0x9)), coat: 0, bt: 0, outAt: 0, H: 0, te: 0, samples: [],
      lightSum: 0, stop: STOPS[S.stop], td: 0, fixT: 0, carry: 0 };
  }
  function rateNow(p) {
    var sens = p.bt >= T_BATH_MIN ? 1 : 0.5 + 0.5 * p.bt / T_BATH_MIN;
    return (1 / BOOK) * D.bathSpeed * D.tempSpeed * sens * light(D, S.t) * Math.pow(3.6 / p.stop, 2);
  }
  function sway(p, te) {
    var amp = (D.P.child ? 0.8 : 0.35) * Math.sqrt(te) + 2.4 * Math.pow(te / D.hold, 2);
    return { dx: amp * p.nx(te / 1.7 + 3), dy: 0.6 * amp * p.ny(te / 2.3 + 7) };
  }
  function setStop(i) {
    if (S.stop === i && Lr) return;
    S.stop = i; Lr = layers(D, STOPS[i]);
    var comp = composite(Lr, 0, 0), img = ggCanvas.getContext('2d').createImageData(PW, PH);
    for (var k = 0; k < PW * PH; k++) { img.data[k * 4] = comp[k * 3]; img.data[k * 4 + 1] = comp[k * 3 + 1]; img.data[k * 4 + 2] = comp[k * 3 + 2]; img.data[k * 4 + 3] = 255; }
    ggCanvas.getContext('2d').putImageData(img, 0, 0);
    chips();
  }

  /* when the lens is capped: build the exposure the plate received, sample by sample */
  function bake(p) {
    var tot = 0; p.samples.forEach(function (s) { tot += s.w; });
    var n = PW * PH, E = new Float32Array(n);
    var mx = 0, my = 0;
    p.samples.forEach(function (s) { mx += s.dx * s.w; my += s.dy * s.w; });
    mx /= tot || 1; my /= tot || 1;
    var v = 0; p.samples.forEach(function (s) { v += ((s.dx - mx) * (s.dx - mx) + (s.dy - my) * (s.dy - my)) * s.w; });
    p.rms = Math.sqrt(v / (tot || 1));
    // group the samples into up to sixteen equal shares of the light
    var groups = [], K = Math.min(16, Math.max(1, p.samples.length)), share = tot / K, acc = 0, gx = 0, gy = 0, gw = 0;
    p.samples.forEach(function (s) {
      gx += s.dx * s.w; gy += s.dy * s.w; gw += s.w; acc += s.w;
      if (acc >= share * (groups.length + 1) - 1e-9) { groups.push({ dx: gx / gw, dy: gy / gw, w: gw }); gx = gy = gw = 0; }
    });
    if (gw > 0) groups.push({ dx: gx / gw, dy: gy / gw, w: gw });
    var buf = new Float32Array(n * 3);
    groups.forEach(function (g) {
      composite(Lr, Math.round(g.dx), Math.round(g.dy), buf);
      var k = g.w / (tot || 1);
      for (var i = 0; i < n; i++) {
        var e = (0.05 * buf[i * 3] + 0.30 * buf[i * 3 + 1] + buf[i * 3 + 2]) / (1.35 * 255);
        E[i] += k * Math.pow(e < 0 ? 0 : e > 1 ? 1 : e, 1.6);
      }
    });
    p.E = E;
  }
  /* the faults: dry edges, streaks from a plate lifted too soon, a little dust */
  function faults(p) {
    var n = PW * PH, stain = new Float32Array(n), mark = new Float32Array(n), r = p.r;
    var df = Math.max(0, (p.dryAt - D.dryLimit) / D.dryLimit);
    p.df = df;
    if (df > 0) {
      var w = 10 + 40 * Math.min(1.2, df), nz = noise1(rng(D.plateSeeds[p.n - 1] ^ 0x33));
      for (var y = 0; y < PH; y++) for (var x = 0; x < PW; x++) {
        var de = Math.min(x, y, PW - 1 - x, PH - 1 - y) + (PH - y) * 0.12;   // the bottom corner drains and stays wet longest
        var ww = w * (1 + 0.35 * nz((x + y) / 23));
        stain[y * PW + x] = clamp((ww - de) / 10, 0, 1);
      }
    }
    var k = Math.max(0, 1 - p.bt / T_BATH_MIN);
    p.streak = k;
    if (k > 0) {
      var lines = 3 + Math.floor(r() * 4);
      for (var l = 0; l < lines; l++) {
        var x0 = r() * PW, ph = r() * 6, wd = 1.5 + r() * 2.5;
        for (var yy = 0; yy < PH; yy++) {
          var cx = x0 + 6 * Math.sin(yy / 30 + ph);
          for (var xx = Math.max(0, Math.floor(cx - 8)); xx < Math.min(PW, cx + 8); xx++) {
            var dd = xx - cx; mark[yy * PW + xx] = Math.max(mark[yy * PW + xx], k * Math.exp(-dd * dd / (2 * wd * wd)));
          }
        }
      }
    }
    var dust = 1 + Math.floor(r() * 4);
    for (var q = 0; q < dust; q++) {
      var qx = Math.floor(r() * PW), qy = Math.floor(r() * PH), qr = 0.8 + r() * 1.6;
      for (var a = -3; a <= 3; a++) for (var b = -3; b <= 3; b++) {
        var X = qx + a, Y = qy + b; if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
        if (a * a + b * b <= qr * qr) mark[Y * PW + X] = 1;
      }
    }
    p.stain = stain; p.mark = mark;
  }

  /* paint the plate into plateCanvas: amber under the darkroom window, or neutral when fixed and backed */
  function paintPlate(p, td, fixed) {
    var n = PW * PH, img = plateCanvas.getContext('2d').createImageData(PW, PH), d = img.data;
    var H = p.Heff, df = devF(td), fog = fogOf(td);
    var lo = fixed ? [12, 10, 9] : [24, 12, 4], hi = fixed ? [228, 218, 198] : [236, 176, 96];
    for (var i = 0; i < n; i++) {
      var dd = 1 - Math.exp(-G * p.E[i] * H * df);
      var o = dd + fog * (1 - dd);
      o *= (1 - 0.8 * p.mark[i]);
      var st = p.stain[i];
      o *= (1 - 0.35 * st);
      var t = Math.pow(clamp(o, 0, 1), 0.95);
      var R = lo[0] + (hi[0] - lo[0]) * t, Gc = lo[1] + (hi[1] - lo[1]) * t, B = lo[2] + (hi[2] - lo[2]) * t;
      if (st > 0) { var sk = st * (fixed ? 0.8 : 0.5); R += (132 - R) * sk; Gc += (100 - Gc) * sk; B += (62 - B) * sk; }
      d[i * 4] = R; d[i * 4 + 1] = Gc; d[i * 4 + 2] = B; d[i * 4 + 3] = 255;
    }
    plateCanvas.getContext('2d').putImageData(img, 0, 0);
  }

  function judge(p) {
    var H = p.Heff, td = p.td;
    var face = toneOf(D.effSkin, H, td), white = toneOf(D.effWhite, H, td), dark = toneOf(D.effDark, H, td);
    var sTone = clamp(1 - Math.abs(face - 0.6) / 0.32, 0, 1);
    var sHigh = white > 0.96 ? clamp(1 - (white - 0.96) / 0.035, 0, 1) : clamp((white - 0.5) / 0.25, 0, 1);
    var sShadow = clamp(1 - (dark - 0.18) / 0.25, 0, 1);
    var sStill = clamp(1 - (p.rms - 0.7) / 3.5, 0, 1);
    var sFig = clamp(1 - (Lr.rBody - 0.9) / 2.2, 0, 1);
    var q = sTone * (1 - 0.85 * (1 - sStill)) * (1 - 0.5 * (1 - sShadow)) * (1 - 0.35 * (1 - sHigh)) * (1 - 0.4 * D.kind.figure * (1 - sFig));
    var faultPts = 40 * Math.min(1, p.df * 1.5) + 35 * p.streak;
    p.score = Math.round(clamp(100 * q - faultPts, 0, 100));
    p.face = face; p.white = white; p.dark = dark;
    p.parts = { tone: sTone, still: sStill, shadow: sShadow, high: sHigh, fig: sFig };
    p.stops = Math.log(Math.max(1e-6, H * devF(td))) / Math.LN2;   // relative to the plate that gives the face its proper tone
    // what to say
    var w = [];
    if (face < 0.42) w.push(p.stops < -0.4 ? 'too dark: under-exposed' : 'thin: not developed long enough');
    else if (face > 0.78) w.push(p.stops > 0.4 ? 'washed out: over-exposed' : 'flat and grey');
    if (dark > 0.32) w.push('fogged in the shadows');
    if (p.rms > 2.2) w.push(D.P.child ? 'the child moved' : 'the sitter moved');
    else if (p.rms > 1.3) w.push('a little soft from movement');
    if (white > 0.975) w.push('the whites blocked up');
    if (p.df > 0.05) w.push('dried at the edges');
    if (p.streak > 0.15) w.push('streaked from the bath');
    if (D.kind.figure > 0.5 && sFig < 0.6) w.push('the hands and ' + (D.P.chain ? 'chain' : 'figure') + ' out of focus');
    p.faults = w;
  }

  /* ---------- the loop ---------- */
  function step(dtReal) {
    var p = S.cur, ph = S.phase;
    if (ph === 'ready' || ph === 'result' || ph === 'over') return;
    var real = ph === 'expose' || ph === 'develop';
    var dt = real ? dtReal : dtReal * FAST;
    S.t += dt;
    if (ph === 'coat') { p.coat += dt; if (p.coat >= T_COAT) { S.phase = 'bath'; say('The plate is in the silver bath. It needs three minutes or more to take up the silver; lift it out too soon and it will be slow and streaked.'); buttons(); } }
    else if (ph === 'bath') { p.bt += dt; }
    else if (ph === 'carry1') { p.carry += dt; if (p.carry >= T_CARRY) { S.phase = 'camera'; p.carry = 0; say('The dark slide is in the camera and the plate is drying from this moment. Watch the light on the ground glass and uncap when you are ready; count the seconds and cap again.'); buttons(); } }
    else if (ph === 'expose') {
      p.te += dt;
      var rt = rateNow(p), sw = sway(p, p.te);
      p.H += rt * dt; p.lightSum += light(D, S.t) * dt;
      p.samples.push({ dx: sw.dx, dy: sw.dy, w: rt * dt });
      if (p.te >= 120) capLens();
    } else if (ph === 'carry2') { p.carry += dt; if (p.carry >= T_CARRY) startDev(); }
    else if (ph === 'develop') { p.td += dt; if (p.td >= 90) stopDev(); }
    else if (ph === 'fix') { p.fixT += dt; if (p.fixT >= T_FIX) finishPlate(); }
  }

  function mainAction() {
    var ph = S.phase;
    if (ph === 'ready' || ph === 'result') {
      if (S.over) return;
      S.cur = newPlate(); S.phase = 'coat';
      say('You pour collodion on a cleaned glass, tilt it until it runs to every corner, and drain the rest back into the bottle from one corner.');
    } else if (ph === 'bath') {
      S.cur.outAt = S.t; S.phase = 'carry1'; S.cur.carry = 0;
      say(S.cur.bt < T_BATH_MIN ? 'You lift it out after ' + mmss(S.cur.bt) + ', and the silver runs off it in greasy lines. Into the dark slide.' : 'Out of the bath after ' + mmss(S.cur.bt) + ', creamy and even. Into the dark slide and across to the camera.');
    } else if (ph === 'camera') {
      S.cur.stop = STOPS[S.stop]; S.phase = 'expose'; S.cur.te = 0;
      say('The cap is off. ' + (D.P.child ? 'His mother holds him by the shoulders.' : 'The sitter holds still against the head-rest.') + ' Count, and cap when you judge it enough.');
    } else if (ph === 'expose') capLens();
    else if (ph === 'develop') stopDev();
    buttons();
  }
  function capLens() {
    var p = S.cur; if (S.phase !== 'expose') return;
    bake(p);
    S.phase = 'carry2'; p.carry = 0;
    say('Capped at ' + p.te.toFixed(1) + ' seconds. ' + (p.rms > 1.6 ? 'You saw ' + (D.P.child ? 'him' : 'the sitter') + ' move.' : 'Nobody moved that you could see.') + ' Back to the darkroom with the slide.');
    buttons();
  }
  function startDev() {
    var p = S.cur;
    p.dryAt = S.t - p.outAt;
    faults(p);
    p.Heff = p.H * (1 - 0.5 * Math.min(1, p.df));
    S.phase = 'develop'; p.td = 0;
    say('You sweep the iron developer across the plate in one wave. Watch the image come up under the yellow window and flood it with water when it is right.');
    buttons();
  }
  function stopDev() {
    var p = S.cur; if (S.phase !== 'develop') return;
    S.phase = 'fix'; p.fixT = 0;
    say('Water stops it at ' + p.td.toFixed(1) + ' seconds. Into the cyanide to clear, then washed, dried over the spirit lamp, varnished and backed with black.');
    buttons();
  }
  function finishPlate() {
    var p = S.cur;
    judge(p);
    paintPlate(p, p.td, true);
    p.thumb = mk(PW, PH); p.thumb.getContext('2d').drawImage(plateCanvas, 0, 0);
    S.plates.push(p);
    var best = S.plates.reduce(function (a, b) { return b.score > a.score ? b : a; });
    var who = D.P.child ? 'His mother' : D.kind.male ? 'He' : 'She';
    if (p.score >= D.fussy) { S.over = true; S.why = 'bought'; }
    else if (S.plates.length >= MAXPLATES) { S.over = true; S.why = 'plates'; }
    else if (S.t >= D.patience) { S.over = true; S.why = 'patience'; }
    S.phase = S.over ? 'over' : 'result';
    if (S.over) {
      say(S.why === 'bought' ? who + ' looks at it a long while and says that will do very well.' : S.why === 'plates' ? 'That was the last cleaned plate.' : who + ' has waited as long as ' + (D.P.child ? 'she means to' : D.kind.male ? 'he means to' : 'she means to') + '.');
      reveal(best);
    } else {
      say(who + ' looks at it and ' + (p.score >= D.fussy - 15 ? 'hesitates: ' : 'shakes ' + (D.kind.male && !D.P.child ? 'his' : 'her') + ' head: ') + (p.faults.length ? p.faults.join(', ') : 'it is not quite a likeness') + '. Coat another plate, if ' + (D.P.child ? 'the boy' : D.kind.male ? 'he' : 'she') + ' will wait.');
    }
    gallery(); buttons(); hud();
  }

  /* ---------- drawing the page ---------- */
  function draw() {
    var W = cv.width, H = cv.height, p = S.cur, ph = S.phase;
    ctx.fillStyle = '#0b0f16'; ctx.fillRect(0, 0, W, H);
    var px = (W - PW) / 2, py = 26;
    ctx.font = '600 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
    if (ph === 'ready' || ph === 'camera' || ph === 'carry1') {
      // the ground glass: upside down, as bright as the light and the stop allow
      ctx.save(); ctx.translate(px + PW, py + PH); ctx.rotate(Math.PI); ctx.drawImage(ggCanvas, 0, 0); ctx.restore();
      var lv = light(D, S.t) * Math.pow(3.6 / STOPS[S.stop], 2);
      ctx.fillStyle = 'rgba(0,0,0,' + (1 - clamp(0.1 + 0.9 * Math.pow(lv, 0.55), 0.06, 1)).toFixed(3) + ')';
      ctx.fillRect(px, py, PW, PH);
      var vg = ctx.createRadialGradient(px + PW / 2, py + PH / 2, PH * 0.3, px + PW / 2, py + PH / 2, PH * 0.66);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(px, py, PW, PH);
      ctx.strokeStyle = 'rgba(232,237,245,.18)'; ctx.lineWidth = 1;
      for (var g = 1; g < 3; g++) { ctx.beginPath(); ctx.moveTo(px + PW * g / 3, py); ctx.lineTo(px + PW * g / 3, py + PH); ctx.moveTo(px, py + PH * g / 3); ctx.lineTo(px + PW, py + PH * g / 3); ctx.stroke(); }
      ctx.fillStyle = 'rgba(232,237,245,.6)';
      ctx.fillText(ph === 'carry1' ? 'carrying the slide' : 'ground glass · upside down', W / 2, 16);
      if (ph === 'camera') {
        var dry = S.t - p.outAt, f = dry / D.dryLimit;
        ctx.fillStyle = f > 1 ? '#ff8a7a' : f > 0.75 ? '#ffce6a' : 'rgba(232,237,245,.6)';
        ctx.fillText('out of the bath ' + mmss(dry) + (f > 1 ? ' · drying' : f > 0.75 ? ' · going tacky' : ''), W / 2, py + PH + 20);
      }
    } else if (ph === 'coat' || ph === 'bath') {
      // the darkroom: a glass in a tank of silver
      ctx.fillStyle = '#1a1006'; ctx.fillRect(px, py, PW, PH);
      ctx.fillStyle = 'rgba(236,176,96,.08)'; ctx.fillRect(px, py, PW, PH);
      ctx.strokeStyle = 'rgba(236,176,96,.45)'; ctx.strokeRect(px + 40, py + 30, PW - 80, PH - 50);
      var lvl = ph === 'coat' ? clamp(p.coat / T_COAT, 0, 1) : 1;
      var fr = ph === 'bath' ? clamp(p.bt / T_BATH_MIN, 0, 1) : 0;
      var col = ph === 'coat' ? 'rgba(210,214,220,' + (0.15 + 0.35 * lvl) + ')' : 'rgba(' + Math.round(200 + 30 * fr) + ',' + Math.round(200 - 10 * fr) + ',' + Math.round(210 - 90 * fr) + ',.75)';
      ctx.fillStyle = col; ctx.fillRect(px + 56, py + (ph === 'coat' ? 50 : 60), PW - 112, PH - 100);
      if (ph === 'bath') { ctx.fillStyle = 'rgba(236,176,96,.16)'; ctx.fillRect(px + 42, py + 40, PW - 84, PH - 62); }
      ctx.fillStyle = 'rgba(236,176,96,.85)';
      ctx.fillText(ph === 'coat' ? 'pouring the collodion' : 'in the silver bath ' + mmss(p.bt) + (p.bt < T_BATH_MIN ? '' : ' · ready'), W / 2, 16);
    } else if (ph === 'expose') {
      ctx.fillStyle = '#05070a'; ctx.fillRect(px, py, PW, PH);
      ctx.fillStyle = '#64f0c8'; ctx.font = '700 46px ui-monospace,Menlo,monospace';
      ctx.fillText(p.te.toFixed(1), W / 2, py + PH / 2 + 10);
      ctx.font = '600 11px ui-monospace,Menlo,monospace'; ctx.fillStyle = 'rgba(232,237,245,.6)';
      ctx.fillText('seconds with the cap off', W / 2, py + PH / 2 + 34);
      ctx.fillText('lens open', W / 2, 16);
      var sw = sway(p, p.te);
      ctx.fillText('the sitter: ' + (Math.hypot(sw.dx, sw.dy) > 2 ? 'moving' : Math.hypot(sw.dx, sw.dy) > 1 ? 'swaying a little' : 'still'), W / 2, py + PH + 20);
    } else if (ph === 'carry2') {
      ctx.fillStyle = '#05070a'; ctx.fillRect(px, py, PW, PH);
      ctx.fillStyle = 'rgba(232,237,245,.6)'; ctx.fillText('to the darkroom', W / 2, 16);
    } else if (ph === 'develop' || ph === 'fix') {
      paintPlate(p, p.td, false);
      ctx.drawImage(plateCanvas, px, py);
      ctx.fillStyle = 'rgba(236,176,96,.85)';
      ctx.fillText(ph === 'develop' ? 'developing ' + p.td.toFixed(1) + ' s' : 'fixing and washing', W / 2, 16);
    } else {
      // the finished plate, cased
      var lp = S.plates[S.plates.length - 1];
      if (lp) {
        caseIt(ctx, lp, px, py);
        ctx.fillStyle = 'rgba(232,237,245,.6)';
        ctx.fillText('plate ' + lp.n + ' · ' + lp.score + ' of 100', W / 2, 16);
      }
    }
    drawSky();
  }
  function caseIt(c, p, x, y) {
    c.fillStyle = '#2a1a10'; c.fillRect(x - 14, y - 10, PW + 28, PH + 20);
    c.drawImage(p.thumb, x, y);
    // a brass mat with an arched opening
    c.save(); c.beginPath(); c.rect(x - 2, y - 2, PW + 4, PH + 4);
    c.moveTo(x + 22, y + PH - 18); c.lineTo(x + 22, y + 80); c.quadraticCurveTo(x + 22, y + 18, x + PW / 2, y + 18); c.quadraticCurveTo(x + PW - 22, y + 18, x + PW - 22, y + 80); c.lineTo(x + PW - 22, y + PH - 18); c.closePath();
    var bg = c.createLinearGradient(x, y, x + PW, y + PH); bg.addColorStop(0, '#b8963f'); bg.addColorStop(0.5, '#e2c873'); bg.addColorStop(1, '#8e6f2a');
    c.fillStyle = bg; c.fill('evenodd'); c.restore();
  }
  function drawSky() {
    var W = sky.width, H = sky.height;
    var L = D ? light(D, S.t) : 0;
    var c0 = Math.round(40 + 150 * clamp(L, 0, 1.2) / 1.2);
    sctx.fillStyle = 'rgb(' + c0 + ',' + (c0 + 8) + ',' + (c0 + 20) + ')'; sctx.fillRect(0, 0, W, H - 18);
    // clouds drifting over the roof
    for (var i = 0; i < 9; i++) {
      var x = ((i * 53 + S.t * (4 + (i % 3))) % (W + 120)) - 60, y = 8 + (i * 17) % 30;
      var cl = cloud(D, S.t + i * 30), shadeC = cl < 0.7 ? 'rgba(60,64,72,' + (0.5 - cl * 0.4).toFixed(2) + ')' : 'rgba(240,242,246,' + (0.2 + 0.25 * (cl - 0.7)).toFixed(2) + ')';
      sctx.fillStyle = shadeC; sctx.beginPath(); sctx.ellipse(x, y, 40 + (i % 4) * 8, 9 + (i % 3) * 3, 0, 0, Math.PI * 2); sctx.fill();
    }
    sctx.strokeStyle = 'rgba(14,19,27,.9)'; sctx.lineWidth = 3;
    for (var m = 0; m <= W; m += W / 6) { sctx.beginPath(); sctx.moveTo(m, 0); sctx.lineTo(m, H - 18); sctx.stroke(); }
    sctx.beginPath(); sctx.moveTo(0, (H - 18) / 2); sctx.lineTo(W, (H - 18) / 2); sctx.stroke();
    // the bar: light from the roof against the book's midsummer sky
    sctx.fillStyle = '#0e131b'; sctx.fillRect(0, H - 14, W, 14);
    sctx.fillStyle = '#ffce6a'; sctx.fillRect(0, H - 12, W * clamp(L / 1.25, 0, 1), 10);
    sctx.fillStyle = '#64f0c8'; sctx.fillRect(W / 1.25 - 1, H - 16, 2, 16);
  }

  function lightWord(L) { return L > 0.85 ? 'bright' : L > 0.6 ? 'good' : L > 0.4 ? 'fair' : L > 0.25 ? 'dull' : 'very dull'; }
  function hud() {
    var p = S.cur, ph = S.phase;
    var names = { ready: 'sitter seated', coat: 'coating', bath: 'in the bath', carry1: 'to the camera', camera: 'at the camera', expose: 'lens open', carry2: 'to the darkroom', develop: 'developing', fix: 'fixing', result: 'plate ' + S.plates.length + ' done', over: 'sitting over' };
    $('hPhase').textContent = names[ph];
    $('hClock').textContent = clockStr(S.t);
    var left = D.patience - S.t;
    var pw = $('hPatience'); pw.textContent = left > 8 * 60 ? 'content' : left > 3 * 60 ? 'restless' : left > 0 ? 'looking at the clock' : 'gone';
    pw.parentNode.className = left <= 3 * 60 ? 'alarm' : '';
    var L = light(D, S.t);
    $('hLight').textContent = lightWord(L);
    $('hStop').textContent = 'f/' + STOPS[S.stop];
    $('hPlates').textContent = (MAXPLATES - S.plates.length - (p && ph !== 'result' && ph !== 'over' && ph !== 'ready' ? 1 : 0)) + ' of ' + MAXPLATES + ' left';
    var hb = $('hBath');
    hb.textContent = p && ph !== 'result' && ph !== 'over' ? mmss(p.bt) : '—';
    hb.parentNode.className = p && ph === 'bath' && p.bt < T_BATH_MIN ? 'alarm' : '';
    var hw = $('hWet');
    if (p && (ph === 'camera' || ph === 'expose' || ph === 'carry2')) {
      var f = (S.t - p.outAt) / D.dryLimit;
      hw.textContent = f > 1 ? 'drying at the edges' : f > 0.75 ? 'going tacky' : 'wet';
      hw.parentNode.className = f > 0.75 ? 'alarm' : '';
    } else { hw.textContent = '—'; hw.parentNode.className = ''; }
  }
  function clockStr(t) {
    var m = Math.floor(D.hour * 60 + t / 60), h = Math.floor(m / 60), mm = m % 60;
    return (h > 12 ? h - 12 : h) + ':' + (mm < 10 ? '0' : '') + mm + (h >= 12 ? ' pm' : ' am');
  }
  function buttons() {
    var ph = S.phase, b = $('btnMain');
    var labels = { ready: 'Coat a plate', result: 'Coat another plate', coat: 'Coating…', bath: 'Lift it out of the bath', carry1: 'To the camera…', camera: 'Uncap the lens', expose: 'Cap the lens', carry2: 'To the darkroom…', develop: 'Flood with water', fix: 'Fixing…', over: 'The sitting is over' };
    b.textContent = labels[ph];
    b.disabled = ['coat', 'carry1', 'carry2', 'fix', 'over'].indexOf(ph) >= 0;
    var lock = ['expose', 'carry2', 'develop', 'fix', 'over'].indexOf(ph) >= 0;
    document.querySelectorAll('#stops .chip').forEach(function (c) { c.disabled = lock; });
    var mid = ph !== 'ready' && ph !== 'over' && ph !== 'result';
    ['btnDayPrev', 'btnDayNext', 'btnDayToday'].forEach(function (id) { $(id).disabled = mid; });
    $('btnAgain').style.display = ph === 'over' ? '' : 'none';
  }
  function chips() {
    $('stops').innerHTML = STOPS.map(function (N, i) {
      return '<button type="button" class="chip' + (i === S.stop ? ' on' : '') + '" data-i="' + i + '">f/' + N + ' <small>×' + (Math.round(Math.pow(N / 3.6, 2) * 10) / 10) + '</small></button>';
    }).join('');
    buttons();
  }
  function gallery() {
    var g = $('gallery'); g.innerHTML = '';
    S.plates.forEach(function (p) {
      var f = document.createElement('figure');
      var c = mk(PW + 28, PH + 20); caseIt(c.getContext('2d'), p, 14, 10);
      f.appendChild(c);
      var cap = document.createElement('figcaption');
      cap.innerHTML = '<b>Plate ' + p.n + '</b> · ' + p.score + '<br>f/' + p.stop + ' · ' + p.te.toFixed(1) + ' s · dev ' + p.td.toFixed(0) + ' s';
      f.appendChild(cap); g.appendChild(f);
    });
  }
  function say(t) { $('msg').innerHTML = t; }

  function plaque() {
    var d = D.date, wd = new Date(D.year, d.getMonth(), d.getDate()).getDay();
    $('plWho').textContent = WEEKDAYS[wd] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + D.year + ' · ' + D.town.name + ' · ' + clockStr(0);
    $('plName').textContent = 'Mr ' + D.operator + '’s glasshouse, ' + D.town.street;
    var wxw = { clear: 'a clear sky over the roof', fair: 'a fair sky with white clouds going over', broken: 'broken cloud, some of it dark, coming over fast', overcast: 'a grey, even overcast', dull: 'a dull, thick sky' }[D.weather];
    var hold = Math.round(D.hold / 5) * 5 || 5;
    $('plBlurb').innerHTML = 'Mr ' + D.operator + ' is away and you are minding the studio. In the chair: <b>' + D.sitter + '</b>, ' + D.why + ', in ' + D.dressNames + '. ' +
      (D.P.child ? 'He can be kept still for perhaps <b>' + hold + ' seconds</b>' : (D.kind.male ? 'He' : 'She') + ' can keep still against the head-rest for perhaps <b>' + hold + ' seconds</b>') + ', and will wait about <b>' + Math.round(D.patience / 300) * 5 + ' minutes</b>. ' +
      'It is ' + MONTHS[d.getMonth()] + ' in ' + D.town.name + ', with ' + wxw + (D.town.smoke < 0.85 ? ' and the town’s smoke hanging over it' : '') + '. The darkroom thermometer reads <b>' + D.temp + '°F</b>, and the silver bath was made up ' + (D.bathWeeks === 0 ? '<b>this week</b>' : '<b>' + NUMW[D.bathWeeks] + ' week' + (D.bathWeeks > 1 ? 's' : '') + ' ago</b>') + '.';
    $('rules').innerHTML = '<span>Mr ' + D.operator + '’s book: <b>3 s at f/3.6</b> under a bright midsummer noon sky, the bath fresh and the room at 62°F</span>' +
      '<span>each stop down: the time shown against it</span><span>every <b>18°F colder</b>: double it</span><span>at least <b>3 min</b> in the bath</span><span>develop before the plate dries</span><span><b>space</b> does the next thing</span>';
  }

  function reveal(best) {
    var v = $('verdict');
    var bought = S.why === 'bought';
    v.className = 'verdict ' + (bought ? 'good' : 'warn');
    v.innerHTML = '<p><b>' + (bought ? 'Sold: ' + D.kind.price + '.' : 'No sale.') + '</b> ' +
      (bought ? 'Plate ' + best.n + ' scored ' + best.score + '; ' + D.sitter.replace(/<[^>]+>/g, '') + ' wanted ' + D.fussy + ' or better.' : 'The best plate scored ' + best.score + ', and ' + D.sitter.replace(/<[^>]+>/g, '') + ' wanted ' + D.fussy + ' or better. ' + (S.why === 'plates' ? 'You ran out of plates.' : 'The sitter ran out of patience at ' + clockStr(S.t) + '.')) + '</p>';
    var s = '<h5>The plates</h5><div class="tablewrap"><table><thead><tr><th>Plate</th><th>Stop</th><th>Bath</th><th>Open</th><th>Light</th><th>Exposure</th><th>Developed</th><th>Movement</th><th>Score</th></tr></thead><tbody>';
    S.plates.forEach(function (p) {
      var lAvg = p.lightSum / Math.max(0.01, p.te), st = p.stops;
      s += '<tr><td>' + p.n + '</td><td>f/' + p.stop + '</td><td' + (p.bt < T_BATH_MIN ? ' class="bad"' : '') + '>' + mmss(p.bt) + '</td><td>' + p.te.toFixed(1) + ' s</td><td>' + Math.round(lAvg * 100) + '%</td>' +
        '<td class="' + (Math.abs(st) < 0.35 ? 'ok' : Math.abs(st) > 0.9 ? 'bad' : '') + '">' + (st >= 0 ? '+' : '') + st.toFixed(1) + ' stops</td>' +
        '<td class="' + (p.td > 4.2 * D.tau || p.td < 1.8 * D.tau ? 'bad' : '') + '">' + p.td.toFixed(1) + ' s</td><td class="' + (p.rms > 2.2 ? 'bad' : p.rms < 1 ? 'ok' : '') + '">' + p.rms.toFixed(1) + ' px</td><td' + (p.score >= D.fussy ? ' class="ok"' : '') + '>' + p.score + '</td></tr>';
    });
    s += '</tbody></table></div>';
    var speed = D.bathSpeed * D.tempSpeed;
    var Lnow = S.plates.reduce(function (a, p) { return a + p.lightSum / Math.max(0.01, p.te); }, 0) / S.plates.length;
    var tStar = function (N) { return 1 / ((1 / BOOK) * speed * Lnow * Math.pow(3.6 / N, 2)) * (1 / 0.95); };
    s += '<p><b>What the plate wanted.</b> The light from the roof averaged ' + Math.round(Lnow * 100) + '% of the book’s midsummer sky while your lens was open. The bath, ' +
      (D.bathWeeks === 0 ? 'fresh this week' : NUMW[D.bathWeeks] + ' week' + (D.bathWeeks > 1 ? 's' : '') + ' old') + ', was working at ' + Math.round(D.bathSpeed * 100) + '% of its best, and at ' + D.temp + '°F the chemistry ran at ' + Math.round(D.tempSpeed * 100) + '% of its speed at 62°F. ' +
      'So the right exposure was about <b>' + STOPS.map(function (N) { return tStar(N).toFixed(tStar(N) < 10 ? 1 : 0) + ' s at f/' + N; }).join(', ') + '</b>, developed for about <b>' + (3 * D.tau).toFixed(0) + ' s</b>; ' +
      (D.P.child ? 'the boy' : 'the sitter') + ' could hold still for about ' + D.hold.toFixed(0) + ' s, and the plate stayed wet for about ' + Math.round(D.dryLimit / 60) + ' minutes out of the bath.</p>';
    var col = [];
    if (D.P.tunic) col.push('the scarlet tunic came out nearly black and the white belts stood out like chalk');
    if (D.P.chain) col.push('the gold chain came out dark, nearly as dark as the coat');
    if (D.P.vestName === 'crimson') col.push('the crimson waistcoat went black');
    if (D.P.vestName === 'buff') col.push('the buff waistcoat came out a dull grey, darker than it looked');
    if (D.P.coat === C.navy) col.push('the navy coat came out a pale grey, lighter than the face');
    if (D.P.dressName === 'paleblue' || D.P.dressName === 'skyfrock') col.push('the blue came out nearly white');
    if (D.P.dressName === 'mauve') col.push('the mauve silk came out pale, as purples do');
    if (D.P.dressName === 'rose' || D.P.dressName === 'apple') col.push('the ' + (D.P.dressName === 'rose' ? 'pink' : 'green') + ' silk came out a heavy grey');
    if (D.P.hairName === 'auburn') col.push('the auburn hair went black');
    if (D.P.eyes[2] > 150) col.push('the blue eyes came out pale and staring');
    if (D.backdrop === 'curtain') col.push('the crimson curtain was all but black behind');
    s += '<p><b>What the colours did.</b> Collodion sees almost nothing but blue and violet light. ' + cap1(col.length ? col.join('; ') : 'the face came out a little darker and more freckled than it looked, because the plate does not see the warmth in skin') + '.</p>';
    $('reveal').innerHTML = s; $('reveal').style.display = '';
  }

  function load() {
    var d = dateFor(dayOff);
    D = build(seedForDate(d), d);
    fresh(); Lr = null;
    var def = D.weather === 'clear' || D.weather === 'fair' ? 1 : 0;
    S.stop = -1; setStop(def);
    plaque();
    $('dayOut').textContent = (dayOff === 0 ? 'Today' : dayOff === -1 ? 'Yesterday' : dayOff === 1 ? 'Tomorrow' : (dayOff > 0 ? '+' : '') + dayOff + ' days') + ' · ' + D.year + ' · ' + D.town.name + ' · ' + D.sitter.replace(/<[^>]+>/g, '');
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('gallery').innerHTML = '';
    say('The sitter is in the chair and the camera is focused on the eyes. Choose a stop, then coat a plate. The studio clock runs eight times as fast as yours, except while the lens is open and while the developer is on the plate.');
    buttons(); hud(); draw();
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var real = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    if (S.phase !== 'ready' && S.phase !== 'result' && S.phase !== 'over') {
      var n = Math.max(1, Math.ceil(real / 0.02));
      for (var i = 0; i < n; i++) step(real / n);
    }
    hud(); draw();
  }

  /* ---------- wiring ---------- */
  $('btnMain').addEventListener('click', mainAction);
  $('stops').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b || b.disabled) return;
    setStop(+b.getAttribute('data-i')); draw();
  });
  $('btnAgain').addEventListener('click', function () { load(); });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' && !e.repeat) { e.preventDefault(); if (!$('btnMain').disabled) mainAction(); }
  });

  /* exposed for checking the model from the console; the page does not use it */
  window.__plate = { build: build, day: function () { return D; }, state: function () { return S; }, light: function (t) { return light(D, t); }, step: step, act: mainAction };

  load();
  raf = requestAnimationFrame(frame);
})();
