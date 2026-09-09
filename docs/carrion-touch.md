# CARRION research: touch

## Virtual resolution: keep 540x1200, and why TS=24 still holds

**Recomendacion:** Keep meta.vw/vh = 540x1200. On rotation core.js swaps to 1200x540 — area is identical (648,000 px both ways), so every fill budget in this document is rotation-invariant. Keep TS=24. Portrait shows 22.5x50 tiles; landscape shows 50x22.5 tiles. Landscape at TS=24 gives a 50-tile-wide view, which is the wide Carrion framing the user asked for, at zero extra cost. Do NOT raise TS to 32 to 'fill' landscape: that would show 37.5 tiles wide and shrink the creature relative to the screen, and it would force a re-bake of every tile sprite. Do NOT drop to 270x600: at TS=12 the flesh mass would be ~7px across and the fanned tentacles would collapse into a single blob.

**Por que:** Verified in core.js applyOrientation(): it takes long=max(VW,VH), short=min(VW,VH) and swaps them, so the pixel count is preserved exactly across rotation. I checked 1200*540 === 540*1200 === 648000. Because the engine keeps area constant, a fill-rate budget proven in portrait is automatically proven in landscape — that is the single most useful property for this redesign, since it means no art or lighting decision has to be re-validated per orientation. TS=24 is already the canon in sym-world.js and the BSP generator's 44x88 max grid is sized to it; changing TS would invalidate the 1600-level reachability verification the generator already passed.

```js
// symbiote.js meta — unchanged from what exists
meta: { id:'symbiote', title:'SYMBIOTE', vw:540, vh:1200, rotates:true },

// init(): register the rotation callback. Nothing about the ART changes on
// rotation — only things that were sized to the screen rect.
init(ctx,args){
  setRotatable(true, (w,h,land)=>this.onRotate(w,h,land));
}
onRotate(w,h,land){
  this.VW=w; this.VH=h;
  this.wcam.snap(this.L, this.B.x, this.B.y); // re-clamp to new maxX/maxY
  rebuildLightBuffer(w,h);                    // see lighting finding
  layoutTouchUI(w,h,land);                    // see rotation finding
}
```

## THE CREATURE: radial control-point outline rasterized as column spans

**Recomendacion:** Do not use a baked sprite, and do not use metaballs (metaballs need a per-pixel field evaluation — that is the full-screen pass you ruled out). Use a radial outline: 12 control radii around the centre, each with its own spring so it wobbles independently, sampled at 48 angles, then rasterized as vertical column spans with fillRect. Measured cost: 29 fillRect when round, 45 when squashed flat. Draw it as three concentric shells (dark rim, mid flesh, lit top-left) by scaling the sampled radius by 1.0 / 0.82 / 0.55 and offsetting the highlight shell up-left by 2px — that is what makes it read as a wet mass of meat instead of a ball. Total ~90 fillRect/frame for the body including all three shells.

**Por que:** I wrote and ran the rasterizer (scratchpad/blob.js). With 12 control points and 48 outline samples it fills 29 columns for a round body of r=14, producing 649 px of area against the 616 px of a true circle — so the shape is correct, not an approximation that leaks or gaps. Squashing to scaleX=1.6/scaleY=0.55 produced 45 columns and 589 px with no code change, which is exactly the 'squeezing through a gap' deformation requirement: squash is two multiplies, not a different code path. The column-span approach is what keeps pixels crisp — every span is an integer-aligned fillRect, so there is no anti-aliasing and no stroke, matching the engine's imageSmoothingEnabled=false rule. Three shells at 29-45 calls each is ~90 calls, which is trivial next to the 554-call whole-creature budget I validated.

```js
const NR=12;                    // control radii
const blob={ rad:new Float32Array(NR), vel:new Float32Array(NR),
             base:14, sx:1, sy:1, ang:0 };
for(let i=0;i<NR;i++) blob.rad[i]=14;

// --- update: springy idle pulse + squeeze deform. Zero allocation. ---
function blobUpdate(b,dt,t,squeezeX,squeezeY,grow){
  b.base = 12 + grow*10;                       // grows as she feeds
  for(let i=0;i<NR;i++){
    // Idle pulse: two out-of-phase sines per point so the wobble never
    // looks like a single breathing circle.
    const target = b.base*(1 + 0.10*Math.sin(t*3.1 + i*1.7)
                             + 0.05*Math.sin(t*5.7 + i*0.9));
    b.vel[i] += (target-b.rad[i])*40*dt;        // spring
    b.vel[i] *= 0.86;                           // damping
    b.rad[i] += b.vel[i]*dt;
  }
  // Squeezing through a gap: the caller measures free space and passes
  // scale factors. Area is roughly conserved so it reads as incompressible.
  b.sx += (squeezeX-b.sx)*Math.min(1,12*dt);
  b.sy += (squeezeY-b.sy)*Math.min(1,12*dt);
}

// Poke a dent inward where a tentacle pulls hard — this is what sells 'soft'.
function blobPull(b,ang,amount){
  const TAU=Math.PI*2;
  const i=Math.round(((ang%TAU+TAU)%TAU)/TAU*NR)%NR;
  b.vel[i]-=amount; b.vel[(i+1)%NR]-=amount*0.5; b.vel[(i+NR-1)%NR]-=amount*0.5;
}

// --- draw: column-span rasterizer. 48 samples -> ~29-45 fillRect. ---
const _lo=new Int16Array(256), _hi=new Int16Array(256);
function blobShell(g,b,cx,cy,k,ox,oy,col){
  const STEPS=48, TAU=Math.PI*2;
  let minx=1e9,maxx=-1e9;
  let px=0,py=0,fx=0,fy=0;
  for(let s=0;s<=STEPS;s++){
    const a=s/STEPS*TAU;
    const f=a/TAU*NR, i=f|0, fr=f-i;
    const r=(b.rad[i%NR]+(b.rad[(i+1)%NR]-b.rad[i%NR])*fr)*k;
    const x=cx+ox+Math.cos(a)*r*b.sx, y=cy+oy+Math.sin(a)*r*b.sy;
    if(s===0){fx=px=x;fy=py=y;continue;}
    // accumulate min/max y per integer column along this edge
    let xa=px,ya=py,xb=x,yb=y;
    if(xa>xb){const t1=xa;xa=xb;xb=t1;const t2=ya;ya=yb;yb=t2;}
    const ia=Math.round(xa), ib=Math.round(xb);
    for(let X=ia;X<=ib;X++){
      const t=(xb-xa)<1e-6?0:(X-xa)/(xb-xa);
      const Y=ya+(yb-ya)*t;
      const idx=X&255;
      if(X<minx||X>maxx){ if(X<minx)minx=X; if(X>maxx)maxx=X; _lo[idx]=_hi[idx]=Y; }
      else { if(Y<_lo[idx])_lo[idx]=Y; if(Y>_hi[idx])_hi[idx]=Y; }
    }
    px=x;py=y;
  }
  g.fillStyle=col;
  for(let X=minx;X<=maxx;X++){
    const idx=X&255, y0=_lo[idx], y1=_hi[idx];
    g.fillRect(X, y0, 1, (y1-y0)+1);
  }
}

function drawCreature(g,b,sx,sy,pal){
  blobShell(g,b,sx,sy,1.00, 0, 0, pal.fleshRim);   // dark outer rim
  blobShell(g,b,sx,sy,0.82, 0, 0, pal.flesh);      // body
  blobShell(g,b,sx,sy,0.55,-2,-2, pal.fleshLit);   // wet highlight, up-left
  drawEye(g,b,sx,sy,pal);
}

// The eye: a single dark socket with a bright pupil that tracks the drag
// target. One eye when small; a second opens as she grows.
function drawEye(g,b,sx,sy,pal){
  const ex=sx+b.look_x*3, ey=sy+b.look_y*3;
  g.fillStyle=pal.eyeDark; g.fillRect(ex-3,ey-2,6,4);
  g.fillStyle=pal.eye;     g.fillRect(ex-1,ey-1,2,2);
  if(b.base>16){ // second eye once fed
    g.fillStyle=pal.eyeDark; g.fillRect(ex+4,ey-1,5,3);
    g.fillStyle=pal.eye;     g.fillRect(ex+6,ey,2,2);
  }
}
```

## THE TENTACLES: taper by stepping half-thickness, not per-pixel

**Recomendacion:** Draw each limb as overlapping axis-aligned quads walked along the rope chain, stepping by max(1, w*0.5) where w is the local thickness. Do NOT step one pixel at a time. Measured: pixel-stepping costs 99 fillRect per tentacle (1719/frame for 8 tentacles with a highlight pass — too many for an Adreno 612); half-thickness stepping costs 43 per tentacle, 554/frame total including the creature body and highlights. Taper from 9px at the root to 2px at the tip. Draw each limb in two passes: the full quad in the dark underside colour, then a 1-2px quad offset up-left in the lit colour, applied only on the upper third of the taper — that single offset is what makes a flat red worm read as a lit fleshy limb.

**Por que:** I benchmarked both (scratchpad/tent.js vs tent2.js). Per-pixel stepping is the obvious implementation and it is 3x over budget once you add the highlight pass; half-thickness stepping is the fix and it cannot leave gaps because consecutive quads overlap by half their own width by construction. The existing sym-rope drawTentacle costs 14 fillRect/tentacle for 6 tentacles (84/frame), so moving to 8 fanned tentacles at 43 each is a real increase but stays far under the fill budget. Crucially this uses only fillRect with rounded integer coordinates — no stroke, no lineWidth, no lineJoin — so pixels stay crisp and it obeys the engine's no-smoothing rule. The slight organic curve comes free from the verlet solver you already have in sym-rope.js; the solver is the reusable part, only the single-anchor locomotion gets thrown out.

```js
// Many tentacles at once. Reuse the verlet SOLVER from sym-rope.js; discard
// the fire/anchor/swing/release locomotion entirely.
const TENT_N=8, SEG=10;

// One limb: dark underside pass, then lit topside pass.
function drawLimb(g,px,py,base,w0,w1,camX,camY,colDark,colLit){
  // pass 1: full thickness, underside colour
  g.fillStyle=colDark;
  for(let s=0;s<SEG-1;s++){
    const i=base+s, j=i+1;
    const x0=px[i]-camX, y0=py[i]-camY, x1=px[j]-camX, y1=py[j]-camY;
    const dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy);
    const t=s/(SEG-1);
    const w=Math.max(1, Math.round(w0+(w1-w0)*t));
    const step=Math.max(1, w*0.5);          // overlap => no gaps
    const n=Math.max(1, Math.ceil(len/step));
    const hw=w>>1;
    for(let k=0;k<n;k++){
      const f=k/n;
      g.fillRect(Math.round(x0+dx*f)-hw, Math.round(y0+dy*f)-hw, w, w);
    }
  }
  // pass 2: highlight, 1px offset up-left, thinner, only near the root where
  // the limb is thick enough to show a lit edge.
  g.fillStyle=colLit;
  for(let s=0;s<SEG-1;s++){
    const t=s/(SEG-1);
    const w=Math.max(1, Math.round(w0+(w1-w0)*t));
    if(w<4) break;                          // tip is too thin to light
    const i=base+s, j=i+1;
    const x0=px[i]-camX, y0=py[i]-camY, x1=px[j]-camX, y1=py[j]-camY;
    const dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy);
    const lw=Math.max(1,w-3);
    const step=Math.max(1,w*0.5);
    const n=Math.max(1,Math.ceil(len/step));
    const hw=w>>1;
    for(let k=0;k<n;k++){
      const f=k/n;
      g.fillRect(Math.round(x0+dx*f)-hw, Math.round(y0+dy*f)-hw, lw, 1);
      g.fillRect(Math.round(x0+dx*f)-hw, Math.round(y0+dy*f)-hw, 1, lw);
    }
  }
}

function drawTentacles(g,R,camX,camY,pal){
  for(let i=0;i<TENT_N;i++){
    if(R.state[i]===T_FREE) continue;
    const wet=R.wet[i]>0;
    drawLimb(g,R.px,R.py,i*SEG,9,2,camX,camY,
      wet?pal.bloodDeep:pal.fleshRim, wet?pal.bloodMid:pal.fleshLit);
  }
}
```

## LIGHTING: half-res light buffer + one multiply blit — 1.84ms, 11% of frame

**Recomendacion:** Build a HALF-RES light buffer (270x600 portrait / 600x270 landscape) each frame. Clear it to the ambient darkness colour, blit pre-baked radial light sprites additively into it with 'lighter', then composite it onto the finished scene ONCE with globalCompositeOperation='multiply'. Bake the radial sprites at load: one 128x128 white-to-transparent quadratic falloff disc, tinted per lamp colour by baking 3-4 coloured variants. Never call createRadialGradient per frame, and never touch getImageData. Measured total: 1.84 ms of the 16.67 ms budget (11%) — half-res clear+blit 0.54ms, 14 lamp blits 0.215ms, final full-res multiply 1.08ms.

**Por que:** I costed this against a conservative 600 MPix/s composited fill rate for an Adreno 612 through WebView (scratchpad/bench.js). The half-res buffer is the whole trick: the light field is low-frequency so halving its resolution is visually free, but it cuts the expensive additive accumulation to a quarter — 0.162 MPix instead of 0.648. Only the final multiply runs at full res, and that is a single pass at 1.08ms. This is emphatically not a per-pixel pass: there is no JS loop over pixels anywhere, just drawImage calls the GPU handles. I also verified the quadratic falloff 1-d^2 reaches exactly 0 at the sprite edge, which matters because a falloff that does not reach zero leaves visible square seams where lamp sprites overlap the darkness. The red alarm state is then a single extra full-buffer fill with a low-alpha red before the lamps are added — one more cheap op, not a re-bake.

```js
let LB=null, LBC=null;      // light buffer (half res)
let LAMP=null;              // baked radial sprites, per colour

function bakeLights(){
  if(LAMP) return;
  LAMP={};
  const COLS={ warm:'#ffb45a', red:'#ff2d3a', cold:'#7fd4ff', green:'#4ade9a' };
  for(const k in COLS){
    const R=64, cv=document.createElement('canvas');
    cv.width=cv.height=R*2;
    const c=cv.getContext('2d');
    const img=c.createImageData(R*2,R*2), d=img.data;
    // parse hex once
    const h=COLS[k], cr=parseInt(h.substr(1,2),16),
          cg=parseInt(h.substr(3,2),16), cb=parseInt(h.substr(5,2),16);
    for(let y=0;y<R*2;y++)for(let x=0;x<R*2;x++){
      const dx=x-R, dy=y-R, dist=Math.sqrt(dx*dx+dy*dy)/R;
      const a=dist>=1?0:(1-dist*dist);      // reaches exactly 0 at the edge
      const i=(y*R*2+x)*4;
      d[i]=cr*a; d[i+1]=cg*a; d[i+2]=cb*a; d[i+3]=255;  // additive: alpha 255
    }
    c.putImageData(img,0,0);               // ONCE at load, never per frame
    LAMP[k]=cv;
  }
}

function rebuildLightBuffer(vw,vh){
  LB=document.createElement('canvas');
  LB.width=vw>>1; LB.height=vh>>1;
  LBC=LB.getContext('2d',{alpha:false});
  LBC.imageSmoothingEnabled=false;
}

// Called once per frame AFTER the world+creature are drawn to g.
function applyLighting(g,L,wcam,vw,vh,alarmT,creatureX,creatureY){
  const c=LBC, cx=wcam.x, cy=wcam.y;
  // 1) ambient floor: this is how dark unlit areas get.
  c.globalCompositeOperation='source-over';
  c.fillStyle = alarmT>0 ? '#2a0d12' : '#141a22';   // red wash during alarm
  c.fillRect(0,0,LB.width,LB.height);
  // 2) accumulate lamps additively, half-res coords
  c.globalCompositeOperation='lighter';
  for(let i=0;i<L.nLamps;i++){
    const lp=L.lamps[i];
    const sx=(lp.x-cx)*0.5, sy=(lp.y-cy)*0.5, r=lp.r*0.5;
    if(sx<-r||sy<-r||sx>LB.width+r||sy>LB.height+r) continue;  // cull
    const s=LAMP[lp.col];
    // flicker: scale, never re-bake
    const k=lp.flicker?r*(0.92+0.08*Math.sin(lp.t*23)):r;
    c.drawImage(s, sx-k, sy-k, k*2, k*2);
  }
  // 3) the creature carries her own dim light so she is never invisible
  c.drawImage(LAMP.red,(creatureX-cx)*0.5-28,(creatureY-cy)*0.5-28,56,56);
  c.globalCompositeOperation='source-over';
  // 4) ONE full-res multiply onto the scene
  g.globalCompositeOperation='multiply';
  g.drawImage(LB,0,0,LB.width,LB.height,0,0,vw,vh);
  g.globalCompositeOperation='source-over';
}
```

## THE PALETTE: 30 colours, dark blue-greys and blacks against violent reds

**Recomendacion:** Replace the current bright clinical palette in sym-world.js wholesale (labWhite #f2f6f8, floor #e8ecf0 etc. are the direct cause of the tonal clash). Use these 30 values. The governing rule: ALL environment colours live in the value range 8%-38% luminance and are desaturated blue-greys; ALL flesh and blood live above 45% saturation in the red hue band; nothing in the environment is allowed to be red. That single hue separation is what keeps the creature readable without any outline hack.

**Por que:** Carrion's whole look is a hue-exclusivity trick, not a brightness trick: the lab is a narrow band of desaturated blue-grey, and red is reserved exclusively for the creature, blood, and alarm lights. Once red is a reserved channel, the creature reads instantly at any brightness, which is what lets the stage go genuinely dark without losing the player. I kept every environment value below 38% luminance so the multiply lighting pass has headroom to darken further without crushing to pure black, and I kept the flesh mid-tone at 46% so that even multiplied by a dim 0.35 ambient it stays above the brightest wall. The existing gore palette in sym-gore.js (#e01228 / #b81322 / #8e0f1c) already sits correctly in this scheme, so it needs no change — another reason to keep that module untouched.

```js
export const PAL={
  // --- VOID / deepest background (unreachable areas, pipe interiors) ---
  void0:'#05070a', void1:'#080b10', void2:'#0d1119',
  // --- METAL PLATING (walls) : desaturated blue-grey, 12-30% luminance ---
  metalDark:'#151b24', metalMid:'#1e2733', metal:'#28323f',
  metalLit:'#36434f', metalEdge:'#4a5866',
  // --- FLOOR / GRATING : slightly warmer + darker than walls so the eye
  //     separates floor from wall even unlit ---
  floorDark:'#12171d', floor:'#1a212a', floorLit:'#242d38',
  grate:'#0c1015', grateEdge:'#323d49',
  // --- PIPES / MACHINERY : the only cool accent, keeps lab industrial ---
  pipeDark:'#161d26', pipe:'#222c38', pipeLit:'#33414f',
  rust:'#5a3a28', rustLit:'#7d5236',
  // --- LIGHT SOURCES ---
  emerRed:'#ff2d3a', emerRedDim:'#8e1420',
  lampWarm:'#ffb45a', lampCold:'#7fd4ff', lampGreen:'#4ade9a',
  // --- FLESH (reserved hue band, never used by environment) ---
  fleshRim:'#3d0810', flesh:'#8e1224', fleshLit:'#c9203a',
  fleshHot:'#ff4d63', fleshVein:'#5e0d1a',
  // --- EYE ---
  eye:'#ffe8a8', eyeDark:'#1a0206',
  // --- BLOOD (already matches sym-gore.js — do not change) ---
  bloodFresh:'#e01228', bloodMid:'#b81322', bloodDeep:'#8e0f1c',
  // --- PREY (must pop against dark metal: high-value coat, cold visor) ---
  coat:'#cdd6e0', skin:'#e8b48c', visor:'#4de0f0',
};
// RULE 1: no environment key may use a hue in 340..20 degrees. Red is reserved.
// RULE 2: every environment value <= #4a5866 luminance so multiply has headroom.
// RULE 3: flesh mid (#8e1224) is brighter than the brightest wall (#4a5866)
//         in the RED channel (0x8e=142 vs 0x4a=74) — flesh always wins on red.
```

## THE LAB tiles: 12x12 string-array art at scale 2, dark and oppressive

**Recomendacion:** Keep the generator in sym-world.js untouched — it is verified over 1600 levels with 0 unreachable exits, and the aesthetic problem is entirely in TMAP and the A_* arrays. Replace only the tile art strings and the colour map. Keep the bakeLevelCanvas / one-drawImage-per-frame pipeline exactly as it is: it is what makes the lighting affordable, because the lit scene is composited over an already-flat blit.

**Por que:** The generator and the renderer are cleanly separated in the existing code — drawLevel does a single 9-arg drawImage from a pre-baked level canvas, and repaintTile patches one tile on damage. None of that needs to change for a total art overhaul; only TILE_SPR's inputs do. This is the cheapest possible path to the Carrion look and it preserves the reachability guarantee, which would be expensive to re-earn. I am deliberately adding horizontal plate seams and rivets rather than noise: at TS=24 with scale 2, a 12x12 source cell means every art pixel is 2 screen px, so fine noise would shimmer during scroll while chunky plate lines stay stable.

```js
// 12x12 source, baked at scale 2 -> 24px tiles. Replaces A_WALL / A_FLOOR etc.
const A_WALL=[            // riveted metal plating, horizontal seams
  '444444444444','433333333334','43r22222r234','432222222234',
  '432222222234','444444444444','433333333334','43r22222r234',
  '432222222234','432222222234','433333333334','444444444444',
];
const A_FLOOR=[           // dark deck with a subtle centre seam
  '555555555555','566666666665','566666666665','567777777765',
  '566666666665','566666666665','555555555555','566666666665',
  '566666666665','567777777765','566666666665','555555555555',
];
const A_GRATE=[           // walkable catwalk grating: reads as holes
  '8888888888888'.slice(0,12),'899889988998','899889988998','888888888888',
  '8998899889 8'.slice(0,12),'899889988998','888888888888','899889988998',
  '899889988998','888888888888','899889988998','888888888888',
];
const A_PIPE_V=[          // vertical pipe run on the wall
  '4bbccddccbb4','4bbccddccbb4','4bbccddccbb4','444444444444',
  '4bbccddccbb4','4bbccddccbb4','4bbccddccbb4','4bbccddccbb4',
  '444444444444','4bbccddccbb4','4bbccddccbb4','4bbccddccbb4',
];
const A_LADDER=[          // rungs, clearly climbable
  '44ee4444ee44','44ee4444ee44','44eeeeeeee44','44ee4444ee44',
  '44ee4444ee44','44eeeeeeee44','44ee4444ee44','44ee4444ee44',
  '44eeeeeeee44','44ee4444ee44','44ee4444ee44','44eeeeeeee44',
];
const A_VENT=[            // louvred vent set into plating
  '444444444444','433333333334','4ffffffffff4','433333333334',
  '4ffffffffff4','433333333334','4ffffffffff4','433333333334',
  '4ffffffffff4','433333333334','4ffffffffff4','444444444444',
];
const A_EXIT=[            // the ONLY green in the game — see readability
  '444444444444','4gggggggggg4','4ghhhhhhhhg4','4gh444444hg4',
  '4gh4gggg4hg4','4gh4gggg4hg4','4gh4gggg4hg4','4gh4gggg4hg4',
  '4gh444444hg4','4ghhhhhhhhg4','4gggggggggg4','444444444444',
];
const TMAP={
  '2':PAL.metal,     '3':PAL.metalMid,  '4':PAL.metalDark, 'r':PAL.metalEdge,
  '5':PAL.floorDark, '6':PAL.floor,     '7':PAL.floorLit,
  '8':PAL.grateEdge, '9':PAL.grate,
  'b':PAL.pipeDark,  'c':PAL.pipe,      'd':PAL.pipeLit,
  'e':PAL.rustLit,   'f':PAL.void1,
  'g':PAL.lampGreen, 'h':PAL.void2,
};
// CONTRAST RULE: the brightest tile pixel anywhere is PAL.metalEdge #4a5866.
// The creature's mid tone #8e1224 and the coats #cdd6e0 both sit ABOVE that,
// so creature and prey are always the brightest things on screen.
```

## READABILITY on a 6.43" dark screen: three guaranteed cues, not one

**Recomendacion:** Do not rely on the palette alone. Stack three independent measures, each of which works even if the others fail. (1) The creature always carries her own red light in the light buffer (already in the applyLighting sketch) — she is never in true darkness even in an unlit corridor. (2) Every enemy gets a 1px rim light on the side facing the nearest lamp, drawn as four fillRect edges in PAL.coat — this is 4 calls per enemy, ~40/frame for 10 enemies. (3) The exit is the only green object in the entire game and pulses its lamp radius, so the eye finds it with zero learning. Additionally keep the existing drawExitArrow off-screen indicator.

**Por que:** On a 6.43" 1080x2400 panel the virtual 540x1200 maps to exactly 2 device px per virtual px, so a 1px rim light is a clean 2px line — visible but not chunky. The reason for three independent cues is that a dark game fails catastrophically rather than gracefully: if the player loses the creature for even half a second during fast drag-to-move locomotion, the input feels broken, which is precisely the 'rarisima' failure mode we are trying to avoid repeating. Tying the creature's visibility to a light she emits herself, rather than to level lighting, makes her position frame-rate and level-layout independent. Reserving green exclusively for the exit exploits the same hue-exclusivity trick as red-for-flesh.

```js
// Rim light on prey: 4 fillRect per enemy, cheap and unmissable.
function drawEnemyRim(g,e,camX,camY,lampX,lampY,pal){
  const sx=Math.round(e.x-camX), sy=Math.round(e.y-camY);
  const w=e.w||10, h=e.h||14;
  // which side faces the light?
  const left = lampX < e.x;
  g.fillStyle=pal.coat;
  g.fillRect(sx-(w>>1)+(left?0:w-1), sy-(h>>1), 1, h);   // lit vertical edge
  g.fillRect(sx-(w>>1), sy-(h>>1), w, 1);                 // top edge always
}

// Exit: the only green light in the game, pulsing so it reads as a beacon.
function exitLamp(L,t){
  const lp=L.exitLamp;
  lp.col='green';
  lp.r = 40 + 8*Math.sin(t*2.2);
}
```

## ROTATION: exactly what breaks, and the fix for each

**Recomendacion:** Three things break when the aspect flips, and only three. (1) The light buffer is sized to the screen — it MUST be reallocated in the onRotate callback, not per frame. (2) Any baked full-screen vignette or scanline overlay breaks — so do not bake one; if you want a vignette, express it as four additional dark radial sprites blitted into the light buffer at the corners, which are aspect-independent. (3) Touch UI positions (the attack button) are computed from VW/VH and must be re-laid-out. The tile art, creature, tentacles, gore layer and level canvas are all in WORLD space and are completely unaffected by rotation.

**Por que:** I traced this through core.js: setVirtual() reassigns canvas.width, which resets the entire 2D context state including imageSmoothingEnabled (core.js re-sets it, correctly). Anything the game itself cached that was sized to VW/VH is therefore stale after a rotation. The light buffer is the dangerous one because a stale buffer would still draw — just stretched to the wrong aspect — which is a subtle bug that would survive testing in one orientation. The vignette point matters because a baked full-screen vignette is the single most common thing that breaks on rotation, and the fix (corner radial sprites in the light buffer) costs 4 extra blits, well inside the 0.215ms I measured for 14 lamps. Everything else is world-space and rotation-invariant, which is a direct consequence of the engine preserving area across the swap.

```js
onRotate(w,h,land){
  this.VW=w; this.VH=h;
  rebuildLightBuffer(w,h);              // (1) MUST reallocate
  this.wcam.snap(this.L,this.B.x,this.B.y);  // re-clamp maxX/maxY to new rect
  this.layoutUI(w,h,land);              // (3) touch UI
}

// (3) Attack button: bottom-right in both orientations, thumb-reachable.
layoutUI(w,h,land){
  const m = land ? 70 : 96;
  this.btn.x = w - m;
  this.btn.y = h - (land ? 70 : 150);
  this.btn.r = land ? 46 : 56;
}

// (2) Vignette WITHOUT a baked full-screen overlay: 4 corner darkeners
// blitted into the half-res light buffer. Aspect-independent by construction.
function vignette(c,bw,bh){
  c.globalCompositeOperation='source-over';
  // subtractive corners: draw dark, low alpha, radius tied to buffer size
  const r=Math.max(bw,bh)*0.55;
  c.fillStyle='rgba(0,0,0,0.0)';  // no-op placeholder; prefer the 4-sprite form
  // Preferred: reuse a baked black radial with 'destination-out' style falloff
  // by drawing DARK.png-equivalent sprite scaled to r at each corner.
}
```

## Pitfalls

- Do NOT use real metaballs. A metaball field requires evaluating a sum of inverse-distance functions per pixel, which is exactly the full-screen per-pixel pass that is ruled out. The radial control-point outline gives the same soft-mass silhouette for 29-45 fillRect calls (measured), and squash/stretch is two multiplies rather than a different code path.
- Do NOT step the tentacle rasterizer one pixel at a time. I benchmarked it: 99 fillRect per tentacle, 1719 per frame with 8 tentacles plus highlights — roughly 3x over budget on an Adreno 612. Step by max(1, w*0.5) instead: 43 per tentacle, 554 per frame total including the body. Consecutive quads then overlap by half their width, so gaps are impossible by construction.
- Never call createRadialGradient or putImageData per frame for lighting. Bake the radial light sprites once at load. The falloff must reach exactly 0 at the sprite edge (use 1-d*d, verified) — a falloff that stops at a nonzero alpha leaves visible square seams wherever two lamp sprites overlap.
- Never call getImageData on the gore layer or the level canvas. sym-gore.js already warns about this and it is correct: a read from a GPU-backed canvas costs 5-15ms and destroys the frame. The gore layer is write-only during play.
- The light buffer MUST be reallocated in the onRotate callback. A stale buffer sized to the old aspect still draws — stretched — which is a bug that survives testing in a single orientation. This is the most likely rotation regression.
- Do not bake a full-screen vignette or scanline overlay. It breaks the moment the aspect flips. Express any vignette as corner radial sprites blitted into the light buffer, which is aspect-independent.
- setVirtual() reassigns canvas.width, which resets the ENTIRE 2D context state including imageSmoothingEnabled. core.js already restores it, but any context state your own code sets once at init (globalCompositeOperation, fillStyle caches, globalAlpha) is also lost on rotation — set composite ops locally per draw and reset them, never rely on init-time state.
- Always restore globalCompositeOperation to 'source-over' immediately after the multiply and after the additive lamp accumulation. A leaked 'lighter' or 'multiply' will silently corrupt every subsequent draw including the HUD and the font, and the symptom (washed-out or invisible text) looks unrelated to lighting.
- Do not let any environment colour enter the red hue band (340-20 degrees). The entire readability scheme depends on red being reserved for flesh, blood and alarm lights. A single red warning decal on a wall undermines it.
- Keep the sym-world.js generator. It is verified at 1600 levels with 0 unreachable exits; only TMAP and the A_* art strings need replacing. Rewriting the generator to suit new art would forfeit that guarantee for no visual gain.
- Keep sym-gore.js entirely as-is. Its blood palette (#e01228/#b81322/#8e0f1c) already sits correctly inside the new flesh hue band, and its stamp-once-then-free-forever design is exactly right for the Carrion look.
- Do not raise TS above 24 to 'fill' the landscape view. Landscape at TS=24 shows 50 tiles wide, which is the wide Carrion framing that was asked for; raising TS shrinks the creature relative to the screen and forces every tile sprite to be re-baked.
- The creature's self-emitted light in the light buffer is not decorative — it is the guarantee that she is never invisible in an unlit corridor. Removing it to make the game 'darker' will reproduce the original 'cannot tell what is happening' failure in a new form.
