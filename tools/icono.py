"""Genera el icono del APK: una marquesina de arcade, dibujada por codigo.

    python tools/icono.py                # escribe los PNG en android/
    python tools/icono.py --hoja out.png # hoja de contactos para revisarlo
    python tools/icono.py --verificar    # comprueba la zona segura y las mascaras

Como el resto del arte del proyecto, no hay archivos de imagen de origen: la
geometria vive aqui y se rasteriza con PIL. Se dibuja a 8x y se reduce con
LANCZOS, que es de donde sale el antialiasing (el icono es "suave" a proposito;
el look pixelado del menu lo pone el motor, no el arte).

QUE SE DIBUJA
    Un gabinete de recreativa visto de frente: marquesina de neon rosa con tres
    bombillas, un cuello estrecho, y el mueble en cian con la pantalla oscura y
    el panel de control debajo. Sin letras: a 48px cualquier texto acaba en barro.

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

C = 432.0          # lienzo de referencia: todo se define aqui y luego escala
SS = 8             # supersampling; el antialiasing sale de reducir desde aqui
SAFE_R = 132.0     # radio de la zona segura del adaptive icon, en coords de 432

# Densidades reales de Android: (carpeta, tamano legacy, tamano foreground)
DENSITIES = [
    ('mdpi',    48,  108),
    ('hdpi',    72,  162),
    ('xhdpi',   96,  216),
    ('xxhdpi',  144, 324),
    ('xxxhdpi', 192, 432),
]

# Geometria, en coordenadas del lienzo de 432: (x0, y0, x1, y1, radio).
#
# Las cotas estan MEDIDAS, no estimadas. El limite lo marcan las esquinas
# superiores de la marquesina, que son el punto mas lejano del centro: con la
# anatomia inicial daban 145.8px y el telefono habria recortado el mueble.
# Asi como esta, el punto mas lejano cae en 125.5 frente al limite de 132.
GEO = {
    'marquee': (124, 120, 308, 164, 22),
    'neck':    (186, 162, 246, 196, 0),
    'body':    (147, 194, 285, 322, 24),
    'screen':  (165, 208, 267, 270, 13),
    'panel':   (163, 286, 269, 307, 10),
    'bulbs':   [(160, 120), (216, 120), (272, 120)],
    'bulb_r':  9,
}

PAL = {
    'bg_in':      '2a1a3d',   # centro del degradado de fondo
    'bg_out':     '0d0620',   # esquina; es el theme-color del juego
    'glow_pink':  'ff5c9d',   # rosa de marca, solo para el halo
    'glow_amber': 'f0b45a',
    'mq_edge':    'ffb3d9',   # canto del tubo de neon
    'mq_core':    'ff3d86',   # nucleo saturado
    'body_top':   '7fe8d4',   # arista alta: recibe el rebote del neon
    'body_bot':   '1f8f80',
    'neck':       '2a8f9e',
    'scr_top':    '120a2e',   # pantalla: oscura arriba, para que hunda
    'scr_bot':    '2b1f5e',
    'panel':      '17706b',   # mas oscuro que el mueble o se lee como una banda
    'bulb':       'ffd98a',
}


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def lerp(c0, c1, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(4))


def art_bounds(geo):
    """Caja envolvente de los solidos, en coordenadas de 432.

    Se deriva de la geometria en vez de anotarse a mano, para que al mover una
    pieza el encuadre del legacy se recalcule solo y no quede descentrado.
    """
    xs, ys = [], []
    for key in ('marquee', 'neck', 'body'):
        b = geo.get(key)
        if b:
            xs += [b[0], b[2]]
            ys += [b[1], b[3]]
    for (bx, by) in geo['bulbs']:
        r = geo['bulb_r']
        xs += [bx - r, bx + r]
        ys += [by - r, by + r]
    return min(xs), min(ys), max(xs), max(ys)


def _rr(draw, box, radius, fill, k):
    x0, y0, x1, y1 = [v * k for v in box]
    r = radius * k
    if r <= 0:
        draw.rectangle([x0, y0, x1, y1], fill=fill)
    else:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)


def _vgrad(size_px, box, radius, c_a, c_b, k, symmetric=False, gamma=1.0):
    """Pieza rellena con un degradado vertical, recortado por su propia forma.

    Con `symmetric`, el degradado va de los cantos al centro en vez de arriba
    a abajo: es lo que hace que la marquesina parezca un tubo encendido y no
    plastico con una luz cenital.
    """
    shape = Image.new('L', (size_px, size_px), 0)
    _rr(ImageDraw.Draw(shape), box, radius, 255, k)

    ramp = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ramp)
    y0, y1 = box[1] * k, box[3] * k
    h = max(1.0, y1 - y0)
    mid = (y0 + y1) / 2.0
    for yy in range(int(y0), int(y1) + 1):
        if symmetric:
            t = min(1.0, abs(yy - mid) / (h / 2.0))
            col = lerp(c_b, c_a, t ** gamma)
        else:
            col = lerp(c_a, c_b, (yy - y0) / h)
        dr.line([(box[0] * k - 2, yy), (box[2] * k + 2, yy)], fill=col)

    lay = Image.new('RGBA', (size_px, size_px), (0, 0, 0, 0))
    lay.paste(ramp, (0, 0), shape)
    return lay


def draw_art(size, geo=GEO, scale=1.0, cx=None, cy=None):
    """La marquesina sobre fondo transparente, en un lienzo de `size` px."""
    S = size * SS
    k = (size / C) * SS * scale
    ax = cx if cx is not None else 216.0
    ay = cy if cy is not None else 216.0
    ox = S / 2.0 - ax * k
    oy = S / 2.0 - ay * k

    def K(box):
        return (box[0] + ox / k, box[1] + oy / k, box[2] + ox / k, box[3] + oy / k)

    def bulb_xy(bx, by):
        return (bx + ox / k) * k, (by + oy / k) * k

    # --- halo: emite solo lo que esta encendido, y va DEBAJO de los solidos ---
    gl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    _rr(gd, K(geo['marquee']), geo['marquee'][4], hexc(PAL['glow_pink']), k)
    for (bx, by) in geo['bulbs']:
        r = geo['bulb_r'] * k
        X, Y = bulb_xy(bx, by)
        gd.ellipse([X - r, Y - r, X + r, Y + r], fill=hexc(PAL['glow_amber']))
    gl = gl.resize((size, size), Image.LANCZOS)
    gl = gl.filter(ImageFilter.GaussianBlur(31 * (size / C) * scale))
    gl.putalpha(gl.split()[3].point(lambda v: int(v * 0.62)))
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for _ in range(3):          # tres pasadas: aura densa sin aplanar el borde
        glow = Image.alpha_composite(glow, gl)

    # --- solidos, de atras a delante ---
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    _rr(ImageDraw.Draw(out), K(geo['neck']), geo['neck'][4], hexc(PAL['neck']), k)
    out = Image.alpha_composite(out, _vgrad(S, K(geo['body']), geo['body'][4],
                                            hexc(PAL['body_top']), hexc(PAL['body_bot']), k))
    out = Image.alpha_composite(out, _vgrad(S, K(geo['screen']), geo['screen'][4],
                                            hexc(PAL['scr_top']), hexc(PAL['scr_bot']), k))
    if geo.get('panel'):
        _rr(ImageDraw.Draw(out), K(geo['panel']), geo['panel'][4], hexc(PAL['panel']), k)
    out = Image.alpha_composite(out, _vgrad(S, K(geo['marquee']), geo['marquee'][4],
                                            hexc(PAL['mq_edge']), hexc(PAL['mq_core']), k,
                                            symmetric=True, gamma=1.4))
    db = ImageDraw.Draw(out)
    for (bx, by) in geo['bulbs']:
        r = geo['bulb_r'] * k
        X, Y = bulb_xy(bx, by)
        db.ellipse([X - r, Y - r, X + r, Y + r], fill=hexc(PAL['bulb']))

    return Image.alpha_composite(glow, out.resize((size, size), Image.LANCZOS))


def draw_background(size):
    """Capa de fondo del adaptive icon: radial opaco hasta la ultima esquina.

    Nunca puede quedar transparente: la mascara mas permisiva dejaria ver un
    borde vacio. Sustituye al color plano blanco anterior, sobre el que el rosa
    caia a 2.9:1 de contraste y el halo era literalmente invisible.
    """
    im = Image.new('RGBA', (size, size), hexc(PAL['bg_out']))
    d = ImageDraw.Draw(im)
    R = 305 * (size / C)
    steps = max(60, int(R))
    for i in range(steps, 0, -1):
        t = i / steps
        r = R * t
        d.ellipse([size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r],
                  fill=lerp(hexc(PAL['bg_in']), hexc(PAL['bg_out']), t))
    return im


def draw_foreground(size, geo=GEO):
    return draw_art(size, geo)


def draw_legacy(size, geo=GEO, round_shape=False):
    """Icono legacy: se ve entero, asi que trae silueta, fondo y sombra propios."""
    m = 4 * (size / 192.0)
    inner = size - 2 * m

    sil = Image.new('L', (size, size), 0)
    ds = ImageDraw.Draw(sil)
    if round_shape:
        ds.ellipse([m, m, size - m, size - m], fill=255)
    else:
        ds.rounded_rectangle([m, m, size - m, size - m], radius=40 * (size / 192.0), fill=255)

    # El arte se REDIBUJA a mayor escala: aqui no hay mascara, el lienzo util es
    # todo. Se escala por el ALTO del bbox solido para que el tamano percibido
    # coincida con el del adaptive.
    ax0, ay0, ax1, ay1 = art_bounds(geo)
    art = draw_art(size, geo, scale=(inner / size) * (C / (ay1 - ay0)) * 0.88,
                   cx=(ax0 + ax1) / 2.0, cy=(ay0 + ay1) / 2.0)

    comp = Image.alpha_composite(draw_background(size), art)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(comp, (0, 0), sil)          # el halo no puede desbordar la silueta

    sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sh.paste(Image.new('RGBA', (size, size), (0, 0, 0, 90)), (0, 0), sil)
    sh = sh.filter(ImageFilter.GaussianBlur(3 * (size / 192.0)))
    shifted = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shifted.paste(sh, (0, int(round(2 * (size / 192.0)))))
    return Image.alpha_composite(shifted, out)


def draw_monochrome(size, geo=GEO):
    """Capa monocroma (Android 13+): silueta perforada por pantalla y bombillas.

    Se perfora en vez de rellenarse para que el icono temado siga leyendose como
    un objeto con partes y no como una mancha.
    """
    S = size * SS
    k = (size / C) * SS
    ox = S / 2.0 - 216 * k
    oy = S / 2.0 - 216 * k

    def K(box):
        return (box[0] + ox / k, box[1] + oy / k, box[2] + ox / k, box[3] + oy / k)

    mask = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(mask)
    for key in ('marquee', 'neck', 'body'):
        _rr(d, K(geo[key]), geo[key][4], 255, k)
    _rr(d, K(geo['screen']), geo['screen'][4], 0, k)
    if geo.get('panel'):
        _rr(d, K(geo['panel']), geo['panel'][4], 0, k)
    for (bx, by) in geo['bulbs']:
        r = geo['bulb_r'] * k
        X, Y = (bx + ox / k) * k, (by + oy / k) * k
        d.ellipse([X - r, Y - r, X + r, Y + r], fill=0)

    out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
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

    print('Generando el icono (marquesina de arcade):')
    n = escribir(res)

    # El adaptive icon debe apuntar a la capa de fondo nueva: con el <color>
    # blanco original el neon se destruia.
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
