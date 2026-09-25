// LOS ENEMIGOS de la aventura: el HOMBRE LOBO y la KITSUNE. SIN DOM, como
// caba-cuerpo.js y ogro-cuerpo.js: el nivel (caba-nivel.js), la escena y el
// arnes (tools/prueba-nivel.mjs) mueven exactamente esto.
//
// La ley es la del ogro: CADA ATAQUE AVISA Y TIENE SU RESPUESTA, y no hay un
// boton que valga para todo.
//
//   LOBO     ZARPAZO    se alza y suelta la garra de cerca. Se PARA con la
//                       GUARDIA; a tiempo es una PARADA y el siguiente ATACAR
//                       es contraataque.
//            ACOMETIDA  se agacha y se lanza en plancha desde media distancia.
//                       Rompe la guardia: se ESQUIVA atravesandolo (o se salta).
//   KITSUNE  BOLA DE FUEGO  le crece en la mano y la lanza a la altura del
//                       pecho: saltar no sirve. La GUARDIA la apaga, y una
//                       PARADA se la DEVUELVE (y le quema a ella).
//            CORRO DE FUEGO  si ella se le pega, se rodea de fuegos: rompe la
//                       guardia. Hay que apartarse; despues se queda agotada y
//                       es cuando se le pega.
//
// Los numeros de los avisos salen de los dibujos (el lobo tarda cuatro
// fotogramas en alzarse; la bola crece seis) y se miden en el arnes: cada
// respuesta tiene que tener su ventana de al menos 200-250 ms.

import * as C from './caba-cuerpo.js';

// Estados
export const ESPERA = 0, ANDA = 1, AVISO = 2, ATACA = 3, RECUPERA = 4, DOLOR = 5, MUERTO = 6, HUYE = 7, AGOTADA = 8;

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
  // Lo que se queda agotada tras el corro: es el premio por apartarse, y
  // tiene que dar para volver (apartarse son ~200 px, casi un segundo).
  agotada: 1.4,
  recarga: [1.8, 2.4],
  dolor: 0.30,
};
export const TIPOS = { lobo: LOBO, kitsune: KITSUNE };

// ---------- El fuego ----------
export const FUEGO_V = 420;            // px/s
export const FUEGO_R = 16;             // radio de la bola
export const FUEGO_ALTO = 150;         // a que altura sale (la mano, sobre sus pies)
export const FUEGO_DEVUELTO = 1.25;    // la devuelta va mas rapida
export const FUEGO_MANO = 74;          // de su centro a la mano

// LA DIFICULTAD (caba-partida.js, opcionesBosque): el ritmo acorta los
// avisos y la pausa estira lo que descansan entre ataque y ataque (y lo que
// se queda agotada la kitsune). Se hace una copia del tipo ya escalada: asi
// todo lo que lee E.T (la logica y las poses) va al ritmo de la dificultad.
// La ACOMETIDA lleva su propio ritmo (`ritmoCarrera`, como la embestida del
// ogro): se contesta atravesandola cuando viene, y con un aviso mas largo quien
// reacciona rapido esquiva antes de que salte y cae delante de el.
function escala(T, o) {
  const ritmo = o.ritmo || 1, pausa = o.pausa || 1, carrera = o.ritmoCarrera || ritmo;
  const E = JSON.parse(JSON.stringify(T));
  for (const k of ['zarpazo', 'acomete', 'lanza', 'corro']) if (E[k]) E[k].aviso = T[k].aviso / (k === 'acomete' ? carrera : ritmo);
  for (const k of ['recarga', 'recargaAcomete']) if (E[k]) E[k] = T[k].map(v => v * pausa);
  if (E.agotada) E.agotada = T.agotada * pausa;
  return E;
}

// `x0`, `x1`: por donde se mueve (dentro de su tramo, lejos de los bordes:
// no se cae a los fosos). `tramo`: el tramo de camino entero, [desde, hasta]:
// solo va a por ella si lo pisa. `o`: la dificultad.
export function makeEnemigo(tipo, x, y, x0, x1, id, o = {}, tramo = [-Infinity, Infinity]) {
  const T = escala(TIPOS[tipo], o);
  return {
    id, tipo, T, x, y, vx: 0, dir: -1, x0, x1, tramo,
    st: ESPERA, t: 0, animT: 0, atk: null, golpeo: false,
    hp: T.hp, hpMax: T.hp, vivo: true, recarga: 0.6, hurtT: 0, flash: 0,
    despierto: false, abierto: 0, muertoT: 0,
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
export function stepEnemigo(E, K, dt, rnd, fuegos) {
  const ev = [];
  E.t += dt; E.animT += dt;
  if (E.flash > 0) E.flash -= dt;
  if (E.recarga > 0) E.recarga -= dt;
  if (E.abierto > 0) E.abierto -= dt;
  if (E.st === MUERTO) { E.muertoT += dt; E.vx *= 0.85; mueve(E, dt); return ev; }
  const T = E.T, dist = Math.abs(K.x - E.x), haciaElla = K.x < E.x ? -1 : 1;
  // Se despierta al tenerla cerca, o (si el nivel se lo pide) al pasar ella
  // por un sitio: asi dos del mismo tramo no se le echan encima a la vez.
  if (!E.despierto) {
    if (E.despiertaX !== undefined ? K.x >= E.despiertaX : dist < T.despierta) E.despierto = true;
    else return ev;
  }

  if (E.st === DOLOR) {
    E.vx *= 0.85;
    if (E.t >= T.dolor) {
      // Tras el golpe, la kitsune salta lejos de ella; el lobo, a veces.
      if (E.tipo === 'kitsune' || rnd() < 0.35) { cambia(E, HUYE); E.vx = -haciaElla * 300; E.dir = haciaElla; }
      else { cambia(E, ESPERA); E.recarga = Math.max(E.recarga, 0.4); }
    }
  } else if (E.st === HUYE) {
    // un salto hacia atras (el dibujo es su salto)
    E.vx *= 0.97;
    if (E.t >= 0.5) { cambia(E, ESPERA); E.vx = 0; E.recarga = Math.max(E.recarga, 0.5); }
  } else if (E.st === AGOTADA) {
    E.vx = 0;
    if (E.t >= T.agotada) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
  } else if (E.tipo === 'lobo') lobo(E, K, rnd, dist, haciaElla, ev);
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
    if (E.recarga <= 0 && dist <= 150) {
      E.atk = 'zarpazo'; cambia(E, AVISO); E.vx = 0; ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'zarpazo' });
    } else if (E.recarga <= 0 && dist > 170 && dist <= 330 && puedeVolar(E, hacia)) {
      E.atk = 'acomete'; cambia(E, AVISO); E.vx = 0; ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'acomete' });
    } else if (dist > 330) {
      // de lejos, corre hacia ella
      E.vx = hacia * T.corre; if (E.st !== ANDA) cambia(E, ANDA);
    } else if (E.recarga > 0) {
      // recargando, guarda la distancia: ni se le echa encima ni huye
      const quiere = dist < 190 ? -hacia : dist > 260 ? hacia : 0;
      E.vx = quiere * T.anda;
      if (quiere && E.st !== ANDA) cambia(E, ANDA);
      if (!quiere && E.st !== ESPERA) cambia(E, ESPERA);
    } else {
      E.vx = hacia * T.anda; if (E.st !== ANDA) cambia(E, ANDA);
    }
    return;
  }
  if (E.atk === 'zarpazo') {
    const A = T.zarpazo;
    if (E.st === AVISO && E.t >= A.aviso) { cambia(E, ATACA); E.golpeo = false; E.vx = E.dir * 140; }
    else if (E.st === ATACA) {
      if (!E.golpeo && K.vivo && Math.abs(K.y - E.y) < 150) {
        const d = (K.x - E.x) * E.dir;
        if (d > -10 && d < A.alcance + C.CUERPO_K) {
          E.golpeo = true;
          const r = C.herir(K, E.x, A.tipo, A.dano);
          if (r === 'parada') { E.abierto = C.PARADA_PREMIO; ev.push({ tipo: 'parada', x: E.x + E.dir * 50, y: E.y - 70 }); }
          else if (r === 'bloqueado') { E.vx = -E.dir * 180; ev.push({ tipo: 'bloqueo', x: E.x + E.dir * 50, y: E.y - 70 }); }
          else if (r) ev.push({ tipo: 'golpe', x: K.x, y: K.y - 90, r });
        }
      }
      E.vx *= 0.8;
      if (E.t >= A.activo) cambia(E, RECUPERA);
    } else if (E.st === RECUPERA) {
      E.vx *= 0.8;
      // Tras una parada se queda abierto lo que dura el premio de ella.
      if (E.t >= Math.max(A.recupera, E.abierto)) { cambia(E, ESPERA); E.recarga = entre(rnd, T.recarga); }
    }
    return;
  }
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
      // en 0.2 s y no hay guardia que la pare a tiempo.
      E.dir = hacia; E.atk = 'lanza'; cambia(E, AVISO); E.vx = 0;
      ev.push({ tipo: 'aviso', x: E.x, y: E.y, atk: 'lanza' });
    } else {
      E.dir = hacia; E.vx = 0; if (E.st !== ESPERA) cambia(E, ESPERA);
    }
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
      fuegos.push({ id: E.id * 100 + ((E.t * 1000) | 0), x: E.x + E.dir * FUEGO_MANO, y: E.y - FUEGO_ALTO,
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

// ---------- Las bolas de fuego ----------
// Vuelan en linea recta. Contra ella: C.herir con 'fuego' (la guardia la
// apaga; la PARADA la devuelve). Devuelta, quema a los enemigos.
export function stepFuegos(fuegos, K, enemigos, dt) {
  const ev = [];
  for (const F of fuegos) {
    F.t += dt;
    if (F.fin > 0) { F.fin += dt; if (F.fin > 0.36) F.fuera = true; continue; }
    F.x += F.vx * dt;
    if (!F.propio) {
      if (K.vivo && Math.abs(F.x - K.x) < FUEGO_R + C.CUERPO_K && F.y > K.y - 176 && F.y < K.y) {
        const r = C.herir(K, F.x, 'fuego', 1);
        if (r === 'parada') {
          F.vx = -F.vx * FUEGO_DEVUELTO; F.propio = true;
          ev.push({ tipo: 'devuelto', x: F.x, y: F.y });
        } else if (r) {
          F.fin = 0.001; ev.push({ tipo: r === 'bloqueado' ? 'apagado' : 'quema', x: F.x, y: F.y, r });
        }
        // (invulnerable: la atraviesa)
      }
    } else {
      for (const E of enemigos) {
        if (!E.vivo || E.st === MUERTO) continue;
        if (Math.abs(F.x - E.x) < FUEGO_R + E.T.ancho && F.y > E.y - E.T.alto && F.y < E.y) {
          F.fin = 0.001;
          if (hiere(E, 1, F.vx > 0 ? 1 : -1)) ev.push({ tipo: 'quemado', x: F.x, y: F.y, id: E.id });
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
export function hiere(E, dano, desde) {
  if (!E.vivo || E.st === MUERTO) return false;
  E.hp -= dano; E.flash = 0.1;
  if (E.hp <= 0) {
    E.vivo = false; cambia(E, MUERTO); E.vx = desde * 180;
    return true;
  }
  if (E.st !== AVISO && E.st !== ATACA) { cambia(E, DOLOR); E.vx = desde * 160; E.dir = -desde; }
  return true;
}

// ¿La espada de ella (el tramo del cuerpo a la punta) le toca?
export function espadaToca(E, K) {
  if (!E.vivo || E.st === MUERTO) return false;
  const [px] = C.puntaEspada(K);
  const a = Math.min(K.x, px), b = Math.max(K.x, px);
  return b >= E.x - E.T.ancho && a <= E.x + E.T.ancho && Math.abs(K.y - E.y) < E.T.alto + 40;
}

// Su cuerpo es solido para ella (como el del ogro), salvo esquivando: asi
// no se le mete dentro y se puede atravesar la acometida.
export function empuja(E, K) {
  if (!E.vivo || E.st === MUERTO || C.invulnerable(K) && K.st === C.ESQUIVA) return;
  if (K.y < E.y - E.T.alto + 10) return;       // por encima (saltando): pasa
  const min = E.T.ancho + C.CUERPO_K - 8;
  const d = K.x - E.x;
  if (Math.abs(d) < min) K.x = E.x + (d >= 0 ? min : -min);
}

// Que pose y fotograma toca. Devuelve [animacion, fotograma]; los
// fotogramas de cada animacion salen del dibujo (enemigos-atlas.js).
export function pose(E, n) {
  const T = E.T;
  if (E.st === MUERTO) {
    const k = E.tipo === 'lobo' ? Math.min(1, Math.floor(E.muertoT / 0.18)) : Math.min(9, Math.floor(E.muertoT / 0.1));
    return ['muere', k];
  }
  if (E.st === DOLOR) return ['dolor', E.t < T.dolor / 2 ? 0 : 1];
  if (E.st === HUYE) return ['salta', Math.min(n.salta - 1, Math.floor(E.t / 0.5 * n.salta))];
  if (E.tipo === 'lobo') {
    if (E.st === AVISO && E.atk === 'zarpazo') return ['zarpazo', Math.min(3, Math.floor(E.t / T.zarpazo.aviso * 4))];
    if (E.st === ATACA && E.atk === 'zarpazo') return ['zarpazo', 4];
    if (E.st === RECUPERA && E.atk === 'zarpazo') return ['zarpazo', 5];
    if (E.st === AVISO && E.atk === 'acomete') return ['acomete', Math.min(1, Math.floor(E.t / T.acomete.aviso * 2))];
    if (E.st === ATACA && E.atk === 'acomete') return ['acomete', 2 + Math.min(2, Math.floor(E.t / T.acomete.vuelo * 3))];
    if (E.st === RECUPERA && E.atk === 'acomete') return ['acomete', E.t < T.acomete.recupera / 2 ? 5 : 6];
    if (E.st === ANDA) return Math.abs(E.vx) > 200 ? ['corre', Math.floor(E.animT / 0.07) % n.corre] : ['anda', Math.floor(E.animT / 0.08) % n.anda];
    return ['idle', Math.floor(E.animT / 0.12) % n.idle];
  }
  if (E.st === AVISO && E.atk === 'lanza') return ['lanza', Math.min(5, Math.floor(E.t / T.lanza.aviso * 6))];
  if (E.st === RECUPERA && E.atk === 'lanza') return ['lanza', 6];
  if (E.st === AVISO && E.atk === 'corro') return ['corro', Math.min(2, Math.floor(E.t / T.corro.aviso * 3))];
  if (E.st === ATACA && E.atk === 'corro') return ['corro', 3 + Math.min(5, Math.floor(E.t / T.corro.activo * 6))];
  if (E.st === AGOTADA) return ['corro', 9];
  if (E.st === ANDA) return ['anda', Math.floor(E.animT / 0.1) % n.anda];
  return ['idle', Math.floor(E.animT / 0.12) % n.idle];
}
