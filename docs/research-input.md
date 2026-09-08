# Research: input

## Pointer Events vs Touch Events on Android WebView

**Recomendacion:** Use Pointer Events exclusively. Do NOT register both pointer and touch listeners — you will get every input twice. Set `touch-action:none` on the canvas so the WebView never withholds pointermove waiting to decide if it is a scroll. Call `setPointerCapture(e.pointerId)` on pointerdown so a thumb that slides off the canvas edge keeps delivering events to you, and treat `pointercancel` as identical to `pointerup` (MIUI fires it when the system steals the gesture). Track pointers by `pointerId` into fixed-size TypedArray slots, never a Map/object, so the hot path allocates nothing.

**Por que:** MDN's current guidance is that Pointer Events are the model to use for multi-device, multi-touch input; they natively carry simultaneous pointers, which is exactly the two-thumb case. The Snapdragon 678 WebView is modern Chrome and supports the full spec including setPointerCapture and getCoalescedEvents. Touch Events would work but force you to hand-diff `e.touches`/`e.changedTouches` every frame, and mixing both models is the single most common source of double-fired input. Fixed TypedArray slots matter because the alternative — allocating a pointer object per event — creates GC pressure on a 4GB device, and a GC pause during a 16.6ms frame is a visible stutter.

```js
const MAXP=4;
const P={id:new Int32Array(MAXP),x:new Float32Array(MAXP),y:new Float32Array(MAXP),
  sx:new Float32Array(MAXP),sy:new Float32Array(MAXP),down:new Uint8Array(MAXP),
  fresh:new Uint8Array(MAXP),claim:new Int8Array(MAXP)};
P.id.fill(-1); P.claim.fill(-1);
const R={l:0,t:0,kx:1,ky:1};
function measure(c){const r=c.getBoundingClientRect();
  R.l=r.left;R.t=r.top;R.kx=c.width/r.width;R.ky=c.height/r.height;}
function slot(id){for(let i=0;i<MAXP;i++)if(P.id[i]===id)return i;return -1;}

function attach(c){
  measure(c);
  addEventListener('resize',()=>measure(c),{passive:true});
  addEventListener('orientationchange',()=>setTimeout(()=>measure(c),100),{passive:true});
  const O={passive:false};
  c.addEventListener('pointerdown',e=>{e.preventDefault();
    if(slot(e.pointerId)!==-1)return;
    let i=-1;for(let k=0;k<MAXP;k++)if(P.id[k]===-1){i=k;break;}
    if(i<0)return;
    try{c.setPointerCapture(e.pointerId);}catch(_){}
    const x=(e.clientX-R.l)*R.kx,y=(e.clientY-R.t)*R.ky;
    P.id[i]=e.pointerId;P.x[i]=x;P.y[i]=y;P.sx[i]=x;P.sy[i]=y;
    P.down[i]=1;P.fresh[i]=1;P.claim[i]=-1;},O);
  c.addEventListener('pointermove',e=>{e.preventDefault();
    const i=slot(e.pointerId);if(i<0)return;
    let ex=e.clientX,ey=e.clientY;
    if(e.getCoalescedEvents){const q=e.getCoalescedEvents();
      if(q.length){const L=q[q.length-1];ex=L.clientX;ey=L.clientY;}}
    P.x[i]=(ex-R.l)*R.kx;P.y[i]=(ey-R.t)*R.ky;},O);
  const up=e=>{e.preventDefault();const i=slot(e.pointerId);if(i<0)return;
    P.down[i]=0;P.id[i]=-1;P.claim[i]=-1;};
  c.addEventListener('pointerup',up,O);
  c.addEventListener('pointercancel',up,O);   // MIUI steals gestures — treat as up
  c.addEventListener('contextmenu',e=>e.preventDefault());
}
function endFrame(){for(let i=0;i<MAXP;i++)P.fresh[i]=0;}
```

## Pointer arbitration — one finger must not drive two controls

**Recomendacion:** Add a `claim` byte per pointer slot. Each control only adopts a pointer whose claim is -1, and stamps its own id on adoption. Run the update functions in a fixed priority order each frame (buttons, then stick, then drag) and clear all `fresh` flags at the very end of the frame with `endFrame()`.

**Por que:** Without this, a right-thumb tap that lands inside both a button's padded hit area and the drag region fires both — the player shoots and the ship teleports. The `fresh` flag (set on pointerdown, cleared at end of frame) is what makes controls edge-triggered: a control may only *adopt* a pointer on the frame it went down, so a finger that starts on empty canvas can never later slide onto a button and press it. This is the behavior players expect from every console game. I verified the arbitration: a stick that claims pointer 0 causes a button overlapping that same point to correctly report not-pressed, while a genuine second thumb on the button registers.

```js
// per frame, fixed order:
btnUpdate(fireBtn);        // claim = 2
stickUpdate(stick, W*0.5); // claim = 1, left half only
dragUpdate(drag, W,H,hw,hh);
endFrame();                // clears every P.fresh[i]

// inside each: only adopt if unclaimed and fresh
if(P.down[i] && P.fresh[i] && P.claim[i]<0){ /* adopt */ P.claim[i]=MY_ID; }
```

## Killing every browser interference (CSS + JS)

**Recomendacion:** Apply `touch-action:none` and `overscroll-behavior:none` (on html AND body — html alone is what kills pull-to-refresh), `user-select:none`, `-webkit-touch-callout:none`, and `-webkit-tap-highlight-color:transparent`. Add `<meta name=viewport content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">` to stop double-tap zoom. Lock the body to `position:fixed;overflow:hidden` at 100% so there is nothing scrollable at all. preventDefault() on contextmenu kills long-press. For the MIUI back-gesture edge swipe, keep all interactive controls out of a ~24px inset on both screen edges — see the pitfall note, you cannot block it from JS.

**Por que:** These are independent mechanisms and each needs its own switch: touch-action stops scroll/zoom gesture interception at the compositor, overscroll-behavior:none stops pull-to-refresh and the blue overscroll glow, maximum-scale/user-scalable stops double-tap-zoom, -webkit-touch-callout stops the image/text long-press callout, and contextmenu stops the long-press menu. MDN explicitly notes overscroll-behavior applies only to scroll containers, which is why it goes on html (and body for safety) rather than the canvas. `position:fixed` on body additionally prevents the MIUI address-bar show/hide reflow, which would otherwise resize your canvas mid-game.

```js
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">

html,body{
  margin:0;padding:0;width:100%;height:100%;
  overflow:hidden;position:fixed;overscroll-behavior:none;
  background:#000;
  touch-action:none;
  user-select:none;-webkit-user-select:none;
  -webkit-touch-callout:none;
  -webkit-tap-highlight-color:transparent;
}
canvas{
  display:block;touch-action:none;
  -webkit-user-select:none;user-select:none;
  -webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
  outline:none;
}

// JS belt-and-braces
document.addEventListener('gesturestart',e=>e.preventDefault());   // pinch
document.addEventListener('dblclick',e=>e.preventDefault());
document.addEventListener('selectstart',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>e.preventDefault());
// last-resort scroll block; passive:false is required for preventDefault to count
document.addEventListener('touchmove',e=>{if(e.cancelable)e.preventDefault();},{passive:false});
```

## Floating virtual joystick — spawns under the thumb

**Recomendacion:** Spawn the stick origin at the exact pointerdown position in the left half of the screen. Dead zone 0.18 of max radius; max radius 90 canvas px (at 1080-wide backbuffer). Rescale magnitude as `(n-dead)/(1-dead)` after the dead zone so output ramps from 0 smoothly rather than snapping to 0.18. When the thumb exceeds max radius, DRAG the origin along behind it rather than just clamping — the stick then stays centered under the moving thumb and never feels stuck.

**Por que:** A fixed stick fails on a 6.43" phone because the thumb lands in a different spot every time she picks the phone up; a floating stick has no wrong place to touch, which suits a casual player who never reads a tutorial. The (n-dead)/(1-dead) rescale is the detail most implementations miss — without it the character jumps to 18% speed the instant it leaves the dead zone. Origin-dragging is what separates a good mobile stick from a frustrating one: on a long swipe the thumb otherwise wanders far from the spawn point and direction changes become sluggish. I verified numerically across a full 360-degree sweep at all radii: output magnitude peaks at exactly 1.000000 and never exceeds it, diagonals give a clean 0.707/0.707, and the origin correctly trails a 300px overshoot.

```js
function Stick(dead,maxr){return{dead,maxr,slot:-1,ox:0,oy:0,x:0,y:0,mag:0,on:false};}
const stick=Stick(0.18,90);

function stickUpdate(S,halfW){
  if(S.slot>=0&&!P.down[S.slot]){S.slot=-1;S.on=false;S.x=S.y=S.mag=0;}
  if(S.slot<0){
    for(let i=0;i<MAXP;i++)
      if(P.down[i]&&P.fresh[i]&&P.claim[i]<0&&P.sx[i]<halfW){
        S.slot=i;P.claim[i]=1;S.ox=P.sx[i];S.oy=P.sy[i];S.on=true;break;}
  }
  if(S.slot<0)return;
  const i=S.slot;
  let dx=P.x[i]-S.ox, dy=P.y[i]-S.oy, d=Math.hypot(dx,dy);
  if(d>S.maxr){                      // drag origin behind the thumb
    const s=S.maxr/d;
    S.ox+=dx*(1-s); S.oy+=dy*(1-s);
    dx*=s; dy*=s; d=S.maxr;
  }
  const n=d/S.maxr;
  if(n<S.dead){S.x=S.y=S.mag=0;return;}
  const t=(n-S.dead)/(1-S.dead), inv=1/d;
  S.x=dx*inv*t; S.y=dy*inv*t; S.mag=t;   // unit vector * eased magnitude
}

// draw only while active; base ring at (ox,oy), knob at (ox+x*maxr, oy+y*maxr)
// 8-bit look: stroked squares/rings, no gradients, alpha ~0.35
```

## Action buttons — size, placement, padded hit area

**Recomendacion:** Visual radius 44 CSS px (88px diameter) with hit radius = visual + 22px. Absolute floor for the visual is 48x48 CSS px per Material; 88 is deliberately far above it because this is a fast action game, not a form. Place buttons on a thumb arc centered roughly at the bottom-right corner, radius 150-260px, and keep the arc's bottom edge >= 90px above the screen bottom to clear the MIUI gesture bar. Separate adjacent buttons by >= 8px of gap (Material's stated minimum) — in practice use 24px.

**Por que:** Material Design specifies a 48x48dp minimum, about 9mm physical, matching the average adult finger pad; Apple HIG says 44x44pt and WCAG 2.5.5 (AAA) says 44x44 CSS px, so 44-48 is the well-corroborated floor across all three. Those are accessibility minimums for deliberate taps, though — an action game needs targets hit without looking, under time pressure, so the visual goes well above the floor and the invisible hit area extends past it. The padded hit area specifically fixes the near-miss: the thumb rolls slightly off the drawn circle, the player is certain they pressed it, and nothing happens. Padding costs nothing visually and eliminates that whole class of complaint. Since the thumb pivots at the base joint, a circular arc around the bottom corner is the genuinely reachable region on a 6.43" screen — buttons high on the screen or in the far top corners require regripping.

```js
// canvas backbuffer 1080 wide; if CSS width is also ~1080/DPR these are ~1:1 CSS px
function Btn(cx,cy,r,pad){return{cx,cy,r,hit:r+(pad||22),slot:-1,down:false,pressed:false};}

function btnUpdate(b){
  b.pressed=false;                                   // one-frame edge trigger
  if(b.slot>=0&&!P.down[b.slot]){b.slot=-1;b.down=false;}
  if(b.slot<0){
    for(let i=0;i<MAXP;i++)
      if(P.down[i]&&P.fresh[i]&&P.claim[i]<0){
        const dx=P.sx[i]-b.cx, dy=P.sy[i]-b.cy;
        if(dx*dx+dy*dy<=b.hit*b.hit){                // squared — no sqrt
          b.slot=i;P.claim[i]=2;b.down=true;b.pressed=true;break;}
      }
  }
}

// thumb-arc layout, bottom-right pivot
const PIVOT_X=W-70, PIVOT_Y=H-70;
function arcBtn(angleDeg,dist,r){
  const a=angleDeg*Math.PI/180;
  return Btn(PIVOT_X-Math.cos(a)*dist, PIVOT_Y-Math.sin(a)*dist, r, 22);
}
const fire   = arcBtn(90,190,44);  // straight up from pivot
const dash   = arcBtn(35,205,38);  // up-left, secondary
// b.pressed = fired this frame; b.down = held (autofire)
```

## Drag-to-move with vertical offset (shooter, brick-breaker)

**Recomendacion:** Use ABSOLUTE mapping, not relative delta accumulation: `sprite.x = finger.x; sprite.y = finger.y - LIFT;` with LIFT = 110 canvas px, then clamp to the play area. Do not accumulate deltas. For brick-breaker lock the Y axis entirely and map only X. Critically, do NOT write it as a relative delta with the lift subtracted from both terms — the lift algebraically cancels and silently does nothing.

**Por que:** The lift moves the sprite above the fingertip so the thumb never covers the thing being aimed — standard in every mobile bullet-hell (Dodonpachi, Cygni) — and 110px at this DPI is roughly a finger-pad width plus margin, enough that the sprite and incoming fire stay visible. Absolute beats relative here for a specific verified reason: with clamping at the play-area edges, relative accumulation drifts. I simulated a finger walking to the top wall and back — absolute re-syncs to the correct position immediately on the way back, while relative ends up offset from where it should be, because the deltas spent pushing into the wall were absorbed by the clamp and never returned. That drift is exactly the 'my ship doesn't line up with my thumb anymore' complaint. Absolute is also strictly less code and is genuinely 1:1 forever. I found and fixed a real bug in my own first draft of this: `py += (finger - LIFT - prev + LIFT)` cancels the LIFT terms completely, so the offset appears implemented but has zero effect — verified it applies the raw delta.

```js
function Drag(lift){return{lift,slot:-1,x:0,y:0,on:false};}
const drag=Drag(110);

function dragUpdate(D,W,H,hw,hh){
  if(D.slot>=0&&!P.down[D.slot]){D.slot=-1;D.on=false;}
  if(D.slot<0){
    for(let i=0;i<MAXP;i++)
      if(P.down[i]&&P.claim[i]<0){D.slot=i;P.claim[i]=3;D.on=true;break;}
  }                       // note: no `fresh` test — thumb may already be down
  if(D.slot<0)return;
  const i=D.slot;
  const x=P.x[i], y=P.y[i]-D.lift;      // ABSOLUTE + lift
  D.x = x<hw?hw:(x>W-hw?W-hw:x);
  D.y = y<hh?hh:(y>H-hh?H-hh:y);
}
// verified: finger y=2000, lift 110 -> sprite y=1890; finger y=100 -> clamps to 20

// brick-breaker: X only
function paddleUpdate(D,W,halfW){
  /* same adopt logic */
  const x=P.x[D.slot];
  D.x = x<halfW?halfW:(x>W-halfW?W-halfW:x);
}

// WRONG — the lift cancels out and does nothing:
// D.y += (P.y[i] - LIFT - D.prevY + LIFT) * RATE;
```

## Input latency reduction

**Recomendacion:** Register every game listener with `{passive:false}` and call preventDefault. Never call getBoundingClientRect, read offsetWidth, or touch the DOM inside a handler — cache the rect once and refresh only on resize/orientationchange. Handlers should only write numbers into the TypedArrays; all game logic happens in the rAF tick. Use `getCoalescedEvents()` and take the last entry. Get the 2D context with `{alpha:false, desynchronized:true}`. Drive everything from a single rAF loop with a clamped delta.

**Por que:** passive:false is mandatory because a passive listener cannot preventDefault, so the compositor keeps a scroll/zoom gesture alive and adds a delay before committing pointermove to your handler. Calling getBoundingClientRect inside a pointermove forces a synchronous style+layout recalc on every event — at 60-120 input events/sec on an Adreno 612 that is the classic layout-thrash stall. Splitting event-capture from simulation means N queued moves in one frame cost N array writes rather than N physics steps. getCoalescedEvents matters because the touch digitizer samples faster than 60Hz and Chrome batches the extras; the last entry is the freshest true position. alpha:false lets the compositor skip per-pixel blending of the canvas over the page, and desynchronized:true opts into a lower-latency present path — both are meaningful on a mid-range 2020 GPU.

```js
const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
ctx.imageSmoothingEnabled=false;               // crisp 8-bit pixels

// backbuffer sized once, integer scale; NOT resized per frame
function fit(){
  const dpr=Math.min(devicePixelRatio||1,2);   // cap DPR: 4GB device, fill-rate bound
  canvas.width=Math.round(innerWidth*dpr);
  canvas.height=Math.round(innerHeight*dpr);
  canvas.style.width=innerWidth+'px';
  canvas.style.height=innerHeight+'px';
  measure(canvas);
}

let last=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000; last=now;
  if(dt>0.05)dt=0.05;                          // clamp after a stall
  btnUpdate(fire); stickUpdate(stick,W*0.5); dragUpdate(drag,W,H,hw,hh);
  step(dt);
  render();
  endFrame();                                  // clear fresh flags LAST
}
requestAnimationFrame(frame);
```

## Haptics via navigator.vibrate on MIUI

**Recomendacion:** Use short single pulses: 12-18ms for a hit/bullet-impact, 25ms for a pickup, and a pattern like [40,60,120] for death. Never vibrate more than ~10 times/sec — gate it with a cooldown timer. Wrap every call in try/catch, feature-detect `navigator.vibrate`, fire the first one only after a real user gesture, and ship an in-game toggle defaulting to ON. Treat it strictly as a bonus: the game must feel complete with vibration entirely absent.

**Por que:** navigator.vibrate is supported in Chrome/WebView on Android and this device has a vibration motor, but on MIUI it is genuinely unreliable for reasons outside your code: MIUI gates haptics behind system settings, there is a documented MIUI bug where haptic feedback fails to activate, and Xiaomi runs several independent vibration channels so the user may have one enabled and another off. Chrome also requires a prior user gesture and silently ignores vibrate on a backgrounded tab. So it can no-op with no error on a perfectly healthy phone. Short pulses are what read as 'impact' on the ERM motor in a Redmi Note 10 — anything under ~10ms may not spin the mass up enough to be felt, and long buzzes feel cheap and drain battery. The cooldown matters because a shooter firing 10 bullets/sec would otherwise queue a continuous buzz, which both feels bad and, per spec, cancels the previous pattern each call.

```js
const HAP={on:true, last:0, gate:80};   // ms between pulses
const CAN_VIBE = typeof navigator!=='undefined' &&
                 typeof navigator.vibrate==='function';

function vibe(pattern,now){
  if(!HAP.on||!CAN_VIBE)return;
  if(now-HAP.last<HAP.gate)return;       // rate limit
  HAP.last=now;
  try{ navigator.vibrate(pattern); }catch(_){}   // never let it throw
}

const HIT=14, PICKUP=25, HURT=[30,40,30], DEATH=[40,60,120];
vibe(HIT,now);          // bullet connects
vibe(DEATH,now);        // player dies

// stop everything on pause/background
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ try{CAN_VIBE&&navigator.vibrate(0);}catch(_){} }
});
```

## Pitfalls

- The MIUI back-gesture edge swipe CANNOT be blocked from a web page — it is intercepted by the system before the WebView sees it, and no CSS or JS defeats it. The only real mitigation is layout: keep the joystick spawn zone, all buttons, and the drag region inside a ~24px safe inset from both left and right screen edges, and combine `viewport-fit=cover` with `env(safe-area-inset-*)` padding. If Romina's thumb habitually rests at the very edge, a floating stick spawned there will be eaten by the back gesture mid-game.
- Registering BOTH pointer and touch listeners double-fires every input. Pick Pointer Events and delete all touch handlers — this is the most common cause of 'the ship moves twice as fast as my thumb'.
- In drag-to-move, writing the lift as a relative delta (`y += finger - LIFT - prev + LIFT`) algebraically cancels the LIFT to zero. It looks implemented, reviews fine, and does nothing. I hit this in my own first draft and verified the cancellation. Use absolute mapping.
- Relative delta accumulation plus edge clamping causes permanent drift: deltas spent pushing into a wall are swallowed by the clamp and never given back, so the sprite no longer lines up with the thumb. Verified by simulation — absolute mapping re-syncs instantly, relative does not.
- `passive:true` (or omitting the option, since Chrome defaults touchstart/touchmove on the document to passive) makes preventDefault a silent no-op and reintroduces scroll latency. Always pass `{passive:false}` explicitly on game input listeners.
- Calling getBoundingClientRect() inside pointermove forces a sync layout on every event — the classic latency killer. Cache the rect; refresh on resize and (with a ~100ms delay) on orientationchange, since MIUI reports stale dimensions immediately after rotation.
- overscroll-behavior on the canvas alone does nothing — MDN notes it applies only to scroll containers. It must go on `html` (and `body`) to stop pull-to-refresh.
- Forgetting `pointercancel` leaves a ghost stuck-on pointer: MIUI fires cancel (not up) when the system grabs a gesture, notification shade, or call. The character then runs into a wall forever. Handle it exactly like pointerup.
- Without `setPointerCapture`, a thumb sliding past the canvas edge stops delivering pointermove and the stick freezes at its last value.
- Without a per-pointer claim flag and edge-triggered `fresh` adoption, one thumb can drive two controls simultaneously, and a finger that started on empty canvas can slide onto a button and trigger it — neither is what a player expects.
- navigator.vibrate can silently no-op on a healthy MIUI device (system haptics off, known MIUI activation bug, separate Xiaomi vibration channels, no prior user gesture, or backgrounded tab). Never gate game feedback on it — always pair haptics with a visual flash and a synthesized sound.
- Uncapped devicePixelRatio on a 1080x2400 screen means a ~3x backbuffer and roughly 7.8M pixels per frame; the Adreno 612 will not hold 60fps. Cap DPR at 2 (1.5 is often enough for pixel art) and keep imageSmoothingEnabled=false.
- Allocating objects or arrays inside pointer handlers or the per-frame update creates GC pressure on a 4GB phone; a collection during a frame is a visible hitch. Preallocate TypedArrays and mutate in place.
- Omitting `maximum-scale=1,user-scalable=no` leaves double-tap-zoom active — a fast double-tap to fire will zoom the whole game instead.
