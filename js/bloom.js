// BLOOM — el neon del arcade, una sola pasada por frame para toda la pantalla.
//
// POR QUE EXISTE. Cada criatura de SURVIVAL llevaba horneado detras un
// gradiente radial (surv-art.js halo()), 31 llamadas en total, prometiendo "el
// aire de neon sin usar sombras". Medido el perfil de alpha de cada lamina: el
// halo termina SIEMPRE dentro del cuerpo opaco, que se dibuja encima y lo tapa.
// duda sobresalia -2.6 px, celos -1.3, miedo -1.4: negativo en las siete
// medidas. Se pagaba hornear un gradiente por criatura y no se veia un pixel.
//
// Y agrandar el halo dentro de la lamina tampoco servia: solo quedan 7-9 px de
// margen libre en los 64 de la lamina, que a la escala real de dibujado (0.52 a
// 0.75) son ~4 px en pantalla. Un glow de 4 px no se nota.
//
// COMO FUNCIONA. En vez de tocar las 38 criaturas, el resplandor se saca del
// frame YA DIBUJADO, entero, de una vez:
//
//   1. El frame del mundo se copia reducido a un lienzo pequeno (1/4 de lado).
//      La propia reduccion con imageSmoothingEnabled ya es un desenfoque: cada
//      pixel del buffer es la media de 4x4 pixeles del frame. Gratis.
//   2. Ese buffer se multiplica POR SI MISMO. Es el umbral, y es la clave de
//      todo: multiplicar eleva al cuadrado (v*v/255), asi que aplasta lo oscuro
//      y respeta lo claro. Medido sobre los colores reales del juego:
//
//        fondo mas claro de los cinco biomas (rejilla de EL SILENCIO)  38.3 -> 0.1
//        pixel tipico de una criatura                                  200 -> 157
//
//      O sea 743 veces mas separacion que antes de multiplicar. El fondo
//      violeta y la rejilla desaparecen del todo; las criaturas, las balas y
//      Roma pasan enteras. Sin leer un solo pixel con getImageData (eso
//      obligaria a la CPU a esperar a la GPU y hundiria los frames).
//   3. Se difumina con dos pasadas de reduccion/ampliacion mas, tambien a base
//      de drawImage: el filtrado bilineal del navegador hace el trabajo.
//   4. Se compone encima del frame con 'lighter' (suma). Solo SUMA luz: nunca
//      puede oscurecer ni tapar nada de lo que ya estaba dibujado.
//
// COSTE. No depende de cuantos enemigos haya: son seis drawImage de pantalla
// completa sobre buffers pequenos, siempre los mismos. Con el lienzo real de
// SURVIVAL (1200x540 por el sobremuestreo ss:2) el buffer grande es 300x135.
//
// LO QUE NO BRILLA. El HUD, los controles y el picker de cartas se dibujan
// DESPUES de esta pasada a proposito: son interfaz, tienen que leerse nitidos,
// y un texto que florece se vuelve ilegible.

// Los buffers son de modulo, no por entidad: hay UNO para toda la app y se
// redimensiona solo cuando cambia el lienzo (al entrar y salir de un juego).
let a = null, b = null, ca = null, cb = null;
let aw = 0, ah = 0;

// Cuanto se reduce el lienzo para el buffer grande. 4 esta medido: con 2 el
// desenfoque queda demasiado apretado (el glow no sale del cuerpo) y el relleno
// cuesta el cuadruple; con 8 el buffer de SURVIVAL cae a 150x67 y las balas,
// que miden 3 px virtuales, se pierden entre pixeles y dejan de brillar.
const DIV = 4;

function ensure(w, h) {
  const nw = Math.max(1, Math.round(w / DIV)), nh = Math.max(1, Math.round(h / DIV));
  if (nw === aw && nh === ah && a) return;
  aw = nw; ah = nh;
  if (!a) { a = document.createElement('canvas'); b = document.createElement('canvas'); }
  a.width = aw; a.height = ah;
  b.width = aw; b.height = ah;
  ca = a.getContext('2d', { alpha: true });
  cb = b.getContext('2d', { alpha: true });
  ca.imageSmoothingEnabled = true;
  cb.imageSmoothingEnabled = true;
}

// Aplica el bloom al lienzo `g` tal y como esta AHORA MISMO.
//
// OJO CON EL TRANSFORM. El juego llama a esto con el transform del
// sobremuestreo puesto (y puede que con el translate del temblor de camara
// encima). Aqui hace falta trabajar en pixeles REALES del lienzo, asi que se
// resetea con setTransform(1,0,0,1,0,0) y se restaura al salir. El temblor
// queda DENTRO del frame copiado, que es lo correcto: el glow tiembla pegado a
// la figura de la que sale, no flotando aparte.
//
// `fuerza` es cuanta luz se suma al final (1 = el ajuste medido).
export function bloom(g, fuerza = 1) {
  // Escala global de pruebas: deja a tools/ capturar el ANTES y el DESPUES de
  // la MISMA escena, que es la unica forma de comparar sin que el azar mueva un
  // enemigo entre las dos capturas. En el juego no existe (vale 1).
  const k = (typeof window !== 'undefined' && window.__bloomK != null) ? window.__bloomK : 1;
  fuerza *= k;
  if (fuerza <= 0) return;
  const cv = g.canvas;
  const W = cv.width, H = cv.height;
  if (!W || !H) return;
  ensure(W, H);

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);

  // 1. El frame entero, reducido a 1/4 de lado. La reduccion YA difumina.
  ca.globalCompositeOperation = 'copy';       // 'copy' limpia y dibuja de una
  ca.globalAlpha = 1;
  ca.drawImage(cv, 0, 0, W, H, 0, 0, aw, ah);

  // 2. El umbral: el buffer multiplicado por si mismo. Ver la cabecera — es lo
  //    que hace desaparecer el fondo (38 -> 0.1) sin tocar las criaturas.
  ca.globalCompositeOperation = 'multiply';
  ca.drawImage(a, 0, 0);

  // 3. Desenfoque: dos viajes de ida y vuelta a la mitad de tamano. Cada uno
  //    ensancha la mancha sin coste de shader ni de filtro CSS.
  cb.globalCompositeOperation = 'copy';
  cb.drawImage(a, 0, 0, aw, ah, 0, 0, aw >> 1, ah >> 1);
  ca.globalCompositeOperation = 'copy';
  ca.drawImage(b, 0, 0, aw >> 1, ah >> 1, 0, 0, aw, ah);
  cb.globalCompositeOperation = 'copy';
  cb.drawImage(a, 0, 0, aw, ah, 0, 0, aw >> 2, ah >> 2);
  ca.globalCompositeOperation = 'copy';
  ca.drawImage(b, 0, 0, aw >> 2, ah >> 2, 0, 0, aw, ah);

  // 4. Se suma encima. 'lighter' solo anade luz: no puede tapar ni oscurecer
  //    nada de lo ya dibujado, asi que el juego se sigue leyendo igual de bien
  //    aunque el glow se pase de fuerte.
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = fuerza;
  g.drawImage(a, 0, 0, aw, ah, 0, 0, W, H);

  g.restore();
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

// Suelta los buffers al salir del juego: no tiene sentido guardar 300x135 de
// pixeles mientras se navega el menu.
export function bloomLibre() {
  if (a) { a.width = a.height = b.width = b.height = 1; }
  aw = ah = 0;
}
