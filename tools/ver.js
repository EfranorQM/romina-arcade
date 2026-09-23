// Renderiza una pagina de vista previa con Chrome headless y guarda el PNG.
//
// Existe porque el arte de esta app se dibuja por codigo y hay que MIRARLO para
// juzgarlo. A diferencia de tools/raster.py (que reimplementa canvas en PIL y
// por eso puede mentir), esto usa el canvas de verdad: lo que sale en el PNG es
// exactamente lo que va a salir en el telefono.
//
// Uso:  node tools/ver.js tools/ver-portadas.html salida.png [ancho] [alto]
//
// Sirve la RAIZ del proyecto (no solo www/), para que una pagina de tools/
// pueda importar los modulos reales de www/js/ con rutas relativas.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// .mjs tambien es JavaScript: servido como binario, Chrome no lo carga como
// modulo (tools/piloto-aventura.mjs, que usa tools/ver-aventura.html).
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const ROOT = path.join(__dirname, '..');

const page = process.argv[2] || 'tools/ver-portadas.html';
const out = path.resolve(process.argv[3] || 'vista.png');
const W = parseInt(process.argv[4] || '780', 10);
const H = parseInt(process.argv[5] || '1500', 10);

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const chrome = CHROMES.find(p => fs.existsSync(p));
if (!chrome) { console.error('No se encontro Chrome ni Edge.'); process.exit(1); }

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('403'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(0, () => {
  const port = server.address().port;
  const url = 'http://localhost:' + port + '/' + page.replace(/\\/g, '/');
  const args = [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=' + W + ',' + H,
    '--screenshot=' + out,
    '--virtual-time-budget=4000',
    url,
  ];
  const p = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => { err += d; });
  p.on('exit', code => {
    server.close();
    if (code !== 0 || !fs.existsSync(out)) {
      console.error('Chrome fallo (codigo ' + code + '):\n' + err.split('\n').slice(-6).join('\n'));
      process.exit(1);
    }
    console.log('escrito ' + out + ' (' + fs.statSync(out).size + ' bytes)');
  });
});
