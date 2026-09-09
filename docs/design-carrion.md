# SYMBIOTE (rediseno Carrion)

> Eres una masa de carne roja con doce tentaculos que se agarran solos: arrastra el dedo y fluyes por paredes y techos de un laboratorio a oscuras, arrancando cientificos de sus pasillos.

**Resolucion:** PORTRAIT 540x1200. LANDSCAPE 1200x540. Identical area (648,000 px both ways) because core.js applyOrientation() swaps long/short — so every fill-rate budget in this document is rotation-invariant and needs proving only once. TS stays 24: portrait shows 22.5x50 tiles, landscape 50x22.5 tiles. Landscape's 50-tile width IS the wide Carrion framing the user asked for, at zero extra cost. Both map to an exact x2 integer upscale on the Redmi Note 10's 1080x2400 panel; any other virtual size lands on a fractional scale, and with imageSmoothingEnabled=false that renders pixels at uneven widths — instantly visible on pixel art. Do NOT raise TS to 32 (shows only 37.5 tiles wide, shrinks the creature relative to screen, forces a re-bake of every tile sprite, and invalidates the BSP generator's 44x88 max grid which is sized to TS=24). Do NOT drop to 270x600 (at TS=12 the flesh mass is ~7px across and the fanned tentacles collapse into a single blob). meta: { id:'symbiote', title:'SYMBIOTE', tag:'ESCAPA DEL LAB', colors:['#ff2d55','#6b3a94'], vw:540, vh:1200, rotates:true }. BLOCKER, verified by reading the file: symbiote.js line 18 reads `const VW = 540, VH = 1200;` — this SHADOWS core.js's live exported bindings and until it is deleted NOTHING about rotation can work. Replace with `import { VW, VH, ... } from '../core.js'` plus separate `const CANON_SHORT = 540, CANON_LONG = 1200;` used ONLY in meta. sym-world.js already imports the live bindings (line 11) so all 17 of its VW/VH uses are already rotation-correct.

**Loop:** Arrastrar para fluir -> ver a la presa -> pulsar ataque para arrancarla -> la biomasa sube y creces -> las alarmas suenan y el laboratorio responde -> escapar por la salida antes de que la purga te alcance. Un nivel dura 150s de juego previsto con tope duro a 240s. La biomasa (0-100) se llena matando y drena a 3.5/s, asi que parar de matar es encoger: el bucle se auto-presiona hacia adelante. Escalada: alert 0 (matadero puro, solo cientificos) -> 1 (alarma, guardias) -> 2 (cierre, lanzallamas, refuerzos) -> 3 (purga: banda de fuego que barre el nivel). El alert sube por TUS fallos (alarmas que no impediste) con un suelo temporal, asi que la dificultad lee como consecuencia y no como temporizador.

**Duracion:** Nivel: 150 segundos de juego previsto, con tope duro a 240 s (a partir de ahi la banda de purga dobla su velocidad a 44 px/s y la empuja fuera o la mata en ~40 s). Ningun nivel puede pasar de ~280 s. Partida completa: 8 niveles, unos 20 minutos si se juega limpio; la mayoria de las partidas moriran antes. Muerte -> reintento jugable en 1150 ms, reiniciando el MISMO nivel con la MISMA semilla y la puntuacion de niveles completados preservada. Los primeros 10 segundos estan coreografiados frame a frame (ver el resto del documento): apertura en frio, sin logo, sin cartel de titulo, sin tutorial, sin dialogo. Fundido desde negro en 300 ms y ella ya esta a media accion — se le da vy = -240 (rafaga hacia arriba saliendo del tanque, expresada en verlet como B.oy = B.y + 4) y 4 tentaculos pre-lanzados al techo en abanico (-0.9, -0.3, +0.3, +0.9 rad desde la vertical), asi que el PRIMER frame que ve el jugador es la silueta Carrion colgando con los tentaculos abiertos, no un blob en un suelo. A 0.3 s: colgando del techo, tres cientificos visibles, los tres ya gritando y corriendo en direcciones distintas, y el de la alarma con su tono ascendente ya sonando. 0.3-1.0 s: NINGUN aviso, que mire. 1.0 s: si no ha habido ningun toque, aparece un icono de mano al 35% de alpha abajo a la izquierda con una flecha de 60px, y el boton de ataque pulsa; se desvanece PARA SIEMPRE en cuanto aterriza cualquier toque, y si toca antes de 1.0 s no aparece nunca. 1.5-3.0 s: primer arrastre, fluye, los tentaculos se agarran solos, no hay nada que aprender. 3-5 s: primer contacto con el cientifico en panico; como el tropiezo se escala por distancia, es muy probable que tropiece delante de ella — el juego le regala una ejecucion gratis en su primer intento. ~5 s: PRIMERA MUERTE, los 617 ms completos con hitstop, camara lenta, chorro, el cuerpo enrojece un nivel, biomasa 18. 6-8 s: el de la alarma llega al panel; o ella llega y lo cancela (una persecucion con objetivo claro y cuenta atras sonora) o no y suena el klaxon, alert sube a 1, las luces empiezan a pulsar y despiertan los guardias. LOS DOS RESULTADOS SON BUENOS: uno ensena que matar tiene proposito, el otro arranca la escalada. El juego no puede producir unos primeros 10 segundos aburridos. 8-10 s: el de la puerta sigue golpeando, inalcanzable, teatro permanente al fondo.

**Muerte:** FUENTES DE DANO Y NUMEROS (tope hp 100/130/160 por tier):
  bala de guardia 22, rafaga de 3 = 66 en el peor caso
  tick de llama del pyro 14 a 5/s = 70 dps dentro del cono; ignicion 8 dps durante 3 s = 24
  haz de torreta 4 cada 1/12 s = 48 dps
  embestida del ejecutor 30
  banda de purga 10 dps
  charco acido T_HAZARD 1 cada 500 ms
  drenaje de tuberia 4/s (ya en el codigo)
  CIENTIFICOS: 0. SIEMPRE. PARA SIEMPRE.

REGLAS DEFENSIVAS:
  IFRAMES 800 ms tras cualquier golpe, con el parpadeo de sprite a 20 Hz que ya existe.
  PUERTA DE DANO: como maximo el 55% de la vida maxima puede perderse en cualquier ventana de 1000 ms. Se lleva dmgT/dmgAcc y se recorta. Esto mata la peor muerte arcade que existe: aquella en la que tres fuentes se solapan y muere sin causa legible. Con cuatro fuentes de dano simultaneas en alert 3, el dano sin recortar produce muertes que el jugador no puede interpretar, y una muerte ininterpretable en un arcade lee como injusticia.
  ULTIMO ALIENTO: cualquier golpe que la llevaria de mas de 25 hp a 0 o menos la deja en 1 hp y le da 900 ms de iframes, UNA VEZ POR NIVEL. Siempre tiene una oportunidad de huir. Se anuncia con 300 ms de destello blanco y un tri grave.
  CURACION: +6 por cientifico, +10 por muerte armada. Alimentarse es la unica cura. No hay recogibles.

LAS CINCO REGLAS DE JUSTICIA (bloque de comentario en la cabecera de la seccion de enemigos; no romper ninguna jamas):
  R1 AVISO MINIMO. Ningun ataque puede impactar en menos de 400 ms desde su primer frame de telegrafo visible. Guardia 420 ms, pyro 700 ms, ejecutor 700 ms, torreta 500+320=820 ms. Su entrada evasiva mas rapida (un tiron de arrastre) la mueve ~180 px en 300 ms, asi que todo telegrafo se bate por reaccion, no por memorizacion.
  R2 NUNCA FUERA DE PANTALLA. Nada se compromete a atacar salvo que wcam.contains(e.x, e.y, 16). Ya se aplica a guardia y hazmat — aplicarlo tambien al pyro.
  R3 VECTORES BLOQUEADOS. Todo vector de punteria se calcula UNA VEZ al final del telegrafo y jamas se actualiza. Moverse perpendicular SIEMPRE funciona. Es la unica regla que hace que el juego se sienta justo. Un cono de llama que sigue al objetivo es dano inevitable y es la diferencia entre un enemigo tenso y uno injusto.
  R4 TOPE DE CONCURRENCIA. Como maximo 2 guardias en ST_AIM y como maximo 1 pyro en ST_ATTACK simultaneamente, RECONTADOS cada frame (nunca un contador mutable: el comentario existente sobre esa fuga es correcto).
  R5 MISERICORDIA DE APARICION. world.mercy bloquea todo compromiso de ataque durante 1200 ms tras empezar un nivel o reaparecer.

SECUENCIA DE MUERTE — 1150 ms totales del golpe letal a un reintento plenamente jugable:
  t=0 golpe letal. freeze = 0.20 (12 frames). G.sprayPulse(spray, B.x, B.y, 0, -1, 24, rnd), cam.shake(9, 0.40), vibrate([0,90,60,140]).
  t=0-500 ms el cuerpo se desinfla: la escala del sprite interpola 1.0 -> 0.35 mientras los tentaculos quedan flacidos (se para el solver de restricciones, se deja la gravedad — la cuerda verlet colapsando por su peso es una animacion de muerte genuinamente buena y sale gratis).
  t=200 ms sfx({type:'saw', f0:220, f1:40, dur:0.55, vol:0.40}) — gemido humedo descendente.
  t=500-1000 ms se estampa un charco grande bajo ella via stampPool, y la pantalla se desatura dibujando un rectangulo #2a0008 al 45% de alpha sobre todo.
  t=700 ms aparece el texto: 'MUERTA' centrado a escala 5, y 'TOCA PARA REINTENTAR' a escala 2 debajo.
  t=900 ms SE ACEPTA LA ENTRADA. Cualquier toque en cualquier sitio reinicia.
  t=900-1150 ms el reinicio: startLevel() regenera desde LA MISMA SEMILLA y el mismo indice de nivel, asi que el reintento es el MISMO nivel, no uno nuevo. La generacion ya esta medida sobre 1600 niveles, asi que esto queda holgadamente bajo 250 ms.
  TOTAL DEL PEOR CASO: 1150 ms, dentro del requisito de menos de 1.5 s.

La puerta de entrada de 900 ms existe SOLO para que un jugador machacando el boton de ataque en el momento de morir no se salte la animacion antes de verla; por debajo de 900 ms las muertes se vuelven invisibles y nunca aprende que la mato.

POLITICA DE REINTENTO: reinicia el NIVEL ACTUAL con la puntuacion de los niveles completados preservada. Morir cuesta solo los puntos del nivel actual, nunca la partida. Reiniciar con la misma semilla importa mas de lo que parece: quien murio a una emboscada concreta de un pyro quiere batir ESA sala, y regenerar un nivel nuevo convierte una experiencia de aprendizaje en un encogimiento de hombros.

```js
hurt(n, src) {
  if (this.iframe > 0 || this.dead) return;
  const cap = this.B.hpMax * 0.55;
  if (this.dmgT > 0 && this.dmgAcc + n > cap) n = Math.max(0, cap - this.dmgAcc);
  if (n <= 0) return;
  if (this.B.hp > 25 && this.B.hp - n <= 0 && !this.lastStand) {
    this.lastStand = 1; this.B.hp = 1; this.iframe = 0.9; this.whiteT = 0.3;
    sfx({ type:'tri', f0:110, f1:70, dur:0.45, vol:0.38 });
    cam.shake(7, 0.3); vibrate([0, 70, 50, 70]);
    return;
  }
  this.B.hp -= n;
  if (this.dmgT <= 0) { this.dmgT = 1.0; this.dmgAcc = 0; }
  this.dmgAcc += n;
  this.iframe = 0.8; this.freeze = 0.10;
  cam.shake(6, 0.2); SFX.hurt(); vibrate(70);
  if (this.B.hp <= 0) {
    this.dead = 1; this.deadT = 0; this.limp = 1;   // limp: el solver suelta la cuerda
    this.freeze = 0.20; cam.shake(9, 0.4); vibrate([0, 90, 60, 140]);
    G.sprayPulse(this.spray, this.B.x, this.B.y, 0, -1, 24, this.rnd);
    this.moanT = 0.20;                              // en update, NO setTimeout
  }
}
```
NOTA: el gemido se programa con un temporizador en update (this.moanT), no con setTimeout — un setTimeout sobrevive a destroy() y puede sonar dentro de la escena siguiente.

RESET DEL POOL: jamas pasar null como funcion de reset. Un enemigo reciclado hereda hp<=0, dead=1, grip=1 y stagger de su vida anterior y aparece ya muerto o congelado. rstEnemy debe ganar resets para TODOS los campos nuevos: grabUid, burnT, tankHp, ST_DOOR/ST_SURRENDER timers.

## LOCOMOCION (lo mas importante)

SOFT BODY + 12 AGENTES DE AGARRE INDEPENDIENTES. Esto NO es un gancho. Un solo cuerpo Verlet (x, y, ox, oy) + NT=12 tentaculos, cada uno una maquina de 4 estados autonoma. El cuerpo NUNCA se restringe a ningun ancla — eso es exactamente lo que hizo pendulo la version vieja. Las anclas agarradas aportan ACELERACION hacia si mismas, la suma se NORMALIZA a una unica direccion de arrastre, y la gravedad se cancela por completo mientras haya un solo tentaculo agarrado.

CONSTANTES EXACTAS:
REACH = 288 px = 12 tiles exactos. SEG = 8 particulas/tentaculo (96 particulas totales). REST = REACH/(SEG-1) = 41.1 px nominal. NT = 12. RING = 16 ranuras de ancla. SUB = 3 substeps. ITERS = 3 iteraciones de restriccion. MIN_GRIP = 2. PULL_K = 30 (1/s^2). PULL_MAX = 5000 px/s^2. SLIDE = 0.35. GRAV = 1500 px/s^2. DAMP_GRIP = 0.90 por 1/60s. DAMP_AIR = 0.997. MAXSPD = 420 px/s. BODY_R = 10.

POR QUE REACH=288 Y NO 56 NI 132 (el numero mas importante del documento): las salas del generador BSP de sym-world son 15x17 tiles = 360x408 px; desde el centro la pared mas cercana esta a 103-192 px. Con REACH=132 solo 508 de 21600 rayos impactan (2.4%) y todo pickGrip falla con cero candidatos: la criatura literalmente no tiene nada que sujetar y cae. Barrido directo sobre un recorrido de 6 waypoints que incluye trepar una pared y cruzar un techo: 132 -> 0/6 waypoints; 180 -> 3/6; 240 -> 3/6; 280 -> 6/6 con |dV| medio 4.8; 300 -> 6/6 con |dV| 4.2; 340 -> 6/6 pero |dV| salta a 36.4 (nervioso, anclas demasiado lejos para sentirse conectadas). Ventana util 280-300; 288 son 12 tiles exactos, con margen a ambos lados. Se dibujan gruesos y conicos para que sigan leyendo como un abanico de miembros cortos y no como espagueti de 288px.

MAQUINA DE ESTADOS POR TENTACULO (SEEK=0, GRIP=1, REL=2). NO existe estado EXTENDING con tiempo de viaje: la punta salta al ancla y la longitud de reposo adaptativa hace que PAREZCA que se extendio en 2-3 frames.
```js
if (st[i] === GRIP) {
  life[i] += dt;
  const dx = gx[i]-B.x, dy = gy[i]-B.y, d = Math.hypot(dx,dy)||1;
  const align = (dx/d)*aimx + (dy/d)*aimy;
  const over = d > REACH*1.04, behind = align < -0.55, aged = life[i] > 1.1;
  if (over || ((behind||aged) && gripsLast > MIN_GRIP)) { st[i]=REL; cool[i]=0.03; }
  else ng++;
} else if (st[i] === REL) {
  cool[i] -= dt; if (cool[i] <= 0) st[i] = SEEK;
} else pickGrip(i, aimx, aimy);
gripsLast = ng;
```
La guarda MIN_GRIP>2 es LOAD-BEARING: sin ella, cuando el jugador apunta hacia arriba en una sala la unica ancla es el suelo (que esta 'detras'), todos los tentaculos se sueltan y la criatura cae para siempre. Medido exactamente ese bug: 100% de frames sin agarre.

LONGITUD DE REPOSO ADAPTATIVA: una cuerda agarrada usa rl = max(4, dist(cuerpo,ancla)/(SEG-1)) recalculada en cada iteracion, asi la cadena abarca exacto hasta su ancla sin holgura y sin pelearse con la restriccion.
```js
let rl = REST;
if (pinTip) { const dd = Math.hypot(gx[i]-B.x, gy[i]-B.y); rl = Math.max(4, dd/(SEG-1)); }
for (let s = 0; s < SEG-1; s++) {
  const a = b+s, c = a+1;
  const dx = px[c]-px[a], dy = py[c]-py[a];
  const dd2 = dx*dx+dy*dy; if (dd2 < 1e-9) continue;   // GUARDA OBLIGATORIA: NaN permanente
  const dist = Math.sqrt(dd2), diff = (dist-rl)/dist*0.5;
  const wx = dx*diff, wy = dy*diff;
  if (s !== 0) { px[a]+=wx; py[a]+=wy; }
  if (!(pinTip && c === b+SEG-1)) { px[c]-=wx; py[c]-=wy; }
}
```

EL TIRON — arrastre normalizado + cancelacion total de gravedad + deslizamiento tangencial. Esto es lo que hace que FLUYA en vez de columpiarse:
```js
let ng = 0, fx = 0, fy = 0;
for (let i = 0; i < NT; i++) {
  if (st[i] !== GRIP) continue;
  ng++;
  const dx = gx[i]-B.x, dy = gy[i]-B.y, d = Math.hypot(dx,dy)||1;
  const a = Math.min(PULL_K*d, PULL_MAX);
  const align = (dx/d)*aimx + (dy/d)*aimy;
  const w = pulling ? Math.max(0, align) : 0;
  fx += dx/d*a*w; fy += dy/d*a*w;
  if (pulling && w < 0.25) {                    // ANTI-BLOQUEO: obligatorio
    let tnx = -dy/d, tny = dx/d;
    if (tnx*aimx + tny*aimy < 0) { tnx = -tnx; tny = -tny; }
    fx += tnx*a*SLIDE; fy += tny*a*SLIDE;
  }
}
if (ng > 0) {
  fy += GRAV*0.15;                              // peso: hundimiento leve
  const fm = Math.hypot(fx, fy);
  if (fm > 1e-4) { fx = fx/fm*PULL_MAX; fy = fy/fm*PULL_MAX; }
  vx += fx*dt2; vy += fy*dt2;                   // gravedad NO aplicada = adherencia
  const dmp = Math.pow(DAMP_GRIP, dt*60); vx *= dmp; vy *= dmp;
} else {
  vy += GRAV*dt2;
  const dmp = Math.pow(DAMP_AIR, dt*60); vx *= dmp; vy *= dmp;
}
const spd = Math.hypot(vx,vy)/dt;
if (spd > MAXSPD) { const k = MAXSPD/spd; vx *= k; vy *= k; }
```
NORMALIZAR la suma es obligatorio: sumar fuerzas en crudo hace que la velocidad punta dependa de cuantos tentaculos casualmente esten pegados — se dispara en las esquinas y se arrastra en las salas abiertas. Mas anclas = mas agarre, no mas fuerza.
El termino SLIDE no es pulido, es REQUISITO: anclas que rodean el cuerpo se cancelan exactamente y la criatura se bloquea en el sitio. Medida una parada muerta de 2.23 segundos por esto — que es literalmente la queja 'no puedo moverlo con fluidez'.
POR QUE NO ES UN PENDULO: no hay ninguna restriccion radial de distancia sobre el cuerpo, asi que no hay arco ni oscilacion conservada. Las anclas se re-eligen cada ~1.1s y se sueltan en cuanto el cuerpo las pasa (align < -0.55): la criatura se re-agarra continuamente por delante de si misma — flujo mano sobre mano.

TECHO Y CAIDA LIBRE SALEN SOLOS, SIN CASOS ESPECIALES. Escribir CERO jump, CERO flag onGround, CERO estado wall-cling. Caminar por el techo es automatico: el anillo escanea las 16 direcciones, asi que un techo arriba es simplemente otra ancla; una vez agarrada, la gravedad se cancela y el arrastre sube el cuerpo hasta el. BORRAR de sym-rope.js las ramas onGround/WALK/checkGround por completo — son casos especiales de la era pendulo y cada uno reintroduce una parada muerta (el checkGround en particular mataba la velocidad cada frame en pasillos). Caida libre: con ng===0, GRAV completa con DAMP_AIR, topada por MAXSPD; como los SEEK llaman pickGrip cada frame y el rescaneo de panico dispara en cuanto gripsLast===0, cae rapido pero se re-agarra en 1-2 frames de lo que entre en su radio de 288px.

BARRIDO CONTRA TILES, BODY_R=10 (20px de diametro contra tiles de 24px, 4px de holgura en un hueco de un tile). Probar al radio COMPLETO, no BODY_R-2 como hace sym-rope.js — esa mentira dejaba al cuerpo visual solaparse con los muros. Barrido verificado por hueco de un tile: BODY_R 9 pasa, 10 pasa, 11 pasa, 12 FALLA. BODY_R=12 son 24px contra un tile de 24px: el bug original de 28px reproducido. Se dibuja la carne a 26-30px visuales y se deja solapar los pixeles de pared — la criatura se deforma, asi que un radio de colision menor que el sprite es CORRECTO aqui, no una trampa.
```js
function blocked(x, y) {
  const r = BODY_R;                    // radio COMPLETO, sin fudge -2
  return solidAt(x-r,y) || solidAt(x+r,y) || solidAt(x,y-r) || solidAt(x,y+r);
}
function sweep(nx, ny) {
  const dx = nx-B.x, dy = ny-B.y, dist = Math.hypot(dx,dy);
  if (dist < 1e-4) return;
  const steps = Math.max(1, Math.ceil(dist/(TS*0.4)));
  const sx = dx/steps, sy = dy/steps;
  for (let i = 0; i < steps; i++) {
    const tx = B.x+sx; if (!blocked(tx,B.y)) B.x = tx; else B.ox = B.x;
    const ty = B.y+sy; if (!blocked(B.x,ty)) B.y = ty; else B.oy = B.y;
  }
}
```

ESTABILIDAD: matriz medida (SUB x ITERS, |dV| medio como proxy de nerviosismo): SUB=1 -> 8.9 con cualquier ITERS; SUB=2 -> 4.4; SUB=3 -> 2.7. ITERS 2/3/4/6 no cambiaron |dV| en absoluto a SUB fijo, y costaron 0.0074/0.0099/0.0118/0.0172 ms. Los substeps compran suavidad, las iteraciones solo compran coste: gastar en SUB, dejar ITERS=3. Cero explosiones en toda la matriz. Tunelado: 0 frames con el cuerpo dentro de solido en los cuatro modos de entrada, incluidos tirones de direccion cada 7 frames; a MAXSPD=420 con SUB=3 el cuerpo avanza 2.3px por substep contra tiles de 24px (margen 10x) y el barrido subdivide ademas a TS*0.4.

TRES FALLOS A BLINDAR: (1) particulas coincidentes -> mantener la guarda dd<1e-9 o la normalizacion divide por cero y un NaN recorre toda la cadena en un frame, matando el tentaculo el resto del nivel sin error visible. (2) ancla horneada dentro de la geometria -> desplazar toda ancla 2px por la normal del impacto (h.x + h.nx*2), o la punta clavada se hunde en el muro y la cadena pelea contra la restriccion para siempre. (3) tope de pasos del raycast -> dimensionarlo ceil(maxD/TS)+2 en vez de un 14 fijo; a REACH=288 un tope bajo trunca rayos largos en silencio y descarta anclas de suelo perfectamente validas.

RESULTADOS FINALES MEDIDOS en 4 modos de entrada (recorrido suave, waypoints, sinusoide, tirones de 7 frames): 4.17-7.25 agarres medios, 0.0-0.8% de frames sin agarre, frames de parada muerta 0.0% en los cuatro, parada mas larga 0.00/0.00/0.02/0.00 s, velocidad maxima 419 px/s, 0 frames dentro de solido, 0 explosiones. Distribucion de velocidad en juego normal centrada en 100-250 px/s, que lee como flujo pesado y no como proyectil.

NOTA DE ROTACION: REACH=288 es una constante de ESPACIO DE MUNDO y NO debe reescalarse al girar — solo cambia el encuadre de camara. En 540x1200 vertical los 288px cubren algo mas de media pantalla de ancho; en 1200x540 horizontal cubren menos de un cuarto. Eso es correcto y deseable (horizontal muestra mas sala), pero hace que el alcance se sienta mas corto en horizontal: ensanchar la zona muerta de camara en vez de tocar REACH.

## Tentaculos

CUENTA: NT = 12 tentaculos simultaneos. SEG = 8 particulas cada uno = 96 particulas totales. Doce lee como un abanico Carrion propio; seis lee como una arana. (El tier de crecimiento modula cuantos se dibujan con enfasis y cuantos participan del agarre activo — ver progression — pero la reserva fisica es siempre 12x8, asignada una sola vez.)

COSTE MEDIDO EN ESTA MAQUINA, sistema COMPLETO (raycasts de anillo + seleccion de agarre + integracion del cuerpo + barrido de tiles + solver de cuerdas): 0.0100 ms/frame. Matriz completa a SUB=2/ITERS=3, ms/frame: NT8/SEG6=0.0061, NT8/SEG8=0.0076, NT10/SEG8=0.0086, NT12/SEG8=0.0100, NT12/SEG10=0.0124, NT14/SEG10=0.0146. TODAS las configuraciones son gratis; se elige 12x8 por estetica, no por velocidad. El verlet 6x14 anterior medía 0.0095 ms/frame, asi que 96 particulas contra 84 costando 0.0100 por estrictamente mas trabajo es consistente con esa linea base. Aplicando una penalizacion conservadora de 15-20x de escritorio a Adreno 612 esto aterriza en 0.15-0.20 ms contra un presupuesto de 16.67 ms: ~1%. El solver de tentaculos NO es donde este juego gastara el frame; el estampado de sangre y el blit del tilemap si.

SELECCION DE AGARRE: ANILLO PERSISTENTE DE 16 RANURAS EN DIRECCIONES DE BRUJULA FIJAS (tablas COS/SIN precalculadas una vez). Se refrescan 4 ranuras por frame en round-robin (el anillo entero cada 4 frames) = 4 rayos/frame amortizados. Cuando gripsLast===0 se hace un RESCANEO DE PANICO de las 16 ranuras ese mismo frame: esa es la garantia de no-quedarse-atascada. Coste medido en regimen estable: 4.00 rayos/frame, 0.0015 ms/frame para toda la etapa de busqueda.
```js
function pickGrip(i, aimx, aimy) {
  let best = -1, bestScore = -1e9;
  for (let k = 0; k < RING; k++) {
    if (!ringHit[k]) continue;
    const dx = ringX[k]-B.x, dy = ringY[k]-B.y, d = Math.hypot(dx,dy)||1;
    if (d > REACH) continue;                       // re-validar contra el cuerpo ACTUAL
    const align = (dx/d)*aimx + (dy/d)*aimy;
    const score = align*2.0 + (1 - d/REACH)*0.8;   // sesga, NUNCA excluye
    let dup = 0;
    for (let j = 0; j < NT; j++) {
      if (j === i || st[j] !== GRIP) continue;
      const ex = gx[j]-ringX[k], ey = gy[j]-ringY[k];
      if (ex*ex+ey*ey < 400) { dup = 1; break; }    // dedup 20px: el abanico se abre
    }
    if (dup) continue;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  if (best < 0) return false;
  gx[i] = ringX[best]; gy[i] = ringY[best]; st[i] = GRIP; life[i] = 0;
  return true;
}
function scanSlot(k) {
  const h = ray(B.x, B.y, COS[k], SIN[k], REACH);
  if (h.d > 5) { ringHit[k]=1; ringX[k]=h.x+h.nx*2; ringY[k]=h.y+h.ny*2; }  // +2px por la normal
  else ringHit[k] = 0;
}
```
DOS TRAMPAS MORTALES, ambas medidas: (1) lanzar el abanico SOLO hacia el aim es la trampa intuitiva y es exactamente al reves — lanza al aire vacio justo cuando el jugador quiere trepar, mientras el suelo sobre el que esta, lo unico contra lo que podria tirar, ni siquiera se prueba. Los rayos van en TODAS las direcciones y el aim solo pesa el SCORE. (2) el primer anillo cacheaba puntos de mundo y luego los rechazaba todos por d > REACH porque el cuerpo se habia movido desde el escaneo: 36666 fallos consecutivos de pickGrip, todos con cero candidatos, sin ningun error en ningun sitio. Reconstruir SIEMPRE contra la posicion ACTUAL del cuerpo.

FUERZAS DE TIRON: por tentaculo agarrado a = min(PULL_K*d, PULL_MAX) con PULL_K=30 (1/s^2) y PULL_MAX=5000 px/s^2, peso w = max(0, align) para que solo las anclas POR DELANTE arrastren; la suma se normaliza de vuelta a magnitud PULL_MAX y se aplica una sola vez. Anclas con w<0.25 aportan deslizamiento TANGENCIAL a SLIDE=0.35 de la fuerza completa (signo elegido hacia el aim). Ver locomotion para el bloque completo.

RENDERIZADO — CONICIDAD POR PASOS DE MEDIO GROSOR, no pixel a pixel. Cada miembro son cuadrados alineados a ejes recorridos por la cadena, avanzando max(1, w*0.5) donde w es el grosor local. MEDIDO: paso por pixel cuesta 99 fillRect por tentaculo (1719/frame con 8 tentaculos y pase de brillo — ~3x por encima del presupuesto de un Adreno 612); paso de medio grosor cuesta 43 por tentaculo, 554/frame total incluyendo cuerpo y brillos. Los cuadrados consecutivos se solapan por medio de su propio ancho POR CONSTRUCCION, asi que dejar huecos es imposible.
CONICIDAD: 9px en la raiz -> 2px en la punta.
DOS PASES POR MIEMBRO: (1) el cuadrado completo en el color de cara inferior; (2) un cuadrado de 1-2px desplazado arriba-izquierda en el color iluminado, aplicado solo donde w>=4 (el tercio superior de la conicidad). Ese unico desplazamiento es lo que hace que un gusano rojo plano lea como un miembro carnoso iluminado.
```js
function drawLimb(g,px,py,base,w0,w1,camX,camY,colDark,colLit){
  g.fillStyle=colDark;
  for(let s=0;s<SEG-1;s++){
    const i=base+s, j=i+1;
    const x0=px[i]-camX, y0=py[i]-camY, x1=px[j]-camX, y1=py[j]-camY;
    const dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy);
    const t=s/(SEG-1);
    const w=Math.max(1, Math.round(w0+(w1-w0)*t));
    const step=Math.max(1, w*0.5);          // solape => sin huecos
    const n=Math.max(1, Math.ceil(len/step)), hw=w>>1;
    for(let k=0;k<n;k++){ const f=k/n; g.fillRect(Math.round(x0+dx*f)-hw, Math.round(y0+dy*f)-hw, w, w); }
  }
  g.fillStyle=colLit;
  for(let s=0;s<SEG-1;s++){
    const t=s/(SEG-1);
    const w=Math.max(1, Math.round(w0+(w1-w0)*t));
    if(w<4) break;                          // la punta es demasiado fina para iluminar
    const i=base+s, j=i+1;
    const x0=px[i]-camX, y0=py[i]-camY, x1=px[j]-camX, y1=py[j]-camY;
    const dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy);
    const lw=Math.max(1,w-3), step=Math.max(1,w*0.5);
    const n=Math.max(1,Math.ceil(len/step)), hw=w>>1;
    for(let k=0;k<n;k++){
      const f=k/n;
      g.fillRect(Math.round(x0+dx*f)-hw, Math.round(y0+dy*f)-hw, lw, 1);
      g.fillRect(Math.round(x0+dx*f)-hw, Math.round(y0+dy*f)-hw, 1, lw);
    }
  }
}
```
COLORES: seco = fleshRim #3d0810 (oscuro) + fleshLit #c9203a (luz). Mojado (R.wet[i]>0, 1.2s tras atravesar sangre) = bloodDeep #8e0f1c + bloodMid #b81322.

SESGO DEL ABANICO COMO SENAL DE INTENCION: se sesga el abanico para que ~60% de los tentaculos libres alcancen hacia dir. Esta es la senal PRIMARIA de retroalimentacion y es animacion de personaje pura: el jugador lee la intencion del propio cuerpo de la criatura, exactamente como en Carrion, con cero espacio de pantalla gastado.

## Criatura

MASA DE CARNE POR CONTORNO RADIAL DE PUNTOS DE CONTROL, rasterizada como columnas verticales. NI sprite horneado NI metaballs (los metaballs exigen evaluar un campo por pixel — exactamente el pase de pantalla completa descartado).

ESTRUCTURA: NR=12 radios de control alrededor del centro, cada uno con su propio muelle para que ondule independientemente, muestreados en 48 angulos, rasterizados como columnas verticales con fillRect. COSTE MEDIDO: 29 fillRect cuando esta redonda (r=14, area 649 px contra los 616 px de un circulo verdadero — la forma es correcta, no una aproximacion que gotea o deja huecos), 45 cuando esta aplastada (scaleX=1.6/scaleY=0.55, area 589 px) sin ningun cambio de codigo. Aplastarse para pasar por un hueco son DOS MULTIPLICACIONES, no otra rama de codigo.

TRES CASCARAS CONCENTRICAS, escalando el radio muestreado por 1.00 / 0.82 / 0.55 y desplazando la de luz 2px arriba-izquierda: borde oscuro (fleshRim #3d0810), cuerpo (flesh #8e1224), brillo humedo (fleshLit #c9203a). Eso es lo que la hace leer como carne mojada y no como una pelota. ~90 fillRect/frame para el cuerpo completo con las tres cascaras — trivial frente al presupuesto de 554 llamadas de criatura completa validado.

TAMANO POR TIER (la lectura primaria): 24px / 34px / 44px de diametro visual — un rango de 1.83x, inconfundible a 3 metros en un telefono al sol. base = 12 + grow*10. Colision fija en BODY_R=10 SIEMPRE, desacoplada del tamano dibujado: la criatura se deforma, asi que un radio de colision menor que el sprite es correcto.

HP POR TIER: 100 / 130 / 160. Al subir de tier gana 30 hp al instante.

OJOS: 1 / 3 / 5 puntos rojos segun tier — Carrion hace exactamente esto. Socket oscuro (eyeDark #1a0206) de 6x4 con pupila brillante (eye #ffe8a8) de 2x2 que SIGUE al objetivo de arrastre (look_x/look_y * 3px). El segundo ojo se abre cuando base>16.

DEFORMACION VIVA:
```js
const NR=12;
const blob={ rad:new Float32Array(NR), vel:new Float32Array(NR), base:14, sx:1, sy:1, ang:0 };
for(let i=0;i<NR;i++) blob.rad[i]=14;

function blobUpdate(b,dt,t,squeezeX,squeezeY,grow){
  b.base = 12 + grow*10;
  for(let i=0;i<NR;i++){
    // Dos senos desfasados por punto: la ondulacion nunca parece un circulo respirando.
    const target = b.base*(1 + 0.10*Math.sin(t*3.1 + i*1.7) + 0.05*Math.sin(t*5.7 + i*0.9));
    b.vel[i] += (target-b.rad[i])*40*dt;   // muelle
    b.vel[i] *= 0.86;                      // amortiguacion
    b.rad[i] += b.vel[i]*dt;
  }
  b.sx += (squeezeX-b.sx)*Math.min(1,12*dt);
  b.sy += (squeezeY-b.sy)*Math.min(1,12*dt);
}

// Hunde una abolladura donde un tentaculo tira fuerte: esto es lo que vende 'blando'.
function blobPull(b,ang,amount){
  const TAU=Math.PI*2;
  const i=Math.round(((ang%TAU+TAU)%TAU)/TAU*NR)%NR;
  b.vel[i]-=amount; b.vel[(i+1)%NR]-=amount*0.5; b.vel[(i+NR-1)%NR]-=amount*0.5;
}
```

RASTERIZADOR DE COLUMNAS (cero asignacion, buffers de modulo):
```js
const _lo=new Int16Array(256), _hi=new Int16Array(256);
function blobShell(g,b,cx,cy,k,ox,oy,col){
  const STEPS=48, TAU=Math.PI*2;
  let minx=1e9,maxx=-1e9, px=0,py=0;
  for(let s=0;s<=STEPS;s++){
    const a=s/STEPS*TAU;
    const f=a/TAU*NR, i=f|0, fr=f-i;
    const r=(b.rad[i%NR]+(b.rad[(i+1)%NR]-b.rad[i%NR])*fr)*k;
    const x=cx+ox+Math.cos(a)*r*b.sx, y=cy+oy+Math.sin(a)*r*b.sy;
    if(s===0){px=x;py=y;continue;}
    let xa=px,ya=py,xb=x,yb=y;
    if(xa>xb){const t1=xa;xa=xb;xb=t1;const t2=ya;ya=yb;yb=t2;}
    const ia=Math.round(xa), ib=Math.round(xb);
    for(let X=ia;X<=ib;X++){
      const t=(xb-xa)<1e-6?0:(X-xa)/(xb-xa);
      const Y=ya+(yb-ya)*t, idx=X&255;
      if(X<minx||X>maxx){ if(X<minx)minx=X; if(X>maxx)maxx=X; _lo[idx]=_hi[idx]=Y; }
      else { if(Y<_lo[idx])_lo[idx]=Y; if(Y>_hi[idx])_hi[idx]=Y; }
    }
    px=x;py=y;
  }
  g.fillStyle=col;
  for(let X=minx;X<=maxx;X++){ const idx=X&255; g.fillRect(X,_lo[idx],1,(_hi[idx]-_lo[idx])+1); }
}
function drawCreature(g,b,sx,sy,pal){
  blobShell(g,b,sx,sy,1.00, 0, 0, pal.fleshRim);
  blobShell(g,b,sx,sy,0.82, 0, 0, pal.flesh);
  blobShell(g,b,sx,sy,0.55,-2,-2, pal.fleshLit);
  drawEye(g,b,sx,sy,pal);
}
```
Cada tramo es un fillRect alineado a entero: sin antialiasing, sin trazo, respetando imageSmoothingEnabled=false.

SANGRE ENCIMA: B.bloodiness (0-1) sube +0.20 por desgarro y drena a 0.02/s. Se expresa oscureciendo flesh hacia bloodDeep #8e0f1c e inyectando salpicaduras de bloodFresh #e01228 en la cascara media — NO se re-hornea nada, es un cambio de fillStyle. Los 4 niveles de sangre x 3 tiers ya no necesitan 12 canvas horneados porque el cuerpo es procedural: eso ELIMINA el riesgo de hitch al subir de tier por completo.

LUZ PROPIA: la criatura siempre inyecta su propio disco de luz roja (LAMP.red, radio 56px) en el buffer de luz. No es decorativo — es la GARANTIA de que nunca es invisible en un pasillo sin luz. Quitarla para hacer el juego 'mas oscuro' reproduce el fallo original de 'no se ve que pasa' en forma nueva.

## Controles

### Arrastre

OBJETIVO ABSOLUTO DEL DEDO, no desplazamiento relativo, en coordenadas de PANTALLA/virtuales (no de mundo). Cada frame se calcula d = dist(dedo, cuerpoEnPantalla). DEAD = 12px (zona muerta; 1.49 mm a 409ppi, justo por encima del suelo de temblor de dedo de ~1mm): mag = 0. PULL_MAX_DRAG = 190px (23.6 mm, arco comodo de pulgar sin levantar la palma): mag satura a 1 y se queda en 1 mas alla, nunca sobrepasa. Entre ambos: mag = clamp((d-DEAD)/(190-DEAD), 0, 1). NEAR = 40px de rampa suave: si d < NEAR, mag *= (d-DEAD)/(NEAR-DEAD), asi la criatura se detiene suavemente bajo el dedo en vez de vibrar. dir = normalizado (dedo - cuerpoEnPantalla), recalculado en cada 'move' Y en cada frame — el cuerpo se mueve bajo un dedo quieto, asi que el vector debe re-derivarse de la posicion VIVA del cuerpo, nunca cachearse en pointerdown (cachearlo hace que la criatura se curve y orbite su objetivo en vez de asentarse). Curva verificada, monotona y sin discontinuidad: d=0 -> 0.000, d=12 -> 0.000, d=20 -> 0.013, d=40 -> 0.157, d=80 -> 0.382, d=140 -> 0.719, d=190 -> 1.000, d=260 -> 1.000. Absoluto gana a relativo porque el movimiento Carrion es 've ahi', un destino continuo, no una velocidad de stick virtual; el relativo ademas deriva su origen en un flujo largo y obliga a recentrar. DEDO SOBRE EL CUERPO = PARADA TOTAL es la afordancia clave: convierte 'quedate quieta' en un gesto natural en vez de un modo. NUNCA hornear el desplazamiento de oclusion dentro del vector de entrada: probado, y poner el dedo exactamente sobre el cuerpo daba mag 0.20 apuntando ABAJO con el punto nulo real 46px por encima del cuerpo — invierte el modelo mental del jugador. El desplazamiento pertenece a la CAMARA, nunca al vector de arrastre.
```js
const DEAD=12, PULL_MAX=190, NEAR=40;
function recompute(C,bsx,bsy){
  const dx=C.fx-bsx, dy=C.fy-bsy, d=Math.hypot(dx,dy);
  if(d<DEAD){ C.mag=0; return; }          // dir se conserva: sin salto al reentrar
  const inv=1/d; C.dirX=dx*inv; C.dirY=dy*inv;
  let m=(d-DEAD)/(PULL_MAX-DEAD); m=m<0?0:m>1?1:m;
  if(d<NEAR) m*=(d-DEAD)/(NEAR-DEAD);
  C.mag=m;
}
```
OCLUSION DEL DEDO — ADELANTO DE CAMARA de 72px, medido contra la huella del pulgar. LEAD = 72px aplicado como desplazamiento de camara OPUESTO a la direccion de arrastre, escalado por mag, suavizado a 0.10*dt*60 por frame. Se alimenta DENTRO del look-ahead lax/lay existente de WorldCam.follow, nunca como un segundo seguidor competidor (dos seguidores suavizados independientes en el mismo eje baten entre si y producen un bamboleo visible a 0.12 y 0.10). Perfil de asentamiento medido: 33.7px a 0.10s, 51.7px a 0.20s, 66.3px a 0.40s, 70.9px a 0.67s; al soltar decae a 24.7px en 0.17s y 3.0px en 0.50s. LA MATEMATICA QUE OBLIGA A 72: el Redmi Note 10 es 1080x2400 a ~409ppi, y a 540x1200 virtual un px virtual = 0.124 mm. La huella de un pulgar adulto son ~11 mm = 89 px virtuales, radio ~44px. El cuerpo con BODY_R=10 mide 20px = 2.5 mm. El cuerpo es ~4.5x mas pequeno que el dedo que lo tapa: no esta parcialmente ocluido, esta enterrado. El adelanto debe superar radioHuella(44) + BODY_R(10) = 54px para que asome el borde del cuerpo, y 44 + radioAbanico(26) = 70px para que salga el abanico de tentaculos. 52px deja el cuerpo 1px CORTO — el peor valor posible. 72px despeja cuerpo y abanico con margen, con 8.9 mm de desplazamiento de encuadre, que lee como camara inclinandose hacia el movimiento y no como criatura resbalando fuera del dedo. RECHAZADAS explicitamente: desplazar el cuerpo del punto de toque (rompe la afordancia 'dedo sobre cuerpo = parada' y hace que la criatura parezca esquivar el dedo); transparencia global en la criatura (destruye la lectura carne-roja-sobre-lab-oscuro que es toda la direccion de arte, y mirar la masa es el atractivo entero de Carrion).
```js
const LEAD=72, LEAD_S=0.10;
function tick(C,dt){
  const tx=C.active?-C.dirX*LEAD*C.mag:0;
  const ty=C.active?-C.dirY*LEAD*C.mag:0;
  const s=Math.min(1,LEAD_S*dt*60);
  C.leadX+=(tx-C.leadX)*s; C.leadY+=(ty-C.leadY)*s;
}
```
REGRAB = 0.20s tras levantar el dedo de arrastre: la criatura sigue por inercia en vez de pararse en seco, asi que re-agarrar a media fluidez es continuo.

### Ataque

VERBO: SNATCH (arrebatar). No es una embestida ni un mandoble. GEOMETRIA VALIDADA EN AMBAS ORIENTACIONES:
VERTICAL (540x1200): centro (VW-96, VH-190) = (444, 1010), radio visual 54, padding de toque 22 -> radio de toque 76.
HORIZONTAL (1200x540): centro (VW-108, VH-92) = (1092, 448), radio visual 50, padding 26 -> radio de toque 76.
Radio de TOQUE identico en ambas para que la memoria muscular se transfiera; el visual encoge un poco en horizontal porque el espacio vertical escasea. Comprobacion fisica a 409ppi: diametro visual 13.4 mm, diametro de toque 18.9 mm, contra el minimo Google/MIT de 9-10 mm — pasa con ~2x de margen. El centro vertical queda a 24 mm del borde inferior y 12 mm del derecho, dentro del arco natural del pulgar derecho. SLIP = 36px: una vez que el dedo posee el boton lo conserva hasta que se aleja mas de r+pad+36, asi un pulgar que rueda durante un machaque no pierde la entrada.
```js
function layout(C,VW,VH,land){
  C.land=!!land;
  if(land){ C.btnX=VW-108; C.btnY=VH-92;  C.btnR=50; C.btnPad=26; }
  else    { C.btnX=VW-96;  C.btnY=VH-190; C.btnR=54; C.btnPad=22; }
}
function hitBtn(C,x,y){ const dx=x-C.btnX, dy=y-C.btnY, r=C.btnR+C.btnPad; return dx*dx+dy*dy<=r*r; }
```
COOLDOWN ATK_CD = 0.28s desde la pulsacion. Es DELIBERADAMENTE menor que la ventana de combo de 0.4s que ya existe en onKill, asi machacar encadena muertes hacia la rama 'big' (comboN>=2) en vez de pelearse con ella. Subirlo por encima de 0.4s desactiva en silencio la cadena de muertes sin ningun error visible.
ALCANCE Y CONO: GRAB_R = 150px por defecto (190 en tier 2, 230 en tier 3), cono de semiangulo 0.85 rad (49 grados) hacia el VECTOR DE ARRASTRE ACTUAL. Si no hay dedo abajo se usa la direccion de velocidad; si la velocidad < 40px/s se usa B.face. Puntuacion: score = dist - 60*inCone - 90*(st===ST_TRIP||st===ST_COWER||st===ST_ALARM); gana el menor. Exige lineOfSight(L, B.x, B.y, e.x, e.y) — no se arrebata a traves de paredes. El cono llega deliberadamente algo hacia atras (rechazo solo si dot < -0.20) porque un corte duro a 90 grados genera denegaciones falsas cuando la criatura fluye rapido y el cuerpo ya paso al objetivo.
EL BOTON NUNCA FALLA EN SILENCIO — tres resultados, siempre uno: (1) objetivo valido a <=150px -> LINEA DE TIEMPO DE AGARRE (617ms, ver killFeel); (2) objetivo con grabbable:false (ejecutor) -> LINEA DE ATURDIMIENTO (alcance 0-100ms identico, luego freeze=0.05, cam.shake(3,0.1), e.stagger=0.5, damageEnemy(e,25,true), sfx mas sordo {type:'noise',f0:600,f1:200,dur:0.12,vol:0.28}; SIN sangre ni escombros — la ausencia de gore ES la senal didactica, aprende la excepcion en una pulsacion sin texto); (3) sin objetivo -> LATIGAZO: 2 tentaculos barren un arco de 0.9 rad en 130ms a 1400px/s, hacen 40 de dano a lo que crucen (reutilizando la puerta de velocidad de tentacleHits), rompen T_GLASS via shatterGlass, y estampan sangre si la punta cruza un tile ya ensangrentado; sfx {type:'noise',f0:3000,f1:1400,dur:0.06,vol:0.14}. Un boton que a veces no hace nada destruye la sensacion de ser un monstruo imparable mas rapido que cualquier otro defecto.
EL MOVIMIENTO NUNCA SE INTERRUMPE AL ATACAR: el arrastre sigue fluyendo durante toda la linea de tiempo, y al menos un tentaculo permanece anclado a una pared durante los 617ms completos. Si todos los tentaculos se comprometen con la victima, el cuerpo se para 300ms en cada muerte y el juego se convierte en una sucesion de QTEs — que es exactamente lo contrario de lo que se pide.
El objetivo se guarda por e.uid y se re-resuelve con W.findByUid CADA FRAME. Pool usa swap-remove: guardar un indice de pool a lo largo de los ~37 frames del agarre hara que se re-apunte en silencio a lo que sea que la swap metio en esa ranura.
RESPUESTA EN EL MISMO FRAME: en 'down' de ataque se pone btnEdge sincronamente y se dispara el sfx (SFX.hit()) y vibrate(12) DENTRO del manejador, no en el siguiente update — 16.7ms de retraso de audio se oyen como papilla en una pulsacion. btnEdge se consume dentro de update (const e=C.btnEdge; C.btnEdge=false) para no perder una pulsacion cuando caen dos 'down' entre frames.
RETROALIMENTACION VISUAL DEL BOTON: anillo a alpha 0.30, rellenandose hasta 0.85 conforme expira ATK_CD, y destello interior de 3px al arrebatar con exito. Es la UNICA cromo en pantalla.

### Arbitraje de dedos

DOS ROLES: dragId y atkId, ambos inicializados a -1. EN 'down', EN ESTE ORDEN EXACTO: (1) PRIMERO limpiar cualquier rol que este mismo pointerId ya posea; (2) probar el boton (el ataque gana si atkId esta libre y el punto cae dentro de r+pad); (3) si no, reclamar arrastre si dragId esta libre; (4) si no, ignorar. Un tercer dedo se descarta en silencio y no perturba ningun rol activo. En 'move' se enruta estrictamente por id: arrastre actualiza la posicion del dedo, ataque comprueba el radio de deslizamiento. En 'up'/'cancel' se limpia solo el rol que coincide. Levantar el dedo de arrastre mientras se mantiene el ataque pone mag a 0 y deja atkId intacto, y el siguiente dedo que baje en cualquier sitio reclama arrastre limpiamente.
BUG REAL ENCONTRADO Y CORREGIDO: sin la limpieza de rol al principio de down(), un pointerId que reaparece sin su 'up' (WebView de Android RECICLA ids tras un pointercancel que la pagina nunca recibe: cortina de notificaciones, rechazo de palma, un gesto del sistema robando el stream) puede poseer AMBOS roles a la vez. Un fuzz de 200 eventos lo alcanzo 15 veces: atkId=3 mantenido, llega un 'down' nuevo con id 3, y el mismo dedo pasa a ser tambien dragId=3; despues un solo levantamiento fisico limpia un rol y el otro se queda pegado para siempre — boton de ataque trabado, o criatura que sigue fluyendo sin ningun dedo en el cristal. Es la clase de bug que se reporta como 'se congelo' y es casi imposible de reproducir a mano. Tras la correccion: 40 semillas x 400 eventos aleatorios incluyendo rotaciones en vivo = 0 violaciones de todos los invariantes (ningun id compartido, mag en [0,1], active === dragId!==-1, btnDown === atkId!==-1, todos los flotantes finitos).
```js
function down(C,ev,bsx,bsy){
  // Un id que reaparece sin su up JAMAS puede tener los dos roles.
  if(ev.id===C.atkId){ C.atkId=-1; C.btnDown=false; }
  if(ev.id===C.dragId){ C.dragId=-1; C.active=false; C.mag=0; }
  if(C.atkId===-1 && hitBtn(C,ev.x,ev.y)){
    C.atkId=ev.id; C.btnDown=true; C.btnEdge=true; return 'atk';
  }
  if(C.dragId===-1){
    C.dragId=ev.id; C.fx=ev.x; C.fy=ev.y; C.active=true; C.regrab=0;
    recompute(C,bsx,bsy); return 'drag';
  }
  return 'none';
}
function up(C,ev){
  if(ev.id===C.dragId){ C.dragId=-1; C.active=false; C.mag=0; C.regrab=REGRAB; return true; }
  if(ev.id===C.atkId){ C.atkId=-1; C.btnDown=false; return true; }
  return false;
}
```
MANTENER el preventDefault y el setPointerCapture de input.js en pointerdown (verificados en input.js lineas 19 y 22). Quitar cualquiera de los dos deja que WebView reintroduzca su retraso de gesto de ~300ms y robe el stream a media pulsacion; la captura ademas garantiza que 'move'/'up' sigan llegando cuando el dedo se sale del rectangulo del canvas.
PRESUPUESTO DE LATENCIA: muestreo tactil (~8ms) + manejador en el mismo frame (0) + un frame de 16.7ms = ~25ms, que se lee como instantaneo.

### Rotacion

El giro es una TRANSFORMACION DE VISTA PURA. Nada de la simulacion lee VW/VH.
SECUENCIA EN onRotate(w,h,land): (1) layout() para la nueva orientacion (boton de ataque a las coordenadas de arriba); (2) RE-ANCLAR cualquier arrastre en curso preservando su desplazamiento relativo al cuerpo — NUNCA recortar las coordenadas crudas del dedo a los nuevos limites; (3) wcam.snap(L, B.x, B.y), NO follow() (snap recalcula maxX/maxY con el nuevo VW/VH y recentra al instante; follow suaviza durante muchos frames y mientras tanto cam.x puede superar L.pxW-VW y el drawImage de 9 argumentos de drawLevel muestreara mas alla del borde del canvas de nivel, dando una franja de basura); (4) reconstruir el buffer de luz a media resolucion al nuevo tamano; (5) NO tocar: estado del solver de cuerdas, posicion/velocidad del cuerpo, pools, capa de sangre, RNG, puntuacion, nivel.
```js
function rotate(C,VW,VH,land,bsxOld,bsyOld,bsxNew,bsyNew){
  layout(C,VW,VH,land);
  if(C.dragId!==-1){                    // conserva el vector, mueve el ancla
    C.fx=clamp(bsxNew+(C.fx-bsxOld),2,VW-2);
    C.fy=clamp(bsyNew+(C.fy-bsyOld),2,VH-2);
    recompute(C,bsxNew,bsyNew);
  }
  // atkId deliberadamente intacto: un boton mantenido sobrevive al giro
}
```
MEDIDO en un cambio 540x1200 -> 1200x540 con el dedo en (150,700) y el cuerpo centrado: RECORTAR desvia el rumbo 9.2 grados E infla la distancia de 156px a 523px, lo que clavaria mag de 0.81 a velocidad maxima en el instante del giro — un tiron aleatorio para el jugador. RE-ANCLAR da 0.0 grados de error de rumbo y preserva mag exactamente (0.810 -> 0.810), con el dedo aterrizando en (480,370), dentro de limites. El recorte es la primera implementacion obvia y parece correcta hasta que se mide el vector resultante.
EL DEDO DE ATAQUE conserva su id a traves del cambio sin importar donde se movio el boton, y solo se libera con su propio 'up'. NUNCA re-testear hitBtn tras un giro: el boton se mueve, el dedo no, y re-testear suelta un boton mantenido en el momento en que el telefono gira.
SALVEDAD DE MIUI: MIUI no entrega pointercancel de forma fiable al girar. input.js mantiene un Map por pointerId, asi que un dedo mantenido a traves de un cambio dejaria el arrastre activo y el boton pulsado para siempre. Por eso relayout() DEBE resetear explicitamente ambos roles (dragId=-1, atkId=-1, active=false, mag=0, btnDown=false) en el caso general de cambio de escena; el re-anclaje de arriba solo se aplica cuando el evento de giro llega limpio y el juego confia en su propio Map de punteros. Regla practica: re-anclar si el pointerId sigue presente en input.js pointers Map, resetear si no.
MOTOR: usar la version corregida de core.js con baseLong/baseShort capturados al armar setRotatable(true), un flag 'force' para que onRotate SIEMPRE dispare en el armado (el applyOrientation actual nunca lo dispara si el tamano ya coincide, dejando el boton de ataque en (0,0)), y fit() en TODO resize aunque no cambie el aspecto (view.scale/ox/oy alimentan toVirtual() de input.js; saltarselo tras un resize de barra de estado o barra de gestos deja cada coordenada tactil desplazada — el clasico 'los controles se movieron'). Reemplazar el setTimeout(fitAndOrient,100) actual por un bucle de asentamiento de dos muestras iguales (SETTLE_MS=120, SETTLE_MAX=800): MIUI dispara orientationchange PRIMERO, a veces antes de que innerWidth/innerHeight se actualicen, y luego 2-5 resize a lo largo de 150-400ms mientras corre la animacion; un timeout fijo aterriza en medio y lee un tamano medio girado como 1080x1080.

## Nivel

MANTENER EL GENERADOR DE sym-world.js INTACTO. Esta verificado sobre 1600 niveles con 0 salidas inalcanzables, y el problema estetico esta ENTERAMENTE en TMAP y en los arrays A_*. El generador y el renderizador ya estan limpiamente separados: drawLevel hace un unico drawImage de 9 argumentos desde un canvas de nivel pre-horneado, y repaintTile parchea un tile al danarse. Nada de eso necesita cambiar para una revision total de arte; solo cambian las entradas de TILE_SPR. Reescribir el generador para acomodar arte nuevo perderia la garantia de alcanzabilidad a cambio de cero ganancia visual.

QUE SE MANTIENE EXACTAMENTE: generacion BSP, tuberias, alcanzabilidad BFS, camara, raycast DDA, lineOfSight, pool de enemigos con disciplina de uid, y las maquinas completas de guardia/torreta/ejecutor. CORR=3 (verificado en el codigo, linea 360) da pasillos de 72px, asi que los pasillos ordinarios NUNCA fueron el problema de atasco — el enganche era en vanos de puerta, bocas de tuberia y esquinas diagonales, que BODY_R=10 resuelve.

QUE CAMBIA EN sym-world.js: (a) cambiar la ficcion de E_HAZMAT por E_PYRO en la misma ranura id 3; (b) anadir ST_DOOR (22) y ST_SURRENDER (23); (c) retocar tripChance a 0.26 escalado por distancia; (d) anadir T_WATER (id 10) usando el mismo codigo de colocacion que T_HAZARD, 2-4 charcos por nivel; (e) SUSTITUIR POR COMPLETO los arrays de arte de tile y el TMAP.

TAMANO: TS=24. Rejilla maxima 44x88 tiles = 1056x2112 px de mundo. Salas de 15x17 tiles = 360x408 px (esta es la medida que obliga a REACH=288). Pasillos de 3 tiles = 72px.

ARTE NUEVO — celdas fuente de 12x12 horneadas a escala 2 = tiles de 24px. Se anaden juntas de placa horizontales y remaches en vez de ruido: a TS=24 con escala 2 cada pixel de arte son 2 px de pantalla, asi que el ruido fino parpadearia al hacer scroll mientras que las lineas gruesas de placa se mantienen estables.
```js
const A_WALL=[            // placa metalica remachada, juntas horizontales
  '444444444444','433333333334','43r22222r234','432222222234',
  '432222222234','444444444444','433333333334','43r22222r234',
  '432222222234','432222222234','433333333334','444444444444',
];
const A_FLOOR=[           // cubierta oscura con junta central sutil
  '555555555555','566666666665','566666666665','567777777765',
  '566666666665','566666666665','555555555555','566666666665',
  '566666666665','567777777765','566666666665','555555555555',
];
const A_GRATE=[           // rejilla de pasarela: lee como agujeros
  '888888888888','899889988998','899889988998','888888888888',
  '899889988998','899889988998','888888888888','899889988998',
  '899889988998','888888888888','899889988998','888888888888',
];
const A_PIPE_V=[          // tramo de tuberia vertical sobre la pared
  '4bbccddccbb4','4bbccddccbb4','4bbccddccbb4','444444444444',
  '4bbccddccbb4','4bbccddccbb4','4bbccddccbb4','4bbccddccbb4',
  '444444444444','4bbccddccbb4','4bbccddccbb4','4bbccddccbb4',
];
const A_LADDER=[          // peldanos, claramente trepable
  '44ee4444ee44','44ee4444ee44','44eeeeeeee44','44ee4444ee44',
  '44ee4444ee44','44eeeeeeee44','44ee4444ee44','44ee4444ee44',
  '44eeeeeeee44','44ee4444ee44','44ee4444ee44','44eeeeeeee44',
];
const A_VENT=[            // rejilla de ventilacion embutida en la placa
  '444444444444','433333333334','4ffffffffff4','433333333334',
  '4ffffffffff4','433333333334','4ffffffffff4','433333333334',
  '4ffffffffff4','433333333334','4ffffffffff4','444444444444',
];
const A_WATER=[           // NUEVO T_WATER id 10: charco de refrigerante
  '555555555555','5kkkkkkkkkk5','5klllllllkk5','5kllmmmllkk5',
  '5klmmmmmlkk5','5klmmmmmlkk5','5kllmmmllkk5','5klllllllkk5',
  '5kkkkkkkkkk5','5klllllllkk5','5kkkkkkkkkk5','555555555555',
];
const A_EXIT=[            // el UNICO verde del juego
  '444444444444','4gggggggggg4','4ghhhhhhhhg4','4gh444444hg4',
  '4gh4gggg4hg4','4gh4gggg4hg4','4gh4gggg4hg4','4gh4gggg4hg4',
  '4gh444444hg4','4ghhhhhhhhg4','4gggggggggg4','444444444444',
];
const TMAP={
  '2':PAL.metal,     '3':PAL.metalMid,  '4':PAL.metalDark, 'r':PAL.metalEdge,
  '5':PAL.floorDark, '6':PAL.floor,     '7':PAL.floorLit,
  '8':PAL.grateEdge, '9':PAL.grate,
  'b':PAL.pipeDark,  'c':PAL.pipe,      'd':PAL.pipeLit,
  'e':PAL.rustLit,   'f':PAL.void1,
  'g':PAL.lampGreen, 'h':PAL.void2,
  'k':PAL.coolDeep,  'l':PAL.cool,      'm':PAL.coolLit,
};
```
REGLA DE CONTRASTE: el pixel de tile mas brillante en cualquier parte es PAL.metalEdge #4a5866. El tono medio de la criatura #8e1224 y las batas #cdd6e0 estan AMBOS por encima, asi que criatura y presa son siempre lo mas brillante en pantalla.

DISTRIBUCION ESPACIAL DE LA ESCALADA: el generador BSP ya calcula distancia BFS a la salida. Ordenar las salas por esa distancia y colocar enemigos por peso de forma que la mitad LEJANA del nivel contenga el 70% de las unidades armadas. Ella siempre viaja de seguro a peligroso, asi que la fantasia corre matadero -> resistencia -> huida en ese orden en todos y cada uno de los niveles.

COMPOSICION GARANTIZADA EN LA APARICION (ampliar la garantia de apertura existente de spawnEnemies, que ya fuerza 2 cientificos a la vista): aparece 2 tiles POR DEBAJO de un techo con 5+ tiles de espacio vertical libre, en una sala de al menos 8 tiles de ancho — la camara lee como una celda de contencion. Detras de ella un TANQUE DE CONTENCION ROTO: decoracion a medida de 3x4 tiles de cristal roto y una abertura oscura, con gore pre-estampado en radio de 90px. Vino de ahi. Nadie lo dice. TRES cientificos (subir L.openingScientists de 2 a 3), cada uno en un estado DISTINTO: uno a 200px ya en ST_PANIC corriendo, uno a 330px ya en ST_ALARM corriendo hacia el panel, uno a 420px ya en ST_DOOR golpeando una puerta cerrada. CERO enemigos armados a menos de 600px. world.mercy = 1.2s.

CANALIZACION DE FASE 2: los tiles T_DOOR se CIERRAN 600ms en oleadas y se quedan cerrados en la ruta que ella no ha tomado, embudandola hacia adelante. Nunca puede dejar el nivel sin salida porque shatterWall (ejecutor) y el tier 3 (romper T_SOLID fluyendo a >400px/s) abren agujeros.

## Iluminacion

BUFFER DE LUZ A MEDIA RESOLUCION + UN SOLO BLIT DE MULTIPLICACION. COSTE TOTAL MEDIDO: 1.84 ms de los 16.67 ms de presupuesto = 11% del frame.
DESGLOSE MEDIDO: limpiar+preparar el buffer a media resolucion 0.54 ms; 14 blits de lampara 0.215 ms; multiplicacion final a resolucion completa 1.08 ms. Costeado contra una tasa de relleno compuesto conservadora de 600 MPix/s para un Adreno 612 a traves de WebView.

POR QUE MEDIA RESOLUCION ES TODO EL TRUCO: el campo de luz es de baja frecuencia, asi que dividir su resolucion por dos es visualmente gratis, pero recorta la acumulacion aditiva cara a una cuarta parte — 0.162 MPix en vez de 0.648. Solo la multiplicacion final corre a resolucion completa, y eso es un unico pase de 1.08 ms. Esto NO es un pase por pixel: no hay ningun bucle de JS sobre pixeles en ningun sitio, solo llamadas drawImage que gestiona la GPU.

PROCEDIMIENTO POR FRAME, DESPUES de dibujar mundo + criatura: (1) limpiar el buffer al color de oscuridad ambiente; (2) acumular lamparas aditivamente con 'lighter' en coordenadas de media resolucion, con culling por rectangulo; (3) inyectar la luz propia de la criatura; (4) UNA multiplicacion a resolucion completa sobre la escena.
```js
let LB=null, LBC=null;      // buffer de luz (media resolucion)
let LAMP=null;              // sprites radiales horneados, por color

function bakeLights(){
  if(LAMP) return;
  LAMP={};
  const COLS={ warm:'#ffb45a', red:'#ff2d3a', cold:'#7fd4ff', green:'#4ade9a' };
  for(const k in COLS){
    const R=64, cv=document.createElement('canvas');
    cv.width=cv.height=R*2;
    const c=cv.getContext('2d');
    const img=c.createImageData(R*2,R*2), d=img.data;
    const h=COLS[k], cr=parseInt(h.substr(1,2),16),
          cg=parseInt(h.substr(3,2),16), cb=parseInt(h.substr(5,2),16);
    for(let y=0;y<R*2;y++)for(let x=0;x<R*2;x++){
      const dx=x-R, dy=y-R, dist=Math.sqrt(dx*dx+dy*dy)/R;
      const a=dist>=1?0:(1-dist*dist);      // llega EXACTAMENTE a 0 en el borde
      const i=(y*R*2+x)*4;
      d[i]=cr*a; d[i+1]=cg*a; d[i+2]=cb*a; d[i+3]=255;  // aditivo: alpha 255
    }
    c.putImageData(img,0,0);               // UNA vez al cargar, jamas por frame
    LAMP[k]=cv;
  }
}

function rebuildLightBuffer(vw,vh){
  LB=document.createElement('canvas');
  LB.width=vw>>1; LB.height=vh>>1;
  LBC=LB.getContext('2d',{alpha:false});
  LBC.imageSmoothingEnabled=false;
}

function applyLighting(g,L,wcam,vw,vh,alarmT,creatureX,creatureY){
  const c=LBC, cx=wcam.x, cy=wcam.y;
  c.globalCompositeOperation='source-over';
  c.fillStyle = alarmT>0 ? '#2a0d12' : '#141a22';   // bano rojo durante la alarma
  c.fillRect(0,0,LB.width,LB.height);
  c.globalCompositeOperation='lighter';
  for(let i=0;i<L.nLamps;i++){
    const lp=L.lamps[i];
    const sx=(lp.x-cx)*0.5, sy=(lp.y-cy)*0.5, r=lp.r*0.5;
    if(sx<-r||sy<-r||sx>LB.width+r||sy>LB.height+r) continue;  // culling
    const s=LAMP[lp.col];
    const k=lp.flicker?r*(0.92+0.08*Math.sin(lp.t*23)):r;      // parpadeo: escalar, no re-hornear
    c.drawImage(s, sx-k, sy-k, k*2, k*2);
  }
  c.drawImage(LAMP.red,(creatureX-cx)*0.5-28,(creatureY-cy)*0.5-28,56,56);
  c.globalCompositeOperation='source-over';
  g.globalCompositeOperation='multiply';
  g.drawImage(LB,0,0,LB.width,LB.height,0,0,vw,vh);
  g.globalCompositeOperation='source-over';   // RESTAURAR SIEMPRE
}
```

LA CAIDA CUADRATICA 1-d*d LLEGA EXACTAMENTE A 0 EN EL BORDE DEL SPRITE. Verificado, y es obligatorio: una caida que se detiene en un alpha distinto de cero deja costuras cuadradas visibles alli donde dos sprites de lampara se solapan.

NUNCA llamar createRadialGradient ni putImageData por frame. Se hornean 4 variantes de color al cargar (warm/red/cold/green) a 128x128.

AMBIENTE: #141a22 normal, #2a0d12 durante alarma. Todos los valores de entorno estan por debajo del 38% de luminancia precisamente para que la multiplicacion tenga margen para oscurecer mas sin aplastar a negro puro.

PULSO DE ALERTA: las lamparas de emergencia rojas pulsan a 0.8 Hz en alert 1 y a 1.4 Hz en alert 2+. Es un cambio del radio del blit (lp.r escalado por el pulso), no un re-horneado.

NUMERO DE LAMPARAS: ~14 visibles a la vez tras el culling. Colocacion: una lampara de emergencia roja (emerRed, r 90-130px) por sala grande, lamparas calidas (lampWarm, r 70px) en maquinaria y consolas, frias (lampCold, r 60px) en tanques y monitores, y UNA verde (lampGreen) en la salida y solo ahi.

SUPERVIVENCIA A LA ROTACION — tres cosas se rompen y solo tres: (1) EL BUFFER DE LUZ esta dimensionado a la pantalla y DEBE reasignarse en el callback onRotate, no por frame. Es la regresion de rotacion mas probable de todo el juego porque un buffer obsoleto SIGUE DIBUJANDO, solo que estirado al aspecto equivocado — un bug que sobrevive a las pruebas en una sola orientacion. (2) Cualquier vineta o overlay de pantalla completa horneado se rompe: NO hornear ninguno. Si se quiere vineta, se expresa como cuatro sprites radiales oscuros adicionales blitados en las esquinas del buffer de luz, que son independientes del aspecto por construccion y cuestan 4 blits extra, holgadamente dentro de los 0.215 ms medidos para 14 lamparas. (3) Las posiciones de UI tactil se recalculan. El arte de tiles, la criatura, los tentaculos, la capa de sangre y el canvas de nivel estan TODOS en espacio de MUNDO y no les afecta la rotacion en absoluto.

setVirtual() reasigna canvas.width, lo que resetea TODO el estado del contexto 2D incluido imageSmoothingEnabled (core.js lo restaura, correctamente) pero tambien globalCompositeOperation, fillStyle y globalAlpha. Poner las operaciones de composicion localmente en cada dibujo y restaurarlas; NUNCA depender de estado fijado en init. Un 'lighter' o 'multiply' fugado corrompe en silencio todo dibujo posterior incluidos el HUD y la fuente, y el sintoma (texto lavado o invisible) parece no tener nada que ver con la iluminacion.

## Sensacion de matar

UN BOTON, UN VERBO, TRES RESULTADOS. Todos los tiempos en ms; el motor corre a 1/60 = 16.67 ms/frame, asi que cada numero es un multiplo de ~16.67 redondeado al frame.

LINEA DE TIEMPO DE AGARRE — la toma estrella. Total 617 ms de la pulsacion al cadaver en reposo, PERO EL JUGADOR RECUPERA EL CONTROL A LOS 300 ms.

t=0 ms (frame 0) PULSACION. Se lanzan 3 tentaculos (R.fire x3 con separacion angular -0.35, 0, +0.35 rad alrededor del objetivo). Se pone e.grip=1, e.gripT=0 INMEDIATAMENTE — el enemigo deja de actualizarse este mismo frame, y por eso el agarre lee como instantaneo. Sonido de alcance: sfx({type:'noise', f0:2600, f1:900, dur:0.07, vol:0.18}) — un latigazo humedo, sin tono. SIN hitstop todavia.

t=0-100 ms (frames 0-6) ALCANCE. Las puntas interpolan hacia el enemigo a 1500 px/s, asi que un alcance de 150px aterriza en 100 ms y uno de 60px en 40 ms. Se dibujan en BLOOD_MID en cuanto se mojan. Durante el alcance la victima ya esta congelada pero reproduce una animacion de FORCEJEO de 2 frames (brazos arriba, e.frame^=1 cada 50 ms) — congelarlo PERO animarlo es lo que hace que el agarre lea como una captura y no como un aturdimiento.

t=100 ms (frame 6) CONTACTO. Este es el golpe que mas tiene que pegar.
  this.freeze = 0.067 (4 frames de hitstop — NO mas: el canon topa en 11 frames y esto es solo el agarre, no la muerte).
  cam.shake(4, 0.12).
  vibrate(22).
  sfx({type:'noise', f0:1200, f1:300, dur:0.09, vol:0.30}) — el golpe de carne.
  G.sprayPulse(this.spray, e.x, e.y, dx, dy, 4, rnd) — un primer mordisco pequeno, NO el chorro arterial todavia. Retener el chorro grande 200 ms es lo que hace que se sienta como un desgarro y no como un reventon.

t=100-300 ms (frames 6-18) FORCEJEO. 200 ms, y no es negociable: es la ventana donde el jugador VE que atrapo a una persona.
  La victima es arrastrada hacia el cuerpo a 320 px/s a lo largo del tentaculo.
  Tiembla: e.x += Math.sin(e.gripT*54)*3 — un temblor de 8.6 Hz y 3px de amplitud, visible al upscale x2, no un borron.
  Grita: sfx({type:'saw', f0: 420+rnd()*160, f1: 180, dur:0.22, vol:0.26}) disparado UNA VEZ a t=115 ms. Sierra, no pulso: tiene que sonar organico contra el zumbido de onda cuadrada del laboratorio.
  1 tentaculo se re-agarra a una pared cercana para que el cuerpo siga fluyendo; ELLA NUNCA DEJA DE MOVERSE durante una muerte. Si todos los tentaculos se comprometieran con el agarre, el movimiento se pararia 300 ms y el juego entero se sentiria como un QTE.
  EL CONTROL DEL JUGADOR VUELVE A t=300 ms aunque el desgarro siga reproduciendose.

t=300 ms (frame 18) EL DESGARRO. Todo dispara en un frame:
  this.freeze = 0.15 (9 frames — el grande, bajo el tope de 11).
  this.slowT = 0.30; this.slowScale = 0.30 — 300 ms al 30% de tiempo DESPUES de que suelte el freeze, asi el chorro traza su arco a camara lenta y el jugador contempla su propia violencia.
  cam.shake(8, 0.32).
  vibrate([0,55,35,95]) — el patron de dos pulsos existente, que lee como 'rasgar, luego chapotear'.
  G.spawnDebris(this.debris, e.x, e.y, 6, dx, dy, rnd) — 6 piezas, la cuenta 'grande'.
  G.sprayPulse(..., 8, rnd), luego el pulse2 existente a +60 ms (6 particulas) y pulse3 a +120 ms (5). El latido de tres pulsos que ya esta en symbiote.js:onKill es correcto: se mantiene literal.
  G.stampPool(this.gore, e.x, e.y, tx, ty, L.w, rnd).
  SONIDO DE DOS CAPAS: sfx({type:'noise', f0:900, f1:120, dur:0.28, vol:0.42}) (el desgarro) Y a +40 ms sfx({type:'tri', f0:70, f1:40, dur:0.30, vol:0.34}) (un golpe de sub-graves). El seno bajo debajo del ruido es lo que lo hace pesado en un altavoz de telefono que no puede reproducir graves: el cuerpo del telefono zumba y la haptica cubre el resto.
  B.bloodiness += 0.20 — la criatura enrojece visiblemente.
  Se libera al enemigo, los tentaculos entran en T_RETRACT.

t=300-617 ms CADAVER. Los escombros trazan su arco bajo gravedad dentro de la camara lenta al 30% durante 300 ms y luego reanudan; las piezas aterrizan, updateDebris ya estampa rastros y posiciones de reposo. La camara lenta acaba a 600 ms. La capa de sangre es permanente.

POR QUE 300 ms DE FORCEJEO: por debajo de 180 ms la victima lee como un efecto de particulas; por encima de 400 ms el jugador se siente secuestrado. 300 ms con el control devuelto en el desgarro es la ventana donde ves a la persona, oyes el grito, y ya estas fluyendo hacia el siguiente.

LINEA DE ATURDIMIENTO (ejecutor / cualquier grabbable:false): alcance 0-100 ms identico, luego a 100 ms freeze=0.05, cam.shake(3,0.1), e.stagger=0.5, W.damageEnemy(e,25,true), sfx mas sordo {type:'noise', f0:600, f1:200, dur:0.12, vol:0.28}. SIN chorro, SIN escombros. La ausencia de gore ES la senal didactica.

LINEA DE LATIGAZO (sin objetivo): 2 tentaculos barren un arco de 0.9 rad en 130 ms a 1400 px/s, haciendo 40 a lo que crucen (reutilizando la puerta de velocidad de tentacleHits), rompiendo T_GLASS, y estampando sangre si la punta cruza un tile ensangrentado. sfx({type:'noise', f0:3000, f1:1400, dur:0.06, vol:0.14}). Coste: nada. Tiene que sentirse como que la criatura siempre esta azotando.

```js
const K_REACH = 0.100, K_TEAR = 0.300, K_END = 0.617;
const GRAB_R = 150, GRAB_CONE = 0.85;

pickTarget(dirX, dirY) {
  const B = this.B, L = this.L;
  let best = null, bestScore = 1e9;
  for (let i = 0; i < this.enemies.n; i++) {
    const e = this.enemies.items[i];
    if (e.dead || e.grip) continue;
    const dx = e.x - B.x, dy = e.y - B.y;
    const d = Math.hypot(dx, dy);
    if (d > GRAB_R || d < 1) continue;
    const dot = (dx / d) * dirX + (dy / d) * dirY;
    const inCone = dot > Math.cos(GRAB_CONE) ? 1 : 0;
    const soft = (e.st === 2 || e.st === 3 || e.st === 4) ? 1 : 0;   // TRIP/COWER/ALARM
    const score = d - 60 * inCone - 90 * soft;
    if (score < bestScore && W.lineOfSight(L, B.x, B.y, e.x, e.y)) { bestScore = score; best = e; }
  }
  return best;                                  // el llamador guarda best.uid, NUNCA el indice
}

stepGrab(dt) {
  const e = W.findByUid(this.enemies, this.grabUid); if (!e) { this.grabUid = -1; return; }
  this.grabT += dt;
  const t = this.grabT, B = this.B;
  const dx = e.x - B.x, dy = e.y - B.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;

  if (t < K_REACH) { e.grip = 1; return; }
  if (!this.grabHit) {
    this.grabHit = 1;
    this.freeze = 0.067; cam.shake(4, 0.12); vibrate(22);
    sfx({ type:'noise', f0:1200, f1:300, dur:0.09, vol:0.30 });
    G.sprayPulse(this.spray, e.x, e.y, ux, uy, 4, this.rnd);
    sfx({ type:'saw', f0: 420 + this.rnd() * 160, f1:180, dur:0.22, vol:0.26 });
  }
  if (t < K_TEAR) {
    e.x -= ux * 320 * dt; e.y -= uy * 320 * dt;
    e.x += Math.sin(t * 54) * 3;
    e.animT += dt; if (e.animT > 0.05) { e.animT = 0; e.frame ^= 1; }
    return;
  }
  e.grip = 0; e.dead = 1;
  this.onKill(e, -ux, -uy, true);               // onKill ya hace freeze/shake/spray
  this.enemies.free(e);
  this.grabUid = -1; this.grabT = 0; this.grabHit = 0;
}
```
EL HITSTOP VIVE DENTRO DE update() COMO ESTADO INTERNO, NUNCA COMO UN RETURN TEMPRANO: el acumulador de paso fijo del motor sigue corriendo, y salir pronto de update no para el reloj — produce un tiron, no una congelacion. El patron this.freeze que ya existe en symbiote.js es correcto: copiarlo literalmente.

## Entidades

### E_SCIENTIST (id 0) (Presa. Es la biomasa, la curacion y todo el contenido emocional del juego. NO PUEDE HACER DANO NUNCA: damage: 0 en TODOS los estados, incluidos ST_SURRENDER y ST_DOOR, para siempre. El momento en que la presa puede herirla, la fantasia de poder se invierte y todo el diseno se derrumba. Solo puede costarle la alarma.)

**Comportamiento:** MANTENER la maquina existente de sym-world.js (ST_IDLE/PANIC/TRIP/COWER/ALARM con contagio) — ya es buena y esta verificada. ST_IDLE: camina entre hx y bx a 30px/s (walk 60 reducido a la mitad para lectura); pasa a ST_PANIC (o ST_ALARM) via scare() cuando la criatura esta a <=180px CON linea de vision. CONTAGIO 260px con alertT escalonado de 180ms para que la sala se vacie como una ola visible — es lo mejor del archivo actual, no tocarlo. ST_PANIC: corre en linea recta huyendo a 176px/s, re-apuntando cada 250ms; empuja a otros cientificos a menos de 18px (impulso 80px/s, 50% de tropezarlos); cada 600ms tira el dado de tropiezo. CAMBIO: tripChance sube de 0.18 a 0.26 Y se ESCALA POR DISTANCIA: p = min(0.55, 0.26*(1 + (1 - min(1, dist/260)))). A un 18% plano la ventana de misericordia dispara sobre todo cuando ella esta lejos y no puede cobrarla, desperdiciando el mejor mecanismo del archivo. ST_TRIP: 700ms en el suelo. CAMBIO: ahora GATEA hacia atras a 34px/s alejandose de ella mientras la MIRA (face volteada hacia la criatura). Un tropiezo inmovil lee como un bug; un gateo lee como terror. pickTarget lo puntua -90 asi que ella se engancha a el: el juego premia perseguir al que cayo. ST_COWER: se entra cuando el raycast de panico choca con una pared a menos de 40px; vx=0, la mira. NUEVO: tras 900ms en ST_COWER se DESLIZA por la pared (sprite y +2px) y se cubre la cabeza, animacion propia de 2 frames. Nunca sale de este estado. Es puntuacion gratis y el jugador debe sentir la misericordia que el no recibe. ST_ALARM: 35% de probabilidad al asustarse si hay una alarma sin usar a menos de 520px; corre a 192px/s y luego pulsa 900ms. Matarlo a media pulsacion cancela la alarma. NUEVO: rampa de audio durante los 900ms — sfx({type:'pulse', duty:0.5, f0: 300 + 500*(e.animT/0.9), dur:0.06, vol:0.18}) cada 150ms = 6 pitidos de tono ascendente. Es la senal 'paralo YA' mas clara del juego y cuesta 6 voces en 900ms. NUEVO ST_DOOR (id 22): 12% al asustarse si hay un T_DOOR a menos de 300px. Corre hacia el a 176px/s y GOLPEA la puerta: animacion de 2 frames a 8Hz, sfx({type:'noise', f0:400, f1:200, dur:0.05, vol:0.20}) cada 250ms, para siempre. Nunca la abre. Es teatro puro y es la imagen de las capturas. Barato: es ST_ALARM con otro objetivo y sin condicion de exito. NUEVO ST_SURRENDER (id 23): 8%, solo cuando world.alert>=2 y la criatura esta a menos de 120px con LOS. Se para, cae de rodillas, la mira de frente, brazos en alto, temblor de 2 frames. Muerte gratis. Aproximadamente uno por nivel; es el momento en que la fantasia de poder se dice en voz alta sin una palabra de dialogo. LIMITADOR DE GRITOS OBLIGATORIO: al entrar en ST_PANIC suena sfx({type:'saw', f0: 380+rnd()*200, f1:220, dur:0.14, vol:0.20}) pero LIMITADO globalmente a 2 cada 300ms con un contador de modulo. MAX_VOICES es 12 en audio.js (verificado, linea 7) y scare() puede despertar 6 cientificos en un frame: 6 saws mas las capas noise+tri de la muerte revientan el tope y silencian en el momento el sonido del desgarro, que es el unico que no puede faltar.

**Visual:** Caja 16x26, sprite 20x28. Bata coat #cdd6e0 (el valor mas alto del juego junto con la carne: SIEMPRE es de lo mas brillante en pantalla), piel skin #e8b48c, visor/gafas visor #4de0f0 (unico acento frio en un personaje). Luz de borde de 1px en el lado que mira a la lampara mas cercana, dibujada como 4 fillRect en PAL.coat: 4 llamadas por enemigo, ~40/frame con 10 enemigos. A 540x1200 sobre un panel de 1080x2400 un px virtual = 2 px de dispositivo, asi que una luz de borde de 1px es una linea limpia de 2px: visible sin ser tosca.

**Stats:** hp 10, w16 h26 sw20 sh28, walk 60 px/s (30 efectivo en IDLE), panic 176 px/s, alarmRun 192 px/s, damage 0 SIEMPRE, weight 50 (el mas comun), healYank 6, tripChance 0.26 escalada a max 0.55, tripTime 0.70s, alarmChance 0.35, alarmRange 520px, scareRange 180px, contagion 260px, pressTime 0.90s, grabbable true, firstLevel 0. Cantidad por nivel: 4+d. BIOMASA: +18 por muerte de agarre, +10 por latigazo (el agarre vale MAS: la jugada espectacular es la eficiente). CURACION: +6 hp.

### E_GUARD (id 1) (Primera resistencia armada. Ensena que hay cosas que disparan y que el telegrafo se puede leer.)

**Comportamiento:** MANTENER todos los numeros de la tabla actual — son correctos y costaron trabajo. ST_PATROL -> ST_SUSPECT (retencion 1.2s) al oir a 80px o ver dentro del cono de 200px/35 grados -> ST_AIM (telegrafo 420ms) -> ST_FIRE (rafaga de 3, separacion 140ms, bala a 300px/s) -> ST_RECOVER (1.60s). Aturdimiento 0.50s. Se cubre con probabilidad 0.40, pide refuerzos tras 2.0s. INVARIANTES QUE SE CONSERVAN: como maximo 2 guardias en ST_AIM a la vez, RECONTADOS cada frame (nunca un contador mutable — el comentario existente sobre esa fuga es correcto); guardias fuera de pantalla congelados en ST_SUSPECT; vector de puntería BLOQUEADO al final del telegrafo y jamas actualizado. Aviso total a 100px: 420ms de telegrafo + 333ms de vuelo de bala = 753ms; a 200px son 1087ms.

**Visual:** Caja 16x26, sprite 20x28. Uniforme sobre metal oscuro con luz de borde de 1px en coat #cdd6e0; el destello del canon en el telegrafo es el unico rojo permitido en un enemigo (emerRed #ff2d3a, 3px, pulsando a 6Hz durante los 420ms).

**Stats:** hp 50 (SUBIDO de 45: asi un solo latigazo de 40 nunca mata a un guardia, lo que preserva el agarre como la respuesta correcta a un enemigo armado), w16 h26 sw20 sh28, walk 92 px/s, repos 140 px/s, damage 22 por bala (rafaga de 3 = 66 en el peor caso), weight 26, healYank 12, visRange 200px, visHalfAngle 0.6109 rad (35 grados), hearRange 80px, telegraph 0.420s, burst 3, burstGap 0.140s, bulletSpeed 300 px/s, recover 1.60s, stagger 0.50s, coverFrac 0.40, backupDelay 2.0s, suspectHold 1.2s, grabbable true, firstLevel 1. Cantidad: d<1 ? 0 : min(6, d). GUARD_LIVE_CAP 6. BIOMASA +26, curacion +10.

### E_PYRO (id 3, SUSTITUYE a E_HAZMAT en la misma ranura) (LA ADICION PRINCIPAL. El fuego es el contra duro de un monstruo de carne y es lo que muestran las capturas. Ocupa el slot id 3 para que ENEMY_BY_ID, countFor y la rampa de aparicion no necesiten reestructurarse. Ataca el VERBO, no solo los hp: una criatura que solo pierde vida por fuego no le teme al fuego; una que no puede agarrarse a las paredes mientras arde, si.)

**Comportamiento:** ST_PATROL -> ST_TELEGRAPH (700ms: el piloto se aviva, un punto naranja de 3px en la boquilla pulsa a 6Hz, Y EL CONO SE DIBUJA como contorno naranja tenue durante los 700ms completos: ella ve el volumen exacto que va a arder antes de que arda) -> ST_ATTACK (1200ms de llama continua, vector de puntería BLOQUEADO al final del telegrafo, JAMAS sigue al objetivo) -> cooldown 2400ms. Tick de dano cada 200ms. TRES EFECTOS POR TICK: (1) 14 de dano si ella esta dentro del cono = 70 dps; (2) IGNICION: dos ticks dentro del cono (400ms) la prenden — 8 dps durante 3000ms, y mientras arde su fuerza de agarre cae un 35% (se sube la holgura de la restriccion en el paso de cuerdas durante los frames de quemadura) asi que literalmente no puede sujetarse; (3) DESTRUYE ANCLAS: cada tile que cruza el cono queda inagarrable 4000ms — se reutiliza foamTile/foamBlocks TAL CUAL, solo se retinta de naranja y se renombra. TANQUE DE COMBUSTIBLE: cuadrado amarillo de 6x6 px en la espalda, hitbox separada de 8px. Un impacto de punta de tentaculo en el tanque hace 999. EXPLOTA: cam.shake(9,0.4), radio 90px, 45 de dano a TODO enemigo dentro INCLUIDA ella si esta dentro, spawnDebris 8 piezas, y el tile queda chamuscado. Matar un pyro dentro de un escuadron de guardias es la mejor jugada del juego. INVARIANTE R2: no se compromete a atacar si no esta wcam.contains(e.x,e.y,16). INVARIANTE R4: como maximo 1 pyro en ST_ATTACK a la vez, recontado cada frame. TRES RESPUESTAS DE ELLA, todas descubribles sin texto: (1) AGUA — cada nivel genera 2-4 charcos de refrigerante (nuevo tile T_WATER id 10, transitable); pasar por uno apaga la quemadura al instante y da 1500ms de inmunidad al fuego, mostrado como vapor azul saliendo del cuerpo; el BSP ya coloca charcos T_HAZARD, T_WATER usa el mismo codigo de colocacion con otro tile. (2) EL TANQUE — ver arriba. (3) FLANQUEO — los 700ms de telegrafo mas el cono BLOQUEADO significan que fluir perpendicular a su velocidad normal despeja el cono de 24 grados en ~350ms. El fuego solo es letal para quien carga de frente por el medio.

**Visual:** Caja 18x28, sprite 22x30. Traje pesado en metalLit #36434f con visor visor #4de0f0. Tanque: cuadrado 6x6 de #ffd24a (amarillo, unico en el juego junto a la lampara calida — imposible de confundir). Llama: el cono se dibuja como 8 muestras radiales de fillRect en lampWarm #ffb45a con nucleo emerRed #ff2d3a, mas un blit de lampara calida en el buffer de luz que ilumina de verdad la sala.

**Stats:** hp 55 (BAJADO de 70: debe morir rapido una vez que ella pasa la llama, o la contra-jugada no tiene premio), w18 h28 sw22 sh30, walk 74 px/s, damage 14 por tick, tick 0.20s (= 70 dps dentro del cono), weight 10, telegraph 0.70s, coneRange 200px, coneHalfAngle 0.42 rad (24 grados), sprayTime 1.20s, cooldown 2.40s, igniteTicks 2, burnDps 8, burnTime 3.0s, gripLoss 0.35, tankR 8px, tankBlast 90px, tankDmg 45, scorchTime 4.0s, grabbable true, firstLevel 2. Cantidad: d<2 ? 0 : min(3, d-1). BIOMASA +30, curacion +10.

### E_TURRET (id 2) (Negacion de area estatica. Ensena que hay que romper la linea de vision, no correr mas rapido.)

**Comportamiento:** MANTENER SIN CAMBIOS. Barre un arco de 120 grados en 2.0s. ST_DETECT (500ms) -> ST_LOCK (320ms) -> ST_BEAM (800ms, tick cada 83.3ms) -> ST_COOL (1400ms). Pierde el objetivo tras 600ms sin LOS. Aviso total 820ms. Construida sobre el mismo contrato telegrafo-y-bloqueo que todo lo demas. yankKills: true — un tiron de tentaculo la arranca del techo.

**Visual:** Caja 22x22, sprite 24x24. Carcasa en metal #28323f, ojo en emerRed #ff2d3a que se abre de 1px a 5px durante DETECT/LOCK. El haz es una linea de 2px en fleshHot #ff4d63 con nucleo blanco de 1px.

**Stats:** hp 60, w22 h22 sw24 sh24, walk 0, damage 4 por tick a 12 ticks/s = 48 dps, weight 8, range 340px, sweepArc 2.0944 rad, sweepTime 2.0s, detect 0.50s, lock 0.320s, beam 0.80s, cool 1.40s, tick 0.0833s, losDrop 0.60s, grabbable true, yankKills true, firstLevel 3. Cantidad: d<3 ? 0 : min(4, d-2). BIOMASA +14, curacion +10.

### E_ENFORCER (id 4) (Excepcion a la regla de agarre. Es el unico enemigo que NO se puede arrebatar, y lo ensena en una sola pulsacion mediante la ausencia de sangre.)

**Comportamiento:** MANTENER SIN CAMBIOS. ST_PATROL -> ST_TELEGRAPH (700ms) -> ST_CHARGE (embestida a 520px/s durante 1100ms, alcance de inicio 320px) -> si choca con una pared: ST_STUN 1400ms y se auto-inflige 40 de dano Y ABRE UN AGUJERO con shatterWall (por eso el cierre de puertas de la fase 2 nunca puede dejar el nivel sin salida). Cooldown 1600ms. grabbable:false, yankImmune:true. Pulsar ataque sobre el ejecuta la LINEA DE ATURDIMIENTO: los tentaculos lo envuelven, el se los sacude, recibe 25 y queda aturdido 0.5s, con un sfx mas sordo y CERO gore. La falta de sangre es la senal didactica.

**Visual:** Caja 24x32, sprite 28x34. El unico enemigo mas grande que la criatura en tier 1. Blindaje en metalEdge #4a5866 (el valor mas alto permitido en el entorno) con juntas en metalDark #151b24; visor rojo apagado emerRedDim #8e1420 que se enciende a emerRed #ff2d3a durante el telegrafo de 700ms.

**Stats:** hp 120, w24 h32 sw28 sh34, walk 68 px/s, chargeSpeed 520 px/s, chargeTime 1.10s, damage 30, weight 6, healYank 0, telegraph 0.70s, wallStun 1.40s, wallSelfDamage 40, cooldown 1.6s, chargeRange 320px, grabbable false, yankImmune true, firstLevel 4. Cantidad: d<4 ? 0 : min(2, d-4). BIOMASA +40, curacion +10.

## Progresion

BIOMASA: medidor 0-100 que se llena con muertes y drena constantemente. SE REINICIA A 0 AL EMPEZAR CADA NIVEL. Es una curva de poder, no un arbol de mejoras guardado.

ECONOMIA (numeros exactos):
  cientifico por agarre +18, cientifico por latigazo +10 (el agarre vale MAS: la jugada espectacular es la eficiente)
  guardia +26, pyro +30, torreta +14, ejecutor +40
  DRENAJE: -3.5 por segundo, siempre. Tiene que seguir matando o encoge.
  CURACION (unica fuente; no hay recogibles): +6 hp por cientifico, +10 por muerte armada.

TRES TIERS:
  TIER 1 LARVA (biomasa 0-34): cuerpo 24px, 3 tentaculos con enfasis de agarre, GRAB_R 150, tope hp 100, velocidad de flujo base (MAXSPD 420), 1 ojo.
  TIER 2 BESTIA (35-74): cuerpo 34px, 4 tentaculos, GRAB_R 190, tope hp 130 (y gana 30 al instante al cruzar), velocidad +12% (MAXSPD 470), 3 ojos. NUEVA HABILIDAD: el agarre mata DOS objetivos si un segundo enemigo esta a menos de 60px del primero — la linea de desgarro corre UNA vez y mueren los dos.
  TIER 3 HORROR (75-100): cuerpo 44px, 6 tentaculos, GRAB_R 230, tope hp 160, velocidad +22% (MAXSPD 512), 5 ojos, y el cuerpo suelta un goteo constante de particulas de sangre. NUEVA HABILIDAD: rompe tiles T_SOLID fluyendo contra ellos por encima de 400 px/s — shatterWall ya existe, y el ejecutor ya ensenó que las paredes se rompen. En tier 3 deja de usar puertas.

ENCOGER: cruzar un limite de tier hacia abajo se anuncia con un chapoteo de 200 ms, una interpolacion de encogido del cuerpo de 250 ms, y un destello de vineta roja. Perder HORROR tiene que doler.

LECTURA VISUAL EN ORDEN DE PRIORIDAD (el jugador debe leer su tier a 3 metros en un telefono al sol):
  1. TAMANO: 24 / 34 / 44 px = rango de 1.83x, inconfundible.
  2. NUMERO DE TENTACULOS: 3 / 4 / 6 abriendose en abanico. Es la silueta Carrion y la senal mas reconocible.
  3. NUMERO DE OJOS: 1 / 3 / 5 puntos rojos.
  4. Un medidor bajo la barra de vida, 200x8 px, relleno en BLOOD_MID #b81322, con dos marcas al 35% y al 75%.

POR QUE SE REINICIA POR NIVEL: un arbol permanente haria el nivel 6 trivial para un buen jugador e imposible para uno malo, y haria que morir costara 20 minutos. Una curva por nivel da a cada sesion el arco completo de la fantasia de poder — de vulnerable a imparable en 2-4 minutos — y hace que la escalada de la fase 3 choque de frente con su poder creciente, que es exactamente la tension que necesita el diseno.

CERO RIESGO DE HITCH AL SUBIR DE TIER: el cuerpo es procedural (contorno radial), asi que subir de tier solo cambia b.base y el numero de tentaculos enfatizados. NO hay 12 canvas que hornear, y por tanto no hay tiron en el momento exacto en que se esta premiando al jugador.

```js
const TIER_BM = [0, 35, 75];
const TIER = [
  { r: 12, tents: 3, grab: 150, hp: 100, spd: 1.00, eyes: 1 },
  { r: 17, tents: 4, grab: 190, hp: 130, spd: 1.12, eyes: 3 },
  { r: 22, tents: 6, grab: 230, hp: 160, spd: 1.22, eyes: 5 },
];

feed(n) {
  const before = this.tier;
  this.biomass = Math.min(100, this.biomass + n);
  this.tier = this.biomass >= TIER_BM[2] ? 2 : this.biomass >= TIER_BM[1] ? 1 : 0;
  if (this.tier > before) {
    const T = TIER[this.tier];
    this.B.hpMax = T.hp; this.B.hp = Math.min(T.hp, this.B.hp + 30);
    this.growT = 0.25;
    cam.shake(6, 0.25); vibrate([0, 30, 40, 70]);
    SFX.powerup(); this.flash(this.tier === 2 ? 'HORROR' : 'BESTIA');
  }
}

stepBiomass(dt) {
  const before = this.tier;
  this.biomass = Math.max(0, this.biomass - 3.5 * dt);
  this.tier = this.biomass >= TIER_BM[2] ? 2 : this.biomass >= TIER_BM[1] ? 1 : 0;
  if (this.tier < before) {
    this.growT = -0.25;
    sfx({ type:'noise', f0:500, f1:120, dur:0.20, vol:0.26 });
    this.B.hpMax = TIER[this.tier].hp;
    this.B.hp = Math.min(this.B.hp, this.B.hpMax);
  }
}
```

ESCALADA DEL NIVEL — 150 s de juego previsto, tope duro a 240 s, conducida por UNA variable alert (0-3) que sube por SU PROPIA violencia mas un suelo temporal lento.
  FASE 0 COTO DE CAZA (0-30 s, alert 0): solo cientificos (4+d). Cero enemigos armados despiertos. Iluminacion roja tenue al 55% de ambiente. Sin musica, solo un zumbido industrial de 40 Hz y goteos. 3-5 muertes sin ningun riesgo.
  FASE 1 ALGUIEN LO NOTO (alert 1; primera alarma pulsada O t=40 s, lo que llegue antes): klaxon (SFX.alarm), TODAS las luces rojas pulsan a 0.8 Hz, L.alertLight=1. Los guardias pasan de patrulla a barrido activo hacia su ultima sala conocida. Empieza la musica: bucle de 2 pistas, bajo tri sobre pedal menor a 96 bpm mas un pulso de ruido — late como un corazon, no como una melodia. Los cientificos ahora aparecen ya en ST_PANIC: la sala ya esta corriendo antes de que ella entre.
  FASE 2 CIERRE (alert 2; 2 alarmas O t=90 s): los T_DOOR se cierran en oleadas de 600 ms y quedan cerrados en la ruta no tomada, embudandola. Despiertan los pyros. spawnReinforcements: 2 guardias en la puerta mas cercana cada 20 s, topado por GUARD_LIVE_CAP 6. La musica anade una tercera pista, arpegio de pulso duty 0.125; tempo 96 -> 112 bpm. Pulso de luces a 1.4 Hz.
  FASE 3 PURGA (alert 3; 3 alarmas O t=150 s): SE ACTIVA EL SISTEMA DE SUPRESION DE INCENDIOS. Boquillas en los techos emiten gas ardiendo en una banda de 2 tiles que barre el nivel desde el lado de entrada hacia la salida a 22 px/s. Estar dentro: 10 dps e ignicion instantanea. NO es un muro de muerte instantanea, es PRESION: se puede cruzar, solo duele. Despiertan torretas y ejecutores. Tempo 112 -> 128 bpm mas una segunda pista de ruido en semicorcheas. La flecha de salida empieza a pulsar en blanco.
  TOPE DURO a 240 s: la velocidad de barrido se dobla a 44 px/s. Sale o muere en ~40 s. Ningun nivel pasa de ~280 s.
  PUNTUACION: kills*base + timeBonus, con timeBonus = max(0, 300 - floor(t*2)); la velocidad se premia pero no se exige.
```js
stepAlert(dt) {
  const t = this.t;
  let want = this.alarmsUsed;
  if (t > 40 && want < 1) want = 1;
  if (t > 90 && want < 2) want = 2;
  if (t > 150 && want < 3) want = 3;
  if (want > this.alert) {
    this.alert = want; this.world.alert = want;
    SFX.alarm();
    this.flash(want >= 3 ? 'PURGA' : 'ALERTA ' + want);
    if (want >= 3) { this.purgeY = this.L.spawnY; this.purgeOn = 1; }
    if (want >= 1) playMusic(SONGS.symbiote[Math.min(want - 1, 2)]);
  }
  if (this.purgeOn) {
    const spd = t > 240 ? 44 : 22;
    this.purgeY += this.purgeDir * spd * dt;
    if (Math.abs(this.B.y - this.purgeY) < 24) this.burnTick(dt * 10);
  }
}
```

## Reuso de codigo

MANTENER ENTERO Y SIN TOCAR — sym-gore.js (285 lineas). El chorro arterial de tres pulsos, la capa persistente de espacio de mundo a media resolucion, los charcos que crecen via stampPool, los chorreones de pared y el reciclado de la particula mas vieja son exactamente correctos para Carrion y son el codigo mejor afinado del proyecto. Su paleta de sangre (#e01228 / #b81322 / #8e0f1c) ya cae dentro de la nueva banda de tono de carne, asi que ni siquiera necesita retocarse. ES SEGURO POR CONSTRUCCION FRENTE A LA ROTACION: makeGoreLayer dimensiona a Math.ceil(L.pxW/2) x Math.ceil(L.pxH/2) — dimensiones de NIVEL, jamas de pantalla — y stamp() escribe en coordenadas de mundo; drawGore recibe vw,vh como ARGUMENTOS y deriva su rectangulo fuente de camX/camY, asi que pasarle el nuevo VW/VH es toda la adaptacion necesaria. Si fuese de espacio de pantalla, un giro seria catastrofico de tres formas: (a) habria que reasignar el canvas al nuevo aspecto, destruyendo cada mancha jamas hecha; (b) sin reasignar, la sangre quedaria clavada a pixeles de pantalla y se deslizaria por el mundo al hacer scroll; (c) el contador poolGrid esta indexado por tile de mundo (ty*mw+tx) y se desincronizaria, dando el artefacto de diez circulos identicos contra el que avisa su propio comentario. NO reasignarlo en el callback de rotacion. NUNCA llamar getImageData sobre el (5-15 ms en un canvas con respaldo de GPU; su comentario ya avisa y es correcto) — para verificar que sobrevivio a un giro se comparan cv.width/cv.height y cuentas de estampas, no pixeles.

MANTENER — sym-world.js (2229 lineas), generador e IA. Se conservan: la generacion BSP, las tuberias, la alcanzabilidad BFS (1600 niveles, 0 salidas inalcanzables), WorldCam, el raycast DDA, lineOfSight, el pool de enemigos con disciplina de uid y findByUid, y las maquinas de estado completas de guardia/torreta/ejecutor. El generador y el renderizador ya estan limpiamente separados (drawLevel hace un unico drawImage de 9 argumentos desde un canvas de nivel pre-horneado; repaintTile parchea un tile), asi que una revision total de arte no toca nada de eso.
CAMBIOS EN sym-world.js, exactamente seis: (1) cambiar la ficcion de E_HAZMAT por E_PYRO en la MISMA ranura id 3, retintando foamTile/foamBlocks a naranja y renombrandolos a chamuscado — asi ENEMY_BY_ID, countFor y la rampa de aparicion no se reestructuran; (2) anadir ST_DOOR (22) y ST_SURRENDER (23), mas el gateo hacia atras en ST_TRIP y el deslizamiento por la pared en ST_COWER; (3) tripChance 0.18 -> 0.26 escalado por distancia hasta 0.55; (4) hp de guardia 45 -> 50 (para que un latigazo de 40 nunca lo mate y el agarre siga siendo la respuesta correcta a un armado); (5) anadir T_WATER (id 10) reutilizando el codigo de colocacion de T_HAZARD, 2-4 charcos por nivel; (6) SUSTITUIR POR COMPLETO los arrays A_* de arte de tile y el TMAP — la paleta clinica brillante (labWhite #f2f6f8, floor #e8ecf0) es la causa directa del choque tonal. Ademas ajustar la zona muerta de WorldCam.follow: DZW/DZH pasan de 108x240 fijos a Math.round(VW/6) x Math.round(VH/6) — ~1/6 del viewport en cada eje, que se reparte solo al girar sin ningun caso especial — manteniendo LOOK=88; los 108x240 actuales estaban afinados para un pendulo que ya no existe.

TIRAR LA LOCOMOCION DE sym-rope.js, CONSERVAR EL SOLVER. SE CONSERVA: rayTiles (el DDA de Amanatides-Woo, ampliando solo su tope de pasos a ceil(maxD/TS)+2), la estructura de arrays planos de makeRope, la integracion verlet, el bucle de restricciones de distancia con su guarda dd<1e-9, y la idea de drawTentacle (aunque el rasterizador se sustituye por el de pasos de medio grosor, que mide 43 fillRect por tentaculo frente a los 99 del paso por pixel).
SE BORRA POR COMPLETO: fire(), release(), la rama de columpio entera de step(), el modelo pendulo GRAV/SWING/AUTH, REEL_IN/REEL_OUT, B.attached, B.onGround, WALK, checkGround() y la rama de sweepBody que marca suelo. Cada uno de esos es un caso especial de la era pendulo y cada uno reintroduce una parada muerta — el checkGround en particular mataba la velocidad cada frame en los pasillos, algo que el propio codigo viejo ya tenia que rodear con excepciones para poder columpiarse.
CAMBIOS NUMERICOS EN EL SOLVER: SEG 14 -> 8, TENT_MAX 6 -> 12, REST 12 -> longitud de reposo ADAPTATIVA rl = max(4, dist(cuerpo,ancla)/(SEG-1)), SUB 2 -> 3, BODY_R 9 -> 10 probado al radio COMPLETO (quitar el fudge -2 de bodyBlocked, que dejaba al cuerpo visual solaparse con los muros).

REESCRIBIR symbiote.js. Es el pegamento y es donde vive el fallo. Cambio bloqueante en la linea 18: borrar `const VW = 540, VH = 1200;` (VERIFICADO leyendo el archivo) y sustituirlo por `import { VW, VH, ... } from '../core.js'` mas `const CANON_SHORT = 540, CANON_LONG = 1200;` usado SOLO en meta. Los exports de modulos ES son bindings VIVOS: sym-world.js ya importa VW/VH (linea 11) y por eso sus 17 usos ya son correctos frente a la rotacion; symbiote.js es el unico archivo que los congelo. De sus 10 usos: linea 51 meta (canonico, se queda), linea 69 el constructor de Button (capturado en init: DEBE moverse a relayout()), linea 303 el corte izquierda/derecha en VW*0.52 (se evalua por evento, se corrige solo), 342 drawGore(...,VW,VH) (por frame, se corrige solo), 378/380/382/383/398 texto de HUD (por frame, se corrigen solos). Se sustituyen Stick por el controlador de arrastre absoluto y el flujo de disparo/soltado por la maquina SNATCH.

CAMBIOS EN core.js: sustituir el bloque de rotacion por la version con baseLong/baseShort capturados al armar, flag force para que onRotate SIEMPRE dispare en el armado, isLandscape() leyendo screen.orientation.type (innerWidth miente a mitad de animacion), fit() en TODO resize aunque no cambie el aspecto, y el bucle de asentamiento de dos muestras iguales (SETTLE_MS=120, SETTLE_MAX=800) en vez del setTimeout(fitAndOrient,100) actual. Anadir export let lockFailed para que el fallo de screen.orientation.lock sea observable en tests.

CAMBIO EN main.js: dentro de sm.flush(), justo despues de setVirtual y ANTES de init(), llamar setRotatable(!!m.rotates, null). Asi salir de SYMBIOTE hacia el Menu o GameOver re-bloquea vertical de forma estructural aunque symbiote.destroy() no corriera. El juego vuelve a llamar setRotatable(true, cb) dentro de su propio init para instalar su callback.

CAMBIO EN AndroidManifest.xml: UNA sola linea. Borrar android:resizeableActivity="false" (linea 14). NO tocar android:screenOrientation — YA es "fullSensor" (linea 13, verificado) y configChanges YA incluye orientation|screenSize (linea 15), lo que significa que Android NO recrea la Activity al girar: el WebView se redimensiona en sitio, el heap de JS sobrevive y la partida continua. El brief se equivocaba al decir que estaba en "portrait". Cambiarlo a portrait haria que unlock() de JS fuese un no-op permanente y mataria la funcionalidad, porque ninguna API web puede ampliar el conjunto de orientaciones que permite el sistema operativo. La arquitectura correcta y ya presente es: manifest permisivo, JS restrictivo.

PLAN DE PRUEBAS (Puppeteer contra serve.js; se suplanta screen.orientation con evaluateOnNewDocument y se conduce el giro con page.setViewport): (A) tras setViewport(1080,2400) el backbuffer es 540x1200, tras setViewport(2400,1080) es 1200x540 — prueba que setVirtual corrio. (B) imageSmoothingEnabled === false inmediatamente despues de CADA giro — es la regresion de desenfoque silencioso y lo mas probable que se rompa, porque asignar canvas.width resetea el contexto entero. (C) view.scale es exactamente 2 en ambas y view.ox/oy son enteros. (D) instantanea de posicion del cuerpo, cuentas de pools, gore.cv.width/height, puntuacion y nivel antes y despues de 20 giros alternos: todo identico. (E) pointerdown, girar, y comprobar que el arrastre esta inactivo y el boton sin pulsar — prueba la correccion del dedo trabado. (F) 40 resizes rapidos cada 20 ms simulando la tormenta de animacion de MIUI y comprobar que setVirtual se invoco como maximo dos veces — prueba el debounce. (G) wcam.x <= L.pxW-VW y wcam.y <= L.pxH-VH tras un giro — prueba que el clamp de camara se recalculo y no blitea mas alla del canvas de nivel.

## Paleta

`REGLA MAESTRA 1: ningun color de entorno puede usar un tono en 340..20 grados. El rojo esta RESERVADO para carne, sangre y luces de alarma. Esa unica exclusividad de tono es lo que hace legible a la criatura sin ningun truco de contorno. Una sola calcomania roja de advertencia en una pared destruye el esquema.` `REGLA MAESTRA 2: todo valor de entorno <= luminancia de metalEdge #4a5866, para que la multiplicacion de iluminacion tenga margen de oscurecer sin aplastar a negro puro.` `REGLA MAESTRA 3: el tono medio de la carne #8e1224 es mas brillante que la pared mas brillante #4a5866 EN EL CANAL ROJO (0x8e=142 contra 0x4a=74). La carne siempre gana en rojo.` `VACIO (fondo mas profundo, zonas inalcanzables, interiores de tuberia): void0 #05070a, void1 #080b10, void2 #0d1119` `PLACA METALICA (paredes), azul-gris desaturado, 12-30% de luminancia: metalDark #151b24, metalMid #1e2733, metal #28323f, metalLit #36434f, metalEdge #4a5866` `SUELO / REJILLA, algo mas calido y oscuro que las paredes para que el ojo separe suelo de pared incluso sin luz: floorDark #12171d, floor #1a212a, floorLit #242d38, grate #0c1015, grateEdge #323d49` `TUBERIAS / MAQUINARIA, el unico acento frio, mantiene el laboratorio industrial: pipeDark #161d26, pipe #222c38, pipeLit #33414f, rust #5a3a28, rustLit #7d5236` `REFRIGERANTE (nuevo T_WATER, la contra al fuego; azul frio, jamas rojo): coolDeep #0e2733, cool #17455a, coolLit #2a7e9e` `FUENTES DE LUZ: emerRed #ff2d3a, emerRedDim #8e1420, lampWarm #ffb45a, lampCold #7fd4ff, lampGreen #4ade9a, tankYellow #ffd24a (solo el tanque del pyro)` `CARNE (banda de tono reservada, jamas usada por el entorno): fleshRim #3d0810, flesh #8e1224, fleshLit #c9203a, fleshHot #ff4d63, fleshVein #5e0d1a` `OJO: eye #ffe8a8, eyeDark #1a0206` `SANGRE (ya coincide con sym-gore.js: NO CAMBIAR): bloodFresh #e01228, bloodMid #b81322, bloodDeep #8e0f1c, mas los internos BLOOD_SHADOW #33060e y BLOOD_RIM #ff5566` `PRESA (debe destacar contra metal oscuro: bata de valor alto, visor frio): coat #cdd6e0, skin #e8b48c, visor #4de0f0` `AMBIENTE DEL BUFFER DE LUZ: normal #141a22, alarma #2a0d12` `SE ELIMINA POR COMPLETO la paleta clinica brillante actual de sym-world.js (labWhite #f2f6f8, floor #e8ecf0, etc.): es la causa directa del choque tonal con el look Carrion.`

## Juice

- HITSTOP EN TRES PESOS, nunca por encima de 11 frames salvo la muerte: contacto de agarre 0.067s (4 frames), desgarro 0.15s (9 frames), muerte propia 0.20s (12 frames, el unico sitio donde el tope se excede a proposito porque es el final de la partida). Vive DENTRO de update() como estado, jamas como return temprano.
- CAMARA LENTA DESPUES del freeze, no durante: slowT=0.30 a slowScale=0.30 tras el desgarro. El motor sigue a 60Hz asi que la latencia de entrada no cambia; solo se escala el dt que ve la fisica. El chorro traza su arco en camara lenta y el jugador contempla su propia violencia.
- SACUDIDA DE CAMARA escalonada: contacto 4/0.12s, desgarro 8/0.32s, explosion del tanque del pyro 9/0.4s, muerte propia 9/0.4s, subida de tier 6/0.25s, dano recibido 6/0.2s.
- HAPTICA como capa de graves que el altavoz del telefono no puede dar: contacto vibrate(22), desgarro vibrate([0,55,35,95]) que lee como 'rasgar, luego chapotear', pulsacion de ataque vibrate(12) EN EL MANEJADOR (mismo frame), subida de tier vibrate([0,30,40,70]), dano vibrate(70), muerte vibrate([0,90,60,140]).
- CHORRO ARTERIAL EN TRES PULSOS (el latido ya existente en symbiote.js:onKill, se mantiene literal): 8 particulas al desgarrar, 6 a +60ms, 5 a +120ms. El RITMO es lo que lo hace leer como arteria en vez de como nube de particulas.
- LA SANGRE ES PERMANENTE Y GRATIS: se estampa una vez en la capa persistente de espacio de mundo a media resolucion y despues cuesta cero para siempre — 500 manchas cuestan lo mismo que 5, un unico drawImage por frame. Tope de 40 estampas por frame para que una cadena de muertes no trabe el driver.
- CHARCOS QUE CRECEN: al tercer impacto en el mismo tile se estampa uno grande y la celda se marca -1 para que no siga creciendo. Sin esto, diez muertes son diez circulos identicos en vez de una escena del crimen.
- TENTACULOS QUE SE MOJAN: R.wet[i]=1.2s tras atravesar sangre; el miembro se repinta en bloodDeep/bloodMid en vez de fleshRim/fleshLit. La criatura se va tinendo de lo que mata.
- EL CUERPO ENROJECE: B.bloodiness +0.20 por desgarro, drenando a 0.02/s, expresado oscureciendo la carne hacia bloodDeep e inyectando salpicaduras de bloodFresh en la cascara media. Se limpia sola para que la siguiente muerte vuelva a notarse.
- ABOLLADURAS DEL CUERPO BLANDO: blobPull() hunde el radio de control en el angulo desde el que un tentaculo tira fuerte, propagando la mitad a los dos vecinos. Es lo que vende que la masa es blanda y no una pelota.
- APLASTAMIENTO AL PASAR POR HUECOS: sx/sy interpolados a 12*dt hacia los factores que mide el llamador; el area se conserva aproximadamente asi que lee como incompresible. Dos multiplicaciones, no otra rama de codigo.
- HILO DE ARRASTRE DIEGETICO: linea punteada de 1px (2px si, 5px no) del borde del cuerpo al dedo, alpha 0.10 + 0.22*mag, dibujada solo mientras se arrastra y solo en el tramo mas alla de la zona muerta, asi un dedo en reposo no dibuja nada.
- PIP DE ZONA MUERTA AUTODESTRUCTIVO: anillo de 12px en el dedo a alpha 0.15 que se desvanece en 0.25s en cuanto mag > 0. Ensena el gesto de parada en los primeros segundos y desaparece para siempre. Es la forma correcta de ensenar una zona muerta invisible.
- SESGO DEL ABANICO DE TENTACULOS: ~60% de los tentaculos libres alcanzan hacia la direccion de arrastre. Es la senal de intencion PRIMARIA, cuesta cero espacio de pantalla, y es animacion de personaje pura — el jugador lee la intencion del cuerpo de la criatura igual que en Carrion.
- PULSO DE LUZ DE ALERTA: 0.8 Hz en alert 1, 1.4 Hz en alert 2+, implementado escalando el radio del blit de lampara, jamas re-horneando.
- PARPADEO DE LAMPARA: r*(0.92+0.08*sin(t*23)) en las lamparas marcadas flicker. Un escalado, no un re-horneado.
- LUZ DE BORDE EN LA PRESA: 1px en PAL.coat en el lado que mira a la lampara mas cercana, 4 fillRect por enemigo. A x2 de upscale es una linea limpia de 2px.
- EL CUERPO SE DESINFLA AL MORIR: escala 1.0 -> 0.35 en 500ms mientras los tentaculos quedan flacidos — se para el solver de restricciones pero se deja la gravedad, y la cuerda verlet colapsando por su peso es una animacion de muerte genuinamente buena que sale GRATIS.
- DESTELLO DE ULTIMO ALIENTO: 300ms de blanco al 0.3 de alpha mas un tri grave cuando el golpe letal se convierte en 1 hp.
- DESTELLO INTERIOR DEL BOTON: 3px al arrebatar con exito. El anillo se rellena de alpha 0.30 a 0.85 conforme expira ATK_CD. Es la unica cromo de la pantalla — sin flechas, sin reticulas, sin numeros de cooldown, nada que lea como overlay de juego movil sobre el laboratorio oscuro.

## Audio

- REGLA DE VOCES: MAX_VOICES es 12 en audio.js (verificado, linea 7). Un contador de modulo LIMITA los gritos de panico a 2 cada 300ms, porque scare() puede despertar 6 cientificos en un frame y 6 sierras mas las capas noise+tri de la muerte revientan el tope y silencian el sonido del desgarro, que es el unico que no puede faltar. let _yellT=0,_yellN=0; function yelp(rnd,dt){ _yellT-=dt; if(_yellT<=0){_yellT=0.3;_yellN=0;} if(_yellN>=2)return; _yellN++; sfx({type:'saw',f0:380+rnd()*200,f1:220,dur:0.14,vol:0.20}); }
- ALCANCE DEL TENTACULO (t=0 del agarre): sfx({type:'noise', f0:2600, f1:900, dur:0.07, vol:0.18}) — latigazo humedo, sin tono.
- CONTACTO DE CARNE (t=100ms): sfx({type:'noise', f0:1200, f1:300, dur:0.09, vol:0.30}) — el golpe de carne.
- GRITO DE LA VICTIMA (t=115ms, una sola vez): sfx({type:'saw', f0:420+rnd()*160, f1:180, dur:0.22, vol:0.26}) — sierra, no pulso: tiene que sonar organico contra el zumbido de onda cuadrada del laboratorio.
- DESGARRO, CAPA 1 (t=300ms): sfx({type:'noise', f0:900, f1:120, dur:0.28, vol:0.42}).
- DESGARRO, CAPA 2 (t=340ms): sfx({type:'tri', f0:70, f1:40, dur:0.30, vol:0.34}) — el sub-graves debajo del ruido es lo que lo hace pesado en un altavoz de telefono sin graves; el cuerpo del telefono zumba y la haptica cubre el resto.
- ATURDIMIENTO DEL EJECUTOR: sfx({type:'noise', f0:600, f1:200, dur:0.12, vol:0.28}) — deliberadamente mas sordo que el desgarro.
- LATIGAZO SIN OBJETIVO: sfx({type:'noise', f0:3000, f1:1400, dur:0.06, vol:0.14}) — agudo, corto, barato. NUNCA silencio: un boton que a veces no suena lee como un boton roto.
- GRITO DE PANICO AL ENTRAR EN ST_PANIC: sfx({type:'saw', f0:380+rnd()*200, f1:220, dur:0.14, vol:0.20}), pasando SIEMPRE por el limitador yelp().
- CUENTA ATRAS DE LA ALARMA (durante los 900ms de pulsacion, cada 150ms, 6 pitidos): sfx({type:'pulse', duty:0.5, f0: 300 + 500*(e.animT/0.9), dur:0.06, vol:0.18}) — tono ASCENDENTE. Es la senal 'paralo YA' mas clara del juego.
- GOLPES EN LA PUERTA (ST_DOOR, cada 250ms, para siempre): sfx({type:'noise', f0:400, f1:200, dur:0.05, vol:0.20}).
- CRISTAL ROTO DE LA APERTURA (t=0 del nivel): sfx({type:'noise', f0:4200, f1:800, dur:0.22, vol:0.30}).
- SUBIDA DE TIER: SFX.powerup() existente.
- BAJADA DE TIER (chapoteo de encogido): sfx({type:'noise', f0:500, f1:120, dur:0.20, vol:0.26}).
- ULTIMO ALIENTO: sfx({type:'tri', f0:110, f1:70, dur:0.45, vol:0.38}).
- MUERTE PROPIA (t=200ms): sfx({type:'saw', f0:220, f1:40, dur:0.55, vol:0.40}) — un gemido humedo descendente.
- AMBIENTE FASE 0: zumbido industrial de 40 Hz mas goteos, sin musica.
- MUSICA FASE 1 (alert 1): bucle de 2 pistas, bajo tri sobre pedal menor a 96 bpm mas un pulso de ruido. Late como un corazon, no como una melodia.
- MUSICA FASE 2 (alert 2): anade tercera pista, arpegio de pulso duty 0.125; tempo 96 -> 112 bpm.
- MUSICA FASE 3 (alert 3): tempo 112 -> 128 bpm, anade segunda pista de ruido en semicorcheas.
- AUDIO Y HAPTICA EN EL MISMO FRAME: en el 'down' de ataque el sfx y vibrate(12) se disparan DENTRO del manejador de onInput, jamas en el siguiente update. 16.7 ms de retraso de audio se oyen como papilla en una pulsacion.
