#!/usr/bin/env python3
"""ゲーム用プレースホルダー素材を生成する。

player.png は本物のせなくまさんの切り抜き画像が用意できるまでの仮画像。
tools/cutout.py で作った切り抜きPNGに差し替えることを前提にしている。

使い方:
    pip install Pillow
    python tools/make_placeholder_assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"

# 4倍サイズで描いて縮小し、輪郭を滑らかにする
SS = 4

BODY = (185, 138, 96, 255)
BELLY = (243, 223, 195, 255)
PINK = (246, 179, 193, 255)
DARK = (91, 70, 50, 255)
BLUSH = (246, 170, 185, 160)


def canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def save(img: Image.Image, name: str, w: int, h: int) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img = img.resize((w, h), Image.LANCZOS)
    path = OUT_DIR / name
    img.save(path)
    print(f"wrote {path} ({w}x{h})")


def ellipse(d: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, fill) -> None:
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)


def make_player() -> None:
    img, d = canvas(256, 256)
    # 耳（頭より先に描いて頭で下側を隠す）
    for sx in (-1, 1):
        ellipse(d, 512 + sx * 200, 190, 105, 105, BODY)
        ellipse(d, 512 + sx * 200, 195, 58, 58, PINK)
    # 体・足・腕
    ellipse(d, 512, 790, 240, 200, BODY)
    ellipse(d, 400, 950, 78, 55, BELLY)
    ellipse(d, 624, 950, 78, 55, BELLY)
    ellipse(d, 296, 750, 72, 62, BODY)
    ellipse(d, 728, 750, 72, 62, BODY)
    ellipse(d, 512, 830, 140, 118, BELLY)
    # 頭
    ellipse(d, 512, 400, 270, 262, BODY)
    # 口まわり
    ellipse(d, 512, 490, 130, 98, BELLY)
    # 目
    for sx in (-1, 1):
        ellipse(d, 512 + sx * 118, 398, 30, 32, DARK)
        ellipse(d, 512 + sx * 118 + 10, 388, 10, 10, (255, 255, 255, 255))
    # 鼻と口
    ellipse(d, 512, 452, 26, 20, DARK)
    d.arc((472, 448, 552, 512), start=20, end=160, fill=DARK, width=10)
    # ほっぺ
    ellipse(d, 322, 480, 46, 28, BLUSH)
    ellipse(d, 702, 480, 46, 28, BLUSH)
    save(img, "player.png", 256, 256)


def make_potato() -> None:
    img, d = canvas(128, 128)
    fry_back = (255, 196, 70, 255)
    fry = (255, 216, 106, 255)
    box = (233, 78, 90, 255)
    # 奥のポテト
    d.rounded_rectangle((175, 105, 235, 320), radius=25, fill=fry_back)
    d.rounded_rectangle((295, 115, 355, 320), radius=25, fill=fry_back)
    # 手前のポテト
    d.rounded_rectangle((130, 150, 195, 330), radius=25, fill=fry)
    d.rounded_rectangle((225, 80, 290, 330), radius=25, fill=fry)
    d.rounded_rectangle((320, 145, 385, 330), radius=25, fill=fry)
    # 赤い箱
    d.polygon([(110, 285), (402, 285), (355, 475), (157, 475)], fill=box)
    d.polygon([(120, 315), (392, 315), (383, 352), (129, 352)], fill=(255, 245, 235, 255))
    save(img, "potato.png", 128, 128)


def make_rock() -> None:
    img, d = canvas(128, 96)
    base = (168, 172, 180, 255)
    spot = (140, 144, 152, 255)
    light = (198, 202, 210, 255)
    d.polygon(
        [
            (60, 384), (28, 270), (85, 150), (200, 72), (330, 88),
            (452, 175), (484, 295), (460, 384),
        ],
        fill=base,
    )
    ellipse(d, 210, 140, 90, 45, light)
    ellipse(d, 150, 250, 40, 30, spot)
    ellipse(d, 320, 220, 48, 34, spot)
    ellipse(d, 250, 320, 36, 24, spot)
    save(img, "rock.png", 128, 96)


def make_cloud() -> None:
    img, d = canvas(256, 128)
    white = (255, 255, 255, 235)
    # 雲A（大きめ・下寄り）
    ellipse(d, 170, 330, 110, 80, white)
    ellipse(d, 280, 280, 130, 100, white)
    ellipse(d, 395, 330, 105, 75, white)
    d.rounded_rectangle((110, 320, 450, 405), radius=40, fill=white)
    # 雲B（小さめ・上寄り）
    ellipse(d, 670, 175, 85, 60, white)
    ellipse(d, 760, 140, 100, 75, white)
    ellipse(d, 850, 175, 80, 55, white)
    d.rounded_rectangle((625, 170, 895, 235), radius=32, fill=white)
    save(img, "cloud.png", 256, 128)


def make_ground() -> None:
    img, d = canvas(128, 96)
    d.rectangle((0, 0, 512, 384), fill=(232, 211, 169, 255))
    d.rectangle((0, 0, 512, 100), fill=(158, 217, 138, 255))
    d.rectangle((0, 88, 512, 118), fill=(123, 196, 106, 255))
    for cx, cy, r in [(60, 190, 14), (150, 265, 10), (260, 205, 12), (380, 305, 14), (450, 175, 10), (95, 330, 12), (320, 155, 8)]:
        ellipse(d, cx, cy, r * 2, r * 1.6, (208, 183, 138, 255))
    save(img, "ground.png", 128, 96)


if __name__ == "__main__":
    make_player()
    make_potato()
    make_rock()
    make_cloud()
    make_ground()
