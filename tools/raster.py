"""Rasteriza los comandos de canvas capturados, con PIL. Supersampling x4."""
import json, math, io, sys
from PIL import Image, ImageDraw, ImageFont

SS = 4          # supersampling
CW, CH = 158, 116

def hexcol(c, alpha=1.0):
    if not isinstance(c, str):
        return (200, 200, 200, int(255 * alpha))
    c = c.strip()
    if c.startswith('rgba'):
        p = c[c.index('(') + 1:c.index(')')].split(',')
        return (int(float(p[0])), int(float(p[1])), int(float(p[2])),
                int(255 * float(p[3]) * alpha))
    if c.startswith('#'):
        h = c[1:]
        if len(h) == 3:
            h = ''.join(ch * 2 for ch in h)
        if len(h) == 8:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16),
                    int(int(h[6:8], 16) * alpha))
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(255 * alpha))
    return (200, 200, 200, int(255 * alpha))


def grad_at(stops, t, alpha=1.0):
    """Color interpolado en un degradado, para t en [0,1]."""
    prev = stops[0]
    for st in stops:
        if t <= st[0]:
            if st[0] == prev[0]:
                return hexcol(st[1], alpha)
            f = (t - prev[0]) / (st[0] - prev[0])
            a = hexcol(prev[1], alpha); b = hexcol(st[1], alpha)
            return tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(4))
        prev = st
    return hexcol(stops[-1][1], alpha)


class Mat:
    __slots__ = ('a', 'b', 'c', 'd', 'e', 'f')
    def __init__(s, a=1, b=0, c=0, d=1, e=0, f=0):
        s.a, s.b, s.c, s.d, s.e, s.f = a, b, c, d, e, f
    def copy(s):
        return Mat(s.a, s.b, s.c, s.d, s.e, s.f)
    def apply(s, x, y):
        return (s.a * x + s.c * y + s.e, s.b * x + s.d * y + s.f)
    def translate(s, tx, ty):
        s.e += s.a * tx + s.c * ty
        s.f += s.b * tx + s.d * ty
    def rotate(s, r):
        co, si = math.cos(r), math.sin(r)
        a, b, c, d = s.a, s.b, s.c, s.d
        s.a = a * co + c * si;  s.b = b * co + d * si
        s.c = -a * si + c * co; s.d = -b * si + d * co
    def scale(s, sx, sy):
        s.a *= sx; s.b *= sx; s.c *= sy; s.d *= sy
    def avgscale(s):
        return (math.hypot(s.a, s.b) + math.hypot(s.c, s.d)) * 0.5


def flatten_quad(p0, cp, p1, n=14):
    out = []
    for i in range(1, n + 1):
        t = i / n
        mt = 1 - t
        out.append((mt * mt * p0[0] + 2 * mt * t * cp[0] + t * t * p1[0],
                    mt * mt * p0[1] + 2 * mt * t * cp[1] + t * t * p1[1]))
    return out


def render(ops, out_path):
    W, H = CW * SS, CH * SS
    img = Image.new('RGBA', (W, H), (36, 22, 51, 255))
    d = ImageDraw.Draw(img)
    # suelo de referencia
    d.line([(0, 88 * SS), (W, 88 * SS)], fill=(255, 255, 255, 46), width=SS)

    m = Mat()
    stack = []
    path = []      # lista de subpaths; cada uno lista de puntos en espacio LOCAL
    cur = None

    def dev(pts):
        return [tuple(v * SS for v in m.apply(x, y)) for (x, y) in pts]

    for op in ops:
        k = op[0]
        if k == 'save':
            stack.append(m.copy())
        elif k == 'restore':
            if stack: m = stack.pop()
        elif k == 'translate':
            m.translate(op[1], op[2])
        elif k == 'rotate':
            m.rotate(op[1])
        elif k == 'scale':
            m.scale(op[1], op[2])
        elif k == 'beginPath':
            path = []; cur = None
        elif k == 'moveTo':
            cur = [(op[1], op[2])]; path.append(cur)
        elif k == 'lineTo':
            if cur is None:
                cur = [(op[1], op[2])]; path.append(cur)
            else:
                cur.append((op[1], op[2]))
        elif k == 'quad':
            if cur:
                cur.extend(flatten_quad(cur[-1], (op[1], op[2]), (op[3], op[4])))
        elif k == 'closePath':
            if cur and len(cur) > 2:
                cur.append(cur[0])
        elif k == 'arc':
            x, y, r, s0, s1 = op[1], op[2], op[3], op[4], op[5]
            pts = []
            steps = max(10, int(abs(s1 - s0) * r * 1.4))
            for i in range(steps + 1):
                a = s0 + (s1 - s0) * i / steps
                pts.append((x + math.cos(a) * r, y + math.sin(a) * r))
            cur = pts; path.append(cur)
        elif k == 'ellipse':
            x, y, rx, ry, rot, s0, s1 = op[1:8]
            pts = []
            for i in range(41):
                a = s0 + (s1 - s0) * i / 40
                px, py = math.cos(a) * rx, math.sin(a) * ry
                pts.append((x + px * math.cos(rot) - py * math.sin(rot),
                            y + px * math.sin(rot) + py * math.cos(rot)))
            cur = pts; path.append(cur)
        elif k == 'rect':
            x, y, w, h = op[1:5]
            cur = [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)]
            path.append(cur)
        elif k == 'fill':
            style, alpha = op[1], op[2]
            if isinstance(style, dict) and '__grad' in style:
                # Degradado lineal vertical: se pinta el poligono en una mascara
                # y se compone una rampa de color a traves de ella. Sin esto el
                # relleno salia gris plano y era imposible juzgar el diseno.
                gr = style['__grad']
                for sp in path:
                    if len(sp) < 3:
                        continue
                    pts = dev(sp)
                    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                    x0i, x1i = int(min(xs)) - 1, int(max(xs)) + 2
                    y0i, y1i = int(min(ys)) - 1, int(max(ys)) + 2
                    w2, h2 = max(1, x1i - x0i), max(1, y1i - y0i)
                    mask = Image.new('L', (w2, h2), 0)
                    ImageDraw.Draw(mask).polygon([(p[0] - x0i, p[1] - y0i) for p in pts], fill=255)
                    ramp = Image.new('RGBA', (w2, h2))
                    rd = ImageDraw.Draw(ramp)
                    stops = gr.get('stops') or [[0, '#888'], [1, '#333']]
                    # Los stops del gradiente van en el eje Y local; se aproxima
                    # mapeando el alto del bounding box, que para estas piezas
                    # (todas mas anchas que altas y sin rotar) es fiel.
                    for yy in range(h2):
                        t = yy / max(1, h2 - 1)
                        c = grad_at(stops, t, alpha)
                        rd.line([(0, yy), (w2, yy)], fill=c)
                    img.paste(ramp, (x0i, y0i), mask)
            else:
                col = hexcol(style if isinstance(style, str) else '#9aa', alpha)
                for sp in path:
                    if len(sp) >= 3:
                        d.polygon(dev(sp), fill=col)
        elif k == 'stroke':
            col = hexcol(op[1], op[4] if len(op) > 4 else 1.0)
            lw = max(1, int(round(op[2] * m.avgscale() * SS)))
            rnd = (len(op) > 3 and op[3] == 'round')
            for sp in path:
                if len(sp) >= 2:
                    pts = dev(sp)
                    d.line(pts, fill=col, width=lw, joint='curve')
                    if rnd:
                        rr = lw / 2
                        for (px, py) in (pts[0], pts[-1]):
                            d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=col)
        elif k == 'fillRect':
            x, y, w, h = op[1:5]
            col = hexcol(op[5], op[6])
            pts = dev([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
            d.polygon(pts, fill=col)

    return img.resize((CW, CH), Image.LANCZOS)


def main():
    data = json.load(io.open(sys.argv[1], encoding='utf-8'))
    cols = int(sys.argv[3]) if len(sys.argv)>3 else 3
    rows = (len(data) + cols - 1) // cols
    LBL = 16
    sheet = Image.new('RGB', (CW * cols, (CH + LBL) * rows), (26, 16, 64))
    dd = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('arial.ttf', 11)
    except Exception:
        font = ImageFont.load_default()
    for i, pose in enumerate(data):
        im = render(pose['ops'], None)
        cx, cy = (i % cols) * CW, (i // cols) * (CH + LBL)
        sheet.paste(im, (cx, cy))
        dd.text((cx + 6, cy + CH + 2), pose['name'], fill=(230, 230, 240), font=font)
    sheet = sheet.resize((sheet.width * 3, sheet.height * 3), Image.LANCZOS)
    sheet.save(sys.argv[2])
    print('escrito', sys.argv[2], sheet.size)


main()
