"""Monta un GIF de una secuencia del ogro o de ella, a tamaño real y a su velocidad.

    python tools/gif.py ogro:garrote salida.gif
    python tools/gif.py ogro:garrote,ogro:pisoton salida.gif
    python tools/gif.py caballera:combo salida.gif --x2    # como en el telefono
    python tools/gif.py aventura:picado salida.gif --dif paseo  # en PASEO
    python tools/gif.py aventura:jefe salida.mp4 --reac 0.6     # en video

UN VIDEO si la salida acaba en .mp4 (con ffmpeg, H.264): la pelea del jefe
en GIF pesaba 74 MB; en video, una fraccion, y sin reducir colores.

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

# La tira de una grabacion larga (la pelea del jefe, 34 s) pasa del limite
# contra 'bombas de descompresion' de PIL; la genera ver.js, es nuestra.
Image.MAX_IMAGE_PIXELS = None

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, '..')
# 25 y no 30: el GIF guarda la duracion en CENTESIMAS. A 30 fps cada fotograma
# quedaria en 30 ms en vez de 33 y el GIF iria un 10 % mas rapido que el juego.
FPS = 25
# Pagina, tamaño de celda y duracion de cada secuencia (la misma que en la
# pagina). 'escena' graba el juego ENTERO (tools/ver-escena.html), reducido.
PAGINA = {'ogro': ('tools/ver-ogro.html', 620, 470), 'caballera': ('tools/ver-caballera.html', 620, 470),
          'escena': ('tools/ver-escena.html', 720, 324), 'aventura': ('tools/ver-aventura.html', 720, 324)}
DURA = {
    'escena': {'arena': 5.2, 'parada': 2.2, 'barrido': 1.8, 'embestida': 2.6,
               'inicio': 4.6, 'victoria': 6.6},
    'aventura': {'inicio': 8.0, 'foso': 2.4, 'barrido': 7.0, 'rastrero': 8.0, 'lobo': 7.0, 'troncos': 6.0, 'kitsune': 9.0, 'ramas': 6.0, 'tocon': 5.0, 'final': 16.0,
                 'picado': 6.0, 'cuervo': 9.0, 'relampago': 5.0, 'iai': 7.0, 'jefe': 34.0,
                 'cementerio': 9.0, 'vampira': 9.0, 'vampiro': 10.0, 'pareja': 12.0, 'condesa': 36.0},
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
    entera = quien in ('escena', 'aventura')
    n = int(dura * FPS + 0.999) + (0 if entera else 1)
    # la escena entera viene en filas de 10 (un lienzo no pasa de 32767 px)
    cols = 10 if entera else n
    filas = (n + cols - 1) // cols
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, 'tira.png')
        dif = f'&dif={sys.argv[sys.argv.index("--dif") + 1]}' if '--dif' in sys.argv else ''
        dif += f'&reac={sys.argv[sys.argv.index("--reac") + 1]}' if '--reac' in sys.argv else ''
        subprocess.run(['node', os.path.join(AQUI, 'ver.js'), f'{pagina}?s={nombre}&fps={FPS}&dura={dura}{dif}',
                        png, str(min(n, cols) * cw), str(filas * ch)], cwd=RAIZ, check=True, capture_output=True)
        im = Image.open(png).convert('RGB')
        im.load()
    return [im.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch)) for i in range(n)]


def video(fotos, salida):
    if '--x2' in sys.argv:
        fotos = [f.resize((f.width * 2, f.height * 2), Image.NEAREST) for f in fotos]
    w, h = fotos[0].width // 2 * 2, fotos[0].height // 2 * 2
    with tempfile.TemporaryDirectory() as tmp:
        for i, f in enumerate(fotos):
            f.crop((0, 0, w, h)).save(os.path.join(tmp, f'{i:05d}.png'))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, '%05d.png'),
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', salida], check=True)
    print(f'{salida}: {len(fotos)} fotogramas a {FPS} fps, {os.path.getsize(salida) / 1024:.0f} KB')
    return 0


def main():
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in ('--dif', '--reac')]
    if len(args) < 2:
        print(__doc__)
        return 1
    fotos = []
    for nombre in args[0].split(','):
        tr = tira(nombre)
        fotos += tr + [tr[-1]] * (FPS // 3)      # un respiro entre secuencias
    if args[1].endswith('.mp4'):
        return video(fotos, args[1])
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
