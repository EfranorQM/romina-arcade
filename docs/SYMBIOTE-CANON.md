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
