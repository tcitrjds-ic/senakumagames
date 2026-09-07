#!/usr/bin/env python3
"""せなくま美術館（ピーチ城）の背景・パーツ素材を生成する。

スーパーマリオ64のピーチ城を参考に、外観（城・堀・橋・滝）、
城内ホール（白黒チェック床・太陽のモザイク・赤い絨毯の大階段・雲の壁）、
絵画の部屋、金の額縁（9スライス）、扉、星の扉などを Pillow で描く。

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
SKY_TOP = (86, 150, 236)
SKY_BOT = (176, 216, 250)
GRASS = (96, 172, 72)
GRASS_DARK = (74, 146, 58)
GRASS_LIGHT = (122, 196, 92)
STONE = (232, 226, 210)
STONE_SHADE = (206, 198, 180)
STONE_LINE = (196, 186, 166)
ROOF = (214, 62, 52)
ROOF_DARK = (166, 42, 38)
ROOF_LIGHT = (236, 96, 82)
WOOD = (118, 72, 42)
WOOD_DARK = (84, 50, 30)
WATER = (58, 122, 214)
WATER_LIGHT = (128, 182, 240)
CLOUD = (255, 255, 255)
WALL_BLUE = (150, 196, 240)
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
    """縦グラデーション（numpy）"""
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    a = np.array(top, dtype=np.float32)[None, None, :]
    b = np.array(bottom, dtype=np.float32)[None, None, :]
    arr = (a + (b - a) * t).astype(np.uint8)
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def cloud(d, cx, cy, w, color=CLOUD, shade=(214, 228, 246)):
    """ふわふわの雲（楕円の集合）"""
    h = w * 0.42
    parts = [(0, 0, 0.5, 0.5), (-0.32, 0.12, 0.34, 0.34), (0.3, 0.1, 0.36, 0.36), (-0.1, -0.12, 0.36, 0.36), (0.14, -0.08, 0.3, 0.3)]
    for ox, oy, rx, ry in parts:
        ell(d, cx + ox * w, cy + oy * h + 3, rx * w, ry * h, shade)
    for ox, oy, rx, ry in parts:
        ell(d, cx + ox * w, cy + oy * h, rx * w, ry * h, color)


def bricks(d, x0, y0, x1, y1, bw=14, bh=8, color=STONE_LINE):
    """石壁の目地（横線＋互い違いの縦線）"""
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
    """円錐屋根（左右で明暗）"""
    poly(d, [(cx, top_y), (cx - half_w, base_y), (cx, base_y)], ROOF_LIGHT)
    poly(d, [(cx, top_y), (cx + half_w, base_y), (cx, base_y)], ROOF_DARK)
    poly(d, [(cx, top_y), (cx - half_w * 0.35, base_y), (cx + half_w * 0.2, base_y)], ROOF)
    # 屋根瓦の段
    n = 6
    for i in range(1, n):
        t = i / n
        y = top_y + (base_y - top_y) * t
        hw = half_w * t
        line(d, [(cx - hw, y), (cx + hw, y)], ROOF_DARK, 0.6)
    # 先端の飾り
    ell(d, cx, top_y - 1, 1.8, 1.8, GOLD)


def flag(d, x, y, h=16):
    line(d, [(x, y), (x, y - h)], (90, 90, 96), 1.2)
    poly(d, [(x, y - h), (x + 10, y - h + 3.5), (x, y - h + 7)], (240, 60, 60))


def tower(d, cx, top_y, base_y, w, roof_h, windows=2):
    """円塔（胴体＋円錐屋根＋窓）"""
    hw = w / 2
    rect(d, cx - hw, top_y, cx + hw, base_y, STONE)
    rect(d, cx + hw * 0.45, top_y, cx + hw, base_y, STONE_SHADE)
    bricks(d, cx - hw, top_y, cx + hw, base_y)
    # 屋根の張り出し（コーニス）
    rect(d, cx - hw - 3, top_y - 3, cx + hw + 3, top_y + 1, STONE_SHADE)
    cone_roof(d, cx, top_y - roof_h, top_y - 2, hw + 5)
    flag(d, cx, top_y - roof_h - 1)
    for i in range(windows):
        wy = top_y + 18 + i * 28
        arch_window(d, cx, wy, 5, 12)


def arch_window(d, cx, cy, hw, hh, glass=(70, 100, 170), frame=WOOD_DARK):
    """上が丸い縦長窓"""
    rect(d, cx - hw - 1, cy - hh + hw, cx + hw + 1, cy + hh, frame)
    ell(d, cx, cy - hh + hw, hw + 1, hw + 1, frame)
    rect(d, cx - hw, cy - hh + hw, cx + hw, cy + hh, glass)
    ell(d, cx, cy - hh + hw, hw, hw, glass)
    line(d, [(cx, cy - hh), (cx, cy + hh)], frame, 0.8)
    line(d, [(cx - hw, cy), (cx + hw, cy)], frame, 0.8)


def stained_glass_peach(d, cx, cy, hw, hh):
    """ピーチ姫のステンドグラス（上が丸い窓）。青地に金の縁、ピンクのドレス。"""
    top = cy - hh
    # 枠
    rect(d, cx - hw - 2.5, top + hw, cx + hw + 2.5, cy + hh, GOLD_DARK)
    ell(d, cx, top + hw, hw + 2.5, hw + 2.5, GOLD_DARK)
    rect(d, cx - hw, top + hw, cx + hw, cy + hh, (38, 74, 168))
    ell(d, cx, top + hw, hw, hw, (38, 74, 168))
    # 背景の光のパネル（放射状）
    for i in range(6):
        t = i / 6
        c = lerp((70, 120, 210), (40, 80, 180), t)
        y0 = top + hw + (2 * hh - hw) * t
        rect(d, cx - hw, y0, cx + hw, min(cy + hh, y0 + (2 * hh - hw) / 6 + 0.5), c)
    # ピーチ：ドレス（台形＋裾）、胴、顔、髪、王冠
    dress_top = cy - hh * 0.05
    poly(d, [(cx - hw * 0.28, dress_top), (cx + hw * 0.28, dress_top), (cx + hw * 0.8, cy + hh - 2), (cx - hw * 0.8, cy + hh - 2)], (244, 120, 176))
    poly(d, [(cx - hw * 0.12, dress_top), (cx + hw * 0.12, dress_top), (cx + hw * 0.36, cy + hh - 2), (cx - hw * 0.36, cy + hh - 2)], (252, 168, 206))
    ell(d, cx, cy + hh * 0.05, hw * 0.34, hw * 0.16, (236, 96, 150))  # 腰のリボン
    # 手（白手袋）
    ell(d, cx - hw * 0.42, cy + hh * 0.22, hw * 0.13, hw * 0.13, (255, 255, 255))
    ell(d, cx + hw * 0.42, cy + hh * 0.22, hw * 0.13, hw * 0.13, (255, 255, 255))
    # 顔と髪
    face_y = cy - hh * 0.42
    ell(d, cx, face_y - hw * 0.05, hw * 0.34, hw * 0.4, (250, 214, 96))  # 髪の外形
    ell(d, cx, face_y, hw * 0.24, hw * 0.27, (255, 224, 196))  # 顔
    ell(d, cx - hw * 0.1, face_y - hw * 0.02, hw * 0.035, hw * 0.05, (60, 90, 160))
    ell(d, cx + hw * 0.1, face_y - hw * 0.02, hw * 0.035, hw * 0.05, (60, 90, 160))
    # 前髪
    poly(d, [(cx - hw * 0.28, face_y - hw * 0.1), (cx - hw * 0.05, face_y - hw * 0.3), (cx + hw * 0.3, face_y - hw * 0.12), (cx + hw * 0.24, face_y - hw * 0.34), (cx - hw * 0.3, face_y - hw * 0.3)], (250, 214, 96))
    # 王冠
    poly(d, [(cx - hw * 0.16, face_y - hw * 0.34), (cx - hw * 0.1, face_y - hw * 0.5), (cx, face_y - hw * 0.4), (cx + hw * 0.1, face_y - hw * 0.5), (cx + hw * 0.16, face_y - hw * 0.34)], GOLD)
    ell(d, cx, face_y - hw * 0.4, hw * 0.035, hw * 0.035, (60, 160, 240))
    # 鉛線（ステンドグラスの格子）
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
# 1. 外観
# ======================================================================
def make_outside() -> None:
    img = vgrad(GW * S, GH * S, SKY_TOP, SKY_BOT)
    d = ImageDraw.Draw(img)

    # 雲
    for cx, cy, w in [(110, 70, 120), (340, 50, 90), (600, 90, 140), (850, 60, 110), (760, 170, 80), (200, 150, 70), (470, 30, 60)]:
        cloud(d, cx, cy, w)

    # 遠景の丘 → 近景の丘（城は丘の上の平地に建つ）
    hills_band(d, 345, 14, (120, 190, 110), 1, 60)
    hills_band(d, 355, 10, (104, 178, 88), 2, 36)
    rect(d, 0, 345, GW, GH, GRASS)

    # 右手の丘と滝
    poly(d, [(690, 400), (720, 300), (790, 268), (900, 258), (GW, 262), (GW, 420)], GRASS_DARK)
    poly(d, [(720, 400), (740, 312), (800, 285), (GW, 280), (GW, 420)], GRASS)
    # 崖面（岩）
    poly(d, [(770, 398), (778, 312), (846, 302), (852, 398)], (150, 132, 112))
    for i in range(6):
        line(d, [(774 + i * 2, 318 + i * 13), (848, 316 + i * 13)], (126, 108, 92), 0.7)
    # 滝
    rect(d, 790, 305, 832, 400, (176, 212, 248))
    for i in range(9):
        x = 792 + i * 4.5
        line(d, [(x, 306), (x, 400)], (236, 246, 255) if i % 2 == 0 else (150, 194, 240), 1.4)
    # 滝の水しぶき
    for i in range(7):
        ell(d, 792 + i * 7, 401, 6, 3, (236, 246, 255))

    # ---- 城 -------------------------------------------------------------
    cx = 480
    base = 392
    # 後方の塔（中央の大塔＋左右の塔）
    tower(d, cx, 128, 300, 66, 62, windows=3)
    tower(d, cx - 108, 178, 300, 44, 40, windows=1)
    tower(d, cx + 108, 178, 300, 44, 40, windows=1)
    # 本体（腰屋根 + 壁）
    poly(d, [(340, 246), (620, 246), (598, 214), (362, 214)], ROOF)
    poly(d, [(340, 246), (362, 214), (355, 214), (332, 246)], ROOF_DARK)
    for i in range(1, 5):
        y = 214 + i * 6.4
        line(d, [(362 - (i * 4.4), y), (598 + (i * 4.4), y)], ROOF_DARK, 0.6)
    rect(d, 332, 246, 628, base, STONE)
    rect(d, 332, 246, 628, 251, STONE_SHADE)  # コーニス
    bricks(d, 332, 251, 628, base)
    # 本体の窓
    for wx in (372, 404, 556, 588):
        arch_window(d, wx, 300, 6, 16)
    # 正面の切妻（ステンドグラスの壁）
    poly(d, [(cx, 152), (cx - 62, 246), (cx + 62, 246)], ROOF)
    poly(d, [(cx, 152), (cx + 62, 246), (cx + 50, 246), (cx, 168)], ROOF_DARK)
    poly(d, [(cx, 166), (cx - 50, 246), (cx + 50, 246)], STONE)
    rect(d, cx - 56, 246, cx + 56, base, STONE)
    bricks(d, cx - 56, 246, cx + 56, base)
    poly(d, [(cx, 166), (cx - 50, 246), (cx + 50, 246)], None, outline=STONE_LINE, width=0.6)
    stained_glass_peach(d, cx, 250, 20, 38)
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
    # 前面の隅塔
    tower(d, 332, 214, base + 2, 60, 56, windows=2)
    tower(d, 628, 214, base + 2, 60, 56, windows=2)

    # ---- 堀・芝・橋 ----------------------------------------------------
    # 堀（城の手前をぐるりと。曲線で奥行き）
    poly(d, [(0, 404), (200, 396), (330, 394), (630, 394), (760, 396), (GW, 404), (GW, 452), (700, 446), (480, 444), (260, 446), (0, 452)], WATER)
    for i in range(14):
        x = 20 + i * 68
        y = 410 + (i % 3) * 11
        line(d, [(x, y), (x + 34, y)], WATER_LIGHT, 1.1)
    # 手前の芝
    poly(d, [(0, 452), (260, 446), (480, 444), (700, 446), (GW, 452), (GW, GH), (0, GH)], GRASS)
    for i in range(30):
        x = random.uniform(0, GW)
        y = random.uniform(456, GH)
        if 330 < x < 630:
            continue
        line(d, [(x, y), (x + 4, y - 5), (x + 8, y)], GRASS_LIGHT, 0.8)
    # 参道（石畳）と橋
    poly(d, [(380, GH), (580, GH), (516, 446), (444, 446)], (196, 186, 166))
    poly(d, [(444, 446), (516, 446), (508, 394), (452, 394)], (212, 204, 186))  # 橋面
    poly(d, [(436, 448), (450, 448), (458, 392), (448, 392)], (170, 160, 142))  # 左欄干
    poly(d, [(510, 448), (524, 448), (512, 392), (502, 392)], (170, 160, 142))  # 右欄干
    for i in range(6):
        y = 400 + i * 9
        t = (y - 394) / 52
        line(d, [(452 - 8 * t, y), (508 + 8 * t, y)], (186, 176, 158), 0.7)
    for i in range(8):
        y = 452 + i * 12
        t = i / 8
        line(d, [(444 - 64 * t, y), (516 + 64 * t, y)], (178, 168, 150), 0.7)

    # 木々
    for x, y, r in [(70, 393, 22), (160, 390, 18), (250, 393, 16), (880, 470, 20), (700, 388, 14), (130, 505, 26), (830, 510, 26)]:
        tree(d, x, y, r)

    save(finish(img), "outside.png")


# ======================================================================
# 2. 城内ホール（1点透視）
# ======================================================================
VX, VY = 480, 235  # 消失点


def checker_floor(img: Image.Image, y_top: float, cam_h: float = 150.0, tile: float = 46.0, focal: float = 300.0, sun=None) -> None:
    """白黒チェック床を透視投影でピクセル描画（numpy）。sun=(wx,wz,r)で太陽モザイクを重ねる。"""
    W, H = img.size
    ys = np.arange(int(y_top * FINAL), H, dtype=np.float32)
    xs = np.arange(0, W, dtype=np.float32)
    Y, X = np.meshgrid(ys, xs, indexing="ij")
    vx, vy = VX * FINAL, VY * FINAL
    f = focal * FINAL
    dy = np.maximum(Y - vy, 0.5)
    z = f * (cam_h * FINAL) / dy  # 奥行き
    wx = (X - vx) * z / f  # 横位置
    ix = np.floor(wx / (tile * FINAL)).astype(np.int64)
    iz = np.floor(z / (tile * FINAL)).astype(np.int64)
    parity = (ix + iz) & 1
    col = np.where(parity[..., None] == 0, np.array(TILE_W, np.float32), np.array(TILE_B, np.float32))
    # 目地
    fx = np.abs((wx / (tile * FINAL)) % 1 - 0.5)
    fz = np.abs((z / (tile * FINAL)) % 1 - 0.5)
    grout = (fx > 0.47) | (fz > 0.47)
    col = np.where(grout[..., None], np.array((150, 146, 140), np.float32), col)
    # 奥ほど暗く（空気遠近）
    shade = np.clip(1.0 - (z / (tile * FINAL)) * 0.012, 0.55, 1.0)[..., None]
    col = col * shade
    if sun is not None:
        swx, swz, r = sun
        dist = np.sqrt((wx - swx * FINAL) ** 2 + (z - swz * FINAL) ** 2) / (r * FINAL)
        ang = np.arctan2(z - swz * FINAL, wx - swx * FINAL)
        ray = 0.72 + 0.16 * np.cos(ang * 12)
        outer = dist < 1.0
        ring = (dist > 0.92) & (dist < 1.0)
        sunray = (dist < ray) & (dist >= 0.44)
        disc = dist < 0.44
        face_ring = (dist > 0.4) & (dist < 0.44)
        col = np.where(outer[..., None], np.array((246, 226, 150), np.float32) * shade, col)
        col = np.where(sunray[..., None], np.array((242, 150, 48), np.float32) * shade, col)
        col = np.where(disc[..., None], np.array((252, 204, 72), np.float32) * shade, col)
        col = np.where(face_ring[..., None], np.array((214, 110, 36), np.float32) * shade, col)
        col = np.where(ring[..., None], np.array((160, 68, 40), np.float32) * shade, col)
    arr = np.array(img)
    arr[int(y_top * FINAL):, :, :3] = np.clip(col, 0, 255).astype(np.uint8)
    arr[int(y_top * FINAL):, :, 3] = 255
    img.paste(Image.fromarray(arr, "RGBA"))


def cloud_wall(d, x0, y0, x1, y1, seed=3):
    rect(d, x0, y0, x1, y1, WALL_BLUE)
    rnd = random.Random(seed)
    for _ in range(int((x1 - x0) * (y1 - y0) / 6000) + 2):
        cx = rnd.uniform(x0, x1)
        cy = rnd.uniform(y0 + 10, y1 - 6)
        cloud(d, cx, cy, rnd.uniform(40, 70), (236, 244, 252), (206, 226, 246))


def cloud_wall_poly(d, quad, seed=3):
    """任意四角形の雲の壁（マスクで切り抜く）"""
    x0 = min(p[0] for p in quad)
    x1 = max(p[0] for p in quad)
    y0 = min(p[1] for p in quad)
    y1 = max(p[1] for p in quad)
    layer = canvas()
    ld = ImageDraw.Draw(layer)
    cloud_wall(ld, x0, y0, x1, y1, seed)
    mask = Image.new("L", layer.size, 0)
    ImageDraw.Draw(mask).polygon(pts(quad), fill=255)
    d._image.paste(layer, (0, 0), mask)


def door(d, cx, bottom, w, h, star: int | None = None, big=False):
    """木の扉（上部アーチ）。star を指定すると星の扉。"""
    hw = w / 2
    top = bottom - h
    # 枠
    rect(d, cx - hw - 3, top + hw, cx + hw + 3, bottom, WALL_CREAM_DARK)
    ell(d, cx, top + hw, hw + 3, hw + 3, WALL_CREAM_DARK)
    rect(d, cx - hw, top + hw, cx + hw, bottom, WOOD)
    ell(d, cx, top + hw, hw, hw, WOOD)
    line(d, [(cx, top), (cx, bottom)], WOOD_DARK, 1)
    for i in range(1, 3):
        y = top + hw + (h - hw) * i / 3
        line(d, [(cx - hw, y), (cx + hw, y)], WOOD_DARK, 0.7)
    ell(d, cx - 3, bottom - h * 0.45, 1.3, 1.3, GOLD)
    ell(d, cx + 3, bottom - h * 0.45, 1.3, 1.3, GOLD)
    if star is not None:
        r = hw * (0.7 if big else 0.55)
        sy = top + hw + 2
        star_shape(d, cx, sy + r * 0.1, r, GOLD_LIGHT, GOLD_DARK)


def star_shape(d, cx, cy, r, fill, outline=None):
    seq = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        seq.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    poly(d, seq, fill, outline=outline, width=0.8 if outline else 0)


def sconce(d, x, y, k=1.0):
    """壁付きの金の燭台（ろうそくの灯り付き）"""
    rect(d, x - 1.5 * k, y, x + 1.5 * k, y + 26 * k, GOLD_DARK)
    poly(d, [(x - 8 * k, y + 4 * k), (x + 8 * k, y + 4 * k), (x, y + 14 * k)], GOLD)
    ell(d, x, y - 4 * k, 3.2 * k, 5 * k, (255, 214, 96))
    ell(d, x, y - 6 * k, 1.6 * k, 2.6 * k, (255, 250, 220))


def pillar(d, x, top, bottom, w=12):
    rect(d, x - w / 2, top, x + w / 2, bottom, (250, 246, 236))
    rect(d, x + w / 2 - 3, top, x + w / 2, bottom, (214, 206, 190))
    rect(d, x - w / 2 - 3, top - 3, x + w / 2 + 3, top + 5, (240, 234, 220))
    rect(d, x - w / 2 - 3, bottom - 6, x + w / 2 + 3, bottom, (240, 234, 220))


def make_foyer() -> None:
    img = canvas()
    d = ImageDraw.Draw(img)
    # 天井（消失点に向かう台形）
    poly(d, [(0, 0), (GW, 0), (700, 96), (260, 96)], (250, 240, 222))
    for i in range(1, 8):
        t = i / 8
        line(d, [(0 + 260 * t, 96 * t), (GW - 260 * t, 96 * t)], (230, 218, 196), 0.8)
    # 側壁（雲の壁）
    cloud_wall_poly(d, [(0, 0), (260, 96), (260, 300), (0, 372)], seed=11)
    cloud_wall_poly(d, [(GW, 0), (700, 96), (700, 300), (GW, 372)], seed=12)
    # 側壁の腰壁（クリーム）
    poly(d, [(0, 372), (260, 300), (260, 330), (0, 420)], WALL_CREAM)
    poly(d, [(GW, 372), (700, 300), (700, 330), (GW, 420)], WALL_CREAM)
    line(d, [(0, 372), (260, 300)], WALL_CREAM_DARK, 1.6)
    line(d, [(GW, 372), (700, 300)], WALL_CREAM_DARK, 1.6)
    # 側壁の燭台（透視に合わせて奥ほど小さく）
    for x, y, k in [(70, 200, 1.0), (150, 205, 0.85), (215, 208, 0.7), (GW - 70, 200, 1.0), (GW - 150, 205, 0.85), (GW - 215, 208, 0.7)]:
        sconce(d, x, y, k)

    # 奥の壁
    cloud_wall(d, 260, 96, 700, 300, seed=13)
    rect(d, 260, 232, 700, 330, WALL_CREAM)  # 1階の腰壁
    line(d, [(260, 232), (700, 232)], WALL_CREAM_DARK, 1.6)
    bricks(d, 260, 234, 700, 330, bw=22, bh=11, color=(226, 212, 182))
    # 中2階バルコニー（手すり）
    rect(d, 260, 210, 700, 216, (250, 246, 236))
    rect(d, 260, 216, 700, 232, (240, 232, 214))
    for x in range(268, 700, 12):
        rect(d, x - 2, 216, x + 2, 232, (224, 214, 192))
    # 柱
    for x in (262, 700):
        pillar(d, x, 96, 330, 10)
    for x in (340, 620):
        pillar(d, x, 96, 232, 8)

    # ---- 大階段（赤い絨毯）: 床から中2階の踊り場へ ----
    steps = 9
    y_bot, y_top = 372, 254
    w_bot, w_top = 150, 96
    for i in range(steps):
        t0 = i / steps
        t1 = (i + 1) / steps
        ya = y_bot - (y_bot - y_top) * t0
        yb = y_bot - (y_bot - y_top) * t1
        wa = w_bot - (w_bot - w_top) * t0
        wb = w_bot - (w_bot - w_top) * t1
        # 蹴込み（暗い）+ 踏み面（明るい）
        poly(d, [(VX - wa, ya), (VX + wa, ya), (VX + wb, yb + (ya - yb) * 0.45), (VX - wb, yb + (ya - yb) * 0.45)], CARPET_DARK)
        poly(d, [(VX - wb, yb + (ya - yb) * 0.45), (VX + wb, yb + (ya - yb) * 0.45), (VX + wb, yb), (VX - wb, yb)], CARPET)
        # 金の縁取り（絨毯の端）
        line(d, [(VX - wa + 8, ya), (VX - wb + 8, yb)], CARPET_EDGE, 0.8)
        line(d, [(VX + wa - 8, ya), (VX + wb - 8, yb)], CARPET_EDGE, 0.8)
    # 階段の石の側壁
    poly(d, [(VX - w_bot, y_bot), (VX - w_bot - 16, y_bot), (VX - w_top - 12, y_top), (VX - w_top, y_top)], (222, 214, 196))
    poly(d, [(VX + w_bot, y_bot), (VX + w_bot + 16, y_bot), (VX + w_top + 12, y_top), (VX + w_top, y_top)], (206, 198, 180))
    # 踊り場（赤い絨毯）と大きな星の扉の壁
    rect(d, VX - 120, 232, VX + 120, 254, CARPET)
    rect(d, VX - 120, 232, VX + 120, 254, None, outline=CARPET_EDGE, width=0.8)
    rect(d, VX - 132, 120, VX + 132, 232, WALL_CREAM)
    bricks(d, VX - 132, 120, VX + 132, 232, bw=22, bh=11, color=(226, 212, 182))
    rect(d, VX - 136, 116, VX + 136, 122, (250, 246, 236))
    # 大きな星の扉
    door(d, VX, 232, 64, 96, star=8, big=True)

    # 1階の扉（左右）。ホール奥壁の腰壁に配置
    door(d, 300, 330, 40, 74, star=0)
    door(d, 660, 330, 40, 74, star=0)
    # 中2階の扉（左右）
    door(d, 300, 210, 34, 64, star=0)
    door(d, 660, 210, 34, 64, star=0)
    # 扉前の赤い絨毯（床への短いランナー）
    for cx in (300, 660):
        poly(d, [(cx - 24, 330), (cx + 24, 330), (cx + 36, 372), (cx - 36, 372)], CARPET)
        poly(d, [(cx - 24, 330), (cx + 24, 330), (cx + 36, 372), (cx - 36, 372)], None, outline=CARPET_EDGE, width=0.8)

    # 床（透視チェック＋太陽のモザイク）
    out = finish(img)
    checker_floor(out, 330, cam_h=150, tile=46, focal=300, sun=(0, 330, 150))
    # 側壁の腰壁と床の境界に影
    d2 = ImageDraw.Draw(out)
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.polygon([(0, 420 * FINAL), (260 * FINAL, 330 * FINAL), (700 * FINAL, 330 * FINAL), (GW * FINAL, 420 * FINAL), (GW * FINAL, 440 * FINAL), (700 * FINAL, 345 * FINAL), (260 * FINAL, 345 * FINAL), (0, 440 * FINAL)], fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    out.alpha_composite(sh)
    del d2
    save(out, "foyer.png")


# ======================================================================
# 3. 絵画の部屋（奥壁が広く、額を3枚掛けられる）
# ======================================================================
def make_room() -> None:
    img = canvas()
    d = ImageDraw.Draw(img)
    poly(d, [(0, 0), (GW, 0), (820, 70), (140, 70)], (250, 240, 222))
    for i in range(1, 6):
        t = i / 6
        line(d, [(140 * t, 70 * t), (GW - 140 * t, 70 * t)], (230, 218, 196), 0.8)
    cloud_wall_poly(d, [(0, 0), (140, 70), (140, 300), (0, 360)], seed=21)
    cloud_wall_poly(d, [(GW, 0), (820, 70), (820, 300), (GW, 360)], seed=22)
    poly(d, [(0, 360), (140, 300), (140, 340), (0, 412)], WALL_CREAM)
    poly(d, [(GW, 360), (820, 300), (820, 340), (GW, 412)], WALL_CREAM)
    line(d, [(0, 360), (140, 300)], WALL_CREAM_DARK, 1.6)
    line(d, [(GW, 360), (820, 300)], WALL_CREAM_DARK, 1.6)
    # 奥壁：上は雲、腰壁はクリームの石
    cloud_wall(d, 140, 70, 820, 300, seed=23)
    rect(d, 140, 300, 820, 340, WALL_CREAM)
    line(d, [(140, 300), (820, 300)], WALL_CREAM_DARK, 1.6)
    bricks(d, 140, 302, 820, 340, bw=22, bh=11, color=(226, 212, 182))
    for x in (142, 818):
        pillar(d, x, 70, 340, 10)
    # 壁掛け用のモールディング（額の背後に来る帯）
    rect(d, 160, 96, 800, 100, (250, 246, 236))
    # 壁付きの燭台（左右）
    for x in (200, 760):
        rect(d, x - 1.5, 200, x + 1.5, 226, GOLD_DARK)
        poly(d, [(x - 8, 204), (x + 8, 204), (x, 214)], GOLD)
        ell(d, x, 196, 3.2, 5, (255, 214, 96))
        ell(d, x, 194, 1.6, 2.6, (255, 250, 220))
    # 床から見える赤い絨毯（奥壁沿い）
    out = finish(img)
    checker_floor(out, 340, cam_h=130, tile=46, focal=300)
    od = ImageDraw.Draw(out)
    fx = lambda v: v * FINAL  # noqa: E731
    od.polygon([(fx(300), fx(340)), (fx(660), fx(340)), (fx(720), fx(GH)), (fx(240), fx(GH))], fill=CARPET)
    od.line([(fx(300), fx(340)), (fx(240), fx(GH))], fill=CARPET_EDGE, width=3)
    od.line([(fx(660), fx(340)), (fx(720), fx(GH))], fill=CARPET_EDGE, width=3)
    od.line([(fx(312), fx(340)), (fx(258), fx(GH))], fill=CARPET_DARK, width=2)
    od.line([(fx(648), fx(340)), (fx(702), fx(GH))], fill=CARPET_DARK, width=2)
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.polygon([(0, fx(412)), (fx(140), fx(340)), (fx(820), fx(340)), (fx(GW), fx(412)), (fx(GW), fx(432)), (fx(820), fx(356)), (fx(140), fx(356)), (0, fx(432))], fill=(0, 0, 0, 70))
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
    save(out, "room.png")


# ======================================================================
# 4. 金の額縁（9スライス）・扉・星・キャンバスのプレースホルダ
# ======================================================================
def make_frame() -> None:
    size = 256
    b = 40  # 縁の太さ（ゲーム側の9スライス指定と一致させる）
    img = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = 2
    # 外側の影 → 金の縁 → 内側の溝 → 黒の見切り
    d.rectangle((0, 0, size * k - 1, size * k - 1), fill=GOLD_DARK)
    d.rectangle((4 * k, 4 * k, size * k - 1 - 4 * k, size * k - 1 - 4 * k), fill=GOLD)
    d.rectangle((8 * k, 8 * k, size * k - 1 - 8 * k, size * k - 1 - 8 * k), fill=GOLD_LIGHT)
    d.rectangle((14 * k, 14 * k, size * k - 1 - 14 * k, size * k - 1 - 14 * k), fill=GOLD)
    d.rectangle((24 * k, 24 * k, size * k - 1 - 24 * k, size * k - 1 - 24 * k), fill=GOLD_DARK)
    d.rectangle((28 * k, 28 * k, size * k - 1 - 28 * k, size * k - 1 - 28 * k), fill=GOLD_LIGHT)
    d.rectangle((31 * k, 31 * k, size * k - 1 - 31 * k, size * k - 1 - 31 * k), fill=(60, 44, 20))
    d.rectangle((b * k, b * k, size * k - 1 - b * k, size * k - 1 - b * k), fill=(0, 0, 0, 0))
    # 四隅のロゼット（9スライスで伸びない角にだけ置く）
    for (x, y) in [(18 * k, 18 * k), (size * k - 18 * k, 18 * k), (18 * k, size * k - 18 * k), (size * k - 18 * k, size * k - 18 * k)]:
        d.ellipse((x - 11 * k, y - 11 * k, x + 11 * k, y + 11 * k), fill=GOLD_DARK)
        d.ellipse((x - 8 * k, y - 8 * k, x + 8 * k, y + 8 * k), fill=GOLD_LIGHT)
        for i in range(8):
            a = i * math.pi / 4
            px, py = x + math.cos(a) * 5 * k, y + math.sin(a) * 5 * k
            d.ellipse((px - 2 * k, py - 2 * k, px + 2 * k, py + 2 * k), fill=GOLD)
        d.ellipse((x - 2.5 * k, y - 2.5 * k, x + 2.5 * k, y + 2.5 * k), fill=GOLD_DARK)
    img = img.resize((size, size), Image.LANCZOS)
    # 9スライスの角は上書きされないよう、四隅を再度きれいに
    save(img, "frame.png")


def make_placeholder() -> None:
    """絵が未登録のときのキャンバス（麻布の質感に「？」）"""
    w, h = 640, 480
    img = Image.new("RGBA", (w, h), (236, 226, 204, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, h, 4):
        d.line((0, y, w, y), fill=(226, 214, 190), width=1)
    for x in range(0, w, 4):
        d.line((x, 0, x, h), fill=(228, 218, 196), width=1)
    save(img, "placeholder.png")


def make_star() -> None:
    size = 128
    img = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size
    r = size * 0.9
    seq = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.47
        seq.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(seq, fill=GOLD_LIGHT, outline=GOLD_DARK, width=8)
    inner = [(cx + (x - cx) * 0.55, cy + (y - cy) * 0.55) for x, y in seq]
    d.polygon(inner, fill=(255, 240, 170))
    d.ellipse((cx - 22, cy - 6, cx - 10, cy + 14), fill=(40, 30, 20))
    d.ellipse((cx + 10, cy - 6, cx + 22, cy + 14), fill=(40, 30, 20))
    save(img.resize((size, size), Image.LANCZOS), "star.png")


def make_glass() -> None:
    """タイトル用の大きなピーチ姫ステンドグラス"""
    img = canvas()
    d = ImageDraw.Draw(img)
    stained_glass_peach(d, 480, 270, 120, 240)
    bbox = img.getbbox()
    img = img.crop(bbox)
    img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
    save(img, "glass_peach.png")


def make_particles() -> None:
    # 星の粒（ワープ時の演出）
    size = 32
    img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size * 2
    d.polygon([(c, 4), (c + 14, c - 14), (size * 4 - 4, c), (c + 14, c + 14), (c, size * 4 - 4), (c - 14, c + 14), (4, c), (c - 14, c - 14)], fill=(255, 255, 255, 255))
    save(img.resize((size, size), Image.LANCZOS), "sparkle.png")
    # ビネット
    w, h = 960, 540
    v = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(v)
    vd.ellipse((-w * 0.2, -h * 0.35, w * 1.2, h * 1.35), fill=255)
    v = v.filter(ImageFilter.GaussianBlur(90))
    out = Image.new("RGBA", (w, h), (30, 20, 30, 255))
    out.putalpha(Image.eval(v, lambda p: 255 - p))
    save(out, "vignette.png")


if __name__ == "__main__":
    make_outside()
    make_foyer()
    make_room()
    make_frame()
    make_placeholder()
    make_star()
    make_glass()
    make_particles()
