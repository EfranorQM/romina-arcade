// Portadas de los juegos, dibujadas por codigo. Una por juego, 96x128 pixeles
// (proporcion 3:4, la de una caja de juego), horneadas UNA vez al arrancar el
// menu y despues solo estiradas por el cover flow.
//
// No son capturas ni miniaturas: son caratulas. Cada una cuenta de un vistazo
// que hay dentro — la silueta corriendo entre torres de SKYLINE, el puno de
// NEON FIST — usando los dos colores que el propio juego declara en su meta.
// Eso las mantiene coherentes con el juego aunque su arte cambie.

export const CW = 96, CH = 128;

// Cada portada se hornea en su canvas. `d` es el contexto ya listo.
function make(draw) {
  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const d = cv.getContext('2d');
  d.imageSmoothingEnabled = false;
  draw(d);
  return cv;
}

// Degradado vertical de fondo, comun a todas: cielo arriba, suelo oscuro abajo.
function sky(d, top, bot) {
  const gr = d.createLinearGradient(0, 0, 0, CH);
  gr.addColorStop(0, top); gr.addColorStop(1, bot);
  d.fillStyle = gr; d.fillRect(0, 0, CW, CH);
}

// Marco interior: un filete de luz por dentro del borde. Da el aire de caja.
function frame(d, col) {
  d.strokeStyle = col; d.lineWidth = 1;
  d.strokeRect(3.5, 3.5, CW - 7, CH - 7);
}

// ---------- SKYLINE: la corredora saltando el hueco entre azoteas ----------
// Lo que hay que leer de un vistazo es el SALTO. Por eso la ciudad es una
// silueta plana y oscura (no compite) y la figura va grande, en el aire, con
// el hueco negro debajo bien abierto.
const skyline = () => make(d => {
  sky(d, '#1b1140', '#40124e');
  // Luna baja y grande.
  d.fillStyle = '#f7eeb4'; d.beginPath(); d.arc(74, 24, 11, 0, 7); d.fill();
  d.fillStyle = 'rgba(247,238,180,0.14)'; d.beginPath(); d.arc(74, 24, 20, 0, 7); d.fill();
  // Ciudad lejana: dientes bajos, casi negros. Solo da profundidad.
  d.fillStyle = '#231552';
  const far = [58, 48, 64, 52, 68, 44, 60, 50];
  for (let i = 0; i < far.length; i++) d.fillRect(i * 13 - 3, far[i], 11, 100 - far[i]);
  // Ventanitas lejanas, tenues.
  d.fillStyle = 'rgba(77,224,240,0.30)';
  for (let i = 0; i < far.length; i++)
    for (let k = 0; k < 3; k++)
      if ((i + k) % 3) d.fillRect(i * 13, far[i] + 5 + k * 7, 2, 3);
  // Las DOS azoteas del salto: bloques macizos, negros, con el canto encendido.
  // El hueco entre ellas cae en el CENTRO (x 30..66) y la corredora vuela justo
  // sobre el: si el hueco se corre a un lado, el bloque del medio se lee como
  // un edificio que la atraviesa y el salto desaparece.
  d.fillStyle = '#0d0722';
  d.fillRect(-2, 96, 32, CH);      // azotea de salida
  d.fillRect(66, 86, 32, CH);      // azotea de llegada, mas alta
  d.fillStyle = '#4de0f0';
  d.fillRect(-2, 96, 32, 3); d.fillRect(66, 86, 32, 3);
  // Brillo del neon derramandose por el canto.
  d.fillStyle = 'rgba(77,224,240,0.22)';
  d.fillRect(-2, 99, 32, 5); d.fillRect(66, 89, 32, 5);
  // La corredora: grande, en pleno vuelo sobre el hueco, inclinada adelante.
  d.save();
  d.translate(48, 76); d.rotate(0.15);
  d.fillStyle = '#e0249a';
  d.fillRect(-4, -8, 8, 15);                        // torso
  d.beginPath(); d.arc(0, -13, 5, 0, 7); d.fill();  // cabeza
  // Pierna de atras estirada, la de adelante recogida: pose de zancada.
  d.fillRect(-13, 6, 11, 4);
  d.fillRect(3, 4, 5, 9);
  d.fillRect(3, 11, 9, 4);
  // Brazos: uno atras, otro adelante.
  d.fillRect(-11, -6, 8, 4);
  d.fillRect(4, -4, 9, 4);
  // Estela de velocidad detras.
  d.fillStyle = 'rgba(224,36,154,0.4)';
  d.fillRect(-24, -4, 10, 3); d.fillRect(-22, 2, 8, 3);
  d.restore();
  frame(d, '#4de0f0');
});

// ---------- NEON FIST: el puno de perfil, entrando en el golpe ----------
// De frente el puno se leia como una mano abierta. De perfil se ve el
// contorno cerrado: nudillos delante, dedos doblados debajo, muneca atras.
const neonfist = () => make(d => {
  sky(d, '#450c30', '#12030f');
  // Destello: rayos claros saliendo del punto de impacto, no marrones.
  d.save();
  d.translate(68, 58);
  d.fillStyle = 'rgba(255,225,77,0.13)';
  for (let i = 0; i < 10; i++) {
    d.rotate(Math.PI / 5);
    d.beginPath(); d.moveTo(0, 0); d.lineTo(70, -7); d.lineTo(70, 7); d.fill();
  }
  d.restore();
  // Anillos de impacto, mas fuertes cerca del puno.
  d.strokeStyle = 'rgba(255,225,77,0.85)'; d.lineWidth = 3;
  d.beginPath(); d.arc(68, 58, 24, 0, 7); d.stroke();
  d.strokeStyle = 'rgba(255,225,77,0.30)'; d.lineWidth = 2;
  d.beginPath(); d.arc(68, 58, 36, 0, 7); d.stroke();
  // El puno, de perfil, apuntando a la derecha. Un solo contorno cerrado.
  d.fillStyle = '#ff5c9d';
  d.beginPath();
  d.moveTo(20, 46);                       // arriba de la muneca
  d.lineTo(54, 42);                       // dorso hasta los nudillos
  d.quadraticCurveTo(66, 44, 66, 56);     // nudillo de arriba, redondeado
  d.quadraticCurveTo(66, 70, 54, 72);     // frente del puno, curva de impacto
  d.lineTo(48, 76);                       // meniques abajo
  d.quadraticCurveTo(34, 82, 22, 74);     // palma cerrada
  d.closePath(); d.fill();
  // Surcos entre los dedos doblados: tres lineas sobre la mano cerrada.
  d.strokeStyle = 'rgba(120,10,60,0.65)'; d.lineWidth = 2; d.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    d.beginPath();
    d.moveTo(46 - i * 9, 74 - i * 1.5);
    d.quadraticCurveTo(52 - i * 9, 62, 48 - i * 9, 50);
    d.stroke();
  }
  // Luz amarilla en el borde que golpea.
  d.strokeStyle = '#ffe14d'; d.lineWidth = 3;
  d.beginPath();
  d.moveTo(54, 42); d.quadraticCurveTo(66, 44, 66, 56); d.quadraticCurveTo(66, 70, 54, 72);
  d.stroke();
  // Antebrazo saliendo del borde izquierdo. Va MAS FINO que el puno y en un
  // tono mas oscuro: si iguala el grosor, la portada se lee como un tubo rosa
  // cruzando la caja en vez de como un brazo que lanza el golpe.
  d.fillStyle = '#b8336c';
  d.beginPath();
  d.moveTo(0, 52); d.lineTo(24, 48); d.lineTo(24, 72); d.lineTo(0, 74);
  d.closePath(); d.fill();
  // El impacto va DELANTE del puno, no detras. Las esquirlas salen EN ABANICO
  // desde los nudillos: en rectangulos horizontales se leian como tres guiones
  // de texto flotando, no como un golpe.
  d.save();
  d.translate(68, 58);
  for (const [ang, len, col] of [[-0.9, 13, '#ffe14d'], [-0.35, 18, '#ffffff'],
                                 [0.1, 15, '#ffe14d'], [0.6, 17, '#ffe14d'],
                                 [1.05, 12, '#ffb84d']]) {
    d.save(); d.rotate(ang);
    d.fillStyle = col;
    d.beginPath();
    d.moveTo(8, -2.5); d.lineTo(8 + len, 0); d.lineTo(8, 2.5);
    d.closePath(); d.fill();
    d.restore();
  }
  d.restore();
  frame(d, '#ff5c9d');
});

// ---------- LAST WAVE: la nave sola contra el cerco que se cierra ----------
const lastwave = () => make(d => {
  sky(d, '#04121c', '#0c2e2c');
  d.fillStyle = '#2e6b6b';
  for (let i = 0; i < 26; i++) d.fillRect((i * 37) % CW, (i * 53) % CH, 1, 1);
  // Tres anillos: el cerco cerrandose. El de dentro, mas brillante.
  const rings = [[46, 0.18], [33, 0.3], [22, 0.5]];
  for (const [r, a] of rings) {
    d.strokeStyle = 'rgba(255,92,157,' + a + ')'; d.lineWidth = 1;
    d.beginPath(); d.arc(48, 70, r, 0, 7); d.stroke();
  }
  // Enemigos: rombos con nucleo claro, mas grandes cerca.
  const ring = [[48, 26, 7], [18, 44, 6], [78, 44, 6], [12, 84, 5], [84, 86, 5], [30, 108, 5], [66, 110, 5]];
  for (const [x, y, s] of ring) {
    d.fillStyle = '#ff5c9d';
    d.beginPath(); d.moveTo(x, y - s); d.lineTo(x + s, y); d.lineTo(x, y + s); d.lineTo(x - s, y); d.fill();
    d.fillStyle = '#ffd0e2';
    d.beginPath(); d.moveTo(x, y - 2); d.lineTo(x + 2, y); d.lineTo(x, y + 2); d.lineTo(x - 2, y); d.fill();
  }
  // La nave: mas grande, con cabina y alas marcadas.
  d.fillStyle = '#5cffd8';
  d.beginPath();
  d.moveTo(48, 54); d.lineTo(62, 84); d.lineTo(48, 77); d.lineTo(34, 84);
  d.closePath(); d.fill();
  d.fillStyle = '#0c2e2c';                                   // cabina
  d.beginPath(); d.arc(48, 68, 4, 0, 7); d.fill();
  d.fillStyle = '#ffffff';                                   // punta encendida
  d.beginPath(); d.moveTo(48, 54); d.lineTo(52, 64); d.lineTo(44, 64); d.fill();
  // Llama del motor.
  d.fillStyle = 'rgba(92,255,216,0.55)'; d.fillRect(45, 84, 6, 8);
  d.fillStyle = 'rgba(255,255,255,0.5)'; d.fillRect(47, 84, 2, 5);
  // Sus disparos, subiendo hacia el enemigo de arriba.
  d.fillStyle = '#ffffff';
  d.fillRect(47, 40, 3, 9); d.fillRect(47, 30, 3, 6);
  frame(d, '#5cffd8');
});

// ---------- SYMBIOTE: la masa de carne agarrada de las paredes ----------
// El cuerpo tiene que verse BLANDO. La primera version usaba lineTo entre 12
// puntos y salia un pentagono con picos; ahora el contorno se cierra con
// curvas entre los puntos medios, que es lo que da el bulto de carne.
const symbiote = () => make(d => {
  sky(d, '#171b22', '#07090c');
  // Baldosas del laboratorio.
  d.strokeStyle = '#242c36'; d.lineWidth = 1;
  for (let i = 1; i < 5; i++) { d.beginPath(); d.moveTo(i * 24, 0); d.lineTo(i * 24, CH); d.stroke(); }
  for (let i = 1; i < 6; i++) { d.beginPath(); d.moveTo(0, i * 24); d.lineTo(CW, i * 24); d.stroke(); }
  // Tentaculos: cada uno se dibuja dos veces, grueso en la base y fino en la
  // punta, para que se afilen al agarrarse en vez de ser tubos parejos.
  const arms = [[4, 10], [94, 18], [2, 108], [94, 114], [54, 4], [10, 60]];
  for (const [tx, ty] of arms) {
    const mx = (52 + tx) / 2 + (ty > 62 ? 14 : -14), my = (62 + ty) / 2;
    d.lineCap = 'round';
    d.strokeStyle = '#7c0f20'; d.lineWidth = 7;
    d.beginPath(); d.moveTo(52, 62); d.quadraticCurveTo(mx, my, (mx + tx) / 2, (my + ty) / 2); d.stroke();
    d.strokeStyle = '#98162b'; d.lineWidth = 3;
    d.beginPath(); d.moveTo((mx + tx) / 2, (my + ty) / 2); d.lineTo(tx, ty); d.stroke();
    // Ventosa donde se agarra.
    d.fillStyle = '#c9203a'; d.beginPath(); d.arc(tx, ty, 4, 0, 7); d.fill();
  }
  // El cuerpo: contorno cerrado con curvas, radio irregular pero SIN picos.
  const pts = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const r = 23 + Math.sin(i * 1.7) * 3.5 + Math.cos(i * 3.1) * 2;
    pts.push([52 + Math.cos(a) * r, 62 + Math.sin(a) * r * 0.94]);
  }
  const blob = () => {
    d.beginPath();
    // Se arranca en el punto medio entre el ultimo y el primero, y cada punto
    // se usa como CONTROL de la curva: asi el trazo nunca pasa por el vertice
    // y no puede quedar esquina.
    const [px, py] = pts[N - 1];
    d.moveTo((px + pts[0][0]) / 2, (py + pts[0][1]) / 2);
    for (let i = 0; i < N; i++) {
      const [cx, cy] = pts[i], [nx, ny] = pts[(i + 1) % N];
      d.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
    }
    d.closePath();
  };
  d.fillStyle = '#c9203a'; blob(); d.fill();
  // Volumen: una sombra abajo a la derecha y el brillo humedo arriba.
  d.save(); blob(); d.clip();
  d.fillStyle = 'rgba(90,8,20,0.55)';
  d.beginPath(); d.arc(64, 76, 22, 0, 7); d.fill();
  d.fillStyle = 'rgba(255,140,160,0.35)';
  d.beginPath(); d.arc(43, 52, 11, 0, 7); d.fill();
  d.restore();
  // El ojo: esclerotica amarilla dentro de una cuenca oscura, pupila vertical.
  d.fillStyle = '#3a0710'; d.beginPath(); d.arc(53, 62, 8, 0, 7); d.fill();
  d.fillStyle = '#ffe14d'; d.beginPath(); d.arc(53, 62, 6, 0, 7); d.fill();
  d.fillStyle = '#1a0208';
  d.beginPath(); d.ellipse(53, 62, 1.8, 5.5, 0, 0, 7); d.fill();
  d.fillStyle = 'rgba(255,255,255,0.8)'; d.fillRect(50, 58, 2, 2);
  // Goteo bajo el cuerpo y charcos en el suelo.
  d.fillStyle = '#8e1224';
  d.fillRect(46, 84, 3, 9); d.fillRect(60, 82, 2, 6);
  d.fillStyle = '#6d0d1a';
  for (let i = 0; i < 7; i++) d.fillRect(10 + (i * 31) % 78, 100 + (i * 19) % 22, 5, 2);
  frame(d, '#c9203a');
});

// ---------- FURIA: la moto en el aire sobre la montana ----------
const furia = () => make(d => {
  sky(d, '#2b1030', '#f0b45a');
  // Sol bajo.
  d.fillStyle = 'rgba(255,200,120,0.45)'; d.beginPath(); d.arc(66, 84, 22, 0, 7); d.fill();
  // Cordillera al fondo y colina del frente.
  const far = [10, 26, 14, 34, 20, 30, 12, 24, 16];
  const near = [4, 12, 6, 16, 8, 14, 4, 10, 6];
  d.fillStyle = '#4a2040';
  d.beginPath(); d.moveTo(0, CH);
  for (let i = 0; i < far.length; i++) d.lineTo(i * 12, 96 - far[i]);
  d.lineTo(CW, CH); d.fill();
  d.fillStyle = '#20101c';
  d.beginPath(); d.moveTo(0, CH);
  for (let i = 0; i < near.length; i++) d.lineTo(i * 12, 112 - near[i]);
  d.lineTo(CW, CH); d.fill();
  // La moto, inclinada en pleno salto.
  d.save();
  d.translate(48, 62); d.rotate(-0.42);
  // Ruedas.
  d.strokeStyle = '#141018'; d.lineWidth = 4;
  d.beginPath(); d.arc(-16, 8, 10, 0, 7); d.stroke();
  d.beginPath(); d.arc(16, 8, 10, 0, 7); d.stroke();
  d.strokeStyle = '#5a4a60'; d.lineWidth = 1;
  d.beginPath(); d.arc(-16, 8, 4, 0, 7); d.stroke();
  d.beginPath(); d.arc(16, 8, 4, 0, 7); d.stroke();
  // Chasis y horquilla.
  d.strokeStyle = '#ff5c7a'; d.lineWidth = 3; d.lineJoin = 'round';
  d.beginPath(); d.moveTo(-16, 8); d.lineTo(-2, -2); d.lineTo(12, 0); d.lineTo(16, 8); d.stroke();
  d.beginPath(); d.moveTo(12, 0); d.lineTo(18, -8); d.stroke();
  // El piloto, echado hacia adelante.
  d.fillStyle = '#ffe14d';
  d.fillRect(-6, -14, 8, 10);                          // torso
  d.beginPath(); d.arc(4, -16, 5, 0, 7); d.fill();     // casco
  d.strokeStyle = '#ffe14d'; d.lineWidth = 3;
  d.beginPath(); d.moveTo(0, -10); d.lineTo(16, -7); d.stroke();   // brazo al manubrio
  d.restore();
  // Tierra levantada.
  d.fillStyle = 'rgba(240,180,90,0.5)';
  for (let i = 0; i < 8; i++) d.fillRect(4 + i * 5, 88 + (i % 3) * 4, 4, 2);
  frame(d, '#ff5c7a');
});

// ---------- SURVIVAL: Roma sola contra todo, defendiendo su linea ----------
// Lo que hay que leer es el ASEDIO: el corazon pequeño abajo, su linea de luz,
// y la horda cayendole encima desde arriba.
const survival = () => make(d => {
  sky(d, '#2a0b3e', '#0a0416');
  // Estrellas del fondo.
  d.fillStyle = 'rgba(180,140,255,0.5)';
  for (let i = 0; i < 22; i++) d.fillRect((i * 41) % CW, (i * 29) % 74, 1, 1);

  // La horda que baja: fantasmas a tres profundidades. Los de arriba, mas
  // pequeños y apagados, dan la sensacion de que vienen muchos mas.
  const horda = [
    [16, 22, 5, 0.45], [46, 14, 5, 0.4], [78, 24, 5, 0.45],
    [30, 40, 7, 0.75], [64, 38, 7, 0.75],
    [48, 58, 9, 1],
  ];
  for (const [x, y, r, a] of horda) {
    d.globalAlpha = a;
    d.fillStyle = '#d9c2ff';
    d.beginPath(); d.arc(x, y, r, Math.PI, 0); d.fill();
    d.fillRect(x - r, y, r * 2, r * 0.8);
    // El borde ondeado de la sabana: tres bultos repartidos DENTRO del ancho
    // del cuerpo. La formula anterior se salia por la derecha y dejaba un
    // trozo de sabana suelto flotando al lado del fantasma.
    for (let k = 0; k < 3; k++) {
      const bx = x - r + r * (k + 0.5) * (2 / 3);
      d.beginPath();
      d.arc(bx, y + r * 0.8, r / 3, 0, Math.PI);
      d.fill();
    }
    // Ojos.
    d.fillStyle = '#2a1442';
    d.beginPath(); d.arc(x - r * 0.35, y - r * 0.15, r * 0.2, 0, 7); d.fill();
    d.beginPath(); d.arc(x + r * 0.35, y - r * 0.15, r * 0.2, 0, 7); d.fill();
  }
  d.globalAlpha = 1;

  // Balas de Roma subiendo a su encuentro.
  d.fillStyle = '#ff8ad4';
  for (const [x, y] of [[40, 74], [56, 68], [48, 84]]) d.fillRect(x, y, 2, 6);

  // La linea que defiende: el corazon de la portada.
  d.fillStyle = '#ff3ec9';
  d.fillRect(0, 100, CW, 2);
  const lg = d.createLinearGradient(0, 102, 0, CH);
  lg.addColorStop(0, 'rgba(255,62,201,0.35)');
  lg.addColorStop(1, 'rgba(255,62,201,0)');
  d.fillStyle = lg;
  d.fillRect(0, 102, CW, CH - 102);

  // Roma: el corazon, con su resplandor.
  const hg = d.createRadialGradient(48, 110, 0, 48, 110, 18);
  hg.addColorStop(0, 'rgba(255,62,201,0.55)');
  hg.addColorStop(1, 'rgba(255,62,201,0)');
  d.fillStyle = hg;
  d.beginPath(); d.arc(48, 110, 18, 0, 7); d.fill();
  d.fillStyle = '#ff3ec9';
  d.beginPath();
  d.moveTo(48, 118);
  d.bezierCurveTo(37, 110, 40, 101, 45, 101);
  d.bezierCurveTo(47, 101, 48, 103, 48, 104);
  d.bezierCurveTo(48, 103, 49, 101, 51, 101);
  d.bezierCurveTo(56, 101, 59, 110, 48, 118);
  d.fill();
  d.fillStyle = 'rgba(255,255,255,0.5)';
  d.beginPath(); d.ellipse(45, 106, 2, 1.4, -0.5, 0, 7); d.fill();

  frame(d, '#ff3ec9');
});

const BUILDERS = { skyline, neonfist, lastwave, symbiote, furia, survival };

// Portada generica: si algun dia se suma un juego y nadie le dibuja caratula,
// sale una caja con sus colores y su inicial en vez de un hueco.
function generic(meta) {
  return make(d => {
    sky(d, meta.colors[1] || '#222222', '#0a0a12');
    d.fillStyle = meta.colors[0];
    d.font = 'bold 56px monospace'; d.textAlign = 'center'; d.textBaseline = 'middle';
    d.fillText(meta.title[0], CW / 2, CH / 2);
    frame(d, meta.colors[0]);
  });
}

const cache = new Map();

export function cover(meta) {
  let cv = cache.get(meta.id);
  if (!cv) {
    const b = BUILDERS[meta.id];
    cv = b ? b() : generic(meta);
    cache.set(meta.id, cv);
  }
  return cv;
}
