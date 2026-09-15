// EL CABALLERO - campo de pruebas.
//
// AVISO: esto TODAVIA NO ES EL JUEGO. Es el patio donde se prueba lo unico que
// decide si el juego vale la pena -- como se siente correr, saltar, rodar y
// cortar en horizontal. No hay jefe, no hay vidas que perder, no se puede
// morir: hay muñecos de paja que se parten para sentir el impacto de la
// espada, y ya. El jefe entra cuando esto se sienta bien.
//
// Se juega de LADO. Pulgar izquierdo = mover. Tres botones a la derecha:
// SALTAR (arriba), TAJO (el grande) y RODAR (el chico).

import { VW, VH, cam, clamp } from '../core.js';
import { burst, particles } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { Stick, Button, vibrate } from '../input.js';
import * as C from './caba-cuerpo.js';
import { bakeCaballero, drawCaballero, P as PC } from './caba-art.js';
import { bakeMundo, drawMundo, P as PM } from './caba-mundo.js';

const SUELO = C.SUELO;

export default {
  meta: {
    id: 'caballero', title: 'EL CABALLERO', tag: 'PRUEBA DE MOVIMIENTO',
    colors: ['#c8d0dc', '#9c1b3c'],
    // Apaisado, y con el lienzo al doble para que el pixel art tenga detalle.
    // ss va SIN smooth: es pixel art, tiene que quedar nitido.
    vw: 600, vh: 270, wide: true, ss: 2,
    pausaY: 2,
  },

  init(ctx, args) {
    this.ctx = ctx;
    this.K = C.makeCaballero(160);
    this.S = bakeCaballero();
    this.W = bakeMundo(SUELO, VH);

    this.stick = new Stick(40, 7);
    // Los tres botones, en triangulo en la esquina de abajo a la derecha. Los
    // radios son de DIBUJO; el area de toque es r+pad y NO se solapa: los
    // centros estan a 62 px (TAJO-SALTA) y 60 (TAJO-RUEDA), y la suma de sus
    // radios de toque es 54. Medido a 0.254 mm/px: separaciones de 15 mm, muy
    // por encima de los 9 mm en que un pulgar empieza a equivocarse.
    this.bSalta = new Button(548, 168, 17, 10);
    this.bTajo  = new Button(566, 226, 20, 10);
    this.bRueda = new Button(508, 234, 16, 10);
    this.salta = false; this.golpea = false; this.rueda = false;

    this.camX = 0;
    this.t = 0; this.hitstop = 0;
    this.golpes = 0; this.saltos = 0; this.rodadas = 0;
    this.msg = ''; this.msgT = 0;

    // Muñecos de paja: se parten de un tajo y vuelven solos a los 2 s. Solo
    // estan para que la espada tenga algo que tocar.
    this.pajas = [];
    for (let i = 0; i < 5; i++) this.pajas.push({ x: 250 + i * 80, roto: 0, t: 0 });
  },

  update(dt, ctx) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;

    const K = this.K;
    const inp = {
      dx: this.stick.dx,
      salta: this.salta, saltaAbajo: this.bSalta.pressed,
      golpea: this.golpea, rueda: this.rueda,
    };
    const antesSuelo = K.enSuelo, antesSt = K.st, antesTajo = K.tajoId;
    this.salta = false; this.golpea = false; this.rueda = false;

    C.stepCaballero(K, inp, dt);

    // --- Sonidos y efectos de lo que acaba de pasar ---
    if (K.tajoId !== antesTajo) { SFX.espadazo(); this.golpes++; }
    if (!antesSuelo && K.enSuelo) {
      // Aterrizaje: polvo y un temblor chiquito
      burst(K.x, SUELO, 6, { rnd: Math.random, colors: [PM.sue1, PM.sue2], speed: 60, life: 0.3, size: 2, grav: 260 });
      SFX.aterriza(); cam.shake(1.5, 0.08);
    }
    if (antesSt !== C.SALTA && K.st === C.SALTA) { SFX.salto(); this.saltos++; vibrate(6); }
    if (antesSt !== C.RUEDA && K.st === C.RUEDA) {
      SFX.rodar(); this.rodadas++; vibrate(8);
      burst(K.x, SUELO, 5, { rnd: Math.random, colors: [PM.sue1, PM.sue3], speed: 50, life: 0.25, size: 2, grav: 200 });
    }
    // Polvo al correr
    if (K.st === C.CORRE && K.enSuelo && ((this.t * 12) | 0) % 3 === 0) {
      burst(K.x - K.dir * 6, SUELO, 1, { rnd: Math.random, colors: [PM.sue2], speed: 22, life: 0.22, size: 1, grav: 120 });
    }

    // --- La espada contra los muñecos ---
    if (C.espadaActiva(K)) {
      const [px, py] = C.puntaEspada(K);
      for (const p of this.pajas) {
        if (p.roto > 0) continue;
        if (Math.abs(p.x - px) < 16 && Math.abs(p.x - K.x) < C.ALCANCE + 8) {
          p.roto = 2.0;
          this.hitstop = 5 / 60;
          cam.shake(3, 0.12);
          SFX.corta(); vibrate(16);
          burst(p.x, SUELO - 14, 12, { rnd: Math.random, colors: [PM.hueso, PM.hier2, PM.sue1], speed: 150, life: 0.45, size: 2, grav: 300 });
          this.msg = 'CORTADO'; this.msgT = 0.7;
        }
      }
    }
    for (const p of this.pajas) if (p.roto > 0) { p.roto -= dt; if (p.roto <= 0) p.t = 0; }

    // --- Camara: sigue al caballero con holgura ---
    const quiere = clamp(K.x - VW / 2, 0, 9999);
    this.camX += (quiere - this.camX) * Math.min(1, 6 * dt);
  },

  onInput(ev, ctx) {
    if (ev.type === 'down') {
      if (this.bRueda.down(ev)) { this.rueda = true; return; }
      if (this.bTajo.down(ev)) { this.golpea = true; return; }
      if (this.bSalta.down(ev)) { this.salta = true; return; }
      if (ev.x < VW * 0.45 && ev.y > 120) { this.stick.down(ev); return; }
    } else if (ev.type === 'move') {
      this.stick.move(ev);
    } else {
      this.stick.up(ev); this.bSalta.up(ev); this.bTajo.up(ev); this.bRueda.up(ev);
    }
  },

  draw(g, ctx) {
    const K = this.K, cx = this.camX;
    drawMundo(g, this.W, cx, VW, VH, SUELO);

    // Muñecos de paja
    for (const p of this.pajas) {
      const x = Math.round(p.x - cx);
      if (x < -20 || x > VW + 20) continue;
      if (p.roto > 0) {
        // Partido: el poste queda, la paja en el suelo
        g.fillStyle = PM.hier; g.fillRect(x - 1, SUELO - 10, 3, 10);
        g.fillStyle = PM.hueso; g.fillRect(x - 6, SUELO - 2, 12, 2);
      } else {
        // Un muñeco de entrenamiento: poste, brazos en cruz, torso de paja
        // atado con cuerda y un yelmo viejo encima.
        g.fillStyle = PM.hier; g.fillRect(x - 1, SUELO - 30, 3, 30);
        g.fillStyle = PM.hier; g.fillRect(x - 10, SUELO - 22, 21, 2);   // los brazos
        g.fillStyle = PM.hueso; g.fillRect(x - 6, SUELO - 24, 13, 15);  // la paja
        g.fillStyle = PM.hier2; g.fillRect(x - 6, SUELO - 19, 13, 1);   // cuerdas
        g.fillStyle = PM.hier2; g.fillRect(x - 6, SUELO - 14, 13, 1);
        g.fillStyle = PM.sue2; g.fillRect(x - 6, SUELO - 24, 13, 1);
        // El yelmo
        g.fillStyle = PM.hier; g.fillRect(x - 5, SUELO - 32, 11, 8);
        g.fillStyle = PM.sue4; g.fillRect(x - 3, SUELO - 29, 7, 2);     // la ranura
        g.fillStyle = PM.hier2; g.fillRect(x - 5, SUELO - 32, 11, 1);
      }
    }

    // Sombra del caballero: se encoge cuanto mas alto esta
    const altura = SUELO - K.y;
    const sw = Math.max(5, 14 - altura * 0.12);
    g.globalAlpha = Math.max(0.15, 0.45 - altura * 0.004);
    g.fillStyle = '#000000';
    g.fillRect(Math.round(K.x - cx - sw / 2), SUELO - 1, Math.round(sw), 2);
    g.globalAlpha = 1;

    // El caballero
    const [p, f] = C.pose(K);
    const parpadea = K.iframe > 0 && (((K.iframe * 14) | 0) & 1);
    if (!parpadea) drawCaballero(g, this.S, K.x - cx, K.y, K.dir, p, f);

    // El arco del tajo: tres medias lunas concentricas que se apagan. Es lo
    // que hace que el espadazo se VEA, mas que el sprite.
    if (K.st === C.TAJO && K.tajoT < 0.22) {
      const u = clamp((K.tajoT - 0.05) / 0.17, 0, 1);
      const a0 = -1.1 + u * 2.0;              // barre de arriba hacia abajo
      const ox = K.x - cx + K.dir * 4, oy = K.y - 16;
      g.save();
      g.translate(ox, oy);
      if (K.dir < 0) g.scale(-1, 1);
      // Tres cintas FINAS y escalonadas, no un abanico macizo: la de fuera es
      // ancha y tenue (la estela), la de dentro es un filo blanco de 2 px.
      // Con el ancho de antes el arco se leia como un escudo, no como un corte.
      for (const [r0, r1, col, al, ar] of [[26, 34, PC.bld1, 0.30, 0.62],
                                           [24, 30, '#b9e8ff', 0.55, 0.40],
                                           [25, 27, '#ffffff', 0.95, 0.26]]) {
        g.globalAlpha = al * (1 - u * 0.75);
        g.fillStyle = col;
        g.beginPath();
        g.arc(0, 0, r1, a0 - ar, a0 + ar);
        g.arc(0, 0, r0, a0 + ar, a0 - ar, true);
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
    }

    this.drawHud(g);
    this.drawControles(g);
  },

  drawHud(g) {
    // Franja de arriba con lo que hay que probar
    g.globalAlpha = 0.45; g.fillStyle = '#14121a'; g.fillRect(0, 0, VW, 30); g.globalAlpha = 1;
    text(g, 'PRUEBA DE MOVIMIENTO', 8, 5, PC.gld, 2);
    text(g, 'NO HAY JEFE TODAVIA', 8, 17, '#8996a8', 1);
    const s = `TAJOS ${this.golpes}  SALTOS ${this.saltos}  RODADAS ${this.rodadas}`;
    text(g, s, VW - 8 - measure(s, 1), 17, '#8996a8', 1);
    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, 40, PC.gld, 2);
  },

  drawControles(g) {
    // Stick: solo se ve cuando el pulgar lo despierta
    if (this.stick.active) {
      const ox = Math.round(this.stick.ox), oy = Math.round(this.stick.oy);
      g.globalAlpha = 0.25; g.fillStyle = PC.st3;
      g.fillRect(ox - 30, oy - 30, 60, 2); g.fillRect(ox - 30, oy + 28, 60, 2);
      g.fillRect(ox - 30, oy - 30, 2, 60); g.fillRect(ox + 28, oy - 30, 2, 60);
      g.globalAlpha = 1; g.fillStyle = PC.st4;
      g.fillRect(Math.round(ox + this.stick.dx * 30) - 4, Math.round(oy + this.stick.dy * 30) - 4, 9, 9);
    } else {
      g.globalAlpha = 0.18; g.fillStyle = PC.st3;
      g.fillRect(58, SUELO + 18, 34, 2); g.fillRect(74, SUELO + 4, 2, 30);
      g.globalAlpha = 1;
    }
    const K = this.K;
    boton(g, this.bSalta, 17, PC.st1, PC.st3, 'SALTA', false);
    boton(g, this.bTajo, 20, '#6b1128', '#c73a5e', 'TAJO', false);
    boton(g, this.bRueda, 16, PC.st1, PC.st3, 'RUEDA', K.rollCd > 0);
  },

  destroy() { this.S = null; this.W = null; },
};

function boton(g, b, r, fondo, borde, txt, frio) {
  g.globalAlpha = frio ? 0.28 : (b.pressed ? 0.95 : 0.62);
  g.fillStyle = fondo;
  g.fillRect(b.x - r, b.y - r, r * 2, r * 2);
  g.fillStyle = borde;
  g.fillRect(b.x - r, b.y - r, r * 2, 2);
  g.fillRect(b.x - r, b.y + r - 2, r * 2, 2);
  g.fillRect(b.x - r, b.y - r, 2, r * 2);
  g.fillRect(b.x + r - 2, b.y - r, 2, r * 2);
  g.globalAlpha = 1;
  textCenter(g, txt, b.x, b.y - 3, frio ? '#5a5560' : '#ffffff', 1);
}
