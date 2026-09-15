// Las FOTOS del telefono.
//
// AHORA MISMO NO LO USA NADIE, y es a proposito. Se escribio para el juego
// GALERIA, que existio solo para probar que las actualizaciones llegaban al
// telefono; una vez probado, el juego se quito. El puente nativo y su permiso
// se quedaron en el APK para que un juego futuro que quiera fotos pueda
// llegar POR EL BOTON, sin reinstalar nada.
//
// Habla con el puente nativo AndroidFotos (android-src/MainActivity.java), que
// devuelve las N fotos mas recientes como miniaturas en base64.
//
// LAS FOTOS NO SALEN DEL TELEFONO. Se leen en el lado nativo, se reducen a
// 192 px y se pasan a este JavaScript. No hay ni una peticion de red en todo
// el camino, no se guardan en ningun sitio y viven solo mientras dura la
// partida. El repositorio publico lleva codigo, nunca fotos.
//
// TODO ESTO TIENE RESPALDO. Si no hay puente (se esta probando en el
// navegador), si ella no da el permiso, o si la galeria esta vacia, se
// devuelve una lista vacia y el juego usa las caratulas del arcade. Nunca se
// queda sin poder jugar.

const PUENTE = () => (typeof window !== 'undefined' && window.AndroidFotos) || null;

export const Fotos = {
  // Hay puente nativo? (false en el navegador de pruebas)
  hayPuente() { return !!PUENTE(); },

  // Ya tenemos permiso para leer las fotos?
  hayPermiso() {
    const p = PUENTE();
    if (!p) return false;
    try { return !!p.hayPermiso(); } catch { return false; }
  },

  // Lanza el dialogo del sistema. NO devuelve el resultado: el dialogo es
  // asincrono, asi que hay que volver a preguntar con hayPermiso() cuando la
  // app recupera el foco.
  pedirPermiso() {
    const p = PUENTE();
    if (!p) return;
    try { p.pedirPermiso(); } catch {}
  },

  // Las `cuantas` fotos mas recientes, ya cargadas como Image() listas para
  // dibujar. Devuelve [] ante cualquier problema.
  //
  // Es async porque decodificar cuarenta JPEG lleva su tiempo y bloquear el
  // hilo dejaria el juego congelado durante el arranque.
  async recientes(cuantas = 40) {
    const p = PUENTE();
    if (!p) return [];
    let lista;
    try {
      const txt = p.recientes(cuantas);
      lista = JSON.parse(txt || '[]');
    } catch {
      return [];
    }
    if (!Array.isArray(lista) || !lista.length) return [];

    const imgs = [];
    for (const item of lista) {
      if (!item || !item.src) continue;
      try {
        const img = await cargaImagen(item.src);
        if (img) imgs.push(img);
      } catch { /* una foto rota no tumba la partida */ }
    }
    return imgs;
  },
};

function cargaImagen(src) {
  return new Promise(resolve => {
    const img = new Image();
    // Tope de tiempo: una imagen que no decodifica no puede colgar el arranque.
    const t = setTimeout(() => resolve(null), 2500);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = src;
  });
}
