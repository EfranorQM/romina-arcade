// EMULA EL TELEFONO: la app en un origen, las actualizaciones en otro.
//
//   node tools/servidor-estatico.js android/app/src/main/assets/public 8090
//   node tools/servidor-estatico.js www 8091 cors
//   node tools/ver-app.js x.png "espera2500;archivo:tools/emula-telefono.js;js:location.reload();espera4000;archivo:tools/emula-telefono.js;js:location.reload();espera4000;archivo:tools/emula-telefono.js" "http://localhost:8090/"
//
// POR QUE EXISTE. En el telefono la app vive en https://localhost y las
// actualizaciones bajan de github.io: DOS origenes. Todas las demas pruebas
// usaban uno (localhost para todo, o github.io para todo) y asi no salio lo
// del 23-09-2026: lo descargado conservaba la direccion de GitHub, el juego
// pedia casi todo alli (70 de 71 ficheros) y el dibujo de Romina era "de otro
// sitio": ROMINA revento al entrar en cuanto ella se puso un traje ganado
// ("the canvas has been tainted"). Solo se vio con la foto del aviso.
//
// Lo que hace, un paso por llamada (apunta en localStorage por cual va):
//   0  con el APK (v1.0.8) corriendo: el worker apunta a una version borrada
//      (como tras la reversion), se baja www/ desde :8091 COMO LO HACIA EL
//      ACTUALIZADOR VIEJO (la respuesta tal cual, con su direccion), se deja
//      un traje ganado en el guardado y la version queda pendiente
//   1  tras reiniciar: entra en ROMINA; tiene que llegar a elegir, con el traje
//      puesto y sin fallo, aunque todo venga aun del otro origen
//   2  tras otro reinicio: la cache ya esta rehecha como propia (update.js,
//      reparaCache): TODO tiene que salir del origen de la app
(async () => {
  const LS = localStorage, ORIGEN = 'http://localhost:8091';
  const fase = +(LS.getItem('emula.fase') || 0);
  const res = JSON.parse(LS.getItem('emula.res') || '[]');
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const apunta = (nombre, ok, e) => { res.push({ nombre, ok, ...e }); LS.setItem('emula.res', JSON.stringify(res)); };
  for (let i = 0; i < 40 && !window.__arcade; i++) await espera(100);

  async function entra() {
    LS.removeItem('rom.error');
    __arcade.sm.go(__arcade.GAMES.find(G => G.meta.id === 'caballero'));
    await espera(1500);
    const por = {};
    for (const r of performance.getEntriesByType('resource')) { const o = new URL(r.name).origin; por[o] = (por[o] || 0) + 1; }
    const S = __arcade.sm.cur;
    return { escena: S.meta.id, fase: S.fase, traje: S.traje, error: LS.getItem('rom.error'), cargadoDe: por };
  }

  if (fase === 0) {
    const reg = await navigator.serviceWorker.ready;
    const sw = navigator.serviceWorker.controller || reg.active;
    await new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = r; sw.postMessage({ tipo: 'usa', version: '0.0.1' }, [ch.port2]); setTimeout(r, 1500); });
    for (const n of await caches.keys()) if (n.startsWith('rom-')) await caches.delete(n);
    const man = await (await fetch(ORIGEN + '/version.json', { cache: 'no-store' })).json();
    const c = await caches.open('rom-' + man.version);
    for (const rel of man.archivos) await c.put(new Request('/' + rel), await fetch(ORIGEN + '/' + rel, { cache: 'no-store' }));
    // un traje ganado, con sus medallas, como el de ella
    const P = await import(ORIGEN + '/js/games/caba-partida.js');
    const traje = {}, meds = [];
    for (const parte of P.PARTES) { const pr = P.ARMARIO[parte][1]; traje[parte] = pr.id; meds.push(P.medallaDe(parte, pr.id).id); }
    const s = JSON.parse(LS.getItem('romina_arcade_v1') || '{"scores":{},"mute":false}');
    s.datos = Object.assign(s.datos || {}, { 'caba.traje': traje, 'caba.medallas': meds });
    LS.setItem('romina_arcade_v1', JSON.stringify(s));
    ['rom.ver', 'rom.sosp', 'rom.prev', 'rom.error'].forEach(k => LS.removeItem(k));
    LS.setItem('rom.pend', man.version);
    LS.setItem('emula.res', '[]'); LS.setItem('emula.fase', '1');
    return 'preparado: APK corriendo, ' + man.version + ' bajada a la vieja y pendiente, traje ' + JSON.stringify(traje);
  }
  if (fase === 1) {
    const e = await entra();
    apunta('recien actualizada, ROMINA entra con el traje ganado y sin fallo', e.fase === 'elige' && !e.error && e.traje && e.traje.capa !== 'azul', e);
    LS.setItem('emula.fase', '2');
    return e;
  }
  if (fase === 2) {
    const e = await entra();
    const ajenos = Object.keys(e.cargadoDe).filter(o => o !== location.origin);
    apunta('tras reiniciar, todo sale de la cache como propio', e.fase === 'elige' && !e.error && ajenos.length === 0, e);
    LS.setItem('emula.fase', '3');
    for (const n of await caches.keys()) if (n.startsWith('rom-')) await caches.delete(n);
    return { resumen: res.map(r => (r.ok ? 'ok   ' : 'MAL  ') + r.nombre), veredicto: res.every(r => r.ok) ? 'TODO OK' : 'FALLOS' };
  }
  return 'ya hecho: borra emula.fase para repetir';
})();
