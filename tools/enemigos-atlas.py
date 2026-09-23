"""Hornea los ENEMIGOS de la aventura de ROMINA: el hombre lobo y la kitsune.

    python tools/enemigos-atlas.py RUTA/enemigos
    python tools/enemigos-atlas.py RUTA/enemigos --hoja hoja.png

RUTA/enemigos tiene las carpetas de los packs tal cual se bajan (werewolf/,
yokai/). Escribe www/img/enemigos.png y www/js/games/enemigos-atlas.js.

DE DONDE SALEN
    Dos packs gratis de CraftPix, de la misma linea que el troll y el bosque:
      "Free Werewolf Sprite Sheets" -- free-game-assets.itch.io/free-werewolf-sprite-sheets-pixel-art
      "Free Yokai Pixel Sprite Sheets" (la Kitsune) -- free-game-assets.itch.io
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
    4. LA RAIZ, entre los pies y en el suelo, se mide en el reposo.
"""
import argparse
import importlib.util
import os

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_JS = os.path.join(AQUI, '..', 'www', 'js', 'games', 'enemigos-atlas.js')
SALIDA_PNG = os.path.join(AQUI, '..', 'www', 'img', 'enemigos.png')
NL = '\n'

# Scale2x, la raiz, el empaquetado y el PNG con paleta: los de ella.
_spec = importlib.util.spec_from_file_location('romina_atlas', os.path.join(AQUI, 'romina-atlas.py'))
RA = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(RA)

# Cada bicho: su carpeta, el tamaño de celda y sus animaciones (nombre en el
# juego, fichero del pack). El lobo es el negro; el walk del pack va en
# minusculas (y gh-pages distingue mayusculas).
BICHOS = [
    ('lobo', 'werewolf/Black_Werewolf', 128, [
        ('idle', 'Idle'), ('anda', 'walk'), ('corre', 'Run'), ('zarpazo', 'Attack_1'),
        ('acomete', 'Run+Attack'), ('salta', 'Jump'), ('dolor', 'Hurt'), ('muere', 'Dead')]),
    ('kitsune', 'yokai/Kitsune', 128, [
        ('idle', 'Idle'), ('anda', 'Walk'), ('lanza', 'Attack_3'), ('corro', 'Attack_2'),
        ('salta', 'Jump'), ('dolor', 'Hurt'), ('muere', 'Dead')]),
    ('fuego', 'yokai/Kitsune', 64, [('vuela', 'Fire_2')]),
]


def celdas(ruta, celda):
    im = Image.open(ruta).convert('RGBA')
    return [im.crop((i * celda, 0, (i + 1) * celda, celda)) for i in range(im.width // celda)]


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

    unicos, tablas, notas = [], {}, []
    for bicho, carpeta, celda, anims in BICHOS:
        cortes = {nom: celdas(os.path.join(args.ruta, carpeta, fich + '.png'), celda) for nom, fich in anims}
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
            dx = 0 if bicho == 'fuego' or nom == anims[0][0] else encaje(base, cortes[nom][0], alto_tronco)
            if dx:
                notas.append(f'{bicho}.{nom}: {dx:+d} px')
            fila = []
            for c in cortes[nom]:
                d = RA.scale2x(c)
                b = d.getbbox()
                if not b:
                    continue
                # el desplazamiento se aplica en la celda doblada (x2)
                fila.append((len(unicos), b[0] - rx - 2 * dx, b[1] - ry))
                unicos.append(d.crop(b))
            tabla[nom] = fila
        tablas[bicho] = tabla

    W, H, pos = RA.empaqueta(unicos)
    hoja = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for f, p in zip(unicos, pos):
        hoja.paste(f, p)
    png, ncol = RA.indexado(hoja)
    with open(SALIDA_PNG, 'wb') as fh:
        fh.write(png)

    lineas = [
        '// GENERADO por tools/enemigos-atlas.py -- no se edita a mano.',
        '//',
        '// El hombre lobo y la kitsune (packs gratis de CraftPix), mirando a la',
        f'// DERECHA y doblados con Scale2x, como ella. {ncol} colores.',
        '// Cada fotograma: [x, y, ancho, alto, ox, oy] -- su rectangulo en',
        '// img/enemigos.png y donde cae su esquina respecto a la RAIZ (entre los',
        '// pies, en el suelo). El fuego tiene la raiz en el centro de la bola.',
        '// Animaciones alineadas con el reposo: ' + (', '.join(notas) if notas else 'ninguna movida') + '.',
        f'export const HOJA_W = {W}, HOJA_H = {H};',
    ]
    for bicho, tabla in tablas.items():
        lineas.append(f'export const {bicho.upper()} = {{')
        for nom, fila in tabla.items():
            fs = ','.join(f'[{pos[u][0]},{pos[u][1]},{unicos[u].width},{unicos[u].height},{ox},{oy}]' for u, ox, oy in fila)
            lineas.append(f'  {nom}: [{fs}],')
        lineas.append('};')
    with open(SALIDA_JS, 'w', encoding='utf-8', newline=NL) as fh:
        fh.write(NL.join(lineas) + NL)
    print(f'enemigos.png {W}x{H}, {len(unicos)} fotogramas, {ncol} colores, {len(png) // 1024} KB')
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
                v.alpha_composite(unicos[u], (max(0, x0), max(0, y0)))
        v.convert('RGB').save(args.hoja)


if __name__ == '__main__':
    main()
