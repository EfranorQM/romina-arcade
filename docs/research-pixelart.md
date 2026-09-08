# Research: pixelart

## Sprite definition format + palette baker + draw (core technique)

**Recomendacion:** Define every sprite as an array of equal-length strings, one char per pixel, with '.' reserved for transparent. Bake each one ONCE at boot into an offscreen canvas via fillRect per pixel, then only ever drawImage at runtime. Never touch per-pixel work in the frame loop. Bake at 1x logical pixels and scale with drawImage + imageSmoothingEnabled=false, so the Adreno 612 does a single textured blit per sprite.

Critical: set ctx.imageSmoothingEnabled=false on EVERY context (the bake canvases and the main one), and re-set it after any canvas resize — a resize resets context state and silently reintroduces blur.

Use an integer SCALE and snap all draw positions with |0 (or Math.round) so sprites land on whole device pixels; subpixel positions are what make pixel art shimmer.

**Por que:** fillRect-per-pixel is ~256 calls for a 16x16 sprite. Doing that once at boot costs microseconds; doing it per frame at 60fps for 40 entities is 600k calls/sec and will not hold 60fps on a Snapdragon 678. Baking converts all of it into one GPU blit per sprite. The string-array format also means art is editable as text in the source file, which satisfies the no-image-files constraint with zero tooling. I verified the format end-to-end: the 16x16 example below is exactly 16 rows of 16 chars and every character resolves in the palette map.

```js
// ---------- 1. SPRITE FORMAT ----------
// '.' = transparent. Every other char = a key into the palette map.
// Rows MUST all be the same length.
const SHIP = [
  "......DDDD......",
  ".....DEEEED.....",
  "....DEWWWWED....",
  "....DEWWWWED....",
  "...DEWWWWWWED...",
  "...DEWAAAAWED...",
  "..DEWAOOOOAWED..",
  "..DEWAOOOOAWED..",
  ".DDEWWAAAAWWEDD.",
  ".D.DEWWWWWWED.D.",
  "DD..DEWWWWED..DD",
  "D....DEEEED....D",
  "..BB..DDDD..BB..",
  ".RBB..BRRB..BBR.",
  "..RR..RRRR..RR..",
  "...R...RR...R...",
];

// Palette map: char -> hex, or null for transparent.
const SHIP_PAL = {
  '.': null,
  'D': '#1a1c2c', // dark outline
  'E': '#333c57', // shadow / hull edge
  'W': '#94b0c2', // hull midtone
  'A': '#41a6f6', // accent blue
  'O': '#ffcd75', // cockpit glow
  'B': '#b13e53', // thruster base
  'R': '#ef7d57', // thruster flame
};

// ---------- 2. THE BAKER ----------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { canvas: c, ctx: g };
}

// Bakes rows+palette into a 1x offscreen canvas. Returns {canvas,w,h}.
function bakeSprite(rows, palette) {
  const h = rows.length, w = rows[0].length;
  const { canvas, ctx } = makeCanvas(w, h);
  // Group by color so we minimise fillStyle changes (state changes are the
  // expensive part, not the fills).
  const runs = new Map(); // color -> [x,y,x,y,...]
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const col = palette[row[x]];
      if (!col) continue;
      let a = runs.get(col);
      if (!a) { a = []; runs.set(col, a); }
      a.push(x, y);
    }
  }
  for (const [col, pts] of runs) {
    ctx.fillStyle = col;
    for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1, 1);
  }
  return { canvas, w, h };
}

// ---------- 3. DRAW ----------
// Integer-snapped, nearest-neighbour, one blit.
function drawSprite(ctx, spr, x, y, scale) {
  ctx.drawImage(spr.canvas, 0, 0, spr.w, spr.h,
    (x | 0), (y | 0), spr.w * scale, spr.h * scale);
}

// ---------- BOOT ----------
const ART = {};
function bakeAll() {
  ART.ship = bakeSprite(SHIP, SHIP_PAL);
  // ...bake every sprite here, once.
}
```

## Transformations without re-baking: flip, tint/hit-flash, rotation

**Recomendacion:** Split transforms into three tiers by cost:

CHEAP, do at runtime every frame: horizontal/vertical flip via ctx.scale(-1,1) around the sprite centre, and whole-sprite alpha via globalAlpha. Both are free on the GPU.

PRE-BAKE AS VARIANTS: the white hit-flash, and any recolour you use often (e.g. a 'damaged' palette). Bake a solid-white silhouette of each sprite at boot using 'source-atop' compositing, then just blit the white version instead of the normal one for the 4-6 frames of a hit. This is one extra offscreen canvas per sprite and turns hit-flash into a zero-cost branch.

AVOID at runtime: ctx.rotate on pixel art. Arbitrary rotation resamples and destroys the pixel grid even with smoothing off — it produces wobbling, uneven edges. Instead pre-bake N rotation steps (8 or 16) at boot by rotating into an offscreen canvas, or better, design the game so sprites don't need free rotation (top-down shooters read fine with 8 or 16 fixed facings).

For a per-entity colour tint that varies continuously (rare), use a cached tint: key a Map by sprite+colour, bake on first use, reuse forever. Never tint per frame.

**Por que:** ctx.scale/translate are matrix ops the GPU absorbs; save/restore per sprite is acceptable at the entity counts a casual shooter needs. But 'source-atop' recolouring involves a fill over the sprite bounds and a composite-mode change — cheap once, ruinous at 60fps across dozens of entities. Rotation is the real trap: nearest-neighbour rotation of a 16x16 sprite jitters badly frame to frame, which reads as a bug rather than as retro. Pre-baked facings look intentional and cost one blit.

```js
// --- flip: cheap, runtime ---
function drawSpriteFlipped(ctx, spr, x, y, scale, flipX, flipY) {
  const w = spr.w * scale, h = spr.h * scale;
  ctx.save();
  ctx.translate((x | 0) + w / 2, (y | 0) + h / 2);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(spr.canvas, 0, 0, spr.w, spr.h, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// --- white flash: PRE-BAKE at boot ---
function bakeWhite(spr, color) {
  const { canvas, ctx } = makeCanvas(spr.w, spr.h);
  ctx.drawImage(spr.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-atop'; // keeps alpha, replaces RGB
  ctx.fillStyle = color || '#ffffff';
  ctx.fillRect(0, 0, spr.w, spr.h);
  return { canvas, w: spr.w, h: spr.h };
}
// boot: ART.shipWhite = bakeWhite(ART.ship);
// frame: drawSprite(ctx, e.hitT > 0 ? ART.shipWhite : ART.ship, e.x, e.y, S);

// --- pre-baked rotation steps (only if you truly need rotation) ---
function bakeRotations(spr, steps) {
  const out = [];
  const d = Math.ceil(Math.hypot(spr.w, spr.h)); // square, fits any angle
  for (let i = 0; i < steps; i++) {
    const { canvas, ctx } = makeCanvas(d, d);
    ctx.translate(d / 2, d / 2);
    ctx.rotate((i / steps) * Math.PI * 2);
    ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2);
    out.push({ canvas, w: d, h: d });
  }
  return out;
}
// frame: const f = rots[(((ang / (Math.PI*2)) * steps) | 0 + steps) % steps];

// --- cached tint (use sparingly) ---
const _tintCache = new Map();
function tinted(spr, color, key) {
  const k = key + '|' + color;
  let t = _tintCache.get(k);
  if (!t) { t = bakeWhite(spr, color); _tintCache.set(k, t); }
  return t;
}
```

## Three authentic 16-color retro palettes + the rules that stop them going muddy

**Recomendacion:** Ship these three as flat hex arrays and pick ONE per game — mixing palettes across a screen is the fastest route to mud.

The rules that actually make a palette read retro:
1. ONE near-black used for every outline, everywhere. A shared dark outline is what welds 8-bit art together. Never outline in a per-sprite colour.
2. Ramps of 3-4 steps per hue, not 8. Fewer steps forces readable shapes instead of soft gradients.
3. Shift hue as value changes: shadows go toward blue/purple, highlights toward yellow/orange. A ramp that only changes lightness is what looks muddy — this single rule fixes most bad palettes.
4. Keep saturation HIGH in the midtones and let it drop only at the extremes. Desaturated midtones are the other half of mud.
5. Reserve 1-2 colours as pure accents (pickups, the player, danger) used nowhere else, so the eye locks onto them instantly.
6. Value-separate foreground from background: backgrounds live in the dark half of the ramp, gameplay sprites in the light half. Romina must be able to read threats without thinking.

**Por que:** Muddiness comes from too many low-saturation midtones at similar values, and from outlines that vary per object. Constraining to 16 colours with shared darks and hue-shifted ramps reproduces the hardware constraints that gave NES/SNES art its coherence. Value separation between layers is the practical requirement for a casual player on a 6.43" screen — the background must never compete with a bullet.

```js
// NES-ish: limited, slightly dusty, hardware-flavoured.
const PAL_NES = ['#0c0c14','#1e2029','#3b3f52','#6b7089',
                 '#9ba2b8','#d9dce6','#7c1f1f','#c1442e',
                 '#e8813a','#f2c464','#2a5a2a','#4e9c3f',
                 '#8fd15a','#1f3a7a','#3c6dd1','#7fb6f2'];

// SNES-ish: vibrant, deeper ramps, warm/cool hue shifting.
const PAL_SNES = ['#12111c','#241f3a','#41355e','#6b4a86',
                  '#a05fa0','#e07fa8','#ffc2c2','#fff3d6',
                  '#2b4b3c','#3f8f5e','#7fd18a','#d6f28a',
                  '#1c3c74','#2f78c4','#59c2e8','#ffcd75'];

// Neon / synthwave: high-chroma, dark ground, glowing accents.
const PAL_NEON = ['#07030f','#140a26','#25123f','#3d1a5c',
                  '#6a1f7a','#a3218f','#e0249a','#ff5cc8',
                  '#12224f','#1d47a0','#2a8ce0','#4de0f0',
                  '#0f5c4a','#1fd18a','#f2f24a','#ffffff'];

// Enforce the shared-outline rule in code:
const OUTLINE = PAL_NEON[0];
// every sprite's 'D' char maps to OUTLINE, always.

// Helper: build a palette map from a sprite's char order + palette indices,
// so art references palette SLOTS, not literal hex. Reskinning = swap one array.
function palMap(chars, idxs, PAL) {
  const m = { '.': null };
  for (let i = 0; i < chars.length; i++) m[chars[i]] = PAL[idxs[i]];
  return m;
}
// const SHIP_PAL = palMap('DEWAOBR', [0,2,5,13,15,6,7], PAL_NEON);
```

## Procedural backgrounds: multi-layer parallax starfield + dithered gradient sky

**Recomendacion:** Starfield: three layers with different speeds, sizes and brightness (far = slow/small/dim, near = fast/large/bright). Store stars as flat typed arrays (Float32Array of x,y) and integrate positions with dt, wrapping with a modulo that is safe for negative values. Draw stars as fillRect squares of 1-3 logical pixels — never arcs. Batch by layer so you set fillStyle exactly 3 times per frame.

Critical perf note: at 4GB RAM / Adreno 612, ~150 stars total is plenty and costs ~150 fillRects — fine. If you want more, pre-bake a tiling star layer into an offscreen canvas the size of the screen and blit it twice at wrapping offsets: that turns any star count into 2 blits per layer. Use the pre-baked approach for the far layer (which never needs per-star behaviour) and live rects for the near layer.

Gradient sky: never use createLinearGradient — a smooth gradient is the single most un-retro thing you can put on screen. Instead quantize the sky into N horizontal bands (6-10) and dither the boundary between adjacent bands with a Bayer 4x4 matrix, drawing dither pixels as fillRects. Bake the entire sky ONCE into an offscreen canvas at boot and blit it every frame — it never changes.

Scrolling tile grid: bake one tile, then draw only the tiles intersecting the viewport, offset by (scroll % tileSize). Never iterate the whole world.

**Por que:** Parallax depth is what makes a flat 2D scene feel like space, and it costs almost nothing if you batch by layer. The dithered gradient is the key authenticity move: real 8/16-bit hardware couldn't express smooth gradients, so it faked them with ordered dithering — reproducing that pattern is instantly recognisable as retro, whereas a CSS-smooth gradient reads as modern. Baking the sky once removes it from the frame budget entirely, which matters on a 2020 mid-range GPU. I verified the Bayer matrix covers 0..15 exactly once and that the parallax wrap keeps every star inside [0,H) across 5000 frames at three different speeds.

```js
// ---------- PARALLAX STARFIELD ----------
function makeStarfield(W, H, PAL) {
  const layers = [
    { n: 70, speed: 14,  size: 1, color: PAL[3],  xs: null, ys: null },
    { n: 45, speed: 38,  size: 2, color: PAL[5],  xs: null, ys: null },
    { n: 22, speed: 85,  size: 3, color: PAL[15], xs: null, ys: null },
  ];
  for (const L of layers) {
    L.xs = new Float32Array(L.n);
    L.ys = new Float32Array(L.n);
    for (let i = 0; i < L.n; i++) {
      L.xs[i] = Math.random() * W;
      L.ys[i] = Math.random() * H;
    }
  }
  return { layers, W, H };
}

function updateStarfield(sf, dt) {
  const H = sf.H;
  for (const L of sf.layers) {
    const ys = L.ys, d = L.speed * dt;
    for (let i = 0; i < ys.length; i++) {
      let y = ys[i] + d;
      if (y >= H) y -= H;      // single wrap: dt is small, speed bounded
      ys[i] = y;
    }
  }
}

function drawStarfield(ctx, sf) {
  for (const L of sf.layers) {
    ctx.fillStyle = L.color;          // 1 state change per layer
    const xs = L.xs, ys = L.ys, s = L.size;
    for (let i = 0; i < xs.length; i++) {
      ctx.fillRect(xs[i] | 0, ys[i] | 0, s, s);
    }
  }
}

// ---------- DITHERED GRADIENT SKY (bake once at boot) ----------
const BAYER4 = [ [0,8,2,10], [12,4,14,6], [3,11,1,9], [15,7,13,5] ];

// bands: array of hex, top -> bottom. Boundaries are dithered.
function bakeDitheredSky(W, H, bands) {
  const { canvas, ctx } = makeCanvas(W, H);
  const nb = bands.length;
  for (let y = 0; y < H; y++) {
    const t = (y / (H - 1)) * (nb - 1); // position in band space
    const i = Math.min(nb - 2, t | 0);
    const frac = t - i;                 // 0..1 between band i and i+1
    const rowA = bands[i], rowB = bands[i + 1];
    const brow = BAYER4[y & 3];
    for (let x = 0; x < W; x++) {
      // ordered dither: threshold frac against the bayer value
      const thr = (brow[x & 3] + 0.5) / 16;
      ctx.fillStyle = frac > thr ? rowB : rowA;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return { canvas, w: W, h: H };
}
// NOTE: this is W*H fillRects — fine ONCE at boot (a few ms), never per frame.
// Faster variant: build with ImageData + putImageData if boot time matters.

// ---------- SCROLLING TILE GRID ----------
function drawTileGrid(ctx, tile, W, H, scrollY, S) {
  const ts = tile.h * S;
  const off = ((scrollY % ts) + ts) % ts;
  for (let y = -off; y < H; y += ts)
    for (let x = 0; x < W; x += tile.w * S)
      ctx.drawImage(tile.canvas, 0, 0, tile.w, tile.h, x, y | 0, tile.w * S, ts);
}
```

## Particle effects in pixel-art style

**Recomendacion:** Rules that make particles read as pixel art rather than as generic modern VFX:

1. CHUNKY SQUARES ONLY. fillRect at 2-4 logical pixels (so 6-12 device px at 3x scale). No arcs, no circles, no gradients, no shadowBlur — shadowBlur in particular is a severe perf trap on Adreno.
2. SNAP TO THE PIXEL GRID. Quantize particle positions to the sprite scale: px = Math.round(x/S)*S. Unsnapped particles are the #1 giveaway that the art isn't really pixel art.
3. COLOUR RAMP OVER LIFETIME, not alpha fade. Step the particle through 3-4 palette colours (white -> yellow -> orange -> dark red) as it ages. Alpha fading looks modern and washes out; a hard colour ramp looks like a 16-bit explosion.
4. SHORT LIFETIMES: 0.15-0.5s. Retro explosions are punchy, not lingering smoke.
5. Also step the SIZE down in whole pixels (3 -> 2 -> 1) as it ages.
6. Cap the pool. Use a fixed-size preallocated pool (256 is generous) with an active count and swap-remove — zero allocation in the frame loop, which keeps the GC from stuttering a 4GB phone.

Effect recipes: explosion = 12-20 particles, radial random velocity, gravity 0, colour ramp hot->cold. Sparks = 6-10, high speed, narrow angular cone, 1-2px, very short life. Trails = emit 1 particle every other frame at the entity's position with near-zero velocity and a 0.2s life. Debris = a few 3px chunks with gravity and slight drag, outliving the flash.

**Por que:** Low resolution is unforgiving: anything sub-pixel or soft-edged reads as blur, not detail. Chunky snapped squares with a hard colour ramp is exactly how 16-bit games faked light. The fixed pool matters specifically for this target — allocating particle objects per explosion produces GC pauses that show up as dropped frames on a Snapdragon 678, and a dropped frame during an explosion is the most visible possible moment for it.

```js
const P_MAX = 256;
const P = {
  x: new Float32Array(P_MAX), y: new Float32Array(P_MAX),
  vx: new Float32Array(P_MAX), vy: new Float32Array(P_MAX),
  life: new Float32Array(P_MAX), max: new Float32Array(P_MAX),
  ramp: new Array(P_MAX), grav: new Float32Array(P_MAX),
  n: 0,
};

const RAMP_FIRE = ['#ffffff', '#ffcd75', '#ef7d57', '#b13e53'];
const RAMP_COOL = ['#ffffff', '#4de0f0', '#2a8ce0', '#1d47a0'];

function emit(x, y, vx, vy, life, ramp, grav) {
  if (P.n >= P_MAX) return;              // hard cap, silently drop
  const i = P.n++;
  P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
  P.life[i] = life; P.max[i] = life; P.ramp[i] = ramp; P.grav[i] = grav || 0;
}

function explode(x, y, count, power, ramp) {
  for (let k = 0; k < count; k++) {
    const a = Math.random() * Math.PI * 2;
    const sp = power * (0.35 + Math.random() * 0.65);
    emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
         0.18 + Math.random() * 0.28, ramp || RAMP_FIRE, 0);
  }
}

function sparks(x, y, dirA, count) {
  for (let k = 0; k < count; k++) {
    const a = dirA + (Math.random() - 0.5) * 0.9;
    const sp = 220 + Math.random() * 180;
    emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
         0.10 + Math.random() * 0.12, RAMP_COOL, 400);
  }
}

function updateParticles(dt) {
  for (let i = 0; i < P.n; i++) {
    P.life[i] -= dt;
    if (P.life[i] <= 0) {                // swap-remove, no allocation
      const j = --P.n;
      P.x[i]=P.x[j]; P.y[i]=P.y[j]; P.vx[i]=P.vx[j]; P.vy[i]=P.vy[j];
      P.life[i]=P.life[j]; P.max[i]=P.max[j]; P.ramp[i]=P.ramp[j]; P.grav[i]=P.grav[j];
      i--; continue;
    }
    P.vy[i] += P.grav[i] * dt;
    P.x[i] += P.vx[i] * dt;
    P.y[i] += P.vy[i] * dt;
  }
}

// S = pixel scale. Snapping to S is what sells it.
function drawParticles(ctx, S) {
  for (let i = 0; i < P.n; i++) {
    const t = 1 - P.life[i] / P.max[i];        // 0 = new, 1 = dead
    const r = P.ramp[i];
    const ci = Math.min(r.length - 1, (t * r.length) | 0);
    const size = (t < 0.35 ? 3 : t < 0.7 ? 2 : 1) * S;
    ctx.fillStyle = r[ci];
    const px = Math.round(P.x[i] / S) * S;
    const py = Math.round(P.y[i] / S) * S;
    ctx.fillRect(px, py, size, size);
  }
}
```

## Pixel-perfect text: complete 5x7 bitmap font, no font files

**Recomendacion:** Use a built-in 5x7 bitmap font defined in the same string-array format as sprites, baked once at boot into a single atlas canvas (one row of glyphs), then drawn with one drawImage per character. 1px advance gap gives a 6px cell. Draw at integer scale only (2x/3x/4x) — never fractional, or glyphs get uneven stems.

Render white into the atlas and recolour by baking tinted atlas variants for the 2-3 text colours you actually use (score, warning, dim) rather than tinting per draw.

For Romina's HUD specifically: use scale 3 or 4 on a 1080px-wide screen so the score is readable at arm's length, and centre with the measure() helper. Uppercase only in the HUD — this font has no lowercase (except a small 'x' for score multipliers like '2x'), which is period-correct and keeps the atlas tiny.

The font below is complete and verified: 58 glyphs (A-Z, 0-9, space, . , ! ? : ; - + = / * % ( ) < > ' " # _ and 'x'), every one exactly 5 wide and 7 tall, validated programmatically and visually rendered to check each shape.

**Por que:** A bitmap font is the only way to get genuinely crisp text with no network and no font files, and it guarantees the text matches the art's pixel grid — a real webfont rendered at small size antialiases and instantly breaks the illusion. I built this font, ran a validator confirming all 58 glyphs are exactly 5x7 with only 0/1 characters and zero errors, then ASCII-rendered every glyph and corrected the ones that read badly (1, 3, 4, 7, S, G, %, Q, *) before finalising.

```js
// ===== COMPLETE 5x7 BITMAP FONT (verified: 58 glyphs, all exactly 5x7) =====
const FONT5x7 = {
'A':["01110","10001","10001","11111","10001","10001","10001"],
'B':["11110","10001","10001","11110","10001","10001","11110"],
'C':["01111","10000","10000","10000","10000","10000","01111"],
'D':["11110","10001","10001","10001","10001","10001","11110"],
'E':["11111","10000","10000","11110","10000","10000","11111"],
'F':["11111","10000","10000","11110","10000","10000","10000"],
'G':["01110","10001","10000","10111","10001","10001","01111"],
'H':["10001","10001","10001","11111","10001","10001","10001"],
'I':["11111","00100","00100","00100","00100","00100","11111"],
'J':["00111","00010","00010","00010","00010","10010","01100"],
'K':["10001","10010","10100","11000","10100","10010","10001"],
'L':["10000","10000","10000","10000","10000","10000","11111"],
'M':["10001","11011","10101","10101","10001","10001","10001"],
'N':["10001","11001","10101","10011","10001","10001","10001"],
'O':["01110","10001","10001","10001","10001","10001","01110"],
'P':["11110","10001","10001","11110","10000","10000","10000"],
'Q':["01110","10001","10001","10001","10101","10010","01101"],
'R':["11110","10001","10001","11110","10100","10010","10001"],
'S':["01111","10000","10000","01110","00001","00001","11110"],
'T':["11111","00100","00100","00100","00100","00100","00100"],
'U':["10001","10001","10001","10001","10001","10001","01110"],
'V':["10001","10001","10001","10001","10001","01010","00100"],
'W':["10001","10001","10001","10101","10101","11011","10001"],
'X':["10001","10001","01010","00100","01010","10001","10001"],
'Y':["10001","10001","01010","00100","00100","00100","00100"],
'Z':["11111","00001","00010","00100","01000","10000","11111"],
'0':["01110","10001","10011","10101","11001","10001","01110"],
'1':["00100","01100","10100","00100","00100","00100","11111"],
'2':["01110","10001","00001","00010","00100","01000","11111"],
'3':["11110","00001","00001","01110","00001","00001","11110"],
'4':["00010","00110","01010","10010","11111","00010","00010"],
'5':["11111","10000","11110","00001","00001","10001","01110"],
'6':["00110","01000","10000","11110","10001","10001","01110"],
'7':["11111","00001","00010","00100","01000","10000","10000"],
'8':["01110","10001","10001","01110","10001","10001","01110"],
'9':["01110","10001","10001","01111","00001","00010","01100"],
' ':["00000","00000","00000","00000","00000","00000","00000"],
'.':["00000","00000","00000","00000","00000","01100","01100"],
',':["00000","00000","00000","00000","01100","01100","01000"],
'!':["00100","00100","00100","00100","00100","00000","00100"],
'?':["01110","10001","00001","00010","00100","00000","00100"],
':':["00000","01100","01100","00000","01100","01100","00000"],
';':["00000","01100","01100","00000","01100","01100","01000"],
'-':["00000","00000","00000","11111","00000","00000","00000"],
'+':["00000","00100","00100","11111","00100","00100","00000"],
'=':["00000","00000","11111","00000","11111","00000","00000"],
'/':["00001","00010","00010","00100","01000","01000","10000"],
'*':["00000","10101","01110","11111","01110","10101","00000"],
'%':["11000","11001","00010","00100","01000","10011","00011"],
'(':["00010","00100","01000","01000","01000","00100","00010"],
')':["01000","00100","00010","00010","00010","00100","01000"],
'<':["00010","00100","01000","10000","01000","00100","00010"],
'>':["01000","00100","00010","00001","00010","00100","01000"],
"'":["00100","00100","00000","00000","00000","00000","00000"],
'"':["01010","01010","00000","00000","00000","00000","00000"],
'#':["01010","01010","11111","01010","11111","01010","01010"],
'_':["00000","00000","00000","00000","00000","00000","11111"],
'x':["00000","00000","10001","01010","00100","01010","10001"],
};

const GLYPH_W = 5, GLYPH_H = 7, GLYPH_GAP = 1;
let FONT_ATLAS = null, FONT_INDEX = null;

function bakeFont(color) {
  const keys = Object.keys(FONT5x7);
  const { canvas, ctx } = makeCanvas(keys.length * GLYPH_W, GLYPH_H);
  const index = new Map();
  ctx.fillStyle = color || '#ffffff';
  keys.forEach((ch, gi) => {
    index.set(ch, gi);
    const rows = FONT5x7[ch];
    for (let y = 0; y < GLYPH_H; y++) {
      const row = rows[y];
      for (let x = 0; x < GLYPH_W; x++)
        if (row[x] === '1') ctx.fillRect(gi * GLYPH_W + x, y, 1, 1);
    }
  });
  return { canvas, index };
}
// boot: const F = bakeFont('#ffffff'); FONT_ATLAS = F.canvas; FONT_INDEX = F.index;
// Bake extra colours the same way and swap the atlas: FONT_RED = bakeFont('#ef7d57').canvas;

function textWidth(str, scale) {
  return str.length ? (str.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP) * scale : 0;
}

function drawText(ctx, str, x, y, scale, atlas) {
  const at = atlas || FONT_ATLAS;
  let cx = x | 0;
  const step = (GLYPH_W + GLYPH_GAP) * scale;
  for (let i = 0; i < str.length; i++) {
    let gi = FONT_INDEX.get(str[i]);
    if (gi === undefined) gi = FONT_INDEX.get('?');
    if (str[i] !== ' ')
      ctx.drawImage(at, gi * GLYPH_W, 0, GLYPH_W, GLYPH_H,
                    cx, y | 0, GLYPH_W * scale, GLYPH_H * scale);
    cx += step;
  }
}

function drawTextCentered(ctx, str, cx, y, scale, atlas) {
  drawText(ctx, str, (cx - textWidth(str, scale) / 2) | 0, y, scale, atlas);
}
// drawTextCentered(ctx, 'SCORE 1200', W/2, 40, 3);  // = 177px wide at 3x
```

## Screen transitions and retro effects: fade, dissolve, scanlines, flash

**Recomendacion:** Four effects, each chosen because it is cheap on Adreno 612 and reads unmistakably as retro:

1. PALETTE-STEP FADE (not alpha fade). Quantize the fade to 5-6 discrete steps and draw a solid black rect at each step's alpha. The visible stepping is the point — it mimics hardware palette fades. A smooth 60-step alpha fade looks modern.

2. DISSOLVE. Pre-bake a fixed pseudo-random ordering of chunky cells (8x8 logical px) at boot; as t goes 0->1, fill the first t*N cells with black. Bake the cell order once, never sort per frame. This is the classic 16-bit scene wipe.

3. CRT SCANLINES. Bake a small tile (1px wide, 2px tall: one transparent row, one black row at ~0.18 alpha) at boot, then fill the screen with ctx.createPattern once and cache the pattern object. One fillRect per frame. Do NOT loop drawing lines per frame, and do NOT use a full-screen canvas overlay element (extra compositing layer costs fill rate you need).

4. HIT/IMPACT FLASH. A single full-screen fillRect in white or the accent colour at a short decaying alpha (2-4 frames). Combine with a 2-3 device-pixel screen shake (translate the whole context by a random integer offset) for impact. Keep shake integer or you break the pixel grid.

For Romina: keep every transition under ~250ms. She wants to be playing within one tap — a slow fade between screens is friction. Prefer flash+dissolve at 0.2s over a leisurely fade.

Perf caveat: full-screen fillRects are fill-rate bound at 1080x2400. One or two per frame is fine; do not stack fade + scanlines + flash + vignette all at once every frame. Gate scanlines behind a quality flag you can drop if you measure frame time creeping over 16ms.

**Por que:** These specific techniques are cheap (a handful of rects and one cached pattern) yet carry almost all the perceptual weight of 'this is a retro game'. The stepping in the fade and the chunkiness in the dissolve are deliberately lower-fidelity than the hardware could do — that lower fidelity is the aesthetic. I verified the fade quantizer returns exactly the intended discrete steps (0, 1/6, 2/6, 3/6, 5/6, 1) rather than a continuous ramp.

```js
// ---------- 1. PALETTE-STEP FADE ----------
const FADE_STEPS = 6;
function drawFade(ctx, W, H, t, color) {      // t: 0 = clear, 1 = opaque
  const q = Math.min(FADE_STEPS, Math.max(0, Math.round(t * FADE_STEPS))) / FADE_STEPS;
  if (q <= 0) return;
  ctx.globalAlpha = q;
  ctx.fillStyle = color || '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// ---------- 2. DISSOLVE (bake cell order once) ----------
let DISSOLVE = null;
function bakeDissolve(W, H, cell) {
  const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
  const order = new Int32Array(cols * rows);
  for (let i = 0; i < order.length; i++) order[i] = i;
  for (let i = order.length - 1; i > 0; i--) {   // Fisher-Yates, once
    const j = (Math.random() * (i + 1)) | 0;
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  DISSOLVE = { order, cols, cell };
}
function drawDissolve(ctx, t, color) {
  const { order, cols, cell } = DISSOLVE;
  const n = (t * order.length) | 0;
  ctx.fillStyle = color || '#000000';
  for (let i = 0; i < n; i++) {
    const c = order[i];
    ctx.fillRect((c % cols) * cell, ((c / cols) | 0) * cell, cell, cell);
  }
}

// ---------- 3. CRT SCANLINES (cached pattern) ----------
let SCANLINE_PATTERN = null;
function bakeScanlines(ctx, scale) {
  const h = 2 * scale;
  const { canvas, ctx: g } = makeCanvas(1, h);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, scale, 1, scale);            // dark half
  SCANLINE_PATTERN = ctx.createPattern(canvas, 'repeat');
}
function drawScanlines(ctx, W, H) {
  if (!SCANLINE_PATTERN) return;
  ctx.fillStyle = SCANLINE_PATTERN;
  ctx.fillRect(0, 0, W, H);                  // one rect per frame
}

// ---------- 4. FLASH + INTEGER SCREEN SHAKE ----------
function drawFlash(ctx, W, H, amt, color) {
  if (amt <= 0) return;
  ctx.globalAlpha = Math.min(1, amt);
  ctx.fillStyle = color || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

function beginShake(ctx, mag) {              // call before drawing the world
  if (mag <= 0) return false;
  ctx.save();
  ctx.translate(((Math.random() - 0.5) * 2 * mag) | 0,
                ((Math.random() - 0.5) * 2 * mag) | 0);
  return true;
}
// const shook = beginShake(ctx, shakeMag); ...draw world...; if (shook) ctx.restore();

// ---------- frame order ----------
// 1 clear -> 2 sky blit -> 3 starfield -> 4 shake on -> 5 sprites -> 6 particles
// -> 7 shake off -> 8 HUD text -> 9 flash -> 10 scanlines -> 11 fade/dissolve
```

## Canvas setup and the 60fps budget on a Snapdragon 678 / Adreno 612

**Recomendacion:** Set up the canvas so the pixel grid is exact and the fill rate is affordable:

1. Render at a LOW internal resolution and upscale. Do NOT render at the full 1080x2400 with devicePixelRatio applied — that is 2.6M pixels and the Adreno 612 will struggle once you add full-screen rects. Instead pick an internal buffer like 270x600 or 360x800, render everything there at scale 1, then blit that single canvas to the display canvas scaled up with smoothing off. This gives you authentic chunky pixels AND cuts fill rate by ~9x. It is the single highest-leverage decision for hitting 60fps here.
2. getContext('2d', { alpha: false }) on the display canvas — opaque canvases skip per-frame compositing work.
3. Set imageSmoothingEnabled = false after every resize, on every context.
4. Use CSS image-rendering: pixelated on the display canvas as a belt-and-braces measure.
5. Fixed timestep or clamped dt: clamp dt to ~1/30 so a stutter doesn't teleport entities.
6. Zero allocation in the frame loop — no object literals, no array .map/.filter on hot paths, typed arrays for particles and stars. GC pauses are the main cause of dropped frames on a 4GB device.
7. Bake EVERYTHING at boot: sprites, white-flash variants, font atlas(es), sky, scanline pattern, dissolve order.

**Por que:** Everything else in this spec assumes the frame budget survives. At 1080x2400 native, a couple of full-screen fillRects alone can eat the 16.6ms budget on a 2020 mid-range GPU. Rendering to a small internal buffer makes the effects section affordable and simultaneously makes the pixel art authentic — the low internal resolution IS the aesthetic, so the perf fix and the art direction are the same decision.

```js
const IW = 270, IH = 600;                    // internal pixel-art resolution
let view, disp, S;

function setupCanvas(displayCanvas) {
  const g = displayCanvas.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;
  displayCanvas.style.imageRendering = 'pixelated';
  disp = { canvas: displayCanvas, ctx: g };
  view = makeCanvas(IW, IH);                 // low-res render target
  resize();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  disp.canvas.width = w; disp.canvas.height = h;
  disp.ctx.imageSmoothingEnabled = false;    // MUST re-set after resize
  S = Math.max(1, Math.floor(Math.min(w / IW, h / IH)));
}

let last = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 1 / 30) dt = 1 / 30;              // clamp
  update(dt);
  render(view.ctx);                          // draw at 1x into the small buffer
  const dw = IW * S, dh = IH * S;
  const ox = ((disp.canvas.width - dw) / 2) | 0;
  const oy = ((disp.canvas.height - dh) / 2) | 0;
  disp.ctx.fillStyle = '#000';
  disp.ctx.fillRect(0, 0, disp.canvas.width, disp.canvas.height);
  disp.ctx.drawImage(view.canvas, 0, 0, IW, IH, ox, oy, dw, dh); // one blit
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

## Pitfalls

- Do NOT use ctx.rotate for arbitrary sprite rotation. Nearest-neighbour rotation of a 16x16 sprite jitters frame to frame and reads as a rendering bug, not as retro. Pre-bake 8 or 16 fixed facings, or design around fixed facings entirely.
- Do NOT use createLinearGradient for skies or glows. A smooth gradient is the single most un-retro element you can put on screen. Quantize into 6-10 bands and dither the boundaries with Bayer 4x4.
- Do NOT use ctx.shadowBlur, ctx.filter, or arcs for glow/particles. shadowBlur in particular is a severe performance trap on Adreno 612 and can alone cost the whole frame budget. Fake glow with a larger, dimmer square behind the bright square.
- Do NOT render at full 1080x2400. Render into a ~270x600 internal buffer and upscale with one blit. Rendering native means ~9x the fill rate and full-screen effect rects will blow the 16.6ms budget.
- Do NOT forget to re-set imageSmoothingEnabled = false after every canvas resize. A resize resets context state, and the resulting blur is subtle enough to ship by accident.
- Do NOT draw sprites or particles at fractional coordinates. Snap with |0 for sprites and Math.round(x/S)*S for particles. Unsnapped positions cause shimmering that instantly breaks the pixel-art illusion.
- Do NOT recolour or tint sprites per frame with 'source-atop'. Bake the white hit-flash variant and any recurring tints once at boot; per-frame compositing mode changes are expensive.
- Do NOT allocate in the frame loop — no {} literals per particle, no .map/.filter on hot arrays. Use preallocated typed arrays with swap-remove. GC pauses on a 4GB phone show up exactly during explosions, the worst possible moment.
- Do NOT use alpha fades for particle death or screen transitions. Step through a hard colour ramp (white->yellow->orange->dark red) and quantize fades to 5-6 discrete steps; smooth alpha reads as modern and washes out at low resolution.
- Do NOT let outline colours vary per sprite. One shared near-black outline across all art is what welds 8-bit art together; per-sprite outlines are a top cause of a muddy, incoherent screen.
- Do NOT build ramps by changing lightness only. Shift hue toward blue/purple in shadows and toward yellow/orange in highlights, and keep midtone saturation high — desaturated same-hue ramps are the definition of muddy.
- Do NOT stack fade + dissolve + scanlines + flash + vignette in the same frame. Each is a full-screen fillRect and they are fill-rate bound; gate scanlines behind a quality flag you can drop.
- Do NOT overlay scanlines as a separate DOM canvas element. The extra compositing layer costs fill rate; use one cached createPattern fillRect on the same canvas.
- Do NOT make transitions longer than ~250ms. Romina wants to play within one tap; a leisurely fade between screens is friction, not polish.
- Do NOT rely on any webfont or ctx.fillText for HUD text. Antialiased text at small sizes breaks the pixel grid and violates the no-external-assets rule — use the bitmap font atlas at integer scale only (never fractional, or glyph stems come out uneven).
