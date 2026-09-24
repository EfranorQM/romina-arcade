// PUBLICA una actualizacion del juego.
//
//   node tools/publica.mjs            sube el numero de parche (1.0.3 -> 1.0.4)
//   node tools/publica.mjs menor      sube el menor          (1.0.4 -> 1.1.0)
//   node tools/publica.mjs 2.0.0      pone esa version exacta
//   ... --nota "BOTON DE REINICIAR" --nota "OTRA COSA"
//                                     las novedades que enseña el aviso de
//                                     actualizacion (hasta tres, cortas: el
//                                     cartel las pasa a mayusculas sin tildes)
//
// Que hace:
//   1. Sube el numero de version en www/js/update.js
//   2. Escribe www/version.json con la lista de ficheros del juego
//   3. Copia www/ a la rama gh-pages y la sube a GitHub
//
// A partir de ahi, el boton BUSCAR ACTUALIZACION del menu ya la encuentra.
//
// NO compila el APK: no hace falta. Solo hay que recompilar cuando se toque
// algo nativo (permisos, icono, orientacion) o cuando se quiera que un
// telefono nuevo arranque ya con lo ultimo.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(here, '..');
const www = path.join(raiz, 'www');
const RAMA = 'gh-pages';

// ---------- 1. La version ----------
const upd = path.join(www, 'js', 'update.js');
let src = fs.readFileSync(upd, 'utf8');
const m = src.match(/export const VERSION_APK = '([\d.]+)'/);
if (!m) { console.error('no encuentro VERSION_APK en update.js'); process.exit(1); }
const actual = m[1];

// Las novedades van con --nota; lo demas es la version.
const notas = [], resto = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--nota') {
    const n = process.argv[++i];
    if (!n) { console.error('--nota necesita un texto'); process.exit(1); }
    notas.push(n);
  } else resto.push(process.argv[i]);
}
if (notas.length > 3) { console.error('como mucho tres --nota: el cartel no tiene sitio para mas'); process.exit(1); }
// El cartel se ensancha hasta que caben 34 letras por linea (aviso-update.js):
// una nota mas larga se parte en dos y lo hace crecer. Se avisa, no se impide.
for (const n of notas) if (n.length > 34) console.warn(`OJO: "${n}" tiene ${n.length} letras; en el aviso ocupara dos lineas (caben 34)`);
const arg = resto[0];
let nueva;
if (arg && /^\d+\.\d+\.\d+$/.test(arg)) {
  nueva = arg;
} else {
  const [ma, mi, pa] = actual.split('.').map(Number);
  if (arg === 'mayor') nueva = `${ma + 1}.0.0`;
  else if (arg === 'menor') nueva = `${ma}.${mi + 1}.0`;
  else nueva = `${ma}.${mi}.${pa + 1}`;
}
console.log(`version  ${actual}  ->  ${nueva}`);

src = src.replace(/export const VERSION_APK = '[\d.]+'/, `export const VERSION_APK = '${nueva}'`);
fs.writeFileSync(upd, src);

// ---------- 2. El manifiesto ----------
// Todos los ficheros que componen el juego, con su ruta relativa a www/.
const archivos = [];
(function anda(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { anda(p); continue; }
    // sw.js NO va en la lista: el worker se actualiza solo por su propio
    // mecanismo, y meterlo en su propia cache es pedir un lio.
    if (f === 'sw.js' || f === 'version.json') continue;
    archivos.push(path.relative(www, p).replace(/\\/g, '/'));
  }
})(www);

const manifiesto = {
  version: nueva,
  fecha: new Date().toISOString().slice(0, 10),
  archivos: archivos.sort(),
};
if (notas.length) manifiesto.notas = notas;
fs.writeFileSync(path.join(www, 'version.json'), JSON.stringify(manifiesto, null, 2));
console.log(`manifiesto: ${archivos.length} ficheros`);

// ---------- 3. Subir a gh-pages ----------
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: raiz, stdio: 'pipe', encoding: 'utf8', ...opts }).trim();

try {
  sh('git rev-parse --git-dir');
} catch {
  console.error('esto no es un repo de git'); process.exit(1);
}

// Que haya un remoto
let remoto = '';
try { remoto = sh('git remote get-url origin'); } catch {}
if (!remoto) {
  console.error('\nNo hay remoto configurado todavia. Crea el repo con:');
  console.error('  gh repo create romina-arcade --public --source=. --remote=origin --push');
  process.exit(1);
}

// Guardar lo que haya en el arbol antes de tocar ramas
const sucio = sh('git status --porcelain');
if (sucio) {
  sh('git add -A');
  sh(`git commit -q -m "ROMINA v${nueva}"`);
  console.log('cambios comiteados en master');
}

// La rama gh-pages lleva SOLO el contenido de www/, en su raiz.
// Se usa un worktree aparte para no tocar el arbol de trabajo.
const tmp = path.join(raiz, '.gh-tmp');
fs.rmSync(tmp, { recursive: true, force: true });

try {
  try {
    sh(`git worktree add -B ${RAMA} "${tmp}" origin/${RAMA}`);
  } catch {
    // La rama no existe todavia: se crea vacia (sin historia de master)
    sh(`git worktree add --detach "${tmp}"`);
    execSync(`git checkout --orphan ${RAMA}`, { cwd: tmp, stdio: 'pipe' });
    execSync('git rm -rf . --quiet', { cwd: tmp, stdio: 'pipe' });
  }

  // Vaciar y volver a copiar www/
  for (const f of fs.readdirSync(tmp)) {
    if (f === '.git') continue;
    fs.rmSync(path.join(tmp, f), { recursive: true, force: true });
  }
  fs.cpSync(www, tmp, { recursive: true });
  // .nojekyll: sin el, GitHub Pages ignora carpetas que empiezan por guion bajo
  fs.writeFileSync(path.join(tmp, '.nojekyll'), '');

  execSync('git add -A', { cwd: tmp, stdio: 'pipe' });
  try {
    execSync(`git commit -q -m "v${nueva}"`, { cwd: tmp, stdio: 'pipe' });
  } catch {
    console.log('(sin cambios que publicar)');
  }
  execSync(`git push -q origin ${RAMA} --force`, { cwd: tmp, stdio: 'inherit' });
  console.log(`\nPUBLICADA la version ${nueva}`);
  const user = remoto.replace(/.*[/:]([^/]+)\/([^/.]+)(\.git)?$/, '$1');
  const repo = remoto.replace(/.*[/:]([^/]+)\/([^/.]+)(\.git)?$/, '$2');
  console.log(`   https://${user.toLowerCase()}.github.io/${repo}/version.json`);
  console.log('\nEn el telefono: MENU -> BUSCAR ACTUALIZACION -> reiniciar la app.');
  console.log('(GitHub Pages tarda hasta un minuto en servir lo nuevo)');
} finally {
  try { sh(`git worktree remove "${tmp}" --force`); } catch {}
  fs.rmSync(tmp, { recursive: true, force: true });
}
