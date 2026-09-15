// SURVIVAL — el icono de cada habilidad, en pixel art de verdad.
//
// Cada icono es una rejilla de 16x16 escrita a mano, un caracter por pixel.
// Es pixel art de verdad y no un dibujo vectorial encogido: los bordes caen
// donde los pongo y a 3x de escala cada pixel se ve como un cuadrado limpio.
//
// La paleta va por LETRAS y cada icono elige las suyas. Asi el mismo dibujo
// puede teñirse del color de su rareza sin volver a escribirlo.
//
//   .  transparente      X  trazo principal (claro)
//   o  trazo medio       #  sombra / contorno oscuro
//   *  acento (blanco)   %  boquete (blanco a medias)
//
// Se hornean UNA vez a un canvas y despues solo se estiran, igual que las
// criaturas en surv-art.js: la pantalla de cartas no puede costar frames.

const P = 16;                       // lado de la rejilla, en pixeles

// ---------- Los dibujos ----------
// Leelos entrecerrando los ojos: a 16x16 lo que importa es la silueta.

// PERFORANTE: tres enemigos en fila, ensartados por un mismo disparo.
const perforante = [
  '................',
  '..###..###..###.',
  '.#XXX%#XXX%#XXX#',
  '.#X#X%#X#X%#X#X#',
  '.#XXX%#XXX%#XXX#',
  '..###..###..###.',
  '................',
  '................',
  '......****......',
  '......****......',
  '......****......',
  '......****......',
  '.....******.....',
  '......****......',
  '.......**.......',
  '................',
];

// IMAN: la herradura clasica, con sus dos polos y una chispa.
const iman = [
  '................',
  '....XXX..XXX....',
  '...X###XX###X...',
  '..X##XXXXXX##X..',
  '..X#X......X#X..',
  '.X##X......X##X.',
  '.X#X........X#X.',
  '.X#X...**...X#X.',
  '.X#X..****..X#X.',
  '.X#X...**...X#X.',
  '.X#X........X#X.',
  '.XXX........XXX.',
  '.***........ooo.',
  '.***........ooo.',
  '.***........ooo.',
  '................',
];

// MECHA CORTA: una bomba negra con la mecha chispeando. La silueta es lo que
// manda: bola grande y maciza, mecha fina arriba a la derecha.
const mecha = [
  '................',
  '.............*..',
  '..........*.*...',
  '...........*....',
  '..........**....',
  '.........##.....',
  '........####....',
  '......########..',
  '.....##########.',
  '....############',
  '....####XX######',
  '....###XXXX#####',
  '....####XX######',
  '.....##########.',
  '......########..',
  '.........####...',
];

// SEGUNDA PIEL: un escudo con una segunda capa por dentro.
const piel = [
  '................',
  '..XXXXXXXXXXXX..',
  '.X############X.',
  '.X#oooooooooo#X.',
  '.X#o********o#X.',
  '.X#o*XXXXXX*o#X.',
  '.X#o*X####X*o#X.',
  '.X#o*X#oo#X*o#X.',
  '.X#o*X#oo#X*o#X.',
  '.X#o*X####X*o#X.',
  '..X#o*XXXX*o#X..',
  '...X#o****o#X...',
  '....X#oooo#X....',
  '.....X####X.....',
  '......XXXX......',
  '.......XX.......',
];

// REFLEJO: tres balas subiendo en rafaga, cada vez mas cerca.
const reflejo = [
  '.......**.......',
  '......****......',
  '......****......',
  '.......**.......',
  '................',
  '.......**.......',
  '......****......',
  '......****......',
  '.......**.......',
  '................',
  '.......**.......',
  '......****......',
  '......****......',
  '.......**.......',
  '................',
  '....oo....oo....',
];

// LA LINEA RESISTE: un enemigo rebotando contra la linea, que aguanta.
const linea = [
  '................',
  '................',
  '......####......',
  '.....#oooo#.....',
  '....#o#oo#o#....',
  '....#oooooo#....',
  '.....#oooo#.....',
  '......####......',
  '................',
  '..o..o....o..o..',
  '................',
  'XXXXXXXXXXXXXXXX',
  '****************',
  '****************',
  'XXXXXXXXXXXXXXXX',
  '................',
];

// COMBO ARDIENTE: una llama. Es la mas reconocible de un vistazo.
const ardiente = [
  '................',
  '..........X.....',
  '.........XX.....',
  '........XX......',
  '.......XX.......',
  '......XXX.......',
  '.....XXXX.......',
  '....XXXXXX......',
  '...XXX**XXX.....',
  '..XXX****XXX....',
  '..XX******XX....',
  '..XX**##**XX....',
  '..XXX*##*XXX....',
  '...XXX**XXX.....',
  '....XXXXXX......',
  '.....XXXX.......',
];

// REBOTE: la bala sube, pega en el techo y vuelve en V.
const rebote = [
  '################',
  '################',
  '................',
  '..*..........*..',
  '..**........**..',
  '...*........*...',
  '...**......**...',
  '....*......*....',
  '....**....**....',
  '.....*....*.....',
  '.....**..**.....',
  '......*..*......',
  '......****......',
  '.......**.......',
  '................',
  '................',
];

// OTRA OPORTUNIDAD: un corazon partiendose... y volviendo a latir.
const otra = [
  '................',
  '...XXX....XXX...',
  '..XXXXX..XXXXX..',
  '.XXXXXXXXXXXXXX.',
  '.XXXX**XX**XXXX.',
  '.XXX**XX**XXXXX.',
  '.XXXX**XX**XXXX.',
  '..XXXXX**XXXXX..',
  '..XXXX**XXXXXX..',
  '...XXXXXXXXXX...',
  '...XXXX**XXXX...',
  '....XXXXXXXX....',
  '.....XXXXXX.....',
  '......XXXX......',
  '.......XX.......',
  '................',
];

export const ICONS = {
  perforante, iman, mecha, piel, reflejo, linea, ardiente, rebote, otra,
};

// ---------- Horneado ----------
// Cada icono se dibuja una sola vez por color y se guarda. La pantalla de
// cartas se repinta 60 veces por segundo: dibujar 256 cuadraditos por icono en
// cada fotograma seria absurdo.
const cache = new Map();

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(Math.min(255, (n >> 16 & 255) * f));
  const g = Math.round(Math.min(255, (n >> 8 & 255) * f));
  const b = Math.round(Math.min(255, (n & 255) * f));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Devuelve el canvas del icono `id` teñido de `color`, a `scale` px por pixel.
export function icon(id, color, scale = 3) {
  const key = id + '|' + color + '|' + scale;
  if (cache.has(key)) return cache.get(key);

  const grid = ICONS[id];
  if (!grid) return null;

  const cv = document.createElement('canvas');
  cv.width = P * scale; cv.height = P * scale;
  const d = cv.getContext('2d');
  d.imageSmoothingEnabled = false;

  // Los cuatro tonos salen del color de la rareza, asi que el icono va siempre
  // a juego con su marco sin tener que definir una paleta por habilidad.
  const tone = {
    X: shade(color, 1.0),
    o: shade(color, 0.62),
    '#': shade(color, 0.32),
    '*': '#ffffff',
    // `%` es el agujero que deja la bala: blanco a medias, para que se vea el
    // boquete sin competir con el trazo principal.
    '%': 'rgba(255,255,255,0.55)',
  };

  for (let y = 0; y < P; y++) {
    const row = grid[y] || '';
    for (let x = 0; x < P; x++) {
      const c = row[x];
      if (!c || c === '.') continue;
      const col = tone[c];
      if (!col) continue;
      d.fillStyle = col;
      d.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  cache.set(key, cv);
  return cv;
}
