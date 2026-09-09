// Ejecuta drawBike con un contexto que GRABA los comandos, y los vuelca a JSON
// para que un rasterizador en Python los dibuje.
const ops=[];
function rec(op,args){ops.push([op,...args]);}
function mkCtx(){
  const st={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',globalAlpha:1};
  const stack=[];
  const tf={a:1,b:0,c:0,d:1,e:0,f:0};
  const tfStack=[];
  const ctx={
    get fillStyle(){return st.fillStyle;}, set fillStyle(v){st.fillStyle=v;},
    get strokeStyle(){return st.strokeStyle;}, set strokeStyle(v){st.strokeStyle=v;},
    get lineWidth(){return st.lineWidth;}, set lineWidth(v){st.lineWidth=v;},
    get lineCap(){return st.lineCap;}, set lineCap(v){st.lineCap=v;},
    get globalAlpha(){return st.globalAlpha;}, set globalAlpha(v){st.globalAlpha=v;},
    save(){stack.push({...st});tfStack.push({...tf});rec('save',[]);},
    restore(){const s=stack.pop();if(s)Object.assign(st,s);const t=tfStack.pop();if(t)Object.assign(tf,t);rec('restore',[]);},
    translate(x,y){rec('translate',[x,y]);},
    rotate(a){rec('rotate',[a]);},
    scale(x,y){rec('scale',[x,y]);},
    beginPath(){rec('beginPath',[]);},
    closePath(){rec('closePath',[]);},
    moveTo(x,y){rec('moveTo',[x,y]);},
    lineTo(x,y){rec('lineTo',[x,y]);},
    quadraticCurveTo(cx,cy,x,y){rec('quad',[cx,cy,x,y]);},
    bezierCurveTo(a,b,c,d,e,f){rec('bez',[a,b,c,d,e,f]);},
    arc(x,y,r,s,e){rec('arc',[x,y,r,s,e]);},
    ellipse(x,y,rx,ry,rot,s,e){rec('ellipse',[x,y,rx,ry,rot,s,e]);},
    rect(x,y,w,h){rec('rect',[x,y,w,h]);},
    fill(){rec('fill',[st.fillStyle,st.globalAlpha]);},
    stroke(){rec('stroke',[st.strokeStyle,st.lineWidth,st.lineCap,st.globalAlpha]);},
    fillRect(x,y,w,h){rec('fillRect',[x,y,w,h,st.fillStyle,st.globalAlpha]);},
    createLinearGradient(x0,y0,x1,y1){const stops=[];return{addColorStop(o,c){stops.push([o,c]);},__grad:{type:'linear',x0,y0,x1,y1,stops}};},
    createRadialGradient(){const stops=[];return{addColorStop(o,c){stops.push([o,c]);},__grad:{type:'radial',stops}};},
  };
  return ctx;
}
const A=await import(process.argv[2]);
const WB=64,WR=12,SR=16;
function bike(o={}){return{ang:o.ang||0,susF:o.susF??8,susR:o.susR??8,wheelSpin:o.spin||0,
  vx:o.vx??420,onGround:o.onGround??true,air:o.air||0};}
const poses=[
  ['reposo',bike({vx:0,susF:10,susR:10})],
  ['a fondo',bike({vx:520,spin:2.1})],
  ['subiendo',bike({ang:-0.5,vx:460,spin:1.2})],
  ['bajando',bike({ang:0.42,vx:500,spin:3.4})],
  ['en el aire',bike({ang:-0.35,vx:480,onGround:false,air:0.6,susF:0,susR:0,spin:4})],
  ['aterrizando',bike({vx:470,susF:22,susR:24,spin:2.8})],
];
const all=[];
for(const [name,B] of poses){
  ops.length=0;
  const g=mkCtx();
  A.drawBike(g,B,75,58,WB,WR,SR);
  all.push({name,ops:JSON.parse(JSON.stringify(ops))});
}
console.log(JSON.stringify(all));
