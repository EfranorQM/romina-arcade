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
//   - lo que va por el suelo (barrido, fuego rastrero, relampago): SALTA
//   - el corro de la kitsune: se aparta
//   - la acometida del lobo: ESQUIVA hacia el (lo atraviesa); el picado del
//     cuervo: ESQUIVA fuera de su sombra en cuanto se fija
//   - el zarpazo, el tajo, el desenvaine, el zarpazo hacia arriba o una bola
//     de fuego que viene: GUARDIA
//   - una rama que cae cerca: se aparta
//   - un foso o un tronco delante: SALTA
//   - un enemigo al alcance: ATACA (encadenando el combo); al yamabushi, solo
//     cuando tiene la katana fuera, esta aturdido o de espaldas
//   - si no, corre hacia la salida

import * as C from '../www/js/games/caba-cuerpo.js';
import * as EN from '../www/js/games/caba-enemigos.js';

export const REAC = 15;
// Los ataques que se contestan con la GUARDIA (mirando hacia el que ataca).
const GUARDIA = ['zarpazo', 'tajo', 'iai', 'levanta', 'zarpa', 'estocada'];
const NADA = { dx: 0, salta: false, golpea: false, esquiva: false, bloquea: false };

// `m` es la memoria del piloto (se crea vacia: {}). `sem` varia un poco la
// distancia a la que despega en los fosos, como una persona. `reac`: sus
// reflejos, en frames (15 = 0.25 s; 21 = 0.35 s), o una funcion que da unos
// reflejos NUEVOS cada vez que ve algo: una persona no tarda siempre lo mismo
// (tools/prueba-peleas.mjs la usa con una normal, ver caba-partida.js).
// `machacon`: salta y ataca, pero no se defiende nunca (ni guardia, ni
// esquiva, ni se aparta): es la prueba de que los enemigos piden los cuatro
// botones.
export function piloto(n, K, L, m, sem = 1, reac = REAC, machacon = false) {
  const def = L.def;
  // Apartarse, si, pero no hacia un foso: a menos de 60 px del borde, quieta.
  const sinFoso = dx => (dx && def.fosos.some(([a, b]) => dx > 0 ? a - K.x > 0 && a - K.x < 60 : K.x - b > 0 && K.x - b < 60)) ? 0 : dx;
  m.visto = m.visto || new Map();
  const ve = (clave) => { if (!m.visto.has(clave)) m.visto.set(clave, n); return n - m.visto.get(clave); };
  // Lo que tarda en reaccionar a ESTA cosa (una vez por cosa si varia).
  const reacDe = (clave) => {
    if (typeof reac !== 'function') return reac;
    m.reacs = m.reacs || new Map();
    if (!m.reacs.has(clave)) m.reacs.set(clave, reac());
    return m.reacs.get(clave);
  };
  const inp = { ...NADA, dx: 1 };

  // --- Lo que viene, visto hace REAC frames o mas.
  // Cada ataque se sigue desde que empieza su aviso hasta que acaba el golpe:
  // si se contara desde el ultimo cambio de estado, al pasar del aviso al
  // golpe pareceria otro ataque recien empezado y soltaria la guardia justo
  // cuando llega la garra.
  m.ataque = m.ataque || {};
  let guardia = false, esquivaHacia = 0, aparta = 0, salta = false;
  for (const E of L.enemigos) {
    if (!E.vivo || !E.despierto) continue;
    const enAtaque = E.st === EN.AVISO || E.st === EN.ATACA;
    const a = m.ataque[E.id];
    if (enAtaque && (!a || a.fin || a.atk !== E.atk)) m.ataque[E.id] = { atk: E.atk, desde: n };
    if (!enAtaque) { if (a) a.fin = true; continue; }
    const hace = n - m.ataque[E.id].desde;
    if (hace < reacDe('a' + E.id + ':' + m.ataque[E.id].desde)) continue;
    const d = E.x - K.x;
    if (GUARDIA.includes(E.atk) && Math.abs(d) < 240) guardia = true;
    // EL MORDISCO de la vampira: se esquiva hacia atras, SIN STICK (la que
    // sale pulsando solo ESQUIVAR, que se para al borde de un foso: con el
    // stick hacia atras el piloto se tiraba a la tumba de detras)
    if (E.atk === 'muerde' && E.st === EN.AVISO && Math.abs(d) < 320) esquivaHacia = 'atras';
    // EL TAJO BAJO del vampiro: se salta como el barrido
    if (E.atk === 'bajo' && E.st === EN.AVISO && E.t >= E.T.bajo.aviso - 0.17 && Math.abs(d) < 230) salta = true;
    // EL PICADO: se esquiva al verlo FIJARSE (antes, la sigue), hacia donde
    // quede mas lejos de su sombra. Los reflejos cuentan desde que se fija.
    if (E.atk === 'picado' && E.st === EN.ATACA && (E.fase === 'fija' || E.fase === 'cae')) {
      const k = 'fija' + E.id + ':' + m.ataque[E.id].desde;
      if (ve(k) >= reacDe(k) && Math.abs(d) < E.T.picado.radio + 60) esquivaHacia = -(Math.sign(d) || 1);
    }
    // EL RELAMPAGO: se salta por el ritmo, como el barrido: justo cuando
    // arranca (o ya cruzando, si se le paso el momento).
    if (E.atk === 'relampago' && Math.abs(d) < 520 &&
        ((E.st === EN.AVISO && E.t >= E.T.relampago.aviso - 0.06) || (E.st === EN.ATACA && !E.golpeo))) salta = true;
    // la bola creciendo en la mano: ya sabe que viene una (no hay que
    // volver a reaccionar cuando sale). Y la sangre girando en la mano de la
    // condesa, igual: sin esto el piloto reaccionaba al dardo ya en el aire
    // (0.25 s hasta ella) y se los comia todos (25-09-2026: 75 corazones en
    // 16 peleas en PASEO en cuanto la condesa lanzo de verdad).
    if ((E.atk === 'lanza' || E.atk === 'dardo') && E.st === EN.AVISO) m.anticipa = true;
    // LA ACOMETIDA se atraviesa agachado o ya volando hacia ella (hasta el
    // 24-09-2026 solo agachado: con reflejos de mas de lo que dura el aviso,
    // 0.62 s en PASEO, el piloto no la esquivaba nunca y se la comia; una
    // persona la ve venir volando y esquiva)
    if (E.atk === 'acomete' && Math.abs(d) < 420 &&
        (E.st === EN.AVISO || (E.st === EN.ATACA && !E.golpeo && (K.x - E.x) * E.dir > 0))) esquivaHacia = Math.sign(d) || 1;
    if (E.atk === 'corro' && Math.abs(d) < 260) aparta = -(Math.sign(d) || 1);
    // EL BARRIDO BAJO: se salta justo antes de que barra (lo que una persona
    // cronometra mirando como se echa atras), nunca antes de verlo.
    if (E.atk === 'barre' && E.st === EN.AVISO && E.t >= E.T.barre.aviso - 0.17 && Math.abs(d) < 220) salta = true;
  }
  // LAS BOLAS: la guardia se levanta cuando le faltan 0.22 s para llegar,
  // que es la PARADA: se la devuelve. (Con la guardia puesta desde el aviso,
  // la bola llegaba con la guardia ya vieja: la paraba sin devolverla.)
  let bolas = 0;
  for (const F of L.fuegos) {
    if (F.propio || F.fin || F.gota) continue;
    // LA LLAMA RASTRERA: se salta cuando le va a llegar (como la onda del ogro).
    if (F.rastrero) {
      const viene = (F.x - K.x) * Math.sign(F.vx) < 0;
      const llega = (Math.abs(F.x - K.x) - EN.RASTRERO_R - 16) / Math.abs(F.vx);
      if (viene && ve('f' + F.id) >= reacDe('f' + F.id) && llega < 0.17) salta = true;
      continue;
    }
    bolas++;
    const hace = ve('f' + F.id);
    const viene = (F.x - K.x) * Math.sign(F.vx) < 0;
    const llega = (Math.abs(F.x - K.x) - EN.FUEGO_R - 22) / Math.abs(F.vx);
    if (viene && (hace >= reacDe('f' + F.id) || m.anticipa) && llega < 0.22) guardia = true;
  }
  if (!bolas && !L.enemigos.some(E => (E.atk === 'lanza' || E.atk === 'dardo') && E.st === EN.AVISO)) m.anticipa = false;

  if (machacon) { guardia = false; esquivaHacia = 0; aparta = 0; m.aparta = 0; salta = false; }
  // Saltar lo que va por el suelo manda: si llega y esta en el suelo, salta.
  if (salta && K.enSuelo && K.st !== C.ESQUIVA) { inp.dx = 0; inp.salta = true; return inp; }
  // Por orden: del corro solo libra apartarse; la acometida se atraviesa (y
  // esquivando tambien pasa cualquier bola); lo demas, con la guardia.
  if (aparta) { inp.dx = sinFoso(aparta); m.aparta = 12; m.dirAparta = aparta; return inp; }
  if (m.aparta > 0) { m.aparta--; inp.dx = sinFoso(m.dirAparta); return inp; }
  if (esquivaHacia && K.enSuelo && K.esqCd <= 0) {
    inp.dx = esquivaHacia === 'atras' ? 0 : esquivaHacia; inp.esquiva = true;
    return inp;
  }
  // A mitad de un tajo la guardia no sube: si hay que cubrirse, se cancela
  // el tajo esquivando hacia atras (la esquiva manda sobre el tajo).
  if (guardia && K.st === C.TAJO && K.esqCd <= 0) { inp.dx = 0; inp.esquiva = true; return inp; }
  // --- La GUARDIA mira hacia lo que viene: se gira con el stick.
  if (guardia && K.enSuelo) {
    const amenaza = L.fuegos.find(F => !F.propio && !F.fin && Math.abs(F.x - K.x) < 300) ||
                    L.enemigos.find(E => E.vivo && GUARDIA.includes(E.atk) && (E.st === EN.AVISO || E.st === EN.ATACA) && Math.abs(E.x - K.x) < 260);
    const hacia = amenaza ? Math.sign(amenaza.x - K.x) || 1 : K.dir;
    if (K.dir !== hacia) { inp.dx = hacia * 0.5; return inp; }    // girarse primero
    inp.dx = 0; inp.bloquea = true;
    return inp;
  }

  // --- Las ramas: mira TODAS las sombras que ya ha visto y va hacia donde
  // dentro de medio segundo quede mas lejos de la mas cercana (con una sola,
  // al apartarse de una se metia debajo de otra).
  for (const R of L.ramas) ve('r' + R.id);
  // (y las SOMBRAS ROJAS de la lluvia de la condesa, igual)
  for (const F of L.fuegos) if (F.gota && !F.fin) ve('g' + F.id);
  const gotas = machacon ? [] : L.fuegos.filter(F => F.gota && !F.fin && n - m.visto.get('g' + F.id) >= reacDe('g' + F.id)).map(F => F.x);
  const sombras = (machacon ? [] : L.ramas.filter(R => n - m.visto.get('r' + R.id) >= reacDe('r' + R.id)).map(R => R.x)).concat(gotas);
  // Con varias sombras juntas (la lluvia: tres, a 160 px) mirar solo a 120 px
  // a cada lado caia justo encima de las de al lado, y el piloto iba y venia
  // sin salir de la suya. Una persona da un paso al HUECO: el sitio cercano,
  // con suelo, mas lejos de todas; y va hasta el.
  if (sombras.some(x => Math.abs(x - K.x) < (gotas.includes(x) ? 76 : 110))) {
    // (sin cruzar otra sombra por el camino: el sitio mas lejos de todas
    // quedaba al otro lado de la gota de al lado, y corria por debajo de ella)
    let mejor = K.x, holgura = -1;
    for (let d = -240; d <= 240; d += 10) {
      const x = K.x + d;
      if (def.fosos.some(([a, b]) => x > a - 30 && x < b + 30)) continue;
      if (sombras.some(sx => (sx - K.x) * d > 0 && Math.abs(sx - K.x) > 40 && Math.abs(sx - K.x) < Math.abs(d) + 40)) continue;
      const h = Math.min(...sombras.map(s => Math.abs(s - x))) - Math.abs(d) * 0.05;
      if (h > holgura) { holgura = h; mejor = x; }
    }
    inp.dx = Math.abs(mejor - K.x) < 8 ? 0 : Math.sign(mejor - K.x);
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
  const tronco = L.troncos.find(T => n - m.visto.get('t' + T.id) >= reacDe('t' + T.id) && T.x > K.x && T.x - K.x < 170 && !T.cae);
  const toconSalta = enTocon && L.tocones.some(T => K.x > T.x1 - 20);
  // Un TOQUE, como un pulgar: hasta el 24-09-2026 este piloto MANTENIA el
  // boton 40 frames, y el salto se recortaba si se soltaba antes de 90 ms.
  // Nadie juega asi en un movil, y por eso el arnes no vio que con un toque
  // no se cruzaba ningun foso. Ahora el salto es siempre entero.
  if (K.enSuelo && (foso || tronco || toconSalta)) { inp.salta = true; return inp; }

  // --- Enemigos: el mas cercano delante (o detras, si esta encima).
  // (Mientras la manada del jefe pelea, el jefe cuenta como 400 px mas lejos:
  // una persona pelea con el lobo que se le echa encima, no persigue al jefe,
  // que se aparta.)
  let blanco = null, lejos = Infinity;
  for (const E of L.enemigos) {
    if (!E.vivo || !E.despierto || E.oculto || E.st === EN.MUERTO) continue;
    const d = Math.abs(E.x - K.x) + (E.T.jefe && E.manada && E.manada.some(W => W.vivo && W.despierto) ? 400 : 0);
    if (d < 600 && d < lejos) { blanco = E; lejos = d; }
  }
  if (blanco) {
    const d = blanco.x - K.x, ad = Math.abs(d), hacia = Math.sign(d) || 1;
    // LA KITSUNE: pegarse a ella es comerse el corro (el tajo no deja
    // apartarse). Se le guarda la distancia, se le devuelven las bolas (arriba)
    // y se le pega si se queda agotada o dolida cerca.
    if (blanco.tipo === 'kitsune' && !machacon) {
      // Fuera de SU tramo la kitsune no ataca (espera), y guardarle la
      // distancia era esperarse las dos para siempre: aterrizando del foso en
      // el mismo borde (x 2887-2899, el tramo empieza en 2900) el piloto se
      // quedaba ahi 300 s (24-09-2026, con reflejos de 0.45 s). Una persona
      // sigue andando.
      if (K.x < blanco.tramo[0] || K.x > blanco.tramo[1]) { inp.dx = hacia; return inp; }
      const abierta = blanco.st === EN.AGOTADA || blanco.st === EN.DOLOR;
      if (blanco.st === EN.ATACA) { inp.dx = sinFoso(-hacia); return inp; }
      if (!abierta || ad > 260) { inp.dx = ad > 480 ? hacia : ad < 360 ? sinFoso(-hacia) : 0; return inp; }
    }
    // EL CUERVO EN EL AIRE: no se le alcanza; se le espera debajo.
    if (blanco.alt > 40) { inp.dx = 0; return inp; }
    // EL YAMABUSHI: de frente y en guardia para los golpes. Se le espera a
    // tiro de su desenvaine (que lo pare la guardia) y se le pega cuando
    // tiene la katana fuera, aturdido, dolido o de espaldas.
    if (blanco.tipo === 'yamabushi' && !machacon) {
      const abierto = blanco.st === EN.RECUPERA || blanco.st === EN.AGOTADA || blanco.st === EN.DOLOR ||
                      (blanco.st === EN.ATACA && blanco.atk === 'relampago') || blanco.dir === Math.sign(blanco.x - K.x);
      if (!abierto) { inp.dx = ad > 150 ? hacia : 0; if (ad <= 150 && K.dir !== hacia) inp.dx = hacia * 0.5; return inp; }
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
