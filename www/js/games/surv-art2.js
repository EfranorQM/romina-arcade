// SURVIVAL — el arte de la tropa de cada bioma.
//
// Va aparte de surv-art.js (que ya lleva los siete comunes y los diez jefes)
// para no juntar treinta criaturas en un solo archivo. Mismas reglas: todo se
// dibuja por codigo dentro de una caja de SZ x SZ centrada en el origen, y se
// hornea UNA vez.
//
// Cada bioma tiene su paleta y sus criaturas la respetan: al cambiar de tramo
// se nota que la tropa tambien cambio, no solo el fondo.

// Estos tres ayudantes son los mismos de surv-art.js. Se repiten aqui en vez de
// exportarlos alli para que este archivo se pueda leer solo, que es como se
// dibuja: mirando una criatura entera de una vez.
const SZ = 64;

function bake(f, size = SZ) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const d = cv.getContext('2d');
  d.imageSmoothingEnabled = false;
  d.translate(size / 2, size / 2);
  f(d, size);
  return cv;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}

function halo(d, r, col, a = 0.5) {
  const g = d.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.55, rgba(col, a * 0.35));
  g.addColorStop(1, rgba(col, 0));
  d.fillStyle = g;
  d.beginPath(); d.arc(0, 0, r, 0, 7); d.fill();
}

function eyes(d, y, w, r, col = '#ffffff', pupil = '#12061c') {
  for (const s of [-1, 1]) {
    d.fillStyle = col;
    d.beginPath(); d.ellipse(s * w, y, r, r * 1.15, 0, 0, 7); d.fill();
    d.fillStyle = pupil;
    d.beginPath(); d.ellipse(s * w, y + r * 0.15, r * 0.42, r * 0.55, 0, 0, 7); d.fill();
  }
}

// ================= LA DUDA =================
// Paleta violeta clara, como el bioma. Son criaturas pequeñas y nerviosas: la
// duda todavia no hace daño de verdad, solo no te deja en paz.

// SUSURRO: una boca sin cara, con las ondas de lo que dice saliendo de ella.
const susurro = () => bake(d => {
  halo(d, 20, '#c9a8ff', 0.30);
  // Las ondas salen HACIA UN LADO, como quien habla al oido. Rodeandolo (que
  // era la primera version) se leia como un platillo volante.
  d.strokeStyle = 'rgba(201,168,255,0.5)';
  d.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    d.beginPath();
    d.arc(-6, 0, 5 + i * 5, -Math.PI * 0.42, Math.PI * 0.42);
    d.stroke();
  }
  // La boca, vertical y abierta: una O alargada con labios claros.
  d.fillStyle = '#e0ccff';
  d.beginPath(); d.ellipse(-6, 0, 9, 13, 0, 0, 7); d.fill();
  d.fillStyle = '#2a1245';
  d.beginPath(); d.ellipse(-6, 0, 5.5, 9, 0, 0, 7); d.fill();
  // Un brillo dentro, para que no sea un agujero plano.
  d.fillStyle = 'rgba(201,168,255,0.4)';
  d.beginPath(); d.ellipse(-7.5, -4, 2, 3, 0, 0, 7); d.fill();
});

// ESPEJISMO: una figura que se desdobla — dos siluetas iguales, una detras
// medio borrada. Al morir suelta un SUSURRO, y eso ya lo cuenta el dibujo.
const espejismo = () => bake(d => {
  halo(d, 24, '#b98cff', 0.28);
  // La copia de atras, fantasmal y desplazada.
  d.globalAlpha = 0.35;
  d.fillStyle = '#d9c2ff';
  d.beginPath(); d.ellipse(7, 2, 11, 15, 0, 0, 7); d.fill();
  d.globalAlpha = 1;
  // La figura de delante.
  d.fillStyle = '#e8dcff';
  d.beginPath(); d.ellipse(-3, 0, 12, 16, 0, 0, 7); d.fill();
  d.fillStyle = 'rgba(120,80,180,0.28)';
  d.beginPath(); d.ellipse(1, 3, 8, 11, 0, 0, 7); d.fill();
  eyes(d, -4, 4.5, 3.2);
});

// ================= EL VACIO =================
// Azules frios. Aqui las criaturas son grandes, lentas y pesadas: lo que
// asusta del vacio no es que corra, es que no se para.

// HUECO: un agujero. Un anillo con nada dentro, que es lo que lo hace raro.
const hueco = () => bake(d => {
  halo(d, 26, '#4d7fff', 0.26);
  // El borde, mas claro por arriba como si tuviera volumen.
  const g = d.createLinearGradient(0, -18, 0, 18);
  g.addColorStop(0, '#7fa8ff');
  g.addColorStop(1, '#2a4a99');
  d.fillStyle = g;
  d.beginPath(); d.arc(0, 0, 17, 0, 7); d.fill();
  // El vacio de dentro: negro de verdad, no un azul oscuro.
  d.fillStyle = '#05030f';
  d.beginPath(); d.arc(0, 0, 11, 0, 7); d.fill();
  // Dos puntos de luz dentro, lo unico que dice que esta vivo.
  d.fillStyle = 'rgba(200,220,255,0.85)';
  d.beginPath(); d.arc(-3.5, -1, 1.8, 0, 7); d.fill();
  d.beginPath(); d.arc(3.5, -1, 1.8, 0, 7); d.fill();
});

// PESO: un bloque macizo colgando de una cadena, con su placa por delante.
const peso = () => bake(d => {
  halo(d, 28, '#4d7fff', 0.22);
  // La cadena de arriba.
  d.strokeStyle = '#8fa8d9';
  d.lineWidth = 3;
  d.beginPath(); d.moveTo(0, -22); d.lineTo(0, -14); d.stroke();
  // El bloque.
  const g = d.createLinearGradient(0, -14, 0, 18);
  g.addColorStop(0, '#6f8fd9');
  g.addColorStop(1, '#2b3f77');
  d.fillStyle = g;
  d.fillRect(-15, -14, 30, 30);
  // Remaches, que es lo que lo hace pesado a la vista.
  d.fillStyle = 'rgba(15,20,45,0.75)';
  for (const x of [-10, 0, 10]) for (const y of [-9, 11]) {
    d.beginPath(); d.arc(x, y, 2, 0, 7); d.fill();
  }
  eyes(d, 0, 6, 3.4, '#c9d8ff', '#0d1530');
});

// ================= LA MENTIRA =================
// Rosa y dorado, los colores mas llamativos del juego: la mentira entra por
// los ojos. Son criaturas vistosas y simetricas, agradables de mirar.

// REFLEJO: dos mitades que no encajan, partidas por un eje brillante.
const reflejo = () => bake(d => {
  halo(d, 24, '#ff3ec9', 0.30);
  // Mitad izquierda, rosa.
  d.fillStyle = '#ff8ad4';
  d.beginPath();
  d.moveTo(0, -16); d.lineTo(-14, -4); d.lineTo(-10, 14); d.lineTo(0, 16);
  d.closePath(); d.fill();
  // Mitad derecha, dorada y desplazada: no son la misma cara.
  d.fillStyle = '#ffe14d';
  d.beginPath();
  d.moveTo(0, -14); d.lineTo(14, -6); d.lineTo(11, 12); d.lineTo(0, 16);
  d.closePath(); d.fill();
  // El eje del espejo.
  d.fillStyle = 'rgba(255,255,255,0.75)';
  d.fillRect(-1, -16, 2, 32);
  // Un ojo en cada mitad, a distinta altura: lo que delata el engaño.
  d.fillStyle = '#ffffff';
  d.beginPath(); d.ellipse(-6, -4, 3.2, 3.8, 0, 0, 7); d.fill();
  d.beginPath(); d.ellipse(6, 0, 3.2, 3.8, 0, 0, 7); d.fill();
  d.fillStyle = '#5c1040';
  d.beginPath(); d.arc(-6, -3.4, 1.5, 0, 7); d.fill();
  d.beginPath(); d.arc(6, 0.6, 1.5, 0, 7); d.fill();
});

// MASCARA: una careta de teatro, sonriendo de mas.
const mascara = () => bake(d => {
  halo(d, 24, '#ffe14d', 0.26);
  // Careta de teatro PARTIDA: la mitad que rie y la que llora. Entera y
  // amarilla se leia como un emoji sonriente, demasiado simpatico para el
  // bioma de la mentira.
  const cara = (x0, x1) => {
    d.beginPath();
    d.moveTo(0, -18);
    d.quadraticCurveTo(x1 * 16, -14, x1 * 15, 2);
    d.quadraticCurveTo(x1 * 12, 18, 0, 19);
    d.closePath(); d.fill();
  };
  // Mitad izquierda: dorada, la que rie.
  d.fillStyle = '#ffd84d'; cara(0, -1);
  // Mitad derecha: rosa oscuro, la que llora.
  d.fillStyle = '#c9407f'; cara(0, 1);
  // El corte del medio.
  d.fillStyle = 'rgba(255,255,255,0.7)';
  d.fillRect(-1, -18, 2, 37);

  // Ojo izquierdo: rasgado hacia arriba (rie).
  d.fillStyle = '#3a1420';
  d.beginPath(); d.ellipse(-7, -5, 4, 4.5, 0.35, 0, 7); d.fill();
  // Ojo derecho: caido (llora), con su lagrima.
  d.beginPath(); d.ellipse(7, -3, 4, 4.5, -0.35, 0, 7); d.fill();
  d.fillStyle = 'rgba(255,255,255,0.75)';
  d.beginPath();
  d.moveTo(7, 2); d.quadraticCurveTo(9, 8, 7, 12);
  d.quadraticCurveTo(5, 8, 7, 2);
  d.closePath(); d.fill();

  // Las bocas: sonrisa a la izquierda, mueca a la derecha.
  d.strokeStyle = '#3a1420';
  d.lineWidth = 2.2;
  d.beginPath(); d.arc(-5, 4, 7, 0.25 * Math.PI, 0.8 * Math.PI); d.stroke();
  d.beginPath(); d.arc(5, 15, 7, 1.2 * Math.PI, 1.75 * Math.PI); d.stroke();
});

// ================= EL SILENCIO =================
// Verdes de agua profunda. Criaturas que aprietan: el silencio no golpea,
// ahoga.

// AHOGO: una medusa con los tentaculos cerrandose.
const ahogo = () => bake(d => {
  halo(d, 26, '#5cffd8', 0.26);
  // La campana.
  const g = d.createLinearGradient(0, -16, 0, 4);
  g.addColorStop(0, '#a8fff0');
  g.addColorStop(1, '#2a8f80');
  d.fillStyle = g;
  d.beginPath(); d.arc(0, -2, 15, Math.PI, 0); d.fill();
  d.beginPath(); d.ellipse(0, -2, 15, 5, 0, 0, Math.PI); d.fill();
  // Tentaculos, curvados hacia dentro.
  d.strokeStyle = '#7fe8d4';
  d.lineWidth = 2.2;
  for (let i = -2; i <= 2; i++) {
    d.beginPath();
    d.moveTo(i * 6, 2);
    d.quadraticCurveTo(i * 9, 10, i * 3.5, 19);
    d.stroke();
  }
  eyes(d, -6, 5, 3.2, '#eafffb', '#0d3833');
});

// ECO: una onda que se repite, tres anillos que se van perdiendo. Al morir se
// parte en dos ecos pequeños, y el dibujo ya lo anuncia.
const eco = () => bake(d => {
  halo(d, 22, '#5cffd8', 0.24);
  // Tres anillos concentricos, cada uno mas debil.
  for (let i = 0; i < 3; i++) {
    d.strokeStyle = rgba('#5cffd8', 0.85 - i * 0.25);
    d.lineWidth = 3 - i * 0.7;
    d.beginPath(); d.arc(0, 0, 6 + i * 5, 0, 7); d.stroke();
  }
  // El nucleo.
  d.fillStyle = '#d4fff5';
  d.beginPath(); d.arc(0, 0, 4.5, 0, 7); d.fill();
  d.fillStyle = '#1a5c54';
  d.beginPath(); d.arc(0, 0, 2, 0, 7); d.fill();
});

// El eco pequeño: lo mismo con un anillo menos y mas apagado.
const eco2 = () => bake(d => {
  halo(d, 17, '#5cffd8', 0.26);
  // A 24 px en pantalla los anillos finos desaparecian: van mas gruesos y mas
  // separados que en el eco grande, aunque ocupe casi lo mismo.
  for (let i = 0; i < 2; i++) {
    d.strokeStyle = rgba('#5cffd8', 0.85 - i * 0.3);
    d.lineWidth = 3.2 - i * 0.8;
    d.beginPath(); d.arc(0, 0, 6 + i * 6, 0, 7); d.stroke();
  }
  d.fillStyle = '#eafffb';
  d.beginPath(); d.arc(0, 0, 4.5, 0, 7); d.fill();
  d.fillStyle = '#1a5c54';
  d.beginPath(); d.arc(0, 0, 2, 0, 7); d.fill();
});

// ================= EL ABANDONO =================
// Rojos y naranjas de brasa. El ultimo bioma: criaturas rotas, quemadas, que
// ya no tienen nada que perder.

// OLVIDADO: una silueta deshaciendose en ceniza, embistiendo.
const olvidado = () => bake(d => {
  halo(d, 24, '#ff5c5c', 0.30);
  // El cuerpo, mas estrecho abajo: se esta deshaciendo.
  const g = d.createLinearGradient(0, -16, 0, 16);
  g.addColorStop(0, '#ffb86b');
  g.addColorStop(1, '#8f2020');
  d.fillStyle = g;
  d.beginPath();
  d.moveTo(0, -17);
  d.lineTo(12, -6); d.lineTo(8, 8); d.lineTo(3, 17);
  d.lineTo(-3, 14); d.lineTo(-8, 6); d.lineTo(-12, -7);
  d.closePath(); d.fill();
  // Las motas que va soltando.
  d.fillStyle = 'rgba(255,184,107,0.55)';
  for (const [x, y, r] of [[-13, 10, 1.8], [12, 12, 1.5], [-9, 17, 1.3], [10, 4, 1.2]]) {
    d.beginPath(); d.arc(x, y, r, 0, 7); d.fill();
  }
  eyes(d, -7, 4.5, 3, '#ffe8c4', '#5c1010');
});

// GRIETA: un bloque partido, con la luz saliendo por la fisura.
const grieta = () => bake(d => {
  halo(d, 30, '#ff5c5c', 0.24);
  // El bloque.
  const g = d.createLinearGradient(0, -17, 0, 18);
  g.addColorStop(0, '#6b3030');
  g.addColorStop(1, '#2e1414');
  d.fillStyle = g;
  d.beginPath();
  d.moveTo(-16, -15); d.lineTo(16, -17); d.lineTo(18, 14);
  d.lineTo(-14, 17);
  d.closePath(); d.fill();
  // La grieta, de arriba abajo, en zigzag.
  d.strokeStyle = '#ffb86b';
  d.lineWidth = 3;
  d.beginPath();
  d.moveTo(-2, -16);
  d.lineTo(3, -6); d.lineTo(-3, 1); d.lineTo(4, 9); d.lineTo(0, 17);
  d.stroke();
  // El resplandor de dentro.
  d.strokeStyle = 'rgba(255,240,200,0.8)';
  d.lineWidth = 1.2;
  d.beginPath();
  d.moveTo(-2, -16);
  d.lineTo(3, -6); d.lineTo(-3, 1); d.lineTo(4, 9); d.lineTo(0, 17);
  d.stroke();
  // Dos ojos en los lados, mirando desde la piedra.
  d.fillStyle = '#ffb86b';
  d.beginPath(); d.arc(-9, -4, 2.6, 0, 7); d.fill();
  d.beginPath(); d.arc(10, -2, 2.6, 0, 7); d.fill();
});

export const BUILDERS2 = {
  susurro, espejismo, hueco, peso, reflejo, mascara,
  ahogo, eco, eco2, olvidado, grieta,
};
