// SURVIVAL — las habilidades del roguelike: que hace cada una y como se ven.
//
// Se eligen TRAS CADA JEFE (olas 5, 10, 15...), no entre olas normales: asi la
// recompensa se siente ganada. Salen tres cartas y se elige una.
//
// La repeticion se resuelve con NIVELES en vez de descartarse: si vuelve a
// salir una que ya tienes, aparece subida de nivel con el efecto mejorado. Al
// llegar a su tope deja de ofrecerse, asi que nunca hay una carta muerta.
//
// Nada de "+10% de dano": los cuatro poderes temporales (DOBLE, MEGA, ESCUDO,
// TURBO) ya cubren "mas fuerte un rato". Cada habilidad de aqui ROMPE una regla
// que el juego tiene, y todas se enganchan en mecanicas que ya existen.
//
// Los nombres van sin acentos ni EÑE a proposito: la fuente es una bitmap de 58
// glifos (font.js) y lo que no este en ella no se dibuja.

// ---------- Rarezas ----------
// Los colores no son nuevos: el cian es el del ESCUDO, el violeta el del TURBO
// y el dorado el de la BOMBA. Asi las cartas parecen parte del juego desde el
// primer momento.
export const RARITY = {
  comun: {
    id: 'comun', name: 'COMUN', color: '#9fb4c7',
    weight: 55, frame: 'fina',
  },
  rara: {
    id: 'rara', name: 'RARA', color: '#6bf0ff',
    weight: 28, frame: 'doble',
  },
  epica: {
    id: 'epica', name: 'EPICA', color: '#b06bff',
    weight: 13, frame: 'esquinas',
  },
  legendaria: {
    id: 'legendaria', name: 'LEGENDARIA', color: '#ffe14d',
    weight: 4, frame: 'gruesa',
  },
};

// Cuanto mas avanza la partida, mejores rarezas aparecen. `pick` es el numero
// de eleccion (1 = tras el primer jefe). Tras el primero casi todo es comun;
// en el quinto ya salen legendarias. Los pesos se reparten moviendo peso de lo
// comun hacia arriba, no sumando de la nada, para que sigan sumando 100.
export function rarityWeights(pick) {
  const k = Math.min(1, (pick - 1) / 4);        // 0 en la 1a eleccion, 1 en la 5a
  return {
    comun: 55 - 35 * k,
    rara: 28 + 6 * k,
    epica: 13 + 17 * k,
    legendaria: 4 + 12 * k,
  };
}

// ---------- Las habilidades ----------
// `desc` es una funcion del nivel: la carta enseña lo que hara SI la eliges, no
// lo que hace ahora. Las lineas de texto van cortas porque la carta mide 170 px
// y la fuente no parte palabras sola.
export const SKILLS = {
  // ----- COMUNES -----
  perforante: {
    id: 'perforante', name: 'PERFORANTE', rarity: 'comun', max: 3,
    desc: n => n >= 3
      ? ['LA BALA NO SE', 'DETIENE NUNCA']
      : ['LA BALA ATRAVIESA', 'A ' + n + ' ENEMIGO' + (n > 1 ? 'S' : '')],
    // Cuantos enemigos mas puede atravesar una bala antes de apagarse.
    pierce: n => (n >= 3 ? 99 : n),
  },

  iman: {
    id: 'iman', name: 'IMAN', rarity: 'comun', max: 3,
    desc: n => n >= 3
      ? ['LOS PODERES VUELAN', 'DESDE TODA LA ARENA']
      : ['LOS PODERES VUELAN', 'HACIA TI'],
    // Radio en px dentro del cual un poder caido se va hacia Roma.
    //
    // Medido en la app: la distancia horizontal entre Roma y un poder que cae
    // tiene mediana 135 px, el 75% esta bajo 203 y el peor caso ronda 290. Los
    // primeros numeros que puse (70/150) venian a ojo y el nivel 1 no llegaba
    // NUNCA: no se notaba al elegirlo. Ahora N1 alcanza mas de la mitad de los
    // poderes, N2 casi todos y N3 la arena entera.
    range: n => [150, 240, 999][n - 1],
  },

  mecha: {
    id: 'mecha', name: 'MECHA CORTA', rarity: 'comun', max: 3,
    desc: n => ['LA BOMBA RECARGA', 'EN ' + [21, 17, 13][n - 1] + ' SEGUNDOS'],
    cooldown: n => [21, 17, 13][n - 1],
  },

  // ----- RARAS -----
  piel: {
    id: 'piel', name: 'SEGUNDA PIEL', rarity: 'rara', max: 3,
    desc: n => n >= 3
      ? ['ESCUDO CADA OLA', 'AGUANTA DOS GOLPES']
      : n === 2
        ? ['ESCUDO AL EMPEZAR', 'Y A MITAD DE OLA']
        : ['EMPIEZAS CADA OLA', 'CON ESCUDO'],
    charges: n => (n >= 2 ? 2 : 1),      // escudos por ola
    hits: n => (n >= 3 ? 2 : 1),         // golpes que aguanta cada uno
  },

  memoria: {
    id: 'memoria', name: 'MEMORIA', rarity: 'rara', max: 3,
    desc: n => n >= 3
      ? ['EL COMBO YA NO', 'BAJA NUNCA']
      : ['UN GOLPE SOLO QUITA', (n === 1 ? 'LA MITAD' : 'UN TERCIO') + ' DEL COMBO'],
    // Que fraccion del combo SOBREVIVE a un golpe.
    keep: n => [0.5, 0.67, 1][n - 1],
  },

  linea: {
    id: 'linea', name: 'LA LINEA RESISTE', rarity: 'rara', max: 3,
    desc: n => n >= 3
      ? ['AGUANTA 2 CRUCES', 'Y EL QUE CRUZA MUERE']
      : ['LA LINEA AGUANTA', n + ' CRUCE' + (n > 1 ? 'S' : '') + ' POR OLA'],
    blocks: n => (n >= 2 ? 2 : 1),
    kills: n => n >= 3,
  },

  // ----- EPICAS -----
  ardiente: {
    id: 'ardiente', name: 'COMBO ARDIENTE', rarity: 'epica', max: 2,
    desc: n => n >= 2
      ? ['COMBO 10: BALAS', 'MEGA Y DOBLES']
      : ['COMBO 20: TUS BALAS', 'SON MEGA SOLAS'],
    at: n => (n >= 2 ? 10 : 20),
    dbl: n => n >= 2,
  },

  rebote: {
    id: 'rebote', name: 'REBOTE', rarity: 'epica', max: 2,
    desc: n => n >= 2
      ? ['REBOTAN 2 VECES', 'Y PEGAN MAS FUERTE']
      : ['LAS BALAS REBOTAN', 'EN EL TECHO'],
    bounces: n => n,
    stronger: n => n >= 2,
  },

  // ----- LEGENDARIA -----
  otra: {
    id: 'otra', name: 'OTRA OPORTUNIDAD', rarity: 'legendaria', max: 1,
    desc: () => ['AL CAER REVIVES', 'UNA VEZ POR PARTIDA'],
    // No aparece en las dos primeras elecciones: de salir pronto, se llevaria
    // por delante toda la tension de las primeras olas.
    minPick: 3,
  },
};

export const SKILL_IDS = Object.keys(SKILLS);

// ---------- Elegir que tres cartas se ofrecen ----------
// `have` es {id: nivel}. Devuelve hasta tres cartas {skill, level, rarity}.
//
// Se sortea la RAREZA primero y despues una habilidad de esa rareza, en vez de
// sortear entre todas a la vez: asi la rareza de la carta significa algo y la
// progresion por ola se nota. Si una rareza se queda sin candidatas (todas al
// tope), se cae a otra en vez de devolver menos de tres cartas.
export function offerCards(pick, have, rnd) {
  const w = rarityWeights(pick);
  const cards = [];
  const used = new Set();

  // Candidatas de una rareza: las que no esten al tope y cumplan su ola minima.
  const poolOf = (rar) => SKILL_IDS.filter(id => {
    const s = SKILLS[id];
    if (s.rarity !== rar) return false;
    if (used.has(id)) return false;
    if ((have[id] || 0) >= s.max) return false;
    if (s.minPick && pick < s.minPick) return false;
    return true;
  });

  for (let c = 0; c < 3; c++) {
    // Rarezas que hoy tienen algo que ofrecer, con su peso.
    const avail = Object.keys(w).filter(r => poolOf(r).length > 0);
    if (avail.length === 0) break;              // todo al tope: menos de 3 cartas

    const total = avail.reduce((a, r) => a + w[r], 0);
    let roll = rnd() * total, rar = avail[avail.length - 1];
    for (const r of avail) { roll -= w[r]; if (roll <= 0) { rar = r; break; } }

    const pool = poolOf(rar);
    const id = pool[(rnd() * pool.length) | 0];
    used.add(id);
    cards.push({ id, skill: SKILLS[id], level: (have[id] || 0) + 1, rarity: RARITY[rar] });
  }
  return cards;
}
