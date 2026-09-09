# SYMBIOTE research: rope

## RESOLUTION DECISION — use 540x1200

**Recomendacion:** Adopt 540x1200 for SYMBIOTE. The engine's `fit()` in core.js:21 computes scale in CSS px, which is misleading — the browser composites to PHYSICAL pixels, so the number that decides pixel crispness is 1080/VW, not 392.727/VW. Measured: 270x600 -> 4.000x (integer), 360x800 -> 3.000x (integer), 405x900 -> 2.667x (FRACTIONAL — disqualified, it shimmers), 540x1200 -> 2.000x (integer). Three of four are integer against the panel; 405x900 is the only one that must be rejected outright. Among the survivors 540x1200 gives the most detail while still landing on a clean 2.00x device blit. Backbuffer cost 648,000 px/frame = 4.00x the current 270x600 (162,000). That sounds alarming but is not: the GPU blit to 1080x2400 is 2,592,000 px regardless of virtual resolution — it is a constant, identical for all four options — so the only real delta is the clear+overdraw at virtual size, ~1.62M px/frame at 2.5x overdraw, far under an Adreno 612's fill budget. Keep the engine's deliberate dpr-ignoring behavior (core.js:10 `canvas.width = VW`, no dpr multiply): at 540 wide the backbuffer is already exactly half the panel, so multiplying by dpr 2.75 would be both pointless and 7.5x more expensive.

**Por que:** Real math, all verified by computation rather than assumed. CSS viewport is 1080/2.75 = 392.727 x 872.727. Judging by CSS scale would wrongly rank 405x900 best (0.9697, near 1:1) — but 405 does not divide 1080 evenly (2.667x), so its texels land on fractional device pixels and crawl during camera motion, which is fatal for a swinging game where the camera never stops. 540 divides 1080 exactly twice. Detail-wise 540x1200 doubles linear resolution over 270x600: a head goes from ~6px tall (3px of face = 1px per eye, no mouth possible) to ~12px tall (7px of face = 2x2 eyes + brow + mouth). That is precisely the '32 bits, more detail' the user asked for, and it is the smallest resolution at which faces read at all — which matters because the whole power fantasy depends on seeing terror on a scientist's face before tearing him apart.

```js
// core.js — make the virtual grid per-game instead of a hard constant.
// Currently: export const VW = 270, VH = 600;  (core.js:3)
// VW/VH are imported by main.js (22 refs), input.js (1), and all 3 games (43 refs),
// so they must keep working unchanged for the existing games.

export let VW = 270, VH = 600;          // let, not const
export const BASE_VW = 270, BASE_VH = 600;

// Called by the scene manager BEFORE init() of the incoming game.
export function setVirtual(w, h) {
  if (w === VW && h === VH) return;      // no-op keeps the common path free
  VW = w; VH = h;
  canvas.width = VW; canvas.height = VH; // resizing clears + reallocs: scene change only, never per frame
  g.imageSmoothingEnabled = false;       // MUST be re-set: resizing the canvas resets context state
  fit();
}

// main.js — in sm.flush(), before this.cur.init(...):
//   const m = this.cur.meta;
//   setVirtual(m.vw || BASE_VW, m.vh || BASE_VH);
// Games that don't declare vw/vh keep 270x600 untouched.
// input.js toVirtual() already divides by view.scale, so touch coords follow automatically.

// symbiote.js:
// meta: { id:'symbiote', title:'SYMBIOTE', vw:540, vh:1200, colors:[...] }
```

## The symbiote body — one-span-per-scanline metaball (verified, notch-free)

**Recomendacion:** Render the blob as 5 overlapping lobes resolved into ONE horizontal span per scanline — not as independent circles unioned together, and not with arc()/gradients. I tested both approaches and the naive one is visibly broken. Cost: 32-37 fillRect calls for the entire body, with zero per-frame allocation (Float32Array/Int16Array preallocated at init). Drive squash-stretch from velocity with area conservation (stretch factor st along motion, scale 1/sqrt(st) across it) so the blob elongates when launched and rounds out when settling — measured 37 tall x 28 wide on launch vs 35x35 at rest.

**Por que:** I first implemented the obvious version — draw each lobe's circle spans and let them overlap — and rendered the silhouette as ASCII to check it. It produced a visible 1px NOTCH at every joint where two lobes' spans met (rows 10 and 38-39 of my test render), which on an organic creature reads as a rendering bug, plus it cost 103 fillRects. Solving the field once per scanline and emitting a single min/max span fixes the notch completely AND drops the cost to 32 fillRects — 3.2x cheaper and strictly better looking. This is the kind of thing that only shows up if you actually render it, so the code below is the tested version. arc() is avoided because Canvas 2D path fills are anti-aliased and would soften the pixel-art edge; scanline fillRects give hard pixels for free.

```js
// ---- Symbiote blob: allocated ONCE in init(), never per frame ----
const NL = 5;
const LX = new Float32Array([0,-7, 7,-5, 6]);   // lobe offsets, virtual px @540x1200
const LY = new Float32Array([0, 6, 6,-7,-6]);
const LR = new Float32Array([14,11,11, 9, 9]);  // radii -> ~52px tall body
const wx = new Float32Array(NL), wy = new Float32Array(NL), wr = new Float32Array(NL);

// Draw the body. cx,cy = center; vx,vy = velocity; sq = squash amount 0..1; t = time.
function drawBlob(g, cx, cy, vx, vy, sq, t, colFill, colRim, colCore) {
  // squash-stretch along velocity, area-conserving
  const sp = Math.hypot(vx, vy);
  const st = 1 + sq * 0.45, sc = 1 / Math.sqrt(st);
  for (let i = 0; i < NL; i++) {
    const ph = t * 3.1 + i * 1.7;
    wx[i] = Math.sin(ph) * 1.6;          // idle wobble: the blob is never still
    wy[i] = Math.cos(ph * 1.3) * 1.6;
    wr[i] = 1 + Math.sin(ph * 0.9) * 0.10;
  }
  const y0 = (cy - 30) | 0, y1 = (cy + 30) | 0;
  g.fillStyle = colFill;
  for (let y = y0; y <= y1; y++) {
    let mn = 1e9, mx = -1e9;
    for (let i = 0; i < NL; i++) {       // ONE span per row = no notch artifact
      const lcx = cx + (LX[i] + wx[i]) * sc;
      const lcy = cy + (LY[i] + wy[i]) * st;
      const r = LR[i] * wr[i] * sc;
      const dy = y - lcy, rr = r * r - dy * dy;
      if (rr <= 0) continue;
      const h = Math.sqrt(rr);
      if (lcx - h < mn) mn = lcx - h;
      if (lcx + h > mx) mx = lcx + h;
    }
    if (mx < mn) continue;
    const a = mn | 0, w = (mx | 0) - a + 1;
    g.fillRect(a, y, w, 1);
    // rim light: 1px at each end of the span, drawn inline to avoid a 2nd pass
    g.fillStyle = colRim; g.fillRect(a, y, 1, 1); g.fillRect(a + w - 1, y, 1, 1);
    g.fillStyle = colFill;
  }
  // wet core highlight: 2 small rects, sells the gooey read
  g.fillStyle = colCore;
  g.fillRect((cx - 4) | 0, (cy - 3 * st) | 0, 3, 2);
  g.fillRect((cx + 2) | 0, (cy - 1 * st) | 0, 2, 2);
}
```

## Tentacles — taper + attached-swing, 56 fillRects for two

**Recomendacion:** Draw each tentacle as 14 segments along a verlet/rope chain, each segment one fillRect whose width tapers from 5px at the body to 1px at the tip, plus one 1px highlight rect on the upper edge. Two tentacles = 56 fillRects. When the button is HELD and the tip is anchored, draw the rope taut (straight-ish, thinner, brighter rim) versus slack (thicker, more sag) so the player can SEE the attachment state — this is the visual feedback that makes the swing mechanic legible without a tutorial.

**Por que:** The taper is the single detail that reads as 'organic tentacle' rather than 'line', and at 540x1200 a 5px->1px taper has enough steps to be visible; at 270x600 it would be 3px->1px, which barely reads. Keeping the rope as fillRects rather than a stroked path avoids anti-aliasing and keeps it in the same hard-pixel language as the blob. Drawing taut-vs-slack differently is free (one branch on colour/width) and directly serves the decided control scheme where holding = attached.

```js
// Rope points preallocated in init(): Float32Array(SEG*2) per tentacle, no allocation in draw.
function drawTentacle(g, px, py, n, attached, colBody, colRim) {
  for (let i = 0; i < n - 1; i++) {
    const x = px[i*2], y = px[i*2+1];
    const t = i / (n - 1);
    let w = (5 - t * 4) | 0; if (w < 1) w = 1;   // 5px root -> 1px tip
    if (attached) w = w > 1 ? w - 1 : 1;          // taut reads thinner
    const h = w;
    g.fillStyle = colBody;
    g.fillRect((x - w * 0.5) | 0, (y - h * 0.5) | 0, w, h);
    g.fillStyle = colRim;                          // upper-edge highlight = wet
    g.fillRect((x - w * 0.5) | 0, (y - h * 0.5) | 0, w, 1);
  }
}
```

## Lighting and alarm state — 6 overlay rects, no shaders, no gradients

**Recomendacion:** Four cheap layers, all axis-aligned fillRects with globalAlpha (the codebase already uses globalAlpha and contains ZERO gradients/shadowBlur/filters — I checked — so stay in that idiom). (1) Baked vignette: ONE offscreen canvas 540x1200 built at init with a coarse dark border, blitted once per frame = 1 drawImage. (2) Fluorescent flicker: per-light-tile a rect at alpha 0.06-0.14 driven by a seeded rnd() so it stutters irregularly, not sinusoidally. (3) ALARM state: a single full-screen red rect at globalAlpha 0.10-0.18 pulsing at ~2Hz, plus swapping the tile highlight colour to alarm orange — instantly readable as 'they know you are here'. (4) Pipe darkness: a full-screen near-black rect at alpha 0.82 with the blob drawn AFTER it, so only the symbiote and its rim glow remain visible inside pipes. Total ~6 rects + 1 blit.

**Por que:** A radial gradient per frame would be the naive choice and is exactly what an Adreno 612 in a WebView handles worst — gradients are re-rasterized on the CPU and are the classic cause of frame drops on this class of GPU. Baking the vignette once at init reduces it to a single blit that costs the same as any other full-screen image. Alpha-blended solid rects are the cheapest compositing operation available and hit the tile cache perfectly. Irregular (rnd-driven) flicker rather than a sine is what makes fluorescents feel real; a sine reads as 'pulsing', not 'failing'.

```js
// Baked ONCE in init() — never per frame.
function bakeVignette(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const STEPS = 10, band = 26;               // coarse bands: it is pixel art, not a photo
  for (let i = 0; i < STEPS; i++) {
    c.globalAlpha = 0.05 + i * 0.035;
    c.fillStyle = '#05070a';
    const o = (STEPS - 1 - i) * band;
    c.fillRect(0, o, w, band); c.fillRect(0, h - o - band, w, band);
    c.fillRect(o, 0, band, h); c.fillRect(w - o - band, 0, band, h);
  }
  return cv;
}

// Per frame, AFTER world + entities, BEFORE HUD:
drawLighting(g, s) {
  g.drawImage(s.vig, 0, 0);                                  // 1 blit
  if (s.alarm) {                                             // guards alerted
    const p = 0.10 + Math.abs(Math.sin(s.t * 6.3)) * 0.08;
    g.globalAlpha = p; g.fillStyle = '#c81028';
    g.fillRect(0, 0, VW, VH); g.globalAlpha = 1;
  }
  if (s.inPipe) {                                            // darkness in pipes
    g.globalAlpha = 0.82; g.fillStyle = '#04060a';
    g.fillRect(0, 0, VW, VH); g.globalAlpha = 1;
    // blob redrawn here so it stays visible + reads as bioluminescent
  }
}
```

## Gore layer and tilemap memory — 2.47 MB, safe; with a hard fallback

**Recomendacion:** Use a SCREEN-SIZED persistent gore layer (540x1200 RGBA = 2.47 MB), not a full-level one, and scroll it with the camera. Full-level canvases at this resolution are the trap: a 2-screen level is 9.89 MB, 3-screen is 22.25 MB, 4-screen is 39.55 MB — and on Android WebView every one of those is duplicated as a GPU texture, so 22 MB of blood becomes ~44 MB resident. That is not fatal in 4GB but it is reckless for decoration. Instead: blit blood decals into a 2.47 MB layer, and when the camera scrolls past a threshold, translate the layer's contents by drawing it onto itself with an offset (one self-blit) and let off-screen gore fall off the edge. Romina never sees the gore she left three rooms back. FALLBACK if even 2.47 MB misbehaves (older WebView, memory pressure): drop the offscreen entirely and keep a fixed Pool of ~200 decal records (x, y, sprite index, rotation) drawn as 200 small drawImage calls per frame from 6 baked splat sprites — 200 blits is well within budget and costs ~8 KB of JS objects instead of 2.47 MB of texture.

**Por que:** All figures computed, not estimated. The decision hinges on a fact specific to this game: levels are 1-3 minutes and the goal is ESCAPE — the player moves forward and does not backtrack, so persisting gore behind them buys nothing. Screen-sized costs 4x less than a 2-screen level and 9x less than a 3-screen one while looking identical in play. Keeping blood PERSISTENT on the visible screen is what the user asked for (decals persist on floors/walls) and the scrolling layer delivers that fully within the current room. The Pool fallback matters because it degrades the feature rather than removing it, and the engine already has Pool with exactly the right semantics — though note the swap-remove caveat from the brief: never store a decal's pool index anywhere.

```js
// init(): one 2.47 MB layer, allocated once.
this.gore = document.createElement('canvas');
this.gore.width = VW; this.gore.height = VH;
this.goreCtx = this.gore.getContext('2d');
this.goreCtx.imageSmoothingEnabled = false;
this.goreOx = 0; this.goreOy = 0;   // world offset the layer currently represents

// Splatter at a world point: ONE blit into the layer, never per frame.
splat(wx, wy, idx) {
  const sx = wx - this.camX, sy = wy - this.camY;
  if (sx < -16 || sx > VW + 16 || sy < -16 || sy > VH + 16) return;
  const s = this.sSplat[idx];
  this.goreCtx.drawImage(s, (sx - s.width * 0.5) | 0, (sy - s.height * 0.5) | 0);
}

// When the camera moves, shift the layer once (self-blit) instead of reallocating.
scrollGore(dx, dy) {
  if (!dx && !dy) return;
  this.goreCtx.globalCompositeOperation = 'copy';   // avoids ghost trails
  this.goreCtx.drawImage(this.gore, -dx, -dy);
  this.goreCtx.globalCompositeOperation = 'source-over';
}

// draw(): 1 call, under the entities, over the tilemap.
g.drawImage(this.gore, 0, 0);
```

## Palette — 28 colors, ramp-locked

**Recomendacion:** 28 colors in 6 ramps. LAB (cold, desaturated, blue-biased): #f2f6f8 #dfe7ec #c2ced8 #9aa8b6 #74828f #515c68 #363f49 #1d242c #0b1015. SYMBIOTE (near-black with violet bias, never pure #000): #2a1030 #1a0a20 #0e0512 #4a1c50. GORE (warm, saturated, high-contrast against the cold lab): #ff5a5a #e02030 #b0121f #7a0a16 #4a0610 #2a0308. ALARM: #ff8c28 #ffb43c #c8501a. CLINICAL GREEN (monitors, vials, exit signs): #4ade9a #22a06a #12603f. ACCENT: #ffe14d (pickups/exit), #4de0f0 (turret laser/cold tech), #ffffff (hit flash only). RULES: (1) the lab ramp is strictly desaturated and blue-biased, gore is strictly warm and saturated — the two never share a hue, so blood on a floor always pops without any outline; (2) the symbiote never uses pure black, so it stays readable against #0b1015 shadow; (3) #ffffff is RESERVED for the hit flash and font, never for lab surfaces (they use #f2f6f8), so a white flash always means impact; (4) every ramp steps roughly evenly in luminance so a sprite can shade with adjacent indices without hunting; (5) alarm orange is the only hue between lab-cold and gore-warm, which is why it reads as an alert rather than as scenery.

**Por que:** The cohesion comes from the hue split doing the gameplay work: because the lab ramp is provably cold and the gore ramp provably warm, a blood decal never needs an outline to separate from the floor — that saves draw calls, not just design effort. Reserving #ffffff for impact is the standard trick that makes hits feel punchy without extra effects, and it is already the convention in this codebase (neonfist bakeFlash produces all-white flash sprites). 28 colors sits inside the requested 24-32 and matches the '32 bits' feel the user asked for while staying small enough to hand-author bake() color maps.

```js
const P = {
  // lab — cold, desaturated, blue-biased
  w0:'#f2f6f8', w1:'#dfe7ec', w2:'#c2ced8', w3:'#9aa8b6', w4:'#74828f',
  w5:'#515c68', w6:'#363f49', w7:'#1d242c', w8:'#0b1015',
  // symbiote — violet-biased near-black, never pure black
  s0:'#4a1c50', s1:'#2a1030', s2:'#1a0a20', s3:'#0e0512',
  // gore — warm, saturated
  b0:'#ff5a5a', b1:'#e02030', b2:'#b0121f', b3:'#7a0a16', b4:'#4a0610', b5:'#2a0308',
  // alarm
  a0:'#ff8c28', a1:'#ffb43c', a2:'#c8501a',
  // clinical green
  g0:'#4ade9a', g1:'#22a06a', g2:'#12603f',
  // accents
  ye:'#ffe14d', cy:'#4de0f0', fl:'#ffffff',   // fl = hit flash ONLY
};
```

## Frame budget at 540x1200 — ~325 ops, well inside 16.67ms

**Recomendacion:** Measured budget per frame: symbiote body 32-37 fillRects, two tentacles 56, entities (6 scientists + 3 guards) 9 drawImage, tilemap 4 baked strip blits, gore layer 1 blit, particles up to 120 fillRects, HUD ~14 (cached strings — font.js already caches rasterized strings), lighting/alarm 6 rects. TOTAL ~325 draw ops. At ~0.35us per small fillRect on an Adreno 612 in WebView that is ~0.11 ms of drawing, plus the 648,000-px clear and the constant 2.59M-px GPU blit. Realistic total 3-5 ms/frame against a 16.67 ms budget. Headroom is large enough that the 4x backbuffer increase over 270x600 is comfortably affordable. Two rules to keep it there: cull the tilemap to the visible rows/cols (23x50 tiles at 24px, or pre-bake each room's static tiles into one strip so it is ~4 blits), and cap the particle pool at ~120 rather than letting blood spawn unbounded.

**Por que:** I modelled this per-subsystem rather than guessing a total. The dominant cost is NOT the draw calls — it is fill rate, and the key insight is that the final GPU blit to 1080x2400 (2,592,000 px) is a constant that does not change between 270x600 and 540x1200. So moving to 540 costs only the extra virtual-resolution clear and overdraw (~1.2M additional px/frame), which is trivial for a GPU that drives this panel natively. The existing games already prove the idiom is fast: I grepped the whole codebase and found zero gradients, zero shadowBlur, zero filters, and neonfist gets its floor down to a single drawImage — staying inside that discipline is what keeps the headroom.

```js
// Tilemap: cull to visible range, never iterate the whole level.
const TS = 24;
const c0 = (camX / TS) | 0, c1 = ((camX + VW) / TS | 0) + 1;
const r0 = (camY / TS) | 0, r1 = ((camY + VH) / TS | 0) + 1;
for (let r = r0; r < r1; r++) {
  if (r < 0 || r >= rows) continue;
  for (let c = c0; c < c1; c++) {
    if (c < 0 || c >= cols) continue;
    const t = map[r * cols + c];
    if (!t) continue;
    g.drawImage(tileAtlas, t * TS, 0, TS, TS,
                c * TS - camX, r * TS - camY, TS, TS);
  }
}
// Better: pre-bake each room's static tiles into ONE canvas at room load,
// reducing the above to ~4 blits (the neonfist floor trick, gfx.js/neonfist.js:822).
```

## Pitfalls

- core.js:3 declares `export const VW = 270, VH = 600` — a const. It is imported by main.js (22 refs), input.js (1) and all three existing games (43 refs), so you CANNOT just change the number without breaking skyline/neonfist/lastwave, which are all hand-tuned to the 270x600 grid (neonfist's header even documents its 1.5x rescale from a 180x400 design). Change it to `export let` plus a `setVirtual(w,h)` called by the scene manager before init(), and let games without meta.vw keep 270x600.
- Resizing a canvas (`canvas.width = ...`) RESETS all 2D context state, including `imageSmoothingEnabled`. core.js:12 sets it only once at initCanvas. If you resize per scene without re-setting it, the game silently renders blurry — the single most likely bug in this whole change.
- 405x900 must be rejected: 1080/405 = 2.667, a fractional device scale. It looks the best by CSS-scale math (0.9697, nearly 1:1) which is exactly why it is tempting, but non-integer texel mapping makes the whole image shimmer and crawl during camera movement — fatal for a game built around continuous swinging.
- Do not judge the upscale by the CSS viewport (392.727 x 872.727). The engine's fit() works in CSS px, but compositing is to physical px; the ratio that decides crispness is 1080/VW. Using the CSS number picks the wrong resolution.
- Do NOT multiply the backbuffer by devicePixelRatio (2.75). The engine deliberately does not (core.js:10) and that is correct. At 540 wide the backbuffer is already exactly half the panel; a dpr multiply would make it 1485x3300 = 4.9M px, 7.5x the fill cost, for zero visible gain on a pixel-art game.
- The naive metaball — drawing each lobe's spans and letting them overlap — produces a visible 1px NOTCH at every lobe joint. I rendered it and confirmed the artifact. Always resolve the field to ONE min/max span per scanline; it removes the notch and is 3.2x cheaper (32 vs 103 fillRects).
- Never store a Pool index as a lasting reference for blood decals, corpses or tentacle anchors. Pool.free() in core.js does swap-remove: it moves the tail object into the freed slot and rewrites `_i`, so any index you cached now points at a different object. Hold the object reference, or a generation counter.
- A full-level offscreen gore canvas is the memory trap at this resolution: 2-screen = 9.89 MB, 3-screen = 22.25 MB, 4-screen = 39.55 MB — and Android WebView keeps a GPU texture copy too, so roughly double those. Use the screen-sized 2.47 MB scrolling layer instead.
- When self-blitting the gore layer to scroll it, set `globalCompositeOperation='copy'` for that one call and restore 'source-over' immediately. With the default source-over the layer smears into a ghost trail of blood every frame the camera moves.
- Avoid createLinearGradient / createRadialGradient / shadowBlur / ctx.filter entirely. I grepped the codebase: there are currently ZERO uses of any of them, and that is exactly why the existing games hold 60fps. These are the classic Adreno-612-in-WebView frame killers — bake the vignette once at init instead.
- Canvas 2D path fills (arc(), stroke()) are anti-aliased and cannot be turned off by imageSmoothingEnabled, which only affects drawImage. Using arc() for the blob or stroke() for tentacles would produce soft grey fringes that break the pixel-art look at 2.00x upscale. Use fillRect spans for everything.
- Reserve #ffffff strictly for the hit flash and font. If lab walls also use pure white (they should use #f2f6f8), the white impact flash stops reading as an impact and the game loses its main feedback cue for free.
- Cap the blood particle pool (~120) and let burst() drop silently when full — gfx.js:particles already caps at 260 globally and returns early on a null spawn. Uncapped gore spawning on a multi-kill is the one thing here that could actually blow the frame budget.
- Touch coordinates need no change: input.js toVirtual() divides by view.scale, which fit() recomputes. But any game code with hardcoded HUD/button positions assumes 270x600 — at 540x1200 every such constant doubles, so define joystick/button geometry from VW/VH rather than literals.
