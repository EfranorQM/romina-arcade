# CARRION research: feel

## THE KILL — full frame-by-frame timeline (the single most important spec in this document)

**Recomendacion:** One button, one verb, three outcomes. The attack button ALWAYS fires; it never fails silently and never shows a cooldown. On press, pick a target with `pickTarget()` (below), then run one of three timelines. All timings in ms; the engine is 1/60 = 16.67ms/frame, so every number below is a multiple of ~16.67 rounded to the nearest frame.

TARGET SELECTION (runs in <0.2ms, no allocation):
- Cone from body centre toward the CURRENT DRAG VECTOR (the finger direction), half-angle 0.85 rad (49deg), radius GRAB_R = 150px. If the finger is not down, use the body's velocity direction; if velocity < 40px/s use `B.face`.
- Score each living enemy in cone: `score = dist - 60*inCone - 90*(st===ST_TRIP||st===ST_COWER||st===ST_ALARM)`. Lowest score wins. Requires `lineOfSight(L, B.x, B.y, e.x, e.y)`.
- If a target exists and dist <= 150 -> GRAB TIMELINE.
- If no target -> LASH TIMELINE (a free swipe of 2 tentacles that still tears wall panels, shatters glass via `shatterGlass`, and stamps gore). Never a dead press.
- If the target is E_ENFORCER (grabbable:false) -> STAGGER TIMELINE (tentacles wrap, he shrugs off, he takes 25 and is staggered 0.5s). She learns the exception in one press without text.

GRAB TIMELINE — the money shot. Total 617ms from press to corpse at rest, but the player regains control at 300ms.

t=0ms (frame 0) PRESS. Fire 3 tentacles (`R.fire` x3 with angular spread -0.35, 0, +0.35 rad around the target). Set `e.grip=1`, `e.gripT=0` IMMEDIATELY — the enemy stops updating this frame, which is why the grab reads as instant. Play the reach sfx: `sfx({type:'noise', f0:2600, f1:900, dur:0.07, vol:0.18})` — a wet whip, no pitch. NO hitstop yet.

t=0-100ms (frames 0-6) REACH. Tentacle tips lerp to the enemy at 1500px/s, so a 150px reach lands in 100ms and a 60px reach in 40ms. Draw them with `R.drawTentacle` in BLOOD_MID once wet. During reach the victim is already frozen and plays a 2-frame FLAIL anim (arms up, `e.frame^=1` every 50ms) — freezing him but animating him is what makes the grab read as a catch rather than a stun.

t=100ms (frame 6) CONTACT. This is the beat that must land hardest.
  - `this.freeze = 0.067` (4 frames of hitstop — NOT more; the canon caps at 11 frames and this is only the grab, not the kill).
  - `cam.shake(4, 0.12)`.
  - `vibrate(22)`.
  - `sfx({type:'noise', f0:1200, f1:300, dur:0.09, vol:0.30})` — the meat thump.
  - `G.sprayPulse(this.spray, e.x, e.y, dx, dy, 4, rnd)` — a small first bite, not the arterial spray yet. Holding the big spray back 200ms is what makes it feel like a tear instead of a pop.

t=100-300ms (frames 6-18) STRUGGLE. 200ms, and it is non-negotiable — this is the window where the player SEES that she caught a person. The victim is dragged toward the body at 320px/s along the tentacle while:
  - He shakes: `e.x += Math.sin(e.gripT*54)*3` (a 8.6Hz jitter, 3px amplitude — visible at 2x upscale, not a blur).
  - He screams: `sfx({type:'saw', f0: 420+rnd()*160, f1: 180, dur:0.22, vol:0.26})` fired ONCE at t=115ms. Saw, not pulse — it must sound organic against the game's square-wave lab hum.
  - 1 tentacle re-grips a nearby wall so the body still flows; SHE NEVER STOPS MOVING during a kill. If all tentacles committed to the grab, movement would stall for 300ms and the whole game would feel like a QTE.
  - Player control returns at t=300ms even though the tear is still playing.

t=300ms (frame 18) THE TEAR. Everything fires in one frame:
  - `this.freeze = 0.15` (9 frames — the big one, under the 11-frame cap).
  - `this.slowT = 0.30; this.slowScale = 0.30` — 300ms of 30% time AFTER the freeze releases, so the spray arcs in slow motion and the player watches her own violence.
  - `cam.shake(8, 0.32)`.
  - `vibrate([0,55,35,95])` — the existing two-pulse pattern, which reads as 'rip, then splat'.
  - `G.spawnDebris(this.debris, e.x, e.y, 6, dx, dy, rnd)` — 6 pieces, the 'big' count.
  - `G.sprayPulse(..., 8, rnd)` then the existing pulse2 at +60ms (6 particles) and pulse3 at +120ms (5). The three-pulse heartbeat already in `symbiote.js:onKill` is correct — keep it verbatim.
  - `G.stampPool(this.gore, e.x, e.y, tx, ty, L.w, rnd)`.
  - Two-layer sound: `sfx({type:'noise', f0:900, f1:120, dur:0.28, vol:0.42})` (the tear) AND at +40ms `sfx({type:'tri', f0:70, f1:40, dur:0.30, vol:0.34})` (a sub-bass thud). The low sine under the noise is what makes it feel heavy on a phone speaker that cannot reproduce the bass — the phone body buzzes and the haptic covers the rest.
  - `B.bloodiness += 0.20` — the creature visibly reddens (BODY_TIERS already bakes 4 blood levels).
  - Free the enemy, tentacles enter T_RETRACT.

t=300-617ms CORPSE. Debris arcs under gravity in the 30% slow-motion for 300ms then resumes; pieces land, `updateDebris` already stamps trails and rest positions. Slow-mo ends at 600ms. The gore layer is permanent.

WHY 300ms of struggle: below 180ms the victim reads as a particle effect; above 400ms the player feels held hostage. 300ms with control returned at the tear is the window where you see the person, hear the scream, and are already flowing toward the next one.

STAGGER TIMELINE (enforcer / any grabbable:false): reach 0-100ms identical, then at 100ms `freeze=0.05`, `cam.shake(3,0.1)`, `e.stagger=0.5`, `W.damageEnemy(e,25,true)`, sfx a duller `{type:'noise', f0:600, f1:200, dur:0.12, vol:0.28}`. No spray, no debris. The absence of gore is the teaching signal.

LASH TIMELINE (no target): 2 tentacles sweep a 0.9rad arc over 130ms at 1400px/s, dealing 40 to anything they cross (reuse the existing `tentacleHits` speed gate), shattering T_GLASS, and stamping gore if the tip crosses an existing blood tile. `sfx({type:'noise', f0:3000, f1:1400, dur:0.06, vol:0.14})`. Cost: nothing. It must feel like the creature is always thrashing.

**Por que:** The user's complaint was that the creature does not feel fluid and its tentacles do not feel like his. Every element above is chosen so the KILL never interrupts the FLOW: one tentacle always stays on a wall, control returns 317ms before the animation ends, and the hitstop is split into a small grab (4 frames) and a big tear (9 frames) rather than one long freeze. The three-beat rhythm (contact / struggle / tear) is what separates Carrion's kills from a damage number: the 200ms struggle is the entire emotional payload, because it is the only moment where the victim is legible as a human being. Splitting the sound into noise+sub-triangle is specifically for the Redmi's speaker, which has no low end — the haptic and the shake carry what the speaker cannot.

```js
// Estados de agarre. Todo en ms convertidos a segundos.
const K_REACH = 0.100, K_TEAR = 0.300, K_END = 0.617;
const GRAB_R = 150, GRAB_CONE = 0.85;

pickTarget(dirX, dirY) {
  const B = this.B, L = this.L;
  let best = null, bestScore = 1e9;
  for (let i = 0; i < this.enemies.n; i++) {
    const e = this.enemies.items[i];
    if (e.dead || e.grip) continue;
    const dx = e.x - B.x, dy = e.y - B.y;
    const d = Math.hypot(dx, dy);
    if (d > GRAB_R || d < 1) continue;
    const dot = (dx / d) * dirX + (dy / d) * dirY;
    const inCone = dot > Math.cos(GRAB_CONE) ? 1 : 0;
    const soft = (e.st === 2 /*ST_TRIP*/ || e.st === 3 /*ST_COWER*/ || e.st === 4 /*ST_ALARM*/) ? 1 : 0;
    const score = d - 60 * inCone - 90 * soft;
    if (score < bestScore && W.lineOfSight(L, B.x, B.y, e.x, e.y)) { bestScore = score; best = e; }
  }
  return best;
}

// Llamado cada frame desde update() cuando this.grabE existe.
stepGrab(dt) {
  const e = this.grabE; if (!e) return;
  this.grabT += dt;
  const t = this.grabT;
  const B = this.B;
  const dx = e.x - B.x, dy = e.y - B.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;

  if (t < K_REACH) { e.grip = 1; return; }          // alcance
  if (!this.grabHit) {                              // CONTACTO, una sola vez
    this.grabHit = 1;
    this.freeze = 0.067; cam.shake(4, 0.12); vibrate(22);
    sfx({ type:'noise', f0:1200, f1:300, dur:0.09, vol:0.30 });
    G.sprayPulse(this.spray, e.x, e.y, ux, uy, 4, this.rnd);
    sfx({ type:'saw', f0: 420 + this.rnd() * 160, f1:180, dur:0.22, vol:0.26 });
  }
  if (t < K_TEAR) {                                 // FORCEJEO 200ms
    e.x -= ux * 320 * dt; e.y -= uy * 320 * dt;
    e.x += Math.sin(t * 54) * 3;
    e.animT += dt; if (e.animT > 0.05) { e.animT = 0; e.frame ^= 1; }
    return;
  }
  // DESGARRO
  e.grip = 0; e.dead = 1;
  this.onKill(e, -ux, -uy, true);                   // onKill ya hace freeze/shake/spray
  this.enemies.free(e);
  this.grabE = null; this.grabT = 0; this.grabHit = 0;
}
```

## PREY BEHAVIOUR — the scientist state machine, extended from what already ships

**Recomendacion:** KEEP the existing scientist machine in `sym-world.js` (ST_IDLE/PANIC/TRIP/COWER/ALARM with contagion) — it is already good and verified. Add three states and retune four numbers. Full machine with timings:

ST_IDLE — walks between hx and bx at 30px/s. Transitions to ST_PANIC (or ST_ALARM) via `scare()` when the creature is within `scareRange` 180px AND lineOfSight. Contagion 260px with a staggered 180ms alertT so the room empties as a visible wave — keep exactly as is, it is the single best thing in the current file.

ST_PANIC — runs directly away at 176px/s, re-aiming every 250ms. Shoves other scientists within 18px (80px/s impulse, 50% chance of tripping them). Every 600ms rolls tripChance. CHANGE: raise `tripChance` from 0.18 to 0.26 and make it DISTANCE-SCALED: `p = 0.26 * (1 + (1 - dist/260))` clamped to 0.55. A scientist trips much more often when she is right behind him. That is the mercy window that turns a chase into an execution, and it should fire when the player is close enough to cash it in.

ST_TRIP — 700ms on the floor, vx=0. CHANGE: during ST_TRIP he CRAWLS backward at 34px/s away from her while looking at her (face flipped toward the creature). A motionless trip reads as a bug; a crawl reads as terror. Grab damage/reach unchanged, but `pickTarget` scores him -90 so she snaps to him — the game rewards the player for chasing the one who fell.

ST_COWER — entered when the panic raycast hits a wall within 40px. vx=0, faces her. NEW: after 900ms in ST_COWER he slides down the wall (sprite y +2px) and covers his head — a distinct 2-frame anim. He never leaves this state. He is free score and the player should feel the mercy he does not get.

ST_ALARM — 35% chance on scare if an unused alarm is within 520px. Runs at 192px/s, then presses for 900ms with a rising tone. Killing him mid-press cancels it. KEEP. ADD the audio ramp the design implies but the code lacks: during the 900ms press, `sfx({type:'pulse', duty:0.5, f0: 300 + 500*(e.animT/0.9), dur:0.06, vol:0.18})` every 150ms — 6 beeps of rising pitch. That ascending tone is the clearest 'stop him NOW' signal in the game and costs 6 voices over 900ms.

NEW ST_DOOR (state id 22) — 12% chance on scare if a T_DOOR tile is within 300px. He runs to it at 176px/s and BANGS on it: 2-frame anim at 8Hz, `sfx({type:'noise', f0:400, f1:200, dur:0.05, vol:0.20})` every 250ms, forever. He never opens it. This is pure theatre and it is the image from the screenshots. Cheap: it is ST_ALARM with a different target and no success condition.

NEW ST_SURRENDER (state id 23) — 8% chance, only when `world.alert>=2` and the creature is within 120px with LOS. He stops, drops to his knees, faces her, arms raised, 2-frame tremble. Free kill. Roughly one per level; it is the moment the power fantasy is stated out loud without a word of dialogue.

FAIRNESS INVARIANT: scientist `damage: 0` stays 0 in all states, forever. Their contact does nothing. They can only cost her the alarm.

AUDIO: give scientists a panic yelp on entering ST_PANIC — `sfx({type:'saw', f0: 380+rnd()*200, f1:220, dur:0.14, vol:0.20})` — but RATE-LIMIT to at most 2 per 300ms globally (a module-level counter), or a 6-man contagion wave fires 6 saws in one frame and clips through the 12-voice cap, silencing the kill sfx that matters.

**Por que:** The existing machine already nails the two hardest things (contagion waves and the trip mercy window). The additions are all readability: a crawling trip, a wall-sliding cower, a rising alarm tone, door-banging and surrender each give the player a distinct silhouette to read at a glance and a distinct emotional register to enjoy. The distance-scaled trip is the key retune — at a flat 18% the mercy window fires mostly when she is far away and cannot use it, which wastes the best mechanic in the file. The voice-cap rate limit is a real bug waiting to happen: MAX_VOICES is 12 and `scare()` can wake 6 scientists in one frame.

```js
// Nuevos estados de presa.
export const ST_DOOR = 22, ST_SURRENDER = 23;

// Limitador global de gritos: sin esto una ola de panico se come las 12 voces
// y el sonido del desgarro no suena, que es el unico que importa.
let _yellT = 0, _yellN = 0;
function yelp(rnd, dt) {
  _yellT -= dt;
  if (_yellT <= 0) { _yellT = 0.3; _yellN = 0; }
  if (_yellN >= 2) return;
  _yellN++;
  sfx({ type:'saw', f0: 380 + rnd() * 200, f1:220, dur:0.14, vol:0.20 });
}

// Dentro de case E_SCIENTIST, sustituye el bloque de tropiezo:
if (e.st === ST_PANIC) {
  e.animT += dt;
  if (e.animT >= 0.6) {
    e.animT = 0;
    // Escalado por distancia: tropieza mucho mas si la tiene encima.
    const p = Math.min(0.55, S.tripChance * (1 + (1 - Math.min(1, dist / 260))));
    if (rnd.chance(p)) { e.st = ST_TRIP; e.t = 0; e.vx = 0; }
  }
}
// ST_TRIP ahora gatea hacia atras en vez de quedarse inmovil.
else if (e.st === ST_TRIP) {
  const d = dist || 1;
  e.vx = (-dx / d) * 34;
  e.face = dx > 0 ? 1 : -1;          // la mira mientras se arrastra
  if (e.t >= S.tripTime) { e.st = ST_PANIC; e.t = 0; }
}
```

## ARMED ENEMIES — guards, and the flamethrower unit that replaces HAZMAT

**Recomendacion:** THE FLAMETHROWER IS THE HEADLINE ADDITION. Replace E_HAZMAT (foam sprayer) with E_PYRO, keeping the same slot id 3 so `ENEMY_BY_ID`, `countFor` and the spawn ramp need no restructuring. Fire is the hard counter to a flesh monster and it is what the screenshots show.

E_PYRO (id 3, firstLevel 2):
  hp: 55 (down from 70 — he must die fast once she gets past the flame, or the counter-play has no payoff)
  w:18 h:28 sw:22 sh:30, walk 74px/s, weight 10
  damage: 14 per tick, tick every 200ms = 70 dps inside the cone
  coneRange 200px, coneHalfAngle 0.42 rad (24deg)
  telegraph: 700ms — the pilot light flares, a 3px orange dot at the nozzle pulses at 6Hz and the CONE IS DRAWN as a dim orange outline for the full 700ms. She sees the exact volume that is about to burn before it burns.
  sprayTime: 1200ms of continuous flame, aim vector LOCKED at telegraph end (never tracks — moving perpendicular always works, same invariant as the guard)
  cooldown: 2400ms
  fuel tank: a 6x6px yellow square on his back. Tentacle tip hits on the tank (a separate 8px hitbox) deal 999. He explodes: `cam.shake(9,0.4)`, radius 90px, 45 damage to every enemy in it INCLUDING her if she is inside, `G.spawnDebris(...,8,...)`, and the tile is scorched. Killing one pyro inside a guard squad is the single best play in the game.

HOW FIRE COUNTERS HER, mechanically:
  1. Burn: 14/tick while in the cone.
  2. IGNITION — the real threat. Two ticks inside the cone (400ms) sets her ON FIRE: 8 dps for 3000ms, and while burning `B.bloodiness` drives a charred sprite tier and her tentacle grip strength drops 35% (raise the constraint slack in `R.step` for burning frames) so she literally cannot hold on. Fire attacks her verb, not just her hp — that is what makes it scary rather than a damage number.
  3. Fire also DESTROYS anchors: every tile the flame cone crosses becomes ungrippable for 4000ms. Reuse `foamTile`/`foamBlocks` verbatim, just retint it orange and rename. The existing 6-second foam mechanic is exactly right; only the fiction changes.

HOW SHE COUNTERS FIRE — three answers, all discoverable without text:
  1. WATER. Every level generates 2-4 coolant pools (new tile T_WATER, id 10, walkable). Passing through one extinguishes burning instantly and grants 1500ms of fire immunity, shown as blue steam wisps off the body. BSP already places T_HAZARD pools; T_WATER uses the same placement code with a different tile.
  2. THE TANK. Shoot the yellow square. See above.
  3. FLANK. The 700ms telegraph plus the LOCKED cone means a perpendicular flow at her normal speed clears the 24-degree cone in ~350ms. Fire is only lethal to a player who charges straight down the middle.

E_GUARD — keep every number in the current table; they are already correct and hard-won. telegraph 420ms + bullet travel at 300px/s = 1087ms of warning at 100px. Keep `aiming<2` (max 2 guards aiming at once), keep off-screen guards frozen in ST_SUSPECT, keep the locked aim vector. Only change: raise hp 45 -> 50 so a single lash (40) never kills a guard, which preserves the grab as the correct answer to an armed enemy.

E_TURRET and E_ENFORCER — keep unchanged. Both are already built on the same telegraph-then-lock contract.

THE FIVE FAIRNESS RULES (make them a comment block at the top of the enemy section and never break one):
  R1 MINIMUM WARNING. No attack may land in under 400ms from its first visible telegraph frame. Guard 420ms, pyro 700ms, enforcer 700ms, turret 500+320=820ms. Her fastest evasive input (a drag flick) moves her ~180px in 300ms, so every telegraph is beatable by a reaction, not a memorisation.
  R2 NEVER OFF-SCREEN. Nothing commits to an attack unless `wcam.contains(e.x, e.y, 16)`. Already enforced for guard and hazmat — enforce it for pyro too.
  R3 LOCKED VECTORS. Every aim vector is computed once at telegraph end and never updated. Perpendicular movement always works. This is the single rule that makes the game feel fair.
  R4 CONCURRENCY CAP. At most 2 guards in ST_AIM and at most 1 pyro in ST_ATTACK at any time, recounted every frame (never a mutable counter — the existing comment about this leak is correct).
  R5 SPAWN MERCY. `world.mercy` blocks all attack commitment for 1200ms after a level start or a respawn.

**Por que:** The screenshots the user sent show a flamethrower soldier, and fire versus a flesh monster is the most legible threat relationship the genre has. The design's existing HAZMAT already implements the mechanically correct idea (an enemy that removes your ability to grip rather than your hp) — swapping the fiction from foam to fire costs almost no code, matches the reference art, and turns an abstract debuff into something the player instantly understands. The ignition mechanic attacks the verb (grip strength) because a monster that merely loses hp to fire is not frightened of fire; one that cannot hold onto walls while burning is. The explosive tank exists because every hard counter needs a spectacular answer, and a chain-detonation inside a guard squad is the highest ceiling play available at this complexity budget. The five fairness rules are lifted from what the existing guard code already does correctly — writing them down as invariants prevents the pyro from being added in a way that violates them.

```js
pyro: {
  id: E_PYRO, name: 'LANZALLAMAS',
  hp: 55, w: 18, h: 28, sw: 22, sh: 30,
  walk: 74, damage: 14, weight: 10,
  telegraph: 0.70, coneRange: 200, coneHalfAngle: 0.42,
  sprayTime: 1.20, cooldown: 2.40, tick: 0.20,
  igniteTicks: 2, burnDps: 8, burnTime: 3.0, gripLoss: 0.35,
  tankR: 8, tankBlast: 90, tankDmg: 45,
  scorchTime: 4.0,
  grabbable: true, firstLevel: 2,
},

// En el bucle de enemigos, case E_PYRO:
else if (e.st === ST_ATTACK) {
  e.vx = 0;
  e.shotT -= dt;
  if (e.shotT <= 0) {
    e.shotT = S.tick;
    // El cono quema tiles (los vuelve inagarrables) y la quema a ella.
    for (let s = 1; s <= 8; s++) {
      const r = (S.coneRange * s) / 8;
      const fx = e.x + e.aimX * r, fy = e.y + e.aimY * r;
      if (solidAt(L, fx, fy)) break;
      foamTile(L, Math.floor(fx / TS), Math.floor(fy / TS));   // ahora es chamuscado
    }
    const pdx = px - e.x, pdy = py - e.y, pd = Math.hypot(pdx, pdy) || 1;
    const dot = (pdx / pd) * e.aimX + (pdy / pd) * e.aimY;
    if (pd < S.coneRange && dot > Math.cos(S.coneHalfAngle) && world.onBurn) {
      world.onBurn(S.damage);          // el modulo del jugador cuenta los ticks
    }
    if (world.onFlame) world.onFlame(e.x, e.y, e.aimX, e.aimY, S.coneRange);
  }
  if (e.t >= S.sprayTime) { e.st = ST_PATROL; e.t = 0; e.cool = S.cooldown; }
}
```

## ESCALATION over a 2-4 minute level

**Recomendacion:** A level is 150 seconds of intended play with a hard soft-cap at 240s. Escalation is driven by ONE variable, `alert` (0-3), which rises from her own violence, plus a slow timer floor. Everything else keys off it. Score the level as `kills*base + timeBonus` where timeBonus = max(0, 300 - floor(t*2)) so speed is rewarded but not required.

PHASE 0 — HUNTING GROUND (0-30s, alert 0).
  Only scientists (4+d of them). Zero armed enemies awake. Lighting: dim red emergency, 55% ambient. Music: none, only a 40Hz industrial hum and drips.
  Player action: pure slaughter. She should get 3-5 kills in this window with no risk whatsoever.

PHASE 1 — SOMEONE NOTICED (alert 1; triggered by the first alarm press OR at t=40s, whichever first).
  Alarm klaxon (`SFX.alarm`), ALL red emergency lights start pulsing at 0.8Hz (modulate the tile-draw tint), `L.alertLight = 1`.
  Guards wake from ST_PATROL into an active sweep toward her last known room. Guard count active goes from 0 to countFor(E_GUARD).
  Music starts: a 2-track loop, tri bass on a minor pedal at 96bpm plus a noise pulse. It should feel like a heartbeat, not a melody.
  Scientists now start in ST_PANIC on spawn-sight instead of ST_IDLE — the room is already running before she enters.

PHASE 2 — LOCKDOWN (alert 2; at 2 alarms pressed OR t=90s).
  T_DOOR tiles CLOSE for 600ms in waves and stay closed on the route she has not taken, funnelling her forward. (`shatterWall`/enforcer already opens holes, so this never softlocks.)
  Pyros wake. `spawnReinforcements` begins: 2 guards at the nearest door every 20s, capped by GUARD_LIVE_CAP 6.
  Music adds a third track: a 0.125-duty pulse arpeggio. Tempo 96 -> 112bpm.
  Lights: alert pulse to 1.4Hz.

PHASE 3 — PURGE (alert 3; at 3 alarms OR t=150s).
  THE FIRE SUPPRESSION SYSTEM ACTIVATES. This is the level's clock and its best image: sprinkler nozzles along ceilings emit burning gas in a 2-tile band that sweeps the level from the entry side toward the exit at 22px/s. Standing in it: 10 dps and instant ignition. It is not an instant-kill wall, it is pressure — she can cross it, it just hurts.
  Turrets and enforcers all wake.
  Music tempo 112 -> 128bpm, add a second noise track on 16ths.
  Exit arrow starts pulsing white.

HARD CAP at 240s: the sweep speed doubles to 44px/s. She will be pushed out or die within ~40s. No level can run past ~280s.

ESCALATION IS ALSO SPATIAL: the BSP generator already computes BFS distance to exit. Sort rooms by that distance and place enemies by weight so the far half of the level holds 70% of the armed units. She always travels from safe to dangerous, which means the fantasy runs slaughter -> resistance -> escape in that order every single time.

**Por que:** Carrion's tension comes from the building being aware of you, not from a difficulty slider. Tying everything to one `alert` integer that HER OWN actions drive (the alarms she failed to prevent) means the escalation reads as consequence rather than as a timer, which is far more satisfying and also gives skilled play a real reward: kill the alarm-runners and phase 2 arrives 50 seconds later. The timer floor exists only so a passive player still experiences the arc. The sweeping fire band is the right kind of clock because it is visible, directional, survivable, and thematically the lab's last resort against her — and it reuses the pyro's burn/ignite code that already exists by then, costing almost nothing new.

```js
// En update(), una vez por frame.
stepAlert(dt) {
  const t = this.t;
  let want = this.alarmsUsed;
  if (t > 40 && want < 1) want = 1;
  if (t > 90 && want < 2) want = 2;
  if (t > 150 && want < 3) want = 3;
  if (want > this.alert) {
    this.alert = want;
    this.world.alert = want;
    SFX.alarm();
    this.flash(want >= 3 ? 'PURGA' : 'ALERTA ' + want);
    if (want >= 3) { this.purgeY = this.L.spawnY; this.purgeOn = 1; }
    if (want >= 1) playMusic(SONGS.symbiote[Math.min(want - 1, 2)]);
  }
  // Banda de fuego de la purga: barre hacia la salida.
  if (this.purgeOn) {
    const spd = t > 240 ? 44 : 22;
    this.purgeY += this.purgeDir * spd * dt;
    if (Math.abs(this.B.y - this.purgeY) < 24) this.burnTick(dt * 10);
  }
}
```

## FEEDING AND GROWTH — yes, but as a per-level power curve that resets, not a permanent upgrade tree

**Recomendacion:** YES to growth, with a strict shape: BIOMASS is a 0-100 meter that fills from kills and drains slowly, and it drives THREE tiers with visible, mechanical differences. It resets to 0 at the start of every level. It is a power curve, not a save file.

BIOMASS ECONOMY:
  scientist grab kill +18, scientist lash kill +10 (the grab is worth more — the spectacular play is the efficient one, per canon correction 3)
  guard +26, pyro +30, turret +14, enforcer +40
  drain: -3.5/second, always. She must keep killing or she shrinks.
  Feeding also heals: +6 hp per scientist (already in the code), +10 per armed kill.

TIER 1 — LARVA (biomass 0-34). Body sprite 24px. 3 tentacles. Reach 150px. hp cap 100. Base flow speed.
TIER 2 — BEAST (35-74). Body 34px (bake a second, bigger BLOB). 4 tentacles. GRAB_R 150 -> 190. hp cap 130 (and gain 30 instantly on crossing up). Flow speed +12%. NEW ABILITY: the grab now kills TWO targets if a second enemy is within 60px of the first — the tear timeline runs once and both die. The eyes change from 1 to 3.
TIER 3 — HORROR (75-100). Body 44px. 6 tentacles (the pool cap TENT_MAX is already 6 — this is the reason to have it). GRAB_R 230. hp cap 160. Flow speed +22%. NEW ABILITY: she can smash T_SOLID wall tiles by flowing into them above 400px/s — `shatterWall` already exists, and the enforcer already teaches that walls can break. At tier 3 she stops using doors. The eyes go to 5 and the body sheds a constant drip of blood particles.

SHRINKING: crossing a tier boundary downward is announced with a 200ms squelch, a body-shrink tween over 250ms, and a red vignette flash. Losing HORROR must sting.

HOW IT READS VISUALLY, in priority order (a player must be able to read her tier at 3 metres on a phone in sunlight):
  1. SIZE. 24 / 34 / 44px is a 1.83x range — unmistakable.
  2. TENTACLE COUNT. 3 / 4 / 6 fanning out. This is the Carrion silhouette and the single most recognisable cue.
  3. EYE COUNT. 1 / 3 / 5 red dots. Carrion's creature does exactly this.
  4. A meter under the health bar, 200x8px, filled with BLOOD_MID, with two tick marks at 35% and 75%.

WHY IT RESETS PER LEVEL: a permanent tree would mean level 6 is trivial for a good player and impossible for a bad one, and it would make death cost 20 minutes. A per-level curve means every level replays the full arc from vulnerable to unstoppable in 2-4 minutes, which is the arc the player actually wants to feel — and it makes the escalation in finding 4 fight her rising power head-on, which is the tension the whole design needs.

**Por que:** Growth is central to Carrion and the mechanic the user pointed at, but a persistent upgrade tree in a 2-4 minute arcade level would break both the difficulty curve and the sub-1.5s retry requirement. Making it a per-level curve gives every session the complete power fantasy arc and makes the drain rate a live pressure that pushes the player forward into danger — exactly the behaviour the escalation section wants. The three cues (size, tentacle count, eye count) are stacked deliberately so the tier is readable even when the body is covered in blood and the screen is shaking. TENT_MAX is already 6 in the rope module, so tier 3 costs no new pool capacity.

```js
const TIER_BM = [0, 35, 75];
const TIER = [
  { r: 12, tents: 3, grab: 150, hp: 100, spd: 1.00, eyes: 1 },
  { r: 17, tents: 4, grab: 190, hp: 130, spd: 1.12, eyes: 3 },
  { r: 22, tents: 6, grab: 230, hp: 160, spd: 1.22, eyes: 5 },
];

feed(n) {
  const before = this.tier;
  this.biomass = Math.min(100, this.biomass + n);
  this.tier = this.biomass >= TIER_BM[2] ? 2 : this.biomass >= TIER_BM[1] ? 1 : 0;
  if (this.tier > before) {
    const T = TIER[this.tier];
    this.B.hpMax = T.hp; this.B.hp = Math.min(T.hp, this.B.hp + 30);
    this.growT = 0.25;
    cam.shake(6, 0.25); vibrate([0, 30, 40, 70]);
    SFX.powerup(); this.flash(this.tier === 2 ? 'HORROR' : 'BESTIA');
  }
}

stepBiomass(dt) {
  const before = this.tier;
  this.biomass = Math.max(0, this.biomass - 3.5 * dt);
  this.tier = this.biomass >= TIER_BM[2] ? 2 : this.biomass >= TIER_BM[1] ? 1 : 0;
  if (this.tier < before) {
    this.growT = -0.25;
    sfx({ type:'noise', f0:500, f1:120, dur:0.20, vol:0.26 });
    this.B.hpMax = TIER[this.tier].hp;
    this.B.hp = Math.min(this.B.hp, this.B.hpMax);
  }
}
```

## FAILURE — how she takes damage, how she dies, and a retry in 1150ms

**Recomendacion:** DAMAGE SOURCES AND NUMBERS (hp cap 100/130/160 by tier):
  guard bullet 22, burst of 3 = 66 worst case
  pyro flame tick 14 @ 5/s = 70dps in cone; ignition 8dps for 3s = 24
  turret beam 4 per 1/12s = 48dps
  enforcer charge 30
  purge band 10dps
  acid pool T_HAZARD 1 per 500ms
  pipe drain 4/s (already in code)
  Scientists: 0. Always. Forever.

DEFENSIVE RULES:
  iframes 800ms after any hit, with the existing 20Hz sprite blink.
  DAMAGE GATE: at most 55% of max hp can be lost in any 1000ms window. Track `dmgWindow` and clamp. This kills the single worst arcade death — the one where three sources overlap and she dies without a readable cause.
  LAST STAND: any hit that would take her from above 25hp to 0 or below instead leaves her at 1hp and grants 900ms of iframes, once per level. She always gets one chance to flee. Announced with a 300ms white flash and a low tri tone.
  HEALING: +6 per scientist, +10 per armed kill. Feeding is the only heal. There are no pickups.

DEATH SEQUENCE — total 1150ms from lethal hit to a fully playable retry:
  t=0 lethal hit. `freeze = 0.20` (12 frames — the one place the 11-frame cap is deliberately exceeded, because it is the end of the run).
  t=0 `G.sprayPulse(spray, B.x, B.y, 0, -1, 24, rnd)`, `cam.shake(9, 0.40)`, `vibrate([0,90,60,140])`.
  t=0-500ms the body deflates: sprite scale lerps 1.0 -> 0.35 over 500ms while the tentacles go limp (stop the constraint solver, keep gravity — the verlet rope collapsing under gravity is a genuinely great death animation and it is free).
  t=200ms `sfx({type:'saw', f0:220, f1:40, dur:0.55, vol:0.40})` — a descending wet moan.
  t=500-1000ms a large blood pool stamps under her via `stampPool`, and the screen desaturates by drawing a `#2a0008` rect at 45% alpha over everything.
  t=700ms text appears: 'MUERTA' centred, scale 5, plus 'TOCA PARA REINTENTAR' at scale 2 below it.
  t=900ms INPUT ACCEPTED. Any touch anywhere restarts.
  t=900-1150ms the restart itself: `startLevel()` regenerates from the SAME seed and the same level index, so the retry is the same level, not a new one. Level generation is already measured across 1600 levels, so this is well under 250ms.

RETRY POLICY: she restarts the CURRENT level with score preserved from completed levels (canon correction 8). Death costs the current level's points only. Never the run.

The 900ms input gate exists only so a player mashing the attack button at the moment of death does not skip the death animation before seeing it; below 900ms the deaths become invisible and the player never learns what killed her. From input to playing is 250ms, and total press-to-playing worst case is 1150ms.

**Por que:** The brief demands sub-1.5s retry and this lands at 1150ms worst case with 250ms of that being real work. The damage gate and the last stand are both there to satisfy the design's own anti-cheap-death principle: with four simultaneous damage sources at alert 3, unclamped damage will produce deaths the player cannot parse, and an unparseable death in an arcade game reads as unfairness. Restarting the same seed matters more than it looks — a player who died to a specific pyro ambush wants to beat THAT room, and regenerating a fresh level converts a learning experience into a shrug. The deflating verlet rope costs zero new code: disabling the constraint iterations and leaving gravity on makes the existing solver produce the animation for free.

```js
hurt(n, src) {
  if (this.iframe > 0 || this.dead) return;
  const cap = this.B.hpMax * 0.55;
  if (this.dmgT > 0 && this.dmgAcc + n > cap) n = Math.max(0, cap - this.dmgAcc);
  if (n <= 0) return;
  // ULTIMO ALIENTO: una vez por nivel, nunca muere de golpe desde arriba de 25.
  if (this.B.hp > 25 && this.B.hp - n <= 0 && !this.lastStand) {
    this.lastStand = 1; this.B.hp = 1; this.iframe = 0.9; this.whiteT = 0.3;
    sfx({ type:'tri', f0:110, f1:70, dur:0.45, vol:0.38 });
    cam.shake(7, 0.3); vibrate([0, 70, 50, 70]);
    return;
  }
  this.B.hp -= n;
  if (this.dmgT <= 0) { this.dmgT = 1.0; this.dmgAcc = 0; }
  this.dmgAcc += n;
  this.iframe = 0.8; this.freeze = 0.10;
  cam.shake(6, 0.2); SFX.hurt(); vibrate(70);
  if (this.B.hp <= 0) {
    this.dead = 1; this.deadT = 0; this.limp = 1;   // limp: el solver suelta la cuerda
    this.freeze = 0.20; cam.shake(9, 0.4); vibrate([0, 90, 60, 140]);
    G.sprayPulse(this.spray, this.B.x, this.B.y, 0, -1, 24, this.rnd);
    setTimeout(() => sfx({ type:'saw', f0:220, f1:40, dur:0.55, vol:0.40 }), 200);
  }
}
```

## THE FIRST 10 SECONDS — what is on screen at spawn, second by second

**Recomendacion:** Cold open. No logo, no title card, no tutorial, no dialogue. The level fades up from black over 300ms and she is already mid-motion.

AT SPAWN, the generator GUARANTEES this composition (extend the existing `spawnEnemies` opening guarantee, which already forces 2 scientists in view — that code is right, it just needs the rest of the frame built around it):
  - She spawns 2 tiles BELOW a ceiling with 5+ tiles of clear vertical space, in a room at least 8 tiles wide. The chamber reads as a containment cell.
  - A SHATTERED CONTAINMENT TANK directly behind her: a bespoke 3x4 tile decoration of broken glass and a dark opening, with `stamp` gore pre-applied in a 90px radius. She came from there. Nothing says it.
  - THREE scientists, not two: one at 200px in ST_PANIC ALREADY RUNNING (pre-set, not idle — the first thing she ever sees is someone fleeing her), one at 330px in ST_ALARM already running for the alarm panel, one at 420px in ST_DOOR already banging on a locked door. Raise `L.openingScientists` target from 2 to 3.
  - Every one of them is lit by the red emergency lighting and casting the pulsing shadow.
  - Zero armed enemies within 600px. `world.mercy = 1.2` at level start.

OPENING MOTION — she does not start at rest. At t=0 the body is given `vx = 0, vy = -240` (an upward burst out of the tank) and 4 tentacles are pre-fired at the ceiling in a fan (-0.9, -0.3, +0.3, +0.9 rad from vertical). She is ALREADY hanging from the ceiling with tentacles fanned when the fade completes. The very first frame the player sees is the Carrion silhouette, not a blob on a floor.

SECOND BY SECOND:
  0.0-0.3s black -> full. Sound: a low 40Hz hum plus a single glass-shatter noise burst.
  0.3s she is hanging from the ceiling, 4 tentacles fanned, three scientists visible and all three already screaming and running in different directions. The alarm-runner has a rising tone playing.
  0.3-1.0s NO PROMPT YET. Let her look.
  1.0s if no touch has been registered, a hand icon fades in at 35% alpha over the lower-left with a 60px arrow, and the attack button pulses. It fades out permanently the instant any touch lands. If she touches before 1.0s, it never appears at all.
  ~1.5-3.0s first drag. She flows. The tentacles auto-grip; there is nothing to learn.
  ~3-5s first contact with the panicking scientist. Because the trip chance is distance-scaled, he will very likely trip in front of her — the game hands her a free execution on her first attempt.
  ~5s FIRST KILL. The full 617ms grab timeline, hitstop, slow-mo, spray, the body reddens one tier, biomass 18.
  ~6-8s the alarm-runner reaches the panel. Either she gets there and cancels it (a chase with a clear goal and a rising audio countdown), or she does not and the klaxon fires, alert goes to 1, the lights start pulsing and the guards wake. EITHER OUTCOME IS GOOD: one teaches her that killing has purpose, the other starts the escalation. The game cannot produce a boring first 10 seconds.
  ~8-10s the door-banger is still banging, unreachable, permanent theatre in the background.

THE GUARANTEE: three fleeing humans, a hanging fanned-tentacle silhouette, a ticking alarm and a locked-door pounding are all on screen inside 300ms of the fade. There is nothing to read and nothing to press first.

**Por que:** The first attempt failed partly because the player's opening experience was a stationary blob and an aiming problem. Spawning her already airborne, already hanging, already fanned means the first frame states the fantasy before the player has done anything, and the drag-to-move control has nothing to explain because it produces motion on the first touch. Three scientists rather than two, each in a DIFFERENT panic state, is deliberate: it demonstrates the whole prey vocabulary (flee, alarm, door) in one glance and gives the player a legible priority target (the alarm-runner) without a single word. The 1.0s delayed hint respects a player who just starts playing while catching one who hesitates. Making both alarm outcomes good removes the only way the opening could go flat.

```js
// Al final de startLevel(): la abre ya colgada, no en reposo.
openPose() {
  const B = this.B, R2 = this.rope;
  B.oy = B.y + 4;                 // velocidad implicita hacia arriba (verlet)
  const fan = [-0.9, -0.3, 0.3, 0.9];
  for (let k = 0; k < TIER[this.tier].tents && k < fan.length; k++) {
    const a = -Math.PI * 0.5 + fan[k];
    R.fire(R2, B, Math.cos(a), Math.sin(a), this.solidFn, W.TS, 240);
  }
  this.fadeT = 0.3;
  this.hintT = 1.0;               // la mano solo aparece si no toca antes
  this.world.mercy = 1.2;
  sfx({ type:'noise', f0:4200, f1:800, dur:0.22, vol:0.30 });   // cristal roto
}

// En spawnEnemies, tras colocar los 3 de la apertura, darles estado inicial
// distinto a cada uno para que la primera imagen enseñe todo el vocabulario.
const OPEN_ST = [ST_PANIC, ST_ALARM, ST_DOOR];
// e.st = OPEN_ST[opening]; e.t = 0;
```

## Keep / replace verdict on the existing modules, and the resolution question

**Recomendacion:** KEEP sym-gore.js ENTIRELY, unchanged. The three-pulse arterial spray, the half-res persistent world layer, the growing pools via `stampPool`, the wall drips and the oldest-particle recycling are all exactly right for Carrion and are the best-tuned code in the project. Do not touch it.

KEEP sym-world.js GENERATOR AND AI. The BSP generation, pipes, BFS reachability (1600 levels, 0 unreachable), the camera, DDA raycast, `lineOfSight`, the enemy pool with uid discipline, and the entire guard/turret/enforcer state machines are all keepers. Changes needed: (a) swap E_HAZMAT's fiction for E_PYRO in the same slot, (b) add ST_DOOR and ST_SURRENDER, (c) retune the trip chance, (d) add T_WATER (id 10), (e) REPLACE the tile art arrays A_FLOOR/A_WALL/etc entirely — the bright clinical palette is wrong. New palette: floor #14161c with #1c2028 grating lines, walls #0d0f14 with #232833 panel edges and #2a1a1a rust, pipes #2b2f3a, and every room lit by a red key light — draw a per-tile tint of #3a0c10 modulated by the alert pulse. The generator is fine; the paint is not.

REPLACE sym-rope.js LOCOMOTION, KEEP THE SOLVER. `rayTiles`, `makeRope`, the verlet integration, the constraint loop and `drawTentacle` all survive. Throw away `fire`/`release`/the swing branch of `step` and the entire GRAV/SWING/AUTH pendulum model. The new locomotion is: N tentacles (3/4/6 by tier) continuously and automatically seek anchor points, and the body is pulled toward the finger by the anchored ones.

NEW LOCOMOTION IN ONE PARAGRAPH (this is what fixes 'rarisima'): every 100ms, each free tentacle raycasts in a direction biased 60% toward the drag vector and 40% spread evenly around the body, out to 150px; the first solid it finds becomes its anchor, no input required. Anchored tentacles apply a force toward the finger of `PULL = 2600 px/s^2` scaled by `max(0, 1 - speed/700)` (keep the authority falloff — it is the one idea from the old model worth saving). A tentacle whose anchor exceeds 165px or whose line to the body is blocked releases automatically and re-seeks. Body max speed 700px/s at tier 1. Gravity drops from 1400 to 500 — she is a climbing mass, not a pendulum, and heavy gravity is precisely what forced the grapple-swing feel. With no finger down she holds position and idles, tentacles drifting. There is NO fire, NO release, NO aim, and NO button for movement of any kind.

RESOLUTION: KEEP 540x1200 / TS=24, and keep meta.rotates. In landscape it becomes 1200x540 = 50x22.5 tiles, which is a genuinely Carrion-like wide framing and the better orientation for this game. Two things must be handled on rotation: (1) `WorldCam` deadzone and clamp must be recomputed from the new VW/VH in the `setRotatable` callback, and (2) the HUD and the attack button must be repositioned — button at (VW-96, VH-150) in portrait, (VW-110, VH-90) in landscape, and the health/biomass bars move to the top-left corner in both. Fill cost is identical (648,000 px either way), so there is no performance question. Do not change the virtual resolution.

**Por que:** The user's feedback was architectural, and the architecture that failed is contained almost entirely in three functions of sym-rope.js. Everything else in the project is verified, tuned and correct, and rewriting it would risk the parts that already work while not addressing the complaint at all. The single most important number in the whole redesign is dropping GRAV from 1400 to 500: at 1400 the body falls faster than the tentacles can re-anchor, which forces the player into a swing rhythm — which is exactly the grapple-hook feel he rejected. The auto-seek raycast every 100ms per tentacle is 6 raycasts per 100ms worst case, roughly 60 DDA walks per second, which is nothing on an Adreno 612. Landscape at 1200x540 giving 50 tiles of width is worth calling out because it is the first time the game will actually look like the reference screenshots.

```js
// Nuevas constantes de locomocion, sustituyen a GRAV/SWING/AUTH.
export const GRAV = 500;        // era 1400: bajarla es LA correccion clave
export const PULL = 2600;       // aceleracion hacia el dedo por tentaculo anclado
export const AUTH = 700;        // caida de autoridad, se conserva del modelo viejo
export const MAXSPD = 700;
export const SEEK_T = 0.10;     // cada tentaculo libre busca anclaje cada 100ms
export const REACH = 150, BREAK = 165;

// Sustituye a fire(): nadie dispara nada, se buscan solos.
function seek(R, B, i, dirX, dirY, solidFn, TS, rnd) {
  // 60% sesgado hacia el dedo, 40% repartido alrededor del cuerpo.
  const base = Math.atan2(dirY, dirX);
  const spread = (i / TENT_MAX) * 6.283;
  const a = rnd() < 0.6 ? base + (rnd() - 0.5) * 1.2 : spread + rnd() * 0.6;
  const h = rayTiles(solidFn, TS, B.x, B.y, Math.cos(a), Math.sin(a), REACH);
  if (h[4] < 0) return false;
  R.state[i] = T_ANCHORED;
  R.ax[i] = h[0]; R.ay[i] = h[1];
  R.len[i] = Math.max(LEN_MIN, h[4]);
  return true;
}

// El cuerpo: cada tentaculo anclado tira hacia el dedo, con caida de autoridad.
function pullBody(R, B, dt, fx, fy) {
  let n = 0;
  for (let i = 0; i < TENT_MAX; i++) if (R.state[i] === T_ANCHORED) n++;
  if (!n || (fx === 0 && fy === 0)) return;
  const vx = (B.x - B.ox) / dt, vy = (B.y - B.oy) / dt;
  const sp = Math.hypot(vx, vy);
  const fall = Math.max(0, 1 - sp / AUTH);
  const acc = PULL * fall * Math.min(1, n / 3) * dt;
  B.x += fx * acc * dt; B.y += fy * acc * dt;
}
```

## Pitfalls

- GRAV must drop from 1400 to 500. This is the single change that fixes 'rarisima'. At 1400 the body falls faster than tentacles can re-anchor, which mechanically forces a swing rhythm — the exact grapple-hook feel the player rejected. Everything else in the redesign is cosmetic if this number stays at 1400.
- Never let the attack button do nothing. If `pickTarget` returns null it MUST run the lash timeline. A button that sometimes silently fails destroys the feeling of being an unstoppable monster faster than any other single flaw.
- At least one tentacle must stay anchored to a wall during the entire 617ms grab timeline. If all tentacles commit to the victim, the body stalls for 300ms every kill and the game becomes a series of QTEs instead of a flow.
- MAX_VOICES is 12 in audio.js. A `scare()` contagion wave can wake 6 scientists in one frame; 6 saw yelps plus the kill's noise+tri layers will exceed the cap and silently drop the tear sound — the one sound that must never be missed. Rate-limit yelps to 2 per 300ms with a module-level counter.
- Hitstop must live inside `update()` as internal state, never as an early return. The engine's fixed-timestep accumulator keeps running; returning early from update does not stop the clock and produces a stutter rather than a freeze. The existing `this.freeze` pattern in symbiote.js is correct — copy it exactly.
- `Pool` uses swap-remove. `this.grabE` holds an enemy reference across ~37 frames while other enemies can die and be freed. Store `grabUid` and re-resolve by uid every frame, or the grab will silently retarget to whatever object got swapped into that slot mid-tear.
- Never pass `null` as the Pool reset function in this game. A recycled enemy inherits `hp<=0`, `dead=1`, `grip=1` and `stagger` from its previous life and spawns already dead or frozen. The existing `rstEnemy` must gain resets for every new field (grabUid, burnT, tankHp).
- `setVirtual` resets the 2D context including `imageSmoothingEnabled`. On every rotation the game must re-set it or the entire game silently renders blurry. core.js already does this inside setVirtual — do not add a second path that sets canvas.width directly.
- The gore layer is sized `L.pxW/2 x L.pxH/2` at level generation and does NOT change on rotation — it is world-space, not screen-space. Do not reallocate it in the rotation callback; only the camera clamp and HUD positions change.
- Scientist damage must be exactly 0 in every state including ST_SURRENDER and ST_DOOR. The moment prey can hurt her, the power fantasy inverts and the whole design collapses.
- The pyro's aim vector must be locked at telegraph end and never updated during the 1200ms spray. A tracking flame cone is unavoidable damage and violates fairness rule R3 — it is the difference between a tense enemy and an unfair one.
- Biomass tier changes reallocate nothing: bake all three body sprites at all four blood tiers during `init` (12 canvases total, each under 50x50px). Baking on tier-up would hitch the frame at the exact moment the player is being rewarded.
