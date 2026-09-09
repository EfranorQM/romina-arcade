# FURIA — moto de montaña

El quinto juego del arcade y **el único que no es pixel art**. La usuaria pidió
un juego de conducir moto esquivando obstáculos, con "mejores gráficos y
animaciones", explícitamente no estilo pixel.

## Decisiones de la usuaria (fijas)

1. **Vista de costado, scroll lateral.** Se descartaron la vista desde atrás
   hacia el horizonte y la cenital.
2. **Niveles con meta**, no infinito. Cada nivel completado suma y avanza.

## Cómo se consiguen "mejores gráficos" sin imágenes

El look pixel de los otros cuatro juegos no viene del arte sino de dos ajustes
del motor: resolución 270x600 y `imageSmoothingEnabled = false`. FURIA cambia
ambos vía un campo nuevo de `meta`:

```
vw: 540, vh: 1200, smooth: true
```

`setSmooth()` en `core.js` guarda el modo y `setVirtual()` lo reaplica, porque
asignar `canvas.width` resetea el contexto 2D entero. `main.js` lo llama
**antes** de `setVirtual`.

Con eso, nada se hornea: el terreno es una polilínea, la moto son paths con
degradados, la rueda gira de verdad y la suspensión se comprime. 398 llamadas
de dibujo por frame, medido.

## Física: cuatro bugs que solo aparecieron midiendo

Todo se validó simulando 8 niveles reales antes de compilar nada.

**1. `onGround` nunca era verdadero.** Se medía por penetración del neumático
(`pen > 0`), pero con la suspensión funcionando la rueda flota justo encima y
nunca se hunde. Resultado: caída libre eterna, sin tracción (el motor solo
empuja en el suelo), velocidad 0, 0/8 pistas completadas. Ahora se mide por
**compresión de la suspensión** (`compress > 2px`).

**2. La suspensión explotaba.** Saltos de hasta 1.2 millones de px. Dos causas:
el amortiguador usaba una derivada numérica de la penetración (dividir por `dt`
amplifica el ruido hasta que el "freno" pasa a inyectar energía), y el resorte
lineal sin tope se vuelve inestable con Euler a 60fps en un aterrizaje fuerte.
Ahora el amortiguador se opone a `B.vy` real, y la fuerza se satura en
`GRAV * 2.6`.

**3. El terreno tenía paredes de 60°.** Los tres senos más el paseo aleatorio
se sumaban sin límite. En el nivel 8 la moto volcaba a los 2 segundos contra
una. Ahora se recorta la pendiente entre muestras vecinas a ~35°, en dos
pasadas (ida y vuelta) para no dejar picos agudos.

**4. La moto salía del salto dando volteretas.** En el suelo `av` se acumulaba
sin tope (el acelerador resta cada frame) hasta -1.3 rad/s, y el salto sumaba
otros -2.2: despegaba a -3.5 rad/s. Ahora hay tope angular (2.6 en suelo, 6.0
en aire) y el salto **asigna** en vez de sumar: `av = min(av, 0) - 1.1`.

## Diseño: tres correcciones de jugabilidad

**Las rocas no se podían esquivar.** Solo inclinándose la moto alcanza 71-92px
y la roca mediana exige 58px de despeje: un margen de 1px, dependiente de que
hubiera un bache justo antes. Se añadió **salto explícito** (`bikeJump`).

**Los pozos eran intragables.** Con `JUMP_V=620` el vuelo duraba 0.17s y cruzaba
92px, contra pozos de hasta 130px. Ahora `JUMP_V=980` (con `GRAV=3400` hace
falta bastante impulso) y los pozos van de 46 a 90px. Cruce medido: 189-380px.

**El vuelco era instantáneo a 66°.** La moto moría en casi todos los aterrizajes
de salto grande, porque al tocar el suelo el chasis rebota un instante fuera de
rango antes de que el resorte lo acomode. Ahora `wipeoutUpdate()` acumula tiempo
tumbada (0.35s a más de 77°) y lo descuenta al enderezarse: un roce no mata.

**La moto no se autoestabilizaba.** Sin tocar nada salía del salto a -25°, así
que la jugadora corregía constantemente algo que debería ser el reposo. Ahora,
**solo cuando no se toca ningún control**, el chasis busca la horizontal solo.
Al tocar, el control manda y se puede girar libre: la ayuda desaparece justo
cuando estorbaría. Medido: sin tocar aterriza a -9°.

## Bug de juego: la moto se quedaba parada al cambiar de nivel

`startLevel()` reseteaba los controles a `false`, pero el dedo de la jugadora
sigue apoyado al cruzar la meta y nunca llega otro evento `down`. La moto
quedaba parada en la línea de salida para siempre (medido: 580 segundos sin
moverse). Ahora el estado de los dedos vive **por encima** del nivel.

## Números finales medidos

```
8/8 niveles se completan     choques 1→3 segun dificultad
saltos 95-167px              pendiente maxima 36 grados
reaccion 0.36-0.66s          fisica 0.0003 ms/frame
dibujo ~398 llamadas/frame   partida completa ~3 min
```

## Trampa del arnés de medición

Un piloto automático que "endereza en el aire" con una heurística simple juega
**peor** que uno que no hace nada, ahora que existe la autoestabilización. Al
medir dificultad hay que usar el piloto tonto (acelerar + saltar) como
referencia: si ese completa el nivel 1, la curva está bien.

## Nota sobre el audio

`playMusic` solo entiende `tri`, `pulse` y `noise`. La onda `saw` existe solo
para efectos puntuales (`sfx`): ponerla en una canción la degrada a cuadrada
**sin ningún aviso**.
