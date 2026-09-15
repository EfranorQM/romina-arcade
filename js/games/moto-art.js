// FURIA - arte vectorial, sin un solo pixel horneado.
//
// La diferencia con los otros juegos del arcade: aqui NO hay sprites. Todo se
// dibuja con paths, curvas y degradados a resolucion 1080x2400 con el filtrado
// suave activado. Eso da bordes limpios en cualquier tamano y permite cosas que
// un sprite no puede: la rueda gira de verdad, la suspension se comprime, el
// chasis se inclina, y la piloto se mueve con la moto.
//
// El coste esta controlado porque los degradados se crean UNA VEZ y se guardan.
// Crear un gradient por frame es lo que suele hundir a un canvas 2D.

export const SKY = {
  // Tres momentos del dia. El nivel elige uno, y eso solo cambia colores:
  // ninguna geometria depende de esto.
  dusk:  { top:'#1a1040', mid:'#7a2b5e', low:'#e8724c', sun:'#ffd98a', ground:'#241633', ground2:'#3a2450', fog:'#7a2b5e' },
  night: { top:'#050a1e', mid:'#0e1a3a', low:'#1d3060', sun:'#cfe4ff', ground:'#080d1c', ground2:'#131f3a', fog:'#0e1a3a' },
  dawn:  { top:'#132a4d', mid:'#3f6a9e', low:'#f0b070', sun:'#fff0c0', ground:'#1a2a3a', ground2:'#2c4256', fog:'#3f6a9e' },
};

let _grad = null, _gw = 0, _gh = 0, _pal = null;

// Los degradados del cielo y del suelo se rehacen solo si cambia el tamano o
// la paleta. Crearlos cada frame cuesta mas que dibujarlos.
export function ensureGradients(g, w, h, pal) {
  if (_grad && _gw === w && _gh === h && _pal === pal) return _grad;
  const sky = g.createLinearGradient(0, 0, 0, h * 0.72);
  sky.addColorStop(0, pal.top);
  sky.addColorStop(0.55, pal.mid);
  sky.addColorStop(1, pal.low);
  const gr = g.createLinearGradient(0, h * 0.45, 0, h);
  gr.addColorStop(0, pal.ground2);
  gr.addColorStop(1, pal.ground);
  _grad = { sky, ground: gr }; _gw = w; _gh = h; _pal = pal;
  return _grad;
}

export function resetGradients() { _grad = null; }

// ---------- Fondo ----------
// Tres capas de cerros con parallax. Cada capa es una polilinea generada con
// senos, dibujada como un path relleno. El parallax se aplica al desplazamiento
// horizontal, no regenerando la forma: asi el fondo no "hierve" al avanzar.
export function drawSky(g, w, h, pal, camX, sunX, sunY) {
  const gd = ensureGradients(g, w, h, pal);
  g.fillStyle = gd.sky;
  g.fillRect(0, 0, w, h);

  // Sol / luna con halo. El halo es un radial gradient, no un blur: el blur de
  // canvas (shadowBlur) es caro y en moviles a veces se ignora.
  const r = h * 0.055;
  const halo = g.createRadialGradient(sunX, sunY, r * 0.3, sunX, sunY, r * 4.2);
  halo.addColorStop(0, pal.sun + 'cc');
  halo.addColorStop(0.35, pal.sun + '33');
  halo.addColorStop(1, pal.sun + '00');
  g.fillStyle = halo;
  g.fillRect(sunX - r * 4.2, sunY - r * 4.2, r * 8.4, r * 8.4);
  g.fillStyle = pal.sun;
  g.beginPath(); g.arc(sunX, sunY, r, 0, 6.2832); g.fill();
}

// Una capa de cerros. `depth` 0 = lejos (se mueve poco), 1 = cerca.
export function drawHills(g, w, h, camX, depth, baseY, amp, color, seed) {
  const par = 0.06 + depth * 0.30;
  const off = camX * par;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  const stepPx = 26;
  for (let sx = 0; sx <= w + stepPx; sx += stepPx) {
    const wx = (sx + off) * 0.01;
    const y = baseY
      + Math.sin(wx * 1.7 + seed) * amp
      + Math.sin(wx * 0.61 + seed * 2.3) * amp * 0.7
      + Math.sin(wx * 3.3 + seed * 0.7) * amp * 0.22;
    g.lineTo(sx, y);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

// ---------- Terreno ----------
// El suelo se dibuja como un path unico relleno con degradado, con una linea
// clara arriba (el borde iluminado) y textura de rayitas para dar tierra.
export function drawTerrain(g, T, groundY, w, h, camX, camY, pal) {
  const gd = ensureGradients(g, w, h, pal);
  g.beginPath();
  const stepPx = 8;                      // paso de muestreo en PANTALLA
  let firstY = 0;
  for (let sx = -stepPx; sx <= w + stepPx; sx += stepPx) {
    const wx = camX + sx;
    const y = groundY(T, wx) - camY;
    if (sx <= -stepPx) { g.moveTo(sx, y); firstY = y; }
    else g.lineTo(sx, y);
  }
  g.lineTo(w + stepPx, h);
  g.lineTo(-stepPx, h);
  g.closePath();
  g.fillStyle = gd.ground;
  g.fill();

  // Borde iluminado: la misma curva, trazada. Da el filo de tierra contra el
  // cielo, que es lo que separa visualmente el suelo del fondo.
  g.beginPath();
  for (let sx = -stepPx; sx <= w + stepPx; sx += stepPx) {
    const wx = camX + sx;
    const y = groundY(T, wx) - camY;
    if (sx <= -stepPx) g.moveTo(sx, y); else g.lineTo(sx, y);
  }
  g.strokeStyle = pal.fog;
  g.lineWidth = 5;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.20)';
  g.lineWidth = 2;
  g.stroke();
}

// ---------- La moto ----------
// Dibujada entera con paths en el espacio local: se traslada al punto del
// chasis, se rota, y todo lo demas son coordenadas fijas.
//
// PROPORCIONES. La version anterior tenia wheelbase 46 con ruedas de radio 13,
// o sea un ratio distancia-entre-ejes / diametro de 1.77. En una moto de cross
// real (KTM, Honda CRF) ese ratio es 2.78: las ruedas eran 1.6x mas grandes de
// lo que corresponde y el conjunto leia como minimoto de circo. Ahora el ratio
// es 2.67, dentro de lo real.
//
// ANATOMIA. Una moto de perfil no se reconoce por su silueta general sino por
// media docena de piezas concretas. La version anterior era un solo blob rosa
// curvo, y por eso no se leia como moto por mas suave que estuviera dibujado.
// Las piezas que la hacen legible, y que aqui se dibujan por separado:
//   - horquilla delantera INCLINADA ~27 grados (el "lanzamiento"), no vertical
//   - basculante trasero saliendo de un pivote central
//   - bloque de motor entre las dos ruedas
//   - deposito de gasolina adelante y arriba
//   - asiento plano y largo hacia atras
//   - guardabarros delantero flotando sobre la rueda
//   - manillar alto
//   - disco de freno en cada rueda
const RAKE = 0.47;               // ~27 grados de lanzamiento de la horquilla
const SIN_R = Math.sin(RAKE), COS_R = Math.cos(RAKE);

export function drawBike(g, B, sx, sy, wheelbase, wheelR, susRest) {
  g.save();
  g.translate(sx, sy);
  g.rotate(B.ang);

  const hw = wheelbase * 0.5;
  // Compresion normalizada: 0 extendida, 1 a fondo. Sube la rueda hacia el
  // chasis, que es lo que hace que la moto "encaje" en los baches.
  const cF = Math.min(1, B.susF / (susRest * 1.6));
  const cR = Math.min(1, B.susR / (susRest * 1.6));
  const wyF = susRest * (1 - cF) + wheelR * 0.2;
  const wyR = susRest * (1 - cR) + wheelR * 0.2;

  // Puntos de anclaje. Todo lo demas se cuelga de estos.
  const axR = -hw,            ayR = wyR;          // eje trasero
  const axF =  hw,            ayF = wyF;          // eje delantero
  const pivX = -hw * 0.22,    pivY = 1;           // pivote del basculante
  // Pipa de direccion. Estaba en (0.62*hw, -22): daba una horquilla de 35px,
  // o sea 2.9 veces el radio de la rueda, cuando en una moto real la parte
  // visible es ~1.6x. Salia una horquilla larguisima y gris que dominaba el
  // frente y separaba la rueda del resto: leia como scooter estirada.
  const steerX = hw * 0.74,   steerY = -14;       // pipa de direccion

  // === TRASERO: basculante + amortiguador ===
  // El basculante es un brazo que va del pivote al eje: al comprimirse la
  // suspension el eje sube y el brazo pivota, que es como se mueve de verdad.
  // GROSORES. Todos los tubos estaban a 6px con ruedas de radio 12, o sea
  // 0.5x el radio; en una moto real un tubo de chasis es 0.10-0.15x. La
  // horquilla en particular salia como un bloque gris que dominaba el frente
  // y desconectaba visualmente la rueda delantera del resto.
  g.strokeStyle = '#333b47'; g.lineWidth = 3.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(pivX, pivY); g.lineTo(axR, ayR); g.stroke();
  // Monoamortiguador inclinado, del pivote hacia arriba-adelante
  g.strokeStyle = '#c8503c'; g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(pivX + 3, pivY - 2);
  g.lineTo(axR + wheelbase * 0.17, ayR - 14 - cR * 3);
  g.stroke();

  // === DELANTERO: horquilla inclinada ===
  // La inclinacion es lo que mas dice "moto" de un vistazo. Se dibuja en dos
  // trazos: la barra gruesa (botella) y la varilla brillante que se ve salir,
  // y que se acorta al comprimir.
  const forkLen = Math.hypot(axF - steerX, ayF - steerY);
  g.strokeStyle = '#2f3742'; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(steerX, steerY); g.lineTo(axF, ayF); g.stroke();
  g.strokeStyle = '#b8c2d4'; g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(steerX + SIN_R * 3, steerY + COS_R * 3);
  g.lineTo(steerX + (axF - steerX) * (0.30 + cF * 0.22),
           steerY + (ayF - steerY) * (0.30 + cF * 0.22));
  g.stroke();

  // === RUEDAS (antes del cuerpo: el chasis las tapa parcialmente) ===
  drawWheel(g, axR, ayR, wheelR, B.wheelSpin);
  drawWheel(g, axF, ayF, wheelR, B.wheelSpin);

  // === CHASIS: los tubos que unen pipa, asiento y motor ===
  // Sin esto la carroceria roja quedaba flotando como un labio pegado encima,
  // sin tocar el motor ni las ruedas, y el conjunto no se leia como una
  // maquina sino como piezas sueltas superpuestas.
  g.strokeStyle = '#454f5e'; g.lineWidth = 2.8; g.lineCap = 'round';
  // Tubo superior: pipa -> bajo el asiento
  g.beginPath();
  g.moveTo(steerX - 2, steerY + 3);
  g.lineTo(pivX + 2, pivY - 12);
  g.stroke();
  // Tubo descendente: pipa -> motor
  g.beginPath();
  g.moveTo(steerX - 3, steerY + 5);
  g.lineTo(pivX + 9, pivY - 3);
  g.stroke();
  // Subchasis: del asiento al colin
  g.beginPath();
  g.moveTo(pivX + 1, pivY - 12);
  g.lineTo(axR + 11, pivY - 12);
  g.stroke();

  // === MOTOR: bloque entre las ruedas ===
  // Sin esto el centro queda hueco y se ve como dos ruedas unidas por un palo.
  // Pero va OSCURO: con un gris claro (#5a6474) mas tres aletas todavia mas
  // claras encima, el motor formaba la mancha mas luminosa de toda la moto y
  // se comia el protagonismo de la carroceria roja.
  g.beginPath();
  g.moveTo(pivX - 2, pivY - 5);
  g.lineTo(pivX + 11, pivY - 6);
  g.lineTo(pivX + 12, pivY + 4);
  g.lineTo(pivX, pivY + 5);
  g.closePath();
  const engG = g.createLinearGradient(0, pivY - 6, 0, pivY + 5);
  engG.addColorStop(0, '#39424f');
  engG.addColorStop(1, '#1a1f27');
  g.fillStyle = engG; g.fill();
  // Dos aletas apenas insinuadas, no tres brillantes.
  g.strokeStyle = 'rgba(150,163,184,0.5)'; g.lineWidth = 0.9;
  for (let i = 0; i < 2; i++) {
    const yy = pivY - 2.5 + i * 3.5;
    g.beginPath(); g.moveTo(pivX + 1, yy); g.lineTo(pivX + 10, yy); g.stroke();
  }

  // === ESCAPE: tubo fino del motor hacia atras ===
  g.strokeStyle = '#5d6674'; g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(pivX + 8, pivY + 1);
  g.quadraticCurveTo(pivX - 4, pivY + 5, axR + 8, ayR - 5);
  g.stroke();
  // Silenciador: ensanche corto y claro al final, que es lo unico que brilla
  g.strokeStyle = '#9aa4b5'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(axR + 12, ayR - 6); g.lineTo(axR + 4, ayR - 4); g.stroke();

  // === CARROCERIA: deposito + asiento en una sola pieza ===
  // El perfil clasico: sube desde el motor al deposito, cae al asiento, y
  // termina en el colin levantado.
  // El perfil va casi HORIZONTAL del colin al deposito. La version anterior
  // subia el asiento 24px sobre el pivote y la moto parecia empinada incluso
  // parada; ademas tapaba el deposito, que es la pieza mas reconocible.
  g.beginPath();
  // El colin se ancla a la altura del CHASIS (pivY), no a la del eje trasero
  // (ayR): ese eje sube y baja con la suspension, asi que colgar de el la cola
  // de la moto la hacia bascular. Y con la suspension extendida quedaba 11px
  // por debajo del asiento, o sea la moto empinada de morro hacia arriba.
  // El DEPOSITO necesita volumen. Antes toda la carroceria era una franja de
  // ~10px de alto: leia como un labio rojo flotando sobre la moto en vez de
  // como el cuerpo de la maquina. Ahora el asiento sigue siendo fino (lo es en
  // una moto real) pero el deposito baja hasta rozar el motor, que es lo que
  // da una masa continua de deposito a motor.
  const seatY = pivY - 15;
  g.moveTo(axR + 9, seatY + 2);                         // punta del colin
  g.quadraticCurveTo(axR + 15, seatY - 2, pivX + 2, seatY - 1);   // asiento plano
  g.quadraticCurveTo(pivX + 9, seatY - 5, pivX + 15, seatY - 3);  // lomo del deposito
  g.quadraticCurveTo(steerX - 7, steerY, steerX - 3, steerY + 5);  // morro
  g.quadraticCurveTo(steerX - 8, steerY + 11, pivX + 13, pivY - 5); // frente del deposito baja al motor
  g.quadraticCurveTo(pivX + 6, pivY - 6, pivX + 2, seatY + 5);    // panza del deposito
  g.lineTo(pivX - 3, seatY + 6);                        // bajo el asiento
  g.closePath();
  const bodyG = g.createLinearGradient(0, pivY - 20, 0, pivY - 2);
  bodyG.addColorStop(0, '#ff7a90');
  bodyG.addColorStop(0.45, '#e0243f');
  bodyG.addColorStop(1, '#7e0c1e');
  g.fillStyle = bodyG; g.fill();
  g.strokeStyle = '#2a0a12'; g.lineWidth = 1.4; g.stroke();
  // Brillo del deposito: una franja clara arriba, que es lo que da la lectura
  // de superficie pintada y curva.
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(pivX + 4, seatY - 3);
  g.quadraticCurveTo(pivX + 13, seatY - 5, steerX - 6, steerY + 3);
  g.stroke();

  // === GUARDABARROS DELANTERO ===
  // Flota sobre la rueda y sigue a la horquilla. Es una de las piezas que mas
  // rapido identifica a una moto de cross.
  g.beginPath();
  const gbx = axF - SIN_R * 7, gby = ayF - COS_R * 14;
  g.moveTo(gbx - 11, gby + 3);
  g.quadraticCurveTo(gbx + 2, gby - 5, gbx + 13, gby + 1);
  g.lineTo(gbx + 12, gby + 4);
  g.quadraticCurveTo(gbx + 2, gby - 1, gbx - 10, gby + 6);
  g.closePath();
  g.fillStyle = '#e0243f'; g.fill();
  g.strokeStyle = '#2a0a12'; g.lineWidth = 1; g.stroke();

  // === MANILLAR ===
  // Barra corta y vertical + puno. Antes salia un trazo largo hacia atras que
  // leia como una antena, no como un manillar.
  g.strokeStyle = '#39424f'; g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(steerX - 1, steerY + 1);
  g.lineTo(steerX - 3, steerY - 6);
  g.stroke();
  g.strokeStyle = '#1d242e'; g.lineWidth = 3.6; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(steerX - 6, steerY - 6.5);
  g.lineTo(steerX + 1, steerY - 7);
  g.stroke();

  // === PILOTO ===
  drawRider(g, B, hw, steerX, steerY, pivX, pivY);
  g.restore();
}

// Rueda de cross: neumatico con tacos, disco de freno, radios y buje.
function drawWheel(g, x, y, r, spin) {
  g.save();
  g.translate(x, y);
  // Neumatico
  g.beginPath(); g.arc(0, 0, r, 0, 6.2832);
  g.fillStyle = '#15181f'; g.fill();
  g.strokeStyle = '#090b0f'; g.lineWidth = 1.5; g.stroke();

  g.rotate(spin);
  // Tacos: trazos radiales gruesos en el borde. Es lo que hace que la rueda se
  // vea GIRAR; un circulo liso parece quieto por mas que la moto avance.
  // Tacos CORTOS y numerosos. Con 10 tacos largos que sobresalian del radio la
  // rueda leia como un engranaje, no como un neumatico: el perfil exterior
  // dejaba de ser un circulo. Ahora quedan dentro del borde.
  g.strokeStyle = '#39424f'; g.lineWidth = 1.8;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.2832;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.beginPath();
    g.moveTo(ca * (r - 2.2), sa * (r - 2.2));
    g.lineTo(ca * (r - 0.4), sa * (r - 0.4));
    g.stroke();
  }
  // Llanta (el aro metalico) y radios
  g.beginPath(); g.arc(0, 0, r - 3.4, 0, 6.2832);
  g.strokeStyle = '#93a0b5'; g.lineWidth = 1.4; g.stroke();
  g.strokeStyle = '#7c8798'; g.lineWidth = 0.9;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.2832;
    g.beginPath(); g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * (r - 3.8), Math.sin(a) * (r - 3.8));
    g.stroke();
  }
  // Disco de freno: un anillo mas claro pegado al buje
  g.beginPath(); g.arc(0, 0, r * 0.46, 0, 6.2832);
  g.strokeStyle = '#aab4c6'; g.lineWidth = 1.8; g.stroke();
  // Buje
  g.beginPath(); g.arc(0, 0, 2.4, 0, 6.2832);
  g.fillStyle = '#c8d0e0'; g.fill();
  g.restore();
}

// Piloto de pie sobre las estriberas, como se conduce una moto de cross.
// Se agacha con la velocidad y se estira en el aire.
function drawRider(g, B, hw, steerX, steerY, pivX, pivY) {
  const tuck = Math.min(1, B.vx / 520);          // 0 erguida, 1 agachada
  const air = B.onGround ? 0 : Math.min(1, B.air * 3);

  // ESCALA. La version anterior levantaba la cadera 20px sobre el pivote y el
  // piloto medi­a 50px de alto contra un wheelbase de 64: dominaba la imagen y
  // la moto quedaba debajo como un accesorio. En una moto de cross real la
  // parte VISIBLE del piloto sobre el asiento es ~0.37 del wheelbase, o sea
  // unos 24px aqui. Va agachado sobre la moto, no erguido encima.
  const footX = pivX + 5, footY = pivY + 2;
  const hipX = pivX + 1 - tuck * 2, hipY = pivY - 13 + air * 1.5;
  const shX = hipX + 8 + tuck * 4, shY = hipY - 8 + tuck * 3 - air * 1.5;
  const handX = steerX - 5, handY = steerY - 7;

  // Pierna doblada: cadera -> rodilla adelantada -> pie en la estribera.
  g.strokeStyle = '#1e2740'; g.lineWidth = 3.8; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(hipX, hipY);
  g.quadraticCurveTo(hipX + 7, hipY + 7, footX, footY);
  g.stroke();

  // Torso inclinado hacia el manillar
  // AZUL, no rojo. Con el torso rojo sobre una carroceria roja el piloto
  // desaparecia: las dos manchas se leian como una sola.
  g.strokeStyle = '#2f6fd0'; g.lineWidth = 5.2;
  g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(shX, shY); g.stroke();

  // Brazo al manillar, con el codo alto
  g.strokeStyle = '#2a5fb0'; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(shX, shY);
  g.quadraticCurveTo(shX + 5, shY - 3, handX, handY);
  g.stroke();

  // Casco de cross: calota, barbillera y pico.
  const hx = shX + 2.5, hy = shY - 4.5;
  g.beginPath(); g.arc(hx, hy, 4.6, 0, 6.2832);
  const helm = g.createLinearGradient(hx - 4, hy - 4, hx + 4, hy + 4);
  helm.addColorStop(0, '#fff0c0');
  helm.addColorStop(1, '#d99a1c');
  g.fillStyle = helm; g.fill();
  g.strokeStyle = '#5a3a08'; g.lineWidth = 0.9; g.stroke();
  // Barbillera
  g.beginPath();
  g.moveTo(hx + 0.5, hy + 0.8);
  g.quadraticCurveTo(hx + 6.4, hy + 1.6, hx + 5.4, hy + 3.8);
  g.quadraticCurveTo(hx + 2.2, hy + 4.4, hx + 0.4, hy + 3);
  g.closePath();
  g.fillStyle = '#e8b62c'; g.fill();
  g.strokeStyle = '#5a3a08'; g.lineWidth = 0.7; g.stroke();
  // Visera oscura
  g.beginPath();
  g.moveTo(hx + 1, hy - 2);
  g.quadraticCurveTo(hx + 5.4, hy - 1, hx + 4.6, hy + 0.9);
  g.quadraticCurveTo(hx + 2.2, hy + 1, hx + 1, hy + 0.3);
  g.closePath();
  g.fillStyle = '#26303f'; g.fill();
  // Pico superior
  g.strokeStyle = '#d99a1c'; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(hx - 1, hy - 4);
  g.lineTo(hx + 5.6, hy - 4.8);
  g.stroke();
}

// ---------- Obstaculos ----------
export function drawObstacle(g, ob, sx, gy, OB) {
  g.save();
  g.translate(sx, gy);
  if (ob.kind === OB.ROCK) {
    // Roca: poligono irregular pero DETERMINISTA (derivado de ob.x), para que
    // no cambie de forma entre frames.
    g.beginPath();
    const n = 7, r = ob.h;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 - 1.57;
      const wob = 0.72 + ((Math.sin(ob.x * 0.37 + i * 2.1) + 1) * 0.5) * 0.5;
      const px = Math.cos(a) * r * wob * 1.25, py = Math.sin(a) * r * wob;
      if (i === 0) g.moveTo(px, py - r * 0.1); else g.lineTo(px, py - r * 0.1);
    }
    g.closePath();
    const rg = g.createLinearGradient(0, -r, 0, r * 0.4);
    rg.addColorStop(0, '#8a93a6'); rg.addColorStop(1, '#39404f');
    g.fillStyle = rg; g.fill();
    g.strokeStyle = '#20252e'; g.lineWidth = 1.5; g.stroke();
  } else if (ob.kind === OB.RAMP) {
    g.beginPath();
    g.moveTo(-ob.w * 0.5, 0);
    g.lineTo(ob.w * 0.5, -ob.h * 1.5);
    g.lineTo(ob.w * 0.5, 0);
    g.closePath();
    const rg = g.createLinearGradient(0, -ob.h * 1.5, 0, 0);
    rg.addColorStop(0, '#f0b45a'); rg.addColorStop(1, '#8a5a20');
    g.fillStyle = rg; g.fill();
    g.strokeStyle = '#3a2408'; g.lineWidth = 1.5; g.stroke();
  } else if (ob.kind === OB.LOG) {
    const w = ob.w, h = ob.h;
    g.beginPath();
    g.ellipse(0, -h * 0.5, w * 0.5, h * 0.5, 0, 0, 6.2832);
    const lg = g.createLinearGradient(0, -h, 0, 0);
    lg.addColorStop(0, '#a06a3a'); lg.addColorStop(1, '#4a2c14');
    g.fillStyle = lg; g.fill();
    g.strokeStyle = '#2a1808'; g.lineWidth = 1.5; g.stroke();
    // Anillos de la madera
    g.strokeStyle = '#6b4423'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, -h * 0.5, w * 0.22, h * 0.22, 0, 0, 6.2832); g.stroke();
  }
  g.restore();
}

// ---------- Particulas ----------
// Tierra que salta de la rueda trasera. Se dibujan como circulos con alfa, no
// como sprites: asi el tamano puede ser fraccionario y no se ve escalonado.
export function drawDirt(g, list, camX, camY) {
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.life <= 0) continue;
    const a = Math.min(1, p.life / p.max);
    g.globalAlpha = a * 0.85;
    g.fillStyle = p.c;
    g.beginPath();
    g.arc(p.x - camX, p.y - camY, p.r * (0.4 + a * 0.6), 0, 6.2832);
    g.fill();
  }
  g.globalAlpha = 1;
}
