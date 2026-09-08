# NEON FIST

> Romina alone in a neon cage: every punch feeds a combo that starts dying the instant you stop swinging, so the only way to survive is to keep hitting.

**Loop:** Read the ring of closing enemies, pick the one about to reach you, dash THROUGH it (i-frames + the dash itself deals 1 damage, so the dodge is also an attack), land 1-3 punches on whatever the dash put you next to, then immediately dash to the next cluster before the combo timer expires. The loop is 5-8 seconds: threat closes in -> dash through the gap -> punch chain -> reposition. The combo timer (1900ms at combo 0, tightening to a 1100ms floor) is the metronome — it forces a hit roughly every second, which means the player is never allowed to retreat and turtle. Killing an enemy refunds combo time, so aggression literally buys survival room.

**Duracion de partida:** 60-100 seconds for an average player. First-ever run is typically 30-45s (dies to the first charger wave). A strong run pushes 2:30. Death-to-next-run is 1.2s: game-over holds for 700ms of unskippable readout, then any tap restarts instantly — no menu round-trip.

**Muerte:** Romina has 3 HP, shown as 3 fist icons top-left. Contact with any enemy body, bullet, charger lunge, or exploder blast costs 1 HP and grants 900ms of invulnerability (player sprite alternates normal/white every 4 frames = 66ms). At 0 HP: hitstop 220ms, screen flashes white then cuts to a 4x-scale slow-mo of the killing blow for 400ms, arena desaturates to the two darkest palette entries, and the game-over readout draws in place over the frozen arena — no scene wipe, no fade to black. Readout shows ROMINA / SCORE nnnn / BEST nnnn / TOP COMBO nn and 'TAP'. Input is ignored for the first 700ms (so a panic-tap during death cannot skip the score), then any tap anywhere restarts a fresh run in the same scene — total 1.2s from death to playing. There is no confirm, no menu, no continue.

## Controles

Virtual grid is 180x400 (exact 20:9, zero letterbox on the 1080x2400 panel; 1 virtual px = 2.182 CSS px). Screen splits into three fixed bands: HUD strip y=0..26, ARENA y=30..260 (x=8..172, 164x230 play area), CONTROL BAND y=264..400.

FLOATING STICK (left): spawns at the exact pointerdown position anywhere in x<86, y>264. Never drawn until touched. maxRadius 30 virtual px (65 CSS px), dead zone 0.18 of max, magnitude rescaled as (n-dead)/(1-dead) so movement ramps from zero instead of snapping to 18% speed. When the thumb exceeds maxRadius the ORIGIN DRAGS along behind it (ox += dx*(1-maxr/d)) so the stick never feels stuck on a long swipe. Drawn as a stroked 8-bit square ring at the origin (alpha 0.30) plus a filled 7x7 knob at origin+dir*30. Claim id 1.

PUNCH BUTTON (right thumb, primary): center (141,330), visual radius 26 (=113 CSS px diameter), hit radius 34 (=148 CSS px). Drawn as a filled octagonal fist glyph. Edge-triggered on pointerdown (b.pressed), NOT held — but holding and re-pressing is fine because punch has a 260ms cycle. Claim id 2.

DASH BUTTON (right thumb, secondary): center (99,368), visual radius 19 (=83 CSS px diameter), hit radius 27 (=118 CSS px). Chevron glyph. Edge-triggered. Claim id 3. Dashes in the stick's current direction; if the stick is neutral, dashes in the direction Romina last faced.

MUTE: 12x12 speaker glyph at (166,8) in the HUD strip, hit radius 14. Claim id 4.

ARBITRATION: fixed per-frame order — mute, dash, punch, stick, then endFrame() clears all fresh flags. A control only ADOPTS a pointer whose claim is -1 AND whose fresh flag is set (edge-triggered adoption), so one thumb can never drive two controls, and a finger that started on empty canvas can never slide onto a button and fire it. Dash is checked before punch so the smaller target wins the 4.4px hit-area overlap. Pointers tracked in fixed Int32Array/Float32Array slots (MAXP=4) by pointerId, never a Map. setPointerCapture on down; pointercancel handled identically to pointerup.

_The 6.43in panel is 2.5x taller than it is wide, so a 140-virtual-px control band at the bottom (30cm of the 20:9 screen's lower third) sits entirely inside natural thumb reach while the arena stays above the hands — Romina never covers the action with her own fingers. The floating stick has no wrong place to touch, which matters for a casual player who will never read a tutorial and picks the phone up differently every time. Button diameters of 113 and 83 CSS px are far above the 44-48px Material/HIG/WCAG floor because these are hit under time pressure without looking; the 25 CSS px visual gap between them exceeds Material's 8px minimum. Every interactive element sits at least 28 CSS px inside both screen edges, clearing the ~24px MIUI back-gesture inset that cannot be blocked from JS — so the stick spawn zone can never be eaten mid-fight. It plays one-handed (right thumb on punch/dash, arena readable above) or two-thumb (left stick + right buttons) with no layout change._

## Paleta

`#07030f` `#140a26` `#25123f` `#3d1a5c` `#6a1f7a` `#a3218f` `#e0249a` `#ff5cc8` `#1d47a0` `#2a8ce0` `#4de0f0` `#f2f24a` `#ffcd75` `#d9dce6` `#ffffff` `#0f5c4a`

## Entidades

### romina (Player character)

**Comportamiento:** State machine: IDLE -> WALK -> PUNCH -> DASH -> HURT.

MOVEMENT: velocity = stick.dir * 52 px/sec, applied directly (no acceleration — 8-bit games snap). Clamped to arena bounds (x 8..172, y 30..260) minus half-hitbox. Facing is one of 4 cardinals, chosen by the dominant axis of stick input; facing only updates while moving or punching, so she keeps aim while standing still.

PUNCH: triggered by punch.pressed. Cycle = 70ms startup / 80ms active / 110ms recovery = 260ms total, max 3.85 punches/sec. During ACTIVE the hitbox is a 14x12 rect projected 13px from center in the facing direction (9px gap beyond her own 8px-wide body, so reach reads clearly). Deals 1 damage. Hits ALL enemies overlapping the box in one swing (crowd-clearing is the reward for good positioning). Punch cannot be cancelled by another punch, but CAN be cancelled into a dash after the active frames (so dash-cancel is a skill ceiling for free). Alternates left/right fist sprite each swing.

DASH: triggered by dash.pressed, cooldown 620ms from dash START. Speed 190 px/sec for 180ms = 34px travelled (0.21 of arena width). I-FRAMES cover the full 180ms plus 60ms of landing lag = 240ms total invulnerability. The dash body is itself a 10x10 damage box dealing 1 damage, one hit per enemy per dash (tracked with a per-dash hit flag on each enemy). Dash cannot be steered mid-dash. Cannot dash while in HURT.

HURT: on taking damage, 900ms invulnerability, knockback 40px/sec decaying over 200ms away from the damage source, and control is NOT locked (she can move/punch immediately — losing control after a hit feels punishing to a casual player).

HITBOX: 8x8 centered, but the DAMAGE-RECEIVING box is only 6x6 (generous to the player, invisible, standard arcade practice).

**Visual:** 12x14 sprite. Magenta bomber jacket (#e0249a) with a #ff5cc8 highlight on the lit shoulder, near-black outline (#07030f) on every edge, #140a26 shadow under the jaw and boots. Skin #ffcd75 (2x2 face block, single #07030f pixel row for eyes). Hair is a 4x3 block of #a3218f. Boots #25123f. Fists are 3x3 #4de0f0 cyan blocks that are the brightest thing on her sprite — cyan appears nowhere else on the player, so the eye locks onto where the damage comes from. 4 baked directional variants (up/down/left/right) x 2 walk frames (legs swap 2px) x 2 punch frames (lead fist extended 4px) = 16 baked canvases, plus 16 white-silhouette variants for the hit flash. Walk cycle advances every 8 frames (133ms). During i-frames the renderer alternates normal/white every 4 frames.

**Stats:** hp 3, speed 52 px/sec, hitbox 8x8, damage-taking box 6x6, punch damage 1, punch reach 13px, punch box 14x12, punch cycle 260ms (70/80/110), dash speed 190 px/sec, dash duration 180ms, dash distance 34px, dash damage 1, dash i-frames 240ms, dash cooldown 620ms, hurt i-frames 900ms, knockback 40px/sec over 200ms

### grunt (Basic pressure / combo fodder — teaches the game in the first 8 seconds)

**Comportamiento:** Walks in a straight line toward Romina's CURRENT position, recomputing direction every 500ms (so it visibly lurches rather than tracking perfectly — readable and dodgeable). Speed 26 px/sec, exactly half of Romina's, so she can always outrun one and the player learns immediately that movement is safe. No attack: it damages on body contact only. On spawn it walks in from 10px outside the arena border over ~0.5s, drawn at 50% alpha during entry so it never appears on top of the player. Dies in 1 punch or 1 dash.

**Visual:** 8x8. Dark violet body (#3d1a5c) with a #6a1f7a lit top edge, near-black outline (#07030f). Two 1x1 red eyes (#e0249a) that are the only saturated pixels — at 8x8 the eyes are the readable feature. Shambling 2-frame walk (whole sprite shifts 1px vertically every 10 frames). 4 directional variants + white flash variant.

**Stats:** hp 1, speed 26 px/sec, contact damage 1, hitbox 8x8, spawn weight 100 falling to 30 by t=88s, score 10 x combo multiplier, no attack cooldown

### charger (The dodge teacher — introduced alone at t=8s so the dash gets learned in isolation)

**Comportamiento:** Three-state machine. STALK: moves toward Romina at 34 px/sec. When within 70px AND with line-of-sight roughly aligned (within 35 degrees of a cardinal), enters TELEGRAPH. TELEGRAPH: freezes completely for 480ms, sprite flashes white every 6 frames, and a 3px-wide dotted lane line is drawn from its body to the arena edge in #f2f24a yellow showing exactly where it will travel — this is the entire readability contract, the player sees the attack before it happens. LUNGE: travels 150 px/sec for 450ms (68px) in a locked straight line, no tracking. Contact during lunge deals 1 damage. On hitting an arena wall it enters STUN for 900ms (sprite tilted, stars particle), during which it takes DOUBLE damage — punishing a dodged charge is the core skill expression. After stun, returns to STALK. If it completes a lunge without hitting a wall, 350ms recovery then STALK.

**Visual:** 10x10, bulkier than a grunt. Body #a3218f magenta-violet, horn/spike block of #ff5cc8 on the leading edge, #07030f outline, #25123f underside shadow. During TELEGRAPH the horn block swaps to #f2f24a yellow (same color as the lane line, so the cause and the warning are visually bound). During STUN the sprite is drawn with its 2-frame 'dizzy' variant plus 3 orbiting 2x2 #f2f24a particles. 4 directions x (stalk/telegraph/lunge/stun) = 16 baked + white variants.

**Stats:** hp 2, stalk speed 34 px/sec, lunge speed 150 px/sec, lunge duration 450ms, lunge distance 68px, telegraph 480ms, wall stun 900ms (takes 2x damage), post-lunge recovery 350ms, trigger range 70px, contact damage 1, hitbox 10x10, spawn weight ramps 0 -> 70 from t=8s at +3.0/sec, score 25 x combo multiplier

### ranged (Positional pressure — punishes standing still, forces the player to keep circling)

**Comportamiento:** Maintains distance: moves to hold a 75-95px range band from Romina. If closer than 75px it retreats at 30 px/sec; if further than 95px it approaches at 30 px/sec; inside the band it strafes perpendicular at 22 px/sec, reversing strafe direction every 1400ms. FIRES every 1800ms: 300ms wind-up (barrel block flashes #4de0f0 cyan, growing 1px per 100ms) then releases 1 bullet aimed at Romina's position at the moment of release (never leading the target — a casual player must be able to sidestep it by simply moving). Never fires during the first 400ms after spawning. Fragile: dies to 1 punch or 1 dash, so closing the gap is always the correct answer and the player learns that aggression solves the ranged threat.

**Visual:** 8x10, thin and upright. Body #1d47a0 deep blue with a #2a8ce0 lit edge — the ONLY blue-family enemy, so it is instantly separable from the magenta melee types at a glance. #07030f outline. A 3x2 barrel block in #4de0f0 points at the player (4 baked directions). Single 1x1 #f2f24a eye. During wind-up the barrel block brightens to #ffffff.

**Stats:** hp 1, move speed 30 px/sec, strafe speed 22 px/sec, preferred range 75-95px, strafe reverse every 1400ms, fire cooldown 1800ms, wind-up 300ms, first-shot delay 400ms, contact damage 1, hitbox 8x10, spawn weight ramps 0 -> 55 from t=20s at +2.6/sec, score 30 x combo multiplier

### bullet (Ranged enemy projectile)

**Comportamiento:** Travels in a straight line at 68 px/sec from the firing point in the direction of Romina's position at release. No homing, no gravity, no acceleration. Despawns on leaving the arena bounds or after 5000ms. Deals 1 damage on overlapping Romina's 6x6 damage box. Passes THROUGH other enemies (no friendly fire — friendly fire would let the player win by standing still, which contradicts the whole design). Destroyed by Romina's punch active frames (a well-timed punch swats bullets, worth 5 points and +1 combo — a hidden skill reward that never needs explaining). Not destroyed by dash (dash passes through it via i-frames instead). At 68 px/sec a bullet crosses only 12.2px during a 180ms dash, so a dash never carries the player INTO a bullet it just dodged.

**Visual:** 4x4 diamond. Core 2x2 #4de0f0 cyan, surrounded by a 1px #2a8ce0 dimmer ring to fake a glow without shadowBlur. Leaves a 1-frame trail: a 2x2 #1d47a0 square at the previous position, drawn before the bullet. No rotation (a 4x4 diamond reads identically at all angles).

**Stats:** speed 68 px/sec, damage 1, hitbox 4x4, lifetime 5000ms, destroyed by punch (+5 score, +1 combo), pool capacity 48

### shielded (The positioning puzzle — cannot be solved by mashing, must be flanked)

**Comportamiento:** Advances slowly and relentlessly at 20 px/sec, always directly toward Romina, recomputing every 250ms (it tracks well — it is meant to be a moving wall, not a dodge test). Carries a shield on its FACING side. Facing updates to point at Romina but only rotates at 90 degrees per 400ms, so it cannot instantly re-face a player who flanks it. Damage from the shielded 180-degree arc is fully negated: the hit produces a 'clank' — 3 white sparks, 60ms hitstop, no damage, NO combo increment and NO combo timer refund (so mashing a shield actively loses the run). Damage from the rear 180-degree arc lands normally. Dash-through from the front is also blocked, but dashing PAST it puts the player behind it, which is the intended solution and needs no explanation — the player discovers it in one attempt. On taking rear damage it is knocked back 12px and staggers 250ms.

**Visual:** 10x12. Body #6a1f7a. The shield is a 10x3 slab of #d9dce6 light grey with a #ffffff top highlight — deliberately the only grey/white-metal object in the entire game, so 'the grey side is the hard side' is learned instantly and without words. #07030f outline everywhere. Small #f2f24a eye visible above the shield. 4 directional variants x 2 (normal/stagger) + white flash variant.

**Stats:** hp 3, speed 20 px/sec, facing rotation 90 deg per 400ms, front arc 180 deg blocks all damage (punch AND dash), rear damage normal, stagger 250ms, knockback 12px, contact damage 1, hitbox 10x12, spawn weight ramps 0 -> 45 from t=48s at +2.0/sec, score 50 x combo multiplier

### exploder (Area denial and crowd chaos — creates the panic moments that end runs)

**Comportamiento:** Beelines at Romina at 40 px/sec (faster than a grunt — it wants to reach her). When within 22px OR when killed by any source, it enters FUSE. FUSE: 750ms, during which it stops moving and flashes white on an accelerating cadence (every 12 frames -> every 2 frames over the 750ms, so the urgency is legible without a number). Then DETONATES: a 26px-radius blast dealing 1 damage to Romina AND 2 damage to every other enemy in radius. Enemy-damaging blasts are deliberate — chain-detonating a cluster is the highest-scoring play in the game and it emerges naturally from a crowd. Escape math is verified: from fuse start, walking (52 px/sec x 0.75s = 39px) or dashing (0.57s walk + 34px dash = 64px) both clear the 26px blast comfortably, so it is always escapable but demands an immediate decision. Killing it does NOT prevent the blast, which teaches the player to kill it at range rather than adjacent.

**Visual:** 9x9, round and bulbous. Body #f2f24a yellow — the only yellow ENEMY body in the game, matching the universal 'danger' accent, so it screams for attention among the magenta crowd. #07030f outline, #e0249a shading on the lower third. A 2x1 #07030f fuse nub on top with a 1x1 #ffffff spark that flickers. During FUSE the body alternates full-white on the accelerating cadence, and a 1px-thick #f2f24a ring is drawn at the exact 26px blast radius so the player can SEE the danger zone before it fires — no memorization required. Single non-directional sprite + white variant.

**Stats:** hp 1, speed 40 px/sec, fuse trigger range 22px, fuse duration 750ms, blast radius 26px, blast damage 1 to player / 2 to enemies, contact damage 0 (it only harms via blast), hitbox 9x9, spawn weight ramps 0 -> 40 from t=34s at +2.2/sec, score 20 x combo multiplier (+15 bonus per enemy caught in its blast)

### arena (Static playfield and framing)

**Comportamiento:** Non-interactive. Bounds x=8..172, y=30..260 (164x230). Enemies spawn 10px outside a random edge, weighted so no more than 40% of spawns in any 3-second span come from the same edge (prevents an unfair one-sided pile-on). A spawn is rejected and retried if it would appear within 45px of Romina — she can never be blindsided by something materializing on top of her. Floor is baked ONCE at boot into a single offscreen canvas and blitted with one drawImage per frame.

**Visual:** Baked floor canvas: #140a26 base with a 16x16 grid of 1px #25123f lines, plus a 2px #3d1a5c border frame with #6a1f7a corner brackets 8px long. Four 3x1 #e0249a magenta 'neon tube' segments centered on each wall, which pulse to #ff5cc8 on the beat of the music (a cheap 2-frame swap driven by the sequencer step, no extra cost). Below the arena floor, a dithered (Bayer 4x4) gradient band from #25123f to #07030f fills y=260..264 as a horizon, baked into the same canvas.

**Stats:** bounds x 8..172 y 30..260 (164x230 virtual px), spawn ring 10px outside border, minimum spawn distance from player 45px, per-edge spawn cap 40% over any 3s window, drawn as 1 baked blit per frame

## Power-ups

- **adrenaline** — Drops from every 12th enemy killed (deterministic counter, not random — a casual player should feel the game rewarding them on a schedule they can subconsciously learn). Restores 1 HP up to the 3 max. If already at 3 HP, instead grants +400 score and +8 combo instantly, so it is never a wasted pickup. Auto-collected by walking within 10px — no button. Despawns after 8000ms, blinking white every 4 frames for the final 2000ms. _(dur: Instant)_ — 7x7 pulsing heart-fist: a #e0249a magenta fist glyph with a #ff5cc8 highlight, scaling between 7x7 and 9x9 on a 500ms sine (2 baked size variants swapped, never a runtime scale). Emits one 2x2 #ff5cc8 particle every 200ms so it draws the eye across a busy screen.
- **overdrive** — Drops from every 20th enemy killed. For its duration: punch cycle drops from 260ms to 150ms (6.7 punches/sec), punch damage rises 1 -> 2, punch reach extends 13 -> 17px, and dash cooldown drops 620 -> 380ms. Score multiplier is unaffected — Overdrive's value is that it lets the player BUILD combo far faster, which is where the score actually comes from. Auto-collected within 10px. _(dur: 6000ms. Last 1500ms the HUD bar and Romina's fists flash between #4de0f0 and #ffffff every 6 frames as a wind-down warning.)_ — 7x7 #4de0f0 cyan lightning bolt with #ffffff core and #07030f outline. While active, Romina's fist blocks change from #4de0f0 to #ffffff and she trails a 3x3 #4de0f0 afterimage square every 3 frames at her previous position. A 40x3 cyan bar drains left-to-right under the HP fists in the HUD.
- **shockwave** — Drops from every 30th enemy killed. On pickup it fires immediately (no stored charge — a casual player should never have to manage an inventory): a ring expands from Romina at 260 px/sec to a 70px radius, dealing 2 damage to every enemy it touches and knocking survivors back 20px. Every enemy killed by the shockwave feeds the combo counter individually, so a well-timed pickup in a dense crowd is the single biggest combo spike available and routinely adds 300-600 points. _(dur: Instant; the ring animation lasts 270ms)_ — 7x7 #f2f24a yellow concentric-ring icon. On trigger: a 2px-thick expanding ring drawn as 24 individual 2x2 fillRects around the circumference (no arcs), colored #ffffff for the first 90ms then #f2f24a, then #e0249a for the final 90ms — a hard 3-step color ramp, never an alpha fade.

## Progresion

Difficulty is driven by three independent curves over run time t (seconds), all evaluated per spawn tick — no discrete waves, so pressure ramps smoothly and there is never a lull that lets the player disengage.

SPAWN INTERVAL: interval_ms = max(420, 1600 - t*11). So t=0s: 1600ms, t=30s: 1270ms, t=60s: 940ms, t=90s: 610ms, t=107s+: floor of 420ms. Each spawn event emits 1 enemy (2 enemies per event once t>70s, giving a late-run density spike).

CONCURRENT CAP: maxAlive = min(14, 3 + floor(t/12)). t=0s: 3, t=24s: 5, t=60s: 8, t=120s: 13, hard cap 14. A spawn tick is skipped entirely if the cap is met, so the game self-limits and can never exceed the 32-enemy pool or the draw budget.

TYPE WEIGHTS (each type introduced ALONE, which is how the game teaches itself with zero tutorial):
- grunt: weight = max(30, 100 - t*0.8). Always present, always the majority early.
- charger: 0 until t=8s, then min(70, (t-8)*3.0).
- ranged: 0 until t=20s, then min(55, (t-20)*2.6).
- exploder: 0 until t=34s, then min(40, (t-34)*2.2).
- shielded: 0 until t=48s, then min(45, (t-48)*2.0).
Resulting mix: t=10s is 94% grunt / 6% charger (the player meets exactly one new thing). t=25s is 56/35/9 grunt/charger/ranged. t=40s adds exploders at 6%. t=55s is the first true five-type mix at 24/30/23/6/17. t=75s+ stabilizes at roughly 16/28/22/18/16 — a steady-state chaos the player is now equipped for.

ENEMY SPEED SCALAR: all enemy move speeds multiply by min(1.35, 1 + t*0.0035). Reaches 1.2x at t=57s, caps at 1.35x at t=100s. Deliberately capped — the difficulty should come from DENSITY and TYPE MIXING, not from speed that eventually outruns the player's 52 px/sec (at the 1.35 cap a grunt is 35 px/sec, still well under player speed, so retreating always remains physically possible and death is always a decision, never a foregone conclusion).

COMBO WINDOW TIGHTENING: window_ms = max(1100, 1900 - combo*22). The player's own success is the fourth difficulty curve — a 40-hit chain demands a hit every 1.1s.

No boss, no level end. The run is unbounded and ends only in death.

## Puntaje

Score comes ONLY from combat — there is no survival or time bonus, which is the mechanical reason the player must attack rather than run.

BASE VALUES: grunt 10, exploder 20, charger 25, ranged 30, shielded 50, bullet swatted 5, plus 15 per extra enemy caught in an exploder's blast.

COMBO MULTIPLIER: mult = min(6.0, 1 + floor(combo/5) * 0.5). So combo 0-4 = 1.0x, 5-9 = 1.5x, 10-14 = 2.0x, rising to the 6.0x cap at combo 50. Awarded score = round(base * mult), applied at the moment of the kill.

COMBO COUNTER: +1 for every damaging hit that connects (punch, dash-through, shockwave, bullet swat) — not per kill, so chipping a 3-HP shielded enemy builds the chain three times. A blocked shield hit grants NOTHING (no increment, no timer refund) — mashing into a shield actively costs the run.

COMBO TIMER: window_ms = max(1100, 1900 - combo*22). Any connecting hit resets the timer to the full current window. A KILL additionally refunds 250ms on top of the reset, so clearing enemies literally buys breathing room and the player feels aggression paying for itself. On expiry: combo resets to 0, combo_break sound, no score penalty (a casual player should never feel punished, only un-rewarded).

TOP COMBO of the run is tracked separately and shown on the game-over screen alongside score — it gives a second thing to be proud of on a short run.

HIGH SCORE: a single integer per game id via the shared Save layer. ctx.gameOver(score) routes through Save.submit('brawler', score), which returns true exactly when the record is beaten and drives the game-over celebration. The in-run 'ROMINA! NEW BEST!' banner fires the moment the live score passes the stored best, drawn in the control band below the arena so it never covers the action, and never pauses or consumes input. A typical first run scores 300-700; a competent 90-second run scores around 3,500; a strong run with good shockwave timing exceeds 8,000.

## Juice

- HITSTOP (the single highest-value effect): on any successful punch or dash connect, freeze ALL simulation for 4 frames (66ms) — enemies, bullets, particles, and the player all stop, but the renderer keeps drawing. Kills use 7 frames (116ms). The exploder blast uses 10 frames (166ms). Player death uses 13 frames (216ms). Implement by setting a hitstop counter and skipping the update() body (but never the render) while it is >0; the fixed-timestep accumulator is unaffected so no time debt accrues.
- SCREEN SHAKE, integer-only so the pixel grid never breaks: punch connect = 2px for 100ms, enemy killed = 3px for 140ms, charger wall-slam = 4px for 180ms, exploder detonation = 5px for 260ms, player takes damage = 6px for 300ms, player death = 8px for 400ms. Magnitude decays as mag *= pow(0.002, dt). Applied as ctx.translate with both offsets floored to integers via Math.round. Shake is a single shared scalar in the engine fx layer, capped at 8 so a chain detonation cannot make the screen unreadable.
- WHITE FLASH on every damaged entity: swap to the pre-baked white silhouette variant for 4 frames (66ms). This is a branch on a boolean, not a runtime tint — zero cost. Player hit flashes for 900ms alternating every 4 frames.
- FULL-SCREEN FLASH: player takes damage = #ffffff at alpha 0.5 decaying to 0 over 5 frames. Exploder detonation = #f2f24a at alpha 0.35 over 4 frames. Player death = #ffffff at alpha 0.85 over 8 frames. Shockwave pickup = #4de0f0 at alpha 0.4 over 5 frames. Never more than one full-screen rect per frame — they overwrite rather than stack.
- PUNCH IMPACT SPARKS: 7 particles at the contact point, velocity 90-150 px/sec in a 100-degree cone opposite the punch direction, lifetime 130-240ms, hard color ramp #ffffff -> #f2f24a -> #ff5cc8 -> #a3218f, size stepping 3px -> 2px -> 1px. Snapped to the pixel grid with Math.round.
- ENEMY DEATH BURST: 12 particles, radial, speed 70-190 px/sec, lifetime 200-420ms, ramp #ffffff -> #ff5cc8 -> #e0249a -> #3d1a5c, size 3 -> 2 -> 1, zero gravity. Plus 3 chunkier 3x3 'gib' particles with gravity 200 px/sec^2 and 30% drag that outlive the flash (500ms) and slide along the floor.
- DASH TRAIL: 4 afterimages of Romina's sprite at her positions 2/4/6/8 frames ago, drawn in order oldest-first at globalAlpha 0.15/0.25/0.35/0.5 using the pre-baked WHITE silhouette (not a tint). Costs 4 drawImage calls only during the 180ms dash.
- COMBO POP: on every combo increment, the combo number in the HUD scales up one baked size step (3x -> 4x text scale) for 5 frames then returns. At combo milestones of 10/20/30/40/50 the whole number flashes #f2f24a for 10 frames and emits 6 particles upward from the HUD text.
- COMBO TIMER BAR: a 60x3 bar under the combo number, draining right-to-left in real time. Turns from #4de0f0 cyan to #f2f24a yellow below 40% and #e0249a magenta below 20%, and at magenta it pulses (2-frame on/off) — the player feels the deadline peripherally without reading a number.
- CHARGER TELEGRAPH LANE: a 3px dotted line (4px dash, 3px gap) in #f2f24a from the charger to the arena edge during its 480ms telegraph, drawn UNDER all entities. The dots march forward at 60 px/sec so the lane reads as building energy rather than a static decal.
- EXPLODER DANGER RING: 1px #f2f24a ring at exactly the 26px blast radius during the whole 750ms fuse, drawn as 20 individual 2x2 fillRects on the circumference. Turns #ffffff for the final 150ms.
- KILL-CHAIN ZOOM PUNCH: on any kill that brings the combo to a multiple of 10, the arena draw is offset by a 1px outward scale for 3 frames (implemented as drawing the baked floor 2px larger and re-centering — no ctx.scale on sprites). Subtle, but it makes milestone kills feel like the screen flexes.
- NEW-RECORD FLASH (must never interrupt): the instant score exceeds the stored best DURING play, a 'ROMINA! NEW BEST!' banner in #f2f24a appears at y=282 (in the control band, BELOW the arena, never over the playfield), holds 900ms, then fades in 4 quantized alpha steps. Gameplay does not pause, no input is consumed, no hitstop. It fires at most once per run.
- DEATH SLOW-MO: after the 216ms hitstop, the simulation runs at 0.25x speed for 400ms while the camera holds, then the game-over readout draws over the frozen, desaturated arena (arena redrawn using only #140a26 and #25123f).
- SCANLINES: one cached createPattern fillRect over the whole 180x400 buffer at rgba(0,0,0,0.18), 1px on / 1px off. Gated behind a quality flag that auto-disables if the rolling average frame time exceeds 15ms for 60 consecutive frames.

## Audio

- punch_whiff (every punch, even a miss — the player must always get feedback): {wave:'noise', rate:2.4, rateEnd:0.9, filter:'highpass', f0:1800, f1:900, dur:0.06, vol:0.16}. A short airy tick so mashing never feels dead.
- punch_hit (connect): two layered voices — {wave:'noise', rate:1.8, rateEnd:0.5, filter:'bandpass', f0:2200, f1:700, q:5, dur:0.09, vol:0.42} plus {wave:'pulse', duty:0.125, f0:320, f1:110, dur:0.08, vol:0.30, sweep:'exp'}. The noise is the crunch, the pulse is the weight.
- enemy_die: {wave:'noise', rate:1.5, rateEnd:0.28, filter:'lowpass', f0:2000, f1:150, dur:0.30, vol:0.50} layered with {wave:'pulse', duty:0.25, f0:220, f1:60, dur:0.22, vol:0.28, sweep:'exp'}.
- dash: {wave:'noise', rate:2.9, rateEnd:1.1, filter:'bandpass', f0:1200, f1:2600, q:3, dur:0.16, vol:0.26}. Rising bandpass reads as a whoosh with i-frame confidence.
- dash_through (dash damages an enemy): dash sound plus {wave:'pulse', duty:0.5, f0:880, f1:1320, dur:0.07, vol:0.24, sweep:'lin'} — a bright confirmation that separates a scoring dash from an empty one.
- charger_telegraph (fires once at telegraph start, 480ms before the lunge — the audio warning IS the tell): {wave:'pulse', duty:0.125, f0:180, f1:420, dur:0.44, vol:0.30, sweep:'lin'}. A rising growl whose length exactly matches the telegraph window.
- charger_lunge: {wave:'noise', rate:2.2, rateEnd:0.6, filter:'lowpass', f0:3000, f1:400, dur:0.20, vol:0.38}.
- charger_stun (wall slam): {wave:'noise', rate:0.9, rateEnd:0.2, filter:'lowpass', f0:900, f1:90, dur:0.34, vol:0.52} plus {wave:'triangle', f0:110, f1:55, dur:0.30, vol:0.30, sweep:'exp'}. Deep and satisfying — this is the sound of a reward.
- enemy_shoot: {wave:'pulse', duty:0.25, f0:1500, f1:600, dur:0.10, vol:0.22, sweep:'exp'}.
- bullet_swat (punching a bullet out of the air): {wave:'pulse', duty:0.5, f0:1760, f1:2640, dur:0.05, vol:0.28, sweep:'lin'}. Deliberately the highest-pitched sound in the game so this hidden skill move announces itself.
- shield_clank (blocked hit): {wave:'noise', rate:2.6, filter:'bandpass', f0:3400, f1:2800, q:9, dur:0.08, vol:0.34} plus {wave:'pulse', duty:0.5, f0:1046, dur:0.05, vol:0.18}. Metallic, non-rewarding, clearly distinct from punch_hit so the player instantly knows the hit did nothing.
- exploder_fuse (loops on the accelerating flash cadence, one blip per flash): {wave:'pulse', duty:0.125, f0:660, dur:0.035, vol:0.20}. The blip RATE accelerating from ~5/sec to ~30/sec over the 750ms fuse is the urgency cue.
- exploder_blast: {wave:'noise', rate:1.2, rateEnd:0.18, filter:'lowpass', f0:2600, f1:80, dur:0.55, vol:0.62} plus {wave:'triangle', f0:90, f1:40, dur:0.45, vol:0.34, sweep:'exp'}.
- shockwave: {wave:'noise', rate:0.7, rateEnd:2.4, filter:'highpass', f0:200, f1:4000, dur:0.32, vol:0.48} — an inverted sweep (rising) so it reads as an outward push rather than an explosion.
- pickup_health: [{wave:'pulse',duty:0.5,f0:659,dur:0.07,vol:0.30},{wave:'pulse',duty:0.5,f0:988,dur:0.14,vol:0.30,at:0.07}].
- pickup_overdrive: [{wave:'pulse',duty:0.25,f0:392,dur:0.06,vol:0.28},{wave:'pulse',duty:0.25,f0:523,dur:0.06,vol:0.28,at:0.06},{wave:'pulse',duty:0.25,f0:659,dur:0.06,vol:0.28,at:0.12},{wave:'pulse',duty:0.25,f0:1047,dur:0.20,vol:0.32,at:0.18}].
- combo_tier (fires at every 5-combo step; PITCH RISES WITH THE TIER — f0 = 523 * pow(1.0595, min(tier,24)) so the player hears their chain climbing): {wave:'pulse', duty:0.5, f0:<computed>, dur:0.05, vol:0.22}. Clamp the tier at 24 semitones so it never becomes shrill.
- combo_break (chain expires): {wave:'pulse', duty:0.125, f0:440, f1:110, dur:0.26, vol:0.30, sweep:'exp'}. A descending sigh — unmistakably a loss, but quiet enough not to punish.
- player_hurt: {wave:'pulse', duty:0.125, f0:400, f1:80, dur:0.28, vol:0.48, sweep:'exp'} plus {wave:'noise', rate:1.0, rateEnd:0.3, filter:'lowpass', f0:1200, f1:150, dur:0.24, vol:0.34}.
- player_death: [{wave:'triangle',f0:392,dur:0.18,vol:0.52},{wave:'triangle',f0:330,dur:0.18,vol:0.52,at:0.18},{wave:'triangle',f0:262,dur:0.18,vol:0.52,at:0.36},{wave:'triangle',f0:196,dur:0.60,vol:0.56,at:0.54}].
- new_record (plays UNDER the action, on the music bus at reduced volume so it never masks gameplay SFX): [{wave:'pulse',duty:0.5,f0:784,dur:0.09,vol:0.26},{wave:'pulse',duty:0.5,f0:988,dur:0.09,vol:0.26,at:0.09},{wave:'pulse',duty:0.5,f0:1319,dur:0.09,vol:0.26,at:0.18},{wave:'pulse',duty:0.5,f0:1568,dur:0.30,vol:0.30,at:0.27}].
- MUSIC — a 16-step loop at 146bpm (1.644s per bar) driven by the lookahead scheduler with AHEAD=0.15s and absolute note times. Three tracks: LEAD {wave:'pulse',duty:0.5,vol:0.24,gate:0.85, pattern:['A4','.','A4','C5','.','E5','.','D5','A4','.','A4','C5','.','G5','E5','.']}; BASS {wave:'pulse',duty:0.125,vol:0.20,gate:0.5, pattern:['A2','A2','.','A2','A2','.','A2','.','F2','F2','.','F2','G2','.','G2','.']}; DRUMS {wave:'noise',vol:0.24, pattern:['L','.','H','.','L','H','H','.','L','.','H','.','L','H','H','H']}. TEMPO SCALES WITH THE RUN: bpm = 146 + min(34, floor(t/10)*4), so it starts at 146 and climbs to 180 by t=90s — the music itself is a difficulty readout. Change bpm only at a bar boundary (step wraps to 0) so the loop never glitches.
- Voice management: hard cap 24 concurrent voices, drop new SFX at the cap rather than queueing. Every source gets an explicit stop(t+dur+0.02) and an onended that decrements the counter and disconnects both the source and its gain. sfxBus at 0.85 and musicBus at 0.45 both feed a master at 0.9 into a DynamicsCompressor (threshold -10, knee 6, ratio 12, attack 0.003, release 0.12) before destination. Every exponential ramp target clamped: gain >= 0.0001, frequency >= 1, filter cutoff >= 20, playbackRate >= 0.02.
- HAPTICS (bonus only, never load-bearing — every haptic is paired with a visual flash and a sound): punch_hit 14ms, enemy_die 18ms, player_hurt [30,40,30], exploder_blast 25ms, player_death [40,60,120]. Rate-gated to one pulse per 80ms, wrapped in try/catch, feature-detected, defaulting ON with a toggle.
