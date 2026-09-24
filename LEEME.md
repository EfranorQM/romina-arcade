# ROMINA'S ARCADE

Ocho juegos, 100% offline, para el Redmi Note 10: siete de acción y uno de pensar.

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

Deja `RomiQuest.apk` en esta carpeta, y `node tools/prueba-apk.mjs` lo
comprueba por dentro (permisos, icono, juego y actualizador). La primera
compilación tarda 10-20 minutos (Gradle descarga sus dependencias); las
siguientes, ~30 segundos.

Solo hace falta un APK nuevo para cambios nativos (permisos, icono,
orientación). Los cambios de `www/` se publican y llegan al teléfono desde la
propia app, sin reinstalar:

## Publicar una actualización

```
node tools/publica.mjs --nota "EL DRAGON DESPIERTA" --nota "DOS MAPAS NUEVOS"
```

Sube el número de versión, reescribe `www/version.json` y lo sube a GitHub
Pages. En el teléfono, al abrir la app sale solo el aviso **¡NUEVA VERSION!**
con esas novedades (hasta tres, de hasta 34 letras cada una); ella toca
ACTUALIZAR, espera la barra y toca REINICIAR, sin salir de la app. Si dice
LUEGO, el aviso se queda en el rótulo de abajo a la izquierda.

El aviso y el reinicio tienen sus pruebas: `node tools/prueba-aviso.mjs`
recorre el flujo con toques de verdad y deja fotos en `vistas/aviso/`, y
`node tools/prueba-reinicio.mjs` comprueba que REINICIAR ejecuta solo el código
de la versión nueva.

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

La app queda con su ícono (un blasón: escudo azul y oro con un corazón rosa,
corona y dos espadas) y no le pide ningún permiso al abrirla.

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
| **LA MASA** | Romina con espada contra una masa que aprende de ti: cada vez que la matas, muda y vuelve con un órgano que contrarresta lo que TÚ haces | Pulgar izquierdo = mover · Botón grande = tajo · Botón chico = esquivar · Siete mudas; matar la séptima es ganar |

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
    games/            los ocho juegos
      surv-defs.js    SURVIVAL: enemigos, jefes y reglas
      surv-art.js     SURVIVAL: las criaturas, dibujadas por código
      ahorcado.js     AHORCADO: la escena y los dos modos
      ahorc-fisica.js AHORCADO: el muñeco (Verlet), sin DOM: se mide en Node
      ahorc-cara.js   AHORCADO: las expresiones
      ahorc-arte.js   AHORCADO: cielo, estanque, rana, globos y cuerpo
      ahorc-teclado.js AHORCADO: el teclado en pantalla
      ahorc-palabras.js AHORCADO: las palabras (las privadas van al principio)
      masa.js         LA MASA: pulgar, sonido, HUD, ceremonia y pantalla final
      masa-pelea.js   LA MASA: el director (rondas, mudas, puntaje), sin DOM
      masa-cuerpo.js  LA MASA: nucleo, piel y organos, sin DOM: se mide en Node
      masa-mente.js   LA MASA: los contadores y las lecciones de cada muda
      masa-caballera.js LA MASA: Romina con espada, sin DOM
      masa-arte.js    LA MASA: el dibujo
docs/                 investigación técnica y diseños
tools/                utilidades de desarrollo (no entran en el APK)
  icono.py            dibuja el ícono del APK en las cinco densidades
android/              proyecto nativo (lo genera Capacitor)
```

Sin dependencias, sin paso de compilación, sin archivos de imagen ni de sonido:
todo el arte y el audio se generan por código. El APK pesa poco por eso.

**El ícono también se dibuja por código**, con `tools/icono.py`: un blasón en
pixel art (el escudo con los colores de la capa de Romina, un corazón rosa,
corona y dos espadas en aspa), elegido el 23-09-2026 entre cuatro propuestas.
`build-apk.ps1` lo regenera en cada compilación, y tiene que ser así — `npx cap sync` reescribe los
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
- El APK pide **solo internet** (y el estado de la red), para el botón de
  actualizar del menú. Nada de fotos ni de almacenamiento: el permiso de fotos
  del juego GALERÍA se quitó el 23-09-2026, y `build-apk.ps1` lo borra si
  vuelve a aparecer en el manifest.
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
  la partida termina en el primer chapuzón, con una pantalla de fin propia: el
  muñeco sigue flotando con la rana encima, y sobre el panel el puntaje, el
  récord (con confeti), cuántas palabras adivinó y OTRA VEZ / AL MENU. Las palabras vienen de una lista
  de 445 en 12 categorías, en español latino y sin acentos (CAMION), con la Ñ.
  La dificultad es por letras, no por largo: PIÑA es más difícil que ELEFANTE.
- **A DOS** no toca el récord: uno escribe (el muñeco se tapa los ojos), elige
  la pista entre seis tejuelas, aparece PASALE EL TELEFONO, y el otro adivina
  con seis globos. Marcador J1-J2 y OTRA (CAMBIAN).
- **NOSOTROS**, el modo privado: se entra **manteniendo apretado 0,8 s el
  corazón** que hay debajo de los dos botones (un toque suelto no lo abre).
  Las palabras y sus pistas están al principio de
  `www/js/games/ahorc-palabras.js`, una línea por palabra: `['palabra',
  'pista']`. La pista se escribe entera en el cielo. Juega como SOLA, con su
  propio récord, y se acaba con fiesta cuando las adivina todas. No salen ni
  en SOLA ni en A DOS.
- La **Ñ** se añadió a la fuente 5x7 (`font.js`): era la única letra del
  español que faltaba.

```
node tools/prueba-ahorcado.mjs        # la física, diez pruebas con umbral
node tools/prueba-palabras.mjs        # la lista, los bots y las canciones
node tools/ver.js tools/ver-ahorcado.html caras.png 1000 1150   # las 16 expresiones a tamaño real
VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[6],{seed:7});espera2500;toca261:856;espera1200;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js"
```

## LA MASA

Un juego de pelea contra un solo enemigo que **aprende de ella**. La masa
empieza siendo un charco de carne con un ojo que acecha, avisa y embiste (los
mismos 480 ms de aviso que el charger de NEON FIST). Cada vez que Romina la
mata, la masa **muda**: convulsiona a cámara lenta, alrededor se repite en
silueta blanca la última pelea de ella, y vuelve con un ojo más y un órgano
nuevo que contrarresta lo que ella hizo. Si pega siempre por abajo, le crece
una placa de hueso abajo (CLANG: por ahí ya no). Si esquiva siempre a la
derecha, le crece un látigo que cae justo ahí. Si se le pega, una garra; si se
queda lejos, patas; si repite el combo, aprende a pararlo. Un letrero lo dice
(`APRENDIO / TAJO POR ABAJO`), pero **solo cuando es verdad**: con pocas
muestras dice CRECIO, y si ella varía, dice NO ME PILLO NADA. Lo que ella deja
de hacer, la masa lo olvida: la placa se cae. Siete mudas; la séptima lleva una
hoja que pega como ella. Matarla es ganar; morir muestra TU MONSTRUO con los
hábitos que le aprendió, en palabras.

No hay red neuronal ni evolución simulada: son contadores por sector y una
tabla de contramedidas, lo que hacen Killer Instinct, los ghosts de Tekken y
Metal Gear V. La lectura literal ("una IA que se inventa su forma") se
descartó midiendo: con treinta espadazos por pelea el retrato de la jugadora es
ruido. El diseño entero, con cada número y por qué, está en
`docs/design-masa.md`.

- **La pelea entera es sin DOM** (`masa-pelea.js` y lo que arrastra): el juego
  y el arnés de Node llaman a la misma función de paso. Cuatro pilotos físicos
  (con manías, variado, listo, machacador) juegan 400 partidas y 33 umbrales
  deciden: la masa le aprende la esquiva al de manías en 90 de 100, al variado
  no le inventa nada, al machacador lo para 397 de 622 veces, y la jugadora
  buena gana 63 de 100 en cuatro minutos y medio.
- **Nada hiere sin aviso de ≥ 0,35 s**, nunca más de tres avisos seguidos, y
  lo aprendido cambia cuándo y hacia dónde ataca, nunca cuánto avisa.
- Los mismos controles y la misma Romina que en NEON FIST, con espada: el
  pulgar ya sabe jugar esto.

```
node tools/prueba-masa.mjs                                  # los 33 umbrales
node tools/ver.js tools/ver-masa.html masa.png 1540 1900    # la hoja de contactos
VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[7],{seed:7});espera700;archivo:tools/prueba-masa-app.js;hasta90000:__arcade.sm.cur.P.estado==='muda';espera1200;disparo"
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
