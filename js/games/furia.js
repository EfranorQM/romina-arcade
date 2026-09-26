// FURIA - moto por carretera, vista desde atras, como Out Run o Hang-On.
//
// La moto acelera sola; se gira manteniendo el pulgar en la mitad izquierda o
// derecha de la pantalla. Ocho niveles con meta en cuatro paisajes, cada uno
// con su reloj, dos puntos de control que dan tiempo, trafico, turbos y
// charcos. Se eligio el 26-09-2026 entre cuatro bocetos jugables (la vista de
// lado se habia hecho dos veces y seguia sintiendose rara).
//
// Las reglas viven en carretera-mundo.js, sin DOM, y las mide
// tools/prueba-carretera.mjs; los dibujos, en carretera-sprites.js; la
// carretera, en carretera-arte.js. El porque de cada numero: docs/FURIA-CANON.md.

import { VW, VH, clamp, supersample } from '../core.js';
import { text as textoFuente, measure } from '../font.js';
import { SFX, Motor } from '../audio.js';
import { vibrate } from '../input.js';
import * as M from './carretera-mundo.js';
import { Pintor, SUELO } from './carretera-arte.js';
import { corazon } from './carretera-sprites.js';

// Texto con el sobremuestreo: font.js lo divide entre ss (SURVIVAL cuenta con
// ello), asi que se le pide ya multiplicado. Con sombra: a veces va sobre un
// cielo casi blanco.
const text = (g, s, x, y, c, e = 1) => {
  const sm = Math.max(1, Math.round(e * 0.5));
  textoFuente(g, s, x + sm, y + sm, 'rgba(0,0,0,0.45)', e * supersample());
  textoFuente(g, s, x, y, c, e * supersample());
};
const textC = (g, s, cx, y, c, e = 1) => text(g, s, Math.round(cx - measure(String(s), e) / 2), y, c, e);
const textD = (g, s, x, y, c, e = 1) => text(g, s, Math.round(x - measure(String(s), e)), y, c, e);
const lerp = (a, b, t) => a + (b - a) * t;

const CUENTA = 2.4;                   // 3, 2, 1 antes de salir
const FIN_META = 4.6, FIN_TIEMPO = 3.4;

// Un solo pintor para toda la vida de la app (hornea lienzos grandes), y la
// calidad que se midio: si el telefono no llega, baja y ya no vuelve a subir.
const pintor = new Pintor();
let calidad = 2;

export default {
  meta: {
    id: 'furia', title: 'FURIA', tag: 'MOTO EN CARRETERA',
    colors: ['#ff5c7a', '#f0b45a'],
    // Apaisado, suave y con sobremuestreo x2 (el lienzo real es el del Redmi,
    // 2400x1080): el marcador sale nitido. El mundo se pinta aparte a la
    // calidad que aguante (pintor.q) y se estira.
    vw: 1200, vh: 540, wide: true, smooth: true, ss: 2,
  },

  init(ctx) {
    this.ctx = ctx;
    this.rnd = ctx.rnd;
    // Los dedos viven por encima del nivel: si ella tiene el pulgar puesto al
    // cruzar la meta, ese dedo sigue ahi en el nivel siguiente.
    this.dedos = new Map();
    this.nivel = 0;
    this.total = 0;
    this.fundido = 1;
    this.medida = { n: 0, suma: 0, ult: 0 };
    this.siguienteNivel();
  },

  siguienteNivel() {
    this.nivel++;
    this.L = M.hazNivel(this.nivel, this.rnd);
    this.J = M.nuevaMoto(this.L);
    pintor.q = calidad;
    pintor.nivel(this.L);
    this.cuenta = CUENTA;
    this.V = { prevPos: 0, prevX: 0, inc: 0, fase: 0, px: 0, fondoY: 0, celebra: 0, sacude: 0 };
    this.avisos = [];
    this.puntos = 0;
    this.resumen = null;
    this.finT = 0;
    this.tVis = -1;
    this.pista = this.nivel === 1 ? 5 : 0;
  },

  destroy() { Motor.calla(); },

  aviso(txt, col = '#ffe27a', dur = 1.4, esc = 6) {
    this.avisos.push({ txt, col, dur, esc, t: 0 });
    if (this.avisos.length > 2) this.avisos.shift();
  },

  update(dt, ctx) {
    const J = this.J, L = this.L, V = this.V;
    V.prevPos = J.pos;
    V.prevX = J.x;
    this.fundido = Math.max(0, this.fundido - dt * 2.5);
    for (const a of this.avisos) a.t += dt;
    this.avisos = this.avisos.filter(a => a.t < a.dur);
    if (this.pista > 0 && this.cuenta <= 0) this.pista -= dt;

    // La cuenta atras: el reloj no corre y la moto ruge parada.
    if (this.cuenta > 0) {
      const antes = Math.ceil((this.cuenta / CUENTA) * 3);
      this.cuenta -= dt;
      const ahora = Math.ceil((this.cuenta / CUENTA) * 3);
      if (ahora !== antes && ahora > 0) SFX.blip();
      if (this.cuenta <= 0) {
        J.corriendo = true;
        SFX.select();
        this.aviso('¡YA!', '#ffe27a', 0.8, 12);
      }
      Motor.pon(0.12 + Math.abs(Math.sin(J.t * 5)) * 0.18, 0.5);
    }

    let dir = 0;
    for (const d of this.dedos.values()) dir += d;
    dir = clamp(dir, -1, 1);
    M.paso(L, J, dir, dt, this.rnd);
    for (const e of J.ev) this.suceso(e);
    J.ev.length = 0;

    // Lo que solo se ve: la inclinacion, el paisaje que se desliza en las
    // curvas y el horizonte que baja al ver cuesta abajo.
    const zj = J.pos + M.JZ, c = L.curva[M.tramoDe(L, zj)], pct = J.v / M.VMAX;
    const inc = J.choque > 0 ? J.lado * 1.3 : J.fin ? 0 : dir * 0.42 + c * pct * 0.035;
    V.inc += (inc - V.inc) * Math.min(1, dt * (J.choque > 0 ? 6 : 7));
    V.fase += dt * (0.4 + pct);
    V.px += c * pct * dt * 124;
    const lejos = 100 * M.SEG;
    const off = (M.CAM_D / lejos) * (M.alturaEn(L, zj) - M.alturaEn(L, zj + lejos)) * (VH / 2);
    V.fondoY += (clamp(off, -50, 80) - V.fondoY) * Math.min(1, dt * 3);
    V.sacude = Math.max(0, V.sacude - dt * 30);
    V.celebra = J.fin && J.fin.k === 'meta' ? Math.min(1, V.celebra + dt * 1.6) : 0;
    if (this.cuenta <= 0) Motor.pon(Math.min(1.2, pct * (J.turbo > 0 ? 1.12 : 1)), J.choque > 0 || J.fin ? 0.15 : 1);

    // Por la hierba levanta tierra.
    if (Math.abs(J.x) > 1 && J.v > M.VMAX * 0.2 && Math.random() < 0.5) pintor.efecto('polvo', VW / 2 + J.x * 10, SUELO - 4, 1);

    if (J.fin) {
      this.finT += dt;
      if (J.fin.k === 'meta' && this.finT > FIN_META) {
        this.total += this.puntos;
        this.puntos = 0;
        if (this.nivel >= M.NIVELES.length) { Motor.calla(); ctx.gameOver(this.total); return; }
        this.siguienteNivel();
        this.fundido = 1;
      } else if (J.fin.k === 'tiempo' && this.finT > FIN_TIEMPO) {
        Motor.calla();
        ctx.gameOver(this.total + this.puntos);
      }
    }
  },

  suceso(e) {
    const J = this.J, S = pintor.S;
    if (e.k === 'choque') {
      SFX.explode(); SFX.hurt();
      vibrate([0, 90, 50, 140]);
      pintor.efecto('chispa', VW / 2, SUELO - 30, 28);
      this.V.sacude = 12;
      this.aviso('¡CHOQUE!', '#ff6f8e', 1.3);
    } else if (e.k === 'corazon') {
      SFX.estrella();
      this.puntos += M.PUNTOS.corazon;
      pintor.efecto('brillo', VW / 2, SUELO - 150, 9);
    } else if (e.k === 'adelanto') {
      this.puntos += M.PUNTOS.adelanto;
    } else if (e.k === 'turbo') {
      SFX.turbo();
      vibrate(40);
      this.aviso('TURBO!', '#7ff3ff', 1);
    } else if (e.k === 'charco') {
      SFX.barro();
      pintor.efecto('gota', VW / 2, SUELO - 8, 16);
      this.aviso(S.col.charcoNombre + '!', '#e8f4ff', 0.9, 5);
    } else if (e.k === 'control') {
      SFX.wave();
      vibrate(50);
      this.aviso('PUNTO DE CONTROL', '#ffe27a', 1.8, 5);
      this.aviso('+' + e.extra + ' SEGUNDOS', '#7dff8a', 1.8, 4);
    } else if (e.k === 'bajo') {
      SFX.blip();
    } else if (e.k === 'meta') {
      SFX.record();
      setTimeout(() => SFX.confeti(), 250);
      vibrate([0, 60, 40, 100]);
      pintor.efecto('confeti', 0, 0, 110);
      const bono = M.puntosMeta(J);
      this.puntos += bono;
      this.resumen = {
        nivel: this.nivel, corazones: J.corazones, total: this.L.corazones.length,
        adelantos: J.adelantos, choques: J.choques, sobra: J.fin.sobra, puntos: this.puntos,
      };
      this.aviso('¡META!', '#ffe27a', 2.2, 12);
    } else if (e.k === 'tiempo') {
      SFX.gameover();
      this.aviso('SE ACABO EL TIEMPO', '#ff6f8e', FIN_TIEMPO, 6);
    }
  },

  // La calidad del mundo: si los frames pasan de 21 ms de media, se pinta a
  // menos resolucion (2 -> 1.5 -> 1.2 -> 1). Se mide con el reloj de verdad
  // y solo mientras se juega (en pausa no hay frames que medir).
  mideCalidad(ahora) {
    const m = this.medida, d = ahora - m.ult;
    m.ult = ahora;
    if (d <= 0 || d > 150) return;
    m.n++;
    m.suma += d;
    if (m.n >= 45) {
      if (m.suma / m.n > 21 && calidad > 1) {
        calidad = calidad > 1.5 ? 1.5 : calidad > 1.2 ? 1.2 : 1;
        pintor.q = calidad;
      }
      m.n = 0;
      m.suma = 0;
    }
  },

  draw(g, ctx, alpha = 1) {
    const J = this.J, V = this.V;
    g.save();
    const ss = supersample();
    g.setTransform(ss, 0, 0, ss, 0, 0);
    const ahora = performance.now();
    // En pausa el tiempo del juego no avanza: el motor se calla y las
    // particulas se quedan quietas.
    const quieto = J.t === this.tVis;
    const dt = quieto ? 0 : Math.min(0.05, (ahora - (this.medida.ult || ahora)) / 1000);
    if (quieto) Motor.calla();
    else this.mideCalidad(ahora);
    this.tVis = J.t;

    const vista = {
      pos: lerp(V.prevPos, J.pos, alpha), x: lerp(V.prevX, J.x, alpha),
      inc: V.inc, fase: V.fase, t: J.t, dt, px: V.px, fondoY: V.fondoY,
      celebra: V.celebra, sacude: V.sacude, choque: J.choque > 0, resbala: J.resbala > 0,
      parpadeo: J.invul > 0 && Math.floor(J.t * 14) % 2 === 0,
      turbo: clamp(J.turbo / 0.5, 0, 1), vel: J.v / M.VMAX,
    };
    // A calidad completa, directo en la pantalla; si no, en su lienzo a menos
    // resolucion, y se estira.
    if (pintor.q >= ss) pintor.dibujaEn(g, ss, vista);
    else {
      g.imageSmoothingEnabled = true;
      g.drawImage(pintor.pinta(vista), 0, 0, VW, VH);
    }
    this.hud(g);
    if (this.fundido > 0) {
      g.globalAlpha = this.fundido;
      g.fillStyle = '#000000';
      g.fillRect(0, 0, VW, VH);
      g.globalAlpha = 1;
    }
    g.restore();
  },

  hud(g) {
    const J = this.J, L = this.L, w = VW, h = VH;
    // El reloj, grande: es lo que manda.
    text(g, 'TIEMPO', 28, 18, '#ffffff', 2);
    const rojo = J.tiempo <= 10 && !J.fin && Math.floor(J.t * 4) % 2 === 0;
    text(g, String(Math.max(0, Math.ceil(J.tiempo))), 28, 38, rojo ? '#ff5c7a' : '#ffe27a', 7);
    // Cuanto falta hasta la meta, con los dos controles marcados.
    const bx = 28, by = 102, bw = 300;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(bx - 2, by - 2, bw + 4, 12);
    const p = clamp((J.pos + M.JZ) / M.SEG / L.meta, 0, 1);
    g.fillStyle = '#ffe27a';
    g.fillRect(bx, by, bw * p, 8);
    g.fillStyle = '#ffffff';
    for (const ci of L.controles) g.fillRect(bx + (bw * ci) / L.meta - 1, by - 5, 3, 18);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
      g.fillRect(bx + bw + 8 + i * 6, by - 2 + j * 6, 6, 6);
    }
    g.fillStyle = '#ff5c7a';
    g.beginPath(); g.arc(bx + bw * p, by + 4, 7, 0, Math.PI * 2); g.fill();
    text(g, 'NIVEL ' + this.nivel, 28, 124, '#ffffff', 2);
    // Puntos y corazones, arriba a la derecha.
    textD(g, String(this.total + this.puntos), w - 28, 18, '#ffffff', 5);
    const nc = String(J.corazones);
    textD(g, nc, w - 28, 64, '#ffd1e6', 3);
    g.fillStyle = '#ff3d86';
    corazon(g, w - 28 - measure(nc, 3) - 18, 74, 9); g.fill();
    // La velocidad, a la derecha, encima de su flecha.
    const kmh = Math.round((J.v / M.VMAX) * M.KMH);
    textD(g, String(kmh), w - 28, h - 176, '#ffffff', 6);
    textD(g, 'KM/H', w - 28, h - 128, '#ffffff', 2);
    // Las dos mitades de la pantalla son los mandos: una flecha en cada
    // esquina, que se enciende con el dedo.
    const lados = new Set(this.dedos.values());
    for (const s of [-1, 1]) {
      const cx = w / 2 + s * (w / 2 - 70), cy = h - 62;
      g.globalAlpha = lados.has(s) ? 0.55 : 0.2;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(cx + s * 22, cy); g.lineTo(cx - s * 12, cy - 28); g.lineTo(cx - s * 12, cy + 28); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    if (this.pista > 0 && !J.fin) {
      g.globalAlpha = Math.min(1, this.pista);
      for (const s of [-1, 1]) textC(g, 'MANTEN', w / 2 + s * (w / 2 - 70), h - 26, '#ffffff', 3);
      g.globalAlpha = 1;
    }
    // Cuenta atras. El nombre del nivel va en el arco de salida.
    if (this.cuenta > 0) {
      const n = Math.ceil((this.cuenta / CUENTA) * 3);
      const f = (this.cuenta / CUENTA) * 3 - (n - 1);
      textC(g, String(n), w / 2, h * 0.3 - (1 - f) * 10, '#ffffff', Math.round(12 + f * 6));
    }
    // Avisos, uno debajo de otro.
    this.avisos.forEach((a, i) => {
      const k = a.t / a.dur;
      g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      textC(g, a.txt, w / 2, h * 0.24 + i * (a.esc * 9 + 6) - k * 8, a.col, a.esc);
    });
    g.globalAlpha = 1;
    if (this.resumen && this.finT > 1.2) this.tarjeta(g, w, h);
  },

  // La tarjeta de nivel completado, a la derecha: en el centro tapaba a la
  // piloto justo cuando celebra.
  tarjeta(g, w, h) {
    const r = this.resumen;
    const a = Math.min(1, (this.finT - 1.2) * 4) * (1 - Math.max(0, (this.finT - (FIN_META - 0.4)) / 0.4));
    const cw = 470, ch = 262, cx = w - cw - 40, cy = 150;
    g.globalAlpha = a * 0.8;
    g.fillStyle = '#140a24';
    g.fillRect(cx, cy, cw, ch);
    g.globalAlpha = a;
    g.strokeStyle = '#ff2e63';
    g.lineWidth = 4;
    g.strokeRect(cx, cy, cw, ch);
    textC(g, 'NIVEL ' + r.nivel + ' COMPLETADO!', cx + cw / 2, cy + 22, '#ffffff', 3);
    const fila = (et, val, y, col) => { text(g, et, cx + 40, y, '#bba8e8', 3); textD(g, val, cx + cw - 40, y, col, 3); };
    fila('CORAZONES', r.corazones + '/' + r.total, cy + 70, '#ffd1e6');
    fila('ADELANTOS', String(r.adelantos), cy + 106, '#ffffff');
    fila('CHOQUES', String(r.choques), cy + 142, r.choques ? '#ffffff' : '#7dff8a');
    fila('TIEMPO SOBRANTE', r.sobra + ' S', cy + 178, '#ffe27a');
    fila('PUNTOS', '+' + r.puntos, cy + 214, '#7dff8a');
    g.globalAlpha = 1;
  },

  onInput(ev) {
    if (ev.type === 'down' || ev.type === 'move') {
      if (ev.type === 'move' && !this.dedos.has(ev.id)) return;
      // Deslizar el pulgar de una mitad a la otra cambia de lado sin soltar.
      this.dedos.set(ev.id, ev.x < VW / 2 ? -1 : 1);
    } else if (ev.type === 'up' || ev.type === 'cancel') {
      this.dedos.delete(ev.id);
    }
  },
};
