# ROMINA'S ARCADE

Siete juegos, 100% offline, para el Redmi Note 10: seis de acción y uno de pensar.

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
| **SURVIVAL** | Roma defiende su línea de todo lo que amenaza una relación | **Se juega de lado.** Pulgar izquierdo = mover · Pulgar derecho = disparar; **arrastrándolo se apunta** · Botón de la estrella = bomba |
| **AHORCADO** | Adivina la palabra: un muñeco colgado de seis globos sobre un estanque, y cada fallo revienta uno | Tocar una letra (cuenta al soltar; deslizar fuera cancela) · **SOLA** = palabras de la lista con su categoría · **A DOS** = uno escribe la secreta, le pasa el teléfono al otro · Al muñeco se lo puede arrastrar, empujar y hacerle cosquillas: no cuesta nada |

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
    games/            los siete juegos
      surv-defs.js    SURVIVAL: enemigos, jefes y reglas
      surv-art.js     SURVIVAL: las criaturas, dibujadas por código
      ahorcado.js     AHORCADO: la escena y los dos modos
      ahorc-fisica.js AHORCADO: el muñeco (Verlet), sin DOM: se mide en Node
      ahorc-cara.js   AHORCADO: las expresiones
      ahorc-arte.js   AHORCADO: cielo, estanque, rana, globos y cuerpo
      ahorc-teclado.js AHORCADO: el teclado en pantalla
      ahorc-palabras.js AHORCADO: las palabras (NOSOTROS va al principio)
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

**FURIA, SURVIVAL y AHORCADO son la excepción al pixel art.** Los otros cuatro
juegos hornean sprites y corren con el filtrado en nearest-neighbour. Estos
tres declaran `meta.smooth` y corren con antialiasing: el terreno de FURIA es
una polilínea, la moto se dibuja con curvas y degradados, y el muñeco del
AHORCADO es tinta gruesa y curvas sobre puntos de física. Por eso se ven suaves
en lugar de escalonados, sin usar ni una imagen.

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

## SURVIVAL

Es el port del juego que ya existía en HTML (`Romina-main/`), donde cada
enemigo era un `<div>` animado con GSAP. Aquí corre en canvas, sin
dependencias, como el resto de la app.

Se conserva todo lo que tenía: los **siete enemigos** con sus patrones, los
**diez jefes** con su habilidad propia, los cuatro poderes, los combos con
multiplicador y la bomba. Las vidas y los puntos son los mismos números,
porque estaban probados jugando.

**Es el único juego que se juega de lado**, como el original. Los pulgares caen
en las esquinas de abajo: el izquierdo mueve (el control nace donde apoyas el
dedo) y el derecho dispara sin soltar.

Qué cambió respecto al original, y por qué:

- **Los enemigos van al doble de velocidad.** Traídos tal cual, un enemigo
  tardaba quince segundos en cruzar y una ola entera veinticinco: la arena de
  aquí es mucho más baja en proporción. Medido: ahora cruza en ocho.
- **Se apunta con el pulgar derecho**, como con el ratón en el original: el
  control nace donde apoyas el dedo y arrastrarlo inclina el disparo. Solo se
  apunta hacia arriba (±75° de la vertical): los enemigos vienen de ahí, y con
  el pulgar es fácil apuntar al suelo sin querer.
- **Las balas rebotan** en las paredes y el techo, también como el original.
- **El escudo del MURO se rompe a golpes** (aguanta cuatro y cae). Se probaron
  tres diseños antes: bloquear todo lo que sube lo hacía inmatable; dejarle los
  costados al aire no servía porque al apuntar se apunta al centro y la bala
  entra igual por el centro; y con un rebote la bala nunca vuelve a caerle
  encima. Roma solo se mueve de lado y siempre queda debajo de él, así que
  romper el escudo es lo único que funciona — y se entiende solo, porque se ve
  cómo se apaga.
- **Los poderes caen tres veces más.** Con el 10% del original salía medio poder
  por ola y casi nunca se veía uno; allí las olas eran mucho más largas. Ahora
  cae uno de cada tres enemigos, y un jefe suelta tres de golpe en abanico.
- **La barra de vida del jefe va arriba del todo**, fija: un jefe patrulla
  pegado al techo y encima de él no cabe ni su nombre.
- Los emojis (👻💀🌑⚡) son ahora criaturas dibujadas por código.

```
node tools/ver.js tools/ver-survival.html criaturas.png 1150 1500   # ver el arte
node tools/ver-app.js x.png "...;archivo:tools/prueba-jefes.js;..."  # los 10 jefes
node tools/ver-app.js x.png "...;archivo:tools/prueba-partida.js;..." # jugar sola
```

## AHORCADO

Un muñeco colgado de seis globos sobre un estanque de noche, con una rana
mirándolo desde su nenúfar. Cada letra fallada revienta un globo: baja 40 px, se
bambolea y cambia de cara — de tranquilo a atento, a nervioso (sudor, se agarra
con las dos manos) y a pánico (con un globo los pies rozan el agua y la rana se
relame). Al sexto, chapuzón, y la rana se le sienta en la barriga. No hay
horca: las seis oportunidades de siempre se leen en altura, en física y en
cara. El diseño completo, con cada número, está en `docs/design-ahorcado.md`.

- **El muñeco es física de verdad**: 17 puntos Verlet con restricciones
  (`ahorc-fisica.js`), el mismo esquema que los tentáculos de SYMBIOTE. Se lo
  puede arrastrar de un pie, columpiar, empujar de un toque, frotarle la
  barriga (se ríe) y tocar los globos (se aplastan y suenan, nunca revientan).
  Nada de eso cuenta como error.
- **La cara es un actor**: nueve parámetros continuos que se acercan a su
  objetivo, un estado base por globos vivos, y reacciones encima: espera con
  esperanza mientras el pulgar está apoyado en una tecla, suspira al acertar,
  se sobresalta al reventar, niega con la cabeza si la letra ya salió, y si
  ella tarda se aburre (párpados, bostezo, ceja a cámara, tararea).
- **La letra cuenta al SOLTAR dentro de la tecla**; deslizar fuera cancela. Es
  un juego de pensar y un mal toque no puede costar un globo. Teclas de
  66x70 px virtuales = 8.2x8.7 mm en el Note 10, sin huecos entre ellas.
- **SOLA** puntúa para el récord: +5 por casilla, y por palabra
  (100 + 15·letras + 25·globos que quedan) × racha (x1, x2 desde la tercera,
  x3 desde la sexta); PERFECTA +100. Al ganar suben 3 globos nuevos (tope 6);
  la partida termina en el primer chapuzón. Las palabras vienen de una lista
  de 445 en 12 categorías, en español latino y sin acentos (CAMION), con la Ñ.
  La dificultad es por letras, no por largo: PIÑA es más difícil que ELEFANTE.
- **A DOS** no toca el récord: uno escribe (el muñeco se tapa los ojos), elige
  la pista entre seis tejuelas, aparece PASALE EL TELEFONO, y el otro adivina
  con seis globos. Marcador J1-J2 y OTRA (CAMBIAN).
- **NOSOTROS**: al principio de `www/js/games/ahorc-palabras.js` hay un array
  para las palabras que solo ustedes dos entienden. Con cinco o más, entra en
  la rotación con su propia pista.
- La **Ñ** se añadió a la fuente 5x7 (`font.js`): era la única letra del
  español que faltaba.

```
node tools/prueba-ahorcado.mjs        # la física, diez pruebas con umbral
node tools/prueba-palabras.mjs        # la lista, los bots y las canciones
node tools/ver.js tools/ver-ahorcado.html caras.png 1000 1150   # las 16 expresiones a tamaño real
VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[6],{seed:7});espera2500;toca261:856;espera1200;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js"
```

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
