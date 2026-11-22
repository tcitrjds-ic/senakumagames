#!/usr/bin/env python3
"""せなくま美術館の素材を生成する（建物も内装もこの美術館だけのオリジナルデザイン）。

意匠の出どころは せなくまチャンネルのモチーフ（クマ耳・ポテト・やさしいパステル）で、
既存のゲームや実在の建物の見た目は写していない。

  1) 外観（タイトル画面の背景）
     丘の上の美術館。中央の丸屋根の左右に小さな丸屋根が2つ載り、正面から見るとクマの頭に見える
  2) 館内ホール(3D)用テクスチャ
     ヘリンボーンの木の床 / 白い腰板 / ミント色の壁紙（小さなポテト柄） / 格子の天井と天窓 /
     ローズ色の敷物 / 中央の丸いラグ / ガラス入りの玄関扉 / 白枠の窓 / クマの紋章の丸窓

不透明なテクスチャはJPEG(q85)、透過が要るもの（ラグ・扉・窓・丸窓・天窓）と外観はPNGで保存する。

使い方:
    pip install Pillow numpy
    python3 tools/make_gallery_assets.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "games" / "gallery" / "public" / "assets"
FONT = ROOT / "node_modules" / "@fontsource" / "m-plus-rounded-1c" / "files" / "m-plus-rounded-1c-latin-800-normal.woff"

GW, GH = 960, 540  # 外観画像の作図座標
S = 4              # 4倍で描いて2倍へ縮小（なめらかな輪郭にする）
FINAL = 2          # 出力は 1920x1080

random.seed(20261123)  # 何度生成しても同じ絵になるよう固定

# ---- 色（やさしいパステル）----
SKY_TOP = (150, 205, 245)
SKY_BOT = (232, 244, 252)
CLOUD = (255, 255, 255)
HILL_FAR = (176, 214, 170)
HILL_NEAR = (140, 196, 132)
GRASS = (124, 186, 112)
WALL = (252, 240, 222)        # 建物の壁（クリーム）
WALL_SHADE = (234, 216, 192)
ROOF = (240, 150, 150)        # 丸屋根（ローズ）
ROOF_SHADE = (214, 118, 124)
TRIM = (255, 252, 244)        # 白い縁どり・柱
TRIM_SHADE = (226, 218, 204)
WOOD = (166, 112, 70)
WOOD_DARK = (120, 78, 48)
WOOD_LIGHT = (204, 152, 100)
GLASS = (176, 216, 240)
GLASS_DARK = (132, 184, 220)
ROSE = (226, 134, 146)
ROSE_DARK = (198, 104, 120)
CREAM = (250, 240, 220)
MINT = (206, 232, 218)
MINT_DARK = (182, 214, 198)
GOLD = (236, 190, 84)
GOLD_DARK = (190, 140, 50)
BROWN = (110, 74, 48)


def save(img: Image.Image, name: str) -> None:
    """透過が必要な画像用: PNGで保存"""
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / name
    img.save(p, optimize=True)
    print(f"wrote {p} ({img.width}x{img.height}, {p.stat().st_size // 1024} KB)")


def save_opaque(img: Image.Image, name: str, quality: int = 85) -> None:
    """不透明なテクスチャ用: JPEGで保存（PNGの1/10前後になる）"""
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / name
    img.convert("RGB").save(p, quality=quality, optimize=True, subsampling=0)
    print(f"wrote {p} ({img.width}x{img.height}, {p.stat().st_size // 1024} KB)")


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def sc(v):
    return v * S


def rect(d, x0, y0, x1, y1, fill, radius=0):
    if radius:
        d.rounded_rectangle((sc(x0), sc(y0), sc(x1), sc(y1)), radius=sc(radius), fill=fill)
    else:
        d.rectangle((sc(x0), sc(y0), sc(x1), sc(y1)), fill=fill)


def ell(d, cx, cy, rx, ry, fill):
    d.ellipse((sc(cx - rx), sc(cy - ry), sc(cx + rx), sc(cy + ry)), fill=fill)


def poly(d, seq, fill):
    d.polygon([(sc(x), sc(y)) for x, y in seq], fill=fill)


def vgrad(w, h, top, bottom) -> Image.Image:
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    a = np.array(top, dtype=np.float32)[None, None, :]
    b = np.array(bottom, dtype=np.float32)[None, None, :]
    arr = np.repeat((a + (b - a) * t).astype(np.uint8), w, axis=1)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def grain(img: Image.Image, amount=3, seed=1, block=2) -> Image.Image:
    """質感用の粒子ノイズ（ブロック単位。振幅は小さめにして圧縮を保つ）"""
    arr = np.array(img.convert("RGBA")).astype(np.int16)
    rnd = np.random.default_rng(seed)
    h, w = arr.shape[:2]
    n = rnd.integers(-amount, amount + 1, size=(-(-h // block), -(-w // block), 1))
    n = np.repeat(np.repeat(n, block, axis=0), block, axis=1)[:h, :w]
    arr[..., :3] = np.clip(arr[..., :3] + n, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


# ======================================================================
# せなくまの紋章（クマの顔。丸窓・外観・ラグで使う）
# ======================================================================
def bear_face(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, k: float, face, ear_inner, line) -> None:
    """クマの顔。k は作図倍率（座標は k 倍して描く）"""
    def e(x, y, rx, ry, fill):
        d.ellipse(((x - rx) * k, (y - ry) * k, (x + rx) * k, (y + ry) * k), fill=fill)
    for sx in (-1, 1):
        e(cx + sx * r * 0.68, cy - r * 0.62, r * 0.36, r * 0.36, face)
        e(cx + sx * r * 0.68, cy - r * 0.62, r * 0.19, r * 0.19, ear_inner)
    e(cx, cy, r, r * 0.92, face)
    e(cx, cy + r * 0.30, r * 0.42, r * 0.32, ear_inner)       # 口まわり
    for sx in (-1, 1):
        e(cx + sx * r * 0.38, cy - r * 0.10, r * 0.085, r * 0.11, line)  # 目
    e(cx, cy + r * 0.18, r * 0.12, r * 0.085, line)           # 鼻


# ======================================================================
# 1. 外観
# ======================================================================
def cloud(d, cx, cy, w):
    h = w * 0.4
    for dx, dy, rr in [(-0.32, 0.08, 0.30), (-0.08, -0.12, 0.38), (0.2, -0.02, 0.34), (0.4, 0.12, 0.24)]:
        ell(d, cx + dx * w, cy + dy * h, rr * w * 0.6, rr * w * 0.42, CLOUD)
    rect(d, cx - w * 0.42, cy + h * 0.1, cx + w * 0.5, cy + h * 0.42, CLOUD, radius=h * 0.16)


def hills(d, base, amp, color, seed):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    seq = [(0, GH)]
    for x in range(0, GW + 8, 8):
        y = base - amp * (0.55 * math.sin(x / 130 + ph[0]) + 0.3 * math.sin(x / 61 + ph[1]) + 0.15 * math.sin(x / 33 + ph[2]))
        seq.append((x, y))
    seq.append((GW, GH))
    poly(d, seq, color)


def tree(d, x, y, r):
    rect(d, x - r * 0.12, y - r * 0.2, x + r * 0.12, y + r * 0.9, WOOD_DARK)
    ell(d, x, y - r * 0.5, r, r * 0.95, (116, 178, 108))
    ell(d, x - r * 0.25, y - r * 0.75, r * 0.5, r * 0.45, (142, 198, 128))


def dome(d, cx, base_y, r):
    """丸屋根（半円）。左上にやわらかい照り、てっぺんに小さな玉"""
    d.pieslice((sc(cx - r), sc(base_y - r), sc(cx + r), sc(base_y + r)), 180, 360, fill=ROOF)
    ell(d, cx - r * 0.36, base_y - r * 0.56, r * 0.26, r * 0.15, (248, 180, 178))
    rect(d, cx - r * 1.06, base_y - 3, cx + r * 1.06, base_y + 5, TRIM, radius=2)
    ell(d, cx, base_y - r - 4, 4, 4, GOLD)


def make_outside() -> None:
    img = vgrad(GW * S, GH * S, SKY_TOP, SKY_BOT)
    d = ImageDraw.Draw(img)
    for cx, cy, w in [(130, 90, 150), (410, 58, 110), (760, 104, 170), (600, 150, 90)]:
        cloud(d, cx, cy, w)
    hills(d, 330, 34, HILL_FAR, 1)
    hills(d, 372, 26, HILL_NEAR, 2)
    rect(d, 0, 392, GW, GH, GRASS)

    cx = GW / 2
    # ---- 建物: 左右の翼 → 中央棟 → 丸屋根3つ（クマの頭の形）----
    for sx in (-1, 1):
        x0, x1 = sorted((cx + sx * 150, cx + sx * 318))
        rect(d, x0, 268, x1, 400, WALL)
        rect(d, x0, 258, x1, 270, TRIM, radius=3)
        rect(d, x0, 388, x1, 400, WALL_SHADE)
        for i in range(3):                      # 翼の窓（上が丸い）
            wx = x0 + 28 + i * 56
            rect(d, wx - 15, 300, wx + 15, 362, TRIM, radius=15)
            rect(d, wx - 11, 304, wx + 11, 358, GLASS, radius=11)
            rect(d, wx - 1.5, 304, wx + 1.5, 358, TRIM)
            rect(d, wx - 11, 330, wx + 11, 333, TRIM)
    rect(d, cx - 160, 220, cx + 160, 400, WALL)
    rect(d, cx - 160, 388, cx + 160, 400, WALL_SHADE)
    # 丸屋根: 中央（頭）の左右の肩に、丸い小屋根（耳）がのぞく
    for sx in (-1, 1):
        ell(d, cx + sx * 74, 152, 31, 31, ROOF_SHADE)
        ell(d, cx + sx * 74, 152, 16, 16, (248, 196, 190))
    dome(d, cx, 222, 92)
    # 正面の帯（館名）
    rect(d, cx - 172, 212, cx + 172, 250, TRIM, radius=4)
    rect(d, cx - 172, 244, cx + 172, 250, TRIM_SHADE)
    font = ImageFont.truetype(str(FONT), sc(15))
    text = "SENAKUMA  MUSEUM"
    spacing = sc(2.6)
    widths = [font.getlength(ch) for ch in text]
    tx = sc(cx) - (sum(widths) + spacing * (len(text) - 1)) / 2
    for ch, wch in zip(text, widths):
        d.text((tx, sc(229)), ch, font=font, fill=BROWN, anchor="lm")
        tx += wch + spacing
    # 柱（6本）
    for i in range(6):
        px = cx - 140 + i * 56
        rect(d, px - 9, 256, px + 9, 388, TRIM, radius=3)
        rect(d, px + 3, 256, px + 9, 388, TRIM_SHADE)
        rect(d, px - 13, 250, px + 13, 260, TRIM, radius=2)
        rect(d, px - 13, 384, px + 13, 392, TRIM, radius=2)
    # 玄関（ガラスの入った木の扉）とクマの紋章の丸窓
    rect(d, cx - 30, 306, cx + 30, 392, WOOD_DARK, radius=6)
    rect(d, cx - 26, 310, cx - 1.5, 392, WOOD)
    rect(d, cx + 1.5, 310, cx + 26, 392, WOOD)
    for sx in (-1, 1):
        rect(d, cx + sx * 14 - 8, 318, cx + sx * 14 + 8, 352, GLASS, radius=3)
        ell(d, cx + sx * 4.5, 356, 2, 2, GOLD)
    ell(d, cx, 282, 19, 19, TRIM)
    ell(d, cx, 282, 15.5, 15.5, (255, 232, 214))
    bear_face(d, cx, 284, 9.5, S, (214, 150, 104), (246, 214, 180), BROWN)
    # 階段と小道
    for i, (hw, y) in enumerate([(54, 392), (66, 400), (78, 408)]):
        rect(d, cx - hw, y, cx + hw, y + 9, lerp(TRIM, TRIM_SHADE, i / 3))
    poly(d, [(cx - 78, 417), (cx + 78, 417), (cx + 190, GH), (cx - 190, GH)], (238, 222, 196))
    poly(d, [(cx - 60, 417), (cx + 60, 417), (cx + 150, GH), (cx - 150, GH)], (246, 234, 212))
    # 木と花
    for x, y, r in [(92, 372, 34), (190, 384, 24), (780, 380, 28), (878, 368, 36)]:
        tree(d, x, y, r)
    for i in range(46):
        x = random.uniform(10, GW - 10)
        if abs(x - cx) < 200:
            continue
        y = random.uniform(430, GH - 12)
        col = random.choice([(250, 190, 200), (255, 232, 140), (255, 255, 255)])
        ell(d, x, y, 3.2, 3.2, col)
        ell(d, x, y, 1.3, 1.3, (244, 196, 80))
    save(img.resize((GW * FINAL, GH * FINAL), Image.LANCZOS), "outside.png")


# ======================================================================
# 2. 館内ホール用テクスチャ
# ======================================================================
def make_floor() -> None:
    """寄木の床（4枚ずつ向きを変えて並べる市松張り）。継ぎ目なく繰り返せる"""
    n = 512
    block = 128          # 1ブロック = 板4枚
    plank = block // 4
    img = Image.new("RGBA", (n, n), WOOD + (255,))
    d = ImageDraw.Draw(img)
    rnd = random.Random(5)
    for by in range(n // block):
        for bx in range(n // block):
            horiz = (bx + by) % 2 == 0
            for i in range(4):
                tone = rnd.uniform(-1, 1)
                col = lerp(WOOD, WOOD_LIGHT if tone > 0 else WOOD_DARK, abs(tone) * 0.38)
                x0, y0 = bx * block, by * block
                box = (x0, y0 + i * plank, x0 + block, y0 + (i + 1) * plank) if horiz else (x0 + i * plank, y0, x0 + (i + 1) * plank, y0 + block)
                d.rectangle(box, fill=col + (255,))
                d.rectangle(box, outline=lerp(WOOD_DARK, WOOD, 0.35) + (255,), width=1)
    save_opaque(grain(img, 3, 2), "tex_floor.jpg")


def make_rug() -> None:
    """ホール中央の丸いラグ: ローズ色の輪と、まわりを歩くクマの足あと"""
    n = 1024
    k = 2
    img = Image.new("RGBA", (n * k, n * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = n * k / 2

    def ring(r, col):
        d.ellipse((c - r * k, c - r * k, c + r * k, c + r * k), fill=col + (255,))

    ring(500, ROSE_DARK)
    ring(484, CREAM)
    ring(456, ROSE)
    ring(336, CREAM)
    ring(320, (244, 206, 208))
    ring(180, CREAM)
    ring(166, (250, 226, 196))
    # 輪の上の足あと（肉球4つ + 掌）
    for i in range(12):
        a = i * math.tau / 12
        px, py = c + math.cos(a) * 396 * k, c + math.sin(a) * 396 * k
        ux, uy = math.cos(a), math.sin(a)          # 外向き
        vx, vy = -uy, ux                            # 進行方向
        d.ellipse((px - 22 * k, py - 18 * k, px + 22 * k, py + 18 * k), fill=CREAM + (255,))
        for t in (-1.5, -0.5, 0.5, 1.5):
            qx = px + (ux * 26 + vx * t * 14) * k
            qy = py + (uy * 26 + vy * t * 14) * k
            d.ellipse((qx - 7.5 * k, qy - 7.5 * k, qx + 7.5 * k, qy + 7.5 * k), fill=CREAM + (255,))
    # 中央にクマの紋章
    bear_face(d, n / 2, n / 2 + 8, 92, k, (224, 164, 118), (250, 226, 196), BROWN)
    save(grain(img.resize((n, n), Image.LANCZOS), 2, 3), "tex_rug.png")


def make_wall_lower() -> None:
    """白い腰板（框で区切った羽目板）。横に繰り返せる"""
    w, h = 512, 256
    img = Image.new("RGBA", (w, h), TRIM + (255,))
    d = ImageDraw.Draw(img)
    for i in range(2):
        x0 = i * 256 + 22
        d.rounded_rectangle((x0, 30, x0 + 212, h - 36), radius=6, fill=(244, 238, 226, 255), outline=TRIM_SHADE + (255,), width=3)
        d.rounded_rectangle((x0 + 12, 42, x0 + 200, h - 48), radius=4, outline=(255, 255, 255, 255), width=3)
    d.rectangle((0, 0, w, 14), fill=TRIM_SHADE + (255,))
    d.rectangle((0, h - 22, w, h), fill=(232, 222, 206, 255))
    save_opaque(grain(img, 2, 4), "tex_wall_lower.jpg")


def make_wall_upper() -> None:
    """ミント色の壁紙: 細い縦じまと、小さなポテト（だ円）と点の柄"""
    n = 512
    img = Image.new("RGBA", (n, n), MINT + (255,))
    d = ImageDraw.Draw(img)
    for x in range(0, n, 64):
        d.rectangle((x, 0, x + 3, n), fill=MINT_DARK + (255,))
    for gy in range(4):
        for gx in range(8):
            x = gx * 64 + 34
            y = gy * 128 + (32 if gx % 2 == 0 else 96)
            if (gx + gy) % 2 == 0:
                d.ellipse((x - 9, y - 6, x + 9, y + 6), fill=(250, 232, 180, 255))
                d.ellipse((x - 3, y - 2, x - 1, y), fill=(226, 196, 130, 255))
            else:
                d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(255, 255, 255, 255))
    save_opaque(grain(img, 2, 5), "tex_wall_upper.jpg")


def make_ceiling() -> None:
    """白い格天井（四角い枠の中にクリーム色の板）"""
    n = 256
    img = Image.new("RGBA", (n, n), TRIM + (255,))
    d = ImageDraw.Draw(img)
    d.rectangle((18, 18, n - 18, n - 18), fill=TRIM_SHADE + (255,))
    d.rectangle((26, 26, n - 26, n - 26), fill=CREAM + (255,))
    d.rectangle((40, 40, n - 40, n - 40), outline=(255, 255, 255, 255), width=3)
    save_opaque(grain(img, 2, 6), "tex_ceiling.jpg")


def make_skylight() -> None:
    """天窓: 白い桟で区切った明るいガラス"""
    w, h = 512, 768
    img = vgrad(w, h, (214, 238, 252), (240, 250, 255))
    d = ImageDraw.Draw(img)
    for cx, cy, r in [(150, 190, 70), (360, 470, 90), (240, 640, 60)]:  # 雲のうす影
        d.ellipse((cx - r, cy - r * 0.5, cx + r, cy + r * 0.5), fill=(255, 255, 255, 255))
    for i in range(5):
        x = i * w / 4
        d.rectangle((x - 7, 0, x + 7, h), fill=TRIM + (255,))
    for i in range(7):
        y = i * h / 6
        d.rectangle((0, y - 7, w, y + 7), fill=TRIM + (255,))
    d.rectangle((0, 0, w - 1, h - 1), outline=TRIM_SHADE + (255,), width=10)
    save(img, "tex_skylight.png")


def make_carpet() -> None:
    """通路の敷物: ローズ色に小さなクリームの点"""
    n = 256
    img = Image.new("RGBA", (n, n), ROSE + (255,))
    d = ImageDraw.Draw(img)
    for y in range(0, n, 32):
        for x in range(0, n, 32):
            ox = 16 if (y // 32) % 2 else 0
            d.ellipse((x + ox + 12, y + 12, x + ox + 20, y + 20), fill=(244, 196, 200, 255))
    save_opaque(grain(img, 3, 8), "tex_carpet.jpg")


def make_doors() -> None:
    """玄関: ガラス入りの両開きの木の扉（白い枠・四角い形）。通用口: 一枚板の扉"""
    w, h = 384, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=18, fill=TRIM + (255,))
    d.rectangle((18, 22, w - 18, h), fill=WOOD_DARK + (255,))
    for i in range(2):
        x0 = 24 + i * (w - 48) / 2 + (4 if i else 0)
        x1 = x0 + (w - 48) / 2 - 4
        d.rectangle((x0, 28, x1, h), fill=WOOD + (255,))
        d.rounded_rectangle((x0 + 20, 54, x1 - 20, 300), radius=10, fill=GLASS_DARK + (255,))
        d.rounded_rectangle((x0 + 26, 60, x1 - 26, 294), radius=7, fill=GLASS + (255,))
        d.line((x0 + 40, 280, x1 - 44, 76), fill=(226, 242, 252, 255), width=8)   # ガラスの照り
        d.rounded_rectangle((x0 + 20, 334, x1 - 20, h - 30), radius=8, outline=WOOD_DARK + (255,), width=5)
        hx = x1 - 14 if i == 0 else x0 + 14
        d.rounded_rectangle((hx - 6, 300, hx + 6, 372), radius=6, fill=GOLD + (255,), outline=GOLD_DARK + (255,), width=2)
    save(grain(img, 2, 7), "tex_door.png")

    w, h = 256, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=14, fill=TRIM + (255,))
    d.rectangle((16, 18, w - 16, h), fill=WOOD + (255,))
    for y0, y1 in [(44, 232), (262, h - 34)]:
        d.rounded_rectangle((40, y0, w - 40, y1), radius=8, outline=WOOD_DARK + (255,), width=5)
    d.ellipse((w - 62, 244, w - 38, 268), fill=GOLD + (255,), outline=GOLD_DARK + (255,), width=2)
    save(grain(img, 2, 9), "tex_door_side.png")


def make_window() -> None:
    """縦長の窓: 白い枠、上が丸い、明るい空のガラス"""
    w, h = 256, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=w // 2, fill=TRIM + (255,))
    glass = vgrad(w, h, (176, 220, 248), (228, 244, 252))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((18, 18, w - 19, h - 19), radius=w // 2 - 18, fill=255)
    img.paste(glass, (0, 0), mask)
    d.rectangle((w / 2 - 5, 18, w / 2 + 5, h - 18), fill=TRIM + (255,))
    for y in (h * 0.36, h * 0.62):
        d.rectangle((18, y - 5, w - 18, y + 5), fill=TRIM + (255,))
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=w // 2, outline=TRIM_SHADE + (255,), width=4)
    save(img, "tex_window.png")


def make_emblem_glass() -> None:
    """玄関の上の丸窓: クマの紋章のステンドグラス"""
    n = 512
    k = 2
    img = Image.new("RGBA", (n * k, n * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = n * k / 2

    def ring(r, col):
        d.ellipse((c - r * k, c - r * k, c + r * k, c + r * k), fill=col + (255,))

    ring(254, TRIM_SHADE)
    ring(244, TRIM)
    ring(222, (255, 226, 210))
    # 放射状のガラス片（パステル4色）
    cols = [(255, 214, 220), (255, 238, 190), (214, 238, 222), (214, 228, 250)]
    for i in range(16):
        a0, a1 = i * 22.5, (i + 1) * 22.5
        d.pieslice((c - 222 * k, c - 222 * k, c + 222 * k, c + 222 * k), a0, a1, fill=cols[i % 4] + (255,))
    for i in range(16):
        a = math.radians(i * 22.5)
        d.line((c, c, c + math.cos(a) * 222 * k, c + math.sin(a) * 222 * k), fill=TRIM + (255,), width=5 * k)
    ring(150, TRIM)
    ring(140, (255, 240, 222))
    bear_face(d, n / 2, n / 2 + 10, 96, k, (214, 150, 104), (246, 214, 180), BROWN)
    save(img.resize((n, n), Image.LANCZOS), "glass_emblem.png")


if __name__ == "__main__":
    make_outside()
    make_floor()
    make_rug()
    make_wall_lower()
    make_wall_upper()
    make_ceiling()
    make_skylight()
    make_carpet()
    make_doors()
    make_window()
    make_emblem_glass()
