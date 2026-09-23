// EL PILOTO de la aventura: juega el nivel como una persona con buenos
// reflejos, pero de persona. Lo usan el arnes (tools/prueba-nivel.mjs) y la
// grabadora (tools/ver-aventura.html), para que lo que se mide y lo que se ve
// sea lo mismo.
//
// NUNCA contesta en el mismo frame en que algo empieza: ve el aviso y
// reacciona REAC frames despues (15 = 0.25 s). Un piloto que reacciona al
// instante lo hace todo y no demuestra nada (ver la memoria del arnes que
// miente).
//
// Lo que hace, por orden de urgencia:
//   - el zarpazo del lobo o una bola de fuego que viene: GUARDIA
//   - la acometida del lobo: ESQUIVA hacia el (lo atraviesa)
//   - el corro de la kitsune: se aparta
//   - una rama que cae cerca: se aparta
//   - un foso o un tronco delante: SALTA
//   - un enemigo al alcance: ATACA (encadenando el combo)
//   - si no, corre hacia la salida

import * as C from '../www/js/games/caba-cuerpo.js';
import * as EN from '../www/js/games/caba-enemigos.js';

export const REAC = 15;
const NADA = { dx: 0, salta: false, golpea: false, esquiva: false, saltaAbajo: false, bloquea: false };

// `m` es la memoria del piloto (se crea vacia: {}). `sem` varia un poco la
// distancia a la que despega en los fosos, como una persona. `reac`: sus
// reflejos, en frames (15 = 0.25 s, una persona rapida; 21 = 0.35 s, normal).
// `machacon`: salta y ataca, pero no se defiende nunca (ni guardia, ni
// esquiva, ni se aparta): es la prueba de que los enemigos piden los cuatro
// botones.
export function piloto(n, K, L, m, sem = 1, reac = REAC, machacon = false) {
  const def = L.def;
  // Apartarse, si, pero no hacia un foso: a menos de 60 px del borde, quieta.
  const sinFoso = dx => (dx && def.fosos.some(([a, b]) => dx > 0 ? a - K.x > 0 && a - K.x < 60 : K.x - b > 0 && K.x - b < 60)) ? 0 : dx;
  m.visto = m.visto || new Map();
  const ve = (clave) => { if (!m.visto.has(clave)) m.visto.set(clave, n); return n - m.visto.get(clave); };
  const inp = { ...NADA, dx: 1 };
  if (m.salto > 0) { inp.saltaAbajo = true; m.salto--; }

  // --- Lo que viene, visto hace REAC frames o mas.
  // Cada ataque se sigue desde que empieza su aviso hasta que acaba el golpe:
  // si se contara desde el ultimo cambio de estado, al pasar del aviso al
  // golpe pareceria otro ataque recien empezado y soltaria la guardia justo
  // cuando llega la garra.
  m.ataque = m.ataque || {};
  let guardia = false, esquivaHacia = 0, aparta = 0;
  for (const E of L.enemigos) {
    if (!E.vivo || !E.despierto) continue;
    const enAtaque = E.st === EN.AVISO || E.st === EN.ATACA;
    const a = m.ataque[E.id];
    if (enAtaque && (!a || a.fin || a.atk !== E.atk)) m.ataque[E.id] = { atk: E.atk, desde: n };
    if (!enAtaque) { if (a) a.fin = true; continue; }
    const hace = n - m.ataque[E.id].desde;
    if (hace < reac) continue;
    const d = E.x - K.x;
    if (E.atk === 'zarpazo' && Math.abs(d) < 240) guardia = true;
    // la bola creciendo en la mano: ya sabe que viene una (no hay que
    // volver a reaccionar cuando sale)
    if (E.atk === 'lanza' && E.st === EN.AVISO) m.anticipa = true;
    if (E.atk === 'acomete' && E.st === EN.AVISO && Math.abs(d) < 420) esquivaHacia = Math.sign(d) || 1;
    if (E.atk === 'corro' && Math.abs(d) < 260) aparta = -(Math.sign(d) || 1);
  }
  // LAS BOLAS: la guardia se levanta cuando le faltan 0.22 s para llegar,
  // que es la PARADA: se la devuelve. (Con la guardia puesta desde el aviso,
  // la bola llegaba con la guardia ya vieja: la paraba sin devolverla.)
  let bolas = 0;
  for (const F of L.fuegos) {
    if (F.propio || F.fin) continue;
    bolas++;
    const hace = ve('f' + F.id);
    const viene = (F.x - K.x) * Math.sign(F.vx) < 0;
    const llega = (Math.abs(F.x - K.x) - EN.FUEGO_R - 22) / Math.abs(F.vx);
    if (viene && (hace >= reac || m.anticipa) && llega < 0.22) guardia = true;
  }
  if (!bolas && !L.enemigos.some(E => E.atk === 'lanza' && E.st === EN.AVISO)) m.anticipa = false;

  if (machacon) { guardia = false; esquivaHacia = 0; aparta = 0; m.aparta = 0; }
  // Por orden: del corro solo libra apartarse; la acometida se atraviesa (y
  // esquivando tambien pasa cualquier bola); lo demas, con la guardia.
  if (aparta) { inp.dx = sinFoso(aparta); m.aparta = 12; m.dirAparta = aparta; return inp; }
  if (m.aparta > 0) { m.aparta--; inp.dx = sinFoso(m.dirAparta); return inp; }
  if (esquivaHacia && K.enSuelo && K.esqCd <= 0) {
    inp.dx = esquivaHacia; inp.esquiva = true;
    return inp;
  }
  // A mitad de un tajo la guardia no sube: si hay que cubrirse, se cancela
  // el tajo esquivando hacia atras (la esquiva manda sobre el tajo).
  if (guardia && K.st === C.TAJO && K.esqCd <= 0) { inp.dx = 0; inp.esquiva = true; return inp; }
  // --- La GUARDIA mira hacia lo que viene: se gira con el stick.
  if (guardia && K.enSuelo) {
    const amenaza = L.fuegos.find(F => !F.propio && !F.fin && Math.abs(F.x - K.x) < 300) ||
                    L.enemigos.find(E => E.vivo && E.atk === 'zarpazo' && (E.st === EN.AVISO || E.st === EN.ATACA));
    const hacia = amenaza ? Math.sign(amenaza.x - K.x) || 1 : K.dir;
    if (K.dir !== hacia) { inp.dx = hacia * 0.5; return inp; }    // girarse primero
    inp.dx = 0; inp.bloquea = true;
    return inp;
  }

  // --- Las ramas: mira TODAS las sombras que ya ha visto y va hacia donde
  // dentro de medio segundo quede mas lejos de la mas cercana (con una sola,
  // al apartarse de una se metia debajo de otra).
  for (const R of L.ramas) ve('r' + R.id);
  const sombras = machacon ? [] : L.ramas.filter(R => n - m.visto.get('r' + R.id) >= reac).map(R => R.x);
  if (sombras.some(x => Math.abs(x - K.x) < 110)) {
    let mejor = 0, lejos = -1;
    for (const dx of [1, 0, -1].filter(d => sinFoso(d) === d)) {
      const x = K.x + dx * 240 * 0.5;
      const d = Math.min(...sombras.map(s => Math.abs(s - x)));
      if (d > lejos + 1) { lejos = d; mejor = dx; }
    }
    inp.dx = mejor;
    return inp;
  }

  // --- Sin carrerilla no se llega al otro lado: si se ha quedado parada
  // cerca de un borde (cubriendose de una bola, por ejemplo), se echa atras y
  // vuelve a coger impulso, como haria cualquiera.
  if (m.atras > 0) { m.atras--; inp.dx = -1; if (!m.atras) m.impulso = 40; return inp; }
  if (m.impulso > 0) m.impulso--;
  const borde = def.fosos.map(([a]) => a).concat(L.tocones.filter(T => K.y < def.suelo - 1).map(T => T.x1))
    .find(a => a - K.x > -8 && a - K.x < 70);
  if (borde !== undefined && K.enSuelo && K.vx < 200 && !m.impulso) { m.atras = 14; inp.dx = -1; return inp; }

  // --- Fosos, tocones y troncos: saltar.
  for (const T of L.troncos) ve('t' + T.id);
  // (Despega entre 8 px despues del borde y 18 antes: el salto recorre 127
  // px en el aire y el foso de 120 no se cruza despegando a 24 del borde.)
  const foso = def.fosos.find(([a]) => a - K.x > -8 && a - K.x < 6 + (sem % 4) * 4);
  const enTocon = K.enSuelo && K.y < def.suelo - 1;
  const tronco = L.troncos.find(T => n - m.visto.get('t' + T.id) >= reac && T.x > K.x && T.x - K.x < 170 && !T.cae);
  const toconSalta = enTocon && L.tocones.some(T => K.x > T.x1 - 20);
  if (K.enSuelo && (foso || tronco || toconSalta)) { inp.salta = true; inp.saltaAbajo = true; m.salto = 40; return inp; }

  // --- Enemigos: el mas cercano delante (o detras, si esta encima).
  let blanco = null;
  for (const E of L.enemigos) {
    if (!E.vivo || !E.despierto || E.st === EN.MUERTO) continue;
    const d = E.x - K.x;
    if (Math.abs(d) < 600 && (!blanco || Math.abs(d) < Math.abs(blanco.x - K.x))) blanco = E;
  }
  if (blanco) {
    const d = blanco.x - K.x, ad = Math.abs(d), hacia = Math.sign(d) || 1;
    // LA KITSUNE: pegarse a ella es comerse el corro (el tajo no deja
    // apartarse). Se le guarda la distancia, se le devuelven las bolas (arriba)
    // y se le pega si se queda agotada o dolida cerca.
    if (blanco.tipo === 'kitsune' && !machacon) {
      const abierta = blanco.st === EN.AGOTADA || blanco.st === EN.DOLOR;
      if (blanco.st === EN.ATACA) { inp.dx = sinFoso(-hacia); return inp; }
      if (!abierta || ad > 260) { inp.dx = ad > 480 ? hacia : ad < 360 ? sinFoso(-hacia) : 0; return inp; }
    }
    if (ad < 120) {
      inp.dx = K.dir !== hacia ? hacia : 0;
      // encadena: pulsa en cuanto puede enlazar (cada 16 frames)
      if (K.dir === hacia && (m.ultimoTajo === undefined || n - m.ultimoTajo >= 16)) { inp.golpea = true; m.ultimoTajo = n; }
      return inp;
    }
    // acercarse (un lobo recargando no se come la acometida)
    inp.dx = hacia;
    return inp;
  }
  return inp;
}
