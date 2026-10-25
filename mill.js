/* drift.quibo.games — The Mill
   A day's grinding at an English windmill some time between 1760 and 1850, on today's calendar date.
   The day's number picks the year, and with it the mill: a post mill or a tower mill, common sails of
   canvas spread over a lattice or (from 1807) Cubitt's patent shutters worked from the ground, a fantail
   that keeps her into the wind by itself or a tailpole and a strong back, and perhaps a centrifugal
   governor that tenters the stones as she speeds up and slows down. It also writes the wind for the day
   (a mean, the way it builds towards the afternoon and falls at evening, wanderings in strength and
   direction, a lull, and squalls that come in under a dark line of cloud and leave the wind veered), and
   it fills the floor with sacks: wheat for the baker, barley for the pigs, oats for the carrier's horses.

   The page models the mill closely enough to bite. The sails drive against the stones and the gearing; a
   sail goes faster the less it is loaded, up to a runaway speed set by the wind; a common sail can only
   be reefed with the mill stopped and the brake on; the brake is a ring of wooden blocks on a wooden
   wheel and gets hot; stones that run empty or too fast burn the meal; and a mill caught with the wind
   behind her is tail-winded and wrecked. Self-contained. */
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
    var h = s ^ 0x5a17c3e1;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { return (r() + r() + r() + r() - 2) * 1.7; }
  function smooth(e) { e = clamp(e, 0, 1); return e * e * (3 - 2 * e); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
  function words(n) { return n < WORDS.length ? WORDS[n] : String(n); }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function clock(hrs) {
    var m = Math.round(hrs * 60), h = Math.floor(m / 60) % 24, mm = m % 60;
    var ap = h < 12 ? 'a.m.' : 'p.m.', h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + '.' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  var POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function point(deg) { return POINTS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }
  var EIGHT = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function pointName(deg) { return EIGHT[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
  function adiff(a, b) { var d = ((a - b) % 360 + 540) % 360 - 180; return d; }
  function half(g) { var w = Math.floor(g + 1e-6), f = g - w; return f > 0.25 && f < 0.75 ? w + '½' : String(Math.round(g)); }

  /* ---------- the machine ---------- */
  var RSAIL = 11;              // sail radius, metres
  var GEAR = 7.5;              // stone turns for each turn of the sails
  var LMAX = 3.6;              // tip speed ratio at which an unloaded sail runs away
  var INERTIA = 50;
  var BRAKE = 60;
  var SACK = 4;                // bushels in a coomb, which is a sack
  var RATE = 5.5;              // bushels an hour at full feed with the stones at 120
  var CLOTH = ['furled', 'dagger point', 'sword point', 'first reef', 'full sail'];
  var SHUTTERS = ['shut off', 'a quarter open', 'half open', 'three parts open', 'wide open'];
  var AREA = [0.07, 0.3, 0.52, 0.76, 1];
  var FEEDS = ['shut', 'slack', 'middling', 'full'];
  var FEEDQ = [0, 0.45, 0.72, 1];
  var KINDS = {
    fine:   { grain: 'wheat',  what: 'fine flour for the oven',     lo: 70, hi: 84, load: 1.0, short: 'fine flour' },
    house:  { grain: 'wheat',  what: 'household flour',             lo: 56, hi: 70, load: 1.0, short: 'household' },
    barley: { grain: 'barley', what: 'barley meal for the pigs',    lo: 34, hi: 50, load: 0.9, short: 'barley meal' },
    oats:   { grain: 'oats',   what: 'crushed oats for the horses', lo: 18, hi: 32, load: 0.7, short: 'crushed oats' },
    beans:  { grain: 'beans',  what: 'split beans for the bullocks', lo: 6, hi: 20, load: 1.2, short: 'split beans' }
  };

  function sunFor(d) {
    var n = Math.round((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    var decl = 23.44 * Math.sin(2 * Math.PI * (284 + n) / 365) * Math.PI / 180;
    var phi = 52.3 * Math.PI / 180;
    var w = Math.acos(clamp(-Math.tan(phi) * Math.tan(decl), -1, 1)) * 180 / Math.PI;
    return { rise: 12 - w / 15, set: 12 + w / 15 };
  }

  function fineness(gap, stone, feed) {
    var f = 100 - 9 * gap + 0.3 * (stone - 120) - 6 * (feed - 2);
    if (stone < 60) f -= 0.6 * (60 - stone);
    return clamp(f, 0, 100);
  }
  function gapFor(mid, stone, feed) {
    var low = stone < 60 ? 0.6 * (60 - stone) : 0;
    return clamp((100 + 0.3 * (stone - 120) - 6 * (feed - 2) - low - mid) / 9, 1, 10);
  }

  var SURN = ['Gedge', 'Ling', 'Rowe', 'Blowers', 'Catchpole', 'Thurlow', 'Spink', 'Moss', 'Kerridge', 'Pettit', 'Rush', 'Fiske', 'Mayhew',
    'Gooderham', 'Plumb', 'Saunders', 'Crisp', 'Lummis', 'Fenn', 'Haward', 'Bloomfield', 'Clarke', 'Tye', 'Woolnough', 'Baldry', 'Aldous', 'Steggles', 'Durrant'];
  var PRE = ['Ash', 'Brad', 'Cot', 'Dal', 'Earl', 'Fram', 'Great', 'Hen', 'Ixw', 'Ken', 'Lax', 'Mell', 'New', 'Ock', 'Pet', 'Rat', 'Sax', 'Thel', 'Wal', 'Wix',
    'Brun', 'Cret', 'Deb', 'Hol', 'Lid', 'Pak', 'Stow', 'Wort', 'Bur', 'Cop'];
  var SUF = ['field', 'ham', 'ley', 'den', 'ton', 'well', 'ingham', 'stead', 'by', 'worth', 'mere', 'thorpe', 'ingfield', 'sett', 'ing'];
  var WHO = {
    fine: ['the baker at {v}', 'Mr {s}, baker', 'the Hall kitchen at {v}'],
    house: ['Mrs {s}', 'the Widow {s}', 'old {s} the shepherd', 'the cottagers of {v} Street', 'the parson at {v}'],
    barley: ['Farmer {s}', 'Mr {s} of {v} Hall Farm', 'the {s} brothers'],
    oats: ['the carrier, {s}', 'the landlord of the Bell at {v}', 'Farmer {s}'],
    beans: ['Mr {s}, grazier', 'Farmer {s}', 'the bailiff at {v} Park']
  };

  /* ---------- the day ---------- */
  function build(seed, date) {
    var r = rng(seed), D = { seed: seed, date: date };
    D.year = 1760 + Math.floor(r() * 91);
    var used = {};
    function vname() { for (var g = 0; g < 40; g++) { var s = pick(r, PRE) + pick(r, SUF); if (!used[s]) { used[s] = 1; return s; } } return 'Market ' + pick(r, PRE) + 'ton'; }
    D.village = vname();
    D.miller = pick(r, SURN);
    D.tower = r() < (D.year < 1790 ? 0.3 : 0.5);
    D.fantail = D.tower ? (D.year >= 1765 && r() < 0.55) : (D.year >= 1800 && r() < 0.3);
    D.patent = D.year >= 1807 && r() < 0.45;
    D.governor = D.year >= 1790 && r() < 0.4;
    var sun = sunFor(date);
    D.start = Math.max(6, Math.ceil(sun.rise * 4) / 4);
    D.end = Math.min(20, sun.set);
    D.sunset = sun.set;
    var mins = Math.round((D.end - D.start) * 60);

    /* the wind, a value a minute */
    var mean = 8 + r() * 9;
    var dir0 = (pick(r, [225, 240, 250, 270, 200, 180, 300, 315, 45, 90, 230, 260]) + gauss(r) * 12 + 360) % 360;
    var p = [r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3], dperiod = 240 + r() * 200, drift = (r() - 0.5) * 8;
    D.squalls = [];
    var nsq = r() < 0.22 ? 0 : r() < 0.65 ? 1 : 2;
    for (var k = 0; k < nsq; k++) {
      for (var g = 0; g < 30; g++) {
        var at = 90 + r() * Math.max(10, mins - 200);
        if (D.squalls.every(function (q) { return Math.abs(q.at - at) > 130; })) {
          D.squalls.push({ at: at, dur: 15 + r() * 22, mult: 1.5 + r() * 0.45, veer: (r() < 0.8 ? 1 : -1) * (35 + r() * 45) });
          break;
        }
      }
    }
    D.squalls.sort(function (a, b) { return a.at - b.at; });
    D.lull = r() < 0.45 ? { at: 40 + r() * Math.max(10, mins - 120), dur: 30 + r() * 45, mult: 0.22 + r() * 0.2 } : null;
    D.sp = new Float32Array(mins + 2); D.dir = new Float32Array(mins + 2);
    for (var m = 0; m <= mins + 1; m++) {
      var h = D.start + m / 60;
      var v = mean * (0.72 + 0.38 * Math.sin(Math.PI * clamp((h - 6) / 14, 0, 1)));
      v *= 1 + 0.16 * Math.sin(2 * Math.PI * m / 97 + p[0]) + 0.1 * Math.sin(2 * Math.PI * m / 41 + p[1]) + 0.06 * Math.sin(2 * Math.PI * m / 17 + p[2]);
      var d = dir0 + 22 * Math.sin(2 * Math.PI * m / dperiod + p[3]) + drift * m / 60;
      D.squalls.forEach(function (q) {
        var e = m < q.at ? 0 : m < q.at + 4 ? smooth((m - q.at) / 4) : m < q.at + q.dur ? 1 : 1 - smooth((m - q.at - q.dur) / 10);
        v *= 1 + (q.mult - 1) * e;
        d += q.veer * smooth((m - q.at) / 5);
      });
      if (D.lull) {
        var L = D.lull, el = m < L.at ? 0 : m < L.at + 8 ? smooth((m - L.at) / 8) : m < L.at + L.dur ? 1 : 1 - smooth((m - L.at - L.dur) / 8);
        v *= 1 - (1 - L.mult) * el;
      }
      D.sp[m] = clamp(v, 0.6, 37); D.dir[m] = ((d % 360) + 360) % 360;
    }
    D.gp = [r() * 6.3, r() * 6.3, r() * 6.3];

    /* the floor: how many sacks the day can take, and whose */
    var work = 0;
    for (m = 0; m < mins; m++) if (D.sp[m] >= 8 && D.sp[m] <= 30) work++;
    D.nsacks = clamp(Math.round(work / 60 * RATE * 0.52 / SACK), 3, 12);
    D.orders = []; D.sacks = [];
    var left = D.nsacks, last = null, kinds = Object.keys(KINDS);
    while (left > 0) {
      var kind; do { kind = pick(r, kinds); } while (kind === last);
      last = kind;
      var n = Math.min(left, 1 + Math.floor(r() * 3));
      var who = pick(r, WHO[kind]).replace('{s}', pick(r, SURN)).replace('{v}', r() < 0.5 ? D.village : vname());
      var o = { who: who, kind: kind, n: n, idx: D.orders.length };
      D.orders.push(o);
      for (k = 0; k < n; k++) D.sacks.push({ order: o, k: k });
      left -= n;
    }
    return D;
  }

  function windAt(D, t) {
    var mm = t / 60, i = Math.floor(mm), f = mm - i;
    i = clamp(i, 0, D.sp.length - 2);
    var v = D.sp[i] * (1 - f) + D.sp[i + 1] * f;
    var da = adiff(D.dir[i + 1], D.dir[i]);
    var d = (D.dir[i] + da * f + 360) % 360;
    var g = 1 + 0.11 * Math.sin(t / 23 + D.gp[0]) * Math.sin(t / 61 + D.gp[1]) + 0.05 * Math.sin(t / 7.3 + D.gp[2]);
    return { v: v * g, d: d };
  }

  /* ---------- a working day, one second at a time ---------- */
  function newDay(D) {
    var w = windAt(D, 0);
    return {
      t: 0, om: 0, ang: 0, face: (w.d + 8 + 360) % 360, cloth: 3, brake: true, feed: 2, gap: 5, gov: false,
      hop: 0, next: 0, cur: null, queue: null, heat: 0, bheat: 0, dmg: 0, busy: null, done: [], end: null, state: 'ready',
      track: [], bell: false, warned: {}, notes: {}, msgs: [], peakOm: 0, idleEmpty: 0, ground: 0
    };
  }

  function stepDay(D, S, dt) {
    var w = windAt(D, S.t), v = w.v, vms = v / 2.237;
    var mis = adiff(w.d, S.face), am = Math.abs(mis);
    if (D.fantail) {
      var rate = 0.3 * clamp(v / 12, 0.2, 1.6);
      S.face = (S.face + clamp(mis, -rate * dt, rate * dt) + 360) % 360;
    }
    if (am > 110 && v > 9) { S.end = 'tail'; return; }
    var align = am < 90 ? Math.pow(Math.cos(am * Math.PI / 180), 2) : 0;
    var A = AREA[S.cloth];
    if (D.patent && v > 22) A *= Math.pow(22 / v, 1.5);
    var lam = (S.om * 2 * Math.PI * RSAIL / 60) / Math.max(vms, 0.3);
    var Qs = A * align * vms * vms * (1 - lam / LMAX);
    Qs = Math.max(Qs, -0.25 * A * vms * vms - 0.4 * S.om);
    var stone = S.om * GEAR;
    var kind = S.cur ? KINDS[S.cur.kind] : null;
    var q = 0;
    if (S.hop > 0) { q = FEEDQ[S.feed] * stone / 120 * RATE / 3600; q = Math.min(q, S.hop / dt); }
    if (D.governor && S.gov && kind && stone > 30) {
      var tg = gapFor((kind.lo + kind.hi) / 2, stone, S.feed);
      S.gap = clamp(S.gap + clamp(tg - S.gap, -0.02 * dt, 0.02 * dt), 1, 10);
    }
    var fin = fineness(S.gap, stone, S.feed);
    var Ql = 1 + 0.3 * S.om + q * 3600 * 2.1 * (kind ? kind.load : 1) * (0.5 + fin / 100) + (S.hop <= 0 && S.gap < 2 ? 2 : 0);
    var Qb = S.brake ? BRAKE : 0;
    var net = Qs - Ql;
    if (S.om <= 0.001 && net <= Qb) S.om = 0;
    else S.om = Math.max(0, S.om + dt * (net - (S.om > 0 ? Qb : 0)) / INERTIA);
    S.peakOm = Math.max(S.peakOm, S.om);

    /* heat in the brake and the stones */
    S.bheat = Math.max(0, S.bheat + dt * ((S.brake ? S.om * 0.012 : 0) - 0.02));
    if (S.bheat > 100) { S.end = 'brakefire'; return; }
    var empty = S.hop <= 0 && stone > 20;
    var hr = (stone > 150 ? (stone - 150) * 0.004 : 0) + (empty ? (10.5 - S.gap) * 0.016 * stone / 120 : 0) - 0.02 - q * 3600 * 0.004;
    S.heat = clamp(S.heat + dt * hr, 0, 110);
    if (empty) S.idleEmpty += dt;
    if (S.heat > 100 && empty && S.gap <= 3) { S.end = 'stonefire'; return; }
    if (S.om > 30) S.dmg += (S.om - 30) * dt * 0.012;
    else S.dmg = Math.max(0, S.dmg - dt * 0.002);
    if (S.om > 40 || S.dmg >= 4) { S.end = 'wreck'; return; }

    /* the meal */
    if (q > 0 && S.cur) {
      var take = Math.min(q * dt, S.cur.left);
      S.cur.left -= take;
      S.cur.fs += fin * take; S.cur.q += take; S.ground += take;
      if (S.heat > 60) S.cur.burnt += take;
      S.cur.fmin = Math.min(S.cur.fmin, fin); S.cur.fmax = Math.max(S.cur.fmax, fin);
      if (S.cur.left < 1e-6) finishSack(D, S);
      S.hop = (S.cur ? S.cur.left : 0) + (S.queue ? S.queue.left : 0);
    }
    S.fin = fin; S.stone = stone; S.wind = w; S.mis = mis;

    /* jobs that take time */
    if (S.busy) {
      if (S.busy.still && S.om > 1) { S.msgs.push('The sails have begun to turn under you and you come down off the stocks in a hurry. The wind is too strong for the brake with this much cloth spread.'); S.busy = null; }
      else { S.busy.left -= dt; if (S.busy.left <= 0) { var b = S.busy; S.busy = null; b.then(); } }
    }
    D.squalls.forEach(function (sq, i) {
      if (!S.warned[i] && S.t >= (sq.at - 25) * 60) {
        S.warned[i] = 1;
        var wd = windAt(D, sq.at * 60 + 300).d;
        S.msgs.push('A dark line of cloud is standing up out of the ' + pointName(wd) + '. Old millers would have the sails reefed and the mill turned to meet it before it comes.');
      }
    });
    S.t += dt;
    if (S.t % 30 < dt) S.track.push([S.t, v, S.om, q > 0 ? fin : null, S.heat]);
    if (D.start + S.t / 3600 >= D.end) S.end = 'dark';
  }

  function finishSack(D, S) {
    var c = S.cur, k = KINDS[c.kind], fin = c.q > 0 ? c.fs / c.q : 0, res;
    if (c.burnt / Math.max(c.q, 1e-6) > 0.25) res = 'burnt';
    else if (fin < k.lo - 1) res = 'coarse';
    else if (fin > k.hi + 1) res = 'fine';
    else res = 'good';
    S.done.push({ sack: c.sack, kind: c.kind, fin: fin, res: res, at: D.start + S.t / 3600, fmin: c.fmin, fmax: c.fmax });
    S.cur = S.queue || null; S.queue = null; S.bell = false;
    S.msgs.push(sackLine(D, S.done[S.done.length - 1]));
    if (S.cur) { var k2 = KINDS[S.cur.kind]; if (S.cur.kind !== c.kind) S.msgs.push(S.msgs.pop() + ' The ' + k2.grain + ' for ' + S.cur.sack.order.who + ' is running through behind it now: ' + k2.short + ', ' + k2.lo + ' to ' + k2.hi + '.'); }
    if (!S.cur && S.next >= D.sacks.length) S.end = 'done';
  }
  function sackLine(D, s) {
    var k = KINDS[s.kind], who = s.sack.order.who;
    if (s.res === 'good') return 'A sack of ' + k.short + ' for ' + who + ' comes off the spout, and it feels right between your finger and thumb.';
    if (s.res === 'coarse') return 'A sack for ' + who + ' is done, but it is rough: ' + Math.round(s.fin) + ' on the page’s scale, when ' + k.short + ' wants ' + k.lo + ' to ' + k.hi + '.';
    if (s.res === 'fine') return 'A sack for ' + who + ' is done, ground finer than they asked (' + Math.round(s.fin) + ', for ' + k.lo + ' to ' + k.hi + '), which took wind and stone you did not need to spend.';
    return 'A sack for ' + who + ' is done, but the stones were hot and the meal smells scorched. Nobody will want it.';
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var scene = $('scene'), sctx = scene.getContext('2d');
  var chart = $('chart'), cctx = chart.getContext('2d');
  var SW = scene.width, SH = scene.height, CW = chart.width, CH = chart.height;
  var dayOff = 0, D, S, raf = null, lastTs = 0, paused = false, hurry = false, finished = false, lastHud = 0, clouds = [];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function say(s) { $('msg').innerHTML = s || ''; }

  function load() {
    stopLoop();
    var date = dateFor(dayOff);
    D = build(seedForDate(date), date);
    S = newDay(D);
    finished = false; paused = false;
    var cr = rng(D.seed ^ 0x3c3c);
    clouds = [];
    for (var i = 0; i < 7; i++) clouds.push({ x: cr() * SW, y: 30 + cr() * 120, s: 0.6 + cr() * 0.9 });
    $('plWho').textContent = WEEKDAYS[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + D.year + ' · ' + (D.tower ? 'a tower mill' : 'a post mill');
    $('plName').textContent = D.village + ' Mill';
    var sails = D.patent ? 'She has <b>Cubitt’s patent sails</b>: shutters like a Venetian blind, opened and closed from the ground by a chain while she runs, and weighted so they spill a gust by themselves.'
      : 'She has <b>common sails</b>: canvas spread over a lattice on each of the four sails. To reef, you must stop her, put the brake on, and work each sail in turn as it is brought to the bottom.';
    var wind = D.fantail ? 'A <b>fantail</b> on her ' + (D.tower ? 'cap' : 'tail ladder') + ' turns her into the wind by itself.'
      : 'There is <b>no fantail</b>. When the wind shifts, you stop her and ' + (D.tower ? 'wind the cap round by its chain wheel' : 'put your back to the tailpole and push the whole body round on its post') + '. Let the wind get behind the sails and she will be tail-winded.';
    var gov = D.governor ? ' A <b>centrifugal governor</b> on the stone spindle will tenter the stones for you as she speeds up and slows down, if you let it.' : '';
    $('plBlurb').innerHTML = 'Miller ' + D.miller + '’s ' + (D.tower ? 'brick tower' : 'post') + ' mill on the rise above ' + D.village + ', one pair of stones. ' + sails + ' ' + wind + gov +
      ' There are <b>' + words(D.nsacks) + ' sacks</b> on the floor, four bushels to the sack, and the light goes at <b>' + clock(D.sunset) + '</b>';
    $('rules').innerHTML = '<span><b>Space</b> start / pause</span><span><b>K</b> brake</span><span><b>+ −</b> ' + (D.patent ? 'shutters' : 'cloth') + '</span><span><b>T</b> tip a sack</span>' +
      (D.fantail ? '' : '<span><b>W</b> wind her round</span>') + '<span><b>[ ]</b> feed</span><span><b>C O</b> close or open the stones</span>' + (D.governor ? '<span><b>G</b> governor</span>' : '') + '<span><b>H</b> hurry the clock</span>';
    $('btnWind').style.display = D.fantail ? 'none' : '';
    $('btnGov').style.display = D.governor ? '' : 'none';
    $('btnLess').textContent = D.patent ? 'Close the shutters' : 'Take in a reef';
    $('btnMore').textContent = D.patent ? 'Open the shutters' : 'Spread more cloth';
    $('dayOut').textContent = (dayOff === 0 ? 'Today' : dayOff === -1 ? 'Yesterday' : dayOff === 1 ? 'Tomorrow' : (dayOff > 0 ? '+' : '') + dayOff + ' days') + ' · ' + D.year + ' · ' + (D.tower ? 'tower' : 'post') + ' mill';
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict'; $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    say('Morning, ' + clock(D.start) + '. The brake is on, the sails are set at ' + clothName() + ', and the hopper is empty. Tip the first sack in, take the brake off, and feel the meal as it comes.');
    orders(); buttons(); draw(); hud(true);
  }
  function clothName(c) { c = c == null ? S.cloth : c; return D.patent ? SHUTTERS[c] : CLOTH[c]; }

  function orders() {
    var html = '<h5>On the floor</h5><div class="orders">';
    D.orders.forEach(function (o) {
      var k = KINDS[o.kind], marks = '';
      for (var i = 0; i < o.n; i++) {
        var s = null;
        S.done.forEach(function (d) { if (d.sack.order === o && d.sack.k === i) s = d; });
        var cur = (S.cur && S.cur.sack.order === o && S.cur.sack.k === i) || (S.queue && S.queue.sack.order === o && S.queue.sack.k === i);
        marks += '<i class="sk ' + (s ? s.res : cur ? 'cur' : '') + '" title="' + (s ? s.res : cur ? 'in the hopper' : 'waiting') + '"></i>';
      }
      html += '<div class="ord"><span class="sks">' + marks + '</span><b>' + o.who + '</b><span>' + o.n + ' × ' + k.grain + ', ' + k.what + ' <em>' + k.lo + '–' + k.hi + '</em></span></div>';
    });
    $('orders').innerHTML = html + '</div>';
  }

  /* ---------- the scene ---------- */
  function skyCols(h) {
    var dawn = smooth((h - D.start + 0.6) / 1.4), dusk = smooth((D.sunset - h) / 1.6);
    var day = Math.min(dawn, dusk);
    function mixc(a, b, f) { return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * f); }).join(',') + ')'; }
    var bot = day < 0.5 ? mixc([30, 28, 44], [176, 112, 84], day * 2) : mixc([176, 112, 84], [126, 160, 186], (day - 0.5) * 2);
    return { top: mixc([14, 18, 34], [44, 78, 126], day), bot: bot, day: day };
  }
  function drawScene(dtReal) {
    var g = sctx, h = D.start + S.t / 3600;
    var w = S.wind || windAt(D, S.t);
    var sk = skyCols(h);
    var grd = g.createLinearGradient(0, 0, 0, SH * 0.78);
    grd.addColorStop(0, sk.top); grd.addColorStop(1, sk.bot);
    g.fillStyle = grd; g.fillRect(0, 0, SW, SH);
    /* a squall coming: a dark bank on the horizon */
    var bank = 0;
    D.squalls.forEach(function (q) {
      var m = S.t / 60;
      if (m > q.at - 30 && m < q.at + q.dur + 10) bank = Math.max(bank, m < q.at ? smooth((m - q.at + 30) / 30) : m < q.at + q.dur ? 1 : 1 - (m - q.at - q.dur) / 10);
    });
    if (bank > 0) {
      var bg = g.createLinearGradient(0, SH * 0.25, 0, SH * 0.78);
      bg.addColorStop(0, 'rgba(20,24,34,0)'); bg.addColorStop(1, 'rgba(20,24,34,' + (0.75 * bank).toFixed(3) + ')');
      g.fillStyle = bg; g.fillRect(0, 0, SW, SH);
    }
    /* clouds go with the wind's east-west part */
    var ex = -Math.sin(w.d * Math.PI / 180);
    clouds.forEach(function (c) {
      if (dtReal) c.x += ex * w.v * 0.9 * dtReal * c.s * (hurry ? 3 : 1);
      if (c.x > SW + 90) c.x = -90; if (c.x < -90) c.x = SW + 90;
      g.fillStyle = 'rgba(230,236,245,' + (0.10 + 0.12 * sk.day) + ')';
      g.beginPath();
      g.ellipse(c.x, c.y, 46 * c.s, 13 * c.s, 0, 0, 7); g.ellipse(c.x + 24 * c.s, c.y - 8 * c.s, 30 * c.s, 12 * c.s, 0, 0, 7); g.ellipse(c.x - 26 * c.s, c.y - 4 * c.s, 26 * c.s, 10 * c.s, 0, 0, 7);
      g.fill();
    });
    /* fields */
    var gy = SH * 0.78;
    g.fillStyle = 'rgb(' + Math.round(24 + 30 * sk.day) + ',' + Math.round(34 + 42 * sk.day) + ',' + Math.round(28 + 22 * sk.day) + ')';
    g.beginPath(); g.moveTo(0, gy + 10);
    for (var x = 0; x <= SW; x += 20) g.lineTo(x, gy + 6 * Math.sin(x / 90 + 1) + 4 * Math.sin(x / 37));
    g.lineTo(SW, SH); g.lineTo(0, SH); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (x = 0; x < SW; x += 60) g.fillRect(x, gy + 26 + (x % 120 ? 10 : 0), 50, 2);

    /* the mill */
    var cx = 250, hubY = D.tower ? 146 : 156;
    g.fillStyle = '#2a2420'; g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
    if (D.tower) {
      g.fillStyle = '#5b4434';
      g.beginPath(); g.moveTo(cx - 62, gy + 6); g.lineTo(cx - 38, hubY + 22); g.lineTo(cx + 38, hubY + 22); g.lineTo(cx + 62, gy + 6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (var y = hubY + 50; y < gy; y += 46) g.fillRect(cx - 8, y, 16, 22);
      g.fillStyle = '#ddd2bf'; g.beginPath(); g.ellipse(cx, hubY + 20, 44, 26, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#2d2722'; g.fillRect(cx - 12, gy - 30, 24, 36);
    } else {
      g.strokeStyle = '#3b2e24'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(cx, hubY + 110); g.lineTo(cx, gy); g.moveTo(cx - 40, gy); g.lineTo(cx, hubY + 130); g.lineTo(cx + 40, gy); g.stroke();
      g.fillStyle = '#4a3a2c'; g.beginPath(); g.moveTo(cx - 48, gy + 4); g.lineTo(cx - 48, gy - 34); g.lineTo(cx, gy - 52); g.lineTo(cx + 48, gy - 34); g.lineTo(cx + 48, gy + 4); g.closePath(); g.fill();
      g.fillStyle = '#d8ccb6'; g.fillRect(cx - 40, hubY - 8, 80, 124);
      g.fillStyle = '#8a7a66'; g.beginPath(); g.moveTo(cx - 46, hubY - 6); g.quadraticCurveTo(cx, hubY - 40, cx + 46, hubY - 6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(cx - 7, hubY + 70, 14, 20);
      g.strokeStyle = '#3b2e24'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 30, hubY + 116); g.lineTo(cx + 70, gy); g.stroke();
    }
    /* sails, seen from the front */
    if (dtReal && !reduce) S.ang += (S.om / 60) * 2 * Math.PI * dtReal * 5;
    var Rp = 128, fill = D.patent ? 1 : AREA[S.cloth];
    for (var i = 0; i < 4; i++) {
      var a = S.ang + i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      function P(rr, off) { return [cx + ca * rr - sa * off, hubY + sa * rr + ca * off]; }
      g.strokeStyle = '#e6dcc8'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, hubY); var e = P(Rp, 0); g.lineTo(e[0], e[1]); g.stroke();
      var r0 = Rp * 0.22, wdt = 26;
      g.strokeStyle = 'rgba(230,220,200,.55)'; g.lineWidth = 1;
      var c1 = P(r0, 0), c2 = P(Rp, 0), c3 = P(Rp, wdt), c4 = P(r0, wdt);
      g.beginPath(); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c3[0], c3[1]); g.lineTo(c4[0], c4[1]); g.closePath(); g.stroke();
      for (var bar = 1; bar < 9; bar++) { var b1 = P(r0 + (Rp - r0) * bar / 9, 0), b2 = P(r0 + (Rp - r0) * bar / 9, wdt); g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.stroke(); }
      if (D.patent) {
        var open = AREA[S.cloth];
        g.fillStyle = 'rgba(240,232,214,.82)';
        for (bar = 0; bar < 9; bar++) {
          var ra = r0 + (Rp - r0) * bar / 9 + 1, rb = ra + (Rp - r0) / 9 * (0.15 + 0.8 * open) - 2;
          var s1 = P(ra, 1), s2 = P(rb, 1), s3 = P(rb, wdt - 1), s4 = P(ra, wdt - 1);
          g.beginPath(); g.moveTo(s1[0], s1[1]); g.lineTo(s2[0], s2[1]); g.lineTo(s3[0], s3[1]); g.lineTo(s4[0], s4[1]); g.closePath(); g.fill();
        }
      } else if (S.cloth > 0) {
        var len = r0 + (Rp - r0) * 1, wfrac = fill;
        g.fillStyle = 'rgba(240,232,214,.82)';
        var q1 = P(r0, 0), q2 = P(len, 0), q3 = P(len, wdt * wfrac), q4 = P(r0, wdt * Math.max(wfrac, 0.2) * (S.cloth < 3 ? 0.25 : 1));
        g.beginPath(); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.lineTo(q3[0], q3[1]); g.lineTo(q4[0], q4[1]); g.closePath(); g.fill();
      }
    }
    g.fillStyle = '#2b2520'; g.beginPath(); g.arc(cx, hubY, 9, 0, 7); g.fill();

    /* a compass: where the wind comes from and where the sails face */
    var ox = SW - 78, oy = 78, R = 50;
    g.fillStyle = 'rgba(10,14,20,.55)'; g.beginPath(); g.arc(ox, oy, R + 14, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.arc(ox, oy, R, 0, 7); g.stroke();
    g.fillStyle = 'rgba(232,237,245,.7)'; g.font = '600 10px ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', ox, oy - R - 7); g.fillText('S', ox, oy + R + 7); g.fillText('E', ox + R + 7, oy); g.fillText('W', ox - R - 7, oy);
    function bx(b, rr) { return [ox + Math.sin(b * Math.PI / 180) * rr, oy - Math.cos(b * Math.PI / 180) * rr]; }
    var f1 = bx(S.face, R - 4), f0 = bx(S.face + 180, R * 0.55);
    g.strokeStyle = Math.abs(adiff(w.d, S.face)) > 60 ? '#ff8a7a' : '#ffce6a'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(f0[0], f0[1]); g.lineTo(f1[0], f1[1]); g.stroke();
    var p1 = bx(S.face, R - 2), pa = bx(S.face - 40, R - 16), pb = bx(S.face + 40, R - 16);
    g.lineWidth = 2; g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(p1[0], p1[1]); g.lineTo(pb[0], pb[1]); g.stroke();
    var w0 = bx(w.d, R + 2), w1 = bx(w.d + 180, R * 0.35);
    g.strokeStyle = '#64f0c8'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(w0[0], w0[1]); g.lineTo(w1[0], w1[1]); g.stroke();
    var ah = Math.atan2(w1[1] - w0[1], w1[0] - w0[0]);
    g.beginPath(); g.moveTo(w1[0], w1[1]); g.lineTo(w1[0] - 9 * Math.cos(ah - 0.45), w1[1] - 9 * Math.sin(ah - 0.45)); g.moveTo(w1[0], w1[1]); g.lineTo(w1[0] - 9 * Math.cos(ah + 0.45), w1[1] - 9 * Math.sin(ah + 0.45)); g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';

    /* gauges along the bottom */
    function gauge(x, label, frac, col, txt) {
      var y = SH - 26, wd = 128;
      g.fillStyle = 'rgba(10,14,20,.62)'; g.fillRect(x - 6, y - 20, wd + 12, 38);
      g.fillStyle = 'rgba(232,237,245,.65)'; g.font = '600 9px ui-monospace,Menlo,monospace'; g.fillText(label.toUpperCase(), x, y - 8);
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, y, wd, 7);
      g.fillStyle = col; g.fillRect(x, y, wd * clamp(frac, 0, 1), 7);
      g.fillStyle = 'rgba(232,237,245,.85)'; g.textAlign = 'right'; g.fillText(txt, x + wd, y - 8); g.textAlign = 'left';
    }
    gauge(16, 'hopper', S.hop / SACK, '#d9a24a', S.hop > 0 ? (S.hop).toFixed(1) + ' bu' : 'empty');
    gauge(166, 'stone heat', S.heat / 100, S.heat > 60 ? '#ff8a7a' : S.heat > 35 ? '#ffce6a' : '#64f0c8', Math.round(S.heat) + '');
    gauge(316, 'brake heat', S.bheat / 100, S.bheat > 60 ? '#ff8a7a' : S.bheat > 35 ? '#ffce6a' : '#64f0c8', Math.round(S.bheat) + '');
    gauge(466, 'sail speed', S.om / 40, S.om > 30 ? '#ff8a7a' : S.om > 24 ? '#ffce6a' : '#64f0c8', S.om.toFixed(1) + ' rpm');
    if (S.busy) {
      g.fillStyle = 'rgba(10,14,20,.7)'; g.fillRect(16, 14, 300, 26);
      g.fillStyle = '#ffce6a'; g.font = '600 11px ui-monospace,Menlo,monospace'; g.fillText(S.busy.what + ' … ' + Math.ceil(S.busy.left / 60) + ' min', 26, 31);
    }
    if (S.end === 'tail' || S.end === 'wreck' || S.end === 'brakefire' || S.end === 'stonefire') {
      g.fillStyle = 'rgba(120,20,10,.28)'; g.fillRect(0, 0, SW, SH);
    }
  }

  /* ---------- the day's chart ---------- */
  function drawChart() {
    var g = cctx, X0 = 44, X1 = CW - 40, Y0 = CH - 26, Y1 = 26, T = (D.end - D.start) * 3600;
    function X(t) { return X0 + (X1 - X0) * t / T; }
    function Yv(v) { return Y0 - (Y0 - Y1) * clamp(v, 0, 40) / 40; }
    function Yf(f) { return Y0 - (Y0 - Y1) * clamp(f, 0, 100) / 100; }
    g.fillStyle = '#0e131b'; g.fillRect(0, 0, CW, CH);
    if (S.cur) {
      var k = KINDS[S.cur.kind];
      g.fillStyle = 'rgba(255,206,106,.13)'; g.fillRect(X0, Yf(k.hi), X1 - X0, Yf(k.lo) - Yf(k.hi));
    }
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.font = '10px ui-monospace,Menlo,monospace'; g.fillStyle = 'rgba(139,151,171,.9)';
    for (var v = 0; v <= 40; v += 10) { g.beginPath(); g.moveTo(X0, Yv(v)); g.lineTo(X1, Yv(v)); g.stroke(); g.textAlign = 'right'; g.fillText(String(v), X0 - 6, Yv(v) + 3); g.textAlign = 'left'; g.fillText(String(v * 2.5), X1 + 6, Yv(v) + 3); }
    for (var hh = Math.ceil(D.start); hh <= D.end; hh++) { var xx = X((hh - D.start) * 3600); g.textAlign = 'center'; g.fillText(clock(hh).replace('.00', ''), xx, CH - 8); g.beginPath(); g.moveTo(xx, Y0); g.lineTo(xx, Y0 + 4); g.stroke(); }
    g.textAlign = 'left';
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,138,122,.5)'; g.beginPath(); g.moveTo(X0, Yv(30)); g.lineTo(X1, Yv(30)); g.stroke(); g.setLineDash([]);
    var upto = finished ? T : S.t;
    g.strokeStyle = 'rgba(200,210,225,.55)'; g.lineWidth = 1.2; g.beginPath();
    for (var t = 0; t <= upto; t += 60) { var vv = windAt(D, t).v; if (t) g.lineTo(X(t), Yv(vv)); else g.moveTo(X(t), Yv(vv)); }
    g.stroke();
    D.squalls.forEach(function (q) { if (finished || S.t > q.at * 60) { g.fillStyle = 'rgba(122,162,255,.10)'; g.fillRect(X(q.at * 60), Y1, X((q.at + q.dur) * 60) - X(q.at * 60), Y0 - Y1); } });
    g.strokeStyle = '#64f0c8'; g.lineWidth = 1.6; g.beginPath();
    S.track.forEach(function (p, i) { if (i) g.lineTo(X(p[0]), Yv(p[2])); else g.moveTo(X(p[0]), Yv(p[2])); }); g.stroke();
    g.fillStyle = '#ffc86e';
    S.track.forEach(function (p) { if (p[3] != null) g.fillRect(X(p[0]) - 1, Yf(p[3]) - 1, 2.4, 2.4); });
    S.done.forEach(function (s) {
      var xx = X((s.at - D.start) * 3600);
      g.fillStyle = s.res === 'good' ? '#64f0c8' : s.res === 'burnt' ? '#ff8a7a' : '#ffce6a';
      g.beginPath(); g.arc(xx, Y1 + 4, 4, 0, 7); g.fill();
    });
    if (!finished) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(X(S.t), Y1); g.lineTo(X(S.t), Y0); g.stroke(); }
    g.fillStyle = 'rgba(139,151,171,.9)'; g.fillText('mph · rpm', 6, 12); g.textAlign = 'right'; g.fillText('meal', CW - 6, 12); g.textAlign = 'left';
  }

  function draw(dtReal) { drawScene(dtReal || 0); drawChart(); }

  /* ---------- the instruments ---------- */
  function hud(force) {
    var now = performance.now();
    if (!force && now - lastHud < 90) return; lastHud = now;
    var w = S.wind || windAt(D, S.t), mis = adiff(w.d, S.face), stone = S.om * GEAR;
    $('hTime').textContent = clock(D.start + S.t / 3600);
    $('hWind').textContent = 'from ' + point(w.d) + ', ' + Math.round(w.v) + ' mph';
    $('hFace').textContent = Math.abs(mis) < 8 ? 'square to the wind' : Math.round(Math.abs(mis)) + '° ' + (mis > 0 ? 'left' : 'right') + ' of it';
    $('hFace').parentNode.classList.toggle('alarm', Math.abs(mis) > 60);
    $('hCloth').textContent = clothName();
    $('hStones').textContent = Math.round(stone) + ' rpm';
    $('hStones').parentNode.classList.toggle('alarm', stone > 150);
    $('hFeed').textContent = FEEDS[S.feed];
    $('hGap').textContent = half(S.gap) + (S.gov ? ' (governor)' : '');
    var k = S.cur ? KINDS[S.cur.kind] : null, fin = fineness(S.gap, stone, S.feed);
    $('hMeal').textContent = !S.cur || stone < 20 ? '—' : Math.round(fin) + (fin < k.lo ? ', too coarse' : fin > k.hi ? ', too fine' : ', right');
    $('hMeal').parentNode.classList.toggle('alarm', !!(S.cur && stone >= 20 && (fin < k.lo || fin > k.hi)));
    $('hWants').textContent = k ? k.short + ', ' + k.lo + '–' + k.hi : S.next < D.sacks.length ? 'tip the next sack' : 'all done';
    $('hDone').textContent = S.done.length + ' of ' + D.nsacks + (S.done.length ? ', ' + S.done.filter(function (d) { return d.res === 'good'; }).length + ' good' : '');
  }

  function buttons() {
    var run = S.state === 'running', idle = finished || S.state === 'ready';
    $('btnGo').textContent = S.state === 'ready' ? 'Start the day →' : finished ? 'Day over' : paused ? 'Carry on' : 'Pause';
    $('btnGo').disabled = finished;
    $('btnBrake').textContent = S.brake ? 'Take the brake off' : 'Put the brake on';
    $('btnBrake').classList.toggle('on', S.brake);
    var lock = finished || !!S.busy;
    $('btnBrake').disabled = finished;
    $('btnLess').disabled = lock || S.cloth <= 0;
    $('btnMore').disabled = lock || S.cloth >= 4;
    $('btnTip').disabled = finished || !canTip();
    $('btnWind').disabled = lock;
    $('btnFeedLess').disabled = finished || S.feed <= 0;
    $('btnFeedMore').disabled = finished || S.feed >= 3;
    $('btnCloser').disabled = finished || S.gap <= 1;
    $('btnWider').disabled = finished || S.gap >= 10;
    $('btnGov').textContent = S.gov ? 'Governor in' : 'Governor out';
    $('btnGov').classList.toggle('on', S.gov);
    $('btnGov').disabled = finished;
    $('btnHurry').classList.toggle('on', hurry);
    $('btnHurry').textContent = hurry ? 'Clock hurried, ×4' : 'Hurry the clock';
    $('btnAgain').style.display = finished ? '' : 'none';
    ['btnDayPrev', 'btnDayNext', 'btnDayToday'].forEach(function (id) { $(id).disabled = run && !finished; });
  }

  /* ---------- actions ---------- */
  function begin() { if (S.state === 'ready') { S.state = 'running'; paused = false; startLoop(); } }
  function go() {
    if (finished) return;
    if (S.state === 'ready') { begin(); say('The day begins. Watch the sail speed and feel the meal: the stones want to turn at about 120, and every gust changes what comes off them.'); }
    else { paused = !paused; if (!paused) startLoop(); else say('Paused. The wind waits for you.'); }
    buttons();
  }
  function brake() {
    if (finished) return;
    S.brake = !S.brake;
    say(S.brake ? (S.om > 4 ? 'The brake blocks bite on the rim of the brake wheel and it begins to smoke a little. Keep an eye on the brake heat.' : 'The brake is on.') : 'Brake off. The sails take the wind.');
    begin(); buttons(); hud(true);
  }
  function cloth(dir) {
    if (finished || S.busy) return;
    var to = S.cloth + dir; if (to < 0 || to > 4) return;
    if (D.patent) { S.cloth = to; say('You pull the striking chain and the shutters ' + (dir > 0 ? 'open' : 'close') + ' together on all four sails: ' + clothName() + '.'); begin(); buttons(); hud(true); return; }
    if (!S.brake || S.om > 0.5) { say('You cannot reef a common sail while she turns. Put the brake on and wait for her to stop.'); return; }
    S.busy = { what: dir > 0 ? 'Spreading cloth' : 'Reefing', left: 150, still: true, then: function () { S.cloth = to; S.msgs.push('All four sails are at ' + clothName() + '.'); } };
    say('You climb the stocks of each sail in turn as it comes to the bottom and ' + (dir > 0 ? 'unroll the canvas a turn further' : 'roll the canvas in towards the stock') + '. It takes a few minutes.');
    begin(); buttons();
  }
  function windRound() {
    if (finished || S.busy || D.fantail) return;
    if (!S.brake || S.om > 0.5) { say('Stop her first: brake on, sails still. Then you can ' + (D.tower ? 'wind the cap' : 'push her round on the tailpole') + '.'); return; }
    var w = windAt(D, S.t), dd = Math.abs(adiff(w.d, S.face));
    S.busy = { what: D.tower ? 'Winding the cap' : 'On the tailpole', left: 60 + dd / 90 * 360, still: true, then: function () { var w2 = windAt(D, S.t); S.face = w2.d; S.msgs.push('She is square to the wind again, facing ' + pointName(w2.d) + '.'); } };
    say(D.tower ? 'You haul on the endless chain and the cap creaks round on its curb.' : 'You set your back to the tailpole and walk the whole body round on its post, a step at a time.');
    begin(); buttons();
  }
  function canTip() { return !S.busy && !S.queue && S.next < D.sacks.length && (!S.cur || S.cur.left < 1); }
  function tip() {
    if (finished || !canTip()) return;
    var sk = D.sacks[S.next];
    S.busy = { what: 'Hoisting a sack', left: 100, still: false, then: function () {
      var c = { sack: sk, kind: sk.order.kind, left: SACK, fs: 0, q: 0, burnt: 0, fmin: 100, fmax: 0 };
      if (S.cur) S.queue = c; else S.cur = c;
      S.next++;
      S.hop = (S.cur ? S.cur.left : 0) + (S.queue ? S.queue.left : 0);
      var k = KINDS[sk.order.kind];
      S.msgs.push('A sack of ' + k.grain + ' for ' + sk.order.who + ' goes into the hopper' + (S.queue ? ' on top of what is left of the last' : '') + '. They want ' + k.what + ', between ' + k.lo + ' and ' + k.hi + '.');
      orders();
    } };
    say('You hook a sack on the chain of the sack hoist and it goes up through the trap doors to the bin floor.');
    begin(); buttons();
  }
  function feed(dir) { if (finished) return; S.feed = clamp(S.feed + dir, 0, 3); say('The shoe under the hopper is set ' + FEEDS[S.feed] + (S.feed === 0 ? ': no grain reaches the stones.' : '.')); buttons(); hud(true); }
  function tenter(dir) {
    if (finished) return;
    var wasGov = S.gov; S.gov = false;
    S.gap = clamp(Math.round((S.gap + dir * 0.5) * 2) / 2, 1, 10);
    say((wasGov ? 'You take the governor out and tenter by hand. ' : '') + 'The runner stone is ' + (dir < 0 ? 'lowered towards' : 'lifted away from') + ' the bed stone: ' + half(S.gap) + '.');
    buttons(); hud(true);
  }
  function governor() { if (finished || !D.governor) return; S.gov = !S.gov; say(S.gov ? 'The governor is in. Its weights fly out as the stones speed up and lift the runner, and drop it again as she slows.' : 'The governor is out. The stones stay where you set them.'); buttons(); hud(true); }

  /* ---------- the clock ---------- */
  function startLoop() { if (raf) return; lastTs = 0; raf = requestAnimationFrame(frame); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }
  var said = {};
  function warnings() {
    function once(key, cond, text, reset) { if (cond && !said[key]) { said[key] = 1; S.msgs.push(text); } if (reset) said[key] = 0; }
    once('bell', S.cur && !S.queue && S.hop < 0.6 && S.hop > 0 && S.next < D.sacks.length, 'Ting… ting… The hopper bell is ringing: the grain is nearly through. Tip the next sack in now, or the stones will run empty.', !S.cur || S.queue || S.hop >= 0.6);
    once('empty', S.hop <= 0 && S.om * GEAR > 40 && S.state === 'running' && S.t > 120, 'The stones are running empty and the runner is warming against the bed. Tip a sack in, lift the stones, or stop her.', S.hop > 0 || S.om * GEAR < 20);
    once('fast', S.om > 24, 'She is racing: ' + S.om.toFixed(0) + ' turns a minute at the sails. Past thirty, the sails begin to suffer.', S.om < 21);
    once('runaway', S.om > 30, 'Runaway! The whole mill shakes and the sail stocks are bending. Brake her, or close the shutters, now.', S.om < 27);
    once('bheat', S.bheat > 55, 'The brake wheel is smoking hard. Wooden mills burned down this way.', S.bheat < 40);
    once('sheat', S.heat > 55, 'The meal coming off the stones is hot to the touch and smells scorched.', S.heat < 40);
    once('back', Math.abs(S.mis || 0) > 70, 'The wind has gone round and is coming in on the side of the sails. If it gets behind them she will be tail-winded.', Math.abs(S.mis || 0) < 50);
  }
  function frame(ts) {
    raf = null;
    if (paused || finished) return;
    var dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
    var n = Math.round(dt * (hurry ? 360 : 90));
    for (var i = 0; i < n && !S.end; i++) {
      var wasBusy = !!S.busy;
      stepDay(D, S, 1);
      if (wasBusy && !S.busy) { orders(); buttons(); }
      warnings();
    }
    if (S.msgs.length) { say(S.msgs[S.msgs.length - 1]); S.msgs = []; orders(); buttons(); }
    if (S.end) { finish(); return; }
    draw(dt); hud();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- the end of the day ---------- */
  function finish() {
    stopLoop(); finished = true;
    var good = S.done.filter(function (d) { return d.res === 'good'; }).length, at = D.start + S.t / 3600;
    var cls = 'warn', head, body;
    if (S.end === 'tail') { head = 'Tail-winded'; body = 'At ' + clock(at) + ' the wind got behind the sails. They were driven backwards, the ' + (D.tower ? 'cap was lifted off its curb and the sails came down into the yard' : 'whole post mill was heaved over on her trestle and fell') + '. Nobody was hurt, but there will be no more grinding at ' + D.village + ' this year.'; }
    else if (S.end === 'wreck') { head = 'The sails carried away'; body = 'At ' + clock(at) + ' she ran away at ' + Math.round(S.peakOm) + ' turns a minute and a sail stock broke at the canister. Two sails came down across the roundhouse.'; }
    else if (S.end === 'brakefire') { head = 'The mill on fire'; body = 'At ' + clock(at) + ' the brake blocks, held hard on a wheel the wind would not let stop, set the brake wheel alight. ' + D.village + ' turned out with buckets, but the mill burned.'; }
    else if (S.end === 'stonefire') { head = 'The stones struck fire'; body = 'At ' + clock(at) + ' the runner, turning empty and set low, came down on the bed stone. Sparks went up into the meal dust and the stone floor caught.'; }
    else if (S.end === 'done') { cls = good >= D.nsacks - 1 ? 'good' : 'warn'; head = good === D.nsacks ? 'Every sack ground true' : 'The floor is clear'; body = 'The last sack came off the spout at ' + clock(at) + ', ' + Math.round((D.sunset - at) * 60) + ' minutes before sunset. ' + cap1(words(good)) + ' of ' + words(D.nsacks) + ' were ground the way their owners asked.'; }
    else { cls = good >= Math.ceil(D.nsacks * 0.7) ? 'good' : 'warn'; head = 'Sunset, ' + clock(D.end); body = 'The light went with ' + words(D.nsacks - S.done.length) + ' sack' + (D.nsacks - S.done.length === 1 ? '' : 's') + ' still waiting on the floor. ' + cap1(words(good)) + ' of the ' + words(S.done.length) + ' ground today ' + (good === 1 ? 'was' : 'were') + ' what their owners asked for.'; }
    $('verdict').className = 'verdict ' + cls;
    var rows = S.done.map(function (d) {
      var k = KINDS[d.kind], ok = d.res === 'good';
      return '<tr><td>' + clock(d.at) + '</td><td>' + d.sack.order.who + '</td><td>' + k.short + ' ' + k.lo + '–' + k.hi + '</td><td class="' + (ok ? 'ok' : 'bad') + '">' + Math.round(d.fin) + ' · ' + (ok ? 'right' : d.res === 'fine' ? 'over-ground' : d.res) + '</td></tr>';
    }).join('');
    var toll = good + (S.done.length - good) * 0.5;
    $('verdict').innerHTML = '<h5>' + head + '</h5><p>' + body + '</p>' +
      (rows ? '<div class="tablewrap"><table><tr><th>Off the spout</th><th>For</th><th>Wanted</th><th>Came out</th></tr>' + rows + '</table></div>' : '<p>Not a sack was ground.</p>') +
      '<p style="margin-top:12px">' + book(good, toll) + '</p>';
    reveal();
    buttons(); draw(); hud(true); orders();
    say('');
  }
  function book(good, toll) {
    var s = '<i>From the miller’s book.</i> “' + D.date.getDate() + ' ' + MONTHS[D.date.getMonth()] + ' ' + D.year + '. Wind ' + pointName(D.dir[0]) + ', ' + (D.sp[0] < 8 ? 'light' : D.sp[0] < 16 ? 'a fair working wind' : 'fresh') + ' at first. ';
    if (D.squalls.length) s += 'A squall about ' + clock(D.start + D.squalls[0].at / 60) + (D.squalls.length > 1 ? ' and another about ' + clock(D.start + D.squalls[1].at / 60) : '') + ' ';
    if (D.lull) s += 'Calm about ' + clock(D.start + D.lull.at / 60) + ' ';
    s += 'Ground ' + words(S.done.length) + ' coomb' + (S.done.length === 1 ? '' : 's') + ' (' + S.done.length * SACK + ' bushels). ';
    if (good) s += 'Toll taken, a peck in the coomb by custom: ' + toll.toFixed(1).replace('.0', '') + ' peck' + (toll === 1 ? '' : 's') + '. ';
    if (S.done.some(function (d) { return d.res === 'burnt'; })) s += 'Meal burned, owner complains. ';
    if (S.done.some(function (d) { return d.res === 'coarse'; })) s += 'Some rough, to be reground at my cost. ';
    if (S.end === 'tail' || S.end === 'wreck' || S.end === 'brakefire' || S.end === 'stonefire') s += 'God help us.';
    return s + '”';
  }
  function reveal() {
    var parts = [];
    var mx = 0, mxAt = 0, mn = 99, work = 0;
    for (var m = 0; m < D.sp.length - 1; m++) { if (D.sp[m] > mx) { mx = D.sp[m]; mxAt = m; } if (D.sp[m] < mn) mn = D.sp[m]; if (D.sp[m] >= 8 && D.sp[m] <= 30) work++; }
    var s = '<h5>What the wind did</h5><p>The grey line on the chart is the whole day’s wind now, and the blue bands are the squalls. It blew between <b>' + Math.round(mn) + '</b> and <b>' + Math.round(mx) + ' mph</b> (hardest about ' + clock(D.start + mxAt / 60) + '), and a mill could work in about <b>' + (work / 60).toFixed(1) + ' hours</b> of it. The day’s number put ' + words(D.nsacks) + ' sacks on the floor from that.</p>';
    D.squalls.forEach(function (q, i) {
      var before = windAt(D, (q.at - 2) * 60), after = windAt(D, (q.at + q.dur + 15) * 60), peak = 0;
      for (var mm = Math.floor(q.at); mm < q.at + q.dur; mm++) peak = Math.max(peak, D.sp[mm] || 0);
      s += '<p>' + (i ? 'Another' : 'A') + ' squall came in at <b>' + clock(D.start + q.at / 60) + '</b>, blowing up to about ' + Math.round(peak) + ' mph for ' + Math.round(q.dur) + ' minutes and veering the wind from ' + point(before.d) + ' to ' + point(after.d) + ', where it stayed. It showed on the horizon twenty-five minutes before. ' +
        (D.patent ? 'Patent shutters spill such a gust by themselves, but not wide open on light weights.' : 'With common sails the time to reef was before it arrived, while the brake could still hold her.') + (D.fantail ? '' : ' Without a fantail, the mill also had to be wound round to meet the new wind.') + '</p>';
    });
    if (D.lull) s += '<p>A lull fell at <b>' + clock(D.start + D.lull.at / 60) + '</b> for about ' + Math.round(D.lull.dur) + ' minutes, when there was hardly wind to turn her. The thing to do in a lull is spread all the cloth there is and feed the stones slack.</p>';
    s += '<p>Your sails turned at most <b>' + S.peakOm.toFixed(1) + ' rpm</b>, the stones ran empty for <b>' + Math.round(S.idleEmpty / 60) + ' minutes</b>, and the brake got to <b>' + Math.round(S.bheat) + '</b> on its gauge at the end.</p>';
    $('reveal').innerHTML = s; $('reveal').style.display = '';
  }

  /* ---------- wiring ---------- */
  $('btnGo').addEventListener('click', go);
  $('btnBrake').addEventListener('click', brake);
  $('btnLess').addEventListener('click', function () { cloth(-1); });
  $('btnMore').addEventListener('click', function () { cloth(1); });
  $('btnTip').addEventListener('click', tip);
  $('btnWind').addEventListener('click', windRound);
  $('btnFeedLess').addEventListener('click', function () { feed(-1); });
  $('btnFeedMore').addEventListener('click', function () { feed(1); });
  $('btnCloser').addEventListener('click', function () { tenter(-1); });
  $('btnWider').addEventListener('click', function () { tenter(1); });
  $('btnGov').addEventListener('click', governor);
  $('btnHurry').addEventListener('click', function () { hurry = !hurry; buttons(); });
  $('btnAgain').addEventListener('click', function () { said = {}; load(); });
  $('btnDayPrev').addEventListener('click', function () { dayOff--; said = {}; load(); });
  $('btnDayNext').addEventListener('click', function () { dayOff++; said = {}; load(); });
  $('btnDayToday').addEventListener('click', function () { dayOff = 0; said = {}; load(); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase(), run = S.state === 'running' && !finished;
    if (k === ' ' && tag !== 'BUTTON') { e.preventDefault(); go(); }
    else if (k === 'k') brake();
    else if (k === '+' || k === '=') cloth(1);
    else if (k === '-' || k === '_') cloth(-1);
    else if (k === 't') tip();
    else if (k === 'w') windRound();
    else if (k === '[') feed(-1);
    else if (k === ']') feed(1);
    else if (k === 'c') tenter(-1);
    else if (k === 'o') tenter(1);
    else if (k === 'g') governor();
    else if (k === 'h') { hurry = !hurry; buttons(); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !run) { dayOff += e.key === 'ArrowLeft' ? -1 : 1; said = {}; load(); }
  });

  /* exposed for checking the model from the console; the page does not use it */
  window.__mill = { build: build, newDay: newDay, stepDay: stepDay, windAt: windAt, fineness: fineness, KINDS: KINDS, SACK: SACK };

  load();
})();
