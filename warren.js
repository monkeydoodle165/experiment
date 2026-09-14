/* drift — The Warren
   A small text adventure dealt by the day's number. Self-contained, no deps. */
(function () {
  'use strict';

  /* ---------- the same seeded PRNG the rest of the site uses ---------- */
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
  function R(rand) {
    return {
      f: rand,
      range: function (a, b) { return a + Math.floor(rand() * (b - a + 1)); },
      pick: function (a) { return a[Math.floor(rand() * a.length)]; },
      chance: function (p) { return rand() < p; },
      shuffle: function (a) {
        var b = a.slice(), i, j, t;
        for (i = b.length - 1; i > 0; i--) {
          j = Math.floor(rand() * (i + 1));
          t = b[i]; b[i] = b[j]; b[j] = t;
        }
        return b;
      }
    };
  }

  /* ---------- settings ---------- */
  var SETTINGS = [
    {
      id: 'cloister',
      suffix: ['marsh', 'fleet', 'holm', 'ford', 'mere'],
      title: 'Cloister',
      premise: "The river changed its mind about where it lived, and this went under with everything still in it. The water is down for the week. It will not be down next week.",
      errand: "the reliquary",
      goalDesc: "A box the length of your forearm, silver over oak, with a hinge that has not been asked to move in a very long time. It is heavier than a box that size has any business being.",
      rooms: ['the cloister walk', 'the chapter house', 'the flooded nave', 'the crypt stair', 'the refectory', 'the lavatorium', 'the sacristy', 'the bell chamber', 'the scriptorium', 'the herb store', 'the almonry', 'the undercroft', 'the night stair', 'the vestry'],
      surfaces: ['green limestone', 'silted flagstone', 'swollen oak', 'salt-bloomed plaster', 'slick tufa'],
      sounds: ["water moving somewhere below you", "a slow drip keeping time", "the river working patiently at the walls", "nothing whatsoever, which is worse", "a bell rope creaking on its own"],
      lights: ["a grey light coming up off the water", "one lancet window doing its best", "the green glow the algae makes on the stone", "lamplight, and only as much as you brought"],
      quirks: ["A tidemark runs round the wall at chest height, and it is fresher than it should be.", "Someone has stacked the psalters above the line. Someone knew.", "There are fish in here. They are not troubled by you."],
      keys: ['a brass tally', 'a bone stylus', "the sacristan's ring", 'a lead cockle', 'an iron cross-key', 'a rope of blue silk', 'a wax seal on a cord', 'a bundle of dry reeds'],
      barriers: ['a door of studded oak', 'a rusted grille', 'a hatch swollen into its frame', 'a gate of iron bars', 'a bricked arch with one loose course']
    },
    {
      id: 'station',
      suffix: ['fjord', 'skar', 'vik', 'nes', 'berg'],
      title: 'Signal Station',
      premise: "Nine people wintered here and eight went home. The relief ship is four days out and the wind has got up. You have until the light goes.",
      errand: "the last tape",
      goalDesc: "A reel of quarter-inch tape in a tin, labelled in pencil with a date and then, underneath, in a different hand, the word LISTEN.",
      rooms: ['the boot room', 'the mess', 'the transmitter hall', 'the mast footing', 'the generator shed', 'the bunk room', 'the met office', 'the store hut', 'the ice tunnel', 'the fuel bunker', 'the map room', 'the roof walk', 'the cistern', 'the workshop'],
      surfaces: ['frosted steel', 'tarred plank', 'rime-furred pipework', 'painted bulkhead', 'packed grey ice'],
      sounds: ["the wind taking a run at the walls", "a generator somewhere refusing to die", "static from a set nobody switched off", "the ice ticking as it moves", "your own breathing, amplified by the steel"],
      lights: ["a bulb browning at the filament", "daylight the colour of dishwater", "the green wash off a valve set", "your torch, and the dark it makes everywhere else"],
      quirks: ["The stove is cold but the kettle on it is not quite.", "Nine mugs. Eight are upside down on the rack.", "The wind drops for a second and you hear the place creak back into shape."],
      keys: ['a stamped brass token', 'a fuse of the right rating', 'a spanner with a bent jaw', 'a punched card', 'a length of copper braid', 'the station log', 'a crank handle', 'a dry cell'],
      barriers: ['a steel door frozen at the hinge', 'a bulkhead hatch', 'a padlocked cage', 'a shutter iced into its runners', 'a pressure door']
    },
    {
      id: 'glass',
      suffix: ['caster', 'ley', 'bridge', 'wick', 'thorpe'],
      title: 'Glassworks',
      premise: "The furnace went out on a Friday and nobody came in on the Monday. Glass does not like being left. Neither, it turns out, does anything else in here.",
      errand: "the colour book",
      goalDesc: "A ledger of recipes, one to a page, each with a smear of the result beside it. Every colour this place ever made is in here and nowhere else.",
      rooms: ['the batch floor', 'the annealing lehr', 'the blowing room', 'the cullet yard', 'the pot arch', 'the pattern loft', 'the crate store', 'the counting office', 'the flue tunnel', 'the mould shop', 'the silica bins', "the gaffer's bench", 'the cooling shed', 'the yard gate'],
      surfaces: ['clinker brick', 'sand-gritted concrete', 'iron plate gone blue with heat', 'glazed tile', 'fire-cracked firebrick'],
      sounds: ["the furnace cooling and complaining about it", "glass settling somewhere in the dark", "a fan turning without having been asked", "your boots, mostly", "a high ringing you can only hear if you stop"],
      lights: ["a last orange breath out of the pot arch", "a skylight two fingers deep in dust", "a strip light with a stutter in it"],
      quirks: ["A gather has been left on the end of a punty and has slumped into a shape nobody chose.", "The floor glitters. All of it. Walk carefully.", "Someone's initials are in the brick, dated, and the date is not recent."],
      keys: ['a graphite paddle', 'a numbered mould', 'a brass key on a leather thong', 'a pattern card', 'a pair of tongs', 'a torn ledger page', 'a colour sample', 'a gaffer’s punty'],
      barriers: ['a sliding fire door', 'a steel shutter', 'a chained gate', 'a hatch bolted from the far side', 'a stack of crates you cannot shift alone']
    },
    {
      id: 'vault',
      suffix: ['fjell', 'horn', 'grat', 'spitz', 'kamm'],
      title: 'Seed Vault',
      premise: "Everything worth growing is filed in here at eighteen below. The compressors have been running on one phase for a month and the power budget says today.",
      errand: "the black envelope",
      goalDesc: "A foil envelope, unmarked except for an accession number, containing about forty seeds of a grain that no field anywhere has carried for sixty years.",
      rooms: ['the entrance adit', 'the sorting room', 'the cold hall', 'the drying racks', 'the germination lab', 'the pump room', 'the records office', 'the shaft head', 'the mountain gallery', 'the airlock', 'the crate store', 'the generator cave', 'the ventilation run', 'the sample library'],
      surfaces: ['sawn granite', 'sealed concrete', 'stainless tray', 'frosted glass', 'plastic sheeting gone brittle'],
      sounds: ["the compressors holding the cold together", "a fan running somewhere back in the rock", "the mountain saying nothing at all", "your breath, fogging and then falling"],
      lights: ["strip lights on a circuit that is dying", "one red emergency lamp", "white light far too bright for a room this size"],
      quirks: ["Every tray is labelled in three alphabets and one of them you do not recognise.", "The temperature readout ticks up a tenth while you stand there.", "There is frost on the inside of the door, in the shape of a hand."],
      keys: ['a keycard with the name worn off', 'a numbered vial', 'a cold-store mitt', 'a magnetic wand', 'a barcode strip', 'a torque driver', 'a page torn from the index', 'a spare compressor belt'],
      barriers: ['a cold-store door with a locking bar', 'an airlock with a dead panel', 'a steel grille', 'a hatch under a wheel-lock', 'a shutter set into the rock face']
    },
    {
      id: 'customs',
      suffix: ['haven', 'pool', 'quay', 'reach', 'staithe'],
      title: 'Custom House',
      premise: "Everything that came up this river was counted here, and some of it twice. The tide turns in an hour and takes the cellar with it, as it does.",
      errand: "the black ledger",
      goalDesc: "A ledger bound in oilcloth, in which is recorded, in an excellent hand, every cargo that was never landed. It balances perfectly. That is the problem with it.",
      rooms: ['the long counter', 'the bonded store', 'the weighing floor', 'the tide gauge', "the clerks' room", 'the strong room', 'the sample cellar', 'the river stair', 'the seal office', 'the archive', "the harbourmaster's room", 'the lantern loft', 'the coal cellar', 'the waiting hall'],
      surfaces: ['waxed mahogany', 'a worn stone sill', 'tarred rope', 'green linoleum', 'brass-bound counter'],
      sounds: ["the tide changing its mind against the wall", "a clock with a very heavy escapement", "gulls conducting an argument on the roof", "paper moving in a draught you cannot find"],
      lights: ["a gas mantle somebody left burning", "grey harbour light, second-hand", "a green-shaded lamp over an empty chair"],
      quirks: ["The inkwell is wet.", "A hat on a peg, and under it a coat, and in the coat pocket nothing at all.", "The ledger on the counter is open at today, and today has one line on it already."],
      keys: ['a bonded-warehouse key', 'a lead seal press', 'a tide ticket', 'an inkstamp', 'a docket in copperplate', 'a weight off the scales', 'a coil of red tape', 'the duty book'],
      barriers: ['a strong-room door', 'a counter grille', 'a door with three separate locks', 'a hatch onto the river stair', 'a barred window on a chain']
    },
    {
      id: 'mill',
      suffix: ['brook', 'leat', 'combe', 'weir', 'bourne'],
      title: 'Paper Mill',
      premise: "Rags in at one end, banknotes out at the other, and a wheel in the middle that has not stopped since they built it. It is still turning. Nothing is attached to it.",
      errand: "the proof sheet",
      goalDesc: "One sheet, held up to the light, showing a watermark of such complexity that four countries gave up trying to copy it and simply banned the paper.",
      rooms: ['the rag store', 'the beating room', 'the vat house', 'the couching floor', 'the drying loft', 'the size room', 'the wheel pit', 'the sorting table', 'the mould store', 'the finishing room', 'the head of the leat', "the clerk's desk", 'the boiler house', 'the loading bay'],
      surfaces: ['sodden felt', 'oak worn to a shine', 'lime-washed brick', 'copper gone green', 'flagstone slick with size'],
      sounds: ["water in the leat, going somewhere useful", "the wheel turning with nothing to drive", "felt dripping onto felt", "a loose shutter, at intervals"],
      lights: ["north light through a loft of slats", "a lantern hung on a nail, recently", "the white glare coming off wet paper"],
      quirks: ["A sheet is half-formed on the mould, and the water in it has not drained yet.", "The rags are sorted into piles by colour, and one pile is all one shirt.", "Someone has written a word in the size on the floor and then walked through it."],
      keys: ['a deckle', 'a watermark mould', 'a bone folder', 'a hank of felt', 'a sluice key', 'a brass gauge', 'a stamped rag ticket', 'a jar of size'],
      barriers: ['a sluice gate', 'a loft door on a hoist chain', 'a barred store', 'a door swollen past closing', 'a hatch over the wheel pit']
    }
  ];

  var QUIRKS = [
    "Someone has chalked a number on the wall and then crossed it out.",
    "There is a chair, and it has been pushed in neatly, which is the unsettling part.",
    "A single set of prints comes in and does not go out again.",
    "The dust is disturbed in one long line, as though something was dragged through.",
    "A calendar here has been left open on a month that has not come round yet.",
    "Whoever left did the washing up first.",
    "There is a smell of cold iron that you cannot place and would rather not.",
    "Two nails in the wall, and a pale rectangle between them.",
    "A tally has been kept in the corner: sixteen strokes, then nothing.",
    "The door on the far side has been oiled, and recently. By whom is not clear.",
    "Something small moves when you look away and has stopped by the time you look back.",
    "A coat hangs here and is still damp.",
    "Papers have been burnt in a bucket, and not thoroughly.",
    "There is a second set of footprints and they are exactly your size."
  ];

  var CURIOS = [
    ["a child’s drawing", "Three figures and a building with too many windows. It is signed, and the signature is a single letter."],
    ["a pocket watch", "Stopped. You wind it two turns and it starts again immediately, which somehow settles nothing."],
    ["a photograph", "A group, squinting, arranged by height. One of them has been very carefully scratched out with a pin."],
    ["a tin of tobacco", "Empty of tobacco. Full of teeth, all of them a dog’s, which is the best case."],
    ["a bundle of letters", "Tied with string, addressed here, all of them unopened, all in the same hand."],
    ["a brass whistle", "It works. You test it once and decide not to test it again."],
    ["a folded map", "Of somewhere else entirely, with a route on it in red, ending in a circle around nothing."],
    ["a lump of amber", "With something in it that has more legs than the fossil record allows for."],
    ["a key that fits nothing", "You will try it in everything you meet from here on. It will not work in any of them."],
    ["a jar of buttons", "Four hundred buttons, no two alike, and one of them is off the coat you are wearing."]
  ];

  var ONSET = ['b', 'br', 'c', 'ch', 'd', 'dr', 'f', 'g', 'gr', 'h', 'k', 'l', 'm', 'n', 'p', 'pr', 'r', 's', 'sh', 'st', 't', 'th', 'tr', 'v', 'w'];
  var VOW = ['a', 'e', 'i', 'o', 'u', 'ae', 'ea', 'ei', 'ou', 'y'];
  var CODA = ['l', 'll', 'm', 'n', 'nd', 'ng', 'r', 'rk', 'rn', 'sk', 'st', 'th', 'ck', 'ft', 'lm'];

  function coin(r) {
    var s = r.pick(ONSET) + r.pick(VOW) + r.pick(CODA);
    if (r.chance(0.45)) s += r.pick(VOW) + r.pick(CODA);
    s += r.pick(r.setting.suffix);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  var DIRS = [
    { k: 'n', full: 'north', dx: 0, dy: -1, op: 's' },
    { k: 's', full: 'south', dx: 0, dy: 1, op: 'n' },
    { k: 'e', full: 'east', dx: 1, dy: 0, op: 'w' },
    { k: 'w', full: 'west', dx: -1, dy: 0, op: 'e' }
  ];
  function dirByKey(k) {
    for (var i = 0; i < DIRS.length; i++) if (DIRS[i].k === k) return DIRS[i];
    return null;
  }

  /* ---------- world generation ---------- */
  function build(seed) {
    var rand = rng(seed >>> 0);
    var r = R(rand);
    var setting = r.pick(SETTINGS);
    r.setting = setting;

    var N = r.range(8, 11);
    var names = r.shuffle(setting.rooms).slice(0, N);
    var rooms = [], cells = {};

    function put(id, x, y) {
      rooms[id] = {
        id: id, name: names[id], x: x, y: y,
        exits: {}, items: [], visited: false,
        surface: r.pick(setting.surfaces),
        sound: r.pick(setting.sounds),
        light: r.pick(setting.lights),
        quirk: r.chance(0.55) ? (r.chance(0.4) ? r.pick(setting.quirks) : r.pick(QUIRKS)) : null
      };
      cells[x + ',' + y] = id;
    }
    put(0, 0, 0);

    var edges = [];
    function link(a, b, d) {
      var e = { a: a, b: b, dir: d.k, locked: false, opened: false, barrier: null, key: null };
      var idx = edges.length;
      edges.push(e);
      rooms[a].exits[d.k] = idx;
      rooms[b].exits[d.op] = idx;
      return idx;
    }

    var guard = 0;
    while (rooms.length < N && guard++ < 4000) {
      var from = rooms[Math.floor(rand() * rooms.length)];
      var opts = r.shuffle(DIRS);
      for (var i = 0; i < opts.length; i++) {
        var d = opts[i], nx = from.x + d.dx, ny = from.y + d.dy;
        if (cells[nx + ',' + ny] === undefined) {
          var id = rooms.length;
          put(id, nx, ny);
          link(from.id, id, d);
          break;
        }
      }
    }
    N = rooms.length;

    // a loop or two, where the grid allows it
    var extra = r.range(1, 2);
    var tries = 0;
    while (extra > 0 && tries++ < 200) {
      var a = rooms[Math.floor(rand() * N)], d2 = r.pick(DIRS);
      var nb = cells[(a.x + d2.dx) + ',' + (a.y + d2.dy)];
      if (nb !== undefined && a.exits[d2.k] === undefined) {
        link(a.id, nb, d2);
        extra--;
      }
    }

    function neighbours(id, skip) {
      var out = [];
      for (var k in rooms[id].exits) {
        var ei = rooms[id].exits[k];
        if (skip && skip.indexOf(ei) >= 0) continue;
        var e = edges[ei];
        out.push(e.a === id ? e.b : e.a);
      }
      return out;
    }
    function reach(skip, from) {
      var seen = {}, q = [from === undefined ? 0 : from], out = [];
      seen[q[0]] = 1;
      while (q.length) {
        var c = q.shift(); out.push(c);
        var nb = neighbours(c, skip);
        for (var i = 0; i < nb.length; i++) if (!seen[nb[i]]) { seen[nb[i]] = 1; q.push(nb[i]); }
      }
      return out;
    }

    // bridges, by brute force: pull each edge and see whether the place falls in two
    var bridges = [];
    for (var ei = 0; ei < edges.length; ei++) {
      var near = reach([ei], 0);
      if (near.length < N) {
        var far = [];
        for (var q2 = 0; q2 < N; q2++) if (near.indexOf(q2) < 0) far.push(q2);
        bridges.push({ e: ei, near: near, far: far });
      }
    }

    // locks, placed progressively so a key is never behind its own door
    var barriers = r.shuffle(setting.barriers);
    var keyNames = r.shuffle(setting.keys);
    var locked = [], plan = [];
    var wanted = r.range(2, 3);
    while (plan.length < wanted) {
      var avail = reach(locked, 0);
      if (avail.length < 3) break;
      var cands = bridges.filter(function (b) {
        if (locked.indexOf(b.e) >= 0) return false;
        var e = edges[b.e];
        var ia = avail.indexOf(e.a) >= 0, ib = avail.indexOf(e.b) >= 0;
        if (ia === ib) return false;
        var far = ia ? b.far : b.near;
        if (far.indexOf(0) >= 0) far = ia ? b.near : b.far;
        return far.length >= 2 && far.length <= N - 3;
      });
      if (!cands.length) break;
      var chosen = cands[Math.floor(rand() * cands.length)];
      plan.push({ e: chosen.e, avail: avail });
      locked.push(chosen.e);
    }

    var items = [];
    function addItem(o) { o.id = items.length; items.push(o); return o; }
    var used = {};

    plan.forEach(function (p, i) {
      var e = edges[p.e];
      e.locked = true;
      e.barrier = barriers[i % barriers.length];
      var pool = p.avail.filter(function (id) { return id !== 0 && !used[id]; });
      if (!pool.length) pool = p.avail.filter(function (id) { return !used[id]; });
      if (!pool.length) pool = p.avail;
      var where = pool[Math.floor(rand() * pool.length)];
      used[where] = 1;
      var it = addItem({
        name: keyNames[i % keyNames.length],
        kind: 'key',
        opens: p.e,
        room: where,
        desc: null
      });
      it.desc = "It is " + it.name + ". It has the look of something that belongs to " + e.barrier + ".";
      e.key = it.id;
      rooms[where].items.push(it.id);
    });

    // the errand goes as deep as the locks allow
    var open = reach(locked, 0);
    var deepPool = [];
    for (var z = 1; z < N; z++) if (open.indexOf(z) < 0) deepPool.push(z);
    if (!deepPool.length) {
      var far2 = reach([], 0);
      deepPool = [far2[far2.length - 1]];
      if (deepPool[0] === 0) deepPool = [1];
    }
    var goalRoom = deepPool[Math.floor(rand() * deepPool.length)];
    var goal = addItem({
      name: setting.errand, kind: 'goal', room: goalRoom, desc: setting.goalDesc
    });
    rooms[goalRoom].items.push(goal.id);

    var curios = r.shuffle(CURIOS).slice(0, r.range(2, 4));
    curios.forEach(function (c) {
      var where = 1 + Math.floor(rand() * (N - 1));
      var it = addItem({ name: c[0], kind: 'curio', room: where, desc: c[1] });
      rooms[where].items.push(it.id);
    });

    return {
      seed: seed >>> 0,
      setting: setting,
      place: coin(r) + ' ' + setting.title,
      rooms: rooms, edges: edges, items: items,
      goal: goal.id, start: 0,
      here: 0, moves: 0, carried: [], won: false,
      locks: plan.length
    };
  }

  /* ---------- state and shell ---------- */
  var W = null, history = [], hIdx = 0;
  function $(id) { return document.getElementById(id); }

  function say(text, cls) {
    var log = $('wrLog');
    var p = document.createElement('p');
    p.className = 'wr-line' + (cls ? ' ' + cls : '');
    p.innerHTML = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function list(arr) {
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }
  function item(id) { return W.items[id]; }
  function room() { return W.rooms[W.here]; }

  function exitsOf(id) {
    var out = [];
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i], ei = W.rooms[id].exits[d.k];
      if (ei === undefined) continue;
      var e = W.edges[ei];
      out.push({ d: d, edge: e, to: e.a === id ? e.b : e.a });
    }
    return out;
  }

  function describe(brief) {
    var rm = room();
    say(cap(rm.name), 'wr-title');
    if (!brief) {
      var bits = [];
      bits.push(cap(rm.light) + ", and " + rm.surface + " everywhere you put a foot.");
      bits.push("You can hear " + rm.sound + ".");
      if (rm.quirk) bits.push(rm.quirk);
      say(bits.join(' '));
    }
    if (rm.items.length) {
      say("Here: " + list(rm.items.map(function (i) { return '<b>' + item(i).name + '</b>'; })) + ".");
    }
    var ex = exitsOf(rm.id).map(function (x) {
      if (x.edge.locked && !x.edge.opened) return x.d.full + ' (' + x.edge.barrier + ', shut)';
      return x.d.full;
    });
    say("Ways on: " + (ex.length ? list(ex) : 'none, which cannot be right') + ".", 'wr-note');
    rm.visited = true;
    refresh();
  }

  function findIn(pool, text) {
    var t = text.toLowerCase().replace(/^(the|a|an|some)\s+/, '').trim();
    if (!t) return null;
    var best = null, score = 0;
    pool.forEach(function (id) {
      var name = item(id).name.toLowerCase();
      var s = 0;
      if (name.indexOf(t) >= 0) s = 10;
      else {
        var w = t.split(/\s+/);
        for (var i = 0; i < w.length; i++) if (w[i].length > 2 && name.indexOf(w[i]) >= 0) s += 3;
      }
      if (s > score) { score = s; best = id; }
    });
    return score > 0 ? best : null;
  }

  /* ---------- verbs ---------- */
  function go(dk) {
    var ex = W.rooms[W.here].exits[dk];
    if (ex === undefined) { say("There is no way " + dirByKey(dk).full + " from here.", 'wr-note'); return; }
    var e = W.edges[ex];
    if (e.locked && !e.opened) {
      var k = W.carried.indexOf(e.key) >= 0;
      if (!k) {
        say(cap(e.barrier) + " stands in the way, and it is not going to be talked round.", 'wr-note');
        return;
      }
      e.opened = true;
      say("You put " + item(e.key).name + " to " + e.barrier + ", and it gives.", 'wr-note');
    }
    W.here = (e.a === W.here) ? e.b : e.a;
    W.moves++;
    describe(W.rooms[W.here].visited);
    checkWin();
  }

  function take(what) {
    var rm = room();
    if (/^(all|everything)$/.test(what)) {
      if (!rm.items.length) { say("There is nothing here to take."); return; }
      rm.items.slice().forEach(function (i) { takeId(i); });
      return;
    }
    var id = findIn(rm.items, what);
    if (id === null) { say("There is no " + what + " here.", 'wr-note'); return; }
    takeId(id);
  }
  function takeId(id) {
    var rm = room();
    rm.items.splice(rm.items.indexOf(id), 1);
    W.carried.push(id);
    say("Taken: <b>" + item(id).name + "</b>.");
    if (item(id).kind === 'goal') {
      say("That is what you came for. Now get it back to " + W.rooms[W.start].name + ".", 'wr-note');
    }
    refresh();
    checkWin();
  }
  function drop(what) {
    var id = findIn(W.carried, what);
    if (id === null) { say("You are not carrying that.", 'wr-note'); return; }
    W.carried.splice(W.carried.indexOf(id), 1);
    room().items.push(id);
    say("Dropped: " + item(id).name + ".");
    refresh();
  }
  function examine(what) {
    var id = findIn(W.carried, what);
    if (id === null) id = findIn(room().items, what);
    if (id !== null) {
      var it = item(id);
      say(it.desc || ("It is " + it.name + ", and it does not reward a second look."));
      return;
    }
    var ex = exitsOf(W.here);
    for (var i = 0; i < ex.length; i++) {
      var e = ex[i].edge;
      if (e.barrier && (e.barrier.toLowerCase().indexOf(what) >= 0 || ex[i].d.full.indexOf(what) >= 0 || ex[i].d.k === what)) {
        say(cap(e.barrier) + ". " + (e.opened ? "Open now, and standing where you left it." : "Shut, and it means it."));
        return;
      }
    }
    say("You look. There is no " + what + " to look at.", 'wr-note');
  }
  function inventory() {
    if (!W.carried.length) { say("You are carrying nothing but yourself."); return; }
    say("Carrying: " + list(W.carried.map(function (i) { return '<b>' + item(i).name + '</b>'; })) + ".");
  }
  function unlock(what) {
    var ex = exitsOf(W.here).filter(function (x) { return x.edge.locked && !x.edge.opened; });
    if (!ex.length) { say("Nothing here is locked against you.", 'wr-note'); return; }
    var target = ex[0];
    if (what) {
      for (var i = 0; i < ex.length; i++) {
        if (ex[i].d.k === what || ex[i].d.full.indexOf(what) === 0 || ex[i].edge.barrier.toLowerCase().indexOf(what) >= 0) target = ex[i];
      }
    }
    if (W.carried.indexOf(target.edge.key) < 0) {
      say("You have nothing on you that " + target.edge.barrier + " is interested in.", 'wr-note');
      return;
    }
    target.edge.opened = true;
    say("You work " + item(target.edge.key).name + " into " + target.edge.barrier + " until it gives. It stays given.");
    refresh();
  }

  function checkWin() {
    if (W.won) return;
    if (W.here === W.start && W.carried.indexOf(W.goal) >= 0) {
      W.won = true;
      var seen = W.rooms.filter(function (r2) { return r2.visited; }).length;
      var extras = W.carried.filter(function (i) { return item(i).kind === 'curio'; }).length;
      say('&nbsp;');
      say("You come up into " + W.rooms[W.start].name + " with " + item(W.goal).name + " under your coat, and the place lets you go.", 'wr-title');
      say("Out in " + W.moves + " moves. " + seen + " of " + W.rooms.length + " chambers seen, " + W.locks + " " + (W.locks === 1 ? 'door' : 'doors') + " opened" + (extras ? ", and " + extras + " thing" + (extras === 1 ? '' : 's') + " that was not yours" : "") + ".");
      say("Tomorrow the number changes and none of this will be here.", 'wr-note');
      $('wrCmd').disabled = true;
      refresh();
    }
  }

  var HELP = [
    "<b>north / south / east / west</b> — or just n, s, e, w",
    "<b>look</b>, <b>examine</b> something, <b>read</b> something",
    "<b>take</b> something, <b>take all</b>, <b>drop</b> something, <b>inventory</b>",
    "<b>unlock</b> a door you have the key for — or simply walk at it",
    "<b>wait</b>, <b>help</b>. Everything is clickable too, if you would rather not type."
  ];

  function command(raw) {
    var s = raw.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!s) return;
    say('&gt; ' + raw, 'wr-echo');
    if (W.won) { say("You are out. Start again, or take tomorrow's.", 'wr-note'); return; }
    W.moves++;

    var m;
    if (/^(n|north)$/.test(s)) return go('n');
    if (/^(s|south)$/.test(s)) return go('s');
    if (/^(e|east)$/.test(s)) return go('e');
    if (/^(w|west)$/.test(s)) return go('w');
    if ((m = s.match(/^(?:go|walk|head|move)\s+(?:to\s+the\s+)?(\w+)$/))) {
      var d = m[1].charAt(0);
      if ('nsew'.indexOf(d) >= 0 && /^(n|s|e|w|north|south|east|west)$/.test(m[1])) return go(d);
      say("You can go north, south, east or west, and that is the whole of it.", 'wr-note');
      return;
    }
    if (/^(l|look)$/.test(s)) return describe(false);
    if ((m = s.match(/^(?:x|examine|inspect|look at|read|search)\s+(.+)$/))) return examine(m[1]);
    if ((m = s.match(/^(?:take|get|grab|pick up)\s+(.+)$/))) return take(m[1]);
    if ((m = s.match(/^(?:drop|leave|put down)\s+(.+)$/))) return drop(m[1]);
    if (/^(i|inv|inventory)$/.test(s)) return inventory();
    if ((m = s.match(/^(?:unlock|open|force)\s*(.*)$/))) return unlock(m[1]);
    if ((m = s.match(/^use\s+(.+?)\s+on\s+(.+)$/))) return unlock(m[2]);
    if (/^(z|wait)$/.test(s)) { say("You wait. The place waits longer, and is better at it.", 'wr-note'); return; }
    if (/^(help|\?|commands)$/.test(s)) { HELP.forEach(function (h) { say(h, 'wr-note'); }); return; }
    if (/^(xyzzy)$/.test(s)) { say("Nothing happens, but it was worth asking.", 'wr-note'); return; }
    say("That is not a thing you know how to do here. Try <b>help</b>.", 'wr-note');
  }

  /* ---------- the map, which fills itself in ---------- */
  function drawMap() {
    var el = $('wrMap');
    if (!el) return;
    var xs = W.rooms.map(function (r2) { return r2.x; });
    var ys = W.rooms.map(function (r2) { return r2.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var C = 40, G = 22, pad = 12;
    var w = (x1 - x0 + 1) * (C + G) - G + pad * 2;
    var h = (y1 - y0 + 1) * (C + G) - G + pad * 2;
    function px(x) { return pad + (x - x0) * (C + G); }
    function py(y) { return pad + (y - y0) * (C + G); }
    var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="Map of the parts you have seen">';

    W.edges.forEach(function (e) {
      var A = W.rooms[e.a], B = W.rooms[e.b];
      if (!A.visited && !B.visited) return;
      var ax = px(A.x) + C / 2, ay = py(A.y) + C / 2;
      var bx = px(B.x) + C / 2, by = py(B.y) + C / 2;
      var shut = e.locked && !e.opened;
      s += '<line x1="' + ax + '" y1="' + ay + '" x2="' + bx + '" y2="' + by +
        '" stroke="' + (shut ? '#ff8a5b' : 'rgba(255,255,255,.22)') + '" stroke-width="2"' +
        (shut ? ' stroke-dasharray="4 3"' : '') + '/>';
      if (shut) {
        var mx = (ax + bx) / 2, my = (ay + by) / 2;
        var vertical = A.x === B.x;
        s += '<rect x="' + (mx - (vertical ? 8 : 2)) + '" y="' + (my - (vertical ? 2 : 8)) +
          '" width="' + (vertical ? 16 : 4) + '" height="' + (vertical ? 4 : 16) + '" fill="#ff8a5b"/>';
      }
    });

    W.rooms.forEach(function (r2) {
      var x = px(r2.x), y = py(r2.y);
      var cur = r2.id === W.here;
      if (!r2.visited) {
        var adj = exitsOf(r2.id).some(function (q) {
          return W.rooms[q.to].visited;
        });
        if (!adj) return;
        s += '<rect x="' + x + '" y="' + y + '" width="' + C + '" height="' + C + '" rx="7" fill="none" stroke="rgba(255,255,255,.16)" stroke-dasharray="3 3"/>';
        s += '<text x="' + (x + C / 2) + '" y="' + (y + C / 2 + 5) + '" text-anchor="middle" font-size="15" fill="rgba(255,255,255,.28)">?</text>';
        return;
      }
      s += '<rect x="' + x + '" y="' + y + '" width="' + C + '" height="' + C + '" rx="7" fill="' +
        (cur ? 'rgba(100,240,200,.18)' : 'rgba(255,255,255,.05)') + '" stroke="' +
        (cur ? '#64f0c8' : 'rgba(255,255,255,.24)') + '" stroke-width="' + (cur ? 2 : 1) + '"><title>' +
        r2.name + '</title></rect>';
      var loot = r2.items.length ? '●' : '';
      s += '<text x="' + (x + C / 2) + '" y="' + (y + C / 2 + 5) + '" text-anchor="middle" font-size="14" fill="' +
        (cur ? '#64f0c8' : 'rgba(255,255,255,.55)') + '">' + (cur ? '☉' : (loot || r2.name.replace(/^the\s+/, '').charAt(0).toUpperCase())) + '</text>';
    });
    s += '</svg>';
    el.innerHTML = s;
  }

  function chips(el, arr, fn) {
    el.innerHTML = '';
    if (!arr.length) {
      var em = document.createElement('span');
      em.className = 'wr-empty';
      em.textContent = '—';
      el.appendChild(em);
      return;
    }
    arr.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'chip' + (o.on ? ' on' : '');
      b.type = 'button';
      b.textContent = o.label;
      b.addEventListener('click', function () { fn(o); });
      el.appendChild(b);
    });
  }

  function refresh() {
    $('wrPlace').textContent = W.place;
    $('wrWhere').textContent = cap(room().name);
    $('wrMoves').textContent = W.moves;
    $('wrSeed').textContent = String(W.seed).padStart(10, '0');

    chips($('wrExits'), exitsOf(W.here).map(function (x) {
      var shut = x.edge.locked && !x.edge.opened;
      return { label: x.d.full + (shut ? ' ⊘' : ''), dir: x.d.k };
    }), function (o) { run(o.dir); });

    chips($('wrHere'), room().items.map(function (i) {
      return { label: item(i).name };
    }), function (o) { run('take ' + o.label); });

    chips($('wrBag'), W.carried.map(function (i) {
      return { label: item(i).name, on: i === W.goal };
    }), function (o) { run('examine ' + o.label); });

    drawMap();
  }

  function run(text) {
    command(text);
    var c = $('wrCmd');
    if (c && !c.disabled) c.focus();
  }

  /* ---------- start ---------- */
  function open(seed) {
    W = build(seed);
    history = []; hIdx = 0;
    $('wrLog').innerHTML = '';
    $('wrCmd').disabled = false;
    $('wrCmd').value = '';
    say(W.place, 'wr-title');
    say(W.setting.premise);
    say("You are after <b>" + W.setting.errand + "</b>. It is in here somewhere, behind " +
      (W.locks === 1 ? 'a door' : W.locks + ' doors') + " that are shut, and you are going to have to " +
      "carry it back out to " + W.rooms[W.start].name + " yourself.", 'wr-note');
    say('&nbsp;');
    describe(false);
    say("Type <b>help</b> if you want the verbs, or just click things.", 'wr-note');
  }

  function boot() {
    var form = $('wrForm');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var c = $('wrCmd');
      var v = c.value;
      c.value = '';
      if (!v.trim()) return;
      history.push(v); hIdx = history.length;
      command(v);
    });
    $('wrCmd').addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowUp' && hIdx > 0) { hIdx--; this.value = history[hIdx]; ev.preventDefault(); }
      else if (ev.key === 'ArrowDown') {
        hIdx = Math.min(history.length, hIdx + 1);
        this.value = hIdx === history.length ? '' : history[hIdx];
        ev.preventDefault();
      }
    });
    $('btnToday').addEventListener('click', function () { open(seedForToday()); $('wrCmd').focus(); });
    $('btnOther').addEventListener('click', function () { open((Math.random() * 4294967295) >>> 0); $('wrCmd').focus(); });
    $('btnRestart').addEventListener('click', function () { open(W.seed); $('wrCmd').focus(); });
    open(seedForToday());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
