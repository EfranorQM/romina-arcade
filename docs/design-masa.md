# LA MASA

> Romina, con espada, contra una masa de carne que empieza siendo un charco con un ojo y en cada muerte vuelve con un órgano nuevo que contrarresta lo que ELLA hace. Siete mudas; matar la séptima es ganar.

**Loop:** La masa acecha, avisa (480 ms, carril amarillo) y embiste. Romina esquiva y corta. Cada tajo abolla la carne 5–8 px y quita un punto de una barra que empieza en 12. Al morir, la masa **muda** (2,6 s): convulsiona a cámara lenta, alrededor se repite en silueta blanca la última pelea de ella ("te está estudiando", y es literal: en ese instante se decide qué le crece), le brotan los órganos nuevos, y un letrero lo dice: `APRENDIO / TAJO POR ABAJO`. Vuelve con un 8 % más de vida, un ojo más, y un órgano que apunta a su hábito. Ella recupera un corazón por muda. La séptima masa lleva una HOJA que pega como ella (su combo, a su tempo). Matarla es la victoria; morir muestra TU MONSTRUO con los hábitos que le aprendió, en palabras.

**Duración:** medida en `tools/prueba-masa.mjs` con pilotos físicos, 100 partidas por piloto: la jugadora buena (LISTA) gana 63 de 100, en 4,5 min de reloj; la de manías muere en la ronda 2 (45 s + 25 s); la que machaca el botón llega a la ronda 3–4 (56 s). Rondas de 27 a 49 s.

**Derrota:** cinco corazones, +1 por muda (tope 5). Nada hiere sin un aviso de ≥ 0,35 s que se ve.

## Por qué no es "una IA que se inventa su forma"

El panel de diseño (cuatro diseños independientes, un escéptico por diseño, tres jueces; septiembre 2026) descartó la lectura literal — un genoma que evoluciona en un torneo simulado entre peleas contra un "fantasma" de la jugadora — por tres cosas medidas: con ~30 espadazos y 5 esquivas por pelea el retrato de la jugadora es ruido (el cuerpo que gana el torneo gana por suerte); el hill-climb converge en 2–3 generaciones a "cuatro brazos largos con púa"; y cuesta 1–3 s de CPU en el teléfono. Y sobre todo: lo que se siente como "me está aprendiendo" en tres muertes es la **atribución** — una causa de ella, visible, y un efecto de la masa, visible. La evolución produce cambios que ella no puede atribuirse.

Lo que hacen los juegos de pelea de verdad (Killer Instinct, los ghosts de Tekken, la venganza de Metal Gear V, Némesis) son **contadores → contramedida visible**, y eso es esto. De la evolución se robaron dos cosas: la ceremonia del renacimiento, y dos genes continuos por órgano (largo y rigidez) que mutan un poco entre mudas y conservan lo que le funcionó a ELLA — una generación por muerte, con la aptitud medida en la pelea real.

**Honestidad:** la masa no inventa una anatomía (nunca le saldrá una cabeza). Decide dentro de un vocabulario de cinco órganos que pone el diseñador. Lo emergente: QUÉ órganos, en QUÉ sector, en qué ORDEN, de qué TAMAÑO, y cuáles se caen. Dos jugadoras producen dos monstruos; un piloto al azar produce casi nada (medido: al VARIADO le sale placa en 17 de 100 partidas, y con pocas muestras el letrero dice CRECIO, nunca inventa un hábito).

## El cuerpo (`masa-cuerpo.js`, sin DOM)

Tres capas, cada una con la física que le corresponde:

1. **Núcleo cinemático**, con la máquina del charger de NEON FIST: RUMIA (guarda ~55 px, es cuando ella pega; 1,6 s en la ronda 1, −0,06 s por ronda, mínimo 0,8) → ACECHA (39 px/s) → AVISO 0,48 s → EMBISTE 225 px/s en recta 0,45 s → RECUPERA 0,35 s, o ATURDIDA 0,9 s si choca con la pared (daño doble). No es un punto Verlet: probado así, cada tajo la desplazaba en vez de abollarla.
2. **Piel:** 12 muelles radiales (los de `makeBlob` de SYMBIOTE) con radio de reposo POR SECTOR, fijos al mundo por construcción. Radio base 22 px (+2 por crecimiento genérico, tope +8). Un tajo resta 110 px/s de velocidad radial al sector y 60 a sus vecinos: se hunde 5–8 px y rebota en ~0,5 s. Un anillo Verlet con radios rígidos, la primera idea, no se abollaba (0,0 px) y giraba 78° tras 30 tajos del mismo lado: la placa se iba de sector.
3. **Órganos:** cadenas Verlet de 4–6 puntos ancladas al borde de la piel (LÁTIGO 6×10 px, rigidez 0,22; GARRA 4×8, 0,9; HOJA 6×9, 0,85), 8 iteraciones. Crecen por rampa en 0,6 s. Golpean con **la punta en rieles** (smoothstep, 0,10–0,18 s) y la sueltan con la velocidad heredada: una cuerda blanda no se puede empujar, se pliega. El tirón de pose se limita a un tercio del tramo por frame (sin el tope, la hoja volvía de un latigazo con 17 % de error de restricción). Tres tajos cercenan una cadena y abren una HERIDA: 3 s con daño doble por ese sector.
   El **LÁTIGO ondula en reposo**: seno perpendicular con envolvente (amplitud 34 px/s, 4,6 rad/s, fase propia) más un 10 % de holgura en el largo de reposo. Sin eso el tirón de pose lo dejaba recto — medido: 0,8 px de curva sobre 50 de cuerda, un 2 %; con la onda, 12,2 px, un 26 %. Es el mismo arreglo que ya llevaban los tentáculos de SYMBIOTE, y por la misma razón: un látigo tieso lee como un palo pegado, no como carne. La garra y la hoja siguen rígidas a propósito (0 % de curva).

Coste: el cuerpo entero con 4 cadenas, 1,2–2 µs por paso en Node; dibujo 0,11 ms de media y 0,6 ms de pico en Chrome sin GPU.

**Reglas que no se negocian:**
- Avisos: embestida 0,48 s, látigo 0,40, garra 0,40, hoja 0,35. Lo aprendido cambia CUÁNDO y HACIA DÓNDE, nunca cuánto avisa.
- Nunca más de tres avisos seguidos (el dash enfría 0,62 s; el cuarto no se puede esquivar, medido).
- La parada ya es el castigo: tras un CLANG de parada no se encadena un ataque (rumia ≥ 0,6 s).
- Placas: tope 6 sectores (180°); siempre queda por dónde entrar, y no brilla: que lo encuentre.
- Mientras muda se desliza al centro de la arena: cada ronda arranca en el medio.

## La mente (`masa-mente.js`, sin DOM, nada por frame)

Contadores: tajos por sector del mundo (12), esquivas por dirección **relativa a la masa** (8: hacia ella, a su derecha, atrás, a su izquierda), segundos por banda de distancia medida desde el BORDE de la piel (pegada < 13 px, lejos > 48; cualquiera que use espada está a ~20, eso es lo normal), bigramas de actos (TAJO/DASH → siguiente), trigramas (para la HOJA), y el tempo hasta el tajo **según venga de tajo o de dash** (tras un dash tarda el doble porque vuelve caminando; con un solo reloj la parada se abría antes de tiempo).

En cada muda, hasta dos lecciones, ordenadas por legibilidad (placa > patas/garra > látigo > parada) y luego por fuerza:

| Hábito | Umbral | Órgano | Letrero |
|---|---|---|---|
| Tajos concentrados en 90° (ventana de 3 sectores) | ≥ 55 % (50 % en la primera muda), ≥ 6 tajos | PLACA en ese sector (+1 nivel, hasta 3; luego se extiende al vecino) | `TAJO POR ABAJO` |
| Esquiva concentrada (un cajón + medio vecino) | ≥ 55 %, ≥ 4 esquivas | LÁTIGO, pre-apuntado a donde aterriza su dash habitual | `ESQUIVAS A TU DER` |
| Se queda lejos ≥ 55 % del tiempo | | PATAS (embestida +16 %/nivel, rumia −0,15 s) | `TE QUEDAS LEJOS` |
| Pegada ≥ 55 % | | GARRA (alcance corto, entra a < 54 px) | `TE PEGAS A MI` |
| Un contexto predice el acto siguiente ≥ 82 % (≥ 5 muestras) | | PARADA | `REPITES TAJO TAJO` |

El letrero dice el hábito **solo con ≥ 8 muestras**; si no, `CRECIO`. Si nada domina: crece 2 px y lo dice (`NO ME PILLO NADA`). Ronda 7 siempre: HOJA (`PEGA COMO TU`), con tantos barridos como tajos tiene su trigrama favorito (tope 2) y una embestida detrás si lleva dash; sale en el 35 % de los ataques, no en todos (con 45 % la ronda 7 se llevaba 2,3 de los 5 corazones; si saliera en todos, duraba 69 s).

**Olvido:** la placa que no recibió tajos en toda la ronda pierde un nivel (`OLVIDO UNA PLACA`); la cadena sin utilidad dos rondas se reabsorbe; la que conectó crece un 6 %. Todos los contadores se multiplican por 0,85 por muda.

**Parada:** se arma cuando el bigrama predice tajo con p ≥ 0,80, a tempo, con ella a < radio + 36. Petrifica 90° durante 0,35 s: el tajo rebota (CLANG, ella descolocada 0,35 s). Si el tajo no llega, la masa queda EXPUESTA 0,45 s con daño doble (`PATRON ROTO`). Lo mismo cuando un látigo apuntado por hábito falla.

## Medido (`tools/prueba-masa.mjs`, 33 umbrales, `exit 1`)

Cuatro pilotos físicos con la geometría real (78 px/s, espada a 19 + 13 px, dash 51 px, ciclo 0,30 s, latencia 0,22 ± 0,05 s a los avisos, y no siempre reaccionan; el que falla la reacción tampoco se aparta de la embestida). **100 partidas por piloto:**

- **MANIAS** (pega por abajo σ 20°, esquiva a su derecha, TAJO TAJO DASH): la muda 1 le aprende algo con nombre en 95/100; le aprende la esquiva en 90/100; en la ronda 2 conecta el 73 % contra el 90 % del VARIADO. Muere en la ronda 2 sin adaptarse: es el piloto, no la masa.
- **VARIADO:** placa en 17/100; casi ninguna parada (13 frente a 622 al machacador).
- **LISTA** (entra por el sector blando, esquiva fuera de la línea amarilla, no machaca): gana 63/100 en 4,5 min de reloj, 0 % de CLANG, rompe el patrón 18 veces por partida.
- **MACHACA:** 397 de 622 paradas aciertan; aguanta 56 s; nunca gana.
- Física: sin NaN en 400 partidas; error de restricción en reposo ≤ 10 % (< 1 px en un tramo de 9); ≤ 0,002 ms/paso.

Decisiones que salieron de medir: la espada a 0,30 s (con 0,26 el machacador mataba la ronda 1 en 9 s); vida +8 % por ronda (con +22 % la ronda 7 se iba a 64 s); rumia −0,06 s por ronda (con −0,12 la jugadora no tenía cuándo pegar); la HOJA con dos barridos y en el 35 % de los ataques, no en todos (con 45 % la ronda 7 se llevaba 2,3 de los 5 corazones y la jugadora buena bajaba a 54 de 100); la parada sin encadenar; el tempo por contexto.

## Lo que corrigió la revisión adversaria (15 de septiembre de 2026)

Cuatro revisores con lentes distintas y dos verificadores por hallazgo, todos obligados a reproducir lo que afirmaban. 35 hallazgos, 31 confirmados. Los que cambiaban el juego:

- **El PATRON ROTO del látigo no existía.** `elegirAtaque` marcaba `aim = 2` y `atacarCadena`, llamada justo después, lo pisaba con `aim = 1`: la condición era inalcanzable y el mecanismo que promete este documento estaba muerto. Medido: 327 látigos apuntados por hábito, 0 con la marca. Ahora la marca va después de arrancar.
- **El segundo barrido de la HOJA no salía nunca:** la recuperación (0,3 s) terminaba antes del umbral de encadenado, el núcleo la daba por acabada y salía de ORGANO. Ahora la hoja espera en C_RECUPERA mientras le queden barridos.
- **La masa encadenaba un ataque sobre su propia parada:** se armaba la petrificación y elegía embestida encima, así que el CLANG la encontraba avisando. Ahora la parada la deja quieta (`RUMIA`, cd ≥ 0,40 s) y no elige ataque mientras `frozen`.
- **La placa que crecía en una muda se caía en esa misma muda** (el olvido corría después de las lecciones y no distinguía lo recién crecido). Igual con las cadenas: nacían y se reabsorbían por "no haber rendido" sin haber peleado. Ahora hay foto previa de las placas y sello `nacida`.
- **El anillo amarillo del aviso no marcaba dónde caía el golpe:** el objetivo se recortaba al disparar, no al avisar, así que prometía un sitio al que el látigo no llegaba. Ahora se recorta a la arena y al alcance al arrancar el aviso.
- **Empate de ventanas:** pegando justo por un lado, las tres ventanas que lo contienen empataban y la placa salía un sector corrida. Desempata el centro más cargado.
- **Lo que hacía durante la ceremonia de la muda contaba como hábito** (tajos al aire con la masa muerta). Ahora no se observa fuera de la pelea, pero el reloj de la mente sigue corriendo, porque si se congela 2,6 s la parada de la ronda siguiente sale con el tempo corrido.
- **`ESQUIVAS A TU IZQUIERDA` no cabía:** 23 letras son 274 px en un lienzo de 270. Vocabulario acortado a 22 letras como máximo (`A TU IZQ`, `ARRIBA-DER`), y el letrero se escribe a 48 letras/s para que la segunda línea termine antes de que acabe la muda.
- **La pantalla final decía `NO TE APRENDIO NADA` encima de un monstruo con placas y látigo** (los hábitos sin nombre no entran en el resumen). Ahora, si no le puso nombre a ninguno, dice lo que lleva puesto: `LE CRECIO: UN LATIGO`.
- **El `up` sintético de la pausa pulsaba OTRA VEZ / AL MENU** al salir de pausa sobre la pantalla final. Se ignora mirando `pointers`, como hace el AHORCADO.
- Más: el empujón de la carne metía a Romina en la pared; cortar una cadena mientras avisaba dejaba la línea amarilla huérfana; morir con la parada armada congelaba la masa en gris en la pantalla final; los órganos a 2× cruzaban el título; la séptima pastilla de ronda caía dentro del botón de pausa; la masa no llegaba al centro durante la muda desde una esquina.

Y del arnés, que era el que más mentía:

- **El `TODO OK` era una propiedad del primo 7919.** Con otras 20 semillas fallaba 8 de cada 12 veces. Ahora son **100 partidas por piloto** (400 en total) y los umbrales tienen margen real.
- **Los pilotos se apartaban de la embestida con latencia cero**, incluido el que había fallado la reacción al aviso: escondía daño real. Ahora solo se aparta quien reaccionó.
- **"LISTA gana en ≤ 4,5 min" promediaba también las partidas perdidas**, que son más cortas. Ahora se mide sobre las ganadas y en tiempo de reloj (`pasos · DT`), porque la cámara lenta de la muda acorta el tiempo simulado pero no el que ella espera sentada.
- El filtro de "solo rondas terminadas" adivinaba mal cuál era la ronda a medias; ahora se marca explícitamente al morir.

## Lo que se ve (`masa-arte.js`)

Pixel art a 270x600 como NEON FIST, misma arena y controles. Carne en tres capas rasterizadas por columnas (cero trazos); placas como costras de hueso en el borde (una hilera por nivel); parada como piedra gris; herida como agujero con el núcleo latiendo. Un ojo por ronda, todos con la pupila hacia ella. La carne gira 4° hacia el naranja por muda (con 8° la ronda 7 era una papa dorada y las placas desaparecían). Órganos DEBAJO del cuerpo (encima, su contorno partía la carne con una raya negra). Avisos: carril de puntos para la embestida; línea de puntos y anillo donde va a caer para las cadenas; la punta parpadea amarilla. La caballera es la Romina de NEON FIST con hombrera; la espada se dibuja en px de pantalla (fina) y el tajo es un arco blanco-cyan con estela.

```
node tools/prueba-masa.mjs                         # los 33 umbrales
node tools/prueba-masa.mjs detalle                 # cada partida, ronda por ronda
node tools/ver.js tools/ver-masa.html masa.png 1540 1900   # la hoja de contactos
VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[7],{seed:7});espera700;archivo:tools/prueba-masa-app.js;hasta90000:__arcade.sm.cur.P.estado==='muda';espera1200;disparo"
```

## Lo que queda por probar en el teléfono

La pregunta única, la de la memoria del proyecto: al chocar contra la placa por segunda vez, ¿le sale rodearla sin pensarlo? Y si el látigo apuntado a su esquiva se siente tramposo o se siente leído. Los pilotos no lo pueden contestar.
