// SURVIVAL — el movimiento de las criaturas.
//
// Los sprites se hornean UNA vez a un canvas y despues solo se estiran (ver
// surv-art.js): no tienen fotogramas. Animarlos de verdad serian veintiocho
// criaturas x varios dibujos cada una, un trabajo enorme y con riesgo de bajar
// de 60fps con treinta enemigos en pantalla.
//
// Asi que lo que se anima es el DIBUJADO, no el dibujo: escala, rotacion y
// desplazamiento sobre el mismo canvas horneado. Cuesta tres multiplicaciones
// por enemigo y da casi todo el efecto: una criatura que respira, se ladea
// hacia donde va y se aplasta al morir parece viva aunque su lamina no cambie.
//
// Cada criatura tiene su ritmo propio segun COMO SE MUEVE y QUE ES, no segun su
// nombre: asi los once enemigos de bioma que se añadieron despues ya salen
// animados sin tocar este archivo.

// Cuanto se ladea una criatura segun su velocidad lateral. Un cuerpo que se
// desplaza a un lado se inclina hacia ese lado; sin esto el zigzag se ve como
// una lamina deslizandose, no como algo que se mueve solo.
// Medido en la app: la velocidad lateral de la tropa tiene una media de 60-70
// px/s y picos de hasta 700 en la TRISTEZA. Con el primer valor que puse
// (0.0022) el tope se alcanzaba ya a 136 px/s, asi que los que ondulan estaban
// SIEMPRE al maximo saltando de +0.30 a -0.30: se veia como un temblor brusco y
// no como un cuerpo que gira. Ahora el ladeo llega al tope cerca del pico real.
const LADEO = 0.00055;            // radianes por px/s de velocidad lateral
const LADEO_MAX = 0.26;           // ~15 grados; mas parece que se cae

// El "respiro" de cada tipo de movimiento: cuanto se estira y a que velocidad.
// Son distintos a proposito — si todas las criaturas latieran igual, la pantalla
// entera pulsaria a la vez y se veria como un error, no como vida.
const RITMO = {
  straight: { vel: 2.6, amp: 0.045 },   // firme, apenas respira
  zigzag:   { vel: 5.2, amp: 0.075 },   // nervioso
  sine:     { vel: 3.4, amp: 0.090 },   // ondulante, el que mas se deforma
};

// Devuelve como hay que dibujar a esta criatura AHORA: escala en cada eje,
// giro y desplazamiento. El juego solo tiene que aplicarlo y pintar.
//
// `e` es el enemigo, `dt` no hace falta porque todo sale de `e.t`, que el juego
// ya lleva al dia.
export function pose(e) {
  const def = e.def;
  const r = RITMO[def.move] || RITMO.straight;

  // 1) Respiracion: se estira en vertical y se encoge en horizontal, y al reves.
  // Conservar el volumen (lo que se gana de alto se pierde de ancho) es lo que
  // hace que parezca un cuerpo blando y no una imagen escalandose.
  let breath = Math.sin(e.t * r.vel) * r.amp;
  let sx = 1 - breath;
  let sy = 1 + breath;

  // 2) Ladeo segun a donde se mueve. `vx` lo calcula el juego comparando con la
  // posicion del frame anterior: asi vale para cualquier movimiento, incluido
  // el del TRACKER que persigue, sin tener que conocer cada caso.
  let rot = Math.max(-LADEO_MAX, Math.min(LADEO_MAX, (e.vx || 0) * LADEO));

  // 3) Embestida: el que carga se estira en el sentido de la marcha y se
  // adelgaza, como algo lanzado. El RELAMPAGO y el OLVIDADO son los que dashean.
  if (e.dashing > 0) {
    sy *= 1.35;
    sx *= 0.78;
    rot *= 0.4;                      // enderezarse: va a por Roma, no de paseo
  }

  // 4) Al recibir un golpe se aplasta un instante. `hit` dura 0.12 s, asi que
  // es un parpadeo: se siente el impacto sin que estorbe para seguir apuntando.
  if (e.hit > 0) {
    const k = e.hit / 0.12;
    sx *= 1 + 0.22 * k;
    sy *= 1 - 0.18 * k;
  }

  // 5) Los jefes RESPIRAN mas hondo y mas despacio que la tropa: es lo que les
  // da peso. Y cuando cargan su habilidad se hinchan, que es el aviso para
  // aprender a leerlos (ver `carga` mas abajo).
  if (e.boss) {
    const hondo = Math.sin(e.t * 1.5) * 0.05;
    sx = 1 - hondo; sy = 1 + hondo;
    if (e.hit > 0) { const k = e.hit / 0.12; sx *= 1 + 0.18 * k; sy *= 1 - 0.14 * k; }
    const c = carga(e);
    if (c > 0) {
      // Se encoge para tomar impulso y despues se estira de golpe.
      const p = c < 0.75 ? c / 0.75 : (1 - c) / 0.25;
      sx *= 1 + p * 0.13;
      sy *= 1 + p * 0.10;
    }
    // La segunda fase del ABANDONO late deprisa: se ve que esta desatado.
    if (e.phase2) {
      const f = Math.sin(e.t * 7) * 0.04;
      sx += f; sy -= f;
    }
  }

  return { sx, sy, rot };
}

// Cuanto le falta a un jefe para soltar su habilidad, de 0 (recien soltada o
// sin habilidad ciclica) a 1 (a punto). Es lo que permite AVISAR antes: un jefe
// que se hincha justo antes de disparar se puede esquivar; uno que dispara sin
// avisar solo se puede sufrir.
export function carga(e) {
  if (!e.boss || !e.def.cd) return 0;
  const falta = e.abT / e.def.cd;         // 1 recien soltada, 0 a punto
  const p = 1 - falta;
  // Solo el ultimo tercio del ciclo avisa: si avisara todo el rato el aviso no
  // significaria nada.
  return p > 0.66 ? (p - 0.66) / 0.34 : 0;
}

// ---------- La muerte ----------
// Una criatura que desaparece de golpe no se siente matada. Estas quedan un
// momento aplastandose y girando mientras se desvanecen: medio segundo que
// convierte cada baja en algo que se ve.
export function mkCorpse(e, rnd) {
  return {
    sprite: e.id,
    x: e.x, y: e.y,
    // Donde estaba el paso anterior, que para un recien muerto es donde esta:
    // nace a mitad del paso (cuando la bala acierta), asi que no pasa por la
    // foto que el juego saca al principio de update(). Sin esto, el primer
    // frame lo interpolaria desde `undefined` y no se dibujaria.
    px: e.x, py: e.y,
    r: e.r,
    boss: e.boss,
    // Sale despedida en la direccion en que iba, con algo de azar.
    vx: (e.vx || 0) * 0.35 + (rnd() - 0.5) * 60,
    vy: -30 - rnd() * 40,
    rot: 0,
    vrot: (rnd() - 0.5) * (e.boss ? 4 : 9),
    t: 0,
    dur: e.boss ? 0.9 : 0.45,
  };
}

export function updateCorpse(c, dt) {
  c.t += dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.vy += 220 * dt;                  // les cae encima la gravedad
  c.rot += c.vrot * dt;
  return c.t < c.dur;
}

// Como se dibuja un cadaver: se va aplastando y apagando.
export function posarCorpse(c) {
  const p = c.t / c.dur;             // 0 recien muerto, 1 a punto de irse
  return {
    sx: 1 + p * 0.5,                 // se ensancha
    sy: 1 - p * 0.65,                // y se aplasta
    rot: c.rot,
    alpha: 1 - p * p,                // se apaga tarde, no linealmente
  };
}
