// SURVIVAL — la vida de Roma.
//
// Roma es un corazon rosa que defiende la linea contra la DUDA, el OLVIDO, los
// CELOS, el ABANDONO: los problemas que amenazan una relacion. Es la unica
// figura del juego que representa a una persona, y la que ella mira todo el
// rato.
//
// Y era lo unico del juego SIN ANIMAR. Las 28 criaturas respiran, se ladean y
// se aplastan (surv-anim.js), y el corazon del medio era un drawImage plano con
// un k=1.15 al recibir. Este archivo lo arregla.
//
// LA REGLA QUE MANDA AQUI: lo epico es CONTRASTE, no cantidad. Si Roma
// estuviera todo el rato haciendo algo, matar a un jefe no se notaria: seria un
// gesto mas entre muchos. Asi que en reposo hace UNA cosa -- latir -- y los
// momentos grandes se ganan el derecho a ser grandes.
//
// Todo sale de datos que el juego YA lleva: padDX, lastShot, hurt, inv, lives,
// combo. No se anade estado de simulacion nuevo salvo la fase del latido.

import { clamp } from '../core.js';
import { LINE_Y, ROMA_Y } from './surv-defs.js';

// ---------- EL LATIDO ----------
// Un corazon no hace una onda senoidal: hace lub-dub. Dos golpes seguidos y una
// pausa larga. La diferencia se nota: un seno parece que RESPIRA, y esto LATE.
//
// Se suman dos gaussianas, la segunda mas baja y mas corta, y el 65% del ciclo
// queda plano. Comparado con un seno a la misma frecuencia:
//
//   fase   0.00  0.05  0.10  0.15  0.20  0.25  0.30  0.40  0.60  0.80
//   lub    1.00  0.63  0.43  0.60  0.47  0.17  0.03  0.00  0.00  0.00
//   seno   0.50  0.66  0.79  0.90  0.97  1.00  0.97  0.79  0.21  0.03
//
// El seno nunca esta quieto; el latido se calla entre golpe y golpe, que es
// justo lo que lo hace leerse como un corazon.
function pulso(fase) {
  const g = (c, w) => Math.exp(-((fase - c) * (fase - c)) / (2 * w * w));
  return g(0, 0.045) + g(0.16, 0.055) * 0.62;
}

// A que ritmo late, en ciclos por segundo, segun lo mal que se este pasando.
//
// Un corazon humano en reposo va a 60-70 lpm y con miedo a 150-170. Aqui se usa
// ese mismo rango y lo mueven dos cosas: lo cerca que esta el enemigo mas
// adelantado de la linea que ella defiende, y si le queda una sola vida.
//
//   nada cerca, 3 vidas ............  69 lpm
//   algo a media altura ............  96 lpm
//   algo justo encima de la linea ... 118 lpm
//   ultima vida, nada cerca ........ 102 lpm
//   ultima vida y algo encima ...... 151 lpm
//
// Asi el latido CUENTA lo que pasa sin un solo cartel: ella nota que el corazon
// se le acelera antes de mirar cuantas vidas le quedan.
export function ritmo(juego) {
  let prox = 0;
  for (const e of juego.enemies) {
    // 0 arriba del todo, 1 pegado a la linea. Solo cuenta el mas adelantado.
    const p = clamp(e.y / LINE_Y, 0, 1);
    if (p > prox) prox = p;
  }
  const ultima = juego.lives <= 1 ? 0.55 : 0;
  return 1.15 + prox * 0.9 + ultima;
}

// ---------- LA POSE ----------
// Devuelve como hay que dibujar a Roma AHORA: escala por eje, giro y
// desplazamiento. El juego solo tiene que aplicarlo, igual que hace con pose()
// de los enemigos.
//
// `st` es el estado que vive en el juego (fase del latido y ladeo suavizado).
export function poseRoma(juego, st) {
  const r = juego.roma;

  // 1) EL LATIDO. Conserva el volumen -- lo que se gana de alto se pierde de
  // ancho -- que es lo que hace que parezca carne y no una imagen escalandose.
  const lat = pulso(st.fase);
  let sx = 1 - lat * 0.055;
  let sy = 1 + lat * 0.075;

  // 2) EL LADEO hacia donde corre. Sale de padDX, que el pad ya deja entre -1 y
  // 1 con zona muerta, pero suavizado en el update: si se usara crudo, el
  // corazon daria un tiron al soltar el dedo en vez de enderezarse.
  //
  // El tope son 0.20 rad (11.5 grados) y NO es un numero de gusto: con 15
  // grados la punta del corazon se sale de la burbuja del escudo (radio 20) y
  // se la ve atravesando su propia proteccion.
  const rot = st.ladeo * 0.20;

  // 3) EL RETROCESO al disparar. Se encoge un instante, como un arma.
  //
  // La duracion se ESCALA con la cadencia, y eso es obligatorio: con TURBO y
  // REFLEJO 3 el juego dispara cada 0.0333 s (30 tiros por segundo), asi que un
  // retroceso fijo de 0.13 s se solaparia 3.9 veces y Roma se quedaria
  // encogida para siempre en vez de verse retroceder. Medido: con esa build el
  // suelo del efecto era del 55% y la media del 77%.
  //
  // Ahora dura como mucho la mitad del intervalo entre tiros, asi que SIEMPRE
  // termina antes del siguiente y siempre se ve el gesto completo.
  const desde = juego.t - r.lastShot;
  const dur = Math.min(0.11, st.cadencia * 0.5);
  if (desde >= 0 && desde < dur) {
    const p = 1 - desde / dur;         // 1 recien disparado, 0 al terminar
    const k = p * p;                   // se va rapido: es un golpe seco
    sy *= 1 - k * 0.13;
    sx *= 1 + k * 0.10;
  }

  // 4) EL GOLPE. Antes era k = 1.15 a secas: un cambio de tamano sin curva, que
  // se lee como un fallo de dibujado y no como un impacto. Ahora es un rebote
  // que se calma, con el corazon aplastado al principio.
  if (r.hurt > 0) {
    const p = clamp(r.hurt / 0.5, 0, 1);         // 1 recien golpeada
    const reb = Math.cos(p * 18) * p * p;        // oscila y se apaga
    sx *= 1 + 0.26 * p + reb * 0.10;
    sy *= 1 - 0.18 * p - reb * 0.10;
  }

  // 5) LA ULTIMA VIDA. El corazon late mas hondo, no solo mas rapido. Es el
  // momento mas tenso de la partida y hasta ahora no pasaba absolutamente nada.
  if (juego.lives <= 1 && !juego.over) {
    sx -= lat * 0.045;
    sy += lat * 0.055;
  }

  return { sx, sy, rot };
}

// ---------- LO QUE SE VE DEBAJO ----------
// Cuanto brilla Roma por debajo del cuerpo, de 0 a 1. El motor ya pasa un bloom
// por frame (bloom.js), asi que lo que se dibuje claro aqui florece solo: no
// hace falta ni un shadowBlur.
//
// Tiene tres sumandos y ninguno parpadea deprisa: en partidas largas un
// parpadeo rapido cansa la vista.
export function brilloRoma(juego, st) {
  // El latido, que es el que manda.
  let b = 0.30 + pulso(st.fase) * 0.34;
  // El combo: cuanto mas alta la racha, mas encendida esta. Tope a los 12
  // aciertos para que no crezca sin fin.
  b += clamp(juego.combo / 12, 0, 1) * 0.30;
  // La ultima vida la enciende aunque no tenga combo: es su ultimo pulso.
  if (juego.lives <= 1 && !juego.over) b += 0.22;
  return clamp(b, 0, 1.15);
}

// ---------- LA INVULNERABILIDAD ----------
// ESTO ERA UN FALLO, y de los que se notan. El juego hacia:
//
//     if (r.inv > 0 && Math.sin(this.t * 30) < 0) return;
//
// o sea que durante el segundo y medio de gracia NO LA DIBUJABA la mitad de los
// frames. Medido: 7 apagones a 4.77 Hz, 0.75 s invisible de cada golpe. Justo
// despues de que la golpean -- que es cuando mas falta le hace ver donde esta --
// su personaje no estaba en pantalla. Y 4.8 Hz es de las frecuencias que mas
// cansan la vista.
//
// Ahora NUNCA desaparece: se vuelve translucida y oscila suave entre 0.55 y
// 1.0, que se lee igual de bien como "ahora no te pueden tocar" y deja verla
// siempre. Ademas late mas fuerte, y eso ya lo pone poseRoma con r.hurt.
export function alphaRoma(juego) {
  const r = juego.roma;
  if (r.inv <= 0) return 1;
  return 0.55 + (Math.sin(juego.t * 16) * 0.5 + 0.5) * 0.45;
}

// ---------- EL ESTADO ----------
// Vive en el juego y se actualiza en update(), NUNCA en draw(). Es la leccion
// del destello de la bomba: lo que se actualiza al dibujar va al ritmo de la
// pantalla, asi que en un telefono de 120 Hz corre al doble de velocidad.
export function mkEstadoRoma() {
  return { fase: 0, ladeo: 0, cadencia: 0.28 };
}

export function updateRoma(juego, st, dt) {
  // El latido avanza con el ritmo que toque. La fase se queda en [0,1).
  st.fase = (st.fase + ritmo(juego) * dt) % 1;

  // El ladeo persigue a padDX en vez de copiarlo: asi entra y sale con peso.
  // 12 por segundo tarda ~0.08 s en llegar, que es lo que cuesta inclinarse.
  st.ladeo += (juego.padDX - st.ladeo) * Math.min(1, dt * 12);

  // Cada cuanto puede disparar AHORA MISMO, para que el retroceso se escale.
  // Se calcula aqui porque depende de los poderes y las habilidades, y asi el
  // dibujado no tiene que saber nada de eso.
  st.cadencia = juego._cadencia();
}
