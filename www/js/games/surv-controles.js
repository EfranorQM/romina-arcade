// Los controles tactiles de SURVIVAL, dibujados.
//
// Viven aparte de survival.js por dos razones. Una, que el arte de este juego
// ya se reparte asi (surv-art.js, surv-roma.js, surv-cards.js) y el archivo del
// juego no tiene por que crecer con cada pincelada. Y dos, que asi se pueden
// MIRAR sin arrancar una partida: tools/ver-controles.html importa este modulo
// y los dibuja en todos sus estados, que es como se juzga si algo se ve bien.
//
// El idioma de los dos controles no es el de un mando: Roma no empuja un
// joystick ni aprieta un boton que diga FUEGO. Ella es un corazon que defiende
// una linea contra la DUDA, el OLVIDO y los CELOS, asi que:
//
//   - moverse  = el RASTRO de luz que deja al correr
//   - disparar = su propio CORAZON, que late y dispara amor
//
// El corazon del boton es el MISMO trazo que romaHeart() de surv-art.js, con
// las mismas bezier: el boton y la protagonista son la misma forma, y por eso
// se lee como "eso de ahi eres tu" y no como un icono cualquiera.
//
// AVISO IMPORTANTE DE DIBUJADO: esto se pinta DESPUES de bloom(). El neon del
// motor no llega hasta aqui (ver el orden en survival.js draw(): el bloom va
// antes del HUD y de los controles a proposito, porque una interfaz que
// florece se vuelve ilegible). O sea que todo el brillo de este archivo esta
// dibujado a mano, con capas de trazo concentricas de opacidad decreciente,
// que es el neon barato que ya usan las cartas.

import { VW, VH } from './surv-defs.js';

// ---------- Medidas ----------
// Estas son las del DIBUJO. Las del TACTO viven en survival.js (PAD_R, FIRE_R,
// BOMB_R) y van aparte a proposito: el area que responde al pulgar es mucho mas
// grande que lo que se ve, porque un pulgar no apunta fino.
//
// PAD_Y baja a VH-30 y no se queda a la altura del boton de fuego. A su altura
// vieja el rastro cruzaba y=226, que es LINE_Y, la linea rosa que Roma
// defiende: dos barras horizontales pegadas, una cian y otra rosa, compitiendo
// por el mismo sitio. Aqui el rastro queda por debajo de la linea.
const PAD_X = 52, PAD_Y = VH - 30;
// PISTA=36 y no mas: con el halo (9 px por lado) la pista ocupa x 7..97, o sea
// 7 px de margen contra el borde del lienzo. A 40 tocaba el 0.
const PISTA = 36;                   // media longitud de la pista del rastro
// Hasta donde llega el CENTRO del cometa cuando el pulgar esta a tope. Son los
// MISMOS 22 px que recorria el punto de la cruceta vieja, y no es casualidad:
// se probo con 17 (para que el cometa no pisara el borne) y el se quejo de que
// el movimiento se sentia tosco. Tenia razon: el indicador se movia un 23%
// menos por cada px de pulgar y ademas era mas chico. Lo que el pulgar hace
// tiene que verse ENTERO, o el control parece que no responde.
//
// Con 22 el borde del cometa (r=8) queda en 30 y el borde interior del borne
// encendido (r=7.2) en 36-7.2 = 28.8: se rozan 1.2 px justo a tope. Se lee
// como que el cometa ENCAJA en el borne, no como un choque, y dice "estas al
// maximo" con el cuerpo y no solo con la luz.
const RECORRIDO = 22;
const COMETA = 8;                   // radio del cometa

// FIRE_Y sube a VH-52 (antes VH-44). El usuario pidio que el boton de disparar
// no pudiese irse tan abajo, y ademas tenia poco sitio: a VH-44 el aro llegaba
// a y=252 de 270, o sea 18 px hasta el borde del lienzo. Subido hay 26, y el
// pulgar gana recorrido para arrastrar sin salirse de la pantalla, que es justo
// lo que hacia falta para los angulos rasantes (ver el apuntado en survival.js).
const FIRE_X = VW - 48, FIRE_Y = VH - 52;
const ARO = 23;                     // radio del aro del boton de fuego

// ---------- El rastro de la cruceta ----------
// El rastro NO se puede apuntar mientras se dibuja. Este proyecto ya tiene dos
// cicatrices de eso (el latido de Roma en survival.js:95 y el destello de la
// bomba en _drawFx): lo que se actualiza al dibujar corre al ritmo de la
// PANTALLA, asi que en un telefono de 120 Hz iria al doble y el rastro duraria
// la mitad; y ademas draw() se sigue llamando cuando update() no avanza (la
// pantalla de cartas), o sea que la estela correria sola mientras ella elige.
//
// Por eso las posiciones las apunta el JUEGO en update() (survival.js llama a
// pasoRastro) y aqui solo se leen. El buffer es de instancia, no de modulo, y
// se crea con mkRastro() al empezar la partida: de modulo arrancaria cada
// partida con las posiciones de la anterior.
export const ESTELA = 6;

export function mkRastro() {
  return { x: new Float32Array(ESTELA), i: 0 };
}

// Un paso del rastro. Lo llama update(), una vez por paso de simulacion.
export function pasoRastro(r, dx) {
  r.i = (r.i + 1) % ESTELA;
  r.x[r.i] = PAD_X + dx * RECORRIDO;
}

// hex + alpha -> rgba. Tres lineas, y el proyecto ya lo tiene duplicado en
// varios sitios; no vale la pena un import por esto.
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
}

// El latido de dos golpes, el de verdad: lub-dub y una pausa larga. `f` es la
// fase 0..1 del ciclo, con un pico grande al principio y otro menor y mas corto
// detras. El suelo de 0.18 es para que el boton nunca se apague del todo.
//
// Solo una quinta parte del ciclo pasa de 0.30: es un corazon, no un parpadeo.
// Importa porque surv-roma.js tiene documentado un fallo historico de parpadear
// a 4.77 Hz, "de las frecuencias que mas cansan la vista", y este boton esta en
// pantalla toda la partida.
function latido(f) {
  const p = (c, w) => Math.max(0, 1 - Math.abs(f - c) / w);
  const a = p(0.06, 0.10), b = p(0.30, 0.075);
  return 0.18 + (a * a + b * b * 0.5) * 0.82;
}

// El contorno del corazon de Roma, centrado en (0,0). Son las bezier exactas de
// romaHeart() en surv-art.js (que van de -21..21 y -15..17, o sea radio ~17),
// reescaladas a `r`. Misma forma que la protagonista, a proposito.
function corazon(g, r) {
  const k = r / 17;
  g.beginPath();
  g.moveTo(0, 17 * k);
  g.bezierCurveTo(-21 * k, 2 * k, -16 * k, -15 * k, -6 * k, -15 * k);
  g.bezierCurveTo(-2 * k, -15 * k, 0, -11 * k, 0, -8 * k);
  g.bezierCurveTo(0, -11 * k, 2 * k, -15 * k, 6 * k, -15 * k);
  g.bezierCurveTo(16 * k, -15 * k, 21 * k, 2 * k, 0, 17 * k);
  g.closePath();
}

// Lleva un angulo al rango -PI..PI, para medir cuanto se desvia de la vertical
// sin que el salto de +PI a -PI lo mande al otro lado.
function norm(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---------- MOVERSE: el rastro ----------
// Tiene que decir HACIA DONDE y CUANTO, y lo dice de tres maneras a la vez para
// que se lea de reojo sin apartar la vista de los enemigos: donde esta el
// cometa en la pista, cuanto se enciende y engorda el borne de ese lado, y cuan
// larga es la estela que deja detras.
function drawRastro(g, st) {
  const vivo = st.padId !== null;
  const dx = st.padDX;
  const cx = PAD_X + dx * RECORRIDO;

  // La pista NO se aparta cuando Roma se le acerca. Hubo una version que la
  // desvanecia al 15% con Roma en el tercio izquierdo, por no pintarle una
  // raya cian encima; el la probo y dijo que el movimiento "se detenia a
  // veces". Claro: se le apagaba el control bajo el pulgar cada vez que ella
  // iba a la izquierda, que es la mitad de la partida. Un control tiene que
  // verse SIEMPRE igual; que Roma pase por detras de una linea de luz es un
  // mal mucho menor, y la cruceta vieja ya lo hacia sin que nadie lo notara.
  g.save();
  g.globalAlpha = vivo ? 0.95 : 0.5;

  // La pista: cuatro capas del mismo segmento, de gruesa y tenue a fina y
  // clara. La caida va al CUADRADO (f*f) — lineal dejaba las capas casi igual
  // de opacas y se leia como una barra maciza con borde, no como luz. Respira
  // despacio, a 2.2 rad/s.
  const resp = 0.5 + Math.sin(st.t * 2.2) * 0.5;
  for (let i = 4; i >= 1; i--) {
    const f = 1 - i / 5;
    g.strokeStyle = rgba('#6bf0ff', 0.16 * f * f * (0.55 + resp * 0.45) * (vivo ? 1.7 : 1));
    g.lineWidth = 5 + i * 3.2;
    g.beginPath(); g.moveTo(PAD_X - PISTA, PAD_Y); g.lineTo(PAD_X + PISTA, PAD_Y); g.stroke();
  }
  g.strokeStyle = rgba('#6bf0ff', 0.24);
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(PAD_X - PISTA, PAD_Y); g.lineTo(PAD_X + PISTA, PAD_Y); g.stroke();

  // Los dos bornes. El del lado hacia el que se empuja se enciende y engorda:
  // confirma el sentido aunque el pulgar tape el cometa, que es lo que pasa de
  // verdad jugando.
  for (const s of [-1, 1]) {
    const carga = dx * s > 0 ? Math.abs(dx) : 0;
    g.strokeStyle = rgba('#6bf0ff', 0.28 + carga * 0.62);
    g.lineWidth = 2;
    g.beginPath(); g.arc(PAD_X + s * PISTA, PAD_Y, 4 + carga * 3.2, 0, 7); g.stroke();
  }

  // LA ESTELA. Se leen hacia atras las ultimas posiciones que apunto update(),
  // cada una mas tenue y mas pequena. Quieta no se ve (todas caen en el mismo
  // sitio, debajo del cometa): solo aparece cuando corre, que es justo cuando
  // dice algo.
  const r = st.rastro;
  for (let k = 1; k < ESTELA; k++) {
    const i = (r.i - k + ESTELA) % ESTELA;
    const a = 1 - k / ESTELA;
    g.fillStyle = rgba('#6bf0ff', a * a * 0.30);
    g.beginPath(); g.arc(r.x[i], PAD_Y, COMETA * a, 0, 7); g.fill();
  }

  // El cometa: halo, cuerpo y un corazon casi blanco.
  const lat = 1 + Math.sin(st.t * 5) * 0.06;
  for (let i = 3; i >= 1; i--) {
    g.fillStyle = rgba('#6bf0ff', 0.10 * (vivo ? 1.5 : 1));
    g.beginPath(); g.arc(cx, PAD_Y, COMETA * lat * (1 + i * 0.45), 0, 7); g.fill();
  }
  g.fillStyle = rgba('#6bf0ff', 0.9);
  g.beginPath(); g.arc(cx, PAD_Y, COMETA * lat, 0, 7); g.fill();
  g.fillStyle = 'rgba(236,254,255,0.95)';
  g.beginPath(); g.arc(cx, PAD_Y - 1, 3.4 * lat, 0, 7); g.fill();

  g.restore();
}

// ---------- DISPARAR: el corazon ----------
function drawFuego(g, st) {
  const act = st.firing;
  const lat = latido(st.latF);
  const kick = st.fireKick;

  g.save();
  g.globalAlpha = act ? 0.95 : 0.5;

  // El aro, con su halo de capas. Al disparar se enciende entero.
  const resp = 0.5 + Math.sin(st.t * 2.4) * 0.5;
  for (let i = 4; i >= 1; i--) {
    const f = 1 - i / 5;
    g.strokeStyle = rgba('#ff3ec9', 0.15 * f * f * (0.5 + resp * 0.5) * (act ? 1.9 : 1));
    g.lineWidth = 2 + i * 1.6;
    g.beginPath(); g.arc(FIRE_X, FIRE_Y, ARO, 0, 7); g.stroke();
  }
  g.strokeStyle = rgba('#ff8ad4', 0.30 + lat * 0.25);
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(FIRE_X, FIRE_Y, ARO, 0, 7); g.stroke();

  // La cabeza de ECG: un tramo corto de aro que da una vuelta por latido. Es un
  // arco, no una polilinea: cuesta un solo path y dice "esto esta vivo".
  const ang = -Math.PI / 2 + st.latF * Math.PI * 2;
  g.strokeStyle = rgba('#ff8ad4', 0.30 + lat * 0.6);
  g.lineWidth = 2.4;
  g.beginPath(); g.arc(FIRE_X, FIRE_Y, ARO, ang - 0.5, ang); g.stroke();
  g.fillStyle = 'rgba(255,255,255,' + (0.35 + lat * 0.6).toFixed(3) + ')';
  g.beginPath();
  g.arc(FIRE_X + Math.cos(ang) * ARO, FIRE_Y + Math.sin(ang) * ARO, 1.5 + lat * 1.5, 0, 7);
  g.fill();

  // EL CORAZON.
  g.save();
  g.translate(FIRE_X, FIRE_Y);
  // NO gira entero con el angulo: probado, a 90 grados deja de leerse como
  // corazon y parece una gota. Se ladea solo un tercio, lo justo para que se
  // note que tira hacia alli. Quien da el angulo exacto es la aguja.
  g.rotate(norm(st.aim + Math.PI / 2) * 0.34);
  // Late, y ademas acusa cada bala con un golpe seco (fireKick). Apuntar lo
  // ESTIRA un poco, como quien se asoma.
  const sc = 1 + (lat - 0.18) * 0.15 + kick * 0.14;
  g.scale(sc, sc * (st.aiming ? 1.16 : 1));

  // El resplandor: la misma forma agrandada y sumada con 'lighter'. Es la
  // tecnica del halo de Roma, sin gradientes ni shadowBlur.
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = (act ? 0.95 : 0.5) * (0.16 + lat * 0.24);
  corazon(g, 16);
  g.fillStyle = '#ff3ec9'; g.fill();
  g.globalCompositeOperation = 'source-over';

  g.globalAlpha = act ? 0.95 : 0.62;
  corazon(g, 11.5);
  g.fillStyle = '#ff3ec9'; g.fill();
  g.strokeStyle = rgba('#ff8ad4', 0.9); g.lineWidth = 1.3;
  corazon(g, 11.5); g.stroke();
  // El brillo humedo arriba a la izquierda, como el de Roma: le da volumen.
  g.globalAlpha = (act ? 0.95 : 0.6) * 0.5;
  g.fillStyle = '#ffffff';
  g.beginPath(); g.ellipse(-4, -4.6, 3, 2.1, -0.5, 0, 7); g.fill();
  g.restore();

  // LA AGUJA. Es lo mas importante del boton: ella apunta mirando el pulgar, no
  // a Roma. Por eso es lo unico blanco y lo ultimo que se dibuja. Dos pasadas,
  // una rosa gruesa de halo y una blanca fina encima, para que se lea sobre el
  // corazon encendido sin un borde duro.
  if (act) {
    const cx = Math.cos(st.aim), cy = Math.sin(st.aim);
    const L = ARO + 4;
    g.globalAlpha = 0.95;
    g.lineCap = 'round';
    // Tres pasadas. La primera es OSCURA y va debajo: el corazon encendido es
    // rosa claro y una aguja blanca a pelo encima se le funde justo cuando mas
    // falta hace verla. Con el trazo oscuro detras se despega siempre, cueste
    // lo que cueste el fondo.
    g.strokeStyle = 'rgba(6,3,16,0.75)'; g.lineWidth = 4.5;
    g.beginPath(); g.moveTo(cx * 9 + FIRE_X, cy * 9 + FIRE_Y); g.lineTo(cx * L + FIRE_X, cy * L + FIRE_Y); g.stroke();
    g.strokeStyle = rgba('#ff8ad4', 0.35); g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx * 9 + FIRE_X, cy * 9 + FIRE_Y); g.lineTo(cx * L + FIRE_X, cy * L + FIRE_Y); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(cx * 9 + FIRE_X, cy * 9 + FIRE_Y); g.lineTo(cx * L + FIRE_X, cy * L + FIRE_Y); g.stroke();
    // Punta de flecha en el borde del aro: marca el angulo contra la pista, y
    // es lo que se mira de reojo en un tiro rasante.
    g.save();
    g.translate(FIRE_X + cx * L, FIRE_Y + cy * L);
    g.rotate(st.aim);
    g.strokeStyle = 'rgba(6,3,16,0.75)'; g.lineWidth = 2.5; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(4, 0); g.lineTo(-3, -3); g.lineTo(-3, 3); g.closePath(); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(4, 0); g.lineTo(-3, -3); g.lineTo(-3, 3); g.fill();
    g.restore();
  }

  g.restore();
}

// ---------- La bomba ----------
// NO se redisena: es amarilla y de otra familia a proposito, y asi se sigue
// leyendo como algo aparte de los dos controles. Solo se mueve con el boton de
// fuego para no quedarse descolgada.
function drawBomba(g, st, drawStar) {
  g.save();
  g.globalAlpha = 0.5;
  const ready = st.bomb.ready;
  g.strokeStyle = ready ? '#ffe14d' : 'rgba(120,110,90,0.8)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(BOMB_X, BOMB_Y, BOMB_R, 0, 7); g.stroke();
  if (!ready) {
    g.strokeStyle = 'rgba(255,225,77,0.55)';
    g.beginPath();
    g.arc(BOMB_X, BOMB_Y, BOMB_R, -Math.PI / 2,
          -Math.PI / 2 + (1 - st.bomb.cd / st.bombCd) * Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 0.9;
  if (drawStar) drawStar(g, BOMB_X, BOMB_Y, ready ? '#ffe14d' : 'rgba(140,130,100,0.8)');
  g.restore();
}

// La bomba sube con el boton de fuego: si se quedaba a VH-32 con el aro ya
// arriba, el trio se leia descolgado. A esta altura hay 13 px de aire entre el
// halo del aro y el de la bomba, que es lo que hace falta para que no se fundan
// en una sola mancha rosa-amarilla.
export const BOMB_X = VW - 104, BOMB_Y = VH - 40, BOMB_R = 18;

// Lo que el juego llama cada frame. `st` es el estado que le pasa survival.js.
export function drawControles(g, st, drawStar) {
  g.save();
  g.lineJoin = 'round';
  drawRastro(g, st);
  drawFuego(g, st);
  drawBomba(g, st, drawStar);
  g.restore();
}

// El juego necesita saber donde cae el boton de fuego y la bomba para el tacto.
export { FIRE_X, FIRE_Y, ARO, PAD_X, PAD_Y };
