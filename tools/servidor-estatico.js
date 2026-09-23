// Servidor estatico minimo: node tools/servidor-estatico.js CARPETA PUERTO [cors]
//
// Para EMULAR EL TELEFONO (tools/emula-telefono.js): uno sirve el APK
// (android/app/src/main/assets/public) como si fuera la app, y otro, con
// 'cors', sirve www/ como si fuera GitHub Pages, de donde se descargan las
// actualizaciones. Dos origenes distintos, como en el telefono (la app en
// https://localhost, la descarga en github.io): con uno solo, los fallos de
// "otro sitio" no salen.
const http = require('http'), fs = require('fs'), path = require('path');
const [raiz, puerto, cors] = process.argv.slice(2);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
            '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(raiz, p);
  const h = { 'Cache-Control': 'no-store' };
  if (cors) h['Access-Control-Allow-Origin'] = '*';
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404, h); return res.end('404'); }
    h['Content-Type'] = T[path.extname(f)] || 'application/octet-stream';
    res.writeHead(200, h); res.end(d);
  });
}).listen(+puerto, () => console.log('sirviendo', raiz, 'en', puerto));
