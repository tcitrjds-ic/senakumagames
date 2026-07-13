#!/usr/bin/env python3
"""ゲーム素材を「白フチステッカー調」で生成する。

切り抜きキャラの白い縁取りに世界観を合わせ、ポテト・岩などの
オブジェクトも白フチ＋落ち影付きのステッカー風で統一する。
背景（空・丘・地面）、パーティクル、マンカラの木製盤もここで生成。

使い方:
    pip install Pillow
    python tools/make_game_assets.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "games" / "runner-2d" / "public" / "assets"
MANCALA = ROOT / "games" / "mancala" / "public" / "assets"


def save(img: Image.Image, *dests: Path) -> None:
    for d in dests:
        d.parent.mkdir(parents=True, exist_ok=True)
        img.save(d)
        print(f"wrote {d} ({img.width}x{img.height})")


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def vgradient(w: int, h: int, stops: list[tuple[float, tuple]]) -> Image.Image:
    """縦グラデーション。stops: [(位置0-1, RGB)]"""
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                k = (t - p0) / max(1e-6, p1 - p0)
                d.line((0, y, w, y), fill=lerp(c0, c1, k))
                break
    return img


def sticker(img: Image.Image, outline: int, shadow=(5, 9), sh_alpha=70) -> Image.Image:
    """白フチ＋落ち影を付ける（キャラ切り抜きと同じステッカー風に揃える）"""
    pad = outline + max(shadow) + 10
    base = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    base.alpha_composite(img, (pad, pad))
    alpha = base.getchannel("A")
    ring = alpha.filter(ImageFilter.MaxFilter(outline * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    white = Image.new("RGBA", base.size, (255, 255, 255, 255))
    white.putalpha(ring)
    sh = Image.new("RGBA", base.size, (150, 90, 70, 255))
    sh.putalpha(ring.filter(ImageFilter.GaussianBlur(5)).point(lambda v: v * sh_alpha // 255))
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out.alpha_composite(sh, shadow)
    out.alpha_composite(white)
    out.alpha_composite(base)
    return out


def ellipse(d, cx, cy, rx, ry, fill, outline=None, width=0):
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=fill, outline=outline, width=width)


# ---------------------------------------------------------------- 背景素材

def make_sky() -> None:
    img = vgradient(64, 540, [
        (0.0, (124, 196, 244)),
        (0.55, (196, 233, 252)),
        (1.0, (253, 240, 244)),
    ]).convert("RGBA")
    save(img, RUNNER / "sky.png")


def make_bg_mancala() -> None:
    img = vgradient(64, 540, [
        (0.0, (255, 238, 245)),
        (0.6, (255, 224, 236)),
        (1.0, (255, 209, 226)),
    ]).convert("RGBA")
    save(img, MANCALA / "bg.png")


def make_skies_extra() -> None:
    """夕焼けと夜の空（走行距離で昼からクロスフェードする）"""
    sunset = vgradient(64, 540, [
        (0.0, (108, 106, 190)),
        (0.45, (238, 130, 122)),
        (0.75, (255, 183, 120)),
        (1.0, (255, 224, 180)),
    ]).convert("RGBA")
    save(sunset, RUNNER / "sky_sunset.png")
    night = vgradient(64, 540, [
        (0.0, (26, 30, 74)),
        (0.6, (55, 60, 118)),
        (1.0, (94, 96, 150)),
    ]).convert("RGBA")
    save(night, RUNNER / "sky_night.png")


def make_stars() -> None:
    import random
    rng = random.Random(7)
    S = 256
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(42):
        x, y = rng.randint(4, S - 4), rng.randint(4, S - 4)
        r = rng.choice([1, 1, 1, 2, 2, 3])
        a = rng.randint(140, 255)
        ellipse(d, x, y, r, r, (255, 252, 230, a))
    for _ in range(5):  # 十字のきらめき
        x, y = rng.randint(10, S - 10), rng.randint(10, S - 10)
        ln = rng.randint(4, 7)
        d.line((x - ln, y, x + ln, y), fill=(255, 252, 230, 200), width=1)
        d.line((x, y - ln, x, y + ln), fill=(255, 252, 230, 200), width=1)
    save(img, RUNNER / "stars.png")


def make_moon() -> None:
    S = 256
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r in range(S // 2, 60, -2):  # ふんわり光輪
        a = round(60 * (1 - (r - 60) / (S / 2 - 60)) ** 1.8)
        ellipse(d, S / 2, S / 2, r, r, (255, 244, 190, a))
    ellipse(d, S / 2, S / 2, 60, 60, (255, 246, 205, 255))
    # 欠け（オフセット円で塗り消して三日月に）
    d.ellipse((S / 2 - 38, S / 2 - 78, S / 2 + 60, S / 2 + 20), fill=(0, 0, 0, 0))
    save(img, RUNNER / "moon.png")


def make_vignette() -> None:
    """画面四隅をほんのり暗くするビネット"""
    W, H = 480, 270
    mask = Image.new("L", (W, H), 255)
    md = ImageDraw.Draw(mask)
    steps = 90
    for k in range(steps):
        t = k / steps
        a = round(255 * (1 - t) ** 2)
        md.ellipse(
            (W / 2 - W * 0.72 * t, H / 2 - H * 0.78 * t, W / 2 + W * 0.72 * t, H / 2 + H * 0.78 * t),
            fill=a,
        )
    img = Image.new("RGBA", (W, H), (70, 32, 52, 70))
    img.putalpha(mask.point(lambda v: v * 70 // 255))
    img = img.filter(ImageFilter.GaussianBlur(10))
    save(img, RUNNER / "vignette.png", MANCALA / "vignette.png")


def make_medals() -> None:
    for name, base, dark in [
        ("medal_gold", (250, 205, 88), (214, 158, 44)),
        ("medal_silver", (208, 214, 224), (156, 164, 180)),
        ("medal_bronze", (222, 158, 110), (178, 116, 72)),
    ]:
        img = Image.new("RGBA", (360, 420), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # リボン
        d.polygon([(120, 20), (180, 130), (60, 130)], fill=(226, 80, 90, 255))
        d.polygon([(240, 20), (300, 130), (180, 130)], fill=(200, 60, 72, 255))
        # メダル本体
        ellipse(d, 180, 240, 130, 130, dark + (255,))
        ellipse(d, 180, 232, 122, 122, base + (255,))
        ellipse(d, 180, 232, 92, 92, dark + (120,))
        # 星
        pts = []
        for i in range(10):
            ang = math.pi / 5 * i - math.pi / 2
            r = 62 if i % 2 == 0 else 26
            pts.append((180 + r * math.cos(ang), 232 + r * math.sin(ang)))
        d.polygon(pts, fill=(255, 255, 255, 235))
        out = sticker(img, outline=12)
        out = out.resize((110, 128), Image.LANCZOS)
        save(out, RUNNER / f"{name}.png")


def make_sun() -> None:
    S = 256
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r in range(S // 2, 0, -2):
        a = round(120 * (1 - r / (S / 2)) ** 1.6)
        ellipse(d, S / 2, S / 2, r, r, (255, 245, 190, a))
    ellipse(d, S / 2, S / 2, 52, 52, (255, 250, 215, 235))
    save(img, RUNNER / "sun.png")


def hills(width: int, height: int, color, waves: list[tuple[float, float, float]], base: float) -> Image.Image:
    """タイル可能な丘シルエット。waves: [(周期数, 振幅, 位相)]"""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = []
    for x in range(width + 1):
        y = base
        for k, amp, ph in waves:
            y += amp * math.sin(2 * math.pi * k * x / width + ph)
        pts.append((x, y))
    poly = [(0, height)] + pts + [(width, height)]
    d.polygon(poly, fill=color)
    top = tuple(min(255, c + 24) for c in color[:3]) + (color[3],)
    for x, y in pts[::2]:
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=top)
    return img


def make_hills() -> None:
    far = hills(512, 200, (183, 219, 203, 255), [(2, 26, 0.4), (3, 14, 1.9)], 92)
    near = hills(512, 170, (156, 205, 137, 255), [(1, 30, 2.6), (4, 11, 0.9)], 84)
    save(far, RUNNER / "hills_far.png")
    save(near, RUNNER / "hills_near.png")


def make_cloud() -> None:
    S = 4
    img = Image.new("RGBA", (256 * S, 128 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    shade = (225, 240, 252, 255)
    for cx, cy, r, sx in [(170, 330, 108, 1.0), (285, 272, 132, 1.0), (400, 330, 100, 1.0),
                          (680, 170, 82, 0.95), (770, 132, 102, 0.95), (860, 172, 78, 0.95)]:
        ellipse(d, cx, cy + 14, r, r * 0.72, shade)
    for cx, cy, r in [(170, 320, 106), (285, 262, 130), (398, 320, 98),
                      (682, 162, 80), (770, 124, 100), (858, 164, 76)]:
        ellipse(d, cx, cy, r, r * 0.74, (255, 255, 255, 250))
    d.rounded_rectangle((92, 300, 470, 400), radius=48, fill=(255, 255, 255, 250))
    d.rounded_rectangle((622, 158, 918, 232), radius=36, fill=(255, 255, 255, 250))
    img = img.resize((256, 128), Image.LANCZOS)
    save(img, RUNNER / "cloud.png")


def make_ground() -> None:
    S = 4
    W, H = 128 * S, 96 * S
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((0, 0, W, H), fill=(236, 215, 171, 255))
    # 土の質感（タイルできるよう左右端を避ける or 端で対にする）
    for cx, cy, r in [(70, 240, 16), (200, 300, 12), (300, 230, 14), (420, 320, 15),
                      (150, 350, 10), (350, 155, 9), (460, 200, 10), (40, 160, 9)]:
        ellipse(d, cx, cy, r * 1.9, r * 1.4, (214, 188, 138, 255))
        ellipse(d, cx - r * 0.5, cy - r * 0.5, r * 0.8, r * 0.6, (226, 202, 154, 255))
    d.rectangle((0, 210, W, 218), fill=(226, 203, 158, 90))
    d.rectangle((0, 330, W, 336), fill=(226, 203, 158, 70))
    # 草
    d.rectangle((0, 0, W, 128), fill=(143, 209, 119, 255))
    d.rectangle((0, 0, W, 34), fill=(184, 230, 154, 255))
    d.rectangle((0, 116, W, 128), fill=(109, 179, 95, 255))
    for x in range(16, W, 64):
        d.polygon([(x, 96), (x + 10, 40), (x + 20, 96)], fill=(120, 190, 100, 255))
        d.polygon([(x + 30, 100), (x + 38, 56), (x + 46, 100)], fill=(170, 220, 140, 255))
    img = img.resize((128, 96), Image.LANCZOS)
    save(img, RUNNER / "ground.png")


# ------------------------------------------------------------ ステッカー小物

def _potato(box_top, box_bottom, band, mark) -> Image.Image:
    img = Image.new("RGBA", (440, 440), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fry_hi, fry, fry_sh = (255, 240, 176, 255), (255, 214, 106, 255), (240, 178, 62, 255)
    # ポテト（奥→手前）
    for x0, y0, x1, c in [(115, 60, 165, fry_sh), (255, 66, 305, fry_sh),
                          (85, 96, 140, fry), (185, 40, 240, fry), (285, 92, 340, fry)]:
        d.rounded_rectangle((x0, y0, x1, 260), radius=22, fill=c)
        d.rounded_rectangle((x0 + 8, y0 + 8, x0 + 20, 250), radius=8, fill=fry_hi)
    # 箱（グラデ + 帯）
    for i, y in enumerate(range(215, 400)):
        t = i / 185
        w0 = 78 + t * 34
        d.line((w0, y, 440 - w0, y), fill=lerp(box_top, box_bottom, t))
    d.polygon([(86, 246), (354, 246), (346, 286), (94, 286)], fill=band)
    ellipse(d, 220, 268, 26, 22, mark)
    return img


def make_potato() -> None:
    img = _potato((255, 106, 106), (219, 64, 76), (255, 248, 240, 255), (255, 214, 106, 255))
    img = sticker(img, outline=15)
    img = img.resize((128, 128), Image.LANCZOS)
    save(img, RUNNER / "potato.png", MANCALA / "potato.png")

    # ゴールデンポテト（レア・+5点）
    gold = _potato((255, 214, 92), (222, 158, 40), (255, 252, 238, 255), (226, 80, 90, 255))
    d = ImageDraw.Draw(gold)
    for cx, cy, ln in [(90, 130, 16), (350, 180, 13), (140, 330, 12)]:  # きらめき
        d.line((cx - ln, cy, cx + ln, cy), fill=(255, 255, 255, 230), width=6)
        d.line((cx, cy - ln, cx, cy + ln), fill=(255, 255, 255, 230), width=6)
    gold = sticker(gold, outline=15)
    gold = gold.resize((128, 128), Image.LANCZOS)
    save(gold, RUNNER / "potato_gold.png")


def make_rock() -> None:
    S = 4
    img = Image.new("RGBA", (120 * S, 92 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = (169, 173, 181, 255)
    d.polygon(
        [(60, 360), (28, 250), (85, 140), (200, 70), (330, 86),
         (432, 170), (462, 285), (440, 360)],
        fill=base,
    )
    d.polygon([(85, 140), (200, 70), (330, 86), (300, 160), (150, 190)], fill=(198, 202, 210, 255))
    ellipse(d, 150, 250, 40, 30, (140, 144, 152, 255))
    ellipse(d, 320, 230, 48, 34, (140, 144, 152, 255))
    ellipse(d, 245, 315, 34, 22, (128, 132, 140, 255))
    d.polygon([(60, 360), (440, 360), (430, 330), (75, 330)], fill=(138, 142, 150, 255))
    img = sticker(img, outline=13)
    img = img.resize((128, 100), Image.LANCZOS)
    save(img, RUNNER / "rock.png")


def make_bird() -> None:
    """羽ばたき2フレームのとり（ステッカー調）"""
    for name, wing_up in [("bird1", True), ("bird2", False)]:
        img = Image.new("RGBA", (400, 340), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        body = (126, 195, 240, 255)
        belly = (235, 248, 255, 255)
        wing = (86, 160, 214, 255)
        ellipse(d, 200, 190, 130, 105, body)                     # 体
        ellipse(d, 210, 235, 88, 55, belly)                      # おなか
        # しっぽ
        d.polygon([(75, 175), (18, 140), (30, 205)], fill=wing)
        # 羽（上/下）
        if wing_up:
            d.polygon([(150, 165), (95, 55), (215, 120)], fill=wing)
            d.polygon([(150, 168), (130, 80), (230, 135)], fill=(106, 178, 228, 255))
        else:
            d.polygon([(150, 200), (100, 295), (225, 240)], fill=wing)
            d.polygon([(150, 200), (135, 275), (235, 232)], fill=(106, 178, 228, 255))
        # くちばしと目
        d.polygon([(320, 175), (372, 190), (320, 210)], fill=(255, 176, 82, 255))
        ellipse(d, 282, 165, 17, 19, (70, 46, 34, 255))
        ellipse(d, 288, 158, 6, 6, (255, 255, 255, 255))
        ellipse(d, 250, 220, 20, 12, (255, 170, 190, 160))       # ほっぺ
        out = sticker(img, outline=13)
        out = out.resize((104, 92), Image.LANCZOS)
        save(out, RUNNER / f"{name}.png")


def make_flowers() -> None:
    """草地のかざり用の花（2色）"""
    for name, petal, center in [
        ("flower1", (255, 159, 180, 255), (255, 236, 150, 255)),
        ("flower2", (255, 216, 106, 255), (255, 250, 230, 255)),
    ]:
        img = Image.new("RGBA", (200, 260), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((92, 120, 108, 250), radius=8, fill=(109, 179, 95, 255))
        ellipse(d, 68, 190, 34, 16, (120, 190, 100, 255))
        ellipse(d, 132, 215, 34, 16, (120, 190, 100, 255))
        for k in range(6):
            a = math.pi / 3 * k
            ellipse(d, 100 + 42 * math.cos(a), 78 + 42 * math.sin(a), 30, 30, petal)
        ellipse(d, 100, 78, 26, 26, center)
        out = sticker(img, outline=10, shadow=(3, 5), sh_alpha=55)
        out = out.resize((56, 72), Image.LANCZOS)
        save(out, RUNNER / f"{name}.png")


def make_shadow() -> None:
    """接地影（やわらかい黒楕円）"""
    S = 256
    img = Image.new("RGBA", (S, S // 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r in range(100, 0, -2):
        a = round(95 * (1 - r / 100) ** 1.3)
        ellipse(d, S / 2, S / 4, r * 1.22, r * 0.5, (40, 24, 16, a))
    img = img.resize((128, 64), Image.LANCZOS)
    save(img, RUNNER / "shadow.png")


def make_particles() -> None:
    # きらきら星
    S = 128
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c, m = S / 2, S / 2 - 6
    pts = []
    for i in range(8):
        ang = math.pi / 4 * i - math.pi / 2
        r = m if i % 2 == 0 else m * 0.38
        pts.append((c + r * math.cos(ang), c + r * math.sin(ang)))
    d.polygon(pts, fill=(255, 226, 120, 255))
    inner = [(c + (p[0] - c) * 0.55, c + (p[1] - c) * 0.55) for p in pts]
    d.polygon(inner, fill=(255, 250, 214, 255))
    img = img.resize((64, 64), Image.LANCZOS)
    save(img, RUNNER / "sparkle.png", MANCALA / "sparkle.png")

    # 土ぼこり（やわらかい円）
    S = 128
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r in range(S // 2, 0, -2):
        a = round(140 * (1 - r / (S / 2)) ** 1.4)
        ellipse(d, S / 2, S / 2, r, r, (250, 240, 220, a))
    img = img.resize((64, 64), Image.LANCZOS)
    save(img, RUNNER / "dust.png")


# ------------------------------------------------------------- マンカラの盤

def pit_inset(img: Image.Image, cx: float, cy: float, rx: float, ry: float) -> None:
    """くぼみを描く: 縁 → 内側を上(暗)→下(明)の縦グラデで行ごとに塗る"""
    d = ImageDraw.Draw(img)
    ellipse(d, cx, cy, rx + 6, ry + 6, (156, 102, 56, 255))  # 縁
    dark, light = (168, 132, 92), (238, 210, 168)
    for yy in range(round(cy - ry), round(cy + ry) + 1):
        dy = (yy - cy) / ry
        half = rx * math.sqrt(max(0.0, 1 - dy * dy))
        t = (dy + 1) / 2
        d.line((cx - half, yy, cx + half, yy), fill=lerp(dark, light, t ** 0.8))
    # 底の楕円ハイライト（浅い皿感）
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    ellipse(od, cx, cy + ry * 0.22, rx * 0.78, ry * 0.62, (255, 240, 210, 60))
    img.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(6)))


def make_board() -> None:
    W, H = 1640, 620  # ゲーム内 820x310 の2倍
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wood = vgradient(W, H, [(0.0, (226, 173, 114)), (0.55, (206, 146, 88)), (1.0, (188, 126, 72))]).convert("RGBA")
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 1, H - 1), radius=56, fill=255)
    img.paste(wood, (0, 0), mask)

    # 木目と内側の光る枠は透明レイヤーに描いてから合成（確実なアルファブレンド）
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i, (yy, amp, k) in enumerate([(70, 9, 3), (150, 12, 2), (240, 8, 4), (330, 11, 3), (420, 9, 2), (500, 12, 4), (560, 8, 3)]):
        pts = [(x, yy + amp * math.sin(2 * math.pi * k * x / W + i * 1.3)) for x in range(0, W, 8)]
        od.line(pts, fill=(126, 78, 40, 46), width=5)
    od.rounded_rectangle((12, 12, W - 13, H - 13), radius=48, outline=(255, 226, 180, 80), width=6)
    overlay.putalpha(Image.composite(overlay.getchannel("A"), Image.new("L", (W, H), 0), mask))
    img.alpha_composite(overlay)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=56, outline=(150, 96, 50, 255), width=10)

    # くぼみ位置（GameScene.pitPos と一致させる: 盤の原点 = ゲーム座標(70,195)）
    for i in range(6):
        pit_inset(img, (250 + i * 84 - 70) * 2, (435 - 195) * 2, 76, 68)   # 自分側
        pit_inset(img, (670 - i * 84 - 70) * 2, (265 - 195) * 2, 76, 68)   # せなくま側
    pit_inset(img, (810 - 70) * 2, (350 - 195) * 2, 88, 210)               # 自分ゴール
    pit_inset(img, (150 - 70) * 2, (350 - 195) * 2, 88, 210)               # せなくまゴール

    img = sticker(img, outline=18, shadow=(6, 14), sh_alpha=80)
    save(img, MANCALA / "board.png")


def make_glow() -> None:
    S = 256
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r in range(S // 2, 0, -2):
        a = round(150 * (1 - r / (S / 2)) ** 1.2)
        ellipse(d, S / 2, S / 2, r, r * 0.9, (255, 240, 150, a))
    img = img.resize((160, 160), Image.LANCZOS)
    save(img, MANCALA / "glow.png")


if __name__ == "__main__":
    make_sky()
    make_skies_extra()
    make_stars()
    make_moon()
    make_vignette()
    make_medals()
    make_bg_mancala()
    make_sun()
    make_hills()
    make_cloud()
    make_ground()
    make_potato()
    make_rock()
    make_bird()
    make_flowers()
    make_shadow()
    make_particles()
    make_board()
    make_glow()
