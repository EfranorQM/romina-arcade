// Comprueba el APK COMPILADO, no el codigo fuente.
//
//   node tools/prueba-apk.mjs [ruta.apk]
//
// POR QUE EXISTE. El 15 de septiembre de 2026 publique el actualizador, lo
// probe entero en el navegador (donde funcionaba) y compile. En el telefono el
// boton decia siempre NO SE PUDO CONECTAR: el AndroidManifest llevaba
// `tools:node="remove"` sobre el permiso de INTERNET, de cuando el juego era
// 100% offline, y yo no lo quite al anadir las actualizaciones. La app se
// instalaba SIN permiso de red y sin pedir nada.
//
// Nada de lo que corria en el navegador podia cazarlo, porque el navegador
// no tiene el manifest de Android. Hay que mirar DENTRO del APK.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(here, '..');
const apk = process.argv[2] || path.join(raiz, 'RomiQuest.apk');

let fallos = 0;
const ok = (c, m) => { console.log((c ? '   ok  ' : '   MAL ') + m); if (!c) fallos++; };

if (!fs.existsSync(apk)) {
  console.error('no existe ' + apk + '\n   compila primero: cd android && ./gradlew assembleDebug');
  process.exit(1);
}
console.log(`== ${path.basename(apk)} (${(fs.statSync(apk).size / 1048576).toFixed(2)} MB) ==\n`);

// --- Los permisos, leidos con la herramienta oficial de Android ---
function buscaAapt() {
  const bases = [
    process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    'C:/Android/sdk', path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk'),
    path.join(process.env.HOME || '', 'Android/Sdk'),
  ].filter(Boolean);
  for (const b of bases) {
    const bt = path.join(b, 'build-tools');
    if (!fs.existsSync(bt)) continue;
    const vers = fs.readdirSync(bt).sort().reverse();
    for (const v of vers) {
      for (const n of ['aapt2.exe', 'aapt2', 'aapt.exe', 'aapt']) {
        const p = path.join(bt, v, n);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

console.log('== 1) PERMISOS ==');
const aapt = buscaAapt();
if (!aapt) {
  console.log('   (sin aapt: no se pueden comprobar los permisos)');
} else {
  const out = execSync(`"${aapt}" dump permissions "${apk}"`, { encoding: 'utf8' });
  const perms = [...out.matchAll(/uses-permission: name='([^']+)'/g)].map(m => m[1]);
  console.log('   ' + perms.join('\n   '));
  // INTERNET es lo que hace funcionar el boton de actualizar. Sin el, la app
  // se instala sin pedir nada y el boton falla siempre.
  ok(perms.includes('android.permission.INTERNET'),
     'tiene permiso de INTERNET (lo necesita el boton de actualizar)');
  // Las FOTOS (READ_MEDIA_IMAGES, y READ_EXTERNAL_STORAGE en Android 12 o
  // menos) eran del juego GALERIA. El juego se quito el 15-09-2026 pero el
  // permiso siguio en el APK hasta el 23-09, cuando Anderson pidio quitarlo:
  // Android se lo seguia ensenando a ella como "Fotos y videos". Ninguno de
  // los permisos de fotos o almacenamiento puede volver sin que esto falle.
  const deFotos = perms.filter(p => /READ_MEDIA_|_EXTERNAL_STORAGE|ACCESS_MEDIA_LOCATION/.test(p));
  ok(deFotos.length === 0,
     'NO pide fotos ni almacenamiento' + (deFotos.length ? ' -> pide ' + deFotos.join(', ') : ''));
}

// --- El nombre y el icono ---
console.log('\n== 2) NOMBRE E ICONO ==');
if (aapt) {
  const badging = execSync(`"${aapt}" dump badging "${apk}"`, { encoding: 'utf8' });
  const label = (badging.match(/application-label:'([^']+)'/) || [])[1];
  const icon = (badging.match(/application-icon-\d+:'([^']+)'/) || [])[1];
  console.log(`   nombre: ${label}`);
  console.log(`   icono:  ${icon}`);
  ok(label === 'RomiQuest', 'la app se llama RomiQuest');
  ok(!!icon && icon.includes('ic_launcher'), 'declara un icono de lanzador');
}

// --- El contenido web ---
console.log('\n== 3) EL JUEGO DENTRO DEL APK ==');
const { execFileSync } = await import('child_process');
const lista = execSync(`powershell -NoProfile -Command "Add-Type -A System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead('${apk.replace(/\\/g, '/')}').Entries | ForEach-Object { $_.FullName }"`, { encoding: 'utf8' })
  .split('\n').map(s => s.trim()).filter(Boolean);

const web = lista.filter(n => n.startsWith('assets/public/'));
ok(web.length > 40, `lleva el juego entero (${web.length} ficheros en assets/public/)`);
ok(web.includes('assets/public/sw.js'), 'lleva el service worker (sw.js)');
ok(web.includes('assets/public/js/update.js'), 'lleva el modulo de actualizacion');
ok(web.includes('assets/public/index.html'), 'lleva el index.html');

// --- Que lo de dentro sea lo mismo que lo de www/ ---
console.log('\n== 4) COINCIDE CON www/ ==');
const crypto = await import('crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const leeDelApk = (n) => {
  const tmp = path.join(process.env.TEMP || '/tmp', 'apkcheck_' + Date.now());
  execSync(`powershell -NoProfile -Command "Add-Type -A System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${apk.replace(/\\/g, '/')}'); $e=$z.GetEntry('${n}'); [IO.Compression.ZipFileExtensions]::ExtractToFile($e,'${tmp.replace(/\\/g, '/')}',$true); $z.Dispose()"`);
  const b = fs.readFileSync(tmp); fs.unlinkSync(tmp); return b;
};
let iguales = 0, distintos = [];
for (const f of ['js/update.js', 'sw.js', 'js/main.js', 'js/menu.js', 'js/games/caballero.js']) {
  const dentro = leeDelApk('assets/public/' + f);
  const fuera = fs.readFileSync(path.join(raiz, 'www', f));
  if (sha(dentro) === sha(fuera)) iguales++; else distintos.push(f);
}
// NOTA: es NORMAL que js/update.js difiera si se ha publicado despues de
// compilar -- publica.mjs sube el numero de version en www/ y el APK se queda
// con el anterior. Esa diferencia es justo el trabajo que hara el boton de
// actualizar. Solo es un problema si difieren OTROS ficheros, o si el APK se
// acaba de compilar.
const soloVersion = distintos.length === 1 && distintos[0] === 'js/update.js';
ok(distintos.length === 0 || soloVersion,
   `los ficheros del APK coinciden con www/ (${iguales}/5)` +
   (soloVersion ? '  [update.js difiere solo por el numero de version: normal tras publicar]'
                : distintos.length ? ' -> distintos: ' + distintos.join(', ') : ''));

// --- Los puentes nativos ---
// android/ esta en .gitignore y se regenera, asi que el MainActivity con los
// puentes vive en android-src/ y hay que COPIARLO en cada compilacion. Si se
// olvida, el puente del giro desaparece sin avisar -- un fallo mudo, que es el
// peor tipo. El de FOTOS se quito con su permiso: si vuelve a aparecer, es que
// se ha compilado un MainActivity viejo.
console.log('\n== 4b) LOS PUENTES NATIVOS ==');
{
  const dex = lista.filter(n => n.endsWith('.dex'));
  ok(dex.length > 0, `lleva codigo compilado (${dex.length} .dex)`);
  // HAY QUE MIRAR EN TODOS LOS .dex, no solo en el primero. Con multidex el
  // codigo de la app suele caer en el ULTIMO (aqui, classes4.dex): mirar solo
  // classes.dex daba un falso fallo.
  let fotos = false, giro = false;
  for (const d of dex) {
    try {
      const buf = leeDelApk(d);
      if (buf.includes('AndroidFotos')) fotos = true;
      if (buf.includes('AndroidGiro')) giro = true;
    } catch (e) { /* un dex ilegible no invalida los demas */ }
  }
  ok(!fotos, 'el puente AndroidFotos ya NO esta (se fue con el permiso de fotos)');
  ok(giro, 'el puente AndroidGiro sigue dentro (la orientacion por escena)');
}

// --- El icono: el que dibuja tools/icono.py, no el de Capacitor ni uno viejo ---
// build-apk.ps1 lo redibuja DESPUES de `npx cap sync`. Si ese paso falla o se
// salta, el APK sale con el icono anterior (o con el de Capacitor) y compila
// igual: nada lo diria hasta verlo en el telefono. Por eso se comparan los
// PIXELES de dentro del APK con lo que icono.py dibuja ahora mismo.
console.log('\n== 4c) EL ICONO ==');
if (aapt) {
  const xml = execSync(`"${aapt}" dump xmltree --file res/mipmap-anydpi-v26/ic_launcher.xml "${apk}"`, { encoding: 'utf8' });
  const res = execSync(`"${aapt}" dump resources "${apk}"`, { encoding: 'utf8', maxBuffer: 64 << 20 });
  const capas = [...xml.matchAll(/=@(0x[0-9a-f]{8})/g)]
    .map(m => (res.match(new RegExp('resource ' + m[1] + ' (\\S+)')) || [])[1]);
  console.log('   capas del icono adaptativo: ' + capas.join(', '));
  ok(capas.join() === 'mipmap/ic_launcher_background,mipmap/ic_launcher_foreground,mipmap/ic_launcher_monochrome',
     'el icono adaptativo usa las tres capas de icono.py');
}
{
  let hayPython = true;
  try { execSync('python -c "import PIL"', { stdio: 'ignore' }); } catch { hayPython = false; }
  if (!hayPython) {
    console.log('   (sin python con Pillow: no se pueden comparar los pixeles del icono)');
  } else {
    const herr = path.join(raiz, 'tools');
    for (const [entrada, dibujo] of [
      ['res/mipmap-xxxhdpi-v4/ic_launcher_foreground.png', 'draw_foreground(432)'],
      ['res/mipmap-xxxhdpi-v4/ic_launcher_background.png', 'draw_background(432)'],
      ['res/mipmap-xxxhdpi-v4/ic_launcher.png', 'draw_legacy(192)'],
    ]) {
      const tmp = path.join(process.env.TEMP || '/tmp', 'apkicono_' + Date.now() + '.png');
      fs.writeFileSync(tmp, leeDelApk(entrada));
      // Se comparan los BYTES de la imagen entera. La primera version usaba
      // ImageChops.difference(a, b).getbbox(), y en una imagen RGBA getbbox()
      // solo mira el ALFA: el fondo es opaco entero y el legacy tiene las
      // mismas esquinas, asi que daba "igual" con los colores cambiados del
      // todo. Se vio probando el APK VIEJO contra el icono nuevo.
      const r = execSync(`python -c "import sys; sys.path.insert(0, r'${herr}'); import icono; ` +
        `from PIL import Image; a = Image.open(sys.argv[1]).convert('RGBA'); b = icono.${dibujo}; ` +
        `print('igual' if a.size == b.size and a.tobytes() == b.tobytes() else 'distinto')" "${tmp}"`,
        { encoding: 'utf8' }).trim();
      fs.unlinkSync(tmp);
      ok(r === 'igual', `${entrada.split('/').pop()} (xxxhdpi) es el que dibuja icono.py`);
    }
  }
}

// --- El arranque del actualizador ---
// Comprueba el fallo que se le colo al telefono: la actualizacion se
// descargaba pero NO se ejecutaba, por dos causas que solo se ven aqui dentro.
// El worker se registraba DENTRO de main.js -- cuando los modulos ya se habian
// pedido -- y guardaba la version en una variable que perdia cada vez que
// Android lo mataba.
console.log('\n== 5) EL ARRANQUE DEL ACTUALIZADOR ==');
const idx = leeDelApk('assets/public/index.html').toString('utf8');
const swTxt = leeDelApk('assets/public/sw.js').toString('utf8');
// Sin comentarios: el propio sw.js DOCUMENTA el fallo viejo citando el codigo
// malo, y buscarlo en crudo daba un falso positivo.
const swCode = swTxt.replace(/\/\/.*/g, '');

ok(!/<script[^>]+src=["']js\/main\.js/.test(idx),
   'main.js NO se carga con un <script src> directo (llegaria antes que el worker)');
ok(idx.includes('navigator.serviceWorker.register'),
   'index.html registra el worker antes de cargar el juego');
ok(idx.includes('MessageChannel'),
   'index.html espera a que el worker confirme que version sirve');
ok(idx.includes('rom.pend'),
   'index.html estrena la version descargada al arrancar');
ok(swCode.includes('caches.open(MARCA)') && swCode.includes('leeVersion'),
   'el worker lee la version de la cache, que sobrevive a que lo maten');
ok(!swCode.includes('let VERSION'),
   'el worker NO guarda la version en una variable suelta');

// --- La version ---
console.log('\n== 6) VERSION ==');
const upd = leeDelApk('assets/public/js/update.js').toString('utf8');
const ver = (upd.match(/VERSION_APK = '([\d.]+)'/) || [])[1];
const origen = (upd.match(/ORIGEN = '([^']+)'/) || [])[1];
console.log(`   version que trae: ${ver}`);
console.log(`   busca en: ${origen}`);
ok(!!ver, 'declara una version');
ok(!!origen && origen.startsWith('https://'), 'el origen de actualizaciones es https');

console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
