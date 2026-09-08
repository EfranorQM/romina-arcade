# SKYLINE

> Romina sprints across a collapsing neon skyline that never stops accelerating — one thumb, one jump, one dash, no floor.

**Loop:** Every 4-8 seconds the player reads an incoming rooftop silhouette, decides tap-length (short hop vs held long jump), and commits. Mid-air she gets exactly one extra input: a second tap that is a DOUBLE JUMP if her vertical velocity is downward-or-neutral, or an AIR DASH if she taps within 120ms of the first jump apex (see controls for the exact rule — implementers use one branch, not two buttons). Landing on a roof restores both air moves, triggers a dust puff, and adds +1 to a combo that decays after 2s without a pickup. Collectibles (DATA BITS) sit in arcs that trace the ideal jump path, so grabbing them IS the tutorial. Speed rises continuously, so the same rooftop that was a hop at 60s is a dash-or-die at 120s. Repeat until a gap wins.

**Duracion de partida:** First-ever run: 20-40 seconds (she will die to the first held-jump gap around 28s). Competent run after ~10 attempts: 70-110 seconds. Strong run: 150-210 seconds, at which point the speed ceiling has been reached and only density is still rising, so runs terminate reliably rather than dragging. Target median across a session: ~75 seconds. Death-to-playing-again is 850ms (gap death) or 700ms (impact death) plus a 400ms input lockout on the game-over screen and a single tap — call it 1.25s worst case, inside the 1.5s requirement.

**Muerte:** THREE WAYS TO LOSE, all instant and all self-evident: (1) fall into a gap — her hitbox bottom passes y=400; (2) touch a spike; (3) touch a drone without dash i-frames. There is no health bar, no lives, no continues. PHASE powerup charges are the only mitigation and they are consumed visibly.

RETRY FLOW: on death the world keeps scrolling for 500ms (gap) or freezes for 133ms then holds (impact) while Romina's ragdoll spins off, then the 150ms dissolve brings up the game-over card: 'ROMINA' in the magenta atlas at scale 3, the score at scale 4, 'BEST nnnnn' at scale 2, and — only on a new record — 'NEW RECORD ROMINA!' pulsing at scale 2 with a 48-particle confetti burst from the shared FX pool and the record fanfare. After a 400ms input lockout, ANY tap restarts immediately into a new run with a fresh seed. There is no menu round-trip, no 'are you sure', no ad, no results breakdown. The word 'TAP' appears at scale 1 at the bottom after 600ms in case she hesitates, and that is the only instructional text in the entire game.

STATE SAFETY: the high score is written through Save.submit inside ctx.gameOver, and the whole save blob is also flushed on visibilitychange->hidden, because Android WebViews frequently never fire unload.

## Controles

WHOLE-SCREEN SINGLE TOUCH. There are no on-screen buttons during play. The entire 180x400 virtual canvas is one hit region. Pointer Events only (pointerdown/pointermove/pointerup/pointercancel, {passive:false}, preventDefault, setPointerCapture). Only the FIRST active pointer id drives the game; a second finger is ignored entirely (no arbitration needed, no claim bytes — one control exists).

INPUT STATE MACHINE (all times in ms of game time, 60Hz fixed step):
- pointerdown while grounded OR within COYOTE window (100ms / 6 ticks after leaving a ledge) -> JUMP. vy = -215 px/s. Sets holding=true, holdTimer=0, airMoveUsed=false.
- while holding==true AND holdTimer<220ms AND vy<0 -> apply JUMP_SUSTAIN: vy -= 620 px/s^2 * dt (this partially cancels gravity; see entity stats). Releasing the pointer before 220ms sets holding=false permanently for that jump, producing the short hop. Minimum hop height = 26px (tap <=80ms). Maximum held height = 61px (hold >=220ms).
- pointerup / pointercancel -> holding=false.
- pointerdown while AIRBORNE and airMoveUsed==false -> AIR MOVE, branch on vy:
    * if vy > -40 px/s (at/after apex, i.e. falling or nearly still) -> DOUBLE JUMP: vy = -180 px/s, holding=true again with a fresh 160ms sustain window (max extra height 44px).
    * if vy <= -40 px/s (still rising fast, i.e. she tapped early) -> AIR DASH: vx boost applied as a 180ms horizontal surge of +110 px/s added to world scroll-relative speed, vy locked to 0 for the dash duration, then vy resumes at 0 with normal gravity. Dash grants 180ms of hazard i-frames against DRONES only (never against gaps or spikes).
  Both set airMoveUsed=true. Landing resets it.
- BUFFER: a pointerdown that arrives up to 120ms (7 ticks) before landing is stored and auto-fires JUMP on the landing tick. This is the single most important feel rule — implement it.

MENU/RETRY: one pointerdown anywhere. Game-over screen accepts input after 400ms lockout (prevents the death-tap from instantly restarting) and restarts INSTANTLY into a fresh run — no menu round-trip, no fade beyond a 150ms dissolve.

PAUSE/MUTE: a 20x20 virtual-px speaker glyph at top-right (x 156-176, y 4-24), hit-padded to 28x28. It is the ONLY exception to whole-screen input and is tested FIRST in the pointerdown handler; if it hits, the tap does not jump. It sits 24px inside the right edge to clear the MIUI back-gesture inset.

_Romina holds the phone in one hand and taps anywhere with that thumb — there is no target to find, no reach problem, and no wrong place to touch, so the 6.43in screen size and grip position are irrelevant. The MIUI edge-swipe hazard is neutralized because a swipe that gets stolen by the system produces a pointercancel, which we treat as pointerup: worst case she gets a short hop instead of a long one, never a stuck input. The only fixed target (mute) is 28x28 virtual px = ~61 CSS px = ~168 device px at the 2.18x upscale and 2.75 dpr, well above the 44 CSS px WCAG floor, and inset 24px from the right edge so the back gesture cannot eat it. Two-thumb play works identically because extra pointers are discarded rather than double-firing._

## Paleta

`#07030f` `#140a26` `#25123f` `#3d1a5c` `#a3218f` `#e0249a` `#ff5cc8` `#1d47a0` `#2a8ce0` `#4de0f0` `#0f5c4a` `#1fd18a` `#f2f24a` `#ffec27` `#ffffff` `#6a1f7a`

## Entidades

### romina (player — auto-running avatar, always at a fixed screen x)

**Comportamiento:** Fixed at x=52 (her left edge; hitbox x 52-62). World scrolls left past her; she never moves horizontally except during AIR DASH, where she is temporarily pushed to x=52+lerp(0,26,t/0.18) and eased back over 120ms after the dash ends. Gravity 980 px/s^2 while vy>0 (falling) and 760 px/s^2 while vy<0 (rising) — asymmetric gravity is what makes the arc feel snappy. Terminal fall speed clamped to 520 px/s. JUMP_SUSTAIN (see controls) subtracts 620 px/s^2 while held, giving an effective rising gravity of 140 px/s^2 during the hold window. States: RUN, RISE, FALL, DASH, DEAD. Run cycle: 4 frames, frame time = clamp(110 - (speed-58)*0.55, 55, 110) ms per frame, so her legs visibly speed up as the game does. On landing she squashes: sprite drawn 12w x 10h for 4 ticks (66ms) then 10x14 for 3 ticks then normal 10x12 — pre-bake all three, no runtime scale. On DEAD she is launched vy=-160, vx=-40, spins through 4 pre-baked rotation frames at 80ms each and falls off-screen.

COLLISION: 10x12 AABB, but the ground check uses only a 6px-wide foot probe centered under her (x+2 to x+8) checked against the platform top edge, and only when vy>=0. This forgives 2px of pixel-hunting on ledge edges. Ceiling: none (no overhead geometry). Death: (a) her hitbox bottom passes y=400 (fell in a gap), or (b) her hitbox overlaps a HAZARD entity's hitbox with no active i-frames.

**Visual:** 10x12 sprite. Neon-runner silhouette: dark navy body with a hot-magenta jacket, cyan visor stripe, white hair streak that trails 3px behind her when airborne (bake a separate 13x12 airborne variant with the trail). Pixel rows (string-array format, '.' transparent): hair/head block 3px tall at top with a 2px cyan visor slit at row 2; 4px torso in magenta with a 1px white shoulder highlight on the left (light comes from screen-left neon); 5px legs in dark navy with the trailing leg 1px lighter. All outlines in the single shared OUTLINE color. Palette: outline #07030f, hair #f2f24a, skin/shadow #3d1a5c, jacket #e0249a, jacket-light #ff5cc8, visor #4de0f0, legs #25123f, boots #ff5cc8. Four run frames differ only in the 5 leg rows (2 pixels of leg swap per frame) so they read as motion at 10px tall. Bake also: rominaWhite (source-atop white silhouette) for the 3-frame hit flash, and 4 dash frames where the visor stripe extends into a 6px cyan streak behind her.

**Stats:** hitbox 10x12. hp 1 (one hit = death, except drone contact during dash i-frames). jump vy -215 px/s, double-jump vy -180 px/s. gravity 760 up / 980 down, terminal 520. hold sustain 620 px/s^2 for max 220ms (first jump) / 160ms (double). coyote 100ms. jump buffer 120ms. dash: 180ms duration, +110 px/s, 300ms cooldown enforced by airMoveUsed (only resets on land). Air moves per airtime: exactly 1.

### rooftop (platform — the only walkable surface)

**Comportamiento:** Static rectangles scrolling left at the current world speed. Each rooftop is defined by {x, topY, w, styleIdx}. topY snaps to one of 7 height bands: 232, 254, 276, 298, 320, 342, 364 (22px apart). Band-to-band delta between consecutive rooftops is constrained to at most +/-2 bands (44px) so no jump is impossible. Rooftops are generated right-to-left by the chunk generator (see progression); each carries an optional decoration list baked into its own offscreen canvas at spawn? NO — decorations are drawn as 1-3 extra drawImage calls from a shared 8-sprite decoration set, chosen by a hash of x so it is deterministic and free. Rooftop width range: 34-96px, quantized to 2px. Recycled through a Pool(24). A rooftop is freed when x + w < -8.

EDGE BEHAVIOR: the left 3px and right 3px of every rooftop top surface are drawn 1px brighter (an edge highlight) — this is a readability affordance, not decoration: it tells Romina exactly where the ledge ends at a glance.

**Visual:** Drawn as three baked pieces so any width composes from blits: LEFT_CAP (4x40), MID_TILE (8x40, tiled), RIGHT_CAP (4x40). The building body below the roof is a vertical band of dark #140a26 with a 1px #25123f left face and randomized lit windows: a baked 8x40 window-column tile in 3 variants (windows lit #f2f24a, #4de0f0, or dark), selected by (x*2654435761>>>13)&3 so it is stable while scrolling and costs no state. Roof surface: 2px slab of #2a8ce0 with a 1px #4de0f0 top line, and the 3px edge highlights in #ffffff. Every rooftop shares the OUTLINE #07030f 1px bottom-of-slab line. Palette: #07030f, #140a26, #25123f, #2a8ce0, #4de0f0, #f2f24a, #ffffff.

**Stats:** width 34-96px (2px quantized). height bands: 7 values from y=232 to y=364, step 22. band delta between neighbors: max 2 (44px). gap between rooftops: 18-64px, scaled by speed (see progression). Pool cap 24 (max on-screen at min width + max gap is ~5, 24 is 5x headroom). Collision: top-surface only, one AABB per rooftop, tested against Romina's 6px foot probe. No side collision — running into a wall is impossible by construction since a rooftop's top is always reachable.

### gap (primary hazard — the absence of a rooftop)

**Comportamiento:** Not an entity. A gap is the empty span between rooftop[i].x+w and rooftop[i+1].x. Death occurs purely via Romina's y exceeding 400. This is deliberate: zero collision cost, and the failure is always self-evident.

**Visual:** The gap reveals the parallax city and the dithered sky behind it. To make gaps unmistakable at a glance, the generator draws a 2px-wide vertical #e0249a 'edge warning' tick on the right cap of the rooftop preceding any gap wider than 46px — a subliminal 'this one needs a hold'.

**Stats:** width 18-64px (see progression curve). At speed 58 px/s a 46px gap requires a ~0.79s airtime = a held jump. At speed 130 px/s the same 46px gap is a 0.35s airtime = a tap. The generator therefore scales gap width WITH speed to keep required-hold-length roughly constant (see progression).

### spike (static hazard on a rooftop surface)

**Comportamiento:** A 8x6 spike cluster sitting ON a rooftop's top surface. Placed by the generator at least 14px from either rooftop edge, never on rooftops narrower than 46px, never on the first rooftop after a gap wider than 40px (no unfair back-to-back demands). Static, scrolls with the world. Contact with Romina's hitbox = death (dash i-frames do NOT protect). Pool(16). Freed at x < -8.

**Visual:** 8x6. Three triangular teeth drawn as stepped pixel rows: row0 '..1..1..' row1 '.11..11.' row2 '111..111' row3 '11111111' rows 4-5 a #a3218f base slab. Teeth in #4de0f0 with a #ffffff 1px tip, base #a3218f, OUTLINE bottom row. It pulses: two baked variants (tips #ffffff / tips #4de0f0) alternating every 250ms, globally synced so all spikes blink together — reads as 'electrified', costs one boolean.

**Stats:** hitbox 8x6, sits with its bottom at rooftop topY. hp n/a. damage: instant death. spawn: 22% chance per eligible rooftop before 40s, rising to 46% by 120s (linear). Never two spikes on one rooftop before 60s; up to two (min 20px apart) after.

### drone (moving hazard — forces the dash and the double-jump to matter)

**Comportamiento:** Spawns at the right edge (x=188) at a y chosen as (rooftopBandY - 20) or (rooftopBandY - 40) for the rooftop it spawns above. Moves LEFT at worldSpeed + 22 px/s (so it closes on her faster than terrain). Bobs vertically: y = baseY + sin(t*4.4)*5, computed from a 64-entry pre-baked sine LUT indexed by a per-drone phase counter (no Math.sin in the loop). Does not track the player — its path is fully readable from the moment it appears, which is what makes it fair. Two subtypes chosen 50/50 after 55s:
  * SCANNER (default): straight line, bobbing as above.
  * DIVER (after 70s only): flies level for 0.9s then drops at 90 px/s for 0.6s then levels again — a single telegraphed swoop. Telegraph: its eye flashes white for 200ms before the drop begins.
Contact = death UNLESS Romina has active dash i-frames, in which case the drone is DESTROYED (12-particle burst, +50 score, a 3px shake, and the 'zap' sfx). This is the skill expression: dashing THROUGH a drone is the only offensive act in the game. Pool(12). Freed at x < -12.

**Visual:** 12x8. A wedge-shaped hover drone: 2px #a3218f hull with a #e0249a underglow strip, a single 2x2 #ff5cc8 eye at the front-left (facing her), two 1x3 #4de0f0 thruster stubs at the rear that flicker between two baked frames every 100ms. Beneath it, a 6x1 #e0249a shadow rect drawn at 40% via a pre-baked dim color (never globalAlpha per entity). DIVER variant is identical but with a #f2f24a eye and a 1px yellow chevron on the hull so it is distinguishable in 0.2s. Palette: #07030f, #a3218f, #e0249a, #ff5cc8, #4de0f0, #f2f24a.

**Stats:** hitbox 12x8 (visual is 12x8, hitbox inset 1px each side = 10x6 for forgiveness). speed = worldSpeed + 22 px/s leftward. bob amplitude 5px, period 1.43s. hp 1 (only killable by dash). spawn: none before 42s. From 42s: one drone every 5.5-9.0s (uniform). From 85s: every 3.5-6.0s. Hard cap 3 alive at once. DIVER subtype unlocked at 70s, 50% weight. Never spawns within 40px horizontally of a spike.

### databit (collectible — score, combo, and the invisible tutorial)

**Comportamiento:** Spawns in ARCS of 3-6 bits, spaced 11px apart along a parabola that exactly matches the trajectory of the jump required to clear the upcoming gap. The generator computes the arc by simulating Romina's jump physics forward from the takeoff ledge with the exact hold length needed, then samples that path — so following the bits IS following the correct input. Bits also spawn as flat 3-runs on wide rooftops (>=64px) at y = topY-9. Collected on hitbox overlap (8x8 test against her 10x12). On collect: +10 score * combo multiplier, combo +1, combo timer reset to 2.0s, 4-particle white burst, 'coin' sfx pitched up by combo (see audio). Pool(48). Freed at x<-8 or on collect. Bits rotate through 4 pre-baked frames (a spinning diamond) at 90ms, globally synced.

**Visual:** 6x6. A spinning data diamond: frame0 a full 4x4 rotated square (#f2f24a core, #ffffff 1px center pixel), frame1 a 2x4 vertical sliver, frame2 a 1x4 line, frame3 a 2x4 sliver again — a classic 4-frame coin spin. All frames carry a 1px OUTLINE #07030f so they read against the bright sky bands. A 1px #ffec27 'sparkle' pixel offset 3px up-right appears only on frame0.

**Stats:** hitbox 6x6 (generous vs her 10x12). value 10 * combo. arc spacing 11px along path, 3-6 bits per arc. flat runs 3 bits, 11px apart. spawn: an arc accompanies ~65% of gaps wider than 34px; flat runs on ~40% of rooftops wider than 64px. Pool cap 48.

### beacon (powerup carrier — a rare, visually loud pickup)

**Comportamiento:** A single floating capsule, 10x10, hovering 20px above a rooftop surface, bobbing +/-3px on a 1.2s cycle from the same sine LUT. Scrolls with the world. On overlap: grants one of the two powerups (see powerups), 16-particle burst, 4px shake, 'powerup' arpeggio, and the powerup name flashes in the HUD for 900ms. Pool(4). Guaranteed to spawn once every 28-38s of run time, never within 6s of the previous one, and never above a rooftop that also carries a spike.

**Visual:** 10x10. A rounded (stepped) capsule with a 1px OUTLINE, a 6x6 inner field that CYCLES colors on the pickup type: OVERDRIVE bakes #f2f24a/#ffec27 alternating at 120ms; PHASE bakes #4de0f0/#ffffff. Two 1px 'wing' ticks on either side. Below it a 3px pulsing beam of 2 baked frames drawn down to the roof surface so the eye is led to it. Palette: #07030f, #f2f24a, #ffec27, #4de0f0, #ffffff, #a3218f (capsule shell).

**Stats:** hitbox 10x10. spawn interval 28-38s. Pool cap 4 (only 1 realistically alive). No collision with anything but Romina.

## Power-ups

- **overdrive** — Score multiplier x3 for the duration AND all DATA BITS within 34px of Romina are magnetically pulled toward her at 190 px/s (they curve in, which reads as a reward shower). Combo timer is frozen — it cannot decay while OVERDRIVE is active. Does not affect speed or physics, so it never changes the skill demand mid-run. _(dur: 7000ms. A 12px HUD bar under the score drains left-to-right over the 7s in 12 discrete 1px steps (never a smooth bar — quantized drain is the retro tell). Last 1500ms: the bar and Romina's outline flash between #f2f24a and #ffffff every 100ms.)_ — Beacon capsule with a #f2f24a/#ffec27 alternating core. While active, Romina gets a pre-baked 12x14 golden-aura variant (a 1px #f2f24a halo ring drawn as part of the baked sprite — no runtime glow, no shadowBlur), and 1 gold particle is emitted from her feet every 4th frame.
- **phase** — Grants 3 charges of collision immunity. Each charge is consumed by a contact that WOULD have killed her: a spike, a drone (which is destroyed, +50), or — the important one — falling into a gap, which instead teleports her to the top surface of the next rooftop with vy=0 and a 260ms cyan afterimage trail. Charges are shown as 3 small cyan pips in the HUD. Phase does NOT expire on a timer; it lasts until all 3 charges are spent, so it always feels valuable and never wastes itself during an easy stretch. _(dur: Until 3 charges are consumed (no timer). Each consumption: 120ms hitstop, 5px shake, the screen flashes #4de0f0 at alpha 0.5 for 2 frames, and one HUD pip shatters into 6 cyan particles.)_ — Beacon capsule with a #4de0f0/#ffffff alternating core. While she holds charges, Romina is drawn from a pre-baked cyan-rimmed variant (1px #4de0f0 outline replacing the usual #07030f outline) and a 1px cyan afterimage of her previous-frame position is blitted behind her at a pre-baked 35%-dim color. HUD pips: three 4x4 cyan diamonds at x=6,13,20 / y=26.

## Progresion

WORLD SPEED (the single master difficulty variable, in virtual px/sec of leftward scroll):
speed(t) = 58 + 46 * (1 - exp(-t / 46)) + 0.26 * t, clamped to a hard ceiling of 168.
Concrete values: t=0 -> 58.0; t=10 -> 68.9; t=20 -> 76.6; t=30 -> 84.1; t=45 -> 95.4; t=60 -> 106.4; t=90 -> 128.5; t=120 -> 150.5; t=145 -> 168 (ceiling); beyond 145s speed is constant and difficulty comes from density only. The exp term gives a fast, immediately-felt early ramp (she notices it accelerating within the first 10 seconds — that is the hook); the linear term keeps it climbing forever without ever feeling like a wall. Implement exp() once per second, not per frame (cache it; the curve is smooth enough that 1Hz updates are invisible).

GAP WIDTH: gapPx = clamp( round( speed * airtimeTarget ), 18, 64 ) where airtimeTarget is drawn per-gap from a difficulty-weighted table:
 - t < 25s:  airtimeTarget in {0.30, 0.38, 0.46} weights {5,3,2}  -> at speed 62-78 that is 19-36px gaps. Tap-only. She cannot fail here without trying.
 - 25-55s:   {0.30, 0.42, 0.56, 0.66} weights {3,4,3,2}          -> introduces the held jump.
 - 55-90s:   {0.34, 0.48, 0.62, 0.74, 0.86} weights {2,3,4,3,2}  -> the 0.86 entries REQUIRE double-jump; the first one occurs around 58s and is always preceded by a 5-bit arc that traces the double-jump path.
 - 90s+:     {0.40, 0.55, 0.70, 0.84, 0.94} weights {2,3,4,4,3}  -> mixed, with the 64px clamp meaning at ceiling speed everything is a held-jump-plus.
Never generate two consecutive gaps both drawing from the top two airtime entries before 70s.

HEIGHT DELTA: |band delta| distribution: t<30s -> {0:40%, 1:45%, 2:15%}. t 30-70s -> {0:28%, 1:45%, 2:27%}. t>70s -> {0:20%, 1:42%, 2:38%}. An UPWARD 2-band step (44px) is never paired with a gap wider than 48px before 80s.

ROOFTOP WIDTH: uniform 34-96 before 30s; 30-90s uniform 30-78; 90s+ uniform 26-64. Narrowing landing zones is the second difficulty axis and it is felt as precision pressure rather than as speed.

HAZARD DENSITY: spike chance per eligible rooftop = clamp(0.22 + (t-40)*0.002, 0.22, 0.46). Drone interval = lerp from 5.5-9.0s at t=42 down to 3.5-6.0s at t=85, constant after. Drone cap 3.

CHUNK GENERATOR: the world is built by appending one rooftop at a time whenever the rightmost rooftop's right edge drops below x=200. Each append: (1) draw a gap width, (2) draw a band delta, (3) validate reachability against the CURRENT speed using the closed-form max jump range (see below), regenerating up to 4 times then falling back to the safest option; (4) draw a rooftop width; (5) roll spike; (6) roll databit arc/run; (7) roll beacon if the timer is due.
REACHABILITY CHECK (must be in code, not assumed): maxRange(dy) = speed * airtimeFor(dy), where airtimeFor solves the piecewise ballistic with hold + double-jump. Precompute a 7x7 table (from-band x to-band) of max horizontal reach at speed=1, multiply by current speed at generation time. If gap > 0.88 * maxRange, shrink the gap to 0.88 * maxRange. The 0.88 safety factor is what guarantees a run is never lost to an impossible chunk — a casual player must always be able to blame herself.

## Puntaje

DISTANCE: +1 point per 8 virtual px of world scroll (so ~7 pts/sec at start, ~21 pts/sec at ceiling speed — the score visibly accelerates, which is its own reward). Accumulated as a float, floored for display.
DATA BIT: +10 * comboMultiplier. comboMultiplier = 1 + floor(combo / 5), capped at 6. combo increments per bit collected and resets to 0 if 2.0s elapse with no collect (frozen during OVERDRIVE). So a clean 30-bit chain is worth far more than 30 scattered bits — this is what makes following the arcs matter.
DRONE DASH-KILL: +50, flat, no multiplier (it should be a reward for daring, not a farm).
NEAR-MISS: +5.
OVERDRIVE: x3 on all of the above for 7s.
HIGH SCORE: a single integer per game id, submitted through the shared ctx.gameOver(score) -> Save.submit('runner', score) path, which returns true exactly on a new best. Displayed in the HUD as 'BEST 00000' (5-digit zero-padded, cached as a string and rebuilt only when the value changes). The in-play 'ROMINA #1' flash fires the instant score crosses the stored best; the game-over screen shows the celebration properly.
HUD LAYOUT (bitmap font, drawn into the canvas, integer scales only): score at x=6 y=6 scale 2 in the cyan atlas (5-digit padded); 'BEST nnnnn' at x=6 y=18 scale 1 in the dim #3d1a5c atlas; combo as 'x2'..'x6' at x=6 y=38 scale 2 in the yellow atlas, drawn only when multiplier > 1; powerup bar/pips at x=6 y=26; mute glyph at x=156 y=4. Total HUD cost: ~14 drawImage calls.

## Juice

- LANDING SQUASH: on ground contact, Romina swaps to a pre-baked 12x10 squashed sprite for 4 ticks (66ms), then a 10x14 stretched sprite for 3 ticks (50ms), then normal. Pre-baked variants only — never ctx.scale per frame. Paired with a 5-particle dust puff (color ramp ['#ffffff','#4de0f0','#2a8ce0','#1d47a0'], 2px squares, spread over a 60-degree upward-outward cone, speed 40-70 px/s, gravity 180, life 0.22-0.34s) emitted at her feet.
- JUMP STRETCH: on takeoff, the 10x14 stretched sprite for 3 ticks, plus a 3-particle downward puff at 90 px/s.
- DASH TRAIL: during the 180ms dash, blit a pre-baked 35%-dim copy of the current Romina frame at her position from 2 ticks ago and 4 ticks ago (store a 6-entry ring buffer of x/y/frame — 6 numbers, zero allocation). Plus 2 cyan streak particles per tick, 1x3 rects, velocity (-140, rng -20..20), life 0.18s, ramp ['#ffffff','#4de0f0','#2a8ce0'].
- DASH-KILL ON DRONE: 6-tick (100ms) HITSTOP — the update() body early-returns for everything except the particle system and a rising 'pop' of the drone's own explosion. This is the single most satisfying moment in the game and hitstop is what sells it. Then: 12-particle burst (ramp ['#ffffff','#f2f24a','#e0249a','#a3218f'], speed 70-160, gravity 0, life 0.20-0.40s), screen shake magnitude 4 decaying with shake *= pow(0.0015, dt), one full-screen white fillRect at alpha 0.5 for exactly 2 frames, and a +50 score popup in bitmap text rising 14px over 500ms.
- COMBO PULSE: every 5th combo step, the score text in the HUD is drawn from the WHITE font atlas instead of the cyan one for 8 ticks and drawn 1px larger scale (scale 3 instead of 2) — integer scales only. A single 'blip' rises in pitch with the combo.
- GAP-DEATH: no hitstop (she needs to see it was a gap). Camera continues scrolling for 500ms while she falls, then 200ms hold, then the game-over overlay dissolves in over 150ms using the pre-baked 8x8-cell Fisher-Yates dissolve order. Total death-to-retryable: 850ms, well under the 1.5s budget.
- IMPACT-DEATH (spike/drone): 8-tick (133ms) hitstop, 6px shake, full-screen #ffffff flash at alpha 0.7 for 2 frames then alpha 0.3 for 2 more, Romina switches to the white-silhouette bake for 6 ticks, 18-particle magenta burst. Then the same 150ms dissolve. Total 700ms.
- SPEED LINES: whenever speed > 110, draw 4 horizontal 1x8 rects of #25123f at random y in the sky region, scrolling left at 2.2x world speed, recycled from a fixed 4-entry array. Above speed 145, 7 lines and the color brightens to #3d1a5c. This is the entire 'you are going dangerously fast' signal and it costs 7 fillRects.
- NEAR-MISS: if Romina passes within 6px vertically of a drone or spike without dying, award +5, spawn 2 white sparks, and play a very short 'whoosh' (see audio). Tracked with one flag per hazard, cleared when it leaves the screen. This rewards not slowing down.
- NEW-RECORD FLASH (must never interrupt): the instant score exceeds the stored best DURING PLAY, a 1-frame white flash at alpha 0.25, then the bitmap text 'ROMINA #1' fades in at the top-center in the yellow font atlas for 1100ms — drawn ABOVE the sky but BELOW gameplay sprites so it can never occlude a rooftop edge or a drone. It uses a quantized 4-step alpha (0.25/0.5/0.75/1 then reverse). No input is consumed, no time is stopped, nothing moves. It is a background compliment, not a modal.
- LEDGE DUST: whenever Romina runs across a rooftop, emit 1 particle every 6 ticks at her back foot, 1px, color #3d1a5c, velocity (-30, -10), life 0.25s. Barely visible, but its absence is felt.
- BEACON SHOWER: on beacon pickup, 16 particles in the powerup's color ramp, speed 60-140, gravity -30 (they float UP), life 0.4-0.7s, plus 4px shake and the powerup name in bitmap text at screen center for 900ms in a quantized 3-step fade.

## Audio

- jump — {wave:'pulse', duty:0.5, f0:180, f1:640, dur:0.14, vol:0.35}. A rising blip. Pitch f0 scales with hold: fire it on pointerdown at f0=180, and on release (or hold-timeout) fire a second {wave:'pulse',duty:0.25,f0:640,f1:820,dur:0.06,vol:0.18} so a long hold is audibly a longer sound. This is the only cue for hold-length and it teaches the mechanic in one run.
- doubleJump — {wave:'pulse', duty:0.125, f0:520, f1:980, dur:0.11, vol:0.30}. Thinner duty than the ground jump so the ear can tell them apart without looking.
- dash — two layers fired together: {wave:'noise', rate:2.6, rateEnd:0.5, filter:'bandpass', f0:3200, f1:900, q:5, dur:0.20, vol:0.42} plus {wave:'pulse', duty:0.25, f0:1200, f1:300, dur:0.18, vol:0.22}. Reads as a sharp air-shear.
- land — {wave:'noise', rate:1.1, rateEnd:0.35, filter:'lowpass', f0:1400, f1:200, dur:0.09, vol:0.28}. Short, dull thud. Fire at every landing including the buffered-jump landing.
- coin — the combo instrument. Base {wave:'pulse', duty:0.5, f0:988, dur:0.05, vol:0.30} with f0 multiplied by 2^(min(combo,12)/12) so the pitch walks up a full octave over 12 collects and then plateaus. At combo multiples of 4, append a second note at 1.5x the frequency with at:0.05, dur:0.10 — a small arpeggio flourish every 4 bits.
- zap (dash-kills-drone) — {wave:'noise', rate:2.2, rateEnd:0.15, filter:'lowpass', f0:2600, f1:110, dur:0.34, vol:0.55} plus a descending {wave:'pulse',duty:0.125,f0:1600,f1:180,dur:0.22,vol:0.30}. Scheduled at ctx.currentTime+0.001, fired on the FIRST hitstop frame so it lands with the freeze, not after it.
- nearMiss — {wave:'noise', rate:3.0, rateEnd:1.4, filter:'highpass', f0:5200, f1:5200, dur:0.05, vol:0.16}. Almost subliminal; a tiny air-brush.
- powerup — the 4-note validated arpeggio: [{wave:'pulse',duty:0.25,f0:392,dur:0.07,vol:0.30},{...f0:523,at:0.07},{...f0:659,at:0.14},{wave:'pulse',duty:0.25,f0:1047,dur:0.22,vol:0.32,at:0.21}].
- phaseSave — {wave:'pulse', duty:0.5, f0:1319, f1:659, dur:0.30, vol:0.40} plus {wave:'triangle', f0:330, dur:0.35, vol:0.30}. A glassy 'saved you' — deliberately reassuring rather than alarming.
- death — [{wave:'triangle',f0:392,dur:0.18,vol:0.5},{wave:'triangle',f0:330,dur:0.18,vol:0.5,at:0.18},{wave:'triangle',f0:262,dur:0.18,vol:0.5,at:0.36},{wave:'triangle',f0:196,dur:0.60,vol:0.55,at:0.54}], layered with one {wave:'noise',rate:1.0,rateEnd:0.12,filter:'lowpass',f0:1200,f1:70,dur:0.7,vol:0.45} at at:0.
- record (new high score, during play) — [{wave:'pulse',duty:0.5,f0:1047,dur:0.06,vol:0.26},{...f0:1319,at:0.06},{...f0:1568,at:0.12},{...f0:2093,dur:0.18,at:0.18}]. Deliberately quiet (vol 0.26) and short (0.36s) so it never masks a jump cue.
- MUSIC — one 16-step loop at 148bpm, div 4, so a bar is 1.622s. It is BUILT TO ACCELERATE: on every speed recalculation (1Hz), set seq.stepDur = 60/(148 + (speed-58)*0.62)/4, so the music tempo climbs from 148bpm at t=0 to ~216bpm at the speed ceiling. Change stepDur only at a bar boundary (step===0) so the loop never glitches. Tracks: LEAD pulse duty 0.5 vol 0.24 gate 0.9 pattern ['A4','.','E5','.','C5','.','E5','.','G4','.','D5','.','B4','.','D5','.']; BASS pulse duty 0.25 vol 0.18 gate 0.5 pattern ['A2','A2','.','A2','.','A2','A2','.','F2','F2','.','F2','.','F2','F2','.']; DRUMS noise vol 0.20 pattern ['L','.','H','.','L','.','H','H','L','.','H','.','L','H','H','.']. Scheduler: 25ms setTimeout, AHEAD=0.15s, absolute times passed to play(), accumulator advance — exactly as specified in the research. Music runs on musicBus at 0.45; SFX on sfxBus at 0.85; both through the DynamicsCompressor (threshold -10, knee 6, ratio 12, attack 0.003, release 0.12). MAX_VOICES 24 with onended cleanup.
- HAPTICS (bonus only, gate 80ms): land 12ms, coin — none (too frequent), dash 14ms, zap [18,30,18], phaseSave 25ms, death [40,60,120]. Every call wrapped in try/catch behind a feature check and an in-game toggle.
