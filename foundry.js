/* drift — The Foundry
   A typeface cut from today's date. Every glyph is a stroke skeleton in a unit
   box; the day's number decides the weight, the width, the slant, the stress,
   how round the curves are, how the strokes are finished and how far apart the
   letters sit. Nothing is a font file and nothing is an image: each letter is
   re-drawn as SVG line work every time a slider moves.
   Self-contained. No dependencies. */
(function () {
  'use strict';

  /* ================= seeded PRNG (same family as the front page) ========= */
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

  function hash32(n) {
    var h = n ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function seedForDate(d) {
    return hash32(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
  }

  /* ================= the skeletons =======================================
     Unit space: x runs left to right from 0, y runs 0 (baseline) to 1 (cap
     height). Descenders go below zero. Only M, L and Q are used. */
  var GLYPHS = {
    'A': { w: 0.64, d: 'M0.02,0 L0.32,1 L0.62,0 M0.13,0.34 L0.51,0.34' },
    'B': { w: 0.66, d: 'M0.07,0 L0.07,1 M0.07,1 L0.36,1 Q0.57,1 0.57,0.76 Q0.57,0.53 0.36,0.53 L0.07,0.53 M0.07,0.53 L0.39,0.53 Q0.61,0.53 0.61,0.27 Q0.61,0 0.39,0 L0.07,0' },
    'C': { w: 0.64, d: 'M0.59,0.79 Q0.51,1 0.33,1 Q0.05,1 0.05,0.5 Q0.05,0 0.33,0 Q0.51,0 0.59,0.21' },
    'D': { w: 0.67, d: 'M0.07,0 L0.07,1 L0.33,1 Q0.62,1 0.62,0.5 Q0.62,0 0.33,0 L0.07,0' },
    'E': { w: 0.60, d: 'M0.57,1 L0.07,1 L0.07,0 L0.57,0 M0.07,0.5 L0.47,0.5' },
    'F': { w: 0.57, d: 'M0.55,1 L0.07,1 L0.07,0 M0.07,0.5 L0.45,0.5' },
    'G': { w: 0.67, d: 'M0.59,0.79 Q0.51,1 0.33,1 Q0.05,1 0.05,0.5 Q0.05,0 0.33,0 Q0.62,0 0.62,0.26 L0.62,0.40 L0.38,0.40' },
    'H': { w: 0.67, d: 'M0.07,0 L0.07,1 M0.60,0 L0.60,1 M0.07,0.52 L0.60,0.52' },
    'I': { w: 0.30, d: 'M0.15,0 L0.15,1' },
    'J': { w: 0.52, d: 'M0.46,1 L0.46,0.23 Q0.46,0 0.25,0 Q0.05,0 0.05,0.19' },
    'K': { w: 0.64, d: 'M0.07,0 L0.07,1 M0.59,1 L0.11,0.44 M0.27,0.63 L0.61,0' },
    'L': { w: 0.57, d: 'M0.07,1 L0.07,0 L0.55,0' },
    'M': { w: 0.78, d: 'M0.06,0 L0.06,1 L0.39,0.27 L0.72,1 L0.72,0' },
    'N': { w: 0.67, d: 'M0.07,0 L0.07,1 L0.60,0 L0.60,1' },
    'O': { w: 0.70, d: 'M0.35,1 Q0.64,1 0.64,0.5 Q0.64,0 0.35,0 Q0.06,0 0.06,0.5 Q0.06,1 0.35,1' },
    'P': { w: 0.63, d: 'M0.07,0 L0.07,1 L0.36,1 Q0.58,1 0.58,0.73 Q0.58,0.46 0.36,0.46 L0.07,0.46' },
    'Q': { w: 0.70, d: 'M0.35,1 Q0.64,1 0.64,0.5 Q0.64,0 0.35,0 Q0.06,0 0.06,0.5 Q0.06,1 0.35,1 M0.42,0.20 L0.66,-0.10' },
    'R': { w: 0.66, d: 'M0.07,0 L0.07,1 L0.36,1 Q0.58,1 0.58,0.74 Q0.58,0.48 0.36,0.48 L0.07,0.48 M0.32,0.48 L0.62,0' },
    'S': { w: 0.63, d: 'M0.57,0.83 Q0.57,1 0.32,1 Q0.07,1 0.07,0.76 Q0.07,0.57 0.33,0.52 Q0.58,0.46 0.58,0.24 Q0.58,0 0.32,0 Q0.06,0 0.06,0.16' },
    'T': { w: 0.62, d: 'M0.31,0 L0.31,1 M0.02,1 L0.60,1' },
    'U': { w: 0.67, d: 'M0.07,1 L0.07,0.26 Q0.07,0 0.34,0 Q0.60,0 0.60,0.26 L0.60,1' },
    'V': { w: 0.66, d: 'M0.03,1 L0.33,0 L0.63,1' },
    'W': { w: 0.88, d: 'M0.03,1 L0.23,0 L0.44,0.70 L0.65,0 L0.85,1' },
    'X': { w: 0.64, d: 'M0.05,1 L0.59,0 M0.59,1 L0.05,0' },
    'Y': { w: 0.64, d: 'M0.05,1 L0.32,0.47 L0.59,1 M0.32,0.47 L0.32,0' },
    'Z': { w: 0.62, d: 'M0.05,1 L0.57,1 L0.05,0 L0.57,0' },

    '0': { w: 0.64, d: 'M0.32,1 Q0.60,1 0.60,0.5 Q0.60,0 0.32,0 Q0.04,0 0.04,0.5 Q0.04,1 0.32,1 M0.17,0.19 L0.47,0.81' },
    '1': { w: 0.52, d: 'M0.08,0.77 L0.28,1 L0.28,0 M0.06,0 L0.50,0' },
    '2': { w: 0.62, d: 'M0.06,0.81 Q0.06,1 0.31,1 Q0.56,1 0.56,0.76 Q0.56,0.55 0.30,0.33 L0.05,0 L0.58,0' },
    '3': { w: 0.62, d: 'M0.06,0.85 Q0.11,1 0.32,1 Q0.55,1 0.55,0.78 Q0.55,0.56 0.30,0.54 Q0.58,0.52 0.58,0.28 Q0.58,0 0.32,0 Q0.08,0 0.05,0.15' },
    '4': { w: 0.64, d: 'M0.45,0 L0.45,1 L0.04,0.29 L0.60,0.29' },
    '5': { w: 0.62, d: 'M0.56,1 L0.15,1 L0.11,0.59 Q0.28,0.65 0.38,0.63 Q0.58,0.59 0.58,0.32 Q0.58,0 0.30,0 Q0.08,0 0.05,0.14' },
    '6': { w: 0.62, d: 'M0.55,0.89 Q0.48,1 0.30,1 Q0.05,1 0.05,0.47 Q0.05,0 0.32,0 Q0.57,0 0.57,0.25 Q0.57,0.50 0.33,0.50 Q0.10,0.50 0.06,0.31' },
    '7': { w: 0.60, d: 'M0.04,1 L0.57,1 L0.24,0' },
    '8': { w: 0.62, d: 'M0.31,0.52 Q0.06,0.54 0.06,0.77 Q0.06,1 0.31,1 Q0.56,1 0.56,0.77 Q0.56,0.54 0.31,0.52 Q0.03,0.50 0.03,0.25 Q0.03,0 0.31,0 Q0.59,0 0.59,0.25 Q0.59,0.50 0.31,0.52' },
    '9': { w: 0.62, d: 'M0.07,0.11 Q0.14,0 0.32,0 Q0.57,0 0.57,0.53 Q0.57,1 0.30,1 Q0.05,1 0.05,0.75 Q0.05,0.50 0.29,0.50 Q0.52,0.50 0.56,0.69' },

    '.': { w: 0.28, d: 'M0.14,0.045 L0.14,0.02' },
    ',': { w: 0.28, d: 'M0.17,0.07 L0.08,-0.15' },
    ':': { w: 0.28, d: 'M0.14,0.60 L0.14,0.575 M0.14,0.045 L0.14,0.02' },
    ';': { w: 0.28, d: 'M0.14,0.60 L0.14,0.575 M0.17,0.07 L0.08,-0.15' },
    '!': { w: 0.28, d: 'M0.14,1 L0.14,0.26 M0.14,0.045 L0.14,0.02' },
    '?': { w: 0.56, d: 'M0.06,0.81 Q0.06,1 0.28,1 Q0.50,1 0.50,0.79 Q0.50,0.59 0.28,0.47 L0.28,0.27 M0.28,0.045 L0.28,0.02' },
    '-': { w: 0.44, d: 'M0.06,0.46 L0.38,0.46' },
    '—': { w: 0.80, d: 'M0.04,0.46 L0.76,0.46' },
    '’': { w: 0.24, d: 'M0.12,1 L0.12,0.76' },
    "'": { w: 0.24, d: 'M0.12,1 L0.12,0.76' },
    '"': { w: 0.40, d: 'M0.11,1 L0.11,0.76 M0.28,1 L0.28,0.76' },
    '(': { w: 0.40, d: 'M0.32,1 Q0.09,0.70 0.09,0.45 Q0.09,0.18 0.32,-0.12' },
    ')': { w: 0.40, d: 'M0.08,1 Q0.31,0.70 0.31,0.45 Q0.31,0.18 0.08,-0.12' },
    '&': { w: 0.72, d: 'M0.60,0 L0.17,0.72 Q0.11,0.88 0.26,0.97 Q0.42,1.04 0.45,0.87 Q0.48,0.68 0.11,0.39 Q-0.01,0.23 0.15,0.07 Q0.35,-0.07 0.52,0.24 Q0.58,0.36 0.64,0.42' },
    '/': { w: 0.52, d: 'M0.05,-0.06 L0.47,1.06' },
    '+': { w: 0.56, d: 'M0.06,0.46 L0.50,0.46 M0.28,0.24 L0.28,0.68' },
    '=': { w: 0.56, d: 'M0.06,0.58 L0.50,0.58 M0.06,0.34 L0.50,0.34' },
    '*': { w: 0.44, d: 'M0.22,1 L0.22,0.58 M0.04,0.90 L0.40,0.68 M0.40,0.90 L0.04,0.68' },
    '#': { w: 0.70, d: 'M0.20,1 L0.12,0 M0.48,1 L0.40,0 M0.05,0.70 L0.62,0.70 M0.03,0.32 L0.60,0.32' }
  };

  var CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?-—\'"()&/+=*#';
  var SPACE_W = 0.30;

  /* ================= path parsing ======================================= */
  var parsedCache = {};

  function parsePath(d) {
    var subs = [], cur = null, px = 0, py = 0, i;
    var re = /([MLQ])([^MLQ]*)/g, m;
    while ((m = re.exec(d)) !== null) {
      var raw = m[2].replace(/^[\s,]+|[\s,]+$/g, '');
      var nums = raw.length ? raw.split(/[\s,]+/).map(Number) : [];
      if (m[1] === 'M') {
        cur = [];
        subs.push(cur);
        px = nums[0]; py = nums[1];
        for (i = 2; i + 1 < nums.length; i += 2) {
          cur.push({ t: 'L', x0: px, y0: py, x: nums[i], y: nums[i + 1] });
          px = nums[i]; py = nums[i + 1];
        }
      } else if (m[1] === 'L') {
        for (i = 0; i + 1 < nums.length; i += 2) {
          cur.push({ t: 'L', x0: px, y0: py, x: nums[i], y: nums[i + 1] });
          px = nums[i]; py = nums[i + 1];
        }
      } else {
        for (i = 0; i + 3 < nums.length; i += 4) {
          cur.push({
            t: 'Q', x0: px, y0: py,
            cx: nums[i], cy: nums[i + 1], x: nums[i + 2], y: nums[i + 3]
          });
          px = nums[i + 2]; py = nums[i + 3];
        }
      }
    }
    return subs.filter(function (s) { return s.length > 0; });
  }

  function skeleton(ch) {
    if (!parsedCache[ch]) parsedCache[ch] = parsePath(GLYPHS[ch].d);
    return parsedCache[ch];
  }

  /* ================= the cut ============================================ */
  var FIRST = [
    'Quibo', 'Halden', 'Marrow', 'Vesper', 'Calliper', 'Pennant', 'Tolfast',
    'Brindle', 'Kestrel', 'Lumen', 'Brack', 'Drover', 'Saltire', 'Mistral',
    'Fennick', 'Whitlow', 'Corvid', 'Amberly', 'Gallow', 'Nettle', 'Pilcrow',
    'Rundle', 'Thicket', 'Umber', 'Verso', 'Wrenfield', 'Yarrow', 'Zephyr',
    'Harrow', 'Ludgate', 'Oaklode', 'Sable', 'Tarn', 'Ferris', 'Glimmer',
    'Kiln', 'Marlow', 'Noonday', 'Ostler', 'Quarry', 'Ridley', 'Stanchion',
    'Trestle', 'Wold', 'Bellwether', 'Cinder', 'Dovetail', 'Ellum', 'Foxglove',
    'Greave', 'Hollis', 'Inglenook', 'Jarrow', 'Kittiwake', 'Lintel', 'Morrow'
  ];

  function cutFor(seed) {
    var r = rng(seed);
    r(); r(); r();
    var o = { seed: seed >>> 0 };
    o.weight = 0.052 + Math.pow(r(), 1.5) * 0.19;
    o.widthF = 0.74 + r() * 0.60;
    var sr = r();
    o.slant = sr < 0.58 ? 0 : (sr < 0.90 ? 3 + r() * 14 : -(2 + r() * 7));
    o.contrast = r() < 0.38 ? r() * 0.10 : 0.18 + r() * 0.62;
    o.round = 0.64 + r() * 0.86;
    o.tracking = -0.005 + r() * 0.13;
    o.cap = ['round', 'butt', 'square'][Math.floor(r() * 3)];
    o.extend = r() < 0.72 ? 0 : r() * 0.05;
    o.smallcap = 0.70 + r() * 0.14;
    o.series = 1 + Math.floor(r() * 96);
    o.first = FIRST[Math.floor(r() * FIRST.length)];
    return o;
  }

  function weightName(w) {
    if (w < 0.070) return 'Hairline';
    if (w < 0.092) return 'Light';
    if (w < 0.120) return 'Regular';
    if (w < 0.148) return 'Medium';
    if (w < 0.180) return 'Bold';
    if (w < 0.212) return 'Black';
    return 'Ultra';
  }

  function widthName(x) {
    if (x < 0.830) return 'Compressed';
    if (x < 0.935) return 'Condensed';
    if (x < 1.075) return '';
    if (x < 1.200) return 'Extended';
    return 'Wide';
  }

  function slantName(s) {
    if (s > 12) return 'Italic';
    if (s > 1) return 'Oblique';
    if (s < -1) return 'Backslant';
    return '';
  }

  function className(o) {
    if (o.contrast > 0.58) return 'Didone';
    if (o.contrast > 0.42) return 'Modern';
    if (o.contrast > 0.22) return 'Antique';
    if (o.round > 1.30) return 'Geometric';
    if (o.round < 0.80) return 'Rectilinear';
    if (o.weight > 0.185) return 'Poster';
    if (o.cap === 'round') return 'Monolinear';
    return 'Grotesque';
  }

  function styleName(o) {
    var parts = [weightName(o.weight), widthName(o.widthF), slantName(o.slant)];
    return parts.filter(function (p) { return p; }).join(' ');
  }

  function faceName(o) {
    return o.first + ' ' + className(o);
  }

  /* ================= drawing ============================================ */
  function fmt(v) { return Math.round(v * 10000) / 10000; }

  function pushSeg(buckets, cap, w, a, b) {
    var key = cap + '|' + w.toFixed(4);
    var arr = buckets[key];
    if (!arr) { arr = buckets[key] = { cap: cap, w: w, d: [] }; }
    arr.d.push('M' + fmt(a[0]) + ' ' + fmt(a[1]) + 'L' + fmt(b[0]) + ' ' + fmt(b[1]));
  }

  /* Lay one glyph's stroke pieces into the width buckets. */
  function emitGlyph(ch, o, penX, gs, buckets) {
    var g = GLYPHS[ch];
    if (!g) return;
    var subs = skeleton(ch);
    var steps = 10;
    var s, i, k;

    for (s = 0; s < subs.length; s++) {
      var segs = subs[s];
      var pts = [[segs[0].x0, segs[0].y0]];
      for (i = 0; i < segs.length; i++) {
        var sg = segs[i];
        if (sg.t === 'L') {
          pts.push([sg.x, sg.y]);
        } else {
          var mx = (sg.x0 + sg.x) / 2, my = (sg.y0 + sg.y) / 2;
          var cx = mx + (sg.cx - mx) * o.round;
          var cy = my + (sg.cy - my) * o.round;
          for (k = 1; k <= steps; k++) {
            var t = k / steps, it = 1 - t;
            pts.push([
              it * it * sg.x0 + 2 * it * t * cx + t * t * sg.x,
              it * it * sg.y0 + 2 * it * t * cy + t * t * sg.y
            ]);
          }
        }
      }

      var n = pts.length;
      if (n < 2) continue;
      var closed = Math.abs(pts[0][0] - pts[n - 1][0]) < 1e-6 &&
                   Math.abs(pts[0][1] - pts[n - 1][1]) < 1e-6;

      if (!closed && o.extend > 0) {
        pts[0] = extend(pts[1], pts[0], o.extend);
        pts[n - 1] = extend(pts[n - 2], pts[n - 1], o.extend);
      }

      /* into user space: x sheared by the slant, y flipped */
      var T = [];
      for (i = 0; i < n; i++) {
        T.push([
          penX + (pts[i][0] * o.widthF + o.slantTan * pts[i][1]) * gs,
          -pts[i][1] * gs
        ]);
      }

      var ws = [];
      for (i = 0; i < n - 1; i++) {
        var dx = T[i + 1][0] - T[i][0], dy = T[i + 1][1] - T[i][1];
        var len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        var w = o.weight * gs * (1 - o.contrast * (Math.abs(dx) / len));
        ws.push(Math.max(0.004, w));
        pushSeg(buckets, o.cap, ws[i], T[i], T[i + 1]);
      }

      /* butt and square finishes notch at every joint, so plug the joints */
      if (o.cap !== 'round') {
        for (i = 1; i < n - 1; i++) {
          dot(buckets, T[i], Math.max(ws[i - 1], ws[i]));
        }
        if (closed) dot(buckets, T[0], Math.max(ws[0], ws[n - 2]));
      }
    }
  }

  function extend(from, tip, amount) {
    var dx = tip[0] - from[0], dy = tip[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return tip;
    return [tip[0] + (dx / len) * amount, tip[1] + (dy / len) * amount];
  }

  function dot(buckets, p, w) {
    var key = 'round|' + w.toFixed(4);
    var arr = buckets[key];
    if (!arr) { arr = buckets[key] = { cap: 'round', w: w, d: [] }; }
    arr.d.push('M' + fmt(p[0]) + ' ' + fmt(p[1]) + 'L' + fmt(p[0] + 0.0004) + ' ' + fmt(p[1]));
  }

  /* ================= layout ============================================= */
  function layout(text, o) {
    var items = [], pen = 0, last = 0;
    for (var i = 0; i < text.length; i++) {
      var raw = text.charAt(i);
      var key = raw.toUpperCase();
      var gs = (raw >= 'a' && raw <= 'z') ? o.smallcap : 1;
      if (!GLYPHS[key]) {
        pen += SPACE_W * o.widthF + o.tracking;
        continue;
      }
      items.push({ ch: key, gs: gs, pen: pen });
      last = GLYPHS[key].w * o.widthF * gs;
      pen += last + o.tracking;
    }
    return { items: items, width: Math.max(0.1, pen - o.tracking) };
  }

  function svgFor(text, o) {
    var lay = layout(text, o);
    var buckets = {};
    for (var i = 0; i < lay.items.length; i++) {
      emitGlyph(lay.items[i].ch, o, lay.items[i].pen, lay.items[i].gs, buckets);
    }
    var pad = o.weight * 0.62 + o.extend + 0.02;
    var lean = Math.max(0, o.slantTan);
    var back = Math.max(0, -o.slantTan);
    var minX = -pad - back;
    var minY = -1 - pad;
    var vw = lay.width + pad * 2 + lean + back;
    var vh = 1 + pad * 2 + 0.26;

    var out = '';
    for (var key in buckets) {
      if (!Object.prototype.hasOwnProperty.call(buckets, key)) continue;
      var b = buckets[key];
      out += '<path d="' + b.d.join('') + '" fill="none" stroke="currentColor"' +
             ' stroke-width="' + fmt(b.w) + '" stroke-linecap="' + b.cap + '"/>';
    }
    return {
      viewBox: fmt(minX) + ' ' + fmt(minY) + ' ' + fmt(vw) + ' ' + fmt(vh),
      body: out,
      ratio: vw / vh
    };
  }

  function paint(el, text, o, fit) {
    if (!el) return;
    var s = svgFor(text, o);
    el.setAttribute('viewBox', s.viewBox);
    el.setAttribute('preserveAspectRatio', fit || 'xMinYMid meet');
    el.innerHTML = s.body;
    return s;
  }

  /* ================= page wiring ======================================== */
  function $(id) { return document.getElementById(id); }

  var CTRL = [
    ['rW', 'vW', 'weight', function (v) { return v.toFixed(3) + ' em'; }],
    ['rX', 'vX', 'widthF', function (v) { return Math.round(v * 100) + '%'; }],
    ['rS', 'vS', 'slant', function (v) { return v.toFixed(1) + '°'; }],
    ['rC', 'vC', 'contrast', function (v) { return Math.round(v * 100) + '%'; }],
    ['rR', 'vR', 'round', function (v) { return v.toFixed(2) + '×'; }],
    ['rT', 'vT', 'tracking', function (v) { return v.toFixed(3) + ' em'; }],
    ['rE', 'vE', 'extend', function (v) { return v.toFixed(3) + ' em'; }],
    ['rSc', 'vSc', 'smallcap', function (v) { return Math.round(v * 100) + '%'; }]
  ];

  var cut, day, pending = null;

  function syncControls() {
    for (var i = 0; i < CTRL.length; i++) {
      var c = CTRL[i], el = $(c[0]);
      if (el) el.value = String(cut[c[2]]);
      var lab = $(c[1]);
      if (lab) lab.textContent = c[3](cut[c[2]]);
    }
    var sel = $('selCap');
    if (sel) sel.value = cut.cap;
  }

  function readout() {
    var name = faceName(cut);
    var style = styleName(cut) || 'Regular';
    $('nameOut').textContent = name;
    $('styleOut').textContent = style;
    $('classOut').textContent = className(cut);
    $('seriesOut').textContent = 'No. ' + cut.series;
    $('capOut').textContent = cut.cap === 'butt' ? 'flat' : cut.cap;
    $('seedOut').textContent = String(cut.seed).padStart(10, '0');
    $('glyphOut').textContent = CHARSET.length + ' drawn';
    $('dayOut').textContent = day.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    document.title = name + ' — The Foundry — Drift';
  }

  function esc(ch) {
    return ch.replace(/&/g, '&amp;').replace(/</g, '&lt;')
             .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function charset() {
    var host = $('charset');
    if (!host) return;
    var html = '';
    for (var i = 0; i < CHARSET.length; i++) {
      var ch = CHARSET.charAt(i);
      var s = svgFor(ch, cut);
      html += '<div class="cellg" title="' + esc(ch) + '">' +
        '<svg class="gsvg" viewBox="' + s.viewBox + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        s.body + '</svg></div>';
    }
    host.innerHTML = html;
  }

  function render() {
    cut.slantTan = Math.tan(cut.slant * Math.PI / 180);
    var name = faceName(cut);
    paint($('svgName'), cut.first.toUpperCase(), cut, 'xMidYMid meet');

    var text = ($('specimenText') && $('specimenText').value) || 'HANDGLOVES';
    if (!text.trim()) text = ' ';
    paint($('svgLine'), text, cut, 'xMidYMid meet');

    var wf = svgFor(name.toUpperCase() + ' ' + cut.series, cut);
    ['wf1', 'wf2', 'wf3', 'wf4'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.setAttribute('viewBox', wf.viewBox);
      el.setAttribute('preserveAspectRatio', 'xMinYMid meet');
      el.innerHTML = wf.body;
    });

    charset();
    readout();
  }

  function schedule() {
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      render();
    });
  }

  function loadDay(d) {
    day = d;
    cut = cutFor(seedForDate(d));
    cut.slantTan = Math.tan(cut.slant * Math.PI / 180);
    var di = $('dateIn');
    if (di) di.value = isoOf(d);
    syncControls();
    render();
  }

  function isoOf(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function shift(days) {
    var d = new Date(day.getTime());
    d.setDate(d.getDate() + days);
    loadDay(d);
  }

  function note(msg) {
    var el = $('noteOut');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(note.t);
    note.t = setTimeout(function () { el.style.opacity = '0'; }, 2600);
  }

  function wire() {
    CTRL.forEach(function (c) {
      var el = $(c[0]);
      if (!el) return;
      el.addEventListener('input', function () {
        cut[c[2]] = parseFloat(el.value);
        $(c[1]).textContent = c[3](cut[c[2]]);
        schedule();
      });
    });

    var sel = $('selCap');
    if (sel) sel.addEventListener('change', function () {
      cut.cap = sel.value;
      schedule();
    });

    var txt = $('specimenText');
    if (txt) txt.addEventListener('input', schedule);

    document.querySelectorAll('[data-say]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-say');
        if (v === '@name') v = faceName(cut).toUpperCase();
        $('specimenText').value = v;
        document.querySelectorAll('[data-say]').forEach(function (o) {
          o.classList.remove('on');
        });
        b.classList.add('on');
        schedule();
      });
    });

    var bind = function (id, fn) {
      var el = $(id);
      if (el) el.addEventListener('click', fn);
    };

    bind('btnToday', function () { loadDay(new Date()); note('Back on today’s cut.'); });
    bind('btnPrev', function () { shift(-1); });
    bind('btnNext', function () { shift(1); });
    bind('btnRandom', function () {
      cut = cutFor((Math.random() * 4294967295) >>> 0);
      cut.slantTan = Math.tan(cut.slant * Math.PI / 180);
      syncControls();
      render();
      note('A cut from no particular day: ' + faceName(cut) + '.');
    });
    bind('btnCopy', function () {
      var text = ($('specimenText') && $('specimenText').value) || 'HANDGLOVES';
      var s = svgFor(text, cut);
      var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + s.viewBox +
        '" width="' + Math.round(s.ratio * 160) + '" height="160">' +
        '<g color="#111111">' + s.body + '</g></svg>';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(out).then(function () {
          note('Specimen copied as SVG — ' + out.length + ' characters of line work.');
        }, function () { note('The browser would not let go of the clipboard.'); });
      } else {
        note('No clipboard here, but the drawing is ' + out.length + ' characters.');
      }
    });

    var di = $('dateIn');
    if (di) di.addEventListener('change', function () {
      var parts = di.value.split('-').map(Number);
      if (parts.length === 3 && parts[0] > 1900) {
        loadDay(new Date(parts[0], parts[1] - 1, parts[2]));
      }
    });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') { shift(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { shift(1); e.preventDefault(); }
    });
  }

  /* ================= go ================================================= */
  wire();
  loadDay(new Date());
})();
