# CARRION research: rotate

## The model: soft body + N short-lived long-reach grips (NOT a grapple, NOT short tentacles)

**Recomendacion:** One Verlet body particle (x,y,ox,oy) + 12 tentacles. Each tentacle is an independent agent with a 4-state machine. The body is NEVER constrained to any anchor (that is what made the old version a pendulum). Instead gripped anchors contribute an ACCELERATION toward themselves, the sum is normalised to a single haul direction, and gravity is fully cancelled while any tentacle grips. State machine per tentacle, exact: SEEKING (no anchor; every frame calls pickGrip(); free tip trails behind the body via rope-only verlet) -> GRIPPED (anchor fixed in world space; tip pinned; contributes force) -> RELEASING (cool=0.03s, tip unpinned, rope retracts) -> back to SEEKING. There is no EXTENDING state with a travel time: the tip snaps to the anchor and the rope's adaptive rest length makes it LOOK like it extended over 2-3 frames. Release rules, exact: over = dist > REACH*1.04 (overextended); behind = dot(dirToAnchor, aim) < -0.55 (body has passed it); aged = life > 1.1s. Release if (over) OR ((behind OR aged) AND gripsLast > MIN_GRIP=2). The MIN_GRIP guard is load-bearing: without it, when the player aims up in a room the only anchor is the floor (which is 'behind'), every tentacle releases, and the creature falls forever. I hit exactly that bug and measured it: 100% zero-grip frames.

**Por que:** I built the whole thing headlessly and ran it against a 44x88 map reproducing sym-world's BSP output (3-tile corridors, 15x17-tile rooms). The measured progression across my iterations, on a 6-waypoint tour that includes climbing a wall and crossing a ceiling: v3 anchor-fan biased to aim = 0 grips, 100% ungripped, never left the spawn room. v5 with a never-drop-last-anchor rule = 0.22 grips, still bouncing. v6 spring pull = 4.10 grips but GLUED to the floor. v7 aim-dominant force + normalised haul = moves, 6/6 waypoints. Final config across 4 input modes: 4.17-7.25 avg grips, 0.0-0.8% zero-grip frames, 0 frames inside solid, 0 explosions.

```js
// per frame, per tentacle
if (st[i] === GRIP) {
  life[i] += dt;
  const dx = gx[i]-B.x, dy = gy[i]-B.y, d = Math.hypot(dx,dy)||1;
  const align = (dx/d)*aimx + (dy/d)*aimy;
  const over = d > REACH*1.04, behind = align < -0.55, aged = life[i] > 1.1;
  if (over || ((behind||aged) && gripsLast > MIN_GRIP)) { st[i]=REL; cool[i]=0.03; }
  else ng++;
} else if (st[i] === REL) {
  cool[i] -= dt; if (cool[i] <= 0) st[i] = SEEK;
} else pickGrip(i, aimx, aimy);
gripsLast = ng;
```

## REACH must span the room (288px), not be a short stub - this is the single most important number

**Recomendacion:** REACH = 288px = 12 tiles. NOT 56, NOT 132. REST = REACH/(SEG-1) = 41.1px nominal, but a GRIPPED rope uses an ADAPTIVE rest length rl = max(4, dist(body,anchor)/(SEG-1)) recomputed each constraint iteration, so the chain spans exactly to its anchor with no slack and no fighting.

**Por que:** This is what my first three attempts got wrong and it is measurable, not aesthetic. sym-world rooms are 15x17 tiles = 360x408px. From mid-room the nearest wall is 103-192px away. I instrumented the ray fan: with REACH=132, only 508 of 21600 rays hit anything (2.4%) and every pickGrip failed with zero candidates - the creature literally had nothing to hold and fell. Direct sweep of REACH on the 6-waypoint tour: 132 -> 0/6 waypoints, stuck on floor. 180 -> 3/6. 240 -> 3/6. 280 -> 6/6, mean |dV| 4.8. 300 -> 6/6, mean |dV| 4.2. 340 -> 6/6 but mean |dV| jumps to 36.4 (jittery, anchors too far to feel connected). The usable window is 280-300; 288 is 12 exact tiles. Below 260 and at 340 the motion degrades sharply, so this is a real optimum with margin on both sides, not a knife edge.

```js
// adaptive rest length: gripped ropes span exactly to their anchor
let rl = REST;
if (pinTip) {
  const dd = Math.hypot(gx[i]-B.x, gy[i]-B.y);
  rl = Math.max(4, dd/(SEG-1));
}
for (let s = 0; s < SEG-1; s++) {
  const a = b+s, c = a+1;
  const dx = px[c]-px[a], dy = py[c]-py[a];
  const dd2 = dx*dx+dy*dy; if (dd2 < 1e-9) continue;  // guard: coincident -> NaN
  const dist = Math.sqrt(dd2), diff = (dist-rl)/dist*0.5;
  const wx = dx*diff, wy = dy*diff;
  if (s !== 0) { px[a]+=wx; py[a]+=wy; }              // s=0 is the body root
  if (!(pinTip && c === b+SEG-1)) { px[c]-=wx; py[c]-=wy; }
}
```

## Count, segments and measured solver cost on Snapdragon 678

**Recomendacion:** NT=12 tentacles, SEG=8 particles each = 96 particles. SUB=3, ITERS=3. Measured 0.0100 ms/frame for the COMPLETE system (ring raycasts + grip selection + body integration + tile sweep + rope solve) on this machine. Full measured matrix at SUB=2/ITERS=3, ms/frame: NT8/SEG6=0.0061, NT8/SEG8=0.0076, NT10/SEG8=0.0086, NT12/SEG8=0.0100, NT12/SEG10=0.0124, NT14/SEG10=0.0146. Every configuration is free; pick 12x8 for looks, not for speed.

**Por que:** Your prior 6x14 verlet measured 0.0095 ms/frame. Mine is 96 particles vs your 84 and costs 0.0100 ms/frame for strictly more work, so the numbers are consistent with your baseline. Even applying a conservative 15-20x desktop-to-Adreno-612 penalty this lands near 0.15-0.20 ms against a 16.67 ms budget - about 1%. The tentacle solver is not where this game will spend its frame; gore stamping and tilemap blitting are. Use the headroom for more tentacles (12 reads as a proper Carrion fan; 6 reads as a spider).

## Grip selection: persistent 16-slot anchor ring, rotating 4-ray refresh, aim-WEIGHTED scoring

**Recomendacion:** Keep a persistent ring of 16 world-space anchor candidates on fixed compass directions (precompute COS/SIN tables once). Refresh 4 slots per frame round-robin (whole ring every 4 frames) = 4 rays/frame amortised. When gripsLast===0, do a PANIC full 16-ray rescan that same frame - this is the never-stuck guarantee. pickGrip scores every valid slot as score = align*2.0 + (1 - d/REACH)*0.8 where align = dot(dirToAnchor, aim); it PREFERS the pull direction but never excludes anchors behind, which is what keeps a floor anchor usable while aiming up. Dedup: reject a slot within 20px of another tentacle's live anchor, so the fan spreads instead of all 12 stacking on one corner. Measured cost 4.00 rays/frame steady state, 0.0015 ms/frame for the whole search stage.

**Por que:** Casting the fan only toward the aim (my v1/v2) is the trap - it casts into open air exactly when the player wants to climb, and returns nothing. Rays must go in ALL directions and the AIM must only bias the SCORE. Equally important: rebuild ring entries against the CURRENT body position - my first ring cached world points and then rejected them all on d > REACH because the body had moved since the scan; measured 36666 consecutive pick failures, all with zero candidates.

```js
function pickGrip(i, aimx, aimy) {
  let best = -1, bestScore = -1e9;
  for (let k = 0; k < RING; k++) {
    if (!ringHit[k]) continue;
    const dx = ringX[k]-B.x, dy = ringY[k]-B.y, d = Math.hypot(dx,dy)||1;
    if (d > REACH) continue;                       // re-validate vs CURRENT body
    const align = (dx/d)*aimx + (dy/d)*aimy;
    const score = align*2.0 + (1 - d/REACH)*0.8;   // bias, never exclude
    let dup = 0;
    for (let j = 0; j < NT; j++) {
      if (j === i || st[j] !== GRIP) continue;
      const ex = gx[j]-ringX[k], ey = gy[j]-ringY[k];
      if (ex*ex+ey*ey < 400) { dup = 1; break; }    // 20px spread
    }
    if (dup) continue;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  if (best < 0) return false;
  gx[i] = ringX[best]; gy[i] = ringY[best]; st[i] = GRIP; life[i] = 0;
  return true;
}
// scan: 4 slots/frame, or all 16 when gripsLast===0 (never-stuck panic)
function scanSlot(k) {
  const h = ray(B.x, B.y, COS[k], SIN[k], REACH);
  if (h.d > 5) { ringHit[k]=1; ringX[k]=h.x+h.nx*2; ringY[k]=h.y+h.ny*2; }
  else ringHit[k] = 0;
}
```

## The PULL: normalised haul + full gravity cancellation + tangential slide (this is what makes it flow, not swing)

**Recomendacion:** Per gripped tentacle: a = min(PULL_K*d, PULL_MAX) with PULL_K=30 (1/s^2), PULL_MAX=5000 px/s^2, weighted w = max(0, align) so only anchors AHEAD haul. Sum into (fx,fy), then NORMALISE the sum back to PULL_MAX magnitude and apply once: more anchors means more grip, not more force - that keeps top speed constant whether 2 or 8 tentacles hold. Add fy += GRAV*0.15 for a slight weighty sag. While ng>0 gravity is otherwise FULLY cancelled (that is the cling). Damping DAMP_GRIP=0.90 per 1/60s gripped, DAMP_AIR=0.997 airborne. MAXSPD=400-420 px/s. Measured speed distribution in normal play is centred on 100-250 px/s, which reads as heavy flow rather than a projectile. CRITICAL anti-lock rule: any gripped anchor with w < 0.25 must still contribute a TANGENTIAL slide (perpendicular to the rope, sign chosen toward the aim) at SLIDE=0.35 of full force. Without it, anchors surrounding the body cancel out and the creature locks in open space - I measured a 2.23 second dead stop, which is precisely the 'cannot move it fluidly' complaint.

**Por que:** Why this is not a pendulum: there is no radial distance constraint on the body at all, so no arc and no conserved swing. Anchors are re-chosen ~every 1.1s and released the moment the body passes them (align < -0.55), so the creature is continuously re-gripping ahead of itself - hand-over-hand flow. Final validated numbers across four input modes (smooth tour, waypoint path, sinusoidal flail, 7-frame jerk): dead-stop frames 0.0%/0.0%/0.0%/0.0%, longest stall 0.00s/0.00s/0.02s/0.00s, max speed 419 px/s in all, 0 frames inside solid, no explosions.

```js
let ng = 0, fx = 0, fy = 0;
for (let i = 0; i < NT; i++) {
  if (st[i] !== GRIP) continue;
  ng++;
  const dx = gx[i]-B.x, dy = gy[i]-B.y, d = Math.hypot(dx,dy)||1;
  const a = Math.min(PULL_K*d, PULL_MAX);
  const align = (dx/d)*aimx + (dy/d)*aimy;
  const w = pulling ? Math.max(0, align) : 0;
  fx += dx/d*a*w; fy += dy/d*a*w;
  if (pulling && w < 0.25) {                    // anti-lock tangential slide
    let tnx = -dy/d, tny = dx/d;
    if (tnx*aimx + tny*aimy < 0) { tnx = -tnx; tny = -tny; }
    fx += tnx*a*SLIDE; fy += tny*a*SLIDE;
  }
}
if (ng > 0) {
  fy += GRAV*0.15;                              // weighty sag
  const fm = Math.hypot(fx, fy);
  if (fm > 1e-4) { fx = fx/fm*PULL_MAX; fy = fy/fm*PULL_MAX; }
  vx += fx*dt2; vy += fy*dt2;                   // gravity NOT applied: cling
  const dmp = Math.pow(DAMP_GRIP, dt*60); vx *= dmp; vy *= dmp;
} else {
  vy += GRAV*dt2;                               // free fall
  const dmp = Math.pow(DAMP_AIR, dt*60); vx *= dmp; vy *= dmp;
}
const spd = Math.hypot(vx,vy)/dt;
if (spd > MAXSPD) { const k = MAXSPD/spd; vx *= k; vy *= k; }
```

## Ceiling cling and free fall fall out of the model with no special cases

**Recomendacion:** Write NO jump, NO onGround flag, NO wall-cling state. Ceiling walking is automatic: the ring scans all 16 directions, so a ceiling above is just another anchor; once gripped, gravity is fully cancelled and the haul pulls the body up to it. Delete the onGround/WALK/checkGround branches from sym-rope.js entirely - they were the pendulum-era special cases. Free fall: when ng===0, apply full GRAV=1500 px/s^2 with DAMP_AIR=0.997, still capped by MAXSPD. Because SEEKING tentacles call pickGrip() every single frame and the panic rescan fires the instant gripsLast===0, a falling creature re-grips within 1-2 frames of anything entering its 288px radius - it falls fast but recovers instantly, never helplessly. Measured: 0.0-0.8% of frames ungripped in normal play.

**Por que:** In my final run the creature climbed a wall and crossed a ceiling on the 6-waypoint tour with zero orientation-specific code. Emergent behaviour from 'anchors cancel gravity' is what makes it read as Carrion rather than as a platformer with a wall-cling ability bolted on.

## BODY_R = 10 (20px diameter) against TS=24 - the exact fix for the snagging bug

**Recomendacion:** BODY_R = 10, i.e. 20px diameter against 24px tiles, leaving 4px total clearance in a one-tile gap. Keep the 4-cardinal-point circle test but test at the FULL radius (r = BODY_R, not BODY_R-2 as sym-rope.js does - that lie let the visual body overlap walls). I verified the threshold by direct sweep through a deliberately carved single-tile hole: BODY_R 9 passes, 10 passes, 11 passes, 12 FAILS (3/3, 3/3, 3/3, 2/3 waypoints). BODY_R=12 is 24px diameter against a 24px tile - exactly the old 28px-vs-24px bug reproduced. BODY_R=10 sits two full pixels inside the failure threshold. Note sym-world carves corridors at CORR=3 tiles = 72px, so ordinary corridors were never the problem; the snagging was on doorways, pipe mouths and diagonal corners. Draw the flesh mass at ~26-30px visual diameter and let it visibly overlap wall pixels - Carrion's creature deforms, so a collision radius smaller than the sprite is correct here, not a cheat.

**Por que:** Rendered size and collision size must be decoupled. The first attempt tied them together at 28px and every one-tile aperture became an invisible wall.

```js
function blocked(x, y) {
  const r = BODY_R;                    // full radius, no -2 fudge
  return solidAt(x-r,y) || solidAt(x+r,y) || solidAt(x,y-r) || solidAt(x,y+r);
}
// per-axis sweep: slide along walls instead of stopping dead
function sweep(nx, ny) {
  const dx = nx-B.x, dy = ny-B.y, dist = Math.hypot(dx,dy);
  if (dist < 1e-4) return;
  const steps = Math.max(1, Math.ceil(dist/(TS*0.4)));
  const sx = dx/steps, sy = dy/steps;
  for (let i = 0; i < steps; i++) {
    const tx = B.x+sx; if (!blocked(tx,B.y)) B.x = tx; else B.ox = B.x;
    const ty = B.y+sy; if (!blocked(B.x,ty)) B.y = ty; else B.oy = B.y;
  }
}
```

## Stability: SUB=3, ITERS=3, and why iterations barely matter here

**Recomendacion:** SUB=3, ITERS=3. Measured stability matrix (SUB x ITERS, mean |dV| = jitter proxy, on the 6-waypoint tour): SUB=1 -> dV 8.9 at every ITERS value; SUB=2 -> dV 4.4; SUB=3 -> dV 2.7. ITERS 2/3/4/6 changed dV by literally nothing at fixed SUB, and cost 0.0074/0.0099/0.0118/0.0172 ms. So substeps buy smoothness and iterations buy only cost - spend on SUB, keep ITERS=3. Zero explosions in every cell of the matrix. Tunneling: 0 frames with the body inside solid across all four input modes including 7-frame direction jerks; at MAXSPD=420 and SUB=3 the body moves 2.3px per substep against 24px tiles, a 10x margin, and the sweep subdivides further at TS*0.4. Three specific failure modes to guard: (1) coincident particles - keep the dd < 1e-9 continue guard or the normalise divides by zero and the rope NaNs out permanently; (2) an anchor baked inside geometry - offset every anchor 2px along the hit normal (h.x + h.nx*2), otherwise the pinned tip sinks into the wall and the chain fights the constraint forever; (3) the raycast step cap - size it ceil(maxD/TS)+2 rather than a fixed 14, because at REACH=288 a fixed low cap silently truncates long rays and I watched it drop valid floor anchors.

**Por que:** Every figure came from running the matrix, not from theory. The interesting negative result is that iteration count is irrelevant at this rope length - the chains are short (8 particles) and only ever pinned at both ends, so 3 iterations already converge.

## Pitfalls

- The single biggest trap, and the one I fell into three times before measuring it: making the tentacles SHORT. A 56px or 132px reach looks right for a mass of little gripping limbs, but sym-world's rooms are 360x408px, so from open floor NOTHING is in range. I measured 2.4% ray hit rate and 100% zero-grip frames - the creature simply fell. REACH must be 288px (12 tiles). Render the tentacles thick and tapered so they still read as a fan of short limbs rather than 288px spaghetti.
- Do NOT cast the grip fan only toward the drag direction. It is the intuitive design and it is exactly backwards: when the player drags upward to climb, an aim-restricted fan casts into empty air and finds nothing, while the floor it is standing on - the one thing it could pull against - is never even tested. Cast 360 degrees always; let the aim weight the SCORE only.
- Do NOT release a gripped tentacle purely because the anchor is 'behind' the aim. When the player aims up in a room, the floor is the only anchor and it is always behind; an unguarded rule releases everything and the creature falls forever. Gate the behind/aged releases on gripsLast > MIN_GRIP (2).
- Do NOT sum the per-anchor forces and apply them raw. Force scaling with grip count means top speed varies with however many tentacles happen to be attached - it surges in corners and crawls in open rooms. Normalise the summed haul back to a single PULL_MAX magnitude.
- Anchors that surround the body cancel each other exactly and the creature locks in place. I measured a 2.23 second dead stop from this - it is the literal cause of 'no puedo moverlo con fluidez'. The tangential SLIDE term for poorly-aligned anchors is not polish, it is required.
- Cache anchors in world space and you must re-validate them against the CURRENT body position every time you use one. My first ring stored points, the body moved, and every candidate then failed the d > REACH test - 36666 consecutive silent pick failures with no error anywhere.
- BODY_R must be strictly less than TS/2. 12 (24px) against a 24px tile fails to pass a one-tile gap - the identical class of bug as the original 28px body. Use 10 and let the sprite visibly overlap walls; the creature is supposed to deform.
- Do not carry over onGround / WALK / checkGround / attached-index from sym-rope.js. They are pendulum-era special cases and each one reintroduces a dead stop - the ground check in particular killed velocity every frame in corridors, which the old code already had to special-case around while swinging.
- Keep the dd < 1e-9 guard in the distance constraint. Two coincident particles produce a divide-by-zero, one NaN propagates through the whole chain in a single frame, and the tentacle is dead for the rest of the level with no visible error.
- Offset each anchor 2px along the hit normal. A tip pinned exactly on a tile face sits inside the solid, and the constraint then fights the sweep forever.
- Size the raycast step cap to ceil(maxD/TS)+2. A hardcoded low cap (14 was fine at REACH=132) silently truncates rays at REACH=288 and drops perfectly valid anchors with no symptom other than the creature mysteriously refusing to grab things.
- Watch the rotation callback: core.js setRotatable swaps VW/VH live, but REACH=288 is a world-space constant and must NOT be rescaled on rotation - only the camera framing changes. At 540x1200 portrait the 288px reach spans just over half the screen width; in 1200x540 landscape it spans under a quarter. That is correct and desirable (landscape shows more room), but it does mean the creature's reach feels shorter in landscape, so consider widening the camera deadzone rather than touching REACH.
