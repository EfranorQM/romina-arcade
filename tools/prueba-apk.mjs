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
for (const f of ['js/update.js', 'sw.js', 'js/main.js', 'js/menu.js', 'js/games/romi-anim.js']) {
  const dentro = leeDelApk('assets/public/' + f);
  const fuera = fs.readFileSync(path.join(raiz, 'www', f));
  if (sha(dentro) === sha(fuera)) iguales++; else distintos.push(f);
}
ok(distintos.length === 0, `los ficheros del APK son identicos a www/ (${iguales}/5)` +
   (distintos.length ? ' -> distintos: ' + distintos.join(', ') : ''));

// --- La version ---
console.log('\n== 5) VERSION ==');
const upd = leeDelApk('assets/public/js/update.js').toString('utf8');
const ver = (upd.match(/VERSION_APK = '([\d.]+)'/) || [])[1];
const origen = (upd.match(/ORIGEN = '([^']+)'/) || [])[1];
console.log(`   version que trae: ${ver}`);
console.log(`   busca en: ${origen}`);
ok(!!ver, 'declara una version');
ok(!!origen && origen.startsWith('https://'), 'el origen de actualizaciones es https');

console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
