# CARRION research: locomotion

## Manifest: it is ALREADY unlocked — do not change screenOrientation; the lock is in JS

**Recomendacion:** Do NOT edit android:screenOrientation. The file at C:/Users/ander/OneDrive/Pictures/Juegos Romina/android/app/src/main/AndroidManifest.xml ALREADY reads android:screenOrientation="fullSensor" with android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation". The brief's claim that it is "portrait" is stale. Keep fullSensor: the Activity must be allowed to rotate, because per-game portrait locking is done from the web layer. Make exactly two changes: (1) delete android:resizeableActivity="false" (harmless on a phone, but it suppresses the resize path if the device ever enters multi-window/freeform, and Android 12+ ignores it for large screens anyway); (2) nothing else. Because configChanges already lists orientation|screenSize, Android does NOT recreate the Activity on rotation — the WebView is resized in place, the JS heap survives, and the game keeps running. That is exactly what live rotation needs: if the Activity were recreated, index.html would reload and the run would be lost. Verify with: grep -n 'screenOrientation\|configChanges\|resizeableActivity' on that path. The manifest is therefore correct as-is apart from the resizeableActivity line.

**Por que:** I read the manifest rather than trusting the brief. It is already fullSensor with configChanges covering orientation and screenSize. Changing it to 'portrait' would make the JS unlock() a no-op — the Android-level lock always wins over screen.orientation.lock, and there is no web API that can widen the OS-permitted orientation set. So the only workable architecture is: manifest permissive, JS restrictive, which is what the code already does.

```js
<!-- android/app/src/main/AndroidManifest.xml -->
<activity
    android:screenOrientation="fullSensor"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
    android:name=".MainActivity"
    android:label="@string/title_activity_main"
    android:theme="@style/AppTheme.NoActionBarLaunch"
    android:launchMode="singleTask"
    android:exported="true">
<!-- REMOVE android:resizeableActivity="false" ; keep everything else -->
```

## screen.orientation.lock/unlock: it rejects outside fullscreen — you need a fallback lock

**Recomendacion:** Keep the existing try/catch in setRotatable but make it correct and observable. Three failure modes must be handled: (a) screen.orientation is undefined (old WebView) — do nothing, accept that all four games rotate; (b) lock() returns a Promise that REJECTS with NotSupportedError/SecurityError because the document is not fullscreen (this is the common Android WebView case) — swallow it, but set a flag lockFailed=true; (c) lock() throws synchronously. When lockFailed is true, the three portrait-only games must still not break: they must letterbox gracefully, which fit() already does (Math.min ratio gives pillarboxing in landscape, black bars, no crash). Do NOT try to force fullscreen just to make lock() work — requestFullscreen needs a user gesture, and a Capacitor WebView is already effectively fullscreen so lock() usually resolves anyway. Always call unlock() before lock() to clear a stale lock, and never call lock() inside a rAF frame (it can force a synchronous layout).

**Por que:** screen.orientation.lock is specified to reject unless the document is fullscreen or the platform grants it; Chrome on Android grants it for installed/fullscreen contexts and rejects otherwise. Capacitor's WebView typically satisfies it, but it is not guaranteed across MIUI versions, so the portrait games must degrade to letterboxing rather than depending on the lock. The existing code already swallows the rejection; it just needs the flag so the failure is visible in a test.

```js
// core.js — replace the existing lock block inside setRotatable
export let lockFailed = false;

function applyOrientationLock(rot) {
  const so = (typeof screen !== 'undefined') && screen.orientation;
  if (!so || !so.lock) { lockFailed = true; return; }   // WebView viejo: se acepta el giro
  try {
    if (rot) {
      if (so.unlock) so.unlock();                        // libera: este juego gira
      lockFailed = false;
    } else {
      const p = so.lock('portrait');                     // los otros tres: vertical
      if (p && p.then) p.then(() => { lockFailed = false; },
                              () => { lockFailed = true; });  // fuera de fullscreen: rechaza
    }
  } catch (e) { lockFailed = true; }                     // lanza sincrono en algunos WebView
}
```

## applyOrientation() has a latent bug: setVirtual's early-return skips onRotate on first arm

**Recomendacion:** Rewrite applyOrientation so the source of truth for the game's canonical size is a stored pair (baseLong, baseShort) captured when setRotatable(true) is called, NOT derived from the current VW/VH each time. As written, applyOrientation() reads Math.max(VW,VH) of the LIVE values, which happens to be idempotent, but it has two real defects: (1) if the game is armed while the phone is already landscape, setVirtual is called and onRotate fires — correct; but if it is armed in portrait when VW/VH already equal 540x1200, the `if (w!==VW||h!==VH)` guard is false, onRotate NEVER fires, and the game never receives its initial layout callback; (2) fit() is skipped on that path too. Fix: always invoke onRotate on arm, and always call fit() after a resize event even when the virtual size did not change (the CSS box changed even if the backbuffer did not — e.g. the status bar appearing changes innerHeight and view.scale/ox/oy must be recomputed, or every touch coordinate is silently offset).

**Por que:** fit() recomputes view.scale/ox/oy which input.js:toVirtual divides by. A resize that does not flip the aspect (keyboard, status bar, MIUI gesture bar) still changes innerWidth/innerHeight, so skipping fit() would leave every pointer coordinate mis-mapped. This is the classic 'touches are offset after rotation' bug and it is one line.

```js
// core.js — reemplaza el bloque de rotacion entero
let rotatable = false, onRotate = null;
let baseLong = 0, baseShort = 0;   // tamano canonico del juego, fijado al armar

export function setRotatable(on, cb) {
  rotatable = !!on;
  onRotate = cb || null;
  if (rotatable) {
    baseLong  = Math.max(VW, VH);
    baseShort = Math.min(VW, VH);
  }
  applyOrientationLock(rotatable);
  if (rotatable) applyOrientation(true);   // true = forzar callback aunque no cambie
  else fit();
}

export function isLandscape() {
  // orientation.type es la fuente fiable; innerWidth miente a mitad de animacion
  const so = (typeof screen !== 'undefined') && screen.orientation;
  if (so && typeof so.type === 'string') return so.type.indexOf('landscape') === 0;
  return window.innerWidth > window.innerHeight;
}

function applyOrientation(force) {
  if (!rotatable) return false;
  const land = isLandscape();
  const w = land ? baseLong : baseShort;
  const h = land ? baseShort : baseLong;
  const changed = (w !== VW || h !== VH);
  if (changed) setVirtual(w, h);           // setVirtual ya llama fit()
  if ((changed || force) && onRotate) onRotate(w, h, land);
  return changed;
}

export function fitAndOrient() {
  const changed = applyOrientation(false);
  if (!changed) fit();   // SIEMPRE refit: view.scale/ox/oy alimentan toVirtual()
}
```

## Android WebView / MIUI: event order, wrong innerWidth, and the exact debounce listener

**Recomendacion:** Use a settle-loop, not a fixed timeout. The observed order on MIUI is: orientationchange fires FIRST (sometimes before innerWidth/innerHeight have updated at all), then 2-5 resize events arrive over roughly 150-400ms as the rotation animation runs, and the final resize can be several frames after the animation visually completes. A single setTimeout(fn,100) — which is what initCanvas does today — lands in the middle of that and reads a half-rotated size. Replace it with: on any resize/orientationchange, record the dimensions and (re)start a timer; only when two consecutive samples 2 frames apart report identical innerWidth/innerHeight, and at least 120ms has passed since the last change, commit the layout. Cap the settle wait at 800ms so a pathological stream still commits. Also listen to screen.orientation's own 'change' event, which is more reliable than window.orientationchange, and to visualViewport resize, which fires on MIUI when the gesture bar animates. Never do layout work inside the rAF frame loop; commit from the debounce timer only, then let the next frame draw.

**Por que:** MIUI 12/13 on a Redmi Note 10 animates rotation and fires resize per animation step; reading innerWidth during that gives transient values like 1080x1080. Committing on a transient value sets the wrong VW/VH, and because setVirtual reassigns canvas.width it also clears the backbuffer and resets imageSmoothingEnabled — producing a visible white flash and blurry output until the next commit. The two-sample-equal settle is the standard robust fix and costs nothing.

```js
// core.js — sustituye los dos addEventListener de initCanvas
let settleT = 0, settleW = 0, settleH = 0, settleStart = 0;
const SETTLE_MS = 120, SETTLE_MAX = 800;

function onViewportChange() {
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  if (!settleStart) settleStart = now;
  settleW = window.innerWidth; settleH = window.innerHeight;
  if (settleT) clearTimeout(settleT);
  settleT = setTimeout(checkSettled, SETTLE_MS);
}

function checkSettled() {
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  const w = window.innerWidth, h = window.innerHeight;
  // MIUI dispara varios resize durante la animacion de giro: solo commiteamos
  // cuando dos muestras seguidas coinciden, o cuando se agota la paciencia.
  if ((w !== settleW || h !== settleH) && (now - settleStart) < SETTLE_MAX) {
    settleW = w; settleH = h;
    settleT = setTimeout(checkSettled, SETTLE_MS);
    return;
  }
  settleT = 0; settleStart = 0;
  fitAndOrient();
}

export function initCanvas(el) {
  canvas = el;
  canvas.width = VW; canvas.height = VH;
  g = canvas.getContext('2d', { alpha: false, desynchronized: true });
  g.imageSmoothingEnabled = false;
  fit();
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  const so = (typeof screen !== 'undefined') && screen.orientation;
  if (so && so.addEventListener) so.addEventListener('change', onViewportChange);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportChange);
  return g;
}
```

## THE BLOCKER: symbiote.js line 18 shadows the live VW/VH bindings with constants

**Recomendacion:** Delete `const VW = 540, VH = 1200;` from C:/Users/ander/OneDrive/Pictures/Juegos Romina/www/js/games/symbiote.js:18 and import the live bindings from core.js instead. This is the single change without which rotation cannot work at all. ES module exports are LIVE bindings: `import { VW, VH } from '../core.js'` re-reads core's `let VW` every access, so sym-world.js (which already imports them at line 11) is ALREADY rotation-correct — all 17 of its VW uses are inside per-frame functions (drawLevel, WorldCam.snap/follow/visible, the offscreen-cull tests at 2076/2125/2166, the offscreen-arrow clip at 1090-1096). symbiote.js is the only file that froze them. Keep a separate pair of constants for the CANONICAL size used in meta and in bake calls: `const CANON_LONG = 1200, CANON_SHORT = 540;` and set meta.vw = CANON_SHORT, meta.vh = CANON_LONG. Then audit every remaining use of VW/VH in symbiote.js (10 sites, listed in the rationale) — each must be evaluated at draw time, not init time.

**Por que:** grep shows symbiote.js:18 `const VW = 540, VH = 1200`. The 10 use sites are: line 51 meta (canonical, keep), 69 the attack Button constructor (init-time — MUST move to a relayout fn), 303 the onInput left/right split at VW*0.52 (evaluated per event, becomes correct automatically once the binding is live), 342 drawGore(...,VW,VH) (per-frame, becomes correct), 378/380 HUD right-aligned text, 382 centered message, 383 the 'EN TUBERIA' banner at VH-200, 398 the 'SALIDA' banner. All the draw-time ones fix themselves; only the Button at line 69 is captured at init and needs an explicit relayout callback.

```js
// symbiote.js — cabecera
import { VW, VH, Pool, makeRng, clamp, cam, Save, setRotatable } from '../core.js';
// BORRAR: const VW = 540, VH = 1200;
const CANON_SHORT = 540, CANON_LONG = 1200;   // tamano canonico, TS=24

export default {
  meta: {
    id:'symbiote', title:'SYMBIOTE', tag:'ESCAPA DEL LAB',
    colors:['#ff2d55','#6b3a94'],
    vw: CANON_SHORT, vh: CANON_LONG,
    rotates: true,
  },

  init(ctx, args) {
    /* ...bake, pools, etc. igual que ahora... */
    this.stick = new Stick(34, 5);
    this.btn   = new Button(0, 0, 56, 18);   // posicion la fija relayout()
    setRotatable(true, (w, h, land) => this.relayout(w, h, land));
    // setRotatable llama relayout() inmediatamente (force=true), asi que el
    // boton queda colocado antes del primer frame.
  },

  destroy() {
    setRotatable(false, null);   // OBLIGATORIO: re-bloquea vertical al salir
  },
```

## The relayout() checklist — everything that must be re-done when the aspect flips

**Recomendacion:** Implement one method, relayout(w,h,land), called by core's onRotate and by nothing else. It must do exactly these things and nothing more. (1) CONTROL POSITIONS: reposition this.btn.x/y from the new w/h — portrait w-96, h-150; landscape w-110, h-96 (thumb sits higher and further in when the phone is held wide). (2) CONTROL ARBITRATION: the onInput left/right split is `ev.x > VW*0.52`; with a live binding this self-corrects, but in landscape a 0.52 split puts the drag zone across 624px which is fine — keep the ratio, do not hardcode a pixel. (3) RELEASE HELD POINTERS: call this.stick.reset() and this.btn.up({id:this.btn.id}) — a finger that was down before the flip is now at a meaningless virtual coordinate and pointercancel is NOT guaranteed to fire on MIUI. This prevents a stuck 'attacking' state. (4) HUD ANCHORS: nothing to store if every HUD call computes from live VW/VH at draw time (lines 378-398 already do once the shadowing const is gone) — so the rule is: never cache a HUD x/y in a field. (5) CAMERA: call this.wcam.snap(L, B.x, B.y) — NOT follow(). snap recomputes maxX/maxY from the new VW/VH and re-centres instantly; leaving the old clamp would let the camera sit past L.pxW-VW and blit garbage past the level canvas edge. (6) OFFSCREEN CANVASES SIZED TO THE SCREEN: there are NONE — verified. The gore layer is world-sized (sym-gore.js:82-85, Math.ceil(pxW/2) x Math.ceil(pxH/2)) and the level canvas is world-sized (sym-world.js:919-920, L.pxW x L.pxH). Both are untouched. If you later add a screen-sized lighting/vignette buffer, it MUST be recreated here. (7) BAKED VIGNETTE/OVERLAY: if you bake a red emergency-light vignette, bake it at max(long,long) square once and blit a centred sub-rect, so it never needs rebaking on rotation. (8) SAFE AREAS: read env(safe-area-inset-*) — in landscape the MIUI gesture bar moves to a side edge, so inset the attack button by a stored this.safeR. (9) DO NOT touch: rope solver state, body position, velocities, pools, gore, RNG, score, level. (10) Reset the frame accumulator is NOT needed — main.js clamps dt to MAX_FRAME=250ms already.

**Por que:** I verified by grep that no offscreen canvas in this game is sized to the screen: gfx.js creates canvases only in bake()/bakeFlash() (sprite-sized), sym-gore.js sizes to world, sym-world.js sizes to world. That is why the flip is cheap — the only screen-sized surface is the main backbuffer, which setVirtual already reallocates. The stuck-pointer release is the non-obvious one: input.js keeps a Map keyed by pointerId and MIUI does not reliably deliver pointercancel across a rotation, so without an explicit reset the attack button latches on.

```js
  relayout(w, h, land) {
    this.land = land;

    // 1+8. Boton de ataque: pulgar derecho, respetando el borde con gestos.
    if (land) { this.btn.x = w - 110; this.btn.y = h - 96; }
    else      { this.btn.x = w - 96;  this.btn.y = h - 150; }

    // 3. Soltar TODO dedo activo: su coordenada virtual ya no significa nada
    //    y MIUI no garantiza pointercancel al girar. Sin esto el ataque se traba.
    this.stick.reset();
    this.btn.id = null; this.btn.pressed = false; this.btn.justPressed = false;

    // 5. Camara: snap recalcula maxX/maxY con el VW/VH nuevo y recentra.
    //    follow() dejaria el clamp viejo y bliteria fuera del canvas del nivel.
    if (this.L && this.B) this.wcam.snap(this.L, this.B.x, this.B.y);

    // 6. No hay ningun canvas offscreen del tamano de pantalla en este juego:
    //    la capa de sangre y el nivel son de MUNDO. Nada que recrear.
    //    Si algun dia se anade un buffer de luz, se recrea AQUI.
  },
```

## What must NOT change — and why the world-space gore layer survives untouched

**Recomendacion:** Assert that rotation is a pure VIEW transform. Nothing in the simulation may read VW/VH. Specifically these must be bit-identical across a flip: body position/velocity (this.B), every rope particle in the verlet solver, all five enemy pools and the bullet pool (contents and .n), the gore layer canvas and its poolGrid Int8Array, this.rnd's internal xorshift32 state, this.score, this.totalKills, this.level, and L (tiles, rooms, pipes, spawn, exit). The gore layer is SAFE BY CONSTRUCTION: sym-gore.js:82 sizes it Math.ceil(L.pxW/2) x Math.ceil(L.pxH/2) — level dimensions, never screen — and stamp() at line 108 writes at Math.round(x/2 - w/2) in world coordinates. drawGore (line 135) takes vw,vh as ARGUMENTS and derives its source rect from camX/camY, so passing the new VW/VH is the entire adaptation; the pixels already stamped stay exactly where they are in the world. If the layer had been screen-space instead, a flip would be catastrophic in three separate ways: (a) the canvas would have to be reallocated to the new aspect, destroying every stamp ever made — all blood in the level vanishes mid-play; (b) even without reallocation, blood would be pinned to screen pixels, so it would slide across the world as the camera scrolled, and a stain would sit on a different wall after rotating; (c) the poolGrid tile-merge counter is indexed by world tile (ty*mw+tx) and would desynchronise from a screen-space layer, so pools would stop merging and you would get the ten-identical-circles artefact the comment at line 114 explicitly warns about. Add a runtime assert in dev: capture gore.cv.width/height and rnd() state before and after a synthetic flip and compare.

**Por que:** Read directly from sym-gore.js. makeGoreLayer's only inputs are pxW/pxH; drawGore's vw/vh are parameters not module state. This is precisely the design that makes rotation a non-event for the most expensive persistent surface in the game, and it is worth stating explicitly so nobody 'optimises' it into a screen-sized buffer later.

```js
// Comprobacion de invariantes (solo en pruebas, no en el bucle real)
function snapshotInvariants(game) {
  return {
    bx: game.B.x, by: game.B.y, bvx: game.B.vx, bvy: game.B.vy,
    goreW: game.gore.cv.width, goreH: game.gore.cv.height,
    enemies: game.enemies.n, bullets: game.bullets.n,
    score: game.score, level: game.level,
    rngProbe: game.rnd(),          // consumir 1 valor: el stream debe continuar,
  };                                // no reiniciarse
}
// Tras girar: todo salvo rngProbe debe coincidir exactamente.
```

## Camera: same world AREA reflowed, not more world — and the exact numbers

**Recomendacion:** Show the SAME AMOUNT of world, reflowed. Keep the virtual buffer at 540x1200 portrait and 1200x540 landscape: 648,000 px both ways, identical fill-rate, identical scale (TS stays 24, so a tile is 24 virtual px in both orientations and no sprite ever changes size). Portrait shows 22.5 x 50 tiles; landscape shows 50 x 22.5 tiles. The player gains horizontal sight and loses exactly as much vertical sight — a real tactical trade (landscape is better for corridors and for seeing a flamethrower soldier down a hall; portrait is better for vertical shafts and pipe descents), but no net information advantage, so leaderboards stay comparable. Do NOT scale down to fit more world in landscape: it would shrink the creature below readable size at TS=24 and, worse, break the integer upscale (1200x540 on a 2400x1080 screen is exactly 2x; any other virtual size lands on a fractional scale and imageSmoothingEnabled=false then produces uneven pixel widths, which on a pixel-art game is immediately visible). Also adjust the WorldCam dead zone per orientation: it is currently DZW=108, DZH=240 (sym-world.js:1140), tuned for portrait and for a pendulum that no longer exists. For the new flowing locomotion use DZW=90, DZH=140 portrait and DZW=160, DZH=80 landscape — always roughly 1/6 of the viewport on each axis — and keep LOOK=88 in both.

**Por que:** Two independent constraints agree. Fairness: equal area means neither orientation is the 'correct' way to hold the phone, so the user can rotate for comfort without feeling he is playing wrong. Fill-rate: the Adreno 612 is filling 648,000 virtual px then upscaling 2x to 2,592,000 screen px; the level blit is one 9-arg drawImage of the visible rect plus one for gore, so cost is proportional to VW*VH and holding the product constant holds the frame budget constant. The existing core applyOrientation already implements exactly this (swaps long/short, preserving area) — the decision is to keep that, not to change it.

```js
// sym-world.js — WorldCam.follow, zona muerta dependiente de la orientacion
follow(L, x, y, vx, vy, dt) {
  this.maxX = Math.max(0, L.pxW - VW);
  this.maxY = Math.max(0, L.pxH - VH);
  // ~1/6 del viewport en cada eje: se reparte solo al girar, sin casos especiales
  const DZW = Math.round(VW / 6), DZH = Math.round(VH / 6), LOOK = 88, SPD = 900;
  const sp = Math.sqrt(vx * vx + vy * vy);
  const k = sp > 1 ? Math.min(1, sp / SPD) / sp : 0;
  const tax = vx * k * LOOK, tay = vy * k * LOOK;
  const s = Math.min(1, 0.12 * dt * 60);
  this.lax += (tax - this.lax) * s;
  this.lay += (tay - this.lay) * s;
  /* ...resto igual... */
}
```

## Test plan: drive rotation headlessly and assert the invariants

**Recomendacion:** Use Puppeteer against the existing serve.js (C:/Users/ander/OneDrive/Pictures/Juegos Romina/serve.js). Rotation cannot be triggered natively headless, so drive it at the two seams the code actually listens to: page.setViewport({width,height}) which fires a real window resize, plus an injected override of screen.orientation.type/angle so isLandscape() reads the same thing the device would. Assertions, in order: (A) after setViewport(1080,2400) the canvas backbuffer is 540x1200; after setViewport(2400,1080) it is 1200x540 — proves setVirtual ran. (B) g.imageSmoothingEnabled === true is NEVER observed: assign canvas.width resets it, so assert it is false immediately after each flip — this is the silent-blur regression and it is the single most likely thing to break. (C) view.scale is exactly 2 in both orientations and view.ox/oy are integers — proves the integer upscale survived. (D) snapshot body position, pool counts, gore.cv.width/height, score and level before and after 20 alternating flips and assert every field is identical — proves the flip is a pure view change. (E) fire pointerdown, flip, then assert stick.active===false and btn.pressed===false — proves the stuck-finger fix. (F) drive 40 rapid resizes 20ms apart simulating the MIUI animation storm and assert setVirtual was invoked at most twice — proves the debounce. (G) assert wcam.x <= L.pxW-VW and wcam.y <= L.pxH-VH after a flip — proves the camera clamp was recomputed and will not blit past the level canvas. Instrument by exposing window.__sym = the live game object under a debug flag.

**Por que:** Every assertion maps to a specific line I read: (B) to core.js setVirtual which must re-set imageSmoothingEnabled after reassigning canvas.width; (C) to fit(); (D) to the world-space gore design; (E) to input.js's pointer Map; (G) to WorldCam.snap's maxX/maxY. A test that only checks 'it did not crash' would miss all five.

```js
// test/rotate.test.mjs — node test/rotate.test.mjs (puppeteer + serve.js)
import puppeteer from 'puppeteer';
const assert = (c, m) => { if (!c) throw new Error('FALLO: ' + m); };

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

// screen.orientation no existe util en headless: lo suplantamos ANTES de cargar
await page.evaluateOnNewDocument(() => {
  let type = 'portrait-primary';
  Object.defineProperty(screen, 'orientation', {
    configurable: true,
    value: {
      get type() { return innerWidth > innerHeight ? 'landscape-primary' : 'portrait-primary'; },
      get angle() { return innerWidth > innerHeight ? 90 : 0; },
      lock: () => Promise.reject(new Error('NotSupportedError')), // el caso feo
      unlock: () => {},
      addEventListener() {}, removeEventListener() {},
    },
  });
  window.__DEBUG_SYM = true;
});

await page.setViewport({ width: 1080, height: 2400 });
await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.evaluate(() => window.__startSymbiote(0xC0FFEE));  // atajo de debug
await new Promise(r => setTimeout(r, 400));

const snap = () => page.evaluate(() => {
  const s = window.__sym, c = document.getElementById('c');
  return {
    cw: c.width, ch: c.height,
    smooth: c.getContext('2d').imageSmoothingEnabled,
    scale: window.__core.view.scale,
    ox: window.__core.view.ox, oy: window.__core.view.oy,
    bx: s.B.x, by: s.B.y,
    goreW: s.gore.cv.width, goreH: s.gore.cv.height,
    enemies: s.enemies.n, score: s.score, level: s.level,
    camX: s.wcam.x, camY: s.wcam.y,
    maxX: s.L.pxW - c.width, maxY: s.L.pxH - c.height,
    stick: s.stick.active, btn: s.btn.pressed,
  };
});

const rotate = async (w, h) => {
  await page.setViewport({ width: w, height: h });
  await new Promise(r => setTimeout(r, 350));   // deja asentar el debounce
};

const a = await snap();
assert(a.cw === 540 && a.ch === 1200, 'vertical debe ser 540x1200');

// E: dedo abajo, luego girar -> debe soltarse
await page.touchscreen.touchStart(200, 900);
await rotate(2400, 1080);
const b = await snap();

assert(b.cw === 1200 && b.ch === 540, 'horizontal debe ser 1200x540');
assert(b.smooth === false, 'imageSmoothingEnabled se perdio al reasignar width');
assert(b.scale === 2, 'la escala entera x2 se rompio');
assert(Number.isInteger(b.ox) && Number.isInteger(b.oy), 'offset no entero');
assert(b.stick === false && b.btn === false, 'dedo trabado tras girar');
assert(b.goreW === a.goreW && b.goreH === a.goreH, 'la capa de sangre se recreo');
assert(b.bx === a.bx && b.by === a.by, 'el cuerpo se movio al girar');
assert(b.enemies === a.enemies && b.score === a.score && b.level === a.level,
       'el estado de juego cambio al girar');
assert(b.camX <= b.maxX && b.camY <= b.maxY, 'clamp de camara no recalculado');

// F: tormenta de resize de MIUI -> el debounce debe colapsarla
await page.evaluate(() => { window.__setVirtualCalls = 0; });
for (let i = 0; i < 40; i++) {
  await page.setViewport({ width: 1080 + (i % 3) * 8, height: 2400 });
  await new Promise(r => setTimeout(r, 20));
}
await new Promise(r => setTimeout(r, 500));
const calls = await page.evaluate(() => window.__setVirtualCalls);
assert(calls <= 2, 'el debounce no colapso la tormenta de resize: ' + calls);

// D: 20 giros alternos no deben derivar nada
for (let i = 0; i < 20; i++) await rotate(i % 2 ? 1080 : 2400, i % 2 ? 2400 : 1080);
const z = await snap();
assert(z.bx === a.bx && z.by === a.by, 'deriva tras 20 giros');

console.log('OK: rotacion verificada');
await browser.close();
```

## Menu and the other three games must re-lock portrait on every scene change

**Recomendacion:** Put the lock decision in main.js's scene flush, not in each game, so it is impossible to forget. In sm.flush(), immediately after setVirtual and before init(), call setRotatable(!!m.rotates, null) — and let the game itself override the callback inside its own init by calling setRotatable(true, cb) again. This guarantees that leaving SYMBIOTE for the Menu or for GameOver re-locks portrait even if symbiote.destroy() never runs (it does run, but defence in depth is free here). Note the ordering hazard: setRotatable(true) when the phone is ALREADY landscape will swap VW/VH during flush, so init() must read ctx.VW/ctx.VH (the getters main.js already provides) rather than the meta values — which is another reason to delete the shadowing const in symbiote.js.

**Por que:** main.js sm.flush() already calls setVirtual(m.vw||BASE_VW, m.vh||BASE_VH) before init, and ctx exposes VW/VH as getters precisely because 'un valor copiado al arrancar se quedaria en 270x600'. Wiring setRotatable into the same place follows the pattern that is already established and makes the portrait guarantee structural.

```js
// main.js — dentro de sm.flush(), tras setVirtual y ANTES de init()
const m = this.cur.meta;
setVirtual(m.vw || BASE_VW, m.vh || BASE_VH);
// Decision estructural: el gestor de escenas manda. Los juegos que no declaran
// rotates vuelven a quedar bloqueados en vertical aunque el anterior girase.
setRotatable(!!m.rotates, null);
if (this.cur.init) this.cur.init(ctx, this.nextArgs);
```

## Pitfalls

- THE BRIEF IS WRONG ABOUT THE MANIFEST. android/app/src/main/AndroidManifest.xml already reads android:screenOrientation="fullSensor", not "portrait", and configChanges already includes orientation|screenSize. Do not 'fix' it to portrait — that would make screen.orientation.unlock() a permanent no-op and kill the feature, since no web API can widen the OS-permitted orientation set. Only remove android:resizeableActivity="false".
- symbiote.js line 18 declares `const VW = 540, VH = 1200`, shadowing core's live exported bindings. Until that line is deleted, NOTHING about rotation can work in this game no matter how correct core.js is — the game will keep drawing a 540-wide HUD into a 1200-wide buffer. sym-world.js is already correct because it imports the live bindings at line 11.
- setVirtual() reassigns canvas.width, which resets the ENTIRE 2D context state — imageSmoothingEnabled, fillStyle, transform, globalAlpha, clip. core.js restores imageSmoothingEnabled but nothing else. If any code ever leaves a transform or clip set across a frame boundary, rotation will silently clear it. Assert imageSmoothingEnabled===false after every flip in tests; it is the classic silent-blur regression.
- The existing `setTimeout(fitAndOrient, 100)` on orientationchange lands in the MIDDLE of the MIUI rotation animation and will read a transient square-ish innerWidth/innerHeight, committing the wrong VW/VH and flashing a cleared backbuffer. It must be replaced by the two-equal-samples settle loop, not merely given a bigger constant.
- applyOrientation() as written never fires onRotate when the game is armed in an orientation whose size already matches, because setVirtual early-returns and the `if (w!==VW||h!==VH)` guard is false. The game then never receives its initial layout and the attack button stays at (0,0). Pass a force flag on arm.
- fit() must run on EVERY resize, even one that does not flip the aspect. view.scale/ox/oy feed input.js toVirtual(); skipping fit() after a status-bar or gesture-bar resize leaves every touch coordinate offset, which reads to the player as 'the controls drifted'.
- MIUI does not reliably deliver pointercancel across a rotation. input.js keeps a Map keyed by pointerId, so a finger held down through a flip leaves Stick.active true and Button.pressed true forever — the creature attacks continuously and drags toward a stale point. relayout() must explicitly reset both.
- Do NOT call wcam.follow() in relayout — call wcam.snap(). follow() reuses the stale maxX/maxY only after recomputing them, but it also smooths toward the target over many frames, during which cam.x can exceed L.pxW-VW and drawLevel's 9-arg drawImage will sample past the level canvas edge (transparent/garbage strip at the screen border).
- Do not let landscape show more world. Beyond the fairness argument, any virtual size other than 540x1200 / 1200x540 breaks the exact 2x integer upscale on the 1080x2400 panel, and with imageSmoothingEnabled=false a fractional scale renders pixels at uneven widths — instantly visible on pixel art.
- screen.orientation.lock() commonly rejects outside fullscreen. Never chain game logic onto its resolution, never await it, and never call requestFullscreen to force it (needs a user gesture). The three portrait games must survive the rejection by letterboxing, which fit()'s Math.min already does.
- Never call getImageData on the gore layer to test rotation — sym-gore.js line 80 warns it costs 5-15ms on a GPU-backed canvas. Verify the layer survived by comparing cv.width/cv.height and stamp counts, not pixels.
- If a red emergency-light vignette or lighting buffer is added later, it is the ONLY screen-sized offscreen surface in the game and would become the one thing rotation must recreate. Bake it square at 1200x1200 and blit a centred sub-rect instead, so rotation stays free.
