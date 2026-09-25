"""Hornea EL CEMENTERIO de la aventura de ROMINA: el segundo nivel.

    python tools/cementerio-atlas.py RUTA/PNG/Battleground4/Bright
    python tools/cementerio-atlas.py RUTA/PNG/Battleground4/Bright --vista vista.png

Escribe www/img/cementerio.png (las capas y las piezas del nivel) y
www/js/games/cementerio-atlas.js (donde esta cada una).

DE DONDE SALE
    "Free Pixel Art Fantasy Game Battlegrounds" de CraftPix, el campo de
    batalla 4 (un cementerio: arboles muertos, lapidas, una cripta con una
    calavera y ventanas verdes, un arbol con un cristal verde y jaulas, y la
    tierra agrietada con huesos). El mismo pack que el bosque y el salon:
    https://free-game-assets.itch.io/free-pixel-art-fantasy-game-battlegrounds
    Licencia de CraftPix: uso libre en juegos, prohibido redistribuir los
    archivos de origen. El pack NO esta en el repo; solo lo horneado.

LAS CAPAS
    Como el bosque (tools/bosque-atlas.py): dibujadas a 480x270, guardadas a
    x4 y usadas a x2; cada una empalma consigo misma cada 480 px (medido: las
    unicas columnas del borde que no casan son pixeles transparentes). El
    orden sale de recomponer el original probando: cielo, lapidas, arboles,
    cripta, muro, arbol del cristal, suelo y huesos (difiere en menos del 1 %
    de los pixeles). La cripta y el arbol del cristal van sueltos: la cripta
    es la SALIDA (como el arbol con cara del bosque) y el arbol, un hito.
    El suelo lleva los huesos pegados y se parte como el camino del bosque:
    el FONDO (filas 126-177) entero y el PISO (178-269) por tramos, con las
    tumbas abiertas entre ellos. Las mismas filas que el bosque: ella pisa en
    la 196 y el piso empieza 18 por encima.

LAS PIEZAS, CON LA PALETA DEL CEMENTERIO
    Las pintan las mismas funciones del bosque con sus colores cambiados: la
    tumba abierta (la pared del fondo y los cortes), la hoguera (aqui una pira
    de huesos con fuego verde, el del cristal y las ventanas de la cripta), y
    la lapida caida que hace de escalon en la tumba ancha. Lo que rueda es una
    CALAVERA del propio suelo, girada a ocho angulos.
"""
import argparse
import importlib.util
import io
import os

from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_JS = os.path.join(AQUI, '..', 'www', 'js', 'games', 'cementerio-atlas.js')
SALIDA_PNG = os.path.join(AQUI, '..', 'www', 'img', 'cementerio.png')
NL = '\n'
W, H = 480, 270

# Las funciones del bosque (capa, tono, contorno, la tumba, la hoguera, el fuego).
_spec = importlib.util.spec_from_file_location('bosque_atlas', os.path.join(AQUI, 'bosque-atlas.py'))
BA = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BA)

# LA PALETA, sacada del pack (los colores mas comunes de cada zona).
TIERRA = [(0x82, 0x8f, 0x58), (0x53, 0x5d, 0x4e), (0x39, 0x40, 0x39), (0x21, 0x23, 0x21), (0x14, 0x15, 0x13)]
HIERBA = [(0x29, 0x30, 0x1b), (0x4b, 0x52, 0x35), (0x5e, 0x67, 0x3d), (0x82, 0x8f, 0x58)]
HUESO = [(0x26, 0x29, 0x1c), (0x57, 0x5e, 0x3a), (0x8d, 0x89, 0x59), (0xc1, 0xb6, 0x84), (0xf1, 0xe6, 0xb3), (0xff, 0xfb, 0xea), (0xac, 0xa4, 0x76)]
PIEDRA = [(0x2c, 0x38, 0x2b), (0x5b, 0x6b, 0x50), (0x85, 0x8d, 0x64), (0xbe, 0xbd, 0x87)]
VERDE = [(0x2f, 0x7a, 0x32), (0x75, 0xa6, 0x4e), (0xb8, 0xf0, 0x6e), (0xf0, 0xff, 0xd8)]
CONTORNO = (0x1a, 0x1c, 0x14, 255)


def capa(ruta, nombre):
    return BA.capa(ruta, nombre)


def capas(ruta):
    suelo = capa(ruta, 'ground')
    suelo.alpha_composite(capa(ruta, 'bones'))
    cripta = capa(ruta, 'crypt')
    arbol = capa(ruta, 'tree')
    cc, ca = cripta.getbbox(), arbol.getbbox()
    return {
        'cielo': capa(ruta, 'sky').crop((0, 0, W, 140)),
        'lapidas': capa(ruta, 'graves').crop((0, 38, W, 140)),
        'arboles': capa(ruta, 'back_trees').crop((0, 5, W, 140)),
        'muro': capa(ruta, 'wall').crop((0, 94, W, 140)),
        'sueloFondo': suelo.crop((0, 126, W, 178)),
        'sueloPiso': suelo.crop((0, 178, W, H)),
        'cripta': cripta.crop(cc),
        'arbolCristal': arbol.crop(ca),
    }, cc, ca


def calavera(suelo_crudo, angulo):
    """La calavera pequeña del suelo (22 x 23 en el dibujo), girada: lo que
    rueda hacia ella. Girada con NEAREST sobre su centro, en un lienzo que le
    deja sitio a cualquier angulo."""
    c = suelo_crudo.crop((421, 154, 443, 177))
    lienzo = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    lienzo.alpha_composite(c, ((32 - c.width) // 2, (32 - c.height) // 2))
    return lienzo.rotate(-angulo, resample=Image.NEAREST)


def lapida(ancho=40, alto=86):
    """La lapida caida en la tumba ancha, de pie en el fondo: piedra con la
    cabeza redondeada, una grieta y una cruz grabada, oscureciendose hacia
    abajo (hacia la tumba), como el tocon del bosque."""
    im = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    px = im.load()
    r = ancho / 2
    for y in range(alto):
        f = max(0.18, 1 - max(0, y - 22) / (alto - 22) * 0.9)
        for x in range(ancho):
            u = x + 0.5 - r
            if y < r and u * u + (r - y) ** 2 > r * r:
                continue
            col = PIEDRA[2] if (x + y * 3) % 7 else PIEDRA[1]
            if x < 3:
                col = PIEDRA[3]
            elif x > ancho - 4:
                col = PIEDRA[1]
            px[x, y] = BA.tono(col, f)
    d = ImageDraw.Draw(im)
    # la cruz grabada y una grieta
    d.line([(r, 10), (r, 30)], fill=BA.tono(PIEDRA[0], 0.9), width=2)
    d.line([(r - 7, 17), (r + 7, 17)], fill=BA.tono(PIEDRA[0], 0.9), width=2)
    d.line([(9, 34), (15, 41), (12, 49)], fill=BA.tono(PIEDRA[0], 0.8), width=1)
    return contorno(im)


def contorno(im):
    BA.CONTORNO = CONTORNO
    return BA.contorno(im)


def con_paleta():
    """Los pintores del bosque, con los colores del cementerio."""
    BA.TIERRA = TIERRA
    BA.HOJA = HIERBA
    BA.PIEDRA = PIEDRA
    BA.CORTEZA = [HUESO[0], HUESO[1], HUESO[1], HUESO[3], HUESO[4], HUESO[2], HUESO[5]]
    BA.FUEGO = VERDE
    BA.CONTORNO = CONTORNO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ruta', help='carpeta PNG/Battleground4/Bright del pack')
    ap.add_argument('--vista', help='escribe tambien una vista a x2 con las piezas')
    args = ap.parse_args()

    L, cc, ca = capas(args.ruta)
    con_paleta()
    suelo_crudo = capa(args.ruta, 'bones')
    piezas = dict(L)
    for k in range(8):
        piezas['calavera%d' % k] = calavera(suelo_crudo, k * 45)
    piezas['lapida'] = lapida()
    piezas['fosoFondo'] = BA.foso_fondo()
    piezas['fosoI'] = BA.pared_foso(-1)
    piezas['fosoD'] = BA.pared_foso(1)
    piezas['hoguera'] = BA.hoguera()
    for k in range(4):
        piezas['fuego%d' % k] = BA.fuego(k)

    pos, y = {}, 0
    orden_capas = ['cielo', 'lapidas', 'arboles', 'muro', 'sueloFondo', 'sueloPiso']
    for n in orden_capas:
        pos[n] = (0, y)
        y += piezas[n].height + 1
    x, fila_alto = 0, 0
    for n in [n for n in piezas if n not in orden_capas]:
        im = piezas[n]
        if x + im.width > W:
            x, y, fila_alto = 0, y + fila_alto + 1, 0
        pos[n] = (x, y)
        x += im.width + 1
        fila_alto = max(fila_alto, im.height)
    alto = y + fila_alto
    hoja = Image.new('RGBA', (W, alto), (0, 0, 0, 0))
    for n, (px_, py_) in pos.items():
        hoja.alpha_composite(piezas[n], (px_, py_))
    buf = io.BytesIO()
    hoja.save(buf, 'PNG', optimize=True)
    with open(SALIDA_PNG, 'wb') as f:
        f.write(buf.getvalue())

    lineas = [
        '// GENERADO por tools/cementerio-atlas.py -- no se edita a mano.',
        '//',
        '// El cementerio de la aventura ("Free Pixel Art Fantasy Game Battlegrounds"',
        '// de CraftPix, el 4) y las piezas del nivel, en PIXELES DEL DIBUJO: en el',
        '// juego se pinta a x2, como ella. Cada pieza: [x, y, ancho, alto] en',
        '// img/cementerio.png.',
        'export const ESCALA = 2;',
        '// Las capas empalman consigo mismas cada 480 px del dibujo.',
        'export const PERIODO = %d;' % W,
        '// En que fila del dibujo empieza cada capa (se guardaron recortadas).',
        "export const FILA = { cielo: 0, lapidas: 38, arboles: 5, muro: 94, sueloFondo: 126, sueloPiso: 178 };",
        '// La cripta (la salida) y el arbol del cristal: su caja en el dibujo original.',
        'export const CRIPTA = { x0: %d, y0: %d, x1: %d, y1: %d };' % cc,
        'export const ARBOL = { x0: %d, y0: %d, x1: %d, y1: %d };' % ca,
        'export const PIEZAS = {',
    ]
    for n, (px_, py_) in pos.items():
        lineas.append('  %s: [%d, %d, %d, %d],' % (n, px_, py_, piezas[n].width, piezas[n].height))
    lineas.append('};')
    with open(SALIDA_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(NL.join(lineas) + NL)
    print('cementerio.png %dx%d, %d KB; %d piezas' % (W, alto, len(buf.getvalue()) // 1024, len(pos)))

    if args.vista:
        v = Image.new('RGBA', (W * 2, alto * 2), (255, 0, 255, 255))
        v.alpha_composite(hoja.resize((W * 2, alto * 2), Image.NEAREST))
        v.convert('RGB').save(args.vista)


if __name__ == '__main__':
    main()
