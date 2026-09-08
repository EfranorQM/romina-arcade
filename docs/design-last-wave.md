# LAST WAVE

> One thumb keeps Romina alive; her gun handles the rest — and every 30 seconds she gets scarier than the horde.

**Loop:** 8-12s loop: a wave spawns from the four screen edges (2-4 enemies at first, 20+ later). Romina auto-fires at the nearest enemy every fireCd ms with zero input. The player slides one thumb to weave between converging bodies, kite the slow tanks, and funnel the swarm into a line so pierce/explosive shots chew through it. Enemies die in 1-4 hits, dropping XP shards that magnet in from 40px. When the wave's spawn budget is emptied and the last enemy dies, all bullets freeze mid-air, the screen dims 45%, and 3 upgrade cards slide up from the bottom in 180ms. One tap picks one; the cards slide out in 120ms and the next wave spawns 400ms later. No pause menu, no confirm, no reading required — each card is a big icon + 1 word + 1 number.

**Duracion de partida:** 5-8 minutes. Target median 6.5 minutes for an average player, ending around wave 13-15. Wave 1 lasts ~5 seconds; waves 1-5 total ~55 seconds (the honeymoon, near-unloseable); waves 6-11 total ~2.5 minutes (the real game); waves 12+ average ~35 seconds each and get progressively shorter as the survival window narrows. Between-wave overhead is ~1.1 seconds per wave (400ms vacuum + 180ms slide-in + tap + 120ms slide-out + 400ms beat), so ~16 seconds of a 6.5-minute run is spent choosing upgrades — enough to feel like a decision, short enough never to break the trance. Time from app cold start to first bullet: the menu is already showing, one tap on the LAST WAVE card, first auto-fire ~900ms into wave 1.

**Muerte:** Romina dies when hp reaches 0. Damage is only ever contact damage (1 from grunt/runner/swarmling/spitter, 2 from tank) or a spitter's projectile (1), and 800ms of iFrames after every hit means she can never lose more than 1 hp per 800ms regardless of how many bodies she is standing in. With 5 base hp that is a hard floor of 4 seconds from full health to death even in a total pile-up — long enough that death always feels like a sequence of mistakes rather than an ambush.

DEATH IS NEVER CHEAP, by three explicit guarantees: (1) every enemy is telegraphed by a 350ms blinking warning mark at its exact spawn point, always at least 3px inside the visible playfield — nothing ever materializes on top of her; (2) contact damage never scales with wave number, so 5 hp always means 5 mistakes; (3) the runner's dash and the spitter's shot both have visible windups (220ms and 380ms) with matching audio tells, and neither re-aims after the windup — a sidestep always works.

DEATH SEQUENCE -> RETRY, total 550ms: 6 frames of hitstop (100ms) + magenta screen flash decaying to 0 + 30-particle burst + shake 6.0 + the 4-note descending game-over tone, then a 250ms 6-step palette fade to the results screen. The results screen shows, in the 5x7 bitmap font: 'ROMINA' at scale 2, 'WAVE nn' at scale 3 (the number is the emotional payload, not the score), 'SCORE nnnnn' at scale 2, 'BEST nnnnn' at scale 1, and — only if a new record — 'NEW RECORD' pulsing plus 'BIEN HECHO ROMINA' in '#f2f24a'. A 'TAP' prompt fades in at t=550ms.

RETRY: any pointerdown after t=550ms restarts wave 1 immediately — full state reset, new rng seed, no menu round-trip, no confirmation, no loading. From the frame of death to the frame of the new wave-1 spawn window opening: 550ms of results + 1 tap + 0ms transition, well under the 1.5-second requirement. A smaller 'MENU' hit zone occupies only the bottom 40px of the results screen for when she actually wants to leave; everything above it is retry, so the default gesture — tap anywhere — always means 'again'.

## Controles

Single floating virtual stick, whole screen. Pointer arbitration per the research: claim byte per pointer slot, edge-triggered `fresh` adoption, `pointercancel` handled identically to `pointerup`.

VIRTUAL GRID: 180 x 400 (aspect 2.222, exact 20:9 match, zero letterbox). All numbers below are in these virtual px unless stated.

PLAYFIELD: x in [6, 174], y in [34, 394]. Top 34px is the HUD strip. Romina is clamped to a 5x5 body centered at (px, py) so px in [8.5, 171.5], py in [36.5, 391.5].

STICK (gameplay):
- Spawns wherever the first pointer goes down, ANYWHERE in the playfield — no dedicated zone, no wrong place to touch.
- maxRadius = 26 virtual px (~57 CSS px on the Redmi at scale 2.182 — a comfortable thumb sweep).
- deadZone = 0.18 of maxRadius (4.68 px). Magnitude rescaled `(n-dead)/(1-dead)` so speed ramps from 0, never snaps to 18%.
- Origin DRAGS behind the thumb once |d| > maxRadius: `ox += dx*(1-maxr/d)` — the stick never feels stuck on a long swipe.
- Output is a unit vector * eased magnitude; player speed = 62 * mag px/sec (base).
- Visual: only drawn while active. Base = a hollow 2px-thick square ring, 26px half-extent, drawn as 4 fillRects in '#3d1a5c' at globalAlpha 0.35. Knob = a 5x5 filled square in '#4de0f0' at alpha 0.55 at (ox + sx*26, oy + sy*26). Both snapped with Math.round. Zero glow, zero circles.
- SAFE INSET: the stick VISUAL may render anywhere, but a pointerdown whose x < 11 or x > 169 (inside the ~24 CSS px MIUI back-gesture inset) still spawns a stick — it just spawns with its origin clamped to x in [11,169] so the thumb has room to pull in any direction.

SECOND POINTER: ignored during gameplay (claim stays -1, nothing adopts it). No second control exists. Deliberate: a stray palm/knuckle contact can never do anything.

UPGRADE CARDS (between waves):
- 3 cards, full width band. Card w = 168, h = 62. x = 6. y = 128, 200, 272. Gap = 10.
- HIT AREA is the full card rect plus 8px vertical padding — 168 x 78 (~366 x 170 CSS px). Impossible to miss.
- Adopted on pointerDOWN (not up), edge-triggered, first card whose padded rect contains the point. Selection resolves in the same frame the finger lands.
- Bottom card's lower edge sits at y=334, which is 66 virtual px (~144 CSS px) above the screen bottom — clear of the MIUI gesture bar.

GAME OVER: full-screen tap-to-retry. Any pointerdown after t > 550ms restarts instantly into wave 1. No menu round-trip.

MUTE: 12x12 speaker icon at (162, 4) in the HUD, hit area 24x24 padded. Persistent, present in every state.

_The right thumb of a one-handed grip on a 6.43" phone comfortably sweeps a ~57 CSS px radius arc anywhere in the lower two-thirds of the screen without regripping — exactly maxRadius=26 virtual px. Because the stick FLOATS and spawns under the thumb, there is no correct place to put the finger, which is what a casual player who never reads instructions needs: she touches the glass and it works. Because Romina auto-fires, the thumb never leaves the stick, so there is no second control to learn, no button to miss, and no thumb-occlusion problem — the finger is never covering the thing being aimed at, because nothing is being aimed. The origin-drag keeps the stick centered under a wandering thumb during long panic-kites, precisely when a stuck stick would kill her. Upgrade cards are full-width horizontal bands rather than a 3-across row: three across a 180px grid gives 56px targets demanding precision, while stacked full-width bands are 168px wide and can be hit anywhere along their length — the only precision required is vertical, the axis the thumb controls best. Everything interactive stays inside a 6..174px horizontal band, keeping the MIUI back-gesture edge inset clear._

## Paleta

`#07030f` `#140a26` `#25123f` `#3d1a5c` `#6a1f7a` `#e0249a` `#ff5cc8` `#1d47a0` `#2a8ce0` `#4de0f0` `#0f5c4a` `#1fd18a` `#f2f24a` `#ffcd75` `#59c2e8` `#ffffff`

## Entidades

### romina (Player. Auto-fires at nearest enemy. Only movement is player-controlled.)

**Comportamiento:** Position (px,py) floats, clamped to playfield inset by half-body (2.5px). Velocity is INSTANT (no accel/friction) — `px += stickX * speed * dt` — because a casual player reads inertia as unresponsiveness.

FACING: 4 fixed facings chosen by dominant axis of the stick vector; if |stickX| >= |stickY| use left/right else up/down. When mag == 0 the facing HOLDS its last value. Baked as 4 sprite variants, never ctx.rotate.

WALK ANIM: 2 frames per facing, swapped every 140ms while mag > 0.15; frame 0 held while idle.

AUTO-FIRE: each frame, if fireTimer <= 0 AND at least one enemy is alive, find the nearest live enemy by squared distance (linear scan over enemies.n, max 64 — free). Spawn `projCount` bullets aimed at that enemy's CURRENT center (no lead prediction — leading feels like missing to a casual player). Set fireTimer = fireCd. If NO enemy is alive, do not fire and do not tick the timer below 0, so the first shot of a new wave is instant.
  - Multi-shot spread: total arc 14deg * (projCount-1), centered on aim angle. 1 -> [0]; 2 -> [-7,+7]; 3 -> [-14,0,+14]; 4 -> [-21,-7,+7,+21].
  - Muzzle offset: bullets spawn 4px along the aim vector from center.

HEALTH: maxHp 5, hp integer. Contact damage sets iFrames = 800ms; during iFrames zero damage from any source and the sprite alternates normal/white-flash every 66ms (4 frames on, 4 off).

KNOCKBACK ON HIT: push (px,py) 9px directly away from the damaging enemy over 120ms, linear, additive to stick movement, still clamped to playfield.

ORBITALS: not separate pool entities — computed inline each frame from a shared angle `orbAngle` advancing at 2.6 rad/sec. Orbital i sits at (px + cos(orbAngle + i*TAU/orbitalCount)*orbRadius, py + sin(...)*orbRadius), orbRadius 22px. Each is a 4x4 damage box, damage orbDmg, with a per-enemy re-hit cooldown of 400ms tracked as `lastOrbHit` ON THE ENEMY (not per-orbital) so 4 orbitals cannot quadruple-tap one enemy in a pass.

LIFE STEAL: on any enemy death, if lifeSteal > 0, `stealPool += lifeSteal`; while stealPool >= 1.0, stealPool -= 1.0 and hp = min(hp+1, maxHp) plus heal FX. Fractional accumulation means low ranks still pay out instead of rounding to nothing.

**Visual:** 8x8 sprite, 4 facings x 2 walk frames = 8 baked canvases, plus 8 white-flash variants (bakeWhite) = 16 total. Palette: outline '#07030f', skin '#ffcd75', hair '#a3218f' (use '#e0249a' if restricting strictly to the 16-list — see palette), jacket '#2a8ce0', jacket shadow '#1d47a0', boots '#25123f', gun '#4de0f0'.

DOWN frame 0 ('.'=transparent):
"..DDDD.."
".DHHHHD."
".DHSSHD."
"..DSSD.."
".DJJJJD."
".DJBBJG."
"..DJJD.."
"..D..D.."
D=outline, H=hair, S=skin, J=jacket, B=jacket shadow, G=gun.
DOWN frame 1: identical except row 7 becomes "...DD..." (1px leg-swap read).
UP frames: same silhouette, row 2 all hair (no face pixels), gun pixel moved to row 5 col 1.
LEFT frame 0: narrower, gun on col 0 row 5, skin on cols 2-3 only. RIGHT is the horizontally mirrored BAKE (baked, never runtime-flipped).

ORBITAL: 4x4, a 2px-thick hollow square ring in '#f2f24a' with one '#ffffff' pixel top-left. One baked canvas, one drawImage per orbital, no rotation.

**Stats:** maxHp 5, hp starts 5. speed 62 px/sec (upgradeable to 94). Body hitbox circle r=2.6. iFrames 800ms. Knockback 9px over 120ms. BASE WEAPON: damage 10, fireCd 420ms, bulletSpeed 150 px/sec, pierce 0, projCount 1, unlimited range. Orbitals 0 at start; orbRadius 22px, 2.6 rad/sec, orbDmg 8, per-enemy re-hit cooldown 400ms. Life steal 0 at start.

### grunt (Baseline swarm enemy. Teaches the whole game in 2 seconds: it walks at you, you shoot it, it dies.)

**Comportamiento:** Pure homing. Each frame: `nx = px-ex, ny = py-ey`, normalize, `ex += nx*speed*dt`. No steering, no separation — clumping is a FEATURE, it makes pierce and explosive rounds feel enormous.

SPAWN: a random point on the playfield perimeter, offset 10px OUTSIDE the edge, then walks in. Edge chosen by rng.int(0,3); position uniform along it.

SPAWN TELL: for 350ms before the enemy exists, a 6x6 hollow warning square in '#e0249a' at alpha 0.5 pulses (100ms visible / 60ms hidden) at the spawn point, clamped to at least 3px inside the screen so it is always visible. This is the anti-cheap-death guarantee — nothing ever appears on top of her.

CONTACT: if dist(romina, grunt) < 2.6 + 2.4, deal 1 damage (subject to iFrames) and apply 14px knockback to the GRUNT away from Romina over 100ms, so she can body-shove out of a pile-up instead of freezing inside it.

DEATH: at hp <= 0, free from pool, emit 8 fire particles, spawn 1 XP shard, waveKillCount++, score += 10*waveNumber.

HIT REACTION: hitFlash 90ms (white variant), plus 3px knockback along the bullet's velocity over 60ms.

**Visual:** 6x6 sprite, 2 walk frames (swap every 160ms), 2 baked + 2 white-flash = 4 canvases.
Frame 0:
".DDD.."
".DEED."
"DEMMED"
"DEMMED"
".DMMD."
".D..D."
D='#07030f' outline, E=eye/core '#e0249a', M=body mid '#6a1f7a'.
Frame 1: bottom row becomes "..DD.." (leg swap).
The magenta eye pixels are the read — at 180px wide a 6px blob needs one high-chroma feature to register as 'enemy' instantly.

**Stats:** hp 20. speed 26 px/sec at wave 1 scaling to 44. Contact damage 1. Hitbox circle r=2.4. Spawn weight 100 from wave 1. XP value 1. Score 10 * waveNumber.

### runner (Fast, fragile pressure. Punishes standing still and forces the player to actually use the stick.)

**Comportamiento:** Homes like the grunt but with a DASH cycle so it reads as distinct rather than 'a faster grunt':
- WALK: homes at 40 px/sec for 900ms.
- WINDUP: 220ms, stops dead, swaps to the crouch frame, a 1px '#ffffff' pixel appears at two corners. Mandatory telegraph — an untelegraphed 130px/sec charge is a cheap death.
- DASH: 400ms, direction LOCKED at the end of windup, 130 px/sec straight line, does NOT re-home mid-dash, so a sidestep always beats it.
- Loops back to WALK.
If a dash carries it more than 12px outside the playfield, it clamps and returns to WALK immediately.

Contact, death, hit reaction as grunt; contact damage 1; the runner itself takes 20px knockback on contact (it is light).

**Visual:** 6x6, 3 baked frames (walk0, walk1, crouch) + 3 white-flash = 6 canvases.
Walk frame 0:
"..DD.."
".DYYD."
"DYRRYD"
".DRRD."
".D..D."
".D..D."
D='#07030f', Y='#f2f24a' (yellow — universal 'this one is fast'), R='#e0249a'.
Walk frame 1: legs swap to "..DD.." on row 5.
Crouch (windup): body compressed into rows 1-5, row 0 empty, plus two '#ffffff' corner pixels at (0,1) and (5,1) to sell the tell.

**Stats:** hp 12. Walk 40 px/sec, dash 130 px/sec. Cycle walk 900ms -> windup 220ms -> dash 400ms. Contact damage 1. Hitbox circle r=2.2. Introduced wave 3. Spawn weight 0 (w1-2), 45 (w3-6), 70 (w7+). XP value 1. Score 15 * waveNumber.

### tank (A wall that must be kited. The only real spatial puzzle in the game; makes damage upgrades feel earned.)

**Comportamiento:** Slow relentless homing at 18 px/sec, never stops, never dashes. Does not flinch — hitFlash plays but knockback is 0 (it is immovable, which is the point).

ARMOR: takes `max(1, dmg - 3)` from every hit. Rapid weak shots are bad against it, heavy shots good — this is what makes the damage-vs-fire-rate choice matter instead of being cosmetic.

SPLIT ON DEATH: spawns 2 grunts at (ex +/- 5, ey), each with hp 12 (not full 20) and a 250ms 'spawning' state during which they do not move and draw at 50% via a 3x3 shrunk baked variant. Killing a tank in a corner is therefore punished, and late waves stay dense without raising the spawn budget.

CONTACT: 2 damage. No self-knockback.

**Visual:** 10x10 sprite, 2 walk frames (swap every 260ms — deliberately lumbering) + 2 white-flash = 4 canvases.
Frame 0:
"..DDDDDD.."
".DAAAAAAD."
"DAAGGGGAAD"
"DAGGWWGGAD"
"DAGWWWWGAD"
"DAGGWWGGAD"
"DAAGGGGAAD"
".DAAAAAAD."
"..D....D.."
"..DD..DD.."
D='#07030f', A=armor plate '#3d1a5c', G=armor mid '#6a1f7a', W=hot core '#e0249a'.
Frame 1: bottom two rows swap to "..D....D.." / "..D....DD." for a heavy waddle.
The bright magenta core is the visual promise 'there is something inside this'.

**Stats:** hp 90. Speed 18 px/sec. Armor: incoming damage -3, floor 1. Contact damage 2. Hitbox circle r=4.2. Knockback immune. Introduced wave 5. Spawn weight 0 (w1-4), 20 (w5-9), 32 (w10+). Splits into 2 grunts at hp 12. XP value 4 (drops 2 shards worth 2 each). Score 60 * waveNumber.

### spitter (The only ranged threat. Stops the player parking in a corner and stalling out a wave.)

**Comportamiento:** APPROACH: homes at 22 px/sec until dist to Romina < 78px.
HOLD: within 78px it stops advancing and STRAFES perpendicular to the Romina vector at 20 px/sec, flipping direction every 1400ms. If dist < 46px it retreats along the Romina vector at 30 px/sec until dist >= 46. It hovers in a donut between 46 and 78px.
FIRE: while in HOLD, every 1600ms. Telegraph: 380ms before the shot the sprite swaps to the charge frame and a 2x2 '#1fd18a' blob appears at its mouth, growing 1px at 190ms. Then one spit is emitted.

SPIT PROJECTILE (own pool, cap 48): 3x3, 68 px/sec, straight line toward Romina's position AT THE MOMENT OF FIRING (no homing — always dodgeable by walking). Damage 1. Lifetime 4000ms. Dies on contact with Romina or on leaving the playfield by 8px. NOT destroyed by player bullets — keeps collision groups simple and avoids accidental full immunity from a wide multishot.

**Visual:** 8x8, 2 idle frames + 1 charge frame + 3 white-flash = 6 canvases.
Idle frame 0:
"..DDDD.."
".DGGGGD."
"DGCCCCGD"
"DGCNNCGD"
"DGCCCCGD"
".DGGGGD."
"..D..D.."
"..D..D.."
D='#07030f', G='#0f5c4a', C='#1fd18a', N='#07030f' (eye slit).
Idle frame 1: legs alternate.
Charge frame: the N eye pixels become '#ffffff' and a 2x2 '#1fd18a' block is baked at rows 6-7, cols 3-4.
SPIT: 3x3 baked — center '#ffffff', 4 orthogonal neighbors '#1fd18a', corners transparent. Reads as a glob, not a bullet.

**Stats:** hp 30. Approach 22 px/sec, strafe 20, retreat 30. Hold ring 46-78px. Fire interval 1600ms, telegraph 380ms. Spit 3x3, 68 px/sec, damage 1, lifetime 4000ms. Contact damage 1 (r=3.0). Introduced wave 7. Spawn weight 0 (w1-6), 30 (w7-11), 42 (w12+). XP value 2. Score 40 * waveNumber.

### swarmling (Late-game density. Individually trivial, collectively a wall of bodies that makes explosive/pierce builds sing.)

**Comportamiento:** Homes at 34 px/sec with a SINE WEAVE: the movement vector is rotated by `sin(t*5.0 + phase) * 0.55 radians`, phase set per-entity at spawn from rng.float()*TAU. The weave fans a group into a shifting cloud instead of a single-file line — visually the most 'alive' thing on screen.

Spawns exclusively in CLUSTERS: one spawn-budget entry spawns 5 of them at the same edge point, spread over a 14px arc, with staggered 60ms spawn delays so they trickle in.

Dies to anything (hp 6, one base shot). Contact damage 1.

**Visual:** 4x4, 2 frames + 2 white-flash = 4 canvases.
Frame 0:
".DD."
"DWWD"
"DWWD"
".DD."
D='#07030f', W='#59c2e8'.
Frame 1: the two center pixels become '#ffffff' — a 1-frame twinkle at 100ms cadence. At 4x4 the twinkle is what makes a cloud of 20 read as swarming rather than as static dots.

**Stats:** hp 6. Speed 34 px/sec, weave amplitude 0.55 rad at 5.0 rad/sec. Contact damage 1. Hitbox circle r=1.8. Introduced wave 9. Spawn weight 0 (w1-8), 55 (w9+) — each budget entry spawns a cluster of 5. XP value 1 (only 1 in 3 drops a shard, capping pickup spam). Score 8 * waveNumber.

### bullet (Player projectile. Auto-fired, never aimed by the player.)

**Comportamiento:** Straight line at bulletSpeed along its spawn angle: `x += vx*dt; y += vy*dt`. No gravity, homing or drag.

COLLISION: circle r=1.6 vs enemy circle, via the spatial hash (cell 32) over the enemy pool. MANDATORY per research: every hash callback guards `if (idx >= enemies.n) return;` and `if (!enemies.items[idx].alive) return;`.

PIERCE: on hit, apply damage, push the enemy's id into the bullet's `hitList` (a fixed Int32Array(6) on the pooled object with a `hitCount` — zero allocation), decrement `pierceLeft`. If pierceLeft < 0, free the bullet. A bullet never hits the same enemy twice (checked against hitList). hitList caps at 6; a bullet with more pierce than 6 simply stops tracking and is freed at 6 hits — a hard, invisible ceiling preventing unbounded scans.

EXPLOSIVE: if explosiveRadius > 0, every hit (including pierce-through hits) deals `explosiveDmg` to every live enemy within explosiveRadius of the impact point (single hash query, same guards), emits 10 fire particles, adds 1.6 shake. Explosions do NOT chain — a hard rule preventing a frame-time cliff in dense waves.

LIFETIME: 2200ms, or freed on leaving the playfield by 8px.

**Visual:** 3x3 baked canvas: center + 4 orthogonal in '#4de0f0', center pixel overwritten '#ffffff'. One canvas, one drawImage per bullet.
A 'fake glow' 5x5 variant is used for the first 60ms of life only: the 3x3 core plus a 1px border ring in '#1d47a0' — a larger dimmer square behind the bright square, never shadowBlur.
TRAIL: every other frame a bullet emits 1 particle at its position, velocity 0, ttl 0.14s, RAMP_COOL.

**Stats:** Pool cap 192. Speed 150 px/sec base (upgradeable to 210). Damage = player damage stat. Radius 1.6. Lifetime 2200ms. Pierce 0 base. hitList capacity 6 (hard ceiling).

### xpshard (The reward pulse. Not a currency to manage — a satisfying magnet-and-collect that fills the wave bar.)

**Comportamiento:** Spawns at the death position with an outward velocity: angle rng.float()*TAU, speed rng.range(30,60) px/sec, drag 0.90 per 1/60s tick, so it flings out and settles in ~350ms.

MAGNET: once dist to Romina < magnetRadius (40px base) it accelerates toward her at 340 px/sec^2 with no speed cap and ignores drag. This produces the signature 'suck' — a slow drift becoming a snap.

COLLECT: at dist < 5px, free, add xpValue to waveXp, play the coin SFX at a rising pitch, emit 3 cool particles.

AUTO-COLLECT: any shard still alive at wave clear is instantly vacuumed — magnet forced on regardless of distance, collected over the 400ms pre-card pause. Nothing is ever wasted, so the player never feels punished for not chasing pickups.

LIFETIME: 12000ms, blinking at 4Hz for the last 2000ms, then freed. Auto-collect means this almost never fires.

**Visual:** 4x4 baked diamond, 3 color variants by value:
".G.."
"GWG."
".G.."
"...."
Value 1 G='#1fd18a'; value 2 G='#4de0f0'; value 4 G='#f2f24a'. W='#ffffff'.
BOB: y offset = Math.round(sin(t*4 + phase)*1) — a 1px vertical bob at 4 rad/sec. One pixel is enough at this resolution and costs nothing.

**Stats:** Pool cap 96. Fling 30-60 px/sec, drag 0.90/tick. Magnet radius 40px (upgradeable to 88). Magnet accel 340 px/sec^2. Collect radius 5px. Lifetime 12000ms. Values: 1 (grunt/runner/swarmling), 2 (spitter, and each of a tank's 2 shards).

### healdrop (The mercy valve. Prevents an unrecoverable death spiral without making the game easy.)

**Comportamiento:** Never drops from enemies. Guaranteed spawn at the START of a wave, at playfield center (90, 214), ONLY if `hp <= 2` AND `wavesSinceLastHeal >= 2`. Sits still, bobbing 1px at 3 rad/sec, alternating normal/white sprite every 200ms.

Collect at dist < 6px: hp = min(hp+2, maxHp), emit 14 green-ramp particles, screen flash '#1fd18a' at 0.22 for 3 frames, play the heal arpeggio, wavesSinceLastHeal = 0.

Despawns at the end of the wave if uncollected — it does not carry over; she has a whole wave to walk to the middle of the screen.

**Visual:** 7x7 baked + 1 white variant. A chunky pixel heart:
".DD.DD."
"DHHDHHD"
"DHWHHHD"
"DHHHHHD"
".DHHHD."
"..DHD.."
"...D..."
D='#07030f', H='#1fd18a' (green, NOT red — red is the enemy/danger channel in this palette and must never mean 'good'), W='#ffffff' highlight.

**Stats:** Pool cap 4. Spawn condition: wave start AND hp <= 2 AND wavesSinceLastHeal >= 2. Heals 2. Collect radius 6px. Despawns at wave end. Position (90, 214).

### warningmark (Spawn telegraph. A lightweight timer object guaranteeing no enemy ever appears on top of the player.)

**Comportamiento:** Created 350ms before its enemy. Holds (x, y, enemyType, timer). Blinks 100ms visible / 60ms hidden. On expiry it frees itself and spawns the real enemy at that exact position. Drawn AFTER the background but BEFORE enemies so an already-present enemy overlaps it correctly.

**Visual:** Three baked sizes matching the incoming enemy: 6x6, 8x8, 10x10, each a 1px hollow square ring in '#e0249a' with a '#ffffff' pixel at each of the 4 corners. One drawImage.

**Stats:** Pool cap 32. Lead time 350ms. Blink 100ms on / 60ms off. Position clamped to at least 3px inside the visible playfield.

## Power-ups

- **damage** — damage += 6 (base 10). Rank 2 +6, rank 3 +7, rank 4+ +8 each. No cap. Multiplies everything including explosive damage (explosiveDmg = floor(damage * 0.6)). _(dur: Permanent for the run.)_ — Card icon 20x20: a chunky upward chevron in '#e0249a' with a '#ffffff' 2px tip, over a '#25123f' plate. Label 'POWER'. Value '+6 DMG' in the 5x7 font at scale 1.
- **firerate** — fireCd *= 0.86 (420 -> 361 -> 311 -> 267...). HARD FLOOR 110ms — below that the bullet pool drains and the audio voice cap chokes. At the floor this card is removed from the draw pool. _(dur: Permanent for the run.)_ — Card icon 20x20: three horizontal '#4de0f0' dashes of decreasing length stacked vertically (a motion-line glyph), with a 2x2 '#ffffff' muzzle block at the left. Label 'RAPID'. Value '-14% CD'.
- **pierce** — pierce += 1 (base 0). Each bullet passes through one more enemy. Max rank 5 (hitList capacity 6); at rank 5 removed from the pool. _(dur: Permanent for the run.)_ — Card icon 20x20: a horizontal '#ffffff' bullet line passing through two '#6a1f7a' enemy blocks, each with a '#e0249a' cracked pixel. Label 'PIERCE'. Value '+1 THRU'.
- **orbital** — orbitalCount += 1 (max 4). If already at 4 the card becomes 'ORBIT+': orbDmg += 5 and angular speed += 0.5 rad/sec, max 2 extra ranks, then removed. _(dur: Permanent for the run.)_ — Card icon 20x20: a small '#2a8ce0' player block at center with two '#f2f24a' 3x3 squares at opposite corners of a hollow '#3d1a5c' ring. Label 'ORBIT'. Value '+1 BALL'.
- **lifesteal** — lifeSteal += 0.055 per kill (fractional, accumulated in stealPool). Rank 1 ~1 hp per 19 kills. Rank 2 +0.05, rank 3+ +0.045 each. Max rank 5 (0.245/kill = 1 hp per ~4 kills), which at wave-15 densities is roughly full sustain and is intentionally the strongest late card. _(dur: Permanent for the run.)_ — Card icon 20x20: a 7x7 green heart (reuse the healdrop sprite) with three '#ffffff' 1px droplets arcing into it from the right. Label 'DRAIN'. Value '+HP/KILL'.
- **explosive** — Rank 1: explosiveRadius 14px, explosiveDmg = floor(damage*0.6). Rank 2: radius 18. Rank 3: radius 22. Rank 4: radius 26 and the multiplier 0.6 -> 0.8. Max rank 4. Explosions never chain. _(dur: Permanent for the run.)_ — Card icon 20x20: a jagged 4-point starburst in concentric rings — '#ffffff' center 2x2, '#f2f24a' ring, '#e0249a' outer spikes. Label 'BOOM'. Value '+RADIUS'.
- **multishot** — projCount += 1 (base 1, max 4). Bullets fan across 14deg * (projCount-1). Scales sub-linearly against single targets (the fan spreads) but enormously against crowds — the card that pairs with pierce. _(dur: Permanent for the run.)_ — Card icon 20x20: three '#4de0f0' 3x3 bullet glyphs fanning out from a single '#ffffff' point at the bottom. Label 'SPREAD'. Value '+1 SHOT'.
- **speed** — moveSpeed += 8 px/sec (base 62). Max rank 4 (94 px/sec) — above that she outruns the fixed playfield and waves become trivially kiteable. _(dur: Permanent for the run.)_ — Card icon 20x20: a '#2a8ce0' boot silhouette with three trailing '#4de0f0' speed-lines. Label 'BOOTS'. Value '+8 SPD'.
- **magnet** — magnetRadius += 16px (base 40, max 88 at rank 3). The FIRST rank also grants +1 max hp — this makes an otherwise-boring utility card competitive so the draw pool stays wide. _(dur: Permanent for the run.)_ — Card icon 20x20: a '#f2f24a' horseshoe magnet (7x7) with two '#1fd18a' shard diamonds being pulled in. Label 'MAGNET'. Value '+RANGE'.
- **vitality** — maxHp += 1 AND hp += 1 (immediate heal). Base maxHp 5, max rank 5 (maxHp 10). The always-safe pick, deliberately never the most exciting one. _(dur: Permanent for the run.)_ — Card icon 20x20: two overlapping green hearts, the front solid '#1fd18a' with a '#ffffff' highlight, the back outlined only in '#0f5c4a'. Label 'VITAL'. Value '+1 MAX HP'.

## Progresion

Run target: 6-7 minutes to death for an average player, ~14-18 waves. Every number below is a literal formula an implementer types in.

WAVE STRUCTURE (wave number W, 1-indexed):
- SPAWN BUDGET: `budget(W) = 3 + floor(W*1.9) + floor(W*W/14)`. W1=4, W2=6, W3=9, W4=11, W5=14, W6=17, W7=20, W8=23, W9=27, W10=31, W11=35, W12=40, W13=45, W14=50, W15=56, W16=62, W18=76, W20=91. Hard cap 96 (~W21). This is a total-spawned count, not a concurrent count.
- SPAWN PACING: budget spent over a window of `min(9000, 3200 + W*380)` ms. Interval = window / budget. W1 spawns 4 over 3580ms (895ms apart, very readable); W15 spawns 56 over 9000ms (161ms apart, a torrent). Intervals jittered +/-25% via rng so it never feels metronomic.
- CONCURRENT CAP: if enemies.n >= 52 the spawner stalls (holds the budget) until it drops. This is the frame-time guarantee — pool cap is 64, leaving 12 slots of headroom for tank splits.
- WAVE CLEAR: budget exhausted AND enemies.n == 0. Then: 400ms vacuum pause (bullets freeze, shards fly in, rising arpeggio) -> cards slide in over 180ms -> tap -> cards slide out over 120ms -> 400ms beat with the wave number pulsing large in the center -> next wave.

ENEMY MIX (weighted pick per spawn event):
- W1-2: grunt 100.
- W3-4: grunt 100, runner 45.
- W5-6: grunt 100, runner 45, tank 20.
- W7-8: grunt 100, runner 45, tank 20, spitter 30.
- W9-11: grunt 100, runner 70, tank 20, spitter 30, swarmling 55 (cluster of 5).
- W12+: grunt 90, runner 70, tank 32, spitter 42, swarmling 55.
One rule overrides the weights: waves 5, 10, 15, 20 spawn ONE guaranteed tank first, before the weighted budget is spent. This gives the run a felt rhythm without any 'BOSS' text.

ENEMY STAT SCALING (applied at spawn from the wave number):
- hp multiplier `1 + (W-1)*0.13`, capped 3.2 (reached W18). W1 x1.00, W5 x1.52, W10 x2.17, W15 x2.82.
- speed multiplier `1 + (W-1)*0.026`, capped 1.65 (reached W26). W1 x1.00, W5 x1.10, W10 x1.23, W15 x1.36. Deliberately much flatter than hp — enemies getting FASTER is what makes a top-down survival game feel unfair; enemies getting TOUGHER is what makes upgrades feel necessary.
- Contact damage NEVER scales. A grunt always does 1. This is the promise that keeps the game readable: 5 hp always means 5 mistakes.

THE POWER CURVE, EXPLICITLY:
Base DPS = 10 dmg / 0.42s = 23.8. A W1 grunt (20 hp) dies in 2 shots = 840ms. After 5 upgrades a typical build is ~2.6x base DPS (~62) against a W6 grunt at 32 hp — still ~2 shots. After 12 upgrades ~7x base (~165 dps) against a W13 grunt at 51 hp — 1-2 shots, but there are 45 of them. Tuned so player power grows slightly FASTER than enemy hp for the first 8 waves (the honeymoon), reaches parity around wave 10-12, and falls behind after wave 15. Death is an eventuality, not a failure — which is exactly what makes a 6-minute run repeatable.

DIFFICULTY FLOOR: waves 1-2 cannot kill her. W1 is 4 grunts at 26 px/sec against her 62 px/sec — she outruns them trivially. This is the 'understand it in 2 seconds' window: she watches her gun kill something without touching anything, then moves.

## Puntaje

SCORE SOURCES:
- Enemy kill: base points * waveNumber. Grunt 10, runner 15, swarmling 8, spitter 40, tank 60. A wave-12 tank is 720 points — late waves are worth exponentially more, which is what makes 'survive one more wave' the only strategy that matters.
- Wave clear bonus: `250 * W`. Cumulative through wave 15 that is ~30,000 — roughly 45% of a good run's total, so clearing waves dominates over farming.
- No-hit wave bonus: `+400 * W` if the wave was cleared without Romina taking a single point of damage. A HUD line 'CLEAN +N' flashes for 900ms during the vacuum pause. This is the only skill-expression scoring in the game and is entirely optional to understand.
- XP shards give NO score. They only fill the wave bar. Keeping score and progression on separate channels means the player never has to choose between them.

TYPICAL SCORES: a first-ever run dying at wave 6 scores ~4,500. A competent run to wave 12 scores ~34,000. A great run to wave 18 scores ~115,000. Score displays as a plain integer, no commas (the 5x7 font has no comma glyph in the HUD width budget).

HIGH SCORE: exactly one integer persisted via the shared Save layer under game id 'lastwave'. The game never writes it — the run ends via ctx.gameOver(score), the shared layer calls Save.submit('lastwave', score) which returns true on a new best, and that boolean drives the celebration. Score floored and NaN-guarded at the boundary.

HUD (top 34px strip, drawn into the canvas never DOM, all strings cached and rebuilt only when the underlying integer changes):
- Row 1 (y=3): 'ROMINA' at font scale 1 in '#ff5cc8' at x=6. Score right-aligned at x=158 at scale 1 in '#ffffff' (x=158 always, so it never collides with the mute icon). If the live score has passed the stored best, a 'BEST!' badge in '#f2f24a' fades in at x=118, y=3.
- Row 2 (y=13): hearts — one 5x5 baked heart per hp point at x = 6 + i*7 in '#e0249a'; empty slots draw the '#3d1a5c' outline-only variant. At maxHp 10 this spans 6..75, comfortably inside the strip.
- Row 2 right: 'W' + waveNumber at scale 1 in '#4de0f0', right-aligned at x=174.
- Row 3 (y=24, height 4): the wave progress bar, x=6..174, 1px '#3d1a5c' border, fill = (budgetSpent - enemiesAlive) / budgetTotal in '#4de0f0' (shifting to '#f2f24a'/'#e0249a' with kill-streak heat). This bar IS the tutorial — the player learns 'empty the bar, get a card' without a single word.
- Mute speaker 12x12 at (162, 4), hit area 24x24 padded.

## Juice

- SCREEN SHAKE (integer-only, applied in engine.begin after the base transform, decaying as shake *= pow(0.0015, dt)): bullet hits enemy +0.5; enemy death +1.2; tank death +3.5; explosive detonation +1.6; Romina takes damage +4.5; heal pickup +1.0; wave clear +2.0. Global clamp 6.0. Offset = Math.round((rng.float()-0.5)*2*shake) on both axes so the pixel grid is never broken.
- HITSTOP: 3 frames (50ms) of full simulation freeze when Romina takes damage — update() returns immediately but render() still runs, so the white-flash frame is held on screen. 2 frames (33ms) on a tank death. NO hitstop on regular enemy deaths (at 20+ kills/sec it would read as lag). Implemented as a `freezeFrames` counter decremented in update; particles and shake keep ticking during it so the world does not look dead.
- HIT FLASH: every enemy draws its pre-baked white-silhouette variant for 90ms after taking damage (5-6 frames) — a branch, not a composite: `drawImage(e.hitT > 0 ? spr.white : spr.normal, ...)`. Romina flashes white 4 frames on / 4 off for the full 800ms of iFrames.
- SCREEN FLASH: one full-screen fillRect at decaying alpha over 3 frames. Romina damaged '#e0249a' 0.30 -> 0.20 -> 0.10. Heal pickup '#1fd18a' 0.22 -> 0.14 -> 0.07. Wave clear '#ffffff' 0.18 -> 0.09 -> 0.04. Never more than one flash rect per frame — they overwrite, they do not stack.
- PARTICLES (shared 400-cap SoA pool, colour-ramped never alpha-faded, sizes stepping 3->2->1 px, positions snapped to the pixel grid): enemy death 8 particles, 55-110 px/sec radial, ttl 0.18-0.40s, RAMP_FIRE ['#ffffff','#f2f24a','#e0249a','#3d1a5c']. Tank death 26 particles, 70-160 px/sec, ttl 0.30-0.60s. Explosive detonation 10 particles, 90-180 px/sec, ttl 0.15-0.30s. Bullet trail 1 particle every 2nd frame, velocity 0, ttl 0.14s, RAMP_COOL ['#ffffff','#4de0f0','#2a8ce0','#1d47a0']. XP collect 3 particles, ttl 0.16s, RAMP_COOL. Romina hurt 12 particles, radial 60-120 px/sec, RAMP_FIRE. Heal 14 particles rising (vy -40 to -90), ttl 0.5s, ramp ['#ffffff','#1fd18a','#0f5c4a','#07030f'].
- NO DAMAGE NUMBERS ANYWHERE — they clutter a 180px-wide screen and mean nothing to a casual player. Instead every enemy death draws a 1-frame 3x3 white square at the death point (a 'pop'), and the HUD kill/score readout jitters +/-1px for 2 frames.
- KILL-STREAK HEAT: an internal `heat` value += 1 per kill, decaying 6/sec. At heat >= 12 the HUD wave-progress bar shifts from '#4de0f0' to '#f2f24a'; at heat >= 24 to '#e0249a' with a 1px white flicker on alternating frames. Purely visual, no mechanical effect — a dense wave gains a rising visual temperature for free.
- XP MAGNET SNAP: when a shard crosses the magnet threshold it emits a single 1-frame 2x2 white pixel at its position. With 20 shards on screen this makes a popcorn of sparks as she walks through a kill field.
- WAVE-CLEAR SEQUENCE (400ms, then cards): frame 0 — white flash 0.18, shake +2.0, all bullets STOP (velocities zeroed; they hang in the air and fade over the 400ms), enemies all gone. Frames 1-24 — remaining shards fly in on forced magnet, each collect adding a rising pitch. Frame 24 — the wave number drawn at font scale 4 in the center, scaling 0.6x -> 1.0x over 8 frames with a 2-frame overshoot to 1.15x, then holding until the cards arrive.
- CARD PRESENTATION: background dims to 45% via ONE fillRect '#07030f' at alpha 0.45 (never a blur). The 3 cards slide from y+40 to rest over 180ms with an ease-out (t^0.5), staggered 40ms apart so they cascade. Each card has a 1px '#3d1a5c' border and a 1px '#4de0f0' top-edge highlight. On tap: the chosen card flashes white for 2 frames, scales to 1.06x for 3 frames, and all three slide out over 120ms under the confirm arpeggio.
- GAME OVER: 6 frames of hitstop, screen flash '#e0249a' 0.5 -> 0, shake 6.0, 30 particles from Romina, her sprite swapped for a 'shattered' baked variant (the same 8x8 with 40% of pixels removed in a fixed pattern), then a 250ms palette-step fade (6 discrete steps) to the results screen. Death to tappable retry: 550ms — well under the 1.5s requirement.
- NEW RECORD CELEBRATION (never interrupts action): the record check happens on the game-over screen ONLY, never mid-run. If isRecord: 'NEW RECORD' pulses at font scale 2 (multiplier 1 + sin(t*8)*0.12) under the score, a 48-particle confetti burst fires in '#f2f24a'/'#e0249a'/'#4de0f0', a rising 5-note arpeggio plays, and a second line reads 'BIEN HECHO ROMINA' at scale 1 in '#f2f24a', fading in over 200ms after the score line lands. DURING a run, if the live score crosses the stored best, a small 'BEST!' badge (scale 1, '#f2f24a') fades in at the top-right of the HUD over 300ms and simply stays there — no popup, no pause, no sound cue competing with combat. That is the entire in-run acknowledgement.
- CRT SCANLINES: one cached createPattern fillRect over the whole 180x400 buffer, 'rgba(0,0,0,0.14)' on every second row — ONE rect per frame. Gated behind a quality flag: if the rolling 30-frame average frame time exceeds 15.0ms for 60 consecutive frames, scanlines are disabled permanently for the session and never re-enabled (no flickering on/off).

## Audio

- MASTER GRAPH: master GainNode (0.9, or 0 when muted, always via setTargetAtTime tau 0.02) -> DynamicsCompressor (threshold -10, knee 6, ratio 12, attack 0.003, release 0.12) -> destination. Two buses into master: sfxBus 0.85, musicBus 0.40. AudioContext created lazily inside the first pointerdown, resumed on every input and on visibilitychange. Voice cap 24, hard-dropped never queued, with `voices--` in src.onended alongside src.disconnect() and g.disconnect(). Three cached PeriodicWaves at duty 0.125 / 0.25 / 0.5, coefficients in real[] (cosine) as real[n] = (2/(n*PI))*sin(n*PI*duty), 32 harmonics. One shared 1-second 15-bit-LFSR noise buffer generated at init, varied only by playbackRate and BiquadFilter.
- SHOT (up to 9x/sec at max fire rate — must be tiny and non-fatiguing): pulse duty 0.125, f0 1250 Hz sweeping exponentially to 620 Hz, dur 0.055s, atk 0.002s, vol 0.16. RATE LIMIT: if the last shot sound played under 55ms ago, skip it entirely — at 9 shots/sec this drops roughly every other shot, reading as a machine-gun texture rather than a buzz. Every 4th played shot uses f0 1250 -> 560 at vol 0.19 for a subtle rhythmic accent.
- ENEMY HIT (non-fatal): noise, playbackRate 2.1 -> 1.4 exponential, bandpass Q 5, f0 2900 -> 1900 Hz, dur 0.045s, vol 0.22. A dry tick. Rate-limited to one per 30ms globally.
- ENEMY DEATH (grunt/runner/swarmling): noise, playbackRate 1.5 -> 0.42, lowpass f0 2100 -> 260 Hz, dur 0.20s, vol 0.34; layered with pulse duty 0.5, f0 340 -> 120 Hz, dur 0.09s, vol 0.14 for body. Rate-limited to 6 per 100ms — beyond that deaths are silent, which stops a 20-kill explosion becoming white noise.
- TANK DEATH: noise, playbackRate 1.1 -> 0.20, lowpass f0 1600 -> 90 Hz, dur 0.55s, vol 0.55; plus triangle f0 180 -> 62 Hz over 0.4s at vol 0.30. Never rate-limited — tanks are rare and this is the payoff.
- EXPLOSIVE ROUND DETONATION: noise, playbackRate 1.8 -> 0.6, highpass f0 900 Hz fixed, Q 1, dur 0.13s, vol 0.26. Higher and shorter than a death so it layers on top without muddying. Rate-limited to one per 60ms.
- SPITTER CHARGE (the 380ms telegraph): pulse duty 0.25, f0 220 Hz sweeping LINEARLY to 560 Hz over 0.38s, vol 0.20, lowpass 1400 Hz. A rising whine mapping 1:1 to the visual tell. SPIT FIRE: pulse duty 0.25, f0 600 -> 300, dur 0.10s, vol 0.22.
- ROMINA HURT: pulse duty 0.125, f0 420 -> 85 Hz exponential, dur 0.30s, vol 0.50, atk 0.001s; layered with noise playbackRate 0.9, lowpass 700 Hz, dur 0.18s, vol 0.30. The loudest sound after game-over, and it is never rate-limited or dropped by the voice cap — it bypasses the cap check via a reserved voice slot.
- XP COLLECT: pulse duty 0.5, dur 0.045s, vol 0.13, with a PITCH LADDER — f0 = 784 * 2^(min(comboIdx,11)/12), comboIdx incrementing per collect and resetting to 0 after 900ms with no collect. Walking through a shard field plays a rising chromatic run that resets — the most satisfying sound in the game, and it costs nothing. Rate-limited to one per 40ms.
- HEAL PICKUP: 4-note arpeggio, pulse duty 0.25, vol 0.28 each, dur 0.08s: 523 Hz at +0, 659 at +0.07, 784 at +0.14, 1047 at +0.21 (dur 0.24s on the last). Absolute scheduled times, never setTimeout.
- WAVE CLEAR: 4 ascending notes, pulse duty 0.5, dur 0.07s, vol 0.30: 659, 784, 988, 1319 Hz at offsets 0 / 0.06 / 0.12 / 0.18 (last note dur 0.26s). Fires at the instant of clear, landing under the vacuum sequence.
- UPGRADE CONFIRM: two-note stab, pulse duty 0.25 — 880 Hz dur 0.06 vol 0.30, then 1319 Hz dur 0.20 vol 0.32 at +0.06s; plus one noise tick (playbackRate 2.4, bandpass 3200 Hz, dur 0.03, vol 0.18) at +0 for attack.
- CARD APPEAR: three staggered blips as the cards slide in — pulse duty 0.5, f0 660 / 740 / 830 Hz, dur 0.04s, vol 0.16, at offsets 0 / 0.04 / 0.08.
- GAME OVER: descending triangle sequence — 392 Hz dur 0.18, 330 at +0.18, 262 at +0.36, 196 at +0.54 dur 0.60 — all vol 0.50, plus one noise hit at +0 (playbackRate 0.7, lowpass 500 Hz, dur 0.6s, vol 0.40). Music stops immediately when this fires.
- NEW RECORD FANFARE: fires only on the game-over screen after the game-over sequence has finished (t > 0.9s), so it never collides. Pulse duty 0.25, vol 0.34: 523 / 659 / 784 / 1047 / 1319 Hz at offsets 0 / 0.07 / 0.14 / 0.21 / 0.28, the last dur 0.45s; layered with a duty 0.5 harmony a fifth below on notes 1, 3 and 5 at vol 0.18.
- MUSIC — a 3-channel loop driven by the lookahead scheduler (setTimeout 25ms, AHEAD 0.15s, accumulator `next += stepDur`, absolute times passed to play()). Base bpm 138, div 4 (sixteenths, stepDur 0.1087s), 16 steps = a 1.739s bar. LEAD: pulse duty 0.5, vol 0.22, gate 0.85, pattern ['A4','.','E5','.','A4','.','C5','.','G4','.','D5','.','G4','.','B4','.']. BASS: pulse duty 0.125, vol 0.20, gate 0.5, pattern ['A2','A2','.','A2','.','A2','A2','.','F2','F2','.','F2','.','F2','F2','.']. DRUMS: noise, vol 0.20, pattern ['L','.','H','.','L','.','H','H','L','.','H','.','L','H','H','.'] where L = playbackRate 1.0, lowpass 900 -> 200 Hz, dur 0.11s and H = playbackRate 2.2, highpass 5000 Hz, dur 0.05s.
- MUSIC ESCALATION (the whole 'pressure is rising' feeling, and it is free): bpm = 138 + min(28, (W-1)*2.4) — W1 138, W6 150, W12 164, capped 166 at W13+. At wave 8 a fourth track unmutes: arpeggio, pulse duty 0.25, vol 0.14, pattern ['A5','C6','E6','C6','A5','C6','E6','C6','G5','B5','D6','B5','G5','B5','D6','B5']. At wave 13 the bass gate goes 0.5 -> 0.8 (longer, more menacing notes) and the drum L hits double up (steps 4 and 12 add an L). Music DUCKS to musicBus 0.18 for 400ms (setTargetAtTime tau 0.08) whenever Romina takes damage, then returns to 0.40 — so a hit is heard even in a dense wave. Music STOPS entirely during the upgrade-card screen (the room goes quiet, the choice feels weighty) and restarts on the new wave, which also naturally resyncs the loop.
- HAPTICS (bonus only, never load-bearing; every call in try/catch, feature-detected, 80ms global gate, toggle defaults ON): enemy hit — none (far too frequent). Romina hurt — 14ms. Heal or upgrade pick — 25ms. Wave clear — 18ms. Game over — [40,60,120]. navigator.vibrate(0) on visibilitychange to hidden.
