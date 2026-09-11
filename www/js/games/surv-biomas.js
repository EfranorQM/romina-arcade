// SURVIVAL — los cinco biomas: cada tramo de la partida con su sitio, su
// tropa, sus jefes y su fondo.
//
// Un bioma dura DIEZ olas y encierra dos peleas de jefe (la 5a y la 10a de su
// tramo). No es solo decorado: cada bioma trae enemigos propios que no salen en
// ningun otro, ademas de los comunes que siguen apareciendo en todos.
//
// La curva de dificultad se mantiene porque los enemigos COMUNES se acumulan
// como siempre (ver poolForWave en surv-defs.js) y los del bioma se suman
// encima. Un bioma nunca QUITA enemigos: añade.
//
// Los fondos se dibujan por codigo como todo lo demas. Cada uno es una idea
// simple y barata de pintar: no pueden costar frames, se dibujan 60 veces por
// segundo por debajo de todo el juego.

export const BIOMAS = [
  {
    id: 'duda',
    name: 'LA DUDA',
    // Donde empieza. El ultimo no tiene fin: la partida sigue ahi para siempre.
    from: 1,
    // Los dos colores mandan en TODO el bioma: el fondo, el aviso de entrada y
    // el tinte de sus enemigos. Por eso son solo dos.
    col: ['#b98cff', '#6bf0ff'],
    bg: 'niebla',
    bosses: ['celos', 'rutina'],
    // Enemigos propios del bioma. Se suman a los comunes de poolForWave.
    own: ['susurro', 'espejismo'],
    sub: 'TODO EMPIEZA CON UNA PREGUNTA',
  },
  {
    id: 'vacio',
    name: 'EL VACIO',
    from: 11,
    col: ['#4d7fff', '#c9b8e8'],
    bg: 'estrellas',
    bosses: ['inseguridad', 'miedo'],
    own: ['hueco', 'peso'],
    sub: 'AQUI NO HAY NADA A LO QUE AGARRARSE',
  },
  {
    id: 'mentira',
    name: 'LA MENTIRA',
    from: 21,
    col: ['#ff3ec9', '#ffe14d'],
    bg: 'espejos',
    bosses: ['mentira', 'ego'],
    own: ['reflejo', 'mascara'],
    sub: 'NADA DE LO QUE VES ES CIERTO',
  },
  {
    id: 'silencio',
    name: 'EL SILENCIO',
    from: 31,
    col: ['#5cffd8', '#2a6a7a'],
    bg: 'profundidad',
    bosses: ['silencio', 'vicio'],
    own: ['ahogo', 'eco'],
    sub: 'LO QUE NO SE DICE TAMBIEN PESA',
  },
  {
    id: 'abandono',
    name: 'EL ABANDONO',
    from: 41,
    col: ['#ff5c5c', '#ffb86b'],
    bg: 'ceniza',
    bosses: ['tiempo', 'abandono'],
    own: ['olvidado', 'grieta'],
    sub: 'LO ULTIMO QUE QUEDA ES AGUANTAR',
  },
];

// En que bioma cae una ola. A partir de la 41 se queda en el ultimo: la
// partida puede durar lo que ella aguante y no hay un sexto sitio al que ir.
export function biomaFor(wave) {
  let b = BIOMAS[0];
  for (const x of BIOMAS) if (wave >= x.from) b = x;
  return b;
}

// Si esta ola ESTRENA bioma (la primera de su tramo). Se usa para el aviso
// grande de entrada, que solo tiene sentido una vez.
export function entraBioma(wave) {
  return BIOMAS.some(b => b.from === wave);
}

// Los dos jefes de un bioma, en orden: el primero en su ola 5 y el segundo en
// la 10. Asi la pelea final de cada tramo es siempre la mas dura de las dos.
export function bossFor(wave) {
  const b = biomaFor(wave);
  const dentro = wave - b.from;          // 0..9 dentro del tramo
  return dentro < 5 ? b.bosses[0] : b.bosses[1];
}

// ---------- Los fondos ----------
// Cada fondo recibe el contexto, el tamaño del lienzo, el tiempo y sus colores.
// Se dibujan ENTEROS cada frame, asi que todos estan pensados para costar poco:
// nada de sombras, ni gradientes por elemento, ni bucles de cientos de cosas.

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}

// LA DUDA: bancos de niebla que cruzan despacio. Es el bioma de entrada, asi
// que el fondo tiene que ser tranquilo y no robar atencion.
function niebla(g, w, h, t, col) {
  for (let i = 0; i < 5; i++) {
    const y = (i * 53 + 18) % h;
    const x = ((t * (8 + i * 3) + i * 140) % (w + 220)) - 110;
    const a = 0.05 + (i % 3) * 0.018;
    g.fillStyle = rgba(col[0], a);
    g.beginPath();
    g.ellipse(x, y, 95, 20 + i * 4, 0, 0, 7);
    g.fill();
  }
}

// EL VACIO: campo de estrellas cayendo, en tres capas a distinta velocidad. La
// profundidad la da la velocidad, no el tamaño.
function estrellas(g, w, h, t, col) {
  for (let capa = 0; capa < 3; capa++) {
    const n = 14 - capa * 3;
    const vel = 10 + capa * 16;
    const s = capa === 0 ? 1 : 2;
    g.fillStyle = rgba(capa === 2 ? col[1] : col[0], 0.20 + capa * 0.16);
    for (let i = 0; i < n; i++) {
      // Posiciones deterministas: el mismo numero da siempre la misma estrella,
      // asi no hace falta guardar un array ni sembrar un rng.
      const x = ((i * 97 + capa * 43) % w);
      const y = ((i * 61 + capa * 29 + t * vel) % (h + 8)) - 4;
      g.fillRect(x, y, s, s);
    }
  }
}

// LA MENTIRA: franjas verticales que laten y se desplazan, como un reflejo que
// no termina de cuadrar. Nada esta donde parece.
function espejos(g, w, h, t, col) {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * w + Math.sin(t * 0.7 + i * 1.3) * 14;
    const bw = 22 + Math.sin(t * 1.1 + i) * 8;
    g.fillStyle = rgba(i % 2 ? col[0] : col[1], 0.045 + Math.sin(t * 2 + i) * 0.022);
    g.fillRect(x - bw / 2, 0, bw, h);
  }
}

// EL SILENCIO: burbujas subiendo y una presion que aprieta desde los bordes.
// Es el bioma mas oscuro; el fondo tiene que dar sensacion de hundirse.
function profundidad(g, w, h, t, col) {
  // Presion: dos sombras laterales que respiran.
  const p = 0.10 + Math.sin(t * 0.8) * 0.03;
  const lg = g.createLinearGradient(0, 0, w, 0);
  lg.addColorStop(0, rgba(col[1], p));
  lg.addColorStop(0.5, 'rgba(0,0,0,0)');
  lg.addColorStop(1, rgba(col[1], p));
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  // Burbujas.
  for (let i = 0; i < 11; i++) {
    const x = (i * 71 % w) + Math.sin(t * 0.9 + i) * 9;
    const y = h - ((i * 47 + t * (14 + i % 5 * 6)) % (h + 20));
    const r = 1.5 + (i % 4);
    g.strokeStyle = rgba(col[0], 0.16);
    g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
  }
}

// EL ABANDONO: ceniza cayendo y un resplandor rojo abajo, como una casa que
// acaba de arder. Es el ultimo bioma: tiene que verse ya sin vuelta atras.
function ceniza(g, w, h, t, col) {
  const brasa = g.createLinearGradient(0, h, 0, h * 0.45);
  brasa.addColorStop(0, rgba(col[0], 0.16 + Math.sin(t * 1.6) * 0.04));
  brasa.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = brasa;
  g.fillRect(0, h * 0.45, w, h * 0.55);

  for (let i = 0; i < 20; i++) {
    const x = ((i * 83) % w) + Math.sin(t * 0.6 + i * 0.7) * 16;
    const y = ((i * 53 + t * (11 + i % 4 * 5)) % (h + 10)) - 5;
    g.fillStyle = rgba(i % 3 ? col[1] : col[0], 0.13 + (i % 3) * 0.06);
    g.fillRect(x, y, 2, 2);
  }
}

const FONDOS = { niebla, estrellas, espejos, profundidad, ceniza };

// Dibuja el fondo del bioma. `mezcla` de 0 a 1 sirve para fundir un bioma con
// el siguiente mientras se cambia de tramo.
export function drawBioma(g, bioma, w, h, t, alpha = 1) {
  const f = FONDOS[bioma.bg];
  if (!f) return;
  g.save();
  g.globalAlpha = alpha;
  f(g, w, h, t, bioma.col);
  g.restore();
}
