// FURIA - los cuatro biomas y los cuatro cielos, y que nivel lleva cada cosa.
//
// Un BIOMA es el suelo y lo que crece en el: colores de la hierba, de la pista
// y de las capas del corte; que color toma cada material de los modelos de
// Kenney (moto-kenney.js: las hojas, la corteza, la piedra...); y que se planta
// en cada franja de profundidad. Un CIELO es la luz: colores del cielo, niebla,
// sol, estrellas. Los ocho niveles combinan los dos, asi el nivel 5 es la
// misma pradera que el 1 pero al atardecer.
//
// Los colores van en sRGB (hex); three.js los pasa a lineal al leerlos.

export const CIELOS = {
  mediodia: { nombre: 'MEDIODIA', cielo: ['#2f7fd6', '#86c2ee', '#e3f1f4'], niebla: '#cfe2ea', nieblaLejos: 330,
    sol: '#fff1d0', solI: 2.6, solDir: [0.35, 0.85, 0.55], disco: [0.8, 0.95], discoCol: '#fff6dc',
    cieloL: '#cfe6ff', sueloL: '#6b5a3a', hemiI: 1.25, nube: '#ffffff', estrellas: false, faro: false, exp: 1.05,
    monte: ['#6f98bf', '#9ab8d2'] },
  atardecer: { nombre: 'ATARDECER', cielo: ['#2b1d5e', '#b8456b', '#ffb070'], niebla: '#d9807a', nieblaLejos: 300,
    sol: '#ffc98a', solI: 2.4, solDir: [-0.3, 0.45, 0.75], disco: [0.72, 0.5], discoCol: '#ffe0a0',
    cieloL: '#ffb8a0', sueloL: '#3a2440', hemiI: 1.0, nube: '#ffb4a0', estrellas: false, faro: false, exp: 1.08,
    monte: ['#6a3a6e', '#a0507a'] },
  noche: { nombre: 'NOCHE', cielo: ['#040818', '#0f1f48', '#2c4380'], niebla: '#15244c', nieblaLejos: 250,
    sol: '#c4dcff', solI: 2.1, solDir: [0.4, 0.75, 0.55], disco: [0.28, 0.8], discoCol: '#e8f2ff',
    cieloL: '#6a88d0', sueloL: '#141a34', hemiI: 1.2, nube: '#3a4a7a', estrellas: true, faro: true, exp: 1.1,
    monte: ['#1a2750', '#26356a'] },
  amanecer: { nombre: 'AMANECER', cielo: ['#3a5a9a', '#e8a0a0', '#ffd9a0'], niebla: '#eebfa8', nieblaLejos: 310,
    sol: '#ffe0b0', solI: 2.4, solDir: [0.55, 0.4, 0.6], disco: [0.22, 0.5], discoCol: '#fff0c8',
    cieloL: '#ffd0c0', sueloL: '#4a3a40', hemiI: 1.1, nube: '#fff0f0', estrellas: false, faro: false, exp: 1.05,
    monte: ['#8a7aa8', '#b89ab8'] },
};

// Colores comunes a todos: lo fabricado (vallas, gradas, carpas, conos) no
// cambia con el bioma.
const COMUNES = {
  wood: '#c98a52', woodDark: '#8a5a34', woodInner: '#f0d6a8', red: '#e84a4a', grey: '#f2f2f4',
  road: '#4a4a50', pylon: '#ff9a2a', colorRed: '#e8434c', colorYellow: '#ffcf3a',
  colorPurple: '#a47cff', colorTan: '#f0c08a', _defaultMat: '#ece6da',
};

// Franjas donde se planta (z en metros; la pista va de +1.6 a -1.6 y la
// camara esta en +z):
//   borde:  pegado a la pista, detras: matas, flores, piedras. Da sombra.
//   cerca:  de 3 a 12 m: arbustos, tocones, vallas, rocas medianas. Sombra.
//   medio:  de 12 a 45 m: los arboles.
//   lejos:  de 45 a 110 m: arboles mas sueltos y, en el cañon, las mesetas.
// Cada lista es [modelo, peso, escala min, escala max]. `cada` es el paso
// medio en metros a lo largo de la pista.
export const BIOMAS = {
  pradera: {
    nombre: 'PRADERA', barro: 'BARRO', colBarro: '#5a3a22', particulas: 'polvo',
    hierba: '#78b04a', hierba2: '#5a9036', tierra: '#b5895a', tierra2: '#96693f',
    estratos: ['#4c3a22', '#6e4a2c', '#a4673a', '#c68b52', '#8b8d8f', '#5f6369'],
    mats: { woodBark: '#8a5a3a', leafsGreen: '#5fae4a', leafsDark: '#3f8a4a', woodBarkDark: '#6e4a32',
            dirt: '#9c9ca4', grass: '#6fae45' },
    borde: { cada: 0.8, lista: [['grass', 3, 1.2, 1.9], ['grass_leafs', 3, 1.4, 2.2], ['flower_redA', 2, 1.3, 1.8],
      ['flower_yellowA', 2, 1.3, 1.8], ['flower_purpleA', 2, 1.3, 1.8], ['rock_smallA', 1, 0.9, 1.4], ['plant_bushSmall', 2, 1.2, 1.8]] },
    cerca: { cada: 2.2, lista: [['plant_bush', 3, 2, 3], ['plant_bushLarge', 2, 2, 3], ['plant_bushDetailed', 2, 1.8, 2.6],
      ['rock_largeA', 1, 1.8, 2.8], ['rock_largeC', 1, 1.8, 2.8], ['stump_round', 1, 2, 3], ['log_large', 0.6, 1.8, 2.4],
      ['mushroom_red', 0.6, 2, 3], ['flower_redA', 2, 1.6, 2.2], ['flower_yellowA', 2, 1.6, 2.2]] },
    medio: { cada: 2.0, lista: [['tree_default', 3, 3, 4.5], ['tree_oak', 3, 3.4, 4.6], ['tree_fat', 2, 3.2, 4.4],
      ['tree_tall', 2, 3, 4.2], ['tree_cone', 1, 3, 4], ['tree_simple', 1, 3, 4], ['tree_pineRoundA', 1, 3.2, 4.4],
      ['plant_bushLarge', 1, 3, 4], ['rock_largeB', 0.6, 3, 4.5]] },
    lejos: { cada: 3.2, lista: [['tree_default', 3, 4, 6], ['tree_oak', 2, 4, 6], ['tree_tall', 2, 4, 6], ['tree_pineRoundA', 1, 4, 6]] },
    vallas: true,
  },
  canon: {
    nombre: 'CAÑON', barro: 'ARENA', colBarro: '#e0b070', particulas: 'polvo',
    hierba: '#c98a4a', hierba2: '#a86a36', tierra: '#dca46c', tierra2: '#bc844e',
    estratos: ['#8a3a22', '#b24e2c', '#d4743e', '#e8a060', '#c46a44', '#8a4a3a'],
    mats: { woodBark: '#7a5236', leafsGreen: '#7ea34a', leafsDark: '#6e8a3a', woodBarkDark: '#6a4630',
            dirt: '#c4643a', grass: '#e0a868' },
    borde: { cada: 0.9, lista: [['rock_smallA', 2, 1, 1.6], ['rock_smallB', 2, 1, 1.6], ['rock_smallC', 2, 1, 1.6],
      ['plant_bushSmall', 1, 1.2, 1.8], ['grass_leafs', 1, 1.4, 2]] },
    cerca: { cada: 2.6, lista: [['cactus_short', 3, 2.4, 3.4], ['cactus_tall', 2, 2.6, 3.6], ['rock_largeA', 2, 2, 3.2],
      ['rock_largeB', 2, 2, 3], ['rock_largeC', 2, 2, 3.2], ['plant_bushSmall', 2, 2, 3], ['stump_old', 0.5, 2, 3]] },
    medio: { cada: 3.0, lista: [['cactus_tall', 3, 3.4, 5], ['cactus_short', 2, 3.4, 4.6], ['tree_plateau', 2, 3.6, 5],
      ['rock_tallC', 2, 3, 5], ['rock_largeB', 2, 3.4, 5]] },
    lejos: { cada: 5.5, lista: [['rock_tallA', 3, 9, 16], ['rock_tallB', 3, 9, 16], ['rock_tallC', 2, 8, 13], ['tree_plateau', 1, 4, 6]] },
    vallas: false,
  },
  bosque: {
    nombre: 'BOSQUE', barro: 'BARRO', colBarro: '#4a3222', particulas: 'luciernagas',
    hierba: '#4a7a4e', hierba2: '#355e3c', tierra: '#8a7058', tierra2: '#6a5642',
    estratos: ['#2e2620', '#44342a', '#5e4838', '#7a5e48', '#56585e', '#3a3c44'],
    mats: { woodBark: '#6a4632', leafsGreen: '#3e7a4e', leafsDark: '#2f6e4c', woodBarkDark: '#5a3e2c',
            dirt: '#86868e', grass: '#467a52' },
    borde: { cada: 0.85, lista: [['grass', 3, 1.2, 1.9], ['grass_leafs', 3, 1.4, 2.2], ['mushroom_red', 2, 1.4, 2],
      ['mushroom_tan', 2, 1.4, 2], ['rock_smallB', 1, 0.9, 1.4], ['grass_leafs', 2, 1.4, 2]] },
    cerca: { cada: 2.0, lista: [['plant_bush', 2, 2, 3], ['plant_bushDetailed', 2, 1.8, 2.6], ['stump_old', 2, 2, 3],
      ['stump_round', 1, 2, 3], ['log_large', 1.5, 2, 2.6], ['mushroom_red', 2, 2.4, 3.2], ['mushroom_tan', 1, 2.4, 3.2],
      ['tree_pineSmallA', 2, 2.6, 3.6], ['rock_largeA', 1, 2, 3]] },
    medio: { cada: 1.3, lista: [['tree_pineDefaultA', 3, 3.4, 4.6], ['tree_pineRoundA', 2, 3.4, 4.6], ['tree_pineRoundC', 2, 3.4, 4.6],
      ['tree_pineTallA_detailed', 3, 3.6, 5], ['tree_pineTallB_detailed', 3, 3.4, 4.6], ['tree_pineSmallA', 1, 3.4, 4.4]] },
    lejos: { cada: 2.2, lista: [['tree_pineTallA_detailed', 3, 4.5, 6.5], ['tree_pineTallB_detailed', 3, 4.5, 6.5], ['tree_pineDefaultA', 2, 4.5, 6]] },
    vallas: false, campamento: true,
  },
  nieve: {
    nombre: 'NIEVE', barro: 'NIEVE', colBarro: '#f4f8fc', particulas: 'nieve', nevado: true,
    hierba: '#eef3f8', hierba2: '#d2dee9', tierra: '#c2b8b0', tierra2: '#a09286',
    estratos: ['#e6edf4', '#b4c6d8', '#8aa0b8', '#6a7a90', '#4e5a6c', '#3a4252'],
    mats: { woodBark: '#6a4a36', leafsGreen: '#3e6e5a', leafsDark: '#2e5e52', woodBarkDark: '#5a3e30',
            dirt: '#8e96a2', grass: '#e8eef4' },
    borde: { cada: 1.1, lista: [['rock_smallA', 2, 1, 1.6], ['rock_smallC', 2, 1, 1.6], ['grass_leafs', 1, 1.2, 1.8]] },
    cerca: { cada: 2.4, lista: [['tree_pineSmallA', 3, 2.6, 3.6], ['rock_largeA', 2, 2, 3], ['rock_largeB', 2, 2, 3],
      ['stump_round', 1, 2, 3], ['log_large', 1, 2, 2.6]] },
    medio: { cada: 1.6, lista: [['tree_pineDefaultA', 3, 3.4, 4.6], ['tree_pineRoundA', 2, 3.4, 4.6], ['tree_pineRoundC', 2, 3.4, 4.6],
      ['tree_pineTallA_detailed', 2, 3.6, 5], ['rock_tallB', 1, 3, 4.5]] },
    lejos: { cada: 2.6, lista: [['tree_pineTallA_detailed', 3, 4.5, 6.5], ['tree_pineDefaultA', 3, 4.5, 6], ['rock_tallA', 1, 6, 10]] },
    vallas: false,
  },
};

// Los ocho niveles: bioma y cielo.
const NIVELES = [
  ['pradera', 'mediodia'], ['canon', 'atardecer'], ['bosque', 'noche'], ['nieve', 'amanecer'],
  ['pradera', 'atardecer'], ['canon', 'mediodia'], ['bosque', 'amanecer'], ['nieve', 'noche'],
];

// El mundo de un nivel: bioma + cielo, y los colores de cada material ya
// resueltos (los comunes, pisados por los del bioma).
export function mundo(n) {
  const [b, c] = NIVELES[(n - 1) % NIVELES.length];
  const bioma = BIOMAS[b], cielo = CIELOS[c];
  return { id: b, bioma, cielo, mats: { ...COMUNES, ...bioma.mats }, nombre: bioma.nombre + ' - ' + cielo.nombre };
}
