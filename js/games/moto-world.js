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

// ---------- Encuadre ----------
// Cuanto mundo se ve, en px del plano de la pista. Vive aqui y no en la camara
// 3D porque decide si la pista es justa: la roca tiene que entrar en pantalla
// con tiempo para reaccionar, y el arnes (tools/prueba-furia.mjs) mide con
// ESTE numero. La version vertical ensenaba 367 px por delante de la moto y
// desde el nivel 6 la roca aparecia cuando ya no daba tiempo a saltar.
//
// El ancho se abre con la velocidad: parada, la moto se ve grande; a tope, se
// ve lo que viene. La moto va al 28 % desde la izquierda.
// Con el turbo (hasta 700 px/s) se abre un escalon mas: a esa velocidad la
// roca siguiente llegaba 200 ms antes (medido con el arnes) y ademas ir mas
// rapido se tiene que VER.
export const CAM = { spanMin: 640, spanMax: 840, spanTurbo: 980, bikeAt: 0.28 };
export function span(vx) {
  const a = Math.min(1, Math.max(0, vx / 520)), b = Math.min(1, Math.max(0, (vx - 520) / 180));
  return CAM.spanMin + (CAM.spanMax - CAM.spanMin) * a + (CAM.spanTurbo - CAM.spanMax) * b;
}
export function vista(vx) { return span(vx) * (1 - CAM.bikeAt); }

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

// El suelo que se DIBUJA bajo la madera de las rampas: el mismo terreno sin
// ellas (T.base, ver aplicaRampas). Sin rampas en el nivel, es groundY.
export function groundBase(T, x) {
  const h = T.base || T.h;
  if (x <= 0) return h[0];
  const fi = x / STEP, i = fi | 0;
  if (i >= T.n - 1) return h[T.n - 1];
  const t = fi - i;
  return h[i] * (1 - t) + h[i + 1] * t;
}

// Pendiente del suelo en x, en radianes. Se mide sobre una base ANCHA (un STEP
// a cada lado) y no entre muestras contiguas: con la base corta la moto
// temblaba en cada bache, porque copiaba el ruido de alta frecuencia.
export function groundAngle(T, x) {
  const y0 = groundY(T, x - STEP), y1 = groundY(T, x + STEP);
  return Math.atan2(y1 - y0, STEP * 2);
}

// ---------- Obstaculos ----------
// Peligros (hay que saltarlos): 0 roca, 2 tronco (se rompe si se llega rapido),
// 3 pozo, 6 cajas (una se rompe rapido; dos apiladas, no).
// Ayudas: 1 rampa, 7 rampa grande (siempre con TURBO delante y un FOSO
// detras: el SALTO GIGANTE), 4 turbo (flecha en el suelo: mas velocidad un
// rato). Y 5 barro, que frena.
export const OB_ROCK = 0, OB_RAMP = 1, OB_LOG = 2, OB_PIT = 3, OB_TURBO = 4, OB_BARRO = 5, OB_CAJA = 6, OB_RAMPA_G = 7;
export const esPeligro = ob => ob.kind === OB_ROCK || ob.kind === OB_LOG || ob.kind === OB_PIT || ob.kind === OB_CAJA;

// Aplana el terreno entre x0 y x1 hacia la recta que une sus extremos, con los
// bordes suavizados. El salto gigante lo necesita: una rampa en mitad de una
// loma lanza torcido, y aterrizar en una bajada de 35 grados es volcar.
function aplana(T, x0, x1) {
  const i0 = Math.max(1, Math.floor(x0 / STEP)), i1 = Math.min(T.n - 2, Math.ceil(x1 / STEP));
  const h0 = T.h[i0], h1 = T.h[i1], borde = 160 / STEP;
  for (let i = i0; i <= i1; i++) {
    const u = (i - i0) / (i1 - i0);
    const recta = h0 + (h1 - h0) * u;
    const e = Math.min(1, (i - i0) / borde, (i1 - i) / borde);
    const w = e * e * (3 - 2 * e);
    T.h[i] = T.h[i] * (1 - w) + recta * w;
  }
}

export function placeObstacles(T, rnd, levelIndex) {
  const list = [];
  // Densidad creciente, pero con un piso de separacion que NO baja nunca: sin
  // el, en niveles altos salian dos obstaculos encima del otro y no habia
  // ninguna linea posible, lo que se lee como injusto y no como dificil.
  //
  // EL PISO SALE DEL SALTO, de centro a centro. Era 150-340 px y, medido con
  // tools/prueba-furia.mjs, 63 de 88 muertes eran con el peligro anterior a
  // menos de 400 px: el salto a tope recorre 245 px, cae unos 130 pasada la
  // roca, y hace falta un momento para volver a tocar y otros ~120 px de
  // carrerilla. Por debajo de ~420 no hay linea. Tras una rampa el vuelo es
  // mas largo (15 de las muertes restantes caian justo detras de una).
  // La dificultad sube quitando HOLGURA (gapVar), no quitando la linea.
  const lv = Math.min(levelIndex, 8);
  const gapMin = 440 - lv * 5;
  const gapRampa = 650;
  const gapVar = Math.max(60, 360 - lv * 38);
  T.barro = [];

  // Los SALTOS GIGANTES van en sitios fijos de la pista (uno en los dos
  // primeros niveles, dos hasta el quinto, tres despues), y todo lo demas se
  // reparte entre ellos. Cada uno ocupa su tramo entero: carrerilla llana con
  // el turbo, la rampa, el foso, y 850 px de aterrizaje sin nada.
  const nGig = lv <= 2 ? 1 : lv <= 5 ? 2 : 3;
  const gig = [];
  for (let k = 0; k < nGig; k++) gig.push(Math.round((T.len - 600) * (k + 1) / (nGig + 1) + 300 + (rnd() - 0.5) * 300));

  // El primer tramo queda libre y LARGO: la moto sale de parada, y con la
  // primera roca a 620 px el que salta calculaba con la velocidad del
  // arranque, la moto seguia acelerando y llegaba antes (medido: la mitad de
  // las muertes del nivel 1 con reflejos lentos eran esa roca).
  let x = 900;
  let gi = 0;
  while (x < T.len - 420) {
    // ¿Toca el salto gigante? Si el siguiente obstaculo normal se le echaria
    // encima, se pone el salto y se sigue detras de su aterrizaje.
    if (gi < gig.length && x > gig[gi] - 900) {
      const g = Math.max(x + 500, gig[gi]);
      gi++;
      if (g > T.len - 1500) continue;
      const wr = 126, hr = 70;              // rampa grande: 3 m de largo, 1.6 de alto
      // El foso: con turbo sobra siempre; sin el, en los niveles altos no llega
      // (medido: con 130 + 8 por nivel se cruzaba sin turbo el 100 %).
      const wf = 150 + lv * 10;
      aplana(T, g - 700, g + wr * 0.5 + wf + 900);
      list.push({ x: g - 300, kind: OB_TURBO, w: 90, h: 0, hit: 0 });
      list.push({ x: g, kind: OB_RAMPA_G, w: wr, h: hr / 1.5, hr, kick: 380, hit: 0 });
      list.push({ x: g + wr * 0.5 + 14 + wf * 0.5, kind: OB_PIT, w: wf, h: 20, foso: true, hit: 0 });
      x = g + wr * 0.5 + 14 + wf + 850;
      continue;
    }
    const r = rnd();
    let kind;
    if (r < 0.26) kind = OB_ROCK;
    else if (r < 0.40) kind = OB_RAMP;
    else if (r < 0.56) kind = OB_LOG;
    else if (r < 0.72) kind = OB_PIT;
    else if (r < 0.88) kind = OB_CAJA;
    else kind = OB_BARRO;
    // Las rampas solo tienen sentido en subida o llano; en una bajada fuerte
    // lanzan a la moto de morro contra el suelo.
    if (kind === OB_RAMP && groundAngle(T, x) > 0.25) kind = OB_ROCK;
    // Y los pozos, en pendiente suave: en una bajada fuerte la moto despega
    // de la cresta y lo cruza volando sin hacer nada (medido: los 12 pozos
    // que una moto rodando no pisaba estaban en bajadas de 35 grados).
    if (kind === OB_PIT && Math.abs(groundAngle(T, x)) > 0.52) kind = OB_ROCK;
    // Las cajas y el barro, en llano o casi: una caja en una bajada de 35
    // grados se saltaba sola desde la cresta (y apoyada ahi parece que resbala).
    if ((kind === OB_CAJA || kind === OB_BARRO) && Math.abs(groundAngle(T, x)) > 0.35) kind = OB_ROCK;
    // El pozo nunca puede ser mas ancho que lo que cruza un salto. Se cruza
    // si la moto va en el aire desde que la rueda de delante pasa el primer
    // borde hasta que la de atras pasa el segundo: ancho + 64 px. El salto
    // pasa 0.45 s por encima de eso, asi que a 450 px/s un pozo de 90 dejaba
    // 0.11 s para acertar (medido con el arnes: la mitad de las muertes). El
    // ancho crece con el nivel: 40-60 px en el primero, hasta 78 en el ultimo.
    let ob;
    if (kind === OB_PIT) ob = { kind, w: 40 + rnd() * (18 + lv * 2.5), h: 20 + rnd() * 16 };
    else if (kind === OB_RAMP) {
      const w = 70 + rnd() * 30;
      ob = { kind, w, h: 20 + rnd() * 16, kick: 460 };
      ob.hr = Math.min(ob.h * 1.5, w * 0.6);   // alto del labio: 31 grados como mucho
    } else if (kind === OB_LOG) ob = { kind, w: 26 + rnd() * 22, h: 22 + rnd() * 10 };
    else if (kind === OB_CAJA) {
      // Una caja se rompe a toda velocidad, como el tronco; dos apiladas
      // (desde el nivel 3) hay que saltarlas siempre.
      const dos = lv >= 3 && rnd() < 0.4;
      ob = { kind, w: 38, h: dos ? 66 : 34, pisos: dos ? 2 : 1 };
    } else if (kind === OB_BARRO) {
      ob = { kind, w: 150 + rnd() * 90, h: 0 };
      T.barro.push([x - ob.w * 0.5, x + ob.w * 0.5]);
    } else ob = { kind, w: 26 + rnd() * 22, h: 20 + rnd() * 16 };
    ob.x = x; ob.hit = 0;
    list.push(ob);
    // Tras el barro la moto sale lenta: el siguiente peligro mas lejos, para
    // que de tiempo a recuperar velocidad antes de saltar.
    const tras = kind === OB_RAMP ? gapRampa : kind === OB_BARRO ? ob.w * 0.5 + 420 : gapMin;
    x += tras + rnd() * gapVar;
  }
  list.sort((a, b) => a.x - b.x);
  aplicaRampas(T, list);
  ponBaches(T, list, rnd, lv);
  return list;
}

// Las rampas son TERRENO: la moto sube por ellas apoyada y sale por el labio.
// Hasta el 25-09-2026 la rampa era un empujon al llegar a su pie, y la moto
// atravesaba la madera dibujada. Se alinean a la rejilla del terreno para que
// el labio de la fisica caiga donde el dibujado. `T.base` guarda el suelo sin
// rampas: es el que se dibuja debajo de la madera.
function aplicaRampas(T, list) {
  T.base = T.base || Float32Array.from(T.h);
  for (const ob of list) {
    if (ob.kind !== OB_RAMP && ob.kind !== OB_RAMPA_G) continue;
    const n = Math.max(3, Math.round(ob.w / STEP));
    const i0 = Math.round((ob.x - ob.w * 0.5) / STEP);
    ob.x0 = i0 * STEP; ob.x1 = (i0 + n) * STEP; ob.w = ob.x1 - ob.x0; ob.x = (ob.x0 + ob.x1) * 0.5;
    ob.y0 = T.h[i0];
    for (let i = 0; i <= n; i++) T.h[i0 + i] -= ob.hr * (i / n);
    ob.yLabio = T.h[i0 + n];
  }
}

// BACHES (whoops): una fila de lomitas en los tramos largos sin nada. A toda
// velocidad la moto las roza y se aligera; no matan (el arnes lo vigila).
// Van en el terreno de la fisica y en el que se dibuja.
function ponBaches(T, list, rnd, lv) {
  T.baches = [];
  for (let k = 0; k < list.length - 1; k++) {
    const a = list[k], b = list[k + 1];
    const libre0 = a.x + a.w * 0.5 + 170, libre1 = b.x - b.w * 0.5 - 170;
    if (libre1 - libre0 < 420 || rnd() > 0.35) continue;
    const nb = 4 + Math.floor(rnd() * 3), onda = 84, amp = 5 + Math.min(lv, 6) * 0.4;
    const largo = nb * onda, x0 = (libre0 + libre1 - largo) * 0.5;
    for (let i = Math.floor(x0 / STEP); i <= Math.ceil((x0 + largo) / STEP) && i < T.n; i++) {
      const u = (i * STEP - x0) / onda;
      if (u < 0 || u > nb) continue;
      const d = -amp * (1 - Math.cos(u * Math.PI * 2)) * 0.5;
      T.h[i] += d; T.base[i] += d;
    }
    T.baches.push([x0, x0 + largo]);
  }
}

// ESTRELLAS: se colocan SIMULANDO la moto con la fisica de verdad, asi que
// siempre se pueden coger. En el arco de cada rampa (a la velocidad de
// crucero), en lo alto del salto sobre cada peligro (saltando cuando salta el
// piloto del arnes), y en el salto gigante una fila mas alta que solo se
// alcanza saltando en el labio. Se cogen con el cuerpo de la piloto.
export function colocaEstrellas(T, obs) {
  const out = [];
  const sim = (desde, vx, saltaEn, obsSim, turbo) => {
    const B = makeBike(desde, groundY(T, desde) - 23);
    B.vx = vx; B.onGround = true; B.turbo = turbo || 0;
    const tray = [];
    let despego = false;
    for (let t = 0; t < 3; t += 1 / 60) {
      if (saltaEn !== null && !despego && B.x >= saltaEn) pideSalto(B);
      stepBike(B, T, 1 / 60, 1, 0);
      if (obsSim) choques(B, T, obsSim);
      if (!B.onGround && B.air > 0.05) { despego = true; tray.push([B.x, B.y]); }
      else if (despego && B.onGround) break;
    }
    return tray;
  };
  const arco = (tray, n, alto = 16) => {
    if (tray.length < 8) return;
    for (let k = 0; k < n; k++) {
      const p = tray[Math.floor(tray.length * (0.2 + 0.6 * k / Math.max(1, n - 1)))];
      out.push({ x: p[0], y: p[1] - alto, got: false });
    }
  };
  for (const ob of obs) {
    if (ob.kind === OB_RAMP) {
      arco(sim(ob.x0 - 260, 470, null, [{ ...ob, hit: 0 }]), 4);
    } else if (ob.kind === OB_RAMPA_G) {
      const turbo = obs.some(o => o.kind === OB_TURBO && o.x < ob.x && o.x > ob.x - 500);
      arco(sim(ob.x0 - 200, 520, null, [{ ...ob, hit: 0 }], turbo ? 1.2 : 0), 5);
      arco(sim(ob.x0 - 200, 520, ob.x1 - 20, [{ ...ob, hit: 0 }], turbo ? 1.2 : 0), 3, 26);
    } else if (esPeligro(ob) && !ob.foso) {
      const plan = ob.kind === OB_PIT ? ob.w * 0.5 + WHEELBASE * 0.5 + 480 * 0.12 : ob.w * 0.55 + 480 * 0.2;
      const tray = sim(ob.x - plan - 200, 480, ob.x - plan, null);
      if (tray.length >= 8) {
        // las dos del medio del vuelo: lo alto del salto
        const a = tray[Math.floor(tray.length * 0.42)], b = tray[Math.floor(tray.length * 0.6)];
        out.push({ x: a[0], y: a[1] - 16, got: false }, { x: b[0], y: b[1] - 16, got: false });
      }
    }
  }
  return out.sort((a, b) => a.x - b.x);
}

// Coge las estrellas que toca el cuerpo de la piloto (18 px por encima del
// centro de la moto, siguiendo su giro; radio 36). Devuelve cuantas cogio.
export function recogeEstrellas(B, estrellas) {
  let n = 0;
  const cx = B.x + Math.sin(B.ang) * 18, cy = B.y - Math.cos(B.ang) * 18;
  for (const e of estrellas) {
    if (e.got || e.x < cx - 40) continue;
    if (e.x > cx + 40) break;
    const dx = e.x - cx, dy = e.y - cy;
    if (dx * dx + dy * dy < 36 * 36) { e.got = true; n++; }
  }
  return n;
}

// El suelo que SE VE, con los pozos hundidos. La fisica de rodar no los tiene
// (groundY es continuo y el pozo mata por regla, ver choques), pero lo que
// cae -- la moto al estrellarse, la tierra que salta -- tiene que caer DENTRO:
// hasta el 25-09-2026 el pozo no se dibujaba en ningun sitio y mataba sin
// verse.
export const POZO_PROF = 150;          // px de hondo (3.5 m)
export function sueloVisible(T, obs, x) {
  for (let i = 0; i < obs.length; i++) {
    const ob = obs[i];
    if (ob.kind !== OB_PIT) continue;
    if (x > ob.x - ob.w * 0.5 && x < ob.x + ob.w * 0.5) return groundY(T, ob.x) + POZO_PROF;
    if (ob.x - ob.w > x) break;
  }
  return groundY(T, x);
}

// Largo de pista por nivel. Crece, pero se estabiliza: una pista de 3 minutos
// cansa mas de lo que emociona.
export function levelLen(n) { return 7200 + Math.min(n, 6) * 900; }

// El nivel entero a partir de la semilla: terreno y obstaculos, en este orden
// (los dos tiran del mismo rnd, asi que cambiar el orden cambia la pista).
export function makeLevel(rnd, n) {
  const T = makeTerrain(rnd, n, levelLen(n));
  const obs = placeObstacles(T, rnd, n);
  const estrellas = colocaEstrellas(T, obs);
  return { T, obs, estrellas };
}

// Las reglas de los obstaculos. Viven aqui, sin DOM, y no en furia.js, para
// que el arnes (tools/prueba-furia.mjs) mida LA MISMA regla con la que se
// juega: una copia a mano en el arnes acaba diciendo otra cosa.
// Devuelve lo que paso este frame, o null:
//   { k: 'pozo' | 'choca' }  la moto muere
//   { k: 'rampa' }           la rampa la lanzo (ya aplicado a B)
//   { k: 'rompe' }           rompio un tronco a toda velocidad (ya frenada)
export function choques(B, T, obs) {
  for (let i = 0; i < obs.length; i++) {
    const ob = obs[i];
    if (ob.hit) continue;
    const dx = B.x - ob.x;
    if (dx < -ob.w || dx > ob.w) continue;
    const gy = groundY(T, ob.x);

    if (ob.kind === OB_PIT) {
      // El pozo mata si una rueda que esta ENCIMA del agujero llega al borde:
      // con la suspension estirada del todo (SUSP_MAX, lo que cuelga la rueda
      // dibujada) su parte de abajo queda por debajo del suelo. Es la misma
      // regla que se ve: la rueda que cae dentro del agujero, cae.
      // Hasta el 25-09-2026 el pozo mataba si el CENTRO de la moto pasaba
      // bajo, medido contra el suelo del centro del pozo: con el terreno
      // bajando hacia el, o pasando una cresta a toda velocidad, la moto
      // cruzaba rodando por encima del agujero (125 de 244 pozos, medido).
      const c = Math.cos(B.ang), s = Math.sin(B.ang);
      for (let lado = -1; lado <= 1; lado += 2) {
        const ax = B.x + lado * c * WHEELBASE * 0.5;
        if (ax <= ob.x - ob.w * 0.5 || ax >= ob.x + ob.w * 0.5) continue;
        const ay = B.y + lado * s * WHEELBASE * 0.5;
        if (ay + (SUSP_MAX + WHEEL_R) * c > groundY(T, ax)) { ob.hit = 1; return { k: 'pozo', ob }; }
      }
      continue;
    }
    if (ob.kind === OB_RAMP || ob.kind === OB_RAMPA_G) {
      // La moto sube la rampa apoyada (es terreno, ver aplicaRampas) y al
      // pasar el labio recibe el golpe de la rampa: sale con la subida de la
      // rampa MAS un impulso. Solo la natural (0.55*vx) daba un vuelo de 0.2 s.
      //
      // TIEMPO COLGADO. Con la gravedad del juego (fuerte, para saltos secos)
      // un vuelo largo exige subir altisimo: medido, el salto gigante daba
      // 0.53 s de aire, casi lo mismo que un salto normal, y ningun truco
      // cabia. Tras una rampa la gravedad se afloja mientras dura el vuelo
      // (B.flota): al 80 % en las pequeñas, al 60 % en la grande. La grande
      // ademas lanza segun la velocidad (el turbo cuenta), y si se salta en
      // el labio, un poco mas.
      // Vale si la moto venia apoyada en la rampa O si acaba de saltar desde
      // ella: el salto pone su reloj de aire en 0.11 s (el coyote), y solo con
      // `air < 0.12` saltar en el labio perdia el golpe y volaba MENOS.
      if (B.x >= ob.x1 && B.x < ob.x1 + 40 && (B.air < 0.12 || (B.jumpCool > 0 && B.air < 0.3))) {
        ob.hit = 1;
        const grande = ob.kind === OB_RAMPA_G;
        const base = grande ? 420 + B.vx : ob.kick + B.vx * 0.55;
        const salto = grande && B.jumpCool > 0;
        B.vy = Math.min(B.vy, -base) - (salto ? 200 : 0);
        B.flota = grande ? 0.6 : 0.8;
        B.av = Math.min(B.av, 0) - 0.5;
        return { k: 'rampa', ob, salto };
      }
      if (B.x >= ob.x1 + 40) ob.hit = 1;
      continue;
    }
    if (ob.kind === OB_TURBO) {
      if (Math.abs(dx) < ob.w * 0.5 && B.onGround) { ob.hit = 1; B.turbo = TURBO_T; return { k: 'turbo', ob }; }
      continue;
    }
    if (ob.kind === OB_BARRO) {
      // El freno lo pone stepBike (T.barro); aqui solo se avisa de la entrada.
      if (Math.abs(dx) < ob.w * 0.5 && B.onGround) { ob.hit = 1; return { k: 'barro', ob }; }
      continue;
    }
    // Roca, tronco y cajas: golpean si la moto esta a su altura.
    const top = gy - ob.h * (ob.kind === OB_ROCK ? 1.6 : 1.0);
    if (Math.abs(dx) < ob.w * 0.55 && B.y + WHEEL_R > top) {
      ob.hit = 1;
      // Rompe el tronco a alta velocidad: premia ir rapido. Una caja sola
      // tambien; dos apiladas, nunca.
      if (ob.kind === OB_LOG && B.vx > 380) { B.vx *= 0.88; return { k: 'rompe', ob }; }
      if (ob.kind === OB_CAJA && ob.pisos === 1 && B.vx > 360) { B.vx *= 0.85; return { k: 'rompe', ob }; }
      return { k: 'choca', ob };
    }
  }
  return null;
}

// ---------- La moto ----------
// Dos ruedas unidas por un chasis rigido. Cada rueda tiene su propia
// suspension (un resorte amortiguado contra el suelo). El angulo del chasis
// sale de la diferencia de alturas entre ruedas, asi que la moto se inclina
// sola al subir una loma: no hay que animar nada.

// Proporciones tomadas de una moto de cross real (KTM / Honda CRF): wheelbase
// ~1480mm con rueda delantera de 21 pulgadas (533mm de diametro), o sea un
// ratio de 2.78. Con 46/26 el ratio era 1.77 y el conjunto leia como minimoto
// de circo, que es lo que se veia mal. 64/24 da 2.67, dentro de lo real.
export const WHEELBASE = 64;     // distancia entre ejes
export const WHEEL_R = 12;
const SUSP_REST = 16;            // largo en reposo de la suspension
// Lo que cuelga como mucho la rueda DIBUJADA bajo su anclaje en el chasis
// (moto-3d.js la coloca con esto). El pozo lo usa para decidir si una rueda
// cae dentro: la regla y el dibujo miden lo mismo.
export const SUSP_MAX = 17;
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
    jumpBuf: 0, saltos: 0, turbo: 0, enBarro: false, flota: 0,
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
//
// 980 se ajusto con la suspension rebotando (ver el signo del amortiguador en
// stepBike). Con la moto asentada daba 145 px de alto y 0.6 s en el aire: dos
// motos y media de altura, y al aterrizar la roca siguiente ya estaba encima.
// Medido con tools/prueba-furia.mjs, casi todas las muertes eran esas: la moto
// aun en el aire del salto anterior, el salto siguiente tarde, y la roca la
// pillaba subiendo. Con 800: 94 px de alto (la roca mas alta pide 46 de
// subida) y 0.47 s de vuelo.
export const JUMP_V = 800;
export const TURBO_T = 1.5;       // s de turbo tras pisar la flecha
// Dos perdones de cualquier juego de plataformas, porque el salto exige apoyo:
//  BUFFER: el toque se guarda un momento. Tocar justo antes de aterrizar
//          saltaba NADA; ahora salta en cuanto las ruedas tocan.
//  COYOTE: la moto pasa por encima de un bache y despega un instante; un toque
//          en ese instante tambien vale.
const BUFFER = 0.2, COYOTE = 0.1;
export function pideSalto(B) { B.jumpBuf = BUFFER; }
function intentaSalto(B) {
  if (B.jumpBuf <= 0 || B.jumpCool > 0) return false;
  if (!B.onGround && B.air > COYOTE) return false;
  B.jumpBuf = 0;
  // Desde la velocidad que traiga, pero sin que una caida se coma el salto.
  B.vy = Math.min(B.vy, 0) - JUMP_V;
  // La trompa se levanta desde donde este, no sumando a un giro previo: sumar
  // a ciegas es lo que mandaba la moto a dar volteretas al despegar.
  // Levanta poco: con -1.1 el morro subia tanto que la rueda de atras bajaba
  // 10 px y se colgaba en el borde del pozo.
  B.av = Math.min(B.av, 0) - 0.7;
  B.jumpCool = 0.28;
  B.onGround = false;
  B.air = COYOTE + 0.01;
  B.saltos++;                    // el juego lo mira para el sonido y la tierra
  return true;
}
// Salto inmediato, o nada. Lo usa el arnes para medir el salto a secas.
export function bikeJump(B) { pideSalto(B); return intentaSalto(B); }

// De los dos botones del pulgar derecho al giro (`lean` de stepBike).
// EN EL AIRE, un boton que ya venia apretado desde el suelo NO gira la moto:
// para girar hay que soltarlo y volver a apretarlo. Ella va siempre con el
// pulgar en el GAS, y en el vuelo largo del salto gigante (1.2 s) eso ponia
// la moto de morro y se estrellaba al caer. Sin tocar nada, la moto se
// endereza sola (autoestabilizacion, en stepBike). `M` guarda los bloqueos.
export function giro(B, gas, freno, M) {
  if (B.onGround) { M.bloqGas = gas; M.bloqFreno = freno; }
  else { if (!gas) M.bloqGas = false; if (!freno) M.bloqFreno = false; }
  const g = gas && (B.onGround || !M.bloqGas), f = freno && (B.onGround || !M.bloqFreno);
  return g && f ? 0 : g ? 1 : f ? -1 : 0;
}

// Un paso de fisica. `lean` viene del control: -1 inclina hacia atras
// (wheelie), +1 hacia adelante.
export function stepBike(B, T, dt, throttle, lean) {
  B.throttle = throttle; B.lean = lean;
  if (B.jumpCool > 0) B.jumpCool -= dt;
  intentaSalto(B);
  if (B.jumpBuf > 0) B.jumpBuf -= dt;

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
  //  1. El amortiguador se opone a una velocidad REAL (la del cuerpo menos la
  //     del suelo, ver abajo), no a una derivada numerica de la penetracion.
  //     Derivar la penetracion dividiendo por dt amplifica el ruido y en
  //     cuanto el resorte empuja fuerte, la "velocidad" estimada se dispara y
  //     el amortiguador pasa a INYECTAR energia en vez de disiparla.
  //  2. La fuerza total se satura. Un resorte lineal sin tope, integrado con
  //     Euler a 60 fps, se vuelve inestable en cuanto la compresion es grande
  //     (un aterrizaje fuerte): empuja tanto en un frame que manda el cuerpo
  //     mas arriba de donde cayo, y cada rebote crece.
  //
  // EL SIGNO DEL AMORTIGUADOR. Hasta el 25-09-2026 era `compress*K - vy*D`: con
  // la moto cayendo (vy > 0, y hacia abajo) empujaba MENOS, y subiendo empujaba
  // MAS. Eso es amortiguacion negativa: cada rebote metia energia, y la
  // saturacion de arriba solo convertia la explosion en un bote eterno. Medido
  // en llano: la moto no paraba nunca de saltar (altura 19-56 px, subidas de
  // -366 px/s), y como el salto exige apoyo, la mitad de los toques se perdian
  // y la moto se comia la roca. Ahora se opone a la velocidad con que la rueda
  // se ACERCA al suelo: la del chasis menos la del suelo que tiene debajo
  // (rodar a vx por una cuesta sube el suelo a pendiente*vx; sin restarla, la
  // moto flotaba en las bajadas y se hundia en las subidas).
  const TOUCH = 2;                 // px de compresion que ya cuentan como apoyo
  const FMAX = GRAV * 2.6;         // techo de aceleracion que puede dar el resorte
  if (penF > -SUSP_REST) {
    const compress = Math.max(0, penF + SUSP_REST);
    B.susF = compress;
    const acerca = B.vy - (groundY(T, fx + 6) - groundY(T, fx - 6)) / 12 * B.vx;
    let f = compress * SUSP_K + acerca * SUSP_D;
    if (f < 0) f = 0;                            // solo empuja
    if (f > FMAX) f = FMAX;                      // saturacion en los aterrizajes
    fyF = -f;
    if (compress > TOUCH) touching++;
  } else { B.susF *= 0.85; }
  if (penR > -SUSP_REST) {
    const compress = Math.max(0, penR + SUSP_REST);
    B.susR = compress;
    const acerca = B.vy - (groundY(T, rx + 6) - groundY(T, rx - 6)) / 12 * B.vx;
    let f = compress * SUSP_K + acerca * SUSP_D;
    if (f < 0) f = 0;
    if (f > FMAX) f = FMAX;
    fyR = -f;
    if (compress > TOUCH) touching++;
  } else { B.susR *= 0.85; }

  B.onGround = touching > 0;
  if (B.onGround) B.air = 0; else B.air += dt;

  // --- Traslacion ---
  // La gravedad, aflojada en el vuelo de una rampa (ver choques: B.flota).
  if (B.onGround) B.flota = 0;
  B.vy += GRAV * (B.flota && !B.onGround ? B.flota : 1) * dt;
  B.vy += (fyF + fyR) * 0.5 * dt;   // cada rueda soporta media moto
  // El motor empuja a lo largo del suelo, no en horizontal: en una cuesta
  // empujar horizontal hunde la rueda en la pendiente y frena de golpe.
  if (B.onGround) {
    const ga = groundAngle(T, B.x);
    const push = throttle * (B.turbo > 0 ? 2600 : 1500) - B.brake * 1800;
    B.vx += Math.cos(ga) * push * dt;
    B.vy += Math.sin(ga) * push * dt;
    // Friccion de rodadura + resistencia del aire
    B.vx *= 1 - 1.2 * dt;
    // En el barro las ruedas patinan: frena fuerte y no pasa de 240.
    B.enBarro = false;
    if (T.barro) for (const z of T.barro) if (B.x > z[0] && B.x < z[1]) { B.enBarro = true; break; }
    if (B.enBarro) { B.vx *= 1 - 3 * dt; if (B.vx > 240) B.vx -= (B.vx - 240) * 5 * dt; }
  } else {
    B.vx *= 1 - 0.15 * dt;
  }
  if (B.vx < 0) B.vx = 0;                 // no se va marcha atras
  // El turbo sube el tope un rato: es lo que hace llegar sobrado al salto
  // gigante. Al acabarse, la velocidad baja poco a poco, no de golpe.
  if (B.turbo > 0) B.turbo -= dt;
  const MAXV = B.turbo > 0 ? 700 : 520;
  if (B.vx > MAXV) B.vx = B.turbo > 0 ? MAXV : Math.max(MAXV, B.vx - 600 * dt);

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
