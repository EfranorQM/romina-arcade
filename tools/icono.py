"""Genera el icono del APK: el BLASON de RomiQuest, en pixel art.

    python tools/icono.py                # escribe los PNG en android/
    python tools/icono.py --hoja out.png # hoja de contactos para revisarlo
    python tools/icono.py --verificar    # comprueba la zona segura y las mascaras

Como el resto del arte del proyecto, no hay archivos de imagen de origen: la
geometria vive aqui y se rasteriza con PIL.

DE DONDE SALE
    El 23-09-2026 Anderson dijo que el icono anterior -- un escudo de madera con
    una espada, en una rejilla de 24x24 -- era "muy sencillo", y pidio ver
    disenos antes de elegir. Hubo cuatro propuestas (Romina dando un tajo con la
    estela en rosa, este blason, un corazon alado y Romina frente al ogro) y
    eligio el BLASON. Es la evolucion del escudo: el mismo objeto, pero con
    todo lo que le faltaba.

QUE SE DIBUJA
    Un escudo de punta redonda con los colores de la capa de Romina (campo
    azul adamascado, borde de oro), un corazon rosa en el centro, una corona de
    tres puntas con perlas encima y dos espadas en aspa DETRAS: las empunaduras
    asoman por arriba, a los lados de la corona, y las puntas por abajo, a los
    lados de la punta del escudo.

POR QUE UNA REJILLA DE 40x42
    La de 24x24 no daba para mas que un escudo con una cruz: por eso se veia
    sencillo. Con 40 celdas de ancho caben el borde de oro de dos celdas, el
    adamascado del campo, un corazon con brillo y una corona con perlas.

POR QUE YA NO SE ESCALA A CELDAS ENTERAS
    El icono de 24x24 buscaba que cada celda midiera un numero entero de pixeles
    en cada densidad. Con 40 celdas eso es imposible: no hay una escala entera
    que quepa en la zona segura en las cinco densidades (a 108 px, una celda de
    1 px deja el escudo en tres cuartos de su tamano y una de 2 px lo saca del
    circulo). Y tampoco se veria: el launcher reescala el icono a su tamano, y
    en el telefono de ella (xxhdpi, 440 dpi) nunca se pinta a 1:1.
    Asi que el pixel art se amplia con NEAREST a 16 px por celda -- sin
    suavizar ni una celda -- y ESE dibujo se reduce con BOX (media de area, sin
    los halos que deja LANCZOS en los bordes duros) al tamano exacto de cada
    densidad.

LOS DOS ICONOS SON DISTINTOS, NO EL MISMO A DOS TAMANOS
    ic_launcher (48..192)     se ve ENTERO. Trae su silueta y su fondo horneados,
                              y el arte se redibuja mas grande para llenarla.
    ic_launcher_foreground    lo RECORTA el launcher. Solo el circulo central de
    (108..432)                66dp de 108 esta garantizado, asi que el arte vive
                              ahi dentro y el fondo lo pone la otra capa.
    Generar el mismo dibujo para ambos deja el legacy diminuto: ese fue un bug
    real de la primera version, visible solo al compararlos lado a lado.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

C = 432.0          # lienzo de referencia
SAFE_R = 132.0     # radio de la zona segura del adaptive icon, en coords de 432

# Densidades reales de Android: (carpeta, tamano legacy, tamano foreground)
DENSITIES = [
    ('mdpi',    48,  108),
    ('hdpi',    72,  162),
    ('xhdpi',   96,  216),
    ('xxhdpi',  144, 324),
    ('xxxhdpi', 192, 432),
]


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def lerp(c0, c1, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(4))


PAL = {
    'bg_in':   '3a2466',   # centro del degradado de fondo
    'bg_out':  '0d0620',   # esquina; es el theme-color del juego
    'glow':    'ff5c9d',   # el halo rosa detras del blason (el color del arcade)
}

# La paleta del pixel art, de claro a oscuro. El azul es el de la capa de
# Romina en el juego (romi-atlas.js): el blason son sus colores.
O = hexc('1d0f24')                       # contorno (violeta muy oscuro, no negro)
ORO = [hexc('fff0a0'), hexc('ffe066'), hexc('d9a52a'), hexc('8a6216'), hexc('5a3d0c')]
AZ = [hexc('6a98f0'), hexc('4878d8'), hexc('3060c0'), hexc('243c90'), hexc('182a66')]
ROS = [hexc('ffd0e2'), hexc('ff8fbc'), hexc('ff5c9d'), hexc('d62a6e'), hexc('8e1448')]
ACE = [hexc('ffffff'), hexc('d4dcf0'), hexc('8a97b8'), hexc('4a5570')]
CUERO = [hexc('7a4a2a'), hexc('5c3a21')]
PERLA = [hexc('ffffff'), hexc('ffd0e2')]

N_W, N_H = 40, 42  # la rejilla
EJE = 19.5         # el eje de simetria, entre las columnas 19 y 20 (x -> 39 - x)

# EL ESCUDO, fila a fila: medio-ancho en celdas. Se define por su mitad y se
# refleja, asi es simetrico por construccion y no por buen pulso.
ESC_TOP = 12
ESCUDO_FILAS = {
    0: 12, 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12, 7: 12, 8: 12, 9: 12, 10: 12,
    11: 12, 12: 12, 13: 12, 14: 11, 15: 11, 16: 10, 17: 10, 18: 9, 19: 8, 20: 7,
    21: 6, 22: 5, 23: 4, 24: 3, 25: 2, 26: 1,
}

# Cuantos pixeles mide una celda en el lienzo de 432. MEDIDO, no a ojo: con
# 5.29 el punto mas lejano (los pomos de las espadas) cae a 130.9 del centro,
# con el limite de la zona segura en 132 (python tools/icono.py --verificar).
ESCALA = 5.29


# ------------------------------------------------------------ la rejilla
class Rejilla:
    """Una rejilla de celdas de color. Lo que se pinta despues tapa lo de antes."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.c = [[None] * w for _ in range(h)]

    def put(self, x, y, col):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h and col is not None:
            self.c[y][x] = col

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.c[y][x]
        return None

    def imagen(self):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                if self.c[y][x] is not None:
                    px[x, y] = self.c[y][x]
        return im


VECINOS4 = [(1, 0), (-1, 0), (0, 1), (0, -1)]
VECINOS8 = VECINOS4 + [(1, 1), (1, -1), (-1, 1), (-1, -1)]


def mascara(f):
    return {(x, y) for y in range(N_H) for x in range(N_W) if f(x, y)}


def borde_ext(m, diag=True):
    """Las celdas de FUERA que tocan la mascara: donde va el contorno."""
    out = set()
    for (x, y) in m:
        for dx, dy in (VECINOS8 if diag else VECINOS4):
            if (x + dx, y + dy) not in m:
                out.add((x + dx, y + dy))
    return out


def encoger(m, n=1, diag=False):
    for _ in range(n):
        b = borde_ext(m, diag)
        m = {p for p in m
             if not any((p[0] + dx, p[1] + dy) in b for dx, dy in (VECINOS8 if diag else VECINOS4))}
    return m


def biselar(g, m, claro, medio, oscuro):
    """Volumen en BANDAS PLANAS, que es como se hace en pixel art: la luz entra
    por arriba a la izquierda, asi que la celda con el vacio en esa diagonal va
    clara y la que lo tiene en la contraria, oscura."""
    for (x, y) in m:
        hacia = (x - 1, y - 1) not in m
        contra = (x + 1, y + 1) not in m
        g.put(x, y, claro if hacia and not contra else oscuro if contra and not hacia else medio)


# ------------------------------------------------------------ las piezas
def escudo_m():
    m = set()
    for r, h in ESCUDO_FILAS.items():
        for x in range(int(EJE + 0.5 - h), int(EJE + 0.5 + h)):
            m.add((x, ESC_TOP + r))
    # las dos esquinas de arriba, redondeadas
    m -= {(int(EJE + 0.5 - 12), ESC_TOP), (int(EJE + 0.5 + 11), ESC_TOP)}
    return m


def corazon_m(cx, cy, a):
    """La curva del corazon, (x^2 + y^2 - 1)^3 = x^2 y^3, muestreada en celdas."""
    def f(x, y):
        u = (x + 0.5 - cx) / a
        v = -(y + 0.5 - cy) / a
        return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0
    return mascara(f)


def espada(g, pomo, punta, mango=3):
    """Espada a 45 grados EXACTOS, del POMO a la PUNTA: es la unica pendiente
    que en una rejilla de pixeles sale limpia en vez de escalonada."""
    (px_, py_), (tx, ty) = pomo, punta
    n = abs(ty - py_)
    dx = 1 if tx > px_ else -1
    dy = 1 if ty > py_ else -1
    pts = [(px_ + dx * i, py_ + dy * i) for i in range(n + 1)]
    celdas = {}
    x, y = pts[0]
    for (ax, ay, c) in ((0, 0, ORO[1]), (-dx, 0, ORO[2]), (0, -dy, ORO[2]), (-dx, -dy, ORO[3])):
        celdas[(x + ax, y + ay)] = c                       # el pomo, 2x2 en oro
    for i in range(1, 1 + mango):
        celdas[pts[i]] = CUERO[i % 2]                      # el mango, a franjas
    gx, gy = pts[1 + mango]
    # La guarda, PERPENDICULAR a la hoja. Dibujarla en la misma direccion la
    # deja paralela al filo y no se lee como guarda (fallo real del icono
    # anterior).
    for k in range(-3, 4):
        celdas[(gx + k, gy - k * dx * dy)] = ORO[0] if abs(k) == 3 else ORO[1]
    celdas[(gx, gy)] = ROS[2]                              # una joya en el centro
    for i in range(2 + mango, n + 1):
        x, y = pts[i]
        celdas[(x, y)] = ACE[1] if i < n else ACE[0]       # el filo, y la punta que brilla
        if i < n:
            celdas[(x + dx, y)] = ACE[2]
    for p in borde_ext(set(celdas)):
        g.put(p[0], p[1], O)
    for p, c in celdas.items():
        g.put(p[0], p[1], c)


def corona(g, top):
    """Corona en zigzag: tres puntas que se tocan por la base, con una perla en
    cada una. La primera version las hacia finas y separadas, y las perlas se
    leian como velas."""
    base_y = top + 6
    perfil = {13: 2, 14: 4, 15: 3, 16: 2, 17: 2, 18: 4, 19: 5}   # alto por columna; se refleja
    m = set()
    for x, alto in perfil.items():
        for xx in (x, 39 - x):
            for y in range(base_y - alto, base_y + 3):
                m.add((xx, y))
    perlas = [(14, base_y - 5), (25, base_y - 5), (19, base_y - 6), (20, base_y - 6)]
    m |= set(perlas)
    for p in borde_ext(m):
        g.put(p[0], p[1], O)
    biselar(g, m - set(perlas), ORO[1], ORO[2], ORO[3])
    for x in range(13, 27):
        g.put(x, base_y + 2, ORO[3])                       # el canto de la banda
        g.put(x, base_y, ORO[0] if x < 20 else ORO[1])     # y su filo de luz
    for (x, c, c2) in ((15, ROS[2], ROS[1]), (19, AZ[2], AZ[0]), (23, ROS[2], ROS[1])):
        g.put(x, base_y + 1, c2)
        g.put(x + 1, base_y + 1, c)                        # rosa, azul, rosa
    for (x, y) in perlas:
        g.put(x, y, PERLA[0] if x <= 19 else PERLA[1])


# El corazon, donde y de que tamano: lo comparten el dibujo y la capa monocroma.
CORAZON = (EJE, 23.4, 5.3)


def blason():
    """El blason entero en su rejilla. Devuelve la imagen de N_W x N_H celdas."""
    g = Rejilla(N_W, N_H)
    # Las espadas van PRIMERO: el escudo las tapa y solo asoman sus extremos.
    espada(g, (4, 5), (32, 33))
    espada(g, (35, 5), (7, 33))

    esc = escudo_m()
    for p in borde_ext(esc):
        g.put(p[0], p[1], O)
    campo = encoger(esc, 2, diag=True)
    biselar(g, esc - campo, ORO[1], ORO[2], ORO[3])       # el borde de oro, dos celdas
    biselar(g, campo, AZ[1], AZ[2], AZ[3])
    # El adamascado: una rejilla de rombos un tono por encima. A 48 px no se ve,
    # y esta bien: lo que hace es que el campo no parezca un plano de color
    # cuando el icono se ve grande.
    for (x, y) in encoger(campo, 1, diag=True):
        if (x + y) % 4 == 0 and (x - y) % 4 == 0 and g.get(x, y) == AZ[2]:
            g.put(x, y, AZ[1])

    cor = corazon_m(*CORAZON)
    for p in borde_ext(cor):
        g.put(p[0], p[1], O)
    biselar(g, cor, ROS[1], ROS[2], ROS[3])
    for p in ((16, 21), (17, 20), (16, 20)):               # el brillo del corazon
        if p in cor:
            g.put(p[0], p[1], ROS[0])

    corona(g, 1)
    return g.imagen()


def pixel_art():
    return blason()


# ------------------------------------------------------------ de celdas a pixeles
def draw_art(size, celda, cx=None, cy=None):
    """El blason, a `celda` pixeles por celda, centrado en un lienzo de `size`.

    Se amplia con NEAREST a 16 px por celda y se reduce con BOX al tamano
    exacto (ver la cabecera). Se centra su caja, no la rejilla: la rejilla
    tiene celdas vacias alrededor y descentraria el dibujo.
    """
    art = pixel_art()
    art = art.crop(art.getbbox())
    grande = art.resize((art.width * 16, art.height * 16), Image.NEAREST)
    w = max(1, int(round(art.width * celda)))
    h = max(1, int(round(art.height * celda)))
    peq = grande.resize((w, h), Image.BOX)
    cx = size / 2.0 if cx is None else cx
    cy = size / 2.0 if cy is None else cy
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(peq, (int(round(cx - w / 2.0)), int(round(cy - h / 2.0))))
    return out


def chispa(im, x, y, k, color, brazo):
    """Destello de cuatro puntas: una cruz de celdas de k pixeles."""
    d = ImageDraw.Draw(im)
    for i in range(-brazo, brazo + 1):
        d.rectangle([x + i * k, y, x + i * k + k - 1, y + k - 1], fill=color)
        d.rectangle([x, y + i * k, x + k - 1, y + i * k + k - 1], fill=color)


# Los destellos del fondo, en fracciones del lienzo. Van a los lados del
# escudo, a media altura: ahi hay hueco entre el dibujo y el borde, y quedan
# DENTRO del circulo, asi que tampoco los recorta la mascara redonda.
CHISPAS = [
    (0.245, 0.46, 'ffffff', 2),
    (0.765, 0.40, 'ffe066', 1),
    (0.275, 0.66, 'ffd0e2', 1),
    (0.735, 0.64, 'ffffff', 1),
]


def draw_background(size, chispas=True):
    """Capa de fondo del adaptive icon: radial opaco hasta la ultima esquina,
    el halo rosa y los destellos.

    Nunca puede quedar transparente: la mascara mas permisiva dejaria ver un
    borde vacio.
    """
    im = Image.new('RGBA', (size, size), hexc(PAL['bg_out']))
    d = ImageDraw.Draw(im)
    R = size * 0.62
    steps = max(60, int(R))
    for i in range(steps, 0, -1):
        t = i / steps
        r = R * t
        d.ellipse([size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r],
                  fill=lerp(hexc(PAL['bg_in']), hexc(PAL['bg_out']), t))

    # Halo rosa detras del blason: se nota que hay luz sin robarle contraste
    # al dibujo. Es luz, no dibujo, asi que esta capa SI es suave.
    m = Image.new('L', (size, size), 0)
    r = size * 0.24
    ImageDraw.Draw(m).ellipse([size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r],
                              fill=int(255 * 0.28))
    m = m.filter(ImageFilter.GaussianBlur(size * 0.10))
    luz = Image.new('RGBA', (size, size), hexc(PAL['glow']))
    luz.putalpha(m)
    im.alpha_composite(luz)

    if chispas:
        k = max(1, int(round(4 * size / C)))
        for (x, y, col, brazo) in CHISPAS:
            chispa(im, int(size * x), int(size * y), k, hexc(col), brazo)
    return im


def draw_foreground(size, geo=None):
    return draw_art(size, ESCALA * size / C)


def draw_legacy(size, geo=None, round_shape=False):
    """Icono legacy: se ve entero, asi que trae silueta, fondo y sombra propios."""
    m = 4 * (size / 192.0)
    inner = size - 2 * m

    sil = Image.new('L', (size, size), 0)
    ds = ImageDraw.Draw(sil)
    if round_shape:
        ds.ellipse([m, m, size - m, size - m], fill=255)
    else:
        ds.rounded_rectangle([m, m, size - m, size - m], radius=40 * (size / 192.0), fill=255)

    # El arte se REDIBUJA mas grande: aqui no hay mascara del launcher, el
    # lienzo util es todo. En el redondo, el alto del blason tiene que caber
    # en el circulo, y ahi manda la diagonal de las empunaduras: va mas chico.
    art = pixel_art()
    bb = art.getbbox()
    alto = bb[3] - bb[1]
    llenado = 0.70 if round_shape else 0.80
    art_im = draw_art(size, inner * llenado / alto)

    # Sin destellos: en el legacy el blason llena la silueta y se quedaban
    # pegados al borde del escudo, como manchas.
    comp = Image.alpha_composite(draw_background(size, chispas=False), art_im)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(comp, (0, 0), sil)          # el halo no puede desbordar la silueta

    sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sh.paste(Image.new('RGBA', (size, size), (0, 0, 0, 90)), (0, 0), sil)
    sh = sh.filter(ImageFilter.GaussianBlur(3 * (size / 192.0)))
    shifted = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shifted.paste(sh, (0, int(round(2 * (size / 192.0)))))
    return Image.alpha_composite(shifted, out)


def draw_monochrome(size, geo=None):
    """Capa monocroma (Android 13+, iconos tematicos): la silueta del blason
    CON EL CORAZON CALADO.

    La silueta sale del ALFA del propio pixel art, asi que sigue exactamente la
    forma del icono de color. Pero a una sola tinta el corazon desapareceria
    dentro del escudo, y es lo que distingue este blason de cualquier otro:
    por eso se vacia, y se lee como un hueco con forma de corazon.
    """
    art = pixel_art()
    cor = corazon_m(*CORAZON)
    px = art.load()
    for (x, y) in cor:
        px[x, y] = (0, 0, 0, 0)
    bb = art.getbbox()
    art = art.crop(bb)
    celda = ESCALA * size / C
    grande = art.split()[3].resize((art.width * 16, art.height * 16), Image.NEAREST)
    w = max(1, int(round(art.width * celda)))
    h = max(1, int(round(art.height * celda)))
    alfa = grande.resize((w, h), Image.BOX)
    mask = Image.new('L', (size, size), 0)
    mask.paste(alfa, (int(round(size / 2.0 - w / 2.0)), int(round(size / 2.0 - h / 2.0))))
    out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    out.putalpha(mask)
    return out


# ------------------------------------------------------------------ salida
def escribir(res_dir):
    n = 0
    for name, legacy, fg in DENSITIES:
        d = os.path.join(res_dir, 'mipmap-' + name)
        os.makedirs(d, exist_ok=True)
        draw_legacy(legacy).save(os.path.join(d, 'ic_launcher.png'))
        draw_legacy(legacy, round_shape=True).save(os.path.join(d, 'ic_launcher_round.png'))
        draw_foreground(fg).save(os.path.join(d, 'ic_launcher_foreground.png'))
        draw_background(fg).save(os.path.join(d, 'ic_launcher_background.png'))
        draw_monochrome(fg).save(os.path.join(d, 'ic_launcher_monochrome.png'))
        n += 5
        print(f'  {name:8s} legacy {legacy}px  adaptive {fg}px')
    return n


def verificar():
    """Comprueba lo unico que puede romper el icono en el telefono: el recorte."""
    fg = draw_foreground(432)
    px = fg.split()[3].load()
    far = 0.0
    minx = miny = 432
    maxx = maxy = 0
    for y in range(432):
        for x in range(432):
            if px[x, y] > 200:          # el umbral excluye el halo, que si puede salirse
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
                far = max(far, math.hypot(x - 216, y - 216))

    print(f'  bbox de solidos: x {minx}..{maxx}  y {miny}..{maxy}')
    print(f'  centro vertical: {(miny + maxy) / 2:.1f} (ideal 216)')
    ok = far <= SAFE_R
    print(f'  punto mas lejano del centro: {far:.1f}  limite {SAFE_R:.0f}  -> {"OK" if ok else "SE RECORTA"}')

    masks = {}
    c = Image.new('L', (432, 432), 0)
    ImageDraw.Draw(c).ellipse([72, 72, 360, 360], fill=255)
    masks['circulo'] = c
    r = Image.new('L', (432, 432), 0)
    ImageDraw.Draw(r).rounded_rectangle([72, 72, 360, 360], radius=62, fill=255)
    masks['cuadrado redondeado'] = r

    for nombre, m in masks.items():
        mp = m.load()
        tot = lost = 0
        for y in range(432):
            for x in range(432):
                if px[x, y] > 200:
                    tot += 1
                    if mp[x, y] == 0:
                        lost += 1
        pct = 100.0 * lost / max(1, tot)
        ok = ok and pct == 0.0
        print(f'  perdida bajo {nombre}: {pct:.2f}%')

    a1 = fg.getpixel((4, 4))[3]
    a2 = fg.getpixel((0, 215))[3]
    print(f'  esquinas del foreground transparentes: {a1 == 0 and a2 == 0}')
    ok = ok and a1 == 0 and a2 == 0
    return ok


def hoja(path):
    """Hoja de contactos: el icono a tamano real y bajo las mascaras del launcher."""
    sizes = [48, 72, 96, 144, 192]

    def mask_of(size, kind):
        m = Image.new('L', (size * 4, size * 4), 0)
        d = ImageDraw.Draw(m)
        if kind == 'circle':
            d.ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
        else:
            d.rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1],
                                radius=int(size * 4 * 0.22), fill=255)
        return m.resize((size, size), Image.LANCZOS)

    filas = []
    filas.append(('legacy', [draw_legacy(s) for s in sizes]))
    filas.append(('legacy redondo', [draw_legacy(s, round_shape=True) for s in sizes]))
    for kind, etiqueta in (('squircle', 'adaptive squircle'), ('circle', 'adaptive circulo')):
        ims = []
        for s in sizes:
            canvas = int(s * 108 / 72)
            comp = Image.alpha_composite(draw_background(canvas), draw_foreground(canvas))
            off = (canvas - s) // 2
            comp = comp.crop((off, off, off + s, off + s))
            o = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            o.paste(comp, (0, 0), mask_of(s, kind))
            ims.append(o)
        filas.append((etiqueta, ims))
    # Los iconos tematicos de Android 13: la capa monocroma, tenida.
    ims = []
    for s in sizes:
        canvas = int(s * 108 / 72)
        mono = draw_monochrome(canvas)
        fondo = Image.new('RGBA', (canvas, canvas), (215, 227, 255, 255))
        tinta = Image.new('RGBA', (canvas, canvas), (40, 56, 110, 255))
        fondo.paste(tinta, (0, 0), mono.split()[3])
        off = (canvas - s) // 2
        fondo = fondo.crop((off, off, off + s, off + s))
        o = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        o.paste(fondo, (0, 0), mask_of(s, 'circle'))
        ims.append(o)
    filas.append(('tematico (A13+)', ims))

    W = sum(s + 20 for s in sizes) + 150
    fila_h = max(sizes) + 34
    sheet = Image.new('RGBA', (W, fila_h * len(filas) + 20), (26, 26, 32, 255))
    d = ImageDraw.Draw(sheet)
    for i, (etiqueta, ims) in enumerate(filas):
        y = 20 + i * fila_h
        if i % 2:
            d.rectangle([0, y - 10, W, y + fila_h - 14], fill=(233, 233, 239, 255))
        d.text((8, y + max(sizes) // 2), etiqueta, fill=(150, 150, 160, 255))
        x = 150
        for s, im in zip(sizes, ims):
            sheet.alpha_composite(im, (x, y + (max(sizes) - s) // 2))
            d.text((x, y + max(sizes) + 4), f'{s}px', fill=(140, 140, 150, 255))
            x += s + 20
    sheet.save(path)
    print('escrito', path)


def main():
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    args = sys.argv[1:]

    if '--hoja' in args:
        hoja(args[args.index('--hoja') + 1])
        return
    if '--verificar' in args:
        print('Verificando el icono:')
        sys.exit(0 if verificar() else 1)

    res = os.path.join(raiz, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(res):
        print('No existe android/. Corre antes:  npx cap add android')
        sys.exit(1)

    print('Generando el icono (el blason):')
    n = escribir(res)

    # El adaptive icon debe apuntar a las capas de aqui: con el <color> blanco
    # que trae la plantilla de Capacitor, el fondo destruia el dibujo.
    anydpi = os.path.join(res, 'mipmap-anydpi-v26')
    os.makedirs(anydpi, exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
           '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
           '</adaptive-icon>\n')
    for fn in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        with open(os.path.join(anydpi, fn), 'w', encoding='utf-8') as f:
            f.write(xml)

    print(f'\nListo: {n} PNG + 2 XML.')
    if not verificar():
        print('\nAVISO: el icono no pasa la verificacion de zona segura.')
        sys.exit(1)


if __name__ == '__main__':
    main()
