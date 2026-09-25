"""Hoja de contactos de un GIF: un fotograma cada `cada` segundos, en rejilla,
con su tiempo encima. Para revisar una grabacion de un vistazo (el GIF entero
enseña el movimiento; la hoja, que esta en cada momento).

    python tools/hoja-gif.py vistas/cuervo-picado.gif hoja.png [cada=0.4] [desde=0] [hasta=fin] [cols=4]
"""
import sys

from PIL import Image, ImageDraw, ImageSequence


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    gif, salida = sys.argv[1], sys.argv[2]
    cada = float(sys.argv[3]) if len(sys.argv) > 3 else 0.4
    desde = float(sys.argv[4]) if len(sys.argv) > 4 else 0
    hasta = float(sys.argv[5]) if len(sys.argv) > 5 else 1e9
    cols = int(sys.argv[6]) if len(sys.argv) > 6 else 4
    im = Image.open(gif)
    fotos, t, sig = [], 0.0, desde
    for f in ImageSequence.Iterator(im):
        dur = (f.info.get('duration') or 40) / 1000
        if t >= sig - 1e-6 and t <= hasta:
            fotos.append((t, f.convert('RGB')))
            sig += cada
        t += dur
    fw, fh = fotos[0][1].size
    filas = (len(fotos) + cols - 1) // cols
    hoja = Image.new('RGB', (cols * fw, filas * (fh + 16)), (0, 0, 0))
    d = ImageDraw.Draw(hoja)
    for i, (tt, f) in enumerate(fotos):
        x, y = (i % cols) * fw, (i // cols) * (fh + 16)
        hoja.paste(f, (x, y + 16))
        d.text((x + 4, y + 2), f'{tt:.2f} s', fill=(255, 230, 120))
    hoja.save(salida)
    print(salida, hoja.size, len(fotos), 'fotogramas')


if __name__ == '__main__':
    sys.exit(main())
