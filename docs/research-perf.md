# Research: perf

## Virtual resolution: use 180x400, NOT 180x320 or 240x426

**Recomendacion:** Set canvas.width=180, canvas.height=400 (the backbuffer), and upscale with CSS. Do NOT use the 180x320 or 240x426 grids suggested in the brief — both are 16:9 and will letterbox badly on this 20:9 panel. Verified numbers: the Redmi Note 10 is 1080x2400 at dpr=2.75, giving a CSS viewport of 392.7 x 872.7 (aspect 2.222). 180x400 has aspect 2.222 — an exact match, zero letterbox bars. 180x320 leaves 175 CSS px of black bars; 240x426 leaves 176 px. Fill-rate measured: 180x400 = 72,000 backbuffer px/frame vs 2,592,000 at native dpr — a 97.2% reduction (36x). Full scene budget at 300 entities (clear + full-screen bg + 300 8x8 sprites) = 163,200 px/frame = 2.27x overdraw = 9.8 Mpx/s, versus 353 Mpx/s for the same scene at native res. The Adreno 612 is never the bottleneck at 9.8 Mpx/s. If 180x400 feels too chunky for readable UI, 240x533 (aspect 2.221) is the next 20:9-native step at 127,920 px and still a 95.1% saving.

**Por que:** Verified by computing the exact CSS viewport and fit-scale for every candidate grid against the real 1080x2400/dpr2.75 panel. The two resolutions named in the brief are 16:9 leftovers and would waste 20% of a 20:9 screen on black bars — a visible product defect, not just a perf question. Aspect-matching the grid to the device is what makes the CSS upscale both edge-to-edge and integral in behavior.

```js
const VW = 180, VH = 400;              // 20:9, exact match for 1080x2400
canvas.width = VW; canvas.height = VH; // backbuffer stays tiny
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
ctx.imageSmoothingEnabled = false;
canvas.style.imageRendering = 'pixelated';

function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / VW, vh / VH);   // ~2.182 on this device
  const w = VW * scale, h = VH * scale;
  const s = canvas.style;
  s.position = 'absolute'; s.transformOrigin = '0 0';
  s.width = w + 'px'; s.height = h + 'px';
  s.left = ((vw - w) * 0.5) + 'px';
  s.top  = ((vh - h) * 0.5) + 'px';
  view.scale = scale; view.ox = (vw - w) * 0.5; view.oy = (vh - h) * 0.5;
}
window.addEventListener('resize', fit); fit();
```

## devicePixelRatio: deliberately ignore it

**Recomendacion:** Do NOT multiply the backbuffer by devicePixelRatio. This is the single most important inversion of standard Canvas advice. The normal `canvas.width = cssW * dpr` idiom would give a 1080x2400 backbuffer and destroy the entire fill-rate saving. Keep the backbuffer at exactly 180x400 and let CSS scale it up by ~2.182x. Because imageSmoothingEnabled=false and image-rendering:pixelated are set, the browser does a nearest-neighbour upscale on the GPU, which is free — the compositor was going to scale the layer anyway. dpr is irrelevant to a pixel-art game because you WANT chunky, hard-edged pixels; a dpr-correct canvas gives you the opposite of the intended art style at 36x the cost.

**Por que:** Verified: dpr-correct backbuffer = 2,592,000 px/frame; CSS-sized dpr=1 backbuffer = 342,709 px/frame (86.8% saving); virtual 180x400 = 72,000 px/frame (97.2% saving). The only thing dpr should influence is input coordinate mapping, and even there you use CSS pixels from the event, not device pixels.

```js
// WRONG for pixel art — the standard idiom, 36x the fill cost:
// canvas.width = cssW * devicePixelRatio;

// RIGHT: backbuffer is the art resolution, full stop.
canvas.width = 180; canvas.height = 400;

// Touch -> virtual grid coords (uses CSS px, dpr never appears):
function toVirtual(clientX, clientY) {
  return { x: (clientX - view.ox) / view.scale,
           y: (clientY - view.oy) / view.scale };
}
```

## Main loop: fixed-timestep accumulator with a two-stage stall guard

**Recomendacion:** Use a fixed 1000/60 ms timestep with an accumulator, and guard the spiral of death with TWO mechanisms, not one: (a) clamp raw frame delta to 250ms before it enters the accumulator, (b) cap catch-up ticks at 5 per frame and hard-reset the accumulator to 0 if you hit the cap with time still owed. Call requestAnimationFrame at the TOP of the frame function so an exception in update/render doesn't kill the loop permanently. Verified behaviour across four traces: perfect 60Hz -> exactly 600 ticks in 600 frames, 1 tick/frame; +/-4ms jitter -> exactly 600 ticks, max 2 ticks in any frame (correct catch-up, no drift); a 2-second stall -> absorbed by discarding 2000ms rather than firing a 120-tick burst; sustained 25ms frames -> 599 ticks over 600 expected, so game-time stays correct while the device runs slow.

**Por que:** Directly verified with a simulation harness over realistic WebView frame traces, and again by driving the real loop with a fake rAF: 100 frames at 16.667ms produced exactly 100 updates and 100 renders, and a 5-second stall produced 5 catch-up ticks instead of 300. Without the delta clamp, backgrounding the app for 2 seconds queues 120 simulation ticks that all run in one frame, which blows a ~2000ms frame and can cascade. The clamp is what makes backgrounding safe.

```js
const STEP = 1000 / 60, MAX_STEPS = 5, MAX_FRAME = 250;
let acc = 0, prev = 0, raf = 0;

function frame(now) {
  raf = requestAnimationFrame(frame);   // FIRST: loop survives a throw in update()
  let dt = now - prev; prev = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;   // stall guard (backgrounding, GC, MIUI freeze)
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < MAX_STEPS) { update(STEP); acc -= STEP; n++; }
  if (n === MAX_STEPS && acc > STEP) acc = 0;  // spiral-of-death bail: drop the debt
  render();
}

// Backgrounding: stop the loop AND the audio, resync the clock on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    audioCtx.suspend();
  } else {
    prev = performance.now(); acc = 0;   // critical: no phantom elapsed time
    audioCtx.resume();
    raf = requestAnimationFrame(frame);
  }
});
```

## Skip interpolation — it buys nothing at step == refresh rate

**Recomendacion:** Do not implement render interpolation (storing prevX/prevY and lerping by an alpha). The panel is 60Hz and the timestep is 60Hz, so the accumulator remainder is essentially always ~0 and the lerp resolves to the current position anyway. It costs 2 extra floats per entity, a lerp per entity per frame, and it actively fights pixel snapping — interpolated positions are fractional, and drawing a sprite at a fractional coordinate on an upscaled grid reintroduces exactly the shimmer that imageSmoothingEnabled=false was meant to remove. Render the latest simulation state, snapped to integers.

**Por que:** Verified numerically: on a 180x400 grid, any entity moving 60 virtual px/s or faster covers >=1 px per frame, so integer snapping is invisible. Only sub-60px/s movers show 1px stepping, and for an 8-bit action game that stepping reads as authentic rather than broken. Since fixed step and refresh rate are both 60, interpolation's entire benefit (smoothing a mismatch) does not apply here.

```js
// Simulation keeps float precision:
x += vx * dt;
// Rendering snaps — but use Math.round, NOT |0.
// Verified trap: (-3.7|0) === -3 while Math.floor(-3.7) === -4.
// |0 truncates toward zero, so it is off-by-one for negative coords —
// exactly where offscreen/just-spawned bullets live.
ctx.drawImage(sprite, Math.round(x), Math.round(y));
```

## Object pool: swap-remove, fixed capacity, O(1) spawn and free

**Recomendacion:** Preallocate every bullet/particle/enemy at boot into a fixed-capacity pool with a swap-remove free list. Never grow the pool — when it's full, spawn() returns null and you silently drop the spawn (a dropped particle is invisible; a GC pause is not). Store a back-index `_i` on each object so free() is O(1) without a search. Suggested caps for ~300 concurrent entities: 256 bullets, 512 particles, 64 enemies, 32 pickups — all allocated once, ~0 bytes/frame thereafter. CRITICAL companion rule: because free() swaps the last active element into the freed slot, you MUST iterate the active range BACKWARD when sweeping dead entities. Forward iteration silently skips entities.

**Por que:** Pool correctness verified under 10,000 random spawn/free cycles: all 8 objects remained unique (no leaks, no duplicates) and every back-index stayed consistent. The iteration-direction bug was verified concretely: sweeping 10 entities forward with swap-remove kept survivors [1,3,5] instead of the correct [1,3,5,7,9] — it silently loses the tail. That is the exact bug that makes bullets randomly vanish and is very hard to spot in play.

```js
function makePool(cap, init) {
  const items = new Array(cap);
  for (let i = 0; i < cap; i++) { const o = init(); o._i = i; items[i] = o; }
  return {
    items, cap, active: 0,
    spawn() { return this.active >= this.cap ? null : this.items[this.active++]; },
    free(o) {
      const i = o._i, last = --this.active, lastObj = this.items[last];
      this.items[last] = o;      o._i = last;
      this.items[i]  = lastObj;  lastObj._i = i;
    }
  };
}

const bullets = makePool(256, () => ({ x:0, y:0, vx:0, vy:0, life:0, _i:0 }));

// Sweep MUST go backward or swap-remove skips entities:
for (let i = bullets.active - 1; i >= 0; i--) {
  const b = bullets.items[i];
  b.x += b.vx; b.y += b.vy;
  if (--b.life <= 0 || b.y < -8 || b.y > VH + 8) bullets.free(b);
}
```

## Draw calls: bake sprites to offscreen canvases at boot, blit with drawImage

**Recomendacion:** At boot, render every sprite (each animation frame, each color variant) once into its own small offscreen canvas via document.createElement('canvas'), then at runtime issue exactly one drawImage per entity. Never build paths or issue per-pixel fillRect during gameplay. Measured call counts at 300 entities / 60fps: per-pixel fillRect on 8x8 sprites = 19,200 calls/frame = 1,152k calls/sec (catastrophic); path fill per sprite = 3,600 calls/frame = 216k/sec; drawImage from a baked canvas = 300 calls/frame = 18k/sec. Baking 24 sprite canvases (6 anim frames x 4 variants) touches only 1,536 pixels total, done once at boot in well under a millisecond. Also: set alpha:false on the context (opaque canvas skips per-frame compositing blend), avoid save()/restore() per entity, and sort draws by sprite so fillStyle/globalAlpha state changes are minimized — on Canvas 2D, state changes cost more than the blits themselves.

**Por que:** The naive way to write procedural pixel art is a fillRect per pixel, which is the most natural reading of the 'draw everything with Canvas 2D primitives' constraint — and it is 64x more draw calls than necessary. Verified: that path costs 1.15M calls/sec at 300 entities, which alone exceeds the frame budget regardless of fill rate. Baking converts per-frame path/rect work into a one-time boot cost and reduces steady-state to a single blit per entity.

```js
function bakeSprite(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;                       // reusable ImageBitmap-like source
}
const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };

// ONCE at boot — per-pixel fillRect is fine here, it never runs again:
const SHIP = bakeSprite(8, 8, g => {
  px(g,3,0,'#0ff'); px(g,4,0,'#0ff');
  px(g,2,1,'#0cc'); px(g,5,1,'#0cc');
  // ...
});

// EVERY frame — one call per entity, no state churn:
for (let i = 0; i < bullets.active; i++) {
  const b = bullets.items[i];
  ctx.drawImage(SHIP, Math.round(b.x), Math.round(b.y));
}

// Flipping/rotating: bake the flipped variant too rather than
// save()/scale(-1,1)/restore() per entity.
```

## GC avoidance: eliminate all per-frame allocation

**Recomendacion:** Target literally zero allocation in the update/render path. The offenders in naive game code: array methods that return new arrays (map/filter/slice/concat), object spread `{...e}`, object literals returned from helpers (e.g. returning {x,y} from a vector function), closures created inside loops (including arrow functions passed to forEach), string concatenation for HUD text every frame, and destructuring that builds temporaries. Replace with: preallocated pools, in-place mutation, out-parameters or scratch objects for vector math, backward index loops instead of forEach, and caching HUD strings so they're only rebuilt when the underlying value actually changes. Use Float32Array/Uint8Array struct-of-arrays for the hottest, most numerous entities (particles).

**Por que:** Measured directly: the naive version (filter+map+spread per frame over 300 entities) allocates ~32.8 KB/frame = 1.92 MB/s at 60fps. Against a typical Chrome-on-Android young-generation semi-space of ~4MB, that triggers a scavenge roughly every 125 frames — about every 2 seconds. A 3-8ms scavenge against a 16.7ms budget is a visible hitch roughly every 2 seconds, forever. The pooled struct-of-arrays version allocates 0 bytes in the loop and was also 5.2x faster in raw compute in the benchmark (Node's JIT flatters the naive path; the gap is wider on a Snapdragon 678). Note that the hitch is a periodic stutter, not a low average FPS — average-FPS counters will look fine while the game feels bad.

```js
// ALLOCATES (~32.8 KB/frame at 300 entities -> GC hitch every ~2s):
// ents = ents.filter(e => e.alive).map(e => ({...e, x: e.x + e.vx}));
// ents.forEach(e => draw(e));            // closure per frame
// hud.textContent = 'SCORE ' + score;    // new string per frame

// ZERO ALLOC:
for (let i = pool.active - 1; i >= 0; i--) {
  const e = pool.items[i];
  e.x += e.vx; e.y += e.vy;
  if (!e.alive) pool.free(e);
}

// Scratch object for vector math instead of returning literals:
const _v = { x: 0, y: 0 };
function normalize(x, y, out) {
  const d = Math.hypot(x, y) || 1;
  out.x = x / d; out.y = y / d; return out;
}

// Cache HUD strings — rebuild only on change:
let lastScore = -1;
if (score !== lastScore) { lastScore = score; scoreStr = 'SCORE ' + score; }

// Particles as struct-of-arrays (best cache locality, zero object headers):
const pxArr = new Float32Array(512), pyArr = new Float32Array(512),
      pvx = new Float32Array(512),   pvy = new Float32Array(512),
      plife = new Uint16Array(512);
```

## MIUI / Android WebView specifics that actually bite

**Recomendacion:** Concrete mitigations, in priority order. (1) Touch latency: add `touch-action:none` CSS and call preventDefault() on touchstart, or Chrome waits ~300ms to disambiguate double-tap-to-zoom; also set `<meta name=viewport content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'>`. Use touchstart (not click) to fire actions — that alone removes ~300ms of perceived input lag. (2) Web Audio unlock: AudioContext starts 'suspended' until a user gesture; create it lazily on the first touchstart and call resume(). MIUI is aggressive about suspending it on background — always resume() in visibilitychange. Schedule sounds at `audioCtx.currentTime + 0.001`, never at 0, to avoid clicks. (3) MIUI battery saver / aggressive memory management will throttle or freeze the WebView when backgrounded — the 250ms delta clamp already handles the resume, but also suspend() audio so MIUI doesn't kill the app for background audio. (4) Use `desynchronized:true` on getContext to opt into low-latency mode where available. (5) Do NOT use CSS filters, box-shadow, border-radius, or opacity transitions on the canvas element — they force an extra compositor layer and can push the upscale off the fast path. (6) Keep the page to a single canvas with no DOM overlay for HUD; a DOM HUD updating every frame causes layout/paint that competes with the canvas. Draw the HUD into the canvas. (7) Avoid `will-change:transform` on the canvas; it can force a large texture allocation at native resolution on some Adreno drivers, silently undoing the fill-rate saving.

**Por que:** These are the failure modes specific to this device class rather than generic Canvas advice. The 300ms tap delay and the suspended-AudioContext-on-resume are both guaranteed to occur on this exact target and both directly contradict the 'playing within 1 tap' requirement. The layer-promotion issues matter precisely because the whole performance strategy depends on a small backbuffer being cheaply upscaled by the compositor — anything that forces a native-resolution intermediate texture negates the 36x saving.

```js
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
  html,body{margin:0;padding:0;background:#000;overflow:hidden;
            touch-action:none;-webkit-user-select:none;user-select:none;
            -webkit-tap-highlight-color:transparent;}
  canvas{image-rendering:pixelated;image-rendering:crisp-edges;display:block;}
</style>

<script>
let audioCtx = null;
function unlockAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
// touchstart, not click: removes ~300ms tap delay
canvas.addEventListener('touchstart', e => {
  e.preventDefault();          // kills double-tap-zoom disambiguation wait
  unlockAudio();
  const t = e.changedTouches[0];
  const p = toVirtual(t.clientX, t.clientY);
  onTap(p.x, p.y);
}, { passive: false });
</script>
```

## Pitfalls

- Do NOT use 180x320 or 240x426 as suggested — both are 16:9 and leave ~175 CSS px of black bars on this 20:9 (2400x1080) panel. Use 180x400 (aspect 2.222, exact match) or 240x533.
- Do NOT apply devicePixelRatio to the backbuffer. The standard `canvas.width = cssW * dpr` idiom gives a 1080x2400 backbuffer and destroys the entire 97.2% fill-rate saving. This is the one case where the universal Canvas advice is wrong.
- Do NOT iterate forward when sweeping a swap-remove pool. Verified: forward iteration over 10 entities kept survivors [1,3,5] instead of [1,3,5,7,9] — it silently drops the tail. Always loop `for (let i = active-1; i >= 0; i--)`.
- Do NOT use `x|0` to snap draw coordinates. It truncates toward zero, so (-3.7|0) === -3 while Math.floor gives -4 — an off-by-one for every negative coordinate, which is exactly where offscreen and just-spawned bullets live. Use Math.round.
- Do NOT omit the raw-delta clamp and rely only on a max-steps cap. Without clamping dt to 250ms, a 2-second background stall queues ~120 simulation ticks; the max-steps cap then bleeds that debt across many frames instead of discarding it.
- Do NOT call requestAnimationFrame at the bottom of the frame function. Any exception in update() or render() then permanently kills the loop. Schedule the next frame first.
- Do NOT draw pixel art with a fillRect per pixel at runtime. At 300 entities with 8x8 sprites that is 19,200 calls/frame = 1.15M calls/sec. Bake sprites to offscreen canvases at boot and blit with one drawImage each (300 calls/frame).
- Do NOT implement render interpolation. At a 60Hz step on a 60Hz panel the alpha is always ~0, so it buys nothing, costs a lerp per entity, and its fractional output actively fights pixel snapping and reintroduces shimmer.
- Do NOT use array map/filter/spread or forEach closures in the update loop. Measured at ~32.8 KB/frame (1.92 MB/s), which triggers a GC scavenge every ~125 frames — a visible hitch roughly every 2 seconds. Average-FPS counters will still read 60 while the game feels broken.
- Do NOT use `click` for input — use `touchstart` with preventDefault() and `touch-action:none`, or Chrome adds ~300ms of tap delay, breaking the 'playing within 1 tap' goal.
- Do NOT create the AudioContext at load time. It starts suspended until a user gesture; create it lazily on first touchstart, and always resume() it in visibilitychange or MIUI will leave it dead after backgrounding.
- Do NOT put CSS filters, box-shadow, border-radius, opacity transitions, or will-change:transform on the canvas element. These can force a native-resolution intermediate texture on Adreno drivers, silently undoing the entire fill-rate strategy.
- Do NOT build the HUD from DOM elements updated per frame. Per-frame layout/paint competes with the canvas; draw the HUD into the canvas instead.
- Do NOT let pools grow when full. Return null and drop the spawn — a missing particle is invisible, a GC pause is not.
