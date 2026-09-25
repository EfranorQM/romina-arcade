// LA ARENA: repisas, cascotes y escombros, medidos en Node sin navegador.
//
//   node tools/prueba-arena.mjs
//
// Importa los modulos REALES (caba-arena.js, caba-cuerpo.js, ogro-cuerpo.js) y
// comprueba que los obstaculos son JUSTOS: que se puede subir, que el aviso da
// tiempo a apartarse, que nada deja a nadie encerrado. Como en prueba-ogro.mjs,
// el piloto tiene RETARDO DE REACCION humano (0.25 s en movil): un piloto que
// reacciona en el mismo frame que aparece el aviso lo esquiva todo y miente.
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const G = (f) => pathToFileURL(path.join(here, '..', 'www', 'js', 'games', f)).href;
const C = await import(G('caba-cuerpo.js'));
const O = await import(G('ogro-cuerpo.js'));
const AR = await import(G('caba-arena.js'));

const DT = 1 / 60;
const REACCION = 0.25;
let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '   ok  ' : '   MAL ') + msg); if (!cond) fallos++; };
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const nada = { dx: 0, salta: false, golpea: false, esquiva: false, bloquea: false };
function semilla(s) {
  let x = s >>> 0;
  return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
const corre = (K, n, inp, M) => { for (let i = 0; i < n; i++) C.stepCaballero(K, inp || nada, DT, M); };

console.log('== 1) LAS REPISAS SE ALCANZAN SALTANDO, Y SE BAJA ANDANDO ==');
{
  const R = AR.REPISAS[0];
  const M = AR.mundo(AR.makeArena());
  const K = C.makeCaballero((R.x0 + R.x1) / 2);
  C.stepCaballero(K, { ...nada, salta: true }, DT, M);
  corre(K, 60, nada, M);
  // Un TOQUE basta. (Hasta el 24-09-2026 aqui se pedia ademas que un salto
  // cortado NO llegara, para que subir fuera una decision; pero cortado era
  // cualquier toque de pulgar de menos de 90 ms, y a la repisa no subia casi
  // nadie. El salto ya es siempre entero: subir es saltar debajo, y bajar es
  // salir andando por el borde.)
  ok(K.enSuelo && Math.abs(K.y - R.y) < 0.01, 'un toque de SALTAR desde debajo la deja DE PIE en la repisa (y=' + f1(K.y) + ')');
  // Andar hasta el borde: cae al suelo
  corre(K, 80, { ...nada, dx: 1 }, M);
  ok(Math.abs(K.y - C.SUELO) < 0.01 && K.x > R.x1, 'andando hacia fuera se cae por el borde y aterriza en el suelo');
  // En la repisa no le llegan las ondas del pisoton
  const K3 = C.makeCaballero((R.x0 + R.x1) / 2); K3.y = R.y;
  const og = O.makeOgro(R.x1 + 200);
  og.ondas.push({ x: K3.x, dir: -1, rec: 200, vivo: true });
  ok(!O.ondaGolpea(og, K3), 'de pie en la repisa, la onda del pisoton pasa por debajo');
}

console.log('== 2) LOS ESCOMBROS CORTAN EL PASO, SE SALTAN Y SE PISAN ==');
{
  const A = AR.makeArena();
  A.escombros.push({ x: 600, tipo: 0, ancho: AR.TIPOS[0].ancho, alto: AR.TIPOS[0].alto, t: 0 });
  const M = AR.mundo(A);
  const b = M.bloques[0];
  const K = C.makeCaballero(450);
  corre(K, 90, { ...nada, dx: 1 }, M);
  ok(K.x <= b.x0 - C.CUERPO_K + 0.01, 'andando contra el escombro se para en su borde (x=' + f1(K.x) + ', borde ' + f1(b.x0 - C.CUERPO_K) + ')');
  // saltando se pasa por encima
  C.stepCaballero(K, { ...nada, dx: 1, salta: true }, DT, M);
  corre(K, 50, { ...nada, dx: 1 }, M);
  ok(K.x > b.x1, 'con un salto completo corriendo, lo pasa por encima (x=' + f1(K.x) + ')');
  // y se puede quedar encima
  const K2 = C.makeCaballero(600);
  K2.y = b.top - 60; K2.enSuelo = false; K2.vy = 0;
  corre(K2, 40, nada, M);
  ok(K2.enSuelo && Math.abs(K2.y - b.top) < 0.01, 'cayendo encima se queda de pie sobre el escombro');
  // encima de un escombro tampoco le llega la onda (40 px > 34)
  const og = O.makeOgro(900); og.ondas.push({ x: K2.x, dir: -1, rec: 200, vivo: true });
  ok(!O.ondaGolpea(og, K2), 'de pie sobre un escombro, la onda pasa por debajo');
}

console.log('== 3) LOS CASCOTES AVISAN CON TIEMPO ==');
{
  const tLlegada = AR.AVISO_T + (-AR.CAE_V0 + Math.sqrt(AR.CAE_V0 ** 2 + 2 * AR.CAE_G * (C.SUELO - AR.CAE_Y0))) / AR.CAE_G;
  console.log('      del aviso al golpe: ' + tLlegada.toFixed(2) + ' s');
  // Quieta debajo: le cae
  {
    const A = AR.makeArena(); const K = C.makeCaballero(520); const og = O.makeOgro(1000);
    AR.sueltaPiedras(A, og, K, () => 0.5, 1);
    let golpe = false;
    for (let i = 0; i < 120 && !golpe; i++) { const ev = AR.stepArena(A, K, og, DT); golpe = ev.some(e => e.tipo === 'golpea'); }
    ok(golpe, 'quieta debajo, la piedra le da');
  }
  // Con reaccion humana se aparta: se prueba hacia los DOS lados y con piedras
  // de los tres tamaños.
  let salvadas = 0, total = 0;
  for (const dir of [-1, 1]) for (let tipo = 0; tipo < 3; tipo++) {
    const A = AR.makeArena(); const K = C.makeCaballero(560); const og = O.makeOgro(1000);
    A.piedras.push({ id: 1, x: K.x, tipo, fase: 'aviso', t: 0, y: AR.CAE_Y0, vy: 0 });
    let golpe = false;
    for (let i = 0; i < 120; i++) {
      const t = i * DT;
      C.stepCaballero(K, t >= REACCION ? { ...nada, dx: dir } : nada, DT, AR.mundo(A));
      const ev = AR.stepArena(A, K, og, DT);
      if (ev.some(e => e.tipo === 'golpea')) golpe = true;
    }
    total++; if (!golpe) salvadas++;
  }
  ok(salvadas === total, 'reaccionando a los ' + REACCION + ' s y corriendo, se aparta de ' + salvadas + ' de ' + total + ' piedras');
  // Esquivando (invulnerable) tampoco le entra. La piedra se pone rozandole la
  // cabeza cuando YA esta en la ventana invulnerable (desde ESQ_INV0): ponerla
  // antes mediria el instante del impulso, en que todavia no protege.
  {
    const A = AR.makeArena(); const K = C.makeCaballero(560); const og = O.makeOgro(1000);
    C.stepCaballero(K, { ...nada, esquiva: true }, DT, AR.mundo(A));
    corre(K, 5, nada, AR.mundo(A));
    ok(C.invulnerable(K), 'a los ' + (6 * DT).toFixed(2) + ' s de esquivar ya es invulnerable');
    A.piedras.push({ id: 1, x: K.x, tipo: 2, fase: 'cae', t: AR.AVISO_T, y: K.y - 172, vy: 1200 });
    let golpe = false;
    for (let i = 0; i < 4; i++) { C.stepCaballero(K, nada, DT, AR.mundo(A)); golpe = golpe || AR.stepArena(A, K, og, DT).some(e => e.tipo === 'golpea'); }
    ok(!golpe, 'esquivando en la ventana invulnerable, la piedra no le entra');
  }
}

console.log('== 4) DONDE CAEN LAS PIEDRAS ==');
{
  const rnd = semilla(77);
  let bajoRepisa = 0, pegadoOgro = 0, solapadas = 0, n = 0, maxEsc = 0;
  for (let ronda = 0; ronda < 300; ronda++) {
    const A = AR.makeArena();
    const K = C.makeCaballero(C.AX0 + 40 + rnd() * (C.AX1 - C.AX0 - 80));
    const og = O.makeOgro(C.AX0 + 100 + rnd() * (C.AX1 - C.AX0 - 200));
    for (let s = 0; s < 4; s++) {
      AR.sueltaPiedras(A, og, K, rnd, 3);
      for (const p of A.piedras) {
        n++;
        const T = AR.TIPOS[p.tipo];
        for (const r of AR.REPISAS) if (p.x + T.ancho / 2 > r.x0 && p.x - T.ancho / 2 < r.x1) bajoRepisa++;
      }
      for (let i = 0; i < A.piedras.length; i++) for (let j = i + 1; j < A.piedras.length; j++) {
        if (Math.abs(A.piedras[i].x - A.piedras[j].x) < 60) solapadas++;
      }
      for (let i = 0; i < 100; i++) AR.stepArena(A, { ...K, vivo: false }, { ...og, vivo: false, ondas: [] }, DT);
      maxEsc = Math.max(maxEsc, A.escombros.length);
      // las que no apuntan a ella nunca caen pegadas al ogro (se mira al soltar)
    }
    void pegadoOgro;
  }
  ok(bajoRepisa === 0, 'de ' + n + ' piedras, ninguna cae bajo una repisa (' + bajoRepisa + ')');
  ok(solapadas === 0, 'nunca caen dos piedras juntas en la misma tanda (' + solapadas + ')');
  ok(maxEsc <= AR.MAX_ESCOMBROS, 'nunca hay mas de ' + AR.MAX_ESCOMBROS + ' escombros a la vez (maximo visto: ' + maxEsc + ')');
}

console.log('== 5) EL OGRO REVIENTA LOS ESCOMBROS Y LAS ONDAS SE DESHACEN EN ELLOS ==');
{
  const A = AR.makeArena();
  A.escombros.push({ x: 600, tipo: 0, ancho: AR.TIPOS[0].ancho, alto: AR.TIPOS[0].alto, t: 0 });
  const og = O.makeOgro(800); const K = C.makeCaballero(200);
  let rompe = false;
  for (let i = 0; i < 300 && !rompe; i++) {
    O.stepOgro(og, K, DT, () => 0.99);          // 0.99: nunca elige atacar, solo anda
    rompe = AR.stepArena(A, K, og, DT).some(e => e.tipo === 'rompe');
  }
  ok(rompe && A.escombros.length === 0, 'el ogro, andando hacia ella, revienta el escombro que tiene delante');
  // la onda
  const A2 = AR.makeArena();
  A2.escombros.push({ x: 600, tipo: 2, ancho: AR.TIPOS[2].ancho, alto: AR.TIPOS[2].alto, t: 0 });
  const og2 = O.makeOgro(900); og2.st = O.ESPERA; og2.esperaT = 99;
  og2.ondas.push({ x: 800, dir: -1, rec: 100, vivo: true });
  const K2 = C.makeCaballero(450);
  let llega = false;
  for (let i = 0; i < 60; i++) {
    O.stepOgro(og2, K2, DT, () => 0.99); AR.stepArena(A2, K2, og2, DT);
    if (O.ondaGolpea(og2, K2)) llega = true;
  }
  ok(!llega, 'detras de un escombro, la onda no la alcanza');
}

console.log('== 6) UNA PIEDRA ENCIMA DEL OGRO LE HACE DAÑO ==');
{
  const A = AR.makeArena(); const og = O.makeOgro(700); og.esperaT = 99; const K = C.makeCaballero(200);
  const vida = og.hp;
  A.piedras.push({ id: 1, x: 700, tipo: 1, fase: 'cae', t: AR.AVISO_T, y: 0, vy: AR.CAE_V0 });
  let toca = false;
  for (let i = 0; i < 60; i++) toca = toca || AR.stepArena(A, K, og, DT).some(e => e.tipo === 'ogro');
  ok(toca && og.hp === vida - AR.DANO_OGRO, 'la piedra le quita ' + AR.DANO_OGRO + ' de vida (' + vida + ' -> ' + og.hp + ')');
}

console.log('');
console.log(fallos === 0 ? 'TODO OK' : fallos + ' FALLOS');
process.exit(fallos ? 1 : 0);
