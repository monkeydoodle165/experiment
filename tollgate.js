/* drift.quibo.games — The Tollgate
   A morning keeping a turnpike gate between 1770 and 1840. The day's number picks the road and the gate, the year and
   so the day of the week, the board (what a coach horse pays, what a waggon horse pays on broad wheels and on narrow,
   the rate for droves by the score, the weighing engine and its limits, which loads go free), the gate whose tickets
   clear this one, the rent, and a fixed run of travellers coming down the road to you.

   Every traveller has a true toll worked out from the board. You see what a keeper would see (horses, wheels, the
   reading on the engine, the load, a ticket) and hear what they say, which is not always true. Take too little and the
   money is gone; take too much, or charge someone the Act lets through free, and they complain to the trustees' clerk.
   Keep the Mail waiting and the Post Office fines you. Self-contained. */
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
    var h = s ^ 0x5a1b7e29;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dateFor(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function half(x) { return Math.round(x * 2) / 2; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function num(n) { return n < NUM.length ? NUM[n] : String(n); }

  /* money in pence, halfpennies allowed */
  function money(d) {
    var neg = d < 0;
    d = Math.round(Math.abs(d) * 2) / 2;
    var l = Math.floor(d / 240), s = Math.floor((d % 240) / 12), p = d % 12;
    var out = [];
    if (l) out.push('£' + l);
    if (s) out.push(s + 's');
    if (p || !out.length) {
      var whole = Math.floor(p), hf = p - whole > 0.25;
      out.push((whole ? whole : '') + (hf ? '½' : '') + (whole || hf ? 'd' : '0d'));
    }
    return (neg ? 'minus ' : '') + out.join(' ');
  }
  function clock(t) {
    var m = Math.floor(t / 60), h = Math.floor(m / 60) % 24, mm = m % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (mm < 10 ? '0' : '') + mm + (h < 12 ? ' am' : ' pm');
  }
  var SHIFT = 3 * 3600;
  var PACES = [1.5, 2.5, 4];            // real seconds per minute of the morning
  var PACENAME = ['brisk', 'steady', 'slow'];
  var FINE_COMPLAINT = 30;              // pence the clerk docks for each complaint upheld
  var FINE_MAIL = 120;                  // pence the Post Office fines for delaying the Mail

  /* ---------- the world ---------- */
  var ROADS = [
    { road: 'the Great North Road', gate: 'Stilton', next: 'Norman Cross', other: 'Water Newton', town: 'Peterborough' },
    { road: 'the Bath road', gate: 'Box', next: 'Pickwick', other: 'Kingsdown', town: 'Bath' },
    { road: 'the Holyhead road', gate: 'Emstrey', next: 'Atcham', other: 'Montford Bridge', town: 'Shrewsbury' },
    { road: 'the Dover road', gate: 'Chalk', next: 'Gad’s Hill', other: 'Dartford Heath', town: 'Rochester' },
    { road: 'the Exeter road', gate: 'Honiton Hill', next: 'Fenny Bridges', other: 'Yarcombe', town: 'Honiton' },
    { road: 'the Brighton road', gate: 'Pyecombe', next: 'Clayton', other: 'Bolney', town: 'Brighton' },
    { road: 'the Buxton road', gate: 'Whaley', next: 'Disley', other: 'Chapel', town: 'Stockport' },
    { road: 'the Harrogate road', gate: 'Harewood Bridge', next: 'Dunkeswick', other: 'Bramhope', town: 'Leeds' },
    { road: 'the Gloucester road', gate: 'Birdlip', next: 'Crickley Hill', other: 'Barrow Wake', town: 'Gloucester' },
    { road: 'the Kendal road', gate: 'Plumgarths', next: 'Mealbank', other: 'Burneside', town: 'Kendal' },
    { road: 'the Norwich road', gate: 'Larling', next: 'Attleborough', other: 'Elveden', town: 'Norwich' },
    { road: 'the Carmarthen road', gate: 'Efail-wen', next: 'Llanboidy', other: 'Narberth', town: 'Carmarthen' }
  ];
  var WAGGON_LOADS = ['corn for the mill', 'cheeses for London', 'wool packs', 'coals', 'timber', 'hops', 'malt', 'the carrier’s goods', 'slates'];
  var CART_LOADS = ['turnips', 'potatoes', 'bricks', 'coals', 'butter and eggs for market', 'faggots', 'a load of hay'];
  var COACH_NAMES = ['the Regulator', 'the Defiance', 'the Telegraph', 'the Highflyer', 'the Union', 'the Express', 'the Hope', 'the Times'];
  var COLOURS = ['#7a2a2a', '#2a3f6b', '#2f5a3a', '#4a3a26', '#5b2c58', '#7a5a1e'];

  function makeDay(off) {
    var d = dateFor(off);
    var r = rng(seedForDate(d) ^ 0x7011ca7e);
    var R = ROADS[Math.floor(r() * ROADS.length)];
    var year = 1770 + Math.floor(r() * 71);
    var hd = new Date(year, d.getMonth(), d.getDate(), 12);
    var wd = hd.getDay(), sunday = wd === 0;
    var market = !sunday && (r() < 0.3);

    // the board
    var B = {
      coach: pick(r, [3, 4, 4, 4.5, 6]),
      broad: pick(r, [2, 3, 3, 3]),
      saddle: pick(r, [1, 1, 1.5, 2]),
      cattle: pick(r, [10, 10, 12, 15]),
      sheep: pick(r, [5, 5, 6]),
      engine: year >= 1765 && r() < 0.65,
      limB: pick(r, [60, 65, 70]),
      limN: pick(r, [40, 40, 45]),
      over: pick(r, [2, 3, 3, 4]),
      lime: r() < 0.5,
      plough: r() < 0.6,
      mail: year >= 1784
    };
    B.narrow = half(B.broad * 1.5);

    var start = Math.round((6.5 + r() * 1.5) * 12) * 300;  // 6:30 to 8:00, on five minutes
    var end = start + SHIFT;

    // who comes down the road
    var W = [
      ['stage', 0.07], ['chaise', 0.07], ['gig', 0.09], ['chariot', 0.03], ['rider', 0.11], ['pack', 0.04],
      ['waggon', sunday ? 0.02 : 0.10], ['cart', sunday ? 0.03 : 0.12], ['cattle', sunday ? 0.01 : market ? 0.08 : 0.05],
      ['sheep', sunday ? 0.01 : market ? 0.07 : 0.04], ['pigs', 0.03], ['dung', sunday ? 0 : 0.045], ['fakedung', sunday ? 0 : 0.025],
      ['stone', sunday ? 0 : 0.025], ['soldiers', 0.012], ['funeral', 0.015], ['lime', sunday ? 0 : 0.03], ['plough', sunday ? 0 : 0.03],
      ['church', sunday ? 0.2 : 0.025], ['tnext', 0.05], ['tother', 0.025], ['tstale', 0.018]
    ];
    var wsum = 0; W.forEach(function (w) { wsum += w[1]; });
    function kind() { var x = r() * wsum; for (var i = 0; i < W.length; i++) { x -= W[i][1]; if (x <= 0) return W[i][0]; } return 'rider'; }

    var list = [], t = start - 300, id = 0, returns = [];
    var base = (0.17 + r() * 0.08) * (market ? 1.25 : 1) * (sunday ? 0.8 : 1);   // per minute
    while (true) {
      var hr = (t - start) / 3600;
      var rate = base * (0.75 + 0.6 * Math.exp(-Math.pow(hr - 1.1, 2) / 0.6));
      t += -Math.log(1 - r()) * 60 / rate;
      if (t >= end - 120) break;
      var k = kind();
      if (sunday && k === 'church' && (t - start) > 7200) k = 'rider';
      var tr = traveller(r, k, B, R, sunday, hd, year);
      tr.t = Math.max(start - 240, t); tr.id = id++;
      list.push(tr);
      if (tr.retOk && r() < 0.18 && t < end - 3600) returns.push(tr);
    }
    returns.forEach(function (o) {
      var tr = traveller(r, o.kind, B, R, sunday, hd, year, o);
      tr.t = o.t + 2400 + r() * 3600; tr.id = id++;
      if (tr.t < end - 120) list.push(tr);
    });
    // the Mail
    if (B.mail && r() < 0.75) {
      var mt = start + 900 + r() * (SHIFT - 2400);
      list.push({ t: mt, id: id++, kind: 'mail', mail: true, draw: { body: 'mail', horses: 4, colour: '#6b1f1f' },
        who: 'His Majesty’s Mail coach', facts: [['Horses', '<b>four</b>'], ['Guard', 'blowing his horn']],
        says: 'The guard’s horn, long before you see her.', due: 0, tol: 0.01, pat: 240,
        why: 'The Mail goes free and must not be stopped.' });
    }
    list.sort(function (a, b) { return a.t - b.t; });

    var expected = 0; list.forEach(function (x) { expected += x.due; });
    var rent = half(expected * (0.72 + r() * 0.16));

    return {
      off: off, R: R, year: year, date: hd, wd: WEEKDAYS[wd], sunday: sunday, market: market,
      dateText: hd.getDate() + ' ' + MONTHS[hd.getMonth()], month: hd.getMonth(), B: B,
      start: start, end: end, list: list, rent: rent, expected: expected
    };
  }

  /* one traveller, with the true toll worked out from the board */
  function traveller(r, k, B, R, sunday, hd, year, ret) {
    var T = { kind: k, facts: [], says: '', tol: 0.01, pat: (8 + r() * 14) * 60, retOk: false };
    var todayStr = hd.getDate() + ' ' + MONTHS[hd.getMonth()].slice(0, 3);
    var yd = new Date(hd); yd.setDate(yd.getDate() - 1);
    var yStr = yd.getDate() + ' ' + MONTHS[yd.getMonth()].slice(0, 3);
    var colour = pick(r, COLOURS);

    function coachLike(body, n, who) {
      T.draw = { body: body, horses: n, colour: colour };
      T.who = who;
      T.facts.push(['Horses', '<b>' + num(n) + '</b> drawing ' + (body === 'gig' ? 'a gig' : body === 'chaise' ? 'a post chaise' : body === 'chariot' ? 'a private chariot' : 'a stage coach')]);
      T.due = n * B.coach;
      T.why = num(n) + ' coach horse' + (n > 1 ? 's' : '') + ' at ' + money(B.coach) + ' = ' + money(T.due);
      T.retOk = true;
    }
    function goods(body, n, load, cart) {
      var broad = r() < (cart ? 0.25 : 0.5);
      var wheels = broad ? pick(r, [6, 6, 9, 16]) : pick(r, [3, 4, 4.5]);
      var lim = broad ? B.limB : B.limN;
      var base = cart ? (12 + r() * 14) * (n / 2 + 0.5) : lim * (0.65 + r() * 0.6);
      var cwt = Math.round(base);
      T.draw = { body: body, horses: n, colour: colour, load: load };
      T.facts.push(['Horses', '<b>' + num(n) + '</b> drawing a ' + (cart ? 'cart' : 'waggon')]);
      T.facts.push(['Wheels', '<b>' + (wheels === 4.5 ? '4½' : wheels) + ' inches</b> across the tyre']);
      if (B.engine) T.facts.push(['On the engine', '<b>' + cwt + ' cwt</b> with the load']);
      T.facts.push(['Load', load]);
      var rate = broad ? B.broad : B.narrow;
      T.due = n * rate;
      T.why = num(n) + ' horses at ' + money(rate) + ' (' + (broad ? 'broad' : 'narrow') + ' wheels) = ' + money(T.due);
      if (B.engine && cwt > lim) {
        var ov = cwt - lim;
        T.due += ov * B.over;
        T.why += ', and ' + ov + ' cwt over the ' + lim + ' cwt limit at ' + money(B.over) + ' = ' + money(ov * B.over) + '; ' + money(T.due) + ' in all';
      }
      if (n === 1) T.why = T.why.replace('horses', 'horse');
      T.retOk = true;
    }
    function drove(what, n, per, perName) {
      T.draw = { body: what, count: n };
      T.facts.push(['Drove', '<b>' + n + '</b> ' + perName]);
      T.due = half(n * per / 20);
      T.tol = 0.51;
      T.why = n + ' ' + perName + ' at ' + money(per) + ' the score = ' + money(T.due);
      T.pat = (6 + r() * 8) * 60;
      T.walksRound = true;
    }

    switch (k) {
      case 'stage': coachLike('stage', 4, 'The ' + pick(r, COACH_NAMES).replace('the ', '') + ' coach for ' + R.town); T.pat = (4 + r() * 5) * 60; break;
      case 'chaise': var nc = r() < 0.7 ? 2 : 4; coachLike('chaise', nc, 'A post chaise with ' + (nc === 4 ? 'four horses and two post boys' : 'a pair and a post boy')); T.pat = (5 + r() * 6) * 60; break;
      case 'gig': coachLike('gig', 1, pick(r, ['A doctor in his gig', 'A farmer and his wife in a gig', 'An attorney in a gig', 'A curate in a borrowed gig'])); break;
      case 'chariot': coachLike('chariot', 2, 'A gentleman’s chariot, crest on the door'); T.pat = (4 + r() * 4) * 60; break;
      case 'rider':
        var led = r() < 0.65 ? 0 : 1 + Math.floor(r() * 3);
        T.draw = { body: 'rider', horses: 1 + led, colour: colour };
        T.who = pick(r, ['A horse dealer', 'A commercial traveller on horseback', 'A farmer riding to market', 'A groom', 'An excise officer', 'A drover’s boy riding back']);
        if (led) T.who += ' leading ' + num(led);
        T.facts.push(['Horses', '<b>' + num(1 + led) + '</b>' + (led ? ', one ridden and ' + num(led) + ' led' : ', ridden')]);
        T.due = (1 + led) * B.saddle;
        T.why = num(1 + led) + ' horse' + (led ? 's' : '') + ' not drawing at ' + money(B.saddle) + ' = ' + money(T.due);
        T.pat = (5 + r() * 7) * 60; T.walksRound = true; T.retOk = true;
        break;
      case 'pack':
        var np = 3 + Math.floor(r() * 6);
        T.draw = { body: 'pack', horses: np, colour: colour };
        T.who = 'A string of packhorses with ' + pick(r, ['wool', 'salt', 'pots from the potteries', 'lime', 'cloth pieces']);
        T.facts.push(['Horses', '<b>' + num(np) + '</b>, laden, not drawing']);
        T.due = np * B.saddle;
        T.why = num(np) + ' laden horses at ' + money(B.saddle) + ' = ' + money(T.due);
        T.walksRound = true;
        if (/lime/.test(T.who) && B.lime) { T.due = 0; T.why = 'Lime for the land goes free on this road'; T.facts.push(['Load', 'lime, for the land']); }
        break;
      case 'waggon':
        var nw = 4 + Math.floor(r() * 5);
        T.who = pick(r, ['The carrier’s stage waggon', 'A farm waggon', 'A miller’s waggon', 'A brewer’s dray waggon']);
        goods('waggon', nw, pick(r, WAGGON_LOADS), false); T.pat = (12 + r() * 15) * 60;
        break;
      case 'cart':
        var nk = 1 + Math.floor(r() * 3);
        T.who = pick(r, ['A carter', 'A market woman with her cart', 'A higgler’s cart', 'A coal cart']);
        goods('cart', nk, pick(r, CART_LOADS), true);
        break;
      case 'cattle': T.who = 'A drover with ' + pick(r, ['Welsh runts', 'Scotch beasts', 'Shorthorns', 'Devon steers']) + ' for ' + pick(r, ['Smithfield', 'the fair', 'the grazier', 'market']); drove('cattle', 6 + Math.floor(r() * 70), B.cattle, 'head of cattle'); break;
      case 'sheep': T.who = 'A shepherd and dog with ' + pick(r, ['ewes', 'wethers', 'lambs']); drove('sheep', 20 + Math.floor(r() * 220), B.sheep, 'sheep'); break;
      case 'pigs': T.who = 'A man on foot driving pigs'; drove('pigs', 3 + Math.floor(r() * 24), B.sheep, 'pigs'); break;
      case 'dung': case 'fakedung':
        var nd = 1 + Math.floor(r() * 2);
        T.draw = { body: 'cart', horses: nd, colour: '#4a3a26', load: 'dung' };
        T.who = 'A farmer’s cart';
        T.facts.push(['Horses', '<b>' + num(nd) + '</b> drawing a cart']);
        T.facts.push(['Wheels', '<b>' + pick(r, ['4', '4½', '6']) + ' inches</b> across the tyre']);
        if (k === 'dung') {
          T.facts.push(['Load', 'stable dung, steaming, smells exactly as it should']);
          T.says = '“Muck for the long field.”';
          T.due = 0; T.why = 'Dung for the land goes free';
        } else {
          T.facts.push(['Load', 'a thin layer of dung, and under the tail board the corners of ' + pick(r, ['meal sacks', 'a crate of bottles', 'sacks of malt'])]);
          T.says = '“Only muck, master, for the long field.”';
          T.due = nd * B.narrow; T.why = 'The dung is a skin over ' + (nd > 1 ? 'a load' : 'a load') + ' that pays: ' + num(nd) + ' horse' + (nd > 1 ? 's' : '') + ' at ' + money(B.narrow) + ' = ' + money(T.due) + ' (counted at the narrow rate)';
          T.draw.colour = '#3a2e20';
          // keep wheels consistent with the narrow rate
          T.facts[1] = ['Wheels', '<b>4 inches</b> across the tyre'];
        }
        break;
      case 'stone':
        T.draw = { body: 'cart', horses: 2, colour: '#55524a', load: 'stone' };
        T.who = 'A cart from the trust’s quarry';
        T.facts.push(['Horses', '<b>two</b> drawing a cart'], ['Load', 'broken stone for mending this road'], ['Driver', 'shows the surveyor’s order']);
        T.due = 0; T.why = 'Materials for repairing the road go free';
        break;
      case 'soldiers':
        T.draw = { body: 'waggon', horses: 4, colour: '#6b1f1f', load: 'baggage' };
        T.who = 'The baggage waggon of a regiment on the march';
        T.facts.push(['Horses', '<b>four</b> drawing a waggon'], ['Wheels', '<b>4 inches</b>'], ['With it', 'a sergeant and a column of redcoats']);
        T.says = '“On the King’s service. Route’s here if you want to read it.”';
        T.due = 0; T.why = 'Soldiers on the march and their baggage go free';
        break;
      case 'funeral':
        T.draw = { body: 'hearse', horses: 2, colour: '#111' };
        T.who = 'A funeral, the hearse and mourners on foot';
        T.facts.push(['Horses', '<b>two</b> drawing a hearse']);
        T.due = 0; T.why = 'Funerals go free'; T.pat = 30 * 60;
        break;
      case 'lime':
        var nl = 1 + Math.floor(r() * 2);
        T.draw = { body: 'cart', horses: nl, colour: '#6b675c', load: 'lime' };
        T.who = 'A cart from the lime kilns';
        T.facts.push(['Horses', '<b>' + num(nl) + '</b> drawing a cart'], ['Wheels', '<b>4 inches</b> across the tyre'], ['Load', 'burnt lime, for spreading on the land']);
        T.says = '“Lime for the land.”';
        if (B.lime) { T.due = 0; T.why = 'Lime for the land goes free on this road'; }
        else { T.due = nl * B.narrow; T.why = 'Lime is not exempt on this road: ' + num(nl) + ' horse' + (nl > 1 ? 's' : '') + ' at ' + money(B.narrow) + ' (narrow) = ' + money(T.due); }
        break;
      case 'plough':
        var nh = 2 + Math.floor(r() * 3);
        T.draw = { body: 'pack', horses: nh, colour: '#5a4630' };
        T.who = 'A ploughboy with the team';
        T.facts.push(['Horses', '<b>' + num(nh) + '</b>, in plough harness, not drawing anything']);
        T.says = '“Going to plough on the other side.”';
        if (B.plough) { T.due = 0; T.why = 'Horses going to plough go free on this road'; }
        else { T.due = nh * B.saddle; T.why = 'Plough horses are not exempt on this road: ' + num(nh) + ' at ' + money(B.saddle) + ' = ' + money(T.due); }
        break;
      case 'church':
        T.draw = { body: 'gig', horses: 1, colour: colour };
        T.who = pick(r, ['A family in a gig, in their best', 'An old couple in a gig, prayer books on the seat', 'A farmer and his daughters in a gig']);
        T.facts.push(['Horses', '<b>one</b> drawing a gig']);
        T.says = '“To church, at ' + R.gate.split(' ')[0] + ' church.”';
        if (sunday) { T.due = 0; T.why = 'Going to divine service on a Sunday goes free'; }
        else { T.due = B.coach; T.why = 'The church exemption is for Sundays, and today is not one: one coach horse at ' + money(B.coach); }
        break;
      case 'tnext': case 'tother': case 'tstale':
        var sub = pick(r, ['gig', 'rider', 'chaise']);
        var tt = traveller(r, sub, B, R, sunday, hd, year);
        var gateName = k === 'tother' ? R.other : k === 'tstale' ? R.gate : R.next;
        var dateS = k === 'tstale' ? yStr : todayStr;
        tt.facts.push(['Ticket', '<b>' + gateName + ' Gate</b>, dated <b>' + dateS + '</b>']);
        tt.says = '“Paid at ' + gateName + ', here’s the ticket.”';
        tt.kind = k;
        if (k === 'tnext') { tt.why = 'A ' + R.next + ' ticket of today clears this gate'; tt.due = 0; }
        else if (k === 'tother') tt.why = R.other + ' tickets do not clear this gate: ' + tt.why;
        else tt.why = 'Yesterday’s ticket clears nothing: ' + tt.why;
        tt.retOk = false;
        return tt;
    }
    if (ret) {
      T = traveller(r, ret.kind, B, R, sunday, hd, year);
      T.who = ret.who + ', coming back';
      T.draw = ret.draw;
      T.facts = ret.facts.slice(0, 1).concat([['Ticket', '<b>' + R.gate + ' Gate</b>, dated <b>' + todayStr + '</b>']]);
      T.says = '“Came through this morning, here’s your own ticket.”';
      T.due = 0; T.why = 'Your own ticket of today brings them back free';
      T.retOk = false; T.kind = 'return';
    }
    return T;
  }

  /* ---------- the page ---------- */
  function $(id) { return document.getElementById(id); }
  var day, S, dayOff = 0, lastFrame = null;
  var canvas = $('road'), ctx = canvas.getContext('2d');
  var CW = 640, CH = 250, GATE = 420, ROADY = 200;
  function say(html) { $('msg').innerHTML = html; }

  function loadDay(off) {
    dayOff = off;
    day = makeDay(off);
    var R = day.R, B = day.B;
    $('rWho').textContent = day.wd + ' ' + day.dateText + ' ' + day.year + ' · ' + R.road;
    $('rName').textContent = R.gate + ' Gate, on the road to ' + R.town;
    $('rBlurb').innerHTML = 'You keep the gate from <b>' + clock(day.start) + '</b> to <b>' + clock(day.end) + '</b>. ' +
      (day.sunday ? 'It is <b>Sunday</b>: little goods traffic, and families going to church who owe nothing. ' :
        day.market ? 'It is <b>market day</b> in ' + R.town + ', and the beasts and carts will be out. ' : 'It is a ' + day.wd + '. ') +
      (B.engine ? 'The gate has a <b>weighing engine</b>, so every waggon and cart goes on the platform. ' : 'There is no weighing engine at this gate. ') +
      (B.mail ? 'The Mail runs on this road and stops for nobody. ' : 'There are no mail coaches yet; letters go by post boy. ') +
      'The lessee’s rent works out at <b>' + money(day.rent) + '</b> for the morning, and you keep whatever you take over it.';
    $('rBook').innerHTML = '“Count the horses, not the passengers. Measure the wheels, not the waggoner’s temper. And when a cart ' +
      'smells of nothing at all, lift the dung.” — a gatekeeper’s advice to his successor';
    board();
    var lbl = off === 0 ? 'Today’s' : off === -1 ? 'Yesterday’s' : off === 1 ? 'Tomorrow’s' : (off > 0 ? '+' : '') + off + ' days';
    $('dayOut').textContent = lbl + ' gate · ' + day.dateText;
    fresh();
  }

  function board() {
    var B = day.B, R = day.R;
    var rows = [
      ['For every horse or other beast drawing any coach, chariot, chaise, gig or such like carriage', B.coach],
      ['For every horse drawing any waggon, cart or such like carriage, the wheels being six inches broad or more', B.broad],
      ['The same, the wheels being less than six inches broad', B.narrow],
      ['For every horse, mule or ass, laden or unladen, and not drawing', B.saddle],
      ['For every drove of oxen or neat cattle, per score, and so in proportion', B.cattle],
      ['For every drove of calves, hogs, sheep or lambs, per score, and so in proportion', B.sheep]
    ];
    var h = '<h4>Table of tolls · ' + day.R.gate + ' Gate</h4><table>';
    rows.forEach(function (x) { h += '<tr><td>' + x[0] + '</td><td class="n">' + money(x[1]) + '</td></tr>'; });
    if (B.engine) h += '<tr><td>Waggons and carts weighing with their load above <b>' + B.limB + ' cwt</b> (broad wheels) or <b>' + B.limN +
      ' cwt</b> (narrow), for every hundredweight over</td><td class="n">' + money(B.over) + '</td></tr>';
    h += '</table><p class="ex"><b>Free:</b> ' + (B.mail ? 'His Majesty’s Mails; ' : '') + 'soldiers on the march and their baggage; ' +
      'persons going to or from divine service on Sundays; funerals; dung or manure for the land; materials for repairing this road' +
      (B.lime ? '; lime for the land' : '') + (B.plough ? '; horses going to or from plough' : '') + '. Foot passengers pass free.</p>' +
      '<p class="ex"><b>Tickets:</b> a ticket taken here clears <b>' + R.next + '</b> gate the same day, and a ticket of the same day from <b>' +
      R.next + '</b> clears this gate. A ticket of this gate brings the same carriage back free the same day.' +
      (B.lime ? '' : ' <b>Lime pays.</b>') + (B.plough ? '' : ' <b>Plough horses pay.</b>') + '</p>';
    $('board').innerHTML = h;
  }

  function fresh() {
    S = {
      t: day.start - 1, phase: 'ready', ai: 0, q: [], leaving: [], till: [], taken: 0, lost: 0, comps: 0, overBy: 0,
      mailFines: 0, done: [], fast: false, lastMsgT: 0, served: null
    };
    // anyone already waiting
    while (S.ai < day.list.length && day.list[S.ai].t <= day.start) { arrive(day.list[S.ai]); S.ai++; }
    $('verdict').innerHTML = ''; $('verdict').className = 'verdict';
    $('reveal').style.display = 'none'; $('reveal').innerHTML = '';
    $('bAgain').style.display = 'none';
    $('bGo').style.display = '';
    say('The board is painted, the till is empty and the gate is shut. ' + (S.q.length ? '<b>' + num(S.q.length) + '</b> already waiting on the road. ' : '') +
      'Open the toll house when you are ready; the morning will not wait for you after that.');
    paceOut(); front(); hud(); draw();
  }

  function arrive(x) {
    var tr = { T: x, at: x.t, complained: false, horn: false };
    if (x.mail) { S.q.unshift(tr); } else S.q.push(tr);
  }

  function paceOut() { $('paceOut').textContent = PACENAME[+$('pace').value]; }

  function front() {
    var f = S.q[0];
    var live = S.phase === 'run' && f;
    $('bTake').disabled = !live; $('bFree').disabled = !live;
    $('bWait').disabled = !(S.phase === 'run' && !S.q.length && S.t < day.end);
    $('bEnd').disabled = S.phase !== 'run';
    if (!f) {
      $('fWho').textContent = S.phase === 'done' ? 'The gate is handed over.' : 'The road is empty.';
      $('fFacts').innerHTML = ''; $('fSays').textContent = '';
    } else {
      $('fWho').textContent = f.T.who;
      $('fFacts').innerHTML = f.T.facts.map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td></tr>'; }).join('');
      $('fSays').innerHTML = f.T.says || '';
    }
    $('bTake').textContent = 'Take ' + money(tillSum()) + ' and open';
  }
  function tillSum() { var s = 0; S.till.forEach(function (c) { s += c; }); return s; }
  function tillOut() { $('sum').textContent = money(tillSum()); $('bTake').textContent = 'Take ' + money(tillSum()) + ' and open'; }

  function hud() {
    $('hWhen').textContent = S.phase === 'ready' ? clock(day.start) + ' (shut)' : clock(S.t);
    $('hQueue').textContent = S.q.length ? num(S.q.length) + (S.q.length > 1 ? ' waiting' : ' at the gate') : 'nobody';
    $('hTaken').textContent = money(S.taken);
    $('hComp').textContent = S.comps + (S.mailFines ? ' + Mail' : '');
    $('hCompBox').className = S.comps || S.mailFines ? 'alarm' : '';
  }

  function decide(paid) {
    if (S.phase !== 'run' || !S.q.length) return;
    var f = S.q.shift(), T = f.T, diff = paid - T.due, res;
    if (Math.abs(diff) <= T.tol) res = 'ok';
    else if (diff < 0) res = 'under';
    else res = 'over';
    S.taken += paid;
    var rec = { T: T, paid: paid, res: res, at: f.at, served: S.t, wait: S.t - f.at };
    S.done.push(rec);
    var msg;
    if (res === 'ok') {
      msg = T.due === 0 ? '<b>Right.</b> ' + T.why + '.' : '<b>Right: ' + money(paid) + '.</b> ' + cap(T.why) + '.';
      if (T.mail && f.horn) msg += ' But the Mail had to wait, and the guard has your name.';
    } else if (res === 'under') {
      S.lost += T.due - paid;
      msg = '<b>Short by ' + money(T.due - paid) + '.</b> ' + cap(T.why) + '. That money is gone.';
    } else {
      S.comps++; S.overBy += diff;
      msg = '<b>Overcharged by ' + money(diff) + '.</b> ' + cap(T.why) + '. They will complain to the trustees’ clerk.';
      if (T.mail) { msg = '<b>You tried to take money off the Mail.</b> ' + T.why; }
    }
    say(msg);
    S.leaving.push({ T: T, x: GATE - 10, born: performance.now() });
    S.till = []; tillOut();
    front(); hud();
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function start() {
    if (S.phase !== 'ready') return;
    S.phase = 'run'; S.t = day.start; lastFrame = null;
    $('bGo').style.display = 'none';
    say('The gate is yours. ' + (S.q.length ? 'Serve whoever is at the front.' : 'Nobody yet; listen for wheels.'));
    front(); hud();
  }

  function endShift() {
    if (S.phase === 'done') return;
    S.phase = 'done';
    // anyone still waiting goes through unpaid when the night man takes over
    S.q.forEach(function (f) { if (f.T.due > 0) { S.lost += f.T.due; S.done.push({ T: f.T, paid: 0, res: 'gone', at: f.at, served: S.t, wait: S.t - f.at }); } });
    S.q = [];
    front(); hud(); draw(); verdict();
  }

  /* ---------- the clock ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    if (!day) return;
    var dt = lastFrame == null ? 0 : Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    if (S.phase === 'run') {
      var g = dt * 60 / PACES[+$('pace').value];
      if (S.fast) g = dt * 60 * 30;
      S.t += g;
      while (S.ai < day.list.length && day.list[S.ai].t <= S.t) {
        var x = day.list[S.ai++];
        arrive(x);
        S.fast = false;
        if (x.mail) say('<b>A horn up the road.</b> The Mail is coming, and it goes to the front of the queue.');
        front();
      }
      // patience
      for (var i = S.q.length - 1; i >= 0; i--) {
        var f = S.q[i], w = S.t - f.at;
        if (f.T.mail) {
          if (w > f.T.pat && !f.horn) { f.horn = true; S.mailFines++; say('<b>The guard blows again and writes down your name.</b> The Post Office will fine you ' + money(FINE_MAIL) + '.'); }
          continue;
        }
        if (w > f.T.pat) {
          if (f.T.walksRound && i > 0) {
            S.q.splice(i, 1);
            if (f.T.due > 0) S.lost += f.T.due;
            S.done.push({ T: f.T, paid: 0, res: 'gone', at: f.at, served: S.t, wait: w });
            say(cap(f.T.who.charAt(0).toLowerCase() + f.T.who.slice(1)) + ' got tired of waiting and went round by the back lane without paying.');
            front();
          } else if (!f.complained) {
            f.complained = true; S.comps++;
            say(cap(f.T.who) + ' has been kept waiting ' + Math.round(w / 60) + ' minutes and will complain to the trustees.');
          }
        }
      }
      if (S.t >= day.end && !S.q.length && S.ai >= day.list.length) {
        say('The night man comes down the lane to take over.');
        endShift();
      }
      hud();
      $('bWait').disabled = !(S.phase === 'run' && !S.q.length && S.t < day.end);
    }
    draw();
  }

  /* ---------- drawing ---------- */
  function sunrise() { return 6 + 2 * Math.cos(2 * Math.PI * (day.month + 0.5) / 12); }
  function sky(t) {
    var h = t / 3600, sr = sunrise();
    var k = clamp((h - sr + 0.6) / 1.6, 0, 1);
    function mix(a, b) { return Math.round(a + (b - a) * k); }
    return ['rgb(' + mix(18, 120) + ',' + mix(22, 158) + ',' + mix(40, 196) + ')', 'rgb(' + mix(40, 205) + ',' + mix(34, 196) + ',' + mix(48, 170) + ')', k];
  }
  function itemW(T) {
    var d = T.draw || {};
    if (d.body === 'cattle' || d.body === 'sheep' || d.body === 'pigs') return 40 + Math.min(60, d.count * (d.body === 'sheep' ? 0.3 : 1.2));
    if (d.body === 'rider' || d.body === 'pack') return 18 + d.horses * 18;
    var bodyW = d.body === 'waggon' || d.body === 'stage' || d.body === 'mail' ? 46 : d.body === 'gig' ? 22 : 32;
    return bodyW + Math.ceil(d.horses / 2) * 20 + 8;
  }
  function horse(x, y, col) {
    ctx.fillStyle = col || '#5a3d26';
    ctx.fillRect(x - 8, y - 12, 14, 6);
    ctx.fillRect(x + 4, y - 17, 4, 8);
    ctx.fillRect(x - 7, y - 6, 2, 6); ctx.fillRect(x + 3, y - 6, 2, 6);
  }
  function wheel(x, y, rad) { ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - rad, rad, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
  function drawItem(T, xr, y) {
    // xr is the right-hand (front) end; everything travels to the right
    var d = T.draw || {};
    var b = d.body;
    if (b === 'cattle' || b === 'sheep' || b === 'pigs') {
      var w = itemW(T), n = Math.min(d.count, b === 'sheep' ? 40 : 30), rr = rng(T.id * 7 + 3);
      for (var i = 0; i < n; i++) {
        var ax = xr - 6 - rr() * (w - 16), ay = y - 3 - rr() * 12;
        ctx.fillStyle = b === 'sheep' ? '#e6e0cf' : b === 'pigs' ? '#d9a38f' : pick(rr, ['#6b4426', '#2a1e18', '#a0643a', '#d8d0c0']);
        ctx.beginPath(); ctx.ellipse(ax, ay, b === 'cattle' ? 6 : 4, b === 'cattle' ? 3.5 : 3, 0, 0, Math.PI * 2); ctx.fill();
      }
      // the drover
      ctx.fillStyle = '#c9c2ae'; ctx.fillRect(xr - w + 2, y - 18, 3, 18);
      return;
    }
    if (b === 'rider' || b === 'pack') {
      for (var j = 0; j < d.horses; j++) {
        var hx = xr - 8 - j * 18;
        horse(hx, y, j === 0 || b === 'pack' ? '#5a3d26' : '#7a5636');
        if (b === 'pack') { ctx.fillStyle = '#9a8a62'; ctx.fillRect(hx - 6, y - 16, 10, 5); }
      }
      if (b === 'rider') { ctx.fillStyle = d.colour; ctx.fillRect(xr - 10, y - 24, 4, 10); ctx.fillStyle = '#e6d6b8'; ctx.fillRect(xr - 10, y - 28, 4, 4); }
      return;
    }
    // horses in pairs, then the body
    var pairs = Math.ceil(d.horses / 2);
    for (var p = 0; p < pairs; p++) { horse(xr - 8 - p * 20, y, '#5a3d26'); if (d.horses > 1 && (p * 2 + 1) < d.horses) horse(xr - 12 - p * 20, y - 3, '#46301d'); }
    var bx = xr - pairs * 20 - 6;
    var bw = b === 'waggon' || b === 'stage' || b === 'mail' ? 46 : b === 'gig' ? 22 : 32;
    var x0 = bx - bw;
    if (b === 'waggon') {
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x0, y - 18, bw, 8);
      ctx.fillStyle = d.load === 'baggage' ? '#c8b98f' : '#e9e2cc';
      ctx.beginPath(); ctx.moveTo(x0, y - 18); ctx.quadraticCurveTo(x0 + bw / 2, y - 40, x0 + bw, y - 18); ctx.fill();
      wheel(x0 + 8, y, 7); wheel(x0 + bw - 8, y, 8);
    } else if (b === 'cart') {
      ctx.fillStyle = '#7a5a36'; ctx.fillRect(x0, y - 18, bw, 9);
      ctx.fillStyle = d.load === 'dung' ? '#4a3420' : d.load === 'lime' ? '#e7e3d6' : d.load === 'stone' ? '#8a877d' : '#9a7a4a';
      ctx.fillRect(x0 + 2, y - 23, bw - 4, 5);
      wheel(x0 + bw / 2, y, 8);
    } else if (b === 'hearse') {
      ctx.fillStyle = '#111'; ctx.fillRect(x0, y - 30, bw, 20);
      ctx.fillStyle = '#333'; ctx.fillRect(x0 + 4, y - 36, 3, 6); ctx.fillRect(x0 + bw - 7, y - 36, 3, 6);
      wheel(x0 + 6, y, 6); wheel(x0 + bw - 6, y, 6);
    } else if (b === 'gig') {
      ctx.fillStyle = d.colour; ctx.fillRect(x0, y - 20, bw, 8);
      ctx.fillStyle = '#e6d6b8'; ctx.fillRect(x0 + 6, y - 28, 4, 4); ctx.fillStyle = '#222'; ctx.fillRect(x0 + 6, y - 24, 4, 4);
      wheel(x0 + bw / 2, y, 9);
    } else {
      // stage, mail, chaise, chariot
      var hgt = b === 'chaise' ? 18 : 20;
      ctx.fillStyle = d.colour; ctx.fillRect(x0, y - 12 - hgt, bw, hgt);
      ctx.fillStyle = 'rgba(220,230,240,.55)'; ctx.fillRect(x0 + 5, y - 9 - hgt, 8, 7); if (bw > 40) ctx.fillRect(x0 + bw - 13, y - 9 - hgt, 8, 7);
      if (b === 'stage' || b === 'mail') { ctx.fillStyle = '#3a3226'; ctx.fillRect(x0 + 4, y - 15 - hgt, bw - 8, 3); ctx.fillStyle = '#b9a179'; ctx.fillRect(x0 + 8, y - 19 - hgt, 12, 4); }
      if (b === 'mail') { ctx.fillStyle = '#111'; ctx.fillRect(x0, y - 16, bw, 4); ctx.fillStyle = '#f2d36b'; ctx.fillRect(x0 + bw / 2 - 4, y - 24, 8, 4); }
      wheel(x0 + 8, y, 7); wheel(x0 + bw - 8, y, 7);
    }
  }

  function draw() {
    if (!day) return;
    var t = S.phase === 'ready' ? day.start : S.t;
    var sk = sky(t);
    var g = ctx.createLinearGradient(0, 0, 0, ROADY);
    g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
    // hills and hedges
    ctx.fillStyle = sk[2] > 0.5 ? '#3d5a34' : '#1c2a1a';
    ctx.beginPath(); ctx.moveTo(0, 150);
    for (var x = 0; x <= CW; x += 20) ctx.lineTo(x, 140 - 18 * Math.sin(x / 90 + day.off) - 8 * Math.sin(x / 37));
    ctx.lineTo(CW, ROADY); ctx.lineTo(0, ROADY); ctx.fill();
    ctx.fillStyle = sk[2] > 0.5 ? '#2c4426' : '#141f13'; ctx.fillRect(0, 170, CW, 12);
    // road
    ctx.fillStyle = '#7d7462'; ctx.fillRect(0, ROADY - 18, CW, 30);
    ctx.fillStyle = '#5f584a'; ctx.fillRect(0, ROADY + 12, CW, CH - ROADY - 12);
    // toll house
    var hx = GATE + 24;
    ctx.fillStyle = '#d8d0bc'; ctx.fillRect(hx, 112, 64, 58);
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(hx - 6, 114); ctx.lineTo(hx + 32, 88); ctx.lineTo(hx + 70, 114); ctx.fill();
    ctx.fillStyle = sk[2] < 0.5 ? '#f2c96b' : '#3a4656'; ctx.fillRect(hx + 8, 126, 12, 14); ctx.fillRect(hx + 44, 126, 12, 14);
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(hx + 26, 140, 12, 30);
    // the board on the house
    ctx.fillStyle = '#1b2219'; ctx.fillRect(hx + 4, 146, 18, 20); ctx.fillStyle = '#f2d36b';
    for (var l = 0; l < 5; l++) ctx.fillRect(hx + 6, 149 + l * 3.4, 14, 1);
    // queue
    var open = S.leaving.length && performance.now() - S.leaving[S.leaving.length - 1].born < 1400;
    var xr = GATE - 14, shown = 0;
    for (var i = 0; i < S.q.length; i++) {
      var w = itemW(S.q[i].T);
      if (xr - w < -10) break;
      drawItem(S.q[i].T, xr, ROADY + 4);
      if (i === 0) { ctx.fillStyle = '#f2d36b'; ctx.beginPath(); ctx.moveTo(xr - w / 2 - 4, 40); ctx.lineTo(xr - w / 2 + 4, 40); ctx.lineTo(xr - w / 2, 47); ctx.fill(); }
      xr -= w + 10; shown++;
    }
    if (shown < S.q.length) {
      ctx.fillStyle = '#e8edf5'; ctx.font = '600 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'left';
      ctx.fillText('+' + (S.q.length - shown) + ' MORE UP THE ROAD', 8, 30);
    }
    // leaving
    var now = performance.now();
    S.leaving = S.leaving.filter(function (L) { return now - L.born < 4200; });
    S.leaving.forEach(function (L) { drawItem(L.T, GATE + 10 + (now - L.born) / 1000 * 70 + itemW(L.T), ROADY + 4); });
    // the gate: white five-bar, swung open while someone passes
    ctx.strokeStyle = '#f2eee0'; ctx.fillStyle = '#f2eee0'; ctx.lineWidth = 3;
    ctx.fillRect(GATE - 3, ROADY - 44, 6, 52);
    ctx.lineWidth = 2;
    if (open) {
      ctx.beginPath(); for (var k = 0; k < 4; k++) { ctx.moveTo(GATE, ROADY - 38 + k * 9); ctx.lineTo(GATE + 10, ROADY - 40 + k * 9); } ctx.stroke();
    } else {
      ctx.beginPath();
      for (var k2 = 0; k2 < 4; k2++) { ctx.moveTo(GATE, ROADY - 38 + k2 * 9); ctx.lineTo(GATE - 70, ROADY - 38 + k2 * 9); }
      ctx.moveTo(GATE - 70, ROADY - 38); ctx.lineTo(GATE - 70, ROADY - 11);
      ctx.moveTo(GATE, ROADY - 38); ctx.lineTo(GATE - 70, ROADY - 11);
      ctx.stroke();
      // spikes on the top rail
      for (var s2 = 0; s2 < 8; s2++) { ctx.beginPath(); ctx.moveTo(GATE - 66 + s2 * 9, ROADY - 38); ctx.lineTo(GATE - 64 + s2 * 9, ROADY - 44); ctx.stroke(); }
    }
    ctx.lineWidth = 1;
    // caption
    ctx.fillStyle = sk[2] > 0.5 ? '#16202c' : '#cfd6e2';
    ctx.font = '600 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'right';
    ctx.fillText(day.R.gate.toUpperCase() + ' GATE · ' + (S.phase === 'ready' ? 'SHUT' : clock(t).toUpperCase()), CW - 10, 20);
    if (S.phase === 'ready') { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(232,237,245,.85)'; ctx.fillText('THE TOLL HOUSE IS NOT OPEN YET', CW / 2, 66); }
  }

  /* ---------- the reckoning ---------- */
  function verdict() {
    var fines = S.comps * FINE_COMPLAINT + S.mailFines * FINE_MAIL + S.overBy;
    var net = S.taken - day.rent - fines;
    var ok = 0, under = 0, over = 0, gone = 0;
    S.done.forEach(function (d) { if (d.res === 'ok') ok++; else if (d.res === 'under') under++; else if (d.res === 'over') over++; else gone++; });
    var good = net > 0 && over === 0 && under <= 1;
    $('verdict').className = 'verdict ' + (net > 0 ? 'good' : 'warn');
    $('verdict').innerHTML = '<p><b>' + (good ? 'A clean morning at ' + day.R.gate + '.' : net > 0 ? 'You cleared the rent, just about honestly.' : 'The gate cost you money this morning.') + '</b></p>' +
      '<p>' + S.done.length + ' through the gate: <b>' + ok + '</b> charged right, <b>' + under + '</b> short, <b>' + over + '</b> overcharged' +
      (gone ? ', <b>' + gone + '</b> went round or through unpaid' : '') + '. You took <b>' + money(S.taken) + '</b> against a rent of ' + money(day.rent) +
      (fines ? ', and the clerk and the Post Office want <b>' + money(fines) + '</b> back' : '') + '. You keep <b>' + money(net) + '</b>.</p>';

    var rv = $('reveal'); rv.style.display = '';
    rv.innerHTML = '<h5>The morning at the gate</h5><canvas id="tl" width="640" height="180"></canvas>' +
      '<div class="key"><span><i style="background:#64f0c8"></i>right</span><span><i style="background:#ffce6a"></i>short</span>' +
      '<span><i style="background:#ff8fa3"></i>overcharged</span><span><i style="background:#8b97ab"></i>went round</span>' +
      '<span><i style="background:rgba(233,223,199,.5)"></i>time kept waiting</span></div>' +
      '<h5>The account</h5><table class="card">' +
      row('Tolls taken', money(S.taken)) + row('Rent for the morning', '− ' + money(day.rent)) +
      (S.overBy ? row('Excess returned to complainants', '− ' + money(S.overBy)) : '') +
      (S.comps ? row(S.comps + ' complaint' + (S.comps > 1 ? 's' : '') + ' upheld at ' + money(FINE_COMPLAINT), '− ' + money(S.comps * FINE_COMPLAINT)) : '') +
      (S.mailFines ? row('Fined by the Post Office for delaying the Mail', '− ' + money(S.mailFines * FINE_MAIL)) : '') +
      (S.lost ? row('Lost by charging short or letting through (not in the sum)', money(S.lost)) : '') +
      '<tr class="tot"><td>Yours to keep</td><td class="n">' + money(net) + '</td></tr></table>' +
      '<h5>Where the board and the till disagreed</h5><div id="mist"></div>';
    function row(a, b) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td></tr>'; }
    var m = S.done.filter(function (d) { return d.res !== 'ok'; });
    $('mist').innerHTML = m.length ? m.map(function (d) {
      return '<div class="tl-row"><time>' + clock(d.served) + '</time><span class="tag ' + d.res + '">' +
        (d.res === 'gone' ? 'unpaid' : d.res) + '</span><span>' + d.T.who + ': ' + (d.res === 'gone' ? 'owed ' + money(d.T.due) : 'you took ' + money(d.paid) + ', the board says ' + money(d.T.due)) +
        '. ' + cap(d.T.why) + '.</span></div>';
    }).join('') : '<p>Nowhere. Every toll was right.</p>';
    drawTimeline($('tl'));
    $('bAgain').style.display = '';
  }

  function drawTimeline(cv) {
    var c = cv.getContext('2d'), W = 640, H = 180, L = 20, Rr = 620, T = 14, Bm = 150;
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H);
    var t0 = day.start - 300, t1 = Math.max(day.end, S.t);
    function X(t) { return L + (t - t0) / (t1 - t0) * (Rr - L); }
    var lanes = 6, laneEnd = [];
    for (var i = 0; i < lanes; i++) laneEnd.push(-1e9);
    var maxDue = 1; S.done.forEach(function (d) { maxDue = Math.max(maxDue, d.T.due); });
    S.done.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (d) {
      var ln = 0; for (var i = 0; i < lanes; i++) if (laneEnd[i] < d.at) { ln = i; break; }
      laneEnd[ln] = d.served + 120;
      var y = T + ln * ((Bm - T) / lanes) + 4, hh = (Bm - T) / lanes - 8;
      c.fillStyle = 'rgba(233,223,199,.18)'; c.fillRect(X(d.at), y, Math.max(2, X(d.served) - X(d.at)), hh);
      c.fillStyle = d.res === 'ok' ? '#64f0c8' : d.res === 'under' ? '#ffce6a' : d.res === 'over' ? '#ff8fa3' : '#8b97ab';
      var bh = d.T.due > 0 ? Math.max(3, hh * Math.sqrt(d.T.due / maxDue)) : 3;
      c.fillRect(X(d.served) - 2, y + hh - bh, 4, bh);
    });
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(X(day.start), T); c.lineTo(X(day.start), Bm); c.moveTo(X(day.end), T); c.lineTo(X(day.end), Bm); c.stroke();
    c.fillStyle = '#8b97ab'; c.font = '600 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    for (var m = 0; m <= 180; m += 30) c.fillText(clock(day.start + m * 60), X(day.start + m * 60), H - 12);
  }

  /* ---------- wiring ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.coin[data-d]'), function (b) {
    b.addEventListener('click', function () { if (S.phase === 'run') { S.till.push(+b.getAttribute('data-d')); tillOut(); } });
  });
  $('bUndo').addEventListener('click', function () { S.till.pop(); tillOut(); });
  $('bClear').addEventListener('click', function () { S.till = []; tillOut(); });
  $('bTake').addEventListener('click', function () { decide(tillSum()); });
  $('bFree').addEventListener('click', function () { S.till = []; tillOut(); decide(0); });
  $('bGo').addEventListener('click', start);
  $('bWait').addEventListener('click', function () { if (S.phase === 'run' && !S.q.length) { S.fast = true; say('You sit by the fire and listen for wheels.'); } });
  $('bEnd').addEventListener('click', function () { if (S.phase === 'run') { say('You hand the gate to the night man early' + (S.q.length ? ', and whoever is waiting goes through on his watch, not yours.' : '.')); endShift(); } });
  $('bAgain').addEventListener('click', function () { fresh(); });
  $('pace').addEventListener('input', paceOut);
  var KEYS = { Digit1: 0.5, Digit2: 1, Digit3: 3, Digit4: 6, Digit5: 12, Digit6: 60 };
  document.addEventListener('keydown', function (e) {
    if (!S || S.phase === 'done') return;
    if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range' || e.target.tagName === 'TEXTAREA')) return;
    var c = e.code, used = true;
    if (S.phase === 'ready' && (c === 'Enter' || c === 'Space')) start();
    else if (KEYS[c] != null && S.phase === 'run') { S.till.push(KEYS[c]); tillOut(); }
    else if (c === 'Backspace') { S.till.pop(); tillOut(); }
    else if (c === 'Enter') { if (e.target && e.target.tagName === 'BUTTON') return; decide(tillSum()); }
    else if (c === 'KeyF') { S.till = []; tillOut(); decide(0); }
    else used = false;
    if (used) e.preventDefault();
  });
  document.addEventListener('visibilitychange', function () { lastFrame = null; });
  $('btnDayPrev').addEventListener('click', function () { loadDay(dayOff - 1); });
  $('btnDayToday').addEventListener('click', function () { loadDay(0); });
  $('btnDayNext').addEventListener('click', function () { loadDay(dayOff + 1); });

  loadDay(0);
  requestAnimationFrame(frame);
})();
