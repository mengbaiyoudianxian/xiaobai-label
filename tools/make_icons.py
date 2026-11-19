"""Draw the 小白标注 logo (same design as static/logo.svg) as PNG / ICO for favicons.
    python tools/make_icons.py      (needs Pillow; the label-studio venv has it)
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'xiaobai_label' / 'static'
STOPS = [(0.0, (255, 79, 216)), (0.5, (180, 77, 255)), (1.0, (75, 123, 255))]


def mix(t):
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0)
            return tuple(round(a + (b - a) * k) for a, b in zip(c0, c1))
    return STOPS[-1][1]


def logo(size):
    s = 8                                   # draw big, then shrink: smooth edges
    n = size * s
    grad = Image.new('RGB', (n, n))
    px = grad.load()
    for y in range(n):
        for x in range(n):
            px[x, y] = mix((x + y) / (2 * (n - 1)))
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 16 // 64, fill=255)
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    u = n / 64
    w = round(4.5 * u)
    for pts in ([(17, 26), (17, 17), (26, 17)], [(38, 17), (47, 17), (47, 26)],
                [(47, 38), (47, 47), (38, 47)], [(26, 47), (17, 47), (17, 38)]):
        d.line([(x * u, y * u) for x, y in pts], fill='white', width=w, joint='curve')
        for x, y in pts:
            d.ellipse([x * u - w / 2, y * u - w / 2, x * u + w / 2, y * u + w / 2], fill='white')
    d.ellipse([27 * u, 27 * u, 37 * u, 37 * u], fill='white')
    return img.resize((size, size), Image.LANCZOS)


big = logo(256)
big.resize((64, 64), Image.LANCZOS).save(OUT / 'logo-64.png')
big.resize((180, 180), Image.LANCZOS).save(OUT / 'logo-180.png')
big.save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print('wrote', [p.name for p in OUT.glob('*') if p.suffix in ('.png', '.ico')])
