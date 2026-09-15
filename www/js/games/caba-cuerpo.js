// EL CABALLERO - su fisica y su maquina de estados. SIN DOM: el juego y el
// arnes de Node (tools/prueba-caballero.mjs) mueven exactamente este modelo,
// como en el AHORCADO.
//
// Es el segundo juego del arcade con SUELO y gravedad (el otro es FURIA), y el
// primero donde se camina. Por eso el eje Y NO lo manda el pulgar: lo manda la
// fisica. El pulgar solo mueve en X y decide cuando se salta.
//
// Nada de esto viene de otro juego del arcade. Los numeros salen de simular
// aqui, no de copiar los de NEON FIST (que es un juego cenital sin gravedad).

// TODO AL DOBLE respecto al primer intento: el lienzo es 1200x540 y la
// protagonista mide 128x180 en vez de 22x30, asi que las distancias, las
// velocidades y las alturas se duplican para que la sensacion sea la misma.
export const AX0 = 60, AX1 = 1140;     // paredes de la arena, en px virtuales
export const SUELO = 452;              // la linea donde apoyan los pies
export const ALTO = 180, ANCHO = 128;  // Romina, en celdas

// --- Andar ---
export const VEL = 240;                // px/s. Cruza la arena en 4.5 s.
const ACEL = 1800, FREN = 2800;        // px/s^2: arranca rapido, frena mas
const AIRE_CTRL = 0.55;                // cuanto manda el pulgar en el aire

// --- Saltar ---
// Gravedad ASIMETRICA: sube mas lento de lo que cae. Es lo que hace que el
// salto se sienta con peso en vez de flotante, y es gratis.
export const JUMP_V = 860;
export const GRAV_UP = 3000, GRAV_DN = 4200;
// Soltar pronto recorta el salto. Con 0.35 el salto corto se quedaba en 12 px
// (medido): inutil, no servia ni para esquivar un barrido. Con 0.55 son 27 px,
// la mitad del completo, que es una decision de verdad.
const CORTE_T = 0.09, CORTE_F = 0.55;
const COYOTE = 0.08, BUFFER = 0.10;    // margenes invisibles que salvan el salto

// --- Rodar ---
export const ROLL_T = 0.36, ROLL_CD = 0.62;
const ROLL_V0 = 660;                   // pico; el perfil baja al final
export const ROLL_INV0 = 0.06, ROLL_INV1 = 0.28;   // invulnerable solo en medio

// --- Tajo: un COMBO DE TRES, no un golpe suelto ---
//
// Un solo ataque con el mismo tiempo siempre se siente pobre por mucho que se
// dibuje bien: pulsas y pasa lo mismo. Tres golpes encadenados dan ritmo, y el
// tercero es una decision (si lo alcanzas, pega el doble y empuja).
//
// Cada golpe es mas lento y mas fuerte que el anterior. Si los tres fueran
// iguales seria el mismo boton tres veces, no un combo.
//
//   [ciclo, activa0, activa1, avance, daño, alcance]
export const TAJOS = [
  [0.26, 0.07, 0.13, 26, 1, 74],   // 1 REVES:   rapido, corto
  [0.30, 0.09, 0.16, 34, 1, 78],   // 2 DERECHO: cruza al otro lado
  [0.46, 0.16, 0.28, 58, 2, 92],   // 3 GIRO:    gira entera, largo y fuerte
];
// Ventana para encadenar: desde que acaba la parte activa hasta un poco
// despues del final del ciclo. Medido: da 250-300 ms de margen, comodo en un
// movil donde el dedo no ve el boton (por debajo de 150 ms frustra).
export const ENLACE_EXTRA = 0.12;
// Cuanto se conserva del enlace tras acabar el combo entero, antes de que
// vuelva a empezar por el primero.
export const COMBO_OLVIDO = 0.34;

export const TAJO_T = 0.30;                        // compat: el golpe de en medio
export const TAJO_A0 = 0.08, TAJO_A1 = 0.15;       // ventana activa (idem)
export const ALCANCE = 78;             // del centro del cuerpo a la punta de la espada
const TAJO_FREN = 0.45;                // cuanta velocidad conserva al cortar

// --- Vida ---
export const HP0 = 4;
export const IFRAME = 1.0;

// Estados
export const QUIETO = 0, CORRE = 1, SALTA = 2, RUEDA = 3, TAJO = 4, DOLOR = 5, MUERTO = 6, BLOQUEA = 7;
// (EMPUJE = 8 se declara abajo, con el resto de las constantes del escudo)
// Cuanto tarda el escudo en levantarse: antes de eso NO protege. Es lo que
// impide que bloquear sea un boton de invulnerabilidad.
export const BLOQ_SUBE = 0.10;

// --- El escudo tiene TRES verbos, no uno ---
//
// Mantener la guardia y ya es pasivo: pulsas y esperas. Estos tres se hacen
// con el MISMO boton, y cual sale depende de CUANDO lo pulsas, que es lo que
// convierte el escudo en una decision en vez de un seguro.
//
//  1. PARADA (parry). Si el golpe llega en los primeros 0.18 s de levantar el
//     escudo, no solo lo para: rebota al enemigo y le deja abierto. Es la
//     recompensa por leer el ataque en vez de taparse todo el rato.
//  2. GUARDIA. Lo de siempre: para de frente, a cambio de moverse al 40%.
//  3. EMPUJON. Pulsar ATACAR con el escudo arriba da un golpe de escudo que no
//     hace daño pero empuja y rompe la guardia del otro.
export const PARADA_VENT = 0.18;       // ventana del parry, desde BLOQ_SUBE
export const PARADA_PREMIO = 0.55;     // cuanto se queda abierto el enemigo
export const ESC_EMPUJE_T = 0.28;      // lo que dura el empujon
export const ESC_EMPUJE_A0 = 0.06, ESC_EMPUJE_A1 = 0.16;
export const ESC_EMPUJE_F = 340;       // cuanta fuerza lleva
export const ESC_EMPUJE_CD = 0.5;      // enfriamiento, para que no se abuse
export const EMPUJE = 8;               // estado nuevo

export function makeCaballero(x) {
  return {
    x, y: SUELO, vx: 0, vy: 0, dir: 1,
    st: QUIETO, t: 0,
    enSuelo: true, coyote: 0, buffer: 0, cortable: 0, aterriza: 0,
    rollT: 0, rollCd: 0,
    bloqT: 0, bloqHit: 0,
    tajoT: 0, tajoId: 0, golpeo: 0, combo: 0, comboOlvido: 0,
    escT: 0, escGolpe: 0, parada: 0, escCd: 0, escId: 0,
    hp: HP0, iframe: 0, hurtT: 0,
    animT: 0, frame: 0,
    vivo: true,
  };
}

// Un paso. `inp` = { dx, salta, golpea, rueda }: dx es el stick (-1..1) y los
// otros tres son FLANCOS (true solo en el frame en que se pulsan).
export function stepCaballero(K, inp, dt) {
  if (!K.vivo) return;
  K.t += dt; K.animT += dt;
  if (K.iframe > 0) K.iframe -= dt;
  if (K.rollCd > 0) K.rollCd -= dt;
  if (K.hurtT > 0) K.hurtT -= dt;

  // Buffer de salto: si pulsa un poco antes de tocar suelo, se le guarda.
  if (inp.salta) K.buffer = BUFFER;
  if (K.buffer > 0) K.buffer -= dt;

  const puedeActuar = K.st !== RUEDA && K.st !== DOLOR;

  // --- Bloquear: mientras se mantiene el boton y este en el suelo ---
  if (K.bloqHit > 0) K.bloqHit -= dt;
  if (K.aterriza > 0) K.aterriza -= dt;
  if (K.escCd > 0) K.escCd -= dt;
  if (K.parada > 0) K.parada -= dt;

  // EMPUJON DE ESCUDO: atacar con el escudo arriba. Se comprueba ANTES que el
  // tajo, porque con el escudo en alto el boton de atacar significa esto.
  if (inp.golpea && K.st === BLOQUEA && K.escCd <= 0 && K.enSuelo) {
    K.st = EMPUJE; K.escT = 0; K.animT = 0; K.escCd = ESC_EMPUJE_CD;
    K.escId = (K.escId || 0) + 1; K.escGolpe = 0;
    K.vx = K.dir * 150;
  }
  if (K.st === EMPUJE) {
    K.escT += dt;
    if (K.escT >= ESC_EMPUJE_T) {
      // Si sigue apretando el escudo, vuelve a la guardia; si no, se baja.
      K.st = inp.bloquea ? BLOQUEA : QUIETO;
      K.bloqT = inp.bloquea ? BLOQ_SUBE : 0;   // ya lo tenia arriba
      K.animT = 0;
    }
  } else if (inp.bloquea && K.enSuelo && puedeActuar && K.st !== TAJO) {
    if (K.st !== BLOQUEA) { K.st = BLOQUEA; K.bloqT = 0; K.animT = 0; }
    K.bloqT += dt;
  } else if (K.st === BLOQUEA) {
    K.st = QUIETO; K.bloqT = 0; K.animT = 0;
  }

  // --- Rodar: manda sobre todo lo demas, y cancela el tajo ---
  if (inp.rueda && K.rollCd <= 0 && K.st !== RUEDA && K.st !== DOLOR && K.enSuelo) {
    K.st = RUEDA; K.rollT = 0; K.rollCd = ROLL_CD;
    K.vx = ROLL_V0 * K.dir;
    K.animT = 0;
  }

  // --- Saltar ---
  if (K.buffer > 0 && (K.enSuelo || K.coyote > 0) && K.st !== RUEDA && K.st !== DOLOR) {
    K.vy = -JUMP_V; K.enSuelo = false; K.coyote = 0; K.buffer = 0;
    K.cortable = CORTE_T;
    K.st = SALTA; K.animT = 0;
  }
  // Salto cortable: soltar pronto lo deja a la mitad de alto.
  if (K.cortable > 0) {
    K.cortable -= dt;
    if (!inp.saltaAbajo && K.vy < 0) { K.vy *= CORTE_F; K.cortable = 0; }
  }

  // --- Tajo: arrancar o ENCADENAR ---
  // Con el escudo arriba el boton de atacar es el EMPUJON, que ya se ha
  // resuelto arriba: por eso se excluye EMPUJE aqui. Sin esto, el mismo
  // `golpea` lanzaba el empujon y el tajo en el mismo frame.
  if (inp.golpea && puedeActuar && K.st !== EMPUJE) {
    const enCombo = K.st === TAJO;
    // Se puede encadenar solo DESPUES de que el filo haya pasado: encadenar
    // antes convertiria el combo en un machaque sin ritmo.
    const [ciclo, , a1] = TAJOS[K.combo];
    const puedeEnlazar = enCombo && K.tajoT >= a1 && K.tajoT <= ciclo + ENLACE_EXTRA
                         && K.combo < TAJOS.length - 1;
    if (!enCombo || puedeEnlazar) {
      // Si viene de encadenar, sube el contador; si no, empieza por el primero.
      K.combo = puedeEnlazar ? K.combo + 1 : 0;
      K.st = TAJO; K.tajoT = 0; K.tajoId++; K.golpeo = 0; K.animT = 0;
      K.comboOlvido = COMBO_OLVIDO;
      // Cada golpe empuja hacia delante: es lo que hace que el combo AVANCE
      // en vez de picotear en el sitio. Es un IMPULSO que se frena enseguida,
      // no velocidad sostenida: medido, con velocidad sostenida el tercer
      // golpe salia a 294 px/s -- mas rapido que correr (240) -- y eso haria
      // del machaque la mejor forma de cruzar la arena.
      K.vx = K.vx * TAJO_FREN * 0.5 + K.dir * TAJOS[K.combo][3] * 3.2;
      K.tajoImp = 1;
    }
  }
  // El combo se olvida si pasa el rato sin seguir
  if (K.comboOlvido > 0) {
    K.comboOlvido -= dt;
    if (K.comboOlvido <= 0 && K.st !== TAJO) K.combo = 0;
  }

  // --- Movimiento en X ---
  if (K.st === RUEDA) {
    K.rollT += dt;
    // Perfil: arranca fuerte y se apaga al final, para que la rodada termine
    // donde se ve que termina en vez de frenar en seco.
    const u = K.rollT / ROLL_T;
    const f = u < 0.15 ? u / 0.15 : u > 0.72 ? (1 - u) / 0.28 : 1;
    K.vx = ROLL_V0 * f * K.dir;
    if (K.rollT >= ROLL_T) { K.st = QUIETO; K.vx = 0; K.animT = 0; }
  } else if (K.st === DOLOR) {
    K.vx *= 0.86;
    if (K.t - K.hurtIni > 0.28) { K.st = QUIETO; K.animT = 0; }
  } else if (K.st === TAJO) {
    // Durante el tajo manda el impulso del golpe y SU rozamiento, no el freno
    // del suelo. Con el freno del suelo (FREN = 2800, o sea 46 px/s por
    // frame) encima, el impulso se evaporaba y el combo avanzaba 6 px en vez
    // de los 101 que decia el barrido: el simulador no modelaba este freno.
    // El pulgar aun corrige un poco la direccion, pero no acelera.
    if (Math.abs(inp.dx) > 0.08) K.vx += Math.sign(inp.dx) * 300 * dt;
  } else {
    // Con el escudo en alto se avanza a la mitad: protegerse cuesta movilidad.
    const ctrl = (K.enSuelo ? 1 : AIRE_CTRL) * (K.st === BLOQUEA ? 0.4 : 1);
    const quiere = inp.dx * VEL * (K.st === BLOQUEA ? 0.4 : 1);
    if (Math.abs(inp.dx) > 0.08) {
      K.dir = inp.dx < 0 ? -1 : 1;
      const a = (Math.abs(quiere) > Math.abs(K.vx) || Math.sign(quiere) !== Math.sign(K.vx)) ? ACEL : FREN;
      K.vx += Math.sign(quiere - K.vx) * a * ctrl * dt;
      if (Math.abs(K.vx - quiere) < 12) K.vx = quiere;
    } else if (K.enSuelo) {
      const f = FREN * dt;
      K.vx = Math.abs(K.vx) <= f ? 0 : K.vx - Math.sign(K.vx) * f;
    }
  }

  // --- Gravedad y suelo ---
  if (!K.enSuelo) {
    K.vy += (K.vy < 0 ? GRAV_UP : GRAV_DN) * dt;
    K.y += K.vy * dt;
    if (K.y >= SUELO) {
      // ATERRIZAJE. Se guarda cuanto venia cayendo para que el dibujo pueda
      // amortiguar: caer de un salto entero y bajar un escalon no se ven
      // igual. Dura poco (0.12 s) y NO quita el control -- solo se dibuja.
      if (!K.enSuelo && K.vy > 300) K.aterriza = 0.12;
      K.y = SUELO; K.vy = 0; K.enSuelo = true;
      if (K.st === SALTA) { K.st = QUIETO; K.animT = 0; }
    }
  } else {
    K.coyote = COYOTE;
  }
  if (K.coyote > 0 && !K.enSuelo) K.coyote -= dt;

  K.x += K.vx * dt;
  if (K.x < AX0) { K.x = AX0; K.vx = 0; }
  else if (K.x > AX1) { K.x = AX1; K.vx = 0; }

  // --- Ciclo del tajo ---
  if (K.st === TAJO) {
    K.tajoT += dt;
    // El impulso del golpe se frena poco a poco: empuja al salir y se apaga.
    // Barrido en Node (mult x roza): con 3.2 y 0.96 el combo avanza 101 px --
    // media zancada por golpe -- con punta de 193 px/s, por debajo de los 240
    // de correr. Con 0.88 avanzaba 2 px (nada) y con mult 6 corria mas que ella.
    K.vx *= 0.96;
    if (K.tajoT >= TAJOS[K.combo][0]) {
      K.st = K.enSuelo ? QUIETO : SALTA; K.animT = 0;
      // No se resetea el combo aqui: comboOlvido da la ventana para seguir.
    }
  }

  // --- Estado de animacion ---
  if (K.st === QUIETO || K.st === CORRE) {
    K.st = (!K.enSuelo) ? SALTA : (Math.abs(K.vx) > 16 ? CORRE : QUIETO);
  }
}

// La espada esta cortando en este frame.
export function espadaActiva(K) {
  if (K.st !== TAJO) return false;
  const [, a0, a1] = TAJOS[K.combo];
  return K.tajoT >= a0 && K.tajoT < a1;
}
// El escudo esta golpeando en este frame (el empujon).
export function escudoActivo(K) {
  return K.st === EMPUJE && K.escT >= ESC_EMPUJE_A0 && K.escT < ESC_EMPUJE_A1;
}
// Donde golpea el escudo.
export function puntaEscudo(K) {
  return [K.x + K.dir * 56, K.y - 60];
}
// Acaba de parar un golpe con la parada perfecta.
export function hayParada(K) { return K.parada > 0; }

// Cuanto daño hace el golpe que esta saliendo ahora.
export function danoTajo(K) {
  return K.st === TAJO ? TAJOS[K.combo][4] : 0;
}
// Que numero de golpe del combo es (0,1,2). Para el sonido y las chispas.
export function golpeCombo(K) { return K.combo; }

// Punto de la punta de la espada (para colisiones y chispas).
export function puntaEspada(K) {
  // El alcance depende del golpe: el tercero (el giro) llega mas lejos, y eso
  // tiene que notarse en la colision, no solo en el dibujo.
  const alc = K.st === TAJO ? TAJOS[K.combo][5] : ALCANCE;
  return [K.x + K.dir * alc, K.y - 16];
}

// Es invulnerable ahora mismo (por rodar o por i-frames).
export function invulnerable(K) {
  if (K.iframe > 0) return true;
  return K.st === RUEDA && K.rollT >= ROLL_INV0 && K.rollT <= ROLL_INV1;
}

// Devuelve 'bloqueado' si el escudo para el golpe, true si hiere, false si no
// le entra por invulnerabilidad.
export function herir(K, sx) {
  if (!K.vivo) return false;
  // El escudo para lo que viene DE FRENTE, y solo cuando ya esta arriba.
  // Durante el EMPUJON tambien protege: el escudo va por delante.
  if ((K.st === BLOQUEA && K.bloqT >= BLOQ_SUBE) || K.st === EMPUJE) {
    const deFrente = (sx - K.x) * K.dir > 0;
    if (deFrente) {
      // PARADA: si el golpe llega en la ventana justo despues de levantar el
      // escudo, no es un bloqueo cualquiera -- rebota al que pega y le deja
      // abierto. Es lo que premia LEER el ataque en vez de taparse siempre.
      const recienArriba = K.st === BLOQUEA && K.bloqT < BLOQ_SUBE + PARADA_VENT;
      if (recienArriba) {
        K.parada = PARADA_PREMIO; K.bloqHit = 0.22; K.vx = -K.dir * 40;
        return 'parada';
      }
      K.bloqHit = 0.22; K.vx = -K.dir * 90;
      return 'bloqueado';
    }
  }
  if (invulnerable(K)) return false;
  K.hp--; K.iframe = IFRAME;
  K.st = DOLOR; K.hurtIni = K.t; K.hurtT = 0.28; K.animT = 0;
  K.vx = (K.x < sx ? -1 : 1) * 140;
  if (K.hp <= 0) { K.vivo = false; K.st = MUERTO; }
  return true;
}

// Que pose y que fotograma toca dibujar. Devuelve [pose, frame].
export function pose(K) {
  // DOLOR: tres fotogramas en los 0.28 s que dura. MUERTO se queda en el
  // arqueado, que es donde mas se lee que le ha entrado.
  if (K.st === MUERTO) return ['hurt', 1];
  if (K.st === DOLOR) {
    const u = (K.t - K.hurtIni) / 0.28;
    return ['hurt', u < 0.28 ? 0 : u < 0.62 ? 1 : 2];
  }
  // BLOQUEAR: 0 levantando, 1 plantada, 2 el impacto. El 0 dura lo que tarda
  // el escudo en subir (BLOQ_SUBE), que es justo cuando todavia no para.
  if (K.st === BLOQUEA) {
    // bloqHit dura 0.22 s: los primeros 0.10 es el IMPACTO (2) y el resto
    // es rehacerse (3), para que parar un golpe tenga su recuperacion visible.
    if (K.bloqHit > 0) return ['block', K.bloqHit > 0.12 ? 2 : 3];
    return ['block', K.bloqT < BLOQ_SUBE ? 0 : 1];
  }
  if (K.st === RUEDA) return ['roll', Math.min(3, Math.floor(K.rollT / ROLL_T * 4))];
  // EMPUJON DE ESCUDO: tres fotogramas (carga, impacto, vuelta).
  if (K.st === EMPUJE) {
    if (K.escT < ESC_EMPUJE_A0) return ['bash', 0];
    if (K.escT < ESC_EMPUJE_A1) return ['bash', 1];
    return ['bash', 2];
  }
  if (K.st === TAJO) {
    // Cada golpe del combo tiene SU animacion: atk1, atk2, atk3. El fotograma
    // del filo cae EXACTAMENTE en la ventana en que ese golpe hace daño, para
    // que el dibujo y el golpe de verdad sean el mismo instante.
    const [ciclo, a0, a1] = TAJOS[K.combo];
    const nombre = ['atk', 'atk2', 'atk3'][K.combo];
    const t = K.tajoT;
    if (K.combo === 2) {
      // El GIRO tiene seis: es mas largo y da una vuelta entera.
      if (t < a0 * 0.5) return [nombre, 0];
      if (t < a0) return [nombre, 1];
      if (t < (a0 + a1) / 2) return [nombre, 2];
      if (t < a1) return [nombre, 3];
      if (t < ciclo - 0.08) return [nombre, 4];
      return [nombre, 5];
    }
    if (t < a0) return [nombre, 0];
    if (t < a1) return [nombre, 1];
    if (t < a1 + 0.05) return [nombre, 2];
    if (t < ciclo - 0.03) return [nombre, 3];
    return [nombre, 4];
  }
  // SALTAR: seis fotogramas mapeados por la VELOCIDAD vertical, no por un
  // reloj, para que el dibujo sea siempre lo que el cuerpo hace de verdad.
  // JUMP_V es 860: subiendo fuerte -> despegue, subiendo flojo -> cumbre,
  // cayendo -> las dos de caida.
  if (!K.enSuelo) {
    const v = K.vy;
    // El 0 es el IMPULSO agachado: los dos primeros frames tras despegar, que
    // es lo unico que dura la flexion. (El salto es instantaneo -- no hay
    // ventana de anticipacion en el suelo -- asi que si este fotograma no se
    // ata aqui no se alcanza NUNCA y es un dibujo tirado. Lo cazo el arnes.)
    if (K.st === SALTA && K.animT < 0.04) return ['jump', 0];
    if (v < -620) return ['jump', 1];    // acaba de despegar
    if (v < -200) return ['jump', 2];    // subiendo
    if (v <  160) return ['jump', 3];    // la cumbre: casi parada
    if (v <  520) return ['jump', 4];    // cayendo
    return ['jump', 5];                  // buscando el suelo
  }
  // ATERRIZAJE: se dibuja amortiguando aunque ya tenga el control. Va despues
  // del aire y antes de correr, porque se puede aterrizar andando.
  if (K.aterriza > 0) return ['jump', 6];
  if (K.st === CORRE) {
    // El ciclo avanza con la DISTANCIA recorrida, no con el reloj: asi los
    // pies no patinan cuando acelera o frena. Seis fotogramas, y el paso se
    // reescala para que un ciclo siga midiendo lo mismo en el suelo.
    // OCHO fotogramas. El factor se reescala con ellos para que un ciclo de
    // zancada siga midiendo lo mismo en el suelo (0.034 era para 4).
    const paso = Math.abs(K.x * 0.034 * 2) % 8;
    return ['run', Math.floor(paso)];
  }
  // SEIS fotogramas de respirar. Se alarga el paso a 0.30 s para que el ciclo
  // entero siga durando lo mismo (1.7 s): respirar es lento a proposito.
  return ['idle', Math.floor(K.animT / 0.30) % 6];
}
