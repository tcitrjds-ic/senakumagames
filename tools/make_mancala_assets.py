#!/usr/bin/env python3
"""「せなくまとマンカラ」の盤まわりの素材を生成する（本物の木製盤を真上から見た絵づくり）。

平面的な塗り分けではなく、盤の「高さ」を先に作り、そこへ左上から光を当てて陰影を計算する。
  - 盤: 角を丸めた板。ふちは丸く面取り、くぼみはお椀状に彫る
  - 光: 左上の手前から。くぼみの左上の壁は影に、右下の壁は明るくなる
  - 木目: 年輪のうねり＋細い繊維＋導管（細い黒点）をノイズから作る
こうすると、くぼみ・面取り・彫刻（矢印や文字）が同じ光で一貫して見える。

出力（games/mancala/public/assets/）:
  board.png        盤（落ち影つき。ゲーム内では 1/2 に縮小して表示）
  seeds.png        ポテト石 4種（横に並べたスプライトシート）
  seed_shadow.png  石の下に敷く影
  ring_pit.png / ring_store.png  くぼみ・ゴールのふちを光らせる輪（白。ゲーム側で色を付ける）
  felt.png         テーブルのフェルト（継ぎ目なしで並べられるタイル）
  light.png        卓上ライトの明かり（中央が明るい丸）
  panel_shadow.png パネル類の落ち影（9スライス用）

使い方:
    pip install Pillow numpy
    python3 tools/make_mancala_assets.py [--preview out.png]

盤の寸法・くぼみの位置は games/mancala/src/layout.ts と揃えること（下の LAYOUT）。
"""

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "games" / "mancala" / "public" / "assets"
FONT = ROOT / "node_modules" / "@fontsource" / "m-plus-rounded-1c" / "files" / "m-plus-rounded-1c-latin-800-normal.woff"

S = 2  # 出力倍率（ゲーム座標 1px = 画像 2px）

# ---- ゲーム座標での配置（src/layout.ts と同じ値）----
LAYOUT = dict(
    board_x=70, board_y=195, board_w=820, board_h=310,
    pit_rx=38, pit_ry=34, store_rx=44, store_ry=105,
    player_pits=[(250 + i * 84, 435) for i in range(6)],
    cpu_pits=[(670 - i * 84, 265) for i in range(6)],
    player_store=(810, 350), cpu_store=(150, 350),
)
MARGIN = 48  # 盤のまわりに取る余白（ゲーム座標）。落ち影がここに入る

# 光の向き（画面の左上・手前から。x右+, y下+, z手前+）
LIGHT = np.array([-0.46, -0.62, 0.64])
LIGHT = LIGHT / np.linalg.norm(LIGHT)

RNG = np.random.default_rng(20261122)  # 何度生成しても同じ絵になるよう固定


def save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, optimize=True)
    print(f"wrote {OUT / name} ({img.width}x{img.height}, {(OUT / name).stat().st_size // 1024} KB)")


def fft_noise(w: int, h: int, beta: float, kx: float = 1.0, ky: float = 1.0) -> np.ndarray:
    """1/f^beta ノイズ（0〜1）。周期的なので上下左右が継ぎ目なくつながる。
    kx を大きくすると横方向の変化が減り、横に長く伸びた模様（木の繊維）になる。"""
    fx = np.fft.fftfreq(w)[None, :] * kx
    fy = np.fft.fftfreq(h)[:, None] * ky
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    spec = (RNG.normal(size=(h, w)) + 1j * RNG.normal(size=(h, w))) / f**beta
    spec[0, 0] = 0
    n = np.fft.ifft2(spec).real
    lo, hi = np.percentile(n, [0.5, 99.5])
    return np.clip((n - lo) / (hi - lo), 0, 1)


def blur(a: np.ndarray, radius: float) -> np.ndarray:
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img).astype(np.float64) / 255


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def shade(height: np.ndarray, gloss: float, spec_power: float) -> tuple[np.ndarray, np.ndarray]:
    """高さマップから (拡散光の明るさ, つやのハイライト) を求める。平らな面の明るさが 1.0。"""
    gy, gx = np.gradient(height)
    nz = 1.0 / np.sqrt(gx * gx + gy * gy + 1.0)
    nx, ny = -gx * nz, -gy * nz
    diffuse = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, None) / LIGHT[2]
    half = LIGHT + np.array([0, 0, 1.0])
    half = half / np.linalg.norm(half)
    spec = np.clip(nx * half[0] + ny * half[1] + nz * half[2], 0, 1) ** spec_power * gloss
    return diffuse, spec


# ------------------------------------------------------------------ 木目

def wood_texture(w: int, h: int) -> np.ndarray:
    """オーク材ふうの木目（RGB 0〜1）。木目は横方向に流れる。"""
    yy = np.arange(h)[:, None] / S
    warp = fft_noise(w, h, 2.4, kx=5.0)             # 年輪のゆるいうねり
    rings = 0.5 + 0.5 * np.sin(2 * math.pi * (yy / 21.0 + warp * 5.0))
    rings = rings**2.2                               # 濃い筋を細く
    fibers = fft_noise(w, h, 1.1, kx=45.0)           # 細い繊維
    tone = fft_noise(w, h, 2.6, kx=2.0)              # 板全体のゆるい色むら
    pores = fft_noise(w, h, 0.4, kx=14.0)            # 導管（細く短い黒点）
    pores = smoothstep(0.80, 0.97, pores)

    light = np.array([232, 184, 120]) / 255
    mid = np.array([206, 150, 90]) / 255
    dark = np.array([150, 96, 52]) / 255
    t = np.clip(0.30 * rings + 0.38 * fibers + 0.32 * tone, 0, 1)[..., None]
    col = np.where(t < 0.5, light + (mid - light) * (t / 0.5), mid + (dark - mid) * ((t - 0.5) / 0.5))
    col = col * (1 - 0.22 * pores[..., None])
    return col


# ------------------------------------------------------------------ 盤

def pit_fields(xx, yy, cx, cy, rx, ry):
    """くぼみ1つぶんの (正規化半径rho, 光源側のふちまでの距離t) を返す。"""
    dx, dy = (xx - cx) / rx, (yy - cy) / ry
    rho = np.sqrt(dx * dx + dy * dy)
    # 光の来る方向へ進んで ふち（楕円）に当たるまでの距離: |p + t*u| = 1 を解く
    ux, uy = LIGHT[0] / rx, LIGHT[1] / ry
    a = ux * ux + uy * uy
    b = 2 * (dx * ux + dy * uy)
    c = dx * dx + dy * dy - 1
    disc = np.clip(b * b - 4 * a * c, 0, None)
    t = (-b + np.sqrt(disc)) / (2 * a)
    return rho, t


def make_board() -> Image.Image:
    L = LAYOUT
    bw, bh = L["board_w"] * S, L["board_h"] * S
    m = MARGIN * S
    W, H = bw + 2 * m, bh + 2 * m
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)

    # --- 板の外形（角丸の四角）: inside = ふちから内側へ何pxか ---
    radius = 30 * S
    qx = np.abs(xx - (m + bw / 2)) - (bw / 2 - radius)
    qy = np.abs(yy - (m + bh / 2)) - (bh / 2 - radius)
    outside = np.sqrt(np.clip(qx, 0, None) ** 2 + np.clip(qy, 0, None) ** 2) + np.minimum(np.maximum(qx, qy), 0) - radius
    inside = -outside
    alpha = np.clip(inside + 0.5, 0, 1)

    # --- 高さマップ ---
    bevel_w, bevel_h = 9 * S, 6.5 * S
    e = np.clip(inside / bevel_w, 0, 1)
    height = bevel_h * np.sqrt(1 - (1 - e) ** 2)        # ふちの丸い面取り
    # ふちに沿った飾り溝（個数の札と重ならないよう、ふちのすぐ内側に1本）
    groove_dist, groove_depth, groove_w = 12.5 * S, 1.5 * S, 1.2 * S
    height -= groove_depth * np.exp(-(((inside - groove_dist) / groove_w) ** 2))

    def to_px(p):
        return (p[0] - L["board_x"]) * S + m, (p[1] - L["board_y"]) * S + m

    pits = [(to_px(p), L["pit_rx"] * S, L["pit_ry"] * S, 15.0 * S) for p in L["player_pits"] + L["cpu_pits"]]
    pits += [(to_px(p), L["store_rx"] * S, L["store_ry"] * S, 18.0 * S) for p in (L["player_store"], L["cpu_store"])]

    carve = np.zeros((H, W))       # 0=板の表面, 1=くぼみの底
    cast = np.zeros((H, W))        # くぼみの中に落ちる影
    lip = np.zeros((H, W))         # くぼみのふちの丸み（ハイライト用）
    for (cx, cy), rx, ry, depth in pits:
        rho, t = pit_fields(xx, yy, cx, cy, rx, ry)
        inner = rho < 1.0
        # 底は平らめ、壁はなだらかに立ち上がるお椀形
        bowl = np.where(inner, (1 - np.clip(rho, 0, 1) ** 2.6) ** 0.85, 0.0)
        # ふちは角を落として丸める
        rim = smoothstep(1.06, 0.96, rho)
        height -= depth * bowl * rim + 1.2 * S * smoothstep(1.10, 1.0, rho) * (1 - inner)
        carve = np.maximum(carve, bowl)
        # 光源側の壁が作る影: ふちに近いほど濃く、底の中央へ向けて薄れる
        reach = 0.95 * depth / (LIGHT[2] / math.hypot(LIGHT[0], LIGHT[1]))
        cast = np.maximum(cast, np.where(inner, smoothstep(reach * 1.25, reach * 0.1, t), 0.0))
        lip = np.maximum(lip, np.exp(-(((rho - 1.0) * min(rx, ry) / (1.6 * S)) ** 2)))

    # --- 彫刻: まく向きの矢印と、盤の銘 ---
    eng = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(eng)
    cy_mid = m + bh / 2
    x0, x1 = to_px((262, 0))[0], to_px((658, 0))[0]
    lw = round(2.2 * S)
    for y, direction in [(cy_mid + 28 * S, 1), (cy_mid - 28 * S, -1)]:   # 下の列は右へ、上の列は左へ
        tip = x1 if direction > 0 else x0
        d.line((x0, y, x1, y), fill=255, width=lw)
        for sgn in (-1, 1):
            d.line((tip, y, tip - direction * 13 * S, y + sgn * 7 * S), fill=255, width=lw)
    font = ImageFont.truetype(str(FONT), 15 * S)
    text = "SENAKUMA   MANCALA"
    spacing = 3.2 * S
    widths = [font.getlength(ch) for ch in text]
    tx = m + bw / 2 - (sum(widths) + spacing * (len(text) - 1)) / 2
    for ch, wch in zip(text, widths):
        d.text((tx, cy_mid), ch, font=font, fill=255, anchor="lm")
        tx += wch + spacing
    # 銘の両わきに小さな菱形
    for sx in (-1, 1):
        px = m + bw / 2 + sx * 150 * S
        r = 4 * S
        d.polygon([(px - r, cy_mid), (px, cy_mid - r), (px + r, cy_mid), (px, cy_mid + r)], fill=255)
    engrave = np.asarray(eng.filter(ImageFilter.GaussianBlur(0.9 * S))).astype(np.float64) / 255
    height -= 1.5 * S * engrave

    # --- 色 ---
    wood = wood_texture(W, H)
    # くぼみの中は彫りたての面: 少し濃く赤みを帯びる
    carved_tint = np.array([0.93, 0.86, 0.78])
    k = smoothstep(0.0, 0.5, carve)[..., None]
    col = wood * (1 - k) + wood * carved_tint * k
    col = col * (1 - 0.42 * engrave[..., None])          # 彫刻の溝は暗く

    diffuse, spec = shade(height, gloss=0.20, spec_power=70)
    ambient = 0.42
    lit = ambient + (1 - ambient) * diffuse
    lit = lit * (1 - 0.46 * cast)                         # くぼみに落ちる影
    lit = lit * (1 - 0.16 * carve)                        # 底ほど光が届きにくい
    # ニスの照り: 左上ほどわずかに明るい
    sheen = 0.06 * (1 - (xx / W) * 0.6 - (yy / H) * 0.9)
    col = np.clip(col * (lit[..., None] + sheen[..., None]) + spec[..., None] * np.array([1.0, 0.96, 0.86]), 0, 1)
    # ふちの丸みに細いハイライト（右下側 = 光を受ける壁の肩）
    gy, gx = np.gradient(height)
    facing = np.clip((-gx * LIGHT[0] - gy * LIGHT[1]) / (0.9 * S), 0, 1)
    col = np.clip(col + (0.10 * lip * facing)[..., None], 0, 1)

    rgba = np.dstack([col, alpha])
    board = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")

    # --- テーブルに落ちる影（接地部は濃く小さく、遠くは薄く広く）---
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    a_img = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    for off, rad, strength in [((7 * S, 11 * S), 13 * S, 0.34), ((2 * S, 3 * S), 3 * S, 0.42)]:
        sh = Image.new("L", (W, H), 0)
        sh.paste(a_img, (round(off[0]), round(off[1])))
        sh = sh.filter(ImageFilter.GaussianBlur(rad)).point(lambda v, s=strength: round(v * s))
        layer = Image.new("RGBA", (W, H), (8, 14, 10, 255))
        layer.putalpha(sh)
        out.alpha_composite(layer)
    out.alpha_composite(board)
    return out


# ------------------------------------------------------------------ ポテト石

SEED_COLORS = [
    ((240, 196, 78), (170, 108, 28)),    # こがね色
    ((248, 220, 126), (188, 138, 50)),   # バター色
    ((218, 158, 84), (136, 80, 36)),     # きつね色
    ((234, 178, 56), (156, 92, 22)),     # 濃いこがね
]
SEED_FRAME = 26 * S  # 1コマの一辺(px)


def make_seeds() -> tuple[Image.Image, Image.Image]:
    ss = 4                       # 4倍で描いて縮小（なめらかな輪郭にする）
    n = SEED_FRAME * ss
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    cx = cy = n / 2
    sheet = Image.new("RGBA", (SEED_FRAME * len(SEED_COLORS), SEED_FRAME), (0, 0, 0, 0))
    shapes = [(0.45, 0.35, 0.3, 1.1), (0.43, 0.37, 2.0, 0.4), (0.46, 0.34, 4.1, 2.6), (0.42, 0.36, 1.2, 5.0)]
    for i, ((light, dark), (ax, ay, ph1, ph2)) in enumerate(zip(SEED_COLORS, shapes)):
        dx, dy = (xx - cx) / (n * ax), (yy - cy) / (n * ay)
        theta = np.arctan2(dy, dx)
        # じゃがいもらしい、ほんの少しいびつな丸
        wobble = 1 + 0.055 * np.sin(2 * theta + ph1) + 0.035 * np.sin(3 * theta + ph2)
        rho = np.sqrt(dx * dx + dy * dy) / wobble
        dome = np.sqrt(np.clip(1 - rho * rho, 0, 1))
        height = dome * n * 0.20
        diffuse, spec = shade(height, gloss=0.75, spec_power=42)
        mottle = fft_noise(n, n, 2.0)[..., None]
        base = np.array(light) / 255 * (0.90 + 0.14 * mottle)
        deep = np.array(dark) / 255
        edge = (1 - dome)[..., None] ** 1.6                      # ふちほど濃く
        col = base * (1 - 0.75 * edge) + deep * 0.75 * edge
        lit = 0.50 + 0.50 * np.clip(diffuse, 0, 1.6)
        col = col * lit[..., None]
        # ガラス玉のような内側の照り返し（光と反対側の下ふち）
        bounce = np.clip(dx * 0.5 + dy * 0.7, 0, 1) * smoothstep(0.55, 0.95, rho) * (rho < 1)
        col = col + 0.22 * bounce[..., None] * np.array([1.0, 0.9, 0.6])
        col = np.clip(col + np.clip(spec, 0, 1)[..., None], 0, 1)
        # じゃがいもの芽（小さなくぼみ）
        for ex, ey in [(-0.10, 0.12), (0.16, -0.02), (0.02, -0.16)]:
            eye = np.exp(-(((dx - ex) ** 2 + (dy - ey) ** 2) / 0.0035))
            col = col * (1 - 0.20 * eye[..., None])
        alpha = np.clip((1 - rho) * n * ax * 0.9, 0, 1)
        img = Image.fromarray((np.dstack([np.clip(col, 0, 1), alpha]) * 255).astype(np.uint8), "RGBA")
        sheet.alpha_composite(img.resize((SEED_FRAME, SEED_FRAME), Image.LANCZOS), (i * SEED_FRAME, 0))

    # 影: やわらかい楕円
    sw = SEED_FRAME
    yy, xx = np.mgrid[0:sw, 0:sw].astype(np.float64)
    r = np.sqrt(((xx - sw / 2) / (sw * 0.46)) ** 2 + ((yy - sw / 2) / (sw * 0.36)) ** 2)
    a = smoothstep(1.0, 0.25, r) * 0.60
    shadow = Image.fromarray((np.dstack([np.zeros((sw, sw, 3)) + np.array([0.16, 0.09, 0.03]), a]) * 255).astype(np.uint8), "RGBA")
    return sheet, shadow


# ------------------------------------------------------------------ 光る輪・テーブル・影

def make_ring(rx: float, ry: float) -> Image.Image:
    """くぼみのふちに沿った光の輪（白）。外側へふわっと広がる。"""
    pad = 22 * S
    w, h = round(2 * rx * S + 2 * pad), round(2 * ry * S + 2 * pad)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    dx, dy = (xx - w / 2) / (rx * S), (yy - h / 2) / (ry * S)
    rho = np.sqrt(dx * dx + dy * dy)
    dist = (rho - 1.0) * min(rx, ry) * S                 # ふちからの距離(px)。外が正
    core = np.exp(-((dist / (2.2 * S)) ** 2))             # ふちの細い芯
    halo = np.exp(-np.clip(dist, 0, None) / (7.0 * S)) * (dist > 0) * 0.55   # 外への広がり
    inner = np.exp(np.clip(dist, None, 0) / (5.0 * S)) * (dist <= 0) * 0.30  # 内側へ少し
    a = np.clip(core + halo + inner, 0, 1)
    rgba = np.dstack([np.ones((h, w, 3)), a])
    return Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")


def make_felt() -> Image.Image:
    n = 256
    fine = fft_noise(n, n, 0.35)                 # 繊維のざらつき
    weave = fft_noise(n, n, 1.2, kx=3.0)         # ごく弱い横の流れ
    cloud = fft_noise(n, n, 2.2)                 # ゆるい色むら
    v = 0.55 * fine + 0.25 * weave + 0.20 * cloud
    base = np.array([38, 86, 70]) / 255
    col = base[None, None, :] * (0.84 + 0.34 * v[..., None])
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8), "RGB")


def make_light() -> Image.Image:
    n = 256
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    r = np.sqrt((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (n / 2)
    a = smoothstep(1.0, 0.0, r) ** 1.5
    rgba = np.dstack([np.ones((n, n, 3)) * np.array([1.0, 0.95, 0.80]), a])
    return Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")


def make_panel_shadow() -> Image.Image:
    """パネルの落ち影。中央を引き伸ばして使う（9スライス）。角の丸み 20px・ぼかし 9px（ゲーム座標）。"""
    n = 96 * S
    img = Image.new("L", (n, n), 0)
    inset = 24 * S
    ImageDraw.Draw(img).rounded_rectangle((inset, inset, n - inset, n - inset), radius=20 * S, fill=255)
    a = img.filter(ImageFilter.GaussianBlur(9 * S))
    out = Image.new("RGBA", (n, n), (6, 16, 12, 255))
    out.putalpha(a.point(lambda v: round(v * 0.62)))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="フェルトの上に盤と石を並べた確認用画像を書き出すパス")
    args = ap.parse_args()

    board = make_board()
    seeds, seed_shadow = make_seeds()
    L = LAYOUT
    ring_pit = make_ring(L["pit_rx"], L["pit_ry"])
    ring_store = make_ring(L["store_rx"], L["store_ry"])
    felt = make_felt()
    light = make_light()
    panel_shadow = make_panel_shadow()

    save(board, "board.png")
    save(seeds, "seeds.png")
    save(seed_shadow, "seed_shadow.png")
    save(ring_pit, "ring_pit.png")
    save(ring_store, "ring_store.png")
    save(felt, "felt.png")
    save(light, "light.png")
    save(panel_shadow, "panel_shadow.png")

    if args.preview:
        W, H = 960 * S, 540 * S
        bg = Image.new("RGB", (W, H))
        for y in range(0, H, felt.height):
            for x in range(0, W, felt.width):
                bg.paste(felt, (x, y))
        bg = bg.convert("RGBA")
        lg = light.resize((round(W * 1.1), round(H * 1.5)), Image.BICUBIC)
        lg.putalpha(lg.getchannel("A").point(lambda v: v * 46 // 255))
        bg.alpha_composite(lg, (round(W / 2 - lg.width / 2), round(350 * S - lg.height / 2)))
        bg.alpha_composite(board, ((L["board_x"] - MARGIN) * S, (L["board_y"] - MARGIN) * S))
        # 石を黄金角のうずまきで並べてみる
        for (px, py) in L["player_pits"] + L["cpu_pits"]:
            for k in range(4):
                r = 9.5 * math.sqrt(k + 0.35)
                a = k * 2.39996 + px
                sx, sy = px + math.cos(a) * r, py + math.sin(a) * r * 0.85
                fr = seeds.crop(((k % 4) * SEED_FRAME, 0, (k % 4 + 1) * SEED_FRAME, SEED_FRAME)).rotate((k * 47 + px) % 360, Image.BICUBIC)
                bg.alpha_composite(seed_shadow, (round((sx + 2) * S - SEED_FRAME / 2), round((sy + 3) * S - SEED_FRAME / 2)))
                bg.alpha_composite(fr, (round(sx * S - SEED_FRAME / 2), round(sy * S - SEED_FRAME / 2)))
        bg.convert("RGB").save(args.preview)
        print(f"wrote {args.preview}")


if __name__ == "__main__":
    main()
