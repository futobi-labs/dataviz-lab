"""Bake the Pressroom canvas background for Power BI (pressroom/canvas-light.jpg, -dark.jpg).
Stock, tile blocks, paper tooth and riso speckle at 2x (2560 x 1440) for a 1280 x 720 page.
Layout mirrors pressroom/layout.js. Run from the repo root: python3 tools/pressroom_canvas.py"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 2                      # 2x for crisp display
W, H, PAD, GAP, COLS, ROWS = 1280, 720, 16, 12, 12, 6
TILES = [  # block, [col, row, colspan, rowspan]  (keep in step with layout.js)
    ("stone", (1, 1, 4, 2)), ("harbor", (5, 1, 3, 2)), ("marigold", (8, 1, 5, 3)), ("persimmon", (1, 3, 7, 1)),
    ("paper", (1, 4, 5, 3)), ("moss", (6, 4, 3, 3)), ("paper", (9, 4, 4, 2)), ("patina", (9, 6, 4, 1)),
]
MODES = {
    "light": dict(stock="#ebe4d6", paper="#f6f1e7", stone="#d9d0bf", harbor="#23446b", persimmon="#e9693c",
                  marigold="#f0c23e", moss="#55622c", patina="#1d6a5d", grain=0.10, speck=0.26, edge_hi=0.35, edge_lo=0.08),
    "dark": dict(stock="#12110f", paper="#1d1b18", stone="#2a2722", harbor="#284c78", persimmon="#d8673c",
                 marigold="#cfa030", moss="#4b5727", patina="#1b5e53", grain=0.05, speck=0.28, edge_hi=0.06, edge_lo=0.35),
}

def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255

def rect(col, row, cs, rs):
    cw = (W - 2 * PAD - (COLS - 1) * GAP) / COLS
    rh = (H - 2 * PAD - (ROWS - 1) * GAP) / ROWS
    x, y = PAD + (col - 1) * (cw + GAP), PAD + (row - 1) * (rh + GAP)
    return [round(v * S) for v in (x, y, x + cs * cw + (cs - 1) * GAP, y + rs * rh + (rs - 1) * GAP)]

def bake(mode, seed=11):
    m = MODES[mode]
    rng = np.random.default_rng(seed)
    w, h = W * S, H * S
    img = np.ones((h, w, 3), np.float32) * rgb(m["stock"])
    for block, area in TILES:
        x0, y0, x1, y1 = rect(*area)
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([x0, y0, x1, y1], radius=10 * S, fill=255)
        a = np.asarray(mask, np.float32)[..., None] / 255
        # soft lift shadow under the tile
        sh = np.asarray(mask.filter(ImageFilter.GaussianBlur(3 * S)), np.float32)[..., None] / 255
        sh = np.roll(sh, S, axis=0)
        img = img * (1 - 0.06 * sh * (1 - a))
        img = img * (1 - a) + rgb(m[block]) * a
        # edge light on top, edge dark on bottom
        top = np.zeros((h, w, 1), np.float32); top[y0:y0 + S, x0 + 10 * S:x1 - 10 * S] = 1
        bot = np.zeros((h, w, 1), np.float32); bot[y1 - S:y1, x0 + 10 * S:x1 - 10 * S] = 1
        img = img + (1 - img) * m["edge_hi"] * top
        img = img * (1 - m["edge_lo"] * bot)
        if block != "paper":
            # riso speckle: sparse hard dots, ink-dark
            n = rng.random((h, w)).astype(np.float32)
            sp = (n > 0.9982).astype(np.float32)
            sp = np.asarray(Image.fromarray((sp * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255
            img = img * (1 - m["speck"] * sp[..., None] * a)
    # paper tooth over everything: fine noise, slightly blurred so it reads as fibre not pixels
    g = rng.normal(0, 1, (h, w)).astype(np.float32)
    g = np.asarray(Image.fromarray(((g * 40 + 128).clip(0, 255)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255 - 0.5
    img = img * (1 + m["grain"] * 2 * g[..., None])
    out = Image.fromarray((img.clip(0, 1) * 255).astype(np.uint8))
    out.save(f"pressroom/canvas-{mode}.jpg", quality=84, optimize=True, progressive=True)

for mode in MODES:
    bake(mode)
print("wrote pressroom/canvas-light.jpg, pressroom/canvas-dark.jpg")
