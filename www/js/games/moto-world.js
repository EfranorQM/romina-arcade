// FURIA - terreno y fisica de la moto.
//
// Nada de sprites ni pixel art: el terreno es una POLILINEA continua y la moto
// es un cuerpo con dos ruedas y suspension. Todo se dibuja con curvas y
// degradados, asi que el detalle no depende de la resolucion del sprite.
//
// La decision que sostiene el resto: el suelo se guarda como un array de
// alturas muestreado cada STEP px. Consultar la altura bajo cualquier x es
// entonces una interpolacion lineal entre dos muestras (O(1)), y eso permite
// que las dos ruedas, la carroceria y cada particula pregunten por el suelo
// decenas de veces por frame sin costo.

export const STEP = 14;          // px entre muestras de altura
export const GRAV = 3400;        // px/s^2 (medido: con 2000 la moto flotaba el 70% del tiempo)

// ---------- Terreno ----------
// Cada nivel es un array de alturas + los obstaculos colocados encima.
// La longitud sale de `len` en px; se guarda una muestra cada STEP px.

export function makeTerrain(rnd, levelIndex, lengthPx) {
  const n = Math.ceil(lengthPx / STEP) + 4;
  const h = new Float32Array(n);
  const baseY = 0;                       // altura de referencia; el dibujo la desplaza

  // El relieve se compone de tres senos de frecuencias distintas mas un paseo
  // aleatorio suave. Un solo seno da un terreno que se lee como repetitivo;
  // tres desfasados con periodos primos entre si no vuelve a repetirse en toda
  // la pista. La amplitud crece con el nivel: los primeros son casi llanos.
  // Medido: con 26+7n los saltos llegaban a 350px (media pantalla) y la moto
  // volcaba 242 veces por corrida. Con 14+4n el salto maximo queda en ~155px.
  const amp = 14 + Math.min(levelIndex, 8) * 4;
  const p1 = 380 + rnd() * 120, p2 = 143 + rnd() * 60, p3 = 71 + rnd() * 30;
  const f1 = rnd() * 6.28, f2 = rnd() * 6.28, f3 = rnd() * 6.28;
  let drift = 0, dv = 0;
  for (let i = 0; i < n; i++) {
    const x = i * STEP;
    // Rampa de entrada: los primeros 3 metros son planos para poder arrancar.
    const ease = Math.min(1, Math.max(0, (x - 180) / 400));
    dv += (rnd() - 0.5) * 1.4;
    dv *= 0.90;                          // sin este freno el paseo se dispara
    drift += dv;
    drift *= 0.995;                      // y sin este, se aleja de la referencia
    const wave = Math.sin(x / p1 * 6.28 + f1) * amp
               + Math.sin(x / p2 * 6.28 + f2) * amp * 0.42
               + Math.sin(x / p3 * 6.28 + f3) * amp * 0.16;
    h[i] = baseY + (wave + drift) * ease;
  }
  // LIMITE DE PENDIENTE. Sin esto los tres senos y el paseo aleatorio se suman
  // y producen tramos de hasta 60 grados: paredes que ninguna moto puede rodar.
  // Medido: en el nivel 8 la moto volcaba a los 2 segundos contra una de esas.
  // Se recorre el perfil dos veces (ida y vuelta) recortando la diferencia
  // entre muestras vecinas al maximo admisible; dos pasadas bastan para que un
  // pico agudo quede suavizado por los dos lados.
  const maxSlope = Math.tan(0.62) * STEP;     // ~35 grados
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < n; i++) {
      const d = h[i] - h[i - 1];
      if (d > maxSlope) h[i] = h[i - 1] + maxSlope;
      else if (d < -maxSlope) h[i] = h[i - 1] - maxSlope;
    }
    for (let i = n - 2; i >= 0; i--) {
      const d = h[i] - h[i + 1];
      if (d > maxSlope) h[i] = h[i + 1] + maxSlope;
      else if (d < -maxSlope) h[i] = h[i + 1] - maxSlope;
    }
  }

  // El tramo final se aplana hacia la meta: aterrizar en una bajada justo en
  // la linea de llegada se siente injusto.
  const flatFrom = n - Math.ceil(300 / STEP);
  for (let i = Math.max(0, flatFrom); i < n; i++) {
    const t = (i - flatFrom) / (n - flatFrom);
    h[i] = h[i] * (1 - t) + h[Math.max(0, flatFrom)] * t;
  }
  return { h, n, len: lengthPx, amp };
}

// Altura del suelo en x. Interpolacion lineal entre las dos muestras vecinas.
export function groundY(T, x) {
  if (x <= 0) return T.h[0];
  const fi = x / STEP;
  const i = fi | 0;
  if (i >= T.n - 1) return T.h[T.n - 1];
  const t = fi - i;
  return T.h[i] * (1 - t) + T.h[i + 1] * t;
}

// Pendiente del suelo en x, en radianes. Se mide sobre una base ANCHA (un STEP
// a cada lado) y no entre muestras contiguas: con la base corta la moto
// temblaba en cada bache, porque copiaba el ruido de alta frecuencia.
export function groundAngle(T, x) {
  const y0 = groundY(T, x - STEP), y1 = groundY(T, x + STEP);
  return Math.atan2(y1 - y0, STEP * 2);
}

// ---------- Obstaculos ----------
// Tipos: 0 roca (esquivar saltando), 1 rampa (impulsa), 2 tronco (frena si se
// toca lento, se rompe si se llega rapido), 3 pozo (hueco en el suelo).
export const OB_ROCK = 0, OB_RAMP = 1, OB_LOG = 2, OB_PIT = 3;

export function placeObstacles(T, rnd, levelIndex) {
  const list = [];
  // Densidad creciente, pero con un piso de separacion que NO baja nunca: sin
  // el, en niveles altos salian dos obstaculos encima del otro y no habia
  // ninguna linea posible, lo que se lee como injusto y no como dificil.
  const gapMin = Math.max(150, 340 - levelIndex * 18);
  const gapVar = Math.max(90, 260 - levelIndex * 14);
  let x = 520;                            // el primer tramo queda libre
  while (x < T.len - 420) {
    const r = rnd();
    let kind;
    if (r < 0.34) kind = OB_ROCK;
    else if (r < 0.60) kind = OB_RAMP;
    else if (r < 0.84) kind = OB_LOG;
    else kind = OB_PIT;
    // Las rampas solo tienen sentido en subida o llano; en una bajada fuerte
    // lanzan a la moto de morro contra el suelo.
    if (kind === OB_RAMP && groundAngle(T, x) > 0.25) kind = OB_ROCK;
    // El pozo nunca puede ser mas ancho que lo que cruza un salto (medido:
    // ~150px a velocidad de crucero), o no habria forma de pasarlo.
    const w = kind === OB_PIT ? 46 + rnd() * 44
            : kind === OB_RAMP ? 70 + rnd() * 30
            : 26 + rnd() * 22;
    list.push({ x, kind, w, h: kind === OB_LOG ? 22 + rnd() * 10 : 20 + rnd() * 16, hit: 0 });
    x += w + gapMin + rnd() * gapVar;
  }
  return list;
}

// ---------- La moto ----------
// Dos ruedas unidas por un chasis rigido. Cada rueda tiene su propia
// suspension (un resorte amortiguado contra el suelo). El angulo del chasis
// sale de la diferencia de alturas entre ruedas, asi que la moto se inclina
// sola al subir una loma: no hay que animar nada.

export const WHEELBASE = 46;     // distancia entre ejes
export const WHEEL_R = 13;
const SUSP_REST = 16;            // largo en reposo de la suspension
const SUSP_K = 620, SUSP_D = 26; // rigidez y amortiguacion

export function makeBike(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    ang: 0, av: 0,               // angulo del chasis y velocidad angular
    // Compresion de cada suspension (0 = extendida). Es lo que da la animacion.
    susF: 0, susR: 0, susVF: 0, susVR: 0, penF0: 0, penR0: 0,
    onGround: false, air: 0,     // `air` acumula el tiempo sin tocar suelo
    wheelSpin: 0,                // rotacion visual de las ruedas
    throttle: 0, brake: 0, lean: 0,
    crashed: false, flips: 0, flipAcc: 0, jumpCool: 0, wipeT: 0,
    dist: 0,
  };
}

// Salto explicito. Sin esto esquivar una roca dependia solo de que hubiera un
// bache justo antes: medido, la moto alcanza 71-92px de altura inclinandose y
// la roca mediana exige 58px de despeje, un margen demasiado fino para pedirle
// a la jugadora. El salto da una via clara y siempre disponible.
//
// JUMP_V=620 daba 0.17s de vuelo y 92px de alcance, menos que el pozo mediano
// (94px) y bastante menos que el ancho (130px): los pozos eran intragables.
// Con GRAV=3400 hace falta bastante impulso para un vuelo util.
export const JUMP_V = 980;
export function bikeJump(B) {
  if (!B.onGround || B.jumpCool > 0) return false;
  B.vy -= JUMP_V;
  // La trompa se levanta desde donde este, no sumando a un giro previo: sumar
  // a ciegas es lo que mandaba la moto a dar volteretas al despegar.
  B.av = Math.min(B.av, 0) - 1.1;
  B.jumpCool = 0.28;
  B.onGround = false;
  return true;
}

// Un paso de fisica. `lean` viene del control: -1 inclina hacia atras
// (wheelie), +1 hacia adelante.
export function stepBike(B, T, dt, throttle, lean) {
  B.throttle = throttle; B.lean = lean;
  if (B.jumpCool > 0) B.jumpCool -= dt;

  // --- Suelo bajo cada rueda ---
  const c = Math.cos(B.ang), s = Math.sin(B.ang);
  const hw = WHEELBASE * 0.5;
  const fx = B.x + c * hw, fy = B.y + s * hw;     // eje delantero
  const rx = B.x - c * hw, ry = B.y - s * hw;     // eje trasero
  const gf = groundY(T, fx), gr = groundY(T, rx);

  // Penetracion de cada rueda en el suelo (positiva = hundida)
  const penF = (fy + WHEEL_R) - gf;
  const penR = (ry + WHEEL_R) - gr;

  let fyF = 0, fyR = 0, touching = 0;

  // --- Suspension por rueda ---
  // Resorte amortiguado que solo EMPUJA (nunca tira): uno que tirara hacia
  // abajo pegaria la moto al suelo en los saltos.
  //
  // Dos cosas que hay que hacer bien o el sistema EXPLOTA (medido: saltos de
  // 1.2 millones de px, la moto orbitando):
  //  1. El amortiguador se opone a la velocidad VERTICAL REAL del cuerpo
  //     (B.vy), no a una derivada numerica de la penetracion. Derivar la
  //     penetracion dividiendo por dt amplifica el ruido y en cuanto el
  //     resorte empuja fuerte, la "velocidad" estimada se dispara y el
  //     amortiguador pasa a INYECTAR energia en vez de disiparla.
  //  2. La fuerza total se satura. Un resorte lineal sin tope, integrado con
  //     Euler a 60 fps, se vuelve inestable en cuanto la compresion es grande
  //     (un aterrizaje fuerte): empuja tanto en un frame que manda el cuerpo
  //     mas arriba de donde cayo, y cada rebote crece.
  const TOUCH = 2;                 // px de compresion que ya cuentan como apoyo
  const FMAX = GRAV * 2.6;         // techo de aceleracion que puede dar el resorte
  if (penF > -SUSP_REST) {
    const compress = Math.max(0, penF + SUSP_REST);
    B.susF = compress;
    let f = compress * SUSP_K - B.vy * SUSP_D;
    if (f < 0) f = 0;                            // solo empuja
    if (f > FMAX) f = FMAX;                      // saturacion: sin esto explota
    fyF = -f;
    if (compress > TOUCH) touching++;
  } else { B.susF *= 0.85; }
  if (penR > -SUSP_REST) {
    const compress = Math.max(0, penR + SUSP_REST);
    B.susR = compress;
    let f = compress * SUSP_K - B.vy * SUSP_D;
    if (f < 0) f = 0;
    if (f > FMAX) f = FMAX;
    fyR = -f;
    if (compress > TOUCH) touching++;
  } else { B.susR *= 0.85; }

  B.onGround = touching > 0;
  if (B.onGround) B.air = 0; else B.air += dt;

  // --- Traslacion ---
  B.vy += GRAV * dt;
  B.vy += (fyF + fyR) * 0.5 * dt;   // cada rueda soporta media moto
  // El motor empuja a lo largo del suelo, no en horizontal: en una cuesta
  // empujar horizontal hunde la rueda en la pendiente y frena de golpe.
  if (B.onGround) {
    const ga = groundAngle(T, B.x);
    const push = throttle * 1500 - B.brake * 1800;
    B.vx += Math.cos(ga) * push * dt;
    B.vy += Math.sin(ga) * push * dt;
    // Friccion de rodadura + resistencia del aire
    B.vx *= 1 - 1.2 * dt;
  } else {
    B.vx *= 1 - 0.15 * dt;
  }
  if (B.vx < 0) B.vx = 0;                 // no se va marcha atras
  const MAXV = 520;
  if (B.vx > MAXV) B.vx = MAXV;

  B.x += B.vx * dt;
  B.y += B.vy * dt;
  B.dist = B.x;



  // --- Rotacion ---
  if (B.onGround) {
    // En el suelo el chasis persigue la pendiente entre las dos ruedas. Es lo
    // que hace que la moto "calce" en las lomas sin animacion escrita a mano.
    const target = Math.atan2(gf - gr, WHEELBASE);
    let diff = target - B.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    B.av += diff * 34 * dt;
    B.av *= 1 - 7 * dt;
    // El acelerador levanta la trompa (wheelie) y el freno la baja.
    B.av -= throttle * 1.5 * dt;
    B.av += lean * 3.2 * dt;
    // TOPE de velocidad angular en el suelo. Sin el, `av` se acumulaba frame a
    // frame mientras la moto rodaba (el acelerador siempre resta) y llegaba a
    // -1.3 rad/s antes de despegar; el impulso del salto sumaba otros -2.2 y la
    // moto salia girando a -3.5 rad/s, o sea dando volteretas sin control.
    // Medido: era la causa de casi todos los vuelcos al aterrizar.
    const AVMAX = 2.6;
    if (B.av > AVMAX) B.av = AVMAX;
    else if (B.av < -AVMAX) B.av = -AVMAX;
  } else {
    // En el aire el control es total: es lo que permite acomodar el aterrizaje
    // y hacer giros completos.
    B.av += lean * 5.5 * dt;
    B.av *= 1 - 0.6 * dt;
    // AUTOESTABILIZACION. Sin tocar nada la moto salia del salto girando y
    // llegaba a -25 grados sola; con 0.3s de control, a -62. La jugadora
    // acababa corrigiendo todo el tiempo algo que deberia ser el reposo.
    // Cuando NO se toca ningun control, el chasis busca la horizontal por su
    // cuenta. Al tocar, el control manda y se puede girar libremente: la
    // ayuda desaparece justo cuando estorbaria.
    if (lean === 0) {
      let d = B.ang;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      B.av -= d * 5.0 * dt;        // resorte hacia la horizontal
      B.av *= 1 - 2.6 * dt;        // y amortiguacion extra para que no oscile
    }
    const AVMAXAIR = 6.0;         // permite giros completos, no descontrol
    if (B.av > AVMAXAIR) B.av = AVMAXAIR;
    else if (B.av < -AVMAXAIR) B.av = -AVMAXAIR;
  }
  B.ang += B.av * dt;

  // Contador de giros completos, para puntuar.
  B.flipAcc += B.av * dt;
  if (!B.onGround && Math.abs(B.flipAcc) > Math.PI * 2) {
    B.flips++;
    B.flipAcc -= Math.sign(B.flipAcc) * Math.PI * 2;
  }
  if (B.onGround) B.flipAcc = 0;

  // Rotacion visual de la rueda, proporcional al avance
  B.wheelSpin += (B.vx / WHEEL_R) * dt;

  // --- Resolucion de penetracion ---
  // Si tras integrar una rueda quedo bajo tierra, se sube el cuerpo. Sin esto
  // la moto se hunde en las cuestas fuertes.
  const c2 = Math.cos(B.ang), s2 = Math.sin(B.ang);
  const nfy = B.y + s2 * hw, nry = B.y - s2 * hw;
  const npF = (nfy + WHEEL_R) - groundY(T, B.x + c2 * hw);
  const npR = (nry + WHEEL_R) - groundY(T, B.x - c2 * hw);
  const deepest = Math.max(npF, npR);
  if (deepest > 0) {
    B.y -= deepest;
    if (B.vy > 0) B.vy = -B.vy * 0.12;    // rebote minimo, no un trampolin
  }
  return B;
}

// Angulo de vuelco: si el chasis pasa de esto respecto de la vertical del
// suelo mientras toca, la piloto se cae. Se mide CONTRA LA PENDIENTE, no
// contra la horizontal: en una bajada de 30 grados ir inclinada 30 grados es
// perfectamente normal y no debe contar como caida.
// El vuelco NO es instantaneo: hay que estar pasado de angulo durante un rato.
// Con la comprobacion instantanea a 1.15 rad la moto moria en casi todos los
// aterrizajes de salto grande (medido: a los 4.4s de empezar, con 57 grados),
// porque al tocar el suelo el chasis rebota un instante fuera de rango antes de
// que el resorte lo acomode. Ahora se acumula tiempo fuera de rango y se
// descuenta al volver: un roce no mata, quedarse tumbada si.
const WIPE_ANG = 1.35;           // ~77 grados
const WIPE_TIME = 0.35;          // segundos tumbada antes de perder
export function wipeoutUpdate(B, T, dt) {
  if (!B.onGround) { B.wipeT = Math.max(0, (B.wipeT || 0) - dt * 2); return false; }
  const ga = groundAngle(T, B.x);
  let d = B.ang - ga;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) > WIPE_ANG) B.wipeT = (B.wipeT || 0) + dt;
  else B.wipeT = Math.max(0, (B.wipeT || 0) - dt * 1.6);
  return B.wipeT >= WIPE_TIME;
}

// Se conserva por compatibilidad con el arnes de medicion.
export function isWipeout(B, T) {
  if (!B.onGround) return false;
  const ga = groundAngle(T, B.x);
  let d = B.ang - ga;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) > WIPE_ANG;
}
