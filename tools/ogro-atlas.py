"""Hornea el OGRO de ROMINA a partir de un pack de sprites dibujados a mano.

    python tools/ogro-atlas.py RUTA/PNG/Animation/Troll1
    python tools/ogro-atlas.py RUTA/PNG/Animation/Troll1 --hoja hoja.png

Escribe www/img/ogro.png (la hoja de fotogramas) y www/js/games/ogro-atlas.js
(donde esta cada fotograma en la hoja y donde tiene los pies).

EL PNG VA APARTE, NO EN BASE64 DENTRO DEL JS: el actualizador es de todo o
nada (si falla un solo fichero tira la version entera), asi que un PNG suelto
no puede faltar, y en base64 pesaria un 33 % mas.

POR QUE EL OGRO YA NO SE DIBUJA POR CODIGO
    El ogro de antes era una pose de ~20 numeros sobre piezas rigidas. Eso
    MUEVE piezas pero no REDIBUJA el cuerpo: en la carga y en el garrotazo el
    torso era el mismo y solo giraba el brazo (`incl` desplazaba 4 px, no
    rotaba). Un ataque de verdad se redibuja entero -- se agacha, se retuerce,
    el garrote sube por encima de la cabeza -- y eso lo hace un animador, no un
    ajuste de numeros. Ver la memoria arcade-techo-del-muneco-por-codigo.

DE DONDE SALE
    "2D Game Troll Free Character Sprites" de CraftPix, gratis tambien en
    itch.io: https://free-game-assets.itch.io/free-2d-game-troll
    Tres trolls con garrote, 7 animaciones de 10 fotogramas, pintados a
    ~1600 px. Se usa el Troll1 (el verde): es el que mejor se lee sobre el
    fondo morado del campo.

    LICENCIA: uso libre en juegos, tambien comerciales, sin atribucion
    obligatoria. Lo que NO se puede es revender ni redistribuir los archivos
    de origen. Por eso el pack NO esta en el repo (que es publico): solo la
    hoja reducida al tamaño del juego, que es parte del juego.

LOS PASOS, Y LA TRAMPA DE CADA UNO
    1. ALINEAR. Spriter exporta cada animacion en un lienzo de tamaño y origen
       distintos (Idle 1056x715, Attack 1598x1323...). Si se usan tal cual, el
       ogro pega un salto cada vez que cambia de animacion. OFFSETS lleva el
       desplazamiento de cada lienzo respecto al de Idle, sacado registrando
       el fotograma 0 de cada animacion contra Idle_000 (correlacion por FFT
       de las mascaras alfa). Coinciden al 97-99 % Attack, Jump, Hurt y Dead,
       que arrancan de la pose de reposo; Walk y Run arrancan de otra pose y
       se comprobaron superponiendolas.
    2. LA RAIZ es el punto entre los dos pies, en el suelo: (300, 705) en
       coordenadas de Idle. Todo fotograma se guarda con su desplazamiento
       respecto a ella, que es lo que el juego llama (x, SUELO).
    3. REDUCIR con alfa PREMULTIPLICADO. Reducir RGBA a pelo mezcla el color
       basura de los pixeles transparentes con el borde y deja un halo.
       Y se reduce por una CAJA DE ORIGEN que cae en pixeles enteros de
       destino: si cada animacion redondeara por su cuenta, el ogro temblaria
       un pixel al pasar de una a otra.
    4. BORDE DURO: el alfa se corta al 43 % (110/255). Romina es pixel art de
       bordes nitidos; un ogro con el borde difuminado parece pegado encima.
    5. UNA SOLA PALETA de 32 colores para todos (median cut, SIN tramado).
       Con una paleta por fotograma, la misma sombra cambiaria de tono entre
       uno y otro y el ogro parpadearia al moverse.
    6. CONTORNO de 1 px oscuro alrededor de la silueta, como el de ella.
"""
import argparse
import io
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_JS = os.path.join(AQUI, '..', 'www', 'js', 'games', 'ogro-atlas.js')
SALIDA_PNG = os.path.join(AQUI, '..', 'www', 'img', 'ogro.png')

ALTO = 232            # lo que mide de pie, en px de juego (= ALTO de ogro-cuerpo.js)
RAIZ = (300, 705)     # entre los pies, en el suelo, en coordenadas de Idle
K = ALTO / RAIZ[1]    # escala de origen -> juego (0.329)
CORTE_ALFA = 110
COLORES = 32          # a tamaño de telefono 24, 32 y 40 no se distinguen
CONTORNO = (20, 24, 16)
NL = '\n'

# Desplazamiento del lienzo de cada animacion respecto al de Idle (px de origen).
OFFSETS = {
    'Idle':   (0, 0),
    'Walk':   (-72, -2),
    'Run':    (-164, -572),
    'Attack': (-366, -554),
    'Jump':   (-136, -442),
    'Hurt':   (-178, -198),
    'Dead':   (14, 0),
}

# Nombre en el juego -> animacion del pack y QUE fotogramas se hornean. El
# reparto en el tiempo (cual cae en la carga, cual en el golpe) lo decide
# ogro-sprite.js, que es donde se conocen los tiempos de cada ataque.
#
# LO QUE PESA ES CADA FOTOGRAMA, ~14 KB por la textura pintada, sea cual sea.
# Con los 70 la hoja eran 1.1 MB, casi tanto como el juego entero, y bajar la
# paleta apenas ayuda (48 colores 918 KB, 24 colores 739). Asi que solo entra
# lo que se usa. El garrote, el salto y el paso van enteros: son lo que mas se
# mira. El reposo es de IDA Y VUELTA (del 6 al 9 repiten del 4 al 1, aunque no
# al pixel): se hornean del 0 al 5 y la vuelta la hace el juego. La carrera
# dura medio segundo y va a la mitad, y de la muerte sobran los primeros, que
# son casi el reposo.
ANIMS = [
    ('espera', 'Idle', range(6)),
    ('anda', 'Walk', range(10)),
    ('corre', 'Run', [0, 2, 4, 6, 8]),
    ('garrote', 'Attack', range(10)),
    ('salto', 'Jump', range(10)),
    ('dolor', 'Hurt', [0, 1, 2, 4, 6, 8]),
    ('muere', 'Dead', [0, 4, 5, 6, 7, 8, 9]),
]
MARGEN = 40           # px de origen transparentes alrededor, para que la caja no se salga


def reduce(ruta, anim, i):
    """Un fotograma de origen -> RGBA a escala de juego + su esquina respecto a la raiz."""
    im = Image.open(os.path.join(ruta, f'{anim}_{i:03d}.png')).convert('RGBA')
    pad = Image.new('RGBA', (im.width + 2 * MARGEN, im.height + 2 * MARGEN), (0, 0, 0, 0))
    pad.paste(im, (MARGEN, MARGEN))
    dx, dy = OFFSETS[anim]
    dx -= MARGEN
    dy -= MARGEN
    # Esquina del lienzo relleno, en px de juego y relativa a la raiz. Se lleva a
    # un pixel ENTERO de destino (hacia dentro, para que la caja no empiece en
    # negativo), y la caja de origen se mueve lo que haga falta.
    L = math.ceil((dx - RAIZ[0]) * K)
    T = math.ceil((dy - RAIZ[1]) * K)
    x0 = RAIZ[0] + L / K - dx
    y0 = RAIZ[1] + T / K - dy
    w = int((pad.width - x0) * K)
    h = int((pad.height - y0) * K)
    caja = (x0, y0, x0 + w / K, y0 + h / K)
    pm = pad.convert('RGBa').resize((w, h), Image.LANCZOS, box=caja).convert('RGBA')
    a = pm.getchannel('A').point(lambda v: 255 if v >= CORTE_ALFA else 0)
    pm.putalpha(a)
    bb = a.getbbox()
    if not bb:
        raise SystemExit(f'{anim}_{i:03d} sale vacio')
    # un pixel mas por cada lado, para el contorno
    bb = (bb[0] - 1, bb[1] - 1, bb[2] + 1, bb[3] + 1)
    return pm.crop(bb), L + bb[0], T + bb[1]


def contorno(im):
    """Anillo de 1 px (vecindad de cuatro) alrededor de la silueta."""
    a = im.getchannel('A')
    dil = a.copy()
    for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        s = Image.new('L', a.size, 0)
        s.paste(a, (ox, oy))
        dil = ImageChops.lighter(dil, s)
    anillo = ImageChops.subtract(dil, a)
    out = im.copy()
    out.paste(Image.new('RGBA', im.size, CONTORNO + (255,)), (0, 0), anillo)
    return out


def paleta(frames, colores):
    """Una paleta comun: se cuantiza un mosaico con TODOS los fotogramas.

    El fondo del mosaico es el color del contorno, que asi entra en la paleta
    y no se lleva un hueco aparte."""
    ancho = 1024
    mosaico = Image.new('RGB', (ancho, sum(f.height for f in frames)), CONTORNO)
    x = y = fila = 0
    for f in frames:
        if x + f.width > ancho:
            x = 0
            y += fila
            fila = 0
        mosaico.paste(f, (x, y), f)
        x += f.width
        fila = max(fila, f.height)
    mosaico = mosaico.crop((0, 0, ancho, y + fila))
    return mosaico.quantize(colors=colores, method=Image.MEDIANCUT, dither=Image.NONE)


def indexado(hoja):
    """RGBA -> PNG con paleta. El indice 0 es el transparente; el resto se
    asigna segun aparecen los colores, que son pocos y EXACTOS (ya salen de
    la paleta comun), asi que no hay aproximacion que pueda fallar."""
    W, H = hoja.size
    datos = hoja.tobytes()
    tabla = {}
    lista = [(0, 0, 0)]
    out = bytearray(W * H)
    for p in range(W * H):
        if datos[4 * p + 3] == 0:
            continue
        c = (datos[4 * p], datos[4 * p + 1], datos[4 * p + 2])
        i = tabla.get(c)
        if i is None:
            i = tabla[c] = len(lista)
            lista.append(c)
            if i > 255:
                raise SystemExit('mas de 255 colores: la paleta comun no se aplico')
        out[p] = i
    idx = Image.frombytes('P', (W, H), bytes(out))
    idx.putpalette([v for c in lista for v in c])
    buf = io.BytesIO()
    idx.save(buf, 'PNG', optimize=True, transparency=0)
    return buf.getvalue(), len(lista) - 1


def empaqueta(frames, ancho=2048):
    """Estanterias por altura. Devuelve (ancho, alto, posiciones).

    2048 de ancho y no 1024: la hoja sale menos alta. Hay GPUs de movil que no
    pasan de 4096 px por lado, y una hoja de 1024x6920 se sale."""
    orden = sorted(range(len(frames)), key=lambda i: -frames[i].height)
    pos = [None] * len(frames)
    x = y = fila = 0
    for i in orden:
        f = frames[i]
        if x + f.width > ancho:
            x = 0
            y += fila + 1
            fila = 0
        pos[i] = (x, y)
        x += f.width + 1
        fila = max(fila, f.height)
    return ancho, y + fila, pos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ruta', help='carpeta PNG/Animation/Troll1 del pack')
    ap.add_argument('--hoja', help='escribe tambien una hoja de contactos')
    ap.add_argument('--colores', type=int, default=COLORES, help='tamaño de la paleta comun')
    args = ap.parse_args()

    frames, meta = [], []
    for nom, anim, idx in ANIMS:
        for i in idx:
            f, ox, oy = reduce(args.ruta, anim, i)
            frames.append(f)
            meta.append((nom, i, ox, oy))

    pal = paleta(frames, args.colores)
    listos = []
    for f in frames:
        rgb = Image.new('RGB', f.size, CONTORNO)
        rgb.paste(f, (0, 0), f)
        q = rgb.quantize(palette=pal, dither=Image.NONE).convert('RGBA')
        q.putalpha(f.getchannel('A'))
        listos.append(contorno(q))

    # Los REPETIDOS comparten sitio en la hoja: mismo dibujo y mismos pies.
    unicos, cual, visto = [], [], {}
    for f, (n, i, ox, oy) in zip(listos, meta):
        clave = (f.size, ox, oy, f.tobytes())
        if clave not in visto:
            visto[clave] = len(unicos)
            unicos.append(f)
        cual.append(visto[clave])

    W, H, pos = empaqueta(unicos)
    hoja = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for f, p in zip(unicos, pos):
        hoja.paste(f, p)
    png, ncol = indexado(hoja)
    os.makedirs(os.path.dirname(SALIDA_PNG), exist_ok=True)
    with open(SALIDA_PNG, 'wb') as fh:
        fh.write(png)

    # --- La tabla ---
    lineas = []
    for nom, anim, idx in ANIMS:
        fs = []
        for (n, i, ox, oy), u in zip(meta, cual):
            if n == nom:
                f, p = unicos[u], pos[u]
                fs.append(f'[{p[0]},{p[1]},{f.width},{f.height},{ox},{oy}]')
        fuente = ', '.join(str(i) for i in idx)
        lineas.append(f'  // {anim}: {fuente}' + NL + f'  {nom}: [' + NL + '    ' +
                      (',' + NL + '    ').join(fs) + '],')
    cab = [
        '// GENERADO por tools/ogro-atlas.py -- no se edita a mano.',
        '//',
        '// El ogro, dibujado a mano: "2D Game Troll Free Character Sprites" de',
        '// CraftPix (free-game-assets.itch.io/free-2d-game-troll), de uso libre en',
        f'// juegos. Reducido a {ALTO} px de alto, paleta de {ncol} colores y contorno de 1 px.',
        '//',
        '// Cada fotograma: [x, y, ancho, alto, ox, oy] -- su rectangulo en',
        '// img/ogro.png y donde cae su esquina respecto a la RAIZ (entre los pies,',
        '// en el suelo), mirando a la DERECHA.',
        f'export const ALTO = {ALTO};',
        f'export const HOJA_W = {W}, HOJA_H = {H};',
        'export const FRAMES = {',
    ]
    js = NL.join(cab) + NL + NL.join(lineas) + NL + '};' + NL
    with open(SALIDA_JS, 'w', encoding='utf-8', newline=NL) as fh:
        fh.write(js)

    print(f'hoja {W}x{H}, {len(listos)} fotogramas ({len(unicos)} distintos), {ncol} colores, '
          f'PNG {len(png) / 1024:.0f} KB -> {os.path.relpath(SALIDA_PNG)}')

    # --- Medidas que el juego necesita ---
    print(NL + 'ALCANCE VISUAL por fotograma (borde delantero respecto a la raiz, px de juego):')
    for nom, anim, idx in ANIMS:
        fr = [ox + f.width for (n, i, ox, oy), f in zip(meta, listos) if n == nom]
        print(f'  {nom:8s}', ' '.join(f'{x:4d}' for x in fr))
    print(NL + 'ALTO por fotograma (lo mas alto respecto al suelo):')
    for nom, anim, idx in ANIMS:
        fr = [-oy for (n, i, ox, oy) in meta if n == nom]
        print(f'  {nom:8s}', ' '.join(f'{y:4d}' for y in fr))

    if args.hoja:
        cel, alto = 440, 470
        cols = max(len(list(idx)) for _, _, idx in ANIMS)
        sh = Image.new('RGBA', (cols * cel, len(ANIMS) * alto), (43, 31, 46, 255))
        d = ImageDraw.Draw(sh)
        k = 0
        for r, (nom, anim, idx) in enumerate(ANIMS):
            for c, i in enumerate(idx):
                n, i, ox, oy = meta[k]
                f = listos[k]
                k += 1
                bx, by = c * cel + 150, r * alto + alto - 24
                d.line([(c * cel, by), (c * cel + cel - 6, by)], fill=(90, 70, 90, 255))
                d.line([(bx, by - 240), (bx, by + 4)], fill=(90, 70, 90, 255))
                sh.paste(f, (bx + ox, by + oy), f)
                d.text((c * cel + 4, r * alto + 2), f'{nom} {i}', fill=(255, 224, 102, 255))
        sh.save(args.hoja)
        print('hoja de contactos ->', args.hoja)


if __name__ == '__main__':
    sys.exit(main())
