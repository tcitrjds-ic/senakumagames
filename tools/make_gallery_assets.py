#!/usr/bin/env python3
"""せなくま美術館（ピーチ城）の素材を生成する。

スーパーマリオ64のピーチ城を参考にした
  1) 城の外観（タイトル画面）: 灰白色の石壁・赤い屋根瓦・四隅の塔・二段の中央塔・
     正面のピーチ姫ステンドグラス・堀と石橋・滝
  2) 城内ホール(3D)用テクスチャ: 白黒チェック床、太陽のモザイク絨毯（橙と紫の光線）、
     石の腰壁、「青空・雲・緑の丘」の壁画、天井、木の扉（星の扉）、アーチ窓、絨毯
を Pillow で描く。

使い方:
    pip install Pillow numpy
    python tools/make_gallery_assets.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "games" / "gallery" / "public" / "assets"

GW, GH = 960, 540  # ゲーム座標
S = 4  # 描画倍率（×4で描いて×2へ縮小 → アンチエイリアス）
FINAL = 2  # 出力倍率（1920×1080）

random.seed(64)

# ---- 色 ----------------------------------------------------------------
SKY_TOP = (78, 146, 236)
SKY_BOT = (172, 214, 250)
GRASS = (96, 172, 72)
GRASS_DARK = (74, 146, 58)
GRASS_LIGHT = (122, 196, 92)
STONE = (226, 224, 216)  # 灰白色の石（マリオ64の城壁）
STONE_SHADE = (196, 194, 186)
STONE_LINE = (184, 182, 174)
ROOF = (208, 58, 48)
ROOF_DARK = (160, 40, 36)
ROOF_LIGHT = (232, 92, 78)
WOOD = (118, 72, 42)
WOOD_DARK = (84, 50, 30)
WOOD_LIGHT = (150, 98, 58)
WATER = (58, 122, 214)
WATER_LIGHT = (128, 182, 240)
CLOUD = (255, 255, 255)
WALL_CREAM = (238, 226, 198)
WALL_CREAM_DARK = (214, 198, 164)
CARPET = (188, 34, 44)
CARPET_DARK = (146, 24, 34)
CARPET_EDGE = (222, 176, 78)
TILE_W = (244, 242, 236)
TILE_B = (40, 38, 48)
GOLD = (222, 176, 62)
GOLD_DARK = (150, 108, 30)
GOLD_LIGHT = (252, 226, 130)


def save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / name
    img.save(p)
    print(f"wrote {p} ({img.width}x{img.height})")


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def canvas() -> Image.Image:
    return Image.new("RGBA", (GW * S, GH * S), (0, 0, 0, 0))


def finish(img: Image.Image) -> Image.Image:
    return img.resize((GW * FINAL, GH * FINAL), Image.LANCZOS)


def sc(v):
    return v * S


def pts(seq):
    return [(x * S, y * S) for x, y in seq]


def poly(d: ImageDraw.ImageDraw, seq, fill, outline=None, width=0):
    d.polygon(pts(seq), fill=fill, outline=outline, width=int(width * S) if width else 0)


def rect(d, x0, y0, x1, y1, fill, outline=None, width=0):
    d.rectangle((sc(x0), sc(y0), sc(x1), sc(y1)), fill=fill, outline=outline, width=int(width * S) if width else 0)


def ell(d, cx, cy, rx, ry, fill, outline=None, width=0):
    d.ellipse((sc(cx - rx), sc(cy - ry), sc(cx + rx), sc(cy + ry)), fill=fill, outline=outline, width=int(width * S) if width else 0)


def line(d, seq, fill, width=1):
    d.line(pts(seq), fill=fill, width=max(1, int(width * S)))


def vgrad(w, h, top, bottom) -> Image.Image:
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    a = np.array(top, dtype=np.float32)[None, None, :]
    b = np.array(bottom, dtype=np.float32)[None, None, :]
    arr = (a + (b - a) * t).astype(np.uint8)
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def cloud(d, cx, cy, w, color=CLOUD, shade=(214, 228, 246)):
    """ふわふわの雲（楕円の集合・下側に影）"""
    h = w * 0.42
    parts = [(0, 0, 0.5, 0.5), (-0.32, 0.12, 0.34, 0.34), (0.3, 0.1, 0.36, 0.36), (-0.1, -0.12, 0.36, 0.36), (0.14, -0.08, 0.3, 0.3)]
    for ox, oy, rx, ry in parts:
        ell(d, cx + ox * w, cy + oy * h + 3, rx * w, ry * h, shade)
    for ox, oy, rx, ry in parts:
        ell(d, cx + ox * w, cy + oy * h, rx * w, ry * h, color)


def bricks(d, x0, y0, x1, y1, bw=14, bh=8, color=STONE_LINE):
    y = y0
    row = 0
    while y < y1:
        line(d, [(x0, y), (x1, y)], color, 0.7)
        off = (bw / 2) if row % 2 else 0
        x = x0 + off
        while x < x1:
            line(d, [(x, y), (x, min(y1, y + bh))], color, 0.7)
            x += bw
        y += bh
        row += 1


def cone_roof(d, cx, top_y, base_y, half_w):
    poly(d, [(cx, top_y), (cx - half_w, base_y), (cx, base_y)], ROOF_LIGHT)
    poly(d, [(cx, top_y), (cx + half_w, base_y), (cx, base_y)], ROOF_DARK)
    poly(d, [(cx, top_y), (cx - half_w * 0.35, base_y), (cx + half_w * 0.2, base_y)], ROOF)
    n = 7
    for i in range(1, n):
        t = i / n
        y = top_y + (base_y - top_y) * t
        hw = half_w * t
        line(d, [(cx - hw, y), (cx + hw, y)], ROOF_DARK, 0.6)
    ell(d, cx, top_y - 1, 1.8, 1.8, GOLD)


def flag(d, x, y, h=16):
    line(d, [(x, y), (x, y - h)], (90, 90, 96), 1.2)
    poly(d, [(x, y - h), (x + 10, y - h + 3.5), (x, y - h + 7)], (240, 60, 60))


def arch_window(d, cx, cy, hw, hh, glass=(70, 100, 170), frame=WOOD_DARK):
    rect(d, cx - hw - 1, cy - hh + hw, cx + hw + 1, cy + hh, frame)
    ell(d, cx, cy - hh + hw, hw + 1, hw + 1, frame)
    rect(d, cx - hw, cy - hh + hw, cx + hw, cy + hh, glass)
    ell(d, cx, cy - hh + hw, hw, hw, glass)
    line(d, [(cx, cy - hh), (cx, cy + hh)], frame, 0.8)
    line(d, [(cx - hw, cy), (cx + hw, cy)], frame, 0.8)


def tower(d, cx, top_y, base_y, w, roof_h, windows=2):
    hw = w / 2
    rect(d, cx - hw, top_y, cx + hw, base_y, STONE)
    rect(d, cx + hw * 0.45, top_y, cx + hw, base_y, STONE_SHADE)
    bricks(d, cx - hw, top_y, cx + hw, base_y)
    rect(d, cx - hw - 3, top_y - 3, cx + hw + 3, top_y + 1, STONE_SHADE)
    cone_roof(d, cx, top_y - roof_h, top_y - 2, hw + 5)
    flag(d, cx, top_y - roof_h - 1)
    for i in range(windows):
        wy = top_y + 18 + i * 28
        arch_window(d, cx, wy, 5, 12)


def stained_glass_peach(d, cx, cy, hw, hh):
    """ピーチ姫のステンドグラス（上が丸い窓）。青地に金の縁、ピンクのドレス。"""
    top = cy - hh
    rect(d, cx - hw - 2.5, top + hw, cx + hw + 2.5, cy + hh, GOLD_DARK)
    ell(d, cx, top + hw, hw + 2.5, hw + 2.5, GOLD_DARK)
    rect(d, cx - hw, top + hw, cx + hw, cy + hh, (38, 74, 168))
    ell(d, cx, top + hw, hw, hw, (38, 74, 168))
    for i in range(6):
        t = i / 6
        c = lerp((70, 120, 210), (40, 80, 180), t)
        y0 = top + hw + (2 * hh - hw) * t
        rect(d, cx - hw, y0, cx + hw, min(cy + hh, y0 + (2 * hh - hw) / 6 + 0.5), c)
    dress_top = cy - hh * 0.05
    poly(d, [(cx - hw * 0.28, dress_top), (cx + hw * 0.28, dress_top), (cx + hw * 0.8, cy + hh - 2), (cx - hw * 0.8, cy + hh - 2)], (244, 120, 176))
    poly(d, [(cx - hw * 0.12, dress_top), (cx + hw * 0.12, dress_top), (cx + hw * 0.36, cy + hh - 2), (cx - hw * 0.36, cy + hh - 2)], (252, 168, 206))
    ell(d, cx, cy + hh * 0.05, hw * 0.34, hw * 0.16, (236, 96, 150))
    ell(d, cx - hw * 0.42, cy + hh * 0.22, hw * 0.13, hw * 0.13, (255, 255, 255))
    ell(d, cx + hw * 0.42, cy + hh * 0.22, hw * 0.13, hw * 0.13, (255, 255, 255))
    face_y = cy - hh * 0.42
    ell(d, cx, face_y - hw * 0.05, hw * 0.34, hw * 0.4, (250, 214, 96))
    ell(d, cx, face_y, hw * 0.24, hw * 0.27, (255, 224, 196))
    ell(d, cx - hw * 0.1, face_y - hw * 0.02, hw * 0.035, hw * 0.05, (60, 90, 160))
    ell(d, cx + hw * 0.1, face_y - hw * 0.02, hw * 0.035, hw * 0.05, (60, 90, 160))
    poly(d, [(cx - hw * 0.28, face_y - hw * 0.1), (cx - hw * 0.05, face_y - hw * 0.3), (cx + hw * 0.3, face_y - hw * 0.12), (cx + hw * 0.24, face_y - hw * 0.34), (cx - hw * 0.3, face_y - hw * 0.3)], (250, 214, 96))
    poly(d, [(cx - hw * 0.16, face_y - hw * 0.34), (cx - hw * 0.1, face_y - hw * 0.5), (cx, face_y - hw * 0.4), (cx + hw * 0.1, face_y - hw * 0.5), (cx + hw * 0.16, face_y - hw * 0.34)], GOLD)
    ell(d, cx, face_y - hw * 0.4, hw * 0.035, hw * 0.035, (60, 160, 240))
    for i in range(1, 4):
        y = top + hw + (2 * hh - hw) * i / 4
        line(d, [(cx - hw, y), (cx + hw, y)], (30, 30, 40), 0.5)
    line(d, [(cx, top), (cx, cy + hh)], (30, 30, 40), 0.5)


def tree(d, x, y, r):
    rect(d, x - r * 0.14, y - r * 0.4, x + r * 0.14, y + 2, WOOD)
    for ox, oy, rr, c in [(0, -r * 0.9, r, GRASS_DARK), (-r * 0.5, -r * 0.6, r * 0.7, GRASS_DARK), (r * 0.5, -r * 0.6, r * 0.7, GRASS_DARK), (0, -r * 1.0, r * 0.82, GRASS), (-r * 0.4, -r * 0.7, r * 0.55, GRASS), (r * 0.42, -r * 0.7, r * 0.55, GRASS), (-r * 0.1, -r * 1.2, r * 0.45, GRASS_LIGHT)]:
        ell(d, x + ox, y + oy, rr, rr * 0.92, c)


def hills_band(d, y_base, amp, color, seed, height=60):
    rnd = random.Random(seed)
    xs = list(range(-40, GW + 41, 8))
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    fr = [rnd.uniform(0.006, 0.016) for _ in range(3)]
    seq = [(-40, GH)]
    for x in xs:
        y = y_base - height - sum(math.sin(x * fr[i] + ph[i]) * amp for i in range(3))
        seq.append((x, y))
    seq.append((GW + 40, GH))
    poly(d, seq, color)


# ======================================================================
# 1. 外観（タイトル画面）
# ======================================================================
def make_outside() -> None:
    img = vgrad(GW * S, GH * S, SKY_TOP, SKY_BOT)
    d = ImageDraw.Draw(img)
    for cx, cy, w in [(110, 70, 120), (340, 50, 90), (600, 90, 140), (850, 60, 110), (760, 170, 80), (200, 150, 70), (470, 30, 60)]:
        cloud(d, cx, cy, w)

    # 城の背後の高い丘（マリオ64の城は丘に囲まれた谷にある）
    hills_band(d, 330, 22, (108, 182, 98), 7, 110)
    hills_band(d, 345, 14, (120, 190, 110), 1, 60)
    hills_band(d, 355, 10, (104, 178, 88), 2, 36)
    rect(d, 0, 345, GW, GH, GRASS)

    # 右手の丘と滝
    poly(d, [(690, 400), (720, 300), (790, 268), (900, 258), (GW, 262), (GW, 420)], GRASS_DARK)
    poly(d, [(720, 400), (740, 312), (800, 285), (GW, 280), (GW, 420)], GRASS)
    poly(d, [(770, 398), (778, 312), (846, 302), (852, 398)], (150, 132, 112))
    for i in range(6):
        line(d, [(774 + i * 2, 318 + i * 13), (848, 316 + i * 13)], (126, 108, 92), 0.7)
    rect(d, 790, 305, 832, 400, (176, 212, 248))
    for i in range(9):
        x = 792 + i * 4.5
        line(d, [(x, 306), (x, 400)], (236, 246, 255) if i % 2 == 0 else (150, 194, 240), 1.4)
    for i in range(7):
        ell(d, 792 + i * 7, 401, 6, 3, (236, 246, 255))

    # ---- 城 -------------------------------------------------------------
    cx = 480
    base = 392
    # 中央の二段の塔（下段が太く、上段が細い）
    tower(d, cx, 196, 300, 96, 0, windows=0)  # 下段（屋根なし・胴体のみ）
    rect(d, cx - 52, 192, cx + 52, 198, STONE_SHADE)  # 下段上端のコーニス
    for i in range(-3, 4):  # 下段の胸壁（凸凹）
        rect(d, cx + i * 14 - 5, 184, cx + i * 14 + 5, 194, STONE)
    poly(d, [(cx - 54, 196), (cx + 54, 196), (cx + 40, 176), (cx - 40, 176)], ROOF)  # 下段の腰屋根
    tower(d, cx, 112, 180, 60, 60, windows=2)  # 上段
    # 後方の左右の塔
    tower(d, cx - 118, 176, 300, 44, 40, windows=1)
    tower(d, cx + 118, 176, 300, 44, 40, windows=1)
    # 本体（腰屋根 + 壁）
    poly(d, [(330, 246), (630, 246), (606, 212), (354, 212)], ROOF)
    for i in range(1, 6):
        y = 212 + i * 5.6
        line(d, [(354 - (i * 4.6), y), (606 + (i * 4.6), y)], ROOF_DARK, 0.6)
    rect(d, 322, 246, 638, base, STONE)
    rect(d, 322, 246, 638, 251, STONE_SHADE)
    bricks(d, 322, 251, 638, base)
    for wx in (366, 400, 560, 594):
        arch_window(d, wx, 300, 6, 16)
    # 正面の切妻とステンドグラス
    poly(d, [(cx, 150), (cx - 64, 246), (cx + 64, 246)], ROOF)
    poly(d, [(cx, 150), (cx + 64, 246), (cx + 52, 246), (cx, 166)], ROOF_DARK)
    poly(d, [(cx, 166), (cx - 52, 246), (cx + 52, 246)], STONE)
    rect(d, cx - 58, 246, cx + 58, base, STONE)
    bricks(d, cx - 58, 246, cx + 58, base)
    poly(d, [(cx, 166), (cx - 52, 246), (cx + 52, 246)], None, outline=STONE_LINE, width=0.6)
    stained_glass_peach(d, cx, 250, 21, 40)
    # 玄関（アーチの両開き扉）
    dx0, dx1, dtop = cx - 26, cx + 26, 318
    rect(d, dx0 - 4, dtop + 26, dx1 + 4, base, STONE_SHADE)
    ell(d, cx, dtop + 26, 30, 30, STONE_SHADE)
    rect(d, dx0, dtop + 26, dx1, base, WOOD)
    ell(d, cx, dtop + 26, 26, 26, WOOD)
    line(d, [(cx, dtop), (cx, base)], WOOD_DARK, 1.2)
    for yy in (350, 372):
        line(d, [(dx0, yy), (dx1, yy)], WOOD_DARK, 0.8)
    ell(d, cx - 5, 362, 1.6, 1.6, GOLD)
    ell(d, cx + 5, 362, 1.6, 1.6, GOLD)
    # 四隅の塔（前面2本）
    tower(d, 322, 212, base + 2, 60, 56, windows=2)
    tower(d, 638, 212, base + 2, 60, 56, windows=2)

    # ---- 堀・芝・橋 ----------------------------------------------------
    poly(d, [(0, 404), (200, 396), (330, 394), (630, 394), (760, 396), (GW, 404), (GW, 452), (700, 446), (480, 444), (260, 446), (0, 452)], WATER)
    for i in range(14):
        x = 20 + i * 68
        y = 410 + (i % 3) * 11
        line(d, [(x, y), (x + 34, y)], WATER_LIGHT, 1.1)
    poly(d, [(0, 452), (260, 446), (480, 444), (700, 446), (GW, 452), (GW, GH), (0, GH)], GRASS)
    for i in range(30):
        x = random.uniform(0, GW)
        y = random.uniform(456, GH)
        if 330 < x < 630:
            continue
        line(d, [(x, y), (x + 4, y - 5), (x + 8, y)], GRASS_LIGHT, 0.8)
    poly(d, [(380, GH), (580, GH), (516, 446), (444, 446)], (196, 190, 176))
    poly(d, [(444, 446), (516, 446), (508, 394), (452, 394)], (212, 208, 196))
    poly(d, [(436, 448), (450, 448), (458, 392), (448, 392)], (170, 166, 154))
    poly(d, [(510, 448), (524, 448), (512, 392), (502, 392)], (170, 166, 154))
    for i in range(6):
        y = 400 + i * 9
        t = (y - 394) / 52
        line(d, [(452 - 8 * t, y), (508 + 8 * t, y)], (186, 182, 170), 0.7)
    for i in range(8):
        y = 452 + i * 12
        t = i / 8
        line(d, [(444 - 64 * t, y), (516 + 64 * t, y)], (178, 172, 160), 0.7)
    for x, y, r in [(70, 393, 22), (160, 390, 18), (250, 393, 16), (880, 470, 20), (700, 388, 14), (130, 505, 26), (830, 510, 26)]:
        tree(d, x, y, r)
    save(finish(img), "outside.png")


# ======================================================================
# 2. 3D ホール用テクスチャ
# ======================================================================
def noise_img(w, h, amount=6, seed=1) -> Image.Image:
    rnd = np.random.default_rng(seed)
    n = rnd.integers(-amount, amount + 1, size=(h, w, 1))
    return n


def apply_noise(img: Image.Image, amount=6, seed=1) -> Image.Image:
    arr = np.array(img.convert("RGBA")).astype(np.int16)
    arr[..., :3] = np.clip(arr[..., :3] + noise_img(img.width, img.height, amount, seed), 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def make_floor_tile() -> None:
    """白黒チェック（2×2で1枚。繰り返して敷く）"""
    n = 512
    img = Image.new("RGBA", (n, n), TILE_W + (255,))
    d = ImageDraw.Draw(img)
    h = n // 2
    d.rectangle((h, 0, n, h), fill=TILE_B + (255,))
    d.rectangle((0, h, h, n), fill=TILE_B + (255,))
    # 目地
    g = (150, 146, 140, 255)
    for v in (0, h, n - 1):
        d.line((v, 0, v, n), fill=g, width=4)
        d.line((0, v, n, v), fill=g, width=4)
    # ほんのり大理石の筋
    for i in range(10):
        x0, y0 = random.uniform(0, n), random.uniform(0, n)
        x1, y1 = x0 + random.uniform(-50, 50), y0 + random.uniform(-50, 50)
        d.line((x0, y0, x1, y1), fill=(255, 255, 255, 18), width=2)
    save(apply_noise(img, 3, 2), "tex_floor.png")


def make_sun_rug() -> None:
    """太陽のモザイク絨毯: 橙と紫の光線（マリオ64の1階ホール中央）"""
    n = 1024
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = n / 2
    R = n * 0.48
    d.ellipse((c - R, c - R, c + R, c + R), fill=(120, 52, 36, 255))  # 外縁（濃い赤茶）
    R2 = R * 0.94
    d.ellipse((c - R2, c - R2, c + R2, c + R2), fill=(238, 214, 150, 255))  # 生成り
    # 光線 16本: 橙と紫を交互に。外側ほど細くなる三角
    rays = 16
    for i in range(rays):
        a0 = i * 2 * math.pi / rays
        col = (236, 132, 40, 255) if i % 2 == 0 else (118, 72, 160, 255)
        w = 2 * math.pi / rays * 0.5
        r_in = R * 0.30
        r_out = R * 0.88 if i % 2 == 0 else R * 0.78
        p = [(c + math.cos(a0 - w) * r_in, c + math.sin(a0 - w) * r_in),
             (c + math.cos(a0) * r_out, c + math.sin(a0) * r_out),
             (c + math.cos(a0 + w) * r_in, c + math.sin(a0 + w) * r_in)]
        d.polygon(p, fill=col)
    # 内側のリングと太陽の顔（円）
    R3 = R * 0.34
    d.ellipse((c - R3, c - R3, c + R3, c + R3), fill=(190, 96, 32, 255))
    R4 = R * 0.29
    d.ellipse((c - R4, c - R4, c + R4, c + R4), fill=(250, 200, 70, 255))
    R5 = R * 0.22
    d.ellipse((c - R5, c - R5, c + R5, c + R5), fill=(255, 226, 120, 255))
    # 目と口（にっこりした太陽）
    ey = c - R5 * 0.15
    for ex in (c - R5 * 0.38, c + R5 * 0.38):
        d.ellipse((ex - 14, ey - 18, ex + 14, ey + 18), fill=(120, 60, 30, 255))
    d.arc((c - R5 * 0.5, c - R5 * 0.2, c + R5 * 0.5, c + R5 * 0.6), 20, 160, fill=(120, 60, 30, 255), width=14)
    # モザイクの目地（格子）
    tile = 28
    grid = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for v in range(0, n, tile):
        gd.line((v, 0, v, n), fill=(60, 30, 20, 40), width=2)
        gd.line((0, v, n, v), fill=(60, 30, 20, 40), width=2)
    mask = img.getchannel("A")
    grid.putalpha(Image.fromarray(np.minimum(np.array(grid.getchannel("A")), np.array(mask))))
    img.alpha_composite(grid)
    save(apply_noise(img, 5, 3), "tex_sun.png")


def make_wall_lower() -> None:
    """石の腰壁（横に繰り返せる）"""
    w, h = 512, 256
    img = Image.new("RGBA", (w, h), WALL_CREAM + (255,))
    d = ImageDraw.Draw(img)
    bw, bh = 128, 64
    for row in range(h // bh):
        off = (bw // 2) if row % 2 else 0
        y0 = row * bh
        for col in range(-1, w // bw + 1):
            x0 = col * bw + off
            shade = random.choice([(236, 224, 194), (240, 230, 204), (230, 216, 184), (244, 234, 210)])
            d.rectangle((x0 + 3, y0 + 3, x0 + bw - 3, y0 + bh - 3), fill=shade + (255,))
            d.line((x0 + 3, y0 + 3, x0 + bw - 3, y0 + 3), fill=(250, 244, 226, 255), width=2)  # 上辺ハイライト
            d.line((x0 + 3, y0 + bh - 3, x0 + bw - 3, y0 + bh - 3), fill=(200, 184, 150, 255), width=3)  # 下辺の影
    # 目地
    for row in range(h // bh + 1):
        d.line((0, row * bh, w, row * bh), fill=WALL_CREAM_DARK + (255,), width=4)
    save(apply_noise(img, 5, 4), "tex_wall_lower.png")


def make_wall_upper() -> None:
    """壁画: 青空・白い雲・緑の丘（マリオ64のホール上部の壁）。横に繰り返せる"""
    w, h = 2048, 768
    img = vgrad(w, h, (96, 160, 236), (186, 222, 250))
    d = ImageDraw.Draw(img)
    # 雲（周期的に配置してタイリングを自然に）
    rnd = random.Random(11)
    for _ in range(26):
        cx = rnd.uniform(0, w)
        cy = rnd.uniform(60, h * 0.62)
        cw = rnd.uniform(140, 300)
        for dx in (-w, 0, w):
            cloud_px(d, cx + dx, cy, cw)
    # 遠い丘（薄い緑）と近い丘（濃い緑）。端が繋がるように sin の周期を w に合わせる
    for base, amp, color, k in [(h * 0.80, 70, (132, 200, 118), 3), (h * 0.88, 55, (98, 176, 84), 5), (h * 0.96, 40, (76, 150, 64), 7)]:
        seq = [(0, h)]
        for x in range(0, w + 1, 8):
            y = base - amp * (0.6 + 0.4 * math.sin(2 * math.pi * k * x / w + k)) - amp * 0.3 * math.sin(2 * math.pi * (k + 2) * x / w)
            seq.append((x, y))
        seq.append((w, h))
        d.polygon(seq, fill=color + (255,))
    # 丘の上に小さな木
    for i in range(18):
        x = (i * 113 + 40) % w
        y = h * 0.86 + 20 * math.sin(i)
        d.ellipse((x - 14, y - 26, x + 14, y - 2), fill=(56, 120, 48, 255))
        d.rectangle((x - 3, y - 6, x + 3, y + 6), fill=(104, 68, 40, 255))
    save(apply_noise(img, 3, 5), "tex_wall_upper.png")


def cloud_px(d, cx, cy, w):
    h = w * 0.42
    parts = [(0, 0, 0.5, 0.5), (-0.32, 0.12, 0.34, 0.34), (0.3, 0.1, 0.36, 0.36), (-0.1, -0.12, 0.36, 0.36), (0.14, -0.08, 0.3, 0.3)]
    for ox, oy, rx, ry in parts:
        d.ellipse((cx + ox * w - rx * w, cy + oy * h + 6 - ry * h, cx + ox * w + rx * w, cy + oy * h + 6 + ry * h), fill=(206, 226, 246, 255))
    for ox, oy, rx, ry in parts:
        d.ellipse((cx + ox * w - rx * w, cy + oy * h - ry * h, cx + ox * w + rx * w, cy + oy * h + ry * h), fill=(255, 255, 255, 255))


def make_ceiling() -> None:
    """天井: 生成り地に木の梁の格子"""
    n = 512
    img = Image.new("RGBA", (n, n), (246, 236, 214, 255))
    d = ImageDraw.Draw(img)
    for v in (0, n // 2):
        d.rectangle((v - 14, 0, v + 14, n), fill=WOOD + (255,))
        d.rectangle((0, v - 14, n, v + 14), fill=WOOD + (255,))
        d.line((v - 14, 0, v - 14, n), fill=WOOD_LIGHT + (255,), width=3)
        d.line((0, v - 14, n, v - 14), fill=WOOD_LIGHT + (255,), width=3)
    save(apply_noise(img, 4, 6), "tex_ceiling.png")


def door_texture(name: str, w: int, h: int, star: bool, big: bool = False) -> None:
    """アーチ型の木の両開き扉（透過PNG）。star=True で金の星の紋章"""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = w // 2
    # 石の枠
    d.rectangle((0, r, w, h), fill=STONE_SHADE + (255,))
    d.ellipse((0, 0, w, 2 * r), fill=STONE_SHADE + (255,))
    m = int(w * 0.07)
    d.rectangle((m, r, w - m, h), fill=WOOD + (255,))
    d.ellipse((m, m, w - m, 2 * r - m), fill=WOOD + (255,))
    # 板の筋
    for i in range(1, 6):
        x = m + (w - 2 * m) * i / 6
        d.line((x, r, x, h), fill=WOOD_DARK + (255,), width=3)
    d.line((w / 2, m, w / 2, h), fill=WOOD_DARK + (255,), width=6)
    # 横の帯金
    for y in (h * 0.55, h * 0.80):
        d.rectangle((m, y - 8, w - m, y + 8), fill=WOOD_DARK + (255,))
        for x in range(m + 16, w - m, 28):
            d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=GOLD_DARK + (255,))
    # 取っ手
    for x in (w / 2 - 18, w / 2 + 18):
        d.ellipse((x - 7, h * 0.62 - 7, x + 7, h * 0.62 + 7), fill=GOLD + (255,))
    if star:
        cx, cy = w / 2, r + (0.12 if big else 0.06) * h
        R = w * (0.26 if big else 0.2)
        seq = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            rr = R if i % 2 == 0 else R * 0.45
            seq.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        d.polygon(seq, fill=GOLD_LIGHT + (255,), outline=GOLD_DARK + (255,), width=4)
        inner = [(cx + (x - cx) * 0.55, cy + (y - cy) * 0.55) for x, y in seq]
        d.polygon(inner, fill=(255, 240, 170, 255))
    save(apply_noise(img, 4, 7), name)


def make_doors() -> None:
    door_texture("tex_door.png", 256, 512, star=False)
    door_texture("tex_door_star.png", 256, 512, star=True)
    door_texture("tex_door_big.png", 384, 640, star=True, big=True)


def make_window() -> None:
    """アーチ窓（透過PNG）: 青いガラスと格子"""
    w, h = 256, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = w // 2
    d.rectangle((0, r, w, h), fill=WOOD_DARK + (255,))
    d.ellipse((0, 0, w, 2 * r), fill=WOOD_DARK + (255,))
    m = 14
    d.rectangle((m, r, w - m, h - m), fill=(150, 200, 250, 255))
    d.ellipse((m, m, w - m, 2 * r - m), fill=(150, 200, 250, 255))
    # 空の映り込み（上ほど濃い青）
    for i in range(6):
        y0 = m + (h - 2 * m) * i / 6
        c = lerp((110, 170, 240), (190, 224, 252), i / 5)
        y1 = y0 + (h - 2 * m) / 6
        if y1 > r:
            d.rectangle((m, max(y0, r), w - m, y1), fill=c + (255,))
    d.pieslice((m, m, w - m, 2 * r - m), 180, 360, fill=(110, 170, 240, 255))
    d.line((w / 2, m, w / 2, h - m), fill=WOOD_DARK + (255,), width=8)
    for y in (r, h * 0.55, h * 0.75):
        d.line((m, y, w - m, y), fill=WOOD_DARK + (255,), width=8)
    save(img, "tex_window.png")


def make_carpet() -> None:
    """赤い絨毯（金の縁取りは3D側で別メッシュ）。細かな織り模様"""
    n = 256
    img = Image.new("RGBA", (n, n), CARPET + (255,))
    d = ImageDraw.Draw(img)
    for y in range(0, n, 16):
        for x in range(0, n, 16):
            if (x // 16 + y // 16) % 2 == 0:
                d.rectangle((x + 6, y + 6, x + 10, y + 10), fill=CARPET_DARK + (255,))
    save(apply_noise(img, 6, 8), "tex_carpet.png")


def make_glass() -> None:
    img = canvas()
    d = ImageDraw.Draw(img)
    stained_glass_peach(d, 480, 270, 120, 240)
    img = img.crop(img.getbbox())
    img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
    save(img, "glass_peach.png")


if __name__ == "__main__":
    make_outside()
    make_floor_tile()
    make_sun_rug()
    make_wall_lower()
    make_wall_upper()
    make_ceiling()
    make_doors()
    make_window()
    make_carpet()
    make_glass()
