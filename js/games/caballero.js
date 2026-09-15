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
import { bakeRomina, drawRomina } from './romi-anim.js';
import { P as PC } from './romi-art.js';
import { bakeMundo, drawMundo, P as PM } from './caba-mundo.js';

const SUELO = C.SUELO;

export default {
  meta: {
    id: 'caballero', title: 'ROMINA', tag: 'PRUEBA DE MOVIMIENTO',
    colors: ['#ef4a84', '#ffe066'],
    // Apaisado y GRANDE: 1200x540 para que Romina quepa a 128x180 con detalle.
    // Sin meta.smooth: es pixel art, tiene que quedar nitido.
    vw: 1200, vh: 540, wide: true,
    pausaY: 2,
  },

  init(ctx, args) {
    this.ctx = ctx;
    this.K = C.makeCaballero(160);
    const t0 = performance.now();
    this.S = bakeRomina();
    this.msHornear = performance.now() - t0;
    this.W = bakeMundo(SUELO, VH);

    this.stick = new Stick(80, 14);
    // Los tres botones, en triangulo en la esquina de abajo a la derecha. Los
    // radios son de DIBUJO; el area de toque es r+pad y NO se solapa: los
    // centros estan a 62 px (TAJO-SALTA) y 60 (TAJO-RUEDA), y la suma de sus
    // radios de toque es 54. Medido a 0.254 mm/px: separaciones de 15 mm, muy
    // por encima de los 9 mm en que un pulgar empieza a equivocarse.
    // Cuatro botones en la esquina de abajo a la derecha. ESCUDO es el unico
    // que se mantiene apretado; los otros tres son toques.
    this.bSalta = new Button(1096, 300, 34, 20);
    this.bTajo  = new Button(1132, 428, 40, 20);
    this.bRueda = new Button(1016, 452, 32, 20);
    this.bEscudo = new Button(1016, 336, 32, 20);
    this.salta = false; this.golpea = false; this.rueda = false;

    this.camX = 0;
    this.t = 0; this.hitstop = 0;
    this.golpes = 0; this.saltos = 0; this.rodadas = 0;
    this.msg = ''; this.msgT = 0;
    this.combo = 0; this.comboT = 0;

    // Muñecos de paja: se parten de un tajo y vuelven solos a los 2 s. Solo
    // estan para que la espada tenga algo que tocar.
    this.pajas = [];
    for (let i = 0; i < 5; i++) this.pajas.push({ x: 500 + i * 160, roto: 0, t: 0 });
  },

  update(dt, ctx) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;

    const K = this.K;
    const inp = {
      dx: this.stick.dx,
      salta: this.salta, saltaAbajo: this.bSalta.pressed,
      golpea: this.golpea, rueda: this.rueda, bloquea: this.bEscudo.pressed,
    };
    const antesSuelo = K.enSuelo, antesSt = K.st, antesTajo = K.tajoId;
    const antesEsc = K.escId, antesParada = K.parada;
    this.salta = false; this.golpea = false; this.rueda = false;

    C.stepCaballero(K, inp, dt);

    // --- Sonidos y efectos de lo que acaba de pasar ---
    // Cada golpe del combo suena distinto: el tercero (el giro) mas grave y
    // con temblor. Si los tres sonaran igual, el combo no se oiria como combo.
    if (K.tajoId !== antesTajo) {
      const n = C.golpeCombo(K);
      SFX.espadazo();
      this.golpes++;
      this.combo = n + 1;
      this.comboT = 1.0;
      if (n === 2) { cam.shake(2.5, 0.1); vibrate(12); }
      else vibrate(5);
    }
    // El EMPUJON de escudo
    if (K.escId !== antesEsc) {
      SFX.clang(); vibrate(14); cam.shake(2, 0.08);
      burst(K.x + K.dir * 40, SUELO - 70, 7, { rnd: Math.random, colors: [PC.ace3, PC.oro3], speed: 170, life: 0.3, size: 4, grav: 180 });
      this.msg = 'EMPUJON'; this.msgT = 0.6;
    }
    // La PARADA perfecta: destello de oro y el aviso
    if (K.parada > 0 && antesParada <= 0) {
      SFX.clang(); vibrate(22); cam.shake(4, 0.14); this.hitstop = 7 / 60;
      burst(K.x + K.dir * 34, SUELO - 74, 18, { rnd: Math.random, colors: [PC.oro3, PC.bla2, PC.ace4], speed: 300, life: 0.5, size: 4, grav: 60 });
      this.msg = 'PARADA!'; this.msgT = 0.9;
    }
    if (!antesSuelo && K.enSuelo) {
      // Aterrizaje: polvo y un temblor chiquito
      burst(K.x, SUELO, 9, { rnd: Math.random, colors: [PM.sue1, PM.sue2], speed: 120, life: 0.32, size: 4, grav: 520 });
      SFX.aterriza(); cam.shake(1.5, 0.08);
    }
    if (antesSt !== C.SALTA && K.st === C.SALTA) { SFX.salto(); this.saltos++; vibrate(6); }
    if (antesSt !== C.RUEDA && K.st === C.RUEDA) {
      SFX.rodar(); this.rodadas++; vibrate(8);
      burst(K.x, SUELO, 8, { rnd: Math.random, colors: [PM.sue1, PM.sue3], speed: 100, life: 0.28, size: 4, grav: 400 });
    }
    // Polvo al correr
    if (K.st === C.CORRE && K.enSuelo && ((this.t * 12) | 0) % 3 === 0) {
      burst(K.x - K.dir * 14, SUELO, 1, { rnd: Math.random, colors: [PM.sue2], speed: 44, life: 0.24, size: 3, grav: 240 });
    }

    // --- La espada contra los muñecos ---
    if (C.espadaActiva(K)) {
      const [px, py] = C.puntaEspada(K);
      for (const p of this.pajas) {
        if (p.roto > 0) continue;
        if (Math.abs(p.x - px) < 34 && Math.abs(p.x - K.x) < C.ALCANCE + 20) {
          p.roto = 2.0;
          this.hitstop = 5 / 60;
          cam.shake(3, 0.12);
          SFX.corta(); vibrate(16);
          burst(p.x, SUELO - 40, 16, { rnd: Math.random, colors: [PM.hueso, PM.hier2, PM.sue1], speed: 260, life: 0.5, size: 4, grav: 560 });
          this.msg = 'CORTADO'; this.msgT = 0.7;
        }
      }
    }
    // El EMPUJON no corta, pero tumba el muñeco de un golpe de escudo.
    if (C.escudoActivo(K)) {
      const [ex, ey] = C.puntaEscudo(K);
      for (const p of this.pajas) {
        if (p.roto > 0) continue;
        if (Math.abs(p.x - ex) < 40) {
          p.roto = 1.4; this.hitstop = 4 / 60; cam.shake(2.5, 0.1);
          burst(p.x, SUELO - 50, 10, { rnd: Math.random, colors: [PM.hueso, PM.sue1], speed: 200, life: 0.4, size: 4, grav: 520 });
        }
      }
    }
    if (this.comboT > 0) this.comboT -= dt;
    for (const p of this.pajas) if (p.roto > 0) { p.roto -= dt; if (p.roto <= 0) p.t = 0; }

    // --- Camara: sigue al caballero con holgura ---
    const quiere = clamp(K.x - VW / 2, 0, 9999);
    this.camX += (quiere - this.camX) * Math.min(1, 6 * dt);
  },

  onInput(ev, ctx) {
    if (ev.type === 'down') {
      if (this.bRueda.down(ev)) { this.rueda = true; return; }
      if (this.bEscudo.down(ev)) return;
      if (this.bTajo.down(ev)) { this.golpea = true; return; }
      if (this.bSalta.down(ev)) { this.salta = true; return; }
      if (ev.x < VW * 0.45 && ev.y > 240) { this.stick.down(ev); return; }
    } else if (ev.type === 'move') {
      this.stick.move(ev);
    } else {
      this.stick.up(ev); this.bSalta.up(ev); this.bTajo.up(ev); this.bRueda.up(ev); this.bEscudo.up(ev);
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
        g.fillStyle = PM.hier; g.fillRect(x - 3, SUELO - 24, 6, 24);
        g.fillStyle = PM.hueso; g.fillRect(x - 14, SUELO - 6, 28, 6);
      } else {
        // Un muñeco de entrenamiento: poste, brazos en cruz, torso de paja
        // atado con cuerda y un yelmo viejo encima.
        g.fillStyle = PM.hier; g.fillRect(x - 3, SUELO - 108, 6, 108);
        g.fillStyle = PM.hier; g.fillRect(x - 34, SUELO - 82, 70, 6);   // los brazos
        g.fillStyle = PM.hueso; g.fillRect(x - 18, SUELO - 90, 42, 52); // la paja
        g.fillStyle = PM.hier2; g.fillRect(x - 18, SUELO - 72, 42, 4);   // cuerdas
        g.fillStyle = PM.hier2; g.fillRect(x - 18, SUELO - 54, 42, 4);
        g.fillStyle = PM.sue2; g.fillRect(x - 18, SUELO - 90, 42, 4);
        // El yelmo
        g.fillStyle = PM.hier; g.fillRect(x - 18, SUELO - 118, 38, 30);
        g.fillStyle = PM.sue4; g.fillRect(x - 12, SUELO - 108, 26, 8);   // la ranura
        g.fillStyle = PM.hier2; g.fillRect(x - 18, SUELO - 118, 38, 4);
      }
    }

    // Sombra de Romina. Era un fillRect: un rectangulo negro de 5 px que se
    // veia como una barra debajo de los pies, y saltando aun peor. Ahora es
    // una ELIPSE rasterizada a la rejilla -- se dibuja por bandas de pixeles
    // enteros, sin antialias, para que sea pixel art como el resto.
    //
    // Se encoge Y se aclara con la altura: es lo que hace leer a que altura
    // esta en el aire, que es informacion util al saltar.
    const altura = SUELO - K.y;
    const sw = Math.max(13, 30 - altura * 0.075);   // semiancho
    const sh = Math.max(2.5, 7 - altura * 0.018);   // semialto
    const sx0 = K.x - cx;
    g.globalAlpha = Math.max(0.12, 0.42 - altura * 0.0019);
    g.fillStyle = '#000000';
    // Elipse por bandas: cada fila de pixeles es un rectangulo de 1 px de alto
    for (let dy = -Math.ceil(sh); dy <= Math.ceil(sh); dy++) {
      const u = dy / sh;
      if (u * u > 1) continue;
      const w = sw * Math.sqrt(1 - u * u);
      g.fillRect(Math.round(sx0 - w), SUELO - 2 + dy, Math.round(w * 2), 1);
    }
    g.globalAlpha = 1;

    // El caballero
    const [p, f] = C.pose(K);
    const parpadea = K.iframe > 0 && (((K.iframe * 14) | 0) & 1);
    if (!parpadea) drawRomina(g, this.S, K.x - cx, K.y, K.dir, p, f);

    // El arco del tajo: tres medias lunas concentricas que se apagan. Es lo
    // que hace que el espadazo se VEA, mas que el sprite.
    if (K.st === C.TAJO && K.tajoT < 0.22) {
      const u = clamp((K.tajoT - 0.05) / 0.17, 0, 1);
      const a0 = -1.3 + u * 2.2;              // barre de arriba hacia abajo
      const ox = K.x - cx + K.dir * 10, oy = K.y - 78;
      g.save();
      g.translate(ox, oy);
      if (K.dir < 0) g.scale(-1, 1);
      // Tres cintas FINAS y escalonadas, no un abanico macizo: la de fuera es
      // ancha y tenue (la estela), la de dentro es un filo blanco de 2 px.
      // Con el ancho de antes el arco se leia como un escudo, no como un corte.
      for (const [r0, r1, col, al, ar] of [[76, 100, PC.ace3, 0.30, 0.62],
                                           [70, 88, '#b9e8ff', 0.55, 0.40],
                                           [74, 80, '#ffffff', 0.95, 0.26]]) {
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
    g.globalAlpha = 0.45; g.fillStyle = '#2b1526'; g.fillRect(0, 0, VW, 56); g.globalAlpha = 1;
    text(g, 'ROMINA - PRUEBA DE MOVIMIENTO', 14, 8, PC.oro3, 3);
    text(g, 'NO HAY JEFE TODAVIA', 14, 32, PC.ves4, 2);
    const s = `TAJOS ${this.golpes}  SALTOS ${this.saltos}  RODADAS ${this.rodadas}`;
    text(g, s, VW - 14 - measure(s, 2), 32, '#c9a9bc', 2);
    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, 72, PC.oro3, 4);
    // El CONTADOR DE COMBO. Crece con cada golpe encadenado y el tercero sale
    // en oro y mas grande: es lo que hace ver el ritmo del combo mientras se
    // juega, no solo sentirlo.
    if (this.comboT > 0 && this.combo > 1) {
      const u = Math.min(1, this.comboT * 3);
      const esc = this.combo === 3 ? 6 : 5;
      const col = this.combo === 3 ? PC.oro3 : PC.ves4;
      g.globalAlpha = Math.min(1, u * 1.4);
      textCenter(g, 'x' + this.combo, VW / 2, 118, col, esc);
      if (this.combo === 3) textCenter(g, 'GIRO', VW / 2, 164, PC.bla2, 3);
      g.globalAlpha = 1;
    }
  },

  drawControles(g) {
    // Stick: solo se ve cuando el pulgar lo despierta
    if (this.stick.active) {
      const ox = Math.round(this.stick.ox), oy = Math.round(this.stick.oy);
      g.globalAlpha = 0.25; g.fillStyle = PC.ves4;
      g.fillRect(ox - 60, oy - 60, 120, 4); g.fillRect(ox - 60, oy + 56, 120, 4);
      g.fillRect(ox - 60, oy - 60, 4, 120); g.fillRect(ox + 56, oy - 60, 4, 120);
      g.globalAlpha = 1; g.fillStyle = PC.bla2;
      g.fillRect(Math.round(ox + this.stick.dx * 60) - 8, Math.round(oy + this.stick.dy * 60) - 8, 17, 17);
    } else {
      g.globalAlpha = 0.18; g.fillStyle = PC.ves4;
      g.fillRect(116, SUELO + 36, 68, 4); g.fillRect(148, SUELO + 8, 4, 60);
      g.globalAlpha = 1;
    }
    const K = this.K;
    boton(g, this.bSalta, 34, PC.ves1, PC.ves4, 'SALTA', false);
    boton(g, this.bTajo, 40, PC.ves1, PC.oro3, 'TAJO', false);
    boton(g, this.bRueda, 32, PC.ves1, PC.ves4, 'RUEDA', K.rollCd > 0);
    boton(g, this.bEscudo, 32, PC.ace1, PC.ace3, 'ESCUDO', false);
  },

  destroy() { this.S = null; this.W = null; },
};

function boton(g, b, r, fondo, borde, txt, frio) {
  g.globalAlpha = frio ? 0.28 : (b.pressed ? 0.95 : 0.62);
  g.fillStyle = fondo;
  g.fillRect(b.x - r, b.y - r, r * 2, r * 2);
  g.fillStyle = borde;
  g.fillRect(b.x - r, b.y - r, r * 2, 4);
  g.fillRect(b.x - r, b.y + r - 4, r * 2, 4);
  g.fillRect(b.x - r, b.y - r, 4, r * 2);
  g.fillRect(b.x + r - 4, b.y - r, 4, r * 2);
  g.globalAlpha = 1;
  textCenter(g, txt, b.x, b.y - 7, frio ? '#5a5560' : '#ffffff', 2);
}
