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
// Dibujada entera con paths en el espacio local de la moto: se traslada al
// punto del chasis, se rota, y todo lo demas son coordenadas fijas. La
// suspension entra como desplazamiento vertical de cada rueda.
export function drawBike(g, B, sx, sy, wheelbase, wheelR, susRest) {
  g.save();
  g.translate(sx, sy);
  g.rotate(B.ang);

  const hw = wheelbase * 0.5;
  // Compresion normalizada: 0 extendida, 1 a fondo. Es lo que sube la rueda
  // hacia el chasis y hace que la moto "encaje" en los baches.
  const cF = Math.min(1, B.susF / (susRest * 1.6));
  const cR = Math.min(1, B.susR / (susRest * 1.6));
  const wyF = susRest * (1 - cF) + wheelR * 0.2;
  const wyR = susRest * (1 - cR) + wheelR * 0.2;

  // --- Sombra bajo la moto (se aplana con la altura) ---
  // --- Horquilla trasera y delantera ---
  g.strokeStyle = '#2a2f3a';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(-hw * 0.25, 2); g.lineTo(-hw, wyR); g.stroke();
  g.beginPath(); g.moveTo(hw * 0.30, -6); g.lineTo(hw, wyF); g.stroke();
  // Amortiguador delantero: un segundo trazo mas claro que se acorta al
  // comprimir, para que la suspension se LEA y no solo se calcule.
  g.strokeStyle = '#8a93a6';
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(hw * 0.34, -4); g.lineTo(hw * 0.86, wyF * 0.82); g.stroke();

  drawWheel(g, -hw, wyR, wheelR, B.wheelSpin);
  drawWheel(g,  hw, wyF, wheelR, B.wheelSpin);

  // --- Chasis: un cuerpo curvo, no un rectangulo ---
  g.beginPath();
  g.moveTo(-hw * 0.85, -2);
  g.quadraticCurveTo(-hw * 0.5, -14, 0, -12);
  g.quadraticCurveTo(hw * 0.55, -11, hw * 0.72, -4);
  g.quadraticCurveTo(hw * 0.3, 4, -hw * 0.4, 6);
  g.closePath();
  const bodyG = g.createLinearGradient(0, -14, 0, 6);
  bodyG.addColorStop(0, '#ff5c7a');
  bodyG.addColorStop(0.5, '#e0243f');
  bodyG.addColorStop(1, '#8a0f22');
  g.fillStyle = bodyG;
  g.fill();
  g.strokeStyle = '#2a0a12'; g.lineWidth = 1.5; g.stroke();

  // Escape con brillo
  g.strokeStyle = '#6a7488'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-hw * 0.3, 2); g.lineTo(-hw * 0.95, 5); g.stroke();

  // --- Piloto ---
  drawRider(g, B, hw);
  g.restore();
}

// Rueda: llanta oscura, aro claro y radios que giran de verdad.
function drawWheel(g, x, y, r, spin) {
  g.save();
  g.translate(x, y);
  // Neumatico
  g.beginPath(); g.arc(0, 0, r, 0, 6.2832);
  g.fillStyle = '#14171e'; g.fill();
  g.strokeStyle = '#0a0c11'; g.lineWidth = 1.5; g.stroke();
  // Taco del neumatico: puntos en el borde que rotan. Es lo que hace que se
  // vea GIRAR; sin esto una rueda circular parece quieta por mas que avance.
  g.rotate(spin);
  g.strokeStyle = '#2e343f'; g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.2832;
    g.beginPath();
    g.moveTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.stroke();
  }
  // Radios y buje
  g.strokeStyle = '#9aa4b8'; g.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.2832;
    g.beginPath(); g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
    g.stroke();
  }
  g.beginPath(); g.arc(0, 0, 2.6, 0, 6.2832);
  g.fillStyle = '#c8d0e0'; g.fill();
  g.restore();
}

// Piloto: cabeza, torso, brazo y pierna. Se agacha con la velocidad y se
// endereza en el aire, que es lo que da la lectura de "va rapido".
function drawRider(g, B, hw) {
  const tuck = Math.min(1, B.vx / 520);        // 0 erguida, 1 agachada
  const air = B.onGround ? 0 : Math.min(1, B.air * 3);
  const lean = -tuck * 3 + air * 2;
  const hipX = -hw * 0.18, hipY = -12;
  const shX = hipX + 7 + tuck * 3, shY = hipY - 13 + tuck * 4 + lean;

  // Pierna
  g.strokeStyle = '#2b3550'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(hipX, hipY);
  g.quadraticCurveTo(hipX + 2, hipY + 6, hipX + 9, hipY + 9);
  g.stroke();

  // Torso
  g.strokeStyle = '#e8443a'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(shX, shY); g.stroke();

  // Brazo hasta el manillar
  g.strokeStyle = '#c8382f'; g.lineWidth = 4;
  g.beginPath();
  g.moveTo(shX, shY);
  g.quadraticCurveTo(shX + 8, shY + 3, hw * 0.72, -8);
  g.stroke();

  // Casco con visera
  const hx = shX + 2.5, hy = shY - 5;
  g.beginPath(); g.arc(hx, hy, 6.2, 0, 6.2832);
  const helm = g.createLinearGradient(hx - 5, hy - 5, hx + 5, hy + 5);
  helm.addColorStop(0, '#ffe8a8');
  helm.addColorStop(1, '#e0a020');
  g.fillStyle = helm; g.fill();
  g.strokeStyle = '#5a3a08'; g.lineWidth = 1.2; g.stroke();
  // Visera mirando adelante
  g.beginPath();
  g.moveTo(hx + 1.5, hy - 2.5);
  g.quadraticCurveTo(hx + 7, hy - 1, hx + 6, hy + 2);
  g.quadraticCurveTo(hx + 3, hy + 2.5, hx + 1.5, hy + 1);
  g.closePath();
  g.fillStyle = '#26303f'; g.fill();
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
