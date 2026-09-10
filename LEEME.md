# ROMINA'S ARCADE

Cinco juegos de acción, 100% offline, para el Redmi Note 10.

---

## Probar en la PC

```
node serve.js
```

Y abrir http://localhost:8080 — se juega con el mouse (clic = tocar).

## Generar el APK

```
powershell -ExecutionPolicy Bypass -File build-apk.ps1
```

Deja `RominaArcade.apk` en esta carpeta. La primera compilación tarda
10-20 minutos (Gradle descarga sus dependencias); las siguientes, ~30 segundos.

Después de cambiar cualquier archivo de `www/`, hay que volver a compilar:
el APK empaqueta una copia, editar `www/` a secas no cambia nada.

---

## Pasarle el APK a Romina

**WhatsApp no acepta archivos .apk.** Alternativas, de mejor a peor:

1. **Telegram** — lo envía tal cual, sin trucos.
2. **Cable USB** — copiar el archivo a la memoria del celular.
3. **Google Drive / correo** — subir y compartir el enlace.
4. **WhatsApp comprimido** — meter el .apk en un .zip. Funciona, pero ella
   tiene que descomprimirlo, lo cual es un paso más y más confuso.

### Qué va a ver ella al instalar

MIUI muestra avisos porque la app no viene de la Play Store. Es normal:

1. "Por seguridad, tu teléfono no permite instalar apps desconocidas" →
   **Configuración** → activar el permiso para la app desde la que abrió el archivo.
2. MIUI escanea la app y puede decir que no la reconoce → **Instalar de todos modos**.
3. Si aparece "Enviar para análisis" → se puede omitir.

La app queda con su ícono (una marquesina de arcade en neón) y ya no pide nada más.

---

## Los juegos

| Juego | Qué es | Cómo se juega |
|---|---|---|
| **SKYLINE** | Corre por azoteas neón, esquiva huecos y drones | Tocar = saltar · Mantener = saltar más alto · Tocar en el aire = doble salto |
| **NEON FIST** | Arena de pelea contra oleadas de enemigos | Pulgar izquierdo = mover · Botón grande = golpear · Botón chico = esquivar |
| **LAST WAVE** | Sobrevive oleadas, elige mejoras entre ronda y ronda | Un dedo mueve; dispara sola · Entre oleadas, tocar una carta |
| **SYMBIOTE** | Criatura de carne que trepa un laboratorio | Arrastrar el dedo = fluir · Botón = agarrar y matar · Gira con el teléfono |
| **FURIA** | Moto de montaña: 8 niveles con meta | Derecha = acelerar · Izquierda = saltar (tocar) y frenar (mantener) · En el aire, las dos zonas giran la moto |

Sin tutoriales, sin diálogos, sin historia. Se toca y se juega.
Los récords se guardan solos. El sonido se activa y desactiva desde el menú.

---

## Estructura

```
www/                  el juego (esto es todo lo que corre)
  index.html
  js/
    main.js           bucle, escenas, fin de partida
    menu.js           la estantería de carátulas (horizontal)
    covers.js         las carátulas, dibujadas por código
    core.js           canvas, tiempo, pools, guardado
    input.js          controles táctiles
    audio.js          sonido y música, todo sintetizado
    gfx.js            sprites, partículas
    font.js           fuente pixel 5x7
    games/            los tres juegos
docs/                 investigación técnica y diseños
tools/                utilidades de desarrollo (no entran en el APK)
  icono.py            dibuja el ícono del APK en las cinco densidades
android/              proyecto nativo (lo genera Capacitor)
```

Sin dependencias, sin paso de compilación, sin archivos de imagen ni de sonido:
todo el arte y el audio se generan por código. El APK pesa poco por eso.

**El ícono también se dibuja por código**, con `tools/icono.py`: una marquesina
de arcade con neón rosa, mueble cian y pantalla oscura. `build-apk.ps1` lo
regenera en cada compilación, y tiene que ser así — `npx cap sync` reescribe los
mipmap con el ícono por defecto de Capacitor, y `android/` no está en git.

```
python tools/icono.py --hoja hoja.png   # verlo a tamaño real y bajo las máscaras
python tools/icono.py --verificar       # comprobar que no lo recorta el launcher
```

El ícono se revisa mirando la hoja de contactos, no el PNG grande: a 432px todo
parece bueno, y lo que importa es cómo se ve a 48. La verificación comprueba lo
único que puede romperlo en el teléfono — que el dibujo quepa en el círculo
seguro de 66dp, porque cada launcher recorta con su propia máscara.

**FURIA es la excepción al pixel art.** Los otros cuatro juegos hornean sprites
y corren con el filtrado en nearest-neighbour. FURIA declara `meta.smooth` y
corre a 540x1200 con antialiasing: el terreno es una polilínea, la moto se
dibuja con curvas y degradados, y las ruedas giran de verdad. Por eso se ve
suave en lugar de escalonado, sin usar ni una imagen.

---

## Notas técnicas

- **La app tiene dos orientaciones.** El menú es apaisado (600x270) y los
  juegos son verticales (270x600, o 540x1200 los que piden detalle). Al entrar
  a un juego la app le pide al teléfono que gire, y al volver al menú también.
  Las dos resoluciones son 20:9 exacto, la proporción del Note 10, así que no
  quedan barras negras en ninguna de las dos.
- **Se necesita Java 21** para compilar (Capacitor lo exige). Java 17 no sirve.
- El APK **no tiene permiso de internet**: se elimina a la fuerza del manifest,
  porque Capacitor lo reinyecta si solo se borra la línea.
- El giro lo pide el software (`screen.orientation.lock`), no el manifest: por
  eso el manifest deja girar (`fullUser`). Si el bloqueo falla — MIUI a veces lo
  rechaza — aparece un aviso de **GIRA EL TELÉFONO** y el juego se pausa, así
  que nunca se pierde una partida por estar girando el aparato.
- La pantalla no se apaga jugando.

## El menú

Es una estantería de carátulas que se arrastra de lado, al estilo de una PSP.
La del centro está de frente e iluminada; las de los lados se encogen, se
estrechan y se oscurecen, con su reflejo debajo. La fila **da la vuelta**: tras
el último juego viene el primero, así que nunca hay un lado vacío.

- Arrastrar mueve la fila siguiendo al dedo; al soltar, encaja sola.
- Un gesto rápido cruza hasta tres carátulas.
- Tocar una carátula lateral la trae al centro; tocar la del centro, juega.

Las carátulas **se dibujan por código** (`www/js/covers.js`), como todo lo demás
en esta app: son 96x128 y se hornean una vez al entrar al menú.

```
node tools/ver.js tools/ver-portadas.html portadas.png     # verlas todas
node tools/prueba-menu.mjs                                 # simular la física
```

La física del carrusel es un muelle **críticamente amortiguado** hacia la
carátula de destino, que se elige una sola vez al soltar el dedo. Los números
salen de `tools/prueba-menu.mjs`, que simula el modelo miles de pasos: el peor
encaje tarda 0,92 s y no rebota nunca. La primera versión usaba un muelle libre
peleando contra la fricción y tardaba casi cuatro segundos, además de quedarse
una carátula corta al tocar una lateral.

## Agregar un juego nuevo

1. Crear `www/js/games/nombre.js` con la forma:
   `{ meta:{id,title,tag,colors}, init, update, draw, onInput, destroy }`
2. Importarlo y añadirlo al array en `www/js/games.js`.
3. Dibujarle una carátula en `www/js/covers.js` (si no, sale una genérica con
   su inicial y sus colores).

El menú, los récords, la música y la pantalla de fin de partida ya lo cubren solos.
