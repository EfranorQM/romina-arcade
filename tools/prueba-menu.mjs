// Simula la fisica del carrusel del menu en Node, sin navegador, y comprueba
// que se porta como debe: que encaja siempre en una caratula, que un gesto
// rapido avanza lo razonable, que la fila circular no acumula error y que el
// indice elegido nunca se sale del array.
//
// Existe por la misma razon que se simulan las fisicas de los juegos antes de
// compilar: un fallo de encaje o un indice fuera de rango no se ve en una
// captura, se ve corriendo el modelo miles de pasos.
//
// Uso:  node tools/prueba-menu.mjs

const N = 5;                  // juegos
const K = 90;                 // rigidez del muelle que lleva al destino
const C = 2 * Math.sqrt(K);   // amortiguacion CRITICA: lo mas rapido sin rebote
const GLIDE = 0.16;           // cuanto pesa el impulso al elegir destino
const MAX_SALTOS = 3;         // caratulas que puede cruzar un solo gesto
const SEP = 88;               // px de arrastre por caratula
const DT = 1 / 60;

const mod = (n, m) => ((n % m) + m) % m;

// Al soltar el dedo se decide el destino UNA vez, y a partir de ahi solo se
// anima hacia el. La primera version dejaba un muelle libre peleando contra la
// friccion: recalculaba el objetivo cada paso, tardaba casi tres segundos en
// asentarse y al tocar una caratula lateral se quedaba una corta.
export function destinoTras(pos, vel) {
  const salto = Math.max(-MAX_SALTOS, Math.min(MAX_SALTOS, Math.round(vel * GLIDE)));
  return Math.round(pos) + salto;
}

function paso(st) {
  // Muelle criticamente amortiguado: a = k*(destino - pos) - c*vel.
  // La primera version restaba la amortiguacion como si fuera friccion, DESPUES
  // de aplicar el muelle; eso dejaba una cola exponencial larguisima y tardaba
  // casi cuatro segundos en asentarse por rapido que se pusiera el muelle.
  const a = (st.dest - st.pos) * K - st.vel * C;
  st.vel += a * DT;
  st.pos += st.vel * DT;
  // Se da por llegado cuando esta a menos de medio pixel y casi parado: seguir
  // hasta el cero exacto son decimas de segundo que nadie ve.
  if (Math.abs(st.vel) < 0.05 && Math.abs(st.pos - st.dest) * SEP < 0.5) {
    st.pos = st.dest; st.vel = 0;
  }
  // La fila es un anillo: se le restan vueltas enteras para que `pos` no crezca
  // sin limite. El destino se corre con ella o la animacion daria un salto.
  if (st.pos < -N || st.pos > N) {
    const k = Math.round(st.pos / N) * N;
    st.pos -= k; st.dest -= k;
  }
}

function asentar(pos, vel, dest, maxPasos = 3000) {
  const st = { pos, vel, dest: dest === undefined ? destinoTras(pos, vel) : dest };
  let i = 0;
  for (; i < maxPasos; i++) {
    paso(st);
    if (st.vel === 0 && Number.isInteger(st.pos)) break;
  }
  return { ...st, pasos: i, asentado: i < maxPasos };
}

let fallos = 0;
const mal = (msg) => { console.log('  FALLO: ' + msg); fallos++; };

// ---------- 1. Siempre encaja, desde cualquier sitio y a cualquier velocidad ----------
console.log('1. Encaje desde posiciones y velocidades variadas');
let peorPasos = 0, peorCaso = null;
for (let p = -12; p <= 12; p += 0.25) {
  for (const v of [-14, -8, -3, -1, -0.3, 0, 0.3, 1, 3, 8, 14]) {
    const r = asentar(p, v);
    if (!r.asentado) mal(`no encajo desde pos=${p} vel=${v}`);
    else if (!Number.isInteger(r.pos)) mal(`encajo en un no-entero: ${r.pos}`);
    if (!Number.isFinite(r.pos)) mal(`pos dejo de ser finita desde pos=${p} vel=${v}`);
    if (r.pasos > peorPasos) { peorPasos = r.pasos; peorCaso = { p, v }; }
  }
}
console.log(`   el peor caso tardo ${peorPasos} pasos (${(peorPasos / 60).toFixed(2)} s)`
  + `, desde pos=${peorCaso.p} vel=${peorCaso.v}`);
if (peorPasos > 70) mal(`tarda ${(peorPasos / 60).toFixed(2)} s en encajar: se sentiria pegajoso`);

// ---------- 2. El indice elegido nunca se sale del array ----------
console.log('2. El indice elegido siempre cae en 0..' + (N - 1));
for (let p = -50; p <= 50; p += 0.1) {
  const sel = mod(Math.round(p), N);
  if (!(sel >= 0 && sel < N) || !Number.isInteger(sel)) { mal(`pos=${p} da sel=${sel}`); break; }
}

// ---------- 3. Un gesto rapido avanza, pero no se descontrola ----------
console.log('3. Alcance de un gesto rapido');
for (const v of [2, 5, 9, 14, 30]) {
  const r = asentar(0, v);
  const saltos = Math.abs(Math.round(r.pos));
  console.log(`   vel=${String(v).padStart(2)} -> avanza ${saltos} caratulas en ${(r.pasos / 60).toFixed(2)} s`);
  if (v >= 5 && saltos === 0) mal(`una velocidad de ${v} no movio ni una caratula`);
  if (saltos > MAX_SALTOS) mal(`una velocidad de ${v} dio ${saltos} saltos: se pasa del tope`);
}

// ---------- 4. La fila circular no acumula error ni se va al infinito ----------
console.log('4. La posicion no crece sin limite al arrastrar mucho');
{
  let st = { pos: 0, vel: 0, dest: 0 };
  let maxAbs = 0;
  for (let k = 0; k < 200; k++) {
    st.pos -= 300 / SEP;                     // un arrastre de 300 px
    st.dest = destinoTras(st.pos, st.vel);   // se suelta: se decide destino
    for (let i = 0; i < 40; i++) paso(st);
    maxAbs = Math.max(maxAbs, Math.abs(st.pos));
    if (!Number.isFinite(st.pos)) { mal('pos dejo de ser finita en el arrastre ' + k); break; }
  }
  console.log(`   |pos| maxima tras 200 arrastres: ${maxAbs.toFixed(2)} (el limite es ${N})`);
  if (maxAbs > N + 1) mal(`pos crecio hasta ${maxAbs}: el anillo no esta acotando`);
}

// ---------- 5. Un toque en una caratula lateral la trae al centro ----------
console.log('5. Tocar una lateral la centra, exactamente');
for (const d of [-3, -2, -1, 1, 2, 3]) {
  const r = asentar(0, 0, d);              // el menu pide ir a esa caratula
  const llego = Math.round(r.pos);
  console.log(`   toque a ${String(d).padStart(2)} pasos -> quedo en ${llego} (${(r.pasos / 60).toFixed(2)} s)`);
  if (llego !== d) mal(`tocando la caratula a ${d} pasos, la fila quedo en ${llego}`);
}

// ---------- 6. No se pasa del destino y vuelve (no rebota) ----------
console.log('6. No rebota al llegar');
{
  const st = { pos: 0, vel: 0, dest: 2 };
  let maxPos = 0;
  for (let i = 0; i < 600; i++) { paso(st); maxPos = Math.max(maxPos, st.pos); }
  const exceso = maxPos - 2;
  console.log(`   yendo a 2, lo mas lejos que llego fue ${maxPos.toFixed(4)} (exceso ${exceso.toFixed(4)})`);
  if (exceso > 0.06) mal(`se pasa ${exceso.toFixed(3)} del destino: se veria un rebote`);
}

console.log();
console.log(fallos === 0 ? 'TODO BIEN: 6 pruebas sin fallos' : fallos + ' FALLO(S)');
process.exit(fallos ? 1 : 0);
