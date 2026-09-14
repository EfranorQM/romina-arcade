# AHORCADO

> Romina adivina palabras letra a letra mientras un muñequito colgado de seis globos sobre un estanque de noche va perdiendo altura, compostura y cara — y una rana espera abajo con la boca abierta.

**Loop:** Cae una palabra en casillas con su categoría en cian encima. Romina apoya el pulgar en una tecla (la tecla se hunde, el muñeco la mira con cara EXPECTANTE), la suelta, y en el mismo frame pasa una de tres cosas: la letra está (las casillas se voltean, ALIVIO, +5 por casilla), no está (un globo revienta, el muñeco baja 40 px, se bambolea, SUSTO, y su cara base empeora un escalón) o ya la usó (la tecla tiembla, él niega con la cabeza). Con la palabra completa: TRIUNFO, puntos por palabra, mensaje a ella, suben 3 globos nuevos y cae la siguiente. Con el sexto globo reventado: chapuzón, la rana se le sienta en la barriga, se revela la palabra y termina la partida. Entre letra y letra el muñeco es un juguete: se lo columpia, se lo empuja, se le hacen cosquillas, y nada de eso cuenta.

**Duración de partida (SOLA):** medido con tools/prueba-palabras.mjs (modelo de racha con perfiles de fallos): una jugadora torpe (media 3.4 fallos por palabra) dura 3 palabras de mediana (2-3 min); casual (media 2.5) 8 palabras (5-7 min); buena (media 1.6) 46 palabras sobre dificultad constante, que el escalón de dificultad desde la palabra 6 recorta a 10-15. Ganar una palabra son 2.2 s de animación (saltable desde 0.8 s); perder son 4.3 s (saltable desde 1.5 s) y un toque en la pantalla de fin del motor.

**Derrota:** el sexto fallo de UNA palabra. No hay vidas aparte: los globos que quedan al ganar arrastran a la palabra siguiente (+3, tope 6), así que la altura del muñeco ES el estado de la partida, sin ningún contador. La partida termina en el primer chapuzón, con una pantalla de fin PROPIA (no la genérica del motor, que Anderson encontró "muy simple y aburrida"): el muñeco sigue flotando con la rana en la barriga y la palabra revelada, y sobre el panel van el puntaje grande, RECORD NUEVO! con confeti cayendo del cielo (o MEJOR n), cuántas palabras adivinó, una frase cariñosa (si hay récord) o ligera (si no), y dos botones: OTRA VEZ (entra un muñeco nuevo, sin pasar por el menú de modos) y AL MENU. El récord se guarda con `Save.submit`, igual que haría `ctx.gameOver`.

## Concepto

Noche de luna llena sobre un estanque. En medio del cielo flota el Colgado: un muñequito redondo de suéter rosa, agarrado con el puño derecho al ramo de seis globos que lo sostiene. Abajo, en el agua, una rana sentada en un nenúfar lo mira con la boca abierta según lo cerca que tenga los pies. Cada letra fallada revienta un globo: el ramo pierde empuje, el muñeco se hunde 40 px con un rebote de 7 px, se bambolea, y la cara cambia — de TRANQUI a ATENTO, a NERVIOSO (sudor, se agarra con las dos manos, encoge las rodillas), a PÁNICO (ojos como platos, tiembla, mira al agua y a ella alternando). Con un globo, los pies rozan el agua en cada vaivén y la rana se relame. Al reventar el último, cae: chapuzón, burbujas, sale a flote boca arriba con un mechón pegado a un ojo, y la rana salta a su barriga y la mira a ella como diciendo "¿en serio?". Está VIVO todo el rato: la sigue con la mirada, celebra cada acierto cerrando los ojos, se sobresalta con cada estallido, se aburre si ella tarda, y si lo toca reacciona.

**Por qué no es un ahorcado normal.** No hay horca, cadalso ni cuerpo que se dibuja pieza a pieza. Las mismas seis oportunidades del clásico se leen a la vez en ALTURA (está más cerca del agua), en FÍSICA (con menos globos el ramo sostiene peor: el balanceo en reposo pasa de 54 px a 63 medidos) y en CARA. El nombre se conserva porque así lo llama todo el mundo y ella sabe qué es antes de abrirlo; el chiste es que se llama AHORCADO y el tipo está colgado de globos. La derrota es un chapuzón cómico. En el arcade es el único juego de pensar, el único con línea de tinta gruesa y personaje de caricatura, y el único que se toca por curiosidad además de por jugar.

## El muñeco

Todo en px del lienzo 540x1200 (`meta.smooth:true`, 2 px físicos por virtual en el Note 10).

### Plan corporal (17 puntos Verlet)

`Float32Array` x, y, ox, oy, w (inverso de masa). Índices fijos. Pose de reposo con 6 globos, nudo en (270,236); la columna "rel" es el desplazamiento respecto al nudo, que es lo que usa `makeMono()` y la guarda de recolocación.

| i | punto | rel | abs (6 globos) | w |
|---|---|---|---|---|
| 0 | NUDO = puño derecho sobre las cuerdas | (0,0) | (270,236) | 0 en la ronda (pivote con muelle propio); 1 en la caída |
| 1 | hombroR | (+6,+50) | (276,286) | 1 |
| 2 | hombroL | (-22,+52) | (248,288) | 1 |
| 3 | caderaR | (+4,+114) | (274,350) | 1 |
| 4 | caderaL | (-20,+114) | (250,350) | 1 |
| 5 | cabeza (centro, r=34) | (-30,+22) | (240,258) | 0.8 |
| 6 | manoL | (-26,+108) | (244,344) | 1 |
| 7 | rodillaR | (+6,+156) | (276,392) | 1 |
| 8 | pieR | (+8,+198) | (278,434) | 1 |
| 9 | rodillaL | (-22,+156) | (248,392) | 1 |
| 10 | pieL | (-24,+198) | (246,434) | 1 |
| 11..16 | globo b=0..5 | x = (b-2.5)*22, y = -cuerda[b]+10 | | 2.5 (ligeros) |

La cabeza va a la IZQUIERDA del brazo alzado (el brazo nudo→hombroR pasa por x≈272 a la altura de la cabeza, cuyo borde derecho está en 274: se dibuja el brazo antes que la cabeza y queda "detrás de la oreja"). Del puño a la suela: 198 + 8 de radio de pie = 206 px (412 físicos, 25 mm); cabeza 68 px de diámetro (8.3 mm).

**Restricciones de distancia** (largo = distancia en la pose, redondeado; `makeMono()` las calcula de la pose para que nunca haya inconsistencia):

- Torso rígido, 6: hombroR-hombroL 28.1 · caderaR-caderaL 24 · hombroR-caderaR 64 · hombroL-caderaL 62 · diagonales hombroR-caderaL 69.1 y hombroL-caderaR 67.2.
- Cuello triangulado, 2: cabeza-hombroL 31.0 · cabeza-hombroR 45.6 (asimétrico: la cabeza queda a la izquierda; puede cabecear con el torso, no rodar).
- Brazo derecho, 1: nudo-hombroR 50.4 (sin codo: manguera de goma estirada).
- Brazo izquierdo, 1: hombroL-manoL 56.1 (cuelga libre).
- Piernas, 4: caderaR-rodillaR 42 · rodillaR-pieR 42 · caderaL-rodillaL 42 · rodillaL-pieL 42.
- Cuerdas, 6: nudo-globo b con largo 78, 84, 90, 96, 102, 88 (distintos para que apilen en ramo). Se saltan si `alive[b]=0`.
- Separación entre globos, 15 pares: mínimo 52 px, rigidez 0.5, solo actúa si están más cerca.

Total fijo: 14 + 6 + 15 = 35 restricciones; 8 iteraciones = 280 resoluciones por paso. **Restricciones de postura** (se activan con rampa de 120 px/s desde la distancia actual hasta el largo objetivo, nunca de golpe: activarlas en seco daba un 139% de error de restricción en un frame; con rampa, 7.3% transitorio y 3.2% después):

- NERVIOSO/PÁNICO (2 o 1 globos): manoL-nudo 60 (se agarra con las dos manos) y dos de MÁXIMO caderaR-pieR ≤ 64, caderaL-pieL ≤ 64 (encoge las rodillas; solo tiran si están más lejos).
- A DOS escribiendo: manoL-cabeza 20 (se tapa los ojos).
- Todas se quitan (rampa inversa) al atar globos, al ganar la palabra o al destaparse.

### Física

Constantes (medidas en tools/prueba-ahorcado.mjs; ese archivo es la fuente de verdad, y este párrafo su copia):

- Integración Verlet a paso fijo DT=1/60 dentro de `update()` (main.js ya da pasos fijos), sin subpasos: `nx = x + (x-ox)*damp + a*DT²`. 8 iteraciones Gauss-Seidel con reparto por inverso de masa `wa/(wa+wb)`. Orden por iteración: cuerpo (14) → postura (0-3) → por cada globo vivo: cuerda, separaciones con los siguientes, techo → recopiar el nudo del pivote → suelo/techo del cuerpo.
- GRAV 1400 px/s² en el cuerpo (la escala de FURIA y SYMBIOTE). LIFT -700 px/s² en los globos. Viento solo sobre los globos: `ax = 140·sin(0.6t) + 90·sin(1.7t+1)` px/s² (fase inicial sembrada con `args.seed`).
- damp AIR 0.998 por paso en el aire (una velocidad decae al 89% por segundo), WATER 0.88 por paso bajo el agua.
- Agua en y=640. Bajo la superficie la gravedad se resta con un empuje PROPORCIONAL a la profundidad: `a = GRAV − B·min(1, (y−640)/24)`, B = 2300 en el cuerpo y 2900 en la cabeza. Es continuo en la superficie (un empuje fijo que se enciende al cruzar hacía que los puntos tiritaran en la línea del agua y el muñeco no se quedaba quieto nunca); el equilibrio queda 14.6 px bajo la superficie (cabeza 11.6), y como la cabeza mide r=34 asoma 22 px: boca arriba. Fondo del estanque: y ≤ 692 para todo punto. Reposo en el agua: punto que se mueve < 0.15 px/paso → `ox=x` (no tirita en la superficie).
- Techo de los globos: centro y ≥ 125 (borde superior 96; el área de toque de la pausa acaba en y=74: 22 px de aire). Techo del cuerpo: todo punto de cuerpo y ≥ 116 (cabeza r=34 → borde 82).
- Empuje de la cabeza 6000 (no 2900): con 2900 la cabeza flotaba 11.6 px bajo la superficie y la cara quedaba debajo del velo del agua; con 6000 queda a flor de agua (medido: y=648 con el agua en 640) y, flotando, la cara mira a cámara aunque el cuerpo esté tumbado, porque de perfil la expresión de empapado no se leía.

**El pivote.** El nudo no es un punto Verlet libre durante la ronda: es un muelle amortiguado 2D integrado aparte (semi-implícito) hacia el objetivo `(270, 236 + 40·globosReventados)`, y su posición se copia al punto 0 antes de cada iteración. Vertical: ω² = 15.4 s⁻² (periodo 1.6 s), ζ = 0.6. Horizontal: ω² = 2.5, ζ = 0.5, más dos realimentaciones que hacen que CEDA como un ramo y no como un clavo: `+0.6·(xCentroDeMasaCuerpo − xNudo) + 2.0·(xMedioGlobosVivos − xNudo)` (en s⁻²). Topes: x en [90,450], y en [176, 620] (176 = objetivo de reposo − 60: guarda de la pausa; 620 = agua − 20). El tope de y NO es ±60 alrededor del objetivo: con ese tope, atar tres globos (objetivo −120 de golpe) teletransportaba el nudo 60 px en un frame y daba 30% de error; con tope fijo, atar tres globos sube el nudo de 356 a 236 en 1.5 s con 3.2% de error.

Con el viento a 40/25 (lo que decía el concepto original) el balanceo de reposo era de 24 px: una lámpara. El barrido (`SWEEP=1 node tools/prueba-ahorcado.mjs`) da 47 px a 120/80, 54 a 140/90 y 60 a 160/100 con realimentación 2.0; con 4.0 se dispara a 90-115 y el ramo barre 240 px de ancho. Se elige 140/90 y 2.0.

**Medido (Node, 20 000 pasos, 0.007 ms por paso):**

| prueba | resultado |
|---|---|
| Entrada: objetivo del nudo de 150 a 236 | asentado en 1.6 s; globo más alto y=125.0 (borde 96): el techo lo retiene y el ramo entra apretado |
| Reposo 20 s con viento, 6 globos | balanceo de pies 54 px (x 260..313); globo más alto y=139; ramo x 174..377; cabeza nunca sube de 242; error máximo de restricción 1.3% |
| Reposo con 1 globo | balanceo 63 px; el pie más bajo llega a y=640: roza el agua |
| Empujón de 400 px/s en las piernas, sin viento | periodo 2.2 s (péndulo teórico de 198 px: 2.4); picos 120 / −63 / 84 / −40 / 60 / −14 px (asimétricos porque el pivote cede); baja de 4 px a los 15 s |
| Cada pop | el nudo baja 40.0 px, se pasa 7.3 por debajo y vuelve (el "sag"), asentado en 1.3 s |
| Pies en reposo por globos vivos | 6→434 · 5→474 · 4→513 · 3→555 · 2→592 · 1→635 (agua 640) |
| Caída (pop 6) | velocidad heredada del nudo 0.0 px/s; la cadera cruza el agua a 0.6 s; la cabeza llega a y=692 (52 bajo la superficie, el fondo); flota quieto a 2.6 s con cabeza en 656 y pies en 655; x del cuerpo en 213..323 (nunca cerca de los topes) |
| Arrastre del pie derecho a (420,500) | el pie se queda en (410,466): el brazo y el torso no dan más; el nudo cede hasta x=370; error 3.5% arrastrando, 1.2% medio segundo tras soltar; vuelve a casa en 6 s |
| Arrastre absurdo de la cabeza hacia la pausa (objetivo acotado a y ≥ 150) | la cabeza sube hasta y=169 (borde 135); el nudo topa en 176; globos en 125 |
| Atar 3 globos desde 3 | nudo de 356 a 236 en 1.5 s, error 3.2% |

**Cada error (pop):** se elige el globo vivo más alejado en x del nudo (el ramo queda equilibrado); `alive=0` (su cuerda y sus separaciones se saltan); el objetivo vertical baja 40; el nudo recibe +160 px/s hacia abajo (la pérdida de empuje) y todos los puntos del cuerpo +120 px/s hacia arriba en ese frame (el sobresalto: brazos y pelo suben). Al cuarto pop entran las restricciones de postura de NERVIOSO.

**Cada acierto:** no cambia la altura. Cabeza y manoL reciben 90 px/s hacia arriba (un respingo) y los globos un pulso de empuje +250 px/s² durante 150 ms (el ramo se estira). Al ganar la palabra entran globos nuevos: cada uno aparece en y=740 (detrás del panel, que es opaco desde 716) con la x de su hueco en el ramo, sube a 520 px/s con vaivén de ±14 px a 2 Hz, y cuando su distancia al nudo llega al largo de su cuerda − 4 px se ata: `alive=1, ox=x` y el objetivo del nudo sube 40. No se ata "a 20 px del nudo" como decía el concepto: la cuerda de 78+ px se resolvería en un frame y el globo saltaría 58 px.

**La caída:** al reventar el sexto, `fall()`: el muelle se apaga, el nudo pasa a w=1 con `ox=x, oy=y` (velocidad heredada medida: 0.0), las restricciones de postura se quitan. Cae con el puño todavía arriba y tres hilos sueltos dibujados 0.6 s; entra al agua a los 0.6 s y flota a los 2.6.

**El dedo:** al 'down' en la escena se resuelve contra el punto de cuerpo más cercano (radio 46; la cabeza 40 sobre su centro) o un globo (radio 34). ARRASTRAR = muelle sobre ese punto hacia el dedo con ω² = 400 s⁻², ζ = 0.9, y el pivote recibe el 5% de esa fuerza (el ramo entero se va un poco detrás del dedo). El objetivo del dedo se acota a x en [60,480], y en [150,620]. Al soltar conserva la velocidad (Verlet): se lo puede columpiar. TOCAR (down-up en < 180 ms y < 12 px) = impulso de 260 px/s en dirección contraria al dedo. FROTAR la barriga (movimiento sobre el cuadrilátero del torso ampliado 34 px, > 220 px/s durante ≥ 0.35 s) = cosquillas: impulsos alternos ±120 px/s en las caderas a 8 Hz mientras dure. Tocar un globo lo aplasta (escala x1.15/y0.85 120 ms, 'boing') y NUNCA lo revienta; arrastrar un globo arrastra el ramo. Durante la caída y el chapuzón el dedo no hace nada en la escena.

**Guardas:** `hypot < 1e-6 → 1e-6`; un punto fuera de [−200,740]x[−200,1400] fuera de la caída se recoloca a su rel de la pose respecto al nudo, con `ox=x`. Un `pointercancel` llega como 'up' (input.js) y suelta el agarre.

**En Node:** `ahorc-fisica.js` no importa nada del DOM ni de core.js (core.js toca `document` y `localStorage` al cargar: `clamp` se define local, como en sym-flow.js). Exporta `makeMono(kx, ky)`, `step(S, dt, env)`, `pop(S)`, `fall(S)`, `tie(S, b)`, `grab(S, i, x, y)`, `moveGrab`, `release`, `poke(S, i, dx, dy)`, `setPostura(S, modo)` y las constantes. tools/prueba-ahorcado.mjs lo importa por `file://` y corre las nueve pruebas de la tabla.

### Expresiones

La cara vive en 9 parámetros continuos que `update()` acerca a su objetivo a 14/s (llegan en ~70 ms; nunca saltan, salvo el cierre de ojos del SUSTO): apertura de ojos (0..1.25), tamaño de pupila (0.6..1.2), ángulo de ceja izq y der (rad), altura de cejas (px), curva de boca k (−7 fruncida .. +9 sonrisa), apertura de boca (0..1), mejillas (0..1) y **preocupación** w = globosReventados/6 (0..1). Un ESTADO BASE lo decide el número de globos vivos, la preocupación se le suma en continuo (cejas hacia adentro +0.25·w rad, boca −4·w, pupilas −0.2·w: ella lo ve ponerse triste entre escalón y escalón sin que nada salte), y encima se montan REACCIONES con temporizador que ganan mientras duran.

BASE por globos vivos:

- **TRANQUI (6-5):** ojos 1.0, pupilas 1.0 con brillo blanco de 2 px arriba a la izquierda (el brillo es lo que lo hace estar vivo); cejas planas y bajas; boca k=+4. Mira alrededor: cada 2-4 s elige al azar entre la rana, el globo más alto, de frente (a ella) y la palabra. Parpadea cada 3-5 s (120 ms, los dos ojos; doble parpadeo el 20%).
- **ATENTO (4-3):** cejas 4 px más altas, pupilas 0.9, boca k=0 abierta 0.3 (una 'o' pequeña). Mira la tecla que ella acaba de soltar 0.8 s.
- **NERVIOSO (2):** cejas inclinadas hacia adentro-arriba (izq +0.35 rad, der −0.35), ojos 1.05, pupilas 0.75, boca k=−3 dibujada como zigzag de 3 tramos (temblona), mejillas 0, gota de sudor cian 6x9 en la sien derecha que resbala 12 px en 1 s y reaparece cada 4 s. Cada 2 s baja la mirada al agua 0.6 s. Cuerpo: dos manos y rodillas encogidas (postura).
- **PÁNICO (1):** ojos 1.2, pupilas 0.6, cejas 8 px arriba y rectas, boca abierta 1.0 (rectángulo redondeado 18x13 con hueco oscuro); sin parpadeo; la cabeza tiembla ±1.5 px a 12 Hz; alterna mirada agua 0.7 s / ella 0.7 s. Suena SONGS.ahorcadoPanico.

REACCIONES (duración → qué se ve):

- **EXPECTANTE (desde el 'down' en una tecla hasta el 'up'):** ojos 1.15, pupilas 1.1, cejas +5, boca k=0 abierta 0.35, pupilas clavadas en la tecla. Es el chiste de cada letra: espera con esperanza. Si mantiene > 1.2 s, baja la ceja izquierda ('¿y?'); si desliza fuera y cancela, UFF 300 ms (mejillas 0.6, boca cerrada y estrecha).
- **ALIVIO (0.45 s, letra correcta):** ojos cerrados como dos arcos hacia arriba '^ ^', boca k=+9, mejillas 1.0.
- **SUSTO (0.6 s, globo reventado):** los ojos se aprietan a 0 en un frame y a los 100 ms abren a 1.25, pupilas 0.5, cejas 10 px arriba, boca 'O' 0.8; los primeros 100 ms el pelo va hacia arriba.
- **YA LA USASTE (0.5 s, letra repetida):** ceja izquierda +6, derecha plana, boca k=0, pupilas a ella; y NIEGA con la cabeza: impulsos ±90 px/s alternos en la cabeza a 10 Hz, 3 sacudidas en 300 ms.
- **EH (0.5 s, la tocó):** ojos 1.15, ceja del lado tocado arriba, boca 'o' 0.4; mira el punto tocado 0.2 s y luego el dedo.
- **COSQUILLAS (mientras frota + 0.6 s):** ojos apretados '> <', boca abierta 1.0 con k=+9, mejillas 1.0, tres rayitas a cada lado de la cabeza; SFX risa en bucle.
- **TRIUNFO (1.6 s, palabra ganada):** ojos '^ ^', boca abierta 0.9 con k=+9, mejillas 1.0.
- **EMPAPADO (desde que flota hasta el fin):** ojos como rayas planas (0.15), pupilas 1.0 a ella, boca k=0, mechón pegado sobre el ojo derecho, gotas que caen del pelo (2/s); a los 1.2 s levanta una ceja: 'ups'.
- **ABURRIDO (sin ningún toque, solo en TRANQUI/ATENTO; cualquier toque lo reinicia):** 6 s: párpados a 0.5 y pupilas a una esquina; 9 s: bostezo (boca abierta 1.0 estrecha, ojos cerrados 700 ms, SFX bostezo); 15 s: mira a cámara y levanta una ceja; 25 s: tararea tres notas (SFX tarareo) balanceando los pies (impulsos alternos 120 px/s en cada pie cada 250 ms, 6 veces). Después vuelve a contar desde 15 s.
- **NO MIRO (A DOS, escribiendo):** manoL sobre la cabeza (postura 20 px), ojos cerrados; cada 3 s la mano baja 12 px 400 ms y ese ojo mira al teclado: se asoma.

MIRADA: las pupilas se desplazan hasta 5 px hacia el objetivo (dirección normalizada desde el centro del ojo), suavizado a 10/s. Prioridad: dedo apoyado en cualquier parte (también sobre el teclado) > tecla recién soltada (0.8 s) > lo que diga el estado base. El marco de la cara gira con el cuerpo: arriba = normalize(0.6·arribaMundo + 0.4·(cabeza − medioHombros)).

Como Roma en SURVIVAL, TODO (parpadeo, parámetros, temporizadores, viento) avanza en `update()`, nunca en `draw()`.

### Animaciones

- **INICIO DE PALABRA:** las casillas caen desde y−40 con ease-out en 250 ms y 30 ms de escalón; el muñeco las mira caer 0.8 s y hace un 'ajá' (ceja 200 ms). En la primera palabra de la partida el ramo entra desde arriba: objetivo del nudo de 150 a 236, asentado en 1.6 s con dos vaivenes, con los globos retenidos por el techo de 125 hasta que el nudo baja.
- **LETRA CORRECTA:** ALIVIO; respingo de cabeza y manoL (90 px/s); pulso de empuje 150 ms; las casillas acertadas se voltean (escala x 1→0→1 en 200 ms, la letra aparece a mitad); un '+5' sube 30 px en 0.5 s DESDE CADA CASILLA revelada (no desde la línea de mensajes).
- **LETRA INCORRECTA:** el globo desaparece en un frame → 12 jirones triangulares de 6 px de su color, radiales 200-420 px/s, gravedad 600, giro, vida 0.45 s; un anillo blanco r 10→44, alfa 0.8→0, 180 ms; `cam.shake(3, 0.12)`; `vibrate(20)`; sobresalto 120 px/s arriba; el nudo se hunde 40 con 7 px de rebote; SUSTO 0.6 s y luego la base nueva. La cuerda liberada se dibuja 0.6 s encogiéndose hacia el puño. La tecla se hunde y se queda con un puntito del color del globo que costó.
- **LETRA REPETIDA:** la tecla tiembla ±3 px 3 ciclos en 250 ms; YA LA USASTE con la negación de cabeza; mensaje 'YA LA USASTE' 0.8 s.
- **PALABRA GANADA:** se revelan las letras que faltaban (no aplica: se gana revelando todo); TRIUNFO 1.6 s; se quitan las posturas y la manoL recibe 500 px/s arriba (puño al aire); los pies patalean (260 px/s alternos cada 150 ms, 4 veces); cada globo +300 px/s de subida con 60 ms de escalón (el ramo rebota como cortina); 24 partículas de confeti en los colores de los globos desde el nudo (gravedad 400, vida 0.9 s); el puntaje de la palabra ('+320') sube 60 px en 0.8 s a escala 3 DESDE EL MUÑECO; mensaje en la línea de mensajes 1.4 s (SOLA: 'ESO ROMINA!', 'GENIA', 'LO SABIA', 'NADIE COMO TU'; A DOS: 'ADIVINADA!', 'GENIAL', 'ESA ES'); suben los 3 globos nuevos (SFX nudo por cada uno, 150 ms de escalón) y el nudo sube 40 por globo. La siguiente palabra cae a los 2.2 s, o al tocar EN CUALQUIER PARTE (teclado incluido: ahí está el pulgar) desde 0.8 s.
- **PALABRA PERDIDA:** sexto pop → `fall()`; la rana salta 20 px y croa; al cruzar la cadera el agua (0.6 s): 18 gotas blancas radiales 300-500 px/s, gravedad 900, vida 0.5 s, dos anillos concéntricos 140 ms, `cam.shake(6, 0.2)`, `vibrate(40)`, SFX chapuzón; bajo el agua 6 burbujas (4-7 px, suben a 90 px/s, estallan en 640); flota a los 2.6 s; EMPAPADO; chorrito de 3 partículas en arco desde la boca; la rana salta a la barriga (parábola 0.4 s) y se sienta mirando a ella; a los 1.2 s la ceja de 'ups'. 'SE MOJO... ERA:' en la pista y las casillas que faltaban en naranja letra a letra (80 ms). A los 4.3 s (o al tocar desde 1.5 s) → `ctx.gameOver` (SOLA) o tarjeta (A DOS).
- **REPOSO:** el balanceo lo pone el viento a través de los globos (54 px, emergente); cada 6-9 s un pataleo suelto (180 px/s en un pie); parpadeos; miradas; cada 8-14 s la rana croa y el muñeco la mira; ABURRIDO si ella no toca nada. Un pie que entra al agua a más de 150 px/s dispara SFX chapoteo (máximo uno cada 300 ms): con un globo, cada vaivén suena.
- **TOQUE DE ROMINA:** arrastrar = marioneta con el ramo detrás; soltar con velocidad = columpio de 2.2 s de periodo; tocar = 260 px/s + EH; frotar = COSQUILLAS con los globos bailando; tocar un globo = boing; arrastrar un globo = el ramo entero.

### Dibujo

Canvas 2D a 540x1200 con `meta.smooth:true` (ss:1 como FURIA; ss:2 solo si el tiempo de frame medido lo permite). Estilo manguera de goma de dos trazos: cada extremidad se traza primero en tinta #1a1030 con lineWidth 9, lineCap/lineJoin 'round', y encima el color con lineWidth 5. Cada punto se dibuja interpolado `ox + (x−ox)·alpha` (copias pDraw/pDrawPrev al final de cada paso, como SURVIVAL), para que a 90 Hz no tartamudee.

Orden: blit del cielo horneado (540x640: degradado, luna, halo, 40 estrellas) → agua (rect con degradado cacheado #1b2c6e→#0d1440, y 640..716; tres elipses blancas al 10% de estela de luna que se desplazan 8 px/s) → **sombra elíptica** del muñeco sobre el agua en (xMedioPies, 642): rx = 24 + 40·(1 − h/206), ry = rx/4, alfa 0.10 + 0.18·(1 − h/206), con h = 640 − yPies acotado a [0,206]; rx += |vxPies|·0.05 (se estira al columpiarse: vende la altura sin ningún número; sustituye al reflejo de los globos, que era la partida más cara del dibujo) → rana → cuerdas (quadraticCurve del nudo a cada globo con 6 px de comba, blanco al 60%, 2 px) → globos (elipse rx 24 ry 29 con gradiente radial cacheado por color, borde tinta 3, brillo rx 6 ry 9 blanco al 50% en (−8,−10), nudito triangular de 6 px abajo) → piernas (tinta 9 / pantalón #4a3f8a 5; zapatos: círculo r 8 tinta con r 5 #1a1030) → brazo derecho (tinta 9 / piel #ffe6c7 5; el puño en el nudo r 10) → torso: path hombroL-hombroR-caderaR-caderaL con panza de 12 px de curva por lado, relleno suéter #ff8fb8, borde tinta 6 → brazo izquierdo y mano (r 8 tinta / r 5 piel) → cabeza: círculo r 34 #ffe6c7, borde tinta 6; pelo: tres trazos de 16 px tinta 5 en la coronilla inclinados en contra de la velocidad de la cabeza (ángulo = −clamp(vx/300, −1, 1)·0.6 rad); tinte del globo más bajo al 8% sobre la coronilla → cara en el marco local: ojos elipses rx 8 ry 10 en (±13,−5) blancas con tinta 3, pupilas r 5 tinta con brillo de 2 px, cejas trazos de 16 px tinta 4 en (±13,−20), boca quadraticCurve de (−10,11) a (10,11) con control (0, 11+k) tinta 4, o rectángulo redondeado 18x13 tinta con interior #7a2a4a si está abierta, mejillas elipses 7x5 #ff5c9d al 35% en (±20,7), sudor 6x9 #5cffd8 → partículas → panel y teclado (blit del horneado) → casillas → HUD.

Rana: 26x18 #8aff6a en un nenúfar (elipse 44x14 #2f8f5a) en (110,646); ojos r 5 blancos con pupilas r 2.5 que siguen al muñeco; boca que se abre según lo cerca que estén los pies del agua (80 px → 0, 0 px → 1). Nada de shadowBlur ni filtros.

## Pantallas y flujo

Franjas verticales del lienzo (de arriba abajo): 0..74 botón de pausa del motor (dibujo 240..300 x 2..62, toque 228..312 x −10..74; `meta.pausaY` sin definir) con el HUD en las esquinas; 74..640 cielo y muñeco; 640..716 agua (rana en 646); 716.. panel #0d0620 (fundido 708..724); 722 pista (escala 2, cian); 744..796 casillas; 796..840 línea de mensajes; 850..1154 teclado; 46 px de margen inferior (92 físicos: la barra de gestos de MIUI).

1. **ENTRADA** (`init(ctx, args)` con `args.seed` → `makeRng` para palabras y fase del viento). Fundido 300 ms. Toda la escena, con el ramo bajando (objetivo 150→236). Donde luego va el teclado, dos botones de 440x100 (x 50..490) con esquinas r 20: 'SOLA' (y 880..980) y 'A DOS' (y 1010..1110), letra escala 5; 'MEJOR 1240' escala 2 en y 1130. El muñeco saluda con la mano libre (impulsos ±200 px/s cada 200 ms durante 1.2 s) y ya se lo puede tocar. HUD: 'ROMINA' (16,12) escala 2 a la izquierda, 'MEJOR n' alineado a la derecha en y 12.
2. **ELECCIÓN DE MODO:** tocar un botón (compromiso al soltar dentro): SFX select, se hunde (escala 0.9, alfa 0 en 200 ms) y el teclado sube: cada tecla entra desde 40 px más abajo con alfa 0→1 en 220 ms y 12 ms de escalón (27 teclas → 0.55 s).
3. **RONDA:** pista en cian sobre las casillas (la categoría en SOLA; en A DOS la elegida o nada). HUD SOLA: 'ROMINA' y 12, puntaje y 34, 'RACHA n' y 56 en #ffe14d con 'x2'/'x3' cuando aplica; 'MEJOR' a la derecha. HUD A DOS: 'J1 2 - 1 J2' a la izquierda. Los globos que quedan se ven en el ramo: no hay contador de errores.
4. **GANAR:** animación, puntos, mensaje, 3 globos nuevos (o 'PERFECTA! +100' si no falló ninguna), siguiente palabra a los 2.2 s o al tocar desde 0.8 s. En A DOS, tarjeta de resultado.
5. **PERDER:** chapuzón, EMPAPADO, 'SE MOJO... ERA:' con la palabra en naranja. SOLA → a los 4.6 s (o toque desde 3.4 s) la pantalla de fin propia (ver Derrota): estado `fin`, con la escena viva detrás; OTRA VEZ → `empezarSola()` con un muñeco nuevo entrando desde arriba, AL MENU → `ctx.toMenu()`. A DOS → tarjeta.
6. **A DOS, ESCRIBIR:** la palabra se escribe EN EL CIELO, justo debajo del muñeco que se tapa los ojos: título 'ESCRIBE LA PALABRA SECRETA' en y 494 y casillas en 520..572 sobre un velo suave (en el panel la raya terminaba en 793 y el botón empezaba en 796: pegados, y Anderson lo vio). En el panel quedan dos botones de 240x60 en y 746..806: 'ESPACIO' (x 21..261) y 'LISTO' (x 279..519, apagado hasta 3 letras), con 44 px de aire hasta el teclado. Las casillas muestran lo escrito (máx 14 caracteres, mín 3 letras, solo A-Z, Ñ y espacio; un solo espacio, nunca al principio ni al final) con cursor parpadeante (500 ms). Teclado en modo escribir: la séptima casilla de la cuarta fila es BORRAR (icono ⌫ con dos trazos). El muñeco NO MIRA (se tapa los ojos y se asoma cada 3 s).
7. **A DOS, PISTA:** al tocar LISTO, en la zona del teclado aparecen 6 tejuelas de 240x88 en dos columnas (x 21 y 279; y 850, 950, 1050): ANIMAL, COMIDA, LUGAR, COSA, NOSOTROS, SIN PISTA. Un toque elige (sin pantalla de escritura: es un toque, no otra palabra). La palabra escrita se OCULTA en el mismo frame.
8. **A DOS, PASAR:** telón opaco #120a2e sobre todo salvo el muñeco (que sigue tapándose los ojos arriba) con 'PASALE EL TELEFONO' escala 4 y 'TOCA PARA EMPEZAR' escala 2 parpadeando; bloqueo de entrada 600 ms. Al tocar, el telón se levanta (200 ms), las casillas se vacían (rayas y el hueco del espacio), el muñeco se destapa y sacude la cabeza → RONDA con 6 globos siempre. Los carteles de A DOS son NEUTROS: aquí los papeles se cambian y quien adivina puede ser Anderson.
9. **A DOS, RESULTADO:** tarjeta 'ADIVINADA CON 4 GLOBOS +260' o 'SE MOJO... ERA: PAPAYA', marcador 'J1 2 - 1 J2' (una ronda ganada suma al que adivinó; si cayó, al que escribió) y dos botones de 440x100: 'OTRA (CAMBIAN)' → ESCRIBIR con los papeles al revés, y 'AL MENU' → `ctx.toMenu()`. A DOS nunca llama a `ctx.gameOver`: el récord es de Romina adivinando sola y en A DOS quien escribe puede poner lo que quiera.

PAUSA: la del motor, en todas las pantallas. Al pausar, main.js suelta los dedos con un 'up': el juego libera el agarre (grab=−1) y cancela cualquier tecla a medio pulsar. Las secuencias son contadores en `update()`, sin setTimeout, y sobreviven a la pausa. `destroy()` suelta los canvases horneados.

## Controles

**Teclado.** 27 letras en 4 filas alfabéticas de 7-7-7-6 con la Ñ tras la N (es como se busca "qué me falta"; QWERTY es para escribir, no para descartar): A B C D E F G / H I J K L M N / Ñ O P Q R S T / U V W X Y Z (+ BORRAR en la séptima casilla de la cuarta fila solo en modo escribir; en modo adivinar queda vacía y las seis letras siguen alineadas a la izquierda). Tecla de **66x70 px virtuales = 132x140 físicos = 8.2 x 8.7 mm** (mínimo pedido 7.5). Separación 6 horizontal, 8 vertical. Fila de 7: 7·66 + 6·6 = 498 → margen lateral 21 px (42 físicos, fuera de la franja del gesto de volver de MIUI). Columnas en x = 21 + c·72; filas en y = 850, 928, 1006, 1084 (paso 78; la última termina en 1154). Área de toque de cada tecla: su celda más la mitad de los huecos, 72x78, sin zonas muertas entre teclas: col = floor((x−21)/72), fila = floor((y−846)/78). Letra con la fuente 5x7 a **escala 5** (25x35 px = 3.1x4.4 mm) en (x+21, y+18).

**Compromiso al soltar.** En el 'down' la tecla se hunde (escala 0.92, 80 ms), suena SFX tecla, el muñeco pone cara EXPECTANTE y mira la tecla. La letra se compromete en el 'up' si el dedo sigue dentro de la celda de 72x78 de la tecla del 'down'; deslizar fuera la cancela (la tecla vuelve, el muñeco resopla). Es el injerto obligatorio: en un juego de pensar un mal toque no puede costar un globo. La respuesta se sigue sintiendo inmediata porque el hundido y el tick van en el 'down'. Cada dedo es dueño de una sola tecla hasta su 'up'; dos dedos pueden estar en teclas distintas y se comprometen en orden de 'up'.

**Estados de tecla.** LIBRE: rectángulo redondeado r 12, relleno blanco al 9%, borde 2 px blanco al 35%, letra blanca. ACERTADA: relleno #5cffd8, letra #1a1030, pop-in escala 1→1.12→1 en 160 ms. FALLADA: sin relleno, borde #ff5c9d al 40%, letra #ff5c9d al 45% dibujada 3 px más abajo y un puntito r 4 en la esquina superior derecha del color del globo que costó: la tecla lleva puesto su globo. REPETIDA: tiembla ±3 px, 3 ciclos en 250 ms. El teclado se hornea en un canvas de 540x484 (panel incluido) y solo se re-hornea cuando cambia el estado de una tecla, desde el primer día: 27 letras por 3 colores son 81 cadenas en la caché de font.js (MAX_CACHE 160) y sin horneado el HUD la haría rotar.

**Casillas.** Centradas en x=270, y 744..796. Ancho = clamp(floor(500/L) − 6, 30, 48) con hueco 6, L = caracteres incluidos espacios; un espacio es un hueco de medio ancho sin raya. Letra escala 4 (20x28) centrada; raya inferior 3 px blanca al 50% en y 793; casilla revelada: letra blanca; en la derrota las que faltaban en naranja #ff9b4d. Pista/categoría en y 722 escala 2 cian centrada. Línea de mensajes y 796..840 (mensajes a ella en #ffe14d escala 3, 'YA LA USASTE', o ESPACIO/LISTO).

**Escena (y 74..716).** Todo lo que no es teclado, casillas ni pausa es zona de juguete. Arbitraje por pointerId: el primer dedo que baja en la escena es dueño del muñeco hasta su 'up' (un segundo dedo en la escena se ignora); un dedo en el teclado va a las teclas aunque otro esté arrastrando. Un dedo que baja en la escena y se desliza al teclado NO pulsa teclas; uno que baja en el teclado y se sale, no arrastra. La pausa la intercepta main.js antes.

**Convivencia con la pausa.** Techo de globos y ≥ 125 (borde 96), tope del nudo y ≥ 176, techo del cuerpo y ≥ 116 (borde de la cabeza 82), objetivo del dedo y ≥ 150: medido arrastrando la cabeza hacia (270,−100), la cabeza no sube de 169. El HUD va en las esquinas (y 12, 34, 56); el centro superior queda vacío. Se comprueba con captura en la entrada (el momento en que el ramo está más arriba).

## Modos

**SOLA:** palabras de la lista por escalones, con la categoría como pista, puntaje y racha, arrastre de globos, fin en el primer chapuzón, récord. **A DOS:** una persona escribe la palabra (y elige pista o SIN PISTA), pasa el teléfono, la otra adivina con 6 globos; marcador J1-J2 en pantalla; 'OTRA (CAMBIAN)' invierte los papeles; sin récord. Los dos usan el mismo teclado y el mismo muñeco.

## Puntaje y fin de partida

Solo SOLA puntúa. Por letra correcta: +5 por casilla revelada (una 'A' que aparece tres veces da +15), inmediato. Por palabra ganada: (100 + 15·letras + 25·globosQueQuedan) × multiplicador de racha (x1 en las palabras 1-2, x2 de la 3 a la 5, x3 desde la 6). Ejemplo: 'ELEFANTE' (8 letras) con 4 globos en la palabra 4: (100+120+100)·2 = 640. PERFECTA (sin fallos): +100. Globos: al ganar recupera 3 (tope 6). Medido con el modelo de tools/prueba-palabras.mjs (fórmula incluida): jugadora casual → mediana 8 palabras y 5 500 puntos, p90 23 000; torpe → 3 palabras y 1 300; buena → 46 palabras sobre dificultad constante (el escalón n≥6 la recorta). Se compararon +2 con relleno por perfecta (casual 4 palabras), +3 (8), +4 (12) y relleno siempre (13): +3 da el "3-5 palabras al principio, 8-12 dominando" que se busca; el plan B si las rachas mueren siempre en la palabra 3-4 al probarla en el teléfono es +4. Fin: `ctx.gameOver(Math.floor(puntaje))` tras la animación de empapado; el récord es "la mejor racha de Romina adivinando sola". A DOS puntúa cada ronda con la misma fórmula solo para la tarjeta.

## Palabras

`www/js/games/ahorc-palabras.js`: **445 palabras en 12 categorías** (ANIMALES 45, COMIDA 41, FRUTAS 33, PAISES 35, PROFESIONES 43, DEPORTES 33, LA CASA 39, NATURALEZA 32, ROPA 40, MUSICA 35, CUERPO 36, AMOR 33), en español latino y sin acentos, con 11 palabras con Ñ. Aparte va NOSOTROS: un array al principio del archivo con semillas genéricas de pareja (PRIMERA CITA, TE AMO, CAFE JUNTOS...) y un comentario para que Anderson meta las suyas; entra en la rotación desde la palabra 2 con probabilidad 0.25 y la pista NOSOTROS, siempre que tenga al menos cinco.

**Normalización al cargar:** mayúsculas, se protege la Ñ (Ñ→'#'), `normalize('NFD')` y se quitan los diacríticos, se restaura la Ñ; 'CAMIÓN' se juega como CAMION, que es la convención del ahorcado en español. Espacios: máximo uno, se muestra como hueco sin raya y no se adivina. A DOS acepta Ñ y espacio; no acepta acentos porque el teclado no los tiene.

**Dificultad por letras, no por largo** (injerto de CARA DE PALO: PIÑA es más difícil que ELEFANTE): a cada palabra D = 10/letrasDistintas + 2 por cada J K Ñ Q W X Y Z + 1 por cada B F G H V; la lista se parte en tercios por D (148 / 113 / 184). Elección con `ctx.rnd` sembrado: palabras 1-2 del tercio fácil y de ANIMALES/FRUTAS/COMIDA/CUERPO (las categorías donde la pista más ayuda), 3-5 del fácil o el medio, cualquier categoría, 6-9 del medio o el difícil con prioridad a LA CASA/PROFESIONES/DEPORTES/NATURALEZA/PAISES, 10+ cualquiera. Sin repetir dentro de la partida ni las últimas 40 de la sesión (anillo en memoria del módulo), y nunca dos seguidas de la misma categoría.

**Lo que dice el bot** (tools/prueba-palabras.mjs, sobre las 445): el piloto tonto por frecuencia (E A O S R N I D L C T U M P B G V Y Q H F Z J Ñ X K W, sin pista) gana el 42% del tercio fácil, el 5% del medio y el 1% del difícil con 6 fallos; el bot listo (conoce la categoría y la lista) gana el 100% con 0.2-0.3 fallos. La lectura: 6 fallos sin pista son brutales, y la categoría es lo que hace jugable el juego. Por eso la pista se enseña siempre y sola, sin tutorial ni comodines.

**Ñ en pantalla:** la Ñ YA está en font.js (diff sin commitear, glifo ['01001','10110','10001','11001','10101','10011','10001'], comentario '59 glifos'). No se añade otra ni se propone otro bitmap: se renderiza a escala 2 (pista) y 5 (teclas) con tools/ver.js y solo si la tilde se pega al palo se cambia por la variante '01010'/'10100'. Se eligió el glifo y no `fillText` con fuente del sistema porque todo el texto del arcade — HUD, teclas, casillas, fin de partida — es la 5x7 y una letra de sistema en medio se vería de otra app; `fillText` depende de la fuente que traiga MIUI y de su antialiasing; y `text()` ya cachea y blitea sin filtrado, así que la Ñ sale igual de nítida que la N y cuesta lo mismo.

## Audio

SFX nuevos con `sfx()` (tipos pulse/tri/saw/noise), añadidos a `SFX`:

- **tecla:** pulse duty 0.5, f0 560, dur 0.04, vol 0.16 (en el 'down').
- **cancelar:** noise f0 400→200, dur 0.10, vol 0.10 (el resoplido al deslizar fuera).
- **acierto:** dos notas pulse 0.25, f0 784 y 1175 a 60 ms, dur 0.07, vol 0.24; ambas ×2^(k/12) con k = letras ya reveladas (tope 12), como el combo de SKYLINE.
- **globo:** noise 3000→200 dur 0.12 vol 0.5 + pulse 0.125 f0 900→120 dur 0.08 vol 0.3 juntos.
- **repetida:** pulse 0.5 f0 300→280 dur 0.10 vol 0.15.
- **nudo:** pulse 0.25 f0 1319 dur 0.05 vol 0.2 por globo atado.
- **palabra:** SFX.powerup existente + nudo ×3; perfecta: SFX.record.
- **chapuzon:** noise 1200→150 dur 0.5 vol 0.5 + tri 220→90 dur 0.4 vol 0.3; luego tres burbujas pulse 900/1100/1300 dur 0.05 vol 0.15 cada 120 ms.
- **chapoteo:** noise 1500→400 dur 0.08 vol 0.18 (pie que toca el agua; máximo uno cada 300 ms).
- **croac:** saw 140→110 dur 0.12 vol 0.2, dos veces con 90 ms.
- **risa:** pulse 0.5 notas 660/880/660/880 dur 0.05 vol 0.18 cada 90 ms mientras frota.
- **eh:** pulse 0.25 f0 500→700 dur 0.08 vol 0.2. **boing:** tri 300→420 dur 0.10 vol 0.2.
- **bostezo:** tri 300→200 dur 0.6 vol 0.15. **tarareo:** tri 392, 440, 392 de 120 ms cada 140 ms.
- Vibración: 20 ms en pop, 40 ms en chapuzón, nada en teclas.

**Canciones.** El secuenciador toca `pattern[step % pattern.length]` por pista (audio.js:159), así que un patrón de 48 pasos son 4 compases de 3/4 con 4 pasos por negra, sin tocar audio.js. `SONGS.ahorcado` es una NANA en 3/4, Do mayor, 108 bpm (paso 0.139 s, compás 1.67 s), la más lenta y suave del arcade porque aquí se piensa: bajo tri `'C...........A...........F...........G...........'` vol 0.14 (48 pasos: una redonda con puntillo por compás); arpegio pulse duty 0.5 `'c.e.g.e.g.e.a.c.e.c.e.c.f.a.c.a.c.a.g.b.d.b.d.b.'` vol 0.055 (corcheas de caja de música); percusión noise `'H...h...h...H...h...h...'` vol 0.03 (um-pa-pa, 24 pasos). `SONGS.ahorcadoPanico`, al quedar 1 globo, La menor en 4/4 a 132 bpm para el contraste: tri `'A.......F.......D.......E.......'` vol 0.15, pulse duty 0.25 `'a.c.e.c.f.a.c.a.d.f.a.f.e.g.b.g.'` vol 0.065, noise `'H.h.H.h.H.h.H.h.'` vol 0.045; al recuperar globos vuelve a la nana (`playMusic` es idempotente). Notas usadas: C D E F G A B c d e f g a b, h H — todas en la tabla, sin sostenidos; tools/prueba-palabras.mjs valida cada patrón contra NOTE (una nota inválida no suena ni avisa).

## Estilo visual

Paleta: cielo #120a2e (arriba) → #2a1660 → #4a2a7a (horizonte, y 600); luna #fff2c8 r 70 en (430,150) con halo radial hasta r 220 al 18%; 40 estrellas fijas de 1-2 px al 40-80% (sembradas, sin parpadeo rápido). Agua y 640..716: #1b2c6e → #0d1440 con estela de luna (elipses blancas al 10% a 8 px/s) y la sombra del muñeco; de 708 a 724 se funde al panel #0d0620 (el fondo del fin de partida del motor, para que esa pantalla no cambie de mundo). Tinta #1a1030 para todo contorno. Muñeco: piel #ffe6c7, suéter #ff8fb8, pantalón #4a3f8a, mejillas #ff5c9d, sudor #5cffd8. Globos: #ff5c9d rosa, #5cffd8 cian, #ffe14d amarillo, #b48cff lila, #ff9b4d naranja, #8aff6a verde — los tres primeros son los del fin de partida y los récords del motor. Rana #8aff6a, nenúfar #2f8f5a. Teclas: blanco al 9% con borde al 35%; acertada cian; fallada rosa. Textos: HUD blanco, racha #ffe14d, pista cian, mensajes a ella #ffe14d, revelado de derrota naranja #ff9b4d. `meta.colors = ['#ff9bc8', '#1b2c6e']`.

Luz: la luna es la única de arriba; los globos son la luz cercana (gradiente radial por color, horneado una vez; tinte al 8% sobre la coronilla). Sin bloom (sello de SURVIVAL) ni scanlines. Línea: tinta gruesa y redondeada (9 de tinta con 5 de color) estilo dibujo animado de los años 30; es el único juego del arcade con contorno de tinta y personaje de caricatura, y pertenece por lo demás: noche saturada, los tres acentos del motor, la 5x7 en las esquinas y el mismo trato del detalle que FURIA.

## Carátula

96x128 en covers.js (`BUILDERS.ahorcado`). Cielo #120a2e→#4a2a7a, luna #fff2c8 r 16 en (72,22), 12 estrellas de 1 px. En el tercio superior el ramo: seis círculos r 9-11 en los seis colores apretados en (48,34), brillo blanco de 2x3 en cada uno, seis hilos blancos que convergen a un puño en (48,58). Del puño cuelga el muñeco a lo grande: cabeza r 9 piel con borde tinta 2, dos ojos de 2 px con las pupilas hacia abajo, cejas de preocupación, boca ondulada de 5 px; suéter rosa 10x12; dos piernas de tinta con los pies en (44,92) y (52,92). Agua #1b2c6e→#0d1440 desde y 100 con el reflejo de la luna en tres elipses y la rana de 8x5 en (24,102) con dos ojos blancos mirando arriba. `frame(d, '#ff9bc8')`. Se revisa con `node tools/ver.js tools/ver-portadas.html portadas.png` a tamaño real: globos, tipito colgando con cara de 'ay', agua debajo.

## Plan de archivos

NUEVOS en `www/js/games/`:

- `ahorcado.js` — la escena: `meta {id:'ahorcado', title:'AHORCADO', tag:'GLOBOS Y PALABRAS', colors:['#ff9bc8','#1b2c6e'], vw:540, vh:1200, smooth:true}`; máquina de estados (MODO, ESCRIBIR, PISTA, PASAR, RONDA, GANADA, CAIDA, RESULTADO_DUO); arbitraje de dedos por pointerId (teclado vs escena); casillas, HUD, puntaje, racha, arrastre de globos, temporizadores, `ctx.gameOver`. `draw(g, ctx, alpha)` interpola.
- `ahorc-fisica.js` — Verlet puro sin DOM ni core.js: `makeMono`, `step`, `pop`, `fall`, `tie`, `grab/moveGrab/release`, `poke`, `setPostura`; constantes (GRAV 1400, LIFT 700, ITERS 8, KV 15.4/0.6, KH 2.5/0.5, FB 0.6/2.0, VIENTO 140/90, SINK 40, WATER 640, CEIL 125, BODY_CEIL 116, AIR 0.998, BUOY 2300/2900/24).
- `ahorc-cara.js` — como surv-roma.js: `mkCara()`, `updateCara(cara, juego, dt)` (base por globos, preocupación continua, reacciones, mirada, parpadeo, sudor, aburrido) y `drawCara(g, cara, cx, cy, up)`; sin estado en draw.
- `ahorc-arte.js` — `hornearCielo()`, `drawAgua()`, `drawSombra()`, `drawRana()`, `drawGlobos()`, `drawCuerpo()`, `hornearTeclado()`, `drawCasillas()`, partículas (jirones, gotas, burbujas, confeti) en un array fijo local de 96.
- `ahorc-teclado.js` — geometría (x = 21 + c·72, y = 850 + f·78, tecla 66x70, celda 72x78), `hitTest(ev)`, estados por letra, compromiso en 'up' con cancelación, modo escribir (BORRAR, ESPACIO, LISTO), tejuelas de pista, animaciones de tecla.
- `ahorc-palabras.js` — categorías, NOSOTROS con semillas y comentario, normalización, D por letras, `pick(rnd, n, usadas)` por escalones, anillo de últimas 40.

TOCA de los existentes: `www/js/games.js` (importar y sumar al array, séptimo); `www/js/audio.js` (SONGS.ahorcado, SONGS.ahorcadoPanico y los 14 SFX); `www/js/covers.js` (builder `ahorcado`); `LEEME.md` ('Siete juegos', fila de AHORCADO con SOLA / A DOS y que al muñeco se lo puede tocar, nota de la Ñ y de los acentos, comandos de prueba); `www/js/font.js` (el glifo Ñ). No se tocan main.js, core.js ni input.js.

En `tools/` (no entran en el APK): `prueba-ahorcado.mjs` (importa ahorc-fisica.js por `file://` y corre las diez pruebas con umbral; sale con código 1 si alguna falla), `prueba-palabras.mjs` (valida la lista, hace jugar a los dos bots, modela la racha y comprueba las dos canciones contra la tabla de notas), `prueba-ahorcado-app.js` (dentro de la app con ver-app.js: las 27 teclas en centro y esquinas, la cancelación al deslizar, el toque y las cosquillas), `medir-ahorcado.js` (tiempo de update y draw por frame) y `ver-ahorcado.html` (hoja de contactos de las 16 expresiones a x1 y x2).

## Cómo se mide

Nada se da por bueno sin verlo o medirlo, en este orden:

1. **Física en Node** (`node tools/prueba-ahorcado.mjs`, antes de cada cambio de constante). Umbrales de aceptación: entrada asentada ≤ 2 s y globo más alto ≥ 125; reposo con error de restricción ≤ 2% y balanceo de pies entre 40 y 70 px; empujón de 400 px/s con periodo 2.0-2.5 s y bajada de 4 px antes de 20 s; cada pop baja 40 ± 1 con sobrepaso ≤ 10 y asentado ≤ 1.5 s; pies con 1 globo entre 630 y 640; caída con velocidad heredada del nudo < 1 px/s, cadera al agua ≤ 0.8 s, flota quieto ≤ 3 s, cabeza final entre 650 y 660 y x del cuerpo dentro de [120,420]; arrastre con error ≤ 5%; cabeza arrastrada hacia la pausa con borde ≥ 80; atar 3 globos ≤ 2 s con error ≤ 5%; cero NaN en todas; coste ≤ 0.02 ms por paso en Node. `SWEEP=1` para cualquier retoque del viento o la realimentación.
2. **Dibujado en Node:** un stub de contexto 2D que cuenta llamadas y REVIENTA ante cualquier método indefinido corre `draw()` 300 frames por cada pantalla (MODO, ESCRIBIR, PISTA, PASAR, RONDA, GANADA, CAIDA, RESULTADO) con alpha 0, 0.5 y 1: caza las excepciones de dibujado que la física nunca toca y da el número de operaciones por frame (objetivo ≤ 130 por frame en RONDA).
3. **Palabras** (`node tools/prueba-palabras.mjs`): solo [A-ZÑ ], largo 3-14, un espacio como mucho, sin duplicados entre categorías, aviso de categorías con menos de 12 palabras, ≥ 15 con Ñ, los dos bots por escalón y el modelo de racha; y las dos canciones contra la tabla NOTE con largo de patrón múltiplo de 12 (nana) o 16 (pánico).
4. **Ver el arte antes de juzgarlo** (`node tools/ver.js tools/ver-ahorcado.html caras.png`): hoja de contactos a 2x (tamaño físico) con las 10 expresiones sobre la cabeza de r 34, el ramo con 6..1 globos y en la entrada, los 4 estados de tecla, la Ñ a escala 2 y 5, la boca en zigzag de NERVIOSO y la gota de sudor, el muñeco flotando (tres semillas de viento) y la rana con la boca en 0, 0.5 y 1.
5. **La app corriendo** (`VERTICAL=1 node tools/ver-app.js ...` con `window.__arcade` para saltar a la escena): (a) captura de la ENTRADA a 0.3, 0.8 y 1.6 s para ver que ningún globo pisa el botón de pausa; (b) guion que toca el centro y las cuatro esquinas de las 27 teclas y cuenta letras comprometidas (esperado 135 de 135) y otro que apoya en una tecla y suelta en la vecina (esperado 0 comprometidas); (c) arrastre del muñeco hasta el borde superior y hasta el teclado, leyendo por `js:` la y mínima de la cabeza y que ninguna tecla se pulsó; (d) tiempo de frame en RONDA leído de `window.__arcade` durante 10 s a 90 Hz: física < 0.1 ms, dibujo < 3 ms; si sobra, probar `ss:2` y repetir; si falta, quitar primero la estela de luna y las partículas, nunca nada del muñeco; (e) una partida SOLA entera con un guion que falla seis letras para ver el chapuzón, la rana y la pantalla de fin, y otra que gana dos palabras para ver los globos nuevos atarse.
6. **En el teléfono:** una partida de Anderson con el pulgar midiendo cuántas letras salieron mal por tecla equivocada (objetivo 0 en 30 letras) y la sensación del columpio; y las rachas de Romina en las primeras cinco partidas: si mueren siempre en la palabra 3-4 sin que ella falle mucho, +3 pasa a +4.

## Lo medido al construirlo

- `node tools/prueba-ahorcado.mjs`: las diez pruebas pasan. Entrada asentada en 1.6 s con el globo más alto en y=125; balanceo de reposo 54 px; cada pop baja 40.0 con 7.3 de sobrepaso; con un globo los pies llegan a 640; caída sin velocidad heredada, cadera al agua a 0.6 s, flota quieto a 2.1 s; arrastre violento a 3000 px/s sin NaN y con 10.7% de estiramiento máximo; 0.01-0.02 ms por paso.
- `tools/prueba-ahorcado-app.js` en la app: 135/135 toques en las teclas, 0 huecos, apoyar en A y soltar en B no usa letra y el muñeco resopla, tocarlo no cuesta nada (cara EH), frotar la barriga da COSQUILLAS. Pausar con una tecla apoyada NO la compromete (main.js manda un 'up' sintético; se distingue porque el dedo sigue en `pointers`).
- `tools/medir-ahorcado.js`: dibujo 0.3 ms mediana (p95 0.6) y física 0.1 ms en la PC sin GPU; el teléfono es ~5x más lento, así que queda dentro de los 3 ms.
- Dos fallos que solo se vieron en captura: el muñeco nervioso salía ENOJADO (la convención del ángulo de las cejas estaba al revés) y los botones de la tarjeta de A DOS se veían apagados (se dibujaban debajo de su velo).
- Una revisión adversarial (4 buscadores, 2 escépticos por hallazgo) confirmó 11 fallos más, todos corregidos. El grave: en A DOS los globos que faltaban subían al ABRIR la ronda y tardaban 0.5 s en atarse, así que un doble toque sobre TOCA PARA EMPEZAR (que cae sobre el teclado) podía reventar el único globo vivo y hundir al muñeco con un solo fallo. Ahora suben mientras se escribe la palabra, los que aún vengan subiendo se atan en seco antes de reventar ninguno, el teclado no acepta letras mientras entra ni en el primer 0.35 s de cada palabra, y `tie()` no ata nada a un muñeco que ya cae. También: los impulsos se acumulan y se aplican al integrar (mover `ox` a mano pintaba el punto un frame al revés), las cosquillas se miden con el reloj real (los 'move' llegan a 60, 90 o 120 por segundo), los anillos del chapuzón ya no se desplazan, 'CON 1 GLOBO' en singular, sin '+5' en A DOS y el rótulo del HUD es 'A DOS' cuando puede estar jugando Anderson.

## Riesgos

1. **Feel del teclado** (el 90% del tiempo de juego): resuelto con compromiso en 'up', teclas de 8.2x8.7 mm, celdas sin huecos, hundido y tick en el 'down'; se mide con toques reales (medida 5b).
2. **Legibilidad del muñeco** a 2 px físicos por virtual: cabeza r 34, pupilas r 5, trazos de 3-4 px de tinta (6-8 físicos); hoja de contactos obligatoria antes de compilar (medida 4).
3. **Física inestable:** el nudo como punto Verlet libre se hundía; el pivote con muelle está medido en las nueve pruebas, incluida la caída sin velocidad heredada y los arrastres absurdos; las posturas entran con rampa; guarda de recolocación.
4. **Rendimiento:** cielo y teclado horneados desde el primer día, gradientes de globos cacheados, sombra en vez de reflejos, sin shadowBlur; presupuesto física < 0.1 ms y dibujo < 3 ms medidos en el teléfono (medida 5d).
5. **Crueldad al perder:** chapuzón cómico, rana en la barriga, ceja de 'ups', palabra revelada; la curiosidad nunca castiga (tocar globos no los revienta).
6. **Dificultad:** el modelo dice 3/8/46 palabras por perfil con +3; el plan B (+4) está listo y se decide en el teléfono, no en el papel.
7. **La Ñ:** ya está; se renderiza antes de commitear el diff.
8. **A DOS:** la palabra se oculta en el frame de LISTO; telón con 600 ms de bloqueo; carteles neutros porque cambian los papeles.
9. **Ramo y pausa:** techo 125, tope del nudo 176, techo del cuerpo 116, objetivo del dedo ≥ 150; medido en Node y comprobado con captura.
10. **90/120 Hz:** física a 60 pasos fijos, dibujo interpolado con alpha, cara avanzada en `update()`: la pantalla no puede cambiar la velocidad de nada.