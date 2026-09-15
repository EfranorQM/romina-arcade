// Juega LA MASA sola dentro de la app, con el piloto LISTA del arnes (entra
// por el lado blando, esquiva fuera de la linea amarilla, no machaca), y va
// contando lo que pasa. Sirve para VER la ceremonia de la muda, los letreros
// y la pantalla final sin jugar a mano, y para cazar errores de JavaScript
// que el arnes de Node no puede ver (dibujo, sonido, pulgar).
//
// Uso:
//   VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[7],{seed:7});espera700;archivo:tools/prueba-masa-app.js;espera9000;disparo;espera9000;disparo;...;archivo:tools/prueba-masa-app.js"
//
// La primera llamada engancha el piloto; las siguientes devuelven el estado.
(() => {
  const A = window.__arcade;
  const g = A.sm.cur;
  if (!g || g.meta.id !== 'masa') return 'la masa no esta activa';

  if (window.__pm) {
    const s = window.__pm;
    const P = g.P;
    return JSON.stringify({
      ronda: P.M.ronda, estado: P.estado, t: Math.round(P.t), hp: P.K.hp, score: Math.floor(P.score),
      mudas: s.mudas, lineas: s.lineas, fin: g.fin, gano: g.gano, errores: s.errores, frames: s.frames,
      msPeor: Math.round(s.msPeor * 100) / 100, msMedia: Math.round(s.msTotal / Math.max(1, s.frames) * 1000) / 1000,
      habitos: P.mn.habitos,
    });
  }

  const s = window.__pm = { mudas: 0, lineas: [], errores: [], frames: 0, msPeor: 0, msTotal: 0, listo: false };
  window.addEventListener('error', e => s.errores.push(String(e.message)));

  import('/js/games/masa-cuerpo.js').then(C => {
    const st = { ang: 0, reAng: 0, tellT: -1, reac: false, dashed: false, lat: 0.22, tGolpe: 0, idx: 0 };
    let seed = 99;
    const r = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
    const DIRX = [0, 0, -1, 1], DIRY = [1, -1, 0, 0];
    const DT = 1 / 60;

    function sectorBlando(M) {
      let best = 0, bc = 1e9;
      for (let c = 0; c < C.NR; c++) {
        let cost = 0;
        for (let k = -1; k <= 1; k++) { const sc = (c + k + C.NR) % C.NR; cost += M.placa[sc] * 3 + (M.herida === sc ? -6 : 0); }
        cost += r() * 0.5;
        if (cost < bc) { bc = cost; best = c; }
      }
      return best * Math.PI * 2 / C.NR;
    }
    function fueraDeLaLinea(M, K) {
      const ax = M.aimX - M.x, ay = M.aimY - M.y, am = Math.hypot(ax, ay) || 1;
      let px = -ay / am, py = ax / am;
      if ((K.x - M.x) * px + (K.y - M.y) * py < 0) { px = -px; py = -py; }
      return [px, py];
    }
    function piloto(game) {
      const P = game.P, K = P.K, M = P.M;
      game.stick.dx = 0; game.stick.dy = 0;
      if (P.estado !== 'pelea') return;
      const dxm = M.x - K.x, dym = M.y - K.y, d = Math.hypot(dxm, dym) || 1;
      const angK = Math.atan2(K.y - M.y, K.x - M.x);
      const rad = C.radioEn(M, angK);
      if (M.aimOn && st.tellT < 0) { st.tellT = 0; st.reac = false; st.dashed = false; st.lat = 0.18 + r() * 0.1; }
      if (!M.aimOn) st.tellT = -1;
      if (st.tellT >= 0) {
        st.tellT += DT;
        if (st.tellT >= st.lat) {
          if (!st.reac) { st.reac = true; st.reacOk = r() < 0.92; }
          if (st.reacOk) {
            if (K.dCd <= 0 && !st.dashed) { st.dashed = true; const e = fueraDeLaLinea(M, K); game.stick.dx = e[0]; game.stick.dy = e[1]; game.dash = true; }
            else { const e = fueraDeLaLinea(M, K); game.stick.dx = e[0]; game.stick.dy = e[1]; }
            return;
          }
        }
      }
      // Solo se aparta del toro quien reacciono al aviso (igual que el arnes).
      if (M.st === C.EMBISTE) {
        if (st.reacOk) {
          const px = -M.ly, py = M.lx;
          const rel = (K.x - M.x) * px + (K.y - M.y) * py;
          const adelante = (K.x - M.x) * M.lx + (K.y - M.y) * M.ly;
          if (adelante > -10 && Math.abs(rel) < 40) { const sg = rel >= 0 ? 1 : -1; game.stick.dx = px * sg; game.stick.dy = py * sg; }
        }
        return;
      }
      st.reAng -= DT;
      if (d > rad + 60 || st.reAng <= 0) { st.ang = sectorBlando(M) + (r() - 0.5) * 0.3; st.reAng = 1.5 + r() * 2; }
      const tx = M.x + Math.cos(st.ang) * (rad + 20), ty = M.y + Math.sin(st.ang) * (rad + 20);
      const ex = tx - K.x, ey = ty - K.y, ed = Math.hypot(ex, ey);
      if (ed > 7) { game.stick.dx = ex / ed; game.stick.dy = ey / ed; return; }
      const fx = DIRX[K.face], fy = DIRY[K.face];
      const proj = dxm * fx + dym * fy, lat = Math.abs(dxm * fy - dym * fx);
      if (proj < 0 || lat > 13 + rad * 0.8) { game.stick.dx = dxm / d * 0.5; game.stick.dy = dym / d * 0.5; return; }
      st.tGolpe -= DT;
      if (st.tGolpe <= 0) {
        const acto = ['G', 'G', 'W'][st.idx % 3]; st.idx++;
        st.tGolpe = 0.36 + r() * 0.1;
        if (acto === 'G') game.golpe = true;
      }
    }

    const orig = g.update;
    g.update = function (dt, ctx) {
      const t0 = performance.now();
      piloto(this);
      const rnAntes = this.P.rn;
      orig.call(this, dt, ctx);
      const ms = performance.now() - t0;
      s.frames++; s.msTotal += ms; if (ms > s.msPeor) s.msPeor = ms;
      // Los eventos de la pelea se quedan puestos durante el hitstop (la
      // pelea no avanza): solo se cuentan en el frame en que aparecen.
      if (this.P.rn !== rnAntes) for (let i = 0; i < this.P.evN; i++) if (this.P.evT[i] === 1) { s.mudas++; s.lineas.push(this.P.lineas.slice()); }
    };
    s.listo = true;
  });
  return 'piloto enganchado';
})();
