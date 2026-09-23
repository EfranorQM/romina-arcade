// EL OGRO - su fisica y su maquina de estados. SIN DOM, como caba-cuerpo.js:
// lo mueve exactamente igual el juego que el arnes de Node
// (tools/prueba-ogro.mjs). Esa es la regla del proyecto y aqui se cumple.
//
// EL PRINCIPIO DE DISEÑO: cada ataque tiene UNA respuesta correcta distinta.
// Un jefe donde todo se resuelve esquivando es un jefe plano por muchos
// ataques que tenga. Aqui:
//   GARROTE   se para con la GUARDIA (el unico que se para; a tiempo, PARADA)
//   PISOTON   se salta (manda una onda por el suelo)
//   BARRIDO   se ESQUIVA (pasa a la altura del pecho, el salto no salva)
//   EMBESTIDA hay que quitarse de en medio, y si falla choca contra la pared
// Si algun dia dos ataques comparten respuesta, el jefe pierde gracia.

import { SUELO, AX0, AX1, ESQUIVA as ESQUIVA_K, invulnerable as invulnerableK } from './caba-cuerpo.js';

// --- Medidas ---
// EL RADIO DE COLISION NO ES EL TAMAÑO VISUAL. Es la leccion que ya costo
// caro en SYMBIOTE (BODY_R no podia pasar de 12 o la criatura quedaba
// encajonada). Aqui es peor si se hace mal: con un radio de 62 la separacion
// minima entre centros seria 88 px, y los tajos de ella alcanzan 74 / 78 / 92.
// O sea que el reves y el derecho NO LLEGARIAN NUNCA y ella tendria un combo
// de tres donde los dos primeros golpes no tocan al jefe jamas.
// Con 40 el empuje deja los centros a 66 px y los tres tajos alcanzan.
export const CUERPO_R = 40;        // el radio SOLIDO, para empujar y para el daño
export const ALTO = 232;           // lo que mide de alto (visual)
export const CABEZA_Y = 178;       // altura de la mandibula: lo que se alcanza saltando

export const HP0 = 24;             // su vida
export const VEL = 120;            // anda a la mitad que ella (240)
export const VEL_FURIA = 165;

// --- Los ataques, en la MISMA forma que TAJOS[] de ella ---
// [ciclo, activa0, activa1, avance, daño, alcance]
// activa0 es TAMBIEN el final de la carga: igual que en ella, no hace falta
// un campo aparte. Que los dos personajes usen el mismo convenio es lo que
// permite leer el juego sin traducir.
export const GARROTE = 0, PISOTON = 1, BARRIDO = 2, EMBESTIDA = 3;
// EL ALCANCE SALE DEL DIBUJO. Con el ogro pintado a mano (ogro-sprite.js), en
// el fotograma del golpe la punta del garrote llega a 301 px de la raiz. Con
// el alcance viejo (150) el daño acababa en 216: ella podia quedarse a 250,
// VER el garrote cruzarle la cabeza y no recibir nada. Con 240 el daño llega
// a 306 (con su radio de 26), justo donde acaba la punta.
export const ATAQUES = [
  // GARROTE: el basico. Carga larga y legible (0.42) para que se pueda parar.
  // El parry util de ella va de 0.117 a 0.267 s desde que pulsa, asi que con
  // 0.42 de carga le sobran ~0.15 s para elegir cuando pulsar. Leible sin
  // ser gratis.
  [0.95, 0.42, 0.52, 20, 1, 240],
  // PISOTON: el lento a proposito. 0.62 de carga -- se ve venir de lejos --
  // y de el nace la ONDA que viaja por el suelo. La recuperacion de 0.73 s
  // es el hueco de castigo mas grande que da el jefe.
  [1.45, 0.62, 0.72, 0, 2, 120],
  // BARRIDO: una estocada a la altura del pecho, que no se salta ni se para:
  // hay que ESQUIVARLA. Su parte activa (0.16) cabe en los 340 ms
  // invulnerables de la esquiva (ESQ_INV0 a ESQ_INV1); la ventana para
  // pulsar la mide la seccion 6 de tools/prueba-ogro.mjs. Sale en el mismo
  // fotograma que el garrote, asi que llega igual de lejos.
  [0.88, 0.40, 0.56, 34, 1, 240],
  // EMBESTIDA: cruza la arena. Se esquiva ATRAVESANDOLO (ver empujaCuerpo),
  // y si la pared esta cerca el ogro choca con ella y queda abierto 1.25 s:
  // el hueco mas grande del jefe.
  [1.30, 0.50, 1.00, 0, 2, 70],
];

// --- La ONDA que manda el pisoton ---
// 620 px/s: a 10.3 px por frame se VE viajar (a menos de 6 px/frame parece
// teletransportarse). Muere al llegar a la pared, no rebota.
export const ONDA_V = 620, ONDA_ALTO = 34, ONDA_ALCANCE = 620, ONDA_DANO = 1;
// Los primeros 60 px no hacen daño: si no, el pisoton y su propia onda
// pegarian en el mismo evento y seria imposible de leer.
export const ONDA_CIEGA = 60;

// Estados
export const ESPERA = 0, ANDA = 1, ATACA = 2, ABIERTO = 3, DOLOR = 4, RUGE = 5, MUERTO = 6;

// Por que se quedo ABIERTO. A la fisica le da igual (la ventana es la misma),
// pero se VE distinto: jadeando tras un ataque, rebotado de la parada o aturdido
// contra la pared. Lo apunta quien lo abre: aqui el fin de un ataque y el
// choque, y la escena la parada.
export const POR_FIN = 'fin', POR_PARADA = 'parada', POR_PARED = 'pared';

// Las fases: al cruzar cada umbral RUGE (invulnerable 1.2 s) y cambia el paso.
export const FASE2 = 0.66, FASE3 = 0.33;
export const RUGE_T = 1.20;

// `o` es la DIFICULTAD (ver caba-partida.js); sin ella, el ogro de siempre:
//   hp          su vida
//   ritmoCarga  lo rapido que corre el reloj del AVISO (>1 avisa menos). Solo
//               la carga: estirar tambien la parte activa haria MAS dificil
//               esquivar en la dificultad facil, al reves de lo que se busca.
//   pausa       cuanto descansa entre ataques (>1 descansa mas)
//   permitidos  que ataques puede elegir (null = todos): la primera pelea los
//               va soltando de uno en uno, segun ella aprende a contestarlos.
export function makeOgro(x, o = {}) {
  const hpMax = o.hp || HP0;
  return {
    x, y: SUELO, vx: 0, dir: -1,
    st: ESPERA, t: 0, animT: 0,
    hp: hpMax, hpMax, fase: 1, invul: 0,
    ritmoCarga: o.ritmoCarga || 1, pausa: o.pausa || 1, permitidos: o.permitidos || null,
    atk: -1, atkT: 0, golpeo: 0,
    abiertoT: 0, abiertoPor: POR_FIN, esperaT: 0.6,
    ondas: [],
    ultimo: -1, repes: 0,      // memoria, para no repetir el mismo ataque
    vivo: true,
  };
}

// El garrote esta haciendo daño en este instante.
export function garroteActivo(O) {
  if (O.st !== ATACA || O.atk < 0) return false;
  const a = ATAQUES[O.atk];
  return O.atkT >= a[1] && O.atkT <= a[2];
}

// Donde golpea: el alcance sale de la tabla, medido desde el BORDE del cuerpo.
export function golpeOgro(O) {
  const a = ATAQUES[O.atk];
  return { x: O.x + O.dir * (CUERPO_R + a[5] * 0.5), r: a[5] * 0.5, dano: a[4] };
}

// El ogro esta ABIERTO: es la ventana en la que ella puede castigar.
export function ogroAbierto(O) { return O.st === ABIERTO; }

// Empuja a ella fuera del cuerpo solido del ogro. Sin esto, ella se mete
// dentro de la barriga y todas las medidas de distancia dejan de significar
// nada (se puede pegar desde dentro).
//
// MENOS ESQUIVANDO: mientras la esquiva la hace invulnerable, lo ATRAVIESA.
// Es la respuesta a la EMBESTIDA: en una arena de un solo eje no hay "a un
// lado", y sin atravesarlo el cuerpo la arrastraba hasta la pared (medido: de
// cerca no la salvaba nada). Saltando hacia el, cae a su espalda y el sigue
// de largo hasta estrellarse.
export function empujaCuerpo(O, K, radioK = 26) {
  if (K.st === ESQUIVA_K && invulnerableK(K)) return;
  const min = CUERPO_R + radioK;
  const d = K.x - O.x;
  const ad = Math.abs(d);
  if (ad >= min) return;
  const s = (d < 0 || (d === 0 && O.dir > 0)) ? -1 : 1;
  K.x = O.x + s * min;
  if (K.x < AX0) K.x = AX0;
  if (K.x > AX1) K.x = AX1;
}

// Una PARADA de ella: el garrote rebota y el ogro se queda abierto `t`
// segundos (C.PARADA_PREMIO), que es cuando cabe el contraataque.
export function abrePorParada(O, t) {
  O.st = ABIERTO; O.t = 0; O.abiertoT = t; O.atk = -1; O.vx = 0;
  O.abiertoPor = POR_PARADA;
}

// ¿La espada de ella toca el cuerpo del ogro?
//
// LA ESPADA ES UN SEGMENTO, no un punto. Va del puño de ella hasta la punta,
// y toca si ese TRAMO cruza el circulo del cuerpo -- no si la punta cae justo
// encima. Probarlo solo con la punta da un fallo de los que no se ven hasta
// que se juega: con ella pegada al ogro (66 px) y un alcance de 74, la punta
// sale por DETRAS del ogro a 140 px del centro y el golpe contaria como
// fallado, cuando en realidad la hoja le ha atravesado entero.
export function espadaTocaOgro(O, puntaX, puñoX) {
  const R = CUERPO_R + 8;
  if (puñoX === undefined) return Math.abs(puntaX - O.x) <= R;
  const a = Math.min(puñoX, puntaX), b = Math.max(puñoX, puntaX);
  // el tramo [a,b] cruza el intervalo [O.x-R, O.x+R]
  return b >= O.x - R && a <= O.x + R;
}

// Un paso del ogro. `rnd` se inyecta para que el arnes pueda fijar la semilla:
// un jefe que llama a Math.random() por dentro no se puede probar.
export function stepOgro(O, K, dt, rnd) {
  const R = rnd || Math.random;
  if (!O.vivo && O.st !== MUERTO) return;
  O.t += dt; O.animT += dt;
  if (O.invul > 0) O.invul -= dt;

  // Las ondas viajan siempre, aunque el ogro este haciendo otra cosa.
  for (const w of O.ondas) {
    if (!w.vivo) continue;
    w.x += w.dir * ONDA_V * dt;
    w.rec += ONDA_V * dt;
    if (w.rec > ONDA_ALCANCE || w.x < AX0 || w.x > AX1) w.vivo = false;
  }

  if (O.st === MUERTO) return;

  // RUGE: al cambiar de fase se planta y ruge, invulnerable. Es lo que hace
  // que el cambio de fase se LEA en vez de pasar en silencio.
  if (O.st === RUGE) {
    O.vx = 0;
    if (O.t >= RUGE_T) { O.st = ESPERA; O.t = 0; O.esperaT = 0.3 * O.pausa; }
    return;
  }

  if (O.st === DOLOR) {
    O.vx *= 0.82;
    O.x += O.vx * dt;
    if (O.t >= 0.24) { O.st = ESPERA; O.t = 0; O.esperaT = 0.18 * O.pausa; }
    return;
  }

  // ABIERTO: la ventana de castigo. No hace nada, y se deja pegar.
  if (O.st === ABIERTO) {
    O.vx *= 0.8; O.x += O.vx * dt;
    if (O.t >= O.abiertoT) { O.st = ESPERA; O.t = 0; O.esperaT = 0.25 * O.pausa; }
    return;
  }

  if (O.st === ATACA) { pasoAtaque(O, K, dt); return; }

  // ESPERA / ANDA: decide.
  const d = K.x - O.x;
  const ad = Math.abs(d);
  O.dir = d < 0 ? -1 : 1;

  if (O.esperaT > 0) { O.esperaT -= dt; O.vx = 0; O.st = ESPERA; return; }

  const elegido = elige(O, ad, R);
  if (elegido >= 0) {
    O.st = ATACA; O.atk = elegido; O.atkT = 0; O.golpeo = 0; O.animT = 0;
    O.repes = (elegido === O.ultimo) ? O.repes + 1 : 0;
    O.ultimo = elegido;
    return;
  }

  // Si no ataca, se acerca.
  O.st = ANDA;
  const v = (O.fase >= 3 ? VEL_FURIA : VEL);
  O.vx = O.dir * v;
  O.x += O.vx * dt;
  if (O.x < AX0 + CUERPO_R) O.x = AX0 + CUERPO_R;
  if (O.x > AX1 - CUERPO_R) O.x = AX1 - CUERPO_R;
}

// LA DECISION. Por distancia, con memoria: repetir el mismo ataque se
// penaliza, porque un jefe predecible se aprende en dos intentos y deja de
// dar miedo.
function elige(O, ad, rnd) {
  const cerca = ad < CUERPO_R + 170;
  const medio = ad >= CUERPO_R + 120 && ad < CUERPO_R + 330;
  const lejos = ad >= CUERPO_R + 300;

  const pesos = [0, 0, 0, 0];
  if (cerca) { pesos[GARROTE] = 5; pesos[BARRIDO] = 4; pesos[PISOTON] = 2; }
  if (medio) { pesos[PISOTON] = 5; pesos[BARRIDO] = 2; pesos[EMBESTIDA] = 3; }
  if (lejos) { pesos[PISOTON] = 4; pesos[EMBESTIDA] = 5; }
  // En furia pisa mas: sube la presion sin tocar los tiempos, que son los que
  // hacen justo o injusto al jefe.
  if (O.fase >= 3) pesos[PISOTON] += 2;
  // Los que todavia no le toca usar (la primera pelea, que enseña).
  if (O.permitidos) for (let i = 0; i < 4; i++) if (!O.permitidos.includes(i)) pesos[i] = 0;
  // El castigo a la repeticion.
  if (O.repes >= 1 && O.ultimo >= 0) pesos[O.ultimo] = Math.max(0, pesos[O.ultimo] - 3);

  const tot = pesos.reduce(function (a, b) { return a + b; }, 0);
  if (tot <= 0) return -1;
  let r = rnd() * tot;
  for (let i = 0; i < 4; i++) { r -= pesos[i]; if (r <= 0) return i; }
  return -1;
}

function pasoAtaque(O, K, dt) {
  const a = ATAQUES[O.atk];
  const ciclo = a[0], a0 = a[1], a1 = a[2], avance = a[3];
  // El aviso corre al ritmo de la dificultad; el golpe, siempre igual.
  O.atkT += dt * (O.atkT < a0 ? O.ritmoCarga : 1);

  // El avance del cuerpo durante la parte activa: es lo que hace que un
  // garrotazo se sienta lanzado y no plantado.
  if (O.atkT >= a0 && O.atkT <= a1 && avance > 0) {
    O.x += O.dir * avance * dt / Math.max(0.001, a1 - a0);
  }

  // La EMBESTIDA corre de verdad mientras dura la parte activa.
  if (O.atk === EMBESTIDA && O.atkT >= a0 && O.atkT <= a1) {
    O.x += O.dir * 430 * dt;
    if (O.x <= AX0 + CUERPO_R || O.x >= AX1 - CUERPO_R) {
      // CHOCA CONTRA LA PARED y queda aturdido: es la recompensa por
      // esquivarla bien, y lo que convierte la embestida en una oportunidad.
      O.x = Math.max(AX0 + CUERPO_R, Math.min(AX1 - CUERPO_R, O.x));
      O.st = ABIERTO; O.t = 0; O.abiertoT = 1.25; O.vx = 0; O.atk = -1;
      O.abiertoPor = POR_PARED;
      return;
    }
  }

  // El PISOTON suelta sus dos ondas en el instante del impacto.
  if (O.atk === PISOTON && !O.golpeo && O.atkT >= a0) {
    O.golpeo = 1;
    for (const s of [-1, 1]) O.ondas.push({ x: O.x + s * 20, dir: s, rec: 0, vivo: true });
  }

  if (O.atkT >= ciclo) {
    // Al acabar queda ABIERTO. La duracion sale del combo REAL de ella:
    // 0.26 + 0.30 = 0.56 s los dos primeros, o 0.46 el giro solo.
    const cual = O.atk;
    O.st = ABIERTO; O.t = 0;
    // El barrido estaba en 0.42 y el giro de ella dura 0.46: no cabia NI UN
    // tajo, o sea que acertar la esquiva no tenia premio. A 0.50 cabe el
    // giro (el golpe fuerte), que es el premio justo para el ataque que mas
    // precision pide.
    O.abiertoT = cual === PISOTON ? 0.73 : cual === BARRIDO ? 0.50 : 0.55;
    O.abiertoPor = POR_FIN;
    O.atk = -1; O.vx = 0;
  }
}

// Le pegan. Devuelve true si le entra.
export function hiereOgro(O, dano, dirGolpe) {
  if (!O.vivo || O.invul > 0 || O.st === MUERTO) return false;
  O.hp -= dano;
  if (O.hp <= 0) { O.hp = 0; O.vivo = false; O.st = MUERTO; O.t = 0; return true; }

  // El cambio de FASE: ruge, se hace invulnerable un momento y sigue.
  const fr = O.hp / O.hpMax;
  const faseNueva = fr <= FASE3 ? 3 : fr <= FASE2 ? 2 : 1;
  if (faseNueva > O.fase) {
    O.fase = faseNueva;
    O.st = RUGE; O.t = 0; O.invul = RUGE_T; O.atk = -1; O.vx = 0;
    return true;
  }

  // Si estaba ABIERTO, encajar le duele de verdad (retrocede). Si esta
  // atacando, AGUANTA: si no, ella podria interrumpir cualquier ataque a
  // botonazos y el jefe no existiria.
  if (O.st === ABIERTO || O.st === DOLOR) {
    O.st = DOLOR; O.t = 0; O.vx = dirGolpe * 150;
  }
  return true;
}

// Que le esta pegando el ogro a ella en este instante: el garrote (con el
// TIPO de golpe, porque la guardia solo para el garrotazo) o una onda. Null si
// nada. Vive aqui y no en la escena para que el arnes mida la MISMA regla con
// la que se juega.
//
// El golpe dice que viene DESDE EL OGRO (x: O.x), no desde el punto donde cae
// el garrote: con ella pegada a el, ese punto queda A SU ESPALDA, y la guardia
// (que solo para lo que viene de frente) no paraba el garrotazo de cerca. Lo
// destapo el arnes al medir la guardia a 90 y 150 px.
export const TIPOS = ['garrote', 'pisoton', 'barrido', 'embestida'];
export function golpeaA(O, K, radioK = 26) {
  if (garroteActivo(O)) {
    const gp = golpeOgro(O);
    if (Math.abs(K.x - gp.x) < gp.r + radioK) return { x: O.x, dano: gp.dano, tipo: TIPOS[O.atk] };
  }
  const w = ondaGolpea(O, K);
  if (w) return { x: w.x, dano: ONDA_DANO, tipo: 'onda' };
  return null;
}

// Una onda esta tocando a ella: hay que tener los pies bajos.
export function ondaGolpea(O, K) {
  for (const w of O.ondas) {
    if (!w.vivo || w.rec < ONDA_CIEGA) continue;
    if (Math.abs(K.x - w.x) > 30) continue;
    // Solo pega si tiene los pies bajos: por eso se salta.
    if (SUELO - K.y > ONDA_ALTO) continue;
    return w;
  }
  return null;
}
