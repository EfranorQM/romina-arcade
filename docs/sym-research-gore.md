# SYMBIOTE research: gore

## Virtual resolution: stay at 270x600 with 16px tiles, do NOT go to 540x1200

**Recomendacion:** Keep VW=270, VH=600 (the existing shared grid). Tile size 16px => the visible playfield is 16.9 x 37.5 tiles; use a level of 17 tiles wide x 60-90 tiles tall, camera scrolls vertically only (the level is a vertical lab shaft, matching portrait). Player hitbox 10x10, drawn as a 12x12 blob sprite. Tentacle max length 200px. If more detail is wanted later, the upgrade path is 405x900 (still exact 20:9, 1.5x), NOT 540x1200.

**Por que:** 540x1200 is 648,000 backbuffer px/frame vs 162,000 at 270x600 — a 4x fill-rate increase. The perf doc measured the whole existing scene at 2.27x overdraw = 9.8Mpx/s; this game adds a persistent full-screen decal layer blitted every frame (+162k px) plus a tilemap draw, so 540x1200 would push a 3-layer full-screen composite to ~2.3Mpx/frame = 140Mpx/s. That is where an Adreno 612 in a WebView starts missing 16.6ms. The decisive argument is not raw fill though: at 540x1200 a 16px tile occupies 1/34th of screen width, so a lab corridor shows ~10 tiles and the 200px tentacle spans only 37% of the screen — the swing arc stops reading. At 270x600 the same tentacle spans 74% of screen width and the swing is legible. Also, 270x600 keeps the 5x7 font, all UI metrics, the 260-particle pool budget, and cam.shake magnitudes identical to the other three games, so nothing has to be re-tuned.

```js
const VW=270, VH=600, TILE=16;
const MAP_W=17;            // 272px, 2px bleed off right edge is fine
let MAP_H=72;              // per level, 60..90
// camera: vertical only, clamped
camY = clamp(py - VH*0.45, 0, MAP_H*TILE - VH);
// tile lookup is a flat Uint8Array, never a 2D array (no per-frame alloc)
const tiles = new Uint8Array(MAP_W*MAP_H);
const tileAt = (x,y)=>{
  const tx=(x/TILE)|0, ty=(y/TILE)|0;
  if(tx<0||tx>=MAP_W||ty<0||ty>=MAP_H) return 1; // solid outside
  return tiles[ty*MAP_W+tx];
};
// draw only visible rows
const y0=(camY/TILE)|0, y1=Math.min(MAP_H, y0+38);
```

## Persistent gore: a second offscreen canvas as a decal layer, never cleared

**Recomendacion:** Allocate ONE offscreen canvas 272 x (MAP_H*16) at init (for MAP_H=72 that is 272x1152 = 313k px, ~1.25MB RGBA — fine in 4GB). Paint blood splats into it with fillRect only, at the moment of the kill. Draw it each frame with a single drawImage(decal, 0, -camY). Never clear it, never read it back. Cap: track a splatCount; above 900 splats stop adding new ones (visually saturated anyway). Blood decal splat = 6-14 fillRects of 2-4px in 3 reds, placed with rnd around the impact point, plus a 1px darker rim.

**Por que:** This is the only way to get permanent floor/wall gore at zero per-frame cost. The particle pool (cap 260, shared with the whole app) is for the 0.4s spray; it physically cannot hold persistent decals — 30 kills x 20 particles would need 600 slots held forever, starving every other effect. Separating 'spray' (pooled particles, transient) from 'stain' (baked pixels, permanent) gives unbounded visual gore accumulation for the cost of one extra drawImage. Painting is O(splat), amortized to near zero since a kill happens maybe twice a second. Critically: never call getImageData on this canvas — that forces a GPU->CPU readback and would stall the frame on Adreno.

```js
// init()
this.decal = document.createElement('canvas');
this.decal.width = MAP_W*TILE; this.decal.height = MAP_H*TILE;
this.dg = this.decal.getContext('2d');
this.splats = 0;

const BLOOD = ['#8a0f12','#c41419','#6a0a10'];
splat(x,y,n,spread){
  if(this.splats>900) return; this.splats++;
  const dg=this.dg, rnd=this.rnd;
  for(let i=0;i<n;i++){
    const a=rnd()*6.283, r=rnd()*spread;
    const sx=Math.round(x+Math.cos(a)*r), sy=Math.round(y+Math.sin(a)*r);
    const s=1+((rnd()*3)|0);
    dg.fillStyle=BLOOD[(rnd()*3)|0];
    dg.fillRect(sx,sy,s,s);
  }
}
// draw(): one blit, under entities
g.drawImage(this.decal, 0, -Math.round(this.camY));
```

## Control mapping: joystick + ONE tentacle button covering every verb

**Recomendacion:** Left half of screen = floating Stick (existing class, maxR=26, dead=4). Right half = the tentacle zone, but do NOT use the fixed Button class for aiming — use a second floating stick-like tracker: on 'down' in the right half, record origin; the vector from origin to current finger is the AIM direction, and hold duration drives the mode. Verbs by context, zero extra buttons:
(1) TAP right side (<160ms, no target under aim ray) => LUNGE: 120px dash in aim direction, 0.18s, i-frames during it, 12 damage to anything touched, cooldown 0.45s.
(2) TAP with an ENEMY under the aim ray within 200px => GRAB+YANK: tentacle flies out at 900px/s, latches, yanks the enemy to the player over 0.22s, dealing 20 damage on arrival. Scientists (hp 10) die instantly and are TORN (see gore). Cooldown 0.30s.
(3) HOLD right side, ray hits WALL/ANCHOR tile => ATTACH. Tentacle stays latched while held. Now the LEFT stick swings the player: the tentacle acts as a rope constraint (see sketch). Release = let go, momentum preserved. This is the Spider-Man verb.
(4) HOLD right side, ray hits an ENEMY => HOIST: enemy is lifted and dragged behind the player as a flail; enemy takes 6 dmg/s, and any other enemy the flailed body hits takes 15 damage and the carried body takes 10. Release flings the body at 420px/s as a projectile (25 damage to whatever it hits, then the body gibs).
(5) While ATTACHED (state 3), a TAP on the LEFT stick zone (a second finger, tap not drag) => SLAM: player is pulled hard along the tentacle at 700px/s; on arrival, a 44px-radius shockwave does 30 damage. Cooldown 1.2s. This is the only two-finger gesture and it is optional — every level is completable without it.
Aim assist: when picking the ray target, snap to the nearest enemy whose center is within 22px of the aim ray (angular snap), so Romina never misses a scientist she clearly pointed at.

**Por que:** The user fixed the scheme at joystick + tentacle button, and the tension is that a power fantasy needs many verbs. Resolving it by CONTEXT (what the ray hits) and DURATION (tap vs hold) rather than by adding buttons keeps the two-thumb promise literally intact while yielding five distinct verbs. The mapping is unambiguous because the ray target is deterministic and visible: a laser-thin aim line is drawn from the player the moment the finger goes down, colored by what it will hit (grey=wall/attach, red=enemy/grab, dim=nothing/lunge). Romina always sees which verb she is about to get BEFORE committing — that is what makes a context-sensitive button fair rather than random. The tap threshold at 160ms is below the median deliberate-hold time (~250ms) and above the median tap (~90ms), so misclassification is rare. Cooldowns are short because this is a power fantasy: the failure state should be getting shot, never waiting on a cooldown.

```js
// Rope constraint while ATTACHED — this is the whole swing feel.
// ax,ay = anchor point. Player is a point mass with gravity-free lab physics
// but the rope enforces max distance, converting stick input into arc motion.
const L = 200;                       // max rope length
updateSwing(dt){
  const s=this.stick;
  // stick adds tangential thrust, not direct velocity
  this.vx += s.dx * 900 * dt;
  this.vy += s.dy * 900 * dt;
  this.vx *= 0.995; this.vy *= 0.995;    // very light drag, momentum is king
  this.px += this.vx*dt; this.py += this.vy*dt;
  // rope constraint: project back onto the circle, kill radial velocity
  let dx=this.px-this.ax, dy=this.py-this.ay;
  const d=Math.hypot(dx,dy)||1;
  if(d>this.ropeLen){
    const nx=dx/d, ny=dy/d;
    this.px=this.ax+nx*this.ropeLen; this.py=this.ay+ny*this.ropeLen;
    const radial=this.vx*nx+this.vy*ny;
    this.vx-=nx*radial; this.vy-=ny*radial;   // only tangential survives
  }
  // reeling: pushing the stick TOWARD the anchor shortens the rope (climb)
  const tx=this.ax-this.px, ty=this.ay-this.py, td=Math.hypot(tx,ty)||1;
  const toward=(s.dx*tx+s.dy*ty)/td;
  if(toward>0.5) this.ropeLen=Math.max(24,this.ropeLen-140*dt);
}

// Verb dispatch on release/hold-start
onAimDown(ev){ this.aimT=0; this.aimOX=ev.x; this.aimOY=ev.y; this.aiming=true; }
resolveVerb(){
  const hit=this.rayCast(this.px,this.py,this.aimDX,this.aimDY,200); // returns {kind,x,y,e}
  if(this.aimT<0.16){ hit.kind===1 ? this.grabYank(hit.e) : this.lunge(); }
  else { hit.kind===1 ? this.hoist(hit.e) : hit.kind===2 ? this.attach(hit.x,hit.y) : this.lunge(); }
}
```

## Enemy roster: five types with exact stats

**Recomendacion:** SCIENTIST — hp 10, speed 62px/s (panic sprint 88), no attack, spawn weight 50. Dies to anything; the point is that he never threatens.
GUARD — hp 45, speed 46px/s patrol / 70 repositioning, telegraph 420ms, bullet 150px/s dealing 22 damage, spawn weight 26. Fires 3-round bursts with 140ms between rounds, then 1.6s recovery.
TURRET — hp 60 (immune to bullets, only tentacle verbs hurt it), static, laser sight 500ms sweep + 320ms lock, then a 4-damage-per-tick beam (12 ticks/s = 48 dps) for 0.8s, spawn weight 8. Disabled by GRAB+YANK (rips it off the mount, instant kill) or SLAM.
HAZMAT — hp 70, speed 40px/s, spawn weight 10. THE MOVEMENT-CHANGER: carries a containment sprayer, 600ms telegraph, then a 90px cone of acid foam for 1.0s dealing 10 dmg/s AND, crucially, foam-covered floor tiles cannot be tentacle-attached for 6 seconds. He denies your swing anchors, forcing ground movement.
ENFORCER — hp 120, speed 34px/s walk / 260px/s charge, spawn weight 6. THE SECOND MOVEMENT-CHANGER: riot-armored, immune to GRAB+YANK (too heavy to pull — instead YOU get pulled to HIM, which is the tell). 700ms crouch telegraph then a straight-line 260px/s charge for 1.1s dealing 30 damage; the charge shatters walls, opening new routes. Must be beaten with HOIST-flung bodies, SLAM, or by baiting him into a wall (he self-stuns 1.4s on wall impact, taking 40 damage).

**Por que:** The two extra types are chosen specifically because they attack the player's MOVEMENT rather than her health bar, which is what the brief asked for. Hazmat attacks the anchor system (the swing verb) and forces ground play in a pocket of the room; Enforcer attacks the grab verb (inverting it, so the crowd-control tool becomes a liability) and forces the player to use the environment. HP values are set against the verb table: scientist dies to every verb (10 < 12 lunge); guard needs 2 grab-yanks (20+20=40 <45, so 3) or one slam+one lunge (30+12=42, plus 3 more) — deliberately just over the round number so guards need real commitment; turret dies in one yank as a designed exception (it is a puzzle, not a fight); enforcer at 120 requires either 4 slams or the environment, which is exactly the 'use the room' lesson. Speeds are all below the player's swing speed (peaks ~300px/s) and at or below her walk (110px/s), so the player is never outrun — a power fantasy must never involve fleeing a faster enemy. Spawn weights sum to 100 for a simple weighted pick.

```js
const E_SCI=0,E_GUARD=1,E_TURRET=2,E_HAZ=3,E_ENF=4;
// Flat parallel data, one Pool of uniform structs — no subclasses, no per-frame alloc.
const ESTAT=[
// hp  spd  spd2 tele  dmg  weight
  [ 10,  62,  88, 0,    0,  50],
  [ 45,  46,  70, 0.42, 22, 26],
  [ 60,   0,   0, 0.82,  4,  8],
  [ 70,  40,  40, 0.60, 10, 10],
  [120,  34, 260, 0.70, 30,  6],
];
const mkE=()=>({x:0,y:0,vx:0,vy:0,type:0,hp:0,st:0,stT:0,t:0,
  hitT:0,fx:1,frame:0,animT:0,aimX:0,aimY:0,burst:0,
  homeX:0,homeY:0,alertT:0,grabbed:0,_i:0});
this.enemies = new Pool(28, mkE, e=>{e.grabbed=0;e.hp=0;});
// weighted pick, no allocation
pickType(rnd){ let r=rnd()*100, i=0; while(i<5){ r-=ESTAT[i][5]; if(r<=0) return i; i++; } return 0; }
```

## Scientist panic AI: the full state machine, tuned so slaughter reads clearly

**Recomendacion:** Six states. IDLE(0): wanders between two waypoints at 30px/s, plays a 2-frame work animation, has NOT seen you. Transition to PANIC when the player comes within 90px with line of sight, or when any scientist within 130px enters PANIC (panic is contagious, spreading with a 180ms stagger so a room empties in a visible wave). PANIC(1): runs directly away from the player at 88px/s, re-evaluating the flee vector every 250ms, emitting SFX.blip at a rising pitch; every 600ms rolls rnd.chance(0.18) to TRIP. TRIP(2): 700ms sprawled on the floor, speed 0, sprite face-down, completely helpless — this is the mercy window that makes the kill feel like a choice. Then back to PANIC. COWER(3): entered when the flee vector is blocked by a wall within 20px (cornered) — scientist turns to face the player, slides down the wall, arms up, speed 0, stays there permanently, whimpering every 900ms. ALARM(4): entered instead of PANIC with probability 0.35 IF an un-pressed alarm button is within 260px; runs to the button at 96px/s (faster than normal panic — he is brave), and on arrival takes 900ms with a rising SFX tone to press it. If he completes it, SFX.alarm() and 2 guards spawn at the nearest door 1.2s later. Killing him during the 900ms press cancels it. DEAD(5): see gore spec.
Bonus behavior that sells the fantasy: in PANIC, if a scientist would run into another scientist, he SHOVES him (both get 40px/s of lateral impulse and the shoved one enters TRIP with chance 0.5). They trample each other to escape you.

**Por que:** The design goal is that every scientist reaction is legible at a glance from 3 feet away on a phone, because that legibility IS the power fantasy — you must SEE them being terrified of you. Each state therefore has a distinct silhouette (upright running / face-down flat / crouched ball / running with arm outstretched toward a blinking button), not just a different velocity. The TRIP state exists purely to give the player a beat of superiority: a fleeing target that stumbles converts a chase into an execution. Contagious panic with a stagger is what makes entering a room feel like an event rather than like meeting N independent units. The ALARM state is the only way a harmless enemy creates tension, and gating it at 0.35 plus a visible 900ms press means the player always gets a chance to stop it — it punishes inattention, never reflexes. Shoving is cheap to implement and is the single detail that will make Romina laugh.

```js
const S_IDLE=0,S_PANIC=1,S_TRIP=2,S_COWER=3,S_ALARM=4;
updateSci(e,dt,px,py){
  e.t+=dt; e.stT-=dt;
  const dx=e.x-px, dy=e.y-py, d=Math.hypot(dx,dy)||1;
  switch(e.st){
    case S_IDLE:
      if(d<90 && this.los(e.x,e.y,px,py)) this.scare(e);
      else { e.x+=e.vx*dt; if(e.stT<=0){e.vx=-e.vx; e.stT=1.6;} }
      break;
    case S_PANIC: {
      if(e.stT<=0){                       // re-aim flee vector every 250ms
        e.stT=0.25;
        let ax=dx/d, ay=dy/d;
        if(this.solidAt(e.x+ax*20,e.y+ay*20)){   // cornered
          if(this.solidAt(e.x+ax*20,e.y)&&this.solidAt(e.x,e.y+ay*20)){ e.st=S_COWER; break; }
          if(this.solidAt(e.x+ax*20,e.y)) ax=0; else ay=0;
        }
        e.vx=ax*88; e.vy=ay*88; e.fx=ax<0?-1:1;
      }
      e.x+=e.vx*dt; e.y+=e.vy*dt;
      e.animT+=dt; if(e.animT>0.09){e.animT=0;e.frame^=1;}   // fast leg cycle = panic
      if(e.t-e.lastRoll>0.6){ e.lastRoll=e.t;
        if(this.rnd.chance(0.18)){ e.st=S_TRIP; e.stT=0.7; e.vx=e.vy=0; SFX.hurt(); } }
      break; }
    case S_TRIP:
      if(e.stT<=0){ e.st=S_PANIC; e.stT=0; }
      break;
    case S_COWER:
      if(e.t%0.9<dt) SFX.blip();
      break;
    case S_ALARM: {
      const bx=e.aimX, by=e.aimY;
      const bd=Math.hypot(bx-e.x,by-e.y);
      if(bd>8){ e.x+=(bx-e.x)/bd*96*dt; e.y+=(by-e.y)/bd*96*dt; }
      else { e.stT-=0; e.burst+=dt;
        if(e.burst>0.9){ this.triggerAlarm(bx,by); e.st=S_PANIC; e.stT=0; } }
      break; }
  }
}
scare(e){
  if(e.st!==S_IDLE) return;
  const b=this.nearestAlarm(e.x,e.y,260);
  if(b && this.rnd.chance(0.35)){ e.st=S_ALARM; e.aimX=b.x; e.aimY=b.y; e.burst=0; }
  else { e.st=S_PANIC; e.stT=0; }
  // contagion with stagger
  for(let i=0;i<this.enemies.n;i++){ const o=this.enemies.items[i];
    if(o.type===E_SCI && o.st===S_IDLE && Math.hypot(o.x-e.x,o.y-e.y)<130) o.scareIn=0.18; }
}
```

## Guard AI and the three fairness rules that guarantee no cheap deaths

**Recomendacion:** States: PATROL(0) walks a 2-point route at 46px/s, facing = movement dir, vision cone 100px range and 70 degrees half-angle 35, requires line of sight through the tilemap (DDA raycast on the 16px grid, walls block). SUSPECT(1): entered when the player is in the cone OR within 40px regardless of facing (hearing) OR when an alarm fires; guard stops, turns toward the stimulus over 400ms, a yellow '?' pips above him. If the player leaves LOS for 1.2s, return to PATROL. AIM(2): 420ms telegraph — the guard freezes, a 1px RED LINE is drawn from muzzle to the player's position AT THE MOMENT OF LOCK (it does NOT track), and the guard sprite flashes white on the last 120ms. FIRE(3): 3 bullets, 140ms apart, at 150px/s, 22 damage each, each aimed at the locked line (not re-aimed). RECOVER(4): 1.6s, guard shuffles 70px/s toward cover (nearest solid tile edge within 120px) and cannot fire. COVER(5): if hp<40%, crouches behind cover, fires half as often, and after 2.0s triggers BACKUP once (SFX.alarm, 2 guards at nearest door after 1.2s). STAGGER(6): 0.5s, entered on any tentacle hit, cancels a pending AIM — so aggression is always rewarded.
THE THREE FAIRNESS RULES, all mechanical, not aspirational:
(R1) TELEGRAPH BUDGET. 420ms lock + 270px screen / 150px/s bullet = a minimum 420ms and typically 1.2-1.8s total from 'shot is coming' to 'shot arrives'. The player's lunge is 0.18s with a 0.45s cooldown, so she always has at least one full dodge available inside the window.
(R2) NO OFFSCREEN SHOTS. A guard may only enter AIM if his own position is within the camera rect inflated by 8px. Offscreen guards hold in SUSPECT indefinitely. This is a single if-check and it eliminates the entire class of unfair death.
(R3) LOCKED AIM, NEVER TRACKING. The red line is computed once at AIM entry and the bullets use that stored vector. Moving perpendicular to the line always works. Combined with R1 this makes 'I saw it and I moved' universally true.
Add (R4) NO SIMULTANEOUS LOCKS: a global token — at most 2 guards may be in AIM at the same time; a third that wants to fire waits in SUSPECT. Prevents crossfire deaths the player cannot solve.

**Por que:** 'The player must always be able to see a shot coming and have a way to avoid it' cannot be delivered by tuning alone; it needs invariants that hold structurally. R2 and R3 are the two that matter most and both are nearly free to implement. Locking the aim vector is also what makes the swing verb feel brilliant — arcing past a locked line at 300px/s is the game's best moment, and it only exists because the line does not follow you. R4 exists because 3 guards each individually fair can still form an inescapable cone; capping concurrent locks at 2 keeps every situation solvable while still feeling like a firefight. Bullet speed 150px/s is deliberately slow (a quarter of the swing peak speed) — it must be a readable object on screen, not a hitscan. The STAGGER-cancels-AIM rule is the aggression incentive: the correct answer to a room of guards is to attack, not to hide, which is what a power fantasy demands.

```js
const G_PAT=0,G_SUS=1,G_AIM=2,G_FIRE=3,G_REC=4,G_COV=5,G_STAG=6;
updateGuard(e,dt,px,py){
  e.stT-=dt;
  switch(e.st){
    case G_PAT:
      e.x+=e.vx*dt; e.y+=e.vy*dt;
      if(this.solidAt(e.x+e.vx*0.2,e.y+e.vy*0.2)){ e.vx=-e.vx; e.vy=-e.vy; }
      if(this.sees(e,px,py)){ e.st=G_SUS; e.stT=0.4; SFX.blip(); }
      break;
    case G_SUS:
      e.fx = px<e.x?-1:1;
      if(e.stT<=0){
        if(!this.sees(e,px,py)){ if((e.alertT+=dt)>1.2){e.st=G_PAT;e.alertT=0;} break; }
        // R2: never lock from offscreen.  R4: max 2 concurrent locks.
        if(this.onCamera(e) && this.locks<2){
          this.locks++; e.st=G_AIM; e.stT=0.42;
          e.aimX=px; e.aimY=py;            // R3: LOCKED here, never updated
          SFX.blip();
        }
      }
      break;
    case G_AIM:
      if(e.stT<=0){ e.st=G_FIRE; e.stT=0; e.burst=3; this.locks--; }
      break;
    case G_FIRE:
      if(e.stT<=0 && e.burst>0){
        const b=this.bullets.spawn();
        if(b){ const dx=e.aimX-e.x, dy=e.aimY-e.y, d=Math.hypot(dx,dy)||1;
          b.x=e.x; b.y=e.y; b.vx=dx/d*150; b.vy=dy/d*150; b.life=3; }
        SFX.shoot(); e.burst--; e.stT=0.14;
        if(e.burst<=0){ e.st=G_REC; e.stT=1.6; }
      }
      break;
    case G_REC:
      if(e.stT<=0) e.st = (e.hp<ESTAT[E_GUARD][0]*0.4)? G_COV : G_SUS, e.stT=0.4;
      break;
    case G_STAG:
      if(e.stT<=0){ e.st=G_SUS; e.stT=0.4; }
      break;
  }
}
// staggering cancels a lock and releases the token
hurtGuard(e,dmg){ e.hp-=dmg; e.hitT=0.12;
  if(e.st===G_AIM) this.locks--;
  e.st=G_STAG; e.stT=0.5; }

// vision: cone + DDA line of sight on the 16px grid
sees(e,px,py){
  const dx=px-e.x, dy=py-e.y, d=Math.hypot(dx,dy)||1;
  if(d>100) return false;
  if(d>40){                                  // inside 40px he hears you regardless
    const fx=e.vx||e.fx, fy=e.vy||0, fd=Math.hypot(fx,fy)||1;
    if((dx/d)*(fx/fd)+(dy/d)*(fy/fd) < 0.819) return false;  // cos(35deg)
  }
  return this.los(e.x,e.y,px,py);
}
```

## Turrets: static, telegraphed, and disabled by getting close — which is the interesting part

**Recomendacion:** Ceiling-mounted, occupies one 16px tile, hp 60, IMMUNE to guard-bullet friendly fire but fully vulnerable to tentacle verbs. States: SLEEP(0) — dark, slow 2s idle sweep of a dim grey sight line across a 120-degree arc, range 170px. DETECT(1) — player enters the arc with LOS: the sight line snaps to the player and turns YELLOW, 500ms while the turret rotates to track (it DOES track during this state, unlike guards), a rising SFX.blip every 160ms. LOCK(2) — 320ms, line turns RED and STOPS tracking (locks to the player's position at lock time), turret body shakes 1px. BEAM(3) — 0.8s continuous beam along the LOCKED line, 3px wide, 4 damage per 1/12s tick = 48 dps, so standing in it is death in ~2.1s but crossing it costs one tick (4 damage). COOL(4) — 1.4s, the emitter glows and it cannot fire; the sight line goes dark. Back to DETECT if the player is still visible.
DISABLING, three ways, all diegetic: (a) GRAB+YANK on the turret rips it from its mount — instant destruction regardless of hp, plus a shower of sparks and a 20px explosion; this is the intended, satisfying answer and is why hp 60 rarely matters. (b) SLAM does 30, so two slams. (c) HOIST a scientist's body into the beam — the body absorbs the beam for its full 0.8s duration (a corpse shield), and the turret cannot retarget until COOL. Also: breaking line of sight with any solid tile immediately drops it to SLEEP after 0.6s. Every turret has a visible 8px conduit running from it along the ceiling; severing the conduit with any tentacle verb kills the turret AND every turret on the same conduit — an optional 2-turret-room shortcut for observant players.

**Por que:** A turret must be a spatial puzzle, not a damage race, because it cannot move — if the answer were 'shoot it 60 times' it would just be a wall with a timer. Making GRAB+YANK an instant kill turns the turret into a reward for using the game's signature verb aggressively, and the 200px tentacle range against the 170px turret range means the player can always reach it from just outside its own engagement envelope: a clean, learnable geometry that Romina will figure out without a tutorial. The DETECT-tracks-then-LOCK-stops split is the same fairness principle as guards (R3), but the 500ms tracking phase adds real dread because you watch it follow you before it commits. The corpse shield is included because a symbiote game where enemy bodies are consumable tools is exactly the promised fantasy, and it costs about 15 lines. The conduit is the one 'clever player' affordance in the whole design and it needs no explanation — a glowing line connecting two turrets is self-documenting.

```js
const T_SLEEP=0,T_DET=1,T_LOCK=2,T_BEAM=3,T_COOL=4;
updateTurret(e,dt,px,py){
  e.stT-=dt; e.t+=dt;
  const vis = Math.hypot(px-e.x,py-e.y)<170 && this.los(e.x,e.y,px,py);
  switch(e.st){
    case T_SLEEP:
      e.aimA = e.homeX + Math.sin(e.t*0.9)*1.05;   // idle sweep, 120deg arc
      if(vis){ e.st=T_DET; e.stT=0.5; }
      break;
    case T_DET:
      if(!vis){ e.st=T_SLEEP; break; }
      { const ta=Math.atan2(py-e.y,px-e.x);         // tracks during DETECT only
        let d=ta-e.aimA; while(d>Math.PI)d-=6.283; while(d<-Math.PI)d+=6.283;
        e.aimA+=d*Math.min(1,dt*9); }
      if(e.t-e.lastRoll>0.16){ e.lastRoll=e.t; SFX.blip(); }
      if(e.stT<=0){ e.st=T_LOCK; e.stT=0.32; e.aimX=px; e.aimY=py; }
      break;
    case T_LOCK:
      if(e.stT<=0){ e.st=T_BEAM; e.stT=0.8; e.burst=0; SFX.laser(); cam.shake(2,0.1); }
      break;
    case T_BEAM:
      e.burst-=dt;
      if(e.burst<=0){ e.burst=1/12;
        if(this.segHitsPlayer(e.x,e.y,e.aimX,e.aimY,3)) this.hurtPlayer(4);
        this.beamCorpseCheck(e); }
      if(e.stT<=0){ e.st=T_COOL; e.stT=1.4; }
      break;
    case T_COOL:
      if(e.stT<=0) e.st = vis? T_DET : T_SLEEP, e.stT=0.5;
      break;
  }
}
// yank = instant kill, the intended answer
yankTarget(e){
  if(e.type===E_TURRET){ this.killTurret(e); cam.shake(4,0.18); SFX.explode();
    burst(e.x,e.y,16,{rnd:this.rnd,colors:['#ffe14d','#ff9c2a','#ffffff'],speed:120,life:0.5,size:2,grav:180});
    this.severConduit(e.conduit); return; }
  /* ...normal yank... */
}
```

## Player health, feeding regeneration, and a sub-1.5s death-to-retry

**Recomendacion:** Health: 100 HP, displayed as a 5-segment biomass bar (20 HP each) so damage is countable at a glance. Damage sources: guard bullet 22, turret beam tick 4, hazmat foam 10/s, enforcer charge 30. On any hit: 0.6s of i-frames, the whole symbiote flashes white for 120ms (bakeFlash sprite, already in the engine), cam.shake(3,0.12), SFX.hurt, vibrate(30). Regeneration ONLY by feeding: a GRAB+YANK kill on a scientist pulls the body into the symbiote and heals 12 HP; a HOIST kill heals 6 (less, because you kept the body as a weapon); a lunge or slam kill heals 0. This is the whole economy — it makes the fantasy load-bearing: eating people is literally your health bar, and the most satisfying verb is the one that heals. There is no passive regen and no health pickups.
Overfeed: healing past 100 grants FRENZY, up to 40 overshield that decays at 8/s; while any overshield is active the tentacle is 25% longer (250px) and lunge cooldown drops to 0.30s. So a room full of scientists converts directly into a temporary power spike — massacre is mechanically rewarded, not just thematically.
DEATH: at 0 HP the symbiote violently splits apart — 40 gore particles, the sprite is replaced by a spreading puddle painted into the decal layer, cam.shake(6,0.3), SFX.explode, vibrate(120), and time scales to 0.25x for 0.35 seconds. Total death animation 0.55s. Then, WITHOUT going through the shared GameOver scene, the game shows an in-module retry prompt: the level instantly resets on the NEXT tap anywhere on screen. Budget: 0.55s animation + ~0.25s reaction = under 1.0s to be playing again. Only call ctx.gameOver(score) when the player taps a small MENU corner instead, or after finishing the final level. Level reset must reuse the same pools (pool.clear(), re-seed from the stored level seed) and re-run layout from the seed — zero allocation, so the reset is a single frame.

**Por que:** The brief demands death-to-retry under 1.5s, and the shared GameOver scene cannot deliver that — it has a 0.55s canTap lockout plus a scene transition plus a second tap, which is 2s+ and, worse, it interrupts flow with a score screen. Keeping death inside the module is the only way to hit the target, and it is legitimate because ctx.gameOver is still called on the real end conditions so the high-score system stays intact. Feeding-as-healing is the single most important design decision here: it fuses the power fantasy to the survival mechanic, so that the thing that is fun (tearing scientists apart) is also the thing that is correct. Making yank heal 12 but lunge heal 0 gently teaches the signature verb without a tutorial — Romina will discover within one level that grabbing is better than dashing, purely from watching her health bar. The frenzy overshield gives a massacre a mechanical afterglow, which is what stops a cleared room from feeling like an anticlimax. 100 HP against a 22-damage bullet means 5 hits to die: enough that a single mistake never kills, few enough that carelessness in a guard room is fatal within a few seconds.

```js
hurtPlayer(dmg){
  if(this.iFrames>0 || this.dead) return;
  if(this.shield>0){ const a=Math.min(this.shield,dmg); this.shield-=a; dmg-=a; }
  this.hp-=dmg; this.iFrames=0.6; this.flashT=0.12;
  cam.shake(3,0.12); SFX.hurt(); vibrate(30);
  if(this.hp<=0) this.die();
}
feed(x,y,amount){
  this.hp+=amount;
  if(this.hp>100){ this.shield=Math.min(40,this.shield+(this.hp-100)); this.hp=100; }
  burst(x,y,10,{rnd:this.rnd,colors:['#c41419','#8a0f12','#ff4d6d'],speed:70,life:0.35,size:2,grav:120});
  SFX.coin();
}
die(){
  this.dead=true; this.deadT=0; this.slowT=0.35;
  this.splat(this.px,this.py,26,20);
  burst(this.px,this.py,40,{rnd:this.rnd,colors:['#c41419','#8a0f12','#2a0a2f','#ff4d6d'],speed:150,life:0.7,size:3,grav:200});
  cam.shake(6,0.3); SFX.explode(); vibrate(120);
}
update(dt,ctx){
  if(this.dead){
    this.deadT+=dt;
    if(this.slowT>0){ this.slowT-=dt; dt*=0.25; }
    return;                       // retry handled in onInput
  }
  /* ... */
}
onInput(ev,ctx){
  if(this.dead){
    if(ev.type==='down' && this.deadT>0.55){
      if(ev.x<40 && ev.y<40) ctx.gameOver(this.score);   // corner = quit to score
      else this.resetLevel();                            // anywhere = instant retry
    }
    return;
  }
  /* ... */
}
resetLevel(){
  this.enemies.clear(); this.bullets.clear(); this.gibs.clear(); particles.clear();
  this.rnd = makeRng(this.levelSeed);   // deterministic rebuild, same layout
  this.buildLevel(); this.hp=100; this.shield=0; this.dead=false; this.iFrames=0;
  // decal canvas is deliberately NOT cleared: your previous deaths stay on the walls
}
```

## Gore: the tear model that makes kills read as dismemberment without heavy cost

**Recomendacion:** Every scientist and guard sprite is authored as FIVE separate baked pieces: head (4x4), torso (6x8), arm L (2x5), arm R (2x5), legs (5x5). Alive, they are drawn as one composite from a single baked sprite (cheap). On death, spawn 3-5 GIB entities from a Pool(40) using the piece sprites, with velocity = kill impulse direction * rnd.range(60,190) + upward bias, angular tumble (4 pre-baked rotations per piece, not canvas rotate), gravity 320px/s^2, and a 0.12 bounce. Gibs paint a splat into the decal layer on every floor contact and then rest, staying on the ground as static sprites for the rest of the level (drawn from the gib pool, capped at 40 — the oldest is recycled). Kill-type determines the tear: GRAB+YANK = the body separates head+torso from legs mid-flight and the head is consumed (the feeding animation); HOIST-fling = the body loses both arms on impact; SLAM = full 5-piece explosion; LUNGE = 2 pieces plus a heavy spray. Arterial spray: on a torso/head separation, emit 14 particles at speed 130 with grav 200 in a cone along the tear direction, colors ['#c41419','#8a0f12','#ff4d6d'], and paint a 20-particle splat into the decal at the death point plus a second splat where the torso gib lands.

**Por que:** Dismemberment reads only if the pieces are actually separate objects that travel independently — a single 'dead' sprite with red particles will not sell it. Five pieces is the minimum that gives recognizable dismemberment (a head that comes off is the whole effect) and the maximum that keeps the gib pool at 40 across ~8 simultaneous corpses. Pre-baking 4 rotations per piece instead of using canvas rotate matters on Adreno: ctx.rotate forces a transform per draw and breaks the integer-pixel alignment that the whole art style depends on. Varying the tear by kill type is what stops the gore from becoming wallpaper over a 3-minute level — the player keeps seeing new deaths because the verb she chose changed the corpse. The two-stage splat (at death, and where the piece lands) is what makes the floor tell the story of the fight afterward.

```js
const mkGib=()=>({x:0,y:0,vx:0,vy:0,rot:0,spin:0,piece:0,rest:0,life:0,_i:0});
this.gibs=new Pool(40,mkGib,null);
// GIB_SPR[piece][rot] baked once in init: 5 pieces x 4 rotations = 20 tiny canvases
tear(x,y,dirX,dirY,kind){
  const n = kind===K_SLAM?5 : kind===K_YANK?4 : kind===K_FLING?4 : 2;
  for(let i=0;i<n;i++){
    let gb=this.gibs.spawn();
    if(!gb){ gb=this.gibs.items[0]; this.gibs.free(gb); gb=this.gibs.spawn(); } // recycle oldest
    const a=Math.atan2(dirY,dirX)+this.rnd.range(-0.9,0.9);
    const sp=this.rnd.range(60,190);
    gb.x=x; gb.y=y; gb.vx=Math.cos(a)*sp; gb.vy=Math.sin(a)*sp-70;
    gb.piece=i; gb.rot=(this.rnd()*4)|0; gb.spin=this.rnd.range(-9,9);
    gb.rest=0; gb.life=999;
  }
  burst(x,y,14,{rnd:this.rnd,colors:['#c41419','#8a0f12','#ff4d6d'],speed:130,life:0.5,size:2,grav:200});
  this.splat(x,y,20,10);
  cam.shake(kind===K_SLAM?4:2, 0.12); SFX.punch(); vibrate(kind===K_SLAM?45:22);
}
updateGibs(dt){
  for(let i=this.gibs.n-1;i>=0;i--){ const gb=this.gibs.items[i];
    if(gb.rest) continue;                       // resting gibs cost one drawImage, no logic
    gb.vy+=320*dt; gb.x+=gb.vx*dt; gb.y+=gb.vy*dt;
    gb.rot=(gb.rot+(gb.spin>0?1:-1)*(Math.abs(gb.spin)*dt>0.25?1:0))&3;
    if(this.solidAt(gb.x,gb.y+3)){
      this.splat(gb.x,gb.y+3,7,5);
      gb.vy*=-0.12; gb.vx*=0.4;
      if(Math.abs(gb.vy)<24){ gb.rest=1; gb.vy=0; gb.vx=0; }
    }
  }
}
```

## Level pacing: a 4-beat curve over 2 minutes with an escalating alarm as the tension engine

**Recomendacion:** A level is 5-7 rooms on a vertical shaft, gated by doors that open when the room's ALARM STATE allows. Global ALERT counter 0-3 drives everything and is the single tension dial. Beat structure by elapsed time:
BEAT 1, 0-25s, SLAUGHTER (alert 0): 6-9 scientists, 0-1 guards, no turrets. Pure unopposed carnage to establish the verbs and top up health via feeding. Rooms are wide with many anchor points.
BEAT 2, 25-70s, RESISTANCE (alert 1): 4-6 scientists, 2-3 guards, 1 turret. Corridors narrow to ~7 tiles so swinging requires shorter, more deliberate anchors. One hazmat appears to deny anchors in the key room.
BEAT 3, 70-110s, LOCKDOWN (alert 2): alarm is now permanently on (SFX.alarm every 4s, red flashing tint over the tilemap at 12% alpha), 2-4 scientists, 4-5 guards, 2 turrets, 1 enforcer. Guard reinforcement waves of 2 every 20s from doors, capped so total living guards never exceeds 6.
BEAT 4, 110-150s, ESCAPE (alert 3): the exit is visible; a 25-second countdown starts; guards spawn every 8s but the room is a long open shaft ideal for swinging. The intended experience is one continuous high-speed swing to the exit while everything shoots at you.
ESCALATION RULES: alert rises by 1 when an alarm button is pressed, when a guard calls backup, or when a beat's time threshold passes — whichever comes first, so a stealthy player and a loud player converge on the same curve within about 15 seconds of each other. Alert never falls.
ANTI-CHEAP-DEATH RULES: (a) no enemy spawns within 120px of the player or within the camera rect; (b) after the player takes damage twice within 2.0s, suppress all new AIM entries for 1.2s ('mercy beat'); (c) the first 8 seconds after a level reset spawn no guard in the first room, so a retry is never instantly re-punished; (d) the concurrent-lock cap (max 2) from the guard spec applies globally at all alert levels.
SCORING for Save.submit: kills*10 + (yank kills)*15 bonus + max(0, 180 - seconds)*5 + rooms*100, so speed and style both pay.

**Por que:** A 1-3 minute level cannot afford a slow start, so beat 1 is pure reward with zero threat — Romina is powerful before she is ever endangered, which is the correct order for a power fantasy. The alert counter is one integer that drives spawn tables, lighting, and music intensity together, which is why the escalation feels authored rather than random despite being generated. Converging the time-based and action-based escalation prevents the classic failure where a cautious player experiences a flat, boring level; it also means the alarm-pressing scientist genuinely matters (he costs you ~15 seconds of peace) without being able to ruin a run. The mercy beat (rule b) is the specific mechanism that prevents the death spiral where taking one hit while swinging means taking four, and it is invisible to the player — she just feels like she got away with it. Rule (c) is what makes the sub-1.5s retry actually work: an instant retry into an instant death would be worse than a slow retry.

```js
const BEATS=[
// tEnd alert  sci gd tur haz enf  reinforceEvery
  [ 25, 0,      8, 1,  0,  0,  0,  0 ],
  [ 70, 1,      5, 3,  1,  1,  0,  0 ],
  [110, 2,      3, 5,  2,  1,  1, 20 ],
  [150, 3,      1, 6,  2,  0,  1,  8 ],
];
updatePacing(dt){
  this.lt+=dt;
  const b=BEATS[this.beat];
  if(this.lt>b[0] && this.beat<3){ this.beat++; this.alert=Math.max(this.alert,BEATS[this.beat][1]); SFX.wave(); }
  const rf=BEATS[this.beat][7];
  if(rf>0 && (this.reinfT-=dt)<=0){ this.reinfT=rf; this.spawnGuards(2); }
  // mercy beat
  if(this.hurtWindow>0) this.hurtWindow-=dt;
  if(this.mercyT>0) this.mercyT-=dt;
}
noteHurt(){
  if(this.hurtWindow>0) this.mercyT=1.2;   // second hit within 2s => mercy
  this.hurtWindow=2.0;
}
canLock(){ return this.mercyT<=0 && this.locks<2; }
spawnGuards(n){
  for(let i=0;i<n;i++){
    const d=this.pickDoorAwayFromPlayer(120);   // rule (a)
    if(!d) continue;
    const e=this.enemies.spawn(); if(!e) return;
    this.initEnemy(e,E_GUARD,d.x,d.y);
  }
}
```

## Pitfalls

- DO NOT store a pool index as a lasting reference. This design has three places that are tempting and all three are bugs: the tentacle's grabbed-enemy target, the hoisted body, and the guard that owns an aim-lock token. The pool uses swap-remove, so freeing any other enemy relocates yours. Use a monotonically increasing `uid` integer assigned at spawn and a linear scan to resolve it (n<=28, so the scan is trivial), or hold the object reference itself AND validate it with `e.hp>0 && e.uid===this.grabUid` every frame before use.
- Do not let the aim-lock token counter leak. `this.locks` is incremented on AIM entry and must be decremented on EVERY exit path from AIM: firing, staggering, dying, losing line of sight, and level reset. A leaked token permanently silences all guards and looks like the game is broken. Safest fix: do not use a counter at all — recompute `locks` each frame by counting enemies with st===G_AIM before running the guard update loop.
- Never call getImageData or toDataURL on the decal canvas. It is the one thing that would tank the frame on Adreno by forcing a GPU->CPU readback and de-optimizing the whole canvas. Write-only, forever.
- The decal canvas is MAP_H*16 tall (1152px for a 72-tile level). That is fine, but do not create a new one per level reset — allocate it once in init(), and on a genuine new level use dg.clearRect on the whole thing rather than making a second canvas. Repeated canvas allocation is the classic mobile WebView memory leak.
- The 260-particle pool is SHARED with the whole app and burst() silently drops particles when full. A 5-scientist chain kill at 14 particles each is 70, plus gib splats — that is fine, but do not raise per-kill particle counts casually; test a 6-corpse room and confirm the pool never sits pinned at 260, or the player's own damage flash particles will stop appearing exactly when they matter most.
- Rope-constraint tunneling: at 300px/s swing speed the player moves 5px per tick, so a 16px wall is safe, but the SLAM verb at 700px/s moves 11.7px per tick and CAN pass through a 16px wall corner. Sub-step the slam movement (4 sub-steps of 2.9px) or sweep-test it. Do not sub-step the normal swing; it does not need it and the cost is wasted.
- Do not use ctx.rotate for tumbling gibs. Pre-bake 4 rotations per piece. Canvas rotate breaks integer pixel alignment (the sprite gets resampled even with imageSmoothingEnabled=false at non-90-degree angles) and costs a transform per draw call.
- The tap-vs-hold threshold (160ms) must be measured from the pointerdown timestamp accumulated in update(), not from a setTimeout. setTimeout is not synchronized to the fixed 1/60 accumulator and will misfire during a frame stall, giving Romina a lunge when she asked for a swing — the single most rage-inducing possible bug in this control scheme.
- Contagious panic can go quadratic: each scared scientist scanning all enemies within 130px is O(n^2) per scare event. With n<=28 that is 784 comparisons in the worst case, which is acceptable ONCE, but do not run the contagion scan every frame — only in scare(), and set a `scareIn` timer on neighbors rather than recursing.
- ctx.gameOver() must NOT be called on ordinary death, or the sub-1.5s retry target is unreachable (the shared GameOver scene has a 0.55s canTap lockout plus a second tap plus a scene flush). Call it only on quit-to-corner and on final-level completion. Remember that means the module owns its own retry loop and must therefore reset every timer it holds — beat, lt, alert, locks, mercyT, reinfT, iFrames, shield — or a retry inherits the previous run's lockdown state.
- Hazmat foam marking tiles as non-anchorable needs a decay timer per tile. Do not allocate an array of foam objects per spray; use a Uint8Array(MAP_W*MAP_H) of foam-expiry-in-frames and decrement only the tiles in a dirty list, or simply store an expiry frame number in a Uint16Array and compare against a global frame counter — zero per-frame work.
- Enforcer wall-shatter opening new routes means the tilemap is mutable at runtime. If any level geometry is pre-baked into an offscreen canvas for speed, that bake must be invalidated and redrawn when a wall breaks. Simplest safe answer: draw the tilemap with per-tile fillRects each frame (only ~38 visible rows x 17 = 646 rects, well within budget at 270x600) and never bake it.
