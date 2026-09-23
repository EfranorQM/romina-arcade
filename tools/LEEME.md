# Herramientas de desarrollo

Nada de esto entra en el APK. Todo existe por la misma razón: **ver y medir**
antes de dar algo por bueno, en vez de razonar sobre el código.

---

## Ver la app de verdad, sin compilar

```
node serve.js                                   # en otra terminal
node tools/ver-app.js salida.png "GUION"
```

Corre la app en Chrome headless por el protocolo de DevTools y guarda capturas.
A diferencia de un `--screenshot` a secas, espera a que el canvas dibuje, manda
toques y arrastres reales, y **avisa de los errores de JavaScript** de la página
(sin eso, un fallo se ve igual que una pantalla negra).

El guion es una lista de pasos separados por `;`:

| paso | qué hace |
|---|---|
| `esperaN` | espera N milisegundos |
| `tocaX:Y` | un toque corto |
| `arrastraX:Y:X2:Y2` | arrastra despacio |
| `tiroX:Y:X2:Y2` | arrastra rápido y suelta (gesto de impulso) |
| `js:EXPR` | evalúa una expresión y **imprime lo que devuelve** (sin `;` dentro: parte los pasos) |
| `hastaN:EXPR` | espera (tope N ms) a que EXPR sea verdad: para capturar una muda, un aviso, un fin |
| `archivo:RUTA` | evalúa un `.js` del proyecto (para código con `;` dentro) |
| `disparo` | guarda una captura |

Con `VERTICAL=1` delante, la ventana se pone de pie (como el teléfono al jugar);
por defecto es apaisada, como en el menú.

La app expone `window.__arcade` para estas pruebas: permite saltar a una escena
concreta sin jugar hasta ella.

```
# el menú, y un gesto de impulso
node tools/ver-app.js menu.png "espera900;disparo;tiro900:300:400:300;espera900;disparo"

# el fin de partida con un récord, sin morir jugando
node tools/ver-app.js fin.png "espera900;js:__arcade.sm.go(__arcade.GameOver,{id:'skyline',score:1234,isRecord:true,title:'SKYLINE'});espera900;disparo"

# ¿arrancan los cinco juegos?
VERTICAL=1 node tools/ver-app.js x.png "espera1200;archivo:tools/prueba-juegos.js;espera6000;archivo:tools/prueba-juegos.js"

# ¿cuánto tarda el menú en dibujar un frame?
node tools/ver-app.js x.png "espera1500;archivo:tools/medir-menu.js;espera3500;archivo:tools/medir-menu.js"
```

## Probar SURVIVAL

```
node tools/ver.js tools/ver-survival.html criaturas.png 1150 1500
```

Hoja de contactos de las diecisiete criaturas (siete enemigos y diez jefes) más
las cinco caras de Roma, cada una al tamaño al que se ve **jugando** y ampliada.
A tamaño de juego salieron los defectos: el RELÁMPAGO era una mancha amarilla,
el escudo del MURO parecía un paraguas flotando, y el SILENCIO no tenía figura.

```
# los diez jefes, cada uno con su habilidad
node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[5],{seed:3});espera800;archivo:tools/prueba-jefes.js;espera50000;archivo:tools/prueba-jefes.js"

# jugar sola muchas olas: caza olas que no cierran, fugas y atascos
node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[5],{seed:11});espera700;archivo:tools/prueba-partida.js;espera90000;archivo:tools/prueba-partida.js"
```

`prueba-partida.js` juega con un piloto tonto (se pone bajo el enemigo más bajo
y dispara siempre) y vigila que ninguna lista crezca sin freno, que la ola
avance y que el puntaje suba. Con ella se descubrió que las olas duraban
veinticinco segundos.

## Probar LA MASA

```
node tools/prueba-masa.mjs             # 80 partidas con cuatro pilotos, 33 umbrales
node tools/prueba-masa.mjs detalle     # cada partida ronda por ronda
node tools/ver.js tools/ver-masa.html masa.png 1540 1900
```

El arnés importa la pelea real (`masa-pelea.js`, sin DOM) y la juegan cuatro
pilotos **físicos**: caminan, tienen el alcance de la espada, reaccionan a los
avisos con latencia humana y a veces no reaccionan. Uno tiene manías (pega por
abajo, esquiva a su derecha, repite el combo), uno es variado, uno es listo
(entra por el sector sin placa, sale de la línea amarilla) y uno machaca el
botón. Los umbrales miden que la masa aprende al de manías y no se inventa nada
del variado, que el listo puede ganar, y que nadie muere en seis segundos.
Cada constante del cuerpo y de la mente salió de aquí; si se toca una, se
vuelve a correr.

La hoja de contactos enseña la masa en once estados (placas, látigo avisando y
golpeando, garra con parada, herida, la ronda 7, la muda, aturdida) y a la
caballera en sus fases, a tamaño real y ampliada. Aquí se vio que la carne
giraba hacia el morado y se fundía con la arena, que el látigo era un
tentáculo gordo, y que los órganos dibujados encima partían el cuerpo con una
raya negra.

```
# jugar sola dentro de la app con el piloto listo, y capturar la muda
VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[7],{seed:7});espera700;archivo:tools/prueba-masa-app.js;hasta90000:__arcade.sm.cur.P.estado==='muda';espera1200;disparo;archivo:tools/prueba-masa-app.js"
```

`prueba-masa-app.js` engancha el piloto al `update()` del juego y, en la
segunda llamada, devuelve ronda, puntaje, lo que dijo cada muda, errores de
JavaScript y ms por frame. Con `hasta` se captura el instante exacto de una
muda o de la pantalla final sin cronometrar nada desde fuera.

## El OGRO de ROMINA

```
node tools/prueba-ogro.mjs                             # la pelea medida: 13 secciones
node tools/ver.js tools/ver-ogro.html ogro.png 1500 5000
python tools/gif.py ogro:garrote vistas/garrote.gif     # el MOVIMIENTO, a su velocidad
python tools/ogro-atlas.py RUTA/PNG/Animation/Troll1   # rehornear la hoja
```

El ogro ya no se dibuja por código: es un troll **pintado a mano** (pack
gratuito de CraftPix, <https://free-game-assets.itch.io/free-2d-game-troll>).
`ogro-atlas.py` lo reduce a 232 px, lo alinea (cada animación del pack trae un
lienzo distinto), le pone paleta común de 32 colores y contorno, y escribe
`www/img/ogro.png` más la tabla `ogro-atlas.js`. El pack original **no está en
el repo** (la licencia prohíbe redistribuir los archivos de origen y el repo es
público): para rehornear hay que bajarlo otra vez.

`ogro-sprite.js` decide qué fotograma toca: cada ataque es un guion que se
reparte sobre los tiempos de `ogro-cuerpo.js` (carga, golpe, vuelta), así que
la física no se tocó para cambiar el dibujo. La sección 13 del arnés comprueba
que el daño del garrote llega hasta donde llega la punta **dibujada**: con el
alcance de antes, el garrote le cruzaba la cabeza a ella sin hacerle nada.

`ver-ogro.html` enseña cada secuencia fotograma a fotograma (en rojo, la parte
activa). Con `?s=garrote` saca una sola secuencia a tamaño real, que es lo que
`gif.py` convierte en GIF. `vistas/` no va al repo.

## ROMINA, la caballera

```
node tools/prueba-caballero.mjs                              # su fisica: 9 secciones
node tools/ver.js tools/ver-caballera.html caballera.png 1500 4200
python tools/gif.py caballera:combo vistas/combo.gif         # combo, corre, salto, esquiva, parada...
python tools/romina-atlas.py RUTA/ArmoredHero                # rehornear la hoja
```

Como el ogro, ya no se dibuja por código: es la "FemaleKnight" de retsuto
(<https://retsuto.itch.io/femaleknight>, pixel art gratis) con el pelo y los
ojos recoloreados a negro, espejada para mirar a la derecha y doblada con
Scale2x. `romina-atlas.py` escribe `www/img/romina.png` y `romi-atlas.js`; el
pack original **no está en el repo** (su licencia prohíbe redistribuirlo).

La pose la sigue eligiendo `C.pose()` en `caba-cuerpo.js`, sin DOM, y el arnés
comprueba contra el ATLAS que todos los fotogramas se alcanzan jugando. La
sección 8 vigila que el daño de cada tajo llegue hasta donde llega su estela
dibujada. `ver-caballera.html` no elige poses a mano: simula cada acción con la
física real pulsando botones, como jugando.

El pack no trae esquiva, golpe recibido ni derrota: las tres salen de **su
salto** (despega, va recogida por el aire, cae agachada), que es lo que de
verdad hace el cuerpo. Montarlas con la agachada quieta, como al principio, se
leía como estar de rodillas resbalando.

## Los botones de ROMINA: ATACAR, SALTAR, ESQUIVAR, GUARDIA

```
node tools/ver.js tools/ver-botones.html vistas/botones.png 1440 900   # todos sus estados
python tools/gif.py escena:parada vistas/parada.gif          # parada y contraataque, en el juego
python tools/gif.py escena:barrido vistas/barrido.gif        # esquiva hacia atrás
python tools/gif.py escena:embestida vistas/embestida.gif    # esquiva atravesándolo
```

Cada botón es la respuesta a un ataque del ogro, y la sección 6 de
`prueba-ogro.mjs` lo **mide**: juega cada ataque con la regla real y cuenta en
cuántos frames se puede pulsar cada respuesta y salir ilesa (hace falta una
ventana de 250 ms). GUARDIA para solo el garrotazo (a tiempo es una PARADA y el
siguiente ATACAR es un CONTRAATAQUE); el barrido, la embestida y las ondas le
rompen la guardia. ESQUIVAR es un salto evasivo invulnerable: sin stick va
hacia atrás, con el stick hacia el ogro lo **atraviesa** (es la respuesta a la
embestida: en una arena de un solo eje no hay "a un lado").

Esa sección era antes una tabla escrita a mano y **mentía**: la guardia lo
paraba todo y, de cerca, ni siquiera paraba el garrotazo (comprobaba "de
frente" contra el punto donde cae el garrote, que con ella pegada al ogro queda
a su espalda). Por eso QUÉ le pega al ogro vive en `OG.golpeaA` y no en la
escena: el arnés mide la misma regla con la que se juega.

Los medallones se hornean una vez (`caba-botones.js`); los iconos son una
rejilla de 15 px que se contornea sola. Dos que no se leían y se rehicieron
mirando `ver-botones.html`: el arco de ESQUIVAR con trazo de 2 se cerraba en
una "A" rellena, y la chispa de GUARDIA con base horizontal parecía una corona.

## La partida de ROMINA: dificultad, primera pelea, nota y música

```
node tools/prueba-caba-partida.mjs                           # dificultades, puntos, maestro y canciones
python tools/gif.py escena:inicio vistas/inicio.gif          # elegir y la entrada
python tools/gif.py escena:victoria vistas/victoria.gif      # el remate, el final y la nota
```

`caba-partida.js` (sin DOM) lleva lo que rodea a la pelea. Hasta aquí la pelea
empezaba de golpe y se reiniciaba sola a los 3 s: sin principio, sin final y
sin récord (era el único juego del arcade que no guardaba ninguno).

- **Tres dificultades** (paseo, normal, furia): corazones, margen de la
  parada, vida del ogro, lo que tarda en AVISAR (solo el aviso: estirar
  también el golpe haría más difícil esquivar en la fácil) y lo que descansa.
  El arnés juega las tres con la regla real: en furia el aviso más corto es
  0,33 s y la guardia se puede levantar en 250 ms.
- **La nota** (S A B C) sale de los puntos ANTES de la dificultad, para que
  una S cueste lo mismo en paseo que en furia; los puntos (con el multiplicador
  de la dificultad) van al récord del menú, con los mensajitos del arcade
  (`MENSAJES_RECORD`, en `core.js`).
- **El maestro**: la primera pelea enseña. El ogro solo usa lo aprendido más
  el siguiente ataque; el primero de cada tipo sale a cámara lenta con su
  consejo y su botón brillando. Si en tres intentos no lo aprende, se suelta
  el siguiente igual (sin cámara lenta en las peleas de después). Lo
  aprendido se guarda con `Save.dato`.
- **La música**: la marcha de antes (`caballero`) suena al elegir y en la
  entrada; al A PELEAR entra `caballeroPelea` (Re dórico, cabe en las notas sin
  sostenidos); en la furia del ogro, `caballeroFuria`; y al final, fanfarria o
  lamento. El arnés revisa TODAS las canciones del arcade: una nota que el
  secuenciador no conoce no suena y no avisa.

## La ARENA de ROMINA: el salón del castillo

```
node tools/prueba-arena.mjs                                  # repisas, cascotes, escombros
python tools/gif.py escena:arena vistas/arena.gif            # la ESCENA REAL grabada
python tools/arena-atlas.py RUTA/PNG/Battleground2/Bright    # rehornear el salón
```

El salón es el campo de batalla 2 de "Free Pixel Art Fantasy Game
Battlegrounds" de CraftPix (<https://free-game-assets.itch.io/free-pixel-art-fantasy-game-battlegrounds>),
a x2 como ella y alargado de 960 a 1200 repitiendo sus propios periodos (la
pared cada 120 px, las bóvedas cada 240, el suelo cada 48). Se eligió entre los
cuatro del pack poniendo al troll delante: en la hierba y en el bosque el verde
se funde; contra la alfombra roja se lee. La repisa y los cascotes se pintan
con el grano de la piedra de la propia bóveda.

`caba-arena.js` (sin DOM) lleva lo que cambia la pelea: dos **repisas** a 88 px
(arriba no llegan las ondas, pero sí el garrote), los **cascotes** que suelta el
pisotón (avisan 1.19 s; si el ogro se mete debajo, le duelen a él) y los
**escombros** que dejan (cortan el paso, paran las ondas, el ogro los revienta,
la espada los rompe). La física de ella acepta un `mundo` opcional con repisas y
bloques: sin él, el suelo es plano y el arnés viejo mide lo mismo que antes.

`ver-escena.html` graba la **escena entera** de verdad (guiones `arena`,
`parada`, `barrido`, `embestida`, que empiezan ya peleando y con todo
aprendido, e `inicio` y `victoria`, los de la partida): importa `caballero.js`,
la mueve con un guion de botones (que mira dónde están ella y el ogro, como
alguien jugando) y la dibuja con su cámara y sus partículas. Ojo con dos
trampas que salieron al hacer el guion: pulsar SALTA es a la vez el flanco y el
botón apretado (sin lo segundo el salto se corta en el acto), y en el aire se
conserva la carrerilla (saltando justo debajo de la repisa se pasa de largo).

## Ver las carátulas del menú

```
node tools/ver.js tools/ver-portadas.html portadas.png
```

Renderiza `covers.js` de verdad (canvas real, no una imitación) y arma una hoja
con cada carátula a tres tamaños: el del centro del carrusel, el de una lateral
y ampliada x3.

**Se juzgan a tamaño de menú, no ampliadas.** Todos los defectos reales
aparecieron ahí: el cuerpo de SYMBIOTE era un pentágono con picos, el puño de
NEON FIST se leía como una mano abierta, y la corredora de SKYLINE saltaba
sobre un edificio en vez de sobre el hueco.

## Simular la física del menú

```
node tools/prueba-menu.mjs
```

Corre el modelo del carrusel miles de pasos y comprueba seis cosas: que siempre
encaja, que el índice nunca se sale del array, que un gesto rápido avanza sin
descontrolarse, que la fila circular no acumula error, que tocar una lateral la
centra **exactamente**, y que no rebota.

Encontró tres fallos que las capturas no mostraban, entre ellos que tocar una
carátula lateral dejaba la fila una posición corta.

## Previsualizar arte vectorial sin navegador

Para el arte de un juego con `meta.smooth` (hoy solo FURIA):

```
node tools/capture.mjs "file:///ruta/absoluta/a/www/js/games/moto-art.js" > ops.json
python tools/raster.py ops.json salida.png [columnas]
```

`capture.mjs` ejecuta `drawBike()` contra un contexto 2D falso que **graba**
cada comando (paths, transformaciones, degradados) y los vuelca como JSON.
`raster.py` los rasteriza con PIL: supersampling x4, degradados lineales por
máscara, y arma una hoja con todas las poses etiquetadas.

Las poses a renderizar se editan en el array `poses` de `capture.mjs`.

**Trampa:** la primera versión del rasterizador ignoraba los degradados y los
pintaba gris plano. Se juzgó el diseño sobre una imagen falsa hasta que se
implementaron. Si se añade una función de canvas nueva al arte (sombras,
`bezierCurveTo`, patrones), hay que soportarla aquí o la vista previa mentirá.
Por eso lo nuevo (`ver.js`, `ver-app.js`) usa un canvas de verdad y no puede
mentir de esa forma.

## El ícono del APK

```
python tools/icono.py --hoja hoja.png   # verlo a tamaño real y bajo las máscaras
python tools/icono.py --verificar       # comprobar que no lo recorta el launcher
```

## Por qué existe todo esto

El diseño de la moto se corrigió mirándola, no razonando sobre el código. Cada
defecto real (piloto del doble de tamaño, horquilla cuatro veces más gruesa de
lo debido, motor más claro que la carrocería, colín por debajo del asiento)
apareció al ver el PNG, y varios eran invisibles en el código.
