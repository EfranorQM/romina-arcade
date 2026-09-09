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

La app queda con su ícono (una R rosa en un marco cian) y ya no pide nada más.

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
    main.js           bucle, menú, pantallas
    core.js           canvas, tiempo, pools, guardado
    input.js          controles táctiles
    audio.js          sonido y música, todo sintetizado
    gfx.js            sprites, partículas
    font.js           fuente pixel 5x7
    games/            los tres juegos
docs/                 investigación técnica y diseños
android/              proyecto nativo (lo genera Capacitor)
```

Sin dependencias, sin paso de compilación, sin archivos de imagen ni de sonido:
todo el arte y el audio se generan por código. El APK pesa poco por eso.

**FURIA es la excepción al pixel art.** Los otros cuatro juegos hornean sprites
y corren con el filtrado en nearest-neighbour. FURIA declara `meta.smooth` y
corre a 540x1200 con antialiasing: el terreno es una polilínea, la moto se
dibuja con curvas y degradados, y las ruedas giran de verdad. Por eso se ve
suave en lugar de escalonado, sin usar ni una imagen.

---

## Notas técnicas

- **Resolución virtual 270x600**, escalada a pantalla completa. Es 20:9 exacto,
  que es la proporción del Note 10, así que no quedan barras negras.
- **Se necesita Java 21** para compilar (Capacitor lo exige). Java 17 no sirve.
- El APK **no tiene permiso de internet**: se elimina a la fuerza del manifest,
  porque Capacitor lo reinyecta si solo se borra la línea.
- Orientación vertical fija y la pantalla no se apaga jugando.

## Agregar un juego nuevo

1. Crear `www/js/games/nombre.js` con la forma:
   `{ meta:{id,title,tag,colors}, init, update, draw, onInput, destroy }`
2. Importarlo y añadirlo al array en `www/js/games.js`.

El menú, los récords, la música y la pantalla de fin de partida ya lo cubren solos.
