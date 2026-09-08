// Input tactil: Pointer Events, multitouch, joystick flotante y arrastre directo.
// Cada dedo se asigna a UN solo control (arbitraje por pointerId).
import { view, VW, VH, clamp } from './core.js';

export const pointers = new Map();   // pointerId -> {x,y,sx,sy,owner}
let listeners = [];

function toVirtual(e) {
  return {
    x: (e.clientX - view.ox) / view.scale,
    y: (e.clientY - view.oy) / view.scale,
  };
}

export function initInput(canvas, onEvent) {
  const emit = (type, e, p) => onEvent({ type, x: p.x, y: p.y, id: e.pointerId });

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = toVirtual(e);
    pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, owner: null });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    emit('down', e, p);
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    e.preventDefault();
    const rec = pointers.get(e.pointerId);
    if (!rec) return;
    const p = toVirtual(e);
    rec.x = p.x; rec.y = p.y;
    emit('move', e, p);
  }, { passive: false });

  const up = e => {
    e.preventDefault();
    const rec = pointers.get(e.pointerId);
    if (!rec) return;
    const p = toVirtual(e);
    pointers.delete(e.pointerId);
    emit('up', e, p);
  };
  canvas.addEventListener('pointerup', up, { passive: false });
  canvas.addEventListener('pointercancel', up, { passive: false });

  // Mata toda interferencia del navegador.
  const kill = e => e.preventDefault();
  canvas.addEventListener('contextmenu', kill);
  canvas.addEventListener('touchstart', kill, { passive: false });
  canvas.addEventListener('touchmove', kill, { passive: false });
  canvas.addEventListener('dblclick', kill);
}

// ---------- Joystick flotante: nace donde cae el pulgar ----------
export class Stick {
  constructor(maxR = 26, dead = 4) { this.maxR = maxR; this.dead = dead; this.reset(); }
  reset() { this.id = null; this.ox = 0; this.oy = 0; this.x = 0; this.y = 0; this.dx = 0; this.dy = 0; this.active = false; }
  down(ev) {
    if (this.id !== null) return false;
    this.id = ev.id; this.ox = ev.x; this.oy = ev.y; this.x = ev.x; this.y = ev.y;
    this.dx = 0; this.dy = 0; this.active = true;
    return true;
  }
  move(ev) {
    if (ev.id !== this.id) return false;
    this.x = ev.x; this.y = ev.y;
    let dx = ev.x - this.ox, dy = ev.y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d < this.dead) { this.dx = 0; this.dy = 0; return true; }
    if (d > this.maxR) {
      // El centro sigue al dedo si se pasa del radio (se siente mejor que topar).
      this.ox = ev.x - dx / d * this.maxR;
      this.oy = ev.y - dy / d * this.maxR;
      dx = dx / d * this.maxR; dy = dy / d * this.maxR;
    }
    this.dx = dx / this.maxR; this.dy = dy / this.maxR;
    return true;
  }
  up(ev) {
    if (ev.id !== this.id) return false;
    this.reset();
    return true;
  }
}

// ---------- Boton con area de toque mayor que la visual ----------
export class Button {
  constructor(x, y, r, pad = 10) { this.x = x; this.y = y; this.r = r; this.pad = pad; this.id = null; this.pressed = false; this.justPressed = false; }
  hit(ev) { return Math.hypot(ev.x - this.x, ev.y - this.y) <= this.r + this.pad; }
  down(ev) {
    if (this.id !== null || !this.hit(ev)) return false;
    this.id = ev.id; this.pressed = true; this.justPressed = true;
    return true;
  }
  up(ev) {
    if (ev.id !== this.id) return false;
    this.id = null; this.pressed = false;
    return true;
  }
  consume() { const j = this.justPressed; this.justPressed = false; return j; }
}

export function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}
