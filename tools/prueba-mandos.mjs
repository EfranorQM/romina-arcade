// LOS MANDOS de ROMINA, medidos en Node: los cuatro botones y el stick.
//
//   node tools/prueba-mandos.mjs
//
// POR QUE EXISTE (24-09-2026). Ella y Anderson: "el tamaño o posicion de los
// botones no es lo suficientemente rapido o comodo". Medidos, los de antes:
// medallones de 7.7-9.7 mm en su telefono (menos que la yema de un pulgar), el
// 46 % del rectangulo de los botones no era de ningun boton, GUARDIA (que se
// miraba primero) se quedaba el 8 % de la zona de SALTAR, y SALTAR estaba
// arriba del todo. Nada de eso se ve en una captura: hay que contar a quien le
// toca cada punto de la pantalla, y eso hace esto, con la MISMA funcion que la
// escena (MD.aQuien) y el MISMO stick (input.js).
import fs from 'fs';
import * as MD from '../www/js/games/caba-mandos.js';
import { Stick } from '../www/js/input.js';

let fallos = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  MAL  ') + msg); if (!c) fallos++; };
const mm = px => (px * MD.MM).toFixed(1) + ' mm';
const B = MD.BOTONES, NOMBRES = Object.keys(B);
const W = 1200, H = 540;

// Los de antes, solo para comparar (caballero.js hasta la v1.0.23): se
// miraban por orden y cada uno llegaba a r + 20.
const ANTES = { esquivar: { x: 1016, y: 452, r: 32 }, guardia: { x: 1016, y: 336, r: 32 },
                atacar: { x: 1132, y: 428, r: 40 }, saltar: { x: 1096, y: 300, r: 34 } };
const aQuienAntes = (x, y) => ['esquivar', 'guardia', 'atacar', 'saltar'].find(k => Math.hypot(x - ANTES[k].x, y - ANTES[k].y) <= ANTES[k].r + 20) || null;

// El rectangulo que ocupan los botones (con 10 px de aire): ahi, todo toque
// deberia ser de alguien.
function caja(bs) {
  const ks = Object.keys(bs);
  return [Math.min(...ks.map(k => bs[k].x - bs[k].r)) - 10, Math.min(...ks.map(k => bs[k].y - bs[k].r)) - 10,
          Math.max(...ks.map(k => bs[k].x + bs[k].r)) + 10, Math.max(...ks.map(k => bs[k].y + bs[k].r)) + 10];
}
function huecos(bs, quien) {
  const [x0, y0, x1, y1] = caja(bs);
  let h = 0, n = 0;
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { n++; if (!quien(x, y)) h++; }
  return h / n;
}
// De los puntos del DIBUJO de un boton, cuantos se lleva otro.
function robados(bs, k, quien) {
  const b = bs[k];
  let r = 0, n = 0;
  for (let y = b.y - b.r; y <= b.y + b.r; y++) for (let x = b.x - b.r; x <= b.x + b.r; x++) {
    if (Math.hypot(x - b.x, y - b.y) > b.r) continue;
    n++; if (quien(x, y) !== k) r++;
  }
  return r / n;
}

console.log('\n1. EL TAMAÑO, en el telefono de ella');
for (const k of NOMBRES) console.log('  ' + k.padEnd(9) + ' dibujo ' + mm(2 * B[k].r) + ' (antes ' + mm(2 * ANTES[k].r) + ')');
ok(NOMBRES.every(k => 2 * B[k].r * MD.MM >= 10), 'ningun boton mide menos de 10 mm (la yema de un pulgar: 10-14)');
ok(2 * B.saltar.r * MD.MM >= 11 && 2 * B.atacar.r * MD.MM >= 11, 'SALTAR y ATACAR, los que mas se pulsan, miden al menos 11 mm');

console.log('\n2. A QUIEN LE TOCA CADA TOQUE');
const q = (x, y) => MD.aQuien(x, y);
const hN = huecos(B, q), hA = huecos(ANTES, aQuienAntes);
console.log('  huecos entre los botones: ' + (hN * 100).toFixed(0) + ' % (antes ' + (hA * 100).toFixed(0) + ' %)');
ok(hN === 0, 'ningun toque entre los botones se pierde');
for (const k of NOMBRES) {
  const r = robados(B, k, q);
  ok(r === 0, 'todo el dibujo de ' + k.toUpperCase() + ' es suyo (antes otro se llevaba el ' + (robados(ANTES, k, aQuienAntes) * 100).toFixed(0) + ' % de el)');
}
// Tambien el borde de la zona de SALTAR que antes se llevaba GUARDIA.
{
  const b = ANTES.saltar;
  let suyos = 0, n = 0;
  for (let y = b.y - b.r - 20; y <= b.y + b.r + 20; y++) for (let x = b.x - b.r - 20; x <= b.x + b.r + 20; x++) {
    if (Math.hypot(x - b.x, y - b.y) > b.r + 20) continue;
    n++; if (aQuienAntes(x, y) === 'saltar') suyos++;
  }
  console.log('  (antes, de la zona de SALTAR solo era suyo el ' + (suyos / n * 100).toFixed(0) + ' %: el resto se lo quedaba GUARDIA)');
}
// Lejos de los botones no pulsa nada: el centro, el stick, el marcador, la pausa.
for (const [x, y, que] of [[600, 300, 'el centro'], [150, 450, 'el stick'], [1100, 30, 'el reloj'], [600, 14, 'la pausa'], [760, 470, 'a media pantalla']]) {
  ok(MD.aQuien(x, y) === null, 'un toque en ' + que + ' (' + x + ',' + y + ') no pulsa ningun boton');
}

console.log('\n3. DONDE ESTA CADA UNO');
// La espada a la izquierda (GUARDIA sobre ATACAR), las piernas a la derecha
// (ESQUIVAR sobre SALTAR); abajo los dos que mas se pulsan.
ok(B.guardia.x < B.esquivar.x && B.atacar.x < B.saltar.x, 'la espada (GUARDIA, ATACAR) a la izquierda y las piernas (ESQUIVAR, SALTAR) a la derecha');
ok(B.atacar.y > B.guardia.y && B.saltar.y > B.esquivar.y, 'ATACAR y SALTAR abajo, donde descansa el pulgar');
ok(Math.abs(B.guardia.x - B.atacar.x) < 1 && Math.abs(B.esquivar.x - B.saltar.x) < 1, 'cada columna, recta: de GUARDIA a ATACAR (parar y contraatacar) se baja el pulgar');
// No se pisan, ni los nombres que llevan debajo (rotulo a y + r + 5, 14 px).
let pisan = false;
for (const a of NOMBRES) for (const b of NOMBRES) if (a < b && Math.hypot(B[a].x - B[b].x, B[a].y - B[b].y) < B[a].r + B[b].r + 8) pisan = true;
ok(!pisan, 'los medallones no se tocan (8 px de aire como poco)');
let nombrePisa = false;
for (const a of NOMBRES) {
  const ny0 = B[a].y + B[a].r + 5, ny1 = ny0 + 14;
  for (const b of NOMBRES) if (b !== a && Math.abs(B[b].x - B[a].x) < B[b].r + 30 && B[b].y - B[b].r < ny1 && B[b].y > B[a].y) nombrePisa = true;
  if (ny1 > H - 2) nombrePisa = true;
}
ok(!nombrePisa, 'el nombre de cada boton cabe debajo sin pisar al de abajo ni salirse');
ok(NOMBRES.every(k => B[k].x + B[k].r <= W - 16 && B[k].y + B[k].r <= H - 16), 'todos a 16 px o mas del borde de la pantalla');

console.log('\n4. EL STICK (el de input.js, con la curva de la escena)');
const stick = () => new Stick(MD.STICK_R, MD.STICK_MUERTO);
const a = milimetros => { const S = stick(); S.down({ id: 1, x: 0, y: 0 }); S.move({ id: 1, x: milimetros / MD.MM, y: 0 }); return MD.curvaStick(S.dx); };
console.log('  ' + [1, 1.5, 2, 3, 4, 4.5, 6].map(v => v + ' mm: ' + Math.round(a(v) * 100) + ' %').join('   '));
ok(a(1) === 0, 'el temblor del pulgar apoyado (1 mm) no la mueve');
ok(a(4.5) === 1, 'con 4.5 mm corre a tope (antes hacian falta 9.7 mm)');
// Darse la vuelta: tras correr a la derecha con el pulgar muy pasado, cuanto
// hay que volver para correr a tope a la izquierda.
{
  const S = stick();
  S.down({ id: 1, x: 0, y: 0 }); S.move({ id: 1, x: 200, y: 0 });
  let x = 200;
  while (MD.curvaStick(S.dx) > -1 && x > -400) { x -= 1; S.move({ id: 1, x, y: 0 }); }
  const vuelta = 200 - x;
  console.log('  darse la vuelta a tope: ' + mm(vuelta) + ' de pulgar (antes ' + mm(160) + ')');
  ok(vuelta * MD.MM <= 12, 'darse la vuelta a tope pide 12 mm o menos');
}

console.log('\n5. LA ESCENA USA ESTO');
// Un arnes que mide una tabla que el juego no usa miente (ver la memoria del
// arnes que miente): se comprueba que caballero.js reparte los toques con
// MD.aQuien y pone los botones de MD.BOTONES, y que el stick pasa por la curva
// en la pelea y en la aventura.
const esc = fs.readFileSync(new URL('../www/js/games/caballero.js', import.meta.url), 'utf8');
const av = fs.readFileSync(new URL('../www/js/games/caba-aventura.js', import.meta.url), 'utf8');
ok(/MD\.aQuien\(/.test(esc), 'caballero.js reparte los toques con MD.aQuien');
ok(/MD\.BOTONES\[/.test(esc) && /MD\.ZONA/.test(esc), 'y pone los botones donde dice MD.BOTONES');
ok(/new Stick\(MD\.STICK_R, MD\.STICK_MUERTO\)/.test(esc), 'el stick de la escena es el de MD');
ok(/MD\.curvaStick\(this\.stick\.dx\)/.test(esc) && /MD\.curvaStick\(S\.stick\.dx\)/.test(av), 'y pasa por la curva en la pelea y en la aventura');

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTODO OK');
process.exit(fallos ? 1 : 0);
