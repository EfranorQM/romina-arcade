# SYMBIOTE — unidades canónicas

El diseño se fusionó a partir de cinco investigaciones que eligieron resoluciones
distintas (540x1200/TS=16, 360x800, 270x600). **Este archivo manda sobre
`design-symbiote.md` en todo lo que sea número o unidad.** Cuando el diseño diga
otra cosa, gana esto.

## Resolución y rejilla

| | Valor | Por qué |
|---|---|---|
| Resolución virtual | **540 x 1200** | 20:9 exacto (1200/540 = 2.2222) → llena el 1080x2400 del Note 10 sin barras. Escala ×2 **entero** (1080/540) → cero parpadeo con la cámara en movimiento constante. Y ×2 exacto sobre los otros juegos (270x600), así que `bake(..., 2)` reusa el mismo idioma de arte. |
| Tile | **TS = 24** px virtuales | A TS=16 la pantalla muestra 33.8 tiles de ancho y las salas se leen como un mapa lejano. A 24 son 22.5 x 50 tiles, que es el encuadre de sala legible. La cuerda de 156px cruza 6.5 tiles: un arco de balanceo legible. |
| Nivel | 44 x 88 tiles máx = **1056 x 2112 px** | 1.96 pantallas de ancho × 1.76 de alto. La cámara scrollea en **ambos ejes**, no solo vertical. |
| Escala de sprites | `bake(..., 2)` | Mismo estilo que los otros tres juegos, al doble de tamaño. |

## Constantes de física (validadas por simulación)

```
GRAV      1400 px/s^2      SWING     2200 px/s^2 (tangencial)
AUTH       620 px/s        MAXSPD     900 px/s
AIR      0.999 /substep    REEL_IN    220 px/s     REEL_OUT  260 px/s
LEN_MIN     40 px          LEN_MAX    156 px  (13 enlaces x REST 12)
SEG         14 partículas  SUB          2 substeps   ITERS  3
CAMINAR     78 px/s        BODY_R      14 px
```

**El "authority falloff" no es opcional.** El empuje tangencial se escala por
`fall = max(0, 1 - |velTangencial| / 620)`. Sin eso la velocidad se pega al tope
y el arco del péndulo desaparece: se siente como mantener un botón de acelerar.
Con eso oscila (rápido abajo, lento arriba) y acumula en 3-4 balanceos. Eso *es*
la sensación buscada.

**Al soltar, nunca asignar `ox = x`.** La velocidad es implícita en `(x - ox)`;
igualarlos tira toda la inercia acumulada, que es justo lo más satisfactorio.

## Correcciones obligatorias sobre el diseño

Salieron de la revisión adversarial. Todas son bugs reales o problemas de
jugabilidad verificados, no opiniones.

1. **`Pool` necesita `reset`.** `new Pool(cap, make, null)` devuelve el objeto
   reciclado con todos sus campos viejos: los restos reaparecerían congelados.
   Todo pool de este juego pasa una función `reset` que limpia el objeto.

2. **El slam pedía un tercer dedo.** Estando colgada, el pulgar derecho mantiene
   el botón y el izquierdo está en el joystick: no queda dedo para tocar.
   → El slam se dispara con un **flick del joystick** (invertir la dirección
   radial de golpe), no con un toque nuevo.

3. **El yank a toque era estrategia dominante**: el input más barato, el
   enfriamiento más corto y la mayor curación, además saltándose el mejor gore.
   → Se sube su enfriamiento y se baja su curación; matar por impacto a
   velocidad cura más. Que la jugada espectacular sea también la eficiente.

4. **Las tuberías permitían atrincherarse** sin riesgo (a prueba de enemigos por
   diseño). → Estar dentro de una tubería drena vida lentamente y la salida no
   avanza: sirve para reposicionarse, no para esconderse.

5. **La flecha de salida apunta a través de paredes.** En un nivel con pasillos
   en bucle eso la manda contra un muro. → La flecha marca el **siguiente nodo
   de la ruta** (BFS sobre el grafo de salas), no la salida en línea recta.

6. **Los pasillos de 2 tiles (48px) matan el balanceo**: el cuerpo mide ~60px.
   → Ancho mínimo de pasillo **3 tiles (72px)**, y las salas grandes deben
   garantizar al menos un vano de 5+ tiles de alto para poder columpiarse.

7. **La vida era plana y luego caía en picado.** 6-9 científicos curando 12 cada
   uno contra 100 de vida hace la primera mitad trivial. → Curación por
   científico a 6, y la amenaza aparece antes.

8. **La partida de 12-20 min con un solo puntaje al final** contradice a una
   jugadora casual. → Puntaje **por nivel**, acumulado. Cada nivel completado
   guarda progreso; morir no borra todo.

9. **El slam tunelaba paredes** a 1333 px/s. → El cuerpo se mueve siempre con
   barrido DDA (`sweepBody`), nunca por teletransporte, y con SUB=2 mínimo.

10. **El spray arterial desaparecía justo en las mejores muertes** (el pool de
    48 se llenaba y `spawn()` devolvía null). → Las muertes grandes reciclan la
    partícula más vieja en vez de descartarse.

11. **Los primeros 10 segundos no garantizaban acción.** → La generación
    **garantiza** 2+ científicos y una pared colgable a la vista del punto de
    entrada.

12. **El aim assist de 44px se robaba el verbo principal**, enganchando enemigos
    cuando ella apuntaba a la pared. → Precedencia explícita: si el rayo directo
    da en geometría antes que en el radio de captura, gana la geometría.

---

# Rediseño Carrion (segunda versión)

El usuario probó la primera versión en el celular: **el movimiento se siente
mal**, no puede moverlo con fluidez. Identificó el juego de referencia:
es **CARRION**.

## Por qué falló la primera versión

Construí un **gancho tipo Spider-Man**: un tentáculo, botón para lanzarlo,
anclar a un punto, columpiarse, soltar. **Carrion es lo contrario.**

En Carrion la criatura es una masa blanda que **fluye**. Hay muchos tentáculos
fuera a la vez, se agarran solos de las superficies cercanas y **tiran del
cuerpo** de forma continua hacia donde apunta el jugador. No existe el ciclo
"lanzar / anclar / columpiar / soltar". El movimiento nunca se detiene a apuntar.

Es un error de arquitectura, no de ajuste de números.

## Decisiones del usuario (fijas)

1. **Arrastrar el dedo + botón de ataque.** La criatura fluye hacia el dedo;
   los tentáculos se agarran solos. Un botón aparte para agarrar y matar.
2. **Vertical y horizontal**, cambiando en vivo al girar. Solo este juego;
   los otros tres quedan fijos en vertical.
3. **Arte fiel a Carrion**: masa de carne roja, muchos tentáculos en abanico,
   laboratorio oscuro e industrial con tuberías, luces rojas de emergencia,
   sangre por todas partes.

## Bugs de rotación encontrados y corregidos

- **`symbiote.js` declaraba `const VW = 540, VH = 1200`**, tapando los bindings
  vivos del motor. Al girar, el HUD y los botones se quedaban colocados para
  vertical. Ahora se importan vivos de `core.js`.
- **`applyOrientation` no avisaba al juego** cuando la resolución ya coincidía,
  así que al armar la rotación nunca recolocaba nada. Ahora avisa siempre.
- **El aviso llegaba antes de `init()`**, cuando el juego todavía no tenía
  controles que recolocar. Ahora se dispara también después de inicializar.

## Pendiente para el rediseño

**En horizontal el nivel no llena la pantalla**: el mapa ocupa el 68% izquierdo
y el resto queda negro, porque el nivel no es lo bastante ancho y la cámara se
queda sin mundo. Los niveles deben generarse con proporción suficiente para
ambas orientaciones, o la cámara debe encuadrar de otra forma al girar.

---

# Tercera version: la locomocion se veia y se sentia mal

El usuario probo la segunda version y mando captura. Diagnostico sobre la
imagen: tentaculos como palos rectos de arana, criatura del tamano de un punto,
y respuesta al dedo sin control fino. Marco los tres problemas a la vez
(se ve mal, responde mal, se atasca).

## La pregunta de fondo: motor grafico

El usuario pregunto si un motor (Unity, Godot) o una libreria haria mejores
juegos. **No para este problema**: lo que se veia mal era diseno de locomocion,
no capacidad grafica; el mismo motor dibujaria los mismos tentaculos feos.
Carrion mismo esta hecho en GameMaker. Ademas cambiar de motor costaria el APK
de 4 MB sin permisos (Unity: ~80 MB) y toda la investigacion ya medida.

## Bug de fondo: el blob ignoraba su radio

`blobUpdate()` pisaba `b.base = 12 + grow*10` en cada frame, asi que el
argumento de `makeBlob(r)` **no tenia ningun efecto**. Por eso la criatura salia
siempre diminuta. Ahora se guarda `r0` y `base = r0 + grow*10`.

## Tres radios, no uno (medido)

Subir el radio de colision para que la criatura se viera grande la dejaba
encajonada. Simulando 24 niveles reales, navegando por `routeWaypoint()`:

| BODY_R | llegan |
|---|---|
| 12 | **24/24** |
| 14 | 2/8 |
| 16 | 2/8 |
| 22 | 2/8 |

El corte es brusco porque `blocked()` sondea a `r-2`: a r=14 exige un hueco de
24px = 1 tile exacto y los pasillos de 1 tile se vuelven intransitables.

```
BODY_R  = 12    colision contra el mundo (el maximo que pasa 24/24)
HIT_R   = 19    impacto de balas y enemigos
BODY_VR = 26    tamano visual de la masa
```

Es la solucion de Carrion: masa grande pero blanda, que se aplasta al pasar.

## Silueta: por que salian rectos

Dos causas, ambas de fisica y no de dibujo:

1. **Nodos demasiado separados.** REACH=288 con SEG=8 daba 41px entre nodos:
   la Catmull-Rom no tiene de donde curvar. Ahora REACH=210 con SEG=12 → 19px.
2. **Cuerda tensa por construccion.** El largo en reposo era exactamente la
   distancia al ancla partida por los segmentos, o sea una recta. Ahora lleva
   12% de holgura, mas una ondulacion senoidal perpendicular con fase propia
   por tentaculo y amplitud maxima en el medio.

Tambien NT 12 → 9 (con 12 se apilaban en el mismo punto) y RING 16 → 24.

## Respuesta al dedo

Antes solo se pasaba la direccion normalizada y **se tiraba la distancia**: la
criatura empujaba con fuerza maxima tanto con el dedo a 20px como a 400. Ahora
`step()` recibe `aimDist` y la fuerza se modula con smoothstep entre
`DEAD_R=14` (se posa) y `FULL_R=190` (empuje pleno).

## Atascos

El deslizamiento cortaba el eje a cero, lo que mataba **toda** la componente:
empujar en diagonal contra una pared vertical borraba tambien el avance
vertical. Ahora se estima la normal del muro y se proyecta (`v - n(v·n)`), que
conserva la componente paralela. HAUL 2600 → 3400 (medido: el que minimiza el
atasco, 0.62s).

## Resultado medido

```
24/24 niveles llegan | peor atasco 0.62s | 0.3% frames sin agarre | 0.017 ms/frame
```

(El original medido con el mismo arnes: 7-8/8.)

## Nota sobre el arnes de medicion

Navegar en **linea recta** a `L.exitX/exitY` atraviesa paredes y da 1/8 incluso
con codigo bueno. Hay que navegar con `W.routeWaypoint()` (la ruta BFS real).
Esa trampa hizo parecer que la locomocion estaba rota cuando el roto era el test.

## build-apk.ps1: tres bugs corregidos

1. `java -version` escribe en stderr; con `2>&1` PowerShell 5.1 lo vuelve un
   `NativeCommandError` y disparaba el catch: decia "no se encuentra java"
   teniendo Java instalado.
2. El script **rechazaba Java 21**, que es justo el que Capacitor exige. Ahora
   busca activamente un JDK 21 y lo antepone al PATH (esta maquina tiene el 17
   primero en el PATH).
3. El Android SDK esta en `C:\Android\Sdk`, no en la ruta por defecto y sin
   variables de entorno. Ahora se prueban varias ubicaciones.
