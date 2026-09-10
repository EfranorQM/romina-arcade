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
| `js:EXPR` | evalúa una expresión y **imprime lo que devuelve** |
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
