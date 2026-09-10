// SURVIVAL — las definiciones: quien es cada enemigo, cada jefe y cada poder.
//
// Portado del juego que ya existia en HTML (Romina-main/survival/config.js).
// Los numeros de vida, puntos y cadencia se conservan tal cual porque estaban
// probados jugando; lo que cambia es la VELOCIDAD, que alli iba en porcentaje
// de pantalla por milisegundo y aqui va en pixeles del lienzo por segundo.

// El lienzo del juego. Apaisado, como el original: 20:9 acostado.
export const VW = 600, VH = 270;

// La linea que Roma defiende. Si un enemigo la cruza, ella pierde una vida.
// Roma va 26 px por encima del borde: con menos, su nombre se salia del lienzo
// y ella quedaba pegada al canto de la pantalla.
export const LINE_Y = VH - 44;
export const ROMA_Y = VH - 28;

// ---------- La tropa ----------
// speed va en pixeles por segundo hacia abajo. Los numeros son casi el doble
// que en el juego original: alli la arena era mucho mas alta en proporcion, y
// al traerlos tal cual un enemigo tardaba QUINCE segundos en cruzar y una ola
// entera veinticinco. Medido con tools/prueba-partida.mjs: ahora cruza en ~8 s
// y la ola dura ~15, que es el ritmo que tenia el juego en el navegador.
export const ENEMIES = {
  duda: {
    name: 'DUDA', hp: 1, speed: 28, score: 10, r: 15,
    move: 'straight',
  },
  olvido: {
    name: 'OLVIDO', hp: 2, speed: 23, score: 25, r: 15,
    move: 'zigzag', shoots: 0.30, aims: true,
  },
  tristeza: {
    name: 'TRISTEZA', hp: 3, speed: 19, score: 40, r: 16,
    move: 'sine', shoots: 0.40, aims: true, burst: 3,
  },
  dasher: {
    name: 'RELAMPAGO', hp: 2, speed: 21, score: 50, r: 14,
    move: 'straight', dash: { every: 2.2, dur: 0.6, mult: 4 }, kamikaze: true,
  },
  tracker: {
    name: 'TRACKER', hp: 2, speed: 17, score: 60, r: 15,
    move: 'sine', shoots: 0.40, tracks: true,
  },
  muro: {
    name: 'MURO', hp: 4, speed: 13, score: 80, r: 18,
    move: 'straight', shielded: true, shieldHp: 4,
  },
  divisor: {
    name: 'DIVISOR', hp: 3, speed: 21, score: 70, r: 16,
    move: 'zigzag', splits: 'duda', splitCount: 2, kamikaze: true,
  },
};

// ---------- Los diez jefes ----------
// Cada uno tiene UNA habilidad que lo hace distinto de pelear. Los avisos son
// los del juego original: ella ya los conoce.
export const BOSSES = {
  celos: {
    name: 'CELOS', hp: 15, speed: 15, score: 250, r: 22, boss: true,
    shoots: 1.5, ability: 'fanShot', cd: 4,
    announce: 'LOS CELOS APARECEN',
  },
  rutina: {
    name: 'RUTINA', hp: 25, speed: 13, score: 500, r: 24, boss: true,
    shoots: 1.8, ability: 'parallelLines', cd: 6,
    announce: 'LA RUTINA ATACA',
  },
  inseguridad: {
    name: 'INSEGURIDAD', hp: 35, speed: 17, score: 800, r: 26, boss: true,
    shoots: 2.0, ability: 'circleBurst', cd: 6,
    announce: 'LA INSEGURIDAD INVADE',
  },
  miedo: {
    name: 'MIEDO', hp: 30, speed: 13, score: 600, r: 24, boss: true,
    shoots: 1.2, ability: 'summonDudas',
    announce: 'EL MIEDO SE MANIFIESTA',
  },
  mentira: {
    name: 'MENTIRA', hp: 28, speed: 15, score: 700, r: 22, boss: true,
    shoots: 1.5, ability: 'invisibility', visible: 5, invisible: 3,
    announce: 'LA MENTIRA TE MIENTE',
  },
  silencio: {
    name: 'SILENCIO', hp: 32, speed: 11, score: 700, r: 25, boss: true,
    shoots: 1.4, ability: 'silenceAura', aura: 120,
    announce: 'EL SILENCIO TE ENVUELVE',
  },
  vicio: {
    name: 'VICIO', hp: 26, speed: 13, score: 750, r: 23, boss: true,
    shoots: 1.8, ability: 'snakeMove',
    announce: 'EL VICIO TE TIENTA',
  },
  tiempo: {
    name: 'TIEMPO', hp: 30, speed: 13, score: 850, r: 23, boss: true,
    shoots: 1.2, ability: 'rewindBullets', cd: 7,
    announce: 'EL TIEMPO SE DETIENE',
  },
  abandono: {
    name: 'ABANDONO', hp: 35, speed: 13, score: 800, r: 24, boss: true,
    shoots: 1.4, ability: 'twoPhases',
    announce: 'EL ABANDONO LLEGA',
  },
  ego: {
    name: 'EGO', hp: 28, speed: 15, score: 750, r: 23, boss: true,
    shoots: 1.2, ability: 'spawnClone', cd: 10,
    announce: 'EL EGO TE REFLEJA',
  },
};

export const BOSS_IDS = Object.keys(BOSSES);

// ---------- Los poderes ----------
export const POWERUPS = [
  { type: 'double', label: 'DOBLE',  color: '#ffe66d', dur: 8 },
  { type: 'mega',   label: 'MEGA',   color: '#ff3ec9', dur: 5 },
  { type: 'shield', label: 'ESCUDO', color: '#6bf0ff', dur: 3 },
  { type: 'turbo',  label: 'TURBO',  color: '#b06bff', dur: 5 },
];

// ---------- Reglas ----------
export const RULES = {
  lives: 3,
  invulnerable: 1.5,        // segundos de gracia tras recibir un golpe
  bombCooldown: 25,
  // Uno de cada tres enemigos suelta un poder. Con el 0.10 del original salia
  // MEDIO poder por ola en las primeras y casi nunca se veia uno: alli las
  // olas eran mucho mas largas y daba tiempo. Medido: con 0.33 salen dos por
  // ola desde el principio y cinco o seis en las olas altas.
  dropChance: 0.33,
  bossDropChance: 1,
  // Los jefes sueltan varios de golpe: es el premio de una pelea larga.
  bossDropCount: 3,
  bossHpPerWave: 0.08,       // solo los jefes endurecen con la ola
  shotCooldown: 0.25,
  turboCooldown: 0.10,
  romaSpeed: 190,           // px/s
  bulletSpeed: 330,
  enemyBulletSpeed: 105,
};

// Las frases entre olas y al perder. Son las del original: las escribio el.
export const WAVE_PHRASES = [
  'LA DUDA SE ACERCA',
  'RESISTE MI AMOR',
  'NO LAS DEJES PASAR',
  'VIENEN MAS',
  'AGUANTA',
  'ERES MAS FUERTE QUE ESTO',
  'POR NOSOTROS',
];

export const GAMEOVER_MSGS = [
  ['CAISTE PERO', 'EL AMOR NO'],
  ['NADIE LLEGA LEJOS SOLO', 'ESTOY CONTIGO SIEMPRE'],
  ['HASTA LOS MAS FUERTES', 'CAEN. LEVANTATE'],
  ['ERES MI GUERRERA', 'OTRA VEZ'],
  ['CADA CAIDA ES UNA', 'HISTORIA QUE CONTAR'],
];

// Multiplicador de puntos por combo, igual que en el original.
export function comboMult(c) {
  if (c >= 30) return 4;
  if (c >= 20) return 3;
  if (c >= 10) return 2;
  if (c >= 5) return 1.5;
  return 1;
}

// Que enemigos pueden salir en cada ola. Van entrando poco a poco para que
// ella aprenda a pelear con cada uno antes de que se mezclen todos.
export function poolForWave(w) {
  if (w <= 2) return ['duda'];
  if (w <= 3) return ['duda', 'duda', 'olvido'];
  if (w <= 4) return ['duda', 'duda', 'olvido', 'dasher'];
  if (w <= 6) return ['duda', 'duda', 'olvido', 'tristeza', 'dasher', 'tracker'];
  if (w <= 8) return ['duda', 'olvido', 'tristeza', 'dasher', 'tracker', 'muro'];
  if (w <= 11) return ['duda', 'olvido', 'tristeza', 'dasher', 'tracker', 'muro', 'divisor'];
  return ['duda', 'olvido', 'tristeza', 'dasher', 'dasher', 'tracker', 'muro', 'divisor'];
}
