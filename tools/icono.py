"""Genera el icono del APK: un escudo con una espada cruzada, en PIXEL ART.

    python tools/icono.py                # escribe los PNG en android/
    python tools/icono.py --hoja out.png # hoja de contactos para revisarlo
    python tools/icono.py --verificar    # comprueba la zona segura y las mascaras

Como el resto del arte del proyecto, no hay archivos de imagen de origen: la
geometria vive aqui y se rasteriza con PIL.

ESTE ICONO ES PIXEL ART, Y ESO CAMBIA LAS REGLAS
    El icono anterior era un gabinete de recreativa dibujado SUAVE: se pintaba
    a 8x y se reducia con LANCZOS, y el antialiasing salia de ahi. Este no. Se
    dibuja en una rejilla de 24x24 celdas y se amplia con NEAREST, sin
    suavizar ni una celda, porque un icono de pixel art suavizado deja de ser
    pixel art: se convierte en un dibujo borroso.

POR QUE 24x24 Y NO OTRA REJILLA
    El icono se ve a 48 px en la lista de apps, y hasta 192. Si la rejilla no
    DIVIDE EXACTO esos tamanos, unas celdas salen de 2 px y otras de 3, y el
    resultado se ve sucio -- es el fallo clasico del pixel art escalado. Los
    unicos divisores comodos de 48 son 16, 24 y 48:
      16x16 -> 3 px por celda a 48, pero no da para un escudo CON espada
      48x48 -> 1 px por celda a 48: el detalle se pierde, ilegible
      24x24 -> 2 px por celda a 48 y 8 a 192. El punto justo.

QUE SE DIBUJA
    Un escudo de tablones de madera con refuerzo de oro, y una espada de acero
    cruzada en diagonal cuya punta y pomo SOBRESALEN del escudo. La diagonal es
    de 45 grados exactos (x+y constante), que es la unica que en una rejilla de
    pixeles sale limpia en vez de escalonada.

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
SS = 8             # solo lo usan las capas suaves (fondo, sombra del legacy)
SAFE_R = 132.0     # radio de la zona segura del adaptive icon, en coords de 432

N = 24             # la rejilla de pixel art. Ver la cabecera: divide 48 y 192.

# Densidades reales de Android: (carpeta, tamano legacy, tamano foreground)
DENSITIES = [
    ('mdpi',    48,  108),
    ('hdpi',    72,  162),
    ('xhdpi',   96,  216),
    ('xxhdpi',  144, 324),
    ('xxxhdpi', 192, 432),
]

PAL = {
    'bg_in':   '2a1a3d',   # centro del degradado de fondo
    'bg_out':  '0d0620',   # esquina; es el theme-color del juego
    'glow':    'ff5c9d',   # el halo rosa detras del escudo (el color del arcade)
}

# La paleta del pixel art. Corta a proposito: son los mismos tonos del escudo
# y la espada que Romina lleva en el juego, para que el icono y el personaje
# se reconozcan como la misma cosa.
O   = (43, 21, 38, 255)        # contorno (violeta muy oscuro, no negro puro)
MAD = [(107, 67, 38, 255), (150, 97, 58, 255), (184, 121, 74, 255)]
ACE = [(74, 85, 112, 255), (138, 151, 184, 255), (212, 220, 240, 255), (255, 255, 255, 255)]
ORO = [(138, 98, 22, 255), (217, 165, 42, 255), (255, 224, 102, 255)]
CUE = (92, 58, 33, 255)        # el cuero de la empunadura
JOY = (196, 28, 90, 255)       # la joya: el rosa del arcade
JOY2 = (255, 143, 188, 255)

# El ESCUDO, fila a fila: medio-ancho en celdas. Se define por su mitad y se
# refleja, asi es simetrico por construccion y no por buen pulso.
# Se MIDIO que con el escudo a 8 celdas de medio-ancho y la espada saliendo de
# esquina a esquina, el punto mas lejano caia a 268 px del centro -- el doble
# del limite de 132 de la zona segura -- y el launcher recortaba medio icono.
# Con 6 y la espada mas recogida, cabe.
ESCUDO_FILAS = {
    5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 5,
    12: 5, 13: 4, 14: 4, 15: 3, 16: 2,
}
ESC_CX = 11.5      # el eje del escudo, entre las celdas 11 y 12
ESC_PUNTA = 17     # la fila donde acaba la punta de abajo


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def lerp(c0, c1, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(4))


def pixel_art():
    """Dibuja el icono en la rejilla de N x N celdas. Devuelve una imagen NxN."""
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))

    def px(x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < N and 0 <= y < N:
            img.putpixel((x, y), c)

    # ---------- EL ESCUDO ----------
    for y, w in ESCUDO_FILAS.items():
        x0, x1 = int(ESC_CX - w), int(ESC_CX + w)
        for x in range(x0, x1 + 1):
            # Tablones: la luz entra por la izquierda, asi que esa banda va
            # clara y la de la derecha en sombra. Tres tonos, no un degradado:
            # en pixel art el volumen se hace con BANDAS PLANAS.
            t = (x - x0) / float(x1 - x0 + 1)
            px(x, y, MAD[2] if t < 0.26 else (MAD[1] if t < 0.70 else MAD[0]))
    # contorno
    for y, w in ESCUDO_FILAS.items():
        px(ESC_CX - w - 1, y, O)
        px(ESC_CX + w + 1, y, O)
    for x in range(int(ESC_CX - 6) - 1, int(ESC_CX + 6) + 2):
        px(x, 4, O)
    # La punta de abajo se cierra a mano: con solo 2-3 celdas de ancho, el
    # contorno calculado por filas la partia y el escudo acababa en un pico
    # roto. A esta escala, cerrar cuatro celdas es mas fiable que una formula.
    for x, y in ((9, 16), (10, 17), (11, 17), (12, 17), (13, 16)):
        px(x, y, O)
    px(11, 16, MAD[1]); px(12, 16, MAD[0])

    # ---------- EL REFUERZO EN CRUZ ----------
    # UNA sola fila y UNA sola columna. Con dos de cada, la cruz ocupaba casi
    # un tercio del escudo y el conjunto se leia como una placa de oro en vez
    # de como madera reforzada.
    for x in range(int(ESC_CX - 6), int(ESC_CX + 6) + 1):
        px(x, 9, ORO[1])
    for y in range(5, 15):
        px(11, y, ORO[1])
    # el canto alto, mas claro: es lo que le da grosor al refuerzo
    for x in range(int(ESC_CX - 5), int(ESC_CX + 6)):
        px(x, 8, ORO[0])
    px(11, 4, ORO[0])

    # ---------- LA ESPADA ----------
    # Diagonal de 45 grados EXACTOS: es la unica que en una rejilla de pixeles
    # sale limpia; cualquier otra pendiente da escalones desiguales.
    # t=0 en el pomo (abajo-izquierda), t=1 en la punta (arriba-derecha).
    # Sobresale del escudo por las dos puntas, pero sin salirse del circulo
    # seguro: va de (4,18) a (19,3), no de esquina a esquina.
    def D(t):
        return (4 + t * 15, 18 - t * 15)

    # Sombra bajo el filo, una celda abajo-derecha. Es lo que despega la espada
    # del escudo; sin ella se funden en una mancha.
    #
    # PERO SOLO SOBRE LA MADERA, NO EN LUGAR DE ELLA. El primer intento pintaba
    # el contorno sobre el escudo y partia los tablones: en el mapa de celdas
    # se veian '#' sueltos por todo el escudo y la silueta dejaba de leerse.
    # Sobre la madera se usa su tono mas oscuro, que hace de sombra sin abrir
    # un agujero; el contorno duro se reserva para donde la espada sale al
    # fondo.
    for i in range(0, 101):
        x, y = D(i / 100.0)
        xi, yi = int(x + 1), int(y + 1)
        if 0 <= xi < N and 0 <= yi < N:
            actual = img.getpixel((xi, yi))
            if actual[3] == 0:
                px(xi, yi, O)          # fuera del escudo: contorno duro
            elif actual[:3] in (MAD[1][:3], MAD[2][:3]):
                px(xi, yi, MAD[0])     # sobre madera: su propia sombra

    # LA HOJA, de t=0.38 a 1.0. Dos celdas de ancho: filo claro y cuerpo.
    for i in range(38, 101):
        x, y = D(i / 100.0)
        px(x, y, ACE[2])
        px(x - 1, y, ACE[1])
    # la punta, con su destello
    for t in (1.0, 0.95):
        x, y = D(t)
        px(x, y, ACE[3])

    # LA GUARDA. Perpendicular a la hoja: si la hoja avanza en (+1,-1), la
    # perpendicular es (+1,+1). Dibujarla en la misma direccion la deja
    # paralela al filo y no se lee como guarda -- fallo real del primer intento.
    gx, gy = D(0.38)
    for k in (-2, -1, 1, 2):
        px(gx + k, gy + k, ORO[2] if abs(k) == 2 else ORO[1])
    px(gx, gy, ORO[2])

    # LA EMPUNADURA de cuero, con su anilla
    for i in range(8, 38):
        x, y = D(i / 100.0)
        px(x, y, CUE)
    x, y = D(0.27)
    px(x, y, ORO[1])

    # EL POMO. Pegado a la empunadura: con un hueco en medio se veia como una
    # mota de oro suelta flotando al lado del escudo.
    x, y = D(0.08)
    px(x, y, ORO[2]); px(x + 1, y - 1, ORO[1]); px(x - 1, y + 1, ORO[1])
    # el contorno del pomo, para que no se deshilache contra el fondo
    px(x - 1, y - 1, O); px(x + 2, y - 2, O)

    # ---------- EL REMACHE del escudo, con su joya ----------
    px(11, 12, JOY); px(12, 12, JOY2)

    return img


def art_bounds(geo=None):
    """Caja envolvente del dibujo, en coordenadas de 432.

    Se MIDE sobre el pixel art en vez de anotarse a mano: al mover una pieza,
    el encuadre del legacy se recalcula solo y no queda descentrado.
    """
    im = pixel_art()
    bb = im.split()[3].getbbox()
    if not bb:
        return (0, 0, C, C)
    k = C / N
    return (bb[0] * k, bb[1] * k, bb[2] * k, bb[3] * k)


def draw_art(size, geo=None, scale=1.0, cx=None, cy=None):
    """El escudo sobre fondo transparente, en un lienzo de `size` px.

    EL ESCALADO ES NEAREST, SIEMPRE. Con LANCZOS (que es lo que usaba el icono
    anterior) las celdas se difuminan y deja de ser pixel art.
    """
    art = pixel_art()

    # Cuantos pixeles de pantalla mide una celda. Se REDONDEA a entero: con un
    # tamano fraccionario, unas celdas saldrian de 2 px y otras de 3 y el
    # pixel art se veria sucio.
    #
    # ENCAJE: el dibujo llega a 11.3 celdas del centro y la zona segura del
    # adaptive icon son 132 px de 432, o sea 7.3 celdas. Por eso el arte se
    # dibuja al 58%: sin esto el launcher recortaba la punta de la espada y
    # medio escudo. Medido, no a ojo (python tools/icono.py --verificar).
    ENCAJE = 0.58
    celda = max(1, int(round((size / float(N)) * scale * ENCAJE)))
    lado = celda * N
    grande = art.resize((lado, lado), Image.NEAREST)

    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # Centrado sobre el punto pedido (o el centro del lienzo)
    ax = (cx if cx is not None else C / 2.0) / C * lado
    ay = (cy if cy is not None else C / 2.0) / C * lado
    out.paste(grande, (int(round(size / 2.0 - ax)), int(round(size / 2.0 - ay))), grande)

    # Halo calido detras, para que el escudo no flote sobre el fondo oscuro.
    # Esta capa SI es suave: es luz, no dibujo.
    # El halo va DETRAS y muy suave. Con el anterior (naranja, 30% del lienzo y
    # al 34% de opacidad) la luz se comia el escudo: se veia borroso y todo
    # amarillo. Ahora es rosa, mas pequeno y a la mitad de fuerza -- se nota
    # que hay luz detras sin robarle contraste al dibujo.
    gl = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    r = size * 0.22 * scale
    gd.ellipse([size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r], fill=hexc(PAL['glow']))
    gl = gl.filter(ImageFilter.GaussianBlur(size * 0.13))
    gl.putalpha(gl.split()[3].point(lambda v: int(v * 0.17)))
    return Image.alpha_composite(gl, out)


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


def draw_foreground(size, geo=None):
    return draw_art(size, geo)


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


def draw_monochrome(size, geo=None):
    """Capa monocroma (Android 13+): la silueta del escudo y la espada.

    Se usa el ALFA del propio pixel art, asi que sigue exactamente la misma
    forma que el icono de color -- si se dibujara aparte, las dos versiones se
    irian separando en cuanto se tocara una.
    """
    art = pixel_art()
    celda = max(1, int(round(size / float(N))))
    lado = celda * N
    alfa = art.split()[3].resize((lado, lado), Image.NEAREST)

    # El escudo, un poco mas chico que el lienzo para que el launcher lo pueda
    # recortar sin comerse la punta de la espada.
    mask = Image.new('L', (size, size), 0)
    off = (size - lado) // 2
    mask.paste(alfa, (off, off))

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
