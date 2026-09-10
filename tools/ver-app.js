// Corre la app REAL en Chrome y guarda capturas, para ver el menu y los juegos
// sin compilar el APK ni tocar el telefono.
//
// Habla el protocolo de DevTools por WebSocket: asi puede esperar a que el
// canvas dibuje, mandar toques y arrastres de verdad, y leer los errores de la
// consola. Un --screenshot a secas no serviria: dispara antes de que el bucle
// haya pintado nada y no permite interactuar.
//
// Uso:  node tools/ver-app.js <salida.png> [guion]
//   guion = lista de pasos separados por punto y coma, cada uno:
//     esperaN        espera N milisegundos
//     tocaX:Y        toque corto en (X,Y), en pixeles de PANTALLA
//     arrastraX:Y:X2:Y2   arrastra de (X,Y) a (X2,Y2)
//     tiroX:Y:X2:Y2  arrastra rapido y suelta (gesto de impulso)
//     pulsaX:Y       apoya el dedo y lo DEJA puesto
//     mueveX:Y       mueve el dedo apoyado
//     sueltaX:Y      levanta el dedo
//     js:EXPR        evalua EXPR en la pagina (para llegar a una escena)
//     archivo:RUTA   evalua un .js del proyecto (para guiones con ';' dentro)
//     disparo        guarda una captura numerada
//
// Ejemplo:
//   node tools/ver-app.js menu.png "espera900;disparo;tiro700:300:200:300;espera400;disparo"
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const OUT = path.resolve(process.argv[2] || 'app.png');
// Los pasos se separan por ';' y no por ',': un paso js: lleva comas dentro.
const SCRIPT = (process.argv[3] || 'espera1200;disparo').split(';').map(s => s.trim()).filter(Boolean);
const URL_APP = process.argv[4] || 'http://localhost:8080/';
// Pantalla del Redmi Note 10, a la mitad para que quepa en una ventana.
// Por defecto acostada (para el menu); con la variable VERTICAL=1 se pone de
// pie, que es como esta el telefono al jugar.
const VERT = process.env.VERTICAL === '1';
const W = VERT ? 540 : 1200, H = VERT ? 1200 : 540;

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const exe = CHROMES.find(p => fs.existsSync(p));
if (!exe) { console.error('No se encontro Chrome ni Edge.'); process.exit(1); }

const PORT = 9333 + (process.pid % 400);
const profile = path.join(require('os').tmpdir(), 'romina-cdp-' + process.pid);

const chrome = spawn(exe, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--window-size=' + W + ',' + H,
  '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check',
  URL_APP,
], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', () => {});

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await getJSON('http://127.0.0.1:' + PORT + '/json/list');
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) { /* aun no levanta */ }
    await sleep(250);
  }
  throw new Error('Chrome no expuso ninguna pestana en el puerto ' + PORT);
}

// Cliente CDP minimo sobre el WebSocket, sin dependencias: el handshake y el
// enmarcado de RFC 6455 son cortos y evitan sumar un paquete al proyecto.
const crypto = require('crypto');
const net = require('net');

class CDP {
  constructor(wsUrl) {
    const u = new (require('url').URL)(wsUrl);
    this.host = u.hostname; this.port = u.port; this.pathn = u.pathname;
    this.id = 0; this.waiting = new Map(); this.events = [];
    this.buf = Buffer.alloc(0);
  }
  connect() {
    return new Promise((res, rej) => {
      const key = crypto.randomBytes(16).toString('base64');
      this.sock = net.connect(this.port, this.host, () => {
        this.sock.write(
          'GET ' + this.pathn + ' HTTP/1.1\r\n' +
          'Host: ' + this.host + ':' + this.port + '\r\n' +
          'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
          'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
      });
      let handshook = false;
      this.sock.on('data', d => {
        if (!handshook) {
          const s = d.toString('latin1');
          const i = s.indexOf('\r\n\r\n');
          if (i === -1) return;
          handshook = true;
          this.buf = Buffer.concat([this.buf, d.slice(Buffer.byteLength(s.slice(0, i + 4), 'latin1'))]);
          this.pump(); res();
          return;
        }
        this.buf = Buffer.concat([this.buf, d]);
        this.pump();
      });
      this.sock.on('error', rej);
    });
  }
  pump() {
    for (;;) {
      if (this.buf.length < 2) return;
      const b1 = this.buf[1], len0 = b1 & 127;
      let off = 2, len = len0;
      if (len0 === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len0 === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (this.buf.length < off + len) return;
      const payload = this.buf.slice(off, off + len).toString('utf8');
      this.buf = this.buf.slice(off + len);
      let msg; try { msg = JSON.parse(payload); } catch (e) { continue; }
      if (msg.id && this.waiting.has(msg.id)) { this.waiting.get(msg.id)(msg); this.waiting.delete(msg.id); }
      else if (msg.method) this.events.push(msg);
    }
  }
  send(method, params) {
    const id = ++this.id;
    const data = Buffer.from(JSON.stringify({ id, method, params: params || {} }));
    // Trama de cliente: siempre enmascarada.
    const mask = crypto.randomBytes(4);
    const n = data.length;
    let head;
    if (n < 126) { head = Buffer.alloc(2); head[1] = 128 | n; }
    else if (n < 65536) { head = Buffer.alloc(4); head[1] = 128 | 126; head.writeUInt16BE(n, 2); }
    else { head = Buffer.alloc(10); head[1] = 128 | 127; head.writeBigUInt64BE(BigInt(n), 2); }
    head[0] = 0x81;
    const masked = Buffer.alloc(n);
    for (let i = 0; i < n; i++) masked[i] = data[i] ^ mask[i & 3];
    this.sock.write(Buffer.concat([head, mask, masked]));
    return new Promise(res => this.waiting.set(id, res));
  }
}

// ---------- Gestos ----------
async function touch(cdp, x, y, type) {
  await cdp.send('Input.dispatchMouseEvent', {
    type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1,
    pointerType: 'touch',
  });
}

async function drag(cdp, x1, y1, x2, y2, steps, stepMs) {
  await touch(cdp, x1, y1, 'mousePressed');
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch(cdp, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 'mouseMoved');
    await sleep(stepMs);
  }
  await touch(cdp, x2, y2, 'mouseReleased');
}

(async () => {
  const target = await findTarget();
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');

  let shot = 0;
  const shots = [];
  for (const step of SCRIPT) {
    let m;
    if ((m = step.match(/^espera(\d+)$/))) await sleep(+m[1]);
    else if ((m = step.match(/^toca(-?\d+):(-?\d+)$/))) {
      await touch(cdp, +m[1], +m[2], 'mousePressed');
      await sleep(60);
      await touch(cdp, +m[1], +m[2], 'mouseReleased');
    }
    else if ((m = step.match(/^arrastra(-?\d+):(-?\d+):(-?\d+):(-?\d+)$/))) {
      await drag(cdp, +m[1], +m[2], +m[3], +m[4], 14, 16);
    }
    else if ((m = step.match(/^tiro(-?\d+):(-?\d+):(-?\d+):(-?\d+)$/))) {
      await drag(cdp, +m[1], +m[2], +m[3], +m[4], 5, 8);
    }
    // Mantener pulsado y soltar son pasos SEPARADOS: un juego que dispara
    // mientras el boton esta apretado no se puede probar con un toque suelto,
    // porque para cuando se lee el estado el dedo ya se levanto.
    else if ((m = step.match(/^pulsa(-?\d+):(-?\d+)$/))) {
      await touch(cdp, +m[1], +m[2], 'mousePressed');
    }
    else if ((m = step.match(/^suelta(-?\d+):(-?\d+)$/))) {
      await touch(cdp, +m[1], +m[2], 'mouseReleased');
    }
    // Mueve un dedo ya apoyado, sin soltarlo (para la cruceta).
    else if ((m = step.match(/^mueve(-?\d+):(-?\d+)$/))) {
      await touch(cdp, +m[1], +m[2], 'mouseMoved');
    }
    else if ((m = step.match(/^archivo:(.+)$/))) {
      // Evalua un archivo .js del proyecto en la pagina. Sirve para guiones que
      // llevan punto y coma dentro, que como paso js: se partirian en trozos.
      const src = fs.readFileSync(path.resolve(m[1].trim()), 'utf8');
      const r = await cdp.send('Runtime.evaluate', {
        expression: src, awaitPromise: true, returnByValue: true,
      });
      const ex = r.result && r.result.exceptionDetails;
      if (ex) console.error('archivo fallo: ' + (ex.exception ? ex.exception.description : ex.text));
      else {
        const v = r.result && r.result.result && r.result.result.value;
        if (v !== undefined) console.log(m[1].trim() + ' -> ' + JSON.stringify(v));
      }
    }
    else if ((m = step.match(/^js:(.+)$/))) {
      // Evalua una expresion en la pagina. Sirve para llevar la app a un estado
      // concreto (un fin de partida, un record) sin tener que jugar hasta el.
      const r = await cdp.send('Runtime.evaluate', {
        expression: m[1], awaitPromise: true, returnByValue: true,
      });
      const ex = r.result && r.result.exceptionDetails;
      if (ex) console.error('js fallo: ' + (ex.exception ? ex.exception.description : ex.text));
      else {
        // El valor se imprime: asi la prueba puede LEER el estado interno, no
        // solo mirarlo dibujado.
        const v = r.result && r.result.result && r.result.result.value;
        if (v !== undefined) console.log('js -> ' + JSON.stringify(v));
      }
    }
    else if (step === 'disparo') {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const data = r.result && r.result.data;
      if (!data) { console.error('captura vacia'); continue; }
      const name = SCRIPT.filter(s => s === 'disparo').length > 1
        ? OUT.replace(/\.png$/, '_' + (++shot) + '.png') : OUT;
      fs.writeFileSync(name, Buffer.from(data, 'base64'));
      shots.push(name);
    }
    else console.error('paso desconocido: ' + step);
  }

  // Errores de la pagina: sin esto un fallo de JS pasa por "pantalla negra".
  const errs = cdp.events.filter(e =>
    e.method === 'Log.entryAdded' && e.params.entry.level === 'error'
    || e.method === 'Runtime.exceptionThrown');
  for (const e of errs) {
    const t = e.params.entry ? e.params.entry.text
      : (e.params.exceptionDetails && (e.params.exceptionDetails.text + ' ' +
         ((e.params.exceptionDetails.exception || {}).description || '')));
    console.error('ERROR EN LA PAGINA: ' + t);
  }

  chrome.kill();
  for (const s of shots) console.log('escrito ' + s);
  process.exit(errs.length ? 2 : 0);
})().catch(e => { console.error(e.message); try { chrome.kill(); } catch (_) {} process.exit(1); });
