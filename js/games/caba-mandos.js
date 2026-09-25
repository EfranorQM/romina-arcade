// LOS MANDOS de ROMINA: donde va cada boton, a quien le toca cada toque y
// cuanto pulgar pide el stick. SIN DOM: la escena (caballero.js) los usa tal
// cual y tools/prueba-mandos.mjs los mide.
//
// POR QUE SE REHICIERON (24-09-2026). Ella y Anderson: "el tamaño o posicion
// de los botones no es lo suficientemente rapido o comodo". Medido sobre los
// de antes:
//   - los medallones median 7.7-9.7 mm en el telefono, menos que la yema de un
//     pulgar (10-14 mm): habia que APUNTAR;
//   - el 46 % del rectangulo de los botones no era de ninguno: un toque que
//     caia entre dos no hacia nada;
//   - GUARDIA, que se miraba antes, se quedaba el 8 % de la zona de SALTAR;
//   - SALTAR, el boton de los fosos, estaba arriba del todo: con GUARDIA, el
//     mas lejos del pulgar.
//
// AHORA, DOS COLUMNAS. A la izquierda LA ESPADA: GUARDIA encima de ATACAR (de
// la parada al contraataque se baja el pulgar). A la derecha LAS PIERNAS:
// ESQUIVAR encima de SALTAR. Abajo los dos que mas se pulsan, grandes; arriba
// los dos de defenderse. Y SIN HUECOS: cada toque va al boton mas cercano (a su
// BORDE, no a su centro: no miden lo mismo) hasta ZONA px fuera de el.

// Milimetros por px del lienzo en el Redmi Note 10 de ella (409 ppi, el
// lienzo de 1200 estirado x1.95): para hablar de tamaños de pulgar.
export const MM = 0.121;

export const BOTONES = {
  guardia:  { x: 982,  y: 338, r: 42 },
  esquivar: { x: 1114, y: 338, r: 42 },
  atacar:   { x: 982,  y: 460, r: 48 },
  saltar:   { x: 1114, y: 460, r: 48 },
};
// Hasta donde, fuera del dibujo, un toque sigue siendo del boton mas cercano.
export const ZONA = 64;

// A que boton le toca un toque en (x, y): el de borde mas cercano, o null si
// cae lejos de todos. `botones` = { nombre: {x, y, r} } (valen los Button).
export function aQuien(x, y, botones = BOTONES) {
  let mejor = null, dm = Infinity;
  for (const k in botones) {
    const b = botones[k], d = Math.hypot(x - b.x, y - b.y) - b.r;
    if (d < dm) { dm = d; mejor = k; }
  }
  return dm <= ZONA ? mejor : null;
}

// ---------- EL STICK ----------
// Antes pedia 80 px de pulgar (casi 1 cm) para correr a tope, y la velocidad
// iba en proporcion: con el pulgar a medias corria a medias, y el salto de
// una Romina que corre al 70 % no cruza ningun foso del bosque (medido). En un
// juego de lado no hace falta andar despacio: ahora corre a tope con 36 px
// (4.4 mm) y el radio es 60, asi que darse la vuelta tambien pide menos
// recorrido. Por debajo de 12 px (1.5 mm) no se mueve: el temblor del pulgar
// apoyado no la arrastra.
export const STICK_R = 60, STICK_MUERTO = 12;
export const STICK_TOPE = 0.6;         // a esta fraccion del radio ya corre a tope

// Del stick (-1..1, lineal con el pulgar) a lo que manda a ella.
export function curvaStick(dx) {
  const a = Math.abs(dx);
  return a > 0 ? Math.sign(dx) * Math.min(1, a / STICK_TOPE) : 0;
}
