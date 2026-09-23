"""Hornea EL BOSQUE de la aventura de ROMINA: el primer nivel que avanza.

    python tools/bosque-atlas.py RUTA/PNG/Battleground3/Bright
    python tools/bosque-atlas.py RUTA/PNG/Battleground3/Bright --vista vista.png

Escribe www/img/bosque.png (las capas del bosque y las piezas del nivel) y
www/js/games/bosque-atlas.js (donde esta cada una).

DE DONDE SALE
    "Free Pixel Art Fantasy Game Battlegrounds" de CraftPix, el campo de
    batalla 3 (un bosque encantado con un arbol que tiene cara), el mismo pack
    que el salon del castillo: https://free-game-assets.itch.io/free-pixel-art-fantasy-game-battlegrounds
    Licencia de CraftPix: uso libre en juegos, prohibido redistribuir los
    archivos de origen. El pack NO esta en el repo; solo lo horneado.

LAS CAPAS, Y POR QUE VAN RECORTADAS
    El pack esta dibujado a 480x270 y guardado a x4; se usa a x2, la densidad
    de ella. Cada capa EMPALMA consigo misma cada 480 px (medido: la diferencia
    entre la ultima columna y la primera es la de dos columnas vecinas), asi
    que se repite a lo largo del nivel sin costuras. El orden se saco
    recomponiendo el original: cielo, bosque, arboles, helechos, lianas,
    luciernagas, camino y el arbol con cara encima (coincide al pixel).
    Detras de los helechos (opacos desde la fila 103) y del camino (desde la
    139) no se ve nada, asi que cada capa se guarda solo en las filas en que
    se ve: menos imagen y menos que pintar en cada frame.
    El camino se parte en dos: el FONDO (la hierba de detras, filas 123-177)
    va entero, y el PISO (la arena y la hierba de delante, 178-269) se pinta
    por tramos: entre dos tramos esta el foso.

LAS PIEZAS DEL NIVEL SE PINTAN CON LA PALETA DEL PACK
    El tronco que rueda (su cara cortada, con anillos y una grieta que gira),
    la rama que cae, el tocon del foso ancho, las paredes del foso y la
    hoguera. Sus colores salen del propio bosque: la corteza del arbol con
    cara, la arena del camino, los verdes de la hierba y los helechos. Con
    colores inventados quedarian como recortes de otro juego.
"""
import argparse
import io
import math
import os
import random

from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_JS = os.path.join(AQUI, '..', 'www', 'js', 'games', 'bosque-atlas.js')
SALIDA_PNG = os.path.join(AQUI, '..', 'www', 'img', 'bosque.png')
NL = '\n'
W, H = 480, 270
CONTORNO = (27, 18, 15, 255)          # el marron casi negro del contorno del arbol

# La paleta, sacada del pack (los colores mas comunes de cada zona).
CORTEZA = [(27, 18, 15), (41, 27, 20), (48, 36, 27), (58, 45, 36), (72, 66, 50), (95, 86, 59), (139, 115, 71)]
MADERA = [(206, 203, 133), (173, 170, 109), (148, 150, 106), (139, 115, 71), (110, 90, 56)]
TIERRA = [(110, 108, 55), (95, 95, 51), (70, 64, 36), (47, 44, 25), (29, 26, 16)]
HOJA = [(49, 61, 39), (76, 95, 64), (106, 124, 74), (135, 150, 97)]
PIEDRA = [(58, 56, 40), (110, 108, 72), (148, 150, 106), (206, 203, 133)]
FUEGO = [(224, 64, 32), (255, 150, 40), (255, 224, 102), (255, 250, 220)]


def capa(ruta, nombre):
    im = Image.open(os.path.join(ruta, nombre + '.png')).convert('RGBA')
    return im.resize((im.width // 4, im.height // 4), Image.NEAREST)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def tono(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


def contorno(im):
    """Un contorno oscuro de 1 px alrededor de lo pintado, como el del pack."""
    a = im.getchannel('A').load()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    op = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if a[x, y]:
                continue
            if any(0 <= x + dx < im.width and 0 <= y + dy < im.height and a[x + dx, y + dy]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                op[x, y] = CONTORNO
    out.alpha_composite(im)
    return out


# ---------------------------------------------------------------- las capas
def capas(ruta):
    cielo = capa(ruta, 'sky')
    lejos = cielo.copy()
    lejos.alpha_composite(capa(ruta, 'jungle_bg'))
    camino = capa(ruta, 'grass&road')
    arbol = capa(ruta, 'tree_face')
    caja = arbol.getbbox()
    return {
        # el cielo no cambia en horizontal: pintarlo bajo el bosque lejano da
        # lo mismo corra como corra este, y ahorra una capa
        'lejos': lejos.crop((0, 0, W, 104)),
        'arboles': capa(ruta, 'trees&bushes').crop((0, 0, W, 104)),
        'helechos': capa(ruta, 'grasses').crop((0, 28, W, 140)),
        'lianas': capa(ruta, 'lianas').crop((0, 0, W, 104)),
        'caminoFondo': camino.crop((0, 123, W, 178)),
        'caminoPiso': camino.crop((0, 178, W, H)),
        'arbol': arbol.crop(caja),
    }, caja


# ------------------------------------------------------------ el tronco
def tronco(angulo, r=12):
    """La cara cortada de un tronco que rueda: corteza gruesa alrededor, anillos
    de madera bien marcados y una grieta en cuña, del borde hacia el centro,
    que gira con el tronco (es lo que se ve rodar: un circulo liso parece
    quieto). La primera version, con anillos tenues y una grieta fina, se leia
    como un reloj."""
    n = 2 * r + 3
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    px = im.load()
    c = n / 2
    ga = math.radians(angulo)
    for y in range(n):
        for x in range(n):
            dx, dy = x + 0.5 - c, y + 0.5 - c
            d = math.hypot(dx, dy)
            if d > r + 0.5:
                continue
            luz = 1.1 if dx + dy < -r * 0.5 else 0.78 if dx + dy > r * 0.45 else 0.95
            if d > r - 3:
                col = CORTEZA[2] if (x * 5 + y * 7) % 4 else CORTEZA[4]
                if d > r - 1:
                    col = CORTEZA[1]
            else:
                col = MADERA[3] if (d % 3.2) < 1.0 else (MADERA[0] if d < r * 0.5 else MADERA[1])
                if d < 1.6:
                    col = MADERA[4]
            # la grieta, en cuña: mas ancha en el borde
            a = math.atan2(dy, dx)
            da = abs((a - ga + math.pi) % (2 * math.pi) - math.pi)
            if d > r * 0.35 and d < r - 0.5 and da * d < 0.35 + (d - r * 0.35) * 0.28:
                col = CORTEZA[0]
            px[x, y] = tono(col, luz)
    return contorno(im)


# ------------------------------------------------------------ la rama
def rama_recta():
    """Una rama gruesa con dos ramitas y tres matas de hojas, en horizontal.
    La primera, de 3 px de grueso y matas de 18 puntos sueltos, a tamaño de
    juego era una ramita que se perdia contra el bosque: esta es mas gorda,
    las matas son macizas y de verde CLARO (el bosque es oscuro), y lleva el
    contorno oscuro del pack."""
    im = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cy = 24
    d.line([(4, cy + 2), (42, cy - 2)], fill=rgba(CORTEZA[3]), width=5)
    d.line([(5, cy), (41, cy - 4)], fill=rgba(CORTEZA[6]), width=1)
    d.line([(16, cy), (11, cy - 9)], fill=rgba(CORTEZA[3]), width=3)
    d.line([(29, cy - 1), (35, cy + 8)], fill=rgba(CORTEZA[3]), width=3)
    for (hx, hy, r) in ((10, cy - 11, 5), (36, cy + 9, 5), (43, cy - 4, 4)):
        d.ellipse([hx - r, hy - r + 1, hx + r, hy + r - 1], fill=rgba(HOJA[2]))
        d.ellipse([hx - r + 1, hy - r + 1, hx + r - 2, hy], fill=rgba(HOJA[3]))
        d.point((hx - 2, hy - 2), fill=rgba((196, 214, 140)))
        d.point((hx + 1, hy + 1), fill=rgba(HOJA[1]))
    return im


def rama(angulo, base):
    return contorno(base.rotate(angulo, resample=Image.NEAREST, expand=False))


# ------------------------------------------------------------ el tocon
def tocon(arbol_crudo, ancho=45, alto=86):
    """Un tocon que sale del fondo del foso: la corteza del arbol con cara
    (de su tronco de abajo, donde ya no hay cara), la cara de arriba cortada
    con sus anillos, y oscureciendose hacia abajo, que es donde esta el foso."""
    im = Image.new('RGBA', (ancho + 2, alto), (0, 0, 0, 0))
    # la corteza: un trozo del tronco del arbol, repetido hacia abajo
    tira = arbol_crudo.crop((226, 128, 226 + ancho, 150))
    for y in range(6, alto, tira.height):
        im.alpha_composite(tira, (1, y))
    px = im.load()
    for y in range(alto):
        f = max(0.18, 1 - max(0, y - 18) / (alto - 18) * 0.9)
        for x in range(im.width):
            if px[x, y][3]:
                px[x, y] = tono(px[x, y], f)
    # la cara de arriba: una elipse de madera con anillos
    for y in range(0, 9):
        for x in range(1, ancho + 1):
            u = (x - 1 - ancho / 2) / (ancho / 2)
            v = (y - 4) / 4.2
            if u * u + v * v > 1:
                continue
            d = math.hypot(u * ancho / 2, v * 10)
            col = CORTEZA[3] if u * u + v * v > 0.72 else MADERA[3] if int(d) % 5 == 0 else MADERA[1] if d > 8 else MADERA[0]
            px[x, y] = rgba(col)
    return contorno(im)


# ------------------------------------------------------------ el foso
def foso_fondo(ancho=40, alto=92):
    """Lo que se ve al asomarse al foso: la pared del fondo, de tierra con
    raices, que baja desde el borde de hierba de detras del camino y se hunde
    en negro. Se repite a lo ancho (el ruido va en modulo del ancho). Negro a
    secas se leia como una puerta, no como un barranco."""
    rnd = random.Random(11)
    ruido = [[rnd.random() for _ in range(ancho)] for _ in range(alto)]
    im = Image.new('RGBA', (ancho, alto), (0, 0, 0, 255))
    px = im.load()
    for y in range(alto):
        # luz: entera arriba, a oscuras hacia los dos tercios
        f = max(0.0, 1 - y / (alto * 0.62)) ** 1.4
        for x in range(ancho):
            r = ruido[y][x]
            col = TIERRA[1] if r < 0.45 else TIERRA[2] if r < 0.8 else TIERRA[0]
            # vetas verticales, de la tierra que se escurre
            if (x * 7 + (y // 5) * 3) % 11 == 0:
                col = TIERRA[3]
            c = tono(col, 0.25 + 0.75 * f)
            fondo = (11, 9, 7)
            k = f if y > 8 else 1
            px[x, y] = tuple(int(fondo[i] + (c[i] - fondo[i]) * max(k, 0.0)) for i in range(3)) + (255,)
    # el borde de hierba de arriba, colgando
    for x in range(ancho):
        largo = 2 + int(2 * abs(math.sin(x * 0.9)) + (x * 13 % 5 == 0))
        for y in range(largo):
            px[x, y] = rgba(HOJA[1] if y < largo - 1 else HOJA[0])
    # raices
    for k in range(3):
        x0 = 6 + k * 13
        for i in range(10 + k * 3):
            x = (x0 + i // 3) % ancho
            y = 4 + i
            px[x, y] = tono(CORTEZA[3], max(0.3, 1 - y / 40))
    return im


def pared_foso(lado, alto=92, ancho=6):
    """El corte del camino a cada lado del foso: una franja de tierra que se
    oscurece hacia el hueco, con el borde algo irregular. `lado` -1 = el borde
    izquierdo del hueco (la tierra queda a la izquierda)."""
    rnd = random.Random(3 if lado < 0 else 5)
    im = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    px = im.load()
    for y in range(alto):
        borde = ancho - 1 - (1 if rnd.random() < 0.3 else 0)
        f = max(0.2, 1 - y / alto * 0.8)
        for x in range(ancho):
            xx = x if lado < 0 else ancho - 1 - x
            if xx > borde:
                continue
            col = TIERRA[2] if xx < ancho - 3 else TIERRA[3] if xx < ancho - 1 else TIERRA[4]
            if y < 3:
                col = (148, 150, 106) if xx < ancho - 2 else TIERRA[2]
            px[x, y] = tono(col, f)
    return im


# ------------------------------------------------------------ la hoguera
def hoguera():
    """El sitio de la hoguera: un corro de piedras y dos leños cruzados. El
    fuego va aparte (fuego0..3): encendida o no, las piedras son las mismas."""
    im = Image.new('RGBA', (30, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line([(6, 9), (23, 4)], fill=rgba(CORTEZA[3]), width=3)
    d.line([(6, 4), (23, 9)], fill=rgba(CORTEZA[4]), width=3)
    for i, x in enumerate((1, 6, 12, 18, 24)):
        d.ellipse([x, 7, x + 5, 11], fill=rgba(PIEDRA[1 + i % 2]))
        d.point((x + 1, 8), fill=rgba(PIEDRA[3]))
    return contorno(im)


def fuego(k):
    """Una llama de cuatro fotogramas: tres lenguas que suben a destiempo."""
    im = Image.new('RGBA', (16, 20), (0, 0, 0, 0))
    px = im.load()
    for y in range(20):
        for x in range(16):
            u = (x - 7.5) / 7.5
            fase = (k * 1.6 + x * 0.9)
            alto = 14 + 4 * math.sin(fase) - abs(u) * 9
            yy = 19 - y
            if yy > alto or abs(u) > 1:
                continue
            q = yy / max(1, alto)
            col = FUEGO[3] if q < 0.25 and abs(u) < 0.3 else FUEGO[2] if q < 0.5 else FUEGO[1] if q < 0.8 else FUEGO[0]
            px[x, y] = rgba(col)
    return im


# ------------------------------------------------------------ la hoja
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ruta', help='carpeta PNG/Battleground3/Bright del pack')
    ap.add_argument('--vista', help='escribe tambien una vista a x2 con las piezas')
    args = ap.parse_args()

    L, caja = capas(args.ruta)
    arbol_crudo = capa(args.ruta, 'tree_face')
    piezas = dict(L)
    for k in range(8):
        piezas['tronco%d' % k] = tronco(k * 45)
    base = rama_recta()
    for k in range(8):
        piezas['rama%d' % k] = rama(k * 45, base)
    piezas['tocon'] = tocon(arbol_crudo)
    piezas['fosoFondo'] = foso_fondo()
    piezas['fosoI'] = pared_foso(-1)
    piezas['fosoD'] = pared_foso(1)
    piezas['hoguera'] = hoguera()
    for k in range(4):
        piezas['fuego%d' % k] = fuego(k)

    # Colocar: las capas una debajo de otra (480 de ancho), y las piezas en
    # filas debajo.
    pos, y = {}, 0
    orden_capas = ['lejos', 'arboles', 'helechos', 'lianas', 'caminoFondo', 'caminoPiso']
    for n in orden_capas:
        pos[n] = (0, y)
        y += piezas[n].height + 1
    x, fila_alto = 0, 0
    resto = [n for n in piezas if n not in orden_capas]
    for n in resto:
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
        '// GENERADO por tools/bosque-atlas.py -- no se edita a mano.',
        '//',
        '// El bosque de la aventura ("Free Pixel Art Fantasy Game Battlegrounds" de',
        '// CraftPix, el 3) y las piezas del nivel, en PIXELES DEL DIBUJO: en el',
        '// juego se pinta a x2, como ella. Cada pieza: [x, y, ancho, alto] en',
        '// img/bosque.png.',
        'export const ESCALA = 2;',
        '// Las capas empalman consigo mismas cada 480 px del dibujo.',
        'export const PERIODO = %d;' % W,
        '// En que fila del dibujo empieza cada capa (se guardaron recortadas).',
        "export const FILA = { lejos: 0, arboles: 0, helechos: 28, lianas: 0, caminoFondo: 123, caminoPiso: 178 };",
        '// El arbol con cara: su caja en el dibujo original, para ponerlo en su sitio.',
        'export const ARBOL = { x0: %d, y0: %d, x1: %d, y1: %d };' % caja,
        'export const PIEZAS = {',
    ]
    for n, (px_, py_) in pos.items():
        lineas.append('  %s: [%d, %d, %d, %d],' % (n, px_, py_, piezas[n].width, piezas[n].height))
    lineas.append('};')
    with open(SALIDA_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(NL.join(lineas) + NL)
    print('bosque.png %dx%d, %d KB; %d piezas' % (W, alto, len(buf.getvalue()) // 1024, len(pos)))

    if args.vista:
        v = Image.new('RGBA', (W * 2, alto * 2), (255, 0, 255, 255))
        v.alpha_composite(hoja.resize((W * 2, alto * 2), Image.NEAREST))
        v.convert('RGB').save(args.vista)


if __name__ == '__main__':
    main()
