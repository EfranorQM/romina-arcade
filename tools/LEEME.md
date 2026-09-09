# Previsualizar arte vectorial sin navegador

Sirve para **ver** lo que dibuja el código de un juego con `meta.smooth` (hoy
solo FURIA) sin abrir el celular ni compilar el APK.

```
node tools/capture.mjs "file:///ruta/absoluta/a/www/js/games/moto-art.js" > ops.json
python tools/raster.py ops.json salida.png [columnas]
```

`capture.mjs` ejecuta `drawBike()` contra un contexto 2D falso que **graba**
cada comando (paths, transformaciones, degradados) y los vuelca como JSON.
`raster.py` los rasteriza con PIL: supersampling x4, degradados lineales por
máscara, y arma una hoja con todas las poses etiquetadas.

Las poses a renderizar se editan en el array `poses` de `capture.mjs`.

## Por qué existe

El diseño de la moto se corrigió mirándola, no razonando sobre el código. Cada
defecto real (piloto del doble de tamaño, horquilla cuatro veces más gruesa de
lo debido, motor más claro que la carrocería, colín por debajo del asiento)
apareció al ver el PNG, y varios eran invisibles en el código.

**Trampa:** la primera versión del rasterizador ignoraba los degradados y los
pintaba gris plano. Se juzgó el diseño sobre una imagen falsa hasta que se
implementaron. Si se añade una función de canvas nueva al arte (sombras,
`bezierCurveTo`, patrones), hay que soportarla aquí o la vista previa mentirá.
