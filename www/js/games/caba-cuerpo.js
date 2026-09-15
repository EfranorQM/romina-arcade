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

// --- Tajo ---
export const TAJO_T = 0.30;
export const TAJO_A0 = 0.08, TAJO_A1 = 0.15;       // ventana activa
export const ALCANCE = 78;             // del centro del cuerpo a la punta de la espada
const TAJO_FREN = 0.45;                // cuanta velocidad conserva al cortar

// --- Vida ---
export const HP0 = 4;
export const IFRAME = 1.0;

// Estados
export const QUIETO = 0, CORRE = 1, SALTA = 2, RUEDA = 3, TAJO = 4, DOLOR = 5, MUERTO = 6, BLOQUEA = 7;
// Cuanto tarda el escudo en levantarse: antes de eso NO protege. Es lo que
// impide que bloquear sea un boton de invulnerabilidad.
export const BLOQ_SUBE = 0.10;

export function makeCaballero(x) {
  return {
    x, y: SUELO, vx: 0, vy: 0, dir: 1,
    st: QUIETO, t: 0,
    enSuelo: true, coyote: 0, buffer: 0, cortable: 0, aterriza: 0,
    rollT: 0, rollCd: 0,
    bloqT: 0, bloqHit: 0,
    tajoT: 0, tajoId: 0, golpeo: 0,
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
  if (inp.bloquea && K.enSuelo && puedeActuar && K.st !== TAJO) {
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

  // --- Tajo ---
  if (inp.golpea && puedeActuar && K.st !== TAJO) {
    K.st = TAJO; K.tajoT = 0; K.tajoId++; K.golpeo = 0; K.animT = 0;
    K.vx *= TAJO_FREN;
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
    if (K.tajoT >= TAJO_T) { K.st = K.enSuelo ? QUIETO : SALTA; K.animT = 0; }
  }

  // --- Estado de animacion ---
  if (K.st === QUIETO || K.st === CORRE) {
    K.st = (!K.enSuelo) ? SALTA : (Math.abs(K.vx) > 16 ? CORRE : QUIETO);
  }
}

// La espada esta cortando en este frame.
export function espadaActiva(K) {
  return K.st === TAJO && K.tajoT >= TAJO_A0 && K.tajoT < TAJO_A1;
}

// Punto de la punta de la espada (para colisiones y chispas).
export function puntaEspada(K) {
  return [K.x + K.dir * ALCANCE, K.y - 16];
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
  if (K.st === BLOQUEA && K.bloqT >= BLOQ_SUBE) {
    const deFrente = (sx - K.x) * K.dir > 0;
    if (deFrente) { K.bloqHit = 0.22; K.vx = -K.dir * 90; return 'bloqueado'; }
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
  if (K.st === TAJO) {
    // Cinco fotogramas. El 1 es el BARRIDO, y tiene que caer EXACTAMENTE en la
    // ventana en que la espada hace daño (TAJO_A0..TAJO_A1): si el dibujo del
    // golpe y el golpe de verdad no coinciden, el tajo se siente desconectado.
    const t = K.tajoT;
    if (t < TAJO_A0) return ['atk', 0];
    if (t < TAJO_A1) return ['atk', 1];
    if (t < TAJO_A1 + 0.06) return ['atk', 2];
    if (t < TAJO_T - 0.04) return ['atk', 3];
    return ['atk', 4];
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
    const paso = Math.abs(K.x * 0.034 * 1.5) % 6;
    return ['run', Math.floor(paso)];
  }
  return ['idle', Math.floor(K.animT / 0.42) % 4];
}
