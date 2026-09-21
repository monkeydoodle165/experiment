/* The Lens — the four views
   drift.quibo.games — needs lens-optics.js first. */
(function (root) {
'use strict';

var O = root.Optics;
var WAVE = [
  { nm: 656.3, col: '#ff7d7d', key: 'C' },
  { nm: 587.6, col: '#ffe08a', key: 'd' },
  { nm: 486.1, col: '#7cabff', key: 'F' }
];

function fit(cv) {
  var dpr = Math.min(root.devicePixelRatio || 1, 2);
  var w = cv.clientWidth || 640, h = cv.clientHeight || 300;
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  var g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g: g, w: w, h: h };
}
function mono(g, px) { g.font = '600 ' + px + 'px ui-monospace,Menlo,monospace'; }

/* glass groups: runs of surfaces joined by glass */
function groups(s) {
  var out = [], i = 0;
  while (i < s.length) {
    if (s[i].gl) {
      var a = i;
      while (i < s.length && s[i].gl) i++;
      out.push({ a: a, b: i });          // surfaces a..i inclusive
      i++;
    } else i++;
  }
  return out;
}

function arcPoints(c, zv, h, n, up) {
  var pts = [], i, y, hh = h;
  if (c) hh = Math.min(h, 0.999 / Math.abs(c));
  for (i = 0; i <= n; i++) {
    y = -hh + (2 * hh) * (i / n);
    if (!up) y = hh - (2 * hh) * (i / n);
    var sg = O.sag(c, y);
    pts.push([zv + (isNaN(sg) ? 0 : sg), y]);
  }
  return pts;
}

/* ---------------- the bench ---------------- */

function drawBench(cv, b, cfg, opt) {
  var F = fit(cv), g = F.g, W = F.w, H = F.h;
  var s = b.surf, zs = b.zs;
  var zimg = opt.zimg, tf = Math.tan(cfg.field * Math.PI / 180);
  var gs = groups(s), i, j;

  var hs = [];
  for (i = 0; i < s.length; i++) hs.push(cfg.aperture * 0.5 + zs[i] * tf + 0.25);
  var gh = [];
  for (i = 0; i < gs.length; i++) {
    var m = 0;
    for (j = gs[i].a; j <= gs[i].b; j++) m = Math.max(m, hs[j]);
    gh.push(m * 1.06);
  }
  var imgH = cfg.f * tf;
  var Hmax = Math.max(cfg.aperture * 0.58, imgH * 1.04);
  for (i = 0; i < gh.length; i++) Hmax = Math.max(Hmax, gh[i]);

  var L = zimg - b.zStart;
  var sc = Math.min((W - 26) / Math.max(L, 1e-6), (H * 0.86) / (2 * Hmax));
  var padX = (W - L * sc) / 2, midY = H / 2;
  function X(z) { return padX + (z - b.zStart) * sc; }
  function Y(y) { return midY - y * sc; }

  g.fillStyle = 'rgba(6,9,14,.85)';
  g.fillRect(0, 0, W, H);

  /* axis */
  g.strokeStyle = 'rgba(255,255,255,.16)';
  g.setLineDash([4, 5]); g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, midY); g.lineTo(W, midY); g.stroke();
  g.setLineDash([]);

  /* rays */
  var fields = opt.fields, waves = opt.waves, NR = 11;
  for (var fi = 0; fi < fields.length; fi++) {
    var th = cfg.field * fields[fi] * Math.PI / 180;
    var dy = Math.sin(th), dz = Math.cos(th);
    var alpha = fi === 0 ? 0.85 : (fi === 1 ? 0.55 : 0.42);
    for (var wi = 0; wi < waves.length; wi++) {
      var w = WAVE[waves[wi]];
      g.strokeStyle = w.col;
      g.globalAlpha = alpha * (waves.length > 1 ? 0.8 : 1);
      g.lineWidth = 1;
      for (var k = 0; k < NR; k++) {
        var py = (-1 + 2 * k / (NR - 1)) * cfg.aperture * 0.5 * 0.985;
        var path = [];
        var r = O.traceRay(b, 0, py + dy * b.zStart, b.zStart, 0, dy, dz, w.nm, path);
        g.beginPath();
        g.moveTo(X(b.zStart), Y(py + dy * b.zStart));
        for (var p = 0; p < path.length; p += 2) g.lineTo(X(path[p]), Y(path[p + 1]));
        if (r && r.dz > 1e-6) {
          var t = (zimg - r.z) / r.dz;
          g.lineTo(X(zimg), Y(r.y + r.dy * t));
        }
        g.stroke();
      }
    }
  }
  g.globalAlpha = 1;

  /* glass */
  for (i = 0; i < gs.length; i++) {
    var h = gh[i];
    for (j = gs[i].a; j < gs[i].b; j++) {
      var front = arcPoints(s[j].c, zs[j], h, 26, true);
      var back = arcPoints(s[j + 1].c, zs[j + 1], h, 26, false);
      g.beginPath();
      g.moveTo(X(front[0][0]), Y(front[0][1]));
      for (var q = 1; q < front.length; q++) g.lineTo(X(front[q][0]), Y(front[q][1]));
      for (q = 0; q < back.length; q++) g.lineTo(X(back[q][0]), Y(back[q][1]));
      g.closePath();
      var gl = s[j].gl;
      g.fillStyle = gl && gl.k === 'flint' ? 'rgba(122,162,255,.20)' : 'rgba(100,240,200,.16)';
      g.fill();
      g.strokeStyle = (opt.sel === j || opt.sel === j + 1) ? '#64f0c8' : 'rgba(255,255,255,.55)';
      g.lineWidth = (opt.sel === j || opt.sel === j + 1) ? 1.8 : 1.1;
      g.stroke();
    }
  }

  /* stop at the front vertex */
  var ap = cfg.aperture * 0.5;
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(X(0), Y(ap)); g.lineTo(X(0), Y(Math.min(Hmax, ap + Hmax * 0.28)));
  g.moveTo(X(0), Y(-ap)); g.lineTo(X(0), Y(-Math.min(Hmax, ap + Hmax * 0.28)));
  g.stroke();

  /* focal plane */
  g.strokeStyle = 'rgba(100,240,200,.75)'; g.lineWidth = 1.4;
  g.setLineDash([5, 4]);
  g.beginPath();
  g.moveTo(X(zimg), Y(-Hmax * 0.96)); g.lineTo(X(zimg), Y(Hmax * 0.96));
  g.stroke();
  g.setLineDash([]);

  /* labels */
  mono(g, 10);
  g.fillStyle = 'rgba(139,151,171,.9)';
  g.fillText('STOP', X(0) - 12, Y(Math.min(Hmax, ap + Hmax * 0.28)) - 6);
  g.fillText('FOCAL PLANE', Math.min(W - 78, X(zimg) - 70), 14);
  var bar = 10;
  while (bar * sc < W * 0.09) bar *= 2;
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.beginPath();
  g.moveTo(14, H - 14); g.lineTo(14 + bar * sc, H - 14);
  g.moveTo(14, H - 18); g.lineTo(14, H - 10);
  g.moveTo(14 + bar * sc, H - 18); g.lineTo(14 + bar * sc, H - 10);
  g.stroke();
  g.fillText(bar + ' mm', 18 + bar * sc, H - 10);
  return { X: X, Y: Y, sc: sc, midY: midY };
}

/* ---------------- spot diagrams ---------------- */

var SPOT_PUP = O.pupil(6, 12);

function drawSpots(cv, b, cfg, zimg, airy) {
  var F = fit(cv), g = F.g, W = F.w, H = F.h;
  var fr = [0, 0.7, 1.0], res = [], i, j;
  var big = airy * 3.2;
  for (i = 0; i < 3; i++) {
    var r = O.spotAt(b, cfg.field * fr[i], [656.3, 587.6, 486.1], SPOT_PUP, zimg);
    res.push(r);
    for (j = 0; j < r.pts.length; j++) {
      big = Math.max(big, Math.abs(r.pts[j].x - r.cx), Math.abs(r.pts[j].y - r.cy));
    }
  }
  big *= 1.12;
  var bw = W / 3, cyy = H * 0.5, rad = Math.min(bw * 0.42, H * 0.38);
  var sc = rad / big;

  g.fillStyle = 'rgba(6,9,14,.85)'; g.fillRect(0, 0, W, H);
  for (i = 0; i < 3; i++) {
    var cx0 = bw * (i + 0.5);
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
    g.strokeRect(cx0 - rad, cyy - rad, rad * 2, rad * 2);
    /* Airy disc */
    g.strokeStyle = 'rgba(100,240,200,.55)';
    g.setLineDash([3, 3]);
    g.beginPath(); g.arc(cx0, cyy, Math.max(1.2, airy * sc), 0, 6.2832); g.stroke();
    g.setLineDash([]);
    var r2 = res[i];
    for (j = 0; j < r2.pts.length; j++) {
      var p = r2.pts[j];
      g.fillStyle = WAVE[p.li].col;
      g.globalAlpha = 0.72;
      var xx = cx0 + (p.x - r2.cx) * sc, yy = cyy - (p.y - r2.cy) * sc;
      g.fillRect(xx - 0.7, yy - 0.7, 1.5, 1.5);
    }
    g.globalAlpha = 1;
    mono(g, 10);
    g.fillStyle = 'rgba(139,151,171,.95)';
    var lab = i === 0 ? 'ON AXIS' : (cfg.field * fr[i]).toFixed(2) + '°';
    g.fillText(lab, cx0 - rad, cyy - rad - 7);
    g.fillStyle = '#e8edf5';
    g.fillText('rms ' + (r2.rms * 1000).toFixed(1) + ' µm', cx0 - rad, cyy + rad + 15);
  }
  mono(g, 10);
  g.fillStyle = 'rgba(139,151,171,.8)';
  g.fillText('box ' + (big * 2000).toFixed(0) + ' µm across · dashed circle is the Airy disc', 8, H - 6);
  return res;
}

/* ---------------- ray fans ---------------- */

function drawFan(cv, b, cfg, zimg) {
  var F = fit(cv), g = F.g, W = F.w, H = F.h;
  g.fillStyle = 'rgba(6,9,14,.85)'; g.fillRect(0, 0, W, H);
  var panels = [0, 1.0], N = 41, i, k, wi;
  var data = [], maxE = 1e-9;
  for (i = 0; i < 2; i++) {
    var th = cfg.field * panels[i] * Math.PI / 180;
    var dy = Math.sin(th), dz = Math.cos(th);
    var chief = null, set = [];
    for (wi = 0; wi < 3; wi++) {
      var arr = [];
      for (k = 0; k < N; k++) {
        var u = -1 + 2 * k / (N - 1);
        var py = u * cfg.aperture * 0.5 * 0.985;
        var r = O.traceRay(b, 0, py + dy * b.zStart, b.zStart, 0, dy, dz, WAVE[wi].nm, null);
        if (!r || r.dz <= 1e-6) { arr.push(null); continue; }
        var t = (zimg - r.z) / r.dz;
        var yy = r.y + r.dy * t;
        if (wi === 1 && k === (N - 1) / 2) chief = yy;
        arr.push(yy);
      }
      set.push(arr);
    }
    if (chief === null) chief = 0;
    for (wi = 0; wi < 3; wi++) for (k = 0; k < N; k++) {
      if (set[wi][k] === null) continue;
      set[wi][k] -= chief;
      maxE = Math.max(maxE, Math.abs(set[wi][k]));
    }
    data.push(set);
  }
  maxE *= 1.1;
  var pw = W / 2;
  for (i = 0; i < 2; i++) {
    var x0 = pw * i + 34, x1 = pw * (i + 1) - 14, my = H * 0.5;
    var hy = H * 0.34;
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0, my); g.lineTo(x1, my);
    g.moveTo((x0 + x1) / 2, my - hy); g.lineTo((x0 + x1) / 2, my + hy);
    g.stroke();
    for (wi = 0; wi < 3; wi++) {
      g.strokeStyle = WAVE[wi].col; g.lineWidth = 1.4; g.globalAlpha = .9;
      g.beginPath();
      var started = false;
      for (k = 0; k < N; k++) {
        var v = data[i][wi][k];
        if (v === null) { started = false; continue; }
        var xx = x0 + (x1 - x0) * (k / (N - 1));
        var yy2 = my - (v / maxE) * hy;
        if (!started) { g.moveTo(xx, yy2); started = true; } else g.lineTo(xx, yy2);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    mono(g, 10);
    g.fillStyle = 'rgba(139,151,171,.95)';
    g.fillText(i === 0 ? 'ON AXIS' : 'FULL FIELD ' + cfg.field.toFixed(2) + '°', x0, my - hy - 8);
    g.fillText('±' + (maxE * 1000).toFixed(1) + ' µm', x0, my + hy + 15);
  }
  g.fillStyle = 'rgba(139,151,171,.8)';
  mono(g, 10);
  g.fillText('transverse aberration against pupil height', 8, H - 6);
}

/* ---------------- what it sees ---------------- */

function drawChart(g, S) {
  var i, a;
  g.fillStyle = '#05070b'; g.fillRect(0, 0, S, S);
  var c = S / 2;
  /* central siemens star */
  g.fillStyle = '#eef3fb';
  for (i = 0; i < 36; i++) {
    a = i * Math.PI / 18;
    if (i % 2) continue;
    g.beginPath();
    g.moveTo(c, c);
    g.arc(c, c, S * 0.24, a, a + Math.PI / 18);
    g.closePath(); g.fill();
  }
  /* four smaller ones out in the field */
  var off = S * 0.33;
  var spots = [[c - off, c - off], [c + off, c - off], [c - off, c + off], [c + off, c + off]];
  for (var q = 0; q < 4; q++) {
    for (i = 0; i < 24; i++) {
      if (i % 2) continue;
      a = i * Math.PI / 12;
      g.beginPath();
      g.moveTo(spots[q][0], spots[q][1]);
      g.arc(spots[q][0], spots[q][1], S * 0.085, a, a + Math.PI / 12);
      g.closePath(); g.fill();
    }
  }
  /* point sources round the frame */
  for (i = 0; i < 16; i++) {
    a = i * Math.PI / 8;
    var rr = S * (i % 2 ? 0.44 : 0.30);
    g.beginPath();
    g.arc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, S * 0.006, 0, 6.2832);
    g.fill();
  }
  /* colour patches, to make lateral colour obvious */
  var cols = ['#ff5f5f', '#5fff9f', '#6fa8ff'];
  for (i = 0; i < 3; i++) {
    g.fillStyle = cols[i];
    g.fillRect(c - S * 0.075 + i * S * 0.05, S * 0.035, S * 0.038, S * 0.055);
    g.fillRect(c - S * 0.075 + i * S * 0.05, S * 0.91, S * 0.038, S * 0.055);
  }
  /* resolution bars either side */
  g.fillStyle = '#eef3fb';
  for (var side = 0; side < 2; side++) {
    var bx = side ? S * 0.86 : S * 0.055;
    for (i = 0; i < 7; i++) {
      var w = S * 0.085, hh = Math.max(1, S * 0.011 - i * S * 0.0011);
      g.fillRect(bx, c - S * 0.09 + i * S * 0.028, w, hh);
    }
  }
}

function renderSeen(cv, b, cfg, zimg) {
  var S = 128, AZ = 12, ZN = 4;
  var LAM = [640, 545, 462];
  var halfS = S / 2;
  var mmPerPx = (cfg.f * Math.tan(cfg.field * Math.PI / 180)) / halfS;
  if (!(mmPerPx > 0)) return false;

  /* the chart, drawn big and shrunk so the edges are clean */
  var hi = document.createElement('canvas'); hi.width = hi.height = S * 4;
  drawChart(hi.getContext('2d'), S * 4);
  var lo = document.createElement('canvas'); lo.width = lo.height = S;
  var lg = lo.getContext('2d');
  lg.drawImage(hi, 0, 0, S, S);
  var idat = lg.getImageData(0, 0, S, S).data;
  var src = [new Float32Array(S * S), new Float32Array(S * S), new Float32Array(S * S)];
  for (var pxi = 0; pxi < S * S; pxi++) {
    src[0][pxi] = idat[pxi * 4] / 255;
    src[1][pxi] = idat[pxi * 4 + 1] / 255;
    src[2][pxi] = idat[pxi * 4 + 2] / 255;
  }

  /* ray offsets per zone and channel, about the green centroid */
  var PUPK = O.pupil(6, 14);
  var par = O.paraxial(b.surf, 587.6);
  var fnow = par ? par.f : cfg.f;
  var N = fnow / cfg.aperture;
  var raw = [], maxr = 0.6, zi, ci, i;
  for (zi = 0; zi < ZN; zi++) {
    var th = cfg.field * (zi / (ZN - 1));
    var green = O.spotAt(b, th, [LAM[1]], PUPK, zimg);
    var ch = [];
    for (ci = 0; ci < 3; ci++) {
      var sp = ci === 1 ? green : O.spotAt(b, th, [LAM[ci]], PUPK, zimg);
      var arr = [];
      for (i = 0; i < sp.pts.length; i++) {
        var ox = (sp.pts[i].x - green.cx) / mmPerPx;
        var oy = (sp.pts[i].y - green.cy) / mmPerPx;
        if (!isFinite(ox) || !isFinite(oy)) continue;
        arr.push(ox, oy);
        var m = Math.max(Math.abs(ox), Math.abs(oy));
        if (m > maxr) maxr = m;
      }
      ch.push(arr);
    }
    raw.push(ch);
  }
  var sig = [];
  for (ci = 0; ci < 3; ci++) sig.push(Math.max(0.28, 0.45 * 1.22 * (LAM[ci] / 1e6) * N / mmPerPx));
  var sigMax = Math.max(sig[0], sig[1], sig[2]);
  maxr = Math.min(maxr, 11);
  var K = O.clamp(2 * Math.ceil(maxr + 2.2 * sigMax) + 1, 3, 25);
  var half = (K - 1) / 2;

  /* kernels: zone x azimuth x channel */
  var kern = [];
  for (zi = 0; zi < ZN; zi++) {
    var byAz = [];
    for (var ai = 0; ai < AZ; ai++) {
      var psi = 2 * Math.PI * ai / AZ, cs = Math.cos(psi), sn = Math.sin(psi);
      var chK = [];
      for (ci = 0; ci < 3; ci++) {
        var Kk = new Float32Array(K * K), arr2 = raw[zi][ci], tot = 0;
        var sg = sig[ci], rad = Math.max(1, Math.ceil(2.4 * sg));
        for (i = 0; i < arr2.length; i += 2) {
          var ox2 = arr2[i], oy2 = arr2[i + 1];
          var rx = ox2 * cs + oy2 * sn;
          var ry = -ox2 * sn + oy2 * cs;
          var fc = half + rx, fr = half - ry;
          var i0 = Math.round(fc), j0 = Math.round(fr);
          for (var jj = j0 - rad; jj <= j0 + rad; jj++) {
            if (jj < 0 || jj >= K) continue;
            for (var ii = i0 - rad; ii <= i0 + rad; ii++) {
              if (ii < 0 || ii >= K) continue;
              var ddx = ii - fc, ddy = jj - fr;
              var wgt = Math.exp(-(ddx * ddx + ddy * ddy) / (2 * sg * sg));
              Kk[jj * K + ii] += wgt; tot += wgt;
            }
          }
        }
        if (tot <= 0) { Kk[half * K + half] = 1; tot = 1; }
        for (i = 0; i < Kk.length; i++) Kk[i] /= tot;
        chK.push(Kk);
      }
      byAz.push(chK);
    }
    kern.push(byAz);
  }

  /* convolve */
  var out = [new Float32Array(S * S), new Float32Array(S * S), new Float32Array(S * S)];
  var TAU = 2 * Math.PI;
  for (var y = 0; y < S; y++) {
    for (var x = 0; x < S; x++) {
      var dx = x - halfS + 0.5, dy = -(y - halfS + 0.5);
      var rr = Math.sqrt(dx * dx + dy * dy) / halfS;
      var z = O.clamp(Math.round(rr * (ZN - 1)), 0, ZN - 1);
      var p2 = Math.atan2(dx, dy);
      var a2 = ((Math.round(p2 / TAU * AZ) % AZ) + AZ) % AZ;
      for (ci = 0; ci < 3; ci++) {
        var Kk2 = kern[z][a2][ci], acc = 0, sarr = src[ci];
        for (var ky = -half; ky <= half; ky++) {
          var sy = y - ky; if (sy < 0) sy = 0; else if (sy >= S) sy = S - 1;
          var row = sy * S, ko = (ky + half) * K + half;
          for (var kx = -half; kx <= half; kx++) {
            var sx = x - kx; if (sx < 0) sx = 0; else if (sx >= S) sx = S - 1;
            acc += sarr[row + sx] * Kk2[ko + kx];
          }
        }
        out[ci][y * S + x] = acc;
      }
    }
  }

  /* paint: source left, image right */
  var res = document.createElement('canvas'); res.width = res.height = S;
  var rg = res.getContext('2d');
  var od = rg.createImageData(S, S);
  for (i = 0; i < S * S; i++) {
    od.data[i * 4] = O.clamp(out[0][i] * 255, 0, 255);
    od.data[i * 4 + 1] = O.clamp(out[1][i] * 255, 0, 255);
    od.data[i * 4 + 2] = O.clamp(out[2][i] * 255, 0, 255);
    od.data[i * 4 + 3] = 255;
  }
  rg.putImageData(od, 0, 0);

  var F = fit(cv), g = F.g, W = F.w, H = F.h;
  g.fillStyle = 'rgba(6,9,14,.9)'; g.fillRect(0, 0, W, H);
  var side = Math.min(H - 26, (W - 24) / 2);
  var x0 = (W / 2 - side) / 2, x1 = W / 2 + (W / 2 - side) / 2, yy0 = (H - side) / 2 + 6;
  g.imageSmoothingEnabled = true;
  g.drawImage(lo, x0, yy0, side, side);
  g.drawImage(res, x1, yy0, side, side);
  g.strokeStyle = 'rgba(255,255,255,.14)';
  g.strokeRect(x0, yy0, side, side);
  g.strokeRect(x1, yy0, side, side);
  mono(g, 10);
  g.fillStyle = 'rgba(139,151,171,.95)';
  g.fillText('THE CHART', x0, yy0 - 7);
  g.fillText('THROUGH YOUR LENS', x1, yy0 - 7);
  g.fillText('frame is ' + (2 * cfg.f * Math.tan(cfg.field * Math.PI / 180)).toFixed(1) +
             ' mm across · kernel ' + K + ' px', x0, yy0 + side + 14);
  return true;
}

root.LensDraw = {
  WAVE: WAVE, fit: fit, drawBench: drawBench, drawSpots: drawSpots,
  drawFan: drawFan, renderSeen: renderSeen, groups: groups
};

})(window);
