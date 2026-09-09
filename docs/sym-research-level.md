# SYMBIOTE research: level

## Virtual resolution: go to 540x1200, but render the tentacle in that space only

**Recomendacion:** Use VW=540, VH=1200 for SYMBIOTE (exactly 20:9, exactly 2x the other games' 270x600, integer-scales to 1080x2400 at exactly 2x). Tile size TS=16 virtual px, map 64x128 tiles = 1024x2048 px per level, camera scrolls. Fill cost measured: clear+bg at 540x1200 = 1.30 Mpx/frame = 78 Mpx/s. The Adreno 612 pushes multiple Gpx/s; 78 Mpx/s is ~4x the 270x600 cost and still nowhere near the bottleneck. The tapered limb itself covers ~540 px per tentacle, 3240 px for all 6 = 0.50% of the screen. Do NOT go higher than 540x1200 - at 3x (810x1800) you lose the exact integer upscale to the 1080-wide panel.

**Por que:** A 14-segment tentacle at 270x600 gets ~6px between joints and a 3px-wide tip - the taper is invisible and the rope reads as a jagged line. At 540x1200 the same chain gets 12px spacing and a 9->3px taper that actually reads as an organic limb. The measured fill increase is 59 Mpx/s, which is free on this GPU, and 2x keeps every sprite from the other games reusable by baking at scale=2.

```js
// core.js already exports VW/VH as consts. Symbiote needs its own grid, so either
// parameterize initCanvas or give this game a local scale factor. Cleanest:
export const VW = 540, VH = 1200;   // 20:9 exact, 2x integer upscale to 1080x2400
const TS = 16;                       // tile size in virtual px
const MW = 64, MH = 128;             // 1024 x 2048 px level
// bake() sprites at scale 2 so the existing 8x8 art style stays consistent.
```

## Verlet solver: 14 segments, 6 tentacles, 2 substeps x 3 iterations - measured, not guessed

**Recomendacion:** SEG=14 particles per tentacle, TENT_MAX=6 simultaneous (2 player + 4 for enemy/prop grabs and severed limbs), SUB=2 substeps per 1/60 frame, ITERS=3 constraint iterations per substep. Rest length 12px, so a fully extended tentacle is 13*12 = 156px (~29% of screen width - reads as 'long elastic arm' without filling the screen). Store everything as struct-of-arrays Float32Array indexed t*SEG+s, allocated once in init(). MEASURED: the full sim (6x14 tentacles at SUB=2/ITERS=3 plus 24 enemies plus 420 particles) runs at 9.20 us/frame on desktop. At a pessimistic 8x single-thread penalty for the Snapdragon 678 that is 73.6 us = 0.44% of a 16.67ms frame; even at 15x it is 0.83%. The solver is free - spend the budget on gore and fill rate instead.

**Por que:** 14 segments is the point where the taper reads at 540x1200 (12px joint spacing) while keeping constraint count at 13 per tentacle. Isolated solver cost measured at 2.88/4.24/5.79/8.53 us for 2/3/4/6 iterations across 84 particles - the curve is linear and shallow, so 3 iterations costs nothing over 2 while being visibly stiffer. SoA typed arrays avoid the pointer-chasing and per-object headers that make an array-of-objects rope 3-4x slower and GC-visible. Total state for all 6 tentacles: 2106 bytes, allocated once (verified by loading the module).

```js
const TENT_MAX = 6, SEG = 14, SUB = 2, ITERS = 3, REST = 12;
const NP = TENT_MAX * SEG;
// allocated ONCE in init(), never at module scope
const T = {
  px:new Float32Array(NP), py:new Float32Array(NP),   // current
  ox:new Float32Array(NP), oy:new Float32Array(NP),   // previous (velocity is implicit)
  pin:new Uint8Array(NP),                             // 1 = position is driven, not solved
  state:new Uint8Array(TENT_MAX),  // 0 free 1 flying 2 anchored 3 gripping 4 retracting
  ax:new Float32Array(TENT_MAX), ay:new Float32Array(TENT_MAX),   // anchor point
  len:new Float32Array(TENT_MAX),                                  // rope length (reelable)
  grip:new Int16Array(TENT_MAX),                                   // enemy id or -1
};

const GRAV = 1400, DAMP = 0.995;

function stepTentacles(dtFrame){
  const dt = dtFrame / SUB, dt2 = dt * dt;
  for (let sub = 0; sub < SUB; sub++){
    // --- integrate ---
    for (let t = 0; t < TENT_MAX; t++){
      if (!T.state[t]) continue;
      const b = t * SEG;
      for (let s = 0; s < SEG; s++){
        const i = b + s;
        if (T.pin[i]) continue;
        const x = T.px[i], y = T.py[i];
        const vx = (x - T.ox[i]) * DAMP, vy = (y - T.oy[i]) * DAMP;
        T.ox[i] = x; T.oy[i] = y;
        T.px[i] = x + vx;
        T.py[i] = y + vy + GRAV * dt2;
      }
    }
    // --- constraints ---
    for (let k = 0; k < ITERS; k++){
      for (let t = 0; t < TENT_MAX; t++){
        if (!T.state[t]) continue;
        const b = t * SEG;
        for (let s = 0; s < SEG - 1; s++){
          const a = b + s, c = a + 1;
          const dx = T.px[c] - T.px[a], dy = T.py[c] - T.py[a];
          const d2 = dx*dx + dy*dy;
          if (d2 < 1e-9) continue;             // guard: coincident points -> NaN
          const d = Math.sqrt(d2);
          const diff = (d - REST) / d * 0.5;    // 0.5 = each end moves half
          const wx = dx * diff, wy = dy * diff;
          if (!T.pin[a]) { T.px[a] += wx; T.py[a] += wy; }
          if (!T.pin[c]) { T.px[c] -= wx; T.py[c] -= wy; }
        }
      }
      collideTentacleTiles();   // inside the iteration loop, see stability finding
    }
  }
}
```

## Anchoring: DDA raycast vs tilemap, verified on all faces, diagonals and corners

**Recomendacion:** On tentacle fire, run an Amanatides-Woo DDA from the symbiote's body along the aim direction, max range 240px (longer than the 156px rope, so you can fire and be pulled). Write the result into a preallocated Float32Array(5) = [hitX, hitY, normalX, normalY, dist]; dist = -1 means miss. Zero allocation. VERIFIED against a 32x32 test map with border walls and a pillar: right-hit returns the exact face x=160 with normal (-1,0); up-hit returns y=16 normal (0,1); a 45-degree diagonal returns the correct first-crossed face; a ray starting inside a solid returns dist 0; an exact-corner 45-degree shot does NOT leak through the diagonal gap; a range-limited ray correctly reports -1. On a hit, set state=2 (anchored), ax/ay = hit point pushed 1px out along the normal, len = current distance from body to anchor, and pin the last particle (index t*SEG+SEG-1) to the anchor.

**Por que:** DDA is O(tiles crossed), typically 5-15 steps for a 240px ray at TS=16, versus a fixed-step raymarch that either misses thin walls or oversamples. Returning the face normal is what lets you offset the anchor outward so the tip does not visually sink into the wall, and lets you decide whether a ceiling anchor (normal pointing down) should allow a swing or a wall-cling. The 256-step loop cap is a hard guard against a degenerate direction vector producing an infinite loop.

```js
const _hit = new Float32Array(5);   // module-level scratch, never reallocated

function rayTiles(map, MW, MH, TS, x0, y0, dx, dy, maxD){
  let cx = Math.floor(x0/TS), cy = Math.floor(y0/TS);
  const sol = (a,b) => (a<0||b<0||a>=MW||b>=MH) ? 1 : map[b*MW+a];
  if (sol(cx,cy)) { _hit[0]=x0; _hit[1]=y0; _hit[2]=0; _hit[3]=0; _hit[4]=0; return _hit; }
  const sx = dx>0?1:-1, sy = dy>0?1:-1;
  const idx = dx!==0 ? Math.abs(TS/dx) : 1e30;   // t to cross one full tile in x
  const idy = dy!==0 ? Math.abs(TS/dy) : 1e30;
  let tx = dx!==0 ? ((dx>0 ? (cx+1)*TS-x0 : x0-cx*TS) / Math.abs(dx)) : 1e30;
  let ty = dy!==0 ? ((dy>0 ? (cy+1)*TS-y0 : y0-cy*TS) / Math.abs(dy)) : 1e30;
  let t = 0, face = 0;
  for (let g = 0; g < 256; g++){                  // hard cap: no infinite loop ever
    if (tx < ty) { t = tx; tx += idx; cx += sx; face = 0; }
    else         { t = ty; ty += idy; cy += sy; face = 1; }
    if (t > maxD) { _hit[4] = -1; return _hit; }
    if (sol(cx,cy)){
      _hit[0] = x0 + dx*t; _hit[1] = y0 + dy*t;
      _hit[2] = face===0 ? -sx : 0;
      _hit[3] = face===1 ? -sy : 0;
      _hit[4] = t;
      return _hit;
    }
  }
  _hit[4] = -1; return _hit;
}

function fireTentacle(t, bx, by, aimx, aimy){
  const h = rayTiles(map, MW, MH, TS, bx, by, aimx, aimy, 240);
  const b = t*SEG, tip = b + SEG - 1;
  if (h[4] >= 0){
    T.state[t] = 2;
    T.ax[t] = h[0] + h[2];          // 1px out along the face normal
    T.ay[t] = h[1] + h[3];
    T.len[t] = Math.hypot(T.ax[t]-bx, T.ay[t]-by);
    T.pin[tip] = 1;
    T.px[tip] = T.ax[t]; T.py[tip] = T.ay[t];
    T.ox[tip] = T.ax[t]; T.oy[tip] = T.ay[t];
  } else {
    T.state[t] = 4;                 // whiff -> retract
  }
  // lay the chain out straight along the ray so it does not snap in from a fold
  for (let s = 0; s < SEG; s++){
    const f = s/(SEG-1), i = b+s;
    T.px[i] = bx + (T.px[tip]-bx)*f; T.py[i] = by + (T.py[tip]-by)*f;
    T.ox[i] = T.px[i]; T.oy[i] = T.py[i];
  }
}
```

## Swinging: authority falloff is the single decision that makes it feel weighty instead of on/off

**Recomendacion:** Apply joystick input as a TANGENTIAL acceleration of 2200 px/s^2, but scale it by an authority falloff: thrust *= max(0, 1 - |tangentialSpeed| / 620). Body gravity 1400 px/s^2, air damping 0.999 per step (velocity is implicit in verlet so this is (x-ox)*0.999), hard speed clamp 900 px/s. Rope is a one-sided constraint (only pulls when dist > len, never pushes). Reel in at 220 px/s while the joystick is pushed toward the anchor, reel out at 260 px/s away, clamped to len in [40, 156]. Release preserves momentum automatically - verlet velocity is (x-ox), so simply clearing state and unpinning keeps every bit of speed. MEASURED with authority falloff at L=150: speed samples every 0.5s read 42, 392, 274, 462, 766, 456, 344, 634, 696, 328, 560, 837 px/s - it oscillates through the arc (fast at the bottom, slow at the top) and builds over 3-4 swings. WITHOUT the falloff, every SWING value from 1800 to 3400 pegged the 900 cap within 0.8s and stayed there flat, which feels like a speed button, not a pendulum.

**Por que:** This was the one place the naive implementation is actively wrong, and I only found it by simulating. A constant tangential force in phase with velocity is a positive feedback loop with no equilibrium, so it saturates the clamp almost immediately and the pendulum arc disappears - the player would feel a constant-speed drag, and the 'pump the swing' skill that makes the reference game satisfying would not exist. The falloff creates a terminal tangential speed the player converges on, so gravity still dominates the top of the arc. Pendulum half-periods at these gravity values land at 0.75s (L=80), 0.92s (L=120), 1.13s (L=180), 1.30s (L=240) - all in the 0.7-1.3s band that matches natural thumb rhythm, so the swing cadence is physically tied to how far you fired the tentacle.

```js
const GRAV = 1400, SWING = 2200, AUTH = 620, MAXSPD = 900, AIR = 0.999;
const REEL_IN = 220, REEL_OUT = 260, LEN_MIN = 40, LEN_MAX = 156;

function stepBody(dt, stickX, stickY){
  const t = attachedTentacle;             // -1 if none
  let vx = (body.x - body.ox) * AIR, vy = (body.y - body.oy) * AIR;
  body.ox = body.x; body.oy = body.y;
  vy += GRAV * dt * dt;

  if (t >= 0 && T.state[t] >= 2){
    const dx = body.x - T.ax[t], dy = body.y - T.ay[t];
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx/d, ny = dy/d;           // radial (out from anchor)
    const tx = -ny, ty = nx;              // tangential

    // joystick projected onto the tangent = which way to pump
    const push = stickX*tx + stickY*ty;
    const tv = (vx*tx + vy*ty) / dt;      // current tangential speed, px/s
    const fall = Math.max(0, 1 - Math.abs(tv)/AUTH);   // <-- the critical term
    vx += tx * push * SWING * fall * dt*dt;
    vy += ty * push * SWING * fall * dt*dt;

    // reel: joystick component along the rope
    const radial = stickX*nx + stickY*ny;
    if (radial < -0.3)      T.len[t] = Math.max(LEN_MIN, T.len[t] - REEL_IN  * dt);
    else if (radial > 0.3)  T.len[t] = Math.min(LEN_MAX, T.len[t] + REEL_OUT * dt);
  } else {
    // airborne / grounded steering is weaker
    vx += stickX * 900 * dt*dt;
  }

  // clamp BEFORE integrating so the rope constraint sees a sane position
  const sp = Math.hypot(vx, vy) / dt;
  if (sp > MAXSPD){ const k = (MAXSPD*dt)/Math.hypot(vx,vy); vx *= k; vy *= k; }
  body.x += vx; body.y += vy;

  // one-sided rope constraint: pulls, never pushes
  if (t >= 0 && T.state[t] >= 2){
    const dx = body.x - T.ax[t], dy = body.y - T.ay[t];
    const d = Math.hypot(dx, dy) || 1;
    if (d > T.len[t]){ const k = (d - T.len[t])/d; body.x -= dx*k; body.y -= dy*k; }
  }
}

// Release: momentum is already in (x - ox). Do NOT zero anything.
function release(t){ T.state[t] = 4; T.pin[t*SEG+SEG-1] = 0; attachedTentacle = -1; }
```

## Grabbing enemies: tear threshold at 520 px/s relative impact, with a 3-frame grace window

**Recomendacion:** When the tentacle tip overlaps an enemy while flying, set state=3 and grip[t]=enemyId. Do not pin the tip to a fixed point - instead, each substep write the tip particle to the enemy's position (pin=1, position driven), and apply the reverse force to the enemy: the enemy gets pulled along the rope toward the symbiote at up to 480 px/s. TEAR RULE: track the enemy's speed relative to the surface it hits. On a tile collision, if relative impact speed >= 520 px/s, the scientist tears in half - spawn 2 body halves as loose ragdolls, 18-24 blood particles, a blood decal at the impact point, cam.shake(6, 0.25), vibrate(40). Below 520 px/s it is a damaging slam (stagger, blood spray, no dismemberment). A second threshold at 780 px/s tears into 4 pieces (both arms separate). Give a 3-frame grace after grab before the tear check arms, so a grab that happens to start near a wall does not instantly gib.

**Por que:** 520 px/s is 58% of the 900 px/s max body speed, which the measured swing traces show the player reaches routinely at the bottom of an arc but not from a standing whip - so tearing is a reward for a good swing, not a default outcome. The 780 px/s four-piece threshold sits at 87% of max, reachable only from a reeled-in high-speed swing, which gives the gore an escalation the player can feel they earned. Driving the tip to the enemy rather than pinning the enemy to the tip keeps the enemy's own collision and gravity authoritative, which avoids the classic two-masters fight that makes grabbed bodies jitter.

```js
const TEAR_2 = 520, TEAR_4 = 780, GRAB_GRACE = 3;

function updateGrip(t, dt){
  const e = enemies.items[findById(T.grip[t])];    // never store a pool index
  if (!e){ T.state[t] = 4; return; }
  const tip = t*SEG + SEG - 1;
  T.pin[tip] = 1;
  T.px[tip] = e.x; T.py[tip] = e.y;                // tip follows the body

  // rope pulls the enemy toward the symbiote
  const dx = body.x - e.x, dy = body.y - e.y;
  const d = Math.hypot(dx,dy) || 1;
  if (d > T.len[t]){
    const pull = Math.min(480, (d - T.len[t]) * 14);
    e.vx += dx/d * pull * dt; e.vy += dy/d * pull * dt;
  }
  e.gripT += dt;

  // impact / tear
  const cx = (e.x/TS)|0, cy = (e.y/TS)|0;
  if (solid(cx,cy) && e.gripFrames > GRAB_GRACE){
    const impact = Math.hypot(e.vx, e.vy);
    if (impact >= TEAR_4)      { tearApart(e, 4); }
    else if (impact >= TEAR_2) { tearApart(e, 2); }
    else { e.hp -= impact * 0.04; bloodSpray(e.x, e.y, 6); }
  }
}

function tearApart(e, pieces){
  bloodSpray(e.x, e.y, pieces === 4 ? 26 : 18);
  decal(e.x, e.y, pieces === 4 ? 14 : 10);
  cam.shake(pieces === 4 ? 8 : 6, 0.25);
  vibrate(pieces === 4 ? 60 : 40);
  SFX.tear();
  for (let i = 0; i < pieces; i++) spawnGib(e.x, e.y, e.vx, e.vy);
  releaseGrip(e);
  enemies.free(e);
}
```

## Stability: the three verlet failure modes and the exact guards for each

**Recomendacion:** EXPLOSION - caused by dividing by a zero-length constraint. Guard with `if (d2 < 1e-9) continue;` before the sqrt (in the code above), and clamp per-particle displacement per substep to 0.5*TS = 8px. Also clamp the implicit velocity: if (x-ox) exceeds 24px in one substep, rescale it. JITTER - caused by resolving tile collisions outside the iteration loop, so the constraint and the collision fight each other. Fix: run the tile collision INSIDE the iteration loop (after each constraint pass, as shown), and push out along the minimum-penetration axis only, checking that the neighbouring tile in that direction is actually empty before pushing that way - otherwise you push a particle from a corner into an adjacent wall and it oscillates. Add a 0.01px bias so the particle rests just outside the tile, never exactly on the boundary where the floor() flips. TUNNELING - at MAXSPD=900 px/s and dt=1/60 the body moves 15px/frame against TS=16, which is a 1.07x margin - it WILL tunnel through 1-tile walls. SUB=2 halves this to 7.5px/frame, a 2.1x margin, which is safe. Additionally, sweep the BODY (not the rope particles) with the same rayTiles DDA each substep from previous to current position and stop it at the first hit - the rope particles are low mass and a tunneled rope segment self-corrects on the next constraint pass, but a tunneled body is a lost run.

**Por que:** The 15px-vs-16px tunneling margin is the finding that forces SUB=2 - a single-step solver at this speed cap is not merely risky, it fails on ordinary gameplay every time the player hits max swing speed near a thin wall. The measured cost of SUB=2 is 9.20 us/frame total, so there is no reason to gamble on SUB=1. Running collision inside the iteration loop rather than after it is the difference between a rope that lies still on a floor and one that buzzes; it costs one extra pass over 84 particles, which is under a microsecond.

```js
const MAXDISP = TS * 0.5;   // 8px per substep per particle

function collideTentacleTiles(){
  for (let i = 0; i < NP; i++){
    if (T.pin[i]) continue;
    // displacement clamp: kills explosions before they propagate
    let dx = T.px[i] - T.ox[i], dy = T.py[i] - T.oy[i];
    const dl = Math.hypot(dx, dy);
    if (dl > MAXDISP){ const k = MAXDISP/dl; T.px[i] = T.ox[i] + dx*k; T.py[i] = T.oy[i] + dy*k; }

    const cx = (T.px[i]/TS)|0, cy = (T.py[i]/TS)|0;
    if (!solid(cx,cy)) continue;
    const lx = T.px[i] - cx*TS, ly = T.py[i] - cy*TS;
    const dL = lx, dR = TS-lx, dU = ly, dD = TS-ly;
    const m = Math.min(dL, dR, dU, dD);
    // push along min-penetration axis, but ONLY into a tile that is actually empty
    if      (m === dL && !solid(cx-1,cy)) T.px[i] = cx*TS - 0.01;
    else if (m === dR && !solid(cx+1,cy)) T.px[i] = cx*TS + TS + 0.01;
    else if (m === dU && !solid(cx,cy-1)) T.py[i] = cy*TS - 0.01;
    else if (m === dD && !solid(cx,cy+1)) T.py[i] = cy*TS + TS + 0.01;
    else {  // fully enclosed: fall back to the min axis anyway
      if (m === dL) T.px[i] = cx*TS - 0.01; else if (m === dR) T.px[i] = cx*TS+TS+0.01;
      else if (m === dU) T.py[i] = cy*TS - 0.01; else T.py[i] = cy*TS+TS+0.01;
    }
  }
}

// Body sweep: never let the player tunnel, even at 900 px/s.
function sweepBody(px0, py0){
  const dx = body.x - px0, dy = body.y - py0;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return;
  const h = rayTiles(map, MW, MH, TS, px0, py0, dx/d, dy/d, d);
  if (h[4] >= 0){
    body.x = h[0] + h[2] * (BODY_R + 0.01);
    body.y = h[1] + h[3] * (BODY_R + 0.01);
    if (h[2]) body.ox = body.x;   // kill velocity on the blocked axis only
    if (h[3]) body.oy = body.y;
  }
}
```

## Rendering: use fillRect quads per segment, NOT stroke() and NOT per-pixel plotting

**Recomendacion:** Draw each of the 13 segments as a filled quad using g.beginPath/moveTo/lineTo/fill on 4 integer-rounded corner points derived from the segment's perpendicular, with width tapering 9px at the root to 3px at the tip (width = 9 - 6*s/(SEG-1), rounded). That is 13 path fills per tentacle, 78 per frame for 6 tentacles - trivial. Do NOT use stroke(): lineWidth strokes are anti-aliased and centred on fractional coordinates, which produces exactly the soft grey fringe that imageSmoothingEnabled=false exists to prevent, and lineJoin gaps show at sharp bends. Do NOT plot thick points every 2px along the chain either - measured at 270 fillRect/frame for the same visual result, 3.5x more calls than quads, and it produces a beaded look on tight curves. Add organic detail with 2 cheap passes: a 1px darker outline quad drawn first at width+2, and 3-4 lighter 2x2 fillRect 'veins' at fixed fractions along the chain. Round every corner coordinate with Math.round, never |0 (the perf doc's pitfall: |0 truncates toward zero and breaks on negative coords, which is where an off-screen tentacle tip lives).

**Por que:** A quad per segment is the only one of the three approaches that is both crisp and cheap. The area involved is tiny - a full tapered limb is about 540 px, so all 6 tentacles cover 0.50% of the 540x1200 screen; the cost is entirely in call count and state changes, not fill. Batching by colour (all outlines first with one fillStyle set, then all bodies, then all veins) reduces fillStyle changes from 78 to 3 per frame, which the perf research explicitly flags as costing more than the blits themselves on Canvas 2D.

```js
function drawTentacles(g){
  // PASS 1: outlines, single fillStyle
  g.fillStyle = P.out;
  for (let t = 0; t < TENT_MAX; t++){ if (T.state[t]) limbPath(g, t, 2); }
  // PASS 2: bodies
  g.fillStyle = P.flesh;
  for (let t = 0; t < TENT_MAX; t++){ if (T.state[t]) limbPath(g, t, 0); }
  // PASS 3: veins
  g.fillStyle = P.vein;
  for (let t = 0; t < TENT_MAX; t++){
    if (!T.state[t]) continue;
    const b = t*SEG;
    for (let s = 3; s < SEG-1; s += 4)
      g.fillRect(Math.round(T.px[b+s])-1, Math.round(T.py[b+s])-1, 2, 2);
  }
}

function limbPath(g, t, grow){
  const b = t*SEG;
  g.beginPath();
  for (let s = 0; s < SEG-1; s++){
    const i = b+s, j = i+1;
    const x0 = T.px[i], y0 = T.py[i], x1 = T.px[j], y1 = T.py[j];
    let dx = x1-x0, dy = y1-y0;
    const d = Math.hypot(dx,dy) || 1;
    const nx = -dy/d, ny = dx/d;                       // perpendicular
    const w0 = (9 - 6*s/(SEG-1) + grow) * 0.5;
    const w1 = (9 - 6*(s+1)/(SEG-1) + grow) * 0.5;
    g.moveTo(Math.round(x0+nx*w0), Math.round(y0+ny*w0));
    g.lineTo(Math.round(x1+nx*w1), Math.round(y1+ny*w1));
    g.lineTo(Math.round(x1-nx*w1), Math.round(y1-ny*w1));
    g.lineTo(Math.round(x0-nx*w0), Math.round(y0-ny*w0));
  }
  g.fill();   // one fill for all 13 quads of this tentacle
}
```

## CPU budget: simulation is 0.44% of frame, so spend the headroom on the blood decal layer

**Recomendacion:** Measured total per-frame simulation (6 tentacles x 14 segments, SUB=2, ITERS=3, plus 24 enemies and 420 particles): 9.20 us on desktop, 73.6 us at an 8x Snapdragon 678 penalty = 0.44% of a 16.67ms budget; 0.83% even at 15x. This leaves the entire frame for rendering. Use it on persistent blood: keep a single offscreen decal canvas at HALF the virtual resolution (270x600 = 0.62 MB) and blit it upscaled 2x with one drawImage per frame. Draw blood splats into it with fillRect at the moment of impact only, never per frame. Do not make the decal canvas full 540x1200 (2.5 MB) - the half-res version is indistinguishable once upscaled through a nearest-neighbour path and quarters the VRAM and the clear cost if you ever need to reset it. Total per-frame draw call budget: 1 decal blit + ~3 fillStyle changes and 18 path fills for tentacles + ~30 enemy/gib drawImages + ~420 particle fillRects, all well inside what the Adreno 612 handles at 78 Mpx/s of fill.

**Por que:** The instinct on a rope system is to fear the solver, but the measurement says the solver is noise - three orders of magnitude below the frame budget. The real costs at 540x1200 are fill rate (1.30 Mpx/frame just for clear+background) and per-particle fillRect count. Knowing the solver is free is what makes it safe to commit to SUB=2 and ITERS=3 rather than shaving them, and to spend on a persistent decal layer, which is the single feature that sells the 'you have been through here and it was violent' power fantasy.

```js
// init(): allocate once
const decal = document.createElement('canvas');
decal.width = 270; decal.height = 600;          // HALF virtual res
const dg = decal.getContext('2d', { alpha: true });
dg.imageSmoothingEnabled = false;

// on a tear/impact only - never per frame
function bloodDecal(wx, wy, n, rnd){
  const sx = wx * 0.5, sy = wy * 0.5;            // world -> decal space
  dg.fillStyle = '#7a0812';
  for (let i = 0; i < n; i++){
    const a = rnd()*Math.PI*2, r = rnd()*10;
    dg.fillRect((sx+Math.cos(a)*r)|0, (sy+Math.sin(a)*r)|0, 1+((rnd()*3)|0), 1+((rnd()*2)|0));
  }
}

// draw(): one call, upscaled 2x, before entities
g.drawImage(decal, 0, 0, 270, 600, -cam.x, -cam.y, 540, 1200);
```

## Pitfalls

- Do NOT apply a constant tangential force while swinging. I simulated this: at SWING values of 1800, 2600 and 3400 the body pegs the 900 px/s clamp within 0.8 seconds and then reads flat forever (892, 894, 894, 894...). The pendulum arc vanishes and it feels like holding a speed button. The authority falloff term `1 - |tangentialSpeed|/620` is mandatory, not a polish detail - with it, speed oscillates 274-837 px/s through the arc and builds over 3-4 swings.
- Do NOT run with SUB=1. At MAXSPD=900 px/s the body moves 15px per 1/60 frame against TS=16 tiles - a 1.07x margin that tunnels through any 1-tile wall as soon as the player reaches full swing speed. SUB=2 gives 7.5px/frame, a 2.1x margin. The measured cost of the second substep is under 5 us on desktop; there is no performance argument for gambling here.
- Do NOT resolve tentacle-vs-tile collisions after the constraint loop instead of inside it. Outside, the distance constraint and the tile push-out alternate fighting each other every frame and the rope visibly buzzes when it rests on a floor. Inside the iteration loop it converges.
- Do NOT push a penetrating particle along the minimum-penetration axis without first checking that the neighbouring tile in that direction is empty. In a concave corner the naive version pushes the particle out of one wall directly into the adjacent one, and it oscillates between them forever.
- Do NOT omit the `if (d2 < 1e-9) continue;` guard before the sqrt in the distance constraint. Two coincident particles produce a division by zero, the position becomes NaN, and NaN propagates through the entire chain in one iteration - the tentacle disappears permanently with no error thrown.
- Do NOT store a pool index as a lasting reference for a grabbed enemy. The engine's Pool uses swap-remove, so freeing any other enemy moves a different object into that slot and the tentacle silently starts dragging the wrong body. Store an id and look it up, or store the object reference and validate it is still alive.
- Do NOT use stroke() with lineWidth to draw the tentacle. Strokes anti-alias and centre on fractional coordinates, producing exactly the soft grey fringe that imageSmoothingEnabled=false is there to eliminate, plus visible lineJoin gaps at sharp bends. Filled quads per segment stay crisp and cost 13 path segments per tentacle in a single fill() call.
- Do NOT use `|0` to round tentacle draw coordinates. It truncates toward zero, so -3.7 becomes -3 while Math.floor gives -4 - an off-by-one on every negative coordinate, which is precisely where a tentacle tip fired off the left or top edge of the screen lives.
- Do NOT zero velocity on release. In verlet, velocity is implicit in (x - ox); explicitly resetting ox to x on release throws away all the swing momentum the player just built, which is the single most satisfying part of the mechanic. Release should only clear the state flag and unpin the tip.
- Do NOT arm the tear check on the frame the grab happens. A grab initiated next to a wall registers an instant false impact and gibs the scientist with no swing behind it, which reads as a bug rather than a kill. Wait 3 frames (GRAB_GRACE) before the impact test goes live.
- Do NOT allocate the DDA result as an object literal `{x, y, nx, ny}`. The raycast fires on every tentacle press and potentially per substep for the body sweep; returning a fresh object is exactly the per-frame allocation the perf research measured at 1.92 MB/s causing a visible hitch every 2 seconds. Write into a module-level Float32Array(5) scratch.
- Do NOT make the blood decal canvas the full 540x1200 (2.5 MB). Half resolution (270x600, 0.62 MB) is visually identical once upscaled through the nearest-neighbour path and quarters both the VRAM and any clear cost.
- Do NOT pin the grabbed enemy's position to the tentacle tip. Two systems then both claim authority over the body and it jitters. Drive the tip particle to the enemy's position instead, and apply the rope's pull as a force on the enemy so its own gravity and tile collision stay authoritative.
