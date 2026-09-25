// FURIA - los cuatro mandos: SALTO y TRUCO al pulgar izquierdo, GAS y FRENO
// al derecho.
//
// El pulgar derecho lleva la velocidad y el giro: GAS acelera y, en el aire,
// baja el morro; FRENO frena y, en el aire, lo sube. Los dos iconos son
// chevrones hacia delante y hacia atras, que dicen lo mismo en el suelo que en
// el aire. El izquierdo lleva las acciones, que son toques: SALTO, y TRUCO en
// el aire (en el suelo TRUCO tambien salta: un toque en el lado izquierdo
// nunca se pierde).
//
// Antes eran dos mitades de pantalla con un circulo de guia: tocar la mitad
// izquierda saltaba Y frenaba (tocar = salto, mantener = freno), asi que no
// se podia frenar sin saltar. Ahora cada cosa tiene su boton.
//
// Son medallones como los de ROMINA (aro, cara de color, icono, nombre
// debajo), pero vectoriales y con brillo, porque FURIA es suave y no pixel
// art. Cada uno se hornea UNA vez por estado (normal, apretado, brillando):
// en cada frame solo cuestan cuatro drawImage.
//
// La colocacion es pura (sin DOM) para medirla: `aQuien(x, y)` dice a que
// boton le toca un toque. Todo el lado izquierdo es de SALTO/TRUCO y todo el
// derecho de GAS/FRENO: el mas cercano por el borde. Un pulgar no apunta fino.

import { text, measure } from '../font.js';

// En px del lienzo virtual (1200x540). En el Redmi, 1 px virtual = 0.12 mm:
// r 66 son 16 mm de diametro, r 48 son 11.5. Los pequeños van un poco mas
// arriba que los grandes: con y 468 su nombre se salia por abajo.
export const BOTONES = [
  { id: 'salto', x: 128, y: 430, r: 66, cara: ['#5aa2ff', '#2f6fd8', '#173a80'], nombre: 'SALTO' },
  { id: 'truco', x: 292, y: 448, r: 48, cara: ['#ffd76a', '#f0a41a', '#9a5a08'], nombre: 'TRUCO' },
  { id: 'gas', x: 1072, y: 430, r: 66, cara: ['#ff7a9a', '#ff2e63', '#9a0a30'], nombre: 'GAS' },
  { id: 'freno', x: 908, y: 448, r: 48, cara: ['#aab4c6', '#6a7488', '#343c4c'], nombre: 'FRENO' },
];
export const FRANJA_ARRIBA = 90;           // lo de arriba es del HUD y la pausa

export function aQuien(x, y, VW = 1200) {
  if (y < FRANJA_ARRIBA) return null;
  const lado = x < VW * 0.5 ? ['salto', 'truco'] : ['gas', 'freno'];
  let mejor = null, dm = Infinity;
  for (const b of BOTONES) {
    if (!lado.includes(b.id)) continue;
    const d = Math.hypot(x - b.x, y - b.y) - b.r;
    if (d < dm) { dm = d; mejor = b.id; }
  }
  return mejor;
}

// ---------- Dibujo ----------
const hornos = new Map();                  // id + estado + ss -> lienzo

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// El icono, en coordenadas de una cara de radio 1.
function icono(g, id) {
  g.beginPath();
  if (id === 'salto') {
    g.moveTo(0, -0.62); g.lineTo(0.5, -0.08); g.lineTo(0.2, -0.08); g.lineTo(0.2, 0.55);
    g.lineTo(-0.2, 0.55); g.lineTo(-0.2, -0.08); g.lineTo(-0.5, -0.08);
  } else if (id === 'truco') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.27 : 0.62;
      if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r + 0.03); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 0.03);
    }
  } else {
    // Dos chevrones: hacia delante (GAS) o hacia atras (FRENO).
    const s = id === 'gas' ? 1 : -1;
    for (const dx of [-0.26, 0.2]) {
      g.moveTo(s * (dx - 0.16), -0.46); g.lineTo(s * (dx + 0.22), 0); g.lineTo(s * (dx - 0.16), 0.46);
      g.lineTo(s * (dx - 0.4), 0.46); g.lineTo(s * (dx - 0.02), 0); g.lineTo(s * (dx - 0.4), -0.46);
    }
  }
  g.closePath();
}

// Hornea un medallon. estado: 0 normal, 1 apretado, 2 brillando (el TRUCO que
// se puede hacer, el SALTO guardado).
function hornea(b, estado, ss) {
  const clave = b.id + estado + 'x' + ss;
  let cv = hornos.get(clave);
  if (cv) return cv;
  const pad = 14, R = b.r;
  const lado = Math.ceil((R + pad) * 2 * ss);
  cv = lienzo(lado, lado);
  const g = cv.getContext('2d');
  g.scale(ss, ss);
  g.translate(R + pad, R + pad);
  const hundido = estado === 1 ? 0.93 : 1;
  g.scale(hundido, hundido);

  // Halo (solo brillando)
  if (estado === 2) {
    const h = g.createRadialGradient(0, 0, R * 0.8, 0, 0, R + pad);
    h.addColorStop(0, 'rgba(255,240,170,0.9)');
    h.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = h;
    g.beginPath(); g.arc(0, 0, R + pad, 0, Math.PI * 2); g.fill();
  }
  // Sombra bajo el medallon
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.arc(0, R * 0.06, R, 0, Math.PI * 2); g.fill();
  // Aro: metal claro con reflejo arriba
  const aro = g.createLinearGradient(0, -R, 0, R);
  aro.addColorStop(0, '#ffffff'); aro.addColorStop(0.45, '#d9dde6'); aro.addColorStop(1, '#7c8496');
  g.fillStyle = aro;
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  // Cara: su color, mas clara arriba
  const rc = R * 0.84;
  const cara = g.createRadialGradient(-rc * 0.3, -rc * 0.4, rc * 0.1, 0, 0, rc);
  const [c0, c1, c2] = b.cara;
  cara.addColorStop(0, estado === 1 ? c1 : c0); cara.addColorStop(0.55, c1); cara.addColorStop(1, c2);
  g.fillStyle = cara;
  g.beginPath(); g.arc(0, 0, rc, 0, Math.PI * 2); g.fill();
  // Brillo de cristal en la mitad de arriba
  g.save();
  g.beginPath(); g.arc(0, 0, rc, 0, Math.PI * 2); g.clip();
  const br = g.createLinearGradient(0, -rc, 0, 0);
  br.addColorStop(0, 'rgba(255,255,255,0.45)'); br.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = br;
  g.beginPath(); g.ellipse(0, -rc * 0.45, rc * 0.85, rc * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // Icono blanco con contorno oscuro
  g.save();
  g.scale(rc * 0.78, rc * 0.78);
  icono(g, b.id);
  g.lineJoin = 'round';
  g.lineWidth = 0.16; g.strokeStyle = 'rgba(20,10,30,0.75)'; g.stroke();
  g.fillStyle = '#ffffff'; g.fill();
  g.restore();
  hornos.set(clave, cv);
  return cv;
}

// Pinta los cuatro. estado = { salto, truco, gas, freno } con 0/1/2 cada uno;
// alfa general (se apagan un poco cuando no se tocan).
export function pinta(g, estado, ss, alfa = 1) {
  for (const b of BOTONES) {
    const e = estado[b.id] || 0;
    const cv = hornea(b, e, ss);
    const lado = cv.width / ss;
    g.globalAlpha = alfa * (e ? 1 : 0.78);
    g.drawImage(cv, b.x - lado / 2, b.y - lado / 2, lado, lado);
    // El nombre, debajo del aro (o encima, si no cabe): pixel, con sombra.
    const esc = b.r > 60 ? 2 : 2;
    const ty = b.y + b.r + 6;
    const tx = Math.round(b.x - measure(b.nombre, esc) / 2);
    const dentro = ty + 7 * esc <= 540;
    const y = dentro ? ty : b.y - b.r - 6 - 7 * esc;
    text(g, b.nombre, tx + 1, y + 1, 'rgba(0,0,0,0.6)', esc * ss);
    text(g, b.nombre, tx, y, '#ffffff', esc * ss);
  }
  g.globalAlpha = 1;
}
