# CARRION research: art

## Drag model: absolute finger target, not relative offset

**Recomendacion:** Use ABSOLUTE finger position as the pull target, in SCREEN/virtual coords (not world coords). Each frame compute d = dist(finger, bodyScreen). DEAD = 12px (dead zone, 1.49mm at 409ppi, just above the ~1mm finger-jitter floor): mag = 0. PULL_MAX = 190px (23.6mm, comfortable thumb arc without lifting the palm): mag saturates at 1 and stays 1 beyond it, never overshoots. Between them mag = clamp((d-DEAD)/(PULL_MAX-DEAD), 0, 1). NEAR = 40px soft ramp: if d < NEAR, multiply mag by (d-DEAD)/(NEAR-DEAD), so the creature eases to a stop under the finger instead of jittering. dir = normalized (finger - bodyScreen), recomputed on every move AND every frame (the body moves under a stationary finger, so the vector must be re-derived from the live body position, never cached at pointerdown). Verified curve: d=0 -> 0.000, d=12 -> 0.000, d=20 -> 0.013, d=40 -> 0.157, d=80 -> 0.382, d=140 -> 0.719, d=190 -> 1.000, d=260 -> 1.000 (monotonic, no discontinuity). Absolute beats relative here because Carrion movement is 'go there', a continuous destination, not a virtual-stick velocity; relative offset also drifts its origin over a long flow and forces re-centering. Finger ON the body = full stop is the key affordance: it makes 'hold still' a natural gesture rather than a mode.

**Por que:** The failed v1 was fire/anchor/swing/release. The premise of the fix is that the creature CONTINUOUSLY flows toward a point the player indicates. Absolute targeting expresses exactly that with no state machine: there is no aim phase, no commit, no release. I tested absolute-with-offset-baked-into-the-input-vector first and it was wrong in a way that only showed up numerically: putting the finger exactly on the body produced mag 0.20 pointing DOWN, with the true null point 46px above the body. That inverts the player's mental model. The offset must move the BODY, never the input vector.

```js
const DEAD=12, PULL_MAX=190, NEAR=40;
function recompute(C,bsx,bsy){            // bsx/bsy = body in SCREEN coords
  const dx=C.fx-bsx, dy=C.fy-bsy, d=Math.hypot(dx,dy);
  if(d<DEAD){ C.mag=0; return; }          // dir kept: no snap on re-entry
  const inv=1/d; C.dirX=dx*inv; C.dirY=dy*inv;
  let m=(d-DEAD)/(PULL_MAX-DEAD); m=m<0?0:m>1?1:m;
  if(d<NEAR) m*=(d-DEAD)/(NEAR-DEAD);     // soft ramp out of the dead zone
  C.mag=m;
}
```

## Finger occlusion: camera lead of 72px, measured against the thumb contact patch

**Recomendacion:** Pick CAMERA LEAD, not body-offset-from-touch and not transparency. Set LEAD = 72px, applied as a camera shift OPPOSITE the drag direction, scaled by mag, smoothed at 0.10*dt*60 per frame: leadX += (-dirX*LEAD*mag - leadX)*s. Add it to WorldCam.follow's existing lax/lay look-ahead (do not fight it; feed lead in as an extra term). Settle profile measured: 33.7px at 0.10s, 51.7px at 0.20s, 66.3px at 0.40s, 70.9px at 0.67s; on release it decays to 24.7px in 0.17s and 3.0px in 0.50s. Reject the alternatives explicitly: offsetting the body from the touch point breaks the 'finger on body = stop' affordance and makes the creature feel like it is dodging the finger; global transparency on the creature destroys the red-flesh-on-dark-lab read that is the entire art direction, and Carrion's whole appeal is looking at the mass.

**Por que:** This is the number the whole scheme turns on, and it must be measured, not guessed. Redmi Note 10 is 1080x2400 at ~409ppi, and at 540x1200 virtual one virtual px = 0.124mm. An adult thumb contact patch is ~11mm wide = 89 virtual px, radius ~44px. The creature body is BODY_R=9, i.e. 18px = 2.2mm across. The body is roughly 5x smaller than the finger covering it, so it is not partially occluded, it is entirely buried. Clearance math: lead must exceed patchR(44) + BODY_R(9) = 53px for the body edge to emerge, and patchR(44) + fan radius(26) = 70px for the tentacle fan to clear. I initially picked 52px and the measurement showed it leaves the body 1px SHORT of clearing the thumb, i.e. the worst possible value. 72px clears both body and fan with margin, at 8.9mm of framing shift, which reads as the camera leaning into the motion rather than as the creature sliding off the finger.

```js
const LEAD=72, LEAD_S=0.10;
function tick(C,dt){
  const tx=C.active?-C.dirX*LEAD*C.mag:0;
  const ty=C.active?-C.dirY*LEAD*C.mag:0;
  const s=Math.min(1,LEAD_S*dt*60);       // framerate-independent smoothing
  C.leadX+=(tx-C.leadX)*s; C.leadY+=(ty-C.leadY)*s;
}
// in draw/camera: wcam.follow(L,B.x,B.y,B.vx,B.vy,dt) then offset by C.leadX/C.leadY
```

## Attack button: geometry for both orientations, validated against touch-target minimums

**Recomendacion:** PORTRAIT (540x1200): center (VW-96, VH-190) = (444, 1010), visual r = 54, hit pad = 22 -> touch radius 76. LANDSCAPE (1200x540): center (VW-108, VH-92) = (1092, 448), visual r = 50, hit pad = 26 -> touch radius 76. Identical touch radius across orientations so muscle memory transfers; the visual shrinks slightly in landscape because vertical room is scarce. Physical check at 409ppi: visual diameter 13.4mm, touch diameter 18.9mm, versus the 9-10mm Google/MIT minimum, so it passes with roughly 2x margin. Portrait center sits 24mm from the bottom edge and 12mm from the right edge, inside natural right-thumb arc. Add SLIP = 36px: once the finger owns the button it keeps it until it strays beyond r+pad+36, so a thumb rolling during a mash does not drop the input.

**Por que:** Both orientations must be specified up front because the layout reflows live. Equal touch radius with unequal visual radius is the standard trick for keeping cross-orientation muscle memory while respecting a 540px-tall landscape viewport. The slip radius matters specifically for a button that gets mashed during a kill chain.

```js
function layout(C,VW,VH,land){
  C.land=!!land;
  if(land){ C.btnX=VW-108; C.btnY=VH-92;  C.btnR=50; C.btnPad=26; }
  else    { C.btnX=VW-96;  C.btnY=VH-190; C.btnR=54; C.btnPad=22; }
}
function hitBtn(C,x,y){
  const dx=x-C.btnX, dy=y-C.btnY, r=C.btnR+C.btnPad;
  return dx*dx+dy*dy<=r*r;
}
```

## Attack verb: SNATCH — a tentacle whips out, grabs, and drags the prey into the mass

**Recomendacion:** The verb is SNATCH, not a lunge and not a swing. On press, pick the best target within ATK_R = 96px (4 tiles at TS=24) in a forward-biased cone: score each live enemy by dist, reject if dot(normalize(e-body), dirX/dirY) < ATK_COS = -0.20 (a ~101-degree half-angle, generous so it almost never feels denied, but still refuses targets strictly behind). Require line of sight via the existing DDA raycast so you cannot snatch through walls. Then: spawn a tentacle via R.fire toward the target, store the target's UID (never the pool index, Pool is swap-remove), reel the prey in at ~420px/s. Contact = kill, routed straight into the existing onKill(e,dx,dy,hard) so gore, combo and score already work. ATK_CD = 0.28s from press, which is faster than the 0.4s combo window in onKill, so mashing chains kills into the 'big' branch (comboN>=2) rather than fighting it. If no target passes, still throw a short tentacle lash in dir at 0.28s cooldown: never punish a press with nothing, a dead button reads as a broken button. Movement is NEVER interrupted by attacking, the drag keeps flowing throughout, which is exactly what separates this from the v1 stop-to-aim feel.

**Por que:** Grab-and-drag is the Carrion verb, and it is the one that reuses the most existing machinery: sym-rope's solver (keep it, throw away only the single-anchor locomotion), sym-world's findByUid, and sym-gore untouched. Tying the cooldown just under the existing 0.4s combo window means the chain mechanic already in onKill becomes the skill expression for free. The cone deliberately reaches slightly behind because a hard 90-degree cutoff generates false denials when the creature is flowing fast and the body has rotated past the target.

```js
const ATK_CD=0.28, ATK_R=96, ATK_COS=-0.20;
function pickTarget(pool,bx,by,dirX,dirY,losFn){
  let best=null, bestD=ATK_R*ATK_R;
  for(let i=0;i<pool.n;i++){
    const e=pool.items[i]; if(!e.alive||e.dead) continue;
    const dx=e.x-bx, dy=e.y-by, d2=dx*dx+dy*dy;
    if(d2>=bestD) continue;
    const d=Math.sqrt(d2)||1;
    if((dx/d)*dirX+(dy/d)*dirY < ATK_COS) continue;   // strictly behind
    if(!losFn(bx,by,e.x,e.y)) continue;               // no snatch through walls
    best=e; bestD=d2;
  }
  return best;                                        // caller stores best.uid
}
```

## Pointer arbitration: role guard on re-down fixes a real stuck-input bug

**Recomendacion:** Two roles, dragId and atkId, both init -1. On down: FIRST clear any role this same pointerId already holds, then test the button (attack wins when atkId is free and the point is inside r+pad), else claim drag if dragId is free, else ignore. A third finger is silently dropped and never disturbs either active role. On move: route strictly by id, drag updates finger position, attack checks the slip radius. On up/cancel: clear only the matching role. Lifting the drag finger while attack is held zeroes mag and leaves atkId intact, and the next finger down anywhere claims drag cleanly; REGRAB = 0.20s after a drag lift lets the creature coast instead of dead-stopping, so a re-grab mid-flow is seamless. CRITICAL BUG FOUND AND FIXED: without the leading role-clear, a pointerId that reappears without its up (WebView recycles ids after a dropped pointercancel) can own BOTH roles at once. My fuzz run hit this 15 times: atkId=3 held, a fresh down with id 3 arrived, and the same finger became dragId=3 too, after which one physical lift clears only one role and the other sticks forever, giving a jammed attack button or a creature that keeps flowing with no finger on the glass. After the fix: 40 seeds x 400 randomized events including live rotations = 0 violations across every invariant (no shared id, mag in [0,1], active === dragId!==-1, btnDown === atkId!==-1, all floats finite).

**Por que:** This is not a theoretical hardening. Android WebView does reissue pointer ids after a cancel that the page never sees (notification shade, palm rejection, an OS gesture stealing the stream), and the failure mode is exactly the class of bug that gets reported as 'it froze' or 'the button stopped working' and is nearly impossible to reproduce by hand. The guard is three lines and makes the role table self-healing.

```js
function down(C,ev,bsx,bsy){
  // An id that reappears without its up must never hold both roles.
  if(ev.id===C.atkId){ C.atkId=-1; C.btnDown=false; }
  if(ev.id===C.dragId){ C.dragId=-1; C.active=false; C.mag=0; }
  if(C.atkId===-1 && hitBtn(C,ev.x,ev.y)){
    C.atkId=ev.id; C.btnDown=true; C.btnEdge=true; return 'atk';
  }
  if(C.dragId===-1){
    C.dragId=ev.id; C.fx=ev.x; C.fy=ev.y; C.active=true; C.regrab=0;
    recompute(C,bsx,bsy); return 'drag';
  }
  return 'none';                      // 3rd finger: ignored, disturbs nothing
}
function up(C,ev){
  if(ev.id===C.dragId){ C.dragId=-1; C.active=false; C.mag=0; C.regrab=REGRAB; return true; }
  if(ev.id===C.atkId){ C.atkId=-1; C.btnDown=false; return true; }
  return false;
}
```

## Rotation: re-anchor the in-progress drag, never clamp it

**Recomendacion:** On rotate, call layout() for the new orientation, then REPROJECT any live drag finger by preserving its body-relative offset: fx = clamp(bodyScreenNew.x + (fx - bodyScreenOld.x), 2, VW-2), same for y, then recompute. Do NOT clamp the raw finger coords into the new bounds. Measured on a 540x1200 -> 1200x540 swap with the finger at (150,700) and body centered: clamping swings the heading 9.2 degrees AND inflates distance from 156px to 523px, which would slam the creature from mag 0.81 to full speed at the instant of rotation. Re-anchoring gives 0.0 degrees of heading error and preserves mag exactly (0.810 -> 0.810), with the finger landing at (480,370), in bounds. The attack finger keeps its id through the swap regardless of where the button moved to, and is only released on its own up; re-testing hitBtn at the new position would drop a held button the moment the phone turns. Wire this through core.js setRotatable(true, cb). Keep meta at 540x1200: TS=24 gives 22.5x50 tiles portrait and 50x22.5 landscape, both readable, and it preserves the exact x2 integer upscale on 1080x2400.

**Por que:** Rotation mid-drag is not an edge case here, it is a headline feature the user asked for, so the drag has to survive it invisibly. The clamp-versus-reanchor difference is the kind of thing that feels like a random lurch to the player and is easy to ship by accident, since clamping is the obvious first implementation and looks correct until you measure the resulting vector.

```js
function rotate(C,VW,VH,land,bsxOld,bsyOld,bsxNew,bsyNew){
  layout(C,VW,VH,land);
  if(C.dragId!==-1){                    // keep the vector, move the anchor
    C.fx=clamp(bsxNew+(C.fx-bsxOld),2,VW-2);
    C.fy=clamp(bsyNew+(C.fy-bsyOld),2,VH-2);
    recompute(C,bsxNew,bsyNew);
  }
  // atkId deliberately untouched: a held button survives the swap
}
```

## Same-frame response on pointerdown

**Recomendacion:** onInput must never defer work to the next update(). On drag down: set fx/fy and call recompute() immediately inside the handler, so the very next update() already has a live dir/mag; do not wait for the first move event, or a tap-and-hold produces one frame of stall. On attack down: set btnEdge synchronously and, in the same handler, fire the SFX via the existing Web Audio path plus vibrate(12) — audio and haptics must not wait for the frame boundary, since a 16.7ms audio delay is audible as mush on a press. Consume btnEdge inside update() (const e=C.btnEdge; C.btnEdge=false) so a press is never lost when two downs land between frames. input.js already calls preventDefault and setPointerCapture on pointerdown, which is what keeps WebView from injecting its own ~300ms gesture delay; keep both. Budget: perceived latency = touch sampling (~8ms) + same-frame handler (0) + one 16.7ms frame, roughly 25ms, which reads as instant.

**Por que:** The v1 complaint was that the creature could not be moved fluidly. Part of that is architectural, but any input that costs an extra frame stacks directly onto the fixed 1/60 accumulator and compounds the sluggishness. Doing the vector math in the handler rather than the update is free and removes a whole frame of lag from every touch.

```js
onInput(ev,ctx){
  const bsx=this.B.x-this.wcam.x, bsy=this.B.y-this.wcam.y;
  if(ev.type==='down'){
    const role=CTL.down(this.C,ev,bsx,bsy);       // recompute() runs inside
    if(role==='atk'){ SFX.hit(); vibrate(12); }   // same frame, not next
    return;
  }
  if(ev.type==='move'){ CTL.move(this.C,ev,bsx,bsy); return; }
  CTL.up(this.C,ev);                              // 'up' and 'cancel'
}
```

## On-screen feedback: pull thread plus tentacle bias, no HUD

**Recomendacion:** Three diegetic cues, zero HUD widgets. (1) PULL THREAD: a 1px dotted line from the body edge to the finger, alpha = 0.10 + 0.22*mag, drawn only while dragging and only in the segment beyond the dead zone, so a resting finger draws nothing. (2) TENTACLE BIAS: skew the fan so roughly 60% of free tentacles reach into dir; this is the primary cue and it is pure character animation, the player reads intent from the creature's own body exactly as in Carrion. (3) DEAD-ZONE PIP: a 12px ring at the finger, alpha 0.15, fading out over 0.25s once mag > 0, which teaches the stop gesture in the first few seconds then disappears forever. The attack button itself is the only chrome: ring at alpha 0.30, filling to 0.85 as ATK_CD expires, and a 3px inner flash on a successful snatch. No arrows, no reticle, no cooldown numerals, nothing that would read as a mobile-game overlay on top of the dark lab.

**Por que:** The art direction is dim red emergency lighting and blood, so any bright UI layer fights it. Tentacle bias is the highest-value cue precisely because it costs no screen real estate and reinforces the redesign's premise: many tentacles out at once, reaching where you point. The pip is a self-removing tutorial, which is the right way to teach a dead zone that is otherwise invisible.

```js
// pull thread: only past the dead zone, alpha rides the pull
if(C.active && C.mag>0){
  const a=0.10+0.22*C.mag;
  const sx=bsx+C.dirX*(BODY_R+3), sy=bsy+C.dirY*(BODY_R+3);
  dottedLine(g,sx,sy,C.fx,C.fy,a);   // 2px on / 5px off, no allocation
}
```

## Pitfalls

- The single highest-value number in this spec is the thumb contact patch: ~11mm = 89 virtual px radius ~44px, versus a body that is only 18px across at BODY_R=9. The creature is ~5x smaller than the finger on top of it. Any occlusion fix under 53px of lead is literally worse than useless, and my own first guess (52px) landed 1px short of clearing the thumb. Do not re-tune LEAD downward without redoing this measurement.
- REAL BUG, already fixed in the reference implementation: without a role-clear at the top of down(), one pointerId can hold dragId and atkId simultaneously (fuzz hit it 15 times in 200 events). WebView reissues pointer ids after a pointercancel the page never receives — notification shade, palm rejection, OS gestures. Symptom is a permanently stuck attack button or a creature that keeps flowing with no finger down, and it is nearly impossible to reproduce by hand. Keep those three lines.
- Do NOT bake the occlusion offset into the input vector. I tried it first: finger exactly on the body then yields mag 0.20 pointing DOWN, with the true stop point 46px above the body. It inverts the player's model and silently destroys the 'rest the thumb to stop' affordance. The offset belongs to the camera, never to the drag vector.
- Do NOT clamp an in-progress drag's finger coords into the new bounds on rotation. Measured: 9.2 degrees of heading error and distance inflated 156px -> 523px, which pins mag to 1.0 and lurches the creature the instant the phone turns. Re-anchor by body-relative offset instead (0.0 degrees, magnitude preserved exactly).
- dir/mag must be recomputed every frame from the LIVE body screen position, not cached at pointerdown. The body moves under a stationary finger; a cached vector makes the creature curve away and orbit past its target instead of settling on it.
- Never store a pool index as a lasting reference for the snatch target. Pool is swap-remove, so indices shift whenever any other enemy is freed. Store e.uid and resolve with the existing W.findByUid each frame; a stale index will grab the wrong enemy or a recycled corpse.
- Do not re-test hitBtn for the attack finger after a rotation. The button moves, the finger did not, and re-testing drops a held button the moment the phone turns. Ownership must persist until that pointerId's own up/cancel.
- ATK_CD must stay below the 0.4s combo window already in onKill (0.28s is chosen for this). Push it above 0.4s and mashing silently stops chaining into the comboN>=2 'big' branch, quietly removing the kill-chain feel with no visible error.
- Keep input.js's preventDefault plus setPointerCapture on pointerdown. Removing either lets WebView reintroduce its gesture delay and steal the stream mid-drag; capture is also what guarantees move/up keep arriving when the finger slides outside the canvas rect.
- Feed the camera lead INTO WorldCam.follow's existing lax/lay look-ahead rather than adding a second competing offset afterward; two independent smoothed followers on the same axis beat against each other and produce a slow visible wobble at the 0.12 and 0.10 smoothing rates.
- sym-world's BSP generator and sym-gore are worth keeping as-is; sym-rope's verlet SOLVER is reusable but its single-anchor grapple locomotion is exactly what must be deleted. The clinical bright tile art conflicts with the dark Carrion look and should be rebaked, but the generator underneath (1600 levels, 0 unreachable) should not be touched.
