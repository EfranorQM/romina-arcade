"""Hornea la ARENA de ROMINA: el salon del castillo donde pelea con el ogro.

    python tools/arena-atlas.py RUTA/PNG/Battleground2/Bright
    python tools/arena-atlas.py RUTA/PNG/Battleground2/Bright --vista vista.png

Escribe www/img/arena.png (el salon a 600x270 y, debajo, las piezas de la
arena: la repisa y los cascotes) y www/js/games/arena-atlas.js (donde esta
cada pieza).

DE DONDE SALE
    "Free Pixel Art Fantasy Game Battlegrounds" de CraftPix, el campo de
    batalla 2 (un salon con ventanales, bovedas con estandartes, candelabros y
    una estatua de dragon): https://free-game-assets.itch.io/free-pixel-art-fantasy-game-battlegrounds
    Mismo tipo de licencia que el troll: uso libre en juegos, prohibido
    redistribuir los archivos de origen. El pack NO esta en el repo.

POR QUE ESTE Y NO OTRO
    Se probaron los cuatro del pack a tamaño de juego con ella y el ogro
    delante. En las ruinas y en el bosque el troll VERDE se funde con la hierba;
    contra la alfombra roja y la piedra clara del salon se lee de un vistazo. Y
    cuenta algo: el ogro se ha metido en el castillo de la princesa.

LA ESCALA
    El pack esta dibujado a 480x270 y guardado a x4. Se usa a x2: la MISMA
    densidad de pixel que ella (romina-atlas.py tambien dobla). Asi el salon
    mide 960 de ancho y hay que alargarlo a 1200 sin que se note:
      - la pared de ventanales se repite exacta cada 120 px (medido: la
        diferencia al desplazarla 120 es 1.9 de 255, ruido de la textura);
      - las bovedas cada 240, con sus columnas sobre las de la pared;
      - el suelo cada 48;
      - los candelabros van por ventana, asi que se repiten con la pared;
      - el dragon, que es uno solo, se centra.
    El orden de las capas se saco recomponiendo el original y comparandolo con
    el que trae el pack: coincide al pixel.

LAS PIEZAS DE LA ARENA SALEN DE SU PROPIA PIEDRA
    La repisa es un trozo de la franja de piedra del suelo (la del pie de la
    pared), con su canto y su sombra; los cascotes, pedazos de esa misma piedra.
    Dibujarlos con otra paleta los despegaria del salon.
"""
import argparse
import io
import os
import random
import sys

from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_JS = os.path.join(AQUI, '..', 'www', 'js', 'games', 'arena-atlas.js')
SALIDA_PNG = os.path.join(AQUI, '..', 'www', 'img', 'arena.png')
NL = '\n'
W, H = 600, 270                 # el salon, en pixeles del dibujo (x2 en el juego)
ORDEN = ['bg', 'mountaims', 'wall@windows', 'columns&falgs', 'candeliar', 'floor', 'dragon']
PERIODO = {'wall@windows': 120, 'columns&falgs': 240, 'floor': 48, 'candeliar': 120}
CONTORNO = (28, 22, 26, 255)


def capa(ruta, nombre):
    im = Image.open(os.path.join(ruta, nombre + '.png')).convert('RGBA')
    return im.resize((im.width // 4, im.height // 4), Image.NEAREST)   # a su tamaño nativo


def alarga(im, periodo):
    """De 480 a 600 de ancho repitiendo el periodo (o el borde, si no tiene)."""
    out = Image.new('RGBA', (W, im.height), (0, 0, 0, 0))
    out.paste(im, (0, 0))
    if periodo:
        x = im.width
        while x < W:
            trozo = im.crop((x - periodo * ((x - im.width) // periodo + 1), 0,
                             x - periodo * ((x - im.width) // periodo + 1) + min(periodo, W - x), im.height))
            out.paste(trozo, (x, 0))
            x += trozo.width
    else:
        # sin periodo (cielo, montañas): se completa con el propio borde en espejo
        falta = W - im.width
        espejo = im.crop((im.width - falta, 0, im.width, im.height)).transpose(Image.FLIP_LEFT_RIGHT)
        out.paste(espejo, (im.width, 0))
    return out


def salon(ruta):
    """El salon a 600x270 y donde estan las llamas de las velas (para que el
    juego las haga parpadear: el halo ya viene pintado, pero quieto)."""
    fondo = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    llamas = []
    for nombre in ORDEN:
        c = capa(ruta, nombre)
        if nombre == 'dragon':
            fondo.alpha_composite(c, (60, 0))          # centrado en 600
        elif nombre == 'candeliar':
            # los candelabros van por ventana: se repiten con la pared (120)
            c = alarga(c, 120)
            fondo.alpha_composite(c)
            llamas = busca_llamas(c)
        else:
            fondo.alpha_composite(alarga(c, PERIODO.get(nombre)))
    return fondo, llamas


def busca_llamas(capa_velas):
    """Cada grupo de pixeles de llama (#ffc118, opaco) es una vela: su centro."""
    px = capa_velas.load()
    Wc, Hc = capa_velas.size
    visto = set()
    llamas = []
    for y in range(Hc):
        for x in range(Wc):
            if (x, y) in visto or px[x, y] != (255, 193, 24, 255):
                continue
            pila, grupo = [(x, y)], []
            visto.add((x, y))
            while pila:
                a, b = pila.pop()
                grupo.append((a, b))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (a + dx, b + dy)
                        if 0 <= q[0] < Wc and 0 <= q[1] < Hc and q not in visto and px[q] == (255, 193, 24, 255):
                            visto.add(q)
                            pila.append(q)
            llamas.append((sum(p[0] for p in grupo) / len(grupo), sum(p[1] for p in grupo) / len(grupo)))
    return sorted((round(x, 1), round(y, 1)) for x, y in llamas)


def repisa(ruta, ancho=76):
    """La repisa: un balcon de piedra. Arriba la franja clara del pie de la
    pared (sus mismos pixeles), delante dos hiladas de sillares y en los
    extremos dos mensulas que la sostienen. Con solo la franja parecia una
    barra de metal: le faltaba el FRENTE, que es lo que da volumen."""
    suelo = capa(ruta, 'floor')
    luz, medio, sombra, junta = (206, 196, 176, 255), (168, 156, 140, 255), (128, 116, 106, 255), (86, 74, 70, 255)
    alto = 22
    r = Image.new('RGBA', (ancho + 2, alto + 1), (0, 0, 0, 0))
    # la cara de arriba: la franja de piedra del salon
    r.paste(suelo.crop((40, 129, 40 + ancho, 135)), (1, 1))
    px = r.load()
    for x in range(1, ancho + 1):
        px[x, 7] = junta                               # el canto
    # el frente: dos hiladas de sillares a matajunta, con el grano de la piedra
    grano = textura(ruta)
    gp = grano.load()
    for fila, (y0, y1) in enumerate(((8, 12), (13, 17))):
        off = 0 if fila == 0 else 6
        for y in range(y0, y1 + 1):
            for x in range(1, ancho + 1):
                u = (x - 1 + off) % 12
                g = gp[(x * 2 + fila * 31) % grano.width, (y - y0) % grano.height]
                px[x, y] = junta if u == 0 else tono(g, 0.86 if y < y1 else 0.7)
                if y == y0 and u != 0:
                    px[x, y] = tono(g, 1.05)            # la luz de arriba de cada sillar
        for x in range(1, ancho + 1):
            px[x, y1 + 1 if y1 + 1 < 18 else y1] = junta
    # las mensulas: dos cuñas bajo los extremos
    for cx in (6, ancho - 6):
        for k in range(4):
            for x in range(cx - 4 + k, cx + 5 - k):
                px[x, 18 + k] = sombra if k < 3 else junta
    # contorno oscuro alrededor de todo lo pintado, como el resto del salon
    a = r.getchannel('A')
    borde = Image.new('RGBA', r.size, (0, 0, 0, 0))
    bp, ap = borde.load(), a.load()
    for y in range(r.height):
        for x in range(r.width):
            if ap[x, y]:
                continue
            if any(0 <= x + dx < r.width and 0 <= y + dy < r.height and ap[x + dx, y + dy]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                bp[x, y] = CONTORNO
    borde.alpha_composite(r)
    return borde


def textura(ruta):
    """El grano de la piedra de la BOVEDA, que es de donde caen los cascotes:
    el parche de 40x6 mas uniforme que hay en ella (buscado, desviacion 9.9 de
    luminancia). Pintar con tonos planos dejaba los cascotes como recortes de
    otro juego, y la franja del suelo tiene la moldura del zocalo y los rayaba."""
    return capa(ruta, 'columns&falgs').crop((382, 0, 422, 6))


def tono(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


def cascote(semilla, w, h, grano):
    """Un pedazo de piedra: poligono irregular con el grano del salon, luz
    arriba a la izquierda y sombra abajo a la derecha."""
    rnd = random.Random(semilla)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = []
    n = 9
    import math
    for i in range(n):
        a = math.pi * 2 * i / n
        rx, ry = (w / 2 - 1) * rnd.uniform(0.72, 1.0), (h / 2 - 1) * rnd.uniform(0.7, 1.0)
        pts.append((w / 2 + math.cos(a) * rx, h / 2 + math.sin(a) * ry))
    d.polygon(pts, fill=(255, 255, 255, 255), outline=CONTORNO)
    px = im.load()
    gp = grano.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and px[x, y] != CONTORNO:
                u = (x / w + y / h) / 2
                f = 1.08 if u < 0.34 else 0.9 if u < 0.62 else 0.68
                px[x, y] = tono(gp[(x * 3 + semilla * 17) % grano.width, y % grano.height], f)
    paleta = [None, None, None, (78, 66, 64, 255)]
    # grietas
    for _ in range(2):
        x = rnd.randint(w // 4, 3 * w // 4)
        y = rnd.randint(h // 4, 3 * h // 4)
        for k in range(rnd.randint(2, 4)):
            if 0 <= x < w and 0 <= y < h and px[x, y][3]:
                px[x, y] = paleta[3]
            x += rnd.choice((-1, 0, 1))
            y += 1
    return im


def indexado(hoja):
    """PNG con paleta si cabe en 255 colores; si no (el salon pintado tiene
    mas), RGBA tal cual."""
    Wh, Hh = hoja.size
    colores = hoja.getcolors(1 << 20)
    opacos = {c[:3] for n, c in colores if c[3]}
    if len(opacos) > 255:
        buf = io.BytesIO()
        hoja.save(buf, 'PNG', optimize=True)
        return buf.getvalue(), len(opacos)
    datos = hoja.tobytes()
    tabla, lista = {}, [(0, 0, 0)]
    out = bytearray(Wh * Hh)
    for p in range(Wh * Hh):
        if datos[4 * p + 3] == 0:
            continue
        c = (datos[4 * p], datos[4 * p + 1], datos[4 * p + 2])
        i = tabla.get(c)
        if i is None:
            i = tabla[c] = len(lista)
            lista.append(c)
        out[p] = i
    idx = Image.frombytes('P', (Wh, Hh), bytes(out))
    idx.putpalette([v for c in lista for v in c])
    buf = io.BytesIO()
    idx.save(buf, 'PNG', optimize=True, transparency=0)
    return buf.getvalue(), len(lista) - 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ruta', help='carpeta PNG/Battleground2/Bright del pack')
    ap.add_argument('--vista', help='escribe tambien el salon a x2 con guias')
    args = ap.parse_args()

    fondo, llamas = salon(args.ruta)
    # Los cascotes, del tamaño de un bloque de la boveda: 68x52 en el juego,
    # un tercio de lo que mide ella. Con 40x40 eran piedrecitas a sus pies y
    # no se leian como obstaculo.
    grano = textura(args.ruta)
    piezas = {
        'repisa': repisa(args.ruta),
        'cascote0': cascote(3, 34, 26, grano),
        'cascote1': cascote(7, 30, 24, grano),
        'cascote2': cascote(11, 36, 27, grano),
    }
    # la hoja: el salon arriba, las piezas en fila debajo
    alto_piezas = max(p.height for p in piezas.values())
    hoja = Image.new('RGBA', (W, H + 2 + alto_piezas), (0, 0, 0, 0))
    hoja.paste(fondo, (0, 0))
    x = 0
    rects = {'salon': (0, 0, W, H)}
    for nom, p in piezas.items():
        hoja.paste(p, (x, H + 2))
        rects[nom] = (x, H + 2, p.width, p.height)
        x += p.width + 1
    png, ncol = indexado(hoja)
    os.makedirs(os.path.dirname(SALIDA_PNG), exist_ok=True)
    with open(SALIDA_PNG, 'wb') as fh:
        fh.write(png)
    lineas = [
        '// GENERADO por tools/arena-atlas.py -- no se edita a mano.',
        '//',
        '// El salon del castillo ("Free Pixel Art Fantasy Game Battlegrounds" de',
        '// CraftPix, el 2), alargado a 600x270 y las piezas de la arena, todo en',
        '// PIXELES DEL DIBUJO: en el juego se pinta a x2, como ella.',
        '// Cada pieza: [x, y, ancho, alto] en img/arena.png.',
        'export const ESCALA = 2;',
        'export const PIEZAS = {',
    ]
    for nom, r in rects.items():
        lineas.append(f'  {nom}: [{r[0]}, {r[1]}, {r[2]}, {r[3]}],')
    lineas.append('};')
    lineas.append('// Las llamas de las velas (su centro, en pixeles del dibujo): el juego las')
    lineas.append('// hace parpadear. El halo ya viene pintado en el salon, pero quieto.')
    lineas.append('export const LLAMAS = [' + ', '.join(f'[{x}, {y}]' for x, y in llamas) + '];')
    with open(SALIDA_JS, 'w', encoding='utf-8', newline=NL) as fh:
        fh.write(NL.join(lineas) + NL)
    print(f'hoja {hoja.width}x{hoja.height}, {ncol} colores, PNG {len(png) / 1024:.0f} KB -> {os.path.relpath(SALIDA_PNG)}')

    if args.vista:
        v = fondo.resize((W * 2, H * 2), Image.NEAREST)
        d = ImageDraw.Draw(v)
        for y, col in ((452, (255, 60, 60, 255)), (362, (60, 255, 60, 255))):
            d.line([(0, y), (W * 2, y)], fill=col)
        for x in (60, 1140):
            d.line([(x, 0), (x, H * 2)], fill=(255, 255, 0, 255))
        v.save(args.vista)
        print('vista ->', args.vista)


if __name__ == '__main__':
    sys.exit(main())
