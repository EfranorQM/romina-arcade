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

# ¿arrancan todos los juegos? (y la vuelta al menú desde el último)
VERTICAL=1 node tools/ver-app.js x.png "espera1200;archivo:tools/prueba-juegos.js;espera6000;archivo:tools/prueba-juegos.js;js:__arcade.sm.go(__arcade.Menu);espera900;disparo"

# ¿cuánto tarda el menú en dibujar un frame?
node tools/ver-app.js x.png "espera1500;archivo:tools/medir-menu.js;espera3500;archivo:tools/medir-menu.js"
```

`medir-menu.js` cronometra el JavaScript del dibujo, no el pintado: Chrome
pinta después, fuera del cronómetro. Para saber lo que cuesta de verdad hay que
forzar el pintado leyendo un píxel (`getImageData(0, 0, 1, 1)`) tras cada
dibujo. Con el salón del menú ya optimizado, `medir-menu.js` da 0,2 ms y con
el pintado forzado sale 1,3; antes de hornear su fondo eran 4,1 (ver «El salón
del menú»).

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
node tools/prueba-mandos.mjs                                 # tamaño, zonas de toque y stick, medidos
node tools/ver.js tools/ver-botones.html vistas/botones.png 1200 1050  # antes/ahora, zonas y estados
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

**Donde van y a quien le toca cada toque** (`caba-mandos.js`, sin DOM, rehecho
el 24-09-2026 porque "el tamaño o posición de los botones no es lo
suficientemente rápido o cómodo"). Dos columnas: la ESPADA a la izquierda
(GUARDIA sobre ATACAR: de la parada al contraataque se baja el pulgar) y las
PIERNAS a la derecha (ESQUIVAR sobre SALTAR); abajo, grandes, los dos que más
se pulsan. Cada toque va al botón de **borde** más cercano (`MD.aQuien`, hasta
64 px fuera de él): no hay huecos entre botones ni uno que se quede los toques
de otro. `prueba-mandos.mjs` lo cuenta punto a punto con la misma función que
usa la escena. Medido contra los de antes (v1.0.23): medallones de 7,7-9,7 mm
en el teléfono de ella (ahora 10,2-11,6; una yema mide 10-14), un 30 % de la
esquina de los botones que no era de ninguno (ahora 0) y GUARDIA, que se miraba
primero, se quedaba el 8 % de la zona de SALTAR.

**El stick** corre a tope con 36 px de pulgar (4,4 mm; antes 80 px, casi 1 cm,
y la velocidad iba en proporción: con el pulgar a medias corría a medias, y
ningún foso se cruza corriendo al 70 %). Es el mismo `Stick` de `input.js` con
radio 60 y la curva `MD.curvaStick`.

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
  El arnés juega las tres con la regla real. Cada dificultad declara los
  REFLEJOS que pide (0,60 / 0,45 / 0,35 s) y `prueba-peleas.mjs` comprueba
  que todos los ataques los cumplen (ver "Las peleas de ROMINA").
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

## Las peleas de ROMINA: reflejos de persona

```
node tools/prueba-peleas.mjs      # plazos por ataque, la pelea entera y el bosque, en las tres dificultades
```

"Es muy difícil incluso en el modo fácil" (24-09-2026). Los arneses medían
cada ataque suelto con reflejos de 0,25 s (los de un pulgar entrenado que ya
espera el golpe) y contaban la ventana desde el instante cero, y nadie jugaba
la pelea ENTERA. Una persona tarda en VER el ataque, elegir entre cuatro
botones y pulsar: 0,35 s quien juega mucho, 0,45 una persona normal, 0,55-0,65
quien juega poco. `piloto-ogro.mjs` juega la pelea entera así (reflejos que
varían, saltos cronometrados con error) y con los números de la v1.0.24 salió:

- el garrotazo daba 0,42 / 0,32 / 0,23 s para levantar la guardia (paseo,
  normal, furia) y el barrido 0,48 / 0,38 / 0,30 para esquivarlo;
- en NORMAL una persona normal no ganaba NINGUNA pelea (0 de 40), en FURIA
  nadie, y en PASEO quien se defendía con 0,6 s ganaba el 20 % y el que machacaba
  ATACAR sin defenderse, el 77 %;
- el pisotón de cerca no lo libraba nada (el pie no miraba la altura: dos
  corazones fijos aunque saltara, como dice el consejo), y la estocada del
  barrido avanzaba 34 px y alcanzaba por 3 px a quien ya la había esquivado.

Ahora cada dificultad declara sus `reflejos` y tres ritmos de aviso
(`caba-partida.js`): el del ogro, el del bosque (un lobo muere en tres tajos:
con el aviso del ogro, en paseo pasaba el bosque hasta el que no se defendía) y
el de los ataques de CARRERA (embestida y acometida), que no se alarga: se
esquivan atravesándolos cuando vienen, y con más aviso quien reacciona rápido
salta antes de que arranquen. Con sus reflejos se gana el 100 % en paseo y
normal y el 63 % en furia, y el bosque se pasa siempre; sin defenderse no se
gana en normal ni en furia y en paseo se gana la mitad y casi sin vida.

Trampas del propio piloto, que parecían del juego (medir con un piloto tonto
es medir al piloto):

- Esquivaba la embestida en cuanto la veía; de lejos eso es caer delante del
  ogro antes de que arranque. Una persona espera a que venga.
- Solo pegaba con el ogro abierto: la pelea duraba el doble y recibía más.
- Durante todo el pisotón no miraba el techo y se comía los cascotes.
- En el bosque, aterrizando en el borde (x 2887-2899, el tramo de la kitsune
  empieza en 2900) la kitsune no la veía y el piloto le guardaba la distancia:
  se esperaban las dos 300 s.
- Una cuenta que decía "estaba en mitad de un tajo" miraba los reflejos del
  ataque ANTERIOR: el piloto registra el ataque un frame después de que empiece.

## Medallas, armario y el ogro que aprende (ROMINA)

```
node tools/prueba-ogro.mjs                                   # sección 14: el ogro que aprende
node tools/prueba-caba-partida.mjs                           # sección 4: medallas y armario
```

- **Once medallas**, cada una con un reto que no es solo ganar, y cada una
  gana UNA prenda del **armario** (capa, falda o estela): el armario es la
  lista de medallas. Se tiñe la hoja cambiando colores exactos; la estela
  tiene blancos propios desde el horneado (`marca_estela` en
  `romina-atlas.py`), porque compartía los de la armadura. El pelo no se toca.
- **El ogro que aprende**: la escena le cuenta las costumbres de ella
  (`anotaHabito`: guardia, salto, esquiva hacia atrás o a través) y al entrar
  en su furia elige UNA contramedida contra la más repetida (finta, doble
  pisotón, persecución o vuelta rápida), que se ANUNCIA con un cartel. Cada
  una tiene su respuesta medida en el arnés. Solo aprende cuando ella ya no
  tiene nada que aprender.
- Al probarlo salió un fallo viejo: el aviso de FURIA y su música no salían
  nunca. La escena comparaba el estado del ogro de antes y después de SU paso,
  y el rugido lo pone el golpe de ella, que va después en el mismo paso. Ahora
  compara con el último estado que vio (`stVisto`).

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

## La AVENTURA de ROMINA: el bosque

El segundo modo de ROMINA (pestaña AVENTURA en la pantalla de elegir; la pelea
contra el ogro sigue en su pestaña). Un nivel que avanza: Romina va hacia la
derecha por un bosque de 7400 px, la cámara la sigue, y por el camino hay
fosos, troncos que ruedan, ramas que caen, una hoguera a mitad de camino y
enemigos. Llegar al árbol con cara es ganar.

```
node tools/prueba-nivel.mjs                                  # el nivel, medido
node tools/ver-app.js x.png "espera1200;archivo:tools/prueba-aventura-final.js;disparo"
                                                             # cada final acaba (la escena de verdad)
python tools/gif.py aventura:lobo vistas/lobo.gif            # grabar un tramo
python tools/bosque-atlas.py RUTA/PNG/Battleground3/Bright   # hornear el bosque
python tools/enemigos-atlas.py RUTA/enemigos                 # hornear lobo y kitsune
```

Dónde está cada cosa, todo sin DOM salvo el dibujo:

- `caba-nivel.js`: el nivel es DATOS (`BOSQUE`: fosos, tocones, zonas de
  troncos y de ramas, hoguera, salida y enemigos) y aquí vive lo que pasa en él.
- `caba-enemigos.js`: el hombre lobo y la kitsune. `caba-aventura.js`: la
  escena (entrada, juego, caída, final, resultado). La escena de ROMINA le pasa
  el mando: vive dentro de ella porque el arcade solo pausa las escenas que
  están en su lista de juegos.
- El cuerpo de Romina es el de la pelea (`caba-cuerpo.js`), con tres cosas
  nuevas que la pelea no usa: `mundo.x0/x1` (las paredes del nivel),
  `mundo.sinSuelo` (el suelo son bloques, uno por tramo de camino, y entre dos
  tramos hay un foso) y la esquiva hacia atrás que se para en el borde.

Lo que miden las secciones de `prueba-nivel.mjs`:

- **Fosos.** El salto de Romina cruza 190 px como mucho (esquivando hacia
  delante, 280). Un foso de 120 deja 350 ms para despegar. Por eso van de 100
  a 120, y el ancho lleva un tocón. Con el borde que perdona (`AGARRE`, 16 px:
  si cae un poco antes del otro lado, se sube; solo por el lado HACIA el que
  va, o haría de pared invisible al salir andando de un borde).
- **El pulgar (1b).** Hasta el 24-09-2026 todo esto se medía MANTENIENDO el
  botón y con el stick a tope, y un pulgar TOCA y mueve el stick unos
  milímetros. Con un toque (el salto se recortaba si se soltaba antes de 90
  ms) y el stick de entonces, el foso de 120 se cruzaba 1 vez de cada 9, y
  ninguna por debajo de 8 mm de stick: "morimos fácilmente con los huecos".
  Ahora el salto es siempre entero, el coyote dura 0,12 s y el stick corre a
  tope con 4,4 mm; esta sección juega con el `Stick` real, un toque de un
  frame y un pulgar que apunta al borde con ±90 ms de error: 93-98 % de saltos
  buenos (±120 ms: 84-93 %). Contra el código de antes, 22 fallos.
- **Troncos.** Con 30 de radio a 330 px/s, saltarlos solo salvaba pulsando en
  117 ms; a 24 y 380 px/s son 250 ms. La guardia no los para.
- **Ramas.** Avisan con su sombra 1,2 s antes de llegar al suelo.
- **Lobo.** El zarpazo se para con la guardia (433 ms de margen; PARADA, 167 ms)
  y la acometida se atraviesa esquivando (650 ms).
- **Kitsune.** La bola de fuego se para (1,4 s de margen) y con una PARADA se
  devuelve y le quema; saltar no la libra. Del corro se libra apartándose.
- **El piloto** (`tools/piloto-aventura.mjs`, el mismo que usa la grabadora):
  reacciona 0,25 s después de ver cada cosa, nunca antes, y salta con un
  TOQUE (hasta el 24-09-2026 mantenía el botón 40 frames: nadie juega así, y
  por eso nunca vio que con toques no se cruzaba ningún foso; con toques y el
  código de antes no llegaba al final en ninguna dificultad). Con reflejos de
  persona normal (0,35 s) pasa el bosque en PASEO y NORMAL, y FURIA muerde más.
  Un MACHACÓN que salta y ataca pero no se defiende no pasa (0 de 12), y el
  que solo corre se cae en el primer foso.

Trampas que salieron midiendo, y que no se veían en una captura:

- **Enemigos al otro lado de un foso.** Un lobo apostado en el borde le daba el
  zarpazo en pleno salto y la tiraba dentro; una bola de fuego también. Ahora
  solo van a por ella si pisa su TRAMO de camino, el tramo entero: con los
  límites por donde se mueven, que empiezan lejos del borde, ella se quedaba
  justo pasado el foso y los dos se esperaban para siempre.
- **La bola a quemarropa.** La kitsune decidía lanzar a 300 px, pero mientras
  cargaba Romina se le echaba encima y la bola nacía a 80 px: imposible de
  parar. Ahora, si al soltarla ella está a menos de 250 px, hace el corro, que
  avisa.
- **Pelear de espaldas a un foso.** Esquivar hacia atrás (lo que hace ESQUIVAR
  sin stick) era caerse. La esquiva hacia atrás se para en el borde, y los
  enemigos esperan lejos de los bordes (el lobo a 300 px).
- **Dos del mismo tramo a la vez.** Despertándose por distancia, los lobos de
  las ramas se sumaban a la pelea con la kitsune. Los que comparten tramo se
  despiertan cuando ella pasa por su sitio.
- **Las partículas** del arcade se pintan en coordenadas de pantalla: con la
  cámara en marcha, el polvo se quedaba atrás. Se corren con la cámara.
- **Las bolas se borraban al salir de cámara**, y el arnés no mueve la cámara:
  nacían y desaparecían. Se borran por distancia a ella.
- `tools/ver.js` servía los `.mjs` como binario y la grabadora no cargaba el
  piloto: ahora son JavaScript.
- **Perder el último corazón en un foso no acababa nunca** (salió en el
  teléfono, 23-09-2026: "la pantalla se quedó volviendo negra y encendiendo").
  El cuerpo seguía cayendo, el nivel avisaba otra caída y la escena volvía del
  final al fundido de la caída, una vuelta cada 3,3 s. Igual si un golpe la
  derrotaba en pleno salto sobre un foso. Ahora solo cae quien está viva, la
  escena solo atiende caídas jugando y una partida se acaba una vez.
  `prueba-aventura-final.js` recorre los cuatro finales con la escena de
  verdad y apunta la secuencia de fases.

El arte:

- **El bosque** es el campo de batalla 3 del mismo pack que el salón. Cada capa
  empalma consigo misma cada 480 px (medido), así que se repite sin costuras; se
  guarda solo en las filas en que se ve, y el camino en dos (la hierba de
  detrás, entera; el piso, por tramos, con los fosos entre ellos). El tronco que
  rueda, la rama, el tocón, las paredes del foso y la hoguera se pintan en
  `bosque-atlas.py` con la paleta del propio bosque. El bosque cuesta 0,6 ms
  por frame y la escena entera 0,85 (pintado forzado).
- **Los enemigos** son de dos packs gratis de CraftPix (el agente bajó nueve y
  se compararon a escala): el hombre lobo negro y la kitsune. En esos packs las
  animaciones NO comparten lienzo: el mismo cuerpo sale hasta 19 px más atrás
  en unas que en otras, y `enemigos-atlas.py` las alinea con el reposo (el
  tronco, de la cintura para arriba). Doblados con Scale2x, como ella. Los
  packs no están en el repo, solo lo horneado.
- La música del bosque es `SONGS.caballeroBosque`, en Fa lidio (el modo que
  suena a encantado y cabe entero en el secuenciador).

## Los efectos de ROMINA

```
python tools/gif.py aventura:foso vistas/efectos-salto.gif     # despegar y caer (el polvo)
python tools/gif.py escena:embestida vistas/efectos-esquiva.gif # las copias de la esquiva
python tools/gif.py escena:parada vistas/efectos-parada.gif    # el arco de la guardia y la parada
python tools/gif.py escena:victoria vistas/efectos-combo.gif   # los cortes del combo
```

`caba-efectos.js` pinta lo que hace ella, igual en la pelea y en la aventura
(24-09-2026: "sus efectos son tan básicos"): el aro de polvo y las nubes al
despegar y al caer (y se estira y se aplasta, alrededor de los pies), las
COPIAS violetas y las rayas de la esquiva, el CORTE que cruza al enemigo en el
sentido de cada golpe con su estrella y sus chispas, el arco de la guardia (de
oro en la ventana de la parada), el aro de oro de la parada y el borde rojo al
recibir. Todo en coordenadas del mundo, con `fillRect` a pixel entero. Lo que
salió mirándolo a escala de teléfono y no leyendo el código:

- **El polvo del color del camino no se ve**: el del bosque (#cecb85) sobre
  el camino (#adaa6d). En la aventura va uno más claro (`POLVO_FX`).
- **El corte crecía desde cero**, y el golpe congela el mundo (hitstop) con
  los efectos dentro: el frame del impacto, el que más dura, no enseñaba nada.
  Sale entero desde el primer frame.
- **Blanco sobre blanco**: el enemigo destella en blanco al recibir, justo
  cuando sale el corte. Cortes, estrellas y aros llevan contorno oscuro.
- Puntos sueltos (aros de 10 puntos) no se leen: los aros van seguidos.

Coste, con el pintado forzado y todo a la vez (esquiva, remate, parada,
aterrizaje y borde rojo): 0,3 ms; la escena pasa de 0,7 a 1,0 ms.

## Las actualizaciones: estrenar, confirmar y volver atrás

```
node tools/publica.mjs                         # publicar (sube www/ a gh-pages)
node tools/ver-app.js x.png "espera3000;archivo:tools/prueba-ota.js;espera14000;archivo:tools/prueba-ota.js;js:location.reload();espera5000;archivo:tools/prueba-ota.js" "https://efranorqm.github.io/romina-arcade/"
node tools/ver-app.js x.png "espera1500;archivo:tools/prueba-arranque.js;js:location.reload();espera700;archivo:tools/prueba-arranque.js;js:location.reload();espera1200;archivo:tools/prueba-arranque.js;js:location.reload();espera4000;archivo:tools/prueba-arranque.js;js:location.reload();espera1200;archivo:tools/prueba-arranque.js;js:location.reload();espera1200;archivo:tools/prueba-arranque.js"
```

`prueba-ota.js` baja la versión publicada y comprueba que tras reiniciar corre
el código nuevo. `prueba-arranque.js` (con `serve.js` en marcha) prueba lo que
pasa después, con el service worker de verdad y dos versiones de mentira:
estrenar, confirmar y volver atrás.

**Lo que falló el 23-09-2026.** La versión nueva se confirmaba con un reloj de
20 s. Si la app se cerraba antes (o Android la dormía en segundo plano, que
para los temporizadores), el siguiente arranque la daba por rota y volvía...
al APK, la v1.0.8, con el ROMINA de pruebas: "solo me aparece el mapa". Ahora:

- **Se confirma por latidos**: 120 fotogramas pintados enteros (`latido()` en
  `update.js`, llamado al final de cada fotograma de `main.js`). Una versión
  rota de verdad no llega a pintar dos segundos.
- **Se vuelve a la ANTERIOR** (`rom.prev`, cuya caché guarda `limpiaViejas`),
  no al APK, que puede ser de hace semanas.
- **Al worker se le dice siempre qué versión servir**, también "ninguna": si no,
  seguía sirviendo de la última que se le dijo aunque ya estuviera borrada.

El APK de Romina lleva dentro la v1.0.8: si todo lo demás falla, es a lo que
vuelve. Recompilarlo lo pondría al día, pero hay que reinstalarlo a mano.

**Emular el teléfono: dos orígenes.** En el teléfono la app vive en
`https://localhost` y las actualizaciones bajan de `github.io`. Las pruebas
con un solo origen no ven lo que pasa entre los dos:

```
node tools/servidor-estatico.js android/app/src/main/assets/public 8090
node tools/servidor-estatico.js www 8091 cors
rm -rf C:/tmp/pt
PERFIL=C:/tmp/pt node tools/ver-app.js x.png "espera2500;archivo:tools/emula-telefono.js;js:location.reload();espera4000;archivo:tools/emula-telefono.js;espera6000" "http://localhost:8090/"
PERFIL=C:/tmp/pt node tools/ver-app.js x.png "espera5000;archivo:tools/emula-telefono.js" "http://localhost:8090/"
```

La segunda línea es la app recién actualizada; la tercera, cerrarla y volver a
abrirla: `PERFIL` hace que `ver-app.js` reutilice el perfil de Chrome (datos,
caché y worker) en un proceso nuevo. Recargar la página no vale como reinicio:
el navegador reusa lo que tiene en memoria y esconde si la caché va bien.

Así salió (con la foto del aviso de Romina, el 23-09-2026) que lo descargado
se guardaba con su dirección de GitHub: el juego actualizado pedía 70 de sus 71
ficheros directamente a GitHub (sin internet no arrancaba) y el dibujo de
Romina era "de otro sitio", así que pintar el traje ganado (que lee sus
píxeles) reventaba ROMINA al entrar: *the canvas has been tainted*. Ahora
`update.js` guarda lo descargado como propio (`propia()`), rehace al arrancar
las cachés bajadas antes (`reparaCache()`), y el dibujo de Romina se pide con
permiso (`crossOrigin`). Sin el arreglo, `emula-telefono.js` da MAL.

**Cuando algo revienta en el teléfono.** Allí no hay consola: una excepción
dejaba la pantalla congelada en el último fotograma. Ahora `main.js` atrapa los
fallos de las escenas (al entrar, jugando, pintando y al tocar), pinta abajo un
aviso con la versión, el error y los dos primeros `fichero.js:línea` de la
pila, y si el juego falla al entrar o sin parar, vuelve al menú. El primero se
guarda en `localStorage['rom.error']`. Con una foto del aviso basta para saber
qué arreglar. Como ya no llegan como excepción, `ver-app.js` cuenta también los
`console.error`, y `prueba-juegos.js` mira `rom.error`.

## Ver las carátulas del menú

```
node tools/ver.js tools/ver-portadas.html portadas.png
```

Renderiza `covers.js` de verdad (canvas real, no una imitación) y arma una hoja
con cada carátula a tres tamaños: el del centro del carrusel, el de una lateral
y ampliada x3.

Las carátulas se pintan al doble (`ESC = 2` en `covers.js`, 192x256 píxeles
para 96x128 de dibujo), porque el menú va a x2. La de ROMINA no se dibuja por
código: es Romina frente al ogro, con los dibujos del juego (su atlas, el troll
y el salón), y se pinta cuando esos dibujos terminan de cargar; hasta entonces
es un cielo con el marco. Por eso `ver-portadas.html` espera a los tres
cargadores antes de copiar.

**Se juzgan a tamaño de menú, no ampliadas.** Todos los defectos reales
aparecieron ahí: el cuerpo de SYMBIOTE era un pentágono con picos, el puño de
NEON FIST se leía como una mano abierta, y la corredora de SKYLINE saltaba
sobre un edificio en vez de sobre el hueco.

## El salón del menú

El menú es un salón recreativo: cada juego es una máquina (su marquesina con el
nombre, su carátula en la pantalla, palanca, botones y monedas) y detrás está el
salón, con el cartel de neón, una fila de máquinas lejanas que corre más
despacio al arrastrar y la moqueta. El dibujo está en `www/js/salon.js`; el
arrastre, el muelle y los toques siguen en `menu.js`.

```
# el salón con ROMINA en el centro, y a medio arrastre
node tools/ver-app.js salon.png "espera1500;js:(__arcade.Menu.pos=8,__arcade.Menu.dest=8);espera900;disparo;pulsa700:300;mueve600:300;espera120;disparo;suelta600:300"
```

Tres cosas que no se ven en el código:

- **El menú va a x2** (`ss: 2`, 1200x540). `font.js` hornea el texto a x1 y lo
  divide por el sobremuestreo, así que con `ss: 2` todo texto sale a la mitad.
  SURVIVAL vive así desde siempre y sus escalas cuentan con ello, de modo que
  la fuente no se toca: `salon.js` exporta `text` y `textCenter`, que piden la
  escala multiplicada por el sobremuestreo. El menú escribe con esas.
- **Los degradados son lo caro.** Pintado en cada frame, el fondo costaba 3 ms
  (la luz de la máquina 1,6; la pared 0,77; la sombra del suelo 0,4), cuando un
  rectángulo liso del mismo tamaño cuesta 0,05. Ahora la pared, la fila lejana
  y la moqueta con su sombra se hornean una vez y se copian, y la luz son
  cuatro círculos lisos de alfa bajo: el fondo cuesta 0,4 ms y el menú entero
  1,3 (medido con el pintado forzado, Chrome sin GPU).
- **La fila lejana se desplaza al píxel del lienzo**, no al virtual: corre a
  0,3 de la fila y a píxeles virtuales avanzaba a saltos al arrastrar despacio.
  Sus pantallas titilan con rectángulos pintados encima de la tira horneada; se
  comprobó leyendo píxeles que caen justo encima en siete desplazamientos.

Al volver de un juego, su máquina sigue en el centro (antes el menú volvía
siempre al primero, y había que ir a buscar el juego para echar otra).

## Simular la física del menú

```
node tools/prueba-menu.mjs
```

`SEP` (la separación entre máquinas, 100) está copiada de `menu.js`: si cambia
allí, hay que cambiarla aquí.

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
