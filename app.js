/* experiment.quibo.games — seeded flow field
   Self-contained. No dependencies. */
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
    // hash it so consecutive days look unrelated
    var h = s ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  /* ---------- value noise on a seeded lattice ---------- */
  function makeNoise(rand) {
    var N = 256;
    var grid = new Float32Array(N * N);
    for (var i = 0; i < grid.length; i++) grid[i] = rand();
    function at(x, y) {
      return grid[((y & (N - 1)) * N) + (x & (N - 1))];
    }
    function smooth(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = smooth(x - xi), yf = smooth(y - yi);
      var a = at(xi, yi), b = at(xi + 1, yi);
      var c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      var top = a + (b - a) * xf;
      var bot = c + (d - c) * xf;
      return top + (bot - top) * yf;
    };
  }

  /* ---------- palettes ---------- */
  var PALETTES = [
    { name: 'Aurora',    cols: ['#64f0c8', '#7aa2ff', '#b78cff', '#4ad9e6'] },
    { name: 'Ember',     cols: ['#ff8a5b', '#ffd166', '#ff5d8f', '#ffb45b'] },
    { name: 'Deepwater', cols: ['#3fa7d6', '#59d2fe', '#7fdeff', '#2b6fa8'] },
    { name: 'Moss',      cols: ['#8fd694', '#c7f9cc', '#57cc99', '#38a3a5'] },
    { name: 'Ultraviolet', cols: ['#b388ff', '#7c4dff', '#e0aaff', '#5390d9'] },
    { name: 'Rust',      cols: ['#d98e73', '#e6b8a2', '#c56b4a', '#f2d5c4'] },
    { name: 'Signal',    cols: ['#f7f7ff', '#9bf6ff', '#caffbf', '#ffd6a5'] }
  ];

  /* ---------- state ---------- */
  var canvas = document.getElementById('field');
  var ctx = canvas.getContext('2d', { alpha: false });
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, DPR = 1;
  var particles = [];
  var noise, palette, curl, drift, seed, paused = false, raf = null;
  var mouse = { x: -9999, y: -9999, active: false };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, W, H);
  }

  function particleCount() {
    var area = W * H;
    var n = Math.round(area / 5200);
    return Math.max(120, Math.min(n, 900));
  }

  function build(newSeed) {
    seed = newSeed >>> 0;
    var rand = rng(seed);
    noise = makeNoise(rand);
    palette = PALETTES[Math.floor(rand() * PALETTES.length)];
    curl = 1.2 + rand() * 4.4;          // how twisty the field is
    drift = 0.15 + rand() * 0.85;       // global evolution speed

    particles = [];
    var n = particleCount();
    for (var i = 0; i < n; i++) {
      particles.push(spawn(rand));
    }
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, W, H);
    updateReadout();
  }

  function spawn(rand) {
    var r = rand || Math.random;
    return {
      x: r() * W,
      y: r() * H,
      life: 40 + r() * 220,
      col: palette.cols[Math.floor(r() * palette.cols.length)],
      w: 0.4 + r() * 1.1
    };
  }

  var t = 0;
  function step() {
    // gentle fade instead of clearing -> long silky trails
    ctx.fillStyle = 'rgba(7,9,13,0.055)';
    ctx.fillRect(0, 0, W, H);

    t += 0.0016 * drift;
    var scale = 0.0032;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = noise(p.x * scale * 64, p.y * scale * 64 + t * 60) * Math.PI * 2 * curl;
      var vx = Math.cos(a) * 1.15;
      var vy = Math.sin(a) * 1.15;

      if (mouse.active) {
        var dx = p.x - mouse.x, dy = p.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 26000 && d2 > 0.01) {
          var f = (1 - d2 / 26000) * 2.6 / Math.sqrt(d2);
          vx += dx * f * 12;
          vy += dy * f * 12;
        }
      }

      var nx = p.x + vx, ny = p.y + vy;

      ctx.strokeStyle = p.col;
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = p.w;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      p.x = nx; p.y = ny; p.life--;

      if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
        particles[i] = spawn();
      }
    }
    ctx.globalAlpha = 1;

    if (!paused) raf = requestAnimationFrame(step);
  }

  /* ---------- readout ---------- */
  function $(id) { return document.getElementById(id); }

  function updateReadout() {
    var el = $('seedNum');
    if (!el) return;
    el.textContent = String(seed).padStart(10, '0');
    $('seedDate').textContent = new Date().toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    $('seedCurl').textContent = curl.toFixed(2);
    $('seedDrift').textContent = drift.toFixed(2) + '×';
    $('seedPalette').textContent = palette.name;

    var sw = $('swatches');
    sw.innerHTML = '';
    palette.cols.forEach(function (c) {
      var i = document.createElement('i');
      i.style.background = c;
      i.title = c;
      sw.appendChild(i);
    });
  }

  /* ---------- events ---------- */
  window.addEventListener('resize', function () {
    resize();
    build(seed);
  });

  window.addEventListener('pointermove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }, { passive: true });

  window.addEventListener('pointerleave', function () { mouse.active = false; });

  function wire(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', fn);
  }

  wire('btnScramble', function () {
    build((Math.random() * 4294967295) >>> 0);
  });
  wire('btnToday', function () { build(seedForToday()); });
  wire('btnPause', function () {
    paused = !paused;
    this.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) raf = requestAnimationFrame(step);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
    } else if (!paused) {
      raf = requestAnimationFrame(step);
    }
  });

  /* ---------- go ---------- */
  resize();
  build(seedForToday());
  if (reduce) {
    // draw a few static frames instead of animating
    paused = true;
    for (var k = 0; k < 90; k++) step();
    var pb = document.getElementById('btnPause');
    if (pb) pb.textContent = 'Resume';
  } else {
    raf = requestAnimationFrame(step);
  }
})();

/* ---------- Change 59: the Ropewalk ----------
   index.html has grown past what can be rewritten in one go, so the newest room is announced from here:
   a nav link, the first call to action, the first Rooms card, the seed afterword and the log entry.
   A later change can fold these back into the static HTML and delete this block. */
(function () {
  'use strict';
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  if (document.querySelector('a.room[href="ropewalk.html"]')) return;

  var nav = document.querySelector('.nav-links');
  if (nav) nav.appendChild(el('<a href="ropewalk.html">Ropewalk</a>'));

  var cta = document.querySelector('.cta-row');
  if (cta) {
    var first = cta.querySelector('.btn:not(.ghost)');
    if (first) first.classList.add('ghost');
    cta.insertBefore(el('<a class="btn" href="ropewalk.html">Spin today\'s yarn</a>'), cta.firstChild);
  }

  var rooms = document.querySelector('#rooms .rooms');
  if (rooms) rooms.insertBefore(el(
    '<a class="room" href="ropewalk.html">' +
      '<span class="room-tag">ropemaking</span>' +
      '<h3>The Ropewalk</h3>' +
      '<p>From an oven that only cools to a walk a fifth of a mile long, taken backwards. A boy turns the wheel, you let ' +
      'the hemp out through your fingers, and your pace decides the twist while your hand decides the thickness. ' +
      'The day\'s number picks the walk, the hemp, the boy and the rope on the slate. Spin three even yarns, lay ' +
      'them up, and see whether the rope holds on the machine.</p>' +
      '<span class="room-go">Hook on →</span>' +
    '</a>'), rooms.firstChild);

  var after = document.querySelector('#seed .afterword');
  if (after) {
    after.innerHTML = after.innerHTML
      .replace('fifty-eight jobs', 'fifty-nine jobs')
      .replace(/One integer, fifty-eight rooms\./, 'and in <a href="ropewalk.html">the Ropewalk</a> it lays out a walk, hackles the hemp well or badly, ' +
        'puts a boy on the wheel and decides when he will look out of the door. One integer, fifty-nine rooms.')
      .replace('with a pie to bake.\n', 'with a pie to bake,\n');
  }

  var log = document.querySelector('#log .log');
  if (log) log.insertBefore(el(
    '<li>' +
      '<time>Change 59</time>' +
      '<h3>Walking backwards</h3>' +
      '<p>The Bakehouse fitted a morning\'s work into one fall of heat. Added <a href="ropewalk.html">The Ropewalk</a>, ' +
      'where the work is one long walk taken backwards. It is a ropewalk on today\'s calendar date some time between ' +
      '1780 and 1859, in one of twelve towns from Bridport to Port Glasgow, each with its own length of walk. The ' +
      'day\'s number picks the hemp (long clean Riga, short Königsberg tow, silky Italian or, after 1830, smooth ' +
      'Manila that wants more twist to hold), the boy on the wheel (steady, flagging, or given to looking out of ' +
      'the door), and the order on the slate: a lead line, a bolt rope, a hawser, a tiller rope, a bell rope or a ' +
      'well rope, each wanting its own hardness of yarn.</p>' +
      '<p>You control two things with one body: how fast you walk back from the wheel, and how fast you let the hemp ' +
      'go through your fingers. The twist in each foot of yarn is the wheel\'s turns divided by your pace, and its ' +
      'thickness is the hemp let go divided by your pace, so when the boy slows you must walk slower and then feed ' +
      'less. Walk off too fast and the yarn parts and has to be pieced; stand still and the wheel puts a hard kink ' +
      'in it. There is a sample on the post to match by eye. After three yarns the rope is laid up, losing a quarter ' +
      'to a third of its length, and put on the proving machine, which breaks it at its weakest few feet. The page ' +
      'then draws every foot of each yarn\'s twist and thickness against the sample, and the rope\'s strength against ' +
      'what the machine asked.</p>' +
    '</li>'), log.firstChild);
})();

/* ---------- Change 60: the Hayfield ----------
   Announced the same way as the Ropewalk above, and runs after it, so it lands in front of it. */
(function () {
  'use strict';
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  if (document.querySelector('a.room[href="hayfield.html"]')) return;

  var nav = document.querySelector('.nav-links');
  if (nav) nav.appendChild(el('<a href="hayfield.html">Hayfield</a>'));

  var cta = document.querySelector('.cta-row');
  if (cta) {
    var first = cta.querySelector('.btn:not(.ghost)');
    if (first) first.classList.add('ghost');
    cta.insertBefore(el('<a class="btn" href="hayfield.html">Make this week\'s hay</a>'), cta.firstChild);
  }

  var rooms = document.querySelector('#rooms .rooms');
  if (rooms) rooms.insertBefore(el(
    '<a class="room" href="hayfield.html">' +
      '<span class="room-tag">haymaking</span>' +
      '<h3>The Hayfield</h3>' +
      '<p>From a walk under a roof to a meadow under the open sky. One week of haysel between 1820 and 1899, four lands ' +
      'of grass, a gang of scythes and a weatherglass on the kitchen wall. Mow, ted, turn, rake and cock it, and lead ' +
      'it to the rick by Saturday night: too damp and the rick heats until it fires, too long in the rain and it is ' +
      'washed of its worth. The day\'s number picks the farm, the meadow and the whole week\'s weather.</p>' +
      '<span class="room-go">Sharpen the scythes →</span>' +
    '</a>'), rooms.firstChild);

  var after = document.querySelector('#seed .afterword');
  if (after) {
    after.innerHTML = after.innerHTML
      .replace('fifty-nine jobs', 'sixty jobs')
      .replace(/out of the door\. One integer, fifty-nine rooms\./, 'out of the door, and in <a href="hayfield.html">the Hayfield</a> it ' +
        'brings a week of depressions in off the sea, drags the glass down ahead of each one and decides which afternoons ' +
        'will thunder. One integer, sixty rooms.');
  }

  var log = document.querySelector('#log .log');
  if (log) log.insertBefore(el(
    '<li>' +
      '<time>Change 60</time>' +
      '<h3>Make hay</h3>' +
      '<p>The Ropewalk kept the weather out under a long roof. Added <a href="hayfield.html">The Hayfield</a>, where ' +
      'the weather is the whole job. It is one week of haysel, Monday dawn to Saturday night, in a June or July some ' +
      'time between 1820 and 1899, on one of twelve farms from Keswick to Stowmarket, each with its own share of rain ' +
      'off the sea. The day\'s number picks the meadow and its acres, how many scythes there are, the price of hay that ' +
      'year, and the week\'s weather an hour at a time: one to four depressions, each pulling the glass down ahead of ' +
      'its rain, and on the warm days a chance of thunder showers that the glass will not warn you of.</p>' +
      '<p>The meadow is in four lands and there is one gang. Each land goes from standing grass to the swath, tedded ' +
      'out, turned, raked into windrows, put up in cocks against the dew or a shower, shaken out again, and led to the ' +
      'rick. Spread hay dries fastest and takes the rain worst; cocks barely dry but shed the wet. The water in the hay ' +
      'is modelled hour by hour from the sun, the wind and the air, and the gang stops for the night at eight. Lead it ' +
      'over a quarter water and the rick heats; lead it brittle and the leaf stays in the field. At the end the page ' +
      'draws every land\'s moisture across the week against the rain and the glass, and the rick\'s heat for the six ' +
      'weeks after.</p>' +
    '</li>'), log.firstChild);
})();

/* ---------- Change 61: the Dairy ----------
   Announced the same way as the two rooms above, and runs after them, so it lands in front of them. */
(function () {
  'use strict';
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  if (document.querySelector('a.room[href="dairy.html"]')) return;

  var nav = document.querySelector('.nav-links');
  if (nav) nav.appendChild(el('<a href="dairy.html">Dairy</a>'));

  var cta = document.querySelector('.cta-row');
  if (cta) {
    var first = cta.querySelector('.btn:not(.ghost)');
    if (first) first.classList.add('ghost');
    cta.insertBefore(el('<a class="btn" href="dairy.html">Churn today\'s butter</a>'), cta.firstChild);
  }

  var rooms = document.querySelector('#rooms .rooms');
  if (rooms) rooms.insertBefore(el(
    '<a class="room" href="dairy.html">' +
      '<span class="room-tag">buttermaking</span>' +
      '<h3>The Dairy</h3>' +
      '<p>From the open sky back into a cold stone room. Bring a crock of cream to the warmth you think right, turn the ' +
      'barrel churn, pull the vent plug before it blows, and listen for the slosh to go dull and then break into a ' +
      'splash. Stop at grains the size of wheat, then wash, salt and work it, and a judge scores it out of a hundred. ' +
      'The day\'s number picks the farm, the herd, the season and how ripe the cream has got.</p>' +
      '<span class="room-go">Scald the churn →</span>' +
    '</a>'), rooms.firstChild);

  var after = document.querySelector('#seed .afterword');
  if (after) {
    after.innerHTML = after.innerHTML
      .replace('sixty jobs', 'sixty-one jobs')
      .replace(/will thunder\. One integer, sixty rooms\./, 'will thunder, and in <a href="dairy.html">the Dairy</a> it ' +
        'picks a herd and a season, ripens the cream a little too far or not far enough, and hides the right churning ' +
        'warmth inside a range in a dairy book. One integer, sixty-one rooms.');
  }

  var log = document.querySelector('#log .log');
  if (log) log.insertBefore(el(
    '<li>' +
      '<time>Change 61</time>' +
      '<h3>The butter breaks</h3>' +
      '<p>The Hayfield was all weather and open sky. Added <a href="dairy.html">The Dairy</a>, a cold stone room on the ' +
      'shady side of a farmhouse, on a churning morning on today\'s calendar date some time between 1820 and 1899, in one ' +
      'of twelve dairying places from Epping to Mallow. The day\'s number picks the herd (Alderney and Guernsey cream ' +
      'comes easily and yellow, Ayrshire cream is slow), how many gallons have been saved, how ripe the cream has got, ' +
      'what butter is fetching and the order: fresh rolls, light salt prints, half-salt for the house in town, or a ' +
      'firkin to keep. The season sets the right churning warmth, because winter butterfat is harder.</p>' +
      '<p>There is a thermometer, but the book on the shelf only gives a range. The churning runs faster the warmer the ' +
      'cream, the riper it is and the harder you turn, up to the point where the cream rides round with the barrel ' +
      'instead of falling. Too cold and it will not come in three hours; too warm and it comes fast, soft and greasy and ' +
      'loses its fat in the buttermilk. Gas builds behind the vent plug in the first quarter of an hour, and the churn ' +
      'sounds different as the cream thins, thickens and breaks, with an optional knock you can hear. After that the ' +
      'grains are washed, salted and worked, and the butter is scored out of a hundred the way shows did it: flavour, ' +
      'body, colour, salting and make-up. The page then draws the whole churning, temperature and progress, against the ' +
      'band this cream wanted.</p>' +
    '</li>'), log.firstChild);
})();

/* ---------- Change 62: the Saltpan ----------
   Announced the same way as the rooms above, and runs after them, so it lands in front of them. */
(function () {
  'use strict';
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  if (document.querySelector('a.room[href="saltpan.html"]')) return;

  var nav = document.querySelector('.nav-links');
  if (nav) nav.appendChild(el('<a href="saltpan.html">Saltpan</a>'));

  var cta = document.querySelector('.cta-row');
  if (cta) {
    var first = cta.querySelector('.btn:not(.ghost)');
    if (first) first.classList.add('ghost');
    cta.insertBefore(el('<a class="btn" href="saltpan.html">Fire today\'s salt pan</a>'), cta.firstChild);
  }

  var rooms = document.querySelector('#rooms .rooms');
  if (rooms) rooms.insertBefore(el(
    '<a class="room" href="saltpan.html">' +
      '<span class="room-tag">saltmaking</span>' +
      '<h3>The Saltpan</h3>' +
      '<p>From a cool dairy to a shed full of steam. An open iron pan of brine over a coal furnace, where the heat ' +
      'decides the grain: boil it hard for fine table salt, keep it barely warm for days for coarse fishery salt. Draw ' +
      'the salt onto the hurdles, scratch off the scale before the plate burns, watch the wind pull at the fire, and ' +
      'fill the order before the boat leaves. The day\'s number picks the works, the brine, the order and the wind.</p>' +
      '<span class="room-go">Light the fires →</span>' +
    '</a>'), rooms.firstChild);

  var after = document.querySelector('#seed .afterword');
  if (after) {
    after.innerHTML = after.innerHTML
      .replace('sixty-one jobs', 'sixty-two jobs')
      .replace(/One integer, sixty-one rooms\./, 'In <a href="saltpan.html">the Saltpan</a> it writes an order on the ' +
        'slate and sends the wind across the chimney top hour by hour, so the fire you set is never quite the fire you get. ' +
        'One integer, sixty-two rooms.');
  }

  var log = document.querySelector('#log .log');
  if (log) log.insertBefore(el(
    '<li>' +
      '<time>Change 62</time>' +
      '<h3>Heat makes the grain</h3>' +
      '<p>The Dairy kept its cream cool and judged it by the degree. Added <a href="saltpan.html">The Saltpan</a>, where the ' +
      'same rule runs backwards: an open-pan salt works some time between 1800 and 1899, in one of twelve places from ' +
      'Winsford and Droitwich to Lymington and Maldon. The day\'s number picks the works and how strong and limy its brine ' +
      'runs, the order on the slate (lump salt for the table, butter salt, common salt, or big hopper crystals of fishery ' +
      'salt for the herring curers), the pan that suits it, the hours until the boat leaves, the price, the coal and the ' +
      'wind across the chimney hour by hour.</p>' +
      '<p>One slider sets the firing. The pan heads for a temperature set by the fire, the draught and how much scale and ' +
      'salt lie on the plate. Hot brine throws fine grain fast; cool brine throws coarse grain slowly, and crystals left ' +
      'lying in a cool pan keep growing, all shown under a magnifying glass. Draw the salt onto the hurdles (late draws go ' +
      'aboard dripping), let the fire down to scratch the lime off before the plate burns, and when the boat comes the ' +
      'merchant sorts every draw by grain against the order. The page then draws the pan hour by hour and the spread of ' +
      'grain on the hurdles, with the account.</p>' +
    '</li>'), log.firstChild);
})();

/* ---------- Change 63: the Chandlery ----------
   Announced the same way as the rooms above, and runs after them, so it lands in front of them. */
(function () {
  'use strict';
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  if (document.querySelector('a.room[href="chandlery.html"]')) return;

  var nav = document.querySelector('.nav-links');
  if (nav) nav.appendChild(el('<a href="chandlery.html">Chandlery</a>'));

  var cta = document.querySelector('.cta-row');
  if (cta) {
    var first = cta.querySelector('.btn:not(.ghost)');
    if (first) first.classList.add('ghost');
    cta.insertBefore(el('<a class="btn" href="chandlery.html">Dip today\'s candles</a>'), cta.firstChild);
  }

  var rooms = document.querySelector('#rooms .rooms');
  if (rooms) rooms.insertBefore(el(
    '<a class="room" href="chandlery.html">' +
      '<span class="room-tag">candlemaking</span>' +
      '<h3>The Chandlery</h3>' +
      '<p>From a shed full of steam to a tallow chandler\'s back room. A wheel of wicks turns over a vat of melted fat, ' +
      'and forty or fifty dips make a candle. Keep the tallow just running, let each coat set before the next while the ' +
      'room warms through the afternoon, weigh a candle, and cut the wheel down when they are true to the pound. The ' +
      'day\'s number picks the town, the tallow, the order and the hour the carrier calls.</p>' +
      '<span class="room-go">Set the wheel turning →</span>' +
    '</a>'), rooms.firstChild);

  var after = document.querySelector('#seed .afterword');
  if (after) {
    after.innerHTML = after.innerHTML
      .replace('sixty-two jobs', 'sixty-three jobs')
      .replace(/One integer, sixty-two rooms\./, 'In <a href="chandlery.html">the Chandlery</a> it picks the tallow and ' +
        'warms the room through the afternoon, so the pace that suited the morning will not suit the day. ' +
        'One integer, sixty-three rooms.');
  }

  var log = document.querySelector('#log .log');
  if (log) log.insertBefore(el(
    '<li>' +
      '<time>Change 63</time>' +
      '<h3>Forty coats make a candle</h3>' +
      '<p>In the Saltpan the heat decided the grain. Added <a href="chandlery.html">The Chandlery</a>, where it decides ' +
      'the candle: a tallow chandler\'s dipping room some time between 1790 and 1869, in one of twelve towns from Exeter ' +
      'to the Canongate. The day\'s number picks the town and the season, the tallow (hard mutton, Russian, beef, mixed, ' +
      'or cheap rough fat, each setting at its own heat), the order on the slate (twelves, eights, long sixes or fours to ' +
      'the pound), how many wheels of it, the prices, the candle duty before 1831, and the hour the carrier calls.</p>' +
      '<p>Two sliders: the fire under the vat and the pace of the wheel. Tallow only just above its setting point lays a ' +
      'thick coat that ridges; hotter tallow lays a thin smooth one and, hotter still, melts the last coat off or smokes. ' +
      'Each coat cools towards the room, slower on a fat candle and slower as the afternoon warms, and a round taken ' +
      'before it has set makes the feet sag. Weigh a candle, cut the wheel down when it is right, and the buyer\'s scale ' +
      'and the account follow, with the vat and the room drawn through the day.</p>' +
    '</li>'), log.firstChild);
})();

/* ---------- Change 64: the Maltings ----------
   Announced the same way as the rooms above, and runs after them, so it lands in front of them. */
(function () {
  'use strict';
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  if (document.querySelector('a.room[href="maltings.html"]')) return;

  var nav = document.querySelector('.nav-links');
  if (nav) nav.appendChild(el('<a href="maltings.html">Maltings</a>'));

  var cta = document.querySelector('.cta-row');
  if (cta) {
    var first = cta.querySelector('.btn:not(.ghost)');
    if (first) first.classList.add('ghost');
    cta.insertBefore(el('<a class="btn" href="maltings.html">Lay today\'s barley on the floor</a>'), cta.firstChild);
  }

  var rooms = document.querySelector('#rooms .rooms');
  if (rooms) rooms.insertBefore(el(
    '<a class="room" href="maltings.html">' +
      '<span class="room-tag">malting</span>' +
      '<h3>The Maltings</h3>' +
      '<p>From an afternoon at the dipping wheel to ten days on a malting floor. Steeped barley grows, and growing makes ' +
      'heat. Watch by watch, set how deep the piece lies, how often it is turned and how far the shutters open, sprinkle ' +
      'it when it dries, split a corn to see how far the shoot has crept, and load the kiln at three-quarters. The day\'s ' +
      'number picks the town, the barley, the weather, the brewer\'s order and the day the kiln is wanted.</p>' +
      '<span class="room-go">Lay out the floor →</span>' +
    '</a>'), rooms.firstChild);

  var after = document.querySelector('#seed .afterword');
  if (after) {
    after.innerHTML = after.innerHTML
      .replace('sixty-three jobs', 'sixty-four jobs')
      .replace(/One integer, sixty-three rooms\./, 'In <a href="maltings.html">the Maltings</a> it steeps a barley and sends ' +
        'a warm or a cold spell across the floor in the middle of the week. One integer, sixty-four rooms.');
  }

  var log = document.querySelector('#log .log');
  if (log) log.insertBefore(el(
    '<li>' +
      '<time>Change 64</time>' +
      '<h3>Three parts up the corn</h3>' +
      '<p>The Chandlery raced the carrier through one afternoon. Added <a href="maltings.html">The Maltings</a>, which takes ' +
      'a week and a half: a floor maltings some time between 1820 and 1879, in one of twelve malting towns from Ware and ' +
      'Mistley to Burton and Knaresborough. The day\'s number picks the barley (Chevalier, Norfolk, clay-land, Saale or ' +
      'Scotch bere, each growing and heating at its own pace), how many quarters came out of the steep, how deep the ' +
      'excise couch lies, the weather with a warm or cold spell somewhere in it, the brewer\'s order (pale, amber or brown ' +
      'malt) and the day the kiln is wanted.</p>' +
      '<p>It plays in six-hour watches rather than against a running clock. For each watch set the depth of the piece, how ' +
      'many times to turn it and how far the shutters stand open, and sprinkle it if it is drying. A deep piece holds its ' +
      'heat and runs away with itself; a thin one goes cold and stops. Five split corns show the acrospire creeping up ' +
      'and the rootlets curling out; let them lie and they knit into a mat, let it get warm and wet and it goes musty. ' +
      'Load the kiln when the spire is three parts up, pick the finishing heat for the colour, and the brewer mashes a ' +
      'sample and says where the extract went, with the floor drawn watch by watch and the account.</p>' +
    '</li>'), log.firstChild);
})();

/* ---------- Change 65: the Ferry ----------
   Announced the same way as the rooms above, and runs after them, so it lands in front of them. */
(function () {
  'use strict';
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  if (document.querySelector('a.room[href="ferry.html"]')) return;

  var nav = document.querySelector('.nav-links');
  if (nav) nav.appendChild(el('<a href="ferry.html">Ferry</a>'));

  var cta = document.querySelector('.cta-row');
  if (cta) {
    var first = cta.querySelector('.btn:not(.ghost)');
    if (first) first.classList.add('ghost');
    cta.insertBefore(el('<a class="btn" href="ferry.html">Row this morning\'s ferry</a>'), cta.firstChild);
  }

  var rooms = document.querySelector('#rooms .rooms');
  if (rooms) rooms.insertBefore(el(
    '<a class="room" href="ferry.html">' +
      '<span class="room-tag">ferrying</span>' +
      '<h3>The Ferry</h3>' +
      '<p>From ten days on a malting floor to a morning on moving water. Row a ferry between two stairs across a tidal ' +
      'river while the stream slides under you: point the bow up into it and crab across, creep up the slack under the ' +
      'bank when you have been set down, and keep clear of the barges and tugs coming down on the tide. The day\'s number ' +
      'picks the river, the boat, the fare, the time of high water, the wind and everyone who comes down to the water.</p>' +
      '<span class="room-go">Take the oars →</span>' +
    '</a>'), rooms.firstChild);

  var after = document.querySelector('#seed .afterword');
  if (after) {
    after.innerHTML = after.innerHTML
      .replace('sixty-four jobs', 'sixty-five jobs')
      .replace(/One integer, sixty-four rooms\./, 'At <a href="ferry.html">the Ferry</a> it sets the hour of high water ' +
        'and turns the wind against the tide or with it. One integer, sixty-five rooms.');
  }

  var log = document.querySelector('#log .log');
  if (log) log.insertBefore(el(
    '<li>' +
      '<time>Change 65</time>' +
      '<h3>Point her where the stair will be</h3>' +
      '<p>The Maltings took a week and a half and never moved. Added <a href="ferry.html">The Ferry</a>, a morning on ' +
      'moving water: a rowing ferry across a tidal river some time between 1800 and 1879, on one of twelve crossings from ' +
      'Wapping Old Stairs and the Shields to Dartmouth, Polruan and Felixstowe Ferry. The day\'s number picks the river ' +
      'and how wide it is, where its deep channel runs, the boat (a sculler\'s skiff, a pair-oared wherry or the old ' +
      'ferry boat), the fare, the hour of high water, springs or neaps, the wind, a market day, and a fixed run of ' +
      'passengers and vessels for the morning.</p>' +
      '<p>It runs in real time, a minute of the morning every five seconds. Swing the bow and set the pull; the boat\'s ' +
      'track over the ground is its own speed through the water plus a stream that is strongest over the channel and ' +
      'dies away under the banks, rising and falling with the tide. Land on a stair to set people down and take up ' +
      'whoever is waiting, before they lose patience and walk round. Wind against tide raises a chop, tired arms slow ' +
      'the boat, and a barge or a tug that catches you leaves everyone aboard wet and unwilling to pay. At the end the ' +
      'page draws every crossing over the ground, the tide through the morning and the account.</p>' +
    '</li>'), log.firstChild);
})();
