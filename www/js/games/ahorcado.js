// AHORCADO - adivinar palabras mientras un muneco colgado de seis globos sobre
// un estanque va perdiendo altura, compostura y cara.
//
// No hay horca ni cadalso ni cuerpo que se dibuja pieza a pieza. Las seis
// oportunidades del juego clasico se leen a la vez en ALTURA (cada fallo
// revienta un globo y el muneco baja 40 px), en FISICA (con menos globos el
// ramo sostiene peor) y en CARA (de tranquilo a panico). Al sexto fallo cae al
// agua, y la rana que lleva toda la partida mirandolo se le sienta en la
// barriga. Es el unico juego del arcade de pensar, y el unico que se toca por
// curiosidad: entre letra y letra el muneco es un juguete -- se lo columpia,
// se lo empuja, se le hacen cosquillas -- y nada de eso cuenta.
//
// Dos modos. SOLA: palabras de la lista con la categoria como pista, puntaje
// por racha y record. A DOS: una persona escribe la palabra secreta, le pasa el
// telefono a la otra, y esa adivina; marcador J1-J2 y sin record, porque quien
// escribe puede poner lo que quiera.
//
// Reparto del lienzo (540x1200, de arriba abajo):
//     0..74     boton de pausa del motor (centro) y HUD en las esquinas
//    74..640    cielo, ramo y muneco
//   640..716    el estanque, con la rana en 646
//   716..       panel opaco: pista (722), casillas (744..796), mensajes
//               (796..840) y el teclado (850..1154), con 46 px de margen abajo
//               para la barra de gestos de MIUI.
//
// La fisica vive en ahorc-fisica.js (sin DOM: se mide en Node), la cara en
// ahorc-cara.js, el dibujo en ahorc-arte.js, el teclado en ahorc-teclado.js y
// las palabras en ahorc-palabras.js.

import { VW, VH, clamp, cam, Save, makeRng } from '../core.js';
import { text, textCenter, measure } from '../font.js';
import { SFX, playMusic, SONGS } from '../audio.js';
import { vibrate, pointers } from '../input.js';
import * as F from './ahorc-fisica.js';
import * as A from './ahorc-arte.js';
import { mkCara, updateCara, reaccion, cortarReaccion } from './ahorc-cara.js';
import { Teclado, Botones, posTecla, ZONA_TECLADO_Y, PANEL_Y, ACERTADA, FALLADA, KW, KH, rrect } from './ahorc-teclado.js';
import { elegir, normalizar } from './ahorc-palabras.js';

const PISTA_Y = 722, MSG_Y = 808;
const RANA_X = 110, RANA_Y = 646;
const MSGS_SOLA = ['ESO ROMINA!', 'GENIA', 'LO SABIA', 'NADIE COMO TU', 'ASI SE HACE'];
const MSGS_DUO = ['ADIVINADA!', 'GENIAL', 'ESA ES', 'BIEN AHI'];
const PISTAS_DUO = ['ANIMAL', 'COMIDA', 'LUGAR', 'COSA', 'NOSOTROS', 'SIN PISTA'];

export default {
  meta: {
    id: 'ahorcado', title: 'AHORCADO', tag: 'GLOBOS Y PALABRAS',
    colors: ['#ff9bc8', '#1b2c6e'],
    // Arte suave a 540x1200, como FURIA: el muneco es tinta y curvas.
    vw: 540, vh: 1200, smooth: true,
  },

  init(ctx, args) {
    this.ctx = ctx;
    const seed = (args && args.seed) >>> 0 || 1;
    this.rnd = makeRng(seed);
    this.seed = seed;
    A.hornearCielo(this.rnd);
    A.limpiarParticulas();
    this.t = 0; this.estT = 0;
    this.tec = new Teclado();
    this.bot = new Botones();
    this.nuevoMono(150);
    this.rana = { x: RANA_X, y: RANA_Y, boca: 0, mira: null, salto: 0, enBarriga: false, croaT: 8 + this.rnd() * 6, bx: 0, by: 0 };
    this.squish = new Float32Array(6);
    this.sueltas = []; this.entrando = []; this.flotantes = [];
    this.msg = ''; this.msgT = 0; this.msgCol = '#ffe14d';
    this.dedoEscena = -1; this.dedo = null; this.dedoT = 0; this.dedoX0 = 0; this.dedoY0 = 0; this.dedoMov = 0;
    this.frota = 0; this.cosquillas = 0; this.risaT = 0;
    this.ultimaTecla = null;
    this.tocada = false;
    this.sacude = 0; this.patadas = 0; this.patadaT = 0; this.patadaF = 260; this.saluda = 0;
    this.chapoteoT = 0;
    this.puntaje = 0; this.n = 0; this.racha = 0;
    this.palabra = ''; this.cat = null; this.reveladas = new Set(); this.usadas = new Set(); this.fallos = 0;
    this.voltea = []; this.caeT = 0;
    this.duo = { j1: 0, j2: 0, escribe: 1, secreto: '', pista: null };
    this.modo = null;
    this.irModo();
  },

  destroy() { A.soltarCielo(); A.limpiarParticulas(); if (this.tec) this.tec.bake = null; },

  // Un muneco nuevo con el ramo entrando desde arriba (el nudo baja de `ky` a
  // 236 en 1.6 s, medido). Tambien tras una caida: el que se mojo no vuelve.
  nuevoMono(ky) {
    this.S = F.makeMono(270, ky, this.seed + (this.n | 0) * 7919);
    this.S.knot.ty = F.KNOT_HOME_Y;
    this.cara = mkCara(this.rnd);
    if (this.entrando) this.entrando.length = 0;
    // La rana vuelve a su nenufar: si se quedo sentada en la barriga del que
    // se mojo, aparecia sentada sobre el muneco nuevo.
    if (this.rana) { const r = this.rana; r.x = RANA_X; r.y = RANA_Y; r.enBarriga = false; r.saltoT = undefined; r.salto = 0; r.boca = 0; }
  },

  // ---------- Pantallas ----------
  irModo() {
    this.estado = 'modo'; this.estT = 0;
    this.tec.ocultar();
    this.bot.poner([
      { id: 'sola', x: 50, y: 880, w: 440, h: 100, txt: 'SOLA', esc: 5, col: '#5cffd8', sub: 'PALABRAS DE LA LISTA' },
      { id: 'duo', x: 50, y: 1010, w: 440, h: 100, txt: 'A DOS', esc: 5, col: '#ff5c9d', sub: 'UNO ESCRIBE, OTRO ADIVINA' },
    ]);
    this.saluda = 1.2;
    this.palabra = ''; this.cat = null;
  },

  empezarSola() {
    this.modo = 'sola';
    this.puntaje = 0; this.n = 0; this.racha = 0; this.cat = null;
    if (this.S.falling) this.nuevoMono(150);
    this.bot.vaciar();
    this.tec.reset(); this.tec.mostrar('adivinar');
    this.nuevaPalabra();
  },

  nuevaPalabra() {
    this.n++;
    const e = elegir(this.rnd, this.n, this.cat);
    this.ponerPalabra(e.w, e.cat);
  },

  ponerPalabra(w, cat) {
    this.palabra = w; this.cat = cat;
    this.reveladas.clear(); this.usadas.clear(); this.fallos = 0;
    this.voltea = new Array(w.length).fill(0);
    // Lo que dejo la caida anterior (A DOS encadena rondas sin pasar por init).
    this.flotando = false; this.chapuzon = false; this.reveladasFin = null; this.terminado = false; this.burbujasT = 0;
    this.tec.reset(); this.tec.mostrar('adivinar');
    this.estado = 'ronda'; this.estT = 0;
    this.caeT = 0.25 + w.length * 0.03;
    reaccion(this.cara, 'AJA', 0.8);
    this.ultimaTecla = null;
    this.musica();
  },

  musica() {
    if (F.alive(this.S) === 1 && !this.S.falling) playMusic(SONGS.ahorcadoPanico);
    else playMusic(SONGS.ahorcado);
  },

  // ---------- Una letra ----------
  letra(L) {
    if (this.estado !== 'ronda') return;
    const S = this.S;
    if (this.usadas.has(L)) {
      this.tec.temblar(L);
      reaccion(this.cara, 'YA', 0.5);
      this.sacude = 0.3;
      this.mensaje('YA LA USASTE', '#8a7ab8', 0.8);
      SFX.repetida();
      return;
    }
    this.usadas.add(L);
    if (this.palabra.includes(L)) {
      this.reveladas.add(L);
      this.tec.marcar(L, ACERTADA);
      const geo = A.geoCasillas(this.palabra);
      let k = 0;
      for (let i = 0; i < this.palabra.length; i++) if (this.palabra[i] === L) {
        this.voltea[i] = 0.2;
        // Los puntos por casilla solo existen en SOLA; en A DOS no hay puntaje
        // que los reciba y un '+5' flotando no iria a ninguna parte.
        if (this.modo === 'sola') { this.flotante('+5', geo.xs[i] + geo.w / 2, 740, 0.5, 2, '#5cffd8', 30); this.puntaje += 5; }
        k++;
      }
      SFX.acierto(Math.min(12, this.reveladas.size));
      reaccion(this.cara, 'ALIVIO', 0.45);
      F.impulse(S, F.CAB, 0, -90); F.impulse(S, F.MANO, 0, -90);
      for (let b = 0; b < 6; b++) if (S.alive[b]) F.impulse(S, F.B0 + b, 0, -40);
      if (this.completa()) this.ganar();
    } else {
      this.fallos++;
      // Los globos que todavia venian subiendo cuentan: se atan en seco antes
      // de reventar. Si no, ganar con un globo y fallar la primera letra de la
      // siguiente palabra en el medio segundo que tardan en llegar era caer al
      // agua con un solo fallo.
      this.atarPendientes();
      const b = F.pop(S);
      this.tec.marcar(L, FALLADA, b);
      if (b >= 0) {
        const bx = S.x[F.B0 + b], by = S.y[F.B0 + b];
        for (let i = 0; i < 12; i++) {
          const ang = this.rnd() * 6.28, v = 200 + this.rnd() * 220;
          A.particula(A.JIRON, bx, by, Math.cos(ang) * v, Math.sin(ang) * v, 0.45, A.COLORES[b], 6, 600, ang);
        }
        A.particula(A.ANILLO, bx, by, 34, 0, 0.18, '#ffffff', 10, 0, 0);
        this.sueltas.push({ b, t: 0, x: bx, y: by });
      }
      cam.shake(3, 0.12); vibrate(20);
      SFX.globo();
      reaccion(this.cara, 'SUSTO', 0.6);
      const vivos = F.alive(S);
      if (vivos <= 2 && vivos > 0) F.setPostura(S, { twoHands: true, knees: true });
      if (vivos === 0) this.perder();
      else this.musica();
    }
  },

  completa() {
    for (const c of this.palabra) if (c !== ' ' && !this.reveladas.has(c)) return false;
    return true;
  },

  ganar() {
    const S = this.S;
    this.estado = 'ganada'; this.estT = 0;
    const letras = this.palabra.replace(/ /g, '').length, vivos = F.alive(S);
    const mult = this.n <= 2 ? 1 : this.n <= 5 ? 2 : 3;
    let pts = (100 + 15 * letras + 25 * vivos) * mult;
    const perfecta = this.fallos === 0;
    if (perfecta) pts += 100;
    this.ptsPalabra = pts;
    if (this.modo === 'sola') { this.puntaje += pts; this.racha++; }
    const msgs = this.modo === 'sola' ? MSGS_SOLA : MSGS_DUO;
    this.mensaje(perfecta ? 'PERFECTA! +100' : msgs[Math.floor(this.rnd() * msgs.length)], '#ffe14d', 1.4);
    this.flotante('+' + pts, S.x[F.CAB], S.y[F.CAB] - 50, 0.8, 3, '#ffe14d', 60);
    reaccion(this.cara, 'TRIUNFO', 1.6);
    F.setPostura(S, { twoHands: false, knees: false, eyes: false });
    F.impulse(S, F.MANO, 0, -500);
    this.patadas = 4; this.patadaT = 0; this.patadaF = 260;
    this.rebote = 0.06 * 6; this.reboteI = -1;
    for (let i = 0; i < 24; i++) {
      const ang = -Math.PI / 2 + (this.rnd() - 0.5) * 2.2, v = 150 + this.rnd() * 260;
      A.particula(A.CONFETI, S.x[F.NUDO], S.y[F.NUDO], Math.cos(ang) * v, Math.sin(ang) * v, 0.9, A.COLORES[i % 6], 4, 400, this.rnd() * 6);
    }
    if (perfecta) SFX.record(); else SFX.powerup();
    // Tres globos nuevos suben desde detras del panel y se atan uno a uno.
    if (this.modo === 'sola') {
      let k = 0;
      for (let b = 0; b < 6 && k < 3; b++) if (!S.alive[b] && !this.entrando.some(e => e.b === b)) {
        this.entrando.push({ b, x: S.x[F.NUDO] + (b - 2.5) * 22, y: 740 + k * 60, t: -k * 0.15 });
        k++;
      }
    }
  },

  perder() {
    this.estado = 'caida'; this.estT = 0;
    this.flotando = false; this.chapuzon = false; this.revelI = 0; this.revelT = 0;
    this.rana.salto = 20; SFX.croac();
    F.release(this.S); this.dedoEscena = -1; this.dedo = null; this.frota = 0; this.frotaEv = false; this.cosquillas = 0;
    // Los globos que venian subiendo no se atan a un muneco que ya cae.
    this.entrando.length = 0;
    this.tec.soltarTodo();
    this.mensaje('', '#fff', 0);
  },

  // ---------- A DOS ----------
  irEscribir() {
    this.modo = 'duo';
    this.estado = 'escribir'; this.estT = 0;
    this.duo.secreto = ''; this.duo.pista = null;
    this.palabra = ''; this.cat = null;
    if (this.S.falling) this.nuevoMono(150);
    this.tec.reset(); this.tec.mostrar('escribir');
    this.botonesEscribir();
    F.setPostura(this.S, { twoHands: false, knees: false, eyes: true });
    reaccion(this.cara, 'NOMIRO', 1e9);
    // Los globos que falten suben AHORA, mientras se escribe: tienen segundos
    // de sobra para atarse. Reponerlos al abrir la ronda dejaba medio segundo
    // en que un fallo reventaba el unico vivo y el muneco caia.
    this.reponerGlobos();
    this.musica();
  },
  reponerGlobos() {
    const S = this.S;
    let k = 0;
    for (let b = 0; b < 6; b++) if (!S.alive[b] && !this.entrando.some(e => e.b === b)) { this.entrando.push({ b, x: S.x[F.NUDO] + (b - 2.5) * 22, y: 740 + k * 50, t: -k * 0.12 }); k++; }
  },
  botonesEscribir() {
    const ok = this.duo.secreto.replace(/ /g, '').length >= 3 && !this.duo.secreto.endsWith(' ');
    this.bot.poner([
      { id: 'espacio', x: 21, y: 796, w: 240, h: 44, txt: 'ESPACIO', esc: 2, col: '#8a7ab8', on: !this.duo.secreto.includes(' ') && this.duo.secreto.length > 0 && this.duo.secreto.length < 13 },
      { id: 'listo', x: 279, y: 796, w: 240, h: 44, txt: 'LISTO', esc: 2, col: '#5cffd8', on: ok },
    ]);
  },
  teclaEscribir(L) {
    const s = this.duo.secreto;
    if (L === 'BORRAR') { this.duo.secreto = s.slice(0, -1); SFX.blip(); }
    else if (s.length < 14) { this.duo.secreto = s + L; SFX.tecla(); }
    this.botonesEscribir();
  },
  irPista() {
    this.estado = 'pista'; this.estT = 0;
    this.tec.ocultar();
    const b = [];
    for (let i = 0; i < PISTAS_DUO.length; i++) {
      b.push({ id: 'pista:' + PISTAS_DUO[i], x: i % 2 ? 279 : 21, y: 850 + Math.floor(i / 2) * 100, w: 240, h: 88, txt: PISTAS_DUO[i], esc: 3, col: i === 5 ? '#8a7ab8' : '#ffffff' });
    }
    this.bot.poner(b);
  },
  irPasar() {
    this.estado = 'pasar'; this.estT = 0;
    this.bot.vaciar();
  },
  empezarRondaDuo() {
    F.setPostura(this.S, { eyes: false });
    cortarReaccion(this.cara, 'NOMIRO');
    this.sacude = 0.3;
    // Siempre con seis globos: los que aun no llegaron se atan en seco.
    this.atarPendientes();
    this.n = 1;
    this.ponerPalabra(this.duo.secreto, this.duo.pista === 'SIN PISTA' ? null : this.duo.pista);
  },
  irResultado(gano) {
    this.estado = 'resultado'; this.estT = 0;
    this.duo.gano = gano;
    const adivina = this.duo.escribe === 1 ? 2 : 1;
    if (gano) { if (adivina === 1) this.duo.j1++; else this.duo.j2++; }
    else { if (this.duo.escribe === 1) this.duo.j1++; else this.duo.j2++; }
    this.tec.ocultar();
    this.bot.poner([
      { id: 'otra', x: 50, y: 900, w: 440, h: 100, txt: 'OTRA (CAMBIAN)', esc: 4, col: '#5cffd8' },
      { id: 'menu', x: 50, y: 1030, w: 440, h: 100, txt: 'AL MENU', esc: 4, col: '#ff5c9d' },
    ]);
  },

  // ---------- Utilidades ----------
  mensaje(txt, col, dur) { this.msg = txt; this.msgCol = col; this.msgT = dur; },
  flotante(txt, x, y, dur, esc, col, sube) { this.flotantes.push({ txt, x, y, t: 0, dur, esc, col, sube }); },

  // ---------- Update ----------
  update(dt, ctx) {
    const S = this.S;
    this.t += dt; this.estT += dt;
    this.tec.update(dt); this.bot.update(dt);

    // Fisica: un paso fijo por update (main.js ya da pasos de 1/60).
    F.step(S, true);

    // Globos que suben a atarse: 520 px/s con vaiven de +-14 px a 2 Hz. Se atan
    // cuando su distancia al nudo llega al largo de su cuerda menos 4: atarlos
    // "a 20 px del nudo" resolveria la cuerda en un frame y el globo saltaria.
    for (let i = this.entrando.length - 1; i >= 0; i--) {
      const e = this.entrando[i];
      e.t += dt;
      if (e.t < 0) continue;
      e.y -= 520 * dt;
      e.x = S.x[F.NUDO] + (e.b - 2.5) * 22 + Math.sin(e.t * 12.6) * 14;
      const d = Math.hypot(e.x - S.x[F.NUDO], e.y - S.y[F.NUDO]);
      if (d <= F.CORDS[e.b] - 4 || e.y < S.y[F.NUDO] - F.CORDS[e.b]) {
        F.tie(S, e.b, e.x, e.y);
        this.entrando.splice(i, 1);
        SFX.nudo();
        this.musica();
      }
    }
    for (let i = this.sueltas.length - 1; i >= 0; i--) { this.sueltas[i].t += dt; if (this.sueltas[i].t > 0.6) this.sueltas.splice(i, 1); }
    for (let b = 0; b < 6; b++) if (this.squish[b] > 0) this.squish[b] -= dt;

    // Chapoteo de un pie que entra al agua rapido (uno cada 300 ms como mucho).
    this.chapoteoT -= dt;
    if (S.splashV > 150 && this.chapoteoT <= 0 && !S.falling) {
      this.chapoteoT = 0.3; SFX.chapoteo();
      const [fx] = F.feet(S);
      for (let i = 0; i < 5; i++) A.particula(A.GOTA, fx + (this.rnd() - 0.5) * 20, F.WATER, (this.rnd() - 0.5) * 160, -80 - this.rnd() * 140, 0.4, '#b8d0ff', 2.5, 900);
    }

    // La rana: la boca se abre segun lo cerca que tenga los pies, y mira las
    // caderas del muneco.
    const r = this.rana;
    r.boca += (clamp(1 - (F.WATER - F.lowestFoot(S)) / 80, 0, 1) - r.boca) * Math.min(1, dt * 6);
    if (this.estado === 'caida' && this.flotando) r.boca += (0 - r.boca) * 0.2;
    r.mira = { x: (S.x[F.CR] + S.x[F.CL]) / 2, y: (S.y[F.CR] + S.y[F.CL]) / 2 };
    if (r.salto > 0) r.salto = Math.max(0, r.salto - 80 * dt);
    r.croaT -= dt;
    if (r.croaT <= 0 && this.estado === 'ronda') { r.croaT = 8 + this.rnd() * 6; SFX.croac(); r.salto = 8; this.cara.miraBase = { x: r.x, y: r.y }; this.cara.miraBaseT = 1; }

    // Gestos del cuerpo con temporizador.
    if (this.sacude > 0) {
      const k = Math.floor(this.sacude / 0.05);
      this.sacude -= dt;
      if (Math.floor(this.sacude / 0.05) !== k) F.impulse(S, F.CAB, (k & 1) ? 90 : -90, 0);
    }
    if (this.patadas > 0) {
      this.patadaT -= dt;
      if (this.patadaT <= 0) { this.patadaT = 0.15; F.impulse(S, (this.patadas & 1) ? F.PR : F.PL, (this.patadas & 1) ? this.patadaF : -this.patadaF, -this.patadaF * 0.3); this.patadas--; }
    }
    if (this.saluda > 0) {
      const k = Math.floor(this.saluda / 0.2);
      this.saluda -= dt;
      if (Math.floor(this.saluda / 0.2) !== k) F.impulse(S, F.MANO, (k & 1) ? 200 : -200, -60);
    }
    if (this.rebote > 0) {
      // Al ganar, cada globo recibe +300 px/s de subida con 60 ms de escalon.
      this.rebote -= dt;
      const i = Math.floor((0.36 - this.rebote) / 0.06);
      if (i !== this.reboteI && i < 6) { this.reboteI = i; for (let b = 0; b < 6; b++) if (S.alive[b] && (b % 6) === i) F.impulse(S, F.B0 + b, 0, -300); }
    }
    // Pataleo suelto de reposo cada 6-9 s.
    if (this.estado === 'ronda' || this.estado === 'modo') {
      this.pataleoT = (this.pataleoT || 6 + this.rnd() * 3) - dt;
      if (this.pataleoT <= 0) { this.pataleoT = 6 + this.rnd() * 3; F.impulse(S, this.rnd() < 0.5 ? F.PR : F.PL, (this.rnd() - 0.5) * 360, 0); }
    }

    // Cosquillas: frotar la barriga (> 220 px/s durante 0.35 s sobre el torso).
    if (this.cosquillas > 0) {
      this.cosquillas -= dt;
      const k = Math.floor(this.t * 8);
      if (k !== this.cosqK) { this.cosqK = k; F.impulse(S, F.CR, (k & 1) ? 120 : -120, 0); F.impulse(S, F.CL, (k & 1) ? -120 : 120, 0); }
      this.risaT -= dt;
      if (this.risaT <= 0) { this.risaT = 0.09; SFX.risa(this.cosqK); }
      if (this.cosquillas <= 0) cortarReaccion(this.cara, 'COSQUILLAS');
    }

    // El dedo apoyado en la escena.
    if (this.dedoEscena >= 0) {
      this.dedoT += dt; if (S.grab >= 0) F.moveGrab(S, this.dedo.x, this.dedo.y);
      if (this.frotaEv) {
        this.frota += dt;
        if (this.frota >= 0.35) { if (this.cosquillas <= 0) reaccion(this.cara, 'COSQUILLAS', 1e9); this.cosquillas = 0.6; }
      } else this.frota = Math.max(0, this.frota - dt);
      this.frotaEv = false;
    }

    // Gags de aburrido que piden sonido o pies.
    if (this.cara.gagNuevo === 'bostezo') SFX.bostezo();
    if (this.cara.gagNuevo === 'tararea') { SFX.tarareo(); this.patadas = 6; this.patadaT = 0; this.patadaF = 120; }

    // La cara.
    let globoAlto = null, by = 1e9;
    for (let b = 0; b < 6; b++) if (S.alive[b] && S.y[F.B0 + b] < by) { by = S.y[F.B0 + b]; globoAlto = { x: S.x[F.B0 + b], y: S.y[F.B0 + b] }; }
    if (this.ultimaTecla) this.ultimaTecla.t += dt;
    updateCara(this.cara, {
      globos: F.alive(S),
      cabeza: { x: S.x[F.CAB], y: S.y[F.CAB] },
      dedo: this.dedo,
      tecla: this.ultimaTecla,
      rana: { x: r.x, y: r.y },
      globoAlto: globoAlto || { x: S.x[F.NUDO], y: S.y[F.NUDO] - 80 },
      palabra: { x: 270, y: 770 },
      estado: this.estado === 'caida' && this.flotando ? 'flotando' : this.estado,
      tocada: this.tocada,
      eh: this.eh,
    }, dt);
    this.tocada = false;

    // Mensajes y flotantes.
    if (this.msgT > 0) this.msgT -= dt;
    for (let i = this.flotantes.length - 1; i >= 0; i--) { const f = this.flotantes[i]; f.t += dt; if (f.t >= f.dur) this.flotantes.splice(i, 1); }
    for (let i = 0; i < this.voltea.length; i++) if (this.voltea[i] > 0) this.voltea[i] -= dt;
    if (this.caeT > 0) this.caeT -= dt;
    A.updateParticulas(dt);

    // ---------- Por estado ----------
    if (this.estado === 'ganada') {
      if (this.estT >= 2.2) this.siguiente();
    } else if (this.estado === 'caida') {
      this.updateCaida(dt, ctx);
    } else if (this.estado === 'escribir') {
      if (this.cara.asoma > 0 && !this.asomando) { this.asomando = true; }
      if (this.cara.asoma <= 0) this.asomando = false;
    }
  },

  siguiente() {
    this.atarPendientes();
    if (this.modo === 'sola') this.nuevaPalabra();
    else this.irResultado(true);
  },

  // Ata de golpe, tensos bajo el nudo, los globos que aun venian subiendo.
  atarPendientes() {
    if (!this.entrando.length) return;
    for (const e of this.entrando) F.tie(this.S, e.b);
    this.entrando.length = 0;
    this.musica();
  },

  updateCaida(dt, ctx) {
    const S = this.S;
    const cadera = (S.y[F.CR] + S.y[F.CL]) / 2;
    if (!this.chapuzon && cadera > F.WATER) {
      this.chapuzon = true;
      const x = (S.x[F.CR] + S.x[F.CL]) / 2;
      for (let i = 0; i < 18; i++) { const ang = -Math.PI * (0.15 + this.rnd() * 0.7), v = 300 + this.rnd() * 200; A.particula(A.GOTA, x, F.WATER, Math.cos(ang) * v, Math.sin(ang) * v, 0.5, '#d0e0ff', 3, 900); }
      A.particula(A.ANILLO, x, F.WATER + 2, 80, 0, 0.3, '#b8d0ff', 12, 0, 0);
      A.particula(A.ANILLO, x, F.WATER + 2, 50, 0, 0.5, '#b8d0ff', 20, 0, 0);
      cam.shake(6, 0.2); vibrate(40); SFX.chapuzon();
      this.burbujasT = 1.0;
    }
    if (this.burbujasT > 0) {
      this.burbujasT -= dt;
      if (this.rnd() < 0.35) A.particula(A.BURBUJA, S.x[F.CAB] + (this.rnd() - 0.5) * 30, F.WATER + 30 + this.rnd() * 20, 0, -90, 1, '#fff', 3 + this.rnd() * 4, 0, this.rnd() * 6);
    }
    if (!this.flotando && this.chapuzon && this.estT >= 2.4) {
      this.flotando = true;
      reaccion(this.cara, 'EMPAPADO', 1e9);
      // Chorrito de la boca.
      for (let i = 0; i < 3; i++) A.particula(A.GOTA, S.x[F.CAB], S.y[F.CAB] + 10, 40 + i * 20, -220 - i * 40, 0.6, '#b8d0ff', 2.5, 700);
      // La rana salta a la barriga: parabola de 0.4 s.
      this.rana.saltoT = 0; this.rana.bx = this.rana.x; this.rana.by = this.rana.y;
      SFX.croac();
      this.mensaje('', '#ff9b4d', 0);
    }
    if (this.flotando) {
      const rn = this.rana;
      if (rn.saltoT !== undefined && rn.saltoT < 0.4) {
        rn.saltoT += dt;
        const u = Math.min(1, rn.saltoT / 0.4);
        const tx = (S.x[F.CR] + S.x[F.CL]) / 2, ty = (S.y[F.CR] + S.y[F.CL]) / 2 - 14;
        rn.x = rn.bx + (tx - rn.bx) * u; rn.y = rn.by + (ty - rn.by) * u - Math.sin(u * Math.PI) * 60;
        if (u >= 1) { rn.enBarriga = true; rn.saltoT = 1; }
      } else if (rn.enBarriga) {
        rn.x = (S.x[F.CR] + S.x[F.CL]) / 2; rn.y = (S.y[F.CR] + S.y[F.CL]) / 2 - 14; rn.mira = { x: 270, y: -400 };
      }
      // Se revelan las letras que faltaban, en naranja, una cada 80 ms.
      this.revelT -= dt;
      while (this.revelT <= 0 && this.revelI < this.palabra.length) {
        const c = this.palabra[this.revelI];
        if (c !== ' ' && !this.reveladas.has(c)) { this.revelT = 0.08; this.voltea[this.revelI] = 0.2; this.reveladasFin = this.reveladasFin || new Set(); this.reveladasFin.add(this.revelI); this.revelI++; break; }
        this.revelI++;
      }
      if (this.estT >= 4.6) this.terminar(ctx);
    }
  },

  terminar(ctx) {
    if (this.terminado) return;
    this.terminado = true;
    if (this.modo === 'sola') ctx.gameOver(Math.floor(this.puntaje));
    else { this.terminado = false; this.irResultado(false); }
  },

  // ---------- Entrada ----------
  onInput(ev) {
    const S = this.S;
    const st = this.estado;
    if (ev.type === 'down') {
      this.tocada = true;
      // Saltar la animacion de palabra ganada o perdida con un toque.
      if (st === 'ganada' && this.estT >= 0.8) { this.siguiente(); return; }
      if (st === 'caida' && this.flotando && this.estT >= 3.4) { this.terminar(this.ctx); return; }
      if (st === 'pasar') { if (this.estT >= 0.6) { SFX.select(); this.empezarRondaDuo(); } return; }
      // Botones grandes (SOLA / A DOS, tejuelas, ESPACIO / LISTO, resultado).
      if (this.bot.down(ev)) { SFX.tecla(); return; }
      if (ev.y >= ZONA_TECLADO_Y) {
        // Mientras el teclado entra deslizandose, y en el primer tercio de
        // segundo de cada palabra, no hay teclas: el segundo toque de un doble
        // toque sobre TOCA PARA EMPEZAR o sobre la palabra ganada caia justo
        // en una tecla y gastaba una letra antes de leer la pista.
        if (this.tec.entrada >= 0 || (st === 'ronda' && this.estT < 0.35)) return;
        const L = this.tec.down(ev);
        if (L) {
          SFX.tecla();
          if (st === 'ronda') {
            const p = posTecla(L);
            this.ultimaTecla = { x: p.x + KW / 2, y: p.y + KH / 2, t: 0 };
            reaccion(this.cara, 'EXPECTANTE', 1e9);
          }
        }
        return;
      }
      if (ev.y >= PANEL_Y) return;
      // La escena: el muneco es un juguete. Un solo dedo a la vez.
      if (this.dedoEscena >= 0 || st === 'caida' || st === 'resultado') return;
      this.dedoEscena = ev.id; this.dedo = { x: ev.x, y: ev.y };
      this.dedoT = 0; this.dedoX0 = ev.x; this.dedoY0 = ev.y; this.dedoMov = 0; this.frota = 0; this.frotaEv = false; this.dedoT0 = performance.now();
      const i = F.nearest(S, ev.x, ev.y);
      if (i >= F.B0) {
        // Tocar un globo lo aplasta y suena; NUNCA lo revienta. Arrastrarlo
        // arrastra el ramo entero.
        this.squish[i - F.B0] = 0.12; SFX.boing();
        F.grab(S, i, ev.x, ev.y);
      } else if (i >= 0) {
        F.grab(S, i, ev.x, ev.y);
      }
      return;
    }
    if (ev.type === 'move') {
      this.tec.move(ev);
      if (ev.id === this.dedoEscena) {
        this.dedoMov += Math.hypot(ev.x - this.dedo.x, ev.y - this.dedo.y);
        const vx = ev.x - this.dedo.x, vy = ev.y - this.dedo.y;
        this.dedo = { x: ev.x, y: ev.y };
        // Frotar la barriga: movimiento rapido sobre el torso (ampliado 34 px).
        // La velocidad se mide con el reloj real entre eventos, y el tiempo de
        // frote lo suma update() con su dt: los 'move' llegan al ritmo de la
        // pantalla (60, 90 o 120 por segundo) y contar eventos como sesentavos
        // hacia que a 120 Hz el gesto pidiera la mitad de tiempo y el doble de
        // velocidad.
        const ahora = performance.now();
        const dtEv = Math.max(4, ahora - (this.dedoT0 || ahora)) / 1000;
        this.dedoT0 = ahora;
        if (this.enTorso(ev.x, ev.y) && Math.hypot(vx, vy) / dtEv > 220) this.frotaEv = true;
      }
      return;
    }
    if (ev.type === 'up' || ev.type === 'cancel') {
      // Un 'up' SINTETICO es el que manda main.js al pausar (soltarDedos) o al
      // salir de la app: el dedo sigue vivo en input.js. Ese no compromete
      // nada -- ni la letra que tenia apoyada ni el boton -- solo suelta.
      const sintetico = pointers.has(ev.id);
      const b = this.bot.up(ev);
      if (b && !sintetico) { this.boton(b); }
      const r = this.tec.up(ev);
      if (r) {
        if (r.ok && !sintetico) {
          if (st === 'ronda') { cortarReaccion(this.cara, 'EXPECTANTE'); this.letra(r.letra); }
          else if (st === 'escribir') this.teclaEscribir(r.letra);
        } else {
          cortarReaccion(this.cara, 'EXPECTANTE');
          if (st === 'ronda' && !sintetico) { reaccion(this.cara, 'UFF', 0.3); SFX.cancelar(); }
        }
      }
      if (ev.id === this.dedoEscena) {
        if (!sintetico && this.dedoT < 0.18 && this.dedoMov < 12 && S.grab >= 0 && S.grab < F.B0) {
          // Un toque seco: el muneco se aparta del dedo y pone cara de 'eh'.
          const i = S.grab;
          const dx = S.x[i] - ev.x, dy = S.y[i] - ev.y, d = Math.hypot(dx, dy) || 1;
          F.release(S);
          F.impulse(S, i, dx / d * 260, dy / d * 260);
          this.eh = { x: ev.x, y: ev.y };
          reaccion(this.cara, 'EH', 0.5); SFX.eh();
        }
        F.release(S);
        this.dedoEscena = -1; this.dedo = null;
      }
    }
  },

  enTorso(x, y) {
    const S = this.S;
    const cx = (S.x[F.HR] + S.x[F.HL] + S.x[F.CR] + S.x[F.CL]) / 4, cy = (S.y[F.HR] + S.y[F.HL] + S.y[F.CR] + S.y[F.CL]) / 4;
    return Math.abs(x - cx) < 34 + 20 && Math.abs(y - cy) < 34 + 36;
  },

  boton(b) {
    SFX.select();
    if (b.id === 'sola') this.empezarSola();
    else if (b.id === 'duo') { this.duo.j1 = 0; this.duo.j2 = 0; this.duo.escribe = 1; this.irEscribir(); }
    else if (b.id === 'espacio') { this.teclaEscribir(' '); }
    else if (b.id === 'listo') { this.irPista(); }
    else if (b.id.startsWith('pista:')) { this.duo.pista = b.id.slice(6); this.irPasar(); }
    else if (b.id === 'otra') { this.duo.escribe = this.duo.escribe === 1 ? 2 : 1; this.irEscribir(); }
    else if (b.id === 'menu') { this.ctx.toMenu(); }
  },

  // ---------- Dibujo ----------
  draw(g, ctx, alpha) {
    const S = this.S, a = alpha === undefined ? 1 : alpha;
    const st = this.estado;
    A.drawFondo(g, this.t);
    // Sombra solo mientras cuelga sobre el agua.
    if (!S.falling) A.drawSombra(g, S, a);
    if (!this.rana.enBarriga) A.drawRana(g, this.rana);
    // Tinte de la coronilla: el globo mas bajo.
    let tinte = null, by = -1e9;
    for (let b = 0; b < 6; b++) if (S.alive[b] && S.y[F.B0 + b] > by) { by = S.y[F.B0 + b]; tinte = A.COLORES[b]; }
    A.drawGlobos(g, S, a, this.squish, this.sueltas, this.entrando);
    // Bajo el agua el cuerpo se ve a traves: se dibuja y encima el agua velada.
    A.drawCuerpo(g, S, a, this.cara, this.t, tinte);
    if (this.rana.enBarriga) A.drawRana(g, this.rana);
    if (S.falling) {
      // Velo del agua sobre lo que quedo sumergido.
      g.fillStyle = 'rgba(27,44,110,0.42)'; g.fillRect(0, F.WATER, 540, 716 - F.WATER);
      g.fillStyle = 'rgba(180,200,255,0.35)'; g.fillRect(0, F.WATER, 540, 2);
    }
    A.drawParticulas(g);
    // El panel de abajo se vuelve a pintar: los globos que suben salen de
    // detras de el.
    g.fillStyle = '#0d0620'; g.fillRect(0, 724, 540, 1200 - 724);

    // ---------- Panel ----------
    if (st === 'ronda' || st === 'ganada' || st === 'caida') this.drawPalabra(g);
    else if (st === 'escribir') this.drawEscribir(g);
    else if (st === 'pista') textCenter(g, 'PISTA PARA QUIEN ADIVINA', 270, PISTA_Y + 20, '#5cffd8', 2);
    if (this.msgT > 0 && this.msg) textCenter(g, this.msg, 270, MSG_Y, this.msgCol, 3);
    for (const f of this.flotantes) {
      const u = f.t / f.dur;
      g.globalAlpha = 1 - u * u;
      textCenter(g, f.txt, f.x, f.y - f.sube * u, f.col, f.esc);
    }
    g.globalAlpha = 1;
    // La tarjeta de resultado va ANTES que los botones: su velo oscuro tapaba
    // los botones OTRA y AL MENU, que se veian apagados como si no se pudieran
    // tocar (visto en captura).
    if (st === 'resultado') this.drawResultado(g);
    this.tec.draw(g);
    this.bot.draw(g);
    if (st === 'pasar') this.drawPasar(g, a);
    this.drawHud(g);
  },

  drawPalabra(g) {
    const perdida = this.estado === 'caida' && this.flotando;
    if (perdida) textCenter(g, 'SE MOJO... ERA:', 270, PISTA_Y, '#ff9b4d', 2);
    else if (this.cat) textCenter(g, this.cat, 270, PISTA_Y, '#5cffd8', 2);
    const letras = [], cols = [];
    for (let i = 0; i < this.palabra.length; i++) {
      const c = this.palabra[i];
      if (c === ' ') { letras.push(''); cols.push(''); continue; }
      if (this.reveladas.has(c)) { letras.push(c); cols.push('#ffffff'); }
      else if (perdida && this.reveladasFin && this.reveladasFin.has(i)) { letras.push(c); cols.push('#ff9b4d'); }
      else { letras.push(''); cols.push(''); }
    }
    // Las casillas caen desde 40 px mas arriba al empezar la palabra.
    if (this.caeT > 0) {
      g.save();
      const u = 1 - this.caeT / (0.25 + this.palabra.length * 0.03);
      g.globalAlpha = Math.min(1, u * 2);
      g.translate(0, -40 * (1 - u) * (1 - u));
      A.drawCasillas(g, this.palabra, letras, cols, this.voltea);
      g.restore();
    } else A.drawCasillas(g, this.palabra, letras, cols, this.voltea);
  },

  drawEscribir(g) {
    textCenter(g, 'ESCRIBE LA PALABRA SECRETA', 270, PISTA_Y, '#5cffd8', 2);
    const s = this.duo.secreto;
    const letras = [], cols = [];
    for (const c of s) { letras.push(c === ' ' ? '' : c); cols.push('#ffffff'); }
    const cursor = Math.floor(this.t * 2) % 2 === 0 ? s.length : -1;
    // Sin nada escrito se ensenan cuatro rayas vacias, para que se vea donde va.
    A.drawCasillas(g, s.length ? s : 'XXXX', letras, cols, null, cursor);
  },

  drawPasar(g, a) {
    // Telon opaco sobre todo salvo el muneco, que sigue tapandose los ojos.
    g.fillStyle = '#120a2e'; g.fillRect(0, 0, 540, 1200);
    const S = this.S;
    A.drawGlobos(g, S, a, this.squish, this.sueltas, this.entrando);
    A.drawCuerpo(g, S, a, this.cara, this.t, null);
    textCenter(g, 'PASALE EL', 270, 760, '#ffffff', 4);
    textCenter(g, 'TELEFONO', 270, 800, '#ffffff', 4);
    textCenter(g, 'A QUIEN ADIVINA', 270, 850, '#8a7ab8', 2);
    if (this.estT >= 0.6 && Math.sin(this.t * 4) > -0.3) textCenter(g, 'TOCA PARA EMPEZAR', 270, 920, '#5cffd8', 2);
  },

  drawResultado(g) {
    const d = this.duo;
    g.fillStyle = 'rgba(13,6,32,0.92)'; g.fillRect(0, 716, 540, 484);
    const y0 = 730;
    if (d.gano) {
      textCenter(g, 'ADIVINADA', 270, y0, '#5cffd8', 4);
      const v = F.alive(this.S);
      textCenter(g, 'CON ' + v + (v === 1 ? ' GLOBO  +' : ' GLOBOS  +') + this.ptsPalabra, 270, y0 + 40, '#ffe14d', 2);
    } else {
      textCenter(g, 'SE MOJO', 270, y0, '#ff9b4d', 4);
      textCenter(g, 'ERA: ' + this.palabra, 270, y0 + 40, '#ffffff', 2);
    }
    textCenter(g, 'J1  ' + d.j1 + ' - ' + d.j2 + '  J2', 270, y0 + 80, '#ffffff', 3);
    const escribe = d.escribe === 1 ? 2 : 1;
    textCenter(g, 'AHORA ESCRIBE J' + escribe, 270, y0 + 118, '#8a7ab8', 2);
  },

  drawHud(g) {
    if (this.estado === 'pasar') return;
    // En A DOS quien adivina puede ser Anderson: el rotulo es neutro.
    text(g, this.modo === 'duo' ? 'A DOS' : 'ROMINA', 16, 12, '#ffffff', 2);
    if (this.modo === 'sola') {
      text(g, String(this.puntaje), 16, 34, '#ffffff', 2);
      if (this.racha > 0) {
        const mult = this.n <= 2 ? 1 : this.n <= 5 ? 2 : 3;
        text(g, 'RACHA ' + this.racha + (mult > 1 ? '  x' + mult : ''), 16, 56, '#ffe14d', 2);
      }
    } else if (this.modo === 'duo') {
      text(g, 'J1 ' + this.duo.j1 + ' - ' + this.duo.j2 + ' J2', 16, 34, '#ffe14d', 2);
    }
    const m = 'MEJOR ' + Save.best('ahorcado');
    text(g, m, 540 - 16 - measure(m, 2), 12, '#8a7ab8', 2);
  },
};
