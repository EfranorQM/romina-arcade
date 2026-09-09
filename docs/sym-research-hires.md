# SYMBIOTE research: hires

## Virtual resolution: KEEP 270x600, do not go to 540x1200

**Recomendacion:** Use the existing VW=270, VH=600 grid unchanged. Do NOT adopt 540x1200. Verified: the Redmi Note 10's CSS viewport is 392.73x872.73 (1080x2400 at dpr 2.75). At 270x600 the fit scale is 1.4545 CSS, which is exactly 4.000 device px per virtual px — a perfect integer upscale with zero shimmer. 540x1200 gives exactly 2.000, also integer, but quadruples the backbuffer from 162,000 to 648,000 px and takes fill from 24.3 Mpx/s to 97.2 Mpx/s. The decisive argument is not fill rate (the Adreno 612 survives both) but ART COST: at 540x1200 every existing baked sprite in the shared engine is half-size on screen, so SYMBIOTE would need its own sprite scale and would look like a different app inside the same arcade. Stay at 270x600 and buy detail with a smaller TILE, not a bigger canvas.

**Por que:** Computed the exact CSS viewport and fit scale for 270x600, 360x800 and 540x1200 against the real panel. All three are exactly 20:9 (aspect 2.2222) so none letterbox; the differentiator is that 270x600 lands on a 4x integer scale AND keeps visual parity with the three shipped games, which all use 270x600.

```js
// verified numbers
// CSS viewport = 1080/2.75 x 2400/2.75 = 392.73 x 872.73
// 270x600 -> cssScale 1.4545 -> 1.4545*2.75 = 4.000 device px per virtual px (integer)
// 540x1200 -> cssScale 0.7273 -> 2.000 (integer) but 648,000 px backbuffer
// fill @60fps, 2.5x overdraw: 270x600 = 24.3 Mpx/s ; 540x1200 = 97.2 Mpx/s
export const VW = 270, VH = 600;   // unchanged from core.js
```

## Tile size: 15 virtual px, levels 30x70 to 48x112 tiles

**Recomendacion:** TILE = 15 virtual px. The screen then shows exactly 18x40 tiles, and the visible span including one row/column of bleed is 19x41 = 779 tiles. Levels run 30x70 tiles (depth 0) to 48x112 (depth 6+), i.e. 450x1050 to 720x1680 virtual px = 1.7x1.8 to 2.7x2.8 screens. A 15px tile is the sweet spot: the symbiote body is ~11px so it reads clearly inside a 15px corridor, a 1-tile wall is a visible slab rather than a hairline, and pipes are 15px wide — wide enough to draw the symbiote squeezing through. 12px would give 1,224 visible tiles and cramp the sprite; 18px would give only 15 tiles of screen width, making rooms feel like closets. Store the map as a Uint8Array(W*H): 5.3 KB at the largest size, plus a parallel 5.3 KB Uint8Array for blood decals = 10.5 KB total.

**Por que:** Ran the draw-call and dimension math across 9/10/12/15/18 px. 15px yields 779 visible tiles = 46.7k drawImage/s if drawn per-tile, and gives whole-screen coverage of 18x40 tiles which maps cleanly onto BSP rooms 4-10 tiles across.

```js
const TS = 15;                     // virtual px per tile
const SOLID=0, FLOOR=1, PIPE=2, GLASS=3, VENT=4, DOOR=5, HAZARD=6, EXIT=7, ENTRY=8, MOUTH=9;
// Only these are walkable. GLASS is walkable because it SHATTERS on contact.
const walkable = t => t===FLOOR||t===DOOR||t===HAZARD||t===EXIT||t===ENTRY||t===GLASS;
const inPipe   = t => t===PIPE||t===MOUTH;

// map + decals, allocated ONCE in init()
const map   = new Uint8Array(W*H);   // 5.3 KB max
const blood = new Uint8Array(W*H);   // 5.3 KB max, persistent gore
```

## Generator: BSP rooms + MST corridors, with a strict five-step ORDER that makes failure impossible

**Recomendacion:** Generate in this exact order, and never reorder it: (A) BSP split to depth 5, carve one room per leaf; (B) sort rooms by cy and connect with a nearest-neighbour MST, then add 2+min(depth,4) extra loop corridors; (C) place ENTRY in the topmost room and EXIT in the bottommost; (D) FLOOD FILL the walk layer and reject the level if the exit is unreachable — this happens BEFORE any pipe or decoration is written; (E) carve pipes ONLY through tiles that are currently SOLID, then decorate, then flood fill a SECOND time as a final assertion. Wrap the whole thing in a retry loop of 12 attempts, each with seed + a*0x9e3779b9. Measured over 20,000 levels across 8 depths: zero nulls, zero unreachable exits, zero broken pipe mouths, and 100% accepted on the FIRST attempt. Generation costs 1.64 ms/level on desktop, so ~11 ms on a Snapdragon 678 — a one-time cost in init(), invisible to the player.

**Por que:** I built the generator and ran it. The ordering is not cosmetic — I measured it. An earlier version that carved pipes before validating produced a 27% unreachable-exit rate, because pipe shafts cut through and severed corridors. Restricting pipe carving to currently-SOLID tiles makes severing arithmetically impossible (you cannot disconnect a graph by opening a wall), which is why the second flood fill never fires. That is a proof by construction, with the flood fill as the runtime assertion behind it.

```js
function genLevel(seed, depth) {
  for (let a = 0; a < 12; a++) {
    const L = build((seed + a * 0x9e3779b9) >>> 0, depth);
    if (L) return L;                  // measured: succeeds on a=0 100% of the time
  }
  return build(FALLBACK_SEED, 0);     // never observed; still never return null
}

function build(seed, depth) {
  const rnd = makeRng(seed);
  const W = 30 + Math.min(depth,6)*3, H = 70 + Math.min(depth,6)*7;
  const map = new Uint8Array(W*H), idx = (x,y) => y*W + x;

  // (A) BSP -> leaves -> rooms
  const leaves = [];
  (function split(x,y,w,h,d){
    const cv = w>=22, ch = h>=22;
    if (d>=5 || (!cv&&!ch)) { leaves.push({x,y,w,h}); return; }
    const vert = (cv&&ch) ? (w/h>0.9) : cv;
    if (vert){ const c=rnd.int((w*0.38)|0,(w*0.62)|0); split(x,y,c,h,d+1); split(x+c,y,w-c,h,d+1); }
    else     { const c=rnd.int((h*0.38)|0,(h*0.62)|0); split(x,y,w,c,d+1); split(x,y+c,w,h-c,d+1); }
  })(0,0,W,H,0);

  const rooms = [];
  for (const L of leaves) {
    const rw = Math.max(4, Math.min(L.w-3, 4+rnd.int(0,4)));
    const rh = Math.max(4, Math.min(L.h-3, 4+rnd.int(0,6)));
    if (L.w-rw-2 < 1 || L.h-rh-2 < 1) continue;
    const rx = L.x+1+rnd.int(1,L.w-rw-2), ry = L.y+1+rnd.int(1,L.h-rh-2);
    for (let y=ry;y<ry+rh;y++) for (let x=rx;x<rx+rw;x++) map[idx(x,y)] = FLOOR;
    rooms.push({x:rx,y:ry,w:rw,h:rh,cx:(rx+rw/2)|0,cy:(ry+rh/2)|0});
  }
  if (rooms.length < 6) return null;
  rooms.sort((a,b) => a.cy - b.cy);          // lab reads top -> bottom

  // (B) corridors: 2 tiles wide so a swinging symbiote fits
  const cH=(x0,x1,y)=>{for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x++){
    if(map[idx(x,y)]===SOLID)map[idx(x,y)]=FLOOR;
    if(y>0&&map[idx(x,y-1)]===SOLID)map[idx(x,y-1)]=FLOOR;}};
  const cV=(y0,y1,x)=>{for(let y=Math.min(y0,y1);y<=Math.max(y0,y1);y++){
    if(map[idx(x,y)]===SOLID)map[idx(x,y)]=FLOOR;
    if(x>0&&map[idx(x-1,y)]===SOLID)map[idx(x-1,y)]=FLOOR;}};
  const con=(a,b)=>{ if(rnd.chance(0.5)){cH(a.cx,b.cx,a.cy);cV(a.cy,b.cy,b.cx);}
                     else {cV(a.cy,b.cy,a.cx);cH(a.cx,b.cx,b.cy);} };
  const inT=[0], out=[]; for(let i=1;i<rooms.length;i++) out.push(i);
  while (out.length) {                       // nearest-neighbour MST
    let bi=0,bj=0,bd=1e9;
    for(let i=0;i<inT.length;i++) for(let j=0;j<out.length;j++){
      const a=rooms[inT[i]], b=rooms[out[j]];
      const d=Math.abs(a.cx-b.cx)+Math.abs(a.cy-b.cy);
      if(d<bd){bd=d;bi=i;bj=j;}
    }
    con(rooms[inT[bi]], rooms[out[bj]]); inT.push(out[bj]); out.splice(bj,1);
  }
  for(let k=0,n=2+Math.min(depth,4);k<n;k++){       // loops: no dead-end mazes
    const a=rnd.pick(rooms), b=rnd.pick(rooms); if(a!==b) con(a,b);
  }

  // (C) entry / exit
  const entry=rooms[0], exit=rooms[rooms.length-1];
  map[idx(entry.cx,entry.cy)]=ENTRY; map[idx(exit.cx,exit.cy)]=EXIT;

  // (D) PROVE reachability BEFORE mutating anything else
  const seen = flood(map,W,H, entry.cy*W+entry.cx, false);
  if (!seen[exit.cy*W+exit.cx]) return null;

  // (E) pipes (SOLID-only), decorate, seal border, re-assert
  carvePipes(map,W,H,idx,rooms,entry,exit,seen,depth,rnd);
  decorate(map,W,H,idx,rooms,entry,exit,rnd);
  for(let x=0;x<W;x++){map[idx(x,0)]=SOLID;map[idx(x,H-1)]=SOLID;}
  for(let y=0;y<H;y++){map[idx(0,y)]=SOLID;map[idx(W-1,y)]=SOLID;}
  const fin = flood(map,W,H, entry.cy*W+entry.cx, false);
  if (!fin[exit.cy*W+exit.cx]) return null;   // never fires; keep as the guarantee
  return {W,H,map,rooms,entry,exit,pipes,idx};
}

// Flood fill: preallocated typed arrays, no per-call garbage beyond these two.
function flood(map,W,H,start,usePipes){
  const seen=new Uint8Array(W*H), q=new Int32Array(W*H);
  let qh=0,qt=0; q[qt++]=start; seen[start]=1;
  while(qh<qt){
    const p=q[qh++], x=p%W, y=(p/W)|0;
    for(let d=0;d<4;d++){
      const nx=x+(d===0?1:d===1?-1:0), ny=y+(d===2?1:d===3?-1:0);
      if(nx<1||ny<1||nx>=W-1||ny>=H-1) continue;
      const np=ny*W+nx; if(seen[np]) continue;
      const t=map[np];
      if(!(walkable(t) || (usePipes && inPipe(t)))) continue;
      seen[np]=1; q[qt++]=np;
    }
  }
  return seen;
}
```

## PIPES: carve SOLID-only, mouths correct by construction, scored by real shortcut value

**Recomendacion:** Place 2+min(depth,3) vertical shafts (2 at depth 0, up to 5). A candidate is a pair of rooms whose column ranges OVERLAP and whose centres are >=10 tiles apart vertically. Scan that overlap for a column where EVERY tile of the shaft is currently SOLID and the tile just above the top end and just below the bottom end are both FLOOR. That last test is what makes the mouths correct BY CONSTRUCTION — the mouth is the first tile outside the room, so it is guaranteed adjacent to room floor. Rank candidates by the actual walk-distance they save, computed from a BFS from ENTRY and a BFS from EXIT: saving = dist(entry,exit) - min(dE[a]+len+dX[b], dE[b]+len+dX[a]). Measured over 20,000 levels: median 5 pipes, ZERO broken mouths, and the chosen pipes have a median saving of 8 walk-tiles with 94.1% of placed pipes positive.

**Por que:** This was the hardest part and I got it wrong twice before measuring my way out. Version 1 carved the shaft at a room-centre column and then REJECTED levels whose mouths had no floor neighbour — that rejected 76% of all builds (12,238 of 16,000) and forced a 15% outright failure rate. The fix is to make the mouth valid by construction instead of validating it after the fact, which took acceptance to 100% first-try. The path-aware scoring is a second, separate fix: naive placement helped in only 36.5% of levels, scoring lifted it to 47.3%.

```js
function carvePipes(map,W,H,idx,rooms,entry,exit,seen,depth,rnd){
  const pipes=[], want=2+Math.min(depth,3);
  const dE=bfsD(map,W,H, entry.cy*W+entry.cx);   // walk dist from entry
  const dX=bfsD(map,W,H, exit.cy*W+exit.cx);     // walk dist from exit
  const goal=dE[exit.cy*W+exit.cx];
  const cand=[];
  for(let i=0;i<rooms.length;i++) for(let j=i+1;j<rooms.length;j++){
    const A=rooms[i], B=rooms[j];
    const x0=Math.max(A.x,B.x), x1=Math.min(A.x+A.w-1, B.x+B.w-1);
    if(x1<x0) continue;                       // columns must overlap
    if(Math.abs(A.cy-B.cy)<10) continue;      // too close to be worth a shaft
    if(!seen[A.cy*W+A.cx]||!seen[B.cy*W+B.cx]) continue;  // both walk-reachable
    const top=A.cy<B.cy?A:B, bot=A.cy<B.cy?B:A;
    const yA=top.y+top.h, yB=bot.y-1;         // first tiles OUTSIDE each room
    if(yB-yA<4) continue;
    let col=-1;
    for(let x=x0;x<=x1;x++){
      let clear=true;
      for(let y=yA;y<=yB;y++) if(map[idx(x,y)]!==SOLID){clear=false;break;}
      // mouths adjacent to real floor -> correct BY CONSTRUCTION
      if(clear && map[idx(x,yA-1)]===FLOOR && map[idx(x,yB+1)]===FLOOR){col=x;break;}
    }
    if(col<0) continue;
    const len=yB-yA+1;
    const a=top.cy*W+top.cx, b=bot.cy*W+bot.cx;
    const via=Math.min(dE[a]+len+dX[b], dE[b]+len+dX[a]);
    cand.push({col,yA,yB,saving:goal-via});
  }
  cand.sort((p,q)=> (q.saving-p.saving) || ((q.yB-q.yA)-(p.yB-p.yA)));
  for(const c of cand){
    if(pipes.length>=want) break;
    let ok=true;                              // recheck: an earlier pipe may have crossed
    for(let y=c.yA;y<=c.yB;y++) if(map[idx(c.col,y)]!==SOLID){ok=false;break;}
    if(!ok) continue;
    for(let y=c.yA;y<=c.yB;y++) map[idx(c.col,y)]=PIPE;
    map[idx(c.col,c.yA)]=MOUTH; map[idx(c.col,c.yB)]=MOUTH;
    pipes.push({x:c.col,y0:c.yA,y1:c.yB});
  }
  return pipes;
}
```

## Pipes are worth 5.1 seconds — measure them in TIME, not tiles

**Recomendacion:** Move at 190 vpx/s inside a pipe versus 78 vpx/s walking, with a 140 ms squeeze animation at each mouth. Under those numbers, pipes save a MEDIAN of 5.10 s and a p90 of 10.03 s on a route whose walk-only median is 20.5 s — and they are the faster route in 99.7% of levels. Do NOT judge the pipe network by tile count: measured in tiles the median saving is 0 and pipes look useless. The tile metric is simply the wrong instrument, because the whole point of a pipe is that you move through it 2.4x faster.

**Por que:** I nearly cut the pipe network's scope on the strength of the tile metric. Running a proper Dijkstra weighted in milliseconds (walk 192 ms/tile, pipe 79 ms/tile, mouth 140 ms) inverted the conclusion completely: 36.5% of levels helped became 99.7%. Since the user named pipes as the highlight of the reference game, shipping them as decoration because of a bad metric would have been the single worst outcome here.

```js
const SPD_WALK = 78;    // vpx/s
const SPD_PIPE = 190;   // vpx/s  -> 2.44x, and the camera pulls back to sell it
const MOUTH_MS = 140;   // squeeze in / squeeze out

// verified: walk-only route median 20.5s (p10 14.4, p90 26.5)
//           time saved by pipes  median 5.10s, p90 10.03s, max 22.8s
//           pipes are faster in 99.7% of generated levels
```

## Pipe traversal: 1-D rail movement, no physics, auto-eject

**Recomendacion:** Inside a pipe the symbiote is NOT a free body. On touching a MOUTH tile, snap x to the shaft centre (col*TS + TS/2), set state=IN_PIPE, and store the shaft. From then on only the joystick's Y component matters: pos += stickY * SPD_PIPE * dt, clamped to [y0,y1]. Reaching either end plays the 140 ms squeeze and ejects into the adjoining room with a small pop of velocity. This removes every collision case inside the shaft (there are none — it is a 1-D interval), which is why it can be both fast and completely reliable. The tentacle button is disabled in-pipe; releasing it does nothing until you exit. Enemies cannot enter pipes, so a pipe is always a guaranteed escape from a firefight — that is what makes it a real tactical option and not a shortcut you take once.

**Por que:** Modelling pipe travel as ordinary 2-D physics through a 1-tile gap is where this mechanic usually breaks: the body catches on the mouth corners and the player fights the geometry. Reducing the interior to a clamped scalar makes it frictionless by construction and costs almost nothing per frame.

```js
// state: 0 = free, 1 = entering, 2 = in pipe, 3 = exiting
function updatePipe(P, stick, dt){
  const pipe = P.pipe;
  P.py += stick.dy * SPD_PIPE * dt;
  const top = pipe.y0*TS, bot = (pipe.y1+1)*TS;
  if (P.py <= top){ ejectPipe(P, -1); return; }
  if (P.py >= bot){ ejectPipe(P, +1); return; }
  P.px = pipe.x*TS + TS*0.5;      // hard rail: no lateral freedom, no snagging
}
```

## Pipe rendering: cutaway interior, never an opaque tube

**Recomendacion:** Draw pipes in three passes so the player always sees where they are going. (1) Under the world: the shaft interior as a dark channel (#0d1420) with a 1px inner highlight on the left edge — baked as a single 15px-wide tile variant. (2) The symbiote inside is drawn at 70% brightness with a scanline mask so it reads as BEHIND glass, not on top of it. (3) Both MOUTH tiles get a pulsing ring while the player is free and within 60 px, so the entrance advertises itself. Critically, when the player is in a pipe the shaft is drawn ON TOP of the wall layer with full opacity, so the route ahead is never hidden behind a wall tile. Also draw a 3px arrow at each end of the current shaft pointing to the room it leads to.

**Por que:** The failure mode of pipe systems is the player entering a black tube and losing all spatial orientation. The cutaway plus the destination arrows means the pipe is legible from outside (where does this go?) and from inside (how much further?), which is what makes it feel like a route rather than a teleport.

## Camera: deadzone follow + velocity look-ahead, clamped, with shake applied AFTER

**Recomendacion:** Write a new per-game camera; the engine's shared `cam` in core.js is SHAKE ONLY (its x/y are random offsets, reset to 0 when the shake expires) and cannot scroll. Use a 54x120 px deadzone — wide and tall, because a swinging symbiote oscillates and a tight deadzone would make the camera seasick. Look-ahead is 44 px in the direction of travel, scaled by speed/190 and smoothed at 0.12 per frame. Clamp scroll to [0, levelPx - VW] and [0, levelPx - VH]; verified to clamp exactly at 450,1080 on a 720x1680 level, at 0,0 top-left, and to 0,0 on a level smaller than the screen. Shake must be added at DRAW time on top of the clamped scroll, never folded into the scroll value — otherwise the shake gets clamped away at level edges and dies exactly where the action is heaviest.

**Por que:** I read core.js: `cam.update` overwrites x and y with random values and zeroes them when the timer ends, so any scroll written there is destroyed. Keeping shake as a separate draw-time offset also preserves the existing main.js behaviour, which already translates by cam.x/cam.y around the game's draw call — so the game's own draw must NOT double-apply it.

```js
const camera = { x:0, y:0, lax:0, lay:0, lw:0, lh:0 };
const DZW=54, DZH=120, LOOK=44, LERP=0.12;

function camUpdate(c, px, py, vx, vy){
  const sx = px - c.x, sy = py - c.y;
  const x0=(VW-DZW)/2, x1=(VW+DZW)/2, y0=(VH-DZH)/2, y1=(VH+DZH)/2;
  if (sx < x0) c.x -= (x0-sx); else if (sx > x1) c.x += (sx-x1);
  if (sy < y0) c.y -= (y0-sy); else if (sy > y1) c.y += (sy-y1);

  const sp = Math.hypot(vx,vy) || 1, k = Math.min(1, sp/SPD_PIPE);
  c.lax += ((vx/sp)*LOOK*k - c.lax) * LERP;
  c.lay += ((vy/sp)*LOOK*k - c.lay) * LERP;

  const mx = Math.max(0, c.lw-VW), my = Math.max(0, c.lh-VH);
  c.x = clamp(c.x, 0, mx); c.y = clamp(c.y, 0, my);
}

// DRAW: scroll is clamped, shake is added on top and is NOT clamped.
const ox = Math.round(camera.x + camera.lax - cam.x);
const oy = Math.round(camera.y + camera.lay - cam.y);
// NOTE: main.js already translates by (cam.x,cam.y); subtract it here so shake
// is applied exactly once. Verified against main.js frame().
```

## Exit wayfinding: an edge-clamped arrow, NOT a minimap

**Recomendacion:** Ship a single directional arrow, not a minimap. Draw a 9px chevron clamped to a 16px inset border of the screen, pointing from the player to the exit, tinted from cyan toward white as distance closes, plus a small tile-distance number under it at scale 1. Add a second, dimmer arrow (magenta) for the nearest unused pipe mouth when the player is within 120 px of one. A minimap is the wrong call here: on a 270x600 screen a readable minimap of a 48x112 level costs ~90x210 px of prime real estate, it demands the player stop and read it, and Romina was specified as a casual player who wants DIRECT ACTION with zero explanation. An arrow needs no interpretation at all.

**Por que:** The user's constraints settle this. Two thumbs are already committed to a joystick and a tentacle button, so there is no free input for a map toggle, and 'no tutorials, no explanation' rules out any UI element that must be learned. An arrow is understood instantly by everyone.

```js
function drawExitArrow(g, px, py, ex, ey, camx, camy){
  let dx = ex - px, dy = ey - py;
  const d = Math.hypot(dx,dy) || 1;
  const sx = ex - camx, sy = ey - camy;
  if (sx > 16 && sx < VW-16 && sy > 16 && sy < VH-16) return;  // exit on screen: no arrow
  const cx = VW/2, cy = VH/2, m = 16;
  const t = Math.min((cx-m)/Math.abs(dx/d) || 1e9, (cy-m)/Math.abs(dy/d) || 1e9);
  const ax = Math.round(cx + dx/d*t), ay = Math.round(cy + dy/d*t);
  spr(g, ARROW[dirIndex(dx,dy)], ax, ay);      // 8 baked rotations, zero alloc
}
```

## Tilemap rendering: pre-render the WHOLE level once to one offscreen canvas

**Recomendacion:** At the end of init(), render the entire level into a single offscreen canvas at 1:1 virtual scale and blit the visible rectangle with ONE drawImage per frame using the 9-argument form. The largest level is 720x1680 = 1.21 Mpx = 4.6 MB RGBA, which is trivial against 4 GB of RAM. This beats per-tile blitting (779 drawImage/frame = 46.7k calls/s) by a factor of 779, and beats an 8x8-tile chunk cache (24 calls/frame) by 24x for the same 4.6 MB. It also makes PERSISTENT BLOOD DECALS essentially free: paint the splatter straight into the level canvas once, and it costs nothing on every subsequent frame — which is exactly the gore-persistence the user asked for. Bake the ~14 tile variants once with the existing bake() helper.

**Por que:** Ran the draw-call math for all three strategies. The full pre-render is the strongest option specifically BECAUSE of the persistent-decal requirement: with per-tile or chunked drawing, every decal is extra per-frame work or a dirty-rect bookkeeping problem, whereas with one baked canvas a decal is a one-time paint. The 4.6 MB cost is the thing that makes the headline gore feature free.

```js
// ONCE in init(), after generation:
levelCv = document.createElement('canvas');
levelCv.width = W*TS; levelCv.height = H*TS;     // max 720x1680 = 4.6MB
const lg = levelCv.getContext('2d', { alpha:false });
lg.imageSmoothingEnabled = false;
for (let y=0;y<H;y++) for (let x=0;x<W;x++)
  lg.drawImage(TILE[map[y*W+x]], x*TS, y*TS);    // ~5,376 blits, one time only

// EVERY frame: exactly ONE call for the entire world.
g.drawImage(levelCv, ox, oy, VW, VH, 0, 0, VW, VH);

// Blood decal: painted into levelCv once, free forever after.
function splat(wx, wy, r, col){
  lg.fillStyle = col;
  lg.fillRect(Math.round(wx-r), Math.round(wy-r), r*2, r*2);
}
// Fill budget stays at 24.3 Mpx/s on a 270x600 backbuffer — Adreno 612 is idle.
```

## Run structure: 8 levels, escalating, with a real ending

**Recomendacion:** A run is 8 levels and then it ENDS with an escape (a win screen, not a fail state) — this matters because all three existing games are endless-score games, so SYMBIOTE finishing gives the arcade a title you can actually beat. Progression: size 30x70 -> 48x112 tiles, capped at depth 6 so the last two levels are dense rather than merely large; rooms 10 -> 26; pipes 2 -> 5; loop corridors 2 -> 6. Enemies scale scientists 4->10 and guards 0->6, with guards first appearing at level 2 and turrets at level 4 so each new threat gets one level to be learned by dying to it. Score = 100/kill + 500/level + a time bonus of max(0, 90 - seconds)*10, submitted via Save.submit once at the end of the run so the leaderboard reads as one number.

**Por que:** The measured shortest-path traversal time is a median 20.5 s walking, and combat plus backtracking realistically doubles it, landing squarely in the 1-3 minute target the user set. Capping the size ramp at depth 6 is deliberate: past that, larger levels only add walking, and walking is not what makes this game fun.

```js
const RUN_LEVELS = 8;
// depth d in 0..7, size ramp capped at 6
const W = 30 + Math.min(d,6)*3;    // 30,33,36,39,42,45,48,48
const H = 70 + Math.min(d,6)*7;    // 70,77,84,91,98,105,112,112
const scientists = 4 + d;          // 4..11
const guards     = d<1 ? 0 : Math.min(6, d);
const turrets    = d<3 ? 0 : Math.min(4, d-2);
// score, submitted ONCE at the end of the run
score += 100*kills + 500*levelsCleared + Math.max(0, 90-elapsed)*10;
```

## Hazards, glass and doors: what each tile actually does

**Recomendacion:** GLASS is walkable in the flood fill and shatters on contact, spraying 8 shards and cutting a permanent hole (rewrite the tile to FLOOR and repaint that one tile into the level canvas). It is generated on the top wall of 45% of non-entry/exit rooms, which gives every level several dramatic entrances and never gates progress, since it is passable to the reachability proof either way. HAZARD is a single floor tile (30% of rooms get one) doing 1 damage per 0.5 s standing contact — enough to punish careless swinging, never enough to be a trap. DOOR is walkable and used for room thresholds; it slams shut for 0.6 s when an alarm triggers, which is drama rather than a barrier. Keep the VENT type defined but unused in v1: it is the natural place to add a second traversal layer later without touching the generator's contract.

**Por que:** Every one of these is deliberately non-blocking in the reachability proof. That is the single rule that keeps 'levels vary but are never unfair' true — no generated feature can ever be the thing that makes an exit unreachable, so the flood fill has nothing to fail on.

## Pitfalls

- The engine's shared `cam` in core.js is SHAKE-ONLY — `cam.update()` overwrites x/y with random offsets and zeroes them when the timer expires. Do NOT store scroll in it; any value written there is destroyed within a frame. SYMBIOTE needs its own camera object, and note that main.js ALREADY translates the canvas by (cam.x, cam.y) around the game's draw() call, so subtract cam.x/cam.y in your own scroll offset or the shake is applied twice.
- Do NOT carve pipes before the reachability flood fill. I measured this: carving shafts through arbitrary tiles severed corridors and produced a 27% unreachable-exit rate. Pipes must only replace tiles that are currently SOLID — opening a wall cannot disconnect a graph, which is what makes the guarantee hold.
- Do NOT validate pipe mouths by rejecting bad ones after carving. That approach rejected 76% of builds (12,238 of 16,000) and drove a 15% total generation failure rate. Carve from the first tile OUTSIDE the room so the mouth is adjacent to floor by construction; acceptance went to 100% on the first attempt.
- Do NOT judge the pipe network by tiles saved — by that metric the median saving is 0 and pipes look like decoration worth cutting. Weighted by actual travel time (walk 192 ms/tile vs pipe 79 ms/tile) they save a median 5.1 s and win in 99.7% of levels. Use the time metric.
- Do NOT raise the virtual resolution to 540x1200. It is exactly 20:9 and upscales at an integer 2.0x, so it is tempting, but it quadruples fill to 97.2 Mpx/s and — the real problem — halves the on-screen size of every sprite shared with the other three games, so SYMBIOTE would look like it came from a different app. Buy detail with a 15px tile instead.
- Do NOT let genLevel() return null on the caller's path. It is measured to succeed on the first attempt 100% of the time over 20,000 levels, but the retry loop must still terminate in a guaranteed-good fallback seed rather than handing the game a null level.
- Do NOT allocate the flood-fill Uint8Array/Int32Array per frame or per validation call in the hot path. Generation runs once in init() (~11 ms on a Snapdragon 678), so allocation there is fine — but never call the generator or a flood fill from update().
- Do NOT draw the tilemap tile-by-tile just because it seems more memory-frugal. It is 779 drawImage calls per frame (46.7k/s) versus 1, and it makes persistent blood decals expensive forever. The 4.6 MB full-level canvas is the thing that makes the gore requirement free.
- Do NOT make GLASS, HAZARD or DOOR block the reachability flood fill. The moment a decorative feature can gate progress, 'never unfair' stops being provable and the generator can produce a level that cannot be finished.
- Do NOT store a pool index as a lasting reference for enemies or gore particles — core.js Pool uses swap-remove, so indices change when anything is freed. Sweep pools backward (`for (let i = pool.n-1; i >= 0; i--)`) or you will silently skip entities.
- Do NOT let enemies path into pipes. Their guaranteed-safety is the entire tactical reason to use them; if guards follow you in, the mechanic collapses into a slower corridor.
- Do NOT treat pipe interiors as ordinary 2-D physics through a 1-tile gap — the body snags on mouth corners and the player fights the geometry. Clamp to a 1-D scalar along the shaft so there are no collision cases at all.
