// ROMINA - la princesa, dibujada por codigo a la rejilla de pixeles.
//
// POR QUE POR CODIGO Y NO CELDA A CELDA. El caballero anterior media 22x30
// celdas (660) y se veia como un muñequito de lata: faltaban pixeles para una
// cara. Esta mide 128x180 (23.040 celdas), el detalle de una princesa de
// verdad -- pero eso son 23.000 caracteres por fotograma escritos a mano, y
// dieciocho fotogramas serian 400.000. Inviable.
//
// Asi que cada fotograma se COMPONE: se describe el cuerpo con formas
// (elipses, trapecios, curvas), se rasteriza a la rejilla con las reglas del
// pixel art (sin antialias, contorno de 2 px, sombreado en bandas planas) y se
// hornea UNA vez al arrancar. Sigue siendo pixel art de verdad -- cada pixel
// cae en su celda y los colores son de una paleta corta -- y cada fotograma es
// un dibujo entero distinto, no el mismo estirado.
//
// El truco esta en que las formas se describen con PROPORCIONES de una pose, y
// una pose son veinte numeros: asi dibujar un fotograma nuevo es mover esos
// numeros, no teclear 23.000 celdas.

// El lienzo de un fotograma. ES MAS ANCHO QUE ELLA A PROPOSITO: Romina ocupa
// 128 px, pero con la espada extendida hacia delante la punta llega a x=188, y
// en un lienzo de 128 se recortaban 46 px de hoja -- el tajo extendido NUNCA se
// habia visto entero, y por eso los fotogramas de ataque acababan siempre con
// la espada en angulos altos, que era lo unico que cabia. Medido, no a ojo.
export const W = 192, H = 180;   // el lienzo de un fotograma
export const EJE = 64;           // donde cae el eje del cuerpo dentro del lienzo

// ---------- Paleta ----------
// Rosa y oro sobre piel clara, como las referencias. El contorno NO es negro
// puro: es un violeta muy oscuro, que sobre el campo de batalla (marron y
// granate) no abre un agujero.
export const P = {
  // EL CONTORNO. Aqui estaba la otra mitad del "se ve simple jugando", y es
  // medible: el contorno tenia luminancia 30 y el suelo por el que ella anda
  // (sue3 #241c1a) tiene 30, y el fondo lejano (lej1) 32. CONTRASTE DE 1 Y 2:
  // la silueta se fundia con el escenario, asi que de lejos no se leia un
  // personaje sino una mancha rosa. Por eso los juegos que el puso de ejemplo
  // "se ven geniales en un mapa grande": Soul Knight rodea al heroe de negro
  // puro, Dead Cells lo pone rojo brillante sobre azul apagado. Lo primero
  // que hace que un personaje se lea NO es su cara, es que su silueta despegue.
  //
  // Este violeta es bastante mas oscuro (luminancia 12) y da 18-20 de
  // contraste contra el suelo y 24 contra el cielo, sin ser negro puro -- que
  // sobre un campo de batalla marron abriria un agujero.
  out:  '#150a14',   // contorno
  out2: '#4a2338',   // contorno interior, mas suave (pliegues del vestido)

  // Pelo NEGRO. En pixel art el negro plano se lee como un agujero, asi que
  // son cuatro tonos con un tiro azulado: el brillo es lo que le da forma.
  pel1: '#17131f',   // pelo en sombra
  pel2: '#251f33',   // pelo base
  pel3: '#3d3450',   // pelo iluminado
  pel4: '#5f5478',   // brillo del pelo

  piel1:'#c9805c',   // piel en sombra
  piel2:'#f0b48a',   // piel base
  piel3:'#ffd9b8',   // piel iluminada

  ves1: '#8e1140',   // vestido: sombra profunda
  ves2: '#c41c5a',   // vestido: base
  ves3: '#ef4a84',   // vestido: iluminado
  ves4: '#ff8fbc',   // vestido: brillo
  // (AQUI ESTABAN fal1/fal2/fal3, los rosas claros de la enagua.) Fuera con
  // ella: asomaba por el bajo solo al moverse -- 780 celdas de rosa palido que
  // aparecian al arrancar a correr y desaparecian al parar -- y se leia como
  // un agujero claro en el vestido, no como una prenda de debajo. El hondo de
  // la falda lo dan ahora los pliegues en ves1, que estan SIEMPRE. Si algun
  // dia hace falta un segundo rosa, que se añada midiendo, no por herencia.

  bla1: '#d9c8d4',   // el forro blanco del borde
  bla2: '#fff4fa',

  oro1: '#8a6216',   // oro en sombra
  oro2: '#d9a52a',   // oro base
  oro3: '#ffe066',   // oro brillo
  joya: '#ff3860',   // la piedra de la corona
  joya2:'#7fe8ff',   // la joya del pecho

  ace1: '#4a5570',   // acero del escudo y la espada
  ace2: '#8a97b8',
  ace3: '#d4dcf0',
  ace4: '#ffffff',

  // Madera del escudo: sus referencias tienen TABLONES, no una chapa lisa.
  mad1: '#6b4326',   // madera en sombra (las juntas entre tablones)
  mad2: '#96613a',   // madera base
  mad3: '#b8794a',   // madera iluminada

  // LOS OJOS. Dos tonos de iris (ojo/ojo2) y no tres: medido a x1.95 -- el
  // tamaño al que se JUEGA -- los tonos vecinos se promedian y colapsan en
  // una mancha, asi que tres cafes daban menos informacion que dos cafes
  // separados. Lo que se lee a ese tamaño es el CONTRASTE: blanco grande,
  // pupila negra. Es la misma ley que siguen Soul Knight (4 colores en todo
  // el personaje) o Stardew: pocas formas, muy contrastadas.
  // La CEJA tiene tono propio. Iba en pel3 (el pelo iluminado) y como cae
  // pegada al flequillo se confundia con el; y en pel2 competia en negro con
  // la pupila. Este es el punto medio: se lee como ceja sobre la frente sin
  // robarle el contraste al ojo.
  ceja: '#4a3a52',
  ojo:  '#5a2f18',   // el iris: cafe oscuro
  ojo2: '#b9763f',   // el cafe claro del borde de abajo, donde entra la luz
  ojoB: '#ffffff',
  boca: '#c4385e',
  // El rosa del colorete y los labios. Antes el colorete se pintaba en piel1,
  // que es un marron de sombra: a tamaño de juego eran dos manchas marrones
  // flotando en los pomulos, que se leian como suciedad. Un colorete es ROSA
  // y va fundido, no marron y recortado.
  rubor:'#ef9e8e',
};

// ---------- Rasterizador de pixel art ----------
// Un lienzo de W x H celdas donde se pinta con formas. Nunca hay antialias:
// cada celda es de un color o de ninguno.
export function makeLienzo() {
  return { w: W, h: H, d: new Array(W * H).fill(null) };
}

function px(L, x, y, col) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
  L.d[y * L.w + x] = col;
}
function get(L, x, y) {
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return null;
  return L.d[y * L.w + x];
}

// Elipse rellena
export function elipse(L, cx, cy, rx, ry, col) {
  for (let y = Math.ceil(cy - ry); y <= cy + ry; y++) {
    const dy = (y - cy) / ry;
    const w = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    for (let x = Math.ceil(cx - w); x <= cx + w; x++) px(L, x, y, col);
  }
}

// Poligono relleno (scanline), con los vertices en [x,y,...]
export function poly(L, pts, col) {
  let minY = 1e9, maxY = -1e9;
  for (let i = 1; i < pts.length; i += 2) { if (pts[i] < minY) minY = pts[i]; if (pts[i] > maxY) maxY = pts[i]; }
  for (let y = Math.ceil(minY); y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1];
      const j = (i + 2) % pts.length;
      const x2 = pts[j], y2 = pts[j + 1];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= xs[k + 1]; x++) px(L, x, y, col);
    }
  }
}

// Trazo grueso entre dos puntos (para brazos, mechones, la hoja)
export function linea(L, x1, y1, x2, y2, gr, col) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    elipse(L, x, y, gr / 2, gr / 2, col);
  }
}

// Curva de tres puntos, con grosor que puede variar de un extremo al otro
export function curva(L, x1, y1, cx, cy, x2, y2, gr1, gr2, col) {
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * x1 + 2 * u * t * cx + t * t * x2;
    const y = u * u * y1 + 2 * u * t * cy + t * t * y2;
    const gr = gr1 + (gr2 - gr1) * t;
    elipse(L, x, y, gr / 2, gr / 2, col);
  }
}

// Contorno: pinta de `col` toda celda vacia que toque una celda pintada.
// Es lo que le da a un sprite el aire de pixel art dibujado y no de mancha.
export function contorno(L, col, gordo) {
  const copia = L.d.slice();
  const pasa = (x, y) => copia[y * L.w + x] !== null;
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      if (copia[y * L.w + x] !== null) continue;
      let toca = false;
      for (let dy = -1; dy <= 1 && !toca; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
          if (pasa(nx, ny)) { toca = true; break; }
        }
      }
      if (toca) px(L, x, y, col);
    }
  }
  if (gordo) contorno(L, col, false);
}

// Sombra: oscurece la mitad de atras de una zona ya pintada. Se le pasa que
// color sustituye a cual, y a partir de que x.
export function sombreaDesde(L, x0, pares) {
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < x0; x++) {
      const c = get(L, x, y);
      if (c && pares[c]) px(L, x, y, pares[c]);
    }
  }
}

// Vuelca el lienzo a un canvas de W x H pixeles.
export function aCanvas(L) {
  const cv = document.createElement('canvas');
  cv.width = L.w; cv.height = L.h;
  const c = cv.getContext('2d');
  const img = c.createImageData(L.w, L.h);
  const d = img.data;
  for (let i = 0; i < L.d.length; i++) {
    const col = L.d[i];
    if (!col) continue;
    d[i * 4] = parseInt(col.substr(1, 2), 16);
    d[i * 4 + 1] = parseInt(col.substr(3, 2), 16);
    d[i * 4 + 2] = parseInt(col.substr(5, 2), 16);
    d[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}
