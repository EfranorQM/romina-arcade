// AHORCADO - la cara del muneco.
//
// Es lo que la va a hacer sonreir, asi que se trata como un actor y no como un
// icono: la cara vive en NUEVE PARAMETROS CONTINUOS (apertura de ojos, tamano
// de pupila, angulo de cada ceja, altura de cejas, curva y apertura de boca,
// mejillas y una preocupacion de 0 a 1) que update() acerca a su objetivo a
// 14 por segundo. Llegan en unos 70 ms: nunca saltan, salvo el cierre de ojos
// del susto, que es un parpadeo y tiene que ser seco.
//
// Tres capas deciden el objetivo, de abajo arriba:
//
//   1. ESTADO BASE por globos vivos: TRANQUI (6-5), ATENTO (4-3), NERVIOSO (2)
//      y PANICO (1). Escalones.
//   2. PREOCUPACION continua = globos reventados / 6, que se SUMA: cejas hacia
//      adentro, boca hacia abajo, pupilas mas chicas. Ella lo ve ponerse triste
//      entre escalon y escalon sin que nada salte.
//   3. REACCIONES con temporizador que mandan mientras duran: EXPECTANTE al
//      apoyar el pulgar en una tecla, ALIVIO al acertar, SUSTO al reventar,
//      YA-LA-USASTE, EH al tocarlo, COSQUILLAS, TRIUNFO, EMPAPADO, y los gags
//      de ABURRIDO si ella tarda.
//
// Como Roma en SURVIVAL (surv-roma.js): TODO avanza en update(), nunca en
// draw(). Lo que se actualiza al dibujar va al ritmo de la pantalla y en un
// telefono de 120 Hz corre al doble.

// clamp se define aqui y no se importa de core.js, como en sym-flow.js: asi la
// cara se puede correr en Node con un contexto 2D falso (tools/prueba-ahorcado-
// dibujo.mjs) sin cargar el nucleo.
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const TINTA = '#1a1030';

export function mkCara(rnd) {
  return {
    rnd,
    // Parametros actuales (p) y objetivo (q).
    p: { ojos: 1, pup: 1, cejaL: 0, cejaR: 0, cejaY: 0, bocaK: 4, bocaAb: 0, mej: 0 },
    q: { ojos: 1, pup: 1, cejaL: 0, cejaR: 0, cejaY: 0, bocaK: 4, bocaAb: 0, mej: 0 },
    preocup: 0,
    forma: 'normal',          // 'normal' | 'feliz' (^ ^) | 'apretado' (> <) | 'raya'
    zigzag: false,            // boca temblona de NERVIOSO
    sudor: -1,                // segundos desde que aparecio la gota; -1 = sin gota
    sudorT: 0,
    mechon: false,            // pelo mojado pegado al ojo
    rayitas: false,           // las de las cosquillas
    temblor: 0,               // amplitud del temblor de cabeza (px)
    // Reaccion en curso.
    reac: null, reacT: 0, reacDur: 0,
    // Mirada: punto del mundo al que mira (o null = de frente) y desplazamiento
    // actual de las pupilas.
    mira: null, mirX: 0, mirY: 0,
    miraBase: null, miraBaseT: 0,
    // Parpadeo.
    parpT: 2 + rnd() * 3, parp: 0, parpDoble: false,
    // Aburrimiento: segundos sin que ella toque nada, y que gag ya salio.
    sinToque: 0, gag: 0,
    // Nervioso: baja la mirada al agua cada 2 s.
    aguaT: 0,
    // Gotas del pelo mojado.
    gotaT: 0,
  };
}

// Dispara una reaccion. Una reaccion nueva pisa a la anterior salvo que la
// anterior sea mas importante (SUSTO no se interrumpe con EXPECTANTE).
const PESO = { EXPECTANTE: 1, UFF: 1, EH: 2, YA: 2, ALIVIO: 3, ABURRIDO: 0, COSQUILLAS: 3, SUSTO: 4, TRIUNFO: 5, EMPAPADO: 9, NOMIRO: 6, AJA: 1 };
export function reaccion(cara, nombre, dur) {
  if (cara.reac && (PESO[cara.reac] || 0) > (PESO[nombre] || 0) && cara.reacT < cara.reacDur) return;
  cara.reac = nombre; cara.reacT = 0; cara.reacDur = dur;
  if (nombre === 'SUSTO') cara.p.ojos = 0;   // seco: es un parpadeo de golpe
  cara.gag = 0; cara.sinToque = 0;
}
export function cortarReaccion(cara, nombre) { if (cara.reac === nombre) cara.reac = null; }

// `J` es lo que la cara necesita saber del juego:
//   globos      vivos (0..6)
//   cabeza      { x, y, vx }
//   dedo        { x, y } si hay un dedo apoyado en cualquier parte, o null
//   tecla       { x, y, t } la ultima tecla soltada y hace cuanto, o null
//   rana        { x, y }, globoAlto { x, y }, palabra { x, y }
//   estado      'ronda' | 'modo' | 'escribir' | 'caida' | 'flotando' | ...
//   tocada      true si ella toco algo este paso (reinicia el aburrimiento)
export function updateCara(cara, J, dt) {
  const p = cara.p, q = cara.q;
  const vivos = J.globos;
  const w = clamp((6 - vivos) / 6, 0, 1);
  cara.preocup += (w - cara.preocup) * Math.min(1, dt * 4);

  // ---------- 1) Base ----------
  let forma = 'normal', zigzag = false, temblor = 0;
  let miraBase = null;
  const base = J.estado === 'flotando' ? 'EMPAPADO' : vivos >= 5 ? 'TRANQUI' : vivos >= 3 ? 'ATENTO' : vivos === 2 ? 'NERVIOSO' : 'PANICO';
  q.ojos = 1; q.pup = 1; q.cejaL = 0; q.cejaR = 0; q.cejaY = 0; q.bocaK = 4; q.bocaAb = 0; q.mej = 0;
  if (base === 'ATENTO') { q.cejaY = -4; q.pup = 0.9; q.bocaK = 0; q.bocaAb = 0.3; }
  else if (base === 'NERVIOSO') { q.cejaL = -0.35; q.cejaR = 0.35; q.ojos = 1.05; q.pup = 0.75; q.bocaK = -3; zigzag = true; }
  else if (base === 'PANICO') { q.ojos = 1.2; q.pup = 0.6; q.cejaY = -8; q.bocaAb = 1; q.bocaK = 0; temblor = 1.5; }
  // La preocupacion se suma en continuo.
  q.cejaL -= 0.25 * cara.preocup; q.cejaR += 0.25 * cara.preocup;
  q.bocaK -= 4 * cara.preocup; q.pup -= 0.2 * cara.preocup;

  // A donde mira en reposo: cada 2-4 s elige entre la rana, el globo mas alto,
  // de frente (a ella) y la palabra. NERVIOSO baja la vista al agua cada 2 s;
  // PANICO alterna agua y ella cada 0.7.
  cara.miraBaseT -= dt;
  if (cara.miraBaseT <= 0) {
    cara.miraBaseT = base === 'PANICO' ? 0.7 : base === 'NERVIOSO' ? 1.0 : 2 + cara.rnd() * 2;
    const k = cara.rnd();
    if (base === 'PANICO') cara.miraBase = cara.miraBase ? null : J.rana;
    else if (base === 'NERVIOSO') cara.miraBase = k < 0.5 ? J.rana : null;
    else cara.miraBase = k < 0.25 ? J.rana : k < 0.5 ? J.globoAlto : k < 0.75 ? null : J.palabra;
  }
  miraBase = cara.miraBase;

  // Sudor: en NERVIOSO y PANICO, una gota cada 4 s que resbala 12 px en 1 s.
  if (base === 'NERVIOSO' || base === 'PANICO') {
    cara.sudorT -= dt;
    if (cara.sudorT <= 0) { cara.sudorT = 4; cara.sudor = 0; }
  }
  if (cara.sudor >= 0) { cara.sudor += dt; if (cara.sudor > 1.3) cara.sudor = -1; }

  // ---------- 2) Aburrimiento ----------
  // Solo en TRANQUI/ATENTO y solo en la ronda. Cualquier toque lo reinicia.
  if (J.tocada) { cara.sinToque = 0; if (cara.reac === 'ABURRIDO') cara.reac = null; cara.gag = 0; }
  const puedeAburrirse = (base === 'TRANQUI' || base === 'ATENTO') && J.estado === 'ronda' && !cara.reac;
  if (puedeAburrirse) cara.sinToque += dt; else if (J.estado !== 'ronda') cara.sinToque = 0;
  let gagNuevo = null;
  if (puedeAburrirse) {
    if (cara.sinToque > 25 && cara.gag < 4) { cara.gag = 4; gagNuevo = 'tararea'; }
    else if (cara.sinToque > 15 && cara.gag < 3) { cara.gag = 3; gagNuevo = 'ceja'; }
    else if (cara.sinToque > 9 && cara.gag < 2) { cara.gag = 2; gagNuevo = 'bostezo'; }
    else if (cara.sinToque > 6 && cara.gag < 1) { cara.gag = 1; }
    // Tras el ultimo gag se vuelve a contar desde 15 s.
    if (cara.gag === 4 && cara.sinToque > 27) { cara.sinToque = 15; cara.gag = 2; }
  }
  if (cara.gag >= 1 && puedeAburrirse) {
    // Parpados a media asta, pupilas a una esquina.
    q.ojos = 0.55; miraBase = { x: J.cabeza.x + 60, y: J.cabeza.y + 40 };
  }
  if (gagNuevo === 'bostezo') { cara.reac = 'BOSTEZO'; cara.reacT = 0; cara.reacDur = 0.7; }
  if (gagNuevo === 'ceja') { cara.reac = 'CEJA'; cara.reacT = 0; cara.reacDur = 1.2; }
  if (gagNuevo === 'tararea') { cara.reac = 'TARAREA'; cara.reacT = 0; cara.reacDur = 1.6; }
  cara.gagNuevo = gagNuevo;   // el juego lo lee para el sonido y los pies

  // ---------- 3) Reaccion ----------
  let mira = miraBase;
  if (cara.reac) {
    cara.reacT += dt;
    const r = cara.reac, u = cara.reacT / cara.reacDur;
    if (cara.reacT >= cara.reacDur && r !== 'EXPECTANTE' && r !== 'COSQUILLAS' && r !== 'NOMIRO' && r !== 'EMPAPADO') cara.reac = null;
    else if (r === 'EXPECTANTE') {
      q.ojos = 1.15; q.pup = 1.1; q.cejaY = -5; q.bocaK = 0; q.bocaAb = 0.35; q.cejaL = 0; q.cejaR = 0;
      if (cara.reacT > 1.2) q.cejaL = -0.3;      // '¿y?'
      mira = J.tecla ? J.tecla : mira;
    } else if (r === 'UFF') { q.mej = 0.6; q.bocaK = 1; q.bocaAb = 0; q.ojos = 0.8; }
    else if (r === 'ALIVIO') { forma = 'feliz'; q.bocaK = 9; q.mej = 1; q.bocaAb = 0; q.cejaL = 0; q.cejaR = 0; }
    else if (r === 'SUSTO') {
      if (cara.reacT < 0.1) { q.ojos = 0; p.ojos = 0; }
      else { q.ojos = 1.25; p.ojos = Math.max(p.ojos, 1.0); }
      q.pup = 0.5; q.cejaY = -10; q.bocaAb = 0.8; q.bocaK = 0; q.cejaL = 0; q.cejaR = 0;
      mira = J.globoAlto;
    } else if (r === 'YA') { q.cejaL = 0.3; q.cejaR = 0; q.cejaY = -2; q.bocaK = 0; q.bocaAb = 0; mira = null; }
    else if (r === 'EH') { q.ojos = 1.15; q.cejaL = J.eh && J.eh.x < J.cabeza.x ? 0.3 : 0; q.cejaR = J.eh && J.eh.x >= J.cabeza.x ? -0.3 : 0; q.bocaAb = 0.4; q.bocaK = 0; mira = cara.reacT < 0.2 && J.eh ? J.eh : J.dedo || mira; }
    else if (r === 'COSQUILLAS') { forma = 'apretado'; q.bocaAb = 1; q.bocaK = 9; q.mej = 1; }
    else if (r === 'TRIUNFO') { forma = 'feliz'; q.bocaAb = 0.9; q.bocaK = 9; q.mej = 1; q.cejaL = 0; q.cejaR = 0; q.cejaY = -3; }
    else if (r === 'EMPAPADO') { forma = 'raya'; q.pup = 1; q.bocaK = 0; q.bocaAb = 0; mira = null; if (cara.reacT > 1.2) { q.cejaR = -0.35; q.cejaY = -2; } temblor = 0; }
    else if (r === 'NOMIRO') { q.ojos = 0.05; q.bocaK = 2; if (Math.floor(cara.reacT / 3) !== Math.floor((cara.reacT - dt) / 3) && cara.reacT > 2.9) cara.asoma = 0.4; }
    else if (r === 'BOSTEZO') { q.ojos = 0.05; q.bocaAb = 1; q.bocaK = 0; q.cejaY = -3; }
    else if (r === 'CEJA') { q.cejaL = 0.35; q.cejaY = -3; q.ojos = 0.8; mira = null; }
    else if (r === 'TARAREA') { q.ojos = 0.7; q.bocaK = 5; q.bocaAb = 0.2 + 0.2 * Math.sin(cara.reacT * 18); mira = { x: J.cabeza.x - 80, y: J.cabeza.y - 60 }; }
    else if (r === 'AJA') { q.cejaY = -6; q.cejaL = 0; q.cejaR = 0; q.bocaK = 6; mira = J.palabra; }
  }
  if (cara.asoma > 0) { cara.asoma -= dt; q.ojos = 0.7; mira = J.palabra; }

  // El dedo apoyado manda sobre todo, y la tecla recien soltada sobre la base.
  if (J.dedo) mira = J.dedo;
  else if (J.tecla && J.tecla.t < 0.8 && !cara.reac) mira = J.tecla;
  cara.mira = mira;

  // ---------- Parpadeo ----------
  cara.parpT -= dt;
  if (cara.parpT <= 0 && base !== 'PANICO' && forma === 'normal' && J.estado !== 'flotando') {
    cara.parp = 0.12; cara.parpDoble = cara.rnd() < 0.2; cara.parpT = 3 + cara.rnd() * 2;
  }
  if (cara.parp > 0) { cara.parp -= dt; if (cara.parp <= 0 && cara.parpDoble) { cara.parpDoble = false; cara.parp = 0.12; cara.parpT = 0.15 + cara.parpT; } }

  cara.forma = forma; cara.zigzag = zigzag && !cara.reac; cara.temblor = temblor;
  cara.mechon = J.estado === 'flotando';
  cara.rayitas = cara.reac === 'COSQUILLAS';
  if (cara.mechon) { cara.gotaT -= dt; }

  // ---------- Suavizado ----------
  const k = Math.min(1, dt * 14);
  for (const key in q) p[key] += (q[key] - p[key]) * k;
  // Pupilas hacia el objetivo, hasta 5 px, suavizado a 10/s.
  let tx = 0, ty = 0;
  if (cara.mira) {
    const dx = cara.mira.x - J.cabeza.x, dy = cara.mira.y - J.cabeza.y, d = Math.hypot(dx, dy) || 1;
    tx = dx / d * 5; ty = dy / d * 5;
  }
  const km = Math.min(1, dt * 10);
  cara.mirX += (tx - cara.mirX) * km; cara.mirY += (ty - cara.mirY) * km;
}

// ---------- Dibujo ----------
// (cx,cy) es el centro de la cabeza y (ux,uy) el vector 'arriba' del marco de
// la cara, ya normalizado. `t` es el reloj del juego (para el temblor).
export function drawCara(g, cara, cx, cy, ux, uy, t) {
  const p = cara.p;
  g.save();
  g.translate(cx, cy);
  g.rotate(Math.atan2(ux, -uy));
  if (cara.temblor > 0) g.translate(Math.sin(t * 75) * cara.temblor, Math.cos(t * 61) * cara.temblor * 0.6);
  g.lineCap = 'round'; g.lineJoin = 'round';

  // Mejillas.
  if (p.mej > 0.03) {
    g.fillStyle = 'rgba(255,92,157,' + (0.35 * p.mej).toFixed(3) + ')';
    g.beginPath(); g.ellipse(-20, 7, 7, 5, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(20, 7, 7, 5, 0, 0, 7); g.fill();
  }

  // Ojos.
  const apert = cara.parp > 0 ? 0.04 : clamp(p.ojos, 0, 1.25);
  for (const s of [-1, 1]) {
    const ex = s * 13, ey = -5;
    if (cara.forma === 'feliz') {
      // '^ ^': dos arcos hacia arriba.
      g.strokeStyle = TINTA; g.lineWidth = 3.5;
      g.beginPath(); g.arc(ex, ey + 4, 8, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      continue;
    }
    if (cara.forma === 'apretado') {
      // '> <': dos angulos apuntando al centro.
      g.strokeStyle = TINTA; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(ex - s * 6, ey - 7); g.lineTo(ex + s * 3, ey); g.lineTo(ex - s * 6, ey + 7); g.stroke();
      continue;
    }
    if (cara.forma === 'raya') {
      g.strokeStyle = TINTA; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(ex - 8, ey); g.lineTo(ex + 8, ey); g.stroke();
      // Pupila asomando debajo de la raya: sigue viva.
      g.fillStyle = TINTA; g.beginPath(); g.arc(ex + cara.mirX * 0.5, ey + 4, 2.5, 0, 7); g.fill();
      continue;
    }
    const ry = 10 * apert;
    if (ry < 1.2) {
      g.strokeStyle = TINTA; g.lineWidth = 3;
      g.beginPath(); g.moveTo(ex - 8, ey); g.lineTo(ex + 8, ey); g.stroke();
      continue;
    }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(ex, ey, 8, ry, 0, 0, 7); g.fill();
    g.strokeStyle = TINTA; g.lineWidth = 3; g.stroke();
    // Pupila, recortada al ojo, con su brillo: el brillo es lo que lo hace
    // estar vivo.
    g.save();
    g.beginPath(); g.ellipse(ex, ey, 8, ry, 0, 0, 7); g.clip();
    const pr = 5 * clamp(p.pup, 0.5, 1.3);
    g.fillStyle = TINTA;
    g.beginPath(); g.arc(ex + cara.mirX, ey + cara.mirY, pr, 0, 7); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(ex + cara.mirX - pr * 0.35, ey + cara.mirY - pr * 0.4, 1.8, 0, 7); g.fill();
    g.restore();
  }

  // Cejas: trazos de 16 px, giran sobre su centro. rotate() positivo es
  // horario en pantalla, asi que en la ceja IZQUIERDA un angulo negativo sube
  // el extremo interior (preocupacion) y uno positivo sube el exterior (ceja
  // levantada); en la derecha, al reves. La primera version lo tenia al reves
  // y el muneco nervioso salia ENOJADO: se vio en la captura, no en el codigo.
  g.strokeStyle = TINTA; g.lineWidth = 4;
  for (const s of [-1, 1]) {
    const ang = s < 0 ? p.cejaL : p.cejaR;
    const bx = s * 13, by = -20 + p.cejaY;
    g.save(); g.translate(bx, by); g.rotate(ang);
    g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke();
    g.restore();
  }

  // Boca.
  const ab = clamp(p.bocaAb, 0, 1);
  if (ab > 0.15) {
    const mw = 9 + 9 * ab, mh = 4 + 9 * ab;
    g.fillStyle = TINTA;
    g.beginPath(); g.ellipse(0, 12 + p.bocaK * 0.15, mw, mh, 0, 0, 7); g.fill();
    g.fillStyle = '#7a2a4a';
    g.beginPath(); g.ellipse(0, 13 + p.bocaK * 0.15, mw - 3.5, mh - 3.5, 0, 0, 7); g.fill();
    if (p.bocaK > 4) { g.fillStyle = '#ffffff'; g.fillRect(-mw * 0.5, 12 + p.bocaK * 0.15 - mh + 3, mw, 3); }
  } else if (cara.zigzag) {
    g.strokeStyle = TINTA; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(-10, 11); g.lineTo(-3.5, 14); g.lineTo(3.5, 10); g.lineTo(10, 13); g.stroke();
  } else {
    g.strokeStyle = TINTA; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-10, 11); g.quadraticCurveTo(0, 11 + p.bocaK, 10, 11); g.stroke();
  }

  // Gota de sudor en la sien derecha.
  if (cara.sudor >= 0) {
    const u = Math.min(1, cara.sudor);
    const sx = 26, sy = -14 + 12 * u;
    g.fillStyle = '#5cffd8';
    g.beginPath(); g.moveTo(sx, sy - 5); g.quadraticCurveTo(sx + 4, sy + 1, sx, sy + 4); g.quadraticCurveTo(sx - 4, sy + 1, sx, sy - 5); g.fill();
  }

  // Rayitas de cosquillas.
  if (cara.rayitas) {
    g.strokeStyle = TINTA; g.lineWidth = 2.5;
    for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) {
      g.beginPath(); g.moveTo(s * 40, -10 + k * 12); g.lineTo(s * 48, -13 + k * 14); g.stroke();
    }
  }

  // Mechon mojado sobre el ojo derecho.
  if (cara.mechon) {
    g.strokeStyle = TINTA; g.lineWidth = 5;
    g.beginPath(); g.moveTo(8, -34); g.quadraticCurveTo(22, -22, 14, -2); g.stroke();
    g.beginPath(); g.moveTo(14, -34); g.quadraticCurveTo(28, -20, 24, -6); g.stroke();
  }
  g.restore();
}
