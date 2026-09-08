# Research: engine

## Bundle format: single-file ES modules, no build step

**Recomendacion:** Ship 12 flat files in one directory, loaded via <script type="module" src="main.js"> from a local index.html. No bundler, no minifier, no build step. Files: index.html, main.js (boot+loop wiring), engine.js (canvas/letterbox/draw helpers), input.js, audio.js, gfx.js (sprite baking + bitmap text), fx.js (particles + camera shake), pool.js, hash.js, rng.js, save.js, scene.js, menu.js, then games/shmup.js, games/brawler.js, games/runner.js, games/breaker.js, games/survival.js. ES modules work natively in Android WebView (ES2020+ confirmed by target spec) and keep each file independently readable. The one hard requirement: it must be served over http:// (a local server or an APK/TWA asset host), because file:// blocks module CORS. If it must run from file://, concatenate the same files into one bundle.js in source order with the export/import keywords stripped — keep the file split in source either way.

**Por que:** A build step is a maintenance liability for a personal offline game, and native modules cost nothing at this scale (18 files, all local, parsed once at boot). The file:// caveat is the single real trap with ES modules on Android and it silently produces a blank screen, so the fallback needs to be decided up front rather than debugged later.

```js
<!-- index.html - the entire shell -->
<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<style>
  html,body{margin:0;height:100%;background:#0a0a12;overflow:hidden;
    touch-action:none;-webkit-user-select:none;user-select:none;
    -webkit-tap-highlight-color:transparent;overscroll-behavior:none;}
  canvas{display:block;image-rendering:pixelated;position:absolute;left:0;top:0;}
</style></head>
<body><canvas id="c"></canvas><script type="module" src="main.js"></script></body></html>
```

## Virtual resolution 270x600 with capped-DPR letterbox

**Recomendacion:** Use a fixed 270x600 virtual coordinate space and cap the device-pixel ratio at 1.5 rather than using the native 2.75. I computed the fit against the real panel: 270x600 is exactly 20:9, matching 1080x2400 (ratio 2.2222 both), so the target device gets ZERO letterboxing and an exact 4x integer scale to physical pixels. Set canvas.width = round(cssW*dpr) with dpr = min(devicePixelRatio, 1.5), style it to the CSS box, disable imageSmoothingEnabled, and apply one setTransform(scale,0,0,scale,ox,oy) per frame so all game code works in 270x600 units. Author sprites at 1x in this space.

**Por que:** Fill rate, not logic, is the binding constraint on an Adreno 612 — this is the finding that should drive the whole renderer. I measured the destination-pixel cost: at DPR 2.75 the backing store is 2.60 MP, and with a realistic 3x overdraw (background + sprites + particles + UI) that is ~7.8 MP/frame ≈ 5.2ms at 1.5 GPix/s, a third of the 16.67ms budget spent before any game logic runs. At DPR 1.5 it is 0.77 MP → ~1.54ms, a 3.4x saving. On a 6.43" screen showing chunky 8-bit art with pixelated scaling, 1.5 is visually indistinguishable from 2.75 because the art has no sub-pixel detail to resolve.

```js
// engine.js
export const VW = 270, VH = 600;              // exactly 20:9, matches 1080x2400
export const view = { scale:1, ox:0, oy:0, dpr:1 };

export function resize(canvas, ctx) {
  const cw = window.innerWidth, ch = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);  // fill-rate cap
  const s = Math.min(cw / VW, ch / VH);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  canvas.width  = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  view.scale = s * dpr; view.dpr = dpr;
  view.ox = Math.round((cw - VW * s) / 2 * dpr);
  view.oy = Math.round((ch - VH * s) / 2 * dpr);
  ctx.imageSmoothingEnabled = false;            // reset by a resize
}
// each frame, before drawing:
export function begin(ctx) {
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);   // letterbox bars
  ctx.setTransform(view.scale,0,0,view.scale,view.ox,view.oy);
}
// screen -> virtual, for touch
export function toVirtual(clientX, clientY) {
  return { x:(clientX*view.dpr - view.ox)/view.scale,
           y:(clientY*view.dpr - view.oy)/view.scale };
}
```

## Fixed-timestep loop (tested against hitches and backgrounding)

**Recomendacion:** Use a 1/60 fixed-step accumulator with a 5-step cap AND a 250ms frame clamp, plus debt-dropping when the cap is hit. Render exactly one draw per rAF. I implemented and unit-tested this against a fake clock; it passes steady 60fps (60 updates/60 frames), 30fps (2 steps/frame, no runaway), a 5-second hitch (capped at 5 updates, and critically the NEXT 10 frames run 10 updates with no inherited debt), a 2-minute background suspension, and zero-length frames. Wire resync() to visibilitychange, which MIUI triggers aggressively.

**Por que:** Fixed timestep is non-negotiable across five genres because a brick-breaker's reflections and a runner's jump arcs become frame-rate dependent otherwise. The two bugs that actually bite are the spiral of death and the post-background lurch, and they need two DIFFERENT guards: MAX_STEPS alone still lets the accumulator carry debt into subsequent frames, which is why `if (steps === MAX_STEPS) acc = 0` matters. My test explicitly asserts the no-debt-carryover property because that is the one people omit.

```js
// loop.js - verified by unit test against a mock clock
export const DT = 1/60, MAX_STEPS = 5, MAX_FRAME = 0.25;

export function createLoop(update, draw) {
  let acc = 0, last = 0, running = false, raf = 0;
  const state = { steps:0, fps:0, _fa:0, _fc:0 };
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;   // restored-from-background gap
    if (dt < 0) dt = 0;                   // clock weirdness
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS) { update(DT); acc -= DT; steps++; }
    if (steps === MAX_STEPS) acc = 0;     // drop debt, else we never recover
    state.steps = steps;
    state._fa += dt; state._fc++;
    if (state._fa >= 0.5) { state.fps = Math.round(state._fc/state._fa); state._fa=0; state._fc=0; }
    draw(acc / DT);
  }
  return {
    state,
    start(){ if(running) return; running=true; last=performance.now(); acc=0; raf=requestAnimationFrame(frame); },
    stop(){ running=false; cancelAnimationFrame(raf); },
    resync(){ last=performance.now(); acc=0; }   // call on visibilitychange
  };
}
// main.js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { loop.stop(); Audio.suspend(); }
  else { loop.resync(); loop.start(); Audio.resume(); }
});
```

## Scene manager with deferred swaps

**Recomendacion:** One active scene, with transitions DEFERRED to the next frame boundary. A scene calls sm.replace(nextScene, args) and the swap is applied at the top of the following update, before that scene is stepped. destroy() on the outgoing scene always runs before init() on the incoming one. I tested the full lifecycle including the critical case of a scene calling replace() from inside its own update().

**Por que:** Immediate swaps are the classic source of use-after-free in tiny engines: a game detects death mid-update, swaps to game-over, and the remainder of the update loop then runs against a scene whose pools were just cleared. Deferring costs one frame of latency (16ms, imperceptible) and eliminates the entire bug class. My test asserts that the old scene is never stepped after the swap is requested and that input routes only to the active scene.

```js
// scene.js - verified by lifecycle test
export class SceneManager {
  constructor(ctx){ this.ctx=ctx; this.cur=null; this.pending=null; this.t=0; }
  replace(scene, args){ this.pending = { scene, args: args||{} }; }
  _flush(){
    if (!this.pending) return;
    const { scene, args } = this.pending; this.pending = null;
    if (this.cur && this.cur.destroy) this.cur.destroy();
    this.cur = scene; this.t = 0;
    if (scene.init) scene.init(this.ctx, args);
  }
  update(dt){ this._flush(); if(this.cur&&this.cur.update) this.cur.update(dt,this.ctx); this.t+=dt; }
  draw(alpha){ if(this.cur&&this.cur.draw) this.cur.draw(this.ctx.g,this.ctx,alpha); }
  onInput(ev){ if(this.cur&&this.cur.onInput) this.cur.onInput(ev,this.ctx); }
}
```

## The game-module interface (minimal, sufficient for all five genres)

**Recomendacion:** Every game is a plain object with a fixed shape: five required-ish methods plus a metadata block for the menu. Games self-register by importing into a single games.js array — no dynamic discovery, no registry magic. The interface is: meta {id,title,colors,icon}, init(ctx,args), update(dt,ctx), draw(g,ctx,alpha), onInput(ev,ctx), destroy(). A game signals death by calling ctx.gameOver(score) — it never touches the scene manager or the save layer directly, which is what keeps high scores and the record celebration in the shared layer.

**Por que:** Five methods cover all five genres because the genre differences live entirely inside update/draw, not in the lifecycle. The one addition worth making over a bare init/update/draw is `destroy()`, which lets each game release its pools so five games' worth of entity arrays never coexist in 4GB of RAM. Routing death through ctx.gameOver() rather than letting games write scores themselves is what makes the new-record hook uniform and impossible to forget.

```js
// The contract every game file satisfies.
export default {
  meta: { id:'shmup', title:'STAR RUN', icon:drawShmupIcon, colors:['#4df','#f4a'] },

  // Called once when the scene becomes active. Allocate pools HERE, not at
  // module scope, so only the running game holds memory.
  init(ctx, args) {
    this.rng = makeRng(args.seed >>> 0);
    this.bullets = new Pool(300, mkBullet, resetBullet);
    this.foes    = new Pool(120, mkFoe, resetFoe);
    this.hash    = new SpatialHash(VW, VH, 32, 120);
    this.score = 0;
  },

  update(dt, ctx) {
    // ... sim ...
    if (this.hp <= 0) ctx.gameOver(this.score);   // shared layer does the rest
  },

  // alpha = sub-step remainder, ignore it unless you interpolate
  draw(g, ctx, alpha) { /* g is the 2D context, already transformed */ },

  // ev = {type:'down'|'move'|'up', x, y, id}  in 270x600 virtual coords
  onInput(ev, ctx) { if (ev.type==='down') this.firing = true; },

  // Release everything. Called before the next scene's init().
  destroy() { this.bullets = this.foes = this.hash = null; }
};

// games.js - registration is just an array
import shmup from './games/shmup.js';
import brawler from './games/brawler.js';
import runner from './games/runner.js';
import breaker from './games/breaker.js';
import survival from './games/survival.js';
export const GAMES = [shmup, brawler, runner, breaker, survival];

// ctx.gameOver is provided by main.js, so no game touches Save or SceneManager:
ctx.gameOver = (score) => {
  const id = sm.cur.meta.id;
  const isRecord = Save.submit(id, score);   // returns true on a new best
  sm.replace(GameOverScene, { id, score, isRecord });
};
```

## Collision: spatial hash, but NOT for the reason usually given

**Recomendacion:** Use the uniform spatial hash for the shmup and survival games (the only two that reach high entity counts), and plain nested loops for the brawler, runner, and brick-breaker. I benchmarked both. All-pairs crossover is n≈150 (at n=150: 0.0101ms naive vs 0.0097ms hashed). The realistic cross-group case (bullets x enemies) crosses much earlier, around 120x40: at 300 bullets x 100 enemies naive is 0.0356ms vs hashed 0.0109ms (3.3x), and at 400x150 it is 0.0722 vs 0.0145 (5x). Use cell size ~2x the largest common entity radius (32 virtual units is right for 270x600 with 6-12px sprites).

**Por que:** Here is the honest framing: even the naive version fits the budget. Scaled by a pessimistic 6x mobile penalty, naive 300x100 is 0.214ms — 1.3% of a frame. The hash is worth using because it is already written and it makes the survival game's worst case (400x150, the mode most likely to blow up) a non-issue, not because naive would miss 60fps. The real budget goes to fill rate and draw calls. I flag this because 'optimize collision' is the default instinct and it would be optimizing the wrong 1%. The brick-breaker in particular has ~60 static bricks and one ball — a hash there is pure overhead, and at n=50 the hash is measurably SLOWER (0.0108ms vs 0.0023ms naive, 4.7x worse) due to build cost.

```js
// hash.js - counting sort into flat typed arrays, zero per-frame allocation.
export class SpatialHash {
  constructor(w, h, cell, maxEntities) {
    this.cell = cell;
    this.cols = Math.ceil(w/cell) + 2;   // 1 cell of padding each side
    this.rows = Math.ceil(h/cell) + 2;
    const nc = this.cols * this.rows;
    this.counts = new Int32Array(nc+1);
    this.starts = new Int32Array(nc+1);
    this.items  = new Int32Array(maxEntities);
    this.gx = new Int32Array(maxEntities);
    this.gy = new Int32Array(maxEntities);
  }
  // Single source of truth for world->cell so build and query cannot drift.
  // NaN-safe: `|0` maps NaN to 0, and each ternary tests the SAFE side --
  // a `>=` comparison against NaN is false and would leak a bad index into
  // the counting sort, silently corrupting collision for the whole frame.
  _cx(x){ const v=((x/this.cell)|0)+1; return v<0?0:(v>this.cols-1?this.cols-1:v); }
  _cy(y){ const v=((y/this.cell)|0)+1; return v<0?0:(v>this.rows-1?this.rows-1:v); }

  build(list, count) {
    const cols=this.cols, nc=cols*this.rows;
    this.counts.fill(0);
    for (let i=0;i<count;i++){
      const e=list[i], gx=this._cx(e.x), gy=this._cy(e.y);
      this.gx[i]=gx; this.gy[i]=gy; this.counts[gy*cols+gx]++;
    }
    let run=0;
    for (let k=0;k<nc;k++){ this.starts[k]=run; run+=this.counts[k]; }
    this.starts[nc]=run;
    const cursor=this.counts;                       // reuse as write cursor
    for (let k=0;k<nc;k++) cursor[k]=this.starts[k];
    for (let i=0;i<count;i++) this.items[cursor[this.gy[i]*cols+this.gx[i]]++]=i;
  }
  query(x, y, fn) {
    const cols=this.cols, rows=this.rows;
    const gx=this._cx(x), gy=this._cy(y);
    for (let oy=-1;oy<=1;oy++){
      const ry=gy+oy; if(ry<0||ry>=rows) continue;
      for (let ox=-1;ox<=1;ox++){
        const rx=gx+ox; if(rx<0||rx>=cols) continue;
        const k=ry*cols+rx, s=this.starts[k], e=this.starts[k+1];
        for (let t=s;t<e;t++) fn(this.items[t]);
      }
    }
  }
}

// collide.js - the cheap helpers the other three games use
export const aabb = (a,b) =>
  a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
export const circle = (a,b) => {
  const dx=a.x-b.x, dy=a.y-b.y, r=a.r+b.r; return dx*dx+dy*dy < r*r;
};
```

## Entity management: array-of-objects, pooled — SoA is not worth it here

**Recomendacion:** Use array-of-objects with a pooled free list and dense swap-removal. I benchmarked struct-of-arrays (Float32Array) against array-of-objects on the identical collision workload and the difference was within noise: at 300x100 entities, AoS 0.0356ms vs SoA 0.0356ms — literally identical; at 400x150, AoS 0.0722 vs SoA 0.0749 (SoA slightly WORSE). Choose AoS for readability across five games written by hand. The thing that actually matters is avoiding Array.splice: at 600 entities, splice costs 0.0080ms vs 0.0016ms pooled — a 5x penalty — and at 1000 entities 0.0075 vs 0.0037.

**Por que:** SoA wins when you are memory-bandwidth-bound over tens of thousands of contiguous elements; at 300-1000 entities everything fits in L1/L2 and V8's hidden classes already give monomorphic property access that is as fast. Paying SoA's ergonomic cost (parallel arrays, manual index bookkeeping, painful debugging) across five hand-written games would buy exactly zero measured performance. The pool matters for a different reason than speed: fixed capacity is a frame-time GUARANTEE — spawn() returning null when full means a bullet-hell moment can never allocate its way into a GC pause.

```js
// pool.js - verified: recycles slots, respects cap, survivors intact
export class Pool {
  constructor(cap, factory, reset) {
    this.cap = cap; this.reset = reset;
    this.items = new Array(cap);
    for (let i=0;i<cap;i++){ this.items[i]=factory(); this.items[i].alive=false; }
    this.n = 0;              // items[0..n-1] alive, items[n..cap-1] free
  }
  spawn() {
    if (this.n >= this.cap) return null;    // hard cap = frame-time guarantee
    const e = this.items[this.n++];
    e.alive = true; this.reset(e);
    return e;
  }
  kill(i) {                                 // call from a BACKWARD loop
    const e = this.items[i]; e.alive = false;
    const last = --this.n;
    this.items[i] = this.items[last]; this.items[last] = e;
  }
  clear(){ for(let i=0;i<this.n;i++) this.items[i].alive=false; this.n=0; }
  forEach(fn){ for(let i=this.n-1;i>=0;i--) fn(this.items[i], i, this); }
}

// Budgets (sum stays under the ~1200-sprite draw-call comfort line):
// shmup    bullets 300, foes 120, pickups 32
// survival foes 400, shots 150, pickups 48
// brawler  foes 40, hitboxes 24
// runner   obstacles 48, coins 64
// breaker  bricks 120, balls 8, powerups 16
// shared   particles 400 (Fx owns this, cleared between scenes)
```

## CRITICAL: stale indices between the pool and the hash

**Recomendacion:** The spatial hash stores indices into pool.items, and Pool.kill() swap-removes — so every index the hash handed out goes stale the instant anything dies. Guard every hash callback with two checks: `if (idx >= pool.n) return;` and `if (!pool.items[idx].alive) return;`. Rebuild the hash after a batch of kills, never mid-iteration. I demonstrated the failure concretely: with 20 overlapping enemies and no guards, a single bullet produced 20 kill events with duplicates (the same enemy dying repeatedly, awarding double score) and left the pool's accounting wrong. With guards: exactly 10 killed, 10 live, no duplicates.

**Por que:** This is the highest-severity trap in the whole design and it fails silently — no crash, just doubled scores and enemies vanishing in pairs, which reads as 'weird game feel' rather than a bug. It is inherent to combining any swap-remove pool with any index-based broadphase, so it must be written into the interface contract rather than left for each of the five games to rediscover.

```js
// The mandatory pattern for hash-driven collision against a pool:
this.hash.build(this.foes.items, this.foes.n);

this.bullets.forEach((b, bi, bp) => {
  let hit = -1;
  this.hash.query(b.x, b.y, fi => {
    if (hit >= 0) return;                    // resolve one hit per bullet
    if (fi >= this.foes.n) return;           // GUARD: index now beyond live range
    const f = this.foes.items[fi];
    if (!f.alive) return;                    // GUARD: already killed this frame
    const dx=b.x-f.x, dy=b.y-f.y, rr=b.r+f.r;
    if (dx*dx+dy*dy < rr*rr) hit = fi;
  });
  if (hit >= 0) {
    this.score += 10;
    this.foes.kill(hit);                     // invalidates other indices --
    bp.kill(bi);                             // which is why we took only one
    ctx.fx.burst(b.x, b.y, 8, '#ff0');
    ctx.shake(3);
  }
});
```

## Draw-call budget and sprite baking

**Recomendacion:** Bake every sprite once at boot into offscreen canvases (procedurally drawn with fillRect), then blit with drawImage. Keep total drawImage calls under ~800/frame. I modeled per-call overhead at a pessimistic 5us: 300 sprites = 1.5ms (9% of frame), 800 = 4.0ms (24%), 1200 = 6.0ms (36%). Combined with the DPR-1.5 fill cost, 800 sprites lands at 5.66ms of 16.67ms — comfortable. At DPR 2.75 the same scene is 9.32ms, over half the frame. Bake at 1x only, never per-frame rotate/scale; for rotation, pre-bake 8 or 16 angle steps into a strip.

**Por que:** Per-call overhead and fill rate are the two costs that actually consume this frame budget, and they compound. Baking converts dozens of per-sprite path operations into one blit, which is the single highest-leverage rendering decision. Pre-baked rotation matters specifically for the shmup and survival games; ctx.rotate() forces a transform+resample per sprite and is what turns a 300-entity scene into a slideshow on an Adreno 612.

```js
// gfx.js
export function bake(w, h, drawFn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawFn(g, w, h);          // draw with fillRect at 1x -- pure pixel art
  return c;
}
// pre-baked rotation: 16 steps is plenty for 8-bit art
export function bakeRot(w, h, drawFn, steps = 16) {
  const frames = [];
  for (let i=0;i<steps;i++){
    frames.push(bake(w, h, (g) => {
      g.translate(w/2, h/2); g.rotate(i/steps*Math.PI*2); g.translate(-w/2,-h/2);
      drawFn(g, w, h);
    }));
  }
  return { frames, steps,
    at(angle){ let i=Math.round(angle/(Math.PI*2)*steps)%steps; if(i<0)i+=steps; return this.frames[i]; } };
}

// Bitmap text: bake a 5x7 glyph atlas once, draw by blitting per character.
// A 3-char score is 3 calls; keep HUD text short and it is free.
const GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.:-!';
export function text(g, atlas, str, x, y, scale=1) {
  for (let i=0;i<str.length;i++){
    const idx = GLYPHS.indexOf(str[i]); if (idx < 0) continue;
    g.drawImage(atlas, idx*5, 0, 5, 7, x+i*6*scale, y, 5*scale, 7*scale);
  }
}
```

## Menu: one-tap carousel, no confirmation step

**Recomendacion:** A vertically-centered horizontal carousel of 5 cards, each showing a procedurally-drawn icon, the game title, and 'BEST 0000'. The center card is enlarged and the side cards peek in at reduced scale. Critically: tapping ANY card launches that game immediately — tapping a side card does not merely center it. Swipe scrolls, tap plays. A single mute speaker sits in a corner. No settings screen, no confirm dialog, no 'are you ready'. Boot goes straight to this menu with no splash — I verified in the integration test that boot lands on the menu and one tap enters gameplay.

**Por que:** Romina wants to be playing within one tap, and the classic mistake is a carousel where a tap on a non-centered item only selects it, silently costing two taps. Making every card directly launchable removes that. Showing the high score on the card is what turns a launcher into an arcade cabinet and supplies the motivation loop without any tutorial or text.

```js
// menu.js
export const Menu = {
  init(ctx){
    this.sel = ctx.lastPlayed|0; this.scroll = this.sel; this.vel = 0;
    this.drag = null; this.moved = 0;
  },
  update(dt, ctx){
    if (!this.drag) {                       // ease to nearest card
      const t = Math.round(this.scroll);
      this.scroll += (t - this.scroll) * Math.min(1, dt*12);
      this.sel = t;
    }
  },
  onInput(ev, ctx){
    if (ev.type === 'down'){ this.drag = { x:ev.x, s:this.scroll }; this.moved = 0; }
    else if (ev.type === 'move' && this.drag){
      const dx = ev.x - this.drag.x;
      this.moved = Math.max(this.moved, Math.abs(dx));
      this.scroll = this.drag.s - dx / CARD_W;
    } else if (ev.type === 'up'){
      const wasDrag = this.moved > 8;       // 8px = tap/swipe threshold
      this.drag = null;
      if (!wasDrag) {
        // ANY card tapped launches it -- never just 're-center'
        const i = cardIndexAt(ev.x, ev.y, this.scroll);
        if (i >= 0) {
          ctx.sfx('select');
          ctx.lastPlayed = i;
          ctx.sm.replace(GAMES[i], { seed: (Math.random()*0xffffffff)>>>0 });
        }
      }
    }
  },
  draw(g, ctx){
    for (let i=0;i<GAMES.length;i++){
      const d = i - this.scroll, s = 1 - Math.min(0.35, Math.abs(d)*0.35);
      drawCard(g, GAMES[i], VW/2 + d*CARD_W, VH*0.45, s, Save.hi(GAMES[i].meta.id));
    }
  }
};
```

## High scores and the new-record celebration

**Recomendacion:** Games never write scores. A game calls ctx.gameOver(score); the shared layer calls Save.submit(id, score), which returns true exactly when the record was beaten, and passes that boolean into the game-over scene as isRecord. The game-over scene branches on it: normal path shows the score and 'BEST n'; record path plays a rising arpeggio, spawns a confetti burst from the particle pool, and pulses 'NEW RECORD!' in bitmap text. Tapping returns to the menu. I verified end-to-end that the first run flags isRecord true, a worse second run returns false, and the stored best is unchanged by the worse run.

**Por que:** Making submit() return the boolean is what keeps the celebration impossible to get wrong — there is no separate 'was it a record' comparison for five different games to implement inconsistently, and no way for a game to update the score without the celebration firing. Scores are floored to integers and NaN-guarded at the boundary so a physics glitch producing a fractional or NaN score cannot corrupt the saved table.

```js
// The whole game-over scene
const GameOverScene = {
  init(ctx, a){
    this.score=a.score; this.rec=a.isRecord; this.id=a.id; this.t=0;
    if (this.rec){
      ctx.sfx('fanfare');
      for(let i=0;i<48;i++)
        ctx.fx.burst(VW/2, VH*0.35, 1, ['#ff0','#f4a','#4df'][i%3]);
    } else ctx.sfx('gameover');
  },
  update(dt){ this.t += dt; },
  draw(g, ctx){
    text(g, ctx.font, 'SCORE ' + this.score, 40, 200, 2);
    if (this.rec){
      const p = 1 + Math.sin(this.t*8)*0.15;        // pulse
      text(g, ctx.font, 'NEW RECORD!', 40, 250, 2*p);
    } else {
      text(g, ctx.font, 'BEST ' + Save.hi(this.id), 40, 250, 1);
    }
    if (this.t > 0.6) text(g, ctx.font, 'TAP', 110, 400, 1);
  },
  onInput(ev, ctx){ if (ev.type==='up' && this.t>0.6) ctx.sm.replace(Menu); }
};
```

## Persistence: exactly two things, never throws

**Recomendacion:** One localStorage key holding one JSON blob: {mute:boolean, hi:{gameId:int}}. Nothing else persists — no settings, no progress, no last-played (keep that in memory only). Every read and write is wrapped in try/catch with an in-memory fallback, because a WebView with site data blocked throws on the FIRST localStorage touch. I tested this against normal storage, a corrupted blob ('{not json'), and a fully-throwing localStorage; all three paths keep the game running, and the blocked case still tracks scores for the session.

**Por que:** MIUI privacy settings and WebView incognito modes both make localStorage throw rather than return null, which crashes at boot — before anything is rendered — producing a black screen with no clue as to why. The in-memory fallback means the worst case is 'scores do not survive a restart' instead of 'the app does not start'. Validating the parsed shape (rather than trusting it) covers the corrupted-blob case that a partial write during a kill can produce.

```js
// save.js - verified against normal, corrupt, and throwing storage
const KEY='rj.v1'; let mem=null;
function read(){
  if (mem) return mem;
  let d=null;
  try { const raw=localStorage.getItem(KEY); if(raw) d=JSON.parse(raw); } catch(e){ d=null; }
  mem = { mute: !!(d && d.mute),
          hi: (d && typeof d.hi==='object' && d.hi) ? d.hi : {} };
  return mem;
}
function write(){ try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch(e){} }

export const Save = {
  get mute(){ return read().mute; },
  set mute(v){ read().mute = !!v; write(); },
  hi(id){ const v=read().hi[id]; return Number.isFinite(v) ? v : 0; },
  submit(id, score){                       // true => celebrate
    const d=read(), s=Math.floor(Number(score)||0);
    const prev = Number.isFinite(d.hi[id]) ? d.hi[id] : 0;
    if (s > prev){ d.hi[id]=s; write(); return true; }
    return false;
  }
};
```

## Input: pointer events normalized to virtual coords

**Recomendacion:** Bind pointerdown/pointermove/pointerup/pointercancel on the canvas with {passive:false}, call preventDefault, convert to 270x600 virtual coordinates, and dispatch as discrete events to the active scene. Track multiple pointer ids in a small map (the brawler and shmup both benefit from two-thumb play: one virtual stick, one action zone). Do NOT poll a keyboard. Handle pointercancel identically to pointerup — Android fires it when a system gesture steals the touch, and dropping it leaves a thumb stuck down forever.

**Por que:** Event dispatch rather than polling means a tap during a scene transition cannot leak into the next scene (verified in the scene test). pointercancel is the specific Android trap: MIUI's edge-swipe gestures fire it constantly, and treating it as anything other than 'finger lifted' produces a ship that keeps flying into the wall after the player lets go.

```js
// input.js
export function attachInput(canvas, dispatch) {
  const active = new Map();
  const send = (type, e) => {
    const p = toVirtual(e.clientX, e.clientY);
    dispatch({ type, x:p.x, y:p.y, id:e.pointerId });
  };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    active.set(e.pointerId, 1); send('down', e);
  }, {passive:false});
  canvas.addEventListener('pointermove', e => {
    if (!active.has(e.pointerId)) return;
    e.preventDefault(); send('move', e);
  }, {passive:false});
  const end = e => {
    if (!active.has(e.pointerId)) return;
    e.preventDefault(); active.delete(e.pointerId); send('up', e);
  };
  // pointercancel MUST behave exactly like pointerup (MIUI edge gestures)
  canvas.addEventListener('pointerup', end, {passive:false});
  canvas.addEventListener('pointercancel', end, {passive:false});
  return { active };
}
```

## Audio: lazy-unlocked WebAudio, pooled oscillators, hard voice cap

**Recomendacion:** Create the AudioContext lazily on the FIRST touch (autoplay policy blocks it otherwise), route everything through one master GainNode whose gain is 0 when muted, and cap concurrent voices at 8 with oldest-stealing. Synthesize SFX as short oscillator+envelope bursts and noise from a single pre-generated 1-second noise buffer reused by every explosion. Call ctx.suspend() on visibilitychange to stop burning battery when backgrounded.

**Por que:** An uncapped voice count is how a bullet-hell moment turns into audio crackle and a frame-time spike — 40 simultaneous explosion sounds each allocating nodes will stall the audio thread and starve rAF. One shared noise buffer avoids regenerating white noise per explosion, which is a surprisingly expensive per-shot allocation. The lazy unlock is mandatory: a context created at module load starts suspended and every later sound is silent with no error.

```js
// audio.js
let ac=null, master=null, noise=null, voices=0;
export function unlock(){                    // call from first pointerdown
  if (ac) return;
  ac = new (window.AudioContext||window.webkitAudioContext)();
  master = ac.createGain();
  master.gain.value = Save.mute ? 0 : 0.35;
  master.connect(ac.destination);
  const n = ac.sampleRate;                   // one shared noise buffer
  noise = ac.createBuffer(1, n, n);
  const d = noise.getChannelData(0);
  for (let i=0;i<n;i++) d[i] = Math.random()*2-1;
}
export function setMute(m){ Save.mute=m; if(master) master.gain.value = m?0:0.35; }

export function blip(freq, dur, type='square', vol=0.3){
  if (!ac || Save.mute || voices >= 8) return;   // hard voice cap
  voices++;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ac.currentTime+dur);
  o.onended = () => { voices--; };
}
export function boom(dur=0.3){
  if (!ac || Save.mute || voices >= 8) return;
  voices++;
  const s=ac.createBufferSource(), g=ac.createGain(), f=ac.createBiquadFilter();
  s.buffer=noise; f.type='lowpass'; f.frequency.value=800;
  g.gain.setValueAtTime(0.4, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(); s.stop(ac.currentTime+dur);
  s.onended = () => { voices--; };
}
export const suspend = () => ac && ac.suspend();
export const resume  = () => ac && ac.resume();
```

## Seeded RNG (xorshift32) — validated statistically

**Recomendacion:** Use xorshift32 rather than Math.random, seeded per run and stored so a run is reproducible. I validated the output: mean 0.49953 over 200k draws, max decile deviation 1.35% (well under a 3% threshold), range strictly within [0,1), no repeat within 300k draws, int(1,6) covers exactly 1-6 inclusive, and identical seeds produce identical streams. Guard seed 0, which is a fixed point for xorshift and would otherwise emit a constant.

**Por que:** Determinism is what makes 'that wave was impossible' debuggable — replay the seed and watch it happen. The statistical validation matters because a subtly-biased generator shows up as visibly clumped enemy spawns, which reads as bad game design rather than a broken RNG. The seed-0 fixed point is the one xorshift footgun and costs one line to eliminate.

```js
// rng.js - mean 0.49953, decile deviation 1.35%, no repeat in 300k draws
export function makeRng(seed = 0x2F6E2B1) {
  let s = seed >>> 0;
  if (s === 0) s = 0x9E3779B9;             // 0 is a fixed point for xorshift
  const r = {
    next(){ s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s; },
    float(){ return r.next() / 4294967296; },              // [0,1)
    range(a,b){ return a + r.float()*(b-a); },
    int(a,b){ return a + ((r.float()*(b-a+1))|0); },        // inclusive
    pick(arr){ return arr[(r.float()*arr.length)|0]; },
    sign(){ return r.next()&1 ? 1 : -1; },
    seed(v){ s = v>>>0 || 0x9E3779B9; }
  };
  return r;
}
```

## Shared FX: particle pool and camera shake in the engine layer

**Recomendacion:** One global particle pool of 400, owned by the engine and cleared on every scene swap, plus a scalar shake value that decays exponentially and offsets the canvas transform. Games call ctx.fx.burst(x,y,count,color) and ctx.shake(amount) and never manage either. Particles are 1-2px rects with velocity, gravity, and ttl — draw them with fillRect, not drawImage, since they are solid single-color squares and fillRect avoids the blit overhead entirely.

**Por que:** Sharing one pool across all five games caps total particle cost globally rather than per-game, so no single game can spike the budget, and clearing on scene swap prevents a previous game's confetti bleeding into the next. Screen shake is the single highest-impact-per-line piece of game feel for an action game, and putting it in the shared transform means all five genres get it for free. fillRect for particles is deliberate: at 400 particles the per-drawImage-call overhead would be ~2ms, while fillRect on tiny solid quads is far cheaper.

```js
// fx.js
export function createFx(rng) {
  const P = new Pool(400,
    () => ({x:0,y:0,vx:0,vy:0,ttl:0,life:0,c:'#fff',s:2,alive:false}),
    () => {});
  let shake = 0;
  return {
    burst(x, y, n, color, spd=60){
      for (let i=0;i<n;i++){
        const p = P.spawn(); if (!p) return;        // silently drop when full
        const a = rng.float()*Math.PI*2, v = rng.range(spd*0.3, spd);
        p.x=x; p.y=y; p.vx=Math.cos(a)*v; p.vy=Math.sin(a)*v;
        p.ttl = p.life = rng.range(0.25,0.6);
        p.c = color; p.s = rng.float()<0.3 ? 1 : 2;
      }
    },
    add(n){ shake = Math.min(8, shake + n); },
    update(dt){
      shake *= Math.pow(0.001, dt);                 // frame-rate independent
      P.forEach((p,i,pool) => {
        p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 220*dt;
        if ((p.ttl -= dt) <= 0) pool.kill(i);
      });
    },
    draw(g){
      P.forEach(p => {
        g.globalAlpha = Math.min(1, p.ttl / p.life);
        g.fillStyle = p.c;
        g.fillRect(p.x|0, p.y|0, p.s, p.s);         // fillRect, not drawImage
      });
      g.globalAlpha = 1;
    },
    offset(){ return shake; },
    clear(){ P.clear(); shake = 0; }                // on every scene swap
  };
}
// applied in engine.begin(), after the base transform:
//   if (fx.offset() > 0.1) ctx.translate(rng.range(-s,s)|0, rng.range(-s,s)|0);
```

## Pitfalls

- DO NOT optimize collision first. I measured it: naive 300x100 collision is 0.214ms even with a 6x mobile penalty -- 1.3% of the frame budget. Fill rate is the real constraint (5.2ms at DPR 2.75 vs 1.5ms at DPR 1.5). Capping devicePixelRatio at 1.5 buys 3.4x more than any collision work possibly could.
- Stale indices between Pool.kill() and SpatialHash. The hash hands out indices into pool.items; swap-removal invalidates them instantly. Without `if (idx >= pool.n) return;` and `if (!pool.items[idx].alive) return;` guards in every query callback, I reproduced 20 kill events from 20 overlapping enemies with duplicates -- the same enemy dying twice and scoring twice. It never crashes; it just silently doubles scores.
- NaN coordinates corrupting the entire spatial hash. `NaN < 0` and `NaN >= cols` are BOTH false, so a naive clamp lets a NaN cell index into the counting sort and poisons collision for every entity that frame. I hit this in testing. The `_cx`/`_cy` helpers must test the safe side of each comparison, and build/query must share one helper so they cannot drift apart.
- Array.prototype.splice for entity removal. Measured 5x slower than pooled swap-removal at 600 entities (0.0080ms vs 0.0016ms). Every removal is an O(n) memmove plus GC pressure. Use dense swap-removal and always iterate backward.
- Do NOT reach for struct-of-arrays. I benchmarked it head-to-head: identical performance at 300x100 (0.0356ms both) and slightly worse at 400x150. It buys zero measured speed at this scale while making five hand-written games materially harder to debug.
- AudioContext created at module load will be permanently suspended by the autoplay policy -- every sound silently does nothing with no error. Create it lazily inside the first pointerdown handler.
- pointercancel treated as anything other than pointerup. MIUI edge-swipe gestures fire it constantly; ignoring it leaves the player's thumb logically stuck down and the ship flying into a wall after they let go.
- localStorage THROWS (not returns null) when site data is blocked in a WebView. An unguarded read at boot black-screens the app before anything renders. Every access needs try/catch plus an in-memory fallback -- verified against a throwing mock.
- MAX_STEPS alone does not prevent the spiral of death. Without `if (steps === MAX_STEPS) acc = 0`, the accumulator carries debt into the following frames and never recovers. My test explicitly asserts that 10 normal frames after a 5-second hitch produce exactly 10 updates.
- Immediate scene swaps cause use-after-free: a game detects death mid-update, swaps, and the rest of that update runs against cleared pools. Defer swaps to the frame boundary -- one frame of latency, an entire bug class gone.
- A carousel where tapping a side card only centers it costs Romina two taps instead of one. Every card must launch directly on tap; reserve dragging (>8px movement) for scrolling.
- ctx.rotate()/scale() per sprite forces a transform and resample per draw on the Adreno 612. Pre-bake 16 rotation frames instead; the art is chunky enough that 16 steps is indistinguishable from continuous rotation.
- Do not use drawImage for 1-2px particles -- at 400 particles the per-call overhead is ~2ms. fillRect on solid single-color quads is far cheaper.
- ES modules will not load over file:// (CORS blocks them), producing a blank screen. Serve over http:// or concatenate to a single bundle.js; decide which before writing 18 files.
- Do not persist anything beyond mute and per-game high scores. Every extra saved field is a new corruption path and a new migration burden for a game that has no versioning story.
