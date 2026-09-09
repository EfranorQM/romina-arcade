# SYMBIOTE research: enemies

## Virtual resolution: use 360x800, not 540x1200

**Recomendacion:** Set SYMBIOTE's virtual grid to 360x800 (aspect 2.2222 = exact 20:9, same as 270x600). Do NOT go to 540x1200. 360x800 is 1.78x the pixels of the existing 270x600 and scales to the 1080x2400 panel at exactly 3.0x integer, which is the cleanest possible upscale — 540x1200 scales at exactly 2.0x and is also clean, but costs 4x the existing fill and, critically, 4x the gore-layer memory and 4x the per-decal stamp cost. Budget verified: at 360x800 a worst-case frame (clear + gore-layer blit + baked tilemap blit + 24 debris + 150 particles + 12 scientists + player/tentacle + HUD) = 872,032 px/frame = 3.03x overdraw = 52.3 Mpx/s. At 540x1200 the same scene is 2.25x that = 118 Mpx/s, which starts to matter on an Adreno 612 in a WebView where three full-screen layers are already being composited. 360x800 also gives a scientist a 10x14 sprite instead of 8x11 — enough pixels for a head, a torso, two arms and two legs to read as separate parts when they detach, which is the entire requirement. Since the module must own a different VW/VH than core.js exports, do NOT edit core.js: SYMBIOTE draws into its own offscreen 360x800 canvas and blits it to the 270x600 main canvas... actually no, that costs a resample. Instead: change core.js VW/VH to 360x800 for the whole app and rescale the other three games' coordinates by 4/3 (they were already rescaled once by 1.5x from 180x400, per the comment at the top of neonfist.js, so this is a known, done-before operation).

**Por que:** The reason to raise resolution at all is dismemberment legibility: at 270x600 a scientist is ~8x11 px and a detached forearm is 2x3 px, which reads as a floating dot, not a limb. At 360x800 a forearm is 3x4 with a 1px outline and a distinct wound pixel — it reads. Going further to 540x1200 buys detail the player will never see (the phone is held at arm's length, 3px vs 4.5px per limb is invisible) while quadrupling the two costs that actually threaten this specific game: the persistent gore-layer texture and per-decal stamping. The 3.0x integer scale to 1080x2400 is a bonus that keeps imageSmoothingEnabled=false producing perfectly square pixels with no shimmer.

```js
// core.js — single change, whole app moves to the finer grid
export const VW = 360, VH = 800;   // 20:9 exacto, 3.0x entero hacia 1080x2400

// Verified: 360/800 = 0.45, 1080/2400 = 0.45. Escala 3.0 exacta.
// Los otros tres juegos: multiplicar constantes de coordenadas por 4/3
// (ya se hizo 1.5x de 180x400 -> 270x600, es la misma operacion).
```

## Scientist as 6 separable parts: one baked body sprite + 6 baked part sprites

**Recomendacion:** Do NOT model the living scientist as 6 independently-simulated parts — that costs 6x the draw calls and 6x the transform work for 12 scientists that are alive 95% of the time. Model him as ONE baked 10x14 sprite (2 walk frames x 2 facings = 4 baked canvases, plus 1 white flash frame). Dismemberment is a swap: on the killing blow, free the scientist entity and spawn N debris entities from a set of 6 pre-baked part sprites (HEAD 4x4, TORSO 6x7, ARM 3x5, LEG 3x6 — arm and leg baked once each and mirrored via bakeFlip for the left side, giving 6 canvases total, ~180 px baked at boot). Each part sprite has a WOUND edge: the pixel row/column where it tore off is painted in P.wound (#c81e2d) not in the outline colour, so a detached arm reads as torn rather than as a floating rectangle. Every part is also baked in a ROTATED set: pre-bake each part at 8 rotations (45 degrees apart) at boot = 6 parts x 8 angles = 48 tiny canvases, ~1,440 px total, baked in under a millisecond. This lets debris spin with zero per-frame ctx.rotate/save/restore — a rotating drawImage with a transform costs roughly 3-4x a plain axis-aligned blit on Adreno, and save/restore per debris was explicitly called out as the thing to avoid in the project's own perf research. 8 angular steps at 6-8px sprite size is visually indistinguishable from continuous rotation because the sprite is too small for finer steps to differ.

**Por que:** The pooling/perf constraint and the visual constraint push in opposite directions, and the pre-baked rotation set resolves both: you get real spinning limbs with the same cost as a static blit. 48 canvases sounds like a lot but at 6-8px each it is under 1,500 pixels of boot-time work — the project's research doc already measured 24 baked canvases as 'well under a millisecond'. The wound-pixel detail is what makes a 3x5 rectangle read as an arm instead of debris: the eye latches onto the asymmetric red edge.

```js
// --- Partes horneadas UNA vez en init(). 8 rotaciones cada una. ---
const HEAD = ['.11.','1441','1441','.11.'];
const TORSO = ['.1111.','122221','122221','122221','133331','1w..w1','.1111.'];
const ARM  = ['141','141','141','141','1w1'];
const LEG  = ['166','166','166','166','1w1','.1.'];
const BMAP = { '1':P.out, '2':P.coat, '3':P.coatSh, '4':P.skin, '6':P.pants, 'w':P.wound };

// bakeRot: 8 pasos. Se dibuja el sprite ya horneado sobre un lienzo cuadrado
// rotado; el resultado queda cacheado y se blitea SIN transform en runtime.
function bakeRot(src) {
  const d = Math.ceil(Math.hypot(src.width, src.height));
  const out = new Array(8);
  for (let a = 0; a < 8; a++) {
    const cv = document.createElement('canvas');
    cv.width = d; cv.height = d;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.translate(d / 2, d / 2);
    c.rotate(a * Math.PI / 4);
    c.drawImage(src, -src.width / 2 | 0, -src.height / 2 | 0);
    out[a] = cv;
  }
  return out;
}

// En init():
// PART[0]=head PART[1]=torso PART[2]=armR PART[3]=armL PART[4]=legR PART[5]=legL
let PART;
function bakeParts() {
  const h = bake(HEAD, BMAP, 1), t = bake(TORSO, BMAP, 1);
  const ar = bake(ARM, BMAP, 1), lr = bake(LEG, BMAP, 1);
  PART = [bakeRot(h), bakeRot(t), bakeRot(ar), bakeRot(bakeFlip(ar)),
          bakeRot(lr), bakeRot(bakeFlip(lr))];
}
```

## Debris physics: pool, integration, bounce, and the blood trail

**Recomendacion:** Allocate `debris = new Pool(28, mkDebris, null)` in init(). 28 is the cap (math in the performance-ceiling finding). Per debris: x, y, vx, vy, ang (radians, continuous), spin (rad/s), part (0-5), life, max, trail (accumulator), rest (bool), grounded (bool). Integration at the fixed 1/60 step: gravity 620 px/s^2, air drag 0.995 per step on vx only, bounce restitution 0.42 vertical / 0.6 horizontal, spin damped 0.9 per bounce, and a rest threshold — when |vy| < 24 and grounded, set rest=true, snap ang to the nearest of the 8 baked angles, and STOP integrating it (a resting limb costs one blit and zero math). Resting debris does not expire on a timer; it is freed only when the pool is full and a new spawn needs a slot (evict the oldest resting one), so limbs stay lying on the floor for the whole 1-3 minute level, which is most of the power fantasy. Blood trail: while a debris is airborne and moving faster than 90 px/s, accumulate `trail += speed * dt` and every time trail crosses 14 px, emit one droplet particle AND stamp a small decal at the current position. That ties trail density to distance travelled, not to time, so a slow-tumbling arm does not machine-gun droplets. Spawn pattern on a kill: always spawn head + torso, then spawn each of the 4 limbs with probability based on kill force (0.55 for a normal tentacle kill, 1.0 for a big kill), so a normal kill leaves a mostly-intact but broken body and a big kill leaves six pieces — the variance is what stops it looking like a canned animation.

**Por que:** The rest-and-freeze rule is the single most important perf decision here: without it, 28 debris integrate forever and, worse, the visual gets worse rather than better (limbs jitter on the floor). With it, steady state after a big fight is ~20 frozen blits and 4-6 live simulations. Evicting the oldest resting debris rather than timing them out means the floor stays covered while never exceeding the cap. Distance-based trail emission is the standard fix for the 'fast object emits the same particles as a slow one' artefact and costs one multiply-add per debris per step. Restitution 0.42 vertical is deliberately low and heavy — meat does not bounce like a ball, and the asymmetry with 0.6 horizontal makes parts slide and skid, which reads as wet.

```js
const mkDebris = () => ({ x:0,y:0,vx:0,vy:0,ang:0,spin:0,part:0,life:0,trail:0,rest:false,_i:0 });
// en init(): this.debris = new Pool(28, mkDebris, null);

const GRAV = 620, REST_V = 24, BOUNCE_Y = 0.42, BOUNCE_X = 0.6;

function spawnDebris(S, x, y, part, vx, vy, spin) {
  let d = S.debris.spawn();
  if (!d) {                       // pool llena: desaloja el resto MAS viejo
    let best = -1, bl = Infinity;
    for (let i = 0; i < S.debris.n; i++) {
      const o = S.debris.items[i];
      if (o.rest && o.life < bl) { bl = o.life; best = i; }
    }
    if (best < 0) return null;    // nada en reposo: se descarta el nuevo
    S.debris.free(S.debris.items[best]);
    d = S.debris.spawn();
  }
  d.x = x; d.y = y; d.vx = vx; d.vy = vy;
  d.part = part; d.ang = S.rnd() * 6.283; d.spin = spin;
  d.life = S.t; d.trail = 0; d.rest = false;
  return d;
}

// Estalla un cientifico. force 0..1 -> 0 = corte limpio, 1 = revienta entero.
function gib(S, x, y, dirX, dirY, force) {
  const rnd = S.rnd;
  const base = 90 + force * 200;
  // cabeza y torso siempre
  spawnDebris(S, x, y - 4, 0, dirX * base * rnd.range(0.7,1.3) + rnd.range(-40,40),
              dirY * base * 0.8 - rnd.range(60,190), rnd.range(-11, 11));
  spawnDebris(S, x, y, 1, dirX * base * 0.6 + rnd.range(-30,30),
              -rnd.range(30,120), rnd.range(-5, 5));
  const pLimb = 0.55 + force * 0.45;
  for (let k = 2; k < 6; k++) {
    if (!rnd.chance(pLimb)) continue;
    const sx = (k & 1) ? -1 : 1;
    spawnDebris(S, x + sx * 3, y + (k > 3 ? 4 : -1), k,
                dirX * base * rnd.range(0.5,1.1) + sx * rnd.range(20,90),
                -rnd.range(40, 210), rnd.range(-14, 14));
  }
  arterialSpray(S, x, y - 2, dirX, dirY, force);
}

function updateDebris(S, dt) {
  const D = S.debris;
  for (let i = D.n - 1; i >= 0; i--) {
    const d = D.items[i];
    if (d.rest) continue;                    // congelado: coste cero
    d.vy += GRAV * dt;
    d.vx *= 0.995;
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.ang += d.spin * dt;

    // rastro de sangre por DISTANCIA, no por tiempo
    const sp = Math.abs(d.vx) + Math.abs(d.vy);   // manhattan: sin sqrt
    if (sp > 90) {
      d.trail += sp * dt;
      if (d.trail > 14) {
        d.trail = 0;
        stampDecal(S, d.x, d.y, 0, S.rnd);       // 0 = gota pequena
        dropletP(S, d.x, d.y, -d.vx * 0.12, -d.vy * 0.12);
      }
    }

    // suelo / paredes contra el tilemap
    if (solidAt(S, d.x, d.y + 3)) {
      d.y = ((d.y / TILE) | 0) * TILE + (TILE - 3);
      if (d.vy > REST_V) {
        d.vy = -d.vy * BOUNCE_Y; d.vx *= BOUNCE_X; d.spin *= 0.9;
        if (Math.abs(d.vy) > 70) { stampDecal(S, d.x, d.y + 2, 1, S.rnd); SFX.squelchSmall(); }
      } else {
        d.vy = 0; d.vx *= 0.7;
        if (Math.abs(d.vx) < 8) {
          d.rest = true; d.vx = 0;
          d.ang = Math.round(d.ang / (Math.PI/4)) * (Math.PI/4);
          stampDecal(S, d.x, d.y + 2, 2, S.rnd);   // charco al asentarse
        }
      }
    }
    if (solidAt(S, d.x + (d.vx>0?3:-3), d.y)) { d.vx = -d.vx * BOUNCE_X; d.spin *= 0.8; stampDecal(S, d.x, d.y, 3, S.rnd); }
  }
}

function drawDebris(S, g) {
  const D = S.debris;
  for (let i = 0; i < D.n; i++) {
    const d = D.items[i];
    // 8 pasos: indice = round(ang / (PI/4)) & 7. Sin rotate(), sin save().
    const a = (Math.round(d.ang * 1.2732395) & 7);   // 1/(PI/4) = 1.27324
    const s = PART[d.part][a];
    g.drawImage(s, (d.x - s.width * 0.5) | 0, (d.y - s.height * 0.5) | 0);
  }
}
```

## The gore layer: one persistent offscreen canvas, ONE drawImage per frame

**Recomendacion:** Create ONE offscreen canvas the size of the whole level in virtual pixels, not the size of the screen. For a 1-3 minute escape level, size the level at 360 wide x 2400 tall (three screens of vertical scroll) or 720x1600 for a wider level — either is 864,000 px = 3.30 MB of RGBA texture. That is the correct tradeoff and it dissolves the scrolling/smearing problem entirely: because the layer is in WORLD space, not screen space, the camera never moves the layer's contents, so there is nothing to smear. Each frame you do exactly one `g.drawImage(gore, camX, camY, VW, VH, 0, 0, VW, VH)` — a source-rect blit that copies the visible window. Decals are stamped once, in world coordinates, with a `gc.drawImage(splatSprite, wx, wy)` into the layer, and then cost literally nothing forever after. Never clear the layer during a level; clear it once in init() with `gc.clearRect(0,0,W,H)`. The alternative — a screen-sized layer that you scroll with a self-blit — is what causes smearing (each self-copy resamples and drifts by the sub-pixel remainder), and it also forces you to re-stamp decals that scroll back into view. Do not do it. If a level ever needs to be bigger than ~1.5 M px, tile the layer into 360x800 chunks in a small array and blit the 1-4 visible chunks; but at these level sizes one canvas is simpler and cheaper. Critical WebView detail: create the gore canvas with `getContext('2d', { alpha: true })` — it MUST be transparent so the floor tiles show through — and never read pixels back from it (no getImageData), which would force a GPU->CPU readback and destroy the frame.

**Por que:** This is the crux question and world-space is the answer that makes both the perf and the correctness fall out for free. Screen-space scrolling layers are the classic mistake: they require a self-blit every frame (a full-layer read+write, 288,000 px of texture-to-itself copy at 360x800, which Adreno drivers often can't do in place and resolve via a temp allocation), they smear because the camera offset is fractional, and decals outside the window are lost forever. World-space costs one static texture allocation at level start and reduces the per-frame work to a single sub-rect blit — the same cost as drawing one full-screen background. The memory numbers were computed directly: 360x2400x4 bytes = 3.30 MB, against 4 GB of RAM, is nothing; even a 720x2400 level is 6.59 MB. The no-readback rule matters more than it looks: a single getImageData on a GPU-backed canvas in Android WebView can cost 5-15 ms and will blow the frame on its own.

```js
// ---------- Capa de gore: world-space, persistente, un solo blit por frame ----------
// Se crea UNA vez por nivel en init(). Nunca se limpia durante la partida.
function makeGoreLayer(W, H) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { alpha: true });
  c.imageSmoothingEnabled = false;
  return { cv, c, W, H };
}
// en init():  this.gore = makeGoreLayer(this.levelW, this.levelH);
// 360 x 2400 = 864,000 px = 3.30 MB RGBA. 720x2400 = 6.59 MB.

// Estampar: una sola vez, en coordenadas de MUNDO. Despues cuesta cero.
function stampDecal(S, wx, wy, kind, rnd) {
  const gc = S.gore.c;
  const set = SPLAT[kind];                 // array de canvases pre-horneados
  const s = set[(rnd() * set.length) | 0];
  const x = (wx - s.width * 0.5) | 0, y = (wy - s.height * 0.5) | 0;
  if (x < -s.width || y < -s.height || x > S.gore.W || y > S.gore.H) return;
  gc.drawImage(s, x, y);
  S.decalCount++;
}

// Dibujo: UN drawImage. La camara solo mueve la ventana de origen.
function drawGore(S, g) {
  const sx = S.cam.x | 0, sy = S.cam.y | 0;   // entero: cero smearing, cero resample
  g.drawImage(S.gore.cv, sx, sy, VW, VH, 0, 0, VW, VH);
}

// NUNCA: getImageData sobre la capa (readback GPU->CPU, 5-15ms en WebView).
// NUNCA: auto-blit para desplazarla (eso SI produce smearing y drift subpixel).
```

## Splat variety: 4 kinds x 6 shapes, pre-baked, plus rotation and 2-tone tint

**Recomendacion:** Pre-bake 4 KINDS of splat, 6 variants each, at boot: kind 0 = droplet (3x3, 4 variants used for trails), kind 1 = impact splat (7x7, directional star), kind 2 = pool (11x9, blobby, used when a part comes to rest and when a body drops), kind 3 = wall smear (5x9, elongated vertically, used on wall hits). Bake each variant at 4 rotations for kinds 1 and 3 (kind 0 is too small to matter, kind 2 is round enough) = 4+24+6+24 = 58 tiny canvases, roughly 2,400 px of boot work. Add non-baked variance at stamp time by picking one of 3 tint variants per shape (fresh #b81322, mid #8e0f1c, deep #5c0a14) — bake each shape in all 3 tints rather than using globalAlpha or a composite mode, because per-stamp state changes cost more than the blit. That gives 58 x 3 = 174 canvases, ~7,200 px baked, still trivial. Pooling: when 3 or more decals of kind 2 land within 10 px of each other in the same floor tile, stamp ONE larger pool sprite (17x13) instead — track this with a coarse `poolGrid` Int8Array indexed by tile, incremented on each kind-2 stamp; at count 3 stamp the big pool and set the cell to -1 so it never upgrades again. That is how a floor reads as 'a lot of blood was spilled here' rather than 'six identical circles'. Wall drips: keep a tiny separate pool, `drips = new Pool(12, mkDrip, null)`, spawned when a stamp lands on a wall tile; each drip has x, y, len, speed (12-28 px/s), maxLen (6-22 px). Each frame a live drip stamps a 1x2 rect of dark red into the gore layer at its leading edge and advances — so the drip PAINTS ITSELF INTO the persistent layer as it runs, then frees itself when len >= maxLen. Cost: at most 12 one-pixel-wide stamps per frame, and once finished they are permanent at zero cost.

**Por que:** Repetition in gore reads as cheapness faster than almost any other art failure, because the eye is unusually good at spotting a repeated organic shape. The four fixes stack multiplicatively: 6 shapes x 4 rotations x 3 tints = 72 distinct appearances per kind, which is far past the point where a player can spot a repeat. The pooling rule is the one that produces the emergent 'crime scene' look — without it, ten kills in one room give ten separate circles; with it, they merge into large dark areas with individual splatter at the edges. The self-stamping drip is the key trick: it is an animated effect that leaves a permanent result, and because each frame's contribution is a 1x2 rect, twelve simultaneous drips cost 24 pixels of fill per frame.

```js
// SPLAT[kind] = array de canvases (todas las variantes x rotaciones x tintes)
const SPL_DROP = [['.1.','111','.1.'], ['11.','111','.1.'], ['.1.','11.','.11'], ['11.','.1.','...']];
const SPL_HIT = [
  ['..1....','.111..1','1111111','.11111.','1.111.1','..111..','...1...'],
  ['.1...1.','..111..','1111111','.11111.','..111.1','.1..1..','1......'],
  // ...6 en total, asimetricas a proposito
];
const SPL_POOL = [['..11111..','.1111111.','111111111','111111111','.1111111.','..11111..','...111...'], /*...*/];
const SPL_SMEAR = [['.1.','111','111','.11','.11','.1.','.1.','.1.','..1'], /*...*/];

const TINTS = [P.bFresh, P.bMid, P.bDeep];   // 3 tintes por forma
let SPLAT;

function bakeSplats() {
  const mk = (rows, rots) => {
    const out = [];
    for (const tint of TINTS) {
      const base = bake(rows, { '1': tint }, 1);
      if (rots === 1) { out.push(base); continue; }
      const R = bakeRot(base);              // 8 pasos; tomamos 4
      out.push(R[0], R[2], R[4], R[6]);
    }
    return out;
  };
  SPLAT = [[], [], [], []];
  for (const r of SPL_DROP)  SPLAT[0].push(...mk(r, 1));
  for (const r of SPL_HIT)   SPLAT[1].push(...mk(r, 4));
  for (const r of SPL_POOL)  SPLAT[2].push(...mk(r, 1));
  for (const r of SPL_SMEAR) SPLAT[3].push(...mk(r, 4));
}

// --- Encharcado: 3 manchas juntas en el mismo tile se funden en una grande ---
// S.poolGrid = new Int8Array(tilesW * tilesH), en init()
function stampPool(S, wx, wy, rnd) {
  const ti = ((wy / TILE) | 0) * S.tilesW + ((wx / TILE) | 0);
  const n = S.poolGrid[ti];
  if (n === -1) { stampDecal(S, wx, wy, 2, rnd); return; }
  if (n >= 2) {
    S.poolGrid[ti] = -1;
    const s = BIG_POOL[(rnd() * BIG_POOL.length) | 0];
    S.gore.c.drawImage(s, (wx - s.width*0.5)|0, (wy - s.height*0.5)|0);
  } else {
    S.poolGrid[ti] = n + 1;
    stampDecal(S, wx, wy, 2, rnd);
  }
}

// --- Chorretones que bajan por la pared, pintandose EN la capa persistente ---
const mkDrip = () => ({ x:0, y:0, len:0, maxLen:0, spd:0, col:'#8e0f1c', _i:0 });
// en init(): this.drips = new Pool(12, mkDrip, null);

function spawnDrip(S, wx, wy, rnd) {
  const d = S.drips.spawn(); if (!d) return;
  d.x = wx | 0; d.y = wy | 0; d.len = 0;
  d.maxLen = rnd.range(6, 22); d.spd = rnd.range(12, 28);
  d.col = rnd.chance(0.5) ? P.bMid : P.bDeep;
}

function updateDrips(S, dt) {
  const gc = S.gore.c, D = S.drips;
  for (let i = D.n - 1; i >= 0; i--) {
    const d = D.items[i];
    const adv = d.spd * dt;
    d.len += adv;
    gc.fillStyle = d.col;
    gc.fillRect(d.x, (d.y + d.len) | 0, 1, 2);   // 2px por frame, permanente
    if (d.len >= d.maxLen || solidAt(S, d.x, d.y + d.len + 2) === 0) {
      gc.fillRect(d.x - 1, (d.y + d.len) | 0, 3, 2);   // gota gorda al final
      D.free(d);
    }
  }
}
```

## Arterial spray: directional cone, high velocity, decaying with a wound emitter

**Recomendacion:** Do not use the engine's `burst()` for arterial spray — burst() emits in a full 360-degree circle with uniform speed, which reads as an explosion, not a wound. Write a dedicated `arterialSpray()` that emits into a CONE: 30 degrees half-angle around the kill direction, speed 240-420 px/s (roughly 4x burst's default), life 0.35-0.7 s, gravity 700, size 2 for the leading particles and 1 for the tail. Split the emission into 3 pulses spaced 60 ms apart (a heartbeat) rather than one instantaneous puff — that alone is the difference between 'particle effect' and 'artery'. Use the shared `particles` pool via a thin wrapper so you inherit the engine's update/draw for free, but reserve headroom: the pool is 260 and shared, so cap a single spray at 26 particles across the 3 pulses. Every spray particle that reaches its end of life and is below a solid tile stamps a decal — but rather than tracking that per particle (which the shared pool cannot do, since it has no user fields), run a separate small `sprayP = new Pool(48, mkSprayP, null)` for the particles that MUST leave decals, and use the shared burst pool only for cosmetic short-lived mist that leaves nothing. That split keeps the decal-generating population bounded and known. Droplets with gravity are the same sprayP pool with lower speed (60-160) and higher spread (full circle), used when a tentacle merely wounds rather than kills.

**Por que:** burst() is the right tool for sparks and debris puffs and the wrong one for a directional wound, and the reason is that arterial pressure is fundamentally anisotropic — the cone plus the three-pulse rhythm carry almost all of the readability. The separate sprayP pool exists for one concrete reason: the shared `particles` pool is cleared by main.js's scene manager and its objects have no field for 'stamp a decal on death', so decal-generating particles need their own pool inside the module where the game controls the free() and can stamp at that moment. Capping sprayP at 48 also directly caps the decal generation rate, which is the actual perf variable — see the ceiling finding.

```js
const mkSprayP = () => ({ x:0,y:0,vx:0,vy:0,life:0,max:0,col:'#b81322',size:1,kind:1,_i:0 });
// en init(): this.sprayP = new Pool(48, mkSprayP, null);

// Chorro arterial: cono direccional, 3 pulsos (latido), alta velocidad.
function arterialSpray(S, x, y, dx, dy, force) {
  const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  const base = Math.atan2(dy, dx);
  S.sprayQueue.x = x; S.sprayQueue.y = y; S.sprayQueue.a = base;
  S.sprayQueue.force = force; S.sprayQueue.pulses = 3; S.sprayQueue.t = 0;
  emitPulse(S, x, y, base, force);           // primer pulso ya
}

function emitPulse(S, x, y, base, force) {
  const rnd = S.rnd;
  const cnt = 6 + (force * 4) | 0;
  for (let i = 0; i < cnt; i++) {
    const p = S.sprayP.spawn(); if (!p) return;
    const a = base + rnd.range(-0.52, 0.52);          // cono de +-30 grados
    const v = rnd.range(240, 420) * (0.6 + force * 0.4);
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - rnd.range(0, 60);
    p.max = p.life = rnd.range(0.35, 0.70);
    p.col = i < 2 ? P.bBright : (rnd.chance(0.6) ? P.bFresh : P.bMid);
    p.size = i < 3 ? 2 : 1;
    p.kind = 1;                                        // 1 = deja decal al morir
  }
}

// El latido: 3 pulsos a 60 ms. Se avanza en update(), sin setTimeout.
function updateSprayQueue(S, dt) {
  const q = S.sprayQueue;
  if (q.pulses <= 0) return;
  q.t += dt;
  if (q.t >= 0.06) {
    q.t = 0; q.pulses--;
    if (q.pulses > 0) emitPulse(S, q.x, q.y, q.a, q.force * 0.7);
  }
}

function updateSpray(S, dt) {
  const SP = S.sprayP, rnd = S.rnd;
  for (let i = SP.n - 1; i >= 0; i--) {
    const p = SP.items[i];
    p.life -= dt;
    p.vy += 700 * dt;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (solidAt(S, nx, ny)) {
      // impacto: mancha direccional; si es pared, ademas nace un chorreton
      const wall = solidAt(S, nx, p.y);
      stampDecal(S, nx, ny, wall ? 3 : 1, rnd);
      if (wall && rnd.chance(0.35)) spawnDrip(S, nx, ny, rnd);
      else if (!wall && rnd.chance(0.5)) stampPool(S, nx, ny, rnd);
      SP.free(p); continue;
    }
    p.x = nx; p.y = ny;
    if (p.life <= 0) { stampDecal(S, p.x, p.y, 0, rnd); SP.free(p); }
  }
}

function drawSpray(S, g) {
  const SP = S.sprayP, cx = S.cam.x, cy = S.cam.y;
  for (let i = 0; i < SP.n; i++) {
    const p = SP.items[i];
    g.fillStyle = p.col;
    g.fillRect((p.x - cx) | 0, (p.y - cy) | 0, p.size, p.size);
  }
}
```

## Kill feel: hitstop, shake, slow-motion — implemented INSIDE update, because main.js's accumulator forbids the obvious approach

**Recomendacion:** Critical engine constraint discovered by reading main.js: the fixed-step loop calls `sm.cur.update(s, ctx)` inside a `while (acc >= STEP)` catch-up loop and then runs `updateParticles` and `cam.update` itself, outside the module. Therefore you CANNOT implement hitstop by returning early from your update — the accumulator will simply run the next step immediately, and you also cannot slow the engine's particle/camera update. Implement both effects as internal state inside SYMBIOTE's update: keep `S.freeze` (seconds of hitstop remaining) and `S.slowT`/`S.slowScale`. At the top of update: if `S.freeze > 0`, decrement it by dt, advance ONLY presentation state (screen flash timer, HUD), and return before touching physics. For slow-motion, compute `const sdt = dt * (S.slowT > 0 ? S.slowScale : 1)` and pass sdt to every physics/AI call — the engine still ticks at 60 Hz, your world just advances slower, which is exactly right and keeps input latency at 16.7 ms even during the slowdown. Exact values, tuned to be felt but not to interrupt: normal tentacle kill = 5 frames of hitstop (0.083 s), cam.shake(3.5, 0.16), no slow-motion, vibrate(28). Dismemberment kill (2+ limbs detached) = 8 frames (0.133 s), cam.shake(5.5, 0.24), slowScale 0.35 for 0.22 s, vibrate([0,40,30,60]). Big kill (a scientist killed while you are swinging above a certain speed, or 2+ kills within 0.4 s) = 11 frames (0.183 s), cam.shake(8, 0.34), slowScale 0.28 for 0.34 s, vibrate([0,50,40,90]). Player taking a bullet = 6 frames, cam.shake(6,0.2), vibrate(70), no slow-motion (slow-mo on damage feels like punishment). Never exceed 11 frames of hitstop — past ~180 ms the player reads it as a dropped frame rather than as impact, and on a 1-3 minute level with dozens of kills the accumulated freeze becomes noticeable dead time.

**Por que:** The freeze-inside-update pattern is forced by this specific engine and is the kind of thing that silently produces a game that stutters instead of punching. The frame counts come from the standard action-game range (3-12 frames) placed against this game's kill frequency: SYMBIOTE will produce a kill every 2-4 seconds, so hitstop must sit at the short end or it dominates. Restricting slow-motion to dismemberment and multi-kills is what keeps it a reward rather than a tax — if every kill slowed time, the escape would stop feeling like an escape, which contradicts the stated design goal of tension and forward motion. Vibration patterns use the array form of navigator.vibrate, which input.js's vibrate() already passes straight through; a two-pulse pattern reads as 'tear' where a single pulse reads as 'tap'.

```js
// --- Estado en init() ---
// S.freeze = 0; S.slowT = 0; S.slowScale = 1; S.flash = 0;

const KILL = {
  normal: { freeze: 5/60,  shake: 3.5, shakeT: 0.16, slow: 0,    slowT: 0,    vib: 28 },
  gib:    { freeze: 8/60,  shake: 5.5, shakeT: 0.24, slow: 0.35, slowT: 0.22, vib: [0,40,30,60] },
  big:    { freeze: 11/60, shake: 8.0, shakeT: 0.34, slow: 0.28, slowT: 0.34, vib: [0,50,40,90] },
  hurt:   { freeze: 6/60,  shake: 6.0, shakeT: 0.20, slow: 0,    slowT: 0,    vib: 70 },
};

function impact(S, kind) {
  const K = KILL[kind];
  if (K.freeze > S.freeze) S.freeze = K.freeze;
  cam.shake(K.shake, K.shakeT);
  if (K.slowT > 0 && K.slowT > S.slowT) { S.slowT = K.slowT; S.slowScale = K.slow; }
  vibrate(K.vib);
  S.flash = kind === 'hurt' ? 0.07 : 0.045;
}

// --- update: el freeze NO puede hacerse saliendo del bucle de main.js ---
function update(dt, ctx) {
  const S = this;
  S.t += dt;
  if (S.flash > 0) S.flash -= dt;

  if (S.freeze > 0) {              // hitstop: solo presentacion, cero fisica
    S.freeze -= dt;
    return;                        // main.js seguira llamando cada 1/60; correcto
  }

  let sdt = dt;
  if (S.slowT > 0) { S.slowT -= dt; sdt = dt * S.slowScale; }

  // TODO lo demas usa sdt, nunca dt
  updatePlayer(S, sdt);
  updateTentacle(S, sdt);
  updateEnemies(S, sdt);
  updateDebris(S, sdt);
  updateSpray(S, sdt);
  updateSprayQueue(S, sdt);
  updateDrips(S, sdt);
  updateCamera(S, sdt);
}

// Nota: main.js llama updateParticles(s) y cam.update(s) FUERA del modulo,
// asi que las particulas compartidas de burst() no se ralentizan ni se congelan.
// Por eso el gore que DEBE respetar el hitstop vive en sprayP/debris (propios),
// y burst() se reserva para chispas y polvo, donde no se nota.
```

## Gore audio: three synthesized layers (squelch, crunch, snap) with exact Web Audio parameters

**Recomendacion:** The existing sfx() helper supports exactly what is needed: noise with a lowpass sweep (f0->f1), pulse/saw/tri oscillators with a frequency sweep, dur and vol. Build the gore sounds as LAYERED calls, staggered by a few milliseconds, because a single source cannot be both wet and sharp. Exact presets, to be added to the SFX object: SQUELCH (wet tear, the primary kill sound) = noise f0 900 -> f1 140, dur 0.22, vol 0.42, layered 12 ms later with saw f0 190 -> f1 55, dur 0.18, vol 0.20 — the low saw sweep is the 'body' and is what makes it read as flesh rather than as static. CRUNCH (bone, on dismemberment) = noise f0 3200 -> f1 260, dur 0.09, vol 0.5, layered immediately with pulse duty 0.125 f0 140 -> f1 60, dur 0.07, vol 0.30. SNAP (tendon, on a limb detaching) = pulse duty 0.125, f0 1400 -> f1 300, dur 0.045, vol 0.30 — very short, very bright, this is the sound that sells separation. SPLAT (debris hitting a wall/floor at speed) = noise f0 600 -> f1 90, dur 0.13, vol 0.30. DRIP (occasional, ambient, from the drip system) = tri f0 800 -> f1 400, dur 0.06, vol 0.10. A full dismemberment kill fires SQUELCH + CRUNCH + SNAP, which is 5 oscillator/buffer nodes. That matters because audio.js has MAX_VOICES = 12 and silently drops anything past it: a 3-scientist chain kill would fire 15 nodes and lose sounds unpredictably. Fix it with a per-sound-type cooldown in the game module — track `S.sfxCool.squelch` etc., and refuse to re-fire a given gore sound within 70 ms, which both stays under the voice cap and prevents the phasing mush that identical simultaneous noise bursts produce. Do NOT use setTimeout for the 12 ms layer stagger; the existing SFX presets use setTimeout and it is fine for menu sounds, but for combat use a `delayed` micro-queue advanced in update() so the layers stay locked to the hitstop.

**Por que:** Squelch, crunch and snap are three physically different events and each maps cleanly onto one of the engine's three synthesis primitives — wet tissue is filtered noise sweeping DOWN (energy moving from high to low as the tear opens), bone is a bright noise transient with a low pulse thump, and tendon separation is a fast high-to-mid pulse chirp. The layering with a ~12 ms offset is what the ear reads as one complex event rather than two sounds. The voice-cap collision is a real, discovered constraint from audio.js: MAX_VOICES=12 with a silent early return means the failure mode is 'some kills sound wrong sometimes', which is exactly the kind of bug that never gets diagnosed. The 70 ms per-type cooldown also happens to match the perceptual fusion window, so it improves the sound while fixing the budget.

```js
// --- Anadir a audio.js, junto a los presets existentes ---
export const GORE = {
  squelch: () => {
    sfx({ type:'noise', f0:900,  f1:140, dur:0.22, vol:0.42 });
    sfx({ type:'saw',   f0:190,  f1:55,  dur:0.18, vol:0.20 });
  },
  crunch: () => {
    sfx({ type:'noise', f0:3200, f1:260, dur:0.09, vol:0.50 });
    sfx({ type:'pulse', duty:0.125, f0:140, f1:60, dur:0.07, vol:0.30 });
  },
  snap:    () => sfx({ type:'pulse', duty:0.125, f0:1400, f1:300, dur:0.045, vol:0.30 }),
  splat:   () => sfx({ type:'noise', f0:600,  f1:90,  dur:0.13, vol:0.30 }),
  drip:    () => sfx({ type:'tri',   f0:800,  f1:400, dur:0.06, vol:0.10 }),
  alarm2:  () => sfx({ type:'saw',   f0:330,  f1:520, dur:0.30, vol:0.26 }),
};

// --- En el modulo: cooldown por tipo. audio.js corta en 12 voces EN SILENCIO. ---
// en init(): S.sfxCool = { squelch:0, crunch:0, snap:0, splat:0 };
function goreSfx(S, name) {
  if (S.sfxCool[name] > 0) return;
  S.sfxCool[name] = 0.07;              // 70 ms: bajo el tope de voces y evita el faseo
  GORE[name]();
}
function updateSfxCool(S, dt) {
  const c = S.sfxCool;
  for (const k in c) if (c[k] > 0) c[k] -= dt;
}

// Muerte con desmembramiento = 3 llamadas, 5 nodos. Con cooldown nunca pasa de ~8.
function onKill(S, e, kind) {
  goreSfx(S, 'squelch');
  if (kind !== 'normal') { goreSfx(S, 'crunch'); goreSfx(S, 'snap'); }
  impact(S, kind);
}
```

## Gore palette: 7 reds on a two-value strategy so blood reads on both white tile and black pipe

**Recomendacion:** The hard problem is that one red cannot read against both a bright clinical floor (#e8ecf0) and a dark pipe interior (#0d1014) — against white it needs to be dark, against black it needs to be bright. Solve it with a fixed 7-step red ramp plus a rule: every decal shape is baked with a 1px lighter rim on its upper-left and its body in the mid tone, so the shape carries BOTH a dark value and a bright value and therefore holds contrast against any background. Exact hex, the full gore ramp: bBright #ff3b4a (arterial highlight, leading spray particles only, ~5% of gore pixels — this is the one saturated near-orange red and it is what makes the whole palette read as violent), bFresh #e01228 (fresh blood, main spray and new decals), bMid #b81322 (the workhorse decal body), bDeep #8e0f1c (settled blood, pools), bDried #5c0a14 (old decals, drip tails, blood on the player), bShadow #33060e (1px drop shadow under pools on bright floors — this is what stops blood floating on a white tile), wound #c81e2d (the torn-edge pixel on body parts, deliberately slightly desaturated from bFresh so it reads as tissue not as liquid). Two support colours: bone #f2e9d8 (a single pixel of it in a crunch splat multiplies the perceived gore for almost no cost) and viscera #7a2b3f (a muted purple-red, 1-2 pixels in a torso splat, breaks the red monotony that makes gore read as mud). Against the bright lab floor, stamp decals at bMid/bDeep with the bShadow rim; against dark pipe interiors, stamp at bFresh/bBright with no shadow and add a bDried edge. Select which at stamp time from the tile type, which you already know from solidAt — one branch, no cost. Lab floor palette that this sits on: floor #e8ecf0, floor grout #c3ccd6, wall #9fb0c0, wall dark #6b7d8f, pipe interior #0d1014, pipe metal #2a3138, hazard yellow #f2c14e. The symbiote itself: body #2b0f3a, highlight #6a1f7a, tentacle #a3218f — deliberately violet so the player is the ONE non-red saturated thing on screen and never gets lost in the blood.

**Por que:** Mud is the specific failure mode of pixel-art gore and it has one cause: too many mid-value desaturated reds sitting at similar luminance. The 7-step ramp is built with wide luminance gaps (roughly 20 percent apart) precisely so that any two adjacent tones remain distinguishable at 3x upscale, and capping bBright at ~5% of pixels is what keeps the saturated red as an accent rather than a wash. The dual-value rim is the actual technical answer to the bright-floor/dark-pipe question and is cheaper than any runtime alternative (tinting, blend modes, a second layer) because it is baked into the sprite once. Making the symbiote violet is a readability decision disguised as an art one: in a screen that will be substantially red by the end of a level, a red player character becomes unfindable, and the player losing track of themselves is the fastest way to make a power fantasy feel bad.

```js
const P = {
  // --- Gore: rampa de 7 pasos, saltos de luminancia amplios (nada de barro) ---
  bBright:'#ff3b4a',  // brillo arterial. Solo puntas de chorro. ~5% de los pixeles.
  bFresh: '#e01228',  // sangre fresca, chorro principal, decals nuevos
  bMid:   '#b81322',  // cuerpo de la mancha, el tono de trabajo
  bDeep:  '#8e0f1c',  // sangre asentada, charcos
  bDried: '#5c0a14',  // seca, colas de chorreton, sangre sobre el simbionte
  bShadow:'#33060e',  // borde 1px bajo charcos en suelo claro: los ancla
  wound:  '#c81e2d',  // pixel de carne desgarrada en el borde de cada parte
  bone:   '#f2e9d8',  // 1 pixel en el crunch. Multiplica el gore percibido.
  visc:   '#7a2b3f',  // visceras: rompe la monotonia roja

  // --- Laboratorio: claro y clinico, para que la sangre GRITE ---
  floor:'#e8ecf0', grout:'#c3ccd6', wall:'#9fb0c0', wallDk:'#6b7d8f',
  pipe:'#0d1014', pipeMt:'#2a3138', hazard:'#f2c14e',

  // --- Cientificos ---
  coat:'#f4f7fa', coatSh:'#cdd6e0', skin:'#e8b48c', pants:'#3d4654', out:'#141820',
  // --- Simbionte: violeta. Lo UNICO saturado no-rojo. Nunca se pierde. ---
  body:'#2b0f3a', bodyHi:'#6a1f7a', tent:'#a3218f', eye:'#5cffd8',
};

// Doble valor en cada mancha: cuerpo en tono medio + reborde 1px mas claro,
// asi la forma contrasta CONTRA SUELO CLARO Y CONTRA TUBERIA OSCURA.
function bakeSplatDual(rows, body, rim, shadow) {
  const map = { '1': body, '2': rim, '3': shadow };
  return bake(rows, map, 1);
}
// SPL_POOL con reborde: '2' arriba-izquierda, '3' abajo-derecha
const SPL_POOL_D = [
  '..22222..',
  '.2111112.',
  '211111113',
  '211111113',
  '.1111113.',
  '..33333..',
];

// En el momento de estampar, el tipo de tile elige la variante:
function pickTint(S, wx, wy) {
  return isDarkTile(S, wx, wy) ? 0 : 1;   // 0 = variante brillante, 1 = oscura+sombra
}
```

## Performance ceiling: 28 debris, 48 spray + 260 shared particles, 12 drips, and NO cap on decals

**Recomendacion:** Exact caps, with the math. DEBRIS: 28. Each is one axis-aligned drawImage of a pre-rotated 6-9px canvas — the project's own research measured baked drawImage at 300 entities/frame as comfortable, so 28 is 9% of a proven budget; fill cost 28 x ~48 px = 1,344 px/frame, negligible. The binding constraint on debris is not draw but the solidAt tilemap probes: 3 probes per live debris per step, and with the rest-freeze rule only ~6 are live in steady state = 18 probes/step. SPRAY PARTICLES: 48 in the dedicated decal-generating pool. Each does 1 collision probe + integration per step and 1 fillRect to draw; at 48 that is 48 probes and 48 fillRects, and each death costs one decal stamp. SHARED PARTICLES: the engine pool is 260 and shared; reserve at most 120 for SYMBIOTE cosmetic use so the budget is never exhausted mid-fight. DRIPS: 12, each stamping one 1x2 fillRect into the layer per frame = 24 px/frame. DECALS: NO CAP AT ALL — this is the key result of the world-space-layer design. A decal costs one drawImage at stamp time and then exactly zero forever, because it is baked into a texture that is blitted once regardless of how many decals it contains. 500 decals and 5 decals cost identically at draw time. The only bounded resource is the layer's memory (3.30 MB at 360x2400) which is fixed at level start. The one real limit is the STAMP RATE, not the count: a decal stamp is a small drawImage on a GPU-backed canvas and the driver may flush; cap stamps at 40 per frame with a simple counter reset each frame, dropping the excess. Worst case actually reachable: a 3-scientist chain kill = 3 x 6 debris (18) + 3 x 26 spray (78, clamps at 48) + a burst of ~30 cosmetic particles, and stamping peaks around 25 in the heaviest frame — under the 40 cap. Full-frame fill budget verified by direct computation at 360x800: clear 288,000 + gore blit 288,000 + baked tilemap blit 288,000 + 24 debris 1,152 + 150 particles 600 + 12 scientists 1,680 + player/tentacle 600 + HUD 4,000 = 872,032 px/frame = 3.03x overdraw = 52.3 Mpx/s at 60fps. The project's own research measured the Adreno 612 as 'never the bottleneck at 9.8 Mpx/s' for the existing games; 52.3 Mpx/s is 5.3x that but still roughly 15% of the ~350 Mpx/s that a native-resolution scene was estimated at, and the three full-screen blits are the dominant term — meaning the entire gore system (debris + particles + stamps) accounts for under 1% of the frame's fill. The gore system is not the perf risk; the third full-screen layer is, and it is affordable.

**Por que:** The numbers were computed directly rather than estimated, and they invert the intuitive worry: the fear with a gore system is 'hundreds of decals will kill the frame', but the world-space-layer design makes decal count a free variable and moves the entire cost onto one extra full-screen blit that is paid whether there is one decal or ten thousand. That is why the caps that matter are on the LIVE simulated things (debris, spray) and the stamp RATE, not on the persistent result. The 3.03x overdraw figure is the honest headline: three full-screen passes (clear, tilemap, gore) plus small stuff. It is worth checking on device by temporarily disabling the gore blit and confirming the frame time delta is roughly 1/3 of the fill portion; if the Adreno's fill for a transparent-source blit turns out worse than expected, the fallback is to skip the clear entirely (the tilemap blit is opaque and covers the screen, so clearRect is redundant) which immediately recovers 288,000 px/frame and brings overdraw to 2.03x.

```js
// --- Topes, con su justificacion numerica ---
const CAP_DEBRIS  = 28;   // 28 blits ~48px = 1,344 px/frame; ~6 vivos en regimen
const CAP_SPRAY   = 48;   // 48 sondas + 48 fillRect por paso
const CAP_DRIPS   = 12;   // 12 fillRect 1x2 = 24 px/frame, y son permanentes
const CAP_STAMPS  = 40;   // por FRAME. Los decals no tienen tope; el ritmo si.
// Particulas compartidas: el pool del motor es 260 y es COMPARTIDO.
// Reservar <=120 para gore cosmetico deja margen para el resto del juego.

// en init():
//   this.debris  = new Pool(CAP_DEBRIS, mkDebris, null);
//   this.sprayP  = new Pool(CAP_SPRAY,  mkSprayP, null);
//   this.drips   = new Pool(CAP_DRIPS,  mkDrip,   null);
//   this.stampBudget = CAP_STAMPS;

// Al principio de cada update, antes de todo:
function resetFrameBudget(S) { S.stampBudget = CAP_STAMPS; }

// stampDecal respeta el presupuesto. Perder una mancha es invisible;
// un pico de 80 drawImage sobre una textura GPU no lo es.
function stampDecal(S, wx, wy, kind, rnd) {
  if (S.stampBudget <= 0) return;
  S.stampBudget--;
  const set = SPLAT[kind];
  const s = set[(rnd() * set.length) | 0];
  const x = (wx - s.width * 0.5) | 0, y = (wy - s.height * 0.5) | 0;
  if (x < -s.width || y < -s.height || x > S.gore.W || y > S.gore.H) return;
  S.gore.c.drawImage(s, x, y);
}

// Presupuesto de relleno verificado a 360x800 (px por frame):
//   clear            288,000
//   capa de gore     288,000   <- UN drawImage, independiente del num. de decals
//   tilemap horneado 288,000
//   28 debris          1,344
//   150 particulas       600
//   12 cientificos     1,680
//   jugador+tentaculo    600
//   HUD                4,000
//   TOTAL            872,224 px/frame = 3.03x overdraw = 52.3 Mpx/s
// Todo el sistema de gore (debris+particulas+estampado) < 1% del frame.
//
// Si hiciera falta margen: eliminar el clear. El tilemap es OPACO y cubre
// la pantalla entera -> el clearRect es redundante. Recupera 288,000 px/frame
// y baja el overdraw a 2.03x.
```

## Blood on the symbiote and the tentacle: the feedback loop that sells the power fantasy

**Recomendacion:** Track `S.bloodiness` (0..1), incremented by 0.16 per kill and 0.05 per limb detached, decayed by 0.02/s. Bake the symbiote's body sprite in 4 bloodiness tiers at boot (clean, light, heavy, drenched) where each successive tier replaces more of the violet body pixels with bDried #5c0a14 and bDeep #8e0f1c — 4 tiers x 4 animation frames x 2 facings = 32 canvases, still trivial to bake. Select the tier at draw time with `(S.bloodiness * 3.99) | 0`, which is one integer op per frame, zero extra draw calls. Additionally, when the tentacle is attached and swinging with the tip inside a blood pool, set a `tentWet` timer of 1.2 s during which the tentacle's drawn colour is bMid instead of tent-violet and it stamps a small decal every 18 px of tip travel — so swinging through a room you just massacred SMEARS the blood around. That single mechanic does more for the power fantasy than any additional particle, because it makes the gore into something the player physically interacts with rather than something that happens at them. Decay to clean over ~50 seconds so a player who avoids fighting for a while visually resets, which makes the next kill land harder.

**Por que:** Everything else in this spec is gore that happens TO the world; this is the part that puts it on the player, and it is the difference between a game with a gore system and a game where the player feels like a monster. The tiered-baking approach costs nothing at runtime — the alternative (runtime tinting, a blood overlay sprite, per-pixel work) would all cost per-frame time for an identical result. The smearing tentacle is the one place where the persistent decal layer becomes a gameplay surface rather than a backdrop, and it comes almost free since the stamping machinery already exists.

```js
// en init(): S.bloodiness = 0; S.tentWet = 0; S.tentTrail = 0;

function addBlood(S, amount) {
  S.bloodiness = Math.min(1, S.bloodiness + amount);
}

function updateBloodiness(S, dt) {
  if (S.bloodiness > 0) S.bloodiness = Math.max(0, S.bloodiness - 0.02 * dt);
  if (S.tentWet > 0) S.tentWet -= dt;
}

// 4 niveles horneados. Seleccion = una operacion entera, cero draw calls extra.
function drawPlayer(S, g) {
  const tier = (S.bloodiness * 3.99) | 0;          // 0..3
  const s = BODY[tier][S.animFrame][S.facing];
  g.drawImage(s, (S.px - S.cam.x - s.width*0.5)|0, (S.py - S.cam.y - s.height*0.5)|0);
}

// La punta del tentaculo se moja al pasar por sangre y SIEMBRA la sala.
function updateTentacleSmear(S, dt, tipX, tipY, tipSpeed) {
  if (S.tentWet > 0 && tipSpeed > 40) {
    S.tentTrail += tipSpeed * dt;
    if (S.tentTrail > 18) { S.tentTrail = 0; stampDecal(S, tipX, tipY, 0, S.rnd); }
  }
}

// Color del tentaculo: violeta normal, rojo cuando esta empapado.
function tentColor(S) { return S.tentWet > 0 ? P.bMid : P.tent; }
```

## Pitfalls

- Do NOT implement hitstop by returning early from update() and expecting time to stop. main.js runs `while (acc >= STEP) { sm.cur.update(s, ctx); ... }` — the accumulator will immediately feed the next step. Hitstop MUST be an internal `S.freeze` counter that skips physics while still consuming its dt. Same for slow-motion: scale your own dt into an `sdt`, never try to slow the engine loop.
- Do NOT scroll a screen-sized gore layer by blitting it onto itself. This is the intuitive design and it is wrong three ways: the self-copy is a full-layer read+write every frame (288,000 px at 360x800, and Adreno drivers often resolve an in-place canvas copy through a temp allocation), the fractional camera offset resamples and produces visible smearing/drift within seconds, and any decal that scrolls off-screen is destroyed permanently. Use a world-space layer sized to the level and blit a source sub-rect.
- Do NOT call getImageData, toDataURL, or any readback on the gore layer, ever — not for a 'blood coverage' stat, not for collision. A single readback on a GPU-backed canvas in Android WebView costs 5-15 ms and will blow the frame. If you need to know how bloody an area is, track it in your own Int8Array poolGrid.
- Do NOT use ctx.rotate()/save()/restore() per debris to spin limbs. The project's own perf research explicitly warns that state changes cost more than the blits. Pre-bake 8 rotations per part at boot (48 canvases, ~1,440 px total) and blit axis-aligned.
- Do NOT store a pool index as a lasting reference anywhere in this system — the Pool uses swap-remove, so freeing one debris changes another's index. This bites hardest in the debris-eviction code: find the oldest resting debris by scanning, free it, and THEN spawn; never cache the index across the free().
- Do NOT let a scientist's death spawn debris via the shared `particles` pool. That pool is capacity 260, shared with every other effect, and main.js clears it on every scene change — and its objects have no field to carry 'stamp a decal when I die'. Decal-generating gore needs the module's own sprayP pool where the game controls free().
- Do NOT fire squelch+crunch+snap for every kill in a chain without a cooldown. audio.js has MAX_VOICES = 12 and returns SILENTLY when exceeded — a 3-kill chain fires 15 nodes and drops sounds unpredictably, which manifests as 'gore sometimes sounds wrong' and is nearly impossible to diagnose later. Use a 70 ms per-sound-type cooldown.
- Do NOT exceed ~11 frames (183 ms) of hitstop even on the biggest kill. Past that the player reads it as a dropped frame or a crash, not as impact — and on a 1-3 minute level with 20+ kills the accumulated freeze becomes measurable dead time in a game whose whole premise is escaping.
- Do NOT bump the virtual resolution to 540x1200. It quadruples the gore layer memory (2.47 MB/screen vs 1.10) and the per-decal stamp cost for detail that is invisible at arm's length on a 6.43-inch phone. 360x800 is 20:9 exact AND an exact 3.0x integer upscale to 1080x2400.
- Do NOT make the symbiote or the tentacle red. By the end of a level a large fraction of the screen is red decals; a red player becomes unfindable during a swing, and losing track of yourself is the fastest way to break a power fantasy. Keep the player violet (#2b0f3a / #a3218f) as the only saturated non-red element.
- Do NOT stamp decals unbudgeted. The count is free (one blit regardless) but the RATE is not — a chain kill can try to stamp 80 small drawImages in one frame and cause a driver flush. Cap at 40 stamps/frame with a counter reset at the top of update; dropped stamps are invisible.
- Do NOT give resting debris an expiry timer. Limbs lying on the floor are most of the payoff and cost one blit each with zero simulation once frozen. Free them only under pool pressure, evicting the oldest resting one.
- Do NOT use burst() for arterial spray. It emits in a uniform 360-degree circle, which reads as an explosion. Arterial blood needs a ~60-degree cone, 4x the speed, and three pulses 60 ms apart.
- Do NOT forget that main.js calls updateParticles() and cam.update() OUTSIDE the game module — shared burst() particles will keep moving during your hitstop and will not slow down during slow-motion. Restrict burst() to sparks and dust where the desync is invisible; anything that must respect hitstop belongs in the module's own pools.
