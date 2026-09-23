"""Hornea a ROMINA a partir de un pack de pixel art dibujado a mano.

    python tools/romina-atlas.py RUTA/ArmoredHero
    python tools/romina-atlas.py RUTA/ArmoredHero --hoja hoja.png

Escribe www/img/romina.png (la hoja de fotogramas) y www/js/games/romi-atlas.js
(donde esta cada fotograma y donde tiene los pies).

POR QUE ROMINA YA NO SE DIBUJA POR CODIGO
    Lo mismo que el ogro (ver tools/ogro-atlas.py): una pose de ~20 numeros
    sobre piezas rigidas no redibuja el cuerpo, y tras muchas rondas de ajuste
    sus animaciones seguian pareciendo de carton. Anderson pidio "que sea
    femenina, con el pelo negro y los ojos negros; puede ser entre princesa y
    caballera".

DE DONDE SALE
    "FemaleKnight" (ArmoredHero) de retsuto: https://retsuto.itch.io/femaleknight
    Pixel art de 128x128 por celda, ~87 px de alto, con capa, falda y espada:
    combo de tres tajos con estela, guardia, salto, caida, agachada y tajo en
    el aire. Gratis para uso personal y comercial; prohibido revender o
    redistribuir el pack, tal cual o modificado. Por eso el pack NO esta en el
    repo: solo la hoja horneada, que es parte del juego.

    Le faltan animaciones que ella usa, y salen de las suyas: la ESQUIVA, el
    GOLPE RECIBIDO y el vuelo de la DERROTA son su salto (ver C.pose en
    caba-cuerpo.js); la derrota acaba de rodillas y la GUARDIA es su Guard.
    (Hubo una rodada montada con la agachada quieta: se leia como estar de
    rodillas resbalando, y se quito.)

LOS PASOS
    1. PELO Y OJOS NEGROS. El pelo son cuatro amarillos, pero tres los
       comparte con el ribete de la capa y la empuñadura. Recolorear por color
       dejaria la capa con el borde negro. Se recolorea solo lo que esta a dos
       pixeles o menos del amarillo PRINCIPAL del pelo (#ffd284), que solo
       aparece en el pelo: la capa y la espada conservan su oro. El ojo es un
       pixel naranja (#ffa848) y pasa a negro.
    2. ESPEJO: el pack mira a la izquierda y el juego guarda todo mirando a la
       derecha (igual que el ogro).
    3. SCALE2X, no NEAREST. A x2 con NEAREST cada pixel del dibujo son cuatro
       del lienzo y se ve el doble de gordo que el ogro. Scale2x redondea las
       escaleras de las diagonales y deja el grano al tamaño del lienzo. Mide
       ~174 px, como la Romina de antes.
    4. LA RAIZ, entre los pies y en el suelo, se mide en el reposo. Todas las
       celdas del pack comparten lienzo, asi que no hay que alinearlas.
"""
import argparse
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_JS = os.path.join(AQUI, '..', 'www', 'js', 'games', 'romi-atlas.js')
SALIDA_PNG = os.path.join(AQUI, '..', 'www', 'img', 'romina.png')
NL = '\n'
CELDA = 128


def hexa(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# El pelo: de rubio a NEGRO con reflejos violeta (como el pelo negro de anime:
# negro puro seria una mancha sin volumen).
PELO = {
    hexa('ffc060'): hexa('0e0a12'),   # el contorno del pelo
    hexa('ffd284'): hexa('211a2b'),   # el pelo
    hexa('ffe2a8'): hexa('3b3150'),   # la luz
    hexa('fff0cc'): hexa('5b5178'),   # el brillo
}
SEMILLA = hexa('ffd284')              # solo existe en el pelo
OJOS = {hexa('ffa848'): hexa('120a0e')}

# Cada animacion del juego: de que hoja del pack sale cada fotograma.
# Los nombres son los de C.pose() en caba-cuerpo.js.
ANIMS = [
    ('idle', [('Idle', i) for i in range(9)]),
    ('run', [('Running', i) for i in range(6)]),
    # impulso, subida (1-5), caida (6-7) y el aterrizaje agachada (8)
    # Tambien son la ESQUIVA, el GOLPE RECIBIDO y el vuelo de la DERROTA (ver
    # C.pose): lo que hace el cuerpo en las tres es despegar, ir recogida por
    # el aire y caer agachada, y eso es su salto.
    ('jump', [('Jump', i) for i in range(6)] + [('Fall', 0), ('Fall', 1), ('Crouch', 0)]),
    ('atk', [('Attack1', i) for i in range(6)]),
    ('atk2', [('Attack2', i) for i in range(8)]),
    ('atk3', [('Attack3', i) for i in range(11)]),
    ('air', [('AirAttack', i) for i in range(4)]),
    # la GUARDIA: subiendo, plantada, el impacto (la espada salta arriba) y
    # rehacerse
    ('block', [('Guard', 0), ('Guard', 2), ('Guard', 1), ('Guard', 3)]),
    # la derrota: de rodillas
    ('dead', [('Crouch', 3)]),
]


def celdas(ruta, hoja):
    im = Image.open(os.path.join(ruta, hoja + '.png')).convert('RGBA')
    out = []
    for cy in range(im.height // CELDA):
        for cx in range(im.width // CELDA):
            c = im.crop((cx * CELDA, cy * CELDA, (cx + 1) * CELDA, (cy + 1) * CELDA))
            if c.getbbox():
                out.append(c)
    return out


def recolorea(im):
    """Pelo y ojos a negro. Solo el amarillo que esta cerca del pelo."""
    px = im.load()
    W, H = im.size
    semilla = Image.new('L', im.size, 0)
    sp = semilla.load()
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if p[3] and p[:3] == SEMILLA:
                sp[x, y] = 255
    cerca = semilla.filter(ImageFilter.MaxFilter(5)).load()   # a dos pixeles o menos
    out = im.copy()
    op = out.load()
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if not p[3]:
                continue
            c = p[:3]
            if c in PELO and cerca[x, y]:
                op[x, y] = PELO[c] + (p[3],)
            elif c in OJOS:
                op[x, y] = OJOS[c] + (p[3],)
    return out


def scale2x(im):
    """EPX / Scale2x: dobla sin emborronar y redondea las escaleras."""
    W, H = im.size
    src = im.load()
    out = Image.new('RGBA', (W * 2, H * 2))
    dst = out.load()

    def g(x, y):
        return src[min(W - 1, max(0, x)), min(H - 1, max(0, y))]

    for y in range(H):
        for x in range(W):
            E = src[x, y]
            B, D, F, Hh = g(x, y - 1), g(x - 1, y), g(x + 1, y), g(x, y + 1)
            e0 = D if (D == B and B != F and D != Hh) else E
            e1 = F if (B == F and B != D and F != Hh) else E
            e2 = D if (D == Hh and D != B and Hh != F) else E
            e3 = F if (Hh == F and D != Hh and B != F) else E
            dst[2 * x, 2 * y] = e0
            dst[2 * x + 1, 2 * y] = e1
            dst[2 * x, 2 * y + 1] = e2
            dst[2 * x + 1, 2 * y + 1] = e3
    return out


def raiz(im):
    """Entre los pies y en el suelo: el centro de lo que toca las 10 filas de abajo."""
    a = im.getchannel('A')
    bb = a.getbbox()
    suelo = bb[3]
    xs = []
    px = a.load()
    for y in range(suelo - 10, suelo):
        for x in range(im.width):
            if px[x, y]:
                xs.append(x)
    return (min(xs) + max(xs)) // 2, suelo


def empaqueta(frames, ancho=1024):
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


# LA ESTELA CON SUS PROPIOS BLANCOS. La media luna del tajo usa los mismos
# blancos que los brillos de la armadura (#ffffff, #f0f0f0, #eaeaea), asi que
# teñirla por color teñiria tambien la armadura. Se le quita UNA unidad de
# azul: a la vista es identica, y en el codigo sus blancos son solo suyos (el
# armario de caballero.js la tiñe con ellos). Se reconoce por el TAMAÑO:
# medido en la hoja, las manchas de la estela van de 1978 a 21092 px y los
# brillos de la armadura no pasan de 561.
ESTELA = {hexa('ffffff'): hexa('fffffe'), hexa('f0f0f0'): hexa('f0f0ef'), hexa('eaeaea'): hexa('eaeae9')}
ESTELA_MIN = 1000

# Los colores que el ARMARIO puede cambiar, de oscuro a claro: la capa (y el
# lazo del pecho, que va a juego), la falda y su ribete.
CAPA = ['243c90', '3060c0', '4878d8']
FALDA = ['84240c', '9c3018', 'b43c24', 'd83018', 'f04830']
RIBETE = ['d87830', 'f09048']


def marca_estela(hoja):
    W, H = hoja.size
    px = hoja.load()
    visto = bytearray(W * H)
    n_manchas = 0
    for y in range(H):
        for x in range(W):
            i = y * W + x
            if visto[i]:
                continue
            r, g, b, a = px[x, y]
            if not a or (r, g, b) not in ESTELA:
                continue
            mancha, pila = [], [(x, y)]
            visto[i] = 1
            while pila:
                cx, cy = pila.pop()
                mancha.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx]:
                        rr, gg, bb, aa = px[nx, ny]
                        if aa and (rr, gg, bb) in ESTELA:
                            visto[ny * W + nx] = 1
                            pila.append((nx, ny))
            if len(mancha) >= ESTELA_MIN:
                n_manchas += 1
                for cx, cy in mancha:
                    r, g, b, a = px[cx, cy]
                    px[cx, cy] = ESTELA[(r, g, b)] + (a,)
    return n_manchas


def indexado(hoja):
    W, H = hoja.size
    datos = hoja.tobytes()
    tabla, lista = {}, [(0, 0, 0)]
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
                raise SystemExit('mas de 255 colores')
        out[p] = i
    idx = Image.frombytes('P', (W, H), bytes(out))
    idx.putpalette([v for c in lista for v in c])
    buf = io.BytesIO()
    idx.save(buf, 'PNG', optimize=True, transparency=0)
    return buf.getvalue(), len(lista) - 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ruta', help='carpeta ArmoredHero del pack')
    ap.add_argument('--hoja', help='escribe tambien una hoja de contactos')
    args = ap.parse_args()

    cache = {}

    def celda(hoja, i):
        if (hoja, i) not in cache:
            c = celdas(args.ruta, hoja)[i]
            c = recolorea(c).transpose(Image.FLIP_LEFT_RIGHT)
            cache[(hoja, i)] = scale2x(c)
        return cache[(hoja, i)]

    rx, ry = raiz(celda('Idle', 0))

    unicos, pos_de = [], {}
    tabla = []
    for nom, fuentes in ANIMS:
        fila = []
        for hoja, i in fuentes:
            if (hoja, i) not in pos_de:
                c = celda(hoja, i)
                bb = c.getbbox()
                pos_de[(hoja, i)] = (len(unicos), bb[0] - rx, bb[1] - ry)
                unicos.append(c.crop(bb))
            fila.append(pos_de[(hoja, i)])
        tabla.append((nom, fuentes, fila))

    W, H, pos = empaqueta(unicos)
    hoja = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for f, p in zip(unicos, pos):
        hoja.paste(f, p)
    n_estela = marca_estela(hoja)
    png, ncol = indexado(hoja)
    os.makedirs(os.path.dirname(SALIDA_PNG), exist_ok=True)
    with open(SALIDA_PNG, 'wb') as fh:
        fh.write(png)

    lineas = []
    for nom, fuentes, fila in tabla:
        fs = []
        for u, ox, oy in fila:
            f, p = unicos[u], pos[u]
            fs.append(f'[{p[0]},{p[1]},{f.width},{f.height},{ox},{oy}]')
        origen = ', '.join(f'{h} {i}' for h, i in fuentes)
        lineas.append(f'  // {origen}' + NL + f'  {nom}: [' + NL + '    ' +
                      (',' + NL + '    ').join(fs) + '],')
    cab = [
        '// GENERADO por tools/romina-atlas.py -- no se edita a mano.',
        '//',
        '// Romina, dibujada a mano: "FemaleKnight" de retsuto',
        '// (retsuto.itch.io/femaleknight), con el pelo y los ojos negros, mirando',
        f'// a la derecha y doblada con Scale2x. {ncol} colores.',
        '//',
        '// Cada fotograma: [x, y, ancho, alto, ox, oy] -- su rectangulo en',
        '// img/romina.png y donde cae su esquina respecto a la RAIZ (entre los',
        '// pies, en el suelo), mirando a la DERECHA.',
        f'export const HOJA_W = {W}, HOJA_H = {H};',
        '',
        '// Lo que el ARMARIO puede teñir, de oscuro a claro: la capa (con el lazo',
        '// del pecho), la falda, su ribete y la estela del tajo (con sus propios',
        '// blancos: ver marca_estela en tools/romina-atlas.py).',
        'export const TINTES = {',
        '  capa: [' + ', '.join(f"'#{c}'" for c in CAPA) + '],',
        '  falda: [' + ', '.join(f"'#{c}'" for c in FALDA) + '],',
        '  ribete: [' + ', '.join(f"'#{c}'" for c in RIBETE) + '],',
        '  estela: [' + ', '.join("'#%02x%02x%02x'" % c for c in sorted(ESTELA.values(), key=sum)) + '],',
        '};',
        '',
        'export const FRAMES = {',
    ]
    js = NL.join(cab) + NL + NL.join(lineas) + NL + '};' + NL
    with open(SALIDA_JS, 'w', encoding='utf-8', newline=NL) as fh:
        fh.write(js)
    print(f'hoja {W}x{H}, {len(unicos)} fotogramas distintos, {ncol} colores, '
          f'PNG {len(png) / 1024:.0f} KB -> {os.path.relpath(SALIDA_PNG)}')
    print(f'raiz en la celda doblada: ({rx}, {ry}); mide {ry - celda("Idle", 0).getbbox()[1]} px de alto')
    print(f'estela: {n_estela} manchas con sus propios blancos')

    # --- Medidas que el juego necesita ---
    print(NL + 'ALCANCE por fotograma (lo mas adelantado respecto a la raiz):')
    for nom, fuentes, fila in tabla:
        print(f'  {nom:6s}', ' '.join(f'{ox + unicos[u].width:4d}' for u, ox, oy in fila))

    if args.hoja:
        cel, alto = 300, 330
        cols = max(len(f) for _, f, _ in tabla)
        sh = Image.new('RGBA', (cols * cel, len(tabla) * alto), (43, 31, 46, 255))
        d = ImageDraw.Draw(sh)
        for r, (nom, fuentes, fila) in enumerate(tabla):
            for c, (u, ox, oy) in enumerate(fila):
                bx, by = c * cel + 110, r * alto + alto - 20
                d.line([(c * cel, by), (c * cel + cel - 6, by)], fill=(90, 70, 90, 255))
                d.line([(bx, by - 180), (bx, by + 4)], fill=(90, 70, 90, 255))
                sh.paste(unicos[u], (bx + ox, by + oy), unicos[u])
                d.text((c * cel + 4, r * alto + 2), f'{nom} {c}', fill=(255, 224, 102, 255))
        sh.save(args.hoja)
        print('hoja de contactos ->', args.hoja)


if __name__ == '__main__':
    sys.exit(main())
