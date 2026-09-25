// LOS ENEMIGOS de la aventura: el HOMBRE LOBO, la KITSUNE, los dos TENGUS y
// el LOBO BLANCO. SIN DOM, como caba-cuerpo.js y ogro-cuerpo.js: el nivel
// (caba-nivel.js), la escena y el arnes (tools/prueba-nivel.mjs) mueven
// exactamente esto.
//
// La ley es la del ogro: CADA ATAQUE AVISA Y TIENE SU RESPUESTA, y no hay un
// boton que valga para todo.
//
//   LOBO     ZARPAZO    se alza y suelta la garra de cerca. Se PARA con la
//                       GUARDIA; a tiempo es una PARADA y el siguiente ATACAR
//                       es contraataque.
//            ACOMETIDA  se agacha y se lanza en plancha desde media distancia.
//                       Rompe la guardia: se ESQUIVA atravesandolo (o se salta).
//            BARRIDO BAJO  se echa atras con los brazos abiertos y barre a ras
//                       de suelo: rompe la guardia; se SALTA.
//   KITSUNE  BOLA DE FUEGO  le crece en la mano y la lanza a la altura del
//                       pecho: saltar no sirve. La GUARDIA la apaga, y una
//                       PARADA se la DEVUELVE (y le quema a ella).
//            CORRO DE FUEGO  si ella se le pega, se rodea de fuegos: rompe la
//                       guardia. Hay que apartarse; despues se queda agotada y
//                       es cuando se le pega.
//            FUEGO RASTRERO  agita las colas, le brotan llamas a los pies y las
//                       manda por el suelo hacia ella: la guardia no lo apaga
//                       (va por el suelo); se SALTA.
// Asi cada uno pide TRES botones: GUARDIA, ESQUIVAR y SALTAR. Los dos ultimos
// (24-09-2026) salen de animaciones del pack que no se usaban. Que ataques
// usa cada uno lo dice el nivel (`ataques`): el bosque los enseña de uno en
// uno, y el aviso de cada ataque brilla del color del boton que lo contesta
// (RESPUESTA, abajo; lo pinta la escena).
//
// Los tres del final del bosque (24-09-2026) traen cada uno UNA idea nueva:
//   KARASU   (el cuervo) ATACA DESDE EL AIRE. EL PICADO: sube, se queda
//            encima de ella siguiendola, se envuelve en las alas y cae. Su
//            SOMBRA en el camino dice donde: hay que salir de ella, y lo que
//            saca a tiempo es ESQUIVAR (andando no da). Cae con todo: rompe la
//            guardia, y saltar es meterse en su camino. Al caer se queda
//            abriendo las alas: es cuando se le pega. De cerca, el TAJO desde
//            arriba, que se PARA como el zarpazo.
//   YAMABUSHI (el de la mascara roja) SE CUBRE: de frente y quieto, para los
//            golpes de ella con la katana (y contesta desenvainando). Se le
//            gana esperando SU golpe: EL DESENVAINE (la mano en la empuñadura
//            cuatro fotogramas, y un tajo largo) se para con la GUARDIA, y
//            despues se queda abierto; si fue PARADA, aturdido un buen rato.
//            De lejos cruza de un RELAMPAGO a ras de suelo: se SALTA, y
//            queda de espaldas.
//   ALFA     (el lobo blanco, jefe de la manada) guarda la salida. AULLA al
//            verla y llama a un lobo de su manada, y espera apartado a que
//            ella acabe con el; a media vida aulla otra vez. Sabe todo lo del
//            lobo y EL ZARPAZO HACIA ARRIBA, que se PARA: y como alcanza
//            tambien por encima, saltar (lo que pide el barrido) no sirve.
//            Hay que mirar el color del aviso.
//
// Los numeros de los avisos salen de los dibujos (el lobo tarda cuatro
// fotogramas en alzarse; la bola crece seis) y se miden en el arnes: cada
// respuesta tiene que tener su ventana de al menos 200-250 ms.

import * as C from './caba-cuerpo.js';

// Estados
export const ESPERA = 0, ANDA = 1, AVISO = 2, ATACA = 3, RECUPERA = 4, DOLOR = 5, MUERTO = 6, HUYE = 7, AGOTADA = 8;
// PARA: el yamabushi acaba de parar un golpe de ella. AULLA: el jefe aulla.
// (AGOTADA vale tambien para el yamabushi aturdido tras una parada.)
export const PARA = 9, AULLA = 10;

// ---------- Los tipos ----------
// [aviso, activo, recupera] de cada ataque, en segundos.
export const LOBO = {
  hp: 3, ancho: 34, alto: 116,
  anda: 120, corre: 250,
  // Se despierta cuando ya casi sale en pantalla: con 900 se despertaban dos
  // o tres a la vez, antes de verlos.
  despierta: 700,
  // El aviso del zarpazo, 0.5 (con la dificultad, 0.71 / 0.56 / 0.45 s: ver
  // ritmoBosque en caba-partida.js). Hay que levantar la guardia (0.10) antes
  // de que baje la garra: con 0.42 no llegaba ni reaccionando en 0.35 s.
  zarpazo: { aviso: 0.50, activo: 0.10, recupera: 0.40, alcance: 108, dano: 1, tipo: 'zarpazo' },
  acomete: { aviso: 0.50, vuelo: 0.42, vel: 620, recupera: 0.45, dano: 1, tipo: 'embestida', alto: 92 },
  // EL BARRIDO BAJO (su Attack_2): le da si ella tiene los pies a menos de
  // `alto` del suelo, asi que se salta. Saltar es cuestion de MOMENTO: vale
  // pulsando entre 0.34 y 0.06 s antes de que barra. Con 0.50 de aviso el
  // ultimo instante quedaba a 0.05 s de los reflejos de cada dificultad; con
  // 0.56 la ventana cubre sus reflejos +-0.1 s (tools/prueba-peleas.mjs).
  barre: { aviso: 0.56, activo: 0.12, recupera: 0.45, alcance: 120, alto: 44, dano: 1, tipo: 'barre' },
  // Lo que hace sin que el nivel diga otra cosa.
  ataques: ['zarpazo', 'acomete'],
  recarga: [1.0, 1.5],
  recargaAcomete: [1.4, 2.0],
  dolor: 0.28,
};
export const KITSUNE = {
  hp: 2, ancho: 26, alto: 158,
  anda: 110,
  despierta: 800,
  lanza: { aviso: 0.60, recupera: 0.25 },
  corro: { aviso: 0.55, activo: 0.50, radio: 150, dano: 1, tipo: 'corro' },
  // EL FUEGO RASTRERO (su Attack_1): el aviso es el remolino de colas con las
  // llamas brotando a sus pies; luego sale la llama por el suelo.
  rastrero: { aviso: 0.70, recupera: 0.35 },
  ataques: ['lanza', 'corro'],
  // Lo que se queda agotada tras el corro: es el premio por apartarse, y
  // tiene que dar para volver (apartarse son ~200 px, casi un segundo).
  agotada: 1.4,
  recarga: [1.8, 2.4],
  dolor: 0.30,
};
export const KARASU = {
  hp: 3, ancho: 28, alto: 170,
  anda: 110, corre: 260,
  despierta: 750,
  // EL TAJO: alza la katana por encima de la cabeza (dos fotogramas) y la
  // baja. Se para como el zarpazo, con los mismos numeros.
  tajo: { aviso: 0.50, activo: 0.10, recupera: 0.40, alcance: 118, dano: 1, tipo: 'katana' },
  // EL PICADO, por fases: `aviso` agachado (el destello del boton), `sube`
  // de un salto hasta `alto` sobre el camino y hasta encima de ella (a media
  // distancia, siguiendola a su paso no llegaba: se fijaba a 200 px y el
  // picado caia en vacio), `cierne` encima siguiendola a `sigue` px/s
  // (andando, ella va a 240: no se le escapa sin esquivar),
  // `fija` quieto envolviendose en las alas (lo que se ve venir) y `cae`. Le
  // da si al caer ella esta a menos de `radio` de el. Contestar es esquivar
  // en cuanto se fija: el tramo, medido en tools/prueba-peleas.mjs, va desde
  // el primer instante hasta pasados los reflejos de cada dificultad. Le toca
  // en cuanto empieza a caer (sus pies ya estan a la altura de la cabeza de
  // ella), asi que `fija` es todo el plazo: 0.46 son 0.66 s en PASEO.
  // LA ALTURA SALE DE LA PANTALLA: con las alas abiertas mide 190 px, y a 250
  // se salia por arriba (bajo el marcador asomaban sus pies); a 146 cabe
  // entero justo encima de la cabeza de ella.
  picado: { aviso: 0.36, sube: 0.30, cierne: 0.50, fija: 0.46, cae: 0.16, recupera: 0.80,
            alto: 146, sigue: 200, radio: 70, dano: 1, tipo: 'picado' },
  ataques: ['tajo', 'picado'],
  recarga: [1.1, 1.6],
  dolor: 0.28,
};
export const YAMABUSHI = {
  hp: 4, ancho: 28, alto: 185,
  anda: 90,
  despierta: 700,
  // EL DESENVAINE: cuatro fotogramas con la mano en la empuñadura y un tajo
  // largo (avanza `avance` px al soltarlo). Se para con la guardia, y a
  // tiempo es PARADA: lo deja aturdido (`agotada`, abajo). El aviso sale de
  // la parada: reaccionando con los reflejos de cada dificultad, la guardia
  // sube dentro de su ventana (0.60 / 0.7 = 0.86 s en PASEO: la guardia
  // levantada a los 0.60 s para en la ventana de 0.26).
  iai: { aviso: 0.60, activo: 0.10, recupera: 0.55, alcance: 150, avance: 50, dano: 1, tipo: 'katana' },
  // EL RELAMPAGO: agachado con la mano en la katana, y cruza hasta pasarla
  // `pasa` px. Le da si la cruza con los pies de ella por debajo de `alto`:
  // se salta (cuestion de momento, como el barrido). LLEGA SIEMPRE A LOS
  // `llega` s de arrancar, venga de donde venga (va mas rapido cuanto mas
  // lejos): con una velocidad fija, el momento de saltar cambiaba 0.12 s
  // entre soltarlo a 310 px y a 460, y ningun ritmo servia para los dos. Con
  // el aviso y `llega`, el salto vale pulsando entre 0.35 y 0.09 s antes de
  // que llegue, y eso cubre los reflejos de cada dificultad +-0.1 s (con 0.22
  // en FURIA quedaba justo en el borde).
  relampago: { aviso: 0.42, llega: 0.20, pasa: 130, vuelo: 0.6, recupera: 0.60, alto: 60, dano: 1, tipo: 'relampago' },
  ataques: ['iai', 'relampago'],
  recarga: [0.9, 1.4],
  dolor: 0.30,
  // Aturdido tras una PARADA (con la pausa de la dificultad).
  agotada: 1.2,
  // Lo que tarda en volver a su guardia tras parar un golpe de ella.
  rechazo: 0.28,
};
export const ALFA = {
  ...LOBO,
  // Con 6, el combo de ella (1 + 1 + 2 en un segundo) lo tumbaba en 1.3 s,
  // antes de que soltara su primer ataque: no era una pelea. Con 12 aguanta
  // tres combos, y entre uno y otro ataca (ver `provocado`).
  hp: 12,
  // EL ZARPAZO HACIA ARRIBA: agachado con los brazos recogidos y se estira
  // hacia arriba. Alcanza hasta `alto` por encima del suelo: saltando, se lo
  // come. Se para con la guardia, como el zarpazo.
  levanta: { aviso: 0.52, activo: 0.12, recupera: 0.45, alcance: 112, alto: 240, dano: 1, tipo: 'zarpazo' },
  ataques: ['zarpazo', 'barre', 'acomete', 'levanta'],
  // Lo que dura cada aullido (y el jefe no huye nunca).
  aullido: 1.3,
  jefe: true,
};
// ---------- EL CEMENTERIO (25-09-2026) ----------
export const VAMPIRA = {
  hp: 3, ancho: 22, alto: 140,
  anda: 130, corre: 280,
  despierta: 720,
  // LA ZARPA: se echa atras con la mano abierta y araña. Se para como el
  // zarpazo del lobo, con su mismo aviso (con 0.46 dejaba 0.57 s en PASEO).
  zarpa: { aviso: 0.50, activo: 0.10, recupera: 0.36, alcance: 104, dano: 1, tipo: 'zarpazo' },
  // EL MORDISCO: le crece una cabeza de monstruo (cuatro fotogramas) y se
  // lanza `avance` px mordiendo. Rompe la guardia: se ESQUIVA. Si muerde, se
  // cura `cura` (lo dice la escena: "TE HA MORDIDO").
  muerde: { aviso: 0.62, activo: 0.16, recupera: 0.55, alcance: 96, avance: 110, dano: 1, cura: 1, tipo: 'mordisco' },
  ataques: ['zarpa', 'muerde'],
  recarga: [0.9, 1.4],
  dolor: 0.26,
};
export const VAMPIRO = {
  hp: 3, ancho: 22, alto: 148,
  anda: 110, corre: 260,
  despierta: 720,
  // LA ESTOCADA: en guardia de esgrima y a fondo; larga. Se para.
  estocada: { aviso: 0.50, activo: 0.12, recupera: 0.45, alcance: 160, dano: 1, tipo: 'katana' },
  // EL TAJO BAJO: la espada a ras de suelo, como el barrido del lobo: se SALTA.
  bajo: { aviso: 0.56, activo: 0.12, recupera: 0.45, alcance: 150, alto: 44, dano: 1, tipo: 'barre' },
  // EL SALTO POR ENCIMA: se agacha, pasa por encima de ella y cae `pasa` px
  // a su espalda; al caer, la estocada POR DETRAS (con su aviso): hay que
  // girarse y parar. El salto no hace daño: cambia de lado. Esa estocada
  // lleva `giro` s mas de aviso: girarse cuesta el stick (con el aviso de
  // siempre dejaba 0.57 s en PASEO; con el, 0.67).
  salto: { aviso: 0.40, vuelo: 0.55, pasa: 110, alto: 175, giro: 0.10 },
  ataques: ['estocada', 'bajo', 'salto'],
  recarga: [1.0, 1.5],
  dolor: 0.26,
};
// (Horneada a x3, no a x2 como los demas: ver tools/enemigos-atlas.py. Mide
// 219 px con el moño; su cuerpo, 205.)
export const CONDESA = {
  hp: 20, ancho: 36, alto: 205,
  anda: 90, corre: 240,
  despierta: 760,
  // EL DARDO: la sangre le gira en la mano y la lanza a la altura del pecho.
  // La guardia lo para, y una PARADA se lo DEVUELVE (le quita `devuelto`).
  dardo: { aviso: 0.62, recupera: 0.30 },
  // LA LLUVIA: alza el brazo y caen `gotas` gotas de sangre cerca de ella,
  // cada una con su sombra roja en el suelo `cae` s antes: hay que salir.
  // (con 160 entre gota y gota queda entre sombras un hueco de 76 px sin nada)
  lluvia: { aviso: 0.45, recupera: 0.55, gotas: 3, cae: 0.85, separa: 160 },
  // LA ZARPA, si ella se le pega y no puede apartarse. Se para.
  zarpa: { aviso: 0.50, activo: 0.10, recupera: 0.40, alcance: 128, dano: 1, tipo: 'zarpazo' },
  ataques: ['dardo', 'lluvia', 'zarpa'],
  recarga: [1.1, 1.6],
  dolor: 0.30,
  jefe: true, nombre: 'LA CONDESA', encadena: true,
  // Lo que se cura con cada gota o dardo de sangre que le entra a ella, y
  // lo que le quita un dardo devuelto.
  bebe: 1, devuelto: 2,
  // Se aparta de un brinco si ella se le acerca (y no mas a menudo que esto).
  // Con 3 s, ella la alcanzaba antes de que pudiera volver a brincar y le
  // pegaba mientras avisaba la zarpa: la jefa caia en 13 s.
  brinco: 1.4,
  // EL BRINCO ES PARA LANZAR: cae lista (sin recarga). Si no, quien la
  // perseguia la alcanzaba antes de que acabara su recarga y ella volvia a
  // brincar o sacaba la zarpa: en una pelea, 10 brincos, 7 zarpas, 1 lluvia
  // y ningun dardo (25-09-2026).
  lanzaAlCaer: true,
};
ALFA.nombre = 'EL LOBO BLANCO';
export const TIPOS = { lobo: LOBO, kitsune: KITSUNE, karasu: KARASU, yamabushi: YAMABUSHI, alfa: ALFA,
                       vampira: VAMPIRA, vampiro: VAMPIRO, condesa: CONDESA };

// ---------- El fuego ----------
// Cada bola, llama o gota, con su numero: sacado del reloj del que la lanza
// se repetia (cada lanzamiento sale al acabar el mismo aviso), y el piloto del
// arnes veia una gota NUEVA como vista hace segundos: reaccionaba al instante.
let ultimoId = 0;
const nuevoId = () => ++ultimoId;
export const FUEGO_V = 420;            // px/s
export const FUEGO_R = 16;             // radio de la bola
export const FUEGO_ALTO = 150;         // a que altura sale (la mano, sobre sus pies)
export const FUEGO_DEVUELTO = 1.25;    // la devuelta va mas rapida
export const FUEGO_MANO = 74;          // de su centro a la mano
// La llama RASTRERA: va por el suelo, y le da si tiene los pies bajos. Se
// apaga a los 900 px (antes seguia camino abajo hasta perderse).
export const RASTRERO_V = 340, RASTRERO_ALTO = 40, RASTRERO_R = 18, RASTRERO_ALCANCE = 900;

// QUE BOTON CONTESTA CADA ATAQUE. La escena pinta el aviso de su color (y en
// PASEO, el boton encima): es la misma ley que el maestro del ogro enseña.
export const RESPUESTA = {
  zarpazo: 'guardia', lanza: 'guardia', tajo: 'guardia', iai: 'guardia', levanta: 'guardia',
  zarpa: 'guardia', estocada: 'guardia', salto: 'guardia', dardo: 'guardia',
  acomete: 'esquivar', corro: 'esquivar', picado: 'esquivar', muerde: 'esquivar', lluvia: 'esquivar',
  barre: 'saltar', rastrero: 'saltar', relampago: 'saltar', bajo: 'saltar',
};
// Todos los ataques que avisan (los que la dificultad acorta).
const ATAQUES = ['zarpazo', 'acomete', 'barre', 'lanza', 'corro', 'rastrero', 'tajo', 'picado', 'iai', 'relampago', 'levanta',
                 'zarpa', 'muerde', 'estocada', 'bajo', 'salto', 'dardo', 'lluvia'];

// LA DIFICULTAD (caba-partida.js, opcionesBosque): el ritmo acorta los
// avisos y la pausa estira lo que descansan entre ataque y ataque (y lo que
// se queda agotada la kitsune). Se hace una copia del tipo ya escalada: asi
// todo lo que lee E.T (la logica y las poses) va al ritmo de la dificultad.
// La ACOMETIDA lleva su propio ritmo (`ritmoCarrera`, como la embestida del
// ogro): se contesta atravesandola cuando viene, y con un aviso mas largo quien
// reacciona rapido esquiva antes de que salte y cae delante de el.
// EL PICADO se contesta en dos momentos que se ven venir, y los dos van al
// ritmo: lo que se queda encima de ella y lo que tarda en caer desde que se
// fija (la caida en si es la de siempre).
function escala(T, o) {
  const ritmo = o.ritmo || 1, pausa = o.pausa || 1, carrera = o.ritmoCarrera || ritmo;
  const E = JSON.parse(JSON.stringify(T));
  for (const k of ATAQUES) if (E[k]) E[k].aviso = T[k].aviso / (k === 'acomete' ? carrera : ritmo);
  if (E.picado) { E.picado.cierne = T.picado.cierne / ritmo; E.picado.fija = T.picado.fija / ritmo; }
  // (la sombra de cada gota de la lluvia es su aviso)
  if (E.lluvia) E.lluvia.cae = T.lluvia.cae / ritmo;
  for (const k of ['recarga', 'recargaAcomete']) if (E[k]) E[k] = T[k].map(v => v * pausa);
  if (E.agotada) E.agotada = T.agotada * pausa;
  return E;
}

// `x0`, `x1`: por donde se mueve (dentro de su tramo, lejos de los bordes:
// no se cae a los fosos). `tramo`: el tramo de camino entero, [desde, hasta]:
// solo va a por ella si lo pisa. `o`: la dificultad. `ataques`: los que usa
// (sin el, los de su tipo).
export function makeEnemigo(tipo, x, y, x0, x1, id, o = {}, tramo = [-Infinity, Infinity], ataques = null) {
  const T = escala(TIPOS[tipo], o);
  return {
    id, tipo, T, x, y, vx: 0, dir: -1, x0, x1, tramo, ataques: ataques || T.ataques, ultimo: null,
    st: ESPERA, t: 0, animT: 0, atk: null, golpeo: false,
    hp: T.hp, hpMax: T.hp, vivo: true, recarga: 0.6, hurtT: 0, flash: 0,
    despierto: false, abierto: 0, muertoT: 0,
    // alt: lo que vuela sobre el camino (el picado); fase: por donde va el
    // picado; aullidos y manada: los del jefe; oculto: un lobo de la manada
    // que aun no ha llamado (ni se ve ni se mueve).
    alt: 0, fase: null, aullidos: 0, manada: null, oculto: false, provocado: false,
    // brincoT: lo que le falta a la condesa para poder apartarse otra vez;
    // saltoX0/X1: de donde a donde salta el vampiro por encima de ella.
    brincoT: 0, saltoX0: 0, saltoX1: 0,
    despiertaX: undefined,
  };
}

function cambia(E, st) { E.st = st; E.t = 0; E.animT = 0; }
function entre(rnd, [a, b]) { return a + rnd() * (b - a); }

// Un paso de UN enemigo. Devuelve lo que ha pasado: [{ tipo, x, y }]
//   aviso     empieza un ataque (para el sonido)
//   golpe     le ha entrado a ella (C.herir ya aplicado; `r` es su resultado)
//   parada    ella lo ha parado a tiempo
//   bloqueo   ella lo ha parado con la guardia puesta
//   fuego     ha lanzado una bola (ya esta en `fuegos`)
//   corro     el corro de fuego se enciende
//   fija      el picado se fija: va a caer (la sombra se enciende)
//   aterriza  el picado llega al suelo
//   aullido   el jefe aulla (y si le queda manada, sale un lobo)
//   relampago el yamabushi cruza
export function stepEnemigo(E, K, dt, rnd, fuegos) {
  const ev = [];
  if (E.oculto) return ev;
  E.t += dt; E.animT += dt;
  if (E.flash > 0) E.flash -= dt;
  if (E.recarga > 0) E.recarga -= dt;
  if (E.abierto > 0) E.abierto -= dt;
  if (E.brincoT > 0) E.brincoT -= dt;
  if (E.st === MUERTO) { E.muertoT += dt; E.vx *= 0.85; mueve(E, dt); return ev; }
  const T = E.T, dist = Math.abs(K.x - E.x), haciaElla = K.x < E.x ? -1 : 1;
  // Se despierta al tenerla cerca, o (si el nivel se lo pide) al pasar ella
  // por un sitio: asi dos del mismo tramo no se le echan encima a la vez.
  if (!E.despierto) {
    if (E.despiertaX !== undefined ? K.x >= E.despiertaX : dist < T.despierta) {
      E.despierto = true;
      // El jefe se deja ver antes de atacar: la condesa despierta fuera de la
      // pantalla (a 760 px) y lanzaba su lluvia en el acto, antes de que la
      // camara la encuadrara (su recarga se gasta dormida).
      if (T.jefe) E.recarga = Math.max(E.recarga, 1.0);
    } else return ev;
  }

  if (E.st === DOLOR) {
    E.vx *= 0.85;
    if (E.t >= T.dolor) {
      // Tras el golpe, la kitsune salta lejos de ella; el lobo y el cuervo, a
      // veces. El yamabushi y el jefe no se apartan: vuelven a su sitio (el
      // yamabushi, a su guardia, y enseguida contesta).
      if (E.tipo === 'kitsune' || ((E.tipo === 'lobo' || E.tipo === 'karasu' || E.tipo === 'vampira' || E.tipo === 'vampiro') && rnd() < 0.35)) { cambia(E, HUYE); E.vx = -haciaElla * 300; E.dir = haciaElla; }
      else { cambia(E, ESPERA); E.recarga = Math.max(E.recarga, E.tipo === 'yamabushi' ? 0.25 : 0.4); }
    }
  } else if (E.st === HUYE) {
    // un salto hacia atras (el dibujo es su salto)
    E.vx *= 0.97;
    // (la condesa brinca PARA LANZAR: cae lista, ver CONDESA.lanzaAlCaer)
    if (E.t >= 0.5) { cambia(E, ESPERA); E.vx = 0; E.recarga = T.lanzaAlCaer ? 0 : Math.max(E.recarga, 0.5); }
  } else if (E.st === AGOTADA) {
    E.vx = 0;
    if (E.t >= T.agotada) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
  } else if (E.st === PARA) {
    // el yamabushi, tras parar un golpe de ella: vuelve a su guardia y decide
    // ya (si esperara al paso siguiente, otro golpe de ella lo pillaba antes)
    E.vx *= 0.8;
    if (E.t >= T.rechazo) { cambia(E, ESPERA); yamabushi(E, K, rnd, dist, haciaElla, ev); }
  } else if (E.tipo === 'lobo' || E.tipo === 'alfa') lobo(E, K, rnd, dist, haciaElla, ev);
  else if (E.tipo === 'karasu') karasu(E, K, rnd, dist, haciaElla, ev);
  else if (E.tipo === 'yamabushi') yamabushi(E, K, rnd, dist, haciaElla, ev);
  else if (E.tipo === 'vampira') vampira(E, K, rnd, dist, haciaElla, ev);
  else if (E.tipo === 'vampiro') vampiro(E, K, rnd, dist, haciaElla, ev);
  else if (E.tipo === 'condesa') condesa(E, K, rnd, dist, haciaElla, ev, fuegos);
  else kitsune(E, K, rnd, dist, haciaElla, ev, fuegos);

  mueve(E, dt);
  return ev;
}

// Se mueve sin salirse de su tramo de camino.
function mueve(E, dt) {
  E.x += E.vx * dt;
  if (E.x < E.x0) { E.x = E.x0; E.vx = 0; }
  if (E.x > E.x1) { E.x = E.x1; E.vx = 0; }
}

// ---------- EL LOBO ----------
function lobo(E, K, rnd, dist, hacia, ev) {
  const T = E.T;
  if (E.st === AULLA) {
    E.vx = 0;
    if (E.t >= T.aullido) {
      // Si ha llamado a un lobo, se aparta de un brinco (corriendo, ella lo
      // alcanzaba con la espada y lo remataba antes de que llegara el lobo).
      if (E.manada && E.manada.some(W => W.vivo && W.despierto)) { cambia(E, HUYE); E.vx = -hacia * 620; E.dir = hacia; }
      else { cambia(E, ESPERA); E.recarga = Math.max(E.recarga, 0.5); }
    }
    return;
  }
  if (E.st === ESPERA || E.st === ANDA) {
    E.dir = hacia;
    if (!K.vivo) { E.vx = 0; cambia(E, ESPERA); return; }
    // Solo va a por ella si pisa SU tramo de camino. Si no, la espera: un lobo
    // apostado al otro lado de un foso le daba el zarpazo en pleno salto, sin
    // que ella pudiera cubrirse, y la tiraba al foso.
    if (fuera(E, K)) {
      E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA);
      return;
    }
    // EL JEFE aulla al verla y a media vida, pero no con su manada peleando:
    // mientras haya un lobo suyo en pie, espera apartado.
    const pelea = T.jefe && E.manada && E.manada.some(W => W.vivo && W.despierto);
    if (T.jefe) {
      if (E.provocado) { E.provocado = false; E.recarga = Math.min(E.recarga, 0.35); }
      // Aulla al verla y a media vida (aullando no encaja: ver hiere()).
      if (!pelea && E.aullidos < (E.hp <= E.hpMax / 2 ? 2 : 1)) { aulla(E, ev); return; }
      // Mientras su manada pelea, espera apartado (y si lo acorrala, pelea,
      // pero sin acometida: el y su lobo atacaban a la vez y el golpe no se
      // podia contestar).
      if (pelea && apartado(E, dist, hacia)) return;
    }
    const sabe = a => E.ataques.includes(a);
    if (E.recarga <= 0 && dist <= 150 && (sabe('zarpazo') || sabe('barre') || sabe('levanta'))) {
      // De cerca: el zarpazo o, si lo sabe, el barrido bajo (sin repetir el
      // mismo tres veces: un ataque que se repite deja de pedir mirar). El
      // jefe, ademas, el zarpazo hacia arriba.
      if (sabe('levanta')) E.atk = cercaJefe(E, rnd);
      else {
        const barre = sabe('barre') && (!sabe('zarpazo') ||
          (E.ultimo === 'zarpazo' ? rnd() < 0.6 : E.ultimo === 'barre' ? rnd() < 0.25 : rnd() < 0.45));
        E.atk = barre ? 'barre' : 'zarpazo';
      }
      E.ultimo = E.atk;
      cambia(E, AVISO); E.vx = 0; ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: E.atk });
    } else if (E.recarga <= 0 && dist > 170 && dist <= 330 && sabe('acomete') && !pelea && puedeVolar(E, hacia)) {
      E.atk = 'acomete'; cambia(E, AVISO); E.vx = 0; ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'acomete' });
    } else if (dist > 330) {
      // de lejos, corre hacia ella
      E.vx = hacia * T.corre; if (E.st !== ANDA) cambia(E, ANDA);
    } else if (E.recarga > 0) {
      // recargando, guarda la distancia: ni se le echa encima ni huye (el
      // jefe no retrocede: dandole la espalda, ella le pegaba andando)
      const quiere = dist < 190 && !T.jefe ? -hacia : dist > 260 ? hacia : 0;
      E.vx = quiere * T.anda;
      if (quiere && E.st !== ANDA) cambia(E, ANDA);
      if (!quiere && E.st !== ESPERA) cambia(E, ESPERA);
    } else {
      E.vx = hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    }
    return;
  }
  if (E.atk === 'barre') return barrido(E, K, T.barre, rnd, ev);
  if (E.atk === 'zarpazo') return garra(E, K, T.zarpazo, rnd, ev);
  if (E.atk === 'levanta') return garra(E, K, T.levanta, rnd, ev, T.levanta.alto, 60);
  // LA ACOMETIDA
  const A = T.acomete;
  if (E.st === AVISO) {
    if (E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; E.vx = E.dir * A.vel; }
  } else if (E.st === ATACA) {
    // En vuelo: le da si la cruza por el cuerpo (con los pies de ella por
    // debajo de lo alto de la plancha: saltandolo, pasa por debajo).
    if (!E.golpeo && K.vivo && Math.abs(K.x - E.x) < T.ancho + C.CUERPO_K && K.y > E.y - A.alto) {
      E.golpeo = true;
      const r = C.herir(K, E.x, A.tipo, A.dano);
      if (r) ev.push({ tipo: 'golpe', x: K.x, y: K.y - 90, r });
    }
    // No se lanza al vacio: al borde de su tramo, aterriza.
    if (E.t >= A.vuelo || (E.dir > 0 ? E.x >= E.x1 - 2 : E.x <= E.x0 + 2)) { cambia(E, RECUPERA); E.vx = E.dir * 120; }
  } else if (E.st === RECUPERA) {
    E.vx *= 0.85;
    if (E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recargaAcomete); }
  }
}

// UN GOLPE DE CERCA QUE SE PARA (el zarpazo, el tajo del cuervo, el zarpazo
// hacia arriba del jefe): aviso, golpe y recuperacion. `alto`: hasta donde
// alcanza por encima del suelo (el zarpazo, 150: cualquier salto; el de
// arriba, mas). `empuje`: lo que avanza al soltarlo.
function garra(E, K, A, rnd, ev, alto = 150, empuje = 140) {
  if (E.st === AVISO && E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; E.vx = E.dir * empuje; }
  else if (E.st === ATACA) {
    if (!E.golpeo && K.vivo && Math.abs(K.y - E.y) < alto) {
      const d = (K.x - E.x) * E.dir;
      if (d > -10 && d < A.alcance + C.CUERPO_K) {
        E.golpeo = true;
        const r = C.herir(K, E.x, A.tipo, A.dano);
        if (r === 'parada') { E.abierto = C.PARADA_PREMIO; ev.push({ tipo: 'parada', x: E.x + E.dir * 50, y: E.y - 70 }); }
        else if (r === 'bloqueado') { E.vx = -E.dir * 180; ev.push({ tipo: 'bloqueo', x: E.x + E.dir * 50, y: E.y - 70 }); }
        else if (r) {
          ev.push({ tipo: 'golpe', x: K.x, y: K.y - 90, r, aire: E.y - K.y > 30 });
          // LA CONDESA SE BEBE LA SANGRE tambien con la zarpa, y si le entra
          // ENCADENA otra (con su aviso entero): a quien se defiende no le
          // cambia nada; a quien machaca, si (le ganaba 16 de 16 veces).
          if (E.T.bebe && E.hp < E.hpMax) { const antes = E.hp; E.hp = Math.min(E.hpMax, E.hp + E.T.bebe); ev.push({ tipo: 'cura', x: E.x, y: E.y - E.T.alto - 10, n: E.hp - antes }); }
          if (E.T.encadena) E.encadena = true;
        }
      }
    }
    E.vx *= 0.8;
    if (E.t >= A.activo) cambia(E, RECUPERA);
  } else if (E.st === RECUPERA) {
    E.vx *= 0.8;
    // Tras una parada se queda abierto lo que dura el premio de ella.
    if (E.t >= Math.max(A.recupera, E.abierto)) {
      cambia(E, ESPERA); E.recarga = entre(rnd, E.T.recarga);
      if (E.encadena) { E.encadena = false; E.recarga = 0; E.brincoT = Math.max(E.brincoT, 0.8); }
    }
  }
}

// UN BARRIDO A RAS DE SUELO (el del lobo, el tajo bajo del vampiro): le da
// si ella tiene los pies a menos de `alto` del suelo, asi que se salta.
function barrido(E, K, A, rnd, ev) {
  if (E.st === AVISO && E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; E.vx = E.dir * 90; }
  else if (E.st === ATACA) {
    // A ras de suelo: saltando pasa por debajo de ella.
    if (!E.golpeo && K.vivo && E.y - K.y < A.alto) {
      const d = (K.x - E.x) * E.dir;
      if (d > -10 && d < A.alcance + C.CUERPO_K) {
        E.golpeo = true;
        const r = C.herir(K, E.x, A.tipo, A.dano);
        if (r) ev.push({ tipo: 'golpe', x: K.x, y: K.y - 40, r });
      }
    }
    E.vx *= 0.8;
    if (E.t >= A.activo) cambia(E, RECUPERA);
  } else if (E.st === RECUPERA) {
    E.vx *= 0.8;
    if (E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, E.T.recarga); }
  }
}

// ---------- EL JEFE ----------
// Aulla: se queda quieto `aullido` segundos, y si le queda algun lobo de la
// manada sin llamar, ese sale corriendo hacia ella.
function aulla(E, ev) {
  E.aullidos++;
  cambia(E, AULLA); E.vx = 0;
  const W = E.manada && E.manada.find(M => M.oculto);
  if (W) { W.oculto = false; W.despierto = true; W.recarga = 0.4; }
  ev.push({ tipo: 'aullido', x: E.x, y: E.y, llama: !!W, lobo: W || null });
}
// Mientras su manada pelea, se aparta: a mas de 340 px de ella, mirandola, y
// CORRIENDO (un poco mas rapido que ella: andando lo alcanzaba, y peleaba
// contra los dos a la vez). Solo si ella lo acorrala contra el borde de su
// tramo, pelea (devuelve false).
function apartado(E, dist, hacia) {
  const acorralado = hacia > 0 ? E.x - E.x0 < 30 : E.x1 - E.x < 30;
  if (acorralado && dist < 220) return false;
  if (dist < 340) { E.dir = -hacia; E.vx = -hacia * E.T.corre; if (E.st !== ANDA) cambia(E, ANDA); }
  else { E.dir = hacia; E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA); }
  return true;
}
// De cerca, el jefe elige entre lo que sabe (zarpazo, barrido y zarpazo hacia
// arriba), repitiendo poco el ultimo: tiene que haber que mirar el aviso.
function cercaJefe(E, rnd) {
  const cerca = ['zarpazo', 'barre', 'levanta'].filter(a => E.ataques.includes(a));
  const peso = cerca.map(a => a === E.ultimo ? 0.3 : 1);
  let r = rnd() * peso.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cerca.length; i++) { r -= peso[i]; if (r <= 0) return cerca[i]; }
  return cerca[cerca.length - 1];
}

// ¿Esta ella fuera de su tramo de camino? (El tramo ENTERO: con los limites
// por donde se mueve, que empiezan lejos del borde, ella se quedaba justo
// pasado el foso y los dos se esperaban para siempre.)
function fuera(E, K) { return K.x < E.tramo[0] || K.x > E.tramo[1]; }

// ¿Tiene sitio para lanzarse hacia ella sin llegar al borde enseguida?
function puedeVolar(E, dir) {
  return dir > 0 ? E.x1 - E.x > 140 : E.x - E.x0 > 140;
}

// ---------- LA KITSUNE ----------
function kitsune(E, K, rnd, dist, hacia, ev, fuegos) {
  const T = E.T;
  if (E.st === ESPERA || E.st === ANDA) {
    if (!K.vivo) { E.vx = 0; cambia(E, ESPERA); return; }
    // Como el lobo: solo a quien pisa su tramo. Disparando por encima de un
    // foso, una bola en pleno salto la tiraba dentro (dos corazones de golpe).
    if (fuera(E, K)) {
      E.dir = hacia; E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA);
      return;
    }
    const acorralada = hacia > 0 ? E.x - E.x0 < 30 : E.x1 - E.x < 30;
    if (E.recarga <= 0 && (dist < 175 || (dist < 260 && acorralada))) {
      E.dir = hacia; E.atk = 'corro'; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'corro' });
    } else if (dist < 260 && !acorralada) {
      // se le acerca: se aparta andando (de espaldas a ella)
      E.dir = -hacia; E.vx = -hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    } else if (E.recarga <= 0 && dist >= 300 && dist <= 760) {
      // La bola, SOLO DE LEJOS: a quemarropa (nacia a 100 px de ella) llega
      // en 0.2 s y no hay guardia que la pare a tiempo. Si sabe el fuego
      // rastrero, a veces ese (por el suelo: se salta).
      const rastrea = E.ataques.includes('rastrero') && (!E.ataques.includes('lanza') ||
        (E.ultimo === 'lanza' ? rnd() < 0.6 : E.ultimo === 'rastrero' ? rnd() < 0.25 : rnd() < 0.45));
      E.dir = hacia; E.atk = rastrea ? 'rastrero' : 'lanza'; E.ultimo = E.atk; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: E.atk });
    } else {
      E.dir = hacia; E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA);
    }
    return;
  }
  if (E.atk === 'rastrero') {
    const A = T.rastrero;
    if (E.st === AVISO && E.t >= A.aviso) {
      // La llama sale de sus pies y va por el suelo; se apaga al salir de su
      // tramo (no cruza fosos: va pegada al camino).
      fuegos.push({ id: nuevoId(), x: E.x + E.dir * 40, y: E.y, vx: E.dir * RASTRERO_V,
                    rastrero: true, tramo: E.tramo, x0: E.x, propio: false, t: 0, fin: 0 });
      ev.push({ tipo: 'fuego', x: E.x + E.dir * 40, y: E.y, rastrero: true });
      cambia(E, RECUPERA);
    } else if (E.st === RECUPERA && E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
    return;
  }
  if (E.atk === 'lanza') {
    const A = T.lanza;
    // Si mientras cargaba ella se le ha echado encima, no la suelta: a menos
    // de 250 px la bola nacia a 80 px de ella y no daba tiempo a nada. Se
    // rodea de fuegos, que avisan.
    if (E.st === AVISO && E.t >= A.aviso && dist < 250) {
      E.atk = 'corro'; cambia(E, AVISO); ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'corro' });
      return;
    }
    if (E.st === AVISO && E.t >= A.aviso) {
      fuegos.push({ id: nuevoId(), x: E.x + E.dir * FUEGO_MANO, y: E.y - FUEGO_ALTO,
                    vx: E.dir * FUEGO_V, propio: false, t: 0, fin: 0 });
      ev.push({ tipo: 'fuego', x: E.x + E.dir * FUEGO_MANO, y: E.y - FUEGO_ALTO });
      cambia(E, RECUPERA);
    } else if (E.st === RECUPERA && E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
    return;
  }
  // EL CORRO
  const A = T.corro;
  if (E.st === AVISO && E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; ev.push({ tipo: 'corro', x: E.x, y: E.y }); }
  else if (E.st === ATACA) {
    if (!E.golpeo && K.vivo && Math.abs(K.x - E.x) < A.radio + C.CUERPO_K && K.y > E.y - 200) {
      E.golpeo = true;
      const r = C.herir(K, E.x, A.tipo, A.dano);
      if (r) ev.push({ tipo: 'golpe', x: K.x, y: K.y - 90, r });
    }
    if (E.t >= A.activo) cambia(E, AGOTADA);
  }
}

// ---------- EL CUERVO (karasu tengu) ----------
function karasu(E, K, rnd, dist, hacia, ev) {
  const T = E.T;
  if (E.st === ESPERA || E.st === ANDA) {
    E.dir = hacia; E.alt = 0;
    if (!K.vivo) { E.vx = 0; cambia(E, ESPERA); return; }
    if (fuera(E, K)) { E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA); return; }
    const sabe = a => E.ataques.includes(a);
    if (E.recarga <= 0 && dist <= 140 && sabe('tajo')) {
      E.atk = 'tajo'; E.ultimo = 'tajo'; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'tajo' });
    } else if (E.recarga <= 0 && dist > 180 && dist <= 520 && sabe('picado')) {
      // A media distancia, el picado (de cerca le basta la katana).
      E.atk = 'picado'; E.ultimo = 'picado'; E.fase = null; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'picado' });
    } else if (dist > 520) {
      E.vx = hacia * T.corre; if (E.st !== ANDA) cambia(E, ANDA);
    } else if (E.recarga > 0) {
      // recargando, guarda la distancia (como el lobo)
      const quiere = dist < 190 ? -hacia : dist > 280 ? hacia : 0;
      E.vx = quiere * T.anda;
      if (quiere && E.st !== ANDA) cambia(E, ANDA);
      if (!quiere && E.st !== ESPERA) cambia(E, ESPERA);
    } else {
      E.vx = hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    }
    return;
  }
  if (E.atk === 'tajo') return garra(E, K, T.tajo, rnd, ev);
  // EL PICADO
  const A = T.picado;
  if (E.st === AVISO) {
    if (E.t >= A.aviso) { cambia(E, ATACA); E.fase = 'sube'; E.golpeo = false; }
  } else if (E.st === ATACA) {
    // Encima de ella: la sigue sin pasarse (a `sigue` px/s como mucho).
    const sigue = () => Math.max(-A.sigue, Math.min(A.sigue, (K.x - E.x) * 8));
    if (E.fase === 'sube') {
      // de un salto hasta encima de ella: lo que falte, en lo que queda de subida
      const u = Math.min(1, E.t / A.sube);
      E.alt = A.alto * (1 - (1 - u) * (1 - u));
      E.vx = (K.x - E.x) / Math.max(A.sube - E.t, 1 / 30);
      if (E.t >= A.sube) { E.fase = 'cierne'; E.t = 0; E.vx = sigue(); }
    } else if (E.fase === 'cierne') {
      E.alt = A.alto; E.vx = sigue();
      if (E.t >= A.cierne) { E.fase = 'fija'; E.t = 0; E.vx = 0; ev.push({ tipo: 'fija', x: E.x, y: E.y }); }
    } else if (E.fase === 'fija') {
      // quieto, se envuelve en las alas: va a caer
      E.vx = 0; E.alt = A.alto;
      if (E.t >= A.fija) { E.fase = 'cae'; E.t = 0; }
    } else {
      E.alt = Math.max(0, A.alto * (1 - E.t / A.cae));
      // Le da si ella esta debajo cuando pasa: con sus pies ya por debajo de
      // la cabeza de ella (saltando, se le mete en el camino).
      if (!E.golpeo && K.vivo && Math.abs(K.x - E.x) < A.radio + C.CUERPO_K && E.y - E.alt > K.y - 160) {
        E.golpeo = true;
        const r = C.herir(K, E.x, A.tipo, A.dano);
        if (r) ev.push({ tipo: 'golpe', x: K.x, y: K.y - 90, r });
      }
      if (E.t >= A.cae) { E.alt = 0; E.fase = null; cambia(E, RECUPERA); ev.push({ tipo: 'aterriza', x: E.x, y: E.y }); }
    }
  } else if (E.st === RECUPERA) {
    // abriendo las alas en el suelo: el momento de pegarle
    E.vx = 0;
    if (E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
  }
}

// ---------- EL YAMABUSHI ----------
function yamabushi(E, K, rnd, dist, hacia, ev) {
  const T = E.T;
  if (E.st === ESPERA || E.st === ANDA) {
    E.dir = hacia;
    if (!K.vivo) { E.vx = 0; cambia(E, ESPERA); return; }
    if (fuera(E, K)) { E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA); return; }
    const sabe = a => E.ataques.includes(a);
    const cruza = hacia > 0 ? E.x1 - E.x > dist + T.relampago.pasa : E.x - E.x0 > dist + T.relampago.pasa;
    if (E.recarga <= 0 && dist <= 175 && sabe('iai')) {
      E.atk = 'iai'; E.ultimo = 'iai'; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'iai' });
    } else if (E.recarga <= 0 && dist >= 300 && dist <= 470 && sabe('relampago') && cruza) {
      E.atk = 'relampago'; E.ultimo = 'relampago'; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'relampago' });
    } else if (dist > 175 && (E.recarga <= 0 || dist > 470)) {
      // se acerca sin prisa (el relampago cruza lo que le falte)
      E.vx = hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    } else {
      // en guardia, esperandola
      E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA);
    }
    return;
  }
  if (E.atk === 'iai') {
    const A = T.iai;
    if (E.st === AVISO && E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; E.vx = E.dir * A.avance / A.activo; }
    else if (E.st === ATACA) {
      if (!E.golpeo && K.vivo && Math.abs(K.y - E.y) < 150) {
        const d = (K.x - E.x) * E.dir;
        if (d > -10 && d < A.alcance + C.CUERPO_K) {
          E.golpeo = true;
          const r = C.herir(K, E.x, A.tipo, A.dano);
          if (r === 'parada') {
            // LA PARADA LO ATURDE: se tambalea (AGOTADA) y los golpes de ella
            // no lo sacan de ahi (ver hiere()).
            cambia(E, AGOTADA); E.vx = -E.dir * 120; E.abierto = C.PARADA_PREMIO;
            ev.push({ tipo: 'parada', x: E.x + E.dir * 50, y: E.y - 80, aturde: true });
            return;
          }
          if (r === 'bloqueado') { E.vx = -E.dir * 180; ev.push({ tipo: 'bloqueo', x: E.x + E.dir * 50, y: E.y - 80 }); }
          else if (r) ev.push({ tipo: 'golpe', x: K.x, y: K.y - 90, r });
        }
      }
      // acabado el tajo se planta (si la guardia de ella lo echo atras, sigue
      // echandose atras)
      if (E.t >= A.activo) { cambia(E, RECUPERA); if (E.vx * E.dir > 0) E.vx = 0; }
    } else if (E.st === RECUPERA) {
      // la katana fuera, sin guardia: el momento de pegarle
      E.vx *= 0.8;
      if (E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
    }
    return;
  }
  // EL RELAMPAGO: la cruza de un tajo y se queda de espaldas.
  const A = T.relampago;
  if (E.st === AVISO && E.t >= A.aviso) {
    // la velocidad que la alcanza (de cuerpo a cuerpo) en `llega` s
    cambia(E, ATACA); E.golpeo = false;
    E.vx = E.dir * Math.max(900, (dist - T.ancho - C.CUERPO_K) / A.llega);
    ev.push({ tipo: 'relampago', x: E.x, y: E.y });
  } else if (E.st === ATACA) {
    if (!E.golpeo && K.vivo && Math.abs(K.x - E.x) < T.ancho + C.CUERPO_K && K.y > E.y - A.alto) {
      E.golpeo = true;
      const r = C.herir(K, E.x, A.tipo, A.dano);
      if (r) ev.push({ tipo: 'golpe', x: K.x, y: K.y - 60, r });
    }
    const pasada = (E.x - K.x) * E.dir;
    if (pasada >= A.pasa || E.t >= A.vuelo || (E.dir > 0 ? E.x >= E.x1 - 2 : E.x <= E.x0 + 2)) { cambia(E, RECUPERA); E.vx = E.dir * 150; }
  } else if (E.st === RECUPERA) {
    E.vx *= 0.85;
    if (E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
  }
}

// ---------- LA VAMPIRA ----------
function vampira(E, K, rnd, dist, hacia, ev) {
  const T = E.T;
  if (E.st === ESPERA || E.st === ANDA) {
    E.dir = hacia;
    if (!K.vivo) { E.vx = 0; cambia(E, ESPERA); return; }
    if (fuera(E, K)) { E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA); return; }
    const sabe = a => E.ataques.includes(a);
    if (E.recarga <= 0 && dist <= 130 && (sabe('zarpa') || sabe('muerde'))) {
      // de cerca, la zarpa o el mordisco (repitiendo poco)
      const muerde = sabe('muerde') && (!sabe('zarpa') ||
        (E.ultimo === 'zarpa' ? rnd() < 0.55 : E.ultimo === 'muerde' ? rnd() < 0.25 : rnd() < 0.4));
      E.atk = muerde ? 'muerde' : 'zarpa'; E.ultimo = E.atk; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: E.atk });
    } else if (E.recarga <= 0 && dist > 130 && dist <= 210 && sabe('muerde')) {
      // a un paso, el mordisco (se lanza hasta ella)
      E.atk = 'muerde'; E.ultimo = 'muerde'; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'muerde' });
    } else if (dist > 330) {
      E.vx = hacia * T.corre; if (E.st !== ANDA) cambia(E, ANDA);
    } else if (E.recarga > 0) {
      const quiere = dist < 170 ? -hacia : dist > 240 ? hacia : 0;
      E.vx = quiere * T.anda;
      if (quiere && E.st !== ANDA) cambia(E, ANDA);
      if (!quiere && E.st !== ESPERA) cambia(E, ESPERA);
    } else {
      E.vx = hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    }
    return;
  }
  if (E.atk === 'zarpa') return garra(E, K, T.zarpa, rnd, ev);
  // EL MORDISCO: se lanza con la cabeza de monstruo; si le entra, se cura.
  const A = T.muerde;
  if (E.st === AVISO && E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; E.vx = E.dir * A.avance / A.activo; }
  else if (E.st === ATACA) {
    if (!E.golpeo && K.vivo && Math.abs(K.y - E.y) < 150) {
      const d = (K.x - E.x) * E.dir;
      if (d > -10 && d < A.alcance + C.CUERPO_K) {
        E.golpeo = true;
        const r = C.herir(K, E.x, A.tipo, A.dano);
        if (r) {
          ev.push({ tipo: 'golpe', x: K.x, y: K.y - 90, r });
          const antes = E.hp;
          E.hp = Math.min(E.hpMax, E.hp + A.cura);
          ev.push({ tipo: 'cura', x: E.x, y: E.y - T.alto - 10, n: E.hp - antes });
        }
      }
    }
    if (E.t >= A.activo) { cambia(E, RECUPERA); if (E.vx * E.dir > 0) E.vx *= 0.2; }
  } else if (E.st === RECUPERA) {
    // la cabeza vuelve a ser la suya: el momento de pegarle
    E.vx *= 0.8;
    if (E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
  }
}

// ---------- EL VAMPIRO ----------
function vampiro(E, K, rnd, dist, hacia, ev) {
  const T = E.T;
  if (E.st === ESPERA || E.st === ANDA) {
    E.dir = hacia; E.alt = 0;
    if (!K.vivo) { E.vx = 0; cambia(E, ESPERA); return; }
    if (fuera(E, K)) { E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA); return; }
    const sabe = a => E.ataques.includes(a);
    // donde caeria saltando por encima de ella: dentro de su sitio
    const cae = K.x + hacia * T.salto.pasa, cabe = cae > E.x0 && cae < E.x1;
    if (E.recarga <= 0 && dist <= 150 && (sabe('estocada') || sabe('bajo'))) {
      const bajo = sabe('bajo') && (!sabe('estocada') ||
        (E.ultimo === 'estocada' ? rnd() < 0.55 : E.ultimo === 'bajo' ? rnd() < 0.25 : rnd() < 0.4));
      E.atk = bajo ? 'bajo' : 'estocada'; E.ultimo = E.atk; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: E.atk });
    } else if (E.recarga <= 0 && dist > 150 && dist <= 320 && sabe('salto') && cabe && E.ultimo !== 'salto') {
      // de media distancia, el salto por encima (nunca dos seguidos)
      E.atk = 'salto'; E.ultimo = 'salto'; E.saltoX0 = E.x; E.saltoX1 = cae; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'salto' });
    } else if (dist > 330) {
      E.vx = hacia * T.corre; if (E.st !== ANDA) cambia(E, ANDA);
    } else if (E.recarga > 0) {
      const quiere = dist < 170 ? -hacia : dist > 250 ? hacia : 0;
      E.vx = quiere * T.anda;
      if (quiere && E.st !== ANDA) cambia(E, ANDA);
      if (!quiere && E.st !== ESPERA) cambia(E, ESPERA);
    } else {
      E.vx = hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    }
    return;
  }
  if (E.atk === 'estocada') return garra(E, K, T.estocada, rnd, ev, 150, 240);
  if (E.atk === 'bajo') return barrido(E, K, T.bajo, rnd, ev);
  // EL SALTO: por encima de ella, a su espalda; al caer, la estocada por
  // detras con su aviso (el que hay que ver para girarse).
  const A = T.salto;
  if (E.st === AVISO) { if (E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; } return; }
  if (E.st === ATACA) {
    const u = Math.min(1, E.t / A.vuelo);
    E.vx = 0;
    E.x = E.saltoX0 + (E.saltoX1 - E.saltoX0) * u;
    E.alt = 4 * A.alto * u * (1 - u);
    if (E.t >= A.vuelo) {
      E.alt = 0; E.x = E.saltoX1;
      E.dir = K.x < E.x ? -1 : 1;
      E.atk = 'estocada'; cambia(E, AVISO); E.t = -A.giro;
      ev.push({ tipo: 'aterriza', x: E.x, y: E.y, suave: true });
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'estocada', espalda: true, extra: A.giro });
    }
  }
}

// ---------- LA CONDESA ----------
// De lejos lanza sangre (el dardo, la lluvia); si ella se le acerca, o le
// pegan, se aparta de un brinco (no mas a menudo que T.brinco); si no puede,
// la zarpa. No se aparta andando: de espaldas y a 90 px/s, ella la alcanzaba
// y le pegaba por detras (la jefa moria en 13 s sin lanzar nada). Es jefa: no se encoge (hiere()), y la sangre que le entra a ella
// la cura (stepFuegos).
export const GOTA_Y0 = 70, GOTA_BAJA = 0.22, GOTA_R = 26;
function condesa(E, K, rnd, dist, hacia, ev, fuegos) {
  const T = E.T;
  if (E.st === ESPERA || E.st === ANDA) {
    E.dir = hacia;
    if (!K.vivo) { E.vx = 0; cambia(E, ESPERA); return; }
    if (fuera(E, K)) { E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA); return; }
    const sabe = a => E.ataques.includes(a);
    const acorralada = hacia > 0 ? E.x - E.x0 < 40 : E.x1 - E.x < 40;
    // ACORRALADA, SALTA POR ENCIMA de ella al otro lado (en cuatro brincos
    // llegaba al final de su sitio y alli moria peleando de cerca).
    if ((dist < 170 || E.provocado) && acorralada && E.brincoT <= 0) {
      const x1 = Math.max(E.x0, Math.min(E.x1, K.x + hacia * 260));
      if (Math.abs(x1 - E.x) > 200) {
        E.provocado = false; E.brincoT = T.brinco;
        E.atk = 'cruza'; E.saltoX0 = E.x; E.saltoX1 = x1; cambia(E, ATACA); E.vx = 0;
        ev.push({ tipo: 'brinco', x: E.x, y: E.y });
        return;
      }
    }
    if ((dist < 170 || E.provocado) && !acorralada && E.brincoT <= 0) {
      E.provocado = false; E.brincoT = T.brinco;
      // (a 560 el brinco la apartaba 180 px y ella la alcanzaba en un paso)
      cambia(E, HUYE); E.vx = -hacia * 900; E.dir = hacia;
      ev.push({ tipo: 'brinco', x: E.x, y: E.y });
      return;
    }
    E.provocado = false;
    if (E.recarga <= 0 && dist <= 140 && sabe('zarpa')) {
      E.atk = 'zarpa'; E.ultimo = 'zarpa'; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'zarpa' });
    } else if (E.recarga <= 0 && dist >= 220 && dist <= 760 && (sabe('dardo') || sabe('lluvia'))) {
      // Con ella cerca, la lluvia: corriendo hacia ella se come 150 px durante
      // el aviso del dardo, que acababa a bocajarro (y en zarpa).
      const lluvia = sabe('lluvia') && (!sabe('dardo') || dist < 350 ||
        (E.ultimo === 'dardo' ? rnd() < 0.55 : E.ultimo === 'lluvia' ? rnd() < 0.25 : rnd() < 0.4));
      E.atk = lluvia ? 'lluvia' : 'dardo'; E.ultimo = E.atk; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: E.atk });
    } else if (dist > 760) {
      E.vx = hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    } else {
      E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA);
    }
    return;
  }
  if (E.atk === 'zarpa') return garra(E, K, T.zarpa, rnd, ev);
  if (E.atk === 'cruza') {
    // por el aire, por encima de ella; al caer, de cara a ella
    const u = Math.min(1, E.t / 0.62);
    E.x = E.saltoX0 + (E.saltoX1 - E.saltoX0) * u;
    E.alt = 4 * 210 * u * (1 - u);
    if (u >= 1) {
      E.alt = 0; E.dir = K.x < E.x ? -1 : 1; cambia(E, ESPERA); E.recarga = Math.min(E.recarga, 0.4);
      ev.push({ tipo: 'aterriza', x: E.x, y: E.y, suave: true });
    }
    return;
  }
  if (E.atk === 'dardo') {
    const A = T.dardo;
    // Como la kitsune: a bocajarro no lo suelta (nacia encima de ella y no se
    // podia parar); saca la zarpa, que avisa.
    if (E.st === AVISO && E.t >= A.aviso && dist < 200) {
      E.atk = 'zarpa'; cambia(E, AVISO); ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'zarpa' });
      return;
    }
    if (E.st === AVISO && E.t >= A.aviso) {
      // (sale de su mano: a x3, a 118 px del suelo; a la altura del pecho de ella)
      fuegos.push({ id: nuevoId(), x: E.x + E.dir * 70, y: E.y - 118, vx: E.dir * FUEGO_V * 1.05,
                    propio: false, t: 0, fin: 0, sangre: true, dueno: E.id });
      ev.push({ tipo: 'fuego', x: E.x + E.dir * 70, y: E.y - 118, sangre: true });
      cambia(E, RECUPERA);
    } else if (E.st === RECUPERA && E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
    return;
  }
  // LA LLUVIA: tres gotas, una encima de ella y dos a los lados (andando un
  // paso, o esquivando a cualquier lado, se sale de las tres).
  const A = T.lluvia;
  if (E.st === AVISO && E.t >= A.aviso) {
    // APUNTA ADONDE VA: si ella corre, la gota del medio cae donde estara al
    // caer (hasta 300 px). Sobre donde estaba, quien la perseguia corriendo
    // ya habia pasado, y mientras la condesa lanzaba, quieta, le pegaba: sin
    // defenderse llegaba al final 7 de cada 12 veces (25-09-2026).
    const x = K.x + Math.max(-300, Math.min(300, K.vx * A.cae));
    const xs = [x, x - A.separa, x + A.separa].slice(0, A.gotas);
    xs.forEach(x => fuegos.push({ id: nuevoId(), x, y: GOTA_Y0, vx: 0, gota: true,
                                       suelo: E.y, cae: A.cae, propio: false, t: 0, fin: 0, dueno: E.id }));
    ev.push({ tipo: 'lluvia', x: E.x, y: E.y });
    cambia(E, RECUPERA);
  } else if (E.st === RECUPERA && E.t >= A.recupera) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
}

// ---------- Las bolas de fuego ----------
// Vuelan en linea recta. Contra ella: C.herir con 'fuego' (la guardia la
// apaga; la PARADA la devuelve). Devuelta, quema a los enemigos.
// LA SANGRE DE LA CONDESA va por aqui tambien: el DARDO (`sangre`) es una
// bola que se para y se devuelve (devuelto le quita T.devuelto a ella), y la
// GOTA (`gota`) cae del cielo tras `cae` s de sombra y le da si esta debajo
// (de arriba: la guardia ni se entera). La sangre que le entra a ella cura a
// la condesa (`cura`, con el `dueno`).
export function stepFuegos(fuegos, K, enemigos, dt) {
  const ev = [];
  const bebe = F => {
    const D = enemigos.find(E => E.id === F.dueno);
    if (!D || !D.vivo || !D.T.bebe) return;
    const antes = D.hp;
    D.hp = Math.min(D.hpMax, D.hp + D.T.bebe);
    ev.push({ tipo: 'cura', x: D.x, y: D.y - D.T.alto - 10, n: D.hp - antes, enemigo: D });
  };
  for (const F of fuegos) {
    F.t += dt;
    if (F.fin > 0) { F.fin += dt; if (F.fin > 0.36) F.fuera = true; continue; }
    F.x += F.vx * dt;
    if (F.gota) {
      if (F.t < F.cae) continue;                  // su sombra, en el suelo: el aviso
      const u = (F.t - F.cae) / GOTA_BAJA;
      F.y = GOTA_Y0 + (F.suelo - GOTA_Y0) * Math.min(1, u);
      if (K.vivo && Math.abs(F.x - K.x) < GOTA_R + C.CUERPO_K - 6 && F.y > K.y - 160 && F.y - GOTA_R < K.y) {
        const r = C.herir(K, F.x, 'piedra', 1);
        if (r) { F.fin = 0.001; ev.push({ tipo: 'quema', x: F.x, y: F.y, r, gota: true }); bebe(F); continue; }
      }
      if (u >= 1) { F.fin = 0.001; F.y = F.suelo; ev.push({ tipo: 'salpica', x: F.x, y: F.suelo }); }
      continue;
    }
    if (F.rastrero) {
      // Por el suelo: le da si tiene los pies bajos; la guardia no la apaga.
      if (K.vivo && Math.abs(F.x - K.x) < RASTRERO_R + C.CUERPO_K - 6 && F.y - K.y < RASTRERO_ALTO) {
        const r = C.herir(K, F.x, 'rastrero', 1);
        if (r) { F.fin = 0.001; ev.push({ tipo: 'quema', x: F.x, y: F.y - 20, r, rastrero: true }); }
      }
      if (F.x < F.tramo[0] || F.x > F.tramo[1] || Math.abs(F.x - F.x0) > RASTRERO_ALCANCE) { F.fin = 0.001; ev.push({ tipo: 'apaga', x: F.x, y: F.y }); }
    } else if (!F.propio) {
      if (K.vivo && Math.abs(F.x - K.x) < FUEGO_R + C.CUERPO_K && F.y > K.y - 176 && F.y < K.y) {
        const r = C.herir(K, F.x, 'fuego', 1);
        if (r === 'parada') {
          F.vx = -F.vx * FUEGO_DEVUELTO; F.propio = true;
          ev.push({ tipo: 'devuelto', x: F.x, y: F.y });
        } else if (r) {
          F.fin = 0.001; ev.push({ tipo: r === 'bloqueado' ? 'apagado' : 'quema', x: F.x, y: F.y, r, sangre: !!F.sangre });
          if (F.sangre && r !== 'bloqueado') bebe(F);
        }
        // (invulnerable: la atraviesa)
      }
    } else {
      for (const E of enemigos) {
        if (!E.vivo || E.st === MUERTO) continue;
        if (Math.abs(F.x - E.x) < FUEGO_R + E.T.ancho && F.y > E.y - E.T.alto && F.y < E.y) {
          F.fin = 0.001;
          if (hiere(E, F.sangre && E.T.devuelto ? E.T.devuelto : 1, F.vx > 0 ? 1 : -1)) ev.push({ tipo: 'quemado', x: F.x, y: F.y, id: E.id, sangre: !!F.sangre });
          break;
        }
      }
    }
    // Se apaga lejos de ella (no al salir de pantalla: el arnes no mueve la
    // camara, y con ese criterio la bola se borraba nada mas nacer).
    if (Math.abs(F.x - K.x) > 1500 || F.t > 6) F.fuera = true;
  }
  for (let i = fuegos.length - 1; i >= 0; i--) if (fuegos[i].fuera) fuegos.splice(i, 1);
  return ev;
}

// ---------- Cuando ella le pega ----------
// Le quita `dano`. Parado en seco solo si no esta atacando: con el ataque ya
// en marcha (avisando o soltandolo) aguanta el golpe y lo termina. Si no, la
// pelea se ganaria machacando ATACAR sin mirar: el golpe le cortaria el aviso
// antes de soltar nada.
//
// EL YAMABUSHI SE CUBRE (devuelve 'rechazo', sin daño): de frente, quieto,
// andando, recien parado otro golpe o con la mano en la katana (en ese caso
// sin soltar el desenvaine: si lo cortara, machacando no atacaria nunca y la
// pelea no acabaria). Tras parar uno contesta enseguida desenvainando. Por
// la espalda, con la katana fuera (golpe y recuperacion) o aturdido, encaja.
// PERO SOLO UNO: dolido ya esta en guardia otra vez (DOLOR tambien para). El
// combo entero entra solo aturdido, y aturdido los golpes no lo sacan del
// aturdimiento: es el premio de la PARADA. (Sin esto, tras un relampago el
// combo lo dejaba dolido golpe tras golpe, 0.28 s cada uno, y moria sin
// volver a cubrirse: medido con el piloto, en 1 s.)
//
// EL JEFE NO SE ENCOGE (como el ogro): encaja y sigue con lo suyo. Con el
// dolor de los lobos, un combo tras otro lo tumbaba sin dejarle atacar (seis
// golpes en 1.3 s). Y CONTESTA: si le pegan descansando, ataca enseguida (con
// su aviso, como siempre); si no, en PASEO descansaba hasta 3 s entre ataque
// y ataque dejandose pegar.
// EL JEFE AULLANDO NO ENCAJA (devuelve 'aullando'): el aullido es su cambio
// de fase y llama a su lobo. Encajando, ella lo alcanzaba mientras aullaba y
// lo remataba antes de que llegara el segundo lobo (medido: moria a 1 s del
// segundo aullido en tres de cuatro peleas).
export function hiere(E, dano, desde) {
  if (!E.vivo || E.st === MUERTO) return false;
  if (E.T.jefe && E.st === AULLA) return 'aullando';
  if (E.tipo === 'yamabushi' && E.dir === -desde &&
      (E.st === ESPERA || E.st === ANDA || E.st === PARA || E.st === DOLOR || (E.st === AVISO && E.atk === 'iai'))) {
    // (parando otro golpe no vuelve a empezar la pausa: machacando, el combo
    // llegaba antes de que acabara y no atacaba nunca; medido, 400 s parado)
    if (E.st !== AVISO && E.st !== PARA) { cambia(E, PARA); E.vx = 0; E.recarga = Math.min(E.recarga, 0.2); }
    return 'rechazo';
  }
  E.hp -= dano; E.flash = 0.1;
  if (E.hp <= 0) {
    E.vivo = false; cambia(E, MUERTO); E.vx = desde * 180; E.alt = 0;
    return true;
  }
  if (E.T.jefe) {
    // (se apunta y se aplica al volver a esperar: recuperandose de un ataque,
    // el descanso que se pone al acabar lo pisaba)
    if (E.st !== AVISO && E.st !== ATACA && E.st !== AULLA) E.provocado = true;
    return true;
  }
  if (E.tipo === 'yamabushi' && E.st === AGOTADA) return true;
  if (E.st !== AVISO && E.st !== ATACA && E.st !== AULLA) { cambia(E, DOLOR); E.vx = desde * 160; E.dir = -desde; E.alt = 0; }
  return true;
}

// ¿La espada de ella (el tramo del cuerpo a la punta) le toca? (Al cuervo
// en el aire no se le alcanza.)
export function espadaToca(E, K) {
  if (!E.vivo || E.st === MUERTO || E.oculto || E.alt > 40) return false;
  const [px] = C.puntaEspada(K);
  const a = Math.min(K.x, px), b = Math.max(K.x, px);
  return b >= E.x - E.T.ancho && a <= E.x + E.T.ancho && Math.abs(K.y - E.y) < E.T.alto + 40;
}

// Su cuerpo es solido para ella (como el del ogro), salvo esquivando: asi
// no se le mete dentro y se puede atravesar la acometida. El cuervo en el
// aire y el yamabushi cruzando de un relampago no chocan (se la pasa por
// debajo, o la atraviesa).
export function empuja(E, K) {
  if (!E.vivo || E.st === MUERTO || C.invulnerable(K) && K.st === C.ESQUIVA) return;
  if (E.oculto || E.alt > 0 || (E.st === ATACA && E.atk === 'relampago')) return;
  if (K.y < E.y - E.T.alto + 10) return;       // por encima (saltando): pasa
  const min = E.T.ancho + C.CUERPO_K - 8;
  const d = K.x - E.x;
  if (Math.abs(d) < min) K.x = E.x + (d >= 0 ? min : -min);
}

// Que pose y fotograma toca. Devuelve [animacion, fotograma]; los
// fotogramas de cada animacion salen del dibujo (enemigos-atlas.js).
export function pose(E, n) {
  // Topando con el borde de su sitio (mueve() le quita la velocidad) no anda
  // sin moverse: espera. (Con ella junto al foso, fuera de su alcance pero en
  // su tramo, el vampiro andaba contra el borde como en una cinta.)
  if (E.st === ANDA && E.vx === 0) E = { ...E, st: ESPERA };
  const T = E.T;
  if (E.st === MUERTO) {
    const k = E.tipo === 'lobo' || E.tipo === 'alfa' ? Math.min(1, Math.floor(E.muertoT / 0.18)) : Math.min(n.muere - 1, Math.floor(E.muertoT / 0.1));
    return ['muere', k];
  }
  if (E.tipo === 'karasu') return poseKarasu(E, n);
  if (E.tipo === 'yamabushi') return poseYamabushi(E, n);
  if (E.tipo === 'vampira') return poseVampira(E, n);
  if (E.tipo === 'vampiro') return poseVampiro(E, n);
  if (E.tipo === 'condesa') return poseCondesa(E, n);
  if (E.st === DOLOR) return ['dolor', E.t < T.dolor / 2 ? 0 : 1];
  if (E.st === HUYE) return ['salta', Math.min(n.salta - 1, Math.floor(E.t / 0.5 * n.salta))];
  if (E.tipo === 'alfa') {
    // el aullido: erguido con los brazos arriba (el final del zarpazo hacia
    // arriba), estirandose
    if (E.st === AULLA) return ['levanta', E.t < 0.2 ? 2 : 4];
    if (E.st === AVISO && E.atk === 'levanta') return ['levanta', Math.min(1, Math.floor(E.t / T.levanta.aviso * 2))];
    if (E.st === ATACA && E.atk === 'levanta') return ['levanta', 2 + Math.min(1, Math.floor(E.t / T.levanta.activo * 2))];
    if (E.st === RECUPERA && E.atk === 'levanta') return ['levanta', 4];
  }
  if (E.tipo === 'lobo' || E.tipo === 'alfa') {
    if (E.st === AVISO && E.atk === 'zarpazo') return ['zarpazo', Math.min(3, Math.floor(E.t / T.zarpazo.aviso * 4))];
    if (E.st === ATACA && E.atk === 'zarpazo') return ['zarpazo', 4];
    if (E.st === RECUPERA && E.atk === 'zarpazo') return ['zarpazo', 5];
    if (E.st === AVISO && E.atk === 'barre') return ['barre', Math.min(1, Math.floor(E.t / T.barre.aviso * 2))];
    if (E.st === ATACA && E.atk === 'barre') return ['barre', 2];
    if (E.st === RECUPERA && E.atk === 'barre') return ['barre', 3];
    if (E.st === AVISO && E.atk === 'acomete') return ['acomete', Math.min(1, Math.floor(E.t / T.acomete.aviso * 2))];
    if (E.st === ATACA && E.atk === 'acomete') return ['acomete', 2 + Math.min(2, Math.floor(E.t / T.acomete.vuelo * 3))];
    if (E.st === RECUPERA && E.atk === 'acomete') return ['acomete', E.t < T.acomete.recupera / 2 ? 5 : 6];
    if (E.st === ANDA) return Math.abs(E.vx) > 200 ? ['corre', Math.floor(E.animT / 0.07) % n.corre] : ['anda', Math.floor(E.animT / 0.08) % n.anda];
    return ['idle', Math.floor(E.animT / 0.12) % n.idle];
  }
  // El rastrero: el remolino y las llamas a los pies durante el aviso (0-6);
  // la llama sale por el suelo al recuperar (7-9).
  if (E.st === AVISO && E.atk === 'rastrero') return ['rastrero', Math.min(6, Math.floor(E.t / T.rastrero.aviso * 7))];
  if (E.st === RECUPERA && E.atk === 'rastrero') return ['rastrero', 7 + Math.min(2, Math.floor(E.t / T.rastrero.recupera * 3))];
  if (E.st === AVISO && E.atk === 'lanza') return ['lanza', Math.min(5, Math.floor(E.t / T.lanza.aviso * 6))];
  if (E.st === RECUPERA && E.atk === 'lanza') return ['lanza', 6];
  if (E.st === AVISO && E.atk === 'corro') return ['corro', Math.min(2, Math.floor(E.t / T.corro.aviso * 3))];
  if (E.st === ATACA && E.atk === 'corro') return ['corro', 3 + Math.min(5, Math.floor(E.t / T.corro.activo * 6))];
  if (E.st === AGOTADA) return ['corro', 9];
  if (E.st === ANDA) return ['anda', Math.floor(E.animT / 0.1) % n.anda];
  return ['idle', Math.floor(E.animT / 0.12) % n.idle];
}

// EL CUERVO. Su salto (vuela, 15 fotogramas) es el picado entero: 0-1
// agachado, 1-5 el aleteo de subida, 6-8 envolviendose en las alas, 9-10
// envuelto cayendo y 11-14 abriendolas en el suelo. Encima de ella aletea con
// el 1 y el 5, las alas atras y abiertas: con el 2-4 (las alas en alto, 248
// px) se salia por arriba de la pantalla.
function poseKarasu(E, n) {
  const T = E.T, A = T.picado;
  if (E.st === DOLOR) return ['dolor', Math.min(2, Math.floor(E.t / T.dolor * 3))];
  if (E.st === HUYE) return ['vuela', 1 + Math.min(3, Math.floor(E.t / 0.5 * 4))];
  if (E.atk === 'tajo') {
    if (E.st === AVISO) return ['tajo', Math.min(1, Math.floor(E.t / T.tajo.aviso * 2))];
    if (E.st === ATACA) return ['tajo', 2];
    if (E.st === RECUPERA) return ['tajo', 3];
  }
  if (E.atk === 'picado') {
    if (E.st === AVISO) return ['vuela', Math.min(1, Math.floor(E.t / A.aviso * 2))];
    if (E.st === ATACA) {
      if (E.fase === 'sube') return ['vuela', 1 + Math.min(4, Math.floor(E.t / A.sube * 5))];
      if (E.fase === 'cierne') return ['vuela', Math.floor(E.animT / 0.12) % 2 ? 5 : 1];
      if (E.fase === 'fija') return ['vuela', 6 + Math.min(2, Math.floor(E.t / A.fija * 3))];
      return ['vuela', 9 + Math.min(1, Math.floor(E.t / A.cae * 2))];
    }
    if (E.st === RECUPERA) return ['vuela', 11 + Math.min(3, Math.floor(E.t / A.recupera * 4))];
  }
  if (E.st === ANDA) return Math.abs(E.vx) > 200 ? ['corre', Math.floor(E.animT / 0.08) % n.corre] : ['anda', Math.floor(E.animT / 0.1) % n.anda];
  return ['idle', Math.floor(E.animT / 0.13) % n.idle];
}

// LA VAMPIRA. La zarpa: 0-2 echandose atras, 3 el zarpazo, 4 despues. El
// mordisco: 0-3 le crece la cabeza de monstruo (el aviso), 4 la dentellada, y
// al recuperarse la cabeza se le encoge (3, 2, 1).
function poseVampira(E, n) {
  const T = E.T;
  if (E.st === DOLOR) return ['dolor', E.t < T.dolor / 2 ? 0 : 1];
  if (E.st === HUYE) return ['salta', Math.min(n.salta - 1, Math.floor(E.t / 0.5 * n.salta))];
  if (E.atk === 'zarpa') {
    if (E.st === AVISO) return ['zarpa', Math.min(2, Math.floor(E.t / T.zarpa.aviso * 3))];
    if (E.st === ATACA) return ['zarpa', 3];
    if (E.st === RECUPERA) return ['zarpa', 4];
  }
  if (E.atk === 'muerde') {
    if (E.st === AVISO) return ['muerde', Math.min(3, Math.floor(E.t / T.muerde.aviso * 4))];
    if (E.st === ATACA) return ['muerde', 4];
    if (E.st === RECUPERA) return ['muerde', Math.max(1, 3 - Math.floor(E.t / T.muerde.recupera * 3))];
  }
  if (E.st === ANDA) return Math.abs(E.vx) > 200 ? ['corre', Math.floor(E.animT / 0.08) % n.corre] : ['anda', Math.floor(E.animT / 0.1) % n.anda];
  return ['idle', Math.floor(E.animT / 0.13) % n.idle];
}

// EL VAMPIRO. La estocada: 0 en guardia de esgrima (el aviso), 1 a fondo, 2
// estirado. El tajo bajo: 0-1 la espada abajo (el aviso), 2 el barrido. El
// salto: 0-1 agachado, 2-5 por el aire, 6 cayendo.
function poseVampiro(E, n) {
  const T = E.T;
  if (E.st === DOLOR || E.st === HUYE) return E.st === DOLOR ? ['dolor', 0] : ['salta', Math.min(n.salta - 1, 2 + Math.floor(E.t / 0.5 * 4))];
  if (E.atk === 'estocada') {
    if (E.st === AVISO) return ['estocada', 0];
    if (E.st === ATACA) return ['estocada', E.t < T.estocada.activo / 2 ? 1 : 2];
    if (E.st === RECUPERA) return ['estocada', E.t < T.estocada.recupera / 2 ? 2 : 0];
  }
  if (E.atk === 'bajo') {
    if (E.st === AVISO) return ['bajo', Math.min(1, Math.floor(E.t / T.bajo.aviso * 2))];
    return ['bajo', 2];
  }
  if (E.atk === 'salto') {
    if (E.st === AVISO) return ['salta', Math.min(1, Math.floor(E.t / T.salto.aviso * 2))];
    if (E.st === ATACA) return ['salta', E.t >= T.salto.vuelo * 0.85 ? 6 : 2 + Math.min(3, Math.floor(E.t / T.salto.vuelo * 4))];
  }
  if (E.st === ANDA) return Math.abs(E.vx) > 200 ? ['corre', Math.floor(E.animT / 0.08) % n.corre] : ['anda', Math.floor(E.animT / 0.1) % n.anda];
  return ['idle', Math.floor(E.animT / 0.13) % n.idle];
}

// LA CONDESA. El dardo: 0-3 la sangre girandole en la mano (el aviso), 4-5
// lanzandolo. La lluvia: 0-2 alzando el brazo. La zarpa: un solo fotograma
// (el aviso es su reposo temblando, que pinta el dibujo). Su brinco, el salto.
function poseCondesa(E, n) {
  const T = E.T;
  if (E.st === HUYE) return ['salta', Math.min(n.salta - 1, Math.floor(E.t / 0.5 * n.salta))];
  if (E.atk === 'cruza' && E.st === ATACA) return ['salta', Math.min(n.salta - 1, Math.floor(E.t / 0.62 * n.salta))];
  if (E.atk === 'dardo') {
    if (E.st === AVISO) return ['dardo', Math.min(3, Math.floor(E.t / T.dardo.aviso * 4))];
    if (E.st === RECUPERA) return ['dardo', E.t < T.dardo.recupera / 2 ? 4 : 5];
  }
  if (E.atk === 'lluvia') {
    if (E.st === AVISO) return ['lluvia', Math.min(2, Math.floor(E.t / T.lluvia.aviso * 3))];
    if (E.st === RECUPERA) return ['lluvia', 2];
  }
  if (E.atk === 'zarpa') {
    if (E.st === AVISO) return ['idle', 0];
    return ['zarpa', 0];
  }
  if (E.st === ANDA) return Math.abs(E.vx) > 160 ? ['corre', Math.floor(E.animT / 0.08) % n.corre] : ['anda', Math.floor(E.animT / 0.11) % n.anda];
  return ['idle', Math.floor(E.animT / 0.14) % n.idle];
}

// EL YAMABUSHI. El desenvaine (iai): 0-3 la mano en la empuñadura, 4 el tajo
// y 5 la katana fuera. Parando un golpe de ella, la katana a medio sacar (el
// 2). Aturdido, tambaleandose con los fotogramas del golpe recibido.
function poseYamabushi(E, n) {
  const T = E.T;
  if (E.st === DOLOR) return ['dolor', Math.min(2, Math.floor(E.t / T.dolor * 3))];
  if (E.st === AGOTADA) return ['dolor', 1 + Math.floor(E.animT / 0.22) % 2];
  if (E.st === PARA) return ['iai', 2];
  if (E.atk === 'iai') {
    if (E.st === AVISO) return ['iai', Math.min(3, Math.floor(E.t / T.iai.aviso * 4))];
    if (E.st === ATACA) return ['iai', 4];
    if (E.st === RECUPERA) return ['iai', 5];
  }
  if (E.atk === 'relampago') {
    if (E.st === AVISO) return ['relampago', 0];
    if (E.st === ATACA) return ['relampago', 1];
    if (E.st === RECUPERA) return ['relampago', 2];
  }
  if (E.st === ANDA) return ['anda', Math.floor(E.animT / 0.11) % n.anda];
  return ['idle', Math.floor(E.animT / 0.13) % n.idle];
}
