"""Hornea los ENEMIGOS de la aventura de ROMINA: el hombre lobo, la kitsune,
los dos tengus y el lobo blanco.

    python tools/enemigos-atlas.py RUTA/enemigos
    python tools/enemigos-atlas.py RUTA/enemigos --hoja hoja.png

RUTA/enemigos tiene las carpetas de los packs tal cual se bajan (werewolf/,
yokai/). Escribe www/img/enemigos.png, www/img/enemigos2.png y
www/js/games/enemigos-atlas.js.

DOS HOJAS. Con los tres nuevos (24-09-2026) una sola hoja pasaba de 5000 px
de alto, y muchos moviles no suben a la grafica texturas de mas de 4096. Los
de siempre siguen en la primera; los nuevos van en la segunda.

DE DONDE SALEN
    Dos packs gratis de CraftPix, de la misma linea que el troll y el bosque:
      "Free Werewolf Sprite Sheets" -- free-game-assets.itch.io/free-werewolf-sprite-sheets-pixel-art
      "Free Yokai Pixel Sprite Sheets" (la Kitsune) -- free-game-assets.itch.io
    Los dos tengus (Karasu y Yamabushi) son del pack de la kitsune; el lobo
    blanco, del de los lobos.
    Licencia de CraftPix (craftpix.net/file-licenses, "freebie"): uso libre en
    juegos, tambien comerciales, sin atribucion obligatoria; prohibido revender
    o redistribuir los archivos de origen. Los packs NO estan en el repo.

POR QUE ESTOS DOS
    Se bajaron nueve packs y se compararon a la escala de ella. El lobo es un
    depredador con carrera, salto y una acometida en plancha, y cada ataque
    avisa encogiendose o alzandose antes (medido: se levanta 17-31 px). La
    kitsune ataca de lejos: la bola de fuego le crece en la mano seis
    fotogramas antes de salir. Los dos piden botones distintos (ver
    caba-enemigos.js).

LOS PASOS
    1. Cortar las tiras en celdas (128 x 128; el fuego, 64 x 64). Miran a la
       DERECHA, como guarda todo el juego: no hace falta espejo.
    2. ALINEAR cada animacion con el reposo. Aqui NO comparten lienzo: el mismo
       cuerpo sale hasta 20 px mas atras en unas animaciones que en otras (el
       lobo al atacar, la kitsune al lanzar), y sin corregirlo el bicho da un
       salto al cambiar de animacion. Se busca el desplazamiento que mejor
       encaja el primer fotograma de cada una sobre el reposo (el del TRONCO:
       de la cintura para arriba, que las patas y la cola se mueven).
    3. SCALE2X, como ella (tools/romina-atlas.py): la misma densidad de pixel.
       LOS TENGUS SE ALINEAN POR LOS PIES. Su reposo esta dibujado de tres
       cuartos y lo demas de perfil, y en el tronco mandan las alas: el
       encaje del tronco los descolocaba hasta 20 px. Se usa el centro de lo
       que pisa (las diez filas de abajo), que es su x en el juego.
    4. LA RAIZ, entre los pies y en el suelo, se mide en el reposo.

EL LOBO BLANCO ES EL NEGRO CON OTRA PALETA. Sus animaciones son los mismos
dibujos pixel a pixel (0 pixeles de mascara distintos), salvo el REPOSO, que
en el pack esta pintado oscuro (casi negro) y 10 px mas atras: con el suyo, el
jefe cambiaba de negro a blanco cada vez que atacaba. Se hornean los dibujos
del negro traducidos con la tabla de colores negro -> blanco que sale de las
animaciones comunes (30 colores, ninguno ambiguo).
"""
import argparse
import importlib.util
import os

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_JS = os.path.join(AQUI, '..', 'www', 'js', 'games', 'enemigos-atlas.js')
SALIDAS_PNG = [os.path.join(AQUI, '..', 'www', 'img', n) for n in ('enemigos.png', 'enemigos2.png')]
NL = '\n'

# Scale2x, la raiz, el empaquetado y el PNG con paleta: los de ella.
_spec = importlib.util.spec_from_file_location('romina_atlas', os.path.join(AQUI, 'romina-atlas.py'))
RA = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(RA)

# Cada bicho: su carpeta, el tamaño de celda, sus animaciones (nombre en el
# juego, fichero del pack) y en que hoja va. El lobo es el negro; el walk del
# pack va en minusculas (y gh-pages distingue mayusculas).
BICHOS = [
    ('lobo', 'werewolf/Black_Werewolf', 128, [
        ('idle', 'Idle'), ('anda', 'walk'), ('corre', 'Run'), ('zarpazo', 'Attack_1'),
        ('acomete', 'Run+Attack'), ('salta', 'Jump'), ('dolor', 'Hurt'), ('muere', 'Dead'),
        ('barre', 'Attack_2')], 0),
    ('kitsune', 'yokai/Kitsune', 128, [
        ('idle', 'Idle'), ('anda', 'Walk'), ('lanza', 'Attack_3'), ('corro', 'Attack_2'),
        ('salta', 'Jump'), ('dolor', 'Hurt'), ('muere', 'Dead'), ('rastrero', 'Attack_1')], 0),
    # la bola (vuela) y la llama que va por el suelo (rastrero, 24-09-2026)
    ('fuego', 'yokai/Kitsune', 64, [('vuela', 'Fire_2'), ('rastrero', 'Fire_1')], 0),
    # EL CUERVO: el tajo desde arriba (Attack_2) y el PICADO, que es su salto
    # entero (agacharse, alzar las alas, envolverse en ellas y abrirlas).
    ('karasu', 'yokai/Karasu_tengu', 128, [
        ('idle', 'Idle'), ('anda', 'Walk'), ('corre', 'Run'), ('tajo', 'Attack_2'),
        ('vuela', 'Jump'), ('dolor', 'Hurt'), ('muere', 'Dead')], 1),
    # EL DE LA MASCARA ROJA: el desenvaine (Attack_2, cuatro fotogramas con la
    # mano en la empuñadura) y el relampago (Attack_1, el tajo corto). No corre
    # ni salta: anda, y cruza de un tajo.
    ('yamabushi', 'yokai/Yamabushi_tengu', 128, [
        ('idle', 'Idle'), ('anda', 'Walk'), ('iai', 'Attack_2'), ('relampago', 'Attack_1'),
        ('dolor', 'Hurt'), ('muere', 'Dead')], 1),
    # EL LOBO BLANCO, jefe de la manada: lo del negro y el zarpazo hacia
    # arriba (Attack_3), que el negro no usa; y su salto, para apartarse de un
    # brinco tras aullar. Los dibujos son los del negro, con la paleta del
    # blanco (ver arriba).
    ('alfa', 'werewolf/Black_Werewolf', 128, [
        ('idle', 'Idle'), ('anda', 'walk'), ('corre', 'Run'), ('zarpazo', 'Attack_1'),
        ('acomete', 'Run+Attack'), ('barre', 'Attack_2'), ('levanta', 'Attack_3'),
        ('dolor', 'Hurt'), ('muere', 'Dead'), ('salta', 'Jump')], 1),
]
# Como se alinea cada uno (por defecto, por el tronco) y de donde sale su
# paleta (por defecto, la suya).
PIES = {'karasu', 'yamabushi'}
PALETA_DE = {'alfa': 'werewolf/White_Werewolf'}
# Y MAS BLANCO: el pelo del pack es beige grisaceo (c8bea2), y sobre el verde
# del bosque se leia gris. Los tonos claros (luminancia de mas de 90) se
# acercan al blanco; las sombras y el contorno, oscuros, se quedan.
BLANQUEA = {'alfa': 0.45}
# Y SU REPOSO, UN ESCALON MAS CLARO. El pack pinta el reposo del lobo en
# sombra: solo un 8 % de pelo claro (6d758d) contra el 20 % de los ataques.
# Traducido a blanco, el jefe quieto se veia negro con un filo claro. Cada
# tono del reposo sube uno en la escala del lobo (el contorno, no) antes de
# pasarlo a blanco: queda con el 20 % de claro, como cuando ataca.
ACLARA_REPOSO = {'alfa': {(0x14, 0x10, 0x13): (0x24, 0x22, 0x34), (0x24, 0x22, 0x34): (0x40, 0x33, 0x53),
                          (0x40, 0x33, 0x53): (0x4a, 0x54, 0x62), (0x4a, 0x54, 0x62): (0x6d, 0x75, 0x8d)}}
# A MANO: el zarpazo hacia arriba del lobo (Attack_3) empieza erguido, y el
# encaje del tronco lo comparaba con el reposo agachado: lo corria 66 px. Por
# los pies pisa 8 px por delante del zarpazo (Attack_1), asi que va con el
# del zarpazo (-15) + 8.
A_MANO = {('alfa', 'levanta'): -7}


def celdas(ruta, celda, lut=None):
    im = Image.open(ruta).convert('RGBA')
    if lut:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                c = px[x, y]
                if c[3]:
                    px[x, y] = lut[c[:3]] + (c[3],)
    return [im.crop((i * celda, 0, (i + 1) * celda, celda)) for i in range(im.width // celda)]


def tabla_paleta(ruta, de, a):
    """Los colores de la carpeta `de` traducidos a los de `a`, sacados de las
    animaciones que tienen las dos (mismo dibujo, otra paleta). Se niega si un
    color se traduce a dos, o si las mascaras no coinciden."""
    nombres = {f.lower(): f for f in os.listdir(os.path.join(ruta, a)) if f.endswith('.png')}
    lut = {}
    for f in os.listdir(os.path.join(ruta, de)):
        if not f.endswith('.png') or f.lower() == 'idle.png' or f.lower() not in nombres:
            continue
        A = Image.open(os.path.join(ruta, de, f)).convert('RGBA').load()
        im_b = Image.open(os.path.join(ruta, a, nombres[f.lower()])).convert('RGBA')
        B = im_b.load()
        for y in range(im_b.height):
            for x in range(im_b.width):
                ca, cb = A[x, y], B[x, y]
                if bool(ca[3]) != bool(cb[3]):
                    raise SystemExit(f'{f}: las mascaras de {de} y {a} no coinciden')
                if ca[3]:
                    if lut.setdefault(ca[:3], cb[:3]) != cb[:3]:
                        raise SystemExit(f'{f}: el color {ca[:3]} se traduce a dos')
    return lut


def pies(c, filas=10):
    """El centro de lo opaco en las `filas` de abajo: donde pisa."""
    bb = c.getbbox()
    a = c.getchannel('A').load()
    xs = [x for y in range(max(0, bb[3] - filas), bb[3]) for x in range(c.width) if a[x, y]]
    return sum(xs) / len(xs)


def encaje_pies(base, otras):
    """Como encaje(), por los pies: lo que hay que mover la animacion para que
    pise donde el reposo. Del salto y la muerte, solo los dos primeros (luego
    despega o cae)."""
    ps = [pies(c) for c in otras if c.getbbox()]
    return round(sum(ps) / len(ps) - sum(pies(c) for c in base) / len(base))


def encaje(base, otra, alto_tronco):
    """El desplazamiento en x que mejor pone `otra` sobre `base`, mirando solo
    las filas del tronco (las de arriba de la mitad de la figura)."""
    bb = base.getbbox()
    y0, y1 = bb[1], bb[1] + alto_tronco
    a = base.getchannel('A').load()
    b = otra.getchannel('A').load()
    W = base.width
    mejor, dx_mejor = -1, 0
    for dx in range(-40, 41):
        n = 0
        for y in range(y0, min(y1, base.height)):
            for x in range(max(0, -dx), min(W, W - dx)):
                if a[x, y] and b[x + dx, y]:
                    n += 1
        if n > mejor:
            mejor, dx_mejor = n, dx
    return dx_mejor


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ruta', help='carpeta con los packs (werewolf/, yokai/)')
    ap.add_argument('--hoja', help='escribe tambien una hoja de contactos')
    args = ap.parse_args()

    unicos, tablas, notas, hoja_de = [[], []], {}, [], {}
    for bicho, carpeta, celda, anims, h in BICHOS:
        hoja_de[bicho] = h
        lut = tabla_paleta(args.ruta, carpeta, PALETA_DE[bicho]) if bicho in PALETA_DE else None
        if lut and bicho in BLANQUEA:
            k = BLANQUEA[bicho]
            def claro(c):
                if 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] <= 90:
                    return c
                return tuple(min(255, round(v + (255 - v) * k)) for v in c)
            lut = {a: claro(b) for a, b in lut.items()}
        cortes = {}
        for nom, fich in anims:
            l = lut
            if lut and nom == 'idle' and bicho in ACLARA_REPOSO:
                sube = ACLARA_REPOSO[bicho]
                l = {c: lut[sube.get(c, c)] for c in lut}
            cortes[nom] = celdas(os.path.join(args.ruta, carpeta, fich + '.png'), celda, l)
        base = cortes[anims[0][0]][0]
        bb = base.getbbox()
        alto_tronco = (bb[3] - bb[1]) // 2
        # la raiz: entre los pies y en el suelo; la del fuego, en el centro de
        # la bola (vuela, no pisa)
        if bicho == 'fuego':
            b0 = RA.scale2x(base).getbbox()
            rx, ry = (b0[0] + b0[2]) // 2, (b0[1] + b0[3]) // 2
        else:
            rx, ry = RA.raiz(RA.scale2x(base))
        tabla = {}
        for nom, _ in anims:
            if (bicho, nom) in A_MANO:
                dx = A_MANO[(bicho, nom)]
            elif bicho == 'fuego' or nom == anims[0][0]:
                dx = 0
            elif bicho in PIES:
                fich = dict(anims)[nom]
                dx = encaje_pies(cortes[anims[0][0]], cortes[nom][:2] if fich in ('Jump', 'Dead') else cortes[nom])
            else:
                dx = encaje(base, cortes[nom][0], alto_tronco)
            if dx:
                notas.append(f'{bicho}.{nom}: {dx:+d} px')
            fila = []
            for c in cortes[nom]:
                d = RA.scale2x(c)
                b = d.getbbox()
                if not b:
                    continue
                # el desplazamiento se aplica en la celda doblada (x2)
                fila.append((len(unicos[h]), b[0] - rx - 2 * dx, b[1] - ry))
                unicos[h].append(d.crop(b))
            tabla[nom] = fila
        tablas[bicho] = tabla

    medidas, poses, cols = [], [], []
    for h, frames in enumerate(unicos):
        W, H, pos = RA.empaqueta(frames)
        hoja = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for f, p in zip(frames, pos):
            hoja.paste(f, p)
        png, ncol = RA.indexado(hoja)
        with open(SALIDAS_PNG[h], 'wb') as fh:
            fh.write(png)
        medidas.append((W, H)); poses.append(pos); cols.append(ncol)
        print(f'{os.path.basename(SALIDAS_PNG[h])} {W}x{H}, {len(frames)} fotogramas, {ncol} colores, {len(png) // 1024} KB')

    lineas = [
        '// GENERADO por tools/enemigos-atlas.py -- no se edita a mano.',
        '//',
        '// Los enemigos de la aventura (packs gratis de CraftPix), mirando a la',
        f'// DERECHA y doblados con Scale2x, como ella. {cols[0]} + {cols[1]} colores.',
        '// Cada fotograma: [x, y, ancho, alto, ox, oy] -- su rectangulo en su hoja',
        '// (HOJA_DE: 0 es img/enemigos.png, 1 img/enemigos2.png) y donde cae su',
        '// esquina respecto a la RAIZ (entre los pies, en el suelo). El fuego tiene',
        '// la raiz en el centro de la bola.',
        '// Animaciones alineadas con el reposo: ' + (', '.join(notas) if notas else 'ninguna movida') + '.',
        f'export const HOJAS = {[list(m) for m in medidas]};',
        'export const HOJA_DE = { ' + ', '.join(f'{b}: {h}' for b, h in hoja_de.items()) + ' };',
    ]
    for bicho, tabla in tablas.items():
        h = hoja_de[bicho]
        pos, fr = poses[h], unicos[h]
        lineas.append(f'export const {bicho.upper()} = {{')
        for nom, fila in tabla.items():
            fs = ','.join(f'[{pos[u][0]},{pos[u][1]},{fr[u].width},{fr[u].height},{ox},{oy}]' for u, ox, oy in fila)
            lineas.append(f'  {nom}: [{fs}],')
        lineas.append('};')
    with open(SALIDA_JS, 'w', encoding='utf-8', newline=NL) as fh:
        fh.write(NL.join(lineas) + NL)
    for n in notas:
        print('  alineado', n)

    if args.hoja:
        # todas las animaciones en filas, con la raiz en una linea comun
        filas = [(b, n, f) for b, t in tablas.items() for n, f in t.items()]
        alto = 200
        ancho = max(len(f) for _, _, f in filas) * 170 + 10
        v = Image.new('RGBA', (ancho, alto * len(filas)), (26, 20, 38, 255))
        for i, (b, n, fila) in enumerate(filas):
            for k, (u, ox, oy) in enumerate(fila):
                x0 = 90 + k * 170 + ox
                y0 = i * alto + 190 + oy if b != 'fuego' else i * alto + 100 + oy
                v.alpha_composite(unicos[hoja_de[b]][u], (max(0, x0), max(0, y0)))
        v.convert('RGB').save(args.hoja)


if __name__ == '__main__':
    main()
