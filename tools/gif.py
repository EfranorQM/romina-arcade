"""Monta un GIF de una secuencia del ogro o de ella, a tamaño real y a su velocidad.

    python tools/gif.py ogro:garrote salida.gif
    python tools/gif.py ogro:garrote,ogro:pisoton salida.gif
    python tools/gif.py caballera:combo salida.gif --x2    # como en el telefono

Las secuencias del ogro son las de tools/ver-ogro.html (garrote, pisoton,
barrido, embestida, ruge, dolor, pared, parada, jadeo, muere, anda, espera) y
las de ella las de tools/ver-caballera.html (combo, corre, salto, esquiva,
atraviesa, guardia, parada, dolor, aire, derrota), que se SIMULAN con la fisica real pulsando
botones. Todo se renderiza con los modulos reales del juego. Con --x2 se
amplia con NEAREST, que es el tamaño al que se ve en el telefono (el lienzo de
1200 se estira a ~2340); sin el, pesa la cuarta parte.

Una hoja de contactos enseña las poses; un GIF enseña el MOVIMIENTO, que es
lo que se criticaba. Por eso existe.

UNA SOLA PALETA para todo el GIF: con una por fotograma (lo que hace PIL por
defecto) el cielo y la piel cambian de tono de un fotograma a otro y el GIF
parpadea, y eso se confunde con un defecto de la animacion.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, '..')
# 25 y no 30: el GIF guarda la duracion en CENTESIMAS. A 30 fps cada fotograma
# quedaria en 30 ms en vez de 33 y el GIF iria un 10 % mas rapido que el juego.
FPS = 25
# Pagina, tamaño de celda y duracion de cada secuencia (la misma que en la
# pagina). 'escena' graba el juego ENTERO (tools/ver-escena.html), reducido.
PAGINA = {'ogro': ('tools/ver-ogro.html', 620, 470), 'caballera': ('tools/ver-caballera.html', 620, 470),
          'escena': ('tools/ver-escena.html', 720, 324)}
DURA = {
    'escena': {'arena': 5.2, 'parada': 2.2, 'barrido': 1.8, 'embestida': 2.6},
    'ogro': {'garrote': 0.95, 'pisoton': 1.45, 'barrido': 0.88, 'embestida': 1.30,
             'ruge': 1.2, 'dolor': 0.24, 'pared': 1.25, 'parada': 0.55, 'jadeo': 0.55,
             'muere': 1.2, 'anda': 1.2, 'espera': 1.0},
    'caballera': {'combo': 1.25, 'corre': 1.0, 'salto': 0.95, 'esquiva': 0.65, 'atraviesa': 0.65,
                  'guardia': 1.0, 'parada': 1.2, 'dolor': 0.6, 'aire': 0.9, 'derrota': 1.0},
}


def tira(sec):
    quien, nombre = sec.split(':') if ':' in sec else ('ogro', sec)
    pagina, cw, ch = PAGINA[quien]
    dura = DURA[quien][nombre]
    # la escena entera cuenta sus fotogramas con ceil(); las otras, uno mas
    n = int(dura * FPS + 0.999) + (0 if quien == 'escena' else 1)
    # la escena entera viene en filas de 10 (un lienzo no pasa de 32767 px)
    cols = 10 if quien == 'escena' else n
    filas = (n + cols - 1) // cols
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, 'tira.png')
        subprocess.run(['node', os.path.join(AQUI, 'ver.js'), f'{pagina}?s={nombre}&fps={FPS}&dura={dura}',
                        png, str(min(n, cols) * cw), str(filas * ch)], cwd=RAIZ, check=True, capture_output=True)
        im = Image.open(png).convert('RGB')
        im.load()
    return [im.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch)) for i in range(n)]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__)
        return 1
    fotos = []
    for nombre in args[0].split(','):
        tr = tira(nombre)
        fotos += tr + [tr[-1]] * (FPS // 3)      # un respiro entre secuencias
    # la paleta comun, sacada de un mosaico de fotogramas repartidos
    muestra = fotos[::max(1, len(fotos) // 12)]
    fw, fh = fotos[0].size
    mosaico = Image.new('RGB', (fw * len(muestra), fh))
    for i, f in enumerate(muestra):
        mosaico.paste(f, (i * fw, 0))
    pal = mosaico.quantize(colors=255, method=Image.MEDIANCUT)
    fotos = [f.quantize(palette=pal, dither=Image.NONE) for f in fotos]
    if '--x2' in sys.argv:
        fotos = [f.resize((f.width * 2, f.height * 2), Image.NEAREST) for f in fotos]
    fotos[0].save(args[1], save_all=True, append_images=fotos[1:],
                  duration=round(1000 / FPS), loop=0, optimize=True)
    print(f'{args[1]}: {len(fotos)} fotogramas a {FPS} fps, '
          f'{os.path.getsize(args[1]) / 1024:.0f} KB')


if __name__ == '__main__':
    sys.exit(main())
