// Mide las poses de ROMINA en pixeles, sin navegador.
//
// dibujaPose() devuelve el lienzo crudo (un array de colores por celda), asi
// que se puede contar SIN canvas: cuantas celdas de cada color, donde empieza
// y acaba cada fila, cuanto asoma la enagua por debajo del vestido, que ancho
// tiene el torso frente a la falda.
//
// Uso:  node tools/medir-romina.js [pose]
const path = require('path');
const url = require('url');

const GAMES = path.join(__dirname, '..', 'www', 'js', 'games');
const imp = f => import(url.pathToFileURL(path.join(GAMES, f)).href);

// El lienzo se dibuja en el modulo de arte, que no toca el DOM salvo en
// aCanvas(); dibujaPose() no lo llama, asi que no hace falta simular nada.
(async () => {
  const { POSES } = await imp('romi-anim.js');
  const { dibujaPose } = await imp('romi-pose.js');
  const { P, W, H } = await imp('romi-art.js');

  const NOMBRE = {};
  for (const k in P) NOMBRE[P[k]] = k;

  const soloPose = process.argv[2];

  for (const k in POSES) {
    if (soloPose && k !== soloPose) continue;
    console.log('\n=== ' + k.toUpperCase() + ' ===');
    POSES[k].forEach((p, i) => {
      const L = dibujaPose(p);
      const cuenta = {};
      let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
      // por color: cuantas celdas, y en que franja de filas cae
      const franja = {};
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = L.d[y * W + x];
          if (!c) continue;
          const n = NOMBRE[c] || c;
          cuenta[n] = (cuenta[n] || 0) + 1;
          if (!franja[n]) franja[n] = [y, y, x, x];
          const f = franja[n];
          if (y < f[0]) f[0] = y; if (y > f[1]) f[1] = y;
          if (x < f[2]) f[2] = x; if (x > f[3]) f[3] = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
        }
      }
      // anchos por fila util
      const anchoEn = y => {
        let a = 1e9, b = -1e9;
        for (let x = 0; x < W; x++) if (L.d[y * W + x]) { if (x < a) a = x; if (x > b) b = x; }
        return b < a ? 0 : b - a + 1;
      };
      const cad = p.cadY, tor = cad + p.torY;
      const yPecho = Math.round(tor - 34 * 0.5);
      const yTalle = Math.round(tor + 34 * 0.5 - 1);
      const yBajo = Math.round(cad + p.falAlto);
      console.log(`  [${i}] caja x ${x0}..${x1} (${x1 - x0 + 1}) y ${y0}..${y1} (${y1 - y0 + 1})`);
      console.log(`      ancho  pecho(y${yPecho})=${anchoEn(yPecho)}  talle(y${yTalle})=${anchoEn(yTalle)}  cadera(y${cad})=${anchoEn(cad)}  bajo(y${yBajo - 2})=${anchoEn(yBajo - 2)}`);
      const clave = ['fal1', 'fal2', 'fal3', 'ves1', 'ves2', 'ves3', 'ves4', 'piel1', 'piel2', 'piel3', 'bla1', 'bla2'];
      const linea = clave.filter(c => cuenta[c]).map(c => {
        const f = franja[c];
        return `${c}=${cuenta[c]}(y${f[0]}-${f[1]},x${f[2]}-${f[3]})`;
      }).join(' ');
      console.log('      ' + linea);
    });
  }
})();
